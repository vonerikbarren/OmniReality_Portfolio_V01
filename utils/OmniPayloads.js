/**
 * utils/OmniPayloads.js — the RightHand's AMMO: created PAYLOADS (V168). Store + events, no DOM.
 *
 * A payload is something the user CREATES (a data type + a value + how it is shown) and
 * keeps in a library; the current one is what the RightHand fires (and what the LeftHand
 * hosts inside the flowchart element it fires). See docs/omniproducts/OMNI_FLOW_FIRE_DESIGN.md.
 *
 *   {
 *     id, name, type: 'string' | 'number' | 'boolean', value,
 *     display: { mode: 'tooltip', wordDelayMs, risePx, holdMs, direction: 'up'|'down', loop, maxWords },
 *     style:   { color, textureId: string|null, material },
 *     created: ISO string
 *   }
 *
 * Storage: localStorage 'omni:payloads-v1' = { _v:1, current, payloads:[...] }. Same shape of
 * safety as utils/OmniHandsSettings.js: try/catch around every storage call, `{...DEFAULTS,...saved}`
 * merge per payload (display / style merged key by key), every field sanitised on load AND write.
 * Adding a field never needs a `_v` bump.
 *
 * Events (window):
 *   omni:payload-changed  { id, kind: 'added' | 'updated' | 'removed' | 'reset' }
 *   omni:payload-current  { id }            (id may be null when the library is empty)
 *
 * Types: string / number / boolean in this pass. 'array' and 'object' are LISTED in
 * FUTURE_TYPES so the UI can show them disabled; add() / update() reject them.
 */

export const STORE_KEY = 'omni:payloads-v1'
export const STORE_VERSION = 1
export const CHANGED_EVENT = 'omni:payload-changed'
export const CURRENT_EVENT = 'omni:payload-current'

export const TYPES = ['string', 'number', 'boolean']
export const FUTURE_TYPES = ['array', 'object']
export const MATERIALS = ['standard', 'basic', 'emissive', 'glass', 'wireframe', 'metal']
export const MAX_STRING = 500
export const MAX_NAME = 40
export const MAX_PAYLOADS = 200

export const DISPLAY_LIMITS = {
  wordDelayMs: { min: 50, max: 3000 },
  holdMs:      { min: 0, max: 10000 },
  risePx:      { min: 10, max: 300 },
  maxWords:    { min: 1, max: 100 },
}

export const DISPLAY_DEFAULTS = Object.freeze({
  mode: 'tooltip', wordDelayMs: 450, risePx: 60, holdMs: 900, direction: 'up', loop: false, maxWords: 40,
})
export const STYLE_DEFAULTS = Object.freeze({ color: '#7fd8ff', textureId: null, material: 'standard' })

const HEX = /^#[0-9a-fA-F]{6}$/
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v)

// ── Sanitisers ───────────────────────────────────────────────────────────────

export function sanitizeValue (type, value) {
  if (type === 'string') return String(value ?? '').slice(0, MAX_STRING)
  if (type === 'number') { const n = Number(value); return Number.isFinite(n) && value !== '' && value !== null ? n : null }
  if (type === 'boolean') return value === true || value === 'true' || value === 1
  return null
}

export function sanitizeDisplay (d) {
  const src = d && typeof d === 'object' ? d : {}
  const out = { ...DISPLAY_DEFAULTS }
  for (const k of Object.keys(DISPLAY_LIMITS)) {
    const n = Number(src[k])
    if (src[k] !== undefined && src[k] !== null && src[k] !== '' && Number.isFinite(n)) {
      out[k] = clamp(k === 'maxWords' ? Math.round(n) : n, DISPLAY_LIMITS[k].min, DISPLAY_LIMITS[k].max)
    }
  }
  out.direction = src.direction === 'down' ? 'down' : 'up'
  out.loop = !!src.loop
  out.mode = 'tooltip'            // 'panel' is a documented future switch, not built
  return out
}

export function sanitizeStyle (s) {
  const src = s && typeof s === 'object' ? s : {}
  return {
    color: typeof src.color === 'string' && HEX.test(src.color) ? src.color.toLowerCase() : STYLE_DEFAULTS.color,
    textureId: typeof src.textureId === 'string' && src.textureId ? src.textureId.slice(0, 80) : null,
    material: MATERIALS.includes(src.material) ? src.material : STYLE_DEFAULTS.material,
  }
}

