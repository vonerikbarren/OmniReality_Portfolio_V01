/**
 * utils/OmniGeometryCensus.js — pure helpers behind the OmniDock_Realities (V191)
 *
 * No DOM, no Three.js, no storage: plain arrays and numbers, so everything here is unit-testable without a browser.
 *
 *   GEOMETRIES                 the 20 MAIN geometries a node can have, in the order of the node geometry picker
 *                              (systems/OmniNode.js GEO_LABELS; a test keeps the two lists identical)
 *   countByGeometry(nodes)     { counts: {BoxGeometry: n, ...every main geometry (0 when none)}, other, total }
 *   listByGeometry(nodes, id)  [{ id, label, kind, geometry }] of every node with that geometry, sorted by label then id
 *   nodeKind(data)             'node' | 'group' | 'essence' | 'text' | 'structural' | the node's data.nodeKind (store item, value, ...)
 *   wireframeOf(id)            { polylines: [[ [x,y,z], ... ], ...] } a small hand-sized wireframe of that shape (about radius 1)
 *   projectWireframe(wf, opts) [[ [x,y], ... ], ...]  orthographic projection into a size x size box (yaw / pitch in radians)
 *   toPathData(polys)          an SVG path "d" string
 *
 * The icons in the dock are SVG <path>s built from these, so the dock adds ZERO WebGL contexts and no canvas.
 */

export const GEOMETRIES = Object.freeze([
  ['BoxGeometry', 'Box'], ['SphereGeometry', 'Sphere'], ['CylinderGeometry', 'Cylinder'], ['ConeGeometry', 'Cone'],
  ['TorusGeometry', 'Torus'], ['TorusKnotGeometry', 'TorusKnot'], ['OctahedronGeometry', 'Octahedron'], ['TetrahedronGeometry', 'Tetrahedron'],
  ['IcosahedronGeometry', 'Icosahedron'], ['DodecahedronGeometry', 'Dodecahedron'], ['PlaneGeometry', 'Plane'], ['CircleGeometry', 'Circle'],
  ['RingGeometry', 'Ring'], ['CapsuleGeometry', 'Capsule'], ['LatheGeometry', 'Lathe'], ['TubeGeometry', 'Tube'],
  ['ExtrudeGeometry', 'Extrude'], ['ShapeGeometry', 'Shape'], ['EdgesGeometry', 'Edges'], ['WireframeGeometry', 'Wireframe'],
].map(([id, label]) => Object.freeze({ id, label })))

export const GEOMETRY_IDS = Object.freeze(GEOMETRIES.map(g => g.id))
export const GEOMETRY_LABELS = Object.freeze(Object.fromEntries(GEOMETRIES.map(g => [g.id, g.label])))
export const isGeometryId = (id) => typeof id === 'string' && Object.prototype.hasOwnProperty.call(GEOMETRY_LABELS, id)

// ── census ───────────────────────────────────────────────────────────────────

export function nodeKind (d) {
  if (!d || typeof d !== 'object') return 'node'
  if (typeof d.nodeKind === 'string' && d.nodeKind) return d.nodeKind
  if (d.isGroupNode) return 'group'
  if (d.isEssenceNode) return 'essence'
  if (d.skipAutoSelect) return 'structural'
  if (d.isDimensionalText || (d.text !== undefined && !d.geometry)) return 'text'
  return 'node'
}

const emptyCounts = () => Object.fromEntries(GEOMETRY_IDS.map(id => [id, 0]))

export function countByGeometry (nodes) {
  const counts = emptyCounts()
  let other = 0, total = 0
  for (const d of Array.isArray(nodes) ? nodes : []) {
    if (!d || typeof d !== 'object') continue
    total++
    if (isGeometryId(d.geometry)) counts[d.geometry]++
    else other++
  }
  return { counts, other, total }
}

export function listByGeometry (nodes, geometryId) {
  const out = []
  if (!isGeometryId(geometryId)) return out
  for (const d of Array.isArray(nodes) ? nodes : []) {
    if (!d || typeof d !== 'object' || d.geometry !== geometryId) continue
    out.push({ id: String(d.id ?? ''), label: String(d.label ?? d.id ?? ''), kind: nodeKind(d), geometry: geometryId })
  }
  out.sort((a, b) => a.label.localeCompare(b.label) || a.id.localeCompare(b.id))
  return out
}

/** "1 node" / "4 nodes" */
export const nodesPhrase = (n) => `${n} node${n === 1 ? '' : 's'}`

// ── procedural wireframes ────────────────────────────────────────────────────

const TAU = Math.PI * 2
const PHI = (1 + Math.sqrt(5)) / 2

