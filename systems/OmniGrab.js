/**
 * systems/OmniGrab.js — ⟐OmniGrab
 *
 * Tier 1 of the Reality-grab ladder (architecture/HAND_TOGGLE_CONTROL_DESIGN.md),
 * made real: grab any reality, it jitters while held, drag it to an
 * OPEN hand and it condenses into that hand's own position — closed
 * hands are not valid drop targets at all.
 *
 * "Structural aspects of that hand manifest on the reality" is
 * explicitly left undefined for now, per the request — this system
 * only dispatches a real event (omni:reality-placed-in-hand) at the
 * moment of placement, carrying which hand and which node, so that
 * future logic can hook into it without this system needing to know
 * what each hand's own structural aspect actually is.
 *
 * Reuses OmniNode's own real mesh registry (getAllMeshes()) rather
 * than keeping a second, parallel list of the same objects. A hand
 * counts as "open" via its own dataset.handOpen attribute
 * (ui/Hand.js), set whenever its hamburger menu — that hand's own
 * main panel — toggles.
 *
 * Follows the standard module contract (constructor / init / update / destroy).
 */

import * as THREE from 'three'

const JITTER_AMOUNT   = 0.03   // world units — small, visible tremble, not violent shaking
const JITTER_SPEED    = 40     // how fast the jitter direction changes per second
const CONDENSE_SCALE  = 0.05   // how small a reality shrinks to once fully condensed into a hand
const RELEASE_DURATION = 0.25  // seconds — snap-back animation when dropped outside any open hand

export default class OmniGrab {
  /**
   * @param {object} context — shared scene/camera/renderer context
   * @param {object} omniNode — the real OmniNode system, for its mesh registry
   */
  constructor (context, omniNode) {
    this.ctx = context
    this.omniNode = omniNode

    this._raycaster = new THREE.Raycaster()
    this._mouse = new THREE.Vector2()
    this._dragPlane = new THREE.Plane()
    this._planeIntersect = new THREE.Vector3()

    this._grabbedMesh = null
    this._originalPosition = null
    this._originalScale = null
    this._jitterSeed = Math.random() * 1000
    this._jitterClock = 0
    this._isCondensing = false
    this._condensingIntoHandId = null
    this._releasing = false
    this._releaseElapsed = 0

    // Persistent — survives across grabs, unlike the transient drag
    // state above. The actual fix for "release it back to its
    // original spot": _endGrab() used to clear originalPosition to
    // null the instant a node was placed, losing it forever. Every
    // node currently sitting in a hand gets a real, durable entry
    // here instead: nodeId -> { mesh, originalPosition, originalScale, handId }.
    this._placedNodes = new Map()

    this._onPointerDown = null
    this._onPointerMove = null
    this._onPointerUp = null
  }

  init () {
    this._onPointerDown = (e) => this._handlePointerDown(e)
    this._onPointerMove = (e) => this._handlePointerMove(e)
    this._onPointerUp = (e) => this._handlePointerUp(e)

    window.addEventListener('mousedown', this._onPointerDown)
    window.addEventListener('mousemove', this._onPointerMove)
    window.addEventListener('mouseup', this._onPointerUp)
  }

  update (delta) {
    if (!this._grabbedMesh) return

    if (this._releasing) {
      this._releaseElapsed += delta
      const t = Math.min(1, this._releaseElapsed / RELEASE_DURATION)
      this._grabbedMesh.position.lerpVectors(this._grabbedMesh.userData.releaseFrom, this._originalPosition, t)
      this._grabbedMesh.scale.lerpVectors(this._grabbedMesh.userData.releaseScaleFrom, this._originalScale, t)
      if (t >= 1) this._endGrab()
      return
    }

    // Jitter — a continuous small tremble while genuinely held,
    // applied on top of whatever the current target position is
    // (dragging normally, or condensing into a hand). Accumulates its
    // own internal clock from delta, matching every other module in
    // this project — performance.now() would jitter identically
    // across frames that happen to land in the same millisecond,
    // which is a real, common occurrence at high frame rates, not a
    // rare edge case.
    this._jitterClock += delta
    const time = this._jitterClock
    const jx = (Math.sin(time * JITTER_SPEED + this._jitterSeed) ) * JITTER_AMOUNT
    const jy = (Math.cos(time * JITTER_SPEED * 1.3 + this._jitterSeed)) * JITTER_AMOUNT
    const jz = (Math.sin(time * JITTER_SPEED * 0.7 + this._jitterSeed)) * JITTER_AMOUNT
    this._grabbedMesh.position.set(
      this._grabbedMesh.userData.targetPosition.x + jx,
      this._grabbedMesh.userData.targetPosition.y + jy,
      this._grabbedMesh.userData.targetPosition.z + jz,
    )
  }

