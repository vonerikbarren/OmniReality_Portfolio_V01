/**
 * ui/OmniNoteEditor.js — ⟐OmniNote: the rich-text editor of the NoteNode (V213), the "Word" node.
 * A toolbar (undo / redo, block style, font, size, bold / italic / underline / strike / sub / super, text + highlight colour, alignment, lists, indent, line spacing, links, pictures,
 * tables with row / column tools, rules, clear formatting), find + replace, a word count, and the page settings of the sheet (width, fit, paper, ink, font, margin, resolution, sides).
 * The text is edited in a contenteditable region; every change is cleaned (utils/OmniNoteModel.js) and stored through systems/OmniNoteNodes.js (Extra.SERVICES.note), which redraws the sheet.
 * Undo / redo are the note's own (they also bring back page settings). Text commands use document.execCommand where the browser has it; tables, find / replace, size and line spacing are done here.
 */
import { SERVICES } from '../utils/OmniExtraKinds.js'
import * as N from '../utils/OmniNoteModel.js'

export const NAV_ITEM = '⟐OmniNote'
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const SIZES = [8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 64, 72, 96]
const BLOCK_TAGS = { p: 'Paragraph', h1: 'Heading 1', h2: 'Heading 2', h3: 'Heading 3', h4: 'Heading 4', h5: 'Heading 5', h6: 'Heading 6', blockquote: 'Quote', pre: 'Code' }
const TYPE_MS = 150
const IMG_MAX_W = 800

export function injectNoteStyles () {
  if (typeof document === 'undefined' || document.getElementById('onote-styles')) return
  const s = document.createElement('style'); s.id = 'onote-styles'
  s.textContent = `
.onote { display: flex; flex-direction: column; gap: 6px; font-size: 11px; }
.onote button, .onote select, .onote input { font: inherit; color: inherit; }
.onote button { background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.18); border-radius: 5px; padding: 2px 7px; cursor: pointer; min-height: 26px; min-width: 26px; }
.onote button:hover:not(:disabled) { background: rgba(255,255,255,.17); } .onote button:disabled { opacity: .4; cursor: default; } .onote button.is-on { background: rgba(255,211,107,.3); border-color: rgba(255,211,107,.85); }
.onote select, .onote input[type=text], .onote input[type=number] { background: rgba(0,0,0,.35); border: 1px solid rgba(255,255,255,.2); border-radius: 5px; padding: 2px 5px; min-height: 26px; box-sizing: border-box; }
.onote select option { color: #111; background: #fff; } .onote input[type=number] { width: 62px; } .onote input[type=color] { width: 30px; height: 26px; padding: 0; border: 1px solid rgba(255,255,255,.2); background: none; }
.onote-bar { display: flex; flex-wrap: wrap; gap: 3px; align-items: center; padding: 4px; border: 1px solid rgba(255,255,255,.14); border-radius: 8px; background: rgba(255,255,255,.04); }
.onote-sep { width: 1px; align-self: stretch; background: rgba(255,255,255,.18); margin: 0 2px; }
.onote-page { border: 1px solid rgba(255,255,255,.2); border-radius: 6px; min-height: 240px; max-height: 50vh; overflow: auto; padding: 14px 16px; outline: none; line-height: 1.4; word-break: break-word; }
.onote-page:focus { border-color: rgba(255,211,107,.8); } .onote-page table { border-collapse: collapse; width: 100%; } .onote-page td, .onote-page th { border: 1px solid rgba(120,120,140,.8); padding: 4px 6px; min-width: 24px; }
.onote-page blockquote { margin: 6px 0; padding-left: 12px; border-left: 3px solid rgba(120,120,160,.7); } .onote-page pre { background: rgba(120,120,140,.16); padding: 6px; font-family: monospace; white-space: pre-wrap; }
.onote-page img { max-width: 100%; } .onote-page mark.onote-hit { background: #ffe066; color: #000; }
.onote-row { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; } .onote-msg { min-height: 14px; font-size: 10px; } .onote-msg.is-err { color: #ff9c9c; } .onote-dim { opacity: .7; font-size: 10px; }
.onote-box { border: 1px solid rgba(255,255,255,.15); border-radius: 8px; padding: 6px 8px; display: flex; flex-direction: column; gap: 6px; }
@media (max-width: 700px) { .onote button, .onote select, .onote input { min-height: 40px; } }
`
  document.head.appendChild(s)
}

