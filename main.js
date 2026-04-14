/**
 * main.js — ⟐mniReality entry point
 */
import * as THREE from 'three'
import gsap             from 'gsap'
import BaseScene        from './scene/BaseScene.js'

// ── Phase 2 — Root Space ──────────────────────────────────
import OrbitModule      from './modules/OrbitModule.js'
import RootSpace        from './modules/RootSpace.js'
import ParticleField    from './modules/ParticleField.js'
import PortalSpheres    from './modules/PortalSpheres.js'
import OmniPlatform     from './modules/OmniPlatform.js'
import TerminalTunnel   from './modules/TerminalTunnel.js'

// ── Phase 3 — UI Shell ────────────────────────────────────
import UI               from './ui/index.js'

// ── Phase 4 — Core Systems ────────────────────────────────
import OmniNode         from './systems/OmniNode.js'
import OmniInspector    from './systems/OmniInspector.js'
import OmniPresenter    from './systems/OmniPresenter.js'
import OmniPocket       from './systems/OmniPocket.js'
import NodeManager      from './systems/NodeManager.js'

// ── Phase 5 — Data Layer ──────────────────────────────────
import NodeLoader       from './data/NodeLoader.js'

// ── Phase 6 — Portfolio ───────────────────────────────────
import Portfolio2D      from './modules/Portfolio2D.js'
import Portfolio3D      from './modules/Portfolio3D.js'
import PortfolioXD      from './modules/PortfolioXD.js'


import MovementPad from './ui/MovementPad.js'

// ── Boot ──────────────────────────────────────────────────

const base = new BaseScene('#omni-canvas')

// ── Register modules ──────────────────────────────────────

const orbitMod     = base.addModule(new OrbitModule(base.context))
                     base.addModule(new RootSpace(base.context))
                     base.addModule(new ParticleField(base.context))
                     base.addModule(new PortalSpheres(base.context))
                     base.addModule(new OmniPlatform(base.context))
                     base.addModule(new TerminalTunnel(base.context))

// ── Core systems ──────────────────────────────────────────

const nodeManager  = new NodeManager(base.context)
const omniNode     = new OmniNode(base.context)
const omniInspector = new OmniInspector(base.context)
const omniPresenter = new OmniPresenter(base.context)
const omniPocket   = new OmniPocket(base.context)
const nodeLoader   = new NodeLoader(base.context)

nodeManager.setOrbitModule(orbitMod)

base.addModule(nodeManager)
base.addModule(omniNode)
base.addModule(omniInspector)
base.addModule(omniPresenter)
base.addModule(omniPocket)
base.addModule(nodeLoader)

// ── Portfolio modules (deferred — spawn on nav-select) ────

base.addModule(new Portfolio2D(base.context))
base.addModule(new Portfolio3D(base.context))
base.addModule(new PortfolioXD(base.context))

// ── UI Shell ──────────────────────────────────────────────

const ui = new UI(base.context)
ui.init()
base.addModule(ui) 

const movementPad = new MovementPad(base.context)
movementPad.init()
movementPad.setVisible('lh', true)    // enables WASD
movementPad.setVisible('rh', true)    // enables Arrow keys (optional)
base.addModule(movementPad)

// ── Camera entry animation ────────────────────────────────

const CAM_ENTRY = {
  startY:   80,
  endY:     2,
  duration: 2.6,
  ease:     'power2.inOut',
}

function playEntryAnimation() {
  const cam = base.camera

  cam.position.set(0, CAM_ENTRY.startY, 0)
  cam.lookAt(0, CAM_ENTRY.startY, -1)

  gsap.to(cam.position, {
    y:        CAM_ENTRY.endY,
    duration: CAM_ENTRY.duration,
    ease:     CAM_ENTRY.ease,
    onUpdate: () => {
      cam.lookAt(cam.position.x, cam.position.y, cam.position.z - 1)
    },
    onComplete: () => {
      dismissBoot()
      orbitMod.enable()
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

// ── Keyboard shortcuts ────────────────────────────────────

// Track all pressed directions — re-enable orbit only when ALL keys are up
const _heldDirections = new Set()

window.addEventListener('omni:movement', (e) => {
  const key = `${e.detail.hand}-${e.detail.direction}`

  if (e.detail.active) {
    _heldDirections.add(key)
    orbitMod.disable()
  } else {
    _heldDirections.delete(key)

    // Only re-enable when every key is fully released
    if (_heldDirections.size === 0) {
      const cam = base.camera
      const forward = new THREE.Vector3()
      cam.getWorldDirection(forward)
      orbitMod.controls.target.copy(
        cam.position.clone().add(forward.multiplyScalar(4))
      )
      orbitMod.controls.update()
      orbitMod.enable()
    }
  }
})


window.addEventListener('keydown', (e) => {
  if (e.key === '`' || e.key === 'F1') {
    window.dispatchEvent(new CustomEvent('omni:terminal-invoke'))
  }
  if (e.key === 'Escape') {
    window.dispatchEvent(new CustomEvent('omni:terminal-dismiss'))
  }
})


// ── R / F — vertical movement (Y axis) ───────────────────
const _vertPressed = { r: false, f: false }
const VERTICAL_SPEED = 20   // units/second — matches MOVE_SPEED in MovementPad

window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyR') { _vertPressed.r = true;  orbitMod.disable() }
  if (e.code === 'KeyF') { _vertPressed.f = true;  orbitMod.disable() }
})

window.addEventListener('keyup', (e) => {
  if (e.code === 'KeyR') _vertPressed.r = false
  if (e.code === 'KeyF') _vertPressed.f = false

  // Re-enable orbit only when R, F, AND all WASD are released
  if (!_vertPressed.r && !_vertPressed.f && _heldDirections.size === 0) {
    const cam = base.camera
    const forward = new THREE.Vector3()
    cam.getWorldDirection(forward)
    orbitMod.controls.target.copy(
      cam.position.clone().add(forward.multiplyScalar(4))
    )
    orbitMod.controls.update()
    orbitMod.enable()
  }
})

// Add vertical tick to the render loop via a lightweight module
base.addModule({
  update (delta) {
    if (!_vertPressed.r && !_vertPressed.f) return
    const cam = base.camera
    const speed = VERTICAL_SPEED * delta
    if (_vertPressed.r) cam.position.y += speed
    if (_vertPressed.f) cam.position.y -= speed
  },
  destroy () {}
})

// window.addEventListener('omni:movement', (e) => {
//   if (e.detail.active) {
//     orbitMod.disable()
//   } else {
//     // Sync orbit target to current camera position + forward direction
//     // so re-enabling doesn't snap back to the old origin
//     const cam = base.camera
//     const forward = new THREE.Vector3()
//     cam.getWorldDirection(forward)
//     orbitMod.controls.target.copy(
//       cam.position.clone().add(forward.multiplyScalar(4))
//     )
//     orbitMod.controls.update()
//     orbitMod.enable()
//   }
// })


// ── Start ─────────────────────────────────────────────────

base.start()
playEntryAnimation()