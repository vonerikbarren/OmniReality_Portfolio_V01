/**
 * utils/OmniStoreTypes.js — store TYPES as data: the record schema, a validator, the built-in types and their seed catalogs (V182, BuildOrder item 6)
 *
 * USER-SAFE and PURE: no DOM, no storage, no import of any Dev* module (a test enforces it). The model (OmniStoreModel.createStore) builds a
 * store from a type; OmniStoreSettings gets the type's layout / theme / backdrop written into the new store's settings; the dev side
 * (utils/DevOmniStoreData.js) EXTENDS this with its own custom / test types through registerType() and never the other way round.
 *
 * A TYPE RECORD ("omni-store-type/1"):
 *   { schema, id, label, emoji, desc,
 *     layout:      'shelf'|'ring'|'aisle'|'island'          unknown -> 'shelf' (warning)
 *     theme:       { preset: <OmniStoreSettings preset id>|null, colors?: { hover, selected, shelfRim, shelfBack, shelfPlank, backdrop } }   (#rgb / #rrggbb)
 *     backdrop:    { preset?: id, mode?: 'none'|'solid'|'gradient', color?, color2?, opacity? } | null     (null = the theme preset's backdrop)
 *     baseSections:'wellness' | 'none'    'wellness' = the 4 built-in identity sections (Physical, Life, Social, Emotional) come first; 'none' = only `sections`
 *     sections:    [{ id, name, kind:'identity', desc?, filter?:{dimension} }]  the type's own sections (<= 16); the 3 media lenses (Emoji / Images / Videos) always follow
 *     categories:  ['bread', ...]                              hint list for the AI prompt and the product form
 *     accepts:     ['bells','credits', ...]                    ACCEPTED FORMS: the value types a store of this type takes as payment (alias key `acceptedForms`).
 *                                                              EMPTY = all. The model refuses / hides other forms for such a store (OmniStoreModel.acceptsForm); max 8
 *     lens:        'emoji'|'image'|'video'                     media kind the seed products show first (only used when a product carries it)
 *     productClass:text,  shape: 'cube'|'disc'                 class label and the default shape for a seed product that names none
 *     seed:        { products: [<catalog product>...], story?: {...} }   the starting catalog (<= 200 products), validated by the SAME rules as a catalog import
 *   }
 * Seed products are catalog products ({id, name, emoji, category, sectionIds, shape, price:[{type,qty,quality?}], stock, note?}); lifecycle, reviews and stats
 * (data only) are GENERATED from `seed.story` ({stages:[[stage,title,note]], review, review2, users:[a,b], crowd}; tokens {Name} {name} {pay}).
 * Seed ids are namespaced per type ('p-' for produce, which keeps the V176-V181 ids; 'bakery-', 'electronics-' for the others). A product id is only
 * unique INSIDE one store; the value ledger's inventory is keyed by product id, so the same id in two stores means the same kind of item.
 *
 * UNTRUSTED INPUT (a pasted record, a file): JSON.parse only, never evaluated; strings only, length / count caps, no '<' or '>', control characters
 * removed, unknown keys ignored (warning), unknown layout -> shelf (warning). The result is built field by field from checked values only.
 * Pure helpers also here: describeForPrompt() (what the AI prompt prefill needs) and buildSeedProducts().
 */

import { LAYOUT_IDS, DEFAULT_LAYOUT } from './OmniStoreLayouts.js'
import * as Schema from './OmniStoreCatalogSchema.js'

export const TYPE_SCHEMA_ID = 'omni-store-type/1'
export const LIMITS = { id: 40, label: 40, emoji: 12, desc: 200, categories: 12, category: 24, sections: 16, sectionName: 28, sectionDesc: 160, accepts: 8, seedProducts: 200, storyStages: 8, storyText: 200, rawChars: 400000, colorKeys: 6 }
export const BASE_SECTIONS = ['wellness', 'none']
export const LENSES = ['emoji', 'image', 'video']
export const COLOR_KEYS = ['hover', 'selected', 'shelfRim', 'shelfBack', 'shelfPlank']
export const BACKDROP_MODES = ['none', 'solid', 'gradient']
export const KNOWN_KEYS = ['schema', 'id', 'label', 'emoji', 'desc', 'layout', 'theme', 'backdrop', 'baseSections', 'sections', 'categories', 'accepts', 'acceptedForms', 'lens', 'productClass', 'shape', 'seed']
export const WELLNESS_SECTION_IDS = Object.freeze(['dim-physical', 'dim-life', 'dim-social', 'dim-emotional'])
export const MEDIA_SECTION_IDS = Object.freeze(['media-emoji', 'media-image', 'media-video'])
export const T0 = Date.UTC(2026, 2, 1)   // the seed history's origin (V176): 1 March 2026

const ID_RE = /^[A-Za-z0-9_.:-]{1,40}$/
const CTRL_RE = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const finite = (x) => typeof x === 'number' && Number.isFinite(x)

