/**
 * ui/OmniKeyCryptxReveal.js — CryptxMode: the presentation keyboard
 *
 * A genuinely new, from-scratch keyboard — NOT a third view of
 * ui/OmniKeys.js's existing QWERTY/OmniKryptx toggle, even though both
 * end up looking "vertical." Built specifically for mouse-only control
 * from a TV/classroom presentation setup (the stated use case: a
 * Logitech MX Ergo standing in for both the OS pointer and the only
 * input device in reach).
 *
 * Opened from ui/OmniQuickLauncher.js's "⟐Keyboard" radial option, not
 * from OmniKeys' own panel chrome. Docks at the right edge, starting
 * collapsed to just a meta header; each "reveal" press exposes one more
 * full vertical column of characters, pulling the panel further left.
 * Each column scrolls independently if it's taller than the available
 * height ("if the panel window is smaller than we scroll the vertical
 * column to find the character").
 *
 * ─────────────────────────────────────────────────────────────────────
 * MX Ergo mapping (mode-scoped — this is the whole point of the build)
 * ─────────────────────────────────────────────────────────────────────
 *
 *   Native back/forward buttons (mousedown/up e.button === 3 / 4 — the
 *   MX Ergo's dedicated top/bottom arrow buttons, read directly as real
 *   mouse buttons, no OS-level remap to keystrokes required):
 *     - CryptxMode CLOSED → acts as R/F height control, by dispatching
 *       the exact same synthetic KeyboardEvent('keydown'/'keyup') shape
 *       MovementPad already listens for globally — no MovementPad
 *       changes needed, this just drives its existing input path.
 *     - CryptxMode OPEN   → reveal (button 3) / retract (button 4) one
 *       vertical column instead. The two meanings never fight over the
 *       same press because this module is the single owner of both
 *       branches and checks its own `_open` state before choosing.
 *
 *   Known limitation, stated plainly rather than hidden: some browser/
 *   OS combinations intercept these buttons as real page Back/Forward
 *   navigation before JS ever sees a mousedown event, especially
 *   outside a fullscreen/kiosk window. preventDefault() is called every
 *   time regardless, but if navigation still wins on a given machine,
 *   the fallback is remapping those two physical buttons to literal
 *   keystrokes via the mouse's own driver software (e.g. Logitech
 *   Options) instead of relying on this direct-read path.
 *
 *   Scroll wheel   → moves the selection up/down within the currently
 *                    active column (the most recently revealed one).
 *   Left click     → commits (types) the highlighted character.
 *   Right click     → retracts one column (same as button 4, for any
 *                    mouse without dedicated back/forward buttons).
 *   Middle click    → closes CryptxMode entirely.
 *
 * Typing itself reuses ui/OmniKeys.js's own exported classifyChar() /
 * computeCode() helpers so a committed character produces the exact
 * same shape of synthetic KeyboardEvent OmniKeys already dispatches —
 * any focused input or app-level keydown handler sees no difference
 * between the two keyboards.
 *
 * ─────────────────────────────────────────────────────────────────────
 * Scope, stated directly rather than silently decided
 * ─────────────────────────────────────────────────────────────────────
 *
 *   Lowercase only — no Shift/Caps layer in this first build. A
 *   presentation keyboard's real job is short labels/search terms, not
 *   full-case text editing; adding a Shift column later is a single
 *   new column entry away if that turns out to matter.
 *
 * ─────────────────────────────────────────────────────────────────────
 * V192: working buttons, drawer arrows at the bottom, drag grip on the left
 * ─────────────────────────────────────────────────────────────────────
 *
 *   ROOT CAUSE of "the buttons do not work": #omni-ui is pointer-events:none (so the 3D canvas stays interactive) and children inherit
 *   it; .ocx-panel never set pointer-events:auto, so no click ever reached a key, the close button or the nudge arrows (the same bug the
 *   V190 compass had). The panel now takes the pointer itself.
 *
 *   DRAWER   The panel is a drawer on the right edge. Two chevrons on the BOTTOM edge of the panel (not the top): ◂ pulls the next
 *            column OUT (slides in from the edge), ▸ pushes the last one back IN. The keys are the same columns as before.
 *   GRIP     A vertical grip strip on the LEFT edge of the panel is the drag handle (mouse, finger, or its arrow keys). Dragging never
 *            presses a key. The panel stays inside the viewport (re-clamped on resize and whenever a column opens).
 *   STATE    omni:cryptx-keyboard:pos-v1 = { v: 1, x, y, revealed, open } (validated on load; the old ...:offset key still seeds x).
 *   KEYS     A key click dispatches keydown / keyup on the focused text field (or <body>) and, when nothing prevented the keydown and a
 *            text field has the focus, types the character into it (pressing a key does not steal the focus from the field).
 *   WHEEL    The wheel moves the selection only while the pointer is over the panel (it used to be captured everywhere while open).
 *
 * ─────────────────────────────────────────────────────────────────────
 * Events consumed
 * ─────────────────────────────────────────────────────────────────────
 *
 *   omni:cryptx-keyboard-toggle  →  open if closed, close if open
 */

