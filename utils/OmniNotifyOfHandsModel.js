/**
 * utils/OmniNotifyOfHandsModel.js (V235) — the maths and words of OmniNotifyOfHands, the small circle panel each hand has. No DOM, so it can be tested alone.
 *
 * Default spot (an ANCHOR, used until the person drags the panel; the dragged spot is then remembered):
 *   lower hands (lh, rh)   12 o'clock above the hand's movement pad, and 9 o'clock beside the ⬢ tools menu (RH: to its left; LH: to its right, the mirror)
 *   upper hands            the same, flipped: just below the pad (the bar is above it)
 * Always clamped inside the window. Falls back to the radial, then the corner, when the pad or radial is not on screen.
 */
export const SIZES = { min: 96, max: 320, def: 150, phone: 112, dot: 30 }
export const PHONE_MAX = 700
export const GAP = 10
export const MODES = ['orb', 'always', 'off']
export const LOWER = ['lh', 'rh']
export const NAMES = { lh: 'LH', rh: 'RH', conscious: 'ConsciousHand', omnihand: 'OmniHand' }

export const clamp = (v, lo, hi) => (lo > hi ? lo : Math.min(hi, Math.max(lo, v)))
const ok = (r) => !!r && r.width > 0 && r.height > 0

/** { x, y } top-left of a circle of diameter d. pad / rad: { left, top, width, height } or null. */
export function anchorFor (hand, pad, rad, vw, vh, d, gap = GAP) {
  const lower = LOWER.includes(hand), right = hand === 'rh' || hand === 'conscious'
  let x, y
  if (ok(rad)) x = right ? rad.left - gap - d : rad.left + rad.width + gap          // 9 o'clock of the tools menu (mirrored for hands on the left)
  if (ok(pad)) {
    if (x === undefined) x = pad.left + pad.width / 2 - d / 2                         // no radial: over the pad
    y = lower ? pad.top - gap - d : pad.top + pad.height + gap                        // 12 o'clock above the pad (lower hands) / just below it (upper hands)
  } else if (ok(rad)) y = rad.top + rad.height / 2 - d / 2
  if (x === undefined) x = right ? vw - d - 16 : 16
  if (y === undefined) y = lower ? vh - d - 120 : 130
  return clampPos({ x, y }, d, vw, vh)
}
export function clampPos (p, d, vw, vh, top = 52) {
  return { x: Math.round(clamp(p.x, 4, vw - d - 4)), y: Math.round(clamp(p.y, top, vh - d - 4)) }
}
export const defaultDiameter = (vw) => (vw <= PHONE_MAX ? SIZES.phone : SIZES.def)
export const clampDiameter = (d, vw) => Math.round(clamp(Number(d) || defaultDiameter(vw), SIZES.min, Math.min(SIZES.max, Math.max(SIZES.min, vw - 16))))

/** The text on the panel: a title, the main line (what the orb says), and a small state line. `s` = { hover:{title,text}|null, msg, orbOpen, ammo, speed, selected, idle }. */
export function compose (hand, s = {}) {
  const name = NAMES[hand] ?? hand
  const main = s.hover ? `${s.hover.title} · ${s.hover.text}` : (s.msg || s.idle || (s.orbOpen ? 'Hover a word or tool.' : 'Press ⦿ to open the orb.'))
  const bits = []
  if (s.ammo) bits.push(`Loaded ${s.ammo}`)
  if (Number.isFinite(s.speed)) bits.push(`Speed ${+s.speed.toFixed(2)}×`)
  if (s.selected) bits.push(`${s.selected} chosen`)
  bits.push(s.orbOpen ? 'orb open' : 'orb closed')
  return { title: name, main, state: bits.join(' · ') }
}
/** Should the panel show? mode: orb (while the hand's orb is open), always, off. A minimised panel still shows (as a dot). */
export const shouldShow = (mode, orbOpen) => mode === 'always' || (mode === 'orb' && !!orbOpen)
/** Font size (px) for the main text so it fits a circle of diameter d. */
export const fontFor = (d, len) => Math.round(clamp(d * (len > 90 ? 0.062 : len > 45 ? 0.072 : 0.085), 8, 17))
export function sanitizeStore (raw) {
  const out = {}
  if (!raw || typeof raw !== 'object') return out
  for (const h of Object.keys(NAMES)) { const r = raw[h]; if (!r || typeof r !== 'object') continue
    const e = {}; if (Number.isFinite(r.x) && Number.isFinite(r.y)) { e.x = r.x; e.y = r.y }; if (Number.isFinite(r.d)) e.d = clamp(r.d, SIZES.min, SIZES.max); if (typeof r.min === 'boolean') e.min = r.min
    out[h] = e }
  return out
}
