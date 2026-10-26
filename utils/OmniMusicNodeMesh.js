/**
 * utils/OmniMusicNodeMesh.js — the GEOMETRY of the MusicNode (V195): a small drum-machine plate.
 *
 * The node mesh is a flat plate (a box, so the node's normal raycast / selection / colour / move / StrictAlign work as for any node) carrying
 *   cells     ONE InstancedMesh of 4 rows x 16 columns of little blocks (one draw call, whatever the pattern): row = one of the first four tracks,
 *             column = a slice of the pattern (16 columns whatever the length). A block is lit when its slice has a note on that track. The PLAYHEAD column
 *             brightens while the transport runs, and a block FLASHES when the sequencer plays a note on it (omni:music-step -> flashNote).
 *   glyph     a play triangle (idle), a stop square (playing) or a red dot (recording / counting in), above the plate.
 * The children are not hit-tested (OmniNode raycasts the node meshes non-recursively). Geometries are shared (never disposed with a node); each node owns its
 * materials and its InstancedMesh, which releaseMusicMesh() disposes. No DOM, no storage, no audio here: the state is passed IN to reactMusicMesh(), so it is
 * testable without the sequencer and it allocates NOTHING per frame (typed arrays, scratch colours, a code per cell so an unchanged cell is not touched).
 */

import * as THREE from 'three'

export const COLS = 16
export const ROWS = 4
export const CELLS = COLS * ROWS
const PITCH_X = 0.092
const PITCH_Z = 0.2
export const MUSIC_LIVE = new Set()
export const liveMusicMeshes = () => MUSIC_LIVE

const G = {}
function shared () {
  if (G.plate) return G
  G.plate = new THREE.BoxGeometry(1.6, 0.14, 1.04)
  G.cell = new THREE.BoxGeometry(0.075, 0.05, 0.165)
  const tri = new THREE.Shape(); tri.moveTo(-0.08, -0.11); tri.lineTo(0.12, 0); tri.lineTo(-0.08, 0.11); tri.closePath()
  G.play = new THREE.ShapeGeometry(tri)
  G.stop = new THREE.PlaneGeometry(0.18, 0.18)
  G.rec = new THREE.CircleGeometry(0.1, 20)
  return G
}

const SCR = new THREE.Color(); const OFF = new THREE.Color(0.07, 0.08, 0.11); const OFF_BEAT = new THREE.Color(0.12, 0.13, 0.17)
const WHITE = new THREE.Color(1, 1, 1)
const DUMMY = new THREE.Object3D()

/** Build the MusicNode mesh (plate + cells + glyphs). `color` is the node's colour. Never throws. */
export function buildMusicNodeMesh (color) {
  const g = shared()
  const col = new THREE.Color(color ?? 0xffb86b)
  const plate = new THREE.Mesh(g.plate, new THREE.MeshStandardMaterial({ color: new THREE.Color(0x20232c), roughness: 0.55, metalness: 0.35, emissive: 0x07080b }))
  const cellMat = new THREE.MeshBasicMaterial({ color: 0xffffff })
  const cells = new THREE.InstancedMesh(g.cell, cellMat, CELLS)
  cells.raycast = () => {}
  cells.frustumCulled = false
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    DUMMY.position.set((c - (COLS - 1) / 2) * PITCH_X, 0.095, (r - (ROWS - 1) / 2) * PITCH_Z)
    DUMMY.updateMatrix()
    cells.setMatrixAt(r * COLS + c, DUMMY.matrix)
    cells.setColorAt(r * COLS + c, c % 4 === 0 ? OFF_BEAT : OFF)
  }
  cells.instanceMatrix.needsUpdate = true
  if (cells.instanceColor) cells.instanceColor.needsUpdate = true
  const mk = (geo, hex, rotX) => {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }))
    m.rotation.x = rotX; m.position.y = 0.55; m.raycast = () => {}
    return m
  }
  const playG = mk(g.play, col.getHex(), 0); const stopG = mk(g.stop, col.getHex(), 0); const recG = mk(g.rec, 0xff4d4d, 0)
  stopG.visible = false; recG.visible = false
  plate.add(cells, playG, stopG, recG)
  plate.userData.mnv = {
    cells, cellMat, playG, stopG, recG, tint: col.clone(),
    on: new Uint8Array(CELLS), flash: new Float32Array(CELLS), code: new Int16Array(CELLS).fill(-1),
    ref: null, head: -1, glyph: -1, t: 0,
  }
  MUSIC_LIVE.add(plate)
  return plate
}

