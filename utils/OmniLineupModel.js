/**
 * utils/OmniLineupModel.js (V244) — pure model of LINEUPS and ATTACHMENTS (the skeleton side of the OmniVoxelNode, see docs/architecture/OMNISEMANTICS_DESIGN.md section 6).
 *   A lineup is an ordered list of node ids laid out on a shape (row, grid, tunnel, helix, sphereIn, sphereOut: utils/OmniDocPageLayouts.js, any count 1-60). Place in the order = the sequence number.
 *   An attachment is a node carried at another node's core: it keeps its offset from that node when the node moves.
 * state = { version, lineups: { [id]: { layout, center:[x,y,z], spacing, order:[nodeId...] } }, attach: { [nodeId]: { to, off:[x,y,z] } } }.  All ops are immutable, never throw, hostile-input and __proto__ safe, capped.
 */
import { layoutPages, pickLayout } from './OmniDocPageLayouts.js'

export const LIMITS = Object.freeze({ lineups: 32, perLineup: 60, attach: 400 })
const ID = /^[\w-]{1,64}$/
const BAD = new Set(['__proto__', 'constructor', 'prototype'])
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v)
const idOk = (v) => typeof v === 'string' && ID.test(v) && !BAD.has(v)
const vec = (v, d = [0, 0, 0]) => (Array.isArray(v) && v.length >= 3 && v.slice(0, 3).every(Number.isFinite) ? v.slice(0, 3).map(Number) : d)
export const emptyState = () => ({ version: 1, lineups: {}, attach: {} })

export function sanitizeState (raw) {
  const out = emptyState(); const r = isObj(raw) ? raw : {}
  const L = isObj(r.lineups) ? r.lineups : {}
  for (const id of Object.keys(L).slice(0, 200)) {
    if (!idOk(id) || Object.keys(out.lineups).length >= LIMITS.lineups) continue
    const l = L[id]; if (!isObj(l)) continue
    const order = []; for (const n of (Array.isArray(l.order) ? l.order : []).slice(0, 500)) if (idOk(n) && !order.includes(n) && order.length < LIMITS.perLineup) order.push(n)
    const sp = Number(l.spacing)
    out.lineups[id] = { layout: pickLayout(l.layout) ?? 'row', center: vec(l.center), spacing: Number.isFinite(sp) ? Math.min(60, Math.max(0.5, sp)) : 3, order }
  }
  const A = isObj(r.attach) ? r.attach : {}
  for (const id of Object.keys(A).slice(0, 2000)) {
    if (!idOk(id) || Object.keys(out.attach).length >= LIMITS.attach) continue
    const a = A[id]; if (!isObj(a) || !idOk(a.to) || a.to === id) continue
    out.attach[id] = { to: a.to, off: vec(a.off) }
  }
  for (const id of Object.keys(out.attach)) if (cycle(out.attach, id)) delete out.attach[id]
  return out
}
function cycle (att, id) { let x = id; for (let i = 0; i < 500; i++) { const a = att[x]; if (!a) return false; x = a.to; if (x === id) return true } return true }
const clone = (s) => sanitizeState(JSON.parse(JSON.stringify(s)))

export function createLineup (state, id, { layout = 'row', center = [0, 0, 0], spacing = 3, ids = [] } = {}) {
  if (!idOk(id)) return { ok: false, error: 'id: letters, digits, _ and - (max 64)' }
  const L = pickLayout(layout); if (!L) return { ok: false, error: 'layout: row, grid, tunnel, helix, sphereIn, sphereOut' }
  const s = clone(state); if (!s.lineups[id] && Object.keys(s.lineups).length >= LIMITS.lineups) return { ok: false, error: 'too many lineups (max 32)' }
  s.lineups[id] = { layout: L, center: vec(center), spacing, order: [] }
  const t = sanitizeState(s); const order = []; for (const n of ids) if (idOk(n) && !order.includes(n)) order.push(n)
  t.lineups[id].order = order.slice(0, LIMITS.perLineup)
  for (const k of Object.keys(t.lineups)) if (k !== id) t.lineups[k].order = t.lineups[k].order.filter(n => !t.lineups[id].order.includes(n))   // a node is in one lineup at a time
  return { ok: true, state: sanitizeState(t) }
}
export function deleteLineup (state, id) { const s = clone(state); if (!s.lineups[id]) return { ok: false, error: 'no lineup ' + id }; delete s.lineups[id]; return { ok: true, state: s } }
/** Put a node in a lineup at `index` (1-based sequence number; default last). A node moves from any other lineup (it is in one at a time). */
export function place (state, id, nodeId, index = null) {
  const s = clone(state); const l = s.lineups[id]; if (!l) return { ok: false, error: 'no lineup ' + id }
  if (!idOk(nodeId)) return { ok: false, error: 'bad node id' }
  for (const k of Object.keys(s.lineups)) s.lineups[k].order = s.lineups[k].order.filter(n => n !== nodeId)
  if (l.order.length >= LIMITS.perLineup) return { ok: false, error: 'lineup full (max 60)' }
  const i = index === null || !Number.isFinite(Number(index)) ? l.order.length : Math.min(l.order.length, Math.max(0, Math.round(Number(index)) - 1))
  l.order.splice(i, 0, nodeId); return { ok: true, state: s, index: i + 1 }
}
export function remove (state, id, nodeId) { const s = clone(state); const l = s.lineups[id]; if (!l || !l.order.includes(nodeId)) return { ok: false, error: 'not in that lineup' }; l.order = l.order.filter(n => n !== nodeId); return { ok: true, state: s } }
export const sequenceOf = (state, nodeId) => { for (const [id, l] of Object.entries(state.lineups)) { const i = l.order.indexOf(nodeId); if (i >= 0) return { lineup: id, index: i + 1 } } return null }
/** The slot position of every node of the lineup, in sequence order: { nodeId: [x,y,z] }. */
export function slotsOf (lineup) {
  const n = lineup.order.length; if (!n) return {}
  const plan = layoutPages({ layout: lineup.layout, count: n, width: lineup.spacing, aspect: 1, center: lineup.center, exact: true })
  const out = {}; lineup.order.forEach((id, i) => { out[id] = plan.pages[i].position }); return out
}
export function attach (state, nodeId, to, off) {
  if (!idOk(nodeId) || !idOk(to)) return { ok: false, error: 'bad node id' }
  if (nodeId === to) return { ok: false, error: 'a node cannot carry itself' }
  const s = clone(state); if (!s.attach[nodeId] && Object.keys(s.attach).length >= LIMITS.attach) return { ok: false, error: 'too many attachments' }
  s.attach[nodeId] = { to, off: vec(off) }
  if (cycle(s.attach, nodeId)) return { ok: false, error: 'that would make a loop of carried nodes' }
  return { ok: true, state: sanitizeState(s) }
}
export function detach (state, nodeId) { const s = clone(state); if (!s.attach[nodeId]) return { ok: false, error: 'not attached' }; delete s.attach[nodeId]; return { ok: true, state: s } }
export const carriedBy = (state, to) => Object.keys(state.attach).filter(k => state.attach[k].to === to)
/** Forget a deleted node everywhere. */
export function forget (state, nodeId) { const s = clone(state); for (const l of Object.values(s.lineups)) l.order = l.order.filter(n => n !== nodeId); delete s.attach[nodeId]; for (const k of Object.keys(s.attach)) if (s.attach[k].to === nodeId) delete s.attach[k]; return s }
export default { emptyState, sanitizeState, createLineup, deleteLineup, place, remove, sequenceOf, slotsOf, attach, detach, carriedBy, forget }