function hex (v) {
  if (typeof v !== 'string') return null
  const m = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(v.trim())
  if (!m) return null
  let h = m[1].toLowerCase()
  if (h.length === 3) h = h.split('').map(c => c + c).join('')
  return '#' + h
}

/** One text field: {v, err?, warn?}. HTML ('<' / '>') is an error; control characters are removed (warning); over the cap is an error. */
function text (raw, max, label, { required = false } = {}) {
  if (raw === undefined || raw === null) return required ? { v: '', err: `${label}: missing` } : { v: '' }
  if (typeof raw !== 'string') return { v: '', err: `${label}: must be text` }
  if (/[<>]/.test(raw)) return { v: '', err: `${label}: HTML is not allowed (found < or >)` }
  const cleaned = raw.replace(CTRL_RE, '')
  const v = cleaned.trim()
  if (v.length > max) return { v: '', err: `${label}: too long (${v.length} > ${max} characters)` }
  if (required && !v) return { v: '', err: `${label}: empty` }
  return { v, warn: cleaned.length !== raw.length ? `${label}: control characters removed` : null }
}

// ── Validator ───────────────────────────────────────────────────────────────────

/**
 * @param {string|object} input  JSON text or an already-parsed object
 * @param {{valueTypes?: Array<{id:string, qualityScale?:Array<{id:string}>}>}} [opts]  the app's value types (strict seed check). Without it the seed is checked
 *        against the types it uses itself (shape and numbers only).
 * @returns {{ok:boolean, type:object|null, errors:string[], warnings:string[], seed:{total:number, ok:number, warn:number, error:number}}}
 */
