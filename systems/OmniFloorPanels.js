/**
 * systems/OmniFloorPanels.js — the runtime of the floorPanelNode kind (V191).
 *
 * The node kind and its merged geometry are utils/OmniExtraKinds.js; the Tetris pieces, snapping and placements are utils/OmniFloorPieces.js;
 * the maker settings and the blueprint are utils/FloorNodeMakerSettings.js; media validation / storage is utils/FloorPanelMedia.js; textures and the
 * "at most 4 animated faces play" rule are systems/OmniFloorPanelMedia.js. This module is the scene side:
 *
 *   PLACING       placePiece({ pieceId, rot, mirror, gx, gz }) creates ONE node for the piece (a path section); the cells must be free and the total
 *                 must stay <= the maxPanels setting. stampBlueprint(gx, gz) places every section of the maker's blueprint with its media.
 *   POINTER       while "armed" (arm(true)) the floor under the pointer is raycast; a ghost of the piece (green = free, red = blocked) follows the
 *                 snapped cell and a click / tap places it (the click is swallowed so it does not also select a node). Escape disarms.
 *   GRID OVERLAY  a line grid on the floor around the camera target (setting `overlay`), one cell = one panel = the floor's grid unit by default.
 *   EDITING       removePanel (one cell; the node goes when its last cell goes), transformNode (rotate / mirror, refused if it would overlap),
 *                 moveNode, snapNode, setCellMedia / setSectionMedia (+ attachFile / attachUrl). Every edit saves the node (omni:force-save).
 *   FACES         every cell with media gets a flat plane above the merged geometry; the textures are loaded lazily when the section is on screen.
 *
 * Module contract: constructor(context, omniNode) / init (guarded against a second call) / update(delta) / destroy / onResize.
 * Events in: omni:floorpanel-place-request, omni:floorpanel-stamp-request, omni:floorpanel-arm, omni:floornodemaker-settings-changed.
 * Events out: omni:floorpanel-changed { id }, omni:floorpanel-armed-changed { on }, omni:floorpanel-hover { gx, gz, ok }.
 */

import * as THREE from 'three'
import * as Pieces from '../utils/OmniFloorPieces.js'
import * as Settings from '../utils/FloorNodeMakerSettings.js'
import * as Media from '../utils/FloorPanelMedia.js'
import * as Extra from '../utils/OmniExtraKinds.js'
import FloorPanelMedia from './OmniFloorPanelMedia.js'

export const LOAD_DISTANCE = 1500
const FACE_LIFT = 0.006
const OVERLAY_RADIUS = 14
const SYNC_INTERVAL = 0.25
const newId = () => 'omni_' + Math.random().toString(36).slice(2, 8)
const note = (name, desc) => { try { window.dispatchEvent(new CustomEvent('omni:notify-info', { detail: { name, desc, holdMs: 3000 } })) } catch (_) { /* no window */ } }
const emit = (name, detail) => { try { window.dispatchEvent(new CustomEvent(name, { detail })) } catch (_) { /* no window */ } }

