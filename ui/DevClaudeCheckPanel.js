/**
 * ui/DevClaudeCheckPanel.js — ⟐DevClaudeCheck: DEV ONLY (V184, ⟐Developer drawer slot 7)
 *
 * The feedback loop between the developer and Claude, in one panel. Every iteration it shows
 *   - WHAT TO CHECK     the checklist items for this version (+ the failed / skipped ones carried over from earlier versions),
 *   - WHAT CLAUDE IS LOOKING FOR   questions only the developer can answer (real GPU fps, phone feel, "does X look right"),
 *   - KNOWN ISSUES      read-only,
 *   - and a MESSAGE box + "Copy report" that packs the marks, answers, message and (optionally) the app state into ONE small JSON block
 *     the developer pastes back to Claude.
 * Content: data/ClaudeCheckData.js (GENERATED per version by tools/build-claude-check.mjs). Model + storage: utils/DevClaudeCheckData.js
 * ('omni:claude-check-v1'). Design: docs/omniproducts/CLAUDE_CHECK_DESIGN.md.
 *
 * DEV ONLY. No user-facing module imports this file. Every piece of text from the data, the notes, the answers and the message is put in
 * the page with textContent / .value only (never innerHTML). No ribbon or dock button: the panel opens from ⟐Developer slot 7 only.
 * App state: it asks the DevOmniStoreSettings panel for its Dump through the event `omni:dev-dump-get` (detail.out is filled with the dump
 * text) so there is no import cycle; when that panel does not answer, a minimal own dump is used.
 */

import OmniSettingsPanelBase from './OmniSettingsPanelBase.js'
import * as Data from '../utils/DevClaudeCheckData.js'
import * as Store from '../utils/OmniStoreModel.js'

export const PANEL_ID = 'devclaudecheck'
export const NAV_ITEM = '⟐DevClaudeCheck'

const STYLES = `
.oss-panel.dcc-panel.dcc-panel { overflow-x: hidden; }
.dcc-panel .oss-body { overflow-x: hidden; padding-top: 4px; }
.dcc-panel *, .dcc-panel *::before { box-sizing: border-box; }
.dcc-panel { overflow-wrap: anywhere; }
.dcc-ver { font-size: 12px; font-weight: bold; } .dcc-sum { margin: 2px 0; } .dcc-prog { margin: 4px 0; }
.dcc-bar { height: 5px; border-radius: 3px; background: rgba(255,255,255,.12); overflow: hidden; display: flex; margin-bottom: 4px; }
.dcc-bar > i { display: block; height: 100%; } .dcc-bar .p { background: #8fe3a2; } .dcc-bar .f { background: #ff8a8a; } .dcc-bar .s { background: #ffd37a; }
.dcc-chip { padding: 2px 8px; } .dcc-chip.is-on { background: rgba(255,255,255,.24); border-color: rgba(255,255,255,.8); }
.dcc-det { border-bottom: 1px solid var(--omni-theme-border, rgba(255,255,255,.14)); padding: 2px 0; }
.dcc-det > summary { cursor: pointer; padding: 6px 0; letter-spacing: .06em; font-size: 10px; text-transform: uppercase; color: var(--omni-theme-text-dim, rgba(255,255,255,.7)); }
.dcc-item { border: 1px solid rgba(255,255,255,.12); border-radius: 8px; padding: 6px 8px; margin: 5px 0; }
.dcc-item[data-r="pass"] { border-color: rgba(143,227,162,.55); } .dcc-item[data-r="fail"] { border-color: rgba(255,138,138,.8); } .dcc-item[data-r="skip"] { border-color: rgba(255,211,122,.6); }
.dcc-feat { font-weight: bold; } .dcc-pri { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 5px; background: rgba(255,255,255,.3); }
.dcc-pri[data-p="high"] { background: #ff4d6d; } .dcc-pri[data-p="low"] { background: rgba(255,255,255,.12); }
.dcc-tag { font-size: 9px; padding: 0 5px; border-radius: 4px; border: 1px solid rgba(255,255,255,.3); margin-left: 4px; white-space: nowrap; }
.dcc-tag.is-carried { border-color: #ffd37a; color: #ffd37a; }
.dcc-go, .dcc-prev { font-size: 10px; color: var(--omni-theme-text-dim, rgba(255,255,255,.7)); margin: 2px 0; } .dcc-what { margin: 3px 0; }
.dcc-btns { display: flex; gap: 6px; flex-wrap: wrap; margin: 4px 0; } .dcc-btns .oss-btn { flex: 1 1 60px; }
.dcc-btns .oss-btn.is-pass.is-on { background: rgba(143,227,162,.35); border-color: #8fe3a2; } .dcc-btns .oss-btn.is-fail.is-on { background: rgba(255,90,90,.35); border-color: #ff8a8a; } .dcc-btns .oss-btn.is-skip.is-on { background: rgba(255,211,122,.3); border-color: #ffd37a; }
.dcc-note { width: 100%; } .dcc-ask { border-top: 1px dashed rgba(255,255,255,.14); padding: 6px 0; } .dcc-why { font-size: 10px; color: var(--omni-theme-text-dim, rgba(255,255,255,.7)); margin: 2px 0 4px; }
.dcc-ask .oss-input { width: 100%; } .dcc-issues { margin: 0; padding-left: 16px; } .dcc-issues li { margin: 2px 0; }
.dcc-msg { width: 100%; min-height: 80px; white-space: pre-wrap; } .dcc-fb { width: 100%; min-height: 110px; white-space: pre-wrap; word-break: break-all; }
.dcc-fail-count { color: #ff8a8a; }
@media (max-width: 700px) { .oss-panel.dcc-panel.dcc-panel { max-height: 68vh; } }   /* a long checklist needs more than the 42vh of the other sheets */
`

