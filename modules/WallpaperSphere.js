/**
 * modules/WallpaperSphere.js — ⟐mniReality Space Wallpaper
 *
 * A solid (not wireframe) shape sitting just outside VoidBoundary's
 * wireframe sphere — the "wallpaper" backdrop of the main space. Uses
 * THREE.BackSide so it renders as a backdrop from inside, same
 * technique as VoidBoundary. Despite the class name (kept for
 * continuity), the actual shape is now configurable — "sphere" was
 * just the original, and only, option.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Settings now live in ui/WallpaperSettingsPanel.js (Admin03), not here
 * ─────────────────────────────────────────────────────────────────────────────
 * Color/alpha/rotation/spin used to be configured from the main Admin
 * panel. They've moved to their own dedicated panel, consolidated with
 * the new shape/position/rotation/scale controls and the 20-slot
 * wallpaper browser, rather than splitting wallpaper options across
 * two places. This module reads from `omni:wallpaper:settings` and
 * listens for `omni:wallpaper-settings-set` now.
 *
 * One-time migration: if `omni:wallpaper:settings` doesn't exist yet
 * but the old `omni:admin:settings.wallpaper` does, this seeds the new
 * settings from the old ones on first load — so nobody who already had
 * a wallpaper configured loses it just because the settings moved.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Shape options — curated, not "every THREE.js geometry"
 * ─────────────────────────────────────────────────────────────────────────────
 * Box, Sphere, Cylinder, Cone, Torus, TorusKnot, Octahedron,
 * Tetrahedron, Icosahedron, Dodecahedron, Capsule — all closed,
 * parameter-free (radius-only) primitives that scale cleanly to world
 * size. Deliberately excludes Plane/Circle/Ring (flat, no "inside" to
 * stand in) and the hand-authored Lathe/Tube/Extrude/Shape geometries
 * (their exact form depends on custom control points that don't scale
 * sensibly to an arbitrary world-enveloping size).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * The "image never shows up" bug — actual root cause (kept from before)
 * ─────────────────────────────────────────────────────────────────────────────
 * This was never a texture-loading problem. VoidBoundary's grid sphere
 * sits just inside this shape and is wireframe + transparent — but
 * wireframe rendering only changes what gets DRAWN, not what gets
 * written to the depth buffer. Three.js still writes depth across that
 * sphere's FULL triangle surface, not just the visible lines, so
 * without depthWrite:false it silently occluded this shape behind it —
 * texture loaded fine, it just could never be seen. Fixed with
 * depthWrite:false + explicit renderOrder on all three concentric
 * shells (cube/domain-grid/wallpaper) so they always draw back-to-front
 * regardless of Three.js's automatic transparent-object sorting, which
 * isn't reliable for objects centered at the exact same point.
 *
 * Follows the standard module contract (constructor / init / update / destroy).
 */

import * as THREE from 'three'
import { loadWallpaper } from '../utils/WallpaperStorage.js'

const CENTER_Y = 28        // matches VoidBoundary / RootSpace
const BASE_SIZE = 1050     // 5x — the space should feel genuinely massive; same scale as before

const DEFAULT_COLOR   = '#445566'
const DEFAULT_ALPHA   = 0.9
const DEFAULT_IMG_URL = './assets/images/wallpaper-default.jpg'
const DEFAULT_SHAPE   = 'SphereGeometry'

const STORE_KEY = 'omni:wallpaper:settings'

const SHAPE_BUILDERS = {
  BoxGeometry:          (s) => new THREE.BoxGeometry(s * 1.7, s * 1.7, s * 1.7),
  SphereGeometry:       (s) => new THREE.SphereGeometry(s, 32, 32),
  CylinderGeometry:     (s) => new THREE.CylinderGeometry(s, s, s * 2, 32),
  ConeGeometry:         (s) => new THREE.ConeGeometry(s, s * 2, 32),
  TorusGeometry:        (s) => new THREE.TorusGeometry(s * 0.75, s * 0.3, 16, 48),
  TorusKnotGeometry:    (s) => new THREE.TorusKnotGeometry(s * 0.6, s * 0.2, 128, 16),
  OctahedronGeometry:   (s) => new THREE.OctahedronGeometry(s),
  TetrahedronGeometry:  (s) => new THREE.TetrahedronGeometry(s),
  IcosahedronGeometry:  (s) => new THREE.IcosahedronGeometry(s, 1),
  DodecahedronGeometry: (s) => new THREE.DodecahedronGeometry(s),
  CapsuleGeometry:      (s) => new THREE.CapsuleGeometry(s * 0.6, s, 16, 32),
}
export const WALLPAPER_SHAPES = Object.keys(SHAPE_BUILDERS)

function readAdminSettings () {
  try {
    const raw = localStorage.getItem('omni:admin:settings')
    return raw ? JSON.parse(raw) : null
  } catch (_) { return null }
}

