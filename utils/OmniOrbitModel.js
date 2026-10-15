/**
 * utils/OmniOrbitModel.js — the MODEL of an OmniOrbitNode: a motion path made of circular ARCS that something rides around a centre (V199). PURE: no DOM,
 * no THREE, no storage, no timers. The design is docs/architecture/OMNITIMEORBIT_DESIGN.md.
 *
 * What it describes: a sequence of arcs. Each arc is a part of a circle in one of three planes (xy = a clock face seen from the front, xz = flat like a
 * floor seen from above, yz = a clock face seen from the side), written in CLOCK notation: 12 = 0 degrees, 3 = 90, 6 = 180, 9 = 270, going clockwise. So
 * "12 to 6" is {plane:'xy', from:0, to:180} and "then 3 to 9" is the next arc {from:90, to:270}. `dir` is 'cw' or 'ccw'; from == to means a FULL circle.
 * An arc has a duration, an ease, a `repeat` count, an optional `bounce` (every other repeat runs backwards) and an optional `lead` (seconds spent gliding
 * from where the previous arc ended to where this one starts; 0 = jump). The whole sequence repeats `iterations` times (0 = forever).
 *
 * What it does NOT decide: WHO moves. poseAt() returns a position (and angle) around `center`; a node layer applies it to the rider (the camera, the
 * "satellite" you grab) or to a node. Keeping that out of the model keeps both uses available.
 *
 * It lives in `node.data.orbit` (saved WITH the node). sanitizeOrbit NEVER throws, drops unknown keys (also __proto__ / constructor), clamps numbers,
 * enforces ORBIT_LIMITS, makes ids unique and is IDEMPOTENT. Edit ops are IMMUTABLE and never throw. USER-facing module: it imports nothing.
 */

export const ORBIT_VERSION = 1
export const ORBIT_LIMITS = Object.freeze({
  arcsMax: 32, iterationsMax: 64, repeatMax: 16, secondsMin: 0.05, secondsMax: 3600, leadMax: 60,
  radiusMin: 0.1, radiusMax: 10000, radiusDefault: 5, scaleMin: 0.1, scaleMax: 4, centerMax: 100000, tiltMax: 360, nameMax: 24, idMax: 32,
})
export const PLANES = Object.freeze(['xy', 'xz', 'yz'])
export const DIRS = Object.freeze(['cw', 'ccw'])
export const EASES = Object.freeze(['linear', 'easeIn', 'easeOut', 'easeInOut'])
export const MODES = Object.freeze(['camera', 'node'])
const L = ORBIT_LIMITS

const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k)
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v)
const get = (o, k) => { try { return isObj(o) && has(o, k) ? o[k] : undefined } catch (_) { return undefined } }
const r3 = (v) => { const x = Math.round(v * 1000) / 1000; return x === 0 ? 0 : x }
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v)
const toNum = (v, d) => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : d
  if (typeof v === 'string' && v.trim() !== '') { const n = Number(v); return Number.isFinite(n) ? n : d }
  return d
}
const numIn = (v, d, a, b) => clamp(toNum(v, d), a, b)
const intIn = (v, d, a, b) => Math.round(numIn(v, d, a, b))
const boolOf = (v, d) => (typeof v === 'boolean' ? v : (v === 1 || v === 'true') ? true : (v === 0 || v === 'false') ? false : d)
const cleanText = (v, max, d = '') => {
  const s = (typeof v === 'string' || typeof v === 'number') ? String(v).replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max) : ''
  return s || d
}
const ID_RE = /^[A-Za-z0-9_-]{1,32}$/
const REF_RE = /^[A-Za-z0-9_-]{1,64}$/
const validId = (v) => (typeof v === 'string' && ID_RE.test(v) && !v.startsWith('__') ? v : null)
const items = (a, cap) => { if (!Array.isArray(a)) return []; const out = []; const n = Math.min(a.length, cap * 2); for (let i = 0; i < n; i++) { let x; try { x = a[i] } catch (_) { x = undefined } if (x !== undefined) out.push(x) } return out }
const mod360 = (d) => ((d % 360) + 360) % 360