import gsap from 'gsap'
import { classifyChar, computeCode } from './OmniKeys.js'

// ── Column data ────────────────────────────────────────────────────────────
//
// Ordered nearest-the-edge-first — column 0 is revealed by the very
// first "pull out" press and stays docked against the right edge;
// each later column appends further left. Control is first on purpose:
// Space/Backspace/Enter are the highest-frequency actions in a live
// presentation and should need the fewest pulls to reach.

function charItems (str) {
  return str.split('').map(ch => ({ char: ch, label: ch }))
}

const COLUMNS = [
  {
    id: 'control', label: 'CTRL',
    items: [
      { char: ' ', label: 'SPACE', classType: 'space' },
      { char: 'Backspace', label: '⌫', classType: 'function' },
      { char: 'Enter', label: '⏎', classType: 'function' },
    ],
  },
  { id: 'row1', label: 'ROW 1', items: charItems('qwertyuiop') },
  { id: 'row2', label: 'ROW 2', items: charItems('asdfghjkl') },
  { id: 'row3', label: 'ROW 3', items: charItems('zxcvbnm') },
  { id: 'digits', label: 'DIGITS', items: charItems('1234567890') },
  { id: 'symbols', label: 'SYMB', items: charItems('!@#$%^&*()-_=+[]{};:\'",.<>/?\\|~`') },
]

// ── Layout constants ─────────────────────────────────────────────────────

const HEADER_W = 90
const COL_W    = 64
const TOP_OFF  = 110
const BOTTOM_OFF = 70

// ── Drag / drawer state ──────────────────────────────────────────────────
const GRIP_W       = 20   // px, the drag strip on the panel's left edge
const GRIP_STEP    = 24   // px per arrow key on the focused grip
const OFFSET_STORE_KEY = 'omni:cryptx-keyboard:offset'   // V191 and earlier: how far the panel was nudged out from the edge (still read once)
export const POS_STORE_KEY = 'omni:cryptx-keyboard:pos-v1'
export const MAX_REVEAL = 6                               // = COLUMNS.length
const TEXT_TYPES = new Set(['text', 'search', 'url', 'tel', 'password', 'email'])

const finite = (v) => typeof v === 'number' && Number.isFinite(v)
/** Validated stored state: { x, y, revealed, open } (any bad field -> its default). Pure; exported for tests. */
export function parseState (text, legacyOffset = 0) {
  let o = null
  try { o = typeof text === 'string' && text ? JSON.parse(text) : null } catch (_) { o = null }
  const ok = o && typeof o === 'object' && !Array.isArray(o)
  const get = (k) => (ok && Object.prototype.hasOwnProperty.call(o, k) ? o[k] : undefined)
  const x = get('x'), y = get('y'), r = get('revealed'), open = get('open')
  return {
    x: finite(x) ? Math.max(0, Math.min(4000, x)) : (finite(legacyOffset) && legacyOffset > 0 ? Math.min(4000, legacyOffset) : 0),
    y: finite(y) ? Math.max(-2000, Math.min(2000, y)) : 0,
    revealed: finite(r) ? Math.max(0, Math.min(MAX_REVEAL, Math.round(r))) : 0,
    open: open === true,
  }
}

