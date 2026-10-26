/**
 * ui/OmniInspection.js — ⟐mniReality OmniInspection
 *
 * First concrete build increment for OmniVisor/OmniPerspective — see
 * OMNIVISOR_DESIGN.md. This covers just the lens + perimeter
 * detection: a temporary 3D wireframe ground-grid (concentric rings +
 * radial spokes — the "layers of reality" motif made literal), and
 * real detection of which OmniNode objects fall within its radius.
 *
 * Deliberately NOT built here yet, per the agreed build order: the
 * four-quadrant data HUD, perception-gating, and the fuller
 * rings-emanating-from-the-user choreography. This module dispatches
 * `omni:inspection-scope-updated` with the in-range node list
 * specifically so that HUD can be built as its own next increment,
 * consuming this event rather than needing to know how the lens
 * itself works.
 *
 * Toggled from the drawer (⟐OmniVisor). Ground-anchored at wherever
 * the camera was standing when activated — deliberately does NOT
 * recenter as the camera moves, matching "temporary" (a zone you
 * inspect from within, not a marker that follows you).
 *
 * Follows the standard module contract (constructor / init / update / destroy).
 */

import * as THREE from 'three'
import gsap from 'gsap'

const RING_COUNT = 4
const SPOKE_COUNT = 12
const RING_SEGMENTS = 64

export default class OmniInspection {
  constructor (context) {
    this.ctx = context
    this._active = false
    this._group = null
    this._radius = 8   // world units — the ground-grid's outer radius
    this._allNodes = []
    this._inRangeIds = []
    this._statusEl = null

    this._onNavSelect = null
    this._onNodesUpdated = null
  }

  init () {
    this._onNavSelect = (e) => {
      if (e.detail?.item !== '⟐OmniVisor') return
      this.toggle()
    }
    window.addEventListener('omni:nav-select', this._onNavSelect)

    this._onNodesUpdated = (e) => {
      this._allNodes = e.detail?.nodes ?? []
      if (this._active) this._recomputeScope()
    }
    window.addEventListener('omni:nodes-updated', this._onNodesUpdated)

    // Position/rotation/scale/color edits dispatch the lighter
    // omni:node-updated (singular), not the full array broadcast —
    // without this, moving a node while inspecting wouldn't trigger a
    // re-check of whether it's still in range.
    this._onNodeUpdated = () => {
      if (this._active) window.dispatchEvent(new CustomEvent('omni:nodes-request'))
    }
    window.addEventListener('omni:node-updated', this._onNodeUpdated)

    this._buildStatusIndicator()
  }

  update () {}
  onResize () {}

  destroy () {
    window.removeEventListener('omni:nav-select', this._onNavSelect)
    window.removeEventListener('omni:nodes-updated', this._onNodesUpdated)
    window.removeEventListener('omni:node-updated', this._onNodeUpdated)
    this._teardownGrid()
    this._statusEl?.parentNode?.removeChild(this._statusEl)
  }

  toggle () {
    if (this._active) this.deactivate()
    else this.activate()
  }

