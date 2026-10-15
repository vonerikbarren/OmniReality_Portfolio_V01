/**
 * utils/OmniDeckMath.js (V202) — pure maths of a DJ deck on a mix strip: beat grid, snapping, loops, tap tempo, clip position.
 * No DOM, no audio. Used by utils/OmniMixModel.js (the ops), systems/OmniMixEngine.js (the audio) and ui/OmniMixView.js.
 *
 * Words: a strip with an audio clip is a DECK. `bpm` is the tempo OF THE CLIP (set by hand or tapped); `beat1` is the time in the clip of its first beat.
 * All times here are CLIP seconds (the clip as recorded), never real seconds; the engine converts with the playback rate.
 * Every function takes any input and returns a valid answer (never throws, never NaN).
 */

export const LOOP_BEATS = Object.freeze([0.25, 0.5, 1, 2, 4, 8, 16, 32])
export const HOT_CUES = 4
export const CLIP_SECONDS_MAX = 3600
export const LOOP_MIN_S = 0.02
export const LOOP_EPS = 1e-6   // float slack when comparing a rounded loop length with LOOP_MIN_S
export const validLoop = (a, z) => z - a >= LOOP_MIN_S - LOOP_EPS
export const PITCH_RANGE = 0.08            // pitch fader -1..1 = -8 % .. +8 %
export const RATE_MIN = 0.25
export const RATE_MAX = 4

const isNum = (v) => typeof v === 'number' && Number.isFinite(v)
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const num = (v, def, lo = -Infinity, hi = Infinity) => {
  const n = typeof v === 'string' && v.trim() !== '' && v.length < 24 ? Number(v) : v
  return isNum(n) ? clamp(n, lo, hi) : def
}
const r3 = (v) => Math.round(v * 1000) / 1000

/** Seconds of ONE beat of the clip; 0 when the clip has no tempo. */
export function beatLen (bpm) { const b = num(bpm, 0, 0, 1000); return b > 0 ? 60 / b : 0 }

/** The beat number (fractional) a clip time falls on, 0 = the first beat. null without a tempo. */
export function beatAt (bpm, beat1, t) {
  const bl = beatLen(bpm); if (!bl) return null
  return (num(t, 0, 0, CLIP_SECONDS_MAX) - num(beat1, 0, 0, CLIP_SECONDS_MAX)) / bl
}

/** Snap a clip time to the nearest beat of the grid (or to the nearest `division` of a beat, 1 = beat, 0.25 = sixteenth). No tempo -> t unchanged (rounded). Never below 0. */
export function snapToBeat (bpm, beat1, t, division = 1) {
  const tt = num(t, 0, 0, CLIP_SECONDS_MAX)
  const bl = beatLen(bpm); if (!bl) return r3(tt)
  const step = bl * clamp(num(division, 1, 0.0625, 8), 0.0625, 8)
  const o = num(beat1, 0, 0, CLIP_SECONDS_MAX)
  const n = Math.round((tt - o) / step)
  return r3(Math.max(0, o + n * step))
}

/** Floor to the beat at or before t (a loop starts on the beat you were in). */
export function floorToBeat (bpm, beat1, t) {
  const tt = num(t, 0, 0, CLIP_SECONDS_MAX)
  const bl = beatLen(bpm); if (!bl) return r3(tt)
  const o = num(beat1, 0, 0, CLIP_SECONDS_MAX)
  return r3(Math.max(0, o + Math.floor((tt - o) / bl + 1e-6) * bl))
}

/** A loop of `beats` beats starting on the beat at or before `pos`. Without a tempo the loop starts at pos and lasts `beats` seconds. Clipped to the clip length when known. */
export function loopFromBeats (bpm, beat1, pos, beats, dur = 0) {
  const b = clamp(num(beats, 4, 0.0625, 128), 0.0625, 128)
  const bl = beatLen(bpm)
  const len = bl ? b * bl : b
  let a = bl ? floorToBeat(bpm, beat1, pos) : r3(num(pos, 0, 0, CLIP_SECONDS_MAX))
  let z = a + len
  const d = num(dur, 0, 0, CLIP_SECONDS_MAX)
  if (d > 0 && z > d) { z = d; a = Math.max(0, Math.min(a, d - len)); z = Math.min(d, a + len) }
  if (!validLoop(a, z)) z = a + LOOP_MIN_S
  return { loopIn: r3(a), loopOut: r3(z) }
}

/** Halve / double a loop around its start (factor 0.5 or 2; other factors work too). Never shorter than LOOP_MIN_S nor past `dur` (when known). */
export function scaleLoop (loopIn, loopOut, factor, dur = 0) {
  const a = num(loopIn, 0, 0, CLIP_SECONDS_MAX)
  const len = Math.max(LOOP_MIN_S, num(loopOut, a + 1, 0, CLIP_SECONDS_MAX) - a)
  let nl = Math.max(LOOP_MIN_S, len * clamp(num(factor, 1, 0.01, 100), 0.01, 100))
  const d = num(dur, 0, 0, CLIP_SECONDS_MAX)
  if (d > 0) nl = Math.min(nl, Math.max(LOOP_MIN_S, d - a))
  return { loopIn: r3(a), loopOut: r3(a + nl) }
}

/** Move a loop by `beats` beats (negative = earlier), keeping its length. Needs a tempo; otherwise by that many seconds. */
export function shiftLoop (bpm, loopIn, loopOut, beats, dur = 0) {
  const a = num(loopIn, 0, 0, CLIP_SECONDS_MAX); const len = Math.max(LOOP_MIN_S, num(loopOut, a + 1, 0, CLIP_SECONDS_MAX) - a)
  const bl = beatLen(bpm) || 1
  let na = a + num(beats, 0, -1000, 1000) * bl
  const d = num(dur, 0, 0, CLIP_SECONDS_MAX)
  na = Math.max(0, d > 0 ? Math.min(na, Math.max(0, d - len)) : na)
  return { loopIn: r3(na), loopOut: r3(na + len) }
}

