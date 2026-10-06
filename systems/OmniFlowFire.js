/**
 * systems/OmniFlowFire.js — the centre FIRE button of the LeftHand / RightHand pads (V168)
 *
 * Design: docs/omniproducts/OMNI_FLOW_FIRE_DESIGN.md. In one paragraph: the LeftHand SHOOTS OUT
 * flowchart elements (Terminator / Process / Decision / InputOutput / Connector / Loop); the
 * RightHand DISPLAYS what that looks like and what is inside it — its ammo is a created PAYLOAD
 * (utils/OmniPayloads.js: a data type + value + style). "The inspector, broken up between hands."
 *
 *   omni:hand-fire { hand }
 *     target   the currently selected node, else the node nearest the screen-centre ray (25 deg)
 *              — the V165 resolver, reused from OmniHandAmmo when wired (setTargetResolver) — and
 *              when neither exists the HUD CENTRE: camera.position + forward x fireDistance
 *              (OmniHandsSettings `fireDistance`, 2..60, default 10). Fire never shows the red
 *              "no target" pulse; that stays on the Activation (behaviour) button.
 *     lh       a cheap tracer (+ head bead) flies from the pad's screen corner to the destination,
 *              then a real NODE appears there (omni:node-create-request -> OmniNode) shaped as the
 *              current element kind, styled by the current payload (if any) and carrying
 *              data.flowElement { kind, hand, payloadId, chainId, seq, targetId, payload snapshot,
 *              style }. A chain runs in the camera's horizontal right direction as it was when the chain began
 *              (a flowchart across the screen; straight down would hit the floor). Consecutive elements of one chain are linked by an ordinary edge (the new
 *              node's parentId = the previous element -> OmniNode._connectNodes, persisted by
 *              OmniNode with the rest of the node data). A chain continues while the target is the
 *              same (a node, or the HUD centre within 1.5 x fireDistance of the chain's first element) and
 *              resets otherwise, on omni:flow-end-chain {hand}, or with `chainEnabled` off.
 *     rh       same shot, but the arrival is a small display ANCHOR (a tiny node of kind 'Anchor');
 *              there is no flowchart element. Needs a current payload (else feedback 'empty').
 *   DISPLAY    on arrival the payload plays on the element / anchor as word tooltips
 *              (utils/FlowWordPlayer.js), projected to the screen every frame while alive, so the
 *              words follow the camera. Clicking the node (omni:node-selected) or
 *              omni:flow-replay { nodeId } replays it.
 *
 * Persistence / both registries: the engine never reads a node registry. Like V164's behaviour
 * engine it learns nodes from omni:node-created / -restored (+ a nodes-request snapshot answered by
 * OmniNode at init) and a scene scan for userData.nodeId, so targets in OmniNode's AND NodeLoader's
 * registries both work (the target is just a mesh). Fired elements are created through OmniNode (the
 * only registry that answers omni:node-create-request); their flowElement field is saved with the
 * node, and on reload the engine re-applies the shape / style and re-adopts them.
 *
 * Limits: `maxAlive` elements per hand (oldest scale out and are deleted), MAX_PROJECTILES shots in
 * flight, FlowWordPlayer's global 24-word cap, master toggle omni:flow-fire-master-set.
 * NOT built: array / object payloads, per-word panels, incoming "shot at the user" mode, flowchart
 * execution (elements are visual / structural only).
 *
 * Events consumed (window):
 *   omni:hand-fire {hand} · omni:tool-select (lh, page ⟐1: sets the element kind) · omni:flow-replay {nodeId} · omni:flow-end-chain {hand} · omni:flow-clear {hand?}
 *   omni:flow-fire-master-set {enabled} · omni:flow-state-request
 *   omni:node-selected / -deselected / -created / -restored / -deleted, omni:nodes-updated, omni:scene-clear-request
 *   omni:hands-settings-changed, omni:payload-changed, omni:payload-current
 * Events dispatched (window):
 *   omni:flow-fired {hand, kind, nodeId, targetId|null, payloadId}
 *   omni:flow-display {nodeId, phase: 'start'|'word'|'end'}
 *   omni:hand-fire-feedback {hand, kind: 'fired'|'empty'|'disabled'}
 *   omni:flow-state {hand, kind, alive, chainLength, payloadId, ready}
 *   omni:flow-fire-master-changed {enabled}
 *   omni:node-create-request / omni:node-delete-request  (OmniNode's own inputs)
 *
 * Module contract: constructor(context) / init / update / destroy / onResize.
 */

