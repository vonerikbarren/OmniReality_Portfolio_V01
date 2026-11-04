/**
 * utils/OmniRhythmModel.js (V270) — the RHYTHM of a RhythmNode, as plain data + pure functions. No DOM, no Three.js, no audio.
 * A RhythmNode is a BEAT SOURCE. Every beat can animate any node bound to it (beat = animation transformation); what the beat MEANS is free text (heartbeat, tick, breath, alarm...).
 *
 * data.rhythm = { v:1, title, tempo:100 (20..300 bpm), steps:[accent 0..1 x 4..32] (a step is a 16th note: 4 per beat; 0 = rest, ~0.5 soft, 1 accent), swing 0..0.75 (odd steps late),
 *                 autostart:false, follow:null | { nodeId, trackId|null } (the beats then come from a MusicNode's hits, not from the clock), means:'', light:true,
 *                 bindings:[ { id, target, anim, amount 0..2, attack 0..0.5 s, decay 0.05..3 s, ease:'out'|'linear'|'bounce', every 1..16, accentOnly, delay -0.2..0.2 s, means, on } ] }
 * The animation is an OFFSET on top of the node's own transform: it never changes the saved scale / position / rotation (systems/OmniRhythm.js remembers the base and puts it back).
 *
 *   sanitizeRhythm(r) (never throws, idempotent, caps) · defaultRhythm() · newBinding(target, anim, opts) · parsePattern('x.o.') / patternText(steps)
 *   stepSeconds(r) · stepTime(r, g) (seconds of global step g, swing applied) · dueSteps(r, startedAt, lastG, now) -> { events:[{g, step, accent, t}], lastG }
 *   envelope(age, attack, decay, ease) -> 0..1 · offsetFor(anim, env, p, amount, seed, dir) -> { pos, rot, scale (added to 1), glow } · shouldFire(binding, beatNo, accent)
 *   ANIMS · ANIM_INFO · MEANS_PRESETS
 */
export const RHYTHM_VERSION = 1
export const ANIMS = Object.freeze(['pulse', 'bounce', 'kick', 'squash', 'flash', 'wobble', 'shake', 'sway', 'breathe'])
export const ANIM_INFO = Object.freeze({
  pulse:   { label: 'Pulse',   summary: 'Swells and settles.' },
  bounce:  { label: 'Bounce',  summary: 'Hops up and comes back down.' },
  kick:    { label: 'Kick',    summary: 'Spins once round on every beat.' },
  squash:  { label: 'Squash',  summary: 'Squashes flat and springs back (stretches sideways).' },
  flash:   { label: 'Flash',   summary: 'Lights up and fades.' },
  wobble:  { label: 'Wobble',  summary: 'Rocks side to side.' },
  shake:   { label: 'Shake',   summary: 'A quick tremble.' },
  sway:    { label: 'Sway',    summary: 'Leans left, then right, beat by beat.' },
  breathe: { label: 'Breathe', summary: 'A slow swell and release across the whole beat.' }
})
export const EASES = Object.freeze(['out', 'linear', 'bounce'])
export const MEANS_PRESETS = Object.freeze(['heartbeat', 'tick', 'breath', 'alarm', 'engine', 'dance', 'drum', 'data flow'])
export const LIMITS = Object.freeze({ tempo: [20, 300], steps: [4, 32], swingMax: 0.75, bindings: 24, amount: [0, 2], attack: [0, 0.5], decay: [0.05, 3], every: [1, 16], delay: [-0.2, 0.2], text: 40, title: 40 })
const BAD = new Set(['__proto__', 'constructor', 'prototype'])
const num = (v, d) => { const n = Number(v); return Number.isFinite(n) ? n : d }
const clamp = (v, [lo, hi], d) => Math.min(hi, Math.max(lo, num(v, d)))
const txt = (v, n) => String(v ?? '').replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n)
const okId = (v) => typeof v === 'string' && /^[\w-]{1,64}$/.test(v) && !BAD.has(v)
const bid = () => 'b' + Math.random().toString(36).slice(2, 7)
const r3 = (n) => Math.round(n * 1000) / 1000

