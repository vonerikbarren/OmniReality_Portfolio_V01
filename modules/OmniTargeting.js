/**
 * modules/OmniTargeting.js — ⟐Targeting
 *
 * Z-Targeting, from Zelda: a real reticle that locks onto whatever's
 * currently selected, rather than a generic highlight. Reuses the
 * existing, already-working selection mechanism (omni:node-selected)
 * directly — targeting is "what does the reticle look like around
 * the current selection," not a second, separate selection system.
 *
 * Default: four tetrahedrons arranged around the target, each one's
 * own apex pointed inward toward the target's center — the classic
 * Z-target reticle shape, not a generic ring. targetRadiusGeometry
 * lets that default shape be swapped for any of the same shapes
 * OmniDraw itself offers.
 *
 * A CSS2D-style tooltip (a real screen-projected HTML label, not
 * Three.js's own CSS2DRenderer add-on) shows the targeted object's
 * label — a quick identifier, not a full Inspector.
 *
 * Follows the standard module contract (constructor / init / update / destroy).
 */

import * as THREE from 'three'
import { createWallpaperStore } from '../utils/WallpaperStorage.js'

const MARKER_COUNT = 4
const DEFAULT_GEOMETRY = 'TetrahedronGeometry'
const MARKER_RADIUS = 0.35   // each marker's own size
const ORBIT_RADIUS = 1.6     // how far out from the target center the 4 markers sit

// Same curated geometry vocabulary already used elsewhere (OmniDraw,
// OmniSystem, OmniBrowserSpace) — not a new, separate shape list.
const GEOMETRY_BUILDERS = {
  TetrahedronGeometry:  (r) => new THREE.TetrahedronGeometry(r),
  BoxGeometry:          (r) => new THREE.BoxGeometry(r * 1.4, r * 1.4, r * 1.4),
  SphereGeometry:       (r) => new THREE.SphereGeometry(r, 16, 16),
  OctahedronGeometry:   (r) => new THREE.OctahedronGeometry(r),
  IcosahedronGeometry:  (r) => new THREE.IcosahedronGeometry(r, 0),
  ConeGeometry:         (r) => new THREE.ConeGeometry(r, r * 1.6, 12),
}
export const TARGETING_GEOMETRIES = Object.keys(GEOMETRY_BUILDERS)

const TARGET_TEXTURE_SLOTS = 5
const targetTextureStore = createWallpaperStore('targeting-marker', TARGET_TEXTURE_SLOTS)

const STORE_KEY = 'omni:targeting:settings'
function loadSettings () {
  const defaults = { geometry: DEFAULT_GEOMETRY, color: '#ffffff', alpha: 0.85, activeSlot: null }
  try {
    const raw = localStorage.getItem(STORE_KEY)
    return raw ? { ...defaults, ...JSON.parse(raw) } : defaults
  } catch (_) { return defaults }
}
function saveSettings (s) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(s)) } catch (_) {}
}

export default class OmniTargeting {
  constructor (context) {
    this.ctx = context
    this._group = null
    this._markers = []
    this._targetMesh = null
    this._geometry = DEFAULT_GEOMETRY
    this._color = '#ffffff'
    this._alpha = 0.85
    this._activeSlot = null
    this._texture = null
    this._tooltipEl = null
    this._onNodeSelected = null
    this._onSettingsSet = null
  }

  init () {
    const saved = loadSettings()
    this._geometry = GEOMETRY_BUILDERS[saved.geometry] ? saved.geometry : DEFAULT_GEOMETRY
    this._color = saved.color
    this._alpha = saved.alpha
    this._activeSlot = saved.activeSlot

    this._group = new THREE.Group()
    this._group.visible = false   // nothing targeted yet
    this.ctx.scene.add(this._group)
    this._buildMarkers()

    this._tooltipEl = document.createElement('div')
    this._tooltipEl.id = 'omni-targeting-tooltip'
    Object.assign(this._tooltipEl.style, {
      position: 'fixed', pointerEvents: 'none', zIndex: '999997',
      transform: 'translate(-50%, -140%)', display: 'none',
      background: 'rgba(8,8,12,0.85)', color: '#fff',
      font: '10px "Courier New", monospace', padding: '4px 8px',
      borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)',
      whiteSpace: 'nowrap',
    })
    document.body.appendChild(this._tooltipEl)

    this._onNodeSelected = (e) => this._setTarget(e.detail?.node, e.detail?.mesh)
    window.addEventListener('omni:node-selected', this._onNodeSelected)