/** Closed circle polyline in a plane. plane: 'xz' (horizontal) | 'xy' | 'zy'. */
function circle (r, n = 20, h = 0, plane = 'xz', sx = 1) {
  const pts = []
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * TAU, c = Math.cos(a) * r * sx, s = Math.sin(a) * r
    pts.push(plane === 'xz' ? [c, h, s] : plane === 'xy' ? [c, s + h, 0] : [0, s + h, c])
  }
  return pts
}
const arc = (r, a0, a1, n, plane, h = 0) => {
  const pts = []
  for (let i = 0; i <= n; i++) {
    const a = a0 + (a1 - a0) * (i / n), c = Math.cos(a) * r, s = Math.sin(a) * r
    pts.push(plane === 'xy' ? [c, s + h, 0] : [0, s + h, c])
  }
  return pts
}
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

/** Polylines for every edge of a vertex set: the pairs at the minimum distance. */
function edgesByMinDistance (verts) {
  let min = Infinity
  for (let i = 0; i < verts.length; i++) for (let j = i + 1; j < verts.length; j++) min = Math.min(min, dist(verts[i], verts[j]))
  const out = []
  for (let i = 0; i < verts.length; i++) for (let j = i + 1; j < verts.length; j++) if (dist(verts[i], verts[j]) < min * 1.02) out.push([verts[i], verts[j]])
  return out
}
const scaleAll = (verts, k) => verts.map(v => v.map(c => c * k))

function icosaVerts () {
  const v = []
  for (const a of [-1, 1]) for (const b of [-PHI, PHI]) { v.push([0, a, b], [a, b, 0], [b, 0, a]) }
  return scaleAll(v, 1 / Math.hypot(1, PHI))
}

function boxCorners (k = 0.72) {
  const v = []
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) v.push([x * k, y * k, z * k])
  return v
}

const BUILDERS = {
  BoxGeometry: () => edgesByMinDistance(boxCorners()),
  SphereGeometry: () => [circle(0.9, 24, 0, 'xz'), circle(0.78, 20, 0.45, 'xz'), circle(0.78, 20, -0.45, 'xz'), circle(0.9, 24, 0, 'xy'), circle(0.9, 24, 0, 'zy')],
  CylinderGeometry: () => {
    const top = circle(0.62, 16, 0.8), bot = circle(0.62, 16, -0.8)
    return [top, bot, ...[0, 4, 8, 12].map(i => [top[i], bot[i]])]
  },
  ConeGeometry: () => {
    const base = circle(0.7, 16, -0.75), apex = [0, 0.85, 0]
    return [base, ...[0, 4, 8, 12].map(i => [base[i], apex])]
  },
  TorusGeometry: () => {
    const R = 0.66, r = 0.26, out = [circle(R + r, 24, 0, 'xz'), circle(R - r, 20, 0, 'xz')]
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * TAU, ring = []
      for (let i = 0; i <= 12; i++) {
        const b = (i / 12) * TAU, rr = R + Math.cos(b) * r
        ring.push([Math.cos(a) * rr, Math.sin(b) * r, Math.sin(a) * rr])
      }
      out.push(ring)
    }
    return out
  },
  TorusKnotGeometry: () => {
    const pts = []
    for (let i = 0; i <= 90; i++) {
      const t = (i / 90) * TAU, r = 0.45 + 0.2 * Math.cos(3 * t)
      pts.push([r * Math.cos(2 * t) * 1.2, 0.3 * Math.sin(3 * t), r * Math.sin(2 * t) * 1.2])
    }
    return [pts]
  },
  OctahedronGeometry: () => edgesByMinDistance([[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].map(v => v.map(c => c * 0.9))),
  TetrahedronGeometry: () => edgesByMinDistance([[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]].map(v => v.map(c => c * 0.62))),
  IcosahedronGeometry: () => edgesByMinDistance(scaleAll(icosaVerts(), 0.92)),
  DodecahedronGeometry: () => {
    const v = [], a = 1 / PHI, k = 0.55
    for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) v.push([x, y, z])
    for (const s of [-1, 1]) for (const t of [-1, 1]) v.push([0, s * a, t * PHI], [s * a, t * PHI, 0], [t * PHI, 0, s * a])
    return edgesByMinDistance(scaleAll(v, k))
  },
  PlaneGeometry: () => {
    const c = [[-0.85, 0, -0.85], [0.85, 0, -0.85], [0.85, 0, 0.85], [-0.85, 0, 0.85]]
    return [[...c, c[0]], [[0, 0, -0.85], [0, 0, 0.85]], [[-0.85, 0, 0], [0.85, 0, 0]]]
  },
  CircleGeometry: () => [circle(0.9, 24, 0, 'xz'), ...[0, 6, 12, 18].map(i => [[0, 0, 0], circle(0.9, 24, 0, 'xz')[i]])],
  RingGeometry: () => [circle(0.9, 24, 0, 'xz'), circle(0.5, 20, 0, 'xz')],
  CapsuleGeometry: () => {
    const h = 0.42, r = 0.4
    return [
      arc(r, 0, Math.PI, 8, 'xy', h), arc(r, Math.PI, TAU, 8, 'xy', -h), arc(r, 0, Math.PI, 8, 'zy', h), arc(r, Math.PI, TAU, 8, 'zy', -h),
      circle(r, 14, h, 'xz'), circle(r, 14, -h, 'xz'),
      [[r, h, 0], [r, -h, 0]], [[-r, h, 0], [-r, -h, 0]], [[0, h, r], [0, -h, r]], [[0, h, -r], [0, -h, -r]],
    ]
  },
  LatheGeometry: () => {
    const prof = [[0.35, -0.9], [0.62, -0.5], [0.4, 0], [0.55, 0.5], [0.3, 0.9]]
    const side = (s) => prof.map(([r, y]) => [r * s, y, 0])
    return [side(1), side(-1), circle(0.62, 16, -0.5), circle(0.4, 14, 0), circle(0.55, 16, 0.5)]
  },
  TubeGeometry: () => {
    const curve = (off) => { const p = []; for (let i = 0; i <= 24; i++) { const t = i / 24; p.push([(t - 0.5) * 1.8, Math.sin(t * TAU) * 0.38 + off, Math.cos(t * Math.PI) * 0.12 + off * 0.2]) } return p }
    const a = curve(0.14), b = curve(-0.14)
    return [a, b, ...[2, 8, 14, 20].map(i => [a[i], b[i]])]
  },
  ExtrudeGeometry: () => {
    const star = (z) => { const p = []; for (let i = 0; i <= 10; i++) { const r = i % 2 ? 0.38 : 0.85, a = -Math.PI / 2 + (i / 10) * TAU; p.push([Math.cos(a) * r, -Math.sin(a) * r, z]) } return p }
    const f = star(0.22), b = star(-0.22)
    return [f, b, ...[0, 2, 4, 6, 8].map(i => [f[i], b[i]])]
  },
  ShapeGeometry: () => {
    const p = []; for (let i = 0; i <= 10; i++) { const r = i % 2 ? 0.38 : 0.9, a = -Math.PI / 2 + (i / 10) * TAU; p.push([Math.cos(a) * r, -Math.sin(a) * r, 0]) }
    return [p]
  },
  EdgesGeometry: () => {
    // corner brackets: every box edge drawn only 35% in from each end
    const out = []
    for (const [a, b] of edgesByMinDistance(boxCorners(0.78))) {
      const lerp = (t) => a.map((c, i) => c + (b[i] - c) * t)
      out.push([a, lerp(0.35)], [lerp(0.65), b])
    }
    return out
  },
  WireframeGeometry: () => {
    const v = scaleAll(icosaVerts(), 0.92), out = edgesByMinDistance(v)
    const mid = (a, b) => a.map((c, i) => (c + b[i]) / 2)
    const adj = (i, j) => out.some(([p, q]) => (p === v[i] && q === v[j]) || (p === v[j] && q === v[i]))
    for (let i = 0; i < v.length; i++) for (let j = i + 1; j < v.length; j++) for (let k = j + 1; k < v.length; k++) {
      if (adj(i, j) && adj(j, k) && adj(i, k)) { const a = mid(v[i], v[j]), b = mid(v[j], v[k]), c = mid(v[i], v[k]); out.push([a, b], [b, c], [c, a]) }
    }
    return out
  },
}

