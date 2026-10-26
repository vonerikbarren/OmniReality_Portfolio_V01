/**
 * utils/OmniMixModel.js — the MODEL of an OmniMusicMixNode (V201). PURE: no DOM, no THREE, no storage, no audio.
 *
 * A mix is a mixing desk with DJ behaviour. It lives in `node.data.mix` (saved WITH the node). It holds:
 *   strips      up to 16 channel strips. Each strip points at a source (a SongNode, a SoundNode, or an audio-library clip) and has a fader (volume), pan, mute / solo,
 *               a low-pass filter, a 3-band EQ (0.5 = flat), two sends (reverb, delay), a crossfader assign (A / Thru / B), a loop flag, and an optional tempo for sync.
 *   master      gain, limiter on / threshold, reverb and delay returns, and the mix tempo (bpm).
 *   cross       the crossfader: pos -1 (all A) .. +1 (all B) and a curve ('constant-power' | 'linear'). Same maths as the OmniDJ (utils/OmniDJModel.js).
 *   automation  lanes {target, points:[{t seconds, v, ease}]} for any strip parameter, 'master.gain', or 'cross.pos'. A DJ move is a recorded lane: it replays and can be edited.
 *
 * Time is in SECONDS from the start of the mix (a mix is a performance, not a bar grid). Strip parameters are plain numbers; automation REPLACES the stored value while a lane exists
 * (like the song mixer). Edit ops are IMMUTABLE and never throw: (mix, ...args) -> a new sanitized mix; an op that cannot apply returns the sanitized input unchanged.
 * sanitizeMix NEVER throws, drops unknown keys (also __proto__ / constructor), clamps numbers, enforces the caps of MIX_LIMITS, makes ids unique and is IDEMPOTENT.
 * USER-facing module: it imports nothing.
 */

import * as D from './OmniDeckMath.js'

export const MIX_VERSION = 1
export const KIND_MIX = 'mixNode'
export const MIX_LIMITS = Object.freeze({
  strips: 16, lanes: 64, points: 256, nameMax: 32, idMax: 32, secondsMax: 3600, bpmMin: 40, bpmMax: 240, bpmDefault: 120,
  limiterDbMin: -24, limiterDbMax: 0, syncMin: 0.5, syncMax: 2, pointGapS: 0.02,
})
export const SOURCE_TYPES = Object.freeze(['song', 'sound', 'audio'])
export const ASSIGNS = Object.freeze(['A', 'T', 'B'])
export const CURVES = Object.freeze(['constant-power', 'linear'])
export const EASES = Object.freeze(['linear', 'step'])
export const STRIP_PARAMS = Object.freeze(['volume', 'pan', 'filter', 'eqLow', 'eqMid', 'eqHigh', 'sendReverb', 'sendDelay'])
export const COLORS = Object.freeze(['#ff8a5c', '#5ccfff', '#b48cff', '#6be8a0', '#ffd45c', '#ff6b9a', '#8fb3ff', '#c3e86b'])
/** [min, max, default] of every automatable target. */
export const RANGES = Object.freeze({
  volume: [0, 1, 0.8], pan: [-1, 1, 0], filter: [0, 1, 1], eqLow: [0, 1, 0.5], eqMid: [0, 1, 0.5], eqHigh: [0, 1, 0.5], sendReverb: [0, 1, 0], sendDelay: [0, 1, 0],
  'master.gain': [0, 1, 0.8], 'cross.pos': [-1, 1, 0],
})
const L = MIX_LIMITS

