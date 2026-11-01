/**
 * utils/OmniTimeModel.js (V259) — the TimeNode as plain data. A TimeNode is a polyNode (a cube) whose node record also carries data.time:
 *   time = { version, sequence, prev, entry }      sequence = the id of the line of cubes it belongs to; prev = the cube before it (or '')
 * and ONE entry per cube (a TimeCube): title, start/end date and time, a zone, how it is clocked, and whether it is halted.
 * Pure: no DOM, no WebGL, no Date.now() inside (the caller passes `now`). Never throws on hostile input; idempotent; immutable edits.
 *
 * TIMING. An entry is clocked one of two ways:
 *   bind 'node'  runs against the real calendar: it starts at its start date+time and ends at its end date+time
 *   bind 'own'   runs on its OWN time: it starts when it is ACTIVATED (a TimePad press, or `activateAt`) and runs for its duration (end - start), at its own `rate`
 * Halting freezes just that one cube: halt = { on, since, total }, the time spent halted is subtracted, so resuming carries on from where it stopped.
 * `chain` (own cubes): start by itself the moment the cube before it in the sequence is fulfilled.
 * progress 0..1 -> fulfilled (progress >= 1). `loop` is for ANALYSIS (replay a finished cube from the start); it never changes the dates.
 */
export const TIME_VERSION = 1
export const FACES = Object.freeze(['startDate', 'endDate', 'startTime', 'endTime', 'title', 'status'])   // the six sides of a TimeCube, in cube face order
export const FACE_LABELS = Object.freeze({ startDate: 'Start date', endDate: 'End date', startTime: 'Start time', endTime: 'End time', title: 'Title and notes', status: 'Status' })
export const BINDS = Object.freeze(['node', 'own'])
export const REPEATS = Object.freeze(['none', 'day', 'week', 'month', 'year'])
export const STATUSES = Object.freeze(['waiting', 'running', 'halted', 'fulfilled'])
export const UNITS = Object.freeze(['minute', 'hour', 'day', 'week', 'month', 'year'])
export const SPANS = Object.freeze(['1d', '3d', '5d', '7d', '14d', '1m', '3m', '6m', '1y', '2y', '3y', '5y', '10y', '20y', 'custom'])
export const SPAN_INFO = Object.freeze({
  '1d': { label: 'Day', days: 1, unit: 'hour' }, '3d': { label: '3 days', days: 3, unit: 'hour' }, '5d': { label: '5 days', days: 5, unit: 'day' }, '7d': { label: 'Week', days: 7, unit: 'day' },
  '14d': { label: 'Two weeks', days: 14, unit: 'day' }, '1m': { label: 'Month', months: 1, unit: 'day' }, '3m': { label: '3 months', months: 3, unit: 'week' }, '6m': { label: '6 months', months: 6, unit: 'week' },
  '1y': { label: 'Year', months: 12, unit: 'month' }, '2y': { label: '2 years', months: 24, unit: 'month' }, '3y': { label: '3 years', months: 36, unit: 'month' }, '5y': { label: '5 years', months: 60, unit: 'month' },
  '10y': { label: '10 years', months: 120, unit: 'year' }, '20y': { label: '20 years', months: 240, unit: 'year' }, custom: { label: 'Custom', days: 30, unit: 'day' },
})
export const LIMITS = Object.freeze({ title: 80, notes: 1000, rate: [0.01, 10000], customDays: [1, 36500], zone: 64, entriesPerSequence: 500 })
const DAY = 86400000; const HOUR = 3600000; const MIN = 60000
const BAD = new Set(['__proto__', 'constructor', 'prototype'])
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v)
const own = (o, k) => (isObj(o) && !BAD.has(k) && Object.prototype.hasOwnProperty.call(o, k) ? o[k] : undefined)
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : d))
const text = (v, n) => (typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f<>]/g, '').slice(0, n) : '')
const line = (v, n) => text(v, n).replace(/[\n\t]/g, ' ').trim()
const pick = (v, list, d) => (typeof v === 'string' && list.includes(v) ? v : d)
const cleanId = (v) => (typeof v === 'string' && /^[\w-]{1,64}$/.test(v) && !BAD.has(v) ? v : '')
const MAXMS = 8.64e15 / 2
let _seq = 0
export const makeId = (p = 'tm') => p + Date.now().toString(36) + (_seq++).toString(36) + Math.floor(Math.random() * 1296).toString(36)

