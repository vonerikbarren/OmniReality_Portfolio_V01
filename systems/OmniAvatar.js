/**
 * systems/OmniAvatar.js — the capsule avatar of the voxel rooms (V214).
 *
 * The avatar stands on a point of the voxel grid (a room centre, a door, one of your points, a point of a node's shape) and travels ALONG the lines, stopping only at points:
 *   placeAt(pointId)  stand on a point        goTo(pointId)  route along the lines (quickest by time: walk x1, ride x3, fast ride x8) and walk it
 *   stop()            finish the current line to its next point, then stand (the avatar never stops between points)
 * The camera FOLLOWS the avatar by default (follow = true): the camera and its orbit target move with the avatar, keeping your distance and angle. Any move of your own (orbit, pan, zoom,
 * WASD, the pads, take-me-there) lets go of it; followMe() brings it back (the "Follow avatar" button).
 * Events out: omni:avatar-changed { pointId, moving, destination, follow }, omni:avatar-arrived { pointId }, omni:avatar-follow-changed { follow, reason }.
 * Events in:  omni:avatar-goto { pointId }, omni:avatar-place { pointId }, omni:avatar-stop, omni:avatar-follow { on }.
 * Registers Extra.SERVICES.avatar. Saved in localStorage 'omni:avatar:v1' (the point it stands on and the follow flag).
 */
import * as THREE from 'three'
import { SERVICES } from '../utils/OmniExtraKinds.js'
import { MODES } from '../utils/OmniVoxelGrid.js'

export const STORE_KEY = 'omni:avatar:v1'
export const BASE_SPEED = 6            // world units per second on a x1 (walk) line
export const CAPSULE = { radius: 0.35, length: 1.1 }
export const FOLLOW_EPS = 0.05         // how far the camera may differ from where the follower put it before it counts as "you moved it"
const DEFAULT_OFFSET = new THREE.Vector3(0, 4, 9)
const FAR_FOLLOW = 60

export default class OmniAvatar {
  constructor (context, getSpace, getControls = () => null) {
    this.ctx = context; this._space = getSpace; this._controls = getControls
    this.pointId = null; this.pos = new THREE.Vector3(); this.follow = true
    this.destination = null; this._legs = []; this._leg = null; this._t = 0; this._stopAtNext = false
    this._mesh = null; this._bound = []; this._inited = false
    this._expect = null          // { cam: Vector3, target: Vector3 } what the follower last set
    this._lastPos = new THREE.Vector3(); this._persistT = null
  }
  get space () { return this._space?.() ?? SERVICES.voxel }
  get moving () { return !!this._leg }

  init () {
    if (this._inited) return; this._inited = true
    const geo = new THREE.CapsuleGeometry(CAPSULE.radius, CAPSULE.length, 4, 12)
    const mat = new THREE.MeshStandardMaterial({ color: 0xffd36b, emissive: 0xffa21f, emissiveIntensity: 0.5, roughness: 0.4 })
    this._mesh = new THREE.Mesh(geo, mat); this._mesh.name = 'omni-avatar'; this._mesh.visible = false; this._mesh.raycast = () => {}
    this.ctx.scene?.add(this._mesh)
    const on = (t, fn) => { const h = (e) => fn(e.detail ?? {}); window.addEventListener(t, h); this._bound.push([t, h]) }
    on('omni:avatar-goto', (d) => this.goTo(d.pointId)); on('omni:avatar-place', (d) => this.placeAt(d.pointId))
    on('omni:avatar-stop', () => this.stop()); on('omni:avatar-follow', (d) => (d.on === false ? this.releaseFollow('request') : this.followMe()))
    on('omni:voxel-changed', () => this._check())
    try { const s = JSON.parse(localStorage.getItem(STORE_KEY)); if (s && typeof s === 'object') { this.follow = s.follow !== false; this._restore = typeof s.pointId === 'string' ? s.pointId : null } } catch (_) {}
    SERVICES.avatar = this
  }
  destroy () {
    for (const [t, h] of this._bound) window.removeEventListener(t, h); this._bound = []; clearTimeout(this._persistT); this._save()
    if (this._mesh) { this.ctx.scene?.remove(this._mesh); this._mesh.geometry.dispose(); this._mesh.material.dispose(); this._mesh = null }
    if (SERVICES.avatar === this) SERVICES.avatar = null; this._inited = false
  }
  onResize () {}
  _save () { try { localStorage.setItem(STORE_KEY, JSON.stringify({ pointId: this.pointId, follow: this.follow })) } catch (_) {} }
  _saveSoon () { clearTimeout(this._persistT); this._persistT = setTimeout(() => this._save(), 400) }
  _emit (name, detail) { try { window.dispatchEvent(new CustomEvent(name, { detail })) } catch (_) {} }
  _changed () { this._saveSoon(); this._emit('omni:avatar-changed', this.status()) }
  status () { return { pointId: this.pointId, moving: this.moving, destination: this.destination, follow: this.follow, placed: !!this.pointId, position: [this.pos.x, this.pos.y, this.pos.z] } }
  _point (id) { return id ? this.space?.grid?.pointIndex?.().get(id) ?? null : null }

