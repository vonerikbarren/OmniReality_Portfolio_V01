/**
 * ui/Hand.js — ⟐mniReality Hand Component
 *
 * One reusable class instantiated four times — once per corner of the UI.
 * Each instance is a 2×2 symbol matrix anchored to its corner, sitting
 * between the Global Bar (top) / Dock (bottom) and the 3D canvas.
 *
 * ┌────┬────┐   Left hands (TL, BL)    ┌────┬────┐   Right hands (TR, BR)
 * │ ☰  │ ⚇  │                          │ ⚇  │ ☰  │
 * ├────┼────┤                          ├────┼────┤
 * │ ⦿  │ ⬢  │                          │ ⦿  │ ⬢  │
 * └────┴────┘                          └────┴────┘
 *
 * Symbol inventory:
 *   ☰  Hamburger  →  Drawer (top hands) or Panel (bottom hands) — direction per corner
 *   ⚇  Pad        →  Reveals movement/action pad — function varies per hand
 *   ⦿  Orbiter    →  Undefined — last to be specified
 *   ⬢  Tools      →  Opens radial menu diagonally toward screen centre
 *
 * The four hand identities:
 *   omnihand   ⟐mniHand        TL  App Launcher    ☰→ ⟐mniMenu (left drawer)
 *   conscious  ⟐ConsciousHand  TR  Perspectives    ☰→ ⟐NavMenu (right drawer)
 *   lh         ⟐LH             BL  Analytical      ☰→ Panel (left),  ⚇→ global pad toggle
 *   rh         ⟐RH             BR  Creative        ☰→ Panel (right)
 *
 * Events dispatched on window (Phase 3b components consume these):
 *   omni:hamburger   →  { hand, type: 'drawer'|'panel', dir: 'left'|'right', open: bool }
 *   omni:pad-toggle  →  { hand, visible: bool }
 *   omni:radial-toggle → { hand, visible: bool, radialDir: 'center-right'|'center-left' }
 *   omni:orbiter     →  { hand }   (stub — behaviour undefined)
 *
 * Active-state listening (other components call these back on the Hand):
 *   hand.setHamburgerActive(bool)
 *   hand.setPadActive(bool)
 *   hand.setRadialActive(bool)
 *
 * Usage:
 *   import Hand from './ui/Hand.js'
 *   const omniHand = new Hand(context, 'omnihand')
 *   omniHand.init()
 *
 * Follows the standard module contract (constructor / init / update / destroy).
 */

import gsap from 'gsap'

// ── Hand configuration table ──────────────────────────────────────────────────

const HAND_CONFIGS = {
  omnihand: {
    id           : 'omnihand',
    name         : '⟐mniHand',
    abbr         : '⟐H',
    corner       : 'tl',
    role         : 'App Launcher',
    hamburgerType: 'drawer',
    hamburgerDir : 'left',
    hamburgerMenu: '⟐mniMenu',
    padFunction  : 'Switch axiomatic app',
    radialDir    : 'center-right',
    topRow       : ['hamburger', 'pad'],    // left-side: ☰ outer, ⚇ inner
    bottomRow    : ['orbiter',   'radial'],
  },
  conscious: {
    id           : 'conscious',
    name         : '⟐ConsciousHand',
    abbr         : 'CH',
    corner       : 'tr',
    role         : 'Perspectives',
    hamburgerType: 'drawer',
    hamburgerDir : 'right',
    hamburgerMenu: '⟐NavMenu',
    padFunction  : 'Switch axiomatic spatial function',
    radialDir    : 'center-left',
    topRow       : ['pad', 'hamburger'],    // right-side: ⚇ inner, ☰ outer
    bottomRow    : ['orbiter', 'radial'],
  },
  lh: {
    id             : 'lh',
    name           : '⟐LH',
    abbr           : 'LH',
    corner         : 'bl',
    role           : 'Analytical',
    hamburgerType  : 'panel',
    hamburgerDir   : 'left',
    hamburgerMenu  : '⟐LH Panel',
    padFunction    : 'Global pad toggle (all corners)',
    padIsGlobalToggle: true,
    radialDir      : 'center-right',
    topRow         : ['hamburger', 'pad'],
    bottomRow      : ['orbiter',   'radial'],
  },
  rh: {
    id           : 'rh',
    name         : '⟐RH',
    abbr         : 'RH',
    corner       : 'br',
    role         : 'Creative',
    hamburgerType: 'panel',
    hamburgerDir : 'right',
    hamburgerMenu: '⟐RH Panel',
    padFunction  : 'Camera movement / look',
    radialDir    : 'center-left',
    topRow       : ['pad', 'hamburger'],
    bottomRow    : ['orbiter', 'radial'],
  },
}

