/**
 * ui/ToolTipSettingsPanel.js — ⟐ToolTipSettings, Admin slot 9
 *
 * Confirmed directly: this is the real, global default for every
 * tooltip header's own background, border, and font color — not
 * per-node customization, which is a real, separate, future thing.
 * Reachable through the Admin drawer, matching every other Admin
 * slot's own real pattern.
 */

import gsap from 'gsap'
import * as WindowManager from './WindowManager.js'
import { getSettings, setSettings, applyToRoot } from '../utils/ToolTipSettings.js'

const STYLES = `

.tooltip-settings-panel {
  pointer-events   : auto;
  --tts-bg         : var(--omni-theme-bg, rgba(8, 8, 12, 0.92));
  --tts-border     : var(--omni-theme-border, rgba(255, 255, 255, 0.09));
  --tts-header-bg  : var(--omni-theme-header-bg, rgba(255, 255, 255, 0.03));
  --tts-text       : var(--omni-theme-text, rgba(255, 255, 255, 0.92));
  --tts-text-dim   : var(--omni-theme-text-dim, rgba(255, 255, 255, 0.65));
  --tts-accent     : var(--omni-theme-accent, #7fd8ff);
  --mono           : 'Courier New', Courier, monospace;

  position         : fixed;
  top              : 110px;
  left             : 110px;
  width            : 280px;
  min-width        : 240px;
  height           : 260px;
  min-height       : 220px;

  display          : flex;
  flex-direction   : column;

  background       : var(--tts-bg);
  backdrop-filter  : blur(20px) saturate(1.5);
  -webkit-backdrop-filter: blur(20px) saturate(1.5);
  border           : 1px solid var(--tts-border);
  border-radius    : 12px;
  box-shadow       : 0 0 20px rgba(0,0,0,0.4), 0 10px 30px rgba(0,0,0,0.5);

  font-family      : var(--mono);
  z-index          : 60;
  overflow         : hidden;
  resize           : both;
  opacity          : 0;
  visibility       : hidden;
}

.tts-header {
  height           : 38px;
  flex-shrink      : 0;
  display          : flex;
  align-items      : center;
  justify-content  : center;
  background       : var(--tts-header-bg);
  border-bottom    : 1px solid var(--tts-border);
  cursor           : grab;
  user-select      : none;
  position         : relative;
}
.tts-title { font-size: 11px; letter-spacing: 0.05em; color: var(--tts-text-dim); }
.tts-controls { position: absolute; right: 8px; display: flex; gap: 4px; }
.tts-ctrl {
  width: 20px; height: 20px; border-radius: 5px;
  border: 1px solid var(--tts-border); background: rgba(255,255,255,0.04);
  color: var(--tts-text-dim); font-size: 11px;
  display: flex; align-items: center; justify-content: center; cursor: pointer;
}
.tts-ctrl:hover { background: rgba(255,255,255,0.1); color: var(--tts-text); }

.tts-body { flex: 1 1 auto; overflow-y: auto; padding: 14px 16px; display: flex; flex-direction: column; gap: 12px; }
.tts-field-label { font-size: 9px; color: var(--tts-text-dim); letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 5px; }
.tts-row { display: flex; align-items: center; gap: 10px; }
.tts-row input[type="color"] { width: 40px; height: 30px; padding: 0; border-radius: 6px; border: 1px solid var(--tts-border); cursor: pointer; }
.tts-swatch-label { font-size: 10px; color: var(--tts-text); }
.tts-preview-header {
  align-self: flex-start; margin-top: 4px; padding: 3px 8px; border-radius: 5px; font-size: 10px;
}
.tts-note { font-size: 9px; color: var(--tts-text-dim); opacity: 0.75; line-height: 1.5; margin-top: 4px; }

`

function injectStyles () {
  if (document.getElementById('tts-styles')) return
  const tag = document.createElement('style')
  tag.id = 'tts-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

export default class ToolTipSettingsPanel {
  constructor () {
    this._el = null
    this._isOpen = false
    this._onNavSelect = null
  }

  init () {
    injectStyles()
    applyToRoot()   // real, live application on boot — whatever was saved last session is already correct before this panel is ever opened
    this._onNavSelect = (e) => {
      if (e.detail?.item !== '⟐ToolTipSettings') return
      this.open()
    }
    window.addEventListener('omni:nav-select', this._onNavSelect)
  }

  update () {}
  onResize () {}

  destroy () {
    window.removeEventListener('omni:nav-select', this._onNavSelect)
    this._el?.parentNode?.removeChild(this._el)
    WindowManager.unregister('tooltipsettings')
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
      detail: { id: 'tooltipsettings', label: '⟐ToolTipSettings', iconLabel: '⟐T',
        fromRect: { x: rect.left, y: rect.top, w: rect.width, h: rect.height }, variant: 'app' }
    }))
  }

  _buildDOM () {
    const el = document.createElement('div')
    el.className = 'tooltip-settings-panel'
    const s = getSettings()

    el.innerHTML = `
      <div class="tts-header">
        <span class="tts-title">⟐ToolTipSettings</span>
        <div class="tts-controls">
          <button class="tts-ctrl" data-action="minimize" title="Minimize">–</button>
          <button class="tts-ctrl" data-action="close" title="Close">×</button>
        </div>
      </div>
      <div class="tts-body">
        <div>
          <div class="tts-field-label">Background</div>
          <div class="tts-row">
            <input type="color" id="tts-background" value="${s.background}" />
            <span class="tts-swatch-label">Tooltip panel color</span>
          </div>
        </div>
        <div>
          <div class="tts-field-label">Border</div>
          <div class="tts-row">
            <input type="color" id="tts-border" value="${s.border}" />
            <span class="tts-swatch-label">Tooltip border color</span>
          </div>
        </div>
        <div>
          <div class="tts-field-label">Font</div>
          <div class="tts-row">
            <input type="color" id="tts-color" value="${s.color}" />
            <span class="tts-swatch-label">Tooltip text color</span>
          </div>
        </div>
        <div class="ttm-header tts-preview-header" id="tts-preview">⟐ Preview</div>
        <div class="tts-note">Applies to every tooltip's default appearance — a specific node's own override, when that exists later, will be a separate, real setting.</div>
      </div>
    `

    el.querySelector('[data-action="minimize"]').addEventListener('click', () => this.minimize())
    el.querySelector('[data-action="close"]').addEventListener('click', () => this.close())

    el.querySelector('#tts-background').addEventListener('input', (e) => setSettings({ background: e.target.value }))
    el.querySelector('#tts-border').addEventListener('input', (e) => setSettings({ border: e.target.value }))
    el.querySelector('#tts-color').addEventListener('input', (e) => setSettings({ color: e.target.value }))

    this._bindHeader(el)
    el.dataset.winId = 'tooltipsettings'
    WindowManager.register('tooltipsettings', el, 'ToolTipSettings')
    WindowManager.watchPanelOpacity(el, () => this._isOpen)

    return el
  }

  _bindHeader (el) {
    const header = el.querySelector('.tts-header')
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
