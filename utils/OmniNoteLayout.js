/**
 * utils/OmniNoteLayout.js (V213) — lays an OmniNote out and draws it on a 2D canvas context. No DOM here: the layout only needs a measure(font, text) function,
 * so it is tested in Node. layoutNote(blocks, note, {pageW, measure, images}) -> { height, ops }.  drawOps(ctx, ops, note, pageW, pageH) paints them.
 * All sizes are in "page pixels" for a page pageW wide (the note's res); the caller scales. Blocks come from utils/OmniNoteModel.js htmlToBlocks().
 */
import { FONTS } from './OmniNoteModel.js'

const HEADING = [0, 2.0, 1.6, 1.3, 1.15, 1.0, 0.9]
const BULLETS = ['•', '◦', '▪']
const QUOTE_STEP = 28, LIST_STEP = 32, LIST_TEXT = 26, CELL_PAD = 8
const MAX_LINES = 4000

export const fontString = (run, base, fontId, px) => `${run.i ? 'italic ' : ''}${run.b ? 'bold ' : ''}${Math.max(4, Math.round(px))}px ${run.code ? FONTS.mono : (FONTS[run.font ?? fontId] ?? FONTS.sans)}`

/** split runs into tokens: words, spaces, forced breaks, images */
function tokenize (runs, ctxInfo) {
  const toks = []
  for (const r of runs) {
    if (r.img) { toks.push({ img: r.img, imgW: r.imgW, run: r }); continue }
    const parts = String(r.text ?? '').split(/(\n|[ \t]+)/)
    for (const p of parts) {
      if (!p) continue
      if (p === '\n') toks.push({ br: true, run: r })
      else if (/^[ \t]+$/.test(p)) toks.push({ sp: true, text: ' ', run: r })
      else toks.push({ text: p, run: r })
    }
  }
  return toks
}

/** Lay out one paragraph of runs in a column. Returns { lines:[{items,w,h,asc,last}], h }. */
function paragraph (runs, o) {
  const { width, measure, basePx, fontId, lh, images, pre } = o
  const toks = tokenize(runs)
  const lines = []; let cur = { items: [], w: 0, h: 0, asc: 0 }
  const push = (last) => { cur.last = last; lines.push(cur); cur = { items: [], w: 0, h: 0, asc: 0 } }
  const sizeOf = (r) => (r.size ?? basePx) * (o.scale ?? 1) * ((r.sub || r.sup) ? 0.7 : 1)
  for (const t of toks) {
    if (lines.length >= MAX_LINES) break
    if (t.br) { if (!cur.h) cur.h = basePx * (o.scale ?? 1) * lh; push(true); continue }
    if (t.img) {
      const im = images?.get?.(t.img); const nw = im?.w || 160, nh = im?.h || 100
      let w = t.imgW > 0 ? t.imgW * (o.pageScale ?? 1) : nw * (o.pageScale ?? 1); w = Math.min(w, width); const h = w * (nh / nw)
      if (cur.items.length) push(false)
      cur.items.push({ img: t.img, w, h, x: 0, ready: !!im?.ready }); cur.w = w; cur.h = h; cur.asc = h; push(false); continue
    }
    const px = sizeOf(t.run), font = fontString(t.run, basePx, fontId, px)
    const w = t.sp ? measure(font, ' ') : measure(font, t.text)
    if (!t.sp && cur.w + w > width && cur.items.length) { while (cur.items.length && cur.items.at(-1).sp) { cur.w -= cur.items.pop().w } push(false) }
    if (t.sp && !cur.items.length) continue
    if (!t.sp && w > width) {   // a word wider than the column: break it by characters
      let chunk = ''
      for (const ch of t.text) { const cw = measure(font, chunk + ch); if (cw > width && chunk) { cur.items.push({ text: chunk, w: measure(font, chunk), font, run: t.run, px }); cur.w += measure(font, chunk); cur.h = Math.max(cur.h, px * lh); cur.asc = Math.max(cur.asc, px); push(false); chunk = ch } else chunk += ch }
      if (chunk) { const cw = measure(font, chunk); cur.items.push({ text: chunk, w: cw, font, run: t.run, px }); cur.w += cw; cur.h = Math.max(cur.h, px * lh); cur.asc = Math.max(cur.asc, px) }
      continue
    }
    cur.items.push({ text: t.text, sp: !!t.sp, w, font, run: t.run, px }); cur.w += w; cur.h = Math.max(cur.h, px * lh); cur.asc = Math.max(cur.asc, px)
  }
  if (cur.items.length || !lines.length) { while (cur.items.length && cur.items.at(-1).sp) { cur.w -= cur.items.pop().w } if (!cur.h) cur.h = basePx * (o.scale ?? 1) * lh; push(true) }
  return { lines, h: lines.reduce((a, l) => a + l.h, 0) }
}

