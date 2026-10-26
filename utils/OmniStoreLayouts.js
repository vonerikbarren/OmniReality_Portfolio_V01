/**
 * utils/OmniStoreLayouts.js — swappable store layouts (V179, BuildOrder item 4). PURE: no DOM, no THREE, no storage.
 *
 * NOT to be confused with utils/OmniStoreLayout.js (singular: where the floating HUD may sit around the hands).
 *
 * A LAYOUT separates "where the products go" from "what the store looks like": it is a function from the product count of
 * the current page to PLACEMENTS + the FURNITURE to draw + the CAMERA framing. All coordinates are LOCAL to the store
 * anchor (the scene adds the anchor), y is up, the default viewer looks down -z from +z.
 *
 *   build(ctx) -> {
 *     slots:     [{x, y, z, ry, rx, scale}]       one per product (ry = yaw about y, rx = tilt about the slot's own x; the slot
 *                                                  faces (sin ry cos rx, -sin rx, cos ry cos rx); order = the product order)
 *     furniture: [{kind, x, y, z, ry, ...}]       kind: 'plank' | 'wall' | 'floor' | 'pillar' | 'table' | 'rail' (see FURNITURE_KINDS)
 *     camera:    { pose(view, state) -> {pos, target, dist, dx, dy}, stops: [{id,label,pos,target,slotRange}] | null,
 *                  modes: ['outside','inside'] | null }
 *     bounds:    { radius, height }                horizontal radius from the anchor and total height of everything drawn
 *     perPageMax, meta }
 *   ctx = { count, perPage, aspect, isPhone, settings }
 *   view = { fov, aspect, W, H, x0, x1, y0, y1 }   the camera and the FREE part of the viewport (the scene's _usable())
 *
 * Unknown ids fall back to 'shelf'. Everything is deterministic: the same ctx gives the same result.
 * The DOME rule: the backdrop dome has radius 120 around the anchor; every layout must stay inside BOUNDS_MAX (60) and the
 * camera poses are capped at MAX_DIST (70, below the orbit controls' 80 and below 0.92 x 120).
 */

export const LAYOUT_IDS = Object.freeze(['shelf', 'ring', 'aisle', 'island'])
export const DEFAULT_LAYOUT = 'shelf'
export const SPACING = 1.5                 // centre-to-centre distance of neighbouring products (the V176 shelf value)
export const PER_PAGE_MAX = 60             // the items-per-page setting's own cap (6..60) is the hard cap for every layout
export const BOUNDS_MAX = 60               // layouts must fit inside this radius (the dome is 120)
export const DOME_RADIUS = 120
export const MAX_DIST = 70                 // camera pose distance cap
export const RING_RMIN = 2.6
export const RING_MAX_PER_TIER = 30
export const RING_MAX_PER_TIER_NARROW = 12
export const AISLE_BAY_CAP = 6             // products per bay (desktop); narrow: AISLE_BAY_CAP_NARROW
export const AISLE_BAY_CAP_NARROW = 4
export const AISLE_MAX_PAIRS = 12          // aisle length cap: 12 pairs x 5.3 = 63.6
export const FURNITURE_KINDS = Object.freeze(['plank', 'wall', 'floor', 'pillar', 'table', 'rail'])

export const DEFAULT_VIEW = Object.freeze({ fov: 60, aspect: 16 / 9, W: 1280, H: 720, x0: 0, x1: 1280, y0: 0, y1: 720 })

const TAU = Math.PI * 2
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const finite = (x) => typeof x === 'number' && Number.isFinite(x)

export const isLayoutId = (id) => LAYOUT_IDS.includes(id)
export const normalizeId = (id) => (isLayoutId(id) ? id : DEFAULT_LAYOUT)
export const nextLayoutId = (id) => LAYOUT_IDS[(LAYOUT_IDS.indexOf(normalizeId(id)) + 1) % LAYOUT_IDS.length]

// ── camera helpers (shared by every layout; the shelf version is exactly V178's flyToShelf maths) ──────────────────

