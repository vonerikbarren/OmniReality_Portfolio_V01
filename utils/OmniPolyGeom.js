/**
 * utils/OmniPolyGeom.js (V204) — pure geometry of the PolyNode: regular polygons joined into SOLIDS and STRIPS. No DOM, no Three.js, no imports; plain arrays [x, y, z].
 *
 * Every face is a REGULAR polygon with the same edge length (the node's `edge`). Same-shape-first: each shape here uses faces of ONE kind.
 *   plane        one regular polygon (3..12 sides)
 *   tetra        4 triangles          cube   6 squares        octa   8 triangles
 *   dodeca       12 pentagons         icosa  20 triangles     (closed solids)
 *   strip        `count` regular polygons joined edge to edge, each folded `fold` degrees against the one before (an open folded net)
 *   ring         `count` squares folded 360 / count degrees each: an open tube (count 3..24)
 * buildShape(params) -> { ok, faces:[{ id, n, verts, normal, center, ex, ey, radius }], closed, edge, bounds:{ min, max, radius } }
 *   verts are counter-clockwise seen from OUTSIDE (the normal points out). id is 'f0', 'f1' ... in a fixed order, so a face keeps its id when the shape is rebuilt with the same parameters.
 *   ex / ey (upright: ey follows the world up, a top face uses -z) / radius give the face's texture frame: a point p maps to u = dot(p - center, ex) / radius, v = dot(p - center, ey) / radius (each -1..1, the polygon sits inside that circle).
 * Never throws; bad input gives the default shape (a cube).
 */

export const PHI = (1 + Math.sqrt(5)) / 2
export const SHAPES = Object.freeze(['cube', 'tetra', 'octa', 'dodeca', 'icosa', 'plane', 'strip', 'ring'])
export const SHAPE_INFO = Object.freeze({
  cube: { name: 'Cube', sides: 4, faces: 6, closed: true },
  tetra: { name: 'Tetrahedron', sides: 3, faces: 4, closed: true },
  octa: { name: 'Octahedron', sides: 3, faces: 8, closed: true },
  dodeca: { name: 'Dodecahedron', sides: 5, faces: 12, closed: true },
  icosa: { name: 'Icosahedron', sides: 3, faces: 20, closed: true },
  plane: { name: 'Plane', sides: 4, faces: 1, closed: false },
  strip: { name: 'Folded strip', sides: 4, faces: 4, closed: false },
  ring: { name: 'Ring (tube)', sides: 4, faces: 6, closed: false },
})
export const GEOM_LIMITS = Object.freeze({ edgeMin: 0.2, edgeMax: 40, edgeDefault: 2, sidesMin: 3, sidesMax: 12, countMin: 1, countMax: 24, foldMin: -180, foldMax: 180 })

const L = GEOM_LIMITS
const isNum = (v) => typeof v === 'number' && Number.isFinite(v)
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const num = (v, def, lo, hi) => { const n = typeof v === 'string' && v.trim() !== '' && v.length < 24 ? Number(v) : v; return isNum(n) ? clamp(n, lo, hi) : def }
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k]
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const len = (a) => Math.hypot(a[0], a[1], a[2])
const norm = (a) => { const l = len(a); return l > 1e-12 ? mul(a, 1 / l) : [0, 0, 1] }
const centroid = (vs) => mul(vs.reduce((s, v) => add(s, v), [0, 0, 0]), 1 / vs.length)

/** Face frame: normal (from the vertex order), center, ex (towards vertex 0), ey = normal x ex, circumradius. */
function frameOf (verts) {
  const c = centroid(verts)
  let nrm = [0, 0, 0]
  for (let i = 0; i < verts.length; i++) nrm = add(nrm, cross(sub(verts[i], c), sub(verts[(i + 1) % verts.length], c)))
  const normal = norm(nrm)
  const ex = norm(sub(verts[0], c))
  const ey = norm(cross(normal, ex))
  return { normal, center: c, ex, ey, radius: len(sub(verts[0], c)) }
}

const rot = (p, axisPoint, axisDir, ang) => {              // Rodrigues rotation of p about the line (axisPoint, axisDir)
  const k = norm(axisDir); const v = sub(p, axisPoint); const c = Math.cos(ang); const s = Math.sin(ang)
  const kxv = cross(k, v); const kd = dot(k, v)
  return add(axisPoint, add(add(mul(v, c), mul(kxv, s)), mul(k, kd * (1 - c))))
}

