/**
 * utils/OmniStoreSettings.js — ⟐OmniStoreSettings: the USER's look settings for a store (V177, SANDBOX store)
 *
 * CONVENTION (decided 2026-10-09): `<System>Settings` is for the USER (Admin area); `Dev<System>Settings` is for the
 * developer and Claude. This module is the user side. It NEVER imports or reads anything from the dev side
 * (utils/DevOmniStoreData.js); everything the user can change here works with the dev module absent.
 *
 * No DOM. Persisted at localStorage 'omni:store-settings-v1' (versioned, sanitised, try/catch).
 *
 * SHAPE (per store id; the store id is the store's ownerId today, so there is one store per identity, but the key is a
 * plain string so several stores can follow):
 *   { name: '',                                   // display name shown in the HUD ('' = the default "⟐OmniStore")
 *     colors:   { hover, selected, shelfRim, shelfBack, shelfPlank, backdrop|null },   // '#rrggbb'
 *     backdrop: { mode:'none'|'solid'|'gradient', color, color2, opacity },
 *     layout:   'shelf'|'ring'|'aisle'|'island' }      // V179: how the store is arranged (utils/OmniStoreLayouts.js); default 'shelf',
 *                                                      // unknown / missing (data saved before V179) -> 'shelf'. NOT part of presets.
 *     anchor:   [x, y, z] }                            // V181: where the whole store stands in the world; default [0, 3, -40]; x / z clamped
 *                                                      // to +-500, y to -200..300; NaN / wrong shape -> default. NOT part of presets or the colour reset.
 *   colors.backdrop is an optional OVERRIDE of backdrop.color (null = use backdrop.color); the panel only edits
 *   backdrop.color; the override is reserved for store-type themes (BuildOrder item 6).
 * PRESETS  4 built-in (Market Wood = the V176 look, Fresh Green, Night Market, Clean White; not stored, cannot be
 *   deleted) + the user's own (stored once for the whole app, shared by every store, max 20).
 * The sandbox note is NOT a setting.
 *
 * Events (window):
 *   omni:store-settings-changed {storeId, key, keys}   key = the single changed path ('colors.hover', 'backdrop.mode',
 *                                                      'name', 'presets') or 'all' when several changed at once
 *   omni:store-settings-set {patch, storeId?}           INPUT: apply a partial patch (needs attach(); the scene and the
 *                                                      panel both attach, ref-counted)
 */

import { activeStoreId } from './OmniStoreModel.js'   // V182: the ACTIVE store of the current identity (the first store keeps the identity id, so V181 data still matches)
import { LAYOUT_IDS, DEFAULT_LAYOUT, isLayoutId } from './OmniStoreLayouts.js'   // V179: the one list of layout ids (pure module)

export const STORAGE_KEY = 'omni:store-settings-v1'
export const VERSION = 1
export const CHANGED_EVENT = 'omni:store-settings-changed'
export const SET_EVENT = 'omni:store-settings-set'
export const COLOR_KEYS = ['hover', 'selected', 'shelfRim', 'shelfBack', 'shelfPlank']
export const COLOR_LABELS = { hover: 'Hover selector', selected: 'Selected selector', shelfRim: 'Shelf rim (disc edge)', shelfBack: 'Shelf back panel', shelfPlank: 'Shelf planks', backdrop: 'Backdrop colour override' }
export const BACKDROP_MODES = ['none', 'solid', 'gradient']
export { LAYOUT_IDS, DEFAULT_LAYOUT }
export const LIMITS = { name: 40, presets: 20, presetName: 32, stores: 40 }   // V182: stores 16 -> 40 (the model allows 16 stores in all; leftover ids of deleted stores are dropped on delete)
// V182: where the next store goes. A grid of spacing STORE_SPACING (2 x the 60-unit layout bounds + 30) around the default place, nearest first
// (ties: +x, +z, -x, -z), skipping spots within ORIGIN_CLEAR of the origin objects near [200, 50, 300] and anything closer than the spacing to a taken anchor.
export const STORE_SPACING = 150
export const ORIGIN_OBJECTS = Object.freeze([200, 50, 300])
export const ORIGIN_CLEAR = 80
export function nextFreeAnchor (taken = []) {
  const d = DEFAULT_ANCHOR, cand = []
  for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) {
    const a = [d[0] + i * STORE_SPACING, d[1], d[2] + j * STORE_SPACING]
    if (Math.hypot(a[0] - ORIGIN_OBJECTS[0], a[1] - ORIGIN_OBJECTS[1], a[2] - ORIGIN_OBJECTS[2]) < ORIGIN_CLEAR) continue
    const ang = (Math.atan2(a[2] - d[2], a[0] - d[0]) + 2 * Math.PI) % (2 * Math.PI)
    cand.push({ a, dist: Math.hypot(i, j), ang })
  }
  cand.sort((p, q) => (Math.abs(p.dist - q.dist) > 1e-9 ? p.dist - q.dist : p.ang - q.ang))
  const t = (Array.isArray(taken) ? taken : []).filter(p => Array.isArray(p) && p.length === 3 && p.every(finite))
  const hit = cand.find(c => t.every(p => Math.hypot(c.a[0] - p[0], c.a[1] - p[1], c.a[2] - p[2]) >= STORE_SPACING - 1e-9))
  return hit ? [...hit.a] : null
}

