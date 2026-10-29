/**
 * utils/OmniGaitModel.js (V242) — pure: the avatar's movement animation from its speed.
 *   speed <= HOVER_SPEED (10 units/s): WALK. Steps bounce the body (two per cycle, faster with speed) and rock it side to side.
 *   speed >  HOVER_SPEED:               HOVER. The feet leave the floor: a lift, a slow breathing bob and a lean into the travel.
 *   speed 0:                            IDLE. A very small breathing motion.
 * The result is an OFFSET relative to the point the avatar stands on, so it works on any floor (y = 0, 10, -860 ...): no per-floor animations are needed.
 * gaitAt(speed, t) -> { mode, y, roll, lean, squash }   y in world units, roll / lean in radians, squash is a scale offset on the capsule height.
 */
export const HOVER_SPEED = 10
export const WALK = { amp: 0.09, freq: 0.5, roll: 0.07 }      // freq: cycles per world unit travelled
export const HOVER = { lift: 0.55, amp: 0.12, freq: 0.7, lean: 0.35 }   // freq: breaths per second
export const IDLE = { amp: 0.025, freq: 0.3 }

const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d)

export function modeOf (speed) {
  const s = Math.max(0, num(speed))
  return s <= 0.001 ? 'idle' : s > HOVER_SPEED ? 'hover' : 'walk'
}

/** `phase` is the distance walked (units) for walking, and seconds for hovering / idle: the caller keeps one clock `t` (seconds) and one `dist` (units). */
export function gaitAt (speed, t = 0, dist = 0) {
  const mode = modeOf(speed); const T = num(t); const D = num(dist)
  if (mode === 'idle') return { mode, y: Math.sin(T * Math.PI * 2 * IDLE.freq) * IDLE.amp, roll: 0, lean: 0, squash: 0 }
  if (mode === 'hover') {
    const k = Math.min(1, (num(speed) - HOVER_SPEED) / 6)                  // eases in over 6 units/s so crossing 10 does not pop
    return { mode, y: (HOVER.lift + Math.sin(T * Math.PI * 2 * HOVER.freq) * HOVER.amp) * k, roll: 0, lean: HOVER.lean * k, squash: Math.sin(T * Math.PI * 2 * HOVER.freq) * 0.03 * k }
  }
  const ph = D * WALK.freq * Math.PI * 2
  return { mode, y: Math.abs(Math.sin(ph)) * WALK.amp, roll: Math.sin(ph) * WALK.roll, lean: 0.08, squash: -Math.abs(Math.sin(ph)) * 0.04 }
}

export default { HOVER_SPEED, modeOf, gaitAt }
