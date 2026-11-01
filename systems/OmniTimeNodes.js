/**
 * systems/OmniTimeNodes.js (V259) — TimeNodes in the space. A TimeCube is a polyNode (data.time carries its entry); this module gives it:
 *   - its six faces (Start date, End date, Start time, End time, Title, Status) written into the poly faces,
 *   - the RING and the spinning ICOSAHEDRON that travels the ring as the time is fulfilled (paused + glowing when halted),
 *   - a FACE PANEL (docNode material) when a face is pressed, one at a time,
 *   - the line of cubes (a SEQUENCE: a new cube is joined to the one before by an ordinary line), per-cube clocks, halting, chaining, looping for analysis,
 *   - the OmniTimePad (a board of buttons; each runs a timed list of actions on cubes) and calendar views (filter by minute/hour/day/week/month/year; 14 spans).
 * SERVICES.timenodes = this ; SERVICES.timepad = the pad API. Commands: Omni Time ... (systems/OmniLangCommands.js)
 * Events out: omni:time-status { nodeId, status, progress }, omni:time-fulfilled { nodeId, sequence }, omni:time-changed { nodeId }, omni:time-panel { nodeId, face } , omni:timepad-changed.
 */
import * as THREE from 'three'
import { SERVICES, KIND_POLY, GEO_POLY, isTimeNodeData } from '../utils/OmniExtraKinds.js'
import * as T from '../utils/OmniTimeModel.js'
import * as PAD from '../utils/OmniTimePadModel.js'
import * as P from '../utils/OmniPolyModel.js'
import { buildShape } from '../utils/OmniPolyGeom.js'
import { livePolyMeshes } from '../utils/OmniPolyNodeMesh.js'
import { sanitizeClock, clockNow } from '../utils/OmniTimeClock.js'
import * as TL from '../utils/OmniTimeline.js'
import { buildTimeRig, updateTimeRig, disposeTimeRig, buildFacePanel, paintFacePanel, disposeFacePanel, STATUS_COLORS } from '../utils/OmniTimeNodeMesh.js'

export const PADS_KEY = 'omni:timepads:v1'
export const CLOCK_KEY = 'omni:timeclock:v1'
const TICK_MS = 100; const FACE_MS = 1000; const COLOR = '#9ad0ff'
const send = (n, d) => { try { window.dispatchEvent(new CustomEvent(n, { detail: d })) } catch (_) { /* no window */ } }
const newId = () => 'tn' + Date.now().toString(36) + Math.floor(Math.random() * 46656).toString(36)

export default class OmniTimeNodes {
  constructor (context, omniNode = null) {
    this.ctx = context; this.omniNode = omniNode ?? context?.omniNode ?? null
    this._rigs = new Map(); this._last = new Map(); this._faceSig = new Map(); this._faceAt = new Map(); this._persist = new Map()
    this._panel = null; this._panelFor = null; this._pads = []; this._timers = new Set(); this._bound = []; this._acc = 0; this._clock = 0; this._inited = false
    this._nowFn = null; this._clockCfg = sanitizeClock(null)
  }
  init () {
    if (this._inited) return; this._inited = true
    const on = (n, fn) => { const h = (e) => fn(e.detail ?? {}, e); window.addEventListener(n, h); this._bound.push([n, h]) }
    on('omni:node-deleted', (d) => this._gone(d.id)); on('omni:scene-clear-request', () => this._clearAll())
    on('omni:time-node-create', (d, e) => { const sel = this.omniNode?.getSelectedId?.() ?? this.omniNode?._selected ?? null; const out = this.createCube({ ...d, after: d.after ?? (sel && this.isTime(sel) ? sel : undefined) }); if (e.detail && typeof e.detail === 'object') e.detail.out = out })
    on('omni:time-panel-request', (d) => { if (d.action === 'close') this.closePanel() })
    on('omni:timepad-request', (d) => { if (d.action === 'press') this.pressButton(d.pad, d.button) })
    try { this._pads = PAD.sanitizePads(JSON.parse(localStorage.getItem(PADS_KEY))) } catch (_) { this._pads = [] }
    try { this._clockCfg = sanitizeClock(JSON.parse(localStorage.getItem(CLOCK_KEY))) } catch (_) { this._clockCfg = sanitizeClock(null) }
    SERVICES.timenodes = this; SERVICES.timepad = this
  }
  destroy () {
    for (const t of this._timers) clearTimeout(t); this._timers.clear(); this._clearAll()
    for (const [n, h] of this._bound) window.removeEventListener(n, h); this._bound = []
    if (SERVICES.timenodes === this) SERVICES.timenodes = null; if (SERVICES.timepad === this) SERVICES.timepad = null; this._inited = false
  }
  onResize () {}
  /** Tests / replays may set a different clock: fn() returns UTC ms. */
  setClock (fn) { this._nowFn = typeof fn === 'function' ? fn : null }
  /** The clock the cubes read: a test clock, else the chosen source (the computer's clock, or the OmniChronos playhead). */
  now () { if (this._nowFn) return this._nowFn(); let ph = 0; if (this._clockCfg.source === 'scene') { try { ph = TL.getT() } catch (_) { ph = 0 } } return clockNow(this._clockCfg, Date.now(), ph) }
  getClock () { return { ...this._clockCfg } }
  /** { source:'real'|'scene', origin (UTC ms of playhead 0), scale (scene seconds per playhead second) } */
  setClockConfig (cfg) { this._clockCfg = sanitizeClock({ ...this._clockCfg, ...(cfg && typeof cfg === 'object' ? cfg : {}) }); try { localStorage.setItem(CLOCK_KEY, JSON.stringify(this._clockCfg)) } catch (_) { /* full */ } send('omni:time-clock-changed', this.getClock()); return this.getClock() }

