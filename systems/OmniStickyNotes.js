/**
 * systems/OmniStickyNotes.js (V266) — sticky notes: small coloured OmniNotes you can stick on any node. A sticky is an ordinary NoteNode (rich text, Inspector, undo: systems/OmniNoteNodes.js)
 * made from a preset (utils/OmniStickyModel.js) and, if you give it a target, joined to that node with a plain line and FOLLOWING it: move the node and the sticky comes along;
 * drag the sticky and it keeps its new place relative to the node. Detach and it stays where it is. The attach is saved in node.data.sticky = { attach: { to, off } }.
 *   SERVICES.sticky: create({ text, title, color, target, position, select }) -> { ok, nodeId } · attach(id, targetId) · detach(id) · setText(id, text) · setColor(id, color) · list() · attachOf(id)
 *   Events in: omni:sticky-note-create { target?, useSelected?, text?, color?, select? } (answer in detail.out) · Out: omni:sticky-changed { nodeId, reason }.   Commands: Omni Sticky ...
 */
import * as THREE from 'three'
import * as SM from '../utils/OmniStickyModel.js'
import * as N from '../utils/OmniNoteModel.js'
import * as LM from '../utils/OmniLineModel.js'
import { SERVICES } from '../utils/OmniExtraKinds.js'

const send = (n, d) => { try { window.dispatchEvent(new CustomEvent(n, { detail: d })) } catch (_) { /* no window */ } }
const newId = () => 'sticky_' + Math.random().toString(36).slice(2, 8)
const SCAN_MS = 1000, PERSIST_MS = 300

export default class OmniStickyNotes {
  constructor (context, omniNode = null) { this.ctx = context; this.omniNode = omniNode ?? context?.omniNode ?? null; this._att = new Map(); this._last = new Map(); this._persist = new Map(); this._bound = []; this._inited = false; this._scanAt = 0; this._tmp = new THREE.Vector3() }
  init () {
    if (this._inited) return; this._inited = true
    const on = (n, fn) => { const h = (e) => fn(e.detail ?? {}, e); window.addEventListener(n, h); this._bound.push([n, h]) }
    on('omni:sticky-note-create', (d, e) => { const out = this.create(d); if (e.detail && typeof e.detail === 'object') e.detail.out = out })
    on('omni:node-created', () => { this._scanAt = 0 }); on('omni:node-deleted', (d) => this._gone(d.id)); on('omni:scene-clear-request', () => { this._att.clear(); this._last.clear() })
    SERVICES.sticky = this
  }
  destroy () { for (const t of this._persist.values()) clearTimeout(t); this._persist.clear(); for (const [n, h] of this._bound) window.removeEventListener(n, h); this._bound = []; if (SERVICES.sticky === this) SERVICES.sticky = null; this._inited = false }
  onResize () {}
    _data (id) { return this.omniNode?.getNodeData?.(id) ?? null }
  _worldPos (id) { const m = this.omniNode?.getMeshById?.(id); if (!m) return null; const v = m.getWorldPosition(new THREE.Vector3()); return [v.x, v.y, v.z] }
  attachOf (id) { const a = this._att.get(id); return a ? { to: a.to, off: [...a.off] } : null }
  list () { return [...this._att.entries()].map(([id, a]) => ({ id, to: a.to })) }

