/**
 * utils/OmniSongModel.js — the MODEL of a SongNode: the arrangement (lanes, clips, tempo map, sections, automation, master, loop) (V198). PURE: no DOM, no THREE,
 * no storage, no audio. The contract is docs/architecture/OMNISONG_CONTRACT.md, the maths and limits are in docs/architecture/OMNISONGPLAYER_DESIGN.md.
 *
 * It lives in `node.data.song` (saved WITH the node). Every field is repaired by sanitizeSong, which NEVER throws, drops unknown keys (also __proto__ /
 * constructor), clamps numbers, enforces the caps of SONG_LIMITS, makes ids unique, drops clips that reference a missing lane (or whose reference type does not
 * match the lane kind), sorts the tempo map and is IDEMPOTENT (sanitize(sanitize(x)) deep-equals sanitize(x)).
 *
 * Units: bars are 1-BASED floats (bar 1 = the start of the song, 2.5 = the middle of the second bar), rounded to 1/1000. The tempo is in quarter-note beats per
 * minute; a bar has `timeSig[0] * 4 / timeSig[1]` beats. The tempo map is PIECEWISE CONSTANT: `bpm` is the tempo from bar 1, each tempoMap point {bar,bpm}
 * (bar > 1) changes it from that bar on (a point on bar 1 is folded into `bpm`). barToSeconds / secondsToBar are exact inverses.
 *
 * Edit ops are IMMUTABLE and never throw: `(song, ...args) -> a new sanitized song` (an op that cannot apply returns the sanitized input unchanged). To learn the id
 * of a thing an op added, pass your own `id` in the spec (newId('clip')) or call addedId(before, after, 'clips').
 * USER-facing module: it imports nothing.
 */

export const SONG_VERSION = 1
export const KIND_SONG = 'songNode'
export const SONG_LIMITS = Object.freeze({
  bpmMin: 60, bpmMax: 240, bpmDefault: 120, lengthMin: 4, lengthMax: 256, lengthDefault: 32,
  lanesMax: 32, clipsMax: 512, tempoPointsMax: 64, sectionsMax: 64, automationMax: 64, pointsMax: 256, markersMax: 128,
  volumeMax: 1.5, gainMax: 2, masterGainMax: 1.5, repeatMax: 64, offsetMax: 4096, transposeMax: 24, fadeMax: 30,
  minClipBars: 0.125, minLoopBars: 0.25, maxBar: 257, nameMax: 32, titleMax: 64, textMax: 200, tagsMax: 16, tagMax: 24, idMax: 32,
  limiterDbMin: -24, limiterDbMax: 0, delayTimeMin: 0.02, delayTimeMax: 2, delayFeedbackMax: 0.9,
})
export const LANE_KINDS = Object.freeze(['pattern', 'audio'])
export const AUTOMATION_PARAMS = Object.freeze(['volume', 'pan', 'filter', 'sendReverb', 'sendDelay'])
/** Params an automation lane of the MASTER may carry. */
export const MASTER_PARAMS = Object.freeze(['volume', 'pan', 'filter'])
export const CURVES = Object.freeze(['linear', 'step'])
export const LANE_COLORS = Object.freeze(['#ff8a5c', '#5ccfff', '#b48cff', '#6be8a0', '#ffd45c', '#ff6b9a', '#8fb3ff', '#c3e86b'])
export const SECTION_COLORS = Object.freeze(['#5c7cff', '#ffb35c', '#ff5c8a', '#5cffc1', '#c25cff', '#e8ff5c'])
const PARAM_RANGE = Object.freeze({ volume: [0, 1.5, 1], pan: [-1, 1, 0], filter: [0, 1, 1], sendReverb: [0, 1, 0], sendDelay: [0, 1, 0] })
const TIMESIG_DENS = Object.freeze([1, 2, 4, 8, 16, 32])
const L = SONG_LIMITS

const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k)
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v)
const get = (o, k) => { try { return isObj(o) && has(o, k) ? o[k] : undefined } catch (_) { return undefined } }
const r3 = (v) => { const x = Math.round(v * 1000) / 1000; return x === 0 ? 0 : x }
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v)
const toNum = (v, d) => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : d
  if (typeof v === 'string' && v.trim() !== '') { const n = Number(v); return Number.isFinite(n) ? n : d }
  return d
}
const numIn = (v, d, a, b) => clamp(toNum(v, d), a, b)
const intIn = (v, d, a, b) => Math.round(numIn(v, d, a, b))
const boolOf = (v, d) => (typeof v === 'boolean' ? v : (v === 1 || v === 'true') ? true : (v === 0 || v === 'false') ? false : d)
const cleanText = (v, max, d = '') => {
  const s = (typeof v === 'string' || typeof v === 'number') ? String(v).replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max) : ''
  return s || d
}
const ID_RE = /^[A-Za-z0-9_-]{1,32}$/
const REF_RE = /^[A-Za-z0-9_-]{1,64}$/
const validId = (v) => (typeof v === 'string' && ID_RE.test(v) && !v.startsWith('__') ? v : null)
const hexColor = (v, d) => (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v.toLowerCase() : d)
/** The items of a raw array (at most `cap * 2` are looked at, so a hostile 1e7-long array is cheap). */
const items = (a, cap) => { if (!Array.isArray(a)) return []; const out = []; const n = Math.min(a.length, cap * 2); for (let i = 0; i < n; i++) { let x; try { x = a[i] } catch (_) { x = undefined } if (x !== undefined) out.push(x) } return out }
const bar3 = (v, d, lo = 1, hi = L.maxBar) => r3(numIn(v, d, lo, hi))

