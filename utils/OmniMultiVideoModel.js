/**
 * utils/OmniMultiVideoModel.js (V285) — the data and the maths of a MultiVideoNode: several library videos cut together on a timeline,
 * played on one plane, with key coordinates (the node and / or the camera move in step with the video) and a thin text layer in front.
 * Pure: no DOM, no three.js, no gsap. Tests run it directly; utils/OmniMultiVideoMesh.js draws it; systems/OmniMultiVideo.js plays it.
 *
 * data.multiVideo = {
 *   width, loop, muted, volume,
 *   clips: [{ id, source:{type:'video', id}|null, name, dur, in, out, speed, volume, opacity, fadeIn, fadeOut,
 *             transition:{ kind:'cut'|'fade'|'dip'|'wipe'|'slide', dur }   // how THIS clip comes in from the one before it
 *             key:{ enabled, color, similarity, smoothness, spill } }],
 *   keys:  [{ id, t, target:'node'|'camera'|'both', pos:[x,y,z], look:[x,y,z]|null, ease }],   // keyCoordinates: ease = the GSAP ease of the move INTO this key
 *   text:  { on, items:[{ id, text, t0, t1, size, color, bg, align, fadeIn, fadeOut }], base:[x,y,z], width,
 *            motion:[{ id, t, mode:'cardinal'|'spherical', cardinal:[x,y,z], spherical:[r, azimuth°, elevation°], ease }] }
 * }
 * Time is seconds on the edit's own timeline (not a video's time). A clip's source time = in + (t - start) * speed.
 */
import { hexToRgb } from './OmniStoredVideoModel.js'

export const KINDS = ['cut', 'fade', 'dip', 'wipe', 'slide']
export const TARGETS = ['node', 'camera', 'both']
export const CARDINAL = Object.freeze({ up: [0, 1, 0], down: [0, -1, 0], left: [-1, 0, 0], right: [1, 0, 0], forward: [0, 0, 1], back: [0, 0, -1] })
export const LIMITS = Object.freeze({
  clips: 24, keys: 64, items: 24, motion: 64, width: [0.5, 40], speed: [0.25, 4], vol: [0, 1], opacity: [0, 1], fade: [0, 30], trans: [0.1, 5], time: [0, 36000], coord: 100000,
  text: 400, size: [0.05, 5], sphR: [0, 100000], dur: [0.1, 36000], name: 80
})
export const DEFAULT_EASE = 'power2.inOut'
/** the same list the camera travel settings offer (utils/CameraTravelSettings.js), plus nothing invented */
export const EASES = ['none', 'power1.in', 'power1.out', 'power1.inOut', 'power2.in', 'power2.out', 'power2.inOut', 'power3.in', 'power3.out', 'power3.inOut', 'power4.in', 'power4.out', 'power4.inOut',
  'back.in', 'back.out', 'back.inOut', 'elastic.in', 'elastic.out', 'elastic.inOut', 'bounce.in', 'bounce.out', 'bounce.inOut', 'sine.in', 'sine.out', 'sine.inOut', 'circ.in', 'circ.out', 'circ.inOut', 'expo.in', 'expo.out', 'expo.inOut']

