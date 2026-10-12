/**
 * OmniAddress (V189) — pure reality-address model for Omni⟐City. NO DOM, NO storage, NO imports.
 * Design: docs/architecture/OMNICITY_DESIGN.md (sections 3 and 4).
 *
 * An address = LOCATION (typed segments from the origin) + optional DRAWER + PERSPECTIVES (a layer stack).
 *
 *   0mni:C0/B1/S1#4@chronos(1980s,1984)@state(wrecked)
 *   └ns ┘└location ┘└d┘└ perspective 1 ──┘└ perspective 2 ┘
 *
 * Segment      := TypeCode Ordinal                 (C0, B1, S1)   core must be first and only first, ordinal 0
 * Drawer       := "#" 0..7                         (fixed standard drawers, see DRAWERS)
 * Perspective  := "@" productId [ "(" params ")" ] (productId lower-case, params comma separated, order = layer order)
 *
 * The canonical form is ASCII only so it is safe in URLs, ids, file names and database keys.
 * The ⟐ glyph is DISPLAY ONLY (formatDisplay). TYPE CODES ARE PLACEHOLDERS (design open question 2): they live in
 * TYPES below and nowhere else, so the final symbols are a one-table change.
 *
 * Nothing here is security. An address is a name, not a permission (design section 7).
 * Parsing never throws: parse() returns { ok:true, address } or { ok:false, error, at }.
 */

export const NAMESPACE = '0mni'
export const MAX_LENGTH = 512
export const MAX_DEPTH = 32            // segments including the core
export const MAX_ORDINAL = 1_000_000_000
export const MAX_PERSPECTIVES = 8
export const MAX_PARAMS = 8
export const MAX_PARAM_LENGTH = 32
export const EYE = '◉'                 // display placeholder for the perspective (eye) symbol, design open question 2

/** Placeholder type table. code -> meaning. 'core' is the origin / Reality Core. */
export const TYPES = Object.freeze({ C: 'core', B: 'branch', S: 'space' })

/** The 8 fixed drawers every context has (design 4.3). Codes 0-7. */
export const DRAWERS = Object.freeze(['ToBeSorted', 'Admin', 'Templates', 'Database', 'States', 'Resources', 'Store', 'Program'])

const RE_SEGMENT = /^([A-Z])(0|[1-9][0-9]{0,9})$/
const RE_PRODUCT = /^[a-z][a-z0-9]{0,23}$/
const RE_PARAM = /^[A-Za-z0-9._:-]{1,32}$/

const fail = (error, at = 0) => ({ ok: false, error, at })
const ok = (address) => ({ ok: true, address })

function freezeAddress(a) {
  return Object.freeze({
    segments: Object.freeze(a.segments.map(s => Object.freeze({ type: s.type, ordinal: s.ordinal }))),
    drawer: a.drawer,
    perspectives: Object.freeze(a.perspectives.map(p => Object.freeze({ product: p.product, params: Object.freeze([...p.params]) }))),
  })
}

