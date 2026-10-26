/**
 * systems/OmniDocRaster.js (V203) — turns a document source into PAGE PIXELS on a 2D canvas (never WebGL, never CSS3D, never an iframe).
 *
 *   const r = createDocRaster({ document, docs, getBytes, loadPdfjs, createImageBitmap })    all optional, with browser defaults
 *   const h = await r.open({ type, id })     -> { ok, key, type, pages, aspect } | { ok:false, error }     (cached; opening again costs nothing)
 *   await r.render(h.key, page, width, canvas, isStale)   -> { ok, w, h } | { ok:false }       draws page `page` (1-based) at `width` pixels wide into `canvas` (resized)
 *   r.close(key) / r.destroy()
 * Sources: 'guide' (a page of the in-app guide, markdown, from data/OmniDocsData.js), 'markdown' / 'text' (utils/OmniDocLayout.js, laid out ONCE then painted at any width),
 * 'image' (createImageBitmap, one page), 'pdf' (pdf.js, loaded on first use from the CDN as an ES module; the page is rendered at the width asked for, one render at a time).
 * Renders go through ONE queue so a burst of nodes never freezes the page; a stale job (the node moved on) is skipped before it starts and cancelled while it runs.
 * Every function resolves, never rejects.
 */
import { layoutBlocks, layoutText, drawOps, PAGE_W } from '../utils/OmniDocLayout.js'
import { parseMarkdown } from '../utils/OmniDocsMarkdown.js'

export const PDFJS_VERSION = '4.10.38'
export const PDFJS_URL = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.min.mjs`
export const PDFJS_WORKER_URL = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`
export const MAX_ENTRIES = 12

let _pdfjs = null
/** Load pdf.js once. The worker is fetched as text and started from a Blob URL (a cross-origin worker cannot be started directly). */
export async function loadPdfjs () {
  if (_pdfjs) return _pdfjs
  const lib = await import(/* @vite-ignore */ PDFJS_URL)
  try {
    const txt = await (await fetch(PDFJS_WORKER_URL)).text()
    lib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([txt], { type: 'text/javascript' }))
  } catch (_) { lib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL }
  _pdfjs = lib
  return lib
}

