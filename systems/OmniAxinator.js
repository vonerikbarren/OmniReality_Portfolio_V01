/**
 * systems/OmniAxinator.js — the reusable OmniAxinator component (V160)
 *
 * "A multi-dimensional clock, not an actual clock": a registry of world-fixed
 * TUNNELS (grid cylinders strung with massive translucent container nodes),
 * each pointing along its own direction — a clock hour top-down (12 = -Z,
 * 3 = +X) or a world axis. Tunnels are either one-sided (start at the origin)
 * or two-sided (pass through the origin). A tunnel may also carry a relative
 * (Υ) column + marker and become "steppable" (that is what the two top-hand
 * pads drive, see systems/OmniDimensionalAxes.js, which is now the thin
 * hand-driven adapter around one of these).
 *
 * Reusable: any system can do
 *     new OmniAxinator(ctx, { name, storeKey, tunnels: [def, ...] })
 * and the same machinery serves a different channel. Tunnel def shape is
 * documented in data/OmniAxinatorData.js. All geometry sizes are the V159 sizes
 * (the user approved them): GEO_SCALE 5, NODE_SPACING 800, NODE_RADIUS 320,
 * TUNNEL_RADIUS 220.
 *
 * Style (V160): tunnel body/grid are grey (single constant TUNNEL_COLOR) with
 * opacities that read on a white AND a black background. Node shells are
 * silver/white with a dark second outline. The tunnel's accent colour is used
 * only for the marker, relative column, ticks and label borders. Labels are
 * canvas sprites whose WORLD size is recomputed every frame from the distance
 * to the camera so they stay roughly LABEL_SCREEN_FRAC_* of the viewport width
 * (clamped), drawn with depthTest:false so they are never hidden by a node.
 *
 * Visibility rule (per tunnel):
 *     shown = manual[id]  OR  (followPads AND padOpen[def.padHand])
 * `manual` is the panel checkbox (a pin); `padOpen` follows the movement pads
 * (omni:pad-toggle / omni:pads-global / the authoritative omni:pad-state that
 * ui/MovementPad.js dispatches). Tunnels are built LAZILY the first time they
 * are shown. Show/hide animates the tunnel itself: the body/grid grows outward
 * from the origin along its direction while fading in, then the nodes pop in
 * staggered; hide reverses faster. Rapid toggling is safe: tweens are killed
 * and re-started from the current values, and the final state is forced.
 *
 * Node picking: each node owns an invisible pick sphere (radius NODE_RADIUS,
 * material.visible=false). All visible meshes are inert (raycast no-op, as in
 * V159); ONLY the pick spheres raycast, and only this module raycasts against
 * them (an explicit list, pointermove throttled + click on the renderer
 * canvas). Hover shows a tooltip; click opens the node menu: node title line,
 * ABOVE the "Root" tooltip line, then TakeMeThere / Root.
 *
 * Events dispatched (window):
 *   omni:axinator-tunnel-visible   { id, visible, manual, auto, name }
 *        visible = effective, manual = pinned by checkbox, auto = shown only
 *        because its hand's pad is open. Fires when any of them changes.
 *   omni:axinator-list             { name, followPads, tunnels:[{id,title,symbol,
 *                                    color,visible,manual,auto,group,padHand}] }
 *   omni:axinator-follow-pads      { follow }
 *   omni:axinator-node-menu-action { tunnel, nodeId, action:'take-me-there'|'root' }
 *   omni:dimension-state           (steppable tunnels; options.stateEvent)
 *   omni:orbit-disable / omni:orbit-target-set / omni:orbit-enable
 *        (TakeMeThere — same bracket OmniPointing uses) and
 *   omni:orbit-max-distance-set    { distance }  (nodes are 800+ units away and
 *        OrbitControls.maxDistance is 80; main.js applies this)
 *
 * Events consumed (window):
 *   omni:axinator-tunnel-visible-set { id, visible }   -> manual pin
 *   omni:axinator-list-request                         -> omni:axinator-list
 *   omni:pad-toggle {hand, visible} / omni:pads-global {visible} /
 *   omni:pad-state {hand, visible}
 *
 * Public API: listTunnels() getTunnel(id) setTunnelVisible(id,b)
 *   isTunnelVisible(id) isManual(id) setAllVisible(b) setFollowPads(b)
 *   isFollowPads() animateIn(id) animateOut(id) step(id,dir) goTo(id,p,r)
 *   getState(id) travelToNode(tunnelId,nodeId) emitState(id,phase)
 *   init() update(delta) destroy()
 *
 * Module contract: {init, update(delta), destroy, onResize}.
 */

import * as THREE from 'three'
import gsap from 'gsap'

// ── Geometry / motion constants (V159 sizes, unchanged) ─────────────────────

export const GEO_SCALE         = 5
export const NODE_SPACING      = 160 * GEO_SCALE
export const NODE_RADIUS       = 64 * GEO_SCALE
export const TUNNEL_RADIUS     = 44 * GEO_SCALE
const TUNNEL_END_PAD    = 24 * GEO_SCALE
const GRID_RING_STEP    = 40 * GEO_SCALE
const GRID_LONGITUDES   = 24
const RING_SEGMENTS     = 48
const AXIS_Y            = 0

const REL_STEP          = 14 * GEO_SCALE
const REL_COLUMN_RADIUS = 14 * GEO_SCALE
const REL_COLUMN_PAD    = 8 * GEO_SCALE

export const TRAVEL_DURATION = 0.55
export const REL_DURATION    = 0.45
export const HOLD_REPEAT_MS  = 450

// ── V160 style constants (all tunable in one place) ─────────────────────────

export const TUNNEL_COLOR        = 0x9a9a9a   // grey tunnel (user may tune this one value)
const TUNNEL_BODY_OPACITY = 0.10               // V159 white was 0.05 / 0.38; grey needs more to read on white
const TUNNEL_GRID_OPACITY = 0.62

const NODE_FILL_COLOR     = 0xbfbfbf           // silver fill
const NODE_EDGE_COLOR     = 0xc8c8c8           // silver edges
const NODE_EDGE_DARK      = 0x111111           // dark second outline: reads on white
const NODE_FILL_OPACITY   = 0.08
const NODE_EDGE_OPACITY   = 0.65
const NODE_DARK_OPACITY   = 0.5

// Labels: apparent width as a fraction of the viewport width (distance
// compensated), clamped in world units. FIXED_* is the fallback with no
// perspective camera.
const LABEL_SCREEN_FRAC_NODE  = 0.08
const LABEL_SCREEN_FRAC_LEVEL = 0.055
const LABEL_MIN_WORLD         = 8
const LABEL_MAX_WORLD         = 900
const LABEL_FIXED_NODE        = 300
const LABEL_FIXED_LEVEL       = 160

