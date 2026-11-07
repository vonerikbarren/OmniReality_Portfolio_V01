/**
 * utils/OmniSpaces.js — the SPACES of the opening screen (V276). Pure: no DOM, no Three, no clock.
 *
 * A "space" is a scale of existence, smallest to largest: Planck foam (strings), subatomic (quarks), atomic, molecular, cellular, tissue,
 * terrestrial, planetary, stellar, galactic (the old star field), intergalactic (the cosmic web) and universal.
 * Each space is ONE pure function: formation(id, i, n, t, out) writes where point i of n sits at time t (seconds), in a cube of about [-1, 1]
 * (out.x/y/z), plus out.s (size multiplier) and out.a (alpha multiplier). Same inputs, same output (no Math.random).
 * The boot screen keeps ONE fixed pool of points and moves it between formations, so memory does not grow with the number of spaces.
 *
 * rotationPlan(enabled, t, opts) says which space is shown, or which two are blending, at time t.
 * blendPoint(plan, i, n, t, out) gives the point in the middle of a zoom: going OUT (to a larger space) the current one shrinks to a dot
 * while the next one pulls back from a close-up; going IN is the reverse (Powers of Ten).
 * project(...) is a plain perspective projection so the 2D canvas can draw the pool. linkPairs(...) finds the plexus lines.
 */

export const SPACES = Object.freeze([
  { id: 'planck',        name: 'Planck space',        scale: '10^-35 m',  note: 'quantum foam and strings',    size: 0.8, link: 0.55 },
  { id: 'subatomic',     name: 'Subatomic space',     scale: '10^-15 m',  note: 'quarks held by gluons',       size: 1.0, link: 0.7 },
  { id: 'atomic',        name: 'Atomic space',        scale: '10^-10 m',  note: 'a nucleus and its electrons', size: 1.0, link: 0.6 },
  { id: 'molecular',     name: 'Molecular space',     scale: '10^-9 m',   note: 'atoms bonded in rings',       size: 1.1, link: 0.9 },
  { id: 'cellular',      name: 'Cellular space',      scale: '10^-5 m',   note: 'a membrane around a nucleus', size: 1.0, link: 0.7 },
  { id: 'tissue',        name: 'Tissue space',        scale: '10^-3 m',   note: 'cells in a living sheet',     size: 1.0, link: 0.8 },
  { id: 'terrestrial',   name: 'Terrestrial space',   scale: '10^0 m',    note: 'land and weather',            size: 1.0, link: 0.8 },
  { id: 'planetary',     name: 'Planetary space',     scale: '10^7 m',    note: 'a world, its ring and moon',  size: 1.0, link: 0.6 },
  { id: 'stellar',       name: 'Stellar space',       scale: '10^12 m',   note: 'a star and its orbits',       size: 1.0, link: 0.5 },
  { id: 'galactic',      name: 'Galactic space',      scale: '10^21 m',   note: 'a spiral of stars',           size: 1.0, link: 1.0 },
  { id: 'intergalactic', name: 'Intergalactic space', scale: '10^24 m',   note: 'the cosmic web',              size: 0.9, link: 1.1 },
  { id: 'universal',     name: 'Universal space',     scale: '10^26 m',   note: 'the observable universe',     size: 0.8, link: 0.5 }
])
export const SPACE_IDS = Object.freeze(SPACES.map(s => s.id))
const INDEX = Object.freeze(Object.fromEntries(SPACES.map((s, i) => [s.id, i])))
export const DIRECTIONS = Object.freeze(['out', 'in'])

export function spaceInfo (id) { return SPACES[INDEX[id]] || SPACES[INDEX.galactic] }

/** Keeps only known ids, once each, in scale order. Never throws. [] when nothing valid (callers then fall back to the galactic space). */
export function sanitizeSpaceIds (raw) {
  const want = new Set()
  if (Array.isArray(raw)) for (const v of raw.slice(0, 64)) if (typeof v === 'string' && Object.prototype.hasOwnProperty.call(INDEX, v)) want.add(v)
  return SPACE_IDS.filter(id => want.has(id))
}

