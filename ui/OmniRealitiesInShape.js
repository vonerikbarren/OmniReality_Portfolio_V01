/**
 * ui/OmniRealitiesInShape.js — ⟐RealitiesInShape: every reality (node) in the scene that has one geometry (V191)
 *
 * Opened by a click on a shape in the OmniDock_Realities (ui/OmniDockRealities.js) through `omni:realities-in-shape-open { geometry }`.
 * A second request for the shape that is already shown closes the panel. It lists each node with that geometry: its name, its kind
 * (node / group / essence / store item / value / structural ...) and its id. A row click selects the node (omni:node-select-by-id, which
 * opens it in the Inspector) and flies the camera to it (omni:goto-mesh-request, the same event the Inspector uses). The list is live: it
 * follows omni:node-created / -deleted / -updated / omni:nodes-updated (debounced 100 ms), so a node added, removed or given another
 * geometry appears or disappears while the panel is open.
 *
 * Window-chrome class A (a window: resize + maximize through WindowManager.register in the shared OmniSettingsPanelBase shell).
 * Emits `omni:realities-in-shape-changed { geometry | null }` so the dock can show which shape is open.
 * Module contract: constructor / init / update / destroy / onResize. No Dev* import.
 */

import OmniSettingsPanelBase, { esc, debounce } from './OmniSettingsPanelBase.js'
import { GEOMETRY_LABELS, isGeometryId, listByGeometry, nodesPhrase, wireframeOf, projectWireframe, toPathData } from '../utils/OmniGeometryCensus.js'
import { IN_SHAPE_OPEN_EVENT, IN_SHAPE_CHANGED_EVENT, resolveSettings, loadOverrides } from '../utils/OmniDockRealitiesSettings.js'

export const PANEL_ID = 'omnirealitiesinshape'

const EXTRA_STYLES = `
.ors-panel { width: 360px; }
.ors-head { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.ors-head svg { flex: 0 0 34px; width: 34px; height: 34px; }
.ors-head svg path { fill: none; stroke: currentColor; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; }
.ors-title { font-weight: bold; } .ors-count { margin-left: auto; white-space: nowrap; }
.ors-filter { width: 100%; box-sizing: border-box; margin: 2px 0 6px; }
.ors-list { display: flex; flex-direction: column; gap: 3px; }
.ors-row { all: unset; box-sizing: border-box; display: flex; align-items: baseline; gap: 6px; padding: 5px 8px; min-height: 30px; cursor: pointer; border-radius: 6px; background: rgba(255,255,255,.05); border: 1px solid transparent; -webkit-tap-highlight-color: transparent; }
.ors-row:hover, .ors-row:focus-visible { background: rgba(255,255,255,.14); border-color: rgba(255,255,255,.35); }
.ors-name { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ors-kind { flex: 0 0 auto; font-size: 9px; padding: 0 5px; border-radius: 4px; background: rgba(255,255,255,.12); text-transform: uppercase; letter-spacing: .05em; }
.ors-id { flex: 0 0 auto; font-size: 9.5px; opacity: .6; max-width: 38%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ors-empty { padding: 14px 6px; text-align: center; opacity: .7; }
@media (max-width: 700px) { .ors-row { min-height: 44px; align-items: center; } .ors-panel { width: 100%; } }
`

export default class OmniRealitiesInShape extends OmniSettingsPanelBase {
  constructor (omniNode = null) {
    super({ id: PANEL_ID, label: '⟐RealitiesInShape', iconLabel: '⟐R', navItems: [], className: 'ors-panel' })
    this.omniNode = omniNode
    this._geo = null
    this._filter = ''
    this._rows = []
    this._h = {}
    this._soon = debounce(() => { if (this._isOpen) this.refresh() }, 100)
  }

  get geometry () { return this._geo }
  get rows () { return this._rows.map(r => ({ ...r })) }

  onInit () {
    if (typeof document !== 'undefined' && !document.getElementById('ors-styles')) {
      const st = document.createElement('style'); st.id = 'ors-styles'; st.textContent = EXTRA_STYLES; document.head.appendChild(st)
    }
    const h = this._h
    h.open = (e) => this.showShape(e?.detail?.geometry)
    h.nodes = () => this._soon()
    window.addEventListener(IN_SHAPE_OPEN_EVENT, h.open)
    for (const ev of ['omni:node-created', 'omni:node-deleted', 'omni:node-updated', 'omni:nodes-updated']) window.addEventListener(ev, h.nodes)
  }

