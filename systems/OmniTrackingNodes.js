/**
 * systems/OmniTrackingNodes.js — ⟐Tracking Nodes
 *
 * Two real scene nodes that move on a continuous multi-axis path and
 * trail a motion-trail "afterimage" behind them as they go. Clicking
 * either one locks the camera onto it, Zelda-style — direct request,
 * explicitly echoing the existing Z-Targeting reticle in
 * modules/OmniTargeting.js (reused here as-is: a locked node is
 * reported through the same omni:node-selected event every other
 * selection mechanism already uses, so OmniTargeting's reticle just
 * shows up around it for free, no second targeting system built).
 *
 * Movement — direct request: "complete two iterations for the x and
 * one for the z and the Y is actually good too." Read as a real
 * Lissajous-style combined path: X oscillates at twice the frequency
 * of Z (two full back-and-forth sweeps on X for every one on Z), with
 * a continuous, independent Y bob layered on top so vertical motion
 * reads too, not just the X/Z sweep.
 *
 * Afterimage — a short-lived pool of fading ghost meshes spawned at a
 * fixed interval along the real path, each shrinking/fading over its
 * own lifetime and then disposed — the standard lightweight way to
 * get a trailing-afterimage look without a custom shader or
 * render-to-texture pass.
 *
 * Camera follow — reuses the app's own, already-established
 * omni:orbit-disable / omni:orbit-enable / omni:orbit-target-set
 * event trio (see utils/CameraTravel.js, systems/NodeManager.js) to
 * suspend OrbitControls while locked on, rather than a new, separate
 * camera-ownership mechanism.
 *
 * Follows the standard module contract (constructor / init / update / destroy).
 */

import * as THREE from 'three'

// ── Path constants ──────────────────────────────────────────────────────

const X_AMP = 14
const Z_AMP = 9
const Y_AMP = 2.5
const X_FREQ = 0.5   // 2 full iterations per Z iteration (ratio 2:1)
const Z_FREQ = X_FREQ / 2
const Y_FREQ = 0.35  // independent — "the Y is actually good too"

const NODE_RADIUS = 0.9

const NODES = [
  { id: 'tracking-a', label: 'Tracking Node A', color: 0x66ffe0, phase: 0, center: new THREE.Vector3(0, 6, 0) },
  { id: 'tracking-b', label: 'Tracking Node B', color: 0xff8cf0, phase: Math.PI, center: new THREE.Vector3(0, 6, 0) },
]

// ── Afterimage constants ────────────────────────────────────────────────

const GHOST_SPAWN_INTERVAL = 0.07  // seconds between ghost spawns
const GHOST_LIFETIME       = 0.55  // seconds a ghost lives before disposal

// ── Camera follow constants ─────────────────────────────────────────────

const FOLLOW_DISTANCE = 6
const FOLLOW_LERP     = 0.08 // per-frame smoothing toward the ideal follow position

export default class OmniTrackingNodes {
  constructor (context) {
    this.ctx = context
    this._group = null
    this._nodes = []        // [{ cfg, mesh, t, ghostTimer }]
    this._ghosts = []        // [{ mesh, age }]
    this._raycaster = new THREE.Raycaster()
    this._mouse = new THREE.Vector2()
    this._lockedId = null
    this._onCanvasClick = null
  }

  init () {
    this._group = new THREE.Group()
    this.ctx.scene.add(this._group)

    this._nodes = NODES.map(cfg => {
      const geo = new THREE.SphereGeometry(NODE_RADIUS, 20, 20)
      const mat = new THREE.MeshStandardMaterial({
        color: cfg.color, emissive: cfg.color, emissiveIntensity: 0.8,
        roughness: 0.3, metalness: 0.2,
      })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.userData.omniTrackingId = cfg.id
      mesh.userData.omniTrackingLabel = cfg.label
      mesh.position.copy(cfg.center)
      this._group.add(mesh)
      return { cfg, mesh, t: 0, ghostTimer: 0 }
    })

    const canvas = this.ctx.renderer.domElement
    this._onCanvasClick = (e) => this._handleClick(e)
    canvas.addEventListener('click', this._onCanvasClick)
  }

  update (delta) {
    this._nodes.forEach(n => this._advanceNode(n, delta))
    this._updateGhosts(delta)
    if (this._lockedId) this._updateFollowCamera()
  }

  onResize () {}

  destroy () {
    const canvas = this.ctx.renderer.domElement
    canvas.removeEventListener('click', this._onCanvasClick)
    this._nodes.forEach(n => { n.mesh.geometry.dispose(); n.mesh.material.dispose() })
    // Ghost meshes share their owning node's geometry (never cloned, only
    // the material is), so only their own cloned material is disposed
    // here — disposing the shared geometry again would be redundant with
    // the node-mesh cleanup just above.
    this._ghosts.forEach(g => { g.mesh.material.dispose() })
    if (this._group) {
      this.ctx.scene.remove(this._group)
    }
    if (this._lockedId) this._release()
  }

