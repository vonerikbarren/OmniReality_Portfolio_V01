/**
 * ui/OmniSettingsPanelBase.js — the shared shell of the `<System>Settings` / `Dev<System>Settings` panels (V177)
 *
 * One small base class so the user panel and the dev panel look and behave the same way WITHOUT importing each other:
 *   ui/OmniStoreSettingsPanel.js      (user, Admin slot 19)       extends this
 *   ui/DevOmniStoreSettingsPanel.js   (dev only, Developer slot 6) extends this
 * Later systems follow the same split (`<System>Settings` for the user, `Dev<System>Settings` for the developer and Claude).
 *
 * It provides: single-init guard (BaseScene.addModule calls init(); a second call is ignored), the omni:nav-select
 * listener for the panel's item name(s), WindowManager registration, draggable header (desktop), a bottom sheet on phones
 * (<= 700px, like the wallet), open / close / minimize / restore, and the module contract (constructor / init / update /
 * destroy / onResize). The subclass fills the body: `buildBody(body)` once, `refresh()` whenever it wants to re-render.
 *
 * Options: { id, label, iconLabel, navItems:[...], className, devOnly:false, bannerText? }
 *   devOnly adds a visible "DEV ONLY" badge in the header and a banner line (bannerText) under it.
 */

import gsap from 'gsap'
import * as WindowManager from './WindowManager.js'
import { handsSafe, DOCK_H } from '../utils/OmniStoreLayout.js'

export const PHONE_MAX = 700

const STYLES = `
.oss-panel { pointer-events: auto; position: fixed; z-index: 60; width: 340px; max-width: calc(100vw - 16px); display: flex; flex-direction: column; overflow: hidden; opacity: 0; visibility: hidden; box-sizing: border-box;
  background: var(--omni-theme-bg, rgba(8,8,12,.95)); border: 1px solid var(--omni-theme-border, rgba(255,255,255,.14)); border-radius: 12px; color: var(--omni-theme-text, rgba(255,255,255,.93));
  font-family: 'Courier New', Courier, monospace; font-size: 11px; backdrop-filter: blur(20px) saturate(1.5); -webkit-backdrop-filter: blur(20px) saturate(1.5); box-shadow: 0 0 20px rgba(0,0,0,.4), 0 10px 30px rgba(0,0,0,.5); }
.oss-panel.is-wide { width: 460px; }
.oss-header { height: 36px; flex: 0 0 auto; display: flex; align-items: center; gap: 8px; padding: 0 8px 0 12px; background: var(--omni-theme-header-bg, rgba(255,255,255,.05)); border-bottom: 1px solid var(--omni-theme-border, rgba(255,255,255,.14)); cursor: grab; user-select: none; touch-action: none; }
.oss-title { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.oss-spacer { flex: 1; }
.oss-badge { padding: 1px 6px; border-radius: 4px; font-weight: bold; letter-spacing: .08em; pointer-events: none; white-space: nowrap; }
.oss-badge.is-dev { background: #ff4d6d; color: #fff; }
.oss-badge.is-sandbox { background: #ffb02e; color: #1b1200; }
.oss-ctrl { width: 24px; height: 24px; padding: 0; border-radius: 5px; border: 1px solid var(--omni-theme-border, rgba(255,255,255,.14)); background: rgba(255,255,255,.05); color: inherit; cursor: pointer; font: inherit; }
.oss-banner { padding: 4px 12px; font-size: 10px; line-height: 1.35; color: #fff; background: rgba(255,77,109,.85); }
.oss-body { overflow-y: auto; padding: 8px 10px 10px; flex: 1 1 auto; min-height: 0; }
.oss-sec { margin: 10px 0 3px; color: var(--omni-theme-text-dim, rgba(255,255,255,.62)); letter-spacing: .08em; text-transform: uppercase; font-size: 9px; }
.oss-row { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; margin: 4px 0; }
.oss-row > label { flex: 1 1 120px; min-width: 0; }
.oss-btn, .oss-input, .oss-select, .oss-text { min-height: 28px; box-sizing: border-box; padding: 2px 8px; font: inherit; color: inherit; border-radius: 6px; background: rgba(255,255,255,.07); border: 1px solid var(--omni-theme-border, rgba(255,255,255,.18)); }
.oss-btn { cursor: pointer; } .oss-btn:hover:not(:disabled) { background: rgba(255,255,255,.17); } .oss-btn:disabled { opacity: .4; cursor: default; }
.oss-btn.is-danger { background: rgba(255,90,90,.25); border-color: rgba(255,120,120,.7); }
.oss-btn.is-on { background: rgba(255,255,255,.22); border-color: rgba(255,255,255,.7); }
.oss-select option { color: #111; background: #fff; }
.oss-input { width: 84px; } .oss-input.is-wide { width: 100%; }
.oss-text { width: 100%; min-height: 90px; resize: vertical; font-size: 10px; line-height: 1.35; white-space: pre; }
.oss-dim { color: var(--omni-theme-text-dim, rgba(255,255,255,.62)); }
.oss-msg { min-height: 14px; margin-top: 4px; }
.oss-msg.is-err { color: #ff8a8a; } .oss-msg.is-ok { color: #8fe3a2; }
@media (max-width: ${PHONE_MAX}px) {
  .oss-panel, .oss-panel.is-wide { left: 0 !important; right: 0 !important; top: auto !important; bottom: var(--omni-dock-h, 52px); width: 100%; max-width: 100vw; border-radius: 14px 14px 0 0; }
  .oss-panel, .oss-panel.is-wide { max-height: 42vh; } .oss-btn, .oss-input, .oss-select { min-height: 40px; } .oss-ctrl { width: 36px; height: 36px; } .oss-header { cursor: default; }
}
`

