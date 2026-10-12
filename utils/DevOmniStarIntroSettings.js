/**
 * utils/DevOmniStarIntroSettings.js — the model behind the DEV intro settings (V190). DEV ONLY.
 *
 * CONVENTION: Dev* modules are developer-only; no user-facing module may import this file (a static test enforces it).
 * The BOOT SCRIPT (boot/OmniStarBoot.js, a classic script that runs before any module) does NOT import this: it reads the same
 * localStorage key directly and carries its own copy of this validation (sanitizeIntro). Keep the two in step; the tests run the same
 * inputs through both.
 *
 * Storage: localStorage 'omni:dev-intro-v1' = plain JSON
 *   { bg, texture, textureOpacity, customUrl, starColor, starOpacity, fieldOpacity, shootColor }
 *   bg / starColor / shootColor   '#rrggbb' (any colour; '#rgb' and a missing '#' are accepted and normalised)
 *   texture                       'none' | 'noise' | 'grid' | 'scanlines' | 'dots' | 'custom'  (generated procedurally at boot; 'custom' needs customUrl)
 *   textureOpacity                0..1   (the texture layer over the background colour)
 *   customUrl                     '' | a data:image/(png|jpeg|webp|gif);base64 URL (<= 400000 chars) | an https URL (<= 500 chars, no quotes / parentheses / spaces)
 *   starOpacity                   0..1   the landed logo star's opacity (default 0.7)
 *   fieldOpacity                  0..1   the background star field (default 1)
 * Applied on the NEXT load (or with "Preview intro", which replays the boot markup + script through window.__omniBootPreview).
 *
 * Pure: no DOM, no Three. Only `localStorage` (try/catch) and `window.dispatchEvent` (guarded).
 * Events: omni:dev-intro-changed { settings }
 */

export const STORAGE_KEY = 'omni:dev-intro-v1'
export const CHANGED_EVENT = 'omni:dev-intro-changed'
export const TEXTURES = ['none', 'noise', 'grid', 'scanlines', 'dots', 'custom']
export const MAX_DATA_URL = 400000
export const MAX_HTTPS_URL = 500
export const MAX_UPLOAD_BYTES = 200 * 1024   // raw image bytes accepted by the panel's file picker (base64 makes it ~1.37x, still under MAX_DATA_URL)
export const DEFAULTS = Object.freeze({ bg: '#000000', texture: 'none', textureOpacity: 0.35, customUrl: '', starColor: '#ffffff', starOpacity: 0.7, fieldOpacity: 1, shootColor: '#ffffff' })

/** '#rrggbb' (lower case) from '#rgb' / 'rgb' / '#RRGGBB'; `fallback` for anything else. */
export function normalizeHex (v, fallback = '#000000') {
  if (typeof v !== 'string') return fallback
  const m = /^#?([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/.exec(v.trim())
  if (!m) return fallback
  let h = m[1].toLowerCase()
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
  return '#' + h
}

export function clamp01 (v, fallback) {
  const n = typeof v === 'number' ? v : (typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN)
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : fallback
}

/** '' unless `v` is a safe data:image URL (capped) or a safe https URL. */
export function safeImageUrl (v) {
  if (typeof v !== 'string' || !v) return ''
  if (v.length <= MAX_DATA_URL && /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+=*$/.test(v)) return v
  if (v.length <= MAX_HTTPS_URL && /^https:\/\/[A-Za-z0-9._~:/?#[\]@!$&*+,;=%-]+$/.test(v)) return v
  return ''
}

/** Copy + validate: never throws, never returns a field that is not one of the known types. */
export function sanitize (raw) {
  const r = (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : {}
  const o = {
    bg: normalizeHex(r.bg, DEFAULTS.bg),
    texture: TEXTURES.includes(r.texture) ? r.texture : DEFAULTS.texture,
    textureOpacity: clamp01(r.textureOpacity, DEFAULTS.textureOpacity),
    customUrl: safeImageUrl(r.customUrl),
    starColor: normalizeHex(r.starColor, DEFAULTS.starColor),
    starOpacity: clamp01(r.starOpacity, DEFAULTS.starOpacity),
    fieldOpacity: clamp01(r.fieldOpacity, DEFAULTS.fieldOpacity),
    shootColor: normalizeHex(r.shootColor, DEFAULTS.shootColor),
  }
  if (o.texture === 'custom' && !o.customUrl) o.texture = 'none'
  return o
}

export function load () {
  try {
    const txt = localStorage.getItem(STORAGE_KEY)
    if (!txt || txt.length > 600000) return sanitize(null)
    return sanitize(JSON.parse(txt))
  } catch (_) { return sanitize(null) }
}

function announce (settings) {
  try { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(CHANGED_EVENT, { detail: { settings } })) } catch (_) {}
}

/** Saves `patch` merged over the stored settings (validated). Returns { ok, settings }. ok=false when storage refused (quota / blocked). */
export function save (patch) {
  const settings = sanitize({ ...load(), ...(patch && typeof patch === 'object' ? patch : {}) })
  let ok = true
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)) } catch (_) { ok = false }
  announce(settings)
  return { ok, settings }
}

/** Removes the stored value (the boot then uses the defaults). */
export function reset () {
  try { localStorage.removeItem(STORAGE_KEY) } catch (_) {}
  const settings = sanitize(null)
  announce(settings)
  return settings
}

/** Reads an image File into a data URL if it is a png / jpeg / webp / gif no larger than MAX_UPLOAD_BYTES. Browser only (FileReader). */
export function readImageFile (file) {
  return new Promise((resolve) => {
    try {
      if (!file || !/^image\/(png|jpeg|webp|gif)$/.test(file.type)) return resolve({ ok: false, error: 'Use a png, jpeg, webp or gif image.' })
      if (!(file.size > 0) || file.size > MAX_UPLOAD_BYTES) return resolve({ ok: false, error: `Image is too large (max ${Math.round(MAX_UPLOAD_BYTES / 1024)} KB).` })
      const fr = new FileReader()
      fr.onload = () => { const url = safeImageUrl(String(fr.result || '')); resolve(url ? { ok: true, url } : { ok: false, error: 'Could not use that image.' }) }
      fr.onerror = () => resolve({ ok: false, error: 'Could not read that file.' })
      fr.readAsDataURL(file)
    } catch (_) { resolve({ ok: false, error: 'Could not read that file.' }) }
  })
}
