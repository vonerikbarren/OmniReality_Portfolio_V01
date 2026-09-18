/**
 * ui/OmniDrawDynamic.js — ⟐OmniDraw(Dynamic)
 *
 * First real slice of Dynamic, per the explicit scope given: a
 * string is split into words — an array, one word per index — and
 * shown one word at a time, in order, start to finish, looping.
 * Each word shifts to the next like a notification — a real, timed
 * slide transition, not all words shown at once.
 *
 * Reuses Static's own real object-placement pattern
 * (omni:node-create-request, spawned in front of the camera) for the
 * ticker's anchor point, per "clone static logic to build the
 * dynamic if necessary" — this is exactly that: the anchor node is
 * genuinely Static's own placement mechanism, not a second, separate
 * one. The word display itself is a real, screen-projected CSS2D-
 * style label, the same technique already proven for OmniTargeting's
 * tooltip and ToolTipMenu's own headers, not TextGeometry/font-
 * loading complexity.
 *
 * Rotation styles (linear/vertical/diagonal), the qualitative/
 * quantitative command panel, and FilterMorphing-style capture are
 * explicitly NOT part of this pass — deferred, per the agreed scope.
 *
 * The mode-selection click that led here already declared Desire
 * (OmniDrawModePicker); this panel confirms PrimaryForce once a
 * ticker is actually, successfully created — the minimal hook, not
 * the full verification system.
 */

import * as THREE from 'three'
import gsap from 'gsap'
import * as WindowManager from './WindowManager.js'
import { generateId } from '../systems/OmniNode.js'
import { confirmPrimaryForce } from '../utils/DesirePrimaryForce.js'
import WordTicker from '../utils/WordTicker.js'

const STYLES = `

.omni-draw-dynamic-panel {
  pointer-events   : auto;
  --odd-bg         : var(--omni-theme-bg, rgba(8, 8, 12, 0.92));
  --odd-border     : var(--omni-theme-border, rgba(255, 255, 255, 0.09));
  --odd-header-bg  : var(--omni-theme-header-bg, rgba(255, 255, 255, 0.03));
  --odd-text       : var(--omni-theme-text, rgba(255, 255, 255, 0.92));
  --odd-text-dim   : var(--omni-theme-text-dim, rgba(255, 255, 255, 0.65));
  --odd-accent     : var(--omni-theme-accent, #7fd8ff);
  --mono           : 'Courier New', Courier, monospace;

  position         : fixed;
  top              : 110px;
  left             : 110px;
  width            : 320px;
  min-width        : 260px;
  max-width        : 92vw;
  height           : 260px;
  min-height       : 200px;

  display          : flex;
  flex-direction   : column;

  background       : var(--odd-bg);
  backdrop-filter  : blur(20px) saturate(1.5);
  -webkit-backdrop-filter: blur(20px) saturate(1.5);
  border           : 1px solid var(--odd-border);
  border-radius    : 12px;
  box-shadow       : 0 0 20px rgba(0,0,0,0.4), 0 10px 30px rgba(0,0,0,0.5);

  font-family      : var(--mono);
  z-index          : 60;
  overflow         : hidden;
  resize           : both;
  opacity          : 0;
  visibility       : hidden;
}

.odd-header {
  height           : 38px;
  flex-shrink      : 0;
  display          : flex;
  align-items      : center;
  justify-content  : center;
  background       : var(--odd-header-bg);
  border-bottom    : 1px solid var(--odd-border);
  cursor           : grab;
  user-select      : none;
  position         : relative;
}
.odd-title { font-size: 11px; letter-spacing: 0.05em; color: var(--odd-text-dim); }
.odd-controls { position: absolute; right: 8px; display: flex; gap: 4px; }
.odd-ctrl {
  width: 20px; height: 20px; border-radius: 5px;
  border: 1px solid var(--odd-border); background: rgba(255,255,255,0.04);
  color: var(--odd-text-dim); font-size: 11px;
  display: flex; align-items: center; justify-content: center; cursor: pointer;
}
.odd-ctrl:hover { background: rgba(255,255,255,0.1); color: var(--odd-text); }

.odd-body { flex: 1 1 auto; padding: 14px 16px; display: flex; flex-direction: column; gap: 10px; }
.odd-text-input {
  width: 100%; height: 60px; resize: vertical;
  background: rgba(255,255,255,0.04); border: 1px solid var(--odd-border);
  border-radius: 5px; color: var(--odd-text); font-family: inherit; font-size: 11px; padding: 7px;
}
.odd-create-btn {
  background: rgba(127,216,255,0.15); border: 1px solid var(--odd-accent);
  color: var(--odd-accent); font-family: inherit; font-size: 11px; padding: 8px; border-radius: 5px; cursor: pointer;
}
.odd-create-btn:hover { background: rgba(127,216,255,0.25); }
.odd-note { font-size: 9px; color: var(--odd-text-dim); opacity: 0.75; line-height: 1.5; }

`

