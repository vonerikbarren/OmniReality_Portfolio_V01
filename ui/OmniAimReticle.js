/**
 * ui/OmniAimReticle.js — ⟐mniReality Aim Reticle
 *
 * A new, reusable UI primitive — a screen-space center crosshair plus
 * a live 3D "landing zone" ring showing exactly where a placement
 * would land, before the click commits it. First wired into OmniDraw's
 * place mode (raycasting the floor plane, same as its existing
 * mechanism), but built generic on purpose — any tool that needs "show
 * where this is about to go" can reuse this by supplying its own
 * raycast function, not just floor-plane placement.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Usage
 * ─────────────────────────────────────────────────────────────────────────────
 * const reticle = new OmniAimReticle(ctx)
 * reticle.init()
 * reticle.activate((raycaster) => {
 *   const target = new THREE.Vector3()
 *   return raycaster.ray.intersectPlane(FLOOR_PLANE, target) ? target : null
 * })
 * reticle.deactivate()
 *
 * The crosshair is plain CSS (screen-space, fixed at center — no
 * WebGL needed for a static circle). The landing ring is a real, thin
 * THREE.RingGeometry mesh lying flat on whatever surface the raycast
 * function reports, genuine world geometry so it reads as "sitting on
 * the ground" rather than a flat screen overlay.
 *
 * Follows the standard module contract (constructor / init / update / destroy).
 */

import * as THREE from 'three'

const RING_INNER = 0.5
const RING_OUTER = 0.65

const STYLES = /* css */`
  .omni-aim-crosshair {
    position: fixed;
    top: 50%;
    left: 50%;
    width: 22px;
    height: 22px;
    margin: -11px 0 0 -11px;
    border: 1.5px solid rgba(255, 255, 255, 0.65);
    border-radius: 50%;
    pointer-events: none;
    z-index: 50;
    opacity: 0;
    transition: opacity 0.15s ease;
  }
  .omni-aim-crosshair.is-active { opacity: 1; }
  .omni-aim-crosshair::before,
  .omni-aim-crosshair::after {
    content: '';
    position: absolute;
    background: rgba(255, 255, 255, 0.65);
  }
  .omni-aim-crosshair::before { top: 50%; left: -5px; right: -5px; height: 1px; margin-top: -0.5px; }
  .omni-aim-crosshair::after  { left: 50%; top: -5px; bottom: -5px; width: 1px; margin-left: -0.5px; }
`

function injectStyles () {
  if (document.getElementById('omni-aim-reticle-styles')) return
  const tag = document.createElement('style')
  tag.id = 'omni-aim-reticle-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

export default class OmniAimReticle {
  constructor (context) {
    this.ctx = context
    this._crosshairEl = null
    this._ring = null
    this._raycastFn = null
    this._active = false
    this._raycaster = new THREE.Raycaster()
    this._mouse = new THREE.Vector2()
    this._onMouseMove = null
  }

  init () {
    injectStyles()
    this._crosshairEl = document.createElement('div')
    this._crosshairEl.className = 'omni-aim-crosshair'
    document.body.appendChild(this._crosshairEl)

    const geo = new THREE.RingGeometry(RING_INNER, RING_OUTER, 32)
    geo.rotateX(-Math.PI / 2)
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0.55,
      side: THREE.DoubleSide, depthWrite: false,
    })
    this._ring = new THREE.Mesh(geo, mat)
    this._ring.visible = false
    this.ctx.scene.add(this._ring)

    this._onMouseMove = (e) => this._updateFromMouse(e)
    window.addEventListener('mousemove', this._onMouseMove)
  }

  update () {}
  onResize () {}

  destroy () {
    window.removeEventListener('mousemove', this._onMouseMove)
    this._crosshairEl?.parentNode?.removeChild(this._crosshairEl)
    if (this._ring) {
      this.ctx.scene.remove(this._ring)
      this._ring.geometry.dispose()
      this._ring.material.dispose()
    }
  }

  /** @param {(raycaster: THREE.Raycaster) => THREE.Vector3|null} raycastFn
   *  Called on every mouse move while active — return where the
   *  landing ring should sit, or null to hide it. */
  activate (raycastFn) {
    this._raycastFn = raycastFn
    this._active = true
    this._crosshairEl.classList.add('is-active')
  }

  deactivate () {
    this._active = false
    this._raycastFn = null
    this._crosshairEl.classList.remove('is-active')
    this._ring.visible = false
  }

  _updateFromMouse (e) {
    if (!this._active || !this._raycastFn) return
    const canvas = this.ctx.renderer.domElement
    const rect = canvas.getBoundingClientRect()
    this._mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
    this._mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
    this._raycaster.setFromCamera(this._mouse, this.ctx.camera)

    const landing = this._raycastFn(this._raycaster)
    if (landing) {
      this._ring.position.copy(landing)
      this._ring.position.y += 0.02
      this._ring.visible = true
    } else {
      this._ring.visible = false
    }
  }
}