export function sanitizeBinding (b) {
  const o = (b && typeof b === 'object') ? b : {}
  if (!okId(o.target)) return null
  return {
    id: okId(o.id) ? o.id : bid(), target: o.target, anim: ANIMS.includes(o.anim) ? o.anim : 'pulse',
    amount: r3(clamp(o.amount, LIMITS.amount, 1)), attack: r3(clamp(o.attack, LIMITS.attack, 0.02)), decay: r3(clamp(o.decay, LIMITS.decay, 0.25)),
    ease: EASES.includes(o.ease) ? o.ease : 'out', every: Math.round(clamp(o.every, LIMITS.every, 1)), accentOnly: o.accentOnly === true,
    delay: r3(clamp(o.delay, LIMITS.delay, 0)), means: txt(o.means, LIMITS.text), on: o.on !== false
  }
}
export const newBinding = (target, anim = 'pulse', opts = {}) => sanitizeBinding({ ...(opts && typeof opts === 'object' ? opts : {}), target, anim })

export function defaultRhythm () {
  return { v: 1, title: 'Rhythm', tempo: 100, steps: [1, 0, 0.4, 0, 0.7, 0, 0.4, 0, 1, 0, 0.4, 0, 0.7, 0, 0.4, 0], swing: 0, autostart: false, follow: null, means: '', light: true, bindings: [] }
}

