/**
 * utils/OmniVonModel.js (V285, DESIGN-FIRST: see claude/OMNIVON_DESIGN.md) — the OmniVon: a coordinate in many dimensions, written as an equation of Unicode symbols.
 * Pure: no DOM, no three.js. Nothing in the app uses it yet.
 *
 *   OmniVon = { terms: [{ symbol, value }], level, place, t }
 *     terms  the combination of symbols that describes the reality (each axiom in use adds a term; two perspectives of one axiom are two terms)
 *            symbol  1 to 3 code points, no spaces, none of  : + ( ) = "   (an undefined symbol is still a valid symbol: it is just "not yet defined", known:false)
 *            value   optional: a number or a word / phrase (the perspective, the amount)
 *     level  the scale, -3 (subatomic) .. 0 (planet, neutral) .. +3 (galaxy)
 *     place  [x, y, z] inside that level           t  seconds on liveTime (the reality's real-world clock), or null
 *
 *   Text form (round-trips):   ⟐ L-1 @(2,0,5) t=12.5  ▦:Room  ⧖:"Real time"  ◉:3  ⟐N
 *     the leading ⟐ ("the reality of") is optional on input and always printed; L<n> is the level; @(x,y,z) the place; t=<seconds>; every other token is a term.
 *
 * Also here: the seven-scale ladder, the liveTime clock mapping that nested timelines use, and the nesting guard (no cycles, depth cap).
 */
export const REALITY_OF = '⟐'
export const LEVELS = Object.freeze([
  { n: -3, name: 'subatomic' }, { n: -2, name: 'atomic' }, { n: -1, name: 'cellular' }, { n: 0, name: 'planet' },
  { n: 1, name: 'solar system' }, { n: 2, name: 'multi solar system' }, { n: 3, name: 'galaxy' },
])
export const levelName = (n) => LEVELS.find(l => l.n === n)?.name ?? ''
/** the axioms that exist in code today (data/OmniAxiomData.js) and the lens; anything else is "not yet defined" until someone defines it */
export const KNOWN = Object.freeze({ '◉': 'Identity', 'ⓘ': 'Information', '▦': 'Space', '⧖': 'Time', '\u26a1': 'Power', '❖': 'Expression', '⟐N': 'Lens (how the mind perceives the reality)' })
export const LIMITS = Object.freeze({ terms: 64, symbolPoints: 3, value: 48, place: 1e9, t: 1e9 })

