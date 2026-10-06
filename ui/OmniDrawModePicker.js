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
  width: min(560px, 92vw); max-height: 82vh; overflow-y: auto; box-sizing: border-box;
  background: rgba(8,8,12,0.94); border: 1px solid rgba(255,255,255,0.12);
  border-radius: 10px; padding: 14px;
  font-family: 'Courier New', Courier, monospace; z-index: 65;
  opacity: 0; visibility: hidden; pointer-events: auto;
}
/* V164: the option list is a responsive grid of tiles (it was a one-row flex strip). */
.odmp-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(118px, 1fr)); gap: 8px; }
.odmp-title { grid-column: 1 / -1; text-align: center; font-size: 10px; color: rgba(255,255,255,0.6); letter-spacing: 0.05em; padding-bottom: 2px; }
.odmp-btn {
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; min-width: 0;
  background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.15);
  border-radius: 8px; color: #fff; font-family: inherit; font-size: 12px;
  padding: 14px 8px; cursor: pointer; text-align: center;
}
.odmp-btn:hover, .odmp-btn:focus-visible { background: rgba(255,255,255,0.12); border-color: rgba(255,255,255,0.3); outline: none; }
.odmp-btn.is-active { background: rgba(255,179,71,0.16); border-color: rgba(255,179,71,0.7); }
.odmp-glyph { font-size: 20px; line-height: 1; opacity: 0.9; }
.odmp-label { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
@media (max-width: 520px) { .odmp-grid { grid-template-columns: repeat(auto-fill, minmax(92px, 1fr)); } .odmp-btn { padding: 12px 4px; font-size: 11px; } }

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
      <div class="odmp-grid">
        <span class="odmp-title">⟐OmniDraw — choose a mode</span>
        <button class="odmp-btn" data-mode="static" title="place &amp; shape a real object" aria-pressed="false"><span class="odmp-glyph">▣</span><span class="odmp-label">Static</span></button>
        <button class="odmp-btn" data-mode="dynamic" title="a string, read and shown over time" aria-pressed="false"><span class="odmp-glyph">≋</span><span class="odmp-label">Dynamic</span></button>
        <button class="odmp-btn" data-mode="jsonifier" title="a JSON tree, toggled open branch by branch" aria-pressed="false"><span class="odmp-glyph">{ }</span><span class="odmp-label">Jsonifier</span></button>
        <button class="odmp-btn" data-mode="omnicell" title="numerical data, straight to a real D3 chart" aria-pressed="false"><span class="odmp-glyph">▥</span><span class="odmp-label">OmniCell</span></button>
        <button class="odmp-btn" data-mode="chat" title="a live message/terminal build tool" aria-pressed="false"><span class="odmp-glyph">✉</span><span class="odmp-label">Chat</span></button>
        <button class="odmp-btn" data-mode="log" title="a blog post, genuinely paginated into real, in-scene pages" aria-pressed="false"><span class="odmp-glyph">☰</span><span class="odmp-label">Log</span></button>
        <button class="odmp-btn" data-mode="omninode" title="the real node registry — Essence Data and every other type" aria-pressed="false"><span class="odmp-glyph">◉</span><span class="odmp-label">OmniNode</span></button>
        <button class="odmp-btn" data-mode="behavior" title="a node that animates others: Orbit, Leader, Follower, Attract, Repel and more" aria-pressed="false"><span class="odmp-glyph">⟳</span><span class="odmp-label">BehaviorNode</span></button>
      </div>
    `
    document.body.appendChild(this._el)

    this._el.querySelector('[data-mode="static"]').addEventListener('click', () => this._choose('static'))
    this._el.querySelector('[data-mode="dynamic"]').addEventListener('click', () => this._choose('dynamic'))
    this._el.querySelector('[data-mode="jsonifier"]').addEventListener('click', () => this._choose('jsonifier'))
    this._el.querySelector('[data-mode="omnicell"]').addEventListener('click', () => this._choose('omnicell'))
    this._el.querySelector('[data-mode="chat"]').addEventListener('click', () => this._choose('chat'))
    this._el.querySelector('[data-mode="log"]').addEventListener('click', () => this._choose('log'))
    this._el.querySelector('[data-mode="omninode"]').addEventListener('click', () => this._choose('omninode'))
    this._el.querySelector('[data-mode="behavior"]').addEventListener('click', () => this._choose('behavior'))

    this._onNavSelect = (e) => {
      if (e.detail?.item !== '⟐OmniDraw') return
      this.open()
    }
    window.addEventListener('omni:nav-select', this._onNavSelect)

    this._onDocClick = (e) => {
      if (!this._isOpen) return
      if (this._ignoreNextDocClick) return
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
    this._ignoreNextDocClick = true
    setTimeout(() => { this._ignoreNextDocClick = false }, 0)
  }

  close () {
    this._isOpen = false
    gsap.to(this._el, { opacity: 0, duration: 0.15, onComplete: () => { this._el.style.visibility = 'hidden' } })
  }

  _choose (mode) {
    declareDesire(`open-omnidraw-${mode}`, { mode })
    this._el.querySelectorAll('.odmp-btn').forEach(b => { const on = b.dataset.mode === mode; b.classList.toggle('is-active', on); b.setAttribute('aria-pressed', String(on)) })

    // OmniNode is a real, separate registry system (systems/OmniNode.js) —
    // it never listens for 'omni:nav-select' like the other five modes do,
    // only for 'omni:system-toggle' { system: 'omninode' }. Before this,
    // nothing anywhere actually dispatched that event, so its panel (with
    // the "+ Add Node" picker — Essence Data included) had no way to open
    // from the UI at all. This is the fix: real dispatch, real open.
    if (mode === 'omninode') {
      window.dispatchEvent(new CustomEvent('omni:system-toggle', { detail: { system: 'omninode' } }))
      this.close()
      return
    }

    const labels = { static: '⟐OmniDrawStatic', dynamic: '⟐OmniDrawDynamic', jsonifier: '⟐OmniDrawJsonifier', omnicell: '⟐OmniDrawCell', chat: '⟐OmniDrawChat', log: '⟐OmniDrawLog', behavior: '⟐OmniDrawBehavior' }
    window.dispatchEvent(new CustomEvent('omni:nav-select', { detail: { item: labels[mode] } }))
    this.close()
  }
}
