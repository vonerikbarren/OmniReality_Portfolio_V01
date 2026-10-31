/**
 * utils/OmniWalkKeys.js (V252) — the Alt chords for lineup walking and page flipping. Pure: maps a KeyboardEvent-like
 * object to an action or null. Uses e.code so it works on every layout (and on Mac, where Alt changes e.key).
 *   Alt+W  walk / stop      Alt+, / Alt+.  previous / next stop      Alt+[ / Alt+]  page back / forward
 */
export const WALK_KEYS = Object.freeze({
  KeyW: { event: 'omni:lineup-request', detail: { action: 'walkFirst' } },
  Comma: { event: 'omni:lineup-request', detail: { action: 'prev' } },
  Period: { event: 'omni:lineup-request', detail: { action: 'next' } },
  BracketLeft: { event: 'omni:docwindow-request', detail: { action: 'flip', dir: -1 } },
  BracketRight: { event: 'omni:docwindow-request', detail: { action: 'flip', dir: 1 } }
})

/** Returns { event, detail } for an Alt chord, or null (no Ctrl/Meta/Shift, not repeating, not typing). */
export function walkKeyAction (e, typing = false) {
  if (!e || typing || !e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || e.repeat) return null
  return WALK_KEYS[e.code] ?? null
}

export function isTypingTarget (el) {
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || !!el.isContentEditable)
}
