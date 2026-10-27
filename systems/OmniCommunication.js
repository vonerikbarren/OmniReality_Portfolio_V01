/**
 * systems/OmniCommunication.js (V223) — OmniCommunication (Receive / Route) and the inboxes behind the OmniNodeAcquisitioner panel.
 *
 * Each tunnel is a field with its own inbox (rules: utils/OmniCommModel.js). Receive is OPT-IN: a tunnel accepts nothing until it is opened.
 *   setReceive(tunnel, open) · setMuted · setAllow(tunnel, list) · setCap(tunnel, n)
 *   send({ to, via?, node: id | text: "...", from?: 'user', label? })   put a new piece into a tunnel (through optional relays)
 *   route({ id, from, to, via? })                                       move a piece you already hold from one tunnel to another
 *   acquire(tunnel, id, { position? })                                  take a piece out into the space (a node becomes a real node; text becomes a note node)
 *   decipher(tunnel, id, on) · pin(tunnel, id, on) · drop(tunnel, id) · clear(tunnel) · inbox(tunnel) · config(tunnel) · status()
 * Events out (window): omni:comm-changed { tunnel }, omni:comm-delivered { packet, to, muted }, omni:comm-refused { reason, to }, omni:comm-acquired { packet, id }
 * A notification (omni:notify-info) shows when a piece arrives in a tunnel that is not muted.
 * Persisted in localStorage 'omni:comm:v1' (sanitised on load). Extra.SERVICES.communication = this. Nothing here is networked yet: delivery is between
 * the tunnels of this one space; "external" is reserved for the Presence backend.
 */
import { SERVICES } from '../utils/OmniExtraKinds.js'
import * as M from '../utils/OmniCommModel.js'

export const STORE_KEY = 'omni:comm:v1'
const MAX_STORE = 400_000

export default class OmniCommunication {
  constructor (context, omniNode = null) {
    this.ctx = context; this.omniNode = omniNode; this.cfg = {}; this.inboxes = {}; this._t = null; this._inited = false; this._seq = 0
    M.TUNNELS.forEach(t => { this.cfg[t] = M.defaultConfig(); this.inboxes[t] = [] })
  }
  init () {
    if (this._inited) return; this._inited = true
    try { const raw = localStorage.getItem(STORE_KEY); if (raw && raw.length < MAX_STORE) { const s = M.sanitizeState(JSON.parse(raw)); this.cfg = s.cfg; this.inboxes = s.inbox } } catch (_) {}
    SERVICES.communication = this
  }
  update () {}
  onResize () {}
  destroy () { this._save(true); if (SERVICES.communication === this) SERVICES.communication = null; this._inited = false }

  // ── persistence + events ──
  _save (now = false) {
    clearTimeout(this._t)
    const write = () => { try { const s = JSON.stringify({ cfg: this.cfg, inbox: this.inboxes }); if (s.length < MAX_STORE) localStorage.setItem(STORE_KEY, s) } catch (_) {} }
    if (now) write(); else this._t = setTimeout(write, 250)
  }
  _emit (name, detail) { try { window.dispatchEvent(new CustomEvent(name, { detail })) } catch (_) {} }
  _changed (tunnel) { this._save(); this._emit('omni:comm-changed', { tunnel }) }
  _need (tunnel) { if (!M.isTunnel(tunnel)) throw new Error(`"${tunnel}" is not a tunnel (${M.TUNNELS.join(', ')})`); return tunnel }

  // ── reading ──
  config (tunnel) { return { ...this.cfg[this._need(tunnel)], allow: [...this.cfg[tunnel].allow] } }
  inbox (tunnel) { return this.inboxes[this._need(tunnel)].map(p => ({ ...p })) }
  get (tunnel, id) { return this.inboxes[this._need(tunnel)].find(p => p.id === id) ?? null }
  status () { return M.TUNNELS.map(t => ({ tunnel: t, name: M.TUNNEL_NAMES[t], ...this.config(t), count: this.inboxes[t].length })) }