function injectStyles () {
  if (typeof document === 'undefined' || document.getElementById('dcc-styles')) return
  const s = document.createElement('style'); s.id = 'dcc-styles'; s.textContent = STYLES; document.head.appendChild(s)
}

/** Tiny element builder. Text goes in with textContent only. */
function h (tag, props = {}, ...kids) {
  const el = document.createElement(tag)
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === false) continue
    if (k === 'class') el.className = v
    else if (k === 'text') el.textContent = v
    else if (k === 'dataset') Object.assign(el.dataset, v)
    else el.setAttribute(k, v === true ? '' : String(v))
  }
  kids.flat().forEach(c => { if (c !== null && c !== undefined && c !== false) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c) })
  return el
}
/** OmniNotify attributes (name, key, description). */
const tip = (props, name, desc) => ({ ...props, 'data-omni-tip': name, 'data-omni-tip-key': '—', 'data-omni-tip-desc': desc })
const btn = (text, props, name, desc) => h('button', tip({ type: 'button', class: 'oss-btn', ...props }, name, desc), text)

export async function copyText (text) {
  try { if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return true } } catch (_) { /* fall through */ }
  try {
    const ta = document.createElement('textarea'); ta.value = text; ta.style.cssText = 'position:fixed;left:-9999px;top:0'
    document.body.appendChild(ta); ta.select()
    const ok = document.execCommand?.('copy') === true
    ta.remove()
    return ok
  } catch (_) { return false }
}

function download (name, text) {
  try {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
    const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
    return true
  } catch (_) { return false }
}

const FILTERS = [['all', 'All'], ['desktop', 'Desktop'], ['phone', 'Phone'], ['touch', 'Touch'], ['gpu', 'GPU']]
const RES = [['pass', 'Pass'], ['fail', 'Fail'], ['skip', 'Skip']]
const debounce = (fn, ms) => { let t = null; const d = (...a) => { clearTimeout(t); t = setTimeout(() => { t = null; fn(...a) }, ms) }; d.flush = () => { if (t) { clearTimeout(t); t = null; fn() } }; return d }

