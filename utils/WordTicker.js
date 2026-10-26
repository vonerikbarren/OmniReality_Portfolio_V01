/**
 * utils/WordTicker.js — the real, reusable word-ticker "form"
 *
 * Extended with a real, controllable surface for OmniCommunicationPanel —
 * previously had zero external control (no pause, no per-instance
 * speed, hardcoded style, module-level constants shared by every
 * ticker). Every property below is now genuinely per-instance.
 *
 * Direction is stored as a plain signed value (+1 / -1), not as a
 * named "forward"/"backward" state — confirmed directly, so a future
 * circular arrangement can reinterpret the same signed value as
 * clockwise/counter-clockwise without any restructuring.
 *
 * Backward (a manual single step) is only meaningful while paused;
 * Reverse is the same auto-play loop running with direction flipped
 * to -1 — two genuinely different things, not the same button twice.
 */

import gsap from 'gsap'

const DEFAULT_INTERVAL = 1.2
const SHIFT_DISTANCE = 14

export default class WordTicker {
  constructor (camera, worldPos, words, opts = {}) {
    this.camera = camera
    this.worldPos = worldPos
    this.words = words
    this.currentIndex = 0
    this.elapsed = 0

    this.isPaused = opts.isPaused ?? false
    this.direction = opts.direction ?? 1   // +1 forward, -1 reverse — a plain signed value, not a named state
    this.intervalSeconds = opts.intervalSeconds ?? DEFAULT_INTERVAL
    this.color = opts.color ?? '#ffffff'
    this.fontSize = opts.fontSize ?? 12
    this.fontFamily = opts.fontFamily ?? '"Courier New", monospace'

    this.labelEl = document.createElement('div')
    this.labelEl.className = 'word-ticker-label'
    Object.assign(this.labelEl.style, {
      position: 'fixed', pointerEvents: 'none', transform: 'translate(-50%, -140%)',
      background: 'rgba(8,8,12,0.85)', padding: '4px 10px', borderRadius: '6px',
      border: '1px solid rgba(127,216,255,0.4)', zIndex: '39',
    })
    this._applyStyle()
    this.labelEl.textContent = words[0] ?? ''
    document.body.appendChild(this.labelEl)
  }

  update (delta) {
    this._position()
    if (this.isPaused) return
    this.elapsed += delta
    if (this.elapsed < this.intervalSeconds) return
    this.elapsed = 0
    this._advance(this.direction)
  }

  destroy () {
    this.labelEl.remove()
  }

  // ── Real transport controls ────────────────────────────────────────────

  play () { this.isPaused = false }
  pause () { this.isPaused = true }

  /** A manual single step — only meaningful while paused; calling it
   *  during auto-play would just get immediately overridden by the
   *  next automatic advance, so this is the real, intended use. */
  stepForward () { this._advance(1) }
  stepBackward () { this._advance(-1) }

  /** Flips which way auto-play itself cycles — the same loop, run
   *  the other direction, not a single step. */
  toggleReverse () { this.direction *= -1 }

  /** Jump straight to any specific index — the real mechanism behind
   *  "a custom button for every index in the array." */
  jumpTo (index) {
    if (index < 0 || index >= this.words.length) return
    this.currentIndex = index
    this.elapsed = 0
    this._renderCurrentWord()
  }

  setSpeed (seconds) {
    this.intervalSeconds = Math.max(0.1, seconds)
  }

  setStyle ({ color, fontSize, fontFamily } = {}) {
    if (color !== undefined) this.color = color
    if (fontSize !== undefined) this.fontSize = fontSize
    if (fontFamily !== undefined) this.fontFamily = fontFamily
    this._applyStyle()
  }

  /** Real, per-word editing — replaces one word's text in place,
   *  re-rendering immediately if it's the one currently shown. */
  setWord (index, newText) {
    if (index < 0 || index >= this.words.length) return
    this.words[index] = newText
    if (index === this.currentIndex) this._renderCurrentWord()
  }

  _advance (dir) {
    this.currentIndex = (this.currentIndex + dir + this.words.length) % this.words.length
    this._shift(dir)
  }

  _applyStyle () {
    this.labelEl.style.color = this.color
    this.labelEl.style.fontSize = `${this.fontSize}px`
    this.labelEl.style.fontFamily = this.fontFamily
  }

  _renderCurrentWord () {
    this.labelEl.textContent = this.words[this.currentIndex]
  }

  _position () {
    if (!this.camera) return
    const projected = this.worldPos.clone().project(this.camera)
    if (projected.z > 1) { this.labelEl.style.display = 'none'; return }
    this.labelEl.style.display = ''
    this.labelEl.style.left = `${(projected.x * 0.5 + 0.5) * window.innerWidth}px`
    this.labelEl.style.top = `${(-projected.y * 0.5 + 0.5) * window.innerHeight}px`
  }

  /** The real "shift like a notification" transition — direction-
   *  aware now, so reverse genuinely reads as sliding the other way,
   *  not the same visual motion regardless of which way it's moving. */
  _shift (dir) {
    const outDistance = dir >= 0 ? -SHIFT_DISTANCE : SHIFT_DISTANCE
    const inFrom = dir >= 0 ? SHIFT_DISTANCE : -SHIFT_DISTANCE
    gsap.to(this.labelEl, {
      y: outDistance, opacity: 0, duration: 0.22, ease: 'power1.in',
      onComplete: () => {
        this._renderCurrentWord()
        gsap.set(this.labelEl, { y: inFrom, opacity: 0 })
        gsap.to(this.labelEl, { y: 0, opacity: 1, duration: 0.24, ease: 'power1.out' })
      }
    })
  }
}
