/**
 * ui/OmniStoreCatalogUI.js — the "Catalog" tab of the USER's ⟐OmniStoreSettings panel (V178, BuildOrder item 3)
 *
 * USER side: imports only the schema / model / value utils (never a Dev* module; a test enforces it). Mounted by
 * ui/OmniStoreSettingsPanel.js into its Catalog tab. Everything runs locally: the description the user types, the pasted
 * AI answer and the catalog never leave the device (no network calls; the AI step happens OUTSIDE the app).
 *
 * GUIDED FLOW (accordion, one step open at a time, a check mark when a step is done)
 *   1 Describe your store  -> Copy AI prompt / Copy blank template / Download template .json   (Schema.buildAiPrompt / buildTemplate)
 *   2 Paste the AI's answer -> textarea or .json file; parsed tolerantly (Schema.extractJson); auto-check on paste
 *   3 Check                 -> Schema.validateCatalog -> preview table + counts + plain-language messages; "Copy fix-it prompt"
 *                              (Schema.buildFixPrompt) when something is wrong. NOTHING is applied yet.
 *   4 Import                -> Merge (add new, update same id / name) | Replace (inline confirm with counts) -> Store.importProducts;
 *                              one-step Undo (Store.rememberUndo, kept in memory AND in localStorage 'omni:store-undo-v1')
 * MANUAL: product list (search, 20 per page) with Edit / Duplicate / Delete (confirm), Add product, Delete all, Export catalog.
 *   The edit form validates live with Schema.validateProduct (the same rules as an import) and saves through
 *   Store.addProduct / updateProduct, so the open shelf updates through omni:store-changed.
 */

import * as Store from '../utils/OmniStoreModel.js'
import * as Value from '../utils/OmniValueModel.js'
import * as Schema from '../utils/OmniStoreCatalogSchema.js'
import { esc, debounce } from './OmniSettingsPanelBase.js'

export const PAGE_SIZE = 20
export const COUNT_CHIPS = [10, 25, 50, 100]
export const EMOJI_PICK = ['🍎', '🍌', '🍇', '🍓', '🍉', '🍑', '🍒', '🍍', '🥭', '🥝', '🍊', '🍋', '🥕', '🥦', '🌽', '🍅', '🥔', '🧅', '🥬', '🍆', '🥑', '🍞', '🥐', '🧀']

const STYLES = `
.osc .osc-step { border: 1px solid var(--omni-theme-border, rgba(255,255,255,.14)); border-radius: 8px; margin: 6px 0; overflow: hidden; }
.osc .osc-head { width: 100%; display: flex; align-items: center; gap: 8px; min-height: 34px; padding: 4px 8px; font: inherit; color: inherit; text-align: left; background: rgba(255,255,255,.05); border: 0; cursor: pointer; }
.osc .osc-num { flex: 0 0 auto; width: 20px; height: 20px; line-height: 20px; text-align: center; border-radius: 50%; background: rgba(255,255,255,.14); font-size: 10px; }
.osc .osc-step.is-done .osc-num { background: #3aa45c; color: #fff; }
.osc .osc-step.is-bad .osc-num { background: #c9473f; color: #fff; }
.osc .osc-title { flex: 1 1 auto; } .osc .osc-state { font-size: 10px; opacity: .7; }
.osc .osc-body { padding: 6px 8px 8px; }
.osc .osc-body[hidden], .osc [hidden] { display: none; }
.osc .osc-chip[aria-pressed="true"] { background: rgba(255,255,255,.26); border-color: rgba(255,255,255,.75); }
.osc .osc-checks { display: flex; flex-wrap: wrap; gap: 4px 10px; } .osc .osc-checks label { display: inline-flex; align-items: center; gap: 4px; min-height: 28px; cursor: pointer; }
.osc .osc-ta { white-space: pre-wrap; min-height: 64px; }
.osc .osc-scroll { max-height: 220px; overflow: auto; border: 1px solid rgba(255,255,255,.1); border-radius: 6px; margin-top: 4px; }
.osc table { width: 100%; border-collapse: collapse; font-size: 10px; }
.osc td, .osc th { padding: 3px 4px; text-align: left; vertical-align: top; font-weight: normal; border-bottom: 1px solid rgba(255,255,255,.08); }
.osc th { position: sticky; top: 0; background: rgba(30,30,38,.96); z-index: 1; }
.osc .osc-ok { color: #8fe3a2; } .osc .osc-warn { color: #ffd37a; } .osc .osc-error { color: #ff8a8a; }
.osc .osc-em { font-size: 16px; line-height: 1; }
.osc .osc-msgrow td { padding: 0 4px 4px 28px; }
.osc .osc-box { border: 1px solid rgba(255,138,138,.6); background: rgba(255,90,90,.1); border-radius: 6px; padding: 6px 8px; margin: 6px 0; }
.osc .osc-prow { display: flex; align-items: center; gap: 6px; padding: 3px 0; border-bottom: 1px solid rgba(255,255,255,.08); }
.osc .osc-prow .osc-pname { flex: 1 1 auto; min-width: 0; } .osc .osc-prow .osc-pname b { display: block; font-weight: normal; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.osc .osc-prow .osc-pname span { font-size: 9px; opacity: .65; }
.osc .osc-mini { min-height: 26px; padding: 1px 6px; }
.osc .osc-emojis { display: flex; flex-wrap: wrap; gap: 2px; } .osc .osc-emojis button { width: 28px; height: 28px; padding: 0; font-size: 16px; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.12); border-radius: 5px; cursor: pointer; }
.osc .osc-form label.osc-lbl { display: block; margin-top: 6px; font-size: 9px; opacity: .7; text-transform: uppercase; letter-spacing: .06em; }
.osc .osc-frow { display: flex; gap: 4px; align-items: center; margin: 3px 0; } .osc .osc-frow select { flex: 1 1 0; min-width: 0; } .osc .osc-frow input { width: 64px; }
.osc .osc-live { margin-top: 6px; min-height: 16px; }
@media (max-width: 700px) {
  .oss-panel.osp-panel.osc-tall { max-height: 56vh; }
  .osc .osc-mini { min-height: 36px; padding: 2px 8px; } .osc .osc-emojis button { width: 36px; height: 36px; } .osc .osc-scroll { max-height: 180px; }
}
`