export default class DevClaudeCheckPanel extends OmniSettingsPanelBase {
  constructor () {
    super({
      id: PANEL_ID, label: '⟐DevClaudeCheck', iconLabel: '⟐C', navItems: [NAV_ITEM], className: 'dcc-panel', devOnly: true, wide: true,
      bannerText: 'DEV ONLY — what Claude wants you to check, and a way to answer back; not for normal use',
    })
    this._open = null          // Set of category names that are expanded (null = not decided yet)
    this._confirm = false
    this._pendingNotes = new Map()
  }

  onInit () {
    injectStyles()
    this._onChanged = () => { if (this._b) { this._syncTitle(); this._syncProgress() } }
    window.addEventListener(Data.CHANGED_EVENT, this._onChanged)
  }
  onDestroy () {
    this._flush()
    window.removeEventListener(Data.CHANGED_EVENT, this._onChanged)
    clearTimeout(this._confirmT)
  }

  buildBody (body) {
    this._b = body   // the base assigns this._el only after _build() returns, so keep our own handle
    body.addEventListener('click', (e) => this._click(e))
    body.addEventListener('input', (e) => this._input(e))
    body.addEventListener('change', (e) => this._input(e, true))
    body.addEventListener('toggle', (e) => { const d = e.target; if (d?.dataset?.cat !== undefined && this._open) { d.open ? this._open.add(d.dataset.cat) : this._open.delete(d.dataset.cat) } }, true)
    this._render()
  }
  refresh () { if (this._b) this._render() }
  close () { this._flush(); super.close() }

