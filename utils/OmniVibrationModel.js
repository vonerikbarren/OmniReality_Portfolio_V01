/**
 * utils/OmniVibrationModel.js — OmniVibration's pure maths (V216). No scene, no DOM: everything here is testable on its own.
 *
 * A VIBRATION PROGRAM is a looped motion, added on top of wherever a thing already is:
 *   { id, name, mode:'free'|'beat', rate (Hz, free), bpm (beat), swing 0..1,
 *     channels:[{ prop, wave, amp, freq, phase, pattern? }],
 *     envelope:{ attack, hold, release } }            (seconds; hold 0 = until stopped)
 * prop:  pos.x pos.y pos.z (world units) · rot.x rot.y rot.z (degrees) · scale (+/- fraction of 1) · glow (0..1 add)
 * wave:  sine tri saw square pulse bounce steps         (see WAVES; `steps` loops the channel's `pattern`, smoothed)
 * freq:  a MULTIPLIER of the base rate (1 = once per beat / per cycle, 2 = twice as fast, 0.5 = every other beat)
 * Loops are periodic by construction, so any program repeats cleanly; `steps` and `swing` make the loop uneven on purpose.
 */

import { isEase, humpAt } from './OmniEases.js'
import { sanitizeCurve, curveAt } from './OmniCurveModel.js'
export const PROPS = ['pos.x', 'pos.y', 'pos.z', 'rot.x', 'rot.y', 'rot.z', 'scale', 'glow']
export const WAVE_NAMES = ['sine', 'tri', 'saw', 'square', 'pulse', 'bounce', 'steps', 'ease', 'curve']   // V245: 'ease' = one hump per beat through a GSAP-named ease (channel.ease, e.g. 'power2.out')
export const LAND = ['none', 'ground', 'middle', 'apex']      // V245: where the BEAT falls in the motion (none = the program's own start, as before)
export const SYNCS = ['none', 'song']                         // V245: 'song' = follow the playing song's beat position and tempo
export const LIMITS = {
  rate: [0.05, 12], bpm: [20, 300], swing: [0, 0.75], landOffset: [-0.5, 0.5], amp: [-50, 50], freq: [0.0625, 16], phase: [0, 360],
  attack: [0, 30], hold: [0, 3600], release: [0, 60], channels: 8, pattern: 16,
}
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const num = (v, d, [a, b]) => (Number.isFinite(Number(v)) && v !== '' && v !== null ? clamp(Number(v), a, b) : d)
const frac = (u) => u - Math.floor(u)

/** One period of each wave, u in [0,1). sine/tri/saw/square swing -1..1; pulse and bounce are 0..1 (a hop never goes below the floor). */
export const WAVES = {
  sine:   (u) => Math.sin(u * Math.PI * 2),
  tri:    (u) => (u < 0.25 ? 4 * u : u < 0.75 ? 2 - 4 * u : 4 * u - 4),
  saw:    (u) => 2 * u - 1,
  square: (u) => (u < 0.5 ? 1 : -1),
  pulse:  (u) => Math.exp(-7 * u),                 // a sharp hit that rings out
  bounce: (u) => Math.abs(Math.sin(u * Math.PI)),  // ball arcs: 0 at the floor, 1 at the top
}
/** `steps`: the pattern's values held in turn and eased between (cosine), looped. */
export function stepsWave (pattern, u) {
  const n = pattern.length; if (!n) return 0
  const x = frac(u) * n, i = Math.floor(x), f = x - i
  const a = pattern[i % n], b = pattern[(i + 1) % n], e = (1 - Math.cos(f * Math.PI)) / 2
  return a + (b - a) * e
}
export function waveAt (ch, u) {
  if (ch.wave === 'ease') return humpAt(ch.ease, u)
  if (ch.wave === 'curve') return curveAt(ch.curve ?? [[0, 0], [0.5, 1], [1, 0]], u)   // V246: drawn in the curve editor
  if (ch.wave === 'steps') return stepsWave(ch.pattern ?? [0, 1], u)
  return (WAVES[ch.wave] ?? WAVES.sine)(frac(u))
}

