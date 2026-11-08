/**
 * systems/OmniEdgeNodes.js (V278) — the runtime of the EdgeNode: a real node that sits on the line between two nodes and says HOW you travel it:
 * along a line, through a tunnel, looping a torus, or circling in an orbit; with one or many control points that bend the route. Model: utils/OmniEdgeNodeModel.js.
 *   The diamond follows the middle of its two nodes; the route follows them too (the control points are kept in the edge's own frame).
 *   ride(id, { reverse, camera }) flies the camera along the route; routeFor(a, b) gives the route between two nodes (the Presenter rides it for that hop).
 *   SERVICES.edgenodes: create({ from, to, mode, id }) get(id) set(id, patch) setMode(id, mode) addPoint(id, pt) setPoint(id, i, pt) removePoint(id, i) routeFor(a, b) ride(id, o) stop() list() between(a, b)
 *   Events out: omni:edgenode-changed { nodeId, reason }, omni:edgenode-ride { nodeId, state }.   In: omni:edgenode-create { from, to, mode, fromSelected } (answer in detail.out).
 */
import * as THREE from 'three'
import gsap from 'gsap'
import * as M from '../utils/OmniEdgeNodeModel.js'
import { KIND_EDGE, GEO_EDGE, SERVICES } from '../utils/OmniExtraKinds.js'
import { applyEdgeNodeLook } from '../utils/OmniEdgeNodeMesh.js'

const PERSIST_MS = 300, SCAN_MS = 250
const send = (n, d) => { try { window.dispatchEvent(new CustomEvent(n, { detail: d })) } catch (_) { /* no window */ } }
const newId = () => 'omni_' + Math.random().toString(36).slice(2, 8)
const notify = (desc) => send('omni:notify-info', { name: 'Edge node', desc, holdMs: 3500 })

export default class OmniEdgeNodes {
  constructor (context, omniNode = null) { this.ctx = context; this.omniNode = omniNode ?? context?.omniNode ?? null; this._inited = false; this._bound = []; this._persist = new Map(); this._tw = null; this._scanAt = 0; this._cache = new Map() }
  init () {
    if (this._inited) return; this._inited = true
    const on = (n, fn) => { const h = (e) => fn(e.detail ?? {}, e); window.addEventListener(n, h); this._bound.push([n, h]) }
    on('omni:edgenode-create', (d, e) => { const out = this.request(d); if (e.detail && typeof e.detail === 'object') e.detail.out = out })
    on('omni:node-created', (d) => this._fixNode(d.node)); on('omni:node-deleted', (d) => this._cache.delete(d.id))
    this._syncAll(); SERVICES.edgenodes = this; window.__omniEdgeNodes = this
  }
  destroy () { this.stop(); this._persist.forEach(t => clearTimeout(t)); this._persist.clear(); for (const [n, h] of this._bound) window.removeEventListener(n, h); this._bound = []; if (SERVICES.edgenodes === this) { SERVICES.edgenodes = null; if (window.__omniEdgeNodes === this) window.__omniEdgeNodes = null }; this._inited = false }
  onResize () {}

  // ── store ──
  _data (id) { return this.omniNode?.getNodeData?.(id) ?? null }
  isNode (id) { return this._data(id)?.nodeKind === KIND_EDGE }
  list () { try { return (this.omniNode?.getAllNodes?.() ?? []).filter(d => d?.nodeKind === KIND_EDGE).map(d => d.id) } catch (_) { return [] } }
  get (id) { const d = this._data(id); if (!d || d.nodeKind !== KIND_EDGE) return null; const s = M.sanitizeEdgeNode(d.edgeNode); d.edgeNode = s; return s }
  _need (id) { const s = this.get(id); if (!s) throw new Error('That is not an edge node.'); return s }
  set (id, patch, reason = 'edit') {
    const cur = this.get(id), d = this._data(id); if (!cur || !d) return { ok: false, error: 'That is not an edge node.' }
    const next = M.sanitizeEdgeNode({ ...cur, ...(patch && typeof patch === 'object' ? patch : {}) }); d.edgeNode = next
    this._cache.delete(id); this._refresh(id, true); send('omni:edgenode-changed', { nodeId: id, reason }); this._persistSoon(id); return { ok: true, edgeNode: next }
  }
  setMode (id, mode) { if (!M.MODES.includes(mode)) return { ok: false, error: 'mode must be one of: ' + M.MODES.join(', ') }; return this.set(id, { mode }, 'mode') }
  addPoint (id, pt = {}) { const c = this._need(id); if (c.points.length >= M.LIMITS.points) return { ok: false, error: 'At most ' + M.LIMITS.points + ' points.' }; return this.set(id, { points: [...c.points, { t: pt.t ?? 0.5, side: pt.side ?? 0, up: pt.up ?? 0 }] }, 'points') }
  setPoint (id, i, pt) { const c = this._need(id); if (!c.points[i]) return { ok: false, error: 'No point ' + i }; return this.set(id, { points: c.points.map((p, k) => (k === i ? { ...p, ...pt } : p)) }, 'points') }
  removePoint (id, i) { const c = this._need(id); if (!c.points[i]) return { ok: false, error: 'No point ' + i }; return this.set(id, { points: c.points.filter((_, k) => k !== i) }, 'points') }
  _persistSoon (id) { clearTimeout(this._persist.get(id)); this._persist.set(id, setTimeout(() => this.flush(id), PERSIST_MS)) }
  flush (id) { if (id) { clearTimeout(this._persist.get(id)); this._persist.delete(id) } const d = id ? this._data(id) : null; if (!d) return false; send('omni:force-save', {}); send('omni:node-updated', { id, data: d }); return true }
  _fixNode (d) { if (!d || d.nodeKind !== KIND_EDGE) return; d.edgeNode = M.sanitizeEdgeNode(d.edgeNode); this._refresh(d.id, true) }
  _syncAll () { try { for (const d of this.omniNode?.getAllNodes?.() ?? []) this._fixNode(d) } catch (_) { /* none yet */ } }