const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k)
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v)
const get = (o, k) => { try { return isObj(o) && has(o, k) ? o[k] : undefined } catch (_) { return undefined } }
const isNum = (v) => typeof v === 'number' && Number.isFinite(v)
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const num = (v, def, lo = -Infinity, hi = Infinity) => {
  const n = typeof v === 'string' && v.trim() !== '' && v.length < 24 ? Number(v) : v
  return isNum(n) ? clamp(n, lo, hi) : def
}
const r3 = (v) => Math.round(v * 1000) / 1000
const bool = (v, def) => (typeof v === 'boolean' ? v : def)
const pickOf = (v, list, def) => (typeof v === 'string' && list.includes(v) ? v : def)
const cleanText = (v, max, def = '') => (typeof v === 'string' ? v.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, max) : def)
const validId = (v) => (typeof v === 'string' && /^[A-Za-z0-9_-]{1,32}$/.test(v) && v !== '__proto__' && v !== 'constructor' && v !== 'prototype' ? v : null)
export const newId = (prefix = 'st') => prefix + '_' + Math.random().toString(36).slice(2, 8)
const freshId = (prefix, taken) => { let id; let n = 0; do { id = newId(prefix); n++ } while (taken.has(id) && n < 50); return id }

// ── defaults ────────────────────────────────────────────────────────────────────────────────────────────────────────
export function defaultStrip (over = {}) { return sanitizeStripRaw(over, 0) }
export function defaultMix () {
  return sanitizeMix({ version: MIX_VERSION, name: 'Mix', bpm: L.bpmDefault, strips: [], master: {}, cross: {}, automation: [] })
}

