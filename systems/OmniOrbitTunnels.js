/**
 * systems/OmniOrbitTunnels.js (V283) — the two default OrbitTunnels (horizontal + vertical) in every reality, and orbitTraversal.
 * Model utils/OmniOrbitTunnelModel.js · body utils/OmniOrbitTunnelMesh.js · panel ui/OmniOrbitTunnelPanel.js.
 * Settings are the user's preferences: saved in this browser ('omni:orbittunnels:v1'), editable in the panel.
 *
 * SERVICES.orbitTunnels: get(id) all() prefs() set(id, patch) setPrefs(patch) reset(id) resetSize(id) enter(id) exit() pause(on) state()
 *                        setLocalMedia(id, file) clearLocalMedia(id)
 * Events in : omni:orbit-tunnel-panel-toggle · omni:orbit-tunnel-enter {id} · omni:orbit-tunnel-exit · omni:orbit-tunnel-set {id, patch}
 * Events out: omni:orbit-tunnel-changed {prefs, ride}  ·  omni:orbit-tunnel-ride {state: 'enter'|'next'|'exit', id}
 * orbitTraversal: a corkscrew round the INSIDE of the tube wall (forward along the ring + circling the wall). The first tunnel you enter
 * is ridden `loops` times, then the other if it is ticked, then you are flown back to where you were. The camera is only moved while riding.
 * Reaching a tube (e.g. at the end of a regular tunnel) enters it by itself when "auto enter" is on.
 */
import * as THREE from 'three'
import gsap from 'gsap'
import * as M from '../utils/OmniOrbitTunnelModel.js'
import { buildOrbitTunnel } from '../utils/OmniOrbitTunnelMesh.js'
import { SERVICES } from '../utils/OmniExtraKinds.js'
import { getTimeScale } from '../utils/OmniTimeScale.js'

export const STORE_KEY = 'omni:orbittunnels:v1'
const send = (n, d = {}) => window.dispatchEvent(new CustomEvent(n, { detail: d }))
const clone = (o) => JSON.parse(JSON.stringify(o))
const merge = (base, patch) => { const out = Array.isArray(base) ? [...base] : { ...base }; for (const k of Object.keys(patch && typeof patch === 'object' ? patch : {})) { if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue; const v = patch[k]; out[k] = v && typeof v === 'object' && !Array.isArray(v) && base && typeof base[k] === 'object' ? merge(base[k], v) : v } return out }

export default class OmniOrbitTunnels {
  constructor (context, omniNode = null) {
    this.ctx = context; this.omniNode = omniNode ?? context?.omniNode ?? null
    this._prefs = M.defaultPrefs(); this._bodies = {}; this._bound = []; this._ride = null; this._tw = null; this._armed = false; this._cool = 0; this._local = new Map(); this._saveT = 0; this._sendT = 0
  }
  init () {
    if (this._inited) return; this._inited = true
    try { this._prefs = M.sanitizePrefs(JSON.parse(localStorage.getItem(STORE_KEY))) } catch (_) { this._prefs = M.defaultPrefs() }
    const on = (n, f) => { window.addEventListener(n, f); this._bound.push([n, f]) }
    on('omni:orbit-tunnel-enter', (e) => this.enter(e.detail?.id))
    on('omni:orbit-tunnel-exit', () => this.exit())
    on('omni:orbit-tunnel-set', (e) => { if (e.detail?.prefs) this.setPrefs(e.detail.prefs); if (e.detail?.id) this.set(e.detail.id, e.detail.patch ?? {}) })
    on('keydown', (e) => { if (e.key === 'Escape' && this._ride) this.exit() })
    this._build(); SERVICES.orbitTunnels = this
  }
  destroy () {
    for (const [n, f] of this._bound) window.removeEventListener(n, f); this._bound = []
    this._tw?.kill(); this._tw = null; if (this._ride) this._release(false); clearTimeout(this._saveT); this._flush()
    for (const id of M.IDS) { this._bodies[id]?.dispose(); delete this._bodies[id] }
    for (const v of this._local.values()) { try { URL.revokeObjectURL(v.url) } catch (_) { /* done */ } } this._local.clear()
    if (SERVICES.orbitTunnels === this) delete SERVICES.orbitTunnels
  }
  onResize () {}