  /** make a sticky. target: a node id to stick it on. position: [x,y,z] when there is no target. */
  create (opts = {}) {
    try {
      const o = opts && typeof opts === 'object' ? opts : {}
      let want = o.target; if (want === undefined && o.useSelected) want = this.omniNode?.getSelectedId?.() ?? null
      const target = typeof want === 'string' && this._data(want) ? want : null
      const tp = target ? this._worldPos(target) : null
      const count = target ? [...this._att.values()].filter(a => a.to === target).length : 0
      const off = target ? SM.defaultOffset(count) : null
      const position = tp ? SM.followPosition(tp, off) : (Array.isArray(o.position) ? o.position : undefined)
      const note = N.sanitizeNote({ ...N.defaultNote(), ...SM.stickyNote({ text: o.text ?? '', title: o.title, color: o.color }) })
      const id = typeof o.id === 'string' && /^[\w-]{1,64}$/.test(o.id) ? o.id : newId()
      const detail = { note, label: 'Sticky', position, select: o.select === true, id }
      window.dispatchEvent(new CustomEvent('omni:note-node-create', { detail }))
      const res = detail.out
      if (!res?.ok) return res ?? { ok: false, error: 'The sticky could not be made (is the note module running?).' }
      const nodeId = res.nodeId
      if (target) this.attach(nodeId, target, off)
      send('omni:sticky-changed', { nodeId, reason: 'created' }); return { ok: true, nodeId, target }
    } catch (err) { return { ok: false, error: String(err?.message ?? err) } }
  }
  attach (id, targetId, off = null) {
    const d = this._data(id); if (!d || d.nodeKind !== 'noteNode') throw new Error('That is not a note.')
    if (!this._data(targetId) || targetId === id) throw new Error('Pick another node to stick it on.')
    const tp = this._worldPos(targetId); const mp = this._worldPos(id)
    const a = SM.sanitizeAttach({ to: targetId, off: off ?? (tp && mp ? SM.offsetFrom(tp, mp) : null) }); if (!a) throw new Error('Could not attach.')
    this._att.set(id, a); this._last.delete(id); d.sticky = { ...(d.sticky && typeof d.sticky === 'object' ? d.sticky : {}), attach: a }
    if (this.omniNode?.connectNodes?.(id, targetId)) this.omniNode?.setEdgeStyle?.(id, targetId, LM.applyMeaning(null, 'note'))   // V268: the line says "note"
    this._persistSoon(id); send('omni:sticky-changed', { nodeId: id, reason: 'attached' }); return true
  }
  detach (id) {
    const a = this._att.get(id); if (!a) return false
    this._att.delete(id); this._last.delete(id); const d = this._data(id); if (d?.sticky) { delete d.sticky.attach }
    this.omniNode?.disconnectNodes?.(id, a.to); this._persistSoon(id); send('omni:sticky-changed', { nodeId: id, reason: 'detached' }); return true
  }
  setText (id, text) { const n = SERVICES.note; const cur = n?.getNote?.(id); if (!cur) throw new Error('That is not a note.'); const p = SM.stickyNote({ text, color: null }); n.setNote(id, { html: p.html }); return true }
  setColor (id, color) { const n = SERVICES.note; if (!n?.getNote?.(id)) throw new Error('That is not a note.'); n.setNote(id, { paper: SM.colorOf(color) }); return true }
  _gone (id) {
    if (this._att.delete(id)) this._last.delete(id)
    for (const [sid, a] of [...this._att]) if (a.to === id) { this._att.delete(sid); this._last.delete(sid); const d = this._data(sid); if (d?.sticky) delete d.sticky.attach; this._persistSoon(sid) }   // the node it was on is gone: the sticky stays where it is
  }
  _persistSoon (id) { clearTimeout(this._persist.get(id)); this._persist.set(id, setTimeout(() => { this._persist.delete(id); const d = this._data(id); if (!d) return; send('omni:force-save', {}); send('omni:node-updated', { node: d }) }, PERSIST_MS)) }
  _scan () {
    for (const d of this.omniNode?.getAllNodes?.() ?? []) {
      if (d?.nodeKind !== 'noteNode' || !d.sticky) continue
      const a = SM.sanitizeAttach(d.sticky.attach)
      if (a && this._data(a.to)) { if (!this._att.has(d.id)) this._att.set(d.id, a) } else if (this._att.has(d.id)) { this._att.delete(d.id); this._last.delete(d.id) }
    }
  }
  update () {
    if (!this._inited) return
    const now = performance.now(); if (now > this._scanAt) { this._scanAt = now + SCAN_MS; this._scan() }
    for (const [id, a] of this._att) {
      const m = this.omniNode?.getMeshById?.(id); const tp = this._worldPos(a.to); if (!m || !tp) continue
      const last = this._last.get(id)
      if (last && (Math.abs(m.position.x - last[0]) + Math.abs(m.position.y - last[1]) + Math.abs(m.position.z - last[2])) > 0.02) {   // the sticky was dragged: keep its new place relative to the node
        a.off = SM.offsetFrom(tp, [m.position.x, m.position.y, m.position.z]); const d = this._data(id); if (d?.sticky) d.sticky.attach = { to: a.to, off: [...a.off] }; this._persistSoon(id)
      }
      const want = SM.followPosition(tp, a.off)
      if (Math.abs(m.position.x - want[0]) + Math.abs(m.position.y - want[1]) + Math.abs(m.position.z - want[2]) > 1e-4) { m.position.set(want[0], want[1], want[2]); m.userData?.restPosition?.copy?.(m.position) }
      this._last.set(id, [m.position.x, m.position.y, m.position.z])
    }
  }
}
