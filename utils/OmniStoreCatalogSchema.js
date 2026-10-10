/**
 * utils/OmniStoreCatalogSchema.js — the store catalog JSON schema "omni-store-catalog/1": export, validate, AI prompt (V177)
 *
 * PURE: no DOM, no storage, no imports. The caller passes in what the app knows (value types, section ids). The input is
 * UNTRUSTED (a paste from an AI assistant, a file, a stranger): it is parsed with JSON.parse only, never evaluated, and the
 * output contains ONLY fields this file builds from checked values (nothing from the input object is spread or copied
 * wholesale, so unknown keys and `__proto__` tricks go nowhere).
 *
 * validateCatalog(input, ctx) -> { ok, schema, errors[], warnings[], store:{name,type}, products:[row], accepted:[product], counts }
 *   row = { index, id, name, status:'ok'|'warn'|'error', errors[], warnings[], notes[] }   (notes = harmless facts, e.g. a generated id; they do not make a row 'warn')    (status error = NOT imported)
 *   accepted = the products that passed, in the store model's shape (feed them to OmniStoreModel.importProducts)
 *   ok = no global error and at least one accepted product.
 * V178 additions (all backward compatible): `category` is now free text (<= 24 chars; 'vegetable' keeps its green tint, anything else
 * is shown the same as fruit); extractJson() (tolerant paste parsing), buildAiPrompt() options object (user description, count, accepted
 * forms, category hint), buildTemplate(), buildFixPrompt() (loop errors back to an AI), plainMessage(), validateProduct() (one product,
 * used by the store model's manual add / edit so there is ONE sanitiser).
 * Errors reject a product (or, global, the whole catalog); warnings are repairs the preview shows before anything is applied.
 *
 * RULES
 *   text    strings only; no '<' or '>' (no HTML); control characters are stripped (warning); over the cap = ERROR (not cut)
 *   numbers must be JSON numbers (a "3" string is an error); price qty > 0 and clamped to MAX_QTY (warning), stock rounded >= 0
 *   value types / quality grades must exist in ctx.types (unknown = ERROR, never invented, never mapped to something else)
 *   media   image: http(s) URL or data:image/(png|jpeg|gif|webp);base64 <= 512 KB each and <= 1.5 MB per catalog; video:
 *           http(s) URL only. javascript:, file:, ftp:, relative paths, data: videos etc. = ERROR.
 *   count   <= 3000 products (V181; was 500), <= 8 price forms, <= 12 lifecycle entries; raw text <= 4 MB
 */

export const SCHEMA_ID = 'omni-store-catalog/1'
export const LIMITS = {
  products: 3000, name: 80, note: 300, emoji: 32,   // V181: products 500 -> 3000 (all 1,914 Unicode emoji fit with room to spare), emoji 16 -> 32 (a pasted skin-tone family / kiss sequence is up to ~26 units)
  id: 64, storeName: 40, storeType: 40, forms: 8, lifecycle: 12, sectionIds: 12,
  stage: 16, title: 60, category: 24, description: 2000, url: 2000, imageBytes: 512 * 1024, imageBudget: 1.5 * 1024 * 1024, rawChars: 4 * 1024 * 1024, stock: 1e6, qty: 1e6,
}
export const AI_PRODUCTS_MAX = 500   // what the AI prompt asks for; an AI reply cannot realistically hold more (the import cap is LIMITS.products)
export const SHAPES = ['cube', 'disc']
export const CATEGORIES = ['fruit', 'vegetable']   // the two the app knows by name; any other short word is accepted (V178)
export const DEFAULT_CATEGORY = 'other'
export const MEDIA_KINDS = ['emoji', 'image', 'video']
export const KNOWN_PRODUCT_FIELDS = ['id', 'name', 'emoji', 'category', 'sectionIds', 'shape', 'media', 'price', 'stock', 'lifecycle', 'note']

const HTTP_RE = /^https?:\/\/[^\s"'<>\\]{1,2000}$/i
const DATA_IMG_RE = /^data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/]+=*$/
const ID_RE = /^[A-Za-z0-9_.:-]{1,64}$/
const CTRL_RE = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k)
const finite = (x) => typeof x === 'number' && Number.isFinite(x)
const dataBytes = (u) => Math.floor((u.length - u.indexOf(',') - 1) * 3 / 4)

/** Check one free-text field. Returns {v, err?, warn?}; v is the cleaned string (control chars removed, trimmed). */
function checkText (raw, max, label, { required = false } = {}) {
  if (raw === undefined || raw === null) return required ? { v: '', err: `${label}: missing` } : { v: '' }
  if (typeof raw !== 'string') return { v: '', err: `${label}: must be text (got ${Array.isArray(raw) ? 'a list' : typeof raw})` }
  if (/[<>]/.test(raw)) return { v: '', err: `${label}: HTML is not allowed (found < or >)` }
  const cleaned = raw.replace(CTRL_RE, '')
  const warn = cleaned.length !== raw.length ? `${label}: control characters removed` : null
  const v = cleaned.trim()
  if (v.length > max) return { v: '', err: `${label}: too long (${v.length} > ${max} characters)` }
  if (required && !v) return { v: '', err: `${label}: empty` }
  return { v, warn }
}

