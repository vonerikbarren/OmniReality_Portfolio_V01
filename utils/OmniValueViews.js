/**
 * utils/OmniValueViews.js — the data behind the OmniValue D3 views (V181, SANDBOX). PURE: no DOM, no d3.
 *
 * Turns the model's trees and flows into what the three chart styles need, with one rule: DIFFERENT UNITS ARE NEVER ADDED.
 *   - A chart's SIZE (`w` on a tree leaf, `value` on a flow link) is a DISPLAY size only. Inside one group the sizes follow that group's own
 *     numbers on a log scale; a group never gets bigger because its numbers happen to be in cheaper units. The real amounts are in the labels.
 *   - Every node keeps its real figures (`qty`, `unit`, ...) and a plain-language `label` / `detail` for the caption and the screen reader.
 *
 * Trees (sunburst / treemap): { key, name, kind, color, w?, label, detail, children? }   every node has a unique `key`
 * Graphs (sankey):            { nodes:[{id, name, kind, color, label, detail}], links:[{source, target, value, label}] }   value = display size > 0
 *
 *   balanceTree(accountId?)            the standalone panel: user -> tier -> value type                  (Value.toBalanceHierarchy)
 *   exchangeTree(qt)                   exchange levels 1-2: pay / route / fees / remainder of one quote  (Value.toHierarchy)
 *   formsTree(product, forms, qty)     exchange level 0: the product and every exchange form it accepts (one leaf per spoke)
 *   treeGraph(tree)                    any tree as sankey flows (parent -> child)
 *   exchangeGraph(qt)                  the quote's real flow: channels -> pay type -> ... -> item / remainder  (Value.toFlows)
 *   formsGraph(product, forms, qty)    forms -> product
 */

import * as Value from './OmniValueModel.js'

export const TIER_COLOR = { primary: '#f5c04a', secondary: '#4cc9b0', tertiary: '#9b8cff', quaternary: '#ff8fa3', quinary: '#7fb4ff' }
export const KIND_COLOR = { root: '#8892a6', tier: '#8892a6', type: '#4cc9b0', offer: '#4cc9b0', channel: '#7fd9c8', route: '#9b8cff', edge: '#b9acff', fees: '#ff8fa3', fee: '#ff8fa3', remainder: '#f5c04a', form: '#7fb4ff', product: '#c9d1e0', item: '#c9d1e0' }
export const VIEWS = ['wheel', 'sunburst', 'treemap', 'sankey']
export const VIEW_LABELS = { wheel: 'Radial wheel', sunburst: 'Sunburst', treemap: 'Treemap', sankey: 'Sankey' }
export const VIEW_HELP = {
  wheel: 'The exchange wheel: the product in the middle, one spoke per way to pay.',
  sunburst: 'Rings from the middle outwards. Each slice is one thing; the next ring shows what it is made of.',
  treemap: 'Boxes inside boxes. Each box is one thing; bigger box, bigger share of its group.',
  sankey: 'Ribbons that flow left to right: where the value comes from and where it goes.',
}
export const isView = (v) => VIEWS.includes(v)

const fmt = Value.fmtQty
const logSize = (x) => Math.max(0.15, Math.log2(1 + Math.max(0, +x || 0)))
let uid = 0
const mk = (o) => ({ key: o.key ?? `n${++uid}`, ...o })

// ── Trees ───────────────────────────────────────────────────────────────────────

/** user -> tier -> value type. Sizes: log of the type's own amount. Never a total. */
export function balanceTree (accountId) {
  uid = 0
  const h = Value.toBalanceHierarchy(accountId)
  return {
    key: 'root', name: h.name, kind: 'root', color: KIND_COLOR.root, label: `You (${h.name})`, detail: 'Your value, grouped by tier. Amounts of different value types are never added together.',
    children: h.children.map(tier => ({
      key: 'tier:' + tier.tier, name: tier.name, kind: 'tier', tier: tier.tier, color: TIER_COLOR[tier.tier] ?? KIND_COLOR.tier, label: `${tier.name} tier`,
      detail: `${tier.children.length} value type${tier.children.length === 1 ? '' : 's'} in the ${tier.name} tier.`,
      children: tier.children.map(t => ({
        key: 'type:' + t.typeId, name: t.name, kind: 'type', typeId: t.typeId, tier: t.tier, color: TIER_COLOR[t.tier] ?? KIND_COLOR.type, qty: t.qty, unit: t.unit,
        w: logSize(t.qty), label: `${t.emoji ?? ''} ${t.name}`.trim(),
        detail: `${fmt(t.qty)} ${t.unit}${t.remainder > 0 ? `, plus a stated remainder of ${fmt(t.remainder)}` : ''}${t.payable ? '' : ' (not payable)'}`,
      })),
    })),
  }
}