  // ── receive settings ──
  setReceive (tunnel, open) { this.cfg[this._need(tunnel)].open = !!open; this._changed(tunnel); return this.cfg[tunnel].open }
  setMuted (tunnel, muted) { this.cfg[this._need(tunnel)].muted = !!muted; this._changed(tunnel); return this.cfg[tunnel].muted }
  setAllow (tunnel, list) { this.cfg[this._need(tunnel)].allow = Array.isArray(list) ? M.sanitizeAllow(list) : ['*']; this._changed(tunnel); return [...this.cfg[tunnel].allow] }
  setCap (tunnel, n) {
    const c = this.cfg[this._need(tunnel)]; c.cap = Math.round(Math.min(M.MAX_CAP, Math.max(1, Number(n) || M.DEFAULT_CAP)))
    const list = this.inboxes[tunnel]; while (list.length > c.cap) { const i = list.findIndex(p => !p.pinned); if (i < 0) break; list.splice(i, 1) }
    this._changed(tunnel); return c.cap
  }

  // ── sending ──
  _newId () { return 'p' + Date.now().toString(36) + (++this._seq).toString(36) + Math.random().toString(36).slice(2, 5) }
  _snapshot (nodeId) {
    const d = this.omniNode?.getNodeData?.(String(nodeId)); if (!d) throw new Error(`no node "${nodeId}"`)
    const snap = M.sanitizeNodeSnapshot(d); if (!snap) throw new Error(`"${d.label ?? nodeId}" is a special kind of node; only ordinary nodes can be sent for now`)
    return snap
  }
  _deliver (packet, plan, { from, muted: _ } = {}) {
    const to = packet.to, c = this.cfg[to]
    const r = M.addToInbox(this.inboxes[to], packet, c.cap)
    if (!r.ok) { const reason = `${M.TUNNEL_NAMES[to]} is ${r.reason}`; this._emit('omni:comm-refused', { reason, to }); return { ok: false, error: reason } }
    this.inboxes[to] = r.list; this._changed(to)
    this._emit('omni:comm-delivered', { packet: { ...packet }, to, muted: c.muted, dropped: r.dropped?.id ?? null })
    if (!c.muted) this._emit('omni:notify-info', { name: `⟐${M.TUNNEL_NAMES[to]} received`, desc: `${packet.kind === 'node' ? 'A node' : 'A message'} arrived: ${packet.label}${plan.hops.length > 1 ? ` (via ${plan.hops.slice(0, -1).map(h => M.TUNNEL_NAMES[h]).join(', ')})` : ''}`, holdMs: 3000 })
    return { ok: true, packet: { ...packet }, dropped: r.dropped?.id ?? null }
  }
  /** put a new piece into a tunnel. `node` is a node id, `text` is a message. */
  send ({ to, via = [], node, text, from = 'user', label } = {}) {
    try {
      if ((node === undefined) === (text === undefined)) throw new Error('send one thing: node(<id>) or text("...")')
      const sender = String(from).toLowerCase(); if (!M.SENDERS.includes(sender) && !M.isTunnel(sender)) throw new Error(`from must be user, external or a tunnel`)
      const plan = M.planRoute({ from: sender, to, via }, this.cfg); if (!plan.ok) { this._emit('omni:comm-refused', { reason: plan.reason, to }); return { ok: false, error: plan.reason } }
      const base = { id: this._newId(), from: sender, sender: plan.sender, to, via: plan.hops.slice(0, -1), path: plan.hops, at: Date.now(), state: 'zipped', pinned: false }
      const packet = node !== undefined ? M.sanitizePacket({ ...base, kind: 'node', node: this._snapshot(node), label }) : M.sanitizePacket({ ...base, kind: 'text', text, label })
      if (!packet) throw new Error('that cannot be sent (empty or not valid)')
      return this._deliver(packet, plan)
    } catch (e) { return { ok: false, error: e.message } }
  }
  /** move a piece you hold from one tunnel to another, through optional relays */
  route ({ id, from, to, via = [] } = {}) {
    try {
      this._need(from)
      const p = this.get(from, id); if (!p) throw new Error(`${M.TUNNEL_NAMES[from]} holds no piece "${id}"`)
      if (from === to) throw new Error('from and to are the same tunnel')
      const plan = M.planRoute({ from, to, via }, this.cfg); if (!plan.ok) { this._emit('omni:comm-refused', { reason: plan.reason, to }); return { ok: false, error: plan.reason } }
      const moved = { ...p, to, sender: plan.sender, via: [...p.via, from, ...plan.hops.slice(0, -1)].slice(-M.MAX_VIA), path: [...p.path, ...plan.hops].slice(-12), state: 'zipped' }
      // check the destination can take it before taking it out of the source
      const dest = this.cfg[to]; const probe = M.addToInbox(this.inboxes[to], moved, dest.cap); if (!probe.ok) { const reason = `${M.TUNNEL_NAMES[to]} is ${probe.reason}`; return { ok: false, error: reason } }
      this.inboxes[from] = this.inboxes[from].filter(x => x.id !== id); this._changed(from)
      return this._deliver(moved, plan)
    } catch (e) { return { ok: false, error: e.message } }
  }