const BAD = /[\s:+()="\u0000-\u001f\u007f]/
const own = (o, k) => o && typeof o === 'object' && Object.prototype.hasOwnProperty.call(o, k) ? o[k] : undefined
const clampNum = (v, lim, d) => { const n = typeof v === 'number' ? v : (typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN); return Number.isFinite(n) ? Math.max(-lim, Math.min(lim, n)) : d }

export function cleanSymbol (v) {
  if (typeof v !== 'string') return ''
  const s = v.trim(); const pts = Array.from(s); if (!pts.length || pts.length > LIMITS.symbolPoints || s === REALITY_OF) return ''
  return BAD.test(s) ? '' : s
}
const cleanValue = (v) => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v !== 'string') return null
  const s = v.replace(/[\u0000-\u001f\u007f"]/g, '').trim().slice(0, LIMITS.value); if (!s) return null
  return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : s
}
export function sanitizeTerm (raw) {
  const r = raw && typeof raw === 'object' ? raw : {}; const symbol = cleanSymbol(own(r, 'symbol')); if (!symbol) return null
  return { symbol, value: cleanValue(own(r, 'value')) }
}
/** never throws, idempotent, no prototype pollution */
export function sanitizeOmniVon (raw) {
  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  const list = Array.isArray(own(r, 'terms')) ? r.terms.slice(0, LIMITS.terms * 2) : []
  const terms = []; for (const t of list) { const c = sanitizeTerm(t); if (c) terms.push(c); if (terms.length >= LIMITS.terms) break }
  const lv = Math.round(clampNum(own(r, 'level'), 3, 0)); const pl = Array.isArray(own(r, 'place')) ? r.place : []
  const t = own(r, 't'); const tt = t === null || t === undefined ? null : clampNum(t, LIMITS.t, null)
  return { terms, level: lv, place: [clampNum(pl[0], LIMITS.place, 0), clampNum(pl[1], LIMITS.place, 0), clampNum(pl[2], LIMITS.place, 0)], t: tt }
}

// ── text form ──
const fmtNum = (n) => String(Math.round(n * 1e6) / 1e6)
export function printOmniVon (von) {
  const v = sanitizeOmniVon(von); const parts = [REALITY_OF, 'L' + v.level]
  if (v.place.some(x => x !== 0)) parts.push(`@(${v.place.map(fmtNum).join(',')})`)
  if (v.t !== null) parts.push('t=' + fmtNum(v.t))
  for (const t of v.terms) { if (t.value === null) parts.push(t.symbol); else parts.push(t.symbol + ':' + (typeof t.value === 'number' ? fmtNum(t.value) : /^[^\s]+$/.test(t.value) && !/^-?\d+(\.\d+)?$/.test(t.value) ? t.value : '"' + t.value + '"')) }
  return parts.join(' ')
}
function tokens (text) {
  const out = []; const s = String(text ?? ''); let i = 0
  while (i < s.length) {
    if (/\s/.test(s[i])) { i++; continue }
    let j = i, q = false
    while (j < s.length && (q || !/\s/.test(s[j]))) { if (s[j] === '"' && (q || s.indexOf('"', j + 1) !== -1)) q = !q; j++ }   // a quote only groups when it is closed later: an unclosed one never swallows the rest
    out.push(s.slice(i, j)); i = j
  }
  return out
}
/** { von, problems:[string] } — never throws; a token it cannot read is reported and skipped, never guessed */
export function parseOmniVon (text) {
  const problems = []; const raw = { terms: [], level: 0, place: [0, 0, 0], t: null }
  const toks = tokens(String(text ?? '').slice(0, 20000))
  for (let k = 0; k < toks.length; k++) {
    const tok = toks[k]
    if (tok === REALITY_OF && k === 0) continue
    if (tok === '+') continue
    let m
    if ((m = /^L(-?\d)$/.exec(tok))) { const n = Number(m[1]); if (n < -3 || n > 3) problems.push(`level ${n} is outside -3..3`); else raw.level = n; continue }
    if ((m = /^@\((.*)\)$/.exec(tok))) { const p = m[1].split(',').map(Number); if (p.length === 3 && p.every(Number.isFinite)) raw.place = p; else problems.push('place needs three numbers: @(x,y,z)'); continue }
    if ((m = /^t=(-?[\d.]+)$/.exec(tok))) { const n = Number(m[1]); if (Number.isFinite(n)) raw.t = n; else problems.push('t= needs a number'); continue }
    const ci = tok.indexOf(':'); const sym = ci < 0 ? tok : tok.slice(0, ci); let val = ci < 0 ? null : tok.slice(ci + 1)
    if (val !== null && val.length >= 2 && val[0] === '"' && val[val.length - 1] === '"') val = val.slice(1, -1)
    if (!cleanSymbol(sym)) { problems.push(`"${tok.slice(0, 20)}" is not a symbol`); continue }
    raw.terms.push({ symbol: sym, value: val })
  }
  const von = sanitizeOmniVon(raw); if (raw.terms.length > von.terms.length) problems.push(`only the first ${LIMITS.terms} terms are kept`)
  return { von, problems }
}
export const isKnown = (symbol) => Object.prototype.hasOwnProperty.call(KNOWN, symbol)
/** which terms are not defined yet (the honest blank) */
export const undefinedTerms = (von) => sanitizeOmniVon(von).terms.filter(t => !isKnown(t.symbol)).map(t => t.symbol)
/** the terms of one aspect: hone in */
export const aspect = (von, symbol) => { const v = sanitizeOmniVon(von); return { ...v, terms: v.terms.filter(t => t.symbol === symbol) } }
/** two OmniVons agree on every term the first one has (a reality seen from a narrower view still matches the whole) */
export const contains = (whole, part) => { const w = sanitizeOmniVon(whole), p = sanitizeOmniVon(part); return p.terms.every(pt => w.terms.some(wt => wt.symbol === pt.symbol && (pt.value === null || pt.value === wt.value))) }

// ── liveTime and nested clocks ──
/**
 * A clock maps its parent's time to its own: local = (parent - offset) * rate; with loop and a length it wraps; without loop it is null before it starts and holds the last moment after it ends.
 * Returns local seconds or null (not started).
 */
export function clockAt (clock, parentT) {
  const c = clock && typeof clock === 'object' ? clock : {}; const offset = clampNum(own(c, 'offset'), 1e9, 0); const rate = clampNum(own(c, 'rate'), 1e6, 1); const len = Math.max(0, clampNum(own(c, 'length'), 1e9, 0))
  const p = Number.isFinite(parentT) ? parentT : 0; let local = (p - offset) * rate
  if (local < 0) return null
  if (len > 0) local = own(c, 'loop') === true ? local % len : Math.min(local, len)
  return local
}
/** the time inside nested clocks, outermost first: liveTime -> parent -> child -> grandchild */
export function nestedTime (clocks, liveT) { let t = liveT; for (const c of Array.isArray(clocks) ? clocks.slice(0, 8) : []) { t = clockAt(c, t); if (t === null) return null } return t }

// ── nesting guard ──
export const MAX_DEPTH = 3
/**
 * May `childId` be placed inside `parentId`? graph = { id: [child ids] } (what is already nested).
 * Refused when it would make a cycle (including a node inside itself) or make the nest deeper than MAX_DEPTH levels below any node above.
 * Returns { ok, reason }.
 */
export function canNest (graph, parentId, childId, maxDepth = MAX_DEPTH) {
  const g = graph && typeof graph === 'object' ? graph : {}; const kids = (id) => (Array.isArray(own(g, id)) ? g[id] : [])
  if (parentId === childId) return { ok: false, reason: 'A node cannot contain itself.' }
  const seen = new Set(); const stack = [childId]
  while (stack.length) { const n = stack.pop(); if (n === parentId) return { ok: false, reason: 'That would make a loop: the child already contains the parent.' }; if (seen.has(n)) continue; seen.add(n); for (const k of kids(n)) stack.push(k) }
  const below = (id, d = 0, guard = new Set()) => { if (guard.has(id) || d > 20) return d; guard.add(id); let m = d; for (const k of kids(id)) m = Math.max(m, below(k, d + 1, guard)); return m }
  const up = (id, guard = new Set()) => { if (guard.has(id)) return 0; guard.add(id); let m = 0; for (const p of Object.keys(g)) if (kids(p).includes(id)) m = Math.max(m, 1 + up(p, guard)); return m }
  const depth = up(parentId) + 1 + below(childId)
  return depth > maxDepth ? { ok: false, reason: `That would nest ${depth} levels deep; the limit is ${maxDepth}.` } : { ok: true, reason: '' }
}
