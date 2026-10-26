/**
 * utils/OmniStoreModel.js — ⟐OmniStore sandbox: stores (V182: several per identity, one ACTIVE), products, ONE shopping-list model per store (V176)
 *
 * SANDBOX ONLY (see utils/OmniValueModel.js). No DOM; persisted at localStorage 'omni:store-v1'.
 *
 * STORE     V182: {id, ownerId, name, typeId, emoji, baseSections, typeSections?, accepts?, sections, extraSections, products, listItems}; an identity (the id the value
 *           ledger uses) owns up to STORE_LIMITS.perOwner stores and works on ONE active store (activeStoreId / setActiveStore); everything below (products, sections,
 *           the window / wish / cart lists, undo) belongs to the STORE, while the wallet (utils/OmniValueModel.js) stays one global ledger. A store is made from a
 *           TYPE (utils/OmniStoreTypes.js) by createStore(). `sections` = identity sections derived from the real
 *           14 Wellness Dimensions (data/OmniUserWellness.js; there is no "Nutritional" dimension, so produce lives under
 *           Physical, with Life / Social / Emotional as the other food-flavoured lenses) + media-kind lenses
 *           Emoji / Images / Videos (a product shows in a media lens when it carries media of that kind).
 * PRODUCT   {id, name, emoji, category, sectionIds, media:{emoji,image,video,active}, shape:'cube'|'disc', price[], accept?,
 *           stock, valueType:'produce', qualityScale:'ripeness', quality, lifecycle[], reviews[], stats{}}
 *           `price` = the accepted exchange forms (the radial's spokes when BUYING). `accept` = the forms you are willing
 *           to take when SELLING that item (falls back to `price` until edited; saved on the product).
 *           `lifecycle`, `reviews`, `stats` are DATA ONLY in V176 (a later tunnel-style scene reads product.lifecycle).
 * LIST      ONE list model: listItems [{id, productId, qty, state:'window'|'wish'|'cart', chosenForm, declaredIntent}].
 *           window = the browsing / compare reality, wish = wanted, cart = to buy. A product has at most ONE item per
 *           state (adding again updates it); moving an item changes its state in place — if the target state already has
 *           the product the two merge (quantities add), so there are never duplicate copies. compare() sets the window
 *           reality against the cart, totals PER VALUE TYPE (types are never summed together).
 * MEDIA     emoji always exists. image: URL or data URL (<= 512 KB each, <= 1.5 MB of data URLs per store); video: URL ONLY
 *           (a data URL would blow localStorage). setActiveMedia() only accepts a kind the product actually carries.
 *
 * V178: addProduct / updateProduct / removeProduct / duplicateProduct (manual editing; validated by the catalog schema's validateProduct, the
 * SAME rules as an import), importProducts matchBy 'id+name', previewImport(), and a bounded persisted undo snapshot ('omni:store-undo-v1').
 *
 * Events (window): omni:store-changed {kind, storeId?} (kinds incl. V182 active-store, store-create, store-rename, store-delete, store-type); omni:store-active-set {storeId}.
 */

import * as Value from './OmniValueModel.js'
import * as Schema from './OmniStoreCatalogSchema.js'
import { getActiveIdentity } from './OmniIdentity.js'
import { WELLNESS_DIMENSIONS } from '../data/OmniUserWellness.js'
import * as Types from './OmniStoreTypes.js'   // V182: store types as data (pure, user-safe)
import * as Look from './OmniStoreSettings.js'   // V182: per-store look / layout / anchor (a cycle: Settings asks this module for the active store id; both only call each other at run time)

export const STORAGE_KEY = 'omni:store-v1'
export const VERSION = 1
export const CHANGED_EVENT = 'omni:store-changed'
export const MEDIA_KINDS = ['emoji', 'image', 'video']
export const SHAPES = ['cube', 'disc']
export const LIST_STATES = ['window', 'wish', 'cart']
export const IMAGE_MAX_BYTES = 512 * 1024
export const IMAGE_BUDGET_BYTES = 1.5 * 1024 * 1024
// V177: products 200 -> 500 and name 60 -> 80 so the catalog schema's caps (utils/OmniStoreCatalogSchema.js) are never silently cut here
// V181: products 500 -> 3000 (Schema.LIMITS.products; the all-emoji demo is 1,914 products), extraSections 16 (catalog-defined sections, e.g. the 9 Unicode emoji groups)
export const LIMITS = { products: Schema.LIMITS.products, extraSections: 16, listItems: 200, forms: 8, reviews: 20, lifecycle: 12, qty: 9999, name: 80, note: 300 }

let S = null           // { stores:{storeId:store}, section:{storeId:sectionId}, active:{ownerId:storeId} }   (V182: several stores per identity)
let loaded = false
let seq = 0
let degraded = false

/** V182 limits. perOwner / total are checked on createStore (the implicit default store of a new identity is never refused); chars = the serialised state. */
export const STORE_LIMITS = { perOwner: 12, total: 16, loadMax: 64, name: 40, chars: 3000000, warnChars: 2000000 }
export const ACTIVE_EVENT = 'omni:store-active-set'   // window event {storeId}: fired after the active store changed (HUD chip, Stores tab, API)

const emit = (kind, extra = {}) => { try { window.dispatchEvent(new CustomEvent(CHANGED_EVENT, { detail: { kind, ...extra } })) } catch (_) { /* no window */ } }
const finite = (x) => typeof x === 'number' && Number.isFinite(x)
const str = (v, max) => String(v ?? '').slice(0, max)
const idOk = (v) => typeof v === 'string' && /^[A-Za-z0-9_.:-]{1,64}$/.test(v)
const cleanName = (v) => (typeof v === 'string' ? v.replace(/<[^>]*>/g, '').replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, STORE_LIMITS.name) : '')
const mb = (n) => (n / 1e6).toFixed(2)
const ensureLoaded = () => { if (!loaded) load() }

// ── Sections and seed (the seed data lives in utils/OmniStoreTypes.js) ──────────

const DIM = (name) => `dim-${name.toLowerCase()}`
const IDENTITY_SECTIONS = [
  ['Physical', 'Food and nourishment. The closest real Wellness Dimension (there is no Nutritional one).'],
  ['Life', 'Everyday staples.'],
  ['Social', 'Share-at-the-table produce.'],
  ['Emotional', 'Comfort picks.'],
]

/** V181: extra sections a catalog brings (e.g. the emoji groups): [{id, name, desc}]. Untrusted -> clean list (unique ids, never a built-in id, max LIMITS.extraSections). */
export function sanitizeExtraSections (raw) {
  const taken = new Set([...IDENTITY_SECTIONS.map(([d]) => DIM(d)), 'media-emoji', 'media-image', 'media-video'])
  const out = []
  ;(Array.isArray(raw) ? raw : []).forEach(x => {
    if (out.length >= LIMITS.extraSections || !x || typeof x !== 'object' || !idOk(x.id) || taken.has(x.id)) return
    const name = str(typeof x.name === 'string' ? x.name.replace(/[<>\u0000-\u001f]/g, '').trim() : '', 28)
    if (!name) return
    taken.add(x.id)
    out.push({ id: x.id, name, desc: str(typeof x.desc === 'string' ? x.desc.replace(/[<>\u0000-\u001f]/g, '').trim() : '', 160) })
  })
  return out
}

/**
 * Sections of a store: the 4 identity (Wellness) sections when base is 'wellness', the type's own sections, catalog-defined extra sections
 * (V181), then the 3 media lenses. The default produce store is exactly the V181 list.
 */
function buildSections (extra = [], typeSections = [], base = 'wellness') {
  const sections = base === 'none' ? [] : IDENTITY_SECTIONS.map(([dim, desc]) => ({ id: DIM(dim), name: dim, kind: 'identity', filter: { dimension: dim }, desc }))
  typeSections.forEach(x => sections.push({ id: x.id, name: x.name, kind: 'identity', filter: { dimension: x.name }, desc: x.desc ?? '' }))
  extra.forEach(x => sections.push({ id: x.id, name: x.name, kind: 'identity', filter: { dimension: x.name }, desc: x.desc, extra: true }))   // before the media lenses
  sections.push(
    { id: 'media-emoji', name: 'Emoji', kind: 'media', filter: { mediaKind: 'emoji' }, desc: 'Products shown as an emoji.' },
    { id: 'media-image', name: 'Images', kind: 'media', filter: { mediaKind: 'image' }, desc: 'Products that carry an image.' },
    { id: 'media-video', name: 'Videos', kind: 'media', filter: { mediaKind: 'video' }, desc: 'Products that carry a video.' },
  )
  return sections
}
const rebuildSections = (st) => { st.sections = buildSections(st.extraSections ?? [], st.typeSections ?? [], st.baseSections) }

