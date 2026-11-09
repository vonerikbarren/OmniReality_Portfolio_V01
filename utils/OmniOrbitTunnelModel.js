/**
 * utils/OmniOrbitTunnelModel.js (V283) — the OrbitTunnel: a torus tube that goes round the reality at the distance where the
 * regular tunnels end. Every reality has two of them: a HORIZONTAL ring (flat, round the Y axis) and a VERTICAL ring (standing up).
 * Pure maths, no three.js, no DOM: the mesh is utils/OmniOrbitTunnelMesh.js, the runtime is systems/OmniOrbitTunnels.js.
 *
 * Frames. A ring point is at angle theta (0..2π). The tube wall is circled by phi (0..2π).
 *   horizontal  centre (R cosθ, 0, R sinθ)   out (cosθ, 0, sinθ)   up (0, 1, 0)   tangent (−sinθ, 0, cosθ)
 *   vertical    centre (R cosθ, R sinθ, 0)   out (cosθ, sinθ, 0)   up (0, 0, 1)   tangent (−sinθ, cosθ, 0)   then turned by `yaw` about Y
 * orbitTraversal (the user's ride) = a corkscrew round the INSIDE of the tube wall: theta moves along the ring, phi circles the wall.
 * Ride sequence: the tunnel you enter first is ridden `loops` times, then the other one (if it is ticked), then you return.
 */

export const IDS = ['horizontal', 'vertical']
/** the end of the longest regular tunnel: (OmniHand's 11 nodes − 1) × 800 spacing + 320 node radius + 120 end pad */
export const TUNNEL_REACH = 8440
export const TAU = Math.PI * 2
export const LIMITS = {
  radius: [200, 60000], tube: [20, 20000], tubeOfRadius: 0.9, opacity: [0.02, 1], repeat: [0.25, 400], count: [0, 1200],
  particleSpeed: [0, 50], speed: [0, 40000], roll: [-720, 720], loops: [1, 99], yaw: [-180, 180], inset: [0.1, 0.95], urlMax: 600,
}

