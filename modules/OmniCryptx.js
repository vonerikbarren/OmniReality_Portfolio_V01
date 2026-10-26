/**
 * modules/OmniCryptx.js — ⟐OmniCryptx / OmniCryptexLab
 *
 * The core, tier-agnostic ring engine underneath AdminOmniCryptx,
 * StandardOmniCryptx, and CustomOmniCryptx (architecture/OMNICRYPTEXLAB_DESIGN.md)
 * — those three are different CONFIGURATIONS of this one engine, not
 * three separate engines.
 *
 * The astrolabe mechanic: rings share one axis, each rotating
 * independently, radius growing outward with depth in the sequence —
 * same "radius grows with depth" pattern the layer system already
 * uses, applied here to rotation instead of static nesting. Each
 * ring carries one marker (its current target point); clicking a
 * marker drills in, generating a new, smaller ring stack centered on
 * that marker specifically — "potentially infinite," not actually:
 * the next level is only ever built the moment it's needed, never in
 * advance.
 *
 * Reuses the project's existing raycast-click pattern (matching
 * OmniNode.js's own approach) rather than inventing a second one.
 *
 * Follows the standard module contract (constructor / init / update / destroy).
 */

import * as THREE from 'three'
import { generateId } from '../systems/OmniNode.js'
import { colorFor } from '../data/OmniCryptxTypes.js'

const BASE_RING_RADIUS   = 1.2   // innermost ring's own radius
const RING_RADIUS_STEP   = 0.8   // each successive ring adds this much radius
const RING_TUBE_RADIUS   = 0.04
const MARKER_RADIUS      = 0.12
const MIN_SPIN_SPEED     = 0.15  // rad/sec — slowest ring
const MAX_SPIN_SPEED     = 0.65  // rad/sec — fastest ring (innermost spins fastest, matches a real astrolabe/orrery feel)

export default class OmniCryptx {
  /**
   * @param {object} context — shared scene/camera/renderer context
   * @param {object} [config]
   * @param {string[]} [config.ringTypes] — one entry per ring, e.g. ['MasterKeySymbol','Symbol','Number']
   * @param {THREE.Vector3} [config.position] — world position of this stack's own center
   * @param {number} [config.depth=0] — nesting depth, purely informational (for labeling/debugging)
   * @param {OmniCryptx|null} [config.parent] — the stack this one was drilled into from, if any
   */
  constructor (context, config = {}) {
    this.ctx = context
    this.id = generateId()
    this.ringTypes = config.ringTypes ?? ['Symbol', 'Number', 'typed password']
    this.position = config.position ?? new THREE.Vector3(0, 0, 0)
    this.depth = config.depth ?? 0
    this.parent = config.parent ?? null

    this.group = null
    this._rings = []       // [{ type, mesh, marker, spinSpeed, radius }]
    this._child = null     // the currently drilled-into sub-stack, if any
    this._raycaster = new THREE.Raycaster()
    this._onClick = null
  }

  init () {
    this.group = new THREE.Group()
    this.group.position.copy(this.position)
    this.ctx.scene.add(this.group)

    this.ringTypes.forEach((type, i) => {
      const radius = BASE_RING_RADIUS + i * RING_RADIUS_STEP
      const color = colorFor(type)

      const geo = new THREE.TorusGeometry(radius, RING_TUBE_RADIUS, 8, 48)
      const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.2 })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.rotation.x = Math.PI / 2   // lay flat, shared axis = world Y, matching the astrolabe's stacked-rings feel
      this.group.add(mesh)

      const markerGeo = new THREE.SphereGeometry(MARKER_RADIUS, 12, 12)
      const markerMat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.6 })
      const marker = new THREE.Mesh(markerGeo, markerMat)
      marker.position.set(radius, 0, 0)   // sits ON the ring — this IS the ring's own target point
      marker.userData.omniCryptxRing = { stackId: this.id, type, index: i }
      mesh.add(marker)   // child of the ring mesh — rotates WITH it, not independently

      // Innermost ring spins fastest — real orrery/astrolabe feel,
      // not every ring moving at the same, flat rate.
      const t = this.ringTypes.length > 1 ? i / (this.ringTypes.length - 1) : 0
      const spinSpeed = MAX_SPIN_SPEED - t * (MAX_SPIN_SPEED - MIN_SPIN_SPEED)

      this._rings.push({ type, mesh, marker, spinSpeed, radius })
    })

    this._onClick = (e) => this._handleClick(e)
    window.addEventListener('click', this._onClick)
  }

  update (delta) {
    this._rings.forEach(ring => { ring.mesh.rotation.z += ring.spinSpeed * delta })
    this._child?.update(delta)
  }

  onResize () {}

  destroy () {
    window.removeEventListener('click', this._onClick)
    this._child?.destroy()
    this._rings.forEach(ring => {
      ring.mesh.geometry.dispose()
      ring.mesh.material.dispose()
      ring.marker.geometry.dispose()
      ring.marker.material.dispose()
    })
    this._rings = []
    if (this.group) this.ctx.scene.remove(this.group)
  }

  /** Drills OUT — disposes the currently-open child stack, returning
   *  to this one. The reverse of clicking a marker. */
  collapseChild () {
    this._child?.destroy()
    this._child = null
  }

  _handleClick (e) {
    if (!this._normalizedMouse) this._normalizedMouse = new THREE.Vector2()
    this._normalizedMouse.x = (e.clientX / window.innerWidth) * 2 - 1
    this._normalizedMouse.y = -(e.clientY / window.innerHeight) * 2 + 1
    this._raycaster.setFromCamera(this._normalizedMouse, this.ctx.camera)

    // If a child stack is open, its own markers take priority — drill
    // deeper before ever considering this level's own rings again.
    if (this._child) {
      const handledByChild = this._child._tryHandleOwnClick(this._raycaster)
      if (handledByChild) return
    }

    this._tryHandleOwnClick(this._raycaster)
  }

  /** Real hit-test against this stack's own markers only — factored
   *  out so a parent can ask a child to try first, matching how
   *  OmniNode's own click handling checks the nearest real target. */
  _tryHandleOwnClick (raycaster) {
    const markers = this._rings.map(r => r.marker)
    const hits = raycaster.intersectObjects(markers, false)
    if (!hits.length) return false

    const hitMarker = hits[0].object
    const { type, index } = hitMarker.userData.omniCryptxRing
    this._drillInto(index, type)
    return true
  }

  /** Generates a new, smaller ring stack centered on the clicked
   *  marker's real world position — built the moment it's needed,
   *  never in advance. Replaces any previously-open child. */
  _drillInto (ringIndex, ringType) {
    this.collapseChild()

    const markerWorldPos = new THREE.Vector3()
    this._rings[ringIndex].marker.getWorldPosition(markerWorldPos)

    // A drilled-in stack is deliberately smaller than its parent —
    // same ring types by default (a real schema for "what's inside
    // this specific ring" is still open, per the doc), scaled down
    // so the fractal nesting reads visually, not just structurally.
    const childTypes = this.ringTypes.slice(0, Math.max(1, this.ringTypes.length - 1))
    this._child = new OmniCryptx(this.ctx, {
      ringTypes: childTypes,
      position: markerWorldPos,
      depth: this.depth + 1,
      parent: this,
    })
    this._child.init()
    this._child.group.scale.setScalar(0.5)   // each level nests visually smaller, not just structurally deeper

    window.dispatchEvent(new CustomEvent('omni:cryptx-drilled-in', {
      detail: { parentId: this.id, childId: this._child.id, ringType, depth: this._child.depth }
    }))
  }
}
