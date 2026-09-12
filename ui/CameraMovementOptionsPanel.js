/**
 * ui/CameraMovementOptionsPanel.js — ⟐mniReality Camera Movement Options
 *
 * Home for camera-movement-related Admin settings. Currently houses
 * the WASD/left-hand speed step settings (px/py/pz), extracted out of
 * the main Admin panel into their own dedicated space so more
 * camera-movement settings can be added here going forward (see
 * docs/omniproducts/CAMERA_MOVEMENT_OPTIONS_DESIGN.md for the full,
 * not-yet-built feature set this panel is meant to grow into).
 *
 * Reads/writes the same `omni:admin:settings` localStorage contract
 * AdminPanel itself uses, and dispatches the same
 * `omni:admin-settings-saved` event on save, so every existing
 * consumer (MovementPad, OmniInspector, OmniDraw) keeps working
 * completely unchanged.
 */

import gsap from 'gsap'
import * as WindowManager from './WindowManager.js'

const STORE_KEY = 'omni:admin:settings'

const STYLES = `

.omni-cam-movement-panel {
  --cm-bg          : var(--omni-theme-bg, rgba(8, 8, 12, 0.92));
  --cm-border      : var(--omni-theme-border, rgba(255, 255, 255, 0.09));
  --cm-header-bg   : var(--omni-theme-header-bg, rgba(255, 255, 255, 0.03));
  --cm-text        : var(--omni-theme-text, rgba(255, 255, 255, 0.9));
  --cm-text-dim    : var(--omni-theme-text-dim, rgba(255, 255, 255, 0.6));
  --cm-input-bg    : var(--omni-theme-input-bg, rgba(255, 255, 255, 0.04));
  --cm-input-border: var(--omni-theme-input-border, rgba(255, 255, 255, 0.18));
  --cm-accent      : var(--omni-theme-accent, rgba(255, 178, 127, 0.9));
  --mono           : 'Courier New', Courier, monospace;

  position         : fixed;
  top              : 110px;
  left             : 140px;
  width            : 320px;
  min-width        : 260px;
  max-width        : 90vw;
  height           : 360px;
  min-height       : 220px;
  max-height       : 80vh;

  display          : flex;
  flex-direction   : column;

  background       : var(--cm-bg);
  backdrop-filter  : blur(22px) saturate(1.5);
  -webkit-backdrop-filter: blur(22px) saturate(1.5);
  border           : 1px solid var(--cm-border);
  border-radius    : 14px;
  box-shadow       : 0 0 24px rgba(0,0,0,0.4), 0 12px 40px rgba(0,0,0,0.55);

  font-family      : var(--mono);
  z-index          : 60;
  overflow         : hidden;
  opacity          : 0;
  visibility       : hidden;
}

.cm-header {
  height           : 40px;
  flex-shrink      : 0;
  display          : flex;
  align-items      : center;
  justify-content  : center;
  background       : var(--cm-header-bg);
  border-bottom    : 1px solid var(--cm-border);
  cursor           : grab;
  user-select      : none;
  position         : relative;
}
.cm-header.is-dragging { cursor: grabbing; }
.cm-title { font-size: 11px; letter-spacing: 0.05em; color: var(--cm-text-dim); }
.cm-controls { position: absolute; right: 8px; display: flex; gap: 4px; }
.cm-ctrl {
  width: 20px; height: 20px; border-radius: 5px;
  border: 1px solid var(--cm-border);
  background: rgba(255,255,255,0.04);
  color: var(--cm-text-dim);
  font-size: 11px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
}
.cm-ctrl:hover { background: rgba(255,255,255,0.1); color: var(--cm-text); }

.cm-body { flex: 1 1 auto; overflow-y: auto; padding: 12px 14px; }
.cm-body::-webkit-scrollbar { width: 6px; }
.cm-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 3px; }

.cm-group-title {
  font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase;
  color: var(--cm-accent); margin: 4px 0 8px;
}
.cm-row {
  display: flex; align-items: center; justify-content: space-between;
  gap: 10px; padding: 6px 0;
  border-bottom: 1px solid rgba(255,255,255,0.04);
}
.cm-row-label { font-size: 10.5px; color: var(--cm-text-dim); }
.cm-num {
  width: 70px; text-align: right;
  background: var(--cm-input-bg);
  border: 1px solid var(--cm-input-border);
  border-radius: 4px; color: var(--cm-text);
  font-family: var(--mono); font-size: 10.5px; padding: 4px 6px;
}

.cm-note {
  font-size: 9.5px; color: var(--cm-text-dim); line-height: 1.5;
  margin-top: 14px; padding-top: 10px; border-top: 1px dashed rgba(255,255,255,0.08);
}

.cm-save-row { padding: 10px 14px; border-top: 1px solid var(--cm-border); flex-shrink: 0; }
.cm-save-btn {
  width: 100%; padding: 7px; border-radius: 6px;
  border: 1px solid rgba(255, 178, 127, 0.3);
  background: rgba(255, 178, 127, 0.08);
  color: var(--cm-accent);
  font-family: var(--mono); font-size: 10.5px; cursor: pointer;
}
.cm-save-btn:hover { background: rgba(255, 178, 127, 0.16); }
.cm-save-status { font-size: 9px; color: var(--cm-text-dim); text-align: center; margin-top: 5px; height: 12px; }

.cm-resize-handle { position: absolute; right: 0; bottom: 0; width: 16px; height: 16px; cursor: nwse-resize; }
.cm-resize-handle::before {
  content: ''; position: absolute; right: 3px; bottom: 3px; width: 8px; height: 8px;
  border-right: 2px solid rgba(255,255,255,0.25); border-bottom: 2px solid rgba(255,255,255,0.25);
}

`

