/**
 * utils/OmniAnimationModel.js (V287) — animation CLASSES: a named, reusable bundle of keys that says how something moves along ONE segment (from A to B).
 * Pure: no DOM, no three.js. The same class can move the camera in a LogicalExpression, a node, or later a MultiVideo key.
 *
 *   animation = { id, name, dur (seconds at 1x), tracks: { <channel>: [{ t (0..1), v, ease }] } }
 *   channels:  progress (0..1 along A -> B; default linear) · lateral (sideways, as a fraction of the segment length) · lift (up, same) · fov (degrees added) · shake (0..1 vibration strength) · flash (0..1 screen flash)
 *   A track is nothing before its first key's t (it holds the first value), eases into each later key with that key's GSAP ease, and holds the last value.
 */
import { easeAt } from './OmniMultiVideoModel.js'

export const CHANNELS = ['progress', 'lateral', 'lift', 'fov', 'shake', 'flash']
const RANGE = { progress: [-2, 3], lateral: [-5, 5], lift: [-5, 5], fov: [-60, 60], shake: [0, 1], flash: [0, 1] }
const DEFAULT = { progress: null, lateral: 0, lift: 0, fov: 0, shake: 0, flash: 0 }
export const LIMITS = Object.freeze({ keys: 32, dur: [0.1, 20], name: 40, animations: 64 })
const own = (o, k) => o && typeof o === 'object' && Object.prototype.hasOwnProperty.call(o, k) ? o[k] : undefined
const clamp = (v, [lo, hi], d) => { const n = typeof v === 'number' ? v : (typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d }

export function sanitizeAnimation (raw) {
  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}; const tr = own(r, 'tracks'); const tracks = {}
  for (const ch of CHANNELS) {
    const list = tr && typeof tr === 'object' ? own(tr, ch) : null; if (!Array.isArray(list)) continue
    const keys = list.slice(0, LIMITS.keys).map(k => ({ t: clamp(own(k, 't'), [0, 1], 0), v: clamp(own(k, 'v'), RANGE[ch], 0), ease: typeof own(k, 'ease') === 'string' ? k.ease.slice(0, 20) : 'none' })).sort((a, b) => a.t - b.t)
    if (keys.length) tracks[ch] = keys
  }
  const id = typeof own(r, 'id') === 'string' ? r.id.replace(/[^\w.-]/g, '').slice(0, 40) : ''
  const name = typeof own(r, 'name') === 'string' ? r.name.replace(/[\u0000-\u001f]/g, '').slice(0, LIMITS.name) : ''
  return { id: id || 'anim', name: name || id || 'Animation', dur: clamp(own(r, 'dur'), LIMITS.dur, 1), tracks }
}
function trackAt (keys, p, ch) {
  if (!keys) return DEFAULT[ch]
  if (p <= keys[0].t) return keys[0].v
  const last = keys[keys.length - 1]; if (p >= last.t) return last.v
  let i = 0; while (i + 1 < keys.length && keys[i + 1].t <= p) i++
  const a = keys[i], b = keys[i + 1]; const k = easeAt(b.ease, (p - a.t) / Math.max(1e-6, b.t - a.t)); return a.v + (b.v - a.v) * k
}
/** the value of every channel at p (0..1 through the segment) */
export function sampleAnimation (anim, p) {
  const a = sanitizeAnimation(anim); const q = Math.max(0, Math.min(1, Number.isFinite(p) ? p : 0)); const out = {}
  for (const ch of CHANNELS) { const v = trackAt(a.tracks[ch], q, ch); out[ch] = ch === 'progress' && v === null ? q : v }
  return out
}
const K = (t, v, ease = 'none') => ({ t, v, ease })
/** the built-in classes the LogicalExpression draws from */
export const BUILTIN = Object.freeze([
  { id: 'hyperlapse', name: 'Hyperlapse', dur: 1.1, tracks: { progress: [K(0, 0), K(1, 1, 'power3.inOut')], shake: [K(0, 0), K(0.5, 0.7, 'sine.inOut'), K(1, 0, 'sine.inOut')], fov: [K(0, 0), K(0.5, 16, 'sine.inOut'), K(1, 0, 'sine.inOut')], lateral: [K(0, 0), K(0.5, 0.18, 'sine.inOut'), K(1, 0, 'sine.inOut')] } },
  { id: 'teleport', name: 'Teleport steps', dur: 0.9, tracks: { progress: [K(0, 0), K(0.18, 0), K(0.2, 0.35), K(0.45, 0.35), K(0.47, 0.7), K(0.72, 0.7), K(0.74, 1)], flash: [K(0, 0), K(0.19, 1), K(0.25, 0), K(0.46, 1), K(0.52, 0), K(0.73, 1), K(0.8, 0)], shake: [K(0, 0), K(0.2, 0.9), K(0.4, 0.2), K(0.47, 0.9), K(0.8, 0)], fov: [K(0, 0), K(0.2, 22), K(0.45, 4), K(0.74, 26), K(1, 0, 'power2.out')] } },
  { id: 'streak', name: 'Laser streak', dur: 0.55, tracks: { progress: [K(0, 0), K(0.15, 0.92, 'expo.out'), K(1, 1, 'power2.out')], fov: [K(0, 0), K(0.15, 34, 'expo.out'), K(1, 0, 'power2.out')], flash: [K(0, 0), K(0.08, 1), K(0.22, 0)], shake: [K(0, 0), K(0.15, 1), K(1, 0, 'power2.out')] } },
  { id: 'settle', name: 'Settle', dur: 1.4, tracks: { progress: [K(0, 0), K(1, 1, 'power2.out')], fov: [K(0, 0), K(0.4, 6, 'sine.out'), K(1, 0, 'sine.inOut')], shake: [K(0, 0.3), K(1, 0, 'power2.out')] } },
])
export const getAnimation = (id) => BUILTIN.find(a => a.id === id) ?? null