function readWallpaperSettings () {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (raw) return JSON.parse(raw)
  } catch (_) { /* fall through to migration */ }

  // One-time migration from the old Admin-panel wallpaper group.
  const oldWallpaper = readAdminSettings()?.wallpaper
  const migrated = {
    shape: DEFAULT_SHAPE,
    color: oldWallpaper?.color ?? DEFAULT_COLOR,
    alpha: oldWallpaper?.alpha ?? DEFAULT_ALPHA,
    imgUrl: oldWallpaper?.imgUrl ?? DEFAULT_IMG_URL,
    activeSlot: null,   // null = using imgUrl/default, not a stored wallpaper-browser slot
    rotationSpeed: oldWallpaper?.rotationSpeed ?? 0.05,
    autoSpinX: oldWallpaper?.autoSpinX ?? false,
    autoSpinY: oldWallpaper?.autoSpinY ?? true,
    autoSpinZ: oldWallpaper?.autoSpinZ ?? true,
    position: { x: 0, y: 0, z: 0 },
    rotationOffset: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
  }
  try { localStorage.setItem(STORE_KEY, JSON.stringify(migrated)) } catch (_) {}
  return migrated
}

export default class WallpaperSphere {
  constructor (context) {
    this.ctx = context
    this._mesh = null
    this._shape = DEFAULT_SHAPE
    this._texture = null
    this._loader = new THREE.TextureLoader()
    this._imgUrl = ''
    this._imgUrlIsObjectUrl = false
    this._onSettingsSet = null
    this._onSpinDirection = null

    this._rotationSpeed = 0
    this._spinX = false
    this._spinY = false
    this._spinZ = false
    this._direction = 1   // flipped live by '(' / ')', not persisted

    this._position = { x: 0, y: 0, z: 0 }
    this._rotationOffset = { x: 0, y: 0, z: 0 }
    this._scale = { x: 1, y: 1, z: 1 }
  }

  init () {
    const saved = readWallpaperSettings()

    this._shape = saved.shape ?? DEFAULT_SHAPE
    this._buildMesh(this._shape, saved.alpha ?? DEFAULT_ALPHA)

    this._rotationSpeed = saved.rotationSpeed ?? 0.05
    this._spinX = saved.autoSpinX ?? false
    this._spinY = saved.autoSpinY ?? true
    this._spinZ = saved.autoSpinZ ?? true

    this._position = { ...(saved.position ?? { x: 0, y: 0, z: 0 }) }
    this._rotationOffset = { ...(saved.rotationOffset ?? { x: 0, y: 0, z: 0 }) }
    this._scale = { ...(saved.scale ?? { x: 1, y: 1, z: 1 }) }
    this._applyTransform()

    if (saved.activeSlot) {
      this._applyFromSlot(saved.activeSlot)
    } else {
      // Using || rather than ?? deliberately: a previously-saved EMPTY
      // STRING must also fall through to the default, not just
      // null/undefined — this was the actual bug behind the starfield
      // never appearing, from before this file's last rewrite.
      this._applyImage(saved.imgUrl || DEFAULT_IMG_URL)
      if (!saved.imgUrl) this._mesh.material.color.set(saved.color ?? DEFAULT_COLOR)
    }

    this._onSettingsSet = (e) => {
      const w = e.detail ?? {}
      if (w.shape !== undefined && w.shape !== this._shape) this._changeShape(w.shape)
      if (w.alpha !== undefined) this._mesh.material.opacity = w.alpha
      if (w.rotationSpeed !== undefined) this._rotationSpeed = w.rotationSpeed
      if (w.autoSpinX !== undefined) this._spinX = w.autoSpinX
      if (w.autoSpinY !== undefined) this._spinY = w.autoSpinY
      if (w.autoSpinZ !== undefined) this._spinZ = w.autoSpinZ
      if (w.position) { this._position = { ...this._position, ...w.position }; this._applyTransform() }
      if (w.rotationOffset) { this._rotationOffset = { ...this._rotationOffset, ...w.rotationOffset }; this._applyTransform() }
      if (w.scale) { this._scale = { ...this._scale, ...w.scale }; this._applyTransform() }
      if (w.imgUrl) this._applyImage(w.imgUrl)
      else if (w.imgUrl === '') this._clearImage(w.color ?? DEFAULT_COLOR)
      else if (w.color !== undefined && !this._texture) this._mesh.material.color.set(w.color)
      if (w.activeSlot) this._applyFromSlot(w.activeSlot)
    }
    window.addEventListener('omni:wallpaper-settings-set', this._onSettingsSet)

    // '(' / ')' quick direction override — see main.js
    this._onSpinDirection = (e) => {
      this._direction = e.detail?.direction ?? 1
      if (!this._spinX && !this._spinY && !this._spinZ) this._spinY = true
      if (!this._rotationSpeed) this._rotationSpeed = 0.3
    }
    window.addEventListener('omni:wallpaper-spin-direction', this._onSpinDirection)
  }

