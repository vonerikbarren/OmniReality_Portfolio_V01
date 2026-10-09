/**
 * ui/OmniExchangeRadial.js — ⟐Exchange: the radial exchange panel (V176, SANDBOX)
 *
 * CENTRE = the object / service being bought (emoji or media thumbnail, name, quantity). SPOKES around it = every EXCHANGE
 * FORM the product accepts (type glyph + "qty × grade"). The numbers ARE the trade: an arc around each spoke encodes the
 * QUANTITY needed (log scale within this product's forms), the dots encode the QUALITY grade (filled up to the grade on that
 * type's own scale, red to green), and "bal" is your balance of that type (spoke dimmed when you cannot pay it).
 *
 *   BUY   spokes = product.price. SELL: spokes = the forms you are willing to ACCEPT (editable, saved on the product).
 *   TAP   a spoke selects it; tap it again to DESCEND three levels, as plain tables in the same panel:
 *           1 the exchange form (what is required, what you pay with, grade, covers?)
 *           2 channels for that type (e.g. USD: Venmo / Bank / Cash / Card: fee %, settle time, your split, must total)
 *           3 line detail (route edges, fees, the STATED remainder, declared intent)
 *         Breadcrumb up / down. Everything shown comes from OmniValueModel.quote() / quoteSell().
 *   LIST  window / wish / cart: ONE list model (utils/OmniStoreModel.js); compare view window vs cart; checkout.
 *
 * V177 will replace level 1 / 2 with D3 views: `#exchange-chart-slot` is the placeholder, and the model already provides
 * toHierarchy(quote) / toFlows(quote).
 *
 * SANDBOX banner always visible. Draggable window (WindowManager id 'omniexchange'); <= 700 px it is a full-width bottom
 * sheet with 44 px targets.
 *
 * Events consumed: omni:exchange-open {productId?, mode?, tab?}, omni:nav-select (⟐OmniExchange), omni:store-changed,
 *   omni:value-changed, omni:panel-restore. Dispatched: omni:exchange-state {open, rect, phone}, omni:exchange-closed,
 *   omni:panel-minimized, omni:notify-info.
 * Module contract: constructor / init / update / destroy / onResize.
 */

import gsap from 'gsap'
import * as WindowManager from './WindowManager.js'
import * as Store from '../utils/OmniStoreModel.js'
import * as Value from '../utils/OmniValueModel.js'
import { handsSafe, DOCK_H } from '../utils/OmniStoreLayout.js'

export const PANEL_ID = 'omniexchange'
const PHONE_MAX = 700
const TIER_COLOR = { primary: '#f5c04a', secondary: '#4cc9b0', tertiary: '#9b8cff', quaternary: '#ff8fa3', quinary: '#7fb4ff' }
const C = 200, R_NODE = 140, NODE_R = 40, CENTRE_R = 70, ARC_R = 45
const LEVEL_NAMES = ['Wheel', 'Form', 'Channels', 'Line detail']

const STYLES = `
.omni-xr-panel { pointer-events: auto; position: fixed; z-index: 61; display: flex; flex-direction: column; overflow: hidden; opacity: 0; visibility: hidden;
  --xr-bg: var(--omni-theme-bg, rgba(8,8,12,.95)); --xr-border: var(--omni-theme-border, rgba(255,255,255,.14)); --xr-text: var(--omni-theme-text, rgba(255,255,255,.93));
  --xr-dim: var(--omni-theme-text-dim, rgba(255,255,255,.62)); --xr-head: var(--omni-theme-header-bg, rgba(255,255,255,.05));
  width: 440px; max-width: calc(100vw - 16px); background: var(--xr-bg); border: 1px solid var(--xr-border); border-radius: 12px; color: var(--xr-text);
  font-family: 'Courier New', Courier, monospace; font-size: 11px; backdrop-filter: blur(20px) saturate(1.5); -webkit-backdrop-filter: blur(20px) saturate(1.5);
  box-shadow: 0 0 20px rgba(0,0,0,.4), 0 10px 30px rgba(0,0,0,.5); }
.xr-header { height: 36px; flex: 0 0 auto; display: flex; align-items: center; gap: 8px; padding: 0 8px 0 12px; background: var(--xr-head); border-bottom: 1px solid var(--xr-border); cursor: grab; user-select: none; touch-action: none; }
.xr-title { letter-spacing: .05em; color: var(--xr-text); pointer-events: none; }
.xr-sandbox { padding: 1px 6px; border-radius: 4px; background: #ffb02e; color: #1b1200; font-weight: bold; letter-spacing: .08em; pointer-events: none; }
.xr-spacer { flex: 1; }
.xr-ctrl { width: 24px; height: 24px; padding: 0; border-radius: 5px; border: 1px solid var(--xr-border); background: rgba(255,255,255,.05); color: var(--xr-dim); cursor: pointer; font: inherit; }
.xr-ctrl:hover { background: rgba(255,255,255,.14); color: var(--xr-text); }
.xr-banner { flex: 0 0 auto; padding: 3px 12px; font-size: 10px; color: #1b1200; background: #ffcf6b; }
.xr-tabs { flex: 0 0 auto; display: flex; gap: 4px; padding: 6px 8px 0; }
.xr-tab { flex: 1; min-height: 32px; font: inherit; color: var(--xr-dim); cursor: pointer; border-radius: 6px 6px 0 0; background: rgba(255,255,255,.04); border: 1px solid var(--xr-border); border-bottom: none; }
.xr-tab.is-active { color: var(--xr-text); background: rgba(255,255,255,.16); }
.xr-body { flex: 1 1 auto; min-height: 0; overflow-y: auto; padding: 8px 10px; border-top: 1px solid var(--xr-border); }
.xr-actions { flex: 0 0 auto; padding: 6px 8px 8px; border-top: 1px solid var(--xr-border); display: flex; flex-direction: column; gap: 5px; background: var(--xr-head); }
.xr-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.xr-btn { min-height: 30px; padding: 3px 10px; font: inherit; color: var(--xr-text); cursor: pointer; border-radius: 6px; background: rgba(255,255,255,.07); border: 1px solid var(--xr-border); }
.xr-btn:hover:not(:disabled) { background: rgba(255,255,255,.17); }
.xr-btn:disabled { opacity: .4; cursor: default; }
.xr-btn.is-on { background: rgba(255,255,255,.25); border-color: rgba(255,255,255,.75); }
.xr-btn.is-primary { background: rgba(255,176,46,.28); border-color: rgba(255,176,46,.8); }
.xr-btn.is-blocked { opacity: .55; }
.xr-state { flex: 1 1 0; min-width: 0; padding-left: 4px; padding-right: 4px; white-space: nowrap; }
.xr-input, .xr-select { min-height: 28px; box-sizing: border-box; padding: 2px 6px; font: inherit; color: var(--xr-text); background: rgba(255,255,255,.07); border: 1px solid var(--xr-border); border-radius: 5px; max-width: 100%; }
.xr-select option { color: #111; background: #fff; }
.xr-input.is-num { width: 84px; }
.xr-prod { width: 100%; }
.xr-wheelwrap { position: relative; width: min(100%, 400px, var(--xr-wheel, 400px)); margin: 4px auto; aspect-ratio: 1; }
.xr-wheelwrap svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
.xr-centre { position: absolute; left: 50%; top: 50%; width: 35%; height: 35%; transform: translate(-50%, -50%); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; text-align: center; pointer-events: none; }
.xr-centre > * { pointer-events: auto; }
.xr-cemoji { font-size: clamp(22px, 8vw, 38px); line-height: 1.05; }
.xr-cimg { width: clamp(30px, 11vw, 52px); height: clamp(30px, 11vw, 52px); object-fit: cover; border-radius: 50%; }
.xr-cname { font-size: 11px; font-weight: bold; line-height: 1.1; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.xr-qty { display: flex; align-items: center; gap: 2px; }
.xr-qty button { width: 30px; height: 30px; padding: 0; font: inherit; font-size: 15px; color: var(--xr-text); cursor: pointer; border-radius: 50%; background: rgba(255,255,255,.1); border: 1px solid var(--xr-border); }
.xr-qty b { min-width: 20px; text-align: center; }
.xr-node { cursor: pointer; outline: none; }
.xr-node .xr-disc { fill: rgba(30,32,44,.92); stroke: rgba(255,255,255,.35); stroke-width: 1.5; }
.xr-node.is-sel .xr-disc { fill: rgba(70,74,96,.98); stroke: #fff; stroke-width: 3; }
.xr-node:focus-visible .xr-disc, .xr-node:hover .xr-disc { stroke: #fff; }
.xr-node.is-low { opacity: .42; }
.xr-node text { fill: #fff; text-anchor: middle; font-family: 'Courier New', Courier, monospace; pointer-events: none; }
.xr-guide { fill: none; stroke: rgba(255,255,255,.1); stroke-width: 1; }
.xr-spoke { stroke: rgba(255,255,255,.18); stroke-width: 2; }
.xr-centredisc { fill: rgba(255,255,255,.07); stroke: rgba(255,255,255,.25); stroke-width: 1.5; }
.xr-crumbs { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; margin-bottom: 6px; }
.xr-crumb { min-height: 28px; padding: 1px 8px; font: inherit; color: var(--xr-text); cursor: pointer; border-radius: 14px; background: rgba(255,255,255,.06); border: 1px solid var(--xr-border); }
.xr-crumb.is-here { background: rgba(255,255,255,.25); border-color: rgba(255,255,255,.7); cursor: default; }
.xr-crumb:disabled:not(.is-here) { opacity: .4; }
table.xr-t { width: 100%; border-collapse: collapse; margin: 4px 0; }
.xr-t th, .xr-t td { padding: 4px 5px; text-align: left; border-bottom: 1px solid rgba(255,255,255,.08); vertical-align: middle; }
.xr-t th { color: var(--xr-dim); font-weight: normal; width: 36%; }
.xr-t tr.is-sel td, .xr-t tr.is-sel th { background: rgba(255,255,255,.1); }
.xr-ok { color: #6ee7a8; } .xr-bad { color: #ff7b7b; } .xr-dim { color: var(--xr-dim); }
.xr-slot { margin: 6px 0; padding: 8px; text-align: center; border: 1px dashed var(--xr-border); border-radius: 8px; color: var(--xr-dim); font-size: 10px; }
.xr-line { padding: 3px 0; border-bottom: 1px dotted rgba(255,255,255,.1); line-height: 1.45; }
.xr-rem { margin: 6px 0; padding: 6px 8px; border-radius: 6px; background: rgba(255,176,46,.14); border: 1px solid rgba(255,176,46,.5); line-height: 1.45; }
.xr-receipt { margin: 6px 0; padding: 6px 8px; border-radius: 6px; background: rgba(110,231,168,.12); border: 1px solid rgba(110,231,168,.5); line-height: 1.45; }
.xr-msg { min-height: 14px; font-size: 10px; } .xr-msg.is-err { color: #ff9b9b; } .xr-msg.is-ok { color: #8ef0b8; }
.xr-sec { margin: 8px 0 2px; color: var(--xr-dim); letter-spacing: .08em; text-transform: uppercase; font-size: 9px; }
.xr-item { display: flex; align-items: center; gap: 5px; padding: 3px 0; border-bottom: 1px solid rgba(255,255,255,.08); flex-wrap: wrap; }
.xr-item .xr-main { flex: 1 1 130px; min-width: 0; cursor: pointer; }
.xr-prodbox { margin-top: 6px; border: 1px solid var(--xr-border); border-radius: 8px; padding: 4px 8px; }
.xr-prodbox summary { cursor: pointer; min-height: 28px; display: flex; align-items: center; }
.xr-chip { min-height: 28px; padding: 1px 9px; font: inherit; color: var(--xr-text); cursor: pointer; border-radius: 14px; background: rgba(255,255,255,.06); border: 1px solid var(--xr-border); }
.xr-chip.is-on { background: rgba(255,255,255,.25); border-color: rgba(255,255,255,.75); }
.xr-chip:disabled { opacity: .35; cursor: default; }
@media (max-width: ${PHONE_MAX}px) {
  .omni-xr-panel { left: 0 !important; right: 0 !important; top: auto !important; bottom: var(--omni-dock-h, 52px); width: 100%; max-width: 100vw; max-height: min(66vh, calc(100vh - var(--omni-top-stack, 200px) - 60px)); border-radius: 14px 14px 0 0; }
  .xr-header { cursor: default; } .xr-btn, .xr-tab, .xr-crumb, .xr-chip { min-height: 44px; } .xr-input, .xr-select { min-height: 44px; font-size: 14px; }
  .xr-qty button { width: 44px; height: 44px; } .xr-ctrl { width: 36px; height: 36px; }
  .xr-centre { width: 38%; height: 38%; } .xr-wheelwrap { width: min(100%, 380px); }
}
`

