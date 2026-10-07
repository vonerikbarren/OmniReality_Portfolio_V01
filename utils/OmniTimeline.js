/**
 * utils/OmniTimeline.js — the OmniTime project timeline (V172). No DOM, event-driven, persisted.
 *
 * ONE project timeline measured in PRIMARY TIME SECONDS (utils/PrimaryTime.js). The playhead IS Primary Time:
 * seek() calls PrimaryTime.setCurrentSeconds(), so the floor clock (modules/ChronosFloorClock.js) and the
 * travelling reality node (modules/ChronosRealityNode.js), which both read PrimaryTime every frame, follow.
 *
 * Data (all in this one store, persisted in localStorage 'omni:timeline-v1', NOT in the node JSON, so it works
 * for nodes of either registry — OmniNode._nodes and NodeLoader._registry):
 *   tracks   { id, name, kind:'node'|'marker', muted, locked, solo, open }
 *   clips    { id, trackId, nodeId, start, duration, inPoint, loop, label, color }
 *   keys     { id, clipId, property, t, value, ease }   t = SOURCE time of the clip (same axis as inPoint);
 *                                                        the clip shows source [inPoint, inPoint+duration]
 *   markers  { id, t, name, color }
 *   workArea { in, out }   (null = unset)
 *
 * Loop: a looping clip repeats its keyframe cycle. The cycle is [inPoint, lastKeyTime] (or the clip duration when
 * it has no later key); the node is "inside" the clip for the whole clip duration.
 *
 * Events (window): omni:timeline-changed {kind} · omni:timeline-playhead {t}
 * Events consumed elsewhere: omni:timeline-play-set / -step / -seek / -add-selected / -marker-add (systems/OmniTimelinePlayer.js).
 */

import * as PrimaryTime from './PrimaryTime.js'

export const FPS = 30
export const MIN_DUR = 1 / FPS
export const STORE_KEY = 'omni:timeline-v1'
export const VERSION = 1
export const LIMITS = Object.freeze({ tracks: 64, clips: 2000, keys: 20000, markers: 1000, bytes: 2_000_000 })
export const ZOOM_MIN = 0.01          // px per second (about 1.5 days across 1000px)
export const ZOOM_MAX = 2400          // px per second (a frame is 80px)
export const SPEEDS = Object.freeze([0.25, 0.5, 1, 2, 4, 8])
export const COLORS = Object.freeze(['#7b5cd6', '#2e9d8f', '#d1862f', '#4a86d8', '#c2527f', '#6ba644'])
export const EASES = Object.freeze(['linear', 'easeIn', 'easeOut', 'easeInOut', 'hold'])

/** Keyframe-able properties. Every one is applied straight to the node's THREE mesh (mesh.position / .scale /
 *  .rotation / .material), which BOTH registries create and tag with userData.nodeId — so all of them work
 *  for OmniNode nodes and NodeLoader (Create-System) nodes alike. */
export const KEY_PROPS = Object.freeze([
  { id: 'position.x', label: 'Position X', kind: 'num', step: 0.1 },
  { id: 'position.y', label: 'Position Y', kind: 'num', step: 0.1 },
  { id: 'position.z', label: 'Position Z', kind: 'num', step: 0.1 },
  { id: 'scale',      label: 'Scale',      kind: 'num', step: 0.05, min: 0 },
  { id: 'rotation.y', label: 'Rotation Y (deg)', kind: 'num', step: 1 },
  { id: 'opacity',    label: 'Opacity',    kind: 'num', step: 0.05, min: 0, max: 1 },
  { id: 'color',      label: 'Colour',     kind: 'color' },
])
export const KEY_PROP_IDS = KEY_PROPS.map(p => p.id)
export const getKeyProp = (id) => KEY_PROPS.find(p => p.id === id) ?? null

const DEFAULTS = {
  version: VERSION,
  tracks: [], clips: [], keys: [], markers: [],
  workArea: { in: null, out: null },
  view: { pps: 40, scroll: 0 },
  snap: true, loop: false, enabled: true,
}