  // ── reading ──
  get poly () { return SERVICES.poly }
  getData (id) { return this.omniNode?.getNodeData?.(id) ?? null }
  isTime (id) { return isTimeNodeData(this.getData(id)) }
  list () { try { return (this.omniNode?.getAllNodes?.() ?? []).filter(isTimeNodeData).map(d => d.id) } catch (_) { return [] } }
  get (id) { const d = this.getData(id); return isTimeNodeData(d) ? T.sanitizeTime(d.time) : null }
  entry (id) { return this.get(id)?.entry ?? null }
  state (id) { const e = this.entry(id); return e ? T.stateOf(e, this.now()) : null }
  sequences () { const m = new Map(); for (const id of this.list()) { const t = this.getData(id).time; const s = t.sequence || 'seq'; if (!m.has(s)) m.set(s, []); m.get(s).push({ id, time: T.sanitizeTime(t) }) } return [...m.entries()].map(([sequence, nodes]) => ({ sequence, ids: T.orderSequence(nodes, sequence) })) }
  sequenceOf (id) { const s = this.get(id)?.sequence; return s ? this.sequences().find(q => q.sequence === s)?.ids ?? [] : [] }
  entriesOf (sequence = null) { const out = []; for (const q of this.sequences()) if (!sequence || q.sequence === sequence) for (const id of q.ids) out.push({ ...this.entry(id), id }); return out }
  /** Calendar view of one sequence (or all): T.viewData(...) with the node id on each item. */
  view (span = '7d', { sequence = null, anchor = null, zone = 'UTC', customDays = 30 } = {}) { return T.viewData(this.entriesOf(sequence), span, anchor ?? this.now(), { zone, customDays }) }
  filter (unit, key, { sequence = null, zone = 'UTC' } = {}) { return T.filterBy(this.entriesOf(sequence), unit, key, zone).map(e => e.id) }
  timeline (unit, from, to, { sequence = null, zone = 'UTC' } = {}) { return T.timeline(this.entriesOf(sequence), unit, from, to, zone) }