export default class OmniFloorPanels {
  constructor (context, omniNode = null, mediaEnv = null) {
    this.ctx = context
    this.omniNode = omniNode
    this.media = new FloorPanelMedia(mediaEnv)
    this._inited = 0
    this._bound = []
    this._armed = false
    this._hover = null            // { gx, gz, ox, oz }
    this._ghost = null
    this._ghostSig = ''
    this._overlay = null
    this._overlaySig = ''
    this._accum = 0
    this._faceDirty = true
    this._plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -Settings.FLOOR_LEVEL)
    this._ray = new THREE.Raycaster()
    this._frustum = new THREE.Frustum()
    this._mat4 = new THREE.Matrix4()
    this._sphere = new THREE.Sphere()
    this._v = new THREE.Vector3()
    this._faceGeo = new Map()
    this._down = null
  }

  init () {
    this._inited++
    if (this._inited > 1) return   // BaseScene.addModule() calls init(); a second call must not double the listeners
    const on = (name, fn, target = window, opt) => { const h = (e) => fn(e.detail ?? {}, e); target.addEventListener(name, h, opt); this._bound.push([name, h, target, opt]) }
    on('omni:floorpanel-place-request', (d, e) => { const out = this.placePiece(d); if (e.detail && typeof e.detail === 'object') e.detail.out = out })
    on('omni:floorpanel-stamp-request', (d, e) => { const out = this.stampBlueprint(d.gx, d.gz); if (e.detail && typeof e.detail === 'object') e.detail.out = out })
    on('omni:floorpanel-arm', (d) => this.arm(d.on !== false))
    on(Settings.CHANGED_EVENT, () => { this._ghostSig = ''; this._overlaySig = ''; this._faceDirty = true })
    on('omni:extra-mesh-released', (d) => this._onReleased(d))
    on('omni:scene-clear-request', () => { this.arm(false); this.media.unloadAll() })
    on('keydown', (_d, e) => { if (e.key === 'Escape' && this._armed) this.arm(false) }, document)
    const canvas = this.ctx.renderer?.domElement
    if (canvas) {
      const move = (e) => { if (this._armed || Settings.getSettings().overlay) this._pointer(e) }
      const downH = (e) => { this._down = { x: e.clientX, y: e.clientY }; if (this._armed) this._pointer(e) }
      canvas.addEventListener('pointermove', move, { passive: true }); this._bound.push(['pointermove', move, canvas])
      canvas.addEventListener('pointerdown', downH, { passive: true }); this._bound.push(['pointerdown', downH, canvas])
      // capture on window: runs before OmniNode's own canvas click, so a placing click does not also select / deselect a node
      const click = (e) => {
        if (!this._armed || e.target !== canvas) return
        const d = this._down; this._down = null
        if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6) return   // an orbit drag, not a click
        e.stopPropagation(); e.stopImmediatePropagation?.()
        this._pointer(e)
        this.placeAtHover()
      }
      window.addEventListener('click', click, true); this._bound.push(['click', click, window, true])
    }
    this.media.onTextureReady = () => { this._faceDirty = true }
    this.media.attachVisibility()
    Extra.SERVICES.panels = this
  }

  update (delta) {
    this.media.tick(typeof performance !== 'undefined' ? performance.now() : Date.now())
    this._accum += delta || 0
    if (this._accum < SYNC_INTERVAL) return
    const dt = this._accum; this._accum = 0
    this.sync(dt)
    this._updateOverlay()
  }

  onResize () {}

  destroy () {
    if (!this._inited) return
    this._bound.forEach(([n, h, t, o]) => t.removeEventListener(n, h, o))
    this._bound = []
    for (const m of Extra.liveFloorPanelMeshes()) this._clearFaces(m)
    this.media.destroy()
    this._disposeGhost(); this._disposeOverlay()
    for (const g of this._faceGeo.values()) g.dispose()
    this._faceGeo.clear()
    this._armed = false
    if (Extra.SERVICES.panels === this) Extra.SERVICES.panels = null
    this._inited = 0
  }

  // ── Reading ─────────────────────────────────────────────────────────────────

  _sections () {
    return Extra.liveFloorPanelMeshes().map(m => ({ mesh: m, id: m.userData.nodeId, data: m.userData.extraKind.data })).filter(s => s.data && s.id)
  }
  /** Set of 'gx,gz' keys of every panel in the scene, optionally leaving one node out. */
  occupied (exceptId = null) {
    const set = new Set()
    for (const s of this._sections()) {
      if (s.id === exceptId) continue
      for (const c of s.data.cells) set.add(Pieces.cellKey(s.data.gx + c.x, s.data.gz + c.z))
    }
    return set
  }
  panelCount () { return this._sections().reduce((n, s) => n + s.data.cells.length, 0) }

  // ── Placing ─────────────────────────────────────────────────────────────────

  /**
   * Place one piece. opts: { pieceId, rot, mirror, gx, gz, cells?, ox?, oz?, select?, cellSize?, thickness?, color?, opacity? }.
   * Unset sizes / colour come from the maker settings. Returns { ok, id } or { ok:false, error }.
   */
  placePiece (opts = {}) {
    try {
      const st = Settings.getSettings()
      const pieceId = Pieces.isPieceId(opts.pieceId) ? opts.pieceId : st.pieceId
      const rot = opts.rot ?? st.rot; const mirror = opts.mirror ?? st.mirror
      const gx = Number(opts.gx); const gz = Number(opts.gz)
      if (!Number.isInteger(gx) || !Number.isInteger(gz)) return { ok: false, error: 'Choose a floor cell.' }
      const spec = { nodeKind: Extra.KIND_FLOOR_PANEL, pieceId, rot, mirror, gx, gz, ox: opts.ox ?? 0, oz: opts.oz ?? 0, cells: opts.cells, cellSize: opts.cellSize ?? st.cellSize, thickness: opts.thickness ?? st.thickness, panelOpacity: opts.opacity ?? st.opacity }
      const fp = Extra.sanitizeFloorPanel(spec)
      if (!fp) return { ok: false, error: 'That is not a valid piece.' }
      const abs = fp.cells.map(c => [c.x + gx, c.z + gz])
      const blocked = Pieces.collisions(abs, this.occupied())
      if (blocked.length) return { ok: false, error: 'There is already a panel on that spot.', blocked }
      if (this.panelCount() + fp.cells.length > st.maxPanels) return { ok: false, error: `The panel limit (${st.maxPanels}) is reached. Remove panels or raise the limit in FloorNodeMakerSettings.` }
      const id = opts.id ?? newId()
      const pos = Extra.panelOrigin(gx, gz, fp.cellSize, fp.thickness, fp.ox, fp.oz)
      emit('omni:node-create-request', {
        ...fp, id, label: opts.label, geometry: Extra.GEO_FLOOR_PANEL, primitive: 'objective', color: opts.color ?? st.color,
        position: pos, rotation: [0, 0, 0], scale: [1, 1, 1], noParent: true, noSelect: opts.select !== true,
      })
      if (this.omniNode && !this.omniNode.getNodeData?.(id)) return { ok: false, error: 'The panel node could not be created.' }
      this._faceDirty = true
      return { ok: true, id, cells: fp.cells.length }
    } catch (err) { return { ok: false, error: String(err?.message ?? err) } }
  }

  /** Place every section of the maker's blueprint with its grid cell (0, 0) on world cell (gx, gz) (default: under the camera target). */
  stampBlueprint (gx = null, gz = null) {
    const st = Settings.getSettings(); const bp = Settings.getBlueprint()
    if (!bp.sections.length) return { ok: false, error: 'The blueprint is empty. Place some panels on the grid first.' }
    let ox = gx; let oz = gz
    if (!Number.isInteger(ox) || !Number.isInteger(oz)) { const c = this.cameraTargetCell(st.cellSize); ox = c.gx; oz = c.gz }
    let placed = 0; let skipped = 0; const ids = []; const errors = []
    for (const spec of Settings.blueprintStamp(bp, ox, oz)) {
      const r = this.placePiece({ ...spec, select: false })
      if (r.ok) { placed += r.cells; ids.push(r.id) } else { skipped++; if (!errors.includes(r.error)) errors.push(r.error) }
    }
    return { ok: placed > 0, placed, sections: ids.length, skippedSections: skipped, ids, error: placed ? '' : (errors[0] ?? 'Nothing was placed.'), errors, at: { gx: ox, gz: oz } }
  }

  /** The floor cell the camera looks at (the camera's forward ray on the floor plane), else the cell under the camera. */
  cameraTargetCell (cellSize = Settings.getSettings().cellSize) {
    const cam = this.ctx.camera
    const dir = new THREE.Vector3(); cam.getWorldDirection(dir)
    const p = this._rayToFloor(cam.position, dir) ?? cam.position
    return { gx: Pieces.snapCell(p.x, cellSize), gz: Pieces.snapCell(p.z, cellSize) }
  }

  _rayToFloor (origin, dir) {
    this._ray.set(origin, dir)
    const out = new THREE.Vector3()
    const hit = this._ray.ray.intersectPlane(this._plane, out)
    return hit && hit.distanceTo(origin) < 6000 ? hit : null
  }

  // ── Pointer: ghost + click to place ─────────────────────────────────────────

  arm (on) {
    on = !!on
    if (on === this._armed) return this._armed
    this._armed = on
    if (!on) { this._hover = null; this._disposeGhost() }
    else note('Place panels', 'Move over the floor: the piece follows the grid. Click or tap to place it. Escape stops.')
    emit('omni:floorpanel-armed-changed', { on })
    return this._armed
  }
  get armed () { return this._armed }

  _pointer (e) {
    const canvas = this.ctx.renderer?.domElement; if (!canvas) return
    const r = canvas.getBoundingClientRect()
    if (!r.width || !r.height) return
    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
    this._ray.setFromCamera(ndc, this.ctx.camera)
    const hit = this._ray.ray.intersectPlane(this._plane, new THREE.Vector3())
    if (!hit || hit.distanceTo(this.ctx.camera.position) > 6000) { this._hover = null; this._updateGhost(); return }
    this.hoverAt(hit.x, hit.z)
  }

  /** Set the hover cell from a floor point (world x, z). Public so tests and the panel can drive it. */
  hoverAt (x, z) {
    const st = Settings.getSettings()
    const gx = Pieces.snapCell(x, st.cellSize); const gz = Pieces.snapCell(z, st.cellSize)
    const free = !st.snap
    this._hover = { gx, gz, ox: free ? x - Pieces.cellCenter(gx, st.cellSize) : 0, oz: free ? z - Pieces.cellCenter(gz, st.cellSize) : 0 }
    this._updateGhost()
    return this._hover
  }

  /** Place the current piece at the hover cell (what a click does). */
  placeAtHover () {
    if (!this._hover) return { ok: false, error: 'Point at the floor first.' }
    const r = this.placePiece({ gx: this._hover.gx, gz: this._hover.gz, ox: this._hover.ox, oz: this._hover.oz })
    if (!r.ok) note('Place panels', r.error)
    this._updateGhost()
    return r
  }

  _updateGhost () {
    if (!this._armed || !this._hover) { if (this._ghost) this._ghost.visible = false; return }
    const st = Settings.getSettings()
    const cells = Pieces.transformPiece(st.pieceId, st.rot, st.mirror)
    const sig = `${st.pieceId}|${st.rot}|${st.mirror}|${st.cellSize}|${st.thickness}`
    if (!this._ghost || sig !== this._ghostSig) {
      this._disposeGhost()
      this._ghostSig = sig
      this._ghost = new THREE.Mesh(Extra.buildPanelGeometry(cells.map(([x, z]) => ({ x, z })), st.cellSize, st.thickness * 1.5), new THREE.MeshBasicMaterial({ color: 0x66ff99, transparent: true, opacity: 0.5, depthWrite: false }))
      this._ghost.renderOrder = 7; this._ghost.raycast = () => {}; this._ghost.userData.isFloorGhost = true
      this.ctx.scene.add(this._ghost)
    }
    const h = this._hover
    const abs = cells.map(([x, z]) => [x + h.gx, z + h.gz])
    const ok = !Pieces.collisions(abs, this.occupied()).length && this.panelCount() + cells.length <= st.maxPanels
    this._ghost.material.color.set(ok ? 0x66ff99 : 0xff6666)
    const o = Extra.panelOrigin(h.gx, h.gz, st.cellSize, st.thickness * 1.5, h.ox, h.oz)
    this._ghost.position.set(o[0], o[1], o[2])
    this._ghost.visible = true
    emit('omni:floorpanel-hover', { gx: h.gx, gz: h.gz, ok })
  }

  _disposeGhost () {
    if (!this._ghost) return
    this.ctx.scene.remove(this._ghost); this._ghost.geometry.dispose(); this._ghost.material.dispose(); this._ghost = null; this._ghostSig = ''
  }
  get ghost () { return this._ghost }

  // ── Grid overlay ────────────────────────────────────────────────────────────

  _updateOverlay () {
    const st = Settings.getSettings()
    if (!st.overlay) { if (this._overlay) this._overlay.visible = false; return }
    const c = this._hover && this._armed ? this._hover : this.cameraTargetCell(st.cellSize)
    const sig = `${c.gx}|${c.gz}|${st.cellSize}`
    if (!this._overlay || sig !== this._overlaySig) {
      this._disposeOverlay()
      this._overlaySig = sig
      const R = OVERLAY_RADIUS; const s = st.cellSize
      const x0 = (c.gx - R) * s; const x1 = (c.gx + R + 1) * s; const z0 = (c.gz - R) * s; const z1 = (c.gz + R + 1) * s
      const v = []
      for (let i = -R; i <= R + 1; i++) { const x = (c.gx + i) * s; v.push(x, 0, z0, x, 0, z1); const z = (c.gz + i) * s; v.push(x0, 0, z, x1, 0, z) }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3))
      this._overlay = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.4, depthWrite: false }))
      this._overlay.position.y = Settings.FLOOR_LEVEL + 0.03
      this._overlay.raycast = () => {}; this._overlay.userData.isFloorGridOverlay = true; this._overlay.frustumCulled = false
      this.ctx.scene.add(this._overlay)
    }
    this._overlay.visible = true
  }
  _disposeOverlay () {
    if (!this._overlay) return
    this.ctx.scene.remove(this._overlay); this._overlay.geometry.dispose(); this._overlay.material.dispose(); this._overlay = null; this._overlaySig = ''
  }
  get overlay () { return this._overlay }

  // ── Editing a placed section ────────────────────────────────────────────────

  /** The live data object of a floorPanel node (or null). */
  getSection (id) { return this._entry(id)?.data ?? null }
  _entry (id) { const d = this.omniNode?.getNodeData?.(id); return d && Extra.isFloorPanelData(d) ? { data: d, mesh: this.omniNode.getMeshById(id) } : null }
  _saved (id) {
    emit('omni:force-save', {})
    this._faceDirty = true
    const e = this._entry(id); if (e?.mesh) Extra.refreshFloorPanelMesh(e.mesh)
    emit('omni:floorpanel-changed', { id })
  }
  _move (id, data, mesh) {
    const p = Extra.panelOrigin(data.gx, data.gz, data.cellSize, data.thickness, data.ox, data.oz)
    if (mesh) mesh.position.set(p[0], p[1], p[2])
    data.position = p
    emit('omni:node-position-set', { id, position: { x: p[0], y: p[1], z: p[2] } })
  }

  /** Remove the single panel at LOCAL cell (x, z). The node is deleted with its last panel. Returns { ok, deleted?, left? }. */
  removePanel (id, x, z) {
    const e = this._entry(id); if (!e) return { ok: false, error: 'No such panel node.' }
    const next = Pieces.removeCellAt({ gx: e.data.gx, gz: e.data.gz, cells: e.data.cells }, e.data.gx + x, e.data.gz + z)
    if (!next) return { ok: false, error: 'There is no panel there.' }
    const gone = e.data.cells.find(c => c.x === x && c.z === z)
    if (gone?.media) this.media.release(gone.media, `${id}:${x},${z}`)
    if (!next.cells.length) { emit('omni:node-delete-request', { id }); return { ok: true, deleted: true, left: 0 } }
    e.data.gx = next.gx; e.data.gz = next.gz; e.data.cells = next.cells
    this._move(id, e.data, e.mesh)
    this._saved(id)
    return { ok: true, deleted: false, left: next.cells.length }
  }

  /** op: 'cw' | 'ccw' | 'mirror'. Refused when the turned section would overlap another one. */
  transformNode (id, op) {
    const e = this._entry(id); if (!e) return { ok: false, error: 'No such panel node.' }
    const d = e.data
    const next = Pieces.transformPlacement({ gx: d.gx, gz: d.gz, cells: d.cells }, op)
    const abs = next.cells.map(c => [c.x + next.gx, c.z + next.gz])
    if (Pieces.collisions(abs, this.occupied(id)).length) return { ok: false, error: 'It would overlap another panel.' }
    const o = Pieces.nextOrientation(d.rot, d.mirror, op)
    d.gx = next.gx; d.gz = next.gz; d.cells = next.cells; d.rot = o.rot; d.mirror = o.mirror
    this._move(id, d, e.mesh)
    this._saved(id)
    return { ok: true }
  }

  /** Move the section so its local (0, 0) is on floor cell (gx, gz). */
  moveNode (id, gx, gz) {
    const e = this._entry(id); if (!e) return { ok: false, error: 'No such panel node.' }
    if (!Number.isInteger(gx) || !Number.isInteger(gz) || Math.abs(gx) > Pieces.LIMITS.grid || Math.abs(gz) > Pieces.LIMITS.grid) return { ok: false, error: 'Not a floor cell.' }
    const d = e.data
    const abs = d.cells.map(c => [c.x + gx, c.z + gz])
    if (Pieces.collisions(abs, this.occupied(id)).length) return { ok: false, error: 'There is already a panel on that spot.' }
    d.gx = gx; d.gz = gz; d.ox = 0; d.oz = 0
    this._move(id, d, e.mesh)
    this._saved(id)
    return { ok: true }
  }

  /** Re-snap the section to the grid cell its mesh is on now (after it was dragged by hand). */
  snapNode (id) {
    const e = this._entry(id); if (!e?.mesh) return { ok: false, error: 'No such panel node.' }
    const d = e.data
    const gx = Pieces.snapCell(e.mesh.position.x, d.cellSize); const gz = Pieces.snapCell(e.mesh.position.z, d.cellSize)
    return this.moveNode(id, gx, gz)
  }

  setCellMedia (id, x, z, ref) {
    const e = this._entry(id); if (!e) return { ok: false, error: 'No such panel node.' }
    const cell = e.data.cells.find(c => c.x === x && c.z === z)
    if (!cell) return { ok: false, error: 'There is no panel there.' }
    const clean = ref ? Media.sanitizeRef(ref) : null
    if (ref && !clean) return { ok: false, error: 'That media reference is not valid.' }
    if (cell.media) this.media.release(cell.media, `${id}:${x},${z}`)
    if (clean) cell.media = clean; else delete cell.media
    this._saved(id)
    return { ok: true }
  }
  setSectionMedia (id, ref) {
    const e = this._entry(id); if (!e) return { ok: false, error: 'No such panel node.' }
    for (const c of e.data.cells) { const r = this.setCellMedia(id, c.x, c.z, ref); if (!r.ok) return r }
    return { ok: true }
  }
  async attachFile (id, x, z, file, all = false) {
    const saved = await Media.saveFile(file)
    if (!saved.ok) return saved
    const r = all ? this.setSectionMedia(id, saved.ref) : this.setCellMedia(id, x, z, saved.ref)
    return r.ok ? { ok: true, ref: saved.ref } : r
  }
  attachUrl (id, x, z, url, kind = null, all = false) {
    const v = Media.validateUrl(url, kind)
    if (!v.ok) return v
    const ref = { kind: v.kind, url: v.url }
    const r = all ? this.setSectionMedia(id, ref) : this.setCellMedia(id, x, z, ref)
    return r.ok ? { ok: true, ref } : r
  }

  // ── Faces (textures on cells) ───────────────────────────────────────────────

  _planeGeo (cellSize) {
    const k = String(cellSize)
    let g = this._faceGeo.get(k)
    if (!g) { g = new THREE.PlaneGeometry(cellSize * (1 - Extra.PANEL_GAP), cellSize * (1 - Extra.PANEL_GAP)); this._faceGeo.set(k, g) }
    return g
  }

  _clearFaces (mesh) {
    const faces = mesh.userData.faces
    if (!faces) return
    for (const f of faces.values()) { mesh.remove(f); f.material.dispose() }
    mesh.userData.faces = null
  }

  _onReleased (d) {
    const mesh = d?.mesh; if (!mesh) return
    this._clearFaces(mesh)
    if (d.id) this.media.releaseUser(d.id)
  }

  /** One pass: rebuild geometry where cells changed, decide what is on screen, load / attach / drop face textures, cap the playing ones. */
  sync (dt = SYNC_INTERVAL) {
    const cam = this.ctx.camera
    this._mat4.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse)
    this._frustum.setFromProjectionMatrix(this._mat4)
    const vis = new Map()
    for (const s of this._sections()) {
      const mesh = s.mesh
      Extra.refreshFloorPanelMesh(mesh)
      if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere()
      this._sphere.copy(mesh.geometry.boundingSphere).applyMatrix4(mesh.matrixWorld)
      const dist = Math.max(0, this._sphere.center.distanceTo(cam.position) - this._sphere.radius)
      const onScreen = this._frustum.intersectsSphere(this._sphere)
      const near = onScreen && dist < LOAD_DISTANCE
      const want = new Map()   // cellKey -> cell
      for (const c of s.data.cells) if (c.media) want.set(c.x + ',' + c.z, c)
      let faces = mesh.userData.faces
      // drop faces whose cell lost its media or its panel
      if (faces) for (const [k, f] of [...faces]) {
        const c = want.get(k)
        if (!c || refKeyOf(c.media) !== f.userData.refKey) { mesh.remove(f); f.material.dispose(); faces.delete(k); if (f.userData.ref) this.media.release(f.userData.ref, `${s.id}:${k}`) }
      }
      for (const [k, c] of want) {
        let f = faces?.get(k)
        const key = Media.refKey(c.media)
        if (near) {
          const tex = this.media.acquire(c.media, `${s.id}:${k}`)
          const st = this.media.stateOf(c.media)
          if (!f) f = this._addFace(mesh, s.data, c, k, key)
          this._skin(f, tex, st)
          const cur = vis.get(key)
          if (!cur || dist < cur.dist) vis.set(key, { visible: onScreen, dist })
        } else if (f) {
          // out of range: keep the plane (cheap) but let the animated entry go idle; skin shows the placeholder if the texture is gone
          this._skin(f, this.media.textureOf(c.media), this.media.stateOf(c.media))
        }
      }
    }
    this.media.setVisibility(vis, dt)
    this._faceDirty = false
  }

  _addFace (mesh, data, cell, k, key) {
    mesh.userData.faces ??= new Map()
    const f = new THREE.Mesh(this._planeGeo(data.cellSize), new THREE.MeshBasicMaterial({ color: 0x555a66, transparent: true, side: THREE.FrontSide, toneMapped: false }))
    f.rotation.x = -Math.PI / 2
    f.position.set(cell.x * data.cellSize, data.thickness / 2 + FACE_LIFT, cell.z * data.cellSize)
    f.raycast = () => {}   // the merged geometry below is what the node click hits
    f.userData.isPanelFace = true; f.userData.refKey = key; f.userData.ref = cell.media; f.userData.cell = k
    mesh.add(f)
    mesh.userData.faces.set(k, f)
    return f
  }

  _skin (f, tex, state) {
    const m = f.material
    if (tex) { if (m.map !== tex) { m.map = tex; m.color.set(0xffffff); m.needsUpdate = true } return }
    if (m.map) { m.map = null; m.needsUpdate = true }
    m.color.set(state === 'error' ? 0x8a3030 : 0x555a66)
  }

  /** Numbers for tests and the dev panel. */
  getStats () {
    const secs = this._sections()
    let faces = 0
    secs.forEach(s => { faces += s.mesh.userData.faces?.size ?? 0 })
    return { sections: secs.length, panels: this.panelCount(), faces, media: this.media.stats(), armed: this._armed }
  }
}

const refKeyOf = (ref) => Media.refKey(ref)
