/**
 * ui/OmniChronos.js — ⟐mniReality OmniChronos
 *
 * "It is time." Controls modules/RootSpace.js's tunnel — not a
 * separate tunnel of its own. RootSpace is already a vertical
 * (Y-axis) cylinder tunnel you enter from above ("the tunnel we start
 * it from the top"); this panel adds two toggles on top of it:
 *
 *   Enabled     — on/off, with a light-then-teleport transition (Wind
 *                 Waker warp / inverse Mega Man teleport-in-out read),
 *                 implemented in RootSpace._playTeleportIn/_playTeleportOut.
 *   Z-axis mode — reorients the tunnel from vertical (Y, default) to
 *                 Z-axis, with its radius scaled 1.5x in that mode.
 *                 Implemented in RootSpace._applyAxis.
 *
 * Follows AdminPanel's exact save pattern, per explicit request:
 * changes update a local staged copy only; nothing is applied to
 * RootSpace or persisted until the Save button is pressed. This is
 * deliberately NOT the auto-save-on-change pattern used elsewhere
 * (OmniInspector, OmniKeysInspector) — Admin-style staged save was
 * specifically asked for here.
 *
 * Follows the standard module contract (constructor / init / update / destroy).
 */

import gsap from 'gsap'
import * as WindowManager from './WindowManager.js'
import * as PrimaryTime from '../utils/PrimaryTime.js'
import { formatSeconds } from '../utils/TimeData.js'

const STORE_KEY = 'omni:chronos:settings'
const DEFAULTS = { enabled: true, zAxis: false, transparency: true, timeFormat: 'military' }

function loadSettings () {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS }
  } catch (_) {
    return { ...DEFAULTS }
  }
}

const STYLES = /* css */`

.omni-chronos-panel {
  --oc-bg          : var(--omni-theme-bg, rgba(8, 8, 12, 0.92));
  --oc-border      : var(--omni-theme-border, rgba(255, 255, 255, 0.09));
  --oc-header-bg   : var(--omni-theme-header-bg, rgba(255, 255, 255, 0.03));
  --oc-text        : var(--omni-theme-text, rgba(255, 255, 255, 1));
  --oc-text-dim    : var(--omni-theme-text-dim, rgba(255, 255, 255, 0.85));
  --oc-text-muted  : var(--omni-theme-text-muted, rgba(255, 255, 255, 0.6));
  --oc-accent      : var(--omni-theme-accent, #ffd27f);
  --mono           : 'Courier New', Courier, monospace;

  position         : fixed;
  top              : 130px;
  left             : 130px;
  width            : 300px;
  min-width        : 260px;
  max-width        : 90vw;
  height           : 320px;
  min-height       : 240px;
  max-height       : 92vh;

  display          : flex;
  flex-direction   : column;

  background       : var(--oc-bg);
  backdrop-filter  : blur(22px) saturate(1.5);
  -webkit-backdrop-filter: blur(22px) saturate(1.5);
  border           : 1px solid var(--oc-border);
  border-radius    : 14px;
  box-shadow       : 0 0 24px rgba(0,0,0,0.4), 0 12px 40px rgba(0,0,0,0.55);

  font-family      : var(--mono);
  color            : var(--oc-text);
  z-index          : 60;
  overflow         : hidden;
  pointer-events   : auto;
  resize           : both;

  opacity          : 0;
  transform        : scale(0.94);
}

.oc-header {
  position         : relative;
  height           : 42px;
  flex-shrink      : 0;
  display          : flex;
  align-items      : center;
  justify-content  : center;
  background       : var(--oc-header-bg);
  border-bottom    : 1px solid var(--oc-border);
  cursor           : grab;
  user-select      : none;
}
.oc-header.is-dragging { cursor: grabbing; }
.oc-title { position: absolute; left: 14px; font-size: 11px; letter-spacing: 0.06em; color: var(--oc-text-dim); }
.oc-controls { position: absolute; right: 10px; display: flex; align-items: center; gap: 8px; }
.oc-ctrl {
  width: 22px; height: 22px; border-radius: 6px;
  border: 1px solid var(--oc-border);
  background: rgba(255,255,255,0.04);
  color: var(--oc-text-dim);
  font-size: 10px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
}
.oc-ctrl:hover { background: rgba(255,255,255,0.10); color: var(--oc-text); }
.oc-ctrl--save { color: rgba(255, 210, 127, 0.9); border-color: rgba(255, 210, 127, 0.25); }
.oc-ctrl--save:hover { background: rgba(255, 210, 127, 0.14); }

.oc-unsaved-banner {
  flex-shrink      : 0;
  display          : none;
  align-items      : center;
  justify-content  : center;
  gap              : 6px;
  padding          : 6px;
  font-size        : 9.5px;
  letter-spacing   : 0.03em;
  color            : rgba(255, 200, 140, 0.95);
  background       : rgba(255, 180, 100, 0.12);
  border-bottom    : 1px solid rgba(255, 180, 100, 0.2);
}
.oc-unsaved-banner.is-visible { display: flex; }

.oc-body { flex: 1 1 auto; overflow-y: auto; padding: 14px; }

.oc-tagline {
  font-size        : 10px;
  font-style       : italic;
  color            : var(--oc-text-muted);
  margin-bottom    : 14px;
  text-align       : center;
}

.oc-row {
  display          : flex;
  align-items      : center;
  justify-content  : space-between;
  gap              : 10px;
  padding          : 10px 0;
  border-bottom    : 1px solid rgba(255,255,255,0.06);
}
.oc-row:last-of-type { border-bottom: none; }
.oc-row-label { font-size: 10.5px; color: var(--oc-text-dim); }
.oc-row-sub { font-size: 8.5px; color: var(--oc-text-muted); margin-top: 2px; }

.oc-primary-time {
  display: flex; align-items: center; justify-content: space-between;
  margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--oc-border);
}
.oc-clock-display {
  font-family: var(--mono); font-size: 20px; color: var(--oc-accent); letter-spacing: 0.05em;
}
.oc-play-btn {
  background: rgba(255,210,127,0.15); border: 1px solid var(--oc-accent);
  color: var(--oc-accent); font-family: var(--mono); font-size: 11px;
  padding: 6px 12px; border-radius: 5px; cursor: pointer;
}
.oc-play-btn:hover { background: rgba(255,210,127,0.25); }

.oc-toggle {
  width            : 34px;
  height           : 18px;
  border-radius    : 10px;
  border           : 1px solid var(--oc-border);
  background       : rgba(255,255,255,0.08);
  position         : relative;
  cursor           : pointer;
  flex-shrink      : 0;
}
.oc-toggle::after {
  content          : '';
  position         : absolute;
  top              : 1px; left: 1px;
  width            : 14px; height: 14px;
  border-radius    : 50%;
  background       : var(--oc-text-dim);
  transition       : transform 0.15s ease, background 0.15s ease;
}
.oc-toggle.is-on { background: rgba(255, 210, 127, 0.3); border-color: rgba(255, 210, 127, 0.5); }
.oc-toggle.is-on::after { transform: translateX(16px); background: var(--oc-accent); }

.oc-resize-handle { position: absolute; right: 0; bottom: 0; width: 16px; height: 16px; cursor: nwse-resize; }
.oc-resize-handle::before {
  content: ''; position: absolute; right: 3px; bottom: 3px; width: 8px; height: 8px;
  border-right: 2px solid rgba(255,255,255,0.25); border-bottom: 2px solid rgba(255,255,255,0.25);
}

`