  // ── making and editing ──
  /** Make a TimeCube. { after: id of the cube before it (joins a line to it and shares its sequence), title, startDate, startTime, endDate, endTime, zone, bind, rate, label, position } */
  createCube (o = {}) {
    try {
      const opts = o && typeof o === 'object' ? o : {}; const prev = opts.after && this.isTime(opts.after) ? this.get(opts.after) : null
      const entry = T.newEntry({ ...opts, id: undefined }, { now: this.now() })
      const time = T.sanitizeTime({ sequence: prev?.sequence || opts.sequence || undefined, prev: prev ? opts.after : '', entry })
      const nodeId = typeof opts.id === 'string' && /^[\w-]{1,64}$/.test(opts.id) ? opts.id : newId()
      let pos = Array.isArray(opts.position) ? opts.position : null
      if (!pos && opts.after) { const pd = this.getData(opts.after); const pp = pd?.position; pos = Array.isArray(pp) ? [pp[0] + 3.6, pp[1], pp[2]] : null }
      if (!pos) { const r = SERVICES.poly?._positionFor?.({}); pos = Array.isArray(r) ? r : [0, 1.5, 0] }
      const poly = this._facesFor(P.sanitizePoly({ shape: 'cube' }), time.entry)
      send('omni:node-create-request', { nodeKind: KIND_POLY, poly, time, id: nodeId, label: String(opts.label || time.entry.title || 'TimeCube').slice(0, 40), geometry: GEO_POLY, primitive: 'objective', color: COLOR, position: pos, rotation: [0, 0, 0], scale: [1, 1, 1], parentId: prev ? opts.after : undefined, noParent: !prev, noSelect: opts.select !== true })
      if (this.omniNode && !this.getData(nodeId)) return { ok: false, error: 'The TimeCube could not be created.' }
      return { ok: true, nodeId, sequence: time.sequence }
    } catch (err) { return { ok: false, error: String(err?.message ?? err) } }
  }
  /** Turn an existing polyNode into a TimeCube (the starter "make this a TimeNode"). */
  convert (id, o = {}) {
    const d = this.getData(id); if (!d || d.nodeKind !== KIND_POLY) return { ok: false, error: 'Pick a poly node first.' }
    if (isTimeNodeData(d)) return { ok: true, nodeId: id }
    d.time = T.newTime({ entry: o }, { now: this.now() }); this.poly?.commit?.(id, this._facesFor(P.sanitizePoly({ shape: 'cube' }), d.time.entry), 'time'); this._changed(id); return { ok: true, nodeId: id }
  }
  setEntry (id, patch) { const t = this.get(id); if (!t) return { ok: false, error: 'That is not a TimeCube.' }; return this._put(id, { ...t, entry: T.edit(t.entry, patch) }) }
  _put (id, time) { const d = this.getData(id); if (!d) return { ok: false, error: 'No such node.' }; d.time = T.sanitizeTime(time); this._changed(id); return { ok: true, entry: d.time.entry } }
  _op (id, fn) { const t = this.get(id); if (!t) return { ok: false, error: 'That is not a TimeCube.' }; return this._put(id, { ...t, entry: fn(t.entry, this.now()) }) }
  activate (id) { return this._op(id, T.activate) }
  halt (id) { return this._op(id, T.halt) }
  resume (id) { return this._op(id, T.resume) }
  toggleHalt (id) { const e = this.entry(id); return e ? (e.halt.on ? this.resume(id) : this.halt(id)) : { ok: false, error: 'That is not a TimeCube.' } }
  reset (id) { return this._op(id, T.reset) }
  replay (id) { return this._op(id, T.replay) }
  haltSequence (sequence) { return this.sequences().find(q => q.sequence === sequence)?.ids.map(id => this.halt(id)) ?? [] }
  resumeSequence (sequence) { return this.sequences().find(q => q.sequence === sequence)?.ids.map(id => this.resume(id)) ?? [] }
  _changed (id) { this._faceSig.delete(id); this._flushSoon(id); send('omni:time-changed', { nodeId: id }) }
  _flushSoon (id) { clearTimeout(this._persist.get(id)); this._persist.set(id, setTimeout(() => { this._persist.delete(id); const d = this.getData(id); send('omni:force-save', {}); if (d) send('omni:node-updated', { node: d }) }, 800)) }

  // ── faces ──
  _facesFor (poly, entry, now = this.now()) {
    let p = P.sanitizePoly(poly); const tints = ['#e8f1ff', '#e8f1ff', '#fff3df', '#fff3df', '#eef9ee', '#f4ecff']
    T.FACES.forEach((f, i) => { if (i >= p.faces.length) return; const inf = T.faceInfo(entry, f, now); p = P.setFace(p, i, { label: inf.label.slice(0, 40), color: tints[i], tags: ['time', f.toLowerCase()], content: { type: 'text', text: '# ' + inf.value + '\n' + inf.lines.slice(0, 2).join('\n') } }) })
    return p
  }
  _syncFaces (id, t, now) {
    const st = T.stateOf(t.entry, now); const e = t.entry
    const sig = JSON.stringify([e.title, e.startUtc, e.endUtc, e.zone, e.bind, e.rate, e.repeat, e.loop, st.status, Math.floor(st.progress * 100)])
    if (this._faceSig.get(id) === sig) return
    const lastAt = this._faceAt.get(id) ?? 0
    if (now - lastAt < FACE_MS && this._faceSig.has(id)) return    // the status face changes at most once a second
    this._faceSig.set(id, sig); this._faceAt.set(id, now)
    const cur = this.poly?.getPoly?.(id); if (!cur) return
    this.poly.commit(id, this._facesFor(cur, e, now), 'time')
  }

