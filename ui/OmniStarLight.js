/**
 * ui/OmniStarLight.js — ⟐OmniStarLight: the Spotlight-style search (V190)
 *
 * A panel that drops down from the top of the screen to a little above the middle (phones: it stops just under the ribbon so the
 * on-screen keyboard never hides the results). Centred, width min(640px, screen - 16px). The input is focused at once. It closes on
 * Escape, on a click / tap outside, after you open something, and when you press the shortcut again.
 *
 *   Open:   Q (the bare key; V195: it was Ctrl/Cmd+K, which now toggles Expression typing)  |  ribbon OmniStar tab > OmniStarLight  |  window event omni:starlight-toggle / omni:starlight-open
 *           Q is ignored in a text field / select / contenteditable, with Ctrl / Cmd / Alt held, on key repeat, while Expression typing is ON and while the scene terminal has the keyboard.
 *   Keys:   ArrowDown / ArrowUp move, Enter opens, Escape closes, Tab stays in the field.
 *
 * Sources (a small registry; this file registers two, registerSource() adds more):
 *   Sites  the main OmniProducts / areas (utils/OmniStarLightSites.js), each Available or Unavailable (the rule is written there).
 *          With an EMPTY query the whole list is shown, grouped Available / Unavailable.
 *   Docs   the user-guide pages and headings (data/OmniDocsData.js); a click opens the Docs panel on that page (omni:docs-open).
 * Matching + ranking is pure: utils/OmniStarLightIndex.js.
 *
 * Opening an AVAILABLE site: first the OmniNotify info box is told the site's name + description (the same box the tooltips use:
 * omni:notify-info), then the site's normal open action runs (the same events the ribbon / drawers dispatch: omni:nav-select,
 * omni:system-toggle ...). An UNAVAILABLE site is dimmed with its reason; choosing it does nothing except show that reason (here and
 * in the OmniNotify box). Window-chrome class B (a transient overlay, not a window; never registered with the WindowManager).
 * Module contract: constructor / init / update / destroy / onResize. A user-facing module: imports no Dev* module.
 */

import * as WindowManager from './WindowManager.js'
import { DOCS } from '../data/OmniDocsData.js'
import { buildResults, tokenize, MAX_QUERY } from '../utils/OmniStarLightIndex.js'
import { resolveSites, isDevMode } from '../utils/OmniStarLightSites.js'
import { getTopOffset } from '../utils/OmniLayout.js'
import { isExpressionOn } from '../utils/OmniExpressionFlag.js'
import { sceneTypingActive } from '../utils/TerminalSceneInput.js'

/** a place where the person types text (input except buttons / checkboxes..., textarea, select, contenteditable). */
function isTypingTarget (el) {
  try {
    if (!el || !el.tagName) return false
    const t = String(el.tagName).toUpperCase()
    if (t === 'TEXTAREA' || t === 'SELECT') return true
    if (t === 'INPUT') return !['button', 'checkbox', 'radio', 'range', 'submit', 'reset', 'image', 'file', 'color'].includes(String(el.type || 'text').toLowerCase())
    return !!el.isContentEditable
  } catch (_) { return false }
}
export const ROOT_ID = 'omni-starlight'
export const SHORTCUT_LABEL = 'Q'
export const TOGGLE_EVENT = 'omni:starlight-toggle'
export const OPEN_EVENT = 'omni:starlight-open'
const PHONE_MAX = 700
const STYLE_ID = 'omni-starlight-styles'
const DOCK_H = 52