/** The seed products of a built-in or registered type (default 'produce' = the V176-V181 fruit and veg). */
export function buildSeedProducts (typeId = 'produce') { return Types.buildSeedProducts(Types.getType(typeId)) }

function typeAccepts (type) { return (type?.accepts ?? []).filter(a => Value.getType(a)).slice(0, Types.LIMITS.accepts) }

/** A new store from a (validated) type record. Key order matters: after id / typeId / emoji / baseSections the default produce store equals the V181 one. */
function makeStore (id, ownerId, name, type) {
  const ts = (type?.sections ?? []).map(s => ({ id: s.id, name: s.name, desc: s.desc ?? '' }))
  const acc = typeAccepts(type)
  const base = type?.baseSections ?? 'wellness'
  return {
    id, ownerId, name, typeId: type?.id ?? 'produce', emoji: type?.emoji ?? '🥬', baseSections: base,
    ...(ts.length ? { typeSections: ts } : {}), ...(acc.length ? { accepts: acc } : {}),
    sections: buildSections([], ts, base), extraSections: [], products: Types.buildSeedProducts(type), listItems: [],
  }
}

// ── Sanitise ────────────────────────────────────────────────────────────────────

function sanitizeForm (f) {
  if (!f || typeof f !== 'object' || !finite(f.qty) || f.qty <= 0 || f.qty > 1e6) return null
  const t = Value.getType(f.type)
  if (!t) return null
  const out = { type: t.id, qty: f.qty }
  if (f.quality && t.qualityScale.some(s => s.id === f.quality)) out.quality = f.quality
  return out
}
function sanitizeChosen (f) {
  const base = sanitizeForm(f)
  if (!base) return null
  const out = { ...base, channel: null }
  const t = Value.getType(base.type)
  if (f.channel && t.channels.some(c => c.id === f.channel)) out.channel = f.channel
  if (f.payType && Value.getType(f.payType)) out.payType = f.payType
  if (f.payQuality) out.payQuality = str(f.payQuality, 32)
  if (f.split && typeof f.split === 'object') {
    const pt = Value.getType(out.payType ?? out.type)
    const sp = {}
    Object.keys(f.split).forEach(k => { if (pt?.channels.some(c => c.id === k) && finite(f.split[k]) && f.split[k] > 0 && f.split[k] <= 1) sp[k] = f.split[k] })
    if (Object.keys(sp).length) out.split = sp
  }
  return out
}
function sanitizeIntent (i) {
  return i && typeof i === 'object' && typeof i.note === 'string' && i.note.trim() ? { note: str(i.note, Value.LIMITS.note), t: finite(i.t) ? i.t : Date.now() } : null
}

function sanitizeProduct (p) {
  if (!p || typeof p !== 'object' || !idOk(p.id)) return null
  const emoji = str(p.media?.emoji ?? p.emoji ?? '❓', Schema.LIMITS.emoji) || '❓'
  const img = typeof p.media?.image === 'string' && checkImage(p.media.image).ok ? p.media.image : null
  const vid = typeof p.media?.video === 'string' && checkVideo(p.media.video).ok ? p.media.video : null
  const active = MEDIA_KINDS.includes(p.media?.active) && (p.media.active === 'emoji' || (p.media.active === 'image' && img) || (p.media.active === 'video' && vid)) ? p.media.active : 'emoji'
  const forms = (Array.isArray(p.price) ? p.price : []).map(sanitizeForm).filter(Boolean).slice(0, LIMITS.forms)
  const accept = Array.isArray(p.accept) ? p.accept.map(sanitizeForm).filter(Boolean).slice(0, LIMITS.forms) : null
  return {
    id: p.id, name: str(p.name || p.id, LIMITS.name), emoji, category: typeof p.category === 'string' && p.category.trim() && !/[<>]/.test(p.category) ? p.category.trim().slice(0, Schema.LIMITS.category) : Schema.DEFAULT_CATEGORY,
    sectionIds: (Array.isArray(p.sectionIds) ? p.sectionIds : []).filter(idOk).slice(0, 12),
    media: { emoji, image: img, video: vid, active }, shape: SHAPES.includes(p.shape) ? p.shape : 'cube',
    price: forms, accept: accept && accept.length ? accept : null,
    stock: finite(p.stock) && p.stock >= 0 ? Math.min(p.stock, 1e6) : 0,
    ...(typeof p.note === 'string' && p.note ? { note: str(p.note, LIMITS.note) } : {}),   // V177: catalog import keeps the seller's note
    valueType: 'produce', qualityScale: 'ripeness', quality: ['underripe', 'ripe', 'overripe', 'spoiled'].includes(p.quality) ? p.quality : 'ripe',
    lifecycle: (Array.isArray(p.lifecycle) ? p.lifecycle : []).slice(0, LIMITS.lifecycle).filter(l => l && typeof l.stage === 'string')
      .map(l => ({ stage: str(l.stage, 16), title: str(l.title, 60), note: str(l.note, 300), t: finite(l.t) ? l.t : 0 })),
    reviews: (Array.isArray(p.reviews) ? p.reviews : []).slice(0, LIMITS.reviews).filter(r => r && finite(r.rating))
      .map(r => ({ id: str(r.id, 64), user: str(r.user, 40), rating: Math.max(1, Math.min(5, Math.round(r.rating))), text: str(r.text, 300), t: finite(r.t) ? r.t : 0 })),
    stats: {
      purchases: finite(p.stats?.purchases) && p.stats.purchases >= 0 ? p.stats.purchases : 0,
      influence: finite(p.stats?.influence) ? p.stats.influence : 0,
      customerTypes: p.stats?.customerTypes && typeof p.stats.customerTypes === 'object'
        ? Object.fromEntries(Object.entries(p.stats.customerTypes).filter(([k, v]) => typeof k === 'string' && finite(v)).slice(0, 12).map(([k, v]) => [str(k, 24), v])) : {},
    },
  }
}

function sanitizeStore (id, raw) {
  const r = raw && typeof raw === 'object' ? raw : {}
  const typeId = idOk(r.typeId) ? r.typeId : 'produce'        // V176-V181 data has no typeId: it was the produce store
  const type = Types.getType(typeId)
  const base = Types.BASE_SECTIONS.includes(r.baseSections) ? r.baseSections : (type?.baseSections ?? 'wellness')
  const ts = Array.isArray(r.typeSections) ? sanitizeExtraSections(r.typeSections) : sanitizeExtraSections(type?.sections)
  const acc = Array.isArray(r.accepts) ? r.accepts.filter(a => idOk(a) && Value.getType(a)).filter((a, i, l) => l.indexOf(a) === i).slice(0, Types.LIMITS.accepts) : typeAccepts(type)
  const emoji = typeof r.emoji === 'string' && r.emoji.trim() && !/[<>]/.test(r.emoji) ? str(r.emoji.replace(/[\u0000-\u001f]/g, '').trim(), Types.LIMITS.emoji) : (type?.emoji ?? '🏬')
  const extra = sanitizeExtraSections(r.extraSections)   // V181
  const out = {
    id, ownerId: idOk(r.ownerId) ? r.ownerId : id, name: cleanName(r.name) || 'Sandbox store', typeId, emoji, baseSections: base,
    ...(ts.length ? { typeSections: ts } : {}), ...(acc.length ? { accepts: acc } : {}),
    sections: buildSections(extra, ts, base), extraSections: extra, products: [], listItems: [],
  }
  const products = (Array.isArray(r.products) ? r.products : []).slice(0, LIMITS.products).map(sanitizeProduct).filter(Boolean)
  const ids = new Set()
  out.products = products.filter(p => (ids.has(p.id) ? false : (ids.add(p.id), true)))
  // V178: a store the user emptied on purpose stays empty; only a missing / unusable product list is re-seeded (V182: from the store's OWN type; an unknown type has no seed)
  if (!out.products.length && !(Array.isArray(r.products) && r.products.length === 0)) out.products = type ? Types.buildSeedProducts(type) : []
  const pid = new Set(out.products.map(p => p.id))
  const seen = new Set()
  out.listItems = (Array.isArray(r.listItems) ? r.listItems : []).slice(0, LIMITS.listItems).filter(it => it && idOk(it.id) && pid.has(it.productId) && LIST_STATES.includes(it.state) && finite(it.qty) && it.qty > 0)
    .filter(it => { const k = it.productId + '|' + it.state; return seen.has(k) ? false : (seen.add(k), true) })
    .map(it => ({ id: it.id, productId: it.productId, qty: Math.min(it.qty, LIMITS.qty), state: it.state, chosenForm: sanitizeChosen(it.chosenForm), declaredIntent: sanitizeIntent(it.declaredIntent) }))
  return out
}

