/**
 * utils/TimeDataRulerSettings.js — the options behind the TimeData ruler (V192): names, defaults, validation, storage.
 * User-facing (Admin): no Dev* import, no DOM beyond localStorage / sessionStorage / window events.
 *
 *   baselineMs     null | epoch ms   null    the baseline (the ruler's 00:00:00). null = "automatic": local midnight of TODAY,
 *                                            recomputed every day (so the ruler resets by itself at midnight). A number is a
 *                                            fixed moment the person chose (whole seconds); 00:00:00 on the ruler IS that moment.
 *   weekMode       iso | monday | sunday   iso      week lines: ISO-8601 (Monday, ISO numbers) | Monday start | Sunday start
 *   showWeeks / showMonths / showYears / showDecades   true     which hierarchy lines are drawn
 *   minorDensity   off | 30 | 15 | 5     15      minor notches between the hour notches (fewer when they would be < 4 px apart)
 *   animate        true | false          true    moving marker every second + hour pulse (false: the marker steps once a minute, no pulse)
 *   rollover       follow | stop         follow  when the day passes 24:00: follow = the window moves on to the next day (baseline
 *                                                 unchanged, "Day +1"); stop = the window stays on the chosen day (full bar)
 *   zoom           day | week | month | year | decade   the scale last used
 *   lineColor / accentColor   '#rrggbb'  line colour (the hierarchy lightens it) / marker + baseline + decade colour
 *   pastOpacity    10..90 (%)            55      how strongly the consumed part is dimmed
 *   lineOpacity    30..100 (%)           85      opacity of all ruler lines
 *
 * Storage 'omni:timedata-ruler-v1' = { v: 1, ...changed keys }. Load is defensive: bad JSON / wrong types / unknown keys /
 * prototype keys / blocked storage all end at the defaults. Events: in `omni:timedata-ruler-set` { patch } | { reset:true };
 * out `omni:timedata-ruler-changed` { settings } after every accepted change.
 */

import { isValidTs, normalizeWeekMode, startOfDay } from './TimeRulerMath.js'
import { getSessionStart } from './OmniSessionClock.js'

export const STORE_KEY = 'omni:timedata-ruler-v1'
export const STORE_VERSION = 1
export const SET_EVENT = 'omni:timedata-ruler-set'
export const CHANGED_EVENT = 'omni:timedata-ruler-changed'
export const ZOOMS = Object.freeze(['day', 'week', 'month', 'year', 'decade'])
export const DENSITIES = Object.freeze(['off', '30', '15', '5'])
export const ROLLOVERS = Object.freeze(['follow', 'stop'])

export const DEFAULTS = Object.freeze({
  baselineMs: null,
  weekMode: 'iso',
  showWeeks: true, showMonths: true, showYears: true, showDecades: true,
  minorDensity: '15',
  animate: true,
  rollover: 'follow',
  zoom: 'day',
  lineColor: '#bcd2ff',
  accentColor: '#ffb347',
  pastOpacity: 55,
  lineOpacity: 85,
})
const KEYS = Object.keys(DEFAULTS)

export function normalizeColor (v, fallback) {
  if (typeof v !== 'string') return fallback
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v.trim()); if (!m) return fallback
  const h = m[1].toLowerCase()
  return '#' + (h.length === 3 ? h.split('').map(c => c + c).join('') : h)
}
const clampInt = (v, lo, hi, fb) => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : (typeof v === 'number' ? v : NaN)
  return Number.isFinite(n) ? Math.round(Math.min(hi, Math.max(lo, n))) : fb
}