function injectStyles () {
  if (typeof document === 'undefined' || document.getElementById('omni-xr-styles')) return
  const s = document.createElement('style'); s.id = 'omni-xr-styles'; s.textContent = STYLES; document.head.appendChild(s)
}
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const fmt = Value.fmtQty
const compact = (n) => (n >= 10000 ? (n / 1000).toFixed(0) + 'k' : String(+(+n).toFixed(n < 10 ? 2 : 1)))
const gradeColor = (k, n) => (n <= 1 ? '#bbb' : `hsl(${Math.round((k / (n - 1)) * 120)} 75% 55%)`)

export default class OmniExchangeRadial {
  constructor () {
    this._el = null
    this._isOpen = false
    this._inited = 0
    this.tab = 'buy'            // 'buy' | 'sell' | 'list'
    this.productId = null
    this.qty = 1
    this.sel = null             // selected spoke index
    this.level = 0              // 0 wheel, 1 form, 2 channels, 3 line detail
    this.payType = null         // null = same type as the selected form
    this.payQuality = null
    this.payQtyOverride = null
    this.splitAmt = null        // {channelId: amount} once the user touches a slider
    this.applyRem = false
    this.intent = ''
    this.receipt = null
    this.msg = { text: '', kind: '' }
    this._q = null
    this._renderQueued = false
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  init () {
    this._inited++
    if (this._inited > 1) return
    injectStyles()
    this._on = {
      open: (e) => this.open(e.detail ?? {}),
      nav: (e) => { if (e.detail?.item === '⟐OmniExchange') this.open({}) },
      changed: () => this._queueRender(),
      restore: (e) => { if (e.detail?.id === PANEL_ID) this.open({}) },
      resize: () => { if (this._isOpen) this._place(false) },
    }
    window.addEventListener('omni:exchange-open', this._on.open)
    window.addEventListener('omni:nav-select', this._on.nav)
    window.addEventListener(Store.CHANGED_EVENT, this._on.changed)
    window.addEventListener(Value.CHANGED_EVENT, this._on.changed)
    window.addEventListener('omni:panel-restore', this._on.restore)
    window.addEventListener('resize', this._on.resize)
    window.addEventListener('omni:layout-changed', this._on.resize)
  }

  update () {}
  onResize () { if (this._isOpen) this._place(false) }

  destroy () {
    if (!this._inited) return
    window.removeEventListener('omni:exchange-open', this._on.open)
    window.removeEventListener('omni:nav-select', this._on.nav)
    window.removeEventListener(Store.CHANGED_EVENT, this._on.changed)
    window.removeEventListener(Value.CHANGED_EVENT, this._on.changed)
    window.removeEventListener('omni:panel-restore', this._on.restore)
    window.removeEventListener('resize', this._on.resize)
    window.removeEventListener('omni:layout-changed', this._on.resize)
    this._unbindHeader?.()
    this._el?.parentNode?.removeChild(this._el)
    WindowManager.unregister(PANEL_ID)
    this._inited = 0
  }

  // ── Open / close ────────────────────────────────────────────────────────────

  get isOpen () { return this._isOpen }
  get isPhone () { return window.innerWidth <= PHONE_MAX }

  open ({ productId, mode, tab } = {}) {
    if (!this._el) this._el = this._buildDOM()
    const shell = document.getElementById('omni-ui') ?? document.body
    if (!this._el.parentNode) shell.appendChild(this._el)
    if (productId && Store.getProduct(productId)) {
      if (productId !== this.productId) this._resetSelection()
      this.productId = productId
    }
    if (!this.productId) this.productId = Store.getProducts()[0]?.id ?? null
    const t = tab ?? (mode === 'sell' ? 'sell' : (mode === 'buy' ? 'buy' : null))
    if (t && ['buy', 'sell', 'list'].includes(t)) { if (t !== this.tab) this._resetSelection(); this.tab = t }
    this._isOpen = true
    this.receipt = productId ? null : this.receipt
    this._render()
    gsap.killTweensOf(this._el)
    this._el.style.visibility = 'visible'
    this._place(true)
    gsap.to(this._el, { opacity: WindowManager.getPanelOpacity(), duration: 0.2 })
    WindowManager.bringToFront(PANEL_ID)
    this._emitState()
    return this
  }

  close () {
    if (!this._el || !this._isOpen) return
    gsap.killTweensOf(this._el)
    gsap.to(this._el, { opacity: 0, duration: 0.15, onComplete: () => { if (!this._isOpen) this._el.style.visibility = 'hidden' } })
    this._isOpen = false
    this._emitState()
    window.dispatchEvent(new CustomEvent('omni:exchange-closed'))
  }

  minimize () {
    if (!this._el || !this._isOpen) return
    const rect = this._el.getBoundingClientRect()
    gsap.to(this._el, { opacity: 0, duration: 0.18, onComplete: () => { if (!this._isOpen) this._el.style.visibility = 'hidden' } })
    this._isOpen = false
    this._emitState()
    window.dispatchEvent(new CustomEvent('omni:exchange-closed'))
    window.dispatchEvent(new CustomEvent('omni:panel-minimized', { detail: { id: PANEL_ID, label: '⟐Exchange', iconLabel: '⟐XC', fromRect: { x: rect.left, y: rect.top, w: rect.width, h: rect.height }, variant: 'app' } }))
  }

  _emitState () {
    const r = this._el && this._isOpen ? this._el.getBoundingClientRect() : null
    window.dispatchEvent(new CustomEvent('omni:exchange-state', { detail: { open: this._isOpen, phone: this.isPhone, rect: r ? { x: r.left, y: r.top, w: r.width, h: r.height } : null } }))
  }

  /** Desktop: right side, below the ribbon, left of the right-hand hands; phone: CSS bottom sheet. */
  _place (initial) {
    const el = this._el
    if (!el) return
    if (this.isPhone) { el.style.left = ''; el.style.top = ''; el.style.right = ''; el.style.maxHeight = ''; this._fitWheel(); this._emitState(); return }
    if (!initial && el.dataset.moved === '1') { this._fitWheel(); this._emitState(); return }
    const W = window.innerWidth, H = window.innerHeight
    const w = Math.min(440, W - 16)
    const top = (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--omni-top-offset')) || 96) + 8
    const bottom = H - DOCK_H - 8
    const sf = handsSafe(top, bottom)
    const right = Math.min(W - 12, sf.right)
    const left = Math.max(8, right - w)
    el.style.left = left + 'px'
    el.style.top = top + 'px'
    el.style.right = 'auto'
    el.style.maxHeight = Math.max(260, bottom - top) + 'px'
    this._fitWheel()
    this._emitState()
  }

  /** Size the wheel to the room the panel has left, so spokes and the qty control are not scrolled away. */
  _fitWheel () {
    const body = this._refs?.body
    if (!body || !this._el) return
    const avail = body.clientHeight - 150   // product select + breadcrumb + caption + product box summary
    const px = Math.max(250, Math.min(400, avail > 0 ? avail : 400))
    this._el.style.setProperty('--xr-wheel', px + 'px')
  }

  _resetSelection () {
    this.sel = null; this.level = 0; this.payType = null; this.payQuality = null; this.payQtyOverride = null; this.splitAmt = null; this.qty = 1
    this.receipt = null; this.msg = { text: '', kind: '' }
  }

  // ── Derived state ───────────────────────────────────────────────────────────

  get product () { return this.productId ? Store.getProduct(this.productId) : null }
  get forms () { const p = this.product; return !p ? [] : (this.tab === 'sell' ? Store.acceptForms(p.id) : p.price) }
  get form () { return this.sel != null ? (this.forms[this.sel] ?? null) : null }

  /** Everything level 1-3 needs for the selected form, computed by the value model. */
  _compute () {
    const p = this.product, f = this.form
    if (!p || !f) return null
    const t = Value.getType(f.type)
    if (this.tab === 'sell') {
      const total = Value.clean(f.qty * this.qty)
      const split = this.splitAmt ?? undefined
      const qs = Value.quoteSell({ itemId: p.id, itemQty: this.qty, receive: { type: f.type, qty: f.qty, quality: f.quality }, split })
      return { mode: 'sell', f, t, payType: f.type, payT: t, payQuality: f.quality, payQty: total, requiredQty: total, qs }
    }
    const payType = this.payType ?? f.type
    const payT = Value.getType(payType)
    const payQuality = this.payQuality && payT.qualityScale.some(s => s.id === this.payQuality) ? this.payQuality : (payType === f.type ? (f.quality ?? payT.refQuality) : payT.refQuality)
    const want = { type: f.type, qty: Value.clean(f.qty * this.qty), quality: f.quality }
    const probe = Value.quote({ type: payType, qty: 1, quality: payQuality }, want, { applyRemainder: this.applyRem })
    const neededQty = probe.offerNeeded?.qty ?? null
    const payQty = this.payQtyOverride != null ? this.payQtyOverride : (neededQty ?? want.qty)
    const split = this.splitAmt ?? undefined
    const qt = Value.quote({ type: payType, qty: payQty, quality: payQuality, split }, want, { applyRemainder: this.applyRem })
    return { mode: 'buy', f, t, payType, payT, payQuality, payQty, neededQty, want, qt }
  }

  _chosenForm (c) {
    // the one list item stores shares, not absolute amounts, so it survives a quantity change
    const out = { type: c.f.type, qty: c.f.qty, quality: c.f.quality, channel: null }
    if (c.payType !== c.f.type) out.payType = c.payType
    if (c.payQuality && (c.payType !== c.f.type || c.payQuality !== c.f.quality)) out.payQuality = c.payQuality
    if (this.splitAmt) {
      const total = Object.values(this.splitAmt).reduce((s, v) => s + v, 0)
      if (total > 0) { const sh = {}; Object.keys(this.splitAmt).forEach(k => { if (this.splitAmt[k] > 0) sh[k] = Value.clean(this.splitAmt[k] / total) }); out.split = sh; out.channel = Object.keys(sh).sort((a, b) => sh[b] - sh[a])[0] }
    }
    return out
  }

  // ── Rendering ───────────────────────────────────────────────────────────────

  _queueRender () {
    if (!this._isOpen || this._renderQueued) return
    this._renderQueued = true
    const run = () => { this._renderQueued = false; if (this._isOpen) this._render() }
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run); else setTimeout(run, 0)
  }

  _render () {
    if (!this._el) return
    const r = this._refs
    this._q = this._compute()
    r.tabs.forEach(b => { const on = b.dataset.tab === this.tab; b.classList.toggle('is-active', on); b.setAttribute('aria-selected', on ? 'true' : 'false') })
    const keepScroll = r.body.scrollTop
    r.body.innerHTML = this.tab === 'list' ? this._listHtml() : this._tradeHtml()
    r.body.scrollTop = keepScroll
    r.actions.innerHTML = this._actionsHtml()
    this._fitWheel()
    this._setMsg(this.msg.text, this.msg.kind)
    this._bindBody()
  }

  _setMsg (text, kind = '') {
    this.msg = { text, kind }
    const m = this._el?.querySelector('.xr-msg')
    if (m) { m.textContent = text; m.className = 'xr-msg' + (kind ? ' is-' + kind : '') }
  }

  _crumbsHtml () {
    const items = LEVEL_NAMES.map((n, i) => {
      const disabled = this.sel == null && i > 0
      return `<button type="button" class="xr-crumb${i === this.level ? ' is-here' : ''}" data-act="level:${i}" ${disabled ? 'disabled' : ''} aria-current="${i === this.level ? 'step' : 'false'}">${i === 0 ? '◎ ' : ''}${esc(n)}</button>`
    })
    return `<div class="xr-crumbs" role="navigation" aria-label="Exchange levels">${items.join('<span class="xr-dim">›</span>')}
      <span class="xr-spacer" style="flex:1"></span>
      <button type="button" class="xr-crumb" data-act="up" ${this.level === 0 ? 'disabled' : ''} aria-label="Up one level" title="Up one level">▲</button>
      <button type="button" class="xr-crumb" data-act="down" ${this.sel == null || this.level >= 3 ? 'disabled' : ''} aria-label="Down one level" title="Down one level (or tap the selected spoke again)">▼</button></div>`
  }

  _tradeHtml () {
    const p = this.product
    const prods = Store.getProducts()
    const select = `<select class="xr-select xr-prod" data-bind="product" aria-label="Product">${prods.map(x => `<option value="${esc(x.id)}"${x.id === this.productId ? ' selected' : ''}>${esc(x.emoji)} ${esc(x.name)}</option>`).join('')}</select>`
    if (!p) return select + '<p class="xr-dim">Click a product on the shelf, or pick one above.</p>'
    let html = select + this._crumbsHtml()
    if (this.receipt) html += this._receiptHtml(this.receipt)
    if (this.level === 0) html += this._wheelHtml(p) + this._prodBoxHtml(p)
    else if (this.level === 1) html += this._level1Html()
    else if (this.level === 2) html += this._level2Html()
    else html += this._level3Html()
    return html
  }

  // level 0 ---------------------------------------------------------------------

  _wheelHtml (p) {
    const forms = this.forms, N = forms.length
    const lg = (f) => Math.log2(1 + f.qty * this.qty)
    const maxLg = Math.max(0.001, ...forms.map(lg))
    let nodes = ''
    let spokes = ''
    forms.forEach((f, i) => {
      const t = Value.getType(f.type)
      const a = (-90 + (360 * i) / N) * Math.PI / 180
      const x = C + R_NODE * Math.cos(a), y = C + R_NODE * Math.sin(a)
      const x0 = C + CENTRE_R * Math.cos(a), y0 = C + CENTRE_R * Math.sin(a)
      const x1 = C + (R_NODE - NODE_R) * Math.cos(a), y1 = C + (R_NODE - NODE_R) * Math.sin(a)
      spokes += `<line class="xr-spoke" x1="${x0.toFixed(1)}" y1="${y0.toFixed(1)}" x2="${x1.toFixed(1)}" y2="${y1.toFixed(1)}"/>`
      const frac = Math.max(0.1, lg(f) / maxLg)
      const circ = 2 * Math.PI * ARC_R
      const qi = Value.qualityIndex(f.type, f.quality)
      const scale = t?.qualityScale ?? []
      const qLabel = t?.qualityScale.find(s => s.id === (f.quality ?? t.refQuality))?.label ?? ''
      const have = Value.getBalance(f.type)
      const need = Value.clean(f.qty * this.qty)
      const low = this.tab !== 'sell' && have + 1e-9 < need
      const dotN = scale.length, gap = 9, dx0 = -((dotN - 1) * gap) / 2
      const dots = scale.map((s, k) => `<circle cx="${(dx0 + k * gap).toFixed(1)}" cy="17" r="3" fill="${k <= qi ? gradeColor(k, dotN) : 'none'}" stroke="${gradeColor(k, dotN)}" stroke-width="1"/>`).join('')
      const aria = `${Value.describeForm({ type: f.type, qty: need, quality: f.quality })}; you have ${fmt(have)}${low ? ' (not enough)' : ''}`
      nodes += `<g class="xr-node${i === this.sel ? ' is-sel' : ''}${low ? ' is-low' : ''}" data-spoke="${i}" role="button" tabindex="0" aria-label="${esc(aria)}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})">
        <title>${esc(aria)}</title>
        <circle class="xr-hit xr-disc" r="${NODE_R}"/>
        <circle r="${ARC_R}" fill="none" stroke="${TIER_COLOR[t?.tier] ?? '#ccc'}" stroke-width="5" stroke-linecap="round" stroke-dasharray="${(frac * circ).toFixed(1)} ${circ.toFixed(1)}" transform="rotate(-90)" opacity=".9"/>
        <text y="-14" font-size="22">${esc(t?.emoji ?? '◇')}</text>
        <text y="5" font-size="14" font-weight="bold">${esc(fmt(need))}×${esc(qLabel.slice(0, 5))}</text>
        ${dots}
        <text y="31" font-size="10.5" fill-opacity=".8">bal ${esc(compact(have))}</text>
      </g>`
    })
    const media = p.media.active === 'image' && p.media.image ? `<img class="xr-cimg" alt="" src="${esc(p.media.image)}">` : `<div class="xr-cemoji">${esc(p.media.emoji)}</div>`
    const modeLabel = this.tab === 'sell' ? 'You offer' : 'You buy'
    return `<div class="xr-wheelwrap" data-testid="wheel">
      <svg viewBox="0 0 400 400" role="group" aria-label="${esc(modeLabel)} ${esc(p.name)}: accepted exchange forms">
        <circle class="xr-guide" cx="${C}" cy="${C}" r="${R_NODE}"/><circle class="xr-centredisc" cx="${C}" cy="${C}" r="${CENTRE_R}"/>${spokes}${nodes}
      </svg>
      <div class="xr-centre">${media}<div class="xr-cname" title="${esc(p.name)}">${esc(p.name)}</div>
        <div class="xr-qty"><button type="button" data-act="qty:-1" aria-label="Less">−</button><b>${this.qty}</b><button type="button" data-act="qty:1" aria-label="More">+</button></div>
        <div class="xr-dim" style="font-size:9px">${esc(modeLabel)}</div></div>
    </div>
    <div class="xr-dim" style="text-align:center;margin-bottom:4px">${N} exchange form${N === 1 ? '' : 's'}. Arc = quantity (log scale), dots = grade. ${this.sel == null ? 'Tap a spoke to choose it.' : 'Tap the chosen spoke again to go down.'}</div>`
  }

  _prodBoxHtml (p) {
    const kinds = ['emoji', 'image', 'video']
    const chips = kinds.map(k => `<button type="button" class="xr-chip${p.media.active === k ? ' is-on' : ''}" data-act="media:${k}" ${Store.hasMedia(p, k) ? '' : 'disabled'} title="${k}${Store.hasMedia(p, k) ? '' : ' (none attached)'}">${k}</button>`).join('')
    const shapes = Store.SHAPES.map(s => `<button type="button" class="xr-chip${p.shape === s ? ' is-on' : ''}" data-act="shape:${s}">${s}</button>`).join('')
    const stats = p.stats
    const avg = p.reviews.length ? (p.reviews.reduce((s, r) => s + r.rating, 0) / p.reviews.length).toFixed(1) : '—'
    const ct = Object.keys(stats.customerTypes).map(k => `${esc(k)} ${stats.customerTypes[k]}`).join(', ')
    return `<details class="xr-prodbox" data-testid="prodbox"><summary>Product · media · lifecycle</summary>
      <div class="xr-row" style="margin:4px 0"><span class="xr-dim">Shows</span>${chips}</div>
      <div class="xr-row" style="margin:4px 0"><span class="xr-dim">Shape</span>${shapes}</div>
      <div class="xr-row" style="margin:4px 0"><input class="xr-input" data-field="emoji" size="4" value="${esc(p.media.emoji)}" aria-label="Emoji"><button type="button" class="xr-chip" data-act="set:emoji">Set emoji</button></div>
      <div class="xr-row" style="margin:4px 0"><input class="xr-input" data-field="image" placeholder="image URL (https://…) or pick a file" style="flex:1;min-width:0" aria-label="Image URL"><button type="button" class="xr-chip" data-act="set:image">Set image</button>
        <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" data-field="imagefile" aria-label="Image file (max 512 KB)"><button type="button" class="xr-chip" data-act="clear:image" ${p.media.image ? '' : 'disabled'}>Clear</button></div>
      <div class="xr-row" style="margin:4px 0"><input class="xr-input" data-field="video" placeholder="video URL (https://…) — URL only" style="flex:1;min-width:0" aria-label="Video URL"><button type="button" class="xr-chip" data-act="set:video">Set video</button><button type="button" class="xr-chip" data-act="clear:video" ${p.media.video ? '' : 'disabled'}>Clear</button></div>
      <div class="xr-dim" style="line-height:1.5">Stock ${p.stock} · lot grade ${esc(p.quality)} (self-reported) · ${stats.purchases} bought · influence ${stats.influence} · reviews ${p.reviews.length} (avg ${avg}) · customers: ${ct || '—'}<br>
      Lifecycle (data only, a later scene): ${p.lifecycle.map(l => esc(l.stage)).join(' › ')}</div></details>`
  }

  // level 1 ---------------------------------------------------------------------

  _level1Html () {
    const c = this._q
    if (!c) return '<p class="xr-dim">Pick a spoke first.</p>'
    if (c.mode === 'sell') return this._sellForms()
    const { f, t, payT, qt } = c
    const scale = t.qualityScale.map(s => `<span${s.id === (f.quality ?? t.refQuality) ? ' style="color:#fff;font-weight:bold"' : ''}>${esc(s.label)} ${s.weight}</span>`).join(' · ')
    const typeOpts = Value.getTypes().filter(x => x.payable).map(x => `<option value="${esc(x.id)}"${x.id === c.payType ? ' selected' : ''}>${esc(x.emoji)} ${esc(x.name)}</option>`).join('')
    const qOpts = payT.qualityScale.map(s => `<option value="${esc(s.id)}"${s.id === c.payQuality ? ' selected' : ''}>${esc(s.label)} (×${s.weight})</option>`).join('')
    const remAvail = Value.getRemainderTotal(f.type)
    return `<table class="xr-t" data-testid="level1"><tbody>
      <tr><th>Required</th><td><b>${esc(Value.describeForm({ type: f.type, qty: c.want.qty, quality: f.quality }))}</b> for ${this.qty} × ${esc(this.product.name)}</td></tr>
      <tr><th>Value type</th><td>${esc(t.emoji)} ${esc(t.name)} · ${esc(t.tier)} · unit ${esc(t.unit)} (step ${t.step})</td></tr>
      <tr><th>Grade scale</th><td class="xr-dim">${scale}<br>assessment: ${esc(t.assessment)}</td></tr>
      <tr><th>You pay in</th><td><select class="xr-select" data-bind="payType" aria-label="Pay in">${typeOpts}</select></td></tr>
      <tr><th>Grade</th><td><select class="xr-select" data-bind="payQuality" aria-label="Payment grade">${qOpts}</select></td></tr>
      <tr><th>Pay qty</th><td><input class="xr-input is-num" type="number" min="0" step="${payT.step}" value="${c.payQty}" data-bind="payQty" aria-label="Pay quantity"> <button type="button" class="xr-chip" data-act="needed" ${c.neededQty == null ? 'disabled' : ''}>use needed${c.neededQty != null ? ' (' + fmt(c.neededQty) + ')' : ''}</button></td></tr>
      <tr><th>Balance</th><td class="${qt.balanceOk ? 'xr-ok' : 'xr-bad'}">${fmt(qt.balance)} ${esc(payT.name)}${qt.balanceOk ? '' : ' — not enough for ' + fmt(qt.debit)}</td></tr>
      <tr><th>Covers?</th><td class="${qt.covers ? 'xr-ok' : 'xr-bad'}">${qt.covers ? 'yes' + (qt.surplus > 1e-9 ? ' — surplus ' + fmt(qt.surplus) + ' ' + esc(t.name) + ' (stated as remainder)' : ' — exactly') : 'no — ' + esc(qt.reasons[0] ?? qt.block ?? '')}</td></tr>
      ${remAvail > 0 ? `<tr><th>Remainder</th><td><label><input type="checkbox" data-bind="applyRem" ${this.applyRem ? 'checked' : ''}> use my stated ${fmt(remAvail)} ${esc(t.name)} remainder</label></td></tr>` : ''}
    </tbody></table>
    <div id="exchange-chart-slot" class="xr-slot" data-level="1">Chart slot — D3 views arrive in V177 (the model already derives toHierarchy / toFlows for this quote).</div>`
  }

  _sellForms () {
    const p = this.product
    const forms = this.forms
    const rows = forms.map((f, i) => {
      const t = Value.getType(f.type)
      const qOpts = t.qualityScale.map(s => `<option value="${esc(s.id)}"${s.id === (f.quality ?? t.refQuality) ? ' selected' : ''}>${esc(s.label)}</option>`).join('')
      return `<tr class="${i === this.sel ? 'is-sel' : ''}"><td>${esc(t.emoji)} ${esc(t.name)}</td>
        <td><input class="xr-input is-num" type="number" min="0" step="${t.step}" value="${f.qty}" data-accept="${i}" data-key="qty" aria-label="Quantity of ${esc(t.name)}"></td>
        <td><select class="xr-select" data-accept="${i}" data-key="quality" aria-label="Grade of ${esc(t.name)}">${qOpts}</select></td>
        <td><button type="button" class="xr-chip" data-act="acceptdel:${i}" ${forms.length < 2 ? 'disabled' : ''} aria-label="Remove form">✕</button></td></tr>`
    }).join('')
    const opts = Value.getTypes().map(x => `<option value="${esc(x.id)}">${esc(x.emoji)} ${esc(x.name)}</option>`).join('')
    return `<div class="xr-dim">Forms you are willing to accept for ${esc(p.name)} (saved on the product):</div>
      <table class="xr-t" data-testid="level1"><thead><tr><th style="width:auto">Form</th><th style="width:auto">Qty</th><th style="width:auto">Grade</th><th style="width:auto"></th></tr></thead><tbody>${rows}</tbody></table>
      <div class="xr-row"><select class="xr-select" data-bind="acceptAddType" aria-label="Add accepted form">${opts}</select><button type="button" class="xr-chip" data-act="acceptadd" ${forms.length >= Store.LIMITS.forms ? 'disabled' : ''}>＋ accept this form</button></div>
      <div id="exchange-chart-slot" class="xr-slot" data-level="1">Chart slot — D3 views arrive in V177.</div>`
  }

  // level 2 ---------------------------------------------------------------------

  _level2Html () {
    const c = this._q
    if (!c) return '<p class="xr-dim">Pick a spoke first.</p>'
    const T = c.payT
    const total = c.mode === 'sell' ? c.requiredQty : c.payQty
    const split = this.splitAmt ?? (c.mode === 'sell' ? (c.qs?.fees ? Object.fromEntries(c.qs.fees.map(f => [f.channel, f.amount])) : {}) : Object.fromEntries((c.qt.fees ?? []).map(f => [f.channel, f.amount])))
    const sum = Value.clean(Object.values(split).reduce((s, v) => s + (+v || 0), 0))
    const rows = T.channels.map(ch => {
      const amt = split[ch.id] ?? 0
      const fee = ch.feePct > 0 ? Math.ceil(amt * ch.feePct / 100 / T.step - 1e-9) * T.step : 0
      return `<tr><th>${esc(ch.name)}<br><span class="xr-dim">${fmt(ch.feePct)} % fee · settles ${fmt(ch.settleHours)} h</span></th>
        <td><input type="range" min="0" max="${total}" step="${T.step}" value="${amt}" data-ch="${esc(ch.id)}" aria-label="${esc(ch.name)} share" style="width:100%"></td>
        <td style="width:84px"><input class="xr-input is-num" type="number" min="0" max="${total}" step="${T.step}" value="${amt}" data-chnum="${esc(ch.id)}" aria-label="${esc(ch.name)} amount"><div class="xr-dim" data-feeout="${esc(ch.id)}">fee ${fmt(fee)}</div></td></tr>`
    }).join('')
    const okSum = Math.abs(sum - total) < 1e-6
    return `<div class="xr-dim">${c.mode === 'sell' ? 'How the' : 'How your'} <b>${fmt(total)} ${esc(T.name)}</b> ${c.mode === 'sell' ? 'arrives' : 'is paid'}, by channel (${esc(T.emoji)} ${esc(T.name)}). The split must total ${fmt(total)}.</div>
      <table class="xr-t" data-testid="level2"><tbody>${rows}</tbody></table>
      <div class="xr-row"><span data-sumout class="${okSum ? 'xr-ok' : 'xr-bad'}">split totals ${fmt(sum)} of ${fmt(total)} ${okSum ? '✓' : '✗ must equal ' + fmt(total)}</span>
        <button type="button" class="xr-chip" data-act="split:cheapest">cheapest</button><button type="button" class="xr-chip" data-act="split:even">even</button><button type="button" class="xr-chip" data-act="split:reset">reset</button></div>
      <div id="exchange-chart-slot" class="xr-slot" data-level="2">Chart slot — D3 views arrive in V177.</div>`
  }

  // level 3 ---------------------------------------------------------------------

  _level3Html () {
    const c = this._q
    if (!c) return '<p class="xr-dim">Pick a spoke first.</p>'
    const intent = `<div class="xr-sec">Declared intent — Desire(), forward only</div>
      <textarea class="xr-input" data-bind="intent" rows="2" maxlength="${Value.LIMITS.note}" style="width:100%" placeholder="Why this trade? (optional, low weight by design)" aria-label="Declared intent">${esc(this.intent)}</textarea>
      <div class="xr-dim" style="font-size:9px;line-height:1.4">Stored with the trade as declaredIntent {note, t}. The backward PrimaryForce() pattern and the affidavit are not built; the system renders no verdict.</div>`
    if (c.mode === 'sell') {
      const qs = c.qs
      return `<div data-testid="level3">${qs.statement.map(l => `<div class="xr-line">${esc(l)}</div>`).join('')}
        <div class="xr-rem">${esc(qs.remainder.statedLine)}</div>
        ${qs.canExecute ? '' : `<div class="xr-bad">Blocked: ${esc(qs.block ?? qs.error)}</div>`}${intent}</div>`
    }
    const qt = c.qt
    const edgeRows = qt.path.map(id => {
      const e = Value.getEdge(id)
      return `<tr><td>${esc(e.id)}</td><td>${esc(Value.getType(e.fromType)?.name)} → ${esc(Value.getType(e.toType)?.name)}</td><td>${fmt(e.rateDen)} : ${fmt(e.rateNum)}</td><td>${e.minQty ? 'min ' + fmt(e.minQty) : ''}${e.qualityRule ? ' grade ≥ ' + fmt(e.qualityRule.minWeight) : ''}${e.owner ? ' owner ' + esc(e.owner) : ''}</td></tr>`
    }).join('')
    const feeRows = qt.fees.map(f => `<tr><td>${esc(f.name)}</td><td>${fmt(f.amount)}</td><td>${fmt(f.feePct)} %</td><td>${fmt(f.fee)}</td></tr>`).join('')
    const after = Value.clean(qt.balance - qt.debit)
    return `<div data-testid="level3">
      ${qt.statement.map(l => `<div class="xr-line">${esc(l)}</div>`).join('')}
      <div class="xr-sec">Conversion path</div>
      ${qt.path.length ? `<table class="xr-t"><thead><tr><th style="width:auto">edge</th><th style="width:auto">pair</th><th style="width:auto">rate</th><th style="width:auto">rule</th></tr></thead><tbody>${edgeRows}</tbody></table>` : `<div class="xr-dim">${c.payType === c.f.type ? 'Direct: same value type, no conversion.' : 'No route.'}</div>`}
      ${qt.alternatives.length ? `<div class="xr-dim" style="font-size:9px">Other methods: ${qt.alternatives.map(a => esc(a.labels.join(' then ') || 'direct') + (a.valid ? '' : ' (blocked)')).join(' · ')}</div>` : ''}
      <div class="xr-sec">Fees</div>
      ${qt.fees.length ? `<table class="xr-t"><thead><tr><th style="width:auto">channel</th><th style="width:auto">amount</th><th style="width:auto">fee %</th><th style="width:auto">fee</th></tr></thead><tbody>${feeRows}</tbody></table>` : '<div class="xr-dim">none</div>'}
      <div class="xr-line">Total debit <b>${fmt(qt.debit)} ${esc(c.payT.name)}</b> · balance ${fmt(qt.balance)} → <span class="${after >= 0 ? 'xr-ok' : 'xr-bad'}">${fmt(after)}</span></div>
      <div class="xr-rem" data-testid="remainder">${esc(qt.remainder.statedLine)}</div>
      ${qt.canExecute ? '<div class="xr-ok">Ready: this trade can execute (sandbox).</div>' : `<div class="xr-bad">Blocked: ${esc(qt.reasons.join('; ') || qt.block)}</div>`}
      ${intent}</div>`
  }

  _receiptHtml (tx) {
    const legs = tx.legs.map(l => `${l.dir === 'out' ? '−' : '+'}${fmt(l.qty)} ${esc(Value.getType(l.type)?.name ?? l.type)} via ${esc(l.channel)}${l.fee ? ` (fee ${fmt(l.fee)})` : ''}`).join(' · ')
    return `<div class="xr-receipt" data-testid="receipt" role="status"><b>Receipt ${esc(tx.id)}</b> — ${tx.kind === 'buy' ? 'bought' : 'sold'} ${fmt(tx.itemQty)} × ${esc(tx.itemName)} <span class="xr-dim">(SANDBOX, settled instantly)</span><br>${legs}<br>${esc(tx.remainder.line)}${tx.declaredIntent ? `<br><span class="xr-dim">intent: ${esc(tx.declaredIntent.note)}</span>` : ''}</div>`
  }

  // list tab --------------------------------------------------------------------

  _itemRow (it) {
    const p = Store.getProduct(it.productId)
    const f = Store.formFor(it)
    const move = Store.LIST_STATES.filter(s => s !== it.state).map(s => `<button type="button" class="xr-chip" data-act="move:${esc(it.id)}:${s}" title="Move to ${s}" aria-label="Move ${esc(p?.name)} to ${s}">→${s === 'window' ? 'win' : s}</button>`).join('')
    return `<div class="xr-item" data-item="${esc(it.id)}"><span class="xr-main" data-act="pick:${esc(it.productId)}" title="Open in the exchange">${esc(p?.emoji)} ${esc(p?.name)}</span>
      <span class="xr-qty"><button type="button" data-act="iqty:${esc(it.id)}:-1" aria-label="Less">−</button><b>${it.qty}</b><button type="button" data-act="iqty:${esc(it.id)}:1" aria-label="More">+</button></span>
      <span class="xr-dim">${f ? esc(Value.describeForm({ ...f, qty: Value.clean(f.qty * it.qty) })) : ''}</span>${move}<button type="button" class="xr-chip" data-act="del:${esc(it.id)}" aria-label="Remove">✕</button></div>`
  }

  _totalsHtml (t) {
    const keys = Object.keys(t)
    return keys.length ? keys.map(k => `${fmt(t[k])} ${esc(Value.getType(k)?.name ?? k)}`).join(' + ') : '—'
  }

  _listHtml () {
    const sec = (state, title) => {
      const items = Store.getList(state)
      return `<div class="xr-sec">${title} (${items.length})</div>${items.length ? items.map(i => this._itemRow(i)).join('') : '<div class="xr-dim">empty</div>'}`
    }
    const cmp = Store.compare()
    const rows = cmp.rows.map(r => {
      const side = (s) => (s ? `${s.qty} × ${esc(s.form ? Value.describeForm(s.form) : '—')}` : '<span class="xr-dim">—</span>')
      return `<tr><td>${esc(r.emoji)} ${esc(r.name)}</td><td>${side(r.window)}</td><td>${side(r.cart)}</td><td class="${r.status === 'same' ? 'xr-ok' : (r.status === 'differs' ? 'xr-bad' : 'xr-dim')}">${esc(r.status)}</td></tr>`
    }).join('')
    const deltaKeys = Object.keys(cmp.delta).filter(k => cmp.delta[k] !== 0)
    const remTypes = Object.keys(Value.getRemainders()).filter(k => Value.getRemainderTotal(k) > 0)
    return `<div data-testid="list">${sec('window', '◌ Window-shop (browsing reality)')}${sec('wish', '♡ Wishlist')}${sec('cart', '🛒 Cart (to buy)')}
      <div class="xr-sec">Compare: window reality vs cart</div>
      ${cmp.rows.length ? `<table class="xr-t" data-testid="compare"><thead><tr><th style="width:auto">product</th><th style="width:auto">window</th><th style="width:auto">cart</th><th style="width:auto">state</th></tr></thead><tbody>${rows}</tbody></table>` : '<div class="xr-dim">Nothing in window or cart yet.</div>'}
      <div class="xr-line">Window total: ${this._totalsHtml(cmp.totals.window)}</div>
      <div class="xr-line">Cart total: ${this._totalsHtml(cmp.totals.cart)}</div>
      <div class="xr-line">Cart − window: ${deltaKeys.length ? deltaKeys.map(k => `${cmp.delta[k] > 0 ? '+' : ''}${fmt(cmp.delta[k])} ${esc(Value.getType(k)?.name ?? k)}`).join(', ') : 'no difference'}</div>
      <div class="xr-dim" style="font-size:9px">Totals are per value type; different types are never summed into one number.</div>
      <div class="xr-row" style="margin-top:6px">${remTypes.length ? `<label><input type="checkbox" data-bind="applyRem" ${this.applyRem ? 'checked' : ''}> use stated remainders</label>` : ''}
        <button type="button" class="xr-btn is-primary" data-act="checkout" ${Store.getList('cart').length ? '' : 'disabled'}>Checkout cart (sandbox)</button></div>
      ${this.receipt && Array.isArray(this.receipt) ? this.receipt.map(tx => this._receiptHtml(tx)).join('') : ''}</div>`
  }

  // actions bar -----------------------------------------------------------------

  _actionsHtml () {
    const p = this.product
    if (this.tab === 'list' || !p) return '<div class="xr-msg" role="status" aria-live="polite"></div>'
    if (this.tab === 'sell') {
      return `<div class="xr-row"><button type="button" class="xr-btn is-primary xr-state${this._q?.qs?.canExecute ? '' : ' is-blocked'}" data-act="sell" ${this.sel == null ? 'disabled' : ''}>Sell now</button></div><div class="xr-msg" role="status" aria-live="polite"></div>`
    }
    const mk = (state, label) => {
      const it = Store.getItemFor(p.id, state)
      return `<button type="button" class="xr-btn xr-state${it ? ' is-on' : ''}" data-act="list:${state}" title="${it ? 'In ' + state + ' ×' + it.qty + ' — click to update' : 'Add to ' + state}">${label}${it ? ' ×' + it.qty : ''}</button>`
    }
    const ok = this._q?.qt?.canExecute
    return `<div class="xr-row" style="flex-wrap:nowrap">${mk('window', '◌ Window')}${mk('wish', '♡ Wish')}${mk('cart', '🛒 Cart')}
      <button type="button" class="xr-btn is-primary xr-state${ok ? '' : ' is-blocked'}" data-act="buy" ${this.sel == null ? 'disabled' : ''} data-omni-tip="Buy now" data-omni-tip-desc="Executes this trade through the sandbox ledger. Fake value only.">Buy now</button></div>
      <div class="xr-msg" role="status" aria-live="polite"></div>`
  }

  // ── Events ──────────────────────────────────────────────────────────────────

  _bindBody () {
    // everything is handled by the two delegated listeners installed in _buildDOM; nothing to rebind
  }

  _onClick (e) {
    const spoke = e.target.closest?.('[data-spoke]')
    if (spoke) { this.selectSpoke(+spoke.dataset.spoke); return }
    const act = e.target.closest?.('[data-act]')
    if (!act || act.disabled) return
    this._act(act.dataset.act)
  }

  _onKey (e) {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.closest?.('[data-spoke]')) { e.preventDefault(); this.selectSpoke(+e.target.closest('[data-spoke]').dataset.spoke) }
  }

