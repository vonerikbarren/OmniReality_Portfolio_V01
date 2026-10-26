/**
 * utils/OmniSimClockModel.js — the MODEL of a simulated clock: one cycle (a "day") that is played back faster or slower than real time, with
 * speed-change keyframes (V199). PURE: no DOM, no THREE, no storage, no timers. The design is docs/architecture/OMNITIMEORBIT_DESIGN.md.
 *
 * It is the clock a SkyboxNode (accelerated day / night) and a TimeTunnelNode read. It is NOT a second Primary Time: Primary Time (utils/PrimaryTime.js)
 * stays the global clock; this clock turns "seconds of someone's time" (its own elapsed time, or Primary Time) into a position in ONE cycle.
 *
 * Terms: the cycle covers `spanHours` of SIMULATED time (24 = a day). `realSeconds` is how long one cycle takes in real time at rate 1 (a 24 h day played in
 * 10 minutes = 600). `phase` is the position in the cycle, 0..1. A rate key {phase, rate} means "from this phase on the clock runs at `rate` times the base
 * speed" (a step, not a ramp, so every conversion below is EXACT and invertible, like the tempo map of OmniSongModel). A key on phase 0 is folded into
 * `baseRate`. The real length of one cycle is realSeconds * sum(dPhase / rate) over the segments (`totalRealSeconds`).
 *
 * It lives in `node.data.clock` (saved WITH the node). sanitizeClock NEVER throws, drops unknown keys (also __proto__ / constructor), clamps numbers, enforces
 * CLOCK_LIMITS, sorts and de-duplicates keys, and is IDEMPOTENT (sanitize(sanitize(x)) deep-equals sanitize(x)). Edit ops are IMMUTABLE and never throw:
 * `(clock, ...args) -> a new sanitized clock` (an op that cannot apply returns the sanitized input unchanged).
 * USER-facing module: it imports nothing.
 */

export const CLOCK_VERSION = 1
export const CLOCK_LIMITS = Object.freeze({
  spanHoursMin: 1, spanHoursMax: 8760, spanHoursDefault: 24,
  realSecondsMin: 1, realSecondsMax: 604800, realSecondsDefault: 600,
  rateMin: 0.05, rateMax: 16, keysMax: 64, nameMax: 24, idMax: 32,
})
export const DRIVES = Object.freeze(['own', 'primary'])
/** The day lengths of the design: a 24 h day played in this much REAL time. */
export const CLOCK_PRESETS = Object.freeze([
  { id: '24h', label: '24 hours', realSeconds: 86400 }, { id: '12h', label: '12 hours', realSeconds: 43200 },
  { id: '6h', label: '6 hours', realSeconds: 21600 }, { id: '4h', label: '4 hours', realSeconds: 14400 },
  { id: '2h', label: '2 hours', realSeconds: 7200 }, { id: '1h', label: '1 hour', realSeconds: 3600 },
  { id: '30m', label: '30 minutes', realSeconds: 1800 }, { id: '10m', label: '10 minutes', realSeconds: 600 },
  { id: '5m', label: '5 minutes', realSeconds: 300 },
])
const L = CLOCK_LIMITS

const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k)
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v)
const get = (o, k) => { try { return isObj(o) && has(o, k) ? o[k] : undefined } catch (_) { return undefined } }
const r3 = (v) => { const x = Math.round(v * 1000) / 1000; return x === 0 ? 0 : x }
const r4 = (v) => { const x = Math.round(v * 10000) / 10000; return x === 0 ? 0 : x }
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v)
const toNum = (v, d) => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : d
  if (typeof v === 'string' && v.trim() !== '') { const n = Number(v); return Number.isFinite(n) ? n : d }
  return d
}
const numIn = (v, d, a, b) => clamp(toNum(v, d), a, b)
const boolOf = (v, d) => (typeof v === 'boolean' ? v : (v === 1 || v === 'true') ? true : (v === 0 || v === 'false') ? false : d)
const cleanText = (v, max, d = '') => {
  const s = (typeof v === 'string' || typeof v === 'number') ? String(v).replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max) : ''
  return s || d
}
const ID_RE = /^[A-Za-z0-9_-]{1,32}$/
const validId = (v) => (typeof v === 'string' && ID_RE.test(v) && !v.startsWith('__') ? v : null)
const items = (a, cap) => { if (!Array.isArray(a)) return []; const out = []; const n = Math.min(a.length, cap * 2); for (let i = 0; i < n; i++) { let x; try { x = a[i] } catch (_) { x = undefined } if (x !== undefined) out.push(x) } return out }

let idCounter = 0
/** A fresh id (not stored anywhere). */
export function newId (prefix = 'k') { idCounter = (idCounter + 1) % 1e9; return (String(prefix).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 8) || 'k') + Date.now().toString(36).slice(-5) + idCounter.toString(36) }

