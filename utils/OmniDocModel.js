/**
 * utils/OmniDocModel.js (V203) — pure model of a DocNode: a document (PDF, markdown / text, image, or a page of the in-app user guide) shown on a sheet in the space.
 * No DOM, no WebGL, no imports. sanitize never throws, is idempotent, is hostile-input and __proto__ safe, with caps; edit ops are immutable.
 *
 * Stored in node.data.doc:  { version, title, source:{ type, id }, page (1-based), pages (cached count, 0 = unknown), aspect (page height / width), width (world units),
 *                             sides 'double'|'front', paper '#rrggbb', frame (bool), quality 'auto'|'low'|'high',
 *                             spread 'single'|'double' (V206: one page, or two side by side like an open book: pages 1-2, 3-4 ... `page` is then the LEFT page and is odd),
 *                             zoom (V206: percent, 100 = the whole page fits the sheet, up to 400), panX / panY (-1..1, where the zoomed view looks) }
 * source.type: 'none' | 'guide' (id = a guide page id) | 'pdf' | 'markdown' | 'text' | 'image' (id = an id in the document library, utils/OmniDocAssets.js).
 *
 * Also here, the maths that keeps the GPU cost low (used by systems/OmniDocNodes.js, tested in Node):
 *   rasterWidthFor()  how many pixels wide the page texture needs to be for the distance / size / screen, in power-of-two steps, with hysteresis
 *   planBudget()      shares a total pixel budget between the visible sheets: the nearest keep their size, the farthest shrink first, hopeless ones are not drawn
 */

export const DOC_VERSION = 1
export const KIND_DOC = 'docNode'
export const SOURCE_TYPES = Object.freeze(['none', 'guide', 'pdf', 'markdown', 'text', 'image'])
export const SIDES = Object.freeze(['double', 'front'])
export const QUALITIES = Object.freeze(['auto', 'low', 'high'])
export const SPREADS = Object.freeze(['single', 'double'])
export const ZOOM_MIN = 100
export const ZOOM_MAX = 400
export const ZOOM_STEP = 25
export const DOC_LIMITS = Object.freeze({ pages: 5000, titleMax: 80, idMax: 64, widthMin: 0.5, widthMax: 60, widthDefault: 4, aspectMin: 0.2, aspectMax: 5, aspectDefault: 1.414 })
/** Texture widths a page may be drawn at (power-of-two steps; 0 = not drawn). */
export const RASTER_STEPS = Object.freeze([128, 256, 512, 1024, 2048, 4096])
export const QUALITY_FACTOR = Object.freeze({ auto: 1, low: 0.5, high: 1.5 })
const L = DOC_LIMITS

const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k)
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v)
const get = (o, k) => { try { return isObj(o) && has(o, k) ? o[k] : undefined } catch (_) { return undefined } }
const isNum = (v) => typeof v === 'number' && Number.isFinite(v)
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const num = (v, def, lo = -Infinity, hi = Infinity) => {
  const n = typeof v === 'string' && v.trim() !== '' && v.length < 24 ? Number(v) : v
  return isNum(n) ? clamp(n, lo, hi) : def
}
const r3 = (v) => Math.round(v * 1000) / 1000
const pickOf = (v, list, def) => (typeof v === 'string' && list.includes(v) ? v : def)
const cleanText = (v, max, def = '') => (typeof v === 'string' ? v.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, max) : def)
const cleanId = (v) => (typeof v === 'string' && /^[A-Za-z0-9_.-]{1,64}$/.test(v) && v !== '__proto__' && v !== 'constructor' && v !== 'prototype' ? v : '')
const HEX = /^#[0-9a-fA-F]{6}$/

function sanitizeSource (raw) {
  let type = pickOf(get(raw, 'type'), SOURCE_TYPES, 'none')
  const id = cleanId(get(raw, 'id'))
  if (type !== 'none' && !id) type = 'none'
  return { type, id: type === 'none' ? '' : id }
}

export function defaultDoc () { return sanitizeDoc({ version: DOC_VERSION }) }

export function sanitizeDoc (raw) {
  const r = isObj(raw) ? raw : {}
  const source = sanitizeSource(get(r, 'source'))
  const pages = Math.round(num(get(r, 'pages'), 0, 0, L.pages))
  let page = Math.round(num(get(r, 'page'), 1, 1, L.pages))
  if (pages > 0 && page > pages) page = pages
  const spread = pickOf(get(r, 'spread'), SPREADS, 'single')
  if (spread === 'double' && page % 2 === 0) page -= 1          // a spread starts on an odd page: 1-2, 3-4 ...
  const zoom = Math.round(num(get(r, 'zoom'), 100, ZOOM_MIN, ZOOM_MAX))
  return {
    version: DOC_VERSION,
    title: cleanText(get(r, 'title'), L.titleMax, ''),
    source,
    page, pages,
    aspect: r3(num(get(r, 'aspect'), L.aspectDefault, L.aspectMin, L.aspectMax)),
    width: r3(num(get(r, 'width'), L.widthDefault, L.widthMin, L.widthMax)),
    sides: pickOf(get(r, 'sides'), SIDES, 'double'),
    paper: typeof get(r, 'paper') === 'string' && HEX.test(get(r, 'paper')) ? get(r, 'paper').toLowerCase() : '#ffffff',
    frame: typeof get(r, 'frame') === 'boolean' ? get(r, 'frame') : true,
    quality: pickOf(get(r, 'quality'), QUALITIES, 'auto'),
    spread, zoom,
    panX: zoom === 100 ? 0 : r3(num(get(r, 'panX'), 0, -1, 1)),
    panY: zoom === 100 ? 0 : r3(num(get(r, 'panY'), 0, -1, 1)),
  }
}

