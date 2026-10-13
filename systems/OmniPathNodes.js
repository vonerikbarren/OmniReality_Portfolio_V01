/**
 * systems/OmniPathNodes.js — the runtime of the OmniPathNode kind (V191).
 *
 * The model (paths, members, order, undo, validation, storage) is utils/OmniPathModel.js; the node kind (data.nodeKind 'omniPath', one marker mesh
 * per path) is utils/OmniExtraKinds.js; the editor is ui/OmniNodeOrderPanel.js. This module does what needs the live scene:
 *
 *   - LINK mode recording  while a path is "recording" every node the user selects is appended to it, so "select A, then B, then C" builds the
 *                          path (a node already in the path is ignored with a note). Stops with Stop / Escape / closing the panel.
 *   - GENEALOGY mode       buildGenealogy(pathId): the members become the hierarchy under the path's root (data.parentId), pre-order or breadth first.
 *   - THE PATH LINE        a line (and a dot per member) drawn through the member nodes in order, coloured from start to end, following the nodes when
 *                          they move (checked ten times a second, only for visible paths). It is NOT an OmniNode edge: edges change the hierarchy
 *                          and the sequence logic, a path must not.
 *   - DELETED NODES        omni:node-deleted drops the node from every path (noted in the path), a path whose OmniPathNode is deleted goes with it.
 *   - Events               omni:path-create-request { name?, mode?, members?, rootId?, position?, select? } (answer in detail.out)
 *                          omni:path-record-set { pathId | null }     omni:path-goto { pathId, index } | { nodeId }
 *                          omni:path-add-selected { pathId }          omni:path-build-genealogy { pathId }
 *
 * Module contract: constructor(context, omniNode) / init (guarded against a second call) / update(delta) / destroy / onResize.
 */

import * as THREE from 'three'
import * as Paths from '../utils/OmniPathModel.js'
import { goToObject } from '../utils/CameraTravel.js'
import { KIND_PATH, GEO_PATH, SERVICES } from '../utils/OmniExtraKinds.js'

const SYNC_INTERVAL = 0.1
const PIN_DISTANCE = 6
const CAP = Paths.MAX_MEMBERS + 1
const newId = () => 'omni_' + Math.random().toString(36).slice(2, 8)
const note = (name, desc) => { try { window.dispatchEvent(new CustomEvent('omni:notify-info', { detail: { name, desc, holdMs: 3000 } })) } catch (_) { /* no window */ } }

export default class OmniPathNodes {
  constructor (context, omniNode = null) {
    this.ctx = context
    this.omniNode = omniNode
    this._inited = 0
    this._bound = []
    this._lines = new Map()   // pathId -> { line, points, geo, mat, matP, pos:Float32Array, n }
    this._recording = null    // pathId | null
    this._selectedId = null
    this._labelCache = new Map()
    this._accum = 0
    this._dirty = true
    this._tmp = new THREE.Vector3()
  }

  init () {
    this._inited++
    if (this._inited > 1) return   // BaseScene.addModule() calls init(); a second call must not double the listeners
    const on = (name, fn) => { const h = (e) => fn(e.detail ?? {}, e); window.addEventListener(name, h); this._bound.push([name, h]) }
    on('omni:node-selected', (d) => this._onSelected(d.node))
    on('omni:node-deselected', () => { this._selectedId = null })
    on('omni:node-deleted', (d) => this._onDeleted(d.id))
    on('omni:nodes-updated', (d) => { for (const n of d?.nodes ?? []) if (n?.id) this._labelCache.set(n.id, n.label ?? ''); this._dirty = true })
    on('omni:scene-clear-request', () => { this.stopRecording(); Paths.listPaths().forEach(p => Paths.deletePath(p.id)); this._dirty = true })
    on(Paths.CHANGED_EVENT, (d) => { this._dirty = true; if (d.reason === 'rename') this._renameNode(d.id) })
    on('omni:path-create-request', (d, e) => { const out = this.createPathNode(d); if (e.detail && typeof e.detail === 'object') e.detail.out = out })
    on('omni:path-record-set', (d) => { if (d.pathId) this.startRecording(d.pathId); else this.stopRecording() })
    on('omni:path-goto', (d) => { if (d.pathId != null) this.jumpToIndex(d.pathId, d.index ?? 0); else if (d.nodeId) this.jumpTo(d.nodeId) })
    on('omni:path-add-selected', (d) => this.addSelected(d.pathId))
    on('omni:path-build-genealogy', (d) => this.buildGenealogy(d.pathId))
    const esc = (e) => { if (e.key === 'Escape' && this._recording) this.stopRecording() }
    document.addEventListener('keydown', esc); this._bound.push(['keydown', esc, document])
    this._syncNodes()
    SERVICES.paths = this
  }

  update (delta) {
    this._accum += delta || 0
    if (this._accum < SYNC_INTERVAL && !this._dirty) return
    this._accum = 0
    this._syncLines()
  }

  onResize () {}