  // ── the route ──
  _posOf (id) { const m = id ? this.omniNode?.getMeshById?.(id) : null; if (!m) return null; const p = m.userData?.restPosition ?? m.position; return [p.x, p.y, p.z] }
  /** { path, A, B, spec } from the CURRENT positions of its two nodes, or null when one is gone */
  pathOf (id) {
    const s = this.get(id); if (!s) return null; const A = this._posOf(s.from), B = this._posOf(s.to); if (!A || !B) return null
    const c = this._cache.get(id); const key = JSON.stringify([A, B, s]); if (c?.key === key) return c.val
    const val = { path: M.makePath(s, A, B), A, B, spec: s }; this._cache.set(id, { key, val }); return val
  }
  _refresh (id, force = false) {
    const mesh = this.omniNode?.getMeshById?.(id); const s = this.get(id); if (!mesh || !s) return
    const r = this.pathOf(id)
    if (!r) { mesh.material.color.set('#ff7a7a'); mesh.userData.env && (mesh.userData.env.route.visible = false, mesh.userData.env.sig = ''); return }
    const mid = [(r.A[0] + r.B[0]) / 2, (r.A[1] + r.B[1]) / 2, (r.A[2] + r.B[2]) / 2]
    if (mesh.position.distanceToSquared(new THREE.Vector3(...mid)) > 1e-8) { mesh.position.set(...mid); if (mesh.userData?.restPosition) mesh.userData.restPosition.set(...mid); const d = this._data(id); if (d) d.position = mid; if (mesh.userData.env) mesh.userData.env.sig = '' }
    const ctrl = M.controlPoints(s, r.A, r.B).slice(1, -1)
    applyEdgeNodeLook(mesh, s, r.path, r.A, r.B, ctrl)
  }
  update () {
    const t = (typeof performance !== 'undefined' ? performance.now() : Date.now()); if (t < this._scanAt) return; this._scanAt = t + SCAN_MS
    for (const id of this.list()) { try { this._refresh(id) } catch (_) { /* one bad node must not stop the rest */ } }
  }
  /** the edge node between two nodes (either way round), or null */
  between (a, b) { for (const id of this.list()) { const s = this.get(id); if (s && ((s.from === a && s.to === b) || (s.twoWay && s.from === b && s.to === a))) return id } return null }
  /** { id, path, reversed, spec, seconds } for a hop from node `a` to node `b`, or null when no edge node is on it */
  routeFor (a, b) {
    const id = this.between(a, b); if (!id) return null; const r = this.pathOf(id); if (!r) return null
    const reversed = r.spec.from !== a; const path = reversed ? M.reversePath(r.path) : r.path
    return { id, path, reversed, spec: r.spec, seconds: M.rideSeconds(r.spec, r.path), dest: reversed ? r.A : r.B }
  }

