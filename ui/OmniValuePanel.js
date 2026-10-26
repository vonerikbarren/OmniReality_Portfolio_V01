/**
 * ui/OmniValuePanel.js — ⟐OmniTalent · Value: the STANDALONE OmniValue panel (V181, BuildOrder item 5, SANDBOX)
 *
 * OUTSIDE the store: the user's value spread across value types and tiers. It is framed as the first component of the global object
 * OmniTalent (Greek talent: value entrusted to you to be grown; docs/architecture/BACKEND_COMPONENTS_ONTOLOGY.md). There is NO OmniTalent object in
 * the code yet (only docs), so this panel is built to be hosted by it later: the panel id is 'omnitalent', the label/title leave room for other
 * components, and the content is the whole body is built by this class (buildBody / refresh), so a future OmniTalent shell can host it by extending or wrapping it.
 *
 * What it shows (the model is the SAME ledger as the wallet and the exchange: utils/OmniValueModel.js, no second model):
 *   - a chart of  you -> tier (Primary..Quinary) -> value type, as a Sunburst (default), Treemap or Sankey (ui/OmniValueCharts.js, data from
 *     utils/OmniValueViews.js balanceTree()). A slice's size is a DISPLAY size (log of that type's OWN amount); amounts of different types are never added.
 *   - the chosen part below the chart, drill-down style: its balance row (the wallet's row, ui/OmniWalletPanel.js balanceRowHtml; claiming a stated
 *     remainder stays in the wallet) and the conversion edges going in and out of that value type, with buttons to open the Exchange and the Wallet.
 *   - the arbitrage guard in plain words: any loop of conversion rates that returns more than it started with.
 *   - quality (a grade tick on a slice) is NOT shown: a balance has no grade today (grades belong to an offer / a want), see DeveloperQueue.
 *
 * Opened by omni:nav-select '⟐OmniTalent' (drawer, ribbon Realities > Value > Talent). Extends the shared panel shell (ui/OmniSettingsPanelBase.js).
 * Listens: omni:value-changed, omni:identity-changed. Dispatches: omni:exchange-open, omni:wallet-open.
 */

import OmniSettingsPanelBase, { esc } from './OmniSettingsPanelBase.js'
import ValueChart from './OmniValueCharts.js'
import * as Value from '../utils/OmniValueModel.js'
import * as Views from '../utils/OmniValueViews.js'
import { balanceRowHtml, ensureWalletStyles, pinValueType } from './OmniWalletPanel.js'

export const PANEL_ID = 'omnitalent'
export const NAV_ITEM = '⟐OmniTalent'
export const VIEW_KEY = 'omni:talent-view-v1'
export const PANEL_VIEWS = ['sunburst', 'treemap', 'sankey']
const fmt = Value.fmtQty
const loadView = () => { try { const v = localStorage.getItem(VIEW_KEY); return PANEL_VIEWS.includes(v) ? v : 'sunburst' } catch (_) { return 'sunburst' } }

const STYLES = `
.ovp-views { display: flex; flex-wrap: wrap; gap: 4px; margin: 6px 0; }
.ovp-views .oss-btn[aria-pressed="true"] { background: rgba(255,255,255,.22); border-color: rgba(255,255,255,.7); }
.ovp-detail { margin-top: 6px; }
.ovp-detail table { width: 100%; border-collapse: collapse; }
.ovp-detail .wl-dim { color: var(--omni-theme-text-dim, rgba(255,255,255,.62)); }
.ovp-detail td { padding: 3px 4px; border-bottom: 1px solid rgba(255,255,255,.08); vertical-align: top; } .ovp-detail td.num { text-align: right; }
.ovp-arb { margin: 6px 0; padding: 6px 8px; border-radius: 6px; line-height: 1.45; }
.ovp-arb.is-bad { background: rgba(255,90,90,.14); border: 1px solid rgba(255,120,120,.6); }
.ovp-arb.is-ok { background: rgba(110,231,168,.1); border: 1px solid rgba(110,231,168,.4); }
.ovp-edge { padding: 2px 0; border-bottom: 1px dotted rgba(255,255,255,.1); }
`
function injectStyles () {
  if (typeof document === 'undefined' || document.getElementById('ovp-styles')) return
  const s = document.createElement('style'); s.id = 'ovp-styles'; s.textContent = STYLES; document.head.appendChild(s)
}

