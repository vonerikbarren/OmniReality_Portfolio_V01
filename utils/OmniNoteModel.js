/**
 * utils/OmniNoteModel.js (V213) — pure model of an OmniNote: a rich-text note (the "Word" node) shown on a sheet in the space.
 * Stored in node.data.note:  { version, title, html (SAFE html), width (world units), aspect (height / width, used when fit = 'fixed'),
 *                              fit 'grow'|'fixed' (grow: the sheet gets as tall as the text), paper '#rrggbb', ink '#rrggbb', font (family id), size (base px),
 *                              margin (px of a 1024 page), lineHeight (1..3), res 512|1024|2048, sides 'double'|'front', frame (bool) }
 * html is cleaned by sanitizeHtml() down to a short allow-list (headings, paragraphs, bold / italic / underline / strike / sub / sup, colours, sizes, fonts, alignment, indent,
 * lists, quotes, code, rules, links, tables, small embedded images). It never keeps scripts, event handlers, styles outside the allow-list, or remote images.
 * sanitize never throws, is idempotent, is hostile-input and __proto__ safe, with caps. htmlToBlocks() turns safe html into the block list that utils/OmniNoteLayout.js draws.
 * Needs DOMParser (a browser, or jsdom in tests) for html; everything else is plain JS.
 */
export const NOTE_VERSION = 1
export const KIND_NOTE = 'noteNode'
export const FONTS = Object.freeze({
  sans: 'system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', serif: 'Georgia, "Times New Roman", Times, serif', mono: '"Courier New", Courier, monospace',
  rounded: '"Trebuchet MS", "Segoe UI", system-ui, sans-serif', display: 'Impact, "Arial Black", sans-serif', hand: '"Comic Sans MS", "Segoe Print", cursive',
})
export const FONT_IDS = Object.freeze(Object.keys(FONTS))
export const FITS = Object.freeze(['grow', 'fixed'])
export const RES_STEPS = Object.freeze([512, 1024, 2048])
export const NOTE_LIMITS = Object.freeze({
  titleMax: 80, htmlMax: 200000, nodesMax: 6000, depthMax: 24, widthMin: 0.5, widthMax: 60, widthDefault: 4, aspectMin: 0.2, aspectMax: 8, aspectDefault: 1.2,
  sizeMin: 8, sizeMax: 96, sizeDefault: 28, marginMin: 0, marginMax: 200, marginDefault: 48, lineMin: 1, lineMax: 3, lineDefault: 1.35,
  tableRows: 100, tableCols: 12, imageBytes: 400000, images: 8, hrefMax: 500, runMax: 20000,
})
const L = NOTE_LIMITS
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k)
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v)
const get = (o, k) => { try { return isObj(o) && has(o, k) ? o[k] : undefined } catch (_) { return undefined } }
const isNum = (v) => typeof v === 'number' && Number.isFinite(v)
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const num = (v, def, lo, hi) => { const n = typeof v === 'string' && v.trim() !== '' && v.length < 24 ? Number(v) : v; return isNum(n) ? clamp(n, lo, hi) : def }
const r3 = (v) => Math.round(v * 1000) / 1000
const pickOf = (v, list, def) => (typeof v === 'string' && list.includes(v) ? v : def)
const HEX = /^#[0-9a-fA-F]{6}$/
const cleanText = (v, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, max) : '')

