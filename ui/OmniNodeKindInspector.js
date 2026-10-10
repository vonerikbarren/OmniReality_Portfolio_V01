/**
 * ui/OmniNodeKindInspector.js — the Inspector block for StoreItemNode and OmniValueNode (V183, SANDBOX).
 *
 * systems/OmniInspector.js shows this block inside its Appearance section the way it shows the Sequence / Group / Essence blocks (no 13th icon-strip
 * section): `_customOptionsHTML` returns kindOptionsHTML(data, ctx) for a kind node and `_wireCustomOptions` calls wireKindOptions(body, data, ctx).
 * Everything shown is READ from the models each time the block is built (the Inspector rebuilds it when the store or value model changes); the node
 * only holds the reference. Product edits are made in the store catalog (OmniStoreSettings), not here.
 *
 * Store item:  store, product, price forms (plain text), stock, forms the store takes; buttons  ◌ Window  ♡ Wish  🛒 Cart  (the shopping-list API of the
 *              node's OWN store: if it is not the active store it is opened first), "Open in store" (activate + show), "Buy…" (opens the exchange on the product).
 * Value node:  type, tier, balance, remainder, "Grant 10 (sandbox)" (the same Value.grant the user-facing wallet already offers), "Open in OmniTalent",
 *              and the conversion routes to every connected value node: the model's rate in both directions, or "no direct rate", plus arbitrage warnings.
 */

import * as Store from '../utils/OmniStoreModel.js'
import * as Value from '../utils/OmniValueModel.js'
import * as Kinds from '../utils/OmniNodeKinds.js'

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const fmt = Value.fmtQty
export const GRANT_QTY = 10

const STYLES = `
#oi-custom-kind .oik-val { flex: 1 1 auto; min-width: 0; font-size: 10.5px; line-height: 1.35; overflow-wrap: anywhere; color: var(--oi-text, rgba(255,255,255,.92)); }
#oi-custom-kind .oik-row { display: flex; flex-wrap: wrap; gap: 4px; }
#oi-custom-kind .oik-row .oi-btn-small { flex: 1 1 auto; min-height: 28px; }
#oi-custom-kind .oik-badge { margin-left: 6px; padding: 0 5px; border-radius: 3px; background: #ffb02e; color: #1b1200; font-size: 8px; letter-spacing: .08em; font-weight: bold; }
#oi-custom-kind .oik-missing { padding: 6px 8px; border-radius: 6px; background: rgba(255,255,255,.06); border: 1px dashed rgba(255,255,255,.3); font-size: 10px; line-height: 1.4; }
#oi-custom-kind .oik-route { padding: 6px 8px; border-radius: 6px; background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.1); font-size: 10px; line-height: 1.45; }
#oi-custom-kind .oik-warn { color: #ff9c9c; }
#oi-custom-kind .oik-msg { min-height: 12px; font-size: 9.5px; color: #8cffb4; }
@media (max-width: 700px) { #oi-custom-kind .oik-row .oi-btn-small { min-height: 40px; } }
`
function injectStyles () {
  if (typeof document === 'undefined' || document.getElementById('oik-styles')) return
  const s = document.createElement('style'); s.id = 'oik-styles'; s.textContent = STYLES; document.head.appendChild(s)
}

const LAST = { id: null, text: '' }   // the last action message, shown once after the block is rebuilt
const say = (id, text) => { LAST.id = id; LAST.text = text }

const row = (label, html) => `<div class="oi-row"><span class="oi-label">${esc(label)}</span><span class="oik-val">${html}</span></div>`
const tip = (name, desc) => `data-omni-tip="${esc(name)}" data-omni-tip-key="—" data-omni-tip-desc="${esc(desc)}"`

