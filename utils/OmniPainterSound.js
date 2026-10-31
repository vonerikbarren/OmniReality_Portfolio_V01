/**
 * utils/OmniPainterSound.js (V256) — pure: the little sounds of the painter, as note plans. No audio here, so it tests in Node.
 *   soundPlan(event, brush) -> { notes: [{ f (Hz), at (s from now), dur (s), type, gain 0..1 }] }   (empty when the brush has sound off)
 *   events: arm · disarm · spray · surface · stroke · undo · full · lab · hand
 *   hueOf('#rrggbb') -> 0..360        tick(state, now, min) -> true at most once per `min` seconds (so a fast drag does not machine-gun)
 * The module (systems/OmniPainterSounds.js) plays the plan with WebAudio. A brush colour decides the pitch, a bigger brush sounds lower.
 */
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d)
export const EVENTS = Object.freeze(['arm', 'disarm', 'spray', 'surface', 'stroke', 'undo', 'full', 'lab', 'hand'])
// a pentatonic ladder so any hue lands on a pleasant note
const LADDER = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0]

export function hueOf (hex) {
  const m = /^#([0-9a-f]{6})$/i.exec(String(hex)); if (!m) return 0
  const c = parseInt(m[1], 16); const r = ((c >> 16) & 255) / 255; const g = ((c >> 8) & 255) / 255; const b = (c & 255) / 255
  const mx = Math.max(r, g, b); const mn = Math.min(r, g, b); const d = mx - mn; if (!d) return 0
  const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4
  return ((h * 60) + 360) % 360
}
/** The note a colour plays. */
export function noteFor (color, size = 0.5) {
  const f = LADDER[Math.min(LADDER.length - 1, Math.floor(hueOf(color) / 360 * LADDER.length))]
  const oct = clamp(num(size, 0.5), 0.1, 4) > 1.5 ? 0.5 : 1      // a big brush is one octave lower
  return +(f * oct).toFixed(2)
}

export function soundPlan (event, brush = {}) {
  if (!brush || typeof brush !== 'object') brush = {}
  if (!EVENTS.includes(event) || brush.sound === false) return { notes: [] }
  const vol = clamp(num(brush.volume, 0.5), 0, 1); if (vol === 0) return { notes: [] }
  const f = noteFor(brush.color, brush.size); const g = (x) => +(x * vol * 0.5).toFixed(4)
  const N = (freq, at, dur, type, gain) => ({ f: +freq.toFixed(2), at, dur, type, gain: g(gain) })
  switch (event) {
    case 'arm': return { notes: [N(f, 0, 0.09, 'sine', 0.8), N(f * 1.5, 0.08, 0.14, 'sine', 0.8)] }
    case 'disarm': return { notes: [N(f * 1.5, 0, 0.09, 'sine', 0.7), N(f, 0.08, 0.14, 'sine', 0.7)] }
    case 'spray': return { notes: [N(f, 0, 0.05, 'triangle', 0.45)] }
    case 'surface': return { notes: [N(f * 0.5, 0, 0.06, 'sine', 0.55), N(f, 0, 0.03, 'triangle', 0.25)] }
    case 'stroke': return { notes: [N(f, 0, 0.07, 'sine', 0.6), N(f * 1.25, 0.06, 0.12, 'sine', 0.6)] }
    case 'undo': return { notes: [N(f, 0, 0.06, 'triangle', 0.6), N(f * 0.75, 0.06, 0.06, 'triangle', 0.6), N(f * 0.5, 0.12, 0.12, 'triangle', 0.6)] }
    case 'full': return { notes: [N(130.81, 0, 0.12, 'square', 0.5), N(130.81, 0.16, 0.16, 'square', 0.5)] }
    case 'lab': return { notes: [N(f, 0, 0.06, 'sine', 0.6), N(f * 1.25, 0.05, 0.06, 'sine', 0.6), N(f * 1.5, 0.1, 0.12, 'sine', 0.6)] }
    case 'hand': return { notes: [N(f * 2, 0, 0.05, 'sine', 0.5)] }
    default: return { notes: [] }
  }
}

/** Rate limiter: state is { last: -Infinity }; returns true (and remembers `now`) at most once per `min` seconds. */
export function tick (state, now, min = 0.07) {
  const t = num(now, 0); if (t - (state.last ?? -Infinity) < min) return false
  state.last = t; return true
}