  _act (a) {
    const [k, ...rest] = a.split(':')
    const arg = rest.join(':')
    switch (k) {
      case 'tab': this.setTab(arg); break
      case 'level': this.setLevel(+arg); break
      case 'up': this.ascend(); break
      case 'down': this.descend(); break
      case 'qty': this.setQty(this.qty + (+arg)); break
      case 'needed': this.payQtyOverride = null; this.splitAmt = null; this._render(); break
      case 'media': if (Store.setActiveMedia(this.productId, arg)) this._setMsg(`Now showing the ${arg}.`, 'ok'); else this._setMsg(`No ${arg} attached to ${this.product?.name}.`, 'err'); this._render(); break
      case 'shape': Store.setShape(this.productId, arg); this._render(); break
      case 'set': this._setMedia(arg); break
      case 'clear': Store.clearMedia(this.productId, arg); this._render(); break
      case 'list': this.addToList(arg); break
      case 'buy': this.buyNow(); break
      case 'sell': this.sellNow(); break
      case 'move': { const [id, st] = [rest[0], rest[1]]; Store.moveItem(id, st); this.receipt = null; this._render(); break }
      case 'iqty': { const it = Store.getItem(rest[0]); if (it) Store.setItemQty(it.id, it.qty + (+rest[1])); this._render(); break }
      case 'del': Store.removeItem(arg); this._render(); break
      case 'pick': this.tab = 'buy'; this._resetSelection(); this.productId = arg; this._render(); break
      case 'checkout': this.checkout(); break
      case 'split': this._splitPreset(arg); break
      case 'acceptadd': this._acceptAdd(); break
      case 'acceptdel': this._acceptDel(+arg); break
      default: break
    }
  }