/** A fresh unique-ish id: prefix + 6 random base-36 chars (max 32 chars). */
export function newId (prefix = 'id') {
  const p = typeof prefix === 'string' && /^[A-Za-z0-9_-]{1,20}$/.test(prefix) ? prefix : 'id'
  return p + '_' + Math.random().toString(36).slice(2, 8).padEnd(6, '0')
}
const freshId = (prefix, taken) => { for (let i = 0; i < 64; i++) { const id = newId(prefix); if (!taken.has(id)) return id } let n = taken.size + 1; while (taken.has(prefix + n)) n++; return prefix + n }

// ── Time: tempo map ─────────────────────────────────────────────────────────────

/** Beats per bar of a song (timeSig[0] * 4 / timeSig[1]); defensive, works on unsanitized songs too. */
export function beatsPerBar (song) {
  const ts = get(get(song, 'meta'), 'timeSig')
  const num = Array.isArray(ts) ? intIn(ts[0], 4, 1, 32) : 4
  const den = Array.isArray(ts) && TIMESIG_DENS.includes(Math.round(toNum(ts[1], 4))) ? Math.round(toNum(ts[1], 4)) : 4
  return num * 4 / den
}

/**
 * The tempo segments of a song: { starts[] (bar), bpms[], cum[] (seconds at the start of each segment), spb[] (seconds per bar of each), bpb }.
 * Cache it when you convert many times (the player does). Works on unsanitized input (bad points are ignored, the map is sorted).
 */
export function tempoSegments (song) {
  const bpb = beatsPerBar(song)
  const base = numIn(get(song, 'bpm'), L.bpmDefault, L.bpmMin, L.bpmMax)
  const pts = []
  const tm = get(song, 'tempoMap')
  for (const p of items(tm, L.tempoPointsMax)) {
    const b = toNum(get(p, 'bar'), NaN); const v = toNum(get(p, 'bpm'), NaN)
    if (Number.isFinite(b) && Number.isFinite(v) && b >= 1) pts.push([b, clamp(v, L.bpmMin, L.bpmMax)])
  }
  pts.sort((a, b) => a[0] - b[0])
  const starts = [1]; const bpms = [base]
  for (const [b, v] of pts) {
    if (b <= 1 + 1e-9) { bpms[0] = v; continue }
    if (b <= starts[starts.length - 1] + 1e-9) { bpms[bpms.length - 1] = v; continue }
    starts.push(b); bpms.push(v)
  }
  const cum = [0]; const spb = []
  for (let i = 0; i < starts.length; i++) {
    spb.push(bpb * 60 / bpms[i])
    if (i + 1 < starts.length) cum.push(cum[i] + (starts[i + 1] - starts[i]) * spb[i])
  }
  return { starts, bpms, cum, spb, bpb }
}
const segIndexBar = (sg, bar) => { let i = 0; for (let k = 1; k < sg.starts.length; k++) { if (bar >= sg.starts[k]) i = k; else break } return i }
const segIndexSec = (sg, sec) => { let i = 0; for (let k = 1; k < sg.cum.length; k++) { if (sec >= sg.cum[k]) i = k; else break } return i }
/** bar -> seconds from bar 1 using precomputed segments (a bar below 1 extrapolates with the first tempo). */
export function barToSecondsSeg (sg, bar) { const b = toNum(bar, 1); const i = segIndexBar(sg, b); return sg.cum[i] + (b - sg.starts[i]) * sg.spb[i] }
/** seconds -> bar (exact inverse of barToSecondsSeg). */
export function secondsToBarSeg (sg, sec) { const s = toNum(sec, 0); const i = segIndexSec(sg, s); return sg.starts[i] + (s - sg.cum[i]) / sg.spb[i] }
export const bpmAtSeg = (sg, bar) => sg.bpms[segIndexBar(sg, toNum(bar, 1))]

/** Seconds from the start of the song (bar 1) to `bar`. */
export const barToSeconds = (song, bar) => barToSecondsSeg(tempoSegments(song), bar)
/** The bar (1-based float) at `sec` seconds from the start of the song. Exact inverse of barToSeconds. */
export const secondsToBar = (song, sec) => secondsToBarSeg(tempoSegments(song), sec)
/** The tempo (bpm) in force at `bar` (a point's bar already has the new tempo). */
export const bpmAt = (song, bar) => bpmAtSeg(tempoSegments(song), bar)
/** First bar AFTER the clip (startBar + lengthBars). */
export const clipEndBar = (clip) => toNum(get(clip, 'startBar'), 1) + toNum(get(clip, 'lengthBars'), 0)
const lengthBarsOf = (song) => intIn(get(song, 'lengthBars'), L.lengthDefault, L.lengthMin, L.lengthMax)
/** Duration of the whole song in seconds (lengthBars bars through the tempo map). */
export const songLengthSeconds = (song) => barToSeconds(song, 1 + lengthBarsOf(song))

