/**
 * modules/WallpaperSphere.js — ⟐mniReality Space Wallpaper
 *
 * A solid (not wireframe) sphere sitting just outside VoidBoundary's
 * wireframe sphere (radius 200) — the "wallpaper" backdrop of the main
 * space. Uses THREE.BackSide so it renders as a backdrop from inside,
 * same technique as VoidBoundary.
 *
 * Configurable entirely from the Admin Panel (⟐Admin → Space Wallpaper):
 * an RGBA color, plus an uploaded image. Defaults to
 * assets/images/wallpaper-default.jpg (a starfield) until the user
 * uploads their own via Admin's file-browse control.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * The "image never shows up" bug — actual root cause
 * ─────────────────────────────────────────────────────────────────────────────
 * This was never a texture-loading problem. VoidBoundary's grid sphere
 * (radius 200) sits just inside this one (radius 210) and is wireframe +
 * transparent — but wireframe rendering only changes what gets DRAWN, not
 * what gets written to the depth buffer. Three.js still writes depth
 * across that sphere's FULL triangle surface, not just the visible
 * lines, so without depthWrite:false it silently occluded this entire
 * sphere behind it — texture loaded fine, it just could never be seen.
 * Fixed here (and in VoidBoundary.js) with depthWrite:false + explicit
 * renderOrder on all three concentric shells (cube/domain-grid/wallpaper)
 * so they always draw back-to-front regardless of Three.js's automatic
 * transparent-object sorting, which isn't reliable for objects centered
 * at the exact same point.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * What's live vs. schema-only
 * ─────────────────────────────────────────────────────────────────────────────
 *   LIVE          — RGBA color + alpha, image texture (works with both
 *                   a regular URL and a data: URI from Admin's file
 *                   upload — THREE.TextureLoader handles both the same way)
 *   SCHEMA-ONLY   — videoUrl (stored, not yet texture-mapped — genuine
 *                   video-texture playback is a bigger separate piece;
 *                   see BACKLOG.md)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Rotation
 * ─────────────────────────────────────────────────────────────────────────────
 * Y and Z axis auto-spin are ON by default (slow, ambient — 0.05 rad/s),
 * per request; X stays off unless enabled. Configurable from Admin
 * (⟐Admin → Space Wallpaper): a rotation speed plus per-axis auto-spin
 * toggles (X/Y/Z), same pattern as ui/OmniDraw's automatic-rotation
 * fields. Independently, the '(' and ')' keys (see main.js) flip a
 * direction multiplier live — a quick override on top of whatever Admin
 * has configured, not persisted, same "quick toggle vs. saved setting"
 * split as the User Space sphere's o/O keys.
 *
 * Follows the standard module contract (constructor / init / update / destroy).
 */

import * as THREE from 'three'

const CENTER_Y = 28        // matches VoidBoundary / RootSpace
const RADIUS   = 210       // slightly larger than VoidBoundary's sphere (200)

const DEFAULT_COLOR   = '#445566'
const DEFAULT_ALPHA   = 0.9
const DEFAULT_IMG_URL = './assets/images/wallpaper-default.jpg'

function readAdminSettings () {
  try {
    const raw = localStorage.getItem('omni:admin:settings')
    return raw ? JSON.parse(raw) : null
  } catch (_) { return null }
}

export default class WallpaperSphere {
  constructor (context) {
    this.ctx = context
    this._sphere = null
    this._texture = null
    this._loader = new THREE.TextureLoader()
    this._imgUrl = ''
    this._videoUrl = ''
    this._onAdminSaved = null
    this._onSpinDirection = null

    this._rotationSpeed = 0
    this._spinX = false
    this._spinY = false
    this._spinZ = false
    this._direction = 1   // flipped live by '(' / ')', not persisted
  }

