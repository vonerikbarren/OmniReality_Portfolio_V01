/**
 * ui/OmniCommunicationPanel.js — ⟐OmniCommunicationPanel
 *
 * The real, second inspector for OmniDraw(Dynamic)'s own tickers —
 * confirmed name. One shared panel, retargeted by selection (the
 * same real model OmniInspector itself uses), not one instance per
 * ticker — confirmed directly, including the mobile-scale reasoning.
 *
 * Finds its ticker through utils/WordTickerRegistry.js, keyed by the
 * selected node's own real id — not by guessing or position-matching.
 * A node with no registered ticker shows a real, honest empty state
 * rather than a broken-looking panel.
 *
 * Direction is a plain signed value on the ticker itself (+1/-1),
 * confirmed to future-proof clockwise/counter-clockwise circular
 * arrangements later — Reverse flips it; Backward/Forward are single
 * manual steps, a genuinely different thing from Reverse.
 *
 * Per-word shape/texture-on-iteration is explicitly NOT built here —
 * confirmed as a real, separate future pass ("build this in parts").
 */

import gsap from 'gsap'
import * as WindowManager from './WindowManager.js'
import { getTicker } from '../utils/WordTickerRegistry.js'
import { FONT_OPTIONS } from './OmniDraw.js'

const STYLES = `

.omni-communication-panel {
  pointer-events   : auto;
  --ocp-bg         : var(--omni-theme-bg, rgba(8, 8, 12, 0.92));
  --ocp-border     : var(--omni-theme-border, rgba(255, 255, 255, 0.09));
  --ocp-header-bg  : var(--omni-theme-header-bg, rgba(255, 255, 255, 0.03));
  --ocp-text       : var(--omni-theme-text, rgba(255, 255, 255, 0.92));
  --ocp-text-dim   : var(--omni-theme-text-dim, rgba(255, 255, 255, 0.65));
  --ocp-accent     : var(--omni-theme-accent, #7fd8ff);
  --mono           : 'Courier New', Courier, monospace;

  position         : fixed;
  top              : 130px;
  left             : 540px;
  width            : 320px;
  min-width        : 280px;
  max-width        : 92vw;
  height           : 460px;
  min-height       : 320px;

  display          : flex;
  flex-direction   : column;

  background       : var(--ocp-bg);
  backdrop-filter  : blur(20px) saturate(1.5);
  -webkit-backdrop-filter: blur(20px) saturate(1.5);
  border           : 1px solid var(--ocp-border);
  border-radius    : 12px;
  box-shadow       : 0 0 20px rgba(0,0,0,0.4), 0 10px 30px rgba(0,0,0,0.5);

  font-family      : var(--mono);
  z-index          : 60;
  overflow         : hidden;
  resize           : both;
  opacity          : 0;
  visibility       : hidden;
}

.ocp-header {
  height           : 38px;
  flex-shrink      : 0;
  display          : flex;
  align-items      : center;
  justify-content  : center;
  background       : var(--ocp-header-bg);
  border-bottom    : 1px solid var(--ocp-border);
  cursor           : grab;
  user-select      : none;
  position         : relative;
}
.ocp-title { font-size: 11px; letter-spacing: 0.05em; color: var(--ocp-text-dim); }
.ocp-controls { position: absolute; right: 8px; display: flex; gap: 4px; }
.ocp-ctrl {
  width: 20px; height: 20px; border-radius: 5px;
  border: 1px solid var(--ocp-border); background: rgba(255,255,255,0.04);
  color: var(--ocp-text-dim); font-size: 11px;
  display: flex; align-items: center; justify-content: center; cursor: pointer;
}
.ocp-ctrl:hover { background: rgba(255,255,255,0.1); color: var(--ocp-text); }

.ocp-body { flex: 1 1 auto; overflow-y: auto; padding: 10px 12px; display: flex; flex-direction: column; gap: 10px; }
.ocp-empty { color: var(--ocp-text-dim); font-size: 11px; text-align: center; padding: 30px 10px; line-height: 1.6; }

.ocp-transport { display: flex; gap: 5px; }
.ocp-tbtn {
  flex: 1; background: rgba(255,255,255,0.05); border: 1px solid var(--ocp-border);
  color: var(--ocp-text); font-family: inherit; font-size: 12px; padding: 6px; border-radius: 5px; cursor: pointer;
}
.ocp-tbtn:hover { background: rgba(255,255,255,0.12); }
.ocp-tbtn.is-active { border-color: var(--ocp-accent); color: var(--ocp-accent); }

.ocp-section-label { font-size: 9px; color: var(--ocp-text-dim); letter-spacing: 0.05em; text-transform: uppercase; margin-top: 2px; }

.ocp-speed-row { display: flex; align-items: center; gap: 8px; }
.ocp-speed-number {
  width: 56px; background: rgba(255,255,255,0.05); border: 1px solid var(--ocp-border);
  border-radius: 5px; color: var(--ocp-text); font-family: inherit; font-size: 11px; padding: 5px;
}
.ocp-speed-slider { flex: 1; }

.ocp-word-list { display: flex; flex-direction: column; gap: 2px; max-height: 130px; overflow-y: auto; }
.ocp-word-row {
  display: flex; align-items: center; gap: 6px; padding: 4px 6px; border-radius: 4px;
  cursor: pointer; font-size: 11px; color: var(--ocp-text-dim);
}
.ocp-word-row:hover { background: rgba(255,255,255,0.06); }
.ocp-word-row.is-current { background: rgba(127,216,255,0.15); color: var(--ocp-accent); }
.ocp-word-index { opacity: 0.5; width: 20px; flex-shrink: 0; }

.ocp-word-edit { display: flex; gap: 6px; }
.ocp-word-edit input {
  flex: 1; background: rgba(255,255,255,0.05); border: 1px solid var(--ocp-border);
  border-radius: 5px; color: var(--ocp-text); font-family: inherit; font-size: 11px; padding: 6px;
}

.ocp-style-row { display: flex; gap: 6px; }
.ocp-style-row input[type="color"] { width: 32px; height: 28px; padding: 0; border-radius: 5px; border: 1px solid var(--ocp-border); }
.ocp-style-row input[type="number"] {
  width: 50px; background: rgba(255,255,255,0.05); border: 1px solid var(--ocp-border);
  border-radius: 5px; color: var(--ocp-text); font-family: inherit; font-size: 11px; padding: 5px;
}
.ocp-style-row select {
  flex: 1; background: rgba(255,255,255,0.05); border: 1px solid var(--ocp-border);
  border-radius: 5px; color: var(--ocp-text); font-family: inherit; font-size: 11px; padding: 5px;
}

.ocp-save-btn {
  background: rgba(127,216,255,0.15); border: 1px solid var(--ocp-accent);
  color: var(--ocp-accent); font-family: inherit; font-size: 11px; padding: 8px; border-radius: 5px; cursor: pointer;
}
.ocp-save-btn:hover { background: rgba(127,216,255,0.25); }
.ocp-save-confirm { font-size: 9px; color: #8cff8c; text-align: center; height: 12px; opacity: 0; transition: opacity 0.3s; }
.ocp-save-confirm.is-visible { opacity: 1; }

`

