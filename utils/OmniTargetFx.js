/**
 * utils/OmniTargetFx.js (V227) — pure helpers for the Targeting look: settings (clamped, saved), the "focusing" pulse, and the white bolts that strike the node.
 * No DOM-less THREE here except plain arrays, so it is testable on its own. Used by modules/OmniTargeting.js and ui/OmniTargetingSettingsPanel.js.
 *
 * Settings (key 'omni:targeting:settings:v2'; the old key had a black base colour that would be invisible when drawn bright, so it is not read any more):
 *   opacity 0.1..1 (1 = solid)   speed 0..10 (spin multiplier; 3 = default, the old look was about 1)   glow 0..4 (brightness)   bolts 0..20 (strikes per second)
 */
export const STORE_KEY = 'omni:targeting:settings:v2'
export const DEFAULTS = { geometry: 'TetrahedronGeometry', color: '#ffffff', opacity: 1, speed: 3, glow: 1.5, bolts: 4, activeSlot: null }
export const RANGES = { opacity: [0.1, 1], speed: [0, 10], glow: [0, 4], bolts: [0, 20] }

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
/** Keep only known keys, with numbers clamped. `alpha` is accepted as another name for `opacity`. */
export function clean (patch = {}) {
  const out = {}, p = { ...patch }
  if (p.alpha !== undefined && p.opacity === undefined) p.opacity = p.alpha
  for (const k of Object.keys(RANGES)) if (p[k] !== undefined && Number.isFinite(Number(p[k]))) out[k] = +clamp(Number(p[k]), ...RANGES[k]).toFixed(3)
  if (typeof p.geometry === 'string') out.geometry = p.geometry
  if (typeof p.color === 'string' && /^#[0-9a-f]{6}$/i.test(p.color)) out.color = p.color
  if (p.activeSlot === null || Number.isInteger(p.activeSlot)) if ('activeSlot' in p) out.activeSlot = p.activeSlot
  return out
}
export function load () {
  try { const raw = JSON.parse(localStorage.getItem(STORE_KEY)); return { ...DEFAULTS, ...clean(raw ?? {}) } } catch (_) { return { ...DEFAULTS } }
}
export function save (s) { try { localStorage.setItem(STORE_KEY, JSON.stringify(s)) } catch (_) {} }

/** The ring breathes in and out as if trying to focus: returns multipliers for the ring radius and the spin. */
export function focus (t, speed) {
  const w = t * (0.8 + 0.25 * speed)
  return { radius: 1 + 0.14 * Math.sin(w) + 0.05 * Math.sin(w * 2.7), spin: 1 + 0.3 * Math.sin(w * 0.5) }
}

/** A jagged line from a to b: [x,y,z, x,y,z, ...] with `segs` pieces. The ends stay exactly on a and b. */
export function boltPoints (rng, a, b, segs = 7, jitter = 0.18) {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], len = Math.hypot(...d) || 1, out = []
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, edge = i === 0 || i === segs ? 0 : 1, j = jitter * len * edge * Math.sin(Math.PI * t) ** 0.5
    out.push(a[0] + d[0] * t + (rng() - 0.5) * 2 * j, a[1] + d[1] * t + (rng() - 0.5) * 2 * j, a[2] + d[2] * t + (rng() - 0.5) * 2 * j)
  }
  return out
}
/** A random point on a sphere of radius r around the origin. */
export function surfacePoint (rng, r) {
  const u = rng() * 2 - 1, th = rng() * Math.PI * 2, s = Math.sqrt(1 - u * u)
  return [r * s * Math.cos(th), r * u, r * s * Math.sin(th)]
}
/** How many bolts to start this frame (carries the fraction over so the rate stays true at any frame rate). */
export function strikes (acc, perSecond, dt) { const a = acc + perSecond * dt; const n = Math.floor(a); return { n, acc: a - n } }