// ── zones and calendar maths (no libraries: Intl does the zone rules) ────────────────────────────────────────────
const dtfCache = new Map()
export function validZone (z) {
  if (typeof z !== 'string' || !z || z.length > LIMITS.zone) return false
  if (dtfCache.has(z)) return dtfCache.get(z) !== null
  try { dtfCache.set(z, new Intl.DateTimeFormat('en-US', { timeZone: z, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })); return true } catch (_) { dtfCache.set(z, null); return false }
}
export const cleanZone = (z) => (validZone(z) ? z : 'UTC')
/** The wall-clock parts of a UTC instant in a zone: { y, mo (1-12), d, h, mi, s, dow (0=Sun) }. */
export function partsOf (ms, zone = 'UTC') {
  const z = cleanZone(zone); const f = dtfCache.get(z)
  const o = {}; for (const p of f.formatToParts(new Date(clamp(num(ms, 0), -MAXMS, MAXMS)))) o[p.type] = p.value
  const y = Number(o.year); const mo = Number(o.month); const d = Number(o.day)
  return { y, mo, d, h: Number(o.hour) % 24, mi: Number(o.minute), s: Number(o.second), dow: new Date(Date.UTC(y, mo - 1, d)).getUTCDay() }
}
/** The UTC instant of a wall-clock time in a zone (handles DST by checking the offset twice). */
export function zonedToUtc (p, zone = 'UTC') {
  const z = cleanZone(zone); const guess = Date.UTC(p.y, p.mo - 1, p.d, p.h ?? 0, p.mi ?? 0, p.s ?? 0)
  const off = (t) => { const q = partsOf(t, z); return Date.UTC(q.y, q.mo - 1, q.d, q.h, q.mi, q.s) - Math.floor(t / 1000) * 1000 }
  let t = guess - off(guess); t = guess - off(t); return t
}
const pad = (n, w = 2) => String(n).padStart(w, '0')
export const dateString = (ms, zone) => { const p = partsOf(ms, zone); return `${pad(p.y, 4)}-${pad(p.mo)}-${pad(p.d)}` }
export const timeString = (ms, zone) => { const p = partsOf(ms, zone); return `${pad(p.h)}:${pad(p.mi)}` }
export function parseDate (s) { const m = /^(-?\d{4,6})-(\d{2})-(\d{2})$/.exec(typeof s === 'string' ? s.trim() : ''); if (!m) return null; const y = +m[1]; const mo = +m[2]; const d = +m[3]; if (mo < 1 || mo > 12 || d < 1 || d > new Date(Date.UTC(y, mo, 0)).getUTCDate() || y < 1 || y > 9999) return null; return { y, mo, d } }
export function parseTime (s) { const m = /^(\d{1,2}):(\d{2})$/.exec(typeof s === 'string' ? s.trim() : ''); if (!m) return null; const h = +m[1]; const mi = +m[2]; return h > 23 || mi > 59 ? null : { h, mi } }
export function startOfUnit (ms, unit, zone = 'UTC') {
  const p = partsOf(ms, zone)
  if (unit === 'minute') return zonedToUtc({ ...p, s: 0 }, zone)
  if (unit === 'hour') return zonedToUtc({ ...p, mi: 0, s: 0 }, zone)
  if (unit === 'day') return zonedToUtc({ ...p, h: 0, mi: 0, s: 0 }, zone)
  if (unit === 'week') { const d0 = zonedToUtc({ ...p, h: 0, mi: 0, s: 0 }, zone); return addUnits(d0, 'day', -((p.dow + 6) % 7), zone) }   // weeks start Monday
  if (unit === 'month') return zonedToUtc({ y: p.y, mo: p.mo, d: 1, h: 0, mi: 0, s: 0 }, zone)
  if (unit === 'year') return zonedToUtc({ y: p.y, mo: 1, d: 1, h: 0, mi: 0, s: 0 }, zone)
  return ms
}
/** Add n units in the zone's calendar (a day is a calendar day, a month is a calendar month: so DST and month lengths are right). */
export function addUnits (ms, unit, n, zone = 'UTC') {
  const k = Math.trunc(num(n, 0)); if (!k) return ms
  if (unit === 'minute') return ms + k * MIN
  if (unit === 'hour') return ms + k * HOUR
  const p = partsOf(ms, zone)
  if (unit === 'day' || unit === 'week') { const dd = unit === 'week' ? k * 7 : k; const u = new Date(Date.UTC(p.y, p.mo - 1, p.d + dd)); return zonedToUtc({ y: u.getUTCFullYear(), mo: u.getUTCMonth() + 1, d: u.getUTCDate(), h: p.h, mi: p.mi, s: p.s }, zone) }
  const total = p.y * 12 + (p.mo - 1) + (unit === 'year' ? k * 12 : k); const y = Math.floor(total / 12); const mo = (total % 12 + 12) % 12 + 1
  const d = Math.min(p.d, new Date(Date.UTC(y, mo, 0)).getUTCDate())
  return zonedToUtc({ y, mo, d, h: p.h, mi: p.mi, s: p.s }, zone)
}
/** The key a time falls under for a unit: '2026-10-31T21' (hour) … '2026' (year). Weeks key on the Monday that starts them. */
export function bucketKey (ms, unit, zone = 'UTC') {
  const p = partsOf(ms, zone)
  if (unit === 'minute') return `${pad(p.y, 4)}-${pad(p.mo)}-${pad(p.d)}T${pad(p.h)}:${pad(p.mi)}`
  if (unit === 'hour') return `${pad(p.y, 4)}-${pad(p.mo)}-${pad(p.d)}T${pad(p.h)}`
  if (unit === 'day') return dateString(ms, zone)
  if (unit === 'week') return 'W' + dateString(startOfUnit(ms, 'week', zone), zone)
  if (unit === 'month') return `${pad(p.y, 4)}-${pad(p.mo)}`
  return pad(p.y, 4)
}