// ── sanitize ────────────────────────────────────────────────────────────────────────────────────────────────────────
function sanitizeSource (raw) {
  const type = pickOf(get(raw, 'type'), SOURCE_TYPES, 'audio')
  const id = typeof get(raw, 'id') === 'string' ? get(raw, 'id').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 64) : ''
  return { type, id }
}
function sanitizeHot (raw) {
  const out = []
  for (let i = 0; i < D.HOT_CUES; i++) { const v = Array.isArray(raw) ? raw[i] : null; const n = v === null || v === undefined ? null : num(v, null, 0, D.CLIP_SECONDS_MAX); out.push(n === null ? null : r3(n)) }
  return out
}
function sanitizeLoop (raw) {
  const a = r3(num(get(raw, 'loopIn'), 0, 0, D.CLIP_SECONDS_MAX)); const z = r3(num(get(raw, 'loopOut'), 0, 0, D.CLIP_SECONDS_MAX))
  const valid = D.validLoop(a, z)
  return { loopIn: valid ? a : 0, loopOut: valid ? z : 0, loopOn: valid && bool(get(raw, 'loopOn'), false) }
}
function sanitizeStripRaw (raw, index) {
  const sy = get(raw, 'bpm')
  return {
    id: validId(get(raw, 'id')) ?? 'st_' + index,
    name: cleanText(get(raw, 'name'), L.nameMax, 'Strip ' + (index + 1)),
    source: sanitizeSource(get(raw, 'source')),
    volume: r3(num(get(raw, 'volume'), RANGES.volume[2], 0, 1)),
    pan: r3(num(get(raw, 'pan'), 0, -1, 1)),
    mute: bool(get(raw, 'mute'), false),
    solo: bool(get(raw, 'solo'), false),
    filter: r3(num(get(raw, 'filter'), 1, 0, 1)),
    eq: { low: r3(num(get(get(raw, 'eq'), 'low'), 0.5, 0, 1)), mid: r3(num(get(get(raw, 'eq'), 'mid'), 0.5, 0, 1)), high: r3(num(get(get(raw, 'eq'), 'high'), 0.5, 0, 1)) },
    sends: { reverb: r3(num(get(get(raw, 'sends'), 'reverb'), 0, 0, 1)), delay: r3(num(get(get(raw, 'sends'), 'delay'), 0, 0, 1)) },
    assign: pickOf(get(raw, 'assign'), ASSIGNS, 'T'),
    loop: bool(get(raw, 'loop'), true),
    bpm: sy === null || sy === undefined || sy === 0 ? 0 : r3(num(sy, 0, L.bpmMin, L.bpmMax)),   // 0 = no tempo (no sync)
    sync: bool(get(raw, 'sync'), false),
    // V202 deck fields (clip seconds): cue point, 4 hot cues, loop region, beat grid start, pitch trim, key lock
    cue: r3(num(get(raw, 'cue'), 0, 0, D.CLIP_SECONDS_MAX)),
    hot: sanitizeHot(get(raw, 'hot')),
    ...sanitizeLoop(raw),
    beat1: r3(num(get(raw, 'beat1'), 0, 0, D.CLIP_SECONDS_MAX)),
    pitch: r3(num(get(raw, 'pitch'), 0, -1, 1)),
    keyLock: bool(get(raw, 'keyLock'), false),
    color: typeof get(raw, 'color') === 'string' && /^#[0-9a-fA-F]{6}$/.test(get(raw, 'color')) ? get(raw, 'color').toLowerCase() : COLORS[index % COLORS.length],
  }
}
function sanitizePoints (raw) {
  const pts = []
  for (const p of Array.isArray(raw) ? raw.slice(0, L.points * 2) : []) {
    const t = num(get(p, 't'), null, 0, L.secondsMax); const v = num(get(p, 'v'), null)
    if (t === null || v === null) continue
    pts.push({ t: r3(t), v: r3(v), ease: pickOf(get(p, 'ease'), EASES, 'linear') })
  }
  pts.sort((a, b) => a.t - b.t)
  const out = []
  for (const p of pts) { if (out.length && Math.abs(out[out.length - 1].t - p.t) < 1e-9) out[out.length - 1] = p; else out.push(p) }
  return out.slice(0, L.points)
}
/** A target is 'master.gain', 'cross.pos', or '<stripId>.<param>'. Returns the clamp range or null. */
function rangeOf (target, stripIds) {
  if (target === 'master.gain' || target === 'cross.pos') return RANGES[target]
  const dot = typeof target === 'string' ? target.lastIndexOf('.') : -1
  if (dot < 1) return null
  const id = target.slice(0, dot); const p = target.slice(dot + 1)
  if (!stripIds.has(id) || !STRIP_PARAMS.includes(p)) return null
  return RANGES[p]
}
export function sanitizeMix (raw) {
  const r = isObj(raw) ? raw : {}
  const taken = new Set()
  const strips = []
  for (const s of Array.isArray(get(r, 'strips')) ? get(r, 'strips').slice(0, L.strips * 2) : []) {
    if (strips.length >= L.strips) break
    const st = sanitizeStripRaw(s, strips.length)
    if (taken.has(st.id)) st.id = freshId('st', taken)
    taken.add(st.id); strips.push(st)
  }
  const m = get(r, 'master'); const lim = get(m, 'limiter')
  const master = {
    gain: r3(num(get(m, 'gain'), RANGES['master.gain'][2], 0, 1)),
    limiter: bool(isObj(lim) ? get(lim, 'on') : lim, true),
    limiterThresholdDb: r3(num(get(m, 'limiterThresholdDb'), -3, L.limiterDbMin, L.limiterDbMax)),
    reverbMix: r3(num(get(m, 'reverbMix'), 0.25, 0, 1)),
    delayMix: r3(num(get(m, 'delayMix'), 0.25, 0, 1)),
  }
  const c = get(r, 'cross')
  const cross = { pos: r3(num(get(c, 'pos'), 0, -1, 1)), curve: pickOf(get(c, 'curve'), CURVES, 'constant-power') }
  const ids = new Set(strips.map(s => s.id))
  const lanes = []; const seen = new Set()
  for (const a of Array.isArray(get(r, 'automation')) ? get(r, 'automation').slice(0, L.lanes * 2) : []) {
    if (lanes.length >= L.lanes) break
    const target = get(a, 'target')
    if (typeof target !== 'string' || seen.has(target) || !rangeOf(target, ids)) continue
    const [lo, hi] = rangeOf(target, ids)
    const points = sanitizePoints(get(a, 'points')).map(p => ({ ...p, v: r3(clamp(p.v, lo, hi)) }))
    if (!points.length) continue
    seen.add(target); lanes.push({ target, points })
  }
  return {
    version: MIX_VERSION,
    name: cleanText(get(r, 'name'), 64, 'Mix') || 'Mix',
    bpm: r3(num(get(r, 'bpm'), L.bpmDefault, L.bpmMin, L.bpmMax)),
    strips, master, cross, automation: lanes,
  }
}

