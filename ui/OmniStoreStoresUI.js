/**
 * ui/OmniStoreStoresUI.js — the "Stores" tab of the USER's ⟐OmniStoreSettings panel (V182, BuildOrder item 6)
 *
 * USER side: imports only the model, the store TYPES (data, user-safe), the settings and the layout names. It never imports a Dev* module (a test enforces it).
 * Mounted by ui/OmniStoreSettingsPanel.js into its Stores tab.
 *
 *   list     every store of the identity: emoji, name, type, product count, layout, [Open] [Rename] [Delete]; the ACTIVE store is marked (the Look and Catalog tabs edit it)
 *   + New    pick a store TYPE card (emoji, name, one plain line, layout name) -> a name (default: the type's name) -> Create (optionally open it now)
 *   Open     makes the store active (the open 3D store switches in place and the camera flies there); when the 3D store is closed it is opened too
 *   Rename   inline field. Delete: inline confirm with the product count; the last store cannot be deleted
 * Everything runs on utils/OmniStoreModel.js (createStore / renameStore / deleteStore / setActiveStore / listStores); it only draws and asks.
 */

import * as Store from '../utils/OmniStoreModel.js'
import * as Look from '../utils/OmniStoreSettings.js'
import * as Types from '../utils/OmniStoreTypes.js'
import * as Layouts from '../utils/OmniStoreLayouts.js'
import { esc } from './OmniSettingsPanelBase.js'

const STYLES = `
.ost .ost-row { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; padding: 6px 4px; border-bottom: 1px solid rgba(255,255,255,.1); }
.ost .ost-row.is-active { background: rgba(255,255,255,.07); border-radius: 8px; }
.ost .ost-em { flex: 0 0 auto; font-size: 22px; line-height: 1; width: 28px; text-align: center; }
.ost .ost-main { flex: 1 1 140px; min-width: 0; }
.ost .ost-main b { font-weight: bold; overflow-wrap: anywhere; }
.ost .ost-sub { display: block; font-size: 10px; opacity: .7; }
.ost .ost-badge { margin-left: 4px; padding: 0 5px; border-radius: 4px; font-size: 9px; background: #3aa45c; color: #fff; letter-spacing: .06em; }
.ost .ost-btns { display: flex; gap: 4px; flex-wrap: wrap; }
.ost .ost-confirm { flex: 1 1 100%; padding: 6px 8px; border: 1px solid rgba(255,138,138,.6); background: rgba(255,90,90,.1); border-radius: 6px; }
.ost .ost-types { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin: 4px 0; }
.ost .ost-type { display: flex; flex-direction: column; gap: 2px; text-align: left; min-height: 74px; padding: 6px 8px; font: inherit; color: inherit; cursor: pointer; border-radius: 8px; background: rgba(255,255,255,.05); border: 1px solid var(--omni-theme-border, rgba(255,255,255,.18)); }
.ost .ost-type:hover { background: rgba(255,255,255,.12); }
.ost .ost-type[aria-checked="true"] { background: rgba(255,255,255,.2); border-color: rgba(255,255,255,.8); box-shadow: 0 0 0 1px rgba(255,255,255,.5); }
.ost .ost-type .ost-te { font-size: 20px; line-height: 1.1; } .ost .ost-type b { font-weight: bold; } .ost .ost-type .ost-td { font-size: 10px; line-height: 1.3; opacity: .78; } .ost .ost-type .ost-tl { font-size: 9px; opacity: .65; text-transform: uppercase; letter-spacing: .06em; }
.ost [hidden] { display: none; }
@media (max-width: 700px) { .ost .ost-types { grid-template-columns: 1fr; } .ost .ost-type { min-height: 56px; } .ost .oss-btn { min-height: 36px; } }
`

function injectStyles () {
  if (typeof document === 'undefined' || document.getElementById('ost-styles')) return
  const s = document.createElement('style'); s.id = 'ost-styles'; s.textContent = STYLES; document.head.appendChild(s)
}

