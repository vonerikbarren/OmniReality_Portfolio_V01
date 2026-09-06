/**
 * ui/ParticleSettingsPanel.js — ⟐mniReality Particle Settings
 *
 * Dedicated panel (Admin02) for the three ambient particle modes —
 * Default, Spread, Condensed — built for quick experimentation, so
 * every control here applies live rather than needing an explicit
 * Save. See modules/ParticleField.js for the actual mode logic; this
 * panel only ever dispatches `omni:particle-settings-set` patches.
 *
 * Follows the standard module contract (constructor / init / update / destroy).
 */

import gsap from 'gsap'
import * as WindowManager from './WindowManager.js'

const STYLES = /* css */`

.omni-particle-settings {
  --ps-bg          : var(--omni-theme-bg, rgba(8, 8, 12, 0.92));
  --ps-border      : var(--omni-theme-border, rgba(255, 255, 255, 0.09));
  --ps-header-bg   : var(--omni-theme-header-bg, rgba(255, 255, 255, 0.03));
  --ps-text        : var(--omni-theme-text, rgba(255, 255, 255, 1));
  --ps-text-dim    : var(--omni-theme-text-dim, rgba(255, 255, 255, 0.85));
  --ps-text-muted  : var(--omni-theme-text-muted, rgba(255, 255, 255, 0.6));
  --ps-accent      : var(--omni-theme-accent, #8cffb4);
  --mono           : 'Courier New', Courier, monospace;

  position         : fixed;
  top              : 130px;
  left             : 180px;
  width            : 300px;
  min-width        : 260px;
  max-width        : 90vw;
  height           : 380px;
  min-height       : 260px;
  max-height       : 92vh;

  display          : flex;
  flex-direction   : column;

  background       : var(--ps-bg);
  backdrop-filter  : blur(22px) saturate(1.5);
  -webkit-backdrop-filter: blur(22px) saturate(1.5);
  border           : 1px solid var(--ps-border);
  border-radius    : 14px;
  box-shadow       : 0 0 24px rgba(0,0,0,0.4), 0 12px 40px rgba(0,0,0,0.55);

  font-family      : var(--mono);
  color            : var(--ps-text);
  z-index          : 60;
  overflow         : hidden;
  pointer-events   : auto;
  resize           : both;

  opacity          : 0;
  transform        : scale(0.94);
}

.ps-header {
  position         : relative;
  height           : 40px;
  flex-shrink      : 0;
  display          : flex;
  align-items      : center;
  justify-content  : center;
  background       : var(--ps-header-bg);
  border-bottom    : 1px solid var(--ps-border);
  cursor           : grab;
  user-select      : none;
}
.ps-header.is-dragging { cursor: grabbing; }
.ps-title { position: absolute; left: 12px; font-size: 11px; letter-spacing: 0.06em; color: var(--ps-text-dim); }
.ps-controls { position: absolute; right: 8px; display: flex; align-items: center; gap: 6px; }
.ps-ctrl {
  width: 20px; height: 20px; border-radius: 5px;
  border: 1px solid var(--ps-border);
  background: rgba(255,255,255,0.04);
  color: var(--ps-text-dim);
  font-size: 10px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
}
.ps-ctrl:hover { background: rgba(255,255,255,0.10); color: var(--ps-text); }

.ps-body { flex: 1 1 auto; overflow-y: auto; padding: 14px; }

.ps-section-title {
  font-size        : 9.5px; letter-spacing: 0.08em; text-transform: uppercase;
  color            : var(--ps-accent); margin: 14px 0 8px; padding-top: 10px;
  border-top       : 1px solid rgba(255,255,255,0.06);
}
.ps-section-title:first-child { margin-top: 0; padding-top: 0; border-top: none; }

.ps-mode-row { display: flex; gap: 6px; }
.ps-mode-btn {
  flex: 1;
  background: rgba(255,255,255,0.05);
  border: 1px solid var(--ps-border);
  color: var(--ps-text-muted);
  border-radius: 7px;
  padding: 10px 4px;
  font-family: var(--mono);
  font-size: 9.5px;
  cursor: pointer;
  text-align: center;
}
.ps-mode-btn:hover { color: var(--ps-text); }
.ps-mode-btn.is-active { background: rgba(140, 255, 180, 0.16); border-color: rgba(140, 255, 180, 0.4); color: var(--ps-accent); }

.ps-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
.ps-row-label { font-size: 10px; color: var(--ps-text-dim); }
.ps-toggle {
  width: 34px; height: 18px; border-radius: 10px;
  border: 1px solid var(--ps-border);
  background: rgba(255,255,255,0.08);
  position: relative; cursor: pointer; flex-shrink: 0;
}
.ps-toggle::after {
  content: ''; position: absolute; top: 1px; left: 1px;
  width: 14px; height: 14px; border-radius: 50%;
  background: var(--ps-text-dim);
  transition: transform 0.15s ease, background 0.15s ease;
}
.ps-toggle.is-on { background: rgba(140, 255, 180, 0.3); border-color: rgba(140, 255, 180, 0.5); }
.ps-toggle.is-on::after { transform: translateX(16px); background: var(--ps-accent); }

.ps-slider-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.ps-slider { flex: 1; accent-color: var(--ps-accent); }
.ps-slider-val { width: 36px; text-align: right; font-size: 9px; color: var(--ps-text-dim); }

.ps-note { font-size: 9px; color: var(--ps-text-muted); line-height: 1.5; margin-top: 6px; }

.ps-resize-handle { position: absolute; right: 0; bottom: 0; width: 16px; height: 16px; cursor: nwse-resize; }
.ps-resize-handle::before {
  content: ''; position: absolute; right: 3px; bottom: 3px; width: 8px; height: 8px;
  border-right: 2px solid rgba(255,255,255,0.25); border-bottom: 2px solid rgba(255,255,255,0.25);
}

`