  _onChange (e) {
    const t = e.target
    const bind = t.dataset?.bind
    if (bind === 'product') { this._resetSelection(); this.productId = t.value; this._render(); return }
    if (bind === 'payType') { this.payType = t.value; this.payQuality = null; this.payQtyOverride = null; this.splitAmt = null; this._render(); return }
    if (bind === 'payQuality') { this.payQuality = t.value; this.payQtyOverride = null; this._render(); return }
    if (bind === 'payQty') { const v = +t.value; if (Number.isFinite(v) && v >= 0) { this.payQtyOverride = v; this.splitAmt = null } this._render(); return }
    if (bind === 'applyRem') { this.applyRem = t.checked; this._render(); return }
    if (bind === 'intent') { this.intent = t.value; return }
    if (t.dataset?.accept != null) { this._acceptEdit(+t.dataset.accept, t.dataset.key, t.value); return }
    if (t.dataset?.ch != null || t.dataset?.chnum != null) { this._splitInput(t, true); return }
    if (t.dataset?.field === 'imagefile') { this._readImageFile(t.files?.[0]); return }
  }

  _onInput (e) {
    const t = e.target
    if (t.dataset?.bind === 'intent') this.intent = t.value
    if (t.dataset?.ch != null || t.dataset?.chnum != null) this._splitInput(t, false)
  }