const STYLES = /* css */`
#${ROOT_ID} {
  --osl-top: 120px; --osl-list-h: 360px;
  position: fixed; left: 50%; top: var(--osl-top); z-index: 2000; box-sizing: border-box;
  width: min(640px, calc(100vw - 16px)); transform: translate(-50%, calc(-100% - var(--osl-top) - 24px));
  visibility: hidden; pointer-events: none; opacity: 0.2;
  transition: transform .28s cubic-bezier(.2,.8,.2,1), opacity .2s ease, visibility 0s linear .28s;
  background: var(--omni-theme-bg, rgba(10,10,14,.94)); color: var(--omni-theme-text, rgba(255,255,255,.95));
  border: 1px solid var(--omni-theme-border, rgba(255,255,255,.18)); border-radius: 14px; overflow: hidden;
  backdrop-filter: blur(22px) saturate(1.5); -webkit-backdrop-filter: blur(22px) saturate(1.5);
  box-shadow: 0 20px 60px rgba(0,0,0,.6), 0 0 0 1px rgba(255,255,255,.04);
  font-family: 'Courier New', Courier, monospace; font-size: 12px;
}
#${ROOT_ID}.is-open { transform: translate(-50%, 0); visibility: visible; pointer-events: auto; opacity: 1; transition-delay: 0s; }
@media (prefers-reduced-motion: reduce) { #${ROOT_ID} { transition: none; } }
#${ROOT_ID} .osl-row { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-bottom: 1px solid var(--omni-theme-border, rgba(255,255,255,.12)); }
#${ROOT_ID} .osl-ico { font-size: 18px; color: var(--omni-theme-accent, #fff); }
#${ROOT_ID} .osl-input { flex: 1; min-width: 0; min-height: 30px; box-sizing: border-box; background: transparent; border: none; outline: none; color: inherit; font: inherit; font-size: 15px; }
#${ROOT_ID} .osl-input::placeholder { color: var(--omni-theme-text-dim, rgba(255,255,255,.5)); }
#${ROOT_ID} .osl-key { font-size: 10px; padding: 2px 6px; border-radius: 4px; border: 1px solid var(--omni-theme-border, rgba(255,255,255,.25)); border-bottom-width: 2px; color: var(--omni-theme-text-dim, rgba(255,255,255,.7)); }
#${ROOT_ID} .osl-list { max-height: var(--osl-list-h); overflow-y: auto; padding: 4px 0 6px; scrollbar-width: thin; }
#${ROOT_ID} .osl-gh { position: sticky; top: 0; z-index: 1; padding: 6px 14px 3px; font-size: 9.5px; letter-spacing: .1em; text-transform: uppercase; color: var(--omni-theme-text-dim, rgba(255,255,255,.6)); background: var(--omni-theme-bg, rgba(10,10,14,.97)); }
#${ROOT_ID} .osl-item { display: flex; align-items: center; gap: 10px; padding: 6px 14px; cursor: pointer; border-left: 3px solid transparent; }
#${ROOT_ID} .osl-item.is-sel { background: rgba(255,255,255,.12); border-left-color: var(--omni-theme-accent, #fff); }
#${ROOT_ID} .osl-item[aria-disabled="true"] { opacity: .5; cursor: default; }
#${ROOT_ID} .osl-item[aria-disabled="true"] .osl-sub { font-style: italic; }
#${ROOT_ID} .osl-main { flex: 1; min-width: 0; }
#${ROOT_ID} .osl-name { font-size: 13px; font-weight: bold; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
#${ROOT_ID} .osl-sub { margin-top: 1px; font-size: 10.5px; color: var(--omni-theme-text-dim, rgba(255,255,255,.65)); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
#${ROOT_ID} .osl-chip { flex: 0 0 auto; font-size: 9px; letter-spacing: .06em; text-transform: uppercase; padding: 2px 7px; border-radius: 9px; border: 1px solid var(--omni-theme-border, rgba(255,255,255,.25)); }
#${ROOT_ID} .osl-chip[data-kind="available"] { border-color: rgba(120,230,150,.6); color: rgb(150,240,170); }
#${ROOT_ID} .osl-chip[data-kind="unavailable"] { border-color: rgba(255,170,90,.55); color: rgb(255,190,120); }
#${ROOT_ID} .osl-empty { padding: 14px; color: var(--omni-theme-text-dim, rgba(255,255,255,.65)); }
#${ROOT_ID} .osl-foot { display: flex; gap: 10px; align-items: center; padding: 6px 14px; font-size: 10px; color: var(--omni-theme-text-dim, rgba(255,255,255,.6)); border-top: 1px solid var(--omni-theme-border, rgba(255,255,255,.12)); }
#${ROOT_ID} .osl-status { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--omni-theme-text, #fff); }
@media (max-width: ${PHONE_MAX}px) {
  #${ROOT_ID} .osl-item { padding: 9px 12px; min-height: 44px; }
  #${ROOT_ID} .osl-input { font-size: 16px; }   /* 16px: iOS does not zoom the page on focus */
  #${ROOT_ID} .osl-foot .osl-hint { display: none; }
}
`

function injectStyles () {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return
  const s = document.createElement('style'); s.id = STYLE_ID; s.textContent = STYLES; document.head.appendChild(s)
}

const h = (tag, attrs = {}, text) => {
  const n = document.createElement(tag)
  for (const k of Object.keys(attrs)) n.setAttribute(k, attrs[k])
  if (text !== undefined) n.textContent = text
  return n
}
const ev = (name, detail) => window.dispatchEvent(new CustomEvent(name, { detail }))

