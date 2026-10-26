/**
 * utils/StructureSpacingSettings.js — the real, shared "how far
 * apart" control behind every layout mode
 *
 * Confirmed directly: equidistant spacing between nodes, editable —
 * the one setting definitely wanted, with room for more later. One
 * real, persisted base value; every layout mode's own constant
 * scales proportionally off it, using each mode's existing real
 * ratio to the old hardcoded LINEAR_SPACING value — so at the
 * default, every layout looks exactly as it did before this, and
 * adjusting it scales every mode together, not just one.
 */

const STORE_KEY = 'omni:structure:spacing'
const DEFAULT_SPACING = 1.6   // matches the original, real LINEAR_SPACING value

let spacing = loadSpacing()

function loadSpacing () {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    const parsed = raw ? Number(raw) : DEFAULT_SPACING
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_SPACING
  } catch (_) {
    return DEFAULT_SPACING
  }
}

export function getSpacing () {
  return spacing
}

export function setSpacing (value) {
  if (!Number.isFinite(value) || value <= 0) return
  spacing = value
  try { localStorage.setItem(STORE_KEY, String(spacing)) } catch (_) { /* real save simply skipped if storage unavailable */ }
  window.dispatchEvent(new CustomEvent('omni:structure-spacing-changed', { detail: { spacing } }))
}

export function resetSpacing () {
  setSpacing(DEFAULT_SPACING)
}

export const DEFAULT_STRUCTURE_SPACING = DEFAULT_SPACING
