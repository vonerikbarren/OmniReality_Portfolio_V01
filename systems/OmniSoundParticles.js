/**
 * systems/OmniSoundParticles.js — the SOUND PARTICLES of every node that makes sound (V194).
 *
 * For every node with `data.sound.enabled` AND `data.soundParticles.enabled` (and count > 0) this module keeps ONE THREE.Points in the
 * existing scene (no new WebGL context, no shader: PointsMaterial + a position and a colour attribute updated on the CPU):
 *
 *   FORMATION   the resting positions come from utils/OmniSoundParticleModel.js FORMATIONS (14 shapes), stored in a preallocated buffer in
 *               "importance order" (van der Corput) so that drawing only the first k particles still shows the whole shape evenly: that is
 *               how LOD, the global cap and "count follows level" work (drawRange, no rebuild).
 *   MOTION      every frame the analysis of the node (SoundEngine.getAnalysis(nodeId)) goes through the pure bandsToMotion() smoother
 *               (input smoothing, attack / release, the 7 band -> target mapping) and displaces the formation: radius breathing, height
 *               waves, differential swirl, jitter, size / brightness / hue; plus slow noise, rotation and an optional fading ghost layer
 *               (trails). The 'bars' formation is a real spectrum analyser: 32 columns rise with their frequency range.
 *   COLOUR      solid / gradient / pitch only touch the material colour (no per-particle writes); 'by band' writes one colour per particle.
 *   FOLLOW      the Points sit at the node's world position every frame: move the node (StrictAlign, drag, behaviour) and the cloud goes along.
 *   COST        no clouds -> update() returns after one timer add. A silent, settled cloud with pauseWhenSilent does nothing (not even an
 *               analysis call) until the engine says it plays. Far / off-screen clouds are hidden or paused, far clouds are thinned (LOD),
 *               and all clouds share a global cap (20000, lowered by Admin > Sound when that module exists): the NEAREST nodes keep theirs.
 *               Nothing is allocated per frame; buffers grow only when the count outgrows them.
 *   DISPOSAL    a deleted / disabled node frees its geometry and material at once (omni:node-deleted, the 4-times-a-second scan, destroy()).
 *
 * Reads: node.data.sound, node.data.soundParticles (sanitized here, never trusted). Writes nothing. Degrades gracefully: no SoundEngine,
 * no getAnalysis, an engine that throws, or an analysis of null all mean "silence" (the cloud rests, nothing breaks).
 * Events listened to: omni:node-deleted {id}, omni:node-updated / omni:nodes-updated / omni:node-created, omni:sound-particles-changed {nodeId?},
 * omni:sound-state, omni:sound-settings-set, omni:scene-clear-request. Module contract: constructor(context, omniNode) / init (guarded) / update(delta)
 * / destroy / onResize. Stats for the viewer: getStats(nodeId), getTotals() and the PARTICLE_SERVICES.system handle.
 */

import * as THREE from 'three'
import SoundEngine from './OmniSoundEngine.js'
import {
  PARTICLE_LIMITS, PARTICLE_KEYS, BAND_IDS, sanitizeParticles, lodCount, allocateParticleBudget, createMotionState, bandsToMotion,
  pitchHue, layoutFormation, displaceParticles, createBarState, updateBarColumns, bandColor, hexToRgb01, rgbToHue, hslToRgb,
} from '../utils/OmniSoundParticleModel.js'

/** The running system registers itself here so the viewer panels can ask for stats without importing a module instance. */
export const PARTICLE_SERVICES = { system: null }

const SCAN_INTERVAL = 0.25
const TAU = Math.PI * 2
const MIN_CAP = 256
const CAP_KEYS = ['particlesGlobalCap', 'particleGlobalCap', 'particlesCap', 'particleCap', 'globalParticleCap', 'maxParticles', 'particlesMax']
const LAYOUT_KEYS = ['formation', 'radius', 'height', 'turns', 'thickness', 'layers', 'seed', 'count', 'nodeCap', 'tilt']
const STYLE_KEYS = ['colorMode', 'color', 'color2', 'blend', 'shape', 'opacity', 'depthTest', 'trail']
const RATE_HZ = { every: 0, 30: 30, 20: 20, 15: 15 }

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v)
const capFor = (n) => Math.max(MIN_CAP, Math.ceil(n / 512) * 512)