function fixView (v) {
  const d = DEFAULT_VIEW
  const o = { ...d, ...(v && typeof v === 'object' ? v : {}) }
  if (!finite(o.fov) || o.fov <= 1) o.fov = d.fov
  if (!finite(o.aspect) || o.aspect <= 0) o.aspect = d.aspect
  if (!finite(o.W) || o.W <= 0) o.W = d.W
  if (!finite(o.H) || o.H <= 0) o.H = d.H
  if (!finite(o.x0)) o.x0 = 0
  if (!finite(o.y0)) o.y0 = 0
  if (!finite(o.x1) || o.x1 <= o.x0) o.x1 = o.W
  if (!finite(o.y1) || o.y1 <= o.y0) o.y1 = o.H
  return o
}

/** Distance at which a w x h (world units) rectangle facing the camera fits the FREE part of the viewport. */
export function fitDistance (w, h, view, margin = 1.04, add = 1) {
  const v = fixView(view)
  const tanV = Math.tan(v.fov * Math.PI / 360)
  const uw = v.x1 - v.x0, uh = v.y1 - v.y0
  const needV = h * (v.H / uh), needW = w * (v.W / uw)
  return Math.max(needV / 2 / tanV, needW / 2 / (tanV * v.aspect)) * margin + add
}

/** Sideways / vertical camera shift (world units at the target plane) that puts the subject in the middle of the free region. */
export function shiftFor (dist, view) {
  const v = fixView(view)
  const tanV = Math.tan(v.fov * Math.PI / 360)
  const visH = 2 * dist * tanV, visW = visH * v.aspect
  const uw = v.x1 - v.x0, uh = v.y1 - v.y0
  const ox = (v.x0 + uw / 2) - v.W / 2, oy = (v.y0 + uh / 2) - v.H / 2
  return { dx: -ox / v.W * visW, dy: oy / v.H * visH }
}

const capDist = (d) => Math.min(MAX_DIST, d)

// ── bounds ──────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Local half extents (x, z) of one furniture item before rotation. */
function halfExtents (f) {
  switch (f.kind) {
    case 'plank': return [(f.sx ?? 1) / 2, 0.35 * (f.sz ?? 1)]
    case 'wall': return [(f.sx ?? 1) / 2, 0]
    case 'floor': case 'table': return f.r ? [f.r, f.r] : [(f.sx ?? 1) / 2, (f.sz ?? 1) / 2]
    case 'pillar': case 'rail': return [f.r ?? 1, f.r ?? 1]
    default: return [0, 0]
  }
}

export function computeBounds (slots, furniture) {
  let radius = 0, ymin = Infinity, ymax = -Infinity
  for (const s of slots) {
    radius = Math.max(radius, Math.hypot(s.x, s.z) + 0.7)
    ymin = Math.min(ymin, s.y - 0.7); ymax = Math.max(ymax, s.y + 0.7)
  }
  for (const f of furniture) {
    if (f.r) radius = Math.max(radius, Math.hypot(f.x, f.z) + f.r)   // circular item (disc floor, pillar, ring band)
    else {
      const [ex, ez] = halfExtents(f)
      const c = Math.abs(Math.cos(f.ry ?? 0)), s = Math.abs(Math.sin(f.ry ?? 0))
      const wx = c * ex + s * ez, wz = s * ex + c * ez
      radius = Math.max(radius, Math.hypot(Math.abs(f.x) + wx, Math.abs(f.z) + wz))
    }
    let hy = 0.05
    if (f.kind === 'wall') hy = (f.sy ?? 1) / 2
    else if (f.kind === 'pillar') hy = (f.h ?? 1) / 2
    else if (f.kind === 'table') hy = (f.sy ?? 1) / 2
    ymin = Math.min(ymin, f.y - hy); ymax = Math.max(ymax, f.y + hy)
  }
  if (!Number.isFinite(ymin)) { ymin = 0; ymax = 0 }
  return { radius: Math.round(radius * 100) / 100, height: Math.round((ymax - ymin) * 100) / 100, yMin: Math.round(ymin * 100) / 100, yMax: Math.round(ymax * 100) / 100 }
}

