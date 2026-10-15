/**
 * systems/OmniDocNodes.js — the runtime of the DocNode kind (V203), built like systems/OmniMixNodes.js.
 *
 * The model is utils/OmniDocModel.js (pure), the page pixels come from systems/OmniDocRaster.js (a 2D canvas: pdf.js, markdown layout, images), the node kind (data.nodeKind 'docNode', a thin sheet)
 * is utils/OmniExtraKinds.js + utils/OmniDocNodeMesh.js. This module does what needs the live scene:
 *   - CREATING   omni:doc-node-create { position?, at?, label?, select?, doc?, id? } (answer in detail.out { ok, nodeId }). An ordinary OmniNode (omni:node-create-request), turned to face the camera (top edge up on screen, even when looking straight down).
 *   - LEVEL OF DETAIL  4 times a second (not every frame): for every sheet that is near enough, inside the view and visible, work out how many pixels wide its page needs to be
 *                (rasterWidthFor), share the global pixel budget between all sheets (planBudget: farthest shrink first), and redraw ONLY the sheets whose page / document / size step changed.
 *                A sheet that is far, off screen, hidden or over budget drops its texture. At rest (nobody moving, nothing changed) the whole thing costs one cheap loop and zero GPU work.
 *   - THE STORE  getDoc / commit / edit / undo / redo / beginStroke (like the mix store): what the ⟐OmniDoc panel and the Inspector read and write.
 *   - PAGES      turn(id, dir) / goto(id, page); omni:doc-turn { nodeId, dir | page }. Events: omni:doc-changed { nodeId, reason }, omni:doc-status { nodeId, status, text }.
 *   - LIBRARY    listSources() -> { guide, library } for the pickers; attachFile(id, file) imports a file into utils/OmniDocAssets.js and shows it.
 * Module contract: constructor(context, omniNode) / init (guarded) / update(delta) / destroy / onResize. User-facing: imports no Dev* module.
 */

import * as THREE from 'three'
import * as D from '../utils/OmniDocModel.js'
import { KIND_DOC, GEO_DOC, SERVICES } from '../utils/OmniExtraKinds.js'
import { liveDocMeshes, applyDocLook, setPageCanvas, clearPage } from '../utils/OmniDocNodeMesh.js'
import { createDocRaster } from './OmniDocRaster.js'

const PIN_DISTANCE = 7
const PERSIST_MS = 300
export const UNDO_MAX = 100
const COALESCE_MS = 900
const NODE_COLOR = '#9ad0ff'
const LOD_INTERVAL = 0.25          // seconds between level-of-detail passes
const RETRY_MS = 10000
const FAR = 300                    // beyond this distance a sheet is never drawn
export const BUDGET_DESKTOP = 24e6 // texture pixels (width x height) across all sheets
export const BUDGET_PHONE = 8e6
const newId = () => 'omni_' + Math.random().toString(36).slice(2, 8)
const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())

export default class OmniDocNodes {
  constructor (context, omniNode = null, opts = {}) {
    this.ctx = context
    this.omniNode = omniNode
    this._raster = opts.raster ?? null
    this._assets = opts.assets ?? null
    this._inited = 0
    this._bound = []
    this._selectedId = null
    this._persist = new Map()
    this._undo = new Map(); this._redo = new Map()
    this._sane = new WeakMap()
    this._coalesce = null; this._stroke = null
    this._state = new Map()          // nodeId -> { token, key, openFor, status, pendingStep, lastDoc }
    this._lodT = 0
    this._library = []
    this._frustum = new THREE.Frustum(); this._pm = new THREE.Matrix4(); this._sph = new THREE.Sphere()
    this._stats = { renders: 0, skipped: 0, passes: 0 }
    this._budget = opts.budget ?? null
    this._maxTexture = opts.maxTexture ?? null
  }

  init () {
    this._inited++
    if (this._inited > 1) return
    const on = (name, fn) => { const h = (e) => fn(e.detail ?? {}, e); window.addEventListener(name, h); this._bound.push([name, h]) }
    on('omni:doc-node-create', (d, e) => { const out = this.createDocNode(d); if (e.detail && typeof e.detail === 'object') e.detail.out = out })
    on('omni:node-selected', (d) => { this._selectedId = d.node?.id ?? null })
    on('omni:node-deselected', () => { this._selectedId = null })
    on('omni:node-created', (d) => this._fixNode(d.node))
    on('omni:node-deleted', (d) => this._onDeleted(d.id))
    on('omni:doc-turn', (d) => { if (!d.nodeId) return; if (Number.isFinite(d.page)) this.goto(d.nodeId, d.page); else this.turn(d.nodeId, d.dir < 0 ? -1 : 1) })
    on('omni:doc-assets-changed', (d) => { this._refreshLibrary(); if (d.action === 'remove') this._invalidateAll() })
    if (!this._raster) this._raster = createDocRaster({ getBytes: (id) => this._getBytes(id) })
    this._ensureAssets()
    this._syncAll()
    SERVICES.doc = this
  }