// ── Sanitizing ──────────────────────────────────────────────────────────────────

export function defaultLane (over = {}) {
  return { id: 'ln1', name: 'Lane', kind: 'pattern', volume: 1, pan: 0, mute: false, solo: false, color: LANE_COLORS[0], sends: { reverb: 0, delay: 0 }, ...over }
}

function sanitizeMeta (raw) {
  const r = isObj(raw) ? raw : {}
  const ts = get(r, 'timeSig')
  let num = 4; let den = 4
  if (Array.isArray(ts)) { num = intIn(ts[0], 4, 1, 32); const d = Math.round(toNum(ts[1], 4)); den = TIMESIG_DENS.includes(d) ? d : 4 }
  const tags = []
  for (const t of items(get(r, 'tags'), L.tagsMax)) { const s = cleanText(t, L.tagMax); if (s && !tags.includes(s) && tags.length < L.tagsMax) tags.push(s) }
  return { title: cleanText(get(r, 'title'), L.titleMax, 'Untitled song'), artist: cleanText(get(r, 'artist'), L.titleMax), credits: cleanText(get(r, 'credits'), L.textMax), key: cleanText(get(r, 'key'), 8), timeSig: [num, den], tags }
}

function sanitizeLanes (src) {
  const declared = new Set()
  for (const x of src) { const id = validId(get(x, 'id')); if (id) declared.add(id) }
  const seen = new Set(); const out = []
  for (const x of src) {
    if (out.length >= L.lanesMax) break
    if (!isObj(x)) continue
    const r = x
    let id = validId(get(r, 'id'))
    if (!id || id === 'master' || seen.has(id)) { const taken = new Set([...seen, ...declared, 'master']); id = freshId('ln', taken) }
    seen.add(id)
    const kind = get(r, 'kind'); const i = out.length
    const s = get(r, 'sends')
    out.push({
      id, name: cleanText(get(r, 'name'), L.nameMax, 'Lane ' + (i + 1)), kind: LANE_KINDS.includes(kind) ? kind : 'pattern',
      volume: r3(numIn(get(r, 'volume'), 1, 0, L.volumeMax)), pan: r3(numIn(get(r, 'pan'), 0, -1, 1)),
      mute: boolOf(get(r, 'mute'), false), solo: boolOf(get(r, 'solo'), false), color: hexColor(get(r, 'color'), LANE_COLORS[i % LANE_COLORS.length]),
      sends: { reverb: r3(numIn(get(s, 'reverb'), 0, 0, 1)), delay: r3(numIn(get(s, 'delay'), 0, 0, 1)) },
    })
  }
  return out
}

function sanitizeClips (src, laneKind) {
  const declared = new Set()
  for (const x of src) { const id = validId(get(x, 'id')); if (id) declared.add(id) }
  const seen = new Set(); const out = []
  for (const x of src) {
    if (out.length >= L.clipsMax) break
    if (!isObj(x)) continue
    const lane = get(x, 'lane'); const kind = typeof lane === 'string' ? laneKind.get(lane) : undefined
    if (!kind) continue
    const ref = get(x, 'ref'); const rtype = get(ref, 'type'); const rid = get(ref, 'id')
    const want = kind === 'audio' ? 'audio' : 'music'
    if (rtype !== want || typeof rid !== 'string' || !REF_RE.test(rid) || rid.startsWith('__')) continue
    const len = toNum(get(x, 'lengthBars'), NaN)
    if (!(len > 0)) continue
    let id = validId(get(x, 'id'))
    if (!id || seen.has(id)) id = freshId('clip', new Set([...seen, ...declared]))
    seen.add(id)
    const c = {
      id, lane, startBar: bar3(get(x, 'startBar'), 1, 1, L.lengthMax), lengthBars: r3(clamp(len, L.minClipBars, L.lengthMax)), ref: { type: rtype, id: rid },
      repeat: intIn(get(x, 'repeat'), 1, 1, L.repeatMax), offset: r3(numIn(get(x, 'offset'), 0, 0, L.offsetMax)), gain: r3(numIn(get(x, 'gain'), 1, 0, L.gainMax)),
      fadeIn: r3(numIn(get(x, 'fadeIn'), 0, 0, L.fadeMax)), fadeOut: r3(numIn(get(x, 'fadeOut'), 0, 0, L.fadeMax)), transpose: intIn(get(x, 'transpose'), 0, -L.transposeMax, L.transposeMax),
    }
    const nm = cleanText(get(x, 'name'), L.nameMax); if (nm) c.name = nm
    out.push(c)
  }
  return out
}

