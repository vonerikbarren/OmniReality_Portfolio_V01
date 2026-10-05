/**
 * ui/DimensionalAxesSettingsPanel.js — ⟐DimensionalAxesSettings, Admin slot 17
 *
 * Settings for systems/OmniDimensionalAxes.js (the Δ Conscious Hand and
 * ⟐ OmniHand axes). Follows ui/MiniMapSettingsPanel.js's pattern: its own
 * small draggable panel opened from an Admin slot via omni:nav-select,
 * registered with WindowManager, and a live toggle that dispatches an
 * event the real system listens for (the axes system is a main.js-scoped
 * module, so the event is the bridge, same as the minimap's toggle).
 *
 *   dispatches  omni:dimension-axes-visible-set  { visible }
 *   dispatches  omni:dimension-axes-reset
 *   listens     omni:dimension-axes-visible      { visible }  (keeps the
 *               checkbox honest if visibility changes elsewhere)
 *
 * V160: the toggle now means "Tunnels follow the pads" (ON, the default: a hand's
 * tunnel shows while its pad is open; OFF: never shown automatically). Per-tunnel
 * manual toggles live in ui/OmniAxinatorPanel.js. The persisted value lives in the
 * axes system's own localStorage key ('omni:dimension-axes-v2'); this panel only
 * reads it to draw the initial checkbox state, defaulting ON like the system does.
 */

import gsap from 'gsap'
import * as WindowManager from './WindowManager.js'

const STYLES = `
.dim-axes-settings-panel {
  pointer-events   : auto;
  --das-bg         : var(--omni-theme-bg, rgba(8, 8, 12, 0.92));
  --das-border     : var(--omni-theme-border, rgba(255, 255, 255, 0.09));
  --das-header-bg  : var(--omni-theme-header-bg, rgba(255, 255, 255, 0.03));
  --das-text       : var(--omni-theme-text, rgba(255, 255, 255, 0.92));
  --das-text-dim   : var(--omni-theme-text-dim, rgba(255, 255, 255, 0.65));
  --mono           : 'Courier New', Courier, monospace;
  position         : fixed;
  top              : 120px;
  left             : 120px;
  width            : 290px;
  min-width        : 250px;
  display          : flex;
  flex-direction   : column;
  background       : var(--das-bg);
  backdrop-filter  : blur(20px) saturate(1.5);
  -webkit-backdrop-filter: blur(20px) saturate(1.5);
  border           : 1px solid var(--das-border);
  border-radius    : 12px;
  box-shadow       : 0 0 20px rgba(0,0,0,0.4), 0 10px 30px rgba(0,0,0,0.5);
  font-family      : var(--mono);
  z-index          : 60;
  overflow         : hidden;
  opacity          : 0;
  visibility       : hidden;
}
.das-header {
  height: 38px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;
  background: var(--das-header-bg); border-bottom: 1px solid var(--das-border);
  cursor: grab; user-select: none; position: relative;
}
.das-title { font-size: 11px; letter-spacing: 0.05em; color: var(--das-text-dim); }
.das-controls { position: absolute; right: 8px; display: flex; gap: 4px; }
.das-ctrl {
  width: 20px; height: 20px; border-radius: 5px; border: 1px solid var(--das-border);
  background: rgba(255,255,255,0.04); color: var(--das-text-dim); font-size: 11px;
  display: flex; align-items: center; justify-content: center; cursor: pointer;
}
.das-ctrl:hover { background: rgba(255,255,255,0.1); color: var(--das-text); }
.das-body { padding: 14px 16px; display: flex; flex-direction: column; gap: 14px; }
.das-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.das-row-label { font-size: 10px; color: var(--das-text); }
.das-toggle { position: relative; width: 34px; height: 18px; flex-shrink: 0; }
.das-toggle input { position: absolute; inset: 0; opacity: 0; margin: 0; cursor: pointer; }
.das-toggle-track {
  position: absolute; inset: 0; border-radius: 999px;
  background: rgba(255,255,255,0.14); border: 1px solid rgba(255,255,255,0.18); transition: background 0.15s;
}
.das-toggle input:checked + .das-toggle-track { background: rgba(var(--omni-color-accent-blue-rgb), 0.55); border-color: rgba(var(--omni-color-accent-blue-rgb), 0.7); }
.das-toggle-track::after {
  content: ''; position: absolute; top: 1px; left: 1px; width: 14px; height: 14px;
  border-radius: 50%; background: #fff; transition: transform 0.15s;
}
.das-toggle input:checked + .das-toggle-track::after { transform: translateX(16px); }
.das-btn {
  background: rgba(140, 255, 180, 0.1); border: 1px solid rgba(140, 255, 180, 0.3);
  color: rgba(160, 255, 195, 0.95); border-radius: 6px; padding: 7px 10px;
  font-family: var(--mono); font-size: 9.5px; cursor: pointer; text-align: center;
}
.das-btn:hover { background: rgba(140, 255, 180, 0.18); }
.das-note { font-size: 9px; color: var(--das-text-dim); opacity: 0.75; line-height: 1.5; }
`