import * as THREE from 'three'
import gsap from 'gsap'
import { getHandSetting, setHandSetting, CHANGE_EVENT } from '../utils/OmniHandsSettings.js'
import { getCurrentPayload, snapshot, CHANGED_EVENT as PAYLOAD_CHANGED, CURRENT_EVENT as PAYLOAD_CURRENT } from '../utils/OmniPayloads.js'
import FlowWordPlayer from '../utils/FlowWordPlayer.js'
import { GALLERY_ASSETS } from './OmniGallery.js'

export const FLOW_HANDS = ['lh', 'rh']
export const FLOW_KINDS = ['Terminator', 'Process', 'Decision', 'InputOutput', 'Connector', 'Loop']
export const ANCHOR_KIND = 'Anchor'
export const CENTER_CONE_DEG = 25
export const MAX_PROJECTILES = 8
export const SHOT_SECONDS = 0.32
export const CHAIN_STEP = 2.2            // world units between chained elements (along the chain's direction: the camera's horizontal right when the chain began)
export const SIDE_OFFSET = 1.8           // the first element sits beside a targeted node (camera right)
export const NEUTRAL_STYLE = Object.freeze({ color: '#9aa7b5', textureId: null, texturePath: null, material: 'standard' })
const STORE_MASTER = 'omni:flow-fire-master-v1'
const HAND_COLOR = { lh: '#c8ffdc', rh: '#ffc8f0' }
const BASE_GEOMETRY = {
  Terminator: 'CapsuleGeometry', Process: 'BoxGeometry', Decision: 'BoxGeometry',
  InputOutput: 'BoxGeometry', Connector: 'SphereGeometry', Loop: 'TorusGeometry', Anchor: 'SphereGeometry',
}

/** The real geometry of each kind (0.3 .. 1.2 world units). The node is created with BASE_GEOMETRY and re-shaped on created / restored. */
export function buildFlowGeometry (kind) {
  switch (kind) {
    case 'Terminator': { const g = new THREE.CapsuleGeometry(0.28, 0.6, 4, 14); g.rotateZ(Math.PI / 2); g.scale(1, 1, 0.45); return g }
    case 'Decision': { const g = new THREE.BoxGeometry(0.75, 0.75, 0.3); g.rotateZ(Math.PI / 4); return g }
    case 'InputOutput': {
      const g = new THREE.BoxGeometry(0.9, 0.6, 0.3)
      g.applyMatrix4(new THREE.Matrix4().set(1, 0.4, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1))
      g.computeVertexNormals()
      return g
    }
    case 'Connector': return new THREE.SphereGeometry(0.3, 16, 12)
    case 'Loop': return new THREE.TorusGeometry(0.42, 0.13, 10, 28)
    case 'Anchor': return new THREE.SphereGeometry(0.16, 12, 10)
    case 'Process':
    default: return new THREE.BoxGeometry(1.0, 0.62, 0.3)
  }
}

const hexToTexturePath = (id) => GALLERY_ASSETS.find(a => a.id === id)?.path ?? null

/** Payload style -> the persisted element style (adds the resolved texture path). */
export function styleFromPayload (payload) {
  if (!payload) return { ...NEUTRAL_STYLE }
  const s = payload.style ?? {}
  return { color: s.color ?? NEUTRAL_STYLE.color, textureId: s.textureId ?? null, texturePath: s.textureId ? hexToTexturePath(s.textureId) : null, material: s.material ?? 'standard' }
}

