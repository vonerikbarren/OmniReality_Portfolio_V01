/**
 * ui/CameraTravelSettingsPanel.js — ⟐CameraTravelSettings
 *
 * The real settings panel behind every "Take Me There" — speed,
 * easing, and stagger, confirmed directly as real, wanted controls.
 * A real, curated list of GSAP's own eases, not invented names.
 *
 * Stagger is included and genuinely saved, but honestly labeled as
 * not yet doing anything — goToObject() only ever animates one
 * object at a time today. Kept real rather than silently dropped,
 * ready for whenever a multi-target travel exists to use it.
 */

import gsap from 'gsap'
import * as WindowManager from './WindowManager.js'
import { getSettings, setSettings, getAvailableEases } from '../utils/CameraTravelSettings.js'

const STYLES = `

.camera-travel-settings-panel {
  pointer-events   : auto;
  --cts-bg         : var(--omni-theme-bg, rgba(8, 8, 12, 0.92));
  --cts-border     : var(--omni-theme-border, rgba(255, 255, 255, 0.09));
  --cts-header-bg  : var(--omni-theme-header-bg, rgba(255, 255, 255, 0.03));
  --cts-text       : var(--omni-theme-text, rgba(255, 255, 255, 0.92));
  --cts-text-dim   : var(--omni-theme-text-dim, rgba(255, 255, 255, 0.65));
  --cts-accent     : var(--omni-theme-accent, #7fd8ff);
  --mono           : 'Courier New', Courier, monospace;

  position         : fixed;
  top              : 110px;
  left             : 110px;
  width            : 300px;
  min-width        : 260px;
  height           : 320px;
  min-height       : 240px;

  display          : flex;
  flex-direction   : column;

  background       : var(--cts-bg);
  backdrop-filter  : blur(20px) saturate(1.5);
  -webkit-backdrop-filter: blur(20px) saturate(1.5);
  border           : 1px solid var(--cts-border);
  border-radius    : 12px;
  box-shadow       : 0 0 20px rgba(0,0,0,0.4), 0 10px 30px rgba(0,0,0,0.5);

  font-family      : var(--mono);
  z-index          : 60;
  overflow         : hidden;
  resize           : both;
  opacity          : 0;
  visibility       : hidden;
}

.cts-header {
  height           : 38px;
  flex-shrink      : 0;
  display          : flex;
  align-items      : center;
  justify-content  : center;
  background       : var(--cts-header-bg);
  border-bottom    : 1px solid var(--cts-border);
  cursor           : grab;
  user-select      : none;
  position         : relative;
}
.cts-title { font-size: 11px; letter-spacing: 0.05em; color: var(--cts-text-dim); }
.cts-controls { position: absolute; right: 8px; display: flex; gap: 4px; }
.cts-ctrl {
  width: 20px; height: 20px; border-radius: 5px;
  border: 1px solid var(--cts-border); background: rgba(255,255,255,0.04);
  color: var(--cts-text-dim); font-size: 11px;
  display: flex; align-items: center; justify-content: center; cursor: pointer;
}
.cts-ctrl:hover { background: rgba(255,255,255,0.1); color: var(--cts-text); }

.cts-body { flex: 1 1 auto; overflow-y: auto; padding: 14px 16px; display: flex; flex-direction: column; gap: 12px; }
.cts-field-label { font-size: 9px; color: var(--cts-text-dim); letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 5px; }
.cts-row { display: flex; align-items: center; gap: 8px; }
.cts-number, .cts-select {
  background: rgba(255,255,255,0.05); border: 1px solid var(--cts-border);
  border-radius: 5px; color: var(--cts-text); font-family: inherit; font-size: 11px; padding: 6px;
}
.cts-number { width: 70px; }
.cts-select { flex: 1; }
.cts-slider { flex: 1; }
.cts-note { font-size: 9px; color: var(--cts-text-dim); opacity: 0.75; line-height: 1.5; }

`

function injectStyles () {
  if (document.getElementById('cts-styles')) return
  const tag = document.createElement('style')
  tag.id = 'cts-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

export default class CameraTravelSettingsPanel {
  constructor () {
    this._el = null
    this._isOpen = false
    this._onNavSelect = null
  }

  init () {
    injectStyles()
    this._onNavSelect = (e) => {
      if (e.detail?.item !== '⟐CameraTravelSettings') return
      this.open()
    }
    window.addEventListener('omni:nav-select', this._onNavSelect)
  }

  update () {}
  onResize () {}

  destroy () {
    window.removeEventListener('omni:nav-select', this._onNavSelect)
    this._el?.parentNode?.removeChild(this._el)
    WindowManager.unregister('cameratravelsettings')
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
      detail: { id: 'cameratravelsettings', label: '⟐CameraTravelSettings', iconLabel: '⟐→',
        fromRect: { x: rect.left, y: rect.top, w: rect.width, h: rect.height }, variant: 'app' }
    }))
  }

  _buildDOM () {
    const el = document.createElement('div')
    el.className = 'camera-travel-settings-panel'
    const s = getSettings()
    const easeOptions = getAvailableEases().map(e => `<option value="${e}" ${e === s.ease ? 'selected' : ''}>${e}</option>`).join('')

    el.innerHTML = `
      <div class="cts-header">
        <span class="cts-title">⟐CameraTravelSettings</span>
        <div class="cts-controls">
          <button class="cts-ctrl" data-action="minimize" title="Minimize">–</button>
          <button class="cts-ctrl" data-action="close" title="Close">×</button>
        </div>
      </div>
      <div class="cts-body">
        <div>
          <div class="cts-field-label">Speed (seconds)</div>
          <div class="cts-row">
            <input type="number" class="cts-number" id="cts-duration" value="${s.duration}" min="0.1" step="0.1" />
            <input type="range" class="cts-slider" id="cts-duration-slider" value="${s.duration}" min="0.1" max="3" step="0.1" />
          </div>
        </div>
        <div>
          <div class="cts-field-label">Ease</div>
          <select class="cts-select" id="cts-ease">${easeOptions}</select>
        </div>
        <div>
          <div class="cts-field-label">Stagger (seconds)</div>
          <div class="cts-row">
            <input type="number" class="cts-number" id="cts-stagger" value="${s.stagger}" min="0" step="0.05" />
          </div>
          <div class="cts-note">Saved and real, but not yet used — "Take Me There" only ever moves to one object at a time right now. Ready for whenever a multi-stop travel exists to use it.</div>
        </div>
      </div>
    `

    el.querySelector('[data-action="minimize"]').addEventListener('click', () => this.minimize())
    el.querySelector('[data-action="close"]').addEventListener('click', () => this.close())

    const durationInput = el.querySelector('#cts-duration')
    const durationSlider = el.querySelector('#cts-duration-slider')
    durationInput.addEventListener('input', (e) => { setSettings({ duration: Number(e.target.value) }); durationSlider.value = e.target.value })
    durationSlider.addEventListener('input', (e) => { setSettings({ duration: Number(e.target.value) }); durationInput.value = e.target.value })
    el.querySelector('#cts-ease').addEventListener('change', (e) => setSettings({ ease: e.target.value }))
    el.querySelector('#cts-stagger').addEventListener('input', (e) => setSettings({ stagger: Number(e.target.value) }))

    this._bindHeader(el)
    el.dataset.winId = 'cameratravelsettings'
    WindowManager.register('cameratravelsettings', el, 'CameraTravelSettings')
    WindowManager.watchPanelOpacity(el, () => this._isOpen)

    return el
  }

  _bindHeader (el) {
    const header = el.querySelector('.cts-header')
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
