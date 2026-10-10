/**
 * ui/OmniEmojiPicker.js — a searchable picker for the WHOLE Unicode emoji set (V181)
 *
 * Used by the product form in ui/OmniStoreCatalogUI.js (USER side: it imports only data/OmniEmojiData.js, never a Dev* module).
 * Not a panel and not a scene module: a small component. `new OmniEmojiPicker({ onPick }).mount(container)`; `.destroy()`.
 *
 *   search box    name or keyword ("apple", "flag japan", "heart"), every word must match; Enter picks the first hit
 *   tabs          Recent, then the 9 Unicode groups (Smileys, People, Animals & Nature, Food & Drink, Travel, Activities, Objects, Symbols, Flags)
 *   grid          one button per emoji (title = name); a group is at most 388 buttons, a search at most 400
 *   recent        the last 24 picks, newest first, saved at localStorage 'omni:store-emoji-recent-v1' (try/catch; the picker works without storage)
 * onPick(emoji, entry) runs for a click / Enter / Space on a cell. The picker never writes to the store itself.
 */

import { GROUP_NAMES, GROUP_ICONS, getEmojis, searchEmojis } from '../data/OmniEmojiData.js'

export const RECENT_KEY = 'omni:store-emoji-recent-v1'
export const RECENT_MAX = 24

const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

/** The saved recent list (clean strings, newest first, at most RECENT_MAX). Never throws. */
export function getRecent () {
  try {
    const d = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]')
    if (!Array.isArray(d)) return []
    const out = []
    for (const x of d) if (typeof x === 'string' && x && x.length <= 32 && !/[<>]/.test(x) && !out.includes(x)) out.push(x)
    return out.slice(0, RECENT_MAX)
  } catch (_) { return [] }
}
/** Put an emoji first in the recent list (de-duplicated, capped). Returns the new list. */
export function pushRecent (e) {
  if (typeof e !== 'string' || !e || e.length > 32 || /[<>]/.test(e)) return getRecent()
  const next = [e, ...getRecent().filter(x => x !== e)].slice(0, RECENT_MAX)
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)) } catch (_) { /* memory only */ }
  return next
}
export function clearRecent () { try { localStorage.removeItem(RECENT_KEY) } catch (_) { /* ignore */ } }

const STYLES = `
.oep { border: 1px solid var(--omni-theme-border, rgba(255,255,255,.14)); border-radius: 8px; padding: 4px; margin: 4px 0; background: rgba(255,255,255,.03); }
.oep input[type=search] { width: 100%; box-sizing: border-box; }
.oep-tabs { display: flex; gap: 2px; margin: 4px 0; overflow-x: auto; scrollbar-width: thin; }
.oep-tab { flex: 0 0 auto; min-width: 30px; min-height: 30px; padding: 0 5px; font-size: 15px; line-height: 1; cursor: pointer; color: inherit; border-radius: 6px; background: rgba(255,255,255,.05); border: 1px solid transparent; }
.oep-tab[aria-selected="true"] { background: rgba(255,255,255,.22); border-color: rgba(255,255,255,.7); }
.oep-title { font-size: 10px; opacity: .7; margin: 2px 0; }
.oep-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(32px, 1fr)); gap: 2px; max-height: 168px; overflow-y: auto; overscroll-behavior: contain; }
.oep-cell { height: 32px; padding: 0; font-size: 20px; line-height: 1; cursor: pointer; color: inherit; border-radius: 5px; background: rgba(255,255,255,.05); border: 1px solid transparent; font-family: "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Twemoji Mozilla",sans-serif; }
.oep-cell:hover, .oep-cell:focus-visible { background: rgba(255,255,255,.2); border-color: rgba(255,255,255,.6); outline: none; }
.oep-empty { font-size: 11px; opacity: .7; padding: 6px 2px; }
@media (max-width: 700px) { .oep-tab { min-width: 40px; min-height: 40px; } .oep-cell { height: 40px; } .oep-grid { grid-template-columns: repeat(auto-fill, minmax(40px, 1fr)); max-height: 150px; } }
`

export default class OmniEmojiPicker {
  /** @param {{onPick?: (emoji:string, entry:object|null)=>void}} opts */
  constructor (opts = {}) {
    this.opts = opts
    this.root = null
    this.tab = 'recent'     // 'recent' | 0..8
    this.query = ''
    this._shown = []
  }

