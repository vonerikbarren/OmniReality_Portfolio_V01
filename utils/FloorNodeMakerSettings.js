/**
 * utils/FloorNodeMakerSettings.js — the settings (and the blueprint) behind the floorPanelNode maker (V191).
 * User-facing: the panel is ui/FloorNodeMakerSettingsPanel.js (Admin slot 20). Never imports a Dev* module.
 *
 *   settings   persisted in localStorage 'omni:floornodemaker:settings' with a version stamp; every field is validated and clamped on load and on
 *              every set (hostile or old storage never throws, never gives an out-of-range value).
 *     gridN         mini grid size in the panel, 6..24 (default 12)
 *     cellSize      one panel = one floor cell; default = the floor's own grid unit (20)
 *     thickness     panel thickness, 0.02..2 (default 0.2)
 *     color/opacity default panel colour (#rrggbb) and opacity 0.1..1
 *     snap          snap placements to the floor grid (default on). Off = free placement, cells still use whole cell indexes but from the exact point
 *     overlay       scene grid overlay on the floor (default on while placing)
 *     maxPanels     total panels in the scene, 20..1000 (default 400)
 *     pieceId/rot/mirror   the piece currently picked
 *   blueprint  'omni:floornodemaker:blueprint:v1': the sections on the mini grid, each { pieceId, rot, mirror, gx, gz, cells:[{x,z,media?}] }
 *
 * Event: omni:floornodemaker-settings-changed { patch, settings }.
 */

import { isPieceId, sanitizeCells, normalizeCells, transformPiece, collisions, LIMITS as PL, placementCells } from './OmniFloorPieces.js'
import { sanitizeRef } from './FloorPanelMedia.js'

export const SETTINGS_KEY = 'omni:floornodemaker:settings'
export const BLUEPRINT_KEY = 'omni:floornodemaker:blueprint:v1'
export const STORE_VERSION = 1
export const CHANGED_EVENT = 'omni:floornodemaker-settings-changed'
/** The floor's grid unit (modules/OmniFloor.js: TILE_SIZE 100 / TILE_DIVISIONS 5) and level (FLOOR_Y); a test compares them with the module's own exports. */
export const FLOOR_GRID_UNIT = 20
export const FLOOR_LEVEL = -0.08
export const RANGES = {
  gridN: [6, 24], cellSize: [1, 200], thickness: [0.02, 2], opacity: [0.1, 1], maxPanels: [20, 1000],
}
export const MAX_SECTIONS = 60
export const DEFAULTS = Object.freeze({
  v: STORE_VERSION, gridN: 12, cellSize: FLOOR_GRID_UNIT, thickness: 0.2, color: '#7fd6ff', opacity: 0.9, snap: true, overlay: true, maxPanels: 400,
  pieceId: 'T', rot: 0, mirror: false,
})

const num = (v) => typeof v === 'number' && Number.isFinite(v)
const clamp = (v, lo, hi, d) => { const n = Number(v); return num(n) && v !== null && v !== '' && typeof v !== 'boolean' ? Math.min(hi, Math.max(lo, n)) : d }
const intIn = (v, [lo, hi], d) => Math.round(clamp(v, lo, hi, d))
const hex = (v, d) => (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v.toLowerCase() : d)

/** Validate a (possibly hostile / old) settings object into a complete, in-range one. */
export function sanitizeSettings (raw) {
  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  return {
    v: STORE_VERSION,
    gridN: intIn(r.gridN, RANGES.gridN, DEFAULTS.gridN),
    cellSize: Math.round(clamp(r.cellSize, ...RANGES.cellSize, DEFAULTS.cellSize) * 100) / 100,
    thickness: Math.round(clamp(r.thickness, ...RANGES.thickness, DEFAULTS.thickness) * 1000) / 1000,
    color: hex(r.color, DEFAULTS.color),
    opacity: Math.round(clamp(r.opacity, ...RANGES.opacity, DEFAULTS.opacity) * 100) / 100,
    snap: typeof r.snap === 'boolean' ? r.snap : DEFAULTS.snap,
    overlay: typeof r.overlay === 'boolean' ? r.overlay : DEFAULTS.overlay,
    maxPanels: intIn(r.maxPanels, RANGES.maxPanels, DEFAULTS.maxPanels),
    pieceId: isPieceId(r.pieceId) ? r.pieceId : DEFAULTS.pieceId,
    rot: ((Math.round(clamp(r.rot, -1000, 1000, 0)) % 4) + 4) % 4,
    mirror: typeof r.mirror === 'boolean' ? r.mirror : false,
  }
}

