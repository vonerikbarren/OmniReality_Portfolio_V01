/**
 * ui/PanelControl.js — ⟐mniReality PanelControl
 *
 * A dedicated panel for controlling in-space panels (currently: the
 * External info-plane built in systems/OmniInspector.js). Pulled out
 * of that Inspector's Data section into its own panel, per explicit
 * request — "we should have a separate panel for this now."
 *
 * This first pass covers just the scroll buttons (Up/Down/Page Up/
 * Page Down) that used to live inline in the Inspector. The stated
 * direction for where this goes next: also being able to move a
 * panel's position, or change its form/shape — neither is built yet,
 * this is deliberately just the button system for now.
 *
 * Doesn't own any plane state itself — dispatches abstract direction
 * commands that systems/OmniInspector.js (which owns the actual
 * planes) applies to whichever node is currently loaded there. Keeps
 * the real scrolling mechanism in one place rather than duplicating it
 * here.
 *
 * Follows the standard module contract (constructor / init / update / destroy).
 */

import gsap from 'gsap'
import * as WindowManager from './WindowManager.js'

const STYLES = /* css */`

.omni-panel-control {
  --pc-bg          : var(--omni-theme-bg, rgba(8, 8, 12, 0.92));
  --pc-border      : var(--omni-theme-border, rgba(255, 255, 255, 0.09));
  --pc-header-bg   : var(--omni-theme-header-bg, rgba(255, 255, 255, 0.03));
  --pc-text        : var(--omni-theme-text, rgba(255, 255, 255, 1));
  --pc-text-dim    : var(--omni-theme-text-dim, rgba(255, 255, 255, 0.85));
  --pc-text-muted  : var(--omni-theme-text-muted, rgba(255, 255, 255, 0.6));
  --pc-accent      : var(--omni-theme-accent, #8cffb4);
  --mono           : 'Courier New', Courier, monospace;

  position         : fixed;
  top              : 140px;
  left             : 160px;
  width            : 240px;
  min-width        : 200px;
  max-width        : 90vw;
  height           : 220px;
  min-height       : 180px;
  max-height       : 92vh;

  display          : flex;
  flex-direction   : column;

  background       : var(--pc-bg);
  backdrop-filter  : blur(22px) saturate(1.5);
  -webkit-backdrop-filter: blur(22px) saturate(1.5);
  border           : 1px solid var(--pc-border);
  border-radius    : 14px;
  box-shadow       : 0 0 24px rgba(0,0,0,0.4), 0 12px 40px rgba(0,0,0,0.55);

  font-family      : var(--mono);
  color            : var(--pc-text);
  z-index          : 60;
  overflow         : hidden;
  pointer-events   : auto;
  resize           : both;

  opacity          : 0;
  transform        : scale(0.94);
}

.pc-header {
  position         : relative;
  height           : 40px;
  flex-shrink      : 0;
  display          : flex;
  align-items      : center;
  justify-content  : center;
  background       : var(--pc-header-bg);
  border-bottom    : 1px solid var(--pc-border);
  cursor           : grab;
  user-select      : none;
}
.pc-header.is-dragging { cursor: grabbing; }
.pc-title { position: absolute; left: 12px; font-size: 10.5px; letter-spacing: 0.06em; color: var(--pc-text-dim); }
.pc-controls { position: absolute; right: 8px; display: flex; align-items: center; gap: 6px; }
.pc-ctrl {
  width: 20px; height: 20px; border-radius: 5px;
  border: 1px solid var(--pc-border);
  background: rgba(255,255,255,0.04);
  color: var(--pc-text-dim);
  font-size: 10px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
}
.pc-ctrl:hover { background: rgba(255,255,255,0.10); color: var(--pc-text); }

.pc-body { flex: 1 1 auto; overflow-y: auto; padding: 14px; display: flex; flex-direction: column; gap: 10px; }

.pc-note {
  font-size        : 9px;
  color            : var(--pc-text-muted);
  text-align       : center;
  line-height      : 1.4;
}

.pc-btn-grid {
  display              : grid;
  grid-template-columns: 1fr;
  gap                  : 8px;
  flex                 : 1;
}
.pc-scroll-btn {
  background       : rgba(255,255,255,0.06);
  border           : 1px solid var(--pc-border);
  border-radius    : 8px;
  color            : var(--pc-text-dim);
  font-size        : 18px;
  cursor           : pointer;
  user-select      : none;
  touch-action     : none;
  display          : flex;
  align-items      : center;
  justify-content  : center;
  gap              : 8px;
}
.pc-scroll-btn .pc-btn-label { font-size: 10px; letter-spacing: 0.04em; }
.pc-scroll-btn:hover { background: rgba(255,255,255,0.12); color: var(--pc-text); }
.pc-scroll-btn:active, .pc-scroll-btn.is-pressed {
  background       : rgba(140, 255, 180, 0.18);
  border-color     : rgba(140, 255, 180, 0.4);
  color            : rgba(160, 255, 195, 0.95);
}
.pc-scroll-btn--page { font-size: 15px; opacity: 0.85; }

.pc-resize-handle { position: absolute; right: 0; bottom: 0; width: 16px; height: 16px; cursor: nwse-resize; }
.pc-resize-handle::before {
  content: ''; position: absolute; right: 3px; bottom: 3px; width: 8px; height: 8px;
  border-right: 2px solid rgba(255,255,255,0.25); border-bottom: 2px solid rgba(255,255,255,0.25);
}

`