// ── lookups ─────────────────────────────────────────────────────────────────────────────────────────────────────────
export const stripById = (mix, id) => mix.strips.find(s => s.id === id) ?? null
export const laneOf = (mix, target) => mix.automation.find(a => a.target === target) ?? null
/** The id an op added to `before` (strips / ids), or null. */
export function addedStripId (before, after) {
  const had = new Set(before.strips.map(s => s.id))
  return after.strips.find(s => !had.has(s.id))?.id ?? null
}
/** Total length of the longest automation lane, seconds. */
export function mixDuration (mix) {
  let d = 0
  for (const a of mix.automation) d = Math.max(d, a.points[a.points.length - 1]?.t ?? 0)
  return d
}

// ── automation maths ────────────────────────────────────────────────────────────────────────────────────────────────
/** The value of a lane at time t: holds before the first / after the last point, 'step' holds the previous value until the next point. */
export function laneValueAt (lane, t) {
  const p = lane?.points
  if (!p || !p.length) return null
  const x = num(t, 0)
  if (x <= p[0].t) return p[0].v
  if (x >= p[p.length - 1].t) return p[p.length - 1].v
  let lo = 0; let hi = p.length - 1
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (p[mid].t <= x) lo = mid; else hi = mid }
  const a = p[lo]; const b = p[hi]
  if (a.ease === 'step') return a.v
  const f = (x - a.t) / (b.t - a.t)
  return a.v + (b.v - a.v) * f
}
/** Mix with every automated target replaced by its value at time t. Returns the same object when there is no automation. */
export function applyAutomation (mix, t) {
  if (!mix.automation.length) return mix
  const out = { ...mix, strips: mix.strips.map(s => ({ ...s, eq: { ...s.eq }, sends: { ...s.sends } })), master: { ...mix.master }, cross: { ...mix.cross } }
  for (const lane of mix.automation) {
    const v = laneValueAt(lane, t); if (v === null) continue
    if (lane.target === 'master.gain') { out.master.gain = v; continue }
    if (lane.target === 'cross.pos') { out.cross.pos = v; continue }
    const dot = lane.target.lastIndexOf('.'); const s = out.strips.find(x => x.id === lane.target.slice(0, dot)); if (!s) continue
    const p = lane.target.slice(dot + 1)
    if (p === 'eqLow') s.eq.low = v; else if (p === 'eqMid') s.eq.mid = v; else if (p === 'eqHigh') s.eq.high = v
    else if (p === 'sendReverb') s.sends.reverb = v; else if (p === 'sendDelay') s.sends.delay = v
    else s[p] = v
  }
  return out
}

// ── mixing maths (same maths as the OmniDJ) ─────────────────────────────────────────────────────────────────────────
const volumeGain = (v) => { const x = clamp(num(v, 0), 0, 1); return x * x }
/** crossfader pos -1..1 -> { a, b } */
export function crossGains (pos, curve = 'constant-power') {
  const x = (clamp(num(pos, 0), -1, 1) + 1) / 2
  if (curve === 'linear') return { a: 1 - x, b: x }
  return { a: Math.cos(x * Math.PI / 2), b: Math.sin(x * Math.PI / 2) }
}
export const channelCrossGain = (assign, pos, curve) => { const g = crossGains(pos, curve); return assign === 'A' ? g.a : assign === 'B' ? g.b : 1 }
/** EQ knob 0..1 (0.5 flat) -> dB: 0 = -48 (kill), 0.5 = 0, 1 = +12 */
export function eqDb (v) { const x = clamp(num(v, 0.5), 0, 1); return x <= 0.5 ? -48 * (1 - x / 0.5) : 12 * ((x - 0.5) / 0.5) }
/** Filter knob 0..1 -> low-pass Hz (1 = open = 20 kHz) */
export const filterHz = (f) => (f >= 0.999 ? 20000 : 80 * Math.pow(18000 / 80, clamp(num(f, 1), 0, 1)))