/** Migrations by stored version. v0 / missing = the shape before the stamp existed (none shipped), so it is only validated. */
export function migrateSettings (raw) {
  if (!raw || typeof raw !== 'object') return { ...DEFAULTS }
  const ver = typeof raw.v === 'number' ? raw.v : 0
  let r = { ...raw }
  if (ver < 1) r = { ...r }   // v0 -> v1: nothing to rename yet; the stamp is added by sanitizeSettings
  return sanitizeSettings(r)
}

let settings = null
const ls = () => { try { return globalThis.localStorage ?? null } catch (_) { return null } }

function load () {
  try { const raw = ls()?.getItem(SETTINGS_KEY); return raw ? migrateSettings(JSON.parse(raw)) : { ...DEFAULTS } } catch (_) { return { ...DEFAULTS } }
}
export function getSettings () { if (!settings) settings = load(); return { ...settings } }
export function setSettings (patch = {}) {
  const cur = getSettings()
  const known = {}
  if (patch && typeof patch === 'object') for (const k of Object.keys(DEFAULTS)) if (k !== 'v' && Object.prototype.hasOwnProperty.call(patch, k)) known[k] = patch[k]
  settings = sanitizeSettings({ ...cur, ...known })
  try { ls()?.setItem(SETTINGS_KEY, JSON.stringify(settings)) } catch (_) { /* blocked storage: the value still works for this session */ }
  try { window.dispatchEvent(new CustomEvent(CHANGED_EVENT, { detail: { patch: known, settings: { ...settings } } })) } catch (_) { /* no window */ }
  return { ...settings }
}
export function resetSettings () { settings = null; try { ls()?.removeItem(SETTINGS_KEY) } catch (_) {} ; return setSettings({}) }
/** Test helper: forget the cached copy (the next get reads storage again). */
export function _reloadSettings () { settings = null }

// ── Blueprint: the sections on the mini grid ─────────────────────────────────

/** Validate one section; null when junk. Cells carry an optional media reference. */
export function sanitizeSection (raw, gridN = 24) {
  if (!raw || typeof raw !== 'object') return null
  const pieceId = isPieceId(raw.pieceId) ? raw.pieceId : null
  if (!pieceId) return null
  const gx = Number(raw.gx); const gz = Number(raw.gz)
  if (!Number.isInteger(gx) || !Number.isInteger(gz) || gx < 0 || gz < 0 || gx > gridN || gz > gridN) return null
  if (!Array.isArray(raw.cells) || !raw.cells.length || raw.cells.length > PL.cellsPerPiece) return null
  const seen = new Set(); const cells = []
  for (const c of raw.cells) {
    if (!c || typeof c !== 'object' || !Number.isInteger(c.x) || !Number.isInteger(c.z) || Math.abs(c.x) > 64 || Math.abs(c.z) > 64) return null
    const k = c.x + ',' + c.z
    if (seen.has(k)) return null
    seen.add(k)
    const media = c.media ? sanitizeRef(c.media) : null
    cells.push({ x: c.x, z: c.z, ...(media ? { media } : {}) })
  }
  return { pieceId, rot: ((Math.round(+raw.rot || 0) % 4) + 4) % 4, mirror: !!raw.mirror, gx, gz, cells }
}

export function sanitizeBlueprint (raw, gridN = 24) {
  const list = Array.isArray(raw?.sections) ? raw.sections : []
  const out = []
  const occ = new Set()
  for (const s of list.slice(0, MAX_SECTIONS)) {
    const sec = sanitizeSection(s, gridN)
    if (!sec) continue
    const abs = placementCells(sec)
    if (abs.some(c => occ.has(c.gx + ',' + c.gz) || c.gx < 0 || c.gz < 0)) continue   // overlapping sections: the later one is dropped
    abs.forEach(c => occ.add(c.gx + ',' + c.gz))
    out.push(sec)
  }
  return { v: 1, sections: out }
}