function injectStyles () {
  if (document.getElementById('omni-cam-movement-styles')) return
  const tag = document.createElement('style')
  tag.id = 'omni-cam-movement-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

function readSettings () {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch (_) { return {} }
}

export default class CameraMovementOptionsPanel {
  constructor (context) {
    this.ctx = context
    this._el = null
    this._isOpen = false
    this._drag = { active: false }
  }

  init () {
    injectStyles()
    this._onNavSelect = (e) => {
      if (e.detail?.item !== '⟐CameraMovementOptions') return
      this.open()
    }
    window.addEventListener('omni:nav-select', this._onNavSelect)
  }

  update () {}
  onResize () {}

  destroy () {
    window.removeEventListener('omni:nav-select', this._onNavSelect)
    this._el?.parentNode?.removeChild(this._el)
    WindowManager.unregister('cammovement')
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
        id: 'cammovement', label: '⟐CameraMovementOptions', iconLabel: '⟐CM',
        fromRect: { x: rect.left, y: rect.top, w: rect.width, h: rect.height },
        variant: 'orb',
      }
    }))
  }

  _refreshFromStorage () {
    const s = readSettings()
    const steps = { px: 1, py: 1, pz: 1, ...(s.steps ?? {}) }
    this._el.querySelector('[data-field="px"]').value = steps.px
    this._el.querySelector('[data-field="py"]').value = steps.py
    this._el.querySelector('[data-field="pz"]').value = steps.pz
  }

  _save () {
    const px = parseFloat(this._el.querySelector('[data-field="px"]').value)
    const py = parseFloat(this._el.querySelector('[data-field="py"]').value)
    const pz = parseFloat(this._el.querySelector('[data-field="pz"]').value)

    const current = readSettings()
    const merged = { ...current, steps: { ...(current.steps ?? {}), px, py, pz } }

    try { localStorage.setItem(STORE_KEY, JSON.stringify(merged)) } catch (_) {}
    window.dispatchEvent(new CustomEvent('omni:admin-settings-saved', { detail: merged }))

    const status = this._el.querySelector('.cm-save-status')
    status.textContent = 'Saved'
    gsap.fromTo(status, { opacity: 1 }, { opacity: 0, delay: 0.8, duration: 0.6 })
  }

  _buildDOM () {
    const el = document.createElement('div')
    el.className = 'omni-cam-movement-panel'
    el.innerHTML = `
      <div class="cm-header">
        <span class="cm-title">⟐Camera Movement Options</span>
        <div class="cm-controls">
          <button class="cm-ctrl" data-action="minimize" title="Minimize">–</button>
          <button class="cm-ctrl" data-action="close" title="Close">×</button>
        </div>
      </div>
      <div class="cm-body">
        <div class="cm-group-title">WASD / Left-Hand Speed Steps</div>
        <div class="cm-row"><span class="cm-row-label">px step</span><input class="cm-num" type="number" step="0.01" data-field="px"></div>
        <div class="cm-row"><span class="cm-row-label">py step</span><input class="cm-num" type="number" step="0.01" data-field="py"></div>
        <div class="cm-row"><span class="cm-row-label">pz step</span><input class="cm-num" type="number" step="0.01" data-field="pz"></div>
        <div class="cm-note">More camera movement settings — orbit speed,
        altitude speed, automatic rotation — are designed and documented
        for this panel, not yet built. See
        CAMERA_MOVEMENT_OPTIONS_DESIGN.md.</div>
      </div>
      <div class="cm-save-row">
        <button class="cm-save-btn" data-action="save">Save</button>
        <div class="cm-save-status"></div>
      </div>
      <div class="cm-resize-handle" aria-hidden="true"></div>
    `

    this._bindHeader(el)
    this._bindResize(el)
    el.querySelector('[data-action="minimize"]').addEventListener('click', () => this.minimize())
    el.querySelector('[data-action="close"]').addEventListener('click', () => this.close())
    el.querySelector('[data-action="save"]').addEventListener('click', () => this._save())

    el.dataset.winId = 'cammovement'
    WindowManager.register('cammovement', el, 'Camera Movement Options')
    WindowManager.watchPanelOpacity(el, () => this._isOpen)

    return el
  }

  _bindHeader (el) {
    const header = el.querySelector('.cm-header')
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
    const handle = el.querySelector('.cm-resize-handle')
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
