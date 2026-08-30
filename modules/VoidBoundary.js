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
 * they're the "outside the main tunnel, out in the void" landmarks —
 * wireframe + low opacity, so they don't occlude anything and stay cheap
 * (two meshes, no per-frame work).
 *
 * The sphere's color ("the domain grid") is configurable from the Admin
 * Panel (⟐Admin → Domain Grid Color) — read from persisted settings on
 * init, and live-updated on omni:admin-settings-saved.
 *
 * Follows the standard module contract (constructor / init / update / destroy).
 */

import * as THREE from 'three'

const CENTER_Y       = 28     // matches RootSpace's CYLINDER_Y
const SPHERE_RADIUS  = 200    // 2x — well outside the tunnel's OUTER_RADIUS (38)
const CUBE_SIZE      = 600    // 2x — half-extent 300, larger than the sphere

const SPHERE_COLOR_DEFAULT = 0x888888   // grey, per request — admin-overridable
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
  }

  init () {
    const saved = readAdminSettings()
    const sphereColor = saved?.domainGridColor ?? SPHERE_COLOR_DEFAULT

    const sphereGeo = new THREE.SphereGeometry(SPHERE_RADIUS, 32, 32)
    const sphereMat = new THREE.MeshBasicMaterial({
      color: sphereColor,
      wireframe: true,
      transparent: true,
      opacity: 0.35,
      side: THREE.BackSide,
    })
    this._sphere = new THREE.Mesh(sphereGeo, sphereMat)
    this._sphere.position.set(0, CENTER_Y, 0)
    this.ctx.scene.add(this._sphere)

    const cubeGeo = new THREE.BoxGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE)
    const cubeMat = new THREE.MeshBasicMaterial({
      color: CUBE_COLOR,
      wireframe: true,
      transparent: true,
      opacity: 0.22,
      side: THREE.BackSide,
    })
    this._cube = new THREE.Mesh(cubeGeo, cubeMat)
    this._cube.position.set(0, CENTER_Y, 0)
    this.ctx.scene.add(this._cube)

    this._onAdminSaved = (e) => {
      const color = e.detail?.domainGridColor
      if (color) this._sphere.material.color.set(color)
    }
    window.addEventListener('omni:admin-settings-saved', this._onAdminSaved)
  }

  update () {
    // Static shells — nothing needed per frame.
  }

  onResize () {}

  destroy () {
    window.removeEventListener('omni:admin-settings-saved', this._onAdminSaved)
    for (const mesh of [this._sphere, this._cube]) {
      if (!mesh) continue
      this.ctx.scene.remove(mesh)
      mesh.geometry.dispose()
      mesh.material.dispose()
    }
  }
}
