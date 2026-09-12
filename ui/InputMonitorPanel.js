/**
 * ui/InputMonitorPanel.js — ⟐mniReality Input Monitor
 *
 * Real, full panel version of the earlier throwaway mobile debug
 * overlay — same live diagnostic values (camera position, whether
 * OrbitControls is enabled, which directions are pressed, the WASD
 * speed multiplier), now with the same window chrome every other
 * panel has: draggable, resizable, minimizable, an actual Admin
 * Settings entry instead of always-on.
 *
 * Follows the standard module contract (constructor / init / update / destroy).
 */

import gsap from 'gsap'
import * as WindowManager from './WindowManager.js'

const STYLES = `

.omni-input-monitor {
  --im-bg          : var(--omni-theme-bg, rgba(8, 8, 12, 0.92));
  --im-border      : var(--omni-theme-border, rgba(255, 255, 255, 0.09));
  --im-header-bg   : var(--omni-theme-header-bg, rgba(255, 255, 255, 0.03));
  --im-text        : #0f0;
  --im-text-dim    : rgba(255, 255, 255, 0.6);
  --mono           : 'Courier New', Courier, monospace;

  position         : fixed;
  top              : 50%;
  left             : 12px;
  transform        : translateY(-50%);
  width            : 260px;
  min-width        : 200px;
  max-width        : 90vw;
  height           : 200px;
  min-height       : 120px;
  max-height       : 80vh;

  display          : flex;
  flex-direction   : column;

  background       : var(--im-bg);
  backdrop-filter  : blur(18px) saturate(1.5);
  -webkit-backdrop-filter: blur(18px) saturate(1.5);
  border           : 1px solid var(--im-border);
  border-radius    : 12px;
  box-shadow       : 0 0 20px rgba(0,0,0,0.4), 0 10px 30px rgba(0,0,0,0.5);

  font-family      : var(--mono);
  z-index          : 60;
  overflow         : hidden;
  pointer-events   : auto;

  opacity          : 0;
}

.im-header {
  height           : 34px;
  flex-shrink      : 0;
  display          : flex;
  align-items      : center;
  justify-content  : center;
  background       : var(--im-header-bg);
  border-bottom    : 1px solid var(--im-border);
  cursor           : grab;
  user-select      : none;
  position         : relative;
}
.im-header.is-dragging { cursor: grabbing; }
.im-title { position: absolute; left: 10px; font-size: 10px; letter-spacing: 0.05em; color: var(--im-text-dim); }
.im-controls { position: absolute; right: 6px; display: flex; gap: 4px; }
.im-ctrl {
  width: 18px; height: 18px; border-radius: 4px;
  border: 1px solid var(--im-border);
  background: rgba(255,255,255,0.04);
  color: var(--im-text-dim);
  font-size: 10px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
}
.im-ctrl:hover { background: rgba(255,255,255,0.1); color: #fff; }

.im-body {
  flex: 1 1 auto;
  padding: 10px 12px;
  font-size: 11px;
  line-height: 1.7;
  color: var(--im-text);
  white-space: pre-wrap;
  overflow-y: auto;
}

.im-resize-handle { position: absolute; right: 0; bottom: 0; width: 14px; height: 14px; cursor: nwse-resize; }
.im-resize-handle::before {
  content: ''; position: absolute; right: 3px; bottom: 3px; width: 7px; height: 7px;
  border-right: 2px solid rgba(255,255,255,0.25); border-bottom: 2px solid rgba(255,255,255,0.25);
}

`

