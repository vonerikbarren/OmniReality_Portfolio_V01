/**
 * utils/OmniDocNodeMesh.js — the GEOMETRY of the DocNode (V203): a thin sheet that shows one page of a document.
 *
 * The sheet is a thin box (the root: selection / colour / move / StrictAlign work as for any node; its edges are the frame) with two flat planes on its faces that show the page (raycast off).
 * The page is a plain 2D canvas uploaded as a CanvasTexture on an UNLIT material (MeshBasicMaterial): no lights, no shadows, no extra WebGL context, no CSS3D, no iframe. Cost model:
 *   - a sheet that is not drawn (far away, off screen, over budget) has NO texture and a 1x1 canvas: just a paper-coloured box;
 *   - the texture is uploaded only when a page is (re)drawn, never per frame; a new texture is made only when its SIZE changes (an immutable GPU allocation cannot be resized);
 *   - the geometry is rebuilt only when the sheet width or aspect changes (rare), the old one disposed.
 * V206: a SPREAD (two pages side by side) makes the sheet twice as wide with the same height; ZOOM is a window on the texture (repeat / offset: no extra pixels, no redraw; the runtime asks for a sharper
 * texture when it zooms in, up to the texture limit), panned by panX / panY.
 * The page state is passed IN (setPageCanvas), so there is no document, storage or renderer code here.
 */

import * as THREE from 'three'

export const DOC_LIVE = new Set()
export const liveDocMeshes = () => DOC_LIVE
const DEPTH = 0.04
const HEX = /^#[0-9a-fA-F]{6}$/

/** Build a doc node mesh. `color` is the node's colour (the frame). Never throws. */
const dims = (doc) => {
  const k = doc?.spread === 'double' ? 2 : 1
  const w = Number(doc?.width) > 0 ? doc.width : 4; const a = Number(doc?.aspect) > 0 ? doc.aspect : 1.414
  return { width: w * k, aspect: a / k }
}

export function buildDocNodeMesh (color, doc = null) {
  const col = new THREE.Color(color ?? 0x9ad0ff)
  const { width, aspect } = dims(doc)
  const paper = typeof doc?.paper === 'string' && HEX.test(doc.paper) ? doc.paper : '#ffffff'
  // the ROOT is a thin box in the node's colour (selection highlight, picking, move, StrictAlign work as for any node); the page is two flat planes on its faces
  const edge = new THREE.MeshStandardMaterial({ color: col, roughness: 0.5, metalness: 0.2 })
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, width * aspect, DEPTH), edge)
  const mk = () => new THREE.MeshBasicMaterial({ color: new THREE.Color(paper), toneMapped: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })
  const front = mk(); const back = mk()
  const frontMesh = new THREE.Mesh(new THREE.PlaneGeometry(width, width * aspect), front)
  const backMesh = new THREE.Mesh(new THREE.PlaneGeometry(width, width * aspect), back)
  frontMesh.position.z = DEPTH / 2 + 0.002
  backMesh.position.z = -DEPTH / 2 - 0.002; backMesh.rotation.y = Math.PI
  frontMesh.raycast = () => {}; backMesh.raycast = () => {}
  mesh.add(frontMesh, backMesh)
  const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null
  if (canvas) { canvas.width = 1; canvas.height = 1 }
  mesh.userData.dnv = {
    edge, front, back, frontMesh, backMesh, canvas, tex: null, texW: 0, texH: 0, width, aspect, paper, sides: 'double', frame: true,
    drawn: { key: '', page: 0, step: 0, spread: 'single' }, tint: col.clone(), view: { zoom: 100, panX: 0, panY: 0 },
  }
  DOC_LIVE.add(mesh)
  return mesh
}