// V181: store location. The scene re-exports DEFAULT_ANCHOR from here (this module is pure; the scene is not).
export const DEFAULT_ANCHOR = Object.freeze([0, 3, -40])
export const ANCHOR_RANGE = Object.freeze({ x: [-500, 500], y: [-200, 300], z: [-500, 500] })
export const ANCHOR_AXES = ['x', 'y', 'z']
/** Clamp one axis (0|1|2) into its range; NaN / non-number -> null. Rounded to 2 decimals. */
export function clampAxis (i, v) {
  if (typeof v === 'string' && v.trim() !== '') v = Number(v)
  if (typeof v !== 'number' || !Number.isFinite(v)) return null
  const [lo, hi] = ANCHOR_RANGE[ANCHOR_AXES[i]]
  return Math.round(Math.min(hi, Math.max(lo, v)) * 100) / 100
}
/** Untrusted -> [x,y,z] (each axis clamped); an axis that is not a finite number takes `fallback`'s value (default: the default anchor). */
export function normalizeAnchor (a, fallback = DEFAULT_ANCHOR) {
  const out = [0, 1, 2].map(i => fallback[i])
  if (!Array.isArray(a) || a.length !== 3) return out
  return [0, 1, 2].map(i => clampAxis(i, a[i]) ?? out[i])
}

export const DEFAULT_COLORS = Object.freeze({ hover: '#ffb02e', selected: '#2e9bff', shelfRim: '#5b4a36', shelfBack: '#d8cdb9', shelfPlank: '#a57d52', backdrop: null })
export const DEFAULT_BACKDROP = Object.freeze({ mode: 'none', color: '#1d2a1f', color2: '#0b1410', opacity: 1 })

const look = (colors, backdrop) => ({ colors: { ...DEFAULT_COLORS, ...colors }, backdrop: { ...DEFAULT_BACKDROP, ...backdrop } })
export const BUILTIN_PRESETS = Object.freeze([
  { id: 'market-wood', name: 'Market Wood', builtin: true, ...look({}, {}) },
  { id: 'fresh-green', name: 'Fresh Green', builtin: true, ...look({ hover: '#ffd23f', selected: '#1b8f3a', shelfRim: '#2f5d34', shelfBack: '#dff1d4', shelfPlank: '#7fb069' }, { mode: 'gradient', color: '#d4f0cf', color2: '#7fb77e', opacity: 1 }) },
  { id: 'night-market', name: 'Night Market', builtin: true, ...look({ hover: '#ff5fa2', selected: '#41e0ff', shelfRim: '#1a1230', shelfBack: '#2b2350', shelfPlank: '#4b3a8c' }, { mode: 'gradient', color: '#2a1146', color2: '#06051a', opacity: 1 }) },
  { id: 'clean-white', name: 'Clean White', builtin: true, ...look({ hover: '#ff8a00', selected: '#0a84ff', shelfRim: '#9aa0a6', shelfBack: '#ffffff', shelfPlank: '#dcdfe3' }, { mode: 'solid', color: '#f4f6f8', opacity: 1 }) },
])