/** One quote as a tree. The four groups get equal room; inside a group the leaves follow their own numbers (log). */
export function exchangeTree (qt) {
  uid = 0
  const h = Value.toHierarchy(qt)
  const root = { key: 'root', name: h.name, kind: 'root', color: KIND_COLOR.root, label: h.name, detail: 'What you pay, how it is converted, the fees and the stated remainder.', children: [] }
  ;(h.children ?? []).forEach((g, gi) => {
    const kids = g.children ?? []
    const gkey = 'g' + gi
    const node = { key: gkey, name: g.name, kind: g.kind, color: KIND_COLOR[g.kind] ?? KIND_COLOR.root, label: g.name }
    if (kids.length) {
      const vals = kids.map(k => (g.kind === 'route' ? 1 : Math.max(0, +k.value || 0)))
      const total = vals.reduce((a, b) => a + b, 0)
      node.detail = g.kind === 'route' ? `${kids.length} conversion step${kids.length === 1 ? '' : 's'}` : `${kids.length} part${kids.length === 1 ? '' : 's'}`
      node.children = kids.map((k, i) => ({
        key: `${gkey}:${i}`, name: k.name, kind: k.kind, color: KIND_COLOR[k.kind] ?? KIND_COLOR.root,
        w: Math.max(0.12, total > 0 ? vals[i] / total : 1 / kids.length), qty: k.value,
        label: k.name, detail: g.kind === 'route' ? k.name : `${fmt(k.value ?? 0)}${k.fee ? ` (fee ${fmt(k.fee)})` : ''} ${Value.getType(k.typeId ?? g.typeId)?.name ?? ''}`.trim(),
      }))
    } else {
      node.w = (+g.value || 0) > 0 ? 1 : 0.3
      node.qty = g.value
      node.detail = g.kind === 'route' ? 'Direct: the same value type, no conversion' : g.kind === 'remainder' ? ((+g.value || 0) > 0 ? `${fmt(g.value)} ${Value.getType(g.typeId)?.name ?? ''} stated, not rounded away` : 'None: the offer covers the want exactly') : `${fmt(g.value ?? 0)}`
    }
    root.children.push(node)
  })
  return root
}

/** The exchange forms of a product as a tree: product -> one leaf per spoke (the leaf's `index` is the spoke). Size: log of the amount needed. */
export function formsTree (product, forms, qty = 1) {
  uid = 0
  const p = product ?? { name: 'Product', media: { emoji: '' } }
  return {
    key: 'root', name: p.name, kind: 'product', color: KIND_COLOR.product, label: `${p.media?.emoji ?? p.emoji ?? ''} ${p.name}`.trim(),
    detail: `${forms.length} accepted exchange form${forms.length === 1 ? '' : 's'}. Pick one to choose how to pay.`,
    children: forms.map((f, i) => {
      const t = Value.getType(f.type)
      const need = Value.clean(f.qty * qty)
      const have = Value.getBalance(f.type)
      return {
        key: 'form:' + i, index: i, name: t?.name ?? f.type, kind: 'form', typeId: f.type, tier: t?.tier, color: TIER_COLOR[t?.tier] ?? KIND_COLOR.form, qty: need, unit: t?.unit,
        w: logSize(need), label: `${t?.emoji ?? ''} ${t?.name ?? f.type}`.trim(),
        detail: `${Value.describeForm({ type: f.type, qty: need, quality: f.quality })}; you have ${fmt(have)}${have + 1e-9 < need ? ' (not enough)' : ''}`,
      }
    }),
  }
}