export function slugify (s) {
  return String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'item'
}

// ── Export ──────────────────────────────────────────────────────────────────────

/** Store (OmniStoreModel.getStore()) -> a catalog object of this schema. Pure; the result round-trips through validateCatalog. */
export function exportCatalog (store, { type = 'produce' } = {}) {
  const st = store ?? {}
  return {
    schema: SCHEMA_ID,
    store: { name: String(st.name ?? ''), type },
    sections: (st.sections ?? []).map(s => ({ id: s.id, name: s.name, kind: s.kind })),
    products: (st.products ?? []).map(p => {
      const o = {
        id: p.id, name: p.name, emoji: p.media?.emoji ?? p.emoji, category: p.category, sectionIds: [...(p.sectionIds ?? [])], shape: p.shape,
        media: { emoji: p.media?.emoji ?? p.emoji, image: p.media?.image ?? null, video: p.media?.video ?? null, active: p.media?.active ?? 'emoji' },
        price: (p.price ?? []).map(f => (f.quality ? { type: f.type, qty: f.qty, quality: f.quality } : { type: f.type, qty: f.qty })),
        stock: p.stock,
        lifecycle: (p.lifecycle ?? []).map(l => ({ stage: l.stage, title: l.title, note: l.note, t: l.t })),
      }
      if (p.note) o.note = p.note
      return o
    }),
  }
}

// ── Validate ────────────────────────────────────────────────────────────────────

/**
 * @param {string|object} input  JSON text or an already-parsed object
 * @param {{types:Array<{id:string,qualityScale:Array<{id:string}>}>, sectionIds:string[]}} ctx
 */
