/**
 * ui/WindowManager.js — shared "OS window" behavior for panels
 *
 * Not a module in the BaseScene sense (no init/update/destroy, nothing
 * registered with addModule) — just a small set of functions any panel
 * calls into to get consistent behavior without duplicating it per
 * panel. Currently used by ui/ObjectPanel.js and systems/OmniInspector.js.
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
 */

import gsap from 'gsap'

const MAX_WINDOWS  = 10
const BASE_Z       = 200
const STORE_PREFIX = 'omni:panel-lastsaved:'

const registry = new Map()   // id -> { el }
let topZ = BASE_Z

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

/** Register a panel's root element for bring-to-front stacking. Returns
 *  false (and logs a warning) if the 10-window cap is already full. */
export function register (id, el) {
  injectStyles()
  if (registry.has(id)) { bringToFront(id); return true }
  if (registry.size >= MAX_WINDOWS) {
    console.warn(`⟐ WindowManager — window cap (${MAX_WINDOWS}) reached, refusing to register "${id}".`)
    return false
  }
  registry.set(id, { el })
  bringToFront(id)
  el.addEventListener('mousedown', () => bringToFront(id))
  return true
}

export function unregister (id) {
  registry.delete(id)
}

export function bringToFront (id) {
  const entry = registry.get(id)
  if (!entry) return
  topZ += 1
  entry.el.style.zIndex = String(topZ)
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