let sharedTex = null
function makeTexture (kind) {
  if (kind === 'square' || typeof document === 'undefined') return null
  if (sharedTex?.[kind]) return sharedTex[kind]
  let tex = null
  try {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64
    const c = cv.getContext?.('2d')
    if (c) {
      if (kind === 'disc') {
        c.clearRect(0, 0, 64, 64); c.fillStyle = '#fff'; c.beginPath(); c.arc(32, 32, 29, 0, TAU); c.fill()
      } else {
        const g = c.createRadialGradient(32, 32, 0, 32, 32, 32)
        g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.2, 'rgba(255,255,255,0.85)'); g.addColorStop(0.5, 'rgba(255,255,255,0.25)'); g.addColorStop(0.8, 'rgba(255,255,255,0.05)'); g.addColorStop(1, 'rgba(255,255,255,0)')
        c.fillStyle = g; c.fillRect(0, 0, 64, 64)
      }
      tex = new THREE.CanvasTexture(cv)
    }
  } catch (_) { tex = null }
  if (tex) { sharedTex = sharedTex || {}; sharedTex[kind] = tex }
  return tex
}
function disposeTextures () { if (sharedTex) for (const k of Object.keys(sharedTex)) sharedTex[k]?.dispose?.(); sharedTex = null }

function sigOf (o) {
  let s = ''
  for (let i = 0; i < PARTICLE_KEYS.length; i++) { const v = o?.[PARTICLE_KEYS[i]]; s += (typeof v === 'object' ? '' : v) + '|' }
  return s
}

export default class OmniSoundParticles {
  constructor (context, omniNode = null) {
    this.ctx = context
    this.omniNode = omniNode
    this._inited = 0
    this._bound = []
    this._clouds = new Map()
    this._list = []   // the same clouds as an array: iterated every frame without creating an iterator
    this._time = 0
    this._scanAcc = SCAN_INTERVAL
    this._dirty = true
    this._globalCap = PARTICLE_LIMITS.globalCap
    this._totals = { clouds: 0, wanted: 0, granted: 0, drawn: 0, cap: PARTICLE_LIMITS.globalCap }
    this._tmpV = new THREE.Vector3()
    this._tmpS = new THREE.Sphere()
    this._proj = new THREE.Matrix4()
    this._frustum = new THREE.Frustum()
    this._rgb = new Float32Array(3)
    this._rgb2 = new Float32Array(3)
    this._bandRgb = new Float32Array(21)
    this._bandsBuf = { sub: 0, bass: 0, lowMid: 0, mid: 0, highMid: 0, presence: 0, brilliance: 0, level: 0 }
    this._engineFailed = 0
    this._settingsMod = null
  }

  init () {
    this._inited++
    if (this._inited > 1) return   // BaseScene.addModule() calls init(); a second call must not double the listeners
    const on = (name, fn) => { const h = (e) => fn(e.detail ?? {}, e); window.addEventListener(name, h); this._bound.push([name, h]) }
    on('omni:node-deleted', (d) => this._removeCloud(d.id))
    for (const n of ['omni:node-updated', 'omni:nodes-updated', 'omni:node-created', 'omni:sound-particles-changed', 'omni:sound-state']) on(n, () => { this._dirty = true })
    on('omni:scene-clear-request', () => { this._removeAll(); this._dirty = true })
    on('omni:sound-settings-set', () => this._readSettings())
    try {
      import('../utils/OmniSoundSettings.js').then((m) => { this._settingsMod = m; this._readSettings() }).catch(() => {})   // Admin > Sound (agent 2); optional
    } catch (_) { /* no dynamic import */ }
    PARTICLE_SERVICES.system = this
  }

