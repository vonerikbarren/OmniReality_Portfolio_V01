/**
 * ui/Panel.js — ⟐mniReality Base Panel
 *
 * Bottom-level sliding panels — one from the LEFT (⟐LH), one from the RIGHT
 * (⟐RH). Sit above the Dock, below the canvas mid-zone. Unlike top-level
 * Drawers, panels are partial-height and carry the universal control bar that
 * governs every system panel across the OS:
 *
 *   ✕  Close         — dismisses the panel entirely
 *   _  Minimize      — collapses to a freeform ⟐ icon (via PanelIcon.js)
 *   ⟐  Pocket Attach — detaches from corner, becomes a floating window
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Panel states
 * ─────────────────────────────────────────────────────────────────────────────
 *   open        Fully visible, interactive, anchored to its corner
 *   minimized   Hidden — a freeform ⟐ icon exists in its place
 *   attached    Floating window — detached from corner (⟐mniPocket)
 *   docked      Icon lives in the Dock (handled by Dock.js)
 *   closed      Fully dismissed — requires re-invocation to reopen
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Glitch animation
 * ─────────────────────────────────────────────────────────────────────────────
 * Every state transition fires a GSAP glitch — a rapid jitter sequence of
 * x-offset + opacity flicker before the main tween completes. The effect reads
 * as a digital artefact consistent with the ⟐mniReality's computational
 * aesthetic.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Content slot
 * ─────────────────────────────────────────────────────────────────────────────
 * The panel body is an empty container in Phase 3a. Phase 4 systems inject
 * their UI into it via:
 *   document.getElementById(`panel-body-${id}`)
 * The `data-slot` attribute names the expected occupant (e.g. 'lh', 'rh').
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Events consumed (window):
 *   omni:hamburger      { hand: 'lh'|'rh', type:'panel', open: bool }
 *   omni:panel-restore  { id }   — fired by Dock when icon is clicked
 *
 * Events dispatched (window):
 *   omni:panel-minimized  { id, label, iconLabel, fromRect }
 *   omni:panel-attached   { id }
 *   omni:panel-closed     { id }
 *   omni:hamburger        { hand, type:'panel', dir, open: false }  (self-close sync)
 *
 * Usage (via factory):
 *   import { createPanels } from './ui/Panel.js'
 *   const { lh, rh } = createPanels(context)
 *   lh.init()
 *   rh.init()
 *
 * Follows the standard module contract (constructor / init / update / destroy).
 */

import gsap from 'gsap'

// ── Layout constants ──────────────────────────────────────────────────────────

const DOCK_H        = 52    // px — Dock height (bottom anchor)
const PANEL_W       = 340   // px — panel width
const PANEL_H       = 380   // px — panel height
const SLIDE_DUR     = 0.32  // s  — slide in/out
const GLITCH_DUR    = 0.22  // s  — total glitch sequence
const ATTACHED_W    = 380   // px — floating attached width

// ── Panel config table ────────────────────────────────────────────────────────

const PANEL_CONFIGS = {
  lh: {
    id        : 'lh',
    hand      : 'lh',
    dir       : 'left',
    label     : '⟐LH',
    title     : '⟐LH — Analytical',
    iconLabel : '⟐LH',
    corner    : 'bl',
  },
  rh: {
    id        : 'rh',
    hand      : 'rh',
    dir       : 'right',
    label     : '⟐RH',
    title     : '⟐RH — Creative',
    iconLabel : '⟐RH',
    corner    : 'br',
  },
}

// ── Panel state enum ──────────────────────────────────────────────────────────

const STATE = {
  CLOSED    : 'closed',
  OPEN      : 'open',
  MINIMIZED : 'minimized',
  ATTACHED  : 'attached',
  DOCKED    : 'docked',
}

// ── Stylesheet ────────────────────────────────────────────────────────────────

