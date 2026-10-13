/**
 * utils/OmniMusicModel.js — the MODEL of a MusicNode: the step sequencer's data (V195). PURE: no DOM, no THREE, no storage, no audio.
 *
 * It lives in `node.data.music` (saved WITH the node). Shape (all fields are repaired by sanitizeMusic):
 *
 *   { v:1, tempo:120 (20..300 bpm), stepsPerBar:16 (4..32), bars:1 (1..8), resolution:'1/16' ('1/4'|'1/8'|'1/16'|'1/32' = the length of ONE step),
 *     swing:0 (0..0.75 of a step, odd steps are late), gain:0.8 (master 0..1), loop:true, countIn:0 (bars 0..4), metronome:false,
 *     recordQuantize:true, recordResolution:'1/16', overdub:true,
 *     tracks:[ { id, name, instrumentNodeId (a SoundNode id | null = the default soft sine), mute, solo, volume 0..1, pan -1..1, transpose -48..48,
 *                note (0..127: what a click on the grid writes), view:'grid'|'roll',
 *                steps:[ { step, midi, velocity 0..1, gate (fraction of a step 0.05..4), prob 0..1, offset (-0.5..0.5 of a step) } ] } ] }   (max 16 tracks, 4096 events each)
 *
 * `steps` is SPARSE (only the steps that sound). One event per (step, midi). Sorted by step, then midi. Everything is hostile-input safe: sanitizeMusic never
 * throws, drops unknown keys (also __proto__ / constructor), clamps numbers and is idempotent (sanitize(sanitize(x)) equals sanitize(x)).
 *
 * Time: a step is `resolution` long (1/16 = a quarter of a beat), a bar is stepsPerBar steps. stepTime() gives the start of a step in seconds from the start of the
 * pattern with the swing applied to the ODD steps. Musical notes reuse the helpers of utils/OmniSoundModel.js (parseNote / midiToNote / noteToFreq).
 * USER-facing module: it must never import a Dev* module.
 */

import { parseNote, midiToNote, midiToFreq, noteToFreq, NOTE_NAMES } from './OmniSoundModel.js'

export const MUSIC_VERSION = 1
export const RESOLUTIONS = Object.freeze(['1/4', '1/8', '1/16', '1/32'])
/** Length of one step in BEATS (a beat is a quarter note). */
export const RES_BEATS = Object.freeze({ '1/4': 1, '1/8': 0.5, '1/16': 0.25, '1/32': 0.125 })
export const LIMITS = Object.freeze({
  tempoMin: 20, tempoMax: 300, stepsMin: 4, stepsMax: 32, barsMin: 1, barsMax: 8, swingMax: 0.75, tracksMax: 16, eventsMax: 4096,
  countInMax: 4, gateMin: 0.05, gateMax: 4, offsetMax: 0.5, transposeMax: 48, nameMax: 24, totalStepsMax: 256, idMax: 24,
})
export const VIEWS = Object.freeze(['grid', 'roll'])

const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k)
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v)
const get = (o, k) => { try { return isObj(o) && has(o, k) ? o[k] : undefined } catch (_) { return undefined } }
const r3 = (v) => { const x = Math.round(v * 1000) / 1000; return x === 0 ? 0 : x }
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v)
/** A finite number from a number or a numeric string, else `d`. */
const toNum = (v, d) => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : d
  if (typeof v === 'string' && v.trim() !== '') { const n = Number(v); return Number.isFinite(n) ? n : d }
  return d
}
const numIn = (v, d, a, b) => clamp(toNum(v, d), a, b)
const intIn = (v, d, a, b) => Math.round(numIn(v, d, a, b))
const boolOf = (v, d) => (typeof v === 'boolean' ? v : (v === 1 || v === 'true') ? true : (v === 0 || v === 'false') ? false : d)
const cleanName = (v, d) => {
  const s = (typeof v === 'string' || typeof v === 'number') ? String(v).replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, LIMITS.nameMax) : ''
  return s || d
}
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/
const TRACK_ID_RE = /^[A-Za-z0-9_-]{1,24}$/
const isSafeId = (s) => typeof s === 'string' && !s.startsWith('__')