  // ── per frame ──
  update (delta) {
    if (!this._inited) return
    const dt = Math.min(0.1, Math.max(0, Number(delta) || 0)); this._clock += dt; this._acc += dt * 1000
    // the rigs spin every frame; the clock logic runs a few times a second
    const run = this._acc >= TICK_MS; if (run) this._acc = 0
    const now = this.now()
    for (const id of this.list()) {
      const d = this.getData(id); const t = T.sanitizeTime(d.time); const s = T.stateOf(t.entry, now)
      if (run) this._logic(id, d, t, s, now)
      this._rig(id, s, dt)
    }
    this._keepPanel(now)
    for (const id of [...this._rigs.keys()]) if (!this.isTime(id)) this._dropRig(id)
  }
  _logic (id, d, t, s, now) {
    // looping (analysis) and chaining (start when the cube before is fulfilled) change the entry; everything else only reads it
    let e = t.entry
    if (e.loop) e = T.tickLoop(e, now)
    if (e.chain && e.bind === 'own' && e.activatedAt == null && t.prev && this.isTime(t.prev) && T.stateOf(this.entry(t.prev), now).fulfilled) e = T.activate(e, now)
    if (e !== t.entry && JSON.stringify(e) !== JSON.stringify(t.entry)) { d.time = T.sanitizeTime({ ...t, entry: e }); this._flushSoon(id); t = d.time; s = T.stateOf(e, now) }   // eslint-disable-line no-param-reassign
    const last = this._last.get(id)
    if (!last || last.status !== s.status) { this._last.set(id, { status: s.status }); send('omni:time-status', { nodeId: id, status: s.status, progress: s.progress }); if (s.status === 'fulfilled' && last && last.status !== 'fulfilled') send('omni:time-fulfilled', { nodeId: id, sequence: t.sequence }) }
    this._syncFaces(id, t, now)
  }
  _meshOf (id) { for (const m of livePolyMeshes()) if (m.userData?.nodeId === id) return m; return null }
  _rig (id, s, dt) {
    const mesh = this._meshOf(id); if (!mesh) return
    let rig = this._rigs.get(id)
    if (rig && rig.parent !== mesh) { disposeTimeRig(rig); this._rigs.delete(id); rig = null }
    if (!rig) { const edge = this.poly?.getPoly?.(id)?.edge ?? 2; rig = buildTimeRig(edge); mesh.add(rig); this._rigs.set(id, rig) }
    updateTimeRig(rig, s, dt, this._clock)
  }
  _dropRig (id) { disposeTimeRig(this._rigs.get(id)); this._rigs.delete(id); this._last.delete(id); this._faceSig.delete(id); this._faceAt.delete(id); clearTimeout(this._persist.get(id)); this._persist.delete(id); if (this._panelFor?.nodeId === id) this.closePanel() }
  _gone (id) { this._dropRig(id); this._pads = this._pads.map(p => PAD.pruneTargets(p, (t) => t !== id)); this._savePads() }
  _clearAll () { for (const id of [...this._rigs.keys()]) this._dropRig(id); this.closePanel() }
  rigOf (id) { return this._rigs.get(id) ?? null }
  rigStatus (id) { const r = this._rigs.get(id)?.userData?.time; return r ? { status: r.status, progress: r.progress, spin: r.spin, icoPosition: r.ico.position.toArray(), emissive: r.icoMat.emissiveIntensity } : null }

  // ── the face panel ──
  /** A face of a TimeCube was pressed (called by the poly system). Pressing the open face closes it; another face moves the panel. */
  faceClicked (nodeId, index) {
    if (!this.isTime(nodeId)) return false
    if (this._panelFor && this._panelFor.nodeId === nodeId && this._panelFor.index === index) { this.closePanel(); return true }
    this.openPanel(nodeId, index); return true
  }
  openPanel (nodeId, index) {
    this.closePanel(); const scene = this.ctx?.scene; const mesh = this._meshOf(nodeId); const poly = this.poly?.getPoly?.(nodeId)
    if (!scene || !mesh || !poly || index < 0 || index >= T.FACES.length) return false
    const panel = buildFacePanel(poly.edge, COLOR); scene.add(panel); this._panel = panel; this._panelFor = { nodeId, index, face: T.FACES[index] }
    this._placePanel(); this._paint(this.now()); send('omni:time-panel', { nodeId, face: T.FACES[index], index }); return true
  }
  closePanel () { if (!this._panel) return false; const f = this._panelFor; disposeFacePanel(this._panel); this._panel = null; this._panelFor = null; send('omni:time-panel', { nodeId: f?.nodeId ?? null, face: null, index: -1 }); return true }
  panelState () { return this._panelFor ? { ...this._panelFor } : null }
  _placePanel () {
    const f = this._panelFor; if (!f || !this._panel) return; const mesh = this._meshOf(f.nodeId); if (!mesh) return
    const poly = this.poly?.getPoly?.(f.nodeId); const sh = poly ? buildShape(poly) : null; const face = sh?.faces?.[f.index]; if (!face) return
    mesh.updateWorldMatrix(true, false)
    const n = new THREE.Vector3(...face.normal).transformDirection(mesh.matrixWorld).normalize(); const c = new THREE.Vector3(...face.center).applyMatrix4(mesh.matrixWorld)
    const reach = (poly.edge * 0.5) + this._panel.userData.tp.h / 2 + poly.edge * 0.55   // clears the cube and the ring
    this._panel.position.copy(c).addScaledVector(n, reach)
    const up = Math.abs(n.y) > 0.95 ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(0, 1, 0)
    this._panel.quaternion.setFromRotationMatrix(new THREE.Matrix4().lookAt(this._panel.position, this._panel.position.clone().add(n), up))
  }
  _paint (now) { const f = this._panelFor; if (!f || !this._panel) return; const e = this.entry(f.nodeId); if (!e) return; const s = T.stateOf(e, now); paintFacePanel(this._panel, T.faceInfo(e, f.face, now), STATUS_COLORS[s.status] ?? '#2c7be5') }
  _keepPanel (now) { if (!this._panelFor) return; if (!this.isTime(this._panelFor.nodeId) || !this._meshOf(this._panelFor.nodeId)) return this.closePanel(); this._placePanel(); if (Math.floor(now / 500) !== this._pn) { this._pn = Math.floor(now / 500); this._paint(now) } }

