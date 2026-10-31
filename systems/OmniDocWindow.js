/**
 * systems/OmniDocWindow.js (V250) — windows onto long documents (model: utils/OmniDocWindowModel.js). N doc sheets in a layout (tunnel, helix, sphere ...) show N consecutive pages;
 * flip() turns the window as a carousel (the sheet in the first slot shrinks away, the others glide one slot over, it grows back at the end showing the next page), so 8 sheets can page through 300 pages.
 * The sheets are ordinary doc nodes (they keep the level of detail and the pixel budget of systems/OmniDocNodes.js; only N of them ever pay for pixels).
 *   SERVICES.docwindow.create({ from, layout, count, id, start, center }) / flip(id, { dir, by, seconds }) / goto(id, page) / list() / forget(id)
 *   Omni Doc window | flip | goto | windows | unwindow      Saved in localStorage 'omni:docwindows:v1' (the sheets themselves are saved with the scene).
 * Events out: omni:docwindow-changed { id, start }.
 */
import * as THREE from 'three'
import gsap from 'gsap'
import { walkKeyAction, isTypingTarget } from '../utils/OmniWalkKeys.js'
import { SERVICES } from '../utils/OmniExtraKinds.js'
import * as WM from '../utils/OmniDocWindowModel.js'
import { layoutPages, pickLayout, LAYOUTS } from '../utils/OmniDocPageLayouts.js'

export const STORE_KEY = 'omni:docwindows:v1'
const send = (n, d) => { try { window.dispatchEvent(new CustomEvent(n, { detail: d })) } catch (_) { /* no window */ } }

export default class OmniDocWindow {
  constructor (context, omniNode = null) { this.context = context; this.omniNode = omniNode ?? context?.omniNode ?? null; this._w = new Map(); this._busy = new Map(); this._bound = []; this._inited = false }
  init () {
    if (this._inited) return; this._inited = true
    try { const raw = JSON.parse(localStorage.getItem(STORE_KEY)); for (const r of (Array.isArray(raw) ? raw : []).slice(0, WM.MAX_WINDOWS)) { const w = WM.sanitizeWindow(r); if (w) this._w.set(w.id, w) } } catch (_) { /* none saved */ }
    const on = (n, fn) => { const h = (e) => fn(e.detail ?? {}); window.addEventListener(n, h); this._bound.push([n, h]) }
    on('omni:docwindow-request', (d) => {   // ribbon: flip the most recent window forward/back (dir -1 or 1)
      const all = this.list(); const w = all[all.length - 1]
      if (!w) return window.dispatchEvent(new CustomEvent('omni:notify-info', { detail: { name: 'Doc window', desc: 'There is no doc window yet. Make one with: Omni Doc window', holdMs: 3500 } }))
      if (d.action === 'flip') this.flip(w.id, { dir: d.dir === -1 ? -1 : 1 }).catch(() => {})
    })
    on('omni:node-deleted', (d) => this._nodeGone(d.id)); on('omni:scene-clear-request', () => { this._w.clear(); this._save() })
    // drop a window whose sheets are no longer in the scene (a reload that restored a different scene)
    setTimeout(() => { for (const w of [...this._w.values()]) if (!w.slots.every(id => this.omniNode?.getNodeData?.(id))) { this._w.delete(w.id) } this._save() }, 1500)
    this._akey = (e) => { const a = walkKeyAction(e, isTypingTarget(document.activeElement)); if (a && a.event === 'omni:docwindow-request') { e.preventDefault(); window.dispatchEvent(new CustomEvent(a.event, { detail: a.detail })) } }; document.addEventListener('keydown', this._akey)
    SERVICES.docwindow = this
  }
  destroy () { try { document.removeEventListener('keydown', this._akey) } catch (_) { /* gone */ } for (const t of this._busy.values()) t.kill(); this._busy.clear(); for (const [n, h] of this._bound) window.removeEventListener(n, h); this._bound = []; if (SERVICES.docwindow === this) SERVICES.docwindow = null; this._inited = false }
  onResize () {}
  get doc () { if (!SERVICES.doc) throw new Error('the doc module is not running'); return SERVICES.doc }
  /** V253: load windows from a scene file (replace = swap all; merge = add). The sheets themselves come with the nodes. */
  loadWindows (list, mode = 'replace') {
    if (mode !== 'merge') { for (const t of this._busy.values()) t.kill(); this._busy.clear(); this._w.clear() }
    for (const r of (Array.isArray(list) ? list : []).slice(0, WM.MAX_WINDOWS)) { if (this._w.size >= WM.MAX_WINDOWS) break; const w = WM.sanitizeWindow(r); if (w) this._w.set(w.id, w) }
    this._save()
  }
  _save () { try { localStorage.setItem(STORE_KEY, JSON.stringify([...this._w.values()])) } catch (_) { /* full */ } }
  _nodeGone (id) { for (const w of [...this._w.values()]) if (w.slots.includes(id)) { this._busy.get(w.id)?.kill(); this._busy.delete(w.id); this._w.delete(w.id); this._save() } }
  list () { return [...this._w.values()].map(w => ({ ...w })) }
  get (id) { return this._w.get(id) ?? null }
  forget (id) { const had = this._w.delete(id); this._busy.get(id)?.kill(); this._busy.delete(id); this._save(); return had }

