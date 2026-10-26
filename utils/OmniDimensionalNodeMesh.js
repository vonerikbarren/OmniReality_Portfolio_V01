/**
 * utils/OmniDimensionalNodeMesh.js (V217) — the GEOMETRY of the Dimensional Node: a glass cube (a pocket) that is VEILED (faint, a "?") until the viewer's
 * channel matches, then REVEALED: an x-ray of its inside (a spinning inner frame and a core) and its head signature. setReveal(mesh, 0..1, t) fades between them.
 * Only the cube is pickable. One small canvas texture per label (signature, "?"), disposed with the node.
 */
import * as THREE from 'three'
import { getAxiom } from '../data/OmniAxiomData.js'

export const CUBE = 1.4
const noRay = (o) => { o.raycast = () => {} }
function labelSprite (text, color, size = 1.6) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64
  const g = c.getContext('2d'); g.clearRect(0, 0, 256, 64); g.font = 'bold 28px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'
  g.fillStyle = color; g.fillText(text.slice(0, 22), 128, 32)
  const tex = new THREE.CanvasTexture(c)
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0 }))
  sp.scale.set(size * 4, size, 1); noRay(sp); sp.userData.tex = tex
  return sp
}
export function buildDimensionalNodeMesh (color, dim) {
  const col = new THREE.Color(color ?? 0x9ad7ff)
  const glass = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide })
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(CUBE, CUBE, CUBE), glass)
  const edgeMat = new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.35 })
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), edgeMat); noRay(edges)
  const innerMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 })
  const inner = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.OctahedronGeometry(CUBE * 0.36, 0)), innerMat); noRay(inner)
  const coreMat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0, depthWrite: false })
  const core = new THREE.Mesh(new THREE.SphereGeometry(CUBE * 0.12, 12, 8), coreMat); noRay(core)
  const sat = new THREE.Mesh(new THREE.SphereGeometry(CUBE * 0.05, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false })); noRay(sat)
  const veil = labelSprite('?', '#ffffff', 0.9); veil.position.y = 0
  const sig = labelSprite(dim?.signature ?? 'Signature', '#ffffff', 0.55); sig.position.y = CUBE * 0.9
  mesh.add(edges, inner, core, sat, veil, sig)
  mesh.userData.dimNode = { glass, edges, edgeMat, inner, innerMat, core, coreMat, sat, veil, sig, reveal: 0, sigText: dim?.signature ?? 'Signature', col, dispose: [] }
  return mesh
}
export function setSignature (mesh, text) {
  const d = mesh?.userData?.dimNode; if (!d || d.sigText === text) return
  const old = d.sig; const sp = labelSprite(text, '#ffffff', 0.55); sp.position.copy(old.position); sp.material.opacity = old.material.opacity
  mesh.remove(old); old.userData.tex?.dispose(); old.material.dispose(); mesh.add(sp); d.sig = sp; d.sigText = text
}
/** r 0 (veiled) .. 1 (revealed); t = scaled time for the spin; mode 'xray' shows the inside, 'signature' only the text; color from the axiom if known */
export function setReveal (mesh, r, t = 0, mode = 'xray', axiomId = null) {
  const d = mesh?.userData?.dimNode; if (!d) return
  d.reveal = r
  const a = getAxiom(axiomId); if (a) { d.col.set(a.color); d.glass.color.set(a.color); d.edgeMat.color.set(a.color); d.coreMat.color.set(a.color) }
  const x = mode === 'xray' ? r : 0
  d.glass.opacity = 0.08 + 0.2 * r
  d.edgeMat.opacity = 0.3 + 0.7 * r
  d.innerMat.opacity = 0.9 * x; d.inner.visible = x > 0.02; d.inner.rotation.set(t * 0.7, t * 1.1, t * 0.3)
  d.coreMat.opacity = 0.85 * x; d.core.visible = x > 0.02; d.core.scale.setScalar(0.8 + 0.25 * Math.sin(t * 3))
  d.sat.material.opacity = 0.9 * x; d.sat.visible = x > 0.02; d.sat.position.set(Math.cos(t * 2.2) * CUBE * 0.34, Math.sin(t * 1.7) * CUBE * 0.2, Math.sin(t * 2.2) * CUBE * 0.34)
  d.sig.material.opacity = r; d.sig.visible = r > 0.02
  d.veil.material.opacity = 0.55 * (1 - r); d.veil.visible = r < 0.98
}
export function releaseDimensionalMesh (mesh) {
  const d = mesh?.userData?.dimNode; if (!d) return
  try {
    for (const s of [d.veil, d.sig]) { s.userData.tex?.dispose(); s.material.dispose() }
    d.sat.geometry.dispose(); d.sat.material.dispose(); d.core.geometry.dispose(); d.coreMat.dispose(); d.inner.geometry.dispose(); d.innerMat.dispose()
    d.edges.geometry.dispose(); d.edgeMat.dispose(); mesh.geometry.dispose(); d.glass.dispose()
  } catch (_) { /* already gone */ }
  delete mesh.userData.dimNode
}
