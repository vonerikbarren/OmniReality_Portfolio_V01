/**
 * ui/index.js — ⟐mniReality UI Shell Orchestrator
 *
 * Mounts every persistent UI region in the correct order, wires the shared
 * scene context through all components, and drives the per-frame data feed
 * from the Three.js camera into the GlobalBar.
 *
 * Mount order (z-index ascending, back → front):
 *   1. GlobalBar     z-50  — top, full width
 *   2. Dock          z-50  — bottom, full width
 *   3. Hands ×4      z-40  — four corners, above canvas, below drawers
 *   4. Drawers ×2    z-45  — left / right top-level sliding panels
 *   5. Panels ×2     z-45  — left / right bottom-level sliding panels
 *   6. PanelIcon     z-70  — freeform floating icons, above everything
 *
 * Context augmentation:
 *   BaseScene.context is `{ scene, camera, renderer, sizes, ticker }`.
 *   ui/index.js creates a *mutable* wrapper that adds `Sound` once
 *   SoundManager is ready. All components reference `this.ctx.Sound` with
 *   optional chaining so they silently skip sound until it arrives.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Usage in main.js
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   import UI from './ui/index.js'
 *
 *   const ui = new UI(base.context)
 *   ui.init()
 *   // later, after SoundManager loads:
 *   ui.setSound(Sound)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Per-frame data feed (called by BaseScene render loop via update(delta))
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   GlobalBar.setData() is called every frame with:
 *     pos   — camera world position       (x, y, z)
 *     rot   — camera Euler angles in deg  (x, y, z)
 *     scale — current node scale          (default 1,1,1 until Phase 4)
 *
 *   GlobalBar.update(delta) is also called every frame for FPS tracking.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Public API
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   ui.init()                      Mount and init all UI components
 *   ui.update(delta)               Call from render loop — feeds live data
 *   ui.destroy()                   Tear down everything cleanly
 *   ui.setSound(Sound)             Inject SoundManager after async load
 *   ui.setSpaceName(name)          Update current space name in GlobalBar
 *   ui.setSpaceEntry(date)         Set time-in-space clock start
 *   ui.setNodeData({ pos,rot,scale, roots, parents, child,
 *                    reality, experience, perspective,
 *                    dimTime, dimSpace, dimObject })
 *
 *   ui.bar       — GlobalBar instance
 *   ui.dock      — Dock instance
 *   ui.hands     — { omnihand, conscious, lh, rh }
 *   ui.drawers   — { left, right }
 *   ui.panels    — { lh, rh }
 *   ui.panelIcon — PanelIcon manager instance
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Events bridged here
 * ─────────────────────────────────────────────────────────────────────────────
 *   omni:nav-select  → logged; Phase 5+ wires real navigation
 *   omni:orbiter     → logged; Phase 4 defines behaviour
 *   omni:panel-*     → logged for Phase 4 system wiring
 *   omni:radial-*    → logged; Phase 3b wires RadialMenu
 *   omni:pad-toggle  → logged; Phase 3b wires MovementPad
 *   omni:pads-global → logged; Phase 3b wires MovementPad
 */

import GlobalBar                from './GlobalBar.js'
import Dock                     from './Dock.js'
import { createAllHands }       from './Hand.js'
import { createDrawers }        from './Drawer.js'
import { createPanels }         from './Panel.js'
import PanelIcon                from './PanelIcon.js'

// ── Radians → degrees ─────────────────────────────────────────────────────────
const R2D = 180 / Math.PI

// ── UI class ──────────────────────────────────────────────────────────────────

export default class UI {

  /**
   * @param {object} sceneContext
   *   Frozen context from BaseScene:
   *   { scene, camera, renderer, sizes, ticker }
   */
  constructor (sceneContext) {
    // Mutable wrapper — lets us inject Sound later without touching components
    this._ctx = { ...sceneContext, Sound: null }

    // ── Component instances (populated in init) ──────────────────────────
    this.bar       = null
    this.dock      = null
    this.hands     = null   // { omnihand, conscious, lh, rh }
    this.drawers   = null   // { left, right }
    this.panels    = null   // { lh, rh }
    this.panelIcon = null

    // ── Live node data cache (fed by Phase 4 / main.js) ─────────────────
    this._nodeData = {
      spaceName    : 'Root',
      spaceEntry   : new Date(),
      roots        : null,
      parents      : null,
      child        : null,
      reality      : null,
      experience   : null,
      perspective  : null,
      dimTime      : null,
      dimSpace     : null,
      dimObject    : null,
    }

    this._ready = false
  }

