/**
 * ui/OmniBrowserSpacePanel.js — ⟐mniReality OmniBrowserSpace Settings
 *
 * Dedicated settings panel for modules/OmniBrowserSpace.js — shape
 * selector (reusing WallpaperSphere's own curated 11-shape list, so
 * both "wallpaper" surfaces in this app draw from one shared source
 * of truth rather than two independently-maintained lists), a 5-slot
 * texture browser plus a Default option, rotation sliders for each
 * axis, and RGBA. Everything here is "instant save," per the brief —
 * applies and persists immediately via `omni:browserspace-set`
 * patches, no staged Save button — same live pattern already proven
 * out in ParticleSettingsPanel/WallpaperSettingsPanel.
 *
 * The panel positions themselves (which face gets which content)
 * don't move when the shape changes — see OmniBrowserSpace.js's own
 * comment on REFERENCE_RADIUS for the honest limits of "the dimensions
 * have to match the circumference" across genuinely different shapes.
 *
 * Follows the standard module contract (constructor / init / update / destroy).
 */

import gsap from 'gsap'
import * as WindowManager from './WindowManager.js'
import { BROWSERSPACE_SHAPES, OTHER_LAYER_NAMES, DEFAULT_LAYER_ALPHAS } from '../modules/OmniBrowserSpace.js'
import { createWallpaperStore } from '../utils/WallpaperStorage.js'

const CUBE_TEXTURE_SLOTS = 5
const cubeTextureStore = createWallpaperStore('browserspace-cube', CUBE_TEXTURE_SLOTS)

