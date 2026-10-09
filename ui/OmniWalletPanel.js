/**
 * ui/OmniWalletPanel.js — ⟐Wallet: the sandbox ledger on screen (V176, SANDBOX)
 *
 * Balances PER VALUE TYPE (never one merged number), the stated REMAINDER ledger per type (with "claim" for the whole steps),
 * the item inventory, the transaction log, "Grant sandbox value" and "Reset sandbox". All value is fake.
 *
 * Opened by omni:wallet-open, omni:nav-select ⟐OmniValue / ⟐Wallet (drawer, ribbon Value group) or the store HUD.
 * Re-renders on omni:value-changed. WindowManager id 'omniwallet'. Module contract: constructor / init / update / destroy / onResize.
 */

import gsap from 'gsap'
import * as WindowManager from './WindowManager.js'
import * as Value from '../utils/OmniValueModel.js'
import * as Store from '../utils/OmniStoreModel.js'

export const PANEL_ID = 'omniwallet'
const PHONE_MAX = 700
const fmt = Value.fmtQty
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

const STYLES = `
.omni-wallet-panel { pointer-events: auto; position: fixed; z-index: 60; width: 380px; max-width: calc(100vw - 16px); display: flex; flex-direction: column; overflow: hidden; opacity: 0; visibility: hidden;
  background: var(--omni-theme-bg, rgba(8,8,12,.95)); border: 1px solid var(--omni-theme-border, rgba(255,255,255,.14)); border-radius: 12px; color: var(--omni-theme-text, rgba(255,255,255,.93));
  font-family: 'Courier New', Courier, monospace; font-size: 11px; backdrop-filter: blur(20px) saturate(1.5); -webkit-backdrop-filter: blur(20px) saturate(1.5); box-shadow: 0 0 20px rgba(0,0,0,.4), 0 10px 30px rgba(0,0,0,.5); }
.wl-header { height: 36px; flex: 0 0 auto; display: flex; align-items: center; gap: 8px; padding: 0 8px 0 12px; background: var(--omni-theme-header-bg, rgba(255,255,255,.05)); border-bottom: 1px solid var(--omni-theme-border, rgba(255,255,255,.14)); cursor: grab; user-select: none; touch-action: none; }
.wl-sandbox { padding: 1px 6px; border-radius: 4px; background: #ffb02e; color: #1b1200; font-weight: bold; letter-spacing: .08em; pointer-events: none; }
.wl-spacer { flex: 1; }
.wl-ctrl { width: 24px; height: 24px; padding: 0; border-radius: 5px; border: 1px solid var(--omni-theme-border, rgba(255,255,255,.14)); background: rgba(255,255,255,.05); color: inherit; cursor: pointer; font: inherit; }
.wl-banner { padding: 3px 12px; font-size: 10px; color: #1b1200; background: #ffcf6b; }
.wl-body { overflow-y: auto; padding: 8px 10px; max-height: calc(100vh - 220px); }
.wl-sec { margin: 8px 0 2px; color: var(--omni-theme-text-dim, rgba(255,255,255,.62)); letter-spacing: .08em; text-transform: uppercase; font-size: 9px; }
table.wl-t { width: 100%; border-collapse: collapse; }
.wl-t td, .wl-t th { padding: 3px 4px; text-align: left; border-bottom: 1px solid rgba(255,255,255,.08); font-weight: normal; }
.wl-t td.num { text-align: right; }
.wl-dim { color: var(--omni-theme-text-dim, rgba(255,255,255,.62)); }
.wl-row { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; margin: 4px 0; }
.wl-btn, .wl-input, .wl-select { min-height: 28px; box-sizing: border-box; padding: 2px 8px; font: inherit; color: inherit; border-radius: 6px; background: rgba(255,255,255,.07); border: 1px solid var(--omni-theme-border, rgba(255,255,255,.18)); }
.wl-btn { cursor: pointer; } .wl-btn:hover { background: rgba(255,255,255,.17); }
.wl-btn.is-danger { background: rgba(255,90,90,.25); border-color: rgba(255,120,120,.7); }
.wl-select option { color: #111; background: #fff; }
.wl-input { width: 90px; }
.wl-line { padding: 3px 0; border-bottom: 1px dotted rgba(255,255,255,.1); line-height: 1.4; }
@media (max-width: ${PHONE_MAX}px) { .omni-wallet-panel { left: 0 !important; right: 0 !important; top: auto !important; bottom: var(--omni-dock-h, 52px); width: 100%; max-width: 100vw; border-radius: 14px 14px 0 0; }
  .wl-body { max-height: 60vh; } .wl-btn, .wl-input, .wl-select { min-height: 44px; } .wl-ctrl { width: 36px; height: 36px; } .wl-header { cursor: default; } }
`

