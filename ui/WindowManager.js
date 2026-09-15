/**
 * ui/WindowManager.js — shared "OS window" behavior for panels
 *
 * Not a module in the BaseScene sense (no init/update/destroy, nothing
 * registered with addModule) — just a small set of functions any panel
 * calls into to get consistent behavior without duplicating it per
 * panel. Currently used by ui/OmniDraw.js and systems/OmniInspector.js.
 *
 * Provides:
 *   register(id, el)      — bring-to-front on click, enforces a 10-window
 *                            cap (forward-looking; nowhere near it today)
 *   unregister(id)        — call from a panel's destroy()
 *   makeMaximizable(el, btn) — wires a maximize/restore toggle: grows to
 *                            fill the viewport, goes slightly transparent,
 *                            and the button's glyph swaps to a restore
 *                            icon while maximized. Remembers the exact
 *                            pre-maximize rect to restore back to.
 *   wireSaveButton(btn, panelId, onSave) — flashes a ✓, timestamps the
 *                            save, persists "last saved" to localStorage
 *                            under omni:panel-lastsaved:{panelId}, and
 *                            updates the button's tooltip with it.
 *   getLastSaved(panelId)  — reads that timestamp back (e.g. on panel open)
 *   getFrontmost()          — id of the most-recently-focused panel
 *   registerContextMenu(contextId, categories) — a panel declares what it
 *                            contributes to the Global Context Menu (see
 *                            ui/GlobalBar.js) — { Objects: [{label,action}], ... }
 *   unregisterContextMenu(contextId)
 *   getContextMenu(contextId)
 */

import gsap from 'gsap'

const MAX_WINDOWS  = 50   // was 10 — far too low now that 24+ distinct panels exist and register here; raised with real headroom for continued growth (more OmniSystem formations, more OmniHUDs, multiple OmniBrowser windows at once)
const BASE_Z       = 200
const STORE_PREFIX = 'omni:panel-lastsaved:'

const registry = new Map()   // id -> { el }
let topZ = BASE_Z
let currentFrontmost = null

function injectStyles () {
  if (document.getElementById('omni-window-manager-styles')) return
  const tag = document.createElement('style')
  tag.id = 'omni-window-manager-styles'
  tag.textContent = /* css */`
    .win-maximized {
      opacity: 0.94 !important;
    }
    .win-max-btn {
      transition: color 0.12s ease, background 0.12s ease, border-color 0.12s ease;
    }
  `
  document.head.appendChild(tag)
}

/** Register a panel's root element for bring-to-front stacking. `label`
 *  is an optional human-readable name (e.g. 'OmniDraw') — used by the
 *  Global Context Menu's Windows category and app-title display; falls
 *  back to `id` if omitted. Returns false (and logs a warning) if the
 *  10-window cap is already full. */
export function register (id, el, label) {
  injectStyles()
  if (registry.has(id)) { bringToFront(id); return true }
  if (registry.size >= MAX_WINDOWS) {
    console.warn(`⟐ WindowManager — window cap (${MAX_WINDOWS}) reached, refusing to register "${id}".`)
    // Still give it a real z-index directly, even though it won't be
    // tracked for future bring-to-front stacking — the actual bug this
    // is guarding against was a panel silently stranded with no
    // z-index at all, rendered but completely unclickable underneath
    // something else. A panel outside the registry should degrade to
    // "can't be brought to front later," never to "can't be used at all."
    topZ += 1
    el.style.zIndex = String(topZ)
    return false
  }
  // Cascade positioning — every panel that registers gets this
  // automatically now, current and future, with zero per-panel code
  // needed. Computed here, before this window joins the registry
  // below, so it doesn't count itself in its own cascade math. Only
  // applies when nothing has already set an inline position — a
  // panel with deliberate positioning logic of its own (built before
  // this existed, or with a real reason to opt out) is left alone.
  if (!el.style.left && !el.style.top) {
    const cascade = getCascadePosition()
    el.style.left = `${cascade.left}px`
    el.style.top = `${cascade.top}px`
  }
  registry.set(id, { el, label: label ?? id })
  bringToFront(id, false)   // z-index only — not a real user focus event
  el.addEventListener('mousedown', () => bringToFront(id))
  return true
}

export function unregister (id) {
  registry.delete(id)
}

