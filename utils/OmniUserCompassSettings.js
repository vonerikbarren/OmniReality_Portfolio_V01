/**
 * utils/OmniUserCompassSettings.js — the options behind the userCompass (V188; V190: its own draggable panel): names, defaults, validation, storage.
 * No DOM beyond localStorage / matchMedia, and no import of any Dev* module (it is user-facing: ui/OmniUserCompass.js and the
 * Admin > UI Settings section both read it).
 *
 *   key      values                              default   meaning
 *   show     true | false                        true      draw the compass at all
 *   size     'small' 32 | 'medium' 44 | 'large' 56   medium   sphere diameter in px (V190: no longer shrunk to a slot; only to the viewport)
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
 * (visible, opacity as 0..1) is migrated.
 *
 * V190: the old `align` option (left / centre / right inside the logo slot) is gone: the compass is a panel of its own and sits
 * wherever it is dragged. An `align` key in an old stored blob (or in a patch) is simply ignored and dropped on the next save.
 *
 * POSITION (V190) — storage 'omni:user-compass-pos-v1' = { v: 1, x, y } (the panel's top-left in css px; absent = the default spot).
 * It is validated on load (finite numbers, rounded, 0..20000) and CLAMPED at use time into the viewport (clampCompassPos), so a
 * saved spot from a bigger window can never strand the panel off-screen or under the bar / ribbon / dock; the clamp does not
 * overwrite the saved value (a later bigger window gets the person's original spot back). defaultCompassPos() is the free spot used
 * until the person drags it. Both are pure.
 *
 * Events: in   `omni:user-compass-set`      { patch: {...keys} } | { reset: true }  (settings AND position) | { resetPos: true } | { pos: {x,y} }
 *         out  `omni:user-compass-changed`  { settings, pos }   after every accepted change, and once at init  (pos: {x,y,custom})
 */

export const STORE_KEY = 'omni:user-compass-v1'
export const STORE_VERSION = 1
export const SET_EVENT = 'omni:user-compass-set'
export const CHANGED_EVENT = 'omni:user-compass-changed'
export const OPEN_ADMIN_EVENT = 'omni:admin-open'      // { section: 'uisettings', focus: 'usercompass' } — handled by ui/AdminPanel.js

export const SIZES = { small: 32, medium: 44, large: 56 }
export const SPINS = { off: 0, slow: 28, normal: 14, fast: 7 }          // seconds per revolution (0 = still)
export const MODES = ['spin', 'heading']
export const COLORS = { white: [255, 255, 255], cyan: [140, 240, 255], accent: null }   // accent: read from --omni-theme-accent at draw time
export const OPACITY_MIN = 30
export const OPACITY_MAX = 100

export const DEFAULTS = Object.freeze({ show: true, size: 'medium', spin: 'normal', mode: 'spin', color: 'white', opacity: 85 })
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

// ── Position (V190): the compass is a small floating panel the person can drag ─────────────────────────────────────────────

export const POS_KEY = 'omni:user-compass-pos-v1'
export const POS_VERSION = 1
export const POS_MAX = 20000
export const PAD = 5                       // css px between the panel edge and the sphere
export const DOCK_H = 52                   // the bottom dock (utils/OmniLayout has no constant for it; ui/Dock.js is 52)
export const EDGE = 8                      // default distance from a screen edge

/** The panel's side length for a sphere diameter (square). */
export const boxFor = (d) => Math.round(Number(d) || 0) + 2 * PAD

/** { x, y } -> a clean { x, y } (rounded finite numbers inside 0..POS_MAX) or null. Never throws; no inherited keys. */
export function sanitizePos (p) {
  if (!p || typeof p !== 'object' || Array.isArray(p)) return null
  const has = (k) => Object.prototype.hasOwnProperty.call(p, k)
  if (!has('x') || !has('y')) return null
  const ok = (v) => (typeof v === 'number' || (typeof v === 'string' && v.trim() !== '')) && Number.isFinite(Number(v))
  if (!ok(p.x) || !ok(p.y)) return null
  const c = (v) => Math.min(POS_MAX, Math.max(0, Math.round(Number(v))))
  return { x: c(p.x), y: c(p.y) }
}

export function parsePos (text) {
  if (typeof text !== 'string' || !text) return null
  try { return sanitizePos(JSON.parse(text)) } catch (_) { return null }
}
export function loadPos () {
  try { return parsePos(localStorage.getItem(POS_KEY)) } catch (_) { return null }
}
/** pos = { x, y } | null (null forgets the spot). Returns false when storage is blocked. */
export function savePos (pos) {
  try {
    const c = sanitizePos(pos)
    if (!c) localStorage.removeItem(POS_KEY)
    else localStorage.setItem(POS_KEY, JSON.stringify({ v: POS_VERSION, x: c.x, y: c.y }))
    return true
  } catch (_) { return false }
}

/**
 * Pure: keep a panel of side `box` inside the free screen. vp = { vw, vh, barH, topOffset, ribbonLeft, dockH }.
 * Horizontally 0..vw-box. Vertically it never goes under the bar; it may sit beside the ribbon (left of its inset, where the
 * docked OmniNotify box leaves the strip under the logo free) but not on it: otherwise its top is the ribbon's bottom (topOffset).
 * The bottom limit is the dock. If the screen is too small the top limit wins (the panel stays reachable).
 */
export function clampCompassPos (pos, box, vp) {
  const vw = Math.max(box, Number(vp?.vw) || 1280), vh = Math.max(box, Number(vp?.vh) || 720)
  const barH = Math.max(0, Number(vp?.barH) || 0), topOffset = Math.max(barH, Number(vp?.topOffset) || barH)
  const ribbonLeft = Math.max(0, Number(vp?.ribbonLeft) || 0)
  const dockH = vp?.dockH === undefined ? DOCK_H : Math.max(0, Number(vp.dockH) || 0)
  const x = Math.min(Math.max(0, Math.round(Number(pos?.x) || 0)), Math.max(0, vw - box))
  const besideRibbon = ribbonLeft > 0 && x + box <= ribbonLeft
  const minY = besideRibbon ? barH : topOffset
  const maxY = Math.max(minY, vh - dockH - box)
  const y = Math.min(Math.max(Math.round(Number(pos?.y) || 0), minY), maxY)
  return { x, y }
}

/**
 * Pure: the default spot until the person drags the panel. lay = { leftFree, ribbonH, barH, topOffset, topStack }.
 *  - leftFree >= box + 4: the strip under the logo to the left of the docked OmniNotify box is free -> centred there, level with the ribbon
 *    (this is where the compass lived before V190).
 *  - otherwise (narrow screens, phones, a floated / under-the-ribbon notify box: the ribbon spans the width): the right edge, just
 *    below the top hands banner (topStack), so it never covers the ribbon, the tab row, or the notify box that sits at the left.
 */
export function defaultCompassPos (box, vw, lay) {
  const barH = Math.max(0, Number(lay?.barH) || 0)
  const leftFree = Math.max(0, Number(lay?.leftFree) || 0)
  if (leftFree >= box + 4) {
    const ribbonH = Math.max(0, Number(lay?.ribbonH) || 0)
    return { x: Math.round((leftFree - box) / 2), y: barH + Math.max(0, Math.round((ribbonH - box) / 2)) }
  }
  const topStack = Math.max(barH, Number(lay?.topStack) || Number(lay?.topOffset) || barH)
  return { x: Math.max(0, Math.round(vw - box - EDGE)), y: topStack + EDGE }
}
