/**
 * ui/TerminalSettingsPanel.js — ⟐TerminalSettings
 *
 * The real, global default for the terminal's own accent color and
 * background opacity (TerminalTunnel's 3D visual, and OmniChat's
 * Terminal tab) — matches ToolTipSettingsPanel's exact, proven
 * pattern.
 */

import gsap from 'gsap'
import * as WindowManager from './WindowManager.js'
import { getSettings, setSettings, applyToRoot } from '../utils/TerminalSettings.js'

const STYLES = `

.terminal-settings-panel {
  pointer-events   : auto;
  --tms-bg         : var(--omni-theme-bg, rgba(8, 8, 12, 0.92));
  --tms-border     : var(--omni-theme-border, rgba(255, 255, 255, 0.09));
  --tms-header-bg  : var(--omni-theme-header-bg, rgba(255, 255, 255, 0.03));
  --tms-text       : var(--omni-theme-text, rgba(255, 255, 255, 0.92));
  --tms-text-dim   : var(--omni-theme-text-dim, rgba(255, 255, 255, 0.65));
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

  background       : var(--tms-bg);
  backdrop-filter  : blur(20px) saturate(1.5);
  -webkit-backdrop-filter: blur(20px) saturate(1.5);
  border           : 1px solid var(--tms-border);
  border-radius    : 12px;
  box-shadow       : 0 0 20px rgba(0,0,0,0.4), 0 10px 30px rgba(0,0,0,0.5);

  font-family      : var(--mono);
  z-index          : 60;
  overflow         : hidden;
  resize           : both;
  opacity          : 0;
  visibility       : hidden;
}

.tms-header {
  height           : 38px;
  flex-shrink      : 0;
  display          : flex;
  align-items      : center;
  justify-content  : center;
  background       : var(--tms-header-bg);
  border-bottom    : 1px solid var(--tms-border);
  cursor           : grab;
  user-select      : none;
  position         : relative;
}
.tms-title { font-size: 11px; letter-spacing: 0.05em; color: var(--tms-text-dim); }
.tms-controls { position: absolute; right: 8px; display: flex; gap: 4px; }
.tms-ctrl {
  width: 20px; height: 20px; border-radius: 5px;
  border: 1px solid var(--tms-border); background: rgba(255,255,255,0.04);
  color: var(--tms-text-dim); font-size: 11px;
  display: flex; align-items: center; justify-content: center; cursor: pointer;
}
.tms-ctrl:hover { background: rgba(255,255,255,0.1); color: var(--tms-text); }

.tms-body { flex: 1 1 auto; overflow-y: auto; padding: 14px 16px; display: flex; flex-direction: column; gap: 12px; }
.tms-field-label { font-size: 9px; color: var(--tms-text-dim); letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 5px; }
.tms-row { display: flex; align-items: center; gap: 10px; }
.tms-row input[type="color"] { width: 40px; height: 30px; padding: 0; border-radius: 6px; border: 1px solid var(--tms-border); cursor: pointer; }
.tms-row input[type="range"] { flex: 1; }
.tms-swatch-label { font-size: 10px; color: var(--tms-text); }
.tms-note { font-size: 9px; color: var(--tms-text-dim); line-height: 1.5; }
.tms-select {
  width: 100%; background: rgba(255,255,255,0.06); border: 1px solid var(--tms-border);
  border-radius: 5px; color: var(--tms-text); font-family: var(--mono); font-size: 10px; padding: 5px 6px;
}
`

function injectStyles () {
  if (document.getElementById('tms-styles')) return
  const tag = document.createElement('style')
  tag.id = 'tms-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

export default class TerminalSettingsPanel {
  constructor () {
    this._el = null
    this._isOpen = false
    this._onNavSelect = null
  }

  init () {
    injectStyles()
    applyToRoot()   // real, live application on boot — whatever was saved last session is already correct before this panel is ever opened
    this._onNavSelect = (e) => {
      if (e.detail?.item !== '⟐TerminalSettings') return
      this.open()
    }
    window.addEventListener('omni:nav-select', this._onNavSelect)
  }

  update () {}
  onResize () {}

  destroy () {
    window.removeEventListener('omni:nav-select', this._onNavSelect)
    this._el?.parentNode?.removeChild(this._el)
    WindowManager.unregister('terminalsettings')
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
      detail: { id: 'terminalsettings', label: '⟐TerminalSettings', iconLabel: '⟐T',
        fromRect: { x: rect.left, y: rect.top, w: rect.width, h: rect.height }, variant: 'app' }
    }))
  }

  _buildDOM () {
    const el = document.createElement('div')
    el.className = 'terminal-settings-panel'
    const s = getSettings()

    el.innerHTML = `
      <div class="tms-header">
        <span class="tms-title">⟐TerminalSettings</span>
        <div class="tms-controls">
          <button class="tms-ctrl" data-action="minimize" title="Minimize">–</button>
          <button class="tms-ctrl" data-action="close" title="Close">×</button>
        </div>
      </div>
      <div class="tms-body">
        <div>
          <div class="tms-field-label">Accent</div>
          <div class="tms-row">
            <input type="color" id="tms-accent" value="${s.accent}" />
            <span class="tms-swatch-label">Terminal accent color</span>
          </div>
        </div>
        <div>
          <div class="tms-field-label">Background opacity</div>
          <div class="tms-row">
            <input type="range" id="tms-opacity" min="0" max="1" step="0.02" value="${s.backgroundOpacity}" />
            <span class="tms-swatch-label" id="tms-opacity-val">${Math.round(s.backgroundOpacity * 100)}%</span>
          </div>
        </div>
        <div>
          <div class="tms-field-label">Panel position</div>
          <select id="tms-panel-position" class="tms-select">
            <option value="center" ${s.panelPosition === 'center' ? 'selected' : ''}>Center of the cylinder</option>
            <option value="circumference" ${s.panelPosition === 'circumference' ? 'selected' : ''}>Outer circumference</option>
          </select>
        </div>
        <div class="tms-note">Applies to both TerminalTunnel's own 3D visual and OmniChat's Terminal tab — one, real, shared default for both surfaces.</div>
      </div>
    `

    el.querySelector('[data-action="minimize"]').addEventListener('click', () => this.minimize())
    el.querySelector('[data-action="close"]').addEventListener('click', () => this.close())

    el.querySelector('#tms-accent').addEventListener('input', (e) => setSettings({ accent: e.target.value }))
    el.querySelector('#tms-opacity').addEventListener('input', (e) => {
      const val = Number(e.target.value)
      setSettings({ backgroundOpacity: val })
      el.querySelector('#tms-opacity-val').textContent = `${Math.round(val * 100)}%`
    })
    el.querySelector('#tms-panel-position').addEventListener('change', (e) => setSettings({ panelPosition: e.target.value }))

    this._bindHeader(el)
    el.dataset.winId = 'terminalsettings'
    WindowManager.register('terminalsettings', el, 'TerminalSettings')
    WindowManager.watchPanelOpacity(el, () => this._isOpen)

    return el
  }

  _bindHeader (el) {
    const header = el.querySelector('.tms-header')
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