function sanitizeSections (src) {
  const declared = new Set()
  for (const x of src) { const id = validId(get(x, 'id')); if (id) declared.add(id) }
  const seen = new Set(); const out = []
  for (const x of src) {
    if (out.length >= L.sectionsMax) break
    if (!isObj(x)) continue
    let id = validId(get(x, 'id'))
    if (!id || seen.has(id)) id = freshId('sec', new Set([...seen, ...declared]))
    seen.add(id)
    out.push({ id, name: cleanText(get(x, 'name'), L.nameMax, 'Section'), startBar: bar3(get(x, 'startBar'), 1, 1, L.lengthMax), lengthBars: r3(numIn(get(x, 'lengthBars'), 4, L.minClipBars, L.lengthMax)), color: hexColor(get(x, 'color'), SECTION_COLORS[out.length % SECTION_COLORS.length]) })
  }
  return out.sort((a, b) => a.startBar - b.startBar)
}

function sanitizeAutomation (src, laneIds) {
  const declared = new Set()
  for (const x of src) { const id = validId(get(x, 'id')); if (id) declared.add(id) }
  const seen = new Set(); const keys = new Set(); const out = []
  for (const x of src) {
    if (out.length >= L.automationMax) break
    if (!isObj(x)) continue
    const target = get(x, 'lane'); const param = get(x, 'param')
    if (typeof target !== 'string' || !(target === 'master' ? MASTER_PARAMS.includes(param) : laneIds.has(target) && AUTOMATION_PARAMS.includes(param))) continue
    const key = target + '\u0001' + param
    if (keys.has(key)) continue
    keys.add(key)
    const [lo, hi, dv] = PARAM_RANGE[param]
    const byBar = new Map()
    for (const p of items(get(x, 'points'), L.pointsMax)) {
      const b = toNum(get(p, 'bar'), NaN); if (!Number.isFinite(b) || b < 1 || b > L.maxBar) continue
      const bar = r3(b); const c = get(p, 'curve')
      byBar.set(bar, { bar, value: r3(numIn(get(p, 'value'), dv, lo, hi)), curve: CURVES.includes(c) ? c : 'linear' })
    }
    const points = [...byBar.values()].sort((a, b) => a.bar - b.bar).slice(0, L.pointsMax)
    if (!points.length) continue
    let id = validId(get(x, 'id'))
    if (!id || seen.has(id)) id = freshId('au', new Set([...seen, ...declared]))
    seen.add(id)
    out.push({ id, lane: target, param, points })
  }
  return out
}

export function defaultSong () {
  return sanitizeSong({
    lanes: [{ id: 'lane1', name: 'Pattern 1', kind: 'pattern' }, { id: 'lane2', name: 'Audio 1', kind: 'audio' }],
  })
}

/** A complete valid `song` from anything. Never throws. */
export function sanitizeSong (raw) {
  try {
    if (!isObj(raw)) return defaultSong()
    const lengthBars = intIn(get(raw, 'lengthBars'), L.lengthDefault, L.lengthMin, L.lengthMax)
    const laneSrc = get(raw, 'lanes')
    const lanes = laneSrc === undefined
      ? sanitizeLanes([{ id: 'lane1', name: 'Pattern 1', kind: 'pattern' }, { id: 'lane2', name: 'Audio 1', kind: 'audio' }])
      : sanitizeLanes(items(laneSrc, L.lanesMax))
    const laneKind = new Map(lanes.map(l => [l.id, l.kind]))
    const laneIds = new Set(laneKind.keys())
    // tempo: a point on bar 1 is folded into the base tempo; the rest is sorted, one per bar
    let bpm = r3(numIn(get(raw, 'bpm'), L.bpmDefault, L.bpmMin, L.bpmMax))
    const byBar = new Map()
    for (const p of items(get(raw, 'tempoMap'), L.tempoPointsMax)) {
      const b = toNum(get(p, 'bar'), NaN); const v = toNum(get(p, 'bpm'), NaN)
      if (!Number.isFinite(b) || !Number.isFinite(v) || b < 1 || b > L.maxBar) continue
      const bar = r3(b); const t = r3(clamp(v, L.bpmMin, L.bpmMax))
      if (bar <= 1) bpm = t; else byBar.set(bar, { bar, bpm: t })
    }
    const tempoMap = [...byBar.values()].sort((a, b) => a.bar - b.bar).slice(0, L.tempoPointsMax)
    const m = get(raw, 'master')
    const rv = get(m, 'reverb'); const dl = get(m, 'delay')
    const lim = get(raw, 'loop')
    let ls = r3(numIn(get(lim, 'startBar'), 1, 1, L.lengthMax)); let le = r3(numIn(get(lim, 'endBar'), Math.min(5, lengthBars + 1), 1, L.maxBar))
    if (le < ls + L.minLoopBars) le = r3(Math.min(L.maxBar, ls + Math.max(1, L.minLoopBars)))
    if (le < ls + L.minLoopBars) { ls = r3(le - L.minLoopBars) }
    const mseen = new Set(); const mdecl = new Set()
    const mrawl = items(get(raw, 'markers'), L.markersMax)
    for (const x of mrawl) { const id = validId(get(x, 'id')); if (id) mdecl.add(id) }
    const markers = []
    for (const x of mrawl) {
      if (markers.length >= L.markersMax) break
      if (!isObj(x)) continue
      let id = validId(get(x, 'id')); if (!id || mseen.has(id)) id = freshId('mk', new Set([...mseen, ...mdecl]))
      mseen.add(id)
      markers.push({ id, bar: bar3(get(x, 'bar'), 1, 1, L.maxBar), name: cleanText(get(x, 'name'), L.nameMax, 'Marker') })
    }
    markers.sort((a, b) => a.bar - b.bar)
    return {
      v: SONG_VERSION,
      meta: sanitizeMeta(get(raw, 'meta')),
      bpm, tempoMap, lengthBars, lanes,
      clips: sanitizeClips(items(get(raw, 'clips'), L.clipsMax), laneKind),
      sections: sanitizeSections(items(get(raw, 'sections'), L.sectionsMax)),
      automation: sanitizeAutomation(items(get(raw, 'automation'), L.automationMax), laneIds),
      master: {
        gain: r3(numIn(get(m, 'gain'), 1, 0, L.masterGainMax)), limiter: boolOf(get(m, 'limiter'), true), limiterThresholdDb: r3(numIn(get(m, 'limiterThresholdDb'), -3, L.limiterDbMin, L.limiterDbMax)),
        reverb: { size: r3(numIn(get(rv, 'size'), 0.5, 0, 1)), mix: r3(numIn(get(rv, 'mix'), 0.3, 0, 1)) },
        delay: { time: r3(numIn(get(dl, 'time'), 0.375, L.delayTimeMin, L.delayTimeMax)), feedback: r3(numIn(get(dl, 'feedback'), 0.35, 0, L.delayFeedbackMax)), mix: r3(numIn(get(dl, 'mix'), 0.3, 0, 1)) },
      },
      loop: { on: boolOf(get(lim, 'on'), false), startBar: ls, endBar: le },
      markers,
    }
  } catch (_) {
    return defaultSong()
  }
}

