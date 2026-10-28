/**
 * utils/OmniConstructionModel.js (V232) — the maths of the OmniConstruction painter, with no DOM and no Three.js, so it can be tested alone.
 *
 * A "spray" is a drag across the scene. Every step of the drag finds a point in space (on the ground plane, or a set distance in the air),
 * and drops `density` pieces in a ball of `radius` around it, never closer together than `spacing`. Pieces are small nodes in the Sandbox.
 */
import { makeRng } from './OmniRemixModel.js'

export const SHAPES = ['BoxGeometry', 'SphereGeometry', 'ConeGeometry', 'CylinderGeometry', 'TorusGeometry', 'OctahedronGeometry', 'IcosahedronGeometry', 'DodecahedronGeometry', 'TetrahedronGeometry']
export const MODES = ['ground', 'air']
export const DEFAULTS = { shape: 'SphereGeometry', color: '#7fd6ff', size: 0.5, radius: 1.5, density: 3, spacing: 0.6, jitterColor: 0.15, mode: 'ground', height: 0, distance: 12, rainbow: false }
export const RANGES = { size: [0.1, 4], radius: [0, 10], density: [1, 8], spacing: [0.1, 5], jitterColor: [0, 1], height: [-5, 50], distance: [2, 60] }
export const MAX_PER_STEP = 8

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const hex = (n) => Math.round(clamp(n, 0, 255)).toString(16).padStart(2, '0')

/** Validate and clamp a partial settings object over a base. Throws a plain message on a bad shape / mode / colour. */
export function normalise (patch = {}, base = DEFAULTS) {
  const s = { ...base }
  for (const k of Object.keys(patch)) {
    if (!(k in DEFAULTS)) throw new Error(`unknown brush setting "${k}"; valid: ${Object.keys(DEFAULTS).join(', ')}`)
    const v = patch[k]
    if (k === 'shape') {
      const m = SHAPES.find(x => x.toLowerCase() === String(v).toLowerCase() || x.toLowerCase() === String(v).toLowerCase() + 'geometry')
      if (!m) throw new Error(`shape is one of: ${SHAPES.map(x => x.replace('Geometry', '').toLowerCase()).join(', ')}`)
      s.shape = m
    } else if (k === 'mode') {
      const m = String(v).toLowerCase(); if (!MODES.includes(m)) throw new Error(`mode is one of: ${MODES.join(', ')}`); s.mode = m
    } else if (k === 'color') {
      if (!/^#[0-9a-f]{6}$/i.test(String(v))) throw new Error('color needs a #rrggbb value'); s.color = String(v).toLowerCase()
    } else if (k === 'rainbow') { s.rainbow = v === true || String(v).toLowerCase() === 'true' }
    else { const n = Number(v); if (!Number.isFinite(n)) throw new Error(`${k} needs a number`); s[k] = clamp(k === 'density' ? Math.round(n) : n, ...RANGES[k]) }
  }
  return s
}

/** Nudge a #rrggbb colour by up to `amt` (0..1) in each channel. */
export function jitterColor (color, amt, rng) {
  if (!amt) return color
  const c = parseInt(color.slice(1), 16), ch = [(c >> 16) & 255, (c >> 8) & 255, c & 255]
  return '#' + ch.map(v => hex(v + (rng() * 2 - 1) * amt * 255)).join('')
}

/** HSL hue (0..360) to #rrggbb at fixed saturation / lightness: the rainbow brush. */
export function hueColor (h) {
  const s = 0.75, l = 0.6, a = s * Math.min(l, 1 - l), f = (n) => { const k = (n + h / 30) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)) }
  return '#' + [f(0), f(8), f(4)].map(v => hex(v * 255)).join('')
}

/** Where a ray (origin o, direction d, both [x,y,z]) lands for the brush: ground = plane y=height, air = `distance` along the ray. Returns null if it never lands. */
export function hitPoint (o, d, s) {
  if (s.mode === 'air') return [o[0] + d[0] * s.distance, o[1] + d[1] * s.distance, o[2] + d[2] * s.distance]
  if (Math.abs(d[1]) < 1e-4) return null
  const t = (s.height - o[1]) / d[1]; if (t <= 0 || t > 400) return null
  return [o[0] + d[0] * t, s.height, o[2] + d[2] * t]
}

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

/**
 * One spray step. `state` is { last: [x,y,z]|null, count } for the stroke (kept by the caller). Returns the pieces to make:
 * [{ position, color, scale, geometry }]. Nothing is returned until the point has moved at least `spacing` from the last one.
 * `room` is how many more pieces may be made at all.
 */
export function sprayStep (point, s, state, rng, room = Infinity) {
  if (!point || room <= 0) return []
  if (state.last && dist(point, state.last) < s.spacing) return []
  state.last = point.slice()
  const n = Math.min(s.density, MAX_PER_STEP, room), out = []
  for (let i = 0; i < n; i++) {
    // uniform point in a ball (rejection sampling is cheap and unbiased)
    let p; do { p = [rng() * 2 - 1, rng() * 2 - 1, rng() * 2 - 1] } while (p[0] * p[0] + p[1] * p[1] + p[2] * p[2] > 1)
    // ground: pieces sit on the plane inside a flat disc, so a stroke reads as a band; air: the full ball
    const y = s.mode === 'ground' ? point[1] + s.size / 2 : point[1] + p[1] * s.radius
    const pos = [point[0] + p[0] * s.radius, y, point[2] + p[2] * s.radius].map(v => +v.toFixed(3))
    const base = s.rainbow ? hueColor((state.count * 9 + i * 23) % 360) : s.color
    out.push({ position: pos, color: jitterColor(base, s.jitterColor, rng), scale: [s.size, s.size, s.size], geometry: s.shape })
  }
  state.count += n
  return out
}

export { makeRng }
