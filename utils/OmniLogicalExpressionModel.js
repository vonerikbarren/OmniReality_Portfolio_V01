/**
 * utils/OmniLogicalExpressionModel.js (V287) — the user's LogicalExpression: a personal MOVEMENT SIGNATURE (how they move when their logic is working),
 * planned ahead as a precalculated sequence of animation classes (utils/OmniAnimationModel.js) that always ends with the user placed in the scene.
 * Pure and deterministic: the same signature + the same start / end always gives the same plan, so it is "theirs".
 *
 *   signature  { seed, tempo 0.5..2, intensity 0..1, teleport 0..1 (share of teleport steps against hyperlapses), hops 2..8, reach 5..200 (world units), vibration 0..1, hue 0..360, sound }
 *   plan       { duration, kind, reduced, segments:[{ anim, start, dur, a, b }], cues:[{ t, name }], to, from, seed }
 *   sample     sampleExpression(plan, t) -> { pos, look, fov, shake:[x,y,z], flash, progress, done }
 * Used by the opening (after the fall), by any summoning tool (a node, an Omni command, OmniIDE) and as the success reward. Reduced motion makes the calm version of the same signature.
 */
import { sanitizeAnimation, sampleAnimation, getAnimation } from './OmniAnimationModel.js'

export const SOUNDS = ['laser', 'soft', 'none']
export const KINDS = ['opening', 'success']
export const CAPS = Object.freeze({ opening: 8, success: 6 })   // seconds, hard cap
export const DEFAULT_SIGNATURE = Object.freeze({ seed: 1, tempo: 1, intensity: 0.6, teleport: 0.5, hops: 4, reach: 30, vibration: 0.4, hue: 200, sound: 'laser' })
const RANGES = { tempo: [0.5, 2], intensity: [0, 1], teleport: [0, 1], reach: [5, 200], vibration: [0, 1], hue: [0, 360] }
const own = (o, k) => o && typeof o === 'object' && Object.prototype.hasOwnProperty.call(o, k) ? o[k] : undefined
const num = (v, [lo, hi], d) => { const n = typeof v === 'number' ? v : (typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d }
const r2 = (n) => Math.round(n * 100) / 100

/** never throws, idempotent */
export function sanitizeSignature (raw) {
  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}; const d = DEFAULT_SIGNATURE; const o = {}
  o.seed = Math.round(num(own(r, 'seed'), [0, 2147483647], d.seed))
  for (const k of Object.keys(RANGES)) o[k] = r2(num(own(r, k), RANGES[k], d[k]))
  o.hops = Math.round(num(own(r, 'hops'), [2, 8], d.hops)); o.sound = SOUNDS.includes(own(r, 'sound')) ? r.sound : d.sound
  return { seed: o.seed, tempo: o.tempo, intensity: o.intensity, teleport: o.teleport, hops: o.hops, reach: o.reach, vibration: o.vibration, hue: o.hue, sound: o.sound }
}
export const mixSignature = (a, b, k = 0.5) => { const x = sanitizeSignature(a), y = sanitizeSignature(b), t = Math.max(0, Math.min(1, k)); const m = {}; for (const key of Object.keys(DEFAULT_SIGNATURE)) m[key] = typeof x[key] === 'number' ? x[key] + (y[key] - x[key]) * t : (t < 0.5 ? x[key] : y[key]); return sanitizeSignature(m) }
const hash = (s) => { let h = 2166136261; for (const c of String(s)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619) } return (h >>> 0) % 2147483647 }
/**
 * A signature drawn from what the user actually built.
 * stats = { axioms:{ '◉': 3, ... }, nodes, edges, depth, perMinute }  — every field optional. A little of their own taste (a base signature) can be mixed in.
 */
export function deriveSignature (stats, base = null) {
  const s = stats && typeof stats === 'object' ? stats : {}; const ax = s.axioms && typeof s.axioms === 'object' ? s.axioms : {}; const keys = Object.keys(ax).sort()
  const total = keys.reduce((n, k) => n + (Number(ax[k]) || 0), 0), variety = keys.length
  const nodes = Math.max(0, Number(s.nodes) || 0), depth = Math.max(0, Number(s.depth) || 0), pm = Math.max(0, Number(s.perMinute) || 0)
  const d = { seed: hash(keys.map(k => k + ':' + ax[k]).join('|') + '|' + nodes + '|' + depth), tempo: 0.7 + Math.min(1.3, pm / 6), intensity: 0.35 + Math.min(0.6, depth * 0.12), teleport: Math.min(1, variety / 7), hops: 3 + Math.min(5, Math.floor(nodes / 6)), reach: 20 + Math.min(120, nodes * 3), vibration: Math.min(1, 0.2 + total / 40), hue: hash(keys.join('')) % 360, sound: 'laser' }
  return base ? mixSignature(base, d, 0.7) : sanitizeSignature(d)
}
function rng (seed) { let a = (seed >>> 0) || 1; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }
const v3 = (v, d = [0, 0, 0]) => (Array.isArray(v) && v.length >= 3 && v.slice(0, 3).every(Number.isFinite) ? [v[0], v[1], v[2]] : d)