// ── Reading helpers ─────────────────────────────────────────────────────────────

export const findLane = (song, id) => (Array.isArray(song?.lanes) ? song.lanes.find(l => l.id === id) ?? null : null)
export const findClip = (song, id) => (Array.isArray(song?.clips) ? song.clips.find(c => c.id === id) ?? null : null)
/** Solo wins over mute: when any lane is solo, only the solo lanes sound. */
export function laneAudible (song, lane) {
  if (!lane || lane.mute) return false
  const anySolo = Array.isArray(song?.lanes) && song.lanes.some(l => l.solo)
  return anySolo ? !!lane.solo : true
}
/** Clips whose [startBar, endBar) contains `bar` (a new array, in clip order). */
export function activeClipsAt (song, bar) {
  const b = toNum(bar, NaN)
  if (!Number.isFinite(b) || !Array.isArray(song?.clips)) return []
  return song.clips.filter(c => b >= c.startBar && b < clipEndBar(c))
}
/** The id of the item an add op appended (the id present in `after[key]` and not in `before[key]`), or null. */
export function addedId (before, after, key) {
  const had = new Set((Array.isArray(before?.[key]) ? before[key] : []).map(x => x.id))
  const a = Array.isArray(after?.[key]) ? after[key] : []
  for (let i = a.length - 1; i >= 0; i--) if (!had.has(a[i].id)) return a[i].id
  return null
}

/**
 * The automated value of `param` of `target` (a lane id or 'master') at `bar`, or null when there is no automation for it. Before the first point the first value
 * holds, after the last the last value; between two points 'linear' interpolates and 'step' keeps the left value. While automation exists it REPLACES the fader.
 */
export function automationValueAt (song, target, param, bar) {
  const au = Array.isArray(song?.automation) ? song.automation.find(a => a.lane === target && a.param === param) : null
  const pts = au?.points
  if (!pts || !pts.length) return null
  const b = toNum(bar, 1)
  if (b <= pts[0].bar) return pts[0].value
  const last = pts[pts.length - 1]
  if (b >= last.bar) return last.value
  let lo = 0; let hi = pts.length - 1
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (pts[mid].bar <= b) lo = mid; else hi = mid }
  const p = pts[lo]; const q = pts[hi]
  if (p.curve === 'step') return p.value
  return p.value + (q.value - p.value) * ((b - p.bar) / (q.bar - p.bar))
}

/** Snap a bar to the grid (in bars, 0.25 = a quarter bar; grid 0 / bad = no snap). Never below bar 1. */
export function snapBar (bar, grid = 0.25) {
  const b = toNum(bar, 1); const g = toNum(grid, 0)
  if (!(g > 0)) return r3(Math.max(1, b))
  return r3(Math.max(1, Math.round((b - 1) / g) * g + 1))
}

// ── Edit ops (immutable) ────────────────────────────────────────────────────────

const clone = (s) => JSON.parse(JSON.stringify(s))
/** Run `fn(draft)` on a deep copy of the sanitized song; fn returns false (or throws) = no change. Always a sanitized song. */
function edit (song, fn) {
  const base = sanitizeSong(song)
  try {
    const d = clone(base)
    const r = fn(d)
    return r === false ? base : sanitizeSong(d)
  } catch (_) { return base }
}
const pick = (patch, keys) => { const out = {}; if (!isObj(patch)) return out; for (const k of keys) { const v = get(patch, k); if (v !== undefined) out[k] = v } return out }
const refTypeFor = (kind) => (kind === 'audio' ? 'audio' : 'music')

