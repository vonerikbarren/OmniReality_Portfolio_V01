/**
 * ui/OmniValueCharts.js — the D3 views of OmniValue: Sunburst, Treemap, Sankey (V181, SANDBOX)
 *
 * One small component used by BOTH the exchange panel (ui/OmniExchangeRadial.js, `#exchange-chart-slot` and the level-0 view switcher) and the
 * standalone OmniValue panel (ui/OmniValuePanel.js, a component of OmniTalent). The data comes from utils/OmniValueViews.js (pure).
 *
 *   const chart = new ValueChart(hostElement, { onSelect(key, node) {...}, onHover?(key, node) })
 *   await chart.show('sunburst' | 'treemap' | 'sankey', data, { selectedKey })       data = a tree (sunburst, treemap) or a graph (sankey)
 *   chart.destroy()
 *
 * D3 LOADING. `d3` and `d3-sankey` are bare specifiers in index.html's import map (pinned: d3@7.9.0, d3-sankey@0.12.3 on jsDelivr). They are
 * imported DYNAMICALLY, once, only when a chart is first shown, so a CDN failure can never break the app start: show() then writes a plain
 * message into the host ("The chart library could not be loaded...") and resolves false; the wheel / tables keep working. `setLoader(fn)` lets tests
 * (or a different bundle) supply the libraries.
 *
 * LAYOUT. Every chart is an <svg> with a viewBox and width 100%, so it scales to the panel (phone width included) and never makes the page scroll
 * sideways. Every slice / box / node is a focusable button (role="button", tabindex 0, Enter / Space) with an aria-label and a <title>; a click selects it
 * (onSelect), hovering or focusing reads it into the caption line under the chart. The selected one gets a white outline.
 */

const SVGNS = 'http://www.w3.org/2000/svg'
let loader = async () => ({ d3: await import('d3'), sankey: await import('d3-sankey') })
let libs = null, libsPromise = null

/** Replace how d3 / d3-sankey are loaded (tests). Resets the cache. */
export function setLoader (fn) { loader = fn; libs = null; libsPromise = null }
/** Load (once) and return { d3, sankey }; rejects when the libraries cannot be loaded (a failed attempt is not cached, so the next call retries). */
export function loadLibs () {
  if (libs) return Promise.resolve(libs)
  if (!libsPromise) libsPromise = Promise.resolve().then(loader).then(l => { libs = l; return l }).catch(e => { libsPromise = null; throw e })
  return libsPromise
}

const STYLES = `
.ovc { position: relative; width: 100%; min-width: 0; }
.ovc svg { display: block; width: 100%; height: auto; max-width: 100%; overflow: hidden; }
.ovc-node { cursor: pointer; outline: none; }
.ovc-node:hover .ovc-shape, .ovc-node:focus-visible .ovc-shape { stroke: #fff; stroke-width: 2; }
.ovc-node.is-sel .ovc-shape { stroke: #fff; stroke-width: 3; }
.ovc-shape { stroke: rgba(10,12,20,.9); stroke-width: 1; }
.ovc-label { fill: #0b0e16; font-family: 'Courier New', Courier, monospace; pointer-events: none; text-anchor: middle; dominant-baseline: central; }
.ovc-label.is-light { fill: #fff; }
.ovc-slabel { fill: #fff; font-family: 'Courier New', Courier, monospace; font-size: 10px; pointer-events: none; paint-order: stroke; stroke: rgba(8,10,18,.85); stroke-width: 3px; }
.ovc-link { fill: none; stroke-opacity: .42; }
.ovc-link:hover { stroke-opacity: .75; }
.ovc-caption { min-height: 28px; margin-top: 4px; font-size: 10px; line-height: 1.4; color: var(--omni-theme-text-dim, rgba(255,255,255,.7)); overflow-wrap: anywhere; }
.ovc-msg { padding: 10px; text-align: center; font-size: 11px; line-height: 1.45; border: 1px dashed var(--omni-theme-border, rgba(255,255,255,.25)); border-radius: 8px; }
.ovc-msg.is-err { color: #ffb4a8; }
`
function injectStyles () {
  if (typeof document === 'undefined' || document.getElementById('ovc-styles')) return
  const s = document.createElement('style'); s.id = 'ovc-styles'; s.textContent = STYLES; document.head.appendChild(s)
}

