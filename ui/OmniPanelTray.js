/**
 * ui/OmniPanelTray.js — ⟐OmniPanelTray
 *
 * Replaces the old minimize destination. Every panel in the app already
 * dispatches the same `omni:panel-minimized { id, label, iconLabel,
 * fromRect, variant }` event (confirmed across 40+ panels before writing
 * this) — previously caught by ui/PanelIcon.js, which spawned a single
 * free-floating draggable ⟐ orb you could then drag onto Dock.js's old
 * center tray. This module replaces that whole pipeline: a minimized
 * panel now lands directly here, as a titled tab in a real tray, docked
 * to one edge of the screen.
 *
 * ui/PanelIcon.js's `omni:panel-minimized` listener is disabled (see the
 * note at the top of that file) so there is exactly one consumer of that
 * event now. Dock.js's old center-tray (`addIcon`/`dock-drop`) goes
 * dormant the same way — nothing calls it anymore, nothing needed to.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Real gap found and fixed in the same pass (see ui/WindowManager.js)
 * ─────────────────────────────────────────────────────────────────────────────
 *   Minimize was universal; restore was not — only a handful of panels
 *   (ui/Panel.js's base class, ui/OmniDraw.js) ever listened for
 *   `omni:panel-restore`. Every standalone system (⟐Chronos, ⟐Keys,
 *   Admin, ⟐p, and most of the rest) had no way back once minimized
 *   through the old orb. `WindowManager.restorePanel(id)` is the real
 *   fix — it works off the registry every panel already joins, not off
 *   a contract most of them never implemented.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Two forms (only the Flat form is built — see docs/architecture/
 * OMNIPANELTRAY.md for the file-cabinet form, deferred by direct
 * agreement on build order)
 * ─────────────────────────────────────────────────────────────────────────────
 *   FLAT   — 1–3 rows of tabs, Excel-mobile-tab-tray style. Row 1 is
 *            always present; Expand reveals row 2 then row 3, Collapse
 *            reverses it. Built here.
 *   CABINET— grouped, Z-axis "file cabinet" depth. Documented, not built.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Orientation
 * ─────────────────────────────────────────────────────────────────────────────
 *   The Tray itself docks to any one edge — bottom (default), top, left,
 *   right — same idea as moving VS Code's terminal panel. Changed from
 *   the header's Orient control. Regardless of orientation, the ONE
 *   toggle that opens/closes the Tray stays on the Dock (the small ▲
 *   arrow in its right wing) — per direct request.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Per-tab interaction
 * ─────────────────────────────────────────────────────────────────────────────
 *   Click           → Maximize (WindowManager.restorePanel, tab removed)
 *   Drag            → reorder within a row, or drop on another row to move
 *   Right-click /
 *   long-press      → context menu: Maximize | Close | Move ▸ (row/position)
 *       "Close" removes the tab only — the panel stays exactly as
 *       minimized (hidden), same as the old orb's "Dismiss." It is not a
 *       real panel-destroy action; nothing in this app exposes one today.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Header toolbar (toggleable on/off, independent of the Tray itself)
 * ─────────────────────────────────────────────────────────────────────────────
 *   Filter   — by ⟐ axiom category (see PANEL_AXIOM_MAP — honestly
 *              partial; most panels fall to "Unclassified" today)
 *   Sort     — Manual | Alphabetical | By Date (minimized-at) | By ⟐
 *              A non-manual sort actually redistributes tabs across rows
 *              (row 1 fills first), not just a visual reorder.
 *   Search   — label substring match
 *   Expand / Collapse — row 2 → row 3 / row 3 → row 2
 *   Orient   — bottom / top / left / right
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * What's deliberately NOT persisted
 * ─────────────────────────────────────────────────────────────────────────────
 *   Orientation, header-visible, sort mode, and visible-row-count persist
 *   (localStorage, same as everything else in this app). The actual set
 *   of minimized tabs does NOT persist across a reload — no panel in this
 *   app currently tracks "I was minimized" as part of its own saved
 *   state, so faking that here would just show tabs for panels that come
 *   back open on reload anyway. Worth a real pass later if that's wanted.
 *
 * Events consumed (window):
 *   omni:panel-minimized    { id, label, iconLabel, fromRect, variant }
 *   omni:paneltray-toggle   {}                — Dock's arrow button
 *   omni:node-deleted       { id }            — in case a panel id ever
 *                                                collides with a node id;
 *                                                harmless no-op otherwise
 *
 * Events dispatched (window):
 *   omni:paneltray-state    { open }          — Dock syncs its arrow
 *
 * Follows the standard module contract (constructor / init / update / destroy).
 */