export default class OmniStarLight {
  /** opts: { docs?, devMode? (boolean override), sites? (raw registry override) } — for tests; the app passes nothing. */
  constructor (context, opts = {}) {
    this.ctx = context
    this.opts = opts
    this._el = null; this._open = false; this._results = null; this._sel = -1; this._prevFocus = null
    this._extra = []                       // registerSource() entries
    this._on = null; this._inited = false
  }

  init () {
    if (this._inited) return
    this._inited = true
    injectStyles()
    this._build()
    this._on = {
      key: (e) => this._onKey(e),
      down: (e) => { if (this._open && !this._el.contains(e.target) && !e.target.closest?.('[data-btn="starlight"]')) this.close({ restoreFocus: false }) },   // the ribbon's own button toggles it
      toggle: () => this.toggle(), open: (e) => this.open(e?.detail?.query),
      resize: () => this._place(),
    }
    window.addEventListener('keydown', this._on.key, true)         // capture: Escape must close it before anything else sees it
    document.addEventListener('pointerdown', this._on.down, true)
    window.addEventListener(TOGGLE_EVENT, this._on.toggle)
    window.addEventListener(OPEN_EVENT, this._on.open)
    window.addEventListener('resize', this._on.resize)
    window.addEventListener('omni:layout-changed', this._on.resize)
  }

  update () {}
  onResize () { this._place() }

  destroy () {
    if (!this._inited) return
    window.removeEventListener('keydown', this._on.key, true)
    document.removeEventListener('pointerdown', this._on.down, true)
    window.removeEventListener(TOGGLE_EVENT, this._on.toggle)
    window.removeEventListener(OPEN_EVENT, this._on.open)
    window.removeEventListener('resize', this._on.resize)
    window.removeEventListener('omni:layout-changed', this._on.resize)
    this._el?.remove()
    document.getElementById(STYLE_ID)?.remove()
    this._el = null; this._inited = false; this._open = false
  }

  // ── public ──────────────────────────────────────────────────────────────────

  get isOpen () { return this._open }
  getResults () { return this._results }
  getSelected () { return this._results?.flat[this._sel] ?? null }

  /** Add a source: { id, label, search(query) -> [{ title, sub?, available?, reason?, run() }] } (shown after Docs for a non-empty query). */
  registerSource (src) {
    if (!src || typeof src.search !== 'function' || !src.id) return false
    this._extra = this._extra.filter(s => s.id !== src.id).concat([src])
    return true
  }

  open (query = '') {
    if (!this._el) return
    if (!this._open) { this._prevFocus = document.activeElement }
    this._open = true
    this._el.classList.add('is-open')
    this._place()
    const input = this._q.input
    input.value = typeof query === 'string' ? query.slice(0, MAX_QUERY) : ''
    this._status('')
    this._refresh()
    input.setAttribute('aria-expanded', 'true')
    try { input.focus({ preventScroll: true }); input.select?.() } catch (_) { /* focus is best effort */ }
  }

  close ({ restoreFocus = true } = {}) {
    if (!this._open) return
    this._open = false
    this._el.classList.remove('is-open')
    this._q.input.setAttribute('aria-expanded', 'false')
    const f = this._prevFocus; this._prevFocus = null
    if (restoreFocus && f && f !== document.body && document.contains(f)) { try { f.focus({ preventScroll: true }) } catch (_) { /* gone */ } }
    else if (document.activeElement === this._q.input) this._q.input.blur()
  }

  toggle () { if (this._open) this.close(); else this.open() }

  /** Type into the field programmatically (what the input event does). */
  setQuery (text) { this._q.input.value = String(text ?? '').slice(0, MAX_QUERY); this._refresh() }

  move (dir) {
    const sel = this._selectable()
    if (!sel.length) return
    const at = sel.indexOf(this._sel)
    this._select(sel[(at + (dir < 0 ? -1 : 1) + sel.length) % sel.length] ?? sel[0])
  }

  /** Activate the highlighted item (Enter / click). Returns what happened: 'opened' | 'doc' | 'unavailable' | 'source' | null. */
  activate (index = this._sel) {
    const item = this._results?.flat[index]
    if (!item) return null
    if (item.kind === 'site') return this._activateSite(item.site)
    if (item.kind === 'extra') {
      if (item.available === false) { this._status(`${item.title} is unavailable${item.reason ? ': ' + item.reason : '.'}`); return 'unavailable' }
      try { item.run?.() } catch (err) { console.warn('⟐OmniStarLight — source action failed:', err) }
      this.close(); return 'source'
    }
    // docs: page / heading / text hit
    ev('omni:docs-open', { page: item.pageId, heading: item.heading?.id ?? '', query: this._q.input.value.trim() })
    this.close({ restoreFocus: false })
    return 'doc'
  }

