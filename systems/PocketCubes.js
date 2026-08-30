/**
 * systems/PocketCubes.js — ⟐mniReality Pocket Cubes
 *
 * Minimal first pass at the "pocket" concept: an ACNH-style storage system
 * where extracted nodes become empty containers ("folders") the user will
 * eventually build realities inside of. This file is intentionally a thin
 * placeholder — see BACKLOG at the bottom for the actual target feature.
 *
 * Current behavior (this pass only):
 *   omni:node-extracted   { id, node }  → spawn an empty wireframe cube
 *   omni:node-reinstated  { id }        → remove its cube
 *   click on a cube                     → toggle continuous blink
 *
 * Follows the standard module contract (constructor / init / update / destroy).
 */

import * as THREE from 'three'
import gsap       from 'gsap'

const CUBE_SIZE   = 0.6
const ROW_START   = [-4, 1.4, -8]   // world position of the first cube
const ROW_SPACING = 1.0             // x-offset between cubes in the row
const CUBE_COLOR  = 0x8a8a9a

export default class PocketCubes {
  constructor (context) {
    this.ctx = context

    this._cubes       = new Map()   // id -> { mesh, blinking, tween }
    this._raycaster    = new THREE.Raycaster()
    this._mouse         = new THREE.Vector2()

    this._onExtracted  = null
    this._onReinstated = null
    this._onMouseClick = null
  }

  init () {
    this._bindEvents()
  }

  update () {
    // Blink tweens are GSAP-driven — nothing needed per frame.
  }

  onResize () {}

  destroy () {
    window.removeEventListener('omni:node-extracted',  this._onExtracted)
    window.removeEventListener('omni:node-reinstated', this._onReinstated)

    const canvas = this.ctx.renderer?.domElement
    canvas?.removeEventListener('click', this._onMouseClick)

    for (const entry of this._cubes.values()) this._disposeCube(entry)
    this._cubes.clear()
  }

  // ── Setup ──────────────────────────────────────────────────────────────

  _bindEvents () {
    this._onExtracted  = (e) => this._spawnCube(e.detail?.id, e.detail?.node)
    this._onReinstated = (e) => this._removeCube(e.detail?.id)
    this._onMouseClick = (e) => this._handleClick(e)

    window.addEventListener('omni:node-extracted',  this._onExtracted)
    window.addEventListener('omni:node-reinstated', this._onReinstated)

    const canvas = this.ctx.renderer?.domElement
    canvas?.addEventListener('click', this._onMouseClick)
  }

  // ── Spawn / remove ────────────────────────────────────────────────────

  _spawnCube (id, node) {
    if (!id || this._cubes.has(id)) return

    const index = this._cubes.size
    const geo   = new THREE.BoxGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE)
    const edges = new THREE.EdgesGeometry(geo)
    const mesh  = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: CUBE_COLOR, transparent: true, opacity: 0.85 })
    )

    // Invisible solid box layered underneath purely so raycasting can hit
    // something filled — LineSegments alone doesn't register clean hits.
    const hitMesh = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({ visible: false })
    )
    mesh.add(hitMesh)
    hitMesh.userData.pocketId = id

    mesh.position.set(
      ROW_START[0] + index * ROW_SPACING,
      ROW_START[1],
      ROW_START[2],
    )
    mesh.userData.pocketId = id
    mesh.userData.nodeLabel = node?.label ?? id

    this.ctx.scene.add(mesh)
    this._cubes.set(id, { mesh, hitMesh, blinking: false, tween: null })
  }

  _removeCube (id) {
    const entry = this._cubes.get(id)
    if (!entry) return
    this._disposeCube(entry)
    this._cubes.delete(id)
    this._repackRow()
  }

  _disposeCube (entry) {
    entry.tween?.kill()
    this.ctx.scene.remove(entry.mesh)
    entry.mesh.geometry?.dispose()
    entry.mesh.material?.dispose()
    entry.hitMesh?.geometry?.dispose()
    entry.hitMesh?.material?.dispose()
  }

  /** Re-space remaining cubes so removing one doesn't leave a gap. */
  _repackRow () {
    let i = 0
    for (const entry of this._cubes.values()) {
      entry.mesh.position.x = ROW_START[0] + i * ROW_SPACING
      i++
    }
  }

  // ── Click → toggle blink ─────────────────────────────────────────────────

  _handleClick (e) {
    const canvas = this.ctx.renderer.domElement
    const rect   = canvas.getBoundingClientRect()
    this._mouse.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1
    this._mouse.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1

    this._raycaster.setFromCamera(this._mouse, this.ctx.camera)

    const hitMeshes = [...this._cubes.values()].map(c => c.hitMesh)
    const hits = this._raycaster.intersectObjects(hitMeshes, false)
    if (hits.length === 0) return

    const id = hits[0].object.userData.pocketId
    this._toggleBlink(id)
  }

  _toggleBlink (id) {
    const entry = this._cubes.get(id)
    if (!entry) return

    if (entry.blinking) {
      entry.tween?.kill()
      entry.tween = null
      entry.blinking = false
      gsap.to(entry.mesh.material, { opacity: 0.85, duration: 0.2 })
    } else {
      entry.blinking = true
      entry.tween = gsap.to(entry.mesh.material, {
        opacity: 0.15,
        duration: 0.4,
        ease: 'sine.inOut',
        repeat: -1,
        yoyo: true,
      })
    }
  }
}

// ── BACKLOG — real Pocket system spec (per user, Aug 2026) ────────────────
//
// This is a first-pass stand-in only. The intended feature:
//
//   - Pockets are empty-cube "containers" (like folders) that will hold
//     the realities being built in this project — ACNH-style storage,
//     but visualized as cubes in-world rather than a 2D inventory grid.
//   - The UI needs a mode where the user can connect cubes together to
//     form a grid layout (adjacent cubes snapping into a lattice).
//   - Also needs a radial-segment arrangement mode — cubes arranged
//     around a center point instead of a grid.
//   - Cube size needs to be adjustable.
//   - All of the above (grid/radial layout choice, size) should be
//     controllable either from OmniInspector (when a cube/pocket node is
//     selected) or from a small contextual menu that appears on the cube
//     itself — user hasn't decided which yet, may want both.
//
// None of this is built yet. This file only proves the extraction →
// visible-cube → click-to-blink pipeline works end to end.