  // ── the OmniTimePad ──
  pads () { return this._pads.map(p => PAD.sanitizePad(p)) }
  _savePads () { try { localStorage.setItem(PADS_KEY, JSON.stringify(this._pads)) } catch (_) { /* full */ } send('omni:timepad-changed', { pads: this._pads.length }) }
  loadPads (list, mode = 'replace') { const next = PAD.sanitizePads(list); this._pads = mode === 'merge' ? PAD.sanitizePads([...this._pads, ...next]) : next; this._savePads(); return this._pads.length }
  createPad (name) { if (this._pads.length >= PAD.LIMITS.pads) return { ok: false, error: 'You have the most pads allowed.' }; const p = PAD.newPad(name); this._pads.push(p); this._savePads(); return { ok: true, pad: p } }
  _padIdx (id) { const i = this._pads.findIndex(p => p.id === id || p.name === id); return i }
  _padEdit (padId, fn) { const i = this._padIdx(padId); if (i < 0) return { ok: false, error: 'No such pad.' }; try { this._pads[i] = fn(this._pads[i]); this._savePads(); return { ok: true, pad: this._pads[i] } } catch (err) { return { ok: false, error: String(err?.message ?? err) } } }
  addPadButton (padId, o) { return this._padEdit(padId, (p) => PAD.addButton(p, o)) }
  addPadAction (padId, buttonId, a) { return this._padEdit(padId, (p) => PAD.addAction(p, buttonId, a)) }
  removePadButton (padId, buttonId) { return this._padEdit(padId, (p) => PAD.removeButton(p, buttonId)) }
  deletePad (padId) { const i = this._padIdx(padId); if (i < 0) return false; this._pads.splice(i, 1); this._savePads(); return true }
  /** Press a button: its actions run in order, each after its delay. Returns { ok, scheduled }. */
  pressButton (padId, buttonId) {
    const i = this._padIdx(padId); if (i < 0) return { ok: false, error: 'No such pad.' }
    const b = this._pads[i].buttons.find(x => x.id === buttonId || x.label === buttonId); if (!b) return { ok: false, error: 'No such button.' }
    const now = this.now(); const plan = PAD.planPress(this._pads[i], b.id, now); let n = 0
    for (const a of plan) {
      const run = () => { this._timers.delete(h); this.runOp(a.op, a.target) }
      const h = a.at <= 0 ? null : setTimeout(run, a.at)
      if (h) this._timers.add(h); else this.runOp(a.op, a.target)
      n++
    }
    send('omni:timepad-pressed', { pad: this._pads[i].id, button: b.id, actions: n }); return { ok: true, scheduled: n }
  }
  runOp (op, id) {
    if (!this.isTime(id)) return { ok: false, error: 'That cube is gone.' }
    switch (op) {
      case 'activate': return this.activate(id); case 'halt': return this.halt(id); case 'resume': return this.resume(id); case 'reset': return this.reset(id); case 'replay': return this.replay(id)
      case 'loop-on': return this.setEntry(id, { loop: true }); case 'loop-off': return this.setEntry(id, { loop: false })
      default: return { ok: false, error: 'Unknown op.' }
    }
  }
}
