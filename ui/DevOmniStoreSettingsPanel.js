/**
 * ui/DevOmniStoreSettingsPanel.js — ⟐DevOmniStoreSettings: DEV ONLY (V177, ⟐Developer drawer slot 6)
 *
 * The DEV side of the `<System>Settings` / `Dev<System>Settings` convention: for the developer and Claude (testing,
 * handing over information, trying things across the app). It is NOT part of the user's store settings, and nothing in the
 * user's panel (ui/OmniStoreSettingsPanel.js) depends on it.
 *
 * Sections (collapsible):
 *   a) Store type records  (data only: layout other than 'shelf' is NOT built; the field exists for BuildOrder item 4)
 *   b) Catalog JSON        export / validate / import (merge | replace) with a preview BEFORE applying, undo of the last
 *                          import (one snapshot, kept in memory), "Copy AI prompt + schema" (a PROTOTYPE of item 3's
 *                          user-facing template; the user flow itself is not built)
 *   c) Test data & perf    items per page (6..60), grant sandbox value, reset sandbox ledger / store, live readout, Dump state
 *   d) Notes for Claude    free text, saved, included in Dump state
 * Data: utils/DevOmniStoreData.js ('omni:dev-store-v1'); schema + validator: utils/OmniStoreCatalogSchema.js (pure).
 * Live numbers come from the scene through the event omni:store-stats-get (the scene fills detail.out).
 */

import * as Dev from '../utils/DevOmniStoreData.js'
import * as Look from '../utils/OmniStoreSettings.js'
import * as Store from '../utils/OmniStoreModel.js'
import * as Value from '../utils/OmniValueModel.js'
import * as Schema from '../utils/OmniStoreCatalogSchema.js'
import OmniSettingsPanelBase, { esc, debounce } from './OmniSettingsPanelBase.js'

export const PANEL_ID = 'devomnistoresettings'
export const NAV_ITEM = '⟐DevOmniStoreSettings'

const STYLES = `
.dsp-panel .oss-body { padding-top: 4px; }
.dsp-det { border-bottom: 1px solid var(--omni-theme-border, rgba(255,255,255,.14)); padding: 2px 0; }
.dsp-det > summary { cursor: pointer; padding: 6px 0; letter-spacing: .06em; text-transform: uppercase; font-size: 10px; color: var(--omni-theme-text-dim, rgba(255,255,255,.7)); }
.dsp-table { width: 100%; border-collapse: collapse; font-size: 10px; }
.dsp-table th, .dsp-table td { padding: 2px 4px; text-align: left; border-bottom: 1px solid rgba(255,255,255,.08); vertical-align: top; font-weight: normal; }
.dsp-st-ok { color: #8fe3a2; } .dsp-st-warn { color: #ffd37a; } .dsp-st-error { color: #ff8a8a; }
.dsp-scroll { max-height: 190px; overflow-y: auto; border: 1px solid rgba(255,255,255,.1); border-radius: 6px; margin-top: 4px; }
.dsp-rec { border: 1px solid rgba(255,255,255,.12); border-radius: 8px; padding: 4px 8px; margin: 4px 0; }
.dsp-rec > summary { cursor: pointer; padding: 3px 0; }
.dsp-kv { display: grid; grid-template-columns: auto 1fr; gap: 2px 10px; }
`

