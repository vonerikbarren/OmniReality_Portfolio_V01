/**
 * systems/OmniLineup.js (V244) — the runtime of lineups and attachments (model: utils/OmniLineupModel.js). Works on ANY node (a voxel node, a poly cube, a semantics cube ...).
 *   SERVICES.lineup.state()  create / remove / place / take / attach / detach / arrange
 *   Omni Lineup create | place | take | arrange | delete | attach | detach | list
 * Each frame every lineup node eases toward its slot (so reordering animates); a node that is CARRIED keeps its offset from the node that carries it. When everything has settled the scene is saved once.
 * Saved apart from the nodes in localStorage 'omni:lineups:v1'. Events in: omni:lineup-request { action, ... }. Events out: omni:lineup-changed { state }.
 */
import * as THREE from 'three'
import { SERVICES } from '../utils/OmniExtraKinds.js'
import * as M from '../utils/OmniLineupModel.js'

export const STORE_KEY = 'omni:lineups:v1'
const EASE = 6          // 1/s: how fast nodes glide to their slot
const EPS = 0.01
const send = (n, d) => { try { window.dispatchEvent(new CustomEvent(n, { detail: d })) } catch (_) { /* no window */ } }

export default class OmniLineup {
  constructor (context, omniNode = null) { this.context = context; this.omniNode = omniNode ?? context?.omniNode ?? null; this._s = M.emptyState(); this._bound = []; this._moving = false; this._inited = false; this._v = new THREE.Vector3() }
  init () {
    if (this._inited) return; this._inited = true
    try { this._s = M.sanitizeState(JSON.parse(localStorage.getItem(STORE_KEY))) } catch (_) { this._s = M.emptyState() }
    const on = (n, fn) => { const h = (e) => fn(e.detail ?? {}); window.addEventListener(n, h); this._bound.push([n, h]) }
    on('omni:node-deleted', (d) => { if (d.id) { this._s = M.forget(this._s, d.id); this._save() } })
    on('omni:scene-clear-request', () => { this._s = M.emptyState(); this._save() })
    on('omni:lineup-request', (d) => { try { const fn = this[d.action]; if (typeof fn === 'function') fn.call(this, d) } catch (_) { /* ignore a bad request */ } })
    SERVICES.lineup = this
  }
  destroy () { for (const [n, h] of this._bound) window.removeEventListener(n, h); this._bound = []; if (SERVICES.lineup === this) SERVICES.lineup = null; this._inited = false }
  onResize () {}
  state () { return JSON.parse(JSON.stringify(this._s)) }
  _save () { try { localStorage.setItem(STORE_KEY, JSON.stringify(this._s)) } catch (_) { /* full */ } send('omni:lineup-changed', { state: this.state() }) }
  _apply (r) { if (!r.ok) throw new Error(r.error); this._s = r.state; this._moving = true; this._save(); return r }
  _mesh (id) { return this.omniNode?.getMeshById?.(id) ?? null }
  _need (id) { if (!this.omniNode?.getNodeData?.(id)) throw new Error('no node ' + id); return id }

  create ({ id, layout = 'row', center, spacing = 3, ids = [] }) {
    const list = (Array.isArray(ids) ? ids : []).map(i => this._need(String(i)))
    let c = center; if (!c) { const cam = this.context?.camera; if (cam) { const d = new THREE.Vector3(); cam.getWorldDirection(d); const p = cam.getWorldPosition(new THREE.Vector3()).addScaledVector(d, 12); c = [p.x, p.y, p.z] } }
    return this._apply(M.createLineup(this._s, id, { layout, center: c, spacing, ids: list }))
  }
  place ({ id, node, index = null }) { return this._apply(M.place(this._s, id, this._need(node), index)) }
  take ({ id, node }) { return this._apply(M.remove(this._s, id, node)) }
  delete ({ id }) { return this._apply(M.deleteLineup(this._s, id)) }
  arrange () { this._moving = true; return { ok: true } }
  attach ({ node, to, off = null }) {
    const a = this._mesh(this._need(node)); const b = this._mesh(this._need(to)); let o = off
    if (!o && a && b) o = [a.position.x - b.position.x, a.position.y - b.position.y, a.position.z - b.position.z]
    return this._apply(M.attach(this._s, node, to, o))
  }
  detach ({ node }) { return this._apply(M.detach(this._s, node)) }

  update (delta = 0.016) {
    const lus = Object.values(this._s.lineups); const hasAtt = Object.keys(this._s.attach).length > 0
    if (!lus.length && !hasAtt) return
    const k = 1 - Math.exp(-EASE * Math.min(delta, 0.1)); let moving = false
    for (const lu of lus) {
      const slots = M.slotsOf(lu)
      for (const id of lu.order) {
        const m = this._mesh(id); const t = slots[id]; if (!m || !t) continue
        // a node dragged by hand while the lineup is settled is left alone: only glide while we are animating, or when it is far off its slot
        const dx = t[0] - m.position.x; const dy = t[1] - m.position.y; const dz = t[2] - m.position.z
        const d = Math.hypot(dx, dy, dz)
        if (d > EPS && this._moving) { m.position.set(m.position.x + dx * k, m.position.y + dy * k, m.position.z + dz * k); if (m.userData?.restPosition) m.userData.restPosition.copy(m.position); moving = true }
        else if (d <= EPS && d > 0) m.position.set(t[0], t[1], t[2])
      }
    }
    // carried nodes keep their offset (two passes: a carrier may itself be carried)
    if (hasAtt) for (let pass = 0; pass < 2; pass++) for (const [id, a] of Object.entries(this._s.attach)) {
      const m = this._mesh(id); const c = this._mesh(a.to); if (!m || !c) continue
      this._v.set(c.position.x + a.off[0], c.position.y + a.off[1], c.position.z + a.off[2])
      if (m.position.distanceToSquared(this._v) > 1e-8) { m.position.copy(this._v); if (m.userData?.restPosition) m.userData.restPosition.copy(m.position) }
    }
    if (this._moving && !moving) { this._moving = false; send('omni:force-save', {}) }
  }
}