  // ── placing and travelling ──
  placeAt (pointId) {
    const p = this._point(pointId); if (!p) return { ok: false, error: 'That point does not exist.' }
    this._legs = []; this._leg = null; this.destination = null
    this.pointId = pointId; this.pos.set(p.world[0], p.world[1], p.world[2]); this._lastPos.copy(this.pos)
    if (this._mesh) { this._mesh.visible = true; this._poseMesh() }
    if (this.follow) this._snapCamera(true)
    this._changed(); return { ok: true }
  }
  goTo (pointId) {
    if (!this.pointId) return { ok: false, error: 'Place the avatar on a point first.' }
    const to = this._point(pointId); if (!to) return { ok: false, error: 'That point does not exist.' }
    const from = this._leg ? this._leg.to : this.pointId
    if (from === pointId) { this._legs = []; this.destination = this._leg ? pointId : null; this._changed(); return { ok: true, same: true } }
    const r = this.space.grid.route(from, pointId)
    if (!r.ok) return r
    this._legs = r.legs.map(l => ({ from: l.from, to: l.to, mode: l.mode })); this.destination = pointId; this._stopAtNext = false
    if (!this._leg) this._nextLeg()
    this.space.findRoute?.(this.pointId, pointId)
    this._changed(); return { ok: true, route: r }
  }
  stop () { this._legs = []; this.destination = this._leg ? this._leg.to : null; this._stopAtNext = true; if (!this._leg) this.destination = null; this._changed() }
  _nextLeg () {
    const l = this._legs.shift(); if (!l) { this._leg = null; return false }
    const a = this._point(l.from), b = this._point(l.to)
    if (!a || !b) { this._legs = []; this._leg = null; this.destination = null; return false }
    const A = new THREE.Vector3(...a.world), B = new THREE.Vector3(...b.world)
    this._leg = { to: l.to, A, B, len: Math.max(1e-6, A.distanceTo(B)), speed: BASE_SPEED * (MODES[l.mode]?.speed ?? 1) }; this._t = 0
    return true
  }
  /** the grid changed: stand down if our point or the line we are on has gone */
  _check () {
    if (!this.pointId) return
    if (!this._point(this.pointId)) { this.pointId = null; this._legs = []; this._leg = null; this.destination = null; if (this._mesh) this._mesh.visible = false; this._changed(); return }
    if (this._leg && !this._point(this._leg.to)) { this._legs = []; this._leg = null; this.destination = null; this._changed() }
  }