// ── html cleaning ────────────────────────────────────────────────────────────────
const NAMED = new Set(['black', 'white', 'red', 'green', 'blue', 'yellow', 'orange', 'purple', 'pink', 'gray', 'grey', 'brown', 'cyan', 'magenta', 'silver', 'gold', 'navy', 'teal', 'maroon', 'lime', 'olive', 'aqua', 'transparent'])
/** '#rgb' | '#rrggbb' | rgb(r,g,b) | rgba() | a common colour name -> '#rrggbb' / a name, else ''. */
export function cleanColor (v) {
  if (typeof v !== 'string') return ''
  const s = v.trim().toLowerCase().slice(0, 40)
  let m = /^#([0-9a-f]{3})$/.exec(s); if (m) return '#' + [...m[1]].map(c => c + c).join('')
  m = /^#([0-9a-f]{6})$/.exec(s); if (m) return '#' + m[1]
  m = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*([\d.]+)\s*)?\)$/.exec(s)
  if (m) { if (m[4] !== undefined && Number(m[4]) === 0) return ''; return '#' + [m[1], m[2], m[3]].map(x => clamp(Number(x), 0, 255).toString(16).padStart(2, '0')).join('') }
  return NAMED.has(s) && s !== 'transparent' ? s : ''
}
const FONT_ALIASES = [['mono', /courier|mono|consolas/i], ['serif', /georgia|times|serif(?!.*sans)|garamond/i], ['display', /impact|arial black/i], ['hand', /comic|print|cursive|hand/i], ['rounded', /trebuchet|rounded/i], ['sans', /arial|helvetica|segoe|roboto|sans|system|verdana|tahoma/i]]
export function fontIdOf (family) {
  if (typeof family !== 'string') return ''
  const s = family.slice(0, 200)
  for (const [id, re] of FONT_ALIASES) if (re.test(s)) return id
  return ''
}
const HTML_SIZES = [10, 13, 16, 18, 24, 32, 48]   // <font size=1..7>
function cleanSizePx (v) {
  if (typeof v !== 'string') return 0
  const m = /^\s*([\d.]{1,6})\s*(px|pt)?\s*$/.exec(v); if (!m) return 0
  let n = Number(m[1]); if (m[2] === 'pt') n = n * 4 / 3
  return Number.isFinite(n) ? Math.round(clamp(n, L.sizeMin, L.sizeMax)) : 0
}
function cleanStyle (el, tag) {
  const out = []
  const st = el.style; if (!st) return ''
  const color = cleanColor(st.color); if (color) out.push('color:' + color)
  const bg = cleanColor(st.backgroundColor || st.background); if (bg) out.push('background-color:' + bg)
  const fs = cleanSizePx(st.fontSize); if (fs) out.push('font-size:' + fs + 'px')
  const ff = fontIdOf(st.fontFamily); if (ff) out.push('font-family:' + ff)
  if (/^(p|h[1-6]|div|li|blockquote|pre|td|th)$/.test(tag)) {
    const ta = (st.textAlign || '').toLowerCase(); if (['left', 'center', 'right', 'justify'].includes(ta)) out.push('text-align:' + ta)
    const ml = Number.parseFloat(st.marginLeft || st.paddingLeft || ''); if (Number.isFinite(ml) && ml > 0) out.push('margin-left:' + Math.round(clamp(ml, 0, 400)) + 'px')
    const lh = Number.parseFloat(st.lineHeight || ''); if (Number.isFinite(lh) && lh >= 1 && lh <= 3) out.push('line-height:' + Math.round(lh * 100) / 100)
  }
  if (/^(span|font|b|strong|i|em|u|s|strike|del|sub|sup)$/.test(tag)) {
    const fw = (st.fontWeight || '').toLowerCase(); if (fw === 'bold' || Number(fw) >= 600) out.push('font-weight:bold')
    if ((st.fontStyle || '').toLowerCase() === 'italic') out.push('font-style:italic')
    const td = (st.textDecoration || st.textDecorationLine || '').toLowerCase(); if (/underline/.test(td)) out.push('text-decoration:underline'); else if (/line-through/.test(td)) out.push('text-decoration:line-through')
  }
  return out.join(';')
}
const SAFE_IMG = /^data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+$/
const SAFE_HREF = /^(https?:\/\/|mailto:)[^\s"'<>]+$/i
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const escA = (t) => esc(t).replace(/"/g, '&quot;')
const BLOCKS = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'hr', 'div'])
const INLINE_KEEP = new Set(['b', 'strong', 'i', 'em', 'u', 's', 'strike', 'del', 'sub', 'sup', 'span', 'code', 'a'])
const CANON = { strong: 'b', em: 'i', strike: 's', del: 's', div: 'p' }
const DROP = new Set(['script', 'style', 'iframe', 'object', 'embed', 'link', 'meta', 'noscript', 'template', 'svg', 'math', 'form', 'input', 'button', 'textarea', 'select', 'video', 'audio', 'canvas', 'base', 'head', 'title'])

