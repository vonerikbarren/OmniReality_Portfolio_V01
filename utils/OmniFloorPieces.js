/**
 * utils/OmniFloorPieces.js — the PURE logic of the floorPanelNode maker (V191): Tetris pieces on the floor grid.
 *
 * A piece is a set of connected cells [x, z] (x to the right, z toward the viewer / "down" on a top-down map). The seven tetrominoes
 * I O T S Z J L are the options the owner asked for; a monomino, a domino and the two triominoes are extras. A piece can be rotated in
 * 90 degree steps (clockwise seen from above) and mirrored. Everything here is pure (no THREE, no DOM, no storage) so it is unit tested.
 *
 *   cells are always NORMALISED: translated so min x = 0 and min z = 0, sorted by (z, x), no duplicates.
 *   transformPiece(id, rot, mirror)   mirror is applied first (flip left/right), then rot * 90 degrees clockwise
 *   snapCell(x, z, size)              world metres -> integer cell index (cell i covers [i*size, (i+1)*size), like the floor grid lines)
 *   cellCenter(i, size)               integer cell -> world coordinate of the cell centre
 *   footprint(cells, gx, gz)          local cells + anchor cell -> absolute grid cells
 *   sanitizeCells(raw, cap)           hostile-input validation of a stored cell list
 *
 * USER-facing module: it must never import a Dev* module.
 */

/** Hard bounds. */
export const LIMITS = { cellsPerPiece: 8, grid: 100000, size: 200 }

/** Base shapes (spawn orientation, as in the usual Tetris diagrams, z grows downward). */
export const PIECES = {
  I: { id: 'I', name: 'I (line of 4)', group: 'tetromino', cells: [[0, 0], [1, 0], [2, 0], [3, 0]] },
  O: { id: 'O', name: 'O (square)', group: 'tetromino', cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  T: { id: 'T', name: 'T', group: 'tetromino', cells: [[0, 0], [1, 0], [2, 0], [1, 1]] },
  S: { id: 'S', name: 'S', group: 'tetromino', cells: [[1, 0], [2, 0], [0, 1], [1, 1]] },
  Z: { id: 'Z', name: 'Z', group: 'tetromino', cells: [[0, 0], [1, 0], [1, 1], [2, 1]] },
  J: { id: 'J', name: 'J', group: 'tetromino', cells: [[0, 0], [0, 1], [1, 1], [2, 1]] },
  L: { id: 'L', name: 'L', group: 'tetromino', cells: [[2, 0], [0, 1], [1, 1], [2, 1]] },
  mono: { id: 'mono', name: 'Single panel', group: 'extra', cells: [[0, 0]] },
  domino: { id: 'domino', name: 'Domino (2)', group: 'extra', cells: [[0, 0], [1, 0]] },
  tri_i: { id: 'tri_i', name: 'Straight 3', group: 'extra', cells: [[0, 0], [1, 0], [2, 0]] },
  tri_l: { id: 'tri_l', name: 'Corner 3', group: 'extra', cells: [[0, 0], [0, 1], [1, 1]] },
}
export const PIECE_IDS = Object.keys(PIECES)
export const TETROMINO_IDS = ['I', 'O', 'T', 'S', 'Z', 'J', 'L']
export const isPieceId = (v) => typeof v === 'string' && Object.prototype.hasOwnProperty.call(PIECES, v)

const num = (v) => typeof v === 'number' && Number.isFinite(v)
const int = (v) => num(v) && Number.isInteger(v)

/** Translate to min 0,0 and sort by (z, x); drops duplicates. Returns a new array of [x, z]. */
export function normalizeCells (cells) {
  if (!Array.isArray(cells) || !cells.length) return []
  const seen = new Set(); const out = []
  let minX = Infinity; let minZ = Infinity
  for (const c of cells) { if (c[0] < minX) minX = c[0]; if (c[1] < minZ) minZ = c[1] }
  for (const c of cells) {
    const x = c[0] - minX; const z = c[1] - minZ; const k = x + ',' + z
    if (!seen.has(k)) { seen.add(k); out.push([x, z]) }
  }
  return out.sort((a, b) => a[1] - b[1] || a[0] - b[0])
}

/** One clockwise quarter turn seen from above (x right, z down): (x, z) -> (-z, x). */
export const rotateCW = (cells) => normalizeCells(cells.map(([x, z]) => [-z, x]))
/** Left/right flip: (x, z) -> (-x, z). */
export const mirrorCells = (cells) => normalizeCells(cells.map(([x, z]) => [-x, z]))

export function transformCells (cells, rot = 0, mirror = false) {
  let c = normalizeCells(cells)
  if (mirror) c = mirrorCells(c)
  const r = ((Math.round(+rot || 0) % 4) + 4) % 4
  for (let i = 0; i < r; i++) c = rotateCW(c)
  return c
}

/** Cells of piece `id` after mirror + rot quarter turns. Unknown id -> []. */
export function transformPiece (id, rot = 0, mirror = false) {
  return isPieceId(id) ? transformCells(PIECES[id].cells, rot, mirror) : []
}

export const cellsKey = (cells) => normalizeCells(cells).map(c => c.join(',')).join(';')

/** The distinct orientations of a piece. mirror=false: rotations only; true: mirror images too. */
export function uniqueOrientations (id, withMirror = false) {
  const seen = new Map()
  for (const m of withMirror ? [false, true] : [false]) {
    for (let r = 0; r < 4; r++) {
      const c = transformPiece(id, r, m); const k = cellsKey(c)
      if (!seen.has(k)) seen.set(k, { rot: r, mirror: m, cells: c })
    }
  }
  return [...seen.values()]
}

/** True when the cells form ONE edge-connected group (a path section has no islands). */
export function isConnected (cells) {
  const c = normalizeCells(cells)
  if (!c.length) return false
  const set = new Set(c.map(p => p.join(',')))
  const seen = new Set([c[0].join(',')]); const q = [c[0]]
  while (q.length) {
    const [x, z] = q.pop()
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const k = (x + dx) + ',' + (z + dz)
      if (set.has(k) && !seen.has(k)) { seen.add(k); q.push([x + dx, z + dz]) }
    }
  }
  return seen.size === set.size
}