// ── sanitising ───────────────────────────────────────────────────────────────────────────────────────────────────
const defHalt = () => ({ on: false, since: 0, total: 0 })
function cleanHalt (raw) { const r = isObj(raw) ? raw : {}; return { on: own(r, 'on') === true, since: clamp(Math.round(num(own(r, 'since'), 0)), -MAXMS, MAXMS), total: clamp(Math.round(num(own(r, 'total'), 0)), 0, MAXMS) } }
function cleanRepeat (raw) { const r = isObj(raw) ? raw : {}; return { every: pick(own(r, 'every'), REPEATS, 'none'), times: clamp(Math.round(num(own(r, 'times'), 0)), 0, 1000) } }   // times 0 = forever
/** One TimeCube's entry. startUtc/endUtc are derived from the dates and the zone and stored (so every reader agrees). */
export function sanitizeEntry (raw) {
  const r = isObj(raw) ? raw : {}; const zone = cleanZone(own(r, 'zone'))
  const sd = parseDate(own(r, 'startDate')); const ed = parseDate(own(r, 'endDate')); const st = parseTime(own(r, 'startTime')); const et = parseTime(own(r, 'endTime'))
  const base = { y: 2026, mo: 1, d: 1 }
  const A = sd ?? base; const B = ed ?? A; const sT = st ?? { h: 9, mi: 0 }; const eT = et ?? (st ? { h: sT.h, mi: sT.mi } : { h: 10, mi: 0 })
  let startUtc = zonedToUtc({ ...A, ...sT, s: 0 }, zone); let endUtc = zonedToUtc({ ...B, ...eT, s: 0 }, zone)
  if (endUtc < startUtc) endUtc = startUtc                      // an end before the start is clamped: a cube never runs backwards
  return {
    id: cleanId(own(r, 'id')), title: line(own(r, 'title'), LIMITS.title), notes: text(own(r, 'notes'), LIMITS.notes), zone,
    startDate: dateString(startUtc, zone), startTime: timeString(startUtc, zone), endDate: dateString(endUtc, zone), endTime: timeString(endUtc, zone), startUtc, endUtc,
    bind: pick(own(r, 'bind'), BINDS, 'node'), rate: clamp(num(own(r, 'rate'), 1), LIMITS.rate[0], LIMITS.rate[1]),
    activatedAt: own(r, 'activatedAt') == null ? null : clamp(Math.round(num(own(r, 'activatedAt'), 0)), -MAXMS, MAXMS), activateAt: own(r, 'activateAt') == null ? null : clamp(Math.round(num(own(r, 'activateAt'), 0)), -MAXMS, MAXMS),
    halt: cleanHalt(own(r, 'halt')), repeat: cleanRepeat(own(r, 'repeat')), loop: own(r, 'loop') === true, chain: own(r, 'chain') === true, tags: cleanTags(own(r, 'tags')),
  }
}
function cleanTags (raw) { const o = []; for (const t of (Array.isArray(raw) ? raw : []).slice(0, 40)) { const c = typeof t === 'string' ? t.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 24) : ''; if (c && !o.includes(c) && o.length < 8) o.push(c) } return o }
/** The whole data.time record. */
export function sanitizeTime (raw) {
  const r = isObj(raw) ? raw : {}
  return { version: TIME_VERSION, sequence: cleanId(own(r, 'sequence')) || 'seq', prev: cleanId(own(r, 'prev')), entry: sanitizeEntry(own(r, 'entry')) }
}
export function newEntry (o = {}, { now = Date.now() } = {}) {
  const z = cleanZone(o?.zone); const s = isObj(o) && (o.startDate || o.startTime) ? o : { ...(isObj(o) ? o : {}), startDate: dateString(now, z), startTime: timeString(addUnits(startOfUnit(now, 'hour', z), 'hour', 1, z), z) }
  const e = sanitizeEntry({ ...s, id: cleanId(o?.id) || makeId('tm') })
  if (isObj(o) && (o.endDate || o.endTime)) return e
  return sanitizeEntry({ ...e, endDate: e.startDate, endTime: timeString(e.startUtc + HOUR, e.zone), ...(e.startDate !== dateString(e.startUtc + HOUR, e.zone) ? { endDate: dateString(e.startUtc + HOUR, e.zone) } : {}) })
}
export const newTime = (o = {}, ctx) => sanitizeTime({ sequence: o?.sequence || makeId('seq'), prev: o?.prev || '', entry: newEntry(o?.entry ?? o, ctx) })

