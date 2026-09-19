/**
 * ui/WallpaperSettingsPanel.js — ⟐mniReality Wallpaper Settings
 *
 * Dedicated panel (Admin03) consolidating every wallpaper-related
 * option in one place: shape, position/rotation/scale, color/alpha,
 * rotation speed + auto-spin (migrated from the old Admin panel), and
 * the 20-slot wallpaper browser backed by IndexedDB (see
 * utils/WallpaperStorage.js — chosen over localStorage specifically
 * because 20 real photos would strain localStorage's ~5-10MB ceiling).
 *
 * Everything here applies live — dispatches
 * `omni:wallpaper-settings-set` patches that modules/WallpaperSphere.js
 * consumes, same pattern as ui/ParticleSettingsPanel.js.
 *
 * Shape options are curated, not "every THREE.js geometry" — see
 * modules/WallpaperSphere.js's own comment for why Plane/Circle/Ring
 * and the hand-authored Lathe/Tube/Extrude/Shape geometries are
 * excluded (no closed "inside" to stand in, or don't scale sensibly).
 *
 * Follows the standard module contract (constructor / init / update / destroy).
 */

import gsap from 'gsap'
import * as WindowManager from './WindowManager.js'
import { WALLPAPER_SHAPES } from '../modules/WallpaperSphere.js'
import { MAX_SLOTS, saveWallpaper, listWallpapers, deleteWallpaper } from '../utils/WallpaperStorage.js'