/** Which cell lights are on, from the sanitized music (only when it is a different object than last time). */
function rebuild (v, music) {
  v.ref = music
  v.on.fill(0)
  const total = Math.max(1, (music?.stepsPerBar | 0) * (music?.bars | 0)) || 16
  const tracks = music?.tracks
  if (!Array.isArray(tracks)) { v.total = total; return }
  for (let r = 0; r < ROWS && r < tracks.length; r++) {
    const steps = tracks[r].steps
    for (let i = 0; i < steps.length; i++) {
      const c = Math.min(COLS - 1, Math.floor(steps[i].step * COLS / total))
      v.on[r * COLS + c] = 1
    }
  }
  v.total = total
  v.code.fill(-1)
}

/** A note was played on track row `row` at `step` of `total`: flash that block. Safe with anything. */
export function flashNote (mesh, row, step, total) {
  const v = mesh?.userData?.mnv; if (!v || !(row >= 0) || row >= ROWS) return false
  const c = Math.min(COLS - 1, Math.max(0, Math.floor(step * COLS / Math.max(1, total))))
  v.flash[row * COLS + c] = 1
  return true
}

/**
 * Per frame. `music` is the sanitized music (a new object when it was edited), `step` the playing step or -1, `state` 0 stopped / 1 playing / 2 recording / 3 counting in.
 * Allocates nothing; only the blocks whose look changed are written.
 */
export function reactMusicMesh (mesh, music, step, state, dt) {
  const v = mesh?.userData?.mnv; if (!v) return
  if (v.ref !== music) rebuild(v, music)
  const total = v.total || 16
  const headCol = step >= 0 && state > 0 && state < 3 ? Math.min(COLS - 1, Math.floor(step * COLS / total)) : -1
  const decay = Math.min(1, (dt > 0 ? dt : 0.016) * 4.5)
  const glyph = state === 0 ? 0 : state === 1 ? 1 : 2
  if (glyph !== v.glyph) { v.glyph = glyph; v.playG.visible = glyph === 0; v.stopG.visible = glyph === 1; v.recG.visible = glyph === 2 }
  let dirty = false
  const ic = v.cells.instanceColor
  for (let i = 0; i < CELLS; i++) {
    let f = v.flash[i]
    if (f > 0) { f -= decay; if (f < 0.02) f = 0; v.flash[i] = f }
    const c = i % COLS
    const head = c === headCol ? 1 : 0
    const fq = (f * 6) | 0
    const code = (v.on[i] ? 1 : 0) + head * 2 + (c % 4 === 0 ? 4 : 0) + fq * 8
    if (code === v.code[i]) continue
    v.code[i] = code
    if (v.on[i]) { SCR.copy(v.tint).multiplyScalar(0.62); if (head) SCR.lerp(WHITE, 0.55); SCR.lerp(WHITE, f * 0.8) }
    else { SCR.copy(c % 4 === 0 ? OFF_BEAT : OFF); if (head) SCR.lerp(v.tint, 0.4); SCR.lerp(v.tint, f * 0.5) }
    v.cells.setColorAt(i, SCR)
    dirty = true
  }
  if (dirty && ic) ic.needsUpdate = true
}

/** Dispose the per-node materials / instanced buffers and forget the mesh. Idempotent. The plate material is disposed by OmniNode with the node. */
export function releaseMusicMesh (mesh) {
  const v = mesh?.userData?.mnv; if (!v) { MUSIC_LIVE.delete(mesh); return }
  try { v.cellMat.dispose(); v.cells.dispose?.(); v.playG.material.dispose(); v.stopG.material.dispose(); v.recG.material.dispose() } catch (_) { /* already gone */ }
  delete mesh.userData.mnv
  MUSIC_LIVE.delete(mesh)
}
