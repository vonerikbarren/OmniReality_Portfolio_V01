/**
 * utils/OmniBoostState.js (V220) — the one number the movement code reads: how much a hand's boost is multiplying its speed right now.
 * systems/OmniBoost.js writes it every frame; ui/MovementPad.js multiplies it into the hand's eased speed. 1 when no boost.
 */
const f = { lh: 1, rh: 1 }
export const BOOST_HANDS = ['lh', 'rh']
export const getBoostFactor = (hand) => (Number.isFinite(f[hand]) && f[hand] >= 1 ? f[hand] : 1)
export function setBoostFactor (hand, v) { if (hand in f) f[hand] = Number.isFinite(v) ? Math.max(1, Math.min(200, v)) : 1 }
