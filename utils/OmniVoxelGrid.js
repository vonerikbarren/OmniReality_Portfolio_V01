/**
 * utils/OmniVoxelGrid.js — the voxel rooms, their points, lines and routes (V210). PURE: no DOM, no Three.js.
 *
 * ROOM       one fixed-size cube cell of the world grid (ROOM_SIZE world units). The first layer of the voxel system: "the space of the reality".
 *            Integer coordinates (x, y, z); y can go below the floor too, so rooms can be built in all six directions (+-x, +-y, +-z).
 * UNITS      every position inside a room is a whole number 0..256 (SUB = 256 units per side), so every subdivision level lands exactly on the same
 *            numbers (no rounding drift). A world position is cell * ROOM_SIZE + units / 256 * ROOM_SIZE.
 * SUBDIVIDE  a room has a level (1 = whole, 2, 4, 8, ... 256 divisions per side). A sub-room can be split again (recursively); the product of the levels
 *            on a path must divide 256. Only the splits that were made are stored (sparse), never 65 536 sub-cells.
 * LINKS      the OBJECTIVE layer: neighbouring rooms (6 directions, no diagonals) are linked automatically; a link can be cut and restored.
 * POINTS     predefined: a room CENTRE and one DOOR in the middle of each shared wall that is linked. User points sit on a room's lattice. Geometry points
 *            come from a node's own shape (a sphere has points too) and are traversable as well.
 * LINES      the automatic ones are centre <-> door <-> centre; user lines join any two points; geometry edges join geometry points.
 * ROUTE      Dijkstra over points and lines (cost = length / mode speed). Stops are the points; you can get on or off only at a point.
 *
 * Hostile-input safe (every public function validates and returns {ok:false,error} instead of throwing), capped, and JSON round-trips through sanitize.
 */
export const ROOM_SIZE = 20          // world units per room side (the floor grid's own cell, modules/OmniFloor.js: 100 / 5)
export const SUB = 256               // integer units per room side
export const LEVELS = [1, 2, 4, 8, 16, 32, 64, 128, 256]
export const COORD_MAX = 512         // |x|, |y|, |z| <= 512
export const LIMITS = { cells: 4096, points: 2048, lines: 4096, geoNodes: 32, geoPoints: 64, label: 40, depth: 8 }
export const MODES = { walk: { label: 'Walk', speed: 1 }, ride: { label: 'Ride', speed: 3 }, fast: { label: 'Fast ride', speed: 8 } }
export const DIRS = [
  { id: '+x', axis: 0, sign: 1, label: 'right' }, { id: '-x', axis: 0, sign: -1, label: 'left' },
  { id: '+y', axis: 1, sign: 1, label: 'above' }, { id: '-y', axis: 1, sign: -1, label: 'below' },
  { id: '+z', axis: 2, sign: 1, label: 'front' }, { id: '-z', axis: 2, sign: -1, label: 'back' },
]
export const VERSION = 1

const isInt = (n) => Number.isInteger(n)
const fin = (n) => typeof n === 'number' && Number.isFinite(n)
const okc = (x, y, z) => isInt(x) && isInt(y) && isInt(z) && Math.abs(x) <= COORD_MAX && Math.abs(y) <= COORD_MAX && Math.abs(z) <= COORD_MAX
const str = (v, n) => String(v ?? '').slice(0, n)
const idOk = (v) => typeof v === 'string' && /^[A-Za-z0-9_.:,+-]{1,80}$/.test(v)