import gsap from 'gsap'
import * as WindowManager from './WindowManager.js'

// ── Layout constants ─────────────────────────────────────────────────────────

const DOCK_H       = 52
const BAR_H        = 48   // GlobalBar height, top anchor
const ROW_H        = 40   // px per row (flat form)
const COL_W        = 168  // px per column when oriented left/right
const HEADER_H     = 32
const MAX_ROWS     = 3

// ── Persistence ──────────────────────────────────────────────────────────────

const STORE_KEY = 'omni:paneltray:prefs'
const DEFAULTS  = { orientation: 'bottom', headerVisible: true, visibleRows: 1, sortMode: 'manual' }

function loadPrefs () {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS }
  } catch (_) { return { ...DEFAULTS } }
}
function savePrefs (prefs) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(prefs)) } catch (_) { /* non-fatal */ }
}

// ── ⟐ axiom classification — honestly partial ───────────────────────────────
// Best-effort mapping from a handful of documented product→axiom pairs
// (docs/architecture/THE_32_REVISED_PROPOSAL.md). Most panel ids aren't
// covered yet and fall to "Unclassified" — this is a starting point for
// Sort/Filter by ⟐, not a claim that the mapping is complete or final.

const PANEL_AXIOM_MAP = {
  omninode           : 'Existence',
  omnichronos        : 'Time',
  omnicellpanel      : 'Data',
  omnidraw           : 'Change',
  omnidrawdynamic    : 'Change',
  omnidrawcell       : 'Data',
  omnipresenter      : 'Flow',
  omniplayerdashboard: 'Attract',
}
function axiomFor (id) { return PANEL_AXIOM_MAP[id] ?? 'Unclassified' }

// ── Stylesheet ───────────────────────────────────────────────────────────────