  // ── settings ──
  get (id) { return clone(this._prefs.tunnels[id === 'vertical' ? 'vertical' : 'horizontal']) }
  all () { return clone(this._prefs.tunnels) }
  prefs () { return clone(this._prefs) }
  state () { const r = this._ride; return { riding: !!r, id: r ? r.queue[r.i] : null, queue: r ? [...r.queue] : [], lap: r ? r.s.lap : 0, loops: this._prefs.loops, paused: !!r?.paused, phase: r?.phase ?? 'idle', text: r ? M.describeRide(r.queue, r.i, r.s.lap, this._prefs.loops) : 'Not riding' } }
  set (id, patch) {
    try {
      const k = id === 'vertical' ? 'vertical' : 'horizontal'
      this._prefs.tunnels[k] = M.sanitizeOrbitTunnel({ ...merge(this._prefs.tunnels[k], patch), id: k })
      this._bodies[k]?.apply(this._prefs.tunnels[k]); this._changed(); return this.get(k)
    } catch (_) { return null }
  }
  setPrefs (patch) {
    try { const keep = this._prefs.tunnels; const next = M.sanitizePrefs({ ...merge(this._prefs, { ...patch, tunnels: undefined }), tunnels: keep }); this._prefs = next; this._changed(); return this.prefs() } catch (_) { return null }
  }
  reset (id) { const k = id === 'vertical' ? 'vertical' : 'horizontal'; this._prefs.tunnels[k] = M.defaultTunnel(k); this._bodies[k]?.apply(this._prefs.tunnels[k]); this._changed(); return this.get(k) }
  /** back to "as far as the regular tunnels go" */
  resetSize (id) { return this.set(id, { radius: M.TUNNEL_REACH, tube: M.defaultTunnel(id).tube }) }
  setLocalMedia (id, file) {
    try {
      const k = id === 'vertical' ? 'vertical' : 'horizontal'; if (!file || !/^(image|video)\//.test(file.type || '')) return false
      const old = this._local.get(k); if (old) { try { URL.revokeObjectURL(old.url) } catch (_) { /* done */ } }
      this._local.set(k, { url: URL.createObjectURL(file), kind: file.type.startsWith('video') ? 'video' : 'image' })
      this.set(k, { mode: 'solid' }); this._bodies[k]?.apply(this._prefs.tunnels[k]); return true
    } catch (_) { return false }
  }
  clearLocalMedia (id) { const k = id === 'vertical' ? 'vertical' : 'horizontal'; const old = this._local.get(k); if (old) { try { URL.revokeObjectURL(old.url) } catch (_) { /* done */ } this._local.delete(k); this._bodies[k]?.apply(this._prefs.tunnels[k]); this._changed() } }
  hasLocalMedia (id) { return this._local.has(id) }
  _flush () { try { localStorage.setItem(STORE_KEY, JSON.stringify(this._prefs)) } catch (_) { /* full / private */ } }
  _changed () { clearTimeout(this._saveT); this._saveT = setTimeout(() => this._flush(), 300); this._announce() }
  _announce () { send('omni:orbit-tunnel-changed', { prefs: this.prefs(), ride: this.state() }) }

  _build () {
    const scene = this.ctx?.scene; if (!scene) return
    for (const id of M.IDS) { const b = buildOrbitTunnel(this._prefs.tunnels[id], { localMedia: this._local }); this._bodies[id] = b; scene.add(b.group) }
  }

  // ── the ride ──
  enter (id) {
    try {
      const cam = this.ctx?.camera; if (!cam || !this._bodies.horizontal) return { ok: false, error: 'There is no camera yet.' }
      const first = id === 'vertical' ? 'vertical' : 'horizontal'
      if (this._ride) this._release(false)
      const queue = M.planQueue(first, this._prefs.enabled)
      for (const q of queue) if (!this._prefs.tunnels[q].visible) this.set(q, { visible: true })
      this._prev = { pos: cam.position.clone(), quat: cam.quaternion.clone() }
      this._ride = { queue, i: 0, s: { theta: M.nearestTheta(this._prefs.tunnels[first], cam.position.toArray()), phi: -Math.PI / 2, travelled: 0, lap: 0, done: false }, phase: 'fly', paused: false }
      send('omni:orbit-disable', {}); send('omni:orbit-tunnel-ride', { state: 'enter', id: first })
      this._flyIn(0.0); this._announce(); return { ok: true, id: first }
    } catch (err) { return { ok: false, error: String(err?.message ?? err) } }
  }
  /** fly (smoothly) from where the camera is to the wall pose of the current tunnel, then ride */
  _flyIn () {
    const r = this._ride; const cam = this.ctx.camera; const spec = this._prefs.tunnels[r.queue[r.i]]
    r.phase = 'fly'
    const from = cam.position.clone(); const fromQ = cam.quaternion.clone(); const pose = M.camPose(spec, r.s.theta, r.s.phi, this._prefs.direction)
    const toPos = new THREE.Vector3(...pose.pos); const m = new THREE.Matrix4(); cam.up.set(...pose.up)
    const tmp = new THREE.Object3D(); tmp.position.copy(toPos); tmp.up.set(...pose.up); tmp.lookAt(new THREE.Vector3(...pose.look)); const toQ = tmp.quaternion.clone(); void m
    const proxy = { t: 0 }; this._tw?.kill()
    this._tw = gsap.to(proxy, { t: 1, duration: Math.min(5, Math.max(1.2, from.distanceTo(toPos) / 6000)), ease: 'power2.inOut',
      onUpdate: () => { cam.position.lerpVectors(from, toPos, proxy.t); cam.quaternion.slerpQuaternions(fromQ, toQ, proxy.t) },
      onComplete: () => { this._tw = null; if (this._ride === r) { r.phase = 'ride'; this._announce() } } })
  }
  exit () {
    const r = this._ride; if (!r) return false
    const cam = this.ctx?.camera; const prev = this._prev
    this._tw?.kill(); this._tw = null
    if (!cam || !prev || !this._prefs.returnWhenDone) { this._release(true); return true }
    r.phase = 'return'; this._announce()
    const from = cam.position.clone(); const fromQ = cam.quaternion.clone(); const proxy = { t: 0 }
    this._tw = gsap.to(proxy, { t: 1, duration: Math.min(5, Math.max(1.2, from.distanceTo(prev.pos) / 6000)), ease: 'power2.inOut',
      onUpdate: () => { cam.position.lerpVectors(from, prev.pos, proxy.t); cam.quaternion.slerpQuaternions(fromQ, prev.quat, proxy.t) },
      onComplete: () => { this._tw = null; this._release(true) } })
    return true
  }
  _release (announce) {
    const cam = this.ctx?.camera; const id = this._ride ? this._ride.queue[this._ride.i] : null
    this._ride = null; this._armed = false; this._cool = 3
    if (cam) { cam.up.set(0, 1, 0); const ahead = new THREE.Vector3(0, 0, -4).applyQuaternion(cam.quaternion).add(cam.position); cam.lookAt(ahead); send('omni:orbit-target-set', { x: ahead.x, y: ahead.y, z: ahead.z }) }
    send('omni:orbit-enable', {}); if (announce) { send('omni:orbit-tunnel-ride', { state: 'exit', id }); this._announce() }
  }
  pause (on) { if (this._ride) { this._ride.paused = on === undefined ? !this._ride.paused : !!on; this._announce() } return !!this._ride?.paused }

  update (delta) {
    const dt = Number.isFinite(delta) ? delta : 0; const ts = getTimeScale()
    for (const id of M.IDS) this._bodies[id]?.update(dt, ts)
    const cam = this.ctx?.camera; if (!cam) return
    const r = this._ride
    if (!r) {
      if (this._cool > 0) this._cool -= dt
      // reaching a tube (the end of a regular tunnel lands on it) rides it; only once the camera has been outside every tube since the last ride
      const p = cam.position.toArray(); let inside = null
      for (const id of M.IDS) { const s = this._prefs.tunnels[id]; if (s.visible && this._prefs.enabled[id] && M.distToCenterline(s, p) < s.tube * 0.9) { inside = id; break } }
      if (!inside) this._armed = true
      else if (this._armed && this._prefs.autoEnter && this._cool <= 0) this.enter(inside)
      return
    }
    if (r.phase !== 'ride' || r.paused) { if (r.phase === 'ride') this._hold(r); return }
    const spec = this._prefs.tunnels[r.queue[r.i]]
    r.s = M.stepRide(r.s, dt * ts, spec, this._prefs)
    this._hold(r)
    if (r.s.done) {
      if (r.queue[r.i + 1]) { r.i += 1; r.s = { theta: M.nearestTheta(this._prefs.tunnels[r.queue[r.i]], cam.position.toArray()), phi: r.s.phi, travelled: 0, lap: 0, done: false }; send('omni:orbit-tunnel-ride', { state: 'next', id: r.queue[r.i] }); this._flyIn(); this._announce() } else this.exit()
    } else if ((this._sendT += dt) > 0.4) { this._sendT = 0; this._announce() }
  }
  _hold (r) {
    const cam = this.ctx.camera; const spec = this._prefs.tunnels[r.queue[r.i]]; const pose = M.camPose(spec, r.s.theta, r.s.phi, this._prefs.direction)
    cam.position.set(...pose.pos); cam.up.set(...pose.up); cam.lookAt(pose.look[0], pose.look[1], pose.look[2])
  }
}
