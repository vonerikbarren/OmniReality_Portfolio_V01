/**
 * utils/StepMarker.js — real px/py/pz user movement-speed tracking
 *
 * Confirmed directly: tracks the user's own actual per-axis velocity
 * frame to frame — not tied to any specific animation or footstep
 * sound, just the camera's real position delta over real time.
 * Built fresh (no prior version found in this codebase or past
 * chats to reuse), following the same plain-singleton pattern
 * already proven in utils/PrimaryTime.js.
 */

let lastPosition = null
let velocity = { x: 0, y: 0, z: 0 }
let speed = 0

/** Call once per real frame, with the camera and the real delta —
 *  same driving pattern PrimaryTime.advance() already uses. */
export function update (camera, delta) {
  if (!lastPosition) {
    lastPosition = camera.position.clone()
    return
  }
  if (delta > 0) {
    velocity = {
      x: (camera.position.x - lastPosition.x) / delta,
      y: (camera.position.y - lastPosition.y) / delta,
      z: (camera.position.z - lastPosition.z) / delta,
    }
    speed = Math.sqrt(velocity.x ** 2 + velocity.y ** 2 + velocity.z ** 2)
  }
  lastPosition.copy(camera.position)
}

export function getVelocity () { return velocity }
export function getSpeed () { return speed }
