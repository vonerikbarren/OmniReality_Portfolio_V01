/**
 * ui/OmniKeys.js — ⟐mniReality OmniKeys
 *
 * The flat (2D) layer of the dimensional keyboard — see
 * OMNIKEYBOARD_DESIGN.md for the full staged design. The dimensional
 * (3D cube-face) system, Hybrid/QuadBrid hand-split modes, and
 * RGBA/spacing controls are all documented there and deliberately NOT
 * built here.
 *
 * Opens from the top-left drawer (⟐mniMenu → ⟐OmniKeys™).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Layout — 16 columns wide, organized class-first so no row mixes types
 * ─────────────────────────────────────────────────────────────────────────────
 *   Row 0       Media/system (brightness, start-menu, search, mic,
 *               nightmode, media transport, volume, power, refresh)
 *   Row 1       Esc + F1–F15
 *   Row 2       Digits 0–9, then two wide press-and-hold pickers for
 *               superscript/subscript characters
 *   Rows 3–4    Letters — PAGED (20 pages, one per "alphabet of your
 *               type"). Page 0 defaults to A–Z; pages 1–19 start blank
 *               for the user to fill in. A language-selector key sits
 *               after a skipped space following Z.
 *   Rows 5–6    Symbols — PAGED (20 pages). Page 0 defaults to the
 *               original symbol set; pages 1–19 start blank
 *               ("I will fill these in as time moves forward").
 *   Row 7       The 16-slot special/system row: Sys, Exp, View, Time,
 *               Http, Ctrl, Opt, Cmd, Shift, Obj, Prpty, Complx, Purps,
 *               Enrgy, State, Func
 *   Rows 8–10   Three full 8-directional pads side by side (left,
 *               middle, right) — cardinal + all four diagonals each
 *   Row 11      16 individual spacebars (Space01–Space16), each its
 *               own independently CRUD-editable key
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Four modes
 * ─────────────────────────────────────────────────────────────────────────────
 *   Edit     — click a key to open it in OmniKeys' own Inspector.
 *   Delivery — click a key to create a Dimensional Text node in the
 *              3D world using that key's string.
 *   Sequence — click a key to open it in the Inspector focused on its
 *              start/end transformation fields.
 *   Command  — click modifiers to hold them, click a key to fire a
 *              real KeyboardEvent (see _onCommandKeyClick).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Persistence — two separate blobs, since paginated content genuinely
 * is a different shape from fixed single-instance keys
 * ─────────────────────────────────────────────────────────────────────────────
 *   omni:omnikeys:static        — the non-paginated rows (media, F-row,
 *                                 digits, special, directional, space),
 *                                 keyed by "row-col"
 *   omni:omnikeys:letterPages   — 20 pages × 32 slots
 *   omni:omnikeys:symbolPages   — 20 pages × 32 slots
 *
 * Follows the standard module contract (constructor / init / update / destroy).
 */

import gsap from 'gsap'
import * as WindowManager from './WindowManager.js'
import { generateId } from '../systems/OmniNode.js'
import { ALL_RING_TYPES, colorFor, widgetFor } from '../data/OmniCryptxTypes.js'

const COLS = 16
const PAGE_COUNT = 20
const PAGE_SLOTS = 32   // 2 rows x 16 cols

const MODES = ['Edit', 'Delivery', 'Sequence', 'Command']

const STORE_STATIC  = 'omni:omnikeys:static'
const STORE_LETTERS = 'omni:omnikeys:letterPages'
const STORE_SYMBOLS = 'omni:omnikeys:symbolPages'

// ── Static (non-paginated) rows ─────────────────────────────────────────────

const MEDIA_ROW = [
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
  { type: 'media', char: 'refresh',         label: '⟳' },
]

const FN_ROW = [
  { type: 'function', char: 'Escape', label: 'Esc' },
  ...Array.from({ length: 15 }, (_, i) => ({ type: 'function', char: `F${i + 1}`, label: `F${i + 1}` })),
]

