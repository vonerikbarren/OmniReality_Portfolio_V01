/**
 * utils/OmniDockRealitiesSettings.js — the options behind the OmniDock_Realities strip (V191): names, defaults, validation, storage.
 * User-facing: no Dev* import, no DOM beyond localStorage / matchMedia / window events.
 *
 *   show        true | false            true   draw the strip at all
 *   size        60..160 (integer %)     100    global icon size. S = 75, M = 100, L = 130 are presets of the same number
 *   opacity     20..100 (integer %)     90     global icon opacity
 *   hideEmpty   true | false            false  hide the geometries that have 0 nodes
 *   edge        'bottom'|'top'|'left'|'right'|'panel'  bottom  (V211) where the dock sits; 'panel' floats and can be dragged (px, py = its top-left, 0..5000). Hidden = show:false
 *   geo         { <GeometryId>: { color: '#rrggbb', opacity: 20..100 } }   per-geometry colour + opacity (only what the person changed)
 *
 * Storage 'omni:dock-realities-v1' = { v: 1, ...changed keys }. Load is defensive: bad JSON / wrong types / unknown keys /
 * unknown geometry ids / prototype keys / blocked storage all end at the defaults; numbers are clamped, colours are normalised
 * ('#abc' -> '#aabbcc'; anything else is rejected). Resolved settings always have a colour + opacity for EVERY main geometry.
 *
 * Icon pixel size (responsive): iconPx(vw, size) = clamp(28px, 4.2vw, 52px) * size / 100, kept inside 22..72 px.
 *
 * Events: in   `omni:dock-realities-set`      { patch:{show,size,opacity,hideEmpty} } | { geo:{id,color?,opacity?} } | { resetGeo:id } | { reset:true }
 *         out  `omni:dock-realities-changed`  { settings }  after every accepted change (and once at init)
 */

import { GEOMETRY_IDS, isGeometryId } from './OmniGeometryCensus.js'

export const STORE_KEY = 'omni:dock-realities-v1'
export const STORE_VERSION = 1
export const SET_EVENT = 'omni:dock-realities-set'
export const CHANGED_EVENT = 'omni:dock-realities-changed'
export const OPEN_SETTINGS_EVENT = 'omni:dock-realities-open-settings'

export const SIZE_MIN = 60, SIZE_MAX = 160
export const OPACITY_MIN = 20, OPACITY_MAX = 100
export const SIZE_PRESETS = Object.freeze({ S: 75, M: 100, L: 130 })
export const ICON_MIN_PX = 22, ICON_MAX_PX = 72

export const EDGES = Object.freeze(['bottom', 'top', 'left', 'right', 'panel'])   // V211: where the dock sits ('panel' = a floating, draggable panel); hidden = show:false
export const PANEL_POS_MAX = 5000
export const DEFAULTS = Object.freeze({ show: true, size: 100, opacity: 90, hideEmpty: false, edge: 'bottom', px: 80, py: 140 })
export const DEFAULT_GEO_OPACITY = 100
export const DEFAULT_COLOR = '#d8e6ff'
const KEYS = Object.keys(DEFAULTS)

/** A readable, distinct default colour per geometry (spread round the hue wheel). */
export function defaultColorFor (id) {
  const i = Math.max(0, GEOMETRY_IDS.indexOf(id)), h = Math.round((i * 360) / GEOMETRY_IDS.length)
  return hslToHex(h, 70, 78)
}
function hslToHex (h, s, l) {
  s /= 100; l /= 100
  const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l)
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  const x = (v) => Math.round(v * 255).toString(16).padStart(2, '0')
  return `#${x(f(0))}${x(f(8))}${x(f(4))}`
}

const toBool = (v) => (typeof v === 'boolean' ? v : (v === 1 || v === 0) ? v === 1 : (v === 'true' || v === 'false') ? v === 'true' : undefined)
const toInt = (v, lo, hi) => {
  if (typeof v === 'boolean' || v === null || v === '' || (typeof v !== 'number' && typeof v !== 'string')) return undefined
  const n = Number(v)
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : undefined
}

/** '#rgb' | '#rrggbb' (any case) -> '#rrggbb', else undefined. */
export function cleanColor (v) {
  if (typeof v !== 'string') return undefined
  const s = v.trim().toLowerCase()
  let m = /^#([0-9a-f]{3})$/.exec(s)
  if (m) return '#' + [...m[1]].map(c => c + c).join('')
  m = /^#([0-9a-f]{6})$/.exec(s)
  return m ? '#' + m[1] : undefined
}

export function cleanValue (key, v) {
  switch (key) {
    case 'show': case 'hideEmpty': return toBool(v)
    case 'edge': return typeof v === 'string' && EDGES.includes(v) ? v : undefined
    case 'px': case 'py': return toInt(v, 0, PANEL_POS_MAX)
    case 'size': return toInt(v, SIZE_MIN, SIZE_MAX)
    case 'opacity': return toInt(v, OPACITY_MIN, OPACITY_MAX)
    default: return undefined
  }
}

/** One per-geometry entry -> { color?, opacity? } (only valid parts) or null. */
export function cleanGeoEntry (e) {
  if (!e || typeof e !== 'object' || Array.isArray(e)) return null
  const out = {}
  const c = Object.prototype.hasOwnProperty.call(e, 'color') ? cleanColor(e.color) : undefined
  const o = Object.prototype.hasOwnProperty.call(e, 'opacity') ? toInt(e.opacity, OPACITY_MIN, OPACITY_MAX) : undefined
  if (c !== undefined) out.color = c
  if (o !== undefined) out.opacity = o
  return Object.keys(out).length ? out : null
}