// ── Time helpers ────────────────────────────────────────────────────────────────

export const isResolution = (r) => typeof r === 'string' && has(RES_BEATS, r)
export const resolutionBeats = (r) => (isResolution(r) ? RES_BEATS[r] : 0.25)
const tempoOf = (m) => numIn(get(m, 'tempo'), 120, LIMITS.tempoMin, LIMITS.tempoMax)
const swingOf = (m) => numIn(get(m, 'swing'), 0, 0, LIMITS.swingMax)
/** Beats per step of a model. */
export const stepBeats = (m) => resolutionBeats(get(m, 'resolution'))
/** Seconds per beat. */
export const beatSeconds = (m) => 60 / tempoOf(m)
/** Seconds per step (no swing). */
export const stepSeconds = (m) => beatSeconds(m) * stepBeats(m)
export const stepsPerBar = (m) => intIn(get(m, 'stepsPerBar'), 16, LIMITS.stepsMin, LIMITS.stepsMax)
export const barCount = (m) => intIn(get(m, 'bars'), 1, LIMITS.barsMin, LIMITS.barsMax)
/** Steps in the whole pattern (one loop). */
export const totalSteps = (m) => stepsPerBar(m) * barCount(m)
/** Seconds of one bar / one loop. */
export const barSeconds = (m) => stepsPerBar(m) * stepSeconds(m)
export const loopSeconds = (m) => totalSteps(m) * stepSeconds(m)
const isOdd = (k) => ((k % 2) + 2) % 2 === 1

/** Start of step `stepIndex` in seconds from the start of the pattern; the ODD steps are late by swing x step. Fractions are floored. */
export function stepTime (m, stepIndex) {
  const k = Math.floor(toNum(stepIndex, 0))
  const dur = stepSeconds(m)
  return k * dur + (isOdd(k) ? swingOf(m) * dur : 0)
}
/** Same in steps (a step number with the swing: 1 -> 1 + swing). */
export function stepPosition (m, stepIndex) {
  const k = Math.floor(toNum(stepIndex, 0))
  return k + (isOdd(k) ? swingOf(m) : 0)
}

/** Snap a time in BEATS to the nearest line of the grid `resolution` (a missing / bad resolution means 1/16). */
export function quantize (timeBeats, resolution = '1/16') {
  const t = toNum(timeBeats, 0)
  const g = resolutionBeats(resolution)
  const q = Math.round(t / g) * g
  return Math.round(q * 1e9) / 1e9 + 0
}

/**
 * A time in beats (from the start of the pattern) -> where an event goes: { step (wrapped into the pattern), offset (-0.5..0.5 of a step), wrapped }.
 * quantize on: the time snaps to the grid `resolution` first (a grid finer than the step keeps the remainder as offset). The swing is taken into account.
 */
export function recordPosition (m, timeBeats, opts = {}) {
  const q = opts.quantize !== false
  const res = isResolution(opts.resolution) ? opts.resolution : '1/16'
  let b = toNum(timeBeats, 0)
  if (q) b = quantize(b, res)
  const pos = b / stepBeats(m)
  const sw = swingOf(m)
  let best = Math.round(pos); let bestErr = Infinity
  for (const c of [Math.round(pos) - 1, Math.round(pos), Math.round(pos) + 1]) {
    const err = Math.abs(pos - (c + (isOdd(c) ? sw : 0)))
    if (err < bestErr) { bestErr = err; best = c }
  }
  const total = totalSteps(m)
  const step = ((best % total) + total) % total
  const off = clamp(pos - (best + (isOdd(best) ? sw : 0)), -LIMITS.offsetMax, LIMITS.offsetMax)
  return { step, offset: Math.abs(off) < 1e-3 ? 0 : r3(off), wrapped: best < 0 || best >= total }
}

// ── Notes ───────────────────────────────────────────────────────────────────────