/** A direct sale (Value.quoteSell) as a tree: what you receive, by channel, the fees and the net to your balance. All in ONE unit, so sizes are the real shares. */
export function sellTree (qs) {
  uid = 0
  const T = qs?.receive ? Value.getType(qs.receive.type) : null
  const root = { key: 'root', name: 'Sale', kind: 'root', color: KIND_COLOR.root, label: qs?.ok && qs.receive ? `You receive ${Value.describeForm(qs.receive)}` : 'Sale', detail: 'What a sale pays you, by channel, and what the fees take.', children: [] }
  if (!qs?.ok || !T) return root
  const total = qs.receive.qty || 1
  root.children.push({
    key: 'g0', name: 'Channels', kind: 'offer', color: KIND_COLOR.offer, label: 'Paid through', detail: `${qs.fees.length} channel${qs.fees.length === 1 ? '' : 's'}`,
    children: qs.fees.map((f, i) => ({ key: `g0:${i}`, name: f.name, kind: 'channel', color: KIND_COLOR.channel, w: Math.max(0.12, f.amount / total), qty: f.amount, label: f.name, detail: `${fmt(f.amount)} ${T.name}${f.fee ? ` (fee ${fmt(f.fee)})` : ''}` })),
  })
  root.children.push({ key: 'g1', name: 'Fees', kind: 'fees', color: KIND_COLOR.fees, w: qs.feeTotal > 0 ? Math.max(0.12, qs.feeTotal / total) : 0.3, qty: qs.feeTotal, label: 'Fees', detail: qs.feeTotal > 0 ? `${fmt(qs.feeTotal)} ${T.name}` : 'None' })
  root.children.push({ key: 'g2', name: 'Net to you', kind: 'remainder', color: TIER_COLOR[T.tier] ?? KIND_COLOR.remainder, w: Math.max(0.12, qs.net / total), qty: qs.net, label: 'Net to your balance', detail: `${fmt(qs.net)} ${T.name}` })
  return root
}
export const sellGraph = (qs) => treeGraph(sellTree(qs))

// ── Graphs ──────────────────────────────────────────────────────────────────────

/** A tree as parent -> child flows (the same data as the sunburst / treemap, drawn as ribbons). Leaves carry `w`; inner nodes add up their children's display sizes. */
export function treeGraph (tree) {
  const nodes = [], links = []
  const size = (n) => (n.children?.length ? n.children.reduce((s, c) => s + size(c), 0) : Math.max(0.05, n.w ?? 0.05))
  const walk = (n) => {
    nodes.push({ id: n.key, name: n.name, kind: n.kind, color: n.color, label: n.label, detail: n.detail, index: n.index, typeId: n.typeId })
    ;(n.children ?? []).forEach(c => { links.push({ source: n.key, target: c.key, value: size(c), label: `${n.name} → ${c.name}` }); walk(c) })
  }
  walk(tree)
  return { nodes, links }
}

/**
 * The quote's real flow (Value.toFlows): channels -> the pay type -> each conversion -> the item (+ the stated remainder).
 * Ribbon widths are SHARES, not amounts: the pay channels split 100% of the payment, the conversion chain carries 100%, and the item and
 * the remainder split what arrives. The amounts (in their own units) are in the labels.
 */
export function exchangeGraph (qt) {
  const f = Value.toFlows(qt)
  const nodes = f.nodes.map(n => ({ id: n.id, name: n.name, kind: n.kind, color: n.typeId ? (TIER_COLOR[Value.getType(n.typeId)?.tier] ?? KIND_COLOR[n.kind]) : KIND_COLOR[n.kind] ?? KIND_COLOR.root, label: n.name, detail: n.name, typeId: n.typeId }))
  const pay = f.links.filter(l => l.kind === 'pay'), arr = f.links.filter(l => l.kind === 'purchase' || l.kind === 'remainder')
  const payTotal = pay.reduce((s, l) => s + (+l.value || 0), 0), arrTotal = arr.reduce((s, l) => s + (+l.value || 0), 0)
  const links = f.links.map(l => {
    let v = 1
    if (l.kind === 'pay') v = payTotal > 0 ? l.value / payTotal : 1 / Math.max(1, pay.length)
    else if (l.kind === 'purchase' || l.kind === 'remainder') v = arrTotal > 0 ? l.value / arrTotal : 1
    const src = f.nodes.find(n => n.id === l.source), dst = f.nodes.find(n => n.id === l.target)
    const amt = l.kind === 'convert' ? `${fmt(l.value)} ${src?.name ?? ''} become ${fmt(l.valueOut)} ${dst?.name ?? ''}` : `${fmt(l.value)} ${src?.name ?? ''}${l.fee ? ` (fee ${fmt(l.fee)})` : ''}`
    return { source: l.source, target: l.target, value: Math.max(0.04, v), label: `${l.kind === 'pay' ? 'Pay' : l.kind === 'convert' ? 'Convert' : l.kind === 'purchase' ? 'Buys' : 'Stated remainder'}: ${amt}` }
  })
  return { nodes, links }
}

/** Forms -> product. Widths: log of each amount; labels hold the real amounts. */
export function formsGraph (product, forms, qty = 1) {
  const tree = formsTree(product, forms, qty)
  return treeGraph(tree)
}

/** A one-line description of a node/link key for the caption under a chart. */
export function describeKey (tree, key) {
  let hit = null
  const walk = (n) => { if (n.key === key) hit = n; (n.children ?? []).forEach(walk) }
  if (tree) walk(tree)
  return hit ? `${hit.label}: ${hit.detail ?? ''}`.trim() : ''
}