function storeItemHTML (d) {
  const ds = Kinds.describeStoreItem(d)
  if (ds.missing) {
    return `<div class="oik-missing" data-testid="kind-missing">❓ ${ds.state === 'missing-store' ? 'Missing store' : 'Missing product'}.
      This node points at ${ds.state === 'missing-store' ? 'a store' : 'a product'} that is not in your stores any more (deleted, renamed id, or another identity's). The node was not changed and nothing was deleted: it comes back to life if the reference exists again.
      <div class="oi-custom-note" style="margin-top:4px">Reference: ${esc(d.storeId)} / ${esc(d.productId)}</div></div>`
  }
  return `
    ${row('Store', `${esc(ds.storeEmoji)} ${esc(ds.storeName)}`)}
    ${row('Product', `${esc(ds.emoji)} ${esc(ds.name)} <span class="oi-custom-note">(${esc(ds.category)}, ${esc(ds.shape)})</span>`)}
    ${row('Price', esc(ds.priceText))}
    ${row('Stock', `${ds.stock} left`)}
    ${row('Store takes', esc(ds.acceptsText))}
    <div class="oik-row" role="group" aria-label="Shopping list">
      <button class="oi-btn-small" data-kact="list:window" ${tip('Window-shop', "Adds this product to your window-shopping list in its store (opens that store first if it is not the active one).")}>◌ Window</button>
      <button class="oi-btn-small" data-kact="list:wish" ${tip('Wish list', 'Adds this product to your wish list in its store.')}>♡ Wish</button>
      <button class="oi-btn-small" data-kact="list:cart" ${tip('Cart', 'Adds this product to the cart of its store. Nothing is bought until you check out in the exchange.')}>🛒 Cart</button>
    </div>
    <div class="oik-row">
      <button class="oi-btn-small" data-kact="open" ${tip('Open in store', 'Makes this node\'s store the active one, opens it and finds the product.')}>Open in store</button>
      <button class="oi-btn-small" data-kact="buy" ${tip('Buy…', 'Opens the exchange on this product. The purchase itself is made there (sandbox).')}>Buy…</button>
    </div>
    <div class="oi-custom-note">This node only points at the product. Name, price, stock and picture are read live from the store: change them in the store catalog (OmniStoreSettings > Catalog), not here. Deleting this node never deletes the product.</div>`
}

function routesHTML (d, ctx) {
  const edges = (ctx?.edges ?? []).filter(e => e.from === d.id || e.to === d.id)
  const nodes = ctx?.nodes ?? []
  const blocks = []
  for (const e of edges) {
    const otherId = e.from === d.id ? e.to : e.from
    const other = nodes.find(n => n.id === otherId)
    if (!other || other.nodeKind !== Kinds.KIND_VALUE) continue
    const info = Kinds.pairInfo(d.valueTypeId, other.valueTypeId)
    blocks.push(`<div class="oik-route" data-testid="kind-route">
      <b>${esc(info.aName)} ⇄ ${esc(info.bName)}</b>
      ${info.lines.map(l => `<div>${esc(l)}</div>`).join('')}
      ${info.warnings.map(l => `<div class="oik-warn" role="alert">${esc(l)}</div>`).join('')}</div>`)
  }
  return blocks.length
    ? blocks.join('')
    : '<div class="oi-custom-note">Conversion stays an edge: connect this node to another value node (PATH mode in ⟐N) to read the rate between the two types here. Rates come from the OmniValue model; the edge stores none.</div>'
}

function valueHTML (d, ctx) {
  const ds = Kinds.describeValueNode(d)
  if (ds.missing) {
    return `<div class="oik-missing" data-testid="kind-missing">❓ Missing value type.
      This node points at a value type that is not in the registry any more. The node was not changed: it shows the type again if it comes back.
      <div class="oi-custom-note" style="margin-top:4px">Reference: ${esc(d.valueTypeId)}</div></div>`
  }
  return `
    ${row('Type', `${esc(ds.emoji)} ${esc(ds.name)}`)}
    ${row('Tier', esc(ds.tier) + (ds.payable ? '' : ' <span class="oi-custom-note">(not payable)</span>'))}
    ${row('Balance', `<b data-testid="kind-balance">${esc(ds.balanceText)}</b>`)}
    ${row('Remainder', esc(ds.remainderText))}
    <div class="oik-row">
      <button class="oi-btn-small" data-kact="grant" ${tip('Grant sandbox value', `Adds ${GRANT_QTY} of this value type to your sandbox wallet. The same fake-value grant the Wallet panel offers.`)}>Grant ${GRANT_QTY} (sandbox)</button>
      <button class="oi-btn-small" data-kact="talent" ${tip('Open in OmniTalent', 'Opens the OmniTalent panel on this value type.')}>Open in OmniTalent</button>
      <button class="oi-btn-small" data-kact="exchange" ${tip('Open exchange', 'Opens the exchange panel. It is not preset to a pair yet.')}>Open exchange</button>
    </div>
    <div class="oi-custom-title" style="margin-top:4px">Conversion routes</div>
    ${routesHTML(d, ctx)}`
}

