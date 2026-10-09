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
 *   notes    "Notes for Claude": free text the developer hands over (<= 20000 chars).
 *   perf     { itemsPerPage }  products per shelf page, clamped 6..60 (the scene reads it).
 * Events: omni:dev-store-changed {key}   key = 'records' | 'notes' | 'perf'
 */

export const STORAGE_KEY = 'omni:dev-store-v1'
export const VERSION = 1
export const CHANGED_EVENT = 'omni:dev-store-changed'
import { LAYOUT_IDS } from './OmniStoreLayouts.js'   // pure module shared with the user side
export const LAYOUTS = [...LAYOUT_IDS]
export const LAYOUTS_BUILT = [...LAYOUT_IDS]   // V179: all four exist
export const PER_PAGE_MIN = 6
export const PER_PAGE_MAX = 60
export const PER_PAGE_DEFAULT = 24
export const LIMITS = { records: 40, name: 60, id: 40, productClass: 40, notes: 2000, claudeNotes: 20000 }

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

function freshState () { return { records: defaultRecords(), notes: '', perf: { itemsPerPage: PER_PAGE_DEFAULT } } }
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
export function buildDump ({ settings = null, presets = null, counts = null, scene = null, perf = null, layouts = null } = {}) {
  ensureLoaded()
  return {
    dump: 'omni-store-dev-dump/1', app: 'OmniReality V179', at: new Date().toISOString(),
    storeSettings: settings, userPresets: presets,
    dev: { records: clone(S.records), perf: { itemsPerPage: S.perf.itemsPerPage, ...(perf ?? {}) }, notesForClaude: S.notes },
    counts, scene, layouts,
  }
}
