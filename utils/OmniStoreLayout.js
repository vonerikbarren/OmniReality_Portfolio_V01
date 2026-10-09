/**
 * utils/OmniStoreLayout.js — where the store's floating UI may sit without covering the hands (V176)
 *
 * The four hand matrices (.omni-hand--tl / --tr / --bl / --br, ui/Hand.js) sit in the viewport corners. For a band of the
 * viewport between two y values, handsSafe() returns the free horizontal range [left, right] between them, so the store HUD,
 * the exchange panel and the shelf framing stay clear of the hands. Hidden hands (banner / bottom pair toggled off) are
 * ignored. Pure measuring; no state.
 */

const HAND_SELECTOR = '.omni-hand--tl, .omni-hand--tr, .omni-hand--bl, .omni-hand--br'
const LABEL_PAD = 18   // each hand has a caption under its matrix

export function handsSafe (top, bottom, margin = 8) {
  const W = window.innerWidth || 1280
  let left = 0, right = W
  if (typeof document === 'undefined') return { left, right }
  document.querySelectorAll(HAND_SELECTOR).forEach(h => {
    const cs = getComputedStyle(h)
    if (cs.display === 'none' || cs.visibility === 'hidden') return
    const r = h.getBoundingClientRect()
    if (!r.width || !r.height) return
    if (r.bottom + LABEL_PAD <= top || r.top >= bottom) return
    if (r.left + r.width / 2 < W / 2) left = Math.max(left, r.right + margin)
    else right = Math.min(right, r.left - margin)
  })
  return { left, right }
}

export const DOCK_H = 52
export const isPhone = () => (window.innerWidth || 1280) <= 700