const cache = new Map()
/** The wireframe of a main geometry: { polylines } (cached, frozen shapes are shared, never mutated). Unknown id -> a unit box. */
export function wireframeOf (id) {
  const key = isGeometryId(id) ? id : 'BoxGeometry'
  let wf = cache.get(key)
  if (!wf) { wf = { id: key, polylines: BUILDERS[key]() }; cache.set(key, wf) }
  return wf
}

/** Orthographic projection into a size x size box (yaw about Y, then pitch about X). The scale is fixed per shape (its max radius), so a rotating icon never pulses. */
export function projectWireframe (wf, { yaw = 0.6, pitch = 0.45, size = 40, pad = 3 } = {}) {
  const polylines = wf?.polylines ?? []
  let rmax = 0
  for (const pl of polylines) for (const p of pl) rmax = Math.max(rmax, Math.hypot(p[0], p[1], p[2]))
  if (!(rmax > 0)) return []
  const k = (size / 2 - pad) / rmax, c = size / 2
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch)
  const proj = (p) => {
    const x1 = p[0] * cy + p[2] * sy, z1 = -p[0] * sy + p[2] * cy
    const y2 = p[1] * cp - z1 * sp
    return [Math.round((c + x1 * k) * 100) / 100, Math.round((c - y2 * k) * 100) / 100]
  }
  return polylines.map(pl => pl.map(proj))
}

export function toPathData (polys) {
  let d = ''
  for (const pl of polys) { if (pl.length < 2) continue; d += `M${pl[0][0]} ${pl[0][1]}`; for (let i = 1; i < pl.length; i++) d += `L${pl[i][0]} ${pl[i][1]}` }
  return d
}
