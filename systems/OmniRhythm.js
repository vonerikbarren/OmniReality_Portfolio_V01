/**
 * systems/OmniRhythm.js (V270) — the runtime of the RhythmNode: a BEAT SOURCE whose beats animate any node bound to it.
 *   CLOCK     a running rhythm fires its accented steps on time (performance.now; swing applied). Or it FOLLOWS a MusicNode: each hit of that node's track (omni:music-step) is a beat.
 *   BINDINGS  rhythm.bindings = [{ target, anim, amount, attack, decay, ease, every, accentOnly, delay, means, on }]. A beat starts the animation on every binding that is due.
 *             Binding adds a line with the "Drives" meaning (rhythm -> target); on an accent a light travels along it (rhythm.light).
 *   ANIMATE   the animation is an OFFSET over a remembered base (position / rotation / scale / glow). Nothing is written to the node's saved data; when the last animation ends the
 *             node is put back EXACTLY. Anything else that moves the node meanwhile (TransformBar, a drag, auto-rotation) is absorbed into the base. An idle binding costs nothing.
 *   SERVICES.rhythm: create(opts) getRhythm(id) setRhythm(id, patch) setStep(id, i, v) setPattern(id, text) setTempo(id, bpm) start(id) stop(id) toggle(id) tap(id) trigger(id, accent, step)
 *                    follow(id, musicNodeId|null, trackId) bind(id, target, anim, opts) unbind(id, bindingIdOrTarget) updateBinding(id, bindingId, patch) quickBind(target) list() activeId()
 *                    isRunning(id) activeTargets()     Events out: omni:rhythm-beat { nodeId, step, accent, beat }, omni:rhythm-changed { nodeId, reason }
 *   In: omni:rhythm-node-create { ...opts } (answer in detail.out).   Model: utils/OmniRhythmModel.js.  Mesh: utils/OmniRhythmNodeMesh.js.  Panel: ui/OmniRhythmPanel.js.  Commands: Omni Rhythm ...
 */
import * as THREE from 'three'
import * as R from '../utils/OmniRhythmModel.js'
import * as LM from '../utils/OmniLineModel.js'
import { KIND_RHYTHM, GEO_RHYTHM, SERVICES } from '../utils/OmniExtraKinds.js'
import { beatMesh, reactRhythmMesh, RHYTHM_LIVE } from '../utils/OmniRhythmNodeMesh.js'

const PIN_DISTANCE = 7, PERSIST_MS = 300, NODE_COLOR = '#ff9ad2', MAX_ANIMS = 8, SCAN_MS = 1000
const send = (n, d) => { try { window.dispatchEvent(new CustomEvent(n, { detail: d })) } catch (_) { /* no window */ } }
const newId = () => 'omni_' + Math.random().toString(36).slice(2, 8)
const nowS = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000
const WHITE = new THREE.Color(1, 1, 1)

export default class OmniRhythm {
  constructor (context, omniNode = null) {
    this.ctx = context; this.omniNode = omniNode ?? context?.omniNode ?? null; this._inited = false; this._bound = []; this._sane = new WeakMap(); this._persist = new Map()
    this._run = new Map(); this._anims = new Map(); this._active = null; this._taps = new Map(); this._autoDone = new Set(); this._scanAt = 0; this._seen = new Map(); this._lastT = null
  }
  init () {
    if (this._inited) return; this._inited = true
    const on = (n, fn) => { const h = (e) => fn(e.detail ?? {}, e); window.addEventListener(n, h); this._bound.push([n, h]) }
    on('omni:rhythm-node-create', (d, e) => { const out = this.request(d); if (e.detail && typeof e.detail === 'object') e.detail.out = out })
    on('omni:node-created', (d) => this._fixNode(d.node)); on('omni:node-deleted', (d) => this._gone(d.id)); on('omni:scene-clear-request', () => this._clearAll())
    on('omni:music-step', (d) => this._onMusicStep(d))
    this._syncAll(); SERVICES.rhythm = this
  }
  destroy () { this._clearAll(); this._persist.forEach(t => clearTimeout(t)); this._persist.clear(); for (const [n, h] of this._bound) window.removeEventListener(n, h); this._bound = []; if (SERVICES.rhythm === this) SERVICES.rhythm = null; this._inited = false }
  onResize () {}