const num = (v, d, lo, hi) => { const n = typeof v === 'number' ? v : (typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d }
const bool = (v, d) => typeof v === 'boolean' ? v : d
const own = (o, k) => o && typeof o === 'object' && Object.prototype.hasOwnProperty.call(o, k) ? o[k] : undefined
const hexColor = (v, d) => { if (typeof v === 'number' && Number.isFinite(v)) return Math.max(0, Math.min(0xffffff, v | 0)); if (typeof v === 'string' && /^#?[0-9a-fA-F]{6}$/.test(v.trim())) return parseInt(v.trim().replace('#', ''), 16); return d }
export const colorHex = (n) => '#' + (Math.max(0, Math.min(0xffffff, n | 0))).toString(16).padStart(6, '0')

/** https:// or an inline data:image URL only (no javascript:, no http:, no file:) */
export function safeMediaUrl (v) {
  if (typeof v !== 'string') return ''
  const s = v.trim(); if (!s || s.length > LIMITS.urlMax * 100) return ''
  if (/^https:\/\/[^\s]+$/i.test(s) && s.length <= LIMITS.urlMax) return s
  return ''
}

export function defaultTunnel (id = 'horizontal') {
  const v = id === 'vertical'
  return {
    id: v ? 'vertical' : 'horizontal', visible: true, mode: 'wire', color: v ? 0xff9d5c : 0x66ccff, opacity: 0.22,
    radius: TUNNEL_REACH, tube: 520, yaw: 0,
    media: { kind: 'none', url: '', repeatU: 40, repeatV: 4 },
    particles: { on: true, speed: 1, count: 360 },
    traversal: { speed: 1500, roll: 45, inset: 0.78 },
  }
}

/** never throws, idempotent; unknown ids become 'horizontal' */
export function sanitizeOrbitTunnel (raw) {
  const o = raw && typeof raw === 'object' ? raw : {}
  const id = own(o, 'id') === 'vertical' ? 'vertical' : 'horizontal'
  const d = defaultTunnel(id)
  const m = own(o, 'media') && typeof o.media === 'object' ? o.media : {}
  const p = own(o, 'particles') && typeof o.particles === 'object' ? o.particles : {}
  const t = own(o, 'traversal') && typeof o.traversal === 'object' ? o.traversal : {}
  const radius = num(own(o, 'radius'), d.radius, LIMITS.radius[0], LIMITS.radius[1])
  const tubeMax = Math.min(LIMITS.tube[1], radius * LIMITS.tubeOfRadius)
  const kind = own(m, 'kind'); const url = safeMediaUrl(own(m, 'url'))
  const mk = kind === 'image' || kind === 'video' ? kind : 'none'
  return {
    id, visible: bool(own(o, 'visible'), d.visible), mode: own(o, 'mode') === 'solid' ? 'solid' : 'wire',
    color: hexColor(own(o, 'color'), d.color), opacity: num(own(o, 'opacity'), d.opacity, LIMITS.opacity[0], LIMITS.opacity[1]),
    radius, tube: num(own(o, 'tube'), Math.min(d.tube, tubeMax), LIMITS.tube[0], Math.max(LIMITS.tube[0], tubeMax)),
    yaw: id === 'vertical' ? num(own(o, 'yaw'), 0, LIMITS.yaw[0], LIMITS.yaw[1]) : 0,
    media: { kind: url ? mk : 'none', url: mk === 'none' ? '' : url, repeatU: num(own(m, 'repeatU'), d.media.repeatU, LIMITS.repeat[0], LIMITS.repeat[1]), repeatV: num(own(m, 'repeatV'), d.media.repeatV, LIMITS.repeat[0], LIMITS.repeat[1]) },
    particles: { on: bool(own(p, 'on'), true), speed: num(own(p, 'speed'), 1, LIMITS.particleSpeed[0], LIMITS.particleSpeed[1]), count: Math.round(num(own(p, 'count'), d.particles.count, LIMITS.count[0], LIMITS.count[1])) },
    traversal: { speed: num(own(t, 'speed'), d.traversal.speed, LIMITS.speed[0], LIMITS.speed[1]), roll: num(own(t, 'roll'), d.traversal.roll, LIMITS.roll[0], LIMITS.roll[1]), inset: num(own(t, 'inset'), d.traversal.inset, LIMITS.inset[0], LIMITS.inset[1]) },
  }
}

export function defaultPrefs () {
  return { tunnels: { horizontal: defaultTunnel('horizontal'), vertical: defaultTunnel('vertical') }, enabled: { horizontal: true, vertical: true }, loops: 1, direction: 1, autoEnter: true, returnWhenDone: true, selected: 'horizontal' }
}
/** the whole saved preference object (never throws) */
export function sanitizePrefs (raw) {
  const o = raw && typeof raw === 'object' ? raw : {}
  const ts = own(o, 'tunnels') && typeof o.tunnels === 'object' ? o.tunnels : {}
  const en = own(o, 'enabled') && typeof o.enabled === 'object' ? o.enabled : {}
  return {
    tunnels: { horizontal: sanitizeOrbitTunnel({ ...(own(ts, 'horizontal') && typeof ts.horizontal === 'object' ? ts.horizontal : {}), id: 'horizontal' }), vertical: sanitizeOrbitTunnel({ ...(own(ts, 'vertical') && typeof ts.vertical === 'object' ? ts.vertical : {}), id: 'vertical' }) },
    enabled: { horizontal: bool(own(en, 'horizontal'), true), vertical: bool(own(en, 'vertical'), true) },
    loops: Math.round(num(own(o, 'loops'), 1, LIMITS.loops[0], LIMITS.loops[1])), direction: own(o, 'direction') === -1 ? -1 : 1,
    autoEnter: bool(own(o, 'autoEnter'), true), returnWhenDone: bool(own(o, 'returnWhenDone'), true), selected: own(o, 'selected') === 'vertical' ? 'vertical' : 'horizontal',
  }
}

// ── geometry ──
const rotY = (v, deg) => { if (!deg) return v; const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); return [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c] }
/** the frame before the yaw (also used by the particles, which live inside the yawed group) */
export function localFrame (id, theta) {
  const c = Math.cos(theta), s = Math.sin(theta)
  return id === 'vertical'
    ? { out: [c, s, 0], up: [0, 0, 1], t: [-s, c, 0] }
    : { out: [c, 0, s], up: [0, 1, 0], t: [-s, 0, c] }
}
/** world frame of a ring point: { c (centre of the tube), out, up, t } */
export function frame (spec, theta) {
  const s = sanitizeOrbitTunnel(spec); const f = localFrame(s.id, theta); const yaw = s.id === 'vertical' ? s.yaw : 0
  return { c: rotY([f.out[0] * s.radius, f.out[1] * s.radius, f.out[2] * s.radius], yaw), out: rotY(f.out, yaw), up: rotY(f.up, yaw), t: rotY(f.t, yaw) }
}
/** a point on (frac = 1) or inside the tube wall at ring angle theta, wall angle phi */
export function wallPoint (spec, theta, phi, frac = 1) {
  const s = sanitizeOrbitTunnel(spec); const f = frame(s, theta); const r = s.tube * frac, co = Math.cos(phi) * r, si = Math.sin(phi) * r
  return [f.c[0] + f.out[0] * co + f.up[0] * si, f.c[1] + f.out[1] * co + f.up[1] * si, f.c[2] + f.out[2] * co + f.up[2] * si]
}
/** where the rider's camera stands and looks: inside the wall, facing along the ring, with the tube axis as "down" */
export function camPose (spec, theta, phi, dir = 1) {
  const s = sanitizeOrbitTunnel(spec); const f = frame(s, theta); const pos = wallPoint(s, theta, phi, s.traversal.inset)
  const d = dir < 0 ? -1 : 1; const look = [pos[0] + f.t[0] * 200 * d, pos[1] + f.t[1] * 200 * d, pos[2] + f.t[2] * 200 * d]
  const co = Math.cos(phi), si = Math.sin(phi)
  const up = [-(f.out[0] * co + f.up[0] * si), -(f.out[1] * co + f.up[1] * si), -(f.out[2] * co + f.up[2] * si)]   // from the wall toward the tube axis
  return { pos, look, up }
}
/** the ring angle closest to a world point */
export function nearestTheta (spec, p) {
  const s = sanitizeOrbitTunnel(spec); const yaw = s.id === 'vertical' ? s.yaw : 0; const q = rotY([Number(p?.[0]) || 0, Number(p?.[1]) || 0, Number(p?.[2]) || 0], -yaw)
  const th = s.id === 'vertical' ? Math.atan2(q[1], q[0]) : Math.atan2(q[2], q[0]); return th < 0 ? th + TAU : th
}
/** distance from a world point to the middle line of the tube (inside the tube when ≤ spec.tube) */
export function distToCenterline (spec, p) {
  const s = sanitizeOrbitTunnel(spec); const th = nearestTheta(s, p); const f = frame(s, th)
  return Math.hypot((Number(p?.[0]) || 0) - f.c[0], (Number(p?.[1]) || 0) - f.c[1], (Number(p?.[2]) || 0) - f.c[2])
}

// ── the ride ──
/** the tunnel you enter first comes first; the other follows only if it is ticked. Entering a ticked-off tunnel rides just that one. */
export function planQueue (first, enabled) {
  const f = first === 'vertical' ? 'vertical' : 'horizontal'; const en = enabled && typeof enabled === 'object' ? enabled : {}
  return [f, ...IDS.filter(x => x !== f && en[x] !== false)]
}
/** one frame of the ride; pure: returns the next state. state = { theta, phi, travelled, lap, done } */
export function stepRide (state, dt, spec, prefs) {
  const s = sanitizeOrbitTunnel(spec); const p = sanitizePrefs(prefs); const st = state && typeof state === 'object' ? state : {}
  const d = Math.min(0.25, Math.max(0, Number(dt) || 0)); const dir = p.direction
  const dTheta = (s.traversal.speed * d) / s.radius
  const theta = ((Number(st.theta) || 0) + dTheta * dir) % TAU
  const phi = ((Number(st.phi) || 0) + (s.traversal.roll * Math.PI / 180) * d) % TAU
  const travelled = (Number(st.travelled) || 0) + dTheta, lap = Math.floor(travelled / TAU)
  return { theta: theta < 0 ? theta + TAU : theta, phi: phi < 0 ? phi + TAU : phi, travelled, lap, done: lap >= p.loops }
}
export function describeRide (queue, i, lap, loops) {
  const q = Array.isArray(queue) ? queue : []; const id = q[i]; if (!id) return 'Not riding'
  return `Riding the ${id} OrbitTunnel — lap ${Math.min(lap + 1, loops)} of ${loops}${q[i + 1] ? ', then the ' + q[i + 1] + ' one' : ''}`
}