// Symbol map — keys match config topRow / bottomRow entries
const SYMBOLS = {
  hamburger : { glyph: '☰',  label: 'Menu',    title: 'Open menu'        },
  pad       : { glyph: '⚇',  label: 'Pad',     title: 'Movement pad'     },
  orbiter   : { glyph: '⦿',  label: 'Orbiter', title: 'Orbiter (TBD)'    },
  radial    : { glyph: '⬢',  label: 'Tools',   title: 'Open radial menu' },
}

// Positioning constants — should match GlobalBar and Dock heights
const BAR_H  = 36   // px — GlobalBar collapsed height (Hand top offset)
const DOCK_H = 52   // px — Dock height (Hand bottom offset)
const CELL   = 44   // px — each button cell size (generous touch target)
const GAP    = 2    // px — gap between cells

// ── Stylesheet ────────────────────────────────────────────────────────────────

const STYLES = /* css */`

/* ── Hand root ───────────────────────────────────────────────────────────── */

.omni-hand {
  --hand-bg         : rgba(10, 10, 14, 0.65);
  --hand-border     : rgba(255, 255, 255, 0.07);
  --hand-cell-bg    : rgba(255, 255, 255, 0.04);
  --hand-cell-hover : rgba(255, 255, 255, 0.10);
  --hand-cell-active: rgba(255, 255, 255, 0.18);
  --hand-text       : rgba(255, 255, 255, 0.75);
  --hand-text-dim   : rgba(255, 255, 255, 0.30);
  --hand-accent     : rgba(255, 255, 255, 0.95);
  --hand-glow       : 0 0 10px rgba(255, 255, 255, 0.20);
  --hand-active-glow: 0 0 14px rgba(255, 255, 255, 0.35);
  --mono            : 'Courier New', Courier, monospace;
  --cell            : ${CELL}px;
  --gap             : ${GAP}px;

  position          : fixed;
  z-index           : 40;
  pointer-events    : auto;
  user-select       : none;

  /* The 2×2 grid */
  display           : grid;
  grid-template-columns: var(--cell) var(--cell);
  grid-template-rows   : var(--cell) var(--cell);
  gap               : var(--gap);

  /* Glass backing */
  background        : var(--hand-bg);
  backdrop-filter   : blur(14px) saturate(1.3);
  -webkit-backdrop-filter: blur(14px) saturate(1.3);
  border            : 1px solid var(--hand-border);

  -webkit-font-smoothing: antialiased;
}

/* ── Corner-specific anchoring + border-radius ───────────────────────────── */

.omni-hand--tl {
  top              : ${BAR_H}px;
  left             : 0;
  border-top       : none;
  border-left      : none;
  border-radius    : 0 0 8px 0;
}

.omni-hand--tr {
  top              : ${BAR_H}px;
  right            : 0;
  border-top       : none;
  border-right     : none;
  border-radius    : 0 0 0 8px;
}

.omni-hand--bl {
  bottom           : ${DOCK_H}px;
  left             : 0;
  border-bottom    : none;
  border-left      : none;
  border-radius    : 0 8px 0 0;
}

.omni-hand--br {
  bottom           : ${DOCK_H}px;
  right            : 0;
  border-bottom    : none;
  border-right     : none;
  border-radius    : 8px 0 0 0;
}

/* ── Cell button ─────────────────────────────────────────────────────────── */

.hand-cell {
  width            : var(--cell);
  height           : var(--cell);

  display          : flex;
  flex-direction   : column;
  align-items      : center;
  justify-content  : center;
  gap              : 2px;

  background       : var(--hand-cell-bg);
  border           : none;
  cursor           : pointer;
  position         : relative;
  overflow         : hidden;

  /* Inner borders between cells — drawn via box-shadow to avoid layout cost */
  outline          : none;
  font-family      : var(--mono);
  color            : var(--hand-text);

  transition       : background 0.15s ease;
}

.hand-cell:hover {
  background       : var(--hand-cell-hover);
}

.hand-cell:hover .hand-glyph {
  color            : var(--hand-accent);
  text-shadow      : var(--hand-glow);
}

.hand-cell:active {
  background       : var(--hand-cell-active);
}

/* Active state — cell is "on" (menu open, pad visible, radial open) */
.hand-cell.is-active {
  background       : var(--hand-cell-active);
}

.hand-cell.is-active .hand-glyph {
  color            : var(--hand-accent);
  text-shadow      : var(--hand-active-glow);
}

.hand-cell.is-active::after {
  content          : '';
  position         : absolute;
  inset            : 0;
  border           : 1px solid rgba(255, 255, 255, 0.20);
  pointer-events   : none;
}

/* Undefined cells — ⦿ Orbiter — slightly more muted */
.hand-cell--orbiter {
  cursor           : default;
  opacity          : 0.55;
}

.hand-cell--orbiter:hover {
  background       : var(--hand-cell-bg);
  cursor           : default;
}

.hand-cell--orbiter .hand-glyph {
  color            : var(--hand-text-dim);
}

/* ── Glyph + label typography ─────────────────────────────────────────────── */

.hand-glyph {
  font-size        : 15px;
  line-height      : 1;
  pointer-events   : none;
  transition       : color 0.15s ease, text-shadow 0.15s ease;
}

.hand-label {
  font-size        : 7px;
  color            : var(--hand-text-dim);
  text-transform   : uppercase;
  letter-spacing   : 0.08em;
  line-height      : 1;
  pointer-events   : none;
}

/* ── Inner border lines between cells (simulated via pseudo-elements) ──────── */

/* Vertical divider — right edge of col 0 cells */
.hand-cell:nth-child(1),
.hand-cell:nth-child(3) {
  border-right     : 1px solid rgba(255, 255, 255, 0.06);
}

/* Horizontal divider — bottom edge of row 0 cells */
.hand-cell:nth-child(1),
.hand-cell:nth-child(2) {
  border-bottom    : 1px solid rgba(255, 255, 255, 0.06);
}

/* ── Tooltip ─────────────────────────────────────────────────────────────── */

.hand-cell::before {
  content          : attr(data-tooltip);
  position         : absolute;
  background       : rgba(10, 10, 14, 0.92);
  border           : 1px solid rgba(255,255,255,0.12);
  color            : rgba(255,255,255,0.88);
  font-size        : 9px;
  font-family      : var(--mono);
  padding          : 3px 7px;
  border-radius    : 4px;
  white-space      : nowrap;
  pointer-events   : none;
  opacity          : 0;
  z-index          : 60;
  letter-spacing   : 0.05em;
  backdrop-filter  : blur(8px);
  transition       : opacity 0.15s ease, transform 0.15s ease;
}

.hand-cell:hover::before {
  opacity          : 1;
}

/* Tooltip direction per corner — keeps tooltip inside viewport */
.omni-hand--tl .hand-cell::before {
  top              : calc(100% + 5px);
  left             : 0;
  transform        : translateY(3px);
}
.omni-hand--tl .hand-cell:hover::before { transform: translateY(0); }

.omni-hand--tr .hand-cell::before {
  top              : calc(100% + 5px);
  right            : 0;
  transform        : translateY(3px);
}
.omni-hand--tr .hand-cell:hover::before { transform: translateY(0); }

.omni-hand--bl .hand-cell::before {
  bottom           : calc(100% + 5px);
  left             : 0;
  transform        : translateY(-3px);
}
.omni-hand--bl .hand-cell:hover::before { transform: translateY(0); }

.omni-hand--br .hand-cell::before {
  bottom           : calc(100% + 5px);
  right            : 0;
  transform        : translateY(-3px);
}
.omni-hand--br .hand-cell:hover::before { transform: translateY(0); }

/* ── Hand identity label (name badge below/above matrix) ─────────────────── */

.hand-name-badge {
  position         : absolute;
  font-family      : var(--mono);
  font-size        : 8px;
  color            : var(--hand-text-dim);
  letter-spacing   : 0.10em;
  white-space      : nowrap;
  pointer-events   : none;
  text-transform   : uppercase;
}

/* TL badge: below the matrix, left-aligned */
.omni-hand--tl .hand-name-badge {
  top              : 100%;
  left             : 4px;
  margin-top       : 4px;
}

/* TR badge: below the matrix, right-aligned */
.omni-hand--tr .hand-name-badge {
  top              : 100%;
  right            : 4px;
  margin-top       : 4px;
}

/* BL badge: above the matrix, left-aligned */
.omni-hand--bl .hand-name-badge {
  bottom           : 100%;
  left             : 4px;
  margin-bottom    : 4px;
}

/* BR badge: above the matrix, right-aligned */
.omni-hand--br .hand-name-badge {
  bottom           : 100%;
  right            : 4px;
  margin-bottom    : 4px;
}

/* ── Mobile scaling ──────────────────────────────────────────────────────── */

@media (max-width: 460px) {
  .omni-hand {
    --cell         : 40px;
  }
}

`