  _readSettings () {
    let cap = PARTICLE_LIMITS.globalCap
    try {
      const st = this._settingsMod?.getSoundSettings?.() ?? this._settingsMod?.default?.getSoundSettings?.()
      if (st && typeof st === 'object') for (const k of CAP_KEYS) { const v = Number(st[k]); if (Number.isFinite(v) && v >= 0) { cap = Math.min(cap, Math.floor(v)); break } }
    } catch (_) { /* settings module not ready */ }
    this._globalCap = Math.max(0, cap)
    this._scanAcc = SCAN_INTERVAL
  }

  onResize () {}

  destroy () {
    if (!this._inited) return
    this._bound.forEach(([n, h]) => window.removeEventListener(n, h))
    this._bound = []
    this._removeAll()
    disposeTextures()
    if (PARTICLE_SERVICES.system === this) PARTICLE_SERVICES.system = null
    this._inited = 0
  }

  // ── public ────────────────────────────────────────────────────────────────

  /** { wanted (count after the per-node cap), afterLod (after the distance thinning), granted (after the shared cap), drawn, distance, visible, reason, quiet } for a node's cloud, or null when it has none. */
  getStats (nodeId) {
    const c = this._clouds.get(nodeId)
    return c ? { wanted: c.nBase, afterLod: c.want, granted: c.granted, drawn: c.drawn, distance: c.dist, visible: c.points.visible, reason: c.reason, quiet: c.rest } : null
  }
  getTotals () { return this._totals }
  get cloudCount () { return this._clouds.size }
  get globalCap () { return this._globalCap }
  hasCloud (id) { return this._clouds.has(id) }
  getPoints (id) { return this._clouds.get(id)?.points ?? null }

  // ── the scan (4 times a second): which nodes have a cloud, budget, LOD ─────────────────

  _scan () {
    this._dirty = false
    let nodes = []
    try { nodes = this.omniNode?.getAllNodes?.() ?? [] } catch (_) { nodes = [] }
    const seen = new Set()
    for (const d of nodes) {
      if (!d || !d.id || !d.sound || d.sound.enabled !== true || !d.soundParticles || typeof d.soundParticles !== 'object') continue
      if (d.soundParticles.enabled === false) continue
      const p = this._params(d)
      if (!p.enabled || p.count <= 0 || Math.min(p.count, p.nodeCap) <= 0) continue
      seen.add(d.id)
      let c = this._clouds.get(d.id)
      if (!c) { c = this._makeCloud(d.id); if (!c) continue; this._clouds.set(d.id, c); this._list.push(c) }
      c.data = d
      this._sync(c, d)
    }
    for (const id of [...this._clouds.keys()]) if (!seen.has(id)) this._removeCloud(id)
    this._budget()
  }

  _params (d) {
    const raw = d.soundParticles
    return sanitizeParticles(raw)
  }

  /** Distances, LOD and the shared cap: the nearest clouds are served first. */
  _budget () {
    const cam = this.ctx?.camera
    const reqs = []
    let wanted = 0
    for (const c of this._clouds.values()) {
      const mesh = this.omniNode?.getMeshById?.(c.id)
      c.mesh = mesh ?? c.mesh ?? null
      if (c.mesh) c.mesh.getWorldPosition(this._tmpV); else this._tmpV.set(c.points.position.x, c.points.position.y, c.points.position.z)
      c.dist = cam ? this._tmpV.distanceTo(cam.position) : 0
      const want = lodCount(c.p, c.dist)
      c.want = want; wanted += want
      reqs.push({ id: c.id, want, distance: c.dist })
    }
    const grant = allocateParticleBudget(reqs, this._globalCap)
    let granted = 0
    for (const c of this._clouds.values()) { c.granted = Math.min(c.nBase, grant.get(c.id) ?? 0); granted += c.granted }
    this._totals.clouds = this._clouds.size; this._totals.wanted = wanted; this._totals.granted = granted; this._totals.cap = this._globalCap
  }