const STYLES = /* css */`

.ocx-panel {
  position         : fixed;
  top              : calc(var(--omni-top-stack, ${TOP_OFF - 8}px) + 8px);   /* under the bar + ribbon (+ the top hands banner), not over them */
  bottom           : calc(var(--omni-dock-stack-h, 52px) + 18px);
  right            : 0;
  display          : flex;
  flex-direction   : column;
  z-index          : 57;
  pointer-events   : auto;            /* #omni-ui is pointer-events:none and children inherit it: the panel must take the pointer itself */
  font-family      : 'Courier New', Courier, monospace;
  user-select      : none;
  -webkit-user-select: none;
}

.ocx-body {
  flex             : 1 1 auto;
  min-height       : 0;
  display          : flex;
  flex-direction   : row-reverse;
}

.ocx-header {
  flex             : 0 0 ${HEADER_W}px;
  width            : ${HEADER_W}px;
  background       : rgba(10, 10, 14, 0.90);
  border           : 1px solid rgba(255, 255, 255, 0.55);
  border-right     : none;
  border-bottom    : none;
  display          : flex;
  flex-direction   : column;
  align-items      : center;
  justify-content  : flex-start;
  padding-top      : 10px;
  gap              : 8px;
  color            : rgba(255, 255, 255, 0.92);
}

.ocx-title {
  font-size        : 11px;
  letter-spacing   : 0.08em;
}

.ocx-close {
  width            : 28px;
  height           : 28px;
  border-radius    : 50%;
  border           : 1px solid rgba(255, 255, 255, 0.35);
  background       : rgba(255, 255, 255, 0.06);
  color            : rgba(255, 255, 255, 0.85);
  cursor           : pointer;
  font-size        : 14px;
  display          : flex;
  align-items      : center;
  justify-content  : center;
  padding          : 0;
}
.ocx-close:hover { background: rgba(255, 255, 255, 0.16); }

.ocx-hint {
  font-size        : 8px;
  color            : rgba(255, 255, 255, 0.55);
  text-align       : center;
  padding          : 0 6px;
  line-height      : 1.4;
}

/* ── Drag grip: a vertical strip on the LEFT edge of the whole panel ─────── */
.ocx-grip {
  flex             : 0 0 ${GRIP_W}px;
  width            : ${GRIP_W}px;
  padding          : 0;
  border           : 1px solid rgba(255, 255, 255, 0.40);
  border-right     : none;
  border-bottom    : none;
  border-radius    : 8px 0 0 0;
  background       : rgba(30, 30, 40, 0.92);
  color            : rgba(255, 255, 255, 0.55);
  cursor           : grab;
  touch-action     : none;
  display          : flex;
  align-items      : center;
  justify-content  : center;
  font-size        : 14px;
  line-height      : 1;
  writing-mode     : vertical-rl;
  letter-spacing   : 2px;
}
.ocx-grip:hover, .ocx-grip:focus-visible { background: rgba(255, 255, 255, 0.16); color: #fff; outline: none; }
.ocx-panel.is-dragging .ocx-grip { cursor: grabbing; background: rgba(255, 255, 255, 0.24); color: #fff; }
.ocx-panel.is-dragging { opacity: 0.92; }

/* ── Drawer arrows: on the BOTTOM edge of the panel ─────────────────────── */
.ocx-foot {
  flex             : 0 0 auto;
  display          : flex;
  align-items      : center;
  justify-content  : center;
  gap              : 8px;
  padding          : 5px 8px;
  background       : rgba(10, 10, 14, 0.92);
  border           : 1px solid rgba(255, 255, 255, 0.40);
  border-top       : 1px solid rgba(255, 255, 255, 0.18);
  border-right     : none;
  color            : rgba(255, 255, 255, 0.8);
  font-size        : 10px;
}
.ocx-drawer {
  min-width        : 40px;
  height           : 30px;
  border-radius    : 6px;
  border           : 1px solid rgba(255, 255, 255, 0.35);
  background       : rgba(255, 255, 255, 0.07);
  color            : rgba(255, 255, 255, 0.92);
  cursor           : pointer;
  font-size        : 16px;
  line-height      : 1;
  display          : flex;
  align-items      : center;
  justify-content  : center;
  padding          : 0 8px;
}
.ocx-drawer:hover:not(:disabled) { background: rgba(255, 255, 255, 0.2); color: #fff; }
.ocx-drawer:disabled { opacity: 0.30; cursor: default; }
.ocx-count { min-width: 28px; text-align: center; opacity: 0.8; }

.ocx-column {
  flex             : 0 0 ${COL_W}px;
  width            : ${COL_W}px;
  background       : rgba(10, 10, 14, 0.82);
  border-top       : 1px solid rgba(255, 255, 255, 0.30);
  display          : flex;
  flex-direction   : column;
  overflow         : hidden;
}

.ocx-column.is-active { border-top-color: rgba(255,255,255,0.80); }

.ocx-column-label {
  flex-shrink      : 0;
  font-size        : 7px;
  letter-spacing   : 0.06em;
  color            : rgba(255, 255, 255, 0.55);
  text-align       : center;
  padding          : 6px 0;
  border-bottom    : 1px solid rgba(255, 255, 255, 0.10);
}

.ocx-column-items {
  flex             : 1 1 auto;
  overflow-y       : auto;
  display          : flex;
  flex-direction   : column;
  scrollbar-width  : thin;
}

.ocx-item {
  flex-shrink      : 0;
  height           : 38px;
  display          : flex;
  align-items      : center;
  justify-content  : center;
  color            : rgba(255, 255, 255, 0.85);
  font-size        : 13px;
  cursor           : pointer;
  border-bottom    : 1px solid rgba(255, 255, 255, 0.05);
}
.ocx-item:hover { background: rgba(255, 255, 255, 0.08); }
.ocx-item.is-selected {
  background       : rgba(255, 255, 255, 0.20);
  color            : #fff;
  text-shadow      : 0 0 8px rgba(255,255,255,0.6);
}
.ocx-item.is-pressed { background: rgba(120, 220, 255, 0.45); color: #fff; }

@media (max-width: 460px) {
  .ocx-header { flex-basis: 70px; width: 70px; }
  .ocx-column { flex-basis: 48px; width: 48px; }
  .ocx-item { height: 42px; }
}

`

