/**
 * utils/OmniStoredRealityModel.js (V277) — the data of a StoredRealityNode: a whole "course" (a set of nodes and the lines between them) kept inside ONE node.
 * Pure: no DOM, no three.js. While stored, the course costs one small mesh (a glass box with a point-cloud of its parts); expanding lays the nodes out in the scene again.
 *
 * data.storedReality = {
 *   name, summary, state:'stored'|'expanded', room:'x,y,z'|null (the voxel room it lives in), scale (how big the box is, in world units, fits a 20-unit room),
 *   payload:{ nodes:[records, positions RELATIVE to the box], edges:[{from,to,style?}] },   // only while stored
 *   members:[ids]                                                                          // only while expanded: which live nodes belong to it
 *   preview:{ count, edges, kinds:{kind:n}, labels:[first labels], points:[[x,y,z] 0..1 ...] }  // what the box shows from outside; kept after expanding
 * }
 * Positions are relative to an anchor (the box's own position). pack() and unpack() are exact inverses.
 */
import { cleanValue } from './OmniSceneJson.js'

export const LIMITS = Object.freeze({ nodes: 400, edges: 1200, points: 160, labels: 12, bytes: 1500000, scale: [1, 18], name: 60, summary: 400 })
const ID_RE = /^[A-Za-z0-9_.:\-]{1,80}$/
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const fin = (n, d = 0) => (typeof n === 'number' && Number.isFinite(n) ? n : d)
const clamp = (v, lo, hi, d) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d }
const clean = (s, max) => (typeof s === 'string' ? s.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) : '')
const ROOM = /^-?\d{1,3},-?\d{1,3},-?\d{1,3}$/

export function emptyPreview () { return { count: 0, edges: 0, kinds: {}, labels: [], points: [] } }
export function defaultStoredReality () { return { name: 'Course', summary: '', state: 'stored', room: null, scale: 6, payload: { nodes: [], edges: [] }, members: [], preview: emptyPreview() } }

function sanitizePayload (raw) {
  const r = isObj(raw) ? raw : {}
  const seen = new Set(), nodes = []
  for (const n of Array.isArray(r.nodes) ? r.nodes : []) {
    if (nodes.length >= LIMITS.nodes) break
    if (!isObj(n) || typeof n.id !== 'string' || !ID_RE.test(n.id) || seen.has(n.id)) continue
    const c = cleanValue(n); if (!isObj(c)) continue
    const p = Array.isArray(c.position) ? [0, 1, 2].map(i => fin(c.position[i])) : [0, 0, 0]
    c.position = p; seen.add(n.id); nodes.push(c)
  }
  const edges = []
  for (const e of Array.isArray(r.edges) ? r.edges : []) {
    if (edges.length >= LIMITS.edges) break
    if (!isObj(e) || !seen.has(e.from) || !seen.has(e.to) || e.from === e.to) continue
    edges.push(e.style && isObj(e.style) ? { from: e.from, to: e.to, style: cleanValue(e.style) } : { from: e.from, to: e.to })
  }
  return { nodes, edges }
}

function sanitizePreview (raw) {
  const r = isObj(raw) ? raw : {}
  const kinds = {}
  if (isObj(r.kinds)) for (const k of Object.keys(r.kinds).slice(0, 40)) { if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue; const n = Math.floor(fin(r.kinds[k])); if (n > 0 && n <= 1e6) kinds[clean(k, 40)] = n }
  const points = (Array.isArray(r.points) ? r.points : []).slice(0, LIMITS.points).filter(p => Array.isArray(p) && p.length >= 3).map(p => [0, 1, 2].map(i => clamp(p[i], 0, 1, 0.5)))
  return {
    count: Math.max(0, Math.min(1e6, Math.floor(fin(r.count)))), edges: Math.max(0, Math.min(1e6, Math.floor(fin(r.edges)))), kinds,
    labels: (Array.isArray(r.labels) ? r.labels : []).slice(0, LIMITS.labels).map(l => clean(l, 40)).filter(Boolean), points
  }
}

