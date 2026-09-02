/**
 * ui/OmniKeys.js — ⟐mniReality OmniKeys
 *
 * The flat (2D) layer of the dimensional keyboard — see
 * OMNIKEYBOARD_DESIGN.md for the full staged design. This is Stage 1:
 * a flat panel, same chrome as every other panel, with a basic grid of
 * keys. The dimensional (3D cube-face) system, Hybrid/QuadBrid
 * hand-split modes, and RGBA/spacing controls are all documented there
 * and deliberately NOT built here.
 *
 * Opens from the top-left drawer (⟐mniMenu → ⟐OmniKeys™ — a top-level
 * trademark item).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Layout
 * ─────────────────────────────────────────────────────────────────────────────
 * 8 rows × 16 columns (128 keys) — deliberately not a real-keyboard
 * mirror ("it doesn't need to, and I think it's outdated anyway").
 * Pre-filled with a sensible default character layout on first use.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Three modes
 * ─────────────────────────────────────────────────────────────────────────────
 *   Edit     — click a key to open it in OmniKeys' own Inspector
 *              (title + string macro value). CRUD, persisted.
 *   Delivery — click a key to actually create a Dimensional Text node
 *              in the 3D world using that key's string (see
 *              systems/OmniNode.js's _buildTextSprite — canvas-texture
 *              sprite, not real 3D letterforms, for performance).
 *   Sequence — click a key to open it in the Inspector focused on its
 *              start/end transformation fields (see
 *              DIMENSIONAL_TEXT_DESIGN.md). Fields only in this pass —
 *              the actual transformation playback is future work.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Persistence
 * ─────────────────────────────────────────────────────────────────────────────
 * All 128 keys' title/string/sequence data live in one localStorage
 * key (`omni:omnikeys:keys`) — a flat object keyed by key index,
 * following the same "one blob" pattern as Admin's settings rather
 * than 128 separate storage entries.
 *
 * Follows the standard module contract (constructor / init / update / destroy).
 */

import gsap from 'gsap'
import * as WindowManager from './WindowManager.js'
import { generateId } from '../systems/OmniNode.js'

const COLS = 16
const STORE_KEY = 'omni:omnikeys:keys'

const MODES = ['Edit', 'Delivery', 'Sequence', 'Command']

/**
 * Structured layout — an array of rows, each row an array of key specs
 * ({ type, char, label }) or `null` for a blank/unused spacer cell.
 * Organized class-first per request: media/system row, then Esc+F-row,
 * then digits, then letters, then symbols, then modifiers + a compact
 * directional pad, then a split spacebar — each class fills whole rows
 * so nothing bleeds into the next row's class.
 *
 * A couple of genuinely ambiguous reads, stated plainly rather than
 * guessed silently:
 *   - "another row above that" (the media/system row) is placed as the
 *     literal topmost row, with Esc+Function keys just below it.
 *   - "diagonal left / diagonal right" — read as the two upper
 *     diagonals (↖ ↗), paired with Up on the same row, since only two
 *     diagonals (not all four) were asked for.
 */