let S = clone(DEFAULTS)
let rev = 0
let seq = 0
let saveTimer = null
let loaded = false
let scrubDepth = 0
let wasPlaying = false

function clone (o) { return JSON.parse(JSON.stringify(o)) }
const num = (v, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d)
const str = (v, d = '') => (typeof v === 'string' ? v.slice(0, 120) : d)
const isHex = (v) => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v)
const ev = (name, detail) => { try { window.dispatchEvent(new CustomEvent(name, { detail })) } catch (_) {} }

function newId (prefix, existing) {
  let id
  do { id = `${prefix}_${Date.now().toString(36)}${(seq++).toString(36)}${Math.floor(Math.random() * 1296).toString(36)}` } while (existing?.some(x => x.id === id))
  return id
}

// ── Persistence ───────────────────────────────────────────────────────────────

export function sanitize (raw) {
  const out = clone(DEFAULTS)
  if (!raw || typeof raw !== 'object') return out
  const o = { ...DEFAULTS, ...raw }
  out.snap = o.snap !== false
  out.loop = o.loop === true
  out.enabled = o.enabled !== false
  out.view = { pps: Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, num(o.view?.pps, 40))), scroll: Math.max(0, num(o.view?.scroll, 0)) }
  const wa = o.workArea ?? {}
  out.workArea = { in: Number.isFinite(wa.in) ? Math.max(0, wa.in) : null, out: Number.isFinite(wa.out) ? Math.max(0, wa.out) : null }
  if (out.workArea.in != null && out.workArea.out != null && out.workArea.out <= out.workArea.in) out.workArea = { in: null, out: null }
  const tids = new Set()
  for (const t of (Array.isArray(o.tracks) ? o.tracks : []).slice(0, LIMITS.tracks)) {
    if (!t || typeof t.id !== 'string' || tids.has(t.id)) continue
    tids.add(t.id)
    out.tracks.push({ id: t.id, name: str(t.name, 'Track'), kind: t.kind === 'marker' ? 'marker' : 'node', muted: !!t.muted, locked: !!t.locked, solo: !!t.solo, open: !!t.open })
  }
  const cids = new Set()
  for (const c of (Array.isArray(o.clips) ? o.clips : []).slice(0, LIMITS.clips)) {
    if (!c || typeof c.id !== 'string' || cids.has(c.id) || !tids.has(c.trackId) || typeof c.nodeId !== 'string' || !c.nodeId) continue
    cids.add(c.id)
    out.clips.push({
      id: c.id, trackId: c.trackId, nodeId: c.nodeId.slice(0, 200),
      start: Math.max(0, num(c.start)), duration: Math.max(MIN_DUR, num(c.duration, 5)), inPoint: Math.max(0, num(c.inPoint)),
      loop: !!c.loop, label: str(c.label, c.nodeId), color: isHex(c.color) ? c.color : COLORS[0],
    })
  }
  const kids = new Set()
  for (const k of (Array.isArray(o.keys) ? o.keys : []).slice(0, LIMITS.keys)) {
    const p = getKeyProp(k?.property)
    if (!k || typeof k.id !== 'string' || kids.has(k.id) || !cids.has(k.clipId) || !p) continue
    if (p.kind === 'color' ? !isHex(k.value) : !Number.isFinite(k.value)) continue
    kids.add(k.id)
    out.keys.push({ id: k.id, clipId: k.clipId, property: p.id, t: Math.max(0, num(k.t)), value: k.value, ease: EASES.includes(k.ease) ? k.ease : 'linear' })
  }
  const mids = new Set()
  for (const m of (Array.isArray(o.markers) ? o.markers : []).slice(0, LIMITS.markers)) {
    if (!m || typeof m.id !== 'string' || mids.has(m.id)) continue
    mids.add(m.id)
    out.markers.push({ id: m.id, t: Math.max(0, num(m.t)), name: str(m.name, 'Marker'), color: isHex(m.color) ? m.color : '#e0a030' })
  }
  return out
}

