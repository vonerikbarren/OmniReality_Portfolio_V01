/**
 * systems/OmniStoredReality.js (V277) — the runtime of the StoredRealityNode: "the course as a whole", kept in ONE node so a busy area costs one small mesh instead of hundreds.
 *   STORE   store(id, {ids}) takes nodes (the given ids, else every node inside the box, else the selection) out of the scene and keeps them inside the node. The box shows a point-cloud of what it holds.
 *   EXPAND  expand(id) puts the nodes back around the box (the same ids, the same lines) and the box turns into a faint frame. store() again keeps them again (the members are the same ones).
 *   A stored reality can live in a voxel room (data.room 'x,y,z'): placeInRoom(id, key) moves the box to the centre of that room (a room is a fixed 20-unit cube, so the box always fits).
 *   SERVICES.storedreality: create(opts) get(id) set(id, patch) store(id, opts) expand(id) toggle(id) placeInRoom(id, key) info(id) list()
 *   Events out: omni:stored-reality-changed { nodeId, reason }.   In: omni:stored-reality-node-create { ...opts } (answer in detail.out).
 */
import * as THREE from 'three'
import * as M from '../utils/OmniStoredRealityModel.js'
import { cellKey, parseKey, ROOM_SIZE } from '../utils/OmniVoxelGrid.js'
import { KIND_STORED_REALITY, GEO_STORED_REALITY, KIND_VOXEL, SERVICES } from '../utils/OmniExtraKinds.js'
import * as MBTA from '../data/OmniMbtaCourse.js'
import { applyStoredRealityLook } from '../utils/OmniStoredRealityNodeMesh.js'

const PIN_DISTANCE = 9, PERSIST_MS = 300
const send = (n, d) => { try { window.dispatchEvent(new CustomEvent(n, { detail: d })) } catch (_) { /* no window */ } }
const newId = () => 'omni_' + Math.random().toString(36).slice(2, 8)

export default class OmniStoredReality {
  constructor (context, omniNode = null) { this.ctx = context; this.omniNode = omniNode ?? context?.omniNode ?? null; this._inited = false; this._bound = []; this._persist = new Map() }
  init () {
    if (this._inited) return; this._inited = true
    const on = (n, fn) => { const h = (e) => fn(e.detail ?? {}, e); window.addEventListener(n, h); this._bound.push([n, h]) }
    on('omni:stored-reality-node-create', (d, e) => { const out = this.create(d); if (e.detail && typeof e.detail === 'object') e.detail.out = out })
    on('omni:stored-reality-example', (d, e) => { const out = this.buildExample(d.name || 'mbta', d); if (e.detail && typeof e.detail === 'object') e.detail.out = out; send('omni:notify-info', { name: 'Stored reality', desc: out.ok ? (out.already ? 'The MBTA course is already in this scene.' : 'Made the MBTA course in front of you, stored in one box. Select the box and press Expand to walk it.') : out.error, holdMs: 5000 }) })
    on('omni:node-created', (d) => this._fixNode(d.node))
    this._syncAll(); SERVICES.storedreality = this
  }
  destroy () { this._persist.forEach(t => clearTimeout(t)); this._persist.clear(); for (const [n, h] of this._bound) window.removeEventListener(n, h); this._bound = []; if (SERVICES.storedreality === this) SERVICES.storedreality = null; this._inited = false }
  onResize () {}
  update () {}

  // ── store ──
  _data (id) { return this.omniNode?.getNodeData?.(id) ?? null }
  isNode (id) { return this._data(id)?.nodeKind === KIND_STORED_REALITY }
  list () { try { return (this.omniNode?.getAllNodes?.() ?? []).filter(d => d?.nodeKind === KIND_STORED_REALITY).map(d => d.id) } catch (_) { return [] } }
  get (id) { const d = this._data(id); if (!d || d.nodeKind !== KIND_STORED_REALITY) return null; if (!d.storedReality?.__ok) { d.storedReality = Object.defineProperty(M.sanitizeStoredReality(d.storedReality), '__ok', { value: true, enumerable: false, configurable: true, writable: true }) } return d.storedReality }
  _commit (id, next, reason) {
    const d = this._data(id); Object.defineProperty(next, '__ok', { value: true, enumerable: false, configurable: true, writable: true }); d.storedReality = next
    this._refresh(id); send('omni:stored-reality-changed', { nodeId: id, reason }); this._persistSoon(id)
  }
  set (id, patch, reason = 'edit') {
    const cur = this.get(id); if (!cur) return { ok: false, error: 'That is not a stored reality node.' }
    const p = patch && typeof patch === 'object' ? patch : {}
    const next = M.sanitizeStoredReality({ ...cur, name: p.name ?? cur.name, summary: p.summary ?? cur.summary, scale: p.scale ?? cur.scale })
    this._commit(id, next, reason); const d = this._data(id); if (typeof p.name === 'string' && next.name) d.label = next.name.slice(0, 40)
    return { ok: true, storedReality: next }
  }
  _persistSoon (id) { clearTimeout(this._persist.get(id)); this._persist.set(id, setTimeout(() => this.flush(id), PERSIST_MS)) }
  flush (id) { if (id) { clearTimeout(this._persist.get(id)); this._persist.delete(id) } const d = id ? this._data(id) : null; if (!d) return false; send('omni:force-save', {}); send('omni:node-updated', { id, data: d }); return true }
  _fixNode (d) { if (!d || d.nodeKind !== KIND_STORED_REALITY) return; this.get(d.id); this._refresh(d.id) }
  _syncAll () { try { for (const d of this.omniNode?.getAllNodes?.() ?? []) this._fixNode(d) } catch (_) { /* none yet */ } }
  _refresh (id) { const mesh = this.omniNode?.getMeshById?.(id); const s = this.get(id); if (mesh && s) applyStoredRealityLook(mesh, s) }
  _pos (id) { const m = this.omniNode?.getMeshById?.(id); return m ? m.position.toArray() : [0, 0, 0] }
  info (id) {
    const s = this.get(id); if (!s) return null
    return { name: s.name, state: s.state, count: s.state === 'stored' ? s.payload.nodes.length : s.members.length, edges: s.preview.edges, kinds: s.preview.kinds, labels: s.preview.labels, room: s.room, scale: s.scale }
  }

