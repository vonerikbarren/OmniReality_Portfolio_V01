/**
 * systems/OmniSideTargeting.js — ⟐Z / L / R Targeting (V207)
 *
 * While something is targeted (omni:orbit-target-set), the view window of the camera is shifted sideways
 * (camera.setViewOffset) so the target appears at the LEFT (L, 9 o'clock) or RIGHT (R, 3 o'clock) instead of the centre (Z).
 * That frees the other side of the HUD for DOM panels or other nodes. Only the projection changes: the camera, OrbitControls,
 * the raycasts (they use the same projection) and the tooltip all keep working. No extra WebGL context, no CSS3D.
 *
 * The target is let go by OmniOrbitRelease (a click on empty 3D space, or Escape); a click on a panel does not release it.
 * When the target goes, the view eases back to the centre.
 *
 * Events in:  omni:orbit-target-set, omni:node-deselected, omni:return-to-landing, omni:orbit-released,
 *             omni:targeting-mode-set { mode: 'Z'|'L'|'R', distance }
 * Events out: omni:targeting-mode-changed { mode, distance, active }
 */
import * as S from '../utils/OmniSideTargeting.js'

export default class OmniSideTargeting {
  constructor (context) {
    this.ctx = context
    this._cfg = S.sanitize(null)
    this._active = false
    this._shift = 0
    this._h = {}
  }

  get mode () { return this._cfg.mode }
  get distance () { return this._cfg.distance }
  get active () { return this._active }
  get shift () { return this._shift }

  init () {
    this._cfg = S.load()
    const w = (type, fn) => { this._h[type] = fn; window.addEventListener(type, fn) }
    w('omni:orbit-target-set', (e) => { const d = e.detail ?? {}; if ([d.x, d.y, d.z].every(Number.isFinite)) this._active = true })
    const off = () => { this._active = false }
    w('omni:node-deselected', off); w('omni:return-to-landing', off); w('omni:orbit-released', off)
    w('omni:targeting-mode-set', (e) => this.setMode(e.detail ?? {}))
  }

  /** patch { mode?, distance? } -> saved + announced. Returns the new settings. */
  setMode (patch = {}) {
    const next = S.save({ ...this._cfg, ...(patch && typeof patch === 'object' ? patch : {}) })
    this._cfg = next
    window.dispatchEvent(new CustomEvent('omni:targeting-mode-changed', { detail: { ...next, active: this._active } }))
    return next
  }

  /** the shift the view should have right now */
  goal () {
    const w = this._width()
    return this._active ? S.viewShiftPx(this._cfg.mode, this._cfg.distance, w) : 0
  }

  update (delta) {
    const goal = this.goal()
    if (Math.abs(goal - this._shift) < 0.5) {
      if (this._shift !== goal) { this._shift = goal; this._apply() }
      return
    }
    const k = 1 - Math.exp(-10 * Math.min(0.1, Math.max(0, Number(delta) || 0)))   // ease, about a third of a second
    this._shift += (goal - this._shift) * k
    this._apply()
  }

  onResize () { this._apply(true) }

  destroy () {
    for (const [t, fn] of Object.entries(this._h)) window.removeEventListener(t, fn)
    this._h = {}
    this._shift = 0; this._apply(true)
  }

  _width () { return Number(this.ctx?.renderer?.domElement?.clientWidth) || window.innerWidth }
  _height () { return Number(this.ctx?.renderer?.domElement?.clientHeight) || window.innerHeight }

  _apply (force = false) {
    const cam = this.ctx?.camera; if (!cam || typeof cam.setViewOffset !== 'function') return
    if (Math.abs(this._shift) < 0.5) {
      if (cam.view?.enabled) { cam.clearViewOffset(); }
      return
    }
    const W = this._width(), H = this._height()
    cam.setViewOffset(W, H, this._shift, 0, W, H)
  }
}