// ── closed solids: vertices + face normals + sides per face; a face = the vertices furthest along its normal ──────────────────────────────────────
const SOLIDS = {
  tetra: { n: 3, verts: [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]], normals: [[-1, -1, -1], [-1, 1, 1], [1, -1, 1], [1, 1, -1]] },
  cube: { n: 4, verts: (() => { const o = []; for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) o.push([x, y, z]); return o })(), normals: [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]] },
  octa: { n: 3, verts: [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]], normals: (() => { const o = []; for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) o.push([x, y, z]); return o })() },
  icosa: {
    n: 3,
    verts: (() => { const o = []; for (const a of [-1, 1]) for (const b of [-PHI, PHI]) o.push([0, a, b], [a, b, 0], [b, 0, a]); return o })(),
    normals: [],   // set below: the dodecahedron's vertex directions
  },
  dodeca: {
    n: 5,
    verts: (() => { const o = []; for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) o.push([x, y, z]); for (const a of [-1, 1]) for (const b of [-1, 1]) o.push([0, a * PHI, b / PHI], [b / PHI, 0, a * PHI], [a * PHI, b / PHI, 0]); return o })(),
    normals: (() => { const o = []; for (const a of [-1, 1]) for (const b of [-PHI, PHI]) o.push([0, a, b], [a, b, 0], [b, 0, a]); return o })(),
  },
}
// icosa normals are the dodecahedron's vertex directions
SOLIDS.icosa.normals = SOLIDS.dodeca.verts.map(v => v.slice())

function solidFaces (name, edge) {
  const S = SOLIDS[name]
  let raw = []
  for (const nrm of S.normals) {
    const d = norm(nrm)
    let best = -Infinity
    for (const v of S.verts) best = Math.max(best, dot(v, d))
    const idx = []
    S.verts.forEach((v, i) => { if (best - dot(v, d) < 1e-6) idx.push(i) })
    if (idx.length !== S.n) continue
    let vs = idx.map(i => S.verts[i])
    // order counter-clockwise seen from outside: sort by angle around the normal
    const c = centroid(vs); const ex = norm(sub(vs[0], c)); const ey = cross(d, ex)
    vs = vs.map(v => ({ v, a: Math.atan2(dot(sub(v, c), ey), dot(sub(v, c), ex)) })).sort((p, q) => p.a - q.a).map(o => o.v)
    raw.push(vs)
  }
  // scale so that an edge is `edge` long
  const e0 = len(sub(raw[0][0], raw[0][1])); const k = edge / e0
  return raw.map(vs => vs.map(v => mul(v, k)))
}

// ── polygons joined edge to edge ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
function regularPolygon (n, edge) {
  const R = edge / (2 * Math.sin(Math.PI / n))
  const out = []
  for (let k = 0; k < n; k++) { const a = Math.PI * 2 * k / n - Math.PI / n - Math.PI / 2 + Math.PI / 2; out.push([R * Math.cos(a), R * Math.sin(a), 0]) }
  return out
}

function stripFaces (n, count, fold, edge) {
  const faces = [regularPolygon(n, edge)]
  const R = edge / (2 * Math.sin(Math.PI / n)); const apo = edge / (2 * Math.tan(Math.PI / n))
  const shift = n === 3 ? 1 : Math.floor(n / 2)
  let hinge = 1                                  // edge index (v[h] -> v[h+1]) of the newest face that the next face hangs on
  const ang = clamp(fold, L.foldMin, L.foldMax) * Math.PI / 180
  for (let i = 1; i < count; i++) {
    const f = faces[i - 1]; const fr = frameOf(f)
    const A = f[hinge]; const B = f[(hinge + 1) % n]
    const mid = mul(add(A, B), 0.5)
    const out = norm(sub(mid, fr.center))
    const c2 = add(mid, mul(out, apo))
    // the new face's edge e2 runs B -> A (so its vertex e2 is B and e2 + 1 is A), counter-clockwise about the same normal
    const e2 = n === 3 ? 0 : (hinge + Math.floor(n / 2)) % n
    const e2i = ((e2 % n) + n) % n
    const exv = norm(sub(B, c2)); const eyv = cross(fr.normal, exv)
    const a0 = Math.atan2(dot(sub(B, c2), eyv), dot(sub(B, c2), exv))
    const verts = []
    for (let k = 0; k < n; k++) { const a = a0 + (k - e2i) * 2 * Math.PI / n; verts.push(add(c2, add(mul(exv, R * Math.cos(a)), mul(eyv, R * Math.sin(a))))) }
    // fold about the hinge: the new face turns towards the front (+normal) side for a positive angle
    const folded = verts.map(v => rot(v, A, sub(B, A), -ang))
    faces.push(folded)
    hinge = (e2i + shift) % n
  }
  return faces
}