export function validateType (input, opts = {}) {
  const res = { ok: false, type: null, errors: [], warnings: [], seed: { total: 0, ok: 0, warn: 0, error: 0 } }
  const err = (m) => res.errors.push(m)
  const warn = (m) => res.warnings.push(m)
  let raw = input
  if (typeof input === 'string') {
    if (input.length > LIMITS.rawChars) { err(`Input is too large (${input.length} characters, limit ${LIMITS.rawChars})`); return res }
    if (!input.trim()) { err('Input is empty'); return res }
    try { raw = JSON.parse(input) } catch (e) { err('Not valid JSON: ' + String(e.message).slice(0, 160)); return res }
  }
  if (!isObj(raw)) { err('A store type must be a JSON object'); return res }
  if (raw.schema !== undefined && raw.schema !== TYPE_SCHEMA_ID) { err(`Unsupported schema "${String(raw.schema).slice(0, 40).replace(/[<>]/g, '')}" (this app reads ${TYPE_SCHEMA_ID})`); return res }
  Object.keys(raw).filter(k => !KNOWN_KEYS.includes(k)).slice(0, 5).forEach(k => warn(`Unknown field ignored: ${String(k).slice(0, 30).replace(/[<>]/g, '')}`))

  if (typeof raw.id !== 'string' || !ID_RE.test(raw.id)) err('id: 1-40 characters of letters, digits and _ . : -')
  const label = text(raw.label, LIMITS.label, 'label', { required: true }); if (label.err) err(label.err); if (label.warn) warn(label.warn)
  const emoji = text(raw.emoji, LIMITS.emoji, 'emoji'); if (emoji.err) err(emoji.err)
  const desc = text(raw.desc, LIMITS.desc, 'desc'); if (desc.err) err(desc.err)
  const productClass = text(raw.productClass ?? 'general', LIMITS.category, 'productClass'); if (productClass.err) err(productClass.err)

  let layout = DEFAULT_LAYOUT
  if (raw.layout === undefined) warn(`layout: missing, using "${DEFAULT_LAYOUT}"`)
  else if (typeof raw.layout !== 'string' || !LAYOUT_IDS.includes(raw.layout)) warn(`layout: unknown ("${String(raw.layout).slice(0, 24).replace(/[<>]/g, '')}"), using "${DEFAULT_LAYOUT}" (known: ${LAYOUT_IDS.join(', ')})`)
  else layout = raw.layout

  // theme
  const theme = { preset: null, colors: {} }
  if (raw.theme !== undefined && raw.theme !== null) {
    if (!isObj(raw.theme)) err('theme: must be an object { preset?, colors? }')
    else {
      if (raw.theme.preset !== undefined && raw.theme.preset !== null) {
        if (typeof raw.theme.preset !== 'string' || !ID_RE.test(raw.theme.preset)) err('theme.preset: must be a preset id (letters, digits and _ . : -)')
        else theme.preset = raw.theme.preset
      }
      if (raw.theme.colors !== undefined && raw.theme.colors !== null) {
        if (!isObj(raw.theme.colors)) err('theme.colors: must be an object')
        else {
          ;[...COLOR_KEYS, 'backdrop'].forEach(k => {
            const c = raw.theme.colors[k]
            if (c === undefined || c === null) return
            const h = hex(c)
            if (h) theme.colors[k] = h; else warn(`theme.colors.${k}: not a #rrggbb colour, ignored`)
          })
        }
      }
    }
  }
  // backdrop
  let backdrop = null
  if (raw.backdrop !== undefined && raw.backdrop !== null) {
    if (!isObj(raw.backdrop)) err('backdrop: must be an object or null')
    else {
      backdrop = {}
      const b = raw.backdrop
      if (b.preset !== undefined && b.preset !== null) { if (typeof b.preset === 'string' && ID_RE.test(b.preset)) backdrop.preset = b.preset; else err('backdrop.preset: must be a preset id') }
      if (b.mode !== undefined) { if (BACKDROP_MODES.includes(b.mode)) backdrop.mode = b.mode; else warn(`backdrop.mode: must be ${BACKDROP_MODES.join(', ')}; ignored`) }
      ;['color', 'color2'].forEach(k => { if (b[k] !== undefined) { const h = hex(b[k]); if (h) backdrop[k] = h; else warn(`backdrop.${k}: not a #rrggbb colour, ignored`) } })
      if (b.opacity !== undefined) { if (finite(b.opacity)) backdrop.opacity = Math.min(1, Math.max(0, b.opacity)); else warn('backdrop.opacity: must be a number 0..1; ignored') }
    }
  }

  // base sections + own sections
  let baseSections = 'wellness'
  if (raw.baseSections !== undefined) { if (BASE_SECTIONS.includes(raw.baseSections)) baseSections = raw.baseSections; else warn('baseSections: must be "wellness" or "none"; using "wellness"') }
  const sections = []
  if (raw.sections !== undefined) {
    if (!Array.isArray(raw.sections)) err('sections: must be a list')
    else {
      if (raw.sections.length > LIMITS.sections) err(`sections: too many (${raw.sections.length}, limit ${LIMITS.sections})`)
      const taken = new Set([...WELLNESS_SECTION_IDS, ...MEDIA_SECTION_IDS])
      raw.sections.slice(0, LIMITS.sections).forEach((s, i) => {
        const at = `sections[${i}]`
        if (!isObj(s)) { err(`${at}: not an object`); return }
        if (typeof s.id !== 'string' || !/^[A-Za-z0-9_.:-]{1,64}$/.test(s.id)) { err(`${at}.id: 1-64 characters of letters, digits and _ . : -`); return }
        if (taken.has(s.id)) { err(`${at}.id: "${s.id.slice(0, 30)}" is reserved or used twice`); return }
        const n = text(s.name, LIMITS.sectionName, `${at}.name`, { required: true }); if (n.err) { err(n.err); return }
        const d = text(s.desc, LIMITS.sectionDesc, `${at}.desc`); if (d.err) { err(d.err); return }
        if (s.kind !== undefined && s.kind !== 'identity') warn(`${at}.kind: only "identity" sections are supported here; the media lenses are always added`)
        taken.add(s.id)
        sections.push({ id: s.id, name: n.v, kind: 'identity', desc: d.v, filter: { dimension: n.v } })
      })
    }
  }

  // categories / accepts
  const categories = []
  if (raw.categories !== undefined) {
    if (!Array.isArray(raw.categories)) err('categories: must be a list of words')
    else {
      if (raw.categories.length > LIMITS.categories) warn(`categories: only the first ${LIMITS.categories} are used`)
      raw.categories.slice(0, LIMITS.categories).forEach((c, i) => { const t = text(c, LIMITS.category, `categories[${i}]`, { required: true }); if (t.err) err(t.err); else if (!categories.includes(t.v)) categories.push(t.v) })
    }
  }
  const accepts = []
  const accKey = raw.accepts !== undefined ? 'accepts' : 'acceptedForms'   // `acceptedForms` is the same list under its BuildOrder name; the record keeps `accepts`
  if (raw[accKey] !== undefined) {
    if (!Array.isArray(raw[accKey])) err(`${accKey}: must be a list of value type ids`)
    else {
      if (raw[accKey].length > LIMITS.accepts) warn(`${accKey}: only the first ${LIMITS.accepts} are used`)
      raw[accKey].slice(0, LIMITS.accepts).forEach((a, i) => {
        if (typeof a !== 'string' || !ID_RE.test(a)) { err(`${accKey}[${i}]: must be a value type id`); return }
        if (opts.valueTypes && !opts.valueTypes.some(t => t.id === a)) { warn(`${accKey}[${i}]: unknown value type "${a.slice(0, 24)}" (not in this app), ignored`); return }
        if (!accepts.includes(a)) accepts.push(a)
      })
    }
  }
  let lens = 'emoji'
  if (raw.lens !== undefined) { if (LENSES.includes(raw.lens)) lens = raw.lens; else warn('lens: must be emoji, image or video; using "emoji"') }
  let shape = 'cube'
  if (raw.shape !== undefined) { if (Schema.SHAPES.includes(raw.shape)) shape = raw.shape; else warn('shape: must be cube or disc; using "cube"') }

  // seed
  const seed = { products: [], story: null }
  if (raw.seed !== undefined && raw.seed !== null) {
    if (!isObj(raw.seed)) err('seed: must be an object { products, story? }')
    else {
      const list = raw.seed.products === undefined ? [] : raw.seed.products
      if (!Array.isArray(list)) err('seed.products: must be a list')
      else if (list.length > LIMITS.seedProducts) err(`seed.products: too many (${list.length}, limit ${LIMITS.seedProducts})`)
      else if (list.length) {
        const withShape = list.map(p => (isObj(p) && p.shape === undefined ? { ...p, shape } : p))
        const ids = [...WELLNESS_SECTION_IDS.filter(() => baseSections === 'wellness'), ...sections.map(s => s.id)]
        const used = new Map()
        withShape.forEach(p => { if (isObj(p) && Array.isArray(p.price)) p.price.forEach(f => { if (isObj(f) && typeof f.type === 'string') { if (!used.has(f.type)) used.set(f.type, new Set()); if (typeof f.quality === 'string') used.get(f.type).add(f.quality) } }) })
        const types = opts.valueTypes ?? [...used.entries()].map(([id, qs]) => ({ id, qualityScale: [...qs].map(q => ({ id: q })) }))
        const v = Schema.validateCatalog({ schema: Schema.SCHEMA_ID, products: withShape }, { types, sectionIds: ids })
        res.seed = { ...v.counts }
        v.errors.forEach(m => err('seed: ' + m))
        v.products.forEach(r => { r.errors.forEach(m => err(`seed product ${r.index + 1}${r.name ? ` ("${r.name.slice(0, 30)}")` : ''}: ${m}`)) })
        const warned = v.counts.warn
        if (warned) warn(`seed: ${warned} product(s) had repairs (${v.products.find(r => r.warnings.length)?.warnings[0] ?? ''})`)
        seed.products = v.accepted.map(p => ({ ...p, lifecycle: [] }))   // history is generated from the story, not carried
        if (lens !== 'emoji') seed.products.forEach(p => { if (p.media[lens]) p.media.active = lens })
      }
      if (raw.seed.story !== undefined && raw.seed.story !== null) seed.story = cleanStory(raw.seed.story, err, warn)
    }
  }

  if (res.errors.length) return res
  res.type = {
    schema: TYPE_SCHEMA_ID, id: raw.id, label: label.v, emoji: emoji.v || '🏬', desc: desc.v, layout, theme, backdrop, baseSections, sections,
    categories, accepts, lens, productClass: productClass.v || 'general', shape, seed,
  }
  res.ok = true
  return res
}

