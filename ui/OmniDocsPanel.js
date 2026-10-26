/**
 * ui/OmniDocsPanel.js — ⟐Docs: the user guide inside the app (V190)
 *
 * A DOM window panel (window-chrome class A: resize + maximize come from ui/WindowManager.js register() -> utils/OmniWindowChrome.js).
 * Left: the table of contents (one entry per guide page). Right: the page text. Top bar: previous / next page, a search field that
 * FILTERS the table of contents to the pages holding every word (with hit counts) and HIGHLIGHTS the hits in the open page
 * (Enter / Shift+Enter or the arrows jump between hits). PageDown / PageUp scroll the open page by a screenful and turn to the
 * next / previous page at the end / start while the panel has focus.
 *
 * Data: data/OmniDocsData.js (generated from docs/user-guide/*.md by tools/build-docs-data.mjs), bundled: no server, no fetch.
 * Markdown is read by utils/OmniDocsMarkdown.js into a plain block tree and turned into DOM with createElement / textContent ONLY
 * (never innerHTML with page text), so nothing in a page can run. Links are shown as text; a link to another guide page becomes a
 * "go to page" button; every other link stays plain text (nothing is ever navigated or fetched).
 *
 * Opened by:  omni:nav-select '⟐OmniDocs' (ribbon OmniStar tab > Docs, OmniStarLight)  |  omni:docs-open { page?, heading?, query? }
 * WindowManager id 'omnidocs'. Last page remembered in localStorage 'omni:docs-v1'. Module contract: constructor / init / update / destroy / onResize.
 *
 * FUTURE (not built, V190): the owner wants a "docs open in GUI / scene / both" setting plus an in-scene HelpNode. The hook is
 * openDocs() below: it is the single place that decides WHERE a docs request is shown. A setting would be read there, and for
 * 'scene' / 'both' it would dispatch an event (e.g. omni:helpnode-show { page, heading }) in addition to / instead of calling _show().
 */

import gsap from 'gsap'
import * as WindowManager from './WindowManager.js'
import { DOCS } from '../data/OmniDocsData.js'
import { parseMarkdown, pageIdForHref, splitTerms, findMatches, pageMatchCount, foldText } from '../utils/OmniDocsMarkdown.js'
import { getTopOffset } from '../utils/OmniLayout.js'

export const PANEL_ID = 'omnidocs'
export const NAV_ITEM = '⟐OmniDocs'
export const OPEN_EVENT = 'omni:docs-open'
export const STORAGE_KEY = 'omni:docs-v1'
const PHONE_MAX = 700

