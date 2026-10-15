/**
 * systems/OmniPolyNodes.js — the runtime of the PolyNode kind (V204), built like systems/OmniDocNodes.js.
 *
 * The model is utils/OmniPolyModel.js (pure), the geometry utils/OmniPolyNodeMesh.js (one merged double-sided mesh + one atlas texture), face pictures utils/OmniPolyFaceDraw.js,
 * document / image pixels systems/OmniDocRaster.js (a 2D canvas, one render at a time). This module does what needs the live scene:
 *   - CREATING   omni:poly-node-create { position?, label?, select?, poly?, shape?, id? } (answer in detail.out { ok, nodeId }). An ordinary OmniNode (omni:node-create-request).
 *   - LEVEL OF DETAIL  4 times a second: near + in view + visible + within the pixel budget -> the atlas is drawn at a cell size that fits the screen size of a face; else NO texture. At rest zero GPU work.
 *   - CLICKS     a tap (no drag) on a face of a poly node: raycast against poly meshes only -> omni:poly-face-click { nodeId, face, index, clientX, clientY, options } (the tooltip, ui/OmniPolyTooltip.js, listens).
 *                act(nodeId, index, optionId): select | settings | play | prev | next | fire | tag | hide.
 *   - SEMANTICS  facesByTag, applyToTag, omni:poly-face-set { nodeId, face | tag, patch }; omni:poly-face-action { nodeId, face, event, tags } is fired by a face that has an event.
 *   - THE STORE  getPoly / commit / edit / undo / redo / beginStroke (like the doc store).
 * Module contract: constructor(context, omniNode) / init (guarded) / update(delta) / destroy / onResize. User-facing: imports no Dev* module.
 */
import * as THREE from 'three'
import * as P from '../utils/OmniPolyModel.js'
import { KIND_POLY, GEO_POLY, SERVICES } from '../utils/OmniExtraKinds.js'
import { livePolyMeshes, applyPolyLook, faceAt, sizeAtlas, setAtlas, clearAtlas } from '../utils/OmniPolyNodeMesh.js'
import { drawFace } from '../utils/OmniPolyFaceDraw.js'
import { createDocRaster } from './OmniDocRaster.js'

const PERSIST_MS = 300
export const UNDO_MAX = 100
const COALESCE_MS = 900
const NODE_COLOR = '#9ad0ff'
const LOD_INTERVAL = 0.25
const RETRY_MS = 10000
const FAR = 300
const PIN_DISTANCE = 7
export const CELL_STEPS = [64, 128, 256, 512, 1024]
export const BUDGET_DESKTOP = 24e6
export const BUDGET_PHONE = 8e6
const TAP_PX = 6; const TAP_MS = 500
const newId = () => 'omni_' + Math.random().toString(36).slice(2, 8)
const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())

/** Pure: the cell size (pixels per face side) wanted for a face that is `facePx` pixels across on screen. 0 = no atlas wanted. */
export function cellFor (facePx, cols, rows, maxTex) {
  if (!(facePx > 8)) return 0
  let c = CELL_STEPS.find(s => s >= facePx) ?? CELL_STEPS[CELL_STEPS.length - 1]
  while (c > CELL_STEPS[0] && (cols * c > maxTex || rows * c > maxTex)) c = CELL_STEPS[CELL_STEPS.indexOf(c) - 1]
  return c
}
/** Pure: share a pixel budget between nodes. reqs [{id, want, cols, rows, distance}] -> { id: cell } (nearest first; halve until it fits; below the smallest step = 0). */
export function planAtlasBudget (reqs, budget) {
  const out = {}; let left = budget
  for (const r of [...reqs].sort((a, b) => a.distance - b.distance)) {
    let c = r.want
    while (c >= CELL_STEPS[0] && r.cols * r.rows * c * c > left) c = c / 2
    if (c < CELL_STEPS[0]) { out[r.id] = 0; continue }
    out[r.id] = c; left -= r.cols * r.rows * c * c
  }
  return out
}

