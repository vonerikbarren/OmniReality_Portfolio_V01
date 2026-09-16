/**
 * ui/FloorSettingsPanel.js — ⟐Floor Settings
 *
 * Admin Settings slot 8. Controls for two separate things that
 * together make up "the floor": OmniPlatform's existing concentric
 * landing rings (ring count, ripple reach) and the new OmniFloor
 * ground-plane mesh (size, color/alpha, texture) — the rings sit ON
 * this floor conceptually, not instead of it.
 *
 * Follows the standard window-chrome pattern already proven across
 * every other panel this session (drag/resize/minimize, WindowManager
 * registration, cascade positioning via register()).
 */

import gsap from 'gsap'
import * as WindowManager from './WindowManager.js'
import { floorTextureStore, FLOOR_TEXTURE_SLOTS, FLOOR_SHAPES } from '../modules/OmniFloor.js'

const PLATFORM_STORE_KEY = 'omni:platform:settings'
function loadPlatformSettings () {
  const defaults = { ringCount: 5, rippleDistance: 20 }
  try {
    const raw = localStorage.getItem(PLATFORM_STORE_KEY)
    return raw ? { ...defaults, ...JSON.parse(raw) } : defaults
  } catch (_) { return defaults }
}

const FLOOR_STORE_KEY = 'omni:floor:settings'
function loadFloorSettings () {
  const defaults = { shape: 'PlaneGeometry', color: '#ffffff', alpha: 0.35, activeSlot: null }
  try {
    const raw = localStorage.getItem(FLOOR_STORE_KEY)
    return raw ? { ...defaults, ...JSON.parse(raw) } : defaults
  } catch (_) { return defaults }
}
function saveFloorSettings (s) {
  try { localStorage.setItem(FLOOR_STORE_KEY, JSON.stringify(s)) } catch (_) {}
}

const STYLES = `

.omni-floor-settings-panel {
  pointer-events   : auto;
  --fs-bg          : var(--omni-theme-bg, rgba(8, 8, 12, 0.92));
  --fs-border      : var(--omni-theme-border, rgba(255, 255, 255, 0.09));
  --fs-header-bg   : var(--omni-theme-header-bg, rgba(255, 255, 255, 0.03));
  --fs-text        : var(--omni-theme-text, rgba(255, 255, 255, 0.9));
  --fs-text-dim    : var(--omni-theme-text-dim, rgba(255, 255, 255, 0.7));
  --fs-accent      : var(--omni-theme-accent, rgba(255, 178, 127, 0.9));
  --mono           : 'Courier New', Courier, monospace;

  position         : fixed;
  width            : 300px;
  min-width        : 260px;
  max-width        : 90vw;
  height           : 480px;
  min-height       : 300px;
  max-height       : 85vh;

  display          : flex;
  flex-direction   : column;

  background       : var(--fs-bg);
  backdrop-filter  : blur(20px) saturate(1.5);
  -webkit-backdrop-filter: blur(20px) saturate(1.5);
  border           : 1px solid var(--fs-border);
  border-radius    : 12px;
  box-shadow       : 0 0 20px rgba(0,0,0,0.4), 0 10px 30px rgba(0,0,0,0.5);

  font-family      : var(--mono);
  z-index          : 60;
  overflow         : hidden;
  resize           : both;
  opacity          : 0;
  visibility       : hidden;
}

.fs-header {
  height           : 38px;
  flex-shrink      : 0;
  display          : flex;
  align-items      : center;
  justify-content  : center;
  background       : var(--fs-header-bg);
  border-bottom    : 1px solid var(--fs-border);
  cursor           : grab;
  user-select      : none;
  position         : relative;
}
.fs-header.is-dragging { cursor: grabbing; }
.fs-title { font-size: 11px; letter-spacing: 0.05em; color: var(--fs-text-dim); }
.fs-controls { position: absolute; right: 8px; display: flex; gap: 4px; }
.fs-ctrl {
  width: 20px; height: 20px; border-radius: 5px;
  border: 1px solid var(--fs-border);
  background: rgba(255,255,255,0.04);
  color: var(--fs-text-dim);
  font-size: 11px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
}
.fs-ctrl:hover { background: rgba(255,255,255,0.1); color: var(--fs-text); }

.fs-body { flex: 1 1 auto; overflow-y: auto; padding: 12px 14px; }
.fs-group-title {
  font-size: 10px; letter-spacing: 0.06em; text-transform: uppercase;
  color: var(--fs-accent); margin: 14px 0 8px; padding-top: 10px;
  border-top: 1px solid var(--fs-border);
}
.fs-group-title:first-child { margin-top: 0; padding-top: 0; border-top: none; }
.fs-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
.fs-row-label { font-size: 10.5px; color: var(--fs-text-dim); }
.fs-num-input {
  background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.18);
  border-radius: 4px; color: var(--fs-text); font-family: inherit; font-size: 10.5px;
  padding: 4px 6px; width: 70px;
}
.fs-color-input { width: 40px; height: 26px; padding: 2px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.18); background: transparent; }
.fs-note { font-size: 9px; color: var(--fs-text-dim); opacity: 0.75; line-height: 1.5; margin-top: 6px; }

.fs-slot-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
.fs-slot-btn {
  position: relative; padding: 10px 4px; border-radius: 6px; cursor: pointer;
  border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.03);
  color: var(--fs-text-dim); font-family: inherit; font-size: 10px; text-align: center;
}
.fs-slot-btn:hover { background: rgba(255,255,255,0.1); }
.fs-slot-btn.is-filled { border-color: rgba(255, 178, 127, 0.35); color: var(--fs-text-dim); }
.fs-slot-btn.is-active { background: rgba(255, 178, 127, 0.2); border-color: rgba(255, 178, 127, 0.6); color: var(--fs-accent); }
.fs-slot-remove { display: none; position: absolute; top: 2px; right: 2px; width: 14px; height: 14px; border-radius: 50%; border: none; background: rgba(255,80,80,0.7); color: #fff; font-size: 9px; line-height: 1; cursor: pointer; }
.fs-slot-btn.is-filled .fs-slot-remove { display: block; }

.fs-resize-handle { position: absolute; right: 0; bottom: 0; width: 14px; height: 14px; cursor: nwse-resize; }
.fs-resize-handle::before {
  content: ''; position: absolute; right: 3px; bottom: 3px; width: 7px; height: 7px;
  border-right: 2px solid rgba(255,255,255,0.25); border-bottom: 2px solid rgba(255,255,255,0.25);
}

`