export function validateCatalog (input, ctx = {}) {
  const res = { ok: false, schema: SCHEMA_ID, errors: [], warnings: [], store: { name: '', type: '' }, products: [], accepted: [], counts: { total: 0, ok: 0, warn: 0, error: 0 } }
  const types = new Map((ctx.types ?? []).map(t => [t.id, new Set((t.qualityScale ?? []).map(q => q.id))]))
  const sectionIds = new Set(ctx.sectionIds ?? [])
  const defaultSection = (ctx.sectionIds ?? [])[0] ?? null

  let data = input
  if (typeof input === 'string') {
    if (input.length > LIMITS.rawChars) { res.errors.push(`Input is too large (${input.length} characters, limit ${LIMITS.rawChars})`); return res }
    if (!input.trim()) { res.errors.push('Input is empty'); return res }
    try { data = JSON.parse(input) } catch (e) { res.errors.push('Not valid JSON: ' + String(e.message).slice(0, 160)); return res }
  }
  if (!isObj(data)) { res.errors.push('The top level must be a JSON object { schema, store, products }'); return res }
  if (data.schema === undefined) res.warnings.push(`"schema" is missing; assuming ${SCHEMA_ID}`)
  else if (data.schema !== SCHEMA_ID) { res.errors.push(`Unsupported schema "${String(data.schema).slice(0, 40)}" (this app reads ${SCHEMA_ID})`); return res }

  if (data.store !== undefined) {
    if (!isObj(data.store)) res.errors.push('"store" must be an object { name, type }')
    else {
      const n = checkText(data.store.name, LIMITS.storeName, 'store.name'); if (n.err) res.errors.push(n.err); else res.store.name = n.v
      const t = checkText(data.store.type, LIMITS.storeType, 'store.type'); if (t.err) res.errors.push(t.err); else res.store.type = t.v
    }
  }
  if (data.sections !== undefined) {
    if (!Array.isArray(data.sections)) res.errors.push('"sections" must be a list')
    else {
      const unknown = data.sections.filter(s => !isObj(s) || typeof s.id !== 'string' || !sectionIds.has(s.id)).length
      res.warnings.push(`"sections" is informational: sections are not imported in ${SCHEMA_ID}${unknown ? ` (${unknown} listed section(s) do not exist in this app)` : ''}`)
    }
  }
  if (!Array.isArray(data.products)) { res.errors.push('"products" must be a list'); return res }
  if (data.products.length > LIMITS.products) { res.errors.push(`Too many products (${data.products.length}, limit ${LIMITS.products})`); return res }
  if (!data.products.length) { res.errors.push('"products" is empty'); return res }
  if (res.errors.length) return res

  const usedIds = new Set()
  let imageBytes = 0
  data.products.forEach((rp, index) => {
    const row = { index, id: null, name: '', status: 'ok', errors: [], warnings: [], notes: [] }
    const err = (m) => row.errors.push(m)
    const warn = (m) => row.warnings.push(m)
    res.products.push(row)
    if (!isObj(rp)) { err('Not an object'); finish(row); return }
    Object.keys(rp).filter(k => !KNOWN_PRODUCT_FIELDS.includes(k)).slice(0, 5).forEach(k => warn(`Unknown field ignored: ${String(k).slice(0, 30).replace(/[<>]/g, '')}`))

    const nm = checkText(rp.name, LIMITS.name, 'name', { required: true }); if (nm.err) err(nm.err); if (nm.warn) warn(nm.warn)
    row.name = nm.v
    const nt = checkText(rp.note, LIMITS.note, 'note'); if (nt.err) err(nt.err); if (nt.warn) warn(nt.warn)

    // id
    let id = null
    if (rp.id === undefined || rp.id === null || rp.id === '') {
      if (nm.v) { const base = 'p-' + slugify(nm.v); id = base; let k = 2; while (usedIds.has(id)) id = `${base}-${k++}`; row.notes.push(`No id given: using "${id}"`) }
    } else if (typeof rp.id !== 'string' || !ID_RE.test(rp.id)) err('id: must be 1-64 characters of letters, digits and _ . : -')
    else if (usedIds.has(rp.id)) err(`id: duplicate "${rp.id}" in this catalog`)
    else id = rp.id
    row.id = id

    // emoji
    const mediaIn = isObj(rp.media) ? rp.media : null
    if (rp.media !== undefined && rp.media !== null && !mediaIn) err('media: must be an object { emoji, image, video, active }')
    let emojiRaw = mediaIn && mediaIn.emoji !== undefined && mediaIn.emoji !== null ? mediaIn.emoji : rp.emoji
    const em = checkText(emojiRaw, LIMITS.emoji, 'emoji'); if (em.err) err(em.err); if (em.warn) warn(em.warn)
    let emoji = em.v
    if (!emoji && !em.err) { emoji = '❓'; warn('emoji: missing, using ❓') }

    // category / shape
    let category = DEFAULT_CATEGORY
    if (rp.category === undefined || rp.category === null || rp.category === '') warn(`category: missing, using "${DEFAULT_CATEGORY}"`)
    else {
      const ct = checkText(rp.category, LIMITS.category, 'category')
      if (ct.err) err(ct.err); else { category = ct.v || DEFAULT_CATEGORY; if (ct.warn) warn(ct.warn) }
    }
    let shape = 'cube'
    if (rp.shape === undefined) warn('shape: missing, using "cube"')
    else if (!SHAPES.includes(rp.shape)) warn(`shape: must be ${SHAPES.join(' or ')}, using "cube"`)
    else shape = rp.shape

    // sections
    let secs = []
    if (rp.sectionIds === undefined) { /* the default placement below says so once */ }
    else if (!Array.isArray(rp.sectionIds) || rp.sectionIds.some(s => typeof s !== 'string')) err('sectionIds: must be a list of section ids (text)')
    else {
      const slice = rp.sectionIds.slice(0, LIMITS.sectionIds)
      if (rp.sectionIds.length > LIMITS.sectionIds) warn(`sectionIds: only the first ${LIMITS.sectionIds} are used`)
      const bad = slice.filter(s => !sectionIds.has(s)); secs = slice.filter(s => sectionIds.has(s))
      if (bad.length) warn(`sectionIds: unknown section(s) dropped: ${bad.slice(0, 3).map(s => s.slice(0, 24).replace(/[<>]/g, '')).join(', ')}`)
    }
    if (!secs.length && defaultSection) { secs = [defaultSection]; warn(`sectionIds: missing or none valid, placed in "${defaultSection}"`) }

    // media
    let image = null, video = null, active = 'emoji'
    if (mediaIn) {
      if (mediaIn.image !== undefined && mediaIn.image !== null && mediaIn.image !== '') {
        const u = mediaIn.image
        if (typeof u !== 'string') err('media.image: must be text')
        else if (u.startsWith('data:')) {
          if (!DATA_IMG_RE.test(u)) err('media.image: data URL must be data:image/png|jpeg|gif|webp;base64,...')
          else if (dataBytes(u) > LIMITS.imageBytes) err(`media.image: image is too large (${Math.round(dataBytes(u) / 1024)} KB, limit ${LIMITS.imageBytes / 1024} KB)`)
          else if (imageBytes + dataBytes(u) > LIMITS.imageBudget) err('media.image: the catalog already carries the maximum of embedded image data (1.5 MB); use an https URL')
          else { image = u; imageBytes += dataBytes(u) }
        } else if (u.length > LIMITS.url) err(`media.image: URL too long (limit ${LIMITS.url})`)
        else if (!HTTP_RE.test(u)) err('media.image: only http(s) URLs or data:image are allowed (found "' + u.slice(0, 20).replace(/[<>]/g, '') + '...")')
        else image = u
      }
      if (mediaIn.video !== undefined && mediaIn.video !== null && mediaIn.video !== '') {
        const u = mediaIn.video
        if (typeof u !== 'string') err('media.video: must be text')
        else if (u.length > LIMITS.url) err(`media.video: URL too long (limit ${LIMITS.url})`)
        else if (!HTTP_RE.test(u)) err('media.video: only http(s) URLs are allowed (found "' + u.slice(0, 20).replace(/[<>]/g, '') + '...")')
        else video = u
      }
      if (mediaIn.active !== undefined) {
        if (!MEDIA_KINDS.includes(mediaIn.active)) warn('media.active: must be emoji, image or video; using "emoji"')
        else if (mediaIn.active === 'image' && !image) warn('media.active "image" but no valid image; using "emoji"')
        else if (mediaIn.active === 'video' && !video) warn('media.active "video" but no valid video; using "emoji"')
        else active = mediaIn.active
      }
    }

    // price forms
    const price = []
    if (!Array.isArray(rp.price) || !rp.price.length) err('price: needs at least one form { type, qty, quality? }')
    else {
      if (rp.price.length > LIMITS.forms) warn(`price: only the first ${LIMITS.forms} forms are used`)
      rp.price.slice(0, LIMITS.forms).forEach((f, i) => {
        const at = `price[${i}]`
        if (!isObj(f)) { err(`${at}: not an object`); return }
        if (typeof f.type !== 'string' || !types.has(f.type)) { err(`${at}: unknown value type "${String(f.type).slice(0, 24).replace(/[<>]/g, '')}" (known: ${[...types.keys()].join(', ')})`); return }
        if (!finite(f.qty)) { err(`${at}: qty must be a number`); return }
        if (f.qty <= 0) { err(`${at}: qty must be greater than 0`); return }
        let qty = f.qty
        if (qty > LIMITS.qty) { qty = LIMITS.qty; warn(`${at}: qty clamped to ${LIMITS.qty}`) }
        const form = { type: f.type, qty }
        if (f.quality !== undefined && f.quality !== null && f.quality !== '') {
          if (typeof f.quality !== 'string' || !types.get(f.type).has(f.quality)) { err(`${at}: quality "${String(f.quality).slice(0, 24).replace(/[<>]/g, '')}" does not exist for ${f.type} (known: ${[...types.get(f.type)].join(', ')})`); return }
          form.quality = f.quality
        }
        price.push(form)
      })
    }

    // stock
    let stock = 0
    if (rp.stock === undefined) warn('stock: missing, using 0')
    else if (!finite(rp.stock)) err('stock: must be a number')
    else if (rp.stock < 0) { warn('stock: negative, using 0') }
    else { stock = Math.round(rp.stock); if (stock > LIMITS.stock) { stock = LIMITS.stock; warn(`stock: clamped to ${LIMITS.stock}`) } }

    // lifecycle
    const lifecycle = []
    if (rp.lifecycle !== undefined) {
      if (!Array.isArray(rp.lifecycle)) err('lifecycle: must be a list')
      else {
        if (rp.lifecycle.length > LIMITS.lifecycle) warn(`lifecycle: only the first ${LIMITS.lifecycle} entries are used`)
        rp.lifecycle.slice(0, LIMITS.lifecycle).forEach((l, i) => {
          if (!isObj(l)) { warn(`lifecycle[${i}]: not an object, dropped`); return }
          const st = checkText(l.stage, LIMITS.stage, `lifecycle[${i}].stage`, { required: true })
          const ti = checkText(l.title, LIMITS.title, `lifecycle[${i}].title`)
          const no = checkText(l.note, LIMITS.note, `lifecycle[${i}].note`)
          const bad = st.err || ti.err || no.err
          if (bad) { err(bad); return }
          lifecycle.push({ stage: st.v, title: ti.v, note: no.v, t: finite(l.t) ? l.t : 0 })
        })
      }
    }

    if (!row.errors.length && id) {
      usedIds.add(id)
      res.accepted.push({
        id, name: nm.v, emoji, category, sectionIds: secs, shape, media: { emoji, image, video, active }, price, stock, lifecycle,
        ...(nt.v ? { note: nt.v } : {}),
      })
    }
    finish(row)
  })

  function finish (row) { row.status = row.errors.length ? 'error' : (row.warnings.length ? 'warn' : 'ok'); res.counts[row.status]++; res.counts.total++ }
  res.ok = res.errors.length === 0 && res.accepted.length > 0
  return res
}