const STYLES = /* css */`

#omni-panel-tray {
  --opt-bg        : rgba(8, 8, 12, 0.88);
  --opt-border    : rgba(255, 255, 255, 0.10);
  --opt-tab-bg    : rgba(255, 255, 255, 0.05);
  --opt-tab-hover : rgba(255, 255, 255, 0.10);
  --opt-tab-active: rgba(127, 216, 255, 0.16);
  --opt-text      : rgba(255, 255, 255, 0.88);
  --opt-text-dim  : rgba(255, 255, 255, 0.45);
  --opt-accent    : rgba(127, 216, 255, 0.85);
  --mono          : 'Courier New', Courier, monospace;

  position        : fixed;
  display         : flex;
  background      : var(--opt-bg);
  backdrop-filter : blur(16px) saturate(1.4);
  -webkit-backdrop-filter: blur(16px) saturate(1.4);
  border          : 1px solid var(--opt-border);
  font-family     : var(--mono);
  color           : var(--opt-text);
  z-index         : 55;
  pointer-events  : auto;
  user-select     : none;
  -webkit-font-smoothing: antialiased;
  visibility      : hidden;
}

/* ── Orientation — root geometry + flex axis ─────────────────────────────── */

/* Always a normal (never reversed) flex axis at the root — the header
   bar is simply the first child, the row stack the second, in both
   orientations. Keeping this unreversed avoids the direction doing
   double duty with row ordering below, which is handled entirely
   inside .opt-body/.opt-row instead. */
#omni-panel-tray[data-orientation="bottom"] {
  left: 0; right: 0; bottom: ${DOCK_H}px;
  flex-direction: column;
  border-left: none; border-right: none; border-bottom: none;
}
#omni-panel-tray[data-orientation="top"] {
  left: 0; right: 0; top: ${BAR_H}px;
  flex-direction: column;
  border-left: none; border-right: none; border-top: none;
}
#omni-panel-tray[data-orientation="left"] {
  left: 0; top: ${BAR_H}px; bottom: ${DOCK_H}px;
  flex-direction: row;
  border-left: none; border-top: none; border-bottom: none;
}
#omni-panel-tray[data-orientation="right"] {
  right: 0; top: ${BAR_H}px; bottom: ${DOCK_H}px;
  flex-direction: row;
  border-right: none; border-top: none; border-bottom: none;
}

.opt-header-bar {
  flex-shrink: 0;
  display: flex;
}
#omni-panel-tray[data-orientation="bottom"] .opt-header-bar,
#omni-panel-tray[data-orientation="top"] .opt-header-bar {
  flex-direction: row;
}
#omni-panel-tray[data-orientation="left"] .opt-header-bar,
#omni-panel-tray[data-orientation="right"] .opt-header-bar {
  flex-direction: column;
}

/* ── Header ───────────────────────────────────────────────────────────────── */

.opt-header {
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  gap: 6px;
  height: ${HEADER_H}px;
  padding: 0 8px;
  border-bottom: 1px solid var(--opt-border);
  font-size: 9px;
  overflow-x: auto;
  white-space: nowrap;
}
#omni-panel-tray[data-orientation="left"] .opt-header,
#omni-panel-tray[data-orientation="right"] .opt-header {
  flex-direction: column;
  height: auto;
  width: ${HEADER_H}px;
  border-bottom: none;
  border-right: 1px solid var(--opt-border);
  padding: 8px 0;
  overflow-x: visible;
  overflow-y: auto;
}

.opt-brand {
  color: var(--opt-accent);
  letter-spacing: 0.08em;
  flex-shrink: 0;
  padding: 0 4px;
}

.opt-hbtn {
  flex-shrink: 0;
  background: var(--opt-tab-bg);
  border: 1px solid var(--opt-border);
  border-radius: 3px;
  color: var(--opt-text-dim);
  font-family: var(--mono);
  font-size: 9px;
  padding: 3px 7px;
  cursor: pointer;
  transition: background 0.1s, color 0.1s;
}
.opt-hbtn:hover { background: var(--opt-tab-hover); color: var(--opt-text); }
.opt-hbtn.is-active { background: var(--opt-tab-active); color: var(--opt-accent); border-color: var(--opt-accent); }

.opt-hsel {
  flex-shrink: 0;
  background: var(--opt-tab-bg);
  border: 1px solid var(--opt-border);
  border-radius: 3px;
  color: var(--opt-text-dim);
  font-family: var(--mono);
  font-size: 9px;
  padding: 2px 4px;
}

.opt-hsearch {
  flex-shrink: 0;
  width: 90px;
  background: var(--opt-tab-bg);
  border: 1px solid var(--opt-border);
  border-radius: 3px;
  color: var(--opt-text);
  font-family: var(--mono);
  font-size: 9px;
  padding: 3px 6px;
}
.opt-hsearch::placeholder { color: var(--opt-text-dim); }

.opt-orient-group { display: flex; gap: 3px; flex-shrink: 0; }

/* ── Header collapsed (toggled off) ──────────────────────────────────────── */
.opt-header.is-collapsed { display: none; }

/* Always-visible header on/off toggle — deliberately OUTSIDE .opt-header
   itself, so collapsing the header can never hide the one control that
   brings it back. */
.opt-header-toggle {
  flex-shrink: 0;
  width: ${HEADER_H}px;
  height: ${HEADER_H}px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--opt-tab-bg);
  border: none;
  border-bottom: 1px solid var(--opt-border);
  color: var(--opt-accent);
  font-size: 11px;
  cursor: pointer;
}
#omni-panel-tray[data-orientation="left"] .opt-header-toggle,
#omni-panel-tray[data-orientation="right"] .opt-header-toggle {
  border-bottom: none;
  border-right: 1px solid var(--opt-border);
}

/* ── Body — the rows ──────────────────────────────────────────────────────── */

.opt-body {
  flex: 1 1 auto;
  display: flex;
  min-width: 0;
  min-height: 0;
}
#omni-panel-tray[data-orientation="bottom"] .opt-body,
#omni-panel-tray[data-orientation="top"] .opt-body {
  flex-direction: column;
}
#omni-panel-tray[data-orientation="left"] .opt-body,
#omni-panel-tray[data-orientation="right"] .opt-body {
  flex-direction: row;
}

/* ── Row (flat form) ──────────────────────────────────────────────────────── */

.opt-row {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 0 10px;
  /* Edge fade — "fades on the edges," direction set per-orientation below */
  mask-image: linear-gradient(to right, transparent 0, black 20px, black calc(100% - 20px), transparent 100%);
  -webkit-mask-image: linear-gradient(to right, transparent 0, black 20px, black calc(100% - 20px), transparent 100%);
}
#omni-panel-tray[data-orientation="bottom"] .opt-row,
#omni-panel-tray[data-orientation="top"] .opt-row {
  height: ${ROW_H}px;
  flex-direction: row;
  overflow-x: auto;
  overflow-y: hidden;
  border-top: 1px solid var(--opt-border);
}
#omni-panel-tray[data-orientation="bottom"] .opt-row:first-child,
#omni-panel-tray[data-orientation="top"] .opt-row:first-child {
  border-top: none;
}
#omni-panel-tray[data-orientation="left"] .opt-row,
#omni-panel-tray[data-orientation="right"] .opt-row {
  width: ${COL_W}px;
  flex-direction: column;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 10px 0;
  border-left: 1px solid var(--opt-border);
  mask-image: linear-gradient(to bottom, transparent 0, black 20px, black calc(100% - 20px), transparent 100%);
  -webkit-mask-image: linear-gradient(to bottom, transparent 0, black 20px, black calc(100% - 20px), transparent 100%);
}
#omni-panel-tray[data-orientation="left"] .opt-row:first-child,
#omni-panel-tray[data-orientation="right"] .opt-row:first-child {
  border-left: none;
}
.opt-row.is-row-hidden { display: none; }

.opt-row-empty-hint {
  font-size: 8px;
  color: var(--opt-text-dim);
  letter-spacing: 0.08em;
  pointer-events: none;
  white-space: nowrap;
}

/* ── Tab chip — sharp cyber edge, not a plain rectangle ──────────────────── */

.opt-tab {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 5px;
  height: 26px;
  padding: 0 10px 0 8px;
  background: var(--opt-tab-bg);
  border: 1px solid var(--opt-border);
  clip-path: polygon(8px 0, 100% 0, 100% 100%, 0 100%, 0 8px);
  color: var(--opt-text);
  font-size: 9px;
  letter-spacing: 0.03em;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.1s, border-color 0.1s;
}
.opt-tab:hover { background: var(--opt-tab-hover); border-color: rgba(255,255,255,0.22); }
.opt-tab.is-dragging { opacity: 0.4; }
.opt-tab.drag-target { border-color: var(--opt-accent); }
#omni-panel-tray[data-orientation="left"] .opt-tab,
#omni-panel-tray[data-orientation="right"] .opt-tab {
  width: calc(${COL_W}px - 16px);
}

.opt-tab-icon { color: var(--opt-accent); flex-shrink: 0; }
.opt-tab-label { overflow: hidden; text-overflow: ellipsis; }

/* ── Context menu (reuses PanelIcon.js's visual language) ────────────────── */

.opt-context {
  position: fixed;
  min-width: 150px;
  background: rgba(10, 10, 14, 0.96);
  border: 1px solid var(--opt-border);
  border-radius: 6px;
  padding: 4px;
  font-family: var(--mono);
  font-size: 10px;
  z-index: 300;
  box-shadow: 0 8px 24px rgba(0,0,0,0.5);
}
.opt-ctx-item {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 8px; border-radius: 4px; cursor: pointer; color: var(--opt-text);
}
.opt-ctx-item:hover { background: rgba(255,255,255,0.08); }
.opt-ctx-item--danger:hover { background: rgba(255,80,80,0.14); color: rgba(255,150,150,0.9); }
.opt-ctx-divider { height: 1px; background: var(--opt-border); margin: 3px 2px; }
.opt-ctx-sub { padding-left: 18px; display: none; }
.opt-ctx-sub.is-open { display: block; }

/* ── Mobile ───────────────────────────────────────────────────────────────── */
@media (max-width: 560px) {
  #omni-panel-tray[data-orientation="left"],
  #omni-panel-tray[data-orientation="right"] { display: none; } /* not enough width — falls back to bottom via orientation guard in JS */
}
`