const clamp = (v, lo, hi, d) => { const n = typeof v === 'number' ? v : (typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d }
const own = (o, k) => o && typeof o === 'object' && Object.prototype.hasOwnProperty.call(o, k) ? o[k] : undefined
const obj = (v) => v && typeof v === 'object' && !Array.isArray(v) ? v : {}
const str = (v, max, d = '') => typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').slice(0, max) : d
const HEX = /^#[0-9a-fA-F]{6}$/
const hex = (v, d) => typeof v === 'string' && HEX.test(v) ? v.toLowerCase() : d
const idOf = (v, d) => { const s = typeof v === 'string' ? v.replace(/[^\w-]/g, '').slice(0, 32) : ''; return s || d }
const vec3 = (v, d) => Array.isArray(v) && v.length >= 3 ? [clamp(v[0], -LIMITS.coord, LIMITS.coord, d[0]), clamp(v[1], -LIMITS.coord, LIMITS.coord, d[1]), clamp(v[2], -LIMITS.coord, LIMITS.coord, d[2])] : [...d]
const vec3n = (v) => Array.isArray(v) && v.length >= 3 && v.slice(0, 3).every(x => Number.isFinite(Number(x))) ? vec3(v, [0, 0, 0]) : null
const ease = (v) => typeof v === 'string' && EASES.includes(v) ? v : DEFAULT_EASE
let _n = 0
const newId = (p) => p + (++_n).toString(36) + Math.random().toString(36).slice(2, 5)

// ── easing (the GSAP names, computed here so the model stays pure) ──
const OUT = { power1: (p) => 1 - (1 - p) ** 2, power2: (p) => 1 - (1 - p) ** 3, power3: (p) => 1 - (1 - p) ** 4, power4: (p) => 1 - (1 - p) ** 5, sine: (p) => Math.sin(p * Math.PI / 2), circ: (p) => Math.sqrt(1 - (1 - p) ** 2), expo: (p) => p >= 1 ? 1 : 1 - 2 ** (-10 * p),
  back: (p) => { const s = 1.70158; const q = p - 1; return q * q * ((s + 1) * q + s) + 1 },
  elastic: (p) => p <= 0 ? 0 : p >= 1 ? 1 : 2 ** (-10 * p) * Math.sin((p - 0.3 / 4) * (2 * Math.PI) / 0.3) + 1,
  bounce: (p) => { const n = 7.5625, d = 2.75; if (p < 1 / d) return n * p * p; if (p < 2 / d) { p -= 1.5 / d; return n * p * p + 0.75 } if (p < 2.5 / d) { p -= 2.25 / d; return n * p * p + 0.9375 } p -= 2.625 / d; return n * p * p + 0.984375 } }
/** easeAt('power2.inOut', p) -> 0..1 (back and elastic may overshoot, like GSAP). Unknown names are linear. */
export function easeAt (name, p) {
  const x = Math.min(1, Math.max(0, Number.isFinite(p) ? p : 0)); const nm = typeof name === 'string' ? name : 'none'
  if (nm === 'none') return x
  const [fam, dir] = nm.split('.'); const f = OUT[fam]; if (!f) return x
  if (dir === 'out') return f(x)
  if (dir === 'in') return 1 - f(1 - x)
  return x < 0.5 ? (1 - f(1 - 2 * x)) / 2 : (1 + f(2 * x - 1)) / 2     // inOut
}

// ── sanitizers ──
export function defaultKey () { return { enabled: false, color: '#00ff00', similarity: 0.4, smoothness: 0.08, spill: 0.1 } }
export function sanitizeClip (raw) {
  const r = obj(raw); const k = obj(own(r, 'key')); const s = obj(own(r, 'source')); const t = obj(own(r, 'transition')); const sid = typeof s.id === 'string' ? s.id.replace(/[^\w.:-]/g, '').slice(0, 96) : ''
  const kd = defaultKey(); const kind = KINDS.includes(t.kind) ? t.kind : 'cut'
  return {
    id: idOf(own(r, 'id'), newId('c')), source: sid ? { type: 'video', id: sid } : null, name: str(own(r, 'name'), LIMITS.name),
    dur: clamp(own(r, 'dur'), ...LIMITS.dur, 5), in: clamp(own(r, 'in'), 0, LIMITS.time[1], 0), out: clamp(own(r, 'out'), 0, LIMITS.time[1], 0),
    speed: clamp(own(r, 'speed'), ...LIMITS.speed, 1), volume: clamp(own(r, 'volume'), ...LIMITS.vol, 1), opacity: clamp(own(r, 'opacity'), ...LIMITS.opacity, 1),
    fadeIn: clamp(own(r, 'fadeIn'), ...LIMITS.fade, 0), fadeOut: clamp(own(r, 'fadeOut'), ...LIMITS.fade, 0),
    transition: { kind, dur: clamp(t.dur, ...LIMITS.trans, 0.6) },
    key: { enabled: typeof k.enabled === 'boolean' ? k.enabled : kd.enabled, color: hex(k.color, kd.color), similarity: clamp(k.similarity, 0, 1, kd.similarity), smoothness: clamp(k.smoothness, 0, 1, kd.smoothness), spill: clamp(k.spill, 0, 1, kd.spill) },
  }
}
export function sanitizeKeyCoord (raw) {
  const r = obj(raw)
  return { id: idOf(own(r, 'id'), newId('k')), t: clamp(own(r, 't'), ...LIMITS.time, 0), target: TARGETS.includes(own(r, 'target')) ? r.target : 'both', pos: vec3(own(r, 'pos'), [0, 0, 0]), look: vec3n(own(r, 'look')), ease: ease(own(r, 'ease')) }
}
export function sanitizeTextItem (raw) {
  const r = obj(raw)
  return { id: idOf(own(r, 'id'), newId('t')), text: str(own(r, 'text'), LIMITS.text), t0: clamp(own(r, 't0'), ...LIMITS.time, 0), t1: clamp(own(r, 't1'), ...LIMITS.time, 0), size: clamp(own(r, 'size'), ...LIMITS.size, 0.5),
    color: hex(own(r, 'color'), '#ffffff'), bg: typeof own(r, 'bg') === 'string' && (r.bg === '' || HEX.test(r.bg)) ? r.bg.toLowerCase() : '', align: ['left', 'center', 'right'].includes(own(r, 'align')) ? r.align : 'center',
    fadeIn: clamp(own(r, 'fadeIn'), ...LIMITS.fade, 0.3), fadeOut: clamp(own(r, 'fadeOut'), ...LIMITS.fade, 0.3) }
}
export function sanitizeMotionKey (raw) {
  const r = obj(raw); const sp = Array.isArray(own(r, 'spherical')) ? r.spherical : []
  return { id: idOf(own(r, 'id'), newId('m')), t: clamp(own(r, 't'), ...LIMITS.time, 0), mode: own(r, 'mode') === 'spherical' ? 'spherical' : 'cardinal', cardinal: vec3(own(r, 'cardinal'), [0, 0, 0]),
    spherical: [clamp(sp[0], ...LIMITS.sphR, 1), clamp(sp[1], -3600, 3600, 0), clamp(sp[2], -90, 90, 0)], ease: ease(own(r, 'ease')) }
}
export function defaultMultiVideo () {
  return { width: 6, loop: false, muted: true, volume: 0.8, clips: [], keys: [], text: { on: true, items: [], base: [0, 0, 0.15], width: 0.9, motion: [] } }
}
const uniq = (list) => { const seen = new Set(); return list.map(x => { let id = x.id; while (seen.has(id)) id = newId('x'); seen.add(id); return id === x.id ? x : { ...x, id } }) }
/** never throws, idempotent, no prototype pollution */
export function sanitizeMultiVideo (raw) {
  const r = obj(raw); const d = defaultMultiVideo(); const tx = obj(own(r, 'text'))
  const arr = (v, max) => (Array.isArray(v) ? v.slice(0, max) : [])
  const byT = (a, b) => a.t - b.t
  return {
    width: clamp(own(r, 'width'), ...LIMITS.width, d.width), loop: typeof own(r, 'loop') === 'boolean' ? r.loop : d.loop, muted: typeof own(r, 'muted') === 'boolean' ? r.muted : d.muted, volume: clamp(own(r, 'volume'), ...LIMITS.vol, d.volume),
    clips: uniq(arr(own(r, 'clips'), LIMITS.clips).map(sanitizeClip)),
    keys: uniq(arr(own(r, 'keys'), LIMITS.keys).map(sanitizeKeyCoord).sort(byT)),
    text: { on: typeof own(tx, 'on') === 'boolean' ? tx.on : true, items: uniq(arr(own(tx, 'items'), LIMITS.items).map(sanitizeTextItem)), base: vec3(own(tx, 'base'), d.text.base), width: clamp(own(tx, 'width'), 0.1, 2, 0.9),
      motion: uniq(arr(own(tx, 'motion'), LIMITS.motion).map(sanitizeMotionKey).sort(byT)) },
  }
}

// ── the timeline ──
/** seconds of timeline a clip takes: (out - in) / speed; out 0 = to the end of the source */
export function clipLength (c) { const s = sanitizeClip(c); const end = s.out > 0 ? s.out : s.dur; return Math.max(0.1, (end - s.in) / s.speed) }
/** [{ i, id, start, end, len }] — a non-cut transition overlaps the clip before it by the transition length */
export function layout (clips) {
  const out = []; let end = 0
  ;(Array.isArray(clips) ? clips : []).forEach((c, i) => {
    const s = sanitizeClip(c); const len = clipLength(s); let start = end
    if (i > 0 && s.transition.kind !== 'cut') { const prev = out[i - 1]; const ov = Math.min(s.transition.dur, prev.len * 0.9, len * 0.9); start = Math.max(prev.start, prev.end - ov) }
    out.push({ i, id: s.id, start, end: start + len, len }); end = Math.max(end, start + len)
  })
  return out
}
export const totalDuration = (clips) => { const l = layout(clips); return l.length ? Math.max(...l.map(x => x.end)) : 0 }
const fadeAlpha = (c, local, len) => { let a = 1; if (c.fadeIn > 0) a *= Math.min(1, local / c.fadeIn); if (c.fadeOut > 0) a *= Math.min(1, (len - local) / c.fadeOut); return Math.max(0, Math.min(1, a)) * c.opacity }
/**
 * What the screen shows at timeline time t.
 * Returns { a, b, p, kind } — a / b are { i, src (the source time to show), alpha, vol } or null; p 0..1 is how far the cross-over has gone (0 when only a is on screen).
 * A gap (before the first clip is never a gap; after the end shows nothing) returns { a:null, b:null }.
 */
export function activeAt (clips, t) {
  const list = (Array.isArray(clips) ? clips : []).map(sanitizeClip); const lay = layout(list); const now = Number.isFinite(t) ? Math.max(0, t) : 0
  const live = lay.filter(l => now >= l.start && now < l.end)
  const pick = (l) => { const c = list[l.i]; const local = now - l.start; return { i: l.i, id: c.id, src: c.in + local * c.speed, alpha: fadeAlpha(c, local, l.len), vol: c.volume } }
  if (!live.length) return { a: null, b: null, p: 0, kind: 'cut' }
  if (live.length === 1) return { a: pick(live[0]), b: null, p: 0, kind: 'cut' }
  const A = live[0], B = live[live.length - 1]; const tr = list[B.i].transition; const p = Math.min(1, Math.max(0, (now - B.start) / Math.max(0.0001, A.end - B.start)))
  return { a: pick(A), b: pick(B), p, kind: tr.kind }
}

// ── keyCoordinates ──
const lerp3 = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]
/** the value of a track of keys at time t: nothing before the first key; between two keys it moves with the later key's ease; after the last key it holds */
function track (keys, t, pick) {
  if (!keys.length) return null
  if (t < keys[0].t) return null
  const last = keys[keys.length - 1]; if (t >= last.t) return pick(last, null, 0)
  let i = 0; while (i + 1 < keys.length && keys[i + 1].t <= t) i++
  const a = keys[i], b = keys[i + 1]; const k = easeAt(b.ease, (t - a.t) / Math.max(0.0001, b.t - a.t))
  return pick(a, b, k)
}
/**
 * The pose the keys ask for at time t: { node: [x,y,z]|null, camera: { pos, look|null }|null }.
 * null = no key has started yet (leave it alone). camera.look null = look at the node.
 */
