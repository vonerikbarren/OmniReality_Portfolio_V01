/**
 * utils/OmniDocLayout.js (V203) — pure page layout for text documents. Markdown blocks (utils/OmniDocsMarkdown.js parseMarkdown) or plain text go in; PAGES of simple draw ops come out.
 * No DOM, no canvas: the caller injects `measure(text, font) -> width` (a canvas measureText in the browser, a fake in tests), and a 2D canvas executes the ops (drawOps below needs only a ctx).
 *
 * The page is a fixed LOGICAL size (PAGE_W wide, PAGE_W * aspect high). The rasterizer scales the ops to whatever texture width the GPU budget gave, so layout never repeats when you zoom.
 * Ops: { o:'text', x, y, s, f (font), c (color) }   y is the baseline.   { o:'rect', x, y, w, h, c }   { o:'line', x1, y1, x2, y2, c, w }
 * Never throws; hostile input gives an empty or capped result (MAX_PAGES pages, MAX_CHARS characters).
 */

export const PAGE_W = 800
export const MARGIN = 56
export const MAX_PAGES = 400
export const MAX_CHARS = 400000
export const COLORS = Object.freeze({ ink: '#1c1c22', dim: '#5a5a66', link: '#1a55c4', codeBg: '#eef0f4', rule: '#c9ccd4', head: '#101018' })
const SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
export const fontOf = (size, { bold = false, italic = false, mono = false } = {}) => `${italic ? 'italic ' : ''}${bold ? '700 ' : '400 '}${size}px ${mono ? MONO : SANS}`

const HEAD_SIZE = [0, 34, 27, 22, 19, 17, 16]
const BODY = 16
const LEAD = 1.5

/** Flatten inline tokens to words with a style. */
function runsOf (inl, st = {}, out = []) {
  if (typeof inl === 'string') { out.push({ s: inl, ...st }); return out }
  if (!Array.isArray(inl)) return out
  for (const t of inl) {
    if (!t || typeof t !== 'object') continue
    if (t.t === 'text') out.push({ s: String(t.s ?? ''), ...st })
    else if (t.t === 'code') out.push({ s: String(t.s ?? ''), ...st, mono: true })
    else if (t.t === 'b') runsOf(t.c, { ...st, bold: true }, out)
    else if (t.t === 'i') runsOf(t.c, { ...st, italic: true }, out)
    else if (t.t === 'link') runsOf(t.c, { ...st, link: true }, out)
  }
  return out
}

class Pager {
  constructor (aspect, measure) {
    this.H = Math.round(PAGE_W * aspect); this.measure = measure
    this.pages = []; this.y = MARGIN; this.cur = null; this.chars = 0; this.full = false
    this._new()
  }
  _new () { if (this.pages.length >= MAX_PAGES) { this.full = true; return } this.cur = { ops: [] }; this.pages.push(this.cur); this.y = MARGIN }
  room (h) { return this.y + h <= this.H - MARGIN }
  need (h) { if (!this.room(h) && this.cur.ops.length) this._new() }
  push (op) { if (!this.full) this.cur.ops.push(op) }
  gap (h) { this.y += h }
}

/** Lay words out in lines, left to right within [x0, x1]. Returns lines of positioned pieces. */
function wrapRuns (runs, size, x0, x1, measure, baseColor) {
  const lines = []; let line = []; let x = x0
  const flush = () => { if (line.length) { lines.push(line); line = [] } x = x0 }
  for (const r of runs) {
    const font = fontOf(size, r)
    const parts = String(r.s).split(/(\s+)/)
    for (const w of parts) {
      if (w === '') continue
      if (/^\s+$/.test(w)) { const sw = safeMeasure(measure, ' ', font); if (line.length && x + sw <= x1) { x += sw } continue }
      let word = w
      let ww = safeMeasure(measure, word, font)
      while (ww > x1 - x0 && word.length > 1) {                      // a word longer than the line: split it
        let n = Math.max(1, Math.floor(word.length * (x1 - x0) / ww))
        if (x > x0) flush()
        const head = word.slice(0, n)
        line.push({ x, s: head, f: font, c: r.link ? COLORS.link : baseColor, u: !!r.link, mono: !!r.mono, w: safeMeasure(measure, head, font) }); flush()
        word = word.slice(n); ww = safeMeasure(measure, word, font)
      }
      if (x + ww > x1 && line.length) flush()
      line.push({ x, s: word, f: font, c: r.link ? COLORS.link : baseColor, u: !!r.link, mono: !!r.mono, w: ww })
      x += ww
    }
  }
  flush()
  return lines
}
const safeMeasure = (m, s, f) => { try { const v = m(s, f); return Number.isFinite(v) && v >= 0 ? v : s.length * 8 } catch (_) { return s.length * 8 } }