function injectStyles () {
  if (typeof document === 'undefined' || document.getElementById('osc-styles')) return
  const s = document.createElement('style'); s.id = 'osc-styles'; s.textContent = STYLES; document.head.appendChild(s)
}

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
export function downloadText (name, text) {
  try {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
    const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
    return true
  } catch (_) { return false }
}

const STEPS = [[1, 'Describe your store'], [2, "Paste the AI's answer"], [3, 'Check'], [4, 'Import']]
const fmtN = (n) => String(+(+n).toFixed(4))

export default class OmniStoreCatalogUI {
  /** @param {{onShowStore?: Function}} opts  onShowStore runs after "Show in store" (the panel minimises itself on a phone so the shelf is visible) */
  constructor (opts = {}) {
    this.opts = opts
    this.root = null
    this.s = {
      open: 1, desc: '', count: 0, hint: '', accepted: new Set(),
      copied: false, extract: null, result: null, text: '', mode: 'merge', confirmReplace: false, last: null,
      search: '', page: 0, edit: null, confirm: null,
    }
    this._timers = new Set()
    this._check = debounce(() => this.check(), 250)
    this._onChanged = () => { if (this.root) { this.renderProducts(); this.renderApply() } }
    this._inited = false
  }

  mount (container) {
    injectStyles()
    this.root = document.createElement('div')
    this.root.className = 'osc'
    const types = this.payTypes()
    this.root.innerHTML = `
      <div class="oss-dim">Fill your store at scale: ask any AI assistant to write the product list, paste its answer here, check it, import it. Everything stays on this device; this app never sends your text anywhere.</div>
      ${STEPS.map(([n, title]) => `
      <section class="osc-step" data-step="${n}">
        <button type="button" class="osc-head" data-act="c-step" data-n="${n}" aria-expanded="false" aria-controls="osc-body-${n}"><span class="osc-num">${n}</span><span class="osc-title">${esc(title)}</span><span class="osc-state" data-ref="state-${n}"></span></button>
        <div class="osc-body" id="osc-body-${n}" data-body="${n}" hidden>${this._stepHtml(n, types)}</div>
      </section>`).join('')}
      <div class="oss-sec">Your products <span data-ref="pcount"></span></div>
      <div data-ref="plist-area">
        <div class="oss-row"><input class="oss-input" type="search" style="flex:1 1 120px" data-field="search" placeholder="Search products" aria-label="Search products"><button type="button" class="oss-btn" data-act="c-add">+ Add product</button></div>
        <div data-ref="plist"></div>
        <div class="oss-row" data-ref="pager"></div>
        <div class="oss-row"><button type="button" class="oss-btn" data-act="c-export">Export catalog</button><button type="button" class="oss-btn" data-act="c-delete-all">Delete all products</button></div>
        <div data-ref="pconfirm"></div>
      </div>
      <div data-ref="editor" hidden></div>
      <div class="oss-msg" role="status" aria-live="polite" data-ref="msg-p"></div>`
    container.appendChild(this.root)
    this.root.addEventListener('click', (e) => this._onClick(e))
    this.root.addEventListener('input', (e) => this._onInput(e))
    this.root.addEventListener('change', (e) => this._onChange(e))
    this.q('[data-field="file"]').addEventListener('change', (e) => this._onFile(e))
    const details = this.q('[data-ref="prompt-details"]')
    details.addEventListener('toggle', () => { if (details.open) this._fillPromptView() })
    window.addEventListener(Store.CHANGED_EVENT, this._onChanged)
    this._inited = true
    this.setStep(1)
    this.renderCheck(); this.renderApply(); this.renderProducts()
  }

  destroy () {
    this._check.flush()
    this._timers.forEach(t => clearTimeout(t)); this._timers.clear()
    if (this._inited) window.removeEventListener(Store.CHANGED_EVENT, this._onChanged)
    this._inited = false
    this.root?.remove(); this.root = null
  }

  /** Called when the tab becomes visible. */
  refresh () { if (this.root) { this.renderProducts(); this.renderApply() } }

  // ── helpers ──────────────────────────────────────────────────────────────────
  q (sel) { return this.root.querySelector(sel) }
  payTypes () { return Value.getTypes().filter(t => t.payable !== false) }
  ctx () { return { types: Value.getTypes(), sectionIds: Store.getSections().filter(s => s.kind !== 'media').map(s => s.id) } }
  msg (ref, text, cls = '') { const m = this.q(`[data-ref="${ref}"]`); if (m) { m.textContent = text; m.className = 'oss-msg ' + cls } }

  promptOpts (blank = false) {
    const s = this.s
    return { types: this.payTypes(), sections: Store.getSections(), description: s.desc, count: s.count, categoryHint: s.hint, acceptedTypes: [...s.accepted], blank }
  }
  promptText () { return Schema.buildAiPrompt(this.promptOpts()) }
  templateText () { return JSON.stringify(Schema.buildTemplate({ types: this.payTypes(), sections: Store.getSections(), acceptedTypes: [...this.s.accepted] }), null, 2) }
  fixPromptText () { const s = this.s; return Schema.buildFixPrompt({ result: s.result, extract: s.extract, text: s.text, types: this.payTypes() }) }
  exportText () { return JSON.stringify(Schema.exportCatalog(Store.getStore(), { type: 'general' }), null, 2) }