// ── One product (used by the store model's manual add / edit) ───────────────────

/**
 * Validate ONE product with exactly the same rules as a catalog row.
 * @returns {{ok:boolean, product:object|null, errors:string[], warnings:string[]}}  product = the cleaned product (model shape)
 */
export function validateProduct (raw, ctx = {}) {
  const r = validateCatalog({ schema: SCHEMA_ID, products: [raw] }, ctx)
  const row = r.products[0] ?? { errors: r.errors, warnings: [] }
  const product = r.accepted[0] ?? null
  return { ok: !!product && !row.errors.length, product, errors: [...r.errors, ...row.errors], warnings: row.warnings }
}

/** Rewrite a validator message in everyday words ("price[1]:" -> "Payment option 2:"). Pure; unknown messages pass through. */
export function plainMessage (m) {
  return String(m ?? '')
    .replace(/^price\[(\d+)\]:/, (_, i) => `Payment option ${+i + 1}:`)
    .replace(/^price:/, 'Payment options:')
    .replace(/^media\.image:/, 'Image link:').replace(/^media\.video:/, 'Video link:').replace(/^media\.active/, 'Shown media')
    .replace(/^media:/, 'Media:').replace(/^sectionIds:/, 'Sections:').replace(/^lifecycle\[(\d+)\](\.\w+)?:/, (_, i) => `History step ${+i + 1}:`)
    .replace(/^lifecycle:/, 'History:').replace(/^stock:/, 'Stock:').replace(/^emoji:/, 'Emoji:').replace(/^name:/, 'Name:').replace(/^note:/, 'Note:')
    .replace(/^category:/, 'Category:').replace(/^shape:/, 'Shape:').replace(/^id:/, 'Product id:')
    .replace(/unknown value type/, 'unknown payment type').replace(/\bqty\b/g, 'amount')
}