/** { id, label, isOpen } for every currently-registered panel — feeds
 *  the Global Context Menu's Windows category. isOpen is a best-effort
 *  guess from the element's own visibility, since WindowManager doesn't
 *  track each panel's open/closed state itself. */
export function getRegisteredWindows () {
  return [...registry.entries()].map(([id, { el, label }]) => ({
    id, label, el,
    isOpen: el.style.visibility !== 'hidden',
  }))
}

// ── Cascade positioning — "windows within windows," offset in the same
// direction consecutive opens always come out in, so each new one stays
// reachable without fully hiding whatever's behind it ────────────────
const CASCADE_LEFT_MARGIN = 24
const CASCADE_TOP_GAP     = 20   // below the header, not flush against it
const CASCADE_STEP        = 32   // px right + down per additional open window
const CASCADE_MAX_STEPS   = 8    // wraps back to the base position after this many

function _headerHeight () {
  // Measures the real header rather than hardcoding its height, so this
  // keeps working correctly even if the header's own height ever changes.
  const header = document.getElementById('omni-global-bar')
  return header ? header.getBoundingClientRect().height : 48
}

/**
 * Computes where a newly-opened panel should land: just under the
 * header (not centered), with a left margin, cascading diagonally
 * offset from however many other windows are already open — the same
 * placement order consecutive window opens are meant to come out in.
 * Call once, on a panel's first open, and apply the result as its
 * inline left/top — never call on every open, or a panel the user
 * already dragged would jump back into the cascade instead of staying
 * where they put it.
 */
export function getCascadePosition () {
  const openCount = [...registry.values()].filter(({ el }) => el.style.visibility !== 'hidden').length
  const step = openCount % CASCADE_MAX_STEPS
  return {
    left: CASCADE_LEFT_MARGIN + step * CASCADE_STEP,
    top: _headerHeight() + CASCADE_TOP_GAP + step * CASCADE_STEP,
  }
}

export function getLabel (id) {
  return registry.get(id)?.label ?? id
}

export function bringToFront (id, isUserAction = true) {
  const entry = registry.get(id)
  if (!entry) return
  topZ += 1
  entry.el.style.zIndex = String(topZ)

  // Only real user interaction (opening a panel, clicking into one)
  // should change what the Global Context Menu considers "focused."
  // Registration itself also needs a z-index bump (so a freshly built
  // panel renders above the background), but that's a layout concern,
  // not the user choosing to focus it — without this distinction, every
  // panel registering during boot would silently overwrite the context
  // menu's default with whichever one happened to register last.
  if (!isUserAction) return

  if (id && id !== currentFrontmost) {
    currentFrontmost = id
    window.dispatchEvent(new CustomEvent('omni:frontmost-changed', { detail: { id } }))
  }
}

/** The id most recently brought to front, or null if nothing has been
 *  focused yet. This is today's proxy for "current dimensional level" —
 *  see OmniDimensionalApps.md. Once apps grow real levels, a panel can
 *  register a more specific context id (e.g. 'omnidraw:edit-mode')
 *  instead of just its own panel id, without this function changing. */
export function getFrontmost () {
  return currentFrontmost
}

// ── Global Context Menu — per-context action registry ─────────────────────
// Panels register what they contribute under each of the 8 fixed
// categories (see ui/GlobalBar.js). Keyed by a context id — normally a
// panel's own id, but deliberately not required to be, so a panel with
// multiple dimensional levels can register a different action set per
// level later without this API changing.

const contextMenus = new Map()   // contextId -> { CategoryName: [{label, action}] }

/**
 * @param {string} contextId   — usually a panel's own id (e.g. 'omnidraw')
 * @param {object} categories  — { Objects: [{label, action}], ... } —
 *        only the categories this context actually contributes need be present
 */
export function registerContextMenu (contextId, categories) {
  contextMenus.set(contextId, categories)
}

export function unregisterContextMenu (contextId) {
  contextMenus.delete(contextId)
}

/** Categories contributed by the given context id, or {} if none registered. */
export function getContextMenu (contextId) {
  return contextMenus.get(contextId) ?? {}
}

/**
 * Wires a maximize/restore toggle. `btn` is the header button element;
 * its textContent is swapped between the maximize and restore glyphs.
 * Optional `onMaximize`/`onRestore` callbacks let the panel convert its
 * own content into a grid dashboard (see ui/GridWidgets.js) — this
 * function only owns the size/transparency mechanics, not what's inside.
 */
