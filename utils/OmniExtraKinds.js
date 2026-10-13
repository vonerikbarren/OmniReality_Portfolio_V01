/**
 * utils/OmniExtraKinds.js — the two OmniNode KINDS of V191, next to the V183 kinds in utils/OmniNodeKinds.js:
 *
 *   omniPath    an OmniPathNode: stands for one ordered PATH of nodes.   data = { nodeKind:'omniPath', pathId }
 *               (the members and the order live in utils/OmniPathModel.js; the node only carries the reference)
 *   floorPanel  a floorPanelNode: one Tetris-piece shaped SECTION of panels on the floor grid.
 *               data = { nodeKind:'floorPanel', pieceId, rot, mirror, gx, gz, ox, oz, cellSize, thickness, panelOpacity, cells:[{ x, z, media? }] }
 *               x, z are LOCAL cells; (gx, gz) is the floor cell of local (0, 0); media is a utils/FloorPanelMedia.js reference.
 *
 * Like the V183 kinds these are ordinary OmniNode nodes (systems/OmniNode.js `_nodes`) that carry a kind marker in `data`, so selection, the
 * Inspector, grouping, delete, save / load and the Timeline need no change. systems/OmniNode.js calls extraCreateFields (create request) and
 * buildExtraMesh (create + restore); the mesh carries `userData.omniRelease` which utils/OmniNodeKinds.js releaseKindMesh runs on delete.
 *
 * A floor panel section is ONE merged geometry (one draw call however many cells), hit-testable by the node's normal raycast. Faces that carry a
 * picture / GIF / video are overlay planes added by systems/OmniFloorPanels.js (never here: this module has no textures, no DOM, no storage).
 *
 * USER-facing module: it must never import a Dev* module.
 */

import * as THREE from 'three'
import { isPieceId, PIECES, transformPiece, clampSize, LIMITS as PL } from './OmniFloorPieces.js'
import { sanitizeRef } from './FloorPanelMedia.js'
import * as Paths from './OmniPathModel.js'
import { FLOOR_GRID_UNIT, FLOOR_LEVEL } from './FloorNodeMakerSettings.js'

export const KIND_PATH = 'omniPath'
export const KIND_FLOOR_PANEL = 'floorPanel'
export const EXTRA_KINDS = [KIND_PATH, KIND_FLOOR_PANEL]
export const GEO_PATH = 'OmniPathNode'
export const GEO_FLOOR_PANEL = 'FloorPanelNode'
export const PANEL_GAP = 0.04   // fraction of a cell left between neighbouring panels
export const MAX_PANELS_HARD = 1000

/** The two runtimes register themselves here in init() so the Inspector block and the panels can reach them without importing systems/ (set to null in destroy()). */
export const SERVICES = { paths: null, panels: null }

export const isExtraKind = (d) => !!d && (d.nodeKind === KIND_PATH || d.nodeKind === KIND_FLOOR_PANEL)
export const isFloorPanelData = (d) => !!d && d.nodeKind === KIND_FLOOR_PANEL
export const isPathData = (d) => !!d && d.nodeKind === KIND_PATH

const clip = (s, n) => { const t = String(s ?? ''); return t.length > n ? t.slice(0, n - 1) + '…' : t }
const num = (v) => typeof v === 'number' && Number.isFinite(v)

// ── Floor panel data ──────────────────────────────────────────────────────────

/** Panel Y for a given thickness: just above the floor plane (it sits at FLOOR_LEVEL) so the panel never z-fights with it. */
export const panelY = (thickness) => FLOOR_LEVEL + 0.02 + thickness / 2
/** World position of local cell (0,0)'s centre for a placement. */
export const panelOrigin = (gx, gz, cellSize, thickness, ox = 0, oz = 0) => [(gx + 0.5) * cellSize + ox, panelY(thickness), (gz + 0.5) * cellSize + oz]

/**
 * Validate the floor-panel fields of a create request / stored node into clean ones. Returns null when it cannot be a floorPanel.
 * `cells` wins over pieceId/rot/mirror when valid; otherwise the cells come from the piece.
 */