function injectStyles () {
  if (document.getElementById('das-styles')) return
  const tag = document.createElement('style')
  tag.id = 'das-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

function readSavedVisible () {
  try {
    const raw = localStorage.getItem('omni:dimension-axes-v2')   // V160: was the stale 'omni:dimension-axes' (the system has stored under -v2 since V159)
    return raw ? JSON.parse(raw)?.visible !== false : true
  } catch (_) { return true }
}

export default class DimensionalAxesSettingsPanel {
  constructor () {
    this._el = null
    this._isOpen = false
    this._onNavSelect = null
    this._onVisible = null
  }

  init () {
    injectStyles()
    this._onNavSelect = (e) => {
      if (e.detail?.item !== '⟐DimensionalAxesSettings') return
      this.open()
    }
    window.addEventListener('omni:nav-select', this._onNavSelect)
    this._onVisible = (e) => {
      const cb = this._el?.querySelector('#das-visible')
      if (cb) cb.checked = !!e.detail?.visible
    }
    window.addEventListener('omni:dimension-axes-visible', this._onVisible)
  }

  update () {}
  onResize () {}

  destroy () {
    window.removeEventListener('omni:nav-select', this._onNavSelect)
    window.removeEventListener('omni:dimension-axes-visible', this._onVisible)
    this._el?.parentNode?.removeChild(this._el)
    WindowManager.unregister('dimaxessettings')
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
      detail: { id: 'dimaxessettings', label: '⟐DimensionalAxesSettings', iconLabel: 'ΔΥ',
        fromRect: { x: rect.left, y: rect.top, w: rect.width, h: rect.height }, variant: 'app' }
    }))
  }

  _buildDOM () {
    const el = document.createElement('div')
    el.className = 'dim-axes-settings-panel'
    el.innerHTML = `
      <div class="das-header">
        <span class="das-title">⟐DimensionalAxesSettings</span>
        <div class="das-controls">
          <button class="das-ctrl" data-action="minimize" title="Minimize">–</button>
          <button class="das-ctrl" data-action="close" title="Close">×</button>
        </div>
      </div>
      <div class="das-body">
        <div class="das-row">
          <span class="das-row-label">Tunnels follow the pads</span>
          <label class="das-toggle">
            <input type="checkbox" id="das-visible" ${readSavedVisible() ? 'checked' : ''}>
            <div class="das-toggle-track"></div>
          </label>
        </div>
        <button class="das-btn" id="das-reset">Reset Both Markers to Default</button>
        <div class="das-note">Δ Conscious Hand and ⟐ OmniHand axes. ON (default): each hand's tunnel, nodes, marker and readout show while that hand's pad is open. OFF: they never show automatically (pins from ⟐OmniAxinator still work). Pad state keeps stepping and saving either way. Persists across reloads.</div>
      </div>
    `
    el.querySelector('[data-action="minimize"]').addEventListener('click', () => this.minimize())
    el.querySelector('[data-action="close"]').addEventListener('click', () => this.close())
    el.querySelector('#das-visible').addEventListener('change', (e) => {
      window.dispatchEvent(new CustomEvent('omni:dimension-axes-visible-set', { detail: { visible: e.target.checked } }))
    })
    el.querySelector('#das-reset').addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('omni:dimension-axes-reset'))
    })
    this._bindHeader(el)
    el.dataset.winId = 'dimaxessettings'
    WindowManager.register('dimaxessettings', el, 'DimensionalAxesSettings')
    WindowManager.watchPanelOpacity(el, () => this._isOpen)
    return el
  }

  _bindHeader (el) {
    const header = el.querySelector('.das-header')
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
