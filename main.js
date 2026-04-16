/**
 * main.js — ⟐mniReality entry point
 *
 * Boots the BaseScene, registers all modules across all six phases,
 * wires the UI shell, sound system, and camera controls.
 */

import gsap              from 'gsap'
import * as THREE        from 'three'
import BaseScene         from './scene/BaseScene.js'

// ── Phase 2 — Root Space ──────────────────────────────────
import OrbitModule       from './modules/OrbitModule.js'
import RootSpace         from './modules/RootSpace.js'
import ParticleField     from './modules/ParticleField.js'
import PortalSpheres     from './modules/PortalSpheres.js'
import OmniPlatform      from './modules/OmniPlatform.js'
import TerminalTunnel    from './modules/TerminalTunnel.js'

// ── Phase 3 — UI Shell ────────────────────────────────────
import UI                from './ui/index.js'
import MovementPad       from './ui/MovementPad.js'

// ── Phase 4 — Core Systems ────────────────────────────────
import OmniNode          from './systems/OmniNode.js'
import OmniInspector     from './systems/OmniInspector.js'
import OmniPresenter     from './systems/OmniPresenter.js'
import OmniPocket        from './systems/OmniPocket.js'
import NodeManager       from './systems/NodeManager.js'

// ── Phase 5 — Data Layer ──────────────────────────────────
import NodeLoader        from './data/NodeLoader.js'

// ── Phase 6 — Portfolio ───────────────────────────────────
import Portfolio2D       from './modules/Portfolio2D.js'
import Portfolio3D       from './modules/Portfolio3D.js'
import PortfolioXD       from './modules/PortfolioXD.js'

// ── Sound ─────────────────────────────────────────────────
import SoundManager      from './utils/SoundManager.js'
import MiniMap           from './ui/MiniMap.js'
import TreeView          from './ui/TreeView.js'
import RadialMenu from './ui/RadialMenu.js'



// ─────────────────────────────────────────────────────────
// Everything runs inside an async IIFE so we can await Sound.load()
// ─────────────────────────────────────────────────────────