const STYLES = /* css */`

/* ── Panel root ───────────────────────────────────────────────────────────── */

.omni-panel {
  --pn-bg           : rgba(8, 8, 12, 0.90);
  --pn-border       : rgba(255, 255, 255, 0.09);
  --pn-separator    : rgba(255, 255, 255, 0.05);
  --pn-header-bg    : rgba(255, 255, 255, 0.03);
  --pn-text         : rgba(0, 0, 0, 0.90);
  --pn-text-dim     : rgba(0, 0, 0, 0.75);
  --pn-text-muted   : rgba(0, 0, 0, 0.50);
  --pn-accent       : rgba(255, 255, 255, 0.95);
  --pn-ctrl-hover   : rgba(255, 255, 255, 0.08);
  --pn-ctrl-active  : rgba(255, 255, 255, 0.16);
  --pn-glow         : 0 0 12px rgba(255, 255, 255, 0.12);
  --pn-attach-glow  : 0 0 24px rgba(255, 255, 255, 0.18), 0 8px 32px rgba(0,0,0,0.5);
  --mono            : 'Courier New', Courier, monospace;

  position          : fixed;
  bottom            : ${DOCK_H}px;
  width             : ${PANEL_W}px;
  height            : ${PANEL_H}px;

  display           : flex;
  flex-direction    : column;

  background        : var(--pn-bg);
  backdrop-filter   : blur(22px) saturate(1.5);
  -webkit-backdrop-filter: blur(22px) saturate(1.5);
  border            : 1px solid var(--pn-border);

  font-family       : var(--mono);
  color             : var(--pn-text);
  z-index           : 45;
  pointer-events    : auto;
  user-select       : none;
  overflow          : hidden;

  -webkit-font-smoothing: antialiased;

  /* Off-screen by default */
  visibility        : hidden;
}

/* ── Corner anchoring ─────────────────────────────────────────────────────── */

.omni-panel--left {
  left              : 0;
  border-top        : 1px solid var(--pn-border);
  border-right      : 1px solid var(--pn-border);
  border-bottom     : none;
  border-left       : none;
  border-radius     : 0 10px 0 0;
}

.omni-panel--right {
  right             : 0;
  border-top        : 1px solid var(--pn-border);
  border-left       : 1px solid var(--pn-border);
  border-bottom     : none;
  border-right      : none;
  border-radius     : 10px 0 0 0;
}

/* ── Attached (floating) state ────────────────────────────────────────────── */

.omni-panel.is-attached {
  position          : fixed;
  bottom            : auto;
  left              : 50% !important;
  right             : auto !important;
  top               : 50%;
  transform         : translate(-50%, -50%) !important;
  width             : ${ATTACHED_W}px;
  height            : ${PANEL_H + 40}px;
  border-radius     : 12px;
  border            : 1px solid rgba(255, 255, 255, 0.16);
  box-shadow        : var(--pn-attach-glow);
  z-index           : 55;
  cursor            : move;
  resize            : both;
  overflow          : hidden;
}

.omni-panel.is-attached .panel-header {
  cursor            : move;
}

/* Floating indicator dot */
.omni-panel.is-attached .panel-title::after {
  content           : ' ⟐';
  color             : rgba(255,255,255,0.40);
  font-size         : 9px;
}

/* ── Header ───────────────────────────────────────────────────────────────── */

.panel-header {
  flex-shrink       : 0;
  display           : flex;
  align-items       : center;
  justify-content   : space-between;
  padding           : 0 10px 0 14px;
  height            : 38px;
  background        : var(--pn-header-bg);
  border-bottom     : 1px solid var(--pn-separator);
  gap               : 8px;
}

.panel-title {
  font-size         : 10px;
  color             : var(--pn-accent);
  letter-spacing    : 0.12em;
  text-transform    : uppercase;
  flex              : 1 1 auto;
  overflow          : hidden;
  text-overflow     : ellipsis;
  white-space       : nowrap;
}

/* ── Control bar  ✕  _  ⟐ ─────────────────────────────────────────────────── */

.panel-controls {
  display           : flex;
  align-items       : center;
  gap               : 3px;
  flex-shrink       : 0;
}

.panel-ctrl {
  width             : 26px;
  height            : 26px;
  display           : flex;
  align-items       : center;
  justify-content   : center;
  background        : none;
  border            : 1px solid rgba(255,255,255,0.08);
  border-radius     : 5px;
  font-family       : var(--mono);
  font-size         : 11px;
  color             : var(--pn-text-dim);
  cursor            : pointer;
  line-height       : 1;
  transition        : background 0.12s ease, color 0.12s ease, border-color 0.12s ease;
  flex-shrink       : 0;
}

.panel-ctrl:hover {
  background        : var(--pn-ctrl-hover);
  color             : var(--pn-accent);
  border-color      : rgba(255,255,255,0.18);
}

.panel-ctrl:active {
  background        : var(--pn-ctrl-active);
}

/* Close — subtle red tint on hover */
.panel-ctrl--close:hover {
  background        : rgba(255, 80, 80, 0.14);
  border-color      : rgba(255, 80, 80, 0.30);
  color             : rgba(255, 150, 150, 0.90);
}

/* Pocket attach — subtle accent tint on hover */
.panel-ctrl--attach:hover {
  background        : rgba(255, 255, 255, 0.10);
  border-color      : rgba(255, 255, 255, 0.30);
  color             : var(--pn-accent);
}

/* Active (attached) state on ⟐ button */
.panel-ctrl--attach.is-active {
  background        : rgba(255, 255, 255, 0.14);
  border-color      : rgba(255, 255, 255, 0.35);
  color             : var(--pn-accent);
}

/* ── Scrollable body — content slot ───────────────────────────────────────── */

.panel-body {
  flex              : 1 1 auto;
  overflow-y        : auto;
  overflow-x        : hidden;
  padding           : 12px;
  position          : relative;

  scrollbar-width   : thin;
  scrollbar-color   : rgba(255,255,255,0.08) transparent;
}

.panel-body::-webkit-scrollbar       { width: 3px; }
.panel-body::-webkit-scrollbar-track { background: transparent; }
.panel-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 2px; }

/* ── Placeholder content — removed when system injects its UI ─────────────── */

.panel-placeholder {
  display           : flex;
  flex-direction    : column;
  align-items       : center;
  justify-content   : center;
  height            : 100%;
  gap               : 10px;
  pointer-events    : none;
}

.panel-placeholder-glyph {
  font-size         : 28px;
  color             : rgba(255,255,255,0.08);
  line-height       : 1;
}

.panel-placeholder-label {
  font-size         : 9px;
  color             : var(--pn-text-muted);
  text-transform    : uppercase;
  letter-spacing    : 0.14em;
}

/* ── Footer ───────────────────────────────────────────────────────────────── */

.panel-footer {
  flex-shrink       : 0;
  height            : 26px;
  padding           : 0 14px;
  display           : flex;
  align-items       : center;
  border-top        : 1px solid var(--pn-separator);
  gap               : 8px;
}

.panel-state-badge {
  font-size         : 8px;
  color             : var(--pn-text-muted);
  text-transform    : uppercase;
  letter-spacing    : 0.10em;
}

.panel-hand-badge {
  font-size         : 8px;
  color             : var(--pn-text-muted);
  margin-left       : auto;
  letter-spacing    : 0.05em;
}

/* ── Glitch scan line (visual artefact overlay) ───────────────────────────── */

.panel-glitch-line {
  position          : absolute;
  left              : 0;
  width             : 100%;
  height            : 2px;
  background        : rgba(255,255,255,0.35);
  pointer-events    : none;
  z-index           : 10;
  opacity           : 0;
}

/* ── Mobile ───────────────────────────────────────────────────────────────── */

@media (max-width: 560px) {
  .omni-panel {
    width           : min(${PANEL_W}px, 92vw);
    height          : min(${PANEL_H}px, 55vh);
  }
}

`

