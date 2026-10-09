/**
 * utils/OmniStoreModel.js — ⟐OmniStore sandbox: one store per identity, products, ONE shopping-list model (V176)
 *
 * SANDBOX ONLY (see utils/OmniValueModel.js). No DOM; persisted at localStorage 'omni:store-v1'.
 *
 * STORE     per identity id (the same id the value ledger uses). `sections` = identity sections derived from the real
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
 * Events (window): omni:store-changed {kind}.
 */

import * as Value from './OmniValueModel.js'
import { getActiveIdentity } from './OmniIdentity.js'
import { WELLNESS_DIMENSIONS } from '../data/OmniUserWellness.js'

export const STORAGE_KEY = 'omni:store-v1'
export const VERSION = 1
export const CHANGED_EVENT = 'omni:store-changed'
export const MEDIA_KINDS = ['emoji', 'image', 'video']
export const SHAPES = ['cube', 'disc']
export const LIST_STATES = ['window', 'wish', 'cart']
export const IMAGE_MAX_BYTES = 512 * 1024
export const IMAGE_BUDGET_BYTES = 1.5 * 1024 * 1024
export const LIMITS = { products: 200, listItems: 200, forms: 8, reviews: 20, lifecycle: 12, qty: 9999, name: 60 }

let S = null           // { stores:{ownerId:store}, section:{ownerId:sectionId} }
let loaded = false
let seq = 0
let degraded = false

const emit = (kind) => { try { window.dispatchEvent(new CustomEvent(CHANGED_EVENT, { detail: { kind } })) } catch (_) { /* no window */ } }
const finite = (x) => typeof x === 'number' && Number.isFinite(x)
const str = (v, max) => String(v ?? '').slice(0, max)
const idOk = (v) => typeof v === 'string' && /^[A-Za-z0-9_.:-]{1,64}$/.test(v)
const ensureLoaded = () => { if (!loaded) load() }

// ── Seed: fruit and veg ─────────────────────────────────────────────────────────

const DIM = (name) => `dim-${name.toLowerCase()}`
const IDENTITY_SECTIONS = [
  ['Physical', 'Food and nourishment. The closest real Wellness Dimension (there is no Nutritional one).'],
  ['Life', 'Everyday staples.'],
  ['Social', 'Share-at-the-table produce.'],
  ['Emotional', 'Comfort picks.'],
]

// [slug, emoji, name, category, shape, extra dimensions, price forms "type:qty[:quality]", stock]
const SEED = [
  ['apple', '🍎', 'Apple', 'fruit', 'cube', ['Emotional'], 'bells:3 credits:1 gold:0.5 flowers:2:fresh', 14],
  ['banana', '🍌', 'Banana', 'fruit', 'disc', ['Emotional'], 'bells:2 credits:1 hours:1:skilled', 12],
  ['grapes', '🍇', 'Grapes', 'fruit', 'cube', ['Social'], 'bells:6 credits:2 usd:1 nook:1', 9],
  ['strawberry', '🍓', 'Strawberry', 'fruit', 'disc', ['Social'], 'bells:5 credits:2 flowers:3:fresh usd:1', 11],
  ['watermelon', '🍉', 'Watermelon', 'fruit', 'cube', ['Social'], 'bells:12 credits:4 gold:2 hours:4:skilled', 6],
  ['peach', '🍑', 'Peach', 'fruit', 'disc', ['Emotional'], 'bells:4 credits:1.5 usd:0.75 flowers:3', 10],
  ['cherry', '🍒', 'Cherries', 'fruit', 'disc', ['Social'], 'bells:7 credits:2.5 nook:1 gold:1.5', 8],
  ['pineapple', '🍍', 'Pineapple', 'fruit', 'cube', ['Social'], 'bells:15 credits:5 gold:2.5 usd:2.5 hours:5:skilled', 5],
  ['carrot', '🥕', 'Carrot', 'vegetable', 'disc', ['Life'], 'nook:1 hours:2:skilled bells:6 credits:2', 20],
  ['broccoli', '🥦', 'Broccoli', 'vegetable', 'cube', ['Life'], 'bells:5 credits:2 flowers:4 hours:2:skilled', 13],
  ['corn', '🌽', 'Corn', 'vegetable', 'disc', ['Life', 'Social'], 'bells:4 credits:1.5 usd:0.75', 16],
  ['tomato', '🍅', 'Tomato', 'vegetable', 'cube', ['Life', 'Emotional'], 'bells:3 credits:1 flowers:2 hours:1:skilled', 18],
  ['potato', '🥔', 'Potato', 'vegetable', 'cube', ['Life'], 'bells:2 credits:1 hours:1:skilled', 25],
  ['onion', '🧅', 'Onion', 'vegetable', 'disc', ['Life'], 'bells:2 credits:0.5 usd:0.25 flowers:1', 22],
  ['lettuce', '🥬', 'Leafy greens', 'vegetable', 'cube', ['Life'], 'bells:3 credits:1 flowers:2:fresh usd:0.5', 15],
  ['eggplant', '🍆', 'Eggplant', 'vegetable', 'disc', ['Emotional'], 'bells:5 credits:2 gold:1 nook:1', 7],
]