export function sanitizeChannel (c) {
  const o = c && typeof c === 'object' ? c : {}
  const ch = {
    prop: PROPS.includes(o.prop) ? o.prop : 'pos.y',
    wave: WAVE_NAMES.includes(o.wave) ? o.wave : 'sine',
    amp: num(o.amp, 0.3, LIMITS.amp),
    freq: num(o.freq, 1, LIMITS.freq),
    phase: num(o.phase, 0, LIMITS.phase),
  }
  if (ch.wave === 'curve') ch.curve = sanitizeCurve(o.curve)
  if (ch.wave === 'ease') ch.ease = isEase(o.ease) ? o.ease : 'power2.out'
  if (ch.wave === 'steps') {
    const p = Array.isArray(o.pattern) ? o.pattern.map(Number).filter(Number.isFinite).slice(0, LIMITS.pattern).map(v => clamp(v, -1, 1)) : []
    ch.pattern = p.length ? p : [0, 1, 0.4, 0.8]
  }
  return ch
}
export function sanitizeProgram (p) {
  const o = p && typeof p === 'object' ? p : {}
  const channels = (Array.isArray(o.channels) ? o.channels : []).slice(0, LIMITS.channels).map(sanitizeChannel)
  const prog = {
    id: typeof o.id === 'string' && /^[\w-]{1,40}$/.test(o.id) ? o.id : 'vib_' + Math.random().toString(36).slice(2, 8),
    name: typeof o.name === 'string' && o.name.trim() ? o.name.trim().slice(0, 40) : 'Vibration',
    mode: o.mode === 'beat' ? 'beat' : 'free',
    rate: num(o.rate, 1, LIMITS.rate),
    bpm: num(o.bpm, 120, LIMITS.bpm),
    swing: num(o.swing, 0, LIMITS.swing),
    land: LAND.includes(o.land) ? o.land : 'none', landOffset: num(o.landOffset, 0, LIMITS.landOffset), sync: SYNCS.includes(o.sync) ? o.sync : 'none',
    lead: 0,
    channels: channels.length ? channels : [sanitizeChannel({})],
    envelope: {
      attack: num(o.envelope?.attack, 0.25, LIMITS.attack),
      hold: num(o.envelope?.hold, 0, LIMITS.hold),
      release: num(o.envelope?.release, 0.6, LIMITS.release),
    },
  }
  prog.lead = Number.isInteger(Number(o.lead)) && o.lead !== null && o.lead !== '' ? clamp(Number(o.lead), 0, prog.channels.length - 1) : 0   // V246: which channel the beat landing follows
  return prog
}

/** Base cycles per second of a program. */
export const baseHz = (p) => (p.mode === 'beat' ? p.bpm / 60 : p.rate)

/** Phase position (in cycles) after t seconds. `swing` delays every second beat: the loop is uneven but still repeats every two beats. */
export function cyclesAt (p, t) {
  const c = t * baseHz(p)
  if (!p.swing) return c
  const pair = Math.floor(c / 2), r = c - pair * 2        // r in [0,2): two beats
  const s = p.swing * 0.5                                   // fraction of a beat the second beat is pushed late
  const w = r < 1 + s ? r / (1 + s) : 1 + (r - 1 - s) / (1 - s)   // piecewise: beat 1 stretched, beat 2 squeezed, joined at r = 1 + s
  return pair * 2 + w
}

/** The program's raw pose at time t (before the envelope). { pos:[x,y,z], rot:[x,y,z] degrees, scale, glow } */
/**
 * V245: the shift (in beats) that puts the BEAT on the chosen point of the LEAD channel (the first one): 'apex' = its highest point (in the air), 'ground' = its lowest (on the floor),
 * 'middle' = halfway up. `landOffset` (beats) then moves the motion later (+) or earlier (-) so the beat lands a little before or after that point. 'none' = 0 (the old behaviour).
 */
const SHIFTS = new WeakMap()
export function landShift (p) {
  if (!p || !p.land || p.land === 'none') return 0
  const key = p.channels[p.lead ?? 0] ?? p.channels[0]; const memo = SHIFTS.get(key); const k = `${p.land}|${key.wave}|${key.ease}|${key.amp < 0}|${key.freq}|${key.phase}|${(key.pattern ?? []).join(',')}|${(key.curve ?? []).join(',')}`
  let base
  if (memo && memo.k === k) base = memo.v
  else {
    const N = 720; const sgn = key.amp < 0 ? -1 : 1; const v = []
    for (let i = 0; i < N; i++) v.push(sgn * waveAt(key, i / N))
    const lo = Math.min(...v); const hi = Math.max(...v); const mid = (lo + hi) / 2; const eps = (hi - lo) * 1e-6
    let u = 0
    if (hi - lo < 1e-9) u = 0
    else if (p.land === 'apex') u = v.findIndex(x => x >= hi - eps) / N
    else if (p.land === 'ground') u = v.findIndex(x => x <= lo + eps) / N
    else { const g = v.findIndex(x => x <= lo + eps); let i = g; for (let n = 0; n < N; n++) { const a = v[(g + n) % N]; const b = v[(g + n + 1) % N]; if (a < mid && b >= mid) { i = (g + n + 1) % N; break } } u = i / N }
    base = (u - key.phase / 360) / (key.freq || 1)
    SHIFTS.set(key, { k, v: base })
  }
  return base - (p.landOffset ?? 0)
}