/** Overrides = { show?, size?, opacity?, hideEmpty?, geo?: {id: {color?, opacity?}} } -> only the valid parts. */
export function sanitizeOverrides (raw) {
  const out = {}
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out
  for (const k of KEYS) {
    if (!Object.prototype.hasOwnProperty.call(raw, k)) continue
    const c = cleanValue(k, raw[k]); if (c !== undefined) out[k] = c
  }
  const g = Object.prototype.hasOwnProperty.call(raw, 'geo') ? raw.geo : null
  if (g && typeof g === 'object' && !Array.isArray(g)) {
    const geo = {}
    for (const id of GEOMETRY_IDS) {
      if (!Object.prototype.hasOwnProperty.call(g, id)) continue
      const e = cleanGeoEntry(g[id]); if (e) geo[id] = e
    }
    if (Object.keys(geo).length) out.geo = geo
  }
  return out
}

export function parseOverrides (text) {
  if (typeof text !== 'string' || !text) return {}
  try { return sanitizeOverrides(JSON.parse(text)) } catch (_) { return {} }
}
export function loadOverrides () {
  try { return parseOverrides(localStorage.getItem(STORE_KEY)) } catch (_) { return {} }
}
export function saveOverrides (o) {
  try {
    const clean = sanitizeOverrides(o)
    if (!Object.keys(clean).length) localStorage.removeItem(STORE_KEY)
    else localStorage.setItem(STORE_KEY, JSON.stringify({ v: STORE_VERSION, ...clean }))
    return true
  } catch (_) { return false }
}

/** defaults + overrides -> { show, size, opacity, hideEmpty, geo: { <every main id>: { color, opacity } } }. */
export function resolveSettings (overrides = {}) {
  const o = sanitizeOverrides(overrides)
  const geo = {}
  for (const id of GEOMETRY_IDS) geo[id] = { color: o.geo?.[id]?.color ?? defaultColorFor(id), opacity: o.geo?.[id]?.opacity ?? DEFAULT_GEO_OPACITY }
  return { show: o.show ?? DEFAULTS.show, size: o.size ?? DEFAULTS.size, opacity: o.opacity ?? DEFAULTS.opacity, hideEmpty: o.hideEmpty ?? DEFAULTS.hideEmpty, edge: o.edge ?? DEFAULTS.edge, px: o.px ?? DEFAULTS.px, py: o.py ?? DEFAULTS.py, geo }
}

/**
 * Apply one change (an event detail) to an overrides object; returns { overrides, changed }. Pure: the input is not mutated.
 * detail = { patch } | { geo: {id, color?, opacity?} } | { resetGeo: id } | { reset: true }
 */
export function applyChange (overrides, detail) {
  const cur = sanitizeOverrides(overrides)
  if (detail?.reset === true) return { overrides: {}, changed: Object.keys(cur).length > 0 }
  const next = { ...cur, geo: { ...(cur.geo ?? {}) } }
  if (detail?.patch && typeof detail.patch === 'object') {
    for (const k of KEYS) {
      if (!Object.prototype.hasOwnProperty.call(detail.patch, k)) continue
      const c = cleanValue(k, detail.patch[k]); if (c !== undefined) next[k] = c
    }
  }
  const g = detail?.geo
  if (g && typeof g === 'object' && isGeometryId(g.id)) {
    const e = cleanGeoEntry(g)
    if (e) next.geo[g.id] = { ...(next.geo[g.id] ?? {}), ...e }
  }
  if (isGeometryId(detail?.resetGeo)) delete next.geo[detail.resetGeo]
  if (!Object.keys(next.geo).length) delete next.geo
  const clean = sanitizeOverrides(next)
  return { overrides: clean, changed: JSON.stringify(clean) !== JSON.stringify(cur) }
}

/** Nearest preset letter for a size value ('S' | 'M' | 'L'), or '' when the value is not within 4 of a preset. */
export function presetFor (size) {
  for (const [k, v] of Object.entries(SIZE_PRESETS)) if (Math.abs(Number(size) - v) <= 4) return k
  return ''
}

/** Responsive icon size in px: clamp(28px, 4.2vw, 52px) scaled by the size setting, kept in 22..72. */
export function iconPx (vw, size = DEFAULTS.size) {
  const base = Math.min(52, Math.max(28, (Number(vw) || 1280) * 0.042))
  const k = Math.min(SIZE_MAX, Math.max(SIZE_MIN, Number(size) || DEFAULTS.size)) / 100
  return Math.round(Math.min(ICON_MAX_PX, Math.max(ICON_MIN_PX, base * k)))
}

export function prefersReducedMotion () {
  try { return !!(typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) } catch (_) { return false }
}

// ── the "realities in this shape" panel (ui/OmniRealitiesInShape.js) ─────────
export const IN_SHAPE_OPEN_EVENT = 'omni:realities-in-shape-open'         // in:  { geometry }  (a second request for the open shape closes the panel)
export const IN_SHAPE_CHANGED_EVENT = 'omni:realities-in-shape-changed'   // out: { geometry | null }