function injectStyles () {
  if (typeof document === 'undefined' || document.getElementById('oss-styles')) return
  const s = document.createElement('style'); s.id = 'oss-styles'; s.textContent = STYLES; document.head.appendChild(s)
}

export default class OmniSettingsPanelBase {
  constructor (opts) {
    this.opts = { navItems: [], className: '', devOnly: false, bannerText: '', wide: false, ...opts }
    this._el = null
    this._isOpen = false
    this._inited = 0
    this._on = null
    this._unbind = null
  }

  // subclass hooks ------------------------------------------------------------
  buildBody (_body) {}
  refresh () {}
  onOpened () {}
  onInit () {}
  onDestroy () {}

  init () {
    this._inited++   // BaseScene.addModule() calls init(); a second call must not double the listeners
    if (this._inited > 1) return
    injectStyles()
    this._on = {
      nav: (e) => { if (this.opts.navItems.includes(e.detail?.item)) this.open() },
      restore: (e) => { if (e.detail?.id === this.opts.id) this.open() },
    }
    window.addEventListener('omni:nav-select', this._on.nav)
    window.addEventListener('omni:panel-restore', this._on.restore)
    this.onInit()
  }

  update () {}
  onResize () {}

  destroy () {
    if (!this._inited) return
    window.removeEventListener('omni:nav-select', this._on.nav)
    window.removeEventListener('omni:panel-restore', this._on.restore)
    this.onDestroy()
    this._unbind?.()
    this._el?.parentNode?.removeChild(this._el)
    if (this._el) WindowManager.unregister(this.opts.id)
    this._el = null
    this._isOpen = false
    this._inited = 0
  }

  get isOpen () { return this._isOpen }
  get el () { return this._el }
  get body () { return this._el?.querySelector('.oss-body') ?? null }

  open () {
    if (!this._el) this._el = this._build()
    const shell = document.getElementById('omni-ui') ?? document.body
    if (!this._el.parentNode) shell.appendChild(this._el)
    this._isOpen = true
    this._el.dataset.open = '1'
    this.refresh()
    gsap.killTweensOf(this._el)
    this._el.style.visibility = 'visible'
    if (window.innerWidth > PHONE_MAX && this._el.dataset.moved !== '1') this._place()
    gsap.to(this._el, { opacity: WindowManager.getPanelOpacity(), duration: 0.2 })
    WindowManager.bringToFront(this.opts.id)
    this._announce(true)
    this.onOpened()
  }

  /** Tell the store scene a panel opened / closed so it can re-frame the shelf in the part of the screen the panel leaves free. */
  _announce (open) {
    try { window.dispatchEvent(new CustomEvent('omni:store-panel-changed', { detail: { id: this.opts.id, open } })) } catch (_) { /* no window */ }
  }

