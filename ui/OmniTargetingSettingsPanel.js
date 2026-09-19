/**
 * ui/OmniTargetingSettingsPanel.js — ⟐Targeting Direct Settings
 *
 * OmniTargeting's first subpanel — its own direct settings. Marker
 * geometry, color/alpha, and texture, matching OmniDraw's own
 * inspector pattern closely on purpose.
 */

import gsap from 'gsap'
import * as WindowManager from './WindowManager.js'
import { targetTextureStore, TARGET_TEXTURE_SLOTS, TARGETING_GEOMETRIES } from '../modules/OmniTargeting.js'

const STORE_KEY = 'omni:targeting:settings'
function loadSettings () {
  const defaults = { geometry: 'TetrahedronGeometry', color: '#ffffff', alpha: 0.85, activeSlot: null }
  try {
    const raw = localStorage.getItem(STORE_KEY)
    return raw ? { ...defaults, ...JSON.parse(raw) } : defaults
  } catch (_) { return defaults }
}

const STYLES = `

.omni-targeting-settings-panel {
  pointer-events   : auto;
  --ts-bg          : var(--omni-theme-bg, rgba(8, 8, 12, 0.92));
  --ts-border      : var(--omni-theme-border, rgba(255, 255, 255, 0.09));
  --ts-header-bg   : var(--omni-theme-header-bg, rgba(255, 255, 255, 0.03));
  --ts-text        : var(--omni-theme-text, rgba(255, 255, 255, 0.9));
  --ts-text-dim    : var(--omni-theme-text-dim, rgba(255, 255, 255, 0.7));
  --ts-accent      : var(--omni-theme-accent, rgba(255, 178, 127, 0.9));
  --mono           : 'Courier New', Courier, monospace;

  position         : fixed;
  width            : 290px;
  min-width        : 250px;
  max-width        : 90vw;
  height           : 440px;
  min-height       : 280px;
  max-height       : 85vh;

  display          : flex;
  flex-direction   : column;

  background       : var(--ts-bg);
  backdrop-filter  : blur(20px) saturate(1.5);
  -webkit-backdrop-filter: blur(20px) saturate(1.5);
  border           : 1px solid var(--ts-border);
  border-radius    : 12px;
  box-shadow       : 0 0 20px rgba(0,0,0,0.4), 0 10px 30px rgba(0,0,0,0.5);

  font-family      : var(--mono);
  z-index          : 60;
  overflow         : hidden;
  resize           : both;
  opacity          : 0;
  visibility       : hidden;
}

.ts-header {
  height           : 38px;
  flex-shrink      : 0;
  display          : flex;
  align-items      : center;
  justify-content  : center;
  background       : var(--ts-header-bg);
  border-bottom    : 1px solid var(--ts-border);
  cursor           : grab;
  user-select      : none;
  position         : relative;
}
.ts-header.is-dragging { cursor: grabbing; }
.ts-title { font-size: 11px; letter-spacing: 0.05em; color: var(--ts-text-dim); }
.ts-controls { position: absolute; right: 8px; display: flex; gap: 4px; }
.ts-ctrl {
  width: 20px; height: 20px; border-radius: 5px;
  border: 1px solid var(--ts-border);
  background: rgba(255,255,255,0.04);
  color: var(--ts-text-dim);
  font-size: 11px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
}
.ts-ctrl:hover { background: rgba(255,255,255,0.1); color: var(--ts-text); }

.ts-body { flex: 1 1 auto; overflow-y: auto; padding: 12px 14px; }
.ts-group-title {
  font-size: 10px; letter-spacing: 0.06em; text-transform: uppercase;
  color: var(--ts-accent); margin: 14px 0 8px; padding-top: 10px;
  border-top: 1px solid var(--ts-border);
}
.ts-group-title:first-child { margin-top: 0; padding-top: 0; border-top: none; }
.ts-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
.ts-row-label { font-size: 10.5px; color: var(--ts-text-dim); }
.ts-num-input, .ts-select {
  background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.18);
  border-radius: 4px; color: var(--ts-text); font-family: inherit; font-size: 10.5px;
  padding: 4px 6px;
}
.ts-num-input { width: 70px; }
.ts-select { width: 140px; }
.ts-color-input { width: 40px; height: 26px; padding: 2px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.18); background: transparent; }
.ts-note { font-size: 9px; color: var(--ts-text-dim); opacity: 0.75; line-height: 1.5; margin-top: 6px; }

.ts-slot-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
.ts-slot-btn {
  position: relative; padding: 10px 4px; border-radius: 6px; cursor: pointer;
  border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.03);
  color: var(--ts-text-dim); font-family: inherit; font-size: 10px; text-align: center;
}
.ts-slot-btn:hover { background: rgba(255,255,255,0.1); }
.ts-slot-btn.is-filled { border-color: rgba(255, 178, 127, 0.35); }
.ts-slot-btn.is-active { background: rgba(255, 178, 127, 0.2); border-color: rgba(255, 178, 127, 0.6); color: var(--ts-accent); }
.ts-slot-remove { display: none; position: absolute; top: 2px; right: 2px; width: 14px; height: 14px; border-radius: 50%; border: none; background: rgba(255,80,80,0.7); color: #fff; font-size: 9px; line-height: 1; cursor: pointer; }
.ts-slot-btn.is-filled .ts-slot-remove { display: block; }

.ts-resize-handle { position: absolute; right: 0; bottom: 0; width: 14px; height: 14px; cursor: nwse-resize; }
.ts-resize-handle::before {
  content: ''; position: absolute; right: 3px; bottom: 3px; width: 7px; height: 7px;
  border-right: 2px solid rgba(255,255,255,0.25); border-bottom: 2px solid rgba(255,255,255,0.25);
}

`

