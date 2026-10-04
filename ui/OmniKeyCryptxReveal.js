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
 * Position nudge — ◂ / ▸ arrow buttons in the header
 * ─────────────────────────────────────────────────────────────────────
 *
 *   The panel docks flush against the right edge (`right: 0`) same as
 *   always. ◂ nudges it further OUT (left, away from the edge) by
 *   NUDGE_STEP px per click; ▸ nudges it back IN toward the edge. Same
 *   GSAP-offset-on-top-of-docked-position pattern as MovementPad.js's
 *   detach mechanic (ui/MovementPad.js's `_detachOffset` / `gsap.set(…,
 *   { x, y })`) rather than re-parenting or changing `right` directly —
 *   bounded to [0, _maxOffset()] so it can never push the panel's
 *   leftmost revealed column off the left edge of the viewport. The
 *   offset persists in localStorage (OFFSET_STORE_KEY), same as
 *   MovementPad.js's own detach offset — survives both re-opens and
 *   page reloads, re-clamped against the current viewport width and
 *   revealed-column count every time it's applied.
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

// ── Position-nudge constants (◂ / ▸ header buttons) ──────────────────────
const NUDGE_STEP   = 48   // px per click, away from / back toward the right edge
const EDGE_MARGIN  = 16   // px always left visible past the panel's own left edge
const OFFSET_STORE_KEY = 'omni:cryptx-keyboard:offset'

const STYLES = /* css */`

.ocx-panel {
  position         : fixed;
  top              : ${TOP_OFF}px;
  bottom           : ${BOTTOM_OFF}px;
  right            : 0;
  display          : flex;
  flex-direction   : row-reverse;
  z-index          : 57;
  font-family      : 'Courier New', Courier, monospace;
  user-select      : none;
  -webkit-user-select: none;
}

.ocx-header {
  flex             : 0 0 ${HEADER_W}px;
  width            : ${HEADER_W}px;
  background       : rgba(10, 10, 14, 0.90);
  border           : 1px solid rgba(255, 255, 255, 0.55);
  border-right     : none;
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
  width            : 24px;
  height           : 24px;
  border-radius    : 50%;
  border           : 1px solid rgba(255, 255, 255, 0.35);
  background       : rgba(255, 255, 255, 0.06);
  color            : rgba(255, 255, 255, 0.85);
  cursor           : pointer;
  font-size        : 12px;
  display          : flex;
  align-items      : center;
  justify-content  : center;
}
.ocx-close:hover { background: rgba(255, 255, 255, 0.16); }

/* ── Position-nudge arrows — move the whole docked panel further out
   from (◂) or back in toward (▸) the right edge ─────────────────────── */
.ocx-nudge-group {
  display          : flex;
  gap              : 4px;
}