  // ── Motion ───────────────────────────────────────────────────────────

  _advanceNode (n, delta) {
    n.t += delta
    const { cfg, mesh } = n
    const x = cfg.center.x + X_AMP * Math.sin(n.t * X_FREQ * Math.PI * 2 + cfg.phase)
    const z = cfg.center.z + Z_AMP * Math.sin(n.t * Z_FREQ * Math.PI * 2 + cfg.phase)
    const y = cfg.center.y + Y_AMP * Math.sin(n.t * Y_FREQ * Math.PI * 2 + cfg.phase)
    mesh.position.set(x, y, z)

    n.ghostTimer += delta
    if (n.ghostTimer >= GHOST_SPAWN_INTERVAL) {
      n.ghostTimer = 0
      this._spawnGhost(n)
    }
  }

  _spawnGhost (n) {
    const ghostMat = n.mesh.material.clone()
    ghostMat.transparent = true
    ghostMat.opacity = 0.45
    ghostMat.depthWrite = false
    const ghostMesh = new THREE.Mesh(n.mesh.geometry, ghostMat)
    ghostMesh.position.copy(n.mesh.position)
    ghostMesh.scale.setScalar(1)
    this._group.add(ghostMesh)
    this._ghosts.push({ mesh: ghostMesh, age: 0 })
  }

  _updateGhosts (delta) {
    for (let i = this._ghosts.length - 1; i >= 0; i--) {
      const g = this._ghosts[i]
      g.age += delta
      const t = g.age / GHOST_LIFETIME
      if (t >= 1) {
        this._group.remove(g.mesh)
        g.mesh.material.dispose()
        this._ghosts.splice(i, 1)
        continue
      }
      g.mesh.material.opacity = 0.45 * (1 - t)
      const scale = 1 - t * 0.5
      g.mesh.scale.setScalar(scale)
    }
  }

  // ── Click to lock / camera follow ───────────────────────────────────

  _handleClick (e) {
    const canvas = this.ctx.renderer.domElement
    const rect = canvas.getBoundingClientRect()
    this._mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
    this._mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
    this._raycaster.setFromCamera(this._mouse, this.ctx.camera)
    const meshes = this._nodes.map(n => n.mesh)
    const hits = this._raycaster.intersectObjects(meshes, false)

    if (hits.length) {
      const hitId = hits[0].object.userData.omniTrackingId
      if (this._lockedId === hitId) { this._release(); return }  // click the locked one again — release
      this._lockOn(hitId)
      return
    }
    // Clicked empty space (or something else) while locked on — release,
    // same "click elsewhere to let go" feel as a real Z-target.
    if (this._lockedId) this._release()
  }

  _lockOn (id) {
    const entry = this._nodes.find(n => n.cfg.id === id)
    if (!entry) return
    this._lockedId = id
    window.dispatchEvent(new CustomEvent('omni:orbit-disable', { detail: {} }))
    // Same event shape every real selection path already dispatches —
    // OmniTargeting's reticle and tooltip pick this up with no changes
    // of its own needed.
    window.dispatchEvent(new CustomEvent('omni:node-selected', {
      detail: { node: { id: entry.cfg.id, label: entry.cfg.label }, mesh: entry.mesh },
    }))
  }

  _release () {
    this._lockedId = null
    const target = this.ctx.camera.position
    window.dispatchEvent(new CustomEvent('omni:orbit-target-set', { detail: { x: target.x, y: target.y - 1, z: target.z - 1 } }))
    window.dispatchEvent(new CustomEvent('omni:orbit-enable', { detail: {} }))
    window.dispatchEvent(new CustomEvent('omni:node-selected', { detail: { node: null, mesh: null } }))
  }

  _updateFollowCamera () {
    const entry = this._nodes.find(n => n.cfg.id === this._lockedId)
    if (!entry) { this._release(); return }
    const targetPos = entry.mesh.position
    const camera = this.ctx.camera

    // Stand off from the target along the camera's own current
    // approach direction rather than snapping to one fixed side — a
    // real follow-cam keeps whatever relative angle the user already
    // had when they locked on.
    const away = camera.position.clone().sub(targetPos)
    if (away.lengthSq() < 0.0001) away.set(0, 1, 3)
    away.normalize().multiplyScalar(FOLLOW_DISTANCE)
    const idealPos = targetPos.clone().add(away)

    camera.position.lerp(idealPos, FOLLOW_LERP)
    camera.lookAt(targetPos)
  }
}
