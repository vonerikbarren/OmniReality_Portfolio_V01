/**
 * utils/OmniPolyNodeMesh.js (V204) — the GEOMETRY of the PolyNode: a solid / plane / strip / ring of regular faces, every face with its own colour and picture.
 *
 * ONE merged mesh, ONE material (a single MeshStandardMaterial: selection highlight, colour and move work as for any node) and ONE texture atlas for all faces:
 *   - flat shading, non-indexed; every face is a triangle fan; the BACK of every face is a second, reversed fan with its u mirrored, so a face reads correctly from both sides (double-sided, FrontSide material: no z-fight);
 *   - `vertex colour` = the tint of the face (white = the node colour); a hole (hidden face) has no triangles at all;
 *   - the atlas is a grid of square cells (one per face) on one 2D canvas; a face with no picture samples a plain white cell. The atlas is uploaded only when a face is (re)drawn, a new texture is made only when its SIZE changes;
 *   - a mesh whose atlas is not drawn (far, off screen, over budget) has NO texture and a 1x1 canvas: just coloured faces. No extra WebGL context, no CSS3D.
 * mesh.userData.pnv = { shape, triFace, grid, canvas, tex, texW, texH, cell, sig, drawn:{key,cell} }. The face of a picked triangle: faceAt(mesh, hit.faceIndex).
 */
import * as THREE from 'three'
import { buildShape, faceUV } from './OmniPolyGeom.js'

export const POLY_LIVE = new Set()
export const livePolyMeshes = () => POLY_LIVE
const INSET = 1 / 48          // keep each face's picture away from the cell border (no bleeding between cells)

export const gridFor = (n) => { const cols = Math.max(1, Math.ceil(Math.sqrt(Math.max(1, n)))); return { cols, rows: Math.max(1, Math.ceil(Math.max(1, n) / cols)) } }
/** Signature of everything that decides the triangles and their colours (not the pictures). */
export function geometrySig (poly) { return JSON.stringify([poly.shape, poly.sides, poly.count, poly.fold, poly.edge, poly.faces.map(f => (f.hidden ? 'x' : f.color))]) }

/** Build the merged double-sided geometry of a poly. Returns { geometry, triFace, grid, shape }. Never throws (a broken poly gives an empty geometry). */
export function buildPolyGeometry (poly) {
  const shape = buildShape(poly)
  const n = Math.min(shape.faces.length, poly.faces.length)
  const grid = gridFor(n)
  const pos = []; const nor = []; const uv = []; const col = []; const triFace = []
  const white = new THREE.Color('#ffffff')
  for (let i = 0; i < n; i++) {
    const f = shape.faces[i]; const pf = poly.faces[i]
    if (pf.hidden || f.verts.length < 3) continue
    const c = pf.color ? new THREE.Color(pf.color) : white
    const cx = i % grid.cols; const cy = Math.floor(i / grid.cols)
    // canvas row 0 is the TOP of the picture; flipY puts it up, so a cell at canvas row cy sits at v = 1 - (cy + 1) / rows
    const cell = (u, v) => [(cx + INSET + u * (1 - 2 * INSET)) / grid.cols, 1 - (cy + 1 - INSET - v * (1 - 2 * INSET)) / grid.rows]
    const pts = f.verts.map(p => ({ p, uv: faceUV(f, p) }))
    for (let k = 1; k < pts.length - 1; k++) {
      const tri = [pts[0], pts[k], pts[k + 1]]
      for (const t of tri) { pos.push(...t.p); nor.push(...f.normal); uv.push(...cell(t.uv[0], t.uv[1])); col.push(c.r, c.g, c.b) }
      triFace.push(i)
    }
    for (let k = 1; k < pts.length - 1; k++) {
      const tri = [pts[0], pts[k + 1], pts[k]]
      for (const t of tri) { pos.push(...t.p); nor.push(-f.normal[0], -f.normal[1], -f.normal[2]); uv.push(...cell(1 - t.uv[0], t.uv[1])); col.push(c.r, c.g, c.b) }
      triFace.push(i)
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  if (pos.length) geometry.computeBoundingSphere()
  return { geometry, triFace: Int32Array.from(triFace), grid, shape }
}

/** Build a poly node mesh. `color` is the node colour. Never throws. */
export function buildPolyNodeMesh (color, poly) {
  const col = new THREE.Color(color ?? 0x9ad0ff)
  const built = buildPolyGeometry(poly)
  const mat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.55, metalness: 0.15, vertexColors: true, flatShading: true })
  const mesh = new THREE.Mesh(built.geometry, mat)
  const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null
  if (canvas) { canvas.width = 1; canvas.height = 1 }
  mesh.userData.pnv = { shape: built.shape, triFace: built.triFace, grid: built.grid, canvas, tex: null, texW: 0, texH: 0, cell: 0, sig: geometrySig(poly), drawn: { key: '', cell: 0 }, faceCount: poly.faces.length }
  POLY_LIVE.add(mesh)
  return mesh
}