  // ── Module contract ──────────────────────────────────────────────────────

  /** Mount all UI regions in order. Call once after BaseScene.start(). */
  init () {
    this._ensureShell()

    // ── 1. GlobalBar ───────────────────────────────────────────────────
    this.bar = new GlobalBar(this._ctx)
    this.bar.init()

    // ── 2. Dock ────────────────────────────────────────────────────────
    this.dock = new Dock(this._ctx)
    this.dock.init()

    // ── 3. Four Hands ──────────────────────────────────────────────────
    this.hands = createAllHands(this._ctx)
    Object.values(this.hands).forEach(h => h.init())

    // ── 4. Drawers (top-level) ─────────────────────────────────────────
    this.drawers = createDrawers(this._ctx)
    this.drawers.left.init()
    this.drawers.right.init()

    // ── 5. Panels (bottom-level) ───────────────────────────────────────
    this.panels = createPanels(this._ctx)
    this.panels.lh.init()
    this.panels.rh.init()

    // ── 6. PanelIcon manager ───────────────────────────────────────────
    this.panelIcon = new PanelIcon(this._ctx)
    this.panelIcon.init()

    // ── Wire cross-component events ────────────────────────────────────
    this._bridgeEvents()

    // ── Seed GlobalBar with initial space data ─────────────────────────
    this.bar.setData({
      spaceName     : this._nodeData.spaceName,
      spaceEntryTime: this._nodeData.spaceEntry,
    })

    this._ready = true
    console.log('⟐mniReality UI shell mounted.')
  }

  /**
   * Called every frame from the BaseScene render loop.
   * Feeds live camera data into the GlobalBar.
   * @param {number} delta — seconds since last frame
   */
  update (delta) {
    if (!this._ready) return

    const cam = this._ctx.camera
    if (!cam) return

    // Camera world position
    const pos = {
      x: cam.position.x,
      y: cam.position.y,
      z: cam.position.z,
    }

    // Camera Euler → degrees
    const rot = {
      x: cam.rotation.x * R2D,
      y: cam.rotation.y * R2D,
      z: cam.rotation.z * R2D,
    }

    // Node scale — 1,1,1 until Phase 4 systems report it
    const scale = { x: 1, y: 1, z: 1 }

    this.bar.setData({ pos, rot, scale })
    this.bar.update(delta)
  }

  /** Tear down every component cleanly. */
  destroy () {
    this.panelIcon?.destroy()
    this.panels?.lh.destroy()
    this.panels?.rh.destroy()
    this.drawers?.left.destroy()
    this.drawers?.right.destroy()
    Object.values(this.hands ?? {}).forEach(h => h.destroy())
    this.dock?.destroy()
    this.bar?.destroy()
    this._ready = false
    console.log('⟐mniReality UI shell destroyed.')
  }

  // ── Public setters ───────────────────────────────────────────────────────

  /**
   * Inject SoundManager after async load.
   * All components will start calling Sound.play() from this point on.
   *
   * @param {object} Sound  — { play(id: string): void }
   */
  setSound (Sound) {
    this._ctx.Sound = Sound
    // Sound is read by reference from this._ctx, so no re-init needed.
  }

  /**
   * Update the current space name shown in the GlobalBar Col03.
   * Call whenever the user enters a new node / space.
   *
   * @param {string} name
   */
  setSpaceName (name) {
    this._nodeData.spaceName = name
    this.bar?.setData({ spaceName: name })
  }

  /**
   * Reset the time-in-space counter in the GlobalBar Col03.
   * Call the moment the camera arrives in a new space.
   *
   * @param {Date} [date]  — defaults to now
   */
  setSpaceEntry (date = new Date()) {
    this._nodeData.spaceEntry = date
    this.bar?.setData({ spaceEntryTime: date })
  }

