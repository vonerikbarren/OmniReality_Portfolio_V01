/**
 * utils/OmniTypingShield.js (V238) — lets a marked area take every key for typing.
 *
 * Mark an element with  data-omni-typing  (the OmniNote editor does). While the focus is on a text field or editable text INSIDE it, key events
 * (keydown / keyup / keypress) are stopped at the very top of the page, before any scene, ribbon, hand, panel or Ctrl/Cmd shortcut sees them. The browser still types
 * the character and still does its own editing (select all, copy, paste, undo, bold). Escape is the way out: it takes the focus out of the field and then works as usual.
 * Installed once, at import, as the FIRST window capture listener (main.js imports it first), so nothing registered later can run before it.
 */
const KEYS = ['keydown', 'keyup', 'keypress']
let installed = false

export const inTypingArea = (el) => {
  if (!el || el.nodeType !== 1) return false
  const field = el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable
  return !!field && !!el.closest?.('[data-omni-typing]')
}

export function install (win = typeof window !== 'undefined' ? window : null) {
  if (!win || win.__omniTypingShield) return false
  win.__omniTypingShield = true
  const handler = (e) => {
    const t = e.target && e.target.nodeType === 1 ? e.target : win.document?.activeElement
    if (!inTypingArea(t)) return
    if (e.type === 'keydown' && e.key === 'Escape') { try { t.blur() } catch (_) {} return }   // the way out: leave the field, let Escape work normally
    e.stopImmediatePropagation()
  }
  for (const k of KEYS) win.addEventListener(k, handler, true)
  installed = true
  return true
}
export const isInstalled = () => installed

if (typeof window !== 'undefined') install()