export const cellKey = (x, y, z) => `${x},${y},${z}`
export function parseKey (k) {
  if (typeof k !== 'string') return null
  const m = /^(-?\d{1,4}),(-?\d{1,4}),(-?\d{1,4})$/.exec(k); if (!m) return null
  const x = +m[1], y = +m[2], z = +m[3]; return okc(x, y, z) ? { x, y, z } : null
}
const dirOf = (id) => DIRS.find(d => d.id === id) ?? null
const neighborKey = (c, d) => { const a = [c.x, c.y, c.z]; a[d.axis] += d.sign; return okc(a[0], a[1], a[2]) ? cellKey(a[0], a[1], a[2]) : null }
/** canonical id of the wall between a room and its neighbour in direction d: owned by the room on the lower side. */
function faceId (key, dirId) {
  const c = parseKey(key), d = dirOf(dirId); if (!c || !d) return null
  const a = [c.x, c.y, c.z]; if (d.sign < 0) a[d.axis] -= 1
  return `${a[0]},${a[1]},${a[2]}:${'xyz'[d.axis]}`
}
export const lowerUnitsOf = (key) => { const c = parseKey(key); return c ? [c.x * ROOM_SIZE, c.y * ROOM_SIZE, c.z * ROOM_SIZE] : null }
/** world position of integer units u (0..256 each) inside room `key` */
export function unitsToWorld (key, u) {
  const o = lowerUnitsOf(key); if (!o || !Array.isArray(u) || u.length !== 3 || !u.every(fin)) return null
  return [o[0] + u[0] / SUB * ROOM_SIZE, o[1] + u[1] / SUB * ROOM_SIZE, o[2] + u[2] / SUB * ROOM_SIZE]
}
/** the room a world position is in (floor division), or null */
export function cellOfWorld (p) {
  if (!Array.isArray(p) || p.length !== 3 || !p.every(fin)) return null
  const x = Math.floor(p[0] / ROOM_SIZE), y = Math.floor(p[1] / ROOM_SIZE), z = Math.floor(p[2] / ROOM_SIZE)
  return okc(x, y, z) ? cellKey(x, y, z) : null
}
/** integer units (0..256, clamped) of a world position inside room `key` */
export function worldToUnits (key, p) {
  const o = lowerUnitsOf(key); if (!o || !Array.isArray(p) || p.length !== 3 || !p.every(fin)) return null
  return [0, 1, 2].map(i => Math.min(SUB, Math.max(0, Math.round((p[i] - o[i]) / ROOM_SIZE * SUB))))
}
const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

// ── sub-division trees ─────────────────────────────────────────────────────────

/** a tree node: { n: levelPerSide, kids: { 'i,j,k': node } } ; the root is the room itself. */
const blankTree = () => ({ n: 1, kids: {} })
function walk (tree, path, create = false) {
  let t = tree, step = SUB
  for (const p of path) {
    if (!Array.isArray(p) || p.length !== 3 || !p.every(v => isInt(v) && v >= 0 && v < t.n) || t.n < 2) return null
    step = step / t.n
    const k = p.join(','); let nxt = t.kids[k]
    if (!nxt) { nxt = blankTree(); if (create) t.kids[k] = nxt }   // a sub-room that was never split is a virtual whole one
    t = nxt
  }
  return { t, step }
}
function sanitizeTree (raw, stepIn, depth = 0) {
  if (!raw || typeof raw !== 'object' || depth > LIMITS.depth) return blankTree()
  const n = LEVELS.includes(raw.n) ? raw.n : 1
  if (n > 1 && stepIn / n < 1) return blankTree()                     // would go finer than one unit
  if (n > 1 && SUB % (SUB / stepIn * n) !== 0) return blankTree()     // the product of levels must divide 256
  const out = { n, kids: {} }
  if (n > 1 && raw.kids && typeof raw.kids === 'object') {
    let count = 0
    for (const k of Object.keys(raw.kids)) {
      const m = /^(\d{1,3}),(\d{1,3}),(\d{1,3})$/.exec(k); if (!m || +m[1] >= n || +m[2] >= n || +m[3] >= n) continue
      if (++count > 256) break
      const kid = sanitizeTree(raw.kids[k], stepIn / n, depth + 1); if (kid.n > 1) out.kids[k] = kid
    }
  }
  return out
}

// ── the grid ───────────────────────────────────────────────────────────────────

export default class VoxelGrid {
  constructor () { this.reset() }
  reset () {
    this.cells = new Map()      // key -> { key, x, y, z, label, tree }
    this.cut = new Set()        // face ids whose automatic link was cut
    this.points = new Map()     // id -> { id, cell, u:[x,y,z], label }   (user points)
    this.lines = new Map()      // id -> { id, a, b, mode }               (user lines)
    this.geo = new Map()        // nodeId -> { points:[[x,y,z]...], edges:[[i,j]...] }   (runtime: derived from node shapes, not saved)
    this._seq = 0
  }