function injectStyles () {
  if (document.getElementById('omni-floor-settings-styles')) return
  const tag = document.createElement('style')
  tag.id = 'omni-floor-settings-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

export default class FloorSettingsPanel {
  constructor (context) {
    this.ctx = context
    this._el = null
    this._isOpen = false
    this._filledSlots = new Set()
    this._pendingSlot = null
    this._drag = { active: false }
  }

  init () {
    injectStyles()
    this._onNavSelect = (e) => {
      if (e.detail?.item !== '⟐FloorSettings') return
      this.open()
    }
    window.addEventListener('omni:nav-select', this._onNavSelect)
  }

  update () {}
  onResize () {}

  destroy () {
    window.removeEventListener('omni:nav-select', this._onNavSelect)
    this._el?.parentNode?.removeChild(this._el)
    WindowManager.unregister('floorsettings')
  }

  open () {
    if (!this._el) this._el = this._buildDOM()
    const shell = document.getElementById('omni-ui') ?? document.body
    if (!this._el.parentNode) shell.appendChild(this._el)
    this._refreshFromStorage()
    this._refreshSlots()
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
        id: 'floorsettings', label: '⟐FloorSettings', iconLabel: '⟐F',
        fromRect: { x: rect.left, y: rect.top, w: rect.width, h: rect.height },
        variant: 'orb',
      }
    }))
  }

  _refreshFromStorage () {
    const platform = loadPlatformSettings()
    const floor = loadFloorSettings()
    this._el.querySelector('[data-field="ringCount"]').value = platform.ringCount
    this._el.querySelector('[data-field="rippleDistance"]').value = platform.rippleDistance
    this._el.querySelector('[data-field="floorShape"]').value = floor.shape
    this._el.querySelector('[data-field="floorColor"]').value = floor.color
    this._el.querySelector('[data-field="floorAlpha"]').value = floor.alpha
  }

  async _refreshSlots () {
    if (!this._el) return
    let list = []
    try { list = await floorTextureStore.listWallpapers() } catch (_) {}
    this._filledSlots = new Set(list.map(w => w.slot))
    const grid = this._el.querySelector('#fs-slot-grid')
    if (!grid) return
    const floor = loadFloorSettings()
    let html = `<button class="fs-slot-btn ${!floor.activeSlot ? 'is-active' : ''}" data-slot="default"><span>Default</span></button>`
    for (let i = 1; i <= FLOOR_TEXTURE_SLOTS; i++) {
      const filled = this._filledSlots.has(i)
      html += `
        <button class="fs-slot-btn ${filled ? 'is-filled' : ''} ${floor.activeSlot === i ? 'is-active' : ''}" data-slot="${i}">
          <button class="fs-slot-remove" data-remove-slot="${i}" title="Remove">×</button>
          <span>${i}</span>
        </button>
      `
    }
    grid.innerHTML = html
  }

  _applySlot (slot) {
    window.dispatchEvent(new CustomEvent('omni:floor-set', { detail: { activeSlot: slot } }))
    this._el?.querySelectorAll('[data-slot]').forEach(btn => {
      const isThis = slot === null ? btn.dataset.slot === 'default' : Number(btn.dataset.slot) === slot
      btn.classList.toggle('is-active', isThis)
    })
  }

  _buildDOM () {
    const el = document.createElement('div')
    el.className = 'omni-floor-settings-panel'
    el.innerHTML = `
      <div class="fs-header">
        <span class="fs-title">⟐Floor Settings</span>
        <div class="fs-controls">
          <button class="fs-ctrl" data-action="minimize" title="Minimize">–</button>
          <button class="fs-ctrl" data-action="close" title="Close">×</button>
        </div>
      </div>
      <div class="fs-body">
        <div class="fs-group-title">Landing Rings &amp; Ripple</div>
        <div class="fs-row"><span class="fs-row-label">Ring count</span><input class="fs-num-input" type="number" min="1" max="20" data-field="ringCount"></div>
        <div class="fs-row"><span class="fs-row-label">Ripple reach</span><input class="fs-num-input" type="number" min="1" step="1" data-field="rippleDistance"></div>
        <div class="fs-note">Ripple reach also sets the outermost ring's own radius, so the two always agree.</div>

        <div class="fs-group-title">Floor Plane</div>
        <div class="fs-note">Sized to the real scene boundary (3000 units) automatically — only the tiles near the camera are ever actually built, so this stays cheap regardless of how far you travel.</div>
        <div class="fs-row"><span class="fs-row-label">Shape</span>
          <select class="fs-num-input" data-field="floorShape" style="width:120px">
            ${FLOOR_SHAPES.map(s => `<option value="${s}">${s.replace('Geometry', '')}</option>`).join('')}
          </select>
        </div>
        <div class="fs-row"><span class="fs-row-label">Color</span><input class="fs-color-input" type="color" data-field="floorColor"></div>
        <div class="fs-row"><span class="fs-row-label">Alpha</span><input class="fs-num-input" type="number" min="0" max="1" step="0.05" data-field="floorAlpha"></div>

        <div class="fs-group-title">Floor Texture (Default + ${FLOOR_TEXTURE_SLOTS})</div>
        <div class="fs-slot-grid" id="fs-slot-grid"></div>
        <div class="fs-note">Selecting a texture switches the floor from wireframe to a solid, tiled surface. Back to Default restores the wireframe grid.</div>
      </div>
      <input type="file" accept="image/*" style="display:none" id="fs-file-input">
      <div class="fs-resize-handle" aria-hidden="true"></div>
    `

    this._bindHeader(el)
    this._bindResize(el)
    el.querySelector('[data-action="minimize"]').addEventListener('click', () => this.minimize())
    el.querySelector('[data-action="close"]').addEventListener('click', () => this.close())

    el.querySelector('[data-field="ringCount"]').addEventListener('input', (e) => {
      window.dispatchEvent(new CustomEvent('omni:platform-set', { detail: { ringCount: Number(e.target.value) } }))
    })
    el.querySelector('[data-field="rippleDistance"]').addEventListener('input', (e) => {
      window.dispatchEvent(new CustomEvent('omni:platform-set', { detail: { rippleDistance: Number(e.target.value) } }))
    })
    el.querySelector('[data-field="floorShape"]').addEventListener('change', (e) => {
      window.dispatchEvent(new CustomEvent('omni:floor-set', { detail: { shape: e.target.value } }))
    })
    el.querySelector('[data-field="floorColor"]').addEventListener('input', (e) => {
      window.dispatchEvent(new CustomEvent('omni:floor-set', { detail: { color: e.target.value } }))
    })
    el.querySelector('[data-field="floorAlpha"]').addEventListener('input', (e) => {
      window.dispatchEvent(new CustomEvent('omni:floor-set', { detail: { alpha: Number(e.target.value) } }))
    })

    const fileInput = el.querySelector('#fs-file-input')
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files?.[0]
      if (!file || this._pendingSlot == null) return
      await floorTextureStore.saveWallpaper(this._pendingSlot, file, file.name)
      await this._refreshSlots()
      this._applySlot(this._pendingSlot)
      this._pendingSlot = null
      fileInput.value = ''
    })

    el.querySelector('#fs-slot-grid').addEventListener('click', (e) => {
      const removeBtn = e.target.closest('[data-remove-slot]')
      if (removeBtn) {
        e.stopPropagation()
        const slot = Number(removeBtn.dataset.removeSlot)
        floorTextureStore.deleteWallpaper(slot).then(() => this._refreshSlots())
        return
      }
      const slotBtn = e.target.closest('[data-slot]')
      if (!slotBtn) return
      const slotAttr = slotBtn.dataset.slot
      if (slotAttr === 'default') { this._applySlot(null); return }
      const slot = Number(slotAttr)
      if (this._filledSlots.has(slot)) {
        this._applySlot(slot)
      } else {
        this._pendingSlot = slot
        fileInput.click()
      }
    })

    el.dataset.winId = 'floorsettings'
    WindowManager.register('floorsettings', el, 'Floor Settings')
    WindowManager.watchPanelOpacity(el, () => this._isOpen)

    return el
  }

  _bindHeader (el) {
    const header = el.querySelector('.fs-header')
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
    const handle = el.querySelector('.fs-resize-handle')
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
