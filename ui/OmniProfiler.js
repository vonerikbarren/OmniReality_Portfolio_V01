/**
 * ui/OmniProfiler.js (V278) — the Profiler: a notebook of the people and things you meet or interact with, kept up to date by what happens.
 * Model: utils/OmniProfilerModel.js. Saved in this browser only ('omni:profiler:v1'). SERVICES.profiler: add(opts) log(id, what) trackNode(nodeId) get(id) list(q) remove(id) open() close() toggle()
 * Logs by itself (no private claim is read: a locked claim gives nothing):
 *   - a tracked node is selected               -> "Visited" on its entry
 *   - a testimony is added to a claim           -> the speaker gets a person entry and "Testified on <claim>: <verdict>"
 *   - any node is made                          -> a line in the Journal entry ("Made <name>")
 * Opens from the OmniStar tab (omni:profiler-toggle) or omni:nav-select item "Profiler".
 */
import * as P from '../utils/OmniProfilerModel.js'
import { SERVICES } from '../utils/OmniExtraKinds.js'

export const STORE_KEY = 'omni:profiler:v1'
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const GLYPH = { person: '☺', thing: '◆', place: '⌂', event: '✦' }
const STYLES = `
.opf { position: fixed; top: 80px; right: 24px; width: 520px; height: 440px; display: none; flex-direction: column; z-index: 60; font: 11px 'Courier New', monospace; color: var(--omni-theme-text, rgba(255,255,255,.94)); background: var(--omni-theme-bg, rgba(6,8,14,.94)); border: 1px solid var(--omni-theme-border, rgba(120,170,255,.2)); border-radius: 12px; box-shadow: 0 18px 46px rgba(0,0,0,.5); overflow: hidden; resize: both; min-width: 360px; min-height: 280px; }
.opf.is-open { display: flex; }
.opf-head { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-bottom: 1px solid rgba(255,255,255,.1); }
.opf-head b { letter-spacing: .1em; text-transform: uppercase; font-size: 11px; flex: 1; }
.opf-body { flex: 1; display: flex; min-height: 0; }
.opf-list { width: 190px; border-right: 1px solid rgba(255,255,255,.1); overflow: auto; display: flex; flex-direction: column; }
.opf-list input { margin: 6px; padding: 4px 6px; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.14); border-radius: 5px; color: inherit; font: inherit; }
.opf-item { padding: 6px 10px; cursor: pointer; border-left: 3px solid transparent; }
.opf-item:hover { background: rgba(255,255,255,.06); }
.opf-item.is-on { border-left-color: #7fd8ff; background: rgba(127,216,255,.1); }
.opf-item small { display: block; opacity: .6; font-size: 9px; }
.opf-main { flex: 1; overflow: auto; padding: 10px 12px; }
.opf-main textarea, .opf-main input[type=text], .opf-main select { width: 100%; box-sizing: border-box; margin: 3px 0; padding: 4px 6px; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.14); border-radius: 5px; color: inherit; font: inherit; }
.opf button { background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.16); color: inherit; border-radius: 6px; padding: 3px 8px; font: inherit; cursor: pointer; }
.opf button:hover { background: rgba(255,255,255,.16); }
.opf-log { margin: 8px 0; padding: 0; list-style: none; } .opf-log li { padding: 3px 0; border-bottom: 1px dashed rgba(255,255,255,.08); } .opf-log time { opacity: .55; margin-right: 6px; font-size: 9px; }
.opf-empty { opacity: .65; line-height: 1.6; padding: 14px; }
`
const when = (t) => { try { return new Date(t).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) } catch (_) { return '' } }

