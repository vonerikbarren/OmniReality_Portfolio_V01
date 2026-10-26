/**
 * ui/FloorManagerPanel.js — ⟐FloorManager, Admin slot 15
 *
 * Create additional floors at whatever height, adjust an existing
 * one's height, and toggle the center-screen "which floor am I on"
 * indicator. Real read access to modules/OmniFloorManager.js's
 * current floor list (passed in directly, same pattern
 * ui/OmniProgramEditorPanel.js uses for omniNode) — every write goes
 * through the real omni:floormanager-set event so there's exactly one
 * place that owns the actual THREE.GridHelper meshes and persistence.
 *
 * The ground floor (modules/OmniFloor.js's own real floor, y=0) is
 * listed read-only here as a reference point — it isn't one of
 * OmniFloorManager's floors and can't be edited or removed from here.
 */

import gsap from 'gsap'
import * as WindowManager from './WindowManager.js'

const STYLES = `

.floor-manager-panel {
  pointer-events   : auto;
  --fmp-bg         : var(--omni-theme-bg, rgba(8, 8, 12, 0.92));
  --fmp-border     : var(--omni-theme-border, rgba(255, 255, 255, 0.09));
  --fmp-header-bg  : var(--omni-theme-header-bg, rgba(255, 255, 255, 0.03));
  --fmp-text       : var(--omni-theme-text, rgba(255, 255, 255, 0.92));
  --fmp-text-dim   : var(--omni-theme-text-dim, rgba(255, 255, 255, 0.65));
  --fmp-accent     : var(--omni-theme-accent, #8cffb4);
  --mono           : 'Courier New', Courier, monospace;

  position         : fixed;
  top              : 110px;
  left             : 110px;
  width            : 300px;
  min-width        : 260px;
  height           : 380px;
  min-height       : 280px;

  display          : flex;
  flex-direction   : column;

  background       : var(--fmp-bg);
  backdrop-filter  : blur(20px) saturate(1.5);
  -webkit-backdrop-filter: blur(20px) saturate(1.5);
  border           : 1px solid var(--fmp-border);
  border-radius    : 12px;
  box-shadow       : 0 0 20px rgba(0,0,0,0.4), 0 10px 30px rgba(0,0,0,0.5);

  font-family      : var(--mono);
  z-index          : 60;
  overflow         : hidden;
  resize           : both;
  opacity          : 0;
  visibility       : hidden;
}

.fmp-header {
  height           : 38px;
  flex-shrink      : 0;
  display          : flex;
  align-items      : center;
  justify-content  : center;
  background       : var(--fmp-header-bg);
  border-bottom    : 1px solid var(--fmp-border);
  cursor           : grab;
  user-select      : none;
  position         : relative;
}
.fmp-title { font-size: 11px; letter-spacing: 0.05em; color: var(--fmp-text-dim); }
.fmp-controls { position: absolute; right: 8px; display: flex; gap: 4px; }
.fmp-ctrl {
  width: 20px; height: 20px; border-radius: 5px;
  border: 1px solid var(--fmp-border); background: rgba(255,255,255,0.04);
  color: var(--fmp-text-dim); font-size: 11px;
  display: flex; align-items: center; justify-content: center; cursor: pointer;
}
.fmp-ctrl:hover { background: rgba(255,255,255,0.1); color: var(--fmp-text); }

.fmp-body { flex: 1 1 auto; overflow-y: auto; padding: 14px 16px; display: flex; flex-direction: column; gap: 12px; }
.fmp-field-label { font-size: 9px; color: var(--fmp-text-dim); letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 6px; }

.fmp-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.fmp-row-label { font-size: 10px; color: var(--fmp-text); }

.fmp-floor-list { display: flex; flex-direction: column; gap: 6px; }
.fmp-floor-row {
  display: flex; align-items: center; gap: 6px;
  background: rgba(255,255,255,0.04); border: 1px solid var(--fmp-border);
  border-radius: 6px; padding: 6px 8px;
}
.fmp-floor-row.is-ground { opacity: 0.6; }
.fmp-floor-label { flex: 1; font-size: 9.5px; color: var(--fmp-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fmp-floor-y {
  width: 60px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.16);
  border-radius: 4px; color: #fff; font-size: 9.5px; font-family: var(--mono); padding: 3px 5px;
}
.fmp-floor-del { background: none; border: none; color: rgba(255,255,255,0.3); font-size: 11px; cursor: pointer; padding: 0 2px; }
.fmp-floor-del:hover { color: rgba(255,120,120,0.85); }

.fmp-add-row { display: flex; gap: 6px; }
.fmp-add-row input {
  flex: 1; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.16);
  border-radius: 5px; color: #fff; font-size: 9.5px; font-family: var(--mono); padding: 5px 7px;
}
.fmp-btn {
  background: rgba(140, 255, 180, 0.1); border: 1px solid rgba(140, 255, 180, 0.3);
  color: rgba(160, 255, 195, 0.95); border-radius: 6px; padding: 6px 10px;
  font-family: var(--mono); font-size: 9.5px; cursor: pointer; text-align: center;
}
.fmp-btn:hover { background: rgba(140, 255, 180, 0.18); }

.fmp-toggle { position: relative; width: 34px; height: 18px; flex-shrink: 0; }
.fmp-toggle input { position: absolute; inset: 0; opacity: 0; margin: 0; cursor: pointer; }
.fmp-toggle-track {
  position: absolute; inset: 0; border-radius: 999px;
  background: rgba(255,255,255,0.14); border: 1px solid rgba(255,255,255,0.18);
  transition: background 0.15s;
}
.fmp-toggle input:checked + .fmp-toggle-track { background: rgba(140, 255, 180, 0.5); border-color: rgba(140, 255, 180, 0.7); }
.fmp-toggle-track::after {
  content: ''; position: absolute; top: 1px; left: 1px; width: 14px; height: 14px;
  border-radius: 50%; background: #fff; transition: transform 0.15s;
}
.fmp-toggle input:checked + .fmp-toggle-track::after { transform: translateX(16px); }

.fmp-note { font-size: 9px; color: var(--fmp-text-dim); opacity: 0.75; line-height: 1.5; }

`