function injectStyles () {
  if (document.getElementById('omni-panel-control-styles')) return
  const tag = document.createElement('style')
  tag.id = 'omni-panel-control-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

export default class PanelControl {
  constructor (context) {
    this.ctx = context
    this._el = null
    this._isOpen = false
    this._drag = { active: false, startX: 0, startY: 0, originX: 0, originY: 0 }
    this._onNavSelect = null
  }

  init () {
    injectStyles()
    this._onNavSelect = (e) => {
      if (e.detail?.item !== '⟐PanelControl') return
      this.open()
    }
    window.addEventListener('omni:nav-select', this._onNavSelect)
  }

  update () {}
  onResize () {}

  destroy () {
    window.removeEventListener('omni:nav-select', this._onNavSelect)
    this._el?.parentNode?.removeChild(this._el)
    WindowManager.unregister('panelcontrol')
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
        id: 'panelcontrol', label: '⟐PanelControl', iconLabel: '⟐P',
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
    el.className = 'omni-panel-control'
    el.innerHTML = /* html */`
      <div class="pc-header">
        <span class="pc-title">⟐PanelControl</span>
        <div class="pc-controls">
          <button class="pc-ctrl" data-action="minimize" title="Minimize">–</button>
          <button class="pc-ctrl" data-action="close" title="Close">×</button>
        </div>
      </div>
      <div class="pc-body">
        <div class="pc-note">
          Scrolls whichever in-space panel is currently open in the
          Inspector, when Scrollable is on. Hold a button to keep
          scrolling.
        </div>
        <div class="pc-btn-grid">
          <button class="pc-scroll-btn pc-scroll-btn--page" id="pc-pageup"><span>⏫</span><span class="pc-btn-label">Page Up</span></button>
          <button class="pc-scroll-btn" id="pc-up"><span>▲</span><span class="pc-btn-label">Up</span></button>
          <button class="pc-scroll-btn" id="pc-down"><span>▼</span><span class="pc-btn-label">Down</span></button>
          <button class="pc-scroll-btn pc-scroll-btn--page" id="pc-pagedown"><span>⏬</span><span class="pc-btn-label">Page Down</span></button>
        </div>
      </div>
      <div class="pc-resize-handle" aria-hidden="true"></div>
    `

    this._bindHeader(el)
    this._bindResize(el)
    this._bindScrollButtons(el)

    el.querySelector('[data-action="minimize"]').addEventListener('click', () => this.minimize())
    el.querySelector('[data-action="close"]').addEventListener('click', () => this.close())

    el.dataset.winId = 'panelcontrol'
    WindowManager.register('panelcontrol', el, 'PanelControl')
    WindowManager.watchPanelOpacity(el, () => this._isOpen)

    return el
  }

  /** Press-and-hold — steps once immediately on press (a quick tap
   *  still does something), then after a short delay starts repeating
   *  continuously until release. Covers mouse and touch identically,
   *  since this panel is explicitly meant to work on mobile. */
  _bindScrollButtons (el) {
    const bindHold = (id, direction) => {
      const btn = el.querySelector(`#${id}`)
      if (!btn) return
      let holdTimer = null
      let repeatTimer = null
      const fire = () => {
        window.dispatchEvent(new CustomEvent('omni:panel-control-scroll', { detail: { direction } }))
      }
      const stop = () => {
        clearTimeout(holdTimer)
        clearInterval(repeatTimer)
        btn.classList.remove('is-pressed')
      }
      const start = (e) => {
        e.preventDefault()
        btn.classList.add('is-pressed')
        fire()
        holdTimer = setTimeout(() => { repeatTimer = setInterval(fire, 60) }, 400)
      }
      btn.addEventListener('mousedown', start)
      btn.addEventListener('touchstart', start, { passive: false })
      btn.addEventListener('mouseup', stop)
      btn.addEventListener('mouseleave', stop)
      btn.addEventListener('touchend', stop)
      btn.addEventListener('touchcancel', stop)
    }

    bindHold('pc-up', 'up')
    bindHold('pc-down', 'down')
    bindHold('pc-pageup', 'pageup')
    bindHold('pc-pagedown', 'pagedown')
  }

  // ── Header drag / resize — same pattern as every other panel ─────────────

  _bindHeader (el) {
    const header = el.querySelector('.pc-header')
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
    const handle = el.querySelector('.pc-resize-handle')
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