  destroy () {
    if (!this._inited) return
    this._bound.forEach(([n, h, t]) => (t ?? window).removeEventListener(n, h))
    this._bound = []
    for (const id of [...this._lines.keys()]) this._removeLine(id)
    this._recording = null
    if (SERVICES.paths === this) SERVICES.paths = null
    this._inited = 0
  }

  // ── Reading the scene ───────────────────────────────────────────────────────

  _syncNodes () {
    try { for (const n of this.omniNode?.getAllNodes?.() ?? []) this._labelCache.set(n.id, n.label ?? '') } catch (_) { /* no nodes yet */ }
  }
  get selectedId () { return this._selectedId }
  get recordingId () { return this._recording }
  /** { exists, label, kind } for a node id (never throws). */
  nodeInfo (id) {
    const d = this.omniNode?.getNodeData?.(id) ?? null
    return { exists: !!d, label: d?.label ?? this._labelCache.get(id) ?? id, kind: d?.nodeKind ?? null, parentId: d?.parentId ?? null }
  }
  /** [{id,parentId}] of every node (for the genealogy order). */
  hierarchy () { return (this.omniNode?.getAllNodes?.() ?? []).map(d => ({ id: d.id, parentId: d.parentId ?? null })) }

  // ── Creating ────────────────────────────────────────────────────────────────

  _frontOfCamera () {
    const cam = this.ctx.camera
    const dir = new THREE.Vector3(); cam.getWorldDirection(dir)
    const p = cam.position.clone().addScaledVector(dir, PIN_DISTANCE)
    return [p.x, Math.max(0.6, p.y), p.z]
  }

  /** New path + its OmniPathNode. Returns { ok, pathId, nodeId } or { ok:false, error }. */
  createPathNode (opts = {}) {
    try {
      const r = Paths.createPath({ name: opts.name, mode: opts.mode, order: opts.order, rootId: opts.rootId, members: opts.members })
      if (!r.ok) return r
      const nodeId = newId()
      Paths.setNodeId(r.id, nodeId)   // before the node exists, so a delete can always find its path
      window.dispatchEvent(new CustomEvent('omni:node-create-request', { detail: {
        nodeKind: KIND_PATH, pathId: r.id, id: nodeId, label: r.path.name, geometry: GEO_PATH, primitive: 'objective', color: r.path.color,
        position: opts.position ?? this._frontOfCamera(), rotation: [0, 0, 0], scale: [1, 1, 1], noParent: true, noSelect: opts.select !== true,
      } }))
      if (!this.omniNode?.getNodeData?.(nodeId)) {
        // no OmniNode in this context (or the request was refused): do not leave a path without its node
        if (this.omniNode) { Paths.deletePath(r.id); return { ok: false, error: 'The path node could not be created.' } }
      }
      return { ok: true, pathId: r.id, nodeId }
    } catch (err) { return { ok: false, error: String(err?.message ?? err) } }
  }

  _renameNode (pathId) {
    const p = Paths.getPath(pathId)
    if (p?.nodeId) window.dispatchEvent(new CustomEvent('omni:node-label-set', { detail: { id: p.nodeId, label: p.name } }))
  }

  // ── Recording (LINK mode) ───────────────────────────────────────────────────

  startRecording (pathId) {
    const p = Paths.getPath(pathId)
    if (!p) return false
    this._recording = pathId
    Paths.setActive(pathId)
    if (p.mode !== 'link') Paths.setMode(pathId, 'link')
    note('Path recording', `Select nodes one after another: each one is added to "${p.name}". Escape or Stop ends it.`)
    window.dispatchEvent(new CustomEvent('omni:path-recording-changed', { detail: { pathId } }))
    return true
  }
  stopRecording () {
    if (!this._recording) return false
    this._recording = null
    window.dispatchEvent(new CustomEvent('omni:path-recording-changed', { detail: { pathId: null } }))
    return true
  }

  _onSelected (node) {
    const id = node?.id ?? null
    this._selectedId = id
    if (!id) return
    if (node.nodeKind === KIND_PATH && node.pathId && Paths.getPath(node.pathId)) { Paths.setActive(node.pathId); return }
    if (!this._recording) return
    const p = Paths.getPath(this._recording)
    if (!p) { this._recording = null; return }
    if (id === p.nodeId) return
    const r = Paths.append(p.id, id)
    if (!r.ok) note('Path', r.duplicate ? `"${node.label ?? id}" is already in "${p.name}".` : r.error)
  }

  /** Append the currently selected node to a path. Returns the model result. */
  addSelected (pathId) {
    const p = Paths.getPath(pathId ?? Paths.getActiveId())
    if (!p) return { ok: false, error: 'No path.' }
    if (!this._selectedId) return { ok: false, error: 'Select a node in the scene first.' }
    if (this._selectedId === p.nodeId) return { ok: false, error: 'That is the path node itself.' }
    return Paths.append(p.id, this._selectedId)
  }

  // ── Genealogy ───────────────────────────────────────────────────────────────

