/**
 * ui/IndexedPanel.js — ⟐mniReality Indexed Panel
 *
 * One reusable panel class for every non-Omni section in the left
 * drawer (Admin, Experiences, Realities, Times, Spaces, Governance,
 * Intelligence, Infrastructures, Objects). Each instance shows a grid
 * of numbered shortcut buttons — Object01 through Object20, Admin01
 * through Admin20, etc. — rather than nine separate, nearly-identical
 * panel files.
 *
 * A "special slot" can override any specific index with a real label
 * and a real action instead of a generic placeholder — used for
 * Admin01 = OmniAdminSettings, which actually opens the real
 * AdminPanel rather than being an inert shortcut like the rest.
 *
 * Every other button is currently a placeholder: clicking it dispatches
 * `omni:section-shortcut { section, index }` so real behavior can be
 * wired in per-section later, without needing to touch this file again.
 * "Each section will be different" is true of what a shortcut DOES,
 * not of the panel chrome itself, which is identical across all nine.
 *
 * Follows the standard module contract (constructor / init / update / destroy).
 */

import gsap from 'gsap'
import * as WindowManager from './WindowManager.js'

const STYLES = /* css */`

.omni-indexed-panel {
  --ip-bg          : var(--omni-theme-bg, rgba(8, 8, 12, 0.92));
  --ip-border      : var(--omni-theme-border, rgba(255, 255, 255, 0.09));
  --ip-header-bg   : var(--omni-theme-header-bg, rgba(255, 255, 255, 0.03));
  --ip-text        : var(--omni-theme-text, rgba(255, 255, 255, 1));
  --ip-text-dim    : var(--omni-theme-text-dim, rgba(255, 255, 255, 0.85));
  --ip-text-muted  : var(--omni-theme-text-muted, rgba(255, 255, 255, 0.6));
  --ip-accent      : var(--omni-theme-accent, #c9a3ff);
  --mono           : 'Courier New', Courier, monospace;

  position         : fixed;
  top              : 120px;
  left             : 140px;
  width            : 320px;
  min-width        : 260px;
  max-width        : 90vw;
  height           : 420px;
  min-height       : 260px;
  max-height       : 92vh;

  display          : flex;
  flex-direction   : column;

  background       : var(--ip-bg);
  backdrop-filter  : blur(22px) saturate(1.5);
  -webkit-backdrop-filter: blur(22px) saturate(1.5);
  border           : 1px solid var(--ip-border);
  border-radius    : 14px;
  box-shadow       : 0 0 24px rgba(0,0,0,0.4), 0 12px 40px rgba(0,0,0,0.55);

  font-family      : var(--mono);
  color            : var(--ip-text);
  z-index          : 60;
  overflow         : hidden;
  pointer-events   : auto;
  resize           : both;

  opacity          : 0;
  transform        : scale(0.94);
}

.ip-header {
  position         : relative;
  height           : 40px;
  flex-shrink      : 0;
  display          : flex;
  align-items      : center;
  justify-content  : center;
  background       : var(--ip-header-bg);
  border-bottom    : 1px solid var(--ip-border);
  cursor           : grab;
  user-select      : none;
}
.ip-header.is-dragging { cursor: grabbing; }
.ip-title { position: absolute; left: 12px; font-size: 11px; letter-spacing: 0.06em; color: var(--ip-text-dim); }
.ip-controls { position: absolute; right: 8px; display: flex; align-items: center; gap: 6px; }
.ip-ctrl {
  width: 20px; height: 20px; border-radius: 5px;
  border: 1px solid var(--ip-border);
  background: rgba(255,255,255,0.04);
  color: var(--ip-text-dim);
  font-size: 10px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
}
.ip-ctrl:hover { background: rgba(255,255,255,0.10); color: var(--ip-text); }

.ip-body { flex: 1 1 auto; overflow-y: auto; padding: 12px; }

.ip-grid {
  display              : grid;
  grid-template-columns: repeat(2, 1fr);
  gap                  : 8px;
}
.ip-btn {
  background       : rgba(255,255,255,0.05);
  border           : 1px solid var(--ip-border);
  border-radius    : 7px;
  color            : var(--ip-text-dim);
  font-family      : var(--mono);
  font-size        : 10px;
  padding          : 10px 6px;
  cursor           : pointer;
  text-align       : center;
}
.ip-btn:hover { background: rgba(255,255,255,0.11); color: var(--ip-text); }
.ip-btn:active { background: rgba(201, 163, 255, 0.16); }
.ip-btn--special {
  background       : rgba(201, 163, 255, 0.14);
  border-color     : rgba(201, 163, 255, 0.4);
  color            : var(--ip-accent);
  font-weight      : bold;
}
.ip-btn--special:hover { background: rgba(201, 163, 255, 0.22); }

.ip-resize-handle { position: absolute; right: 0; bottom: 0; width: 16px; height: 16px; cursor: nwse-resize; }
.ip-resize-handle::before {
  content: ''; position: absolute; right: 3px; bottom: 3px; width: 8px; height: 8px;
  border-right: 2px solid rgba(255,255,255,0.25); border-bottom: 2px solid rgba(255,255,255,0.25);
}

`