const LIFECYCLE_STAGES = [
  ['idea', 'The idea', (n) => `${n}: a grower asks what a plain, honest ${n.toLowerCase()} would look like in a world with no default currency.`],
  ['materials', 'Materials', (n) => `Seed stock, soil, water and a season of light for the ${n.toLowerCase()}.`],
  ['init', 'Planted', (n) => `First ${n.toLowerCase()} seedlings planted in the sandbox plot.`],
  ['build', 'Grown', (n) => `Weeks of growth; the ${n.toLowerCase()} lot is graded by its grower (self-reported).`],
  ['final', 'Harvest', (n) => `Harvest day: the ${n.toLowerCase()} lot is listed with its accepted exchange forms.`],
  ['update', 'Update', (n) => `Prices re-balanced across Bells, Credits and friends after the first week of trades.`],
]
const T0 = Date.UTC(2026, 2, 1)

function parseForms (spec) {
  return spec.split(/\s+/).filter(Boolean).map(s => {
    const [type, qty, quality] = s.split(':')
    return quality ? { type, qty: Number(qty), quality } : { type, qty: Number(qty) }
  })
}

function buildSections () {
  const sections = IDENTITY_SECTIONS.map(([dim, desc]) => ({ id: DIM(dim), name: dim, kind: 'identity', filter: { dimension: dim }, desc }))
  sections.push(
    { id: 'media-emoji', name: 'Emoji', kind: 'media', filter: { mediaKind: 'emoji' }, desc: 'Products shown as an emoji.' },
    { id: 'media-image', name: 'Images', kind: 'media', filter: { mediaKind: 'image' }, desc: 'Products that carry an image.' },
    { id: 'media-video', name: 'Videos', kind: 'media', filter: { mediaKind: 'video' }, desc: 'Products that carry a video.' },
  )
  return sections
}

export function buildSeedProducts () {
  return SEED.map(([slug, emoji, name, category, shape, dims, forms, stock], i) => ({
    id: `p-${slug}`, name, emoji, category,
    sectionIds: [DIM('Physical'), ...dims.map(DIM)],
    media: { emoji, image: null, video: null, active: 'emoji' },
    shape, price: parseForms(forms), accept: null, stock,
    valueType: 'produce', qualityScale: 'ripeness', quality: 'ripe',
    lifecycle: LIFECYCLE_STAGES.map(([stage, title, note], k) => ({ stage, title, note: note(name), t: T0 + (i * 3 + k * 9) * 86400000 })),
    reviews: [
      { id: `r-${slug}-1`, user: 'sandbox-shopper', rating: 4 + (i % 2), text: `Good ${name.toLowerCase()}, paid in ${parseForms(forms)[0].type}.`, t: T0 + 40 * 86400000 },
      { id: `r-${slug}-2`, user: 'sandbox-grower', rating: 5, text: 'Grown and graded in the sandbox.', t: T0 + 45 * 86400000 },
    ],
    stats: { purchases: 10 + ((i * 7) % 23), influence: 1 + (i % 5), customerTypes: { regulars: 4 + (i % 6), visitors: 2 + (i % 4), growers: i % 3 } },
  }))
}