function emitLines (ops, p, x, y, width, align, ink) {
  let yy = y
  for (const ln of p.lines) {
    const justify = align === 'justify' && !ln.last && ln.items.filter(i => i.sp).length > 0
    let extra = 0
    if (justify) extra = (width - ln.w) / ln.items.filter(i => i.sp).length
    let xx = x + (align === 'center' ? (width - ln.w) / 2 : align === 'right' ? width - ln.w : 0)
    const base = yy + ln.asc
    for (const it of ln.items) {
      const w = it.w + (justify && it.sp ? extra : 0)
      if (it.img) { ops.push({ t: 'img', src: it.img, x: xx, y: yy, w: it.w, h: it.h, ready: it.ready }); xx += w; continue }
      const r = it.run
      if (r.bg) ops.push({ t: 'rect', x: xx, y: yy, w, h: ln.h, fill: r.bg })
      if (r.code && !r.bg) ops.push({ t: 'rect', x: xx, y: yy, w, h: ln.h, fill: 'rgba(120,120,140,.18)' })
      if (!it.sp) {
        const dy = r.sup ? -it.px * 0.45 : r.sub ? it.px * 0.2 : 0
        ops.push({ t: 'text', x: xx, y: base + dy, s: it.text, font: it.font, color: r.color || ink, link: r.href || '' })
        if (r.u) ops.push({ t: 'line', x1: xx, x2: xx + w, y1: base + dy + it.px * 0.12, y2: base + dy + it.px * 0.12, color: r.color || ink, lw: Math.max(1, it.px / 16) })
      } else if (r.u && r.href) { /* gaps in a link are not underlined */ }
      if (r.s) ops.push({ t: 'line', x1: xx, x2: xx + w, y1: base - it.px * 0.3, y2: base - it.px * 0.3, color: r.color || ink, lw: Math.max(1, it.px / 16) })
      xx += w
    }
    yy += ln.h
  }
  return yy
}