function injectStyles () {
  if (document.getElementById('omni-indexed-panel-styles')) return
  const tag = document.createElement('style')
  tag.id = 'omni-indexed-panel-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

export default class IndexedPanel {
  /**
   * @param {object} context
   * @param {object} config
   * @param {string} config.id          — unique id, e.g. 'objects'
   * @param {string} config.navLabel    — exact drawer label to listen for, e.g. '⟐Objects'
   * @param {string} config.title       — header title, e.g. '⟐Objects'
   * @param {string} config.iconLabel   — short label for the minimized icon
   * @param {string} config.prefix      — button label prefix, e.g. 'Object'
   * @param {number} [config.count=20]  — how many indexed buttons to render
   * @param {string} [config.width]     — CSS width override, e.g. '480px' —
   *   for panels that need to be wider than the default (e.g. right-drawer
   *   nav panels, which may eventually hold mini-webpage-like content)
   * @param {object} [config.specialSlots] — { [index]: { label, onClick } }, 1-based, static
   * @param {function} [config.getSlotLabel] — (index) => string, called at render/refresh
   *   time instead of the static prefix+index label, for sections whose slot
   *   labels depend on runtime state (e.g. Spaces: "Space01" vs "Space01 📍").
   * @param {function} [config.getSlotAction] — (index) => (() => void), called at
   *   click time instead of the generic omni:section-shortcut dispatch.
   */
  constructor (context, config) {
    this.ctx = context
    this.config = { count: 20, specialSlots: {}, ...config }
    this._el = null
    this._isOpen = false
    this._drag = { active: false, startX: 0, startY: 0, originX: 0, originY: 0 }
    this._onNavSelect = null
  }

  init () {
    injectStyles()
    this._onNavSelect = (e) => {
      if (e.detail?.item !== this.config.navLabel) return
      this.open()
    }
    window.addEventListener('omni:nav-select', this._onNavSelect)
  }

  update () {}
  onResize () {}

  destroy () {
    window.removeEventListener('omni:nav-select', this._onNavSelect)
    this._el?.parentNode?.removeChild(this._el)
    WindowManager.unregister(this.config.id)
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
        id: this.config.id, label: this.config.title, iconLabel: this.config.iconLabel ?? this.config.prefix?.[0] ?? '⟐',
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
    el.className = 'omni-indexed-panel'
    if (this.config.width) el.style.width = this.config.width
    const { title, prefix, count, specialSlots } = this.config

    const buttons = []
    for (let i = 1; i <= count; i++) {
      const special = specialSlots[i]
      const padded = String(i).padStart(2, '0')
      const label = this.config.getSlotLabel ? this.config.getSlotLabel(i) : (special ? special.label : `${prefix}${padded}`)
      buttons.push(`<button class="ip-btn ${special ? 'ip-btn--special' : ''}" data-index="${i}">${label}</button>`)
    }

    el.innerHTML = /* html */`
      <div class="ip-header">
        <span class="ip-title">${title}</span>
        <div class="ip-controls">
          <button class="ip-ctrl" data-action="minimize" title="Minimize">–</button>
          <button class="ip-ctrl" data-action="close" title="Close">×</button>
        </div>
      </div>
      <div class="ip-body">
        <div class="ip-grid">${buttons.join('')}</div>
      </div>
      <div class="ip-resize-handle" aria-hidden="true"></div>
    `

    this._bindHeader(el)
    this._bindResize(el)
    this._bindGrid(el)

    el.querySelector('[data-action="minimize"]').addEventListener('click', () => this.minimize())
    el.querySelector('[data-action="close"]').addEventListener('click', () => this.close())

    el.dataset.winId = this.config.id
    WindowManager.register(this.config.id, el, this.config.title)
    WindowManager.watchPanelOpacity(el, () => this._isOpen)

    return el
  }

  _bindGrid (el) {
    el.querySelectorAll('[data-index]').forEach(btn => {
      const index = Number(btn.dataset.index)
      const special = this.config.specialSlots[index]
      btn.addEventListener('click', () => {
        if (this.config.getSlotAction) {
          this.config.getSlotAction(index)?.()
        } else if (special?.onClick) {
          special.onClick()
        } else {
          window.dispatchEvent(new CustomEvent('omni:section-shortcut', {
            detail: { section: this.config.id, index }
          }))
        }
      })
    })
  }

  /** Re-renders the grid's labels (via getSlotLabel) without rebuilding
   *  the whole panel — for sections whose slot state can change while
   *  the panel is already open (e.g. Spaces, right after a save). */
  refresh () {
    if (!this._el || !this.config.getSlotLabel) return
    const grid = this._el.querySelector('.ip-grid')
    if (!grid) return
    grid.querySelectorAll('[data-index]').forEach(btn => {
      btn.textContent = this.config.getSlotLabel(Number(btn.dataset.index))
    })
  }

  // ── Header drag / resize — same pattern as every other panel ─────────────

  _bindHeader (el) {
    const header = el.querySelector('.ip-header')
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
    const handle = el.querySelector('.ip-resize-handle')
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
