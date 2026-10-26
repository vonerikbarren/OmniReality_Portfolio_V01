/**
 * utils/OmniGridMath.js (V195) — pure maths of the MultiTimer-style grid organizer (ui/OmniGridLayout.js). No DOM, no storage.
 *
 * Units: components live in CELLS of a grid { cols, rows } (default 24 x 14). A component rect is { x, y, w, h } in cells, plus
 * z (stack order, bigger = on top; overlap is allowed) and hidden (removed from the layout but can be added back).
 * With snap ON every number is a whole cell; with snap OFF it is a free value rounded to 0.05 cell.
 *
 *   snapValue / roundCell        clampRect / moveRect / resizeRect (min size per component)
 *   bringToFront / sendToBack / raiseOne / lowerOne / normalizeZ   (z-order of a { id: z } map)
 *   rectsOverlap / topAt         (which component is on top at a point)
 *   serializeLayout / sanitizeLayout / parseLayout / defaultLayout  (versioned JSON, hostile-input safe)
 */

export const LAYOUT_VERSION = 1
export const DEFAULT_GRID = Object.freeze({ cols: 24, rows: 14 })
export const GRID_MIN = 4
export const GRID_MAX = 64
export const MAX_ITEMS = 128
export const MAX_JSON_CHARS = 200000
export const FREE_STEP = 0.05

const isNum = (v) => typeof v === 'number' && Number.isFinite(v)
export const clamp = (v, lo, hi) => (lo > hi ? lo : Math.min(hi, Math.max(lo, v)))
const num = (v, def) => { const n = typeof v === 'string' && v.trim() !== '' && v.length < 24 ? Number(v) : v; return isNum(n) ? n : def }
const safeKey = (k) => typeof k === 'string' && k.length > 0 && k.length <= 64 && k !== '__proto__' && k !== 'constructor' && k !== 'prototype'

/** Round to the free-placement step (0.05 cell), removing float noise. */
export const roundCell = (v) => Math.round(Math.round(v / FREE_STEP) * FREE_STEP * 1000) / 1000 + 0
/** Snap a cell value: whole cells when snapOn, else the free step. */
export const snapValue = (v, snapOn = true) => (snapOn ? Math.round(v) : roundCell(v))

export function sanitizeGrid (g) {
  const c = Math.round(num(g && g.cols, DEFAULT_GRID.cols)); const r = Math.round(num(g && g.rows, DEFAULT_GRID.rows))
  return { cols: clamp(c, GRID_MIN, GRID_MAX), rows: clamp(r, GRID_MIN, GRID_MAX) }
}
export function sanitizeMin (m) { return { w: clamp(num(m && m.w, 1), 0.5, GRID_MAX), h: clamp(num(m && m.h, 1), 0.5, GRID_MAX) } }

/** Keep a rect inside the grid and at least `min` big. Never returns NaN. */
export function clampRect (r, grid = DEFAULT_GRID, min = { w: 1, h: 1 }, snapOn = true) {
  const g = sanitizeGrid(grid); const m = sanitizeMin(min)
  let w = clamp(snapValue(num(r && r.w, m.w), snapOn), Math.min(m.w, g.cols), g.cols)
  let h = clamp(snapValue(num(r && r.h, m.h), snapOn), Math.min(m.h, g.rows), g.rows)
  const x = clamp(snapValue(num(r && r.x, 0), snapOn), 0, g.cols - w)
  const y = clamp(snapValue(num(r && r.y, 0), snapOn), 0, g.rows - h)
  w = +w.toFixed(3); h = +h.toFixed(3)
  return { x: +x.toFixed(3), y: +y.toFixed(3), w, h }
}
/** Move by (dx, dy) CELLS (fractional while dragging). */
export function moveRect (r, dx, dy, grid, min, snapOn = true) {
  return clampRect({ x: num(r.x, 0) + num(dx, 0), y: num(r.y, 0) + num(dy, 0), w: r.w, h: r.h }, grid, min, snapOn)
}
/** Resize from the bottom-right corner by (dw, dh) CELLS; the top-left stays. */
export function resizeRect (r, dw, dh, grid, min, snapOn = true) {
  const g = sanitizeGrid(grid)
  const w = clamp(num(r.w, 1) + num(dw, 0), 0, g.cols - clamp(num(r.x, 0), 0, g.cols))
  const h = clamp(num(r.h, 1) + num(dh, 0), 0, g.rows - clamp(num(r.y, 0), 0, g.rows))
  return clampRect({ x: r.x, y: r.y, w, h }, g, min, snapOn)
}
/** Pixels -> cells. */
export const pxToCells = (px, cellPx) => (isNum(px) && isNum(cellPx) && cellPx > 0 ? px / cellPx : 0)
/** CSS percentages of a rect in the grid. */
export function rectToPercent (r, grid = DEFAULT_GRID) {
  const g = sanitizeGrid(grid)
  return { left: (r.x / g.cols) * 100, top: (r.y / g.rows) * 100, width: (r.w / g.cols) * 100, height: (r.h / g.rows) * 100 }
}