/** Validate a plain address object. Returns { ok:true, address(frozen copy) } or { ok:false, error }. */
export function validate(input) {
  if (!input || typeof input !== 'object') return fail('not-an-address')
  const segs = input.segments
  if (!Array.isArray(segs) || segs.length === 0) return fail('no-segments')
  if (segs.length > MAX_DEPTH) return fail('too-deep')
  const segments = []
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i]
    if (!s || typeof s !== 'object') return fail('bad-segment', i)
    if (typeof s.type !== 'string' || !Object.prototype.hasOwnProperty.call(TYPES, s.type)) return fail('unknown-type', i)
    if (!Number.isInteger(s.ordinal) || s.ordinal < 0 || s.ordinal > MAX_ORDINAL) return fail('bad-ordinal', i)
    const isCore = TYPES[s.type] === 'core'
    if (i === 0 && !isCore) return fail('must-start-at-core', 0)
    if (i > 0 && isCore) return fail('core-only-first', i)
    if (isCore && s.ordinal !== 0) return fail('core-ordinal-must-be-0', i)
    if (!isCore && s.ordinal === 0) return fail('ordinal-0-reserved', i)   // ordinals under a parent start at 1
    segments.push({ type: s.type, ordinal: s.ordinal })
  }
  let drawer = null
  if (input.drawer !== null && input.drawer !== undefined) {
    if (!Number.isInteger(input.drawer) || input.drawer < 0 || input.drawer >= DRAWERS.length) return fail('bad-drawer')
    drawer = input.drawer
  }
  const pin = input.perspectives === undefined ? [] : input.perspectives
  if (!Array.isArray(pin)) return fail('bad-perspectives')
  if (pin.length > MAX_PERSPECTIVES) return fail('too-many-perspectives')
  const perspectives = []
  const seen = new Set()
  for (let i = 0; i < pin.length; i++) {
    const p = pin[i]
    if (!p || typeof p !== 'object' || typeof p.product !== 'string' || !RE_PRODUCT.test(p.product)) return fail('bad-product', i)
    if (seen.has(p.product)) return fail('duplicate-product', i)
    seen.add(p.product)
    const params = p.params === undefined ? [] : p.params
    if (!Array.isArray(params) || params.length > MAX_PARAMS) return fail('bad-params', i)
    for (const q of params) if (typeof q !== 'string' || q.length > MAX_PARAM_LENGTH || !RE_PARAM.test(q)) return fail('bad-param', i)
    perspectives.push({ product: p.product, params: [...params] })
  }
  const address = freezeAddress({ segments, drawer, perspectives })
  if (serialize(address).length > MAX_LENGTH) return fail('too-long')
  return ok(address)
}

/** Canonical ASCII string. Assumes a valid address (use validate / parse to get one). */
export function serialize(a) {
  let s = NAMESPACE + ':' + a.segments.map(x => x.type + x.ordinal).join('/')
  if (a.drawer !== null && a.drawer !== undefined) s += '#' + a.drawer
  for (const p of a.perspectives || []) s += '@' + p.product + (p.params.length ? '(' + p.params.join(',') + ')' : '')
  return s
}

