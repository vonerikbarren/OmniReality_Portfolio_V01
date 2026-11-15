/**
 * systems/OmniSense.js (V290) — OmniSense, basic layout: the voxel rooms as the main containers on a 3D plane. Each room carries an OmniVon (utils/OmniSenseModel.js).
 * The plane can be seen top down, isometric or from a wide orbit, and the orbit controls stay on so the user can look around from there.
 *   SERVICES.omnisense: open(view?) close() toggle() isOpen() setView(mode) view() select(key) rooms() vonText(key) setText(key, text) clearUser(key) get()
 *   Events in:  omni:voxel-changed (rooms, selection)   Events out: omni:omnisense-changed { reason, key? }
 *   Click a tile to select its room: the equation comes up on the OmniTeleprompt (when it is there). Saved in this browser: 'omni:omnisense:v1' (layer on / off, view, the terms the user wrote per room).
 *   Nothing here changes the voxel rooms themselves.
 */
import * as THREE from 'three'
import gsap from 'gsap'
import * as M from '../utils/OmniSenseModel.js'
import { SERVICES } from '../utils/OmniExtraKinds.js'

export const STORE_KEY = 'omni:omnisense:v1'
const ROOM_SIZE = 20
const send = (n, d) => { try { window.dispatchEvent(new CustomEvent(n, { detail: d })) } catch (_) { /* no window */ } }
const KEY_OK = /^-?\d{1,4},-?\d{1,4},-?\d{1,4}$/
const COL = { tile: 0x7aa2ff, picked: 0xffd36b, ground: 0xdfe6f5, edge: 0x3a4a7a }