    this._onSettingsSet = (e) => {
      const patch = e.detail ?? {}
      let needsRebuild = false
      if (patch.geometry !== undefined && GEOMETRY_BUILDERS[patch.geometry] && patch.geometry !== this._geometry) {
        this._geometry = patch.geometry
        needsRebuild = true
      }
      if (patch.color !== undefined) { this._color = patch.color; this._applyColor() }
      if (patch.alpha !== undefined) { this._alpha = patch.alpha; this._applyColor() }
      if (patch.activeSlot !== undefined) {
        this._activeSlot = patch.activeSlot
        if (this._activeSlot) this._applySlotTexture(this._activeSlot)
        else this._clearTexture()
      }
      if (needsRebuild) { this._disposeMarkers(); this._buildMarkers() }
      saveSettings({ geometry: this._geometry, color: this._color, alpha: this._alpha, activeSlot: this._activeSlot })
    }
    window.addEventListener('omni:targeting-set', this._onSettingsSet)
  }

  update (delta) {
    if (!this._group.visible || !this._targetMesh) return
    this._group.position.copy(this._targetMesh.position)
    this._group.rotation.y += delta * 0.6   // slow rotation, reads as "actively locked on," not static

    // Screen-project the target's real world position for the tooltip —
    // a genuine CSS2D-style label, not Three.js's own add-on.
    const pos = this._targetMesh.position.clone().project(this.ctx.camera)
    if (pos.z > 1) { this._tooltipEl.style.display = 'none'; return }   // behind the camera
    const x = (pos.x * 0.5 + 0.5) * window.innerWidth
    const y = (-pos.y * 0.5 + 0.5) * window.innerHeight
    this._tooltipEl.style.left = `${x}px`
    this._tooltipEl.style.top = `${y}px`
    this._tooltipEl.style.display = ''
  }

  onResize () {}

  destroy () {
    window.removeEventListener('omni:node-selected', this._onNodeSelected)
    window.removeEventListener('omni:targeting-set', this._onSettingsSet)
    this._texture?.dispose()
    this._tooltipEl?.remove()
    if (this._group) {
      this.ctx.scene.remove(this._group)
      this._group.traverse(obj => { obj.geometry?.dispose(); obj.material?.dispose() })
    }
  }

  _setTarget (node, mesh) {
    if (!mesh) { this._group.visible = false; this._tooltipEl.style.display = 'none'; return }
    this._targetMesh = mesh
    this._group.visible = true
    this._tooltipEl.textContent = node?.label ?? node?.id ?? 'Target'
  }

  _buildMarkers () {
    const builder = GEOMETRY_BUILDERS[this._geometry] ?? GEOMETRY_BUILDERS[DEFAULT_GEOMETRY]
    for (let i = 0; i < MARKER_COUNT; i++) {
      const geo = builder(MARKER_RADIUS)
      const mat = new THREE.MeshStandardMaterial({ color: this._color, transparent: true, opacity: this._alpha, roughness: 0.3, metalness: 0.1 })
      const marker = new THREE.Mesh(geo, mat)

      const angle = (i / MARKER_COUNT) * Math.PI * 2
      marker.position.set(Math.cos(angle) * ORBIT_RADIUS, 0, Math.sin(angle) * ORBIT_RADIUS)
      // Point each marker's own "top" inward toward the target center —
      // the actual Z-target reticle look, not four markers facing outward.
      marker.lookAt(0, 0, 0)
      marker.rotateX(Math.PI / 2)

      this._group.add(marker)
      this._markers.push(marker)
    }
  }

  _disposeMarkers () {
    this._markers.forEach(m => {
      this._group.remove(m)
      m.geometry.dispose()
      m.material.dispose()
    })
    this._markers = []
  }

  _applyColor () {
    this._markers.forEach(m => {
      if (!this._texture) m.material.color.set(this._color)
      m.material.opacity = this._alpha
    })
  }

  async _applySlotTexture (slot) {
    try {
      const record = await targetTextureStore.loadWallpaper(slot)
      if (!record) return
      const url = URL.createObjectURL(record.blob)
      new THREE.TextureLoader().load(url, (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace
        this._texture?.dispose()
        this._texture = texture
        this._markers.forEach(m => {
          m.material.map = texture
          m.material.color.set(0xffffff)
          m.material.needsUpdate = true
        })
      })
      this._activeSlot = slot
    } catch (err) {
      console.warn('⟐OmniTargeting — failed to load marker texture slot', slot, err)
    }
  }

  _clearTexture () {
    this._texture?.dispose()
    this._texture = null
    this._markers.forEach(m => { m.material.map = null; m.material.color.set(this._color); m.material.needsUpdate = true })
    this._activeSlot = null
  }
}

export { targetTextureStore, TARGET_TEXTURE_SLOTS }