function injectStyles () {
  if (document.getElementById('omni-input-monitor-styles')) return
  const tag = document.createElement('style')
  tag.id = 'omni-input-monitor-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

export default class InputMonitorPanel {
  constructor (context, orbitMod, movementPad) {
    this.ctx = context
    this.orbitMod = orbitMod
    this.movementPad = movementPad
    this._el = null
    this._body = null
    this._isOpen = false
    this._drag = { active: false, startX: 0, startY: 0, originX: 0, originY: 0 }
    this._onNavSelect = null
    this._lastClickInfo = '(none yet — click anywhere, including a stuck panel)'
  }

  init () {
    injectStyles()
    this._onNavSelect = (e) => {
      if (e.detail?.item !== '⟐OmniInputMonitor') return
      this.open()
    }
    window.addEventListener('omni:nav-select', this._onNavSelect)

    // Capture phase — runs before any other click handler on the page,
    // including one that might stopPropagation(). Reports exactly which
    // real DOM element received a given click, so a "stuck, unclickable
    // panel" report can be diagnosed directly instead of guessed at.
    this._onGlobalClick = (e) => {
      const el = document.elementFromPoint(e.clientX, e.clientY)
      if (!el) { this._lastClickInfo = '(elementFromPoint returned nothing)'; return }
      const tag = el.tagName.toLowerCase()
      const id = el.id ? `#${el.id}` : ''
      const cls = el.className && typeof el.className === 'string' ? `.${el.className.trim().split(/\s+/).join('.')}` : ''
      const winId = el.closest?.('[data-win-id]')?.dataset.winId
      this._lastClickInfo = `${tag}${id}${cls}` + (winId ? ` (panel: ${winId})` : ' (no panel ancestor)')
    }
    window.addEventListener('pointerdown', this._onGlobalClick, true)   // capture phase, deliberately
  }

  update () {
    if (!this._isOpen || !this._body) return
    const cam = this.ctx?.camera
    const p = cam?.position
    const pressed = this.movementPad?._pressed
    const activeDirs = pressed
      ? Object.entries(pressed).flatMap(([hand, dirs]) =>
          Object.entries(dirs).filter(([, v]) => v).map(([d]) => `${hand}.${d}`))
      : []

    this._body.textContent =
      `cam: ${p ? `${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)}` : 'NO CAMERA'}\n` +
      `orbit enabled: ${this.orbitMod?.controls?.enabled}\n` +
      `pressed: ${activeDirs.length ? activeDirs.join(', ') : '(none)'}\n` +
      `speed x: ${this.movementPad?._moveSpeedMultiplier}\n` +
      `LH update() calls: ${this.movementPad?._lhCallCount ?? 0}\n` +
      (this.movementPad?._lastLHError ? `LH ERROR: ${this.movementPad._lastLHError}` : 'LH ERROR: (none)') +
      `\nlast click hit: ${this._lastClickInfo}`
  }

  onResize () {}

  destroy () {
    window.removeEventListener('omni:nav-select', this._onNavSelect)
    window.removeEventListener('pointerdown', this._onGlobalClick, true)
    this._el?.parentNode?.removeChild(this._el)
    WindowManager.unregister('inputmonitor')
  }

  open () {
    if (!this._el) this._el = this._buildDOM()
    const shell = document.getElementById('omni-ui') ?? document.body
    shell.appendChild(this._el)
    this._el.style.visibility = 'visible'
    gsap.to(this._el, { opacity: WindowManager.getPanelOpacity(), duration: 0.25 })
    this._isOpen = true
  }

  close () {
    if (!this._el) return
    gsap.to(this._el, {
      opacity: 0, duration: 0.18,
      onComplete: () => { this._el.style.visibility = 'hidden' },
    })
    this._isOpen = false
  }

  minimize () {
    if (!this._el) return
    const rect = this._el.getBoundingClientRect()
    gsap.to(this._el, {
      opacity: 0, scale: 0.3, duration: 0.2,
      onComplete: () => { this._el.style.visibility = 'hidden' },
    })
    this._isOpen = false
    window.dispatchEvent(new CustomEvent('omni:panel-minimized', {
      detail: {
        id: 'inputmonitor', label: '⟐OmniInputMonitor', iconLabel: '⟐IM',
        fromRect: { x: rect.left, y: rect.top, w: rect.width, h: rect.height },
        variant: 'orb',
      }
    }))
  }

  _buildDOM () {
    const el = document.createElement('div')
    el.className = 'omni-input-monitor'
    el.innerHTML = `
      <div class="im-header">
        <span class="im-title">⟐Input Monitor</span>
        <div class="im-controls">
          <button class="im-ctrl" data-action="minimize" title="Minimize">–</button>
          <button class="im-ctrl" data-action="close" title="Close">×</button>
        </div>
      </div>
      <div class="im-body"></div>
      <div class="im-resize-handle" aria-hidden="true"></div>
    `
    this._body = el.querySelector('.im-body')

    this._bindHeader(el)
    this._bindResize(el)

    el.querySelector('[data-action="minimize"]').addEventListener('click', () => this.minimize())
    el.querySelector('[data-action="close"]').addEventListener('click', () => this.close())

    el.dataset.winId = 'inputmonitor'
    WindowManager.register('inputmonitor', el, 'Input Monitor')
    WindowManager.watchPanelOpacity(el, () => this._isOpen)

    return el
  }

  _bindHeader (el) {
    const header = el.querySelector('.im-header')
    const onDown = (e) => {
      if (e.target.closest('button')) return
      const cx = e.touches?.[0]?.clientX ?? e.clientX
      const cy = e.touches?.[0]?.clientY ?? e.clientY
      const rect = el.getBoundingClientRect()
      this._drag = { active: true, startX: cx, startY: cy, originX: rect.left, originY: rect.top }
      header.classList.add('is-dragging')
      el.style.transform = 'none'   // switch off the initial centering transform once user takes control
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
    const handle = el.querySelector('.im-resize-handle')
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