function injectStyles () {
  if (document.getElementById('fmp-styles')) return
  const tag = document.createElement('style')
  tag.id = 'fmp-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

export default class FloorManagerPanel {
  constructor (omniFloorManager) {
    this._floorManager = omniFloorManager
    this._el = null
    this._isOpen = false
    this._onNavSelect = null
  }

  init () {
    injectStyles()
    this._onNavSelect = (e) => {
      if (e.detail?.item !== '⟐FloorManager') return
      this.open()
    }
    window.addEventListener('omni:nav-select', this._onNavSelect)
  }

  update () {}
  onResize () {}

  destroy () {
    window.removeEventListener('omni:nav-select', this._onNavSelect)
    this._el?.parentNode?.removeChild(this._el)
    WindowManager.unregister('floormanager')
  }

  open () {
    if (!this._el) this._el = this._buildDOM()
    const shell = document.getElementById('omni-ui') ?? document.body
    if (!this._el.parentNode) shell.appendChild(this._el)
    this._el.style.visibility = 'visible'
    gsap.to(this._el, { opacity: WindowManager.getPanelOpacity(), duration: 0.25 })
    this._isOpen = true
    this._renderFloorList()
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
      detail: { id: 'floormanager', label: '⟐FloorManager', iconLabel: '⟐F',
        fromRect: { x: rect.left, y: rect.top, w: rect.width, h: rect.height }, variant: 'app' }
    }))
  }

  _buildDOM () {
    const el = document.createElement('div')
    el.className = 'floor-manager-panel'
    const indicatorVisible = this._floorManager?.isIndicatorVisible?.() ?? true

    el.innerHTML = `
      <div class="fmp-header">
        <span class="fmp-title">⟐FloorManager</span>
        <div class="fmp-controls">
          <button class="fmp-ctrl" data-action="minimize" title="Minimize">–</button>
          <button class="fmp-ctrl" data-action="close" title="Close">×</button>
        </div>
      </div>
      <div class="fmp-body">
        <div>
          <div class="fmp-field-label">Floors</div>
          <div class="fmp-floor-list" id="fmp-floor-list"></div>
        </div>

        <div class="fmp-add-row">
          <input type="text" id="fmp-new-label" placeholder="Label (e.g. Floor 2)">
          <input type="number" id="fmp-new-y" placeholder="Y" step="1" style="width:70px">
          <button class="fmp-btn" id="fmp-add-floor">+ Add</button>
        </div>

        <div class="fmp-row">
          <span class="fmp-row-label">Show Floor Indicator</span>
          <label class="fmp-toggle">
            <input type="checkbox" id="fmp-indicator-toggle" ${indicatorVisible ? 'checked' : ''}>
            <div class="fmp-toggle-track"></div>
          </label>
        </div>

        <div class="fmp-note">
          The indicator sits just below screen center and shows
          whichever floor (ground included) the camera is currently
          closest to, live. Ground (y 0) is OmniFloor's own real
          floor — it's listed for reference only and can't be edited
          or removed here.
        </div>
      </div>
    `

    el.querySelector('[data-action="minimize"]').addEventListener('click', () => this.minimize())
    el.querySelector('[data-action="close"]').addEventListener('click', () => this.close())

    el.querySelector('#fmp-add-floor').addEventListener('click', () => {
      const labelInput = el.querySelector('#fmp-new-label')
      const yInput = el.querySelector('#fmp-new-y')
      const label = labelInput.value.trim() || undefined
      const y = yInput.value.trim() === '' ? undefined : Number(yInput.value)
      window.dispatchEvent(new CustomEvent('omni:floormanager-set', { detail: { action: 'add', label, y } }))
      labelInput.value = ''
      yInput.value = ''
      setTimeout(() => this._renderFloorList(), 0)
    })

    el.querySelector('#fmp-indicator-toggle').addEventListener('change', (e) => {
      window.dispatchEvent(new CustomEvent('omni:floormanager-set', {
        detail: { action: 'toggle-indicator', visible: e.target.checked }
      }))
    })

    this._bindHeader(el)
    el.dataset.winId = 'floormanager'
    WindowManager.register('floormanager', el, 'FloorManager')
    WindowManager.watchPanelOpacity(el, () => this._isOpen)

    return el
  }

  _renderFloorList () {
    const list = this._el?.querySelector('#fmp-floor-list')
    if (!list) return
    const floors = this._floorManager?.getFloors?.() ?? []

    list.innerHTML = `
      <div class="fmp-floor-row is-ground">
        <span class="fmp-floor-label">Ground (real floor)</span>
        <input class="fmp-floor-y" type="number" value="0" disabled>
      </div>
      ${floors.map(f => `
        <div class="fmp-floor-row" data-floor-id="${f.id}">
          <span class="fmp-floor-label">${f.label}</span>
          <input class="fmp-floor-y" type="number" step="1" data-height-for="${f.id}" value="${f.y}">
          <button class="fmp-floor-del" data-remove-floor="${f.id}" title="Remove">✕</button>
        </div>
      `).join('')}
    `

    list.querySelectorAll('[data-height-for]').forEach(input => {
      let timer = null
      input.addEventListener('input', () => {
        clearTimeout(timer)
        const id = input.dataset.heightFor
        timer = setTimeout(() => {
          const y = Number(input.value)
          if (!Number.isFinite(y)) return
          window.dispatchEvent(new CustomEvent('omni:floormanager-set', { detail: { action: 'setHeight', id, y } }))
        }, 200)
      })
    })

    list.querySelectorAll('[data-remove-floor]').forEach(btn => {
      btn.addEventListener('click', () => {
        window.dispatchEvent(new CustomEvent('omni:floormanager-set', { detail: { action: 'remove', id: btn.dataset.removeFloor } }))
        this._renderFloorList()
      })
    })
  }

  _bindHeader (el) {
    const header = el.querySelector('.fmp-header')
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