  // ── sites ───────────────────────────────────────────────────────────────────

  _sites () {
    const dev = typeof this.opts.devMode === 'boolean' ? this.opts.devMode : isDevMode()
    return this.opts.sites ? resolveSites(dev, this.opts.sites) : resolveSites(dev)
  }

  _activateSite (site) {
    if (!site.available) {
      const why = site.reason || 'Not available.'
      ev('omni:notify-info', { name: `${site.name} (unavailable)`, desc: why, source: 'OmniStarLight', holdMs: 4000 })
      this._status(`${site.name} is unavailable: ${why}`)
      return 'unavailable'
    }
    // 1) the same info box the tooltips use, 2) the site's normal open action (the same events the ribbon / drawers dispatch)
    ev('omni:notify-info', { name: site.name, key: '', desc: site.desc, source: `OmniStarLight · ${site.group}`, holdMs: 4000 })
    this.close({ restoreFocus: false })
    const o = site.open
    try {
      if (o.type === 'nav') ev('omni:nav-select', { drawer: 'starlight', item: o.item, parent: o.parent ?? null, path: `starlight/${o.item}` })
      else if (o.type === 'sys') ev('omni:system-toggle', { system: o.system })
      else if (o.type === 'event') ev(o.name, o.detail)
      else if (o.type === 'shortcuts') {
        const item = (WindowManager.getContextMenu(null).Assistance ?? []).find(i => /shortcut/i.test(i.label))
        if (item) item.action(); else ev('omni:notify-info', { name: 'Keyboard Shortcuts', desc: 'The keyboard shortcuts panel is not registered yet.', holdMs: 3500 })
      }
    } catch (err) { console.warn('⟐OmniStarLight — open action failed:', site.id, err) }
    return 'opened'
  }

  // ── DOM ─────────────────────────────────────────────────────────────────────

  _build () {
    const root = h('div', { id: ROOT_ID, role: 'dialog', 'aria-label': 'OmniStarLight search', 'aria-modal': 'false' })
    const input = h('input', { type: 'text', class: 'osl-input', role: 'combobox', 'aria-expanded': 'false', 'aria-controls': 'osl-list', 'aria-autocomplete': 'list', placeholder: 'Search sites and docs…', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', maxlength: String(MAX_QUERY), 'aria-label': 'Search sites and docs',
      'data-omni-tip': 'OmniStarLight', 'data-omni-tip-key': SHORTCUT_LABEL, 'data-omni-tip-desc': 'Search the main sites of the app (Available or Unavailable) and the user guide. Arrow keys move, Enter opens, Escape closes.' })
    const list = h('div', { class: 'osl-list', id: 'osl-list', role: 'listbox', 'aria-label': 'Results' })
    const status = h('span', { class: 'osl-status', role: 'status', 'aria-live': 'polite' })
    const row = h('div', { class: 'osl-row' })
    row.append(h('span', { class: 'osl-ico', 'aria-hidden': 'true' }, '✧'), input, h('kbd', { class: 'osl-key' }, 'Esc'))
    const foot = h('div', { class: 'osl-foot' })
    foot.append(status, h('span', { class: 'osl-hint' }, `↑↓ move · Enter open · ${SHORTCUT_LABEL}`))
    root.append(row, list, foot)
    this._el = root
    this._q = { input, list, status }
    ;(document.getElementById('omni-ui') ?? document.body).appendChild(root)

    input.addEventListener('input', () => this._refresh())
    input.addEventListener('keydown', (e) => this._inputKey(e))
    list.addEventListener('pointermove', (e) => { const it = e.target.closest?.('.osl-item'); if (it) this._select(Number(it.dataset.i), { scroll: false }) })
    list.addEventListener('click', (e) => { const it = e.target.closest?.('.osl-item'); if (it) { this._select(Number(it.dataset.i), { scroll: false }); this.activate(Number(it.dataset.i)) } })
  }