const slot = (x, y, z, ry = 0, rx = 0, scale = 1) => ({ x, y, z, ry, rx, scale })

// ── SHELF — exactly the V176-V178 arrangement ───────────────────────────────────────────────────────────────────────

function buildShelf (ctx) {
  const n = ctx.count
  const cols = ctx.aspect < 0.85 ? 4 : 6               // V178: a narrow viewport gets 4 columns
  const rowsUsed = Math.max(1, Math.ceil(n / cols))
  const rows = Math.max(rowsUsed, Math.min(Math.ceil(ctx.perPage / cols), 4))   // framing: at least 4 rows (the V176 look)
  const slots = []
  for (let i = 0; i < n; i++) {
    const col = i % cols, row = Math.floor(i / cols)
    slots.push(slot((col - (cols - 1) / 2) * SPACING, ((rowsUsed - 1) / 2 - row) * SPACING + 0.15, 0))
  }
  const w = cols * SPACING, h = rowsUsed * SPACING
  const furniture = [{ kind: 'wall', x: 0, y: 0.15, z: -0.65, ry: 0, sx: w + 0.8, sy: h + 0.8 }]
  for (let r = 0; r < rowsUsed; r++) furniture.push({ kind: 'plank', x: 0, y: ((rowsUsed - 1) / 2 - r) * SPACING + 0.15 - 0.55, z: -0.25, ry: 0, sx: w + 0.6 })
  const fw = cols * SPACING + 1, fh = rows * SPACING + 1.2
  return {
    slots, furniture,
    camera: {
      stops: null, modes: null,
      pose: (view) => {
        const dist = capDist(fitDistance(fw, fh, view))
        const { dx, dy } = shiftFor(dist, view)
        return { pos: [dx, dy, dist], target: [dx, dy, 0], dist, dx, dy }
      },
    },
    meta: { cols, rows, rowsUsed, orientation: 'planar wall, products face +z' },
  }
}

// ── RING — products on a circle (tiers = stacked circles), viewed from outside or from the centre ─────────────────

export function ringGeometry (count, narrow) {
  const n = Math.max(0, Math.min(PER_PAGE_MAX, count | 0))
  const maxTier = narrow ? RING_MAX_PER_TIER_NARROW : RING_MAX_PER_TIER
  const tiers = Math.max(1, Math.ceil(n / maxTier))
  const perTier = Math.max(1, Math.ceil(n / tiers))
  const R = perTier <= 2 ? RING_RMIN : Math.max(RING_RMIN, SPACING / (2 * Math.sin(Math.PI / perTier)))   // chord between neighbours = SPACING
  return { n, tiers, perTier, R }
}

function buildRing (ctx) {
  const narrow = ctx.isPhone || ctx.aspect < 0.85
  const { n, tiers, perTier, R } = ringGeometry(ctx.count, narrow)
  const slots = []
  for (let i = 0; i < n; i++) {
    const t = Math.floor(i / perTier), k = i % perTier
    const a = ((k + (t % 2 ? 0.5 : 0)) / perTier) * TAU - Math.PI / 2   // item 0 on the left, running through the near arc (a = 0 is +z)
    const y = ((tiers - 1) / 2 - t) * SPACING + 0.15
    slots.push(slot(R * Math.sin(a), y, R * Math.cos(a), a + Math.PI))   // faces the centre
  }
  const yTop = ((tiers - 1) / 2) * SPACING + 0.15, yBot = -((tiers - 1) / 2) * SPACING + 0.15
  const furniture = [{ kind: 'floor', shape: 'disc', x: 0, y: yBot - 0.95, z: 0, ry: 0, r: R + 1.2, h: 0.06, mat: 'floor' }]
  for (let t = 0; t < tiers; t++) furniture.push({ kind: 'rail', x: 0, y: ((tiers - 1) / 2 - t) * SPACING + 0.15 - 0.5, z: 0, ry: 0, r: R / 0.93 })
  const pitch = 0.5
  const eye = 0.15
  return {
    slots, furniture,
    camera: {
      stops: null, modes: ['outside', 'inside'],
      pose: (view, st) => {
        if (st && st.mode === 'inside') return { pos: [0, eye, 0], target: [0, eye, -1], dist: 1, dx: 0, dy: 0, mode: 'inside' }
        const D = 2 * (R + 1.2)
        const w = D * 1.04, h = D * Math.sin(pitch) + (yTop - yBot) + 1.8
        const dist = capDist(fitDistance(w, h, view, 1.12, R * 0.5))
        const { dx, dy } = shiftFor(dist, view)
        const dyw = dy / Math.cos(pitch)
        const ty = eye + dyw
        return { pos: [dx, ty + dist * Math.sin(pitch), dist * Math.cos(pitch)], target: [dx, ty, 0], dist, dx, dy: dyw, mode: 'outside' }
      },
    },
    meta: { tiers, perTier, radius: R, orientation: 'products face the centre; the near arc shows their backs (double-sided discs read correctly)' },
  }
}