  _ensureAssets () {
    if (this._assets) { this._refreshLibrary(); return }
    import('../utils/OmniDocAssets.js').then((m) => { this._assets = m.default ?? m.DocAssets; this._refreshLibrary() }, () => {})
  }
  async _getBytes (id) { try { if (!this._assets) await this._ensureAssetsAsync(); return await this._assets?.getBytes?.(id) ?? null } catch (_) { return null } }
  async _ensureAssetsAsync () { if (!this._assets) { const m = await import('../utils/OmniDocAssets.js'); this._assets = m.default ?? m.DocAssets } }
  _refreshLibrary () {
    const a = this._assets; if (!a || typeof a.list !== 'function') return
    Promise.resolve(a.list()).then((l) => {
      if (!Array.isArray(l)) return
      this._library = l.map(x => ({ id: String(x.id), name: String(x.name || x.id), type: String(x.type || 'text'), size: Number(x.size) || 0 }))
      try { window.dispatchEvent(new CustomEvent('omni:doc-sources-changed', { detail: {} })) } catch (_) { /* no window */ }
    }, () => {})
  }
  _invalidateAll () { for (const st of this._state.values()) { if (st.key) this._raster?.close?.(st.key); st.key = ''; st.openFor = ''; st.failed = ''; st.stale = true }; this._dirty = true }

  // ── Per frame: level of detail ──────────────────────────────────────────────
  update (delta) {
    const meshes = liveDocMeshes()
    if (!meshes.size) return
    this._lodT += Math.max(0, Number(delta) || 0)
    if (this._lodT < LOD_INTERVAL && !this._dirty) return
    this._lodT = 0; this._dirty = false
    this._pass(meshes)
  }

