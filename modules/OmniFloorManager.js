/**
 * modules/OmniFloorManager.js — ⟐FloorManager
 *
 * Real, additional floors beyond the single ground floor
 * modules/OmniFloor.js already owns. Deliberately a separate module
 * rather than a rewrite of OmniFloor.js itself: OmniFloor's camera-
 * windowed tiling system exists to make ONE floor, at massive scale
 * (3000 units), cheap — that complexity isn't needed here, since this
 * manages a real but small number of ADDITIONAL reference floors at
 * different heights (a handful, not one per pixel of scale), each a
 * plain THREE.GridHelper. Simpler on purpose, not an oversight.
 *
 * Each floor: { id, y, label }. The ground floor (y=0, OmniFloor.js's
 * own real floor) is NOT one of these — it's listed read-only in the
 * settings panel as a reference point, never created/deleted/moved
 * from here, since OmniFloor.js already owns it for real.
 *
 * Event contract:
 *   omni:floormanager-set   { action: 'add', y, label }
 *                           { action: 'remove', id }
 *                           { action: 'setHeight', id, y }
 *                           { action: 'setLabel', id, label }
 *                           { action: 'toggle-indicator', visible }
 *     — dispatched by ui/FloorManagerPanel.js (Admin15)
 *
 * The center-screen level indicator (toggleable) reads the camera's
 * current Y each frame and reports whichever floor (ground included)
 * is closest, so it's a real, live "what floor am I on" readout, not
 * a static label.
 */

import * as THREE from 'three'

const STORE_KEY = 'omni:floormanager:floors'
const GRID_SIZE = 1000        // moderate, fixed size — not windowed like OmniFloor.js's ground floor
const GRID_DIVISIONS = 50     // 20-unit cells, matching OmniFloor's own default density

function loadFloors () {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch (_) { return [] }
}

function saveFloors (floors) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(floors)) } catch (_) {}
}

let counter = 0
function generateFloorId () { return `floor-${Date.now().toString(36)}-${(counter++).toString(36)}` }

const STYLES = `
.omni-floor-indicator {
  position        : fixed;
  top             : calc(50% + 46px);
  left            : 50%;
  transform       : translateX(-50%);
  z-index         : 40;
  pointer-events  : none;
  font-family     : 'Courier New', Courier, monospace;
  font-size       : 10px;
  letter-spacing  : 0.08em;
  color           : rgba(255, 255, 255, 0.55);
  background      : rgba(8, 8, 12, 0.55);
  border           : 1px solid rgba(255, 255, 255, 0.10);
  border-radius   : 999px;
  padding         : 3px 12px;
  backdrop-filter : blur(6px);
  opacity         : 0;
  visibility      : hidden;
  transition      : opacity 0.15s ease;
  white-space     : nowrap;
}
.omni-floor-indicator.is-visible { opacity: 1; visibility: visible; }
`