// ── Style injection (once) ────────────────────────────────────────────────────

function injectStyles () {
  if (document.getElementById('omni-hand-styles')) return
  const tag = document.createElement('style')
  tag.id          = 'omni-hand-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

// ── Hand class ────────────────────────────────────────────────────────────────

export default class Hand {

  /**
   * @param {object} context   — { scene, camera, renderer, sizes, ticker, Sound }
   * @param {string} handId    — one of: 'omnihand' | 'conscious' | 'lh' | 'rh'
   */
  constructor (context, handId) {
    if (!HAND_CONFIGS[handId]) {
      throw new Error(`Hand: unknown hand id "${handId}". Use: ${Object.keys(HAND_CONFIGS).join(', ')}`)
    }

    this.ctx    = context
    this.cfg    = HAND_CONFIGS[handId]
    this._el    = null

    // Active states — toggled by setXxxActive() or by internal click handlers
    this._hamburgerActive = false
    this._padActive       = false
    this._radialActive    = false

    // Cell element references
    this._cells = {}   // { hamburger, pad, orbiter, radial }
  }

  // ── Module contract ─────────────────────────────────────────────────────

  init () {
    injectStyles()
    this._buildDOM()
    this._bindEvents()
    this._bindGlobalListeners()
  }

  /** No per-frame work — reserved for future animated indicators. */
  update (_delta) {}

  destroy () {
    if (this._el?.parentNode) this._el.parentNode.removeChild(this._el)
    // Inline listeners were added to window — clean up
    window.removeEventListener('omni:hamburger',      this._onHamburgerExternal)
    window.removeEventListener('omni:pad-toggle',     this._onPadExternal)
    window.removeEventListener('omni:radial-toggle',  this._onRadialExternal)
    window.removeEventListener('omni:pads-global',    this._onGlobalPads)
  }

  // ── Public state setters (called by Drawer / Panel / RadialMenu) ─────────

  /** Mark the ☰ cell active (drawer/panel is open). */
  setHamburgerActive (active) {
    this._hamburgerActive = active
    this._setCellActive('hamburger', active)
  }

  /** Mark the ⚇ cell active (pad is visible). */
  setPadActive (active) {
    this._padActive = active
    this._setCellActive('pad', active)
  }

  /** Mark the ⬢ cell active (radial menu is open). */
  setRadialActive (active) {
    this._radialActive = active
    this._setCellActive('radial', active)
  }

  // ── DOM ──────────────────────────────────────────────────────────────────

  _buildDOM () {
    const cfg = this.cfg
    const el  = document.createElement('div')

    el.id        = `omni-hand-${cfg.id}`
    el.className = `omni-hand omni-hand--${cfg.corner}`
    el.setAttribute('aria-label', cfg.name)
    el.setAttribute('role', 'group')

    // Build cells in the order defined by topRow / bottomRow
    const order = [...cfg.topRow, ...cfg.bottomRow]
    order.forEach(key => {
      el.appendChild(this._buildCell(key))
    })

    // Name badge
    const badge = document.createElement('span')
    badge.className   = 'hand-name-badge'
    badge.textContent = cfg.name
    el.appendChild(badge)

    this._el = el

    const shell = document.getElementById('omni-ui')
    if (shell) shell.appendChild(el)
    else document.body.appendChild(el)
  }

  _buildCell (key) {
    const sym = SYMBOLS[key]
    const cfg = this.cfg

    const btn = document.createElement('button')
    btn.className   = `hand-cell hand-cell--${key}`
    btn.dataset.key = key
    btn.dataset.hand = cfg.id

    // Tooltip content (context-aware per hand)
    btn.dataset.tooltip = this._tooltipFor(key)

    // Orbiter is undefined — cursor: default, slightly muted
    if (key === 'orbiter') {
      btn.setAttribute('disabled', '')
      btn.setAttribute('aria-label', `${sym.label} — undefined`)
    } else {
      btn.setAttribute('aria-label', this._tooltipFor(key))
    }

    btn.innerHTML = /* html */`
      <span class="hand-glyph">${sym.glyph}</span>
      <span class="hand-label">${sym.label}</span>
    `

    this._cells[key] = btn
    return btn
  }

  // ── Click handlers ────────────────────────────────────────────────────────

  _bindEvents () {
    const el = this._el
    el.addEventListener('click', (e) => {
      const btn = e.target.closest('.hand-cell')
      if (!btn || btn.disabled) return
      const key = btn.dataset.key
      if (key) this._handleCellClick(key)
    })
  }

  _handleCellClick (key) {
    this._playSound('click')

    switch (key) {
      case 'hamburger': this._toggleHamburger(); break
      case 'pad':       this._togglePad();       break
      case 'radial':    this._toggleRadial();    break
      case 'orbiter':   this._triggerOrbiter();  break
    }
  }

  // ── Hamburger (☰) ────────────────────────────────────────────────────────

  _toggleHamburger () {
    const next = !this._hamburgerActive
    this.setHamburgerActive(next)

    this._playSound(next ? 'open' : 'close')

    window.dispatchEvent(new CustomEvent('omni:hamburger', {
      detail: {
        hand  : this.cfg.id,
        type  : this.cfg.hamburgerType,    // 'drawer' | 'panel'
        dir   : this.cfg.hamburgerDir,     // 'left' | 'right'
        menu  : this.cfg.hamburgerMenu,
        open  : next,
      }
    }))
  }

  // ── Movement pad (⚇) ─────────────────────────────────────────────────────

  _togglePad () {
    const cfg  = this.cfg
    const next = !this._padActive

    this.setPadActive(next)
    this._playSound(next ? 'open' : 'close')

    if (cfg.padIsGlobalToggle) {
      // ⟐LH ⚇: show / hide ALL movement pads across all four corners
      window.dispatchEvent(new CustomEvent('omni:pads-global', {
        detail: { visible: next, source: cfg.id }
      }))
    } else {
      window.dispatchEvent(new CustomEvent('omni:pad-toggle', {
        detail: {
          hand    : cfg.id,
          corner  : cfg.corner,
          visible : next,
          function: cfg.padFunction,
        }
      }))
    }
  }

  // ── Radial menu (⬢) ──────────────────────────────────────────────────────

  _toggleRadial () {
    const next = !this._radialActive
    this.setRadialActive(next)

    this._playSound(next ? 'open' : 'close')

    window.dispatchEvent(new CustomEvent('omni:radial-toggle', {
      detail: {
        hand      : this.cfg.id,
        abbr      : this.cfg.abbr,
        corner    : this.cfg.corner,
        radialDir : this.cfg.radialDir,
        visible   : next,
      }
    }))
  }

  // ── Orbiter (⦿) — undefined, stub only ───────────────────────────────────

  _triggerOrbiter () {
    window.dispatchEvent(new CustomEvent('omni:orbiter', {
      detail: { hand: this.cfg.id }
    }))
  }

  // ── Global listeners — react to state changes from other components ───────

  _bindGlobalListeners () {
    const id = this.cfg.id

    // Another component closed our hamburger externally
    this._onHamburgerExternal = (e) => {
      if (e.detail?.hand === id) {
        this._hamburgerActive = e.detail.open
        this._setCellActive('hamburger', e.detail.open)
      }
    }

    // Pad state changed externally (e.g. global pad toggle from LH)
    this._onPadExternal = (e) => {
      if (e.detail?.hand === id) {
        this._padActive = e.detail.visible
        this._setCellActive('pad', e.detail.visible)
      }
    }

    // Radial state changed externally
    this._onRadialExternal = (e) => {
      if (e.detail?.hand === id) {
        this._radialActive = e.detail.visible
        this._setCellActive('radial', e.detail.visible)
      }
    }

    // Global pad toggle from ⟐LH ⚇ — affects ALL pads
    this._onGlobalPads = (e) => {
      this._padActive = e.detail?.visible ?? false
      this._setCellActive('pad', this._padActive)
    }

    window.addEventListener('omni:hamburger',     this._onHamburgerExternal)
    window.addEventListener('omni:pad-toggle',    this._onPadExternal)
    window.addEventListener('omni:radial-toggle', this._onRadialExternal)
    window.addEventListener('omni:pads-global',   this._onGlobalPads)
  }

  // ── Cell active state ─────────────────────────────────────────────────────

  _setCellActive (key, active) {
    const cell = this._cells[key]
    if (!cell) return

    if (active) {
      cell.classList.add('is-active')
      // Subtle pulse on activation
      gsap.fromTo(cell,
        { scale: 0.88 },
        { scale: 1, duration: 0.22, ease: 'back.out(2)' }
      )
    } else {
      cell.classList.remove('is-active')
    }
  }

  // ── Tooltip context strings ────────────────────────────────────────────────

  _tooltipFor (key) {
    const cfg = this.cfg
    switch (key) {
      case 'hamburger':
        return `${cfg.hamburgerMenu} (${cfg.hamburgerType})`
      case 'pad':
        return cfg.padIsGlobalToggle
          ? 'Toggle all movement pads'
          : cfg.padFunction
      case 'radial':
        return `${cfg.abbr} Tools — radial menu`
      case 'orbiter':
        return '⦿ Orbiter — undefined'
      default:
        return key
    }
  }

  // ── Sound ────────────────────────────────────────────────────────────────

  _playSound (id) {
    try {
      const Sound = this.ctx?.Sound
      if (Sound && typeof Sound.play === 'function') Sound.play(id)
    } catch (_) {}
  }
}

// ── Named convenience factory ─────────────────────────────────────────────────
//
// ui/index.js can use this to create all four hands in one call:
//
//   import { createAllHands } from './Hand.js'
//   const hands = createAllHands(context)
//   Object.values(hands).forEach(h => h.init())

export function createAllHands (context) {
  return {
    omnihand : new Hand(context, 'omnihand'),
    conscious: new Hand(context, 'conscious'),
    lh       : new Hand(context, 'lh'),
    rh       : new Hand(context, 'rh'),
  }
}