// ── AISLE — two facing shelf runs along z, floor strip between, camera travels along it ───────────────────────────

export function aisleGeometry (count, narrow) {
  const n = Math.max(0, Math.min(PER_PAGE_MAX, count | 0))
  const cap = narrow ? AISLE_BAY_CAP_NARROW : AISLE_BAY_CAP
  const colsMax = narrow ? 2 : 3
  const pairs = Math.max(1, Math.min(AISLE_MAX_PAIRS, Math.ceil(n / (2 * cap))))
  const bays = pairs * 2
  const perBay = Math.max(1, Math.min(cap, Math.ceil(n / bays)))
  const rowsB = Math.ceil(perBay / colsMax)
  const colsB = Math.ceil(perBay / rowsB)
  const bayLen = colsMax * SPACING + 0.8
  const halfW = narrow ? 2.4 : 3.0
  return { n, cap, colsMax, pairs, bays, perBay, rowsB, colsB, bayLen, halfW, length: pairs * bayLen }
}

function buildAisle (ctx) {
  const narrow = ctx.isPhone || ctx.aspect < 0.85
  const g = aisleGeometry(ctx.count, narrow)
  const { n, pairs, perBay, rowsB, colsB, bayLen, halfW, length } = g
  const TILT = 0.45                                    // products angle toward the entrance, so they read from the walkway
  const yRow = (r) => ((rowsB - 1) / 2 - r) * SPACING + 0.15
  const slots = []
  for (let i = 0; i < n; i++) {
    const b = Math.floor(i / perBay), j = i % perBay
    const side = b % 2, pair = b >> 1
    const row = Math.floor(j / colsB), col = j % colsB
    const zc = -(pair * bayLen + bayLen / 2)
    const z = zc - (col - (colsB - 1) / 2) * SPACING
    slots.push(slot(side ? halfW : -halfW, yRow(row), z, side ? -(Math.PI / 2 - TILT) : Math.PI / 2 - TILT))
  }
  const top = yRow(0) + 0.9
  const lowPlank = yRow(rowsB - 1) - 0.55
  const floorY = lowPlank - 0.5
  const wallH = top - floorY, wallY = (top + floorY) / 2
  const furniture = []
  ;[-1, 1].forEach(s => {
    furniture.push({ kind: 'wall', x: s * (halfW + 0.65), y: wallY, z: -length / 2, ry: s < 0 ? Math.PI / 2 : -Math.PI / 2, sx: length, sy: wallH })
    for (let r = 0; r < rowsB; r++) furniture.push({ kind: 'plank', x: s * (halfW + 0.25), y: yRow(r) - 0.55, z: -length / 2, ry: Math.PI / 2, sx: length })
    for (let q = 0; q <= pairs; q++) furniture.push({ kind: 'pillar', x: s * (halfW + 0.45), y: wallY, z: -q * bayLen, ry: 0, r: 0.07, h: wallH, mat: 'rim' })   // uprights BEHIND the product plane: they never hide a product
  })
  furniture.push({ kind: 'floor', shape: 'plane', x: 0, y: floorY, z: -length / 2 + 1.5, ry: 0, sx: 2 * halfW + 1.2, sz: length + 3, mat: 'floor' })
  furniture.push({ kind: 'wall', x: 0, y: wallY, z: -length - 0.05, ry: 0, sx: 2 * halfW + 1.3, sy: wallH })
  const pairZ = (p) => -(p * bayLen + bayLen / 2)
  const stopsMeta = [{ id: 'entrance', label: 'Entrance', slotRange: [0, n], p: 0, entrance: true }]
  for (let p = 0; p < pairs; p++) stopsMeta.push({ id: `bay-${p + 1}`, label: `Bay ${p + 1}/${pairs}`, slotRange: [Math.min(n, p * 2 * perBay), Math.min(n, (p + 1) * 2 * perBay)], p })
  const fw = 2 * halfW + 1.8, fh = rowsB * SPACING + 1.6
  const stopPose = (idx, view) => {
    const st = stopsMeta[clamp(idx | 0, 0, stopsMeta.length - 1)]
    const fitD = fitDistance(fw, fh, view)
    const dist = capDist(Math.max(narrow ? 0 : 7.5, fitD) + (st.entrance ? 2.5 : 0))
    const { dx, dy } = shiftFor(dist, view)
    const zT = pairZ(st.p) - (st.entrance ? 1.0 : 0)
    const yT = 0.15 + dy
    return { pos: [dx, yT + 0.45, zT + dist], target: [dx, yT, zT], dist, dx, dy, stop: stopsMeta.indexOf(st) }
  }
  const stops = stopsMeta.map((s, i) => { const p = stopPose(i, DEFAULT_VIEW); return { id: s.id, label: s.label, pos: p.pos, target: p.target, slotRange: s.slotRange } })
  return {
    slots, furniture,
    camera: { stops, modes: null, pose: (view, st) => stopPose(st && st.stop ? st.stop : 0, view), stopPose },
    meta: { ...g, tilt: TILT, floorY, orientation: 'products face the walkway, angled toward the entrance' },
  }
}

