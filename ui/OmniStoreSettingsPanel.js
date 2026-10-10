/**
 * ui/OmniStoreSettingsPanel.js — ⟐OmniStoreSettings: the USER's panel for how their store looks (V177, Admin slot 19)
 *
 * USER side of the `<System>Settings` / `Dev<System>Settings` convention. It works entirely on its own: it imports
 * utils/OmniStoreSettings.js (data) and nothing from the dev side (utils/DevOmniStoreData.js, ui/DevOmniStoreSettingsPanel.js).
 *
 * Edits the CURRENT store's look (utils/OmniStoreSettings.js): name, colours (hover / selected selector, shelf rim / back /
 * planks), backdrop (none / solid / gradient + opacity), presets (4 built-in + the user's own), reset. Changes are applied
 * live: every picker change is debounced (60 ms) into one setSettings() patch; systems/OmniStoreScene.js listens to
 * omni:store-settings-changed and recolours the materials in place (no shelf rebuild). The layout row is read-only
 * V179: the Layout section is a selector (Shelf wall / Ring / Aisle / Island table, each with an icon and a one-line description);
 * a click switches the open store live and is saved per store (the layout is independent of the colour presets). The sandbox note is not editable.
 *
 * V178: two tabs, Look (everything above) and Catalog (ui/OmniStoreCatalogUI.js: guided AI-assisted import + manual product editing).
 * V182: a third tab, Stores (ui/OmniStoreStoresUI.js: your stores, open / rename / delete, + New store from a type), and a line on top that names the store
 *   the Look and Catalog tabs edit: the ACTIVE store (OmniStoreModel.activeStoreId). When the active store changes the inputs, the catalog list and the line follow;
 *   a queued colour change is saved to the store it was made for, never to the one switched to.
 *
 * Opened by omni:nav-select '⟐OmniStoreSettings' (drawer ⟐Admin slot 19, ribbon Realities > Value > Store Settings).
 * Dispatches (via the data module): omni:store-settings-changed; dispatches omni:store-open for the "Open store" button.
 * Listens: omni:store-state (to say whether the preview is visible), omni:store-settings-changed (keeps the inputs honest).
 */

import * as Look from '../utils/OmniStoreSettings.js'
import * as Layouts from '../utils/OmniStoreLayouts.js'
import OmniSettingsPanelBase, { esc, debounce, PHONE_MAX } from './OmniSettingsPanelBase.js'
import CatalogUI from './OmniStoreCatalogUI.js'
import StoresUI from './OmniStoreStoresUI.js'
import * as Store from '../utils/OmniStoreModel.js'

export const PANEL_ID = 'omnistoresettings'
export const NAV_ITEM = '⟐OmniStoreSettings'

