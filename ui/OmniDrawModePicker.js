/**
 * ui/OmniDrawModePicker.js — ⟐OmniDraw mode picker
 *
 * "Maybe a menu pops up and the user selects which draw they want?
 * The input from the user verifies the tool?" — this is that menu,
 * and it's the first real, concrete use of Desire/PrimaryForce: the
 * click IS Desire (forward, stated intent — "I want Dynamic"), and
 * whichever mode's own real behavior follows is what PrimaryForce
 * would eventually confirm against it.
 *
 * Takes over the '⟐OmniDraw' nav-select label itself — OmniDraw's
 * own panel (now Static) listens for '⟐OmniDrawStatic' instead.
 */

import gsap from 'gsap'
import { declareDesire } from '../utils/DesirePrimaryForce.js'

const STYLES = `

.omni-draw-mode-picker {
  position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
  background: rgba(8,8,12,0.94); border: 1px solid rgba(255,255,255,0.12);
  border-radius: 10px; padding: 16px; display: flex; gap: 10px;
  font-family: 'Courier New', Courier, monospace; z-index: 65;
  opacity: 0; visibility: hidden; pointer-events: auto;
}
.odmp-title { position: absolute; top: -22px; left: 0; right: 0; text-align: center; font-size: 10px; color: rgba(255,255,255,0.6); letter-spacing: 0.05em; }
.odmp-btn {
  background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.15);
  border-radius: 8px; color: #fff; font-family: inherit; font-size: 12px;
  padding: 16px 22px; cursor: pointer; text-align: center;
}
.odmp-btn:hover { background: rgba(255,255,255,0.12); border-color: rgba(255,255,255,0.3); }
.odmp-btn-sub { display: block; font-size: 9px; color: rgba(255,255,255,0.5); margin-top: 4px; }

`

function injectStyles () {
  if (document.getElementById('odmp-styles')) return
  const tag = document.createElement('style')
  tag.id = 'odmp-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

export default class OmniDrawModePicker {
  constructor () {
    this._el = null
    this._isOpen = false
    this._onNavSelect = null
    this._onDocClick = null
  }

  init () {
    injectStyles()
    this._el = document.createElement('div')
    this._el.className = 'omni-draw-mode-picker'
    this._el.innerHTML = `
      <span class="odmp-title">⟐OmniDraw — choose a mode</span>
      <button class="odmp-btn" data-mode="static">Static<span class="odmp-btn-sub">place &amp; shape a real object</span></button>
      <button class="odmp-btn" data-mode="dynamic">Dynamic<span class="odmp-btn-sub">a string, read and shown over time</span></button>
      <button class="odmp-btn" data-mode="jsonifier">Jsonifier<span class="odmp-btn-sub">a JSON tree, toggled open branch by branch</span></button>
      <button class="odmp-btn" data-mode="omnicell">OmniCell<span class="odmp-btn-sub">numerical data, straight to a real D3 chart</span></button>
    `
    document.body.appendChild(this._el)

    this._el.querySelector('[data-mode="static"]').addEventListener('click', () => this._choose('static'))
    this._el.querySelector('[data-mode="dynamic"]').addEventListener('click', () => this._choose('dynamic'))
    this._el.querySelector('[data-mode="jsonifier"]').addEventListener('click', () => this._choose('jsonifier'))
    this._el.querySelector('[data-mode="omnicell"]').addEventListener('click', () => this._choose('omnicell'))

    this._onNavSelect = (e) => {
      if (e.detail?.item !== '⟐OmniDraw') return
      this.open()
    }
    window.addEventListener('omni:nav-select', this._onNavSelect)

    this._onDocClick = (e) => {
      if (!this._isOpen) return
      if (this._el.contains(e.target)) return
      this.close()
    }
    document.addEventListener('click', this._onDocClick)
  }

  update () {}
  onResize () {}

  destroy () {
    window.removeEventListener('omni:nav-select', this._onNavSelect)
    document.removeEventListener('click', this._onDocClick)
    this._el?.remove()
  }

  open () {
    this._isOpen = true
    this._el.style.visibility = 'visible'
    gsap.to(this._el, { opacity: 1, duration: 0.2 })
  }

  close () {
    this._isOpen = false
    gsap.to(this._el, { opacity: 0, duration: 0.15, onComplete: () => { this._el.style.visibility = 'hidden' } })
  }

  _choose (mode) {
    declareDesire(`open-omnidraw-${mode}`, { mode })
    const labels = { static: '⟐OmniDrawStatic', dynamic: '⟐OmniDrawDynamic', jsonifier: '⟐OmniDrawJsonifier', omnicell: '⟐OmniDrawCell' }
    window.dispatchEvent(new CustomEvent('omni:nav-select', { detail: { item: labels[mode] } }))
    this.close()
  }
}
