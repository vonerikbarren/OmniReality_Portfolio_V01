/**
 * utils/OmniChargeTier.js (V229) — what a charged shot does. Pure numbers, no DOM.
 *
 *   charge 0 .. 0.39   normal    the ammo fires exactly as it always did
 *   charge 0.4 .. 0.97 strong    the behaviour's strength-type settings (speed, radius, strength...) are scaled up: x1.5 at 40%, x2 just under full
 *   charge 0.98 .. 1   full      x2.5, and a multi-target behaviour (Attract, Repel, Cascade...) gets 2 more anchor nodes: a wider reach
 * Scaled values stay inside each setting's own min / max, and settings that are not "how much" (axis, offsets, phase, timing, counts) are never touched.
 */
export const STRONG_AT = 0.4
export const FULL_AT = 0.98
export const STRENGTH_KEYS = ['speed', 'radius', 'maxSpeed', 'rate', 'amplitude', 'strength', 'range', 'push']
export const TIER_NAMES = ['normal', 'strong', 'full']

export function tierOf (charge) {
  const c = Math.max(0, Math.min(1, Number(charge) || 0))
  if (c >= FULL_AT) return { name: 'full', rank: 2, factor: 2.5, extraAnchors: 2, tracers: 3, charge: c }
  if (c >= STRONG_AT) return { name: 'strong', rank: 1, factor: +(1.5 + 0.5 * (c - STRONG_AT) / (FULL_AT - STRONG_AT)).toFixed(3), extraAnchors: 0, tracers: 2, charge: c }
  return { name: 'normal', rank: 0, factor: 1, extraAnchors: 0, tracers: 1, charge: c }
}
export const rankOf = (name) => Math.max(0, TIER_NAMES.indexOf(name))

/** A copy of params with the strength-type numbers multiplied by factor and clamped to the schema's range. */
export function scaleParams (params, schema, factor) {
  const out = { ...params }
  if (!(factor > 1)) return out
  for (const f of schema ?? []) {
    if (f.type !== 'number' || !STRENGTH_KEYS.includes(f.key) || !Number.isFinite(out[f.key])) continue
    const v = out[f.key] * factor
    out[f.key] = +Math.min(f.max, Math.max(f.min, v)).toFixed(3)
  }
  return out
}