export function addLane (song, spec = {}) {
  return edit(song, (s) => {
    if (s.lanes.length >= L.lanesMax) return false
    const kind = LANE_KINDS.includes(get(spec, 'kind')) ? get(spec, 'kind') : 'pattern'
    const taken = new Set([...s.lanes.map(l => l.id), 'master'])
    let id = validId(get(spec, 'id')); if (!id || taken.has(id)) id = freshId('lane', taken)
    const n = s.lanes.filter(l => l.kind === kind).length + 1
    s.lanes.push({ id, name: cleanText(get(spec, 'name'), L.nameMax, (kind === 'audio' ? 'Audio ' : 'Pattern ') + n), kind, volume: get(spec, 'volume'), pan: get(spec, 'pan'), color: get(spec, 'color'), sends: get(spec, 'sends') })
  })
}
export function removeLane (song, laneId) {
  return edit(song, (s) => {
    if (!s.lanes.some(l => l.id === laneId)) return false
    s.lanes = s.lanes.filter(l => l.id !== laneId)
    s.clips = s.clips.filter(c => c.lane !== laneId)
    s.automation = s.automation.filter(a => a.lane !== laneId)
  })
}
export function updateLane (song, laneId, patch) {
  return edit(song, (s) => {
    const l = s.lanes.find(x => x.id === laneId); if (!l) return false
    const p = pick(patch, ['name', 'volume', 'pan', 'mute', 'solo', 'color'])
    Object.assign(l, p)
    const sp = get(patch, 'sends')
    if (isObj(sp)) l.sends = { ...l.sends, ...pick(sp, ['reverb', 'delay']) }
  })
}

export function addClip (song, spec = {}) {
  return edit(song, (s) => {
    if (s.clips.length >= L.clipsMax) return false
    const lane = s.lanes.find(l => l.id === get(spec, 'lane')); if (!lane) return false
    const ref = get(spec, 'ref'); if (get(ref, 'type') !== refTypeFor(lane.kind)) return false
    const taken = new Set(s.clips.map(c => c.id))
    let id = validId(get(spec, 'id')); if (!id || taken.has(id)) id = freshId('clip', taken)
    const c = { id, lane: lane.id, startBar: get(spec, 'startBar') ?? 1, lengthBars: get(spec, 'lengthBars') ?? 1, ref }
    for (const k of ['repeat', 'offset', 'gain', 'fadeIn', 'fadeOut', 'transpose', 'name']) { const v = get(spec, k); if (v !== undefined) c[k] = v }
    s.clips.push(c)
  })
}
export function moveClip (song, clipId, to = {}) {
  return edit(song, (s) => {
    const c = s.clips.find(x => x.id === clipId); if (!c) return false
    const sb = get(to, 'startBar'); const ln = get(to, 'lane')
    if (ln !== undefined && ln !== c.lane) {
      const lane = s.lanes.find(l => l.id === ln); const cur = s.lanes.find(l => l.id === c.lane)
      if (!lane || !cur || lane.kind !== cur.kind) return false   // an incompatible lane: the whole move is refused
      c.lane = lane.id
    }
    if (sb !== undefined) c.startBar = Math.max(1, toNum(sb, c.startBar))
  })
}
/** Resize a clip to `lengthBars`. fromStart: the END stays, the start moves (and `offset` follows so the content stays in place, never below 0). */
export function resizeClip (song, clipId, lengthBars, opts = {}) {
  return edit(song, (s) => {
    const c = s.clips.find(x => x.id === clipId); if (!c) return false
    let len = clamp(toNum(lengthBars, c.lengthBars), L.minClipBars, L.lengthMax)
    if (get(opts, 'fromStart') === true) {
      const end = c.startBar + c.lengthBars
      len = Math.min(len, end - 1, c.lengthBars + c.offset)   // not before bar 1, not before the start of the source
      if (len < L.minClipBars) return false
      c.offset = Math.max(0, c.offset + (c.lengthBars - len))
      c.startBar = end - len
      c.lengthBars = len
    } else c.lengthBars = len
  })
}
/** Split a clip at `atBar` into two (the second keeps the content in place: offset + the first's length). Refused outside the clip (or leaving a piece under the minimum). */
export function splitClip (song, clipId, atBar, opts = {}) {
  return edit(song, (s) => {
    const i = s.clips.findIndex(x => x.id === clipId); if (i < 0 || s.clips.length >= L.clipsMax) return false
    const c = s.clips[i]; const at = r3(toNum(atBar, NaN)); const end = c.startBar + c.lengthBars
    if (!(at - c.startBar >= L.minClipBars && end - at >= L.minClipBars)) return false
    const taken = new Set(s.clips.map(x => x.id))
    let id = validId(get(opts, 'id')); if (!id || taken.has(id)) id = freshId('clip', taken)
    const second = { ...clone(c), id, startBar: at, lengthBars: r3(end - at), offset: r3(c.offset + (at - c.startBar)), fadeIn: 0 }
    c.lengthBars = r3(at - c.startBar); c.fadeOut = 0
    s.clips.splice(i + 1, 0, second)
  })
}
export function duplicateClip (song, clipId, opts = {}) {
  return edit(song, (s) => {
    const c = s.clips.find(x => x.id === clipId); if (!c || s.clips.length >= L.clipsMax) return false
    const taken = new Set(s.clips.map(x => x.id))
    let id = validId(get(opts, 'id')); if (!id || taken.has(id)) id = freshId('clip', taken)
    const d = { ...clone(c), id }
    const sb = get(opts, 'startBar'); d.startBar = sb !== undefined ? Math.max(1, toNum(sb, c.startBar + c.lengthBars)) : c.startBar + c.lengthBars
    const ln = get(opts, 'lane')
    if (ln !== undefined) { const lane = s.lanes.find(l => l.id === ln); const cur = s.lanes.find(l => l.id === c.lane); if (!lane || !cur || lane.kind !== cur.kind) return false; d.lane = lane.id }
    s.clips.push(d)
  })
}
export function removeClip (song, clipId) {
  return edit(song, (s) => { if (!s.clips.some(c => c.id === clipId)) return false; s.clips = s.clips.filter(c => c.id !== clipId) })
}
export function updateClip (song, clipId, patch) {
  return edit(song, (s) => {
    const c = s.clips.find(x => x.id === clipId); if (!c) return false
    const p = pick(patch, ['startBar', 'lengthBars', 'repeat', 'offset', 'gain', 'fadeIn', 'fadeOut', 'transpose', 'name'])
    Object.assign(c, p)
    const ln = get(patch, 'lane')
    if (ln !== undefined && ln !== c.lane) { const lane = s.lanes.find(l => l.id === ln); const cur = s.lanes.find(l => l.id === c.lane); if (!lane || !cur || lane.kind !== cur.kind) return false; c.lane = lane.id }
    const ref = get(patch, 'ref')
    if (ref !== undefined) { const lk = s.lanes.find(l => l.id === c.lane)?.kind; if (get(ref, 'type') !== refTypeFor(lk)) return false; c.ref = ref }   // a ref of the wrong type is refused (it would drop the clip)
  })
}

