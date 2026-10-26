/**
 * ui/OmniDocView.js — ⟐OmniDoc: the controls of a DocNode (V203). DOM only (DOM first, 3D second).
 *
 * Choose what the sheet shows (a page of the in-app guide, or a file you import: PDF, markdown, text, image), turn pages, size and look (width, sides, paper, frame, quality), read the status,
 * see a preview of the current page and select / copy its text. Everything is read and written through systems/OmniDocNodes.js (Extra.SERVICES.doc): each edit is one immutable model op
 * = one undo step. The view never decodes or draws a document into the scene itself; the preview uses the same raster queue as the sheets.
 */

import * as D from '../utils/OmniDocModel.js'
import { SERVICES } from '../utils/OmniExtraKinds.js'

export const NAV_ITEM = '⟐OmniDoc'
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
export const ACCEPT = '.pdf,.md,.markdown,.txt,.text,image/png,image/jpeg,image/gif,image/webp,application/pdf,text/plain,text/markdown'

export function injectDocStyles () {
  if (typeof document === 'undefined' || document.getElementById('odc-styles')) return
  const s = document.createElement('style'); s.id = 'odc-styles'
  s.textContent = `
.odc { display: flex; flex-direction: column; gap: 8px; font-size: 11px; }
.odc button, .odc select, .odc input { font: inherit; color: inherit; }
.odc button { background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.18); border-radius: 6px; padding: 3px 8px; cursor: pointer; min-height: 26px; }
.odc button:hover:not(:disabled) { background: rgba(255,255,255,.15); } .odc button:disabled { opacity: .4; cursor: default; }
.odc button.is-on { background: rgba(120,190,255,.35); border-color: rgba(120,190,255,.8); }
.odc select, .odc input[type=text], .odc input[type=number] { background: rgba(0,0,0,.35); border: 1px solid rgba(255,255,255,.2); border-radius: 5px; padding: 2px 5px; min-height: 26px; box-sizing: border-box; }
.odc select option { color: #111; background: #fff; }
.odc input[type=number] { width: 64px; }
.odc-row { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.odc-grid { display: grid; grid-template-columns: minmax(150px, 220px) 1fr; gap: 10px; }
.odc-prev { background: #fff; border-radius: 4px; max-width: 100%; height: auto; display: block; box-shadow: 0 2px 10px rgba(0,0,0,.5); }
.odc-prevbox { min-height: 90px; display: flex; align-items: flex-start; justify-content: center; }
.odc-text { width: 100%; box-sizing: border-box; min-height: 90px; max-height: 160px; overflow: auto; white-space: pre-wrap; user-select: text; -webkit-user-select: text; font-size: 10.5px; line-height: 1.4; padding: 6px; background: rgba(0,0,0,.3); border-radius: 6px; }
.odc-drop { border: 1px dashed rgba(255,255,255,.35); border-radius: 8px; padding: 6px 8px; line-height: 1.45; }
.odc-drop.is-over { background: rgba(120,190,255,.2); border-color: rgba(120,190,255,.9); }
.odc-msg { min-height: 14px; opacity: .9; } .odc-msg.is-err { color: #ff9c9c; }
.odc-notice { padding: 8px; border: 1px dashed rgba(255,255,255,.35); border-radius: 8px; line-height: 1.45; }
.odc-lib { display: flex; flex-direction: column; gap: 2px; max-height: 120px; overflow: auto; }
.odc-lib div { display: flex; gap: 6px; align-items: center; justify-content: space-between; border: 1px solid rgba(255,255,255,.12); border-radius: 6px; padding: 1px 6px; }
.odc-note { font-size: 9.5px; opacity: .75; line-height: 1.4; }
@media (max-width: 700px) { .odc-grid { grid-template-columns: 1fr; } .odc button, .odc select, .odc input { min-height: 40px; } }
`
  document.head.appendChild(s)
}

export default class OmniDocView {
  /** @param host the element to fill. @param opts { svc?, active?:()=>bool, compact? } */
  constructor (host, opts = {}) {
    this.host = host; this.opts = opts
    this.nodeId = null
    this._bound = []
    this._sig = ''
    this._msg = ''; this._err = false
    this._previewKey = ''
    this._previewSeq = 0
  }
  get svc () { return this.opts.svc ?? SERVICES.doc }