export function poseAt (keys, t) {
  const ks = (Array.isArray(keys) ? keys : []).map(sanitizeKeyCoord).sort((a, b) => a.t - b.t); const now = Number.isFinite(t) ? t : 0
  const nodeKeys = ks.filter(k => k.target !== 'camera'), camKeys = ks.filter(k => k.target !== 'node')
  const node = track(nodeKeys, now, (a, b, k) => (b ? lerp3(a.pos, b.pos, k) : [...a.pos]))
  const camera = track(camKeys, now, (a, b, k) => {
    if (!b) return { pos: [...a.pos], look: a.look ? [...a.look] : null }
    const look = a.look && b.look ? lerp3(a.look, b.look, k) : (b.look ?? a.look ?? null)
    return { pos: lerp3(a.pos, b.pos, k), look: look ? [...look] : null }
  })
  return { node, camera }
}

// ── the text layer ──
export const sphericalToCartesian = (r, azDeg, elDeg) => { const az = azDeg * Math.PI / 180, el = elDeg * Math.PI / 180; return [r * Math.cos(el) * Math.sin(az), r * Math.sin(el), r * Math.cos(el) * Math.cos(az)] }
export const cartesianToSpherical = (v) => { const r = Math.hypot(v[0], v[1], v[2]); if (r < 1e-9) return [0, 0, 0]; return [r, Math.atan2(v[0], v[2]) * 180 / Math.PI, Math.asin(Math.max(-1, Math.min(1, v[1] / r))) * 180 / Math.PI] }
/** a cardinal move: a direction name and a distance -> the [x,y,z] offset (up, down, left, right, forward = toward the viewer, back) */
export function cardinalVec (dir, dist = 1) { const v = CARDINAL[dir] ?? [0, 0, 0]; const d = Number.isFinite(dist) ? dist : 1; return [v[0] * d, v[1] * d, v[2] * d] }
const motionVec = (m) => (m.mode === 'spherical' ? sphericalToCartesian(...m.spherical) : m.cardinal)
/**
 * Where the text layer sits (local to the node, in node units) at time t: base + the motion keys' offset.
 * Two spherical keys in a row move round the node on an arc (radius, azimuth, elevation each eased); any other pair moves in a straight line.
 */