  /** Desktop placement: left side under the ribbon, clear of the hands (their safe range for that band). */
  _place () {
    const top = (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--omni-top-stack')) || 200) + 8
    const sf = handsSafe(top, top + 360)
    this._el.style.top = top + 'px'
    this._el.style.left = Math.max(12, sf.left) + 'px'
    this._el.style.maxHeight = Math.max(240, window.innerHeight - top - DOCK_H - 12) + 'px'   // never runs under the dock; the body scrolls
  }

  close () {
    if (!this._el) return
    gsap.killTweensOf(this._el)
    this._isOpen = false
    this._el.dataset.open = '0'
    this._announce(false)
    gsap.to(this._el, { opacity: 0, duration: 0.15, onComplete: () => { if (!this._isOpen) this._el.style.visibility = 'hidden' } })
  }

  minimize () {
    if (!this._el) return
    const r = this._el.getBoundingClientRect()
    this.close()
    window.dispatchEvent(new CustomEvent('omni:panel-minimized', { detail: { id: this.opts.id, label: this.opts.label, iconLabel: this.opts.iconLabel, fromRect: { x: r.left, y: r.top, w: r.width, h: r.height }, variant: 'app' } }))
  }

  _build () {
    const o = this.opts
    const root = document.createElement('div')
    root.className = `oss-panel ${o.className}${o.wide ? ' is-wide' : ''}`
    root.id = `omni-${o.id}-panel`
    root.setAttribute('role', 'dialog')
    root.setAttribute('aria-label', o.devOnly ? `${o.label} (dev only)` : o.label)
    const head = document.createElement('div'); head.className = 'oss-header'
    const title = document.createElement('span'); title.className = 'oss-title'; title.textContent = o.label
    head.appendChild(title)
    if (o.devOnly) { const b = document.createElement('span'); b.className = 'oss-badge is-dev'; b.textContent = 'DEV ONLY'; head.appendChild(b) }
    const sp = document.createElement('span'); sp.className = 'oss-spacer'; head.appendChild(sp)
    const mk = (ctl, label, glyph) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'oss-ctrl'; b.dataset.ctl = ctl; b.setAttribute('aria-label', label); b.title = label; b.textContent = glyph; head.appendChild(b); return b }
    mk('minimize', 'Minimize', '–').addEventListener('click', () => this.minimize())
    mk('close', 'Close', '×').addEventListener('click', () => this.close())
    root.appendChild(head)
    if (o.devOnly) { const bn = document.createElement('div'); bn.className = 'oss-banner'; bn.textContent = o.bannerText; root.appendChild(bn) }
    const body = document.createElement('div'); body.className = 'oss-body'
    root.appendChild(body)
    root.dataset.winId = o.id
    root.dataset.storePanel = '1'   // systems/OmniStoreScene.js frames the shelf around open panels carrying this attribute
    root.dataset.open = '0'
    this.buildBody(body)
    // drag by the header (desktop only)
    const d = { on: false }
    const pt = (e) => ({ x: e.touches?.[0]?.clientX ?? e.clientX, y: e.touches?.[0]?.clientY ?? e.clientY })
    const down = (e) => { if (window.innerWidth <= PHONE_MAX || e.target.closest('button')) return; const p = pt(e), r = root.getBoundingClientRect(); d.on = true; d.sx = p.x; d.sy = p.y; d.ox = r.left; d.oy = r.top }
    const move = (e) => { if (!d.on) return; const p = pt(e); root.dataset.moved = '1'; root.style.left = Math.max(0, d.ox + p.x - d.sx) + 'px'; root.style.top = Math.max(0, d.oy + p.y - d.sy) + 'px' }
    const up = () => { d.on = false }
    head.addEventListener('mousedown', down); window.addEventListener('mousemove', move); window.addEventListener('mouseup', up)
    head.addEventListener('touchstart', down, { passive: true }); window.addEventListener('touchmove', move, { passive: true }); window.addEventListener('touchend', up)
    this._unbind = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); window.removeEventListener('touchmove', move); window.removeEventListener('touchend', up) }
    WindowManager.register(o.id, root, o.label.replace(/^⟐/, ''))
    WindowManager.watchPanelOpacity(root, () => this._isOpen)
    return root
  }
}

export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
export const debounce = (fn, ms) => { let t = null; const d = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms) }; d.flush = () => { clearTimeout(t); t = null }; return d }