// Show / hide animation
const SHOW_GROW_S  = 0.9
const HIDE_GROW_S  = 0.4
const NODE_POP_S   = 0.45
const NODE_STAGGER = 0.08

const DEFAULT_STORE_KEY = 'omni:axinator-v1'
const STORE_VERSION = 1

const AXIS_DIRS = {
  x: new THREE.Vector3(1, 0, 0),
  y: new THREE.Vector3(0, 1, 0),
  z: new THREE.Vector3(0, 0, 1),
}

const STYLES = /* css */`
.oax-tooltip {
  position: fixed; pointer-events: none; transform: translate(14px, -50%);
  background: var(--ttm-bg, rgba(8,8,12,0.88)); color: var(--ttm-color, #fff);
  font: 10px 'Courier New', monospace; padding: 4px 8px; border-radius: 5px;
  border: 1px solid var(--ttm-border, rgba(255,255,255,0.15)); white-space: pre; z-index: 50;
}
.oax-tooltip b { font-weight: bold; }
.oax-menu {
  position: fixed; pointer-events: auto;
  background: var(--ttm-bg, rgba(8,8,12,0.94)); color: var(--ttm-color, #fff);
  border: 1px solid var(--ttm-border, rgba(255,255,255,0.18));
  border-radius: 6px; padding: 4px; display: flex; flex-direction: column; gap: 2px;
  z-index: 51; font: 10px 'Courier New', monospace; max-width: 280px;
}
.oax-menu-title {
  font-size: 11px; font-weight: bold; padding: 4px 10px 2px; white-space: nowrap;
}
.oax-menu-root {
  font-size: 9px; opacity: 0.7; padding: 0 10px 5px; line-height: 1.45; white-space: normal;
  border-bottom: 1px solid rgba(255,255,255,0.08); margin-bottom: 2px;
}
.oax-action-btn {
  background: transparent; border: none; color: inherit; font: 10px 'Courier New', monospace;
  padding: 5px 10px; text-align: left; cursor: pointer; border-radius: 4px; white-space: nowrap;
}
.oax-action-btn:hover { background: rgba(255,255,255,0.12); }
`