// ── Style injection ───────────────────────────────────────────────────────────

function injectStyles () {
  if (document.getElementById('omni-panel-styles')) return
  const tag = document.createElement('style')
  tag.id          = 'omni-panel-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

// ── Glitch sequence ───────────────────────────────────────────────────────────

/**
 * Plays a rapid jitter sequence on `el`, then resolves.
 * Returns a GSAP Timeline. Chain `.then(onComplete)` via the timeline's
 * `eventCallback('onComplete', fn)` or use the returned promise.
 *
 * @param {HTMLElement} el
 * @returns {Promise<void>}
 */
function glitch (el) {
  return new Promise(resolve => {
    const line = el.querySelector('.panel-glitch-line')

    const tl = gsap.timeline({ onComplete: resolve })

    // Jitter x + opacity flicker
    tl.to(el, { x: -4, duration: 0.035, ease: 'none' })
      .to(el, { x:  5, duration: 0.030, ease: 'none' })
      .to(el, { x: -2, opacity: 0.6, duration: 0.025, ease: 'none' })
      .to(el, { x:  3, opacity: 0.9, duration: 0.020, ease: 'none' })
      .to(el, { x:  0, opacity: 1,   duration: 0.035, ease: 'power1.out' })

    // Scan line swipe (if element present)
    if (line) {
      gsap.fromTo(line,
        { top: '-2px', opacity: 0.9 },
        { top: '100%', opacity: 0, duration: GLITCH_DUR, ease: 'power1.in' }
      )
    }
  })
}

// ── Panel class ───────────────────────────────────────────────────────────────

export default class Panel {

  /**
   * @param {object} context   — { scene, camera, renderer, sizes, ticker, Sound }
   * @param {string} panelId   — 'lh' | 'rh'  or a custom config object
   */
  constructor (context, panelId) {
    const cfg = typeof panelId === 'string'
      ? PANEL_CONFIGS[panelId]
      : panelId

    if (!cfg) {
      throw new Error(`Panel: unknown id "${panelId}". Use 'lh' | 'rh' or pass a config object.`)
    }

    this.ctx   = context
    this.cfg   = cfg
    this._el   = null
    this._state = STATE.CLOSED

    // Drag state for attached (floating) panels
    this._drag = { active: false, startX: 0, startY: 0, originX: 0, originY: 0 }

    // Bound handler refs for cleanup
    this._onHamburger = null
    this._onRestore   = null
  }

  // ── Module contract ──────────────────────────────────────────────────────

  init () {
    injectStyles()
    this._buildDOM()
    this._bindControls()
    this._bindDrag()
    this._listen()
  }

  update (_delta) {}

  destroy () {
    if (this._el?.parentNode) this._el.parentNode.removeChild(this._el)
    window.removeEventListener('omni:hamburger',     this._onHamburger)
    window.removeEventListener('omni:panel-restore', this._onRestore)
  }

  // ── Public API ───────────────────────────────────────────────────────────

  get state ()  { return this._state }
  get isOpen () { return this._state === STATE.OPEN }

  /** Slide in with glitch intro. No-op if already open. */
  async open () {
    if (this._state === STATE.OPEN) return

    this._state = STATE.OPEN
    this._updateStateBadge()

    const offX = this.cfg.dir === 'left' ? '-100%' : '100%'

    this._el.style.visibility = 'visible'
    gsap.set(this._el, { x: offX, opacity: 1 })

    // Slide in, then glitch
    await new Promise(r => gsap.to(this._el, {
      x: '0%', duration: SLIDE_DUR, ease: 'power3.out', onComplete: r
    }))
    await glitch(this._el)

    this._playSound('open')
  }

  /** Glitch out, then slide away. */
  async close () {
    if (this._state === STATE.CLOSED) return

    await glitch(this._el)

    const offX = this.cfg.dir === 'left' ? '-100%' : '100%'

    await new Promise(r => gsap.to(this._el, {
      x: offX, duration: SLIDE_DUR * 0.85, ease: 'power2.in', onComplete: r
    }))

    this._el.style.visibility = 'hidden'
    gsap.set(this._el, { x: offX })

    this._state = STATE.CLOSED
    this._updateStateBadge()
    this._syncHandButton(false)
    this._playSound('close')

    window.dispatchEvent(new CustomEvent('omni:panel-closed', {
      detail: { id: this.cfg.id }
    }))
  }

  /** Glitch → collapse to ⟐ icon. PanelIcon.js creates the draggable icon. */
  async minimize () {
    if (this._state === STATE.MINIMIZED) return

    await glitch(this._el)

    // Capture position before hiding — PanelIcon uses this to place the icon
    const rect = this._el.getBoundingClientRect()

    gsap.to(this._el, {
      scale  : 0.85,
      opacity: 0,
      duration: 0.18,
      ease   : 'power2.in',
      onComplete: () => {
        this._el.style.visibility = 'hidden'
        gsap.set(this._el, { scale: 1, opacity: 1 })
      }
    })

    this._state = STATE.MINIMIZED
    this._updateStateBadge()
    this._syncHandButton(false)
    this._playSound('close')

    // Notify PanelIcon.js to spawn the freeform icon
    window.dispatchEvent(new CustomEvent('omni:panel-minimized', {
      detail: {
        id        : this.cfg.id,
        label     : this.cfg.label,
        iconLabel : this.cfg.iconLabel,
        fromRect  : { x: rect.left, y: rect.top, w: rect.width, h: rect.height },
      }
    }))
  }

  /**
   * Detach from corner anchor → floating window.
   * Phase 4 wires this to the Three.js camera for XR follow.
   */
  async attach () {
    const wasAttached = this._state === STATE.ATTACHED

    if (wasAttached) {
      // Toggle off — snap back to corner
      this._el.classList.remove('is-attached')
      this._el.querySelector('.panel-ctrl--attach')?.classList.remove('is-active')

      const offX = this.cfg.dir === 'left' ? '-100%' : '100%'
      gsap.set(this._el, { clearProps: 'left,right,top,transform' })
      this._el.style.visibility = 'visible'

      await new Promise(r => gsap.fromTo(this._el,
        { x: offX },
        { x: '0%', duration: SLIDE_DUR, ease: 'power3.out', onComplete: r }
      ))

      await glitch(this._el)
      this._state = STATE.OPEN
      this._updateStateBadge()
      this._playSound('open')

    } else {
      await glitch(this._el)

      this._state = STATE.ATTACHED
      this._el.classList.add('is-attached')
      this._el.querySelector('.panel-ctrl--attach')?.classList.add('is-active')
      this._el.style.visibility = 'visible'

      this._updateStateBadge()
      this._playSound('open')

      window.dispatchEvent(new CustomEvent('omni:panel-attached', {
        detail: { id: this.cfg.id }
      }))
    }
  }

  /** Re-open after minimize/dock. Called by PanelIcon click or Dock restore. */
  async restore () {
    if (this._state === STATE.OPEN) return
    await this.open()
    this._syncHandButton(true)
  }

  // ── DOM ──────────────────────────────────────────────────────────────────

  _buildDOM () {
    const el = document.createElement('div')
    el.id        = `omni-panel-${this.cfg.id}`
    el.className = `omni-panel omni-panel--${this.cfg.dir}`
    el.dataset.panelId = this.cfg.id

    el.innerHTML = /* html */`

      <!-- Glitch scan line overlay -->
      <div class="panel-glitch-line" aria-hidden="true"></div>

      <!-- Header — title + controls -->
      <div class="panel-header">
        <span class="panel-title">${this.cfg.title}</span>
        <div class="panel-controls" role="toolbar" aria-label="Panel controls">
          <button class="panel-ctrl panel-ctrl--attach" data-action="attach"
                  title="⟐ Pocket Attach — detach from corner"
                  aria-label="Pocket attach">⟐</button>
          <button class="panel-ctrl panel-ctrl--minimize" data-action="minimize"
                  title="_ Minimize — collapse to icon"
                  aria-label="Minimize">_</button>
          <button class="panel-ctrl panel-ctrl--close" data-action="close"
                  title="✕ Close panel"
                  aria-label="Close">✕</button>
        </div>
      </div>

      <!-- Content slot — populated by Phase 4 systems -->
      <div class="panel-body" id="panel-body-${this.cfg.id}" data-slot="${this.cfg.id}">
        <div class="panel-placeholder">
          <span class="panel-placeholder-glyph">${this.cfg.label}</span>
          <span class="panel-placeholder-label">panel content — phase 4</span>
        </div>
      </div>

      <!-- Footer — state badge -->
      <div class="panel-footer">
        <span class="panel-state-badge" id="panel-state-${this.cfg.id}">${this._state}</span>
        <span class="panel-hand-badge">${this.cfg.title}</span>
      </div>

    `

    // Set initial off-screen x without animation
    const offX = this.cfg.dir === 'left' ? '-100%' : '100%'
    gsap.set(el, { x: offX })

    this._el = el

    const shell = document.getElementById('omni-ui')
    const mount = shell ?? document.body
    mount.appendChild(el)
  }

  // ── Control button clicks ─────────────────────────────────────────────────

  _bindControls () {
    this._el.querySelector('.panel-controls').addEventListener('click', (e) => {
      const btn = e.target.closest('.panel-ctrl')
      if (!btn) return
      const action = btn.dataset.action

      this._playSound('click')

      switch (action) {
        case 'close':    this.close();    break
        case 'minimize': this.minimize(); break
        case 'attach':   this.attach();   break
      }
    })
  }

  // ── Drag — attached floating panels ──────────────────────────────────────

  _bindDrag () {
    const header = this._el.querySelector('.panel-header')

    const onMove = (e) => {
      if (!this._drag.active) return
      const cx = e.touches ? e.touches[0].clientX : e.clientX
      const cy = e.touches ? e.touches[0].clientY : e.clientY
      const dx = cx - this._drag.startX
      const dy = cy - this._drag.startY
      gsap.set(this._el, {
        left: this._drag.originX + dx,
        top : this._drag.originY + dy,
      })
    }

    const onUp = () => {
      this._drag.active = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup',   onUp)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend',  onUp)
    }

    const onDown = (e) => {
      if (this._state !== STATE.ATTACHED) return
      const cx = e.touches ? e.touches[0].clientX : e.clientX
      const cy = e.touches ? e.touches[0].clientY : e.clientY
      const rect = this._el.getBoundingClientRect()

      this._drag = {
        active : true,
        startX : cx,
        startY : cy,
        originX: rect.left,
        originY: rect.top,
      }

      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup',   onUp)
      window.addEventListener('touchmove', onMove, { passive: true })
      window.addEventListener('touchend',  onUp)
    }

    header.addEventListener('mousedown',  onDown)
    header.addEventListener('touchstart', onDown, { passive: true })
  }

  // ── Event listeners ───────────────────────────────────────────────────────

  _listen () {
    // Hand ☰ button dispatches omni:hamburger — open/close this panel
    this._onHamburger = (e) => {
      const d = e.detail
      if (!d || d.hand !== this.cfg.hand || d.type !== 'panel') return
      if (d.open && this._state !== STATE.OPEN)  this.open()
      if (!d.open && this._state === STATE.OPEN) this.close()
    }

    // Dock icon click or PanelIcon click dispatches omni:panel-restore
    this._onRestore = (e) => {
      if (e.detail?.id === this.cfg.id) this.restore()
    }

    window.addEventListener('omni:hamburger',     this._onHamburger)
    window.addEventListener('omni:panel-restore', this._onRestore)
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  _updateStateBadge () {
    const badge = this._el?.querySelector(`#panel-state-${this.cfg.id}`)
    if (badge) badge.textContent = this._state
  }

  /** Re-emit omni:hamburger so Hand.js can sync its ☰ active state. */
  _syncHandButton (open) {
    window.dispatchEvent(new CustomEvent('omni:hamburger', {
      detail: {
        hand : this.cfg.hand,
        type : 'panel',
        dir  : this.cfg.dir,
        open,
      }
    }))
  }

  _playSound (id) {
    try {
      const Sound = this.ctx?.Sound
      if (Sound && typeof Sound.play === 'function') Sound.play(id)
    } catch (_) {}
  }
}

// ── Factory ───────────────────────────────────────────────────────────────────

/**
 * Create both ⟐LH and ⟐RH panels.
 * Returns { lh, rh } — call .init() on each.
 *
 * @param {object} context
 * @returns {{ lh: Panel, rh: Panel }}
 */
export function createPanels (context) {
  return {
    lh: new Panel(context, 'lh'),
    rh: new Panel(context, 'rh'),
  }
}

// ── Re-export state enum for external use ─────────────────────────────────────
export { STATE as PanelState }
