/**
 * systems/OmniNoteNodes.js — the runtime of the NoteNode kind (V213), the "Word" node.
 *
 * Model: utils/OmniNoteModel.js (safe html + look). Layout: utils/OmniNoteLayout.js. Node kind and sheet: utils/OmniExtraKinds.js (data.nodeKind 'noteNode') + the same thin double-sided
 * sheet the DocNode uses (utils/OmniDocNodeMesh.js). This module does what needs the live scene:
 *   - CREATING  omni:note-node-create { position?, label?, select?, note?, id? } (answer in detail.out { ok, nodeId }): an ordinary OmniNode turned to face the camera.
 *   - DRAWING   a note is drawn into a 2D canvas (one texture) ONLY when its text or look changed and it is near and visible; a far / hidden note drops its texture (a plain paper box).
 *               The sheet is as tall as the text (fit 'grow', up to 4 times its width) or a fixed shape (fit 'fixed', the text is cut off at the bottom).
 *   - THE STORE getNote(id) / setNote(id, patch) / setHtml(id, html) / undo / redo (note level, up to 100 steps); events omni:note-changed { nodeId, reason }.
 *   - IMAGES    pictures inside a note are small data: images; they are decoded once and cached.
 * Module contract: constructor(context, omniNode) / init (guarded) / update(delta) / destroy / onResize. User-facing: imports no Dev* module.
 */
import * as THREE from 'three'
import * as N from '../utils/OmniNoteModel.js'
import { layoutNote, drawOps } from '../utils/OmniNoteLayout.js'
import { KIND_NOTE, GEO_NOTE, SERVICES } from '../utils/OmniExtraKinds.js'
import { applyDocLook, setPageCanvas, clearPage, DOC_LIVE } from '../utils/OmniDocNodeMesh.js'

const PIN_DISTANCE = 7, PERSIST_MS = 300, UNDO_MAX = 100, COALESCE_MS = 900, LOD_INTERVAL = 0.25, FAR = 300, NODE_COLOR = '#ffd36b', MAX_PX_H = 4096
const newId = () => 'omni_' + Math.random().toString(36).slice(2, 8)
const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())

export default class OmniNoteNodes {
  constructor (context, omniNode = null, opts = {}) {
    this.ctx = context; this.omniNode = omniNode
    this._inited = 0; this._bound = []; this._sane = new WeakMap(); this._persist = new Map()
    this._undo = new Map(); this._redo = new Map(); this._coalesce = null
    this._state = new Map()            // id -> { key, drawn:boolean }
    this._images = new Map()           // src -> { el, w, h, ready }
    this._lodT = 0; this._dirty = true; this._meshes = new Set()
    this._measureCtx = null; this._opts = opts
    this._stats = { draws: 0 }
  }
  init () {
    this._inited++; if (this._inited > 1) return
    const on = (name, fn) => { const h = (e) => fn(e.detail ?? {}, e); window.addEventListener(name, h); this._bound.push([name, h]) }
    on('omni:note-node-create', (d, e) => { const out = this.createNoteNode(d); if (e.detail && typeof e.detail === 'object') e.detail.out = out })
    on('omni:node-created', (d) => this._fixNode(d.node))
    on('omni:node-deleted', (d) => this._onDeleted(d.id))
    on('omni:extra-mesh-released', (d) => { if (d.kind === KIND_NOTE) this._meshes.delete(d.mesh) })
    this._syncAll(); SERVICES.note = this
  }
  destroy () {
    if (!this._inited) return
    this._bound.forEach(([n, h]) => window.removeEventListener(n, h)); this._bound = []
    this._persist.forEach(t => clearTimeout(t)); this._persist.clear(); this._undo.clear(); this._redo.clear(); this._state.clear(); this._images.clear()
    if (SERVICES.note === this) SERVICES.note = null
    this._inited = 0
  }
  onResize () { this._dirty = true }

