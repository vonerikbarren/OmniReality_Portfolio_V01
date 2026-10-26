/**
 * systems/OmniVoxelSpace.js — the voxel rooms of the world (V210)
 *
 * Owns the grid (utils/OmniVoxelGrid.js, pure) and draws it in the scene with a handful of merged line / point objects (no new WebGL context, no CSS3D, nothing
 * pickable): the room edges (faint) with brighter corner ticks, the points (centre, door, your own, shape points), the lines between them, the lattice of the
 * selected room and the highlighted route. It rebuilds only when something changed.
 *
 *   rooms     addRoom / addRoomHere / addNeighbor / removeRoom / renameRoom / cutLink / restoreLink / selectRoom
 *   splitting setLevel(level, path) on the selected room (path = the sub-room chain), snap, domainBox
 *   points    addPoint(u, label) on the selected room's lattice, addPointAtCamera, removePoint ; lines  addLine(a, b, mode), removeLine
 *   shapes    useNodeShape(nodeId) / dropNodeShape(nodeId): the traversable points of a node's own geometry
 *   routes    findRoute(from, to) -> highlighted ; clearRoute
 *   layers    setLayer('rooms'|'points'|'lines'|'lattice', on)
 * Saved in localStorage 'omni:voxel:v1' (rooms, cut links, user points and lines; shapes are re-derived from the nodes and are not saved).
 * Events in:  omni:node-selected / omni:node-deselected, omni:node-deleted.   Events out: omni:voxel-changed { kind }.
 * Registers Extra.SERVICES.voxel. Module contract: constructor(context, omniNode) / init (guarded) / update(delta) / destroy / onResize.
 */
import * as THREE from 'three'
import VoxelGrid, * as VG from '../utils/OmniVoxelGrid.js'
import { geometryGraph } from '../utils/OmniVoxelGeom.js'
import { SERVICES } from '../utils/OmniExtraKinds.js'

export const STORE_KEY = 'omni:voxel:v1'
export const VIEW_KEY = 'omni:voxel:view-v1'
const PERSIST_MS = 300
const TICK_FRAC = 0.12
const TICK_ROOMS_MAX = 600      // brighter corner ticks only up to this many rooms (beyond, just the faint edges)
const LATTICE_DRAW_MAX = 32     // the lattice of the selected room is drawn at most this fine (the snap itself still goes to 256)
export const COLORS = { edge: 0x9ad0ff, tick: 0xffffff, link: 0x6bffb0, user: 0xff7bd5, geo: 0x7bd0ff, lattice: 0xffd36b, route: 0xffffff, centre: 0xffd36b, door: 0x6bffb0, point: 0xff7bd5, shape: 0x7bd0ff, selected: 0xffd36b }
export const DEFAULT_LAYERS = { rooms: true, points: true, lines: true, lattice: true }

const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())

export default class OmniVoxelSpace {
  constructor (context, omniNode = null) {
    this.ctx = context; this.omniNode = omniNode
    this.grid = new VoxelGrid()
    this.layers = { ...DEFAULT_LAYERS }
    this.selected = null         // room key
    this.path = []               // sub-room chain of the selected room
    this.routeIds = []           // highlighted route
    this.nodeId = null           // the selected node (for "use its shape")
    this._group = null; this._objs = {}; this._dirty = true
    this._bound = []; this._inited = false; this._persistT = null
  }

  init () {
    if (this._inited) return
    this._inited = true
    this._load()
    this._group = new THREE.Group(); this._group.name = 'omni-voxel'; this._group.renderOrder = 5
    this.ctx.scene?.add(this._group)
    const on = (t, fn) => { window.addEventListener(t, fn); this._bound.push([t, fn]) }
    on('omni:node-selected', (e) => { this.nodeId = e.detail?.node?.id ?? e.detail?.mesh?.userData?.nodeId ?? null; this._emit('node') })
    on('omni:node-deselected', () => { this.nodeId = null; this._emit('node') })
    on('omni:node-deleted', (e) => { const id = e.detail?.id; if (id && this.grid.geo.has(id)) this.dropNodeShape(id); if (id && id === this.nodeId) this.nodeId = null })
    SERVICES.voxel = this
  }

  update () { if (this._dirty) this._rebuild() }
  onResize () {}
  destroy () {
    for (const [t, fn] of this._bound) window.removeEventListener(t, fn)
    this._bound = []; clearTimeout(this._persistT); this._save()
    this._disposeObjs(); if (this._group) this.ctx.scene?.remove(this._group)
    if (SERVICES.voxel === this) SERVICES.voxel = null
    this._inited = false
  }