function buildLayout () {
  const mediaRow = [
    { type: 'media', char: 'brightness-up',   label: '☀+' },
    { type: 'media', char: 'brightness-down', label: '☀−' },
    { type: 'media', char: 'start-menu',      label: '⟐' },
    { type: 'media', char: 'search',          label: '🔍' },
    { type: 'media', char: 'mic',             label: '🎤' },
    { type: 'media', char: 'nightmode',       label: '🌙' },
    { type: 'media', char: 'media-prev',      label: '⏮' },
    { type: 'media', char: 'play-pause',      label: '⏯' },
    { type: 'media', char: 'slow-down',       label: '⏪' },
    { type: 'media', char: 'speed-up',        label: '⏩' },
    { type: 'media', char: 'media-next',      label: '⏭' },
    { type: 'media', char: 'vol-up',          label: '🔊' },
    { type: 'media', char: 'vol-down',        label: '🔉' },
    { type: 'media', char: 'mute',            label: '🔇' },
    { type: 'media', char: 'power',           label: '⏻' },
    null,
  ]

  const fnRow = [
    { type: 'function', char: 'Escape', label: 'Esc' },
    ...Array.from({ length: 12 }, (_, i) => ({ type: 'function', char: `F${i + 1}`, label: `F${i + 1}` })),
    null, null, null,
  ]

  const digits = '1234567890'.split('')
  const digitRow = [...digits.map(d => ({ type: 'digit', char: d, label: d })), null, null, null, null, null, null]

  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
  const letterRow1 = letters.slice(0, 16).map(l => ({ type: 'letter', char: l, label: l }))
  const letterRow2 = [...letters.slice(16).map(l => ({ type: 'letter', char: l, label: l })), null, null, null, null, null, null]

  const symbols = '!@#$%^&*()-_=+[]{};:\'",.<>/?\\|~`'.split('')
  const symbolRow1 = symbols.slice(0, 16).map(s => ({ type: 'symbol', char: s, label: s }))
  const symbolRow2 = [...symbols.slice(16).map(s => ({ type: 'symbol', char: s, label: s })), null, null]

  const modRow = [
    { type: 'modifier', char: 'Control', label: 'Ctrl' },
    { type: 'modifier', char: 'Alt',     label: 'Opt' },
    { type: 'modifier', char: 'Meta',    label: 'Cmd' },
    { type: 'modifier', char: 'Shift',   label: 'Shift' },
    null, null,
    { type: 'directional', char: 'DiagUpLeft',  label: '↖' },
    { type: 'directional', char: 'ArrowUp',     label: '↑' },
    { type: 'directional', char: 'DiagUpRight', label: '↗' },
    null, null,
    { type: 'modifier', char: 'Shift',   label: 'Shift' },
    { type: 'modifier', char: 'Meta',    label: 'Cmd' },
    { type: 'modifier', char: 'Alt',     label: 'Opt' },
    { type: 'modifier', char: 'Control', label: 'Ctrl' },
    null,
  ]

  const dpadRow = [
    null, null, null, null, null, null,
    { type: 'directional', char: 'ArrowLeft',  label: '←' },
    { type: 'directional', char: 'ArrowDown',  label: '↓' },
    { type: 'directional', char: 'ArrowRight', label: '→' },
    null, null, null, null, null, null, null,
  ]

  const spaceRow = [
    { type: 'space', char: ' ', label: 'Space (L)', span: 8 },
    { type: 'space', char: ' ', label: 'Space (R)', span: 8 },
  ]

  return [mediaRow, fnRow, digitRow, letterRow1, letterRow2, symbolRow1, symbolRow2, modRow, dpadRow, spaceRow]
}

const LAYOUT = buildLayout()
const TOTAL_KEYS = LAYOUT.reduce((n, row) => n + row.length, 0)
const ROWS = LAYOUT.length

export function defaultKeyData (index) {
  let i = 0
  for (const row of LAYOUT) {
    for (const spec of row) {
      if (i === index) {
        if (!spec) return { type: 'blank', title: '', string: '', classType: 'blank' }
        return {
          title: spec.label,
          string: spec.char,
          classType: spec.type,
          sequenceStart: { fontSize: 1, case: 'none', opacity: 1, color: '#ffffff' },
          sequenceEnd:   { fontSize: 1, case: 'none', opacity: 1, color: '#ffffff' },
        }
      }
      i++
    }
  }
  return { type: 'blank', title: '', string: '', classType: 'blank' }
}

export function classifyChar (ch) {
  if (/[a-zA-Z]/.test(ch)) return 'letter'
  if (/[0-9]/.test(ch)) return 'digit'
  return 'symbol'
}

function loadKeys () {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    const saved = raw ? JSON.parse(raw) : {}
    const keys = {}
    for (let i = 0; i < TOTAL_KEYS; i++) {
      keys[i] = { ...defaultKeyData(i), ...(saved[i] ?? {}) }
    }
    return keys
  } catch (_) {
    const keys = {}
    for (let i = 0; i < TOTAL_KEYS; i++) keys[i] = defaultKeyData(i)
    return keys
  }
}