  // ── render ────────────────────────────────────────────────────────────────────
  _render () {
    const body = this._b
    if (!body) return
    this._flush()
    const keepScroll = body.scrollTop
    const data = Data.getData(); const ui = Data.getUi(); const res = (id) => Data.getResult(id)
    const carried = Data.getCarriedOnly()
    if (!this._open) {
      this._open = new Set()
      data.checks.forEach(c => { if (c.priority === 'high' && !res(c.id)) this._open.add(c.category) })
      if (carried.length) this._open.add('__carried')
    }
    const frag = document.createDocumentFragment()

    // header
    const head = h('div', { class: 'dcc-hd' })
    head.appendChild(h('div', { class: 'dcc-ver', text: data.version ? `${data.version}  ·  ${data.date || 'no date'}` : 'No Claude Check data' }))
    head.appendChild(h('div', { class: 'dcc-sum', text: data.summary || (Data.isDataOk() ? '' : 'The bundled data is unusable: re-run tools/build-claude-check.mjs.') }))
    head.appendChild(h('div', { class: 'dcc-bar', 'aria-hidden': 'true' }, h('i', { class: 'p' }), h('i', { class: 'f' }), h('i', { class: 's' })))
    head.appendChild(h('div', { class: 'dcc-prog', 'data-ref': 'progress', role: 'status', 'aria-live': 'polite' }))
    const chips = h('div', { class: 'oss-row', role: 'group', 'aria-label': 'Device filter' })
    FILTERS.forEach(([k, label]) => chips.appendChild(btn(label, { class: 'oss-btn dcc-chip' + (ui.filter === k ? ' is-on' : ''), 'data-act': 'filter', 'data-filter': k, 'aria-pressed': ui.filter === k ? 'true' : 'false' }, `Show: ${label}`, k === 'all' ? 'Shows every check and question.' : `Shows only checks and questions for ${label.toLowerCase()} (and the ones that apply to any device).`)))
    head.appendChild(chips)
    head.appendChild(h('label', tip({ class: 'oss-row' }, 'Hide done', 'Hides the checks you already marked (Pass, Fail or Skip) at the next redraw, so only what is left shows.'), h('input', tip({ type: 'checkbox', 'data-act': 'hidedone', 'aria-label': 'Hide done' }, 'Hide done', 'Hides the checks you already marked, at the next redraw.')), ' Hide done'))
    frag.appendChild(head)
    if (ui.hideDone) head.querySelector('input').checked = true

    // carried over
    const vis = (it) => Data.deviceVisible(it.device, ui.filter)
    const done = (id) => !!res(id)
    const shown = (it) => vis(it) && !(ui.hideDone && done(it.id))
    if (carried.length) {
      frag.appendChild(this._section('__carried', `Carried over (${carried.length})`, carried.filter(shown).map(c => this._item(c, true)), 'Failed or skipped in an earlier version and not passed since. Mark them again here.'))
    }
    // checks by category
    const cats = []
    data.checks.forEach(c => { let g = cats.find(x => x.name === c.category); if (!g) { g = { name: c.category, items: [] }; cats.push(g) } g.items.push(c) })
    const checksSec = h('div', { 'data-ref': 'checks' }, h('div', { class: 'oss-sec', text: 'Check these' }))
    if (!data.checks.length) checksSec.appendChild(h('div', { class: 'oss-dim', text: 'No checks in this version.' }))
    cats.forEach(g => {
      const items = g.items.filter(shown)
      if (!items.length) return
      checksSec.appendChild(this._section(g.name, `${g.name} (${items.length})`, items.map(c => this._item(c, false))))
    })
    frag.appendChild(checksSec)

    // asks
    const asks = data.asks.filter(a => Data.deviceVisible(a.device, ui.filter))
    const askSec = h('div', { 'data-ref': 'asks' }, h('div', { class: 'oss-sec', text: "What I'm looking for" }))
    if (!asks.length) askSec.appendChild(h('div', { class: 'oss-dim', text: 'No questions for this filter.' }))
    asks.forEach(a => askSec.appendChild(this._ask(a)))
    frag.appendChild(askSec)

    // known issues
    const iss = h('div', { 'data-ref': 'issues' }, h('div', { class: 'oss-sec', text: 'Known issues' }))
    if (data.knownIssues.length) iss.appendChild(h('ul', { class: 'dcc-issues' }, data.knownIssues.map(t => h('li', { text: t }))))
    else iss.appendChild(h('div', { class: 'oss-dim', text: 'None listed.' }))
    frag.appendChild(iss)

    // message + actions
    const msgSec = h('div', { 'data-ref': 'message-sec' }, h('div', { class: 'oss-sec', text: 'Message to Claude' }))
    const ta = h('textarea', tip({ class: 'oss-text dcc-msg', 'data-field': 'message', maxlength: Data.LIMITS.message, spellcheck: 'false', 'aria-label': 'Message to Claude', placeholder: 'Anything else Claude should know: what you tried, what felt off, what you want next.' }, 'Message to Claude', 'Free text that goes into the report.'))
    ta.value = Data.getMessage()
    msgSec.appendChild(ta)
    const att = h('input', tip({ type: 'checkbox', 'data-field': 'attach', 'aria-label': 'Include app state' }, 'Include app state', 'Adds the app state (Dump) to the report.')); att.checked = Data.getAttach()
    msgSec.appendChild(h('label', tip({ class: 'oss-row' }, 'Include app state', 'Adds the DevOmniStoreSettings dump (settings, stores, counts, scene numbers) to the report; if that panel is unavailable a small own dump is used.'), att, ' Include app state (Dump)'))
    msgSec.appendChild(h('div', { class: 'oss-row' },
      btn('Copy report', { 'data-act': 'copy' }, 'Copy report', 'Copies ONE compact JSON block (marks, notes, answers, message) to the clipboard. Paste it to Claude. If the clipboard is blocked the text is shown to copy by hand.'),
      btn('Download report (.json)', { 'data-act': 'download' }, 'Download report', 'Saves the same report as a .json file.'),
      btn("Reset this version's answers", { 'data-act': 'reset' }, 'Reset this version', 'Clears the marks, notes, answers and message of this version only (asks twice). Carried items from older versions stay.')))
    msgSec.appendChild(h('div', { class: 'oss-msg', 'data-ref': 'report-msg', role: 'status', 'aria-live': 'polite' }))
    const fb = h('textarea', { class: 'oss-text dcc-fb', 'data-ref': 'fallback', readonly: 'readonly', spellcheck: 'false', 'aria-label': 'Report text to copy by hand', hidden: 'hidden' })
    msgSec.appendChild(fb)
    frag.appendChild(msgSec)

    body.replaceChildren(frag)
    this._syncTitle(); this._syncProgress()
    body.scrollTop = keepScroll
  }

