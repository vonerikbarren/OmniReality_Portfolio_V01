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
import VoidBoundary      from './modules/VoidBoundary.js'
import WallpaperSphere   from './modules/WallpaperSphere.js'
import UserSpaceSphere   from './modules/UserSpaceSphere.js'

// ── Phase 3 — UI Shell ────────────────────────────────────
import UI                from './ui/index.js'
import MovementPad       from './ui/MovementPad.js'

// ── Phase 4 — Core Systems ────────────────────────────────
import OmniNode          from './systems/OmniNode.js'
import OmniInspector     from './systems/OmniInspector.js'
import OmniPresenter     from './systems/OmniPresenter.js'
import OmniPocket        from './systems/OmniPocket.js'
import NodeManager       from './systems/NodeManager.js'
import EventTestIndicators from './systems/EventTestIndicators.js'
import PocketCubes       from './systems/PocketCubes.js'

// ── Phase 5 — Data Layer ──────────────────────────────────
import NodeLoader        from './data/NodeLoader.js'

// ── Phase 6 — Portfolio ───────────────────────────────────
// Portfolio2D removed — the sphere-spawn approach (24 spheres × 4 zones
// each, with per-frame raycasting/billboarding in update()) was too
// expensive on FPS/memory. Rebuilding the ⟐Portfolio button flow from
// scratch with a different approach.
import Portfolio3D       from './modules/Portfolio3D.js'
import PortfolioXD       from './modules/PortfolioXD.js'

// ── Sound ─────────────────────────────────────────────────
import SoundManager      from './utils/SoundManager.js'
import MiniMap           from './ui/MiniMap.js'
import TreeView          from './ui/TreeView.js'
import RadialMenu from './ui/RadialMenu.js'
import ObjectPanel       from './ui/ObjectPanel.js'
import AdminPanel        from './ui/AdminPanel.js'
import * as ThemeManager from './ui/ThemeManager.js'



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
                   base.addModule(new VoidBoundary(base.context))
                   base.addModule(new WallpaperSphere(base.context))
                   base.addModule(new UserSpaceSphere(base.context))

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
  base.addModule(new EventTestIndicators(base.context))
  base.addModule(new PocketCubes(base.context))

  // ── Phase 6 — Portfolio (deferred — spawn on nav-select) ─
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

  const objectPanel = new ObjectPanel(base.context)
  base.addModule(objectPanel)

  const adminPanel = new AdminPanel(base.context)
  base.addModule(adminPanel)

  ThemeManager.initTheme()

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

  // ── 'c' — return to landing point coordinates ─────────────
  // Matches the exact resting pose playEntryAnimation() ends on: position
  // (0, 2, 0.001), levelled off looking down -Z (lookAt (0, 2, -1)).
  function returnToLanding () {
    const cam = base.camera
    orbitMod.disable()
    gsap.to(cam.position, {
      x: 0, y: 2, z: 0.001,
      duration: 1.2,
      ease: 'power2.inOut',
      onUpdate: () => cam.lookAt(0, 2, -1),
      onComplete: () => {
        cam.lookAt(0, 2, -1)
        _syncOrbitTarget()
        orbitMod.enable()
      }
    })
  }

  window.addEventListener('keydown', (e) => {
    if (e.code !== 'KeyC' || e.repeat) return
    const active = document.activeElement
    const isTyping = active && (
      active.tagName === 'INPUT' ||
      active.tagName === 'TEXTAREA' ||
      active.isContentEditable
    )
    if (isTyping) return
    returnToLanding()
  })

  // ── Key commands — hand menus ─────────────────────────────
  // Clicking the real hand-cell button (rather than dispatching events
  // ourselves) means every existing behavior — active-state tracking,
  // click sound, the omni:hamburger / omni:radial-toggle payloads —
  // stays exactly as it is for a mouse click. No logic duplicated here.
  //
  //   Shift (left)  → ⟐LH Tool menu   (.omni-hand--bl radial button)
  //   Shift (right) → ⟐RH Tool menu   (.omni-hand--br radial button)
  //   1 / Numpad1   → ⟐mniHand menu   (.omni-hand--tl hamburger button — top-left)
  //   2 / Numpad2   → ⟐ConsciousHand menu (.omni-hand--tr hamburger button — top-right)
  //   3 / Numpad3   → ⟐mniHand Tool menu       (.omni-hand--tl radial button)
  //   4 / Numpad4   → ⟐ConsciousHand Tool menu (.omni-hand--tr radial button)
  const HAND_KEY_BINDINGS = [
    { codes: ['ShiftLeft'],              selector: '.omni-hand--bl .hand-cell--radial'    },
    { codes: ['ShiftRight'],             selector: '.omni-hand--br .hand-cell--radial'    },
    { codes: ['Digit1', 'Numpad1'],      selector: '.omni-hand--tl .hand-cell--hamburger' },
    { codes: ['Digit2', 'Numpad2'],      selector: '.omni-hand--tr .hand-cell--hamburger' },
    { codes: ['Digit3', 'Numpad3'],      selector: '.omni-hand--tl .hand-cell--radial'    },
    { codes: ['Digit4', 'Numpad4'],      selector: '.omni-hand--tr .hand-cell--radial'    },
  ]

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return   // don't re-trigger while a key is held

    // Don't hijack Shift/1/2 while the person is typing in a text field
    // (e.g. the Object Panel's text inputs, node label editing, etc).
    const active = document.activeElement
    const isTyping = active && (
      active.tagName === 'INPUT' ||
      active.tagName === 'TEXTAREA' ||
      active.isContentEditable
    )
    if (isTyping) return

    const binding = HAND_KEY_BINDINGS.find(b => b.codes.includes(e.code))
    if (!binding) return

    const btn = document.querySelector(binding.selector)
    if (btn && !btn.disabled) btn.click()
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
    const bar = document.getElementById('boot-progress-bar')
    if (bar) {
      bar.classList.add('is-complete')
      bar.style.width = '100%'
    }
    boot.classList.add('fade-out')
    boot.addEventListener('transitionend', () => boot.remove(), { once: true })
  }

  // ── Start ─────────────────────────────────────────────────
  base.start()
  playEntryAnimation()

})()