  // ── riding ──
  stop () { if (this._tw) { this._tw.kill(); this._tw = null; send('omni:orbit-enable', {}) } }
  isRiding () { return !!this._tw }
  /** fly the camera along the route of an edge node ({ reverse: true } = from `to` back to `from`). Resolves true when it arrived. */
  ride (id, o = {}) {
    const s = this.get(id); const r = s ? this.pathOf(id) : null
    if (!r) return Promise.resolve({ ok: false, error: 'That edge node is not joined to two nodes.' })
    if (o.reverse && !s.twoWay) return Promise.resolve({ ok: false, error: 'This edge node is one way.' })
    return this.rideRoute({ path: o.reverse ? M.reversePath(r.path) : r.path, spec: s, seconds: M.rideSeconds(s, r.path), dest: o.reverse ? r.A : r.B }, { id })
  }
  /** fly along a route from routeFor(); also used by the Presenter. */
  rideRoute (route, { id = '' } = {}) {
    return new Promise((resolve) => {
      const cam = this.ctx?.camera; if (!cam || !route?.path?.points?.length) { resolve({ ok: false, error: 'No camera or route.' }); return }
      this.stop(); send('omni:orbit-disable', {}); send('omni:edgenode-ride', { nodeId: id, state: 'start' })
      const target = new THREE.Vector3(...route.dest); const proxy = { t: 0 }; const tmp = new THREE.Vector3(); const look = new THREE.Vector3()
      const finish = (ok) => { this._tw = null; send('omni:orbit-enable', {}); send('omni:edgenode-ride', { nodeId: id, state: ok ? 'end' : 'stopped' }); resolve({ ok: true, arrived: ok }) }
      const apply = () => {
        const p = M.pointOn(route.path, proxy.t); if (!p) return
        cam.position.set(...p.pos)
        if (route.spec?.look === 'target') look.copy(target); else look.set(p.pos[0] + p.dir[0], p.pos[1] + p.dir[1], p.pos[2] + p.dir[2])
        if (look.distanceToSquared(cam.position) > 1e-8) cam.lookAt(look)
      }
      const loops = route.spec?.loop ? -1 : 0
      this._tw = gsap.to(proxy, { t: 1, duration: route.seconds, ease: 'sine.inOut', repeat: loops, onUpdate: apply, onComplete: () => finish(true), onInterrupt: () => { send('omni:orbit-enable', {}); resolve({ ok: true, arrived: false }) } })
      void tmp
    })
  }

  // ── create ──
  _edgesOf (nodeId) { try { return (this.omniNode?.exportScene?.().edges ?? []).filter(e => e.from === nodeId || e.to === nodeId) } catch (_) { return [] } }
  request (d = {}) {
    try {
      let from = typeof d.from === 'string' ? d.from : '', to = typeof d.to === 'string' ? d.to : ''
      if ((!from || !to) && d.fromSelected !== false) {
        const sel = this.omniNode?.getSelectedId?.()
        if (sel && !this.isNode(sel)) { const e = this._edgesOf(sel).find(x => !this.between(x.from, x.to)); if (e) { from = e.from; to = e.to } }
      }
      if (!from || !to) { notify('Select a node that has a line to another node (or give from(...) and to(...)).'); return { ok: false, error: 'Select a node that has a line to another node, or give from and to.' } }
      return this.create({ ...d, from, to })
    } catch (err) { return { ok: false, error: String(err?.message ?? err) } }
  }
  create (opts = {}) {
    try {
      const o = opts && typeof opts === 'object' ? opts : {}
      const spec = M.sanitizeEdgeNode({ from: o.from, to: o.to, mode: o.mode, points: o.points, radius: o.radius, turns: o.turns, speed: o.speed, look: o.look, loop: o.loop, twoWay: o.twoWay })
      if (!spec.from || !spec.to || spec.from === spec.to) return { ok: false, error: 'An edge node needs two different nodes (from and to).' }
      const A = this._posOf(spec.from), B = this._posOf(spec.to); if (!A || !B) return { ok: false, error: 'Both nodes must exist.' }
      if (this.between(spec.from, spec.to)) return { ok: false, error: 'There is already an edge node between those two nodes.' }
      const edgeThere = this._edgesOf(spec.from).some(e => (e.from === spec.from && e.to === spec.to) || (e.from === spec.to && e.to === spec.from))
      if (!edgeThere) { try { this.omniNode?.connectNodes?.(spec.from, spec.to) } catch (_) { /* the line is a bonus */ } }
      const nodeId = typeof o.id === 'string' && /^[\w-]{1,64}$/.test(o.id) ? o.id : newId()
      if (this._data(nodeId)) return { ok: false, error: 'There is already a node called ' + nodeId }
      const mid = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2, (A[2] + B[2]) / 2]
      send('omni:node-create-request', { nodeKind: KIND_EDGE, edgeNode: spec, id: nodeId, label: String(o.label || 'Edge ' + spec.mode).slice(0, 40), geometry: GEO_EDGE, primitive: 'objective', color: spec.color, position: mid, rotation: [0, 0, 0], scale: [1, 1, 1], noParent: true, noSelect: o.select !== true })
      if (this.omniNode && !this._data(nodeId)) return { ok: false, error: 'The node could not be created.' }
      return { ok: true, nodeId }
    } catch (err) { return { ok: false, error: String(err?.message ?? err) } }
  }
}
