/**
 * modules/WallpaperSphere.js — ⟐mniReality Space Wallpaper
 *
 * A solid (not wireframe) sphere sitting just outside VoidBoundary's
 * wireframe sphere (radius 200) — the "wallpaper" backdrop of the main
 * space. Uses THREE.BackSide so it renders as a backdrop from inside,
 * same technique as VoidBoundary.
 *
 * Configurable entirely from the Admin Panel (⟐Admin → Space Wallpaper):
 * an RGBA color, plus image/video URL fields for a future texture.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * What's live vs. schema-only
 * ─────────────────────────────────────────────────────────────────────────────
 *   LIVE          — RGBA color (fully applied: color + opacity)
 *   SCHEMA-ONLY   — imgUrl / videoUrl (stored, not yet texture-mapped —
 *                   same deferred texture-pipeline work flagged for
 *                   ObjectPanel's media fields and Inspector's space
 *                   image; see BACKLOG.md)
 *
 * Follows the standard module contract (constructor / init / update / destroy).
 */

import * as THREE from 'three'

const CENTER_Y = 28        // matches VoidBoundary / RootSpace
const RADIUS   = 210       // slightly larger than VoidBoundary's sphere (200)

const DEFAULT_COLOR = '#445566'
const DEFAULT_ALPHA = 0.4

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
    this._onAdminSaved = null
  }

  init () {
    const saved = readAdminSettings()?.wallpaper

    const geo = new THREE.SphereGeometry(RADIUS, 32, 32)
    const mat = new THREE.MeshBasicMaterial({
      color: saved?.color ?? DEFAULT_COLOR,
      transparent: true,
      opacity: saved?.alpha ?? DEFAULT_ALPHA,
      side: THREE.BackSide,
    })
    this._sphere = new THREE.Mesh(geo, mat)
    this._sphere.position.set(0, CENTER_Y, 0)
    this.ctx.scene.add(this._sphere)

    // Stored for a future texture pass — not applied to the material yet.
    this._imgUrl   = saved?.imgUrl ?? ''
    this._videoUrl = saved?.videoUrl ?? ''

    this._onAdminSaved = (e) => {
      const w = e.detail?.wallpaper
      if (!w) return
      if (w.color !== undefined) this._sphere.material.color.set(w.color)
      if (w.alpha !== undefined) this._sphere.material.opacity = w.alpha
      this._imgUrl   = w.imgUrl ?? this._imgUrl
      this._videoUrl = w.videoUrl ?? this._videoUrl
    }
    window.addEventListener('omni:admin-settings-saved', this._onAdminSaved)
  }

  update () {}
  onResize () {}

  destroy () {
    window.removeEventListener('omni:admin-settings-saved', this._onAdminSaved)
    if (!this._sphere) return
    this.ctx.scene.remove(this._sphere)
    this._sphere.geometry.dispose()
    this._sphere.material.dispose()
  }
}