export function textOffsetAt (text, t) {
  const tx = obj(text); const base = vec3(own(tx, 'base'), [0, 0, 0.15]); const ms = (Array.isArray(own(tx, 'motion')) ? tx.motion : []).map(sanitizeMotionKey).sort((a, b) => a.t - b.t); const now = Number.isFinite(t) ? t : 0
  if (!ms.length || now < ms[0].t) return [...base]
  let off
  const last = ms[ms.length - 1]
  if (now >= last.t) off = motionVec(last)
  else {
    let i = 0; while (i + 1 < ms.length && ms[i + 1].t <= now) i++
    const a = ms[i], b = ms[i + 1]; const k = easeAt(b.ease, (now - a.t) / Math.max(0.0001, b.t - a.t))
    if (a.mode === 'spherical' && b.mode === 'spherical') { const s = [0, 1, 2].map(j => a.spherical[j] + (b.spherical[j] - a.spherical[j]) * k); off = sphericalToCartesian(s[0], s[1], s[2]) } else off = lerp3(motionVec(a), motionVec(b), k)
  }
  return [base[0] + off[0], base[1] + off[1], base[2] + off[2]]
}
/** the caption that shows at time t: { item, alpha } or null. t1 = 0 means "until the end of the edit" */
export function textAt (text, t, total = 0) {
  const tx = obj(text); if (tx.on === false) return null
  const now = Number.isFinite(t) ? t : 0
  for (const raw of Array.isArray(tx.items) ? tx.items : []) {
    const it = sanitizeTextItem(raw); const end = it.t1 > 0 ? it.t1 : (total > 0 ? total : Infinity)
    if (!it.text || now < it.t0 || now > end) continue
    let a = 1; if (it.fadeIn > 0) a = Math.min(a, (now - it.t0) / it.fadeIn); if (it.fadeOut > 0 && Number.isFinite(end)) a = Math.min(a, (end - now) / it.fadeOut)
    return { item: it, alpha: Math.max(0, Math.min(1, a)) }
  }
  return null
}