function injectStyles () {
  if (document.getElementById('omni-particle-settings-styles')) return
  const tag = document.createElement('style')
  tag.id = 'omni-particle-settings-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

const STORE_KEY = 'omni:particle:settings'

function loadSettings () {
  const defaults = { mode: 'default', rotateX: false, rotateY: false, rotateZ: true, speed: 0.1 }
  try {
    const raw = localStorage.getItem(STORE_KEY)
    return raw ? { ...defaults, ...JSON.parse(raw) } : defaults
  } catch (_) { return defaults }
}
function saveSettings (s) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(s)) } catch (_) {}
}

export default class ParticleSettingsPanel {
  constructor (context) {
    this.ctx = context
    this._el = null
    this._isOpen = false
    this._drag = { active: false, startX: 0, startY: 0, originX: 0, originY: 0 }
    this._state = loadSettings()
    this._onNavSelect = null
  }

  init () {
    injectStyles()
    this._onNavSelect = (e) => {
      if (e.detail?.item !== '⟐OmniParticleSettings') return
      this.open()
    }
    window.addEventListener('omni:nav-select', this._onNavSelect)

    // Apply the saved/default state to the real particle field on
    // boot, same as any other settings panel would on first load.
    window.dispatchEvent(new CustomEvent('omni:particle-settings-set', { detail: { ...this._state } }))
  }

  update () {}
  onResize () {}

  destroy () {
    window.removeEventListener('omni:nav-select', this._onNavSelect)
    this._el?.parentNode?.removeChild(this._el)
    WindowManager.unregister('particlesettings')
  }