const ICONS = {   // 28x28 line icons (currentColor): shelf rows, ring of dots, two facing runs, table
  shelf: '<svg viewBox="0 0 28 28" width="28" height="28" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="3" width="22" height="22" rx="1.5"/><path d="M3 10.3h22M3 17.7h22"/><rect x="6" y="5.5" width="3.5" height="3.5" fill="currentColor"/><rect x="12.2" y="5.5" width="3.5" height="3.5" fill="currentColor"/><rect x="18.5" y="5.5" width="3.5" height="3.5" fill="currentColor"/><rect x="6" y="12.9" width="3.5" height="3.5" fill="currentColor"/><rect x="18.5" y="12.9" width="3.5" height="3.5" fill="currentColor"/><rect x="12.2" y="20.2" width="3.5" height="3.5" fill="currentColor"/></svg>',
  ring: '<svg viewBox="0 0 28 28" width="28" height="28" aria-hidden="true" fill="currentColor" stroke="none"><circle cx="14" cy="4.5" r="2.3"/><circle cx="21.4" cy="7.6" r="2.3"/><circle cx="23.5" cy="14" r="2.3"/><circle cx="21.4" cy="20.4" r="2.3"/><circle cx="14" cy="23.5" r="2.3"/><circle cx="6.6" cy="20.4" r="2.3"/><circle cx="4.5" cy="14" r="2.3"/><circle cx="6.6" cy="7.6" r="2.3"/></svg>',
  aisle: '<svg viewBox="0 0 28 28" width="28" height="28" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M9 3 4 25M19 3l5 22"/><path d="M8 9.5h-3.6M7 15.5H3.2M6 21.5H2M20 9.5h3.6M21 15.5h3.8M22 21.5h4" stroke-width="2.6"/><path d="M14 8v3M14 14v3M14 20v3" stroke-dasharray="1 3"/></svg>',
  island: '<svg viewBox="0 0 28 28" width="28" height="28" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 12h22l-3 5H6z"/><path d="M14 17v7M9 24.5h10"/><rect x="7" y="5" width="3.5" height="3.5" fill="currentColor"/><rect x="12.2" y="3.5" width="3.5" height="3.5" fill="currentColor"/><rect x="17.5" y="5" width="3.5" height="3.5" fill="currentColor"/></svg>',
}
const LAYOUT_STYLES = `
.osp-loc-f { display: flex; flex: 1 1 90px; align-items: center; gap: 4px; min-width: 0; } .osp-loc-f .oss-input { width: 100%; min-width: 0; }
.osp-lay { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin: 4px 0; }
.osp-lay-card { display: flex; gap: 8px; align-items: flex-start; text-align: left; min-height: 56px; padding: 6px 8px; font: inherit; color: inherit; cursor: pointer; border-radius: 8px;
  background: rgba(255,255,255,.05); border: 1px solid var(--omni-theme-border, rgba(255,255,255,.18)); }
.osp-lay-card:hover { background: rgba(255,255,255,.12); }
.osp-lay-card[aria-checked="true"] { background: rgba(255,255,255,.2); border-color: rgba(255,255,255,.8); box-shadow: 0 0 0 1px rgba(255,255,255,.5); }
.osp-lay-card .osp-lay-ico { flex: 0 0 28px; opacity: .9; }
.osp-lay-card b { display: block; font-weight: bold; margin-bottom: 1px; }
.osp-lay-card span.osp-lay-d { font-size: 10px; line-height: 1.3; opacity: .78; }
@media (max-width: 700px) { .osp-lay { grid-template-columns: 1fr; } .osp-lay-card { min-height: 44px; } }
`
const COLOR_ROWS = ['hover', 'selected', 'shelfRim', 'shelfBack', 'shelfPlank']

export default class OmniStoreSettingsPanel extends OmniSettingsPanelBase {
  constructor () {
    super({ id: PANEL_ID, label: '⟐OmniStoreSettings', iconLabel: '⟐S', navItems: [NAV_ITEM], className: 'osp-panel', wide: true })
    this._cat = null
    this._stores = null
    this._pendingFor = null
    this._tab = 'look'
    this._pending = null
    this._storeOpen = false
    this._flush = debounce(() => this.flushPending(), 60)
  }

  onInit () {
    if (typeof document !== 'undefined' && !document.getElementById('osp-layout-styles')) { const st = document.createElement('style'); st.id = 'osp-layout-styles'; st.textContent = LAYOUT_STYLES; document.head.appendChild(st) }
    Look.attach()
    this._onChanged = () => { if (this._isOpen) this.refresh() }
    this._onStores = (e) => {   // V182: another store became the active one (or one was renamed / created / deleted)
      const k = e.detail?.kind
      if (k === 'active-store') { this.flushPending(); this._cat?.storeSwitched?.() }
      if (this._isOpen && (k === 'active-store' || (typeof k === 'string' && k.startsWith('store-')))) this.refresh()
    }
    this._onState = (e) => { this._storeOpen = !!e.detail?.open; if (this._isOpen) this._syncHint() }
    window.addEventListener(Look.CHANGED_EVENT, this._onChanged)
    window.addEventListener(Store.CHANGED_EVENT, this._onStores)
    window.addEventListener('omni:store-state', this._onState)
  }

  onDestroy () {
    this._flush.flush()
    this._cat?.destroy(); this._cat = null
    this._stores?.destroy(); this._stores = null
    window.removeEventListener(Look.CHANGED_EVENT, this._onChanged)
    window.removeEventListener(Store.CHANGED_EVENT, this._onStores)
    window.removeEventListener('omni:store-state', this._onState)
    Look.detach()
  }

