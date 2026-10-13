/**
 * utils/OmniSoundSettings.js — the GLOBAL sound options (V194): names, defaults, validation, migration, storage.
 * No DOM beyond localStorage / window events / matchMedia, and no import of any Dev* module (user-facing: the sound runtime
 * systems/OmniSoundNodes.js, the engine / scene / particles of the other V194 parts and the Admin > UI Settings block read it).
 *
 *   key             values                   default  meaning
 *   masterVolume    0..1                     0.8      the volume of everything the sound engine plays
 *   voiceCap        1..32 (integer)          8        how many sounds may play at once (the oldest is stolen)
 *   muteOnPhone     true | false             true     on a phone-sized screen start muted until the person unmutes (speaker button)
 *   requireOptIn    true | false             false    no sound at all until the person has pressed "Enable sound" (this session)
 *   particleCap     0..50000 (integer)       20000    the most sound particles drawn in the whole scene
 *   showUnlockPrompt true | false            true     show the "Enable sound" prompt when the browser still blocks audio
 *   muted           null | true | false      null     the speaker toggle: null = follow muteOnPhone, true / false = the person's own choice
 *
 * Storage 'omni:sound-settings-v1' = { v: 1, ...only the keys the person actually changed }. Load is defensive like
 * utils/OmniReticleSettings.js: bad JSON / wrong types / unknown keys / prototype keys / blocked storage all end at the defaults;
 * booleans accept "true"/"false"/1/0; numbers are rounded / clamped, and true / "" / null / arrays are rejected (never coerced to 0 or 1).
 * An unversioned (v0) blob is migrated: old names -> new names and a master volume given as a percent (> 1) -> a fraction.
 *
 * Events: in   `omni:sound-settings-set`      { patch: {...} } | { reset: true }   (validated; unknown keys / bad values ignored)
 *         out  `omni:sound-settings-changed`  { settings }   after every accepted change (also `reset`)
 * The consumers read getSoundSettings() (cached; always a complete valid object). systems/OmniSoundNodes.js owns the `set` listener.
 */

export const STORE_KEY = 'omni:sound-settings-v1'
export const STORE_VERSION = 1
export const SET_EVENT = 'omni:sound-settings-set'
export const CHANGED_EVENT = 'omni:sound-settings-changed'
export const PHONE_MAX_WIDTH = 700

export const LIMITS = Object.freeze({
  masterVolume: Object.freeze({ min: 0, max: 1, step: 0.01 }),
  voiceCap: Object.freeze({ min: 1, max: 32, step: 1 }),
  particleCap: Object.freeze({ min: 0, max: 50000, step: 500 }),
})

export const DEFAULTS = Object.freeze({
  masterVolume: 0.8,
  voiceCap: 8,
  muteOnPhone: true,
  requireOptIn: false,
  particleCap: 20000,
  showUnlockPrompt: true,
  muted: null,
})
export const KEYS = Object.keys(DEFAULTS)

const BOOL_KEYS = ['muteOnPhone', 'requireOptIn', 'showUnlockPrompt']
const toBool = (v) => (typeof v === 'boolean' ? v : (v === 1 || v === 0) ? v === 1 : (v === 'true' || v === 'false') ? v === 'true' : undefined)