/** Is the strip audible given mute / solo? With any solo, only soloed (and not muted) strips sound. */
export function stripAudible (mix, strip) {
  if (strip.mute) return false
  return mix.strips.some(s => s.solo) ? strip.solo : true
}
/** The linear gain of a strip (fader x crossfader x mute / solo). Pass the mix already run through applyAutomation for the time you want. */
export function stripGain (mix, strip) {
  if (!stripAudible(mix, strip)) return 0
  return volumeGain(strip.volume) * channelCrossGain(strip.assign, mix.cross.pos, mix.cross.curve)
}
/** { [stripId]: gain } for every strip. */
export function levelsOf (mix) {
  const o = {}
  for (const s of mix.strips) o[s.id] = stripGain(mix, s)
  return o
}
/** playbackRate that makes a strip with its own bpm match the mix bpm; 1 when sync is off, no tempo, or out of the allowed range. */
export function syncRate (mix, strip) {
  if (!strip.sync || !(strip.bpm > 0)) return 1
  return clamp(mix.bpm / strip.bpm, L.syncMin, L.syncMax)
}
/** V202: the playbackRate of a strip = tempo sync x pitch trim (+-8 %), 0.25..4. */
export function deckRateOf (mix, strip) { return D.deckRate(syncRate(mix, strip), strip.pitch) }
/** The tempo you hear on a strip (clip bpm x rate); 0 when the clip has no tempo. */
export function stripTempo (mix, strip) { return D.effectiveBpm(strip.bpm, deckRateOf(mix, strip)) }
/** The seconds between two beats of the mix. */
export const beatSeconds = (mix) => 60 / mix.bpm
/** Next beat boundary at or after t (for quantised starts). */
export function nextBeat (mix, t) { const b = beatSeconds(mix); return r3(Math.ceil(num(t, 0) / b - 1e-9) * b) }

// ── immutable edit ops ──────────────────────────────────────────────────────────────────────────────────────────────
function edit (mix, fn) {
  const m = sanitizeMix(mix)
  const copy = { ...m, strips: m.strips.map(s => ({ ...s, source: { ...s.source }, eq: { ...s.eq }, sends: { ...s.sends }, hot: [...s.hot] })), master: { ...m.master }, cross: { ...m.cross }, automation: m.automation.map(a => ({ target: a.target, points: a.points.map(p => ({ ...p })) })) }
  let r
  try { r = fn(copy) } catch (_) { return m }
  return r === false ? m : sanitizeMix(copy)
}
const pick = (o, keys) => { const out = {}; for (const k of keys) if (isObj(o) && has(o, k)) out[k] = o[k]; return out }

export function setName (mix, name) { return edit(mix, (m) => { m.name = name }) }
export function setBpm (mix, bpm) { return edit(mix, (m) => { m.bpm = bpm }) }