  init () {
    const saved = readAdminSettings()?.wallpaper

    const geo = new THREE.SphereGeometry(RADIUS, 32, 32)
    const mat = new THREE.MeshBasicMaterial({
      color: DEFAULT_COLOR,
      transparent: true,
      opacity: saved?.alpha ?? DEFAULT_ALPHA,
      side: THREE.BackSide,
      depthWrite: false,
    })
    this._sphere = new THREE.Mesh(geo, mat)
    this._sphere.position.set(0, CENTER_Y, 0)
    this._sphere.renderOrder = -2   // between the cube (-3) and domain grid (-1)
    this.ctx.scene.add(this._sphere)

    this._videoUrl = saved?.videoUrl ?? ''
    this._rotationSpeed = saved?.rotationSpeed ?? 0.05
    this._spinX = saved?.autoSpinX ?? false
    this._spinY = saved?.autoSpinY ?? true
    this._spinZ = saved?.autoSpinZ ?? true

    // Falls back to the shipped starfield default until the user
    // uploads their own via Admin — "put this as the default" per request.
    // Using || rather than ?? deliberately: a previously-saved EMPTY
    // STRING (e.g. from clicking Save in Admin before this default image
    // existed) must also fall through to the default, not just
    // null/undefined — ?? only catches the latter, which was the actual
    // bug behind the starfield never appearing.
    this._applyImage(saved?.imgUrl || DEFAULT_IMG_URL)
    if (!saved?.imgUrl) {
      // No saved override — color/alpha still apply as a plain tint if
      // an admin later clears the image, so keep them current too.
      this._sphere.material.color.set(saved?.color ?? DEFAULT_COLOR)
    }

    this._onAdminSaved = (e) => {
      const w = e.detail?.wallpaper
      if (!w) return
      if (w.alpha !== undefined) this._sphere.material.opacity = w.alpha
      this._videoUrl = w.videoUrl ?? this._videoUrl
      if (w.rotationSpeed !== undefined) this._rotationSpeed = w.rotationSpeed
      if (w.autoSpinX !== undefined) this._spinX = w.autoSpinX
      if (w.autoSpinY !== undefined) this._spinY = w.autoSpinY
      if (w.autoSpinZ !== undefined) this._spinZ = w.autoSpinZ
      // Admin's own default for imgUrl is now the real asset path (see
      // AdminPanel.js DEFAULTS), not an ambiguous empty string — so an
      // empty value here can only mean the user explicitly hit Clear,
      // never "this field was just never touched."
      if (w.imgUrl) this._applyImage(w.imgUrl)
      else if (w.imgUrl === '') this._clearImage(w.color ?? DEFAULT_COLOR)
      else if (w.color !== undefined && !this._texture) {
        this._sphere.material.color.set(w.color)
      }
    }
    window.addEventListener('omni:admin-settings-saved', this._onAdminSaved)

    // '(' / ')' quick direction override — see main.js
    this._onSpinDirection = (e) => {
      this._direction = e.detail?.direction ?? 1
      // Make the keys immediately useful even if nothing's enabled yet.
      if (!this._spinX && !this._spinY && !this._spinZ) this._spinY = true
      if (!this._rotationSpeed) this._rotationSpeed = 0.3
    }
    window.addEventListener('omni:wallpaper-spin-direction', this._onSpinDirection)
  }

  /** Loads and applies an image texture — used for both the default
   *  asset and anything uploaded via Admin (works the same whether
   *  `url` is a regular path or a data: URI from a file upload). */
  _applyImage (url) {
    if (!url || url === this._imgUrl) return
    this._loader.load(
      url,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace
        this._texture?.dispose()
        this._texture = texture
        this._imgUrl = url
        this._sphere.material.map = texture
        this._sphere.material.color.set(0xffffff)   // true color — don't tint the photo
        this._sphere.material.needsUpdate = true
      },
      undefined,
      (err) => console.warn('⟐WallpaperSphere — failed to load image:', url, err)
    )
  }

  _clearImage (fallbackColor) {
    this._texture?.dispose()
    this._texture = null
    this._imgUrl = ''
    this._sphere.material.map = null
    this._sphere.material.color.set(fallbackColor)
    this._sphere.material.needsUpdate = true
  }

  update (delta) {
    if (!this._sphere) return
    if (!this._spinX && !this._spinY && !this._spinZ) return
    const amount = this._rotationSpeed * this._direction * delta
    if (this._spinX) this._sphere.rotation.x += amount
    if (this._spinY) this._sphere.rotation.y += amount
    if (this._spinZ) this._sphere.rotation.z += amount
  }
  onResize () {}

  destroy () {
    window.removeEventListener('omni:admin-settings-saved', this._onAdminSaved)
    window.removeEventListener('omni:wallpaper-spin-direction', this._onSpinDirection)
    this._texture?.dispose()
    if (!this._sphere) return
    this.ctx.scene.remove(this._sphere)
    this._sphere.geometry.dispose()
    this._sphere.material.dispose()
  }
}