export function createDocRaster (deps = {}) {
  const doc = deps.document ?? (typeof document !== 'undefined' ? document : null)
  const getBytes = deps.getBytes ?? (async () => null)
  const pdfLoader = deps.loadPdfjs ?? loadPdfjs
  const mkBitmap = deps.createImageBitmap ?? (typeof createImageBitmap !== 'undefined' ? createImageBitmap : null)
  let docsList = deps.docs ?? null
  const entries = new Map()          // key -> entry (insertion order = least recently used first)
  const opening = new Map()
  let destroyed = false
  let measureCtx = null

  const measure = (s, f) => {
    if (!measureCtx) { const c = doc?.createElement?.('canvas'); measureCtx = c?.getContext?.('2d') ?? null }
    if (!measureCtx) return s.length * 7.5
    if (measureCtx.font !== f) measureCtx.font = f
    return measureCtx.measureText(s).width
  }
  const getDocs = async () => { if (!docsList) { try { docsList = (await import('../data/OmniDocsData.js')).DOCS } catch (_) { docsList = [] } } return docsList }
  const keyOf = (s) => `${s.type}:${s.id}`

  // one render at a time
  let chain = Promise.resolve()
  const enqueue = (job) => { const p = chain.then(job, job); chain = p.then(() => {}, () => {}); return p }

  async function build (src) {
    const key = keyOf(src)
    if (src.type === 'guide') {
      const page = (await getDocs()).find(d => d.id === src.id)
      if (!page) return { ok: false, error: 'No such guide page.' }
      const lay = layoutBlocks(parseMarkdown(String(page.text ?? '')), { measure })
      return textEntry(key, 'guide', lay)
    }
    if (src.type === 'markdown' || src.type === 'text') {
      const bytes = await getBytes(src.id); if (!bytes) return { ok: false, error: 'That document is not in the library any more.' }
      const text = new TextDecoder('utf-8').decode(new Uint8Array(bytes)).slice(0, 400000)
      const lay = src.type === 'markdown' ? layoutBlocks(parseMarkdown(text), { measure }) : layoutText(text, { measure })
      return textEntry(key, src.type, lay)
    }
    if (src.type === 'image') {
      const bytes = await getBytes(src.id); if (!bytes) return { ok: false, error: 'That image is not in the library any more.' }
      if (!mkBitmap) return { ok: false, error: 'This browser cannot decode images here.' }
      let bmp; try { bmp = await mkBitmap(new Blob([bytes])) } catch (_) { return { ok: false, error: 'That image could not be decoded.' } }
      const aspect = Math.min(5, Math.max(0.2, bmp.height / Math.max(1, bmp.width)))
      return {
        ok: true, key, type: 'image', pages: 1, aspect,
        async renderPage (n, width, canvas, stale) {
          const w = Math.max(16, Math.round(width)); const h = Math.max(16, Math.round(w * aspect))
          canvas.width = w; canvas.height = h
          const ctx = canvas.getContext('2d'); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h); ctx.drawImage(bmp, 0, 0, w, h)
          return { ok: true, w, h }
        },
        async getText () { return '' },
        destroy () { try { bmp.close?.() } catch (_) { /* ignore */ } },
      }
    }
    if (src.type === 'pdf') {
      const bytes = await getBytes(src.id); if (!bytes) return { ok: false, error: 'That PDF is not in the library any more.' }
      let lib; try { lib = await pdfLoader() } catch (_) { return { ok: false, error: 'The PDF reader could not be loaded (it needs a network connection the first time).' } }
      let pdf; try { pdf = await lib.getDocument({ data: new Uint8Array(bytes.slice(0)), isEvalSupported: false }).promise } catch (_) { return { ok: false, error: 'That PDF could not be opened.' } }
      let aspect = 1.414
      try { const p1 = await pdf.getPage(1); const v = p1.getViewport({ scale: 1 }); aspect = Math.min(5, Math.max(0.2, v.height / v.width)) } catch (_) { /* default */ }
      return {
        ok: true, key, type: 'pdf', pages: pdf.numPages || 1, aspect,
        async renderPage (n, width, canvas, stale) {
          const page = await pdf.getPage(Math.min(Math.max(1, n), pdf.numPages || 1))
          const v0 = page.getViewport({ scale: 1 })
          const scale = Math.max(16, width) / v0.width
          const vp = page.getViewport({ scale })
          const w = Math.max(16, Math.round(vp.width)); const h = Math.max(16, Math.round(vp.height))
          canvas.width = w; canvas.height = h
          const ctx = canvas.getContext('2d'); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h)
          const task = page.render({ canvasContext: ctx, viewport: vp })
          const watch = setInterval(() => { if (stale?.()) { try { task.cancel() } catch (_) { /* ignore */ } } }, 60)
          try { await task.promise } catch (_) { return { ok: false } } finally { clearInterval(watch); try { page.cleanup?.() } catch (_) { /* ignore */ } }
          return { ok: true, w, h }
        },
        async getText (n) {
          try {
            const page = await pdf.getPage(Math.min(Math.max(1, n), pdf.numPages || 1)); const tc = await page.getTextContent()
            let out = ''; for (const it of tc.items) { out += it.str ?? ''; out += it.hasEOL ? '\n' : '' }
            return out.replace(/[ \t]+\n/g, '\n').trim()
          } catch (_) { return '' }
        },
        destroy () { try { pdf.destroy?.() } catch (_) { /* ignore */ } },
      }
    }
    return { ok: false, error: 'Nothing to show.' }
  }

  function textEntry (key, type, lay) {
    const aspect = lay.h / lay.w
    return {
      ok: true, key, type, pages: lay.pages.length, aspect,
      async renderPage (n, width, canvas) {
        const w = Math.max(16, Math.round(width)); const h = Math.max(16, Math.round(w * aspect))
        canvas.width = w; canvas.height = h
        drawOps(canvas.getContext('2d'), lay.pages[Math.min(Math.max(1, n), lay.pages.length) - 1], { width: w, height: h, paper: '#ffffff' })
        return { ok: true, w, h }
      },
      async getText (n) {
        const pg = lay.pages[Math.min(Math.max(1, n), lay.pages.length) - 1]; const rows = new Map()
        for (const op of (pg?.ops ?? [])) if (op.o === 'text') { const k = Math.round(op.y); (rows.get(k) ?? rows.set(k, []).get(k)).push(op) }
        return [...rows.keys()].sort((a, b) => a - b).map(k => rows.get(k).sort((a, b) => a.x - b.x).map(o => o.s).join(' ')).join('\n')
      },
      destroy () {},
    }
  }

  const api = {
    async open (src) {
      try {
        if (destroyed || !src || typeof src.type !== 'string' || typeof src.id !== 'string' || src.type === 'none') return { ok: false, error: 'Nothing to show.' }
        const key = keyOf(src)
        const have = entries.get(key)
        if (have) { entries.delete(key); entries.set(key, have); return { ok: true, key, type: have.type, pages: have.pages, aspect: have.aspect } }
        if (opening.has(key)) return await opening.get(key)
        const p = (async () => {
          const e = await build(src)
          if (!e.ok) return e
          if (destroyed) { e.destroy(); return { ok: false, error: 'Closed.' } }
          entries.set(key, e)
          while (entries.size > MAX_ENTRIES) { const [k, old] = entries.entries().next().value; entries.delete(k); old.destroy() }
          return { ok: true, key, type: e.type, pages: e.pages, aspect: e.aspect }
        })().catch(() => ({ ok: false, error: 'That document could not be opened.' })).finally(() => opening.delete(key))
        opening.set(key, p)
        return await p
      } catch (_) { return { ok: false, error: 'That document could not be opened.' } }
    },
    render (key, page, width, canvas, isStale = () => false) {
      return enqueue(async () => {
        try {
          const e = entries.get(key)
          if (!e || destroyed || isStale()) return { ok: false, stale: true }
          const res = await e.renderPage(page, width, canvas, isStale)
          return isStale() ? { ok: false, stale: true } : res
        } catch (_) { return { ok: false } }
      })
    },
    /** The text of a page (for the preview and Copy text). '' when there is none. */
    async text (key, page) { try { const e = entries.get(key); return e ? String(await e.getText(page) ?? '') : '' } catch (_) { return '' } },
    info (key) { const e = entries.get(key); return e ? { type: e.type, pages: e.pages, aspect: e.aspect } : null },
    close (key) { const e = entries.get(key); if (e) { entries.delete(key); e.destroy() } },
    destroy () { destroyed = true; for (const e of entries.values()) e.destroy(); entries.clear() },
    get size () { return entries.size },
  }
  return api
}

export { PAGE_W }
export default createDocRaster