let idCounter = 0
export function newId (prefix = 'a') { idCounter = (idCounter + 1) % 1e9; return (String(prefix).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 8) || 'a') + Date.now().toString(36).slice(-5) + idCounter.toString(36) }

// ── clock notation ──
/** A clock-face position to degrees: 12 -> 0, 3 -> 90, 6 -> 180, 9 -> 270, 1.5 -> 45. Accepts a number or '3', '12:30'. NaN when it cannot be read. */
export function clockToDeg (h) {
  let hours = NaN
  if (typeof h === 'number') hours = h
  else if (typeof h === 'string') {
    const m = /^\s*(\d{1,2})(?::(\d{1,2}))?\s*$/.exec(h)
    if (m) hours = Number(m[1]) + (m[2] ? Number(m[2]) / 60 : 0)
  }
  if (!Number.isFinite(hours)) return NaN
  return r3(mod360(hours * 30))
}
/** Degrees back to a clock-face hour in (0, 12]: 0 -> 12, 90 -> 3, 180 -> 6. */
export function degToClock (deg) {
  const d = toNum(deg, NaN); if (!Number.isFinite(d)) return NaN
  const h = r3(mod360(d) / 30)
  return h === 0 ? 12 : h
}

export function defaultArc (over = {}) {
  return { id: 'a1', plane: 'xz', from: 0, to: 0, dir: 'cw', seconds: 20, ease: 'linear', repeat: 1, bounce: false, lead: 0, radiusScale: 1, ...over }
}
export function defaultOrbit () {
  return { v: ORBIT_VERSION, name: 'Orbit', mode: 'camera', target: null, center: { x: 0, y: 0, z: 0 }, radius: L.radiusDefault, tilt: { x: 0, y: 0, z: 0 },
    iterations: 0, freeLook: true, lockMove: true, arcs: [defaultArc()] }
}

function sanitizeArc (raw, fallbackId) {
  const d = defaultArc()
  const g = (k) => get(raw, k)
  return {
    id: fallbackId,
    plane: PLANES.includes(g('plane')) ? g('plane') : d.plane,
    from: r3(mod360(numIn(g('from'), d.from, -1e6, 1e6))),
    to: r3(mod360(numIn(g('to'), d.to, -1e6, 1e6))),
    dir: DIRS.includes(g('dir')) ? g('dir') : d.dir,
    seconds: r3(numIn(g('seconds'), d.seconds, L.secondsMin, L.secondsMax)),
    ease: EASES.includes(g('ease')) ? g('ease') : d.ease,
    repeat: intIn(g('repeat'), d.repeat, 1, L.repeatMax),
    bounce: boolOf(g('bounce'), d.bounce),
    lead: r3(numIn(g('lead'), d.lead, 0, L.leadMax)),
    radiusScale: r3(numIn(g('radiusScale'), d.radiusScale, L.scaleMin, L.scaleMax)),
  }
}
const vec3 = (raw, d, lim) => ({ x: r3(numIn(get(raw, 'x'), d.x, -lim, lim)), y: r3(numIn(get(raw, 'y'), d.y, -lim, lim)), z: r3(numIn(get(raw, 'z'), d.z, -lim, lim)) })