  // ── building / syncing one cloud ─────────────────────────────────────────

  _makeCloud (id) {
    const geo = new THREE.BufferGeometry()
    const mat = new THREE.PointsMaterial({ size: 0.08, sizeAttenuation: true, transparent: true, depthWrite: false, vertexColors: true })
    const points = new THREE.Points(geo, mat)
    points.name = 'omni-sound-particles-' + id
    points.frustumCulled = false   // positions move every frame; the system does its own frustum test
    points.userData.omniSoundParticles = true
    points.visible = false
    const c = {
      id, points, geo, mat, ghost: null, ghostGeo: null, ghostMat: null, ghostPos: null,
      data: null, p: null, src: null, sig: '', layoutKey: '', styleKey: '', cap: 0, nBase: 0, granted: 0, drawn: 0, want: 0, dist: 0,
      pos: null, col: null, L: null, bars: createBarState(), posAttr: null, colAttr: null,
      motion: createMotionState(), restGranted: -1, swirl: 0, spin: [0, 0, 0], hue: 0, hueInit: false, rest: false, acc: 0, mesh: null, reason: 'new',
      rateHz: 0, tmpBands: null, levelDraw: 0, playing: false,
    }
    this.ctx.scene.add(points)
    return c
  }

  _sync (c, d) {
    const raw = d.soundParticles
    const now = sigOf(raw)
    if (c.p && c.sig === now) return
    c.src = raw; c.sig = now
    const p = this._params(d)
    c.p = p
    c.rateHz = RATE_HZ[p.updateRate] || 0
    c.nBase = Math.min(p.count, p.nodeCap)
    const lk = LAYOUT_KEYS.map(k => p[k]).join('|')
    if (lk !== c.layoutKey) { c.layoutKey = lk; this._layout(c) }
    const sk = STYLE_KEYS.map(k => p[k]).join('|')
    if (sk !== c.styleKey) { c.styleKey = sk; this._style(c) }
    c.rest = false
  }

  /** (Re)computes the resting cloud in importance order; grows the buffers only when the count needs it. */
  _layout (c) {
    const p = c.p, n = c.nBase
    const need = capFor(n)
    if (!c.pos || need > c.cap || (c.cap > 2048 && need * 4 < c.cap)) this._alloc(c, need)
    c.L = layoutFormation(p, n)
    c.pos.set(c.L.pos)
    if (p.trail > 0) { this._ensureGhost(c); c.ghostPos.set(c.pos) }
    c.styleKey = ''   // gradient colours depend on the order
    c.posAttr.needsUpdate = true
    c.drawn = 0; c.rest = false
  }

  _alloc (c, cap) {
    const oldGeo = c.geo
    c.cap = cap
    c.pos = new Float32Array(cap * 3); c.col = new Float32Array(cap * 3)
    c.col.fill(1)
    const geo = new THREE.BufferGeometry()
    c.posAttr = new THREE.BufferAttribute(c.pos, 3); c.posAttr.setUsage(THREE.DynamicDrawUsage)
    c.colAttr = new THREE.BufferAttribute(c.col, 3); c.colAttr.setUsage(THREE.DynamicDrawUsage)
    geo.setAttribute('position', c.posAttr); geo.setAttribute('color', c.colAttr)
    geo.setDrawRange(0, 0)
    c.points.geometry = geo; c.geo = geo
    oldGeo.dispose()
    if (c.ghost) this._removeGhost(c)
  }

