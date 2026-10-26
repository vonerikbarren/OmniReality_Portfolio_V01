/**
 * utils/OmniReticleSettings.js — the options behind the centre HUD reticle (V190): names, defaults, validation, storage.
 * No DOM beyond localStorage / matchMedia, and no import of any Dev* module (user-facing: ui/OmniReticle.js and the
 * Admin > UI Settings section both read it).
 *
 *   key      values                      default   meaning
 *   show     true | false                true      draw the reticle at all
 *   opacity  5..100 (integer %)          15        overall opacity of the whole drawing (the owner's ".15")
 *
 * Storage 'omni:reticle-v1' = { v: 1, ...only the keys the person actually changed }. Anything missing falls back to the
 * default. Load is defensive like utils/OmniUserCompassSettings.js: bad JSON / wrong types / unknown keys / prototype keys /
 * blocked storage all end at the defaults; booleans accept "true"/"false"/1/0; opacity is rounded and clamped, and
 * true / "" / null / arrays are rejected (never coerced to 0 or 1). An unversioned (v0) blob is migrated: the old names
 * (visible / enabled / on -> show) and an opacity given as a 0..1 fraction -> percent. A v1 opacity is always a percent.
 *
 * Events: in   `omni:reticle-set`      { patch: {show?, opacity?} } | { reset: true }   (validated; unknown keys / bad values ignored)
 *         out  `omni:reticle-changed`  { settings }   after every accepted change, and once at init
 */

export const STORE_KEY = 'omni:reticle-v1'
export const STORE_VERSION = 1
export const SET_EVENT = 'omni:reticle-set'
export const CHANGED_EVENT = 'omni:reticle-changed'
export const OPACITY_MIN = 5
export const OPACITY_MAX = 100

export const DEFAULTS = Object.freeze({ show: true, opacity: 15 })
export const KEYS = Object.keys(DEFAULTS)

export function prefersReducedMotion () {
  try { return !!(typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) } catch (_) { return false }
}

const toBool = (v) => (typeof v === 'boolean' ? v : (v === 1 || v === 0) ? v === 1 : (v === 'true' || v === 'false') ? v === 'true' : undefined)

/** Validate ONE key; returns the clean value or undefined (= reject). */
export function cleanValue (key, v) {
  switch (key) {
    case 'show': return toBool(v)
    case 'opacity': {
      if (typeof v === 'boolean' || v === null || v === '' || (typeof v !== 'number' && typeof v !== 'string')) return undefined
      const n = Number(v)
      return Number.isFinite(n) ? Math.min(OPACITY_MAX, Math.max(OPACITY_MIN, Math.round(n))) : undefined
    }
    default: return undefined
  }
}

/** A patch (from an event or the UI) -> only its valid known keys. Never throws, never returns inherited keys. */
export function sanitizePatch (patch) {
  const out = {}
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return out
  for (const k of KEYS) {
    if (!Object.prototype.hasOwnProperty.call(patch, k)) continue
    const c = cleanValue(k, patch[k])
    if (c !== undefined) out[k] = c
  }
  return out
}

/** v0 (unversioned) -> v1: old names + opacity as a 0..1 fraction. */
export function migrate (raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const v = Number(raw.v)
  if (Number.isFinite(v) && v >= 1) return raw
  const o = { ...raw }
  for (const old of ['visible', 'enabled', 'on']) if (!('show' in o) && old in o) o.show = o[old]
  if (typeof o.opacity === 'number' && o.opacity > 0 && o.opacity <= 1) o.opacity = o.opacity * 100
  return o
}

export function parseOverrides (text) {
  if (typeof text !== 'string' || !text) return {}
  let raw
  try { raw = JSON.parse(text) } catch (_) { return {} }
  return sanitizePatch(migrate(raw))
}

export function loadOverrides () {
  try { return parseOverrides(localStorage.getItem(STORE_KEY)) } catch (_) { return {} }
}
export function saveOverrides (overrides) {
  try {
    const clean = sanitizePatch(overrides)
    if (!Object.keys(clean).length) localStorage.removeItem(STORE_KEY)
    else localStorage.setItem(STORE_KEY, JSON.stringify({ v: STORE_VERSION, ...clean }))
    return true
  } catch (_) { return false }
}

/** defaults + overrides -> the full settings object. */
export function resolveSettings (overrides = {}) {
  return { ...DEFAULTS, ...sanitizePatch(overrides) }
}