  /** Builds the mesh fresh for a given shape — used at init and
   *  whenever the shape changes, since geometry type can't be swapped
   *  in place the way a texture or color can. */
  _buildMesh (shape, alpha) {
    const builder = SHAPE_BUILDERS[shape] ?? SHAPE_BUILDERS[DEFAULT_SHAPE]
    const geo = builder(BASE_SIZE)
    const mat = new THREE.MeshBasicMaterial({
      color: DEFAULT_COLOR,
      transparent: true,
      opacity: alpha,
      side: THREE.BackSide,
      depthWrite: false,
    })
    this._mesh = new THREE.Mesh(geo, mat)
    this._mesh.renderOrder = -2   // between the cube (-3) and domain grid (-1)
    this.ctx.scene.add(this._mesh)
  }

  _changeShape (shape) {
    if (!SHAPE_BUILDERS[shape]) return
    const prevAlpha = this._mesh.material.opacity
    const prevTexture = this._texture
    const prevColor = this._mesh.material.color.clone()

    this.ctx.scene.remove(this._mesh)
    this._mesh.geometry.dispose()
    this._mesh.material.dispose()

    this._shape = shape
    this._buildMesh(shape, prevAlpha)
    if (prevTexture) {
      this._mesh.material.map = prevTexture
      this._mesh.material.color.set(0xffffff)
    } else {
      this._mesh.material.color.copy(prevColor)
    }
    this._mesh.material.needsUpdate = true
    this._applyTransform()
  }

  /** Position/rotation offset/scale are all applied on top of the
   *  shape's own base placement (centered at CENTER_Y) — a Position of
   *  (0,0,0) means "no additional offset," not "at the world origin." */
  _applyTransform () {
    if (!this._mesh) return
    this._mesh.position.set(
      this._position.x,
      CENTER_Y + this._position.y,
      this._position.z,
    )
    this._mesh.rotation.set(this._rotationOffset.x, this._rotationOffset.y, this._rotationOffset.z)
    this._mesh.scale.set(this._scale.x, this._scale.y, this._scale.z)
  }

  async _applyFromSlot (slot) {
    try {
      const record = await loadWallpaper(slot)
      if (!record) return
      const url = URL.createObjectURL(record.blob)
      this._applyImage(url, /* isObjectUrl */ true)
    } catch (err) {
      console.warn('⟐WallpaperSphere — failed to load wallpaper slot', slot, err)
    }
  }

  /** Loads and applies an image texture — used for the default asset,
   *  a regular URL, a data: URI, or an Object URL from the IndexedDB
   *  wallpaper browser (all handled the same way by TextureLoader). */
  _applyImage (url, isObjectUrl = false) {
    if (!url || url === this._imgUrl) return
    this._loader.load(
      url,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace
        this._texture?.dispose()
        if (this._imgUrlIsObjectUrl) URL.revokeObjectURL(this._imgUrl)
        this._texture = texture
        this._imgUrl = url
        this._imgUrlIsObjectUrl = isObjectUrl
        this._mesh.material.map = texture
        this._mesh.material.color.set(0xffffff)   // true color — don't tint the photo
        this._mesh.material.needsUpdate = true
      },
      undefined,
      (err) => console.warn('⟐WallpaperSphere — failed to load image:', url, err)
    )
  }

  _clearImage (fallbackColor) {
    this._texture?.dispose()
    if (this._imgUrlIsObjectUrl) URL.revokeObjectURL(this._imgUrl)
    this._texture = null
    this._imgUrl = ''
    this._mesh.material.map = null
    this._mesh.material.color.set(fallbackColor)
    this._mesh.material.needsUpdate = true
  }

  update (delta) {
    if (!this._mesh) return
    if (!this._spinX && !this._spinY && !this._spinZ) return
    const amount = this._rotationSpeed * this._direction * delta
    if (this._spinX) this._mesh.rotation.x += amount
    if (this._spinY) this._mesh.rotation.y += amount
    if (this._spinZ) this._mesh.rotation.z += amount
  }
  onResize () {}

  destroy () {
    window.removeEventListener('omni:wallpaper-settings-set', this._onSettingsSet)
    window.removeEventListener('omni:wallpaper-spin-direction', this._onSpinDirection)
    this._texture?.dispose()
    if (this._imgUrlIsObjectUrl) URL.revokeObjectURL(this._imgUrl)
    if (!this._mesh) return
    this.ctx.scene.remove(this._mesh)
    this._mesh.geometry.dispose()
    this._mesh.material.dispose()
  }
}