/** 60 -> 'C4'. */
export const midiToName = (midi) => midiToNote(clamp(Math.round(toNum(midi, 60)), 0, 127))
/** 'C#4' / 'Db4' -> 60..., or null. */
export const nameToMidi = (name) => { const p = parseNote(name); return p ? p.midi : null }
export const isBlackKey = (midi) => [1, 3, 6, 8, 10].includes(((Math.round(toNum(midi, 0)) % 12) + 12) % 12)
export const midiFrequency = (midi, a4 = 440) => midiToFreq(midi, a4)
export { midiToNote, parseNote, noteToFreq, midiToFreq, NOTE_NAMES }

// ── Sanitizing ──────────────────────────────────────────────────────────────────

export function defaultTrack (over = {}) {
  return sanitizeTrack({ id: 't1', name: 'Track', note: 60, ...over }, totalStepsDefault(), new Set(), 1)
}
const totalStepsDefault = () => 16

/** One event, or null when it cannot be one. */
function sanitizeEvent (raw, total) {
  if (!isObj(raw)) return null
  const step = Math.round(toNum(get(raw, 'step'), NaN)); const midi = Math.round(toNum(get(raw, 'midi'), NaN))
  if (!Number.isFinite(step) || !Number.isFinite(midi) || step < 0 || step >= total || midi < 0 || midi > 127) return null
  return {
    step, midi,
    velocity: r3(numIn(get(raw, 'velocity'), 0.8, 0.01, 1)),
    gate: r3(numIn(get(raw, 'gate'), 0.9, LIMITS.gateMin, LIMITS.gateMax)),
    prob: r3(numIn(get(raw, 'prob'), 1, 0, 1)),
    offset: r3(numIn(get(raw, 'offset'), 0, -LIMITS.offsetMax, LIMITS.offsetMax)),
  }
}

function sanitizeTrack (raw, total, seen, n) {
  const r = isObj(raw) ? raw : {}
  let id = get(r, 'id'); id = typeof id === 'string' && TRACK_ID_RE.test(id) && isSafeId(id) ? id : null
  if (!id || seen.has(id)) { let k = n; while (seen.has('t' + k)) k++; id = 't' + k }
  seen.add(id)
  const inst = get(r, 'instrumentNodeId')
  const ev = new Map()
  const src = get(r, 'steps')
  if (Array.isArray(src)) {
    const len = Math.min(src.length, LIMITS.eventsMax * 2)
    for (let i = 0; i < len; i++) {
      let e = null
      try { e = sanitizeEvent(src[i], total) } catch (_) { e = null }
      if (!e) continue
      ev.set(e.step * 128 + e.midi, e)   // one event per (step, midi); the later wins
    }
  }
  const steps = [...ev.values()].sort((a, b) => a.step - b.step || a.midi - b.midi).slice(0, LIMITS.eventsMax)
  const view = get(r, 'view')
  return {
    id,
    name: cleanName(get(r, 'name'), 'Track ' + n),
    instrumentNodeId: typeof inst === 'string' && ID_RE.test(inst) && isSafeId(inst) ? inst : null,
    mute: boolOf(get(r, 'mute'), false),
    solo: boolOf(get(r, 'solo'), false),
    volume: r3(numIn(get(r, 'volume'), 0.8, 0, 1)),
    pan: r3(numIn(get(r, 'pan'), 0, -1, 1)),
    transpose: intIn(get(r, 'transpose'), 0, -LIMITS.transposeMax, LIMITS.transposeMax),
    note: intIn(get(r, 'note'), 60, 0, 127),
    view: VIEWS.includes(view) ? view : 'grid',
    steps,
  }
}