function injectStyles () {
  if (document.getElementById('omni-floor-indicator-styles')) return
  const tag = document.createElement('style')
  tag.id = 'omni-floor-indicator-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

export default class OmniFloorManager {
  constructor (context) {
    this.ctx = context
    this._floors = []          // [{ id, y, label, mesh }]
    this._indicatorEl = null
    this._indicatorVisible = true
    this._onSet = null
    this._lastReportedLabel = null
  }

  init () {
    injectStyles()
    this._buildIndicator()

    const saved = loadFloors()
    saved.forEach(f => this._createFloorMesh(f.id, f.y, f.label))

    try {
      const rawVisible = localStorage.getItem('omni:floormanager:indicator-visible')
      this._indicatorVisible = rawVisible === null ? true : rawVisible === '1'
    } catch (_) { this._indicatorVisible = true }
    this._indicatorEl.classList.toggle('is-visible', this._indicatorVisible)

    this._onSet = (e) => this._handleSet(e.detail ?? {})
    window.addEventListener('omni:floormanager-set', this._onSet)
  }

  update () {
    const cam = this.ctx?.camera
    if (!cam || !this._indicatorVisible) return

    // Ground floor (OmniFloor.js's real floor) is always a candidate,
    // at y=0 — this module doesn't own it, but the indicator should
    // still report it as "Ground" when it's the closest one.
    let bestLabel = 'Ground'
    let bestDist = Math.abs(cam.position.y - 0)
    this._floors.forEach(f => {
      const d = Math.abs(cam.position.y - f.y)
      if (d < bestDist) { bestDist = d; bestLabel = f.label }
    })

    if (bestLabel !== this._lastReportedLabel) {
      this._lastReportedLabel = bestLabel
      this._indicatorEl.textContent = `⟐ ${bestLabel}  (y ${cam.position.y.toFixed(1)})`
    } else {
      // Still refresh the live Y readout even when the floor hasn't changed
      this._indicatorEl.textContent = `⟐ ${bestLabel}  (y ${cam.position.y.toFixed(1)})`
    }
  }

  onResize () {}

  destroy () {
    window.removeEventListener('omni:floormanager-set', this._onSet)
    this._floors.forEach(f => this._disposeFloorMesh(f))
    this._indicatorEl?.parentNode?.removeChild(this._indicatorEl)
  }

  // ── Public read API — for ui/FloorManagerPanel.js to render its list ──

  getFloors () {
    return this._floors.map(f => ({ id: f.id, y: f.y, label: f.label }))
  }

  isIndicatorVisible () { return this._indicatorVisible }

  // ── DOM ──────────────────────────────────────────────────────────────

  _buildIndicator () {
    const el = document.createElement('div')
    el.className = 'omni-floor-indicator'
    el.textContent = '⟐ Ground  (y 0.0)'
    const shell = document.getElementById('omni-ui') ?? document.body
    shell.appendChild(el)
    this._indicatorEl = el
  }

  // ── Floor mesh management ───────────────────────────────────────────

  _createFloorMesh (id, y, label) {
    const grid = new THREE.GridHelper(GRID_SIZE, GRID_DIVISIONS, 0x8cffb4, 0x444455)
    grid.material.transparent = true
    grid.material.opacity = 0.35
    grid.position.y = y
    this.ctx.scene.add(grid)
    this._floors.push({ id, y, label, mesh: grid })
  }

  _disposeFloorMesh (f) {
    if (!f.mesh) return
    this.ctx.scene.remove(f.mesh)
    f.mesh.geometry?.dispose()
    f.mesh.material?.dispose()
  }

  _persist () {
    saveFloors(this._floors.map(f => ({ id: f.id, y: f.y, label: f.label })))
  }

  // ── Event handling ──────────────────────────────────────────────────

  _handleSet (patch) {
    switch (patch.action) {
      case 'add': {
        const id = generateFloorId()
        const y = Number.isFinite(patch.y) ? patch.y : 10
        const label = patch.label || `Floor ${this._floors.length + 1}`
        this._createFloorMesh(id, y, label)
        this._persist()
        break
      }
      case 'remove': {
        const idx = this._floors.findIndex(f => f.id === patch.id)
        if (idx === -1) return
        this._disposeFloorMesh(this._floors[idx])
        this._floors.splice(idx, 1)
        this._persist()
        break
      }
      case 'setHeight': {
        const f = this._floors.find(f => f.id === patch.id)
        if (!f || !Number.isFinite(patch.y)) return
        f.y = patch.y
        f.mesh.position.y = patch.y
        this._persist()
        break
      }
      case 'setLabel': {
        const f = this._floors.find(f => f.id === patch.id)
        if (!f) return
        f.label = patch.label || f.label
        this._persist()
        break
      }
      case 'toggle-indicator': {
        this._indicatorVisible = !!patch.visible
        this._indicatorEl.classList.toggle('is-visible', this._indicatorVisible)
        try { localStorage.setItem('omni:floormanager:indicator-visible', this._indicatorVisible ? '1' : '0') } catch (_) {}
        break
      }
      default:
        break
    }
  }
}