// ── running ──────────────────────────────────────────────────────────────────────────────────────────────────────
/** When does this entry begin (UTC ms)? null if it is an 'own' cube that has not been activated. */
export function beginsAt (e) { return e.bind === 'own' ? (e.activatedAt ?? e.activateAt ?? null) : e.startUtc }
/** The cube's own clock reading: real `now` minus time spent halted. */
export function effectiveNow (e, now) { const h = e.halt; return now - h.total - (h.on ? Math.max(0, now - h.since) : 0) }
/**
 * Where is this entry at `now`?  { status, progress 0..1, fulfilled, halted, startUtc, endUtc, remainingMs, elapsedMs }
 * 'own' entries: elapsed = (clock since activation) * rate against the duration;  'node' entries: against the calendar dates.
 * A zero-length entry is fulfilled the moment it begins.
 */
export function stateOf (entry, now) {
  const e = sanitizeEntry(entry); const t = clamp(num(now, 0), -MAXMS, MAXMS); const eff = effectiveNow(e, t); const dur = e.endUtc - e.startUtc
  const b = beginsAt(e); let progress = 0; let started = false; let startUtc = e.startUtc; let endUtc = e.endUtc
  if (e.bind === 'own') {
    if (b != null && eff >= b) { started = true; const el = (eff - b) * e.rate; progress = dur > 0 ? clamp(el / dur, 0, 1) : 1; startUtc = b; endUtc = b + (dur / e.rate) }
    else if (b != null) { startUtc = b; endUtc = b + dur / e.rate }
  } else if (eff >= e.startUtc) { started = true; progress = dur > 0 ? clamp((eff - e.startUtc) / dur, 0, 1) : 1 }
  const fulfilled = started && progress >= 1
  const status = e.halt.on ? 'halted' : fulfilled ? 'fulfilled' : started ? 'running' : 'waiting'
  return { status, progress: Math.round(progress * 1e6) / 1e6, fulfilled, halted: e.halt.on, startUtc, endUtc, elapsedMs: started ? Math.round(progress * dur) : 0, remainingMs: started ? Math.round((1 - progress) * dur) : dur }
}
// immutable edits on an entry (each takes an entry or a data.time record's entry and returns a new entry)
export function activate (entry, now) { const e = sanitizeEntry(entry); return sanitizeEntry({ ...e, bind: 'own', activatedAt: effectiveNow(e, now), halt: { ...e.halt } }) }
export function halt (entry, now) { const e = sanitizeEntry(entry); return e.halt.on ? e : sanitizeEntry({ ...e, halt: { ...e.halt, on: true, since: now } }) }
export function resume (entry, now) { const e = sanitizeEntry(entry); return !e.halt.on ? e : sanitizeEntry({ ...e, halt: { on: false, since: 0, total: e.halt.total + Math.max(0, now - e.halt.since) } }) }
/** Start over: for 'own' entries clear activation; the halt ledger is cleared. */
export function reset (entry) { const e = sanitizeEntry(entry); return sanitizeEntry({ ...e, activatedAt: null, halt: defHalt() }) }
/** Analysis replay: restart a finished cube's clock from `now` without touching its dates. */
export function replay (entry, now) { const e = sanitizeEntry(entry); return e.bind === 'own' ? sanitizeEntry({ ...e, activatedAt: effectiveNow(e, now) }) : sanitizeEntry({ ...e, bind: 'own', activatedAt: effectiveNow(e, now) }) }
export function edit (entry, patch) { return sanitizeEntry({ ...sanitizeEntry(entry), ...(isObj(patch) ? patch : {}) }) }
/** `loop` (analysis): a fulfilled looping cube starts over by itself. Returns the cube to store (new activation) or the same one. */
export function tickLoop (entry, now) { const e = sanitizeEntry(entry); if (!e.loop) return e; const s = stateOf(e, now); return s.fulfilled && !e.halt.on ? replay(e, now) : e }