function injectStyles () {
  if (typeof document === 'undefined' || document.getElementById('oax-styles')) return
  const tag = document.createElement('style')
  tag.id = 'oax-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

function esc (s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const hex = (n) => '#' + n.toString(16).padStart(6, '0')

/** Top-down clock hour -> world unit vector. 12 = -Z, 3 = +X. */
export function clockToDir (hour) {
  const a = (hour / 12) * Math.PI * 2
  return new THREE.Vector3(Math.sin(a), 0, -Math.cos(a))
}

/** def.direction -> unit THREE.Vector3. Accepts a Vector3, a clock hour
 *  number, {clock}, or {axis:'x'|'y'|'z'}. */
export function resolveDirection (d) {
  if (d && d.isVector3) return d.clone().normalize()
  if (typeof d === 'number') return clockToDir(d)
  if (d && typeof d.clock === 'number') return clockToDir(d.clock)
  if (d && AXIS_DIRS[d.axis]) return AXIS_DIRS[d.axis].clone()
  return new THREE.Vector3(0, 0, -1)
}

/** Visible meshes are huge and translucent: never raycast them. Only the pick
 *  spheres (added AFTER this runs) raycast. */
function makeInert (obj) {
  obj.traverse(o => {
    o.raycast = () => {}
    o.userData.omniDimensionAxes = true
  })
}

/** Canvas label sprite. High contrast on white AND black: near-opaque dark
 *  plate, bold white text, thick accent border plus a thin white outer line. */
export function makeLabelSprite (text, colorHex, widthWorld, opts = {}) {
  const W = 512, H = 128
  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  const c = canvas.getContext('2d')
  const rr = (inset, r) => {
    c.beginPath()
    c.moveTo(inset + r, inset); c.lineTo(W - inset - r, inset)
    c.quadraticCurveTo(W - inset, inset, W - inset, inset + r)
    c.lineTo(W - inset, H - inset - r)
    c.quadraticCurveTo(W - inset, H - inset, W - inset - r, H - inset)
    c.lineTo(inset + r, H - inset); c.quadraticCurveTo(inset, H - inset, inset, H - inset - r)
    c.lineTo(inset, inset + r); c.quadraticCurveTo(inset, inset, inset + r, inset); c.closePath()
  }
  rr(8, 26)
  c.fillStyle = 'rgba(6, 6, 10, 0.94)'
  c.fill()
  c.lineWidth = 9
  c.strokeStyle = colorHex
  c.stroke()
  rr(2, 30)
  c.lineWidth = 2
  c.strokeStyle = 'rgba(255, 255, 255, 0.85)'
  c.stroke()
  c.fillStyle = '#ffffff'
  c.textAlign = 'center'
  c.textBaseline = 'middle'
  if (opts.sub) {
    c.font = 'bold 22px "Courier New", Courier, monospace'
    c.fillText(opts.sub, W / 2, 30, W - 60)
    c.font = 'bold 56px "Courier New", Courier, monospace'
    c.fillText(text, W / 2, H / 2 + 16, W - 56)
  } else {
    c.font = 'bold 64px "Courier New", Courier, monospace'
    c.fillText(text, W / 2, H / 2 + 4, W - 56)
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  const mat = new THREE.SpriteMaterial({
    map: tex, transparent: true, depthWrite: false, depthTest: false,   // never hidden inside a translucent node
  })
  const sprite = new THREE.Sprite(mat)
  sprite.scale.set(widthWorld, widthWorld * (H / W), 1)
  sprite.userData.aspect = H / W
  sprite.renderOrder = 10
  return sprite
}

export default class OmniAxinator {
  /**
   * @param {object} ctx   { scene, camera, renderer }
   * @param {object} opts  { name, storeKey, tunnels:[def], followPads, padSource,
   *                         pick, stateEvent, states:{id:{p,r}}, onState(detail),
   *                         onStateChange(id, state) }
   */
  constructor (ctx, opts = {}) {
    this.ctx = ctx
    this.opts = {
      name: 'main', storeKey: DEFAULT_STORE_KEY, tunnels: [], followPads: undefined,
      padSource: true, pick: true, stateEvent: 'omni:dimension-state', states: {},
      onState: null, onStateChange: null, ...opts,
    }
    this._root = null
    this._tunnels = new Map()          // id -> runtime tunnel record
    this._order = []
    this._followPads = true
    this._padOpen = {}
    this._time = 0
    this._tmpV = new THREE.Vector3()
    this._tmpP = new THREE.Vector3()

    // picking / menu
    this._raycaster = new THREE.Raycaster()
    this._ndc = new THREE.Vector2()
    this._tooltipEl = null
    this._menuEl = null
    this._hover = null
    this._lastMove = 0
    this._down = null

    this._onVisibleSet = (e) => {
      const d = e.detail ?? {}
      if (typeof d.id === 'string') this.setTunnelVisible(d.id, !!d.visible)
    }
    this._onListRequest = () => this._dispatchList()
    this._onPadToggle = (e) => {
      const { hand, visible } = e.detail ?? {}
      if (hand) this._setPadOpen(hand, !!visible)
    }
    this._onPadsGlobal = (e) => {
      const visible = !!(e.detail?.visible)
      ;['omnihand', 'conscious', 'lh', 'rh'].forEach(h => this._setPadOpen(h, visible, true))
      this._recompute()
    }
    this._onPadState = (e) => {
      const { hand, visible } = e.detail ?? {}
      if (hand) this._setPadOpen(hand, !!visible)
    }
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  init () {
    if (this._root) return
    injectStyles()
    const saved = this._load()
    this._followPads = typeof this.opts.followPads === 'boolean'
      ? this.opts.followPads
      : saved.followPads !== false

    this._root = new THREE.Group()
    this._root.name = `OmniAxinator:${this.opts.name}`
    this.ctx.scene.add(this._root)

    this.opts.tunnels.forEach(def => this._register(def, saved))

    window.addEventListener('omni:axinator-tunnel-visible-set', this._onVisibleSet)
    window.addEventListener('omni:axinator-list-request', this._onListRequest)
    if (this.opts.padSource) {
      window.addEventListener('omni:pad-toggle', this._onPadToggle)
      window.addEventListener('omni:pads-global', this._onPadsGlobal)
      window.addEventListener('omni:pad-state', this._onPadState)
    }
    if (this.opts.pick) this._bindPicking()

    this._recompute(true)
  }

  update (delta) {
    if (!this._root) return
    this._time += delta
    const cam = this.ctx.camera
    if (cam) cam.updateMatrixWorld?.()
    const lf = this._labelFactors(cam)
    this._tunnels.forEach(t => {
      if (!t.built || !(t.on || t.grow > 0 || t.group.visible)) return
      this._syncTunnel(t, delta)
      this._scaleLabels(t, cam, lf)
    })
  }

  onResize () {}

  destroy () {
    window.removeEventListener('omni:axinator-tunnel-visible-set', this._onVisibleSet)
    window.removeEventListener('omni:axinator-list-request', this._onListRequest)
    window.removeEventListener('omni:pad-toggle', this._onPadToggle)
    window.removeEventListener('omni:pads-global', this._onPadsGlobal)
    window.removeEventListener('omni:pad-state', this._onPadState)
    this._unbindPicking()
    this._closeMenu()
    this._tooltipEl?.remove(); this._tooltipEl = null
    this._travelTween?.kill()
    this._tunnels.forEach(t => {
      t.tl?.kill()
      t.tweens.p?.kill(); t.tweens.r?.kill()
      gsap.killTweensOf([t.anim, t, ...t.nodeRecs, ...t.ticks])
    })
    if (this._root) {
      this.ctx.scene.remove(this._root)
      this._root.traverse(o => {
        o.geometry?.dispose()
        const mats = Array.isArray(o.material) ? o.material : (o.material ? [o.material] : [])
        mats.forEach(m => { m.map?.dispose(); m.dispose() })
      })
    }
    this._root = null
    this._tunnels.clear()
    this._order = []
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  listTunnels () {
    return this._order.map(id => this._summary(this._tunnels.get(id)))
  }

  getTunnel (id) { return this._tunnels.get(id) ?? null }

  isTunnelVisible (id) { return !!this._tunnels.get(id)?.on }
  isManual (id) { return !!this._tunnels.get(id)?.manual }
  isFollowPads () { return this._followPads }

  /** The panel checkbox: pins a tunnel visible (or releases the pin). */
  setTunnelVisible (id, visible) {
    const t = this._tunnels.get(id)
    if (!t) return
    visible = !!visible
    if (t.manual === visible) return
    const before = t.on
    t.manual = visible
    this._persist()
    this._recompute()
    if (t.on === before) this._emitVisible(t)   // manual changed while the effective state did not
  }

  setAllVisible (visible) {
    visible = !!visible
    const before = new Map()
    this._tunnels.forEach(t => { before.set(t.id, t.on); t.manual = visible })
    this._persist()
    this._recompute()
    this._tunnels.forEach(t => { if (t.on === before.get(t.id)) this._emitVisible(t) })
  }

  setFollowPads (follow) {
    follow = !!follow
    if (follow === this._followPads) return
    this._followPads = follow
    this._persist()
    this._recompute()
    window.dispatchEvent(new CustomEvent('omni:axinator-follow-pads', { detail: { follow } }))
  }

  animateIn (id) {
    const t = this._tunnels.get(id)
    if (!t) return
    this._ensureBuilt(t)
    t.on = true
    this._animate(t, true)
  }

  animateOut (id) {
    const t = this._tunnels.get(id)
    if (!t || !t.built) return
    t.on = false
    this._animate(t, false)
  }

  /** Pad entry point for steppable tunnels. left/right = primary axis,
   *  up/down = relative axis. -> true if it moved. */
  step (id, direction) {
    const t = this._tunnels.get(id)
    if (!t || !t.steppable) return false
    let p = t.state.p
    let r = t.state.r
    if (direction === 'left')  p -= 1
    if (direction === 'right') p += 1
    if (direction === 'up')    r += t.def.relDir
    if (direction === 'down')  r -= t.def.relDir
    p = clamp(p, 0, t.def.nodes.length - 1)
    r = clamp(r, 0, t.def.levels.length - 1)
    if (p === t.state.p && r === t.state.r) {
      this._bump(t)   // at the end of the axis: pulse the marker, don't move
      return false
    }
    this._setState(t, p, r, true)
    return true
  }

  goTo (id, primaryIndex, relativeIndex) {
    const t = this._tunnels.get(id)
    if (!t || !t.steppable) return
    const p = clamp(Math.round(primaryIndex ?? t.state.p), 0, t.def.nodes.length - 1)
    const r = clamp(Math.round(relativeIndex ?? t.state.r), 0, t.def.levels.length - 1)
    this._setState(t, p, r, true)
  }

  getState (id) {
    const t = this._tunnels.get(id)
    return t && t.steppable ? this._detail(t, 'settle') : null
  }

  getDefaultState (id) {
    const t = this._tunnels.get(id)
    return t ? { ...t.defaults } : null
  }

  emitState (id, phase) {
    const t = this._tunnels.get(id)
    if (t && t.steppable) this._emitState(t, phase)
  }

  /** TakeMeThere: stand just outside the node's radius, orbit target on the node. */
  travelToNode (tunnelId, nodeId) {
    const t = this._tunnels.get(tunnelId)
    const camera = this.ctx.camera
    if (!t || !camera) return false
    const idx = t.def.nodes.findIndex(n => n.id === nodeId)
    if (idx < 0) return false
    const target = this._nodeCenter(t, idx, new THREE.Vector3())
    const standoff = NODE_RADIUS * 1.6
    const away = camera.position.clone().sub(target)
    if (away.lengthSq() < 1) away.set(0, 0.35, 1)
    away.y = Math.max(away.y, away.length() * 0.15)   // a little height so the camera is never level with the tunnel line
    away.normalize()
    const dest = target.clone().add(away.multiplyScalar(standoff))

    window.dispatchEvent(new CustomEvent('omni:orbit-disable', { detail: {} }))
    this._travelTween?.kill()
    this._travelTween = gsap.to(camera.position, {
      x: dest.x, y: dest.y, z: dest.z, duration: 1.4, ease: 'power2.inOut',
      onUpdate: () => camera.lookAt(target),
      onComplete: () => {
        this._travelTween = null
        // OrbitControls.maxDistance is 80; without raising it the very next
        // controls.update() would clamp the camera back to 80 units from the node.
        window.dispatchEvent(new CustomEvent('omni:orbit-max-distance-set', {
          detail: { distance: Math.max(80, standoff + 120) },
        }))
        window.dispatchEvent(new CustomEvent('omni:orbit-target-set', { detail: { x: target.x, y: target.y, z: target.z } }))
        window.dispatchEvent(new CustomEvent('omni:orbit-enable', { detail: {} }))
      },
    })
    return true
  }

  // ── Registry / visibility ───────────────────────────────────────────────────

  _register (def, saved) {
    const n = def.nodes.length
    const twoSided = !!def.twoSided
    const steppable = !!(def.levels && def.levels.length)
    const m = steppable ? def.levels.length : 0
    const st = this.opts.states?.[def.id]
    const defaults = { p: 0, r: 0 }
    const t = {
      id: def.id, def, twoSided, steppable,
      dir: resolveDirection(def.direction),
      manual: !!saved.manual?.[def.id],
      on: false, built: false,
      grow: 0, extras: 0, tl: null,
      group: null, tunnelGroup: null, bodyMat: null, gridMat: null,
      nodeRecs: [], ticks: [], labels: [], pickMeshes: [],
      defaults,
      state: {
        p: clamp(Number.isFinite(st?.p) ? Math.round(st.p) : defaults.p, 0, n - 1),
        r: steppable ? clamp(Number.isFinite(st?.r) ? Math.round(st.r) : defaults.r, 0, m - 1) : 0,
      },
      anim: { p: 0, r: 0 },
      tweens: { p: null, r: null },
      bump: 0,
    }
    t.anim.p = t.state.p; t.anim.r = t.state.r
    this._tunnels.set(def.id, t)
    this._order.push(def.id)
  }

  _wantOn (t) {
    const hand = t.def.padHand
    return !!(t.manual || (this._followPads && hand && this._padOpen[hand]))
  }

  _setPadOpen (hand, open, deferRecompute = false) {
    if (this._padOpen[hand] === open) return
    this._padOpen[hand] = open
    if (!deferRecompute) this._recompute()
  }

  /** Reconcile every tunnel's shown state with the rule. */
  _recompute (instant = false) {
    this._tunnels.forEach(t => {
      const want = this._wantOn(t)
      if (want === t.on && (t.built || !want)) return
      t.on = want
      if (want) this._ensureBuilt(t)
      if (instant) this._setShown(t, want)
      else this._animate(t, want)
      this._emitVisible(t)
    })
  }

  _summary (t) {
    return {
      id: t.id, title: t.def.title, symbol: t.def.symbol, color: t.def.color,
      visible: t.on, manual: t.manual, auto: t.on && !t.manual,
      group: t.def.group ?? 'other', padHand: t.def.padHand ?? null,
    }
  }

  _emitVisible (t) {
    window.dispatchEvent(new CustomEvent('omni:axinator-tunnel-visible', {
      detail: { ...this._summary(t), name: this.opts.name },
    }))
  }

  _dispatchList () {
    window.dispatchEvent(new CustomEvent('omni:axinator-list', {
      detail: { name: this.opts.name, followPads: this._followPads, tunnels: this.listTunnels() },
    }))
  }

  _load () {
    try {
      const raw = localStorage.getItem(this.opts.storeKey)
      const parsed = raw ? JSON.parse(raw) : null
      return parsed && typeof parsed === 'object' && parsed.v === STORE_VERSION ? parsed : {}
    } catch (_) { return {} }
  }

  _persist () {
    try {
      const manual = {}
      this._tunnels.forEach(t => { if (t.manual) manual[t.id] = true })
      localStorage.setItem(this.opts.storeKey, JSON.stringify({ v: STORE_VERSION, followPads: this._followPads, manual }))
    } catch (_) {}
  }

  // ── Show / hide animation ───────────────────────────────────────────────────

  /** Jump straight to the end state (no tween). */
  _setShown (t, on) {
    t.tl?.kill(); t.tl = null
    t.grow = on ? 1 : 0
    t.extras = on ? 1 : 0
    t.nodeRecs.forEach(n => { n.appear = on ? 1 : 0 })
    if (t.group) t.group.visible = on
    if (t.built) this._syncTunnel(t, 0)
  }

  _animate (t, show) {
    if (!t.built) return
    t.tl?.kill()
    const nodes = t.nodeRecs
    if (show) {
      t.group.visible = true
      this._syncTunnel(t, 0)
      const tl = gsap.timeline({
        onUpdate: () => this._syncTunnel(t, 0),
        onComplete: () => {
          t.tl = null
          if (!t.on) return
          t.grow = 1; t.extras = 1; nodes.forEach(n => { n.appear = 1 })
          this._syncTunnel(t, 0)
        },
      })
      tl.to(t, { grow: 1, duration: SHOW_GROW_S, ease: 'power2.out' }, 0)
      tl.to(nodes, { appear: 1, duration: NODE_POP_S, ease: 'back.out(2)', stagger: NODE_STAGGER }, 0.25)
      tl.to(t, { extras: 1, duration: 0.4, ease: 'power2.out' }, 0.5)
      t.tl = tl
    } else {
      const tl = gsap.timeline({
        onUpdate: () => this._syncTunnel(t, 0),
        onComplete: () => {
          t.tl = null
          if (t.on) return          // re-shown meanwhile: that path owns the end state
          t.grow = 0; t.extras = 0; nodes.forEach(n => { n.appear = 0 })
          t.group.visible = false
        },
      })
      tl.to(t, { extras: 0, duration: 0.15, ease: 'power2.in' }, 0)
      tl.to(nodes, { appear: 0, duration: 0.2, ease: 'power2.in', stagger: 0.025 }, 0)
      tl.to(t, { grow: 0, duration: HIDE_GROW_S, ease: 'power2.in' }, 0.05)
      t.tl = tl
    }
    if (this._hover?.t === t && !show) this._setHover(null)
  }

  // ── Scene construction (lazy) ───────────────────────────────────────────────

  _ensureBuilt (t) {
    if (t.built) return
    this._buildTunnel(t)
    t.built = true
    this._root.add(t.group)
    t.group.visible = false     // shown by _setShown/_animate
    this._syncTunnel(t, 0)
  }

  /** Signed distance along the tunnel direction of primary position p (may be fractional). */
  _sOf (t, p) {
    return t.twoSided
      ? (p - (t.def.nodes.length - 1) / 2) * NODE_SPACING
      : NODE_RADIUS + p * NODE_SPACING      // first node's near surface touches the origin
  }

  _primaryPoint (t, p, out) {
    return out.copy(t.dir).multiplyScalar(this._sOf(t, p))
  }

  _nodeCenter (t, i, out) {
    return out.copy(t.dir).multiplyScalar(this._sOf(t, i))
  }

  _yOf (t, j) {
    return (j - (t.def.levels.length - 1) / 2) * t.def.relDir * REL_STEP
  }

  _buildTunnel (t) {
    const def = t.def
    const n = def.nodes.length
    const colorHex = hex(def.color)
    const group = new THREE.Group()
    group.name = `OmniAxinator:${this.opts.name}:${t.id}`
    t.group = group

    // ── Tunnel: faint cylinder body + grid lines, built along local +Y then
    //    rotated so +Y lies on this tunnel's direction. Two-sided: -len..+len.
    let maxS = 0
    for (let i = 0; i < n; i++) maxS = Math.max(maxS, Math.abs(this._sOf(t, i)))
    const len = maxS + NODE_RADIUS + TUNNEL_END_PAD
    const y0 = t.twoSided ? -len : 0
    const tunnel = new THREE.Group()
    tunnel.position.y = AXIS_Y
    tunnel.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), t.dir)
    t.tunnelGroup = tunnel

    const span = len - y0
    const bodyGeo = new THREE.CylinderGeometry(TUNNEL_RADIUS, TUNNEL_RADIUS, span, GRID_LONGITUDES * 2, 1, true)
    bodyGeo.translate(0, y0 + span / 2, 0)
    t.bodyMat = new THREE.MeshBasicMaterial({
      color: TUNNEL_COLOR, transparent: true, opacity: TUNNEL_BODY_OPACITY, side: THREE.DoubleSide, depthWrite: false,
    })
    tunnel.add(new THREE.Mesh(bodyGeo, t.bodyMat))

    const verts = []
    for (let i = 0; i < GRID_LONGITUDES; i++) {
      const a = (i / GRID_LONGITUDES) * Math.PI * 2
      const x = Math.cos(a) * TUNNEL_RADIUS, z = Math.sin(a) * TUNNEL_RADIUS
      verts.push(x, y0, z, x, len, z)
    }
    const yStart = t.twoSided ? -Math.floor(len / GRID_RING_STEP) * GRID_RING_STEP : 0
    for (let y = yStart; y <= len; y += GRID_RING_STEP) {
      for (let i = 0; i < RING_SEGMENTS; i++) {
        const a0 = (i / RING_SEGMENTS) * Math.PI * 2
        const a1 = ((i + 1) / RING_SEGMENTS) * Math.PI * 2
        verts.push(Math.cos(a0) * TUNNEL_RADIUS, y, Math.sin(a0) * TUNNEL_RADIUS,
                   Math.cos(a1) * TUNNEL_RADIUS, y, Math.sin(a1) * TUNNEL_RADIUS)
      }
    }
    const gridGeo = new THREE.BufferGeometry()
    gridGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts), 3))
    t.gridMat = new THREE.LineBasicMaterial({ color: TUNNEL_COLOR, transparent: true, opacity: TUNNEL_GRID_OPACITY, depthWrite: false })
    tunnel.add(new THREE.LineSegments(gridGeo, t.gridMat))
    group.add(tunnel)

    // ── Massive container nodes strung along the tunnel (shared geometry per tunnel).
    const shellGeo = def.nodeShape === 'octahedron'
      ? new THREE.OctahedronGeometry(NODE_RADIUS, 1)
      : new THREE.IcosahedronGeometry(NODE_RADIUS, 1)
    const edgeGeo = new THREE.EdgesGeometry(shellGeo)
    const tmp = new THREE.Vector3()
    const rootIdx = Number.isInteger(def.rootIndex) ? def.rootIndex : -1
    def.nodes.forEach((nd, i) => {
      const center = this._nodeCenter(t, i, tmp).clone()
      const isRoot = i === rootIdx
      const markRoot = isRoot && def.showRootMark !== false
      const fillMat = new THREE.MeshBasicMaterial({
        color: NODE_FILL_COLOR, transparent: true, opacity: NODE_FILL_OPACITY, side: THREE.DoubleSide, depthWrite: false,
      })
      const fill = new THREE.Mesh(shellGeo, fillMat)
      const edgeMat = new THREE.LineBasicMaterial({ color: NODE_EDGE_COLOR, transparent: true, opacity: NODE_EDGE_OPACITY, depthWrite: false })
      const edges = new THREE.LineSegments(edgeGeo, edgeMat)
      const darkMat = new THREE.LineBasicMaterial({ color: NODE_EDGE_DARK, transparent: true, opacity: NODE_DARK_OPACITY, depthWrite: false })
      const dark = new THREE.LineSegments(edgeGeo, darkMat)
      dark.scale.setScalar(1.012)

      const label = makeLabelSprite(`${def.labelPrefix ?? ''}${nd.name}`, colorHex, LABEL_FIXED_NODE,
        markRoot ? { sub: '⟐ ROOT' } : {})
      label.center.set(0.5, 0)                  // grows upward from just above the shell
      label.position.set(0, NODE_RADIUS + 10 * GEO_SCALE, 0)

      const g = new THREE.Group()
      g.position.copy(center)
      g.add(fill, edges, dark, label)

      if (markRoot) {
        const crown = new THREE.Mesh(
          new THREE.TorusGeometry(NODE_RADIUS * 1.06, 1.1 * GEO_SCALE, 8, 64),
          new THREE.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.9, depthWrite: false })
        )
        crown.rotation.x = Math.PI / 2
        g.add(crown)
      }
      if (def.tickRings) {
        const ringMat = new THREE.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.5, depthWrite: false })
        const ring = new THREE.Mesh(new THREE.TorusGeometry(TUNNEL_RADIUS * 0.97, 0.5 * GEO_SCALE, 6, 48), ringMat)
        ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), t.dir)
        g.add(ring)
      }
      group.add(g)
      t.nodeRecs.push({
        group: g, fillMat, edgeMat, darkMat, labelMat: label.material, glow: 0, pulse: 0, hov: 0, appear: 0, isRoot,
      })
      t.labels.push({ sprite: label, node: t.nodeRecs[i], kind: 'node' })
    })

    // ── Steppable tunnels: primary marker + relative column.
    if (t.steppable) this._buildMarkerAndColumn(t, group, colorHex)

    makeInert(group)

    // ── Pick spheres: the ONLY raycastable objects. Added after makeInert().
    if (this.opts.pick) {
      const pickGeo = new THREE.SphereGeometry(NODE_RADIUS, 16, 12)
      const pickMat = new THREE.MeshBasicMaterial({ visible: false })
      t.nodeRecs.forEach((rec, i) => {
        const pm = new THREE.Mesh(pickGeo, pickMat)
        pm.userData.omniAxinatorPick = { tunnelId: t.id, nodeIndex: i }
        rec.group.add(pm)
        t.pickMeshes.push(pm)
      })
    }
  }

  _buildMarkerAndColumn (t, group, colorHex) {
    const def = t.def
    const m = def.levels.length
    const marker = new THREE.Group()
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(TUNNEL_RADIUS * 0.97, 0.9 * GEO_SCALE, 8, 64),
      new THREE.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.95, depthWrite: false })
    )
    ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), t.dir)
    const orb = new THREE.Mesh(
      new THREE.SphereGeometry(4.5 * GEO_SCALE, 16, 12),
      new THREE.MeshBasicMaterial({ color: def.color })
    )
    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(10 * GEO_SCALE, 16, 12),
      new THREE.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.22, depthWrite: false })
    )
    marker.add(ring, orb, halo)
    t.marker = marker
    t.markerRing = ring
    group.add(marker)

    const colH = (m - 1) * REL_STEP + REL_COLUMN_PAD * 2
    const column = new THREE.Group()
    const cv = []
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2
      const x = Math.cos(a) * REL_COLUMN_RADIUS, z = Math.sin(a) * REL_COLUMN_RADIUS
      cv.push(x, -colH / 2, z, x, colH / 2, z)
    }
    const colGeo = new THREE.BufferGeometry()
    colGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(cv), 3))
    column.add(new THREE.LineSegments(colGeo,
      new THREE.LineBasicMaterial({ color: def.color, transparent: true, opacity: 0.45, depthWrite: false })))

    def.levels.forEach((lv, j) => {
      const y = this._yOf(t, j)
      const tickMat = new THREE.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.4, depthWrite: false })
      const tick = new THREE.Mesh(new THREE.TorusGeometry(REL_COLUMN_RADIUS * 1.15, 0.5 * GEO_SCALE, 6, 40), tickMat)
      tick.rotation.x = Math.PI / 2
      tick.position.y = y
      const lbl = makeLabelSprite(lv.name, hex(def.color), LABEL_FIXED_LEVEL)
      lbl.center.set(0, 0.5)                    // left-aligned: grows away from the column
      lbl.position.set(REL_COLUMN_RADIUS * 1.15 + 12 * GEO_SCALE, y, 0)
      column.add(tick, lbl)
      const tk = { y, tickMat, labelMat: lbl.material, pulse: 0 }
      t.ticks.push(tk)
      t.labels.push({ sprite: lbl, node: null, kind: 'level', parent: column })
    })

    const relOrb = new THREE.Mesh(
      new THREE.OctahedronGeometry(3.2 * GEO_SCALE, 0),
      new THREE.MeshBasicMaterial({ color: def.color })
    )
    column.add(relOrb)
    t.column = column
    t.relOrb = relOrb
    group.add(column)
  }

  // ── Per-frame visual sync ───────────────────────────────────────────────────

  _syncTunnel (t, delta = 0) {
    if (!t.built) return
    const k = Math.min(1, delta * 9)
    const grow = clamp(t.grow, 0, 1)

    // tunnel body/grid grow outward along the direction while fading in
    t.tunnelGroup.scale.y = Math.max(grow, 1e-4)
    t.bodyMat.opacity = TUNNEL_BODY_OPACITY * grow
    t.gridMat.opacity = TUNNEL_GRID_OPACITY * grow

    let near = -1
    if (t.steppable) {
      this._primaryPoint(t, t.anim.p, this._tmpV)
      t.marker.position.copy(this._tmpV)
      t.column.position.copy(this._tmpV)
      const ex = Math.max(t.extras, 1e-4)
      const breathe = 1 + 0.03 * Math.sin(this._time * 3) + 0.25 * t.bump
      t.markerRing.scale.setScalar(breathe)
      t.marker.scale.setScalar(ex)
      t.column.scale.setScalar(ex)

      const j = t.anim.r
      const lo = Math.floor(j), hi = Math.min(t.ticks.length - 1, lo + 1)
      const f = j - lo
      t.relOrb.position.y = t.ticks[lo].y + (t.ticks[hi].y - t.ticks[lo].y) * f
      near = clamp(Math.round(t.anim.p), 0, t.nodeRecs.length - 1)

      t.ticks.forEach((tk, jj) => {
        const e = Math.max(1 - Math.min(1, Math.abs(jj - j)), tk.pulse)
        tk.tickMat.opacity = (0.35 + 0.65 * e) * t.extras
        tk.labelMat.opacity = (0.45 + 0.55 * e) * t.extras
      })
    }

    t.nodeRecs.forEach((nd, i) => {
      const target = i === near ? 1 : 0
      nd.glow += (target - nd.glow) * (delta > 0 ? k : 0)
      if (t.steppable && delta === 0 && !t.tl) nd.glow = target   // settle exactly when not animating frame-to-frame
      const hovT = this._hover && this._hover.t === t && this._hover.index === i ? 1 : 0
      nd.hov += (hovT - nd.hov) * (delta > 0 ? Math.min(1, delta * 14) : 0)
      const e = Math.max(nd.glow, nd.pulse, nd.hov * 0.8)
      const a = clamp(nd.appear, 0, 1)
      nd.fillMat.opacity = (NODE_FILL_OPACITY + 0.14 * e) * a
      nd.edgeMat.opacity = Math.min(1, (NODE_EDGE_OPACITY + 0.35 * e)) * a
      nd.darkMat.opacity = Math.min(1, (NODE_DARK_OPACITY + 0.4 * e)) * a
      nd.labelMat.opacity = Math.min(1, 0.85 + 0.15 * e) * a
      nd.group.scale.setScalar(Math.max(nd.appear, 1e-4) * (1 + 0.04 * nd.glow))
    })
  }

  _labelFactors (cam) {
    if (cam && cam.isPerspectiveCamera) {
      const k = 2 * Math.tan((cam.fov * Math.PI) / 360) * (cam.aspect || 1)
      return { node: LABEL_SCREEN_FRAC_NODE * k, level: LABEL_SCREEN_FRAC_LEVEL * k }
    }
    return null
  }

  /** Keep labels a roughly constant fraction of the viewport width: world
   *  width = frac * (visible world width at that distance), clamped. */
  _scaleLabels (t, cam, lf) {
    const p = this._tmpP
    t.labels.forEach(lb => {
      const sp = lb.sprite
      const parent = lb.kind === 'node' ? lb.node.group : t.column
      const ps = Math.max(parent.scale.x, 1e-4)
      const shown = lb.kind === 'node' ? lb.node.appear > 0.35 : t.extras > 0.35
      sp.visible = shown
      if (!shown) return
      let w
      if (lf && cam) {
        sp.getWorldPosition(p)
        const dist = p.distanceTo(cam.position)
        w = clamp(dist * (lb.kind === 'node' ? lf.node : lf.level), LABEL_MIN_WORLD, LABEL_MAX_WORLD)
      } else {
        w = lb.kind === 'node' ? LABEL_FIXED_NODE : LABEL_FIXED_LEVEL
      }
      const local = w / ps
      sp.scale.set(local, local * sp.userData.aspect, 1)
    })
  }

  // ── Stepping state (steppable tunnels) ──────────────────────────────────────

  _detail (t, phase) {
    const node = t.def.nodes[t.state.p]
    const level = t.def.levels[t.state.r]
    return {
      hand: t.id,
      phase,
      primaryIndex: t.state.p,
      primaryPosition: t.state.p,
      relativeIndex: t.state.r,
      relativePosition: t.state.r,
      primaryCount: t.def.nodes.length,
      relativeCount: t.def.levels.length,
      activeNode: { id: node.id, name: node.name, index: t.state.p },
      activeLevel: { id: level.id, name: level.name, index: t.state.r },
    }
  }

  _emitState (t, phase) {
    const detail = this._detail(t, phase)
    try { this.opts.onState?.(detail) } catch (_) {}
    if (this.opts.stateEvent) window.dispatchEvent(new CustomEvent(this.opts.stateEvent, { detail }))
  }

  _setState (t, p, r, animate) {
    const pChanged = p !== t.state.p
    const rChanged = r !== t.state.r
    const prevP = t.state.p
    t.state.p = p
    t.state.r = r
    try { this.opts.onStateChange?.(t.id, { ...t.state }) } catch (_) {}

    if (!animate) {
      t.anim.p = p; t.anim.r = r
    } else {
      if (pChanged) {
        const moving = t.tweens.p?.isActive()
        t.tweens.p?.kill()
        t.tweens.p = gsap.to(t.anim, {
          p, duration: TRAVEL_DURATION * Math.min(2, Math.max(1, Math.abs(p - t.anim.p))),
          ease: moving ? 'power2.out' : 'power2.inOut',
          onComplete: () => { t.tweens.p = null; this._maybeSettle(t) },
        })
        if (t.def.stagger) this._staggerNodes(t, prevP, p)
      }
      if (rChanged) {
        const moving = t.tweens.r?.isActive()
        t.tweens.r?.kill()
        t.tweens.r = gsap.to(t.anim, {
          r, duration: REL_DURATION, ease: moving ? 'power2.out' : 'power2.inOut',
          onComplete: () => { t.tweens.r = null; this._maybeSettle(t) },
        })
        if (t.def.stagger) this._staggerTicks(t, r)
      }
    }
    this._emitState(t, 'travel')
    if (!animate) this._emitState(t, 'settle')
  }

  _maybeSettle (t) {
    if (!t.tweens.p && !t.tweens.r) this._emitState(t, 'settle')
  }

  // OmniHand's travel stagger (unchanged from V159): nodes between the old and
  // new position flash in travel order; tier ticks flash outward from the new tier.
  _staggerNodes (t, from, to) {
    const lo = Math.min(from, to), hi = Math.max(from, to)
    const path = t.nodeRecs.slice(lo, hi + 1)
    if (from > to) path.reverse()
    gsap.killTweensOf(path, 'pulse')
    gsap.fromTo(path, { pulse: 1 }, {
      pulse: 0, duration: 0.8, ease: 'power2.out',
      stagger: { each: Math.min(0.12, TRAVEL_DURATION / Math.max(1, path.length)), from: 'start' },
    })
  }

  _staggerTicks (t, activeIndex) {
    gsap.killTweensOf(t.ticks)
    gsap.fromTo(t.ticks, { pulse: 1 }, {
      pulse: 0, duration: 0.7, ease: 'power2.out',
      stagger: { each: 0.08, from: activeIndex },
    })
  }

  _bump (t) {
    gsap.killTweensOf(t, 'bump')
    gsap.fromTo(t, { bump: 1 }, { bump: 0, duration: 0.35, ease: 'power2.out' })
  }

  // ── Picking, tooltip and node menu ──────────────────────────────────────────

  _bindPicking () {
    const canvas = this.ctx.renderer?.domElement
    if (!canvas) return
    this._canvas = canvas
    this._onPointerMove = (e) => this._handleMove(e)
    this._onPointerDown = (e) => { this._down = { x: e.clientX, y: e.clientY } }
    this._onClick = (e) => this._handleClick(e)
    this._onDocDown = (e) => {
      if (this._menuEl && !e.target.closest?.('.oax-menu')) this._closeMenu()
    }
    this._onKey = (e) => { if (e.key === 'Escape') this._closeMenu() }
    canvas.addEventListener('pointermove', this._onPointerMove, { passive: true })
    canvas.addEventListener('pointerdown', this._onPointerDown, { passive: true })
    canvas.addEventListener('click', this._onClick)
    document.addEventListener('pointerdown', this._onDocDown, true)
    window.addEventListener('keydown', this._onKey)
  }

  _unbindPicking () {
    if (!this._canvas) return
    this._canvas.removeEventListener('pointermove', this._onPointerMove)
    this._canvas.removeEventListener('pointerdown', this._onPointerDown)
    this._canvas.removeEventListener('click', this._onClick)
    document.removeEventListener('pointerdown', this._onDocDown, true)
    window.removeEventListener('keydown', this._onKey)
    this._canvas = null
  }

  /** Explicit list: pick spheres of tunnels that are currently shown. */
  _pickList () {
    const out = []
    this._tunnels.forEach(t => {
      if (t.built && t.on && t.grow > 0.4) out.push(...t.pickMeshes)
    })
    return out
  }

  /** -> {t, index} or null. Only ever raycasts our own pick list. */
  _pick (clientX, clientY) {
    const list = this._pickList()
    const cam = this.ctx.camera
    if (!list.length || !cam || !this._canvas) return null
    const rect = this._canvas.getBoundingClientRect()
    if (!rect.width || !rect.height) return null
    this._ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1)
    this._raycaster.setFromCamera(this._ndc, cam)
    const hit = this._raycaster.intersectObjects(list, false)[0]
    const info = hit?.object?.userData?.omniAxinatorPick
    if (!info) return null
    const t = this._tunnels.get(info.tunnelId)
    return t ? { t, index: info.nodeIndex } : null
  }

  _handleMove (e) {
    const now = performance.now()
    if (now - this._lastMove < 50) return
    this._lastMove = now
    // Dragging (orbit, grab, pad-drag...): another system owns the pointer.
    if (e.buttons || this._menuEl || e.target !== this._canvas) { this._setHover(null); return }
    const hit = this._pick(e.clientX, e.clientY)
    this._setHover(hit, e)
  }

  _setHover (hit, e) {
    const same = (!hit && !this._hover) || (hit && this._hover && hit.t === this._hover.t && hit.index === this._hover.index)
    if (!same) this._hover = hit ? { t: hit.t, index: hit.index } : null
    if (!hit) { if (this._tooltipEl) this._tooltipEl.style.display = 'none'; return }
    if (!this._tooltipEl) {
      this._tooltipEl = document.createElement('div')
      this._tooltipEl.className = 'oax-tooltip'
      document.body.appendChild(this._tooltipEl)
    }
    const nd = hit.t.def.nodes[hit.index]
    const isRoot = hit.index === hit.t.def.rootIndex
    const n = hit.t.def.nodes.length
    this._tooltipEl.innerHTML =
      `<b>${esc(hit.t.def.labelPrefix ?? '')}${esc(nd.name)}</b>\n` +
      `${esc(hit.t.def.symbol)} ${esc(hit.t.def.title)} · node ${hit.index + 1}/${n}` +
      (isRoot ? '\nRoot' : '')
    if (e) {
      this._tooltipEl.style.left = `${e.clientX}px`
      this._tooltipEl.style.top = `${e.clientY}px`
    }
    this._tooltipEl.style.display = ''
  }

  _handleClick (e) {
    if (e.button !== 0) return
    if (this._down && Math.hypot(e.clientX - this._down.x, e.clientY - this._down.y) > 5) return   // that was a drag
    const hit = this._pick(e.clientX, e.clientY)
    if (!hit) { this._closeMenu(); return }
    this._openMenu(hit, e.clientX, e.clientY)
  }

  _rootNodeOf (t) {
    const idx = t.def.rootIndex
    return Number.isInteger(idx) && t.def.nodes[idx] ? { node: t.def.nodes[idx], index: idx } : null
  }

  _openMenu (hit, x, y) {
    this._closeMenu()
    this._setHover(null)
    const { t, index } = hit
    const nd = t.def.nodes[index]
    const root = this._rootNodeOf(t)
    const isRoot = index === t.def.rootIndex
    const rootText = t.def.rootText || 'No root defined for this tunnel.'
    const el = document.createElement('div')
    el.className = 'oax-menu'
    // Title ABOVE the root tooltip line, then the actions.
    el.innerHTML =
      `<div class="oax-menu-title">${esc(t.def.symbol)} ${esc(t.def.labelPrefix ?? '')}${esc(nd.name)}</div>` +
      `<div class="oax-menu-root" data-role="root-tooltip" title="${esc(rootText)}">${isRoot ? 'ROOT — ' : 'Root: '}${esc(rootText)}</div>` +
      `<button class="oax-action-btn" data-action="take-me-there">🎯 TakeMeThere</button>` +
      `<button class="oax-action-btn" data-action="root" title="${esc(rootText)}"${root ? '' : ' disabled'}>⟐ Root</button>`
    document.body.appendChild(el)
    el.style.left = `${x}px`
    el.style.top = `${y + 4}px`
    const r = el.getBoundingClientRect?.()
    if (r && r.width) {
      el.style.left = `${Math.max(4, Math.min(x, window.innerWidth - r.width - 4))}px`
      el.style.top = `${Math.max(4, Math.min(y + 4, window.innerHeight - r.height - 4))}px`
    }
    el.querySelector('[data-action="take-me-there"]').addEventListener('click', () => {
      this.travelToNode(t.id, nd.id)
      this._dispatchAction(t.id, nd.id, 'take-me-there')
      this._closeMenu()
    })
    el.querySelector('[data-action="root"]').addEventListener('click', () => {
      if (root) this.travelToNode(t.id, root.node.id)
      this._dispatchAction(t.id, root ? root.node.id : nd.id, 'root')
      this._closeMenu()
    })
    this._menuEl = el
  }

  _closeMenu () {
    this._menuEl?.remove()
    this._menuEl = null
  }

  _dispatchAction (tunnel, nodeId, action) {
    window.dispatchEvent(new CustomEvent('omni:axinator-node-menu-action', { detail: { tunnel, nodeId, action } }))
  }
}
