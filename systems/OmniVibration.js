/**
 * systems/OmniVibration.js — OmniVibration (V216): looped, rhythmic motion for YOU and for any node.
 *
 *   start(target, program, opts) -> run id     target: 'user' | a node id.   program: id of a saved program, or a program object.
 *   stop(target|runId, { immediate })          lets go through the program's release (immediate = snap back)
 *   stopAll()   runs()   programs()   getProgram(id)   saveProgram(p)   deleteProgram(id)
 *   opts: { attack, hold, release }            override the program's envelope: hold = seconds to sustain, 0 = until stopped.
 *
 * It is ADDITIVE: a program is an offset on top of where the thing already is.
 *  - A node gets its offset applied to its mesh (position / rotation / scale / glow) and takes it away again afterwards. If anything else moves the node in
 *    the meantime (a drag, a behaviour) that new place simply becomes the base. While it runs the node's saved position stays its base (userData.restPosition),
 *    and OmniNodeBehavior reads the base (userData.__vibBase) as its rest pose, so neither ever bakes the bounce in.
 *  - YOU is a view effect only: the camera and its orbit target are shifted together by the position offset (the same rigid shift the avatar's follow camera uses,
 *    so OrbitControls and following stay happy), and the avatar capsule gets the full pose (bob, sway, turn, squash). Your real position is never changed.
 *    `userCamOffset` is what is in the camera right now; OmniAvatar subtracts it before deciding whether you moved the camera yourself.
 *
 * Events in:  omni:vibration-start { target, programId | program, attack?, hold?, release? }, omni:vibration-stop { target?, runId?, immediate? }
 * Events out: omni:vibration-changed { runs }, omni:vibration-programs-changed
 * Registers Extra.SERVICES.vibration. Custom programs live in localStorage 'omni:vibration:v1'.
 */
import * as THREE from 'three'
import { SERVICES } from '../utils/OmniExtraKinds.js'
import { PRESETS, sanitizeProgram, poseAt } from '../utils/OmniVibrationModel.js'
import { getTimeScale, getLoopWindow } from '../utils/OmniTimeScale.js'   // V217

export const STORE_KEY = 'omni:vibration:v1'
const DEG = Math.PI / 180
const EPS2 = 1e-9

export default class OmniVibration {
  constructor (context, omniNode = null, getControls = () => null) {
    this.ctx = context; this.omniNode = omniNode; this._controls = getControls
    this._custom = new Map(); this._runs = new Map(); this._seq = 0; this._bound = []; this._inited = false
    this._nodes = new Map()                    // nodeId -> applied record
    this.userCamOffset = new THREE.Vector3()   // what is in the camera right now
    this.userExtra = new THREE.Vector3()       // V220: added on top of the programs' pose (OmniBoost's blink); the same rigid view shift
    this.userPose = { pos: new THREE.Vector3(), rot: new THREE.Euler(), scale: 0, glow: 0, active: false }
    this._camPaused = false
  }

  init () {
    if (this._inited) return; this._inited = true
    try { const s = JSON.parse(localStorage.getItem(STORE_KEY)); if (s && Array.isArray(s.custom)) s.custom.slice(0, 64).forEach(p => { const q = sanitizeProgram(p); if (!PRESETS.some(b => b.id === q.id)) this._custom.set(q.id, q) }) } catch (_) {}
    const on = (t, fn) => { const h = (e) => fn(e.detail ?? {}); window.addEventListener(t, h); this._bound.push([t, h]) }
    on('omni:vibration-start', (d) => this.start(d.target ?? 'user', d.program ?? d.programId, d))
    on('omni:vibration-stop', (d) => { if (d.runId) this.stop(d.runId, d); else if (d.target) this.stop(d.target, d); else this.stopAll(d) })
    // a camera tween (take-me-there) rewrites the camera pose outright: our offset went with it
    on('omni:orbit-disable', () => { this._camPaused = true; this.userCamOffset.set(0, 0, 0) })
    on('omni:orbit-enable', () => { this._camPaused = false })
    SERVICES.vibration = this
  }
  destroy () {
    for (const [t, h] of this._bound) window.removeEventListener(t, h); this._bound = []
    this.stopAll({ immediate: true }); this._flush(true)
    if (SERVICES.vibration === this) SERVICES.vibration = null; this._inited = false
  }
  onResize () {}