export function sanitizeShapeParams (raw) {
  const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  const get = (k) => (Object.prototype.hasOwnProperty.call(o, k) ? o[k] : undefined)
  const shape = SHAPES.includes(get('shape')) ? get('shape') : 'cube'
  const info = SHAPE_INFO[shape]
  const sides = Math.round(num(get('sides'), info.sides, L.sidesMin, L.sidesMax))
  const count = Math.round(num(get('count'), info.faces, L.countMin, L.countMax))
  const fold = num(get('fold'), shape === 'strip' ? 60 : 0, L.foldMin, L.foldMax)
  const edge = Math.round(num(get('edge'), L.edgeDefault, L.edgeMin, L.edgeMax) * 1000) / 1000
  return { shape, sides, count, fold: Math.round(fold * 100) / 100, edge }
}

/** Build a shape. params = { shape, sides, count, fold, edge } (any of them; sanitized). */
export function buildShape (params) {
  const p = sanitizeShapeParams(params)
  let polys; let closed = false
  try {
    if (p.shape === 'plane') polys = [regularPolygon(p.sides, p.edge)]
    else if (p.shape === 'strip') polys = stripFaces(p.sides, p.count, p.fold, p.edge)
    else if (p.shape === 'ring') polys = stripFaces(4, p.count < 3 ? 3 : p.count, -(360 / (p.count < 3 ? 3 : p.count)), p.edge)
    else { polys = solidFaces(p.shape, p.edge); closed = true }
  } catch (_) { polys = solidFaces('cube', p.edge); closed = true }
  const faces = polys.map((verts, i) => {
    const fr = frameOf(verts)
    return { id: 'f' + i, n: verts.length, verts: verts.map(v => v.map(x => Math.round(x * 1e6) / 1e6)), normal: fr.normal, center: fr.center, ex: fr.ex, ey: fr.ey, radius: fr.radius }
  })
  // a closed solid: make sure every normal points away from the middle
  if (closed) { const mid = centroid(faces.map(f => f.center)); for (const f of faces) if (dot(f.normal, sub(f.center, mid)) < 0) { f.verts.reverse(); const fr = frameOf(f.verts); Object.assign(f, { normal: fr.normal, ex: fr.ex, ey: fr.ey }) } }
  // the texture frame of every face is UPRIGHT: the picture's up is the world's up as far as the face allows (a top face uses -z as up), so text on the sides is not rotated at random
  for (const f of faces) {
    const n = f.normal; const d = n[1]
    const ref = Math.abs(d) > 0.98 ? [0, 0, d > 0 ? -1 : 1] : [0, 1, 0]
    const ey = norm(sub(ref, mul(n, dot(ref, n)))); const ex = cross(ey, n)
    if (Number.isFinite(ey[0] + ex[0] + ey[1] + ex[1] + ey[2] + ex[2])) { f.ex = ex; f.ey = ey }
  }
  const min = [Infinity, Infinity, Infinity]; const max = [-Infinity, -Infinity, -Infinity]
  for (const f of faces) for (const v of f.verts) for (let i = 0; i < 3; i++) { if (v[i] < min[i]) min[i] = v[i]; if (v[i] > max[i]) max[i] = v[i] }
  const mid = mul(add(min, max), 0.5)
  let radius = 0; for (const f of faces) for (const v of f.verts) radius = Math.max(radius, len(sub(v, mid)))
  return { ok: true, params: p, faces, closed, edge: p.edge, bounds: { min, max, mid, radius } }
}

/** u, v (0..1) of a point on a face, for the texture. */
export function faceUV (face, p) {
  const d = sub(p, face.center)
  return [0.5 + 0.5 * dot(d, face.ex) / face.radius, 0.5 + 0.5 * dot(d, face.ey) / face.radius]
}

/** The faces whose edge is shared (distance < eps between both end points): a quick check that a closed solid is closed and a strip is joined. */
export function sharedEdges (faces, eps = 1e-4) {
  let count = 0
  const key = (a, b) => { const p = a.map(x => Math.round(x / eps)).join(','); const q = b.map(x => Math.round(x / eps)).join(','); return p < q ? p + '|' + q : q + '|' + p }
  const seen = new Map()
  for (const f of faces) for (let i = 0; i < f.verts.length; i++) { const k = key(f.verts[i], f.verts[(i + 1) % f.verts.length]); seen.set(k, (seen.get(k) || 0) + 1) }
  for (const n of seen.values()) if (n === 2) count++
  return { shared: count, edges: seen.size, open: [...seen.values()].filter(n => n === 1).length }
}

export default { SHAPES, SHAPE_INFO, GEOM_LIMITS, buildShape, sanitizeShapeParams, faceUV, sharedEdges }
