/**
 * ui/OmniPolyTooltip.js (V204) — the small menu that appears where you tap a face of a PolyNode (omni:poly-face-click) and lets you choose what to do with that face:
 * select it, open its settings, play its sound, turn its page, fire its event, select all faces with its tag, remove it. DOM only. Closes on Escape, on a tap elsewhere, on scroll / resize, and after a choice.
 * The choices run through Extra.SERVICES.poly.act(nodeId, index, optionId), so the tooltip owns no scene logic. Keyboard: arrows / Tab move, Enter chooses.
 */
import { SERVICES } from '../utils/OmniExtraKinds.js'

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const STYLES = `
.opt-tip { position: fixed; z-index: 10050; min-width: 170px; max-width: min(260px, calc(100vw - 16px)); background: rgba(14,18,28,.96); color: #eaf1ff; border: 1px solid rgba(154,208,255,.55); border-radius: 10px; box-shadow: 0 6px 22px rgba(0,0,0,.55); padding: 4px; font: 12px/1.3 system-ui, sans-serif; }
.opt-tip-title { padding: 4px 8px 5px; font-size: 10.5px; opacity: .75; border-bottom: 1px solid rgba(255,255,255,.12); margin-bottom: 3px; }
.opt-tip button { display: block; width: 100%; text-align: left; background: transparent; color: inherit; border: 0; border-radius: 6px; padding: 7px 9px; min-height: 32px; font: inherit; cursor: pointer; }
.opt-tip button:hover, .opt-tip button:focus-visible { background: rgba(154,208,255,.22); outline: none; }
@media (pointer: coarse) { .opt-tip button { min-height: 44px; } }
`
export default class OmniPolyTooltip {
  constructor () { this._el = null; this._bound = []; this._inited = 0; this._ctx = null }
  init () {
    this._inited++; if (this._inited > 1) return
    if (typeof document !== 'undefined' && !document.getElementById('opt-styles')) { const s = document.createElement('style'); s.id = 'opt-styles'; s.textContent = STYLES; document.head.appendChild(s) }
    const on = (t, n, f, o) => { t.addEventListener(n, f, o); this._bound.push([t, n, f, o]) }
    on(window, 'omni:poly-face-click', (e) => this.show(e.detail ?? {}))
    on(window, 'keydown', (e) => { if (!this._el) return; if (e.key === 'Escape') { this.hide(); return } if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); this._move(e.key === 'ArrowDown' ? 1 : -1) } })
    on(window, 'pointerdown', (e) => { if (this._el && !this._el.contains(e.target)) this.hide() }, true)
    on(window, 'resize', () => this.hide()); on(window, 'blur', () => this.hide())
    on(window, 'omni:node-deleted', () => this.hide())
    on(window, 'omni:poly-open-panel', () => window.dispatchEvent(new CustomEvent('omni:nav-select', { detail: { item: '⟐OmniPoly', drawer: 'inspector', parent: null, path: 'inspector/⟐OmniPoly' } })))
  }
  get isOpen () { return !!this._el }
  show (d) {
    this.hide()
    const opts = Array.isArray(d.options) ? d.options : []; if (!opts.length || typeof document === 'undefined') return false
    this._ctx = { nodeId: d.nodeId, index: d.index }
    const el = document.createElement('div'); el.className = 'opt-tip'; el.setAttribute('role', 'menu'); el.setAttribute('aria-label', 'Face options')
    el.innerHTML = `<div class="opt-tip-title">${esc(d.face || 'face')}</div>` + opts.map(o => `<button role="menuitem" data-opt="${esc(o.id)}">${esc(o.label)}</button>`).join('')
    el.addEventListener('click', (e) => { const b = e.target.closest?.('[data-opt]'); if (b) this.choose(b.dataset.opt) })
    document.body.appendChild(el); this._el = el
    const w = el.offsetWidth || 180; const h = el.offsetHeight || 140
    const vw = window.innerWidth || 800; const vh = window.innerHeight || 600
    el.style.left = Math.max(8, Math.min(vw - w - 8, (Number(d.clientX) || vw / 2) + 8)) + 'px'
    el.style.top = Math.max(8, Math.min(vh - h - 8, (Number(d.clientY) || vh / 2) + 8)) + 'px'
    el.querySelector('button')?.focus?.()
    return true
  }
  _move (dir) { const bs = [...(this._el?.querySelectorAll('button') ?? [])]; if (!bs.length) return; const i = bs.indexOf(document.activeElement); bs[(i + dir + bs.length) % bs.length].focus() }
  choose (optionId) {
    const c = this._ctx; this.hide()
    if (!c) return null
    return SERVICES.poly?.act?.(c.nodeId, c.index, optionId) ?? null
  }
  hide () { if (this._el) { this._el.remove(); this._el = null } this._ctx = null }
  update () {} onResize () { this.hide() }
  destroy () { this.hide(); for (const [t, n, f, o] of this._bound) { try { t.removeEventListener(n, f, o) } catch (_) { /* gone */ } } this._bound = []; this._inited = 0 }
}