/** (Re)load from localStorage. Called lazily; tests call it after seeding storage. */
export function load () {
  let raw = null
  try { const s = localStorage.getItem(STORE_KEY); raw = s ? JSON.parse(s) : null } catch (_) { raw = null }
  if (raw && raw.version != null && raw.version > VERSION) raw = null   // written by a newer build: ignore, never corrupt
  S = sanitize(raw)
  loaded = true
  rev++
  return S
}
function ensure () { if (!loaded) load() }

export function flush () {
  clearTimeout(saveTimer); saveTimer = null
  try {
    const json = JSON.stringify(S)
    if (json.length > LIMITS.bytes) { console.warn('⟐Timeline — too large to persist, not saved'); return false }
    localStorage.setItem(STORE_KEY, json)
    return true
  } catch (_) { return false }
}
function scheduleSave () { clearTimeout(saveTimer); saveTimer = setTimeout(flush, 300) }

function changed (kind) {
  rev++
  scheduleSave()
  ev('omni:timeline-changed', { kind })
}

/** Tests: wipe memory (and optionally storage) back to defaults. */
export function _reset (clearStorage = true) {
  clearTimeout(saveTimer); saveTimer = null
  S = clone(DEFAULTS); loaded = true; rev++; scrubDepth = 0; wasPlaying = false
  if (clearStorage) { try { localStorage.removeItem(STORE_KEY) } catch (_) {} }
}

// ── Reads ─────────────────────────────────────────────────────────────────────

export const getState = () => { ensure(); return S }
export const getRevision = () => rev
export const getTracks = () => { ensure(); return S.tracks }
export const getClips = () => { ensure(); return S.clips }
export const getKeys = () => { ensure(); return S.keys }
export const getMarkers = () => { ensure(); return S.markers }
export const getTrack = (id) => { ensure(); return S.tracks.find(t => t.id === id) ?? null }
export const getClip = (id) => { ensure(); return S.clips.find(c => c.id === id) ?? null }
export const getKey = (id) => { ensure(); return S.keys.find(k => k.id === id) ?? null }
export const getMarker = (id) => { ensure(); return S.markers.find(m => m.id === id) ?? null }
export const getClipsForNode = (nodeId) => { ensure(); return S.clips.filter(c => c.nodeId === nodeId).sort((a, b) => a.start - b.start) }
export const getKeysForClip = (clipId) => { ensure(); return S.keys.filter(k => k.clipId === clipId).sort((a, b) => a.t - b.t || (a.property < b.property ? -1 : 1)) }
export const clipEnd = (c) => c.start + c.duration

// ── Tracks ────────────────────────────────────────────────────────────────────

export function addTrack ({ name, kind = 'node' } = {}) {
  ensure()
  if (S.tracks.length >= LIMITS.tracks) return null
  const n = S.tracks.filter(t => t.kind === 'node').length + 1
  const t = { id: newId('trk', S.tracks), name: str(name, kind === 'marker' ? 'Markers' : `Track ${n}`) || `Track ${n}`, kind: kind === 'marker' ? 'marker' : 'node', muted: false, locked: false, solo: false, open: false }
  S.tracks.push(t)
  changed('track')
  return t
}

export function updateTrack (id, patch = {}) {
  const t = getTrack(id)
  if (!t) return null
  if ('name' in patch) t.name = str(patch.name, t.name) || t.name
  for (const k of ['muted', 'locked', 'solo', 'open']) if (k in patch) t[k] = !!patch[k]
  changed('track')
  return t
}

export function removeTrack (id) {
  ensure()
  const i = S.tracks.findIndex(t => t.id === id)
  if (i < 0) return false
  const gone = new Set(S.clips.filter(c => c.trackId === id).map(c => c.id))
  S.tracks.splice(i, 1)
  S.clips = S.clips.filter(c => !gone.has(c.id))
  S.keys = S.keys.filter(k => !gone.has(k.clipId))
  changed('track')
  return true
}

