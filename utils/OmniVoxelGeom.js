/**
 * utils/OmniVoxelGeom.js — traversable points on a node's own shape (V210). PURE: plain arrays in, plain arrays out.
 *
 * A sphere has points, a cube has points: every distinct vertex of the shape can be a stop. A shape with many vertices is thinned by merging vertices
 * that fall into the same cell of a coarser and coarser lattice until at most `max` points remain, so the result is small, exact and repeatable.
 * Mesh edges (from the triangles) become lines between the kept points.
 *
 *   geometryGraph({ positions, index }, { matrix, max }) -> { ok, points:[[x,y,z]...], edges:[[i,j]...], merged }
 *   positions: flat [x,y,z,...] (array or typed array) in the mesh's local space; index: triangle indices (flat) or null for non-indexed triangles;
 *   matrix: optional 16 numbers (column-major, like THREE.Matrix4.elements) to bring the points into world space.
 */
export const DEFAULT_MAX = 64
export const HARD_VERTEX_LIMIT = 200000
const fin = (n) => typeof n === 'number' && Number.isFinite(n)

export function geometryGraph (geo, opts = {}) {
  const pos = geo?.positions
  if (!pos || typeof pos.length !== 'number' || pos.length < 9 || pos.length % 3 !== 0) return { ok: false, error: 'This shape has no usable points.' }
  const nv = pos.length / 3; if (nv > HARD_VERTEX_LIMIT) return { ok: false, error: 'This shape has too many points.' }
  const max = Math.min(256, Math.max(2, Math.floor(Number(opts.max) || DEFAULT_MAX)))
  const m = Array.isArray(opts.matrix) || (opts.matrix && typeof opts.matrix.length === 'number') ? opts.matrix : null
  const useM = m && m.length === 16 && Array.prototype.every.call(m, fin)
  const P = new Array(nv)
  let lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i < nv; i++) {
    let x = +pos[i * 3], y = +pos[i * 3 + 1], z = +pos[i * 3 + 2]
    if (!fin(x) || !fin(y) || !fin(z)) return { ok: false, error: 'This shape has a bad point.' }
    if (useM) { const nx = m[0] * x + m[4] * y + m[8] * z + m[12], ny = m[1] * x + m[5] * y + m[9] * z + m[13], nz = m[2] * x + m[6] * y + m[10] * z + m[14]; x = nx; y = ny; z = nz }
    P[i] = [x, y, z]; lo = [Math.min(lo[0], x), Math.min(lo[1], y), Math.min(lo[2], z)]; hi = [Math.max(hi[0], x), Math.max(hi[1], y), Math.max(hi[2], z)]
  }
  const diag = Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) || 1
  const idx = geo.index && geo.index.length >= 3 ? geo.index : null
  const tri = []
  if (idx) { for (let i = 0; i + 2 < idx.length; i += 3) { const a = idx[i], b = idx[i + 1], c = idx[i + 2]; if (a < nv && b < nv && c < nv && a >= 0 && b >= 0 && c >= 0) tri.push(a, b, c) } }
  else for (let i = 0; i + 2 < nv; i += 3) tri.push(i, i + 1, i + 2)

  let step = diag / 4096, map, keep
  for (let guard = 0; guard < 40; guard++) {
    map = new Array(nv); keep = new Map()
    for (let i = 0; i < nv; i++) {
      const k = `${Math.round(P[i][0] / step)},${Math.round(P[i][1] / step)},${Math.round(P[i][2] / step)}`
      if (!keep.has(k)) keep.set(k, keep.size)
      map[i] = keep.get(k)
    }
    if (keep.size <= max) break
    step *= 1.5
  }
  const points = new Array(keep.size), sums = new Array(keep.size).fill(0)
  for (let i = 0; i < nv; i++) { const j = map[i]; if (!points[j]) points[j] = [0, 0, 0]; points[j][0] += P[i][0]; points[j][1] += P[i][1]; points[j][2] += P[i][2]; sums[j]++ }
  for (let j = 0; j < points.length; j++) points[j] = points[j].map(v => v / sums[j])
  const seen = new Set(), edges = []
  for (let t = 0; t < tri.length; t += 3) for (const [a, b] of [[tri[t], tri[t + 1]], [tri[t + 1], tri[t + 2]], [tri[t + 2], tri[t]]]) {
    const i = map[a], j = map[b]; if (i === j) continue
    const k = i < j ? `${i}-${j}` : `${j}-${i}`; if (seen.has(k)) continue; seen.add(k); edges.push(i < j ? [i, j] : [j, i])
  }
  return { ok: true, points, edges, merged: nv - points.length }
}