const luma = (hex) => { const m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return 0; const n = parseInt(m[1], 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255 }
const short = (s, n) => { s = String(s ?? ''); return s.length > n ? s.slice(0, Math.max(1, n - 1)) + '…' : s }

export default class ValueChart {
  /** @param {HTMLElement} host  @param {{onSelect?:(key:string,node:object)=>void, onHover?:(key:string|null,node:object|null)=>void}} [opts] */
  constructor (host, opts = {}) {
    this.host = host
    this.opts = opts
    this.view = null
    this.data = null
    this.selectedKey = null
    this._token = 0
    this._byKey = new Map()
    this.svg = null
    this.caption = null
    injectStyles()
  }

  /** Draw. Resolves true when drawn, false when d3 could not be loaded (the host then holds the message). A newer show() / destroy() cancels an older one. */
  async show (view, data, { selectedKey = null } = {}) {
    const token = ++this._token
    this.view = view; this.data = data; this.selectedKey = selectedKey
    let L
    try { L = await loadLibs() } catch (e) { if (token === this._token && this.host.isConnected !== false) this._message('The chart library could not be loaded (no connection to the d3 library). The wheel and the tables still work; try again later.', true); return false }
    if (token !== this._token) return false
    this.host.textContent = ''
    this.host.classList.add('ovc')
    this._byKey = new Map()
    if (!data) { this._message('Nothing to show yet.'); return false }
    try {
      if (view === 'treemap') this._treemap(L.d3, data)
      else if (view === 'sankey') this._sankey(L.d3, L.sankey, data)
      else this._sunburst(L.d3, data)
    } catch (e) { this._message('This chart could not be drawn: ' + short(e?.message, 80), true); return false }
    this.caption = document.createElement('div')
    this.caption.className = 'ovc-caption'
    this.caption.setAttribute('role', 'status'); this.caption.setAttribute('aria-live', 'polite')
    this.host.appendChild(this.caption)
    this._caption(this.selectedKey)
    return true
  }

  select (key) {
    this.selectedKey = key
    this.host.querySelectorAll('.ovc-node').forEach(n => n.classList.toggle('is-sel', n.dataset.key === key))
    this._caption(key)
  }

  destroy () {
    this._token++
    this.host.textContent = ''
    this._byKey.clear()
    this.svg = null; this.caption = null
  }

  // ── helpers ───────────────────────────────────────────────────────────────────

  _message (text, err = false) {
    this.host.textContent = ''
    const m = document.createElement('div')
    m.className = 'ovc-msg' + (err ? ' is-err' : ''); m.setAttribute('role', 'status'); m.textContent = text
    this.host.appendChild(m)
  }

  _svg (w, h, label) {
    const svg = document.createElementNS(SVGNS, 'svg')
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`)
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet')
    svg.setAttribute('role', 'group'); svg.setAttribute('aria-label', label)
    this.host.appendChild(svg)
    this.svg = svg
    return svg
  }

  _el (parent, tag, attrs = {}) {
    const e = document.createElementNS(SVGNS, tag)
    for (const k of Object.keys(attrs)) e.setAttribute(k, attrs[k])
    parent.appendChild(e)
    return e
  }

  /** A selectable group around a shape: role=button, tabindex, aria-label, <title>, click / Enter / Space. */
  _node (parent, key, node, name) {
    const g = this._el(parent, 'g', { class: 'ovc-node' + (key === this.selectedKey ? ' is-sel' : ''), 'data-key': key, role: 'button', tabindex: '0', 'aria-label': name })
    const t = document.createElementNS(SVGNS, 'title'); t.textContent = name; g.appendChild(t)
    this._byKey.set(key, node)
    g.addEventListener('click', () => this._pick(key))
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this._pick(key) } })
    g.addEventListener('mouseenter', () => { this._caption(key); this.opts.onHover?.(key, this._byKey.get(key) ?? null) })
    g.addEventListener('focus', () => this._caption(key))
    g.addEventListener('mouseleave', () => { this._caption(this.selectedKey); this.opts.onHover?.(null, null) })
    g.addEventListener('blur', () => this._caption(this.selectedKey))
    return g
  }

  _pick (key) {
    this.select(key)
    try { this.opts.onSelect?.(key, this._byKey.get(key) ?? null) } catch (_) { /* a bad callback must not break the chart */ }
  }

  _caption (key) {
    if (!this.caption) return
    const n = key ? this._byKey.get(key) : null
    this.caption.textContent = n ? `${n.label ?? n.name}${n.detail ? ': ' + n.detail : ''}` : 'Tap or click a part to read it and select it.'
  }

  // ── sunburst ──────────────────────────────────────────────────────────────────

  _sunburst (d3, tree) {
    const W = 400, R = 195
    const root = d3.hierarchy(tree).sum(d => (d.children?.length ? 0 : (d.w ?? 0.05)))
    d3.partition().size([2 * Math.PI, R])(root)
    const depth = Math.max(1, root.height)
    const ring = R / (depth + 1)        // the centre disc takes one ring's width
    const arc = d3.arc().startAngle(d => d.x0).endAngle(d => d.x1).padAngle(0.012).innerRadius(d => ring * d.depth).outerRadius(d => ring * (d.depth + 1) - 1)
    const svg = this._svg(W, W, 'Sunburst chart')
    const g = this._el(svg, 'g', { transform: `translate(${W / 2} ${W / 2})` })
    root.descendants().forEach(d => {
      const n = d.data
      const label = `${n.label ?? n.name}${n.detail ? ': ' + n.detail : ''}`
      const grp = this._node(g, n.key, n, label)
      if (d.depth === 0) {
        this._el(grp, 'circle', { class: 'ovc-shape', r: ring - 2, fill: n.color ?? '#8892a6' })
        const t = this._el(grp, 'text', { class: 'ovc-label', 'font-size': '11' }); t.textContent = short(n.name, 14)
        return
      }
      const p = this._el(grp, 'path', { class: 'ovc-shape', d: arc(d), fill: n.color ?? '#8892a6' })
      void p
      const ang = d.x1 - d.x0, rad = ring * (d.depth + 0.5)
      if (ang * rad > 30) {   // room for a label: draw it along the middle of the slice, upright
        const a = (d.x0 + d.x1) / 2, x = Math.sin(a) * rad, y = -Math.cos(a) * rad
        const t = this._el(grp, 'text', { class: 'ovc-label' + (luma(n.color) < 0.5 ? ' is-light' : ''), x: x.toFixed(1), y: y.toFixed(1), 'font-size': ang * rad > 60 ? '10' : '8.5' })
        t.textContent = short(n.name, Math.max(3, Math.floor(ang * rad / 6)))
      }
    })
  }

  // ── treemap ───────────────────────────────────────────────────────────────────

  _treemap (d3, tree) {
    const W = 400, H = 300
    const root = d3.hierarchy(tree).sum(d => (d.children?.length ? 0 : (d.w ?? 0.05))).sort((a, b) => b.value - a.value)
    d3.treemap().size([W, H]).paddingOuter(3).paddingTop(d => (d.depth === 0 ? 3 : (d.children ? 15 : 0))).paddingInner(2).round(true)(root)
    const svg = this._svg(W, H, 'Treemap chart')
    const clipId = 'ovc-clip-' + Math.random().toString(36).slice(2, 8)
    root.descendants().forEach((d, i) => {
      const n = d.data
      if (d.depth === 0) return
      const w = d.x1 - d.x0, h = d.y1 - d.y0
      const label = `${n.label ?? n.name}${n.detail ? ': ' + n.detail : ''}`
      const grp = this._node(svg, n.key, n, label)
      this._el(grp, 'rect', { class: 'ovc-shape', x: d.x0, y: d.y0, width: Math.max(0, w), height: Math.max(0, h), rx: 3, fill: n.color ?? '#8892a6', 'fill-opacity': d.children ? '0.5' : '1' })
      if (w > 34 && h > 12) {
        const cid = `${clipId}-${i}`
        const cp = this._el(grp, 'clipPath', { id: cid }); this._el(cp, 'rect', { x: d.x0, y: d.y0, width: Math.max(0, w), height: Math.max(0, h) })
        const t = this._el(grp, 'text', { class: 'ovc-label' + (d.children || luma(n.color) < 0.5 ? ' is-light' : ''), 'clip-path': `url(#${cid})`, x: d.x0 + (d.children ? 5 : w / 2), y: d.y0 + (d.children ? 8 : h / 2), 'font-size': '10', 'text-anchor': d.children ? 'start' : 'middle' })
        t.textContent = short(n.name, Math.max(3, Math.floor(w / 6)))
      }
    })
  }

  // ── sankey ────────────────────────────────────────────────────────────────────

  _sankey (d3, sk, graph) {
    const W = 400, H = Math.max(220, Math.min(380, 40 + graph.nodes.length * 20))
    const nodes = graph.nodes.map(n => ({ ...n }))
    const links = graph.links.filter(l => l.value > 0).map(l => ({ ...l }))
    const layout = sk.sankey().nodeId(d => d.id).nodeWidth(12).nodePadding(10).extent([[2, 4], [W - 2, H - 6]])
    if (typeof sk.sankeyLeft === 'function') layout.nodeAlign(sk.sankeyLeft)
    const { nodes: ln, links: ll } = layout({ nodes, links })
    const svg = this._svg(W, H, 'Sankey chart')
    const path = sk.sankeyLinkHorizontal()
    const lg = this._el(svg, 'g')
    ll.forEach((l, i) => {
      const p = this._el(lg, 'path', { class: 'ovc-link', d: path(l), stroke: l.source.color ?? '#8892a6', 'stroke-width': Math.max(1, l.width) })
      const t = document.createElementNS(SVGNS, 'title'); t.textContent = l.label ?? `${l.source.name} → ${l.target.name}`; p.appendChild(t)
    })
    const ng = this._el(svg, 'g')
    ln.forEach(n => {
      const label = `${n.label ?? n.name}${n.detail ? ': ' + n.detail : ''}`
      const grp = this._node(ng, n.id, n, label)
      this._el(grp, 'rect', { class: 'ovc-shape', x: n.x0, y: n.y0, width: Math.max(1, n.x1 - n.x0), height: Math.max(2, n.y1 - n.y0), rx: 2, fill: n.color ?? '#8892a6' })
      const right = n.x0 < W / 2
      const t = this._el(grp, 'text', { class: 'ovc-slabel', x: right ? n.x1 + 5 : n.x0 - 5, y: (n.y0 + n.y1) / 2, 'text-anchor': right ? 'start' : 'end', 'dominant-baseline': 'central' })
      t.textContent = short(n.name, 22)
    })
  }
}
