/**
 * ui/MobileDebugOverlay.js — TEMPORARY diagnostic overlay
 *
 * Built specifically to answer, just by looking at the screen, without
 * any DevTools access: is the camera position actually changing when a
 * movement button is held, and is OrbitControls actually disabled
 * while that's happening? Remove once the mobile movement bug is found.
 */
export default class MobileDebugOverlay {
  constructor (ctx, orbitMod, movementPad) {
    this.ctx = ctx
    this.orbitMod = orbitMod
    this.movementPad = movementPad
    this._el = null
  }

  init () {
    this._el = document.createElement('div')
    this._el.style.cssText = `
      position: fixed; top: 4px; left: 4px; z-index: 99999;
      background: rgba(0,0,0,0.85); color: #0f0;
      font-family: monospace; font-size: 11px; line-height: 1.5;
      padding: 8px 10px; border-radius: 6px; pointer-events: none;
      white-space: pre; max-width: 90vw;
    `
    document.body.appendChild(this._el)
  }

  update () {
    if (!this._el) return
    const cam = this.ctx?.camera
    const p = cam?.position
    const pressed = this.movementPad?._pressed
    const activeDirs = pressed
      ? Object.entries(pressed).flatMap(([hand, dirs]) =>
          Object.entries(dirs).filter(([, v]) => v).map(([d]) => `${hand}.${d}`))
      : []

    this._el.textContent =
      `cam: ${p ? `${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)}` : 'NO CAMERA'}\n` +
      `orbit enabled: ${this.orbitMod?.controls?.enabled}\n` +
      `pressed: ${activeDirs.length ? activeDirs.join(', ') : '(none)'}\n` +
      `speed x: ${this.movementPad?._moveSpeedMultiplier}`
  }

  onResize () {}
  destroy () { this._el?.remove() }
}