const BTN = (cmd, label, title, extra = '') => `<button type="button" data-cmd="${cmd}" title="${esc(title)}" aria-label="${esc(title)}" ${extra}>${label}</button>`

export default class OmniNoteEditor {
  constructor (host, opts = {}) { this.host = host; this.opts = opts; this._bound = []; this.nodeId = null; this._typeT = null; this._lastHtml = null; this._range = null; this._hits = []; this._hitIdx = -1; this._msg = '' }
  get svc () { return this.opts.svc ?? SERVICES.note }
  get page () { return this.host.querySelector('[data-ref="page"]') }

  mount () {
    injectNoteStyles()
    this.host.innerHTML = this._html()
    const on = (t, n, f) => { t.addEventListener(n, f); this._bound.push([t, n, f]) }
    on(this.host, 'mousedown', (e) => { if (e.target.closest?.('.onote-bar button')) e.preventDefault() })   // keep the caret in the text while a tool is pressed
    on(this.host, 'click', (e) => this._click(e))
    on(this.host, 'change', (e) => this._change(e))
    on(this.page, 'input', () => this._typed())
    on(this.page, 'blur', () => this._flushTyping())
    on(document, 'selectionchange', () => this._saveRange())
    const ev = (name, fn) => { const f = (e) => fn(e.detail ?? {}); window.addEventListener(name, f); this._bound.push([window, name, f]) }
    ev('omni:note-changed', (d) => { if (d.nodeId === this.nodeId && d.reason !== 'type') this._load(d.reason === 'page' ? false : true); this._status() })
    ev('omni:node-selected', (d) => { const id = d.node?.id ?? null; if (id && this.svc?.isNoteNode?.(id)) this.setNode(id) })
    ev('omni:node-created', () => this._fillList()); ev('omni:node-deleted', (d) => { if (d.id === this.nodeId) this.setNode(null); this._fillList() })
    this._fillList()
    const first = this.opts.nodeId ?? this.svc?.listNoteNodes?.()[0] ?? null
    this.setNode(first)
  }
  destroy () { this._flushTyping(); for (const [t, n, f] of this._bound) { try { t.removeEventListener(n, f) } catch (_) {} } this._bound = []; this.host.innerHTML = '' }
  onOpened () { this._fillList(); this._status() }
  onResize () {}
  say (text, err = false) { this._msg = text; const m = this.host.querySelector('[data-ref="msg"]'); if (m) { m.textContent = text; m.className = 'onote-msg' + (err ? ' is-err' : '') } }