// ── tiny deterministic helpers ─────────────────────────────
const TAU = Math.PI * 2
const fr = (x) => x - Math.floor(x)
/** Deterministic pseudo-random in [0, 1) from an integer and a channel. */
export const hash = (i, k) => fr(Math.sin(i * 127.1 + k * 311.7 + 1.3) * 43758.5453123)
const smooth = (a, b, x) => { const u = Math.min(1, Math.max(0, (x - a) / (b - a))); return u * u * (3 - 2 * u) }
const GOLD = Math.PI * (3 - Math.sqrt(5))

function sphere (k, N, r, o) {   // Fibonacci sphere: point k of N on a sphere of radius r
  const y = 1 - 2 * (k + 0.5) / Math.max(1, N), rr = Math.sqrt(Math.max(0, 1 - y * y)), th = k * GOLD
  o.x = Math.cos(th) * rr * r; o.y = y * r; o.z = Math.sin(th) * rr * r
}
function dir (i, k, r, o) {      // a random direction (from the hash) at distance r
  const u = hash(i, k) * 2 - 1, th = hash(i, k + 1) * TAU, rr = Math.sqrt(1 - u * u)
  o.x = Math.cos(th) * rr * r; o.y = u * r; o.z = Math.sin(th) * rr * r
}
function turn (o, ay, ax) {      // rotate (x,y,z) about Y by ay, then about X by ax
  let c = Math.cos(ay), s = Math.sin(ay), x = o.x * c + o.z * s, z = -o.x * s + o.z * c
  c = Math.cos(ax); s = Math.sin(ax)
  const y = o.y * c - z * s; z = o.y * s + z * c
  o.x = x; o.y = y; o.z = z
}

// The cosmic web is a fixed table (nodes and edges), built once.
const WEB = (() => {
  const nodes = []; for (let k = 0; k < 11; k++) nodes.push([hash(k, 91) * 1.7 - 0.85, hash(k, 92) * 1.3 - 0.65, hash(k, 93) * 1.7 - 0.85])
  const edges = []
  for (let a = 0; a < nodes.length; a++) for (let b = a + 1; b < nodes.length; b++) {
    const d = Math.hypot(nodes[a][0] - nodes[b][0], nodes[a][1] - nodes[b][1], nodes[a][2] - nodes[b][2])
    if (d < 1.05) edges.push([a, b])
  }
  if (!edges.length) edges.push([0, 1])
  return { nodes, edges }
})()

