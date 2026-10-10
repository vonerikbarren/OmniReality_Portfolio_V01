/**
 * utils/DevOmniStoreData.js — DevOmniStoreSettings' data (V177). DEV ONLY: for the developer and Claude.
 *
 * CONVENTION: `Dev<System>Settings` = testing / handing over information / trying things; it is NOT part of the user's
 * settings. Nothing user-facing may DEPEND on this module. The only things that read it are the dev panel
 * (ui/DevOmniStoreSettingsPanel.js) and the store scene's per-page count (with a built-in default of 24 when this data is
 * absent or unreadable, so the store works without any dev data).
 *
 * No DOM. localStorage 'omni:dev-store-v1' (versioned, sanitised, try/catch):
 *   records  store-type records (data only for now). {id, name, theme:{colors, backdrop}, layout, productClass, notes}
 *            theme.colors / theme.backdrop = ids of OmniStoreSettings presets (free ids; unknown ones are only flagged).
 *            layout is one of LAYOUTS (V179: shelf, ring, aisle, island all exist). A record does NOT switch the active store (store
 *            types driving layouts = BuildOrder item 6); the dev panel's "Preview layout" applies it temporarily. Record #1 = the produce stand.
 *   types    V182: CUSTOM store types (full records of the schema in utils/OmniStoreTypes.js, validated there; max 12, each up to 200,000 characters), registered with the
 *            shared type registry (Types.registerType) at load so the dev panel can create test stores from them. The key and version stay: `types` is an additive field,
 *            an old save without it loads with no custom types. The built-in types (produce, bakery, electronics, blank) are code, not data here. The V177 `records`
 *            stay as they were (the free-form index of ideas); recordToType() turns one into a type draft. The user's panel never lists custom types.
 *   notes    "Notes for Claude": free text the developer hands over (<= 20000 chars).
 *   perf     { itemsPerPage }  products per shelf page, clamped 6..60 (the scene reads it).
 * Events: omni:dev-store-changed {key}   key = 'records' | 'notes' | 'perf' | 'types'
 */

export const STORAGE_KEY = 'omni:dev-store-v1'
export const VERSION = 1
export const CHANGED_EVENT = 'omni:dev-store-changed'
import { LAYOUT_IDS } from './OmniStoreLayouts.js'   // pure module shared with the user side
import * as Types from './OmniStoreTypes.js'        // V182: the pure type schema + registry (dev EXTENDS it; it never imports this module)
import * as Value from './OmniValueModel.js'         // value type ids for the strict seed check
export const LAYOUTS = [...LAYOUT_IDS]
export const LAYOUTS_BUILT = [...LAYOUT_IDS]   // V179: all four exist
export const PER_PAGE_MIN = 6
export const PER_PAGE_MAX = 60
export const PER_PAGE_DEFAULT = 24
export const LIMITS = { records: 40, name: 60, id: 40, productClass: 40, notes: 2000, claudeNotes: 20000, customTypes: 12, typeChars: 200000 }

let S = null
let loaded = false
let seq = 0

