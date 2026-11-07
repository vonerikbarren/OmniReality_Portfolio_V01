/**
 * utils/OmniKeyGlyphs.js — the glyph palette of the OmniPassKeyRing (V276). Pure: builds SVG text from numbers only, no DOM.
 *
 * 50 generic glyphs, our own: 10 outlines x 5 inner marks. The glyph alone says nothing: the visitor decides what one stands for,
 * then picks it and types the string it is bound to. (Option for later: generate the glyph from the string as a typo check.)
 * No fonts, no unicode symbols, no emoji: each glyph is a few path commands in a 24 x 24 box, drawn with currentColor.
 */

export const OUTLINES = Object.freeze(['circle', 'triangle', 'square', 'diamond', 'pentagon', 'hexagon', 'octagon', 'star4', 'star5', 'cross'])
export const MARKS = Object.freeze(['none', 'dot', 'bar', 'stem', 'ring'])
export const GLYPH_COUNT = OUTLINES.length * MARKS.length   // 50

/** A glyph id as an integer 0..49, or null when it is not one. Never throws. */
export function sanitizeGlyphId (raw) {
  const n = typeof raw === 'number' ? raw : (typeof raw === 'string' && /^\d{1,3}$/.test(raw) ? Number(raw) : NaN)
  return Number.isInteger(n) && n >= 0 && n < GLYPH_COUNT ? n : null
}

export function glyphName (id) {
  const g = sanitizeGlyphId(id); if (g === null) return ''
  const o = OUTLINES[g % OUTLINES.length], m = MARKS[Math.floor(g / OUTLINES.length)]
  return m === 'none' ? o : `${o} with ${m}`
}

const f = (v) => (Math.round(v * 100) / 100).toString()
function poly (n, r, rot) {
  let d = ''
  for (let i = 0; i < n; i++) { const a = rot + i * 2 * Math.PI / n; d += (i ? 'L' : 'M') + f(12 + Math.cos(a) * r) + ' ' + f(12 + Math.sin(a) * r) }
  return d + 'Z'
}
function star (n, R, r, rot) {
  let d = ''
  for (let i = 0; i < n * 2; i++) { const a = rot + i * Math.PI / n, rr = i % 2 ? r : R; d += (i ? 'L' : 'M') + f(12 + Math.cos(a) * rr) + ' ' + f(12 + Math.sin(a) * rr) }
  return d + 'Z'
}
const UP = -Math.PI / 2
const OUTLINE_PATH = {
  circle: 'M12 3a9 9 0 1 0 0.001 0Z',
  triangle: poly(3, 10, UP),
  square: 'M4 4H20V20H4Z',
  diamond: poly(4, 10, UP),
  pentagon: poly(5, 9.6, UP),
  hexagon: poly(6, 9.6, 0),
  octagon: poly(8, 9.6, Math.PI / 8),
  star4: star(4, 10, 4, UP),
  star5: star(5, 10, 4.2, UP),
  cross: 'M9 3H15V9H21V15H15V21H9V15H3V9H9Z'
}
const MARK_SVG = {
  none: '',
  dot: '<circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none"/>',
  bar: '<path d="M8 12H16"/>',
  stem: '<path d="M12 8V16"/>',
  ring: '<circle cx="12" cy="12" r="2.6"/>'
}

/** The SVG text for glyph `id` (empty string for an invalid id). `size` is the pixel size (8..128). Safe to put in innerHTML: only fixed text and numbers. */
export function glyphSvg (id, size = 24) {
  const g = sanitizeGlyphId(id); if (g === null) return ''
  const px = Math.min(128, Math.max(8, Math.round(Number.isFinite(size) ? size : 24)))
  const o = OUTLINES[g % OUTLINES.length], m = MARKS[Math.floor(g / OUTLINES.length)]
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${px}" height="${px}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="${OUTLINE_PATH[o]}"/>${MARK_SVG[m]}</svg>`
}

/** Every glyph as { id, name, svg } (for the palette grid). */
export function allGlyphs (size = 24) {
  const out = []
  for (let i = 0; i < GLYPH_COUNT; i++) out.push({ id: i, name: glyphName(i), svg: glyphSvg(i, size) })
  return out
}