const STYLES = /* css */`
.omni-docs-panel { pointer-events: auto; position: fixed; z-index: 60; width: min(780px, calc(100vw - 16px)); height: min(540px, calc(100vh - var(--omni-top-offset, 48px) - 76px)); min-width: 280px; min-height: 200px;
  display: flex; flex-direction: column; overflow: hidden; opacity: 0; visibility: hidden; outline: none;
  background: var(--omni-theme-bg, rgba(8,8,12,.95)); border: 1px solid var(--omni-theme-border, rgba(255,255,255,.14)); border-radius: 12px; color: var(--omni-theme-text, rgba(255,255,255,.93));
  font-family: 'Courier New', Courier, monospace; font-size: 12px; backdrop-filter: blur(20px) saturate(1.5); -webkit-backdrop-filter: blur(20px) saturate(1.5); box-shadow: 0 0 20px rgba(0,0,0,.4), 0 10px 30px rgba(0,0,0,.5); }
.odc-header { height: 36px; flex: 0 0 auto; display: flex; align-items: center; gap: 8px; padding: 0 8px 0 12px; background: var(--omni-theme-header-bg, rgba(255,255,255,.05)); border-bottom: 1px solid var(--omni-theme-border, rgba(255,255,255,.14)); cursor: grab; user-select: none; -webkit-user-select: none; touch-action: none; }
.odc-title { font-size: 12px; letter-spacing: .04em; }
.odc-spacer { flex: 1; }
.odc-ctrl { width: 24px; height: 24px; padding: 0; border-radius: 5px; border: 1px solid var(--omni-theme-border, rgba(255,255,255,.14)); background: rgba(255,255,255,.05); color: inherit; cursor: pointer; font: inherit; }
.odc-ctrl:hover { background: rgba(255,255,255,.14); }
.odc-bar { flex: 0 0 auto; display: flex; align-items: center; gap: 6px; padding: 6px 8px; border-bottom: 1px solid var(--omni-theme-border, rgba(255,255,255,.1)); flex-wrap: wrap; }
.odc-btn, .odc-input { min-height: 28px; box-sizing: border-box; font: inherit; color: inherit; border-radius: 6px; background: rgba(255,255,255,.07); border: 1px solid var(--omni-theme-border, rgba(255,255,255,.18)); }
.odc-btn { padding: 2px 9px; cursor: pointer; white-space: nowrap; }
.odc-btn:hover:not(:disabled) { background: rgba(255,255,255,.17); }
.odc-btn:disabled { opacity: .4; cursor: default; }
.odc-input { flex: 1 1 140px; min-width: 100px; padding: 2px 8px; }
.odc-input::placeholder { color: var(--omni-theme-text-dim, rgba(255,255,255,.5)); }
.odc-count, .odc-pos { color: var(--omni-theme-text-dim, rgba(255,255,255,.62)); font-size: 10.5px; white-space: nowrap; }
.odc-main { flex: 1 1 auto; min-height: 0; display: flex; }
.odc-toc { flex: 0 0 210px; overflow-y: auto; padding: 6px; border-right: 1px solid var(--omni-theme-border, rgba(255,255,255,.1)); display: flex; flex-direction: column; gap: 2px; scrollbar-width: thin; }
.odc-toc-item { display: flex; align-items: baseline; justify-content: space-between; gap: 6px; text-align: left; padding: 5px 8px; font: inherit; font-size: 11.5px; color: var(--omni-theme-text-dim, rgba(255,255,255,.72)); background: none; border: 1px solid transparent; border-radius: 6px; cursor: pointer; }
.odc-toc-item:hover { background: rgba(255,255,255,.08); color: var(--omni-theme-text, #fff); }
.odc-toc-item.is-current { background: rgba(255,255,255,.14); border-color: var(--omni-theme-accent, rgba(255,255,255,.5)); color: var(--omni-theme-text, #fff); }
.odc-toc-n { flex: 0 0 auto; font-size: 10px; padding: 0 5px; border-radius: 9px; background: rgba(255,200,80,.25); color: var(--omni-theme-text, #fff); }
.odc-toc-empty { padding: 8px; color: var(--omni-theme-text-dim, rgba(255,255,255,.6)); font-size: 11px; }
.odc-page { flex: 1 1 auto; min-width: 0; overflow-y: auto; padding: 10px 16px 24px; line-height: 1.55; scrollbar-width: thin; user-select: text; -webkit-user-select: text; }
.odc-page h1, .odc-page h2, .odc-page h3, .odc-page h4 { margin: 1.1em 0 .4em; line-height: 1.25; letter-spacing: .02em; }
.odc-page h1 { font-size: 18px; margin-top: .2em; } .odc-page h2 { font-size: 15px; border-bottom: 1px solid var(--omni-theme-border, rgba(255,255,255,.12)); padding-bottom: 3px; } .odc-page h3 { font-size: 13px; } .odc-page h4 { font-size: 12px; }
.odc-page p, .odc-page ul, .odc-page ol, .odc-page blockquote, .odc-page table, .odc-page pre { margin: .5em 0; }
.odc-page ul, .odc-page ol { padding-left: 22px; }
.odc-page code { padding: 0 4px; border-radius: 4px; background: rgba(255,255,255,.1); font-size: 11px; }
.odc-page pre { padding: 8px 10px; border-radius: 6px; background: rgba(255,255,255,.07); overflow-x: auto; }
.odc-page pre code { padding: 0; background: none; }
.odc-page blockquote { padding: 2px 10px; border-left: 3px solid var(--omni-theme-accent, rgba(255,255,255,.4)); color: var(--omni-theme-text-dim, rgba(255,255,255,.75)); }
.odc-page hr { border: none; border-top: 1px solid var(--omni-theme-border, rgba(255,255,255,.14)); margin: 12px 0; }
.odc-tablewrap { overflow-x: auto; margin: .5em 0; }
.odc-page table { border-collapse: collapse; min-width: 60%; }
.odc-page th, .odc-page td { padding: 4px 8px; text-align: left; vertical-align: top; border: 1px solid rgba(255,255,255,.12); font-weight: normal; }
.odc-page th { background: rgba(255,255,255,.07); font-weight: bold; }
.odc-link { color: var(--omni-theme-accent, #9cf); text-decoration: underline dotted; }
.odc-gopage { font: inherit; padding: 0; background: none; border: none; color: var(--omni-theme-accent, #9cf); text-decoration: underline; cursor: pointer; }
mark.odc-hit { background: rgba(255,210,70,.45); color: inherit; border-radius: 2px; }
mark.odc-hit.is-current { background: rgba(255,150,40,.85); outline: 1px solid rgba(255,255,255,.7); }
@media (max-width: ${PHONE_MAX}px) {
  .omni-docs-panel { left: 0 !important; right: 0 !important; top: auto !important; bottom: var(--omni-dock-h, 52px); width: 100%; max-width: 100vw; height: 68vh; border-radius: 14px 14px 0 0; }
  .odc-main { flex-direction: column; }
  .odc-toc { flex: 0 0 auto; flex-direction: row; overflow-x: auto; overflow-y: hidden; border-right: none; border-bottom: 1px solid var(--omni-theme-border, rgba(255,255,255,.1)); gap: 4px; }
  .odc-toc-item { flex: 0 0 auto; white-space: nowrap; min-height: 36px; align-items: center; }
  .odc-btn, .odc-input { min-height: 40px; } .odc-ctrl { width: 36px; height: 36px; } .odc-header { cursor: default; }
  .odc-page { padding: 8px 12px 20px; }
}
`