  /** Queue a patch; merged with anything pending and applied after 60 ms of quiet (one event per burst). */
  queue (patch) {
    if (!this._pending) this._pendingFor = Look.currentStoreId()   // V182: the patch belongs to the store that was active when the user touched the control
    const p = this._pending ?? (this._pending = {})
    if (patch.name !== undefined) p.name = patch.name
    if (patch.colors) p.colors = { ...(p.colors ?? {}), ...patch.colors }
    if (patch.backdrop) p.backdrop = { ...(p.backdrop ?? {}), ...patch.backdrop }
    if (patch.anchor) p.anchor = [0, 1, 2].map(i => patch.anchor[i] ?? p.anchor?.[i] ?? null)   // null = this axis unchanged
    this._flush()
  }
  flushPending () {
    this._flush.flush()
    const p = this._pending
    this._pending = null
    if (p) Look.setSettings(p, this._pendingFor ?? undefined)
  }

  buildBody (body) {
    body.innerHTML = `
      <div class="osp-tabs oss-row" role="tablist" aria-label="Store settings"><button type="button" class="oss-btn is-on" role="tab" data-act="tab" data-tab="look" aria-selected="true">Look</button><button type="button" class="oss-btn" role="tab" data-act="tab" data-tab="catalog" aria-selected="false">Catalog</button><button type="button" class="oss-btn" role="tab" data-act="tab" data-tab="stores" aria-selected="false" data-omni-tip="Stores" data-omni-tip-key="—" data-omni-tip-desc="Your stores: open, rename or delete one, or start a new store from a type (bakery, electronics, produce, blank).">Stores</button></div>
      <div class="oss-dim" data-ref="editing" role="status" aria-live="polite"></div>
      <div data-tabpane="look">
      <div class="oss-dim" data-ref="store"></div>
      <div class="oss-row"><button type="button" class="oss-btn" data-act="open-store">Open store</button><button type="button" class="oss-btn" data-act="reset">Reset to default</button></div>
      <div class="oss-msg oss-dim" data-ref="hint"></div>
      <div class="oss-sec">Store name</div>
      <div class="oss-row"><input class="oss-input is-wide" type="text" maxlength="${Look.LIMITS.name}" data-field="name" placeholder="⟐OmniStore" aria-label="Store name"></div>
      <div class="oss-sec">Presets</div>
      <div class="oss-row" data-ref="presets"></div>
      <div class="oss-row"><input class="oss-input" type="text" maxlength="${Look.LIMITS.presetName}" data-field="presetName" placeholder="Preset name" aria-label="New preset name" style="flex:1"><button type="button" class="oss-btn" data-act="save-preset">Save current as…</button></div>
      <div class="oss-sec">Colours</div>
      ${COLOR_ROWS.map(k => `<div class="oss-row" data-color-row="${k}"><label>${esc(Look.COLOR_LABELS[k])}</label><input type="color" data-color="${k}" aria-label="${esc(Look.COLOR_LABELS[k])}"><input class="oss-input" type="text" maxlength="7" data-hex="${k}" aria-label="${esc(Look.COLOR_LABELS[k])} hex"></div>`).join('')}
      <div class="oss-sec">Backdrop</div>
      <div class="oss-row"><label>Mode</label><select class="oss-select" data-field="mode" aria-label="Backdrop mode"><option value="none">None (app wallpaper)</option><option value="solid">Solid colour</option><option value="gradient">Gradient</option></select></div>
      <div class="oss-row" data-ref="bd-color"><label data-ref="bd-color-label">Colour</label><input type="color" data-color="bd-color" aria-label="Backdrop colour"><input class="oss-input" type="text" maxlength="7" data-hex="bd-color" aria-label="Backdrop colour hex"></div>
      <div class="oss-row" data-ref="bd-color2"><label>Bottom colour</label><input type="color" data-color="bd-color2" aria-label="Backdrop bottom colour"><input class="oss-input" type="text" maxlength="7" data-hex="bd-color2" aria-label="Backdrop bottom colour hex"></div>
      <div class="oss-row" data-ref="bd-opacity"><label>Opacity <span data-ref="bd-opacity-n"></span></label><input type="range" min="0" max="100" step="1" data-field="opacity" aria-label="Backdrop opacity" style="flex:1 1 120px"></div>
      <div class="oss-sec">Layout</div>
      <div class="osp-lay" role="radiogroup" aria-label="Store layout" data-ref="layout">${Layouts.listLayouts().map(l => `<button type="button" class="osp-lay-card" role="radio" aria-checked="false" data-act="layout" data-layout="${l.id}" aria-label="${esc(l.name)}: ${esc(l.description)}"><span class="osp-lay-ico">${ICONS[l.id]}</span><span><b>${esc(l.name)}</b><span class="osp-lay-d">${esc(l.description)}</span></span></button>`).join('')}</div>
      <div class="oss-dim" style="font-size:10px">Switches the open store at once. Saved with this store; colour presets never change the layout.</div>
      <div class="oss-sec">Location</div>
      <div class="oss-row osp-loc" role="group" aria-label="Store location">${['x', 'y', 'z'].map(a => `<label class="osp-loc-f">${a.toUpperCase()}<input class="oss-input" type="number" step="1" min="${Look.ANCHOR_RANGE[a][0]}" max="${Look.ANCHOR_RANGE[a][1]}" inputmode="decimal" data-loc="${a}" aria-label="Store ${a.toUpperCase()} position" data-omni-tip="Store ${a.toUpperCase()}" data-omni-tip-key="—" data-omni-tip-desc="Where the store stands along the ${a.toUpperCase()} axis (${Look.ANCHOR_RANGE[a][0]} to ${Look.ANCHOR_RANGE[a][1]}). Changes apply to the open store at once."></label>`).join('')}</div>
      <div class="oss-row"><button type="button" class="oss-btn" data-act="loc-reset" data-omni-tip="Reset location" data-omni-tip-key="—" data-omni-tip-desc="Puts the store back at X 0, Y 3, Z -40.">Reset location</button><button type="button" class="oss-btn" data-act="loc-camera" data-omni-tip="Place at my camera" data-omni-tip-key="—" data-omni-tip-desc="Moves the store about 30 units in front of where the camera is looking, at the camera's height.">Place at my camera</button></div>
      <div class="oss-dim" style="font-size:10px">Moves the whole store; it keeps its shape. Default 0, 3, -40. X and Z reach &plusmn;500, Y reaches -200 to 300. Place at my camera puts it 30 units ahead of where you look.</div>
      <div class="oss-dim" style="margin-top:6px">SANDBOX: everything sold here is fake value. That note stays on the store and is not a setting.</div>
      <div class="oss-msg" role="status" aria-live="polite" data-ref="msg"></div>
      </div>
      <div data-tabpane="catalog" hidden data-ref="catalog"></div>
      <div data-tabpane="stores" hidden data-ref="stores"></div>`
    const q = (s) => body.querySelector(s)
    q('[data-field="name"]').addEventListener('input', (e) => this.queue({ name: e.target.value }))
    COLOR_ROWS.forEach(k => {
      q(`[data-color="${k}"]`).addEventListener('input', (e) => { q(`[data-hex="${k}"]`).value = e.target.value; this.queue({ colors: { [k]: e.target.value } }) })
      q(`[data-hex="${k}"]`).addEventListener('input', (e) => this._hexInput(e.target, () => ({ colors: { [k]: e.target.value } }), q(`[data-color="${k}"]`)))
    })
    ;[['bd-color', 'color'], ['bd-color2', 'color2']].forEach(([id, key]) => {
      q(`[data-color="${id}"]`).addEventListener('input', (e) => { q(`[data-hex="${id}"]`).value = e.target.value; this.queue({ backdrop: { [key]: e.target.value } }) })
      q(`[data-hex="${id}"]`).addEventListener('input', (e) => this._hexInput(e.target, () => ({ backdrop: { [key]: e.target.value } }), q(`[data-color="${id}"]`)))
    })
    q('[data-field="mode"]').addEventListener('change', (e) => { this.queue({ backdrop: { mode: e.target.value } }); this.flushPending() })
    q('[data-field="opacity"]').addEventListener('input', (e) => { q('[data-ref="bd-opacity-n"]').textContent = e.target.value + '%'; this.queue({ backdrop: { opacity: (+e.target.value) / 100 } }) })
    ;['x', 'y', 'z'].forEach((a, i) => {
      const inp = q(`[data-loc="${a}"]`)
      inp.addEventListener('input', () => { const v = Look.clampAxis(i, inp.value); if (v !== null) this.queue({ anchor: [0, 1, 2].map(j => j === i ? v : null) }) })   // empty / "-" while typing: nothing yet
      inp.addEventListener('change', () => { this.flushPending(); inp.value = String(Look.getSettings().anchor[i]) })              // show the clamped value the store really has
    })
    body.addEventListener('click', (e) => this._onClick(e))
  }

