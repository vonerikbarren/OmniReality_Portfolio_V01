/**
 * modules/AccountLoginCryptx.js — the real, spatial half of Login
 *
 * "For the scene we can have a cylinder come and be stuck to the
 * side of the screen and the user fills out an OmniCryptx for their
 * login in tandem to their username and password."
 *
 * A real cylinder, screen-docked (repositioned every frame relative
 * to the camera, not world-space — the actual mechanism a HUD
 * element needs to stay stuck to one side of the screen regardless
 * of camera movement). A real OmniCryptx instance spawns beside it;
 * its own real drill-down selections (`omni:cryptx-drilled-in`) are
 * tracked as the user's actual login pattern, not a simulated one.
 */

import * as THREE from 'three'
import OmniCryptx from './OmniCryptx.js'

const CYLINDER_RADIUS = 0.35
const CYLINDER_HEIGHT = 2.6
const DOCK_SIDE_OFFSET = 1.4    // world units to the side, at the docked distance
const DOCK_FORWARD_DISTANCE = 3.2
const DOCK_VERTICAL_OFFSET = -0.3

export default class AccountLoginCryptx {
  constructor (context) {
    this.ctx = context
    this.group = null
    this.cylinderMesh = null
    this.cryptx = null
    this._pattern = []   // real sequence of { ringType, depth } the user has actually drilled through
    this._onDrilledIn = null
    this._active = false
  }

  init () {
    this._onDrilledIn = (e) => {
      if (!this._active) return
      this._pattern.push({ ringType: e.detail.ringType, depth: e.detail.depth })
      window.dispatchEvent(new CustomEvent('omni:login-cryptx-pattern-changed', { detail: { pattern: [...this._pattern] } }))
    }
    window.addEventListener('omni:cryptx-drilled-in', this._onDrilledIn)
  }

  /** Spawns the real cylinder and a real OmniCryptx instance beside
   *  it — called when the Login panel actually opens, not eagerly at
   *  app start, matching how every other on-demand 3D component in
   *  this project spawns only when actually needed. */
  activate () {
    if (this._active) return
    this._active = true
    this._pattern = []

    this.group = new THREE.Group()
    this.ctx.scene.add(this.group)

    const geo = new THREE.CylinderGeometry(CYLINDER_RADIUS, CYLINDER_RADIUS, CYLINDER_HEIGHT, 24)
    const mat = new THREE.MeshStandardMaterial({ color: 0x7fd8ff, roughness: 0.3, metalness: 0.4, emissive: 0x1a4a5c, emissiveIntensity: 0.3 })
    this.cylinderMesh = new THREE.Mesh(geo, mat)
    this.group.add(this.cylinderMesh)

    this._updateDockPosition()   // real, correct position immediately — not one frame late

    const cryptxPos = this.group.position.clone()
    cryptxPos.x += 1.1   // beside the cylinder, not overlapping it
    this.cryptx = new OmniCryptx(this.ctx, { position: cryptxPos, ringTypes: ['Symbol', 'Number', 'typed password'] })
    this.cryptx.init()
  }

  /** Despawns everything real this created — called when the Login
   *  panel closes, so nothing lingers in the scene once the user has
   *  moved on. */
  deactivate () {
    if (!this._active) return
    this._active = false
    this.cryptx?.destroy()
    this.cryptx = null
    this.cylinderMesh?.geometry.dispose()
    this.cylinderMesh?.material.dispose()
    if (this.group) this.ctx.scene.remove(this.group)
    this.group = null
    this.cylinderMesh = null
  }

  getPattern () {
    return [...this._pattern]
  }

  clearPattern () {
    this._pattern = []
  }

  update (delta) {
    if (!this._active) return
    this._updateDockPosition()
    this.cryptx?.update(delta)
  }

  onResize () {}

  destroy () {
    window.removeEventListener('omni:cryptx-drilled-in', this._onDrilledIn)
    this.deactivate()
  }

  /** The real, actual docking mechanism — repositioned every frame
   *  relative to the camera's own current position/orientation, the
   *  standard technique for a HUD element that stays stuck to one
   *  side of the screen regardless of where the camera moves. */
  _updateDockPosition () {
    if (!this.group) return
    const camera = this.ctx.camera
    const forward = new THREE.Vector3()
    camera.getWorldDirection(forward)
    const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize()

    const dockPos = camera.position.clone()
      .add(forward.multiplyScalar(DOCK_FORWARD_DISTANCE))
      .add(right.multiplyScalar(DOCK_SIDE_OFFSET))
    dockPos.y += DOCK_VERTICAL_OFFSET

    this.group.position.copy(dockPos)
    this.group.quaternion.copy(camera.quaternion)   // faces the camera, matching how a real HUD element stays legible
  }
}
