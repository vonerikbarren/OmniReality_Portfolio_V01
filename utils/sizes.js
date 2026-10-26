/**
 * sizes.js — Reactive viewport sizing utility
 *
 * Tracks window dimensions and pixel ratio.
 * Emits 'resize' events so any subscriber can react.
 *
 * Usage:
 *   import Sizes from './utils/sizes.js'
 *   const sizes = new Sizes()
 *   sizes.on('resize', () => { ... })
 */

export default class Sizes extends EventTarget {
  constructor() {
    super()
    this._onResize = this._onResize.bind(this)
    this._read()
    window.addEventListener('resize', this._onResize)
  }

  /** Read current viewport dimensions + pixel ratio */
  _read() {
    this.width      = window.innerWidth
    this.height     = window.innerHeight
    this.pixelRatio = Math.min(window.devicePixelRatio, 2)
    this.aspect     = this.width / this.height
  }

  _onResize() {
    this._read()
    this.dispatchEvent(new Event('resize'))
  }

  destroy() {
    window.removeEventListener('resize', this._onResize)
  }
}