function injectStyles () {
  if (document.getElementById('omni-chronos-styles')) return
  const tag = document.createElement('style')
  tag.id = 'omni-chronos-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

export default class OmniChronos {
  constructor (context) {
    this.ctx = context
    this._el = null
    this._isOpen = false
    this._drag = { active: false, startX: 0, startY: 0, originX: 0, originY: 0 }

    this._saved = loadSettings()
    this._staged = structuredClone(this._saved)   // what the form shows, pre-save
    this._onNavSelect = null
  }

  init () {
    injectStyles()
    this._onNavSelect = (e) => {
      if (e.detail?.item !== '⟐OmniChronos') return
      this.open()
    }
    window.addEventListener('omni:nav-select', this._onNavSelect)

    // Apply whatever was already saved from a previous session, on boot
    // — RootSpace's own defaults match DEFAULTS above, so this is only
    // meaningfully different when the user has customized it before.
    window.dispatchEvent(new CustomEvent('omni:chronos-toggle', { detail: { enabled: this._saved.enabled } }))
    window.dispatchEvent(new CustomEvent('omni:chronos-axis-set', { detail: { axis: this._saved.zAxis ? 'z' : 'y' } }))
    window.dispatchEvent(new CustomEvent('omni:chronos-transparency-set', { detail: { enabled: this._saved.transparency } }))
  }

  update (delta) {
    PrimaryTime.advance(delta)
    if (this._isOpen) this._updateClockDisplay()
  }
  onResize () {}

  destroy () {
    window.removeEventListener('omni:nav-select', this._onNavSelect)
    this._el?.parentNode?.removeChild(this._el)
    WindowManager.unregister('omnichronos')
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
        id: 'omnichronos', label: '⟐OmniChronos', iconLabel: '⟐C',
        fromRect: { x: rect.left, y: rect.top, w: rect.width, h: rect.height },
        variant: 'app',
      }
    }))
  }

  /** Live, real clock text — reads PrimaryTime's actual current
   *  value every frame while open, formatted per the staged/saved
   *  preference (military or AM/PM, both real). */
  _updateClockDisplay () {
    const display = this._el?.querySelector('#oc-clock-display')
    if (!display) return
    display.textContent = formatSeconds(PrimaryTime.getCurrentSeconds(), this._saved.timeFormat)
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
    el.className = 'omni-chronos-panel'
    const s = this._staged
    el.innerHTML = /* html */`
      <div class="oc-header">
        <span class="oc-title">⟐OmniChronos</span>
        <div class="oc-controls">
          <button class="oc-ctrl oc-ctrl--save" data-action="save" title="Save">💾</button>
          <button class="oc-ctrl" data-action="minimize" title="Minimize">–</button>
          <button class="oc-ctrl" data-action="close" title="Close">×</button>
        </div>
      </div>
      <div class="oc-unsaved-banner" id="oc-unsaved-banner">⚠ Unsaved changes — click 💾 to apply</div>
      <div class="oc-body">
        <div class="oc-tagline">It is time.</div>

        <div class="oc-row">
          <div>
            <div class="oc-row-label">Tunnel Enabled</div>
            <div class="oc-row-sub">Light-teleport transition in/out</div>
          </div>
          <button class="oc-toggle ${s.enabled ? 'is-on' : ''}" data-key="enabled" role="switch" aria-checked="${s.enabled}"></button>
        </div>

        <div class="oc-row">
          <div>
            <div class="oc-row-label">Z-axis Mode</div>
            <div class="oc-row-sub">Vertical → Z-axis, radius ×1.5</div>
          </div>
          <button class="oc-toggle ${s.zAxis ? 'is-on' : ''}" data-key="zAxis" role="switch" aria-checked="${s.zAxis}"></button>
        </div>

        <div class="oc-row">
          <div>
            <div class="oc-row-label">Transparency</div>
            <div class="oc-row-sub">"Clear and almost non-existent, but there"</div>
          </div>
          <button class="oc-toggle ${s.transparency ? 'is-on' : ''}" data-key="transparency" role="switch" aria-checked="${s.transparency}"></button>
        </div>

        <div class="oc-row">
          <div>
            <div class="oc-row-label">Time Format</div>
            <div class="oc-row-sub">Both real, switchable — neither replaces the other</div>
          </div>
          <button class="oc-toggle ${s.timeFormat === 'ampm' ? 'is-on' : ''}" data-key="timeFormatToggle" role="switch" aria-checked="${s.timeFormat === 'ampm'}"></button>
        </div>

        <div class="oc-primary-time">
          <div class="oc-clock-display" id="oc-clock-display">00:00</div>
          <button class="oc-play-btn" id="oc-play-pause">${PrimaryTime.isPlaying() ? '⏸ Pause' : '▶ Play'}</button>
        </div>
      </div>
      <div class="oc-resize-handle" aria-hidden="true"></div>
    `

    el.querySelector('#oc-play-pause').addEventListener('click', () => {
      if (PrimaryTime.isPlaying()) PrimaryTime.pause(); else PrimaryTime.play()
      el.querySelector('#oc-play-pause').textContent = PrimaryTime.isPlaying() ? '⏸ Pause' : '▶ Play'
    })

    this._bindHeader(el)
    this._bindResize(el)
    this._bindControls(el)

    el.querySelector('[data-action="minimize"]').addEventListener('click', () => this.minimize())
    el.querySelector('[data-action="close"]').addEventListener('click', () => this.close())
    el.querySelector('[data-action="save"]').addEventListener('click', () => this._save())

    el.dataset.winId = 'omnichronos'
    WindowManager.register('omnichronos', el, 'OmniChronos')
    WindowManager.watchPanelOpacity(el, () => this._isOpen)

    return el
  }

  _bindControls (el) {
    el.querySelectorAll('.oc-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.dataset.key === 'timeFormatToggle') {
          const nextFormat = this._staged.timeFormat === 'ampm' ? 'military' : 'ampm'
          this._setStaged('timeFormat', nextFormat)
          btn.classList.toggle('is-on', nextFormat === 'ampm')
          btn.setAttribute('aria-checked', String(nextFormat === 'ampm'))
          return
        }
        const next = !this._staged[btn.dataset.key]
        this._setStaged(btn.dataset.key, next)
        btn.classList.toggle('is-on', next)
        btn.setAttribute('aria-checked', String(next))
      })
    })
  }

  /** Sets a key on the staged object and shows the unsaved-changes
   *  banner — nothing applied to RootSpace yet, matching AdminPanel's
   *  exact save pattern (explicit request). */
  _setStaged (key, value) {
    this._staged[key] = value
    const banner = this._el?.querySelector('#oc-unsaved-banner')
    banner?.classList.add('is-visible')
  }

  /** Save button — the ONLY place staged changes take effect:
   *  persisted to localStorage and broadcast to RootSpace. */
  _save () {
    this._saved = structuredClone(this._staged)
    const banner = this._el?.querySelector('#oc-unsaved-banner')

    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(this._saved))
      banner?.classList.remove('is-visible')
    } catch (err) {
      console.warn('⟐Chronos — localStorage save failed:', err)
      if (banner) banner.textContent = '⚠ Save failed'
    }

    window.dispatchEvent(new CustomEvent('omni:chronos-toggle', { detail: { enabled: this._saved.enabled } }))
    window.dispatchEvent(new CustomEvent('omni:chronos-axis-set', { detail: { axis: this._saved.zAxis ? 'z' : 'y' } }))
    window.dispatchEvent(new CustomEvent('omni:chronos-transparency-set', { detail: { enabled: this._saved.transparency } }))
  }

  // ── Header drag / resize — same pattern as every other panel ─────────────

  _bindHeader (el) {
    const header = el.querySelector('.oc-header')
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
    const handle = el.querySelector('.oc-resize-handle')
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