const STYLES = /* css */`

.omni-wallpaper-settings {
  --ws-bg          : var(--omni-theme-bg, rgba(8, 8, 12, 0.92));
  --ws-border      : var(--omni-theme-border, rgba(255, 255, 255, 0.09));
  --ws-header-bg   : var(--omni-theme-header-bg, rgba(255, 255, 255, 0.03));
  --ws-text        : var(--omni-theme-text, rgba(255, 255, 255, 1));
  --ws-text-dim    : var(--omni-theme-text-dim, rgba(255, 255, 255, 0.85));
  --ws-text-muted  : var(--omni-theme-text-muted, rgba(255, 255, 255, 0.6));
  --ws-accent      : var(--omni-theme-accent, #c9a3ff);
  --mono           : 'Courier New', Courier, monospace;

  position         : fixed;
  top              : 110px;
  left             : 220px;
  width            : 360px;
  min-width        : 300px;
  max-width        : 90vw;
  height           : 560px;
  min-height       : 340px;
  max-height       : 92vh;

  display          : flex;
  flex-direction   : column;

  background       : var(--ws-bg);
  backdrop-filter  : blur(22px) saturate(1.5);
  -webkit-backdrop-filter: blur(22px) saturate(1.5);
  border           : 1px solid var(--ws-border);
  border-radius    : 14px;
  box-shadow       : 0 0 24px rgba(0,0,0,0.4), 0 12px 40px rgba(0,0,0,0.55);

  font-family      : var(--mono);
  color            : var(--ws-text);
  z-index          : 60;
  overflow         : hidden;
  pointer-events   : auto;
  resize           : both;

  opacity          : 0;
  transform        : scale(0.94);
}

.ws-header {
  position         : relative;
  height           : 40px;
  flex-shrink      : 0;
  display          : flex;
  align-items      : center;
  justify-content  : center;
  background       : var(--ws-header-bg);
  border-bottom    : 1px solid var(--ws-border);
  cursor           : grab;
  user-select      : none;
}
.ws-header.is-dragging { cursor: grabbing; }
.ws-title { position: absolute; left: 12px; font-size: 11px; letter-spacing: 0.06em; color: var(--ws-text-dim); }
.ws-controls { position: absolute; right: 8px; display: flex; align-items: center; gap: 6px; }
.ws-ctrl {
  width: 20px; height: 20px; border-radius: 5px;
  border: 1px solid var(--ws-border);
  background: rgba(255,255,255,0.04);
  color: var(--ws-text-dim);
  font-size: 10px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
}
.ws-ctrl:hover { background: rgba(255,255,255,0.10); color: var(--ws-text); }

.ws-body { flex: 1 1 auto; overflow-y: auto; padding: 14px; }

.ws-section-title {
  font-size        : 9.5px; letter-spacing: 0.08em; text-transform: uppercase;
  color            : var(--ws-accent); margin: 14px 0 8px; padding-top: 10px;
  border-top       : 1px solid rgba(255,255,255,0.06);
}
.ws-section-title:first-child { margin-top: 0; padding-top: 0; border-top: none; }

.ws-select {
  width: 100%; height: 28px; padding: 0 8px;
  background: var(--omni-theme-input-bg, rgba(255,255,255,0.09));
  border: 1px solid var(--omni-theme-input-border, rgba(255,255,255,0.18));
  border-radius: 5px;
  font-family: var(--mono); font-size: 10px; color: var(--ws-text);
}

.ws-xyz-row { display: flex; gap: 6px; margin-bottom: 6px; }
.ws-xyz-field { flex: 1; display: flex; align-items: center; gap: 4px; }
.ws-xyz-label { font-size: 9px; color: var(--ws-text-muted); width: 10px; }
.ws-xyz-input {
  width: 100%; background: var(--omni-theme-input-bg, rgba(255,255,255,0.09));
  border: 1px solid var(--omni-theme-input-border, rgba(255,255,255,0.18));
  border-radius: 4px; color: var(--ws-text); font-family: var(--mono);
  font-size: 9px; padding: 3px 4px;
}

.ws-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
.ws-row-label { font-size: 10px; color: var(--ws-text-dim); }
.ws-color-input { width: 44px; height: 24px; border: 1px solid var(--ws-border); border-radius: 4px; background: none; cursor: pointer; }
.ws-num-input {
  width: 70px; background: var(--omni-theme-input-bg, rgba(255,255,255,0.09));
  border: 1px solid var(--omni-theme-input-border, rgba(255,255,255,0.18));
  border-radius: 4px; color: var(--ws-text); font-family: var(--mono);
  font-size: 9.5px; padding: 4px 6px;
}
.ws-toggle {
  width: 34px; height: 18px; border-radius: 10px;
  border: 1px solid var(--ws-border);
  background: rgba(255,255,255,0.08);
  position: relative; cursor: pointer; flex-shrink: 0;
}
.ws-toggle::after {
  content: ''; position: absolute; top: 1px; left: 1px;
  width: 14px; height: 14px; border-radius: 50%;
  background: var(--ws-text-dim);
  transition: transform 0.15s ease, background 0.15s ease;
}
.ws-toggle.is-on { background: rgba(201, 163, 255, 0.3); border-color: rgba(201, 163, 255, 0.5); }
.ws-toggle.is-on::after { transform: translateX(16px); background: var(--ws-accent); }

.ws-slot-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
}
.ws-slot-btn {
  aspect-ratio: 1;
  background: rgba(255,255,255,0.05);
  border: 1px solid var(--ws-border);
  border-radius: 6px;
  color: var(--ws-text-muted);
  font-family: var(--mono);
  font-size: 8.5px;
  cursor: pointer;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 2px;
  padding: 2px;
  overflow: hidden;
  position: relative;
}
.ws-slot-btn:hover { background: rgba(255,255,255,0.1); }
.ws-slot-btn.is-filled { border-color: rgba(201, 163, 255, 0.35); color: var(--ws-text-dim); }
.ws-slot-btn.is-active { background: rgba(201, 163, 255, 0.2); border-color: rgba(201, 163, 255, 0.6); color: var(--ws-accent); }
.ws-slot-num { font-size: 7.5px; opacity: 0.6; }
.ws-slot-remove {
  position: absolute; top: 2px; right: 2px;
  width: 14px; height: 14px; border-radius: 3px;
  background: rgba(255,100,100,0.25); border: none; color: rgba(255,190,190,0.9);
  font-size: 8px; line-height: 1; cursor: pointer; display: none;
}
.ws-slot-btn.is-filled .ws-slot-remove { display: block; }

.ws-note { font-size: 9px; color: var(--ws-text-muted); line-height: 1.5; margin-top: 6px; }
.ws-file-input { display: none; }

.ws-resize-handle { position: absolute; right: 0; bottom: 0; width: 16px; height: 16px; cursor: nwse-resize; }
.ws-resize-handle::before {
  content: ''; position: absolute; right: 3px; bottom: 3px; width: 8px; height: 8px;
  border-right: 2px solid rgba(255,255,255,0.25); border-bottom: 2px solid rgba(255,255,255,0.25);
}

`

