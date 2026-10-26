/**
 * systems/OmniDimensionalSpaces.js — Dimensional Spaces and Planes (V217).
 *
 * A SPACE is a named pocket. It holds PLANES (layers) and the nodes assigned to them, and may carry a default CHANNEL (axiom + perspective): a Dimensional Node
 * inside it whose own axiom is blank inherits that channel. A PLANE can be hidden (its nodes vanish) or locked (its nodes stop being moved by behaviours).
 *
 *   createSpace(name) deleteSpace(id) renameSpace(id,name) setChannel(id, {axiom,perspective}|null)
 *   addPlane(spaceId,name) removePlane(spaceId,planeId) setPlane(spaceId,planeId,{name?,visible?,locked?})
 *   assign(nodeId, spaceId, planeId?) unassign(nodeId) spaceOf(nodeId) -> {space,plane}|null channelFor(nodeId) -> {axiom,perspective}|null
 * Events out: omni:spaces-changed. Registers Extra.SERVICES.spaces. Saved in localStorage 'omni:dimensional-spaces:v1' (membership is by node id; deleted nodes are pruned).
 * Hiding/locking only undoes what it did itself (userData.__dimHidden / __dimLocked), so it never fights another system.
 */
import { SERVICES } from '../utils/OmniExtraKinds.js'
import { AXIOM_IDS, getPerspective } from '../data/OmniAxiomData.js'

export const STORE_KEY = 'omni:dimensional-spaces:v1'
export const MAX = { spaces: 32, planes: 16, members: 2000 }
const nid = (p) => p + Math.random().toString(36).slice(2, 8)
const okId = (v) => typeof v === 'string' && /^[\w-]{1,24}$/.test(v)
const clip = (s, n) => String(s ?? '').replace(/[\u0000-\u001f<>]/g, ' ').trim().slice(0, n)
function cleanChannel (c) {
  if (!c || !AXIOM_IDS.includes(c.axiom)) return null
  return { axiom: c.axiom, perspective: c.perspective === '*' || !getPerspective(c.axiom, c.perspective) ? '*' : c.perspective }
}

export default class OmniDimensionalSpaces {
  constructor (context, omniNode = null) { this.ctx = context; this.omniNode = omniNode; this.spaces = []; this._bound = []; this._t = 0; this._inited = false }
  init () {
    if (this._inited) return; this._inited = true
    try {
      const s = JSON.parse(localStorage.getItem(STORE_KEY))
      if (s && Array.isArray(s.spaces)) this.spaces = s.spaces.slice(0, MAX.spaces).map(sp => this._clean(sp)).filter(Boolean)
    } catch (_) {}
    const on = (t, fn) => { const h = (e) => fn(e.detail ?? {}); window.addEventListener(t, h); this._bound.push([t, h]) }
    on('omni:node-created', () => { this._dirty = true }); on('omni:node-restored', () => { this._dirty = true })
    on('omni:node-deleted', (d) => { if (d.id && this.unassign(d.id, true)) this._changed() })
    SERVICES.spaces = this; this._dirty = true
  }
  destroy () {
    for (const [t, h] of this._bound) window.removeEventListener(t, h); this._bound = []
    this._release(); if (SERVICES.spaces === this) SERVICES.spaces = null; this._inited = false
  }
  onResize () {}
  _clean (sp) {
    if (!sp || typeof sp !== 'object') return null
    const planes = (Array.isArray(sp.planes) ? sp.planes : []).slice(0, MAX.planes).map(p => ({ id: okId(p?.id) ? p.id : nid('pl_'), name: clip(p?.name, 30) || 'Plane', visible: p?.visible !== false, locked: !!p?.locked }))
    if (!planes.length) planes.push({ id: nid('pl_'), name: 'Plane 1', visible: true, locked: false })
    const members = {}
    if (sp.members && typeof sp.members === 'object') for (const [k, v] of Object.entries(sp.members).slice(0, MAX.members)) if (planes.some(p => p.id === v)) members[k] = v
    return { id: okId(sp.id) ? sp.id : nid('sp_'), name: clip(sp.name, 30) || 'Space', channel: cleanChannel(sp.channel), planes, members }
  }
  _save () { try { localStorage.setItem(STORE_KEY, JSON.stringify({ spaces: this.spaces })) } catch (_) {} }
  _changed () { this._save(); this._dirty = true; this.apply(); try { window.dispatchEvent(new CustomEvent('omni:spaces-changed', { detail: {} })) } catch (_) {} }
  space (id) { return this.spaces.find(s => s.id === id) ?? null }