function injectStyles () {
  if (document.getElementById('omni-paneltray-styles')) return
  const tag = document.createElement('style')
  tag.id = 'omni-paneltray-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

// ─────────────────────────────────────────────────────────────────────────────
// OmniPanelTray class
// ─────────────────────────────────────────────────────────────────────────────

export default class OmniPanelTray {

  constructor (context) {
    this.ctx = context

    this._el     = null
    this._isOpen = false

    const prefs = loadPrefs()
    const mobileNarrow = typeof window !== 'undefined' && window.innerWidth <= 560
    this._orientation  = (mobileNarrow && (prefs.orientation === 'left' || prefs.orientation === 'right'))
      ? 'bottom' : prefs.orientation
    this._headerVisible = prefs.headerVisible
    this._visibleRows  = prefs.visibleRows
    this._sortMode     = prefs.sortMode

    this._filterAxiom = null
    this._searchQuery = ''

    // Tabs grouped by row — order within each array IS display order.
    this._rows = { 1: [], 2: [], 3: [] }

    this._dragId = null

    this._onMinimized  = null
    this._onTrayToggle = null
    this._contextMenu  = null
  }

  // ── Module contract ────────────────────────────────────────────────────────

  init () {
    injectStyles()
    this._buildDOM()
    this._bindEvents()
  }

  update (_delta) {}

  destroy () {
    window.removeEventListener('omni:panel-minimized',  this._onMinimized)
    window.removeEventListener('omni:paneltray-toggle', this._onTrayToggle)
    this._destroyContextMenu()
    this._el?.parentNode?.removeChild(this._el)
  }

  // ── Public API ───────────────────────────────────────────────────────────

  open () {
    if (this._isOpen) return
    this._isOpen = true
    this._el.style.visibility = 'visible'
    const from = this._offscreenTransform()
    gsap.fromTo(this._el, from.from, { ...from.to, duration: 0.24, ease: 'power3.out' })
    window.dispatchEvent(new CustomEvent('omni:paneltray-state', { detail: { open: true } }))
  }

  close () {
    if (!this._isOpen) return
    this._isOpen = false
    const to = this._offscreenTransform().from
    gsap.to(this._el, {
      ...to, duration: 0.18, ease: 'power2.in',
      onComplete: () => { this._el.style.visibility = 'hidden' }
    })
    window.dispatchEvent(new CustomEvent('omni:paneltray-state', { detail: { open: false } }))
  }

  toggle () { this._isOpen ? this.close() : this.open() }

  _offscreenTransform () {
    switch (this._orientation) {
      case 'top':    return { from: { y: '-100%', opacity: 1 }, to: { y: '0%' } }
      case 'left':   return { from: { x: '-100%', opacity: 1 }, to: { x: '0%' } }
      case 'right':  return { from: { x: '100%',  opacity: 1 }, to: { x: '0%' } }
      default:       return { from: { y: '100%',  opacity: 1 }, to: { y: '0%' } } // bottom
    }
  }

  // ── DOM ──────────────────────────────────────────────────────────────────

  _buildDOM () {
    const el = document.createElement('div')
    el.id = 'omni-panel-tray'
    el.dataset.orientation = this._orientation

    el.innerHTML = /* html */`
      <div class="opt-header-bar">
        <button class="opt-header-toggle" id="opt-header-toggle" title="Show/hide the header">⟐</button>
        <div class="opt-header ${this._headerVisible ? '' : 'is-collapsed'}" id="opt-header">
          <span class="opt-brand">PanelTray</span>
          <button class="opt-hbtn" id="opt-btn-filter" title="Filter by ⟐">Filter</button>
          <select class="opt-hsel" id="opt-sel-sort" title="Sort">
            <option value="manual">Manual</option>
            <option value="alpha">A–Z</option>
            <option value="date">By Date</option>
            <option value="axiom">By ⟐</option>
          </select>
          <input class="opt-hsearch" id="opt-search" type="text" placeholder="Search…" spellcheck="false">
          <button class="opt-hbtn" id="opt-btn-expand" title="Expand a row">Expand</button>
          <button class="opt-hbtn" id="opt-btn-collapse" title="Collapse a row">Collapse</button>
          <div class="opt-orient-group" id="opt-orient-group" title="Orientation">
            <button class="opt-hbtn" data-orient="bottom">▽</button>
            <button class="opt-hbtn" data-orient="top">△</button>
            <button class="opt-hbtn" data-orient="left">◁</button>
            <button class="opt-hbtn" data-orient="right">▷</button>
          </div>
        </div>
      </div>
      <div class="opt-body" id="opt-body">
        <div class="opt-row" data-row="1"></div>
        <div class="opt-row is-row-hidden" data-row="2"></div>
        <div class="opt-row is-row-hidden" data-row="3"></div>
      </div>
    `

    // Header toggle — a thin always-visible strip isn't worth its own
    // element yet (function over style for this pass); the brand label
    // itself doubles as the header on/off toggle for now.
    el.querySelector('#opt-header-toggle').addEventListener('click', () => this._toggleHeader())

    this._el = el
    const shell = document.getElementById('omni-ui') ?? document.body
    shell.appendChild(el)

    this._bindHeaderControls(el)
    this._syncOrientButtons()
    this._syncRowVisibility()
    this._renderRows()
  }

  _bindHeaderControls (el) {
    el.querySelector('#opt-btn-filter').addEventListener('click', () => this._cycleFilter())
    el.querySelector('#opt-sel-sort').addEventListener('change', (e) => {
      this._sortMode = e.target.value
      this._persistPrefs()
      this._applySort()
    })
    el.querySelector('#opt-search').addEventListener('input', (e) => {
      this._searchQuery = e.target.value.trim().toLowerCase()
      this._renderRows()
    })
    el.querySelector('#opt-btn-expand').addEventListener('click', () => {
      this._visibleRows = Math.min(MAX_ROWS, this._visibleRows + 1)
      this._persistPrefs()
      this._syncRowVisibility()
    })
    el.querySelector('#opt-btn-collapse').addEventListener('click', () => {
      this._visibleRows = Math.max(1, this._visibleRows - 1)
      this._persistPrefs()
      this._syncRowVisibility()
    })
    el.querySelector('#opt-orient-group').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-orient]')
      if (!btn) return
      this._setOrientation(btn.dataset.orient)
    })
  }

  _toggleHeader () {
    this._headerVisible = !this._headerVisible
    this._persistPrefs()
    this._el.querySelector('#opt-header').classList.toggle('is-collapsed', !this._headerVisible)
  }

  _setOrientation (orientation) {
    if (!['bottom', 'top', 'left', 'right'].includes(orientation)) return
    // Left/right need real width for the column form to be usable — on a
    // narrow screen, fall back to bottom rather than docking to an edge
    // that then hides itself entirely (see the mobile media query above).
    if ((orientation === 'left' || orientation === 'right') && window.innerWidth <= 560) {
      orientation = 'bottom'
    }
    this._orientation = orientation
    this._el.dataset.orientation = orientation
    this._persistPrefs()
    this._syncOrientButtons()
    // Re-apply open position immediately if already open, so switching
    // edges while the Tray is visible doesn't leave it stranded off-screen.
    if (this._isOpen) gsap.set(this._el, this._offscreenTransform().to)
  }

  _syncOrientButtons () {
    this._el.querySelectorAll('[data-orient]').forEach(btn => {
      btn.classList.toggle('is-active', btn.dataset.orient === this._orientation)
    })
  }

  _syncRowVisibility () {
    for (let r = 1; r <= MAX_ROWS; r++) {
      const rowEl = this._el.querySelector(`.opt-row[data-row="${r}"]`)
      rowEl?.classList.toggle('is-row-hidden', r > this._visibleRows)
    }
  }

  _persistPrefs () {
    savePrefs({
      orientation: this._orientation,
      headerVisible: this._headerVisible,
      visibleRows: this._visibleRows,
      sortMode: this._sortMode,
    })
  }

  // ── Filter / Sort / Search ─────────────────────────────────────────────────

  _allAxiomsPresent () {
    const set = new Set()
    for (const row of Object.values(this._rows)) row.forEach(t => set.add(axiomFor(t.id)))
    return [...set].sort()
  }

  _cycleFilter () {
    const options = [null, ...this._allAxiomsPresent()]
    const idx = options.indexOf(this._filterAxiom)
    this._filterAxiom = options[(idx + 1) % options.length]
    const btn = this._el.querySelector('#opt-btn-filter')
    btn.textContent = this._filterAxiom ? `Filter: ${this._filterAxiom}` : 'Filter'
    btn.classList.toggle('is-active', !!this._filterAxiom)
    this._renderRows()
  }

  /** Non-manual sort flattens every row, sorts, and redistributes —
   *  row 1 fills first, same as the row-priority rule everywhere else
   *  in this spec ("row one is first of course"). */
  _applySort () {
    if (this._sortMode === 'manual') return

    const all = [1, 2, 3].flatMap(r => this._rows[r])
    if (this._sortMode === 'alpha') {
      all.sort((a, b) => a.label.localeCompare(b.label))
    } else if (this._sortMode === 'date') {
      all.sort((a, b) => a.minimizedAt - b.minimizedAt)
    } else if (this._sortMode === 'axiom') {
      all.sort((a, b) => axiomFor(a.id).localeCompare(axiomFor(b.id)) || a.label.localeCompare(b.label))
    }

    const perRow = Math.max(1, Math.ceil(all.length / Math.max(1, this._visibleRows)))
    this._rows = { 1: [], 2: [], 3: [] }
    all.forEach((tab, i) => {
      const row = Math.min(3, Math.floor(i / perRow) + 1)
      this._rows[row].push(tab)
    })
    this._renderRows()
  }

  // ── Tab lifecycle ────────────────────────────────────────────────────────

  _addTab ({ id, label, iconLabel, variant }) {
    // Already tracked (shouldn't normally happen — a panel can't minimize
    // twice without restoring first) — update in place rather than duplicate.
    for (const row of Object.values(this._rows)) {
      const existing = row.find(t => t.id === id)
      if (existing) { existing.label = label; existing.iconLabel = iconLabel; this._renderRows(); return }
    }
    this._rows[1].push({ id, label: label ?? id, iconLabel: iconLabel ?? '⟐', variant, minimizedAt: Date.now() })
    if (this._sortMode !== 'manual') this._applySort()
    else this._renderRows()
  }

  _removeTab (id) {
    for (const r of [1, 2, 3]) {
      const idx = this._rows[r].findIndex(t => t.id === id)
      if (idx !== -1) { this._rows[r].splice(idx, 1); this._renderRows(); return }
    }
  }

  _findTab (id) {
    for (const r of [1, 2, 3]) {
      const idx = this._rows[r].findIndex(t => t.id === id)
      if (idx !== -1) return { row: r, idx, tab: this._rows[r][idx] }
    }
    return null
  }

  _moveTabToRow (id, toRow) {
    const found = this._findTab(id)
    if (!found || found.row === toRow) return
    const [tab] = this._rows[found.row].splice(found.idx, 1)
    this._rows[toRow].push(tab)
    this._renderRows()
  }

  _moveTabWithinRow (id, direction) {
    const found = this._findTab(id)
    if (!found) return
    const row = this._rows[found.row]
    const target = found.idx + (direction === 'left' ? -1 : 1)
    if (target < 0 || target >= row.length) return
    ;[row[found.idx], row[target]] = [row[target], row[found.idx]]
    this._renderRows()
  }

  _maximizeTab (id) {
    WindowManager.restorePanel(id)
    this._removeTab(id)
  }

  // ── Render ───────────────────────────────────────────────────────────────

  _renderRows () {
    for (let r = 1; r <= MAX_ROWS; r++) {
      const rowEl = this._el.querySelector(`.opt-row[data-row="${r}"]`)
      if (!rowEl) continue
      const tabs = this._rows[r]
      const visible = tabs.filter(t => this._passesFilters(t))

      if (visible.length === 0) {
        rowEl.innerHTML = r === 1
          ? '<span class="opt-row-empty-hint">no minimized panels</span>'
          : ''
        continue
      }

      rowEl.innerHTML = visible.map(t => /* html */`
        <div class="opt-tab" data-id="${t.id}" data-row="${r}" draggable="true" title="${t.label}">
          <span class="opt-tab-icon">${t.iconLabel}</span>
          <span class="opt-tab-label">${t.label}</span>
        </div>
      `).join('')
    }
    this._bindTabInteractions()
  }

  _passesFilters (tab) {
    if (this._filterAxiom && axiomFor(tab.id) !== this._filterAxiom) return false
    if (this._searchQuery && !tab.label.toLowerCase().includes(this._searchQuery)) return false
    return true
  }

  // ── Per-tab interaction — click / drag / context menu ─────────────────────

  _bindTabInteractions () {
    this._el.querySelectorAll('.opt-tab').forEach(el => {
      const id = el.dataset.id

      el.addEventListener('click', () => this._maximizeTab(id))

      el.addEventListener('contextmenu', (e) => {
        e.preventDefault()
        this._showContextMenu(id, e.clientX, e.clientY)
      })

      // Drag-and-drop reorder/move — desktop. Mobile relies on the
      // context menu's Move submenu instead (dragging tabs fights with
      // scrolling a touch screen), per direct request.
      el.addEventListener('dragstart', () => {
        this._dragId = id
        el.classList.add('is-dragging')
      })
      el.addEventListener('dragend', () => {
        el.classList.remove('is-dragging')
        this._el.querySelectorAll('.drag-target').forEach(t => t.classList.remove('drag-target'))
        this._dragId = null
      })
      el.addEventListener('dragover', (e) => {
        e.preventDefault()
        this._el.querySelectorAll('.drag-target').forEach(t => t.classList.remove('drag-target'))
        el.classList.add('drag-target')
      })
      el.addEventListener('drop', (e) => {
        e.preventDefault()
        if (!this._dragId || this._dragId === id) return
        const targetRow = Number(el.dataset.row)
        const found = this._findTab(this._dragId)
        if (found && found.row === targetRow) {
          // Reorder within the same row — splice to just before the drop target.
          const row = this._rows[targetRow]
          const fromIdx = row.findIndex(t => t.id === this._dragId)
          const toIdx   = row.findIndex(t => t.id === id)
          const [moved] = row.splice(fromIdx, 1)
          row.splice(toIdx, 0, moved)
          this._renderRows()
        } else {
          this._moveTabToRow(this._dragId, targetRow)
        }
      })
    })

    // Rows themselves are also drop targets (dropping on empty space in
    // a row, not on another tab — appends to the end of that row).
    this._el.querySelectorAll('.opt-row').forEach(rowEl => {
      rowEl.addEventListener('dragover', (e) => e.preventDefault())
      rowEl.addEventListener('drop', (e) => {
        if (e.target !== rowEl) return   // a child .opt-tab already handled it
        if (!this._dragId) return
        this._moveTabToRow(this._dragId, Number(rowEl.dataset.row))
      })
    })
  }

  // ── Context menu ─────────────────────────────────────────────────────────

  _showContextMenu (id, cx, cy) {
    this._destroyContextMenu()
    const found = this._findTab(id)
    if (!found) return

    const menu = document.createElement('div')
    menu.className = 'opt-context'
    const rowChoices = [1, 2, 3].filter(r => r !== found.row)
      .map(r => `<div class="opt-ctx-item" data-action="move-row" data-row="${r}">→ Row ${r}</div>`).join('')

    menu.innerHTML = /* html */`
      <div class="opt-ctx-item" data-action="maximize"><span>⬈</span><span>Maximize</span></div>
      <div class="opt-ctx-divider"></div>
      <div class="opt-ctx-item" data-action="move-left"><span>◁</span><span>Move Left</span></div>
      <div class="opt-ctx-item" data-action="move-right"><span>▷</span><span>Move Right</span></div>
      ${rowChoices}
      <div class="opt-ctx-divider"></div>
      <div class="opt-ctx-item opt-ctx-item--danger" data-action="close"><span>✕</span><span>Close</span></div>
    `

    const menuW = 160, menuH = 180
    let left = cx + 6, top = cy + 6
    if (left + menuW > window.innerWidth)  left = cx - menuW - 6
    if (top  + menuH > window.innerHeight) top  = cy - menuH - 6
    menu.style.left = `${left}px`
    menu.style.top  = `${top}px`

    const shell = document.getElementById('omni-ui') ?? document.body
    shell.appendChild(menu)
    this._contextMenu = menu

    menu.addEventListener('click', (e) => {
      const item = e.target.closest('.opt-ctx-item')
      if (!item) return
      const action = item.dataset.action
      this._destroyContextMenu()
      switch (action) {
        case 'maximize':  this._maximizeTab(id); break
        case 'close':     this._removeTab(id); break
        case 'move-left': this._moveTabWithinRow(id, 'left'); break
        case 'move-right':this._moveTabWithinRow(id, 'right'); break
        case 'move-row':  this._moveTabToRow(id, Number(item.dataset.row)); break
      }
    })

    // Dismiss on an outside click — next tick, so this same click doesn't
    // immediately close the menu it just opened.
    setTimeout(() => {
      const onOutside = (e) => {
        if (!menu.contains(e.target)) { this._destroyContextMenu(); document.removeEventListener('click', onOutside) }
      }
      document.addEventListener('click', onOutside)
    }, 0)
  }

  _destroyContextMenu () {
    this._contextMenu?.remove()
    this._contextMenu = null
  }

  // ── Event listeners ─────────────────────────────────────────────────────

  _bindEvents () {
    this._onMinimized = (e) => {
      const { id, label, iconLabel, variant } = e.detail ?? {}
      if (!id) return
      this._addTab({ id, label, iconLabel, variant })
    }
    this._onTrayToggle = () => this.toggle()

    window.addEventListener('omni:panel-minimized',  this._onMinimized)
    window.addEventListener('omni:paneltray-toggle', this._onTrayToggle)
  }
}