export function setTempoPoint (song, bar, bpm) {
  return edit(song, (s) => {
    const b = r3(toNum(bar, NaN)); const v = toNum(bpm, NaN)
    if (!Number.isFinite(b) || !Number.isFinite(v) || b < 1 || b > L.maxBar) return false
    if (b <= 1) { s.bpm = v; return }
    const i = s.tempoMap.findIndex(p => p.bar === b)
    if (i >= 0) s.tempoMap[i].bpm = v
    else { if (s.tempoMap.length >= L.tempoPointsMax) return false; s.tempoMap.push({ bar: b, bpm: v }) }
  })
}
export function removeTempoPoint (song, bar) {
  return edit(song, (s) => { const b = r3(toNum(bar, NaN)); const n = s.tempoMap.length; s.tempoMap = s.tempoMap.filter(p => p.bar !== b); if (s.tempoMap.length === n) return false })
}

export function addSection (song, spec = {}) {
  return edit(song, (s) => {
    if (s.sections.length >= L.sectionsMax) return false
    const taken = new Set(s.sections.map(x => x.id))
    let id = validId(get(spec, 'id')); if (!id || taken.has(id)) id = freshId('sec', taken)
    s.sections.push({ id, ...pick(spec, ['name', 'startBar', 'lengthBars', 'color']) })
  })
}
export function updateSection (song, id, patch) {
  return edit(song, (s) => { const x = s.sections.find(q => q.id === id); if (!x) return false; Object.assign(x, pick(patch, ['name', 'startBar', 'lengthBars', 'color'])) })
}
export function removeSection (song, id) {
  return edit(song, (s) => { if (!s.sections.some(x => x.id === id)) return false; s.sections = s.sections.filter(x => x.id !== id) })
}

export function setAutomationPoint (song, target, param, bar, value, curve = 'linear') {
  return edit(song, (s) => {
    const b = r3(toNum(bar, NaN)); if (!Number.isFinite(b) || b < 1 || b > L.maxBar) return false
    if (!(target === 'master' ? MASTER_PARAMS.includes(param) : s.lanes.some(l => l.id === target) && AUTOMATION_PARAMS.includes(param))) return false
    const v = toNum(value, NaN); if (!Number.isFinite(v)) return false
    let au = s.automation.find(a => a.lane === target && a.param === param)
    if (!au) {
      if (s.automation.length >= L.automationMax) return false
      au = { id: freshId('au', new Set(s.automation.map(a => a.id))), lane: target, param, points: [] }
      s.automation.push(au)
    }
    const i = au.points.findIndex(p => p.bar === b)
    if (i >= 0) au.points[i] = { bar: b, value: v, curve }
    else { if (au.points.length >= L.pointsMax) return false; au.points.push({ bar: b, value: v, curve }); au.points.sort((p, q) => p.bar - q.bar) }
  })
}
export function removeAutomationPoint (song, target, param, bar) {
  return edit(song, (s) => {
    const au = s.automation.find(a => a.lane === target && a.param === param); if (!au) return false
    const b = r3(toNum(bar, NaN)); const n = au.points.length
    au.points = au.points.filter(p => p.bar !== b)
    if (au.points.length === n) return false
    if (!au.points.length) s.automation = s.automation.filter(a => a !== au)
  })
}

