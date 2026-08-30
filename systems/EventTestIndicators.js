/**
 * systems/EventTestIndicators.js — ⟐mniReality Event Test Indicators
 *
 * Temporary, deliberately minimal visual confirmations for events that
 * were previously dispatched with no listener anywhere in the codebase.
 * The goal here is ONLY "prove the wire is connected" — not real feature
 * behavior. Each of these is expected to be replaced by a real system
 * later; see the BACKLOG note at the bottom of this file.
 *
 * Events consumed (window):
 *   omni:grid-select        { hand, cell, row, col, active, selected }
 *   omni:grid-clear         { hand }
 *   omni:tool-select        { hand, tool, toolIndex, page }
 *   omni:tool-deselect      { hand, tool, page }
 *   omni:page-select        { hand, page }
 *   omni:loader-ready       { ids }
 *   omni:panel-detached     { id }
 *   omni:panel-restore-handler  { id, handler }
 *
 * Behavior:
 *   grid-select/clear   → brief highlight pulse on a small per-hand sphere
 *   tool-select         → continuous blink on that hand's sphere, starts
 *   tool-deselect        → stops the blink, resets opacity
 *   page-select          → one-shot flash (no persistent state)
 *   loader-ready         → console confirmation only — deliberately inert,
 *                          wrapped so it can never throw / break startup
 *   panel-detached,
 *   panel-restore-handler → opens a small standalone Panel and sweeps its
 *                          header line green, confirming the event fired
 *
 * Follows the standard module contract (constructor / init / update / destroy).
 */

import * as THREE from 'three'
import gsap from 'gsap'
import Panel from '../ui/Panel.js'

const HAND_COLOR = { lh: 0x4fd1ff, rh: 0xff6ec7 }
const HAND_POS   = { lh: [-3, 2.2, -6], rh: [3, 2.2, -6] }

export default class EventTestIndicators {
  constructor (context) {
    this.ctx = context

    this._handMeshes  = {}   // { lh: THREE.Mesh, rh: THREE.Mesh }
    this._blinkTweens = {}   // { lh: gsap.Timeline|null, rh: ... }
    this._pocketPanel = null // lazily created

    this._onGridSelect  = null
    this._onGridClear   = null
    this._onToolSelect  = null
    this._onToolDeselect = null
    this._onPageSelect  = null
    this._onLoaderReady = null
    this._onPanelDetached      = null
    this._onPanelRestoreHandler = null
  }

  init () {
    this._buildHandMeshes()
    this._bindEvents()
  }

  update () {
    // Purely event-driven — nothing needed per frame.
  }

  onResize () {}

  destroy () {
    window.removeEventListener('omni:grid-select',   this._onGridSelect)
    window.removeEventListener('omni:grid-clear',    this._onGridClear)
    window.removeEventListener('omni:tool-select',   this._onToolSelect)
    window.removeEventListener('omni:tool-deselect', this._onToolDeselect)
    window.removeEventListener('omni:page-select',   this._onPageSelect)
    window.removeEventListener('omni:loader-ready',  this._onLoaderReady)
    window.removeEventListener('omni:panel-detached',        this._onPanelDetached)
    window.removeEventListener('omni:panel-restore-handler', this._onPanelRestoreHandler)

    Object.values(this._blinkTweens).forEach(tw => tw?.kill())

    for (const mesh of Object.values(this._handMeshes)) {
      this.ctx.scene.remove(mesh)
      mesh.geometry?.dispose()
      mesh.material?.dispose()
    }

    this._pocketPanel?.destroy?.()
  }

  // ── Setup ──────────────────────────────────────────────────────────────

  _buildHandMeshes () {
    for (const hand of ['lh', 'rh']) {
      const geo = new THREE.SphereGeometry(0.18, 16, 16)
      const mat = new THREE.MeshStandardMaterial({
        color: HAND_COLOR[hand],
        emissive: HAND_COLOR[hand],
        emissiveIntensity: 0.15,
        transparent: true,
        opacity: 0.55,
      })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.set(...HAND_POS[hand])
      mesh.userData.isTestIndicator = true
      this.ctx.scene.add(mesh)
      this._handMeshes[hand] = mesh
    }
  }