  // ── storage ──────────────────────────────────────────────────────────────────
  _load () {
    try { const raw = JSON.parse(localStorage.getItem(STORE_KEY)); if (raw) this.grid.load(raw) } catch (_) { this.grid.reset() }
    try { const v = JSON.parse(localStorage.getItem(VIEW_KEY)); if (v && typeof v === 'object') for (const k of Object.keys(DEFAULT_LAYERS)) if (typeof v[k] === 'boolean') this.layers[k] = v[k] } catch (_) {}
  }
  _save () { try { localStorage.setItem(STORE_KEY, JSON.stringify(this.grid.toJSON())); localStorage.setItem(VIEW_KEY, JSON.stringify(this.layers)) } catch (_) {} }
  _changed (kind) { this._dirty = true; clearTimeout(this._persistT); this._persistT = setTimeout(() => this._save(), PERSIST_MS); this._emit(kind) }
  _emit (kind) { try { window.dispatchEvent(new CustomEvent('omni:voxel-changed', { detail: { kind } })) } catch (_) {} }
  flush () { clearTimeout(this._persistT); this._save() }

  // ── API: rooms ───────────────────────────────────────────────────────────────
  addRoom (x, y, z, label) { const r = this.grid.addCell(x, y, z, label); if (r.ok) { if (!r.same) this._changed('rooms'); this.selectRoom(r.key) } return r }
  /** a room at a world position (the camera's look-at point by default: 12 units ahead, on the floor level if that is below). */
  addRoomAt (world) { const k = VG.cellOfWorld(world); if (!k) return { ok: false, error: 'That position is outside the grid.' }; const c = VG.parseKey(k); return this.addRoom(c.x, c.y, c.z) }
  addRoomHere () { return this.addRoomAt(this._ahead()) }
  addRoomAtNode (nodeId = this.nodeId) {
    const m = nodeId ? this.omniNode?.getMeshById?.(nodeId) : null; if (!m) return { ok: false, error: 'Select a node first.' }
    return this.addRoomAt([m.position.x, m.position.y, m.position.z])
  }
  _ahead () {
    const cam = this.ctx.camera; if (!cam) return [0, 0, 0]
    const f = new THREE.Vector3(); cam.getWorldDirection(f)
    const p = cam.position.clone().addScaledVector(f, 12); return [p.x, Math.max(0, p.y), p.z]
  }
  addNeighbor (dirId, key = this.selected) { const r = this.grid.addNeighbor(key, dirId); if (r.ok) { if (!r.same) this._changed('rooms'); this.selectRoom(r.key) } return r }
  removeRoom (key = this.selected) {
    const r = this.grid.removeCell(key); if (!r.ok) return r
    if (this.selected === key) { this.selected = null; this.path = [] }
    this._pruneRoute(); this._changed('rooms'); return r
  }
  renameRoom (label, key = this.selected) { const r = this.grid.renameCell(key, label); if (r.ok) this._changed('rooms'); return r }
  cutLink (dirId, key = this.selected) { const r = this.grid.cutLink(key, dirId); if (r.ok) { this._pruneRoute(); this._changed('links') } return r }
  restoreLink (dirId, key = this.selected) { const r = this.grid.restoreLink(key, dirId); if (r.ok) this._changed('links'); return r }
  selectRoom (key) {
    if (key !== null && !this.grid.hasCell(key)) return { ok: false, error: 'Unknown room.' }
    this.selected = key; this.path = []; this._dirty = true; this._emit('select'); return { ok: true }
  }
  /** go into a sub-room (indices inside the current one) or back out (null) */
  enterSub (ijk) {
    if (!this.selected) return { ok: false, error: 'Select a room first.' }
    if (ijk === null) { this.path = this.path.slice(0, -1); this._dirty = true; this._emit('select'); return { ok: true } }
    const next = [...this.path, ijk]
    if (!this.grid.subBounds(this.selected, next)) return { ok: false, error: 'That sub-room does not exist: split its parent first and use indices inside it.' }
    this.path = next; this._dirty = true; this._emit('select'); return { ok: true }
  }
  setLevel (n, path = this.path, key = this.selected) {
    if (!key) return { ok: false, error: 'Select a room first.' }
    const r = this.grid.setLevel(key, Number(n), path); if (r.ok) { this._pruneRoute(); this._changed('level') } return r
  }

