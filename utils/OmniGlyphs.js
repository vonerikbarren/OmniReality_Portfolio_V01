/**
 * utils/OmniGlyphs.js — shared text glyphs (V191). Pure data, no DOM.
 *
 * EYE_GLYPH is the perspective "eye": U+25C9 FISHEYE, a plain Geometric Shapes character. It has NO emoji presentation, so it
 * renders as text in the current font colour everywhere. The colour emoji eye U+1F441 (and the variation selector U+FE0F that
 * forces emoji style) must never be used for it; a test enforces that. Defined here once: utils/OmniAddress.js (EYE) and the
 * ribbon's Perspectives button (ui/OmniRibbon.js) both use this constant.
 */
export const EYE_GLYPH = '◉'