  _section (key, title, items, hint) {
    const d = h('details', { class: 'dcc-det', 'data-cat': key })
    if (this._open?.has(key)) d.open = true
    d.appendChild(h('summary', { text: title }))
    if (hint) d.appendChild(h('div', { class: 'oss-dim', text: hint }))
    items.forEach(i => d.appendChild(i))
    return d
  }

  _item (c, isCarried) {
    const r = Data.getResult(c.id)
    const it = h('div', { class: 'dcc-item', 'data-id': c.id, 'data-r': r?.r ?? '' })
    const top = h('div', {}, h('span', { class: 'dcc-pri', 'data-p': c.priority, title: `priority: ${c.priority}` }), h('span', { class: 'dcc-feat', text: c.feature }))
    if (c.device && c.device !== 'any') top.appendChild(h('span', { class: 'dcc-tag', text: c.device }))
    if (c.priority === 'high') top.appendChild(h('span', { class: 'dcc-tag', text: 'high' }))
    const carriedTag = isCarried ? `from ${c.from}` : Data.tagFor(c.id)
    if (carriedTag) top.appendChild(h('span', { class: 'dcc-tag is-carried', text: carriedTag }))
    it.appendChild(top)
    if (isCarried) it.appendChild(h('div', { class: 'dcc-prev', text: `Previously ${c.prior.toUpperCase()} in ${c.from}${c.priorNote ? ': ' + c.priorNote : ''}` }))
    if (c.howToReach) it.appendChild(h('div', { class: 'dcc-go', text: 'Go to: ' + c.howToReach }))
    if (c.whatToCheck) it.appendChild(h('div', { class: 'dcc-what', text: c.whatToCheck }))
    const row = h('div', { class: 'dcc-btns', role: 'group', 'aria-label': `Result for ${c.feature}` })
    RES.forEach(([k, label]) => row.appendChild(btn(label, { class: `oss-btn is-${k}${r?.r === k ? ' is-on' : ''}`, 'data-act': 'res', 'data-r': k, 'aria-pressed': r?.r === k ? 'true' : 'false' }, label, k === 'pass' ? 'It works as described.' : k === 'fail' ? 'It does not work as described. Add what went wrong in the note.' : "Could not test it now (no device, no time). It carries over to the next version.")))
    it.appendChild(row)
    const note = h('input', tip({ class: 'oss-input dcc-note', type: 'text', maxlength: Data.LIMITS.note, 'data-field': 'note', 'aria-label': `Note for ${c.feature}`, placeholder: 'What went wrong?' }, 'Note', 'One line about what you saw (up to 300 characters). Goes into the report.'))
    note.value = r?.note ?? ''
    if (!r) note.hidden = true
    else note.placeholder = r.r === 'fail' ? 'What went wrong?' : 'Optional note'
    it.appendChild(note)
    return it
  }

  _ask (a) {
    const v = Data.getAnswers()[a.id]
    const box = h('div', { class: 'dcc-ask', 'data-ask': a.id })
    box.appendChild(h('div', {}, h('span', { class: 'dcc-feat', text: a.question }), a.device && a.device !== 'any' ? h('span', { class: 'dcc-tag', text: a.device }) : null))
    if (a.why) box.appendChild(h('div', { class: 'dcc-why', text: a.why }))
    if (a.kind === 'yesno' || a.kind === 'choice') {
      const opts = a.kind === 'yesno' ? [['yes', 'Yes'], ['no', 'No']] : a.choices.map(c => [c, c])
      const row = h('div', { class: 'dcc-btns', role: 'group', 'aria-label': a.question })
      opts.forEach(([val, label]) => row.appendChild(btn(label, { class: 'oss-btn' + (v === val ? ' is-on' : ''), 'data-act': 'answer', 'data-ask': a.id, 'data-value': val, 'aria-pressed': v === val ? 'true' : 'false' }, label, `Answer "${label}".`)))
      box.appendChild(row)
    } else {
      const inp = h('input', tip({ class: 'oss-input', type: a.kind === 'number' ? 'number' : 'text', 'data-field': 'answer', 'data-ask': a.id, 'aria-label': a.question, maxlength: a.kind === 'text' ? Data.LIMITS.answerText : null, step: a.kind === 'number' ? 'any' : null, inputmode: a.kind === 'number' ? 'decimal' : null, placeholder: a.kind === 'number' ? 'a number' : 'your answer' }, 'Answer', a.kind === 'number' ? 'Type a number.' : 'Type your answer (up to 500 characters).'))
      if (v !== undefined) inp.value = String(v)
      box.appendChild(inp)
    }
    return box
  }