  onDestroy () {
    const h = this._h
    window.removeEventListener(IN_SHAPE_OPEN_EVENT, h.open)
    for (const ev of ['omni:node-created', 'omni:node-deleted', 'omni:node-updated', 'omni:nodes-updated']) window.removeEventListener(ev, h.nodes)
    this._soon.flush()
    document.getElementById('ors-styles')?.remove()
  }

  /** Show a shape's list; the same shape again while open closes the panel. Unknown ids are ignored. */
  showShape (id) {
    if (!isGeometryId(id)) return false
    if (this._isOpen && this._geo === id) { this.close(); return true }
    this._geo = id
    this._filter = ''
    if (this.body) { const f = this.body.querySelector('.ors-filter'); if (f) f.value = '' }
    this.open()
    return true
  }

  open () {
    super.open()
    this._announceShape(this._geo)
  }

  close () {
    const was = this._isOpen
    super.close()
    if (was) this._announceShape(null)
  }

  _announceShape (g) {
    try { window.dispatchEvent(new CustomEvent(IN_SHAPE_CHANGED_EVENT, { detail: { geometry: g } })) } catch (_) { /* no window */ }
  }

  _nodes () { try { return this.omniNode?.getAllNodes?.() ?? [] } catch (_) { return [] } }

  buildBody (body) {
    body.innerHTML = `
      <div class="ors-head"><svg viewBox="0 0 40 40" aria-hidden="true"><path d=""/></svg><span class="ors-title"></span><span class="ors-count oss-dim"></span></div>
      <input class="oss-input ors-filter" type="search" placeholder="Filter by name, kind or id" aria-label="Filter the list">
      <div class="ors-list" role="list"></div>`
    body.querySelector('.ors-filter').addEventListener('input', (e) => { this._filter = String(e.target.value || '').toLowerCase(); this.refresh() })
    body.querySelector('.ors-list').addEventListener('click', (e) => {
      const row = e.target.closest?.('.ors-row'); if (row) this.goTo(row.dataset.id)
    })
  }

  refresh () {
    const body = this.body; if (!body || !this._geo) return
    const all = listByGeometry(this._nodes(), this._geo)
    const f = this._filter
    const rows = f ? all.filter(r => `${r.label} ${r.kind} ${r.id}`.toLowerCase().includes(f)) : all
    this._rows = rows
    const label = GEOMETRY_LABELS[this._geo]
    const color = resolveSettings(loadOverrides()).geo[this._geo]?.color
    const head = body.querySelector('.ors-head')
    head.style.color = color || ''
    head.querySelector('path').setAttribute('d', toPathData(projectWireframe(wireframeOf(this._geo), { size: 40, pad: 3 })))
    head.querySelector('.ors-title').textContent = label
    head.querySelector('.ors-count').textContent = f ? `${rows.length} of ${all.length}` : nodesPhrase(all.length)
    body.closest('.oss-panel')?.setAttribute('aria-label', `${label}: ${nodesPhrase(all.length)}`)
    const list = body.querySelector('.ors-list')
    list.innerHTML = rows.length
      ? rows.map(r => `<button type="button" class="ors-row" role="listitem" data-id="${esc(r.id)}" data-omni-tip="${esc(r.label)}" data-omni-tip-key="${esc(r.id)}" data-omni-tip-desc="Select this node and fly to it."><span class="ors-name">${esc(r.label)}</span><span class="ors-kind">${esc(r.kind)}</span><span class="ors-id">${esc(r.id)}</span></button>`).join('')
      : `<div class="ors-empty">${all.length ? 'Nothing matches the filter.' : `No ${esc(label)} nodes in this reality yet.`}</div>`
  }

  /** Select a node and fly the camera to it (the existing events; nothing new is invented here). */
  goTo (id) {
    if (!id) return false
    window.dispatchEvent(new CustomEvent('omni:node-select-by-id', { detail: { id } }))
    const mesh = this.omniNode?.getMeshById?.(id)
    if (mesh) window.dispatchEvent(new CustomEvent('omni:goto-mesh-request', { detail: { mesh } }))
    return true
  }
}