const STYLES = /* css */`

.omni-browserspace-panel {
  --bs-bg          : var(--omni-theme-bg, rgba(8, 8, 12, 0.92));
  --bs-border      : var(--omni-theme-border, rgba(255, 255, 255, 0.09));
  --bs-header-bg   : var(--omni-theme-header-bg, rgba(255, 255, 255, 0.03));
  --bs-text        : var(--omni-theme-text, rgba(255, 255, 255, 1));
  --bs-text-dim    : var(--omni-theme-text-dim, rgba(255, 255, 255, 0.85));
  --bs-text-muted  : var(--omni-theme-text-muted, rgba(255, 255, 255, 0.6));
  --bs-accent      : var(--omni-theme-accent, #8cc4ff);
  --mono           : 'Courier New', Courier, monospace;

  position         : fixed;
  top              : 110px;
  left             : 260px;
  width            : 320px;
  min-width        : 280px;
  max-width        : 90vw;
  height           : 560px;
  min-height       : 340px;
  max-height       : 92vh;

  display          : flex;
  flex-direction   : column;

  background       : var(--bs-bg);
  backdrop-filter  : blur(22px) saturate(1.5);
  -webkit-backdrop-filter: blur(22px) saturate(1.5);
  border           : 1px solid var(--bs-border);
  border-radius    : 14px;
  box-shadow       : 0 0 24px rgba(0,0,0,0.4), 0 12px 40px rgba(0,0,0,0.55);

  font-family      : var(--mono);
  color            : var(--bs-text);
  z-index          : 60;
  overflow         : hidden;
  pointer-events   : auto;
  resize           : both;

  opacity          : 0;
  transform        : scale(0.94);
}

.bs-header {
  position         : relative;
  height           : 40px;
  flex-shrink      : 0;
  display          : flex;
  align-items      : center;
  justify-content  : center;
  background       : var(--bs-header-bg);
  border-bottom    : 1px solid var(--bs-border);
  cursor           : grab;
  user-select      : none;
}
.bs-header.is-dragging { cursor: grabbing; }
.bs-title { position: absolute; left: 12px; font-size: 11px; letter-spacing: 0.06em; color: var(--bs-text-dim); }
.bs-controls { position: absolute; right: 8px; display: flex; align-items: center; gap: 6px; }
.bs-ctrl {
  width: 20px; height: 20px; border-radius: 5px;
  border: 1px solid var(--bs-border);
  background: rgba(255,255,255,0.04);
  color: var(--bs-text-dim);
  font-size: 10px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
}
.bs-ctrl:hover { background: rgba(255,255,255,0.10); color: var(--bs-text); }

.bs-body { flex: 1 1 auto; overflow-y: auto; padding: 14px; }

.bs-section-title {
  font-size        : 9.5px; letter-spacing: 0.08em; text-transform: uppercase;
  color            : var(--bs-accent); margin: 14px 0 8px; padding-top: 10px;
  border-top       : 1px solid rgba(255,255,255,0.06);
}
.bs-section-title:first-child { margin-top: 0; padding-top: 0; border-top: none; }

.bs-select {
  width: 100%; height: 28px; padding: 0 8px;
  background: var(--omni-theme-input-bg, rgba(255,255,255,0.09));
  border: 1px solid var(--omni-theme-input-border, rgba(255,255,255,0.18));
  border-radius: 5px;
  font-family: var(--mono); font-size: 10px; color: var(--bs-text);
}

.bs-slot-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
.bs-slot-btn {
  aspect-ratio: 1;
  background: rgba(255,255,255,0.05);
  border: 1px solid var(--bs-border);
  border-radius: 6px;
  color: var(--bs-text-muted);
  font-family: var(--mono);
  font-size: 8.5px;
  cursor: pointer;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 2px;
  padding: 2px;
  position: relative;
}
.bs-slot-btn:hover { background: rgba(255,255,255,0.1); }
.bs-slot-btn.is-filled { border-color: rgba(140, 196, 255, 0.35); color: var(--bs-text-dim); }
.bs-slot-btn.is-active { background: rgba(140, 196, 255, 0.2); border-color: rgba(140, 196, 255, 0.6); color: var(--bs-accent); }
.bs-slot-remove {
  position: absolute; top: 2px; right: 2px;
  width: 14px; height: 14px; border-radius: 3px;
  background: rgba(255,100,100,0.25); border: none; color: rgba(255,190,190,0.9);
  font-size: 8px; line-height: 1; cursor: pointer; display: none;
}
.bs-slot-btn.is-filled .bs-slot-remove { display: block; }
.bs-file-input { display: none; }

.bs-xyz-row { display: flex; gap: 6px; margin-bottom: 6px; align-items: center; }
.bs-xyz-axis { font-size: 9px; color: var(--bs-text-muted); width: 10px; }
.bs-rot-slider { flex: 1; accent-color: var(--bs-accent); }
.bs-rot-val { width: 32px; text-align: right; font-size: 8.5px; color: var(--bs-text-muted); }

.bs-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
.bs-layer-row { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
.bs-layer-name { flex: 1; font-size: 10px; color: var(--bs-text-dim, rgba(255,255,255,0.7)); }
.bs-layer-row .bs-color-input { width: 28px; height: 22px; padding: 1px; }
.bs-layer-row .bs-num-input { width: 44px; }
.bs-row-label { font-size: 10px; color: var(--bs-text-dim); }
.bs-color-input { width: 44px; height: 24px; border: 1px solid var(--bs-border); border-radius: 4px; background: none; cursor: pointer; }
.bs-num-input {
  width: 70px; background: var(--omni-theme-input-bg, rgba(255,255,255,0.09));
  border: 1px solid var(--omni-theme-input-border, rgba(255,255,255,0.18));
  border-radius: 4px; color: var(--bs-text); font-family: var(--mono);
  font-size: 9.5px; padding: 4px 6px;
}

.bs-note { font-size: 9px; color: var(--bs-text-muted); line-height: 1.5; margin-top: 6px; }
.bs-toggle-btn {
  width: 100%; padding: 8px; border-radius: 6px; cursor: pointer;
  border: 1px solid var(--bs-accent); background: rgba(140, 196, 255, 0.08);
  color: var(--bs-accent); font-family: inherit; font-size: 10.5px; letter-spacing: 0.02em;
}
.bs-toggle-btn:hover { background: rgba(140, 196, 255, 0.16); }
.bs-toggle-btn[data-active="true"] { background: var(--bs-accent); color: #05070a; }

.bs-resize-handle { position: absolute; right: 0; bottom: 0; width: 16px; height: 16px; cursor: nwse-resize; }
.bs-resize-handle::before {
  content: ''; position: absolute; right: 3px; bottom: 3px; width: 8px; height: 8px;
  border-right: 2px solid rgba(255,255,255,0.25); border-bottom: 2px solid rgba(255,255,255,0.25);
}

`

