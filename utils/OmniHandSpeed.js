/**
 * utils/OmniHandSpeed.js — the EASED per-hand speed multiplier (V165).
 *
 * The ⟫ Speed satellite's slider writes the TARGET speed (1..25x) into
 * utils/OmniHandsSettings.js (`speed`). Systems never read that raw target: they read
 * getEffectiveSpeed(hand), which eases toward it so a slider drag (or a preset chip)
 * never makes movement jump. ui/MovementPad.js calls stepSpeeds(dt) once per frame.
 *
 * Easing is exponential smoothing with time constant TAU (~0.15 s): after dt,
 *     eff += (target - eff) * (1 - exp(-dt / TAU))
 * which is frame-rate independent and never overshoots (the critically-damped limit
 * for a first-order follower). Within SNAP of the target it lands exactly on it.
 *
 * Consumers (each applies the value ONCE, never compounded):
 *   lh         MovementPad._applyTranslateMovement  translate speed
 *   rh         MovementPad._applyNavMovement        altitude + orbit/yaw speed
 *   conscious  OmniAxinator._travelDur/_relDur      tween duration = base / speed
 *   omnihand   MovementPad hold-to-repeat           interval = base / speed (>= MIN_REPEAT_MS)
 */

import { getHandSetting, HAND_IDS } from './OmniHandsSettings.js'

export const TAU = 0.15
export const SNAP = 0.002
export const MIN_REPEAT_MS = 60
export const MAX_SPEED = 25   // V166: was 10

const eff = {}

/** The slider value (target) for a hand, clamped 1..25. */
export function getTargetSpeed (hand) {
  const v = Number(getHandSetting(hand, 'speed'))
  return Number.isFinite(v) ? Math.min(MAX_SPEED, Math.max(1, v)) : 1
}

/** The eased multiplier systems should apply this frame. Starts AT the target. */
export function getEffectiveSpeed (hand) {
  if (!(hand in eff)) eff[hand] = getTargetSpeed(hand)
  return eff[hand]
}

/** Advance every hand's eased value by dt seconds. Returns true if any value moved. */
export function stepSpeeds (dt) {
  if (!(dt > 0)) return false
  const k = 1 - Math.exp(-Math.min(dt, 0.25) / TAU)
  let moved = false
  HAND_IDS.forEach(h => {
    const target = getTargetSpeed(h)
    const cur = getEffectiveSpeed(h)
    if (cur === target) return
    const next = Math.abs(target - cur) < SNAP ? target : cur + (target - cur) * k
    eff[h] = next
    moved = true
  })
  return moved
}

/** Jump the eased value straight to the target (tests / hand reset). */
export function snapSpeed (hand) {
  if (hand) eff[hand] = getTargetSpeed(hand)
  else HAND_IDS.forEach(h => { eff[h] = getTargetSpeed(h) })
}

/** Hold-to-repeat interval for an axis hand: base / speed, never below MIN_REPEAT_MS. */
export function repeatInterval (baseMs, hand) {
  return Math.max(MIN_REPEAT_MS, baseMs / getEffectiveSpeed(hand))
}