  // rooms
  hasCell (key) { return this.cells.has(key) }
  getCell (key) { return this.cells.get(key) ?? null }
  listCells () { return [...this.cells.values()] }
  addCell (x, y, z, label = '') {
    if (!okc(x, y, z)) return { ok: false, error: 'A room needs whole-number coordinates within ±512.' }
    const key = cellKey(x, y, z)
    if (this.cells.has(key)) return { ok: true, key, same: true }
    if (this.cells.size >= LIMITS.cells) return { ok: false, error: `The limit is ${LIMITS.cells} rooms.` }
    this.cells.set(key, { key, x, y, z, label: str(label, LIMITS.label), tree: blankTree() })
    return { ok: true, key }
  }
  addNeighbor (key, dirId, label = '') {
    const c = this.cells.get(key), d = dirOf(dirId); if (!c) return { ok: false, error: 'Unknown room.' }; if (!d) return { ok: false, error: 'Unknown direction.' }
    const nk = neighborKey(c, d); if (!nk) return { ok: false, error: 'That is outside the grid.' }
    const n = parseKey(nk); return this.addCell(n.x, n.y, n.z, label)
  }
  removeCell (key) {
    if (!this.cells.delete(key)) return { ok: false, error: 'Unknown room.' }
    for (const [id, p] of [...this.points]) if (p.cell === key) this.points.delete(id)
    for (const f of [...this.cut]) { const k = parseKey(f.split(':')[0]); if (k && !this.cells.has(cellKey(k.x, k.y, k.z))) this.cut.delete(f) }
    this._pruneLines()
    return { ok: true }
  }
  renameCell (key, label) { const c = this.cells.get(key); if (!c) return { ok: false, error: 'Unknown room.' }; c.label = str(label, LIMITS.label); return { ok: true } }
  neighbors (key) {
    const c = this.cells.get(key); if (!c) return []
    return DIRS.map(d => { const nk = neighborKey(c, d); return nk && this.cells.has(nk) ? { dir: d.id, key: nk, linked: !this.cut.has(faceId(key, d.id)) } : null }).filter(Boolean)
  }
  linkOpen (key, dirId) { const n = this.neighbors(key).find(x => x.dir === dirId); return !!n && n.linked }
  cutLink (key, dirId) { const n = this.neighbors(key).find(x => x.dir === dirId); if (!n) return { ok: false, error: 'There is no room on that side.' }; this.cut.add(faceId(key, dirId)); this._pruneLines(); return { ok: true } }
  restoreLink (key, dirId) { const n = this.neighbors(key).find(x => x.dir === dirId); if (!n) return { ok: false, error: 'There is no room on that side.' }; this.cut.delete(faceId(key, dirId)); return { ok: true } }

  // subdivision
  /** set the level of the room (path = []) or of a sub-room (path = [[i,j,k], ...]) to n divisions per side */
  setLevel (key, n, path = []) {
    const c = this.cells.get(key); if (!c) return { ok: false, error: 'Unknown room.' }
    if (!LEVELS.includes(n)) return { ok: false, error: `Levels are ${LEVELS.join(', ')}.` }
    if (!Array.isArray(path) || path.length > LIMITS.depth) return { ok: false, error: 'That path is too deep.' }
    const w = walk(c.tree, path, true); if (!w) return { ok: false, error: 'That sub-room is not inside its parent. Split the parent first, and use indices inside it.' }
    if (n > 1 && w.step / n < 1) return { ok: false, error: 'That would be finer than one unit (1/256 of a room).' }
    w.t.n = n; w.t.kids = {}
    if (n === 1 && path.length) { const parent = walk(c.tree, path.slice(0, -1)); if (parent) delete parent.t.kids[path[path.length - 1].join(',')] }   // keep it sparse
    return { ok: true }
  }
  /** lattice step in units for the room (path = []) or sub-room */
  stepOf (key, path = []) { const c = this.cells.get(key); if (!c) return null; const w = walk(c.tree, path); if (!w) return null; return w.t.n > 1 ? w.step / w.t.n : w.step }
  levelOf (key, path = []) { const c = this.cells.get(key); if (!c) return null; const w = walk(c.tree, path); return w ? w.t.n : null }
  /** snap integer units to the finest lattice that applies at this room / sub-room */
  snap (key, u, path = []) {
    const step = this.stepOf(key, path); if (!step || !Array.isArray(u) || u.length !== 3 || !u.every(fin)) return null
    return u.map(v => Math.min(SUB, Math.max(0, Math.round(v / step) * step)))
  }
  /** bounds of a sub-room in units: { min:[x,y,z], size } */
  subBounds (key, path = []) {
    const c = this.cells.get(key); if (!c || !Array.isArray(path)) return null
    let min = [0, 0, 0], size = SUB, t = c.tree
    for (const p of path) {
      if (!Array.isArray(p) || p.length !== 3 || !p.every(v => isInt(v) && v >= 0 && v < t.n) || t.n < 2) return null
      size = size / t.n; min = min.map((m, i) => m + p[i] * size); t = t.kids[p.join(',')] ?? null; if (!t) { t = blankTree() }
    }
    return { min, size }
  }
  /** the world-space box of a building domain (a room or a sub-room) */
  domainBox (key, path = []) {
    const b = this.subBounds(key, path); if (!b) return null
    const lo = unitsToWorld(key, b.min), hi = unitsToWorld(key, b.min.map(v => v + b.size)); return lo && hi ? { min: lo, max: hi } : null
  }