export function makeMaterial (style) {
  const color = new THREE.Color(style?.color ?? NEUTRAL_STYLE.color)
  switch (style?.material) {
    case 'basic': return new THREE.MeshBasicMaterial({ color })
    case 'emissive': return new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.85, roughness: 0.4, metalness: 0.05 })
    case 'glass': return new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.45, roughness: 0.05, metalness: 0.1, side: THREE.DoubleSide })
    case 'wireframe': return new THREE.MeshBasicMaterial({ color, wireframe: true })
    case 'metal': return new THREE.MeshStandardMaterial({ color, metalness: 0.8, roughness: 0.3 })
    default: return new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.08 })
  }
}

const _wp = new THREE.Vector3(), _p = new THREE.Vector3(), _f = new THREE.Vector3(), _r = new THREE.Vector3()
const newChainId = () => 'ch_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5)
const newNodeId = () => 'fl_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7)

export default class OmniFlowFire {
  constructor (context) {
    this.ctx = context
    this._ammo = null                     // optional OmniHandAmmo (target resolver)
    this._records = new Map()             // nodeId -> { id, hand, kind, mesh, flow, seq, dying }
    this._alive = { lh: [], rh: [] }      // oldest first (records)
    this._playing = new Map()             // nodeId -> { player, container }
    this._projectiles = new Set()
    this._pending = []                    // chain bookkeeping: positions of shots in flight { id, pos }
    this._chain = null                    // { id, key, lastId, lastPos, firstPos, dir:Vector3, length }
    this._selected = null
    this._seq = 1
    this._texCache = new Map()
    this._loader = null
    this._bound = []
    this._enabled = true
    try { this._enabled = localStorage.getItem(STORE_MASTER) !== '0' } catch (_) {}
  }

  /** Optional: the OmniHandAmmo instance whose V165 resolveTarget() decides the target. */
  setTargetResolver (ammo) { this._ammo = ammo }

  get enabled () { return this._enabled }

  init () {
    if (this._bound.length) return
    const on = (n, fn) => { window.addEventListener(n, fn); this._bound.push([n, fn]) }
    on('omni:hand-fire', (e) => { const h = e.detail?.hand; if (FLOW_HANDS.includes(h)) this.fire(h) })
    // LeftHand radial page ⟐1 (ui/RadialMenu.js): the lit tool IS the current element kind.
    on('omni:tool-select', (e) => {
      const d = e.detail ?? {}
      if (d.hand === 'lh' && d.page === '⟐1' && FLOW_KINDS.includes(d.tool)) setHandSetting('lh', 'elementKind', d.tool)
    })
    on('omni:flow-replay', (e) => { if (e.detail?.nodeId) this.play(e.detail.nodeId) })
    on('omni:flow-end-chain', (e) => { if (!e.detail?.hand || e.detail.hand === 'lh') this.endChain() })
    on('omni:flow-clear', (e) => this.clear(e.detail?.hand))
    on('omni:flow-fire-master-set', (e) => this.setEnabled(!!e.detail?.enabled))
    on('omni:flow-state-request', () => FLOW_HANDS.forEach(h => this._emitState(h)))
    on('omni:node-selected', (e) => {
      const { node, mesh } = e.detail ?? {}
      this._selected = node?.id && mesh ? { id: node.id, mesh, data: node } : null
      if (node?.flowElement && this._records.has(node.id)) this.play(node.id)
    })
    on('omni:node-deselected', () => { this._selected = null })
    on('omni:node-created', (e) => this._onNode(e.detail?.node, e.detail?.mesh))
    on('omni:node-restored', (e) => this._onNode(e.detail?.node, e.detail?.mesh))
    on('omni:node-deleted', (e) => { if (e.detail?.id) this._forget(e.detail.id) })
    on('omni:nodes-updated', (e) => (e.detail?.nodes ?? []).forEach(n => { if (n?.flowElement && !this._records.has(n.id)) this._onNode(n, this._meshFor(n.id)) }))
    on('omni:scene-clear-request', () => this._forgetAll())
    on(CHANGE_EVENT, (e) => { if (FLOW_HANDS.includes(e.detail?.hand)) this._emitState(e.detail.hand) })
    on(PAYLOAD_CHANGED, () => FLOW_HANDS.forEach(h => this._emitState(h)))
    on(PAYLOAD_CURRENT, () => FLOW_HANDS.forEach(h => this._emitState(h)))
    // Reload: OmniNode restored its nodes before this module existed; ask for the snapshot.
    window.dispatchEvent(new CustomEvent('omni:nodes-request'))
  }