/** Validate ONE key; returns the clean value or undefined (= reject). `muted: null` is a valid value (follow the phone default). */
export function cleanValue (key, v) {
  if (BOOL_KEYS.includes(key)) return toBool(v)
  if (key === 'muted') return v === null ? null : toBool(v)
  const lim = LIMITS[key]
  if (!lim) return undefined
  if (typeof v === 'boolean' || v === null || v === '' || (typeof v !== 'number' && typeof v !== 'string')) return undefined
  const n = Number(v)
  if (!Number.isFinite(n)) return undefined
  const c = Math.min(lim.max, Math.max(lim.min, n))
  return key === 'masterVolume' ? Math.round(c * 100) / 100 : Math.round(c)
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

const OLD_NAMES = { volume: 'masterVolume', master: 'masterVolume', maxVoices: 'voiceCap', voices: 'voiceCap', muteOnMobile: 'muteOnPhone', optIn: 'requireOptIn', maxParticles: 'particleCap', prompt: 'showUnlockPrompt' }

/** v0 (unversioned) -> v1: old names, and a master volume given as a percent. */
export function migrate (raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const v = Number(raw.v)
  if (Number.isFinite(v) && v >= 1) return raw
  const o = { ...raw }
  for (const [old, now] of Object.entries(OLD_NAMES)) if (!(now in o) && Object.prototype.hasOwnProperty.call(raw, old)) o[now] = raw[old]
  if (typeof o.masterVolume === 'number' && o.masterVolume > 1 && o.masterVolume <= 100) o.masterVolume = o.masterVolume / 100
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

/** Pure: apply one event detail to an overrides object -> { overrides, changed }. */
export function applyChange (overrides, detail) {
  const cur = sanitizePatch(overrides)
  if (detail?.reset === true) return { overrides: {}, changed: Object.keys(cur).length > 0 }
  const next = { ...cur, ...sanitizePatch(detail?.patch) }
  return { overrides: next, changed: JSON.stringify(next) !== JSON.stringify(cur) }
}

/** A phone-sized screen (the same 700 px line the panels use). Never throws. */
export function isPhoneScreen () {
  try { return typeof window !== 'undefined' && Number(window.innerWidth) > 0 && window.innerWidth <= PHONE_MAX_WIDTH } catch (_) { return false }
}

/** Is the sound muted by the settings? The speaker toggle (`muted`) wins; null follows "mute on phones". */
export function effectiveMuted (settings, phone = isPhoneScreen()) {
  const s = settings ?? DEFAULTS
  if (s.muted === true || s.muted === false) return s.muted
  return !!(s.muteOnPhone && phone)
}

// ── The live copy (read by the engine, the scene, the particles and the UI) ─────────────────────────────────────────────

let CACHE = null
/** The current settings: always a complete, valid object (a fresh copy, safe to keep). */
export function getSoundSettings () {
  if (!CACHE) CACHE = resolveSettings(loadOverrides())
  return { ...CACHE }
}
/** Forget the cached copy and read the storage again (tests; another tab changed the key). */
export function _reload () { CACHE = null; return getSoundSettings() }

/**
 * Apply one `omni:sound-settings-set` detail: validate, save, update the live copy, announce `omni:sound-settings-changed`.
 * Returns { changed, settings }. Never throws.
 */
export function applySettingsEvent (detail) {
  try {
    const { overrides, changed } = applyChange(loadOverrides(), detail)
    if (changed) saveOverrides(overrides)
    CACHE = resolveSettings(changed ? overrides : loadOverrides())
    if (changed) { try { window.dispatchEvent(new CustomEvent(CHANGED_EVENT, { detail: { settings: { ...CACHE } } })) } catch (_) { /* no window */ } }
    return { changed, settings: { ...CACHE } }
  } catch (_) { return { changed: false, settings: getSoundSettings() } }
}

// ── The session opt-in ("Enable sound" was pressed in this tab) ──────────────────────────────────────────────────────────

export const OPTIN_KEY = 'omni:sound-optin'
let OPTED = false
const sess = () => { try { return typeof window !== 'undefined' ? window.sessionStorage : null } catch (_) { return null } }
/** Has the person pressed "Enable sound" in this browser tab? (sessionStorage; falls back to memory when storage is blocked.) */
export function isOptedIn () {
  if (OPTED) return true
  try { return sess()?.getItem(OPTIN_KEY) === '1' } catch (_) { return false }
}
export function setOptedIn (on = true) {
  OPTED = !!on
  try { const ss = sess(); if (ss) { if (on) ss.setItem(OPTIN_KEY, '1'); else ss.removeItem(OPTIN_KEY) } } catch (_) { /* memory only */ }
}
/** Should the engine be silent right now? (muted by the settings, or an opt-in is required and not given yet.) */
export function engineMuted (settings = getSoundSettings(), phone = isPhoneScreen()) {
  return effectiveMuted(settings, phone) || (!!settings.requireOptIn && !isOptedIn())
}