  // ── API: points, lines ───────────────────────────────────────────────────────
  addPoint (u, label = '', key = this.selected, path = this.path) { if (!key) return { ok: false, error: 'Select a room first.' }; const r = this.grid.addPoint(key, u, label, path); if (r.ok && !r.same) this._changed('points'); return r }
  addPointAtCamera (label = '') {
    const w = this._ahead(); const k = VG.cellOfWorld(w); if (!k || !this.grid.hasCell(k)) return { ok: false, error: 'There is no room at that spot. Add a room first.' }
    return this.addPoint(VG.worldToUnits(k, w), label, k, [])
  }
  removePoint (id) { const r = this.grid.removePoint(id); if (r.ok) { this._pruneRoute(); this._changed('points') } return r }
  renamePoint (id, label) { const r = this.grid.renamePoint(id, label); if (r.ok) this._changed('points'); return r }
  addLine (a, b, mode = 'walk') { const r = this.grid.addLine(a, b, mode); if (r.ok) this._changed('lines'); return r }
  removeLine (id) { const r = this.grid.removeLine(id); if (r.ok) { this._pruneRoute(); this._changed('lines') } return r }

  // ── API: shapes ──────────────────────────────────────────────────────────────
  /** the traversable points of a node's own geometry (a sphere has points too) */
  useNodeShape (nodeId = this.nodeId, max = 64) {
    const mesh = nodeId ? this.omniNode?.getMeshById?.(nodeId) : null
    const geo = mesh?.geometry; const pos = geo?.attributes?.position
    if (!mesh || !pos) return { ok: false, error: 'Select a node with a shape first.' }
    mesh.updateMatrixWorld?.(true)
    const g = geometryGraph({ positions: pos.array, index: geo.index?.array ?? null }, { matrix: mesh.matrixWorld?.elements ? Array.from(mesh.matrixWorld.elements) : null, max })
    if (!g.ok) return g
    const r = this.grid.setGeometry(nodeId, g); if (r.ok) this._changed('shapes'); return r
  }
  dropNodeShape (nodeId = this.nodeId) { const r = this.grid.removeGeometry(nodeId); if (r.ok) { this._pruneRoute(); this._changed('shapes') } return r }

  // ── API: routes, layers ──────────────────────────────────────────────────────
  findRoute (from, to) { const r = this.grid.route(from, to); this.routeIds = r.ok ? r.ids : []; this._dirty = true; this._emit('route'); return r }
  clearRoute () { this.routeIds = []; this._dirty = true; this._emit('route') }
  _pruneRoute () { if (this.routeIds.length) { const idx = this.grid.pointIndex(); if (!this.routeIds.every(id => idx.has(id))) this.routeIds = [] } }
  setLayer (name, on) { if (!(name in DEFAULT_LAYERS)) return false; this.layers[name] = !!on; this._dirty = true; clearTimeout(this._persistT); this._persistT = setTimeout(() => this._save(), PERSIST_MS); this._emit('layers'); return true }
  summary () { return { rooms: this.grid.cells.size, points: this.grid.listPoints().length, lines: this.grid.listLines().length, userPoints: this.grid.points.size, shapes: this.grid.geo.size } }
  /** for tests: what is currently drawn */
  stats () { return Object.fromEntries(Object.entries(this._objs).map(([k, o]) => [k, o.geometry.getAttribute('position')?.count ?? 0])) }

