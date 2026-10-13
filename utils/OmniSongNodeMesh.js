/**
 * utils/OmniSongNodeMesh.js — the GEOMETRY of the SongNode (V198): a small record disc.
 *
 * The node mesh is a flat disc (a cylinder, so the node's normal raycast / selection / colour / move / StrictAlign work as for any node) carrying
 *   rings    ONE InstancedMesh of 4 rings x 24 segments of little blocks (one draw call, whatever the song): ring = one of the first four lanes, segment = a slice of
 *            the song length. A block is lit (in the lane's colour) when a clip of that lane covers its slice. While the song plays the segment at the song POSITION
 *            brightens in every ring, like a needle sweeping the record.
 *   label    the centre of the record; it turns while the song plays. A play triangle (idle) or a stop square (playing) floats above it.
 * The children are not hit-tested (OmniNode raycasts the node meshes non-recursively). Geometries are shared (never disposed with a node); each node owns its
 * materials and its InstancedMesh, which releaseSongMesh() disposes. No DOM, no storage, no audio here: the state is passed IN to reactSongMesh(), so it is testable
 * without the player and allocates NOTHING per frame (typed arrays, scratch colours, a code per block so an unchanged block is not touched).
 */

import * as THREE from 'three'

export const SEGS = 24
export const RINGS = 4
export const CELLS = SEGS * RINGS
const R0 = 0.34          // radius of the first (innermost) ring
const DR = 0.105         // ring pitch
export const SONG_LIVE = new Set()
export const liveSongMeshes = () => SONG_LIVE

const G = {}
function shared () {
  if (G.disc) return G
  G.disc = new THREE.CylinderGeometry(0.86, 0.86, 0.1, 40)
  G.label = new THREE.CylinderGeometry(0.2, 0.2, 0.04, 20)
  G.cell = new THREE.BoxGeometry(0.075, 0.03, 0.062)
  const tri = new THREE.Shape(); tri.moveTo(-0.07, -0.1); tri.lineTo(0.11, 0); tri.lineTo(-0.07, 0.1); tri.closePath()
  G.play = new THREE.ShapeGeometry(tri)
  G.stop = new THREE.PlaneGeometry(0.16, 0.16)
  return G
}

const SCR = new THREE.Color(); const OFF = new THREE.Color(0.06, 0.07, 0.1); const OFF_BEAT = new THREE.Color(0.1, 0.11, 0.15)
const WHITE = new THREE.Color(1, 1, 1)
const DUMMY = new THREE.Object3D()
const HEX = /^#[0-9a-fA-F]{6}$/

/** Build the SongNode mesh (disc + rings + label + glyphs). `color` is the node's colour. Never throws. */
export function buildSongNodeMesh (color) {
  const g = shared()
  const col = new THREE.Color(color ?? 0x7ad7f0)
  const disc = new THREE.Mesh(g.disc, new THREE.MeshStandardMaterial({ color: new THREE.Color(0x15171d), roughness: 0.35, metalness: 0.5, emissive: 0x05060a }))
  const cellMat = new THREE.MeshBasicMaterial({ color: 0xffffff })
  const cells = new THREE.InstancedMesh(g.cell, cellMat, CELLS)
  cells.raycast = () => {}
  cells.frustumCulled = false
  for (let r = 0; r < RINGS; r++) for (let c = 0; c < SEGS; c++) {
    const a = (c / SEGS) * Math.PI * 2
    const rad = R0 + r * DR
    DUMMY.position.set(Math.cos(a) * rad, 0.065, Math.sin(a) * rad)
    DUMMY.rotation.set(0, -a, 0); DUMMY.updateMatrix()
    cells.setMatrixAt(r * SEGS + c, DUMMY.matrix)
    cells.setColorAt(r * SEGS + c, c % 6 === 0 ? OFF_BEAT : OFF)
  }
  cells.instanceMatrix.needsUpdate = true
  if (cells.instanceColor) cells.instanceColor.needsUpdate = true
  const labelMat = new THREE.MeshStandardMaterial({ color: col.clone(), roughness: 0.5, metalness: 0.1, emissive: col.clone().multiplyScalar(0.25) })
  const label = new THREE.Mesh(g.label, labelMat); label.position.y = 0.07; label.raycast = () => {}
  const dot = new THREE.Mesh(g.stop, new THREE.MeshBasicMaterial({ color: 0x15171d })) // small spindle mark so the turning label is visible
  dot.geometry = g.stop; dot.scale.set(0.35, 0.35, 0.35); dot.rotation.x = -Math.PI / 2; dot.position.set(0.1, 0.095, 0); dot.raycast = () => {}
  label.add(dot)
  const mk = (geo, hex) => {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }))
    m.rotation.x = -Math.PI / 2; m.position.y = 0.5; m.raycast = () => {}
    return m
  }
  const playG = mk(g.play, col.getHex()); const stopG = mk(g.stop, col.getHex())
  stopG.visible = false
  disc.add(cells, label, playG, stopG)
  disc.userData.snv = {
    cells, cellMat, label, labelMat, dot, playG, stopG, tint: col.clone(),
    laneCol: Array.from({ length: RINGS }, () => new THREE.Color()),
    on: new Uint8Array(CELLS), code: new Int32Array(CELLS).fill(-1),
    ref: null, head: -2, glyph: -1, lanes: 0,
  }
  SONG_LIVE.add(disc)
  return disc
}