  // ── store / expand ──
  /** which nodes would be stored: opts.ids, else the nodes inside the box, else the selection */
  members (id, opts = {}) {
    const all = this.omniNode?.getAllNodes?.() ?? []
    const skip = (d) => !d || d.id === id || d.nodeKind === KIND_VOXEL
    if (Array.isArray(opts.ids) && opts.ids.length) return opts.ids.filter(i => typeof i === 'string' && !skip(this._data(i)))
    const s = this.get(id); const c = this._pos(id); const h = (s?.scale ?? 6) / 2
    const inside = all.filter(d => { if (skip(d)) return false; const p = (this.omniNode.getMeshById?.(d.id)?.userData?.restPosition ?? this.omniNode.getMeshById?.(d.id)?.position); return p && Math.abs(p.x - c[0]) <= h && Math.abs(p.y - c[1]) <= h && Math.abs(p.z - c[2]) <= h })
    if (inside.length) return inside.map(d => d.id)
    const sel = this.omniNode?.getSelectedId?.(); return sel && !skip(this._data(sel)) ? [sel] : []
  }
  store (id, opts = {}) {
    try {
      const cur = this.get(id); if (!cur) return { ok: false, error: 'That is not a stored reality node.' }
      const ids = cur.state === 'expanded' && !(opts.ids?.length) ? cur.members.filter(i => this._data(i)) : this.members(id, opts)
      if (!ids.length) return { ok: false, error: 'There is nothing to store: put nodes inside the box, select some, or give their ids.' }
      const anchor = this._pos(id); const scene = this.omniNode.exportScene()
      const payload = M.pack(scene, ids, anchor, id)
      if (!payload.nodes.length) return { ok: false, error: 'Those nodes could not be stored.' }
      const next = M.sanitizeStoredReality({ ...cur, state: 'stored', payload, members: [], preview: M.previewOf(payload.nodes, payload.edges) })
      if (!next.payload.nodes.length) return { ok: false, error: 'That is too much to store in one node.' }
      for (const n of payload.nodes) send('omni:node-delete-request', { id: n.id })
      this._commit(id, next, 'store'); this.flush(id)
      return { ok: true, stored: next.payload.nodes.length }
    } catch (err) { return { ok: false, error: String(err?.message ?? err) } }
  }
  expand (id) {
    try {
      const cur = this.get(id); if (!cur) return { ok: false, error: 'That is not a stored reality node.' }
      if (cur.state === 'expanded') return { ok: true, expanded: cur.members.length, already: true }
      const clash = cur.payload.nodes.filter(n => this._data(n.id)).map(n => n.id)
      if (clash.length) return { ok: false, error: 'These ids are already in the scene: ' + clash.slice(0, 3).join(', ') }
      const scene = M.unpack(cur.payload, this._pos(id))
      this.omniNode.importScene(scene, { mode: 'merge' })
      const next = M.sanitizeStoredReality({ ...cur, state: 'expanded', payload: { nodes: [], edges: [] }, members: scene.nodes.map(n => n.id) })
      this._commit(id, next, 'expand'); this.flush(id)
      return { ok: true, expanded: scene.nodes.length }
    } catch (err) { return { ok: false, error: String(err?.message ?? err) } }
  }
  toggle (id) { const s = this.get(id); return !s ? { ok: false, error: 'That is not a stored reality node.' } : s.state === 'stored' ? this.expand(id) : this.store(id) }