/** The whole kind block (an element with id="oi-custom-kind"). `ctx` = { edges:[{from,to}], nodes:[node data] } as the Inspector caches them. */
export function kindOptionsHTML (data, ctx = {}) {
  injectStyles()
  const isItem = data.nodeKind === Kinds.KIND_STORE_ITEM
  const msg = LAST.id === data.id ? LAST.text : ''
  return `
    <div class="oi-custom-section" id="oi-custom-kind" data-kind="${esc(data.nodeKind)}">
      <div class="oi-custom-title">${isItem ? '🛍 Store item' : '🪙 Value'}<span class="oik-badge" title="${esc(Kinds.SANDBOX_NOTE)}">SANDBOX</span></div>
      ${isItem ? storeItemHTML(data) : valueHTML(data, ctx)}
      <div class="oik-msg" role="status" aria-live="polite" data-ref="kind-msg">${esc(msg)}</div>
      <div class="oi-custom-note">${esc(Kinds.SANDBOX_NOTE)}</div>
    </div>`
}

function openStore (d) {
  if (Store.activeStoreId() === d.storeId) return false
  return Store.setActiveStore(d.storeId)
}

/** Run one block action. Returns the message shown. Exported so the tests (and other panels) call the same code the buttons do. */
export function runKindAction (data, act) {
  const [k, arg] = String(act).split(':')
  const ev = (name, detail) => window.dispatchEvent(new CustomEvent(name, { detail }))
  if (data.nodeKind === Kinds.KIND_STORE_ITEM) {
    const ds = Kinds.describeStoreItem(data)
    if (ds.missing) return 'This node points at a missing product.'
    if (k === 'list') {
      const opened = openStore(data)
      const it = Store.addToList(data.productId, arg, { qty: 1, add: true })
      return it ? `${ds.name} added to ${arg === 'window' ? 'window shopping' : arg === 'wish' ? 'your wish list' : 'the cart'} in ${ds.storeName}${opened ? ' (that store is now the active one)' : ''}.` : 'The list is full or the product is gone.'
    }
    if (k === 'open') { openStore(data); ev('omni:store-open', { productId: data.productId }); ev('omni:store-product-select', { productId: data.productId }); return `Opened ${ds.storeName}.` }
    if (k === 'buy') { openStore(data); ev('omni:store-product-select', { productId: data.productId }); ev('omni:exchange-open', { productId: data.productId, mode: 'buy' }); return 'Exchange opened on this product (sandbox).' }
    return ''
  }
  const ds = Kinds.describeValueNode(data)
  if (ds.missing) return 'This node points at a missing value type.'
  if (k === 'grant') return Value.grant(data.valueTypeId, GRANT_QTY) ? `Granted ${GRANT_QTY} ${ds.name} (sandbox).` : 'Could not grant.'
  if (k === 'talent') { ev('omni:talent-open', { typeId: data.valueTypeId }); return 'Opened OmniTalent.' }
  if (k === 'exchange') { ev('omni:exchange-open', {}); return 'Exchange opened.' }
  return ''
}

/** Wire the buttons of the block that kindOptionsHTML rendered. `onDone` (optional) runs after an action (the Inspector re-renders the block). */
export function wireKindOptions (root, data, onDone) {
  const sec = root.querySelector('#oi-custom-kind')
  if (!sec) return
  sec.addEventListener('click', (e) => {
    const b = e.target.closest?.('[data-kact]')
    if (!b || b.disabled) return
    const text = runKindAction(data, b.dataset.kact)
    say(data.id, text)
    const m = sec.querySelector('[data-ref="kind-msg"]'); if (m) m.textContent = text
    onDone?.()
  })
}