function injectStyles () {
  if (document.getElementById('omni-browserspace-panel-styles')) return
  const tag = document.createElement('style')
  tag.id = 'omni-browserspace-panel-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

const STORE_KEY = 'omni:browserspace:settings'
function loadSettings () {
  const defaults = {
    shape: 'BoxGeometry', rotation: { x: 0, y: 0, z: 0 },
    position: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 },
    color: '#8cc4ff', alpha: 0.6, activeSlot: null, roomScale: false,
    objectVisible: true,
    layers: OTHER_LAYER_NAMES.map(name => ({ color: '#8cc4ff', alpha: DEFAULT_LAYER_ALPHAS[name], visible: false })),
  }
  try {
    const raw = localStorage.getItem(STORE_KEY)
    return raw ? { ...defaults, ...JSON.parse(raw) } : defaults
  } catch (_) { return defaults }
}
function saveSettings (s) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(s)) } catch (_) {}
}

export default class OmniBrowserSpacePanel {
  constructor (context) {
    this.ctx = context
    this._el = null
    this._isOpen = false
    this._drag = { active: false, startX: 0, startY: 0, originX: 0, originY: 0 }
    this._state = loadSettings()
    this._filledSlots = new Set()
    this._pendingSlot = null
    this._onNavSelect = null
  }

  init () {
    injectStyles()
    this._onNavSelect = (e) => {
      if (e.detail?.item !== '⟐OmniBrowserSpaceSettings') return
      this.open()
    }
    window.addEventListener('omni:nav-select', this._onNavSelect)
  }

  update () {}
  onResize () {}

