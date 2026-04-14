/**
 * main.js — ⟐mniReality entry point
 *
 * Boots the BaseScene, registers modules, and plays
 * the camera entry animation on load.
 *
 * Entry animation:
 *   Camera begins high above the Root (Y+) facing forward.
 *   It descends downward into the space over ~2.4s.
 *   No tilt — forward look is held throughout. The feeling
 *   is arrival, not falling.
 *
 * Adding a new module = one import + one addModule() call.
 * BaseScene never changes.
 */

import gsap      from 'gsap'
import BaseScene from './scene/BaseScene.js'

// ── Boot ──────────────────────────────────────────────────

const base = new BaseScene('#omni-canvas')

// ── Register modules (Phase 2+) ───────────────────────────
//
// Example (uncomment in Phase 2):
//   import OrbitModule   from './modules/OrbitModule.js'
//   import RootSpace     from './modules/RootSpace.js'
//   base.addModule(new OrbitModule(base.context))
//   base.addModule(new RootSpace(base.context))
//
// Phase 1 ships without content modules — the engine alone.

// ── Camera entry animation ────────────────────────────────

const CAM_ENTRY = {
  startY:    80,      // height above the Root to begin
  endY:      2,       // resting eye-level height
  startZ:    0,
  endZ:      0,
  duration:  2.6,     // seconds
  ease:      'power2.inOut',
}

function playEntryAnimation() {
  const cam = base.camera

  // Place camera at entry position — above, facing forward (−Z axis)
  cam.position.set(0, CAM_ENTRY.startY, CAM_ENTRY.startZ)
  cam.lookAt(0, CAM_ENTRY.startY, -1)   // flat forward, no tilt

  // Descend
  gsap.to(cam.position, {
    y:        CAM_ENTRY.endY,
    z:        CAM_ENTRY.endZ,
    duration: CAM_ENTRY.duration,
    ease:     CAM_ENTRY.ease,
    onUpdate: () => {
      // Keep camera always looking straight forward regardless of Y position
      cam.lookAt(cam.position.x, cam.position.y, cam.position.z - 1)
    },
    onComplete: () => {
      dismissBoot()
    },
  })
}

// ── Boot screen dismissal ─────────────────────────────────

function dismissBoot() {
  const boot = document.getElementById('omni-boot')
  if (!boot) return
  boot.classList.add('fade-out')
  boot.addEventListener('transitionend', () => boot.remove(), { once: true })
}

// ── Start ─────────────────────────────────────────────────

base.start()
playEntryAnimation()