  _env () {
    const cam = this.ctx?.camera; const r = this.ctx?.renderer
    const vh = r?.domElement?.clientHeight || (typeof window !== 'undefined' ? window.innerHeight : 800) || 800
    const vw = r?.domElement?.clientWidth || (typeof window !== 'undefined' ? window.innerWidth : 1200) || 1200
    const phone = Math.min(vw, vh) < 600 || (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches)
    const dpr = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, phone ? 2 : 2)
    const hw = r?.capabilities?.maxTextureSize || 4096
    const maxTex = this._maxTexture ?? (phone ? 1024 : Math.min(2048, hw >= 4096 ? 2048 : 1024))
    return { cam, vh, dpr, phone, maxTex: D.RASTER_STEPS.includes(maxTex) ? maxTex : 1024, fov: cam?.fov ?? 60, budget: this._budget ?? (phone ? BUDGET_PHONE : BUDGET_DESKTOP) }
  }

  /** One level-of-detail pass over every live sheet. Exposed for tests. */
  _pass (meshes = liveDocMeshes()) {
    const env = this._env(); const cam = env.cam
    this._stats.passes++
    let frustumOk = false
    if (cam?.projectionMatrix && cam.matrixWorldInverse) { this._pm.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse); this._frustum.setFromProjectionMatrix(this._pm); frustumOk = true }
    const reqs = []; const by = new Map()
    for (const mesh of meshes) {
      const v = mesh.userData.dnv; const id = mesh.userData.nodeId
      if (!v || !id) continue
      const doc = this.getDoc(id); if (!doc) continue
      let st = this._state.get(id); if (!st) { st = { token: 0, key: '', openFor: '', status: 'idle', pending: false, lastDoc: null, wantStep: 0 }; this._state.set(id, st) }
      if (st.lastDoc !== doc) { applyDocLook(mesh, doc); st.lastDoc = doc }
      let step = 0; let dist = 1e9
      const visible = mesh.visible !== false && this._worldVisible(mesh)
      if (visible && doc.source.type !== 'none') {
        mesh.updateWorldMatrix?.(true, false)
        const e = mesh.matrixWorld.elements
        dist = cam ? Math.hypot(e[12] - cam.position.x, e[13] - cam.position.y, e[14] - cam.position.z) : 5
        const sx = Math.hypot(e[0], e[1], e[2]); const sy = Math.hypot(e[4], e[5], e[6])
        const sheetW = doc.width * sx
        const radius = 0.5 * Math.hypot(doc.width * sx, doc.width * doc.aspect * sy)
        const inView = !frustumOk || (this._sph.set(this._v3(e), radius), this._frustum.intersectsSphere(this._sph))
        // distance to the near edge of the sheet, not its centre, so a big sheet you stand next to is sharp
        const nearDist = Math.max(0.3, dist - radius * 0.5)
        if (inView && dist < FAR) {
          step = D.rasterWidthFor({ distance: nearDist, sheetWidth: sheetW, fovDeg: env.fov, viewportHeightPx: env.vh, dpr: env.dpr, quality: doc.quality, maxTexture: env.maxTex, current: v.drawn.step })
        }
      }
      st.wantStep = step
      reqs.push({ id, want: step, aspect: doc.aspect, distance: dist })
      by.set(id, { mesh, doc, st, v })
    }
    const plan = D.planBudget(reqs, env.budget)
    for (const [id, o] of by) this._apply(id, o.mesh, o.doc, o.st, o.v, plan[id] ?? 0)
  }
  _v3 (e) { return (this._tmp ??= new THREE.Vector3()).set(e[12], e[13], e[14]) }
  _worldVisible (mesh) { let o = mesh; while (o) { if (o.visible === false) return false; o = o.parent } return true }

  _apply (id, mesh, doc, st, v, step) {
    const key = `${doc.source.type}:${doc.source.id}`
    if (doc.source.type === 'none') { if (v.drawn.step) clearPage(mesh); this._status(id, st, 'empty', 'No document yet. Choose one in ⟐OmniDoc.'); return }
    if (step === 0) { if (v.drawn.step) clearPage(mesh); if (st.pending) { st.token++; st.pending = false; st.pendingKey = '' } return }   // a render still running is told it is stale
    // a source that failed to open is not retried every pass: only after RETRY_MS (the network may come back), or when the source / library changes
    if (st.failed === key && nowMs() - (st.failedAt ?? 0) < RETRY_MS) return
    // the source must be opened (once per source) before a page can be drawn
    if (st.openFor !== key) {
      st.openFor = key; st.key = ''; const tok = ++st.token
      this._status(id, st, 'loading', 'Opening…')
      this._raster.open(doc.source).then((h) => {
        if (st.openFor !== key || !this._state.has(id)) return
        if (!h.ok) { st.openFor = ''; st.failed = key; st.failedAt = nowMs(); this._status(id, st, 'error', h.error || 'That document could not be opened.'); return }
        st.key = h.key; st.failed = ''
        const cur = this.getDoc(id)
        if (cur && (cur.pages !== h.pages || Math.abs(cur.aspect - h.aspect) > 0.002)) this._setMeta(id, h.pages, h.aspect)
        this._status(id, st, 'ready', '')
        this._dirty = true
      }, () => { st.openFor = ''; st.failed = key; st.failedAt = nowMs(); this._status(id, st, 'error', 'That document could not be opened.') })
      return
    }
    if (!st.key) return                                              // still opening
    const page = Math.min(doc.page, doc.pages || doc.page)
    const dr = v.drawn
    if (dr.key === st.key && dr.page === page && dr.step === step && !st.stale) return
    const want = `${st.key}|${page}|${step}`
    if (st.pending && st.pendingKey === want) return
    if (st.badKey === want && nowMs() - (st.badAt ?? 0) < RETRY_MS) return          // a page that failed to draw is not retried every pass
    const tok = ++st.token; st.pending = true; st.pendingKey = want; st.pendingTok = tok
    this._stats.renders++
    this._raster.render(st.key, page, step, v.canvas, () => tok !== st.token || !this._state.has(id)).then((res) => {
      if (tok !== st.token) { if (st.pendingTok === tok) { st.pending = false; st.pendingKey = '' } return }
      st.pending = false; st.pendingKey = ''
      if (!res?.ok) { if (!res?.stale) { st.badKey = `${st.key}|${page}|${step}`; st.badAt = nowMs(); this._status(id, st, 'error', 'That page could not be drawn.') } return }
      st.badKey = ''
      setPageCanvas(mesh)
      v.drawn = { key: st.key, page, step }
      st.stale = false
      this._status(id, st, 'ready', '')
    }, () => { if (st.pendingTok === tok) { st.pending = false; st.pendingKey = '' } })
  }
  _status (id, st, status, text) {
    if (st.status === status && st.text === text) return
    st.status = status; st.text = text
    try { window.dispatchEvent(new CustomEvent('omni:doc-status', { detail: { nodeId: id, status, text } })) } catch (_) { /* no window */ }
  }
  getStatus (id) { const st = this._state.get(id); return st ? { status: st.status, text: st.text ?? '' } : { status: 'idle', text: '' } }
  /** The page count and shape found by the loader. Not an undo step (it is a fact about the file, not an edit). */
  _setMeta (id, pages, aspect) {
    const d = this.getNodeData(id); if (!d || d.nodeKind !== KIND_DOC) return
    const cur = this.getDoc(id); const next = D.setPages(cur, pages, aspect)
    d.doc = next; this._sane.set(next, next)
    this._announce(id, 'meta'); this._persistSoon(id)
  }

  onResize () { this._dirty = true }

  destroy () {
    if (!this._inited) return
    this._bound.forEach(([n, h]) => window.removeEventListener(n, h))
    this._bound = []
    this._persist.forEach(t => clearTimeout(t)); this._persist.clear()
    this._undo.clear(); this._redo.clear()
    try { this._raster?.destroy?.() } catch (_) { /* ignore */ }
    this._state.clear()
    if (SERVICES.doc === this) SERVICES.doc = null
    this._inited = 0
  }

  // ── Reading ─────────────────────────────────────────────────────────────────
  get selectedId () { return this._selectedId }
  getNodeData (id) { return this.omniNode?.getNodeData?.(id) ?? null }
  isDocNode (id) { return this.getNodeData(id)?.nodeKind === KIND_DOC }
  listDocNodes () { try { return (this.omniNode?.getAllNodes?.() ?? []).filter(d => d?.nodeKind === KIND_DOC).map(d => d.id) } catch (_) { return [] } }
  /** The sanitized doc of a node (READ ONLY), or null when the node is not a doc node. Cached until data.doc is replaced. */
  getDoc (id) {
    const d = this.getNodeData(id)
    if (!d || d.nodeKind !== KIND_DOC) return null
    const raw = d.doc
    if (!raw || typeof raw !== 'object') { const m = D.defaultDoc(); this._sane.set(m, m); d.doc = m; return m }
    let m = this._sane.get(raw)
    if (!m) { m = D.sanitizeDoc(raw); this._sane.set(raw, m); this._sane.set(m, m) }
    return m
  }
  /** What a sheet can show: the pages of the in-app guide and the imported library. */
  listSources () {
    return { guide: this._guidePages ?? [], library: this._library.slice() }
  }
  async loadGuidePages () {
    if (this._guidePages) return this._guidePages
    try { const m = await import('../data/OmniDocsData.js'); this._guidePages = (m.DOCS ?? []).map(p => ({ id: p.id, name: p.title || p.id })) } catch (_) { this._guidePages = [] }
    return this._guidePages
  }
  /** Draw the current page of a node on a preview canvas (any size) through the same raster queue. Resolves { ok }. */
  async renderPreview (id, canvas, width = 360) {
    try {
      const doc = this.getDoc(id); if (!doc || doc.source.type === 'none') return { ok: false }
      const h = await this._raster.open(doc.source); if (!h.ok) return { ok: false, error: h.error }
      return await this._raster.render(h.key, Math.min(doc.page, h.pages), width, canvas)
    } catch (_) { return { ok: false } }
  }
  /** The text of the current page (for selecting / copying in the panel). */
  async getPageText (id) {
    try {
      const doc = this.getDoc(id); if (!doc || doc.source.type === 'none') return ''
      const h = await this._raster.open(doc.source); if (!h.ok) return ''
      return await this._raster.text(h.key, Math.min(doc.page, h.pages))
    } catch (_) { return '' }
  }
  async removeFromLibrary (id) { try { await this._ensureAssetsAsync(); return await this._assets.remove(id) } catch (_) { return { ok: false } } }
  async renameInLibrary (id, name) { try { await this._ensureAssetsAsync(); return await this._assets.rename(id, name) } catch (_) { return { ok: false } } }
  getStats () { return { meshes: liveDocMeshes().size, selected: this._selectedId, pendingSaves: this._persist.size, ...this._stats } }

  // ── Creating ────────────────────────────────────────────────────────────────
  _view () {
    const cam = this.ctx.camera
    const dir = new THREE.Vector3(); cam.getWorldDirection(dir)
    return { cam, dir }
  }
  /** Euler angles that turn a sheet to face the camera with its top edge up on screen (works looking down or up too: the basis comes from the camera, not from +y). */
  _facing () {
    try {
      const cam = this.ctx.camera; cam.updateMatrixWorld?.(true)
      const e = cam.matrixWorld.elements
      const z = new THREE.Vector3(e[8], e[9], e[10]).normalize()            // camera +z (backwards) = the sheet's normal, so the sheet faces the camera
      const y = new THREE.Vector3(e[4], e[5], e[6]).normalize()
      const x = new THREE.Vector3().crossVectors(y, z).normalize()
      const yy = new THREE.Vector3().crossVectors(z, x).normalize()
      const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, yy, z))
      const eu = new THREE.Euler().setFromQuaternion(q, 'XYZ')
      return [eu.x, eu.y, eu.z].map(v => (Number.isFinite(v) ? v : 0))
    } catch (_) { return [0, 0, 0] }
  }
  _positionFor (opts, height) {
    const p = opts.position
    if (Array.isArray(p) && p.length >= 3 && p.slice(0, 3).every(Number.isFinite)) return [p[0], p[1], p[2]]
    if (p && typeof p === 'object' && [p.x, p.y, p.z].every(Number.isFinite)) return [p.x, p.y, p.z]
    const { cam, dir } = this._view()
    const q = cam.position.clone().addScaledVector(dir, PIN_DISTANCE)
    return [q.x, q.y, q.z]
  }
  _nextName () {
    const labels = new Set((this.omniNode?.getAllNodes?.() ?? []).filter(d => d?.nodeKind === KIND_DOC).map(d => d.label))
    if (!labels.has('Doc node')) return 'Doc node'
    for (let i = 2; i < 999; i++) if (!labels.has(`Doc node ${i}`)) return `Doc node ${i}`
    return 'Doc node'
  }
  /** New doc node, turned to face the camera. With no `doc` it shows the guide index so there is something to read at once. Returns { ok, nodeId }. */
  createDocNode (opts = {}) {
    try {
      const o = opts && typeof opts === 'object' ? opts : {}
      const doc = o.doc && typeof o.doc === 'object' ? D.sanitizeDoc(o.doc) : D.setSource(D.defaultDoc(), 'guide', 'index', 'Guide index')
      const nodeId = typeof o.id === 'string' && /^[\w-]{1,64}$/.test(o.id) ? o.id : newId()
      const rotation = this._facing()
      window.dispatchEvent(new CustomEvent('omni:node-create-request', { detail: {
        nodeKind: KIND_DOC, doc, id: nodeId, label: String(o.label || this._nextName()).slice(0, 40), geometry: GEO_DOC, primitive: 'objective', color: NODE_COLOR,
        position: this._positionFor(o, doc.width * doc.aspect), rotation, scale: [1, 1, 1], noParent: true, noSelect: o.select !== true,
      } }))
      if (this.omniNode && !this.omniNode.getNodeData?.(nodeId)) return { ok: false, error: 'The doc node could not be created.' }
      this._dirty = true
      return { ok: true, nodeId }
    } catch (err) { return { ok: false, error: String(err?.message ?? err) } }
  }
  _fixNode (d) {
    if (!d || d.nodeKind !== KIND_DOC) return
    if (!d.doc || typeof d.doc !== 'object' || Array.isArray(d.doc)) { d.doc = D.defaultDoc(); this._sane.set(d.doc, d.doc); this._persistSoon(d.id) }
    this._dirty = true
  }
  _syncAll () { try { for (const d of this.omniNode?.getAllNodes?.() ?? []) this._fixNode(d) } catch (_) { /* no nodes yet */ } }
  _onDeleted (id) {
    clearTimeout(this._persist.get(id)); this._persist.delete(id)
    this._undo.delete(id); this._redo.delete(id)
    this._state.delete(id)
    if (this._stroke === id) this._stroke = null
  }

  // ── Pages, sources, import ──────────────────────────────────────────────────
  turn (id, dir) { return this.edit(id, 'turn', (m) => D.turn(m, dir)) }
  goto (id, page) { return this.edit(id, 'page', (m) => D.setPage(m, page), 'page:' + id) }
  setSource (id, type, srcId, title = null) { const st = this._state.get(id); if (st) { st.failed = '' }; return this.edit(id, 'source', (m) => D.setSource(m, type, srcId, title)) }
  /** Import a file into the library and show it on this node. Returns the import result ({ ok, id?, meta?, error? }). */
  async attachFile (id, file) {
    try {
      await this._ensureAssetsAsync()
      const r = await this._assets.importFile(file)
      if (!r.ok) return r
      this.setSource(id, r.meta.type, r.id, r.meta.name)
      return r
    } catch (err) { return { ok: false, error: { code: 'storage', message: String(err?.message ?? err) } } }
  }

  // ── Store ───────────────────────────────────────────────────────────────────
  _persistSoon (id) { if (!id) return; clearTimeout(this._persist.get(id)); this._persist.set(id, setTimeout(() => this.flush(id), PERSIST_MS)) }
  flush (id) {
    if (id) { clearTimeout(this._persist.get(id)); this._persist.delete(id) }
    const d = id ? this.getNodeData(id) : null
    if (!d) return false
    try { window.dispatchEvent(new CustomEvent('omni:force-save', { detail: {} })) } catch (_) { /* no window */ }
    try { window.dispatchEvent(new CustomEvent('omni:node-updated', { detail: { node: d } })) } catch (_) { /* no window */ }
    return true
  }
  flushAll () { for (const id of [...this._persist.keys()]) this.flush(id) }
  _announce (nodeId, reason) { this._dirty = true; try { window.dispatchEvent(new CustomEvent('omni:doc-changed', { detail: { nodeId, reason } })) } catch (_) { /* no window */ } }

  commit (id, doc, reason = 'edit') {
    const d = this.getNodeData(id); if (!d || d.nodeKind !== KIND_DOC) return false
    const m = D.sanitizeDoc(doc)
    this._sane.set(m, m)
    d.doc = m
    this._announce(id, reason)
    this._persistSoon(id)
    return m
  }
  pushUndo (id) {
    const cur = this.getDoc(id); if (!cur) return false
    const st = this._undo.get(id) ?? []
    st.push(cur); if (st.length > UNDO_MAX) st.shift()
    this._undo.set(id, st); this._redo.delete(id)
    return true
  }
  undoDepth (id) { return this._undo.get(id)?.length ?? 0 }
  canUndo (id) { return this.undoDepth(id) > 0 }
  canRedo (id) { return (this._redo.get(id)?.length ?? 0) > 0 }
  undo (id) {
    const st = this._undo.get(id); const cur = this.getDoc(id)
    if (!cur || !st?.length) return { ok: false, error: 'Nothing to undo.' }
    const prev = st.pop(); const rd = this._redo.get(id) ?? []; rd.push(cur); this._redo.set(id, rd)
    this._setDirect(id, prev, 'undo'); return { ok: true }
  }
  redo (id) {
    const rd = this._redo.get(id); const cur = this.getDoc(id)
    if (!cur || !rd?.length) return { ok: false, error: 'Nothing to redo.' }
    const next = rd.pop(); const st = this._undo.get(id) ?? []; st.push(cur); this._undo.set(id, st)
    this._setDirect(id, next, 'redo'); return { ok: true }
  }
  _setDirect (id, doc, reason) {
    const d = this.getNodeData(id); if (!d) return
    d.doc = doc; this._sane.set(doc, doc); this._coalesce = null
    this._announce(id, reason); this._persistSoon(id)
  }
  /** Run an edit: fn(doc) returns the NEW doc. One undo step (a repeated `coalesce` key within 0.9 s shares one; a beginStroke() gesture is one step). */
  edit (id, reason, fn, coalesce = null) {
    const cur = this.getDoc(id); if (!cur) return { ok: false, error: 'No such doc node.' }
    let next
    try { next = fn(cur) } catch (err) { return { ok: false, error: String(err?.message ?? err) } }
    if (next && next.error) return { ok: false, error: next.error }
    if (!next || typeof next !== 'object') return { ok: false, error: 'That edit did not work.' }
    const clean = D.sanitizeDoc(next)
    if (JSON.stringify(clean) === JSON.stringify(cur)) return { ok: true, doc: cur, same: true }
    const t = nowMs()
    const merge = this._stroke === id || (coalesce && this._coalesce && this._coalesce.id === id && this._coalesce.key === coalesce && t - this._coalesce.t < COALESCE_MS)
    if (!merge) this.pushUndo(id)
    this._coalesce = coalesce ? { id, key: coalesce, t } : null
    return { ok: true, doc: this.commit(id, clean, reason) }
  }
  beginStroke (id) { if (this._stroke === id) return true; if (!this.getDoc(id)) return false; this.pushUndo(id); this._stroke = id; this._coalesce = null; return true }
  endStroke () { this._stroke = null }
}