const F = {
  planck (i, n, t, o) {                       // foam that never sits still, plus tiny vibrating loops (strings)
    if (i % 5 < 2) {
      const L = Math.floor(i / 5), k = i % 8, c = { x: 0, y: 0, z: 0 }
      dir(L, 7, 0.75 * Math.cbrt(hash(L, 5)), c)
      const th = TAU * k / 8 + t * 3 + L, r = 0.1 + 0.04 * Math.sin(t * 5 + L * 2)
      o.x = c.x + Math.cos(th) * r; o.y = c.y + Math.sin(th) * r * (1 + 0.5 * Math.sin(t * 4 + L)); o.z = c.z + Math.sin(th * 2 + t) * r * 0.5
      o.s = 0.9; o.a = 0.9
    } else {
      dir(i, 3, 0.9 * Math.cbrt(hash(i, 5)), o)
      o.x += 0.07 * Math.sin(t * 7 + i * 1.7); o.y += 0.07 * Math.sin(t * 6.1 + i * 2.3); o.z += 0.07 * Math.sin(t * 8.3 + i * 0.9)
      o.s = 0.6; o.a = 0.55
    }
  },
  subatomic (i, n, t, o) {                    // five hadrons, three quarks each, whirling around the middle
    const Hd = Math.floor(i / 3) % 5, m = i % 3, ring = Math.floor(i / 15) % 3
    const a = TAU * Hd / 5 + t * 0.45, c = { x: Math.cos(a) * 0.55, y: 0.35 * Math.sin(a * 1.7 + Hd), z: Math.sin(a) * 0.55 }
    const th = TAU * m / 3 + t * 2.2 + Hd, r = 0.12 + 0.05 * ring
    o.x = c.x + Math.cos(th) * r; o.y = c.y + Math.sin(th * 1.3) * r * 0.8; o.z = c.z + Math.sin(th) * r
    o.s = m === 0 ? 1.5 : 1.1; o.a = 0.9
  },
  atomic (i, n, t, o) {                       // a nucleus and three tilted electron orbits
    if (i < n * 0.18) { dir(i, 2, 0.13 * Math.cbrt(hash(i, 4)), o); o.x += 0.012 * Math.sin(t * 9 + i); o.s = 1.5; o.a = 1; return }
    const k = i - Math.floor(n * 0.18), orbit = k % 3, idx = Math.floor(k / 3), per = Math.max(1, Math.ceil(n * 0.82 / 3))
    const th = TAU * idx / per + t * (1.1 + 0.3 * orbit)
    o.x = Math.cos(th) * 0.8; o.y = 0; o.z = Math.sin(th) * 0.8
    turn(o, orbit * Math.PI / 3, 0.9 + orbit * 0.5)
    o.s = 0.9; o.a = 0.8
  },
  molecular (i, n, t, o) {                    // four molecules: a six-atom ring with substituents, each turning slowly
    const mol = i % 4, k = Math.floor(i / 4), slot = k % 8, extra = Math.floor(k / 8)
    let r, th
    if (slot < 6) { r = 0.22; th = TAU * slot / 6 } else { r = 0.42; th = TAU * ((slot - 6) * 2) / 6 + 0.5 }
    o.x = Math.cos(th) * r + (hash(i, 8) - 0.5) * 0.03 * extra; o.y = Math.sin(th) * r + (hash(i, 9) - 0.5) * 0.03 * extra; o.z = (hash(i, 10) - 0.5) * 0.05 * extra
    turn(o, t * (0.5 + 0.1 * mol), 0.5 + mol * 0.4)
    const cx = (mol % 2 ? 1 : -1) * 0.5, cy = (mol < 2 ? 1 : -1) * 0.42
    o.x += cx; o.y += cy + 0.04 * Math.sin(t + mol); o.z += (mol - 1.5) * 0.15
    o.s = slot < 6 ? 1.2 : 0.9; o.a = 0.9
  },
  cellular (i, n, t, o) {                     // a membrane, a nucleus, and organelles drifting between
    const pulse = 1 + 0.03 * Math.sin(t * 1.5)
    if (i < n * 0.55) { sphere(i, Math.floor(n * 0.55), 0.85 * pulse, o); o.s = 0.9; o.a = 0.85; turn(o, t * 0.15, 0.3); return }
    if (i < n * 0.7) { dir(i, 6, 0.2 * Math.cbrt(hash(i, 7)), o); o.s = 1.4; o.a = 1; return }
    const g = i % 5, a = t * 0.2 + g * 1.3
    dir(i, 12, 0.07, o); o.x += Math.cos(a) * 0.45; o.y += Math.sin(a * 1.3 + g) * 0.4; o.z += Math.sin(a) * 0.3; o.s = 1.0; o.a = 0.8
  },
  tissue (i, n, t, o) {                       // a rippling sheet of cells on a hex-offset grid
    const cols = Math.max(2, Math.ceil(Math.sqrt(n * 1.3))), rows = Math.max(2, Math.ceil(n / cols)), col = i % cols, row = Math.floor(i / cols)
    const x = ((col + (row % 2) * 0.5) / cols) * 2 - 1, y = (row / (rows - 1)) * 2 - 1
    o.x = x * 0.9; o.y = y * 0.62; o.z = 0.14 * Math.sin(t * 1.5 + x * 5) + 0.1 * Math.cos(t * 1.1 + y * 4)
    turn(o, 0.5, 0.35)
    o.s = 1.1; o.a = 0.85
  },
  terrestrial (i, n, t, o) {                  // rolling land with weather above it
    if (i % 7 === 0) { o.x = (fr(hash(i, 1) + t * 0.02) * 2 - 1) * 1.1; o.y = 0.45 + 0.08 * Math.sin(t * 0.6 + i); o.z = hash(i, 2) * 1.6 - 0.8; o.s = 1.4; o.a = 0.45; return }
    const x = hash(i, 1) * 2 - 1, z = hash(i, 2) * 2 - 1
    o.x = x * 1.0; o.z = z * 0.9; o.y = 0.25 * Math.sin(x * 3 + t * 0.3) + 0.2 * Math.cos(z * 2.6 - t * 0.2) - 0.25
    turn(o, 0, 0.3)
    o.s = 0.9; o.a = 0.8
  },
  planetary (i, n, t, o) {                    // a world turning, a tilted ring, a moon
    if (i < n * 0.66) { sphere(i, Math.floor(n * 0.66), 0.5, o); turn(o, t * 0.4, 0.4); o.s = 1.0; o.a = 0.9; return }
    if (i < n * 0.92) {
      const k = i - Math.floor(n * 0.66), per = Math.max(1, Math.floor(n * 0.26)), th = TAU * k / per + t * 0.15
      const r = 0.78 + 0.1 * hash(i, 3); o.x = Math.cos(th) * r; o.y = 0; o.z = Math.sin(th) * r; turn(o, 0, 0.45); o.s = 0.7; o.a = 0.6; return
    }
    const th = t * 0.9 + (i % 3) * 0.05; o.x = Math.cos(th) * 1.0; o.y = 0.15 * Math.sin(th * 2); o.z = Math.sin(th) * 1.0 + (i % 3) * 0.02; o.s = 1.6; o.a = 1
  },
  stellar (i, n, t, o) {                      // a star, seven orbits, a planet on each
    if (i < n * 0.1) { dir(i, 4, 0.07 * Math.cbrt(hash(i, 5)), o); o.s = 2.0; o.a = 1; return }
    const k = i - Math.floor(n * 0.1), orbit = k % 7, idx = Math.floor(k / 7), per = Math.max(1, Math.ceil(n * 0.9 / 7))
    const r = 0.18 + orbit * 0.115, speed = 0.9 / Math.pow(r + 0.1, 1.5), th = TAU * idx / per
    if (idx === 0) { o.x = Math.cos(t * speed + orbit) * r; o.z = Math.sin(t * speed + orbit) * r; o.s = 2.2; o.a = 1 } else { o.x = Math.cos(th) * r; o.z = Math.sin(th) * r; o.s = 0.55; o.a = 0.5 }
    o.y = 0; turn(o, 0, 0.5)
  },
  galactic (i, n, t, o) {                     // two spiral arms and a bulge, turning faster near the middle
    if (i < n * 0.16) { dir(i, 14, 0.2 * Math.cbrt(hash(i, 15)), o); o.y *= 0.6; o.s = 1.3; o.a = 0.95; return }
    const k = i - Math.floor(n * 0.16), arm = k % 2, u = (k / Math.max(1, n * 0.84)), r = 0.1 + Math.pow(u, 0.7) * 0.9
    const th = arm * Math.PI + r * 5.6 + t * 0.12 / (r + 0.25) + (hash(i, 6) - 0.5) * 0.5
    o.x = Math.cos(th) * r; o.z = Math.sin(th) * r; o.y = (hash(i, 7) - 0.5) * 0.12 * (1 - r * 0.5)
    turn(o, 0, 0.55)
    o.s = 0.8 + hash(i, 8) * 0.6; o.a = 0.75
  },
  intergalactic (i, n, t, o) {                // filaments joining clusters
    if (i % 4 === 0) {
      const c = WEB.nodes[(i >> 2) % WEB.nodes.length]; dir(i, 20, 0.08 * Math.cbrt(hash(i, 21)), o)
      o.x += c[0]; o.y += c[1]; o.z += c[2]; o.s = 1.6; o.a = 1
    } else {
      const e = WEB.edges[i % WEB.edges.length], A = WEB.nodes[e[0]], B = WEB.nodes[e[1]], u = hash(i, 22)
      o.x = A[0] + (B[0] - A[0]) * u + (hash(i, 23) - 0.5) * 0.05; o.y = A[1] + (B[1] - A[1]) * u + (hash(i, 24) - 0.5) * 0.05; o.z = A[2] + (B[2] - A[2]) * u + (hash(i, 25) - 0.5) * 0.05
      o.s = 0.7; o.a = 0.6
    }
    turn(o, t * 0.06, 0.1)
  },
  universal (i, n, t, o) {                    // nested shells swelling and falling back, a bright point in the middle
    if (i < 3) { o.x = o.y = o.z = 0; o.s = 2.4; o.a = 1; return }
    const shell = i % 4, R = [0.3, 0.55, 0.8, 1.0][shell] * (1 + 0.06 * Math.sin(t * 0.8 + shell * 1.1))
    sphere(Math.floor(i / 4) * 7 + shell * 3, Math.max(1, n * 2), R, o)
    turn(o, t * 0.05 * (shell + 1), 0.2)
    o.s = 0.6; o.a = 0.35 + 0.1 * shell
  }
}

