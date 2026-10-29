/**
 * utils/OmniSceneJson.js (V236) — the `.omni.json` scene file: pure, no DOM, no Three.js.
 *
 *   {
 *     "schema": "omni-scene/1",
 *     "app": "OmniStarOS", "version": "V236", "name": "My reality", "exportedAt": "2026-10-28T12:00:00.000Z",
 *     "nodes": [ { ...the node record exactly as OmniNode saves it (id, label, geometry, position, nodeKind, data blocks...) } ],
 *     "edges": [ { "from": "id", "to": "id", "style": { ... } } ]
 *   }
 *
 * It holds STRUCTURE: every node record (so music, sound, song, doc, poly, store and other kinds travel in full) and the edges between them.
 * Not in it (yet): hand settings, painter strokes, scene orbs, IndexedDB media, and the side stores of path nodes and terminal shells.
 *
 * checkFile() never trusts the file: caps on size and counts, ids checked, prototype-polluting keys removed, numbers made finite,
 * dangling references cut with a warning, and — for a merge — ids that clash are renamed (every string that equalled the old id is rewritten).
 */
export const SCHEMA = 'omni-scene/1'
export const EXT = '.omni.json'
export const LIMITS = { bytes: 8 * 1024 * 1024, nodes: 2000, edges: 6000, depth: 14, string: 1000000, label: 300, id: 80 }
const BAD_KEYS = new Set(['__proto__', 'constructor', 'prototype'])
const ID_RE = /^[A-Za-z0-9_.:\-]{1,80}$/
const TRANSIENT = ['rootId', 'depth']
const REF_KEYS = ['parentId', 'groupId', 'spaceId', 'preGroupSpaceId']

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const fin = (n, d = 0) => (typeof n === 'number' && Number.isFinite(n) ? n : d)

/** Deep copy of plain JSON with caps; drops bad keys, functions, non-finite numbers. Reports what it cut. */
export function cleanValue (v, depth = 0, cut = { n: 0 }) {
  if (v === null || typeof v === 'boolean') return v
  if (typeof v === 'number') { if (Number.isFinite(v)) return v; cut.n++; return 0 }
  if (typeof v === 'string') { if (v.length > LIMITS.string) { cut.n++; return v.slice(0, LIMITS.string) } return v }
  if (depth >= LIMITS.depth) { cut.n++; return null }
  if (Array.isArray(v)) return v.slice(0, 100000).map(x => cleanValue(x, depth + 1, cut))
  if (isObj(v)) {
    const o = {}
    for (const k of Object.keys(v)) { if (BAD_KEYS.has(k)) { cut.n++; continue } const x = v[k]; if (typeof x === 'function' || x === undefined) continue; o[k] = cleanValue(x, depth + 1, cut) }
    return o
  }
  cut.n++; return null
}

const vec3 = (a, d, lo = -1e7, hi = 1e7) => (Array.isArray(a) && a.length >= 3 ? [0, 1, 2].map(i => Math.max(lo, Math.min(hi, fin(a[i], d[i])))) : d.slice())

export function kindOf (n) {
  if (!n) return 'node'
  if (n.nodeKind) return String(n.nodeKind)
  if (n.isGroupNode) return 'group'
  if (n.isSequenceNode) return 'sequence'
  if (n.isEssenceNode) return 'essence'
  if (n.isDomain) return 'domain'
  return 'node'
}

export function countKinds (nodes) {
  const c = {}
  for (const n of nodes || []) { const k = kindOf(n); c[k] = (c[k] || 0) + 1 }
  return c
}

const edgeStyle = (s) => {
  if (!isObj(s)) return null
  const o = {}
  for (const k of ['kind', 'color', 'highlightColor']) if (typeof s[k] === 'string') o[k] = s[k].slice(0, 40)
  for (const k of ['dashed', 'highlight']) if (typeof s[k] === 'boolean') o[k] = s[k]
  if (typeof s.thickness === 'number' && Number.isFinite(s.thickness)) o.thickness = Math.max(0.05, Math.min(20, s.thickness))
  return Object.keys(o).length ? o : null
}