function injectStyles () {
  if (typeof document === 'undefined' || document.getElementById('omni-docs-styles')) return
  const s = document.createElement('style'); s.id = 'omni-docs-styles'; s.textContent = STYLES; document.head.appendChild(s)
}

const h = (tag, attrs = {}, ...kids) => {
  const n = document.createElement(tag)
  for (const k of Object.keys(attrs)) { if (k === 'class') n.className = attrs[k]; else if (k === 'text') n.textContent = attrs[k]; else n.setAttribute(k, attrs[k]) }
  for (const c of kids) if (c) n.appendChild(c)
  return n
}
const tip = (name, key, desc) => ({ 'data-omni-tip': name, 'data-omni-tip-key': key, 'data-omni-tip-desc': desc })

export default class OmniDocsPanel {
  /** @param {Array} [docs] the pages (default: the bundled guide); tests pass their own. */
  constructor (docs = DOCS) {
    this.docs = Array.isArray(docs) ? docs : []
    this._el = null; this._isOpen = false; this._inited = 0
    this._pageId = this.docs[0]?.id ?? ''
    this._query = ''; this._terms = []
    this._blocks = new Map()          // page id -> parsed blocks
    this._folded = new Map()          // page id -> folded text (search cache)
    this._hits = []; this._hitIdx = -1
    this._on = null; this._rendered = false
  }