  _pose (w, slot, dims) {
    const plan = layoutPages({ layout: w.layout, count: w.count, width: dims.width, aspect: dims.aspect, center: w.center, exact: true })
    const p = plan.pages[slot]; return { pos: new THREE.Vector3(...p.position), quat: new THREE.Quaternion().setFromEuler(new THREE.Euler(p.rotation[0], p.rotation[1], p.rotation[2], 'XYZ')), rot: p.rotation }
  }
  _dims (w) { const d = this.doc.getDoc(w.slots[0]) ?? this.doc.getDoc(w.src); return { width: d?.width ?? 4, aspect: d?.aspect ?? 1.414 } }
  _pagesOf (w) { let n = w.pages; for (const id of w.slots) n = Math.max(n, this.doc.getDoc(id)?.pages ?? 0); return n }

  create ({ from, layout = 'helix', count = 8, id, start = 1, center = null }) {
    const src = this.doc.getDoc(from); if (!src) throw new Error('Pick a doc node first (id(...))')
    const L = pickLayout(layout); if (!L) throw new Error('layouts: ' + LAYOUTS.join(', '))
    if (this._w.size >= WM.MAX_WINDOWS) throw new Error('too many windows (max ' + WM.MAX_WINDOWS + ')')
    let n = Math.max(1, Math.min(WM.MAX_COUNT, Math.round(Number(count) || 8))); if (src.pages > 0) n = Math.min(n, src.pages)
    const wid = String(id ?? 'win' + (this._w.size + 1)); if (!/^[\w-]{1,64}$/.test(wid)) throw new Error('id: letters, digits, _ and - (max 64)'); if (this._w.has(wid)) throw new Error('a window named ' + wid + ' exists')
    const c = center ?? (() => { const p = this.doc._positionFor({}, 0); return p })()
    const first = WM.clampStart(start, n, src.pages)
    const plan = layoutPages({ layout: L, count: n, width: src.width, aspect: src.aspect, center: c, exact: true })
    const slots = []
    for (let s = 0; s < n; s++) {
      const out = this.doc.createDocNode({ doc: { ...src, spread: 'single', page: first + s, zoom: 100 }, position: plan.pages[s].position, rotation: plan.pages[s].rotation, label: `${src.title || 'Doc'} ${wid} ${s + 1}` })
      if (!out.ok) { for (const k of slots) send('omni:node-delete-request', { id: k }); throw new Error(out.error) }
      slots.push(out.nodeId)
    }
    const w = WM.sanitizeWindow({ id: wid, src: from, layout: L, center: c, pages: src.pages, start: first, slots }); this._w.set(wid, w); this._save(); return w
  }