.ocx-nudge {
  width            : 22px;
  height           : 20px;
  border-radius    : 4px;
  border           : 1px solid rgba(255, 255, 255, 0.30);
  background       : rgba(255, 255, 255, 0.06);
  color            : rgba(255, 255, 255, 0.80);
  cursor           : pointer;
  font-size        : 10px;
  line-height      : 1;
  display          : flex;
  align-items      : center;
  justify-content  : center;
}
.ocx-nudge:hover:not(:disabled) { background: rgba(255, 255, 255, 0.16); color: #fff; }
.ocx-nudge:disabled { opacity: 0.30; cursor: default; }

.ocx-hint {
  font-size        : 7px;
  color            : rgba(255, 255, 255, 0.45);
  text-align       : center;
  padding          : 0 6px;
  line-height      : 1.4;
}

.ocx-column {
  flex             : 0 0 ${COL_W}px;
  width            : ${COL_W}px;
  background       : rgba(10, 10, 14, 0.82);
  border-top       : 1px solid rgba(255, 255, 255, 0.30);
  border-bottom    : 1px solid rgba(255, 255, 255, 0.30);
  display          : flex;
  flex-direction   : column;
  overflow         : hidden;
}

.ocx-column.is-active { border-top-color: rgba(255,255,255,0.80); border-bottom-color: rgba(255,255,255,0.80); }

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

@media (max-width: 460px) {
  .ocx-header { flex-basis: 70px; width: 70px; }
  .ocx-column { flex-basis: 48px; width: 48px; }
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
    this._offsetX = this._loadOffset()

    this._onToggleEvent = () => this.toggle()
    this._onWheel        = this._handleWheel.bind(this)
    this._onContextMenu  = this._handleContextMenu.bind(this)
    this._onAuxClick     = this._handleAuxClick.bind(this)
    this._onMouseDownGlobal = this._handleMouseDownGlobal.bind(this)
    this._onMouseUpGlobal   = this._handleMouseUpGlobal.bind(this)
  }

  init () {
    injectStyles()
    window.addEventListener('omni:cryptx-keyboard-toggle', this._onToggleEvent)
    // Global native-button listeners live for the module's whole life,
    // not just while open — see the mode-scoped mapping in the header
    // comment. They're harmless no-ops for every ordinary mouse.
    window.addEventListener('mousedown', this._onMouseDownGlobal)
    window.addEventListener('mouseup',   this._onMouseUpGlobal)
    console.log('⟐ OmniKeyCryptxReveal: initialized.')
  }

  destroy () {
    this._close()
    window.removeEventListener('omni:cryptx-keyboard-toggle', this._onToggleEvent)
    window.removeEventListener('mousedown', this._onMouseDownGlobal)
    window.removeEventListener('mouseup',   this._onMouseUpGlobal)
  }

  toggle () {
    this._open ? this._close() : this._openPanel()
  }

  // ── Open / close ─────────────────────────────────────────────────────────

  _openPanel () {
    if (this._open) return
    this._open = true
    this._revealedCount = 0
    this._build()
  }

  _close () {
    if (!this._open) return
    this._open = false
    this._el?.parentNode?.removeChild(this._el)
    this._el = null
    this._columnEls = []
    window.removeEventListener('wheel', this._onWheel)
  }

  // ── Build ────────────────────────────────────────────────────────────────

  _build () {
    const shell = document.getElementById('omni-ui') ?? document.body
    const el = document.createElement('div')
    el.className = 'ocx-panel'
    el.addEventListener('contextmenu', this._onContextMenu)
    el.addEventListener('auxclick', this._onAuxClick)

    const header = document.createElement('div')
    header.className = 'ocx-header'
    header.innerHTML = `
      <span class="ocx-title">⟐Keyboard</span>
      <div class="ocx-nudge-group" role="group" aria-label="Move keyboard">
        <button class="ocx-nudge" data-nudge="out" title="Move further out, away from the edge">◂</button>
        <button class="ocx-nudge" data-nudge="in" title="Move back in, toward the edge">▸</button>
      </div>
      <span class="ocx-hint">Scroll: move&nbsp;·&nbsp;L-click: type&nbsp;·&nbsp;R-click: back&nbsp;·&nbsp;M-click: close</span>
    `
    header.querySelector('[data-nudge="out"]').addEventListener('click', () => this._nudge(1))
    header.querySelector('[data-nudge="in"]').addEventListener('click', () => this._nudge(-1))
    const closeBtn = document.createElement('button')
    closeBtn.className = 'ocx-close'
    closeBtn.textContent = '×'
    closeBtn.title = 'Close'
    closeBtn.addEventListener('click', () => this._close())
    header.appendChild(closeBtn)
    el.appendChild(header)

    shell.appendChild(el)
    this._el = el
    this._renderColumns()
    this._applyOffset()
    window.addEventListener('wheel', this._onWheel, { passive: false })
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
        itemEl.addEventListener('click', () => {
          this._selected[col.id] = idx
          this._commit(item)
          this._renderColumns()
        })
        itemsWrap.appendChild(itemEl)
        return itemEl
      })

      colEl.appendChild(itemsWrap)
      // Every old column was just removed above, leaving only the
      // header — appending in reveal order (0, 1, 2…) after it gives
      // DOM order [header, col0, col1, …], which row-reverse lays out
      // right-to-left exactly as intended: header stays docked at the
      // screen edge, and each later reveal lands further left of it.
      this._el.appendChild(colEl)

      this._columnEls.push({ id: col.id, el: colEl, itemEls, col })

      const selEl = itemEls[this._selected[col.id]]
      if (selEl) selEl.scrollIntoView({ block: 'nearest' })
    })

    // Revealing/retracting a column changes the panel's own width, which
    // changes how far it can be nudged out before its leftmost column
    // would run off-screen — re-clamp every render, not just on nudge.
    this._applyOffset()
  }

  // ── Position nudge (◂ / ▸) ───────────────────────────────────────────────

  /** Current total panel width — header + every revealed column. */
  _panelWidth () {
    return HEADER_W + this._revealedCount * COL_W
  }

  /** Furthest this panel can be nudged out before its left edge would
   *  pass EDGE_MARGIN px from the viewport's left edge. */
  _maxOffset () {
    return Math.max(0, window.innerWidth - this._panelWidth() - EDGE_MARGIN)
  }

  _loadOffset () {
    try {
      const raw = Number(localStorage.getItem(OFFSET_STORE_KEY))
      return Number.isFinite(raw) && raw > 0 ? raw : 0
    } catch (_) { return 0 }
  }

  _saveOffset () {
    try { localStorage.setItem(OFFSET_STORE_KEY, String(this._offsetX)) } catch (_) { /* non-fatal */ }
  }

  /** Re-applies the current (clamped) offset as a GSAP x-translate on
   *  top of the panel's docked `right: 0` position — same layering
   *  MovementPad.js uses for its own detach offset, never touching
   *  `right` itself. Also updates the ◂/▸ buttons' disabled state at
   *  the bounds. */
  _applyOffset () {
    if (!this._el) return
    const max = this._maxOffset()
    this._offsetX = Math.min(Math.max(0, this._offsetX), max)
    gsap.set(this._el, { x: -this._offsetX })

    const outBtn = this._el.querySelector('[data-nudge="out"]')
    const inBtn  = this._el.querySelector('[data-nudge="in"]')
    if (outBtn) outBtn.disabled = this._offsetX >= max
    if (inBtn)  inBtn.disabled  = this._offsetX <= 0
  }

  /** @param {number} dir  +1 nudges out (away from the edge), -1 nudges in. */
  _nudge (dir) {
    if (!this._el) return
    this._offsetX += dir * NUDGE_STEP
    this._applyOffset()
    this._saveOffset()
  }

  // ── Reveal / retract ─────────────────────────────────────────────────────

  _reveal () {
    if (this._revealedCount >= COLUMNS.length) return
    this._revealedCount += 1
    this._renderColumns()
  }

  _retract () {
    if (this._revealedCount <= 0) { this._close(); return }
    this._revealedCount -= 1
    this._renderColumns()
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

  _commit (item) {
    const classType = item.classType ?? classifyChar(item.char)
    const code = computeCode(classType, item.char)
    window.dispatchEvent(new KeyboardEvent('keydown', {
      key: item.char, code, bubbles: true,
    }))
    window.dispatchEvent(new KeyboardEvent('keyup', {
      key: item.char, code, bubbles: true,
    }))
  }

  _commitActive () {
    const col = this._activeColumn()
    if (!col) return
    const idx = this._selected[col.id] ?? 0
    this._commit(col.items[idx])
  }

  // ── Mouse input while open ───────────────────────────────────────────────

  _handleWheel (e) {
    if (!this._open) return
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