function cleanStory (s, err, warn) {
  if (!isObj(s)) { err('seed.story: must be an object'); return null }
  const out = { stages: [], review: '', review2: '', users: ['sandbox-shopper', 'sandbox-seller'], crowd: 'regulars' }
  if (s.stages !== undefined) {
    if (!Array.isArray(s.stages)) err('seed.story.stages: must be a list')
    else s.stages.slice(0, LIMITS.storyStages).forEach((st, i) => {
      if (!Array.isArray(st) || st.length < 3) { err(`seed.story.stages[${i}]: expected [stage, title, note]`); return }
      const a = text(st[0], 16, `story stage ${i + 1} id`, { required: true }), b = text(st[1], 60, `story stage ${i + 1} title`), c = text(st[2], LIMITS.storyText, `story stage ${i + 1} note`)
      const bad = a.err || b.err || c.err
      if (bad) err('seed.story: ' + bad); else out.stages.push([a.v, b.v, c.v])
    })
  }
  const r1 = text(s.review, LIMITS.storyText, 'story review'); if (r1.err) err('seed.story: ' + r1.err); else out.review = r1.v
  const r2 = text(s.review2, LIMITS.storyText, 'story review2'); if (r2.err) err('seed.story: ' + r2.err); else out.review2 = r2.v
  if (s.users !== undefined) {
    if (!Array.isArray(s.users) || s.users.length !== 2) err('seed.story.users: expected two names')
    else { const u = s.users.map((x, i) => text(x, 40, `story user ${i + 1}`, { required: true })); const bad = u.find(x => x.err); if (bad) err('seed.story: ' + bad.err); else out.users = u.map(x => x.v) }
  }
  if (s.crowd !== undefined) { const c = text(s.crowd, 24, 'story crowd', { required: true }); if (c.err) err('seed.story: ' + c.err); else out.crowd = c.v }
  return out
}

// ── Seed products with their generated history ──────────────────────────────────