export function sanitizeStoredReality (raw) {
  const d = defaultStoredReality()
  const r = isObj(raw) ? raw : {}
  let state = r.state === 'expanded' ? 'expanded' : 'stored'
  const payload = state === 'stored' ? sanitizePayload(r.payload) : { nodes: [], edges: [] }
  const members = state === 'expanded' ? (Array.isArray(r.members) ? r.members : []).filter(x => typeof x === 'string' && ID_RE.test(x)).slice(0, LIMITS.nodes) : []
  const out = {
    name: clean(r.name, LIMITS.name) || d.name, summary: clean(r.summary, LIMITS.summary), state,
    room: typeof r.room === 'string' && ROOM.test(r.room) ? r.room : null,
    scale: clamp(r.scale, ...LIMITS.scale, d.scale), payload, members,
    preview: sanitizePreview(r.preview)
  }
  if (state === 'stored' && payload.nodes.length && !out.preview.count) out.preview = previewOf(payload.nodes, payload.edges)
  if (JSON.stringify(out.payload).length > LIMITS.bytes) { out.payload = { nodes: [], edges: [] }; out.preview = emptyPreview() }
  return out
}

/** what the box shows from outside: counts, kinds, first labels, and up to 160 points (the parts' positions scaled into 0..1) */
export function previewOf (nodes, edges) {
  const list = Array.isArray(nodes) ? nodes : []
  const kinds = {}; for (const n of list) { const k = n?.nodeKind || 'node'; kinds[k] = (kinds[k] || 0) + 1 }
  const pos = list.map(n => (Array.isArray(n?.position) ? [fin(n.position[0]), fin(n.position[1]), fin(n.position[2])] : [0, 0, 0]))
  const lo = [0, 1, 2].map(i => Math.min(...pos.map(p => p[i]), 0)), hi = [0, 1, 2].map(i => Math.max(...pos.map(p => p[i]), 0))
  const span = Math.max(1e-6, ...[0, 1, 2].map(i => hi[i] - lo[i]))   // one scale for all axes, so the shape is not squashed
  const step = Math.max(1, Math.ceil(pos.length / LIMITS.points))
  const points = pos.filter((_, i) => i % step === 0).slice(0, LIMITS.points).map(p => [0, 1, 2].map(i => (p[i] - lo[i]) / span))
  return { count: list.length, edges: Array.isArray(edges) ? edges.length : 0, kinds, labels: list.slice(0, LIMITS.labels).map(n => clean(n?.label || n?.id, 40)).filter(Boolean), points }
}

/**
 * Take nodes and edges out of a scene (as exportScene gives them) into a payload with positions relative to `anchor`.
 * `ids` picks the members; edges are kept only when both ends are members. The store node itself is never a member.
 */
export function pack (scene, ids, anchor = [0, 0, 0], selfId = null) {
  const set = new Set((Array.isArray(ids) ? ids : []).filter(i => typeof i === 'string' && i !== selfId))
  const a = [0, 1, 2].map(i => fin(anchor[i]))
  const nodes = [], seen = new Set()
  for (const n of Array.isArray(scene?.nodes) ? scene.nodes : []) {
    if (!n || !set.has(n.id) || seen.has(n.id)) continue
    const c = JSON.parse(JSON.stringify(n)); const p = Array.isArray(c.position) ? c.position : [0, 0, 0]
    c.position = [0, 1, 2].map(i => fin(p[i]) - a[i]); nodes.push(c); seen.add(n.id)
  }
  const edges = (Array.isArray(scene?.edges) ? scene.edges : []).filter(e => seen.has(e?.from) && seen.has(e?.to)).map(e => JSON.parse(JSON.stringify(e)))
  return sanitizePayload({ nodes, edges })
}

/** The inverse: records and edges ready for importScene, positions put back around `anchor`. */
export function unpack (payload, anchor = [0, 0, 0]) {
  const p = sanitizePayload(payload); const a = [0, 1, 2].map(i => fin(anchor[i]))
  return { nodes: p.nodes.map(n => ({ ...n, position: [0, 1, 2].map(i => n.position[i] + a[i]) })), edges: p.edges }
}

/** Does the payload fit in the box? (the largest distance from the anchor, in world units) */
export function extentOf (payload) {
  let m = 0; for (const n of payload?.nodes ?? []) for (let i = 0; i < 3; i++) m = Math.max(m, Math.abs(fin(n?.position?.[i])))
  return m
}