// ── editing helpers (pure: return a new multiVideo) ──
const clone = (o) => JSON.parse(JSON.stringify(o))
export function addClip (mv, clip, at = -1) { const m = sanitizeMultiVideo(mv); const c = sanitizeClip(clip); if (m.clips.length >= LIMITS.clips) return m; const i = at < 0 || at > m.clips.length ? m.clips.length : at; m.clips.splice(i, 0, c); return sanitizeMultiVideo(m) }
export function updateClip (mv, id, patch) { const m = sanitizeMultiVideo(mv); const i = m.clips.findIndex(c => c.id === id); if (i < 0) return m; const p = obj(patch); m.clips[i] = sanitizeClip({ ...m.clips[i], ...p, id, transition: { ...m.clips[i].transition, ...obj(p.transition) }, key: { ...m.clips[i].key, ...obj(p.key) } }); return sanitizeMultiVideo(m) }
export function removeClip (mv, id) { const m = sanitizeMultiVideo(mv); m.clips = m.clips.filter(c => c.id !== id); return m }
export function moveClip (mv, id, delta) { const m = sanitizeMultiVideo(mv); const i = m.clips.findIndex(c => c.id === id); const j = i + delta; if (i < 0 || j < 0 || j >= m.clips.length) return m; const [c] = m.clips.splice(i, 1); m.clips.splice(j, 0, c); return m }
/** cut the clip that is on screen at timeline time t into two (the second keeps the settings, comes in with a cut) */
export function splitClip (mv, t) {
  const m = sanitizeMultiVideo(mv); const lay = layout(m.clips); const l = lay.find(x => t > x.start + 0.05 && t < x.end - 0.05); if (!l) return { mv: m, ok: false }
  const c = m.clips[l.i]; const srcAt = c.in + (t - l.start) * c.speed; const end = c.out > 0 ? c.out : c.dur
  const a = { ...clone(c), out: srcAt, fadeOut: 0 }; const b = { ...clone(c), id: newId('c'), in: srcAt, out: end === c.dur && c.out === 0 ? 0 : c.out, fadeIn: 0, transition: { kind: 'cut', dur: c.transition.dur } }
  m.clips.splice(l.i, 1, a, b); return { mv: sanitizeMultiVideo(m), ok: true }
}
export function addKeyCoord (mv, key) { const m = sanitizeMultiVideo(mv); if (m.keys.length >= LIMITS.keys) return m; m.keys.push(sanitizeKeyCoord(key)); return sanitizeMultiVideo(m) }
export function updateKeyCoord (mv, id, patch) { const m = sanitizeMultiVideo(mv); const i = m.keys.findIndex(k => k.id === id); if (i < 0) return m; m.keys[i] = sanitizeKeyCoord({ ...m.keys[i], ...obj(patch), id }); return sanitizeMultiVideo(m) }
export function removeKeyCoord (mv, id) { const m = sanitizeMultiVideo(mv); m.keys = m.keys.filter(k => k.id !== id); return m }
export function addTextItem (mv, item) { const m = sanitizeMultiVideo(mv); if (m.text.items.length >= LIMITS.items) return m; m.text.items.push(sanitizeTextItem(item)); return sanitizeMultiVideo(m) }
export function updateTextItem (mv, id, patch) { const m = sanitizeMultiVideo(mv); const i = m.text.items.findIndex(k => k.id === id); if (i < 0) return m; m.text.items[i] = sanitizeTextItem({ ...m.text.items[i], ...obj(patch), id }); return sanitizeMultiVideo(m) }
export function removeTextItem (mv, id) { const m = sanitizeMultiVideo(mv); m.text.items = m.text.items.filter(k => k.id !== id); return m }
export function addMotionKey (mv, key) { const m = sanitizeMultiVideo(mv); if (m.text.motion.length >= LIMITS.motion) return m; m.text.motion.push(sanitizeMotionKey(key)); return sanitizeMultiVideo(m) }
export function updateMotionKey (mv, id, patch) { const m = sanitizeMultiVideo(mv); const i = m.text.motion.findIndex(k => k.id === id); if (i < 0) return m; m.text.motion[i] = sanitizeMotionKey({ ...m.text.motion[i], ...obj(patch), id }); return sanitizeMultiVideo(m) }
export function removeMotionKey (mv, id) { const m = sanitizeMultiVideo(mv); m.text.motion = m.text.motion.filter(k => k.id !== id); return m }
export { hexToRgb }