export function makeMaximizable (el, btn, { onMaximize, onRestore } = {}) {
  let saved  = null
  let isMax  = false
  const MAXIMIZE_GLYPH = '▢'
  const RESTORE_GLYPH  = '❐'

  btn.textContent = MAXIMIZE_GLYPH
  btn.title = 'Maximize'

  btn.addEventListener('click', () => {
    if (!isMax) {
      saved = {
        left: el.style.left, top: el.style.top,
        width: el.style.width, height: el.style.height,
      }
      el.classList.add('win-maximized')
      gsap.to(el, { left: '3vw', top: '3vh', width: '94vw', height: '94vh', duration: 0.3, ease: 'power2.out' })
      btn.textContent = RESTORE_GLYPH
      btn.title = 'Restore'
      isMax = true
      onMaximize?.()
    } else {
      el.classList.remove('win-maximized')
      if (saved) {
        gsap.to(el, { left: saved.left, top: saved.top, width: saved.width, height: saved.height, duration: 0.28, ease: 'power2.inOut' })
      }
      btn.textContent = MAXIMIZE_GLYPH
      btn.title = 'Maximize'
      isMax = false
      onRestore?.()
    }
    bringToFront(el.dataset.winId ?? '')
  })
}

/**
 * Wires a Save button: flashes a ✓, calls `onSave()` (panel-specific
 * persistence logic), then records + persists a "last saved" timestamp
 * for that panel, shown as the button's tooltip.
 */
export function wireSaveButton (btn, panelId, onSave) {
  const applyTooltip = () => {
    const last = getLastSaved(panelId)
    btn.title = last ? `Save to local storage — last saved ${last}` : 'Save to local storage'
  }
  applyTooltip()

  btn.addEventListener('click', () => {
    try { onSave?.() } catch (err) { console.warn(`⟐ WindowManager — save failed for "${panelId}":`, err) }

    const now = new Date()
    const stamp = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    try { localStorage.setItem(STORE_PREFIX + panelId, stamp) } catch (_) {}

    const original = btn.textContent
    btn.classList.add('is-saved')
    btn.textContent = '✓'
    applyTooltip()
    setTimeout(() => {
      btn.classList.remove('is-saved')
      btn.textContent = original
    }, 900)
  })
}

export function getLastSaved (panelId) {
  try { return localStorage.getItem(STORE_PREFIX + panelId) } catch (_) { return null }
}

// ── Panel opacity — shared "UI Settings" control from the Admin Panel ──────
// Panels already animate their own `opacity` via GSAP for open/close, so
// applying this as a plain CSS rule would conflict (inline styles set by
// GSAP always win over a CSS class). Instead, panels read this value and
// use it as their own open-animation TARGET instead of a hardcoded 1 —
// see getPanelOpacity() usage in ui/OmniDraw.js, systems/OmniInspector.js,
// and ui/AdminPanel.js's own open().

const DEFAULT_PANEL_OPACITY = 0.92

export function getPanelOpacity () {
  try {
    const raw = localStorage.getItem('omni:admin:settings')
    const v = raw ? JSON.parse(raw)?.uiSettings?.panelOpacity : undefined
    if (v === undefined || v === null) return DEFAULT_PANEL_OPACITY
    const n = Number(v)
    // A stored 0 (or anything too close to it) would make every panel
    // open fully invisible while still occupying space and still
    // blocking clicks to whatever's underneath — indistinguishable
    // from a "stuck, unresponsive" panel to the person using it.
    return Number.isFinite(n) && n >= 0.1 && n <= 1 ? n : DEFAULT_PANEL_OPACITY
  } catch (_) {
    return DEFAULT_PANEL_OPACITY
  }
}

/**
 * Wires a panel to live-update its opacity if Admin's Panel Opacity
 * setting changes while it's currently open (rather than only applying
 * on the next open). `isOpenFn` lets the caller report its own open
 * state without this module needing to know each panel's internals.
 */
export function watchPanelOpacity (el, isOpenFn) {
  window.addEventListener('omni:admin-settings-saved', (e) => {
    const raw = e.detail?.uiSettings?.panelOpacity
    if (raw === undefined || !isOpenFn()) return
    const v = Number(raw)
    if (!Number.isFinite(v) || v < 0.1 || v > 1) return   // same guard as getPanelOpacity — a bad live value should be ignored, not applied
    gsap.to(el, { opacity: v, duration: 0.25 })
  })
}