/** V246: where in the channel's own loop the BEAT is (0..1): for the editor's beat marker. */
export function beatPosition (p) {
  const ch = p.channels[p.lead ?? 0] ?? p.channels[0]; const x = landShift(p) * (ch.freq || 1) + ch.phase / 360
  return x - Math.floor(x)
}

export function evaluate (p, t, cycles = null) {
  const out = { pos: [0, 0, 0], rot: [0, 0, 0], scale: 0, glow: 0 }
  const cyc = (cycles === null ? cyclesAt(p, t) : cycles) + landShift(p)
  for (const ch of p.channels) {
    const v = ch.amp * waveAt(ch, cyc * ch.freq + ch.phase / 360)
    if (ch.prop === 'scale') out.scale += v
    else if (ch.prop === 'glow') out.glow += v
    else { const [k, a] = ch.prop.split('.'); out[k]['xyz'.indexOf(a)] += v }
  }
  return out
}

/** Envelope gain 0..1. `releaseAt` (seconds) is set when stopped early; null while running. Returns { gain, done }. */
export function envelopeAt (env, t, releaseAt = null) {
  const ease = (x) => x * x * (3 - 2 * x)
  const up = env.attack > 0 ? ease(clamp(t / env.attack, 0, 1)) : 1
  let endAt = releaseAt
  if (endAt === null && env.hold > 0) endAt = env.attack + env.hold
  if (endAt === null || t < endAt) return { gain: up, done: false }
  if (env.release <= 0) return { gain: 0, done: true }
  const startGain = env.attack > 0 ? ease(clamp(endAt / env.attack, 0, 1)) : 1
  const k = clamp((t - endAt) / env.release, 0, 1)
  return { gain: startGain * (1 - ease(k)), done: k >= 1 }
}

/** pose x gain */
export function poseAt (p, t, releaseAt = null, waveT = t, cycles = null) {   // waveT: V217, the time the waves are read at (a looped event wraps it)
  const e = envelopeAt(p.envelope, t, releaseAt), v = evaluate(p, waveT, cycles)
  const g = e.gain
  return { pos: v.pos.map(x => x * g), rot: v.rot.map(x => x * g), scale: v.scale * g, glow: v.glow * g, gain: g, done: e.done }
}

export const PRESETS = [
  { id: 'bounce', name: 'Bounce', mode: 'beat', bpm: 120, channels: [
    { prop: 'pos.y', wave: 'bounce', amp: 0.6, freq: 1 }, { prop: 'scale', wave: 'bounce', amp: -0.06, freq: 1 }] },
  { id: 'hop', name: 'Hop', mode: 'beat', bpm: 90, channels: [{ prop: 'pos.y', wave: 'pulse', amp: 0.9, freq: 0.5 }, { prop: 'scale', wave: 'pulse', amp: 0.12, freq: 0.5 }] },
  { id: 'sway', name: 'Sway', mode: 'free', rate: 0.5, channels: [
    { prop: 'pos.x', wave: 'sine', amp: 0.35, freq: 1 }, { prop: 'rot.z', wave: 'sine', amp: 7, freq: 1, phase: 90 }] },
  { id: 'pulse', name: 'Pulse', mode: 'beat', bpm: 100, channels: [{ prop: 'scale', wave: 'pulse', amp: 0.18, freq: 1 }, { prop: 'glow', wave: 'pulse', amp: 0.6, freq: 1 }] },
  { id: 'shake', name: 'Shake', mode: 'free', rate: 9, channels: [
    { prop: 'pos.x', wave: 'sine', amp: 0.06, freq: 1 }, { prop: 'pos.z', wave: 'sine', amp: 0.06, freq: 1.5, phase: 40 }] },
  { id: 'float', name: 'Float', mode: 'free', rate: 0.25, channels: [
    { prop: 'pos.y', wave: 'sine', amp: 0.4, freq: 1 }, { prop: 'rot.y', wave: 'saw', amp: 12, freq: 0.5 }] },
  { id: 'dance', name: 'Dance', mode: 'beat', bpm: 118, swing: 0.3, channels: [
    { prop: 'pos.y', wave: 'bounce', amp: 0.5, freq: 1 },
    { prop: 'pos.x', wave: 'sine', amp: 0.3, freq: 0.5 },
    { prop: 'rot.y', wave: 'sine', amp: 22, freq: 0.5, phase: 90 },
    { prop: 'rot.z', wave: 'steps', amp: 9, freq: 0.25, pattern: [0, 1, -0.4, 0.7, -1, 0.2] },
    { prop: 'scale', wave: 'pulse', amp: 0.05, freq: 1 }] },
].map(p => ({ ...sanitizeProgram({ envelope: { attack: 0.3, hold: 0, release: 0.8 }, ...p }), id: p.id, builtin: true }))