function saveKeys (keys) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(keys)) } catch (err) {
    console.warn('⟐OmniKeys — localStorage save failed:', err)
  }
}

const STYLES = /* css */`

.omni-keys-panel {
  --ok-bg          : var(--omni-theme-bg, rgba(8, 8, 12, 0.92));
  --ok-border      : var(--omni-theme-border, rgba(255, 255, 255, 0.09));
  --ok-header-bg   : var(--omni-theme-header-bg, rgba(255, 255, 255, 0.03));
  --ok-text        : var(--omni-theme-text, rgba(255, 255, 255, 1));
  --ok-text-dim    : var(--omni-theme-text-dim, rgba(255, 255, 255, 0.85));
  --ok-text-muted  : var(--omni-theme-text-muted, rgba(255, 255, 255, 0.6));
  --ok-accent      : var(--omni-theme-accent, #7fd8ff);
  --mono           : 'Courier New', Courier, monospace;

  position         : fixed;
  top              : 90px;
  left             : 90px;
  width            : 760px;
  min-width        : 520px;
  max-width        : 96vw;
  height           : 520px;
  min-height       : 300px;
  max-height       : 92vh;

  display          : flex;
  flex-direction   : column;

  background       : var(--ok-bg);
  backdrop-filter  : blur(22px) saturate(1.5);
  -webkit-backdrop-filter: blur(22px) saturate(1.5);
  border           : 1px solid var(--ok-border);
  border-radius    : 14px;
  box-shadow       : 0 0 24px rgba(0,0,0,0.4), 0 12px 40px rgba(0,0,0,0.55);

  font-family      : var(--mono);
  color            : var(--ok-text);
  z-index          : 60;
  overflow         : hidden;
  pointer-events   : auto;
  resize           : both;

  opacity          : 0;
  transform        : scale(0.94);
}

.ok-header {
  position         : relative;
  height           : 44px;
  flex-shrink      : 0;
  display          : flex;
  align-items      : center;
  justify-content  : space-between;
  padding          : 0 12px;
  gap              : 10px;
  background       : var(--ok-header-bg);
  border-bottom    : 1px solid var(--ok-border);
  cursor           : grab;
  user-select      : none;
}
.ok-header.is-dragging { cursor: grabbing; }

.ok-title {
  font-size        : 12px;
  letter-spacing   : 0.06em;
  color            : var(--ok-text-dim);
  flex-shrink      : 0;
}

.ok-modes {
  display          : flex;
  gap              : 4px;
  background       : rgba(255,255,255,0.05);
  border           : 1px solid var(--ok-border);
  border-radius    : 7px;
  padding          : 2px;
}
.ok-mode-btn {
  background       : none;
  border           : none;
  color            : var(--ok-text-muted);
  font-family      : var(--mono);
  font-size        : 10px;
  letter-spacing   : 0.03em;
  padding          : 5px 10px;
  border-radius    : 5px;
  cursor           : pointer;
  transition       : background 0.12s ease, color 0.12s ease;
}
.ok-mode-btn:hover { color: var(--ok-text); }
.ok-mode-btn.is-active {
  background       : rgba(127, 216, 255, 0.18);
  color            : var(--ok-accent);
}
.ok-mode-btn--delivery.is-active { background: rgba(140, 255, 180, 0.18); color: rgba(160, 255, 195, 0.95); }
.ok-mode-btn--sequence.is-active { background: rgba(190, 160, 255, 0.18); color: rgba(210, 185, 255, 0.95); }
.ok-mode-btn--command.is-active { background: rgba(255, 180, 100, 0.2); color: rgba(255, 200, 140, 0.95); }

.ok-controls { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.ok-ctrl {
  width            : 24px;
  height           : 24px;
  border-radius    : 6px;
  border           : 1px solid var(--ok-border);
  background       : rgba(255,255,255,0.04);
  color            : var(--ok-text-dim);
  font-size        : 11px;
  display          : flex;
  align-items      : center;
  justify-content  : center;
  cursor           : pointer;
  transition       : background 0.12s ease, color 0.12s ease, border-color 0.12s ease;
}
.ok-ctrl:hover { background: rgba(255,255,255,0.10); border-color: rgba(255,255,255,0.24); color: var(--ok-text); }
.ok-ctrl--inspector { color: rgba(190, 160, 255, 0.85); border-color: rgba(190, 160, 255, 0.22); }
.ok-ctrl--inspector:hover { background: rgba(190, 160, 255, 0.14); }

.ok-mode-note {
  flex-shrink      : 0;
  text-align       : center;
  font-size        : 9px;
  color            : var(--ok-text-muted);
  padding          : 4px;
  border-bottom    : 1px solid rgba(255,255,255,0.05);
}

.ok-grid-wrap {
  flex             : 1 1 auto;
  overflow         : auto;
  padding          : 10px;
}

.ok-grid {
  display              : grid;
  grid-template-columns: repeat(${COLS}, minmax(34px, 1fr));
  grid-template-rows   : repeat(${ROWS}, minmax(34px, 1fr));
  gap                  : 4px;
  min-width            : 620px;
  height               : 100%;
}

.ok-key {
  display          : flex;
  align-items      : center;
  justify-content  : center;
  background       : rgba(255,255,255,0.05);
  border           : 1px solid rgba(255,255,255,0.10);
  border-radius    : 5px;
  color            : var(--ok-text-dim);
  font-family      : var(--mono);
  font-size        : 11px;
  cursor           : pointer;
  user-select      : none;
  transition       : background 0.1s ease, border-color 0.1s ease, transform 0.06s ease;
  overflow         : hidden;
  white-space      : nowrap;
  text-overflow    : ellipsis;
  padding          : 0 3px;
}
.ok-key:hover { background: rgba(255,255,255,0.11); border-color: rgba(255,255,255,0.25); color: var(--ok-text); }
.ok-key:active { transform: scale(0.93); }
.ok-key.is-selected { border-color: var(--ok-accent); box-shadow: 0 0 0 1px var(--ok-accent); color: var(--ok-text); }

/* Letters — normal, the baseline .ok-key look above, no override needed */

/* Digits — brighter background, clearly differentiated from letters */
.ok-key--digit {
  background       : rgba(255, 255, 255, 0.22);
  font-weight      : 600;
}
.ok-key--digit:hover { background: rgba(255, 255, 255, 0.30); }

/* Symbols — brighter text-shadow, darker background */
.ok-key--symbol {
  background       : rgba(0, 0, 0, 0.35);
  border-color     : rgba(255, 255, 255, 0.08);
  color            : rgba(255, 255, 255, 0.85);
  text-shadow      : 0 0 6px rgba(255, 255, 255, 0.7);
}
.ok-key--symbol:hover {
  background       : rgba(0, 0, 0, 0.45);
  color            : #ffffff;
  text-shadow      : 0 0 9px rgba(255, 255, 255, 0.9);
}

/* Media/system row — its own accent, distinct from ordinary characters */
.ok-key--media {
  background       : rgba(127, 216, 255, 0.10);
  border-color     : rgba(127, 216, 255, 0.22);
  color            : rgba(180, 230, 255, 0.9);
  font-size        : 13px;
}
.ok-key--media:hover { background: rgba(127, 216, 255, 0.18); color: #fff; }

/* Function row (Esc + F1-F12) */
.ok-key--function {
  background       : rgba(255, 255, 255, 0.03);
  border-color     : rgba(255, 255, 255, 0.14);
  color            : var(--ok-text-muted);
  font-size        : 10px;
}
.ok-key--function:hover { background: rgba(255, 255, 255, 0.09); color: var(--ok-text); }

/* Modifiers (Ctrl/Opt/Cmd/Shift) — held-down look when active in Command mode */
.ok-key--modifier {
  background       : rgba(190, 160, 255, 0.08);
  border-color     : rgba(190, 160, 255, 0.2);
  color            : rgba(210, 185, 255, 0.85);
  font-size        : 9.5px;
}
.ok-key--modifier:hover { background: rgba(190, 160, 255, 0.16); }
.ok-key--modifier.is-held {
  background       : rgba(190, 160, 255, 0.4);
  border-color     : rgba(210, 185, 255, 0.9);
  color            : #fff;
  box-shadow       : 0 0 10px rgba(190, 160, 255, 0.5);
}

/* Directional pad */
.ok-key--directional {
  background       : rgba(140, 255, 180, 0.08);
  border-color     : rgba(140, 255, 180, 0.2);
  color            : rgba(160, 255, 195, 0.9);
  font-size        : 14px;
}
.ok-key--directional:hover { background: rgba(140, 255, 180, 0.18); }

/* Split spacebar */
.ok-key--space {
  background       : rgba(255, 255, 255, 0.04);
  font-size        : 9px;
  letter-spacing   : 0.06em;
  text-transform   : uppercase;
  color            : var(--ok-text-muted);
}
.ok-key--space:hover { background: rgba(255, 255, 255, 0.09); }

/* Blank layout spacer — invisible, non-interactive, just preserves grid rhythm */
.ok-key-spacer { pointer-events: none; }

.ok-resize-handle {
  position         : absolute; right: 0; bottom: 0;
  width            : 16px; height: 16px;
  cursor           : nwse-resize;
  z-index          : 2;
}
.ok-resize-handle::before {
  content          : '';
  position         : absolute; right: 3px; bottom: 3px;
  width            : 8px; height: 8px;
  border-right     : 2px solid rgba(255, 255, 255, 0.25);
  border-bottom    : 2px solid rgba(255, 255, 255, 0.25);
  border-radius    : 0 0 2px 0;
}
.ok-resize-handle:hover::before { border-color: rgba(255, 255, 255, 0.6); }

`