export function defaultClock () {
  return { v: CLOCK_VERSION, name: 'Day', spanHours: L.spanHoursDefault, realSeconds: L.realSecondsDefault, loop: true, startPhase: 0, drive: 'own', baseRate: 1, keys: [] }
}

/** Repair ANY value into a valid clock. Never throws. */
export function sanitizeClock (raw) {
  const d = defaultClock()
  if (!isObj(raw)) return d
  const out = {
    v: CLOCK_VERSION,
    name: cleanText(get(raw, 'name'), L.nameMax, d.name),
    spanHours: r3(numIn(get(raw, 'spanHours'), d.spanHours, L.spanHoursMin, L.spanHoursMax)),
    realSeconds: r3(numIn(get(raw, 'realSeconds'), d.realSeconds, L.realSecondsMin, L.realSecondsMax)),
    loop: boolOf(get(raw, 'loop'), d.loop),
    startPhase: 0,
    drive: DRIVES.includes(get(raw, 'drive')) ? get(raw, 'drive') : d.drive,
    baseRate: r3(numIn(get(raw, 'baseRate'), 1, L.rateMin, L.rateMax)),
    keys: [],
  }
  out.startPhase = r4(numIn(get(raw, 'startPhase'), 0, 0, 0.9999))
  const used = new Set()
  const cand = []
  for (const k of items(get(raw, 'keys'), L.keysMax)) {
    if (!isObj(k)) continue
    const phase = r4(numIn(get(k, 'phase'), NaN, 0, 1))
    if (!Number.isFinite(phase)) continue
    const rate = r3(numIn(get(k, 'rate'), 1, L.rateMin, L.rateMax))
    let id = validId(get(k, 'id'))
    if (!id || used.has(id)) id = null
    if (id) used.add(id)
    cand.push({ id, phase, rate, name: cleanText(get(k, 'name'), L.nameMax, '') })
  }
  cand.sort((a, b) => a.phase - b.phase)
  let n = 0
  for (const k of cand) {
    if (k.phase <= 0) { out.baseRate = k.rate; continue }   // a key on phase 0 is the base rate
    if (k.phase >= 1) continue                              // nothing runs after the end
    const last = out.keys[out.keys.length - 1]
    if (last && k.phase - last.phase < 0.0005) continue     // two keys on (almost) the same phase: the first wins
    if (out.keys.length >= L.keysMax) break
    let id = k.id
    while (!id) { n++; const c = 'k' + n; if (!used.has(c)) { id = c; used.add(c) } }
    out.keys.push({ id, phase: k.phase, rate: k.rate, name: k.name })
  }
  return out
}

/** The constant-rate segments that cover phase 0..1: [{p0, p1, rate, id}] (id of the key that starts it, '' for the base segment). */
export function segments (clock) {
  const c = sanitizeClock(clock)
  const segs = []
  let p0 = 0; let rate = c.baseRate; let id = ''
  for (const k of c.keys) { segs.push({ p0, p1: k.phase, rate, id }); p0 = k.phase; rate = k.rate; id = k.id }
  segs.push({ p0, p1: 1, rate, id })
  return segs
}

/** Real seconds one full cycle takes with the speed keys applied. */
export function totalRealSeconds (clock) {
  const c = sanitizeClock(clock)
  let t = 0
  for (const s of segments(c)) t += c.realSeconds * (s.p1 - s.p0) / s.rate
  return t
}

/** Real seconds (from the start of the cycle) at which the cycle reaches `phase` (0..1). Exact inverse of phaseAtReal. */
export function realAtPhase (clock, phase) {
  const c = sanitizeClock(clock)
  const p = clamp(toNum(phase, 0), 0, 1)
  let t = 0
  for (const s of segments(c)) {
    if (p >= s.p1) { t += c.realSeconds * (s.p1 - s.p0) / s.rate; continue }
    if (p > s.p0) t += c.realSeconds * (p - s.p0) / s.rate
    break
  }
  return t
}

/** The phase (0..1) reached `seconds` of real time after the start of the cycle (clamped to 0..1). Exact inverse of realAtPhase. */
export function phaseAtReal (clock, seconds) {
  const c = sanitizeClock(clock)
  let t = Math.max(0, toNum(seconds, 0))
  for (const s of segments(c)) {
    const dur = c.realSeconds * (s.p1 - s.p0) / s.rate
    if (t < dur) return s.p0 + t * s.rate / c.realSeconds
    t -= dur
  }
  return 1
}