// ── Load / persist ──────────────────────────────────────────────────────────────

/**
 * V182: `omni:store-v1` stays version 1; the new fields are additive. {stores:{storeId:store}, section:{storeId:sectionId}, active:{ownerId:storeId}}.
 * V176-V181 data (no `active`, stores without typeId) loads as ONE produce store per identity whose id is the identity id. Nothing is rewritten until the next save.
 */
export function load () {
  loaded = true
  S = { stores: {}, section: {}, active: {} }
  let raw = null
  try { raw = localStorage.getItem(STORAGE_KEY) } catch (_) { return S }
  if (!raw) return S
  let data = null
  try { data = JSON.parse(raw) } catch (_) { return S }
  if (!data || data.version !== VERSION || typeof data.stores !== 'object' || !data.stores) return S
  Object.keys(data.stores).slice(0, STORE_LIMITS.loadMax).forEach(id => { if (idOk(id)) S.stores[id] = sanitizeStore(id, data.stores[id]) })
  if (data.section && typeof data.section === 'object') Object.keys(data.section).forEach(k => { if (idOk(k) && typeof data.section[k] === 'string') S.section[k] = data.section[k] })
  if (data.active && typeof data.active === 'object') Object.keys(data.active).forEach(o => { const sid = data.active[o]; if (idOk(o) && idOk(sid) && S.stores[sid]?.ownerId === o) S.active[o] = sid })   // a pointer to somebody else's store is ignored
  return S
}

function persist () {
  if (!S) return
  const body = (strip) => JSON.stringify({
    version: VERSION, section: S.section, active: S.active,
    stores: strip ? Object.fromEntries(Object.entries(S.stores).map(([k, st]) => [k, { ...st, products: st.products.map(p => ({ ...p, media: { ...p.media, image: null, active: p.media.active === 'image' ? 'emoji' : p.media.active } })) }])) : S.stores,
  })
  try { localStorage.setItem(STORAGE_KEY, body(false)); degraded = false } catch (_) {
    try { localStorage.setItem(STORAGE_KEY, body(true)); degraded = true } catch (__) { /* storage unavailable: memory only */ }
  }
}
/** True when the last save had to drop image data URLs because the browser quota was full. */
export const isDegraded = () => degraded
export const flush = () => { ensureLoaded(); persist() }
function changed (kind, extra) { persist(); emit(kind, extra) }
export function _reset (clear = false) {
  if (clear) { try { localStorage.removeItem(STORAGE_KEY) } catch (_) { /* ignore */ } }
  S = { stores: {}, section: {}, active: {} }; loaded = true; seq = 0; degraded = false
  undoMem = null; undoRead = false   // the memory copy is forgotten; the stored copy is cleared with `clear`
  if (clear) { try { localStorage.removeItem('omni:store-undo-v1') } catch (_) { /* ignore */ } }
}

// ── Store access (V182: the ACTIVE store of the current identity) ────────────────

export function currentOwnerId () { return Value.currentAccountId() }
const ownerStores = (owner) => Object.values(S.stores).filter(s => s.ownerId === owner)
const newStoreId = () => { let id; do { id = `st-${Date.now().toString(36)}${(seq++).toString(36)}` } while (S.stores[id]); return id }

/** An identity always has at least one store: the first keeps the identity id as its store id (so V176-V181 data, store settings and section maps still match). */
function ensureOwner (owner) {
  if (ownerStores(owner).length) return
  let nm = 'Sandbox store'
  try { const ident = getActiveIdentity(); if (ident && ident.id === owner) nm = cleanName(`${ident.name}'s store`) || nm } catch (_) { /* ignore */ }
  const id = S.stores[owner] ? newStoreId() : owner
  S.stores[id] = makeStore(id, owner, nm, Types.getType('produce'))
  persist()
}

/** Id of the store the scene and every panel work on (persisted per identity in `active`; falls back to the identity's first store). */
export function activeStoreId () {
  ensureLoaded()
  const owner = currentOwnerId()
  ensureOwner(owner)
  const a = S.active[owner]
  if (a && S.stores[a]?.ownerId === owner) return a
  return S.stores[owner]?.ownerId === owner ? owner : ownerStores(owner)[0].id
}

/** The active store (no argument), or the store with that id (null when there is none). A bare identity id with no store yet still creates its default store, like V176-V181. */
export function getStore (id) {
  ensureLoaded()
  if (id === undefined || id === null) return S.stores[activeStoreId()]
  if (S.stores[id]) return S.stores[id]
  if (idOk(id) && !id.startsWith('st-') && !ownerStores(id).length) { ensureOwner(id); return S.stores[id] ?? null }
  return null
}
/** V183: read-only lookup of a store of the CURRENT identity by id; null when there is none. Never creates a store (getStore(id) can, for a bare id). Used by the StoreItemNode reference. */
export function peekStore (id) {
  ensureLoaded()
  if (!idOk(id)) return null
  const st = S.stores[id]
  return st && st.ownerId === currentOwnerId() ? st : null
}
export const getSections = () => getStore().sections
export const getSection = (id) => getStore().sections.find(s => s.id === id) ?? null
export const getProducts = () => getStore().products
export const getProduct = (id) => getStore().products.find(p => p.id === id) ?? null
export const WELLNESS = WELLNESS_DIMENSIONS

export function getCurrentSectionId () {
  const st = getStore()
  const want = S.section[st.id]
  return st.sections.some(s => s.id === want) ? want : st.sections[0].id
}
export function setCurrentSection (id) {
  const st = getStore()
  if (!st.sections.some(s => s.id === id)) return false
  S.section[st.id] = id
  changed('section')
  return true
}

/** The product with this id in ANY store of the current identity (the wallet's inventory is global; the shelf is not). Null if none. */
export function findProductAnywhere (productId) {
  ensureLoaded()
  const act = getStore()
  const hit = act.products.find(p => p.id === productId)
  if (hit) return hit
  for (const st of ownerStores(currentOwnerId())) { const p = st.products.find(x => x.id === productId); if (p) return p }
  return null
}

export function displayName (storeId) { ensureLoaded(); return S.stores[storeId]?.name ?? '' }

// ── Several stores (V182, BuildOrder item 6) ────────────────────────────────────

/** Stores of the current identity: [{id, name, typeId, typeLabel, emoji, layout, anchor, products, lists, active, chars?}] (creation order). */
export function listStores ({ sizes = false } = {}) {
  ensureLoaded()
  const owner = currentOwnerId()
  const act = activeStoreId()
  return ownerStores(owner).map(st => {
    const set = Look.getSettings(st.id)
    const row = { id: st.id, ownerId: st.ownerId, name: st.name, typeId: st.typeId, typeLabel: Types.getType(st.typeId)?.label ?? st.typeId, emoji: st.emoji, layout: set.layout, anchor: [...set.anchor], products: st.products.length, lists: st.listItems.length, active: st.id === act }
    if (sizes) row.chars = JSON.stringify(st).length
    return row
  })
}

/** Serialised size of the stored state: {total, max, warnAt, count, byStore:{id:chars}}. */
export function storageStats () {
  ensureLoaded()
  const byStore = {}
  let total = 80 + JSON.stringify(S.section).length + JSON.stringify(S.active).length
  Object.entries(S.stores).forEach(([k, st]) => { const n = JSON.stringify(st).length; byStore[k] = n; total += n + k.length + 4 })
  return { total, max: STORE_LIMITS.chars, warnAt: STORE_LIMITS.warnChars, count: Object.keys(S.stores).length, byStore }
}

/** Write a type's layout, theme colours and backdrop (and optionally name / anchor) into a store's settings. Pushes plain-language problems into `warnings`. */
function writeLook (storeId, type, { name = undefined, anchor = undefined } = {}, warnings = []) {
  const th = type.theme ?? {}
  const preset = th.preset ? Look.getPreset(th.preset) : null
  if (th.preset && !preset) warnings.push(`Look preset "${String(th.preset).replace(/[<>]/g, '').slice(0, 30)}" not found; the default look was used.`)
  const colors = { ...(preset?.colors ?? {}), ...(th.colors ?? {}) }
  const bd = { ...(preset?.backdrop ?? {}) }
  const tb = type.backdrop
  if (tb) {
    if (tb.preset) { const bp = Look.getPreset(tb.preset); if (bp) Object.assign(bd, bp.backdrop); else warnings.push(`Backdrop preset "${String(tb.preset).replace(/[<>]/g, '').slice(0, 30)}" not found.`) }
    ;['mode', 'color', 'color2', 'opacity'].forEach(k => { if (tb[k] !== undefined) bd[k] = tb[k] })
  }
  const patch = { colors, backdrop: bd, layout: type.layout }
  if (name !== undefined) patch.name = name
  if (anchor !== undefined) patch.anchor = anchor
  Look.setSettings(patch, storeId)
}