export default class OmniPolyNodes {
  constructor (context, omniNode = null, opts = {}) {
    this.ctx = context; this.omniNode = omniNode
    this._raster = opts.raster ?? null; this._assets = opts.assets ?? null
    this._audio = opts.audio ?? null; this._engine = opts.engine ?? null
    this._inited = 0; this._bound = []
    this._selectedId = null; this._selFace = new Map(); this._tagSel = new Map()
    this._persist = new Map(); this._undo = new Map(); this._redo = new Map(); this._sane = new WeakMap()
    this._coalesce = null; this._stroke = null
    this._state = new Map()          // nodeId -> { src: Map(faceIdx -> {key, canvas, status, at}), lastPoly, cell }
    this._lodT = 0; this._dirty = false
    this._frustum = new THREE.Frustum(); this._pm = new THREE.Matrix4(); this._sph = new THREE.Sphere(); this._ray = new THREE.Raycaster()
    this._stats = { draws: 0, passes: 0, loads: 0 }
    this._budget = opts.budget ?? null; this._maxTexture = opts.maxTexture ?? null
    this._down = null
  }

  init () {
    this._inited++
    if (this._inited > 1) return
    const on = (name, fn, target = window) => { const h = (e) => fn(e.detail ?? {}, e); target.addEventListener(name, h); this._bound.push([name, h, target]) }
    on('omni:poly-node-create', (d, e) => { const out = this.createPolyNode(d); if (e.detail && typeof e.detail === 'object') e.detail.out = out })
    on('omni:node-selected', (d) => { this._selectedId = d.node?.id ?? null })
    on('omni:node-deselected', () => { this._selectedId = null })
    on('omni:node-created', (d) => this._fixNode(d.node))
    on('omni:node-deleted', (d) => this._onDeleted(d.id))
    on('omni:poly-face-set', (d) => this._faceSet(d))
    on('omni:doc-assets-changed', () => this._invalidateAll())
    const el = this.ctx?.renderer?.domElement
    if (el?.addEventListener) {
      const dn = (e) => { this._down = e.button === 0 || e.pointerType === 'touch' ? { x: e.clientX, y: e.clientY, t: nowMs() } : null }
      const up = (e) => { const d0 = this._down; this._down = null; if (!d0) return; if (Math.hypot(e.clientX - d0.x, e.clientY - d0.y) <= TAP_PX && nowMs() - d0.t <= TAP_MS) this.pickAt(e.clientX, e.clientY) }
      el.addEventListener('pointerdown', dn); el.addEventListener('pointerup', up)
      this._bound.push(['pointerdown', dn, el], ['pointerup', up, el])
    }
    if (!this._raster) this._raster = createDocRaster({ getBytes: (id) => this._getBytes(id) })
    this._syncAll()
    SERVICES.poly = this
  }
  async _getBytes (id) { try { if (!this._assets) { const m = await import('../utils/OmniDocAssets.js'); this._assets = m.default ?? m.DocAssets } return await this._assets?.getBytes?.(id) ?? null } catch (_) { return null } }
  _invalidateAll () { for (const st of this._state.values()) { st.src?.clear(); st.drawKey = '' }; this._dirty = true }