function injectStyles () {
  if (document.getElementById('omni-wallpaper-settings-styles')) return
  const tag = document.createElement('style')
  tag.id = 'omni-wallpaper-settings-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

const STORE_KEY = 'omni:wallpaper:settings'

function loadSettings () {
  const defaults = {
    shape: 'SphereGeometry', color: '#445566', alpha: 0.9, imgUrl: './assets/images/wallpaper-default.jpg',
    activeSlot: null, rotationSpeed: 0.05, autoSpinX: false, autoSpinY: true, autoSpinZ: true,
    position: { x: 0, y: 0, z: 0 }, rotationOffset: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 },
  }
  try {
    const raw = localStorage.getItem(STORE_KEY)
    return raw ? { ...defaults, ...JSON.parse(raw) } : defaults
  } catch (_) { return defaults }
}
function saveSettings (s) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(s)) } catch (_) {}
}

export default class WallpaperSettingsPanel {
  constructor (context) {
    this.ctx = context
    this._el = null
    this._isOpen = false
    this._drag = { active: false, startX: 0, startY: 0, originX: 0, originY: 0 }
    this._state = loadSettings()
    this._filledSlots = new Set()
    this._pendingSlot = null   // which slot a file-picker click is for
    this._onNavSelect = null
  }

  init () {
    injectStyles()
    this._onNavSelect = (e) => {
      if (e.detail?.item !== '⟐OmniWallpaperSettings') return
      this.open()
    }
    window.addEventListener('omni:nav-select', this._onNavSelect)

    window.dispatchEvent(new CustomEvent('omni:wallpaper-settings-set', { detail: { ...this._state } }))
  }

  update () {}
  onResize () {}

  destroy () {
    window.removeEventListener('omni:nav-select', this._onNavSelect)
    this._el?.parentNode?.removeChild(this._el)
    WindowManager.unregister('wallpapersettings')
  }

  open () {
    if (!this._el) this._el = this._buildDOM()
    const shell = document.getElementById('omni-ui') ?? document.body
    shell.appendChild(this._el)
    this._el.style.visibility = 'visible'
    gsap.to(this._el, { opacity: WindowManager.getPanelOpacity(), scale: 1, duration: 0.28, ease: 'back.out(1.4)' })
    this._isOpen = true
    this._playSound('open')
    this._refreshSlots()
  }

  close () {
    if (!this._el) return
    gsap.to(this._el, {
      opacity: 0, scale: 0.94, duration: 0.18, ease: 'power1.in',
      onComplete: () => { this._el.style.visibility = 'hidden' },
    })
    this._isOpen = false
    this._playSound('close')
  }

  minimize () {
    if (!this._el) return
    const rect = this._el.getBoundingClientRect()
    gsap.to(this._el, {
      opacity: 0, scale: 0.3, duration: 0.22, ease: 'power2.in',
      onComplete: () => { this._el.style.visibility = 'hidden' },
    })
    this._isOpen = false
    this._playSound('close')
    window.dispatchEvent(new CustomEvent('omni:panel-minimized', {
      detail: {
        id: 'wallpapersettings', label: '⟐OmniWallpaperSettings', iconLabel: '⟐W',
        fromRect: { x: rect.left, y: rect.top, w: rect.width, h: rect.height },
        variant: 'app',
      }
    }))
  }

  _playSound (id) {
    try {
      const Sound = this.ctx?.Sound
      if (Sound && typeof Sound.play === 'function') Sound.play(id)
    } catch (_) {}
  }

  // ── DOM ──────────────────────────────────────────────────────────────────