/** Apply the look of the doc (size, paper, sides, frame). Rebuilds the geometry only when the size changed. Returns true when something changed. */
export function applyDocLook (mesh, doc) {
  const v = mesh?.userData?.dnv; if (!v || !doc) return false
  let changed = false
  const dm = dims(doc); const w = dm.width; const a = dm.aspect
  if (Math.abs(w - v.width) > 1e-6 || Math.abs(a - v.aspect) > 1e-6) {
    const old = mesh.geometry
    mesh.geometry = new THREE.BoxGeometry(w, w * a, DEPTH)
    old?.dispose?.()
    for (const m of [v.frontMesh, v.backMesh]) { const og = m.geometry; m.geometry = new THREE.PlaneGeometry(w, w * a); og?.dispose?.() }
    v.width = w; v.aspect = a; changed = true
  }
  const paper = typeof doc.paper === 'string' && HEX.test(doc.paper) ? doc.paper : '#ffffff'
  if (paper !== v.paper) {
    v.paper = paper
    if (!v.front.map) v.front.color.set(paper)
    if (!v.back.map) v.back.color.set(paper)
    if (!v.frame) v.edge.color.set(paper)
    changed = true
  }
  const sides = doc.sides === 'front' ? 'front' : 'double'
  if (sides !== v.sides) { v.sides = sides; v.backMesh.visible = sides === 'double'; changed = true }
  const frame = doc.frame !== false
  if (frame !== v.frame) { v.frame = frame; v.edge.color.set(frame ? v.tint : v.paper); changed = true }
  if (setView(mesh, doc)) changed = true
  return changed
}

/** V206: the zoom window on the texture. zoom 100 = the whole page; 200 = the middle quarter ... panX / panY move the window. Returns true when it changed. */
export function setView (mesh, doc) {
  const v = mesh?.userData?.dnv; if (!v || !doc) return false
  const zoom = Math.min(400, Math.max(100, Number(doc.zoom) || 100)); const px = Math.min(1, Math.max(-1, Number(doc.panX) || 0)); const py = Math.min(1, Math.max(-1, Number(doc.panY) || 0))
  if (v.view.zoom === zoom && v.view.panX === px && v.view.panY === py) return false
  v.view = { zoom, panX: px, panY: py }
  if (v.tex) windowTexture(v)
  return true
}
function windowTexture (v) {
  const z = v.view.zoom / 100; const r = 1 / z
  v.tex.repeat.set(r, r)
  v.tex.offset.set((1 - r) * (0.5 + 0.5 * v.view.panX), (1 - r) * (0.5 - 0.5 * v.view.panY))
}

/**
 * The page canvas was (re)drawn: upload it. A texture of the same size is just flagged; a different size gets a NEW texture (the old one is disposed).
 * Returns true when a new texture was made.
 */
export function setPageCanvas (mesh) {
  const v = mesh?.userData?.dnv; if (!v || !v.canvas) return false
  const w = v.canvas.width; const h = v.canvas.height
  if (w < 4 || h < 4) return false
  let fresh = false
  if (!v.tex || v.texW !== w || v.texH !== h) {
    v.tex?.dispose?.()
    const t = new THREE.CanvasTexture(v.canvas)
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 4
    t.generateMipmaps = true
    t.minFilter = THREE.LinearMipmapLinearFilter
    t.magFilter = THREE.LinearFilter
    v.tex = t; v.texW = w; v.texH = h; fresh = true
    windowTexture(v)
    v.front.map = t; v.front.color.set('#ffffff'); v.front.needsUpdate = true
    v.back.map = t; v.back.color.set('#ffffff'); v.back.needsUpdate = true
  } else v.tex.needsUpdate = true
  return fresh
}

/** Drop the texture and shrink the canvas: the sheet goes back to a plain paper box. Idempotent. */
export function clearPage (mesh) {
  const v = mesh?.userData?.dnv; if (!v) return
  if (v.tex) { v.tex.dispose?.(); v.tex = null; v.texW = 0; v.texH = 0 }
  v.front.map = null; v.front.color.set(v.paper); v.front.needsUpdate = true
  v.back.map = null; v.back.color.set(v.paper); v.back.needsUpdate = true
  if (v.canvas) { v.canvas.width = 1; v.canvas.height = 1 }
  v.drawn = { key: '', page: 0, step: 0, spread: 'single' }
}

/** Dispose the per-node GPU resources and forget the mesh. Idempotent. */
export function releaseDocMesh (mesh) {
  const v = mesh?.userData?.dnv; if (!v) { DOC_LIVE.delete(mesh); return }
  try { v.tex?.dispose?.(); v.edge.dispose(); v.front.dispose(); v.back.dispose(); v.frontMesh.geometry?.dispose?.(); v.backMesh.geometry?.dispose?.(); mesh.geometry?.dispose?.() } catch (_) { /* already gone */ }
  if (v.canvas) { v.canvas.width = 1; v.canvas.height = 1 }
  delete mesh.userData.dnv
  DOC_LIVE.delete(mesh)
}