  _bindEvents () {
    this._onGridSelect = (e) => this._pulseHand(e.detail?.hand)
    this._onGridClear  = (e) => this._resetHand(e.detail?.hand)

    this._onToolSelect   = (e) => this._startBlink(e.detail?.hand)
    this._onToolDeselect = (e) => this._stopBlink(e.detail?.hand)
    this._onPageSelect   = (e) => this._pulseHand(e.detail?.hand)

    // loader-ready — intentionally does nothing but log. Wrapped so a bad
    // payload can never bubble into an uncaught error during bootstrap.
    this._onLoaderReady = (e) => {
      try {
        const count = e.detail?.ids?.length ?? 0
        console.log(`⟐ EventTestIndicators — loader-ready received (${count} node id(s))`)
      } catch (err) {
        console.warn('⟐ EventTestIndicators — loader-ready handler swallowed an error:', err)
      }
    }

    this._onPanelDetached        = () => this._flashPocketPanel()
    this._onPanelRestoreHandler  = () => this._flashPocketPanel()

    window.addEventListener('omni:grid-select',   this._onGridSelect)
    window.addEventListener('omni:grid-clear',    this._onGridClear)
    window.addEventListener('omni:tool-select',   this._onToolSelect)
    window.addEventListener('omni:tool-deselect', this._onToolDeselect)
    window.addEventListener('omni:page-select',   this._onPageSelect)
    window.addEventListener('omni:loader-ready',  this._onLoaderReady)
    window.addEventListener('omni:panel-detached',        this._onPanelDetached)
    window.addEventListener('omni:panel-restore-handler', this._onPanelRestoreHandler)
  }

  // ── Grid / page — one-shot pulse ─────────────────────────────────────────

  _pulseHand (hand) {
    const mesh = this._handMeshes[hand]
    if (!mesh) return
    gsap.killTweensOf(mesh.material)
    gsap.killTweensOf(mesh.scale)
    gsap.fromTo(mesh.material, { opacity: 1, emissiveIntensity: 1.2 },
      { opacity: 0.55, emissiveIntensity: 0.15, duration: 0.6, ease: 'power2.out' })
    gsap.fromTo(mesh.scale, { x: 1.6, y: 1.6, z: 1.6 },
      { x: 1, y: 1, z: 1, duration: 0.5, ease: 'elastic.out(1, 0.5)' })
  }

  _resetHand (hand) {
    const mesh = this._handMeshes[hand]
    if (!mesh) return
    gsap.killTweensOf(mesh.material)
    gsap.to(mesh.material, { opacity: 0.55, emissiveIntensity: 0.15, duration: 0.3 })
  }

  // ── Tool select — continuous blink until deselected ──────────────────────

  _startBlink (hand) {
    const mesh = this._handMeshes[hand]
    if (!mesh) return
    this._blinkTweens[hand]?.kill()
    this._blinkTweens[hand] = gsap.to(mesh.material, {
      opacity: 1, emissiveIntensity: 1.4,
      duration: 0.35, ease: 'sine.inOut',
      repeat: -1, yoyo: true,
    })
  }

  _stopBlink (hand) {
    const mesh = this._handMeshes[hand]
    if (!mesh) return
    this._blinkTweens[hand]?.kill()
    this._blinkTweens[hand] = null
    gsap.to(mesh.material, { opacity: 0.55, emissiveIntensity: 0.15, duration: 0.3 })
  }

  // ── Panel-detached / panel-restore-handler — green flash panel ──────────

  _flashPocketPanel () {
    if (!this._pocketPanel) {
      this._pocketPanel = new Panel(this.ctx, {
        id        : 'pockettest',
        hand      : 'none',
        dir       : 'left',
        label     : '⟐PT',
        title     : '⟐Pocket — Event Test',
        iconLabel : '⟐PT',
        corner    : 'bl',
      })
      this._pocketPanel.init?.()
    }
    this._pocketPanel.flashIndicator('#3ee08c')
  }
}

// ── BACKLOG ──────────────────────────────────────────────────────────────
//
// MiniMap → real 3D map (per product direction, ~Aug 2026 conversation):
//   Replace the current 2D DOM minimap with a wireframe-mesh 3D map in the
//   style of Metroid Prime's map room — traversed rooms/nodes rendered as
//   translucent wireframe geometry matching their actual shapes, revealed
//   as the player visits them. Noted as intended to merge with a separate
//   concept the user is bringing in from a legacy project — do not build
//   ahead of that merge; confirm scope first.
//
// Pocket cubes (see systems/PocketCubes.js) → grid/radial connect view,
//   resizable via Inspector or a small contextual menu. See that file's
//   own BACKLOG note for the fuller spec.