  // user points / lines
  addPoint (key, u, label = '', path = []) {
    const c = this.cells.get(key); if (!c) return { ok: false, error: 'Unknown room.' }
    const s = this.snap(key, u, path); if (!s) return { ok: false, error: 'A point needs three numbers.' }
    if (this.points.size >= LIMITS.points) return { ok: false, error: `The limit is ${LIMITS.points} points.` }
    for (const p of this.points.values()) if (p.cell === key && p.u.every((v, i) => v === s[i])) return { ok: true, id: p.id, same: true }
    const id = `u${(++this._seq).toString(36)}${Math.random().toString(36).slice(2, 5)}`
    this.points.set(id, { id, cell: key, u: s, label: str(label, LIMITS.label) })
    return { ok: true, id }
  }
  removePoint (id) { if (!this.points.delete(id)) return { ok: false, error: 'Unknown point.' }; this._pruneLines(); return { ok: true } }
  renamePoint (id, label) { const p = this.points.get(id); if (!p) return { ok: false, error: 'Unknown point.' }; p.label = str(label, LIMITS.label); return { ok: true } }
  addLine (a, b, mode = 'walk') {
    if (!MODES[mode]) return { ok: false, error: 'Unknown mode.' }
    if (a === b) return { ok: false, error: 'A line needs two different points.' }
    const pts = this.pointIndex(); if (!pts.has(a) || !pts.has(b)) return { ok: false, error: 'Unknown point.' }
    if (this.lines.size >= LIMITS.lines) return { ok: false, error: `The limit is ${LIMITS.lines} lines.` }
    for (const l of this.lines.values()) if ((l.a === a && l.b === b) || (l.a === b && l.b === a)) { l.mode = mode; return { ok: true, id: l.id, same: true } }
    const id = `l${(++this._seq).toString(36)}${Math.random().toString(36).slice(2, 5)}`
    this.lines.set(id, { id, a, b, mode })
    return { ok: true, id }
  }
  removeLine (id) { if (!this.lines.delete(id)) return { ok: false, error: 'Unknown line.' }; return { ok: true } }
  _pruneLines () { const idx = this.pointIndex(); for (const [id, l] of [...this.lines]) if (!idx.has(l.a) || !idx.has(l.b)) this.lines.delete(id) }

  // geometry points (a node's own shape)
  setGeometry (nodeId, graph) {
    if (!idOk(nodeId)) return { ok: false, error: 'Bad node id.' }
    if (!graph || !Array.isArray(graph.points) || !graph.points.length) return { ok: false, error: 'No points.' }
    if (!this.geo.has(nodeId) && this.geo.size >= LIMITS.geoNodes) return { ok: false, error: `The limit is ${LIMITS.geoNodes} shapes.` }
    const pts = graph.points.slice(0, LIMITS.geoPoints).filter(p => Array.isArray(p) && p.length === 3 && p.every(fin)).map(p => [p[0], p[1], p[2]])
    if (!pts.length) return { ok: false, error: 'No valid points.' }
    const edges = (Array.isArray(graph.edges) ? graph.edges : []).filter(e => Array.isArray(e) && isInt(e[0]) && isInt(e[1]) && e[0] !== e[1] && e[0] >= 0 && e[1] >= 0 && e[0] < pts.length && e[1] < pts.length).slice(0, 512).map(e => [e[0], e[1]])
    this.geo.set(nodeId, { points: pts, edges }); this._pruneLines()
    return { ok: true, points: pts.length, edges: edges.length }
  }
  removeGeometry (nodeId) { if (!this.geo.delete(nodeId)) return { ok: false, error: 'Unknown shape.' }; this._pruneLines(); return { ok: true } }