function injectStyles () {
  if (typeof document === 'undefined' || document.getElementById('dsp-styles')) return
  const s = document.createElement('style'); s.id = 'dsp-styles'; s.textContent = STYLES; document.head.appendChild(s)
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

function download (name, text) {
  try {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
    const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
    return true
  } catch (_) { return false }
}

export default class DevOmniStoreSettingsPanel extends OmniSettingsPanelBase {
  constructor () {
    super({
      id: PANEL_ID, label: '⟐DevOmniStoreSettings', iconLabel: '⟐D', navItems: [NAV_ITEM], className: 'dsp-panel', devOnly: true, wide: true,
      bannerText: 'DEV ONLY — for testing and handing data to Claude; not part of the user\'s store settings',
    })
    this._undo = null          // one snapshot of the store taken right before the last import
    this._validated = null     // { text, result } of the last Validate
    this._confirm = null       // 'replace' | 'reset' while waiting for the second click
    this._timer = null
    this._saveNotes = debounce(() => Dev.setNotes(this.body.querySelector('[data-field="notes"]').value), 300)
  }

  onInit () {
    injectStyles()
    this._onDev = (e) => { if (this._isOpen && !this._selfEdit && e.detail?.key === 'records') this._renderRecords() }
    window.addEventListener(Dev.CHANGED_EVENT, this._onDev)
  }
  onDestroy () {
    this._saveNotes.flush(); this._stopTimer()
    window.removeEventListener(Dev.CHANGED_EVENT, this._onDev)
  }
  onOpened () { this._startTimer() }
  close () { super.close(); this._stopTimer() }

  _startTimer () { if (this._timer || typeof setInterval !== 'function') return; this._timer = setInterval(() => { if (this._isOpen) this._renderStats() }, 1000) }
  _stopTimer () { if (this._timer) { clearInterval(this._timer); this._timer = null } }

  buildBody (body) {
    body.innerHTML = `
      <details class="dsp-det" data-sec="records"><summary>a) Store type records <span class="oss-dim">(data only)</span></summary>
        <div class="oss-dim">Layouts other than <b>shelf</b> are NOT built yet (BuildOrder item 4); the field exists so that item can read it. Record #1 is the current produce store.</div>
        <div data-ref="records"></div>
        <div class="oss-row"><button type="button" class="oss-btn" data-act="rec-add">+ Add record</button></div>
        <div class="oss-sec">JSON view</div>
        <textarea class="oss-text" data-field="records-json" spellcheck="false" aria-label="Store type records as JSON"></textarea>
        <div class="oss-row"><button type="button" class="oss-btn" data-act="rec-json">Apply JSON</button><button type="button" class="oss-btn" data-act="rec-copy">Copy JSON</button></div>
        <div class="oss-msg" role="status" data-ref="rec-msg"></div>
      </details>
      <details class="dsp-det" data-sec="catalog" open><summary>b) Catalog JSON <span class="oss-dim">(${esc(Schema.SCHEMA_ID)})</span></summary>
        <textarea class="oss-text" data-field="catalog" spellcheck="false" placeholder="Export the current catalog here, or paste a catalog and press Validate." aria-label="Catalog JSON"></textarea>
        <div class="oss-row">
          <button type="button" class="oss-btn" data-act="cat-export">Export</button>
          <button type="button" class="oss-btn" data-act="cat-validate">Validate</button>
          <button type="button" class="oss-btn" data-act="cat-merge" disabled>Import (merge)</button>
          <button type="button" class="oss-btn" data-act="cat-replace" disabled>Import (replace)</button>
          <button type="button" class="oss-btn" data-act="cat-undo" disabled>Undo last import</button>
        </div>
        <div class="oss-row"><label class="oss-btn" style="display:inline-flex;align-items:center;cursor:pointer">Load .json file…<input type="file" accept=".json,application/json" data-field="file" style="display:none"></label><button type="button" class="oss-btn" data-act="cat-prompt">Copy AI prompt + schema</button><span class="oss-dim">prototype of the later template</span></div>
        <div class="oss-msg" role="status" aria-live="polite" data-ref="cat-msg"></div>
        <div data-ref="preview"></div>
      </details>
      <details class="dsp-det" data-sec="test"><summary>c) Test data &amp; perf</summary>
        <div class="oss-row"><label>Items per page (${Dev.PER_PAGE_MIN}–${Dev.PER_PAGE_MAX})</label><input class="oss-input" type="number" min="${Dev.PER_PAGE_MIN}" max="${Dev.PER_PAGE_MAX}" step="1" data-field="perPage" aria-label="Items per page"><button type="button" class="oss-btn" data-act="perpage">Apply</button></div>
        <div class="oss-row"><select class="oss-select" data-field="grantType" aria-label="Value type"></select><input class="oss-input" type="number" min="0" step="any" value="100" data-field="grantQty" aria-label="Quantity"><button type="button" class="oss-btn" data-act="grant">Grant sandbox value</button><button type="button" class="oss-btn" data-act="starter">Starter pack</button></div>
        <div class="oss-row"><button type="button" class="oss-btn" data-act="reset-ledger">Reset sandbox ledger</button><button type="button" class="oss-btn" data-act="reset-store">Reset sandbox store</button></div>
        <div class="oss-sec">Live readout</div>
        <div class="dsp-kv" data-ref="stats"></div>
        <div class="oss-row"><button type="button" class="oss-btn" data-act="dump">Dump state (copy)</button></div>
        <textarea class="oss-text" data-field="dump" readonly spellcheck="false" aria-label="State dump" style="min-height:60px" placeholder="Dump state fills this and copies it."></textarea>
        <div class="oss-msg" role="status" aria-live="polite" data-ref="test-msg"></div>
      </details>
      <details class="dsp-det" data-sec="notes"><summary>d) Notes for Claude</summary>
        <div class="oss-dim">Free text you want Claude to know. Saved here, included in Dump state.</div>
        <textarea class="oss-text" data-field="notes" spellcheck="false" maxlength="${Dev.LIMITS.claudeNotes}" aria-label="Notes for Claude" style="white-space:pre-wrap;min-height:110px"></textarea>
      </details>`
    body.addEventListener('click', (e) => this._onClick(e))
    body.addEventListener('change', (e) => this._onChange(e))
    body.querySelector('[data-field="notes"]').addEventListener('input', () => this._saveNotes())
    body.querySelector('[data-field="catalog"]').addEventListener('input', () => { this._validated = null; this._syncImportButtons() })
    body.querySelector('[data-field="file"]').addEventListener('change', (e) => {
      const f = e.target.files?.[0]
      if (!f) return
      if (f.size > Schema.LIMITS.rawChars) { this._msg('cat-msg', `File is too large (${Math.round(f.size / 1024)} KB, limit ${Math.round(Schema.LIMITS.rawChars / 1024)} KB).`, 'is-err'); return }
      f.text().then(t => { body.querySelector('[data-field="catalog"]').value = t; this._validated = null; this._syncImportButtons(); this._msg('cat-msg', `Loaded ${f.name}. Press Validate.`) })
    })
  }

  _msg (ref, text, cls = '') { const m = this.body?.querySelector(`[data-ref="${ref}"]`); if (m) { m.textContent = text; m.className = 'oss-msg ' + cls } }
  _q (sel) { return this.body.querySelector(sel) }

  refresh () {
    const body = this.body
    if (!body) return
    this._renderRecords()
    const sel = this._q('[data-field="grantType"]')
    if (!sel.options.length) sel.innerHTML = Value.getTypes().map(t => `<option value="${esc(t.id)}">${esc(t.emoji)} ${esc(t.name)}</option>`).join('')
    const pp = this._q('[data-field="perPage"]'); if (pp !== document.activeElement) pp.value = String(Dev.getItemsPerPage())
    const notes = this._q('[data-field="notes"]'); if (notes !== document.activeElement) notes.value = Dev.getNotes()
    this._renderStats()
    this._syncImportButtons()
  }

  // ── a) records ───────────────────────────────────────────────────────────────
  _renderRecords () {
    const recs = Dev.getRecords()
    const presetIds = Look.getPresets().map(p => p.id)
    const known = new Set(presetIds)
    this._q('[data-ref="records"]').innerHTML = recs.map((r, i) => `
      <details class="dsp-rec" data-rec="${esc(r.id)}"><summary>#${i + 1} ${esc(r.name)} <span class="oss-dim">· ${esc(r.layout)}${Dev.LAYOUTS_BUILT.includes(r.layout) ? '' : ' (not built)'} · ${esc(r.productClass)}</span></summary>
        <div class="oss-row"><label>id</label><input class="oss-input" type="text" value="${esc(r.id)}" readonly aria-label="Record id"></div>
        <div class="oss-row"><label>name</label><input class="oss-input" type="text" maxlength="${Dev.LIMITS.name}" value="${esc(r.name)}" data-rec-field="name" aria-label="Record name"></div>
        <div class="oss-row"><label>layout</label><select class="oss-select" data-rec-field="layout" aria-label="Record layout">${Dev.LAYOUTS.map(l => `<option value="${l}"${l === r.layout ? ' selected' : ''}>${l}${Dev.LAYOUTS_BUILT.includes(l) ? '' : ' (not built)'}</option>`).join('')}</select></div>
        <div class="oss-row"><label>productClass</label><input class="oss-input" type="text" maxlength="${Dev.LIMITS.productClass}" value="${esc(r.productClass)}" data-rec-field="productClass" aria-label="Product class"></div>
        <div class="oss-row"><label>theme.colors</label><input class="oss-input" type="text" list="dsp-presets" value="${esc(r.theme.colors)}" data-rec-field="theme.colors" aria-label="Theme colours preset id">${known.has(r.theme.colors) ? '' : '<span class="dsp-st-warn">unknown preset id</span>'}</div>
        <div class="oss-row"><label>theme.backdrop</label><input class="oss-input" type="text" list="dsp-presets" value="${esc(r.theme.backdrop)}" data-rec-field="theme.backdrop" aria-label="Theme backdrop preset id">${known.has(r.theme.backdrop) ? '' : '<span class="dsp-st-warn">unknown preset id</span>'}</div>
        <div class="oss-row"><textarea class="oss-text" style="min-height:44px;white-space:pre-wrap" maxlength="${Dev.LIMITS.notes}" data-rec-field="notes" aria-label="Record notes">${esc(r.notes)}</textarea></div>
        <div class="oss-row"><button type="button" class="oss-btn" data-act="rec-del" data-id="${esc(r.id)}"${recs.length <= 1 ? ' disabled' : ''}>Delete record</button></div>
      </details>`).join('') + `<datalist id="dsp-presets">${presetIds.map(id => `<option value="${esc(id)}">`).join('')}</datalist>`
    const j = this._q('[data-field="records-json"]'); if (j !== document.activeElement) j.value = JSON.stringify(recs, null, 2)
  }

  // ── b) catalog ───────────────────────────────────────────────────────────────
  _ctx () {
    return { types: Value.getTypes(), sectionIds: Store.getSections().filter(s => s.kind !== 'media').map(s => s.id) }
  }
  _catalogText () { return this._q('[data-field="catalog"]').value }

  validate () {
    const text = this._catalogText()
    const result = Schema.validateCatalog(text, this._ctx())
    this._validated = { text, result }
    this._renderPreview(result)
    this._syncImportButtons()
    return result
  }

  _renderPreview (r) {
    const have = new Set(Store.getProducts().map(p => p.id))
    const upd = r.accepted.filter(p => have.has(p.id)).length
    const add = r.accepted.length - upd
    const gone = [...have].filter(id => !r.accepted.some(p => p.id === id)).length
    const head = r.errors.length
      ? `<div class="dsp-st-error">Rejected: ${r.errors.map(esc).join(' · ')}</div>`
      : `<div>Products: <b>${r.counts.total}</b> · <span class="dsp-st-ok">${r.counts.ok} ok</span> · <span class="dsp-st-warn">${r.counts.warn} with warnings</span> · <span class="dsp-st-error">${r.counts.error} rejected</span><br>
         Merge would add <b>${add}</b>, update <b>${upd}</b>. Replace would add ${add}, update ${upd}, remove <b>${gone}</b>. Nothing is applied until you press Import.</div>`
    const globals = r.warnings.length ? `<div class="dsp-st-warn">${r.warnings.map(esc).join('<br>')}</div>` : ''
    const rows = r.products.map(p => `<tr data-row="${p.index}"><td>${p.index + 1}</td><td>${esc(p.name || '—')}<div class="oss-dim">${esc(p.id ?? '')}</div></td><td class="dsp-st-${p.status}">${p.status}</td><td>${p.errors.map(m => `<div class="dsp-st-error">${esc(m)}</div>`).join('')}${p.warnings.map(m => `<div class="dsp-st-warn">${esc(m)}</div>`).join('')}</td></tr>`).join('')
    this._q('[data-ref="preview"]').innerHTML = head + globals + (rows ? `<div class="dsp-scroll"><table class="dsp-table" data-testid="preview"><thead><tr><th>#</th><th>Product</th><th>Status</th><th>Issues</th></tr></thead><tbody>${rows}</tbody></table></div>` : '')
  }

  _syncImportButtons () {
    if (!this.body) return
    const ok = !!this._validated && this._validated.text === this._catalogText() && this._validated.result.ok
    this._q('[data-act="cat-merge"]').disabled = !ok
    this._q('[data-act="cat-replace"]').disabled = !ok
    this._q('[data-act="cat-undo"]').disabled = !this._undo
    const rep = this._q('[data-act="cat-replace"]')
    rep.textContent = this._confirm === 'replace' ? 'Click again to REPLACE the catalog' : 'Import (replace)'
    rep.classList.toggle('is-danger', this._confirm === 'replace')
    const rs = this._q('[data-act="reset-store"]')
    rs.textContent = this._confirm === 'reset-store' ? 'Click again to reset the store' : 'Reset sandbox store'
    rs.classList.toggle('is-danger', this._confirm === 'reset-store')
    const rl = this._q('[data-act="reset-ledger"]')
    rl.textContent = this._confirm === 'reset-ledger' ? 'Click again to reset the ledger' : 'Reset sandbox ledger'
    rl.classList.toggle('is-danger', this._confirm === 'reset-ledger')
  }

  /** Apply the last VALIDATED catalog. Takes the undo snapshot first. mode: 'merge' | 'replace'. */
  applyImport (mode) {
    const v = this._validated
    if (!v || v.text !== this._catalogText() || !v.result.ok) { this._msg('cat-msg', 'Validate first: the text changed or has errors.', 'is-err'); return null }
    const snap = Store.snapshotCatalog()
    const res = Store.importProducts(v.result.accepted, { mode, name: v.result.store.name })
    if (!res.ok) { this._msg('cat-msg', 'Import failed: ' + res.error, 'is-err'); return res }
    this._undo = snap
    this._msg('cat-msg', `Imported (${mode}): ${res.added} added, ${res.updated} updated, ${res.removed} removed; ${res.total} products now. ${v.result.counts.error} rejected rows were skipped.`, 'is-ok')
    this._syncImportButtons()
    return res
  }

  undoImport () {
    if (!this._undo) return false
    Store.restoreCatalog(this._undo)
    this._undo = null
    this._msg('cat-msg', 'Last import undone.', 'is-ok')
    this._syncImportButtons()
    return true
  }

  exportText () { return JSON.stringify(Schema.exportCatalog(Store.getStore(), { type: Dev.getRecords()[0]?.productClass ?? 'produce' }), null, 2) }

  promptText () {
    return Schema.buildAiPrompt({ types: Value.getTypes(), sections: Store.getSections().filter(s => s.kind !== 'media') })
  }

  // ── c) stats / dump ──────────────────────────────────────────────────────────
  readStats () {
    const detail = { out: null }
    try { window.dispatchEvent(new CustomEvent('omni:store-stats-get', { detail })) } catch (_) { /* ignore */ }
    return detail.out
  }

  _renderStats () {
    const el = this.body?.querySelector('[data-ref="stats"]')
    if (!el) return
    const s = this.readStats()
    if (!s) { el.innerHTML = '<span class="oss-dim">Store scene not available.</span>'; return }
    const rows = [
      ['store open', s.open ? 'yes' : 'no'], ['products shown', `${s.productsShown} (section has ${s.productsInSection})`], ['page', `${s.page + 1}/${s.pages} · ${s.perPage} per page`],
      ['meshes (visible)', s.meshes], ['slots built', s.slotsBuilt], ['textures cached', s.texturesCached], ['active videos', s.activeVideos],
      ['draw calls', s.drawCalls ?? 'n/a'], ['triangles', s.triangles ?? 'n/a'], ['GPU geometries / textures', `${s.gpuGeometries ?? 'n/a'} / ${s.gpuTextures ?? 'n/a'}`], ['fps (scene update)', s.fps ?? 'n/a'], ['backdrop mesh', s.backdrop ? 'yes' : 'no'],
    ]
    el.innerHTML = rows.map(([k, v]) => `<span class="oss-dim">${esc(k)}</span><span data-stat="${esc(k)}">${esc(v)}</span>`).join('')
  }

  dumpState () {
    const prods = Store.getProducts()
    const dump = Dev.buildDump({
      settings: Look.getSettings(), presets: Look.getPresets().filter(p => !p.builtin),
      counts: {
        products: prods.length, sections: Store.getSections().length, listItems: Store.getList().length, withImage: prods.filter(p => p.media.image).length, withVideo: prods.filter(p => p.media.video).length,
        bySection: Object.fromEntries(Store.getSections().map(s => [s.id, Store.productsFor(s.id).length])), valueTypes: Value.getTypes().length, account: Value.currentAccountId(), balances: Value.getBalances(),
      },
      scene: this.readStats(),
    })
    return JSON.stringify(dump)
  }

  // ── events ───────────────────────────────────────────────────────────────────
  _arm (what) { this._confirm = what; this._syncImportButtons(); clearTimeout(this._confirmT); this._confirmT = setTimeout(() => { this._confirm = null; if (this._el) this._syncImportButtons() }, 4000) }

  async _onClick (e) {
    const b = e.target.closest?.('[data-act]')
    if (!b || b.disabled) return
    const act = b.dataset.act
    const confirmed = (what) => { if (this._confirm === what) { this._confirm = null; return true } this._arm(what); return false }
    if (act === 'rec-add') { Dev.addRecord(); this._msg('rec-msg', 'Record added.', 'is-ok') }
    else if (act === 'rec-del') { if (Dev.deleteRecord(b.dataset.id)) this._msg('rec-msg', 'Record deleted.', 'is-ok'); else this._msg('rec-msg', 'At least one record must stay.', 'is-err') }
    else if (act === 'rec-json') { const r = Dev.setRecordsFromJson(this._q('[data-field="records-json"]').value); this._msg('rec-msg', r.ok ? `Applied ${r.count} record(s)${r.dropped ? `, ${r.dropped} invalid dropped` : ''}.` : r.error, r.ok ? 'is-ok' : 'is-err'); this._renderRecords() }
    else if (act === 'rec-copy') this._msg('rec-msg', (await copyText(this._q('[data-field="records-json"]').value)) ? 'Copied.' : 'Copy failed: select the text and copy by hand.', 'is-ok')
    else if (act === 'cat-export') {
      const t = this.exportText(); this._q('[data-field="catalog"]').value = t; this._validated = null
      const c = await copyText(t); const d = download('omni-store-catalog.json', t)
      this._msg('cat-msg', `Exported ${Store.getProducts().length} products${d ? ' (file downloaded)' : ''}${c ? ' and copied to the clipboard' : ''}.`, 'is-ok'); this._syncImportButtons()
    } else if (act === 'cat-validate') { const r = this.validate(); this._msg('cat-msg', r.ok ? `Valid: ${r.accepted.length} product(s) can be imported.` : (r.errors[0] ?? `No product can be imported (${r.counts.error} rejected).`), r.ok ? 'is-ok' : 'is-err') }
    else if (act === 'cat-merge') this.applyImport('merge')
    else if (act === 'cat-replace') { if (confirmed('replace')) this.applyImport('replace'); else this._msg('cat-msg', 'Replace removes every product that is not in the import. Click again to confirm.') }
    else if (act === 'cat-undo') this.undoImport()
    else if (act === 'cat-prompt') this._msg('cat-msg', (await copyText(this.promptText())) ? 'AI prompt + schema copied. Paste it into any assistant, add your business, paste the JSON reply here.' : 'Copy failed; the prompt is in the box below.', 'is-ok')
    else if (act === 'perpage') { const v = Dev.setItemsPerPage(this._q('[data-field="perPage"]').value); this._q('[data-field="perPage"]').value = String(v); this._msg('test-msg', `Items per page: ${v}.`, 'is-ok') }
    else if (act === 'grant') { const t = this._q('[data-field="grantType"]').value, n = +this._q('[data-field="grantQty"]').value; this._msg('test-msg', Value.grant(t, n) ? `Granted ${n} ${t} (sandbox).` : 'Enter a positive quantity.', Value.getType(t) && n > 0 ? 'is-ok' : 'is-err') }
    else if (act === 'starter') { Value.grantStarterPack(); this._msg('test-msg', 'Starter pack granted (sandbox).', 'is-ok') }
    else if (act === 'reset-ledger') { if (confirmed('reset-ledger')) { Value.resetSandbox(); this._msg('test-msg', 'Sandbox ledger reset to the starter state.', 'is-ok') } }
    else if (act === 'reset-store') { if (confirmed('reset-store')) { Store.resetStore(); this._undo = null; this._msg('test-msg', 'Sandbox store reset to the seed (16 produce items).', 'is-ok') } }
    else if (act === 'dump') { const t = this.dumpState(); this._q('[data-field="dump"]').value = t; this._msg('test-msg', (await copyText(t)) ? `Dump copied (${t.length} characters). Paste it to Claude.` : 'Copy failed: select the dump below and copy by hand.', 'is-ok') }
    this._syncImportButtons()
  }

  _onChange (e) {
    const f = e.target.closest?.('[data-rec-field]')
    if (!f) return
    const card = f.closest('[data-rec]')
    const rec = Dev.getRecords().find(r => r.id === card.dataset.rec)
    if (!rec) return
    const k = f.dataset.recField
    if (k === 'theme.colors') rec.theme.colors = f.value
    else if (k === 'theme.backdrop') rec.theme.backdrop = f.value
    else rec[k] = f.value
    this._selfEdit = true   // the open card must not be rebuilt under the cursor
    try { Dev.saveRecord(rec) } finally { this._selfEdit = false }
  }
}
