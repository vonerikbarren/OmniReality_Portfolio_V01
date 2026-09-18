/**
 * utils/WordTicker.js — the real, reusable word-ticker "form"
 *
 * Extracted from OmniDraw(Dynamic)'s own original implementation —
 * "these are forms," confirmed directly, so a ticker isn't specific
 * to Dynamic's plain-string mode, it's a real, reusable way of
 * presenting an array of words over time, wherever it's needed
 * (OmniJsonifier's own multi-word leaf values, now, and whatever
 * else later). Both now share this one implementation instead of
 * two copies.
 *
 * One word visible at a time, in order, looping, shifting like a
 * notification — a real, timed slide-and-fade, not every word shown
 * at once.
 */

import * as THREE from 'three'
import gsap from 'gsap'

const WORD_INTERVAL = 1.2
const SHIFT_DISTANCE = 14

export default class WordTicker {
  constructor (camera, worldPos, words) {
    this.camera = camera
    this.worldPos = worldPos
    this.words = words
    this.currentIndex = 0
    this.elapsed = 0

    this.labelEl = document.createElement('div')
    this.labelEl.className = 'word-ticker-label'
    Object.assign(this.labelEl.style, {
      position: 'fixed', pointerEvents: 'none', transform: 'translate(-50%, -140%)',
      background: 'rgba(8,8,12,0.85)', color: '#fff', font: '12px "Courier New", monospace',
      padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(127,216,255,0.4)', zIndex: '39',
    })
    this.labelEl.textContent = words[0] ?? ''
    document.body.appendChild(this.labelEl)
  }

  update (delta) {
    this.elapsed += delta
    if (this.elapsed < WORD_INTERVAL) { this._position(); return }
    this.elapsed = 0
    this.currentIndex = (this.currentIndex + 1) % this.words.length
    this._shift()
  }

  destroy () {
    this.labelEl.remove()
  }

  _position () {
    if (!this.camera) return
    const projected = this.worldPos.clone().project(this.camera)
    if (projected.z > 1) { this.labelEl.style.display = 'none'; return }
    this.labelEl.style.display = ''
    this.labelEl.style.left = `${(projected.x * 0.5 + 0.5) * window.innerWidth}px`
    this.labelEl.style.top = `${(-projected.y * 0.5 + 0.5) * window.innerHeight}px`
  }

  _shift () {
    gsap.to(this.labelEl, {
      y: -SHIFT_DISTANCE, opacity: 0, duration: 0.22, ease: 'power1.in',
      onComplete: () => {
        this.labelEl.textContent = this.words[this.currentIndex]
        gsap.set(this.labelEl, { y: SHIFT_DISTANCE, opacity: 0 })
        gsap.to(this.labelEl, { y: 0, opacity: 1, duration: 0.24, ease: 'power1.out' })
      }
    })
  }
}
