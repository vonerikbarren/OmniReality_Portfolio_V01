/**
 * utils/OmniTimeClock.js (V260) — which clock the TimeCubes read.
 *   source 'real'   the computer's clock (default)
 *   source 'scene'  the scene clock: the OmniChronos playhead. now = origin + playheadSeconds * 1000 * scale
 *                   origin = the UTC instant (ms) that playhead 0 means; scale = scene seconds per playhead second (1 = real speed, 3600 = an hour a second).
 *                   Scrubbing or playing the timeline therefore moves every cube that follows the node clock.
 * Pure: the playhead is passed in.
 */
export const CLOCK_SOURCES = Object.freeze(['real', 'scene'])
const MAXMS = 8.64e15 / 2
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v)
const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d)
export function sanitizeClock (raw) {
  const r = isObj(raw) ? raw : {}
  return { source: r.source === 'scene' ? 'scene' : 'real', origin: Math.min(MAXMS, Math.max(-MAXMS, Math.round(num(r.origin, 0)))), scale: Math.min(1e7, Math.max(1e-4, num(r.scale, 1))) }
}
export const clockNow = (clock, realNow, playheadSeconds) => { const c = sanitizeClock(clock); return c.source === 'scene' ? Math.round(c.origin + num(playheadSeconds, 0) * 1000 * c.scale) : realNow }