  destroy () {
    this._bound.forEach(([n, fn]) => window.removeEventListener(n, fn))
    this._bound.length = 0
    this._projectiles.forEach(p => this._disposeShot(p))
    this._projectiles.clear()
    this._playing.forEach((_, id) => this._stopDisplay(id))
    this._texCache.forEach(t => t.dispose())
    this._texCache.clear()
    this._records.clear()
    this._alive = { lh: [], rh: [] }
  }

  onResize () {}

  // ── Master toggle ───────────────────────────────────────────────────────────

  setEnabled (on) {
    this._enabled = !!on
    try { localStorage.setItem(STORE_MASTER, this._enabled ? '1' : '0') } catch (_) {}
    if (!this._enabled) [...this._playing.keys()].forEach(id => this._stopDisplay(id))
    window.dispatchEvent(new CustomEvent('omni:flow-fire-master-changed', { detail: { enabled: this._enabled } }))
  }

  // ── Reading state (tests / panels) ──────────────────────────────────────────

  getAlive (hand) { return this._alive[hand].map(r => r.id) }
  getChain () { return this._chain ? { id: this._chain.id, key: this._chain.key, length: this._chain.length, lastId: this._chain.lastId } : null }
  getRecord (id) { return this._records.get(id) ?? null }
  isPlaying (id) { return this._playing.has(id) }
  projectileCount () { return this._projectiles.size }

  // ── Fire ────────────────────────────────────────────────────────────────────

  /** Returns the feedback kind. */
  fire (hand) {
    if (!FLOW_HANDS.includes(hand)) return null
    if (!this._enabled) return this._feedback(hand, 'disabled')
    const cam = this.ctx?.camera
    if (!cam) return this._feedback(hand, 'empty')
    const payload = getCurrentPayload()
    if (hand === 'rh' && !payload) return this._feedback(hand, 'empty')
    cam.updateMatrixWorld?.()

    const target = this._resolveTarget()
    const dist = Number(getHandSetting(hand, 'fireDistance')) || 10
    const base = new THREE.Vector3()
    if (target) target.mesh.getWorldPosition(base)
    else { cam.getWorldDirection(_f); base.copy(cam.position).addScaledVector(_f, dist) }

    const kind = hand === 'lh' ? (getHandSetting('lh', 'elementKind') || 'Process') : ANCHOR_KIND
    const key = target ? target.id : 'hud'
    const pos = base.clone()
    let prev = null, prevId = null
    cam.matrixWorld.extractBasis(_r, _p, _f)                  // camera right in _r (kept horizontal: the flow runs across the screen)
    _r.y = 0
    if (_r.lengthSq() < 1e-8) _r.set(1, 0, 0)
    _r.normalize()
    const right = _r.clone()
    if (hand === 'lh' && getHandSetting('lh', 'chainEnabled') && this._chainContinues(key, base, dist)) {
      prev = this._chain
      prevId = prev.lastId
      pos.copy(prev.lastPos).addScaledVector(prev.dir, CHAIN_STEP)
    } else if (target) {
      if (hand === 'lh') pos.addScaledVector(right, SIDE_OFFSET)
      else pos.y += 1.1
    }
    this._clearSpot(pos, hand, prev ? prev.dir : right)
    pos.y = Math.max(0.3, pos.y)

    const id = newNodeId()
    const seq = this._seq++
    let chain = prev
    if (hand === 'lh') {
      if (!prev) chain = { id: newChainId(), key, lastId: null, lastPos: new THREE.Vector3(), firstPos: pos.clone(), dir: right, length: 0 }
      chain.lastPos.copy(pos); chain.lastId = id; chain.length++
      this._chain = getHandSetting('lh', 'chainEnabled') ? chain : null
    }
    const style = styleFromPayload(payload)
    const flow = {
      v: 1, kind, hand, payloadId: payload?.id ?? null, chainId: hand === 'lh' ? chain.id : null, seq,
      targetId: target?.id ?? null, payload: payload ? snapshot(payload) : null, style,
    }
    const spec = { id, hand, kind, pos, flow, parentId: prevId }
    this._launch(hand, pos, style.color, id, () => this._arrive(spec, target?.id ?? null))
    this._feedback(hand, 'fired', { nodeId: id })
    return 'fired'
  }

