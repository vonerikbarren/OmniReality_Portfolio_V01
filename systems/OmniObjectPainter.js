/**
 * systems/OmniObjectPainter.js (V256) — OmniObjectPainter: paint COLOUR onto the surface of a node, with a finger or the mouse.
 *   SERVICES.objectpaint.begin() · dab({x, y}, color, dab, soft) -> id|null · end() · undo() · clear(id?) · layers() -> [id]
 * How: the node gets a 256 x 256 canvas texture (starting as its own colour) used as its colour map; each dab is a soft round brush drawn
 * at the UV point under the pointer. Works on any node whose shape has UV coordinates (every built-in shape does; sprites and text do not).
 * Not a custom shader: plain canvas painting, so it runs the same on every device. clear() gives the node back its original look.
 * NOT saved with the scene yet: paint lasts until you reload (see docs/user-guide/46). Undo keeps the last 20 strokes.
 */
import * as THREE from 'three'
import { SERVICES } from '../utils/OmniExtraKinds.js'
import { TEX, MAX_LAYERS, MAX_UNDO, dabPlan } from '../utils/OmniObjectPaintModel.js'

export default class OmniObjectPainter {
  constructor (context, omniNode = null) { this.context = context; this.omniNode = omniNode ?? context?.omniNode ?? null; this._layers = new Map(); this._undo = []; this._cur = null; this._ray = new THREE.Raycaster(); this._inited = false }
  init () { if (this._inited) return; this._inited = true; SERVICES.objectpaint = this }
  destroy () { for (const id of [...this._layers.keys()]) this._restore(id); this._layers.clear(); this._undo = []; if (SERVICES.objectpaint === this) SERVICES.objectpaint = null; this._inited = false }
  update () {} onResize () {}
  layers () { return [...this._layers.keys()] }

  _pick (x, y) {
    const cam = this.context?.camera, el = this.context?.renderer?.domElement; if (!cam || !el || !this.omniNode?.getAllMeshes) return null
    const r = el.getBoundingClientRect(); this._ray.setFromCamera(new THREE.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1), cam)
    const meshes = this.omniNode.getAllMeshes().filter(m => m?.isMesh && m.visible && m.geometry?.attributes?.uv && !m.userData?.omniOverlay)
    const hit = this._ray.intersectObjects(meshes, false)[0]; if (!hit || !hit.uv) return null
    const id = this._idOf(hit.object); return id ? { id, mesh: hit.object, uv: hit.uv } : null
  }
  _idOf (mesh) { return mesh?.userData?.id ?? mesh?.userData?.nodeId ?? (this.omniNode?.getNodeIdForMesh ? this.omniNode.getNodeIdForMesh(mesh) : null) ?? this._scan(mesh) }
  _scan (mesh) { for (const m of [...(this.omniNode?._nodes?.entries?.() ?? [])]) if (m[1]?.mesh === mesh) return m[0]; return null }

  _layer (id, mesh) {
    let L = this._layers.get(id); if (L) return L
    if (this._layers.size >= MAX_LAYERS) return null
    const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material; if (!mat || !('color' in mat)) return null
    const cv = document.createElement('canvas'); cv.width = cv.height = TEX; const g = cv.getContext('2d')
    g.fillStyle = '#' + mat.color.getHexString(); g.fillRect(0, 0, TEX, TEX)
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace
    L = { mesh, mat, cv, g, tex, was: { map: mat.map ?? null, color: mat.color.clone() } }
    mat.map = tex; mat.color.set(0xffffff); mat.needsUpdate = true; this._layers.set(id, L); return L
  }
  _restore (id) { const L = this._layers.get(id); if (!L) return; L.mat.map = L.was.map; L.mat.color.copy(L.was.color); L.mat.needsUpdate = true; L.tex.dispose() }

  begin () { this._cur = { snaps: new Map() } }
  /** One dab at a screen point. Returns the node id painted, or null when nothing paintable is under the pointer. */
  dab (pt, color = '#7fd6ff', dab = 28, soft = 0.5) {
    if (!this._cur) this.begin()
    const hit = this._pick(pt.x, pt.y); if (!hit) return null
    const L = this._layer(hit.id, hit.mesh); if (!L) return null
    const plan = dabPlan(hit.uv, dab, soft); if (!plan) return null
    if (!this._cur.snaps.has(hit.id)) this._cur.snaps.set(hit.id, L.g.getImageData(0, 0, TEX, TEX))
    const g = L.g
    const draw = (cx) => { const gr = g.createRadialGradient(cx, plan.y, plan.r * plan.inner, cx, plan.y, plan.r); gr.addColorStop(0, color); gr.addColorStop(1, color + '00'); g.fillStyle = gr; g.beginPath(); g.arc(cx, plan.y, plan.r, 0, Math.PI * 2); g.fill() }
    draw(plan.x); if (plan.x < plan.r) draw(plan.x + TEX); if (plan.x > TEX - plan.r) draw(plan.x - TEX)   // wrap across the seam
    L.tex.needsUpdate = true; return hit.id
  }
  end () { const c = this._cur; this._cur = null; if (c?.snaps.size) { this._undo.push(c.snaps); if (this._undo.length > MAX_UNDO) this._undo.shift(); return c.snaps.size } return 0 }
  undo () {
    this.end(); const s = this._undo.pop(); if (!s) return 0
    for (const [id, img] of s) { const L = this._layers.get(id); if (L) { L.g.putImageData(img, 0, 0); L.tex.needsUpdate = true } }
    return s.size
  }
  /** Give one node (or every painted node) its original look back. */
  clear (id = null) {
    const ids = id ? [id] : [...this._layers.keys()]; let n = 0
    for (const k of ids) if (this._layers.has(k)) { this._restore(k); this._layers.delete(k); n++ }
    this._undo = this._undo.map(m => { for (const k of ids) m.delete(k); return m }).filter(m => m.size)
    return n
  }
}