/** Repair ANY value into a valid orbit. Never throws. */
export function sanitizeOrbit (raw) {
  const d = defaultOrbit()
  if (!isObj(raw)) return d
  const target = get(raw, 'target')
  const out = {
    v: ORBIT_VERSION,
    name: cleanText(get(raw, 'name'), L.nameMax, d.name),
    mode: MODES.includes(get(raw, 'mode')) ? get(raw, 'mode') : d.mode,
    target: typeof target === 'string' && REF_RE.test(target) && !target.startsWith('__') ? target : null,
    center: vec3(get(raw, 'center'), d.center, L.centerMax),
    radius: r3(numIn(get(raw, 'radius'), d.radius, L.radiusMin, L.radiusMax)),
    tilt: vec3(get(raw, 'tilt'), d.tilt, L.tiltMax),
    iterations: intIn(get(raw, 'iterations'), d.iterations, 0, L.iterationsMax),
    freeLook: boolOf(get(raw, 'freeLook'), d.freeLook),
    lockMove: boolOf(get(raw, 'lockMove'), d.lockMove),
    arcs: [],
  }
  const rawArcs = get(raw, 'arcs')
  const used = new Set(); let n = 0
  for (const a of items(rawArcs, L.arcsMax)) {
    if (!isObj(a)) continue
    if (out.arcs.length >= L.arcsMax) break
    let id = validId(get(a, 'id')); if (!id || used.has(id)) id = null
    while (!id) { n++; const c = 'a' + n; if (!used.has(c)) id = c }
    used.add(id)
    out.arcs.push(sanitizeArc(a, id))
  }
  if (!Array.isArray(rawArcs)) out.arcs.push(sanitizeArc({}, 'a1'))   // no list at all -> the default circle; an explicit empty list stays empty
  return out
}

// ── maths ──
/** Signed sweep of an arc in degrees (positive = clockwise). from == to is a full circle (360). */
export function sweepOf (arc) {
  const a = sanitizeArc(arc, 'x')
  let d = mod360(a.to - a.from); if (d === 0) d = 360
  return a.dir === 'ccw' ? -d : d
}
/** Seconds one arc takes including its lead and repeats. */
export function arcDuration (arc) { const a = sanitizeArc(arc, 'x'); return a.lead + a.seconds * a.repeat }
/** Seconds one pass over all arcs takes. */
export function orbitDuration (orbit) { return sanitizeOrbit(orbit).arcs.reduce((s, a) => s + arcDuration(a), 0) }
/** Total seconds for `iterations` passes; null when it runs forever (iterations 0) or has no arcs. */
export function totalDuration (orbit) {
  const o = sanitizeOrbit(orbit); const d = orbitDuration(o)
  return o.iterations === 0 || d <= 0 ? null : d * o.iterations
}
export function ease (kind, u) {
  const x = clamp(toNum(u, 0), 0, 1)
  if (kind === 'easeIn') return x * x
  if (kind === 'easeOut') return 1 - (1 - x) * (1 - x)
  if (kind === 'easeInOut') return x * x * (3 - 2 * x)
  return x
}
const rad = (deg) => deg * Math.PI / 180
function rotate (v, tilt) {
  let { x, y, z } = v
  if (tilt.x) { const c = Math.cos(rad(tilt.x)); const s = Math.sin(rad(tilt.x)); const y2 = y * c - z * s; z = y * s + z * c; y = y2 }
  if (tilt.y) { const c = Math.cos(rad(tilt.y)); const s = Math.sin(rad(tilt.y)); const x2 = x * c + z * s; z = -x * s + z * c; x = x2 }
  if (tilt.z) { const c = Math.cos(rad(tilt.z)); const s = Math.sin(rad(tilt.z)); const x2 = x * c - y * s; y = x * s + y * c; x = x2 }
  return { x, y, z }
}
/** A point of a circle in a plane at a clock angle (before the tilt and the centre are applied). 0 deg = 12 o'clock. */
function onPlane (plane, deg, r) {
  const a = rad(deg); const s = Math.sin(a) * r; const c = Math.cos(a) * r
  if (plane === 'xy') return { x: s, y: c, z: 0 }       // front clock face: 12 up, 3 right
  if (plane === 'xz') return { x: s, y: 0, z: -c }      // from above: 12 away from the viewer (-z), 3 right
  return { x: 0, y: c, z: s }                           // side clock face: 12 up, 3 toward +z
}
function place (o, plane, deg, scale) {
  const p = rotate(onPlane(plane, deg, o.radius * scale), o.tilt)
  return { x: r3(o.center.x + p.x), y: r3(o.center.y + p.y), z: r3(o.center.z + p.z) }
}
/** Angle of an arc after progress `w` (0..1) of one pass, honouring the direction. */
function angleAt (arc, w) { return mod360(arc.from + sweepOf(arc) * w) }
/** Where an arc ends (its last repeat; a bounced odd last repeat ends back at `from`). */
function endPoint (o, arc) {
  const backwards = arc.bounce && arc.repeat % 2 === 0   // repeat count even -> the last repeat (index odd) runs backwards -> ends at from
  return place(o, arc.plane, angleAt(arc, backwards ? 0 : 1), arc.radiusScale)
}