/** Strict parse of the canonical form. Never throws. */
export function parse(text) {
  if (typeof text !== 'string') return fail('not-a-string')
  if (text.length > MAX_LENGTH) return fail('too-long')
  const prefix = NAMESPACE + ':'
  if (!text.startsWith(prefix)) return fail('bad-namespace')
  let i = prefix.length
  // location = up to the first '#' or '@'
  let end = i
  while (end < text.length && text[end] !== '#' && text[end] !== '@') end++
  const locText = text.slice(i, end)
  if (!locText) return fail('no-segments', i)
  const segments = []
  let pos = i
  for (const part of locText.split('/')) {
    const m = RE_SEGMENT.exec(part)
    if (!m) return fail('bad-segment', pos)
    segments.push({ type: m[1], ordinal: Number(m[2]) })
    pos += part.length + 1
  }
  i = end
  let drawer = null
  if (text[i] === '#') {
    const m = /^#([0-9])(?![0-9])/.exec(text.slice(i))
    if (!m) return fail('bad-drawer', i)
    drawer = Number(m[1])
    i += 2
  }
  const perspectives = []
  while (i < text.length) {
    if (text[i] !== '@') return fail('unexpected-character', i)
    const m = /^@([a-z][a-z0-9]*)(?:\(([^()@#/]*)\))?/.exec(text.slice(i))
    if (!m) return fail('bad-perspective', i)
    const params = m[2] === undefined ? [] : (m[2] === '' ? null : m[2].split(','))
    if (params === null) return fail('empty-params', i)
    perspectives.push({ product: m[1], params })
    i += m[0].length
  }
  return validate({ segments, drawer, perspectives })
}

// ---------------------------------------------------------------- tree helpers (all return validated, frozen addresses or null)

const rebuild = (a, patch) => { const r = validate({ segments: a.segments, drawer: a.drawer, perspectives: a.perspectives, ...patch }); return r.ok ? r.address : null }

/** The origin / Reality Core: 0mni:C0 */
export function origin() { return validate({ segments: [{ type: 'C', ordinal: 0 }] }).address }
/** Parent location (drawer and perspectives dropped), or null at the origin. */
export function parent(a) { return a.segments.length < 2 ? null : rebuild(a, { segments: a.segments.slice(0, -1), drawer: null, perspectives: [] }) }
/** Child location one level down (drawer and perspectives dropped), or null if invalid. */
export function child(a, type, ordinal) { return rebuild(a, { segments: [...a.segments, { type, ordinal }], drawer: null, perspectives: [] }) }
export function withDrawer(a, drawer) { return rebuild(a, { drawer }) }
/** Add a perspective on top of the stack, or replace the params of an existing product in place. */
export function withPerspective(a, product, params = []) {
  const list = a.perspectives.map(p => ({ product: p.product, params: [...p.params] }))
  const at = list.findIndex(p => p.product === product)
  if (at >= 0) list[at] = { product, params: [...params] }; else list.push({ product, params: [...params] })
  return rebuild(a, { perspectives: list })
}
export function withoutPerspective(a, product) { return rebuild(a, { perspectives: a.perspectives.filter(p => p.product !== product) }) }
/** The same place with no drawer and no perspective: the location alone. */
export function location(a) { return rebuild(a, { drawer: null, perspectives: [] }) }

const locKey = a => a.segments.map(s => s.type + s.ordinal).join('/')
/** Same place (location only), regardless of drawer or perspective. */
export function sameLocation(a, b) { return locKey(a) === locKey(b) }
/** Same place AND same drawer AND same perspective stack in the same order. */
export function equals(a, b) { return serialize(a) === serialize(b) }
/** True when a's location is a strict ancestor of b's location. */
export function isAncestor(a, b) { return a.segments.length < b.segments.length && a.segments.every((s, i) => s.type === b.segments[i].type && s.ordinal === b.segments[i].ordinal) }
/** Tree order of locations: ancestors first, then by ordinal at the first difference. Returns -1, 0 or 1. */
export function compareLocation(a, b) {
  const n = Math.min(a.segments.length, b.segments.length)
  for (let i = 0; i < n; i++) {
    const x = a.segments[i], y = b.segments[i]
    if (x.type !== y.type) return x.type < y.type ? -1 : 1
    if (x.ordinal !== y.ordinal) return x.ordinal < y.ordinal ? -1 : 1
  }
  return a.segments.length === b.segments.length ? 0 : (a.segments.length < b.segments.length ? -1 : 1)
}

/**
 * Human display form. names: optional array of display names, one per segment (e.g. ['Omni⟐City','Omni⟐StarHQ','MainLobby']).
 * Missing names fall back to the canonical segment. Names are joined with '_' (display only; never parsed back).
 * Drawer shows as ' #Name'; each perspective as ' ◉product(params)'.
 */
export function formatDisplay(a, names = []) {
  let s = a.segments.map((x, i) => (typeof names[i] === 'string' && names[i] ? names[i] : x.type + x.ordinal)).join('_')
  if (a.drawer !== null && a.drawer !== undefined) s += ' #' + DRAWERS[a.drawer]
  for (const p of a.perspectives || []) s += ' ' + EYE + p.product + (p.params.length ? '(' + p.params.join(',') + ')' : '')
  return s
}

export default { NAMESPACE, TYPES, DRAWERS, EYE, parse, serialize, validate, origin, parent, child, withDrawer, withPerspective, withoutPerspective, location, sameLocation, equals, isAncestor, compareLocation, formatDisplay }