function injectStyles () {
  if (document.getElementById('ocp-styles')) return
  const tag = document.createElement('style')
  tag.id = 'ocp-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

const AUTOSAVE_INTERVAL = 8   // seconds — real, periodic, "just in case," not on every keystroke

export default class OmniCommunicationPanel {
  constructor (context) {
    this.ctx = context
    this._el = null
    this._isOpen = false
    this._currentNodeId = null
    this._currentTicker = null
    this._editingIndex = null
    this._autosaveElapsed = 0
    this._onNodeSelected = null
  }

  init () {
    injectStyles()
    this._onNodeSelected = (e) => this._retarget(e.detail?.mesh)
    window.addEventListener('omni:node-selected', this._onNodeSelected)
  }

  update (delta) {
    if (!this._isOpen || !this._currentTicker) return
    this._syncWordHighlight()
    this._autosaveElapsed += delta
    if (this._autosaveElapsed >= AUTOSAVE_INTERVAL) {
      this._autosaveElapsed = 0
      this._save(false)
    }
  }

  onResize () {}

  destroy () {
    window.removeEventListener('omni:node-selected', this._onNodeSelected)
    this._el?.parentNode?.removeChild(this._el)
    WindowManager.unregister('omnicommunicationpanel')
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
      detail: { id: 'omnicommunicationpanel', label: '⟐OmniCommunicationPanel', iconLabel: '⟐C',
        fromRect: { x: rect.left, y: rect.top, w: rect.width, h: rect.height }, variant: 'orb' }
    }))
  }

  /** Real retargeting — the same model OmniInspector itself uses.
   *  One panel, pointed at whichever selected node actually has a
   *  real, registered ticker; anything else shows a real empty
   *  state rather than looking broken. */
  _retarget (mesh) {
    const nodeId = mesh?.userData?.nodeId ?? null
    this._currentNodeId = nodeId
    this._currentTicker = nodeId ? getTicker(nodeId) : null
    this._editingIndex = null
    if (this._currentTicker) {
      this._loadSaved(nodeId)
      if (!this._el) this._el = this._buildDOM()
      this.open()
    } else if (this._isOpen) {
      // Already open, selection just moved to something unrelated —
      // reflect that honestly rather than staying stuck on stale data.
      this._render()
      return
    }
    this._render()
  }

  _render () {
    const body = this._el?.querySelector('.ocp-body')
    if (!body) return
    if (!this._currentTicker) {
      body.innerHTML = `<div class="ocp-empty">Select a node with an active word ticker to control it here.</div>`
      return
    }
    body.innerHTML = this._buildControlsHTML()
    this._bindControls(body)
  }

  _buildControlsHTML () {
    const t = this._currentTicker
    const wordsHTML = t.words.map((w, i) => `
      <div class="ocp-word-row ${i === t.currentIndex ? 'is-current' : ''}" data-index="${i}">
        <span class="ocp-word-index">${i}</span><span class="ocp-word-text">${w}</span>
      </div>
    `).join('')

    const editHTML = this._editingIndex !== null ? `
      <div class="ocp-word-edit">
        <input type="text" id="ocp-edit-input" value="${t.words[this._editingIndex]}" />
        <button class="ocp-tbtn" id="ocp-edit-apply">✓</button>
      </div>
    ` : ''

    const fontOptionsHTML = FONT_OPTIONS.map(f => `<option value="${f}" ${f === t.fontFamily ? 'selected' : ''}>${f.split(',')[0]}</option>`).join('')

    return `
      <div class="ocp-transport">
        <button class="ocp-tbtn" data-action="backward" title="Previous index">|◀</button>
        <button class="ocp-tbtn ${!t.isPaused ? '' : 'is-active'}" data-action="play-pause" title="Play/Pause">${t.isPaused ? '▶' : '⏸'}</button>
        <button class="ocp-tbtn" data-action="forward" title="Next index">▶|</button>
        <button class="ocp-tbtn ${t.direction < 0 ? 'is-active' : ''}" data-action="reverse" title="Reverse auto-play direction">⟲</button>
      </div>

      <div class="ocp-section-label">Speed (seconds per word)</div>
      <div class="ocp-speed-row">
        <input type="number" class="ocp-speed-number" id="ocp-speed-number" value="${t.intervalSeconds}" min="0.1" step="0.1" />
        <input type="range" class="ocp-speed-slider" id="ocp-speed-slider" value="${t.intervalSeconds}" min="0.1" max="5" step="0.1" />
      </div>

      <div class="ocp-section-label">Words — click to jump, click text to edit</div>
      <div class="ocp-word-list" id="ocp-word-list">${wordsHTML}</div>
      ${editHTML}

      <div class="ocp-section-label">Appearance (this node only)</div>
      <div class="ocp-style-row">
        <input type="color" id="ocp-color" value="${t.color}" />
        <input type="number" id="ocp-fontsize" value="${t.fontSize}" min="8" max="48" title="Font size" />
        <select id="ocp-font">${fontOptionsHTML}</select>
      </div>

      <button class="ocp-save-btn" id="ocp-save">Save</button>
      <div class="ocp-save-confirm" id="ocp-save-confirm">Saved.</div>
    `
  }

  _bindControls (body) {
    const t = this._currentTicker

    body.querySelector('[data-action="backward"]').addEventListener('click', () => { t.stepBackward(); this._render() })
    body.querySelector('[data-action="forward"]').addEventListener('click', () => { t.stepForward(); this._render() })
    body.querySelector('[data-action="play-pause"]').addEventListener('click', () => {
      if (t.isPaused) t.play(); else t.pause()
      this._render()
    })
    body.querySelector('[data-action="reverse"]').addEventListener('click', () => { t.toggleReverse(); this._render() })

    body.querySelector('#ocp-speed-number').addEventListener('input', (e) => {
      t.setSpeed(Number(e.target.value))
      body.querySelector('#ocp-speed-slider').value = e.target.value
    })
    body.querySelector('#ocp-speed-slider').addEventListener('input', (e) => {
      t.setSpeed(Number(e.target.value))
      body.querySelector('#ocp-speed-number').value = e.target.value
    })

    body.querySelectorAll('.ocp-word-row').forEach(row => {
      row.addEventListener('click', (e) => {
        const index = Number(row.dataset.index)
        if (e.target.classList.contains('ocp-word-text')) {
          this._editingIndex = index
          this._render()
          return
        }
        t.jumpTo(index)
        this._render()
      })
    })

    const editInput = body.querySelector('#ocp-edit-input')
    if (editInput) {
      body.querySelector('#ocp-edit-apply').addEventListener('click', () => {
        t.setWord(this._editingIndex, editInput.value)
        this._editingIndex = null
        this._render()
      })
    }

    body.querySelector('#ocp-color').addEventListener('input', (e) => t.setStyle({ color: e.target.value }))
    body.querySelector('#ocp-fontsize').addEventListener('input', (e) => t.setStyle({ fontSize: Number(e.target.value) }))
    body.querySelector('#ocp-font').addEventListener('change', (e) => t.setStyle({ fontFamily: e.target.value }))

    body.querySelector('#ocp-save').addEventListener('click', () => this._save(true))
  }

  /** Live sync — the panel's own word-list highlight follows the
   *  ticker's real, actual current index every frame, rather than
   *  only updating when a button in this panel is clicked. */
  _syncWordHighlight () {
    const list = this._el?.querySelector('#ocp-word-list')
    if (!list) return
    const rows = list.querySelectorAll('.ocp-word-row')
    rows.forEach((row, i) => row.classList.toggle('is-current', i === this._currentTicker.currentIndex))
  }

  _save (showConfirm) {
    if (!this._currentTicker || !this._currentNodeId) return
    const t = this._currentTicker
    try {
      localStorage.setItem(`omniCommunicationPanel:${this._currentNodeId}`, JSON.stringify({
        words: t.words, intervalSeconds: t.intervalSeconds, direction: t.direction,
        color: t.color, fontSize: t.fontSize, fontFamily: t.fontFamily,
      }))
    } catch (_) { /* storage unavailable — real save simply skipped, not fatal */ }

    if (showConfirm) {
      const confirmEl = this._el?.querySelector('#ocp-save-confirm')
      if (confirmEl) {
        confirmEl.classList.add('is-visible')
        setTimeout(() => confirmEl.classList.remove('is-visible'), 1600)
      }
    }
  }

  _loadSaved (nodeId) {
    try {
      const raw = localStorage.getItem(`omniCommunicationPanel:${nodeId}`)
      if (!raw) return
      const saved = JSON.parse(raw)
      const t = this._currentTicker
      if (Array.isArray(saved.words) && saved.words.length === t.words.length) t.words = saved.words
      if (typeof saved.intervalSeconds === 'number') t.intervalSeconds = saved.intervalSeconds
      if (saved.direction === 1 || saved.direction === -1) t.direction = saved.direction
      t.setStyle({ color: saved.color, fontSize: saved.fontSize, fontFamily: saved.fontFamily })
    } catch (_) { /* no valid saved state — real ticker defaults simply stand */ }
  }

  _buildDOM () {
    const el = document.createElement('div')
    el.className = 'omni-communication-panel'
    el.innerHTML = `
      <div class="ocp-header">
        <span class="ocp-title">⟐OmniCommunicationPanel</span>
        <div class="ocp-controls">
          <button class="ocp-ctrl" data-action="minimize" title="Minimize">–</button>
          <button class="ocp-ctrl" data-action="close" title="Close">×</button>
        </div>
      </div>
      <div class="ocp-body"></div>
    `

    el.querySelector('[data-action="minimize"]').addEventListener('click', () => this.minimize())
    el.querySelector('[data-action="close"]').addEventListener('click', () => this.close())

    this._bindHeader(el)
    el.dataset.winId = 'omnicommunicationpanel'
    WindowManager.register('omnicommunicationpanel', el, 'OmniCommunicationPanel')
    WindowManager.watchPanelOpacity(el, () => this._isOpen)

    return el
  }

  _bindHeader (el) {
    const header = el.querySelector('.ocp-header')
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
