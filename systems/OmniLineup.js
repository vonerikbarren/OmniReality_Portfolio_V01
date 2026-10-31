/**
 * systems/OmniLineup.js (V244) — the runtime of lineups and attachments (model: utils/OmniLineupModel.js). Works on ANY node (a voxel node, a poly cube, a semantics cube ...).
 *   SERVICES.lineup.state()  create / remove / place / take / attach / detach / arrange
 *   Omni Lineup create | place | take | arrange | delete | attach | detach | list
 * Each frame every lineup node eases toward its slot (so reordering animates); a node that is CARRIED keeps its offset from the node that carries it. When everything has settled the scene is saved once.
 * WALK (V247): walk(id, { seconds, hold, distance, from, loop, auto, captions }) flies the camera to each node in sequence order (utils/OmniLineupWalkModel.js: inside the shape for tunnel / helix / sphereIn,
 * outside for sphereOut, in front for row / grid), holds, then goes on; next() / prev() step by hand (auto: false waits for them); halt() or Esc stops. Orbit controls are off while it runs.
 * Saved apart from the nodes in localStorage 'omni:lineups:v1'. Events in: omni:lineup-request { action, ... }. Events out: omni:lineup-changed { state }.
 */
import * as THREE from 'three'
import { SERVICES } from '../utils/OmniExtraKinds.js'
import * as M from '../utils/OmniLineupModel.js'
import * as W from '../utils/OmniLineupWalkModel.js'
import gsap from 'gsap'
import { walkKeyAction, isTypingTarget } from '../utils/OmniWalkKeys.js'

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
    this._esc = (e) => { if (e.key === 'Escape' && this._walk) this.halt() }; document.addEventListener('keydown', this._esc)
    this._akey = (e) => { const a = walkKeyAction(e, isTypingTarget(document.activeElement)); if (a && a.event === 'omni:lineup-request') { e.preventDefault(); send(a.event, a.detail) } }; document.addEventListener('keydown', this._akey)
    SERVICES.lineup = this
  }
  destroy () { this.halt(true); try { document.removeEventListener('keydown', this._esc); document.removeEventListener('keydown', this._akey) } catch (_) { /* gone */ } for (const [n, h] of this._bound) window.removeEventListener(n, h); this._bound = []; if (SERVICES.lineup === this) SERVICES.lineup = null; this._inited = false }
  onResize () {}
  state () { return JSON.parse(JSON.stringify(this._s)) }
  /** V253: load lineups from a scene file. replace = swap everything; merge = add (ids already checked/renamed by the file reader). */
  loadState (state, mode = 'replace') {
    const inc = M.sanitizeState(state)
    if (mode === 'merge') {
      const cur = this.state(); const out = M.emptyState()
      out.lineups = { ...cur.lineups, ...inc.lineups }; out.attach = { ...cur.attach, ...inc.attach }
      // a node belongs to one lineup at a time: the file's lineups win for the nodes they bring
      const mine = new Set(Object.values(inc.lineups).flatMap(l => l.order))
      for (const [id, l] of Object.entries(cur.lineups)) out.lineups[id] = { ...l, order: l.order.filter(n => !mine.has(n)) }
      Object.assign(out.lineups, inc.lineups)
      this._s = M.sanitizeState(out)
    } else this._s = inc
    this._moving = true; this._save()
  }
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

  // ── the camera walk ──
  isWalking () { return !!this._walk }
  walkStatus () { const w = this._walk; return w ? { id: w.id, index: w.i + 1, of: w.plan.length, auto: w.auto } : null }
  walk ({ id, seconds = 2.5, hold = 1.5, distance = W.DIST.def, from = 1, loop = false, auto = true, captions = true }) {
    const lu = this._s.lineups[id]; if (!lu) throw new Error('no lineup ' + id)
    const cam = this.context?.camera; if (!cam) throw new Error('the camera is not available')
    this.halt(true)
    try { gsap.killTweensOf(cam.position) } catch (_) { /* none */ }   // another camera animation (the intro descent, a fly) must not fight the walk
    const pos = {}; for (const n of lu.order) { const m = this._mesh(n); if (m) pos[n] = m.position.toArray() }
    const plan = W.walkPlan(lu.order, pos, { layout: lu.layout, center: lu.center, distance, from, loop })
    if (!plan.length) throw new Error('that lineup has no nodes to walk to')
    const fwd = new THREE.Vector3(); cam.getWorldDirection(fwd)
    this._walk = { id, plan, i: -1, seconds: Math.max(0.3, Math.min(30, Number(seconds) || 2.5)), hold: Math.max(0, Math.min(60, Number(hold) || 0)), auto: auto !== false, captions: captions !== false, total: lu.order.length,
      look: cam.position.clone().addScaledVector(fwd, 10), tween: null, wait: null }
    // the orbit controls clamp the camera to their max distance from their target: tell them how far this walk goes (as OmniAxinator's take-me-there does) and let the target follow the look point
    let far = 80; for (const st of plan) far = Math.max(far, cam.position.distanceTo(new THREE.Vector3(...st.cam)) * 1.3, new THREE.Vector3(...st.cam).distanceTo(new THREE.Vector3(...st.look)) * 1.5)
    window.dispatchEvent(new CustomEvent('omni:orbit-max-distance-set', { detail: { distance: Math.ceil(far) } }))
    window.dispatchEvent(new CustomEvent('omni:orbit-disable', { detail: {} }))
    send('omni:lineup-walk', { state: 'start', id }); this._step(1); return plan.length
  }
  /** Ribbon helper: walk the first lineup (or tell the person there is none). */
  walkFirst () {
    if (this._walk) return this.halt()
    const id = Object.keys(this._s.lineups || {})[0]
    if (!id) return send('omni:notify-info', { name: 'Lineup walk', desc: 'There is no lineup yet. Make one with: Omni Lineup create', holdMs: 3500 })
    this.walk({ id })
  }
  next () { return this._jump(1) }
  prev () { return this._jump(-1) }
  _jump (d) { const w = this._walk; if (!w) return false; const n = w.i + d; if (n < 0 || n >= w.plan.length) return false; this._step(d); return true }
  _caption (text) {
    if (!this._walk?.captions) return
    let el = document.getElementById('omni-lineup-walk-caption')
    if (!el) { el = document.createElement('div'); el.id = 'omni-lineup-walk-caption'; el.style.cssText = 'position:fixed;left:50%;bottom:14%;transform:translateX(-50%);z-index:2147483000;padding:8px 16px;border-radius:10px;background:rgba(8,14,24,.78);color:#ffd36b;font:600 16px system-ui,sans-serif;pointer-events:none;max-width:86vw;text-align:center'; document.body.appendChild(el) }
    el.textContent = text
  }
  _step (d) {
    const w = this._walk; if (!w) return
    w.tween?.kill(); w.wait?.kill(); w.i += d
    if (w.i >= w.plan.length) return this.halt()
    const st = w.plan[w.i]; const cam = this.context.camera
    const m = this._mesh(st.id); const label = this.omniNode?.getNodeData?.(st.id)?.label ?? st.id
    // the node may have glided since the plan was made: keep the planned offset, aim at where the node is NOW
    const off = [st.cam[0] - st.look[0], st.cam[1] - st.look[1], st.cam[2] - st.look[2]]; const tgt = m ? m.position.toArray() : st.look
    const camTo = [tgt[0] + off[0], tgt[1] + off[1], tgt[2] + off[2]]
    this._caption(W.readout(st.number, w.total, label))
    const look = w.look; const l0 = look.clone(); const l1 = new THREE.Vector3(...tgt)
    w.tween = gsap.to(cam.position, { x: camTo[0], y: camTo[1], z: camTo[2], duration: w.seconds, ease: 'power2.inOut',
      onUpdate: () => { const k = w.tween ? w.tween.progress() : 1; look.lerpVectors(l0, l1, k); cam.lookAt(look); window.dispatchEvent(new CustomEvent('omni:orbit-target-set', { detail: { x: look.x, y: look.y, z: look.z } })) },
      onComplete: () => { look.copy(l1); cam.lookAt(look); window.dispatchEvent(new CustomEvent('omni:orbit-target-set', { detail: { x: look.x, y: look.y, z: look.z } }))
        send('omni:lineup-walk', { state: 'at', id: w.id, node: st.id, number: st.number })
        if (w.auto) w.wait = gsap.delayedCall(w.hold, () => this._step(1)) } })
  }
  halt (quiet = false) {
    const w = this._walk; if (!w) return false
    w.tween?.kill(); w.wait?.kill(); this._walk = null
    try { document.getElementById('omni-lineup-walk-caption')?.remove() } catch (_) { /* gone */ }
    if (!quiet) { const l = w.look; window.dispatchEvent(new CustomEvent('omni:orbit-target-set', { detail: { x: l.x, y: l.y, z: l.z } })); window.dispatchEvent(new CustomEvent('omni:orbit-enable', { detail: {} })); send('omni:lineup-walk', { state: 'end', id: w.id }) }
    else window.dispatchEvent(new CustomEvent('omni:orbit-enable', { detail: {} }))
    return true
  }

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