/** A fresh MusicNode pattern: 120 bpm, 16 x 1/16 steps, four tracks (Kick with four-on-the-floor, Snare, Hat, Lead) on the default soft sine. */
export function defaultMusic () {
  const m = {
    v: MUSIC_VERSION, tempo: 120, stepsPerBar: 16, bars: 1, resolution: '1/16', swing: 0, gain: 0.8, loop: true, countIn: 0, metronome: false,
    recordQuantize: true, recordResolution: '1/16', overdub: true, tracks: [],
  }
  const mk = (id, name, note, view) => ({ id, name, instrumentNodeId: null, mute: false, solo: false, volume: 0.8, pan: 0, transpose: 0, note, view, steps: [] })
  m.tracks = [mk('t1', 'Kick', 36, 'grid'), mk('t2', 'Snare', 38, 'grid'), mk('t3', 'Hat', 42, 'grid'), mk('t4', 'Lead', 60, 'roll')]
  m.tracks[0].steps = patternEvents('four-on-floor', m, { track: m.tracks[0] })
  return m
}

/** A complete valid `music` object from anything. Never throws. */
export function sanitizeMusic (raw) {
  try {
    if (!isObj(raw)) return defaultMusic()
    const spb = intIn(get(raw, 'stepsPerBar'), 16, LIMITS.stepsMin, LIMITS.stepsMax)
    const bars = intIn(get(raw, 'bars'), 1, LIMITS.barsMin, LIMITS.barsMax)
    const total = Math.min(LIMITS.totalStepsMax, spb * bars)
    const res = get(raw, 'resolution'); const rres = get(raw, 'recordResolution')
    const out = {
      v: MUSIC_VERSION,
      tempo: r3(numIn(get(raw, 'tempo'), 120, LIMITS.tempoMin, LIMITS.tempoMax)),
      stepsPerBar: spb, bars,
      resolution: isResolution(res) ? res : '1/16',
      swing: r3(numIn(get(raw, 'swing'), 0, 0, LIMITS.swingMax)),
      gain: r3(numIn(get(raw, 'gain'), 0.8, 0, 1)),
      loop: boolOf(get(raw, 'loop'), true),
      countIn: intIn(get(raw, 'countIn'), 0, 0, LIMITS.countInMax),
      metronome: boolOf(get(raw, 'metronome'), false),
      recordQuantize: boolOf(get(raw, 'recordQuantize'), true),
      recordResolution: isResolution(rres) ? rres : '1/16',
      overdub: boolOf(get(raw, 'overdub'), true),
      tracks: [],
    }
    const src = get(raw, 'tracks')
    if (src === undefined) {   // no tracks key at all: the default four tracks (the kick pattern re-scaled to this length)
      const d = defaultMusic().tracks
      d[0].steps = patternEvents('four-on-floor', out, { track: d[0] })
      out.tracks = d.map((t, i) => sanitizeTrack(t, total, new Set(), i + 1))
    } else if (Array.isArray(src)) {
      const seen = new Set()
      const len = Math.min(src.length, LIMITS.tracksMax)
      for (let i = 0; i < len; i++) { try { out.tracks.push(sanitizeTrack(src[i], total, seen, i + 1)) } catch (_) { /* skip a hostile track */ } }
    }
    return out
  } catch (_) {
    return defaultMusic()
  }
}

/** A new empty track with a free id for `music` (not added). */
export function newTrack (music, over = {}) {
  const used = new Set((music?.tracks ?? []).map(t => t.id))
  let n = (music?.tracks?.length ?? 0) + 1
  while (used.has('t' + n)) n++
  return sanitizeTrack({ name: 'Track ' + n, ...over, id: 't' + n, steps: [] }, Math.max(1, totalSteps(music)), new Set(), n)
}

export const trackCount = (m) => (Array.isArray(m?.tracks) ? m.tracks.length : 0)
export const countEvents = (m) => (Array.isArray(m?.tracks) ? m.tracks.reduce((n, t) => n + (Array.isArray(t?.steps) ? t.steps.length : 0), 0) : 0)
export const findTrack = (m, id) => (Array.isArray(m?.tracks) ? m.tracks.find(t => t.id === id) ?? null : null)
/** Solo wins over mute: when any track is solo, only the solo tracks sound. */
export function trackAudible (m, track) {
  if (!track || track.mute) return false
  const anySolo = Array.isArray(m?.tracks) && m.tracks.some(t => t.solo)
  return anySolo ? !!track.solo : true
}

