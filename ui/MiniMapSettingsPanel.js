/**
 * ui/MiniMapSettingsPanel.js — ⟐MiniMapSettings, Admin slot 4
 *
 * The mini map used to be a fixed, undraggable-preference,
 * bottom-center HUD element with no settings of its own. Per direct
 * request it now behaves like the corner minimap in BotW/TotK — a
 * real, editable corner position, toggled visible/hidden with the
 * 'M' key (main.js) — and gets its own settings panel here, in the
 * same "own dedicated panel" pattern already used by
 * ui/UserPresenterVideoSettings.js for OmniExpression/Presenter.
 *
 * Reads/writes utils/MiniMapSettings.js, which ui/MiniMap.js itself
 * reads at init() and re-applies live via omni:minimap-settings-set.
 */

import gsap from 'gsap'
import * as WindowManager from './WindowManager.js'
import { getSettings, setSettings } from '../utils/MiniMapSettings.js'

const STYLES = `

.minimap-settings-panel {
  pointer-events   : auto;
  --mms-bg         : var(--omni-theme-bg, rgba(8, 8, 12, 0.92));
  --mms-border     : var(--omni-theme-border, rgba(255, 255, 255, 0.09));
  --mms-header-bg  : var(--omni-theme-header-bg, rgba(255, 255, 255, 0.03));
  --mms-text       : var(--omni-theme-text, rgba(255, 255, 255, 0.92));
  --mms-text-dim   : var(--omni-theme-text-dim, rgba(255, 255, 255, 0.65));
  --mms-accent     : var(--omni-theme-accent, var(--omni-color-accent-blue));
  --mono           : 'Courier New', Courier, monospace;

  position         : fixed;
  top              : 110px;
  left             : 110px;
  width            : 290px;
  min-width        : 250px;
  height           : 340px;
  min-height       : 280px;

  display          : flex;
  flex-direction   : column;

  background       : var(--mms-bg);
  backdrop-filter  : blur(20px) saturate(1.5);
  -webkit-backdrop-filter: blur(20px) saturate(1.5);
  border           : 1px solid var(--mms-border);
  border-radius    : 12px;
  box-shadow       : 0 0 20px rgba(0,0,0,0.4), 0 10px 30px rgba(0,0,0,0.5);

  font-family      : var(--mono);
  z-index          : 60;
  overflow         : hidden;
  resize           : both;
  opacity          : 0;
  visibility       : hidden;
}

.mms-header {
  height           : 38px;
  flex-shrink      : 0;
  display          : flex;
  align-items      : center;
  justify-content  : center;
  background       : var(--mms-header-bg);
  border-bottom    : 1px solid var(--mms-border);
  cursor           : grab;
  user-select      : none;
  position         : relative;
}
.mms-title { font-size: 11px; letter-spacing: 0.05em; color: var(--mms-text-dim); }
.mms-controls { position: absolute; right: 8px; display: flex; gap: 4px; }
.mms-ctrl {
  width: 20px; height: 20px; border-radius: 5px;
  border: 1px solid var(--mms-border); background: rgba(255,255,255,0.04);
  color: var(--mms-text-dim); font-size: 11px;
  display: flex; align-items: center; justify-content: center; cursor: pointer;
}
.mms-ctrl:hover { background: rgba(255,255,255,0.1); color: var(--mms-text); }

.mms-body { flex: 1 1 auto; overflow-y: auto; padding: 14px 16px; display: flex; flex-direction: column; gap: 14px; }
.mms-field-label { font-size: 9px; color: var(--mms-text-dim); letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 6px; }

.mms-corner-grid {
  display: grid; grid-template-columns: 1fr 1fr; gap: 6px;
  background: rgba(255,255,255,0.03); border: 1px solid var(--mms-border); border-radius: 8px; padding: 8px;
}
.mms-corner-btn {
  background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.14);
  border-radius: 6px; color: var(--mms-text-dim); font-size: 9px; font-family: var(--mono);
  padding: 10px 6px; cursor: pointer; text-align: center;
}
.mms-corner-btn:hover { background: rgba(255,255,255,0.10); }
.mms-corner-btn.is-active { border-color: var(--mms-accent); color: var(--mms-accent); background: rgba(var(--omni-color-accent-blue-rgb), 0.10); }

.mms-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.mms-row-label { font-size: 10px; color: var(--mms-text); }

.mms-toggle { position: relative; width: 34px; height: 18px; flex-shrink: 0; }
.mms-toggle input { position: absolute; inset: 0; opacity: 0; margin: 0; cursor: pointer; }
.mms-toggle-track {
  position: absolute; inset: 0; border-radius: 999px;
  background: rgba(255,255,255,0.14); border: 1px solid rgba(255,255,255,0.18);
  transition: background 0.15s;
}
.mms-toggle input:checked + .mms-toggle-track { background: rgba(var(--omni-color-accent-blue-rgb), 0.55); border-color: rgba(var(--omni-color-accent-blue-rgb), 0.7); }
.mms-toggle-track::after {
  content: ''; position: absolute; top: 1px; left: 1px; width: 14px; height: 14px;
  border-radius: 50%; background: #fff; transition: transform 0.15s;
}
.mms-toggle input:checked + .mms-toggle-track::after { transform: translateX(16px); }

.mms-btn {
  background: rgba(140, 255, 180, 0.1); border: 1px solid rgba(140, 255, 180, 0.3);
  color: rgba(160, 255, 195, 0.95); border-radius: 6px; padding: 7px 10px;
  font-family: var(--mono); font-size: 9.5px; cursor: pointer; text-align: center;
}
.mms-btn:hover { background: rgba(140, 255, 180, 0.18); }

.mms-note { font-size: 9px; color: var(--mms-text-dim); opacity: 0.75; line-height: 1.5; }
.mms-hint { font-size: 9px; color: var(--mms-accent); opacity: 0.9; }

`