export function addStrip (mix, spec = {}) {
  return edit(mix, (m) => {
    if (m.strips.length >= L.strips) return false
    const taken = new Set(m.strips.map(s => s.id))
    let id = validId(get(spec, 'id')); if (!id || taken.has(id)) id = freshId('st', taken)
    m.strips.push({ ...pick(spec, ['name', 'source', 'volume', 'pan', 'mute', 'solo', 'filter', 'eq', 'sends', 'assign', 'loop', 'bpm', 'sync', 'color', 'cue', 'hot', 'loopIn', 'loopOut', 'loopOn', 'beat1', 'pitch', 'keyLock']), id })
  })
}
export function removeStrip (mix, id) {
  return edit(mix, (m) => {
    if (!m.strips.some(s => s.id === id)) return false
    m.strips = m.strips.filter(s => s.id !== id)
    m.automation = m.automation.filter(a => !a.target.startsWith(id + '.'))
  })
}
export function updateStrip (mix, id, patch) {
  return edit(mix, (m) => {
    const s = m.strips.find(x => x.id === id); if (!s) return false
    Object.assign(s, pick(patch, ['name', 'source', 'volume', 'pan', 'mute', 'solo', 'filter', 'assign', 'loop', 'bpm', 'sync', 'color', 'cue', 'hot', 'loopIn', 'loopOut', 'loopOn', 'beat1', 'pitch', 'keyLock']))
    const eq = get(patch, 'eq'); if (isObj(eq)) s.eq = { ...s.eq, ...pick(eq, ['low', 'mid', 'high']) }
    const sends = get(patch, 'sends'); if (isObj(sends)) s.sends = { ...s.sends, ...pick(sends, ['reverb', 'delay']) }
  })
}
export function moveStrip (mix, id, toIndex) {
  return edit(mix, (m) => {
    const i = m.strips.findIndex(s => s.id === id); if (i < 0) return false
    const j = clamp(Math.round(num(toIndex, i)), 0, m.strips.length - 1)
    if (i === j) return false
    const [s] = m.strips.splice(i, 1); m.strips.splice(j, 0, s)
  })
}
/** Set one automatable value by target name ('volume' needs a strip id: setParam(mix, 'st_1.volume', 0.5), or 'master.gain', 'cross.pos'). */
export function setParam (mix, target, value) {
  return edit(mix, (m) => {
    if (target === 'master.gain') { m.master.gain = value; return }
    if (target === 'cross.pos') { m.cross.pos = value; return }
    const dot = typeof target === 'string' ? target.lastIndexOf('.') : -1; if (dot < 1) return false
    const s = m.strips.find(x => x.id === target.slice(0, dot)); const p = target.slice(dot + 1)
    if (!s || !STRIP_PARAMS.includes(p)) return false
    if (p === 'eqLow') s.eq.low = value; else if (p === 'eqMid') s.eq.mid = value; else if (p === 'eqHigh') s.eq.high = value
    else if (p === 'sendReverb') s.sends.reverb = value; else if (p === 'sendDelay') s.sends.delay = value
    else s[p] = value
  })
}
export function setMaster (mix, patch) { return edit(mix, (m) => { Object.assign(m.master, pick(patch, ['gain', 'limiter', 'limiterThresholdDb', 'reverbMix', 'delayMix'])) }) }
export function setCross (mix, patch) { return edit(mix, (m) => { Object.assign(m.cross, pick(patch, ['pos', 'curve'])) }) }
/** Soloing is exclusive when `exclusive` is true (the DJ way): only this strip stays soloed. */
export function toggleSolo (mix, id, exclusive = false) {
  return edit(mix, (m) => {
    const s = m.strips.find(x => x.id === id); if (!s) return false
    const next = !s.solo
    if (exclusive) for (const o of m.strips) o.solo = false
    s.solo = next
  })
}

// ── automation ops ──────────────────────────────────────────────────────────────────────────────────────────────────
export function addAutoPoint (mix, target, t, v, ease = 'linear') {
  return edit(mix, (m) => {
    const ids = new Set(m.strips.map(s => s.id))
    const rg = rangeOf(target, ids); if (!rg) return false
    const t0 = num(t, null, 0, L.secondsMax); const vv = num(v, null); if (t0 === null || vv === null) return false
    const tt = r3(t0)
    let lane = m.automation.find(a => a.target === target)
    if (!lane) { if (m.automation.length >= L.lanes) return false; lane = { target, points: [] }; m.automation.push(lane) }
    const near = lane.points.findIndex(p => Math.abs(p.t - tt) < 1e-6)
    const pt = { t: tt, v: clamp(vv, rg[0], rg[1]), ease }
    if (near >= 0) lane.points[near] = pt; else { if (lane.points.length >= L.points) return false; lane.points.push(pt) }
  })
}
export function removeAutoPoint (mix, target, index) {
  return edit(mix, (m) => {
    const lane = m.automation.find(a => a.target === target); if (!lane || !lane.points[index]) return false
    lane.points.splice(index, 1)
    if (!lane.points.length) m.automation = m.automation.filter(a => a !== lane)
  })
}
export function clearAuto (mix, target = null) {
  return edit(mix, (m) => {
    const before = m.automation.length
    m.automation = target == null ? [] : m.automation.filter(a => a.target !== target)
    if (m.automation.length === before) return false
  })
}
/** Record one fader move at time t: drops points that would crowd the previous one (pointGapS), so a drag becomes a clean curve. */
export function recordMove (mix, target, t, v) {
  const lane = laneOf(sanitizeMix(mix), target)
  const tt = num(t, 0, 0, L.secondsMax)
  if (lane && lane.points.length) {
    const last = lane.points[lane.points.length - 1]
    if (tt > last.t && tt - last.t < L.pointGapS) {
      // too close: replace the last point's value instead of adding a new one
      return addAutoPoint(mix, target, last.t, v, last.ease)
    }
  }
  return addAutoPoint(mix, target, tt, v)
}

