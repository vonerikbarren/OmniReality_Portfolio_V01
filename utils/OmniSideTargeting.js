/**
 * utils/OmniSideTargeting.js — pure logic for Z / L / R targeting (V207)
 *
 *   Z-Targeting (centre)  — the orbit target sits in the middle of the screen (how it always was).
 *   L-Targeting (9 o'clock) — the target sits on the LEFT, so the right side of the HUD is open space for panels / other nodes.
 *   R-Targeting (3 o'clock) — the target sits on the RIGHT, so the left side is open space.
 *
 * One mode at a time (never L and R together). The mode only matters while something is targeted; clicking empty space
 * releases the target (OmniOrbitRelease) and the view goes back to centre.
 * No DOM / Three.js here: plain numbers, so it is unit-testable.
 */
export const MODES = ['Z', 'L', 'R']
export const MODE_INFO = {
  Z: { label: 'Z-Targeting — centre', clock: '12', note: 'The target stays in the middle of the screen.' },
  L: { label: 'L-Targeting — 9 o\'clock', clock: '9', note: 'The target moves to the left; the right side of the HUD is free for panels and nodes.' },
  R: { label: 'R-Targeting — 3 o\'clock', clock: '3', note: 'The target moves to the right; the left side of the HUD is free for panels and nodes.' },
}
export const DISTANCE_MIN = 0.2
export const DISTANCE_MAX = 0.8
export const DEFAULTS = Object.freeze({ mode: 'Z', distance: 0.5 })
export const STORE_KEY = 'omni:targeting:mode-v1'

/** distance = how far from the centre towards the edge the target sits (0.5 = a quarter of the screen width from the edge). */
export function sanitize (raw) {
  const r = raw && typeof raw === 'object' ? raw : {}
  const mode = typeof r.mode === 'string' && MODES.includes(r.mode.toUpperCase()) ? r.mode.toUpperCase() : DEFAULTS.mode
  let d = Number(r.distance); if (!Number.isFinite(d)) d = DEFAULTS.distance
  d = Math.round(Math.min(DISTANCE_MAX, Math.max(DISTANCE_MIN, d)) * 100) / 100
  return { mode, distance: d }
}

/** the horizontal shift (pixels) of the view window: + moves the target LEFT on screen (L), - moves it RIGHT (R). */
export function viewShiftPx (mode, distance, width) {
  const w = Number(width); if (!(w > 0)) return 0
  const s = sanitize({ mode, distance })
  const px = s.distance * w / 2
  return s.mode === 'L' ? px : s.mode === 'R' ? -px : 0
}

/** where the target lands on screen, as a fraction of the width (0 = left edge, 0.5 = centre, 1 = right edge). */
export function screenFraction (mode, distance) {
  const s = sanitize({ mode, distance })
  return s.mode === 'L' ? 0.5 - s.distance / 2 : s.mode === 'R' ? 0.5 + s.distance / 2 : 0.5
}

export function load (storage = globalThis.localStorage) {
  try { return sanitize(JSON.parse(storage.getItem(STORE_KEY))) } catch (_) { return sanitize(null) }
}
export function save (value, storage = globalThis.localStorage) {
  const s = sanitize(value)
  try { storage.setItem(STORE_KEY, JSON.stringify(s)) } catch (_) {}
  return s
}
export default { MODES, MODE_INFO, DEFAULTS, sanitize, viewShiftPx, screenFraction, load, save }
