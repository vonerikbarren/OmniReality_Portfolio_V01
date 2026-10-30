/**
 * utils/OmniCurveModel.js (V246) — pure: a hand-drawn loop curve for a vibration channel, and the maths of the editor that draws it.
 * A curve is points [[x, y], ...] over ONE cycle: x 0..1 (time through the beat), y -1..1 (the channel is amp * y). It always starts at x = 0 and ends at x = 1 with the SAME y, so it loops.
 *   sanitizeCurve(raw) -> points (2..16, x sorted and kept apart, y clamped, the loop closed)       curveAt(points, u) -> y (smooth: a cosine ease between neighbours)
 *   curveFromWave(waveFn, n) -> n sampled points (to start editing from any wave)
 *   snapPoint(p, grid) · movePoint(points, i, x, y, grid) · addPoint(points, x, y, grid) · removePoint(points, i) · nearest(points, x, y, rx, ry)
 * Never throws; hostile input falls back to a gentle hump.
 */
export const CURVE_LIMITS = Object.freeze({ min: 2, max: 16, gap: 0.01 })
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const num = (v, d) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : d)
export const DEFAULT_CURVE = Object.freeze([[0, 0], [0.5, 1], [1, 0]])

export function sanitizeCurve (raw) {
  const pts = []
  if (Array.isArray(raw)) for (const p of raw.slice(0, 64)) { if (Array.isArray(p) && p.length >= 2) pts.push([clamp(num(p[0], 0), 0, 1), clamp(num(p[1], 0), -1, 1)]) }
  if (pts.length < CURVE_LIMITS.min) return DEFAULT_CURVE.map(p => p.slice())
  pts.sort((a, b) => a[0] - b[0])
  const out = []
  for (const p of pts) { if (out.length && p[0] - out[out.length - 1][0] < CURVE_LIMITS.gap) continue; out.push([Math.round(p[0] * 1e4) / 1e4, Math.round(p[1] * 1e4) / 1e4]) }
  if (out.length < CURVE_LIMITS.min) return DEFAULT_CURVE.map(p => p.slice())
  out[0][0] = 0; out[out.length - 1][0] = 1; out[out.length - 1][1] = out[0][1]      // the loop is closed
  while (out.length > CURVE_LIMITS.max) out.splice(Math.floor(out.length / 2), 1)
  if (out.length >= 2 && out[out.length - 1][0] - out[out.length - 2][0] < CURVE_LIMITS.gap) out.splice(out.length - 2, 1)
  return out
}

export function curveAt (points, u) {
  const p = points; const x = u - Math.floor(u)
  let i = 0; while (i < p.length - 2 && x > p[i + 1][0]) i++
  const a = p[i]; const b = p[i + 1]; const w = b[0] - a[0]
  if (w <= 0) return a[1]
  const f = clamp((x - a[0]) / w, 0, 1); const e = (1 - Math.cos(f * Math.PI)) / 2
  return a[1] + (b[1] - a[1]) * e
}

export function curveFromWave (fn, n = 12) {
  const N = clamp(Math.round(n), 3, CURVE_LIMITS.max); const pts = []
  for (let i = 0; i < N; i++) pts.push([i / (N - 1), 0])
  let hi = 0; const ys = pts.map(p => { const v = Number(fn(p[0])); return Number.isFinite(v) ? v : 0 }); for (const v of ys) hi = Math.max(hi, Math.abs(v))
  const k = hi > 1 ? 1 / hi : 1
  return sanitizeCurve(pts.map((p, i) => [p[0], ys[i] * k]))
}

export const snap = (v, g) => (g > 0 ? Math.round(v / g) * g : v)
export function movePoint (points, i, x, y, grid = { x: 0, y: 0 }) {
  const p = points.map(q => q.slice()); if (i < 0 || i >= p.length) return p
  let ny = clamp(snap(y, grid.y), -1, 1)
  if (i === 0 || i === p.length - 1) { p[0][1] = ny; p[p.length - 1][1] = ny; return p }          // the ends are the same point of the loop: they move together, only up and down
  const lo = p[i - 1][0] + CURVE_LIMITS.gap; const hi = p[i + 1][0] - CURVE_LIMITS.gap
  p[i] = [clamp(snap(x, grid.x), lo, Math.max(lo, hi)), ny]
  return sanitizeCurve(p)
}
export function addPoint (points, x, y, grid = { x: 0, y: 0 }) {
  if (points.length >= CURVE_LIMITS.max) return points
  const nx = clamp(snap(x, grid.x), CURVE_LIMITS.gap, 1 - CURVE_LIMITS.gap)
  if (points.some(q => Math.abs(q[0] - nx) < CURVE_LIMITS.gap)) return points
  return sanitizeCurve([...points, [nx, clamp(snap(y, grid.y), -1, 1)]])
}
export function removePoint (points, i) { if (points.length <= CURVE_LIMITS.min + 0 || i <= 0 || i >= points.length - 1) return points; return sanitizeCurve(points.filter((_, k) => k !== i)) }
/** The index of the point nearest (x, y) within the radii (in curve units), or -1. */
export function nearest (points, x, y, rx = 0.04, ry = 0.08) {
  let best = -1; let bd = Infinity
  points.forEach((p, i) => { const d = ((p[0] - x) / rx) ** 2 + ((p[1] - y) / ry) ** 2; if (d <= 1 && d < bd) { bd = d; best = i } })
  return best
}
export default { sanitizeCurve, curveAt, curveFromWave, movePoint, addPoint, removePoint, nearest, snap, DEFAULT_CURVE }