const DEFAULT_STORY = {
  stages: [
    ['idea', 'The idea', '{Name}: someone asks what a plain, honest {name} would look like in a world with no default currency.'],
    ['materials', 'Materials', 'Everything needed to make the {name}.'],
    ['init', 'Started', 'The first {name} is started in the sandbox workshop.'],
    ['build', 'Made', 'The {name} lot is checked by its maker (self-reported).'],
    ['final', 'Listed', 'The {name} lot is listed with its accepted exchange forms.'],
    ['update', 'Update', 'Prices re-balanced across the sandbox value types after the first week of trades.'],
  ],
  review: 'Good {name}, paid in {pay}.', review2: 'Made and checked in the sandbox.', users: ['sandbox-shopper', 'sandbox-seller'], crowd: 'regulars',
}
const fill = (tpl, name, pay) => String(tpl).replace(/\{Name\}/g, name).replace(/\{name\}/g, name.toLowerCase()).replace(/\{pay\}/g, pay)

/**
 * The model-shaped products of a type's seed: the catalog fields plus generated lifecycle (6 stages), 2 reviews and stats. Deterministic (no clock, no
 * random). For the built-in `produce` type this reproduces the V176-V181 default store product for product (a snapshot test pins it).
 * Quality fields are data only: valueType 'produce' / qualityScale 'ripeness' stay what the model has always stored.
 */
export function buildSeedProducts (type) {
  const story = type?.seed?.story ? { ...DEFAULT_STORY, ...Object.fromEntries(Object.entries(type.seed.story).filter(([k, v]) => (k === 'stages' ? v.length : v))) } : DEFAULT_STORY
  return (type?.seed?.products ?? []).map((p, i) => {
    const slug = String(p.id).replace(/^p-/, '')
    const pay = p.price[0]?.type ?? 'credits'
    return {
      id: p.id, name: p.name, emoji: p.emoji, category: p.category, sectionIds: [...p.sectionIds],
      media: { emoji: p.media?.emoji ?? p.emoji, image: p.media?.image ?? null, video: p.media?.video ?? null, active: p.media?.active ?? 'emoji' },
      shape: p.shape, price: p.price.map(f => ({ ...f })), accept: null, stock: p.stock,
      ...(p.note ? { note: p.note } : {}),
      valueType: 'produce', qualityScale: 'ripeness', quality: 'ripe',
      lifecycle: story.stages.map(([stage, title, note], k) => ({ stage, title, note: fill(note, p.name, pay), t: T0 + (i * 3 + k * 9) * 86400000 })),
      reviews: [
        { id: `r-${slug}-1`, user: story.users[0], rating: 4 + (i % 2), text: fill(story.review, p.name, pay), t: T0 + 40 * 86400000 },
        { id: `r-${slug}-2`, user: story.users[1], rating: 5, text: fill(story.review2, p.name, pay), t: T0 + 45 * 86400000 },
      ],
      stats: { purchases: 10 + ((i * 7) % 23), influence: 1 + (i % 5), customerTypes: { regulars: 4 + (i % 6), visitors: 2 + (i % 4), [story.crowd]: i % 3 } },
    }
  })
}

/** Section ids a type's seed may use (its own + the 4 wellness ones when baseSections is 'wellness'). */
export const sectionIdsFor = (type) => [...(type?.baseSections === 'none' ? [] : WELLNESS_SECTION_IDS), ...(type?.sections ?? []).map(s => s.id)]

/** The slice of a type the AI prompt prefill needs (pure). */
export function describeForPrompt (type) {
  if (!type) return null
  return { id: type.id, label: type.label, productClass: type.productClass, categories: [...(type.categories ?? [])], sections: (type.sections ?? []).map(s => ({ id: s.id, name: s.name })), accepts: [...(type.accepts ?? [])] }
}

// ── Built-in types (data) ───────────────────────────────────────────────────────

const forms = (spec) => spec.split(/\s+/).filter(Boolean).map(s => { const [type, qty, quality] = s.split(':'); return quality ? { type, qty: Number(qty), quality } : { type, qty: Number(qty) } })
const prod = (id, emoji, name, category, shape, sectionIds, priceSpec, stock) => ({ id, name, emoji, category, sectionIds, shape, price: forms(priceSpec), stock })
const dim = (n) => `dim-${n.toLowerCase()}`

