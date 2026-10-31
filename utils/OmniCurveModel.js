/**
 * utils/OmniCurveModel.js (V246) — pure: a hand-drawn loop curve for a vibration channel, and the maths of the editor that draws it.
 * A curve is points [[x, y], ...] over ONE cycle: x 0..1 (time through the beat), y -1..1 (the channel is amp * y). It always starts at x = 0 and ends at x = 1 with the SAME y, so it loops.
 *   sanitizeCurve(raw) -> points (2..16, x sorted and kept apart, y clamped, the loop closed)       curveAt(points, u) -> y (smooth: a cosine ease between neighbours)
 *   curveFromWave(waveFn, n) -> n sampled points (to start editing from any wave)
 *   snapPoint(p, grid) · movePoint(points, i, x, y, grid) · addPoint(points, x, y, grid) · removePoint(points, i) · nearest(points, x, y, rx, ry)
 * V254 — BEZIER HANDLES. A point may also carry handles: [x, y, inDx, inDy, outDx, outDy] (offsets from the point, in curve units).
 *   A segment with no handles on either end keeps the old cosine ease (so every curve saved before V254 plays the same);
 *   a segment with a handle is a cubic Bezier. Handle x is kept inside the segment so the curve stays a function of time.
 *   handleOf(points, i, 'in'|'out') · moveHandle(points, i, which, dx, dy, {grid, mirror}) · smoothCurve(points, tension) · clearHandles(points, i?) · hasHandles(point)
 * Never throws; hostile input falls back to a gentle hump.
 */
export const CURVE_LIMITS = Object.freeze({ min: 2, max: 16, gap: 0.01 })
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const num = (v, d) => ((typeof v === 'number' || typeof v === 'string') && v !== '' && Number.isFinite(Number(v)) ? Number(v) : d)
export const DEFAULT_CURVE = Object.freeze([[0, 0], [0.5, 1], [1, 0]])

const HMAX = 2   // a handle can reach this far above/below (the curve itself is clamped to -1..1 when read)
const hnum = (v, lo, hi) => clamp(num(v, 0), lo, hi)
export const hasHandles = (p) => Array.isArray(p) && p.length >= 6 && (p[2] !== 0 || p[3] !== 0 || p[4] !== 0 || p[5] !== 0)

export function sanitizeCurve (raw) {
  const pts = []
  if (Array.isArray(raw)) for (const p of raw.slice(0, 64)) { if (Array.isArray(p) && p.length >= 2) pts.push([clamp(num(p[0], 0), 0, 1), clamp(num(p[1], 0), -1, 1), ...(p.length >= 6 ? [num(p[2], 0), num(p[3], 0), num(p[4], 0), num(p[5], 0)] : [])]) }
  if (pts.length < CURVE_LIMITS.min) return DEFAULT_CURVE.map(p => p.slice())
  pts.sort((a, b) => a[0] - b[0])
  const out = []
  for (const p of pts) { if (out.length && p[0] - out[out.length - 1][0] < CURVE_LIMITS.gap) continue; out.push(p.map((v, k) => (k === 1 ? Math.round(v * 1e4) / 1e4 : Math.round(v * 1e4) / 1e4))) }
  if (out.length < CURVE_LIMITS.min) return DEFAULT_CURVE.map(p => p.slice())
  out[0][0] = 0; out[out.length - 1][0] = 1; out[out.length - 1][1] = out[0][1]      // the loop is closed
  while (out.length > CURVE_LIMITS.max) out.splice(Math.floor(out.length / 2), 1)
  if (out.length >= 2 && out[out.length - 1][0] - out[out.length - 2][0] < CURVE_LIMITS.gap) out.splice(out.length - 2, 1)
  // handles: in points left (dx <= 0), out points right (dx >= 0), neither past the neighbour; the ends have one handle each
  out.forEach((p, i) => {
    if (p.length < 6) { if (p.length > 2) p.length = 2; return }
    const left = i > 0 ? p[0] - out[i - 1][0] : 0; const right = i < out.length - 1 ? out[i + 1][0] - p[0] : 0
    p[2] = -Math.min(left, Math.max(0, -p[2])); p[3] = hnum(p[3], -HMAX, HMAX)
    p[4] = Math.min(right, Math.max(0, p[4])); p[5] = hnum(p[5], -HMAX, HMAX)
    for (const k of [2, 3, 4, 5]) p[k] = Math.round(p[k] * 1e4) / 1e4 || 0
    if (!hasHandles(p)) p.length = 2
  })
  return out
}