/** Rebuild the geometry when the shape / holes / face colours changed. Returns true when it did (the atlas then needs a redraw). */
export function applyPolyLook (mesh, poly) {
  const v = mesh?.userData?.pnv; if (!v || !poly) return false
  const sig = geometrySig(poly)
  if (sig === v.sig) return false
  const built = buildPolyGeometry(poly)
  const old = mesh.geometry; mesh.geometry = built.geometry; old?.dispose?.()
  v.shape = built.shape; v.triFace = built.triFace; v.grid = built.grid; v.sig = sig; v.faceCount = poly.faces.length
  v.drawn = { key: '', cell: 0 }          // UVs moved: the atlas must be drawn again
  return true
}

/** Which face owns a triangle (a raycast hit's faceIndex)? -1 when unknown. */
export function faceAt (mesh, triangleIndex) {
  const t = mesh?.userData?.pnv?.triFace; if (!t || !(triangleIndex >= 0) || triangleIndex >= t.length) return -1
  return t[triangleIndex]
}

/** Size the atlas canvas for a cell size (pixels per face). Returns the canvas, or null when there is none (no document, tests). */
export function sizeAtlas (mesh, cell) {
  const v = mesh?.userData?.pnv; if (!v?.canvas) return null
  v.canvas.width = Math.max(4, v.grid.cols * cell); v.canvas.height = Math.max(4, v.grid.rows * cell); v.cell = cell
  return v.canvas
}

/** The atlas was (re)drawn: upload it. Same size = just flagged, a different size gets a NEW texture (an uploaded one cannot be resized). Returns true when a new texture was made. */
export function setAtlas (mesh) {
  const v = mesh?.userData?.pnv; if (!v?.canvas) return false
  const w = v.canvas.width; const h = v.canvas.height
  if (w < 4 || h < 4) return false
  const mat = mesh.material; let fresh = false
  if (!v.tex || v.texW !== w || v.texH !== h) {
    v.tex?.dispose?.()
    const t = new THREE.CanvasTexture(v.canvas)
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.generateMipmaps = true
    t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter
    v.tex = t; v.texW = w; v.texH = h; fresh = true
    mat.map = t; mat.needsUpdate = true
  } else v.tex.needsUpdate = true
  return fresh
}

/** Drop the texture and shrink the canvas: back to plain coloured faces. Idempotent. */
export function clearAtlas (mesh) {
  const v = mesh?.userData?.pnv; if (!v) return
  if (v.tex) { v.tex.dispose?.(); v.tex = null; v.texW = 0; v.texH = 0 }
  if (mesh.material?.map) { mesh.material.map = null; mesh.material.needsUpdate = true }
  if (v.canvas) { v.canvas.width = 1; v.canvas.height = 1 }
  v.cell = 0; v.drawn = { key: '', cell: 0 }
}

/** Dispose the per-node GPU resources and forget the mesh. Idempotent. */
export function releasePolyMesh (mesh) {
  const v = mesh?.userData?.pnv; if (!v) { POLY_LIVE.delete(mesh); return }
  try { v.tex?.dispose?.(); mesh.material?.dispose?.(); mesh.geometry?.dispose?.() } catch (_) { /* already gone */ }
  if (v.canvas) { v.canvas.width = 1; v.canvas.height = 1 }
  delete mesh.userData.pnv
  POLY_LIVE.delete(mesh)
}