/** The rate (times the base speed) in force at `phase`. */
export function rateAtPhase (clock, phase) {
  const p = clamp(toNum(phase, 0), 0, 1)
  let r = 1
  for (const s of segments(clock)) { if (p >= s.p0) r = s.rate; else break }
  return r
}

/**
 * Where the clock is after `elapsed` real seconds of its driver (own elapsed time, or Primary Time seconds). It starts at `startPhase`.
 * Looping: wraps forever and counts `loops`. Not looping: stops at phase 1 with done = true.
 * Returns { phase, hours, hourOfDay, dayFraction, rate, loops, done, cycleSeconds }:
 *  hours = simulated hours into the span (0..spanHours); hourOfDay = hours mod 24 (0..24); dayFraction = hourOfDay / 24 (what a sky reads).
 */
export function stateAt (clock, elapsed) {
  const c = sanitizeClock(clock)
  const total = totalRealSeconds(c)
  const e = Math.max(0, toNum(elapsed, 0))
  const c0 = realAtPhase(c, c.startPhase) + e
  let loops = 0; let done = false; let cyc = c0
  if (c.loop) { loops = Math.floor(c0 / total); cyc = c0 - loops * total } else if (c0 >= total) { done = true; cyc = total }
  const phase = done ? 1 : clamp(phaseAtReal(c, cyc), 0, 1)
  const hours = phase * c.spanHours
  const hourOfDay = hours % 24 === 0 && hours > 0 && done ? 24 : hours % 24
  return { phase: r4(phase), hours: r3(hours), hourOfDay: r3(hourOfDay), dayFraction: r4(hourOfDay / 24), rate: rateAtPhase(c, phase), loops, done, cycleSeconds: r3(total) }
}

/** How many simulated seconds pass per real second on average over one cycle (the compression ratio, e.g. 24 h in 10 min = 144). */
export function compressionRatio (clock) {
  const c = sanitizeClock(clock)
  return r3(c.spanHours * 3600 / totalRealSeconds(c))
}

// ── edit ops (immutable, never throw) ──
const find = (c, id) => c.keys.findIndex(k => k.id === id)
export function setPreset (clock, presetId) {
  const c = sanitizeClock(clock); const p = CLOCK_PRESETS.find(x => x.id === presetId)
  return p ? sanitizeClock({ ...c, spanHours: 24, realSeconds: p.realSeconds }) : c
}
export function setSpan (clock, spanHours, realSeconds) {
  const c = sanitizeClock(clock)
  return sanitizeClock({ ...c, spanHours: toNum(spanHours, c.spanHours), realSeconds: realSeconds === undefined ? c.realSeconds : toNum(realSeconds, c.realSeconds) })
}
export function setLoop (clock, loop) { const c = sanitizeClock(clock); return sanitizeClock({ ...c, loop: boolOf(loop, c.loop) }) }
export function setDrive (clock, drive) { const c = sanitizeClock(clock); return sanitizeClock({ ...c, drive }) }
export function setStartPhase (clock, phase) { const c = sanitizeClock(clock); return sanitizeClock({ ...c, startPhase: toNum(phase, c.startPhase) }) }
export function setBaseRate (clock, rate) { const c = sanitizeClock(clock); return sanitizeClock({ ...c, baseRate: toNum(rate, c.baseRate) }) }
/** spec {phase, rate, id?, name?}. Pass your own id to learn it (newId('k')), or use addedKeyId(before, after). */
export function addRateKey (clock, spec) {
  const c = sanitizeClock(clock)
  if (!isObj(spec) || c.keys.length >= L.keysMax) return c
  return sanitizeClock({ ...c, keys: [...c.keys, { id: get(spec, 'id') ?? newId('k'), phase: get(spec, 'phase'), rate: get(spec, 'rate'), name: get(spec, 'name') }] })
}
export function addedKeyId (before, after) {
  const b = new Set(sanitizeClock(before).keys.map(k => k.id))
  const a = sanitizeClock(after).keys.find(k => !b.has(k.id))
  return a ? a.id : null
}
export function moveRateKey (clock, id, phase) {
  const c = sanitizeClock(clock); const i = find(c, id); if (i < 0) return c
  const keys = c.keys.map((k, j) => (j === i ? { ...k, phase: toNum(phase, k.phase) } : k))
  return sanitizeClock({ ...c, keys })
}
export function setRateKey (clock, id, rate) {
  const c = sanitizeClock(clock); const i = find(c, id); if (i < 0) return c
  return sanitizeClock({ ...c, keys: c.keys.map((k, j) => (j === i ? { ...k, rate: toNum(rate, k.rate) } : k)) })
}
export function removeRateKey (clock, id) {
  const c = sanitizeClock(clock); const i = find(c, id); if (i < 0) return c
  return sanitizeClock({ ...c, keys: c.keys.filter((_, j) => j !== i) })
}