function injectStyles () {
  if (document.getElementById('omni-cryptx-styles')) return
  const tag = document.createElement('style')
  tag.id = 'omni-cryptx-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

export default class OmniKeyCryptxReveal {

  constructor (context) {
    this.ctx = context
    this._open = false
    this._revealedCount = 0
    this._selected = {} // per-column id -> index, remembered across retract/re-reveal
    this._el = null
    this._columnEls = []
    const st = this._loadState()
    this._x = st.x                    // px the panel is pulled left of the right edge
    this._y = st.y                    // px the panel is moved down (+) / up (-) from its docked row
    this._savedReveal = st.revealed
    this._savedOpen = st.open
    this._drag = null

    this._onToggleEvent = () => this.toggle()
    this._onWheel        = this._handleWheel.bind(this)
    this._onContextMenu  = this._handleContextMenu.bind(this)
    this._onAuxClick     = this._handleAuxClick.bind(this)
    this._onMouseDownGlobal = this._handleMouseDownGlobal.bind(this)
    this._onMouseUpGlobal   = this._handleMouseUpGlobal.bind(this)
    this._onResizeWin    = () => this._applyPos()
    this._onDragMove     = (e) => this._dragMove(e)
    this._onDragEnd      = (e) => this._dragEnd(e)
  }

  init () {
    injectStyles()
    window.addEventListener('omni:cryptx-keyboard-toggle', this._onToggleEvent)
    // Global native-button listeners live for the module's whole life,
    // not just while open — see the mode-scoped mapping in the header
    // comment. They're harmless no-ops for every ordinary mouse.
    window.addEventListener('mousedown', this._onMouseDownGlobal)
    window.addEventListener('mouseup',   this._onMouseUpGlobal)
    window.addEventListener('resize',    this._onResizeWin)
    if (this._savedOpen) { this._openPanel(); this._setRevealed(this._savedReveal, false) }   // V192: it comes back the way it was left
    console.log('⟐ OmniKeyCryptxReveal: initialized.')
  }

  destroy () {
    this._dragEnd(null, true)
    this._close(true)
    window.removeEventListener('omni:cryptx-keyboard-toggle', this._onToggleEvent)
    window.removeEventListener('mousedown', this._onMouseDownGlobal)
    window.removeEventListener('mouseup',   this._onMouseUpGlobal)
    window.removeEventListener('resize',    this._onResizeWin)
    document.getElementById('omni-cryptx-styles')?.remove()
  }

  onResize () { this._applyPos() }

  toggle () {
    this._open ? this._close() : this._openPanel()
  }

  get isOpen () { return this._open }
  get revealed () { return this._revealedCount }
  getPosition () { return { x: this._x, y: this._y } }

  // ── Open / close ─────────────────────────────────────────────────────────

  _openPanel () {
    if (this._open) return
    this._open = true
    this._revealedCount = this._savedReveal
    this._build()
    this._saveState()
  }

  _close (quiet = false) {
    if (!this._open) return
    this._open = false
    this._el?.parentNode?.removeChild(this._el)
    this._el = null
    this._columnEls = []
    window.removeEventListener('wheel', this._onWheel)
    if (!quiet) this._saveState()
  }

  // ── Build ────────────────────────────────────────────────────────────────

  _build () {
    const shell = document.getElementById('omni-ui') ?? document.body
    const el = document.createElement('div')
    el.className = 'ocx-panel'
    el.setAttribute('role', 'group'); el.setAttribute('aria-label', 'CryptX keyboard')
    el.addEventListener('contextmenu', this._onContextMenu)
    el.addEventListener('auxclick', this._onAuxClick)
    // pressing a key must not take the focus away from the text field being typed into
    el.addEventListener('mousedown', (e) => { if (!e.target.closest('.ocx-grip') && !e.target.closest('button')) e.preventDefault() })

    const body = document.createElement('div')
    body.className = 'ocx-body'

    const header = document.createElement('div')
    header.className = 'ocx-header'
    header.innerHTML = `
      <span class="ocx-title">⟐Keyboard</span>
      <span class="ocx-hint">Click a key to type<br>Wheel: move<br>R-click: back<br>M-click: close</span>
    `
    const closeBtn = document.createElement('button')
    closeBtn.type = 'button'
    closeBtn.className = 'ocx-close'
    closeBtn.textContent = '×'
    closeBtn.title = 'Close'
    closeBtn.setAttribute('aria-label', 'Close the CryptX keyboard')
    closeBtn.setAttribute('data-omni-tip', 'Close keyboard'); closeBtn.setAttribute('data-omni-tip-key', 'M-click'); closeBtn.setAttribute('data-omni-tip-desc', 'Closes the CryptX keyboard.')
    closeBtn.addEventListener('click', () => this._close())
    header.insertBefore(closeBtn, header.querySelector('.ocx-hint'))
    body.appendChild(header)

    const foot = document.createElement('div')
    foot.className = 'ocx-foot'
    foot.innerHTML = `
      <button type="button" class="ocx-drawer" data-drawer="out" aria-label="Pull the next column out" data-omni-tip="Pull a column out" data-omni-tip-key="Back button" data-omni-tip-desc="Slides the next column of keys out from the right edge.">◂</button>
      <span class="ocx-count" aria-live="polite"></span>
      <button type="button" class="ocx-drawer" data-drawer="in" aria-label="Push the last column back in" data-omni-tip="Push a column in" data-omni-tip-key="Forward button" data-omni-tip-desc="Slides the last column back in toward the right edge.">▸</button>`
    foot.querySelector('[data-drawer="out"]').addEventListener('click', () => this._reveal())
    foot.querySelector('[data-drawer="in"]').addEventListener('click', () => this._pushIn())

    el.appendChild(body)
    el.appendChild(foot)
    shell.appendChild(el)
    this._el = el
    this._body = body
    this._grip = this._buildGrip()
    this._renderColumns()
    window.addEventListener('wheel', this._onWheel, { passive: false })
  }

  /** The drag handle: a vertical strip on the LEFT edge of the panel (always the last child of the row-reverse body = leftmost). */
  _buildGrip () {
    const g = document.createElement('button')
    g.type = 'button'
    g.className = 'ocx-grip'
    g.textContent = '⋮⋮'
    g.title = 'Drag to move the keyboard'
    g.setAttribute('aria-label', 'Drag to move the keyboard (arrow keys also move it)')
    g.setAttribute('data-omni-tip', 'Move keyboard'); g.setAttribute('data-omni-tip-key', 'Drag'); g.setAttribute('data-omni-tip-desc', 'Drag this strip to move the keyboard anywhere on screen. Arrow keys move it when this strip has the focus.')
    g.addEventListener('pointerdown', (e) => this._dragStart(e))
    g.addEventListener('keydown', (e) => {
      const d = { ArrowLeft: [GRIP_STEP, 0], ArrowRight: [-GRIP_STEP, 0], ArrowUp: [0, -GRIP_STEP], ArrowDown: [0, GRIP_STEP] }[e.key]
      if (!d) return
      e.preventDefault(); e.stopPropagation()
      this._x += d[0]; this._y += d[1]; this._applyPos(); this._saveState()
    })
    return g
  }

  _renderColumns () {
    if (!this._el) return
    this._columnEls.forEach(c => c.el.remove())
    this._columnEls = []

    const visible = COLUMNS.slice(0, this._revealedCount)
    visible.forEach((col, i) => {
      const isActive = i === visible.length - 1
      if (this._selected[col.id] === undefined) this._selected[col.id] = 0

      const colEl = document.createElement('div')
      colEl.className = `ocx-column${isActive ? ' is-active' : ''}`

      const label = document.createElement('div')
      label.className = 'ocx-column-label'
      label.textContent = col.label
      colEl.appendChild(label)

      const itemsWrap = document.createElement('div')
      itemsWrap.className = 'ocx-column-items'

      const itemEls = col.items.map((item, idx) => {
        const itemEl = document.createElement('div')
        itemEl.className = `ocx-item${idx === this._selected[col.id] ? ' is-selected' : ''}`
        itemEl.textContent = item.label
        itemEl.setAttribute('role', 'button')
        itemEl.setAttribute('aria-label', item.char === ' ' ? 'Space' : item.char)
        itemEl.dataset.key = item.char
        itemEl.addEventListener('click', () => {
          this._select(col.id, idx, itemEls)
          this._commit(item)
          itemEl.classList.add('is-pressed')
          setTimeout(() => itemEl.classList.remove('is-pressed'), 140)
        })
        itemsWrap.appendChild(itemEl)
        return itemEl
      })

      colEl.appendChild(itemsWrap)
      // Appending in reveal order (0, 1, 2…) after the header gives DOM
      // order [header, col0, col1, …] in the row-reverse body, laid out
      // right-to-left: the header stays docked at the screen edge, each
      // later reveal lands further left. The grip is appended last = leftmost.
      this._body.appendChild(colEl)

      this._columnEls.push({ id: col.id, el: colEl, itemEls, col })

      const selEl = itemEls[this._selected[col.id]]
      if (selEl) selEl.scrollIntoView?.({ block: 'nearest' })
    })
    this._body.appendChild(this._grip)

    this._syncDrawer()
    // Revealing/retracting a column changes the panel's own width: re-clamp every render.
    this._applyPos()
  }

  /** Marks one item selected without rebuilding the columns (a click must not reset the scroll position of the column). */
  _select (colId, idx, itemEls) {
    this._selected[colId] = idx
    itemEls.forEach((e, k) => e.classList.toggle('is-selected', k === idx))
  }

  _syncDrawer () {
    if (!this._el) return
    const out = this._el.querySelector('[data-drawer="out"]'), inn = this._el.querySelector('[data-drawer="in"]')
    if (out) out.disabled = this._revealedCount >= COLUMNS.length
    if (inn) inn.disabled = this._revealedCount <= 0
    const c = this._el.querySelector('.ocx-count'); if (c) c.textContent = `${this._revealedCount}/${COLUMNS.length}`
  }

  // ── Position: drag from the left grip, clamped to the viewport ───────────

  /** Current total panel width — header + grip + every revealed column. */
  _panelWidth () {
    const w = this._el?.offsetWidth
    if (w > 0) return w
    const narrow = typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 460px)').matches
    return (narrow ? 70 : HEADER_W) + GRIP_W + this._revealedCount * (narrow ? 48 : COL_W)
  }

  /** Allowed x (left of the right edge) and y (up / down from the docked row) so the whole panel stays on screen. */
  _bounds () {
    const vw = window.innerWidth, vh = window.innerHeight
    const r = this._el?.getBoundingClientRect?.()
    const hasRect = r && r.height > 0
    const ay = this._appliedY || 0                                  // the translate currently on the element (r includes it)
    const baseTop = hasRect ? r.top - ay : TOP_OFF
    const baseBottom = hasRect ? r.bottom - ay : vh - BOTTOM_OFF
    return {
      xMax: Math.max(0, vw - this._panelWidth()),
      yMin: -Math.max(0, baseTop),
      yMax: Math.max(0, vh - baseBottom),
    }
  }

  _clampPos () {
    const b = this._bounds()
    this._x = Math.round(Math.min(Math.max(0, finite(this._x) ? this._x : 0), b.xMax))
    this._y = Math.round(Math.min(Math.max(b.yMin, finite(this._y) ? this._y : 0), Math.max(b.yMin, b.yMax)))
  }

  _applyPos () {
    if (!this._el) return
    this._clampPos()
    gsap.set(this._el, { x: -this._x, y: this._y })
    this._appliedY = this._y
  }

  _dragStart (e) {
    if (!this._el || e.button > 0 || this._drag) return
    e.preventDefault()
    this._drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, x0: this._x, y0: this._y, moved: false }
    this._el.classList.add('is-dragging')
    try { e.target.setPointerCapture?.(e.pointerId) } catch (_) { /* synthetic events */ }
    window.addEventListener('pointermove', this._onDragMove)
    window.addEventListener('pointerup', this._onDragEnd)
    window.addEventListener('pointercancel', this._onDragEnd)
  }

  _dragMove (e) {
    const d = this._drag; if (!d || (d.id !== undefined && e.pointerId !== undefined && e.pointerId !== d.id)) return
    d.moved = true
    this._x = d.x0 - (e.clientX - d.sx)         // moving the pointer left pulls the panel further from the right edge
    this._y = d.y0 + (e.clientY - d.sy)
    this._applyPos()
  }

  _dragEnd (e, silent = false) {
    const d = this._drag; if (!d) return
    this._drag = null
    window.removeEventListener('pointermove', this._onDragMove)
    window.removeEventListener('pointerup', this._onDragEnd)
    window.removeEventListener('pointercancel', this._onDragEnd)
    this._el?.classList.remove('is-dragging')
    if (!silent && d.moved) this._saveState()
  }

  // ── Persistence (validated; localStorage may be blocked) ────────────────

  _loadState () {
    let text = null, legacy = 0
    try { text = localStorage.getItem(POS_STORE_KEY) } catch (_) { /* blocked */ }
    try { legacy = Number(localStorage.getItem(OFFSET_STORE_KEY)) } catch (_) { /* blocked */ }
    return parseState(text, legacy)
  }

  _saveState () {
    try { localStorage.setItem(POS_STORE_KEY, JSON.stringify({ v: 1, x: this._x, y: this._y, revealed: this._revealedCount, open: this._open })) } catch (_) { /* non-fatal */ }
  }

  // ── Reveal / retract (the drawer) ────────────────────────────────────────

  _setRevealed (n, animate = true) {
    const next = Math.max(0, Math.min(COLUMNS.length, Math.round(n)))
    const grew = next > this._revealedCount
    this._revealedCount = next
    this._savedReveal = next
    this._renderColumns()
    if (grew && animate && !(typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) {
      const last = this._columnEls.at(-1)?.el
      if (last) gsap.from(last, { width: 0, flexBasis: 0, opacity: 0, duration: 0.22, ease: 'power2.out', clearProps: 'width,flexBasis,opacity', onUpdate: () => this._applyPos() })
    }
    this._saveState()
  }

  _reveal () {
    if (this._revealedCount >= COLUMNS.length) return
    this._setRevealed(this._revealedCount + 1)
  }

  /** The ▸ arrow: one column back in; with nothing pulled out it does nothing (the × closes the keyboard). */
  _pushIn () {
    if (this._revealedCount <= 0) return
    this._setRevealed(this._revealedCount - 1)
  }

  /** Right click / the forward mouse button: one column back in, and with none left the keyboard closes (unchanged from V191). */
  _retract () {
    if (this._revealedCount <= 0) { this._close(); return }
    this._setRevealed(this._revealedCount - 1)
  }

  // ── Selection / commit ───────────────────────────────────────────────────

  _activeColumn () {
    if (!this._revealedCount) return null
    return COLUMNS[this._revealedCount - 1]
  }

  _moveSelection (delta) {
    const col = this._activeColumn()
    if (!col) return
    const len = col.items.length
    const cur = this._selected[col.id] ?? 0
    this._selected[col.id] = ((cur + delta) % len + len) % len
    this._renderColumns()
  }

  /** Where a key goes: the focused text field (so its own handlers see it, like a real key), else <body>. */
  _keyTarget () {
    const a = document.activeElement
    return a && a !== document.body && !this._el?.contains(a) && this._isTextField(a) ? a : document.body
  }

  _isTextField (el) {
    const tag = String(el?.tagName || '').toUpperCase()
    if (tag === 'TEXTAREA') return !el.readOnly && !el.disabled
    return tag === 'INPUT' && TEXT_TYPES.has(String(el.type || 'text').toLowerCase()) && !el.readOnly && !el.disabled
  }

  _commit (item) {
    const classType = item.classType ?? classifyChar(item.char)
    const code = computeCode(classType, item.char)
    const target = this._keyTarget()
    const down = new KeyboardEvent('keydown', { key: item.char, code, bubbles: true, cancelable: true })
    target.dispatchEvent(down)
    // a synthetic key never types by itself: when nothing consumed it and a text field has the focus, type it there
    if (!down.defaultPrevented && target !== document.body) this._typeInto(target, item)
    target.dispatchEvent(new KeyboardEvent('keyup', { key: item.char, code, bubbles: true }))
  }

  _typeInto (field, item) {
    let start, end
    try { start = field.selectionStart; end = field.selectionEnd } catch (_) { return }
    if (start == null) return
    const fire = (type, data) => field.dispatchEvent(new window.Event('input', { bubbles: true }))
    if (item.char === 'Backspace') {
      if (start === end && start > 0) field.setRangeText('', start - 1, end, 'end')
      else if (start !== end) field.setRangeText('', start, end, 'end')
      else return
      fire()
    } else if (item.char === 'Enter') {
      if (String(field.tagName).toUpperCase() !== 'TEXTAREA') return        // a one-line field: the keydown handlers (submit) already had it
      field.setRangeText('\n', start, end, 'end'); fire()
    } else if (item.char.length === 1) {
      const max = Number(field.maxLength)
      if (max > 0 && field.value.length - (end - start) >= max) return
      field.setRangeText(item.char, start, end, 'end'); fire()
    }
  }

  _commitActive () {
    const col = this._activeColumn()
    if (!col) return
    const idx = this._selected[col.id] ?? 0
    this._commit(col.items[idx])
  }

  // ── Mouse input while open ───────────────────────────────────────────────

  _handleWheel (e) {
    if (!this._open || !this._el || !(e.target?.nodeType === 1 && this._el.contains(e.target))) return   // V192: only over the panel (it used to be taken everywhere)
    e.preventDefault()
    this._moveSelection(e.deltaY > 0 ? 1 : -1)
  }

  _handleContextMenu (e) {
    e.preventDefault()
    this._retract()
  }

  _handleAuxClick (e) {
    if (e.button === 1) { e.preventDefault(); this._close() }
  }

  // ── Native back/forward buttons — mode-scoped (see header comment) ──────

  _handleMouseDownGlobal (e) {
    if (e.button !== 3 && e.button !== 4) return
    e.preventDefault()
    if (this._open) {
      if (e.button === 3) this._reveal()
      else this._retract()
      return
    }
    // Closed — act as R/F height control via the same real keydown
    // MovementPad already listens for; zero changes needed over there.
    const key = e.button === 3 ? 'r' : 'f'
    const code = e.button === 3 ? 'KeyR' : 'KeyF'
    this._heldNativeKey = { key, code }
    window.dispatchEvent(new KeyboardEvent('keydown', { key, code, bubbles: true }))
  }

  _handleMouseUpGlobal (e) {
    if (e.button !== 3 && e.button !== 4) return
    e.preventDefault()
    if (this._open) return
    if (this._heldNativeKey) {
      window.dispatchEvent(new KeyboardEvent('keyup', { key: this._heldNativeKey.key, code: this._heldNativeKey.code, bubbles: true }))
      this._heldNativeKey = null
    }
  }
}