  // ── following ──
  followMe () { this.follow = true; this._lastPos.copy(this.pos); this._snapCamera(false); this._saveSoon(); this._emit('omni:avatar-follow-changed', { follow: true, reason: 'request' }); this._changed(); return true }
  releaseFollow (reason = 'moved') { if (!this.follow) return false; this.follow = false; this._expect = null; this._saveSoon(); this._emit('omni:avatar-follow-changed', { follow: false, reason }); this._changed(); return true }
  /** put the camera at your usual offset from the avatar (or the default behind-and-above when it is far away) */
  _snapCamera (force) {
    const cam = this.ctx.camera, ctl = this._controls(); if (!cam || !this.pointId) return
    const head = this.pos.clone(); head.y += CAPSULE.length / 2 + CAPSULE.radius
    const off = cam.position.clone().sub(ctl?.target ?? head)
    if (force || off.length() > FAR_FOLLOW || off.length() < 1) off.copy(DEFAULT_OFFSET)
    const t = ctl?.target ?? new THREE.Vector3()
    t.copy(head); cam.position.copy(head).add(off)
    if (ctl) { ctl.update?.() }
    this._remember(cam, ctl, head)
  }
  /** V216: OmniVibration shifts the camera and its target by userCamOffset; that is not you moving the camera, so it is taken out of every comparison */
  get _vo () { return SERVICES.vibration?.userCamOffset ?? null }
  _remember (cam, ctl, head) { const vo = this._vo; const c = cam.position.clone(), t = (ctl?.target ?? head).clone(); if (vo) { c.sub(vo); if (ctl?.target) t.sub(vo) } this._expect = { cam: c, target: t } }
  _followStep (delta) {
    const cam = this.ctx.camera, ctl = this._controls(); if (!cam || !this.follow || !this.pointId) return
    if (this._expect) {
      const vo = this._vo
      const cp = vo ? cam.position.clone().sub(vo) : cam.position, tp = ctl && vo ? ctl.target.clone().sub(vo) : ctl?.target
      const moved = cp.distanceTo(this._expect.cam) > FOLLOW_EPS || (ctl && tp.distanceTo(this._expect.target) > FOLLOW_EPS)
      if (moved) { this.releaseFollow('moved'); return }
    }
    const d = this.pos.clone().sub(this._lastPos)
    if (d.lengthSq() > 0) { cam.position.add(d); ctl?.target?.add(d); ctl?.update?.() }
    this._lastPos.copy(this.pos)
    // the controls may nudge the camera (damping / limits) in update(): record what is there NOW as the expected pose
    this._remember(cam, ctl, this.pos)
  }

  /** the capsule stands on its point, plus whatever OmniVibration is doing to you (bob, sway, turn, squash, glow) */
  _poseMesh () {
    const m = this._mesh, vp = SERVICES.vibration?.userPose
    m.position.copy(this.pos)
    if (vp?.active) {
      m.position.add(vp.pos); m.rotation.copy(vp.rot); m.scale.setScalar(Math.max(0.05, 1 + vp.scale))
      m.material.emissiveIntensity = 0.5 + vp.glow * 2
    } else if (m.scale.x !== 1 || m.rotation.x || m.rotation.y || m.rotation.z) { m.rotation.set(0, 0, 0); m.scale.setScalar(1); m.material.emissiveIntensity = 0.5 }
  }

  update (delta = 0.016) {
    if (!this.pointId && this._restore && this.space) { const r = this._restore; this._restore = null; if (this._point(r)) this.placeAt(r) }
    if (this._leg) {
      const step = this._leg.speed * Math.min(delta, 0.1)
      this._t += step / this._leg.len
      if (this._t >= 1) {
        this.pos.copy(this._leg.B); this.pointId = this._leg.to; this._leg = null
        if (!this._stopAtNext && this._legs.length) this._nextLeg()
        if (!this._leg) { const id = this.pointId; this._stopAtNext = false; this.destination = null; this._emit('omni:avatar-arrived', { pointId: id }); this._changed() }
      } else this.pos.lerpVectors(this._leg.A, this._leg.B, this._t)
    }
    if (this._mesh) this._poseMesh()
    this._followStep(delta)
  }
}
