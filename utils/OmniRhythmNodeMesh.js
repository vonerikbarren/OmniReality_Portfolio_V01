/**
 * utils/OmniRhythmNodeMesh.js (V270) — the GEOMETRY of the RhythmNode (V272: a geometry, no longer a drum): a glassy octahedron with a bright core that swells on every beat, and a ring of up to 32 little blocks
 * round its middle (one InstancedMesh, one draw call): a block is lit by its accent (soft / strong), the PLAYHEAD block is white, and a block flashes when its beat fires.
 * The children are not hit-tested. Geometries are shared; each node owns its materials and its InstancedMesh (releaseRhythmMesh disposes them). No DOM, no audio: the state is
 * passed IN to reactRhythmMesh(), which allocates nothing per frame and writes only the blocks that changed.
 */
import * as THREE from 'three'

export const MAX_CELLS = 32
export const RHYTHM_LIVE = new Set()
const G = {}
function shared () {
  if (G.body) return G
  G.body = new THREE.OctahedronGeometry(0.5)
  G.skin = new THREE.OctahedronGeometry(0.27)
  G.cell = new THREE.BoxGeometry(0.1, 0.07, 0.07)
  return G
}
const OFF = new THREE.Color(0.08, 0.09, 0.13), SOFT = new THREE.Color(0.9, 0.55, 0.25), HARD = new THREE.Color(1, 0.85, 0.35), HEAD = new THREE.Color(1, 1, 1)
const SCR = new THREE.Color(); const DUMMY = new THREE.Object3D()

export function buildRhythmNodeMesh (color) {
  const g = shared(); const col = new THREE.Color(color ?? 0xff9ad2)
  const body = new THREE.Mesh(g.body, new THREE.MeshStandardMaterial({ color: new THREE.Color(0x2a2e3c), roughness: 0.25, metalness: 0.3, emissive: 0x07080b, transparent: true, opacity: 0.4, depthWrite: false }))
  const skin = new THREE.Mesh(g.skin, new THREE.MeshStandardMaterial({ color: col, roughness: 0.4, metalness: 0.1, emissive: col.clone().multiplyScalar(0.25) }))
  skin.raycast = () => {}
  const cells = new THREE.InstancedMesh(g.cell, new THREE.MeshBasicMaterial({ color: 0xffffff }), MAX_CELLS)
  cells.raycast = () => {}; cells.frustumCulled = false
  for (let i = 0; i < MAX_CELLS; i++) { cells.setMatrixAt(i, DUMMY.matrix.identity()); cells.setColorAt(i, OFF) }
  cells.instanceMatrix.needsUpdate = true
  body.add(skin, cells)
  body.userData.rnv = { skin, cells, tint: col.clone(), n: 0, ref: null, code: new Int16Array(MAX_CELLS).fill(-1), flash: new Float32Array(MAX_CELLS), pulse: 0, head: -1 }
  RHYTHM_LIVE.add(body); return body
}
function layout (v, n) {
  v.n = n
  for (let i = 0; i < MAX_CELLS; i++) {
    if (i >= n) { DUMMY.position.set(0, -50, 0); DUMMY.scale.setScalar(0.0001) } else { const a = (i / n) * Math.PI * 2 - Math.PI / 2; DUMMY.position.set(Math.cos(a) * 0.78, 0, Math.sin(a) * 0.78); DUMMY.scale.setScalar(1); DUMMY.rotation.set(0, -a, 0) }
    DUMMY.updateMatrix(); v.cells.setMatrixAt(i, DUMMY.matrix)
  }
  v.cells.instanceMatrix.needsUpdate = true; v.code.fill(-1)
}
/** a beat fired at `step` with `accent` */
export function beatMesh (mesh, step, accent) { const v = mesh?.userData?.rnv; if (!v) return false; v.pulse = Math.max(v.pulse, 0.4 + 0.6 * Math.min(1, accent || 1)); if (step >= 0 && step < MAX_CELLS) v.flash[step] = 1; return true }
/** per frame: steps = the accent array, head = the step last played (or -1), running = bool */
export function reactRhythmMesh (mesh, steps, head, running, dt) {
  const v = mesh?.userData?.rnv; if (!v) return
  const n = Math.min(MAX_CELLS, steps?.length || 16)
  if (v.ref !== steps || v.n !== n) { v.ref = steps; if (v.n !== n) layout(v, n); v.code.fill(-1) }
  const k = Math.min(1, (dt > 0 ? dt : 0.016) * 6)
  v.pulse = v.pulse > 0.002 ? v.pulse - v.pulse * k : 0
  const s = 1 + v.pulse * 0.18; v.skin.scale.set(s, 1 + v.pulse * 0.6, s)
  v.skin.material.emissiveIntensity = 1 + v.pulse * 2.5
  let dirty = false
  for (let i = 0; i < n; i++) {
    const a = steps[i] || 0; const fl = v.flash[i] > 0.01 ? (v.flash[i] -= v.flash[i] * k, v.flash[i]) : (v.flash[i] = 0)
    const isHead = running && i === head
    const code = (isHead ? 1000 : 0) + Math.round(a * 10) * 10 + Math.round(fl * 9)
    if (v.code[i] === code) continue
    v.code[i] = code; dirty = true
    if (isHead) SCR.copy(HEAD); else if (a <= 0) SCR.copy(OFF); else SCR.copy(SOFT).lerp(HARD, a)
    if (!isHead && a > 0) SCR.multiplyScalar(0.45 + 0.55 * a)
    if (fl > 0) SCR.lerp(HEAD, fl)
    v.cells.setColorAt(i, SCR)
  }
  if (dirty && v.cells.instanceColor) v.cells.instanceColor.needsUpdate = true
}
export function releaseRhythmMesh (mesh) {
  const v = mesh?.userData?.rnv; if (!v) return
  RHYTHM_LIVE.delete(mesh); try { v.cells.dispose?.(); v.cells.material?.dispose?.(); v.skin.material?.dispose?.(); mesh.material?.dispose?.() } catch (_) { /* already gone */ }
  delete mesh.userData.rnv
}