let S = null            // { stores:{id:{name,colors,backdrop}}, presets:[user presets] }
let loaded = false
let seq = 0
let attached = 0
let onSet = null

const emit = (detail) => { try { window.dispatchEvent(new CustomEvent(CHANGED_EVENT, { detail })) } catch (_) { /* no window */ } }
const finite = (x) => typeof x === 'number' && Number.isFinite(x)
const idOk = (v) => typeof v === 'string' && /^[A-Za-z0-9_.:-]{1,64}$/.test(v)
const clone = (o) => JSON.parse(JSON.stringify(o))

/** '#abc' / '#aabbcc' (any case) -> '#aabbcc'; anything else -> null. */
export function normalizeHex (v) {
  if (typeof v !== 'string') return null
  const m = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(v.trim())
  if (!m) return null
  let h = m[1].toLowerCase()
  if (h.length === 3) h = h.split('').map(c => c + c).join('')
  return '#' + h
}
export const hexToInt = (hex) => parseInt((normalizeHex(hex) ?? '#000000').slice(1), 16)

export function defaultSettings () { return { name: '', colors: { ...DEFAULT_COLORS }, backdrop: { ...DEFAULT_BACKDROP }, layout: DEFAULT_LAYOUT, anchor: [...DEFAULT_ANCHOR] } }

/** Untrusted -> a complete, valid settings object (always `{...DEFAULTS, ...saved}` per field, never throws). */
export function sanitize (raw) {
  const out = defaultSettings()
  if (!raw || typeof raw !== 'object') return out
  if (typeof raw.name === 'string') out.name = raw.name.replace(/<[^>]*>/g, '').replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, LIMITS.name)
  const c = raw.colors && typeof raw.colors === 'object' ? raw.colors : {}
  COLOR_KEYS.forEach(k => { const h = normalizeHex(c[k]); if (h) out.colors[k] = h })
  out.colors.backdrop = c.backdrop === null || c.backdrop === undefined ? null : (normalizeHex(c.backdrop) ?? null)
  const b = raw.backdrop && typeof raw.backdrop === 'object' ? raw.backdrop : {}
  if (BACKDROP_MODES.includes(b.mode)) out.backdrop.mode = b.mode
  const c1 = normalizeHex(b.color); if (c1) out.backdrop.color = c1
  const c2 = normalizeHex(b.color2); if (c2) out.backdrop.color2 = c2
  if (finite(b.opacity)) out.backdrop.opacity = Math.min(1, Math.max(0, b.opacity))
  out.layout = isLayoutId(raw.layout) ? raw.layout : DEFAULT_LAYOUT
  out.anchor = normalizeAnchor(raw.anchor)   // V181: data saved before V181 has no anchor -> the default
  return out
}

function sanitizePreset (raw) {
  if (!raw || typeof raw !== 'object' || !idOk(raw.id)) return null
  const s = sanitize(raw)
  return { id: raw.id, name: String(raw.name ?? raw.id).replace(/<[^>]*>/g, '').replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, LIMITS.presetName) || raw.id, builtin: false, colors: s.colors, backdrop: s.backdrop }
}

function ensureLoaded () { if (!loaded) load() }

export function load () {
  loaded = true
  S = { stores: {}, presets: [] }
  let raw = null
  try { raw = localStorage.getItem(STORAGE_KEY) } catch (_) { return S }
  if (!raw) return S
  let data = null
  try { data = JSON.parse(raw) } catch (_) { return S }
  if (!data || typeof data !== 'object' || data.version !== VERSION) return S
  if (data.stores && typeof data.stores === 'object') Object.keys(data.stores).slice(0, LIMITS.stores).forEach(id => { if (idOk(id)) S.stores[id] = sanitize(data.stores[id]) })
  const seen = new Set(BUILTIN_PRESETS.map(p => p.id))
  ;(Array.isArray(data.presets) ? data.presets : []).slice(0, LIMITS.presets).forEach(p => { const sp = sanitizePreset(p); if (sp && !seen.has(sp.id)) { seen.add(sp.id); S.presets.push(sp) } })
  return S
}

