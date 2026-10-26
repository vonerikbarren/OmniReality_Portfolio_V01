/**
 * systems/OmniOrbitRelease.js — ⟐OrbitRelease (V190)
 *
 * "When I click away from an orbit target it disconnects from the orbit controls and I can move with the WASD again."
 *
 * While the camera is orbiting a TARGET (something announced it with `omni:orbit-target-set`: selecting a node, TakeMeThere,
 * the store fly-to, ...), the orbit pivot stays locked to it (main.js `_hasSelectedPivot`) and OrbitControls' maxDistance /
 * damping keep pulling the camera back toward it, so WASD feels stuck. This module lets the user let go:
 *
 *   - a CLICK on empty space (a real click: primary button, <= 6 px of movement, <= 400 ms — see utils/OrbitRelease.js) or
 *   - the Escape key
 *
 * dispatches `omni:orbit-release-request`; main.js (which owns the pivot flag and OrbitControls) clears the target, resets
 * the orbit pivot to just ahead of the camera, restores OrbitControls' default maxDistance and re-enables free-fly, then
 * announces `omni:orbit-released { reason }`. A short ⟐OmniNotify message confirms it.
 *
 * It NEVER releases when: the setting is off; the press started on UI (only the 3D canvas is listened to); the gesture
 * was a drag / long press / non-primary button / multi-touch; the click landed on a node or on the orbit target itself;
 * a place/path mode is active; or OrbitControls is currently disabled (a fly-to or a held WASD key owns the camera).
 *
 * Events in:  omni:orbit-target-set {x,y,z}, omni:node-deselected, omni:return-to-landing, omni:orbit-released,
 *             omni:orbit-release-set {enabled}
 * Events out: omni:orbit-release-request {reason}, omni:notify-info
 */
import * as THREE from 'three'
import { classifyPointerGesture, rayNearPoint, loadOrbitReleaseSettings, saveOrbitReleaseSettings } from '../utils/OrbitRelease.js'

export default class OmniOrbitRelease {
  constructor (context, orbitModule) {
    this.ctx = context
    this.orbit = orbitModule
    this._settings = { enabled: true }
    this._target = null        // THREE.Vector3 | null — the orbit target we know about
    this._down = null          // { id, x, y, t, onCanvas }
    this._multi = false
    this._ray = new THREE.Raycaster()
    this._ndc = new THREE.Vector2()
    this._h = {}
  }

  get active () { return !!this._target }
  get enabled () { return !!this._settings.enabled }

  init () {
    this._settings = loadOrbitReleaseSettings()
    const canvas = this.ctx.renderer?.domElement
    this._canvas = canvas
    const w = (type, fn, opts) => { this._h[type] = fn; window.addEventListener(type, fn, opts) }

    w('omni:orbit-target-set', (e) => {
      const d = e.detail ?? {}
      if (![d.x, d.y, d.z].every(Number.isFinite)) return
      this._target = (this._target ?? new THREE.Vector3()).set(d.x, d.y, d.z)
    })
    const clear = () => { this._target = null }
    w('omni:node-deselected', clear)
    w('omni:return-to-landing', clear)
    w('omni:orbit-released', clear)
    w('omni:orbit-release-set', (e) => { this._settings = saveOrbitReleaseSettings({ enabled: e.detail?.enabled !== false }) })

    if (canvas) {
      this._onDown = (e) => this._pointerDown(e)
      canvas.addEventListener('pointerdown', this._onDown)
      w('pointerup', (e) => this._pointerUp(e))
      w('pointercancel', () => { this._down = null })
    }
    w('keydown', (e) => {
      if (e.key !== 'Escape' || e.repeat) return
      if (this._isTyping()) return
      if (!this.active || !this.enabled) return
      this._release('escape')
    })
  }

  update () {}
  onResize () {}

  destroy () {
    for (const [type, fn] of Object.entries(this._h)) window.removeEventListener(type, fn)
    this._h = {}
    if (this._canvas && this._onDown) this._canvas.removeEventListener('pointerdown', this._onDown)
  }

  _isTyping () {
    const a = document.activeElement
    return !!a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.isContentEditable)
  }

  _pointerDown (e) {
    // a second finger / button while one is down = pinch or chord, never a click
    if (this._down) { this._multi = true; return }
    this._multi = false
    this._down = { id: e.pointerId, x: e.clientX, y: e.clientY, t: e.timeStamp ?? performance.now(), button: e.button, target: e.target }
  }

  _pointerUp (e) {
    const d = this._down
    if (!d || e.pointerId !== d.id) return
    this._down = null
    if (this._multi) { this._multi = false; return }
    if (!this.active || !this.enabled) return
    if (d.target !== this._canvas) return                 // started on UI / a panel
    const kind = classifyPointerGesture({ dx: e.clientX - d.x, dy: e.clientY - d.y, dt: (e.timeStamp ?? performance.now()) - d.t, button: d.button })
    if (kind !== 'click') return
    if (this._modeBlocksRelease()) return
    if (!this.orbit?.controls?.enabled) return            // a fly-to / held WASD key owns the camera right now
    if (this._hitsNodeOrTarget(e.clientX, e.clientY)) return
    this._release('click')
  }

  _modeBlocksRelease () {
    return !!document.body?.classList?.contains('on-place-mode')
  }

  /** true when the click lands on a node mesh or on the orbit target itself */
  _hitsNodeOrTarget (cx, cy) {
    const cam = this.ctx.camera
    const rect = this._canvas.getBoundingClientRect()
    if (!cam || !(rect.width > 0) || !(rect.height > 0)) return false
    this._ndc.set(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1)
    this._ray.setFromCamera(this._ndc, cam)
    const { origin, direction } = this._ray.ray
    if (this._target) {
      const dist = origin.distanceTo(this._target)
      const radius = Math.max(0.75, dist * 0.03)         // a small sphere around the target, growing with distance
      if (rayNearPoint([origin.x, origin.y, origin.z], [direction.x, direction.y, direction.z], [this._target.x, this._target.y, this._target.z], radius)) return true
    }
    const meshes = []
    this.ctx.scene?.traverse?.((o) => { if (o.isMesh && o.visible && o.userData?.nodeId) meshes.push(o) })
    return meshes.length > 0 && this._ray.intersectObjects(meshes, false).length > 0
  }

  _release (reason) {
    window.dispatchEvent(new CustomEvent('omni:orbit-release-request', { detail: { reason } }))
    window.dispatchEvent(new CustomEvent('omni:notify-info', { detail: { name: '⟐Orbit', desc: 'Orbit released — WASD flies freely again.', holdMs: 2500 } }))
  }
}
