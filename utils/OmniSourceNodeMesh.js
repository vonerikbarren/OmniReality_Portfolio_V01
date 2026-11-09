/**
 * utils/OmniSourceNodeMesh.js (V281) — the GEOMETRY of a SourceNode: a small closed book (a slab with a darker spine edge). Colour follows trust (warm = doubtful, green = solid);
 * a dead or retracted source turns grey and wire-framed, a moved or paywalled one is dimmer. Geometries are shared; each node owns its materials (releaseSourceMesh).
 */
import * as THREE from 'three'
import { effectiveTrust, sanitizeSource } from './OmniSourceModel.js'

export const SRC_LIVE = new Set()
const G = {}
const shared = () => { if (G.book) return G; G.book = new THREE.BoxGeometry(0.62, 0.84, 0.2); G.spine = new THREE.BoxGeometry(0.08, 0.86, 0.22); return G }
export function buildSourceNodeMesh () {
  const g = shared()
  const root = new THREE.Mesh(g.book, new THREE.MeshStandardMaterial({ color: '#c9b27a', roughness: 0.6, metalness: 0.05, emissive: '#c9b27a', emissiveIntensity: 0.12, transparent: true }))
  const spine = new THREE.Mesh(g.spine, new THREE.MeshStandardMaterial({ color: '#6b5a33', roughness: 0.7 }))
  spine.position.set(-0.27, 0, 0); spine.raycast = () => {}; root.add(spine)
  root.userData.srcv = { spine, sig: '' }
  SRC_LIVE.add(root); return root
}
const A = new THREE.Color(), B = new THREE.Color(), OUT = new THREE.Color()
/** colour of a source from its effective trust: 0 = warm red-brown, 1 = green */
export function trustColor (t) { A.set('#d98a5f'); B.set('#8fcf9a'); return '#' + OUT.copy(A).lerp(B, Math.min(1, Math.max(0, Number(t) || 0))).getHexString() }
export function applySourceLook (mesh, raw) {
  const v = mesh?.userData?.srcv; if (!v) return false
  const s = sanitizeSource(raw); const dead = s.status === 'dead' || s.status === 'retracted'
  const col = dead ? '#8a8f98' : trustColor(effectiveTrust(s)); const op = dead ? 0.55 : (s.status === 'live' ? 1 : 0.8)
  const sig = col + '|' + op + '|' + (dead ? 1 : 0); if (sig === v.sig) return false
  v.sig = sig; const m = mesh.material; m.color.set(col); m.emissive.set(col); m.opacity = op; m.wireframe = dead; m.depthWrite = op > 0.9; m.needsUpdate = true
  return true
}
export function releaseSourceMesh (mesh) {
  const v = mesh?.userData?.srcv; SRC_LIVE.delete(mesh); if (!v) return
  try { v.spine.material.dispose(); mesh.material.dispose() } catch (_) { /* already gone */ }
}