  // ── Actions ─────────────────────────────────────────────────────────────────

  setTab (tab) {
    if (!['buy', 'sell', 'list'].includes(tab) || tab === this.tab) return
    this.tab = tab
    this.sel = null; this.level = 0; this.payType = null; this.payQuality = null; this.payQtyOverride = null; this.splitAmt = null
    this.receipt = null
    this._setMsg('')
    this._render()
  }
  setQty (n) {
    const v = Math.max(1, Math.min(99, Math.round(n)))
    if (v === this.qty) return
    this.qty = v; this.payQtyOverride = null; this.splitAmt = null
    this._render()
  }
  selectSpoke (i) {
    if (i < 0 || i >= this.forms.length) return
    if (this.sel === i) { this.descend(); return }
    this.sel = i; this.payType = null; this.payQuality = null; this.payQtyOverride = null; this.splitAmt = null
    this._setMsg('')
    this._render()
  }
  setLevel (n) {
    if (this.sel == null && n > 0) return
    this.level = Math.max(0, Math.min(3, n))
    this._render()
  }
  descend () { if (this.sel != null && this.level < 3) this.setLevel(this.level + 1) }
  ascend () { if (this.level > 0) this.setLevel(this.level - 1) }

  _splitPreset (kind) {
    const c = this._q
    if (!c) return
    const T = c.payT, total = c.mode === 'sell' ? c.requiredQty : c.payQty
    if (kind === 'reset') this.splitAmt = null
    else if (kind === 'cheapest') { const ch = Value.defaultChannel(T.id); this.splitAmt = { [ch.id]: total } }
    else if (kind === 'even') { const shares = {}; T.channels.forEach(ch => { shares[ch.id] = 1 }); this.splitAmt = Value.sharesToSplit(T.id, total, shares) }
    this._render()
  }