  mount () {
    injectDocStyles()
    this.host.innerHTML = '<div class="odc" data-ref="root"></div>'
    const on = (t, n, f) => { t.addEventListener(n, f); this._bound.push([t, n, f]) }
    on(this.host, 'click', (e) => this._click(e))
    on(this.host, 'change', (e) => this._change(e))
    on(this.host, 'input', (e) => this._input(e))
    // V206: PageUp / PageDown turn the page while the focus is in this window (not while typing in a field)
    on(this.host, 'keydown', (e) => {
      if (e.key !== 'PageUp' && e.key !== 'PageDown') return
      const t = e.target; if (t && (t.tagName === 'TEXTAREA' || (t.tagName === 'INPUT' && ['text', 'number'].includes(t.type)) || t.tagName === 'SELECT')) return
      if (!this.nodeId) return
      e.preventDefault(); e.stopPropagation()
      this._act('turn', () => this.svc?.turn(this.nodeId, e.key === 'PageUp' ? -1 : 1))
    })
    on(this.host, 'pointerdown', (e) => { if (e.target?.type === 'range') this.svc?.beginStroke?.(this.nodeId) })
    on(window, 'pointerup', () => this.svc?.endStroke?.())
    on(this.host, 'dragover', (e) => { if (e.dataTransfer?.types?.includes?.('Files')) { e.preventDefault(); this.host.querySelector('.odc-drop')?.classList.add('is-over') } })
    on(this.host, 'dragleave', () => this.host.querySelector('.odc-drop')?.classList.remove('is-over'))
    on(this.host, 'drop', (e) => { const f = e.dataTransfer?.files?.[0]; if (f) { e.preventDefault(); this.host.querySelector('.odc-drop')?.classList.remove('is-over'); this._import(f) } })
    const ev = (name, fn) => { const f = (e) => fn(e.detail ?? {}); window.addEventListener(name, f); this._bound.push([window, name, f]) }
    ev('omni:doc-changed', (d) => { if (d.nodeId === this.nodeId) this._sync() })
    ev('omni:doc-status', (d) => { if (d.nodeId === this.nodeId) this._status(d) })
    ev('omni:doc-sources-changed', () => this._sync(true))
    ev('omni:node-selected', (d) => { const id = d.node?.id; if (id && d.node?.nodeKind === 'docNode' && id !== this.nodeId) this.setNode(id) })
    ev('omni:node-created', () => this._sync(true))
    ev('omni:node-deleted', (d) => { if (d.id === this.nodeId) this.setNode(null); else this._sync(true) })
    this.svc?.loadGuidePages?.().then(() => this._sync(true), () => {})
    this.refresh()
  }
  destroy () {
    for (const [t, n, f] of this._bound) { try { t.removeEventListener(n, f) } catch (_) { /* gone */ } }
    this._bound = []; this._previewSeq++
    this.host.innerHTML = ''
  }
  onOpened () { this.refresh() }
  onResize () {}
  setNode (id) { this.nodeId = id && this.svc?.isDocNode?.(id) ? id : null; this._sig = ''; this._previewKey = ''; this.refresh() }
  _pick () {
    const s = this.svc; if (!s) return
    if (this.nodeId && s.isDocNode(this.nodeId)) return
    const sel = s.selectedId
    if (sel && s.isDocNode(sel)) { this.nodeId = sel; return }
    this.nodeId = s.listDocNodes()[0] ?? null
  }
  refresh () { this._sig = ''; this._sync(true) }
  _doc () { return this.nodeId ? this.svc?.getDoc?.(this.nodeId) ?? null : null }
  say (text, err = false) { this._msg = text; this._err = err; const m = this.host.querySelector('[data-ref=msg]'); if (m) { m.textContent = text; m.className = 'odc-msg' + (err ? ' is-err' : '') } }
  _status (d) {
    const st = this.host.querySelector('[data-ref=status]'); if (st) st.textContent = d.text || (d.status === 'ready' ? '' : d.status)
    if (d.status === 'ready') this._previewKey = ''
    this._sync()
  }

  _sync (force = false) {
    const root = this.host.querySelector('[data-ref=root]'); if (!root) return
    this._pick()
    const svc = this.svc; const doc = this._doc()
    const sig = JSON.stringify([this.nodeId, doc, svc?.listDocNodes?.() ?? [], svc?.listSources?.() ?? null, svc?.canUndo?.(this.nodeId), svc?.canRedo?.(this.nodeId), this._msg])
    if (!force && sig === this._sig) return
    const active = document.activeElement
    if (!force && active && (active.type === 'range' || active.type === 'text') && this.host.contains(active)) { this._sig = sig; return }
    this._sig = sig
    root.innerHTML = this._html(svc, doc)
    this._updatePreview()
  }