  // ── programs ──
  programs () { return [...PRESETS, ...this._custom.values()] }
  getProgram (id) { return PRESETS.find(p => p.id === id) ?? this._custom.get(id) ?? null }
  saveProgram (p) {
    const q = sanitizeProgram(p)
    if (PRESETS.some(b => b.id === q.id)) q.id = 'vib_' + Math.random().toString(36).slice(2, 8)   // a built-in is copied, never overwritten
    this._custom.set(q.id, q); this._persist(); this._emit('omni:vibration-programs-changed', {}); return q
  }
  deleteProgram (id) { const ok = this._custom.delete(id); if (ok) { this._persist(); this._emit('omni:vibration-programs-changed', {}) } return ok }
  _persist () { try { localStorage.setItem(STORE_KEY, JSON.stringify({ custom: [...this._custom.values()] })) } catch (_) {} }
  _emit (name, detail) { try { window.dispatchEvent(new CustomEvent(name, { detail })) } catch (_) {} }

  // ── runs ──
  start (target, program, opts = {}) {
    const prog = typeof program === 'string' ? this.getProgram(program) : (program && typeof program === 'object' ? sanitizeProgram(program) : null)
    if (!prog) return null
    if (target !== 'user' && !(this.omniNode?.getMeshById?.(target))) return null
    const env = { ...prog.envelope }
    for (const k of ['attack', 'hold', 'release']) if (Number.isFinite(Number(opts[k])) && opts[k] !== null && opts[k] !== '') env[k] = Math.max(0, Number(opts[k]))
    const id = 'run' + (++this._seq)
    this._runs.set(id, { id, target, program: { ...prog, envelope: env }, t: 0, releaseAt: null, immediate: false })
    this._emit('omni:vibration-changed', { runs: this.runs() })
    return id
  }
  /** by run id, or by target (every run on it). Releases through the program's release unless immediate. */
  stop (what, opts = {}) {
    let n = 0
    for (const r of this._runs.values()) {
      if (r.id !== what && r.target !== what) continue
      n++
      if (opts.immediate) { r.immediate = true; r.releaseAt = r.t }
      else if (r.releaseAt === null) r.releaseAt = r.t
    }
    if (n) this._emit('omni:vibration-changed', { runs: this.runs() })
    return n
  }
  stopAll (opts = {}) { for (const r of this._runs.values()) this.stop(r.id, opts); return this._runs.size }
  runs () { return [...this._runs.values()].map(r => ({ id: r.id, target: r.target, program: r.program.id, name: r.program.name, t: r.t, releasing: r.releaseAt !== null })) }
  isRunning (target) { for (const r of this._runs.values()) if (r.target === target) return true; return false }

  // ── per frame ──
  update (dt = 0.016) {
    dt = Math.min(Math.max(dt, 0), 0.1) * getTimeScale()   // V217: the Time axiom (hyperlapse / slow-mo / a held moment)
    const loop = getLoopWindow()                           // V217: looped event: looping motion repeats every `loop` seconds
    const sums = new Map()           // target -> summed pose
    const finished = []
    for (const r of this._runs.values()) {
      r.t += dt
      if (r.target !== 'user' && !this.omniNode?.getMeshById?.(r.target)) { finished.push(r.id); continue }   // the node is gone
      let pose = poseAt(r.program, r.t, r.releaseAt, loop > 0 ? r.t % loop : r.t)
      if (r.immediate) pose = { pos: [0, 0, 0], rot: [0, 0, 0], scale: 0, glow: 0, gain: 0, done: true }
      if (pose.done) finished.push(r.id)
      let s = sums.get(r.target)
      if (!s) { s = { pos: [0, 0, 0], rot: [0, 0, 0], scale: 0, glow: 0 }; sums.set(r.target, s) }
      for (let i = 0; i < 3; i++) { s.pos[i] += pose.pos[i]; s.rot[i] += pose.rot[i] }
      s.scale += pose.scale; s.glow += pose.glow
    }
    // targets that just lost their last run still need one apply with a zero pose to be put back
    for (const id of this._nodes.keys()) if (!sums.has(id)) sums.set(id, null)
    sums.set('user', sums.get('user') ?? null)
    for (const [target, pose] of sums) {
      if (target === 'user') this._applyUser(pose)
      else this._applyNode(target, pose)
    }
    if (finished.length) { for (const id of finished) this._runs.delete(id); this._emit('omni:vibration-changed', { runs: this.runs() }) }
  }