  /** Slider / number input on level 2. live=false (input event): update readouts only; live=true (change): re-render. */
  _splitInput (t, commit) {
    const c = this._q
    if (!c) return
    const id = t.dataset.ch ?? t.dataset.chnum
    const T = c.payT, total = c.mode === 'sell' ? c.requiredQty : c.payQty
    const cur = this.splitAmt ?? (c.mode === 'sell' ? Object.fromEntries((c.qs?.fees ?? []).map(f => [f.channel, f.amount])) : Object.fromEntries((c.qt.fees ?? []).map(f => [f.channel, f.amount])))
    const next = { ...cur }
    const v = Math.max(0, Math.min(total, +t.value || 0))
    next[id] = Value.clean(v)
    this.splitAmt = next
    if (commit) { this._render(); return }
    const sum = Value.clean(Object.values(next).reduce((s, x) => s + (+x || 0), 0))
    const out = this._el.querySelector('[data-sumout]')
    if (out) { const ok = Math.abs(sum - total) < 1e-6; out.className = ok ? 'xr-ok' : 'xr-bad'; out.textContent = `split totals ${fmt(sum)} of ${fmt(total)} ${ok ? '✓' : '✗ must equal ' + fmt(total)}` }
    const ch = T.channels.find(x => x.id === id)
    const fo = this._el.querySelector(`[data-feeout="${id}"]`)
    if (fo && ch) fo.textContent = 'fee ' + fmt(ch.feePct > 0 ? Math.ceil(v * ch.feePct / 100 / T.step - 1e-9) * T.step : 0)
    const twin = this._el.querySelector(t.dataset.ch != null ? `[data-chnum="${id}"]` : `[data-ch="${id}"]`)
    if (twin) twin.value = v
  }