const DIGIT_ROW = [
  ...['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => ({ type: 'digit', char: d, label: d })),
  { type: 'digit-modifier', char: 'superscript', label: 'Sup ⁿ', span: 3, picker: '⁰¹²³⁴⁵⁶⁷⁸⁹' },
  { type: 'digit-modifier', char: 'subscript',   label: 'Sub ₙ', span: 3, picker: '₀₁₂₃₄₅₆₇₈₉' },
]

const SPECIAL_ROW = [
  { type: 'special',  char: 'Sys',     label: 'Sys' },
  { type: 'special',  char: 'Exp',     label: 'Exp' },
  { type: 'special',  char: 'View',    label: 'View' },
  { type: 'special',  char: 'Time',    label: 'Time' },
  { type: 'special',  char: 'Http',    label: 'Http' },
  { type: 'modifier', char: 'Control', label: 'Ctrl' },
  { type: 'modifier', char: 'Alt',     label: 'Opt' },
  { type: 'modifier', char: 'Meta',    label: 'Cmd' },
  { type: 'modifier', char: 'ShiftLeft',   label: 'Shift L' },
  { type: 'special',  char: 'Obj',     label: 'Obj' },
  { type: 'special',  char: 'Prpty',   label: 'Prpty' },
  { type: 'special',  char: 'Complx',  label: 'Complx' },
  { type: 'special',  char: 'Purps',   label: 'Purps' },
  { type: 'special',  char: 'Enrgy',   label: 'Enrgy' },
  { type: 'special',  char: 'State',   label: 'State' },
  { type: 'special',  char: 'Func',    label: 'Func' },
]

/** One 8-directional cluster (3x3, center empty) for a given prefix —
 *  used three times (left/middle/right) so each direction key has a
 *  unique char per cluster. */
function dirCluster (prefix) {
  return {
    top: [
      { type: 'directional', char: `${prefix}-DiagUpLeft`,    label: '↖' },
      { type: 'directional', char: `${prefix}-ArrowUp`,       label: '↑' },
      { type: 'directional', char: `${prefix}-DiagUpRight`,   label: '↗' },
    ],
    mid: [
      { type: 'directional', char: `${prefix}-ArrowLeft`,     label: '←' },
      null,
      { type: 'directional', char: `${prefix}-ArrowRight`,    label: '→' },
    ],
    bottom: [
      { type: 'directional', char: `${prefix}-DiagDownLeft`,  label: '↙' },
      { type: 'directional', char: `${prefix}-ArrowDown`,     label: '↓' },
      { type: 'directional', char: `${prefix}-DiagDownRight`, label: '↘' },
    ],
  }
}

function buildDirRow (rowKey) {
  const L = dirCluster('L')[rowKey]
  const M = dirCluster('M')[rowKey]
  const R = dirCluster('R')[rowKey]
  // 1 blank + 3(L) + 2 blank + 3(M) + 2 blank + 3(R) + 2 blank = 16
  return [null, ...L, null, null, ...M, null, null, ...R, null, null]
}

const DIR_TOP_ROW    = buildDirRow('top')
const DIR_MID_ROW    = buildDirRow('mid')
const DIR_BOTTOM_ROW = buildDirRow('bottom')

const SPACE_ROW = Array.from({ length: 16 }, (_, i) => ({
  type: 'space', char: ' ', label: `Space${String(i + 1).padStart(2, '0')}`,
}))

/** The complete static (non-paginated) layout, in render order. The
 *  paginated letter/symbol row-blocks aren't in here — _buildGrid
 *  renders those separately from _letterPages/_symbolPages instead. */
const STATIC_ROWS = {
  media: MEDIA_ROW,
  fn: FN_ROW,
  digits: DIGIT_ROW,
  special: SPECIAL_ROW,
  dirTop: DIR_TOP_ROW,
  dirMid: DIR_MID_ROW,
  dirBottom: DIR_BOTTOM_ROW,
  space: SPACE_ROW,
}

// ── Paginated rows — letters, symbols ───────────────────────────────────────

function letterPageDefault (pageNum) {
  const slots = new Array(PAGE_SLOTS).fill(null)
  if (pageNum !== 0) return slots   // pages 1-19 start blank — a different alphabet per page, user's to fill
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
  letters.forEach((l, i) => { slots[i] = { type: 'letter', char: l, label: l } })
  // 26 letters, slot 26 skipped (blank) per request, slot 27 = language selector
  slots[27] = { type: 'lang-selector', char: 'lang', label: '🌐 Lang' }
  slots[28] = { type: 'function', char: 'Enter', label: 'Enter' }
  slots[29] = { type: 'modifier', char: 'ShiftRight', label: 'Shift R' }
  return slots
}

function symbolPageDefault (pageNum) {
  const slots = new Array(PAGE_SLOTS).fill(null)
  if (pageNum !== 0) return slots   // pages 1-19 start blank — "I will fill these in as time moves forward"
  const symbols = '!@#$%^&*()-_=+[]{};:\'",.<>/?\\|~`'.split('')
  symbols.forEach((s, i) => { slots[i] = { type: 'symbol', char: s, label: s } })
  return slots
}

export function classifyChar (ch) {
  if (/[a-zA-Z]/.test(ch)) return 'letter'
  if (/[0-9]/.test(ch)) return 'digit'
  return 'symbol'
}

/**
 * Computes the KeyboardEvent.code for a key, alongside its .key value —
 * several of the app's existing physical-keyboard shortcuts check
 * .code specifically (the return-to-landing 'c' shortcut, vertical
 * movement R/F, and the entire hand-menu system's ShiftLeft/
 * ShiftRight/Digit1-4/Numpad1-4 bindings), so Command mode needs to
 * set both to actually reach them, not just .key.
 *
 * One real scope limit, not an oversight: Control/Alt/Meta each still
 * have only ONE key (not separate Left/Right pairs), so those default
 * to the Left variant. Shift is the exception — the app's hand-menu
 * system needs both ShiftLeft and ShiftRight as distinct triggers, so
 * the layout has two explicit Shift keys (char 'ShiftLeft' /
 * 'ShiftRight') rather than one generic 'Shift'.
 */
export function computeCode (classType, char) {
  if (classType === 'letter') return `Key${char.toUpperCase()}`
  if (classType === 'digit') return `Digit${char}`
  if (classType === 'function') return char   // 'Escape', 'F1'..'F15' all match their code directly
  if (classType === 'modifier') {
    if (char === 'ShiftLeft' || char === 'ShiftRight') return char
    return { Control: 'ControlLeft', Alt: 'AltLeft', Meta: 'MetaLeft', Shift: 'ShiftLeft' }[char] ?? undefined
  }
  if (classType === 'directional') {
    const base = char.split('-').pop()
    return ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(base) ? base : undefined
  }
  if (classType === 'space') return 'Space'
  if (classType === 'symbol') {
    // Shifted symbols share their unshifted key's physical code (e.g.
    // '!' and '1' are the same physical key) — DOM UI Events code names.
    return {
      '`': 'Backquote', '~': 'Backquote',
      '-': 'Minus', '_': 'Minus',
      '=': 'Equal', '+': 'Equal',
      '[': 'BracketLeft', '{': 'BracketLeft',
      ']': 'BracketRight', '}': 'BracketRight',
      '\\': 'Backslash', '|': 'Backslash',
      ';': 'Semicolon', ':': 'Semicolon',
      '\'': 'Quote', '"': 'Quote',
      ',': 'Comma', '<': 'Comma',
      '.': 'Period', '>': 'Period',
      '/': 'Slash', '?': 'Slash',
      '!': 'Digit1', '@': 'Digit2', '#': 'Digit3', '$': 'Digit4', '%': 'Digit5',
      '^': 'Digit6', '&': 'Digit7', '*': 'Digit8', '(': 'Digit9', ')': 'Digit0',
    }[char] ?? undefined
  }
  return undefined
}

function specToKeyData (spec) {
  if (!spec) return { type: 'blank', title: '', string: '', classType: 'blank' }
  return {
    title: spec.label,
    string: spec.char,
    classType: spec.type,
    sequenceStart: { fontSize: 1, case: 'none', opacity: 1, color: '#ffffff' },
    sequenceEnd:   { fontSize: 1, case: 'none', opacity: 1, color: '#ffffff' },
  }
}

export function defaultStaticKeyData (rowName, col) {
  return specToKeyData(STATIC_ROWS[rowName]?.[col])
}

export function defaultPaginatedKeyData (kind, page, slot) {
  const specs = kind === 'letter' ? letterPageDefault(page) : symbolPageDefault(page)
  return specToKeyData(specs[slot])
}

function loadStatic () {
  const out = {}
  try {
    const raw = localStorage.getItem(STORE_STATIC)
    const saved = raw ? JSON.parse(raw) : {}
    for (const [rowName, row] of Object.entries(STATIC_ROWS)) {
      row.forEach((spec, col) => {
        const id = `${rowName}-${col}`
        out[id] = { ...specToKeyData(spec), ...(saved[id] ?? {}) }
      })
    }
  } catch (_) {
    for (const [rowName, row] of Object.entries(STATIC_ROWS)) {
      row.forEach((spec, col) => { out[`${rowName}-${col}`] = specToKeyData(spec) })
    }
  }
  return out
}

function saveStatic (staticKeys) {
  try { localStorage.setItem(STORE_STATIC, JSON.stringify(staticKeys)) } catch (err) {
    console.warn('⟐OmniKeys — static save failed:', err)
  }
}

function loadPages (storeKey, defaultFn) {
  let saved = null
  try {
    const raw = localStorage.getItem(storeKey)
    saved = raw ? JSON.parse(raw) : null
  } catch (_) { saved = null }

  const pages = []
  for (let p = 0; p < PAGE_COUNT; p++) {
    const defaults = defaultFn(p).map(specToKeyData)
    const savedPage = saved?.[p]
    pages.push(defaults.map((d, slot) => ({ ...d, ...(savedPage?.[slot] ?? {}) })))
  }
  return pages
}

function savePages (storeKey, pages) {
  try { localStorage.setItem(storeKey, JSON.stringify(pages)) } catch (err) {
    console.warn('⟐OmniKeys — page save failed:', err)
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
  top              : 70px;
  left             : 70px;
  width            : 820px;
  min-width        : 560px;
  max-width        : 96vw;
  height           : 640px;
  min-height       : 340px;
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

.ok-title { font-size: 12px; letter-spacing: 0.06em; color: var(--ok-text-dim); flex-shrink: 0; }

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
  padding          : 5px 9px;
  border-radius    : 5px;
  cursor           : pointer;
  transition       : background 0.12s ease, color 0.12s ease;
}
.ok-mode-btn:hover { color: var(--ok-text); }
.ok-mode-btn.is-active { background: rgba(127, 216, 255, 0.18); color: var(--ok-accent); }
.ok-mode-btn--delivery.is-active { background: rgba(140, 255, 180, 0.18); color: rgba(160, 255, 195, 0.95); }
.ok-mode-btn--sequence.is-active { background: rgba(190, 160, 255, 0.18); color: rgba(210, 185, 255, 0.95); }
.ok-mode-btn--command.is-active { background: rgba(255, 180, 100, 0.2); color: rgba(255, 200, 140, 0.95); }

.ok-controls { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.ok-ctrl {
  width            : 24px; height: 24px;
  border-radius    : 6px;
  border           : 1px solid var(--ok-border);
  background       : rgba(255,255,255,0.04);
  color            : var(--ok-text-dim);
  font-size        : 11px;
  display          : flex; align-items: center; justify-content: center;
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

.ok-save-banner {
  flex-shrink      : 0;
  max-height       : 0;
  overflow         : hidden;
  display          : flex;
  align-items      : center;
  justify-content  : center;
  font-size        : 9px;
  color            : rgba(160, 255, 195, 0.95);
  background       : rgba(140, 255, 180, 0.10);
  transition       : max-height 0.2s ease, padding 0.2s ease;
}
.ok-save-banner.is-visible { max-height: 22px; padding: 5px; }

.ok-grid-wrap {
  flex             : 1 1 auto;
  overflow         : auto;
  padding          : 10px;
  scrollbar-width  : thin;
  scrollbar-color  : rgba(255,255,255,0.3) transparent;
}
.ok-grid-wrap::-webkit-scrollbar { width: 10px; }
.ok-grid-wrap::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.25); border-radius: 5px; }
.ok-grid-wrap::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.4); }
.ok-grid-wrap::-webkit-scrollbar-track { background: rgba(255,255,255,0.03); }