  destroy () {
    window.removeEventListener('omni:nav-select', this._onNavSelect)
    this._el?.parentNode?.removeChild(this._el)
    WindowManager.unregister('browserspacepanel')
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
        id: 'browserspacepanel', label: '⟐OmniBrowserSpaceSettings', iconLabel: '⟐S',
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
    el.className = 'omni-browserspace-panel'
    const s = this._state

    const rotRow = (axis) => /* html */`
      <div class="bs-xyz-row">
        <span class="bs-xyz-axis">${axis.toUpperCase()}</span>
        <input type="range" class="bs-rot-slider" data-rot-axis="${axis}" min="-3.14159" max="3.14159" step="0.01" value="${s.rotation[axis]}">
        <span class="bs-rot-val" data-rot-val="${axis}">${s.rotation[axis].toFixed(2)}</span>
      </div>
    `

    let slotButtons = `<button class="bs-slot-btn ${!s.activeSlot ? 'is-active' : ''}" data-slot="default"><span>Default</span></button>`
    for (let i = 1; i <= CUBE_TEXTURE_SLOTS; i++) {
      slotButtons += `
        <button class="bs-slot-btn ${s.activeSlot === i ? 'is-active' : ''}" data-slot="${i}">
          <button class="bs-slot-remove" data-remove-slot="${i}" title="Remove">×</button>
          <span>${i}</span>
        </button>
      `
    }

    el.innerHTML = /* html */`
      <div class="bs-header">
        <span class="bs-title">⟐OmniBrowserSpace Settings</span>
        <div class="bs-controls">
          <button class="bs-ctrl" data-action="minimize" title="Minimize">–</button>
          <button class="bs-ctrl" data-action="close" title="Close">×</button>
        </div>
      </div>
      <div class="bs-body">
        <div class="bs-section-title">Shape</div>
        <select class="bs-select" id="bs-shape">
          ${BROWSERSPACE_SHAPES.map(sh => `<option value="${sh}" ${s.shape === sh ? 'selected' : ''}>${sh.replace('Geometry', '')}</option>`).join('')}
        </select>
        <div class="bs-note">
          Panel positions stay fixed on the 6 cardinal points regardless
          of shape — a few shapes (Cone, Torus, Tetrahedron) can't sit
          perfectly flush at all 6 due to their own geometry, not a bug.
        </div>

        <div class="bs-section-title">Rotation</div>
        ${rotRow('x')}
        ${rotRow('y')}
        ${rotRow('z')}

        <div class="bs-section-title">Position</div>
        <div class="bs-xyz-row"><span class="bs-xyz-axis">X</span><input type="number" class="bs-num-input" step="0.5" data-pos-axis="x" value="${s.position.x}"></div>
        <div class="bs-xyz-row"><span class="bs-xyz-axis">Y</span><input type="number" class="bs-num-input" step="0.5" data-pos-axis="y" value="${s.position.y}"></div>
        <div class="bs-xyz-row"><span class="bs-xyz-axis">Z</span><input type="number" class="bs-num-input" step="0.5" data-pos-axis="z" value="${s.position.z}"></div>
        <div class="bs-note">Offset from the space's default resting height — (0,0,0) is the original position.</div>

        <div class="bs-section-title">Scale</div>
        <div class="bs-xyz-row"><span class="bs-xyz-axis">X</span><input type="number" class="bs-num-input" step="0.1" min="0.01" data-scale-axis="x" value="${s.scale.x}"></div>
        <div class="bs-xyz-row"><span class="bs-xyz-axis">Y</span><input type="number" class="bs-num-input" step="0.1" min="0.01" data-scale-axis="y" value="${s.scale.y}"></div>
        <div class="bs-xyz-row"><span class="bs-xyz-axis">Z</span><input type="number" class="bs-num-input" step="0.1" min="0.01" data-scale-axis="z" value="${s.scale.z}"></div>

        <div class="bs-section-title">Face Cubes</div>
        <button class="bs-toggle-btn" id="bs-room-scale-toggle" data-active="${s.roomScale ? 'true' : 'false'}">
          ${s.roomScale ? '◆ Room Scale — spread across a large room' : '◇ Expand to Room Scale'}
        </button>
        <div class="bs-note">Toggles how far apart the 4 face cubes sit — tight around the shape by default, or spread to span a genuinely large room.</div>

        <div class="bs-section-title">Layer — Object</div>
        <div class="bs-row">
          <span class="bs-row-label">Visible</span>
          <input type="checkbox" id="bs-object-visible" ${s.objectVisible !== false ? 'checked' : ''}>
        </div>
        <div class="bs-row">
          <span class="bs-row-label">Color</span>
          <input type="color" class="bs-color-input" id="bs-color" value="${s.color}">
        </div>
        <div class="bs-row">
          <span class="bs-row-label">Alpha</span>
          <input type="number" class="bs-num-input" id="bs-alpha" min="0" max="1" step="0.05" value="${s.alpha}">
        </div>

        <div class="bs-section-title">Layers — Point / Core / Class / Domain / Realm / Reality / InfiniteReality / OmniReality</div>
        <div class="bs-note">Same geometry as Object (Point is a small marker instead), progressively larger, moving outward. Each toggles independently — real design-software-style layers, not one master switch.</div>
        ${OTHER_LAYER_NAMES.map((name, i) => {
          const layer = s.layers?.[i] ?? { color: '#8cc4ff', alpha: DEFAULT_LAYER_ALPHAS[name], visible: false }
          return `
          <div class="bs-layer-row">
            <input type="checkbox" class="bs-layer-visible" data-layer-index="${i}" ${layer.visible ? 'checked' : ''}>
            <span class="bs-layer-name">${name}</span>
            <input type="color" class="bs-color-input bs-layer-color" data-layer-index="${i}" value="${layer.color}">
            <input type="number" class="bs-num-input bs-layer-alpha" data-layer-index="${i}" min="0" max="1" step="0.05" value="${layer.alpha}">
          </div>
        `}).join('')}

        <div class="bs-section-title">Wallpaper (Default + ${CUBE_TEXTURE_SLOTS})</div>
        <div class="bs-slot-grid" id="bs-slot-grid">${slotButtons}</div>
        <div class="bs-note">
          Default is the wireframe look. Click an empty numbered slot
          to browse for an image; click Default or a filled slot to
          apply it. Instant — applies immediately and saves as you go.
        </div>
        <input type="file" accept="image/*" class="bs-file-input" id="bs-file-input">
      </div>
      <div class="bs-resize-handle" aria-hidden="true"></div>
    `

    this._bindHeader(el)
    this._bindResize(el)
    this._bindControls(el)

    el.querySelector('[data-action="minimize"]').addEventListener('click', () => this.minimize())
    el.querySelector('[data-action="close"]').addEventListener('click', () => this.close())

    el.dataset.winId = 'browserspacepanel'
    WindowManager.register('browserspacepanel', el, 'OmniBrowserSpace Settings')
    WindowManager.watchPanelOpacity(el, () => this._isOpen)

    return el
  }