  onResize () {}

  destroy () {
    window.removeEventListener('mousedown', this._onPointerDown)
    window.removeEventListener('mousemove', this._onPointerMove)
    window.removeEventListener('mouseup', this._onPointerUp)
  }

  _setMouseFromEvent (e) {
    this._mouse.x = (e.clientX / window.innerWidth) * 2 - 1
    this._mouse.y = -(e.clientY / window.innerHeight) * 2 + 1
  }

  _handlePointerDown (e) {
    if (this._grabbedMesh) return   // already holding something
    this._setMouseFromEvent(e)
    this._raycaster.setFromCamera(this._mouse, this.ctx.camera)

    const meshes = this.omniNode?.getAllMeshes?.() ?? []
    const hits = this._raycaster.intersectObjects(meshes, false)
    if (!hits.length) return

    this.grabMesh(hits[0].object)
  }

  /** Real, public grab-start — usable by anything, not just a
   *  raycasted mousedown. This is what ToolTipMenu's QuickActionMenu
   *  "Grab" button actually calls, so a button click produces the
   *  exact same grab (same jitter, same condense-into-hand behavior)
   *  as grabbing the object directly in the scene. */
  grabMesh (mesh) {
    if (!mesh || this._grabbedMesh) return
    this._grabbedMesh = mesh
    this._originalPosition = mesh.position.clone()
    this._originalScale = mesh.scale.clone()
    mesh.userData.targetPosition = mesh.position.clone()
    mesh.userData.targetScale = mesh.scale.clone()

    // Drag plane faces the camera, at the grabbed mesh's own current
    // depth — the object follows the mouse naturally in screen space
    // rather than snapping onto an unrelated surface like the floor.
    const camDir = new THREE.Vector3()
    this.ctx.camera.getWorldDirection(camDir)
    this._dragPlane.setFromNormalAndCoplanarPoint(camDir, mesh.position)

    window.dispatchEvent(new CustomEvent('omni:reality-grabbed', { detail: { mesh } }))
  }

  /** The real fix for "the nodes don't go to the hands" — direct,
   *  menu-driven placement, no dragging required at all. Bypasses
   *  open-hand detection and screen-position dragging entirely; the
   *  explicit menu choice itself is the permission, not a hand's
   *  own open/closed visual state. Reuses the exact same real
   *  condense mechanics (scale, hide, dispatch, persistent record)
   *  the drag path already uses, so both paths stay in one real
   *  system, not two. */
  sendToHand (mesh, handId) {
    if (!mesh) return
    const handEl = document.getElementById(`omni-hand-${handId}`)
    if (!handEl) return
    const originalPosition = mesh.position.clone()
    const originalScale = mesh.scale.clone()
    const rect = handEl.getBoundingClientRect()
    const worldPoint = this._screenPointToWorld(rect, mesh.position)

    mesh.position.copy(worldPoint)
    mesh.scale.setScalar(CONDENSE_SCALE)
    mesh.visible = false

    const nodeId = mesh.userData.nodeId
    if (nodeId) this._placedNodes.set(nodeId, { mesh, originalPosition, originalScale, handId })

    window.dispatchEvent(new CustomEvent('omni:reality-placed-in-hand', { detail: { mesh, handId } }))
  }

  /** The other real fix — releasing a node back to its actual
   *  original spot, now genuinely possible since that data survives
   *  in _placedNodes instead of being cleared the instant the node
   *  was placed. */
  releaseFromHand (nodeId) {
    const entry = this._placedNodes.get(nodeId)
    if (!entry) return
    entry.mesh.visible = true
    entry.mesh.position.copy(entry.originalPosition)
    entry.mesh.scale.copy(entry.originalScale)
    this._placedNodes.delete(nodeId)
    window.dispatchEvent(new CustomEvent('omni:reality-released-from-hand', { detail: { mesh: entry.mesh, nodeId } }))
  }

  isPlaced (nodeId) {
    return this._placedNodes.has(nodeId)
  }

