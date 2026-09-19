/**
 * ui/OmniExpressionatorPanel.js — ⟐mniExpressionator control panel
 *
 * Slot 3 of the ⟐OmniExpression submenu. Controls for the shared
 * particle engine in modules/OmniExpressionator.js — currently its
 * one real preset, "entrance," with a Play button for direct testing
 * plus the tunable parameters that shape it.
 *
 * Follows the standard module contract (constructor / init / update / destroy).
 */

import gsap from 'gsap'
import * as WindowManager from './WindowManager.js'

const STORE_KEY = 'omni:expressionator:settings'

function readSettings () {
  const defaults = { count: 500, color: '#ffffff', spread: 40, spawnAhead: 260, trailLen: 6, baseSpeed: 220, duration: 4.6 }
  try {
    const raw = localStorage.getItem(STORE_KEY)
    return raw ? { ...defaults, ...JSON.parse(raw) } : defaults
  } catch (_) { return defaults }
}
function saveSettings (s) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(s)) } catch (_) {}
}

const STYLES = `

.omni-expressionator-panel {
  pointer-events   : auto;
  --ex-bg          : var(--omni-theme-bg, rgba(8, 8, 12, 0.92));
  --ex-border      : var(--omni-theme-border, rgba(255, 255, 255, 0.09));
  --ex-header-bg   : var(--omni-theme-header-bg, rgba(255, 255, 255, 0.03));
  --ex-text        : var(--omni-theme-text, rgba(255, 255, 255, 0.9));
  --ex-text-dim    : var(--omni-theme-text-dim, rgba(255, 255, 255, 0.6));
  --ex-input-bg    : var(--omni-theme-input-bg, rgba(255, 255, 255, 0.04));
  --ex-input-border: var(--omni-theme-input-border, rgba(255, 255, 255, 0.18));
  --ex-accent      : var(--omni-theme-accent, rgba(255, 178, 127, 0.9));
  --mono           : 'Courier New', Courier, monospace;

  position         : fixed;
  top              : 90px;
  left             : 200px;
  width            : 320px;
  min-width        : 260px;
  max-width        : 90vw;
  height           : 440px;
  min-height       : 260px;
  max-height       : 85vh;

  display          : flex;
  flex-direction   : column;

  background       : var(--ex-bg);
  backdrop-filter  : blur(22px) saturate(1.5);
  -webkit-backdrop-filter: blur(22px) saturate(1.5);
  border           : 1px solid var(--ex-border);
  border-radius    : 14px;
  box-shadow       : 0 0 24px rgba(0,0,0,0.4), 0 12px 40px rgba(0,0,0,0.55);

  font-family      : var(--mono);
  z-index          : 60;
  overflow         : hidden;
  resize           : both;
  opacity          : 0;
  visibility       : hidden;
}

.ex-header {
  height           : 40px;
  flex-shrink      : 0;
  display          : flex;
  align-items      : center;
  justify-content  : center;
  background       : var(--ex-header-bg);
  border-bottom    : 1px solid var(--ex-border);
  cursor           : grab;
  user-select      : none;
  position         : relative;
}
.ex-header.is-dragging { cursor: grabbing; }
.ex-title { font-size: 11px; letter-spacing: 0.05em; color: var(--ex-text-dim); }
.ex-controls { position: absolute; right: 8px; display: flex; gap: 4px; }
.ex-ctrl {
  width: 20px; height: 20px; border-radius: 5px;
  border: 1px solid var(--ex-border);
  background: rgba(255,255,255,0.04);
  color: var(--ex-text-dim);
  font-size: 11px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
}
.ex-ctrl:hover { background: rgba(255,255,255,0.1); color: var(--ex-text); }

.ex-body { flex: 1 1 auto; overflow-y: auto; padding: 12px 14px; }
.ex-play-row { margin-bottom: 12px; }
.ex-play-btn {
  width: 100%; padding: 10px; border-radius: 8px; cursor: pointer;
  border: 1px solid rgba(255, 178, 127, 0.35);
  background: rgba(255, 178, 127, 0.1); color: var(--ex-accent);
  font-family: var(--mono); font-size: 12px; letter-spacing: 0.03em;
}
.ex-play-btn:hover { background: rgba(255, 178, 127, 0.18); }
.ex-play-btn.is-playing { background: rgba(255, 90, 90, 0.12); border-color: rgba(255,90,90,0.35); color: rgba(255,140,140,0.95); }

.ex-group-title { font-size: 10px; letter-spacing: 0.06em; color: var(--ex-accent); margin: 10px 0 6px; text-transform: uppercase; }
.ex-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 4px 0; }
.ex-row-label { font-size: 10.5px; color: var(--ex-text-dim); }
.ex-num, .ex-color {
  background: var(--ex-input-bg); border: 1px solid var(--ex-input-border);
  border-radius: 4px; color: var(--ex-text); font-family: var(--mono);
  font-size: 10.5px; padding: 4px 6px; width: 90px;
}
.ex-color { width: 44px; padding: 2px; height: 26px; }
.ex-note { font-size: 8.5px; color: var(--ex-text-dim); opacity: 0.75; line-height: 1.5; margin-top: 10px; }

.ex-resize-handle { position: absolute; right: 0; bottom: 0; width: 16px; height: 16px; cursor: nwse-resize; }
.ex-resize-handle::before {
  content: ''; position: absolute; right: 3px; bottom: 3px; width: 8px; height: 8px;
  border-right: 2px solid rgba(255,255,255,0.25); border-bottom: 2px solid rgba(255,255,255,0.25);
}

`