  // ── store ──
  _data (id) { return this.omniNode?.getNodeData?.(id) ?? null }
  isRhythmNode (id) { return this._data(id)?.nodeKind === KIND_RHYTHM }
  list () { try { return (this.omniNode?.getAllNodes?.() ?? []).filter(d => d?.nodeKind === KIND_RHYTHM).map(d => d.id) } catch (_) { return [] } }
  activeId () { if (this._active && this.isRhythmNode(this._active)) return this._active; const l = this.list(); return l.length ? l[l.length - 1] : null }
  getRhythm (id) {
    const d = this._data(id); if (!d || d.nodeKind !== KIND_RHYTHM) return null
    const raw = d.rhythm; if (!raw || typeof raw !== 'object') { const m = R.defaultRhythm(); this._sane.set(m, m); d.rhythm = m; return m }
    let m = this._sane.get(raw); if (!m) { m = R.sanitizeRhythm(raw); this._sane.set(raw, m); this._sane.set(m, m) }
    return m
  }
  _need (id) { const r = this.getRhythm(id); if (!r) throw new Error('That is not a rhythm node.'); return r }
  setRhythm (id, patch, reason = 'edit') {
    const cur = this.getRhythm(id); const d = this._data(id); if (!cur || !d) return { ok: false, error: 'That is not a rhythm node.' }
    const next = R.sanitizeRhythm({ ...cur, ...(patch && typeof patch === 'object' ? patch : {}) }); this._sane.set(next, next); d.rhythm = next; this._active = id
    if (next.title !== cur.title) d.label = String(next.title).slice(0, 40)
    send('omni:rhythm-changed', { nodeId: id, reason }); this._persistSoon(id); return { ok: true, rhythm: next }
  }
  _persistSoon (id) { clearTimeout(this._persist.get(id)); this._persist.set(id, setTimeout(() => this.flush(id), PERSIST_MS)) }
  flush (id) { if (id) { clearTimeout(this._persist.get(id)); this._persist.delete(id) } const d = id ? this._data(id) : null; if (!d) return false; send('omni:force-save', {}); send('omni:node-updated', { node: d }); return true }
  setStep (id, i, v) { const r = this._need(id); const k = Math.floor(Number(i)); if (!(k >= 0 && k < r.steps.length)) throw new Error('step out of range'); const steps = r.steps.slice(); steps[k] = Math.min(1, Math.max(0, Number(v) || 0)); return this.setRhythm(id, { steps }, 'step').ok }
  setPattern (id, text) { return this.setRhythm(id, { steps: R.parsePattern(text) }, 'pattern').ok }
  setTempo (id, bpm) { const n = Number(bpm); if (!Number.isFinite(n)) throw new Error('tempo must be a number'); return this.setRhythm(id, { tempo: n }, 'tempo').ok }