  /**
   * Feed system / dimensional metadata into GlobalBar columns 08–10.
   * Any key omitted leaves the current value unchanged.
   *
   * @param {object} data
   * @param {string|null} [data.roots]
   * @param {string|null} [data.parents]
   * @param {string|null} [data.child]
   * @param {string|null} [data.reality]
   * @param {string|null} [data.experience]
   * @param {string|null} [data.perspective]
   * @param {string|null} [data.dimTime]
   * @param {string|null} [data.dimSpace]
   * @param {string|null} [data.dimObject]
   */
  setNodeData (data) {
    Object.assign(this._nodeData, data)
    this.bar?.setData(this._nodeData)
  }

  // ── Shell guard ───────────────────────────────────────────────────────────

  /**
   * Ensure `#omni-ui` exists in the DOM.
   * Phase 2 index.html already includes it; this guard is a safety net
   * in case UI is mounted in a test harness without the full HTML.
   */
  _ensureShell () {
    if (document.getElementById('omni-ui')) return
    const shell = document.createElement('div')
    shell.id    = 'omni-ui'
    Object.assign(shell.style, {
      position      : 'fixed',
      inset         : '0',
      pointerEvents : 'none',
      zIndex        : '10',
    })
    document.body.appendChild(shell)
    console.warn('⟐ UI: #omni-ui not found — created as fallback. Add it to index.html.')
  }

  // ── Event bridge — cross-component logging and future wiring ─────────────

  _bridgeEvents () {

    // ── Navigation selections (Drawer.js → future router) ─────────────
    window.addEventListener('omni:nav-select', (e) => {
      const { drawer, item, parent, path } = e.detail ?? {}
      console.log(`⟐ nav-select [${drawer}] ${parent ? parent + ' → ' : ''}${item}  (${path})`)
      // Phase 5+: NodeManager.navigateTo(path)
    })

    // ── Radial menu (Hand.js → RadialMenu.js in Phase 3b) ─────────────
    window.addEventListener('omni:radial-toggle', (e) => {
      const { hand, abbr, visible, radialDir } = e.detail ?? {}
      console.log(`⟐ radial-toggle [${hand}|${abbr}] visible=${visible} dir=${radialDir}`)
      // Phase 3b: RadialMenu.toggle(hand, radialDir)
    })

    // ── Movement pad visibility (Hand.js → MovementPad.js in Phase 3b) ─
    window.addEventListener('omni:pad-toggle', (e) => {
      const { hand, corner, visible } = e.detail ?? {}
      console.log(`⟐ pad-toggle [${hand}|${corner}] visible=${visible}`)
      // Phase 3b: MovementPad.setVisible(hand, visible)
    })

    // ── Global pad toggle (⟐LH ⚇ → all MovementPads in Phase 3b) ─────
    window.addEventListener('omni:pads-global', (e) => {
      const { visible, source } = e.detail ?? {}
      console.log(`⟐ pads-global [source=${source}] visible=${visible}`)
      // Phase 3b: MovementPad.setAllVisible(visible)
    })

    // ── Orbiter (Hand.js → Phase 4 definition) ────────────────────────
    window.addEventListener('omni:orbiter', (e) => {
      console.log(`⟐ orbiter [${e.detail?.hand}] — undefined`)
      // Phase 4: ⦿ behaviour defined here
    })

    // ── Panel lifecycle logging ────────────────────────────────────────
    window.addEventListener('omni:panel-minimized', (e) => {
      console.log(`⟐ panel-minimized [${e.detail?.id}] iconLabel=${e.detail?.iconLabel}`)
    })

    window.addEventListener('omni:panel-restore', (e) => {
      console.log(`⟐ panel-restore [${e.detail?.id}]`)
    })

    window.addEventListener('omni:panel-attached', (e) => {
      console.log(`⟐ panel-attached [${e.detail?.id}]`)
      // Phase 4: camera.attach(panelEl) for XR follow
    })

    window.addEventListener('omni:panel-closed', (e) => {
      console.log(`⟐ panel-closed [${e.detail?.id}]`)
    })

    // ── Portal activation (from Phase 2 PortalSpheres.js) ─────────────
    // Update GlobalBar space name when a portal is entered.
    window.addEventListener('omni:portal-activated', (e) => {
      const { label } = e.detail ?? {}
      if (label) {
        this.setSpaceName(label)
        this.setSpaceEntry()
      }
    })
  }
}
