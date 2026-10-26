/**
 * utils/OmniTimeScale.js (V217) — the one number that says how fast motion runs: 1 = real time, 0 = a held moment, 8 = hyperlapse, 0.25 = slow-mo.
 * The Time axiom (systems/OmniAxioms.js) sets it. Motion systems multiply their frame time by getTimeScale(): OmniVibration, node behaviours, tunnel particles,
 * Dimensional Node spin. UI, camera controls and tweens keep real time on purpose, so you can always move and click.
 * getLoopWindow() > 0 means "looped event": looping motion (OmniVibration) repeats every that-many seconds.
 */
export const MIN_SCALE = 0, MAX_SCALE = 200
let scale = 1, loop = 0
export const getTimeScale = () => scale
export const getLoopWindow = () => loop
export function setTimeScale (v, loopWindow = 0) {
  const n = Number(v), s = Number.isFinite(n) ? Math.min(MAX_SCALE, Math.max(MIN_SCALE, n)) : 1
  const l = Number.isFinite(Number(loopWindow)) ? Math.max(0, Number(loopWindow)) : 0
  if (s === scale && l === loop) return false
  scale = s; loop = l
  try { window.dispatchEvent(new CustomEvent('omni:time-scale-changed', { detail: { scale, loop } })) } catch (_) {}
  return true
}
export const scaleDt = (dt) => dt * scale