/** Where point i of n sits in space `id` at time t (seconds). Writes and returns `out` { x, y, z, s, a }. Never throws. */
export function formation (id, i, n, t, out) {
  const o = out || {}
  o.x = 0; o.y = 0; o.z = 0; o.s = 1; o.a = 1
  const fn = Object.prototype.hasOwnProperty.call(F, id) ? F[id] : F.galactic
  const tt = Number.isFinite(t) ? t : 0
  fn(Math.max(0, Math.floor(Number.isFinite(i) ? i : 0)), Math.max(1, Math.floor(Number.isFinite(n) ? n : 1)), tt, o)
  const k = spaceInfo(id).size
  o.s *= k
  if (!Number.isFinite(o.x + o.y + o.z)) { o.x = o.y = o.z = 0 }
  return o
}

// ── the rotation: which space, or which two are blending ───
const ease = (u) => u * u * (3 - 2 * u)
/**
 * @param enabled  ids to rotate through (any order; invalid ids dropped; none valid -> ['galactic'])
 * @param t        seconds
 * @param opts     { holdSec = 9, moveSec = 3.2, direction = 'out' }   'out' small -> large, 'in' large -> small
 * @returns { a, b, u, moving, kind, index, count }  kind: 'out' | 'in' (b larger / smaller than a) when moving
 */