export function layoutNote (blocks, note, o) {
  const { pageW, measure, images } = o
  const m = (note.margin ?? 48) * (pageW / 1024)
  const contentW = Math.max(40, pageW - 2 * m)
  const baseLh = note.lineHeight ?? 1.35
  const basePx = (note.size ?? 28) * (pageW / 1024)
  const ink = note.ink || '#1b1b22'
  const ops = []; let y = m
  const gap = basePx * 0.45
  for (const b of blocks) {
    const common = { measure, basePx, fontId: note.font, images, lh: b.lh || baseLh, pageScale: pageW / 1024 }
    if (b.kind === 'hr') { ops.push({ t: 'line', x1: m, x2: m + contentW, y1: y + gap / 2, y2: y + gap / 2, color: 'rgba(120,120,140,.7)', lw: Math.max(1, basePx / 14) }); y += gap * 1.2; continue }
    if (b.kind === 'table') {
      const cols = Math.max(...b.rows.map(r => r.reduce((a, c) => a + (c.span || 1), 0)))
      const cw = contentW / cols; let ty = y
      for (const row of b.rows) {
        let cx = m; const cells = []; let rh = 0
        for (const c of row) {
          const w = cw * (c.span || 1)
          const runs = c.header ? c.runs.map(r => ({ ...r, b: true })) : c.runs
          const p = paragraph(runs.length ? runs : [{ text: '' }], { ...common, width: Math.max(10, w - 2 * CELL_PAD * (pageW / 1024)), lh: c.lh || baseLh })
          cells.push({ c, p, x: cx, w }); rh = Math.max(rh, p.h + 2 * CELL_PAD * (pageW / 1024)); cx += w
        }
        for (const k of cells) {
          if (k.c.header) ops.push({ t: 'rect', x: k.x, y: ty, w: k.w, h: rh, fill: 'rgba(120,120,160,.16)' })
          emitLines(ops, k.p, k.x + CELL_PAD * (pageW / 1024), ty + CELL_PAD * (pageW / 1024), k.w - 2 * CELL_PAD * (pageW / 1024), k.c.align, ink)
          ops.push({ t: 'box', x: k.x, y: ty, w: k.w, h: rh, color: 'rgba(120,120,140,.8)', lw: Math.max(1, basePx / 20) })
        }
        ty += rh
      }
      y = ty + gap; continue
    }
    const scale = b.kind === 'h' ? HEADING[b.level] : 1
    let left = m + (b.indent || 0) * (pageW / 1024), width = contentW - (b.indent || 0) * (pageW / 1024)
    const runs = b.kind === 'h' ? b.runs.map(r => ({ ...r, b: true })) : b.kind === 'pre' ? b.runs.map(r => ({ ...r, code: true })) : b.runs
    if (b.quote) { const q = b.quote * QUOTE_STEP * (pageW / 1024); left += q; width -= q }
    if (b.kind === 'li') { const d = (b.depth || 0) * LIST_STEP * (pageW / 1024); left += d + LIST_TEXT * (pageW / 1024); width -= d + LIST_TEXT * (pageW / 1024) }
    width = Math.max(30, width)
    const p = paragraph(runs, { ...common, width, scale, pre: b.kind === 'pre' })
    if (b.kind === 'pre') ops.push({ t: 'rect', x: left - 6, y: y - 4, w: width + 12, h: p.h + 8, fill: 'rgba(120,120,140,.16)' })
    if (b.bar || b.quote) ops.push({ t: 'rect', x: left - 14 * (pageW / 1024), y, w: Math.max(2, 4 * (pageW / 1024)), h: p.h, fill: 'rgba(120,120,160,.7)' })
    if (b.kind === 'li') {
      const mark = b.ordered ? `${b.n}.` : BULLETS[(b.depth || 0) % BULLETS.length]
      const f = `${Math.round(basePx)}px ${FONTS[note.font] ?? FONTS.sans}`
      ops.push({ t: 'text', x: left - LIST_TEXT * (pageW / 1024), y: y + (p.lines[0]?.asc ?? basePx), s: mark, font: f, color: ink, link: '' })
    }
    y = emitLines(ops, p, left, y, width, b.align, ink) + (b.kind === 'li' ? gap * 0.2 : gap)
  }
  return { height: Math.max(y - gap + m, m * 2 + basePx), ops, margin: m }
}

export function drawOps (ctx, ops, note, pageW, pageH) {
  ctx.save?.()
  ctx.fillStyle = note.paper || '#fffdf5'; ctx.fillRect(0, 0, pageW, pageH)
  ctx.textBaseline = 'alphabetic'
  for (const o of ops) {
    if (o.t === 'rect') { ctx.fillStyle = o.fill; ctx.fillRect(o.x, o.y, o.w, o.h) }
    else if (o.t === 'text') { ctx.font = o.font; ctx.fillStyle = o.link ? (o.color === note.ink ? '#2a62d9' : o.color) : o.color; ctx.fillText(o.s, o.x, o.y) }
    else if (o.t === 'line') { ctx.strokeStyle = o.color; ctx.lineWidth = o.lw; ctx.beginPath(); ctx.moveTo(o.x1, o.y1); ctx.lineTo(o.x2, o.y2); ctx.stroke() }
    else if (o.t === 'box') { ctx.strokeStyle = o.color; ctx.lineWidth = o.lw; ctx.strokeRect(o.x, o.y, o.w, o.h) }
    else if (o.t === 'img') {
      if (o.ready && o.el) { try { ctx.drawImage(o.el, o.x, o.y, o.w, o.h) } catch (_) { /* a broken picture */ } }
      else { ctx.strokeStyle = 'rgba(120,120,140,.8)'; ctx.lineWidth = 2; ctx.strokeRect(o.x, o.y, o.w, o.h); ctx.fillStyle = 'rgba(120,120,140,.8)'; ctx.font = '20px sans-serif'; ctx.fillText('image', o.x + 8, o.y + 26) }
    }
  }
  ctx.restore?.()
}
export default { layoutNote, drawOps, fontString }
