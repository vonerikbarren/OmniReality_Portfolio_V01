/**
 * utils/OmniEdgeNodeMesh.js (V278) — the GEOMETRY of an EdgeNode: a small diamond (the handle; it sits half way between its two nodes), the route drawn as a line,
 * rings round it for a tunnel, the ring for a torus / orbit, and a small bead on each control point. The route is drawn in world space, so the child group is offset by the
 * diamond's own position. Materials belong to the node (releaseEdgeNodeMesh); the diamond's geometry is shared.
 */
import * as THREE from 'three'
import { ringsAlong, ringOf } from './OmniEdgeNodeModel.js'

export const EN_LIVE = new Set()
const G = {}
const shared = () => { if (G.dia) return G; G.dia = new THREE.OctahedronGeometry(0.4, 0); G.bead = new THREE.SphereGeometry(0.16, 8, 6); return G }
export function buildEdgeNodeMesh (color = '#7fd8ff') {
  const g = shared(); const col = new THREE.Color(color)
  const root = new THREE.Mesh(g.dia, new THREE.MeshStandardMaterial({ color: col, emissive: col.clone(), emissiveIntensity: 0.5, roughness: 0.4 }))
  const route = new THREE.Group(); route.raycast = () => {}; root.add(route)
  root.userData.env = { route, sig: '', mats: [], geos: [] }
  EN_LIVE.add(root); return root
}
const circle = (c, u, v, r, n = 28) => { const a = []; for (let i = 0; i < n; i++) { const t = (i / n) * Math.PI * 2, t2 = ((i + 1) / n) * Math.PI * 2; for (const k of [t, t2]) a.push(c[0] + (u[0] * Math.cos(k) + v[0] * Math.sin(k)) * r, c[1] + (u[1] * Math.cos(k) + v[1] * Math.sin(k)) * r, c[2] + (u[2] * Math.cos(k) + v[2] * Math.sin(k)) * r) } return a }
const perp = (d) => { const a = Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]; const u = [d[1] * a[2] - d[2] * a[1], d[2] * a[0] - d[0] * a[2], d[0] * a[1] - d[1] * a[0]]; const l = Math.hypot(...u) || 1; const U = u.map(x => x / l); const V = [d[1] * U[2] - d[2] * U[1], d[2] * U[0] - d[0] * U[2], d[0] * U[1] - d[1] * U[0]]; return [U, V] }
/** redraw the route for a spec, the path (utils/OmniEdgeNodeModel.makePath) and the two end positions. `ctrl` = the world positions of the control points. Skips when nothing changed. */
export function applyEdgeNodeLook (mesh, spec, path, A, B, ctrl = []) {
  const v = mesh?.userData?.env; if (!v) return false
  const sig = JSON.stringify([spec.mode, spec.radius, spec.color, path?.length ? path.points.length : 0, A, B, ctrl, spec.turns]); if (sig === v.sig) return false
  v.sig = sig
  for (const o of v.mats) o.dispose(); for (const o of v.geos) o.dispose(); v.mats = []; v.geos = []; v.route.clear()
  mesh.material.color.set(spec.color); mesh.material.emissive.set(spec.color)
  if (!path || path.points.length < 2) { v.route.visible = false; return true }
  v.route.visible = true
  const o = mesh.position; const rel = (p) => [p[0] - o.x, p[1] - o.y, p[2] - o.z]
  const mat = new THREE.LineBasicMaterial({ color: spec.color, transparent: true, opacity: 0.9 }); v.mats.push(mat)
  const g = new THREE.BufferGeometry().setFromPoints(path.points.map(p => new THREE.Vector3(...rel(p)))); v.geos.push(g)
  const line = new THREE.Line(g, mat); line.raycast = () => {}; line.frustumCulled = false; v.route.add(line)
  if (spec.mode === 'tunnel') {
    const arr = []; for (const r of ringsAlong(path, Math.max(1, spec.radius * 0.6))) { const [U, V] = perp(r.dir); arr.push(...circle(rel(r.pos), U, V, spec.radius)) }
    const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3)); v.geos.push(rg)
    const rm = new THREE.LineBasicMaterial({ color: spec.color, transparent: true, opacity: 0.35 }); v.mats.push(rm); const rings = new THREE.LineSegments(rg, rm); rings.raycast = () => {}; rings.frustumCulled = false; v.route.add(rings)
  } else if (spec.mode === 'torus' || spec.mode === 'orbit') {
    const R = ringOf(spec, A, B); const arr = circle(rel(R.centre), R.u, R.v, R.r, 48)
    const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3)); v.geos.push(rg)
    const rm = new THREE.LineBasicMaterial({ color: spec.color, transparent: true, opacity: 0.45 }); v.mats.push(rm); const ring = new THREE.LineSegments(rg, rm); ring.raycast = () => {}; ring.frustumCulled = false; v.route.add(ring)
  }
  const bm = new THREE.MeshBasicMaterial({ color: spec.color }); v.mats.push(bm)
  for (const c of ctrl) { const b = new THREE.Mesh(shared().bead, bm); b.position.set(...rel(c)); b.raycast = () => {}; v.route.add(b) }
  return true
}
export function releaseEdgeNodeMesh (mesh) {
  const v = mesh?.userData?.env; EN_LIVE.delete(mesh); if (!v) return
  try { for (const o of v.mats) o.dispose(); for (const o of v.geos) o.dispose(); mesh.material.dispose() } catch (_) { /* already gone */ }
}