  // ── Per frame: level of detail ──────────────────────────────────────────────
  update (delta) {
    const meshes = livePolyMeshes(); if (!meshes.size) return
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
    const dpr = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 2)
    const hw = r?.capabilities?.maxTextureSize || 4096
    const maxTex = this._maxTexture ?? (phone ? 1024 : Math.min(2048, hw >= 4096 ? 2048 : 1024))
    return { cam, vh, dpr, phone, maxTex, fov: cam?.fov ?? 60, budget: this._budget ?? (phone ? BUDGET_PHONE : BUDGET_DESKTOP) }
  }
  _worldVisible (mesh) { let o = mesh; while (o) { if (o.visible === false) return false; o = o.parent } return true }
  _needsAtlas (poly) { return poly.faces.some(f => !f.hidden && (P.hasContent(f.content) || f.label)) }

  /** One level-of-detail pass over every live poly node. Exposed for tests. */
  _pass (meshes = livePolyMeshes()) {
    const env = this._env(); const cam = env.cam
    this._stats.passes++
    let frustumOk = false
    if (cam?.projectionMatrix && cam.matrixWorldInverse) { this._pm.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse); this._frustum.setFromProjectionMatrix(this._pm); frustumOk = true }
    const reqs = []; const by = new Map()
    for (const mesh of meshes) {
      const v = mesh.userData.pnv; const id = mesh.userData.nodeId
      if (!v || !id) continue
      const poly = this.getPoly(id); if (!poly) continue
      let st = this._state.get(id); if (!st) { st = { src: new Map(), lastPoly: null, drawKey: '', cell: 0 }; this._state.set(id, st) }
      if (st.lastPoly !== poly) { if (applyPolyLook(mesh, poly)) { st.drawKey = '' } st.lastPoly = poly }
      let want = 0; let dist = 1e9
      if (this._needsAtlas(poly) && mesh.visible !== false && this._worldVisible(mesh)) {
        mesh.updateWorldMatrix?.(true, false)
        const e = mesh.matrixWorld.elements
        dist = cam ? Math.hypot(e[12] - cam.position.x, e[13] - cam.position.y, e[14] - cam.position.z) : 5
        const sc = Math.max(Math.hypot(e[0], e[1], e[2]), Math.hypot(e[4], e[5], e[6]), Math.hypot(e[8], e[9], e[10]))
        const b = v.shape.bounds; const radius = Math.max(0.05, b.radius * sc)
        const inView = !frustumOk || (this._sph.set(this._tmpV(e), radius), this._frustum.intersectsSphere(this._sph))
        if (inView && dist < FAR) {
          const nearDist = Math.max(0.3, dist - radius * 0.5)
          const nodePx = (2 * radius / (2 * nearDist * Math.tan((env.fov * Math.PI) / 360))) * env.vh
          const faceR = Math.max(...v.shape.faces.map(f => f.radius), 0.01)
          const facePx = nodePx * (faceR / Math.max(0.01, b.radius)) * env.dpr
          want = cellFor(facePx, v.grid.cols, v.grid.rows, env.maxTex)
        }
      }
      reqs.push({ id, want, cols: v.grid.cols, rows: v.grid.rows, distance: dist })
      by.set(id, { mesh, poly, st, v })
    }
    const plan = planAtlasBudget(reqs.filter(r => r.want > 0), env.budget)
    for (const [id, o] of by) this._apply(id, o.mesh, o.poly, o.st, o.v, plan[id] ?? 0)
  }
  _tmpV (e) { return (this._t3 ??= new THREE.Vector3()).set(e[12], e[13], e[14]) }

  _apply (id, mesh, poly, st, v, cell) {
    if (cell === 0) { if (v.cell) { clearAtlas(mesh); st.drawKey = ''; st.src.clear() } return }
    // load the sources (image / document faces) that are not loaded for this cell size
    let pending = false
    poly.faces.forEach((f, i) => {
      const c = f.content
      if (f.hidden || (c.type !== 'image' && c.type !== 'doc') || !P.hasContent(c)) { st.src.delete(i); return }
      const key = P.contentKey(c) + '|' + cell
      const have = st.src.get(i)
      if (have && have.key === key && (have.status === 'ready' || have.status === 'loading')) { if (have.status === 'loading') pending = true; return }
      if (have && have.key === key && have.status === 'error' && nowMs() - have.at < RETRY_MS) return
      const ent = { key, canvas: have?.canvas ?? (typeof document !== 'undefined' ? document.createElement('canvas') : null), status: 'loading', at: nowMs() }
      st.src.set(i, ent); pending = true; this._stats.loads++
      this._loadSource(id, i, ent, c, cell)
    })
    const key = poly.faces.map((f, i) => (f.hidden ? '-' : P.contentKey(f.content) + (f.label ? ':' + f.label : '') + ':' + (st.src.get(i)?.status ?? ''))).join('|') + '#' + cell + '#' + v.grid.cols
    if (st.drawKey === key && v.cell === cell) return
    const canvas = sizeAtlas(mesh, cell); if (!canvas) return
    const g = canvas.getContext?.('2d'); if (!g) return
    poly.faces.forEach((f, i) => {
      if (f.hidden) return
      const x = (i % v.grid.cols) * cell; const y = Math.floor(i / v.grid.cols) * cell
      const ent = st.src.get(i)
      try { drawFace(g, x, y, cell, f, { source: ent?.status === 'ready' ? ent.canvas : null, state: ent?.status === 'error' ? 'error' : 'loading' }) } catch (_) { /* one bad face never stops the others */ }
    })
    setAtlas(mesh); st.drawKey = key; v.cell = cell; v.drawn = { key, cell }; this._stats.draws++
  }
  _loadSource (id, i, ent, c, cell) {
    const done = (ok) => { if (!this._state.has(id)) return; ent.status = ok ? 'ready' : 'error'; ent.at = nowMs(); this._dirty = true }
    this._raster.open(c.source).then((h) => {
      if (!h.ok || !ent.canvas) return done(false)
      const stale = () => !this._state.has(id) || this._state.get(id).src.get(i) !== ent
      return this._raster.render(h.key, Math.min(c.page, h.pages), cell, ent.canvas, stale).then((r) => { if (r?.stale) return; done(!!r?.ok) })
    }).catch(() => done(false))
  }

  onResize () { this._dirty = true }
  destroy () {
    if (!this._inited) return
    this._bound.forEach(([n, h, t]) => (t ?? window).removeEventListener(n, h))
    this._bound = []
    this._persist.forEach(t => clearTimeout(t)); this._persist.clear()
    this._undo.clear(); this._redo.clear()
    try { this._raster?.destroy?.() } catch (_) { /* ignore */ }
    this._state.clear()
    if (SERVICES.poly === this) SERVICES.poly = null
    this._inited = 0
  }

  // ── Reading ─────────────────────────────────────────────────────────────────
  get selectedId () { return this._selectedId }
  getNodeData (id) { return this.omniNode?.getNodeData?.(id) ?? null }
  isPolyNode (id) { return this.getNodeData(id)?.nodeKind === KIND_POLY }
  listPolyNodes () { try { return (this.omniNode?.getAllNodes?.() ?? []).filter(d => d?.nodeKind === KIND_POLY).map(d => d.id) } catch (_) { return [] } }
  /** The sanitized poly of a node (READ ONLY), or null. Cached until data.poly is replaced. */
  getPoly (id) {
    const d = this.getNodeData(id)
    if (!d || d.nodeKind !== KIND_POLY) return null
    const raw = d.poly
    if (!raw || typeof raw !== 'object') { const m = P.defaultPoly(); this._sane.set(m, m); d.poly = m; return m }
    let m = this._sane.get(raw)
    if (!m) { m = P.sanitizePoly(raw); this._sane.set(raw, m); this._sane.set(m, m) }
    return m
  }
  getSelectedFace (id) { return this._selFace.get(id) ?? -1 }
  getTagSelection (id) { return this._tagSel.get(id) ?? [] }
  getStats () { return { meshes: livePolyMeshes().size, selected: this._selectedId, pendingSaves: this._persist.size, ...this._stats } }
  facesByTag (id, tag) { const p = this.getPoly(id); return p ? P.facesByTag(p, tag) : [] }
  allTags (id) { const p = this.getPoly(id); return p ? P.allTags(p) : [] }

  // ── Picking and the tooltip ─────────────────────────────────────────────────
  /** Raycast poly meshes at a screen point. Returns { nodeId, index, face } or null. */
  pickAt (clientX, clientY, fire = true) {
    try {
      const el = this.ctx?.renderer?.domElement; const cam = this.ctx?.camera; if (!el || !cam) return null
      const r = el.getBoundingClientRect?.() ?? { left: 0, top: 0, width: el.clientWidth || 1, height: el.clientHeight || 1 }
      const x = ((clientX - r.left) / Math.max(1, r.width)) * 2 - 1; const y = -((clientY - r.top) / Math.max(1, r.height)) * 2 + 1
      cam.updateMatrixWorld?.(true)
      this._ray.setFromCamera({ x, y }, cam)
      const hits = this._ray.intersectObjects([...livePolyMeshes()].filter(m => m.visible !== false && this._worldVisible(m)), false)
      if (!hits.length) return null
      const hit = hits[0]; const nodeId = hit.object.userData.nodeId; const index = faceAt(hit.object, hit.faceIndex)
      if (!nodeId || index < 0) return null
      const res = { nodeId, index, face: 'f' + index }
      if (fire) this.clickFace(nodeId, index, clientX, clientY)
      return res
    } catch (_) { return null }
  }
  /** A face was clicked: fire the tooltip event with the options that fit what the face holds. */
  clickFace (nodeId, index, clientX = 0, clientY = 0) {
    const poly = this.getPoly(nodeId); if (!poly) return false
    const pages = this._pagesOf(nodeId, index)
    const options = P.menuOptions(poly, index, { pages })
    if (!options.length) return false
    try { window.dispatchEvent(new CustomEvent('omni:poly-face-click', { detail: { nodeId, face: 'f' + index, index, clientX, clientY, options } })) } catch (_) { /* no window */ }
    return true
  }
  _pagesOf (nodeId, index) { const e = this._state.get(nodeId)?.src.get(index); if (!e) return 0; const f = this.getPoly(nodeId)?.faces[index]; const i = f ? this._raster?.info?.(`${f.content.source.type}:${f.content.source.id}`) : null; return i?.pages ?? 0 }

  /** Run one tooltip option. Returns { ok, ... }. */
  act (nodeId, index, optionId) {
    const poly = this.getPoly(nodeId); const f = poly?.faces[index]
    if (!f) return { ok: false, error: 'No such face.' }
    const say = (name, extra = {}) => { try { window.dispatchEvent(new CustomEvent(name, { detail: { nodeId, face: 'f' + index, index, ...extra } })) } catch (_) { /* no window */ } }
    switch (optionId) {
      case 'select': this._selFace.set(nodeId, index); this._tagSel.delete(nodeId); say('omni:poly-face-selected'); return { ok: true }
      case 'settings': this._selFace.set(nodeId, index); say('omni:poly-face-selected'); say('omni:poly-open-panel'); return { ok: true }
      case 'play': return this.playFace(nodeId, index)
      case 'prev': return this.turn(nodeId, index, -1)
      case 'next': return this.turn(nodeId, index, 1)
      case 'fire': say('omni:poly-face-action', { event: f.event, tags: f.tags.slice() }); return { ok: !!f.event }
      case 'tag': { const ids = P.facesByTag(poly, f.tags[0] ?? ''); this._tagSel.set(nodeId, ids.map(s => Number(s.slice(1)))); say('omni:poly-tag-selected', { tag: f.tags[0] ?? '', faces: ids }); return { ok: true, faces: ids } }
      case 'hide': return this.removeFace(nodeId, index)
      default: return { ok: false, error: 'Unknown option.' }
    }
  }
  /** Play a face's sound: a sound node in the scene, or a clip of the audio library. A face with an event also fires it. */
  playFace (nodeId, index) {
    const f = this.getPoly(nodeId)?.faces[index]
    if (!f || f.content.type !== 'sound' || !P.hasContent(f.content)) return { ok: false, error: 'This face has no sound.' }
    const s = f.content.source
    try {
      if (s.type === 'soundNode') window.dispatchEvent(new CustomEvent('omni:sound-play-request', { detail: { nodeId: s.id, source: 'poly' } }))
      else if (s.type === 'audio') this._playClip(s.id)
      else return { ok: false, error: 'No sound chosen.' }
    } catch (err) { return { ok: false, error: String(err?.message ?? err) } }
    if (f.event) { try { window.dispatchEvent(new CustomEvent('omni:poly-face-action', { detail: { nodeId, face: 'f' + index, index, event: f.event, tags: f.tags.slice() } })) } catch (_) { /* no window */ } }
    return { ok: true }
  }
  async _playClip (clipId) {
    try {
      if (!this._audio) { const m = await import('../utils/OmniAudioAssets.js'); this._audio = [m?.AudioAssets, m?.default, m].find(x => x && typeof x.playClip === 'function') ?? null }
      if (!this._engine) { const m = await import('./OmniSoundEngine.js'); this._engine = m.default ?? m.SoundEngine ?? null }
      const ctx = this._engine?.getContext?.() ?? this._engine?._ensureContext?.()
      if (!ctx || !this._audio) return false
      if (ctx.state === 'suspended') { try { await ctx.resume() } catch (_) { /* locked */ } }
      this._audio.playClip(ctx, clipId, { when: ctx.currentTime + 0.02, gain: 1, fadeIn: 0.005, fadeOut: 0.03 })
      return true
    } catch (_) { return false }
  }


  // ── What a face can show (for the pickers) ──────────────────────────────────
  /** { guide:[{id,name}], library:[{id,name,type,size}] } — loads the guide pages and the document library on first use. */
  async loadSources () {
    try {
      if (!this._guide) { try { const m = await import('../data/OmniDocsData.js'); this._guide = (m.DOCS ?? []).map(p => ({ id: p.id, name: p.title || p.id })) } catch (_) { this._guide = [] } }
      if (!this._assets) { try { const m = await import('../utils/OmniDocAssets.js'); this._assets = m.default ?? m.DocAssets } catch (_) { /* none */ } }
      const l = await Promise.resolve(this._assets?.list?.() ?? [])
      this._library = (Array.isArray(l) ? l : []).map(x => ({ id: String(x.id), name: String(x.name || x.id), type: String(x.type || 'text'), size: Number(x.size) || 0 }))
    } catch (_) { this._library = this._library ?? [] }
    return this.listSources()
  }
  listSources () { return { guide: this._guide ?? [], library: this._library ?? [] } }
  /** The sound nodes in the scene: [{id, label}]. */
  listSoundNodes () { try { return (this.omniNode?.getAllNodes?.() ?? []).filter(d => d?.nodeKind === 'soundNode').map(d => ({ id: d.id, label: d.label || d.id })) } catch (_) { return [] } }
  /** The clips of the audio library: [{id, name}]. */
  async listClips () {
    try {
      if (!this._audio) { const m = await import('../utils/OmniAudioAssets.js'); this._audio = [m?.AudioAssets, m?.default, m].find(x => x && typeof x.playClip === 'function') ?? null }
      const l = await Promise.resolve(this._audio?.list?.() ?? [])
      return (Array.isArray(l) ? l : []).map(x => ({ id: String(x.id), name: String(x.name || x.id) }))
    } catch (_) { return [] }
  }
  /** Import a file into the document library and put it on a face as image (if it is one) or doc. */
  async attachFile (id, ref, file) {
    try {
      if (!this._assets) { const m = await import('../utils/OmniDocAssets.js'); this._assets = m.default ?? m.DocAssets }
      const r = await this._assets.importFile(file)
      if (!r.ok) return r
      const isImg = r.meta.type === 'image'
      this.setContent(id, ref, { type: isImg ? 'image' : 'doc', source: { type: r.meta.type, id: r.id }, page: 1 })
      await this.loadSources()
      return r
    } catch (err) { return { ok: false, error: { code: 'storage', message: String(err?.message ?? err) } } }
  }

  // ── Creating ────────────────────────────────────────────────────────────────
  _positionFor (opts) {
    const p = opts.position
    if (Array.isArray(p) && p.length >= 3 && p.slice(0, 3).every(Number.isFinite)) return [p[0], p[1], p[2]]
    if (p && typeof p === 'object' && [p.x, p.y, p.z].every(Number.isFinite)) return [p.x, p.y, p.z]
    const cam = this.ctx.camera; const dir = new THREE.Vector3(); cam.getWorldDirection(dir)
    const q = cam.position.clone().addScaledVector(dir, PIN_DISTANCE)
    return [q.x, q.y, q.z]
  }
  _nextName () {
    const labels = new Set((this.omniNode?.getAllNodes?.() ?? []).filter(d => d?.nodeKind === KIND_POLY).map(d => d.label))
    if (!labels.has('Poly node')) return 'Poly node'
    for (let i = 2; i < 999; i++) if (!labels.has(`Poly node ${i}`)) return `Poly node ${i}`
    return 'Poly node'
  }
  /** A starter poly: the shape with a few drawn faces so there is something to see and click at once. */
  starter (shape = 'cube') {
    let p = P.sanitizePoly({ shape })
    const kinds = ['checker', 'stripes', 'dots', 'grid', 'gradient']
    const cols = [['#ffffff', '#9ad0ff'], ['#ffe9a8', '#ff9a6b'], ['#d9ffd9', '#5cc98a'], ['#f2e0ff', '#a07bd8']]
    for (let i = 0; i < Math.min(p.faces.length, 6); i++) p = P.setFace(p, i, { label: 'Face ' + (i + 1), content: { type: 'pattern', pattern: { kind: kinds[i % kinds.length], a: cols[i % cols.length][0], b: cols[i % cols.length][1] } } })
    return p
  }
  createPolyNode (opts = {}) {
    try {
      const o = opts && typeof opts === 'object' ? opts : {}
      const poly = o.poly && typeof o.poly === 'object' ? P.sanitizePoly(o.poly) : this.starter(typeof o.shape === 'string' ? o.shape : 'cube')
      const nodeId = typeof o.id === 'string' && /^[\w-]{1,64}$/.test(o.id) ? o.id : newId()
      window.dispatchEvent(new CustomEvent('omni:node-create-request', { detail: {
        nodeKind: KIND_POLY, poly, id: nodeId, label: String(o.label || this._nextName()).slice(0, 40), geometry: GEO_POLY, primitive: 'objective', color: NODE_COLOR,
        position: this._positionFor(o), rotation: [0.35, 0.6, 0], scale: [1, 1, 1], noParent: true, noSelect: o.select !== true,
      } }))
      if (this.omniNode && !this.omniNode.getNodeData?.(nodeId)) return { ok: false, error: 'The poly node could not be created.' }
      this._dirty = true
      return { ok: true, nodeId }
    } catch (err) { return { ok: false, error: String(err?.message ?? err) } }
  }
  _fixNode (d) {
    if (!d || d.nodeKind !== KIND_POLY) return
    if (!d.poly || typeof d.poly !== 'object' || Array.isArray(d.poly)) { d.poly = P.defaultPoly(); this._sane.set(d.poly, d.poly); this._persistSoon(d.id) }
    this._dirty = true
  }
  _syncAll () { try { for (const d of this.omniNode?.getAllNodes?.() ?? []) this._fixNode(d) } catch (_) { /* no nodes yet */ } }
  _onDeleted (id) {
    clearTimeout(this._persist.get(id)); this._persist.delete(id)
    this._undo.delete(id); this._redo.delete(id); this._selFace.delete(id); this._tagSel.delete(id)
    const st = this._state.get(id); st?.src.clear(); this._state.delete(id)
    if (this._stroke === id) this._stroke = null
  }

  // ── Edits (each is one undo step) ───────────────────────────────────────────
  setShape (id, patch) { return this.edit(id, 'shape', (m) => P.setShape(m, patch), 'shape:' + id) }
  setFace (id, ref, patch, coalesce = null) { return this.edit(id, 'face', (m) => P.setFace(m, ref, patch), coalesce) }
  setContent (id, ref, content) { return this.edit(id, 'content', (m) => P.setContent(m, ref, content)) }
  setTags (id, ref, tags) { return this.edit(id, 'tags', (m) => P.setTags(m, ref, tags)) }
  turn (id, ref, dir) { return this.edit(id, 'turn', (m) => P.turnFace(m, ref, dir)) }
  removeFace (id, ref) { return this.edit(id, 'remove', (m) => P.removeFace(m, ref)) }
  addFace (id) { return this.edit(id, 'add', (m) => P.addFace(m)) }
  applyToTag (id, tag, patch) { return this.edit(id, 'tag', (m) => P.applyToTag(m, tag, patch)) }
  applyAll (id, patch) { return this.edit(id, 'all', (m) => P.applyAll(m, patch)) }
  _faceSet (d) {
    if (!d || !d.nodeId || !d.patch || typeof d.patch !== 'object') return
    if (typeof d.tag === 'string') this.applyToTag(d.nodeId, d.tag, d.patch)
    else if (d.face !== undefined) this.setFace(d.nodeId, d.face, d.patch)
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
  _announce (nodeId, reason) { this._dirty = true; try { window.dispatchEvent(new CustomEvent('omni:poly-changed', { detail: { nodeId, reason } })) } catch (_) { /* no window */ } }
  commit (id, poly, reason = 'edit') {
    const d = this.getNodeData(id); if (!d || d.nodeKind !== KIND_POLY) return false
    const m = P.sanitizePoly(poly); this._sane.set(m, m); d.poly = m
    this._announce(id, reason); this._persistSoon(id)
    return m
  }
  pushUndo (id) {
    const cur = this.getPoly(id); if (!cur) return false
    const st = this._undo.get(id) ?? []; st.push(cur); if (st.length > UNDO_MAX) st.shift()
    this._undo.set(id, st); this._redo.delete(id)
    return true
  }
  undoDepth (id) { return this._undo.get(id)?.length ?? 0 }
  canUndo (id) { return this.undoDepth(id) > 0 }
  canRedo (id) { return (this._redo.get(id)?.length ?? 0) > 0 }
  undo (id) {
    const st = this._undo.get(id); const cur = this.getPoly(id)
    if (!cur || !st?.length) return { ok: false, error: 'Nothing to undo.' }
    const prev = st.pop(); const rd = this._redo.get(id) ?? []; rd.push(cur); this._redo.set(id, rd)
    this._setDirect(id, prev, 'undo'); return { ok: true }
  }
  redo (id) {
    const rd = this._redo.get(id); const cur = this.getPoly(id)
    if (!cur || !rd?.length) return { ok: false, error: 'Nothing to redo.' }
    const next = rd.pop(); const st = this._undo.get(id) ?? []; st.push(cur); this._undo.set(id, st)
    this._setDirect(id, next, 'redo'); return { ok: true }
  }
  _setDirect (id, poly, reason) { const d = this.getNodeData(id); if (!d) return; d.poly = poly; this._sane.set(poly, poly); this._coalesce = null; this._announce(id, reason); this._persistSoon(id) }
  /** Run an edit: fn(poly) returns the NEW poly. One undo step (a repeated `coalesce` key within 0.9 s shares one; a beginStroke() gesture is one step). */
  edit (id, reason, fn, coalesce = null) {
    const cur = this.getPoly(id); if (!cur) return { ok: false, error: 'No such poly node.' }
    let next
    try { next = fn(cur) } catch (err) { return { ok: false, error: String(err?.message ?? err) } }
    if (!next || typeof next !== 'object') return { ok: false, error: 'That edit did not work.' }
    const clean = P.sanitizePoly(next)
    if (JSON.stringify(clean) === JSON.stringify(cur)) return { ok: true, poly: cur, same: true }
    const t = nowMs()
    const merge = this._stroke === id || (coalesce && this._coalesce && this._coalesce.id === id && this._coalesce.key === coalesce && t - this._coalesce.t < COALESCE_MS)
    if (!merge) this.pushUndo(id)
    this._coalesce = coalesce ? { id, key: coalesce, t } : null
    return { ok: true, poly: this.commit(id, clean, reason) }
  }
  beginStroke (id) { if (this._stroke === id) return true; if (!this.getPoly(id)) return false; this.pushUndo(id); this._stroke = id; this._coalesce = null; return true }
  endStroke () { this._stroke = null }
}