function injectStyles () {
  if (document.getElementById('omni-keys-styles')) return
  const tag = document.createElement('style')
  tag.id = 'omni-keys-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

export default class OmniKeys {
  constructor (context) {
    this.ctx = context
    this._el = null
    this._isOpen = false
    this._drag = { active: false, startX: 0, startY: 0, originX: 0, originY: 0 }
    this._mode = 'Edit'
    this._keys = loadKeys()
    this._selectedIndex = null
    this._heldModifiers = new Set()
    this._onNavSelect = null
    this._onInspectorUpdate = null
  }

  init () {
    injectStyles()
    this._onNavSelect = (e) => {
      if (e.detail?.item !== '⟐OmniKeys') return
      this.open()
    }
    window.addEventListener('omni:nav-select', this._onNavSelect)

    // OmniKeysInspector edits flow back here so the grid's own display
    // (key titles) and persistence stay in sync with the Inspector.
    this._onInspectorUpdate = (e) => {
      const { index, keyData } = e.detail ?? {}
      if (index == null) return
      this._keys[index] = keyData
      saveKeys(this._keys)
      this._refreshKeyLabel(index)
    }
    window.addEventListener('omni:omnikeys-key-updated', this._onInspectorUpdate)
  }

  update () {}
  onResize () {}

  destroy () {
    window.removeEventListener('omni:nav-select', this._onNavSelect)
    window.removeEventListener('omni:omnikeys-key-updated', this._onInspectorUpdate)
    this._el?.parentNode?.removeChild(this._el)
    WindowManager.unregister('omnikeys')
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
      opacity: 0, scale: 0.94, duration: 0.18, ease: 'power1.in',
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
        id: 'omnikeys', label: '⟐OmniKeys', iconLabel: '⟐K',
        fromRect: { x: rect.left, y: rect.top, w: rect.width, h: rect.height },
        variant: 'orb',
      }
    }))
  }

  // ── DOM ──────────────────────────────────────────────────────────────────

  _buildDOM () {
    const el = document.createElement('div')
    el.className = 'omni-keys-panel'
    el.innerHTML = /* html */`
      <div class="ok-header">
        <span class="ok-title">⟐OmniKeys</span>
        <div class="ok-modes" id="ok-modes">
          ${MODES.map(m => /* html */`
            <button class="ok-mode-btn ok-mode-btn--${m.toLowerCase()} ${m === this._mode ? 'is-active' : ''}" data-mode="${m}">${m}</button>
          `).join('')}
        </div>
        <div class="ok-controls">
          <button class="ok-ctrl ok-ctrl--inspector" data-action="inspector" title="Open OmniKeys Inspector">⟐i</button>
          <button class="ok-ctrl" data-action="minimize" title="Minimize">–</button>
          <button class="ok-ctrl" data-action="close" title="Close">×</button>
        </div>
      </div>
      <div class="ok-mode-note" id="ok-mode-note"></div>
      <div class="ok-grid-wrap">
        <div class="ok-grid" id="ok-grid"></div>
      </div>
      <div class="ok-resize-handle" aria-hidden="true"></div>
    `

    this._buildGrid(el.querySelector('#ok-grid'))
    this._updateModeNote(el)
    this._bindHeader(el)
    this._bindResize(el)

    el.querySelectorAll('[data-mode]').forEach(btn => {
      btn.addEventListener('click', () => this._setMode(btn.dataset.mode, el))
    })
    el.querySelector('[data-action="minimize"]').addEventListener('click', () => this.minimize())
    el.querySelector('[data-action="close"]').addEventListener('click', () => this.close())
    el.querySelector('[data-action="inspector"]').addEventListener('click', () => this._openInspectorForSelected())

    el.dataset.winId = 'omnikeys'
    WindowManager.register('omnikeys', el, 'OmniKeys')
    WindowManager.watchPanelOpacity(el, () => this._isOpen)
    WindowManager.registerContextMenu('omnikeys', {
      Objects: [
        { label: '⟐i Open Inspector', action: () => this._openInspectorForSelected() },
      ],
    })

    return el
  }

  _buildGrid (grid) {
    grid.innerHTML = ''
    let i = 0
    for (const row of LAYOUT) {
      for (const spec of row) {
        if (!spec) {
          const spacer = document.createElement('div')
          spacer.className = 'ok-key-spacer'
          grid.appendChild(spacer)
          i++
          continue
        }
        const cellIndex = i   // fresh per-iteration binding — 'i' itself
                                // is shared/mutated across the whole loop,
                                // so closures below must capture a copy,
                                // not the outer variable itself
        const key = this._keys[cellIndex]
        const btn = document.createElement('div')
        btn.className = `ok-key ok-key--${key.classType ?? spec.type}`
        btn.dataset.index = String(cellIndex)
        btn.textContent = key.title
        btn.title = key.string
        if (spec.span) btn.style.gridColumn = `span ${spec.span}`
        btn.addEventListener('click', () => this._onKeyClick(cellIndex))
        grid.appendChild(btn)
        i++
      }
    }
  }

  _refreshKeyLabel (index) {
    const btn = this._el?.querySelector(`.ok-key[data-index="${index}"]`)
    if (!btn) return
    const key = this._keys[index]
    btn.textContent = key.title
    btn.title = key.string
    btn.className = `ok-key ok-key--${key.classType ?? 'letter'}`
    if (this._selectedIndex === index) btn.classList.add('is-selected')
  }

  _setMode (mode, el) {
    this._mode = mode
    el.querySelectorAll('[data-mode]').forEach(btn => {
      btn.classList.toggle('is-active', btn.dataset.mode === mode)
    })
    this._updateModeNote(el)
  }

  _updateModeNote (el) {
    const note = el.querySelector('#ok-mode-note')
    if (!note) return
    const notes = {
      Edit: 'Click a key to edit its title + string in the Inspector',
      Delivery: 'Click a key to create a Dimensional Text node in the world',
      Sequence: 'Click a key to edit its start → end transformation in the Inspector',
      Command: 'Click modifiers to hold them, then a key to fire the real shortcut',
    }
    note.textContent = notes[this._mode] ?? ''
  }

  _onKeyClick (index) {
    if (this._mode === 'Command') {
      this._onCommandKeyClick(index)
      return
    }

    this._selectedIndex = index
    this._el?.querySelectorAll('.ok-key').forEach(k => k.classList.remove('is-selected'))
    this._el?.querySelector(`.ok-key[data-index="${index}"]`)?.classList.add('is-selected')

    if (this._mode === 'Delivery') {
      this._deliverKey(index)
      return
    }

    // Edit and Sequence modes both open the Inspector — same panel,
    // the Inspector itself decides which fields to bring into view
    // based on which mode requested it.
    this._openInspectorFor(index, this._mode)
  }

  /**
   * Command mode — clicking a modifier (Ctrl/Opt/Cmd/Shift) toggles it
   * "held" (visually latched); clicking any other key fires a REAL
   * synthetic KeyboardEvent carrying whatever modifiers are currently
   * held, then releases them. Dispatching a genuine KeyboardEvent
   * (rather than inventing a parallel shortcut-mapping system) means
   * every keydown listener already in this project — rotation toggles,
   * the domain grid's 0/9, etc. — responds to it exactly as if it had
   * been typed on a physical keyboard. One real mechanism, not two.
   */
  _onCommandKeyClick (index) {
    const key = this._keys[index]
    if (!key || key.classType === 'blank') return

    if (key.classType === 'modifier') {
      this._heldModifiers = this._heldModifiers ?? new Set()
      const btn = this._el?.querySelector(`.ok-key[data-index="${index}"]`)
      if (this._heldModifiers.has(key.string)) {
        this._heldModifiers.delete(key.string)
        btn?.classList.remove('is-held')
      } else {
        this._heldModifiers.add(key.string)
        btn?.classList.add('is-held')
      }
      return
    }

    const held = this._heldModifiers ?? new Set()
    window.dispatchEvent(new KeyboardEvent('keydown', {
      key: key.string,
      ctrlKey: held.has('Control'),
      altKey: held.has('Alt'),
      metaKey: held.has('Meta'),
      shiftKey: held.has('Shift'),
      bubbles: true,
    }))

    // A chord fires once, then releases — matches how a real keyboard
    // shortcut works (you don't stay "holding" Cmd after Cmd+S fires).
    this._heldModifiers = new Set()
    this._el?.querySelectorAll('.ok-key--modifier.is-held').forEach(b => b.classList.remove('is-held'))
  }

  /** Delivery mode — actually spawns a Dimensional Text node in the
   *  world using this key's string. Positioned a few units in front of
   *  the camera, same convention used by ui/OmniDraw.js and the
   *  Inspector's own Create section. */
  _deliverKey (index) {
    const key = this._keys[index]
    const cam = this.ctx.camera
    const fx = -Math.sin(cam.rotation.y) * Math.cos(cam.rotation.x)
    const fy = Math.sin(cam.rotation.x)
    const fz = -Math.cos(cam.rotation.y) * Math.cos(cam.rotation.x)

    window.dispatchEvent(new CustomEvent('omni:node-create-request', {
      detail: {
        id: generateId(),
        label: 'Text_' + Date.now().toString(36).slice(-4),
        geometry: 'DimensionalText',
        primitive: 'objective',
        color: key.sequenceStart?.color ?? '#ffffff',
        text: key.string,
        textSequence: { start: key.sequenceStart, end: key.sequenceEnd },
        position: [cam.position.x + fx * 5, Math.max(0.5, cam.position.y + fy * 5), cam.position.z + fz * 5],
        parentId: null,
      }
    }))
  }

  _openInspectorForSelected () {
    if (this._selectedIndex == null) return
    this._openInspectorFor(this._selectedIndex, this._mode === 'Sequence' ? 'Sequence' : 'Edit')
  }

  _openInspectorFor (index, focusMode) {
    window.dispatchEvent(new CustomEvent('omni:omnikeys-inspect-request', {
      detail: { index, keyData: this._keys[index], focusMode }
    }))
  }

  // ── Header drag / resize — same pattern as every other panel ─────────────

  _bindHeader (el) {
    const header = el.querySelector('.ok-header')
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
    const handle = el.querySelector('.ok-resize-handle')
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
