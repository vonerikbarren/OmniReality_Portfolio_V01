/**
 * utils/OmniEdgeNodeModel.js (V278) — the data and the maths of an EdgeNode: how you travel BETWEEN two nodes.
 * Pure: no DOM, no three.js. Points are plain [x, y, z] arrays.
 *
 * data.edgeNode = { from, to, mode, points:[{ t, side, up }], radius, turns, speed, look, loop, twoWay, color }
 *   mode    'line'    ride along the route (a bent line through the points)
 *           'tunnel'  the same route with rings round it: you go through it
 *           'torus'   a ring (radius) is looped `turns` times at the start, then the route continues to the end
 *           'orbit'   fly to a ring round the destination and circle it `turns` times
 *   points  control points of the route. t = how far along the edge (0 start, 1 end); side / up = how far off the edge, in world units, in the
 *           edge's own frame (so the route follows when either node moves). No points = a straight route. One point = a single bend; more = a curve through all of them.
 *   speed   world units per second (the ride lasts length / speed, between 0.4 and 40 seconds)
 *   look    'forward' (along the route) | 'target' (always at the destination node)
 */
export const MODES = Object.freeze(['line', 'tunnel', 'torus', 'orbit'])
export const LOOKS = Object.freeze(['forward', 'target'])
export const LIMITS = Object.freeze({ points: 24, radius: [0.2, 60], turns: [0.25, 20], speed: [0.5, 200], coord: 2000, samples: 600 })
const ID = /^[\w.:-]{1,80}$/; const HEX = /^#[0-9a-fA-F]{6}$/
const fin = (n, d = 0) => (typeof n === 'number' && Number.isFinite(n) ? n : d)
const clamp = (v, lo, hi, d) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d }

export function defaultEdgeNode () { return { from: '', to: '', mode: 'line', points: [], radius: 3, turns: 1, speed: 8, look: 'forward', loop: false, twoWay: true, color: '#7fd8ff' } }
export function sanitizeEdgeNode (raw) {
  const d = defaultEdgeNode(); const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  const points = []
  for (const p of Array.isArray(r.points) ? r.points : []) {
    if (points.length >= LIMITS.points) break
    if (!p || typeof p !== 'object') continue
    points.push({ t: clamp(p.t, 0.01, 0.99, 0.5), side: clamp(p.side, -LIMITS.coord, LIMITS.coord, 0), up: clamp(p.up, -LIMITS.coord, LIMITS.coord, 0) })
  }
  points.sort((a, b) => a.t - b.t)
  return {
    from: typeof r.from === 'string' && ID.test(r.from) ? r.from : '', to: typeof r.to === 'string' && ID.test(r.to) ? r.to : '',
    mode: MODES.includes(r.mode) ? r.mode : d.mode, points,
    radius: clamp(r.radius, ...LIMITS.radius, d.radius), turns: clamp(r.turns, ...LIMITS.turns, d.turns), speed: clamp(r.speed, ...LIMITS.speed, d.speed),
    look: LOOKS.includes(r.look) ? r.look : d.look, loop: typeof r.loop === 'boolean' ? r.loop : d.loop, twoWay: typeof r.twoWay === 'boolean' ? r.twoWay : d.twoWay,
    color: typeof r.color === 'string' && HEX.test(r.color) ? r.color.toLowerCase() : d.color
  }
}

// ── small vector helpers on arrays ──
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k]
const len = (a) => Math.hypot(a[0], a[1], a[2])
const norm = (a) => { const l = len(a); return l > 1e-9 ? [a[0] / l, a[1] / l, a[2] / l] : [0, 0, 0] }
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
const okv = (v) => Array.isArray(v) && v.length >= 3 && v.slice(0, 3).every(Number.isFinite)

/** the edge's own frame: axis A->B, side (horizontal, across the edge), up (across both). A vertical edge uses world X as its side. */
export function frameOf (A, B) {
  if (!okv(A) || !okv(B)) return { axis: [1, 0, 0], side: [0, 0, 1], up: [0, 1, 0], length: 0 }
  const d = sub(B, A); const length = len(d); const axis = length > 1e-9 ? mul(d, 1 / length) : [1, 0, 0]
  let side = cross(axis, [0, 1, 0]); if (len(side) < 1e-6) side = cross(axis, [1, 0, 0]); side = norm(side)
  const up = norm(cross(side, axis))
  return { axis, side, up, length }
}
/** A, the control points in the frame, B (world positions) */
export function controlPoints (spec, A, B) {
  const s = sanitizeEdgeNode(spec); const f = frameOf(A, B); const out = [A]
  for (const p of s.points) out.push(add(add(add(A, mul(f.axis, p.t * f.length)), mul(f.side, p.side)), mul(f.up, p.up)))
  out.push(B); return out
}
/** uniform Catmull-Rom through points, `per` samples per span (end points repeated) */
export function curveThrough (pts, per = 16) {
  if (pts.length < 2) return pts.map(p => p.slice(0, 3))
  const out = []; const P = (i) => pts[Math.max(0, Math.min(pts.length - 1, i))]
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2)
    for (let k = 0; k < per; k++) {
      const t = k / per, t2 = t * t, t3 = t2 * t
      out.push([0, 1, 2].map(c => 0.5 * ((2 * p1[c]) + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3)))
    }
  }
  out.push(pts[pts.length - 1].slice(0, 3)); return out
}
/** the ring of a torus / orbit mode: centre, and a function of angle */
export function ringOf (spec, A, B) {
  const s = sanitizeEdgeNode(spec); const f = frameOf(A, B)
  if (s.mode === 'orbit') return { centre: B.slice(0, 3), u: f.side, v: f.up, r: s.radius }                           // round the destination, in the plane across the edge
  return { centre: add(A, mul(f.up, s.radius)), u: f.axis, v: f.up, r: s.radius }                           // torus: a ring standing on the start, in the plane along the edge
}
const ringPoint = (R, a) => add(R.centre, add(mul(R.u, Math.cos(a) * R.r), mul(R.v, Math.sin(a) * R.r)))