  /** A hex text box: valid -> apply and sync the colour swatch; invalid -> flag it and change nothing. */
  _hexInput (input, patchFn, swatch) {
    const h = Look.normalizeHex(input.value)
    input.style.borderColor = h ? '' : '#ff8a8a'
    input.setAttribute('aria-invalid', h ? 'false' : 'true')
    if (!h) return
    swatch.value = h
    this.queue(patchFn())
  }

  _onClick (e) {
    const b = e.target.closest?.('[data-act]')
    if (!b) return
    const act = b.dataset.act
    if (act === 'tab') { this.setTab(b.dataset.tab); return }
    const msg = (t, cls = '') => { const m = this.body.querySelector('[data-ref="msg"]'); m.textContent = t; m.className = 'oss-msg ' + cls }
    if (act === 'loc-reset') { this.flushPending(); Look.resetAnchor(); msg('Store location reset to 0, 3, -40.', 'is-ok'); this.refresh(); return }
    if (act === 'loc-camera') { this.flushPending(); window.dispatchEvent(new CustomEvent('omni:store-place-at-camera')); const A = Look.getSettings().anchor; msg(`Store placed 30 units ahead of the camera: ${A.join(', ')}.`, 'is-ok'); this.refresh(); return }
    if (act === 'layout') { this.flushPending(); Look.setSettings({ layout: b.dataset.layout }); msg(`Layout: ${Layouts.getLayout(b.dataset.layout).name}`, 'is-ok'); this.refresh(); return }
    if (act === 'preset') { this.flushPending(); Look.applyPreset(b.dataset.id); msg(`Preset applied: ${Look.getPreset(b.dataset.id)?.name ?? ''}`, 'is-ok') }
    else if (act === 'delete-preset') { Look.deletePreset(b.dataset.id); msg('Preset deleted.', 'is-ok'); this.refresh() }
    else if (act === 'save-preset') {
      this.flushPending()
      const inp = this.body.querySelector('[data-field="presetName"]')
      const p = Look.savePreset(inp.value)
      if (p) { inp.value = ''; msg(`Saved preset "${p.name}".`, 'is-ok') } else msg(`Give the preset a name (max ${Look.LIMITS.presets} presets).`, 'is-err')
      this.refresh()
    } else if (act === 'reset') { this._pending = null; this._flush.flush(); Look.resetSettings(); msg('Look reset to the default (Market Wood). Your store name and layout stay.', 'is-ok'); this.refresh() }
    else if (act === 'open-store') window.dispatchEvent(new CustomEvent('omni:store-open', { detail: {} }))
  }