/**
 * Create a store from a type: sections, seed products (validated by the type validator, the same rules as a catalog import), accepted forms; writes the type's
 * layout, colours, backdrop and the store name into THIS store's settings and gives it its OWN anchor (the next free place on the grid, never within
 * Look.STORE_SPACING of another store; `opts.anchor` overrides, clamped, with a warning when it overlaps). Each call makes a NEW store;
 * createStoreFromType() adds the "same id returns the existing store" rule.
 * @param {{typeId?:string, type?:object, name?:string, anchor?:number[], activate?:boolean, id?:string}} opts  typeId = a built-in / registered type; type = a record (validated here); id = a fixed store id
 * @returns {{ok:true, id, storeId, store, warnings:string[], errors:[]}|{ok:false, error, errors:string[], warnings:string[]}}
 */
export function createStore (opts = {}) {
  ensureLoaded()
  const warnings = []
  const fail = (m) => ({ ok: false, error: m, errors: [m], warnings })
  let type = null
  if (opts.type !== undefined && opts.type !== null) {
    const v = Types.validateType(opts.type, { valueTypes: Value.getTypes() })
    if (!v.ok) return fail('That store type is not valid: ' + (v.errors[0] ?? 'unknown problem'))
    type = v.type; v.warnings.forEach(w => warnings.push(w))
  } else {
    const tid = typeof opts.typeId === 'string' ? opts.typeId : 'blank'
    type = Types.getType(tid)
    if (!type) return fail(`Unknown store type "${tid.replace(/[<>]/g, '').slice(0, 40)}".`)
  }
  const owner = currentOwnerId()
  ensureOwner(owner)
  if (ownerStores(owner).length >= STORE_LIMITS.perOwner) return fail(`You already have the maximum of ${STORE_LIMITS.perOwner} stores. Delete one first.`)
  if (Object.keys(S.stores).length >= STORE_LIMITS.total) return fail(`This device already holds the maximum of ${STORE_LIMITS.total} stores in all. Delete one first.`)
  if (opts.id !== undefined && opts.id !== null && (!idOk(opts.id) || S.stores[opts.id])) return fail('That store id is not valid or is already used.')
  const id = opts.id ?? newStoreId()
  const name = cleanName(opts.name) || cleanName(type.label) || 'New store'
  const st = makeStore(id, owner, name, type)
  const used = storageStats().total, add = JSON.stringify(st).length + 200
  if (used + add > STORE_LIMITS.chars) return fail(`Not enough room on this device for another store (${mb(used)} MB of ${mb(STORE_LIMITS.chars)} MB used). Delete a store or some products first.`)
  if (used + add > STORE_LIMITS.warnChars) warnings.push(`${mb(used + add)} MB of the ${(STORE_LIMITS.chars / 1e6).toFixed(0)} MB limit is used by your stores now.`)
  // where it stands: its own place, never on top of another store
  const others = ownerStores(owner).map(s => ({ name: s.name, a: Look.getSettings(s.id).anchor }))
  let anchor
  if (Array.isArray(opts.anchor)) {
    anchor = Look.normalizeAnchor(opts.anchor)
    const near = others.find(o => Math.hypot(o.a[0] - anchor[0], o.a[1] - anchor[1], o.a[2] - anchor[2]) < Look.STORE_SPACING)
    if (near) warnings.push(`This store is closer than ${Look.STORE_SPACING} units to "${near.name}" and may overlap it.`)
  } else {
    anchor = Look.nextFreeAnchor(others.map(o => o.a))
    if (!anchor) { anchor = [...Look.DEFAULT_ANCHOR]; warnings.push('No free place is left on the grid; the store was put at the default place and may overlap another.') }
  }
  S.stores[id] = st
  try { writeLook(id, type, { name, anchor }, warnings) } catch (e) { warnings.push('The look could not be written: ' + String(e?.message ?? e).slice(0, 80)) }
  if (opts.activate) S.active[owner] = id
  persist()
  emit('store-create', { storeId: id })
  if (opts.activate) { emit('active-store', { storeId: id }); fireActive(id) }
  return { ok: true, id, storeId: id, store: st, warnings, errors: [] }
}

/**
 * The BuildOrder item 6 entry point: create a store from a type id. With `ownerId` that id becomes the new store's id, so calling again with the same
 * ownerId returns the existing store ({existing:true}) and never a duplicate; without it every call creates a new store.
 * @returns {{ok:boolean, storeId:string|null, existing?:boolean, warnings?:string[], error?:string}}
 */
export function createStoreFromType (typeId, { ownerId = null, name = undefined, anchor = undefined, activate = false } = {}) {
  ensureLoaded()
  const fixed = ownerId !== null && ownerId !== undefined
  if (fixed) {
    if (!idOk(ownerId)) return { ok: false, storeId: null, error: 'The store id is not valid (1-64 letters, digits and _ . : -).' }
    const have = S.stores[ownerId]
    if (have) return have.ownerId === currentOwnerId() ? { ok: true, storeId: have.id, existing: true } : { ok: false, storeId: null, error: 'That id belongs to another identity.' }
  }
  const r = createStore({ typeId, name, anchor, activate, ...(fixed ? { id: ownerId } : {}) })
  return r.ok ? { ok: true, storeId: r.id, existing: false, warnings: r.warnings } : { ok: false, storeId: null, error: r.error }
}

function fireActive (storeId) { try { window.dispatchEvent(new CustomEvent(ACTIVE_EVENT, { detail: { storeId } })) } catch (_) { /* no window */ } }

/** Make a store of the current identity the active one. Returns false for an unknown id or somebody else's store; true (and no event) when it already is active. */
export function setActiveStore (id) {
  ensureLoaded()
  if (!idOk(id)) return false
  const owner = currentOwnerId()
  const st = S.stores[id]
  if (!st || st.ownerId !== owner) return false
  if (activeStoreId() === id) return true
  S.active[owner] = id
  persist()
  emit('active-store', { storeId: id })
  fireActive(id)
  return true
}

/** Rename a store (and its HUD title). Markup is stripped; empty / unknown -> false. */
export function renameStore (id, name) {
  ensureLoaded()
  const st = idOk(id) ? S.stores[id] : null
  const nm = cleanName(name)
  if (!st || st.ownerId !== currentOwnerId() || !nm) return false
  st.name = nm
  Look.setSettings({ name: nm }, id)
  changed('store-rename', { storeId: id })
  return true
}

/** Delete a store, its settings and its undo. The LAST store of an identity cannot be deleted. Deleting the active store switches to another one. */
export function deleteStore (id) {
  ensureLoaded()
  const owner = currentOwnerId()
  const st = idOk(id) ? S.stores[id] : null
  if (!st || st.ownerId !== owner) return { ok: false, error: 'That store does not exist.' }
  ensureOwner(owner)
  const own = ownerStores(owner)
  if (own.length <= 1) return { ok: false, error: 'You cannot delete your last store.' }
  const wasActive = activeStoreId() === id
  delete S.stores[id]; delete S.section[id]
  Look.removeStoreSettings(id)
  const u = readUndo(); if (u?.snap?.storeId === id) clearUndo()
  let switchedTo = null
  if (wasActive) { switchedTo = own.find(s => s.id !== id).id; S.active[owner] = switchedTo } else if (S.active[owner] === id) delete S.active[owner]
  persist()
  emit('store-delete', { storeId: id })
  if (switchedTo) { emit('active-store', { storeId: switchedTo }); fireActive(switchedTo) }
  return { ok: true, switchedTo }
}

/** Give a store the look and the accepted forms of another type (layout, colours, backdrop, type id, emoji). Products and sections stay. */
export function applyTypeLook (storeId, typeId) {
  ensureLoaded()
  const st = idOk(storeId) ? S.stores[storeId] : null
  const type = typeof typeId === 'string' ? Types.getType(typeId) : null
  if (!st || st.ownerId !== currentOwnerId()) return { ok: false, error: 'That store does not exist.' }
  if (!type) return { ok: false, error: 'Unknown store type.' }
  const warnings = []
  writeLook(storeId, type, {}, warnings)
  st.typeId = type.id; st.emoji = type.emoji
  const acc = typeAccepts(type)
  if (acc.length) st.accepts = acc; else delete st.accepts
  changed('store-type', { storeId })
  return { ok: true, warnings }
}