// ── repeats ──────────────────────────────────────────────────────────────────────────────────────────────────────
/** The occurrences of an entry that intersect [from, to): [{ index, startUtc, endUtc, source: entry }]. Calendar-based (month ends clamp). */
export function occurrences (entry, from, to, { max = 2000 } = {}) {
  const e = sanitizeEntry(entry); const a = num(from, 0); const b = num(to, 0); const out = []
  if (!(b > a)) return out
  const dur = e.endUtc - e.startUtc
  if (e.repeat.every === 'none') { if (e.endUtc > a && e.startUtc < b || (dur === 0 && e.startUtc >= a && e.startUtc < b)) out.push({ index: 0, startUtc: e.startUtc, endUtc: e.endUtc, source: e }); return out }
  const total = e.repeat.times || Infinity
  for (let i = 0; i < Math.min(total, 100000) && out.length < max; i++) {
    const s = addUnits(e.startUtc, e.repeat.every, i, e.zone); if (s >= b) break
    const en = s + dur; if (en > a || (dur === 0 && s >= a)) out.push({ index: i, startUtc: s, endUtc: en, source: e })
  }
  return out
}

// ── buckets / filtering / views ──────────────────────────────────────────────────────────────────────────────────
/** Filter entries by a unit and key: e.g. filterBy(list, 'month', '2026-10') = every entry with an occurrence in October 2026. */
export function filterBy (entries, unit, key, zone = 'UTC') {
  if (!UNITS.includes(unit) || typeof key !== 'string') return []
  const out = []; for (const raw of (Array.isArray(entries) ? entries : []).slice(0, 5000)) {
    const e = sanitizeEntry(raw); let hit = false
    // walk the buckets the entry touches (bounded) and compare keys
    let t = startOfUnit(e.startUtc, unit, zone); let n = 0
    const last = Math.max(e.endUtc - 1, e.startUtc)
    while (t <= last && n++ < 2000) { if (bucketKey(t, unit, zone) === key) { hit = true; break } t = addUnits(t, unit, 1, zone) }
    if (!hit && e.repeat.every !== 'none') { const k0 = startOfUnit(zonedKey(key, unit, zone), unit, zone); hit = occurrences(e, k0, addUnits(k0, unit, 1, zone)).length > 0 }
    if (hit) out.push(e)
  }
  return out
}
function zonedKey (key, unit, zone) {
  let m
  if (unit === 'year' && (m = /^(\d{4})$/.exec(key))) return zonedToUtc({ y: +m[1], mo: 1, d: 1 }, zone)
  if (unit === 'month' && (m = /^(\d{4})-(\d{2})$/.exec(key))) return zonedToUtc({ y: +m[1], mo: +m[2], d: 1 }, zone)
  if (unit === 'week' && key[0] === 'W') key = key.slice(1)
  if ((unit === 'day' || unit === 'week') && parseDate(key)) { const p = parseDate(key); return zonedToUtc({ ...p }, zone) }
  if ((m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2})(?::(\d{2}))?$/.exec(key))) return zonedToUtc({ y: +m[1], mo: +m[2], d: +m[3], h: +m[4], mi: +(m[5] || 0) }, zone)
  return 0
}
/** Count entries per bucket of a unit over a range: [{ key, from, to, count }]  (the "filter by hour/minute/day/week/month/year" timeline). */
export function timeline (entries, unit, from, to, zone = 'UTC', { maxBuckets = 4000 } = {}) {
  if (!UNITS.includes(unit)) return []
  const list = (Array.isArray(entries) ? entries : []).slice(0, 5000).map(sanitizeEntry); const out = []
  let t = startOfUnit(from, unit, zone); let n = 0
  while (t < to && n++ < maxBuckets) {
    const nx = addUnits(t, unit, 1, zone); let count = 0
    for (const e of list) count += occurrences(e, t, nx, { max: 1 }).length ? 1 : 0
    out.push({ key: bucketKey(t, unit, zone), from: t, to: nx, count }); t = nx
  }
  return out
}
/** The range a calendar view shows. anchor = any instant in it. Day views start at the anchor's day; month+ views start at the anchor's month (a year view = that calendar year). */
export function viewRange (span, anchor, zone = 'UTC', customDays = 30) {
  const sp = pick(span, SPANS, '7d'); const info = SPAN_INFO[sp]; const z = cleanZone(zone)
  let from; let to
  if (sp === 'custom') { from = startOfUnit(anchor, 'day', z); to = addUnits(from, 'day', clamp(Math.round(num(customDays, 30)), LIMITS.customDays[0], LIMITS.customDays[1]), z) }
  else if (info.days) { from = startOfUnit(anchor, 'day', z); to = addUnits(from, 'day', info.days, z) }
  else if (info.months >= 12) { from = startOfUnit(anchor, 'year', z); to = addUnits(from, 'month', info.months, z) }
  else { from = startOfUnit(anchor, 'month', z); to = addUnits(from, 'month', info.months, z) }
  const days = Math.round((to - from) / DAY)
  const unit = sp === 'custom' ? (days <= 3 ? 'hour' : days <= 62 ? 'day' : days <= 400 ? 'week' : days <= 3700 ? 'month' : 'year') : info.unit
  return { span: sp, label: sp === 'custom' ? days + ' days' : info.label, from, to, unit, zone: z, days }
}
/** Step a view forward/back by one view length (the prev/next buttons). */
export function stepView (span, anchor, dir, zone = 'UTC', customDays = 30) {
  const r = viewRange(span, anchor, zone, customDays); const d = dir < 0 ? -1 : 1
  if (r.span !== 'custom' && SPAN_INFO[r.span].months) return addUnits(r.from, 'month', d * SPAN_INFO[r.span].months, zone)
  return addUnits(r.from, 'day', d * r.days, zone)
}
export const nextSpan = (span, dir = 1) => SPANS[clamp(SPANS.indexOf(pick(span, SPANS, '7d')) + (dir < 0 ? -1 : 1), 0, SPANS.length - 1)]
/** The columns of a view and the occurrences in them: { range, columns:[{key,from,to,label,items:[{entryId,title,startUtc,endUtc}]}] }. */
export function viewData (entries, span, anchor, { zone = 'UTC', customDays = 30, maxColumns = 800 } = {}) {
  const range = viewRange(span, anchor, zone, customDays); const list = (Array.isArray(entries) ? entries : []).slice(0, 5000).map(sanitizeEntry)
  const columns = []; let t = startOfUnit(range.from, range.unit, range.zone)
  while (t < range.to && columns.length < maxColumns) {
    const nx = Math.min(addUnits(t, range.unit, 1, range.zone), Math.max(t + 1, range.to)); const items = []
    for (const e of list) for (const o of occurrences(e, t, nx, { max: 5 })) items.push({ entryId: e.id, title: e.title, startUtc: o.startUtc, endUtc: o.endUtc })
    columns.push({ key: bucketKey(t, range.unit, range.zone), from: t, to: nx, label: labelOf(t, range.unit, range.zone), items }); t = nx
  }
  return { range, columns }
}
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']; const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export function labelOf (ms, unit, zone = 'UTC') {
  const p = partsOf(ms, zone)
  if (unit === 'minute') return `${pad(p.h)}:${pad(p.mi)}`
  if (unit === 'hour') return `${pad(p.h)}:00`
  if (unit === 'day') return `${DOW[p.dow]} ${p.d}`
  if (unit === 'week') return `${MONTHS[p.mo - 1]} ${p.d}`
  if (unit === 'month') return `${MONTHS[p.mo - 1]} ${p.y}`
  return String(p.y)
}
/** A friendly span of time: "2 h 5 min", "3 d". */
export function humanDuration (ms) {
  const a = Math.abs(num(ms, 0)); if (a < MIN) return Math.round(a / 1000) + ' s'
  const d = Math.floor(a / DAY); const h = Math.floor(a % DAY / HOUR); const m = Math.floor(a % HOUR / MIN)
  return [d ? d + ' d' : '', h ? h + ' h' : '', m && d < 7 ? m + ' min' : ''].filter(Boolean).join(' ') || '0 min'
}