  _buildDOM () {
    const el = document.createElement('div')
    el.className = 'omni-wallpaper-settings'
    const s = this._state

    const xyzRow = (label, prefix, val) => /* html */`
      <div class="ws-xyz-row">
        <span class="ws-section-sublabel" style="width:56px;font-size:9px;color:var(--ws-text-muted);align-self:center">${label}</span>
        <div class="ws-xyz-field"><span class="ws-xyz-label">X</span><input class="ws-xyz-input" type="number" step="0.1" data-transform="${prefix}.x" value="${val.x}"></div>
        <div class="ws-xyz-field"><span class="ws-xyz-label">Y</span><input class="ws-xyz-input" type="number" step="0.1" data-transform="${prefix}.y" value="${val.y}"></div>
        <div class="ws-xyz-field"><span class="ws-xyz-label">Z</span><input class="ws-xyz-input" type="number" step="0.1" data-transform="${prefix}.z" value="${val.z}"></div>
      </div>
    `

    let slotButtons = ''
    for (let i = 1; i <= MAX_SLOTS; i++) {
      slotButtons += `
        <button class="ws-slot-btn" data-slot="${i}">
          <button class="ws-slot-remove" data-remove-slot="${i}" title="Remove">×</button>
          <span class="ws-slot-num">${i}</span>
          <span class="ws-slot-status">Empty</span>
        </button>
      `
    }

    el.innerHTML = /* html */`
      <div class="ws-header">
        <span class="ws-title">⟐Wallpaper Settings</span>
        <div class="ws-controls">
          <button class="ws-ctrl" data-action="minimize" title="Minimize">–</button>
          <button class="ws-ctrl" data-action="close" title="Close">×</button>
        </div>
      </div>
      <div class="ws-body">
        <div class="ws-section-title">Shape</div>
        <select class="ws-select" id="ws-shape">
          ${WALLPAPER_SHAPES.map(sh => `<option value="${sh}" ${s.shape === sh ? 'selected' : ''}>${sh.replace('Geometry', '')}</option>`).join('')}
        </select>
        <div class="ws-note">
          Only closed shapes you can stand inside are listed — flat
          shapes (Plane/Circle/Ring) and a few hand-authored ones
          (Lathe/Tube/Extrude) aren't, so they're left out.
        </div>

        <div class="ws-section-title">Position / Rotation / Scale</div>
        ${xyzRow('Position', 'position', s.position)}
        ${xyzRow('Rotation', 'rotationOffset', s.rotationOffset)}
        ${xyzRow('Scale', 'scale', s.scale)}

        <div class="ws-section-title">Color &amp; Rotation</div>
        <div class="ws-row">
          <span class="ws-row-label">Color</span>
          <input type="color" class="ws-color-input" id="ws-color" value="${s.color}">
        </div>
        <div class="ws-row">
          <span class="ws-row-label">Alpha</span>
          <input type="number" class="ws-num-input" id="ws-alpha" min="0" max="1" step="0.05" value="${s.alpha}">
        </div>
        <div class="ws-row">
          <span class="ws-row-label">Rotation speed</span>
          <input type="number" class="ws-num-input" id="ws-rotspeed" step="0.01" value="${s.rotationSpeed}">
        </div>
        <div class="ws-row"><span class="ws-row-label">Auto-spin X</span><button class="ws-toggle ${s.autoSpinX ? 'is-on' : ''}" data-spin="autoSpinX"></button></div>
        <div class="ws-row"><span class="ws-row-label">Auto-spin Y</span><button class="ws-toggle ${s.autoSpinY ? 'is-on' : ''}" data-spin="autoSpinY"></button></div>
        <div class="ws-row"><span class="ws-row-label">Auto-spin Z</span><button class="ws-toggle ${s.autoSpinZ ? 'is-on' : ''}" data-spin="autoSpinZ"></button></div>

        <div class="ws-section-title">Wallpapers (${MAX_SLOTS} slots)</div>
        <div class="ws-slot-grid" id="ws-slot-grid">${slotButtons}</div>
        <div class="ws-note">
          Click an empty slot to browse for an image. Click a filled
          slot to apply it. Stored in this browser (IndexedDB), so it
          survives reload.
        </div>
        <input type="file" accept="image/*" class="ws-file-input" id="ws-file-input">
      </div>
      <div class="ws-resize-handle" aria-hidden="true"></div>
    `

    this._bindHeader(el)
    this._bindResize(el)
    this._bindControls(el)

    el.querySelector('[data-action="minimize"]').addEventListener('click', () => this.minimize())
    el.querySelector('[data-action="close"]').addEventListener('click', () => this.close())

    el.dataset.winId = 'wallpapersettings'
    WindowManager.register('wallpapersettings', el, 'Wallpaper Settings')
    WindowManager.watchPanelOpacity(el, () => this._isOpen)

    return el
  }

