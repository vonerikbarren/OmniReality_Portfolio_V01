/**
 * utils/OmniClaimReality.js (V261) — the walk-in view of a claim as plain data: three ROOMS (true, false, undefined) sized by their shares, and the TESTIMONIES as particles
 * living in the room of their verdict. Each testimony's ExperienceProfile (intensity, tempo, focus, noise, weight, saturation) becomes how its particles move.
 * Pure: seeded random numbers, no THREE, no DOM. The system (systems/OmniClaimReality.js) draws it.
 */
import { sanitizeClaim, sharesAt, physicsOf, ENTITY_KINDS } from './OmniClaimModel.js'
export const ROOMS = Object.freeze(['truth', 'false', 'undefined'])
export const KIND_COLORS = Object.freeze({ human: '#ffffff', bot: '#35e0ff', ai: '#ff5cf0', sensor: '#ffa43a', animal: '#a6ff4d', other: '#b0b8c4', unknown: '#7a8494' })
export const LIMITS = Object.freeze({ particles: 400, perTestimony: 10, baseEdge: 6, minEdge: 1.2, gap: 1.6 })
/** A small seeded generator (mulberry32): the same claim always looks the same. */
export function rng (seed) { let a = (seed >>> 0) || 1; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }
const hash = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) } return h >>> 0 }
/** Edge length of each room: volume follows the share (cube root), with a floor so an empty room is still a visible ghost. */
export const roomEdges = (shares, base = LIMITS.baseEdge) => ROOMS.map(k => Math.max(LIMITS.minEdge, base * Math.cbrt(Math.max(0, shares[k] ?? 0))))
/** Centres of the three rooms on a triangle round the origin (x,z plane), true / false / undefined going round. */
export function roomCenters (edges, gap = LIMITS.gap) {
  const r = Math.max(...edges) * 0.5 + gap + Math.max(...edges) * 0.5; const R = r / Math.sqrt(3) * 1.15
  return edges.map((e, i) => { const a = Math.PI / 2 + i * (Math.PI * 2 / 3); return [Math.cos(a) * R, e / 2, Math.sin(a) * R] })
}
/** The view model: { shares, edges, centers, rooms:[{key, edge, center, share}] }. */
export function layout (claim, n = null) {
  const c = sanitizeClaim(claim); const sh = sharesAt(c, n); const shares = { truth: sh.truth, false: sh.false, undefined: sh.undefined }
  const edges = roomEdges(shares); const centers = roomCenters(edges)
  return { scale: sh.scale, shares, edges, centers, rooms: ROOMS.map((key, i) => ({ key, edge: edges[i], center: centers[i], share: shares[key] })) }
}
/** Seed the particles. Each carries: room (0..2), kind (entity kind), testimony id, position/velocity (room-local, centred), and its motion parameters. */
export function seedParticles (claim, { cap = LIMITS.particles } = {}) {
  const c = sanitizeClaim(claim); const lay = layout(c); const out = []
  for (const t of c.testimonies) {
    if (out.length >= cap) break
    const room = t.verdict === 'true' ? 0 : t.verdict === 'false' ? 1 : 2; const rnd = rng(hash(t.id + t.entity.id + t.verdict)); const ph = physicsOf(t.experience)
    const count = Math.min(LIMITS.perTestimony, cap - out.length, 2 + Math.round(Math.min(4, t.weight) * 2)); const h = lay.edges[room] / 2 * 0.9
    for (let i = 0; i < count; i++) {
      out.push({ room, kind: ENTITY_KINDS.includes(t.entity.kind) ? t.entity.kind : 'unknown', testimony: t.id,
        p: [(rnd() * 2 - 1) * h, (rnd() * 2 - 1) * h, (rnd() * 2 - 1) * h], v: [(rnd() * 2 - 1) * 0.3, (rnd() * 2 - 1) * 0.3, (rnd() * 2 - 1) * 0.3],
        par: { speed: 0.2 + ph.velocity * 1.6, jitter: 0.15 + ph.jitter * 1.2, gravity: ph.gravity * 0.12, damping: 0.2 + ph.damping * 1.8, attractors: ph.attractorCount, energy: 0.35 + ph.particleEnergy * 0.65, saturation: ph.saturation, focus: 75 - ph.fieldOfView } })
    }
  }
  return out
}
/** Fixed attractor points for a room (the more "noise" in the testimony, the more of them pull). Room-local. */
export function attractors (edge, count, seed) { const r = rng(seed); const h = edge / 2 * 0.8; return Array.from({ length: Math.max(1, Math.min(10, count)) }, () => [(r() * 2 - 1) * h, (r() * 2 - 1) * h, (r() * 2 - 1) * h]) }
/** One step of the particles inside their rooms (edges = the rooms' edge lengths). Bounces off the walls; never leaves its room. */
export function stepParticles (ps, dt, edges, rand = Math.random, atts = null) {
  const d = Math.min(0.1, Math.max(0, dt))
  for (const q of ps) {
    const h = edges[q.room] / 2 * 0.96; const P = q.par
    const a = atts?.[q.room]?.length ? atts[q.room][(q.testimony.length + q.kind.length) % Math.min(atts[q.room].length, Math.max(1, P.attractors))] : null
    for (let k = 0; k < 3; k++) {
      let acc = (rand() * 2 - 1) * P.jitter * 6
      if (k === 1) acc -= P.gravity * 9.8 * 0.5
      if (a) acc += (a[k] - q.p[k]) * P.speed * 0.25
      q.v[k] = (q.v[k] + acc * d) * Math.exp(-P.damping * d)
      const lim = P.speed * 2; if (q.v[k] > lim) q.v[k] = lim; else if (q.v[k] < -lim) q.v[k] = -lim
      q.p[k] += q.v[k] * d
      if (q.p[k] > h) { q.p[k] = h; q.v[k] = -Math.abs(q.v[k]) * 0.8 } else if (q.p[k] < -h) { q.p[k] = -h; q.v[k] = Math.abs(q.v[k]) * 0.8 }
    }
  }
  return ps
}