// ── a sequence (the line of cubes) ───────────────────────────────────────────────────────────────────────────────
/** Order the cubes of one sequence by their prev links (cycles / strays are appended safely). nodes = [{ id, time }] */
export function orderSequence (nodes, sequence) {
  const mine = (Array.isArray(nodes) ? nodes : []).filter(n => n && n.time && n.time.sequence === sequence); const byId = new Map(mine.map(n => [n.id, n]))
  const out = []; const seen = new Set(); const next = new Map(); for (const n of mine) if (n.time.prev && byId.has(n.time.prev)) next.set(n.time.prev, n.id)
  let heads = mine.filter(n => !n.time.prev || !byId.has(n.time.prev))
  for (const h of heads) { let cur = h.id; while (cur && !seen.has(cur) && out.length < LIMITS.entriesPerSequence) { seen.add(cur); out.push(cur); cur = next.get(cur) } }
  for (const n of mine) if (!seen.has(n.id) && out.length < LIMITS.entriesPerSequence) out.push(n.id)
  return out
}
/** What a face of the cube shows: { label, value, lines } (the face panel and the cube's face texture both read this). */
export function faceInfo (entry, face, now) {
  const e = sanitizeEntry(entry); const s = stateOf(e, now)
  switch (face) {
    case 'startDate': return { label: FACE_LABELS.startDate, value: e.startDate, lines: ['Zone ' + e.zone, e.bind === 'own' ? 'Own clock: starts when activated' : 'Calendar: starts ' + e.startDate + ' ' + e.startTime] }
    case 'endDate': return { label: FACE_LABELS.endDate, value: e.endDate, lines: ['Lasts ' + humanDuration(e.endUtc - e.startUtc), 'Repeats: ' + (e.repeat.every === 'none' ? 'never' : 'every ' + e.repeat.every + (e.repeat.times ? ' x' + e.repeat.times : ''))] }
    case 'startTime': return { label: FACE_LABELS.startTime, value: e.startTime, lines: ['Zone ' + e.zone] }
    case 'endTime': return { label: FACE_LABELS.endTime, value: e.endTime, lines: ['Zone ' + e.zone] }
    case 'title': return { label: FACE_LABELS.title, value: e.title || 'Untitled', lines: e.notes ? e.notes.split('\n').slice(0, 12) : ['No notes'] }
    default: return { label: FACE_LABELS.status, value: s.status, lines: [Math.round(s.progress * 100) + '% done', s.fulfilled ? 'Fulfilled' : 'Left: ' + humanDuration(s.remainingMs), 'Rate x' + e.rate + (e.loop ? ' · looping (analysis)' : '')] }
  }
}
export default { sanitizeEntry, sanitizeTime, newEntry, newTime, stateOf, activate, halt, resume, reset, replay, edit, occurrences, filterBy, timeline, viewRange, viewData, stepView, orderSequence, faceInfo }
