/**
 * utils/OmniUserCompassSettings.js — the options behind the userCompass (V188): names, defaults, validation, storage.
 * No DOM beyond localStorage / matchMedia, and no import of any Dev* module (it is user-facing: ui/OmniUserCompass.js and the
 * Admin > UI Settings section both read it).
 *
 *   key      values                              default   meaning
 *   show     true | false                        true      draw the compass at all
 *   align    'left' | 'center' | 'right'         center    where the sphere sits inside its slot (slot = the hand's column width)
 *   size     'small' 32 | 'medium' 44 | 'large' 56   medium   sphere diameter in px; always shrunk to fit the slot (min 24, else hidden)
 *   spin     'off' | 'slow' 28s | 'normal' 14s | 'fast' 7s   normal*  seconds per revolution ('spin' mode only)
 *   mode     'spin' | 'heading'                  spin      heading = the globe turns with the camera's yaw (a real compass)
 *   color    'white' | 'cyan' | 'accent'         white     line colour (accent = the theme's --omni-theme-accent)
 *   opacity  30..100 (integer %)                 85        line opacity
 *   (*) with prefers-reduced-motion: reduce the DEFAULT spin is 'off' (a still, tilted globe); an explicit choice always wins.
 *
 * Storage 'omni:user-compass-v1' = { v: 1, ...only the keys the person actually changed }. Anything missing falls back to
 * the default (so the reduced-motion default and any future default change still apply to people who never touched it).
 * Load is defensive: bad JSON / wrong types / unknown keys / prototype keys / blocked storage all end at the defaults,
 * enums are matched exactly (after trim + lowercase), opacity is clamped, an unversioned (v0) blob with the old key names
 * (visible, alignment, opacity as 0..1) is migrated.
 *
 * Events: in   `omni:user-compass-set`      { patch: {...keys} } | { reset: true }   (validated; unknown keys / bad values ignored)
 *         out  `omni:user-compass-changed`  { settings }   after every accepted change, and once at init
 */

export const STORE_KEY = 'omni:user-compass-v1'
export const STORE_VERSION = 1
export const SET_EVENT = 'omni:user-compass-set'
export const CHANGED_EVENT = 'omni:user-compass-changed'
export const OPEN_ADMIN_EVENT = 'omni:admin-open'      // { section: 'uisettings', focus: 'usercompass' } — handled by ui/AdminPanel.js

export const ALIGNS = ['left', 'center', 'right']
export const SIZES = { small: 32, medium: 44, large: 56 }
export const SPINS = { off: 0, slow: 28, normal: 14, fast: 7 }          // seconds per revolution (0 = still)
export const MODES = ['spin', 'heading']
export const COLORS = { white: [255, 255, 255], cyan: [140, 240, 255], accent: null }   // accent: read from --omni-theme-accent at draw time
export const OPACITY_MIN = 30
export const OPACITY_MAX = 100

export const DEFAULTS = Object.freeze({ show: true, align: 'center', size: 'medium', spin: 'normal', mode: 'spin', color: 'white', opacity: 85 })
export const KEYS = Object.keys(DEFAULTS)

export function prefersReducedMotion () {
  try { return !!(typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) } catch (_) { return false }
}

/** The defaults for this person right now (reduced motion -> spin 'off'). */
export function getDefaults ({ reducedMotion = prefersReducedMotion() } = {}) {
  return { ...DEFAULTS, spin: reducedMotion ? 'off' : DEFAULTS.spin }
}

const oneOf = (v, list) => { const s = typeof v === 'string' ? v.trim().toLowerCase() : ''; return list.includes(s) ? s : undefined }
const toBool = (v) => (typeof v === 'boolean' ? v : (v === 1 || v === 0) ? v === 1 : (v === 'true' || v === 'false') ? v === 'true' : undefined)

/** Validate ONE key; returns the clean value or undefined (= reject). */
export function cleanValue (key, v) {
  switch (key) {
    case 'show':    return toBool(v)
    case 'align':   return oneOf(v, ALIGNS)
    case 'size':    return oneOf(v, Object.keys(SIZES))
    case 'spin':    return oneOf(v, Object.keys(SPINS))
    case 'mode':    return oneOf(v, MODES)
    case 'color':   return oneOf(v, Object.keys(COLORS))
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
  if (!('show' in o) && 'visible' in o) o.show = o.visible
  if (!('align' in o) && 'alignment' in o) o.align = o.alignment
  if (typeof o.opacity === 'number' && o.opacity > 0 && o.opacity <= 1) o.opacity = o.opacity * 100
  return o
}

/** Parse the stored JSON text into a clean overrides object (only valid keys). */
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
export function resolveSettings (overrides = {}, opts) {
  return { ...getDefaults(opts), ...sanitizePatch(overrides) }
}