/** The y of the segment from a to b at x (cosine ease without handles, cubic Bezier with). */
export function segmentAt (a, b, x) {
  const w = b[0] - a[0]
  if (w <= 0) return a[1]
  const ao = a.length >= 6 ? [a[4], a[5]] : [0, 0]; const bi = b.length >= 6 ? [b[2], b[3]] : [0, 0]
  if (!ao[0] && !ao[1] && !bi[0] && !bi[1]) { const f = clamp((x - a[0]) / w, 0, 1); return a[1] + (b[1] - a[1]) * (1 - Math.cos(f * Math.PI)) / 2 }
  const x1 = a[0] + clamp(ao[0], 0, w); const y1 = a[1] + ao[1]; const x2 = b[0] + clamp(bi[0], -w, 0); const y2 = b[1] + bi[1]
  const bez = (t, p0, p1, p2, p3) => { const m = 1 - t; return m * m * m * p0 + 3 * m * m * t * p1 + 3 * m * t * t * p2 + t * t * t * p3 }
  let lo = 0; let hi = 1                                       // x(t) is monotone (control x stay inside the segment): bisect for t
  for (let k = 0; k < 28; k++) { const mid = (lo + hi) / 2; if (bez(mid, a[0], x1, x2, b[0]) < x) lo = mid; else hi = mid }
  return clamp(bez((lo + hi) / 2, a[1], y1, y2, b[1]), -1, 1)
}

export function curveAt (points, u) {
  const p = points; const x = u - Math.floor(u)
  let i = 0; while (i < p.length - 2 && x > p[i + 1][0]) i++
  return segmentAt(p[i], p[i + 1], x)
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
  p[i] = [clamp(snap(x, grid.x), lo, Math.max(lo, hi)), ny, ...p[i].slice(2)]
  return sanitizeCurve(p)
}
export function addPoint (points, x, y, grid = { x: 0, y: 0 }) {
  if (points.length >= CURVE_LIMITS.max) return points
  const nx = clamp(snap(x, grid.x), CURVE_LIMITS.gap, 1 - CURVE_LIMITS.gap)
  if (points.some(q => Math.abs(q[0] - nx) < CURVE_LIMITS.gap)) return points
  return sanitizeCurve([...points, [nx, clamp(snap(y, grid.y), -1, 1)]])
}
export function removePoint (points, i) { if (points.length <= CURVE_LIMITS.min + 0 || i <= 0 || i >= points.length - 1) return points; return sanitizeCurve(points.filter((_, k) => k !== i)) }
/** The handle of point i as an absolute [x, y] (curve units), or null when the point has none or the end has no such side. */
export function handleOf (points, i, which) {
  const p = points[i]; if (!p) return null
  if (which === 'in' && i === 0) return null
  if (which === 'out' && i === points.length - 1) return null
  const d = p.length >= 6 ? (which === 'in' ? [p[2], p[3]] : [p[4], p[5]]) : [0, 0]
  return [p[0] + d[0], p[1] + d[1]]
}
/** Drag a handle to the absolute position (x, y). mirror: the opposite handle turns the other way with the same length (a smooth joint). */
export function moveHandle (points, i, which, x, y, { grid = { x: 0, y: 0 }, mirror = false } = {}) {
  const p = points.map(q => q.slice()); const q = p[i]; if (!q) return p
  if ((which === 'in' && i === 0) || (which === 'out' && i === p.length - 1)) return p
  if (q.length < 6) q.push(0, 0, 0, 0)
  const dx = snap(x, grid.x) - q[0]; const dy = snap(y, grid.y) - q[1]
  if (which === 'in') { q[2] = Math.min(0, dx); q[3] = dy } else { q[4] = Math.max(0, dx); q[5] = dy }
  if (mirror) { if (which === 'in' && i < p.length - 1) { q[4] = -q[2]; q[5] = -q[3] } else if (which === 'out' && i > 0) { q[2] = -q[4]; q[3] = -q[5] } }
  return sanitizeCurve(p)
}
/** Auto handles on every point (Catmull-Rom style: each point's tangent follows its neighbours). tension 0..1 (0 = none). Ends keep a flat tangent so the loop closes smoothly. */
export function smoothCurve (points, tension = 0.5) {
  const p = points.map(q => q.slice(0, 2)); const t = clamp(num(tension, 0.5), 0, 1); const n = p.length
  return sanitizeCurve(p.map((q, i) => {
    if (t === 0) return q
    const prev = p[Math.max(0, i - 1)]; const next = p[Math.min(n - 1, i + 1)]
    const sl = (i === 0 || i === n - 1) ? 0 : (next[1] - prev[1]) / Math.max(1e-6, next[0] - prev[0])
    const lw = i > 0 ? q[0] - p[i - 1][0] : 0; const rw = i < n - 1 ? p[i + 1][0] - q[0] : 0
    return [q[0], q[1], -lw / 3 * t, -sl * lw / 3 * t, rw / 3 * t, sl * rw / 3 * t]
  }))
}
/** Remove the handles of point i (or of every point). */
export function clearHandles (points, i = null) { return sanitizeCurve(points.map((q, k) => (i === null || k === i ? q.slice(0, 2) : q.slice()))) }
/** The index of the point nearest (x, y) within the radii (in curve units), or -1. */
export function nearest (points, x, y, rx = 0.04, ry = 0.08) {
  let best = -1; let bd = Infinity
  points.forEach((p, i) => { const d = ((p[0] - x) / rx) ** 2 + ((p[1] - y) / ry) ** 2; if (d <= 1 && d < bd) { bd = d; best = i } })
  return best
}
export default { sanitizeCurve, curveAt, segmentAt, hasHandles, handleOf, moveHandle, smoothCurve, clearHandles, curveFromWave, movePoint, addPoint, removePoint, nearest, snap, DEFAULT_CURVE }