// ── z-order (a plain { id: z } map; pure, returns a new map) ─────────────────────────────────────────────────────────
export const maxZ = (zs) => Object.values(zs || {}).reduce((m, z) => (isNum(z) && z > m ? z : m), 0)
export const minZ = (zs) => { const v = Object.values(zs || {}).filter(isNum); return v.length ? Math.min(...v) : 0 }
/** Renumber 1..n keeping the order (ties broken by id so the result is stable). */
export function normalizeZ (zs) {
  const ids = Object.keys(zs || {}).sort((a, b) => (num(zs[a], 0) - num(zs[b], 0)) || (a < b ? -1 : a > b ? 1 : 0))
  const out = {}; ids.forEach((id, i) => { out[id] = i + 1 }); return out
}
export function bringToFront (zs, id) { if (!(id in (zs || {}))) return normalizeZ(zs); const o = { ...zs, [id]: maxZ(zs) + 1 }; return normalizeZ(o) }
export function sendToBack (zs, id) { if (!(id in (zs || {}))) return normalizeZ(zs); const o = { ...zs, [id]: minZ(zs) - 1 }; return normalizeZ(o) }
function swapNeighbour (zs, id, dir) {
  const n = normalizeZ(zs); if (!(id in n)) return n
  const order = Object.keys(n).sort((a, b) => n[a] - n[b]); const i = order.indexOf(id); const j = i + dir
  if (j < 0 || j >= order.length) return n
  const o = { ...n, [id]: n[order[j]], [order[j]]: n[id] }; return o
}
export const raiseOne = (zs, id) => swapNeighbour(zs, id, 1)
export const lowerOne = (zs, id) => swapNeighbour(zs, id, -1)

export function rectsOverlap (a, b) { return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h }
/** Ids at a cell point, top first. items = { id: { x, y, w, h, z, hidden } } */
export function stackAt (items, cx, cy) {
  return Object.keys(items || {}).filter(id => { const r = items[id]; return !r.hidden && cx >= r.x && cx <= r.x + r.w && cy >= r.y && cy <= r.y + r.h }).sort((a, b) => num(items[b].z, 0) - num(items[a].z, 0))
}
export const topAt = (items, cx, cy) => stackAt(items, cx, cy)[0] ?? null

// ── layout state ─────────────────────────────────────────────────────────────────────────────────────────────────────
/**
 * specs: [{ id, x, y, w, h, z?, minW?, minH? }] — the defaults (and the only ids a stored layout may mention).
 * state: { v, cols, rows, snap, click:{sound,haptic}, items: { id: { x, y, w, h, z, hidden } } }
 */
export function specMin (spec) { return sanitizeMin({ w: spec && spec.minW, h: spec && spec.minH }) }

