/**
 * utils/OmniExpressionFlag.js (V195) — the one-bit "Expression typing mode is ON" flag, readable by any key handler without importing the mode.
 *
 * Why: the mode (systems/OmniExpressionTyping.js) swallows keys in a window CAPTURE listener, but a few older modules registered their own window capture
 * listeners EARLIER (OmniStarLight, OmniStateStrictAlign, OmniChronos, utils/TerminalSceneInput) and so run first. Each of them starts with
 * `if (isExpressionOn()) return` so nothing but the mode ever sees a key while it is on. The flag lives on <html data-omni-expression="on"> (also handy for CSS).
 * Pure; no imports; safe without a DOM.
 */
export const ATTR = 'data-omni-expression'
export function isExpressionOn () {
  try { return typeof document !== 'undefined' && document.documentElement?.getAttribute(ATTR) === 'on' } catch (_) { return false }
}
export function setExpressionFlag (on) {
  try {
    if (typeof document === 'undefined' || !document.documentElement) return
    if (on) document.documentElement.setAttribute(ATTR, 'on'); else document.documentElement.removeAttribute(ATTR)
  } catch (_) { /* no DOM */ }
}
export default { ATTR, isExpressionOn, setExpressionFlag }