  init () {
    this._inited++
    if (this._inited > 1) return
    injectStyles()
    try { const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null'); if (raw && this._byId(raw.page)) this._pageId = raw.page } catch (_) { /* default page */ }
    this._on = {
      nav: (e) => { if (e.detail?.item === NAV_ITEM) this.openDocs({}) },
      docs: (e) => this.openDocs(e.detail ?? {}),
      restore: (e) => { if (e.detail?.id === PANEL_ID) this.open() },
    }
    window.addEventListener('omni:nav-select', this._on.nav)
    window.addEventListener(OPEN_EVENT, this._on.docs)
    window.addEventListener('omni:panel-restore', this._on.restore)
  }

  update () {}
  onResize () {}

  destroy () {
    if (!this._inited) return
    window.removeEventListener('omni:nav-select', this._on.nav)
    window.removeEventListener(OPEN_EVENT, this._on.docs)
    window.removeEventListener('omni:panel-restore', this._on.restore)
    this._unbind?.()
    this._el?.parentNode?.removeChild(this._el)
    WindowManager.unregister(PANEL_ID)
    document.getElementById('omni-docs-styles')?.remove()
    this._el = null; this._inited = 0; this._rendered = false
  }

  get isOpen () { return this._isOpen }
  getState () { return { page: this._pageId, query: this._query, hits: this._hits.length, hit: this._hitIdx, open: this._isOpen } }

  // ── public ────────────────────────────────────────────────────────────────

  /**
   * THE entry point for "show me the docs" (ribbon, OmniStarLight, omni:docs-open). detail: { page?, heading?, query? }.
   * HOOK for the deferred "docs open in GUI / scene / both" setting (see the file header): decide the destination here.
   */
  openDocs (detail = {}) {
    this._show(detail)
  }

  _show (detail = {}) {
    this.open()
    const page = this._byId(detail.page) ? detail.page : null
    if (typeof detail.query === 'string') this._setQuery(detail.query, { keepPage: !!page })
    if (page) this.goTo(page, { heading: detail.heading })
    else if (this._query) this._renderToc()
  }

  open () {
    if (!this._el) this._el = this._build()
    const shell = document.getElementById('omni-ui') ?? document.body
    if (!this._el.parentNode) shell.appendChild(this._el)
    if (!this._rendered) { this._rendered = true; this._renderToc(); this._renderPage() }   // a re-open keeps the scroll position
    gsap.killTweensOf(this._el)
    this._el.style.visibility = 'visible'
    if (window.innerWidth > PHONE_MAX && this._el.dataset.moved !== '1') {
      const w = this._el.getBoundingClientRect().width || Math.min(780, window.innerWidth - 16)
      this._el.style.left = Math.max(8, Math.round((window.innerWidth - w) / 2)) + 'px'
      this._el.style.top = (getTopOffset() + 12) + 'px'
    }
    gsap.to(this._el, { opacity: WindowManager.getPanelOpacity(), duration: 0.2 })
    this._isOpen = true
    WindowManager.bringToFront(PANEL_ID)
    try { this._el.focus({ preventScroll: true }) } catch (_) { /* focus is a nicety */ }
  }

  close () {
    if (!this._el) return
    gsap.killTweensOf(this._el)
    gsap.to(this._el, { opacity: 0, duration: 0.15, onComplete: () => { if (!this._isOpen) this._el.style.visibility = 'hidden' } })
    this._isOpen = false
  }

  minimize () {
    if (!this._el) return
    const r = this._el.getBoundingClientRect()
    this.close()
    window.dispatchEvent(new CustomEvent('omni:panel-minimized', { detail: { id: PANEL_ID, label: '⟐Docs', iconLabel: '⟐D', fromRect: { x: r.left, y: r.top, w: r.width, h: r.height }, variant: 'app' } }))
  }

  /** Show a page (optionally scrolled to a heading id). */
  goTo (pageId, { heading = '' } = {}) {
    if (!this._byId(pageId)) return false
    this._pageId = pageId
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: 1, page: pageId })) } catch (_) { /* blocked storage */ }
    if (this._el) { this._renderToc(); this._renderPage(heading) }
    return true
  }

  /** Previous (-1) / next (+1) page among the pages the search currently lists. Returns true if it turned. */
  turn (dir) {
    const list = this._visiblePages()
    const i = list.findIndex(p => p.id === this._pageId)
    const j = i + (dir < 0 ? -1 : 1)
    if (j < 0 || j >= list.length) return false
    return this.goTo(list[j].id)
  }

  /** PageDown / PageUp behaviour: scroll the page by ~90% of its height, turning the page at the end / start. */
  pageKey (dir) {
    const sc = this._q?.page
    if (!sc) return false
    const step = Math.max(40, Math.round((sc.clientHeight || 300) * 0.9))
    const atEnd = sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 2
    if (dir > 0) {
      if (atEnd) { if (this.turn(1)) { sc.scrollTop = 0; return true } return false }
      sc.scrollTop = Math.min(sc.scrollHeight, sc.scrollTop + step); return true
    }
    if (sc.scrollTop <= 1) { if (this.turn(-1)) { sc.scrollTop = sc.scrollHeight; return true } return false }
    sc.scrollTop = Math.max(0, sc.scrollTop - step); return true
  }

  /** Set the search text (what the field does on input). */
  search (text) { this._setQuery(text); if (this._q) this._q.input.value = this._query }

  /** Jump to the next (+1) / previous (-1) highlighted hit in the open page. */
  stepHit (dir) {
    if (!this._hits.length) return false
    this._hitIdx = (this._hitIdx + (dir < 0 ? -1 : 1) + this._hits.length) % this._hits.length
    this._markCurrent(true)
    return true
  }

  // ── data ──────────────────────────────────────────────────────────────────

  _byId (id) { return this.docs.find(p => p.id === id) ?? null }
  _foldOf (p) { let f = this._folded.get(p.id); if (f === undefined) { f = foldText(p.text); this._folded.set(p.id, f) } return f }
  _counts () { return this.docs.map(p => ({ p, n: this._terms.length ? pageMatchCount(p.text, this._terms, this._foldOf(p)) : 0 })) }
  /** The pages the table of contents lists: all of them, or only those holding every search word. */
  _visiblePages () { return this._terms.length ? this._counts().filter(c => c.n > 0).map(c => c.p) : this.docs }

  _setQuery (text, { keepPage = false } = {}) {
    this._query = String(text ?? '').slice(0, 200)
    this._terms = splitTerms(this._query)
    const vis = this._visiblePages()
    if (!keepPage && this._terms.length && vis.length && !vis.some(p => p.id === this._pageId)) this._pageId = vis[0].id   // follow the hits
    this._hitIdx = -1
    if (this._el) { this._renderToc(); this._renderPage(); if (this._hits.length) { this._hitIdx = 0; this._markCurrent(true) } }
  }

  // ── DOM ───────────────────────────────────────────────────────────────────

  _build () {
    const q = {}
    const mkCtl = (ctl, label, glyph, t) => h('button', { type: 'button', class: 'odc-ctrl', 'data-ctl': ctl, 'aria-label': label, title: label, ...t }, h('span', { text: glyph }))
    q.header = h('div', { class: 'odc-header' }, h('span', { class: 'odc-title', text: '⟐Docs' }), h('span', { class: 'odc-spacer' }),
      mkCtl('minimize', 'Minimize', '–', tip('Minimize Docs', '—', 'Sends the Docs window to the dock.')), mkCtl('close', 'Close', '×', tip('Close Docs', '—', 'Closes the Docs window.')))
    q.prev = h('button', { type: 'button', class: 'odc-btn', 'data-act': 'prev', 'aria-label': 'Previous page', text: '◀ Prev', ...tip('Previous page', 'PageUp', 'Turns to the previous guide page (PageUp also scrolls up, then turns the page at the top).') })
    q.next = h('button', { type: 'button', class: 'odc-btn', 'data-act': 'next', 'aria-label': 'Next page', text: 'Next ▶', ...tip('Next page', 'PageDown', 'Turns to the next guide page (PageDown also scrolls down, then turns the page at the bottom).') })
    q.pos = h('span', { class: 'odc-pos' })
    q.input = h('input', { type: 'search', class: 'odc-input', 'data-field': 'search', placeholder: 'Search the guide…', 'aria-label': 'Search the guide', autocomplete: 'off', spellcheck: 'false', maxlength: '200', ...tip('Search the guide', 'Enter', 'Lists the pages that contain every word you type and highlights the hits. Enter jumps to the next hit, Shift+Enter to the previous one.') })
    q.hprev = h('button', { type: 'button', class: 'odc-btn', 'data-act': 'hit-prev', 'aria-label': 'Previous hit', text: '↑', ...tip('Previous hit', 'Shift+Enter', 'Jumps to the previous highlighted hit on this page.') })
    q.hnext = h('button', { type: 'button', class: 'odc-btn', 'data-act': 'hit-next', 'aria-label': 'Next hit', text: '↓', ...tip('Next hit', 'Enter', 'Jumps to the next highlighted hit on this page.') })
    q.count = h('span', { class: 'odc-count', role: 'status', 'aria-live': 'polite' })
    q.bar = h('div', { class: 'odc-bar' }, q.prev, q.next, q.pos, q.input, q.hprev, q.hnext, q.count)
    q.toc = h('nav', { class: 'odc-toc', 'aria-label': 'Guide pages' })
    q.page = h('div', { class: 'odc-page', tabindex: '0', 'aria-label': 'Guide page' })
    q.main = h('div', { class: 'odc-main' }, q.toc, q.page)
    const root = h('div', { class: 'omni-docs-panel', id: 'omni-docs-panel', role: 'dialog', 'aria-label': 'Docs', tabindex: '-1' }, q.header, q.bar, q.main)
    root.dataset.winId = PANEL_ID
    this._q = q

    root.querySelector('[data-ctl="minimize"]').addEventListener('click', () => this.minimize())
    root.querySelector('[data-ctl="close"]').addEventListener('click', () => this.close())
    q.prev.addEventListener('click', () => this.turn(-1))
    q.next.addEventListener('click', () => this.turn(1))
    q.hprev.addEventListener('click', () => this.stepHit(-1))
    q.hnext.addEventListener('click', () => this.stepHit(1))
    q.input.addEventListener('input', () => this._setQuery(q.input.value))
    q.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); this.stepHit(e.shiftKey ? -1 : 1) }
      else if (e.key === 'Escape' && q.input.value) { e.preventDefault(); e.stopPropagation(); this.search('') }
    })
    root.addEventListener('keydown', (e) => {
      if ((e.key === 'PageDown' || e.key === 'PageUp') && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); e.stopPropagation(); this.pageKey(e.key === 'PageDown' ? 1 : -1) }
    })
    q.toc.addEventListener('click', (e) => { const b = e.target.closest?.('[data-page]'); if (b) { this.goTo(b.dataset.page); q.page.scrollTop = 0 } })
    q.page.addEventListener('click', (e) => {
      const b = e.target.closest?.('[data-goto]')
      if (!b) return
      this.goTo(b.dataset.goto, { heading: b.dataset.heading || '' })
    })

    // drag by the header (desktop only; the window chrome handles resize + maximize)
    const d = { on: false }
    const down = (e) => { if (window.innerWidth <= PHONE_MAX || e.target.closest('button') || root.classList.contains('omni-win-max')) return; const r = root.getBoundingClientRect(); d.on = true; d.sx = e.clientX; d.sy = e.clientY; d.ox = r.left; d.oy = r.top; try { q.header.setPointerCapture?.(e.pointerId) } catch (_) {} }
    const move = (e) => { if (!d.on) return; root.dataset.moved = '1'; root.style.left = Math.max(0, d.ox + e.clientX - d.sx) + 'px'; root.style.top = Math.max(getTopOffset(), d.oy + e.clientY - d.sy) + 'px' }
    const up = () => { d.on = false }
    q.header.addEventListener('pointerdown', down); window.addEventListener('pointermove', move); window.addEventListener('pointerup', up)
    this._unbind = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }

    WindowManager.register(PANEL_ID, root, 'Docs')
    WindowManager.watchPanelOpacity(root, () => this._isOpen)
    return root
  }

  _renderToc () {
    const q = this._q; if (!q) return
    const counts = this._counts()
    const list = this._terms.length ? counts.filter(c => c.n > 0) : counts
    q.toc.replaceChildren()
    if (!list.length) q.toc.appendChild(h('div', { class: 'odc-toc-empty', text: 'No page has all of those words.' }))
    for (const { p, n } of list) {
      const b = h('button', { type: 'button', class: 'odc-toc-item' + (p.id === this._pageId ? ' is-current' : ''), 'data-page': p.id, ...tip(`Docs · ${p.title}`, '—', `Opens the guide page "${p.title}" (${p.headings.length} sections).`) })
      b.appendChild(h('span', { text: p.title }))
      if (this._terms.length) b.appendChild(h('span', { class: 'odc-toc-n', text: String(n) }))
      if (p.id === this._pageId) b.setAttribute('aria-current', 'page')
      q.toc.appendChild(b)
    }
    const vis = list.map(c => c.p); const i = vis.findIndex(p => p.id === this._pageId)
    q.prev.disabled = i <= 0; q.next.disabled = i < 0 || i >= vis.length - 1
    q.pos.textContent = i >= 0 ? `${i + 1}/${vis.length}` : `–/${vis.length}`
  }

  /** Inline tokens -> DOM nodes appended to `parent`; plain text is split around the search hits into <mark>s. Only createElement / createTextNode. */
  _inline (parent, tokens) {
    for (const t of tokens) {
      if (t.t === 'text') this._text(parent, t.s)
      else if (t.t === 'code') { const c = h('code'); this._text(c, t.s); parent.appendChild(c) }
      else if (t.t === 'b') { const c = h('strong'); this._inline(c, t.c); parent.appendChild(c) }
      else if (t.t === 'i') { const c = h('em'); this._inline(c, t.c); parent.appendChild(c) }
      else if (t.t === 'link') {
        const dest = pageIdForHref(t.href)
        if (dest && this._byId(dest.pageId)) {
          const b = h('button', { type: 'button', class: 'odc-gopage', 'data-goto': dest.pageId, 'data-heading': dest.headingId || '', ...tip(`Go to ${this._byId(dest.pageId).title}`, '—', 'Turns to that guide page.') })
          this._inline(b, t.c); parent.appendChild(b)
        } else { const s = h('span', { class: 'odc-link', title: t.href.slice(0, 200) }); this._inline(s, t.c); parent.appendChild(s) }   // shown as text; never an <a href>
      }
    }
  }

  _text (parent, s) {
    const ranges = this._terms.length ? findMatches(s, this._terms) : []
    if (!ranges.length) { parent.appendChild(document.createTextNode(s)); return }
    let at = 0
    for (const [a, b] of ranges) {
      if (a > at) parent.appendChild(document.createTextNode(s.slice(at, a)))
      parent.appendChild(h('mark', { class: 'odc-hit', text: s.slice(a, b) }))
      at = b
    }
    if (at < s.length) parent.appendChild(document.createTextNode(s.slice(at)))
  }

  _renderPage (heading = '') {
    const q = this._q; if (!q) return
    const page = this._byId(this._pageId)
    q.page.replaceChildren()
    if (!page) { q.page.appendChild(h('p', { text: 'No guide pages are bundled.' })); this._afterRender(); return }
    let blocks = this._blocks.get(page.id)
    if (!blocks) { blocks = parseMarkdown(page.text); this._blocks.set(page.id, blocks) }
    for (const b of blocks) {
      let n
      if (b.t === 'h') { n = h('h' + Math.min(4, b.level), { id: 'odc-' + b.id, 'data-hid': b.id }); this._inline(n, b.c) }
      else if (b.t === 'p') { n = h('p'); this._inline(n, b.c) }
      else if (b.t === 'ul' || b.t === 'ol') { n = h(b.t); for (const it of b.items) { const li = h('li'); this._inline(li, it); n.appendChild(li) } }
      else if (b.t === 'quote') { n = h('blockquote'); this._inline(n, b.c) }
      else if (b.t === 'hr') n = h('hr')
      else if (b.t === 'code') { const c = h('code'); this._text(c, b.s); n = h('pre'); n.appendChild(c) }
      else if (b.t === 'table') {
        const tb = h('table'); const hr = h('tr')
        for (const c of b.head) { const th = h('th'); this._inline(th, c); hr.appendChild(th) }
        tb.appendChild(h('thead', {}, hr)); const body = h('tbody')
        for (const r of b.rows) { const tr = h('tr'); for (const c of r) { const td = h('td'); this._inline(td, c); tr.appendChild(td) } body.appendChild(tr) }
        tb.appendChild(body); n = h('div', { class: 'odc-tablewrap' }, tb)
      }
      if (n) q.page.appendChild(n)
    }
    q.page.scrollTop = 0
    if (heading) {
      const t = q.page.querySelector(`[data-hid="${String(heading).replace(/[^A-Za-z0-9_-]/g, '')}"]`)
      if (t) { try { q.page.scrollTop = Math.max(0, t.offsetTop - 6) } catch (_) {} }
    }
    this._afterRender()
  }

  _afterRender () {
    const q = this._q
    this._hits = Array.from(q.page.querySelectorAll('mark.odc-hit'))
    this._hitIdx = this._hits.length && this._terms.length ? 0 : -1
    this._markCurrent(false)
  }

  _markCurrent (scroll) {
    const q = this._q; if (!q) return
    this._hits.forEach((m, i) => m.classList.toggle('is-current', i === this._hitIdx))
    q.hprev.disabled = q.hnext.disabled = this._hits.length < 2
    if (!this._terms.length) q.count.textContent = ''
    else q.count.textContent = this._hits.length ? `${this._hitIdx + 1}/${this._hits.length} on this page` : '0 on this page'
    const cur = this._hits[this._hitIdx]
    if (scroll && cur) { try { cur.scrollIntoView({ block: 'center' }) } catch (_) { /* jsdom */ } }
  }
}