/** The events of a track at one step (a new array). */
export function eventsAtStep (track, step) {
  const a = track?.steps
  if (!Array.isArray(a) || !a.length) return []
  // binary search for the first event with .step >= step (the list is sorted)
  let lo = 0; let hi = a.length
  while (lo < hi) { const mid = (lo + hi) >> 1; if (a[mid].step < step) lo = mid + 1; else hi = mid }
  const out = []
  for (let i = lo; i < a.length && a[i].step === step; i++) out.push(a[i])
  return out
}
/** Per-step lookup of a track for the scheduler: an array of `total` entries, each null or the events of that step. */
export function indexTrack (track, total) {
  const idx = new Array(total).fill(null)
  for (const e of track?.steps ?? []) { if (e.step >= 0 && e.step < total) (idx[e.step] ??= []).push(e) }
  return idx
}

// ── Editing helpers (mutate a track of a model YOU own: clone first; the owner sanitizes afterwards) ─────────────────────────────────────

/** Add or replace the event (step, midi) of a track. Returns false when the track is full or the event is invalid. */
export function upsertEvent (track, ev, total = LIMITS.totalStepsMax) {
  const e = sanitizeEvent(ev, total); if (!e || !track || !Array.isArray(track.steps)) return false
  const i = track.steps.findIndex(x => x.step === e.step && x.midi === e.midi)
  if (i >= 0) { track.steps[i] = e; return true }
  if (track.steps.length >= LIMITS.eventsMax) return false
  track.steps.push(e); track.steps.sort((a, b) => a.step - b.step || a.midi - b.midi)
  return true
}
/** Remove the event (step, midi) (midi null = every note of that step). Returns how many were removed. */
export function removeEvent (track, step, midi = null) {
  if (!track || !Array.isArray(track.steps)) return 0
  const before = track.steps.length
  track.steps = track.steps.filter(x => !(x.step === step && (midi == null || x.midi === midi)))
  return before - track.steps.length
}

// ── Pattern presets ─────────────────────────────────────────────────────────────

const scaleStep = (p16, spb) => Math.round(p16 * spb / 16)
/** Events for positions given on a 16-step bar, repeated over every bar of the model. spec: [pos16, midiOffset, velocity, gate] */
function bars16 (m, root, list) {
  const spb = stepsPerBar(m); const bars = barCount(m); const out = []; const seen = new Set()
  for (let b = 0; b < bars; b++) for (const [p, off, vel, gate] of list) {
    const step = b * spb + scaleStep(p, spb)
    const key = step * 256 + clamp(root + off, 0, 127)
    if (step >= b * spb + spb || seen.has(key)) continue   // a short bar folds several positions together: keep the first
    seen.add(key)
    out.push({ step, midi: root + off, velocity: vel ?? 0.8, gate: gate ?? 0.9, prob: 1, offset: 0 })
  }
  return out
}
const every = (n, from = 0) => { const a = []; for (let i = from; i < 16; i += n) a.push(i); return a }