  _ensureGhost (c) {
    if (c.ghost) return
    c.ghostPos = new Float32Array(c.cap * 3)
    c.ghostPos.set(c.pos)
    const g = new THREE.BufferGeometry()
    const attr = new THREE.BufferAttribute(c.ghostPos, 3); attr.setUsage(THREE.DynamicDrawUsage)
    g.setAttribute('position', attr); g.setAttribute('color', c.colAttr)   // the colour attribute is shared
    g.setDrawRange(0, 0)
    const m = new THREE.PointsMaterial({ size: 0.1, sizeAttenuation: true, transparent: true, depthWrite: false, vertexColors: true })
    const pts = new THREE.Points(g, m)
    pts.frustumCulled = false; pts.renderOrder = -1
    c.points.add(pts)
    c.ghost = pts; c.ghostGeo = g; c.ghostMat = m; c.ghostAttr = attr
    this._applyMaterial(c, m, 0.5)
  }
  _removeGhost (c) {
    if (!c.ghost) return
    c.points.remove(c.ghost)
    c.ghostGeo.dispose(); c.ghostMat.dispose()
    c.ghost = c.ghostGeo = c.ghostMat = c.ghostPos = c.ghostAttr = null
  }

  _applyMaterial (c, mat, k = 1) {
    const p = c.p
    const tex = makeTexture(p.shape)
    mat.map = tex; mat.alphaMap = null
    mat.alphaTest = p.shape === 'square' ? 0 : 0.01
    mat.opacity = p.opacity * k
    mat.blending = p.blend === 'additive' ? THREE.AdditiveBlending : THREE.NormalBlending
    mat.depthTest = p.depthTest
    mat.needsUpdate = true
  }

  /** Material, static colours (gradient / solid) and the ghost layer after a style change. */
  _style (c) {
    const p = c.p
    this._applyMaterial(c, c.mat, 1)
    if (p.trail > 0) { this._ensureGhost(c); this._applyMaterial(c, c.ghostMat, 0.5 * p.trail + 0.1) } else this._removeGhost(c)
    // vertex colours that do not change per frame
    const n = c.nBase, col = c.col
    hexToRgb01(p.color, this._rgb); hexToRgb01(p.color2, this._rgb2)
    if (p.colorMode === 'gradient') {
      for (let s = 0; s < n; s++) { const t = c.L.t[s], o = s * 3; col[o] = this._rgb[0] + (this._rgb2[0] - this._rgb[0]) * t; col[o + 1] = this._rgb[1] + (this._rgb2[1] - this._rgb[1]) * t; col[o + 2] = this._rgb[2] + (this._rgb2[2] - this._rgb[2]) * t }
    } else if (p.colorMode !== 'band') {
      col.fill(1, 0, n * 3)
    }
    c.colAttr.needsUpdate = true
    c.rest = false
  }

  // ── removal ───────────────────────────────────────────────────────────────

  _removeCloud (id) {
    const c = this._clouds.get(id)
    if (!c) return
    this._clouds.delete(id)
    const li = this._list.indexOf(c); if (li >= 0) this._list.splice(li, 1)
    this.ctx.scene.remove(c.points)
    this._removeGhost(c)
    c.geo.dispose(); c.mat.dispose()
  }
  _removeAll () { for (const id of [...this._clouds.keys()]) this._removeCloud(id) }

  // ── the frame ─────────────────────────────────────────────────────────────

