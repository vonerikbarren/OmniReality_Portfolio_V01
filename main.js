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
import OmniDraw          from './ui/OmniDraw.js'
import AdminPanel        from './ui/AdminPanel.js'
import OmniExpression    from './ui/OmniExpression.js'
import OmniExpressionInspector from './ui/OmniExpressionInspector.js'
import OmniKeys          from './ui/OmniKeys.js'
import OmniKeysInspector from './ui/OmniKeysInspector.js'
import OmniSelector      from './ui/OmniSelector.js'
import OmniSelectorInspector from './ui/OmniSelectorInspector.js'
import OmniChronos from './ui/OmniChronos.js'
import OmniInternalPanel from './ui/OmniInternalPanel.js'
import PanelControl from './ui/PanelControl.js'
import OmniInspection from './ui/OmniInspection.js'
import OmniInspectionHUD from './ui/OmniInspectionHUD.js'
import IndexedPanel from './ui/IndexedPanel.js'
import ParticleSettingsPanel from './ui/ParticleSettingsPanel.js'
import WallpaperSettingsPanel from './ui/WallpaperSettingsPanel.js'
import OmniBrowser from './ui/OmniBrowser.js'
import OmniBrowserProperties from './ui/OmniBrowserProperties.js'
import OmniBrowserSpace from './modules/OmniBrowserSpace.js'
import OmniBrowserSpacePanel from './ui/OmniBrowserSpacePanel.js'
import OmniMixerPanel from './ui/OmniMixerPanel.js'
import OrbiterVisual from './ui/OrbiterVisual.js'
import OmniExpressionVideoPlayer from './ui/OmniExpressionVideoPlayer.js'
import OmniStartHUD      from './ui/OmniStartHUD.js'
import * as ThemeManager from './ui/ThemeManager.js'
import InputMonitorPanel from './ui/InputMonitorPanel.js'
import CameraMovementOptionsPanel from './ui/CameraMovementOptionsPanel.js'



// ─────────────────────────────────────────────────────────
// Everything runs inside an async IIFE so we can await Sound.load()
// ─────────────────────────────────────────────────────────