  _html (svc, doc) {
    if (!svc) return '<div class="odc-notice">The document system is not available.</div>'
    if (!this.nodeId || !doc) {
      return `<div class="odc-notice">No doc node yet. A doc node is a sheet in the space that shows a document: a PDF, a markdown or text file, an image, or a page of this guide. It is drawn flat (no extra GPU context) and only as sharp as it needs to be for how far away it is.<div class="odc-row" style="margin-top:6px"><button data-act="create">Create a doc node</button></div></div>`
    }
    const src = svc.listSources(); const nodes = svc.listDocNodes()
    const cur = `${doc.source.type}:${doc.source.id}`
    const gopt = src.guide.map(g => `<option value="guide:${esc(g.id)}"${cur === 'guide:' + g.id ? ' selected' : ''}>${esc(g.name)}</option>`).join('')
    const lopt = src.library.map(l => `<option value="${esc(l.type)}:${esc(l.id)}"${cur === l.type + ':' + l.id ? ' selected' : ''}>${esc(l.name)} (${esc(l.type)})</option>`).join('')
    const known = doc.source.type === 'none' || src.guide.some(g => cur === 'guide:' + g.id) || src.library.some(l => cur === l.type + ':' + l.id)
    const sourceSel = `<select data-act="source" aria-label="Document"><option value="none:">— nothing —</option>${known ? '' : `<option value="${esc(cur)}" selected>(missing) ${esc(doc.title || doc.source.id)}</option>`}
      <optgroup label="Guide pages">${gopt}</optgroup><optgroup label="Your documents">${lopt}</optgroup></select>`
    const st = svc.getStatus?.(this.nodeId) ?? { text: '' }
    const sel = `<select data-act="pick" aria-label="Doc node">${nodes.map(id => `<option value="${esc(id)}"${id === this.nodeId ? ' selected' : ''}>${esc(svc.getNodeData(id)?.label || id)}</option>`).join('')}</select>`
    const pages = doc.pages > 0 ? doc.pages : '?'
    const vp = D.visiblePages(doc); const lastShown = doc.pages > 0 && (vp[1] || vp[0]) >= doc.pages
    const lib = src.library.length ? `<div class="odc-lib" aria-label="Your documents">${src.library.map(l => `<div><span>${esc(l.name)} <span class="odc-note">${esc(l.type)}, ${(l.size / 1024).toFixed(l.size > 10240 ? 0 : 1)} KB</span></span><span><button data-act="libren" data-id="${esc(l.id)}" aria-label="Rename ${esc(l.name)}">Rename</button> <button data-act="libdel" data-id="${esc(l.id)}" aria-label="Remove ${esc(l.name)} from the library">×</button></span></div>`).join('')}</div>` : ''
    return `<div class="odc-row">${sel}<button data-act="create" title="New doc node">+ Doc</button>
        <button data-act="undo" ${svc.canUndo(this.nodeId) ? '' : 'disabled'}>Undo</button><button data-act="redo" ${svc.canRedo(this.nodeId) ? '' : 'disabled'}>Redo</button></div>
      <div class="odc-drop"><div class="odc-row">${sourceSel}<button data-act="import">Import a file…</button><input type="file" data-ref="file" accept="${ACCEPT}" hidden></div>
        <div class="odc-note">PDF, markdown, text or an image. Drop a file here too. Files stay in this browser (up to 50 MB each).</div></div>
      <div class="odc-row"><button data-act="prev" ${doc.page <= 1 ? 'disabled' : ''} aria-label="Page up (previous page)" title="Page up (the PageUp key)">▲ Page up</button>
        <button data-act="next" ${lastShown ? 'disabled' : ''} aria-label="Page down (next page)" title="Page down (the PageDown key)">▼ Page down</button>
        <label>page <input type="number" data-act="page" min="1" max="${doc.pages || 5000}" value="${doc.page}" aria-label="Page number"> of ${pages}${vp[1] ? ` <span class="odc-note">(showing ${vp[0]}–${vp[1]})</span>` : ''}</label>
        <span class="odc-note" data-ref="status">${esc(st.text)}</span></div>
      <div class="odc-row"><label>pages <select data-act="spread" aria-label="One page or two pages"><option value="single"${doc.spread === 'single' ? ' selected' : ''}>One page</option><option value="double"${doc.spread === 'double' ? ' selected' : ''}>Two pages (open book)</option></select></label>
        <span class="odc-row" role="group" aria-label="Zoom"><button data-act="zoomout" ${doc.zoom <= D.ZOOM_MIN ? 'disabled' : ''} aria-label="Zoom out">−</button><label>zoom <input type="number" data-act="zoom" min="${D.ZOOM_MIN}" max="${D.ZOOM_MAX}" step="25" value="${doc.zoom}" aria-label="Zoom percent"> %</label><button data-act="zoomin" ${doc.zoom >= D.ZOOM_MAX ? 'disabled' : ''} aria-label="Zoom in">+</button><button data-act="zoomfit" ${doc.zoom === 100 ? 'disabled' : ''} aria-label="Zoom to fit (100 percent)">Fit</button></span>
        <span class="odc-row" role="group" aria-label="Move the zoomed view"><button data-act="panl" ${doc.zoom > 100 ? '' : 'disabled'} aria-label="Look left">◀</button><button data-act="panu" ${doc.zoom > 100 ? '' : 'disabled'} aria-label="Look up">▲</button><button data-act="pand" ${doc.zoom > 100 ? '' : 'disabled'} aria-label="Look down">▼</button><button data-act="panr" ${doc.zoom > 100 ? '' : 'disabled'} aria-label="Look right">▶</button></span></div>
      <div class="odc-note">100 % shows the whole page on the sheet. Zooming in shows a part of it, sharper the closer you are (up to the device's texture limit). Two pages turn two at a time (1–2, 3–4 …).</div>
      <div class="odc-grid"><div class="odc-prevbox" data-ref="prevbox"><canvas class="odc-prev" data-ref="prev" width="2" height="2" aria-label="Preview of the current page"></canvas></div>
        <div class="odc-col">
          <div class="odc-row"><label>width <input type="range" data-act="width" min="1" max="30" step="0.5" value="${Math.min(30, doc.width)}" aria-label="Sheet width"> <b data-ref="wv">${doc.width}</b></label></div>
          <div class="odc-row"><label>sides <select data-act="sides"><option value="double"${doc.sides === 'double' ? ' selected' : ''}>both</option><option value="front"${doc.sides === 'front' ? ' selected' : ''}>front only</option></select></label>
            <label>quality <select data-act="quality"><option value="auto"${doc.quality === 'auto' ? ' selected' : ''}>auto</option><option value="low"${doc.quality === 'low' ? ' selected' : ''}>low (lighter)</option><option value="high"${doc.quality === 'high' ? ' selected' : ''}>high (sharper)</option></select></label></div>
          <div class="odc-row"><label>paper <input type="color" data-act="paper" value="${esc(doc.paper)}" aria-label="Paper colour"></label><label><input type="checkbox" data-act="frame" ${doc.frame ? 'checked' : ''}> frame</label>
            <label>title <input type="text" data-act="title" value="${esc(doc.title)}" maxlength="80" style="width:130px" aria-label="Title"></label></div>
          <div class="odc-note">Quality changes how many pixels the page is drawn with. Low is easier on phones.</div>
        </div></div>
      <div><div class="odc-row"><b>Text of this page</b><button data-act="copy">Copy text</button></div><div class="odc-text" data-ref="text" tabindex="0" aria-label="Text of the current page"></div></div>
      ${lib}
      <div class="odc-msg ${this._err ? 'is-err' : ''}" role="status" aria-live="polite" data-ref="msg">${esc(this._msg)}</div>`
  }