/** Builds the file object from exportScene() output. */
export function buildFile ({ nodes = [], edges = [] } = {}, { name = '', version = '', now = new Date() } = {}) {
  const cut = { n: 0 }
  const ns = nodes.map(n => { const c = cleanValue(n, 0, cut); for (const k of TRANSIENT) delete c[k]; return c })
  const es = edges.map(e => { const o = { from: String(e.from), to: String(e.to) }; const st = edgeStyle(e.style); if (st) o.style = st; return o })
  return { schema: SCHEMA, app: 'OmniStarOS', version: String(version || ''), name: String(name || '').slice(0, LIMITS.label), exportedAt: now.toISOString(), counts: { nodes: ns.length, edges: es.length, kinds: countKinds(ns) }, nodes: ns, edges: es }
}

export const stringify = (file) => JSON.stringify(file, null, 1)

/** Text -> { ok, file } | { ok:false, error }. */
export function parse (text) {
  if (typeof text !== 'string' || !text.trim()) return { ok: false, error: 'The file is empty.' }
  if (text.length > LIMITS.bytes) return { ok: false, error: 'The file is bigger than ' + Math.round(LIMITS.bytes / 1048576) + ' MB.' }
  let o
  try { o = JSON.parse(text) } catch (e) { return { ok: false, error: 'Not valid JSON: ' + String(e.message).slice(0, 120) } }
  if (!isObj(o)) return { ok: false, error: 'The file must be a JSON object.' }
  return { ok: true, file: o }
}

/**
 * Validates and sanitises a parsed file.
 * opts: { mode: 'replace'|'merge', existingIds: Set|array (merge), genId: () => string (merge renames) }
 * -> { ok, errors[], warnings[], nodes[], edges[], remap: {old:new}, counts }
 */