function injectStyles () {
  if (document.getElementById('omni-targeting-settings-styles')) return
  const tag = document.createElement('style')
  tag.id = 'omni-targeting-settings-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

export default class OmniTargetingSettingsPanel {
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
      if (e.detail?.item !== '⟐OmniTargetingSettings') return
      this.open()
    }
    window.addEventListener('omni:nav-select', this._onNavSelect)
  }

  update () {}
  onResize () {}

  destroy () {
    window.removeEventListener('omni:nav-select', this._onNavSelect)
    this._el?.parentNode?.removeChild(this._el)
    WindowManager.unregister('targetingsettings')
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
        id: 'targetingsettings', label: '⟐OmniTargetingSettings', iconLabel: '⟐T',
        fromRect: { x: rect.left, y: rect.top, w: rect.width, h: rect.height },
        variant: 'app',
      }
    }))
  }

  _refreshFromStorage () {
    const s = loadSettings()
    this._el.querySelector('[data-field="geometry"]').value = s.geometry
    this._el.querySelector('[data-field="color"]').value = s.color
    this._el.querySelector('[data-field="alpha"]').value = s.alpha
  }

  async _refreshSlots () {
    if (!this._el) return
    let list = []
    try { list = await targetTextureStore.listWallpapers() } catch (_) {}
    this._filledSlots = new Set(list.map(w => w.slot))
    const grid = this._el.querySelector('#ts-slot-grid')
    if (!grid) return
    const s = loadSettings()
    let html = `<button class="ts-slot-btn ${!s.activeSlot ? 'is-active' : ''}" data-slot="default"><span>Default</span></button>`
    for (let i = 1; i <= TARGET_TEXTURE_SLOTS; i++) {
      const filled = this._filledSlots.has(i)
      html += `
        <button class="ts-slot-btn ${filled ? 'is-filled' : ''} ${s.activeSlot === i ? 'is-active' : ''}" data-slot="${i}">
          <button class="ts-slot-remove" data-remove-slot="${i}" title="Remove">×</button>
          <span>${i}</span>
        </button>
      `
    }
    grid.innerHTML = html
  }

  _applySlot (slot) {
    window.dispatchEvent(new CustomEvent('omni:targeting-set', { detail: { activeSlot: slot } }))
    this._el?.querySelectorAll('[data-slot]').forEach(btn => {
      const isThis = slot === null ? btn.dataset.slot === 'default' : Number(btn.dataset.slot) === slot
      btn.classList.toggle('is-active', isThis)
    })
  }

  _buildDOM () {
    const el = document.createElement('div')
    el.className = 'omni-targeting-settings-panel'
    el.innerHTML = `
      <div class="ts-header">
        <span class="ts-title">⟐Targeting — Direct Settings</span>
        <div class="ts-controls">
          <button class="ts-ctrl" data-action="minimize" title="Minimize">–</button>
          <button class="ts-ctrl" data-action="close" title="Close">×</button>
        </div>
      </div>
      <div class="ts-body">
        <div class="ts-group-title">Marker Geometry</div>
        <div class="ts-row"><span class="ts-row-label">targetRadiusGeometry</span>
          <select class="ts-select" data-field="geometry">
            ${TARGETING_GEOMETRIES.map(g => `<option value="${g}">${g.replace('Geometry', '')}</option>`).join('')}
          </select>
        </div>
        <div class="ts-note">Four markers orbit the current target, each pointed inward — the real Z-target reticle shape, whatever shape you choose here.</div>

        <div class="ts-group-title">Color &amp; Alpha</div>
        <div class="ts-row"><span class="ts-row-label">Color</span><input class="ts-color-input" type="color" data-field="color"></div>
        <div class="ts-row"><span class="ts-row-label">Alpha</span><input class="ts-num-input" type="number" min="0" max="1" step="0.05" data-field="alpha"></div>

        <div class="ts-group-title">Marker Texture (Default + ${TARGET_TEXTURE_SLOTS})</div>
        <div class="ts-slot-grid" id="ts-slot-grid"></div>
      </div>
      <input type="file" accept="image/*" style="display:none" id="ts-file-input">
      <div class="ts-resize-handle" aria-hidden="true"></div>
    `

    this._bindHeader(el)
    this._bindResize(el)
    el.querySelector('[data-action="minimize"]').addEventListener('click', () => this.minimize())
    el.querySelector('[data-action="close"]').addEventListener('click', () => this.close())

    el.querySelector('[data-field="geometry"]').addEventListener('change', (e) => {
      window.dispatchEvent(new CustomEvent('omni:targeting-set', { detail: { geometry: e.target.value } }))
    })
    el.querySelector('[data-field="color"]').addEventListener('input', (e) => {
      window.dispatchEvent(new CustomEvent('omni:targeting-set', { detail: { color: e.target.value } }))
    })
    el.querySelector('[data-field="alpha"]').addEventListener('input', (e) => {
      window.dispatchEvent(new CustomEvent('omni:targeting-set', { detail: { alpha: Number(e.target.value) } }))
    })

    const fileInput = el.querySelector('#ts-file-input')
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files?.[0]
      if (!file || this._pendingSlot == null) return
      await targetTextureStore.saveWallpaper(this._pendingSlot, file, file.name)
      await this._refreshSlots()
      this._applySlot(this._pendingSlot)
      this._pendingSlot = null
      fileInput.value = ''
    })

    el.querySelector('#ts-slot-grid').addEventListener('click', (e) => {
      const removeBtn = e.target.closest('[data-remove-slot]')
      if (removeBtn) {
        e.stopPropagation()
        const slot = Number(removeBtn.dataset.removeSlot)
        targetTextureStore.deleteWallpaper(slot).then(() => this._refreshSlots())
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

    el.dataset.winId = 'targetingsettings'
    WindowManager.register('targetingsettings', el, 'OmniTargeting Settings')
    WindowManager.watchPanelOpacity(el, () => this._isOpen)

    return el
  }

  _bindHeader (el) {
    const header = el.querySelector('.ts-header')
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
    const handle = el.querySelector('.ts-resize-handle')
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