.ok-grid {
  display              : grid;
  grid-template-columns: repeat(${COLS}, minmax(34px, 1fr));
  grid-auto-rows       : minmax(30px, 1fr);
  gap                  : 4px;
  min-width            : 700px;
}

.ok-row-divider {
  grid-column      : 1 / -1;
  height           : 1px;
  background       : rgba(255,255,255,0.06);
  margin           : 3px 0;
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
  position         : relative;
  transition       : background 0.1s ease, border-color 0.1s ease, transform 0.06s ease;
  overflow         : hidden;
  white-space      : nowrap;
  text-overflow    : ellipsis;
  padding          : 0 3px;
}
.ok-key:hover { background: rgba(255,255,255,0.11); border-color: rgba(255,255,255,0.25); color: var(--ok-text); }
.ok-key:active { transform: scale(0.93); }
.ok-key.is-selected { border-color: var(--ok-accent); box-shadow: 0 0 0 1px var(--ok-accent); color: var(--ok-text); }

.ok-key-spacer { pointer-events: none; }

/* Letters — normal baseline */

/* Digits — brighter background, clearly differentiated from letters */
.ok-key--digit { background: rgba(255, 255, 255, 0.22); font-weight: 600; }
.ok-key--digit:hover { background: rgba(255, 255, 255, 0.30); }

/* Digit modifiers — superscript/subscript pickers */
.ok-key--digit-modifier {
  background       : rgba(255, 255, 255, 0.14);
  font-size        : 10px;
  letter-spacing   : 0.04em;
}
.ok-key--digit-modifier:hover { background: rgba(255, 255, 255, 0.2); }