/** Clean html down to the allow-list. Returns a string (possibly ''), never throws. */
export function sanitizeHtml (html) {
  if (typeof html !== 'string' || !html) return ''
  const src = html.length > L.htmlMax ? html.slice(0, L.htmlMax) : html
  if (typeof DOMParser === 'undefined') return esc(src.replace(/<[^>]*>/g, ''))
  let doc
  try { doc = new DOMParser().parseFromString('<!doctype html><body>' + src, 'text/html') } catch (_) { return '' }
  const budget = { nodes: 0, images: 0 }
  const walk = (node, depth) => {
    if (budget.nodes++ > L.nodesMax || depth > L.depthMax) return ''
    if (node.nodeType === 3) return esc(node.nodeValue || '')
    if (node.nodeType !== 1) return ''
    let tag = node.tagName.toLowerCase()
    if (DROP.has(tag)) return ''
    const kids = () => { let s = ''; for (const c of node.childNodes) s += walk(c, depth + 1); return s }
    if (tag === 'br') return '<br>'
    if (tag === 'hr') return '<hr>'
    if (tag === 'img') {
      const s = node.getAttribute('src') || ''
      if (!SAFE_IMG.test(s) || s.length > L.imageBytes * 1.4 || budget.images >= L.images) return ''
      budget.images++
      const w = Number.parseInt(node.getAttribute('width') || node.style?.width || '', 10)
      return `<img src="${s}"${Number.isFinite(w) && w > 8 ? ` width="${clamp(w, 8, 2000)}"` : ''}>`
    }
    if (tag === 'font') {   // old execCommand output: <font color face size>
      const style = []
      const c = cleanColor(node.getAttribute('color') || ''); if (c) style.push('color:' + c)
      const f = fontIdOf(node.getAttribute('face') || ''); if (f) style.push('font-family:' + f)
      const sz = Number(node.getAttribute('size')); if (sz >= 1 && sz <= 7) style.push('font-size:' + HTML_SIZES[Math.round(sz) - 1] + 'px')
      const extra = cleanStyle(node, 'font'); if (extra) style.push(extra)
      const inner = kids(); return style.length ? `<span style="${style.join(';')}">${inner}</span>` : inner
    }
    tag = CANON[tag] ?? tag
    if (BLOCKS.has(tag) || INLINE_KEEP.has(tag)) {
      let attrs = ''
      let style = cleanStyle(node, node.tagName.toLowerCase())
      const al = (node.getAttribute('align') || '').toLowerCase()
      if (!/text-align/.test(style) && ['left', 'center', 'right', 'justify'].includes(al) && BLOCKS.has(tag)) style = (style ? style + ';' : '') + 'text-align:' + al
      if (style) attrs += ` style="${escA(style)}"`
      if (tag === 'a') {
        const h = (node.getAttribute('href') || '').trim().slice(0, L.hrefMax)
        if (SAFE_HREF.test(h)) attrs += ` href="${escA(h)}"`
      }
      if ((tag === 'td' || tag === 'th')) {
        const cs = Number.parseInt(node.getAttribute('colspan') || '1', 10); if (cs > 1 && cs <= L.tableCols) attrs += ` colspan="${cs}"`
      }
      if (tag === 'ol') { const st = Number.parseInt(node.getAttribute('start') || '1', 10); if (st > 1 && st < 10000) attrs += ` start="${st}"` }
      const inner = kids()
      if (tag === 'span' && !attrs) return inner
      return `<${tag}${attrs}>${inner}</${tag}>`
    }
    return kids()   // unknown tag: keep its text
  }
  let out = ''
  for (const c of doc.body.childNodes) out += walk(c, 0)
  return out.slice(0, L.htmlMax)
}