// Produce: the V176 store, product for product (slug, emoji, name, category, shape, extra dimensions, price forms, stock)
const PRODUCE_ROWS = [
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
const PRODUCE_STORY = {
  stages: [
    ['idea', 'The idea', '{Name}: a grower asks what a plain, honest {name} would look like in a world with no default currency.'],
    ['materials', 'Materials', 'Seed stock, soil, water and a season of light for the {name}.'],
    ['init', 'Planted', 'First {name} seedlings planted in the sandbox plot.'],
    ['build', 'Grown', 'Weeks of growth; the {name} lot is graded by its grower (self-reported).'],
    ['final', 'Harvest', 'Harvest day: the {name} lot is listed with its accepted exchange forms.'],
    ['update', 'Update', 'Prices re-balanced across Bells, Credits and friends after the first week of trades.'],
  ],
  review: 'Good {name}, paid in {pay}.', review2: 'Grown and graded in the sandbox.', users: ['sandbox-shopper', 'sandbox-grower'], crowd: 'growers',
}

const BAKERY_SECTIONS = [
  { id: 'bk-breads', name: 'Breads', desc: 'Loaves, rolls and things you slice.' },
  { id: 'bk-pastries', name: 'Pastries & cakes', desc: 'Sweet bakes from the oven.' },
  { id: 'bk-drinks', name: 'Drinks', desc: 'Something warm or cold to go with it.' },
]
const BAKERY_ROWS = [
  ['sourdough', '🍞', 'Sourdough loaf', 'bread', 'cube', 'bk-breads', 'bells:8 credits:2.5 flowers:4 hours:1:skilled', 12],
  ['baguette', '🥖', 'Baguette', 'bread', 'disc', 'bk-breads', 'bells:5 credits:1.5 usd:0.75 flowers:2', 18],
  ['pretzel', '🥨', 'Soft pretzel', 'bread', 'disc', 'bk-breads', 'bells:4 credits:1.5 nook:1', 20],
  ['bagel', '🥯', 'Bagel', 'bread', 'disc', 'bk-breads', 'bells:3 credits:1 usd:0.5', 24],
  ['sandwich-loaf', '🥪', 'Sandwich loaf', 'bread', 'cube', 'bk-breads', 'bells:7 credits:2 usd:1 flowers:3', 10],
  ['flatbread', '🫓', 'Flatbread', 'bread', 'disc', 'bk-breads', 'bells:3 credits:1 flowers:2', 16],
  ['croissant', '🥐', 'Croissant', 'pastry', 'disc', 'bk-pastries', 'bells:4 credits:1.5 usd:0.75 flowers:2:fresh', 22],
  ['apple-pie', '🥧', 'Apple pie', 'pastry', 'cube', 'bk-pastries', 'bells:14 credits:4 flowers:6 hours:2:skilled', 6],
  ['cupcake', '🧁', 'Cupcake', 'cake', 'cube', 'bk-pastries', 'bells:4 credits:1.5 flowers:3:fresh usd:0.75', 24],
  ['cake-slice', '🍰', 'Cake slice', 'cake', 'cube', 'bk-pastries', 'bells:6 credits:2 usd:1', 14],
  ['birthday-cake', '🎂', 'Birthday cake', 'cake', 'cube', 'bk-pastries', 'bells:30 credits:9 usd:4.5 hours:4:skilled', 4],
  ['doughnut', '🍩', 'Doughnut', 'pastry', 'disc', 'bk-pastries', 'bells:3 credits:1 nook:1 usd:0.5', 30],
  ['cookie', '🍪', 'Cookie', 'cookie', 'disc', 'bk-pastries', 'bells:2 credits:0.5 usd:0.25 flowers:1', 40],
  ['pancakes', '🥞', 'Pancake stack', 'pastry', 'cube', 'bk-pastries', 'bells:7 credits:2.5 usd:1.25', 9],
  ['coffee', '☕', 'Coffee', 'drink', 'cube', 'bk-drinks', 'bells:3 credits:1 usd:0.5 nook:1', 50],
  ['tea', '🍵', 'Green tea', 'drink', 'cube', 'bk-drinks', 'bells:3 credits:1 flowers:2', 40],
  ['bubble-tea', '🧋', 'Bubble tea', 'drink', 'cube', 'bk-drinks', 'bells:6 credits:2 usd:1 flowers:3:fresh', 20],
  ['milk', '🥛', 'Glass of milk', 'drink', 'cube', 'bk-drinks', 'bells:2 credits:0.5 usd:0.25', 30],
  ['juice', '🧃', 'Fruit juice', 'drink', 'cube', 'bk-drinks', 'bells:3 credits:1 usd:0.5 flowers:2', 28],
  ['iced-drink', '🥤', 'Iced drink', 'drink', 'cube', 'bk-drinks', 'bells:4 credits:1.5 usd:0.75', 26],
]
const BAKERY_STORY = {
  stages: [
    ['idea', 'The idea', '{Name}: the baker wonders how a plain, honest {name} would trade in a world with no default currency.'],
    ['materials', 'Ingredients', 'Flour, water, salt, patience and a warm oven for the {name}.'],
    ['init', 'Mixed', 'The first batch of {name} is mixed and left to rest.'],
    ['build', 'Baked', 'The {name} batch comes out of the oven and is checked by the baker (self-reported).'],
    ['final', 'On the counter', 'Fresh {name} goes on the counter with its accepted exchange forms.'],
    ['update', 'Update', 'Prices re-balanced across Bells, Credits and friends after the first week of trades.'],
  ],
  review: 'Lovely {name}, paid in {pay}.', review2: 'Baked and checked in the sandbox.', users: ['sandbox-regular', 'sandbox-baker'], crowd: 'regulars',
}

const ELECTRONICS_SECTIONS = [
  { id: 'el-phones', name: 'Phones & wearables', desc: 'Things you carry or wear.' },
  { id: 'el-computing', name: 'Computing', desc: 'Laptops, screens and what plugs into them.' },
  { id: 'el-audio', name: 'Audio & video', desc: 'Listen, record and watch.' },
  { id: 'el-accessories', name: 'Power & accessories', desc: 'Batteries, cables and small helpers.' },
]
const ELECTRONICS_ROWS = [
  ['smartphone', '📱', 'Smartphone', 'phone', 'cube', 'el-phones', 'credits:120 usd:60 gold:20', 6],
  ['tablet', '📲', 'Tablet', 'phone', 'cube', 'el-phones', 'credits:160 usd:80 gold:26', 5],
  ['smartwatch', '⌚', 'Smartwatch', 'wearable', 'disc', 'el-phones', 'credits:70 usd:35 gold:12', 8],
  ['laptop', '💻', 'Laptop', 'computer', 'cube', 'el-computing', 'credits:300 usd:150 gold:50 hours:20:expert', 4],
  ['desktop', '🖥️', 'Desktop screen', 'computer', 'cube', 'el-computing', 'credits:140 usd:70 gold:24', 5],
  ['keyboard', '⌨️', 'Keyboard', 'accessory', 'cube', 'el-computing', 'credits:25 usd:12.5 gold:4', 14],
  ['mouse', '🖱️', 'Mouse', 'accessory', 'disc', 'el-computing', 'credits:12 usd:6 gold:2', 20],
  ['printer', '🖨️', 'Printer', 'computer', 'cube', 'el-computing', 'credits:90 usd:45 gold:15', 4],
  ['floppy', '💾', 'Retro floppy disk', 'retro', 'disc', 'el-computing', 'credits:3 usd:1.5 nook:2', 30],
  ['headphones', '🎧', 'Headphones', 'audio', 'disc', 'el-audio', 'credits:60 usd:30 gold:10', 12],
  ['speaker', '🔊', 'Speaker', 'audio', 'cube', 'el-audio', 'credits:45 usd:22.5 gold:8', 10],
  ['microphone', '🎤', 'Microphone', 'audio', 'cube', 'el-audio', 'credits:50 usd:25 gold:8.5 hours:4:skilled', 8],
  ['radio', '📻', 'Radio', 'audio', 'cube', 'el-audio', 'credits:35 usd:17.5 gold:6', 9],
  ['camera', '📷', 'Camera', 'video', 'cube', 'el-audio', 'credits:200 usd:100 gold:34', 5],
  ['video-camera', '📹', 'Video camera', 'video', 'cube', 'el-audio', 'credits:230 usd:115 gold:38', 3],
  ['tv', '📺', 'Television', 'video', 'cube', 'el-audio', 'credits:260 usd:130 gold:44', 4],
  ['battery', '🔋', 'Battery pack', 'power', 'disc', 'el-accessories', 'credits:18 usd:9 gold:3', 25],
  ['plug', '🔌', 'Power plug', 'power', 'disc', 'el-accessories', 'credits:6 usd:3 nook:1', 40],
  ['flashlight', '🔦', 'Flashlight', 'power', 'cube', 'el-accessories', 'credits:10 usd:5 gold:1.5', 22],
  ['controller', '🎮', 'Game controller', 'gaming', 'cube', 'el-accessories', 'credits:40 usd:20 gold:7', 11],
  ['satellite', '📡', 'Satellite dish', 'video', 'disc', 'el-accessories', 'credits:75 usd:37.5 gold:13', 4],
]
const ELECTRONICS_STORY = {
  stages: [
    ['idea', 'The idea', '{Name}: an engineer asks what a plain, honest {name} should cost in a world with no default currency.'],
    ['materials', 'Parts', 'Chips, cells, glass and a lot of tiny screws for the {name}.'],
    ['init', 'Prototype', 'The first {name} prototype is assembled on the sandbox bench.'],
    ['build', 'Tested', 'The {name} lot is tested by its maker (self-reported).'],
    ['final', 'Shipped', 'The {name} lot is on the shelf with its accepted exchange forms.'],
    ['update', 'Update', 'Prices re-balanced across Credits, USD (sim) and Gold after the first week of trades.'],
  ],
  review: 'Works well, {name} paid in {pay}.', review2: 'Tested and boxed in the sandbox.', users: ['sandbox-buyer', 'sandbox-technician'], crowd: 'technicians',
}

const rows = (list, fn) => list.map(fn)
const RAW_BUILTINS = [
  {
    schema: TYPE_SCHEMA_ID, id: 'produce', label: 'Produce stand', emoji: '🥬', desc: 'Fruit and vegetables on a shelf wall. The original sandbox store.',
    layout: 'shelf', theme: { preset: 'market-wood' }, backdrop: { preset: 'market-wood' }, baseSections: 'wellness', sections: [], categories: ['fruit', 'vegetable'],
    accepts: [], lens: 'emoji', productClass: 'produce', shape: 'cube',
    seed: { products: rows(PRODUCE_ROWS, ([slug, emoji, name, category, shape, dims, f, stock]) => prod(`p-${slug}`, emoji, name, category, shape, [dim('Physical'), ...dims.map(dim)], f, stock)), story: PRODUCE_STORY },
  },
  {
    schema: TYPE_SCHEMA_ID, id: 'bakery', label: 'Bakery', emoji: '🥖', desc: 'Breads, pastries and warm drinks on a round display table, in warm colours.',
    layout: 'island',
    theme: { preset: 'market-wood', colors: { hover: '#ffcf5a', selected: '#e0603c', shelfRim: '#7a4b2a', shelfBack: '#f6e7cf', shelfPlank: '#c98f57' } },
    backdrop: { mode: 'gradient', color: '#ffe9c7', color2: '#e9b57a', opacity: 1 }, baseSections: 'none', sections: BAKERY_SECTIONS, categories: ['bread', 'pastry', 'cake', 'cookie', 'drink'],
    accepts: ['bells', 'credits', 'usd', 'flowers', 'hours', 'nook'], lens: 'emoji', productClass: 'bakery', shape: 'cube',
    seed: { products: rows(BAKERY_ROWS, ([slug, emoji, name, category, shape, sec, f, stock]) => prod(`bakery-${slug}`, emoji, name, category, shape, [sec], f, stock)), story: BAKERY_STORY },
  },
  {
    schema: TYPE_SCHEMA_ID, id: 'electronics', label: 'Electronics', emoji: '🔌', desc: 'Gadgets and accessories along an aisle you walk down, in cool colours.',
    layout: 'aisle',
    theme: { preset: 'clean-white', colors: { hover: '#35e0ff', selected: '#7c5cff', shelfRim: '#1c2a3a', shelfBack: '#e8f1f8', shelfPlank: '#5d7a94' } },
    backdrop: { mode: 'gradient', color: '#1b3a57', color2: '#0d1b2a', opacity: 1 }, baseSections: 'none', sections: ELECTRONICS_SECTIONS, categories: ['phone', 'computer', 'audio', 'video', 'accessory', 'power'],
    accepts: ['credits', 'usd', 'gold', 'hours', 'nook'], lens: 'emoji', productClass: 'electronics', shape: 'cube',
    seed: { products: rows(ELECTRONICS_ROWS, ([slug, emoji, name, category, shape, sec, f, stock]) => prod(`electronics-${slug}`, emoji, name, category, shape, [sec], f, stock)), story: ELECTRONICS_STORY },
  },
  {
    schema: TYPE_SCHEMA_ID, id: 'blank', label: 'Blank store', emoji: '🏬', desc: 'An empty shelf wall. Add your own products or import a catalog.',
    layout: 'shelf', theme: { preset: 'market-wood' }, backdrop: null, baseSections: 'wellness', sections: [], categories: [], accepts: [], lens: 'emoji', productClass: 'general', shape: 'cube',
    seed: { products: [] },
  },
]

function deepFreeze (o) { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); Object.values(o).forEach(deepFreeze) } return o }