  mount (container) {
    if (typeof document !== 'undefined' && !document.getElementById('oep-styles')) { const st = document.createElement('style'); st.id = 'oep-styles'; st.textContent = STYLES; document.head.appendChild(st) }
    this.root = document.createElement('div')
    this.root.className = 'oep'
    this.root.innerHTML = `<input class="oss-input" type="search" data-oep="q" placeholder="Search all emojis (apple, flag, heart…)" aria-label="Search emojis" autocomplete="off" spellcheck="false">
      <div class="oep-tabs" role="tablist" aria-label="Emoji groups"><button type="button" class="oep-tab" role="tab" data-oep-tab="recent" title="Recently used" aria-label="Recently used">🕘</button>${GROUP_NAMES.map((n, i) => `<button type="button" class="oep-tab" role="tab" data-oep-tab="${i}" title="${esc(n)}" aria-label="${esc(n)}">${GROUP_ICONS[i]}</button>`).join('')}</div>
      <div class="oep-title" data-oep="title" aria-live="polite"></div>
      <div class="oep-grid" role="group" aria-label="Emojis" data-oep="grid"></div>`
    container.appendChild(this.root)
    this._onClick = (e) => {
      const t = e.target.closest?.('[data-oep-tab]')
      if (t) { this.query = ''; this.root.querySelector('[data-oep="q"]').value = ''; this.setTab(t.dataset.oepTab === 'recent' ? 'recent' : +t.dataset.oepTab); return }
      const c = e.target.closest?.('[data-oep-i]')
      if (c) this.pick(this._shown[+c.dataset.oepI] ?? null, c.textContent)
    }
    this._onInput = (e) => { if (e.target.matches?.('[data-oep="q"]')) { this.query = e.target.value; this.render() } }
    this._onKey = (e) => { if (e.key === 'Enter' && e.target.matches?.('[data-oep="q"]')) { e.preventDefault(); if (this._shown[0]) this.pick(this._shown[0], this._shown[0].e) } }
    this.root.addEventListener('click', this._onClick)
    this.root.addEventListener('input', this._onInput)
    this.root.addEventListener('keydown', this._onKey)
    this.setTab(getRecent().length ? 'recent' : 0)
    return this
  }

  destroy () {
    if (this.root) { this.root.removeEventListener('click', this._onClick); this.root.removeEventListener('input', this._onInput); this.root.removeEventListener('keydown', this._onKey); this.root.remove() }
    this.root = null; this._shown = []
  }

  setTab (tab) {
    this.tab = tab
    this.render()
  }

  /** The entries the grid shows right now (a search covers ALL groups whatever tab is selected; with no search: the tab). */
  entries () {
    const q = this.query.trim()
    if (q) return searchEmojis(q)
    if (this.tab === 'recent') {
      const byChar = new Map(getEmojis().map(x => [x.e, x]))
      return getRecent().map(e => byChar.get(e) ?? { e, n: 'Custom emoji', g: -1, k: [] })
    }
    return searchEmojis('', { group: this.tab, limit: 1000 })
  }

  render () {
    if (!this.root) return
    this._shown = this.entries()
    const q = this.query.trim()
    this.root.querySelectorAll('[data-oep-tab]').forEach(b => { const on = !q && String(b.dataset.oepTab) === String(this.tab); b.setAttribute('aria-selected', String(on)) })
    const title = q ? `${this._shown.length} match${this._shown.length === 1 ? '' : 'es'} for “${q}”`
      : this.tab === 'recent' ? 'Recently used' : `${GROUP_NAMES[this.tab]} (${this._shown.length})`
    this.root.querySelector('[data-oep="title"]').textContent = title
    this.root.querySelector('[data-oep="grid"]').innerHTML = this._shown.length
      ? this._shown.map((x, i) => `<button type="button" class="oep-cell" data-oep-i="${i}" title="${esc(x.n)}" aria-label="${esc(x.n)}">${esc(x.e)}</button>`).join('')
      : `<div class="oep-empty">${q ? 'No emoji matches that. Try another word.' : 'Nothing used yet. Pick one from a group tab.'}</div>`
  }

  pick (entry, fallbackChar) {
    const e = entry?.e ?? fallbackChar
    if (!e) return null
    pushRecent(e)
    try { this.opts.onPick?.(e, entry ?? null) } catch (_) { /* a bad callback must not break the picker */ }
    if (this.tab === 'recent' && !this.query.trim()) this.render()
    return e
  }
}