// ── Tolerant reading of an AI reply ─────────────────────────────────────────────

const SMART_RE = /[“”‘’]/
function tryParse (t) { try { return { ok: true, value: JSON.parse(t) } } catch (e) { return { ok: false, message: String(e && e.message) } } }

/** Top-level balanced {...} / [...] spans (string-aware). Also reports an unclosed opener. */
function balancedSpans (text) {
  const spans = []
  let unclosed = -1
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (c !== '{' && c !== '[') continue
    let depth = 0, inStr = false, j = i
    for (; j < text.length; j++) {
      const d = text[j]
      if (inStr) { if (d === '\\') j++; else if (d === '"') inStr = false; continue }
      if (d === '"') inStr = true
      else if (d === '{' || d === '[') depth++
      else if (d === '}' || d === ']') { depth--; if (depth === 0) break }
    }
    if (depth === 0 && j < text.length) { spans.push({ start: i, text: text.slice(i, j + 1) }); i = j } else { if (unclosed < 0) unclosed = i; break }
  }
  return { spans, unclosed }
}

/** Scan outside strings for the things plain JSON forbids. Returns {trailingComma:index|-1, comment:index|-1}. */
function scanForbidden (t) {
  let inStr = false, trailingComma = -1, comment = -1, lastComma = -1
  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (inStr) { if (c === '\\') i++; else if (c === '"') inStr = false; continue }
    if (c === '"') { inStr = true; lastComma = -1 }
    else if (c === ',') lastComma = i
    else if (c === '}' || c === ']') { if (lastComma >= 0 && trailingComma < 0) trailingComma = lastComma; lastComma = -1 }
    else if (c === '/' && (t[i + 1] === '/' || t[i + 1] === '*') && comment < 0) comment = i
    else if (!/\s/.test(c)) lastComma = -1
  }
  return { trailingComma, comment }
}
const lineOf = (t, pos) => { let n = 1; for (let i = 0; i < pos && i < t.length; i++) if (t[i] === '\n') n++; return n }

function diagnose (primary, engineMessage, unclosed) {
  const problems = []
  let pos = null
  if (SMART_RE.test(primary)) problems.push('The JSON uses curly quotes (“ ” ‘ ’) instead of straight quotes ("). They are NOT fixed automatically. Ask the AI to use plain straight quotes.')
  const f = scanForbidden(primary)
  if (f.trailingComma >= 0) { pos = f.trailingComma; problems.push(`Trailing comma on line ${lineOf(primary, f.trailingComma)}: a comma sits right before a closing } or ]. Remove that comma (nothing may follow the last item).`) }
  if (f.comment >= 0) problems.push(`Comments are not allowed in JSON (found one on line ${lineOf(primary, f.comment)}).`)
  if (unclosed) problems.push('The JSON looks cut off: a { or [ is never closed. The reply may have been truncated; ask the AI to continue, or to return fewer products.')
  if (!problems.length) {
    const m = /position (\d+)/.exec(engineMessage || '')
    if (m) pos = +m[1]
    problems.push(`Not valid JSON${pos !== null ? ` near line ${lineOf(primary, pos)}` : ''}: ${String(engineMessage || 'unknown problem').replace(/\s+/g, ' ').slice(0, 140)}`)
  }
  return { problems, pos }
}