  _bindControls (el) {
    el.querySelector('#ws-shape').addEventListener('change', (e) => {
      this._commit({ shape: e.target.value })
    })

    el.querySelectorAll('[data-transform]').forEach(input => {
      input.addEventListener('input', () => {
        const [group, axis] = input.dataset.transform.split('.')
        this._state[group][axis] = Number(input.value) || 0
        this._commit({ [group]: { ...this._state[group] } })
      })
    })

    el.querySelector('#ws-color').addEventListener('input', (e) => this._commit({ color: e.target.value }))
    el.querySelector('#ws-alpha').addEventListener('input', (e) => this._commit({ alpha: Number(e.target.value) }))
    el.querySelector('#ws-rotspeed').addEventListener('input', (e) => this._commit({ rotationSpeed: Number(e.target.value) }))

    el.querySelectorAll('[data-spin]').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.spin
        this._state[key] = !this._state[key]
        btn.classList.toggle('is-on', this._state[key])
        this._commit({ [key]: this._state[key] })
      })
    })

    const fileInput = el.querySelector('#ws-file-input')
    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files?.[0]
      const slot = this._pendingSlot
      e.target.value = ''
      if (!file || !slot) return
      try {
        await saveWallpaper(slot, file, file.name)
        await this._refreshSlots()
        this._applySlot(slot)
      } catch (err) {
        window.alert(`Could not save wallpaper: ${err?.message ?? err}`)
      }
    })

    el.querySelector('#ws-slot-grid').addEventListener('click', (e) => {
      const removeBtn = e.target.closest('[data-remove-slot]')
      if (removeBtn) {
        e.stopPropagation()
        const slot = Number(removeBtn.dataset.removeSlot)
        deleteWallpaper(slot).then(() => this._refreshSlots())
        return
      }
      const slotBtn = e.target.closest('[data-slot]')
      if (!slotBtn) return
      const slot = Number(slotBtn.dataset.slot)
      if (this._filledSlots.has(slot)) {
        this._applySlot(slot)
      } else {
        this._pendingSlot = slot
        fileInput.click()
      }
    })
  }

  _applySlot (slot) {
    this._commit({ activeSlot: slot })
    this._el?.querySelectorAll('[data-slot]').forEach(btn => {
      btn.classList.toggle('is-active', Number(btn.dataset.slot) === slot)
    })
  }

  async _refreshSlots () {
    if (!this._el) return
    let list = []
    try { list = await listWallpapers() } catch (_) { /* IndexedDB unavailable — leave all slots empty */ }
    this._filledSlots = new Set(list.map(w => w.slot))

    this._el.querySelectorAll('[data-slot]').forEach(btn => {
      const slot = Number(btn.dataset.slot)
      const filled = this._filledSlots.has(slot)
      btn.classList.toggle('is-filled', filled)
      btn.classList.toggle('is-active', this._state.activeSlot === slot)
      const status = btn.querySelector('.ws-slot-status')
      if (status) status.textContent = filled ? 'Set' : 'Empty'
    })
  }

  _commit (patch) {
    Object.assign(this._state, patch)
    saveSettings(this._state)
    window.dispatchEvent(new CustomEvent('omni:wallpaper-settings-set', { detail: patch }))
  }

  // ── Header drag / resize — same pattern as every other panel ─────────────

  _bindHeader (el) {
    const header = el.querySelector('.ws-header')
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
    const handle = el.querySelector('.ws-resize-handle')
    if (!handle) return
    const resize = { active: false, startX: 0, startY: 0, startW: 0, startH: 0 }
    const onDown = (e) => {
      e.stopPropagation()
      const cx = e.touches?.[0]?.clientX ?? e.clientX
      const cy = e.touches?.[0]?.clientY ?? e.clientY
      const rect = el.getBoundingClientRect()
      resize.active = true; resize.startX = cx; resize.startY = cy
      resize.startW = rect.width; resize.startH = rect.height
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