// ── edit ops (immutable) ────────────────────────────────────────────────────────────────────────────────────────────
const edit = (doc, fn) => { const d = sanitizeDoc(doc); const c = { ...d, source: { ...d.source } }; let r; try { r = fn(c) } catch (_) { return d } return r === false ? d : sanitizeDoc(c) }
/** Choose what the node shows. The page goes back to 1 and the cached page count / aspect are cleared until the loader reports them. */
export function setSource (doc, type, id, title = null) {
  return edit(doc, (d) => { d.source = { type, id }; d.page = 1; d.pages = 0; d.aspect = L.aspectDefault; if (title !== null) d.title = title })
}
export function setPage (doc, page) { return edit(doc, (d) => { d.page = Math.round(num(page, d.page, 1, L.pages)) }) }
/** Next (+1) / previous (-1) page; stops at the ends. */
export function turn (doc, dir) {
  return edit(doc, (d) => {
    const step = d.spread === 'double' ? 2 : 1
    const next = d.page + (dir < 0 ? -step : step)
    if (next < 1) return false
    if (d.pages > 0 && next > d.pages) return false            // the last page (or last spread) stays
    d.page = next
  })
}
/** V206: Page Up / Page Down are the same as previous / next. */
export const pageUp = (doc) => turn(doc, -1)
export const pageDown = (doc) => turn(doc, 1)
/** The loader found out the real page count and shape of the document. */
export function setPages (doc, pages, aspect = null) { return edit(doc, (d) => { d.pages = Math.round(num(pages, 0, 0, L.pages)); if (aspect !== null) d.aspect = num(aspect, d.aspect, L.aspectMin, L.aspectMax) }) }
export function setTitle (doc, title) { return edit(doc, (d) => { d.title = title }) }
export function setWidth (doc, w) { return edit(doc, (d) => { d.width = w }) }
export function setSides (doc, s) { return edit(doc, (d) => { d.sides = s }) }
export function setQuality (doc, q) { return edit(doc, (d) => { d.quality = q }) }
export function setPaper (doc, c) { return edit(doc, (d) => { d.paper = c }) }
export function setFrame (doc, on) { return edit(doc, (d) => { d.frame = !!on }) }
/** V206: one page or two side by side. Switching to two keeps the page you are on (an even page becomes the right half of its spread). */
export function setSpread (doc, mode) { return edit(doc, (d) => { if (!SPREADS.includes(mode)) return false; d.spread = mode }) }
/** V206: zoom in percent (100 = fit, 400 = four times). Going back to 100 re-centres. */
export function setZoom (doc, z) { return edit(doc, (d) => { d.zoom = num(z, d.zoom, ZOOM_MIN, ZOOM_MAX); if (Math.round(d.zoom) === 100) { d.panX = 0; d.panY = 0 } }) }
/** V206: step the zoom up (+1) or down (-1) by 25 points. */
export const zoomBy = (doc, dir) => setZoom(doc, Math.round(sanitizeDoc(doc).zoom / ZOOM_STEP) * ZOOM_STEP + (dir < 0 ? -ZOOM_STEP : ZOOM_STEP))
/** V206: where the zoomed view looks (-1..1 on each axis; the sheet shows a window of the page). Only when zoomed in. */
export function setPan (doc, x, y) { return edit(doc, (d) => { if (d.zoom <= 100) return false; d.panX = num(x, d.panX, -1, 1); d.panY = num(y, d.panY, -1, 1) }) }
/** The pages on the sheet now: [left, right] (right = 0 when there is none: a single page, or the last page of an odd-length document). */
export function visiblePages (doc) {
  const d = sanitizeDoc(doc)
  if (d.spread !== 'double') return [d.page, 0]
  return [d.page, d.pages > 0 && d.page + 1 > d.pages ? 0 : d.page + 1]
}
/** The size of the sheet in the space: one page is `width` wide, a spread twice that, the height stays the page height. */
export function sheetSize (doc) {
  const d = sanitizeDoc(doc); const k = d.spread === 'double' ? 2 : 1
  return { width: d.width * k, aspect: d.aspect / k, height: d.width * d.aspect }
}