const looksLikeCatalog = (v) => (v && typeof v === 'object' && !Array.isArray(v) && (Array.isArray(v.products) || v.schema !== undefined)) || (Array.isArray(v) && v.length > 0 && v.every(x => x && typeof x === 'object' && !Array.isArray(x)))

/**
 * Pull the catalog JSON out of whatever an AI assistant (or a person) pasted.
 * Accepts: bare JSON; JSON inside ```json fences; JSON with chatty prose before / after; a BOM; a bare products array (wrapped as
 * {schema, products}); one product object (wrapped). NEVER repairs: curly quotes, trailing commas, comments, cut-off text are reported.
 * @returns {{ok:boolean, value:any, source:string, notes:string[], errors:string[], error:string|null, pos:number|null}}
 *   source = the exact text that was parsed (what the fix-it prompt quotes); pos = index of the problem inside `primary` when known
 */
export function extractJson (input) {
  const out = { ok: false, value: null, source: '', notes: [], errors: [], error: null, pos: null, primary: '' }
  const fail = (...m) => { out.errors = m; out.error = m[0]; return out }
  if (typeof input !== 'string') return fail('Nothing to read.')
  if (input.length > LIMITS.rawChars) return fail(`The text is too large (${input.length} characters, limit ${LIMITS.rawChars}).`)
  let text = input
  if (text.charCodeAt(0) === 0xFEFF) { text = text.slice(1); out.notes.push('Removed an invisible byte-order mark at the start.') }
  text = text.replace(/^\s+|\s+$/g, '')
  if (!text) return fail('Nothing pasted yet.')

  let found = null   // {value, source, how}
  const whole = tryParse(text)
  if (whole.ok && (whole.value === null || typeof whole.value !== 'object')) return fail('The text is valid JSON but not a catalog: expected an object with a "products" list.')
  if (whole.ok) found = { value: whole.value, source: text, how: 'whole' }
  const cands = []
  if (!found) {
    const sources = []
    const fence = /```[A-Za-z0-9_+-]*[ \t]*\r?\n?([\s\S]*?)```/g
    let m
    while ((m = fence.exec(text))) sources.push({ t: m[1].trim(), how: 'fence' })
    sources.push({ t: text, how: 'prose' })
    let unclosed = false, firstBad = null
    for (const src of sources) {
      const direct = src.how === 'fence' ? tryParse(src.t) : { ok: false }
      if (direct.ok) cands.push({ value: direct.value, source: src.t, how: 'fence' })
      else {
        const b = balancedSpans(src.t)
        b.spans.forEach(sp => { const r = tryParse(sp.text); if (r.ok) cands.push({ value: r.value, source: sp.text, how: src.how }); else if (!firstBad) firstBad = { text: sp.text, message: r.message, how: src.how } })
        if (b.unclosed >= 0 && !firstBad) { firstBad = { text: src.t.slice(b.unclosed), message: 'unclosed', how: src.how, unclosed: true } }
      }
      if (cands.some(c => looksLikeCatalog(c.value))) break
    }
    const score = (c) => (c.value && !Array.isArray(c.value) && Array.isArray(c.value.products) ? 3 : (c.value && !Array.isArray(c.value) && c.value.schema !== undefined ? 2 : (looksLikeCatalog(c.value) ? 1 : 0)))
    cands.sort((a, b) => score(b) - score(a))
    if (cands.length && score(cands[0]) > 0) {
      found = cands[0]
      if (cands.filter(c => score(c) > 0).length > 1) out.notes.push('Found more than one JSON block; using the one that holds the products.')
    } else {
      // diagnose the most likely culprit
      const bad = firstBad ?? { text: text.slice(Math.max(0, text.search(/[{[]/))), message: whole.message, how: 'prose' }
      if (!/[{[]/.test(text)) return fail('No JSON found in the text. Ask the AI to reply with ONLY the JSON object.')
      const d = diagnose(bad.text, bad.message, !!bad.unclosed)
      out.primary = bad.text; out.pos = d.pos
      return fail(...d.problems)
    }
  }
  out.source = found.source
  if (found.how === 'fence') out.notes.push('Took the JSON from inside a code block and ignored the text around it.')
  else if (found.how === 'prose') out.notes.push('Ignored the text around the JSON.')
  let v = found.value
  if (Array.isArray(v)) { v = { schema: SCHEMA_ID, products: v }; out.notes.push('The text is a bare list of products; treated it as the "products" of a catalog.') }
  else if (v && typeof v === 'object' && v.products === undefined && v.name !== undefined && v.price !== undefined) { v = { schema: SCHEMA_ID, products: [v] }; out.notes.push('The text is a single product; treated it as a catalog of one product.') }
  out.ok = true; out.value = v
  return out
}

// ── AI prompt / template / fix-it prompt ────────────────────────────────────────

export const EXAMPLE_PRODUCT = {
  id: 'p-example-apple', name: 'Example apple', emoji: '🍎', category: 'fruit', sectionIds: ['dim-physical'], shape: 'cube',
  media: { emoji: '🍎', image: null, video: null, active: 'emoji' },
  price: [{ type: 'credits', qty: 5 }, { type: 'bells', qty: 10 }],
  stock: 20, lifecycle: [{ stage: 'grown', title: 'Grown', note: 'Picked locally.', t: 0 }], note: 'Crisp and sweet.',
}

/** A filled example product built from what exists in THIS app (so it is valid under validateCatalog with the same ctx). */
export function buildExample ({ types = [], sections = [], acceptedTypes = [] } = {}) {
  const usable = types.filter(t => t && t.payable !== false)
  const pick = [...acceptedTypes.map(id => usable.find(t => t.id === id)).filter(Boolean), ...usable].filter((t, i, a) => a.indexOf(t) === i).slice(0, 2)
  if (!pick.length) return JSON.parse(JSON.stringify(EXAMPLE_PRODUCT))
  const ex = JSON.parse(JSON.stringify(EXAMPLE_PRODUCT))
  ex.price = pick.map((t, i) => {
    const f = { type: t.id, qty: i === 0 ? 5 : 10 }
    if (i === 1 && (t.qualityScale ?? []).length > 1) f.quality = (t.qualityScale.find(q => q.id === t.refQuality) ?? t.qualityScale[0]).id
    return f
  })
  const sec = sections.find(s => s.kind !== 'media') ?? sections[0]
  if (sec) ex.sectionIds = [sec.id]
  return ex
}

function typeLines (types) {
  if (!types.length) return '- (none)'
  const q = (t) => (t.qualityScale ?? []).map(x => x.id).join(' | ')
  if (types.length <= 12) return types.map(t => `- ${t.id} ("${t.name}", unit ${t.unit}): qualities = ${q(t)}`).join('\n')
  const groups = new Map()
  types.forEach(t => { const k = q(t); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(t.id) })
  return [...groups].map(([k, ids]) => `- ${ids.join(', ')}: qualities = ${k}`).join('\n')
}
const sectionLines = (sections) => sections.filter(s => s.kind !== 'media').map(s => `- ${s.id} (${s.name})`).join('\n') || '- (none)'

/** The JSON a user can edit by hand or give to an AI as a blank form: the schema id, a store block and ONE filled example product. */
export function buildTemplate (opts = {}) {
  return { schema: SCHEMA_ID, store: { name: 'My store', type: 'general' }, products: [buildExample(opts)] }
}

/**
 * A ready prompt to paste into any AI assistant: explains the schema, lists what exists in THIS app, asks for ONLY JSON.
 * Backward compatible: buildAiPrompt({types, sections}) is the V177 call (placeholder where the business goes).
 * Options (all optional): description (the user's words, <= 2000 chars), count (about N products), categoryHint (<= 24 chars),
 * acceptedTypes (value type ids the customers pay with), blank:true (no business section at all).
 */
export function buildAiPrompt ({ types = [], sections = [], description = '', count = 0, categoryHint = '', acceptedTypes = [], blank = false, storeName = '', storeType = '', typeHint = null } = {}) {
  // V182: the active store's name / type / type hint (utils/OmniStoreTypes.js describeForPrompt) pre-fill the example and add a STORE TYPE block; without them the prompt is as before
  const plain = (v, n) => String(v ?? '').replace(/[<>"\\\u0000-\u001f]/g, '').trim().slice(0, n)
  const sName = plain(storeName, LIMITS.storeName) || 'My store'
  const sType = /^[A-Za-z0-9_.:-]{1,40}$/.test(String(storeType ?? '')) ? String(storeType) : 'general'
  const example = { schema: SCHEMA_ID, store: { name: sName, type: sType }, products: [buildExample({ types, sections, acceptedTypes })] }
  const th = typeHint && typeof typeHint === 'object' ? typeHint : null
  const typeBlock = th ? `STORE TYPE: ${plain(th.label, 40) || sType}${th.productClass ? ` (product class "${plain(th.productClass, 24)}")` : ''}
${(th.categories ?? []).length ? `Typical categories: ${th.categories.map(c => plain(c, 24)).filter(Boolean).join(', ')}\n` : ''}${(th.sections ?? []).length ? `Sections of this type (use these ids in sectionIds): ${th.sections.map(x => `${plain(x.id, 64)} (${plain(x.name, 28)})`).join(', ')}\n` : ''}${(th.accepts ?? []).length ? `This type of store takes payment in: ${th.accepts.map(c => plain(c, 24)).join(', ')}\n` : ''}
` : ''
  const accepted = acceptedTypes.filter(id => types.some(t => t.id === id))
  const desc = String(description ?? '').replace(/\s+$/g, '').slice(0, LIMITS.description)
  const n = Math.max(0, Math.min(AI_PRODUCTS_MAX, Math.round(+count || 0)))
  const hint = String(categoryHint ?? '').replace(/[<>]/g, '').trim().slice(0, LIMITS.category)
  const wants = []
  if (n) wants.push(`- Create about ${n} products.`)
  if (hint) wants.push(`- Use "${hint}" as the category for products that fit it.`)
  if (accepted.length) wants.push(`- Customers can pay with: ${accepted.join(', ')}. Give every product price forms ONLY from these types (more than one form per product where it makes sense).`)
  return `I run a business and want to load its products into a 3D store. Turn the business description at the end into ONE JSON object that follows the schema "${SCHEMA_ID}" exactly.

RULES
- Reply with ONLY the JSON object: no explanation, no markdown fence, no comments, no trailing commas, straight " quotes only.
- Top level: {"schema": "${SCHEMA_ID}", "store": {"name": text <= ${LIMITS.storeName}, "type": text}, "products": [ ... ]} (at most ${AI_PRODUCTS_MAX} products).
- Each product: id (optional; letters, digits, _ . : - ; unique), name (text <= ${LIMITS.name}), emoji (ONE fitting emoji; repeat it in media.emoji), category (one short lowercase word <= ${LIMITS.category}, e.g. "bread", "drink", "fruit"), sectionIds (ids from SECTIONS below), shape ("cube" or "disc"), media {"emoji": the same emoji, "image": https URL or null, "video": https URL or null, "active": "emoji"}, price (1 to ${LIMITS.forms} forms: {"type": a VALUE TYPE id below, "qty": number > 0, "quality": optional, one of that type's qualities}), stock (whole number >= 0), lifecycle (optional list of {"stage","title","note","t":0}), note (optional text <= ${LIMITS.note}).
- Several price forms mean the customer may pay with ANY ONE of them. The EXAMPLE at the end is valid, but do not copy its content.
- No HTML anywhere (no < or > characters). Use image / video URLs only if I give real https:// ones; otherwise null. Do not invent value types or qualities: use only the ones listed.

VALUE TYPES AVAILABLE
${typeLines(types)}

SECTIONS AVAILABLE (sectionIds)
${sectionLines(sections)}

${typeBlock}EXAMPLE
${JSON.stringify(example, null, 2)}
${blank ? '' : `
${wants.length ? `WHAT I NEED\n${wants.join('\n')}\n\n` : ''}MY BUSINESS:
${desc || '(describe your products, prices and what customers can pay with here)'}`}`
}

const clip = (s, n) => (s.length > n ? s.slice(0, n) + '…' : s)

/**
 * A follow-up prompt for the AI that made the JSON: the exact problems plus the offending JSON, asking for the FULL corrected JSON.
 * Works for both a text that is not JSON at all (pass extract = the failed extractJson result) and for validation errors
 * (pass result = validateCatalog's result and extract.value = the parsed catalog so the offending products can be quoted).
 */
export function buildFixPrompt ({ result = null, extract = null, text = '', types = [], maxRows = 12 } = {}) {
  const problems = []
  let snippets = ''
  if (extract && !extract.ok) {
    extract.errors.forEach(e => problems.push(e))
    const src = extract.primary || text
    const at = extract.pos ?? 0
    snippets = `THE TEXT AROUND THE PROBLEM\n${clip(src.slice(Math.max(0, at - 250), at + 250), 600)}\n`
  } else if (result) {
    result.errors.forEach(e => problems.push(e))
    const rows = result.products.filter(r => r.status === 'error')
    const prods = extract?.value?.products
    rows.slice(0, maxRows).forEach(r => {
      r.errors.forEach(e => problems.push(`Product ${r.index + 1}${r.name ? ` ("${r.name}")` : ''}: ${plainMessage(e)}`))
    })
    if (rows.length > maxRows) problems.push(`... and ${rows.length - maxRows} more products with problems.`)
    if (Array.isArray(prods)) {
      const parts = rows.slice(0, maxRows).map(r => { let j = ''; try { j = JSON.stringify(prods[r.index]) } catch (_) { j = '' } return `Product ${r.index + 1}: ${clip(j ?? '', 600)}` })
      if (parts.length) snippets = `THE PRODUCTS WITH PROBLEMS (as you wrote them)\n${parts.join('\n')}\n`
    }
  }
  const ok = types.filter(t => t && t.payable !== false)
  return `The JSON you gave me could not be loaded into my store. Fix the problems below and return the FULL corrected JSON (every product, not only the ones you fix), still following the schema "${SCHEMA_ID}". Reply with ONLY the JSON: no explanation, no markdown fence, straight " quotes, no trailing commas.

PROBLEMS
${problems.map((p, i) => `${i + 1}. ${p}`).join('\n') || '1. (none listed)'}

${snippets}${ok.length ? `\nALLOWED VALUE TYPES\n${typeLines(ok)}\n` : ''}`
}