export const DEFAULT_HTML = '<h1>New note</h1><p>Start writing here…</p>'
export function defaultNote () { return sanitizeNote({ version: NOTE_VERSION, html: DEFAULT_HTML, title: 'Note' }) }
export function sanitizeNote (raw) {
  const r = isObj(raw) ? raw : {}
  const html = sanitizeHtml(get(r, 'html'))
  return {
    version: NOTE_VERSION,
    title: cleanText(get(r, 'title'), L.titleMax) || 'Note',
    html,
    width: r3(num(get(r, 'width'), L.widthDefault, L.widthMin, L.widthMax)),
    aspect: r3(num(get(r, 'aspect'), L.aspectDefault, L.aspectMin, L.aspectMax)),
    fit: pickOf(get(r, 'fit'), FITS, 'grow'),
    paper: typeof get(r, 'paper') === 'string' && HEX.test(get(r, 'paper')) ? get(r, 'paper').toLowerCase() : '#fffdf5',
    ink: typeof get(r, 'ink') === 'string' && HEX.test(get(r, 'ink')) ? get(r, 'ink').toLowerCase() : '#1b1b22',
    font: pickOf(get(r, 'font'), FONT_IDS, 'sans'),
    size: Math.round(num(get(r, 'size'), L.sizeDefault, L.sizeMin, L.sizeMax)),
    margin: Math.round(num(get(r, 'margin'), L.marginDefault, L.marginMin, L.marginMax)),
    lineHeight: r3(num(get(r, 'lineHeight'), L.lineDefault, L.lineMin, L.lineMax)),
    res: RES_STEPS.includes(Number(get(r, 'res'))) ? Number(get(r, 'res')) : 1024,
    sides: pickOf(get(r, 'sides'), ['double', 'front'], 'double'),
    frame: get(r, 'frame') !== false,
  }
}
/** Immutable edit: returns a new sanitized note with the patch applied. */
export function setNote (note, patch) { return sanitizeNote({ ...sanitizeNote(note), ...(isObj(patch) ? patch : {}) }) }