  _stepHtml (n, types) {
    if (n === 1) {
      return `
        <textarea class="oss-text osc-ta" data-field="desc" maxlength="${Schema.LIMITS.description}" aria-label="Describe your store" placeholder="What do you sell? e.g. a bakery with breads, pastries and drinks; prices in credits and flowers"></textarea>
        <div class="oss-row"><span class="oss-dim">How many products?</span>${COUNT_CHIPS.map(c => `<button type="button" class="oss-btn osc-chip" data-act="c-count" data-n="${c}" aria-pressed="false">${c}</button>`).join('')}</div>
        <div class="oss-row"><label for="osc-hint">Category hint (optional)</label><input id="osc-hint" class="oss-input" type="text" maxlength="${Schema.LIMITS.category}" data-field="hint" placeholder="e.g. bread"></div>
        <div class="oss-dim" style="margin-top:4px">Accepted payment forms (none ticked = the AI may use any):</div>
        <div class="osc-checks" data-ref="forms">${types.map(t => `<label><input type="checkbox" data-pay="${esc(t.id)}"> ${esc(t.emoji ?? '')} ${esc(t.name)}</label>`).join('')}</div>
        <div class="oss-row"><button type="button" class="oss-btn" data-act="c-copy-prompt">Copy AI prompt</button><button type="button" class="oss-btn" data-act="c-copy-template">Copy blank template</button><button type="button" class="oss-btn" data-act="c-dl-template">Download template .json</button></div>
        <details data-ref="prompt-details"><summary class="oss-dim" style="cursor:pointer">Show the prompt <span data-ref="plen"></span></summary><textarea class="oss-text" readonly data-ref="promptview" aria-label="The AI prompt" style="min-height:90px"></textarea></details>
        <div class="oss-msg" role="status" aria-live="polite" data-ref="msg-1"></div>
        <div class="oss-dim">Paste the prompt into any AI assistant, then continue with step 2.</div>`
    }
    if (n === 2) {
      return `
        <div class="oss-dim">Paste the assistant's whole reply. Text around the JSON, code fences and a bare product list are fine.</div>
        <textarea class="oss-text osc-ta" data-field="paste" spellcheck="false" aria-label="The AI's answer" placeholder="Paste the JSON answer here…" style="min-height:110px;white-space:pre"></textarea>
        <div class="oss-row"><label class="oss-btn" style="display:inline-flex;align-items:center;cursor:pointer;flex:0 0 auto">Load .json file…<input type="file" accept=".json,application/json,text/plain" data-field="file" style="display:none"></label><button type="button" class="oss-btn" data-act="c-check">Check</button><button type="button" class="oss-btn" data-act="c-clear">Clear</button></div>
        <div class="oss-msg" role="status" aria-live="polite" data-ref="msg-2"></div>`
    }
    if (n === 3) return '<div data-ref="check"></div>'
    return '<div data-ref="apply"></div>'
  }

  // ── steps ────────────────────────────────────────────────────────────────────
  setStep (n) {
    this.s.open = n
    this.root.querySelectorAll('.osc-step').forEach(sec => {
      const open = +sec.dataset.step === n
      sec.querySelector('.osc-body').hidden = !open
      sec.querySelector('.osc-head').setAttribute('aria-expanded', String(open))
    })
    this._marks()
  }
  _marks () {
    if (!this.root) return
    const s = this.s
    const done = { 1: s.copied, 2: !!s.extract?.ok, 3: !!s.result?.ok, 4: !!s.last }
    const bad = { 1: false, 2: !!s.extract && !s.extract.ok, 3: !!s.result && !s.result.ok, 4: false }
    this.root.querySelectorAll('.osc-step').forEach(sec => {
      const k = +sec.dataset.step
      sec.classList.toggle('is-done', !!done[k] && !bad[k]); sec.classList.toggle('is-bad', !!bad[k])
      sec.querySelector('.osc-num').textContent = bad[k] ? '!' : (done[k] ? '✓' : String(k))
      sec.querySelector(`[data-ref="state-${k}"]`).textContent = bad[k] ? 'needs attention' : (done[k] ? 'done' : '')
    })
  }

  _fillPromptView () {
    const t = this.promptText()
    this.q('[data-ref="promptview"]').value = t
    this.q('[data-ref="plen"]').textContent = `(${t.length.toLocaleString('en-US')} characters)`
    return t
  }

  async _copy (what) {
    const text = what === 'prompt' ? this._fillPromptView() : (what === 'template' ? this.templateText() : this.fixPromptText())
    return { ok: await copyText(text), text }
  }

  /** Read the pasted text (tolerant parse), validate it, show the preview. Applies nothing. */
  check () {
    const s = this.s
    const text = this.q('[data-field="paste"]').value
    s.text = text; s.confirmReplace = false; s.last = null
    if (!text.trim()) { s.extract = null; s.result = null; this.msg('msg-2', ''); this.renderCheck(); this.renderApply(); this._marks(); return null }
    const ex = Schema.extractJson(text)
    s.extract = ex
    s.result = ex.ok ? Schema.validateCatalog(ex.value, this.ctx()) : null
    this.msg('msg-2', ex.ok ? (s.result.ok ? `Read ${s.result.counts.total} product(s). See step 3.` : 'The JSON was read but nothing can be imported yet. See step 3.') : 'This is not readable JSON yet. See step 3.', ex.ok && s.result.ok ? 'is-ok' : 'is-err')
    this.renderCheck(); this.renderApply()
    this.setStep(3)
    return s.result ?? ex
  }