/** First unlocked node track, creating "Track 1" when there is none. */
export function firstUnlockedTrack () {
  ensure()
  return S.tracks.find(t => t.kind === 'node' && !t.locked) ?? addTrack({ name: S.tracks.some(t => t.kind === 'node') ? undefined : 'Track 1' })
}

// ── Clips ─────────────────────────────────────────────────────────────────────

const hashColor = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return COLORS[h % COLORS.length] }

export function addClip ({ nodeId, start, duration = 5, trackId, label, loop = false, color, inPoint = 0 } = {}) {
  ensure()
  if (!nodeId || S.clips.length >= LIMITS.clips) return null
  let track = trackId ? getTrack(trackId) : null
  if (!track || track.kind !== 'node') track = firstUnlockedTrack()
  if (!track) return null
  const c = {
    id: newId('clp', S.clips), trackId: track.id, nodeId: String(nodeId),
    start: Math.max(0, num(start, getT())), duration: Math.max(MIN_DUR, num(duration, 5)), inPoint: Math.max(0, num(inPoint)),
    loop: !!loop, label: str(label, String(nodeId)) || String(nodeId), color: isHex(color) ? color : hashColor(String(nodeId)),
  }
  S.clips.push(c)
  changed('clip')
  return c
}

export function updateClip (id, patch = {}) {
  const c = getClip(id)
  if (!c) return null
  if ('start' in patch && Number.isFinite(patch.start)) c.start = Math.max(0, patch.start)
  if ('duration' in patch && Number.isFinite(patch.duration)) c.duration = Math.max(MIN_DUR, patch.duration)
  if ('inPoint' in patch && Number.isFinite(patch.inPoint)) c.inPoint = Math.max(0, patch.inPoint)
  if ('trackId' in patch) { const t = getTrack(patch.trackId); if (t && t.kind === 'node') c.trackId = t.id }
  if ('loop' in patch) c.loop = !!patch.loop
  if ('label' in patch) c.label = str(patch.label, c.label) || c.label
  if ('color' in patch && isHex(patch.color)) c.color = patch.color
  changed('clip')
  return c
}

export function removeClip (id) {
  ensure()
  const i = S.clips.findIndex(c => c.id === id)
  if (i < 0) return false
  S.clips.splice(i, 1)
  S.keys = S.keys.filter(k => k.clipId !== id)
  changed('clip')
  return true
}

export function removeClipsForNode (nodeId) {
  ensure()
  const gone = new Set(S.clips.filter(c => c.nodeId === nodeId).map(c => c.id))
  if (!gone.size) return 0
  S.clips = S.clips.filter(c => !gone.has(c.id))
  S.keys = S.keys.filter(k => !gone.has(k.clipId))
  changed('clip')
  return gone.size
}

export function clearAll () {
  ensure()
  S.clips = []; S.keys = []; S.markers = []
  changed('clear')
}

/** Razor: cut a clip in two at timeline time t. Each key's value is carried over so the animation is continuous. */
export function splitClip (id, t) {
  const c = getClip(id)
  if (!c || !(t > c.start + 1e-6 && t < clipEnd(c) - 1e-6) || S.clips.length >= LIMITS.clips) return null
  const srcT = c.inPoint + (t - c.start)
  const b = { ...c, id: newId('clp', S.clips), start: t, duration: clipEnd(c) - t, inPoint: srcT }
  const keys = getKeysForClip(id)
  const props = [...new Set(keys.map(k => k.property))]
  const bKeys = []
  for (const p of props) {
    const ks = keys.filter(k => k.property === p)
    const v = evalKeyList(ks, srcT, p)
    for (const k of ks) if (k.t > srcT + 1e-9) bKeys.push({ ...k, id: newId('key', S.keys), clipId: b.id })
    bKeys.push({ id: newId('key', S.keys), clipId: b.id, property: p, t: srcT, value: v, ease: 'linear' })
    S.keys = S.keys.filter(k => !(k.clipId === id && k.property === p && k.t > srcT - 1e-9))
    S.keys.push({ id: newId('key', S.keys), clipId: id, property: p, t: srcT, value: v, ease: 'linear' })
  }
  c.duration = t - c.start
  S.clips.push(b)
  for (const k of bKeys) S.keys.push(k)
  changed('clip')
  return b
}