  _html () {
    const sel = (ref, opts, title) => `<select data-ref="${ref}" aria-label="${title}" title="${title}">${opts}</select>`
    return `<div class="onote">
      <div class="onote-row"><select data-ref="list" aria-label="Note"></select><button type="button" data-act="new">+ New note</button><input type="text" data-ref="title" maxlength="80" placeholder="Title" aria-label="Title"><span class="onote-dim" data-ref="count"></span></div>
      <div class="onote-bar" role="toolbar" aria-label="Formatting">
        <button type="button" data-act="undo" title="Undo" aria-label="Undo">↶</button><button type="button" data-act="redo" title="Redo" aria-label="Redo">↷</button><span class="onote-sep"></span>
        ${sel('block', Object.entries(BLOCK_TAGS).map(([k, v]) => `<option value="${k}">${v}</option>`).join(''), 'Style')}
        ${sel('font', '<option value="">Font</option>' + N.FONT_IDS.map(k => `<option value="${k}">${k[0].toUpperCase() + k.slice(1)}</option>`).join(''), 'Font')}
        ${sel('size', '<option value="">Size</option>' + SIZES.map(s => `<option value="${s}">${s}</option>`).join(''), 'Size')}<span class="onote-sep"></span>
        ${BTN('bold', '<b>B</b>', 'Bold')}${BTN('italic', '<i>I</i>', 'Italic')}${BTN('underline', '<u>U</u>', 'Underline')}${BTN('strikeThrough', '<s>S</s>', 'Strikethrough')}${BTN('subscript', 'x₂', 'Subscript')}${BTN('superscript', 'x²', 'Superscript')}<span class="onote-sep"></span>
        <input type="color" data-ref="color" value="#1b1b22" title="Text colour" aria-label="Text colour"><input type="color" data-ref="hilite" value="#ffe066" title="Highlight colour" aria-label="Highlight colour">${BTN('removeFormat', '⌫', 'Clear formatting')}<span class="onote-sep"></span>
        ${BTN('justifyLeft', '⇤', 'Align left')}${BTN('justifyCenter', '↔', 'Centre')}${BTN('justifyRight', '⇥', 'Align right')}${BTN('justifyFull', '☰', 'Justify')}<span class="onote-sep"></span>
        ${BTN('insertUnorderedList', '•≡', 'Bullet list')}${BTN('insertOrderedList', '1≡', 'Numbered list')}${BTN('outdent', '⇠', 'Outdent')}${BTN('indent', '⇢', 'Indent')}
        ${sel('lh', '<option value="">Line</option>' + ['1', '1.15', '1.35', '1.5', '2', '2.5'].map(v => `<option value="${v}">${v}</option>`).join(''), 'Line spacing')}<span class="onote-sep"></span>
        <button type="button" data-act="link" title="Link" aria-label="Link">🔗</button>${BTN('unlink', '⛓', 'Remove link')}<button type="button" data-act="image" title="Picture" aria-label="Picture">🖼</button><input type="file" data-ref="file" accept="image/png,image/jpeg,image/gif,image/webp" hidden>${BTN('insertHorizontalRule', '―', 'Horizontal rule')}
      </div>
      <div class="onote-bar" aria-label="Table tools"><b>Table</b><input type="number" data-ref="rows" min="1" max="${N.NOTE_LIMITS.tableRows}" value="3" aria-label="Rows"> × <input type="number" data-ref="cols" min="1" max="${N.NOTE_LIMITS.tableCols}" value="3" aria-label="Columns">
        <button type="button" data-act="table">Insert</button><button type="button" data-tbl="row+">+ Row</button><button type="button" data-tbl="row-">− Row</button><button type="button" data-tbl="col+">+ Col</button><button type="button" data-tbl="col-">− Col</button><button type="button" data-tbl="del">Delete table</button></div>
      <div class="onote-page" data-ref="page" contenteditable="true" spellcheck="true" role="textbox" aria-multiline="true" aria-label="Note text"></div>
      <div class="onote-bar" aria-label="Find and replace"><input type="text" data-ref="find" placeholder="Find" aria-label="Find"><input type="text" data-ref="repl" placeholder="Replace with" aria-label="Replace with">
        <label><input type="checkbox" data-ref="case"> Aa</label><button type="button" data-act="findnext">Find next</button><button type="button" data-act="replace">Replace</button><button type="button" data-act="replaceall">Replace all</button><span class="onote-dim" data-ref="found"></span></div>
      <div class="onote-box"><b>Sheet</b><div class="onote-row">
        <label>Width <input type="number" data-k="width" min="${N.NOTE_LIMITS.widthMin}" max="${N.NOTE_LIMITS.widthMax}" step="0.5"></label>
        <label>Fit ${sel('', '<option value="grow">Grow with the text</option><option value="fixed">Fixed shape</option>', 'Fit').replace('<select ', '<select data-k="fit" ')}</label>
        <label>Height ÷ width <input type="number" data-k="aspect" min="${N.NOTE_LIMITS.aspectMin}" max="${N.NOTE_LIMITS.aspectMax}" step="0.1"></label>
        <label>Paper <input type="color" data-k="paper"></label><label>Ink <input type="color" data-k="ink"></label></div>
        <div class="onote-row"><label>Font ${sel('', N.FONT_IDS.map(k => `<option value="${k}">${k}</option>`).join(''), 'Base font').replace('<select ', '<select data-k="font" ')}</label>
        <label>Size <input type="number" data-k="size" min="${N.NOTE_LIMITS.sizeMin}" max="${N.NOTE_LIMITS.sizeMax}"></label><label>Margin <input type="number" data-k="margin" min="0" max="${N.NOTE_LIMITS.marginMax}"></label>
        <label>Line <input type="number" data-k="lineHeight" min="1" max="3" step="0.05"></label>
        <label>Sharpness ${sel('', N.RES_STEPS.map(v => `<option value="${v}">${v}</option>`).join(''), 'Resolution').replace('<select ', '<select data-k="res" ')}</label>
        <label>Sides ${sel('', '<option value="double">Both</option><option value="front">Front only</option>', 'Sides').replace('<select ', '<select data-k="sides" ')}</label>
        <label><input type="checkbox" data-k="frame"> Frame</label></div></div>
      <div class="onote-msg" data-ref="msg" role="status" aria-live="polite"></div></div>`
  }

