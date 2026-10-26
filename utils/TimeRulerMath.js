/**
 * utils/TimeRulerMath.js — the pure maths behind the TimeData ruler (V192)
 *
 * No DOM, no timers, no module state: numbers (epoch ms) and plain objects in, numbers / strings / arrays out, so the unit
 * tests (and the ruler) can use it without a browser. Every function survives hostile input (NaN, Infinity, strings, null,
 * reversed or enormous ranges): it returns NaN / [] / null / a safe default and never throws and never loops for long.
 *
 * TIME MODEL (decision, see docs/architecture/TIMEDATA_RULER_DESIGN.md)
 *   Everything is CALENDAR LOCAL TIME of the browser. A "day" starts at a wall-clock time and ends at the SAME wall-clock time
 *   one calendar day later, so on a daylight-saving day it is really 23 or 25 hours long. Hour notches are wall-clock hours
 *   counted from the start of the day window (JS Date resolves a wall time that does not exist, e.g. 02:30 on a spring-forward
 *   day, to the instant after the gap; a wall time that happens twice resolves to its first occurrence). Duplicates that land on
 *   the same instant are dropped, so a 23-hour day has 24 distinct notches and a 25-hour day has 25 (one interval is 2 real hours).
 *
 * Levels of the hierarchy, lowest to highest: minute < hour < day < week < month < year < decade.
 * Weeks: mode 'iso' (Monday start, ISO-8601 week numbers), 'monday' (Monday start, week 1 = the week that holds 1 January) or
 * 'sunday' (Sunday start, week 1 = the week that holds 1 January). Boundaries are local midnights.
 */

export const SEC = 1000
export const MIN = 60 * SEC
export const HOUR = 60 * MIN
export const DAY = 24 * HOUR
export const WEEK = 7 * DAY
export const AVG_MONTH = 30.436875 * DAY       // 365.2425 / 12
export const AVG_YEAR = 365.2425 * DAY
export const AVG_DECADE = 10 * AVG_YEAR

/** The ruler works on about 1900-01-01 .. 9999-12-31 (two days of slack each side so every time zone can reach its local 1900 / 9999); outside that every function answers NaN / []. */
export const MIN_TS = Date.UTC(1899, 11, 30)
export const MAX_TS = Date.UTC(9999, 11, 31, 23, 59, 59)
export const MAX_LINES = 5000