  renderCheck () {
    const el = this.q('[data-ref="check"]')
    const s = this.s
    if (!s.extract) { el.innerHTML = '<div class="oss-dim">Nothing to check yet. Paste the AI\'s answer in step 2; it is checked automatically.</div>'; return }
    const notes = (s.extract.notes ?? []).map(n => `<div class="oss-dim">${esc(n)}</div>`).join('')
    if (!s.extract.ok) {
      el.innerHTML = `${notes}<div class="osc-box" role="alert"><b class="osc-error">This is not valid JSON</b>${s.extract.errors.map(e => `<div class="osc-error">${esc(e)}</div>`).join('')}</div>
        <div class="oss-row"><button type="button" class="oss-btn" data-act="c-copy-fix">Copy fix-it prompt</button></div>
        <div class="oss-dim">Paste the fix-it prompt back to the AI; it lists exactly what to repair. Then paste its new answer in step 2.</div><div class="oss-msg" role="status" aria-live="polite" data-ref="msg-3"></div>`
      return
    }
    const r = s.result
    const acc = new Map(r.accepted.map(p => [p.id, p]))
    const raws = Array.isArray(s.extract.value?.products) ? s.extract.value.products : []
    const types = new Map(Value.getTypes().map(t => [t.id, t]))
    const forms = (p) => p ? p.price.map(f => `${esc(types.get(f.type)?.emoji ?? f.type + ' ')}${fmtN(f.qty)}${f.quality ? ` <span class="oss-dim">${esc(f.quality)}</span>` : ''}`).join(' · ') : '—'
    const mark = { ok: '✓', warn: '!', error: '✗' }
    const rows = r.products.map(row => {
      const p = acc.get(row.id)
      const raw = raws[row.index]
      const emoji = p ? p.emoji : (typeof raw?.emoji === 'string' ? raw.emoji.slice(0, 8) : '')
      const msgs = [...row.errors.map(m => `<div class="osc-error">${esc(Schema.plainMessage(m))}</div>`), ...row.warnings.map(m => `<div class="osc-warn">${esc(Schema.plainMessage(m))}</div>`)].join('')
      return `<tr data-row="${row.index}" data-status="${row.status}"><td class="osc-${row.status}" title="${row.status}" aria-label="${row.status}">${mark[row.status]}</td><td><span class="osc-em">${esc(emoji)}</span> ${esc(row.name || '—')}<div class="oss-dim">${esc(p?.category ?? '')}${p ? ` · ${esc(p.shape)}` : ''}</div></td><td>${forms(p)}</td><td>${p ? fmtN(p.stock) : ''}</td></tr>${msgs ? `<tr class="osc-msgrow"><td colspan="4">${msgs}</td></tr>` : ''}`
    }).join('')
    const head = r.errors.length
      ? `<div class="osc-box" role="alert">${r.errors.map(e => `<div class="osc-error">${esc(Schema.plainMessage(e))}</div>`).join('')}</div>`
      : `<div data-ref="counts"><b>${r.counts.total}</b> product(s): <span class="osc-ok">${r.counts.ok} ready</span> · <span class="osc-warn">${r.counts.warn} with notes</span> · <span class="osc-error">${r.counts.error} with problems (skipped)</span></div>`
    const globals = r.warnings.length ? `<div class="osc-warn">${r.warnings.map(w => esc(Schema.plainMessage(w))).join('<br>')}</div>` : ''
    const fixBtn = r.errors.length || r.counts.error ? '<div class="oss-row"><button type="button" class="oss-btn" data-act="c-copy-fix">Copy fix-it prompt</button><span class="oss-dim">Gives the AI the exact problems so it can return a corrected list.</span></div>' : ''
    el.innerHTML = `${notes}${head}${globals}${rows ? `<div class="osc-scroll"><table data-testid="preview"><thead><tr><th></th><th>Product</th><th>Pays with</th><th>Stock</th></tr></thead><tbody>${rows}</tbody></table></div>` : ''}${fixBtn}${r.ok ? '<div class="oss-row"><button type="button" class="oss-btn" data-act="c-to-import">Continue to import</button></div>' : ''}<div class="oss-msg" role="status" aria-live="polite" data-ref="msg-3"></div><div class="oss-dim">Nothing has been applied yet.</div>`
  }

  renderApply () {
    const el = this.q('[data-ref="apply"]')
    if (!el) return
    const s = this.s
    const r = s.result
    const undo = Store.getUndo()
    let html = ''
    if (r?.ok && !s.last) {
      const pv = Store.previewImport(r.accepted, { mode: s.mode, matchBy: 'id+name' })
      const n = r.accepted.length
      html += `<div class="oss-row" role="radiogroup" aria-label="Import mode">
          <label><input type="radio" name="osc-mode" value="merge" data-field="mode"${s.mode === 'merge' ? ' checked' : ''}> Merge <span class="oss-dim">(add new, update products with the same id or name)</span></label>
          <label><input type="radio" name="osc-mode" value="replace" data-field="mode"${s.mode === 'replace' ? ' checked' : ''}> Replace <span class="oss-dim">(the catalog becomes exactly this list)</span></label></div>
        <div data-ref="plan">${s.mode === 'merge' ? `Adds <b>${pv.add}</b>, updates <b>${pv.update}</b>. Nothing is removed.` : `Adds <b>${pv.add}</b>, updates <b>${pv.update}</b> and <b class="osc-error">removes ${pv.remove}</b> current product(s) that are not in this list.`}${r.counts.error ? ` ${r.counts.error} problem row(s) will be skipped.` : ''}</div>`
      if (s.confirmReplace && s.mode === 'replace') {
        html += `<div class="osc-box" role="alertdialog" aria-label="Confirm replace"><b>Replace the whole catalog?</b><div>This removes <b>${pv.remove}</b> current product(s) and adds <b>${pv.add}</b> (updates ${pv.update}). You can undo once.</div>
          <div class="oss-row"><button type="button" class="oss-btn is-danger" data-act="c-import-go">Replace now</button><button type="button" class="oss-btn" data-act="c-import-cancel">Cancel</button></div></div>`
      } else html += `<div class="oss-row"><button type="button" class="oss-btn" data-act="c-import" data-testid="import">Import ${n} product${n === 1 ? '' : 's'}</button></div>`
    } else if (!s.last) html += '<div class="oss-dim">Nothing to import yet. Check your products in step 3 first.</div>'
    if (s.last) {
      const l = s.last
      html += `<div class="osc-ok" role="status" data-ref="done">Imported (${esc(l.mode)}): ${l.res.added} added, ${l.res.updated} updated, ${l.res.removed} removed. The store now has ${l.res.total} products.${l.skipped ? ` ${l.skipped} problem row(s) skipped.` : ''}
        <div class="oss-dim">Products go in the section(s) the answer named (default Physical). <button type="button" class="oss-btn osc-mini" data-act="c-open-store">Show in store</button></div></div>`
    }
    html += `<div class="oss-row"><button type="button" class="oss-btn" data-act="c-undo"${undo ? '' : ' disabled'}>Undo last import</button><span class="oss-dim">${undo ? `${esc(undo.label || 'last import')} · restores ${undo.products} product(s)${undo.persisted ? ' · kept after a reload' : ' · this session only (browser storage is full)'}. Edits made since are lost.` : 'Nothing to undo.'}</span></div>
      <div class="oss-msg" role="status" aria-live="polite" data-ref="msg-4"></div>`
    el.innerHTML = html
  }