export default class OmniProfiler {
  constructor (context, omniNode = null) { this.ctx = context; this.omniNode = omniNode ?? context?.omniNode ?? null; this._book = { entries: [] }; this._el = null; this._open = false; this._sel = null; this._q = ''; this._bound = []; this._seen = new Map(); this._inited = false; this._saveT = null }
  init () {
    if (this._inited) return; this._inited = true
    try { this._book = P.sanitizeBook(JSON.parse(localStorage.getItem(STORE_KEY))) } catch (_) { this._book = { entries: [] } }
    const on = (t, n, f) => { t.addEventListener(n, f); this._bound.push([t, n, f]) }
    on(window, 'omni:profiler-toggle', () => this.toggle())
    on(window, 'omni:nav-select', (e) => { if (e.detail?.item === 'Profiler') this.open() })
    on(window, 'omni:node-selected', (e) => { const n = e.detail?.node; const en = n ? P.entryOfNode(this._book, n.id) : null; if (en) this.log(en.id, 'Visited ' + (n.label || n.id), { ref: n.id }) })
    on(window, 'omni:node-created', (e) => { const n = e.detail?.node; if (n && n.id) this._journal('Made ' + (n.label || n.id), n.id) })
    on(window, 'omni:claim-changed', (e) => this._claim(e.detail?.nodeId))
    on(window, 'omni:node-deleted', (e) => { const en = P.entryOfNode(this._book, e.detail?.id); if (en) this.log(en.id, 'Its node was deleted', { meet: false }) })
    SERVICES.profiler = this
  }
  update () {} onResize () {}
  destroy () { for (const [t, n, f] of this._bound) t.removeEventListener(n, f); this._bound = []; clearTimeout(this._saveT); this._flush(); this._el?.remove(); this._el = null; if (SERVICES.profiler === this) SERVICES.profiler = null; this._inited = false }

  _flush () { try { localStorage.setItem(STORE_KEY, JSON.stringify(this._book)) } catch (_) { /* full / private */ } }
  _changed () { clearTimeout(this._saveT); this._saveT = setTimeout(() => this._flush(), 400); if (this._open) this._render(); window.dispatchEvent(new CustomEvent('omni:profiler-changed', { detail: { count: this._book.entries.length } })) }
  _journal (what, ref) { if (!this._book.entries.some(e => e.id === 'journal')) this._book = P.addEntry(this._book, { id: 'journal', name: 'Journal', kind: 'event', note: 'Everything you make, in order.' }, Date.now()).book; this._book = P.addLog(this._book, 'journal', what, Date.now(), { ref, meet: false }); this._changed() }
  _claim (nodeId) {
    try {
      if (!nodeId) return; const c = SERVICES.claims?.get?.(nodeId); if (!c) return                         // locked / private: nothing is read
      const list = Array.isArray(c.testimonies) ? c.testimonies : []; const last = this._seen.get(nodeId)
      this._seen.set(nodeId, list.length); if (last === undefined || list.length <= last) return           // the first sight only counts
      for (const t of list.slice(last)) {
        const nm = String(t?.entity?.id || t?.entity?.kind || 'unknown'); const r = P.addEntry(this._book, { name: nm, kind: 'person', tags: [t?.entity?.kind || 'unknown'] }, Date.now()); this._book = r.book
        if (r.id) this._book = P.addLog(this._book, r.id, `Testified on "${String(c.claim || nodeId).slice(0, 50)}": ${t?.verdict || 'undefined'}`, Date.now(), { ref: nodeId })
      }
      this._changed()
    } catch (_) { /* a bad claim is not the Profiler's problem */ }
  }

  // ── service ──
  list (q = '') { return P.search(this._book, q) }
  get (id) { return this._book.entries.find(e => e.id === id) ?? null }
  add (opts = {}) { const r = P.addEntry(this._book, opts, Date.now()); this._book = r.book; if (r.id) { this._sel = r.id; this._changed() } return r.id ? { ok: true, id: r.id, added: r.added } : { ok: false, error: 'Give it a name (the notebook holds up to ' + P.LIMITS.entries + ').' } }
  log (id, what, o = {}) { if (!this.get(id)) return { ok: false, error: 'no such entry' }; this._book = P.addLog(this._book, id, what, Date.now(), o); this._changed(); return { ok: true } }
  edit (id, patch) { this._book = P.editEntry(this._book, id, patch, Date.now()); this._changed(); return { ok: !!this.get(id) } }
  remove (id) { this._book = P.removeEntry(this._book, id); if (this._sel === id) this._sel = null; this._changed(); return { ok: true } }
  trackNode (nodeId) {
    const d = this.omniNode?.getNodeData?.(nodeId); if (!d) return { ok: false, error: 'Select a node first.' }
    const kind = /claim|epistem|note|doc|flash/.test(String(d.nodeKind)) ? 'thing' : 'thing'
    return this.add({ name: d.label || nodeId, kind, nodeId })
  }

