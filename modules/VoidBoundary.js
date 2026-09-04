/**
 * modules/VoidBoundary.js — ⟐mniReality Void Boundary Shapes
 *
 * Two large wireframe shells sitting out in the void, concentric with the
 * main tunnel (RootSpace) — a sphere, and a cube larger still around it.
 * Both use THREE.BackSide so they render correctly when the camera is
 * inside them (which, at these scales, it always is) rather than being
 * backface-culled.
 *
 * Centered at the same vertical origin as RootSpace's cylinder (Y = 28)
 * so they read as concentric with the tunnel rather than floating
 * arbitrarily. Radii are well outside RootSpace's OUTER_RADIUS (38), so
 * they're the "outside the main tunnel, out in the void" landmarks.
 *
 * The sphere ("the domain grid" — sits just inside the Wallpaper sphere)
 * is configurable from the Admin Panel (⟐Admin → Domain Grid): color,
 * wireframe on/off, and opacity — read from persisted settings on init,
 * live-updated on omni:admin-settings-saved. Its visibility also has a
 * direct keyboard toggle ('0' — see main.js), independent of Admin.
 *
 * Follows the standard module contract (constructor / init / update / destroy).
 */

import * as THREE from 'three'

const CENTER_Y       = 28     // matches RootSpace's CYLINDER_Y
const SPHERE_RADIUS  = 1000   // 5x — kept proportional to WallpaperSphere's new radius (1050)
const CUBE_SIZE      = 3000   // 5x — half-extent 1500, still larger than the sphere

const SPHERE_COLOR_DEFAULT   = 0x888888   // grey, per request — admin-overridable
const SPHERE_OPACITY_DEFAULT = 0.35
const CUBE_COLOR   = 0xbbbbbb   // slightly lighter, so the two read as distinct shells

function readAdminSettings () {
  try {
    const raw = localStorage.getItem('omni:admin:settings')
    return raw ? JSON.parse(raw) : null
  } catch (_) { return null }
}

export default class VoidBoundary {
  constructor (context) {
    this.ctx = context
    this._sphere = null
    this._cube   = null
    this._onAdminSaved = null
    this._onToggleVisible = null
  }

  init () {
    const saved = readAdminSettings()
    const sphereColor   = saved?.domainGridColor   ?? SPHERE_COLOR_DEFAULT
    const sphereOpacity = saved?.domainGridOpacity ?? SPHERE_OPACITY_DEFAULT
    const sphereWire    = saved?.domainGridWireframe ?? true
    const sphereVisible = saved?.domainGridVisible ?? false   // off by default, per request

    const sphereGeo = new THREE.SphereGeometry(SPHERE_RADIUS, 32, 32)
    const sphereMat = new THREE.MeshBasicMaterial({
      color: sphereColor,
      wireframe: sphereWire,
      transparent: true,
      opacity: sphereOpacity,
      side: THREE.BackSide,
      depthWrite: false,   // see note below — this was the actual wallpaper-image bug
    })
    this._sphere = new THREE.Mesh(sphereGeo, sphereMat)
    this._sphere.position.set(0, CENTER_Y, 0)
    this._sphere.renderOrder = -1   // draws after WallpaperSphere (-2), before normal scene content (0)
    this._sphere.visible = sphereVisible
    this.ctx.scene.add(this._sphere)

    const cubeGeo = new THREE.BoxGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE)
    const cubeMat = new THREE.MeshBasicMaterial({
      color: CUBE_COLOR,
      wireframe: true,
      transparent: true,
      opacity: 0.22,
      side: THREE.BackSide,
      depthWrite: false,
    })
    this._cube = new THREE.Mesh(cubeGeo, cubeMat)
    this._cube.position.set(0, CENTER_Y, 0)
    this._cube.renderOrder = -3   // outermost shell — draws first
    this.ctx.scene.add(this._cube)

    this._onAdminSaved = (e) => {
      const d = e.detail
      if (!d) return
      if (d.domainGridColor)              this._sphere.material.color.set(d.domainGridColor)
      if (d.domainGridOpacity !== undefined) this._sphere.material.opacity = d.domainGridOpacity
      if (d.domainGridWireframe !== undefined) {
        this._sphere.material.wireframe = d.domainGridWireframe
        this._sphere.material.needsUpdate = true
      }
      if (d.domainGridVisible !== undefined) this._sphere.visible = d.domainGridVisible
    }
    window.addEventListener('omni:admin-settings-saved', this._onAdminSaved)

    // Quick keyboard toggle ('0' in main.js) — independent of Admin's
    // save-gated flow, same pattern as the User Space sphere's o/O keys.
    this._onToggleVisible = (e) => {
      this._sphere.visible = e.detail?.visible ?? !this._sphere.visible
    }
    window.addEventListener('omni:domaingrid-toggle-visible', this._onToggleVisible)
  }

  update () {
    // Static shells — nothing needed per frame.
  }

  onResize () {}

  destroy () {
    window.removeEventListener('omni:admin-settings-saved', this._onAdminSaved)
    window.removeEventListener('omni:domaingrid-toggle-visible', this._onToggleVisible)
    for (const mesh of [this._sphere, this._cube]) {
      if (!mesh) continue
      this.ctx.scene.remove(mesh)
      mesh.geometry.dispose()
      mesh.material.dispose()
    }
  }
}
