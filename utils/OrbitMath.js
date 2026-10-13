/**
 * utils/OrbitMath.js — ⟐OrbitMath (V192)
 *
 * Pure vector math for the movement pads' orbit buttons (ORB-L / ORB-R / ORB-U / ORB-D). No scene, no DOM.
 *
 * The camera is described by three vectors: its `position`, the `target` it orbits and an `up` vector (the
 * camera's own up, perpendicular to the view direction). OrbitControls assumes up is always world +Y, which
 * is why a vertical orbit that clamps (V191: +-85 degrees) could never pass over a pole. These functions
 * carry `up` along with the rotation instead, so the orbit is one continuous 360 degree loop:
 *
 *   orbitYaw(position, up, target, angle)    turn about the VERTICAL axis through the target (target y included).
 *   orbitPitch(position, up, target, angle)  turn about the camera's own RIGHT axis through the target, over the
 *                                            top and under the bottom, with no clamp and no gimbal flip.
 *   levelUpStep(up, forward, maxStep)        roll `up` about the view direction toward world +Y (the settle after release).
 *
 * Conventions: angle > 0 for orbitYaw = the camera moves to the viewer's left of the target (ORB-L, as in V191); angle > 0 for orbitPitch = the camera rises over the target (ORB-U). Every
 * function mutates the vectors it is given and returns a small result object. The distance to the target is
 * never changed (rotations only). `up` stays a unit vector perpendicular to the view direction (re-orthogonalised
 * after each step so float drift cannot accumulate).
 */
import * as THREE from 'three'

const WORLD_UP = new THREE.Vector3(0, 1, 0)
const _f = new THREE.Vector3()
const _r = new THREE.Vector3()
const _o = new THREE.Vector3()
const _t = new THREE.Vector3()
const _c = new THREE.Vector3()

export const LEVEL_EPS = 1e-4   // |up - (0,1,0)| below this counts as level

/** Unit view direction from `position` to `target` into `out`; returns the distance. */
export function viewForward (position, target, out = new THREE.Vector3()) {
  out.subVectors(target, position)
  const d = out.length()
  if (d > 0) out.multiplyScalar(1 / d)
  return d
}

/** Make `up` unit length and perpendicular to `forward`. If it is (nearly) parallel to `forward` it falls back to
 *  `fallback` (default world up) and then to any perpendicular. Mutates and returns `up`. */
export function orthonormalizeUp (up, forward, fallback = WORLD_UP) {
  up.addScaledVector(forward, -up.dot(forward))
  if (up.lengthSq() < 1e-8) {
    up.copy(fallback).addScaledVector(forward, -fallback.dot(forward))
    if (up.lengthSq() < 1e-8) {
      up.set(1, 0, 0).addScaledVector(forward, -forward.x)
      if (up.lengthSq() < 1e-8) up.set(0, 0, 1).addScaledVector(forward, -forward.z)
    }
  }
  return up.normalize()
}

/** True when `up` is world +Y (within eps). */
export function isLevel (up, eps = LEVEL_EPS) {
  return up.distanceToSquared(WORLD_UP) < eps * eps
}

/** Turn the camera about the vertical axis through `target` (its y included). Direction stays consistent on
 *  screen when the view is upside down (the axis flips with the sign of up.y). Rotates `up` with it. */
export function orbitYaw (position, up, target, angle) {
  if (!angle) return false
  _o.subVectors(position, target)
  if (_o.lengthSq() < 1e-12) return false
  _t.set(0, up.y < 0 ? -1 : 1, 0)
  _o.applyAxisAngle(_t, -angle)    // the V191 ORB-L sign: angle > 0 turns the camera to the viewer's left (a turn of -angle about +Y)
  up.applyAxisAngle(_t, -angle)
  position.copy(target).add(_o)
  viewForward(position, target, _f)
  orthonormalizeUp(up, _f)
  return true
}

/** Orbit over the top / under the bottom: rotate about the camera's right axis through `target`. */
export function orbitPitch (position, up, target, angle) {
  if (!angle) return false
  _o.subVectors(position, target)
  if (_o.lengthSq() < 1e-12) return false
  viewForward(position, target, _f)
  orthonormalizeUp(up, _f)
  _r.crossVectors(_f, up).normalize()          // the camera's right axis
  // offset = -forward*d; rotating it about +right by +a moves it DOWN (right x offset = -up), so use -angle to rise.
  _o.applyAxisAngle(_r, -angle)
  up.applyAxisAngle(_r, -angle)
  position.copy(target).add(_o)
  viewForward(position, target, _f)
  orthonormalizeUp(up, _f)
  return true
}

/** Roll `up` about the (fixed) view direction `forward` toward world +Y by at most `maxStep` radians.
 *  Returns { done, degenerate, remaining }: `done` when level within eps after the step; `degenerate` when looking
 *  straight along Y (no horizon to roll toward) -> `up` is left alone. Mutates `up`. */
export function levelUpStep (up, forward, maxStep) {
  orthonormalizeUp(up, forward)
  _t.copy(WORLD_UP).addScaledVector(forward, -WORLD_UP.dot(forward))
  if (_t.lengthSq() < 1e-6) return { done: false, degenerate: true, remaining: NaN }
  _t.normalize()
  _c.crossVectors(up, _t)
  const angle = Math.atan2(_c.dot(forward), up.dot(_t))   // right-handed angle about `forward` from up to the horizon-up
  const mag = Math.abs(angle)
  if (mag < 1e-5) { up.copy(_t); return { done: true, degenerate: false, remaining: 0 } }
  const step = Math.min(mag, Math.max(0, maxStep))
  if (step >= mag) { up.copy(_t); return { done: true, degenerate: false, remaining: 0 } }
  up.applyAxisAngle(forward, Math.sign(angle) * step)
  orthonormalizeUp(up, forward)
  return { done: false, degenerate: false, remaining: mag - step }
}

/** Settle step size: exponential ease with a floor so it always finishes (rad). */
export function settleStep (remaining, delta, rate = 7, floor = 0.9) {
  const r = Number.isFinite(remaining) ? remaining : 0
  return Math.max(r * (1 - Math.exp(-rate * delta)), floor * delta)
}