  // ── which note ──
  _q (ref) { return this.host.querySelector(`[data-ref="${ref}"]`) }
  _fillList () {
    const l = this._q('list'); if (!l) return
    const ids = this.svc?.listNoteNodes?.() ?? []
    l.innerHTML = ids.length ? ids.map(id => `<option value="${esc(id)}"${id === this.nodeId ? ' selected' : ''}>${esc(this.svc.getNodeData(id)?.label ?? id)}</option>`).join('') : '<option value="">(no notes yet)</option>'
  }
  setNode (id) {
    this._flushTyping(); this.nodeId = id && this.svc?.isNoteNode?.(id) ? id : null
    this._fillList(); const l = this._q('list'); if (l && this.nodeId) l.value = this.nodeId
    this._load(true); this._status()
  }
  _load (replaceText = true) {
    const n = this.nodeId ? this.svc?.getNote(this.nodeId) : null
    const page = this.page; if (!page) return
    page.contentEditable = n ? 'true' : 'false'
    if (n) {
      if (replaceText && n.html !== this._lastHtml) { page.innerHTML = n.html; this._lastHtml = n.html }
      page.style.background = n.paper; page.style.color = n.ink
      this._q('title').value = n.title
      for (const el of this.host.querySelectorAll('[data-k]')) { const k = el.dataset.k; if (el.type === 'checkbox') el.checked = !!n[k]; else if (document.activeElement !== el) el.value = String(n[k]) }
    } else { page.innerHTML = '<p>Create a note to start writing.</p>'; this._lastHtml = null }
    for (const b of this.host.querySelectorAll('[data-cmd],[data-act],[data-tbl]')) if (b.dataset.act !== 'new') b.disabled = !n
  }
  _status () {
    const n = this.nodeId ? this.svc?.getNote(this.nodeId) : null
    const c = this._q('count'); if (c) c.textContent = n ? `${N.wordCount(n.html)} words · ${N.plainText(n.html).length} characters` : ''
    const u = this.host.querySelector('[data-act="undo"]'), r = this.host.querySelector('[data-act="redo"]')
    if (u) u.disabled = !n || !this.svc?.canUndo?.(this.nodeId); if (r) r.disabled = !n || !this.svc?.canRedo?.(this.nodeId)
  }

  // ── typing ──
  _typed () { clearTimeout(this._typeT); this._typeT = setTimeout(() => this._flushTyping(), TYPE_MS) }
  _flushTyping () {
    clearTimeout(this._typeT); this._typeT = null
    if (!this.nodeId || !this.page) return
    const html = this.page.innerHTML; if (html === this._lastHtml) return
    const r = this.svc?.setHtml(this.nodeId, html, 'type'); this._lastHtml = html
    if (r?.ok === false) this.say(r.error, true); this._status()
  }
  _saveRange () { const s = window.getSelection?.(); if (s && s.rangeCount) { const r = s.getRangeAt(0); if (this.page?.contains(r.commonAncestorContainer)) this._range = r.cloneRange() } }
  _restoreRange () { const s = window.getSelection?.(); if (!s || !this._range) return; try { s.removeAllRanges(); s.addRange(this._range) } catch (_) {} }
  focusText () { this.page?.focus?.(); this._restoreRange() }