function buildStore (ownerId, name) {
  return { ownerId, name, sections: buildSections(), products: buildSeedProducts(), listItems: [] }
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
  const emoji = str(p.media?.emoji ?? p.emoji ?? '❓', 16) || '❓'
  const img = typeof p.media?.image === 'string' && checkImage(p.media.image).ok ? p.media.image : null
  const vid = typeof p.media?.video === 'string' && checkVideo(p.media.video).ok ? p.media.video : null
  const active = MEDIA_KINDS.includes(p.media?.active) && (p.media.active === 'emoji' || (p.media.active === 'image' && img) || (p.media.active === 'video' && vid)) ? p.media.active : 'emoji'
  const forms = (Array.isArray(p.price) ? p.price : []).map(sanitizeForm).filter(Boolean).slice(0, LIMITS.forms)
  const accept = Array.isArray(p.accept) ? p.accept.map(sanitizeForm).filter(Boolean).slice(0, LIMITS.forms) : null
  return {
    id: p.id, name: str(p.name || p.id, LIMITS.name), emoji, category: p.category === 'vegetable' ? 'vegetable' : 'fruit',
    sectionIds: (Array.isArray(p.sectionIds) ? p.sectionIds : []).filter(idOk).slice(0, 12),
    media: { emoji, image: img, video: vid, active }, shape: SHAPES.includes(p.shape) ? p.shape : 'cube',
    price: forms, accept: accept && accept.length ? accept : null,
    stock: finite(p.stock) && p.stock >= 0 ? Math.min(p.stock, 1e6) : 0,
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

function sanitizeStore (ownerId, raw) {
  const seed = buildStore(ownerId, str(raw?.name || 'Sandbox store', 40))
  if (!raw || typeof raw !== 'object') return seed
  const products = (Array.isArray(raw.products) ? raw.products : []).slice(0, LIMITS.products).map(sanitizeProduct).filter(Boolean)
  const ids = new Set()
  seed.products = products.filter(p => (ids.has(p.id) ? false : (ids.add(p.id), true)))
  if (!seed.products.length) seed.products = buildSeedProducts()
  const pid = new Set(seed.products.map(p => p.id))
  const seen = new Set()
  seed.listItems = (Array.isArray(raw.listItems) ? raw.listItems : []).slice(0, LIMITS.listItems).filter(it => it && idOk(it.id) && pid.has(it.productId) && LIST_STATES.includes(it.state) && finite(it.qty) && it.qty > 0)
    .filter(it => { const k = it.productId + '|' + it.state; return seen.has(k) ? false : (seen.add(k), true) })
    .map(it => ({ id: it.id, productId: it.productId, qty: Math.min(it.qty, LIMITS.qty), state: it.state, chosenForm: sanitizeChosen(it.chosenForm), declaredIntent: sanitizeIntent(it.declaredIntent) }))
  return seed
}

// ── Load / persist ──────────────────────────────────────────────────────────────

export function load () {
  loaded = true
  S = { stores: {}, section: {} }
  let raw = null
  try { raw = localStorage.getItem(STORAGE_KEY) } catch (_) { return S }
  if (!raw) return S
  let data = null
  try { data = JSON.parse(raw) } catch (_) { return S }
  if (!data || data.version !== VERSION || typeof data.stores !== 'object' || !data.stores) return S
  Object.keys(data.stores).slice(0, 16).forEach(id => { if (idOk(id)) S.stores[id] = sanitizeStore(id, data.stores[id]) })
  if (data.section && typeof data.section === 'object') Object.keys(data.section).forEach(k => { if (idOk(k) && typeof data.section[k] === 'string') S.section[k] = data.section[k] })
  return S
}

function persist () {
  if (!S) return
  const body = (strip) => JSON.stringify({
    version: VERSION, section: S.section,
    stores: strip ? Object.fromEntries(Object.entries(S.stores).map(([k, st]) => [k, { ...st, products: st.products.map(p => ({ ...p, media: { ...p.media, image: null, active: p.media.active === 'image' ? 'emoji' : p.media.active } })) }])) : S.stores,
  })
  try { localStorage.setItem(STORAGE_KEY, body(false)); degraded = false } catch (_) {
    try { localStorage.setItem(STORAGE_KEY, body(true)); degraded = true } catch (__) { /* storage unavailable: memory only */ }
  }
}
/** True when the last save had to drop image data URLs because the browser quota was full. */
export const isDegraded = () => degraded
export const flush = () => { ensureLoaded(); persist() }
function changed (kind) { persist(); emit(kind) }
export function _reset (clear = false) {
  if (clear) { try { localStorage.removeItem(STORAGE_KEY) } catch (_) { /* ignore */ } }
  S = { stores: {}, section: {} }; loaded = true; seq = 0; degraded = false
}

// ── Store access ────────────────────────────────────────────────────────────────

export function currentOwnerId () { return Value.currentAccountId() }
export function getStore (ownerId) {
  ensureLoaded()
  const id = ownerId ?? currentOwnerId()
  if (!S.stores[id]) {
    let nm = 'Sandbox store'
    try { const ident = getActiveIdentity(); if (ident && ident.id === id) nm = `${ident.name}'s store` } catch (_) { /* ignore */ }
    S.stores[id] = buildStore(id, nm)
    persist()
  }
  return S.stores[id]
}
export const getSections = () => getStore().sections
export const getSection = (id) => getStore().sections.find(s => s.id === id) ?? null
export const getProducts = () => getStore().products
export const getProduct = (id) => getStore().products.find(p => p.id === id) ?? null
export const WELLNESS = WELLNESS_DIMENSIONS

export function getCurrentSectionId () {
  const st = getStore()
  const want = S.section[st.ownerId]
  return st.sections.some(s => s.id === want) ? want : st.sections[0].id
}
export function setCurrentSection (id) {
  const st = getStore()
  if (!st.sections.some(s => s.id === id)) return false
  S.section[st.ownerId] = id
  changed('section')
  return true
}

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
export function acceptForms (productId) { const p = getProduct(productId); return p ? (p.accept ?? p.price) : [] }

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
  return item.chosenForm ?? (p?.price[0] ? { ...p.price[0] } : null)
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
  const form = sanitizeChosen(chosenForm) ?? (p.price[0] ? { ...p.price[0] } : null)
  if (!form) return { ok: false, error: 'no-price-form' }
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
  const res = Value.sell({ itemId: p.id, itemName: p.name, itemQty: qty, receive: f, split: split ?? undefined, declaredIntent: sanitizeIntent(declaredIntent) })
  if (res.ok) { p.stock += Math.max(1, Math.round(qty)); changed('sale') }
  return res
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