/** Place the wrapped lines onto pages. */
function placeLines (pg, lines, size, { indent = 0, bg = null, bullet = null } = {}) {
  const lh = Math.round(size * LEAD)
  lines.forEach((ln, i) => {
    pg.need(lh); if (pg.full) return
    if (bg) pg.push({ o: 'rect', x: MARGIN + indent - 6, y: pg.y - 2, w: PAGE_W - 2 * MARGIN - indent + 12, h: lh, c: bg })
    if (i === 0 && bullet) pg.push({ o: 'text', x: MARGIN + indent - 18, y: pg.y + size, s: bullet, f: fontOf(size), c: COLORS.dim })
    for (const p of ln) {
      pg.push({ o: 'text', x: p.x, y: pg.y + size, s: p.s, f: p.f, c: p.c })
      if (p.u) pg.push({ o: 'line', x1: p.x, y1: pg.y + size + 2, x2: p.x + p.w, y2: pg.y + size + 2, c: p.c, w: 1 })
    }
    pg.gap(lh)
  })
}

function layoutBlock (pg, b, measure, depth = 0) {
  if (!b || typeof b !== 'object' || pg.full) return
  const x0 = MARGIN; const x1 = PAGE_W - MARGIN
  if (b.t === 'h') {
    const size = HEAD_SIZE[Math.min(6, Math.max(1, b.level | 0))]
    pg.need(size * 2.6); pg.gap(size * 0.5)
    placeLines(pg, wrapRuns(runsOf(b.c, { bold: true }), size, x0, x1, measure, COLORS.head), size)
    if (b.level <= 2) { pg.push({ o: 'line', x1: x0, y1: pg.y - 2, x2: x1, y2: pg.y - 2, c: COLORS.rule, w: 1 }) }
    pg.gap(size * 0.35)
  } else if (b.t === 'p') {
    placeLines(pg, wrapRuns(runsOf(b.c), BODY, x0 + depth * 22, x1, measure, COLORS.ink), BODY, { indent: depth * 22 }); pg.gap(10)
  } else if (b.t === 'ul' || b.t === 'ol') {
    const items = Array.isArray(b.items) ? b.items : []
    items.forEach((it, i) => {
      placeLines(pg, wrapRuns(runsOf(Array.isArray(it) ? it : it?.c ?? it), BODY, x0 + 26, x1, measure, COLORS.ink), BODY, { indent: 26, bullet: b.t === 'ol' ? `${i + 1}.` : '•' })
      pg.gap(3)
    })
    pg.gap(8)
  } else if (b.t === 'quote') {
    const y0 = pg.y
    placeLines(pg, wrapRuns(runsOf(b.c, { italic: true }), BODY, x0 + 20, x1, measure, COLORS.dim), BODY, { indent: 20 })
    pg.push({ o: 'rect', x: x0 + 4, y: y0, w: 3, h: Math.max(4, pg.y - y0), c: COLORS.rule }); pg.gap(10)
  } else if (b.t === 'code') {
    const cs = 13; const f = fontOf(cs, { mono: true }); const cw = Math.max(4, safeMeasure(measure, 'M', f))
    const cols = Math.max(8, Math.floor((x1 - x0 - 12) / cw))
    const rows = []
    for (const raw of String(b.s ?? '').split('\n')) { let s = raw.replace(/\t/g, '  '); if (!s.length) rows.push(''); while (s.length) { rows.push(s.slice(0, cols)); s = s.slice(cols) } }
    const lh = Math.round(cs * 1.45)
    for (const r of rows) {
      pg.need(lh); if (pg.full) return
      pg.push({ o: 'rect', x: x0 - 4, y: pg.y - 1, w: x1 - x0 + 8, h: lh, c: COLORS.codeBg })
      if (r) pg.push({ o: 'text', x: x0 + 4, y: pg.y + cs, s: r, f, c: COLORS.ink })
      pg.gap(lh)
    }
    pg.gap(10)
  } else if (b.t === 'table') {
    const head = Array.isArray(b.head) ? b.head : []; const rows = Array.isArray(b.rows) ? b.rows : []
    const n = Math.max(1, head.length || (rows[0]?.length ?? 1)); const cw = (x1 - x0) / n
    const cell = (c, bold, y) => {
      const lines = wrapRuns(runsOf(c, bold ? { bold: true } : {}), 14, 0, cw - 12, measure, COLORS.ink)
      return lines.map(l => l.map(p => ({ ...p })))
    }
    const doRow = (cells, bold) => {
      const cols = Array.from({ length: n }, (_, i) => cell(cells[i] ?? [], bold))
      const h = Math.max(1, ...cols.map(c => c.length)) * 21 + 6
      pg.need(h); if (pg.full) return
      if (bold) pg.push({ o: 'rect', x: x0, y: pg.y, w: x1 - x0, h, c: COLORS.codeBg })
      cols.forEach((lines, ci) => lines.forEach((ln, li) => ln.forEach(p => pg.push({ o: 'text', x: x0 + ci * cw + 6 + p.x, y: pg.y + 17 + li * 21, s: p.s, f: p.f, c: p.c }))))
      pg.push({ o: 'line', x1: x0, y1: pg.y + h, x2: x1, y2: pg.y + h, c: COLORS.rule, w: 1 })
      pg.gap(h)
    }
    if (head.length) doRow(head, true)
    for (const r of rows.slice(0, 500)) doRow(Array.isArray(r) ? r : [], false)
    pg.gap(10)
  } else if (b.t === 'hr') {
    pg.need(20); pg.push({ o: 'line', x1: x0, y1: pg.y + 8, x2: x1, y2: pg.y + 8, c: COLORS.rule, w: 1 }); pg.gap(20)
  }
}