/** the whole expression, worked out ahead of time */
export function planExpression (sigRaw, opts = {}) {
  const sig = sanitizeSignature(sigRaw); const o = opts && typeof opts === 'object' ? opts : {}; const kind = KINDS.includes(o.kind) ? o.kind : 'success'; const reduced = o.reduced === true
  const from = v3(o.from), to = v3(o.to, from); const rnd = rng(sig.seed + (kind === 'opening' ? 7 : 0))
  const cap = CAPS[kind]; const base = kind === 'opening' ? 4.8 : 3.6
  // waypoints between from and to (the last one IS `to`); a loop (from == to) gets a random heading so the path still goes somewhere
  const d = [to[0] - from[0], to[1] - from[1], to[2] - from[2]]; let len = Math.hypot(...d); let dir = len > 1e-6 ? d.map(x => x / len) : (() => { const a = rnd() * Math.PI * 2; return [Math.cos(a), 0, Math.sin(a)] })()
  const hops = reduced ? 2 : sig.hops; const pts = [from]
  for (let i = 1; i < hops; i++) { const f = i / hops; const side = [-dir[2], 0, dir[0]]; const spread = sig.reach * (0.4 + rnd() * 0.8) * (len > 1e-6 ? 1 : 1); const s = (rnd() * 2 - 1) * spread, u = (rnd() * 2 - 1) * spread * 0.4
    pts.push([from[0] + d[0] * f + side[0] * s, from[1] + d[1] * f + u, from[2] + d[2] * f + side[2] * s]) }
  pts.push(to)
  // choose a class for each hop: the first is a streak when it is the opening, the last always settles
  const segments = []; let t = 0; const cues = []
  const n = pts.length - 1; const wDur = []; for (let i = 0; i < n; i++) wDur.push(0.8 + rnd() * 0.5); const wSum = wDur.reduce((a, b) => a + b, 0)
  const total = Math.min(cap, (reduced ? base * 1.4 : base / sig.tempo)); 
  for (let i = 0; i < n; i++) {
    const last = i === n - 1; let id
    if (reduced) id = 'settle'; else if (last) id = 'settle'; else if (i === 0 && kind === 'opening') id = 'streak'; else id = rnd() < sig.teleport ? 'teleport' : 'hyperlapse'
    const dur = Math.max(0.15, (wDur[i] / wSum) * total); const seg = { anim: id, start: t, dur, a: pts[i], b: pts[i + 1], amp: sig.intensity }
    segments.push(seg)
    if (!reduced && sig.sound !== 'none' && (id === 'teleport' || id === 'streak')) cues.push({ t: t + dur * (id === 'teleport' ? 0.2 : 0.08), name: sig.sound === 'soft' ? 'soft' : 'laser' }); if (!reduced && sig.sound !== 'none' && id === 'teleport') cues.push({ t: t + dur * 0.46, name: sig.sound === 'soft' ? 'soft' : 'laser' }, { t: t + dur * 0.73, name: sig.sound === 'soft' ? 'soft' : 'laser' })
    t += dur
  }
  cues.push({ t: Math.max(0, t - 0.05), name: 'arrive' }); cues.sort((a, b) => a.t - b.t)
  return { kind, reduced, signature: sig, from, to, duration: t, segments, cues, seed: sig.seed }
}
const noise = (t, k) => Math.sin(t * 91.7 + k * 12.9898) * 0.5 + Math.sin(t * 57.3 + k * 78.233) * 0.5
/** where the camera is at time t. Reduced plans have no flash or shake. At and after the end it is exactly the `to` point. */
export function sampleExpression (plan, t) {
  const p = plan && Array.isArray(plan.segments) ? plan : { segments: [], duration: 0, from: [0, 0, 0], to: [0, 0, 0], reduced: true, signature: DEFAULT_SIGNATURE }
  const now = Number.isFinite(t) ? Math.max(0, t) : 0
  if (!p.segments.length || now >= p.duration) return { pos: [...p.to], look: [...p.to], fov: 0, shake: [0, 0, 0], flash: 0, progress: 1, done: true, index: p.segments.length - 1 }
  let i = 0; while (i + 1 < p.segments.length && p.segments[i + 1].start <= now) i++
  const seg = p.segments[i]; const local = (now - seg.start) / seg.dur; const anim = getAnimation(seg.anim) ?? sanitizeAnimation({ id: seg.anim }); const s = sampleAnimation(anim, local)
  const A = seg.a, B = seg.b; const d = [B[0] - A[0], B[1] - A[1], B[2] - A[2]]; const L = Math.hypot(...d) || 1; const side = [-d[2] / L, 0, d[0] / L]
  const pos = [A[0] + d[0] * s.progress + side[0] * s.lateral * L * seg.amp, A[1] + d[1] * s.progress + s.lift * L * seg.amp, A[2] + d[2] * s.progress + side[2] * s.lateral * L * seg.amp]
  const amp = p.reduced ? 0 : s.shake * (p.signature?.vibration ?? 0.4) * (p.signature?.intensity ?? 0.6) * 0.6
  const shake = [noise(now, 1) * amp + 0, noise(now, 2) * amp + 0, noise(now, 3) * amp + 0]
  const ahead = [B[0], B[1], B[2]]
  return { pos, look: ahead, fov: p.reduced ? 0 : s.fov * (p.signature?.intensity ?? 0.6), shake, flash: p.reduced ? 0 : s.flash * (p.signature?.intensity ?? 0.6), progress: s.progress, done: false, index: i }
}
/** the lines of the results card (Sonic-style): what the run produced. Never throws; unknown input gives an empty list. */
export function resultLines (raw) {
  const r = raw && typeof raw === 'object' ? raw : {}; const out = []
  const add = (label, v, unit = '') => { const n = Number(v); if (Number.isFinite(n) && n >= 0) out.push({ label, value: (Number.isInteger(n) ? String(n) : String(r2(n))) + unit }) }
  add('Nodes', r.nodes); add('Connections', r.edges); add('Depth', r.depth); add('Axioms used', r.axioms && typeof r.axioms === 'object' ? Object.keys(r.axioms).length : NaN); add('Time', r.seconds, ' s')
  return out.slice(0, 8)
}