// ── ISLAND — a tiered display table (rows rise toward the back), products tilted up and toward the front ──────────

export function islandGeometry (count, narrow) {
  const n = Math.max(0, Math.min(PER_PAGE_MAX, count | 0))
  const colsMax = narrow ? 5 : 10
  const cols = clamp(Math.ceil(Math.sqrt(Math.max(1, n) * 1.5) - 1e-9), 3, colsMax)
  const rows = Math.max(1, Math.ceil(n / cols))
  return { n, cols, rows }
}

function buildIsland (ctx) {
  const narrow = ctx.isPhone || ctx.aspect < 0.85
  const { n, cols, rows } = islandGeometry(ctx.count, narrow)
  const STEP = 0.32, TILT = -0.55
  const yRow = (r) => 0.15 + r * STEP
  const slots = []
  for (let i = 0; i < n; i++) {
    const col = i % cols, row = Math.floor(i / cols)
    slots.push(slot((col - (cols - 1) / 2) * SPACING, yRow(row), ((rows - 1) / 2 - row) * SPACING, 0, TILT))
  }
  const w = cols * SPACING + 1.6, d = rows * SPACING + 1.6
  const slabTop = -0.2
  const furniture = [{ kind: 'table', shape: 'box', x: 0, y: slabTop - 0.15, z: 0, ry: 0, sx: w, sy: 0.3, sz: d }]
  for (let r = 0; r < rows; r++) {
    const topY = yRow(r) - 0.5
    const hgt = Math.max(0.05, topY - slabTop)
    furniture.push({ kind: 'table', shape: 'box', x: 0, y: slabTop + hgt / 2, z: ((rows - 1) / 2 - r) * SPACING, ry: 0, sx: w - 0.4, sy: hgt, sz: SPACING })
  }
  const plinthH = 1.5
  furniture.push({ kind: 'pillar', x: 0, y: slabTop - 0.3 - plinthH / 2, z: 0, ry: 0, r: Math.max(0.5, Math.min(w, d) * 0.18), h: plinthH, mat: 'rim' })
  furniture.push({ kind: 'floor', shape: 'disc', x: 0, y: slabTop - 0.3 - plinthH, z: 0, ry: 0, r: Math.max(w, d) * 0.8, h: 0.06, mat: 'floor' })
  const pitch = 0.6
  const riser = (rows - 1) * STEP
  return {
    slots, furniture,
    camera: {
      stops: null, modes: null,
      pose: (view) => {
        const h = d * Math.sin(pitch) + riser * Math.cos(pitch) + 1.8
        const dist = capDist(fitDistance(w * 1.02, h, view, 1.1, d * 0.3))
        const { dx, dy } = shiftFor(dist, view)
        const dyw = dy / Math.cos(pitch)
        const ty = riser / 2 + dyw
        return { pos: [dx, ty + dist * Math.sin(pitch), dist * Math.cos(pitch)], target: [dx, ty, 0], dist, dx, dy: dyw }
      },
    },
    meta: { cols, rows, step: STEP, tilt: TILT, orientation: 'tilted up and toward the front (+z); the back of a cube / double-sided disc reads the same' },
  }
}

