/**
 * utils/OmniMixNodeMesh.js — the GEOMETRY of the OmniMusicMixNode (V201): a small mixing desk.
 *
 * A flat slab (a box, so selection / colour / move / StrictAlign work as for any node) with 8 fader caps in slots (ONE InstancedMesh: one draw call) and a crossfader cap along the
 * front edge. A cap sits where the strip's fader is (volume 0 = near edge, 1 = far edge) and takes the strip's colour; while the mix plays, a cap brightens with the strip's level.
 * Strips beyond 8 are not drawn. The state is passed IN to reactMixMesh() (no player, no DOM, no storage here), so it is testable and allocates NOTHING per frame.
 * Geometries are shared (never disposed with a node); each node owns its materials and InstancedMesh, which releaseMixMesh() disposes.
 */

import * as THREE from 'three'

export const CAPS = 8
export const MIX_LIVE = new Set()
export const liveMixMeshes = () => MIX_LIVE
const SLOT_W = 0.14      // x pitch of the faders
const TRAVEL = 0.62      // fader travel (z)
const HEX = /^#[0-9a-fA-F]{6}$/

const G = {}
function shared () {
  if (G.slab) return G
  G.slab = new THREE.BoxGeometry(1.34, 0.1, 1.0)
  G.slot = new THREE.BoxGeometry(0.03, 0.012, TRAVEL + 0.1)
  G.cap = new THREE.BoxGeometry(0.1, 0.05, 0.06)
  G.xslot = new THREE.BoxGeometry(0.62, 0.012, 0.03)
  G.xcap = new THREE.BoxGeometry(0.1, 0.05, 0.07)
  return G
}

const DUMMY = new THREE.Object3D()
const SCR = new THREE.Color(); const OFF = new THREE.Color(0.2, 0.22, 0.28)
const WHITE = new THREE.Color(1, 1, 1)
const capX = (i) => (i - (CAPS - 1) / 2) * SLOT_W

/** Build the mix node mesh. `color` is the node's colour. Never throws. */
export function buildMixNodeMesh (color) {
  const g = shared()
  const col = new THREE.Color(color ?? 0xffb35c)
  const slab = new THREE.Mesh(g.slab, new THREE.MeshStandardMaterial({ color: new THREE.Color(0x181a20), roughness: 0.4, metalness: 0.5, emissive: 0x050608 }))
  const slotMat = new THREE.MeshBasicMaterial({ color: 0x050608 })
  const slots = new THREE.InstancedMesh(g.slot, slotMat, CAPS)
  slots.raycast = () => {}; slots.frustumCulled = false
  for (let i = 0; i < CAPS; i++) { DUMMY.position.set(capX(i), 0.056, -0.04); DUMMY.rotation.set(0, 0, 0); DUMMY.updateMatrix(); slots.setMatrixAt(i, DUMMY.matrix) }
  slots.instanceMatrix.needsUpdate = true
  const capMat = new THREE.MeshBasicMaterial({ color: 0xffffff })
  const caps = new THREE.InstancedMesh(g.cap, capMat, CAPS)
  caps.raycast = () => {}; caps.frustumCulled = false
  for (let i = 0; i < CAPS; i++) { DUMMY.position.set(capX(i), 0.085, 0.27); DUMMY.updateMatrix(); caps.setMatrixAt(i, DUMMY.matrix); caps.setColorAt(i, OFF) }
  caps.instanceMatrix.needsUpdate = true
  if (caps.instanceColor) caps.instanceColor.needsUpdate = true
  const xslot = new THREE.Mesh(g.xslot, slotMat); xslot.position.set(0, 0.056, 0.42); xslot.raycast = () => {}
  const xcapMat = new THREE.MeshStandardMaterial({ color: col.clone(), roughness: 0.4, metalness: 0.2, emissive: col.clone().multiplyScalar(0.3) })
  const xcap = new THREE.Mesh(g.xcap, xcapMat); xcap.position.set(0, 0.085, 0.42); xcap.raycast = () => {}
  slab.add(slots, caps, xslot, xcap)
  slab.userData.mnv = {
    slots, slotMat, caps, capMat, xslot, xcap, xcapMat, tint: col.clone(),
    ref: null, level: new Float32Array(CAPS), code: new Int32Array(CAPS).fill(-1), xpos: 9, playing: -1,
  }
  MIX_LIVE.add(slab)
  return slab
}

/**
 * Per frame. `mix` is the sanitized mix (a new object when it was edited), `levels` the strip peaks { [id]: 0..1 } or null, `playing` bool.
 * Writes only the caps whose look changed. Allocates nothing.
 */
export function reactMixMesh (mesh, mix, levels, playing) {
  const v = mesh?.userData?.mnv; if (!v) return
  const strips = mix?.strips
  const n = Array.isArray(strips) ? Math.min(CAPS, strips.length) : 0
  const ic = v.caps.instanceColor
  let mdirty = false; let cdirty = false
  const fresh = v.ref !== mix
  v.ref = mix
  for (let i = 0; i < CAPS; i++) {
    const st = i < n ? strips[i] : null
    const vol = st ? Math.min(1, Math.max(0, Number(st.volume) || 0)) : 0
    const lv = st && playing && levels ? Math.min(1, Math.max(0, Number(levels[st.id]) || 0)) : 0
    const bucket = Math.round(lv * 6)
    const code = (st ? 1 : 0) + Math.round(vol * 40) * 2 + bucket * 100
    if (!fresh && code === v.code[i]) continue
    v.code[i] = code
    DUMMY.position.set(capX(i), 0.085, 0.27 - vol * TRAVEL + (st ? 0 : TRAVEL * 0.0)); DUMMY.rotation.set(0, 0, 0); DUMMY.updateMatrix()
    v.caps.setMatrixAt(i, DUMMY.matrix); mdirty = true
    if (st && typeof st.color === 'string' && HEX.test(st.color)) SCR.set(st.color); else SCR.copy(OFF)
    if (!st) SCR.copy(OFF)
    else SCR.multiplyScalar(0.55 + 0.45 * (bucket / 6)).lerp(WHITE, bucket / 6 * 0.5)
    v.caps.setColorAt(i, SCR); cdirty = true
  }
  if (mdirty) v.caps.instanceMatrix.needsUpdate = true
  if (cdirty && ic) ic.needsUpdate = true
  const xp = Math.round((Number(mix?.cross?.pos) || 0) * 20) / 20
  if (xp !== v.xpos) { v.xpos = xp; v.xcap.position.x = xp * 0.26 }
}

/** Dispose the per-node materials / instanced buffers and forget the mesh. Idempotent. The slab material is disposed by OmniNode with the node. */
export function releaseMixMesh (mesh) {
  const v = mesh?.userData?.mnv; if (!v) { MIX_LIVE.delete(mesh); return }
  try { v.slotMat.dispose(); v.capMat.dispose(); v.slots.dispose?.(); v.caps.dispose?.(); v.xcapMat.dispose() } catch (_) { /* already gone */ }
  delete mesh.userData.mnv
  MIX_LIVE.delete(mesh)
}