// ── Accepted forms (V182) ───────────────────────────────────────────────────────

/** The value types a store takes as payment; [] = all. */
export function storeAccepts (storeId) { ensureLoaded(); const st = storeId ? S.stores[storeId] : getStore(); return st?.accepts?.length ? [...st.accepts] : [] }
export function acceptsForm (valueTypeId, storeId) { const a = storeAccepts(storeId); return !a.length || a.includes(valueTypeId) }
/** Plain-language reason a form is refused, or '' when it is fine. */
export function formRefusal (valueTypeId, storeId) {
  if (acceptsForm(valueTypeId, storeId)) return ''
  const st = storeId ? S.stores[storeId] : getStore()
  const nm = (id) => Value.getType(id)?.name ?? id
  return `${st?.name ?? 'This store'} does not take ${nm(valueTypeId)}. It takes: ${storeAccepts(storeId).map(nm).join(', ')}.`
}
/** The price forms of a product that this store takes (the buy spokes). */
export function buyForms (productId) { const p = getProduct(productId); if (!p) return []; return storeAccepts().length ? p.price.filter(f => acceptsForm(f.type)) : p.price }

export function hasMedia (p, kind) {
  if (kind === 'emoji') return !!p.media.emoji
  if (kind === 'image') return !!p.media.image
  if (kind === 'video') return !!p.media.video
  return false
}
/** Products shown by a section: identity -> membership; media lens -> carries that kind of media. */
export function productsFor (sectionId) {
  const st = getStore()
  const sec = st.sections.find(s => s.id === (sectionId ?? getCurrentSectionId()))
  if (!sec) return []
  if (sec.kind === 'media') return st.products.filter(p => hasMedia(p, sec.filter.mediaKind))
  return st.products.filter(p => p.sectionIds.includes(sec.id))
}
/** The forms you are willing to take when SELLING this product (saved on the product, else its price), limited to what this store's type takes (V182). */
export function acceptForms (productId) { const p = getProduct(productId); if (!p) return []; const src = p.accept ?? p.price; return storeAccepts().length ? src.filter(f => acceptsForm(f.type)) : src }

// ── Media ───────────────────────────────────────────────────────────────────────

const URL_RE = /^(https?:\/\/[^\s"'<>]{1,2000}|\.{0,2}\/[^\s:"'<>]{1,2000}|assets\/[^\s:"'<>]{1,2000})$/
const DATA_IMG_RE = /^data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/]+=*$/
export const dataUrlBytes = (u) => { const i = u.indexOf(','); return Math.floor((u.length - i - 1) * 3 / 4) }

export function checkImage (v) {
  if (typeof v !== 'string' || !v) return { ok: false, error: 'empty' }
  if (v.startsWith('data:')) {
    if (!DATA_IMG_RE.test(v)) return { ok: false, error: 'bad-data-url' }
    if (dataUrlBytes(v) > IMAGE_MAX_BYTES) return { ok: false, error: 'image-too-large' }
    return { ok: true, kind: 'data' }
  }
  return URL_RE.test(v) ? { ok: true, kind: 'url' } : { ok: false, error: 'bad-url' }
}
export function checkVideo (v) {
  if (typeof v !== 'string' || !v) return { ok: false, error: 'empty' }
  if (v.startsWith('data:')) return { ok: false, error: 'video-url-only' }
  return URL_RE.test(v) ? { ok: true, kind: 'url' } : { ok: false, error: 'bad-url' }
}
function dataBudgetUsed (st, exceptId) {
  return st.products.reduce((s, p) => s + (p.id !== exceptId && p.media.image && p.media.image.startsWith('data:') ? dataUrlBytes(p.media.image) : 0), 0)
}

/** Attach media of a kind to a product (does not change the active kind). */
export function setMedia (productId, kind, value) {
  const p = getProduct(productId)
  if (!p) return { ok: false, error: 'unknown-product' }
  if (kind === 'emoji') {
    const v = str(value, 16).trim()
    if (!v) return { ok: false, error: 'empty' }
    p.media.emoji = v; p.emoji = v
  } else if (kind === 'image') {
    const c = checkImage(value)
    if (!c.ok) return c
    if (c.kind === 'data' && dataBudgetUsed(getStore(), productId) + dataUrlBytes(value) > IMAGE_BUDGET_BYTES) return { ok: false, error: 'store-image-budget' }
    p.media.image = value
  } else if (kind === 'video') {
    const c = checkVideo(value)
    if (!c.ok) return c
    p.media.video = value
  } else return { ok: false, error: 'unknown-kind' }
  changed('media')
  return { ok: true }
}
/** Drop image / video media (emoji cannot be removed). If it was active the product falls back to emoji. */
export function clearMedia (productId, kind) {
  const p = getProduct(productId)
  if (!p || (kind !== 'image' && kind !== 'video')) return false
  p.media[kind] = null
  if (p.media.active === kind) p.media.active = 'emoji'
  changed('media')
  return true
}
/** Switch which media kind a product shows. Valid only when the product has media of that kind. */
export function setActiveMedia (productId, kind) {
  const p = getProduct(productId)
  if (!p || !MEDIA_KINDS.includes(kind) || !hasMedia(p, kind)) return false
  if (p.media.active === kind) return true
  p.media.active = kind
  changed('media')
  return true
}
export function setShape (productId, shape) {
  const p = getProduct(productId)
  if (!p || !SHAPES.includes(shape)) return false
  p.shape = shape
  changed('shape')
  return true
}
/** Edit the forms you are willing to accept when SELLING this product (kept on the product). */
export function setAcceptForms (productId, forms) {
  const p = getProduct(productId)
  if (!p || !Array.isArray(forms)) return false
  const clean = forms.map(sanitizeForm).filter(Boolean).slice(0, LIMITS.forms)
  if (!clean.length) return false
  p.accept = clean
  changed('accept')
  return true
}

// ── Pricing helpers ─────────────────────────────────────────────────────────────

/** The form an item pays: its chosen form, else the product's first accepted price form. */
export function formFor (item) {
  const p = getProduct(item.productId)
  const f = p ? (p.price.find(x => acceptsForm(x.type)) ?? p.price[0]) : null   // V182: the first form this store's type takes
  return item.chosenForm ?? (f ? { ...f } : null)
}
/** Totals PER VALUE TYPE for a set of list items (qty x form qty). Types are never summed together. */
export function totalsFor (items) {
  const t = {}
  items.forEach(it => { const f = formFor(it); if (f) t[f.type] = Value.clean((t[f.type] ?? 0) + f.qty * it.qty) })
  return t
}

// ── ONE list model ──────────────────────────────────────────────────────────────

export const getList = (state) => getStore().listItems.filter(it => !state || it.state === state)
export const getItem = (id) => getStore().listItems.find(it => it.id === id) ?? null
export const getItemFor = (productId, state) => getStore().listItems.find(it => it.productId === productId && it.state === state) ?? null

/** Add (or update) the product's item in `state`. opts: {qty, chosenForm, declaredIntent, add:boolean (qty adds instead of replaces)} */
export function addToList (productId, state, opts = {}) {
  const st = getStore()
  const p = getProduct(productId)
  if (!p || !LIST_STATES.includes(state)) return null
  const qty = Math.max(1, Math.min(LIMITS.qty, Math.round(Number(opts.qty ?? 1)) || 1))
  let it = getItemFor(productId, state)
  if (!it) {
    if (st.listItems.length >= LIMITS.listItems) return null
    it = { id: `li${Date.now().toString(36)}${(seq++).toString(36)}`, productId, qty, state, chosenForm: null, declaredIntent: null }
    st.listItems.push(it)
  } else it.qty = opts.add ? Math.min(LIMITS.qty, it.qty + qty) : qty
  if (opts.chosenForm !== undefined) it.chosenForm = sanitizeChosen(opts.chosenForm)
  if (opts.declaredIntent !== undefined) it.declaredIntent = sanitizeIntent(opts.declaredIntent)
  changed('list')
  return it
}
/** Move an item to another state in place. If the target state already has that product the two merge (qty adds). */
export function moveItem (itemId, state) {
  const st = getStore()
  const it = getItem(itemId)
  if (!it || !LIST_STATES.includes(state)) return null
  if (it.state === state) return it
  const twin = getItemFor(it.productId, state)
  if (twin) {
    twin.qty = Math.min(LIMITS.qty, twin.qty + it.qty)
    twin.chosenForm = twin.chosenForm ?? it.chosenForm
    twin.declaredIntent = twin.declaredIntent ?? it.declaredIntent
    st.listItems = st.listItems.filter(x => x !== it)
    changed('list')
    return twin
  }
  it.state = state
  changed('list')
  return it
}
export function setItemQty (itemId, qty) {
  const it = getItem(itemId)
  const n = Math.round(Number(qty))
  if (!it || !finite(n) || n < 1) return false
  it.qty = Math.min(n, LIMITS.qty)
  changed('list')
  return true
}
export function setItemForm (itemId, form) {
  const it = getItem(itemId)
  if (!it) return false
  it.chosenForm = sanitizeChosen(form)
  changed('list')
  return true
}
export function setItemIntent (itemId, intent) {
  const it = getItem(itemId)
  if (!it) return false
  it.declaredIntent = sanitizeIntent(intent)
  changed('list')
  return true
}
export function removeItem (itemId) {
  const st = getStore()
  const n = st.listItems.length
  st.listItems = st.listItems.filter(it => it.id !== itemId)
  if (st.listItems.length !== n) { changed('list'); return true }
  return false
}