  // ── you ──
  _applyUser (pose) {
    const P = this.userPose
    const p = pose ?? { pos: [0, 0, 0], rot: [0, 0, 0], scale: 0, glow: 0 }
    P.pos.set(p.pos[0], p.pos[1], p.pos[2]); P.rot.set(p.rot[0] * DEG, p.rot[1] * DEG, p.rot[2] * DEG); P.scale = p.scale; P.glow = p.glow; P.active = !!pose
    const cam = this.ctx.camera; if (!cam) return
    if (this._camPaused) return
    const want = this._want ?? (this._want = new THREE.Vector3()); want.copy(P.pos).add(this.userExtra)
    if (want.distanceToSquared(this.userCamOffset) < EPS2) return
    const d = want.clone().sub(this.userCamOffset)
    cam.position.add(d); const ctl = this._controls(); ctl?.target?.add(d)
    this.userCamOffset.copy(want)
  }

  // ── nodes ──
  _applyNode (id, pose) {
    const mesh = this.omniNode?.getMeshById?.(id)
    let rec = this._nodes.get(id)
    if (!mesh) { this._nodes.delete(id); return }
    const zero = !pose || (!pose.pos.some(Boolean) && !pose.rot.some(Boolean) && !pose.scale && !pose.glow)
    if (rec) this._undo(mesh, rec)
    if (zero && !this.isRunning(id)) { if (rec) this._end(mesh, rec); this._nodes.delete(id); return }
    if (zero) { if (rec) { rec.applied = null } return }
    if (!rec) {
      rec = { base: { p: mesh.position.clone(), q: mesh.quaternion.clone(), s: mesh.scale.clone() }, ownRest: false, e0: null, applied: null }
      mesh.userData.__vibBase = rec.base
      if (!mesh.userData.restPosition) { mesh.userData.restPosition = rec.base.p; rec.ownRest = true }
      const m = mesh.material
      if (m && !Array.isArray(m) && m.emissive) rec.e0 = m.emissiveIntensity ?? 1
      this._nodes.set(id, rec)
    }
    // base follows wherever the node is now (undo left it there, or something else moved it)
    rec.base.p.copy(mesh.position); rec.base.q.copy(mesh.quaternion); rec.base.s.copy(mesh.scale)
    const dpos = new THREE.Vector3(pose.pos[0], pose.pos[1], pose.pos[2])
    const dq = new THREE.Quaternion().setFromEuler(new THREE.Euler(pose.rot[0] * DEG, pose.rot[1] * DEG, pose.rot[2] * DEG))
    const k = Math.max(0.05, 1 + pose.scale)
    mesh.position.add(dpos); mesh.quaternion.premultiply(dq); mesh.scale.multiplyScalar(k)
    if (rec.e0 !== null) mesh.material.emissiveIntensity = rec.e0 + pose.glow * 2
    rec.applied = { dpos, dq, k, glow: pose.glow, left: { p: mesh.position.clone(), q: mesh.quaternion.clone(), s: mesh.scale.clone() } }
  }
  /** take our last offset back off, but only from the parts nobody else has touched since */
  _undo (mesh, rec) {
    const a = rec.applied; if (!a) return
    if (mesh.position.distanceToSquared(a.left.p) < EPS2) mesh.position.sub(a.dpos)
    if (Math.abs(mesh.quaternion.dot(a.left.q)) > 1 - 1e-9) mesh.quaternion.premultiply(a.dq.clone().invert())
    if (mesh.scale.distanceToSquared(a.left.s) < EPS2) mesh.scale.multiplyScalar(1 / a.k)
    if (rec.e0 !== null && a.glow) mesh.material.emissiveIntensity = rec.e0
    rec.applied = null
  }
  _end (mesh, rec) {
    if (rec.e0 !== null) mesh.material.emissiveIntensity = rec.e0
    if (mesh.userData.__vibBase === rec.base) delete mesh.userData.__vibBase
    if (rec.ownRest && mesh.userData.restPosition === rec.base.p) delete mesh.userData.restPosition
  }
  /** put everything back (destroy) */
  _flush () {
    for (const [id, rec] of this._nodes) { const mesh = this.omniNode?.getMeshById?.(id); if (mesh) { this._undo(mesh, rec); this._end(mesh, rec) } }
    this._nodes.clear()
    const cam = this.ctx.camera
    if (cam && this.userCamOffset.lengthSq() > 0) { cam.position.sub(this.userCamOffset); this._controls()?.target?.sub(this.userCamOffset); this.userCamOffset.set(0, 0, 0) }
    this.userPose.active = false
  }
}