export function duplicateClip (id) {
  const c = getClip(id)
  if (!c || S.clips.length >= LIMITS.clips) return null
  const d = { ...c, id: newId('clp', S.clips), start: clipEnd(c) }
  S.clips.push(d)
  for (const k of getKeysForClip(id)) S.keys.push({ ...k, id: newId('key', S.keys), clipId: d.id })
  changed('clip')
  return d
}

// ── Keyframes ─────────────────────────────────────────────────────────────────

/** Source time of timeline time `t` inside clip c (looping clips wrap inside the key cycle). */
export function sourceTime (c, t, cycle) {
  const local = Math.max(0, t - c.start)
  if (c.loop && cycle > 1e-6) return c.inPoint + (local % cycle)
  return c.inPoint + local
}

export function cycleLength (c) {
  let last = c.inPoint
  for (const k of S.keys) if (k.clipId === c.id && k.t > last) last = k.t
  const span = last - c.inPoint
  return span > 1e-6 ? span : c.duration
}

export function addKey ({ clipId, property, t, value, ease = 'linear' } = {}) {
  const c = getClip(clipId)
  const p = getKeyProp(property)
  if (!c || !p || S.keys.length >= LIMITS.keys) return null
  if (p.kind === 'color' ? !isHex(value) : !Number.isFinite(value)) return null
  const tt = Math.max(0, num(t, c.inPoint))
  const existing = S.keys.find(k => k.clipId === clipId && k.property === property && Math.abs(k.t - tt) < 1e-4)
  if (existing) { existing.value = value; if (EASES.includes(ease)) existing.ease = ease; changed('key'); return existing }
  const k = { id: newId('key', S.keys), clipId, property, t: tt, value, ease: EASES.includes(ease) ? ease : 'linear' }
  S.keys.push(k)
  changed('key')
  return k
}

/** Add at a TIMELINE time (e.g. the playhead): converts to the clip's source time; null if outside the clip. */
export function addKeyAtTime (clipId, property, timelineTime, value, ease) {
  const c = getClip(clipId)
  if (!c || timelineTime < c.start - 1e-6 || timelineTime > clipEnd(c) + 1e-6) return null
  return addKey({ clipId, property, t: c.inPoint + (timelineTime - c.start), value, ease })
}

export function updateKey (id, patch = {}) {
  const k = getKey(id)
  if (!k) return null
  if ('t' in patch && Number.isFinite(patch.t)) k.t = Math.max(0, patch.t)
  if ('value' in patch) {
    const p = getKeyProp(k.property)
    if (p?.kind === 'color' ? isHex(patch.value) : Number.isFinite(patch.value)) k.value = patch.value
  }
  if ('ease' in patch && EASES.includes(patch.ease)) k.ease = patch.ease
  changed('key')
  return k
}

export function removeKey (id) {
  ensure()
  const i = S.keys.findIndex(k => k.id === id)
  if (i < 0) return false
  S.keys.splice(i, 1)
  changed('key')
  return true
}

// ── Markers / work area / settings ────────────────────────────────────────────

