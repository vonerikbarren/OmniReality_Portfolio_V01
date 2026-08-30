/**
 * ui/OmniExpression.js — ⟐mniReality OmniExpression (formerly OmniPresentation)
 *
 * Opens from the top-left drawer (⟐mniMenu → ⟐OmniExpression™ — a
 * top-level trademark item, not nested under ⟐Experiences anymore).
 * Same window chrome as every other panel — draggable, resizable,
 * minimizable, maximizable — via the shared ui/WindowManager.js.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Scope of this pass — shell only
 * ─────────────────────────────────────────────────────────────────────────────
 * This is deliberately minimal: it opens, and shows the path location
 * starting at 0, per request. It does NOT yet implement:
 *   - the primary-mesh preview with events as particles inside it
 *   - stop-rotation / zoom controls on that preview
 *   - alternative-path branching (number-line + letter addressing)
 *   - the visible transition when switching paths
 *   - automatic vs. manual (arrow-key) traversal
 * That's the larger OmniExpression build still ahead — this establishes
 * the panel's place in the drawer and its path-location state so the
 * rest can be layered on without moving the entry point again.
 *
 * Follows the standard module contract (constructor / init / update / destroy).
 */

import gsap from 'gsap'
import * as WindowManager from './WindowManager.js'

const STYLES = /* css */`

.omni-expression {
  --oe-bg          : var(--omni-theme-bg, rgba(8, 8, 12, 0.92));
  --oe-border      : var(--omni-theme-border, rgba(255, 255, 255, 0.09));
  --oe-header-bg   : var(--omni-theme-header-bg, rgba(255, 255, 255, 0.03));
  --oe-text        : var(--omni-theme-text, rgba(255, 255, 255, 0.92));
  --oe-text-dim    : var(--omni-theme-text-dim, rgba(255, 255, 255, 0.68));
  --oe-text-muted  : var(--omni-theme-text-muted, rgba(255, 255, 255, 0.45));
  --oe-accent      : var(--omni-theme-accent, #c9a3ff);
  --mono           : 'Courier New', Courier, monospace;

  position         : fixed;
  top              : 110px;
  left             : 140px;
  width            : 340px;
  min-width        : 280px;
  max-width        : 640px;
  height           : 260px;
  min-height       : 200px;
  max-height       : 90vh;

  display          : flex;
  flex-direction   : column;

  background       : var(--oe-bg);
  backdrop-filter  : blur(22px) saturate(1.5);
  -webkit-backdrop-filter: blur(22px) saturate(1.5);
  border           : 1px solid var(--oe-border);
  border-radius    : 14px;
  box-shadow       : 0 0 24px rgba(0,0,0,0.4), 0 12px 40px rgba(0,0,0,0.55);

  font-family      : var(--mono);
  color            : var(--oe-text);
  z-index          : 60;
  overflow         : hidden;
  pointer-events   : auto;

  opacity          : 0;
  transform        : scale(0.92);
}

.oe-header {
  position         : relative;
  height           : 42px;
  flex-shrink      : 0;
  display          : flex;
  align-items      : center;
  justify-content  : center;
  background       : var(--oe-header-bg);
  border-bottom    : 1px solid var(--oe-border);
  cursor           : grab;
  user-select      : none;
}
.oe-header.is-dragging { cursor: grabbing; }

.oe-title {
  position         : absolute;
  left             : 14px;
  font-size        : 12px;
  letter-spacing   : 0.06em;
  color            : var(--oe-text-dim);
  pointer-events   : none;
}

.oe-controls { display: flex; align-items: center; gap: 8px; }

.oe-ctrl {
  width            : 24px;
  height           : 24px;
  border-radius    : 6px;
  border           : 1px solid var(--oe-border);
  background       : rgba(255,255,255,0.04);
  color            : var(--oe-text-dim);
  font-size        : 11px;
  display          : flex;
  align-items      : center;
  justify-content  : center;
  cursor           : pointer;
  transition       : background 0.12s ease, color 0.12s ease, border-color 0.12s ease;
}
.oe-ctrl:hover { background: rgba(255,255,255,0.10); border-color: rgba(255,255,255,0.24); color: var(--oe-text); }
.oe-ctrl--minimize { order: -1; }

.oe-body {
  flex             : 1 1 auto;
  overflow-y       : auto;
  padding          : 18px 16px;
  display          : flex;
  flex-direction   : column;
  align-items      : center;
  justify-content  : center;
  gap              : 10px;
  text-align       : center;
}

.oe-location-label {
  font-size        : 10px;
  letter-spacing   : 0.14em;
  text-transform   : uppercase;
  color            : var(--oe-text-muted);
}

.oe-location-value {
  font-size        : 40px;
  font-weight      : bold;
  color            : var(--oe-accent);
  text-shadow      : 0 0 16px rgba(201, 163, 255, 0.5);
}

.oe-note {
  font-size        : 9px;
  line-height      : 1.6;
  color            : var(--oe-text-muted);
  max-width        : 260px;
}

.oe-resize-handle {
  position         : absolute; right: 0; bottom: 0;
  width            : 16px; height: 16px;
  cursor           : nwse-resize;
  z-index          : 2;
}
.oe-resize-handle::before {
  content          : '';
  position         : absolute; right: 3px; bottom: 3px;
  width            : 8px; height: 8px;
  border-right     : 2px solid rgba(255, 255, 255, 0.25);
  border-bottom    : 2px solid rgba(255, 255, 255, 0.25);
  border-radius    : 0 0 2px 0;
}
.oe-resize-handle:hover::before { border-color: rgba(255, 255, 255, 0.6); }

`

