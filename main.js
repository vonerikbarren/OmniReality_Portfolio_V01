/**
 * main.js — ⟐mniReality entry point
 */

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

const movementPad = new MovementPad(base.context)
movementPad.init()
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

window.addEventListener('omni:movement', (e) => {
  if (e.detail.active) {
    orbitMod.disable()
  } else {
    // Only re-enable if no direction is still held
    orbitMod.enable()
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


// ── Start ─────────────────────────────────────────────────

base.start()
playEntryAnimation()