export const LEVELS = Object.freeze(['minute', 'hour', 'day', 'week', 'month', 'year', 'decade'])
export const LEVEL_RANK = Object.freeze({ minute: 0, hour: 1, day: 2, week: 3, month: 4, year: 5, decade: 6 })
export const WEEK_MODES = Object.freeze(['iso', 'monday', 'sunday'])
export const MONTH_NAMES = Object.freeze(['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'])
export const MONTH_SHORT = Object.freeze(MONTH_NAMES.map(m => m.slice(0, 3)))
export const WEEKDAY_SHORT = Object.freeze(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'])

const p2 = (n) => String(Math.floor(Math.abs(n))).padStart(2, '0')

// ── validation ───────────────────────────────────────────────────────────────

/** A usable timestamp: a finite number inside [MIN_TS, MAX_TS] (strings, booleans, null, objects are NOT coerced). */
export function isValidTs (t) {
  return typeof t === 'number' && Number.isFinite(t) && t >= MIN_TS && t <= MAX_TS
}

export function isLevel (l) { return typeof l === 'string' && Object.prototype.hasOwnProperty.call(LEVEL_RANK, l) }
export function normalizeWeekMode (m) { return WEEK_MODES.includes(m) ? m : 'iso' }
export function weekStartOf (mode) { return normalizeWeekMode(mode) === 'sunday' ? 0 : 1 }

// ── calendar helpers (local time) ────────────────────────────────────────────

/** Local midnight of the day that contains ts (NaN for bad input). */
export function startOfDay (ts) {
  if (!isValidTs(ts)) return NaN
  const d = new Date(ts); d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/** Local date fields of ts, or null. */
export function parts (ts) {
  if (!isValidTs(ts)) return null
  const d = new Date(ts)
  return { y: d.getFullYear(), mo: d.getMonth(), d: d.getDate(), h: d.getHours(), mi: d.getMinutes(), s: d.getSeconds(), ms: d.getMilliseconds(), dow: d.getDay() }
}

/** Local time for the given wall-clock fields (fields may overflow: day 32, hour 25 ... roll over like Date does). Works for years < 100. */
export function wall (y, mo, d, h = 0, mi = 0, s = 0, ms = 0) {
  if (![y, mo, d, h, mi, s, ms].every(Number.isFinite)) return NaN
  const dt = new Date(2000, 0, 1, 0, 0, 0, 0)
  dt.setFullYear(y, mo, d)
  dt.setHours(h, mi, s, ms)
  const t = dt.getTime()
  return isValidTs(t) ? t : NaN
}

/** ts moved by n calendar days, keeping the wall-clock time (DST-correct: a day may be 23 or 25 real hours). */
export function addDays (ts, n) {
  const p = parts(ts); if (!p || !Number.isFinite(n)) return NaN
  return wall(p.y, p.mo, p.d + Math.trunc(n), p.h, p.mi, p.s, p.ms)
}
export function addMonths (ts, n) {
  const p = parts(ts); if (!p || !Number.isFinite(n)) return NaN
  return wall(p.y, p.mo + Math.trunc(n), p.d, p.h, p.mi, p.s, p.ms)
}
export function addYears (ts, n) {
  const p = parts(ts); if (!p || !Number.isFinite(n)) return NaN
  return wall(p.y + Math.trunc(n), p.mo, p.d, p.h, p.mi, p.s, p.ms)
}

/** Local midnight that opens the week containing ts. weekStart 0 = Sunday, 1 = Monday. */
export function startOfWeek (ts, weekStart = 1) {
  const p = parts(ts); if (!p) return NaN
  const ws = weekStart === 0 ? 0 : 1
  const back = (p.dow - ws + 7) % 7
  return wall(p.y, p.mo, p.d - back)
}
export function startOfMonth (ts) { const p = parts(ts); return p ? wall(p.y, p.mo, 1) : NaN }
export function startOfYear (ts) { const p = parts(ts); return p ? wall(p.y, 0, 1) : NaN }
export function startOfDecade (ts) { const p = parts(ts); return p ? wall(p.y - (((p.y % 10) + 10) % 10), 0, 1) : NaN }

export function isLeapYear (y) {
  return Number.isInteger(y) && ((y % 4 === 0 && y % 100 !== 0) || y % 400 === 0)
}
export function daysInMonth (y, mo) {
  if (!Number.isInteger(y) || !Number.isInteger(mo) || mo < 0 || mo > 11) return NaN
  return mo === 1 ? (isLeapYear(y) ? 29 : 28) : [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mo]
}
/** Real length of the local calendar day that starts at the local midnight/wall time ts: 23, 24 or 25 hours on DST days. */
export function dayLengthMs (ts) {
  const next = addDays(ts, 1)
  return Number.isFinite(next) && Number.isFinite(ts) ? next - ts : NaN
}

const utcDay = (y, mo, d) => Math.floor(Date.UTC(y, mo, d) / DAY)   // whole days since 1970 for a calendar date (no DST in UTC)
function utcDate (y, mo, d) { const t = new Date(0); t.setUTCFullYear(y, mo, d); t.setUTCHours(0, 0, 0, 0); return t.getTime() }

/** ISO-8601 week of the local date of ts: { year, week 1..53 } (Monday start; week 1 holds the first Thursday / 4 January). */
export function isoWeek (ts) {
  const p = parts(ts); if (!p) return null
  const t = utcDate(p.y, p.mo, p.d)
  const dow = (new Date(t).getUTCDay() + 6) % 7            // Monday = 0
  const thursday = t + (3 - dow) * DAY
  const year = new Date(thursday).getUTCFullYear()
  const jan1 = utcDate(year, 0, 1)
  return { year, week: 1 + Math.floor((thursday - jan1) / DAY / 7) }
}

/**
 * Week number for a label.
 *   'iso'     ISO-8601 (the week belongs to the year of its Thursday: 29 Dec 2025 is week 1 of 2026)
 *   'monday'  / 'sunday'  week 1 is the week that holds 1 January; a week belongs to the year in which it ENDS, so the week
 *             that starts on 29 Dec 2025 (Monday mode) or 28 Dec 2025 (Sunday mode) is week 1 of 2026; numbers run 1..53
 */
export function weekNumber (ts, mode = 'iso') {
  const m = normalizeWeekMode(mode)
  if (m === 'iso') return isoWeek(ts)?.week ?? NaN
  const ws = weekStartOf(m)
  const start = parts(startOfWeek(ts, ws)); if (!start) return NaN
  const end = new Date(utcDate(start.y, start.mo, start.d) + 6 * DAY)           // last day of the week (calendar arithmetic in UTC)
  const wy = end.getUTCFullYear()
  const first = parts(startOfWeek(wall(wy, 0, 1), ws)); if (!first) return NaN
  const days = utcDay(start.y, start.mo, start.d) - utcDay(first.y, first.mo, first.d)
  return Math.floor(days / 7) + 1
}

// ── boundaries / hierarchy ───────────────────────────────────────────────────

function labelFor (level, ts, weekMode) {
  const p = parts(ts); if (!p) return ''
  switch (level) {
    case 'day': return `${WEEKDAY_SHORT[p.dow]} ${p.d}`
    case 'week': return `W${weekNumber(ts, weekMode)}`
    case 'month': return `${MONTH_SHORT[p.mo]} ${p.y}`
    case 'year': return String(p.y)
    case 'decade': return String(p.y)
    default: return ''
  }
}

/**
 * Boundaries of ONE level inside [fromTs, toTs] (inclusive), ascending, as local midnights.
 *   level   'day' | 'week' | 'month' | 'year' | 'decade'
 *   opts    { weekMode, max } (max default 5000; the result is cut there)
 * Returns [{ ts, level, label }]. Bad level / bad range / reversed range / a range longer than 3000 years -> [].
 */
export function boundaries (level, fromTs, toTs, opts = {}) {
  if (!['day', 'week', 'month', 'year', 'decade'].includes(level)) return []
  if (!isValidTs(fromTs) || !isValidTs(toTs) || toTs < fromTs) return []
  if (toTs - fromTs > 3000 * AVG_YEAR) return []
  const max = Math.min(MAX_LINES, Math.max(1, Math.trunc(Number(opts.max)) || MAX_LINES))
  const weekMode = normalizeWeekMode(opts.weekMode)
  const out = []
  const f = parts(fromTs)
  let cur, step
  switch (level) {
    case 'day': {
      cur = wall(f.y, f.mo, f.d); step = (k) => wall(f.y, f.mo, f.d + k); break
    }
    case 'week': {
      const s = parts(startOfWeek(fromTs, weekStartOf(weekMode))); if (!s) return []
      cur = wall(s.y, s.mo, s.d); step = (k) => wall(s.y, s.mo, s.d + 7 * k); break
    }
    case 'month': {
      cur = wall(f.y, f.mo, 1); step = (k) => wall(f.y, f.mo + k, 1); break
    }
    case 'year': {
      cur = wall(f.y, 0, 1); step = (k) => wall(f.y + k, 0, 1); break
    }
    default: {   // decade
      const y0 = f.y - (((f.y % 10) + 10) % 10)
      cur = wall(y0, 0, 1); step = (k) => wall(y0 + 10 * k, 0, 1); break
    }
  }
  let k = 0
  while (Number.isFinite(cur) && cur < fromTs && k < 4) cur = step(++k)
  if (!Number.isFinite(cur)) return []
  let guard = 0
  while (Number.isFinite(cur) && cur <= toTs && out.length < max && guard++ < max + 8) {
    if (cur >= fromTs && (out.length === 0 || cur > out[out.length - 1].ts)) out.push({ ts: cur, level, label: labelFor(level, cur, weekMode) })
    cur = step(++k)
  }
  return out
}

/**
 * The merged hierarchy between two timestamps. A boundary that is several levels at once (1 January 2030 is a day, a week
 * boundary only if it is a Monday, a month, a year and a decade) is listed ONCE with the HIGHEST level.
 *   opts { levels: ['day','week','month','year','decade'] (the ones wanted), weekMode, max }
 * Returns ascending [{ ts, level, label }].
 */
export function hierarchyLines (fromTs, toTs, opts = {}) {
  const wanted = Array.isArray(opts.levels) ? opts.levels.filter(l => ['day', 'week', 'month', 'year', 'decade'].includes(l)) : ['day', 'week', 'month', 'year', 'decade']
  const byTs = new Map()
  for (const lv of wanted) {
    for (const b of boundaries(lv, fromTs, toTs, opts)) {
      const prev = byTs.get(b.ts)
      if (!prev || LEVEL_RANK[b.level] > LEVEL_RANK[prev.level]) byTs.set(b.ts, b)
    }
  }
  return [...byTs.values()].sort((a, b) => a.ts - b.ts)
}

/** Average length of one unit of a level in ms (used to decide whether a level is dense enough to draw). */
export function avgLevelMs (level) {
  switch (level) {
    case 'minute': return MIN
    case 'hour': return HOUR
    case 'day': return DAY
    case 'week': return WEEK
    case 'month': return AVG_MONTH
    case 'year': return AVG_YEAR
    case 'decade': return AVG_DECADE
    default: return NaN
  }
}

// ── day notches (hours / minutes) ────────────────────────────────────────────

/** Minor-notch step in minutes that fits: density 'off' | '30' | '15' | '5'; a step is only used when it is at least minPx apart. 0 = none. */
export function effectiveMinorStep (density, pxPerHour, minPx = 4) {
  const cand = { 30: [30], 15: [15, 30], 5: [5, 15, 30] }[String(density)] ?? []
  if (!Number.isFinite(pxPerHour) || pxPerHour <= 0) return 0
  for (const s of cand) if ((s * pxPerHour) / 60 >= minPx) return s
  return 0
}

/**
 * The 00:00 .. 24:00 notches of ONE day window that opens at dayStartTs (a local wall time, normally the baseline of that day).
 * Hour notch k is the wall time dayStart + k hours. Returns [{ ts, hour (0..24), minute (0 for hours, else 5..55), major, label }].
 * Labels are 24-hour 'HH:00'; the closing notch is '24:00'. Notches that fall on the same instant (DST gap) keep the first.
 * minorStepMin: 0 for none, else minutes (must divide 60: 5, 10, 15, 20, 30).
 */
export function dayNotches (dayStartTs, minorStepMin = 0) {
  const p = parts(dayStartTs); if (!p) return []
  const step = [5, 10, 15, 20, 30].includes(minorStepMin) ? minorStepMin : 0
  const out = []
  let last = -Infinity
  const push = (ts, hour, minute) => {
    if (!Number.isFinite(ts) || ts <= last) return
    last = ts
    out.push({ ts, hour, minute, major: minute === 0, label: minute === 0 ? `${p2(hour)}:00` : `${p2(hour)}:${p2(minute)}` })
  }
  for (let k = 0; k <= 24; k++) {
    push(wall(p.y, p.mo, p.d, p.h + k, p.mi, p.s, p.ms), k, 0)
    if (step && k < 24) for (let m = step; m < 60; m += step) push(wall(p.y, p.mo, p.d, p.h + k, p.mi + m, p.s, p.ms), k, m)
  }
  return out
}

// ── position <-> time ────────────────────────────────────────────────────────

/** View = { start, end, top, size }: [start, end] ms is drawn onto [top, top + size] px (top to bottom). */
export function posOf (ts, view) {
  if (!view || !Number.isFinite(ts) || !Number.isFinite(view.start) || !Number.isFinite(view.end) || !(view.end > view.start)) return NaN
  const size = Number.isFinite(view.size) ? view.size : 0
  return (Number.isFinite(view.top) ? view.top : 0) + ((ts - view.start) / (view.end - view.start)) * size
}
export function timeAt (px, view) {
  if (!view || !Number.isFinite(px) || !Number.isFinite(view.start) || !Number.isFinite(view.end) || !(view.end > view.start) || !(view.size > 0)) return NaN
  const top = Number.isFinite(view.top) ? view.top : 0
  return view.start + ((px - top) / view.size) * (view.end - view.start)
}

// ── label decluttering ───────────────────────────────────────────────────────

/**
 * Keep the labels that fit. items = [{ y, h?, priority? }] (y = centre in px, h = text height, default 10, priority: bigger wins).
 * Greedy by priority (then by the smaller y): an item is dropped when its box [y - h/2, y + h/2] (plus gap) overlaps an already
 * kept one. Returns the kept items in their input order. Hostile entries (non-finite y) are dropped; at most 2000 are looked at.
 */
export function declutter (items, gap = 2) {
  if (!Array.isArray(items)) return []
  const list = []
  for (let i = 0; i < items.length && list.length < 2000; i++) {
    const it = items[i]
    if (!it || !Number.isFinite(it.y)) continue
    list.push({ it, i, h: Number.isFinite(it.h) && it.h > 0 ? it.h : 10, pr: Number.isFinite(it.priority) ? it.priority : 0 })
  }
  const order = list.slice().sort((a, b) => (b.pr - a.pr) || (a.it.y - b.it.y) || (a.i - b.i))
  const kept = []
  const g = Number.isFinite(gap) ? Math.max(0, gap) : 0
  for (const c of order) {
    const lo = c.it.y - c.h / 2 - g / 2, hi = c.it.y + c.h / 2 + g / 2
    let clash = false
    for (const k of kept) { if (lo < k.hi && hi > k.lo) { clash = true; break } }
    if (!clash) kept.push({ c, lo, hi })
  }
  return kept.map(k => k.c).sort((a, b) => a.i - b.i).map(c => c.it)
}

// ── formatting ───────────────────────────────────────────────────────────────

/** Duration HH:MM:SS (hours keep counting past 99); negative / bad -> 00:00:00. */
export function formatHMS (ms) {
  const total = Number.isFinite(ms) ? Math.max(0, Math.floor(ms / 1000)) : 0
  return `${String(Math.floor(total / 3600)).padStart(2, '0')}:${p2((total % 3600) / 60)}:${p2(total % 60)}`
}
/** 24-hour wall clock HH:MM:SS of ts (local); '--:--:--' for bad input. */
export function formatClock (ts) {
  const p = parts(ts); return p ? `${p2(p.h)}:${p2(p.mi)}:${p2(p.s)}` : '--:--:--'
}
/** 'Mon 12 Oct 2026 14:30:00' */
export function formatStamp (ts) {
  const p = parts(ts); if (!p) return '—'
  return `${WEEKDAY_SHORT[p.dow]} ${p.d} ${MONTH_SHORT[p.mo]} ${p.y} ${formatClock(ts)}`
}

// ── baseline input ───────────────────────────────────────────────────────────

/** 'YYYY-MM-DD' + 'HH:MM' | 'HH:MM:SS' (local) -> { ok:true, ts } | { ok:false, error }. Rejects 30 February, 24:00, a time that does not exist (DST gap), years outside 1900..2999. */
export function parseBaselineInput (dateStr, timeStr) {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(typeof dateStr === 'string' ? dateStr.trim() : '')
  if (!dm) return { ok: false, error: 'Date must look like 2026-10-12.' }
  const tm = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(typeof timeStr === 'string' ? timeStr.trim() : '')
  if (!tm) return { ok: false, error: 'Time must look like 00:00:00 or 08:30.' }
  const y = +dm[1], mo = +dm[2] - 1, d = +dm[3], h = +tm[1], mi = +tm[2], s = tm[3] == null ? 0 : +tm[3]
  if (y < 1900 || y > 2999) return { ok: false, error: 'Year must be between 1900 and 2999.' }
  if (mo < 0 || mo > 11) return { ok: false, error: 'Month must be 01 to 12.' }
  if (d < 1 || d > daysInMonth(y, mo)) return { ok: false, error: 'That day does not exist in that month.' }
  if (h > 23 || mi > 59 || s > 59) return { ok: false, error: 'Time must be 00:00:00 to 23:59:59.' }
  const ts = wall(y, mo, d, h, mi, s)
  const back = parts(ts)
  if (!back || back.y !== y || back.mo !== mo || back.d !== d || back.h !== h || back.mi !== mi || back.s !== s) {
    return { ok: false, error: 'That local time does not exist (daylight-saving gap). Pick a minute later.' }
  }
  return { ok: true, ts }
}
/** { date:'YYYY-MM-DD', time:'HH:MM:SS' } of a timestamp (local), or null. */
export function baselineInputs (ts) {
  const p = parts(ts); if (!p) return null
  return { date: `${String(p.y).padStart(4, '0')}-${p2(p.mo + 1)}-${p2(p.d)}`, time: `${p2(p.h)}:${p2(p.mi)}:${p2(p.s)}` }
}