/** Window reality vs cart: per product rows plus totals per value type. */
export function compare () {
  const win = getList('window'), cart = getList('cart')
  const ids = []
  ;[...win, ...cart].forEach(it => { if (!ids.includes(it.productId)) ids.push(it.productId) })
  const same = (a, b) => a && b && a.qty === b.qty && JSON.stringify(formFor(a)) === JSON.stringify(formFor(b))
  const rows = ids.map(pid => {
    const w = win.find(i => i.productId === pid) ?? null, c = cart.find(i => i.productId === pid) ?? null
    const p = getProduct(pid)
    return { productId: pid, name: p?.name ?? pid, emoji: p?.emoji ?? '', window: w ? { qty: w.qty, form: formFor(w) } : null, cart: c ? { qty: c.qty, form: formFor(c) } : null,
      status: w && c ? (same(w, c) ? 'same' : 'differs') : (w ? 'window-only' : 'cart-only') }
  })
  const tw = totalsFor(win), tc = totalsFor(cart)
  const delta = {}
  new Set([...Object.keys(tw), ...Object.keys(tc)]).forEach(k => { delta[k] = Value.clean((tc[k] ?? 0) - (tw[k] ?? 0)) })
  return { rows, totals: { window: tw, cart: tc }, delta }
}

// ── Buying / selling through the ledger ─────────────────────────────────────────

/** Work out the value-model offer / want for an item (or an ad-hoc {productId, qty, chosenForm}). */
export function planPurchase ({ productId, qty = 1, chosenForm = null, payQty: payQtyOverride = null }, opts = {}) {
  const p = getProduct(productId)
  if (!p) return { ok: false, error: 'unknown-product' }
  const first = p.price.find(f => acceptsForm(f.type))   // V182: the default form is the first one this store's type takes
  const form = sanitizeChosen(chosenForm) ?? (first ? { ...first } : null)
  if (!form) return { ok: false, error: p.price[0] ? 'form-not-accepted' : 'no-price-form', message: p.price[0] ? formRefusal(p.price[0].type) : 'This product has no price.', product: p }
  const refusal = formRefusal(form.payType ?? form.type)   // the store takes payment only in the forms of its type (V182)
  if (refusal) return { ok: false, error: 'form-not-accepted', message: refusal, product: p }
  const n = Math.max(1, Math.round(Number(qty)) || 1)
  if (p.stock < n) return { ok: false, error: 'out-of-stock', product: p }
  const want = { type: form.type, qty: Value.clean(form.qty * n), quality: form.quality }
  const payType = form.payType ?? form.type
  const payQuality = form.payQuality ?? (payType === form.type ? form.quality : undefined)
  let payQty = Value.clean(form.qty * n)
  if (payType !== form.type || payQuality !== form.quality) {
    // paying in another type or grade: ask the value model how much of it covers the want
    const probe = Value.quote({ type: payType, qty: 1, quality: payQuality }, want, opts)
    payQty = probe.offerNeeded?.qty ?? payQty
  }
  if (finite(payQtyOverride) && payQtyOverride > 0) payQty = payQtyOverride   // an explicit amount typed in the exchange panel (overpaying leaves a STATED remainder)
  const split = form.split ? Value.sharesToSplit(payType, payQty, form.split) : (form.channel ? { [form.channel]: payQty } : undefined)
  const offer = { type: payType, qty: payQty, quality: payQuality, split }
  const qt = Value.quote(offer, want, opts)
  return { ok: true, product: p, qty: n, form, offer, want, quote: qt }
}

function settlePurchase (plan, intent, opts) {
  const res = Value.buy({ itemId: plan.product.id, itemName: plan.product.name, itemQty: plan.qty, offer: plan.offer, want: plan.want, declaredIntent: intent, applyRemainder: !!opts.applyRemainder })
  if (res.ok) {
    const p = plan.product
    p.stock = Math.max(0, p.stock - plan.qty)
    p.stats.purchases += plan.qty
    let who = 'visitors'
    try { who = getActiveIdentity()?.name ? str(getActiveIdentity().name, 24) : 'sandbox' } catch (_) { who = 'sandbox' }
    p.stats.customerTypes[who] = (p.stats.customerTypes[who] ?? 0) + plan.qty
    changed('purchase')
  }
  return res
}

/** Buy one product now (not via the list). */
export function buyNow (productId, { qty = 1, chosenForm = null, declaredIntent = null, applyRemainder = false, payQty = null } = {}) {
  const plan = planPurchase({ productId, qty, chosenForm, payQty }, { applyRemainder })
  if (!plan.ok) return plan
  return settlePurchase(plan, sanitizeIntent(declaredIntent), { applyRemainder })
}

/** Execute the whole cart through the ledger. All-or-nothing on balance: per-type debits are summed first. */
export function checkout ({ applyRemainder = false } = {}) {
  const items = getList('cart')
  if (!items.length) return { ok: false, error: 'cart-empty', receipts: [] }
  const plans = []
  for (const it of items) {
    const plan = planPurchase({ productId: it.productId, qty: it.qty, chosenForm: formFor(it) }, { applyRemainder })
    if (!plan.ok) return { ok: false, error: plan.error, item: it, receipts: [] }
    if (!plan.quote.covers) return { ok: false, error: 'not-covered', item: it, quote: plan.quote, receipts: [] }
    if (!plan.quote.splitOk) return { ok: false, error: 'split-invalid', item: it, quote: plan.quote, receipts: [] }
    plans.push({ it, plan })
  }
  const need = {}
  plans.forEach(({ plan }) => { need[plan.quote.offer.type] = Value.clean((need[plan.quote.offer.type] ?? 0) + plan.quote.debit) })
  const short = {}
  Object.keys(need).forEach(k => { const have = Value.getBalance(k); if (have + Value.EPS < need[k]) short[k] = { need: need[k], have } })
  if (Object.keys(short).length) return { ok: false, error: 'insufficient-balance', short, receipts: [] }
  const receipts = []
  for (const { it, plan } of plans) {
    const res = settlePurchase(plan, it.declaredIntent, { applyRemainder })
    if (!res.ok) return { ok: false, error: res.error, item: it, receipts }
    receipts.push(res.tx)
    removeItem(it.id)
  }
  return { ok: true, receipts, spent: need }
}

/** SELL mode: hand an item from your inventory to the store for one of your accepted forms. */
export function sellNow (productId, { qty = 1, form = null, split = null, declaredIntent = null } = {}) {
  const p = getProduct(productId)
  if (!p) return { ok: false, error: 'unknown-product' }
  const f = sanitizeForm(form) ?? acceptForms(productId)[0]
  const refusal = f ? formRefusal(f.type) : ''
  if (refusal) return { ok: false, error: 'form-not-accepted', message: refusal }
  const res = Value.sell({ itemId: p.id, itemName: p.name, itemQty: qty, receive: f, split: split ?? undefined, declaredIntent: sanitizeIntent(declaredIntent) })
  if (res.ok) { p.stock += Math.max(1, Math.round(qty)); changed('sale') }
  return res
}

// ── Catalog import (V177; the validation lives in utils/OmniStoreCatalogSchema.js, this only APPLIES products) ──