  // ── the voxel it lives in ──
  placeInRoom (id, key) {
    const c = parseKey(String(key)); const s = this.get(id); const mesh = this.omniNode?.getMeshById?.(id)
    if (!c || !s || !mesh) return { ok: false, error: 'That is not a room, or not a stored reality node.' }
    if (s.state === 'expanded') return { ok: false, error: 'Store it first; then it can move to a room.' }
    const centre = [c.x * ROOM_SIZE + ROOM_SIZE / 2, c.y * ROOM_SIZE + ROOM_SIZE / 2, c.z * ROOM_SIZE + ROOM_SIZE / 2]
    mesh.position.set(...centre); if (mesh.userData) mesh.userData.restPosition = mesh.position.clone()
    const d = this._data(id); if (d) d.position = centre
    this._commit(id, M.sanitizeStoredReality({ ...s, room: cellKey(c.x, c.y, c.z), scale: Math.min(s.scale, ROOM_SIZE - 2) }), 'room')
    return { ok: true, room: cellKey(c.x, c.y, c.z) }
  }

  // ── examples ──
  /** Build a whole course in the scene and keep it stored in ONE box (Expand lays it out). Today: 'mbta' (data/OmniMbtaCourse.js). Building it twice adds nothing. */
  buildExample (name = 'mbta', o = {}) {
    try {
      if (String(name).toLowerCase() !== 'mbta') return { ok: false, error: 'Examples: mbta' }
      if (this.isNode(MBTA.COURSE.id)) return { ok: true, nodeId: MBTA.COURSE.id, already: true }
      const EP = SERVICES.epistemics; if (!EP) return { ok: false, error: 'The epistemics module is not running.' }
      const clash = [...MBTA.NODES, ...MBTA.sourceNodes()].filter(n => this._data(n.id)).map(n => n.id); if (clash.length || this._data(MBTA.COURSE.id)) return { ok: false, error: 'Some ids of this course are already in the scene.' }
      const anchor = this._positionFor(o); const made = []
      const undo = () => { for (const id of made) send('omni:node-delete-request', { id }) }
      const box = this.create({ id: MBTA.COURSE.id, name: MBTA.COURSE.name, summary: MBTA.COURSE.summary, scale: MBTA.COURSE.scale, position: anchor, select: false }); if (!box.ok) return box
      made.push(MBTA.COURSE.id)
      for (const n of MBTA.NODES) {
        const r = EP.create({ id: n.id, layer: n.layer, text: n.text, source: n.source, note: n.note, position: MBTA.positionOf(n, anchor) })
        if (!r.ok) { undo(); return { ok: false, error: r.error } }
        made.push(n.id)
      }
      for (const l of MBTA.EDGES) EP._line(l.from, l.to, l.meaning)
      const SRC = SERVICES.sources; const srcs = SRC ? MBTA.sourceNodes() : []   // V281: shared sources, cited by the nodes that rest on them
      for (const sn of srcs) {
        const r = SRC.create({ id: sn.id, ...sn.spec, position: MBTA.positionOf(sn, anchor), select: false })
        if (!r.ok) { undo(); return { ok: false, error: r.error } }
        made.push(sn.id)
      }
      for (const sn of srcs) for (const c of sn.citedBy) SRC.link(c, sn.id)
      const st = this.store(MBTA.COURSE.id, { ids: [...MBTA.NODES.map(n => n.id), ...srcs.map(x => x.id)] }); if (!st.ok) { undo(); return st }
      return { ok: true, nodeId: MBTA.COURSE.id, stored: st.stored }
    } catch (err) { return { ok: false, error: String(err?.message ?? err) } }
  }

  // ── create ──
  _positionFor (o) {
    const p = o.position; if (Array.isArray(p) && p.length >= 3 && p.slice(0, 3).every(Number.isFinite)) return [p[0], p[1], p[2]]
    const cam = this.ctx.camera; const dir = new THREE.Vector3(); cam.getWorldDirection(dir); const q = cam.position.clone().addScaledVector(dir, PIN_DISTANCE); return [q.x, q.y, q.z]
  }
  create (opts = {}) {
    try {
      const o = opts && typeof opts === 'object' ? opts : {}
      const sr = M.sanitizeStoredReality({ name: o.name, summary: o.summary, scale: o.scale, state: 'stored' })
      const nodeId = typeof o.id === 'string' && /^[\w-]{1,64}$/.test(o.id) ? o.id : newId()
      if (this._data(nodeId)) return { ok: false, error: 'There is already a node called ' + nodeId }
      send('omni:node-create-request', { nodeKind: KIND_STORED_REALITY, storedReality: sr, id: nodeId, label: sr.name.slice(0, 40), geometry: GEO_STORED_REALITY, primitive: 'objective', color: '#9fd2ff', position: this._positionFor(o), rotation: [0, 0, 0], scale: [1, 1, 1], noParent: true, noSelect: o.select !== true })
      if (this.omniNode && !this._data(nodeId)) return { ok: false, error: 'The node could not be created.' }
      if (Array.isArray(o.ids) && o.ids.length) { const r = this.store(nodeId, { ids: o.ids }); if (!r.ok) return { ok: true, nodeId, warning: r.error } }
      return { ok: true, nodeId }
    } catch (err) { return { ok: false, error: String(err?.message ?? err) } }
  }
}