  // ── panel ──
  open () { this._build(); this._open = true; this._el.classList.add('is-open'); this._render() }
  close () { this._open = false; this._el?.classList.remove('is-open') }
  toggle () { this._open ? this.close() : this.open() }
  _build () {
    if (this._el) return
    if (!document.getElementById('opf-styles')) { const s = document.createElement('style'); s.id = 'opf-styles'; s.textContent = STYLES; document.head.appendChild(s) }
    const el = document.createElement('div'); el.className = 'opf'; el.dataset.testid = 'profiler'
    el.innerHTML = `<div class="opf-head"><b>☺ Profiler</b><button data-a="track" title="Add the selected node to the notebook; selecting it again will be logged">Track selected</button><button data-a="new">New</button><button data-a="close" aria-label="Close">×</button></div>
      <div class="opf-body"><div class="opf-list"><input type="text" data-q placeholder="Search" aria-label="Search the notebook"><div data-items></div></div><div class="opf-main" data-main></div></div>`
    el.addEventListener('click', (e) => {
      const it = e.target.closest?.('[data-id]'); if (it) { this._sel = it.dataset.id; this._render(); return }
      const a = e.target.closest?.('[data-a]')?.dataset.a; if (!a) return
      if (a === 'close') this.close()
      else if (a === 'new') { const nm = window.prompt?.('Name (a person, thing, place or event)'); if (nm) this.add({ name: nm }) }
      else if (a === 'track') { const r = this.trackNode(this.omniNode?.getSelectedId?.()); if (!r.ok) this._say(r.error) }
      else if (a === 'remove' && this._sel && (typeof window.confirm !== 'function' || window.confirm('Delete this entry and its log?'))) this.remove(this._sel)
      else if (a === 'addlog' && this._sel) { const i = el.querySelector('[data-newlog]'); if (i?.value.trim()) { this.log(this._sel, i.value) } }
    })
    el.addEventListener('input', (e) => { if (e.target.matches('[data-q]')) { this._q = e.target.value; this._renderList() } })
    el.addEventListener('change', (e) => { const f = e.target.dataset?.f; if (f && this._sel) this.edit(this._sel, { [f]: f === 'tags' ? e.target.value.split(',') : e.target.value }) })
    ;(document.getElementById('omni-ui') ?? document.body).appendChild(el); this._el = el
  }
  _say (t) { const m = this._el?.querySelector('[data-main]'); if (m) m.insertAdjacentHTML('afterbegin', `<div class="opf-empty" role="status">${esc(t)}</div>`) }
  _render () { if (!this._el) return; this._renderList(); this._renderMain() }
  _renderList () {
    const items = this._el.querySelector('[data-items]'); const l = this.list(this._q)
    items.innerHTML = l.length ? l.map(e => `<div class="opf-item${e.id === this._sel ? ' is-on' : ''}" data-id="${esc(e.id)}">${GLYPH[e.kind] || '•'} ${esc(e.name)}<small>${esc(e.kind)} · met ${e.met}</small></div>`).join('') : '<div class="opf-empty">Nothing here yet.</div>'
  }
  _renderMain () {
    const m = this._el.querySelector('[data-main]'); const e = this.get(this._sel)
    if (!e) { m.innerHTML = '<div class="opf-empty">The Profiler remembers the people and things you meet.<br>Select a node and press <b>Track selected</b>, or press <b>New</b>. When a claim gets a testimony, the speaker is added for you. Everything stays in this browser.</div>'; return }
    m.innerHTML = `<input type="text" data-f="name" value="${esc(e.name)}" maxlength="60" aria-label="Name">
      <select data-f="kind" aria-label="Kind">${P.KINDS.map(k => `<option value="${k}"${k === e.kind ? ' selected' : ''}>${k}</option>`).join('')}</select>
      <input type="text" data-f="tags" value="${esc(e.tags.join(', '))}" placeholder="tags, comma separated" aria-label="Tags">
      <textarea data-f="note" rows="3" maxlength="600" placeholder="What do you know about it?">${esc(e.note)}</textarea>
      <div>Met ${e.met} time${e.met === 1 ? '' : 's'}${e.nodeId ? ' · linked to a node' : ''} <button data-a="remove" style="float:right">Delete</button></div>
      <div style="display:flex;gap:4px;margin-top:6px"><input type="text" data-newlog placeholder="Add a line to the log" maxlength="160" style="flex:1"><button data-a="addlog">Add</button></div>
      <ul class="opf-log">${e.log.slice().reverse().map(l => `<li><time>${esc(when(l.at))}</time>${esc(l.what)}</li>`).join('') || '<li class="opf-empty">No log yet.</li>'}</ul>`
  }
}