/**
 * The route from A to B as a list of points. { points, length, cum }  (cum = distance at each point)
 * line / tunnel: through the control points.  torus: loop the ring `turns` times from A, then the route.  orbit: the route to the ring, then `turns` times round it.
 */
export function makePath (spec, A, B, samples = 96) {
  const s = sanitizeEdgeNode(spec); const n = Math.max(8, Math.min(LIMITS.samples, Math.round(Number(samples) || 96)))
  if (!okv(A) || !okv(B)) return { points: [], length: 0, cum: [] }
  const ctrl = controlPoints(s, A, B); let pts
  const per = Math.max(4, Math.round(n / Math.max(1, ctrl.length - 1)))
  if (s.mode === 'torus') {
    const R = ringOf(s, A, B); const loops = []; const steps = Math.max(16, Math.round(n * 0.5 * Math.min(s.turns, 4) / 1))
    for (let i = 0; i <= Math.round(steps * s.turns / Math.min(s.turns, 4)); i++) { const a = (i / (steps * s.turns / Math.min(s.turns, 4))) * Math.PI * 2 * s.turns - Math.PI / 2; if (loops.length > LIMITS.samples) break; loops.push(ringPoint(R, a)) }
    pts = loops.concat(curveThrough(ctrl, per).slice(1))
  } else if (s.mode === 'orbit') {
    const R = ringOf(s, A, B); const entry = ringPoint(R, 0)
    const lead = curveThrough([...ctrl.slice(0, -1), entry], per); const steps = Math.min(LIMITS.samples - lead.length, Math.max(24, Math.round(n * Math.min(s.turns, 6) / 2))); const ring = []
    for (let i = 1; i <= steps; i++) ring.push(ringPoint(R, (i / steps) * Math.PI * 2 * s.turns))
    pts = lead.concat(ring)
  } else pts = curveThrough(ctrl, per)
  pts = pts.slice(0, LIMITS.samples)
  const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + len(sub(pts[i], pts[i - 1])))
  return { points: pts, length: cum[cum.length - 1] || 0, cum }
}
/** the point `t` (0..1) of the way along a path by DISTANCE, and the direction of travel there */
export function pointOn (path, t) {
  const p = path?.points; if (!p || !p.length) return null
  if (p.length === 1) return { pos: p[0].slice(0, 3), dir: [0, 0, 1] }
  const L = path.length; const d = Math.max(0, Math.min(1, fin(t))) * L
  let lo = 0, hi = p.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (path.cum[m] <= d) lo = m; else hi = m }
  const seg = path.cum[hi] - path.cum[lo]; const k = seg > 1e-9 ? (d - path.cum[lo]) / seg : 0
  return { pos: lerp(p[lo], p[hi], k), dir: norm(sub(p[hi], p[lo])) }
}
/** how long a ride takes in seconds (speed in units/second, held between 0.4 and 40 seconds) */
export function rideSeconds (spec, path) { const s = sanitizeEdgeNode(spec); return Math.max(0.4, Math.min(40, (path?.length ?? 0) / s.speed)) }
/** the same route the other way round (for a ride from `to` back to `from`) */
export function reversePath (path) {
  const points = (path?.points ?? []).slice().reverse(); const L = path?.length ?? 0
  return { points, length: L, cum: points.length ? (path.cum ?? []).slice().reverse().map(c => L - c) : [] }
}
/** tunnel rings: centres and the direction there, about every `gap` world units along the path */
export function ringsAlong (path, gap = 2, max = 120) {
  const out = []; if (!path?.length) return out
  const n = Math.max(2, Math.min(max, Math.round(path.length / Math.max(0.2, gap))))
  for (let i = 0; i <= n; i++) { const p = pointOn(path, i / n); if (p) out.push(p) }
  return out
}