  createSpace (name) { if (this.spaces.length >= MAX.spaces) return null; const s = this._clean({ name: name || `Space ${this.spaces.length + 1}`, planes: [] }); this.spaces.push(s); this._changed(); return s }
  deleteSpace (id) { const i = this.spaces.findIndex(s => s.id === id); if (i < 0) return false; this._restore(this.spaces[i]); this.spaces.splice(i, 1); this._changed(); return true }
  renameSpace (id, name) { const s = this.space(id); if (!s) return false; s.name = clip(name, 30) || s.name; this._changed(); return true }
  setChannel (id, ch) { const s = this.space(id); if (!s) return false; s.channel = cleanChannel(ch); this._changed(); return true }
  addPlane (spaceId, name) {
    const s = this.space(spaceId); if (!s || s.planes.length >= MAX.planes) return null
    const p = { id: nid('pl_'), name: clip(name, 30) || `Plane ${s.planes.length + 1}`, visible: true, locked: false }; s.planes.push(p); this._changed(); return p
  }
  removePlane (spaceId, planeId) {
    const s = this.space(spaceId); if (!s || s.planes.length <= 1) return false
    const i = s.planes.findIndex(p => p.id === planeId); if (i < 0) return false
    const keep = s.planes.find(p => p.id !== planeId)
    for (const k of Object.keys(s.members)) if (s.members[k] === planeId) s.members[k] = keep.id
    s.planes.splice(i, 1); this._changed(); return true
  }
  setPlane (spaceId, planeId, patch = {}) {
    const p = this.space(spaceId)?.planes.find(x => x.id === planeId); if (!p) return false
    if (typeof patch.name === 'string') p.name = clip(patch.name, 30) || p.name
    if (typeof patch.visible === 'boolean') p.visible = patch.visible
    if (typeof patch.locked === 'boolean') p.locked = patch.locked
    this._changed(); return true
  }
  assign (nodeId, spaceId, planeId) {
    const s = this.space(spaceId); if (!s || typeof nodeId !== 'string' || !nodeId) return false
    const plane = planeId ?? s.planes[0].id; if (!s.planes.some(p => p.id === plane)) return false
    this.unassign(nodeId, true); if (Object.keys(s.members).length >= MAX.members) return false
    s.members[nodeId] = plane; this._changed(); return true
  }
  unassign (nodeId, quiet = false) {
    let any = false
    for (const s of this.spaces) if (nodeId in s.members) { delete s.members[nodeId]; any = true }
    if (any) this._restoreNode(nodeId)
    if (any && !quiet) this._changed()
    return any
  }
  spaceOf (nodeId) {
    for (const s of this.spaces) { const pid = s.members[nodeId]; if (pid) return { space: s, plane: s.planes.find(p => p.id === pid) } }
    return null
  }
  channelFor (nodeId) { return this.spaceOf(nodeId)?.space.channel ?? null }

  // ── effects ──
  _mesh (id) { return this.omniNode?.getMeshById?.(id) ?? null }
  apply () {
    this._dirty = false
    for (const s of this.spaces) {
      for (const [id, pid] of Object.entries(s.members)) {
        const m = this._mesh(id); if (!m) continue
        const pl = s.planes.find(p => p.id === pid); if (!pl) continue
        if (!pl.visible) { if (m.visible) { m.visible = false; m.userData.__dimHidden = true } }
        else if (m.userData.__dimHidden) { m.visible = true; delete m.userData.__dimHidden }
        if (pl.locked) { if (!m.userData.behaviorLocked) { m.userData.behaviorLocked = true; m.userData.__dimLocked = true } }
        else if (m.userData.__dimLocked) { delete m.userData.behaviorLocked; delete m.userData.__dimLocked }
      }
    }
  }
  _restoreNode (id) {
    const m = this._mesh(id); if (!m) return
    if (m.userData.__dimHidden) { m.visible = true; delete m.userData.__dimHidden }
    if (m.userData.__dimLocked) { delete m.userData.behaviorLocked; delete m.userData.__dimLocked }
  }
  _restore (s) { for (const id of Object.keys(s.members)) this._restoreNode(id) }
  _release () { for (const s of this.spaces) this._restore(s) }
  update (dt = 0.016) {
    this._t += dt
    if (this._dirty || this._t > 1) { this._t = 0; if (this.spaces.length) this.apply(); this._dirty = false }
  }
}