  // ── products list ────────────────────────────────────────────────────────────
  filtered () {
    const q = this.s.search.trim().toLowerCase()
    const all = Store.getProducts()
    return q ? all.filter(p => (p.name + ' ' + p.category + ' ' + p.id).toLowerCase().includes(q)) : all
  }
  renderProducts () {
    if (!this.root) return
    const all = Store.getProducts()
    const list = this.filtered()
    const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE))
    if (this.s.page >= pages) this.s.page = pages - 1
    const slice = list.slice(this.s.page * PAGE_SIZE, (this.s.page + 1) * PAGE_SIZE)
    this.q('[data-ref="pcount"]').textContent = `(${all.length}${list.length !== all.length ? `, ${list.length} match` : ''})`
    const c = this.s.confirm
    this.q('[data-ref="plist"]').innerHTML = slice.map(p => c?.kind === 'del' && c.id === p.id
      ? `<div class="osc-prow" data-pid="${esc(p.id)}"><div class="osc-pname"><b>Delete “${esc(p.name)}”?</b><span>This also removes it from shopping lists.</span></div><button type="button" class="oss-btn osc-mini is-danger" data-act="c-del-go" data-id="${esc(p.id)}">Delete</button><button type="button" class="oss-btn osc-mini" data-act="c-del-cancel">Keep</button></div>`
      : `<div class="osc-prow" data-pid="${esc(p.id)}"><span class="osc-em" aria-hidden="true">${esc(p.media.emoji)}</span><div class="osc-pname"><b>${esc(p.name)}</b><span>${esc(p.category)} · ${esc(p.shape)} · ${fmtN(p.stock)} in stock · ${p.price.length} form${p.price.length === 1 ? '' : 's'}</span></div><button type="button" class="oss-btn osc-mini" data-act="c-edit" data-id="${esc(p.id)}" aria-label="Edit ${esc(p.name)}">Edit</button><button type="button" class="oss-btn osc-mini" data-act="c-dup" data-id="${esc(p.id)}" aria-label="Duplicate ${esc(p.name)}">Copy</button><button type="button" class="oss-btn osc-mini" data-act="c-del" data-id="${esc(p.id)}" aria-label="Delete ${esc(p.name)}">Del</button></div>`).join('')
      || `<div class="oss-dim">${all.length ? 'No product matches the search.' : 'The store has no products. Add one, or import a list above.'}</div>`
    this.q('[data-ref="pager"]').innerHTML = pages > 1 ? `<button type="button" class="oss-btn osc-mini" data-act="c-prev"${this.s.page === 0 ? ' disabled' : ''}>‹ Prev</button><span class="oss-dim">Page ${this.s.page + 1} of ${pages}</span><button type="button" class="oss-btn osc-mini" data-act="c-next"${this.s.page >= pages - 1 ? ' disabled' : ''}>Next ›</button>` : ''
    this.q('[data-ref="pconfirm"]').innerHTML = c?.kind === 'all'
      ? `<div class="osc-box" role="alertdialog" aria-label="Confirm delete all"><b>Delete all ${all.length} products?</b><div>The shelf will be empty (and stay empty after a reload). You can add or import products again.</div><div class="oss-row"><button type="button" class="oss-btn is-danger" data-act="c-delall-go">Delete all</button><button type="button" class="oss-btn" data-act="c-del-cancel">Cancel</button></div></div>` : ''
  }

  // ── editor ───────────────────────────────────────────────────────────────────
  _blankDraft () {
    const t = this.payTypes()
    return { id: null, name: '', emoji: '🍎', category: '', sectionIds: [Store.getSections().find(s => s.kind !== 'media')?.id].filter(Boolean), shape: 'cube', image: '', video: '', active: 'emoji', price: [{ type: t[0]?.id ?? 'credits', qty: '1', quality: '' }], stock: '10', note: '' }
  }
  _draftFrom (p) {
    return { id: p.id, name: p.name, emoji: p.media.emoji, category: p.category, sectionIds: [...p.sectionIds], shape: p.shape, image: p.media.image ?? '', video: p.media.video ?? '', active: p.media.active, price: p.price.map(f => ({ type: f.type, qty: String(f.qty), quality: f.quality ?? '' })), stock: String(p.stock), note: p.note ?? '' }
  }
  openEditor (id) {
    const p = id ? Store.getProduct(id) : null
    if (id && !p) return
    this.s.edit = p ? this._draftFrom(p) : this._blankDraft()
    this.s.confirm = null
    this.q('[data-ref="plist-area"]').hidden = true
    const ed = this.q('[data-ref="editor"]')
    ed.hidden = false
    ed.innerHTML = this._editorHtml()
    this._syncEditor()
    ed.querySelector('[data-edit="name"]')?.focus?.()
  }
  closeEditor () {
    this.s.edit = null
    const ed = this.q('[data-ref="editor"]'); ed.hidden = true; ed.innerHTML = ''
    this.q('[data-ref="plist-area"]').hidden = false
    this.renderProducts()
  }
  _editorHtml () {
    const d = this.s.edit
    const secs = Store.getSections().filter(s => s.kind !== 'media')
    return `<div class="osc-form" role="group" aria-label="${d.id ? 'Edit product' : 'Add product'}">
      <div class="oss-row"><b>${d.id ? 'Edit product' : 'Add product'}</b><span style="flex:1"></span><button type="button" class="oss-btn osc-mini" data-act="c-ed-cancel">Cancel</button></div>
      <label class="osc-lbl" for="osc-e-name">Name</label><input id="osc-e-name" class="oss-input is-wide" type="text" maxlength="${Schema.LIMITS.name}" data-edit="name" value="${esc(d.name)}">
      <label class="osc-lbl" for="osc-e-emoji">Emoji</label><input id="osc-e-emoji" class="oss-input" type="text" maxlength="${Schema.LIMITS.emoji}" data-edit="emoji" value="${esc(d.emoji)}" style="width:80px">
      <div class="osc-emojis" role="group" aria-label="Emoji quick pick">${EMOJI_PICK.map(e => `<button type="button" data-act="c-ed-emoji" data-e="${e}" aria-label="Use ${e}">${e}</button>`).join('')}</div>
      <label class="osc-lbl" for="osc-e-cat">Category</label><input id="osc-e-cat" class="oss-input is-wide" type="text" list="osc-cats" maxlength="${Schema.LIMITS.category}" data-edit="category" value="${esc(d.category)}" placeholder="e.g. bread"><datalist id="osc-cats">${[...new Set(['fruit', 'vegetable', ...Store.getProducts().map(p => p.category)])].slice(0, 30).map(c => `<option value="${esc(c)}">`).join('')}</datalist>
      <label class="osc-lbl">Sections</label><div class="osc-checks">${secs.map(s => `<label><input type="checkbox" data-edit-sec="${esc(s.id)}"> ${esc(s.name)}</label>`).join('')}</div>
      <label class="osc-lbl" for="osc-e-shape">Shape</label><select id="osc-e-shape" class="oss-select" data-edit="shape"><option value="cube">cube</option><option value="disc">disc</option></select>
      <label class="osc-lbl" for="osc-e-img">Image link (https://…, optional)</label><input id="osc-e-img" class="oss-input is-wide" type="url" data-edit="image" value="${esc(d.image)}" placeholder="https://…">
      <label class="osc-lbl" for="osc-e-vid">Video link (https://…, optional)</label><input id="osc-e-vid" class="oss-input is-wide" type="url" data-edit="video" value="${esc(d.video)}" placeholder="https://…">
      <label class="osc-lbl">Shown on the shelf</label><div class="osc-checks" role="radiogroup" aria-label="Shown media">${['emoji', 'image', 'video'].map(k => `<label><input type="radio" name="osc-active" value="${k}" data-edit="active"> ${k}</label>`).join('')}</div>
      <label class="osc-lbl">Accepted exchange forms</label><div data-ref="frows"></div>
      <div class="oss-row"><button type="button" class="oss-btn osc-mini" data-act="c-ed-addform">+ Add form</button></div>
      <label class="osc-lbl" for="osc-e-stock">Stock</label><input id="osc-e-stock" class="oss-input" type="number" min="0" step="1" data-edit="stock" value="${esc(d.stock)}">
      <label class="osc-lbl" for="osc-e-note">Note (optional)</label><textarea id="osc-e-note" class="oss-text osc-ta" data-edit="note" maxlength="${Schema.LIMITS.note}" style="min-height:44px">${esc(d.note)}</textarea>
      <div class="osc-live" role="status" aria-live="polite" data-ref="live"></div>
      <div class="oss-row"><button type="button" class="oss-btn" data-act="c-ed-save" data-testid="save">Save</button><button type="button" class="oss-btn" data-act="c-ed-cancel">Cancel</button></div></div>`
  }
  _formRows () {
    const d = this.s.edit
    const types = Value.getTypes()
    const usable = types.filter(t => t.payable !== false || d.price.some(f => f.type === t.id))
    return d.price.map((f, i) => {
      const t = types.find(x => x.id === f.type)
      return `<div class="osc-frow" data-frow="${i}"><select class="oss-select" data-form="type" aria-label="Value type ${i + 1}">${usable.map(u => `<option value="${esc(u.id)}"${u.id === f.type ? ' selected' : ''}>${esc(u.emoji ?? '')} ${esc(u.name)}</option>`).join('')}${t ? '' : `<option value="${esc(f.type)}" selected>${esc(f.type)}</option>`}</select>
        <input class="oss-input" type="number" min="0" step="any" data-form="qty" value="${esc(f.qty)}" aria-label="Amount ${i + 1}">
        <select class="oss-select" data-form="quality" aria-label="Quality grade ${i + 1}"><option value="">default</option>${(t?.qualityScale ?? []).map(g => `<option value="${esc(g.id)}"${g.id === f.quality ? ' selected' : ''}>${esc(g.label)}</option>`).join('')}</select>
        <button type="button" class="oss-btn osc-mini" data-act="c-ed-delform" data-i="${i}" aria-label="Remove form ${i + 1}">×</button></div>`
    }).join('')
  }
  _syncEditor () {
    const d = this.s.edit
    if (!d) return
    const ed = this.q('[data-ref="editor"]')
    ed.querySelector('[data-edit="shape"]').value = d.shape
    ed.querySelectorAll('[data-edit-sec]').forEach(c => { c.checked = d.sectionIds.includes(c.dataset.editSec) })
    ed.querySelector('[data-ref="frows"]').innerHTML = this._formRows()
    this._syncActive()
    this._live()
  }
  /** Which media kinds the draft carries decides which "shown" choices are open (same rule as Store.setActiveMedia). */
  _syncActive () {
    const d = this.s.edit
    const has = { emoji: true, image: !!d.image.trim(), video: !!d.video.trim() }
    if (!has[d.active]) d.active = 'emoji'
    this.q('[data-ref="editor"]').querySelectorAll('[data-edit="active"]').forEach(r => { r.disabled = !has[r.value]; r.checked = r.value === d.active })
  }
  _draftRaw () {
    const d = this.s.edit
    const num = (t) => (String(t).trim() === '' ? NaN : Number(t))
    return {
      name: d.name, emoji: d.emoji, category: d.category, sectionIds: d.sectionIds, shape: d.shape,
      media: { emoji: d.emoji, image: d.image.trim() || null, video: d.video.trim() || null, active: d.active },
      price: d.price.map(f => ({ type: f.type, qty: num(f.qty), ...(f.quality ? { quality: f.quality } : {}) })),
      stock: num(d.stock), note: d.note.trim() ? d.note : '',
    }
  }
  _live () {
    const d = this.s.edit
    if (!d) return null
    const v = Schema.validateProduct(this._draftRaw(), this.ctx())
    const ed = this.q('[data-ref="editor"]')
    ed.querySelector('[data-ref="live"]').innerHTML = [...v.errors.map(m => `<div class="osc-error">${esc(Schema.plainMessage(m))}</div>`), ...v.warnings.map(m => `<div class="osc-warn">${esc(Schema.plainMessage(m))}</div>`)].join('') || '<div class="osc-ok">Looks good.</div>'
    ed.querySelector('[data-act="c-ed-save"]').disabled = !v.ok
    return v
  }
  saveEditor () {
    const d = this.s.edit
    if (!d) return null
    const v = this._live()
    if (!v?.ok) return v
    const raw = this._draftRaw()
    const res = d.id ? Store.updateProduct(d.id, raw) : Store.addProduct(raw)
    if (!res.ok) { this.q('[data-ref="live"]').innerHTML = res.errors.map(m => `<div class="osc-error">${esc(Schema.plainMessage(m))}</div>`).join(''); return res }
    this.closeEditor()
    this.msg('msg-p', d.id ? `Saved “${res.product.name}”.` : `Added “${res.product.name}”.`, 'is-ok')
    return res
  }

  // ── events ───────────────────────────────────────────────────────────────────
  _onInput (e) {
    const t = e.target
    const s = this.s
    if (t.matches('[data-field="desc"]')) { s.desc = t.value; s.copied = false; this._marks() }
    else if (t.matches('[data-field="hint"]')) { s.hint = t.value; s.copied = false; this._marks() }
    else if (t.matches('[data-field="paste"]')) this._check()
    else if (t.matches('[data-field="search"]')) { s.search = t.value; s.page = 0; this.renderProducts() }
    else if (t.matches('[data-edit]') && s.edit && t.dataset.edit !== 'active') {
      s.edit[t.dataset.edit] = t.value
      if (t.dataset.edit === 'image' || t.dataset.edit === 'video') this._syncActive()
      this._live()
    } else if (t.matches('[data-form]') && s.edit) this._formInput(t)
  }
  _onChange (e) {
    const t = e.target
    const s = this.s
    if (t.matches('[data-pay]')) { t.checked ? s.accepted.add(t.dataset.pay) : s.accepted.delete(t.dataset.pay); s.copied = false; this._marks() }
    else if (t.matches('[data-field="mode"]')) { s.mode = t.value; s.confirmReplace = false; this.renderApply() }
    else if (t.matches('[data-edit-sec]') && s.edit) { const id = t.dataset.editSec; s.edit.sectionIds = t.checked ? [...new Set([...s.edit.sectionIds, id])] : s.edit.sectionIds.filter(x => x !== id); this._live() }
    else if (t.matches('[data-edit="shape"]') && s.edit) { s.edit.shape = t.value; this._live() }
    else if (t.matches('[data-edit="active"]') && s.edit) { s.edit.active = t.value; this._live() }
    else if (t.matches('[data-form]') && s.edit) this._formInput(t)
  }
  _formInput (t) {
    const d = this.s.edit
    const f = d.price[+t.closest('[data-frow]').dataset.frow]
    if (!f) return
    f[t.dataset.form] = t.value
    if (t.dataset.form === 'type') { f.quality = ''; this.q('[data-ref="frows"]').innerHTML = this._formRows() }
    this._live()
  }
  _onFile (e) {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > Schema.LIMITS.rawChars) { this.msg('msg-2', `File is too large (${Math.round(f.size / 1024)} KB, limit ${Math.round(Schema.LIMITS.rawChars / 1024)} KB).`, 'is-err'); return }
    f.text().then(t => { this.q('[data-field="paste"]').value = t; this.msg('msg-2', `Loaded ${f.name}.`); this.check() }).catch(() => this.msg('msg-2', 'Could not read that file.', 'is-err'))
    e.target.value = ''
  }

  async _onClick (e) {
    const b = e.target.closest?.('[data-act^="c-"]')
    if (!b || b.disabled || !this.root.contains(b)) return
    e.stopPropagation()
    const act = b.dataset.act
    const s = this.s
    if (act === 'c-step') this.setStep(+b.dataset.n)
    else if (act === 'c-count') { const n = +b.dataset.n; s.count = s.count === n ? 0 : n; this.root.querySelectorAll('[data-act="c-count"]').forEach(x => x.setAttribute('aria-pressed', String(+x.dataset.n === s.count))); s.copied = false; this._marks() }
    else if (act === 'c-copy-prompt') {
      const r = await this._copy('prompt')
      if (r.ok) { s.copied = true; this._marks() } else this.q('[data-ref="prompt-details"]').open = true
      this.msg('msg-1', r.ok ? `AI prompt copied (${r.text.length.toLocaleString('en-US')} characters). Paste it into any AI assistant.` : 'Copy was blocked. The prompt is shown below: select it and copy by hand.', r.ok ? 'is-ok' : 'is-err')
    } else if (act === 'c-copy-template') {
      const r = await this._copy('template')
      if (r.ok) { s.copied = true; this._marks() }
      this.msg('msg-1', r.ok ? 'Blank template copied (schema + one example product).' : 'Copy was blocked. Use Download template instead.', r.ok ? 'is-ok' : 'is-err')
    } else if (act === 'c-dl-template') {
      const ok = downloadText('omni-store-template.json', this.templateText())
      if (ok) { s.copied = true; this._marks() }
      this.msg('msg-1', ok ? 'Template downloaded.' : 'Download is not available here.', ok ? 'is-ok' : 'is-err')
    } else if (act === 'c-check') { this._check.flush(); this.check() }
    else if (act === 'c-clear') { this.q('[data-field="paste"]').value = ''; this._check.flush(); this.check(); this.setStep(2) }
    else if (act === 'c-copy-fix') {
      const r = await this._copy('fix')
      this.msg('msg-3', r.ok ? `Fix-it prompt copied (${r.text.length.toLocaleString('en-US')} characters). Paste it back to the AI.` : 'Copy was blocked. The prompt is below: select it and copy by hand.', r.ok ? 'is-ok' : 'is-err')
      if (!r.ok) { const ta = document.createElement('textarea'); ta.className = 'oss-text'; ta.readOnly = true; ta.value = r.text; ta.setAttribute('aria-label', 'Fix-it prompt'); this.q('[data-ref="msg-3"]').after(ta) }
    } else if (act === 'c-to-import') this.setStep(4)
    else if (act === 'c-import') this.doImport()
    else if (act === 'c-import-go') this.doImport(true)
    else if (act === 'c-import-cancel') { s.confirmReplace = false; this.renderApply() }
    else if (act === 'c-undo') this.doUndo()
    else if (act === 'c-open-store') { window.dispatchEvent(new CustomEvent('omni:store-open', { detail: {} })); try { this.opts.onShowStore?.() } catch (_) { /* ignore */ } }
    else if (act === 'c-add') this.openEditor(null)
    else if (act === 'c-edit') this.openEditor(b.dataset.id)
    else if (act === 'c-dup') { const r = Store.duplicateProduct(b.dataset.id); this.msg('msg-p', r.ok ? `Duplicated as “${r.product.name}”.` : (r.errors?.[0] ?? 'Could not duplicate.'), r.ok ? 'is-ok' : 'is-err') }
    else if (act === 'c-del') { s.confirm = { kind: 'del', id: b.dataset.id }; this.renderProducts() }
    else if (act === 'c-del-go') { const ok = Store.removeProduct(b.dataset.id); s.confirm = null; this.renderProducts(); this.msg('msg-p', ok ? 'Product deleted.' : 'Already gone.', ok ? 'is-ok' : '') }
    else if (act === 'c-del-cancel') { s.confirm = null; this.renderProducts() }
    else if (act === 'c-delete-all') { s.confirm = { kind: 'all' }; this.renderProducts() }
    else if (act === 'c-delall-go') { const n = Store.removeAllProducts(); s.confirm = null; this.renderProducts(); this.msg('msg-p', `Deleted ${n} product(s).`, 'is-ok') }
    else if (act === 'c-prev') { s.page = Math.max(0, s.page - 1); this.renderProducts() }
    else if (act === 'c-next') { s.page++; this.renderProducts() }
    else if (act === 'c-export') {
      const text = this.exportText(); const dl = downloadText('omni-store-catalog.json', text); const cp = await copyText(text)
      this.msg('msg-p', `Exported ${Store.getProducts().length} product(s)${dl ? ' (file downloaded)' : ''}${cp ? ' and copied to the clipboard' : ''}${dl || cp ? '.' : ': neither download nor copy is available here.'}`, dl || cp ? 'is-ok' : 'is-err')
    } else if (act === 'c-ed-cancel') this.closeEditor()
    else if (act === 'c-ed-save') this.saveEditor()
    else if (act === 'c-ed-emoji') { s.edit.emoji = b.dataset.e; this.q('[data-edit="emoji"]').value = b.dataset.e; this._live() }
    else if (act === 'c-ed-addform') { if (s.edit.price.length < Schema.LIMITS.forms) { const t = this.payTypes()[0]; s.edit.price.push({ type: t?.id ?? 'credits', qty: '1', quality: '' }); this.q('[data-ref="frows"]').innerHTML = this._formRows(); this._live() } }
    else if (act === 'c-ed-delform') { s.edit.price.splice(+b.dataset.i, 1); this.q('[data-ref="frows"]').innerHTML = this._formRows(); this._live() }
  }

  /** Apply the checked catalog. Replace needs the inline confirm first (pass confirmed=true from it). */
  doImport (confirmed = false) {
    const s = this.s
    const r = s.result
    if (!r?.ok) { this.msg('msg-4', 'Check your products first (step 3).', 'is-err'); return null }
    if (s.mode === 'replace' && !confirmed) { s.confirmReplace = true; this.renderApply(); return null }
    const snap = Store.snapshotCatalog()
    const before = Store.getProducts().length
    const res = Store.importProducts(r.accepted, { mode: s.mode, name: r.store.name, matchBy: 'id+name' })
    s.confirmReplace = false
    if (!res.ok) { this.renderApply(); this.msg('msg-4', 'Import failed: ' + res.error, 'is-err'); return res }
    Store.rememberUndo(snap, `${s.mode} import of ${r.accepted.length} product(s) (store had ${before})`)
    s.last = { res, mode: s.mode, skipped: r.counts.error }
    this.renderApply(); this._marks(); this.renderProducts()
    return res
  }
  doUndo () {
    const res = Store.undoLast()
    this.s.last = null
    this.renderApply(); this._marks(); this.renderProducts()
    this.msg('msg-4', res.ok ? `Undone: the catalog is back to ${res.products} product(s).` : 'Nothing to undo.', res.ok ? 'is-ok' : 'is-err')
    return res
  }
}
