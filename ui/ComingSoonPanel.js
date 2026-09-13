/**
 * ui/ComingSoonPanel.js — shared placeholder panel
 *
 * For menu entries that are real, clickable, and correctly wired, but
 * whose actual functionality hasn't been specified/built yet.
 * Deliberately not a fake — no invented functionality, no placeholder
 * data pretending to be real. Just an honest "not built yet," with
 * the same real window chrome (drag/resize/minimize/close) as every
 * other panel, so it behaves consistently even before there's
 * anything behind it.
 *
 * Follows the standard module contract (constructor / init / update / destroy).
 */

import gsap from 'gsap'
import * as WindowManager from './WindowManager.js'

const STYLES = `

.omni-comingsoon-panel {
  pointer-events    : auto;
  --csn-bg          : var(--omni-theme-bg, rgba(8, 8, 12, 0.92));
  --csn-border      : var(--omni-theme-border, rgba(255, 255, 255, 0.09));
  --csn-header-bg   : var(--omni-theme-header-bg, rgba(255, 255, 255, 0.03));
  --csn-text        : var(--omni-theme-text, rgba(255, 255, 255, 0.9));
  --csn-text-dim    : var(--omni-theme-text-dim, rgba(255, 255, 255, 0.6));
  --csn-accent      : var(--omni-theme-accent, rgba(255, 178, 127, 0.9));
  --mono            : 'Courier New', Courier, monospace;

  position          : fixed;
  top               : 130px;
  left              : 200px;
  width             : 280px;
  min-width         : 220px;
  max-width         : 90vw;
  height            : 160px;
  min-height        : 120px;
  max-height        : 60vh;

  display           : flex;
  flex-direction    : column;

  background        : var(--csn-bg);
  backdrop-filter   : blur(20px) saturate(1.5);
  -webkit-backdrop-filter: blur(20px) saturate(1.5);
  border            : 1px solid var(--csn-border);
  border-radius     : 12px;
  box-shadow        : 0 0 20px rgba(0,0,0,0.4), 0 10px 30px rgba(0,0,0,0.5);

  font-family       : var(--mono);
  z-index           : 60;
  overflow          : hidden;
  opacity           : 0;
  visibility        : hidden;
}

.csn-header {
  height            : 36px;
  flex-shrink       : 0;
  display           : flex;
  align-items       : center;
  justify-content   : center;
  background        : var(--csn-header-bg);
  border-bottom     : 1px solid var(--csn-border);
  cursor            : grab;
  user-select       : none;
  position          : relative;
}
.csn-header.is-dragging { cursor: grabbing; }
.csn-title { font-size: 10.5px; letter-spacing: 0.05em; color: var(--csn-text-dim); }
.csn-controls { position: absolute; right: 8px; display: flex; gap: 4px; }
.csn-ctrl {
  width: 18px; height: 18px; border-radius: 4px;
  border: 1px solid var(--csn-border);
  background: rgba(255,255,255,0.04);
  color: var(--csn-text-dim);
  font-size: 10px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
}
.csn-ctrl:hover { background: rgba(255,255,255,0.1); color: var(--csn-text); }

.csn-body {
  flex: 1 1 auto; display: flex; flex-direction: column;
  align-items: center; justify-content: center; text-align: center;
  padding: 16px; gap: 6px;
}
.csn-glyph { font-size: 20px; color: var(--csn-accent); opacity: 0.7; }
.csn-body p { font-size: 10.5px; color: var(--csn-text-dim); line-height: 1.5; margin: 0; }

.csn-resize-handle { position: absolute; right: 0; bottom: 0; width: 14px; height: 14px; cursor: nwse-resize; }
.csn-resize-handle::before {
  content: ''; position: absolute; right: 3px; bottom: 3px; width: 7px; height: 7px;
  border-right: 2px solid rgba(255,255,255,0.25); border-bottom: 2px solid rgba(255,255,255,0.25);
}

`

function injectStyles () {
  if (document.getElementById('omni-comingsoon-styles')) return
  const tag = document.createElement('style')
  tag.id = 'omni-comingsoon-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

let _comingSoonOpenCount = 0

export default class ComingSoonPanel {
  constructor (context, { navItem, title, winId, note }) {
    this.ctx = context
    this.navItem = navItem
    this.title = title
    this.winId = winId
    this.note = note ?? 'Designed, not built yet.'
    this._el = null
    this._isOpen = false
    this._drag = { active: false }
    // The actual bug: all instances previously shared one hardcoded
    // CSS position, so opening more than one stacked them pixel-for-
    // pixel on top of each other — the top one completely burying and
    // blocking the one underneath, which looked exactly like a
    // panel becoming stuck/unresponsive. Each instance now gets its
    // own real, cascaded offset instead.
    this._openIndex = _comingSoonOpenCount++
  }

  init () {
    injectStyles()
    this._onNavSelect = (e) => {
      if (e.detail?.item !== this.navItem) return
      this.open()
    }
    window.addEventListener('omni:nav-select', this._onNavSelect)
  }

  update () {}
  onResize () {}

  destroy () {
    window.removeEventListener('omni:nav-select', this._onNavSelect)
    this._el?.parentNode?.removeChild(this._el)
    WindowManager.unregister(this.winId)
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
        id: this.winId, label: this.title, iconLabel: '⟐?',
        fromRect: { x: rect.left, y: rect.top, w: rect.width, h: rect.height },
        variant: 'orb',
      }
    }))
  }

  _buildDOM () {
    const el = document.createElement('div')
    el.className = 'omni-comingsoon-panel'
    // Cascade each instance diagonally so multiple panels of this
    // type never land on the exact same spot — 32px steps, wrapping
    // after 6 so it never cascades off-screen indefinitely.
    const step = (this._openIndex % 6) * 32
    el.style.top = `${130 + step}px`
    el.style.left = `${200 + step}px`
    el.innerHTML = `
      <div class="csn-header">
        <span class="csn-title">${this.title}</span>
        <div class="csn-controls">
          <button class="csn-ctrl" data-action="minimize" title="Minimize">–</button>
          <button class="csn-ctrl" data-action="close" title="Close">×</button>
        </div>
      </div>
      <div class="csn-body">
        <div class="csn-glyph">⟐</div>
        <p>${this.note}</p>
      </div>
      <div class="csn-resize-handle" aria-hidden="true"></div>
    `
    this._bindHeader(el)
    this._bindResize(el)
    el.querySelector('[data-action="minimize"]').addEventListener('click', () => this.minimize())
    el.querySelector('[data-action="close"]').addEventListener('click', () => this.close())

    el.dataset.winId = this.winId
    WindowManager.register(this.winId, el, this.title)
    WindowManager.watchPanelOpacity(el, () => this._isOpen)

    return el
  }

  _bindHeader (el) {
    const header = el.querySelector('.csn-header')
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
    const handle = el.querySelector('.csn-resize-handle')
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
