/**
 * utils/OmniStateStrictAlignSettings.js — the options behind OmniState_StrictAlign (V191): names, defaults, validation, storage.
 * User-facing (Admin > UI Settings block): no Dev* import, no DOM beyond localStorage / window events.
 *
 *   step            0.001..100   0.1    the nudge / typing / drag-snap step (world units)
 *   shiftStep       0.001..1000  1      the step while Shift is held
 *   showAxisLine    true | false true   draw the axis line + arrow through the node
 *   closeAfterEnter true | false false  leave the mode after an exact value is typed and Enter is pressed
 *   snapDrag        true | false true   a mouse drag along the axis snaps to the step (off = free, still exact once you type)
 *
 * Storage 'omni:strictalign-v1' = { v: 1, ...only the keys the person changed }. Load is defensive (bad JSON / wrong types / unknown
 * keys / prototype keys / blocked storage -> defaults; numbers are clamped and rounded to 6 decimals).
 *
 * Events: in   `omni:strictalign-set`      { patch: {...keys} } | { reset: true }
 *         out  `omni:strictalign-changed`  { kind: 'settings', settings }  after every accepted settings change (and once at init)
 *                                          { kind: 'state', active, axis, ids, settings }  whenever the mode is entered / left / re-aimed
 */

export const STORE_KEY = 'omni:strictalign-v1'
export const STORE_VERSION = 1
export const SET_EVENT = 'omni:strictalign-set'
export const CHANGED_EVENT = 'omni:strictalign-changed'
export const STATE_NAME = 'OmniState_StrictAlign'

export const STEP_MIN = 0.001, STEP_MAX = 100
export const SHIFT_STEP_MIN = 0.001, SHIFT_STEP_MAX = 1000

export const DEFAULTS = Object.freeze({ step: 0.1, shiftStep: 1, showAxisLine: true, closeAfterEnter: false, snapDrag: true })
export const KEYS = Object.keys(DEFAULTS)

const toBool = (v) => (typeof v === 'boolean' ? v : (v === 1 || v === 0) ? v === 1 : (v === 'true' || v === 'false') ? v === 'true' : undefined)
const toNum = (v, lo, hi) => {
  if (typeof v === 'boolean' || v === null || v === '' || (typeof v !== 'number' && typeof v !== 'string')) return undefined
  const n = Number(v)
  if (!Number.isFinite(n)) return undefined
  return Math.round(Math.min(hi, Math.max(lo, n)) * 1e6) / 1e6
}

export function cleanValue (key, v) {
  switch (key) {
    case 'step': return toNum(v, STEP_MIN, STEP_MAX)
    case 'shiftStep': return toNum(v, SHIFT_STEP_MIN, SHIFT_STEP_MAX)
    case 'showAxisLine': case 'closeAfterEnter': case 'snapDrag': return toBool(v)
    default: return undefined
  }
}

export function sanitizePatch (patch) {
  const out = {}
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return out
  for (const k of KEYS) {
    if (!Object.prototype.hasOwnProperty.call(patch, k)) continue
    const c = cleanValue(k, patch[k]); if (c !== undefined) out[k] = c
  }
  return out
}

export function parseOverrides (text) {
  if (typeof text !== 'string' || !text) return {}
  try { return sanitizePatch(JSON.parse(text)) } catch (_) { return {} }
}
export function loadOverrides () {
  try { return parseOverrides(localStorage.getItem(STORE_KEY)) } catch (_) { return {} }
}
export function saveOverrides (o) {
  try {
    const clean = sanitizePatch(o)
    if (!Object.keys(clean).length) localStorage.removeItem(STORE_KEY)
    else localStorage.setItem(STORE_KEY, JSON.stringify({ v: STORE_VERSION, ...clean }))
    return true
  } catch (_) { return false }
}
export const resolveSettings = (overrides = {}) => ({ ...DEFAULTS, ...sanitizePatch(overrides) })

/** Pure: apply one event detail to an overrides object -> { overrides, changed }. */
export function applyChange (overrides, detail) {
  const cur = sanitizePatch(overrides)
  if (detail?.reset === true) return { overrides: {}, changed: Object.keys(cur).length > 0 }
  const next = { ...cur, ...sanitizePatch(detail?.patch) }
  return { overrides: next, changed: JSON.stringify(next) !== JSON.stringify(cur) }
}
