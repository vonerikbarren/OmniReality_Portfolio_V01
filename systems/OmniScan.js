/**
 * systems/OmniScan.js — OmniScan runtime (V212): reads "what is in the middle circle" and keeps the current scan.
 *
 * Priority of the target:  pinned node  >  the node nearest to you inside the centre circle  >  the selected node.
 * Re-checks ~8 times a second and only when the camera moved or nodes/selection changed (no per-frame cost while idle).
 * API (also Extra-free, reached through window events):  scan.current() -> { id, source:'pinned'|'circle'|'selected', info }  ·  pin(id?) / unpin()  ·  setRadius(r)
 * Events in:  omni:node-selected / omni:node-deselected / omni:node-deleted · omni:scan-pin { id } · omni:scan-unpin · omni:scan-radius { radius }
 * Events out: omni:scan-changed { id, source }.   Registers window.__omniScan? No — it registers Extra.SERVICES.scan.
 */
import * as THREE from 'three'
import { SERVICES } from '../utils/OmniExtraKinds.js'
import { pickScanTarget, describeNode, clampRadius, DEFAULT_RADIUS } from '../utils/OmniScanModel.js'

const STORE_KEY = 'omni:scan:v1'
const TICK_S = 0.12

export default class OmniScan {
  constructor (context, omniNode = null) {
    this.ctx = context; this.omniNode = omniNode
    this.radius = DEFAULT_RADIUS; this.pinned = null; this.selected = null
    this._cur = { id: null, source: null }; this._acc = 0; this._dirty = true; this._bound = []; this._inited = false
    this._lastCam = new THREE.Matrix4(); this._v = new THREE.Vector3()
  }
  init () {
    if (this._inited) return
    this._inited = true
    try { const s = JSON.parse(localStorage.getItem(STORE_KEY)); if (s && typeof s === 'object') this.radius = clampRadius(s.radius ?? DEFAULT_RADIUS) } catch (_) {}
    const on = (t, fn) => { window.addEventListener(t, fn); this._bound.push([t, fn]) }
    on('omni:node-selected', (e) => { this.selected = e.detail?.node?.id ?? e.detail?.mesh?.userData?.nodeId ?? null; this._dirty = true })
    on('omni:node-deselected', () => { this.selected = null; this._dirty = true })
    on('omni:node-deleted', (e) => { if (e.detail?.id === this.pinned) this.pinned = null; if (e.detail?.id === this.selected) this.selected = null; this._dirty = true })
    on('omni:node-created', () => { this._dirty = true }); on('omni:node-updated', () => { this._dirty = true })
    on('omni:scan-pin', (e) => this.pin(e.detail?.id)); on('omni:scan-unpin', () => this.unpin())
    on('omni:scan-radius', (e) => this.setRadius(e.detail?.radius))
    SERVICES.scan = this
  }
  destroy () { for (const [t, fn] of this._bound) window.removeEventListener(t, fn); this._bound = []; if (SERVICES.scan === this) SERVICES.scan = null; this._inited = false }
  onResize () { this._dirty = true }

  pin (id = this._cur.id) { if (!id || !this.omniNode?.getNodeData?.(id)) return false; this.pinned = id; this._dirty = true; this.refresh(); return true }
  unpin () { this.pinned = null; this._dirty = true; this.refresh() }
  setRadius (r) { this.radius = clampRadius(r); try { localStorage.setItem(STORE_KEY, JSON.stringify({ radius: this.radius })) } catch (_) {} ; this._dirty = true; this.refresh(); return this.radius }
  current () { return { id: this._cur.id, source: this._cur.source, pinned: this.pinned, radius: this.radius, info: this._cur.id ? this.infoOf(this._cur.id) : null } }

  infoOf (id) {
    const on = this.omniNode; const data = on?.getNodeData?.(id); if (!data) return null
    const mesh = on.getMeshById?.(id)
    const extra = {}
    if (mesh) { extra.position = [mesh.position.x, mesh.position.y, mesh.position.z]; extra.rotation = [mesh.rotation.x, mesh.rotation.y, mesh.rotation.z]; extra.scale = [mesh.scale.x, mesh.scale.y, mesh.scale.z] }
    try { const edges = on.getAllEdges?.() ?? []; extra.links = edges.filter(e => e.from === id || e.to === id).length } catch (_) {}
    if (data.parentId) extra.parent = data.parentId
    return describeNode(data, extra)
  }

  _circleTarget () {
    const cam = this.ctx.camera, on = this.omniNode; if (!cam || !on?.getAllMeshes) return null
    const entries = []
    for (const m of on.getAllMeshes()) { const id = m?.userData?.nodeId; if (id) entries.push({ id, position: [m.position.x, m.position.y, m.position.z] }) }
    const aspect = (window.innerWidth || 1280) / (window.innerHeight || 720)
    const v = this._v
    const camLike = { project: (p) => { v.set(p[0], p[1], p[2]); const d = v.distanceTo(cam.position); v.project(cam); return { x: v.x, y: v.y, z: v.z, dist: d } } }
    return pickScanTarget(entries, camLike, { radius: this.radius, aspect })
  }
  /** work out the target now; announces when it changes. Returns the current id. */
  refresh () {
    let id = null, source = null
    if (this.pinned && this.omniNode?.getNodeData?.(this.pinned)) { id = this.pinned; source = 'pinned' }
    else { const c = this._circleTarget(); if (c) { id = c; source = 'circle' } else if (this.selected && this.omniNode?.getNodeData?.(this.selected)) { id = this.selected; source = 'selected' } }
    if (id !== this._cur.id || source !== this._cur.source) { this._cur = { id, source }; try { window.dispatchEvent(new CustomEvent('omni:scan-changed', { detail: { id, source } })) } catch (_) {} }
    this._dirty = false; return id
  }
  update (delta = 0.016) {
    const cam = this.ctx.camera; if (cam) { cam.updateMatrixWorld?.(); if (!this._lastCam.equals(cam.matrixWorld)) { this._lastCam.copy(cam.matrixWorld); this._dirty = true } }
    this._acc += delta; if (this._acc < TICK_S) return; this._acc = 0
    if (this._dirty) this.refresh()
  }
}