;(async () => {

  // ── Base scene ──────────────────────────────────────────
  const base = new BaseScene('#omni-canvas')

  // ── Phase 2 modules ─────────────────────────────────────
  const orbitMod = base.addModule(new OrbitModule(base.context))
                   base.addModule(new RootSpace(base.context))
                   base.addModule(new ParticleField(base.context))
                   base.addModule(new PortalSpheres(base.context))
                   base.addModule(new OmniPlatform(base.context))
                   base.addModule(new TerminalTunnel(base.context))

  // ── Phase 4 — Core systems ───────────────────────────────
  const nodeManager   = new NodeManager(base.context)
  const omniNode      = new OmniNode(base.context)
  const omniInspector = new OmniInspector(base.context)
  const omniPresenter = new OmniPresenter(base.context)
  const omniPocket    = new OmniPocket(base.context)
  const nodeLoader    = new NodeLoader(base.context)

  nodeManager.setOrbitModule(orbitMod)

  base.addModule(nodeManager)
  base.addModule(omniNode)
  base.addModule(omniInspector)
  base.addModule(omniPresenter)
  base.addModule(omniPocket)
  base.addModule(nodeLoader)

  // ── Phase 6 — Portfolio (deferred — spawn on nav-select) ─
  base.addModule(new Portfolio2D(base.context))
  base.addModule(new Portfolio3D(base.context))
  base.addModule(new PortfolioXD(base.context))

  // ── Phase 3 — UI shell ───────────────────────────────────
  const ui = new UI(base.context)
  ui.init()
  base.addModule(ui)

  // ── Movement pad ─────────────────────────────────────────
  const movementPad = new MovementPad(base.context)
  movementPad.init()
  movementPad.setVisible('lh', true)
  movementPad.setVisible('rh', true)
  base.addModule(movementPad)

  // ── Orbit ↔ WASD handoff ─────────────────────────────────
  // Tracks every held direction key — only re-enables orbit
  // when ALL directions (including R/F) are fully released.
  const _heldDirections = new Set()

  const _syncOrbitTarget = () => {
    const cam = base.camera
    const forward = new THREE.Vector3()
    cam.getWorldDirection(forward)
    orbitMod.controls.target.copy(
      cam.position.clone().add(forward.multiplyScalar(4))
    )
    orbitMod.controls.update()
  }

  // after ui.init() inside the async IIFE
  const miniMap = new MiniMap(base.context)
  miniMap.init()
  base.addModule(miniMap)

  const treeView = new TreeView(base.context)
  treeView.init()
  base.addModule(treeView)

  const radialMenu = new RadialMenu(base.context)
  radialMenu.init()
  base.addModule(radialMenu)

  window.addEventListener('omni:movement', (e) => {
    const key = `${e.detail.hand}-${e.detail.direction}`
    if (e.detail.active) {
      _heldDirections.add(key)
      orbitMod.disable()
    } else {
      _heldDirections.delete(key)
      if (_heldDirections.size === 0) {
        _syncOrbitTarget()
        orbitMod.enable()
      }
    }
  })

  // ── R / F — vertical movement (Y axis) ───────────────────
  const VERTICAL_SPEED = 20
  const _vertPressed   = { r: false, f: false }

  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyR') { _vertPressed.r = true;  orbitMod.disable() }
    if (e.code === 'KeyF') { _vertPressed.f = true;  orbitMod.disable() }
  })

  window.addEventListener('keyup', (e) => {
    if (e.code === 'KeyR') _vertPressed.r = false
    if (e.code === 'KeyF') _vertPressed.f = false

    if (!_vertPressed.r && !_vertPressed.f && _heldDirections.size === 0) {
      _syncOrbitTarget()
      orbitMod.enable()
    }
  })

  base.addModule({
    update (delta) {
      if (!_vertPressed.r && !_vertPressed.f) return
      const speed = VERTICAL_SPEED * delta
      if (_vertPressed.r) base.camera.position.y += speed
      if (_vertPressed.f) base.camera.position.y -= speed
    },
    destroy () {}
  })

  // ── Sound ─────────────────────────────────────────────────
  const Sound = new SoundManager(
    {
      sounds: {
        click: './assets/sounds/click.wav',
        open:  './assets/sounds/open.wav',
        close: './assets/sounds/close.wav',
      }
    }
  )
  await Sound.load()

  

  // Single delegated listener on the UI shell — fires on every
  // click except drawer items.
  document.getElementById('omni-ui')?.addEventListener('click', (e) => {
    let el = e.target
    while (el && el.id !== 'omni-ui') {
      if (
        el.classList.contains('omni-drawer__item') ||
        el.classList.contains('omni-drawer')
      ) return
      el = el.parentElement
    }
    Sound.play('click')
  })

  // ── Keyboard shortcuts ────────────────────────────────────
  window.addEventListener('keydown', (e) => {
    if (e.key === '`' || e.key === 'F1') {
      window.dispatchEvent(new CustomEvent('omni:terminal-invoke'))
    }
    if (e.key === 'Escape') {
      window.dispatchEvent(new CustomEvent('omni:terminal-dismiss'))
    }
  })

  // ── Portal activation log ─────────────────────────────────
  window.addEventListener('omni:portal-activated', (e) => {
    console.log(`⟐ Portal activated → ${e.detail.label} (${e.detail.id})`)
  })

  // ── Camera entry animation ────────────────────────────────
  const CAM_ENTRY = {
    startY:   80,
    endY:     2,
    duration: 2.6,
    ease:     'power2.inOut',
  }

  function playEntryAnimation() {
    const cam = base.camera

    cam.position.set(0, 1000, 0.001)
    cam.lookAt(0, 0, 0)

    // Dismiss boot screen immediately — reveal the scene
    // so the user actually sees the fall happen
    dismissBoot()

    const tl = gsap.timeline({
      onComplete: () => {
        orbitMod.enable()
      }
    })

    // Phase 1 — fast fall, looking down
    tl.to(cam.position, {
      y:        22,
      duration: 4.6,
      ease:     'power2.in',
      onUpdate: () => {
        const lookY = cam.position.y - 40
        cam.lookAt(0, lookY, 0)
      }
    })

    // Phase 2 — slow final approach, straighten up
    tl.to(cam.position, {
      y:        2,
      duration: 2.2,
      ease:     'power3.out',
      onUpdate: () => {
        const t     = 1 - (cam.position.y - 2) / 20
        const lookY = gsap.utils.interpolate(-18, 2, t)
        cam.lookAt(0, lookY, -1)
      }
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

})()