/** Which blocks are on (and the ring colours), from the sanitized song (only when it is a different object than last time). */
function rebuild (v, song) {
  v.ref = song
  v.on.fill(0)
  v.lanes = 0
  const lanes = song?.lanes; const clips = song?.clips
  const len = Math.max(1, Number(song?.lengthBars) || 32)
  if (!Array.isArray(lanes)) { v.code.fill(-1); return }
  const n = Math.min(RINGS, lanes.length); v.lanes = n
  for (let r = 0; r < RINGS; r++) {
    const c = lanes[r]?.color
    if (typeof c === 'string' && HEX.test(c)) v.laneCol[r].set(c); else v.laneCol[r].copy(v.tint)
  }
  if (Array.isArray(clips)) {
    for (let i = 0; i < clips.length; i++) {
      const k = clips[i]; if (!k) continue
      let r = -1
      for (let j = 0; j < n; j++) if (lanes[j].id === k.lane) { r = j; break }
      if (r < 0) continue
      const a = Math.max(0, Math.floor(((Number(k.startBar) || 1) - 1) / len * SEGS))
      const b = Math.min(SEGS - 1, Math.ceil(((Number(k.startBar) || 1) - 1 + (Number(k.lengthBars) || 1)) / len * SEGS) - 1)
      for (let c = a; c <= b; c++) v.on[r * SEGS + c] = 1
    }
  }
  v.code.fill(-1)
}

/**
 * Per frame. `song` is the sanitized song (a new object when it was edited), `frac` the song position 0..1 (or -1 when stopped), `playing` bool.
 * Allocates nothing; only the blocks whose look changed are written.
 */
export function reactSongMesh (mesh, song, frac, playing, dt) {
  const v = mesh?.userData?.snv; if (!v) return
  let stale = v.head === -2
  if (v.ref !== song) { rebuild(v, song); stale = true }
  const head = playing && frac >= 0 ? Math.min(SEGS - 1, Math.floor(frac * SEGS)) : -1
  const glyph = playing ? 1 : 0
  if (glyph !== v.glyph) { v.glyph = glyph; v.playG.visible = glyph === 0; v.stopG.visible = glyph === 1 }
  if (playing) v.label.rotation.y -= (dt > 0 ? dt : 0.016) * 1.6
  if (!stale && head === v.head) return
  const ic = v.cells.instanceColor
  let dirty = false
  for (let i = 0; i < CELLS; i++) {
    const c = i % SEGS; const r = (i / SEGS) | 0
    const isHead = c === head ? 1 : 0
    const code = (v.on[i] ? 1 : 0) + isHead * 2 + (c % 6 === 0 ? 4 : 0)
    if (code === v.code[i]) continue
    v.code[i] = code
    if (v.on[i]) { SCR.copy(v.laneCol[r]).multiplyScalar(0.7); if (isHead) SCR.lerp(WHITE, 0.6) }
    else { SCR.copy(c % 6 === 0 ? OFF_BEAT : OFF); if (isHead) SCR.lerp(v.tint, 0.45) }
    v.cells.setColorAt(i, SCR)
    dirty = true
  }
  v.head = head
  if (dirty && ic) ic.needsUpdate = true
}

/** Dispose the per-node materials / instanced buffers and forget the mesh. Idempotent. The disc material is disposed by OmniNode with the node. */
export function releaseSongMesh (mesh) {
  const v = mesh?.userData?.snv; if (!v) { SONG_LIVE.delete(mesh); return }
  try { v.cellMat.dispose(); v.cells.dispose?.(); v.labelMat.dispose(); v.dot.material.dispose(); v.playG.material.dispose(); v.stopG.material.dispose() } catch (_) { /* already gone */ }
  delete mesh.userData.snv
  SONG_LIVE.delete(mesh)
}