/* Symbols — brighter text-shadow, darker background */
.ok-key--symbol {
  background       : rgba(0, 0, 0, 0.35);
  border-color     : rgba(255, 255, 255, 0.08);
  color            : rgba(255, 255, 255, 0.85);
  text-shadow      : 0 0 6px rgba(255, 255, 255, 0.7);
}
.ok-key--symbol:hover { background: rgba(0, 0, 0, 0.45); color: #ffffff; text-shadow: 0 0 9px rgba(255, 255, 255, 0.9); }

/* Media/system row */
.ok-key--media {
  background       : rgba(127, 216, 255, 0.10);
  border-color     : rgba(127, 216, 255, 0.22);
  color            : rgba(180, 230, 255, 0.9);
  font-size        : 13px;
}
.ok-key--media:hover { background: rgba(127, 216, 255, 0.18); color: #fff; }

/* Function row */
.ok-key--function {
  background       : rgba(255, 255, 255, 0.03);
  border-color     : rgba(255, 255, 255, 0.14);
  color            : var(--ok-text-muted);
  font-size        : 10px;
}
.ok-key--function:hover { background: rgba(255, 255, 255, 0.09); color: var(--ok-text); }

/* Special/system row */
.ok-key--special {
  background       : rgba(255, 200, 140, 0.08);
  border-color     : rgba(255, 200, 140, 0.2);
  color            : rgba(255, 210, 160, 0.85);
  font-size        : 9.5px;
}
.ok-key--special:hover { background: rgba(255, 200, 140, 0.16); }

/* Modifiers — held-down look when active in Command mode */
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

/* Directional pads */
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
  font-size        : 8.5px;
  letter-spacing   : 0.04em;
  text-transform   : uppercase;
  color            : var(--ok-text-muted);
}
.ok-key--space:hover { background: rgba(255, 255, 255, 0.09); }

/* Language selector */
.ok-key--lang-selector {
  background       : rgba(255, 255, 255, 0.08);
  border-color     : rgba(255, 255, 255, 0.2);
  font-size        : 9px;
}

/* Blank layout placeholder inside a paginated page (not the same as a
   true row spacer — still occupies its grid cell invisibly) */
.ok-key--blank { visibility: hidden; pointer-events: none; }

/* Pagination controls, shown just above a paged section */
.ok-page-nav {
  grid-column      : 1 / -1;
  display          : flex;
  align-items      : center;
  justify-content  : center;
  gap              : 8px;
  padding          : 2px 0 4px;
  font-size        : 9px;
  color            : var(--ok-text-muted);
}
.ok-page-nav-btn {
  background       : rgba(255,255,255,0.06);
  border           : 1px solid var(--ok-border);
  color            : var(--ok-text-dim);
  border-radius    : 4px;
  width            : 20px; height: 18px;
  cursor           : pointer;
  font-size        : 10px;
  display          : flex; align-items: center; justify-content: center;
}
.ok-page-nav-btn:hover { background: rgba(255,255,255,0.14); color: var(--ok-text); }

/* Press-and-hold superscript/subscript popover */
.ok-popover {
  position         : absolute;
  bottom           : 100%;
  left             : 50%;
  transform        : translateX(-50%);
  margin-bottom    : 4px;
  display          : flex;
  gap              : 2px;
  background       : rgba(10, 10, 14, 0.96);
  border           : 1px solid var(--ok-accent);
  border-radius    : 6px;
  padding          : 4px;
  z-index          : 20;
  box-shadow       : 0 4px 16px rgba(0,0,0,0.6);
}
.ok-popover-char {
  width            : 22px; height: 22px;
  display          : flex; align-items: center; justify-content: center;
  border-radius    : 4px;
  font-size        : 12px;
  color            : var(--ok-text);
  cursor           : pointer;
}
.ok-popover-char:hover { background: rgba(127, 216, 255, 0.25); }

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

/* ── OmniKryptx view — linearized cryptex: a vertical header strip, ──────
   sections extending rightward, each one a small cluster of vertical
   sliders ─────────────────────────────────────────────────────────────── */

.ok-kryptx-mode .ok-header { flex-shrink: 0; }

.ok-kryptx-body {
  flex           : 1 1 auto;
  display        : flex;
  overflow       : hidden;
}

.ok-kryptx-vheader {
  flex-shrink    : 0;
  width          : 56px;
  display        : flex;
  flex-direction : column;
  gap            : 8px;
  padding        : 12px 8px;
  border-right   : 1px solid var(--ok-border);
  background     : rgba(255, 255, 255, 0.02);
  overflow-y     : auto;
}

.ok-kryptx-vkey {
  height         : 64px;
  border-radius  : 6px;
  border         : 1px solid var(--ok-border);
  background     : rgba(255, 255, 255, 0.03);
  cursor         : pointer;
  /* Deliberately blank — "you can make them blank," per the request,
     the same honest not-yet-filled-in pattern already used for the
     QWERTY view's own blank letter/symbol pages. */
}
.ok-kryptx-vkey:hover { background: rgba(255, 255, 255, 0.08); border-color: var(--ok-accent); }

.ok-kryptx-sections-wrap {
  flex           : 1 1 auto;
  overflow-x     : auto;
  overflow-y     : hidden;
}

.ok-kryptx-sections {
  display        : flex;
  align-items    : stretch;
  height         : 100%;
  padding        : 14px;
  gap            : 16px;
}

.ok-kryptx-section {
  flex-shrink    : 0;
  display        : flex;
  gap            : 10px;
  padding        : 12px;
  border-radius  : 10px;
  border         : 1px solid var(--ok-border);
  background     : rgba(255, 255, 255, 0.02);
}

.ok-kryptx-slider-wrap {
  width          : 60px;
  display        : flex;
  flex-direction : column;
  align-items    : center;
  justify-content: center;
  gap            : 4px;
}

/* The reliable, cross-browser way to get a vertical range slider —
   a plain horizontal <input type="range">, fixed to a known width,
   rotated -90deg. Works consistently everywhere, unlike the
   non-standard orient="vertical" attribute (Firefox-only) or
   -webkit-appearance:slider-vertical (WebKit-only). */
.ok-kryptx-slider {
  width          : 140px;
  transform      : rotate(-90deg);
  accent-color   : var(--ok-accent);
}

/* The new, real per-type widgets — deliberately NOT rotated, unlike
   the slider above. A sideways text field is unusable; these stay
   upright within their own vertical slot instead. */
.ok-kryptx-text, .ok-kryptx-symbol, .ok-kryptx-select {
  width          : 56px;
  background     : rgba(255,255,255,0.05);
  border         : 1px solid var(--ring-color, var(--ok-border));
  border-radius  : 4px;
  color          : var(--ok-text);
  font-family    : inherit;
  font-size      : 11px;
  padding        : 4px;
  text-align     : center;
}
.ok-kryptx-symbol { font-size: 16px; }

.ok-kryptx-ring-label {
  font-size      : 8px;
  letter-spacing : 0.04em;
  color          : var(--ring-color, var(--ok-text-dim));
  text-transform : uppercase;
  text-align     : center;
  max-width      : 60px;
  overflow       : hidden;
  white-space    : nowrap;
}

.ok-kryptx-add-section {
  flex-shrink    : 0;
  width          : 44px;
  border-radius  : 10px;
  border         : 1px dashed var(--ok-border);
  background     : transparent;
  color          : var(--ok-text-dim);
  font-size      : 20px;
  cursor         : pointer;
}
.ok-kryptx-add-section:hover { background: rgba(255, 255, 255, 0.05); border-color: var(--ok-accent); color: var(--ok-accent); }

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
    // Two views: the normal flat QWERTY grid, and OmniKryptx — a
    // linearized take on the OmniCryptexLab idea (nested rings, laid
    // out flat left-to-right instead of radially, since a keyboard is
    // inherently flat rather than orbital). Defaults to kryptx per
    // the request that this become the keyboard's default view.
    this._view = (() => {
      try { return localStorage.getItem('omni:omnikeys:view') ?? 'kryptx' } catch (_) { return 'kryptx' }
    })()
    this._kryptxSectionCount = (() => {
      try { return Number(localStorage.getItem('omni:omnikeys:kryptx-sections')) || 3 } catch (_) { return 3 }
    })()

    this._staticKeys = loadStatic()
    this._letterPages = loadPages(STORE_LETTERS, letterPageDefault)
    this._symbolPages = loadPages(STORE_SYMBOLS, symbolPageDefault)
    this._letterPage = 0
    this._symbolPage = 0

    this._selected = null   // { kind, row?, col?, page?, slot? }
    this._saveBannerTimer = null
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
    // and persistence stay in sync with the Inspector.
    this._onInspectorUpdate = (e) => {
      const { descriptor, keyData } = e.detail ?? {}
      if (!descriptor) return
      this._applyKeyUpdate(descriptor, keyData)
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
        id: 'omnikeys', label: '⟐OmniKeys', iconLabel: '⟐K',
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

  /** Applies an edit coming back from OmniKeysInspector to the right
   *  storage location, based on the descriptor's kind. */
  _applyKeyUpdate (descriptor, keyData) {
    if (descriptor.kind === 'static') {
      const id = `${descriptor.row}-${descriptor.col}`
      this._staticKeys[id] = keyData
      saveStatic(this._staticKeys)
    } else if (descriptor.kind === 'letter') {
      this._letterPages[descriptor.page][descriptor.slot] = keyData
      savePages(STORE_LETTERS, this._letterPages)
    } else if (descriptor.kind === 'symbol') {
      this._symbolPages[descriptor.page][descriptor.slot] = keyData
      savePages(STORE_SYMBOLS, this._symbolPages)
    }
    this._refreshKeyLabel(descriptor)
    this._flashSaveBanner()
  }

  /** Visible save confirmation directly on OmniKeys' own panel — not
   *  just in the separate Inspector — so edits made in Edit mode are
   *  confirmed persisted without needing to check another window. */
  _flashSaveBanner () {
    const banner = this._el?.querySelector('#ok-save-banner')
    if (!banner) return
    banner.textContent = '✓ Saved'
    banner.classList.add('is-visible')
    clearTimeout(this._saveBannerTimer)
    this._saveBannerTimer = setTimeout(() => banner.classList.remove('is-visible'), 1400)
  }

  _keyDataFor (descriptor) {
    if (descriptor.kind === 'static') return this._staticKeys[`${descriptor.row}-${descriptor.col}`]
    if (descriptor.kind === 'letter') return this._letterPages[descriptor.page][descriptor.slot]
    if (descriptor.kind === 'symbol') return this._symbolPages[descriptor.page][descriptor.slot]
    return null
  }

  _descriptorSelector (descriptor) {
    if (descriptor.kind === 'static') return `[data-kind="static"][data-row="${descriptor.row}"][data-col="${descriptor.col}"]`
    return `[data-kind="${descriptor.kind}"][data-page="${descriptor.page}"][data-slot="${descriptor.slot}"]`
  }

  _refreshKeyLabel (descriptor) {
    const btn = this._el?.querySelector(`.ok-key${this._descriptorSelector(descriptor)}`)
    if (!btn) return
    const key = this._keyDataFor(descriptor)
    btn.textContent = key.title
    btn.title = key.string
    btn.className = `ok-key ok-key--${key.classType ?? 'letter'}`
    if (this._selected && this._isSameDescriptor(this._selected, descriptor)) btn.classList.add('is-selected')
  }

  _isSameDescriptor (a, b) {
    if (a.kind !== b.kind) return false
    if (a.kind === 'static') return a.row === b.row && a.col === b.col
    return a.page === b.page && a.slot === b.slot
  }

  // ── DOM ──────────────────────────────────────────────────────────────────

  _buildDOM () {
    return this._view === 'kryptx' ? this._buildKryptxDOM() : this._buildQwertyDOM()
  }

  _buildQwertyDOM () {
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
      <div class="ok-save-banner" id="ok-save-banner"></div>
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

  /** OmniKryptx — the linearized cryptex view. A vertical strip of
   *  blank key options (the "header," oriented vertically per the
   *  request) on the left; sections of vertical sliders extending
   *  rightward, each new one appended further right — flattening the
   *  OmniCryptexLab idea (nested rings, each revealing more depth)
   *  into something that actually works as a keyboard: rings laid
   *  out left-to-right instead of radially. */
  _buildKryptxDOM () {
    const el = document.createElement('div')
    el.className = 'omni-keys-panel ok-kryptx-mode'
    el.innerHTML = /* html */`
      <div class="ok-header">
        <span class="ok-title">⟐OmniKryptx Keyboard</span>
        <div class="ok-controls">
          <button class="ok-ctrl" data-action="toggle-view" title="Switch to normal QWERTY view">⌨</button>
          <button class="ok-ctrl" data-action="minimize" title="Minimize">–</button>
          <button class="ok-ctrl" data-action="close" title="Close">×</button>
        </div>
      </div>
      <div class="ok-kryptx-body">
        <div class="ok-kryptx-vheader" id="ok-kryptx-vheader"></div>
        <div class="ok-kryptx-sections-wrap">
          <div class="ok-kryptx-sections" id="ok-kryptx-sections"></div>
        </div>
      </div>
      <div class="ok-resize-handle" aria-hidden="true"></div>
    `

    this._renderKryptxVHeader(el.querySelector('#ok-kryptx-vheader'))
    this._renderKryptxSections(el.querySelector('#ok-kryptx-sections'))
    this._bindHeader(el)
    this._bindResize(el)

    el.querySelector('[data-action="toggle-view"]').addEventListener('click', () => this._toggleView(el))
    el.querySelector('[data-action="minimize"]').addEventListener('click', () => this.minimize())
    el.querySelector('[data-action="close"]').addEventListener('click', () => this.close())

    el.dataset.winId = 'omnikeys'
    WindowManager.register('omnikeys', el, 'OmniKeys')
    WindowManager.watchPanelOpacity(el, () => this._isOpen)

    return el
  }

  /** Six blank vertical key options — deliberately blank, per the
   *  request, the same "not filled in yet, honestly" pattern already
   *  used for the QWERTY view's own blank pages. */
  _renderKryptxVHeader (container) {
    if (!container) return
    let html = ''
    for (let i = 0; i < 6; i++) {
      html += `<button class="ok-kryptx-vkey" data-vkey-index="${i}" title="Blank — not assigned yet"></button>`
    }
    container.innerHTML = html
  }

  /** Renders however many sections currently exist, plus the Add
   *  Section control at the end — each section is 4 vertical sliders
   *  side by side, like a small EQ. Sliders are plain <input
   *  type="range">, rotated via CSS rather than relying on the
   *  non-standard, Firefox-only orient="vertical" attribute — the
   *  rotate approach works consistently across real browsers. */
  /** Real cryptex ring types now, not blank generic sliders — this
   *  is the fix: OmniKryptx's sections were always meant to BE the
   *  cryptex, using the same real type vocabulary as the 3D
   *  astrolabe (`modules/OmniCryptx.js`), not an unrelated slider
   *  panel that happened to look similar. Each section is one ring
   *  stack; each of its 4 slots gets a real type, cycling through
   *  the full vocabulary as more sections are added, with the right
   *  widget for that type — a slider is wrong for a typed password
   *  or a chosen symbol, so those get their own real input kind. */
  _renderKryptxSections (container) {
    if (!container) return
    let html = ''
    for (let s = 0; s < this._kryptxSectionCount; s++) {
      html += `<div class="ok-kryptx-section" data-section-index="${s}">`
      for (let k = 0; k < 4; k++) {
        const type = ALL_RING_TYPES[(s * 4 + k) % ALL_RING_TYPES.length]
        const color = colorFor(type)
        const widget = widgetFor(type)
        html += `
          <div class="ok-kryptx-slider-wrap" style="--ring-color:${color}" data-ring-type="${type}">
            <span class="ok-kryptx-ring-label">${type}</span>
            ${this._buildKryptxWidget(type, widget, s, k)}
          </div>
        `
      }
      html += `</div>`
    }
    html += `<button class="ok-kryptx-add-section" data-action="add-section" title="Add a section to the right">+</button>`
    container.innerHTML = html

    container.querySelector('[data-action="add-section"]')?.addEventListener('click', () => {
      this._kryptxSectionCount += 1
      try { localStorage.setItem('omni:omnikeys:kryptx-sections', String(this._kryptxSectionCount)) } catch (_) {}
      this._renderKryptxSections(container)
    })
  }

  /** The right widget per type, not "everything is secretly a
   *  0-100 slider wearing a label." Symbol/KeySymbol/MasterKeySymbol
   *  use a short text field for a real Unicode symbol or emoji, per
   *  the confirmed memorability decision — a full picker UI is real,
   *  separate future work, not built here. Music Notation is
   *  explicitly idea-only/deferred (architecture/OMNICRYPTEXLAB_DESIGN.md)
   *  and gets an honest placeholder text field for the same reason. */
  _buildKryptxWidget (type, widget, s, k) {
    const dataAttrs = `data-section="${s}" data-slot="${k}" data-ring-type="${type}"`
    switch (widget) {
      case 'text':
        return `<input type="text" class="ok-kryptx-text" placeholder="password" ${dataAttrs}>`
      case 'symbol-picker':
        return `<input type="text" class="ok-kryptx-symbol" maxlength="2" placeholder="⟐" ${dataAttrs}>`
      case 'letter-wheel':
        return `<input type="text" class="ok-kryptx-symbol" maxlength="1" placeholder="A" ${dataAttrs}>`
      case 'note-picker':
        return `<input type="text" class="ok-kryptx-symbol" placeholder="♪" title="Music Notation — idea only, deferred" ${dataAttrs}>`
      case 'toggle':
        return `<select class="ok-kryptx-select" ${dataAttrs}><option>On</option><option>Off</option></select>`
      case 'time':
        return `<input type="time" class="ok-kryptx-select" ${dataAttrs}>`
      default:   // 'slider' — Number, px, py, pz: genuinely bounded, continuous values
        return `<input type="range" class="ok-kryptx-slider" min="0" max="100" value="50" ${dataAttrs}>`
    }
  }

  /** Swaps views in place — rebuilds the panel's own DOM rather than
   *  requiring a full close/reopen, and persists the choice so it's
   *  remembered next time OmniKeys opens. */
  _toggleView (oldEl) {
    this._view = this._view === 'kryptx' ? 'qwerty' : 'kryptx'
    try { localStorage.setItem('omni:omnikeys:view', this._view) } catch (_) {}
    const wasOpen = this._isOpen
    WindowManager.unregister('omnikeys')
    oldEl?.parentNode?.removeChild(oldEl)
    this._el = this._buildDOM()
    if (wasOpen) {
      const shell = document.getElementById('omni-ui') ?? document.body
      shell.appendChild(this._el)
      this._el.style.visibility = 'visible'
      gsap.to(this._el, { opacity: WindowManager.getPanelOpacity(), duration: 0.2 })
    }
  }

  // ── Grid building — static rows + paginated blocks ───────────────────────

  _buildGrid (grid) {
    grid.innerHTML = ''
    this._renderStaticRow(grid, 'media')
    this._renderStaticRow(grid, 'fn')
    this._renderStaticRow(grid, 'digits')
    this._renderPageNav(grid, 'letter')
    this._renderPaginatedBlock(grid, 'letter')
    this._renderPageNav(grid, 'symbol')
    this._renderPaginatedBlock(grid, 'symbol')
    this._renderStaticRow(grid, 'special')
    this._renderStaticRow(grid, 'dirTop')
    this._renderStaticRow(grid, 'dirMid')
    this._renderStaticRow(grid, 'dirBottom')
    this._renderStaticRow(grid, 'space')
  }

  _makeKeyButton (descriptor, spec) {
    const key = this._keyDataFor(descriptor)
    const btn = document.createElement('div')

    if (!spec || key.classType === 'blank') {
      btn.className = 'ok-key ok-key-spacer'
      return btn
    }

    btn.className = `ok-key ok-key--${key.classType ?? spec.type}`
    btn.dataset.kind = descriptor.kind
    if (descriptor.kind === 'static') {
      btn.dataset.row = descriptor.row
      btn.dataset.col = String(descriptor.col)
    } else {
      btn.dataset.page = String(descriptor.page)
      btn.dataset.slot = String(descriptor.slot)
    }
    btn.textContent = key.title
    btn.title = key.string
    if (spec.span) btn.style.gridColumn = `span ${spec.span}`

    if (spec.type === 'digit-modifier') {
      this._wireDigitModifierKey(btn, spec)
    } else if (spec.type === 'lang-selector') {
      btn.addEventListener('click', () => this._openLangPicker())
    } else {
      btn.addEventListener('click', () => this._onKeyClick(descriptor))
    }

    return btn
  }

  _renderStaticRow (grid, rowName) {
    STATIC_ROWS[rowName].forEach((spec, col) => {
      const descriptor = { kind: 'static', row: rowName, col }
      grid.appendChild(this._makeKeyButton(descriptor, spec))
    })
  }

  _renderPaginatedBlock (grid, kind) {
    const page = kind === 'letter' ? this._letterPage : this._symbolPage
    const pages = kind === 'letter' ? this._letterPages : this._symbolPages
    pages[page].forEach((_, slot) => {
      const descriptor = { kind, page, slot }
      const key = this._keyDataFor(descriptor)
      // spec presence only matters for span/type defaults, which paginated
      // slots don't use — a non-blank keyData is enough to know it's real.
      const spec = key.classType === 'blank' ? null : { type: key.classType }
      grid.appendChild(this._makeKeyButton(descriptor, spec))
    })
  }

  _renderPageNav (grid, kind) {
    const nav = document.createElement('div')
    nav.className = 'ok-page-nav'
    const page = kind === 'letter' ? this._letterPage : this._symbolPage
    nav.innerHTML = /* html */`
      <button class="ok-page-nav-btn" data-page-action="prev" data-page-kind="${kind}">◀</button>
      <span>${kind === 'letter' ? 'Letters' : 'Symbols'} — Page ${page + 1}/${PAGE_COUNT}</span>
      <button class="ok-page-nav-btn" data-page-action="next" data-page-kind="${kind}">▶</button>
    `
    nav.querySelector('[data-page-action="prev"]').addEventListener('click', () => this._changePage(kind, -1))
    nav.querySelector('[data-page-action="next"]').addEventListener('click', () => this._changePage(kind, 1))
    grid.appendChild(nav)
  }

  _changePage (kind, delta) {
    if (kind === 'letter') {
      this._letterPage = (this._letterPage + delta + PAGE_COUNT) % PAGE_COUNT
    } else {
      this._symbolPage = (this._symbolPage + delta + PAGE_COUNT) % PAGE_COUNT
    }
    this._buildGrid(this._el.querySelector('#ok-grid'))
  }

  _openLangPicker () {
    // A direct jump list — simpler and more reliable than gesture
    // detection for picking one of 20 pages/alphabets.
    const choice = prompt?.(`Jump to letters page (1-${PAGE_COUNT}):`, String(this._letterPage + 1))
    const n = parseInt(choice, 10)
    if (!Number.isNaN(n) && n >= 1 && n <= PAGE_COUNT) {
      this._letterPage = n - 1
      this._buildGrid(this._el.querySelector('#ok-grid'))
    }
  }

  // ── Press-and-hold superscript/subscript picker ─────────────────────────
  // "Press and hold" per request — holding for 400ms reveals a small
  // popover of the ten characters to choose from. Selecting one always
  // delivers a Dimensional Text node with that character, regardless of
  // the panel's current mode — these are a quick-access picker, not a
  // persistent grid slot with its own Edit/Sequence identity the way
  // real keys have.
  _wireDigitModifierKey (btn, spec) {
    let holdTimer = null
    const openPopover = () => {
      this._el?.querySelectorAll('.ok-popover').forEach(p => p.remove())
      const pop = document.createElement('div')
      pop.className = 'ok-popover'
      spec.picker.split('').forEach(ch => {
        const c = document.createElement('div')
        c.className = 'ok-popover-char'
        c.textContent = ch
        c.addEventListener('click', (e) => {
          e.stopPropagation()
          this._deliverString(ch)
          pop.remove()
        })
        pop.appendChild(c)
      })
      btn.appendChild(pop)
      const onOutside = (e) => {
        if (!pop.contains(e.target)) { pop.remove(); document.removeEventListener('click', onOutside) }
      }
      setTimeout(() => document.addEventListener('click', onOutside), 0)
    }

    const start = () => { holdTimer = setTimeout(openPopover, 400) }
    const cancel = () => clearTimeout(holdTimer)

    btn.addEventListener('mousedown', start)
    btn.addEventListener('mouseup', cancel)
    btn.addEventListener('mouseleave', cancel)
    btn.addEventListener('touchstart', start, { passive: true })
    btn.addEventListener('touchend', cancel)
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

  /** The middle (center) 8-directional pad's four cardinal arrows are
   *  a dedicated camera-rotation control — mode-independent, unlike
   *  every other key, since rotating the camera isn't something that
   *  makes sense to "edit," "deliver as text," or "inspect for a
   *  sequence." The left/right pads keep their normal, multi-mode
   *  behavior since they aren't assigned a specific purpose yet. */
  _onKeyClick (descriptor) {
    const DIR_ROWS = ['dirTop', 'dirMid', 'dirBottom']
    if (descriptor.kind === 'static' && DIR_ROWS.includes(descriptor.row)) {
      const key = this._keyDataFor(descriptor)
      const base = key?.string?.split('-').pop()
      const rotateMap = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }
      if (key?.string?.startsWith('M-') && rotateMap[base]) {
        window.dispatchEvent(new CustomEvent('omni:omnikeys-rotate', { detail: { direction: rotateMap[base] } }))
        return
      }
    }

    // The "View" special key — switches to OmniKryptx. Previously
    // defined in the layout with no handler at all; this is that
    // handler.
    if (descriptor.kind === 'static' && descriptor.row === 'special') {
      const key = this._keyDataFor(descriptor)
      if (key?.string === 'View') {
        this._toggleView(this._el)
        return
      }
    }

    if (this._mode === 'Command') {
      this._onCommandKeyClick(descriptor)
      return
    }

    this._selected = descriptor
    this._el?.querySelectorAll('.ok-key').forEach(k => k.classList.remove('is-selected'))
    this._el?.querySelector(`.ok-key${this._descriptorSelector(descriptor)}`)?.classList.add('is-selected')

    if (this._mode === 'Delivery') {
      const key = this._keyDataFor(descriptor)
      this._deliverString(key.string, key)
      return
    }

    this._openInspectorFor(descriptor, this._mode)
  }

  /** Command mode — clicking a modifier toggles it "held"; clicking any
   *  other key fires a REAL synthetic KeyboardEvent carrying whatever
   *  modifiers are currently held, then releases them. One real
   *  mechanism (genuine KeyboardEvents), not a parallel shortcut map —
   *  every keydown listener already in this project responds exactly
   *  as if it had been typed on a physical keyboard. */
  /** Maps a modifier's char to which KeyboardEvent boolean flag it
   *  represents — needed both for the standalone dispatch below and
   *  for checking "is any Shift variant currently held" later. */
  _modifierFlagKey (char) {
    if (char === 'ShiftLeft' || char === 'ShiftRight' || char === 'Shift') return 'shiftKey'
    if (char === 'Control') return 'ctrlKey'
    if (char === 'Alt') return 'altKey'
    if (char === 'Meta') return 'metaKey'
    return null
  }

  _onCommandKeyClick (descriptor) {
    const key = this._keyDataFor(descriptor)
    if (!key || key.classType === 'blank') return

    if (key.classType === 'modifier') {
      const btn = this._el?.querySelector(`.ok-key${this._descriptorSelector(descriptor)}`)
      const flagKey = this._modifierFlagKey(key.string)

      if (this._heldModifiers.has(key.string)) {
        this._heldModifiers.delete(key.string)
        btn?.classList.remove('is-held')
        return
      }

      this._heldModifiers.add(key.string)
      btn?.classList.add('is-held')

      // A bare modifier press is itself a real, distinct keydown — the
      // app's hand-menu system listens for exactly this (ShiftLeft /
      // ShiftRight pressed alone, not held for a combo). Dispatching
      // only on the "held" transition (not on release) matches how a
      // real keydown behaves — it fires once per press, not per toggle.
      window.dispatchEvent(new KeyboardEvent('keydown', {
        key: key.string,
        code: computeCode('modifier', key.string),
        ctrlKey: flagKey === 'ctrlKey',
        altKey: flagKey === 'altKey',
        metaKey: flagKey === 'metaKey',
        shiftKey: flagKey === 'shiftKey',
        bubbles: true,
      }))
      return
    }

    const held = this._heldModifiers
    const shiftHeld = ['Shift', 'ShiftLeft', 'ShiftRight'].some(v => held.has(v))
    window.dispatchEvent(new KeyboardEvent('keydown', {
      key: key.string,
      code: computeCode(key.classType, key.string),
      ctrlKey: held.has('Control'),
      altKey: held.has('Alt'),
      metaKey: held.has('Meta'),
      shiftKey: shiftHeld,
      bubbles: true,
    }))

    this._heldModifiers = new Set()
    this._el?.querySelectorAll('.ok-key--modifier.is-held').forEach(b => b.classList.remove('is-held'))
  }

  /** Delivery mode's actual node-creation — factored out so the
   *  superscript/subscript popover can reuse it too. */
  _deliverString (string, key) {
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
        color: key?.sequenceStart?.color ?? '#ffffff',
        text: string,
        textSequence: key ? { start: key.sequenceStart, end: key.sequenceEnd } : null,
        position: [cam.position.x + fx * 5, Math.max(0.5, cam.position.y + fy * 5), cam.position.z + fz * 5],
        parentId: null,
      }
    }))
  }

  _openInspectorForSelected () {
    if (!this._selected) return
    this._openInspectorFor(this._selected, this._mode === 'Sequence' ? 'Sequence' : 'Edit')
  }

  _openInspectorFor (descriptor, focusMode) {
    window.dispatchEvent(new CustomEvent('omni:omnikeys-inspect-request', {
      detail: { descriptor, keyData: this._keyDataFor(descriptor), focusMode }
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