export function addMarker ({ t, name, color } = {}) {
  ensure()
  if (S.markers.length >= LIMITS.markers) return null
  const tt = Math.max(0, num(t, getT()))
  const m = { id: newId('mrk', S.markers), t: tt, name: str(name, `Marker ${S.markers.length + 1}`) || `Marker ${S.markers.length + 1}`, color: isHex(color) ? color : '#e0a030' }
  S.markers.push(m)
  changed('marker')
  return m
}
export function updateMarker (id, patch = {}) {
  const m = getMarker(id)
  if (!m) return null
  if ('t' in patch && Number.isFinite(patch.t)) m.t = Math.max(0, patch.t)
  if ('name' in patch) m.name = str(patch.name, m.name) || m.name
  if ('color' in patch && isHex(patch.color)) m.color = patch.color
  changed('marker')
  return m
}
export function removeMarker (id) {
  ensure()
  const i = S.markers.findIndex(m => m.id === id)
  if (i < 0) return false
  S.markers.splice(i, 1)
  changed('marker')
  return true
}

export function setWorkArea (inT, outT) {
  ensure()
  const a = inT == null ? null : Math.max(0, inT)
  const b = outT == null ? null : Math.max(0, outT)
  if (a != null && b != null && b <= a) return false
  S.workArea = { in: a, out: b }
  changed('workarea')
  return true
}
export function setSnap (on) { ensure(); S.snap = !!on; changed('snap') }
export function setLoop (on) { ensure(); S.loop = !!on; changed('loop') }
export function setEnabled (on) { ensure(); S.enabled = !!on; changed('enabled') }
export function setView ({ pps, scroll } = {}) {
  ensure()
  if (Number.isFinite(pps)) S.view.pps = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, pps))
  if (Number.isFinite(scroll)) S.view.scroll = Math.max(0, scroll)
  rev++; scheduleSave()   // view state: persisted, but not a 'changed' event (nothing needs re-evaluating)
}

// ── Snapping ──────────────────────────────────────────────────────────────────

/** Candidate snap times: playhead, 0, markers, work-area edges, every clip edge not in `exclude`. */
export function snapPoints (exclude) {
  ensure()
  const pts = [0, getT()]
  for (const m of S.markers) pts.push(m.t)
  if (S.workArea.in != null) pts.push(S.workArea.in)
  if (S.workArea.out != null) pts.push(S.workArea.out)
  for (const c of S.clips) { if (exclude?.has(c.id)) continue; pts.push(c.start, c.start + c.duration) }
  return pts
}

/** Snap one time to the nearest candidate within `thr` seconds (returns t unchanged if none / snapping off). */
export function snapTime (t, thr, exclude, force = false) {
  ensure()
  if (!S.snap && !force) return t
  let best = t, bd = thr
  for (const p of snapPoints(exclude)) { const d = Math.abs(p - t); if (d <= bd) { bd = d; best = p } }
  return best
}

/** Snap a moving clip: tries its start edge and its end edge, uses whichever lands closer. Returns the new start. */
export function snapMove (start, duration, thr, exclude, force = false) {
  ensure()
  if (!S.snap && !force) return Math.max(0, start)
  let best = start, bd = thr
  for (const p of snapPoints(exclude)) {
    const d1 = Math.abs(p - start); if (d1 <= bd) { bd = d1; best = p }
    const d2 = Math.abs(p - (start + duration)); if (d2 <= bd) { bd = d2; best = p - duration }
  }
  return Math.max(0, best)
}

// ── Interpolation ─────────────────────────────────────────────────────────────

export function easeU (name, u) {
  switch (name) {
    case 'easeIn': return u * u
    case 'easeOut': return 1 - (1 - u) * (1 - u)
    case 'easeInOut': return u < 0.5 ? 2 * u * u : 1 - 2 * (1 - u) * (1 - u)
    case 'hold': return 0
    default: return u
  }
}

export function hexToRgb (hex) { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255] }
export function rgbToHex (r, g, b) { return '#' + ((1 << 24) | (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b)).toString(16).slice(1) }

/** Value of a sorted key list (same property) at source time t. Before the first key: first value; after the last: last
 *  value (hold). Each key's own ease shapes the segment that starts at it. Colours blend per channel in sRGB. */