function injectStyles () {
  if (document.getElementById('mms-styles')) return
  const tag = document.createElement('style')
  tag.id = 'mms-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

// The 4 corners plus 4 plain edge-centers — "top/bottom/left/right" as
// their own standalone anchors, distinct from the corner combinations,
// per direct request.
const CORNERS = [
  { key: 'top-left',     label: '◤ Top Left' },
  { key: 'top',          label: '⬒ Top' },
  { key: 'top-right',    label: '◥ Top Right' },
  { key: 'left',         label: '◧ Left' },
  { key: 'right',        label: '◨ Right' },
  { key: 'bottom-left',  label: '◣ Bottom Left' },
  { key: 'bottom',       label: '⬓ Bottom' },
  { key: 'bottom-right', label: '◢ Bottom Right' },
]

export default class MiniMapSettingsPanel {
  constructor () {
    this._el = null
    this._isOpen = false
    this._onNavSelect = null
  }

  init () {
    injectStyles()
    this._onNavSelect = (e) => {
      if (e.detail?.item !== '⟐MiniMapSettings') return
      this.open()
    }
    window.addEventListener('omni:nav-select', this._onNavSelect)
  }

  update () {}
  onResize () {}

  destroy () {
    window.removeEventListener('omni:nav-select', this._onNavSelect)
    window.removeEventListener('omni:minimap-toggle', this._onMinimapToggle)
    this._el?.parentNode?.removeChild(this._el)
    WindowManager.unregister('minimapsettings')
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
      detail: { id: 'minimapsettings', label: '⟐MiniMapSettings', iconLabel: '⟐M',
        fromRect: { x: rect.left, y: rect.top, w: rect.width, h: rect.height }, variant: 'app' }
    }))
  }

  _buildDOM () {
    const el = document.createElement('div')
    el.className = 'minimap-settings-panel'
    const s = getSettings()

    el.innerHTML = `
      <div class="mms-header">
        <span class="mms-title">⟐MiniMapSettings</span>
        <div class="mms-controls">
          <button class="mms-ctrl" data-action="minimize" title="Minimize">–</button>
          <button class="mms-ctrl" data-action="close" title="Close">×</button>
        </div>
      </div>
      <div class="mms-body">
        <div>
          <div class="mms-field-label">Position</div>
          <div class="mms-corner-grid" id="mms-corner-grid">
            ${CORNERS.map(c => `<button class="mms-corner-btn ${s.corner === c.key ? 'is-active' : ''}" data-corner="${c.key}">${c.label}</button>`).join('')}
          </div>
        </div>

        <div class="mms-row">
          <span class="mms-row-label">MiniMap Visible</span>
          <label class="mms-toggle">
            <input type="checkbox" id="mms-visible-now" ${s.startVisible ? 'checked' : ''}>
            <div class="mms-toggle-track"></div>
          </label>
        </div>

        <div class="mms-row">
          <span class="mms-row-label">Show Portal Markers</span>
          <label class="mms-toggle">
            <input type="checkbox" id="mms-portals" ${s.showPortals ? 'checked' : ''}>
            <div class="mms-toggle-track"></div>
          </label>
        </div>

        <div class="mms-row">
          <span class="mms-row-label">Visible on Start</span>
          <label class="mms-toggle">
            <input type="checkbox" id="mms-start-visible" ${s.startVisible ? 'checked' : ''}>
            <div class="mms-toggle-track"></div>
          </label>
        </div>

        <button class="mms-btn" id="mms-reset-position">Reset Position to Corner</button>

        <div class="mms-hint">Press M anytime to show/hide the mini map.</div>
        <div class="mms-note">Dragging the map moves it freely for the rest of the session — "Reset Position" snaps it back to whichever corner is selected above. Corner and visibility changes apply immediately.</div>
      </div>
    `

    el.querySelector('[data-action="minimize"]').addEventListener('click', () => this.minimize())
    el.querySelector('[data-action="close"]').addEventListener('click', () => this.close())

    el.querySelectorAll('.mms-corner-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        el.querySelectorAll('.mms-corner-btn').forEach(b => b.classList.remove('is-active'))
        btn.classList.add('is-active')
        setSettings({ corner: btn.dataset.corner })
      })
    })

    // Live now/hidden-now — separate from "Visible on Start" below, which
    // only takes effect on next launch. Dispatches to main.js, the only
    // place holding the real MiniMap instance (see 'm' key handler there).
    el.querySelector('#mms-visible-now').addEventListener('change', (e) => {
      window.dispatchEvent(new CustomEvent('omni:minimap-visibility-set', { detail: { visible: e.target.checked } }))
    })
    // Keep that checkbox honest if visibility changes some other way
    // while this panel is open (the 'm' key, or this same event from
    // elsewhere) — MiniMap.js already broadcasts every real change.
    this._onMinimapToggle = (e) => {
      const cb = this._el?.querySelector('#mms-visible-now')
      if (cb) cb.checked = !!e.detail?.visible
    }
    window.addEventListener('omni:minimap-toggle', this._onMinimapToggle)

    el.querySelector('#mms-portals').addEventListener('change', (e) => setSettings({ showPortals: e.target.checked }))
    el.querySelector('#mms-start-visible').addEventListener('change', (e) => setSettings({ startVisible: e.target.checked }))
    el.querySelector('#mms-reset-position').addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('omni:minimap-reset-position'))
    })

    this._bindHeader(el)
    el.dataset.winId = 'minimapsettings'
    WindowManager.register('minimapsettings', el, 'MiniMapSettings')
    WindowManager.watchPanelOpacity(el, () => this._isOpen)

    return el
  }

  _bindHeader (el) {
    const header = el.querySelector('.mms-header')
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