/** The edge list a value type takes part in, as plain lines ("3 Bells → 1 Credits"). */
export function edgeLines (typeId) {
  const nm = (id) => Value.getType(id)?.name ?? id
  return Value.getEdges().filter(e => e.fromType === typeId || e.toType === typeId)
    .map(e => `${fmt(e.rateDen)} ${nm(e.fromType)} → ${fmt(e.rateNum)} ${nm(e.toType)}${e.minQty ? ` (from ${fmt(e.minQty)})` : ''}${e.qualityRule ? ' (needs a good grade)' : ''}${e.owner ? ' (private rate)' : ''}`)
}

/** The arbitrage block as HTML: red list of loops, or the green "none" line. Shared wording with the exchange panel and the dev panel. */
export function arbitrageHtml (loops = Value.findArbitrageLoops()) {
  if (!loops.length) return '<div class="ovp-arb is-ok" data-testid="arb-none">No rate loops found: the conversion rates do not make value from nothing.</div>'
  return `<div class="ovp-arb is-bad" role="alert" data-testid="arb-loops"><b>${esc(Value.ARBITRAGE.line)}.</b> ${loops.length} loop${loops.length === 1 ? '' : 's'} of conversion rates return more than they start with${loops.truncated ? ' (list cut short)' : ''}. Using one right after another is blocked.${loops.slice(0, 5).map(l => `<div class="wl-dim">${esc(l.line)}</div>`).join('')}</div>`
}

export default class OmniValuePanel extends OmniSettingsPanelBase {
  constructor () {
    super({ id: PANEL_ID, label: '⟐OmniTalent', iconLabel: '⟐T', navItems: [NAV_ITEM], className: 'ovp-panel', wide: true })
    this.view = loadView()
    this.selKey = null
    this._chart = null
    this._renderQ = false
  }

  onInit () {
    injectStyles(); ensureWalletStyles()
    this._onChanged = () => { if (this._isOpen) this._queue() }
    window.addEventListener(Value.CHANGED_EVENT, this._onChanged)
    window.addEventListener('omni:identity-changed', this._onChanged)
    // V183: "Open in OmniTalent" on a value node: open this panel with that value type picked
    this._onTalentOpen = (e) => { this.open(); const id = e.detail?.typeId; if (id && Value.getType(id)) this.select('type:' + id) }
    window.addEventListener('omni:talent-open', this._onTalentOpen)
  }

  onDestroy () {
    window.removeEventListener(Value.CHANGED_EVENT, this._onChanged)
    window.removeEventListener('omni:identity-changed', this._onChanged)
    window.removeEventListener('omni:talent-open', this._onTalentOpen)
    this._chart?.destroy(); this._chart = null
  }