function injectStyles () {
  if (document.getElementById('omni-expressionator-styles')) return
  const tag = document.createElement('style')
  tag.id = 'omni-expressionator-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

export default class OmniExpressionatorPanel {
  constructor (context, expressionator) {
    this.ctx = context
    this.expressionator = expressionator
    this._el = null
    this._isOpen = false
    this._drag = { active: false }
  }

  init () {
    injectStyles()
    this._onNavSelect = (e) => {
      if (e.detail?.item !== '⟐OmniExpressionator') return
      this.open()
    }
    window.addEventListener('omni:nav-select', this._onNavSelect)
  }

  update () {
    if (!this._isOpen || !this._el) return
    const btn = this._el.querySelector('.ex-play-btn')
    const playing = this.expressionator?.isPlaying()
    if (btn) {
      btn.textContent = playing ? '◼ Stop' : '▶ Play Entrance'
      btn.classList.toggle('is-playing', !!playing)
    }
  }

  onResize () {}

  destroy () {
    window.removeEventListener('omni:nav-select', this._onNavSelect)
    this._el?.parentNode?.removeChild(this._el)
    WindowManager.unregister('expressionator')
  }

  open () {
    if (!this._el) this._el = this._buildDOM()
    const shell = document.getElementById('omni-ui') ?? document.body
    if (!this._el.parentNode) shell.appendChild(this._el)
    this._refreshFromStorage()
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
      detail: {
        id: 'expressionator', label: '⟐OmniExpressionator', iconLabel: '⟐E',
        fromRect: { x: rect.left, y: rect.top, w: rect.width, h: rect.height },
        variant: 'app',
      }
    }))
  }

  _readFields () {
    const el = this._el
    return {
      count: parseInt(el.querySelector('[data-field="count"]').value, 10) || 500,
      color: el.querySelector('[data-field="color"]').value,
      spread: parseFloat(el.querySelector('[data-field="spread"]').value) || 40,
      spawnAhead: parseFloat(el.querySelector('[data-field="spawnAhead"]').value) || 260,
      trailLen: parseFloat(el.querySelector('[data-field="trailLen"]').value) || 6,
      baseSpeed: parseFloat(el.querySelector('[data-field="baseSpeed"]').value) || 220,
      duration: parseFloat(el.querySelector('[data-field="duration"]').value) || 4.6,
    }
  }

  _refreshFromStorage () {
    const s = readSettings()
    this._el.querySelector('[data-field="count"]').value = s.count
    this._el.querySelector('[data-field="color"]').value = s.color
    this._el.querySelector('[data-field="spread"]').value = s.spread
    this._el.querySelector('[data-field="spawnAhead"]').value = s.spawnAhead
    this._el.querySelector('[data-field="trailLen"]').value = s.trailLen
    this._el.querySelector('[data-field="baseSpeed"]').value = s.baseSpeed
    this._el.querySelector('[data-field="duration"]').value = s.duration
  }

  _buildDOM () {
    const el = document.createElement('div')
    el.className = 'omni-expressionator-panel'
    el.innerHTML = `
      <div class="ex-header">
        <span class="ex-title">⟐OmniExpressionator</span>
        <div class="ex-controls">
          <button class="ex-ctrl" data-action="minimize" title="Minimize">–</button>
          <button class="ex-ctrl" data-action="close" title="Close">×</button>
        </div>
      </div>
      <div class="ex-body">
        <div class="ex-play-row"><button class="ex-play-btn">▶ Play Entrance</button></div>

        <div class="ex-group-title">Entrance Preset</div>
        <div class="ex-row"><span class="ex-row-label">Particle count</span><input class="ex-num" type="number" min="10" max="3000" data-field="count"></div>
        <div class="ex-row"><span class="ex-row-label">Color</span><input class="ex-color" type="color" data-field="color"></div>
        <div class="ex-row"><span class="ex-row-label">Spread</span><input class="ex-num" type="number" step="1" min="1" data-field="spread"></div>
        <div class="ex-row"><span class="ex-row-label">Spawn distance</span><input class="ex-num" type="number" step="10" min="10" data-field="spawnAhead"></div>
        <div class="ex-row"><span class="ex-row-label">Trail length</span><input class="ex-num" type="number" step="0.5" min="0.5" data-field="trailLen"></div>
        <div class="ex-row"><span class="ex-row-label">Base speed</span><input class="ex-num" type="number" step="10" min="10" data-field="baseSpeed"></div>
        <div class="ex-row"><span class="ex-row-label">Duration (sec)</span><input class="ex-num" type="number" step="0.1" min="0.5" data-field="duration"></div>

        <div class="ex-note">Streaks decelerate and fade out across the
        full duration, then stop automatically — this is the effect
        that plays on the real scene entry, matching main.js's own
        camera fall (phase 1, ~4.6s by default).</div>
      </div>
      <div class="ex-resize-handle" aria-hidden="true"></div>
    `

    this._bindHeader(el)
    this._bindResize(el)
    el.querySelector('[data-action="minimize"]').addEventListener('click', () => this.minimize())
    el.querySelector('[data-action="close"]').addEventListener('click', () => this.close())

    el.querySelector('.ex-play-btn').addEventListener('click', () => {
      if (this.expressionator?.isPlaying()) {
        this.expressionator.stop()
        return
      }
      const fields = this._readFields()
      saveSettings(fields)
      this.expressionator?.play('entrance', {
        ...fields,
        color: parseInt(fields.color.replace('#', '0x'), 16),
      })
    })

    el.dataset.winId = 'expressionator'
    WindowManager.register('expressionator', el, 'OmniExpressionator')
    WindowManager.watchPanelOpacity(el, () => this._isOpen)

    return el
  }

  _bindHeader (el) {
    const header = el.querySelector('.ex-header')
    const onDown = (e) => {
      if (e.target.closest('button')) return
      const cx = e.touches?.[0]?.clientX ?? e.clientX
      const cy = e.touches?.[0]?.clientY ?? e.clientY
      const rect = el.getBoundingClientRect()
      this._drag = { active: true, startX: cx, startY: cy, originX: rect.left, originY: rect.top }
      header.classList.add('is-dragging')
    }
    const onMove = (e) => {
      if (!this._drag.active) return
      const cx = e.touches?.[0]?.clientX ?? e.clientX
      const cy = e.touches?.[0]?.clientY ?? e.clientY
      gsap.set(el, { left: this._drag.originX + (cx - this._drag.startX), top: this._drag.originY + (cy - this._drag.startY) })
    }
    const onUp = () => { this._drag.active = false; header.classList.remove('is-dragging') }
    header.addEventListener('mousedown', onDown)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    header.addEventListener('touchstart', onDown, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', onUp)
  }

  _bindResize (el) {
    const handle = el.querySelector('.ex-resize-handle')
    if (!handle) return
    const resize = { active: false }
    const onDown = (e) => {
      e.stopPropagation()
      const cx = e.touches?.[0]?.clientX ?? e.clientX
      const cy = e.touches?.[0]?.clientY ?? e.clientY
      const rect = el.getBoundingClientRect()
      resize.active = true; resize.startX = cx; resize.startY = cy; resize.startW = rect.width; resize.startH = rect.height
    }
    const onMove = (e) => {
      if (!resize.active) return
      const cx = e.touches?.[0]?.clientX ?? e.clientX
      const cy = e.touches?.[0]?.clientY ?? e.clientY
      gsap.set(el, { width: resize.startW + (cx - resize.startX), height: resize.startH + (cy - resize.startY) })
    }
    const onUp = () => { resize.active = false }
    handle.addEventListener('mousedown', onDown)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    handle.addEventListener('touchstart', onDown, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', onUp)
  }
}