const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`

export default class OmniStoreStoresUI {
  /** @param {{isStoreOpen?: ()=>boolean, onOpened?: Function}} opts  isStoreOpen: is the 3D store open (Open then also opens it); onOpened runs after Open (the panel minimises itself on a phone) */
  constructor (opts = {}) {
    this.opts = opts
    this.root = null
    this.s = { creating: false, typeId: null, name: '', openNow: true, renaming: null, renameText: '', deleting: null, msg: '', msgCls: '' }
    this._onChanged = (e) => { if (this.root && e?.detail?.kind !== 'section' && e?.detail?.kind !== 'list' && e?.detail?.kind !== 'media') this.render() }
    this._inited = false
  }

  mount (container) {
    injectStyles()
    this.root = document.createElement('div')
    this.root.className = 'ost'
    container.appendChild(this.root)
    this.root.addEventListener('click', (e) => this._onClick(e))
    this.root.addEventListener('input', (e) => this._onInput(e))
    this.root.addEventListener('change', (e) => { if (e.target?.dataset?.field === 'open-now') this._onInput(e) })
    this.root.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target?.dataset?.field) { e.preventDefault(); if (e.target.dataset.field === 'new-name') this.create(); else if (e.target.dataset.field === 'rename') this.saveRename() } })
    window.addEventListener(Store.CHANGED_EVENT, this._onChanged)
    window.addEventListener(Look.CHANGED_EVENT, this._onChanged)   // a name or layout edited in the Look tab
    this._inited = true
    this.render()
  }

  destroy () {
    if (this._inited) { window.removeEventListener(Store.CHANGED_EVENT, this._onChanged); window.removeEventListener(Look.CHANGED_EVENT, this._onChanged) }
    this._inited = false
    this.root?.remove(); this.root = null
  }

  refresh () { if (this.root) this.render() }

  q (sel) { return this.root.querySelector(sel) }
  say (text, cls = '') { this.s.msg = text; this.s.msgCls = cls; const m = this.root && this.q('[data-ref="msg"]'); if (m) { m.textContent = text; m.className = 'oss-msg ' + cls } }

  render () {
    if (!this.root) return
    const s = this.s
    const list = Store.listStores()
    const st = Store.storageStats()
    const types = Types.listTypes()
    const full = list.length >= Store.STORE_LIMITS.perOwner
    const rows = list.map(x => {
      const lay = Layouts.getLayout(x.layout)
      const renaming = s.renaming === x.id
      const deleting = s.deleting === x.id
      return `<div class="ost-row${x.active ? ' is-active' : ''}" role="listitem" data-store="${esc(x.id)}">
        <span class="ost-em" aria-hidden="true">${esc(x.emoji)}</span>
        <span class="ost-main">${renaming
          ? `<input class="oss-input is-wide" type="text" maxlength="${Store.STORE_LIMITS.name}" data-field="rename" value="${esc(s.renameText)}" aria-label="New name for ${esc(x.name)}">`
          : `<b data-testid="store-name">${esc(x.name)}</b>${x.active ? '<span class="ost-badge">ACTIVE</span>' : ''}`}
          <span class="ost-sub">${esc(x.typeLabel)} · ${plural(x.products, 'product')} · ${esc(lay.name)}</span></span>
        <span class="ost-btns">${renaming
          ? `<button type="button" class="oss-btn" data-act="st-rename-save">Save</button><button type="button" class="oss-btn" data-act="st-rename-cancel">Cancel</button>`
          : `<button type="button" class="oss-btn${x.active ? ' is-on' : ''}" data-act="st-open" data-id="${esc(x.id)}" data-omni-tip="Open store" data-omni-tip-key="—" data-omni-tip-desc="Makes this your active store and shows it in the 3D scene. The Look and Catalog tabs then edit it.">Open</button>
             <button type="button" class="oss-btn" data-act="st-rename" data-id="${esc(x.id)}" data-omni-tip="Rename store" data-omni-tip-key="—" data-omni-tip-desc="Changes the store's name (also the title in the store HUD).">Rename</button>
             <button type="button" class="oss-btn" data-act="st-delete" data-id="${esc(x.id)}"${list.length <= 1 ? ' disabled' : ''} data-omni-tip="Delete store" data-omni-tip-key="—" data-omni-tip-desc="${list.length <= 1 ? 'You cannot delete your last store.' : 'Deletes the store, its products and its shopping lists. Your wallet is not touched.'}">Delete</button>`}</span>
        ${deleting ? `<div class="ost-confirm" role="alert">Delete “${esc(x.name)}” with ${plural(x.products, 'product')}? This cannot be undone. Your wallet stays as it is.
          <div class="oss-row"><button type="button" class="oss-btn is-danger" data-act="st-delete-yes" data-id="${esc(x.id)}">Delete store</button><button type="button" class="oss-btn" data-act="st-delete-no">Keep it</button></div></div>` : ''}
      </div>`
    }).join('')
    const sel = s.typeId ? types.find(t => t.id === s.typeId) : null
    const creator = s.creating ? `
      <div class="oss-sec">New store: pick a type</div>
      <div class="ost-types" role="radiogroup" aria-label="Store type">${types.map(t => `
        <button type="button" class="ost-type" role="radio" aria-checked="${t.id === s.typeId}" data-act="st-type" data-id="${esc(t.id)}" aria-label="${esc(t.label)}: ${esc(t.desc)}">
          <span class="ost-te" aria-hidden="true">${esc(t.emoji)}</span><b>${esc(t.label)}</b><span class="ost-td">${esc(t.desc)}</span><span class="ost-tl">${esc(Layouts.getLayout(t.layout).name)} · ${t.seed.products.length ? plural(t.seed.products.length, 'product') : 'no products'}</span>
        </button>`).join('')}</div>
      <div ${sel ? '' : 'hidden'} data-ref="new-form">
        <div class="oss-row"><label for="ost-new-name">Name</label><input id="ost-new-name" class="oss-input is-wide" type="text" maxlength="${Store.STORE_LIMITS.name}" data-field="new-name" value="${esc(s.name)}" aria-label="Name of the new store"></div>
        <div class="oss-row"><label><input type="checkbox" data-field="open-now"${s.openNow ? ' checked' : ''}> Open it now</label></div>
        <div class="oss-row"><button type="button" class="oss-btn is-on" data-act="st-create">Create store</button><button type="button" class="oss-btn" data-act="st-new-cancel">Cancel</button></div>
        <div class="oss-dim" style="font-size:10px">It is placed beside your other stores, with its own layout and colours (change them later in the Look tab). Sandbox: everything in it is fake value.</div>
      </div>
      ${sel ? '' : '<div class="oss-row"><button type="button" class="oss-btn" data-act="st-new-cancel">Cancel</button></div>'}` : ''
    this.root.innerHTML = `
      <div class="oss-dim">A store is a place with its own products, layout, colours and shopping list. You have <b data-testid="store-count">${list.length}</b> of ${Store.STORE_LIMITS.perOwner}. One wallet pays in all of them.</div>
      <div role="list" aria-label="Your stores" data-ref="list">${rows}</div>
      <div class="oss-row">${s.creating ? '' : `<button type="button" class="oss-btn" data-act="st-new"${full ? ' disabled' : ''} data-omni-tip="New store" data-omni-tip-key="—" data-omni-tip-desc="${full ? 'You have the maximum number of stores.' : 'Start a new store from a type: bakery, electronics, produce or blank.'}">+ New store</button>`}</div>
      ${creator}
      <div class="oss-msg" role="status" aria-live="polite" data-ref="msg"></div>
      <div class="oss-dim" style="font-size:10px">Saved on this device: ${(st.total / 1e6).toFixed(2)} MB of ${(st.max / 1e6).toFixed(0)} MB for all stores.</div>`
    const m = this.q('[data-ref="msg"]'); m.textContent = s.msg; m.className = 'oss-msg ' + s.msgCls
    if (s.renaming) { const i = this.q('[data-field="rename"]'); if (i) { i.focus(); i.select?.() } }
  }

  _onInput (e) {
    const f = e.target?.dataset?.field
    if (f === 'new-name') this.s.name = e.target.value
    else if (f === 'rename') this.s.renameText = e.target.value
    else if (f === 'open-now') this.s.openNow = !!e.target.checked
  }

  _onClick (e) {
    const b = e.target.closest?.('[data-act]')
    if (!b || b.disabled) return
    const act = b.dataset.act
    const s = this.s
    if (act === 'st-new') { s.creating = true; s.typeId = null; s.name = ''; s.msg = ''; s.msgCls = ''; this.render() }
    else if (act === 'st-new-cancel') { s.creating = false; s.typeId = null; this.render() }
    else if (act === 'st-type') { const t = Types.getType(b.dataset.id); s.typeId = t ? t.id : null; s.name = t ? t.label : ''; this.render(); this.q('[data-field="new-name"]')?.focus() }
    else if (act === 'st-create') this.create()
    else if (act === 'st-open') this.open(b.dataset.id)
    else if (act === 'st-rename') { const x = Store.listStores().find(y => y.id === b.dataset.id); s.renaming = b.dataset.id; s.renameText = x?.name ?? ''; s.deleting = null; this.render() }
    else if (act === 'st-rename-save') this.saveRename()
    else if (act === 'st-rename-cancel') { s.renaming = null; this.render() }
    else if (act === 'st-delete') { s.deleting = b.dataset.id; s.renaming = null; this.render() }
    else if (act === 'st-delete-no') { s.deleting = null; this.render() }
    else if (act === 'st-delete-yes') this.remove(b.dataset.id)
  }

  /** Create the store the user configured. Returns the model's result. */
  create () {
    const s = this.s
    if (!s.typeId) { this.say('Pick a store type first.', 'is-err'); return null }
    const res = Store.createStore({ typeId: s.typeId, name: s.name, activate: s.openNow })
    if (!res.ok) { this.say(res.errors[0], 'is-err'); return res }
    s.creating = false; s.typeId = null
    this.render()
    this.say(`Created “${res.store.name}”${s.openNow ? ' and switched to it' : ''}.${res.warnings.length ? ' ' + res.warnings[0] : ''}`, 'is-ok')
    if (s.openNow) this._showStore()
    return res
  }

  open (id) {
    const ok = Store.setActiveStore(id)
    if (!ok) { this.say('That store is not available.', 'is-err'); return false }
    this._showStore()
    this.render()
    const x = Store.listStores().find(y => y.id === id)
    this.say(`Now using “${x?.name ?? ''}”. The Look and Catalog tabs edit this store.`, 'is-ok')
    return true
  }
  /** Make sure the 3D store is showing (an open store switches by itself through omni:store-changed). */
  _showStore () {
    if (this.opts.isStoreOpen?.()) return
    window.dispatchEvent(new CustomEvent('omni:store-open', { detail: {} }))
    this.opts.onOpened?.()
  }

  saveRename () {
    const s = this.s
    if (!s.renaming) return false
    const ok = Store.renameStore(s.renaming, s.renameText)
    if (!ok) { this.say('Type a name for the store.', 'is-err'); return false }
    s.renaming = null
    this.render()
    this.say('Renamed.', 'is-ok')
    return true
  }

  remove (id) {
    const x = Store.listStores().find(y => y.id === id)
    const res = Store.deleteStore(id)
    this.s.deleting = null
    this.render()
    this.say(res.ok ? `Deleted “${x?.name ?? ''}”${res.switchedTo ? ' and switched to another store' : ''}.` : res.error, res.ok ? 'is-ok' : 'is-err')
    return res
  }
}