export function checkFile (file, { mode = 'replace', existingIds = [], genId = null } = {}) {
  const errors = [], warnings = []
  const out = { ok: false, errors, warnings, nodes: [], edges: [], remap: {}, counts: { nodes: 0, edges: 0, kinds: {} } }
  if (!isObj(file)) { errors.push('The file must be a JSON object.'); return out }
  const m = /^omni-scene\/(\d+)(?:\.\d+)?$/.exec(String(file.schema || ''))
  if (!m) { errors.push('Not an Omni scene file (schema "' + String(file.schema || '').slice(0, 30) + '" — expected "' + SCHEMA + '").'); return out }
  if (Number(m[1]) !== 1) { errors.push('This file is from a newer format (' + file.schema + '); this build reads omni-scene/1.'); return out }
  if (!Array.isArray(file.nodes)) { errors.push('The file has no "nodes" list.'); return out }
  let rawNodes = file.nodes
  if (rawNodes.length > LIMITS.nodes) { warnings.push('Only the first ' + LIMITS.nodes + ' of ' + rawNodes.length + ' nodes are read.'); rawNodes = rawNodes.slice(0, LIMITS.nodes) }
  const existing = new Set(existingIds)
  const seen = new Set(), cut = { n: 0 }, remap = {}, kept = []
  rawNodes.forEach((raw, i) => {
    if (!isObj(raw)) { warnings.push('Node #' + (i + 1) + ' is not an object; skipped.'); return }
    if (typeof raw.id !== 'string' || !ID_RE.test(raw.id)) { warnings.push('Node #' + (i + 1) + ' has no usable id; skipped.'); return }
    if (seen.has(raw.id)) { warnings.push('Node id "' + raw.id + '" appears twice; the second is skipped.'); return }
    seen.add(raw.id)
    const n = cleanValue(raw, 0, cut)
    for (const k of TRANSIENT) delete n[k]
    n.position = vec3(n.position, [0, 0, 0])
    if (n.rotation !== undefined) n.rotation = vec3(n.rotation, [0, 0, 0], -1e4, 1e4)
    if (n.scale !== undefined && Array.isArray(n.scale)) n.scale = vec3(n.scale, [1, 1, 1], 1e-4, 1e5)
    n.label = typeof n.label === 'string' ? n.label.slice(0, LIMITS.label) : (n.label == null ? '' : String(n.label).slice(0, LIMITS.label))
    if (typeof n.geometry !== 'string' || !n.geometry || n.geometry.length > 64) n.geometry = 'SphereGeometry'
    if (typeof n.primitive !== 'string') n.primitive = 'objective'
    if (!n.nodeKind && !/^[A-Za-z]+Geometry$/.test(n.geometry)) { warnings.push('Node "' + n.id + '": unknown geometry "' + n.geometry.slice(0, 20) + '"; used a sphere.'); n.geometry = 'SphereGeometry' }
    kept.push(n)
  })
  if (cut.n) warnings.push(cut.n + ' value(s) were cut or cleaned (too deep, too long, or not valid).')
  // merge: rename ids that clash with the scene
  if (mode === 'merge') {
    const gen = typeof genId === 'function' ? genId : (() => 'omni_' + Math.random().toString(36).slice(2, 10))
    const taken = new Set([...existing, ...seen])
    kept.forEach(n => { if (existing.has(n.id)) { let nid; do { nid = gen() } while (taken.has(nid)); taken.add(nid); remap[n.id] = nid } })
    if (Object.keys(remap).length) {
      const rw = (v, d = 0) => { if (typeof v === 'string') return Object.prototype.hasOwnProperty.call(remap, v) ? remap[v] : v; if (d > LIMITS.depth) return v; if (Array.isArray(v)) return v.map(x => rw(x, d + 1)); if (isObj(v)) { const o = {}; for (const k of Object.keys(v)) o[k] = rw(v[k], d + 1); return o } return v }
      kept.forEach((n, i) => { kept[i] = rw(n) })
      warnings.push(Object.keys(remap).length + ' id(s) already existed and were renamed.')
    }
  }
  // references must point at nodes in the file (or, merging, at the scene)
  const ids = new Set(kept.map(n => n.id))
  const known = (id) => ids.has(id) || (mode === 'merge' && existing.has(id))
  kept.forEach(n => {
    for (const k of REF_KEYS) if (n[k] != null && !known(n[k])) { warnings.push('Node "' + n.id + '": ' + k + ' pointed at a missing node; cleared.'); n[k] = null }
    if (Array.isArray(n.groupMemberIds)) { const before = n.groupMemberIds.length; n.groupMemberIds = n.groupMemberIds.filter(x => ids.has(x)); if (n.groupMemberIds.length !== before) warnings.push('Group "' + n.id + '": ' + (before - n.groupMemberIds.length) + ' member(s) missing; dropped.') }
  })
  // edges
  const rawEdges = Array.isArray(file.edges) ? file.edges.slice(0, LIMITS.edges) : []
  const ek = new Set(), edges = []
  let badEdges = 0
  for (const e of rawEdges) {
    if (!isObj(e)) { badEdges++; continue }
    const from = Object.prototype.hasOwnProperty.call(remap, e.from) ? remap[e.from] : e.from
    const to = Object.prototype.hasOwnProperty.call(remap, e.to) ? remap[e.to] : e.to
    if (typeof from !== 'string' || typeof to !== 'string' || from === to || !ids.has(from) || !ids.has(to)) { badEdges++; continue }
    const key = from + '\u0000' + to
    if (ek.has(key)) { badEdges++; continue }
    ek.add(key)
    const o = { from, to }; const st = edgeStyle(e.style); if (st) o.style = st
    edges.push(o)
  }
  if (badEdges) warnings.push(badEdges + ' edge(s) skipped (missing node, self-link or duplicate).')
  out.nodes = kept; out.edges = edges; out.remap = remap
  out.counts = { nodes: kept.length, edges: edges.length, kinds: countKinds(kept) }
  out.ok = true
  return out
}

/** One readable line: "12 nodes (3 musicNode, 9 node), 14 edges". */
export function describe (counts) {
  const k = Object.entries(counts?.kinds || {}).sort((a, b) => b[1] - a[1]).map(([n, c]) => c + ' ' + n).join(', ')
  return (counts?.nodes ?? 0) + ' node' + ((counts?.nodes ?? 0) === 1 ? '' : 's') + (k ? ' (' + k + ')' : '') + ', ' + (counts?.edges ?? 0) + ' edge' + ((counts?.edges ?? 0) === 1 ? '' : 's')
}

export function fileName (name = '', now = new Date()) {
  const base = String(name || 'reality').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'reality'
  return base + '-' + now.toISOString().slice(0, 10) + EXT
}