function persist () {
  if (!S) return
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: VERSION, stores: S.stores, presets: S.presets })) } catch (_) { /* memory only */ }
}
export const flush = () => { ensureLoaded(); persist() }
export function _reset (clear = false) {
  if (clear) { try { localStorage.removeItem(STORAGE_KEY) } catch (_) { /* ignore */ } }
  S = { stores: {}, presets: [] }; loaded = true; seq = 0
}

// ── Access ──────────────────────────────────────────────────────────────────────

export const currentStoreId = () => activeStoreId()

/** A COPY of the store's settings (defaults filled in). Mutating it changes nothing. */
export function getSettings (storeId) {
  ensureLoaded()
  const id = storeId ?? currentStoreId()
  return clone(S.stores[id] ?? defaultSettings())
}

function diffKeys (a, b) {
  const keys = []
  if (a.name !== b.name) keys.push('name')
  if (a.layout !== b.layout) keys.push('layout')
  if (ANCHOR_AXES.some((_, i) => a.anchor[i] !== b.anchor[i])) keys.push('anchor')
  ;[...COLOR_KEYS, 'backdrop'].forEach(k => { if (a.colors[k] !== b.colors[k]) keys.push('colors.' + k) })
  Object.keys(DEFAULT_BACKDROP).forEach(k => { if (a.backdrop[k] !== b.backdrop[k]) keys.push('backdrop.' + k) })
  return keys
}

/**
 * Apply a PARTIAL patch ({name?, colors?:{...}, backdrop?:{...}, layout?, anchor?:[x,y,z]}) to a store. Invalid values are ignored (the old value
 * stays), valid ones are normalised. Returns the list of changed keys ([] = nothing changed, no event).
 */
export function setSettings (patch, storeId) {
  ensureLoaded()
  const id = storeId ?? currentStoreId()
  if (!idOk(id) || !patch || typeof patch !== 'object') return []
  const cur = S.stores[id] ?? defaultSettings()
  const merged = {
    name: Object.prototype.hasOwnProperty.call(patch, 'name') ? patch.name : cur.name,
    colors: { ...cur.colors, ...(patch.colors && typeof patch.colors === 'object' ? onlyValid(patch.colors, cur.colors) : {}) },
    backdrop: { ...cur.backdrop, ...(patch.backdrop && typeof patch.backdrop === 'object' ? patch.backdrop : {}) },
    layout: isLayoutId(patch.layout) ? patch.layout : cur.layout,   // an unknown layout id in a patch is ignored (the old one stays)
    anchor: normalizeAnchor(patch.anchor, cur.anchor),               // V181: a bad axis (NaN, text) keeps the old value; the others still apply
  }
  const next = sanitize(merged)
  // sanitize() resets an invalid field to its DEFAULT; keep the previous value instead
  if (patch.backdrop && typeof patch.backdrop === 'object') {
    const b = patch.backdrop
    if (b.mode !== undefined && !BACKDROP_MODES.includes(b.mode)) next.backdrop.mode = cur.backdrop.mode
    if (b.color !== undefined && !normalizeHex(b.color)) next.backdrop.color = cur.backdrop.color
    if (b.color2 !== undefined && !normalizeHex(b.color2)) next.backdrop.color2 = cur.backdrop.color2
    if (b.opacity !== undefined && !finite(b.opacity)) next.backdrop.opacity = cur.backdrop.opacity
  }
  const keys = diffKeys(cur, next)
  if (!keys.length) return []
  S.stores[id] = next
  persist()
  emit({ storeId: id, key: keys.length === 1 ? keys[0] : 'all', keys })
  return keys
}
function onlyValid (colors, cur) {
  const out = {}
  COLOR_KEYS.forEach(k => { if (colors[k] !== undefined) { const h = normalizeHex(colors[k]); if (h) out[k] = h } })
  if (colors.backdrop !== undefined) out.backdrop = colors.backdrop === null ? null : (normalizeHex(colors.backdrop) ?? cur.backdrop)
  return out
}