  useSelectedAsRoot (pathId) {
    if (!this._selectedId) return { ok: false, error: 'Select a node in the scene first.' }
    return Paths.setRoot(pathId, this._selectedId)
  }
  buildGenealogy (pathId) {
    const id = pathId ?? Paths.getActiveId()
    const r = Paths.buildFromGenealogy(id, this.hierarchy())
    if (!r.ok && r.error) note('Path', r.error)
    return r
  }

  // ── Moving the camera ───────────────────────────────────────────────────────

  /** Select the node and fly the camera to it (the same two calls the node list and the Inspector use). */
  jumpTo (nodeId) {
    const mesh = this.omniNode?.getMeshById?.(nodeId)
    if (!mesh) { note('Path', 'That node does not exist any more.'); return false }
    window.dispatchEvent(new CustomEvent('omni:node-select-by-id', { detail: { id: nodeId } }))
    try { goToObject(this.ctx, mesh) } catch (_) { /* camera move is a nicety */ }
    return true
  }
  jumpToIndex (pathId, index) {
    const p = Paths.getPath(pathId)
    const id = p?.members[index]
    return id ? this.jumpTo(id) : false
  }

  // ── Deleted nodes ───────────────────────────────────────────────────────────

  _onDeleted (id) {
    if (this._recording && Paths.getPath(this._recording)?.nodeId === id) this.stopRecording()
    const r = Paths.dropNode(id, this._labelCache.get(id) ?? '')
    if (r.dropped.length) note('Path', `A deleted node was removed from ${r.dropped.length} path${r.dropped.length > 1 ? 's' : ''}.`)
    this._labelCache.delete(id)
    this._dirty = true
  }

  // ── The line ────────────────────────────────────────────────────────────────

  _makeLine (p) {
    const geo = new THREE.BufferGeometry()
    const pos = new Float32Array(CAP * 3); const col = new Float32Array(CAP * 3)
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage))
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage))
    geo.setDrawRange(0, 0)
    const mat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.8, depthTest: false })
    const matP = new THREE.PointsMaterial({ vertexColors: true, size: 7, sizeAttenuation: false, transparent: true, opacity: 0.95, depthTest: false })
    const line = new THREE.Line(geo, mat); const points = new THREE.Points(geo, matP)
    for (const o of [line, points]) { o.frustumCulled = false; o.renderOrder = 6; o.userData.isPathLine = true; o.userData.pathId = p.id; this.ctx.scene.add(o) }
    const rec = { line, points, geo, mat, matP, pos, col, n: 0, sig: '' }
    this._lines.set(p.id, rec)
    return rec
  }

  _removeLine (id) {
    const r = this._lines.get(id)
    if (!r) return
    this.ctx.scene.remove(r.line); this.ctx.scene.remove(r.points)
    r.geo.dispose(); r.mat.dispose(); r.matP.dispose()
    this._lines.delete(id)
  }

  _syncLines () {
    this._dirty = false
    const paths = Paths.listPaths()
    const live = new Set(paths.map(p => p.id))
    for (const id of [...this._lines.keys()]) if (!live.has(id)) this._removeLine(id)
    const active = Paths.getActiveId()
    for (const p of paths) {
      if (!p.visible || p.members.length < 1) { const r = this._lines.get(p.id); if (r) { r.line.visible = false; r.points.visible = false; r.n = 0; r.sig = '' } continue }
      const rec = this._lines.get(p.id) ?? this._makeLine(p)
      const pts = []
      for (const m of p.members) {
        const mesh = this.omniNode?.getMeshById?.(m)
        if (!mesh) continue   // a missing member is skipped in the line (the panel flags it)
        mesh.getWorldPosition(this._tmp)
        pts.push(this._tmp.x, this._tmp.y, this._tmp.z)
      }
      if (p.closed && pts.length >= 9) pts.push(pts[0], pts[1], pts[2])
      const n = Math.min(CAP, pts.length / 3)
      const sig = n + '|' + p.color + '|' + pts.map(v => Math.round(v * 100)).join(',')
      rec.line.visible = rec.points.visible = n > 0
      rec.mat.opacity = p.id === active ? 0.95 : 0.55
      if (sig === rec.sig) continue
      rec.sig = sig; rec.n = n
      const c0 = new THREE.Color(p.color); const c1 = new THREE.Color(0xffd27f)
      const c = new THREE.Color()
      for (let i = 0; i < n; i++) {
        rec.pos[i * 3] = pts[i * 3]; rec.pos[i * 3 + 1] = pts[i * 3 + 1]; rec.pos[i * 3 + 2] = pts[i * 3 + 2]
        c.copy(c0).lerp(c1, n > 1 ? i / (n - 1) : 0)
        rec.col[i * 3] = c.r; rec.col[i * 3 + 1] = c.g; rec.col[i * 3 + 2] = c.b
      }
      rec.geo.setDrawRange(0, n)
      rec.geo.attributes.position.needsUpdate = true; rec.geo.attributes.color.needsUpdate = true
    }
  }

  /** For tests / the dev panel: how many path lines exist and how many points each draws. */
  getStats () { return { lines: this._lines.size, points: [...this._lines.values()].map(r => r.n), recording: this._recording } }
}
