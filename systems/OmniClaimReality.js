/**
 * systems/OmniClaimReality.js (V261) — walk into a claim. Round the ClaimNode, three glass ROOMS appear: TRUE (green), FALSE (red) and UNDEFINED (yellow, or white / black / grey
 * once objective), each sized by its share at the claim's scale. Every testimony is a handful of particles inside the room of its verdict, coloured by WHO said it
 * (human white, bot cyan, AI magenta, sensor orange, animal lime, other grey) and moving the way its ExperienceProfile says (utils/OmniClaimReality.js).
 * Overlay only: nothing here is saved with the scene (userData.omniOverlay, raycast off). A locked private claim shows nothing.
 *   SERVICES.claimview.show(id) / hide(id) / toggle(id) / isShown(id) / stats(id)      Command: Omni Claim view id(...) [state(on|off)]
 */
import * as THREE from 'three'
import { SERVICES } from '../utils/OmniExtraKinds.js'
import * as R from '../utils/OmniClaimReality.js'
import { NODE_COLOR } from '../utils/OmniClaimModel.js'

const noRay = (o) => { o.raycast = () => {} }
const col = (a) => new THREE.Color(a[0] / 255, a[1] / 255, a[2] / 255)
function label (text, color) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d'); g.font = 'bold 30px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = color; g.fillText(text, 128, 32)
  const tex = new THREE.CanvasTexture(c); const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })); sp.scale.set(3.2, 0.8, 1); noRay(sp); sp.userData.tex = tex; return sp
}
export default class OmniClaimReality {
  constructor (context, omniNode = null) { this.ctx = context; this.omniNode = omniNode ?? context?.omniNode ?? null; this._v = new Map(); this._bound = []; this._inited = false; this._rand = R.rng(7) }
  init () {
    if (this._inited) return; this._inited = true
    const on = (n, fn) => { const h = (e) => fn(e.detail ?? {}); window.addEventListener(n, h); this._bound.push([n, h]) }
    on('omni:claim-changed', (d) => { if (this._v.has(d.nodeId)) this._rebuild(d.nodeId) }); on('omni:node-deleted', (d) => this.hide(d.id)); on('omni:scene-clear-request', () => this.hideAll())
    on('omni:claim-view-request', (d) => { try { if (d.action === 'toggle') this.toggle(d.id); else if (d.action === 'off') this.hide(d.id); else this.show(d.id) } catch (_) { /* a locked or missing claim: nothing to show */ } })
    SERVICES.claimview = this
  }
  destroy () { this.hideAll(); for (const [n, h] of this._bound) window.removeEventListener(n, h); this._bound = []; if (SERVICES.claimview === this) SERVICES.claimview = null; this._inited = false }
  onResize () {}
  isShown (id) { return this._v.has(id) }
  stats (id) { const v = this._v.get(id); return v ? { rooms: v.lay.rooms.map(r => ({ key: r.key, edge: r.edge, share: r.share })), particles: v.ps.length, kinds: [...new Set(v.ps.map(p => p.kind))], group: v.group } : null }
  show (id) {
    if (this._v.has(id)) return true
    const claim = SERVICES.claims?.get(id); if (!SERVICES.claims?.isClaim(id)) throw new Error('That is not a ClaimNode.'); if (!claim) throw new Error('This claim is private and locked. Unlock it first.')
    const scene = this.ctx?.scene; if (!scene) throw new Error('There is no scene.'); this._v.set(id, null); this._rebuild(id); return true
  }
  hide (id) { const v = this._v.get(id); if (v === undefined) return false; this._dispose(v); this._v.delete(id); return true }
  hideAll () { for (const id of [...this._v.keys()]) this.hide(id) }
  toggle (id) { return this.isShown(id) ? !this.hide(id) : this.show(id) }
  _dispose (v) { if (!v) return; v.group.parent?.remove(v.group); v.group.traverse(o => { o.geometry?.dispose?.(); o.material?.map?.dispose?.(); o.material?.dispose?.() }) }
  _rebuild (id) {
    const old = this._v.get(id); this._dispose(old)
    const claim = SERVICES.claims?.get(id); if (!claim) { this._v.delete(id); return }
    const lay = R.layout(claim); const objective = lay.shares.undefined < 1e-9 && claim.state.laws.length > 0
    const pal = objective ? [NODE_COLOR.objectiveTruth, NODE_COLOR.objectiveFalse, NODE_COLOR.objectiveUndefined] : [NODE_COLOR.truth, NODE_COLOR.false, NODE_COLOR.undefined]
    const group = new THREE.Group(); group.name = 'omni-claim-reality'; group.userData.omniOverlay = true
    const names = ['TRUE', 'FALSE', 'UNDEFINED']
    lay.rooms.forEach((rm, i) => {
      const c = col(pal[i]); const box = new THREE.Mesh(new THREE.BoxGeometry(rm.edge, rm.edge, rm.edge), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.07, depthWrite: false, side: THREE.DoubleSide })); noRay(box)
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(box.geometry), new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: 0.7 })); noRay(edges); box.add(edges)
      const lb = label(`${names[i]} ${Math.round(rm.share * 100)}%`, objective ? (i === 1 ? '#aaa' : '#fff') : '#fff'); lb.position.set(0, rm.edge / 2 + 0.7, 0); box.add(lb)
      box.position.set(...rm.center); box.name = 'omni-claim-room-' + rm.key; group.add(box)
    })
    const ps = R.seedParticles(claim); const pos = new Float32Array(ps.length * 3); const cols = new Float32Array(ps.length * 3)
    ps.forEach((p, i) => { const k = new THREE.Color(R.KIND_COLORS[p.kind] ?? '#fff').multiplyScalar(p.par.energy); cols.set([k.r, k.g, k.b], i * 3) })
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(cols, 3))
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.2, vertexColors: true, transparent: true, depthWrite: false, sizeAttenuation: true })); pts.frustumCulled = false; pts.name = 'omni-claim-particles'; noRay(pts); group.add(pts)
    const atts = [0, 1, 2].map(i => R.attractors(lay.edges[i], 4 + i * 2, i + 1))
    this.ctx.scene.add(group); const v = { group, pts, ps, lay, atts, claimId: id }; this._v.set(id, v); this._place(id, v); this._write(v)
  }
  _place (id, v) { const m = this.omniNode?.getMeshById?.(id); if (m) { const w = m.getWorldPosition(new THREE.Vector3()); v.group.position.set(w.x, w.y - 0.5, w.z) } }
  _write (v) {
    const a = v.pts.geometry.attributes.position.array
    v.ps.forEach((p, i) => { const c = v.lay.centers[p.room]; a[i * 3] = c[0] + p.p[0]; a[i * 3 + 1] = c[1] + p.p[1]; a[i * 3 + 2] = c[2] + p.p[2] })
    v.pts.geometry.attributes.position.needsUpdate = true
  }
  update (delta) { if (!this._inited || !this._v.size) return; for (const [id, v] of this._v) { if (!v) continue; this._place(id, v); R.stepParticles(v.ps, delta, v.lay.edges, this._rand, v.atts); this._write(v) } }
  /** For tests: advance the particles by dt seconds, n times, without waiting for frames. */
  step (id, dt = 0.05, n = 1) { const v = this._v.get(id); if (!v) return false; for (let i = 0; i < n; i++) R.stepParticles(v.ps, dt, v.lay.edges, this._rand, v.atts); this._write(v); return true }
}