  _chainContinues (key, base, dist) {
    const c = this._chain
    if (!c || c.key !== key) return false
    const prevRec = this._records.get(c.lastId)
    const pending = this._pending.some(p => p.id === c.lastId)
    if (!prevRec && !pending) return false          // the last element was deleted
    if (key === 'hud' && c.firstPos.distanceTo(base) > dist * 1.5) return false
    return true
  }

  /** Keep shifting `pos` (along `dir`; anchors go up) while one of this hand's fired elements (or a shot in flight) sits within 0.5 of it. */
  _clearSpot (pos, hand, dir) {
    for (let tries = 0; tries < 12; tries++) {
      let hit = false
      for (const r of this._alive[hand]) { r.mesh.getWorldPosition(_wp); if (_wp.distanceToSquared(pos) < 0.25) { hit = true; break } }
      if (!hit) for (const p of this._pending) { if (p.hand === hand && p.pos.distanceToSquared(pos) < 0.25) { hit = true; break } }
      if (!hit) return
      if (hand === 'rh') pos.y += 0.45
      else pos.addScaledVector(dir, CHAIN_STEP * 0.65)
    }
  }

  // ── Target ──────────────────────────────────────────────────────────────────

  /** The V165 resolver (selected node, else nearest to the screen-centre ray). Null -> HUD centre. */
  _resolveTarget () {
    // Fired elements / anchors are skipped by the screen-centre search (they would otherwise become the next
    // shot's target, so a second shot at the HUD centre could never continue its chain); selecting one still targets it.
    const skip = this._skipOwn ?? (this._skipOwn = (m) => this._records.has(m.userData?.nodeId))
    if (this._ammo?.resolveTarget) {
      const t = this._ammo.resolveTarget(skip)
      return t?.mesh?.parent ? t : null
    }
    const sel = this._selected
    if (sel?.mesh?.parent) return sel
    return this._centerNode(skip)
  }

  _centerNode (skip) {
    const cam = this.ctx?.camera
    const kids = this.ctx?.scene?.children ?? []
    cam.getWorldDirection(_f)
    let best = null, bestCos = Math.cos(CENTER_CONE_DEG * Math.PI / 180)
    for (let i = 0; i < kids.length; i++) {
      const m = kids[i], id = m.userData?.nodeId
      if (!id || m.visible === false || (skip && skip(m))) continue
      m.getWorldPosition(_wp).sub(cam.position)
      const len = _wp.length()
      if (len < 1e-6) continue
      const c = _wp.dot(_f) / len
      if (c > bestCos) { bestCos = c; best = { id, mesh: m, data: null } }
    }
    return best
  }