  async _updatePreview () {
    const svc = this.svc; const doc = this._doc(); if (!svc || !doc) return
    const key = JSON.stringify([this.nodeId, doc.source, doc.page])
    if (key === this._previewKey) return
    this._previewKey = key
    const seq = ++this._previewSeq
    const cv = this.host.querySelector('[data-ref=prev]'); const tx = this.host.querySelector('[data-ref=text]')
    if (doc.source.type === 'none') { if (tx) tx.textContent = ''; return }
    if (tx) tx.textContent = 'Loading…'
    const w = this.opts.compact ? 260 : 360
    const [res, text] = await Promise.all([svc.renderPreview(this.nodeId, cv, w), svc.getPageText(this.nodeId)])
    if (seq !== this._previewSeq) return
    const t2 = this.host.querySelector('[data-ref=text]'); if (t2) t2.textContent = text || (res?.ok ? '(This page has no text.)' : 'The page could not be shown.')
    if (!res?.ok && res?.error) this.say(res.error, true)
  }

  async _import (file) {
    const s = this.svc; if (!s || !this.nodeId) return this.say('Create a doc node first.', true)
    this.say('Importing…')
    const r = await s.attachFile(this.nodeId, file)
    this.say(r.ok ? `Added “${r.meta.name}”.` : (r.error?.message ?? r.message ?? 'Could not import that file.'), !r.ok)
  }
  _act (name, fn) { const r = fn(); if (r && r.ok === false) this.say(r.error || 'That did not work.', true); else this.say(''); return r }
  _click (e) {
    const b = e.target.closest?.('[data-act]'); if (!b || b.disabled) return
    const s = this.svc; const id = this.nodeId; const a = b.dataset.act
    switch (a) {
      case 'create': { const r = s?.createDocNode({ select: true }); if (r?.ok) { this.nodeId = r.nodeId; this.refresh() } else this.say(r?.error || 'Could not create.', true); break }
      case 'undo': s?.undo(id); break
      case 'redo': s?.redo(id); break
      case 'prev': this._act('turn', () => s.turn(id, -1)); break
      case 'next': this._act('turn', () => s.turn(id, 1)); break
      case 'zoomin': this._act('zoom', () => s.zoomBy(id, 1)); break
      case 'zoomout': this._act('zoom', () => s.zoomBy(id, -1)); break
      case 'zoomfit': this._act('zoom', () => s.setZoom(id, 100)); break
      case 'panl': case 'panr': case 'panu': case 'pand': { const d = this._doc(); if (!d) break; const k = 0.25; const dx = a === 'panl' ? -k : a === 'panr' ? k : 0; const dy = a === 'panu' ? -k : a === 'pand' ? k : 0; this._act('pan', () => s.setPan(id, Math.min(1, Math.max(-1, d.panX + dx)), Math.min(1, Math.max(-1, d.panY + dy)))); break }
      case 'import': this.host.querySelector('[data-ref=file]')?.click(); break
      case 'copy': { const t = this.host.querySelector('[data-ref=text]')?.textContent ?? ''; try { navigator.clipboard.writeText(t).then(() => this.say('Copied.'), () => this.say('Select the text and copy it.', true)) } catch (_) { this.say('Select the text and copy it.', true) } break }
      case 'libdel': s?.removeFromLibrary(b.dataset.id).then((r) => this.say(r?.ok ? 'Removed from your documents.' : (r?.message || 'Could not remove.'), !r?.ok)); break
      case 'libren': { const name = typeof prompt === 'function' ? prompt('New name') : null; if (name) s?.renameInLibrary(b.dataset.id, name).then(() => this._sync(true)); break }
      default: break
    }
  }
  _change (e) {
    const el = e.target; const a = el.dataset?.act; const s = this.svc; const id = this.nodeId
    if (el.dataset?.ref === 'file') { const f = el.files?.[0]; if (f) this._import(f); el.value = ''; return }
    if (!a || !s) return
    switch (a) {
      case 'pick': this.setNode(el.value); break
      case 'source': { const i = el.value.indexOf(':'); const type = el.value.slice(0, i); const sid = el.value.slice(i + 1); const label = el.options[el.selectedIndex]?.textContent?.replace(/ \((pdf|markdown|text|image)\)$/, '') ?? null; this._act('source', () => s.setSource(id, type === 'none' ? 'none' : type, sid, type === 'none' ? '' : label)); break }
      case 'page': this._act('page', () => s.goto(id, Number(el.value))); break
      case 'spread': this._act('spread', () => s.setSpread(id, el.value)); break
      case 'zoom': this._act('zoom', () => s.setZoom(id, Number(el.value))); break
      case 'sides': this._act('sides', () => s.edit(id, 'sides', (m) => D.setSides(m, el.value))); break
      case 'quality': this._act('quality', () => s.edit(id, 'quality', (m) => D.setQuality(m, el.value))); break
      case 'paper': this._act('paper', () => s.edit(id, 'paper', (m) => D.setPaper(m, el.value), 'paper')); break
      case 'frame': this._act('frame', () => s.edit(id, 'frame', (m) => D.setFrame(m, el.checked))); break
      case 'title': this._act('title', () => s.edit(id, 'title', (m) => D.setTitle(m, el.value), 'title')); break
      default: break
    }
  }
  _input (e) {
    const el = e.target
    if (el.dataset?.act === 'width') { const v = Number(el.value); const w = this.host.querySelector('[data-ref=wv]'); if (w) w.textContent = String(v); this.svc?.edit(this.nodeId, 'width', (m) => D.setWidth(m, v), 'width') }
  }
}