export function sanitizeFloorPanel (d) {
  if (!d || typeof d !== 'object') return null
  const pieceId = isPieceId(d.pieceId) ? d.pieceId : null
  const rot = ((Math.round(+d.rot || 0) % 4) + 4) % 4
  const mirror = d.mirror === true
  let cells = []
  if (Array.isArray(d.cells)) {
    const seen = new Set()
    for (const c of d.cells.slice(0, PL.cellsPerPiece)) {
      if (!c || typeof c !== 'object' || !Number.isInteger(c.x) || !Number.isInteger(c.z) || Math.abs(c.x) > 64 || Math.abs(c.z) > 64) { cells = []; break }
      const k = c.x + ',' + c.z
      if (seen.has(k)) { cells = []; break }
      seen.add(k)
      const media = c.media ? sanitizeRef(c.media) : null
      cells.push({ x: c.x, z: c.z, ...(media ? { media } : {}) })
    }
  }
  if (!cells.length && pieceId) cells = transformPiece(pieceId, rot, mirror).map(([x, z]) => ({ x, z }))
  if (!cells.length) return null
  const gx = Number(d.gx); const gz = Number(d.gz)
  if (!Number.isInteger(gx) || !Number.isInteger(gz) || Math.abs(gx) > PL.grid || Math.abs(gz) > PL.grid) return null
  const cellSize = clampSize(d.cellSize, FLOOR_GRID_UNIT)
  const thickness = num(d.thickness) ? Math.min(2, Math.max(0.02, d.thickness)) : 0.2
  const panelOpacity = num(d.panelOpacity) ? Math.min(1, Math.max(0.1, d.panelOpacity)) : 0.9
  // ox, oz: a free (snap off) offset inside the cell, in world units; 0 when snapped
  const ox = num(d.ox) ? Math.min(cellSize / 2, Math.max(-cellSize / 2, d.ox)) : 0
  const oz = num(d.oz) ? Math.min(cellSize / 2, Math.max(-cellSize / 2, d.oz)) : 0
  return { nodeKind: KIND_FLOOR_PANEL, pieceId: pieceId ?? 'mono', rot, mirror, gx, gz, ox, oz, cellSize, thickness, panelOpacity, cells }
}

/** Short signature of everything that shapes the merged geometry (a change means a rebuild). */
export const panelSig = (d) => `${d.cellSize}|${d.thickness}|${d.cells.map(c => c.x + ',' + c.z).join(';')}`

/** Fields to merge into a new node's data for a create request, or null for an ordinary node. { geometry, label, data }. */
export function extraCreateFields (spec) {
  if (!spec || typeof spec !== 'object') return null
  if (spec.nodeKind === KIND_PATH) {
    if (!Paths.isId(spec.pathId)) return null
    const p = Paths.getPath(spec.pathId)
    return { geometry: GEO_PATH, label: clip(p?.name || 'Path', 40), data: { nodeKind: KIND_PATH, pathId: spec.pathId } }
  }
  if (spec.nodeKind === KIND_FLOOR_PANEL) {
    const fp = sanitizeFloorPanel(spec)
    if (!fp) return null
    const piece = PIECES[fp.pieceId]
    return { geometry: GEO_FLOOR_PANEL, label: clip(`Floor ${piece?.name ?? 'panel'} ${fp.gx},${fp.gz}`, 40), data: fp }
  }
  return null
}

// ── Geometry ──────────────────────────────────────────────────────────────────