  addToList (state) {
    const p = this.product
    if (!p) return null
    const c = this._q
    const chosen = c && c.mode === 'buy' ? this._chosenForm(c) : undefined
    const it = Store.addToList(p.id, state, { qty: this.qty, chosenForm: chosen, declaredIntent: this.intent ? { note: this.intent, t: Date.now() } : null })
    this._setMsg(it ? `${p.name} ×${it.qty} → ${state}.` : 'Could not add (list full?).', it ? 'ok' : 'err')
    this._render()
    window.dispatchEvent(new CustomEvent('omni:notify-info', { detail: { name: '⟐OmniStore', desc: `${p.name} ×${this.qty} added to ${state}.`, holdMs: 2000 } }))
    return it
  }

  buyNow () {
    const p = this.product, c = this._q
    if (!p || !c || c.mode !== 'buy') { this._setMsg('Pick a spoke (an exchange form) first.', 'err'); return null }
    if (!c.qt.canExecute) { this._setMsg('Blocked: ' + (c.qt.reasons.join('; ') || c.qt.block), 'err'); return null }
    const plan = { productId: p.id, qty: this.qty, chosenForm: this._chosenForm(c) }
    const res = Store.buyNow(p.id, { qty: this.qty, chosenForm: plan.chosenForm, declaredIntent: this.intent ? { note: this.intent, t: Date.now() } : null, applyRemainder: this.applyRem, payQty: this.payQtyOverride })
    if (!res.ok) { this._setMsg('Blocked: ' + (res.error ?? 'unknown') + (res.quote?.reasons?.length ? ' — ' + res.quote.reasons.join('; ') : ''), 'err'); return res }
    this.receipt = res.tx
    this.level = 0
    this.sel = null; this.payQtyOverride = null; this.splitAmt = null
    this._setMsg('Bought. ' + res.tx.remainder.line, 'ok')
    this._render()
    return res
  }