const emit = (key) => { try { window.dispatchEvent(new CustomEvent(CHANGED_EVENT, { detail: { key } })) } catch (_) { /* no window */ } }
const finite = (x) => typeof x === 'number' && Number.isFinite(x)
const idOk = (v) => typeof v === 'string' && /^[A-Za-z0-9_.:-]{1,40}$/.test(v)
const text = (v, max) => String(v ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').slice(0, max)
const clone = (o) => JSON.parse(JSON.stringify(o))

export const clampPerPage = (n) => (finite(+n) ? Math.min(PER_PAGE_MAX, Math.max(PER_PAGE_MIN, Math.round(+n))) : PER_PAGE_DEFAULT)

export function defaultRecords () {
  return [{ id: 'rec-produce', name: 'Produce stand (fruit & veg)', theme: { colors: 'market-wood', backdrop: 'market-wood' }, layout: 'shelf', productClass: 'produce', notes: 'Record #1: the current sandbox store (16 fruit / veg products, 4 identity sections, 3 media lenses).' }]
}

export function sanitizeRecord (raw) {
  if (!raw || typeof raw !== 'object' || !idOk(raw.id)) return null
  const t = raw.theme && typeof raw.theme === 'object' ? raw.theme : {}
  return {
    id: raw.id, name: text(raw.name || raw.id, LIMITS.name),
    theme: { colors: idOk(t.colors) ? t.colors : 'market-wood', backdrop: idOk(t.backdrop) ? t.backdrop : 'market-wood' },
    layout: LAYOUTS.includes(raw.layout) ? raw.layout : 'shelf',
    productClass: text(raw.productClass || 'produce', LIMITS.productClass),
    notes: text(raw.notes, LIMITS.notes),
  }
}

function freshState () { return { records: defaultRecords(), types: [], notes: '', perf: { itemsPerPage: PER_PAGE_DEFAULT } } }
const ensureLoaded = () => { if (!loaded) load() }

export function load () {
  loaded = true
  S = freshState()
  let raw = null
  try { raw = localStorage.getItem(STORAGE_KEY) } catch (_) { return S }
  if (!raw) return S
  let data = null
  try { data = JSON.parse(raw) } catch (_) { return S }
  if (!data || typeof data !== 'object' || data.version !== VERSION) return S
  if (Array.isArray(data.records)) {
    const seen = new Set()
    const recs = data.records.slice(0, LIMITS.records).map(sanitizeRecord).filter(r => r && (seen.has(r.id) ? false : (seen.add(r.id), true)))
    if (recs.length) S.records = recs
  }
  if (Array.isArray(data.types)) {   // V182: custom store types; each is re-validated, a bad one is dropped (never thrown)
    data.types.slice(0, LIMITS.customTypes).forEach(t => {
      const v = Types.validateType(t)
      if (v.ok && !Types.isBuiltin(v.type.id) && !S.types.some(x => x.id === v.type.id) && JSON.stringify(v.type).length <= LIMITS.typeChars) { S.types.push(v.type); Types.registerType(v.type) }
    })
  }
  S.notes = text(data.notes, LIMITS.claudeNotes)
  S.perf.itemsPerPage = clampPerPage(data.perf?.itemsPerPage ?? PER_PAGE_DEFAULT)
  return S
}

function persist () {
  if (!S) return
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: VERSION, ...S })) } catch (_) { /* memory only */ }
}
export function _reset (clear = false) {
  if (clear) { try { localStorage.removeItem(STORAGE_KEY) } catch (_) { /* ignore */ } }
  ;(S?.types ?? []).forEach(t => Types.unregisterType(t.id))   // V182: the registry forgets the custom types too
  S = freshState(); loaded = true; seq = 0
}

// ── Items per page (the knob the scene respects) ────────────────────────────────

export function getItemsPerPage () { ensureLoaded(); return S.perf.itemsPerPage }
export function setItemsPerPage (n) {
  ensureLoaded()
  const v = clampPerPage(n)
  if (v === S.perf.itemsPerPage) return v
  S.perf.itemsPerPage = v
  persist(); emit('perf')
  return v
}

// ── Store type records ──────────────────────────────────────────────────────────

export function getRecords () { ensureLoaded(); return clone(S.records) }
export function saveRecord (raw) {
  ensureLoaded()
  const rec = sanitizeRecord(raw)
  if (!rec) return null
  const i = S.records.findIndex(r => r.id === rec.id)
  if (i >= 0) S.records[i] = rec
  else if (S.records.length >= LIMITS.records) return null
  else S.records.push(rec)
  persist(); emit('records')
  return clone(rec)
}
export function addRecord () {
  ensureLoaded()
  let id
  do { id = `rec-${Date.now().toString(36)}-${(++seq).toString(36)}` } while (S.records.some(r => r.id === id))
  return saveRecord({ id, name: 'New store type', layout: 'shelf', productClass: 'produce', notes: '' })
}
export function deleteRecord (id) {
  ensureLoaded()
  if (S.records.length <= 1) return false   // record #1 (or whichever is last) stays: the list is never empty
  const i = S.records.findIndex(r => r.id === id)
  if (i < 0) return false
  S.records.splice(i, 1)
  persist(); emit('records')
  return true
}
/** Replace the whole list from pasted JSON (array or {records:[...]}). Returns {ok, count, error?}. */
export function setRecordsFromJson (jsonText) {
  let v
  try { v = JSON.parse(String(jsonText ?? '').slice(0, 200000)) } catch (e) { return { ok: false, error: 'Not valid JSON: ' + e.message } }
  const arr = Array.isArray(v) ? v : (v && Array.isArray(v.records) ? v.records : null)
  if (!arr) return { ok: false, error: 'Expected an array of records or {"records":[...]}' }
  const seen = new Set()
  const recs = arr.slice(0, LIMITS.records).map(sanitizeRecord).filter(r => r && (seen.has(r.id) ? false : (seen.add(r.id), true)))
  if (!recs.length) return { ok: false, error: 'No valid record (each needs an id like "rec-bakery")' }
  ensureLoaded()
  S.records = recs
  persist(); emit('records')
  return { ok: true, count: recs.length, dropped: arr.length - recs.length }
}