function injectStyles () {
  if (typeof document === 'undefined' || document.getElementById('omni-wallet-styles')) return
  const s = document.createElement('style'); s.id = 'omni-wallet-styles'; s.textContent = STYLES; document.head.appendChild(s)
}

export default class OmniWalletPanel {
  constructor () {
    this._el = null
    this._isOpen = false
    this._inited = 0
    this._confirmReset = false
    this._queued = false
    this.msg = ''
  }

  init () {
    this._inited++
    if (this._inited > 1) return
    injectStyles()
    this._on = {
      open: () => this.open(),
      nav: (e) => { if (e.detail?.item === '⟐OmniValue' || e.detail?.item === '⟐Wallet') this.open() },
      changed: () => this._queueRender(),
      restore: (e) => { if (e.detail?.id === PANEL_ID) this.open() },
    }
    window.addEventListener('omni:wallet-open', this._on.open)
    window.addEventListener('omni:nav-select', this._on.nav)
    window.addEventListener(Value.CHANGED_EVENT, this._on.changed)
    window.addEventListener('omni:identity-changed', this._on.changed)
    window.addEventListener('omni:panel-restore', this._on.restore)
  }

  update () {}
  onResize () {}

  destroy () {
    if (!this._inited) return
    window.removeEventListener('omni:wallet-open', this._on.open)
    window.removeEventListener('omni:nav-select', this._on.nav)
    window.removeEventListener(Value.CHANGED_EVENT, this._on.changed)
    window.removeEventListener('omni:identity-changed', this._on.changed)
    window.removeEventListener('omni:panel-restore', this._on.restore)
    this._unbind?.()
    this._el?.parentNode?.removeChild(this._el)
    WindowManager.unregister(PANEL_ID)
    this._inited = 0
  }

  get isOpen () { return this._isOpen }

  open () {
    if (!this._el) this._el = this._build()
    const shell = document.getElementById('omni-ui') ?? document.body
    if (!this._el.parentNode) shell.appendChild(this._el)
    this._render()
    gsap.killTweensOf(this._el)
    this._el.style.visibility = 'visible'
    if (window.innerWidth > PHONE_MAX && this._el.dataset.moved !== '1') {
      const top = (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--omni-top-stack')) || 200) + 8
      this._el.style.top = top + 'px'
      this._el.style.left = '12px'
      this._el.style.maxHeight = Math.max(240, window.innerHeight - top - 60) + 'px'
    }
    gsap.to(this._el, { opacity: WindowManager.getPanelOpacity(), duration: 0.2 })
    this._isOpen = true
    WindowManager.bringToFront(PANEL_ID)
  }

  close () {
    if (!this._el) return
    gsap.killTweensOf(this._el)
    gsap.to(this._el, { opacity: 0, duration: 0.15, onComplete: () => { if (!this._isOpen) this._el.style.visibility = 'hidden' } })
    this._isOpen = false
  }

  minimize () {
    if (!this._el) return
    const r = this._el.getBoundingClientRect()
    this.close()
    window.dispatchEvent(new CustomEvent('omni:panel-minimized', { detail: { id: PANEL_ID, label: '⟐Wallet', iconLabel: '⟐W', fromRect: { x: r.left, y: r.top, w: r.width, h: r.height }, variant: 'app' } }))
  }

  _queueRender () {
    if (!this._isOpen || this._queued) return
    this._queued = true
    const run = () => { this._queued = false; if (this._isOpen) this._render() }
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run); else setTimeout(run, 0)
  }