  /** Spawns the wireframe grid at the camera's current ground
   *  position, fixed there for the duration of this inspection —
   *  moving around afterward doesn't drag the grid along. */
  activate () {
    if (this._active) return
    this._active = true

    // Guarantees a current node list even if inspection is the very
    // first thing to run — doesn't depend on having already caught a
    // prior passive nodes-updated broadcast.
    window.dispatchEvent(new CustomEvent('omni:nodes-request'))

    const cam = this.ctx.camera
    const center = new THREE.Vector3(cam.position.x, 0, cam.position.z)

    this._group = new THREE.Group()
    this._group.position.copy(center)
    this.ctx.scene.add(this._group)

    const mat = new THREE.LineBasicMaterial({ color: 0x8cffb4, transparent: true, opacity: 0.7 })

    // Concentric rings — the "layers" made literal.
    for (let i = 1; i <= RING_COUNT; i++) {
      const r = (this._radius / RING_COUNT) * i
      const points = []
      for (let s = 0; s <= RING_SEGMENTS; s++) {
        const theta = (s / RING_SEGMENTS) * Math.PI * 2
        points.push(new THREE.Vector3(Math.cos(theta) * r, 0, Math.sin(theta) * r))
      }
      const geo = new THREE.BufferGeometry().setFromPoints(points)
      const ring = new THREE.LineLoop(geo, mat)
      this._group.add(ring)
    }

    // Radial spokes from center to the outer ring — turns the rings
    // into an actual tiled grid, not just concentric circles.
    for (let i = 0; i < SPOKE_COUNT; i++) {
      const theta = (i / SPOKE_COUNT) * Math.PI * 2
      const points = [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(Math.cos(theta) * this._radius, 0, Math.sin(theta) * this._radius),
      ]
      const geo = new THREE.BufferGeometry().setFromPoints(points)
      const spoke = new THREE.Line(geo, mat)
      this._group.add(spoke)
    }

    // Grows in from nothing rather than just appearing — a simple,
    // honest version of "forming" for this pass; the fuller
    // rings-pulsing-in choreography from the design doc is a later
    // aesthetic refinement, not required for the mechanic to work.
    this._group.scale.set(0.01, 1, 0.01)
    gsap.to(this._group.scale, { x: 1, z: 1, duration: 0.5, ease: 'power2.out' })

    this._recomputeScope()
    this._setStatus(true)
  }

  deactivate () {
    if (!this._active) return
    this._active = false

    if (this._group) {
      gsap.to(this._group.scale, {
        x: 0.01, z: 0.01, duration: 0.3, ease: 'power2.in',
        onComplete: () => this._teardownGrid(),
      })
    }

    this._inRangeIds = []
    window.dispatchEvent(new CustomEvent('omni:inspection-scope-updated', { detail: { inRangeIds: [] } }))
    this._setStatus(false)
  }

  _teardownGrid () {
    if (!this._group) return
    this.ctx.scene.remove(this._group)
    this._group.traverse(obj => { obj.geometry?.dispose(); obj.material?.dispose() })
    this._group = null
  }

  /** Real perimeter detection — ground-radius (XZ-plane distance from
   *  the grid's center), matching "tiles on the ground" rather than a
   *  full 3D sphere; a node directly above or below the grid but
   *  outside its horizontal footprint doesn't count as in range. */
  _recomputeScope () {
    if (!this._group) return
    const center = this._group.position
    const ids = this._allNodes
      .filter(n => {
        const [x, , z] = n.position ?? [0, 0, 0]
        const dx = x - center.x
        const dz = z - center.z
        return Math.sqrt(dx * dx + dz * dz) <= this._radius
      })
      .map(n => n.id)

    this._inRangeIds = ids
    window.dispatchEvent(new CustomEvent('omni:inspection-scope-updated', { detail: { inRangeIds: ids } }))
    this._updateStatusCount(ids.length)
  }

  // ── Minimal status readout — the full quadrant HUD is the next increment ──

  _buildStatusIndicator () {
    const el = document.createElement('div')
    el.id = 'omni-inspection-status'
    el.style.cssText = `
      position: fixed; top: 14px; left: 50%; transform: translateX(-50%);
      font-family: 'Courier New', monospace; font-size: 10px; letter-spacing: 0.06em;
      color: rgba(140, 255, 180, 0.9); background: rgba(8,8,12,0.7);
      border: 1px solid rgba(140,255,180,0.3); border-radius: 6px;
      padding: 5px 12px; z-index: 80; display: none; pointer-events: none;
    `
    const shell = document.getElementById('omni-ui') ?? document.body
    shell.appendChild(el)
    this._statusEl = el
  }

  _setStatus (active) {
    if (!this._statusEl) return
    this._statusEl.style.display = active ? 'block' : 'none'
    window.dispatchEvent(new CustomEvent('omni:inspection-active-changed', { detail: { active } }))
  }

  _updateStatusCount (count) {
    if (!this._statusEl) return
    this._statusEl.textContent = `⟐ INSPECTION ACTIVE — ${count} object${count === 1 ? '' : 's'} in range`
  }
}