/** Dev: throw away the ACTIVE store's products, list and section choice and rebuild its seed from its OWN type (id, name, type stay). Other stores and the value ledger are untouched. */
export function resetStore (storeId) {
  ensureLoaded()
  const id = storeId ?? activeStoreId()
  const old = S.stores[id]
  if (!old || old.ownerId !== currentOwnerId()) return false
  const type = Types.getType(old.typeId)
  const fresh = type ? makeStore(id, old.ownerId, old.name, type) : { ...old, products: [], listItems: [], extraSections: [] }
  if (!type) rebuildSections(fresh)
  S.stores[id] = fresh; delete S.section[id]
  changed('reset', { storeId: id })
  return true
}

/** A deep copy of what an import can change, for one-step undo (kept by the caller). */
export function snapshotCatalog () {
  const st = getStore()
  return JSON.parse(JSON.stringify({ storeId: st.id, ownerId: st.ownerId, name: st.name, extraSections: st.extraSections ?? [], products: st.products, listItems: st.listItems }))   // V182: remembers WHICH store
}
export function restoreCatalog (snap) {
  if (!snap || typeof snap !== 'object') return false
  // V182: a snapshot belongs to the store it was taken in; an old one (no storeId) acts on the active store. Never another identity's, never a deleted store's.
  if (idOk(snap.ownerId) && snap.ownerId !== currentOwnerId()) return false   // taken by another identity
  const sid = idOk(snap.storeId) ? snap.storeId : activeStoreId()
  const st = S.stores[sid]
  if (!st || st.ownerId !== currentOwnerId()) return false
  const cleaned = sanitizeStore(st.id, { ...st, name: snap.name, extraSections: snap.extraSections, products: snap.products, listItems: snap.listItems })
  st.name = cleaned.name; st.products = cleaned.products; st.listItems = cleaned.listItems
  st.extraSections = cleaned.extraSections; st.sections = cleaned.sections   // V181: the sections the catalog had come back too
  changed('catalog-restore', { storeId: st.id })
  return true
}
/**
 * Apply validated catalog products. mode 'merge': same id -> the imported fields replace the product (existing
 * reviews / stats / lifecycle are kept when the import carries none), new ids are appended. mode 'replace': the product
 * list becomes exactly the import; list items of vanished products are dropped. Everything goes through
 * sanitizeProduct, so even a caller that skipped the validator cannot store an invalid product.
 * Returns {ok, added, updated, removed, total, skipped} (ok:false when nothing valid or the store would exceed LIMITS.products).
 */
export function importProducts (rawProducts, { mode = 'merge', name = null, matchBy = 'id', extraSections = null } = {}) {
  const st = getStore()
  const incoming = resolveIncoming(rawProducts, matchBy)
  const seen = new Set(incoming.map(p => p.id))
  if (!incoming.length) return { ok: false, error: 'no valid product', added: 0, updated: 0, removed: 0, total: st.products.length, skipped: (rawProducts?.length ?? 0) }
  let next, added = 0, updated = 0, removed = 0
  if (mode === 'replace') {
    removed = st.products.filter(p => !seen.has(p.id)).length
    updated = incoming.filter(p => st.products.some(o => o.id === p.id)).length
    added = incoming.length - updated
    next = incoming.map(p => { const old = st.products.find(o => o.id === p.id); return old ? keepHistory(p, old) : p })
  } else {
    next = st.products.map(o => { const n = incoming.find(p => p.id === o.id); if (n) { updated++; return keepHistory(n, o) } return o })
    incoming.forEach(p => { if (!st.products.some(o => o.id === p.id)) { next.push(p); added++ } })
  }
  if (next.length > LIMITS.products) return { ok: false, error: `would exceed ${LIMITS.products} products`, added: 0, updated: 0, removed: 0, total: st.products.length, skipped: incoming.length }
  st.products = next
  if (Array.isArray(extraSections)) {   // V181: a catalog may bring sections; merge adds them to the store's, replace makes them exactly the store's
    st.extraSections = sanitizeExtraSections(mode === 'replace' ? extraSections : [...(st.extraSections ?? []), ...extraSections.filter(x => !(st.extraSections ?? []).some(o => o.id === x?.id))])
    rebuildSections(st)
  } else if (mode === 'replace' && st.extraSections?.length) { st.extraSections = []; rebuildSections(st) }   // replacing with a catalog that has none: the old extra sections go
  const ids = new Set(next.map(p => p.id))
  st.listItems = st.listItems.filter(it => ids.has(it.productId))
  if (mode === 'replace' && typeof name === 'string' && name.trim()) st.name = str(name.trim(), 40)
  changed('catalog-import')
  return { ok: true, added, updated, removed, total: next.length, skipped: (rawProducts?.length ?? 0) - incoming.length }
}
/** Sanitise the incoming list. matchBy 'id+name' (V178): a product whose id is new but whose NAME (case-insensitive) matches an existing product takes that product's id, so it updates it. */
function resolveIncoming (rawProducts, matchBy) {
  const st = getStore()
  const byName = new Map()
  st.products.forEach(o => { const k = o.name.trim().toLowerCase(); if (!byName.has(k)) byName.set(k, o.id) })
  const have = new Set(st.products.map(o => o.id))
  const incoming = [], seen = new Set()
  ;(Array.isArray(rawProducts) ? rawProducts : []).forEach(r => {
    const p = sanitizeProduct(r)
    if (!p) return
    if (matchBy === 'id+name' && !have.has(p.id)) { const hit = byName.get(p.name.trim().toLowerCase()); if (hit && !seen.has(hit)) p.id = hit }
    if (seen.has(p.id)) return
    seen.add(p.id); incoming.push(p)
  })
  return incoming
}
/** What importProducts WOULD do (no change): {add, update, remove, total}. */
export function previewImport (rawProducts, { mode = 'merge', matchBy = 'id' } = {}) {
  const st = getStore()
  const incoming = resolveIncoming(rawProducts, matchBy)
  const ids = new Set(incoming.map(p => p.id))
  const update = incoming.filter(p => st.products.some(o => o.id === p.id)).length
  const add = incoming.length - update
  const remove = mode === 'replace' ? st.products.filter(p => !ids.has(p.id)).length : 0
  return { add, update, remove, total: mode === 'replace' ? incoming.length : st.products.length + add }
}
function keepHistory (n, old) {
  return { ...n, reviews: n.reviews.length ? n.reviews : old.reviews, stats: n.stats.purchases || n.stats.influence ? n.stats : old.stats, lifecycle: n.lifecycle.length ? n.lifecycle : old.lifecycle, accept: n.accept ?? old.accept }
}

// ── Manual product editing (V178) ───────────────────────────────────────────────

const validationCtx = () => ({ types: Value.getTypes(), sectionIds: getStore().sections.filter(s => s.kind !== 'media').map(s => s.id) })
const view = (p) => ({ id: p.id, name: p.name, emoji: p.media.emoji, category: p.category, sectionIds: [...p.sectionIds], shape: p.shape, media: { ...p.media }, price: p.price.map(f => ({ ...f })), stock: p.stock, lifecycle: p.lifecycle.map(l => ({ ...l })), ...(p.note ? { note: p.note } : {}) })
function uniqueId (base) {
  const st = getStore()
  let id = base.slice(0, 60), k = 2
  while (st.products.some(o => o.id === id)) id = `${base.slice(0, 56)}-${k++}`
  return id
}
function imageBudgetError (media, exceptId) {
  if (media?.image && media.image.startsWith('data:') && dataBudgetUsed(getStore(), exceptId) + dataUrlBytes(media.image) > IMAGE_BUDGET_BYTES) return 'Image link: this store already holds the maximum of embedded image data (1.5 MB); use an https link.'
  return null
}

/**
 * Add one product. `p` = {name, emoji, category, sectionIds, shape, media:{emoji,image,video,active}, price[], stock, note?, id?}.
 * Same rules as a catalog row (utils/OmniStoreCatalogSchema.js validateProduct). A missing id is generated from the name; a given id must be free.
 * @returns {{ok:true, id, product, warnings}|{ok:false, errors}}
 */
export function addProduct (p, { after = null } = {}) {
  const st = getStore()
  if (!p || typeof p !== 'object') return { ok: false, errors: ['Nothing to add.'] }
  if (st.products.length >= LIMITS.products) return { ok: false, errors: [`The store already holds the maximum of ${LIMITS.products} products.`] }
  const given = p.id !== undefined && p.id !== null && p.id !== ''
  if (given && st.products.some(o => o.id === p.id)) return { ok: false, errors: [`Product id: "${String(p.id).slice(0, 40)}" is already used.`] }
  const v = Schema.validateProduct(p, validationCtx())
  if (!v.ok) return { ok: false, errors: v.errors, warnings: v.warnings }
  const bErr = imageBudgetError(v.product.media, null)
  if (bErr) return { ok: false, errors: [bErr], warnings: v.warnings }
  const prod = sanitizeProduct({ ...v.product, id: given ? v.product.id : uniqueId(v.product.id) })
  const i = after ? st.products.findIndex(o => o.id === after) : -1
  if (i >= 0) st.products.splice(i + 1, 0, prod); else st.products.push(prod)
  changed('product-add')
  return { ok: true, id: prod.id, product: prod, warnings: v.warnings }
}