/** Short human description for the Inspector. */
export function describeDoc (d) {
  if (!d || d.source.type === 'none') return 'No document yet.'
  const kind = { guide: 'guide page', pdf: 'PDF', markdown: 'markdown', text: 'text', image: 'image' }[d.source.type] ?? 'document'
  return `${d.title || d.source.id}, ${kind}, ${(() => { const [l, r] = visiblePages(d); const pg = r ? `pages ${l}-${r}` : `page ${l}`; return d.pages > 0 ? `${pg} of ${d.pages}` : pg })()}${d.zoom !== 100 ? `, zoom ${d.zoom}%` : ''}.`
}

// ── GPU cost control ────────────────────────────────────────────────────────────────────────────────────────────────
/**
 * The texture width one sheet needs.
 *   o: { distance, sheetWidth (world units), fovDeg, viewportHeightPx, dpr, quality, maxTexture, current (the step now, 0 = none) }
 * The sheet covers  sheetWidth / (2 * distance * tan(fov / 2)) * viewportHeight  pixels across. Times the device pixel ratio and the quality factor, then up to the next
 * power-of-two step, never above maxTexture. Less than 48 px across -> 0 (not drawn: a plain sheet is enough). Hysteresis: growing is immediate, shrinking waits until the
 * need is under 35 % of the current step, so a camera hovering near a boundary does not redraw back and forth.
 */
export function rasterWidthFor (o = {}) {
  const dist = Math.max(0.01, num(get(o, 'distance'), 10, 0, 1e9))
  const sw = num(get(o, 'sheetWidth'), L.widthDefault, 0.01, 1e6)
  const fov = clamp(num(get(o, 'fovDeg'), 60, 5, 170), 5, 170) * Math.PI / 180
  const vh = num(get(o, 'viewportHeightPx'), 800, 1, 16384)
  const dpr = num(get(o, 'dpr'), 1, 0.5, 4)
  const q = QUALITY_FACTOR[pickOf(get(o, 'quality'), QUALITIES, 'auto')]
  const maxT = RASTER_STEPS.includes(get(o, 'maxTexture')) ? get(o, 'maxTexture') : 2048
  const cur = RASTER_STEPS.includes(get(o, 'current')) ? get(o, 'current') : 0
  const px = sw / (2 * dist * Math.tan(fov / 2)) * vh
  if (px < 48) return 0
  const need = px * dpr * q
  let step = RASTER_STEPS.find(s => s >= need) ?? RASTER_STEPS[RASTER_STEPS.length - 1]
  step = Math.min(step, maxT)
  if (cur && step < cur && need > cur * 0.35) return cur      // hysteresis on the way down: keep the bigger texture until the need is well below it
  return Math.max(RASTER_STEPS[0], step)
}

/**
 * Share a pixel budget between sheets. requests: [{ id, want (a RASTER_STEPS value or 0), aspect, distance }]. Returns { [id]: step }.
 * Nearest first keep what they want while the budget lasts; when it does not, the FARTHEST sheets are halved (down to 128, then 0) until the total fits.
 * budgetPixels counts width x width x aspect per sheet (the texture area).
 */
export function planBudget (requests, budgetPixels) {
  const list = (Array.isArray(requests) ? requests : []).filter(r => isObj(r) && typeof r.id === 'string' && r.id !== '__proto__').slice(0, 512)
  const out = Object.create(null)
  for (const r of list) out[r.id] = RASTER_STEPS.includes(r.want) ? r.want : 0
  const area = (r) => out[r.id] * out[r.id] * num(r.aspect, L.aspectDefault, L.aspectMin, L.aspectMax)
  const total = () => list.reduce((s, r) => s + area(r), 0)
  const budget = Math.max(0, num(budgetPixels, 16e6, 0, 1e10))
  const far = [...list].sort((a, b) => num(b.distance, 0) - num(a.distance, 0))
  let guard = 0
  while (total() > budget && guard++ < 10000) {
    // the farthest sheet that is still bigger than the minimum is halved; only when every sheet is at the minimum do the farthest ones drop out
    const r = far.find(x => out[x.id] > RASTER_STEPS[0]) ?? far.find(x => out[x.id] > 0)
    if (!r) break
    out[r.id] = out[r.id] > RASTER_STEPS[0] ? out[r.id] / 2 : 0
  }
  return out
}

export default {
  DOC_VERSION, KIND_DOC, DOC_LIMITS, RASTER_STEPS, defaultDoc, sanitizeDoc, setSource, setPage, turn, pageUp, pageDown, setPages, setTitle, setWidth, setSides, setQuality, setPaper, setFrame,
  setSpread, setZoom, zoomBy, setPan, visiblePages, sheetSize, SPREADS, ZOOM_MIN, ZOOM_MAX,
  describeDoc, rasterWidthFor, planBudget,
}