export function rotationPlan (enabled, t, opts) {
  const o = opts && typeof opts === 'object' ? opts : {}
  let list = sanitizeSpaceIds(enabled); if (!list.length) list = ['galactic']
  if (o.direction === 'in') list = list.slice().reverse()
  const hold = Math.min(120, Math.max(1, Number.isFinite(o.holdSec) ? o.holdSec : 9)), move = Math.min(20, Math.max(0.5, Number.isFinite(o.moveSec) ? o.moveSec : 3.2))
  const L = list.length, tt = Math.max(0, Number.isFinite(t) ? t : 0)
  if (L === 1) return { a: list[0], b: list[0], u: 0, moving: false, kind: 'out', index: 0, count: 1 }
  const period = hold + move, k = Math.floor(tt / period) % L, ph = tt % period
  const a = list[k], b = list[(k + 1) % L]
  if (ph < hold) return { a, b: a, u: 0, moving: false, kind: 'out', index: k, count: L }
  return { a, b, u: ease((ph - hold) / move), moving: true, kind: INDEX[b] > INDEX[a] ? 'out' : 'in', index: k, count: L }
}

const _A = { x: 0, y: 0, z: 0, s: 1, a: 1 }, _B = { x: 0, y: 0, z: 0, s: 1, a: 1 }
/** The point during a plan: a plain formation, or the zoom between two. Writes and returns `out`. */
export function blendPoint (plan, i, n, t, out) {
  const o = out || {}
  if (!plan || !plan.moving) return formation(plan ? plan.a : 'galactic', i, n, t, o)
  formation(plan.a, i, n, t, _A); formation(plan.b, i, n, t, _B)
  const e = plan.u
  let sA, sB
  if (plan.kind === 'out') { sA = 1 - 0.85 * e; sB = 1 + 5 * (1 - e) * (1 - e) } else { sA = 1 + 5 * e * e; sB = 0.15 + 0.85 * e }
  const w = smooth(0.25, 0.9, e)
  o.x = _A.x * sA * (1 - w) + _B.x * sB * w
  o.y = _A.y * sA * (1 - w) + _B.y * sB * w
  o.z = _A.z * sA * (1 - w) + _B.z * sB * w
  o.s = _A.s * (1 - w) + _B.s * w
  o.a = _A.a * (1 - w) + _B.a * w
  return o
}