  // ── store ──
  getNodeData (id) { return this.omniNode?.getNodeData?.(id) ?? null }
  isNoteNode (id) { return this.getNodeData(id)?.nodeKind === KIND_NOTE }
  listNoteNodes () { try { return (this.omniNode?.getAllNodes?.() ?? []).filter(d => d?.nodeKind === KIND_NOTE).map(d => d.id) } catch (_) { return [] } }
  getNote (id) {
    const d = this.getNodeData(id); if (!d || d.nodeKind !== KIND_NOTE) return null
    const raw = d.note
    if (!raw || typeof raw !== 'object') { const m = N.defaultNote(); this._sane.set(m, m); d.note = m; return m }
    let m = this._sane.get(raw); if (!m) { m = N.sanitizeNote(raw); this._sane.set(raw, m); this._sane.set(m, m) }
    return m
  }
  /** Replace parts of the note. Typing (html only) is coalesced into one undo step. */
  setNote (id, patch, reason = 'edit') {
    const cur = this.getNote(id); if (!cur) return { ok: false, error: 'That is not a note node.' }
    const next = N.setNote(cur, patch); if (JSON.stringify(next) === JSON.stringify(cur)) return { ok: true, same: true, note: cur }
    const typing = reason === 'type' && Object.keys(patch).length === 1 && 'html' in patch
    const t = nowMs()
    if (!(typing && this._coalesce && this._coalesce.id === id && t - this._coalesce.t < COALESCE_MS)) this._pushUndo(id, cur)
    this._coalesce = typing ? { id, t } : null
    return this._commit(id, next, reason)
  }
  setHtml (id, html, reason = 'type') { return this.setNote(id, { html: String(html ?? '') }, reason) }
  _commit (id, note, reason) {
    const d = this.getNodeData(id); if (!d) return { ok: false, error: 'Gone.' }
    this._sane.set(note, note); d.note = note; this._dirty = true
    this._announce(id, reason); this._persistSoon(id); return { ok: true, note }
  }
  _pushUndo (id, cur) { const st = this._undo.get(id) ?? []; st.push(cur); if (st.length > UNDO_MAX) st.shift(); this._undo.set(id, st); this._redo.delete(id) }
  canUndo (id) { return (this._undo.get(id)?.length ?? 0) > 0 }
  canRedo (id) { return (this._redo.get(id)?.length ?? 0) > 0 }
  undo (id) { const st = this._undo.get(id), cur = this.getNote(id); if (!cur || !st?.length) return { ok: false, error: 'Nothing to undo.' }; const prev = st.pop(); const rd = this._redo.get(id) ?? []; rd.push(cur); this._redo.set(id, rd); this._coalesce = null; return this._commit(id, prev, 'undo') }
  redo (id) { const rd = this._redo.get(id), cur = this.getNote(id); if (!cur || !rd?.length) return { ok: false, error: 'Nothing to redo.' }; const nx = rd.pop(); const st = this._undo.get(id) ?? []; st.push(cur); this._undo.set(id, st); this._coalesce = null; return this._commit(id, nx, 'redo') }
  _announce (id, reason) { try { window.dispatchEvent(new CustomEvent('omni:note-changed', { detail: { nodeId: id, reason } })) } catch (_) {} }
  _persistSoon (id) { clearTimeout(this._persist.get(id)); this._persist.set(id, setTimeout(() => this.flush(id), PERSIST_MS)) }
  flush (id) {
    if (id) { clearTimeout(this._persist.get(id)); this._persist.delete(id) }
    const d = id ? this.getNodeData(id) : null; if (!d) return false
    try { window.dispatchEvent(new CustomEvent('omni:force-save', { detail: {} })) } catch (_) {}
    try { window.dispatchEvent(new CustomEvent('omni:node-updated', { detail: { node: d } })) } catch (_) {}
    return true
  }

