/**
 * modules/UserSpaceSphere.js — ⟐mniReality User Space
 *
 * A semi-transparent wireframe sphere that follows the camera — the
 * user's personal "bubble." Position is synced to the camera every
 * frame (cheap: one mesh, one position copy), so it always surrounds
 * wherever the user currently is.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Default size — derived from the camera's actual FOV, not a guess
 * ─────────────────────────────────────────────────────────────────────────────
 *   The camera's real FOV (scene/BaseScene.js) is 60° — matching the
 *   "at least 60 deg field view" requirement exactly, which is very
 *   unlikely to be a coincidence. Radius is computed so that, viewed
 *   from a comfortable distance, the sphere fills that full 60°:
 *
 *     radius = viewDistance * tan(fov / 2)
 *
 *   viewDistance = 4 — the same "comfortable interaction distance" the
 *   project already uses elsewhere (NodeManager's own orbit-target
 *   offset is `camera.position + forward * 4`), reused here rather than
 *   inventing a new arbitrary constant. With fov = 60°, that gives a
 *   radius of ~2.31 units. Adjustable via the Admin Panel's size option
 *   (a multiplier on top of this computed base, not a replacement for
 *   it — so "increase the size" still starts from a FOV-correct default).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * What's live vs. schema-only
 * ─────────────────────────────────────────────────────────────────────────────
 *   LIVE        — color, radius multiplier, spin on/off, 50% default opacity
 *   SCHEMA-ONLY — textureUrl (stored, not yet texture-mapped — same
 *                 deferred pipeline as WallpaperSphere/ObjectPanel media)
 *
 * Follows the standard module contract (constructor / init / update / destroy).
 */

import * as THREE from 'three'

const VIEW_DISTANCE   = 4       // matches NodeManager's own orbit-target offset
const DEFAULT_COLOR   = '#7fd8ff'
const DEFAULT_OPACITY = 0.5
const SPIN_SPEED      = 0.15    // rad/sec

function readAdminSettings () {
  try {
    const raw = localStorage.getItem('omni:admin:settings')
    return raw ? JSON.parse(raw) : null
  } catch (_) { return null }
}

export default class UserSpaceSphere {
  constructor (context) {
    this.ctx = context
    this._sphere  = null
    this._spinning = true
    this._baseRadius = 1
    this._sizeMultiplier = 1
    this._textureUrl = ''
    this._onAdminSaved = null
    this._onStopSpin = null
  }

  init () {
    const fovRad = THREE.MathUtils.degToRad(this.ctx.camera.fov ?? 60)
    this._baseRadius = VIEW_DISTANCE * Math.tan(fovRad / 2)

    const saved = readAdminSettings()?.userSpace
    this._sizeMultiplier = saved?.sizeMultiplier ?? 1
    this._spinning        = saved?.spinning ?? true
    this._textureUrl      = saved?.textureUrl ?? ''

    const geo = new THREE.SphereGeometry(this._baseRadius * this._sizeMultiplier, 24, 24)
    const mat = new THREE.MeshBasicMaterial({
      color: saved?.color ?? DEFAULT_COLOR,
      wireframe: true,   // default, per request — texture is a future option
      transparent: true,
      opacity: DEFAULT_OPACITY,
      side: THREE.DoubleSide,
    })
    this._sphere = new THREE.Mesh(geo, mat)
    this._sphere.position.copy(this.ctx.camera.position)
    this.ctx.scene.add(this._sphere)

    this._onAdminSaved = (e) => {
      const u = e.detail?.userSpace
      if (!u) return
      if (u.color !== undefined) this._sphere.material.color.set(u.color)
      if (u.spinning !== undefined) this._spinning = u.spinning
      if (u.textureUrl !== undefined) this._textureUrl = u.textureUrl
      if (u.sizeMultiplier !== undefined && u.sizeMultiplier !== this._sizeMultiplier) {
        this._sizeMultiplier = u.sizeMultiplier
        this._sphere.geometry.dispose()
        this._sphere.geometry = new THREE.SphereGeometry(this._baseRadius * this._sizeMultiplier, 24, 24)
      }
    }
    window.addEventListener('omni:admin-settings-saved', this._onAdminSaved)

    // Also a direct toggle, independent of the Admin Panel's save-gated
    // flow — "make sure there is a button to stop the rotation."
    this._onStopSpin = (e) => {
      this._spinning = e.detail?.spinning ?? !this._spinning
    }
    window.addEventListener('omni:userspace-toggle-spin', this._onStopSpin)
  }

  update (delta) {
    if (!this._sphere) return
    this._sphere.position.copy(this.ctx.camera.position)
    if (this._spinning) this._sphere.rotation.y += SPIN_SPEED * delta
  }

  onResize () {}

  destroy () {
    window.removeEventListener('omni:admin-settings-saved', this._onAdminSaved)
    window.removeEventListener('omni:userspace-toggle-spin', this._onStopSpin)
    if (!this._sphere) return
    this.ctx.scene.remove(this._sphere)
    this._sphere.geometry.dispose()
    this._sphere.material.dispose()
  }
}
