/**
 * ticker.js — GSAP ticker bridge
 *
 * Wraps gsap.ticker as the single source of timing truth.
 * BaseScene registers its render loop here.
 * Modules never touch gsap.ticker directly — they receive
 * delta from BaseScene's update call each frame.
 *
 * Usage:
 *   import Ticker from './utils/ticker.js'
 *   const ticker = new Ticker()
 *   const id = ticker.add((delta) => { ... })
 *   ticker.remove(id)
 */

import gsap from 'gsap'

export default class Ticker {
  constructor() {
    this._listeners = new Map()
    this._nextId = 0

    // Normalise GSAP's lagSmoothing so spikes don't cause huge delta jumps
    gsap.ticker.lagSmoothing(500, 33)

    // Single GSAP listener — dispatches to all registered handlers
    this._gsapHandler = (time, deltaTime) => {
      const delta = deltaTime * 0.001  // ms → seconds
      for (const fn of this._listeners.values()) {
        fn(delta, time)
      }
    }

    gsap.ticker.add(this._gsapHandler)
  }

  /**
   * Register a frame callback.
   * @param {(delta: number, time: number) => void} fn
   * @returns {number} handler id — use to remove later
   */
  add(fn) {
    const id = this._nextId++
    this._listeners.set(id, fn)
    return id
  }

  /**
   * Remove a registered frame callback by id.
   * @param {number} id
   */
  remove(id) {
    this._listeners.delete(id)
  }

  destroy() {
    gsap.ticker.remove(this._gsapHandler)
    this._listeners.clear()
  }
}