/** Link reach of the space(s) in a plan (a multiplier for the plexus distance). */
export function planLink (plan) {
  if (!plan) return 1
  const a = spaceInfo(plan.a).link
  if (!plan.moving) return a
  const w = smooth(0.25, 0.9, plan.u)
  return a * (1 - w) + spaceInfo(plan.b).link * w
}

/**
 * Perspective projection of a point in the cube onto a view of vw x vh pixels. Slowly turns the whole pool (yaw) and tips it (pitch).
 * Writes { sx, sy, k, depth } to `out`; k = size/alpha factor (nearer is bigger); depth in [0, 1] (0 near, 1 far); returns false when behind the camera.
 */
export function project (p, vw, vh, yaw, pitch, out, cam = 3.2) {
  let c = Math.cos(yaw), s = Math.sin(yaw)
  let x = p.x * c + p.z * s, z = -p.x * s + p.z * c, y = p.y
  c = Math.cos(pitch); s = Math.sin(pitch)
  const y2 = y * c - z * s, z2 = y * s + z * c
  const d = cam - z2
  if (d < 0.2) return false
  const k = cam / d, R = Math.min(vw, vh) * 0.42
  out.sx = vw / 2 + x * k * R; out.sy = vh / 2 + y2 * k * R; out.k = k
  out.depth = Math.min(1, Math.max(0, (z2 + 1.6) / 3.2))
  return true
}

/**
 * Plexus lines. xs, ys: screen positions of `n` points (NaN = hidden). Writes up to `cap` pairs into `pairs` (flat [a0,b0,a1,b1,...]) and distances
 * into `dists`; each point links to at most `perPoint` neighbours. Returns the pair count. O(n^2), meant for n <= 250.
 */
export function linkPairs (xs, ys, n, maxD, cap, perPoint, pairs, dists) {
  const m2 = maxD * maxD, per = Math.max(1, perPoint | 0), used = new Uint8Array(n)
  let count = 0
  for (let a = 0; a < n && count < cap; a++) {
    const ax = xs[a], ay = ys[a]
    if (!(ax === ax) || !(ay === ay)) continue
    for (let b = a + 1; b < n && count < cap; b++) {
      if (used[a] >= per) break
      if (used[b] >= per) continue
      const dx = xs[b] - ax, dy = ys[b] - ay, d2 = dx * dx + dy * dy
      if (d2 <= m2 && d2 > 0) { pairs[count * 2] = a; pairs[count * 2 + 1] = b; dists[count] = Math.sqrt(d2); used[a]++; used[b]++; count++ }
    }
  }
  return count
}