export function addMarker (song, spec = {}) {
  return edit(song, (s) => {
    if (s.markers.length >= L.markersMax) return false
    const taken = new Set(s.markers.map(x => x.id))
    let id = validId(get(spec, 'id')); if (!id || taken.has(id)) id = freshId('mk', taken)
    s.markers.push({ id, ...pick(spec, ['bar', 'name']) })
  })
}
export function removeMarker (song, id) {
  return edit(song, (s) => { if (!s.markers.some(x => x.id === id)) return false; s.markers = s.markers.filter(x => x.id !== id) })
}
export function setLoop (song, patch = {}) {
  return edit(song, (s) => { Object.assign(s.loop, pick(patch, ['on', 'startBar', 'endBar'])) })
}
export function setMeta (song, patch = {}) {
  return edit(song, (s) => { Object.assign(s.meta, pick(patch, ['title', 'artist', 'credits', 'key', 'timeSig', 'tags'])) })
}
export function setMaster (song, patch = {}) {
  return edit(song, (s) => {
    const p = pick(patch, ['gain', 'limiter', 'limiterThresholdDb']); Object.assign(s.master, p)
    for (const k of ['reverb', 'delay']) { const q = get(patch, k); if (isObj(q)) s.master[k] = { ...s.master[k], ...q } }
  })
}
export function setLength (song, lengthBars) {
  return edit(song, (s) => { s.lengthBars = toNum(lengthBars, s.lengthBars) })
}

// ── Presets ─────────────────────────────────────────────────────────────────────

/**
 * A small example arrangement: one pattern lane per ref (a ref is a MusicNode id string or { id, name, bars }), Intro / Verse / Chorus / Outro sections of four bars
 * over 16 bars, lane 1 plays throughout, each further lane comes in one section later. With no refs the lanes are empty (name them 'Pattern n').
 */
export function demoSong (refs = []) {
  const list = items(refs, 8).map(r => (typeof r === 'string' ? { id: r } : isObj(r) ? { id: get(r, 'id'), name: get(r, 'name'), bars: get(r, 'bars') } : null)).filter(r => r && typeof r.id === 'string' && REF_RE.test(r.id)).slice(0, 8)
  const n = list.length || 2
  const lanes = []; const clips = []
  for (let i = 0; i < n; i++) {
    const r = list[i]; const id = 'lane' + (i + 1)
    lanes.push({ id, name: cleanText(r?.name, L.nameMax, 'Pattern ' + (i + 1)), kind: 'pattern', volume: 1, pan: n > 1 ? r3((i / (n - 1) - 0.5) * 0.6) : 0, color: LANE_COLORS[i % LANE_COLORS.length] })
    if (!r) continue
    const patBars = clamp(Math.round(toNum(r.bars, 1)) || 1, 1, 64)
    const from = 1 + 4 * Math.min(i, 3); const len = 17 - from
    clips.push({ id: 'clip' + (i + 1), lane: id, startBar: from, lengthBars: len, ref: { type: 'music', id: r.id }, repeat: Math.min(L.repeatMax, Math.ceil(len / patBars)) })
  }
  lanes.push({ id: 'lane' + (n + 1), name: 'Audio 1', kind: 'audio' })
  return sanitizeSong({
    meta: { title: 'Demo song' }, bpm: 120, lengthBars: 16, lanes, clips,
    sections: [{ id: 'sec1', name: 'Intro', startBar: 1, lengthBars: 4 }, { id: 'sec2', name: 'Verse', startBar: 5, lengthBars: 4 }, { id: 'sec3', name: 'Chorus', startBar: 9, lengthBars: 4 }, { id: 'sec4', name: 'Outro', startBar: 13, lengthBars: 4 }],
    loop: { on: false, startBar: 9, endBar: 13 },
  })
}
export function songPresets () {
  return [
    { id: 'blank', label: 'Blank song', desc: 'Two empty lanes: one for patterns, one for audio.', make: () => defaultSong() },
    { id: 'demo', label: 'Demo arrangement', desc: 'Four sections over 16 bars; every pattern lane comes in one section later.', make: (refs) => demoSong(refs) },
  ]
}

export default {
  SONG_VERSION, KIND_SONG, SONG_LIMITS, defaultSong, sanitizeSong, barToSeconds, secondsToBar, bpmAt, clipEndBar, songLengthSeconds, newId,
  addLane, removeLane, updateLane, addClip, moveClip, resizeClip, splitClip, duplicateClip, removeClip, updateClip, setTempoPoint, removeTempoPoint,
  addSection, updateSection, removeSection, setAutomationPoint, removeAutomationPoint, addMarker, setLoop, snapBar, demoSong, songPresets,
  automationValueAt, activeClipsAt,
}