  // ── commands ──
  /** run a browser editing command on the current selection. Returns true when it ran. */
  exec (cmd, val = null) {
    if (!this.nodeId) return false
    this.focusText()
    if (typeof document.execCommand !== 'function') { this.say('This browser cannot run that editing command.', true); return false }
    let ok = false; try { document.execCommand('styleWithCSS', false, true); ok = document.execCommand(cmd, false, val) } catch (_) { ok = false }
    this._typed(); return ok
  }
  /** a size in px on the selection: the browser applies size 7 as a <font>, then it is turned into a pixel size */
  setSizePx (px) {
    const n = Number(px); if (!Number.isFinite(n)) return false
    if (!this.exec('fontSize', '7')) return false
    for (const f of this.page.querySelectorAll('font[size="7"],span[style*="xxx-large"]')) { const sp = document.createElement('span'); sp.style.fontSize = Math.round(Math.max(8, Math.min(96, n))) + 'px'; while (f.firstChild) sp.appendChild(f.firstChild); f.replaceWith(sp) }
    this._typed(); return true
  }
  /** line spacing on the block(s) of the selection */
  setLineSpacing (v) {
    const n = Number(v); if (!(n >= 1 && n <= 3) || !this.nodeId) return false
    this.focusText()
    const blocks = new Set(); const s = window.getSelection?.(); const r = s?.rangeCount ? s.getRangeAt(0) : this._range
    const blockOf = (node) => { let el = node?.nodeType === 1 ? node : node?.parentElement; while (el && el !== this.page) { if (/^(P|H[1-6]|LI|BLOCKQUOTE|PRE|TD|TH|DIV)$/.test(el.tagName)) return el; el = el.parentElement } return null }
    if (r) { const walker = document.createTreeWalker(r.commonAncestorContainer.nodeType === 1 ? r.commonAncestorContainer : r.commonAncestorContainer.parentElement, NodeFilter.SHOW_ELEMENT); let el = walker.currentNode; const hit = (x) => { try { return r.intersectsNode(x) } catch (_) { return false } }; do { if (/^(P|H[1-6]|LI|BLOCKQUOTE|PRE|TD|TH)$/.test(el.tagName) && hit(el)) blocks.add(el) } while ((el = walker.nextNode())); const b0 = blockOf(r.startContainer); if (b0) blocks.add(b0) }
    if (!blocks.size) for (const b of this.page.children) blocks.add(b)
    for (const b of blocks) b.style.lineHeight = String(n)
    this._typed(); return blocks.size > 0
  }
  insertHtml (html) { return this.exec('insertHTML', N.sanitizeHtml(html)) }
  insertImage (dataUrl) { if (!/^data:image\/(png|jpeg|gif|webp);base64,/.test(String(dataUrl))) { this.say('That picture type is not supported.', true); return false } if (dataUrl.length > N.NOTE_LIMITS.imageBytes * 1.4) { this.say('That picture is too big. Try a smaller one.', true); return false } return this.exec('insertImage', dataUrl) }
  insertLink (url) { const u = String(url ?? '').trim(); if (!/^(https?:\/\/|mailto:)[^\s"'<>]+$/i.test(u)) { this.say('Links must start with https://, http:// or mailto:', true); return false } return this.exec('createLink', u) }
  async pickImage (file) {
    if (!file) return false
    try {
      const url = await fileToDataUrl(file, IMG_MAX_W, N.NOTE_LIMITS.imageBytes)
      return this.insertImage(url)
    } catch (e) { this.say(String(e?.message ?? 'Could not read that picture.'), true); return false }
  }
  insertTable (rows, cols) {
    const r = Math.max(1, Math.min(N.NOTE_LIMITS.tableRows, Math.round(Number(rows) || 3))), c = Math.max(1, Math.min(N.NOTE_LIMITS.tableCols, Math.round(Number(cols) || 3)))
    let h = '<table><tbody>'; for (let i = 0; i < r; i++) { h += '<tr>'; for (let j = 0; j < c; j++) h += i === 0 ? '<th><br></th>' : '<td><br></td>'; h += '</tr>' } h += '</tbody></table><p><br></p>'
    return this.insertHtml(h) || this._appendHtml(h)
  }
  _appendHtml (h) { if (!this.page) return false; this.page.insertAdjacentHTML('beforeend', N.sanitizeHtml(h)); this._typed(); return true }
  _cell () { const s = window.getSelection?.(); const node = (s?.rangeCount ? s.getRangeAt(0).startContainer : this._range?.startContainer); let el = node?.nodeType === 1 ? node : node?.parentElement; while (el && el !== this.page) { if (el.tagName === 'TD' || el.tagName === 'TH') return el; el = el.parentElement } return null }
  tableOp (op) {
    const cell = this.opts.cell ?? this._cell(); if (!cell) { this.say('Put the cursor inside a table first.', true); return false }
    const row = cell.parentElement, table = row?.closest?.('table'); if (!row || !table || !cell.isConnected) { this.say('Put the cursor inside a table first.', true); return false }
    const idx = [...row.children].indexOf(cell)
    const mk = (tag) => { const e = document.createElement(tag); e.innerHTML = '<br>'; return e }
    const rows = [...table.rows]
    if (op === 'row+') { if (rows.length >= N.NOTE_LIMITS.tableRows) return false; const nr = document.createElement('tr'); for (let i = 0; i < row.children.length; i++) nr.appendChild(mk('td')); row.after(nr) }
    else if (op === 'row-') { if (rows.length <= 1) { table.remove() } else row.remove() }
    else if (op === 'col+') { if (row.children.length >= N.NOTE_LIMITS.tableCols) return false; for (const r of rows) { const c = mk(r.children[0]?.tagName === 'TH' ? 'th' : 'td'); (r.children[idx] ?? r.lastElementChild)?.after(c) } }
    else if (op === 'col-') { if (row.children.length <= 1) table.remove(); else for (const r of rows) r.children[idx]?.remove() }
    else if (op === 'del') table.remove()
    else return false
    this._typed(); return true
  }

  // ── find / replace ──
  _textNodes () { const out = []; const w = document.createTreeWalker(this.page, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) out.push(n); return out }
  /** every match of `text` in the page, as { node, start, end } */
  findAll (text, matchCase = false) {
    const t = String(text ?? ''); if (!t) return []
    const hits = []; const needle = matchCase ? t : t.toLowerCase()
    for (const node of this._textNodes()) { const hay = matchCase ? node.nodeValue : node.nodeValue.toLowerCase(); let i = 0; while ((i = hay.indexOf(needle, i)) >= 0) { hits.push({ node, start: i, end: i + t.length }); i += Math.max(1, t.length) } }
    return hits
  }
  findNext (text, matchCase = false) {
    const hits = this.findAll(text, matchCase); this._hits = hits
    const f = this._q('found'); if (f) f.textContent = hits.length ? `${hits.length} found` : 'none found'
    if (!hits.length) { this._hitIdx = -1; return null }
    this._hitIdx = (this._hitIdx + 1) % hits.length; const h = hits[this._hitIdx]
    try { const r = document.createRange(); r.setStart(h.node, h.start); r.setEnd(h.node, h.end); const s = window.getSelection(); s.removeAllRanges(); s.addRange(r); this._range = r.cloneRange(); h.node.parentElement?.scrollIntoView?.({ block: 'nearest' }) } catch (_) {}
    return h
  }
  replaceOne (text, repl, matchCase = false) {
    const s = window.getSelection?.(); const cur = s && s.rangeCount ? s.toString() : ''
    const same = matchCase ? cur === text : cur.toLowerCase() === String(text).toLowerCase()
    if (!same) { return this.findNext(text, matchCase) ? 0 : 0 }
    const h = this._hits[this._hitIdx]
    if (h && h.node.isConnected) { h.node.nodeValue = h.node.nodeValue.slice(0, h.start) + String(repl) + h.node.nodeValue.slice(h.end); this._typed(); this._hitIdx = -1; this.findNext(text, matchCase); return 1 }
    return 0
  }
  replaceAll (text, repl, matchCase = false) {
    const t = String(text ?? ''); if (!t) return 0
    const hits = this.findAll(t, matchCase); if (!hits.length) { this.say('Nothing to replace.', true); return 0 }
    const byNode = new Map(); for (const h of hits) { const a = byNode.get(h.node) ?? []; a.push(h); byNode.set(h.node, a) }
    for (const [node, list] of byNode) { let v = node.nodeValue; for (const h of list.sort((a, b) => b.start - a.start)) v = v.slice(0, h.start) + String(repl) + v.slice(h.end); node.nodeValue = v }
    this._typed(); this.say(`Replaced ${hits.length}.`); return hits.length
  }

  // ── events ──
  _click (e) {
    const b = e.target.closest?.('button'); if (!b) return
    if (b.dataset.cmd) { this.exec(b.dataset.cmd); this._toggleState(); return }
    if (b.dataset.tbl) { this.tableOp(b.dataset.tbl); return }
    const svc = this.svc
    switch (b.dataset.act) {
      case 'new': { const r = svc?.createNoteNode({ select: true }); if (r?.ok) { this.setNode(r.nodeId); this.say('New note.') } else this.say(r?.error || 'Could not create a note.', true); break }
      case 'undo': this._flushTyping(); this._do(svc?.undo(this.nodeId)); break
      case 'redo': this._flushTyping(); this._do(svc?.redo(this.nodeId)); break
      case 'link': { const u = this.opts.askUrl ? this.opts.askUrl() : (typeof prompt === 'function' ? prompt('Link address (https://…)', 'https://') : null); if (u) this.insertLink(u); break }
      case 'image': this._q('file')?.click(); break
      case 'table': this.insertTable(this._q('rows').value, this._q('cols').value); break
      case 'findnext': this.findNext(this._q('find').value, this._q('case').checked); break
      case 'replace': this.replaceOne(this._q('find').value, this._q('repl').value, this._q('case').checked); break
      case 'replaceall': this.replaceAll(this._q('find').value, this._q('repl').value, this._q('case').checked); break
    }
  }
  _do (r) { if (r && r.ok === false) this.say(r.error, true); this._status() }
  _toggleState () { for (const b of this.host.querySelectorAll('[data-cmd]')) { let on = false; try { on = typeof document.queryCommandState === 'function' && document.queryCommandState(b.dataset.cmd) } catch (_) {} b.classList.toggle('is-on', !!on) } }
  _change (e) {
    const t = e.target; const svc = this.svc
    if (t.dataset.ref === 'list') { this.setNode(t.value || null); return }
    if (t.dataset.ref === 'title') { if (this.nodeId) this._do(svc?.setNote(this.nodeId, { title: t.value }, 'page')); return }
    if (t.dataset.ref === 'block') { this.exec('formatBlock', '<' + t.value + '>'); return }
    if (t.dataset.ref === 'font') { if (t.value) this.exec('fontName', N.FONTS[t.value]); return }
    if (t.dataset.ref === 'size') { if (t.value) this.setSizePx(t.value); return }
    if (t.dataset.ref === 'lh') { if (t.value) this.setLineSpacing(t.value); return }
    if (t.dataset.ref === 'color') { this.exec('foreColor', t.value); return }
    if (t.dataset.ref === 'hilite') { this.exec('hiliteColor', t.value); return }
    if (t.dataset.ref === 'file') { const f = t.files?.[0]; t.value = ''; this.pickImage(f); return }
    if (t.dataset.k && this.nodeId) { const k = t.dataset.k; const v = t.type === 'checkbox' ? t.checked : t.value; this._flushTyping(); this._do(svc?.setNote(this.nodeId, { [k]: v }, 'page')) }
  }
}

/** Read an image file, shrink it to maxW wide and under maxBytes, and give back a data: URL. */
export async function fileToDataUrl (file, maxW = IMG_MAX_W, maxBytes = N.NOTE_LIMITS.imageBytes) {
  if (!file || !/^image\/(png|jpeg|gif|webp)$/.test(file.type)) throw new Error('Choose a PNG, JPEG, GIF or WebP picture.')
  const raw = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.onerror = () => rej(new Error('Could not read that picture.')); fr.readAsDataURL(file) })
  if (raw.length <= maxBytes * 1.3 && file.type === 'image/gif') return raw
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('That picture could not be opened.')); i.src = raw })
  let w = Math.min(maxW, img.naturalWidth || maxW); const h0 = img.naturalHeight || w
  for (let q = 0.85; q >= 0.3; q -= 0.15) {
    const c = document.createElement('canvas'); c.width = w; c.height = Math.max(1, Math.round(w * h0 / (img.naturalWidth || w)))
    const g = c.getContext('2d'); g.drawImage(img, 0, 0, c.width, c.height)
    const out = c.toDataURL(file.type === 'image/png' && q > 0.8 ? 'image/png' : 'image/jpeg', q)
    if (out.length <= maxBytes * 1.3) return out
    w = Math.round(w * 0.8)
  }
  throw new Error('That picture is too big. Try a smaller one.')
}