  // ── live sync (no full redraw) ───────────────────────────────────────────────
  _syncTitle () {
    const t = this._b?.parentNode?.querySelector('.oss-title'); if (!t) return
    const n = Data.getCounts().openFailures
    t.textContent = n ? `${this.opts.label} · ${n} failing` : this.opts.label
    t.classList.toggle('dcc-fail-count', n > 0)
  }
  _syncProgress () {
    const body = this._b; if (!body) return
    const c = Data.getCounts()
    const p = body.querySelector('[data-ref="progress"]'); if (p) p.textContent = `${c.pass + c.fail + c.skip} of ${c.total} checked (${c.pass} pass, ${c.fail} fail, ${c.skip} skip)${c.carried ? `, ${c.carried} carried over` : ''}`
    const bar = body.querySelectorAll('.dcc-bar > i'); const pc = (n) => (c.total ? (n / c.total) * 100 : 0) + '%'
    if (bar.length === 3) { bar[0].style.width = pc(c.pass); bar[1].style.width = pc(c.fail); bar[2].style.width = pc(c.skip) }
  }
  _syncItem (it) {
    const id = it.dataset.id; const r = Data.getResult(id)
    it.dataset.r = r?.r ?? ''
    it.querySelectorAll('[data-act="res"]').forEach(b => { const on = r?.r === b.dataset.r; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false') })
    const note = it.querySelector('[data-field="note"]')
    if (note) { note.hidden = !r; if (r) { note.placeholder = r.r === 'fail' ? 'What went wrong?' : 'Optional note'; if (document.activeElement !== note) note.value = r.note ?? '' } }
  }

  // ── events ────────────────────────────────────────────────────────────────────
  _flush () { this._pendingNotes.forEach((fn) => fn.flush?.()); this._saveMsg?.flush?.(); this._pendingNotes.clear() }

  _click (e) {
    const b = e.target.closest?.('[data-act]'); if (!b || !this._b?.contains(b)) return
    const act = b.dataset.act
    if (act === 'res') {
      this._flush()
      const it = b.closest('[data-id]'); const id = it.dataset.id; const cur = Data.getResult(id)
      Data.setResult(id, cur?.r === b.dataset.r ? null : b.dataset.r, cur?.r === b.dataset.r ? undefined : (it.querySelector('[data-field="note"]').value || undefined))
      this._syncItem(it)
      if (Data.getResult(id)?.r === 'fail') it.querySelector('[data-field="note"]')?.focus?.()
    } else if (act === 'filter') { Data.setUi({ filter: b.dataset.filter }); this._render() }
    else if (act === 'hidedone') { /* handled on change */ }
    else if (act === 'answer') {
      const cur = Data.getAnswers()[b.dataset.ask]
      Data.setAnswer(b.dataset.ask, cur === b.dataset.value ? null : b.dataset.value)
      const now = Data.getAnswers()[b.dataset.ask]
      b.closest('.dcc-ask').querySelectorAll('[data-act="answer"]').forEach(x => { const on = now === x.dataset.value; x.classList.toggle('is-on', on); x.setAttribute('aria-pressed', on ? 'true' : 'false') })
    } else if (act === 'copy') this._copy()
    else if (act === 'download') this._download()
    else if (act === 'reset') this._reset(b)
  }

  _input (e, isChange = false) {
    const t = e.target
    if (t.matches?.('[data-act="hidedone"]')) { if (isChange) { Data.setUi({ hideDone: t.checked }); this._render() } return }
    if (t.matches?.('[data-field="attach"]')) { if (isChange) Data.setAttach(t.checked); return }
    if (t.matches?.('[data-field="message"]')) {
      if (!this._saveMsg) this._saveMsg = debounce(() => { const m = this._b?.querySelector('[data-field="message"]'); if (m) Data.setMessage(m.value) }, 300)
      this._saveMsg(); if (isChange) this._saveMsg.flush()
      return
    }
    if (t.matches?.('[data-field="note"]')) {
      const id = t.closest('[data-id]').dataset.id
      let d = this._pendingNotes.get(id)
      if (!d) { d = debounce(() => { const it = [...(this._b?.querySelectorAll('[data-id]') ?? [])].find(x => x.dataset.id === id); const el = it?.querySelector('[data-field="note"]'); if (el) Data.setNote(id, el.value) }, 300); this._pendingNotes.set(id, d) }
      d(); if (isChange) d.flush()
      return
    }
    if (t.matches?.('[data-field="answer"]')) {
      if (isChange) { Data.setAnswer(t.dataset.ask, t.value); const v = Data.getAnswers()[t.dataset.ask]; if (v === undefined && t.value !== '') t.value = '' }
    }
  }

  // ── report ────────────────────────────────────────────────────────────────────
  _device () {
    const nav = typeof navigator !== 'undefined' ? navigator : {}
    return { ua: nav.userAgent || '', w: window.innerWidth || 0, h: window.innerHeight || 0, dpr: window.devicePixelRatio || 1, touch: (nav.maxTouchPoints > 0) || ('ontouchstart' in window) }
  }

  /** The app state for the report: the DevOmniStoreSettings dump through its event, else a minimal own dump. */
  gatherState () {
    try {
      const detail = { out: null }
      window.dispatchEvent(new CustomEvent('omni:dev-dump-get', { detail }))
      if (typeof detail.out === 'string' && detail.out) return { state: JSON.parse(detail.out), source: 'devstore-dump' }
    } catch (_) { /* fall through to the minimal dump */ }
    let storeActive = null; let counts = null
    try { storeActive = Store.activeStoreId(); counts = { products: Store.getProducts().length, stores: Store.listStores().length } } catch (_) { /* no store model state */ }
    const d = this._device()
    return { state: Data.minimalDump({ userAgent: d.ua, viewport: [d.w, d.h], devicePixelRatio: d.dpr, storeActive, counts }), source: 'minimal' }
  }

  reportText () {
    this._flush()
    const withState = Data.getAttach()
    const g = withState ? this.gatherState() : { state: null, source: null }
    return Data.reportText({ device: this._device(), state: g.state, stateSource: g.source })
  }

  _say (text, kind = 'is-ok') { const m = this._b?.querySelector('[data-ref="report-msg"]'); if (m) { m.textContent = text; m.className = 'oss-msg ' + kind } }

  async _copy () {
    const text = this.reportText()
    const fb = this._b.querySelector('[data-ref="fallback"]')
    const ok = await copyText(text)
    if (ok) { fb.hidden = true; this._say(`Report copied (${text.length} characters). Paste it to Claude.`) } else {
      fb.hidden = false; fb.value = text
      try { fb.focus(); fb.select() } catch (_) { /* ignore */ }
      this._say('The clipboard is blocked here. Select the text below and copy it by hand.', 'is-err')
    }
    return ok
  }
  _download () {
    const text = this.reportText()
    const d = Data.getData()
    this._say(download(`claude-report-${d.version || 'v'}.json`, text) ? `Report downloaded (${text.length} characters).` : 'Download is not available here: use Copy report.', 'is-ok')
  }
  _reset (b) {
    if (!this._confirm) {
      this._confirm = true; b.classList.add('is-danger'); b.textContent = 'Click again to clear this version'
      clearTimeout(this._confirmT)
      this._confirmT = setTimeout(() => { this._confirm = false; b.classList.remove('is-danger'); b.textContent = "Reset this version's answers" }, 4000)
      return
    }
    this._confirm = false; clearTimeout(this._confirmT)
    Data.resetVersion(); this._open = null; this._render(); this._say('This version was reset.')
  }
}