/**
 * Where the rider is `t` seconds after the orbit starts.
 * Returns { x, y, z, angle (degrees on the clock face), clock (hour on the face), arcIndex, arcId, repeat, iteration, gliding, done, t }.
 * An orbit with no arcs sits at the centre. When a finite orbit has finished, `done` is true and the pose stays at the end.
 */
export function poseAt (orbit, t) {
  const o = sanitizeOrbit(orbit)
  const dur = orbitDuration(o)
  if (o.arcs.length === 0 || dur <= 0) return { x: o.center.x, y: o.center.y, z: o.center.z, angle: 0, clock: 12, arcIndex: -1, arcId: '', repeat: 0, iteration: 0, gliding: false, done: true, t: 0 }
  let time = Math.max(0, toNum(t, 0)); let iteration = 0; let done = false
  if (o.iterations > 0 && time >= dur * o.iterations) { done = true; iteration = o.iterations - 1; time = dur } else { iteration = Math.floor(time / dur); time -= iteration * dur }
  let idx = 0; let start = 0
  for (; idx < o.arcs.length; idx++) { const ad = arcDuration(o.arcs[idx]); if (time < start + ad || idx === o.arcs.length - 1) break; start += ad }
  const arc = o.arcs[idx]
  let local = time - start
  const prev = idx > 0 ? o.arcs[idx - 1] : (iteration > 0 || done ? o.arcs[o.arcs.length - 1] : null)
  if (local < arc.lead && prev && !done) {
    const a = endPoint(o, prev); const b = place(o, arc.plane, angleAt(arc, 0), arc.radiusScale)
    const k = ease('easeInOut', arc.lead > 0 ? local / arc.lead : 1)
    return { x: r3(a.x + (b.x - a.x) * k), y: r3(a.y + (b.y - a.y) * k), z: r3(a.z + (b.z - a.z) * k), angle: arc.from, clock: degToClock(arc.from), arcIndex: idx, arcId: arc.id, repeat: 0, iteration, gliding: true, done: false, t: r3(toNum(t, 0)) }
  }
  local = Math.max(0, local - arc.lead)
  let rep = Math.min(Math.floor(local / arc.seconds), arc.repeat - 1)
  let w = (local - rep * arc.seconds) / arc.seconds
  if (local >= arc.seconds * arc.repeat) { rep = arc.repeat - 1; w = 1 }
  w = clamp(w, 0, 1)
  if (arc.bounce && rep % 2 === 1) w = 1 - w
  const angle = angleAt(arc, ease(arc.ease, w))
  const p = place(o, arc.plane, angle, arc.radiusScale)
  return { x: p.x, y: p.y, z: p.z, angle: r3(angle), clock: degToClock(angle), arcIndex: idx, arcId: arc.id, repeat: rep, iteration, gliding: false, done, t: r3(toNum(t, 0)) }
}