// ── Custom store types (V182) ───────────────────────────────────────────────────

/** A COPY of the custom (dev-saved) type records. */
export function getCustomTypes () { ensureLoaded(); return clone(S.types) }
/** Built-in types + the custom ones (the dev picker). */
export function allTypes () { ensureLoaded(); return Types.listTypes({ includeExtra: true }) }
/**
 * Validate (strictly: the seed may only use value types of this app) and save a custom type, then register it. A built-in id cannot be replaced.
 * @returns the validation result {ok, type, errors, warnings, seed}
 */
export function saveCustomType (input) {
  ensureLoaded()
  const v = Types.validateType(input, { valueTypes: Value.getTypes() })
  if (!v.ok) return v
  const bad = (m) => ({ ...v, ok: false, type: null, errors: [m] })
  if (Types.isBuiltin(v.type.id)) return bad(`id: "${v.type.id}" is a built-in type and cannot be replaced`)
  if (JSON.stringify(v.type).length > LIMITS.typeChars) return bad(`The type is too large (limit ${LIMITS.typeChars} characters)`)
  const i = S.types.findIndex(t => t.id === v.type.id)
  if (i < 0 && S.types.length >= LIMITS.customTypes) return bad(`At most ${LIMITS.customTypes} custom types; delete one first`)
  if (i >= 0) S.types[i] = v.type; else S.types.push(v.type)
  Types.registerType(v.type)
  persist(); emit('types')
  return v
}
export function deleteCustomType (id) {
  ensureLoaded()
  const i = S.types.findIndex(t => t.id === id)
  if (i < 0) return false
  S.types.splice(i, 1)
  Types.unregisterType(id)
  persist(); emit('types')
  return true
}
/** Pure: turn a V177 record into a type DRAFT (empty catalog) to edit and save. Its colour / backdrop fields were preset ids; they become the type's theme.preset and backdrop.preset. */
export function recordToType (rec) {
  const id = String(rec?.id ?? 'record').replace(/^rec-/, '').replace(/[^A-Za-z0-9_.:-]/g, '-').slice(0, 40) || 'record'
  return {
    schema: Types.TYPE_SCHEMA_ID, id, label: text(rec?.name || id, 40), emoji: '🏬', desc: text(rec?.notes, 200).replace(/[<>]/g, ''),
    layout: LAYOUTS.includes(rec?.layout) ? rec.layout : 'shelf', theme: { preset: rec?.theme?.colors ?? 'market-wood' }, backdrop: { preset: rec?.theme?.backdrop ?? 'market-wood' },
    baseSections: 'wellness', sections: [], categories: [], accepts: [], productClass: text(rec?.productClass || 'general', 24), seed: { products: [] },
  }
}

// ── Notes for Claude ────────────────────────────────────────────────────────────

export function getNotes () { ensureLoaded(); return S.notes }
export function setNotes (t) {
  ensureLoaded()
  const v = text(t, LIMITS.claudeNotes)
  if (v === S.notes) return v
  S.notes = v
  persist(); emit('notes')
  return v
}

/**
 * Compact JSON for pasting to Claude: user store settings + dev records + notes + counts. `extra` = what the caller
 * could measure (live scene stats, store counts). Pure.
 */
export function buildDump ({ settings = null, presets = null, counts = null, scene = null, perf = null, layouts = null, arbitrage = null, stores = null, nodes = null } = {}) {
  ensureLoaded()
  return {
    dump: 'omni-store-dev-dump/1', app: 'OmniOS V185', at: new Date().toISOString(),
    storeSettings: settings, userPresets: presets,
    dev: { records: clone(S.records), customTypes: S.types.map(t => t.id), perf: { itemsPerPage: S.perf.itemsPerPage, ...(perf ?? {}) }, notesForClaude: S.notes },
    counts, scene, layouts, arbitrage, stores, nodes,
  }
}