/** Change fields of a product ({name, emoji, category, sectionIds, shape, media (partial), price, stock, note, lifecycle}); reviews / stats / accept / id are kept. */
export function updateProduct (id, patch) {
  const p = getProduct(id)
  if (!p) return { ok: false, errors: ['Unknown product.'] }
  if (!patch || typeof patch !== 'object') return { ok: false, errors: ['Nothing to change.'] }
  const raw = view(p)
  ;['name', 'category', 'sectionIds', 'shape', 'price', 'stock', 'note', 'lifecycle'].forEach(k => { if (patch[k] !== undefined) raw[k] = patch[k] })
  const mediaChanged = patch.media !== undefined || patch.emoji !== undefined
  if (mediaChanged) {
    raw.media = { ...p.media, ...(patch.media && typeof patch.media === 'object' ? patch.media : {}) }
    if (patch.emoji !== undefined && !(patch.media && patch.media.emoji !== undefined)) raw.media.emoji = patch.emoji
    raw.emoji = raw.media.emoji
  } else raw.media = { emoji: p.media.emoji, image: null, video: null, active: 'emoji' }   // untouched media is kept as stored (it may predate the stricter schema rules)
  const v = Schema.validateProduct(raw, validationCtx())
  if (!v.ok) return { ok: false, errors: v.errors, warnings: v.warnings }
  if (mediaChanged) { const bErr = imageBudgetError(v.product.media, p.id); if (bErr) return { ok: false, errors: [bErr], warnings: v.warnings } }
  const merged = { ...p, ...v.product, id: p.id, media: mediaChanged ? v.product.media : p.media, ...(mediaChanged ? {} : { emoji: p.emoji }) }
  if (!v.product.note) delete merged.note
  const next = sanitizeProduct(merged)
  if (!next.note) delete p.note
  Object.assign(p, next)
  changed('product-update')
  return { ok: true, id: p.id, product: p, warnings: v.warnings }
}

/** Remove a product and every shopping-list item that points at it (window / wish / cart). */
export function removeProduct (id) {
  const st = getStore()
  const n = st.products.length
  st.products = st.products.filter(p => p.id !== id)
  if (st.products.length === n) return false
  st.listItems = st.listItems.filter(it => it.productId !== id)
  changed('product-remove')
  return true
}

/** Remove EVERY product (and the shopping list). The store stays empty across reloads; use import or resetStore to refill. */
export function removeAllProducts () {
  const st = getStore()
  const n = st.products.length
  st.products = []; st.listItems = []
  changed('product-remove-all')
  return n
}

/** Copy a product right after the original: fresh id, name "<name> (copy)", no reviews / stats / history; price, media, sections and the sell-forms are kept. */
export function duplicateProduct (id) {
  const p = getProduct(id)
  if (!p) return { ok: false, errors: ['Unknown product.'] }
  const raw = view(p)
  delete raw.id
  raw.name = (p.name.slice(0, LIMITS.name - 7) + ' (copy)')
  raw.lifecycle = []
  const res = addProduct({ ...raw, id: uniqueId(p.id + '-copy') }, { after: p.id })
  if (res.ok && p.accept) res.product.accept = p.accept.map(f => ({ ...f }))
  return res
}

// ── Undo of the last catalog import, persisted (V178) ──────────────────────────

export const UNDO_KEY = 'omni:store-undo-v1'
export const UNDO_MAX_CHARS = 1000000
let undoMem = null          // { v, t, label, snap, persisted }
let undoRead = false

/**
 * Keep `snap` (from snapshotCatalog(), taken BEFORE the change) as the one-step undo: in memory always, and in localStorage when it fits
 * (<= UNDO_MAX_CHARS; embedded image data is dropped first if that helps; on a quota error the stored copy is removed so a reload can never
 * undo to an OLDER import). @returns {{persisted:boolean, imagesDropped:boolean}}
 */
export function rememberUndo (snap, label = '') {
  undoRead = true
  undoMem = { v: 1, t: Date.now(), label: str(label, 120), snap, persisted: false }
  let imagesDropped = false
  const tryStore = (obj) => { const txt = JSON.stringify(obj); if (txt.length > UNDO_MAX_CHARS) return false; try { localStorage.setItem(UNDO_KEY, txt); return true } catch (_) { return false } }
  let ok = tryStore(undoMem)
  if (!ok) {
    const lean = { ...undoMem, snap: { ...snap, products: (snap.products ?? []).map(p => ({ ...p, media: { ...p.media, image: p.media?.image && p.media.image.startsWith('data:') ? null : p.media?.image, active: p.media?.active === 'image' && p.media.image?.startsWith('data:') ? 'emoji' : p.media?.active } })) } }
    ok = tryStore(lean)
    imagesDropped = ok
  }
  if (!ok) { try { localStorage.removeItem(UNDO_KEY) } catch (_) { /* ignore */ } }
  undoMem.persisted = ok
  return { persisted: ok, imagesDropped }
}
function readUndo () {
  if (undoMem || undoRead) return undoMem
  undoRead = true
  try {
    const d = JSON.parse(localStorage.getItem(UNDO_KEY) || 'null')
    if (d && d.v === 1 && d.snap && typeof d.snap === 'object' && Array.isArray(d.snap.products) && (d.snap.storeId === undefined || idOk(d.snap.storeId))) undoMem = { v: 1, t: finite(d.t) ? d.t : 0, label: str(d.label, 120), snap: d.snap, persisted: true }
  } catch (_) { /* unreadable: no undo */ }
  return undoMem
}
/**
 * {label, t, persisted, products, storeId, storeName, active} of the pending undo, or null. V182: the undo belongs to the store it was taken in; `active`
 * is false while another store is active (undoLast then refuses). An old snapshot without a storeId counts as the active store's.
 */
export function getUndo () {
  ensureLoaded()
  const u = readUndo()
  if (!u) return null
  const sid = u.snap.storeId ?? null
  const st = sid ? S?.stores[sid] : null
  if (sid && (!st || st.ownerId !== currentOwnerId())) return null
  return { label: u.label, t: u.t, persisted: u.persisted, products: u.snap.products.length, storeId: sid ?? activeStoreId(), storeName: st?.name ?? getStore().name, active: !sid || sid === activeStoreId() }
}
export function clearUndo () { undoMem = null; undoRead = true; try { localStorage.removeItem(UNDO_KEY) } catch (_) { /* ignore */ } }
/** Restore the catalog as it was before the last import, then forget the snapshot. */
export function undoLast () {
  const u = readUndo()
  if (!u) return { ok: false, error: 'nothing to undo' }
  const sid = u.snap.storeId ?? null
  if (sid && sid !== activeStoreId()) return { ok: false, error: 'other-store', storeName: S.stores[sid]?.name ?? '' }   // never restore store A's catalog into store B
  const ok = restoreCatalog(u.snap)
  clearUndo()
  return ok ? { ok: true, label: u.label, products: u.snap.products.length } : { ok: false, error: 'snapshot unusable' }
}

// ── Derived views for the V177 D3 charts (data only) ────────────────────────────

/** store -> sections -> products (value = purchases). Treemap / sunburst ready. */
export function toHierarchy () {
  const st = getStore()
  return {
    name: st.name, kind: 'store',
    children: st.sections.map(sec => ({
      name: sec.name, kind: sec.kind, sectionId: sec.id,
      children: productsFor(sec.id).map(p => ({ name: p.name, emoji: p.emoji, kind: 'product', productId: p.id, value: Math.max(1, p.stats.purchases) })),
    })),
  }
}
/** customer type -> product links (value = purchases by that type). Sankey ready. */
export function toFlows () {
  const nodes = [], links = []
  const add = (id, name, kind) => { if (!nodes.some(n => n.id === id)) nodes.push({ id, name, kind }) }
  getProducts().forEach(p => {
    add(`product:${p.id}`, p.name, 'product')
    Object.keys(p.stats.customerTypes).forEach(ct => {
      add(`customer:${ct}`, ct, 'customer')
      if (p.stats.customerTypes[ct] > 0) links.push({ source: `customer:${ct}`, target: `product:${p.id}`, value: p.stats.customerTypes[ct], kind: 'purchases' })
    })
  })
  return { nodes, links }
}
