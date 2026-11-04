/**
 * utils/OmniSelectModel.js (V265) — pure state of the "select, then connect" tool (systems/OmniSelectMode.js).
 * Pick an ORIGIN node (tooltip menu > Select), then click other nodes. In phase 'select' picks are only collected; in phase 'connect' every pick also draws a real line:
 * pattern 'star' joins the origin to each pick, 'chain' joins each pick to the one before it (the first to the origin).
 *   newSelection(originId)                 -> state { origin, members[], phase, pattern, last, meaning }
 *   pick(state, id)                        -> { state, edges: [[from,to]...], action: 'added'|'removed'|'ignored' }   (select phase: toggles; connect phase: adds + one edge)
 *   startConnect(state)                    -> { state (phase 'connect'), edges }   joins everything already picked, then keeps connecting
 *   setPattern(state, 'star'|'chain'), clear(state), sanitizeSelection(raw)
 * Immutable; never throws; ids are strings of letters, digits, _ and -; at most MAX_MEMBERS picks.
 */
export const PATTERNS = Object.freeze(['star', 'chain'])
export const PHASES = Object.freeze(['select', 'connect'])
export const MAX_MEMBERS = 200
const BAD = new Set(['__proto__', 'constructor', 'prototype'])
const okId = (v) => typeof v === 'string' && /^[\w-]{1,80}$/.test(v) && !BAD.has(v)

export function sanitizeSelection (raw) {
  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  const origin = okId(r.origin) ? r.origin : null
  const members = []; for (const m of (Array.isArray(r.members) ? r.members : [])) { if (members.length >= MAX_MEMBERS) break; if (okId(m) && m !== origin && !members.includes(m)) members.push(m) }
  const pattern = PATTERNS.includes(r.pattern) ? r.pattern : 'star'; const phase = PHASES.includes(r.phase) ? r.phase : 'select'
  const last = okId(r.last) && (r.last === origin || members.includes(r.last)) ? r.last : (members.length ? members[members.length - 1] : origin)
  return { origin, members, phase, pattern, last, meaning: typeof r.meaning === 'string' && /^[\w-]{1,24}$/.test(r.meaning) ? r.meaning : 'link' }
}
export const newSelection = (originId) => sanitizeSelection({ origin: originId })
export const setPattern = (s, p) => sanitizeSelection({ ...s, pattern: p })
export const clear = (s) => sanitizeSelection({ origin: s?.origin, pattern: s?.pattern, meaning: s?.meaning })

const anchorFor = (s) => (s.pattern === 'chain' ? (s.last ?? s.origin) : s.origin)

export function pick (state, id) {
  const s = sanitizeSelection(state)
  if (!s.origin || !okId(id) || id === s.origin) return { state: s, edges: [], action: 'ignored' }
  if (s.phase === 'select') {
    if (s.members.includes(id)) { const m = s.members.filter(x => x !== id); return { state: sanitizeSelection({ ...s, members: m, last: m.length ? m[m.length - 1] : s.origin }), edges: [], action: 'removed' } }
    if (s.members.length >= MAX_MEMBERS) return { state: s, edges: [], action: 'ignored' }
    return { state: sanitizeSelection({ ...s, members: [...s.members, id], last: id }), edges: [], action: 'added' }
  }
  if (s.members.includes(id)) return { state: s, edges: [], action: 'ignored' }   // already joined
  if (s.members.length >= MAX_MEMBERS) return { state: s, edges: [], action: 'ignored' }
  const from = anchorFor(s)
  return { state: sanitizeSelection({ ...s, members: [...s.members, id], last: id }), edges: [[from, id]], action: 'added' }
}

export function startConnect (state) {
  const s = sanitizeSelection(state); if (!s.origin) return { state: s, edges: [] }
  const edges = []; let prev = s.origin
  for (const m of s.members) { edges.push([s.pattern === 'chain' ? prev : s.origin, m]); prev = m }
  return { state: sanitizeSelection({ ...s, phase: 'connect' }), edges }
}
export default { PATTERNS, PHASES, MAX_MEMBERS, sanitizeSelection, newSelection, pick, startConnect, setPattern, clear }
