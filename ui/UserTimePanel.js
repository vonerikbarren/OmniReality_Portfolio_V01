/**
 * ui/UserTimePanel.js — ⟐ser Time
 *
 * Admin Settings slot 6. Two live clocks for keeping track of time
 * while sandboxing: the actual current wall-clock time, and a
 * continuously counting-up session timer starting from the exact
 * moment landing genuinely completes (omni:user-landed, dispatched
 * right when the entry animation's camera fall finishes in main.js —
 * not when the page loads, and not when the entry animation starts).
 *
 * Follows the standard module contract (constructor / init / update / destroy).
 */

import gsap from 'gsap'
import * as WindowManager from './WindowManager.js'

function pad2 (n) { return String(n).padStart(2, '0') }

function formatClock (date) {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`
}

function formatElapsed (ms) {
  const totalSeconds = Math.floor(ms / 1000)
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}`
}

const STYLES = `

.omni-usertime-panel {
  pointer-events   : auto;
  --ut-bg          : var(--omni-theme-bg, rgba(8, 8, 12, 0.92));
  --ut-border      : var(--omni-theme-border, rgba(255, 255, 255, 0.09));
  --ut-header-bg   : var(--omni-theme-header-bg, rgba(255, 255, 255, 0.03));
  --ut-text        : var(--omni-theme-text, rgba(255, 255, 255, 0.9));
  --ut-text-dim    : var(--omni-theme-text-dim, rgba(255, 255, 255, 0.6));
  --ut-accent      : var(--omni-theme-accent, rgba(255, 178, 127, 0.9));
  --mono           : 'Courier New', Courier, monospace;

  position         : fixed;
  top              : 120px;
  left             : 260px;
  width            : 260px;
  min-width        : 220px;
  max-width        : 90vw;
  height           : 200px;
  min-height       : 160px;
  max-height       : 60vh;

  display          : flex;
  flex-direction   : column;

  background       : var(--ut-bg);
  backdrop-filter  : blur(20px) saturate(1.5);
  -webkit-backdrop-filter: blur(20px) saturate(1.5);
  border           : 1px solid var(--ut-border);
  border-radius    : 12px;
  box-shadow       : 0 0 20px rgba(0,0,0,0.4), 0 10px 30px rgba(0,0,0,0.5);

  font-family      : var(--mono);
  z-index          : 60;
  overflow         : hidden;
  resize           : both;
  opacity          : 0;
  visibility       : hidden;
}

.ut-header {
  height           : 36px;
  flex-shrink      : 0;
  display          : flex;
  align-items      : center;
  justify-content  : center;
  background       : var(--ut-header-bg);
  border-bottom    : 1px solid var(--ut-border);
  cursor           : grab;
  user-select      : none;
  position         : relative;
}
.ut-header.is-dragging { cursor: grabbing; }
.ut-title { font-size: 10.5px; letter-spacing: 0.05em; color: var(--ut-text-dim); }
.ut-controls { position: absolute; right: 8px; display: flex; gap: 4px; }
.ut-ctrl {
  width: 18px; height: 18px; border-radius: 4px;
  border: 1px solid var(--ut-border);
  background: rgba(255,255,255,0.04);
  color: var(--ut-text-dim);
  font-size: 10px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
}
.ut-ctrl:hover { background: rgba(255,255,255,0.1); color: var(--ut-text); }

.ut-body { flex: 1 1 auto; padding: 16px 14px; display: flex; flex-direction: column; gap: 16px; justify-content: center; }
.ut-block { text-align: center; }
.ut-block-label { font-size: 9px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ut-text-dim); margin-bottom: 4px; }
.ut-block-value { font-size: 22px; color: var(--ut-text); letter-spacing: 0.04em; }
.ut-block-value.is-accent { color: var(--ut-accent); }
.ut-not-landed { font-size: 9px; color: var(--ut-text-dim); opacity: 0.7; margin-top: 2px; }

.ut-resize-handle { position: absolute; right: 0; bottom: 0; width: 14px; height: 14px; cursor: nwse-resize; }
.ut-resize-handle::before {
  content: ''; position: absolute; right: 3px; bottom: 3px; width: 7px; height: 7px;
  border-right: 2px solid rgba(255,255,255,0.25); border-bottom: 2px solid rgba(255,255,255,0.25);
}

`

function injectStyles () {
  if (document.getElementById('omni-usertime-styles')) return
  const tag = document.createElement('style')
  tag.id = 'omni-usertime-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

export default class UserTimePanel {
  constructor (context) {
    this.ctx = context
    this._el = null
    this._isOpen = false
    this._landedAt = null
    this._drag = { active: false }
  }

  init () {
    injectStyles()
    this._onNavSelect = (e) => {
      if (e.detail?.item !== '⟐UserTime') return
      this.open()
    }
    window.addEventListener('omni:nav-select', this._onNavSelect)

    this._onLanded = (e) => { this._landedAt = e.detail?.at ?? Date.now() }
    window.addEventListener('omni:user-landed', this._onLanded)
  }

  update () {
    if (!this._isOpen || !this._el) return
    const now = new Date()
    this._el.querySelector('[data-role="current-time"]').textContent = formatClock(now)

    const elapsedEl = this._el.querySelector('[data-role="elapsed"]')
    const notLandedEl = this._el.querySelector('.ut-not-landed')
    if (this._landedAt) {
      elapsedEl.textContent = formatElapsed(Date.now() - this._landedAt)
      if (notLandedEl) notLandedEl.style.display = 'none'
    } else {
      elapsedEl.textContent = '00:00:00'
      if (notLandedEl) notLandedEl.style.display = ''
    }
  }

  onResize () {}

  destroy () {
    window.removeEventListener('omni:nav-select', this._onNavSelect)
    window.removeEventListener('omni:user-landed', this._onLanded)
    this._el?.parentNode?.removeChild(this._el)
    WindowManager.unregister('usertime')
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
      detail: {
        id: 'usertime', label: '⟐UserTime', iconLabel: '⟐T',
        fromRect: { x: rect.left, y: rect.top, w: rect.width, h: rect.height },
        variant: 'orb',
      }
    }))
  }

  _buildDOM () {
    const el = document.createElement('div')
    el.className = 'omni-usertime-panel'
    el.innerHTML = `
      <div class="ut-header">
        <span class="ut-title">⟐UserTime</span>
        <div class="ut-controls">
          <button class="ut-ctrl" data-action="minimize" title="Minimize">–</button>
          <button class="ut-ctrl" data-action="close" title="Close">×</button>
        </div>
      </div>
      <div class="ut-body">
        <div class="ut-block">
          <div class="ut-block-label">Current Time</div>
          <div class="ut-block-value" data-role="current-time">--:--:--</div>
        </div>
        <div class="ut-block">
          <div class="ut-block-label">Time Since Landed</div>
          <div class="ut-block-value is-accent" data-role="elapsed">00:00:00</div>
          <div class="ut-not-landed">Counts up automatically once landing completes</div>
        </div>
      </div>
      <div class="ut-resize-handle" aria-hidden="true"></div>
    `

    this._bindHeader(el)
    this._bindResize(el)
    el.querySelector('[data-action="minimize"]').addEventListener('click', () => this.minimize())
    el.querySelector('[data-action="close"]').addEventListener('click', () => this.close())

    el.dataset.winId = 'usertime'
    WindowManager.register('usertime', el, 'User Time')
    WindowManager.watchPanelOpacity(el, () => this._isOpen)

    return el
  }

  _bindHeader (el) {
    const header = el.querySelector('.ut-header')
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
    const handle = el.querySelector('.ut-resize-handle')
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