/** The built-in types, validated and normalised once at load (a built-in that fails its own validator is skipped, never thrown). */
export const BUILTIN_TYPES = Object.freeze(RAW_BUILTINS.map(r => {
  const v = validateType(r)
  if (!v.ok) { try { console.warn('OmniStoreTypes: built-in type rejected', r.id, v.errors.slice(0, 3)) } catch (_) { /* no console */ } return null }
  return deepFreeze(v.type)
}).filter(Boolean))
export const BUILTIN_IDS = Object.freeze(BUILTIN_TYPES.map(t => t.id))
export const DEFAULT_TYPE_ID = 'produce'

// ── Registry (built-ins + extras the dev side registers) ────────────────────────

const extras = new Map()   // id -> normalised type (dev / test types; in memory only)
const clone = (o) => JSON.parse(JSON.stringify(o))

/** A COPY of a type by id (built-in first, then registered extras), or null. */
export function getType (id) {
  const t = BUILTIN_TYPES.find(x => x.id === id) ?? extras.get(id) ?? null
  return t ? clone(t) : null
}
/** Built-in types (always) + the registered extras when includeExtra. The user's picker uses the default (built-ins only). */
export function listTypes ({ includeExtra = false } = {}) {
  return [...BUILTIN_TYPES, ...(includeExtra ? [...extras.values()] : [])].map(clone)
}
export const isBuiltin = (id) => BUILTIN_IDS.includes(id)
/** Register an extra type (dev / test). Validated; a built-in id cannot be replaced. Returns the validation result. */
export function registerType (raw, opts = {}) {
  const v = validateType(raw, opts)
  if (!v.ok) return v
  if (isBuiltin(v.type.id)) return { ...v, ok: false, type: null, errors: [`id: "${v.type.id}" is a built-in type and cannot be replaced`] }
  extras.set(v.type.id, deepFreeze(v.type))
  return v
}
export function unregisterType (id) { return extras.delete(id) }
export function _clearExtras () { extras.clear() }