// ── presets ──
export const ORBIT_PRESETS = Object.freeze([
  { id: 'circle', label: 'Circle (floor)', build: () => ({ name: 'Circle', arcs: [{ id: 'a1', plane: 'xz', from: 0, to: 0, dir: 'cw', seconds: 20 }] }) },
  { id: 'twelve-six-three-nine', label: '12 to 6, then 3 to 9', build: () => ({ name: '12-6, 3-9', arcs: [
    { id: 'a1', plane: 'xy', from: 0, to: 180, dir: 'cw', seconds: 8, ease: 'easeInOut' },
    { id: 'a2', plane: 'xy', from: 90, to: 270, dir: 'cw', seconds: 8, ease: 'easeInOut', lead: 2 }] }) },
  { id: 'three-rings', label: 'Three rings (x, y, z)', build: () => ({ name: 'Three rings', arcs: [
    { id: 'a1', plane: 'xz', from: 0, to: 0, dir: 'cw', seconds: 10 },
    { id: 'a2', plane: 'xy', from: 0, to: 0, dir: 'cw', seconds: 10, lead: 2 },
    { id: 'a3', plane: 'yz', from: 0, to: 0, dir: 'cw', seconds: 10, lead: 2 }] }) },
])
export function fromPreset (id) { const p = ORBIT_PRESETS.find(x => x.id === id); return sanitizeOrbit(p ? { ...defaultOrbit(), ...p.build() } : defaultOrbit()) }

// ── edit ops (immutable, never throw) ──
const findArc = (o, id) => o.arcs.findIndex(a => a.id === id)
/** spec = any arc fields (+ optional id). Use addedArcId(before, after) to learn the id, or pass your own. */
export function addArc (orbit, spec = {}) {
  const o = sanitizeOrbit(orbit); if (o.arcs.length >= L.arcsMax || !isObj(spec)) return o
  const last = o.arcs[o.arcs.length - 1]
  return sanitizeOrbit({ ...o, arcs: [...o.arcs, { ...(last || defaultArc()), id: get(spec, 'id') ?? newId('a'), ...spec }] })
}
export function addedArcId (before, after) {
  const b = new Set(sanitizeOrbit(before).arcs.map(a => a.id))
  const a = sanitizeOrbit(after).arcs.find(x => !b.has(x.id))
  return a ? a.id : null
}
export function updateArc (orbit, id, patch) {
  const o = sanitizeOrbit(orbit); const i = findArc(o, id); if (i < 0 || !isObj(patch)) return o
  return sanitizeOrbit({ ...o, arcs: o.arcs.map((a, j) => (j === i ? { ...a, ...patch, id: a.id } : a)) })
}
export function removeArc (orbit, id) { const o = sanitizeOrbit(orbit); const i = findArc(o, id); return i < 0 ? o : sanitizeOrbit({ ...o, arcs: o.arcs.filter((_, j) => j !== i) }) }
export function moveArc (orbit, id, toIndex) {
  const o = sanitizeOrbit(orbit); const i = findArc(o, id); if (i < 0) return o
  const j = clamp(Math.round(toNum(toIndex, i)), 0, o.arcs.length - 1); if (j === i) return o
  const arcs = o.arcs.slice(); const [a] = arcs.splice(i, 1); arcs.splice(j, 0, a)
  return sanitizeOrbit({ ...o, arcs })
}
export function duplicateArc (orbit, id) {
  const o = sanitizeOrbit(orbit); const i = findArc(o, id); if (i < 0 || o.arcs.length >= L.arcsMax) return o
  const arcs = o.arcs.slice(); arcs.splice(i + 1, 0, { ...o.arcs[i], id: newId('a') })
  return sanitizeOrbit({ ...o, arcs })
}
const setField = (key) => (orbit, value) => { const o = sanitizeOrbit(orbit); return sanitizeOrbit({ ...o, [key]: value }) }
export const setIterations = setField('iterations')
export const setRadius = setField('radius')
export const setMode = setField('mode')
export const setTarget = setField('target')
export const setCenter = setField('center')
export const setTilt = setField('tilt')
export const setFreeLook = setField('freeLook')
export const setLockMove = setField('lockMove')
export const setName = setField('name')