  _handlePointerMove (e) {
    if (!this._grabbedMesh || this._releasing) return
    this._setMouseFromEvent(e)
    this._raycaster.setFromCamera(this._mouse, this.ctx.camera)

    const hitHand = this._findOpenHandUnderPointer(e.clientX, e.clientY)

    if (hitHand) {
      // Condensing — shrink and move toward that hand's own screen
      // position. Closed hands were already excluded by
      // _findOpenHandUnderPointer, so reaching here means this is a
      // genuinely valid target.
      this._isCondensing = true
      this._condensingIntoHandId = hitHand.id
      const handWorldPoint = this._screenPointToWorld(hitHand.rect, this._grabbedMesh.position)
      this._grabbedMesh.userData.targetPosition.copy(handWorldPoint)
      this._grabbedMesh.scale.lerp(new THREE.Vector3(CONDENSE_SCALE, CONDENSE_SCALE, CONDENSE_SCALE), 0.25)
    } else {
      this._isCondensing = false
      this._condensingIntoHandId = null
      if (this._raycaster.ray.intersectPlane(this._dragPlane, this._planeIntersect)) {
        this._grabbedMesh.userData.targetPosition.copy(this._planeIntersect)
      }
      this._grabbedMesh.scale.lerp(this._originalScale, 0.25)
    }
  }

  _handlePointerUp () {
    if (!this._grabbedMesh) return

    if (this._isCondensing && this._condensingIntoHandId) {
      // Real placement — snap fully in, dispatch the real event, and
      // hide the mesh (not remove it) since what a hand's structural
      // aspect actually does to a placed reality is explicitly
      // undefined for now; hiding keeps this reversible for whatever
      // that turns out to require.
      this._grabbedMesh.scale.setScalar(CONDENSE_SCALE)
      this._grabbedMesh.visible = false
      const nodeId = this._grabbedMesh.userData.nodeId
      if (nodeId) {
        this._placedNodes.set(nodeId, {
          mesh: this._grabbedMesh,
          originalPosition: this._originalPosition.clone(),
          originalScale: this._originalScale.clone(),
          handId: this._condensingIntoHandId,
        })
      }
      window.dispatchEvent(new CustomEvent('omni:reality-placed-in-hand', {
        detail: { mesh: this._grabbedMesh, handId: this._condensingIntoHandId }
      }))
      this._endGrab()
      return
    }

    // Released outside any open hand — snap back to where it started,
    // a safe, reversible default rather than dropping in place.
    this._releasing = true
    this._releaseElapsed = 0
    this._grabbedMesh.userData.releaseFrom = this._grabbedMesh.position.clone()
    this._grabbedMesh.userData.releaseScaleFrom = this._grabbedMesh.scale.clone()
  }

  _endGrab () {
    window.dispatchEvent(new CustomEvent('omni:reality-released', { detail: { mesh: this._grabbedMesh } }))
    this._grabbedMesh = null
    this._originalPosition = null
    this._originalScale = null
    this._isCondensing = false
    this._condensingIntoHandId = null
    this._releasing = false
  }

  /** Real hands only — a hand must have dataset.handOpen === 'true'
   *  (its own hamburger menu open) to ever be a valid drop target;
   *  closed hands are excluded entirely, not just visually declined. */
  _findOpenHandUnderPointer (x, y) {
    const hands = document.querySelectorAll('.omni-hand')
    for (const handEl of hands) {
      if (handEl.dataset.handOpen !== 'true') continue
      const rect = handEl.getBoundingClientRect()
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        const id = handEl.id.replace('omni-hand-', '')
        return { id, rect }
      }
    }
    return null
  }

  /** Unprojects a hand's own screen-space rect center into a 3D
   *  point at the grabbed mesh's current depth, so "condensing
   *  toward the hand" means something real in world space, not just
   *  a screen-space animation. */
  _screenPointToWorld (rect, referenceWorldPoint) {
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const ndcX = (cx / window.innerWidth) * 2 - 1
    const ndcY = -(cy / window.innerHeight) * 2 + 1

    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.ctx.camera)

    const camDir = new THREE.Vector3()
    this.ctx.camera.getWorldDirection(camDir)
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(camDir, referenceWorldPoint)

    const out = new THREE.Vector3()
    raycaster.ray.intersectPlane(plane, out)
    return out
  }
}