  sellNow () {
    const p = this.product, c = this._q
    if (!p || !c || c.mode !== 'sell') { this._setMsg('Pick a spoke (a form you accept) first.', 'err'); return null }
    if (!c.qs.canExecute) { this._setMsg('Blocked: ' + (c.qs.block ?? c.qs.error), 'err'); return null }
    const res = Store.sellNow(p.id, { qty: this.qty, form: { type: c.f.type, qty: c.f.qty, quality: c.f.quality }, split: this.splitAmt ?? undefined, declaredIntent: this.intent ? { note: this.intent, t: Date.now() } : null })
    if (!res.ok) { this._setMsg('Blocked: ' + (res.error ?? 'unknown'), 'err'); return res }
    this.receipt = res.tx
    this.level = 0; this.sel = null; this.splitAmt = null
    this._setMsg('Sold. ' + res.tx.remainder.line, 'ok')
    this._render()
    return res
  }

  checkout () {
    const res = Store.checkout({ applyRemainder: this.applyRem })
    if (!res.ok) {
      const short = res.short ? ' — ' + Object.keys(res.short).map(k => `${Value.getType(k)?.name}: need ${fmt(res.short[k].need)}, have ${fmt(res.short[k].have)}`).join('; ') : ''
      this._setMsg('Checkout blocked: ' + res.error + short, 'err')
      this.receipt = null
      this._render()
      return res
    }
    this.receipt = res.receipts
    this._setMsg(`Checked out ${res.receipts.length} item${res.receipts.length === 1 ? '' : 's'} (sandbox).`, 'ok')
    this._render()
    return res
  }

  _acceptEdit (i, key, val) {
    const forms = this.forms.map(f => ({ ...f }))
    if (!forms[i]) return
    if (key === 'qty') { const n = +val; if (!(n > 0)) { this._render(); return } forms[i].qty = n } else forms[i].quality = val
    Store.setAcceptForms(this.productId, forms)
    this._render()
  }
  _acceptAdd () {
    const sel = this._el.querySelector('[data-bind="acceptAddType"]')
    const t = Value.getType(sel?.value)
    if (!t) return
    const forms = this.forms.map(f => ({ ...f }))
    if (forms.some(f => f.type === t.id)) { this._setMsg(`${t.name} is already accepted.`, 'err'); return }
    forms.push({ type: t.id, qty: 1 })
    Store.setAcceptForms(this.productId, forms)
    this._render()
  }
  _acceptDel (i) {
    const forms = this.forms.map(f => ({ ...f }))
    if (forms.length < 2) return
    forms.splice(i, 1)
    Store.setAcceptForms(this.productId, forms)
    if (this.sel != null && this.sel >= forms.length) this.sel = null
    this._render()
  }

  _setMedia (kind) {
    const f = this._el.querySelector(`[data-field="${kind}"]`)
    const r = Store.setMedia(this.productId, kind, f?.value ?? '')
    if (r.ok) { if (kind !== 'emoji') Store.setActiveMedia(this.productId, kind); this._setMsg(`${kind} set.`, 'ok') } else this._setMsg(`${kind}: ${r.error}`, 'err')
    this._render()
  }

  _readImageFile (file) {
    if (!file) return
    if (file.size > Store.IMAGE_MAX_BYTES) { this._setMsg('Image too large (max 512 KB).', 'err'); return }
    const fr = new FileReader()
    fr.onload = () => {
      const r = Store.setMedia(this.productId, 'image', String(fr.result))
      if (r.ok) { Store.setActiveMedia(this.productId, 'image'); this._setMsg('Image attached and active.', 'ok') } else this._setMsg('image: ' + r.error, 'err')
      this._render()
    }
    fr.onerror = () => this._setMsg('Could not read that file.', 'err')
    fr.readAsDataURL(file)
  }

  // ── DOM shell ───────────────────────────────────────────────────────────────

  _buildDOM () {
    const root = document.createElement('div')
    root.className = 'omni-xr-panel'
    root.id = 'omni-exchange-panel'
    root.setAttribute('role', 'dialog')
    root.setAttribute('aria-label', 'OmniStore exchange (sandbox)')
    root.innerHTML = `
      <div class="xr-header"><span class="xr-title">⟐Exchange</span><span class="xr-sandbox">SANDBOX</span><span class="xr-spacer"></span>
        <button type="button" class="xr-ctrl" data-ctl="minimize" title="Minimize" aria-label="Minimize">–</button>
        <button type="button" class="xr-ctrl" data-ctl="close" title="Close" aria-label="Close">×</button></div>
      <div class="xr-banner">SANDBOX — every value here is fake. No real payments, no network.</div>
      <div class="xr-tabs" role="tablist">
        <button type="button" class="xr-tab" role="tab" data-tab="buy" data-act="tab:buy">BUY</button>
        <button type="button" class="xr-tab" role="tab" data-tab="sell" data-act="tab:sell">SELL</button>
        <button type="button" class="xr-tab" role="tab" data-tab="list" data-act="tab:list">LIST</button></div>
      <div class="xr-body"></div>
      <div class="xr-actions"></div>`
    this._refs = { body: root.querySelector('.xr-body'), actions: root.querySelector('.xr-actions'), tabs: [...root.querySelectorAll('.xr-tab')] }
    root.querySelector('[data-ctl="minimize"]').addEventListener('click', () => this.minimize())
    root.querySelector('[data-ctl="close"]').addEventListener('click', () => this.close())
    root.addEventListener('click', (e) => this._onClick(e))
    root.addEventListener('keydown', (e) => this._onKey(e))
    root.addEventListener('change', (e) => this._onChange(e))
    root.addEventListener('input', (e) => this._onInput(e))
    root.dataset.winId = PANEL_ID
    this._bindHeader(root)
    WindowManager.register(PANEL_ID, root, 'Exchange')
    WindowManager.watchPanelOpacity(root, () => this._isOpen)
    return root
  }

  _bindHeader (root) {
    const header = root.querySelector('.xr-header')
    const drag = { active: false }
    const pt = (e) => ({ x: e.touches?.[0]?.clientX ?? e.clientX, y: e.touches?.[0]?.clientY ?? e.clientY })
    const onDown = (e) => {
      if (this.isPhone || e.target.closest('button')) return
      const { x, y } = pt(e); const rect = root.getBoundingClientRect()
      drag.active = true; drag.sx = x; drag.sy = y; drag.ox = rect.left; drag.oy = rect.top
    }
    const onMove = (e) => {
      if (!drag.active) return
      const { x, y } = pt(e)
      root.dataset.moved = '1'
      root.style.left = Math.max(0, drag.ox + x - drag.sx) + 'px'
      root.style.top = Math.max(0, drag.oy + y - drag.sy) + 'px'
      root.style.right = 'auto'
    }
    const onUp = () => { if (drag.active) { drag.active = false; this._emitState() } }
    header.addEventListener('mousedown', onDown)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    header.addEventListener('touchstart', onDown, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', onUp)
    this._unbindHeader = () => {
      window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp)
      window.removeEventListener('touchmove', onMove); window.removeEventListener('touchend', onUp)
    }
  }

  getState () {
    return { open: this._isOpen, tab: this.tab, productId: this.productId, qty: this.qty, sel: this.sel, level: this.level, payType: this.payType, applyRem: this.applyRem }
  }
}