export function sanitizeRhythm (raw) {
  const o = (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : {}
  const d = defaultRhythm()
  let steps = Array.isArray(o.steps) ? o.steps.slice(0, LIMITS.steps[1]).map(v => r3(clamp(v, [0, 1], 0))) : d.steps
  if (steps.length < LIMITS.steps[0]) steps = steps.concat(new Array(LIMITS.steps[0] - steps.length).fill(0))
  const seen = new Set(); const bindings = []
  for (const b of (Array.isArray(o.bindings) ? o.bindings : [])) { if (bindings.length >= LIMITS.bindings) break; const s = sanitizeBinding(b); if (!s) continue; while (seen.has(s.id)) s.id = bid(); seen.add(s.id); bindings.push(s) }
  const f = o.follow && typeof o.follow === 'object' && okId(o.follow.nodeId) ? { nodeId: o.follow.nodeId, trackId: okId(o.follow.trackId) ? o.follow.trackId : null } : null
  return { v: 1, title: txt(o.title, LIMITS.title) || d.title, tempo: r3(clamp(o.tempo, LIMITS.tempo, 100)), steps, swing: r3(clamp(o.swing, [0, LIMITS.swingMax], 0)), autostart: o.autostart === true, follow: f, means: txt(o.means, LIMITS.text), light: o.light !== false, bindings }
}

/** 'x' accent, 'o' soft, '.' or '-' rest (anything else is a rest); 4..32 long */
export function parsePattern (text) {
  const s = String(text ?? '').replace(/\s+/g, '').slice(0, LIMITS.steps[1]); if (s.length < LIMITS.steps[0]) throw new Error('A pattern needs at least ' + LIMITS.steps[0] + ' steps, like x...o...x...o...')
  return [...s].map(c => (c === 'x' || c === 'X' ? 1 : c === 'o' || c === 'O' ? 0.5 : 0))
}
export const patternText = (steps) => (Array.isArray(steps) ? steps : []).map(v => (v >= 0.75 ? 'x' : v > 0 ? 'o' : '.')).join('')

// ── time ──
export const stepSeconds = (r) => 60 / clamp(r?.tempo, LIMITS.tempo, 100) / 4
export function stepTime (r, g) {
  const n = Math.max(1, r?.steps?.length ?? 16); const sd = stepSeconds(r); const pos = ((g % n) + n) % n
  return g * sd + (pos % 2 === 1 ? clamp(r?.swing, [0, LIMITS.swingMax], 0) * sd : 0)
}
/** Which sounding steps (accent > 0) have come due between the last one handled and `now`. Pure; the caller keeps lastG. A long gap (hidden tab) skips ahead instead of replaying. */
export function dueSteps (r, startedAt, lastG, now) {
  const events = []; let g = lastG + 1; const n = Math.max(1, r?.steps?.length ?? 16); const sd = stepSeconds(r)
  if (now - startedAt - stepTime(r, g) > 1) g = Math.max(g, Math.floor((now - startedAt) / sd) - 1)
  let last = lastG
  for (let guard = 0; guard < 64; guard++, g++) {
    const t = startedAt + stepTime(r, g); if (t > now) break
    last = g; const a = r.steps[((g % n) + n) % n]; if (a > 0) events.push({ g, step: ((g % n) + n) % n, accent: a, t })
  }
  return { events, lastG: last }
}

// ── animation ──
export const shouldFire = (b, beatNo, accent) => !!b && b.on !== false && (b.every <= 1 || beatNo % b.every === 0) && (!b.accentOnly || accent >= 0.75)
/** 0..1: rises over `attack`, falls over `decay` along the ease. age < 0 or past the end is 0 */
export function envelope (age, attack = 0.02, decay = 0.25, ease = 'out') {
  const a = num(age, -1); if (a < 0) return 0; const at = Math.max(0, attack), de = Math.max(0.001, decay)
  if (a < at) return at > 0 ? a / at : 1
  const x = (a - at) / de; if (x >= 1) return 0
  if (ease === 'linear') return 1 - x
  if (ease === 'bounce') return Math.abs(Math.cos(x * Math.PI * 2.5)) * (1 - x)
  return (1 - x) * (1 - x)
}
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s) }
/** The transform offsets of one animation at one instant. env 0..1, p 0..1 = progress through attack+decay, dir = +1 / -1 (alternates per beat). pos/rot are ADDED, scale is added to 1 (0.2 = 20% bigger), glow 0..1. */
export function offsetFor (anim, env, p, amount = 1, seed = 0, dir = 1) {
  const o = { pos: [0, 0, 0], rot: [0, 0, 0], scale: [0, 0, 0], glow: 0 }
  const a = clamp(amount, LIMITS.amount, 1), e = Math.min(1, Math.max(0, num(env, 0))), q = Math.min(1, Math.max(0, num(p, 0)))
  switch (anim) {
    case 'pulse': { const s = 0.35 * a * e; o.scale = [s, s, s]; break }
    case 'bounce': o.pos[1] = 0.8 * a * e; break
    case 'kick': o.rot[1] = Math.PI * 2 * a * (1 - (1 - q) * (1 - q)); break
    case 'squash': o.scale = [0.2 * a * e, -0.4 * a * e, 0.2 * a * e]; break
    case 'flash': o.glow = Math.min(1, a * e); break
    case 'wobble': o.rot[2] = 0.5 * a * e * Math.sin(q * Math.PI * 6); break
    case 'shake': o.pos = [(hash(seed + q * 40) - 0.5) * 0.3 * a * e, (hash(seed + 7 + q * 40) - 0.5) * 0.3 * a * e, (hash(seed + 13 + q * 40) - 0.5) * 0.3 * a * e]; break
    case 'sway': o.pos[0] = (dir < 0 ? -1 : 1) * 0.6 * a * Math.sin(q * Math.PI) * (e > 0 ? 1 : 0); o.rot[2] = -(dir < 0 ? -1 : 1) * 0.25 * a * Math.sin(q * Math.PI); break
    case 'breathe': { const s = 0.25 * a * Math.sin(q * Math.PI); o.scale = [s, s, s]; break }
    default: break
  }
  return o
}
/** how long a binding's animation lasts, seconds (breathe / sway / kick use the whole span) */
export const spanOf = (b) => Math.max(0.05, num(b?.attack, 0.02) + num(b?.decay, 0.25))