export default class OmniSense {
  constructor (context, omniNode = null) {
    this.ctx = context; this.omniNode = omniNode ?? context?.omniNode ?? null; this._bound = []; this._inited = false; this._dirty = true
    this._prefs = { on: false, view: 'orbit', users: {} }; this._group = null; this._tiles = []; this._inst = null; this._tw = null; this._down = null; this._saveT = 0; this._picked = null
  }
  init () {
    if (this._inited) return; this._inited = true
    try { const s = JSON.parse(localStorage.getItem(STORE_KEY)); if (s && typeof s === 'object') this._prefs = this._clean(s) } catch (_) { /* first run */ }
    const on = (t, f, tgt = window) => { tgt.addEventListener(t, f); this._bound.push([t, f, tgt]) }
    on('omni:voxel-changed', () => { this._dirty = true }); on('omni:omnisense-panel', () => this.toggle())
    const el = this.ctx?.renderer?.domElement
    if (el) {
      on('pointerdown', (e) => { this._down = e.button === 0 && this._prefs.on ? { x: e.clientX, y: e.clientY } : null }, el)
      on('pointerup', (e) => { const d = this._down; this._down = null; if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 5) this._pick(e) }, el)
    }
    SERVICES.omnisense = this
  }
  destroy () { this._tw?.kill(); clearTimeout(this._saveT); this._flush(); for (const [t, f, g] of this._bound) g.removeEventListener(t, f); this._bound = []; this._clear(); if (SERVICES.omnisense === this) SERVICES.omnisense = null; this._inited = false }
  onResize () {}
  _clean (s) {
    const users = {}; const src = s.users && typeof s.users === 'object' ? s.users : {}
    for (const k of Object.keys(src).slice(0, M.LIMITS.rooms)) if (KEY_OK.test(k)) { const u = M.sanitizeUserVon(src[k]); if (u.terms.length || u.level) users[k] = u }
    return { on: s.on === true, view: M.VIEWS.includes(s.view) ? s.view : 'orbit', users }
  }
  _save () { clearTimeout(this._saveT); this._saveT = setTimeout(() => this._flush(), 300) }
  _flush () { try { localStorage.setItem(STORE_KEY, JSON.stringify(this._prefs)) } catch (_) { /* private */ } }

  // ── layer ──
  isOpen () { return this._prefs.on }
  get () { return { on: this._prefs.on, view: this._prefs.view, rooms: this._tiles.length, picked: this._picked } }
  view () { return this._prefs.view }
  open (view) { this._prefs.on = true; this._dirty = true; this._save(); send('omni:omnisense-changed', { reason: 'open' }); if (view) return this.setView(view); return { ok: true } }
  close () { this._prefs.on = false; if (this._group) this._group.visible = false; this._save(); send('omni:omnisense-changed', { reason: 'close' }); return { ok: true } }
  toggle () { return this._prefs.on ? this.close() : this.open() }

  // ── rooms ──
  _rooms () {
    const g = SERVICES.voxel?.grid; if (!g) return []; const idx = g.pointIndex(); const out = []
    for (const c of g.listCells()) { const p = idx.get('c:' + c.key); if (p?.world) out.push({ key: c.key, x: c.x, y: c.y, z: c.z, label: c.label || '', world: [p.world[0], p.world[1], p.world[2]] }) }
    return out
  }
  rooms () { return this._rooms().map(r => ({ key: r.key, label: r.label, text: M.roomText(r, this._prefs.users[r.key]) })) }
  _cell (key) { return this._rooms().find(r => r.key === key) ?? null }
  vonText (key) { const c = this._cell(key); return c ? M.roomText(c, this._prefs.users[key]) : null }
  /** the user edited the equation of a room: terms are kept, the place stays the room's. Returns { ok, problems } */
  setText (key, text) {
    const c = this._cell(key); if (!c) return { ok: false, error: 'There is no room ' + key + '.' }
    const r = M.userFromText(text, c); if (r.user.terms.length || r.user.level) this._prefs.users[key] = r.user; else delete this._prefs.users[key]
    this._dirty = true; this._save(); send('omni:omnisense-changed', { reason: 'terms', key }); return { ok: true, problems: r.problems, text: M.roomText(c, this._prefs.users[key]) }
  }
  clearUser (key) { delete this._prefs.users[key]; this._dirty = true; this._save(); send('omni:omnisense-changed', { reason: 'terms', key }); return { ok: true } }
  select (key) {
    const c = this._cell(key); if (!c) return { ok: false, error: 'There is no room ' + key + '.' }
    this._picked = key; try { SERVICES.voxel?.selectRoom(key) } catch (_) { /* voxel not running */ }
    const text = M.roomText(c, this._prefs.users[key]); SERVICES.teleprompt?.show?.({ title: 'Room ' + key + (c.label ? ' · ' + c.label : ''), text, edge: 'bottom' })
    this._dirty = true; send('omni:omnisense-changed', { reason: 'select', key }); return { ok: true, text }
  }

  // ── drawing ──
  update () {
    if (!this._prefs.on) { if (this._group) this._group.visible = false; return }
    if (this._dirty) this._rebuild()
    if (this._group) this._group.visible = true
  }
  _clear () { if (this._group) { this._group.removeFromParent(); this._group.traverse(o => { o.geometry?.dispose?.(); o.material?.dispose?.() }) } this._group = null; this._inst = null }
  _rebuild () {
    this._dirty = false; this._clear(); const scene = this.ctx?.scene; if (!scene) return
    const rooms = this._rooms(); this._tiles = M.tiles(rooms, ROOM_SIZE, this._prefs.users); if (!rooms.length) return
    const tl = new Map(this._tiles.map(t => [t.key, t])); const list = rooms.filter(r => tl.has(r.key)); const sel = SERVICES.voxel?.selected ?? this._picked
    const b = M.boundsOf(list.map(r => r.world)); const floorY = b.min[1] - ROOM_SIZE / 2 + 0.02; const g = new THREE.Group(); g.name = 'OmniSense'
    const gw = b.size[0] + ROOM_SIZE * 2.4, gd = b.size[2] + ROOM_SIZE * 2.4
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(gw, gd), new THREE.MeshBasicMaterial({ color: COL.ground, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false })); ground.rotation.x = -Math.PI / 2; ground.position.set(b.center[0], floorY - 0.02, b.center[2]); ground.name = 'OmniSenseGround'; g.add(ground)
    const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.85 }), list.length); inst.name = 'OmniSenseTiles'
    const m4 = new THREE.Matrix4(), col = new THREE.Color(); const edges = []
    list.forEach((r, i) => {
      const s = tl.get(r.key).size, h = 0.8; m4.compose(new THREE.Vector3(r.world[0], floorY + h / 2, r.world[2]), new THREE.Quaternion(), new THREE.Vector3(s, h, s)); inst.setMatrixAt(i, m4)
      inst.setColorAt(i, col.set(r.key === sel ? COL.picked : COL.tile)); const x0 = r.world[0] - s / 2, x1 = r.world[0] + s / 2, z0 = r.world[2] - s / 2, z1 = r.world[2] + s / 2, y = floorY + h + 0.02
      edges.push(x0, y, z0, x1, y, z0, x1, y, z0, x1, y, z1, x1, y, z1, x0, y, z1, x0, y, z1, x0, y, z0)
    })
    inst.instanceMatrix.needsUpdate = true; if (inst.instanceColor) inst.instanceColor.needsUpdate = true; inst.userData.keys = list.map(r => r.key); g.add(inst)
    const eg = new THREE.BufferGeometry(); eg.setAttribute('position', new THREE.Float32BufferAttribute(edges, 3)); const lines = new THREE.LineSegments(eg, new THREE.LineBasicMaterial({ color: COL.edge })); lines.name = 'OmniSenseEdges'; g.add(lines)
    g.traverse(o => { o.frustumCulled = false }); scene.add(g); this._group = g; this._inst = inst; this._bounds = b
  }
  _pick (e) {
    if (!this._inst || !this._prefs.on) return; const cam = this.ctx.camera, el = this.ctx.renderer.domElement; const r = el.getBoundingClientRect()
    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); const ray = new THREE.Raycaster(); ray.setFromCamera(ndc, cam)
    const hit = ray.intersectObject(this._inst, false)[0]; const key = hit && this._inst.userData.keys[hit.instanceId]; if (key) this.select(key)
  }

  // ── views ──
  /** move the camera to a view (smoothly). The orbit controls are left on afterwards, around the middle of the plane. */
  setView (mode, opts = {}) {
    const cam = this.ctx?.camera; if (!cam) return { ok: false, error: 'There is no camera.' }
    if (!M.VIEWS.includes(mode)) return { ok: false, error: 'The view is one of: ' + M.VIEWS.join(', ') + '.' }
    const rooms = this._rooms(); if (!rooms.length) return { ok: false, error: 'There are no voxel rooms yet. Add one in the OmniVoxel panel first.' }
    this._prefs.view = mode; this._prefs.on = true; this._dirty = true; this._save(); this._rebuild()
    const pose = M.viewPose(mode, M.boundsOf(rooms.map(r => r.world)), ROOM_SIZE, cam.fov, cam.aspect)
    const dist = Math.hypot(...pose.pos.map((v, i) => v - pose.target[i])); const oc = SERVICES.orbit?.controls ?? null; if (oc && dist * 1.3 > oc.maxDistance) oc.maxDistance = Math.ceil(dist * 1.3)   // otherwise the controls pull the camera back in
    const was = oc ? oc.enabled : false; if (oc) oc.enabled = false
    const from = cam.position.clone(), fromT = oc ? oc.target.clone() : new THREE.Vector3(...pose.target), toP = new THREE.Vector3(...pose.pos), toT = new THREE.Vector3(...pose.target); const p = { t: 0 }
    const fin = () => { cam.position.copy(toP); if (oc) { oc.target.copy(toT); oc.enabled = was; oc.update() } else cam.lookAt(toT); this._tw = null; send('omni:omnisense-changed', { reason: 'view', view: mode }) }
    this._tw?.kill()
    if (opts.animate === false) { fin(); return { ok: true, view: mode } }
    this._tw = gsap.to(p, { t: 1, duration: Math.min(2.5, Math.max(0.8, dist / 4000)), ease: 'power2.inOut', onUpdate: () => { cam.position.lerpVectors(from, toP, p.t); const t = fromT.clone().lerp(toT, p.t); if (oc) oc.target.copy(t); cam.lookAt(t) }, onComplete: fin })
    return { ok: true, view: mode }
  }
}