// ── DJ moves (they write automation, so a transition is replayable and editable) ───────────────────────────────────
/** A crossfader move from where it is to `toPos` over `seconds`, starting at `startT`. */
export function crossfadeTransition (mix, toPos, startT, seconds) {
  const m = sanitizeMix(mix)
  const from = laneValueAt(laneOf(m, 'cross.pos'), startT) ?? m.cross.pos
  const t0 = r3(num(startT, 0, 0, L.secondsMax)); const t1 = r3(Math.min(L.secondsMax, t0 + Math.max(0.05, num(seconds, 4, 0.05, 600))))
  let out = addAutoPoint(m, 'cross.pos', t0, from)
  out = addAutoPoint(out, 'cross.pos', t1, num(toPos, 0, -1, 1))
  return out
}
/** A fader move of one strip to `toVolume` over `seconds` from `startT` (fade in / fade out). */
export function fadeStrip (mix, id, toVolume, startT, seconds) {
  const m = sanitizeMix(mix); const s = stripById(m, id); if (!s) return m
  const target = id + '.volume'
  const from = laneValueAt(laneOf(m, target), startT) ?? s.volume
  const t0 = r3(num(startT, 0, 0, L.secondsMax)); const t1 = r3(Math.min(L.secondsMax, t0 + Math.max(0.05, num(seconds, 4, 0.05, 600))))
  let out = addAutoPoint(m, target, t0, from)
  out = addAutoPoint(out, target, t1, num(toVolume, 0, 0, 1))
  return out
}
/** A "filter sweep": filter from open to `toFilter` over `seconds`. */
export function filterSweep (mix, id, toFilter, startT, seconds) {
  const m = sanitizeMix(mix); const s = stripById(m, id); if (!s) return m
  const target = id + '.filter'
  const from = laneValueAt(laneOf(m, target), startT) ?? s.filter
  const t0 = r3(num(startT, 0, 0, L.secondsMax)); const t1 = r3(Math.min(L.secondsMax, t0 + Math.max(0.05, num(seconds, 4, 0.05, 600))))
  let out = addAutoPoint(m, target, t0, from)
  out = addAutoPoint(out, target, t1, num(toFilter, 0, 0, 1))
  return out
}

// ── V202 deck ops (cue points, hot cues, loops, beat grid, pitch, key lock, tap tempo) — times are CLIP seconds ───────────────────────────────────────
const stripEdit = (mix, id, fn) => edit(mix, (m) => { const s = m.strips.find(x => x.id === id); if (!s) return false; return fn(s, m) })