  // ── drawing ──────────────────────────────────────────────────────────────────
  _disposeObjs () { for (const o of Object.values(this._objs)) { this._group?.remove(o); o.geometry?.dispose(); o.material?.dispose() } this._objs = {} }
  _mk (name, kind, verts, color, opacity, extra = {}) {
    if (!verts.length) return
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3))
    if (extra.colors) g.setAttribute('color', new THREE.Float32BufferAttribute(extra.colors, 3))
    const mat = kind === 'points'
      ? new THREE.PointsMaterial({ size: extra.size ?? 0.35, sizeAttenuation: true, vertexColors: !!extra.colors, color: extra.colors ? 0xffffff : color, transparent: true, opacity, depthWrite: false })
      : new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false, depthTest: extra.depthTest !== false })
    const o = kind === 'points' ? new THREE.Points(g, mat) : new THREE.LineSegments(g, mat)
    o.name = 'omni-voxel-' + name; o.raycast = () => {}; o.frustumCulled = false; o.renderOrder = extra.order ?? 5
    this._objs[name] = o; this._group.add(o)
  }
  _rebuild () {
    this._dirty = false
    if (!this._group) return
    this._disposeObjs()
    const g = this.grid, R = VG.ROOM_SIZE, L = this.layers
    const cells = g.listCells()
    if (L.rooms) {
      const e = [], t = []
      const tickN = cells.length <= TICK_ROOMS_MAX
      for (const c of cells) {
        const x0 = c.x * R, y0 = c.y * R, z0 = c.z * R, x1 = x0 + R, y1 = y0 + R, z1 = z0 + R
        const X = [x0, x1], Y = [y0, y1], Z = [z0, z1]
        for (const y of Y) for (const z of Z) e.push(x0, y, z, x1, y, z)
        for (const x of X) for (const z of Z) e.push(x, y0, z, x, y1, z)
        for (const x of X) for (const y of Y) e.push(x, y, z0, x, y, z1)
        if (tickN) { const d = R * TICK_FRAC; for (const x of X) for (const y of Y) for (const z of Z) { const sx = x === x0 ? d : -d, sy = y === y0 ? d : -d, sz = z === z0 ? d : -d; t.push(x, y, z, x + sx, y, z, x, y, z, x, y + sy, z, x, y, z, x, y, z + sz) } }
      }
      this._mk('edges', 'lines', e, COLORS.edge, 0.2)
      this._mk('ticks', 'lines', t, COLORS.tick, 0.85)
      const sel = this.selected && g.getCell(this.selected)
      if (sel) {
        const b = g.subBounds(sel.key, this.path)
        if (b) {   // the selected room / sub-room, outlined in the accent colour
          const lo = VG.unitsToWorld(sel.key, b.min), hi = VG.unitsToWorld(sel.key, b.min.map(v => v + b.size)), s = []
          for (const y of [lo[1], hi[1]]) for (const z of [lo[2], hi[2]]) s.push(lo[0], y, z, hi[0], y, z)
          for (const x of [lo[0], hi[0]]) for (const z of [lo[2], hi[2]]) s.push(x, lo[1], z, x, hi[1], z)
          for (const x of [lo[0], hi[0]]) for (const y of [lo[1], hi[1]]) s.push(x, y, lo[2], x, y, hi[2])
          this._mk('selected', 'lines', s, COLORS.selected, 0.95, { depthTest: false, order: 6 })
        }
      }
    }
    const pts = g.listPoints(), idx = new Map(pts.map(p => [p.id, p]))
    if (L.points) {
      const v = [], col = []; const c = new THREE.Color()
      for (const p of pts) { v.push(...p.world); c.set(p.kind === 'centre' ? COLORS.centre : p.kind === 'door' ? COLORS.door : p.kind === 'user' ? COLORS.point : COLORS.shape); col.push(c.r, c.g, c.b) }
      this._mk('points', 'points', v, 0xffffff, 0.95, { colors: col, size: 0.45, order: 7 })
    }
    if (L.lines) {
      const link = [], user = [], geo = []
      for (const l of g.listLines()) { const a = idx.get(l.a), b = idx.get(l.b); if (!a || !b) continue; (l.kind === 'link' ? link : l.kind === 'user' ? user : geo).push(...a.world, ...b.world) }
      this._mk('links', 'lines', link, COLORS.link, 0.55); this._mk('userlines', 'lines', user, COLORS.user, 0.85); this._mk('geolines', 'lines', geo, COLORS.geo, 0.6)
    }
    if (L.lattice && this.selected) {   // the lattice of the selected room / sub-room: its own divisions
      const key = this.selected, b = g.subBounds(key, this.path), n = g.levelOf(key, this.path)
      if (b && n > 1) {
        const m = Math.min(n, LATTICE_DRAW_MAX), s = b.size, v = []
        for (let i = 0; i <= m; i++) {
          const o = b.size * i / m; const at = (ux, uy, uz) => VG.unitsToWorld(key, [b.min[0] + ux, b.min[1] + uy, b.min[2] + uz])
          for (const f of [0, s]) {   // the two faces perpendicular to y: a grid of lines along x and z
            v.push(...at(o, f, 0), ...at(o, f, s), ...at(0, f, o), ...at(s, f, o))
            v.push(...at(o, 0, f), ...at(o, s, f), ...at(0, o, f), ...at(s, o, f))
            v.push(...at(f, o, 0), ...at(f, o, s), ...at(f, 0, o), ...at(f, s, o))
          }
        }
        this._mk('lattice', 'lines', v, COLORS.lattice, 0.25)
      }
    }
    if (this.routeIds.length > 1) {
      const v = []; for (let i = 0; i + 1 < this.routeIds.length; i++) { const a = idx.get(this.routeIds[i]), b = idx.get(this.routeIds[i + 1]); if (a && b) v.push(...a.world, ...b.world) }
      this._mk('route', 'lines', v, COLORS.route, 1, { depthTest: false, order: 8 })
    }
  }
}