  open () {
    if (!this._el) this._el = this._buildDOM()
    const shell = document.getElementById('omni-ui') ?? document.body
    shell.appendChild(this._el)
    this._el.style.visibility = 'visible'
    gsap.to(this._el, { opacity: WindowManager.getPanelOpacity(), scale: 1, duration: 0.28, ease: 'back.out(1.4)' })
    this._isOpen = true
    this._playSound('open')
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
        id: 'particlesettings', label: '⟐OmniParticleSettings', iconLabel: '⟐P',
        fromRect: { x: rect.left, y: rect.top, w: rect.width, h: rect.height },
        variant: 'orb',
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
    el.className = 'omni-particle-settings'
    const s = this._state
    el.innerHTML = /* html */`
      <div class="ps-header">
        <span class="ps-title">⟐Particle Settings</span>
        <div class="ps-controls">
          <button class="ps-ctrl" data-action="minimize" title="Minimize">–</button>
          <button class="ps-ctrl" data-action="close" title="Close">×</button>
        </div>
      </div>
      <div class="ps-body">
        <div class="ps-section-title">Mode</div>
        <div class="ps-mode-row">
          <button class="ps-mode-btn ${s.mode === 'default' ? 'is-active' : ''}" data-mode="default">Default</button>
          <button class="ps-mode-btn ${s.mode === 'spread' ? 'is-active' : ''}" data-mode="spread">Spread</button>
          <button class="ps-mode-btn ${s.mode === 'condensed' ? 'is-active' : ''}" data-mode="condensed">Condensed</button>
        </div>
        <div class="ps-note" id="ps-mode-note"></div>

        <div class="ps-section-title">Condensed — Auto-Rotate</div>
        <div class="ps-row">
          <span class="ps-row-label">X axis</span>
          <button class="ps-toggle ${s.rotateX ? 'is-on' : ''}" data-axis="rotateX" role="switch" aria-checked="${s.rotateX}"></button>
        </div>
        <div class="ps-row">
          <span class="ps-row-label">Y axis</span>
          <button class="ps-toggle ${s.rotateY ? 'is-on' : ''}" data-axis="rotateY" role="switch" aria-checked="${s.rotateY}"></button>
        </div>
        <div class="ps-row">
          <span class="ps-row-label">Z axis</span>
          <button class="ps-toggle ${s.rotateZ ? 'is-on' : ''}" data-axis="rotateZ" role="switch" aria-checked="${s.rotateZ}"></button>
        </div>
        <div class="ps-slider-row">
          <span class="ps-row-label" style="width:40px">Speed</span>
          <input type="range" class="ps-slider" id="ps-speed" min="0" max="1" step="0.01" value="${s.speed}">
          <span class="ps-slider-val" id="ps-speed-val">${Number(s.speed).toFixed(2)}</span>
        </div>
        <div class="ps-note">Only affects Condensed mode — Default and Spread don't rotate as a group.</div>
      </div>
      <div class="ps-resize-handle" aria-hidden="true"></div>
    `

    this._bindHeader(el)
    this._bindResize(el)
    this._bindControls(el)
    this._updateModeNote(el)

    el.querySelector('[data-action="minimize"]').addEventListener('click', () => this.minimize())
    el.querySelector('[data-action="close"]').addEventListener('click', () => this.close())

    el.dataset.winId = 'particlesettings'
    WindowManager.register('particlesettings', el, 'Particle Settings')
    WindowManager.watchPanelOpacity(el, () => this._isOpen)

    return el
  }

  _bindControls (el) {
    el.querySelectorAll('[data-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        this._state.mode = btn.dataset.mode
        el.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('is-active', b === btn))
        this._updateModeNote(el)
        this._commit({ mode: this._state.mode })
      })
    })

    el.querySelectorAll('[data-axis]').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.axis
        this._state[key] = !this._state[key]
        btn.classList.toggle('is-on', this._state[key])
        btn.setAttribute('aria-checked', String(this._state[key]))
        this._commit({ [key]: this._state[key] })
      })
    })

    const speedSlider = el.querySelector('#ps-speed')
    const speedVal = el.querySelector('#ps-speed-val')
    speedSlider.addEventListener('input', (e) => {
      this._state.speed = Number(e.target.value)
      speedVal.textContent = this._state.speed.toFixed(2)
      this._commit({ speed: this._state.speed })
    })
  }

  _updateModeNote (el) {
    const notes = {
      default: 'The original ambient cloud — confined near the center.',
      spread: 'Particles fill much more of the space, with more of them so density holds up.',
      condensed: 'Particles form a small, distinct sphere near the origin — pairs with auto-rotate below.',
    }
    el.querySelector('#ps-mode-note').textContent = notes[this._state.mode] ?? ''
  }

  _commit (patch) {
    Object.assign(this._state, patch)
    saveSettings(this._state)
    window.dispatchEvent(new CustomEvent('omni:particle-settings-set', { detail: patch }))
  }

  // ── Header drag / resize — same pattern as every other panel ─────────────

  _bindHeader (el) {
    const header = el.querySelector('.ps-header')
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
    const handle = el.querySelector('.ps-resize-handle')
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