  // the point list and the graph
  /** every point: { id, kind: 'centre'|'door'|'user'|'geo', cell, world:[x,y,z], label } */
  listPoints () {
    const out = []
    for (const c of this.cells.values()) {
      out.push({ id: `c:${c.key}`, kind: 'centre', cell: c.key, world: unitsToWorld(c.key, [SUB / 2, SUB / 2, SUB / 2]), label: c.label })
      for (const d of DIRS) {
        if (d.sign < 0) continue   // each wall once: owned by the lower room
        const nk = neighborKey(c, d); if (!nk || !this.cells.has(nk)) continue
        const fid = faceId(c.key, d.id); if (this.cut.has(fid)) continue
        const u = [SUB / 2, SUB / 2, SUB / 2]; u[d.axis] = SUB
        out.push({ id: `d:${fid}`, kind: 'door', cell: c.key, world: unitsToWorld(c.key, u), label: '' })
      }
    }
    for (const p of this.points.values()) out.push({ id: p.id, kind: 'user', cell: p.cell, world: unitsToWorld(p.cell, p.u), label: p.label })
    for (const [nid, g] of this.geo) g.points.forEach((w, i) => out.push({ id: `g:${nid}:${i}`, kind: 'geo', cell: cellOfWorld(w), world: w.slice(), label: '' }))
    return out
  }
  pointIndex () { const m = new Map(); for (const p of this.listPoints()) m.set(p.id, p); return m }
  /** every line: { id, a, b, mode, kind: 'link'|'user'|'geo'|'access' } */
  listLines () {
    const out = []
    for (const c of this.cells.values()) {
      for (const d of DIRS) {
        if (d.sign < 0) continue
        const nk = neighborKey(c, d); if (!nk || !this.cells.has(nk)) continue
        const fid = faceId(c.key, d.id); if (this.cut.has(fid)) continue
        out.push({ id: `k:${c.key}>${nk}:a`, a: `c:${c.key}`, b: `d:${fid}`, mode: 'walk', kind: 'link' })
        out.push({ id: `k:${c.key}>${nk}:b`, a: `d:${fid}`, b: `c:${nk}`, mode: 'walk', kind: 'link' })
      }
    }
    for (const l of this.lines.values()) out.push({ id: l.id, a: l.a, b: l.b, mode: l.mode, kind: 'user' })
    const pts = this.pointIndex()
    for (const [nid, g] of this.geo) {
      for (const [i, j] of g.edges) out.push({ id: `ge:${nid}:${i}-${j}`, a: `g:${nid}:${i}`, b: `g:${nid}:${j}`, mode: 'walk', kind: 'geo' })
      // one access line from the shape's nearest point to the centre of the room it sits in (if any), so it joins the rest of the graph
      const cell = cellOfWorld(g.points[0]); const cen = cell && this.cells.has(cell) ? pts.get(`c:${cell}`) : null
      if (cen) { let best = 0, bd = Infinity; g.points.forEach((w, i) => { const d = dist3(w, cen.world); if (d < bd) { bd = d; best = i } }); out.push({ id: `ga:${nid}`, a: `c:${cell}`, b: `g:${nid}:${best}`, mode: 'walk', kind: 'access' }) }
    }
    return out
  }
  /** the shortest (fastest) route between two points; { ok, ids, length, time, legs } or { ok:false, error } */
  route (fromId, toId) {
    const pts = this.pointIndex(); const A = pts.get(fromId), B = pts.get(toId)
    if (!A || !B) return { ok: false, error: 'Unknown point.' }
    if (fromId === toId) return { ok: true, ids: [fromId], length: 0, time: 0, legs: [] }
    const adj = new Map(); const add = (a, b, w, l) => { if (!adj.has(a)) adj.set(a, []); adj.get(a).push({ to: b, w, l }) }
    for (const l of this.listLines()) {
      const P = pts.get(l.a), Q = pts.get(l.b); if (!P || !Q) continue
      const len = dist3(P.world, Q.world); const t = len / MODES[l.mode].speed
      add(l.a, l.b, t, { ...l, length: len }); add(l.b, l.a, t, { ...l, length: len })
    }
    const best = new Map([[fromId, 0]]), prev = new Map(), done = new Set()
    const heap = [[0, fromId]]   // binary min-heap of [cost, id]
    const push = (it) => { heap.push(it); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p } }
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m } } return top }
    while (heap.length) {
      const [cb, cur] = pop()
      if (done.has(cur)) continue
      if (cur === toId) break
      done.add(cur)
      for (const e of adj.get(cur) ?? []) { const nb = cb + e.w; if (nb < (best.get(e.to) ?? Infinity) - 1e-12) { best.set(e.to, nb); prev.set(e.to, { from: cur, l: e.l }); push([nb, e.to]) } }
    }
    if (!best.has(toId)) return { ok: false, error: 'No route: these points are not joined by lines.' }
    const ids = [toId], legs = []; let at = toId
    while (at !== fromId) { const p = prev.get(at); legs.unshift({ from: p.from, to: at, mode: p.l.mode, length: p.l.length, kind: p.l.kind }); at = p.from; ids.unshift(at) }
    return { ok: true, ids, length: legs.reduce((s, l) => s + l.length, 0), time: best.get(toId), legs }
  }

  // save / load
  toJSON () {
    const cells = this.listCells().map(c => ({ x: c.x, y: c.y, z: c.z, label: c.label, tree: c.tree.n > 1 ? c.tree : undefined }))
    return { version: VERSION, cells, cut: [...this.cut], points: [...this.points.values()].map(p => ({ id: p.id, cell: p.cell, u: p.u, label: p.label })), lines: [...this.lines.values()].map(l => ({ id: l.id, a: l.a, b: l.b, mode: l.mode })) }
  }
  /** replace everything from untrusted data. Returns { ok, cells, points, lines, dropped } */
  load (raw) {
    this.reset()
    if (!raw || typeof raw !== 'object' || raw.version !== VERSION) return { ok: false, error: 'Not a voxel save.', cells: 0, points: 0, lines: 0, dropped: 0 }
    let dropped = 0
    for (const c of (Array.isArray(raw.cells) ? raw.cells : []).slice(0, LIMITS.cells)) {
      const r = c && typeof c === 'object' ? this.addCell(c.x, c.y, c.z, c.label) : { ok: false }
      if (!r.ok) { dropped++; continue }
      this.cells.get(r.key).tree = sanitizeTree(c.tree, SUB)
    }
    for (const f of (Array.isArray(raw.cut) ? raw.cut : []).slice(0, LIMITS.cells * 3)) if (typeof f === 'string' && /^-?\d{1,4},-?\d{1,4},-?\d{1,4}:[xyz]$/.test(f)) this.cut.add(f)
    for (const p of (Array.isArray(raw.points) ? raw.points : []).slice(0, LIMITS.points)) {
      if (!p || !idOk(p.id) || !this.cells.has(p.cell) || !Array.isArray(p.u) || p.u.length !== 3 || !p.u.every(v => isInt(v) && v >= 0 && v <= SUB)) { dropped++; continue }
      this.points.set(p.id, { id: p.id, cell: p.cell, u: p.u.slice(), label: str(p.label, LIMITS.label) })
    }
    const idx = this.pointIndex()
    for (const l of (Array.isArray(raw.lines) ? raw.lines : []).slice(0, LIMITS.lines)) {
      if (!l || !idOk(l.id) || !idx.has(l.a) || !idx.has(l.b) || l.a === l.b || !MODES[l.mode]) { dropped++; continue }
      this.lines.set(l.id, { id: l.id, a: l.a, b: l.b, mode: l.mode })
    }
    return { ok: true, cells: this.cells.size, points: this.points.size, lines: this.lines.size, dropped }
  }
}