function injectStyles () {
  if (document.getElementById('odd-styles')) return
  const tag = document.createElement('style')
  tag.id = 'odd-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

export default class OmniDrawDynamic {
  constructor (context) {
    this.ctx = context
    this._el = null
    this._isOpen = false
    this._tickers = []   // [{ mesh, words, currentIndex, elapsed, labelEl }]
    this._onNavSelect = null
  }

  init () {
    injectStyles()
    this._onNavSelect = (e) => {
      if (e.detail?.item !== '⟐OmniDrawDynamic') return
      this.open()
    }
    window.addEventListener('omni:nav-select', this._onNavSelect)
  }

  /** Advances every real, live ticker — one word visible at a time,
   *  in order, looping back to the start once it reaches the end. */
  update (delta) {
    this._tickers.forEach(ticker => ticker.update(delta))
  }

  onResize () {}

  destroy () {
    window.removeEventListener('omni:nav-select', this._onNavSelect)
    this._tickers.forEach(t => t.destroy())
    this._tickers = []
    this._el?.parentNode?.removeChild(this._el)
    WindowManager.unregister('omnidrawdynamic')
  }

  open () {
    if (!this._el) this._el = this._buildDOM()
    const shell = document.getElementById('omni-ui') ?? document.body
    if (!this._el.parentNode) shell.appendChild(this._el)
    this._el.style.visibility = 'visible'
    gsap.to(this._el, { opacity: WindowManager.getPanelOpacity(), duration: 0.25 })
    this._isOpen = true
  }

  close () {
    if (!this._el) return
    gsap.to(this._el, { opacity: 0, duration: 0.18, onComplete: () => { this._el.style.visibility = 'hidden' } })
    this._isOpen = false
  }

  minimize () {
    if (!this._el) return
    const rect = this._el.getBoundingClientRect()
    gsap.to(this._el, { opacity: 0, scale: 0.3, duration: 0.2, onComplete: () => { this._el.style.visibility = 'hidden' } })
    this._isOpen = false
    window.dispatchEvent(new CustomEvent('omni:panel-minimized', {
      detail: { id: 'omnidrawdynamic', label: '⟐OmniDrawDynamic', iconLabel: '⟐D',
        fromRect: { x: rect.left, y: rect.top, w: rect.width, h: rect.height }, variant: 'orb' }
    }))
  }

  /** Real word-array parsing — words, not letters, split on
   *  whitespace, each becoming one index. */
  _createTicker (rawString) {
    const words = rawString.trim().split(/\s+/).filter(Boolean)
    if (words.length === 0) return

    const id = generateId()
    const cam = this.ctx.camera
    const dir = new THREE.Vector3()
    cam.getWorldDirection(dir)
    dir.multiplyScalar(6)
    const position = [cam.position.x + dir.x, Math.max(0.5, cam.position.y + dir.y), cam.position.z + dir.z]

    // Reuses Static's own real placement pattern directly — the
    // anchor is genuinely Static's mechanism, not a second one.
    window.dispatchEvent(new CustomEvent('omni:node-create-request', {
      detail: {
        id, label: 'DynamicTicker_' + Date.now().toString(36).slice(-4),
        geometry: 'SphereGeometry', primitive: 'objective', color: '#7fd8ff',
        position, rotation: [0, 0, 0], scale: [0.3, 0.3, 0.3], parentId: null,
      }
    }))

    const worldPos = new THREE.Vector3(...position)
    const ticker = new WordTicker(cam, worldPos, words)
    this._tickers.push(ticker)

    confirmPrimaryForce('dynamic-draw-created', true, { id, wordCount: words.length })
  }

  _buildDOM () {
    const el = document.createElement('div')
    el.className = 'omni-draw-dynamic-panel'
    el.innerHTML = `
      <div class="odd-header">
        <span class="odd-title">⟐OmniDraw(Dynamic)</span>
        <div class="odd-controls">
          <button class="odd-ctrl" data-action="minimize" title="Minimize">–</button>
          <button class="odd-ctrl" data-action="close" title="Close">×</button>
        </div>
      </div>
      <div class="odd-body">
        <textarea class="odd-text-input" id="odd-string-input" placeholder="Type a string — each word becomes its own step..."></textarea>
        <button class="odd-create-btn" id="odd-create">Create Ticker</button>
        <div class="odd-note">One word visible at a time, in order, looping — shifts like a notification. Rotation styles, the command panel, and capture/tooltip are real, separate future work, not built here.</div>
      </div>
    `

    el.querySelector('[data-action="minimize"]').addEventListener('click', () => this.minimize())
    el.querySelector('[data-action="close"]').addEventListener('click', () => this.close())
    el.querySelector('#odd-create').addEventListener('click', () => {
      const input = el.querySelector('#odd-string-input')
      this._createTicker(input.value)
      input.value = ''
    })

    this._bindHeader(el)
    el.dataset.winId = 'omnidrawdynamic'
    WindowManager.register('omnidrawdynamic', el, 'OmniDraw(Dynamic)')
    WindowManager.watchPanelOpacity(el, () => this._isOpen)

    return el
  }

  _bindHeader (el) {
    const header = el.querySelector('.odd-header')
    const drag = { active: false }
    const onDown = (e) => {
      if (e.target.closest('button')) return
      const cx = e.touches?.[0]?.clientX ?? e.clientX
      const cy = e.touches?.[0]?.clientY ?? e.clientY
      const rect = el.getBoundingClientRect()
      drag.active = true; drag.startX = cx; drag.startY = cy; drag.originX = rect.left; drag.originY = rect.top
    }
    const onMove = (e) => {
      if (!drag.active) return
      const cx = e.touches?.[0]?.clientX ?? e.clientX
      const cy = e.touches?.[0]?.clientY ?? e.clientY
      gsap.set(el, { left: drag.originX + (cx - drag.startX), top: drag.originY + (cy - drag.startY) })
    }
    const onUp = () => { drag.active = false }
    header.addEventListener('mousedown', onDown)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    header.addEventListener('touchstart', onDown, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', onUp)
  }
}