function injectStyles () {
  if (document.getElementById('omni-expression-styles')) return
  const tag = document.createElement('style')
  tag.id = 'omni-expression-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

export default class OmniExpression {
  constructor (context) {
    this.ctx = context
    this._el = null
    this._isOpen = false
    this._drag = { active: false, startX: 0, startY: 0, originX: 0, originY: 0 }
    this._pathLocation = 0   // origin — see BACKLOG for the full number-line/letter addressing scheme
    this._onNavSelect = null
  }

  init () {
    injectStyles()
    this._onNavSelect = (e) => {
      if (e.detail?.item !== '⟐OmniExpression') return
      this.open()
    }
    window.addEventListener('omni:nav-select', this._onNavSelect)
  }

  update () {}
  onResize () {}

  destroy () {
    window.removeEventListener('omni:nav-select', this._onNavSelect)
    this._el?.parentNode?.removeChild(this._el)
    WindowManager.unregister('omniexpression')
  }

  open () {
    if (!this._el) this._el = this._buildDOM()
    const shell = document.getElementById('omni-ui') ?? document.body
    shell.appendChild(this._el)
    this._el.style.visibility = 'visible'
    gsap.to(this._el, { opacity: WindowManager.getPanelOpacity(), scale: 1, duration: 0.28, ease: 'back.out(1.4)' })
    this._isOpen = true
  }

  close () {
    if (!this._el) return
    gsap.to(this._el, {
      opacity: 0, scale: 0.92, duration: 0.18, ease: 'power1.in',
      onComplete: () => { this._el.style.visibility = 'hidden' },
    })
    this._isOpen = false
  }

  minimize () {
    if (!this._el) return
    const rect = this._el.getBoundingClientRect()
    gsap.to(this._el, {
      opacity: 0, scale: 0.3, duration: 0.22, ease: 'power2.in',
      onComplete: () => { this._el.style.visibility = 'hidden' },
    })
    this._isOpen = false
    window.dispatchEvent(new CustomEvent('omni:panel-minimized', {
      detail: {
        id: 'omniexpression', label: '⟐Expression', iconLabel: '⟐E',
        fromRect: { x: rect.left, y: rect.top, w: rect.width, h: rect.height },
        variant: 'orb',
      }
    }))
  }

  // ── DOM ──────────────────────────────────────────────────────────────────

  _buildDOM () {
    const el = document.createElement('div')
    el.className = 'omni-expression'
    el.innerHTML = /* html */`
      <div class="oe-header">
        <span class="oe-title">⟐OmniExpression</span>
        <div class="oe-controls">
          <button class="oe-ctrl oe-ctrl--minimize" data-action="minimize" title="Minimize">–</button>
          <button class="oe-ctrl oe-ctrl--close" data-action="close" title="Close">×</button>
        </div>
      </div>
      <div class="oe-body">
        <span class="oe-location-label">Path Location</span>
        <span class="oe-location-value">${this._pathLocation}</span>
        <span class="oe-note">
          Main path origin. Alternative paths, the primary-mesh event
          preview, and arrow-key traversal are still being built.
        </span>
      </div>
      <div class="oe-resize-handle" aria-hidden="true"></div>
    `

    this._bindHeader(el)
    this._bindResize(el)
    el.querySelector('[data-action="minimize"]').addEventListener('click', () => this.minimize())
    el.querySelector('[data-action="close"]').addEventListener('click', () => this.close())

    el.dataset.winId = 'omniexpression'
    WindowManager.register('omniexpression', el)
    WindowManager.watchPanelOpacity(el, () => this._isOpen)

    return el
  }

  _bindHeader (el) {
    const header = el.querySelector('.oe-header')
    const onDown = (e) => {
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
    const handle = el.querySelector('.oe-resize-handle')
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