;(async () => {

  // ── Sound ─────────────────────────────────────────────────
  // Must be created and loaded BEFORE `new BaseScene(...)` — its
  // context object is frozen at construction time, so Sound has to be
  // passed in as a constructor argument to end up inside it. Anything
  // reading ctx.Sound afterward would silently get undefined otherwise.
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

  // ── Base scene ──────────────────────────────────────────
  const base = new BaseScene('#omni-canvas', Sound)

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
  movementPad.setVisible('lh', false)
  movementPad.setVisible('rh', false)
  base.addModule(movementPad)

  // Input Monitor — real panel now, accessible from Admin Settings
  const inputMonitorPanel = new InputMonitorPanel(base.context, orbitMod, movementPad)
  base.addModule(inputMonitorPanel)

  // Camera Movement Options — real panel, accessible from Admin Settings
  const cameraMovementOptionsPanel = new CameraMovementOptionsPanel(base.context)
  base.addModule(cameraMovementOptionsPanel)

  // ── Orbit ↔ WASD handoff ─────────────────────────────────
  // Tracks every held direction key — only re-enables orbit
  // when ALL directions (including R/F) are fully released.
  const _heldDirections = new Set()

  // Whether a node-selected rotation pivot is currently active — while
  // true, _syncOrbitTarget below skips its own "4 units in front of
  // camera" reset, so releasing WASD after selecting something doesn't
  // silently snap the orbit target away from what was just selected.
  let _hasSelectedPivot = false
  window.addEventListener('omni:orbit-target-set', (e) => {
    _hasSelectedPivot = true
    orbitMod.controls.target.set(e.detail.x, e.detail.y, e.detail.z)
    orbitMod.controls.update()
  })
  window.addEventListener('omni:node-deselected', () => { _hasSelectedPivot = false })

  const _syncOrbitTarget = () => {
    if (_hasSelectedPivot) return
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

  const omniDraw = new OmniDraw(base.context)
  base.addModule(omniDraw)

  const adminPanel = new AdminPanel(base.context)
  base.addModule(adminPanel)

  const particleSettingsPanel = new ParticleSettingsPanel(base.context)
  base.addModule(particleSettingsPanel)

  const wallpaperSettingsPanel = new WallpaperSettingsPanel(base.context)
  base.addModule(wallpaperSettingsPanel)

  const omniBrowserWindows = [1, 2, 3].map(windowId => {
    const instance = new OmniBrowser(base.context, { windowId })
    base.addModule(instance)
    return instance
  })
  const omniBrowserWindow1 = omniBrowserWindows[0]

  const omniBrowserProperties = new OmniBrowserProperties(base.context)
  base.addModule(omniBrowserProperties)

  // Phase 2 of OmniBrowser — see OMNIBROWSER.md. A performance test
  // cube, active from boot like WallpaperSphere/ParticleField, with
  // its own always-visible on-screen controls (iframe toggles + scale
  // slider) rather than a drawer-triggered panel.
  const omniBrowserSpace = new OmniBrowserSpace(base.context)
  base.addModule(omniBrowserSpace)

  const omniBrowserSpacePanel = new OmniBrowserSpacePanel(base.context)
  base.addModule(omniBrowserSpacePanel)

  const omniMixerPanel = new OmniMixerPanel(base.context)
  base.addModule(omniMixerPanel)

  const orbiterVisual = new OrbiterVisual(base.context)
  base.addModule(orbiterVisual)

  const omniExpression = new OmniExpression(base.context)
  base.addModule(omniExpression)

  const omniExpressionVideoPlayer = new OmniExpressionVideoPlayer(base.context)
  base.addModule(omniExpressionVideoPlayer)

  const omniExpressionInspector = new OmniExpressionInspector(base.context)
  base.addModule(omniExpressionInspector)

  const omniKeys = new OmniKeys(base.context)
  base.addModule(omniKeys)

  const omniKeysInspector = new OmniKeysInspector(base.context)
  base.addModule(omniKeysInspector)

  const omniSelector = new OmniSelector(base.context)
  base.addModule(omniSelector)

  const omniSelectorInspector = new OmniSelectorInspector(base.context)
  base.addModule(omniSelectorInspector)

  const omniChronos = new OmniChronos(base.context)
  base.addModule(omniChronos)

  const omniInternalPanel = new OmniInternalPanel(base.context)
  base.addModule(omniInternalPanel)

  const panelControl = new PanelControl(base.context)
  base.addModule(panelControl)

  const omniInspection = new OmniInspection(base.context)
  base.addModule(omniInspection)

  const omniInspectionHUD = new OmniInspectionHUD(base.context)
  base.addModule(omniInspectionHUD)

  // ── Spaces: real save-a-coordinate / teleport-there system ──
  // An empty slot saves the current camera position there; a saved
  // slot teleports back to it. Deliberately position-only for now
  // (no rotation/orientation saved) — simplest version that's still
  // genuinely useful; can grow into full domains/sub-realities later,
  // per the containerization notes.
  const SPACES_STORE_KEY = 'omni:spaces:coordinates'
  const loadSpacesData = () => {
    try { return JSON.parse(localStorage.getItem(SPACES_STORE_KEY) ?? '{}') } catch (_) { return {} }
  }
  const saveSpacesData = (data) => {
    try { localStorage.setItem(SPACES_STORE_KEY, JSON.stringify(data)) } catch (_) {}
  }
  let spacesPanelRef = null

  const spacesConfig = {
    id: 'spaces', navLabel: '⟐Spaces', title: '⟐Spaces', prefix: 'Space', iconLabel: '⟐S',
    getSlotLabel: (i) => {
      const data = loadSpacesData()
      const padded = String(i).padStart(2, '0')
      return data[i] ? `Space${padded} 📍` : `Space${padded}`
    },
    getSlotAction: (i) => () => {
      const data = loadSpacesData()
      if (data[i]) {
        const coord = data[i]
        gsap.to(base.camera.position, { x: coord.x, y: coord.y, z: coord.z, duration: 0.6, ease: 'power2.inOut' })
      } else {
        data[i] = { x: base.camera.position.x, y: base.camera.position.y, z: base.camera.position.z }
        saveSpacesData(data)
        spacesPanelRef?.refresh()
      }
    },
  }

  // ── Indexed panels — one per non-Omni drawer section ─────
  const indexedPanelConfigs = [
    {
      id: 'admin', navLabel: '⟐Admin', title: '⟐Admin', prefix: 'Admin', iconLabel: '⟐A',
      specialSlots: {
        1: { label: 'OmniAdminSettings', onClick: () => window.dispatchEvent(new CustomEvent('omni:nav-select', { detail: { item: '⟐mniAdminSettings' } })) },
        2: { label: 'OmniParticleSettings', onClick: () => window.dispatchEvent(new CustomEvent('omni:nav-select', { detail: { item: '⟐OmniParticleSettings' } })) },
        3: { label: 'OmniWallpaperSettings', onClick: () => window.dispatchEvent(new CustomEvent('omni:nav-select', { detail: { item: '⟐OmniWallpaperSettings' } })) },
        4: { label: 'OmniInputMonitor', onClick: () => window.dispatchEvent(new CustomEvent('omni:nav-select', { detail: { item: '⟐OmniInputMonitor' } })) },
        5: { label: 'OmniCameraMovementOptions', onClick: () => window.dispatchEvent(new CustomEvent('omni:nav-select', { detail: { item: '⟐CameraMovementOptions' } })) },
      }
    },
    { id: 'experiences',     navLabel: '⟐Experiences',     title: '⟐Experiences',     prefix: 'Experience',     iconLabel: '⟐E' },
    { id: 'realities',       navLabel: '⟐Realities',       title: '⟐Realities',       prefix: 'Reality',        iconLabel: '⟐R' },
    { id: 'times',           navLabel: '⟐Times',           title: '⟐Times',           prefix: 'Time',           iconLabel: '⟐T' },
    spacesConfig,
    { id: 'governance',      navLabel: '⟐Governance',      title: '⟐Governance',      prefix: 'Governance',     iconLabel: '⟐G' },
    { id: 'intelligence',    navLabel: '⟐Intelligence',    title: '⟐Intelligence',    prefix: 'Intelligence',   iconLabel: '⟐I' },
    { id: 'infrastructures', navLabel: '⟐Infrastructures', title: '⟐Infrastructures', prefix: 'Infrastructure', iconLabel: '⟐N' },
    { id: 'objects',         navLabel: '⟐Objects',         title: '⟐Objects',         prefix: 'Object',         iconLabel: '⟐O' },
    {
      id: 'omnibrowser-wrapper', navLabel: '⟐OmniBrowser', title: '⟐OmniBrowser', prefix: 'Browser', iconLabel: '⟐B',
      specialSlots: {
        1: { label: 'Browser Window', onClick: () => window.dispatchEvent(new CustomEvent('omni:nav-select', { detail: { item: '⟐OmniBrowserWindow' } })) },
        2: { label: 'Browser Properties', onClick: () => window.dispatchEvent(new CustomEvent('omni:nav-select', { detail: { item: '⟐OmniBrowserProperties' } })) },
        3: { label: 'OmniBrowserSpace Settings', onClick: () => window.dispatchEvent(new CustomEvent('omni:nav-select', { detail: { item: '⟐OmniBrowserSpaceSettings' } })) },
      }
    },
    {
      id: 'omniexpression-wrapper', navLabel: '⟐OmniExpression', title: '⟐OmniExpression', prefix: 'Expression', iconLabel: '⟐X',
      specialSlots: {
        1: { label: 'Presenter', onClick: () => window.dispatchEvent(new CustomEvent('omni:nav-select', { detail: { item: '⟐OmniExpressionPresenter' } })) },
        2: { label: 'UserPresenterVideoSettings', onClick: () => window.dispatchEvent(new CustomEvent('omni:nav-select', { detail: { item: '⟐UserPresenterVideoSettings' } })) },
      }
    },
  ]
  indexedPanelConfigs.forEach(cfg => {
    const instance = new IndexedPanel(base.context, cfg)
    base.addModule(instance)
    if (cfg.id === 'spaces') spacesPanelRef = instance
  })

  // ── Right-drawer (NavMenu) leaf panels ───────────────────
  // Rule: if a node has no subpage beneath it, it gets its own panel.
  // A parent WITH children (Account, About, Portfolio, SocialNetworks,
  // OmniChannels) does not get one itself — only its leaf children do.
  // 8 slots each, per explicit request (vs. 20 on the left). Wider
  // than the standard IndexedPanel width, since these may eventually
  // hold mini-webpage-like content — see NAV_PANELS_DESIGN.md for what
  // that evolution actually looks like; this pass is the panels
  // themselves, not that.
  const NAV_PANEL_WIDTH = '440px'
  const navPanelConfigs = [
    // Top-level leaves
    { id: 'nav-home',     navLabel: '⟐Home',     title: 'Home',     prefix: 'Home' },
    { id: 'nav-work',     navLabel: '⟐Work',     title: 'Work',     prefix: 'Work' },
    { id: 'nav-products', navLabel: '⟐Products', title: 'Products', prefix: 'Product' },
    { id: 'nav-services', navLabel: '⟐Services', title: 'Services', prefix: 'Service' },
    { id: 'nav-resources',navLabel: '⟐Resources',title: 'Resources',prefix: 'Resource' },
    { id: 'nav-contact',  navLabel: '⟐Contact',  title: 'Contact',  prefix: 'Contact' },
    // Account children
    { id: 'nav-login',     navLabel: 'Login',     title: 'Login',     prefix: 'Login' },
    { id: 'nav-profile',   navLabel: 'Profile',   title: 'Profile',   prefix: 'Profile' },
    { id: 'nav-dashboard', navLabel: 'Dashboard', title: 'Dashboard', prefix: 'Dashboard' },
    // About children
    { id: 'nav-about-me',           navLabel: 'About-Me',           title: 'About-Me',           prefix: 'AboutMe' },
    { id: 'nav-about-thevision',    navLabel: 'About-TheVision',    title: 'About-TheVision',    prefix: 'Vision' },
    { id: 'nav-about-thesupporters',navLabel: 'About-TheSupporters',title: 'About-TheSupporters',prefix: 'Supporter' },
    // Portfolio children
    { id: 'nav-2d-projects', navLabel: '2D-Projects', title: '2D-Projects', prefix: '2DProject' },
    { id: 'nav-3d-projects', navLabel: '3D-Projects', title: '3D-Projects', prefix: '3DProject' },
    { id: 'nav-xd-projects', navLabel: 'XD-Projects', title: 'XD-Projects', prefix: 'XDProject' },
    // SocialNetworks children
    { id: 'nav-linktree',     navLabel: 'LinkTree',     title: 'LinkTree',     prefix: 'Link' },
    { id: 'nav-communities',  navLabel: 'Communities',  title: 'Communities', prefix: 'Community' },
    { id: 'nav-collaborators',navLabel: 'Collaborators',title: 'Collaborators',prefix: 'Collaborator' },
    // OmniChannels children
    { id: 'nav-omnifeeds-updates',      navLabel: 'OmniFeeds: Updates',      title: 'OmniFeeds: Updates',      prefix: 'Update' },
    { id: 'nav-omnifeeds-logs',         navLabel: 'OmniFeeds: Logs',         title: 'OmniFeeds: Logs',         prefix: 'Log' },
    { id: 'nav-omnifeeds-drops',        navLabel: 'OmniFeeds: Drops',        title: 'OmniFeeds: Drops',        prefix: 'Drop' },
    { id: 'nav-omnifeeds-perspectives', navLabel: 'OmniFeeds: Perspectives', title: 'OmniFeeds: Perspectives', prefix: 'Perspective' },
    { id: 'nav-omnifeeds-experiments',  navLabel: 'OmniFeeds: Experiments',  title: 'OmniFeeds: Experiments',  prefix: 'Experiment' },
    { id: 'nav-omnifeeds-media',        navLabel: 'OmniFeeds: Media',        title: 'OmniFeeds: Media',        prefix: 'Media' },
  ]
  navPanelConfigs.forEach(cfg => {
    base.addModule(new IndexedPanel(base.context, { ...cfg, count: 8, width: NAV_PANEL_WIDTH }))
  })

  const omniStartHUD = new OmniStartHUD(base.context)
  base.addModule(omniStartHUD)

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

  // ── Sound is created earlier now, before BaseScene, so it can be
  // included in the frozen context object — see above.


  // Single delegated listener on the UI shell — fires on every click
  // except drawer items, EXCEPT when something more specific (a
  // panel's own open/close/minimize button, or anything else that
  // calls Sound.play itself) already played a sound for this exact
  // click — direct/target handlers always run before this ancestor
  // listener sees the event, so playedThisTick reflects that
  // correctly without needing to enumerate every button by name.
  document.getElementById('omni-ui')?.addEventListener('click', (e) => {
    let el = e.target
    while (el && el.id !== 'omni-ui') {
      if (
        el.classList.contains('omni-drawer__item') ||
        el.classList.contains('omni-drawer')
      ) return
      el = el.parentElement
    }
    if (Sound.playedThisTick) return
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

  // ── 'o' / 'O' — User Space sphere quick toggles ───────────
  //   o  → toggle visibility
  //   O  → toggle spin
  window.addEventListener('keydown', (e) => {
    if ((e.key !== 'o' && e.key !== 'O') || e.repeat) return
    const active = document.activeElement
    const isTyping = active && (
      active.tagName === 'INPUT' ||
      active.tagName === 'TEXTAREA' ||
      active.isContentEditable
    )
    if (isTyping) return

    if (e.key === 'o') {
      window.dispatchEvent(new CustomEvent('omni:userspace-toggle-visible'))
    } else {
      window.dispatchEvent(new CustomEvent('omni:userspace-toggle-spin'))
    }
  })

  // ── '0' / '9' — toggle the domain grid sphere's visibility ─
  window.addEventListener('keydown', (e) => {
    if ((e.key !== '0' && e.key !== '9') || e.repeat) return
    const active = document.activeElement
    const isTyping = active && (
      active.tagName === 'INPUT' ||
      active.tagName === 'TEXTAREA' ||
      active.isContentEditable
    )
    if (isTyping) return
    window.dispatchEvent(new CustomEvent('omni:domaingrid-toggle-visible'))
  })

  // ── 'b' — toggle OmniBrowser (window 1) ───────────────────
  // Opens sliding in from the left, same entrance as the boot sequence.
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'b' || e.repeat) return
    const active = document.activeElement
    const isTyping = active && (
      active.tagName === 'INPUT' ||
      active.tagName === 'TEXTAREA' ||
      active.isContentEditable
    )
    if (isTyping) return
    if (omniBrowserWindow1._isOpen) omniBrowserWindow1.close()
    else omniBrowserWindow1.openFromSide()
  })

  // ── 'n' — toggle OmniDraw ──────────────────────────────────
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'n' || e.repeat) return
    const active = document.activeElement
    const isTyping = active && (
      active.tagName === 'INPUT' ||
      active.tagName === 'TEXTAREA' ||
      active.isContentEditable
    )
    if (isTyping) return
    if (omniDraw._isOpen) omniDraw.close()
    else omniDraw.open()
  })

  // ── 'm' — toggle OmniMixer ─────────────────────────────────
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'm' || e.repeat) return
    const active = document.activeElement
    const isTyping = active && (
      active.tagName === 'INPUT' ||
      active.tagName === 'TEXTAREA' ||
      active.isContentEditable
    )
    if (isTyping) return
    if (omniMixerPanel._isOpen) omniMixerPanel.close()
    else omniMixerPanel.open()
  })

  // ── Default-to-fullscreen ────────────────────────────────────
  // Browsers block requestFullscreen() from ever firing without a
  // genuine, trusted user gesture (a real click/tap/keypress) — this
  // cannot be bypassed from code, including on page load itself. This
  // is the closest real equivalent: the very first genuine interaction
  // anywhere on the page requests fullscreen, once, then gets out of
  // the way. If the browser or user declines, it fails silently and
  // never asks again for the rest of the session.
  const _requestFullscreenOnce = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
    }
    window.removeEventListener('pointerdown', _requestFullscreenOnce)
    window.removeEventListener('keydown', _requestFullscreenOnce)
  }
  window.addEventListener('pointerdown', _requestFullscreenOnce)
  window.addEventListener('keydown', _requestFullscreenOnce)

  // ── 'F2' — refresh the page ─────────────────────────────────
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'F2' || e.repeat) return
    const active = document.activeElement
    const isTyping = active && (
      active.tagName === 'INPUT' ||
      active.tagName === 'TEXTAREA' ||
      active.isContentEditable
    )
    if (isTyping) return
    e.preventDefault()
    location.reload()
  })

  // ── 'F4' — toggle fullscreen ───────────────────────────────
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'F4' || e.repeat) return
    const active = document.activeElement
    const isTyping = active && (
      active.tagName === 'INPUT' ||
      active.tagName === 'TEXTAREA' ||
      active.isContentEditable
    )
    if (isTyping) return
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      document.documentElement.requestFullscreen().catch(() => {})
    }
  })

  // ── 'Escape' — exit fullscreen ─────────────────────────────
  // Browsers auto-exit fullscreen on a genuine, trusted Escape
  // keypress already — this call is what actually makes it work when
  // Escape is pressed via OmniKeys' Command mode instead, since a
  // synthetic KeyboardEvent doesn't trigger that native browser
  // behavior. Harmless no-op for a real physical Escape, which the
  // browser was already going to handle on its own.
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return
    if (document.fullscreenElement) document.exitFullscreen()
  })

  // ── '(' / ')' — wallpaper sphere spin direction ───────────
  //   (  → counter-clockwise
  //   )  → clockwise
  window.addEventListener('keydown', (e) => {
    if ((e.key !== '(' && e.key !== ')') || e.repeat) return
    const active = document.activeElement
    const isTyping = active && (
      active.tagName === 'INPUT' ||
      active.tagName === 'TEXTAREA' ||
      active.isContentEditable
    )
    if (isTyping) return
    window.dispatchEvent(new CustomEvent('omni:wallpaper-spin-direction', {
      detail: { direction: e.key === '(' ? -1 : 1 }
    }))
  })

  // ── 'Enter' — toggle OmniStartHUD ─────────────────────────
  // Several existing elements (drawer items, radial slots, panel icons)
  // already handle Enter themselves when focused, to activate via
  // keyboard — this must not also fire OCUI in those cases. tabIndex >= 0
  // catches any keyboard-focusable custom element broadly, not just the
  // standard form controls.
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.repeat) return
    const active = document.activeElement
    const isInteractive = active && (
      active.tagName === 'INPUT' ||
      active.tagName === 'TEXTAREA' ||
      active.isContentEditable ||
      active.tagName === 'BUTTON' ||
      active.getAttribute?.('role') === 'button' ||
      (typeof active.tabIndex === 'number' && active.tabIndex >= 0 && active !== document.body)
    )
    if (isInteractive) return
    window.dispatchEvent(new CustomEvent('omni:osh-toggle'))
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
        // OmniBrowser is meant to be the user's first, most familiar
        // interaction with the reality — opens automatically the
        // moment landing completes, sliding in from opposite edges
        // together with its Properties panel, rather than requiring
        // the drawer.
        //
        // Skipped when this instance is itself running inside an
        // iframe (window.self !== window.top — the standard check for
        // "am I embedded right now"). OmniBrowser's own default
        // homepage is this same site, loaded recursively — if an
        // embedded instance ALSO auto-opened its own OmniBrowser, that
        // inner one would default to loading itself too, and so on:
        // genuine infinite nesting, not a hypothetical one. An
        // embedded instance simply doesn't auto-open its own browser.
        const isEmbedded = window.self !== window.top
        if (!isEmbedded) {
          omniBrowserWindow1.openFromSide()
          omniBrowserProperties.openFromSide()
        }
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