/** Markdown blocks -> pages. opts: { measure, aspect = 1.414 }. */
export function layoutBlocks (blocks, opts = {}) {
  const measure = typeof opts.measure === 'function' ? opts.measure : (s) => s.length * 8
  const aspect = Number.isFinite(opts.aspect) ? Math.min(5, Math.max(0.2, opts.aspect)) : 1.414
  const pg = new Pager(aspect, measure)
  let chars = 0
  for (const b of (Array.isArray(blocks) ? blocks : []).slice(0, 20000)) {
    try { chars += JSON.stringify(b).length } catch (_) { continue }
    if (chars > MAX_CHARS * 2) break
    try { layoutBlock(pg, b, measure) } catch (_) { /* skip a block that cannot be laid out */ }
    if (pg.full) break
  }
  return { w: PAGE_W, h: pg.H, pages: pg.pages.filter(p => p.ops.length).length ? pg.pages.filter(p => p.ops.length) : [{ ops: [] }] }
}

/** Plain text -> pages (monospace, wrapped by characters, form feed starts a new page). */
export function layoutText (text, opts = {}) {
  const measure = typeof opts.measure === 'function' ? opts.measure : (s) => s.length * 8
  const aspect = Number.isFinite(opts.aspect) ? Math.min(5, Math.max(0.2, opts.aspect)) : 1.414
  const pg = new Pager(aspect, measure)
  const str = typeof text === 'string' ? text.slice(0, MAX_CHARS) : ''
  const cs = 14; const f = fontOf(cs, { mono: true }); const cw = Math.max(4, safeMeasure(measure, 'M', f))
  const cols = Math.max(8, Math.floor((PAGE_W - 2 * MARGIN) / cw)); const lh = Math.round(cs * 1.45)
  outer: for (const sheet of str.split('\f')) {
    if (pg.cur.ops.length || pg.pages.length > 1) pg._new()
    if (pg.full) break
    for (const raw of sheet.split(/\r?\n/)) {
      let s = raw.replace(/\t/g, '    ')
      do {
        pg.need(lh); if (pg.full) break outer
        const seg = s.slice(0, cols); s = s.slice(cols)
        if (seg) pg.push({ o: 'text', x: MARGIN, y: pg.y + cs, s: seg, f, c: COLORS.ink })
        pg.gap(lh)
      } while (s.length)
    }
  }
  const pages = pg.pages.filter(p => p.ops.length)
  return { w: PAGE_W, h: pg.H, pages: pages.length ? pages : [{ ops: [] }] }
}

/** Execute one page of ops on a 2D context at `width` pixels wide (scales from PAGE_W). Paper colour first. */
export function drawOps (ctx, page, { width, height, paper = '#ffffff' }) {
  const k = width / PAGE_W
  ctx.save()
  ctx.fillStyle = paper; ctx.fillRect(0, 0, width, height)
  ctx.scale(k, k)
  ctx.textBaseline = 'alphabetic'
  for (const op of (page?.ops ?? [])) {
    if (op.o === 'rect') { ctx.fillStyle = op.c; ctx.fillRect(op.x, op.y, op.w, op.h) }
    else if (op.o === 'line') { ctx.strokeStyle = op.c; ctx.lineWidth = op.w || 1; ctx.beginPath(); ctx.moveTo(op.x1, op.y1); ctx.lineTo(op.x2, op.y2); ctx.stroke() }
    else if (op.o === 'text') { ctx.font = op.f; ctx.fillStyle = op.c; ctx.fillText(op.s, op.x, op.y) }
  }
  ctx.restore()
}

export default { PAGE_W, MARGIN, layoutBlocks, layoutText, drawOps, fontOf }