/** The loop actually used: [in, out] in clip seconds, or null when looping is off or the region is not valid. `dur` is the clip length (0 = unknown). */
export function loopRegion (strip, dur = 0) {
  if (!strip || !strip.loopOn) return null
  const d = num(dur, 0, 0, CLIP_SECONDS_MAX)
  const a = num(strip.loopIn, 0, 0, CLIP_SECONDS_MAX); let z = num(strip.loopOut, 0, 0, CLIP_SECONDS_MAX)
  if (d > 0) z = Math.min(z, d)
  if (!validLoop(a, z)) return null
  if (d > 0 && a >= d) return null
  return [a, z]
}

/**
 * Tap tempo from a list of tap times in seconds (ascending). Uses the median of the last intervals; a gap longer than 2 s starts over (only the taps after it count).
 * Needs at least 3 taps (2 intervals). Returns the bpm rounded to 0.1, within 40..240, or null.
 */
export function tapTempo (times, minBpm = 40, maxBpm = 240) {
  const t = (Array.isArray(times) ? times.slice(-17) : []).map(Number).filter(isNum)
  if (t.length < 3) return null
  let start = 0
  for (let i = 1; i < t.length; i++) if (t[i] - t[i - 1] > 2 || t[i] <= t[i - 1]) start = i
  const taps = t.slice(start)
  if (taps.length < 3) return null
  const iv = []
  for (let i = 1; i < taps.length; i++) iv.push(taps[i] - taps[i - 1])
  iv.sort((a, b) => a - b)
  const med = iv.length % 2 ? iv[(iv.length - 1) / 2] : (iv[iv.length / 2 - 1] + iv[iv.length / 2]) / 2
  if (!(med > 0)) return null
  let bpm = 60 / med
  while (bpm > maxBpm && bpm / 2 >= minBpm) bpm /= 2      // taps on the half beat -> fold into range
  while (bpm < minBpm && bpm * 2 <= maxBpm) bpm *= 2
  if (bpm < minBpm || bpm > maxBpm) return null
  return Math.round(bpm * 10) / 10
}

/** playbackRate of a deck: the tempo sync (mix bpm / clip bpm) times the pitch fader (-1..1 = +-8 %). */
export function deckRate (syncRate, pitch) {
  return clamp(num(syncRate, 1, 0.01, 100) * (1 + PITCH_RANGE * num(pitch, 0, -1, 1)), RATE_MIN, RATE_MAX)
}

/** The tempo you hear: clip bpm x rate (0 without a tempo). */
export const effectiveBpm = (bpm, rate) => (num(bpm, 0, 0, 1000) > 0 ? Math.round(bpm * num(rate, 1, RATE_MIN, RATE_MAX) * 100) / 100 : 0)

/**
 * Where in the clip a running copy is: the copy started at real time `when` at clip time `offset` with `rate`, and only plays up to clip time `end`.
 * Returns the clip time at real time `now`, clamped to [offset, end]; before `when` it is `offset`.
 */
export function clipPosition (copy, now) {
  if (!copy) return 0
  const off = num(copy.offset, 0, 0, CLIP_SECONDS_MAX); const end = num(copy.end, off, 0, CLIP_SECONDS_MAX)
  const dt = Math.max(0, num(now, 0) - num(copy.when, 0))
  return clamp(off + dt * num(copy.rate, 1, RATE_MIN, RATE_MAX), off, Math.max(off, end))
}

/**
 * Move a playhead: from clip time `pos`, `dt` real seconds at `rate`. With a loop region [a, z] the playhead wraps from z back to a (a start before a plays on until z, like a native looping source);
 * without one it stops at `dur` ({ ended: true }). `dur` 0 = unknown length (never ends).
 */
export function advance (pos, dt, rate, region, dur = 0) {
  let p = num(pos, 0, 0, CLIP_SECONDS_MAX) + Math.max(0, num(dt, 0, 0, 3600)) * num(rate, 1, RATE_MIN, RATE_MAX)
  if (region && region[1] > region[0]) {
    if (p >= region[1]) p = region[0] + ((p - region[0]) % (region[1] - region[0]))
    return { pos: p, ended: false }
  }
  const d = num(dur, 0, 0, CLIP_SECONDS_MAX)
  if (d > 0 && p >= d) return { pos: d, ended: true }
  return { pos: p, ended: false }
}

/** Peaks of one channel in `n` columns (max absolute value per column, 0..1). A 1000-sample clip at n=10 gives 10 values. Hostile input -> zeros. */
export function peaksOf (data, n = 128) {
  const cols = Math.round(clamp(num(n, 128, 1, 4096), 1, 4096))
  const out = new Float32Array(cols)
  if (!data || typeof data.length !== 'number' || data.length < 1) return out
  const len = data.length
  for (let c = 0; c < cols; c++) {
    const a = Math.floor(c * len / cols); const z = Math.max(a + 1, Math.floor((c + 1) * len / cols))
    let m = 0
    for (let i = a; i < z && i < len; i++) { const v = Math.abs(data[i]); if (v > m) m = v }
    out[c] = m > 1 ? 1 : m
  }
  return out
}

export default {
  LOOP_BEATS, HOT_CUES, PITCH_RANGE, validLoop, beatLen, beatAt, snapToBeat, floorToBeat, loopFromBeats, scaleLoop, shiftLoop, loopRegion, tapTempo, deckRate, effectiveBpm, clipPosition, advance, peaksOf,
}
