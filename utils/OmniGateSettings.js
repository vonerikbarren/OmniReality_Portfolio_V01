/**
 * utils/OmniGateSettings.js — the settings of the opening screen / OmniPassKeyRing gate (V276). Pure model; only localStorage (try/catch).
 *
 * Storage: localStorage 'omni:gate-v1' = plain JSON of sanitizeGateSettings(). boot/OmniStarBoot.js (a classic script that runs before any module)
 * reads the few fields it needs at once and the rest after a dynamic import of this file.
 * COLOURS (`look`): null = nothing chosen in the gear panel, so the dev intro settings ('omni:dev-intro-v1', all defaults are LIGHT) apply. The gear panel
 * folds those settings in: choosing Light / Dark or a colour stores a full `look` here, and `look` wins over the dev store. (User-facing modules never import the dev file.)
 *
 *   look        null | { bg '#rrggbb', ink '#rrggbb' (words, stars, bar), starOpacity 0..1 (the logo star), fieldOpacity 0..1, shootColor '#rrggbb' }
 *   gate        true: Enter starts the fall and the gate; false: the old straight fall with no form
 *   overall     0.3..1   opacity of the whole opening scene (default 0.68)
 *   plexus      { count 20..200, link 40..300 px, lineAlpha 0..1, speed 0..3, size 0.5..3 }
 *   spaces      { enabled [ids], holdSec, moveSec, direction 'out'|'in', caption bool }
 *   bar         'plain' | 'rainbow'
 *   reduceMotion  true: no motion beyond the loading bar (the system setting is honoured as well)
 *   digits      6 | 10
 *   username    '' | up to 32 characters (the last visitor name; the form shows "Guest" when empty)
 * Events: omni:gate-settings-changed { settings }
 */
import { SPACE_IDS, sanitizeSpaceIds, DIRECTIONS } from './OmniSpaces.js'

export const STORAGE_KEY = 'omni:gate-v1'
export const CHANGED_EVENT = 'omni:gate-settings-changed'
export const BARS = Object.freeze(['plain', 'rainbow'])
export const DEFAULTS = Object.freeze({
  gate: true,
  overall: 0.68,
  plexus: Object.freeze({ count: 90, link: 140, lineAlpha: 0.35, speed: 1, size: 1 }),
  spaces: Object.freeze({ enabled: Object.freeze([...SPACE_IDS]), holdSec: 9, moveSec: 3.2, direction: 'out', caption: true }),
  bar: 'plain',
  reduceMotion: false,
  digits: 6,
  username: '',
  look: null
})
export const LOOK_LIGHT = Object.freeze({ bg: '#ffffff', ink: '#000000', starOpacity: 0.7, fieldOpacity: 1, shootColor: '#000000' })
export const LOOK_DARK = Object.freeze({ bg: '#000000', ink: '#ffffff', starOpacity: 0.7, fieldOpacity: 1, shootColor: '#ffffff' })

function hex (v, d) {
  if (typeof v !== 'string') return d
  const m = /^#?([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/.exec(v.trim())
  if (!m) return d
  let h = m[1].toLowerCase(); if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
  return '#' + h
}
function sanitizeLook (raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const ink = hex(raw.ink, LOOK_LIGHT.ink)
  return {
    bg: hex(raw.bg, LOOK_LIGHT.bg),
    ink,
    starOpacity: Math.round(num(raw.starOpacity, 0, 1, LOOK_LIGHT.starOpacity) * 100) / 100,
    fieldOpacity: Math.round(num(raw.fieldOpacity, 0, 1, LOOK_LIGHT.fieldOpacity) * 100) / 100,
    shootColor: hex(raw.shootColor, ink)
  }
}

function num (v, min, max, d) {
  const n = typeof v === 'number' ? v : (typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d
}
const bool = (v, d) => (typeof v === 'boolean' ? v : d)

/** A fresh, fully validated copy. Never throws, never returns anything but the known fields. */
export function sanitizeGateSettings (raw) {
  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  const p = r.plexus && typeof r.plexus === 'object' && !Array.isArray(r.plexus) ? r.plexus : {}
  const s = r.spaces && typeof r.spaces === 'object' && !Array.isArray(r.spaces) ? r.spaces : {}
  const D = DEFAULTS
  return {
    gate: bool(r.gate, D.gate),
    overall: Math.round(num(r.overall, 0.3, 1, D.overall) * 100) / 100,
    plexus: {
      count: Math.round(num(p.count, 20, 200, D.plexus.count)),
      link: Math.round(num(p.link, 40, 300, D.plexus.link)),
      lineAlpha: Math.round(num(p.lineAlpha, 0, 1, D.plexus.lineAlpha) * 100) / 100,
      speed: Math.round(num(p.speed, 0, 3, D.plexus.speed) * 100) / 100,
      size: Math.round(num(p.size, 0.5, 3, D.plexus.size) * 100) / 100
    },
    spaces: {
      enabled: Array.isArray(s.enabled) ? sanitizeSpaceIds(s.enabled) : [...D.spaces.enabled],
      holdSec: Math.round(num(s.holdSec, 2, 60, D.spaces.holdSec) * 10) / 10,
      moveSec: Math.round(num(s.moveSec, 1, 10, D.spaces.moveSec) * 10) / 10,
      direction: DIRECTIONS.includes(s.direction) ? s.direction : D.spaces.direction,
      caption: bool(s.caption, D.spaces.caption)
    },
    bar: BARS.includes(r.bar) ? r.bar : D.bar,
    reduceMotion: bool(r.reduceMotion, D.reduceMotion),
    digits: r.digits === 10 || r.digits === '10' ? 10 : 6,
    username: typeof r.username === 'string' ? r.username.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 32) : '',
    look: sanitizeLook(r.look)
  }
}

export function loadGateSettings () {
  try {
    const txt = localStorage.getItem(STORAGE_KEY)
    if (!txt || txt.length > 100000) return sanitizeGateSettings(null)
    return sanitizeGateSettings(JSON.parse(txt))
  } catch (_) { return sanitizeGateSettings(null) }
}

function announce (settings) {
  try { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(CHANGED_EVENT, { detail: { settings } })) } catch (_) {}
}

/** Merges `patch` (shallow per group) over the stored settings and saves. Returns { ok, settings }; ok=false when storage refused. */
export function saveGateSettings (patch) {
  const cur = loadGateSettings(), p = patch && typeof patch === 'object' ? patch : {}
  const merged = { ...cur, ...p, look: p.look === undefined ? cur.look : (p.look && typeof p.look === 'object' ? { ...(cur.look || LOOK_LIGHT), ...p.look } : null), plexus: { ...cur.plexus, ...(p.plexus && typeof p.plexus === 'object' ? p.plexus : {}) }, spaces: { ...cur.spaces, ...(p.spaces && typeof p.spaces === 'object' ? p.spaces : {}) } }
  const settings = sanitizeGateSettings(merged)
  let ok = true
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)) } catch (_) { ok = false }
  announce(settings)
  return { ok, settings }
}

export function resetGateSettings () {
  try { localStorage.removeItem(STORAGE_KEY) } catch (_) {}
  const settings = sanitizeGateSettings(null)
  announce(settings)
  return settings
}