  // ── pieces ──
  decipher (tunnel, id, on = true) { const p = this.get(tunnel, id); if (!p) return false; p.state = on ? 'deciphered' : 'zipped'; this._changed(tunnel); return true }
  pin (tunnel, id, on = true) { const p = this.get(tunnel, id); if (!p) return false; p.pinned = !!on; this._changed(tunnel); return true }
  drop (tunnel, id) { const n = this.inboxes[this._need(tunnel)].length; this.inboxes[tunnel] = this.inboxes[tunnel].filter(p => p.id !== id); const ok = this.inboxes[tunnel].length < n; if (ok) this._changed(tunnel); return ok }
  clear (tunnel, { pinned = false } = {}) { const n = this.inboxes[this._need(tunnel)].length; this.inboxes[tunnel] = pinned ? [] : this.inboxes[tunnel].filter(p => p.pinned); this._changed(tunnel); return n - this.inboxes[tunnel].length }
  /** take a piece out into the space */
  acquire (tunnel, id, { position } = {}) {
    try {
      const p = this.get(tunnel, id); if (!p) throw new Error(`${M.TUNNEL_NAMES[this._need(tunnel)]} holds no piece "${id}"`)
      const pos = Array.isArray(position) && position.length === 3 && position.every(Number.isFinite) ? position : this._front()
      const nid = 'acq_' + Math.random().toString(36).slice(2, 8)
      if (p.kind === 'node') this._emit('omni:node-create-request', { id: nid, label: p.node.label, geometry: p.node.geometry, primitive: p.node.primitive, color: p.node.color, position: pos, scale: p.node.scale, rotation: p.node.rotation, wireframe: p.node.wireframe, noParent: true, noSelect: true })
      else {   // a message becomes a note node holding its text
        const out = {}; this._emit('omni:note-node-create', { id: nid, position: pos, label: p.text.slice(0, 40), select: false, out })
        const esc = (t) => t.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
        try { SERVICES.note?.setHtml?.(out.nodeId ?? nid, p.text.split(/\n+/).map(l => `<p>${esc(l)}</p>`).join('')) } catch (_) {}
      }
      this.drop(tunnel, id); this._emit('omni:comm-acquired', { packet: { ...p }, id: nid })
      return { ok: true, id: nid, position: pos }
    } catch (e) { return { ok: false, error: e.message } }
  }
  _front () {
    const cam = this.ctx?.camera; if (!cam) return [0, 1, -5]
    const d = new cam.position.constructor(0, 0, -1).applyQuaternion(cam.quaternion)
    return [cam.position.x + d.x * 6, Math.max(0.5, cam.position.y + d.y * 6), cam.position.z + d.z * 6].map(n => Math.round(n * 100) / 100)
  }
}