export function defaultLayout (specs, grid = DEFAULT_GRID, opts = {}) {
  const g = sanitizeGrid(grid); const items = Object.create(null); const zs = {}
  ;(Array.isArray(specs) ? specs : []).slice(0, MAX_ITEMS).forEach((s, i) => {
    if (!s || !safeKey(s.id)) return
    items[s.id] = { ...clampRect(s, g, specMin(s), true), z: 0, hidden: s.hidden === true }
    zs[s.id] = isNum(s.z) ? s.z + i / 1000 : 1 + i / 1000
  })
  const nz = normalizeZ(zs); for (const id of Object.keys(items)) items[id].z = nz[id]
  return { v: LAYOUT_VERSION, cols: g.cols, rows: g.rows, snap: opts.snap !== false, click: { sound: opts.clickSound === true, haptic: opts.clickHaptic !== false }, items: toPlain(items) }
}
function toPlain (o) { const out = {}; for (const k of Object.keys(o)) out[k] = o[k]; return out }

/** Make ANY input a valid layout for these specs. Unknown ids are dropped, missing ones take the default, numbers are clamped. */
export function sanitizeLayout (raw, specs, grid = DEFAULT_GRID, opts = {}) {
  const def = defaultLayout(specs, grid, opts)
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return def
  const g = sanitizeGrid(grid)
  const snap = typeof raw.snap === 'boolean' ? raw.snap : def.snap
  const ck = raw.click && typeof raw.click === 'object' ? raw.click : {}
  const click = { sound: typeof ck.sound === 'boolean' ? ck.sound : def.click.sound, haptic: typeof ck.haptic === 'boolean' ? ck.haptic : def.click.haptic }
  const src = raw.items && typeof raw.items === 'object' && !Array.isArray(raw.items) ? raw.items : {}
  const items = {}; const zs = {}
  for (const s of (Array.isArray(specs) ? specs : []).slice(0, MAX_ITEMS)) {
    if (!s || !safeKey(s.id)) continue
    const d = def.items[s.id]; const r = Object.prototype.hasOwnProperty.call(src, s.id) && src[s.id] && typeof src[s.id] === 'object' ? src[s.id] : null
    if (!r) { items[s.id] = { ...d }; zs[s.id] = d.z; continue }
    const rect = clampRect({ x: num(r.x, d.x), y: num(r.y, d.y), w: num(r.w, d.w), h: num(r.h, d.h) }, g, specMin(s), snap)
    items[s.id] = { ...rect, z: 0, hidden: typeof r.hidden === 'boolean' ? r.hidden : d.hidden }
    zs[s.id] = clamp(num(r.z, d.z), -1e6, 1e6)
  }
  const nz = normalizeZ(zs); for (const id of Object.keys(items)) items[id].z = nz[id]
  return { v: LAYOUT_VERSION, cols: g.cols, rows: g.rows, snap, click, items }
}
export function serializeLayout (state) {
  const s = state || {}; const items = {}
  for (const id of Object.keys(s.items || {})) { if (!safeKey(id)) continue; const r = s.items[id]; items[id] = { x: r.x, y: r.y, w: r.w, h: r.h, z: r.z, hidden: r.hidden === true } }
  return JSON.stringify({ v: LAYOUT_VERSION, cols: s.cols, rows: s.rows, snap: s.snap !== false, click: { sound: !!(s.click && s.click.sound), haptic: !(s.click && s.click.haptic === false) }, items })
}
/** String (or object) -> sanitized state. Bad JSON, a wrong version, an oversize string: the defaults. */
export function parseLayout (input, specs, grid = DEFAULT_GRID, opts = {}) {
  let raw = input
  if (typeof input === 'string') {
    if (input.length > MAX_JSON_CHARS) return defaultLayout(specs, grid, opts)
    try { raw = JSON.parse(input) } catch (_) { return defaultLayout(specs, grid, opts) }
  }
  if (raw && typeof raw === 'object' && raw.v !== LAYOUT_VERSION) return defaultLayout(specs, grid, opts)
  return sanitizeLayout(raw, specs, grid, opts)
}
export default { LAYOUT_VERSION, DEFAULT_GRID, snapValue, clampRect, moveRect, resizeRect, bringToFront, sendToBack, raiseOne, lowerOne, normalizeZ, serializeLayout, parseLayout, sanitizeLayout, defaultLayout }