  _inputKey (e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); this.move(1) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); this.move(-1) }
    else if (e.key === 'Enter') { e.preventDefault(); this.activate() }
    else if (e.key === 'Tab') e.preventDefault()          // the field is the only stop
  }

  _onKey (e) {
    if (isExpressionOn()) return                      // V195: Expression typing owns every key while it is on
    if (this._open && e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); this.close(); return }
    // V195: the bare Q key opens the search (it used to be Ctrl/Cmd+K, now Expression typing's toggle)
    if ((e.key === 'q' || e.key === 'Q') && !e.ctrlKey && !e.metaKey && !e.altKey && !e.repeat && !e.defaultPrevented) {
      if (this._open) return
      if (isTypingTarget(e.target) || isTypingTarget(typeof document !== 'undefined' ? document.activeElement : null)) return
      let capture = false
      try { capture = sceneTypingActive() } catch (_) { capture = false }
      if (capture) return                             // the in-scene terminal has the keyboard: Q is text there
      e.preventDefault(); e.stopPropagation()
      this.toggle()
    }
  }

  /** Top of the panel: a little above the middle on desktop, right under the ribbon on a phone. List height = what fits above the dock. */
  _place () {
    if (!this._el) return
    const vw = window.innerWidth || 1280, vh = window.innerHeight || 720
    const minTop = getTopOffset() + 8
    const top = vw <= PHONE_MAX ? minTop : Math.max(minTop, Math.round(vh * 0.40 - 28))
    const listH = Math.max(120, Math.min(420, vh - top - DOCK_H - 16 - 96))
    this._el.style.setProperty('--osl-top', top + 'px')
    this._el.style.setProperty('--osl-list-h', listH + 'px')
    this._el.dataset.place = vw <= PHONE_MAX ? 'top' : 'middle'
  }

  _status (msg) { this._q.status.textContent = msg }

  _refresh () {
    const query = this._q.input.value
    const res = buildResults(this._sites(), this.opts.docs ?? DOCS, query)
    // extra sources (registerSource): after Docs, only for a non-empty query
    if (!res.empty && this._extra.length) {
      for (const src of this._extra) {
        let items = []
        try { items = (src.search(query) ?? []).slice(0, 6).filter(x => x && x.title).map(x => ({ kind: 'extra', ...x })) } catch (_) { items = [] }
        if (items.length) { res.groups.push({ id: src.id, label: src.label || src.id, items }); res.flat.push(...items) }
      }
    }
    this._results = res
    this._renderList()
    const sel = this._selectable()
    this._select(sel.length ? sel[0] : -1, { scroll: false })
    this._status('')
  }

  _selectable () { return (this._results?.flat ?? []).map((_, i) => i) }

  _renderList () {
    const list = this._q.list
    list.replaceChildren()
    const res = this._results
    if (!res.flat.length) { list.appendChild(h('div', { class: 'osl-empty', role: 'presentation' }, tokenize(this._q.input.value).length ? 'No site or guide page matches. Try fewer letters.' : 'Nothing to show.')); return }
    let i = 0
    for (const g of res.groups) {
      list.appendChild(h('div', { class: 'osl-gh', role: 'presentation' }, g.label))
      for (const it of g.items) {
        const idx = i++
        const row = h('div', { class: 'osl-item', role: 'option', id: `osl-opt-${idx}`, 'data-i': String(idx), 'aria-selected': 'false' })
        let name, sub, chip, kind
        if (it.kind === 'site') {
          const s = it.site; name = s.name; kind = s.available ? 'available' : 'unavailable'
          sub = s.available ? s.desc : `Unavailable: ${s.reason}`; chip = s.available ? 'Available' : 'Unavailable'
          if (!s.available) row.setAttribute('aria-disabled', 'true')
        } else if (it.kind === 'extra') {
          name = it.title; sub = it.available === false ? `Unavailable: ${it.reason || ''}` : (it.sub || ''); kind = it.available === false ? 'unavailable' : 'source'; chip = g.label
          if (it.available === false) row.setAttribute('aria-disabled', 'true')
        } else {
          name = it.kind === 'heading' ? `${it.title} › ${it.heading.text}` : it.title
          sub = it.kind === 'page' ? 'Guide page' : (it.kind === 'heading' ? 'Guide section' : 'Found in the page text'); kind = 'docs'; chip = 'Docs'
        }
        const main = h('div', { class: 'osl-main' }); main.append(h('div', { class: 'osl-name' }, name), h('div', { class: 'osl-sub' }, sub))
        row.append(main, h('span', { class: 'osl-chip', 'data-kind': kind }, chip))
        list.appendChild(row)
      }
    }
  }

  _select (i, { scroll = true } = {}) {
    this._sel = i
    const rows = this._q.list.querySelectorAll('.osl-item')
    rows.forEach(r => { const on = Number(r.dataset.i) === i; r.classList.toggle('is-sel', on); r.setAttribute('aria-selected', String(on)) })
    const cur = rows[i]
    if (cur) {
      this._q.input.setAttribute('aria-activedescendant', cur.id)
      if (scroll) { try { cur.scrollIntoView({ block: 'nearest' }) } catch (_) { /* jsdom */ } }
    } else this._q.input.removeAttribute('aria-activedescendant')
  }
}
