/**
 * utils/OmniScanModel.js (V212) — the pure part of OmniScan: which node is "in the middle circle", and what to say about it.
 *
 * pickScanTarget(entries, camera-like, opts) : the node nearest to the viewer whose screen position is inside the centre circle.
 *   entries = [{ id, position:[x,y,z] }]; camera = { project(p) -> { x, y, z } in NDC (z in -1..1 = in front) } so the module needs no THREE.
 *   opts.radius = circle radius as a fraction of the SMALLER screen side (default 0.12), opts.aspect = width / height.
 * describeNode(data, extra) -> { regular, developer } : two plain objects. regular = what a person wants to know, developer = the full record.
 * toText(info) / toJSON(info, indent) : the two views.
 */
export const DEFAULT_RADIUS = 0.12
export const RADIUS_MIN = 0.03, RADIUS_MAX = 0.5

export function clampRadius (r) { const n = Number(r); return Number.isFinite(n) ? Math.min(RADIUS_MAX, Math.max(RADIUS_MIN, n)) : DEFAULT_RADIUS }

export function pickScanTarget (entries, camera, opts = {}) {
  if (!Array.isArray(entries) || !camera?.project) return null
  const radius = clampRadius(opts.radius ?? DEFAULT_RADIUS), aspect = Number(opts.aspect) > 0 ? Number(opts.aspect) : 1
  // NDC spans 2 units across the screen; the radius is a fraction of the smaller side
  const rx = aspect >= 1 ? (radius * 2) / aspect : radius * 2, ry = aspect >= 1 ? radius * 2 : (radius * 2) * aspect
  let best = null
  for (const e of entries) {
    if (!e || !Array.isArray(e.position)) continue
    const p = camera.project(e.position); if (!p || !(p.z >= -1 && p.z <= 1)) continue
    const nx = p.x / (rx / 2), ny = p.y / (ry / 2)
    if (nx * nx + ny * ny > 1) continue
    const d = Number.isFinite(p.dist) ? p.dist : p.z
    if (!best || d < best.d) best = { id: e.id, d }
  }
  return best ? best.id : null
}

const r2 = (n) => Math.round(Number(n) * 100) / 100
const vec = (v) => (Array.isArray(v) && v.length >= 3 && v.every(Number.isFinite)) ? v.slice(0, 3).map(r2) : null
const KIND_NAMES = { omniPath: 'Path node', floorPanel: 'Floor panel', terminalShell: 'Terminal shell', soundNode: 'Sound node', musicNode: 'Music node', songNode: 'Song node', mixNode: 'Mix node', docNode: 'Doc node', polyNode: 'Poly node', voxelNode: 'Voxel node', noteNode: 'Note node', dimensionalNode: 'Dimensional node' }
export const kindName = (d) => KIND_NAMES[d?.nodeKind] ?? (d?.nodeKind ? String(d.nodeKind) : 'Node')

/** extra = { position?, rotation?, scale?, links? , parent? } read from the live mesh / registry by the system. */
export function describeNode (data, extra = {}) {
  if (!data || typeof data !== 'object') return null
  const regular = { name: String(data.label ?? data.id ?? ''), kind: kindName(data), shape: data.geometry ?? null, id: data.id ?? null }
  const pos = vec(extra.position ?? data.position); if (pos) regular.position = pos
  if (data.color != null) regular.color = String(data.color)
  if (Number.isFinite(extra.links)) regular.links = extra.links
  if (extra.parent) regular.parent = String(extra.parent)
  if (data.nodeKind === 'voxelNode' && data.voxel?.room) regular.room = data.voxel.room
  if (data.nodeKind === 'docNode' && data.doc) regular.document = data.doc.title ?? data.doc.docId ?? null
  if (data.nodeKind === 'polyNode' && data.poly) regular.polyShape = data.poly.shape ?? null
  for (const k of Object.keys(regular)) if (regular[k] == null) delete regular[k]
  const developer = { ...regular, data: safeClone(data) }
  const rot = vec(extra.rotation), sc = vec(extra.scale); if (rot) developer.rotation = rot; if (sc) developer.scale = sc
  return { regular, developer }
}
function safeClone (o, depth = 0) {
  if (depth > 6) return '…'
  if (Array.isArray(o)) return o.slice(0, 64).map(v => safeClone(v, depth + 1))
  if (o && typeof o === 'object') { const out = {}; let n = 0; for (const k of Object.keys(o)) { if (++n > 64) { out['…'] = 'more'; break } out[k] = safeClone(o[k], depth + 1) } return out }
  if (typeof o === 'string') return o.length > 400 ? o.slice(0, 400) + '…' : o
  if (typeof o === 'function') return undefined
  return o
}
const LABELS = { name: 'Name', kind: 'Kind', shape: 'Shape', id: 'Id', position: 'Position', color: 'Colour', links: 'Links', parent: 'Parent', room: 'Room', document: 'Document', polyShape: 'Poly shape' }
export function toText (obj) {
  if (!obj) return 'Nothing in the circle.'
  return Object.keys(obj).filter(k => k !== 'data').map(k => `${LABELS[k] ?? k}: ${Array.isArray(obj[k]) ? obj[k].join(', ') : obj[k]}`).join('\n')
}
export function toJSON (obj, indent = 2) { return obj ? JSON.stringify(obj, null, indent) : 'null' }
export default { DEFAULT_RADIUS, clampRadius, pickScanTarget, describeNode, toText, toJSON, kindName }
