/**
 * utils/OmniTelepromptModel.js (V285) — settings and message rules of the OmniTeleprompt: an edge panel (bottom, left or top) that gives the user information.
 * Pure: no DOM. UI: ui/OmniTeleprompt.js.
 *   settings  { edge:'bottom'|'left'|'top', size (px: the panel's height on bottom / top, its width on the left), fontSize, opacity, dark, scroll (px per second, 0 = still), seconds (auto hide, 0 = stays) }
 *   message   { title, text, edge?, seconds? }  text is plain text (shown as text, never as HTML)
 */
export const EDGES = ['bottom', 'left', 'top']
export const LIMITS = Object.freeze({ size: [80, 600], fontSize: [10, 40], opacity: [0.3, 1], scroll: [0, 400], seconds: [0, 600], text: 4000, title: 80 })
export const DEFAULTS = Object.freeze({ edge: 'bottom', size: 150, fontSize: 15, opacity: 0.94, dark: false, scroll: 0, seconds: 0 })
const own = (o, k) => o && typeof o === 'object' && Object.prototype.hasOwnProperty.call(o, k) ? o[k] : undefined
const num = (v, [lo, hi], d) => { const n = typeof v === 'number' ? v : (typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d }
const clean = (v, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').slice(0, max) : '')

/** never throws, idempotent */
export function sanitizeTeleprompt (raw) {
  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  return { edge: EDGES.includes(own(r, 'edge')) ? r.edge : DEFAULTS.edge, size: Math.round(num(own(r, 'size'), LIMITS.size, DEFAULTS.size)), fontSize: Math.round(num(own(r, 'fontSize'), LIMITS.fontSize, DEFAULTS.fontSize)),
    opacity: Math.round(num(own(r, 'opacity'), LIMITS.opacity, DEFAULTS.opacity) * 100) / 100, dark: typeof own(r, 'dark') === 'boolean' ? r.dark : DEFAULTS.dark, scroll: Math.round(num(own(r, 'scroll'), LIMITS.scroll, DEFAULTS.scroll)), seconds: Math.round(num(own(r, 'seconds'), LIMITS.seconds, DEFAULTS.seconds)) }
}
/** a message to show: the text and title are cut to size; an edge or seconds on the message win over the settings for that one showing */
export function sanitizeMessage (raw) {
  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}; const text = clean(own(r, 'text'), LIMITS.text).trim(); const title = clean(own(r, 'title'), LIMITS.title).trim()
  const out = { title, text }; if (EDGES.includes(own(r, 'edge'))) out.edge = r.edge; if (own(r, 'seconds') !== undefined) out.seconds = Math.round(num(r.seconds, LIMITS.seconds, 0))
  return out
}
/** the box of the panel in CSS terms for an edge, given the room the other chrome takes (px). Pure so the layout can be tested. */
export function boxFor (edge, size, inset = {}) {
  const top = Math.max(0, Number(inset.top) || 0), bottom = Math.max(0, Number(inset.bottom) || 0), s = Math.round(num(size, LIMITS.size, DEFAULTS.size))
  if (edge === 'left') return { left: 0, top, bottom, width: s, height: 'auto' }
  if (edge === 'top') return { left: 0, right: 0, top, height: s }
  return { left: 0, right: 0, bottom, height: s }
}