  _render () {
    const body = this._el.querySelector('.wl-body')
    const keep = body.scrollTop
    const bal = Value.getBalances()
    const rem = Value.getRemainders()
    const types = Value.getTypes()
    const rows = types.map(t => {
      const r = rem[t.id]?.total ?? 0
      const canClaim = r >= t.step - 1e-9
      return `<tr data-type="${esc(t.id)}"><td>${esc(t.emoji)} ${esc(t.name)}<div class="wl-dim">${esc(t.tier)}${t.payable ? '' : ' · not payable'}</div></td>
        <td class="num"><b data-bal="${esc(t.id)}">${fmt(bal[t.id] ?? 0)}</b> <span class="wl-dim">${esc(t.unit)}</span></td>
        <td class="num">${r > 0 ? `<span class="wl-dim">rem</span> ${fmt(r)} ${canClaim ? `<button type="button" class="wl-btn" data-act="claim:${esc(t.id)}" style="min-height:24px">claim</button>` : ''}` : ''}</td></tr>`
    }).join('')
    const remLines = types.filter(t => rem[t.id]?.entries?.length).map(t => `<div class="wl-line"><b>${esc(t.name)}</b> (${fmt(rem[t.id].total)} stated)<br><span class="wl-dim">${esc(rem[t.id].entries[0].line)}</span></div>`).join('')
    const inv = Value.getInventory()
    const invHtml = Object.keys(inv).map(k => { const p = Store.getProduct(k); return `${esc(p ? p.emoji + ' ' + p.name : k)} ×${fmt(inv[k])}` }).join(' · ')
    const log = Value.getLog().slice(0, 20)
    const logHtml = log.map(tx => `<div class="wl-line" data-tx="${esc(tx.id)}"><b>${tx.kind === 'buy' ? 'BUY' : 'SELL'}</b> ${fmt(tx.itemQty)} × ${esc(tx.itemName)} <span class="wl-dim">${new Date(tx.t).toLocaleTimeString()}</span><br>${tx.legs.map(l => `${l.dir === 'out' ? '−' : '+'}${fmt(l.qty)} ${esc(Value.getType(l.type)?.name ?? l.type)} via ${esc(l.channel)}${l.fee ? ` (fee ${fmt(l.fee)})` : ''}`).join(' · ')}<br><span class="wl-dim">${esc(tx.remainder.line)}</span>${tx.declaredIntent ? `<br><span class="wl-dim">intent: ${esc(tx.declaredIntent.note)}</span>` : ''}</div>`).join('')
    const opts = types.map(t => `<option value="${esc(t.id)}">${esc(t.emoji)} ${esc(t.name)}</option>`).join('')
    body.innerHTML = `
      <div class="wl-dim">Account: <b data-testid="account">${esc(Value.currentAccountId())}</b></div>
      <div class="wl-sec">Balances per value type (never merged)</div>
      <table class="wl-t" data-testid="balances"><tbody>${rows}</tbody></table>
      ${remLines ? `<div class="wl-sec">Remainder ledger (stated, per type)</div>${remLines}` : ''}
      <div class="wl-sec">Inventory</div><div>${invHtml || '<span class="wl-dim">nothing</span>'}</div>
      <div class="wl-sec">Grant sandbox value</div>
      <div class="wl-row"><select class="wl-select" data-field="grantType" aria-label="Value type">${opts}</select><input class="wl-input" data-field="grantQty" type="number" min="0" step="any" value="10" aria-label="Quantity"><button type="button" class="wl-btn" data-act="grant">Grant</button><button type="button" class="wl-btn" data-act="starter">Starter pack</button></div>
      <div class="wl-row"><button type="button" class="wl-btn${this._confirmReset ? ' is-danger' : ''}" data-act="reset">${this._confirmReset ? 'Click again to reset the sandbox' : 'Reset sandbox'}</button></div>
      <div class="wl-dim" role="status" aria-live="polite" data-testid="wlmsg">${esc(this.msg)}</div>
      <div class="wl-sec">Transactions (latest ${log.length})</div>${logHtml || '<span class="wl-dim">none yet</span>'}`
    body.scrollTop = keep
  }