  /** 'look' | 'catalog' | 'stores'. The catalog and stores tabs are built on first use. */
  setTab (tab) {
    const body = this.body
    if (!body || !['look', 'catalog', 'stores'].includes(tab)) return
    this._tab = tab
    if (tab === 'stores' && !this._stores) { this._stores = new StoresUI({ isStoreOpen: () => this._storeOpen, onOpened: () => { if (window.innerWidth <= PHONE_MAX) this.minimize() } }); this._stores.mount(body.querySelector('[data-ref="stores"]')) }
    if (tab === 'catalog' && !this._cat) { this._cat = new CatalogUI({ onShowStore: () => { if (window.innerWidth <= PHONE_MAX) this.minimize() } }); this._cat.mount(body.querySelector('[data-ref="catalog"]')) }
    body.querySelectorAll('[data-tabpane]').forEach(p => { p.hidden = p.dataset.tabpane !== tab })
    body.querySelectorAll('[data-act="tab"]').forEach(t => { const on = t.dataset.tab === tab; t.classList.toggle('is-on', on); t.setAttribute('aria-selected', String(on)) })
    this._el.classList.toggle('osc-tall', tab === 'catalog')
    if (tab === 'catalog') this._cat.refresh()
    if (tab === 'stores') this._stores.refresh()
  }

