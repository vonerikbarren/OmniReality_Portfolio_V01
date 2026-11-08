/**
 * utils/OmniStoredRealityNodeMesh.js (V277) — the GEOMETRY of a StoredRealityNode: ONE glass box with edges and ONE point-cloud of the parts inside it (two draw calls however big the course is).
 * Expanded: the box turns into a faint wire frame (its parts are live nodes now). Geometries are shared; each node owns its materials and its points.
 */
import * as THREE from 'three'

export const SR_LIVE = new Set()
const G = {}
function shared () { if (G.box) return G; G.box = new THREE.BoxGeometry(1, 1, 1); G.edges = new THREE.EdgesGeometry(G.box); return G }
export function buildStoredRealityNodeMesh () {
  const g = shared()
  const root = new THREE.Mesh(g.box, new THREE.MeshPhysicalMaterial({ color: 0x9fd2ff, transparent: true, opacity: 0.16, roughness: 0.2, metalness: 0, depthWrite: false, side: THREE.DoubleSide }))
  const edges = new THREE.LineSegments(g.edges, new THREE.LineBasicMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0.85 }))
  edges.raycast = () => {}; root.add(edges)
  const pts = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: 0xffffff, size: 0.06, sizeAttenuation: true, transparent: true, opacity: 0.95 }))
  pts.raycast = () => {}; pts.frustumCulled = false; root.add(pts)
  root.userData.srv = { edges, pts, sig: '' }
  SR_LIVE.add(root); return root
}
export function applyStoredRealityLook (mesh, sr) {
  const v = mesh?.userData?.srv; if (!v || !sr) return false
  const sig = [sr.state, sr.scale, sr.preview.count, sr.preview.points.length, sr.preview.points[0]?.join(',') ?? ''].join('|'); if (sig === v.sig) return false
  v.sig = sig
  mesh.scale.setScalar(sr.scale)
  const stored = sr.state === 'stored'
  mesh.material.opacity = stored ? 0.16 : 0.03; v.edges.material.opacity = stored ? 0.85 : 0.45
  const arr = new Float32Array(sr.preview.points.length * 3)
  sr.preview.points.forEach((p, i) => { arr[i * 3] = (p[0] - 0.5) * 0.84; arr[i * 3 + 1] = (p[1] - 0.5) * 0.84; arr[i * 3 + 2] = (p[2] - 0.5) * 0.84 })
  v.pts.geometry.dispose(); v.pts.geometry = new THREE.BufferGeometry(); v.pts.geometry.setAttribute('position', new THREE.BufferAttribute(arr, 3))
  v.pts.visible = stored
  return true
}
export function releaseStoredRealityMesh (mesh) {
  const v = mesh?.userData?.srv; SR_LIVE.delete(mesh); if (!v) return
  try { v.pts.geometry.dispose(); v.pts.material.dispose(); v.edges.material.dispose(); mesh.material.dispose() } catch (_) { /* already gone */ }
}
