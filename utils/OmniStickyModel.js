/**
 * utils/OmniStickyModel.js (V266) — pure: a sticky note is a small, coloured preset of the OmniNote (utils/OmniNoteModel.js), optionally attached to another node.
 *   STICKY_COLORS            yellow, pink, blue, green, orange, purple (paper colours; the ink is always dark)
 *   stickyNote({ text, title, color }) -> a note patch for OmniNoteModel.sanitizeNote (plain text becomes safe paragraphs; nothing here ever writes raw html from the user)
 *   plainText(html)          -> the text of a note's html, for lists and tooltips
 *   sanitizeAttach(raw)      -> { to: id, off: [x, y, z] } | null          (idempotent, never throws, __proto__ safe, offsets clamped to +-1000)
 *   defaultOffset(index)     -> where the Nth note on one node sits, up and to the side
 *   followPosition(target, off) -> [x, y, z]       offsetFrom(target, pos) -> the offset that puts a note at pos (when you drag it)
 */
export const STICKY_COLORS = Object.freeze({ yellow: '#ffe97a', pink: '#ffb3d1', blue: '#a8d8ff', green: '#b6f0b0', orange: '#ffcf8a', purple: '#d6bfff' })
export const COLOR_NAMES = Object.freeze(Object.keys(STICKY_COLORS))
export const STICKY = Object.freeze({ width: 1.6, textMax: 600, titleMax: 40, offMax: 1000 })
const BAD = new Set(['__proto__', 'constructor', 'prototype'])
const escapeHtml = (t) => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

export function colorOf (name) { const k = String(name ?? '').trim().toLowerCase(); return STICKY_COLORS[k] ?? (/^#[0-9a-f]{6}$/i.test(k) ? k : STICKY_COLORS.yellow) }

export function stickyNote (opts = {}) {
  const o = opts && typeof opts === 'object' ? opts : {}
  const text = String(o.text ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').slice(0, STICKY.textMax)
  const paras = text.split(/\n+/).map(s => s.trim()).filter(Boolean)
  const html = paras.length ? paras.map(p => `<p>${escapeHtml(p)}</p>`).join('') : '<p></p>'
  return { title: String(o.title ?? 'Sticky').replace(/[<>\u0000-\u001f]/g, ' ').trim().slice(0, STICKY.titleMax) || 'Sticky', html, paper: colorOf(o.color), ink: '#2b2b2b', font: 'hand', size: 34, width: STICKY.width, fit: 'grow', sides: 'double', frame: false, res: 512, margin: 36, lineHeight: 1.25 }
}
export function plainText (html) { return String(html ?? '').replace(/<\/p>|<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').trim() }

const idOk = (v) => typeof v === 'string' && /^[\w-]{1,80}$/.test(v) && !BAD.has(v)
const clampN = (v, d) => { const n = Number(v); return Number.isFinite(n) ? Math.max(-STICKY.offMax, Math.min(STICKY.offMax, n)) : d }
export function sanitizeAttach (raw) {
  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : null; if (!r || !idOk(r.to)) return null
  const o = Array.isArray(r.off) ? r.off : []; return { to: r.to, off: [clampN(o[0], 1.6), clampN(o[1], 1.2), clampN(o[2], 0.1)] }
}
export const defaultOffset = (index = 0) => { const i = Math.max(0, Math.min(50, Math.floor(Number(index) || 0))); return [1.6 + (i % 3) * 0.15, 1.2 + i * 0.55, 0.1] }
export const followPosition = (target, off) => [target[0] + off[0], target[1] + off[1], target[2] + off[2]]
export const offsetFrom = (target, pos) => [pos[0] - target[0], pos[1] - target[1], pos[2] - target[2]].map(v => clampN(v, 0))
export default { STICKY_COLORS, COLOR_NAMES, STICKY, colorOf, stickyNote, plainText, sanitizeAttach, defaultOffset, followPosition, offsetFrom }