  update (delta) {
    const dtIn = delta > 0 && delta < 1 ? delta : (delta >= 1 ? 1 : 0)
    this._scanAcc += dtIn
    if (this._dirty || this._scanAcc >= SCAN_INTERVAL) { this._scanAcc = 0; this._scan() }
    if (this._clouds.size === 0) return
    this._time += dtIn
    const cam = this.ctx?.camera
    if (cam) { this._proj.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse); this._frustum.setFromProjectionMatrix(this._proj) }
    let drawn = 0
    for (let i = 0; i < this._list.length; i++) drawn += this._frame(this._list[i], dtIn, cam)
    this._totals.drawn = drawn
  }

  _analysis (c) {
    // The engine may be missing, partial, fake or throw: any of that means silence.
    let a = null
    try {
      const E = SoundEngine
      if (E && typeof E.getAnalysis === 'function') a = E.getAnalysis(c.id) ?? null
    } catch (_) { a = null; this._engineFailed++ }
    return a && typeof a === 'object' ? a : null
  }
  _isPlaying (c) {
    try { const E = SoundEngine; return !!(E && typeof E.isPlaying === 'function' && E.isPlaying(c.id)) } catch (_) { return false }
  }

  /** One cloud for one frame. Returns the number of particles drawn. */
  _frame (c, dt, cam) {
    const p = c.p
    if (!p || !c.pos) return 0
    // follow the node
    if (c.mesh) c.mesh.getWorldPosition(this._tmpV); else this._tmpV.copy(c.points.position)
    c.points.position.set(this._tmpV.x, this._tmpV.y + p.offsetY, this._tmpV.z)
    c.dist = cam ? this._tmpV.distanceTo(cam.position) : 0
    // far / off screen: hidden and paused
    if (p.cullDistance > 0 && c.dist > p.cullDistance) { c.points.visible = false; c.reason = 'far'; return 0 }
    if (c.mesh && c.mesh.visible === false) { c.points.visible = false; c.reason = 'hidden'; return 0 }
    if (c.granted <= 0) { c.points.visible = false; c.reason = 'cap'; return 0 }
    if (p.pauseOffscreen && cam) {
      const rad = (p.radius + p.height + Math.abs(p.offsetY)) * (1 + p.radiusAmount * 2) + p.heightAmount + p.jitterAmount + p.noiseAmount + 0.5
      this._tmpS.center.copy(c.points.position); this._tmpS.radius = rad
      if (!this._frustum.intersectsSphere(this._tmpS)) { c.points.visible = false; c.reason = 'offscreen'; return 0 }
    }
    // silent and settled: no analysis call, no buffer work
    const playing = this._isPlaying(c)
    c.playing = playing
    const quietAllowed = p.pauseWhenSilent && p.idleMotion === 0
    if (!playing && c.rest && c.restGranted === c.granted && quietAllowed && p.respondOnlyWhilePlaying) { c.points.visible = true; c.reason = 'silent'; return c.drawn }
    // rate limit
    c.acc += dt
    if (c.rateHz > 0 && c.acc < 1 / c.rateHz && c.drawn > 0) { c.points.visible = true; return c.drawn }
    const h = c.acc; c.acc = 0
    // analysis -> motion
    const a = (playing || !p.respondOnlyWhilePlaying || !c.rest) ? this._analysis(c) : null
    const live = a && (a.playing !== false || !p.respondOnlyWhilePlaying)
    const bb = this._bandsBuf
    if (live && a.bands && typeof a.bands === 'object') {
      for (let b = 0; b < 7; b++) bb[BAND_IDS[b]] = a.bands[BAND_IDS[b]]
      bb.level = a.level
    } else {
      for (let b = 0; b < 7; b++) bb[BAND_IDS[b]] = 0
      bb.level = 0
    }
    const m = bandsToMotion(bb, p, c.motion, h)
    const active = m.energy > 0.0015 || m.level > 0.0015
    const idle = active ? 1 : p.idleMotion
    if (!active && quietAllowed && c.rest && c.restGranted === c.granted) { c.points.visible = true; c.reason = 'silent'; return c.drawn }
    c.reason = active ? 'playing' : 'idle'
    c.points.visible = true

    // how many are drawn
    let k = c.granted
    if (p.countByLevel > 0) k = Math.ceil(k * (1 - p.countByLevel + p.countByLevel * clamp(m.level * 1.25, 0, 1)))
    k = clamp(k, 0, c.nBase)
    c.drawn = k
    c.geo.setDrawRange(0, k)
    if (c.ghostGeo) c.ghostGeo.setDrawRange(0, k)

    // material: size / brightness / colour
    const lvl = clamp(m.level, 0, 1)
    c.levelDraw = lvl
    c.mat.size = clamp(p.size * (1 + p.sizeByLevel * lvl + p.sizeAmount * m.size), 0.005, p.size * 14)
    if (c.ghostMat) c.ghostMat.size = c.mat.size * 1.35
    const g = clamp(p.brightness * (0.55 + 0.45 * lvl + 0.35 * p.brightnessAmount * m.brightness), 0, 4)
    this._colour(c, a, live, m, g, k)

    // rotation (free: the object turns, no buffer write)
    const rs = ((p.rotationSpeed * Math.PI) / 180) * idle * h
    if (rs !== 0) {
      if (p.rotationAxis === 'tumble') { c.points.rotation.x += rs * 0.7; c.points.rotation.y += rs; c.points.rotation.z += rs * 0.45 }
      else c.points.rotation[p.rotationAxis] += rs
    }

    // positions
    const rest = !active && p.idleMotion === 0
    this._positions(c, p, m, k, h, idle, a, live)
    c.rest = rest; c.restGranted = c.granted
    return k
  }

  _colour (c, a, live, m, g, k) {
    const p = c.p
    const mode = p.colorMode
    if (mode === 'band') {
      hexToRgb01(p.color, this._rgb)
      const h0 = rgbToHue(this._rgb[0], this._rgb[1], this._rgb[2]) + m.hue * 0.08
      const br = this._bandRgb, env = c.motion.env
      for (let b = 0; b < 7; b++) bandColor(b, h0, p, br, b * 3, g * (0.35 + 0.9 * clamp(env[b], 0, 1)))
      const col = c.col, band = c.L.band
      for (let s = 0; s < k; s++) { const o = s * 3, o2 = band[s] * 3; col[o] = br[o2]; col[o + 1] = br[o2 + 1]; col[o + 2] = br[o2 + 2] }
      c.colAttr.needsUpdate = true
      c.mat.color.setRGB(1, 1, 1)
      if (c.ghostMat) c.ghostMat.color.setRGB(1, 1, 1)
    } else if (mode === 'pitch') {
      hexToRgb01(p.color, this._rgb)
      const hz = live && a ? Number(a.peakHz) : 0
      if (hz > 20 && m.level > 0.02) {
        const target = pitchHue(hz)
        if (!c.hueInit) { c.hue = target; c.hueInit = true }
        let d = target - c.hue; d -= Math.round(d)
        c.hue = (c.hue + d * 0.25 + 1) % 1
      }
      hslToRgb(rgbToHue(this._rgb[0], this._rgb[1], this._rgb[2]) + c.hue + m.hue * 0.08, p.saturation, 0.55, this._rgb2, 0)
      c.mat.color.setRGB(this._rgb2[0] * g, this._rgb2[1] * g, this._rgb2[2] * g)
      if (c.ghostMat) c.ghostMat.color.copy(c.mat.color)
    } else if (mode === 'gradient') {
      c.mat.color.setScalar(g)
      if (c.ghostMat) c.ghostMat.color.setScalar(g)
    } else {
      hexToRgb01(p.color, this._rgb)
      c.mat.color.setRGB(this._rgb[0] * g, this._rgb[1] * g, this._rgb[2] * g)
      if (c.ghostMat) c.ghostMat.color.copy(c.mat.color)
    }
  }

  _positions (c, p, m, k, h, idle, a, live) {
    const bars = p.formation === 'bars'
    if (bars) updateBarColumns(c.bars, live ? a : null, c.motion.env, p, h)
    c.swirl += p.swirlAmount * m.swirl * h
    displaceParticles(c.pos, c.L, p, m, k, this._time, c.swirl, p.noiseAmount * idle, bars ? c.bars : null)
    c.posAttr.needsUpdate = true
    if (c.ghostPos) {
      const gp = c.ghostPos, pos = c.pos
      const f = 1 - Math.pow(clamp(p.trail, 0, 0.95), h * 60)
      for (let i = 0, e = k * 3; i < e; i++) gp[i] += (pos[i] - gp[i]) * f
      c.ghostAttr.needsUpdate = true
    }
  }
}

function ghostWanted (p) { return p.trail > 0 }