/** One merged BufferGeometry of boxes, one per cell, centred on local cell (0,0). Pure THREE, no DOM. */
export function buildPanelGeometry (cells, cellSize, thickness) {
  const sx = cellSize * (1 - PANEL_GAP) / 2; const sy = thickness / 2
  const pos = []; const nor = []; const uv = []; const idx = []
  const faces = [
    { n: [0, 1, 0], v: [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]] },
    { n: [0, -1, 0], v: [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]] },
    { n: [0, 0, 1], v: [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]] },
    { n: [0, 0, -1], v: [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]] },
    { n: [1, 0, 0], v: [[1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1]] },
    { n: [-1, 0, 0], v: [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]] },
  ]
  const uvs = [[0, 0], [1, 0], [1, 1], [0, 1]]
  for (const c of cells) {
    const cx = c.x * cellSize; const cz = c.z * cellSize
    for (const f of faces) {
      const base = pos.length / 3
      f.v.forEach((v, i) => { pos.push(cx + v[0] * sx, v[1] * sy, cz + v[2] * sx); nor.push(...f.n); uv.push(...uvs[i]) })
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeBoundingSphere(); g.computeBoundingBox()
  return g
}

let SHARED_MARKER = null
const markerGeometry = () => (SHARED_MARKER ??= new THREE.OctahedronGeometry(0.45, 0))

const LIVE = new Set()
export const liveFloorPanelMeshes = () => [...LIVE].filter(m => m.userData?.extraKind?.kind === KIND_FLOOR_PANEL)
export const liveExtraMeshes = () => [...LIVE]

/** The Three mesh for an extra-kind node. Never throws: a broken floorPanel gets a tiny placeholder box. */
export function buildExtraMesh (data, color) {
  const col = color ?? 0xffffff
  if (data.nodeKind === KIND_PATH) {
    const mesh = new THREE.Mesh(markerGeometry(), new THREE.MeshStandardMaterial({ color: col, roughness: 0.4, metalness: 0.2, emissive: 0x111111 }))
    mesh.userData.extraKind = { kind: KIND_PATH, data }
    mesh.userData.omniRelease = releaseExtraMesh
    LIVE.add(mesh)
    return mesh
  }
  const fp = sanitizeFloorPanel(data)
  let geo
  if (fp) {
    // fill missing fields on the stored data object itself (it is the node's data), keep what was there
    for (const k of ['pieceId', 'rot', 'mirror', 'gx', 'gz', 'ox', 'oz', 'cellSize', 'thickness', 'panelOpacity', 'cells']) data[k] = fp[k]
    geo = buildPanelGeometry(fp.cells, fp.cellSize, fp.thickness)
  } else {
    geo = new THREE.BoxGeometry(1, 0.2, 1)
  }
  const op = fp?.panelOpacity ?? 0.9
  const mat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.55, metalness: 0.1, transparent: op < 1, opacity: op })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.userData.extraKind = { kind: KIND_FLOOR_PANEL, data, sig: fp ? panelSig(fp) : 'bad', broken: !fp }
  mesh.userData.omniRelease = releaseExtraMesh
  LIVE.add(mesh)
  return mesh
}

/** Rebuild the merged geometry when the cells / size / thickness of the node's data changed. Returns true when it did. */
export function refreshFloorPanelMesh (mesh) {
  const ek = mesh?.userData?.extraKind
  if (!ek || ek.kind !== KIND_FLOOR_PANEL || !ek.data) return false
  const fp = sanitizeFloorPanel(ek.data)
  if (!fp) return false
  const sig = panelSig(fp)
  const op = fp.panelOpacity
  if (mesh.material) { mesh.material.opacity = op; mesh.material.transparent = op < 1 }
  if (sig === ek.sig) return false
  const old = mesh.geometry
  mesh.geometry = buildPanelGeometry(fp.cells, fp.cellSize, fp.thickness)
  old?.dispose?.()
  ek.sig = sig; ek.broken = false
  return true
}

/** Run by utils/OmniNodeKinds.js releaseKindMesh when the node is deleted / the scene is cleared. Idempotent. */
export function releaseExtraMesh (mesh) {
  const ek = mesh?.userData?.extraKind
  if (!ek) return
  try { window.dispatchEvent(new CustomEvent('omni:extra-mesh-released', { detail: { mesh, kind: ek.kind, id: mesh.userData.nodeId } })) } catch (_) { /* no window */ }
  LIVE.delete(mesh)
  delete mesh.userData.extraKind
  delete mesh.userData.omniRelease
}

export function extraStats () {
  const panels = liveFloorPanelMeshes()
  return { paths: [...LIVE].filter(m => m.userData?.extraKind?.kind === KIND_PATH).length, sections: panels.length, panels: panels.reduce((n, m) => n + (m.userData.extraKind.data?.cells?.length ?? 0), 0) }
}