  _meshFor (id) {
    const kids = this.ctx?.scene?.children ?? []
    for (let i = 0; i < kids.length; i++) if (kids[i].userData?.nodeId === id) return kids[i]
    return null
  }

  // ── Shot (tracer + head bead) ───────────────────────────────────────────────

  _launch (hand, dest, colorHex, id, onArrive) {
    const cam = this.ctx?.camera, scene = this.ctx?.scene
    this._pending.push({ id, hand, pos: dest.clone() })
    const pend = this._pending[this._pending.length - 1]
    const done = () => { const i = this._pending.indexOf(pend); if (i >= 0) this._pending.splice(i, 1); onArrive() }
    if (!cam || !scene) { done(); return }
    while (this._projectiles.size >= MAX_PROJECTILES) { const old = this._projectiles.values().next().value; this._finishShot(old, true) }
    const start = new THREE.Vector3(hand === 'lh' ? -0.85 : 0.85, -0.85, 0.5).unproject(cam)
    const pos = new Float32Array([start.x, start.y, start.z, start.x, start.y, start.z])
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    const color = new THREE.Color(colorHex || HAND_COLOR[hand])
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 1, depthTest: false })
    const line = new THREE.Line(geo, mat)
    line.frustumCulled = false; line.renderOrder = 999
    const headGeo = new THREE.SphereGeometry(0.09, 8, 6)
    const headMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, depthTest: false })
    const head = new THREE.Mesh(headGeo, headMat)
    head.frustumCulled = false; head.renderOrder = 1000; head.position.copy(start)
    scene.add(line); scene.add(head)
    const shot = { line, geo, mat, head, headGeo, headMat, tl: null, u: 0, arrived: false, done }
    this._projectiles.add(shot)
    shot.tl = gsap.timeline()
    shot.tl.to(shot, {
      u: 1, duration: SHOT_SECONDS, ease: 'power2.in',
      onUpdate: () => {
        pos[3] = start.x + (dest.x - start.x) * shot.u
        pos[4] = start.y + (dest.y - start.y) * shot.u
        pos[5] = start.z + (dest.z - start.z) * shot.u
        geo.attributes.position.needsUpdate = true
        head.position.set(pos[3], pos[4], pos[5])
      },
      onComplete: () => { shot.arrived = true; head.visible = false; shot.done() },
    })
    shot.tl.to(mat, { opacity: 0, duration: 0.3, ease: 'power1.in', onComplete: () => this._disposeShot(shot) })
  }

  _finishShot (shot, instant) {
    if (!shot.arrived) { shot.arrived = true; shot.tl?.kill(); shot.done() }
    this._disposeShot(shot)
  }

  _disposeShot (shot) {
    if (!shot || !this._projectiles.has(shot)) return
    this._projectiles.delete(shot)
    shot.tl?.kill()
    shot.line.parent?.remove(shot.line)
    shot.head.parent?.remove(shot.head)
    shot.geo.dispose(); shot.mat.dispose(); shot.headGeo.dispose(); shot.headMat.dispose()
  }

  // ── Arrival: create the node ────────────────────────────────────────────────

  _arrive (spec, targetId) {
    const { id, hand, kind, pos, flow, parentId } = spec
    const cam = this.ctx?.camera
    const yaw = cam ? Math.atan2(cam.position.x - pos.x, cam.position.z - pos.z) : 0
    const label = hand === 'lh' ? `⟐${kind} ${flow.seq}` : `⟐${flow.payload?.name ?? 'Display'}`
    window.dispatchEvent(new CustomEvent('omni:node-create-request', {
      detail: {
        id, label, geometry: BASE_GEOMETRY[kind] ?? 'BoxGeometry', primitive: 'objective',
        color: flow.style.color, position: [pos.x, pos.y, pos.z], rotation: [0, yaw, 0], scale: [1, 1, 1],
        parentId, skipAutoSelect: true, flowElement: flow,
      },
    }))
    const rec = this._records.get(id)
    if (!rec) return                       // no registry answered (OmniNode missing): nothing to track
    window.dispatchEvent(new CustomEvent('omni:flow-fired', { detail: { hand, kind, nodeId: id, targetId, payloadId: flow.payloadId } }))
    this._enforceMax(hand)
    if (flow.payload) this.play(id)
    this._emitState(hand)
  }

  // ── Following nodes (created / restored / deleted) ──────────────────────────

  _onNode (data, mesh) {
    const flow = data?.flowElement
    if (!flow || !data.id) return
    mesh = mesh ?? this._meshFor(data.id)
    if (!mesh || this._records.has(data.id)) return
    const hand = FLOW_HANDS.includes(flow.hand) ? flow.hand : 'lh'
    const rec = { id: data.id, hand, kind: flow.kind, mesh, flow, seq: Number(flow.seq) || 0, dying: false }
    this._records.set(data.id, rec)
    this._seq = Math.max(this._seq, rec.seq + 1)
    const list = this._alive[hand]
    list.push(rec)
    list.sort((a, b) => a.seq - b.seq)
    this._shape(mesh, flow.kind)
    this._style(mesh, flow.style)
  }

  _shape (mesh, kind) {
    if (!mesh?.isMesh || mesh.userData.flowShaped === kind) return
    const old = mesh.geometry
    mesh.geometry = buildFlowGeometry(kind)
    mesh.userData.flowShaped = kind
    old?.dispose?.()
  }

  _style (mesh, style) {
    if (!mesh?.isMesh) return
    const s = { ...NEUTRAL_STYLE, ...(style ?? {}) }
    const old = mesh.material
    const mat = makeMaterial(s)
    mesh.material = mat
    old?.dispose?.()
    const path = s.texturePath || (s.textureId ? hexToTexturePath(s.textureId) : null)
    if (path && s.material !== 'wireframe') this._applyTexture(mat, path)
  }

  _applyTexture (mat, path) {
    try {
      this._loader = this._loader ?? new THREE.TextureLoader()
      const cached = this._texCache.get(path)
      if (cached) { mat.map = cached.clone(); mat.map.needsUpdate = true; mat.needsUpdate = true; return }
      this._loader.load(path, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace
        this._texCache.set(path, tex)
        mat.map = tex.clone(); mat.map.needsUpdate = true; mat.needsUpdate = true
      }, undefined, () => {})
    } catch (_) { /* no image support (headless): the colour still applies */ }
  }

  _forget (id) {
    const rec = this._records.get(id)
    this._stopDisplay(id)
    if (!rec) return
    this._records.delete(id)
    const list = this._alive[rec.hand]
    const i = list.indexOf(rec)
    if (i >= 0) list.splice(i, 1)
    if (this._chain?.lastId === id) this._chain = null
    this._emitState(rec.hand)
  }

  _forgetAll () {
    [...this._records.keys()].forEach(id => this._forget(id))
    this._chain = null
  }

  // ── Limits / removal ────────────────────────────────────────────────────────

  _enforceMax (hand) {
    const max = Math.max(1, Math.round(Number(getHandSetting(hand, 'maxAlive')) || 40))
    const list = this._alive[hand]
    while (list.length > max) this._remove(list[0])
  }

  /** Scale out, then delete through OmniNode (its own delete-request tears down mesh / edges / storage). */
  _remove (rec) {
    if (!rec || rec.dying) return
    rec.dying = true
    const list = this._alive[rec.hand]
    const i = list.indexOf(rec)
    if (i >= 0) list.splice(i, 1)
    this._stopDisplay(rec.id)
    if (this._chain?.lastId === rec.id) this._chain = null
    const del = () => window.dispatchEvent(new CustomEvent('omni:node-delete-request', { detail: { id: rec.id } }))
    if (rec.mesh?.scale) gsap.to(rec.mesh.scale, { x: 0, y: 0, z: 0, duration: 0.25, ease: 'power2.in', onComplete: del })
    else del()
  }

  /** "Remove all fired elements" (one hand, or both when omitted). */
  clear (hand) {
    (hand ? [hand] : FLOW_HANDS).forEach(h => { if (this._alive[h]) this._alive[h].slice().forEach(r => this._remove(r)) })
    if (!hand || hand === 'lh') this._chain = null
    ;(hand ? [hand] : FLOW_HANDS).forEach(h => this._emitState(h))
  }

  endChain () {
    this._chain = null
    this._emitState('lh')
  }

  // ── Display ─────────────────────────────────────────────────────────────────

  /** (Re)plays the stored payload on a fired element / anchor. */
  play (nodeId) {
    const rec = this._records.get(nodeId)
    if (!rec || rec.dying || !this._enabled || !rec.flow.payload) return false
    this._stopDisplay(nodeId)
    const container = document.createElement('div')
    container.className = 'omni-flow-anchor'
    container.style.display = 'none'
    ;(document.getElementById('omni-ui') ?? document.body).appendChild(container)
    const player = new FlowWordPlayer({
      payload: rec.flow.payload, container,
      onPhase: (phase) => {
        window.dispatchEvent(new CustomEvent('omni:flow-display', { detail: { nodeId, phase } }))
        if (phase === 'end') this._stopDisplay(nodeId, true)
      },
    })
    const entry = { player, container, x: NaN, y: NaN }
    this._playing.set(nodeId, entry)
    this._project(rec, entry)
    if (!player.start()) { this._stopDisplay(nodeId, true); return false }
    return true
  }

  _stopDisplay (nodeId, fromEnd = false) {
    const e = this._playing.get(nodeId)
    if (!e) return
    this._playing.delete(nodeId)
    e.player.stop(true)
    e.container.remove()
    if (!fromEnd) window.dispatchEvent(new CustomEvent('omni:flow-display', { detail: { nodeId, phase: 'end' } }))
  }

  update () {
    if (!this._playing.size) return
    this._playing.forEach((entry, id) => {
      const rec = this._records.get(id)
      if (!rec) return
      this._project(rec, entry)
    })
  }

  /** Projects the element's world position (a little above it) to the screen; hides it when behind the camera. */
  _project (rec, entry) {
    const cam = this.ctx?.camera
    if (!cam || !rec.mesh) return
    rec.mesh.getWorldPosition(_p)
    _p.y += 0.75
    _p.project(cam)
    const c = entry.container
    if (_p.z > 1 || _p.z < -1) { if (c.style.display !== 'none') c.style.display = 'none'; return }
    if (c.style.display === 'none') c.style.display = ''
    const x = (_p.x * 0.5 + 0.5) * window.innerWidth
    const y = (-_p.y * 0.5 + 0.5) * window.innerHeight
    if (Math.abs(x - entry.x) < 0.25 && Math.abs(y - entry.y) < 0.25) return
    entry.x = x; entry.y = y
    c.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`
  }

  // ── Events out ──────────────────────────────────────────────────────────────

  _feedback (hand, kind, extra = {}) {
    window.dispatchEvent(new CustomEvent('omni:hand-fire-feedback', { detail: { hand, kind, ...extra } }))
    return kind
  }

  _emitState (hand) {
    const p = getCurrentPayload()
    window.dispatchEvent(new CustomEvent('omni:flow-state', {
      detail: {
        hand, kind: hand === 'lh' ? getHandSetting('lh', 'elementKind') : ANCHOR_KIND,
        alive: this._alive[hand].length, chainLength: hand === 'lh' ? (this._chain?.length ?? 0) : 0,
        payloadId: p?.id ?? null, ready: hand === 'lh' ? true : !!p,
      },
    }))
  }
}
