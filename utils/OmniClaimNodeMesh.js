/**
 * utils/OmniClaimNodeMesh.js (V260) — the GEOMETRY of the ClaimNode: a core sphere (the claim, tinted with the blend of its shares) inside a flat GAUGE RING cut into
 * three arcs in proportion to the shares: green TRUE, red FALSE, yellow UNDEFINED (white / black / grey once the claim is objective). A sealed (private) claim that is
 * not unlocked shows a plain grey ring and a small padlock block instead, and tells nothing. Only the core is pickable. Arcs are rebuilt only when the shares change.
 */
import * as THREE from 'three'
import { NODE_COLOR } from './OmniClaimModel.js'
const noRay = (o) => { o.raycast = () => {} }
const rgb = (a) => new THREE.Color(a[0] / 255, a[1] / 255, a[2] / 255)
export const R_IN = 0.86; export const R_OUT = 1.12

export function buildClaimNodeMesh (color) {
  const col = new THREE.Color(color ?? 0x9ad0ff)
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.56, 24, 16), new THREE.MeshStandardMaterial({ color: col, roughness: 0.4, metalness: 0.25, emissive: col.clone().multiplyScalar(0.25) }))
  const arcs = ['truth', 'false', 'undefined'].map(k => { const m = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: rgb(NODE_COLOR[k]), side: THREE.DoubleSide, toneMapped: false })); m.name = 'omni-claim-arc-' + k; noRay(m); core.add(m); return m })
  const lock = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.26, 0.2), new THREE.MeshStandardMaterial({ color: 0x9aa4b0, roughness: 0.5, metalness: 0.6 })); lock.position.set(0, 0, 0); lock.name = 'omni-claim-lock'; lock.visible = false; noRay(lock)
  const shackle = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.035, 8, 16, Math.PI), lock.material); shackle.position.set(0, 0.13, 0); noRay(shackle); lock.add(shackle)
  core.add(lock)
  core.userData.claimMesh = { core, arcs, lock, sig: '', tint: col }
  setClaimLook(core, { truth: 0, false: 0, undefined: 1, objective: false, sealed: false })
  return core
}
const arcGeo = (start, len) => (len < 1e-4 ? new THREE.BufferGeometry() : new THREE.RingGeometry(R_IN, R_OUT, Math.max(2, Math.ceil(len / (Math.PI * 2) * 64)), 1, start, len))
/** shares in 0..1 (they sum to 1). sealed = locked private claim (grey ring, padlock, no information). */
export function setClaimLook (mesh, { truth = 0, false: f = 0, undefined: u = 1, objective = false, sealed = false } = {}) {
  const c = mesh?.userData?.claimMesh; if (!c) return false
  const q = (v) => Math.round(Math.max(0, Math.min(1, v)) * 200) / 200
  const sig = sealed ? 'sealed' : [q(truth), q(f), q(u), objective].join()
  if (sig === c.sig) return false; c.sig = sig
  const pal = objective ? [NODE_COLOR.objectiveTruth, NODE_COLOR.objectiveFalse, NODE_COLOR.objectiveUndefined] : [NODE_COLOR.truth, NODE_COLOR.false, NODE_COLOR.undefined]
  c.lock.visible = !!sealed
  const shares = sealed ? [0, 0, 1] : [q(truth), q(f), 1 - q(truth) - q(f)]
  let a = Math.PI / 2; const TAU = Math.PI * 2
  c.arcs.forEach((m, i) => { m.geometry.dispose(); const len = Math.max(0, shares[i]) * TAU; m.geometry = arcGeo(a, len); a += len; m.material.color.copy(sealed ? new THREE.Color(0x6b7480) : rgb(pal[i])) })
  const blend = sealed ? new THREE.Color(0x6b7480) : new THREE.Color(0, 0, 0).add(rgb(pal[0]).multiplyScalar(shares[0])).add(rgb(pal[1]).multiplyScalar(shares[1])).add(rgb(pal[2]).multiplyScalar(shares[2]))
  c.core.material.color.copy(blend); c.core.material.emissive.copy(blend).multiplyScalar(0.3)
  return true
}
export function releaseClaimMesh (mesh) { const c = mesh?.userData?.claimMesh; if (!c) return; for (const m of c.arcs) { m.geometry.dispose(); m.material.dispose() } c.lock.geometry.dispose(); c.lock.children[0]?.geometry.dispose(); c.lock.material.dispose(); mesh.geometry.dispose(); mesh.material.dispose(); delete mesh.userData.claimMesh }