/** One key validated; returns undefined when the value is unusable (the caller then keeps the old / default value). */
export function normalizeValue (key, v) {
  switch (key) {
    case 'baselineMs': {
      if (v === null) return null
      if (typeof v !== 'number' || !isValidTs(v)) return undefined
      return Math.floor(v / 1000) * 1000
    }
    case 'weekMode': return typeof v === 'string' && ['iso', 'monday', 'sunday'].includes(v) ? v : undefined
    case 'showWeeks': case 'showMonths': case 'showYears': case 'showDecades': case 'animate': return typeof v === 'boolean' ? v : undefined
    case 'minorDensity': { const s = typeof v === 'number' ? String(v) : v; return typeof s === 'string' && DENSITIES.includes(s) ? s : undefined }
    case 'rollover': return typeof v === 'string' && ROLLOVERS.includes(v) ? v : undefined
    case 'zoom': return typeof v === 'string' && ZOOMS.includes(v) ? v : undefined
    case 'lineColor': case 'accentColor': { const c = normalizeColor(v, null); return c ?? undefined }
    case 'pastOpacity': { const n = clampInt(v, 10, 90, NaN); return Number.isNaN(n) ? undefined : n }
    case 'lineOpacity': { const n = clampInt(v, 30, 100, NaN); return Number.isNaN(n) ? undefined : n }
    default: return undefined
  }
}

/** Defaults overlaid with every valid key of `raw` (an object); never throws, never mutates, never carries unknown / prototype keys. */
export function normalize (raw) {
  const out = { ...DEFAULTS }
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const k of KEYS) {
      if (!Object.prototype.hasOwnProperty.call(raw, k)) continue
      const v = normalizeValue(k, raw[k])
      if (v !== undefined) out[k] = v
    }
  }
  return out
}

/** Only the keys that differ from the defaults (what is stored). */
export function overrides (settings) {
  const s = normalize(settings), o = {}
  for (const k of KEYS) if (s[k] !== DEFAULTS[k]) o[k] = s[k]
  return o
}

export function loadSettings (store = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  try {
    const raw = store?.getItem?.(STORE_KEY); if (!raw) return normalize(null)
    const j = JSON.parse(raw)
    if (!j || typeof j !== 'object' || j.v !== STORE_VERSION) return normalize(null)
    return normalize(j)
  } catch (_) { return normalize(null) }
}
export function saveSettings (settings, store = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  try { store?.setItem?.(STORE_KEY, JSON.stringify({ v: STORE_VERSION, ...overrides(settings) })); return true } catch (_) { return false }
}

/** The baseline instant for these settings: the chosen moment, or local midnight of today (automatic). */
export function resolveBaseline (settings, nowMs = Date.now()) {
  const b = settings?.baselineMs
  if (typeof b === 'number' && isValidTs(b)) return b
  return startOfDay(nowMs)
}
/** 'custom' when a moment was chosen, else 'auto'. */
export function baselineMode (settings) { return typeof settings?.baselineMs === 'number' && isValidTs(settings.baselineMs) ? 'custom' : 'auto' }
/** The start of this browser session (kept in sessionStorage by utils/OmniSessionClock.js), floored to a whole second. */
export function sessionStartMs (now = Date.now(), store = (typeof sessionStorage !== 'undefined' ? sessionStorage : null)) {
  const t = getSessionStart(store, now)
  return Math.floor(t / 1000) * 1000
}

// ── shared live state (one per page) ─────────────────────────────────────────

let state = null
function ensure () { if (!state) state = loadSettings(); return state }
export function getSettings () { return { ...ensure() } }

/** Applies a validated patch ({key:value}); unknown keys / bad values are ignored. Returns { settings, applied:[keys], rejected:[keys] }. */
export function updateSettings (patch, { save = true, emit = true } = {}) {
  const cur = ensure(), next = { ...cur }, applied = [], rejected = []
  if (patch && typeof patch === 'object') {
    for (const k of Object.keys(patch)) {
      if (!KEYS.includes(k)) { rejected.push(k); continue }
      const v = normalizeValue(k, patch[k])
      if (v === undefined) { rejected.push(k); continue }
      if (next[k] !== v) next[k] = v
      applied.push(k)
    }
  }
  const changed = KEYS.some(k => next[k] !== cur[k])
  state = next
  if (changed) {
    if (save) saveSettings(next)
    if (emit) announce()
  }
  return { settings: { ...state }, applied, rejected, changed }
}
export function resetSettings () {
  state = normalize(null)
  saveSettings(state)
  announce()
  return { ...state }
}
function announce () {
  try { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(CHANGED_EVENT, { detail: { settings: { ...state } } })) } catch (_) {}
}
/** Test hook: forget the cached state so the next read loads storage again. */
export function _forget () { state = null }
export { normalizeWeekMode }