function newId () { return 'pl_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) }

/** Returns a clean payload, or null if the type / value is invalid. */
export function sanitizePayload (p, { keepId = true } = {}) {
  if (!p || typeof p !== 'object') return null
  if (!TYPES.includes(p.type)) return null
  const value = sanitizeValue(p.type, p.value)
  if (value === null) return null                         // non-finite number
  if (p.type === 'string' && !value.trim()) return null   // empty string payload is not ammo
  const name = String(p.name ?? '').trim().slice(0, MAX_NAME) || defaultName(p.type, value)
  return {
    id: keepId && typeof p.id === 'string' && p.id ? p.id.slice(0, 64) : newId(),
    name, type: p.type, value,
    display: sanitizeDisplay(p.display),
    style: sanitizeStyle(p.style),
    created: typeof p.created === 'string' && p.created ? p.created.slice(0, 40) : new Date().toISOString(),
  }
}

export function defaultName (type, value) {
  const s = type === 'string' ? String(value).trim().replace(/\s+/g, ' ') : String(value)
  return (s.length > 24 ? s.slice(0, 23) + '…' : s) || type
}

/** A deep, detached copy (what a fired element persists, so deleting the library item never breaks it). */
export function snapshot (p) {
  return p ? JSON.parse(JSON.stringify(p)) : null
}

// ── Store ────────────────────────────────────────────────────────────────────

let state = load()

function load () {
  const out = { _v: STORE_VERSION, current: null, payloads: [] }
  try {
    const raw = localStorage.getItem(STORE_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.payloads)) {
      const seen = new Set()
      for (const p of parsed.payloads) {
        const c = sanitizePayload(p)
        if (c && !seen.has(c.id) && out.payloads.length < MAX_PAYLOADS) { seen.add(c.id); out.payloads.push(c) }
      }
      if (typeof parsed.current === 'string' && seen.has(parsed.current)) out.current = parsed.current
    }
  } catch (_) { /* corrupt / unavailable storage: start empty */ }
  if (!out.current && out.payloads.length) out.current = out.payloads[0].id
  return out
}

function persist () {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)) } catch (_) { /* session-only if storage is unavailable */ }
}

function emit (name, detail) {
  try { window.dispatchEvent(new CustomEvent(name, { detail })) } catch (_) {}
}

const copy = (p) => (p ? snapshot(p) : null)

export function listPayloads () { return state.payloads.map(copy) }
export function getPayload (id) { return copy(state.payloads.find(p => p.id === id)) }
export function getCurrentId () { return state.current }
export function getCurrentPayload () { return getPayload(state.current) }

/** Adds (and does NOT select) a payload. Returns the stored copy, or null when invalid / library full. */
export function addPayload (input, { setCurrent = false } = {}) {
  if (state.payloads.length >= MAX_PAYLOADS) return null
  const p = sanitizePayload(input, { keepId: false })
  if (!p) return null
  state = { ...state, payloads: [...state.payloads, p] }
  persist()
  emit(CHANGED_EVENT, { id: p.id, kind: 'added' })
  if (setCurrent || !state.current) setCurrentPayload(p.id)
  return copy(p)
}

/** Merges a patch (display / style are merged key by key). Returns the stored copy, or null. */
export function updatePayload (id, patch) {
  const i = state.payloads.findIndex(p => p.id === id)
  if (i < 0 || !patch || typeof patch !== 'object') return null
  const cur = state.payloads[i]
  const type = patch.type ?? cur.type
  const merged = {
    ...cur, ...patch, id: cur.id, created: cur.created, type,
    display: { ...cur.display, ...(patch.display ?? {}) },
    style: { ...cur.style, ...(patch.style ?? {}) },
  }
  const next = sanitizePayload(merged)
  if (!next) return null
  if (JSON.stringify(next) === JSON.stringify(cur)) return copy(cur)
  const payloads = state.payloads.slice()
  payloads[i] = next
  state = { ...state, payloads }
  persist()
  emit(CHANGED_EVENT, { id, kind: 'updated' })
  return copy(next)
}

export function removePayload (id) {
  const i = state.payloads.findIndex(p => p.id === id)
  if (i < 0) return false
  const payloads = state.payloads.filter(p => p.id !== id)
  const wasCurrent = state.current === id
  state = { ...state, payloads, current: wasCurrent ? (payloads[Math.min(i, payloads.length - 1)]?.id ?? null) : state.current }
  persist()
  emit(CHANGED_EVENT, { id, kind: 'removed' })
  if (wasCurrent) emit(CURRENT_EVENT, { id: state.current })
  return true
}

export function setCurrentPayload (id) {
  const ok = id === null || state.payloads.some(p => p.id === id)
  if (!ok || state.current === id) return ok && state.current === id
  state = { ...state, current: id }
  persist()
  emit(CURRENT_EVENT, { id })
  return true
}

/** Next / previous payload in library order (wraps). Returns the new current id. */
export function cyclePayload (dir = 1) {
  const n = state.payloads.length
  if (!n) return null
  const i = Math.max(0, state.payloads.findIndex(p => p.id === state.current))
  const next = state.payloads[(i + (dir < 0 ? -1 : 1) + n) % n].id
  setCurrentPayload(next)
  return next
}

/** Test / support hook: re-read storage. */
export function reloadFromStorage () { state = load() }

/** Empties the library (not exposed in the UI as a bulk action). */
export function clearPayloads () {
  state = { _v: STORE_VERSION, current: null, payloads: [] }
  persist()
  emit(CHANGED_EVENT, { id: null, kind: 'reset' })
  emit(CURRENT_EVENT, { id: null })
}