/** Set the main cue point. snap = true snaps it to the beat grid (needs the clip's bpm). */
export function setCue (mix, id, t, snap = false) {
  return stripEdit(mix, id, (s) => { const v = num(t, null, 0, D.CLIP_SECONDS_MAX); if (v === null) return false; s.cue = snap ? D.snapToBeat(s.bpm, s.beat1, v) : v })
}
/** Store (t = a number) or clear (t = null) hot cue slot 0..3. */
export function setHotCue (mix, id, slot, t, snap = false) {
  return stripEdit(mix, id, (s) => {
    const i = Math.round(num(slot, -1)); if (i < 0 || i >= D.HOT_CUES) return false
    if (t === null || t === undefined) { s.hot[i] = null; return }
    const v = num(t, null, 0, D.CLIP_SECONDS_MAX); if (v === null) return false
    s.hot[i] = snap ? D.snapToBeat(s.bpm, s.beat1, v) : v
  })
}
/** Set the loop region and/or switch it on or off: patch = { loopIn, loopOut, loopOn }. An invalid region (shorter than 20 ms) switches the loop off. */
export function setLoop (mix, id, patch) {
  return stripEdit(mix, id, (s) => { Object.assign(s, pick(patch, ['loopIn', 'loopOut', 'loopOn'])) })
}
export function toggleLoop (mix, id) {
  return stripEdit(mix, id, (s) => { if (!D.validLoop(s.loopIn, s.loopOut)) return false; s.loopOn = !s.loopOn })
}
/** A loop of `beats` beats from the beat you are in (`pos` = the clip time now), switched on. `dur` = clip length in seconds when known. */
export function loopBeats (mix, id, pos, beats, dur = 0) {
  return stripEdit(mix, id, (s) => { const r = D.loopFromBeats(s.bpm, s.beat1, pos, beats, dur); s.loopIn = r.loopIn; s.loopOut = r.loopOut; s.loopOn = true })
}
/** Halve (0.5) or double (2) the loop. */
export function scaleLoopBy (mix, id, factor, dur = 0) {
  return stripEdit(mix, id, (s) => { if (!D.validLoop(s.loopIn, s.loopOut)) return false; const r = D.scaleLoop(s.loopIn, s.loopOut, factor, dur); s.loopIn = r.loopIn; s.loopOut = r.loopOut })
}
/** Move the loop by `beats` beats (negative = back). */
export function shiftLoopBy (mix, id, beats, dur = 0) {
  return stripEdit(mix, id, (s) => { if (!D.validLoop(s.loopIn, s.loopOut)) return false; const r = D.shiftLoop(s.bpm, s.loopIn, s.loopOut, beats, dur); s.loopIn = r.loopIn; s.loopOut = r.loopOut })
}
/** Where the clip's first beat is (clip seconds). */
export function setGrid (mix, id, beat1) { return stripEdit(mix, id, (s) => { const v = num(beat1, null, 0, D.CLIP_SECONDS_MAX); if (v === null) return false; s.beat1 = v }) }
/** Pitch trim -1..1 = -8 %..+8 % on top of the tempo sync. */
export function setPitch (mix, id, v) { return stripEdit(mix, id, (s) => { s.pitch = v }) }
export function setKeyLock (mix, id, on) { return stripEdit(mix, id, (s) => { s.keyLock = !!on }) }
/** Set the clip's bpm from tap times (seconds). Fewer than 3 usable taps changes nothing. */
export function tapBpm (mix, id, times) {
  const bpm = D.tapTempo(times, L.bpmMin, L.bpmMax)
  return stripEdit(mix, id, (s) => { if (bpm === null) return false; s.bpm = bpm })
}
/** Make the mix tempo the tempo this strip is heard at (clip bpm x its rate), the DJ "master tempo" move; other strips with sync on follow it. */
export function tempoFromStrip (mix, id) {
  return edit(mix, (m) => { const s = m.strips.find(x => x.id === id); if (!s || !(s.bpm > 0)) return false; const bpm = D.effectiveBpm(s.bpm, D.deckRate(1, s.pitch)); m.bpm = bpm })
}

export default {
  MIX_VERSION, KIND_MIX, MIX_LIMITS, defaultMix, defaultStrip, sanitizeMix, stripById, laneOf, mixDuration, laneValueAt, applyAutomation,
  crossGains, channelCrossGain, stripAudible, stripGain, levelsOf, syncRate, deckRateOf, stripTempo, nextBeat,
  setCue, setHotCue, setLoop, toggleLoop, loopBeats, scaleLoopBy, shiftLoopBy, setGrid, setPitch, setKeyLock, tapBpm, tempoFromStrip, addStrip, removeStrip, updateStrip, moveStrip, setParam, setMaster, setCross,
  toggleSolo, addAutoPoint, removeAutoPoint, clearAuto, recordMove, crossfadeTransition, fadeStrip, filterSweep,
}
