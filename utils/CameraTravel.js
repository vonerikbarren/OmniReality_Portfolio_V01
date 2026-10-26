/**
 * utils/CameraTravel.js — the real "Take Me There" camera-move
 *
 * Extracted from `OmniInspector.js`'s own `_goToObject()` — pulled
 * out specifically so `ToolTipMenu.js`'s new in-scene QuickActionMenu
 * can trigger the exact same, already-tested move instead of a
 * second, duplicate implementation. OmniInspector now calls this
 * too, rather than keeping its own inline copy.
 *
 * Includes the real, previously-fixed bug this method already
 * carries: OrbitControls must be disabled before the tween, or its
 * own per-frame camera writes fight this one's direct writes,
 * producing an unpredictable final position.
 */

import * as THREE from 'three'
import gsap from 'gsap'
import { getSettings } from './CameraTravelSettings.js'

export function goToObject (ctx, mesh) {
  if (!mesh) return
  const objectPos = mesh.getWorldPosition(new THREE.Vector3())
  const camera = ctx.camera

  const away = camera.position.clone().sub(objectPos)
  if (away.lengthSq() < 0.0001) away.set(0, 0, 1)
  away.normalize()

  const scale = mesh.scale
  const standoff = 2.5 + Math.max(scale.x, scale.y, scale.z)
  const target = objectPos.clone().add(away.multiplyScalar(standoff))

  window.dispatchEvent(new CustomEvent('omni:orbit-disable', { detail: {} }))

  const { duration, ease } = getSettings()
  gsap.to(camera.position, {
    x: target.x, y: target.y, z: target.z, duration, ease,
    onUpdate: () => camera.lookAt(objectPos),
    onComplete: () => {
      // Real fix — this used to leave the orbit pivot stale at
      // wherever it was before the travel, disconnected from where
      // the camera actually ended up. Reuses the same, already-proven
      // omni:orbit-target-set mechanism WASD-rotate-around already
      // uses, rather than a second, separate way of setting the pivot.
      window.dispatchEvent(new CustomEvent('omni:orbit-target-set', { detail: { x: objectPos.x, y: objectPos.y, z: objectPos.z } }))
      window.dispatchEvent(new CustomEvent('omni:orbit-enable', { detail: {} }))
    },
  })
}