  _queue () {
    if (this._renderQ) return
    this._renderQ = true
    const run = () => { this._renderQ = false; if (this._isOpen) this.refresh() }
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run); else setTimeout(run, 0)
  }

  buildBody (body) {
    body.innerHTML = `
      <div class="oss-row"><span class="oss-badge is-sandbox">SANDBOX</span><span class="oss-dim">Every value here is fake. No real payments, no network.</span></div>
      <div class="oss-dim" data-ref="intro"></div>
      <div class="ovp-views" role="group" aria-label="Chart view" data-ref="views">${PANEL_VIEWS.map(v => `<button type="button" class="oss-btn" data-act="view" data-view="${v}" aria-pressed="false" title="${esc(Views.VIEW_HELP[v])}" data-omni-tip="${esc(Views.VIEW_LABELS[v])} view" data-omni-tip-key="—" data-omni-tip-desc="${esc(Views.VIEW_HELP[v])}">${esc(Views.VIEW_LABELS[v])}</button>`).join('')}</div>
      <div data-ref="chart" data-testid="valuechart"></div>
      <div class="oss-dim" style="font-size:10px">Slice size is a picture only (log scale of each type's own amount). Different value types are never added into one number.</div>
      <div class="ovp-detail" data-ref="detail" aria-live="polite"></div>
      <div class="oss-sec">Rate loops</div>
      <div data-ref="arb"></div>
      <div class="oss-row"><button type="button" class="oss-btn" data-act="open-exchange" data-omni-tip="Open the exchange" data-omni-tip-key="—" data-omni-tip-desc="Opens the radial exchange panel (sandbox).">Open exchange</button><button type="button" class="oss-btn" data-act="open-wallet" data-omni-tip="Open the wallet" data-omni-tip-key="—" data-omni-tip-desc="Opens the wallet: balances, remainders, transactions (sandbox).">Open wallet</button></div>
      <div class="oss-msg" role="status" aria-live="polite" data-ref="msg"></div>`
    body.addEventListener('click', (e) => this._onClick(e))
  }

  _onClick (e) {
    const b = e.target.closest?.('[data-act]')
    if (!b) return
    const act = b.dataset.act
    if (act === 'view') this.setView(b.dataset.view)
    else if (act === 'open-exchange') window.dispatchEvent(new CustomEvent('omni:exchange-open', { detail: {} }))
    else if (act === 'open-wallet') window.dispatchEvent(new CustomEvent('omni:wallet-open'))
    else if (act === 'pin-type') { const m = this.body?.querySelector('[data-ref="msg"]'); if (m) m.textContent = pinValueType(b.dataset.type) }
  }

  setView (v) {
    if (!PANEL_VIEWS.includes(v) || v === this.view) return false
    this.view = v
    try { localStorage.setItem(VIEW_KEY, v) } catch (_) { /* convenience only */ }
    this.refresh()
    return true
  }

  select (key) {
    this.selKey = key
    this._renderDetail()
    this._chart?.select(key)
  }

  _onSelect (key) { this.selKey = key; this._renderDetail() }

  _renderDetail () {
    const el = this.body?.querySelector('[data-ref="detail"]')
    if (!el) return
    const tree = this._tree
    const find = (n, k) => (n.key === k ? n : (n.children ?? []).map(c => find(c, k)).find(Boolean) ?? null)
    const node = tree && this.selKey ? find(tree, this.selKey) : null
    if (!node) { el.innerHTML = '<div class="oss-dim">Pick a part of the chart to see the numbers behind it.</div>'; return }
    if (node.kind === 'type') {
      const t = Value.getType(node.typeId)
      const bal = Value.getBalance(node.typeId), rem = Value.getRemainderTotal(node.typeId)
      const edges = edgeLines(node.typeId)
      el.innerHTML = `<div class="oss-sec">${esc(node.label)}</div>
        <table data-testid="detail-balance"><tbody>${balanceRowHtml(t, bal, rem, { claim: false })}</tbody></table>
        <div class="oss-row"><button type="button" class="oss-btn" data-act="pin-type" data-type="${esc(t.id)}" data-testid="pin-type" data-omni-tip="Pin this value type" data-omni-tip-key="—" data-omni-tip-desc="Drops a node that shows ${esc(t.name)} and your live balance in front of the camera.">📌 Pin this value type</button></div>
        <div class="oss-sec">Conversions that use ${esc(t.name)}</div>${edges.length ? edges.map(l => `<div class="ovp-edge">${esc(l)}</div>`).join('') : '<div class="oss-dim">None: this value type has no conversion rates.</div>'}`
    } else {
      el.innerHTML = `<div class="oss-sec">${esc(node.label)}</div><div class="oss-dim">${esc(node.detail ?? '')}</div>`
    }
  }

  refresh () {
    const body = this.body
    if (!body) return
    injectStyles(); ensureWalletStyles()
    const tree = this._tree = Views.balanceTree()
    body.querySelector('[data-ref="intro"]').textContent = `OmniTalent is value entrusted to you to grow, not hoard. This is its first part: your OmniValue across types and tiers. Account: ${Value.currentAccountId()}.`
    body.querySelectorAll('[data-act="view"]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === this.view)))
    body.querySelector('[data-ref="arb"]').innerHTML = arbitrageHtml()
    const host = body.querySelector('[data-ref="chart"]')
    this._chart?.destroy()
    this._chart = new ValueChart(host, { onSelect: (key) => this._onSelect(key) })
    this._chart.show(this.view, this.view === 'sankey' ? Views.treeGraph(tree) : tree, { selectedKey: this.selKey })
    this._renderDetail()
  }

  getState () { return { open: this._isOpen, view: this.view, selected: this.selKey } }
}