  _onClick (e) {
    const b = e.target.closest?.('[data-act]')
    if (!b) return
    const [k, arg] = b.dataset.act.split(':')
    if (k === 'grant') {
      const type = this._el.querySelector('[data-field="grantType"]').value
      const qty = +this._el.querySelector('[data-field="grantQty"]').value
      this.msg = Value.grant(type, qty) ? `Granted ${fmt(qty)} ${Value.getType(type).name} (sandbox).` : 'Enter a positive quantity.'
    } else if (k === 'starter') { Value.grantStarterPack(); this.msg = 'Starter pack granted (sandbox).' }
    else if (k === 'claim') { const r = Value.claimRemainder(arg); this.msg = r.ok ? `Claimed ${fmt(r.claimed)} into the balance; ${fmt(r.left)} stays stated.` : 'Nothing to claim yet.' }
    else if (k === 'reset') {
      if (!this._confirmReset) { this._confirmReset = true; this._render(); return }
      this._confirmReset = false
      Value.resetSandbox(); this.msg = 'Sandbox reset to the starter state.'
    }
    this._render()
  }

  _build () {
    const root = document.createElement('div')
    root.className = 'omni-wallet-panel'
    root.id = 'omni-wallet-panel'
    root.setAttribute('role', 'dialog')
    root.setAttribute('aria-label', 'Wallet (sandbox)')
    root.innerHTML = `<div class="wl-header"><span>⟐Wallet</span><span class="wl-sandbox">SANDBOX</span><span class="wl-spacer"></span>
      <button type="button" class="wl-ctrl" data-ctl="minimize" aria-label="Minimize" title="Minimize">–</button><button type="button" class="wl-ctrl" data-ctl="close" aria-label="Close" title="Close">×</button></div>
      <div class="wl-banner">SANDBOX — every value here is fake. No real payments.</div><div class="wl-body"></div>`
    root.querySelector('[data-ctl="minimize"]').addEventListener('click', () => this.minimize())
    root.querySelector('[data-ctl="close"]').addEventListener('click', () => this.close())
    root.addEventListener('click', (e) => this._onClick(e))
    root.dataset.winId = PANEL_ID
    // drag by header (desktop only)
    const header = root.querySelector('.wl-header')
    const d = { on: false }
    const pt = (e) => ({ x: e.touches?.[0]?.clientX ?? e.clientX, y: e.touches?.[0]?.clientY ?? e.clientY })
    const down = (e) => { if (window.innerWidth <= PHONE_MAX || e.target.closest('button')) return; const p = pt(e), r = root.getBoundingClientRect(); d.on = true; d.sx = p.x; d.sy = p.y; d.ox = r.left; d.oy = r.top }
    const move = (e) => { if (!d.on) return; const p = pt(e); root.dataset.moved = '1'; root.style.left = Math.max(0, d.ox + p.x - d.sx) + 'px'; root.style.top = Math.max(0, d.oy + p.y - d.sy) + 'px' }
    const up = () => { d.on = false }
    header.addEventListener('mousedown', down); window.addEventListener('mousemove', move); window.addEventListener('mouseup', up)
    header.addEventListener('touchstart', down, { passive: true }); window.addEventListener('touchmove', move, { passive: true }); window.addEventListener('touchend', up)
    this._unbind = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); window.removeEventListener('touchmove', move); window.removeEventListener('touchend', up) }
    WindowManager.register(PANEL_ID, root, 'Wallet')
    WindowManager.watchPanelOpacity(root, () => this._isOpen)
    return root
  }
}