  // ── creating ──
  _facing () {
    try {
      const cam = this.ctx.camera; cam.updateMatrixWorld?.(true); const e = cam.matrixWorld.elements
      const z = new THREE.Vector3(e[8], e[9], e[10]).normalize(), y = new THREE.Vector3(e[4], e[5], e[6]).normalize()
      const x = new THREE.Vector3().crossVectors(y, z).normalize(), yy = new THREE.Vector3().crossVectors(z, x).normalize()
      const eu = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, yy, z)), 'XYZ')
      return [eu.x, eu.y, eu.z].map(v => (Number.isFinite(v) ? v : 0))
    } catch (_) { return [0, 0, 0] }
  }
  _positionFor (o) {
    const p = o.position
    if (Array.isArray(p) && p.length >= 3 && p.slice(0, 3).every(Number.isFinite)) return [p[0], p[1], p[2]]
    const cam = this.ctx.camera; const dir = new THREE.Vector3(); cam.getWorldDirection(dir)
    const q = cam.position.clone().addScaledVector(dir, PIN_DISTANCE); return [q.x, q.y, q.z]
  }
  _nextName () {
    const labels = new Set((this.omniNode?.getAllNodes?.() ?? []).filter(d => d?.nodeKind === KIND_NOTE).map(d => d.label))
    if (!labels.has('Note')) return 'Note'
    for (let i = 2; i < 999; i++) if (!labels.has(`Note ${i}`)) return `Note ${i}`
    return 'Note'
  }
  createNoteNode (opts = {}) {
    try {
      const o = opts && typeof opts === 'object' ? opts : {}
      const note = o.note && typeof o.note === 'object' ? N.sanitizeNote(o.note) : N.defaultNote()
      const nodeId = typeof o.id === 'string' && /^[\w-]{1,64}$/.test(o.id) ? o.id : newId()
      window.dispatchEvent(new CustomEvent('omni:node-create-request', { detail: {
        nodeKind: KIND_NOTE, note, id: nodeId, label: String(o.label || this._nextName()).slice(0, 40), geometry: GEO_NOTE, primitive: 'objective', color: NODE_COLOR,
        position: this._positionFor(o), rotation: this._facing(), scale: [1, 1, 1], noParent: true, noSelect: o.select !== true } }))
      if (this.omniNode && !this.omniNode.getNodeData?.(nodeId)) return { ok: false, error: 'The note node could not be created.' }
      this._dirty = true; return { ok: true, nodeId }
    } catch (err) { return { ok: false, error: String(err?.message ?? err) } }
  }
  _fixNode (d) { if (!d || d.nodeKind !== KIND_NOTE) return; if (!d.note || typeof d.note !== 'object' || Array.isArray(d.note)) { d.note = N.defaultNote(); this._persistSoon(d.id) } this._dirty = true }
  _syncAll () { try { for (const d of this.omniNode?.getAllNodes?.() ?? []) this._fixNode(d) } catch (_) {} }
  _onDeleted (id) { clearTimeout(this._persist.get(id)); this._persist.delete(id); this._undo.delete(id); this._redo.delete(id); this._state.delete(id) }

  // ── drawing ──
  _measure () {
    if (!this._measureCtx) { const c = typeof document !== 'undefined' ? document.createElement('canvas') : null; this._measureCtx = c?.getContext?.('2d') ?? null }
    const m = this._measureCtx
    return (font, text) => { if (m) { m.font = font; const w = m.measureText(text).width; if (Number.isFinite(w)) return w } return text.length * 8 }
  }
  _image (src) {
    let im = this._images.get(src); if (im) return im
    im = { el: null, w: 0, h: 0, ready: false }; this._images.set(src, im)
    if (typeof Image === 'undefined') return im
    const el = new Image(); el.onload = () => { im.el = el; im.w = el.naturalWidth || el.width || 160; im.h = el.naturalHeight || el.height || 100; im.ready = true; this._dirty = true; for (const st of this._state.values()) st.key = '' }
    el.onerror = () => { im.ready = false }; el.src = src
    return im
  }
  /** Draw one note into its sheet's canvas. Returns { height, pageW, pageH }. */
  render (mesh, note) {
    const v = mesh.userData.dnv; if (!v?.canvas) return null
    const pageW = note.res
    const blocks = N.htmlToBlocks(note.html)
    for (const b of blocks) for (const r of (b.runs ?? [])) if (r.img) this._image(r.img)
    const lay = layoutNote(blocks, note, { pageW, measure: this._measure(), images: this._images })
    const maxH = Math.min(MAX_PX_H, Math.round(pageW * Math.min(4, N.NOTE_LIMITS.aspectMax)))
    const pageH = note.fit === 'fixed' ? Math.round(pageW * note.aspect) : Math.max(Math.round(pageW * 0.25), Math.min(maxH, Math.ceil(lay.height)))
    v.canvas.width = pageW; v.canvas.height = Math.max(4, Math.min(maxH, pageH))
    const g = v.canvas.getContext?.('2d')
    if (g) {
      for (const o of lay.ops) if (o.t === 'img') o.el = this._images.get(o.src)?.el ?? null, o.ready = !!this._images.get(o.src)?.ready
      drawOps(g, lay.ops, note, pageW, v.canvas.height)
    }
    this._stats.draws++
    return { height: lay.height, pageW, pageH: v.canvas.height }
  }
  /** shape of the sheet for a note, in world units */
  sheetOf (note, pageW, pageH) { return { width: note.width, aspect: pageH / pageW } }

  update (delta) {
    this._lodT += Math.max(0, Number(delta) || 0)
    if (this._lodT < LOD_INTERVAL && !this._dirty) return
    this._lodT = 0; this._dirty = false; this._pass()
  }
  _pass () {
    const cam = this.ctx?.camera; const camPos = cam?.position
    for (const mesh of DOC_LIVE) {
      const id = mesh.userData?.nodeId; const v = mesh.userData?.dnv; if (!id || !v) continue
      const note = this.getNote(id); if (!note) continue
      let st = this._state.get(id); if (!st) { st = { key: '', drawn: false }; this._state.set(id, st) }
      const near = !camPos || mesh.position.distanceTo(camPos) < FAR
      const visible = mesh.visible !== false
      if (!near || !visible) { if (st.drawn) { clearPage(mesh); st.drawn = false; st.key = '' } continue }
      const key = JSON.stringify(note)
      if (key === st.key && st.drawn) continue
      const r = this.render(mesh, note); if (!r) continue
      const sh = this.sheetOf(note, r.pageW, r.pageH)
      applyDocLook(mesh, { width: sh.width, aspect: sh.aspect, paper: note.paper, sides: note.sides, frame: note.frame })
      setPageCanvas(mesh); st.key = key; st.drawn = true
    }
  }
}