  /** turn the window: dir +1 / -1, `by` pages (one carousel step each), seconds per step. Resolves when it has finished. */
  async flip (id, { dir = 1, by = 1, seconds = 0.6 } = {}) {
    const n = Math.max(1, Math.min(25, Math.round(Number(by) || 1))); let done = 0
    for (let i = 0; i < n; i++) { if (!(await this._step(id, dir < 0 ? -1 : 1, Math.max(0.05, Math.min(5, Number(seconds) || 0.6))))) break; done++ }
    return done
  }
  _step (id, dir, seconds) {
    const w = this._w.get(id); if (!w) throw new Error('no window ' + id)
    if (this._busy.has(id)) return Promise.resolve(false)                       // a flip is in progress: ignore (no queue-up while someone mashes the button)
    w.pages = this._pagesOf(w)
    const plan = WM.stepPlan(w, dir); if (!plan) return Promise.resolve(false)
    const dims = this._dims(w); const mesh = (nid) => this.omniNode.getMeshById(nid)
    const from = new Map(), to = new Map()
    for (const m of plan.moves) { from.set(m.id, this._pose(w, m.from, dims)); to.set(m.id, this._pose(w, m.to, dims)) }
    const leaver = mesh(plan.leaver); const leavePose = this._pose(w, dir > 0 ? 0 : w.count - 1, dims); const arrivePose = this._pose(w, plan.arrive.slot, dims)
    const proxy = { t: 0 }; let swapped = false
    return new Promise((resolve) => {
      const tw = gsap.to(proxy, { t: 1, duration: seconds, ease: 'power2.inOut',
        onUpdate: () => {
          const t = proxy.t
          for (const m of plan.moves) { const mm = mesh(m.id); if (!mm) continue; const a = from.get(m.id), b = to.get(m.id); mm.position.lerpVectors(a.pos, b.pos, t); mm.quaternion.slerpQuaternions(a.quat, b.quat, t) }
          if (leaver) {
            if (t < 0.5) { leaver.scale.setScalar(Math.max(0.001, 1 - t * 2)); leaver.position.copy(leavePose.pos) }
            else { if (!swapped) { swapped = true; this.doc.goto(plan.leaver, plan.arrive.page); leaver.position.copy(arrivePose.pos); leaver.quaternion.copy(arrivePose.quat) } leaver.scale.setScalar(Math.max(0.001, (t - 0.5) * 2)) }
          }
        },
        onInterrupt: () => { this._busy.delete(id); resolve(false) },
        onComplete: () => {
          for (const m of plan.moves) { const mm = mesh(m.id); if (mm) { mm.position.copy(to.get(m.id).pos); mm.quaternion.copy(to.get(m.id).quat) } }
          if (leaver) { leaver.scale.setScalar(1); leaver.position.copy(arrivePose.pos); leaver.quaternion.copy(arrivePose.quat) }
          for (const nid of w.slots) { const mm = mesh(nid); if (mm?.userData?.restPosition) mm.userData.restPosition.copy(mm.position) }
          this._w.set(id, { ...(this._w.get(id) ?? w), start: plan.start, slots: plan.slots }); this._busy.delete(id); this._save()
          send('omni:force-save', {}); send('omni:docwindow-changed', { id, start: plan.start }); resolve(true)
        } })
      this._busy.set(id, tw)
    })
  }
  /** every sheet to its slot pose, full size (after a flip was interrupted) */
  _snap (w) {
    const dims = this._dims(w)
    w.slots.forEach((nid, s) => { const m = this.omniNode.getMeshById(nid); if (!m) return; const p = this._pose(w, s, dims); m.position.copy(p.pos); m.quaternion.copy(p.quat); m.scale.setScalar(1); if (m.userData?.restPosition) m.userData.restPosition.copy(m.position) })
  }
  /** go straight to a first page: every sheet shows its page (a long jump needs no carousel) */
  goto (id, page) {
    let w = this._w.get(id); if (!w) throw new Error('no window ' + id)
    if (this._busy.has(id)) { this._busy.get(id).kill(); this._busy.delete(id); this._snap(w) }     // a flip in progress ends where it is: put every sheet in its slot
    w = this._w.get(id); w.pages = this._pagesOf(w); const plan = WM.jumpPlan(w, page); if (!plan) throw new Error('bad window')
    for (const p of plan.pages) this.doc.goto(p.id, p.page)
    this._w.set(id, { ...w, start: plan.start }); this._save(); send('omni:docwindow-changed', { id, start: plan.start }); return plan.start
  }
}