// ── html -> blocks ───────────────────────────────────────────────────────────────
/** run = { text, b, i, u, s, sub, sup, color, bg, size, font, href, code } ; block = { kind, level?, align, indent, lh, runs, ... } */
export function htmlToBlocks (html) {
  const safe = sanitizeHtml(html)
  if (!safe || typeof DOMParser === 'undefined') return []
  const doc = new DOMParser().parseFromString('<!doctype html><body>' + safe, 'text/html')
  const blocks = []
  const styleOf = (el) => { const o = {}; const st = el.style; if (st) { if (st.color) o.color = cleanColor(st.color); if (st.backgroundColor) o.bg = cleanColor(st.backgroundColor); const fs = cleanSizePx(st.fontSize); if (fs) o.size = fs; const f = fontIdOf(st.fontFamily); if (f) o.font = f; if (/bold/.test(st.fontWeight)) o.b = true; if (/italic/.test(st.fontStyle)) o.i = true; if (/underline/.test(st.textDecoration)) o.u = true; if (/line-through/.test(st.textDecoration)) o.s = true } return o }
  const inlineRuns = (el, base, out) => {
    for (const c of el.childNodes) {
      if (c.nodeType === 3) { if (c.nodeValue) out.push({ ...base, text: c.nodeValue }); continue }
      if (c.nodeType !== 1) continue
      const t = c.tagName.toLowerCase()
      if (t === 'br') { out.push({ ...base, text: '\n' }); continue }
      if (t === 'img') { out.push({ ...base, text: '', img: c.getAttribute('src'), imgW: Number(c.getAttribute('width')) || 0 }); continue }
      if (BLOCKS.has(t)) continue
      const next = { ...base, ...styleOf(c) }
      if (t === 'b') next.b = true; if (t === 'i') next.i = true; if (t === 'u') next.u = true; if (t === 's') next.s = true
      if (t === 'sub') next.sub = true; if (t === 'sup') next.sup = true; if (t === 'code') next.code = true
      if (t === 'a') { next.href = c.getAttribute('href') || ''; next.u = true }
      inlineRuns(c, next, out)
    }
  }
  const meta = (el) => { const st = el.style; const m = { align: 'left', indent: 0, lh: 0 }; if (st) { const ta = (st.textAlign || '').toLowerCase(); if (['left', 'center', 'right', 'justify'].includes(ta)) m.align = ta; const ml = Number.parseFloat(st.marginLeft || ''); if (ml > 0) m.indent = ml; const lh = Number.parseFloat(st.lineHeight || ''); if (lh >= 1) m.lh = lh } return m }
  const pushBlock = (kind, el, extra = {}) => { const runs = []; inlineRuns(el, styleOf(el), runs); blocks.push({ kind, ...meta(el), runs, ...extra }) }
  const visit = (el, ctx) => {
    for (const c of el.childNodes) {
      if (c.nodeType === 3) { if ((c.nodeValue || '').trim()) { blocks.push({ kind: 'p', align: 'left', indent: ctx.quote * 28, lh: 0, runs: [{ text: c.nodeValue }] }) } continue }
      if (c.nodeType !== 1) continue
      const t = c.tagName.toLowerCase()
      if (/^h[1-6]$/.test(t)) pushBlock('h', c, { level: Number(t[1]) })
      else if (t === 'p') pushBlock('p', c, { quote: ctx.quote })
      else if (t === 'pre') pushBlock('pre', c)
      else if (t === 'hr') blocks.push({ kind: 'hr' })
      else if (t === 'blockquote') {
        const hasBlock = [...c.children].some(x => BLOCKS.has(x.tagName.toLowerCase()))
        if (hasBlock) visit(c, { ...ctx, quote: ctx.quote + 1 }); else pushBlock('p', c, { quote: ctx.quote + 1, bar: true })
      } else if (t === 'ul' || t === 'ol') {
        let n = Number.parseInt(c.getAttribute('start') || '1', 10) || 1
        for (const li of c.children) {
          if (li.tagName.toLowerCase() !== 'li') continue
          const runs = []; const sub = []
          for (const k of li.childNodes) { if (k.nodeType === 1 && (k.tagName.toLowerCase() === 'ul' || k.tagName.toLowerCase() === 'ol')) sub.push(k); else if (k.nodeType === 1 && BLOCKS.has(k.tagName.toLowerCase())) inlineRuns(k, styleOf(k), runs); else if (k.nodeType === 3) { if (k.nodeValue) runs.push({ text: k.nodeValue }) } else if (k.nodeType === 1) inlineRuns({ childNodes: [k] }, styleOf(li), runs) }
          blocks.push({ kind: 'li', ...meta(li), runs, ordered: t === 'ol', n: n++, depth: ctx.depth })
          for (const s of sub) visit({ childNodes: [s] }, { ...ctx, depth: ctx.depth + 1 })
        }
      } else if (t === 'table') {
        const rows = []
        const trs = c.querySelectorAll('tr')
        for (const tr of trs) {
          if (rows.length >= L.tableRows) break
          const cells = []
          for (const cell of tr.children) { const ct = cell.tagName.toLowerCase(); if (ct !== 'td' && ct !== 'th') continue; if (cells.length >= L.tableCols) break; const runs = []; inlineRuns(cell, styleOf(cell), runs); cells.push({ runs, header: ct === 'th', span: Number(cell.getAttribute('colspan')) || 1, ...meta(cell) }) }
          if (cells.length) rows.push(cells)
        }
        if (rows.length) blocks.push({ kind: 'table', rows })
      } else if (t === 'thead' || t === 'tbody') visit(c, ctx)
      else if (BLOCKS.has(t)) visit(c, ctx)
      else { const runs = []; inlineRuns({ childNodes: [c] }, {}, runs); if (runs.some(r => r.text.trim() || r.img)) blocks.push({ kind: 'p', align: 'left', indent: ctx.quote * 28, lh: 0, runs }) }
    }
  }
  visit(doc.body, { quote: 0, depth: 0 })
  return blocks
}

export const plainText = (html) => { const b = htmlToBlocks(html); const out = []; for (const x of b) { if (x.kind === 'table') for (const row of x.rows) out.push(row.map(c => c.runs.map(r => r.text).join('')).join('\t')); else if (x.runs) out.push(x.runs.map(r => r.text).join('')) } return out.join('\n') }
export const wordCount = (html) => { const t = plainText(html).trim(); return t ? t.split(/\s+/).length : 0 }
export default { NOTE_VERSION, KIND_NOTE, FONTS, FONT_IDS, NOTE_LIMITS, sanitizeHtml, sanitizeNote, defaultNote, setNote, htmlToBlocks, plainText, wordCount, cleanColor, fontIdOf }