let blueprint = null
export function getBlueprint () {
  if (!blueprint) { try { const raw = ls()?.getItem(BLUEPRINT_KEY); blueprint = sanitizeBlueprint(raw ? JSON.parse(raw) : null) } catch (_) { blueprint = { v: 1, sections: [] } } }
  return JSON.parse(JSON.stringify(blueprint))
}
export function setBlueprint (bp) {
  blueprint = sanitizeBlueprint(bp)
  try { ls()?.setItem(BLUEPRINT_KEY, JSON.stringify(blueprint)) } catch (_) {}
  try { window.dispatchEvent(new CustomEvent(CHANGED_EVENT, { detail: { patch: { blueprint: true }, settings: getSettings() } })) } catch (_) {}
  return getBlueprint()
}
export function _reloadBlueprint () { blueprint = null }

export const blueprintOccupied = (bp) => { const s = new Set(); bp.sections.forEach(sec => placementCells(sec).forEach(c => s.add(c.gx + ',' + c.gz))); return s }
export const blueprintCount = (bp) => bp.sections.reduce((n, s) => n + s.cells.length, 0)

/** Stamp a piece on the mini grid at (gx, gz): { ok, bp, error }. Never mutates `bp`. */
export function blueprintPlace (bp, gridN, pieceId, rot, mirror, gx, gz) {
  if (!isPieceId(pieceId)) return { ok: false, bp, error: 'Unknown piece.' }
  const cells = transformPiece(pieceId, rot, mirror)
  const abs = cells.map(([x, z]) => [x + gx, z + gz])
  if (abs.some(([x, z]) => x < 0 || z < 0 || x >= gridN || z >= gridN)) return { ok: false, bp, error: 'The piece does not fit inside the grid there.' }
  if (collisions(abs, blueprintOccupied(bp)).length) return { ok: false, bp, error: 'Those cells are already used.' }
  if (bp.sections.length >= MAX_SECTIONS) return { ok: false, bp, error: `At most ${MAX_SECTIONS} pieces in a blueprint.` }
  const sec = { pieceId, rot: ((rot % 4) + 4) % 4, mirror: !!mirror, gx, gz, cells: cells.map(([x, z]) => ({ x, z })) }
  return { ok: true, bp: { v: 1, sections: [...bp.sections, sec] } }
}

/** Remove the single panel at (gx, gz) from whichever section holds it. A section that loses its last panel disappears. */
export function blueprintRemoveCell (bp, gx, gz) {
  let changed = false
  const sections = []
  for (const s of bp.sections) {
    const left = s.cells.filter(c => !(s.gx + c.x === gx && s.gz + c.z === gz))
    if (left.length !== s.cells.length) { changed = true; if (left.length) sections.push({ ...s, cells: left }) } else sections.push(s)
  }
  return changed ? { ok: true, bp: { v: 1, sections } } : { ok: false, bp }
}

/** Set (media = ref) or clear (media = null) the media of the panel at (gx, gz). */
export function blueprintSetMedia (bp, gx, gz, media) {
  const ref = media ? sanitizeRef(media) : null
  if (media && !ref) return { ok: false, bp }
  let changed = false
  const sections = bp.sections.map(s => ({ ...s, cells: s.cells.map(c => {
    if (s.gx + c.x === gx && s.gz + c.z === gz) { changed = true; const { media: _m, ...rest } = c; return ref ? { ...rest, media: ref } : rest }
    return c
  }) }))
  return changed ? { ok: true, bp: { v: 1, sections } } : { ok: false, bp }
}

/**
 * The node specs that stamping this blueprint creates when its grid cell (0, 0) lands on world cell (originGx, originGz):
 * [{ pieceId, rot, mirror, gx, gz, cells }]. A section becomes one floorPanel node.
 */
export function blueprintStamp (bp, originGx = 0, originGz = 0) {
  return bp.sections.map(s => ({ pieceId: s.pieceId, rot: s.rot, mirror: s.mirror, gx: s.gx + originGx, gz: s.gz + originGz, cells: s.cells.map(c => ({ ...c })) }))
}

export { normalizeCells, sanitizeCells }