// ── registry ────────────────────────────────────────────────────────────────────────────────────────────────────────

export const LAYOUTS = Object.freeze({
  shelf: { id: 'shelf', name: 'Shelf wall', short: 'Shelf', icon: '🗄️', description: 'Products in rows on one wall. The classic view.', build: buildShelf },
  ring: { id: 'ring', name: 'Ring', short: 'Ring', icon: '🎠', description: 'A carousel circle of products. See it from outside, or step inside.', build: buildRing },
  aisle: { id: 'aisle', name: 'Aisle', short: 'Aisle', icon: '🛒', description: 'A corridor with shelves on both sides. Walk along it, stop by stop.', build: buildAisle },
  island: { id: 'island', name: 'Island table', short: 'Island', icon: '🍽️', description: 'A tiered display table. Orbit around it.', build: buildIsland },
})

export const getLayout = (id) => LAYOUTS[normalizeId(id)]
export const listLayouts = () => LAYOUT_IDS.map(id => LAYOUTS[id])

/**
 * Build a layout (unknown id -> shelf). ctx = { count, perPage, aspect, isPhone, settings }; bad numbers are repaired.
 * The count is capped at PER_PAGE_MAX. Returns the layout's result plus { id, requestedId, truncated, bounds, perPageMax }.
 */
export function build (id, ctx = {}) {
  const lay = getLayout(id)
  const c = {
    count: clamp(finite(ctx.count) ? Math.floor(ctx.count) : 0, 0, PER_PAGE_MAX),
    perPage: clamp(finite(ctx.perPage) ? Math.round(ctx.perPage) : 24, 6, PER_PAGE_MAX),
    aspect: finite(ctx.aspect) && ctx.aspect > 0 ? ctx.aspect : 16 / 9,
    isPhone: !!ctx.isPhone,
    settings: ctx.settings ?? null,
  }
  const out = lay.build(c)
  out.id = lay.id
  out.requestedId = id
  out.truncated = (finite(ctx.count) ? Math.floor(ctx.count) : 0) > c.count
  out.perPageMax = PER_PAGE_MAX
  out.bounds = computeBounds(out.slots, out.furniture)
  out.bounds.ok = out.bounds.radius <= BOUNDS_MAX
  return out
}

/** Counts a developer wants to see: placements, furniture meshes, bounds. `discs` = how many placed products are discs (3 meshes each). */
export function layoutStats (spec, discs = 0) {
  const placements = spec.slots.length
  const slotMeshes = placements + 2 * Math.min(discs, placements)
  return { id: spec.id, placements, furnitureMeshes: spec.furniture.length, slotMeshes, totalMeshes: slotMeshes + spec.furniture.length, bounds: { radius: spec.bounds.radius, height: spec.bounds.height }, stops: spec.camera.stops ? spec.camera.stops.length : 0 }
}

/** Facing direction (unit vector) of a placement: Ry(ry) * Rx(rx) * (0,0,1). */
export function slotNormal (s) {
  const cx = Math.cos(s.rx || 0), sx = Math.sin(s.rx || 0)
  return [Math.sin(s.ry || 0) * cx, -sx, Math.cos(s.ry || 0) * cx]
}