  _bindControls (el) {
    el.querySelector('#bs-shape').addEventListener('change', (e) => this._commit({ shape: e.target.value }))

    el.querySelectorAll('[data-rot-axis]').forEach(slider => {
      slider.addEventListener('input', (e) => {
        const axis = slider.dataset.rotAxis
        const value = Number(e.target.value)
        this._state.rotation[axis] = value
        el.querySelector(`[data-rot-val="${axis}"]`).textContent = value.toFixed(2)
        this._commit({ rotation: { ...this._state.rotation } })
      })
    })

    el.querySelectorAll('[data-pos-axis]').forEach(input => {
      input.addEventListener('input', (e) => {
        const axis = input.dataset.posAxis
        const value = Number(e.target.value) || 0
        this._state.position[axis] = value
        this._commit({ position: { ...this._state.position } })
      })
    })

    el.querySelectorAll('[data-scale-axis]').forEach(input => {
      input.addEventListener('input', (e) => {
        const axis = input.dataset.scaleAxis
        const value = Math.max(0.01, Number(e.target.value) || 1)
        this._state.scale[axis] = value
        this._commit({ scale: { ...this._state.scale } })
      })
    })

    el.querySelector('#bs-color').addEventListener('input', (e) => this._commit({ color: e.target.value }))
    el.querySelector('#bs-alpha').addEventListener('input', (e) => this._commit({ alpha: Number(e.target.value) }))
    el.querySelector('#bs-object-visible').addEventListener('change', (e) => this._commit({ objectVisible: e.target.checked }))

    const defaultLayersFallback = () => OTHER_LAYER_NAMES.map(name => ({ color: '#8cc4ff', alpha: DEFAULT_LAYER_ALPHAS[name], visible: false }))
    el.querySelectorAll('.bs-layer-color').forEach(input => {
      input.addEventListener('input', (e) => {
        const i = Number(input.dataset.layerIndex)
        const layers = [...(this._state.layers ?? defaultLayersFallback())]
        layers[i] = { ...layers[i], color: e.target.value }
        this._commit({ layers })
      })
    })
    el.querySelectorAll('.bs-layer-alpha').forEach(input => {
      input.addEventListener('input', (e) => {
        const i = Number(input.dataset.layerIndex)
        const layers = [...(this._state.layers ?? defaultLayersFallback())]
        layers[i] = { ...layers[i], alpha: Number(e.target.value) }
        this._commit({ layers })
      })
    })
    el.querySelectorAll('.bs-layer-visible').forEach(input => {
      input.addEventListener('change', (e) => {
        const i = Number(input.dataset.layerIndex)
        const layers = [...(this._state.layers ?? defaultLayersFallback())]
        layers[i] = { ...layers[i], visible: e.target.checked }
        this._commit({ layers })
      })
    })
    el.querySelector('#bs-room-scale-toggle').addEventListener('click', () => {
      const next = !this._state.roomScale
      this._commit({ roomScale: next })
      const btn = el.querySelector('#bs-room-scale-toggle')
      btn.dataset.active = String(next)
      btn.textContent = next ? '◆ Room Scale — spread across a large room' : '◇ Expand to Room Scale'
    })

    const fileInput = el.querySelector('#bs-file-input')
    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files?.[0]
      const slot = this._pendingSlot
      e.target.value = ''
      if (!file || !slot) return
      try {
        await cubeTextureStore.saveWallpaper(slot, file, file.name)
        await this._refreshSlots()
        this._applySlot(slot)
      } catch (err) {
        window.alert(`Could not save texture: ${err?.message ?? err}`)
      }
    })

    el.querySelector('#bs-slot-grid').addEventListener('click', (e) => {
      const removeBtn = e.target.closest('[data-remove-slot]')
      if (removeBtn) {
        e.stopPropagation()
        const slot = Number(removeBtn.dataset.removeSlot)
        cubeTextureStore.deleteWallpaper(slot).then(() => this._refreshSlots())
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
  }

  _applySlot (slot) {
    this._commit({ activeSlot: slot })
    this._el?.querySelectorAll('[data-slot]').forEach(btn => {
      const isThis = slot === null ? btn.dataset.slot === 'default' : Number(btn.dataset.slot) === slot
      btn.classList.toggle('is-active', isThis)
    })
  }

  async _refreshSlots () {
    if (!this._el) return
    let list = []
    try { list = await cubeTextureStore.listWallpapers() } catch (_) {}
    this._filledSlots = new Set(list.map(w => w.slot))
    this._el.querySelectorAll('[data-slot]').forEach(btn => {
      if (btn.dataset.slot === 'default') return
      const slot = Number(btn.dataset.slot)
      btn.classList.toggle('is-filled', this._filledSlots.has(slot))
    })
  }

  _commit (patch) {
    Object.assign(this._state, patch)
    saveSettings(this._state)
    window.dispatchEvent(new CustomEvent('omni:browserspace-set', { detail: patch }))
  }

  // ── Header drag / resize — same pattern as every other panel ─────────────

  _bindHeader (el) {
    const header = el.querySelector('.bs-header')
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
    const handle = el.querySelector('.bs-resize-handle')
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