export function evalKeyList (keys, t, property) {
  const n = keys.length
  if (!n) return null
  if (t <= keys[0].t) return keys[0].value
  if (t >= keys[n - 1].t) return keys[n - 1].value
  let i = 0
  while (i < n - 2 && t >= keys[i + 1].t) i++
  const a = keys[i], b = keys[i + 1]
  const span = b.t - a.t
  const u = span > 1e-9 ? easeU(a.ease, (t - a.t) / span) : 1
  if (getKeyProp(property)?.kind === 'color') {
    const A = hexToRgb(a.value), B = hexToRgb(b.value)
    return rgbToHex(A[0] + (B[0] - A[0]) * u, A[1] + (B[1] - A[1]) * u, A[2] + (B[2] - A[2]) * u)
  }
  return a.value + (b.value - a.value) * u
}

// ── Timecode ──────────────────────────────────────────────────────────────────

/** HH:MM:SS:FF at 30 fps (hours widen past 99). */
export function toTimecode (t) {
  const total = Math.max(0, Math.round(num(t) * FPS))
  const ff = total % FPS
  const s = Math.floor(total / FPS)
  const p = (n) => String(n).padStart(2, '0')
  return `${p(Math.floor(s / 3600))}:${p(Math.floor(s / 60) % 60)}:${p(s % 60)}:${p(ff)}`
}

/** Parse "SS", "MM:SS", "HH:MM:SS" or "HH:MM:SS:FF" (or a plain number of seconds); null when not parseable. */
export function parseTimecode (text) {
  const s = String(text ?? '').trim()
  if (!s) return null
  if (/^\d+(\.\d+)?$/.test(s)) return parseFloat(s)
  const parts = s.split(':').map(x => (/^\d+$/.test(x) ? parseInt(x, 10) : NaN))
  if (parts.some(Number.isNaN) || parts.length > 4) return null
  let ff = 0
  if (parts.length === 4) ff = parts.pop()
  let sec = 0
  for (const p of parts) sec = sec * 60 + p
  return sec + ff / FPS
}

// ── Transport (the playhead IS Primary Time) ──────────────────────────────────

export const getT = () => PrimaryTime.getCurrentSeconds()
export const isPlaying = () => PrimaryTime.isPlaying()
export const getSpeed = () => PrimaryTime.getSpeed()
export const isScrubbing = () => scrubDepth > 0

export function seek (t) {
  const v = Math.max(0, num(t))
  PrimaryTime.setCurrentSeconds(v)
  ev('omni:timeline-playhead', { t: PrimaryTime.getCurrentSeconds() })
  return PrimaryTime.getCurrentSeconds()
}

/** Step whole frames (negative = back). Pauses playback first (as Premiere does) and always lands on the frame grid. */
export function step (frames) {
  PrimaryTime.pause()
  const f = Math.round(num(frames))
  const cur = getT() * FPS
  const r = Math.round(cur)
  // on a frame boundary: step from it; between frames (playing was just paused): step to the next / previous boundary
  const base = Math.abs(cur - r) < 1e-6 ? r : (f >= 0 ? Math.floor(cur) : Math.ceil(cur))
  return seek((base + f) / FPS)
}

export function setPlaying (on) { if (on) PrimaryTime.play(); else PrimaryTime.pause() }
export function togglePlay () { setPlaying(!PrimaryTime.isPlaying()); return PrimaryTime.isPlaying() }
export function setSpeed (x) { PrimaryTime.setSpeed(x) }

/** Scrubbing pauses Primary Time; the LAST endScrub resumes it only if it was playing when the first scrub began. */
export function beginScrub () {
  if (scrubDepth++ === 0) { wasPlaying = PrimaryTime.isPlaying(); PrimaryTime.pause() }
}
export function endScrub () {
  if (scrubDepth === 0) return
  if (--scrubDepth === 0 && wasPlaying) PrimaryTime.play()
  if (scrubDepth === 0) wasPlaying = false
}