/** Ready-made patterns for ONE track. `note` is the pitch the pattern is written at (the track's note unless it has none), roles tell the UI where it fits. */
export const PATTERNS = Object.freeze({
  'empty': { label: 'Empty', desc: 'Clears the track.', role: 'any', note: 60, gen: () => [] },
  'four-on-floor': { label: 'Four on the floor', desc: 'A beat on every quarter note (steps 1, 5, 9, 13): the classic dance kick.', role: 'drum', note: 36, gen: (m, r) => bars16(m, r, every(4).map(p => [p, 0, p === 0 ? 1 : 0.9, 0.8])) },
  'backbeat': { label: 'Backbeat', desc: 'Hits on beats 2 and 4 (steps 5 and 13): a snare or clap.', role: 'drum', note: 38, gen: (m, r) => bars16(m, r, [[4, 0, 1, 0.8], [12, 0, 1, 0.8]]) },
  'offbeat-hats': { label: 'Offbeat hats', desc: 'Between the beats (steps 3, 7, 11, 15): the open hat of house music.', role: 'drum', note: 42, gen: (m, r) => bars16(m, r, [2, 6, 10, 14].map(p => [p, 0, 0.7, 0.5])) },
  'eighth-hats': { label: 'Eighth hats', desc: 'Every second step, the accents alternate.', role: 'drum', note: 42, gen: (m, r) => bars16(m, r, every(2).map((p, i) => [p, 0, i % 2 ? 0.55 : 0.85, 0.5])) },
  'sixteenth-hats': { label: 'Sixteenth hats', desc: 'Every step, with a gentle accent pattern.', role: 'drum', note: 42, gen: (m, r) => bars16(m, r, every(1).map(p => [p, 0, p % 4 === 0 ? 0.9 : p % 2 === 0 ? 0.65 : 0.4, 0.4])) },
  'euclid-5': { label: 'Euclidean 5', desc: 'Five hits spread as evenly as possible over 16 steps.', role: 'drum', note: 45, gen: (m, r) => bars16(m, r, [0, 3, 6, 9, 12].map(p => [p, 0, 0.85, 0.6])) },
  'arp-up': { label: 'Arpeggio up', desc: 'A major chord climbing, one note per step (C E G C).', role: 'pitch', note: 60, gen: (m, r) => bars16(m, r, every(1).map(p => [p, [0, 4, 7, 12][p % 4], p % 4 === 0 ? 0.9 : 0.7, 0.8])) },
  'arp-down': { label: 'Arpeggio down', desc: 'The same chord falling, one note per step (C G E C).', role: 'pitch', note: 72, gen: (m, r) => bars16(m, r, every(1).map(p => [p, [0, -5, -8, -12][p % 4], p % 4 === 0 ? 0.9 : 0.7, 0.8])) },
  'bassline': { label: 'Bassline', desc: 'A simple groove on the root with a fifth and a fourth.', role: 'pitch', note: 36, gen: (m, r) => bars16(m, r, [[0, 0, 1, 1.5], [3, 0, 0.8, 0.9], [6, 7, 0.85, 0.9], [8, 0, 0.95, 1.5], [10, 5, 0.8, 0.9], [12, 3, 0.85, 1.2]]) },
  'chord-stabs': { label: 'Chord stabs', desc: 'A short major triad on steps 1, 7 and 11.', role: 'pitch', note: 60, gen: (m, r) => bars16(m, r, [0, 6, 10].flatMap(p => [0, 4, 7].map(o => [p, o, 0.75, 0.5]))) },
})
export const PATTERN_IDS = Object.freeze(Object.keys(PATTERNS))
export const isPatternId = (id) => typeof id === 'string' && has(PATTERNS, id)

/** Events of a preset for a model (step grid scaled to its stepsPerBar / bars). opts: { root (midi), track } -> the track's `note` is the root when given. Never throws. */
export function patternEvents (id, m, opts = {}) {
  try {
    if (!isPatternId(id)) return []
    const p = PATTERNS[id]
    const rootRaw = opts.root ?? opts.track?.note
    const root = Number.isFinite(+rootRaw) && rootRaw !== null ? clamp(Math.round(+rootRaw), 0, 127) : p.note
    const total = totalSteps(m)
    return p.gen(m, root).map(e => ({ ...e, midi: clamp(e.midi, 0, 127) })).filter(e => e.step < total)
  } catch (_) { return [] }
}

/** One-line description of a model. */
export function describeMusic (m) {
  const spb = stepsPerBar(m); const b = barCount(m)
  return `${Math.round(tempoOf(m))} bpm · ${spb} steps × ${b} bar${b === 1 ? '' : 's'} (${get(m, 'resolution') ?? '1/16'}) · ${trackCount(m)} track${trackCount(m) === 1 ? '' : 's'} · ${countEvents(m)} note${countEvents(m) === 1 ? '' : 's'}`
}

export default { MUSIC_VERSION, RESOLUTIONS, LIMITS, defaultMusic, sanitizeMusic, stepTime, quantize, eventsAtStep, PATTERNS, patternEvents }