  // ── creating ──
  _facing () {
    try { const cam = this.ctx.camera; cam.updateMatrixWorld?.(true); const e = cam.matrixWorld.elements
      const z = new THREE.Vector3(e[8], e[9], e[10]).normalize(), y = new THREE.Vector3(e[4], e[5], e[6]).normalize(); const x = new THREE.Vector3().crossVectors(y, z).normalize(), yy = new THREE.Vector3().crossVectors(z, x).normalize()
      const eu = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, yy, z)), 'XYZ'); return [eu.x, eu.y, eu.z].map(v => (Number.isFinite(v) ? v : 0)) } catch (_) { return [0, 0, 0] }
  }
  _positionFor (o) {
    const p = o.position; if (Array.isArray(p) && p.length >= 3 && p.slice(0, 3).every(Number.isFinite)) return [p[0], p[1], p[2]]
    const cam = this.ctx.camera; const dir = new THREE.Vector3(); cam.getWorldDirection(dir); const q = cam.position.clone().addScaledVector(dir, PIN_DISTANCE); return [q.x, q.y, q.z]
  }
  create (opts = {}) {
    try {
      const o = opts && typeof opts === 'object' ? opts : {}; const base = R.defaultRhythm()
      const steps = typeof o.pattern === 'string' ? R.parsePattern(o.pattern) : Array.isArray(o.steps) ? o.steps : base.steps
      const rhythm = R.sanitizeRhythm({ ...base, title: o.title || 'Rhythm', tempo: o.tempo ?? base.tempo, steps, swing: o.swing, autostart: o.autostart === true, means: o.means })
      const nodeId = typeof o.id === 'string' && /^[\w-]{1,64}$/.test(o.id) ? o.id : newId()
      send('omni:node-create-request', { nodeKind: KIND_RHYTHM, rhythm, id: nodeId, label: String(rhythm.title).slice(0, 40), geometry: GEO_RHYTHM, primitive: 'objective', color: NODE_COLOR, position: this._positionFor(o), rotation: [0, 0, 0], scale: [1, 1, 1], noParent: true, noSelect: o.select !== true })
      if (this.omniNode && !this._data(nodeId)) return { ok: false, error: 'The rhythm node could not be created.' }
      this._active = nodeId; return { ok: true, nodeId }
    } catch (err) { return { ok: false, error: String(err?.message ?? err) } }
  }
  /** the event form of create: also binds the selected node / a named one, starts it and opens the panel when asked */
  request (d = {}) {
    try {
      const sel = this.omniNode?.getSelectedId?.() ?? null; const ui = SERVICES.rhythmui
      if (d.bindTo) { const q = this.quickBind(String(d.bindTo)); if (d.start !== false && !this.isRunning(q.rhythmId)) this.start(q.rhythmId); if (d.openPanel) ui?.open?.(q.rhythmId); return { ok: true, nodeId: q.rhythmId, bindingId: q.bindingId } }
      const out = this.create(d); if (!out.ok) return out
      if (d.bindSelected && sel && sel !== out.nodeId && this._data(sel)) { try { this.bind(out.nodeId, sel, 'pulse') } catch (_) { /* could not bind it: the rhythm still exists */ } }
      if (d.start || d.autostart) this.start(out.nodeId); if (d.openPanel || d.select) { try { ui?.open?.(out.nodeId) } catch (_) { /* panel not running */ } }
      return out
    } catch (err) { return { ok: false, error: String(err?.message ?? err) } }
  }
  _fixNode (d) { if (!d || d.nodeKind !== KIND_RHYTHM) return; if (!d.rhythm || typeof d.rhythm !== 'object' || Array.isArray(d.rhythm)) { d.rhythm = R.defaultRhythm(); this._persistSoon(d.id) } this._scanAt = 0 }
  _syncAll () { try { for (const d of this.omniNode?.getAllNodes?.() ?? []) this._fixNode(d) } catch (_) { /* none yet */ } }

  // ── transport ──
  isRunning (id) { return !!this._run.get(id)?.running }
  start (id) { this._need(id); const t = nowS(); const s = this._run.get(id) ?? { beats: 0 }; Object.assign(s, { running: true, startedAt: t, lastG: -1, head: -1 }); this._run.set(id, s); this._active = id; send('omni:rhythm-changed', { nodeId: id, reason: 'start' }); return true }
  stop (id) { const s = this._run.get(id); if (s) { s.running = false; s.head = -1 } send('omni:rhythm-changed', { nodeId: id, reason: 'stop' }); return true }
  toggle (id) { return this.isRunning(id) ? (this.stop(id), false) : this.start(id) }
  tap (id) {
    const r = this._need(id); const t = nowS(); let taps = this._taps.get(id) ?? []; if (taps.length && t - taps[taps.length - 1] > 2) taps = []
    taps.push(t); taps = taps.slice(-6); this._taps.set(id, taps)
    if (taps.length >= 2) { const gaps = taps.slice(1).map((x, i) => x - taps[i]); const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length; this.setTempo(id, Math.round(60 / avg)) }
    this.trigger(id, 1, -1); return this.getRhythm(id).tempo ?? r.tempo
  }
  follow (id, musicNodeId, trackId = null) {
    this._need(id); if (musicNodeId && this._data(musicNodeId)?.nodeKind !== 'musicNode') throw new Error('That is not a music node.')
    return this.setRhythm(id, { follow: musicNodeId ? { nodeId: musicNodeId, trackId: trackId || null } : null }, 'follow').ok
  }
  _onMusicStep (d) {
    if (!d || !d.nodeId) return
    for (const [id, s] of this._run) {
      if (!s.running) continue; const r = this.getRhythm(id); const f = r?.follow; if (!f || f.nodeId !== d.nodeId || (f.trackId && f.trackId !== d.trackId)) continue
      const key = d.trackId + ':' + d.step; const t = nowS(); if (s.lastKey === key && t - (s.lastKeyT ?? 0) < 0.03) continue; s.lastKey = key; s.lastKeyT = t
      this.trigger(id, Math.min(1, Math.max(0.05, Number(d.velocity) || 1)), Number.isInteger(d.step) ? d.step % r.steps.length : -1)
    }
  }

  // ── beats ──
  trigger (id, accent = 1, step = -1) {
    const r = this._need(id); const s = this._run.get(id) ?? { beats: 0 }; this._run.set(id, s); const beatNo = s.beats++; const t = nowS()
    const mesh = this.omniNode?.getMeshById?.(id); if (mesh) beatMesh(mesh, step, accent)
    for (const b of r.bindings) {
      if (!R.shouldFire(b, beatNo, accent)) continue
      this._addAnim(b, t + b.delay, beatNo % 2 ? -1 : 1, accent)
      if (r.light && accent >= 0.75) { try { SERVICES.lines?.pulse?.({ path: [id, b.target] }) } catch (_) { /* no lines module */ } }
    }
    send('omni:rhythm-beat', { nodeId: id, step, accent, beat: beatNo }); return beatNo
  }
  _addAnim (b, t0, dir, accent) {
    const mesh = this.omniNode?.getMeshById?.(b.target); if (!mesh) return false
    let e = this._anims.get(b.target)
    if (!e) {
      const m = !Array.isArray(mesh.material) ? mesh.material : null
      e = { mesh, base: { p: mesh.position.toArray(), r: [mesh.rotation.x, mesh.rotation.y, mesh.rotation.z], s: mesh.scale.toArray() }, last: null, list: [], mat: m, matBase: m ? (m.emissive ? { kind: 'em', c: m.emissive.clone() } : m.color ? { kind: 'col', c: m.color.clone() } : null) : null, glowOn: false }
      this._anims.set(b.target, e)
    }
    e.list.push({ anim: b.anim, amount: b.amount * (0.4 + 0.6 * Math.min(1, accent || 1)), attack: b.attack, decay: b.decay, ease: b.ease, t0, dir, seed: (t0 * 13) % 1000 })
    if (e.list.length > MAX_ANIMS) e.list.shift(); return true
  }
  // ── per-frame ──
  update (delta = 0.016) {
    const now = nowS(); const dt = Math.min(0.1, this._lastT == null ? delta : now - this._lastT); this._lastT = now
    for (const [id, s] of this._run) {
      if (!s.running) continue; const r = this.getRhythm(id); if (!r) { this._run.delete(id); continue }
      if (r.follow) continue
      const due = R.dueSteps(r, s.startedAt, s.lastG, now); s.lastG = due.lastG
      for (const ev of due.events) { s.head = ev.step; this.trigger(id, ev.accent, ev.step) }
      if (!due.events.length && due.lastG >= 0) s.head = ((due.lastG % r.steps.length) + r.steps.length) % r.steps.length
    }
    for (const [target, e] of [...this._anims]) this._step(target, e, now)
    for (const mesh of RHYTHM_LIVE) { const id = mesh.userData?.nodeId; const r = id ? this.getRhythm(id) : null; if (r) reactRhythmMesh(mesh, r.steps, this._run.get(id)?.head ?? -1, !!this._run.get(id)?.running, dt) }
    if (now - this._scanAt > SCAN_MS) { this._scanAt = now; this._scan() }
  }
  _scan () { for (const id of this.list()) { const r = this.getRhythm(id); if (r?.autostart && !this._autoDone.has(id)) { this._autoDone.add(id); if (!this.isRunning(id)) this.start(id) } } }
  _syncBase (e) {
    const l = e.last; if (!l) return; const m = e.mesh
    const dp = Math.abs(m.position.x - l.p[0]) + Math.abs(m.position.y - l.p[1]) + Math.abs(m.position.z - l.p[2]); if (dp > 1e-5) for (let k = 0; k < 3; k++) e.base.p[k] = m.position.getComponent(k) - l.dp[k]
    const rr = [m.rotation.x, m.rotation.y, m.rotation.z]; if (Math.abs(rr[0] - l.r[0]) + Math.abs(rr[1] - l.r[1]) + Math.abs(rr[2] - l.r[2]) > 1e-5) for (let k = 0; k < 3; k++) e.base.r[k] = rr[k] - l.dr[k]
    const ds = Math.abs(m.scale.x - l.s[0]) + Math.abs(m.scale.y - l.s[1]) + Math.abs(m.scale.z - l.s[2]); if (ds > 1e-5) for (let k = 0; k < 3; k++) e.base.s[k] = m.scale.getComponent(k) / (l.fs[k] || 1)
  }
  _restore (e) {
    const m = e.mesh; m.position.fromArray(e.base.p); m.rotation.set(e.base.r[0], e.base.r[1], e.base.r[2]); m.scale.fromArray(e.base.s)
    if (e.mat && e.matBase && e.glowOn) { (e.matBase.kind === 'em' ? e.mat.emissive : e.mat.color).copy(e.matBase.c); e.glowOn = false }
    m.updateMatrixWorld?.(true)
  }
  _step (target, e, now) {
    const m = e.mesh
    if (!m || !m.parent || this.omniNode?.getMeshById?.(target) !== m) { this._anims.delete(target); return }
    this._syncBase(e)
    const pos = [0, 0, 0], rot = [0, 0, 0], sc = [0, 0, 0]; let glow = 0; let live = 0
    e.list = e.list.filter(a => now - a.t0 <= a.attack + a.decay)
    for (const a of e.list) {
      const age = now - a.t0; if (age < 0) { live++; continue } live++
      const span = Math.max(0.05, a.attack + a.decay); const env = R.envelope(age, a.attack, a.decay, a.ease); const o = R.offsetFor(a.anim, env, Math.min(1, age / span), a.amount, a.seed, a.dir)
      for (let k = 0; k < 3; k++) { pos[k] += o.pos[k]; rot[k] += o.rot[k]; sc[k] += o.scale[k] } glow = Math.max(glow, o.glow)
    }
    if (!live) { this._restore(e); this._anims.delete(target); return }
    const locked = !!m.userData?.behaviorLocked; const dp = locked ? [0, 0, 0] : pos
    m.position.set(e.base.p[0] + dp[0], e.base.p[1] + dp[1], e.base.p[2] + dp[2])
    m.rotation.set(e.base.r[0] + rot[0], e.base.r[1] + rot[1], e.base.r[2] + rot[2])
    const fs = sc.map(v => Math.max(0.05, 1 + v)); m.scale.set(e.base.s[0] * fs[0], e.base.s[1] * fs[1], e.base.s[2] * fs[2])
    if (e.mat && e.matBase && (glow > 0 || e.glowOn)) { const c = e.matBase.kind === 'em' ? e.mat.emissive : e.mat.color; c.copy(e.matBase.c).lerp(WHITE, Math.min(1, glow) * (e.matBase.kind === 'em' ? 0.9 : 0.7)); e.glowOn = glow > 0 }
    m.updateMatrixWorld?.(true)
    e.last = { p: m.position.toArray(), r: [m.rotation.x, m.rotation.y, m.rotation.z], s: m.scale.toArray(), dp, dr: rot, fs }
  }
  activeTargets () { return [...this._anims.keys()] }

  // ── bindings ──
  bind (id, target, anim = 'pulse', opts = {}) {
    const r = this._need(id); const t = String(target ?? ''); if (!t || t === id) throw new Error('Pick another node to move to the beat.')
    if (!this._data(t)) throw new Error('That node is not in the scene: ' + t)
    if (!R.ANIMS.includes(anim)) throw new Error('anim must be one of: ' + R.ANIMS.join(', '))
    const same = r.bindings.find(b => b.target === t && b.anim === anim); if (same) return same.id
    if (r.bindings.length >= R.LIMITS.bindings) throw new Error('This rhythm already drives ' + R.LIMITS.bindings + ' things.')
    const b = R.newBinding(t, anim, opts); const res = this.setRhythm(id, { bindings: [...r.bindings, b] }, 'bind'); if (!res.ok) throw new Error(res.error)
    try { if (this.omniNode?.connectNodes?.(id, t)) this.omniNode?.setEdgeStyle?.(id, t, LM.applyMeaning(null, 'drives')) } catch (_) { /* the line is a bonus */ }
    return b.id
  }
  unbind (id, key) {
    const r = this._need(id); const gone = r.bindings.filter(b => b.id === key || b.target === key); if (!gone.length) return false
    const keep = r.bindings.filter(b => !gone.includes(b)); this.setRhythm(id, { bindings: keep }, 'unbind')
    for (const t of new Set(gone.map(b => b.target))) {
      if (!keep.some(b => b.target === t)) { try { if (this.omniNode?.getEdgeStyle?.(id, t)?.meaning === 'drives') this.omniNode?.disconnectNodes?.(id, t) } catch (_) { /* line already gone */ } }
      if (!this._anyBinding(t)) this._dropAnim(t)
    }
    return true
  }
  updateBinding (id, bindingId, patch) { const r = this._need(id); if (!r.bindings.some(b => b.id === bindingId)) return false; return this.setRhythm(id, { bindings: r.bindings.map(b => (b.id === bindingId ? { ...b, ...(patch && typeof patch === 'object' ? patch : {}), id: b.id, target: b.target } : b)) }, 'binding').ok }
  _anyBinding (t) { return this.list().some(id => this.getRhythm(id)?.bindings.some(b => b.target === t)) }
  _dropAnim (t) { const e = this._anims.get(t); if (e) { this._restore(e); this._anims.delete(t) } }
  /** put any node on a beat in one go: uses the active rhythm (or makes one in front of the camera), binds a pulse, and starts it */
  quickBind (target, anim = 'pulse') {
    let rid = this.activeId(); if (!rid) { const c = this.create({ title: 'Rhythm', select: false }); if (!c.ok) throw new Error(c.error); rid = c.nodeId }
    const bindingId = this.bind(rid, target, anim); if (!this.isRunning(rid)) this.start(rid); return { rhythmId: rid, bindingId }
  }
  _gone (id) {
    this._run.delete(id); this._taps.delete(id); clearTimeout(this._persist.get(id)); this._persist.delete(id); this._autoDone.delete(id); if (this._active === id) this._active = null
    this._dropAnim(id)
    for (const rid of this.list()) { const r = this.getRhythm(rid); if (r?.bindings.some(b => b.target === id)) this.setRhythm(rid, { bindings: r.bindings.filter(b => b.target !== id) }, 'target-gone') }
    for (const [t, e] of [...this._anims]) if (!this._anyBinding(t)) this._dropAnim(t)
  }
  _clearAll () { for (const e of this._anims.values()) { try { this._restore(e) } catch (_) { /* mesh gone */ } } this._anims.clear(); this._run.clear(); this._taps.clear(); this._autoDone.clear(); this._active = null }
}