export function resetSettings (storeId) {
  ensureLoaded()
  const id = storeId ?? currentStoreId()
  const cur = S.stores[id] ?? defaultSettings()
  const next = defaultSettings()
  next.name = cur.name   // "Reset to default" resets the LOOK; the name the user chose stays
  next.layout = cur.layout   // V179: the layout is not part of the colour look either; it stays
  next.anchor = [...cur.anchor]   // V181: nor is the location (use resetAnchor())
  const keys = diffKeys(cur, next)
  if (!keys.length) return []
  S.stores[id] = next
  persist()
  emit({ storeId: id, key: 'all', keys })
  return keys
}

/** V182: ids that have saved settings (a store that was deleted must not leave its settings behind). */
export function savedStoreIds () { ensureLoaded(); return Object.keys(S.stores) }
/** V182: forget a deleted store's settings. */
export function removeStoreSettings (storeId) {
  ensureLoaded()
  if (!idOk(storeId) || !S.stores[storeId]) return false
  delete S.stores[storeId]
  persist()
  return true
}

/** V181: put the store back at the default location ([0, 3, -40]). Returns the changed keys ([] when already there). */
export function resetAnchor (storeId) { return setSettings({ anchor: [...DEFAULT_ANCHOR] }, storeId) }

// ── Presets ─────────────────────────────────────────────────────────────────────

export function getPresets () { ensureLoaded(); return [...BUILTIN_PRESETS.map(clone), ...clone(S.presets)] }
export function getPreset (id) { return getPresets().find(p => p.id === id) ?? null }

export function applyPreset (presetId, storeId) {
  const p = getPreset(presetId)
  if (!p) return []
  return setSettings({ colors: p.colors, backdrop: p.backdrop }, storeId)
}

/** Save the store's CURRENT look as a user preset. Returns the preset, or null (empty name / limit reached). */
export function savePreset (name, storeId) {
  ensureLoaded()
  const nm = String(name ?? '').replace(/<[^>]*>/g, '').replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, LIMITS.presetName)
  if (!nm || S.presets.length >= LIMITS.presets) return null
  const cur = getSettings(storeId)
  let id
  do { id = `user-${Date.now().toString(36)}-${(++seq).toString(36)}` } while (getPreset(id))
  const preset = { id, name: nm, builtin: false, colors: cur.colors, backdrop: cur.backdrop }
  S.presets.push(preset)
  persist()
  emit({ storeId: storeId ?? currentStoreId(), key: 'presets', keys: ['presets'] })
  return clone(preset)
}

export function deletePreset (id) {
  ensureLoaded()
  const i = S.presets.findIndex(p => p.id === id)
  if (i < 0) return false          // built-ins are not in S.presets, so they cannot be deleted
  S.presets.splice(i, 1)
  persist()
  emit({ storeId: currentStoreId(), key: 'presets', keys: ['presets'] })
  return true
}

/** The preset whose look equals the store's current look (so the panel can mark it), or null. */
export function activePresetId (storeId) {
  const cur = getSettings(storeId)
  const same = (p) => COLOR_KEYS.every(k => p.colors[k] === cur.colors[k]) && p.colors.backdrop === cur.colors.backdrop
    && Object.keys(DEFAULT_BACKDROP).every(k => p.backdrop[k] === cur.backdrop[k])
  return getPresets().find(same)?.id ?? null
}

// ── Event input ─────────────────────────────────────────────────────────────────

/** Start listening for omni:store-settings-set (ref-counted: the scene and the panel both call it; detach() undoes one). */
export function attach () {
  attached++
  if (onSet) return
  onSet = (e) => { try { setSettings(e.detail?.patch, e.detail?.storeId) } catch (_) { /* never throw out of a listener */ } }
  window.addEventListener(SET_EVENT, onSet)
}
export function detach () {
  if (attached === 0) return
  attached--
  if (attached === 0 && onSet) { window.removeEventListener(SET_EVENT, onSet); onSet = null }
}
export const _attachedCount = () => attached