export const bounds = (cells) => {
  const c = normalizeCells(cells)
  return { w: c.length ? Math.max(...c.map(p => p[0])) + 1 : 0, h: c.length ? Math.max(...c.map(p => p[1])) + 1 : 0 }
}

// ── Grid snapping ─────────────────────────────────────────────────────────────

export const clampSize = (v, dflt = 20) => (num(+v) && +v >= 0.25 && +v <= LIMITS.size ? +v : dflt)
/** Integer cell index of a world coordinate (-0 normalised to 0). Cell i covers [i*size, (i+1)*size). */
export function snapCell (v, size = 20) {
  const s = clampSize(size)
  if (!num(v)) return 0
  const i = Math.floor(v / s)
  return Math.max(-LIMITS.grid, Math.min(LIMITS.grid, i)) + 0
}
export const cellCenter = (i, size = 20) => (i + 0.5) * clampSize(size)
/** Absolute grid cells of a local cell list anchored at (gx, gz). */
export function footprint (cells, gx = 0, gz = 0) { return cells.map(([x, z]) => [x + gx, z + gz]) }
export const cellKey = (gx, gz) => gx + ',' + gz

/** Which of `cells` (absolute) are already occupied according to the `occupied` Set of 'gx,gz' keys. */
export function collisions (absCells, occupied) { return absCells.filter(([x, z]) => occupied.has(cellKey(x, z))) }

// ── Validation of stored / hostile data ───────────────────────────────────────

/** [[x,z],...] with small integers, at most `cap` entries, no duplicates, normalised. Anything else -> []. */
export function sanitizeCells (raw, cap = LIMITS.cellsPerPiece) {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > cap) return []
  const out = []
  for (const c of raw) {
    if (!Array.isArray(c) || c.length !== 2 || !int(c[0]) || !int(c[1]) || Math.abs(c[0]) > 64 || Math.abs(c[1]) > 64) return []
    out.push([c[0], c[1]])
  }
  return normalizeCells(out)
}

// ── Placements (a piece standing on the grid, cells may carry a payload) ───────
// A placement is { gx, gz, cells:[{ x, z, ...payload }] }: x, z are LOCAL cells, (gx, gz) is the grid cell of local (0, 0). Removing one panel
// just deletes its entry; rotating or mirroring keeps the top-left corner of the bounding box where it is and keeps every payload with its cell.

const shape = (cells, f) => {
  const t = cells.map(c => { const [x, z] = f(c.x, c.z); return { ...c, x, z } })
  const mx = Math.min(...t.map(c => c.x)); const mz = Math.min(...t.map(c => c.z))
  return { dx: mx, dz: mz, cells: t.map(c => ({ ...c, x: c.x - mx, z: c.z - mz })).sort((a, b) => a.z - b.z || a.x - b.x) }
}

/** Absolute cells of a placement: [{ gx, gz, ...payload }]. */
export const placementCells = (pl) => pl.cells.map(c => { const { x, z, ...rest } = c; return { ...rest, gx: pl.gx + x, gz: pl.gz + z } })

/** op: 'cw' | 'ccw' | 'mirror'. Returns a NEW placement (the input is not changed). Empty placements are returned as they are. */
export function transformPlacement (pl, op) {
  if (!pl || !pl.cells.length) return pl
  const minX = Math.min(...pl.cells.map(c => c.x + pl.gx)); const minZ = Math.min(...pl.cells.map(c => c.z + pl.gz))
  const rel = pl.cells.map(c => ({ ...c, x: c.x + pl.gx - minX, z: c.z + pl.gz - minZ }))
  const f = op === 'cw' ? (x, z) => [-z, x] : op === 'ccw' ? (x, z) => [z, -x] : (x, z) => [-x, z]
  const r = shape(rel, f)
  return { gx: minX, gz: minZ, cells: r.cells }
}

/** New placement without the panel at absolute cell (gx, gz); null when nothing was removed. The other panels keep their LOCAL coordinates and their media. */
export function removeCellAt (pl, gx, gz) {
  const left = pl.cells.filter(c => !(pl.gx + c.x === gx && pl.gz + c.z === gz))
  if (left.length === pl.cells.length) return null
  return { gx: pl.gx, gz: pl.gz, cells: left }   // local coordinates stay as they are, so a panel keeps its identity
}

/** Rotation count after an operation on a node that stores (rot, mirror) as provenance. */
export function nextOrientation (rot, mirror, op) {
  const r = ((Math.round(+rot || 0) % 4) + 4) % 4
  if (op === 'cw') return { rot: (r + 1) % 4, mirror: !!mirror }
  if (op === 'ccw') return { rot: (r + 3) % 4, mirror: !!mirror }
  return { rot: (4 - r) % 4, mirror: !mirror }
}