  _syncHint () {
    const h = this.body?.querySelector('[data-ref="hint"]')
    if (h) h.textContent = this._storeOpen ? 'Live preview: changes show in the open store.' : 'The store is closed. Press "Open store" to see changes live.'
  }

  /** Put the current settings into the inputs (an input the user is typing in is left alone). */
  refresh () {
    const body = this.body
    if (!body) return
    const L = Look.getSettings()
    const set = (el, v) => { if (el && el !== document.activeElement && el.value !== v) el.value = v }
    const act = Store.listStores().find(x => x.active)
    body.querySelector('[data-ref="editing"]').textContent = act ? `Editing: ${act.emoji} ${act.name} (${act.typeLabel}). The Look and Catalog tabs change this store; pick another in the Stores tab.` : ''
    body.querySelector('[data-ref="store"]').textContent = act ? `Store: ${act.name}` : `Store: ${Look.currentStoreId()}`
    this._stores?.refresh()
    set(body.querySelector('[data-field="name"]'), L.name)
    COLOR_ROWS.forEach(k => { set(body.querySelector(`[data-color="${k}"]`), L.colors[k]); set(body.querySelector(`[data-hex="${k}"]`), L.colors[k]) })
    set(body.querySelector('[data-field="mode"]'), L.backdrop.mode)
    set(body.querySelector('[data-color="bd-color"]'), L.backdrop.color); set(body.querySelector('[data-hex="bd-color"]'), L.backdrop.color)
    set(body.querySelector('[data-color="bd-color2"]'), L.backdrop.color2); set(body.querySelector('[data-hex="bd-color2"]'), L.backdrop.color2)
    const pct = String(Math.round(L.backdrop.opacity * 100))
    set(body.querySelector('[data-field="opacity"]'), pct)
    body.querySelector('[data-ref="bd-opacity-n"]').textContent = pct + '%'
    const solid = L.backdrop.mode !== 'none'
    body.querySelector('[data-ref="bd-color"]').style.display = solid ? '' : 'none'
    body.querySelector('[data-ref="bd-color2"]').style.display = L.backdrop.mode === 'gradient' ? '' : 'none'
    body.querySelector('[data-ref="bd-opacity"]').style.display = solid ? '' : 'none'
    body.querySelector('[data-ref="bd-color-label"]').textContent = L.backdrop.mode === 'gradient' ? 'Top colour' : 'Colour'
    const active = Look.activePresetId()
    body.querySelector('[data-ref="presets"]').innerHTML = Look.getPresets().map(p =>
      `<span style="display:inline-flex;gap:2px"><button type="button" class="oss-btn${p.id === active ? ' is-on' : ''}" data-act="preset" data-id="${esc(p.id)}" aria-pressed="${p.id === active}" title="${p.builtin ? 'Built-in preset' : 'Your preset'}">${esc(p.name)}</button>${p.builtin ? '' : `<button type="button" class="oss-btn" data-act="delete-preset" data-id="${esc(p.id)}" aria-label="Delete preset ${esc(p.name)}" title="Delete preset">×</button>`}</span>`).join('')
    ;['x', 'y', 'z'].forEach((a, i) => set(body.querySelector(`[data-loc="${a}"]`), String(L.anchor[i])))
    const lay = L.layout
    body.querySelectorAll('[data-act="layout"]').forEach(c => c.setAttribute('aria-checked', String(c.dataset.layout === lay)))
    this._syncHint()
  }
}
