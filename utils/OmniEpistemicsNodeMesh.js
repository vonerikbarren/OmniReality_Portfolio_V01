/**
 * utils/OmniEpistemicsNodeMesh.js (V271) — the GEOMETRY of an OmniEpistemicsNode. The root is an invisible sphere that takes the clicks (so the hit area never changes);
 * the visible FORM is a child that follows the layer: a SPHERE (alike in kind), a CUBE with edges (a container with limited faces), or a hollow WIRE cube (absence).
 * applyEpistemicsLook(mesh, look) takes the result of visualOf() (shape, opacity, size, glow, ghost, color). Geometries are shared; each node owns its materials (releaseEpistemicsMesh).
 * No DOM, no clock, no allocation per call beyond setting numbers.
 */
import * as THREE from 'three'

export const EPI_LIVE = new Set()
const G = {}
function shared () {
  if (G.sphere) return G
  G.sphere = new THREE.SphereGeometry(0.5, 24, 16)
  G.box = new THREE.BoxGeometry(0.85, 0.85, 0.85)
  G.edges = new THREE.EdgesGeometry(G.box)
  G.hit = new THREE.SphereGeometry(0.62, 12, 8)
  return G
}
export function buildEpistemicsNodeMesh (color) {
  const g = shared(); const col = new THREE.Color(color ?? 0x9be3a8)
  const root = new THREE.Mesh(g.hit, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }))
  const form = new THREE.Mesh(g.sphere, new THREE.MeshStandardMaterial({ color: col, roughness: 0.45, metalness: 0.1, emissive: col.clone(), emissiveIntensity: 0.1, transparent: true }))
  const edges = new THREE.LineSegments(g.edges, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 }))
  form.raycast = () => {}; edges.raycast = () => {}; edges.visible = false
  form.add(edges); root.add(form)
  root.userData.epv = { form, edges, shape: 'sphere', sig: '' }
  EPI_LIVE.add(root); return root
}
const SCR = new THREE.Color()
export function applyEpistemicsLook (mesh, look) {
  const v = mesh?.userData?.epv; if (!v || !look) return false
  const sig = [look.shape, look.opacity, look.size, look.glow, look.wire ? 1 : 0, look.ghost ? 1 : 0, look.color].join('|'); if (sig === v.sig) return false
  v.sig = sig; const g = shared(); const cube = look.shape === 'cube' || look.shape === 'hollow'
  if (v.shape !== look.shape) { v.form.geometry = cube ? g.box : g.sphere; v.shape = look.shape }
  v.edges.visible = cube; v.edges.material.opacity = look.wire ? 0.95 : 0.7
  const m = v.form.material; SCR.set(look.color || '#ffffff')
  m.color.copy(SCR); m.emissive.copy(SCR); m.emissiveIntensity = 0.1 + 0.9 * (Number.isFinite(look.glow) ? look.glow : 0)
  m.wireframe = !!look.wire; m.opacity = Math.min(1, Math.max(0.05, look.opacity)); m.depthWrite = look.opacity > 0.9 && !look.ghost; m.needsUpdate = true
  const s = Number.isFinite(look.size) ? look.size : 1; v.form.scale.setScalar(s)
  return true
}
export function releaseEpistemicsMesh (mesh) {
  const v = mesh?.userData?.epv; EPI_LIVE.delete(mesh); if (!v) return
  try { v.form.material.dispose(); v.edges.material.dispose(); mesh.material.dispose() } catch (_) { /* already gone */ }
}
