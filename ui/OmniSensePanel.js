/**
 * ui/OmniSensePanel.js (V290) — the OmniSense panel: the layer on / off, the three views (top down, isometric, wide orbit), the rooms and the equation of the selected room (editable).
 * Edits SERVICES.omnisense only. Events: omni:omnisense-panel (toggle the layer and the panel).
 */
import { SERVICES } from '../utils/OmniExtraKinds.js'
import { VIEW_NAMES, VIEWS } from '../utils/OmniSenseModel.js'
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const STYLES = `.osp { position: fixed; z-index: 61; left: 14px; top: 64px; width: min(340px, calc(100vw - 20px)); max-height: calc(100vh - 140px); display: none; flex-direction: column; background: rgba(255,255,255,.97); color: #111; border: 1px solid rgba(0,0,0,.25); border-radius: 10px; box-shadow: 0 6px 30px rgba(0,0,0,.3); font: 12px system-ui, sans-serif; } .osp.is-open { display: flex; }
.osp-head { display: flex; align-items: center; gap: 6px; padding: 6px 10px; border-bottom: 1px solid rgba(0,0,0,.15); cursor: move; } .osp-head b { flex: 1; letter-spacing: .06em; } .osp-body { overflow: auto; padding: 8px 10px 10px; }
.osp button, .osp textarea { font: inherit; font-size: 11px; } .osp button { background: #f2f2f2; border: 1px solid rgba(0,0,0,.25); border-radius: 6px; padding: 3px 8px; cursor: pointer; margin: 0 4px 4px 0; } .osp button.on { background: #111; color: #fff; }
.osp-rooms { display: flex; flex-wrap: wrap; max-height: 110px; overflow: auto; margin: 4px 0; } .osp textarea { width: 100%; box-sizing: border-box; min-height: 64px; font-family: ui-monospace, monospace; } .osp-msg { min-height: 14px; font-size: 11px; opacity: .85; } .osp-note { font-size: 10.5px; opacity: .7; margin: 4px 0; }`
export default class OmniSensePanel {
  constructor (context) { this.ctx = context; this._el = null; this._bound = []; this._inited = false; this._key = null }
  init () {
    if (this._inited) return; this._inited = true
    const on = (n, f) => { window.addEventListener(n, f); this._bound.push([n, f]) }
    on('omni:omnisense-panel', () => this.toggle()); on('omni:omnisense-changed', (e) => { if (this._el?.classList.contains('is-open')) { if (e.detail?.key && e.detail.reason === 'select') this._key = e.detail.key; this._render() } }); on('omni:voxel-changed', () => { if (this.isOpen()) this._render() })
  }
  update () {} onResize () {}
  destroy () { for (const [n, f] of this._bound) window.removeEventListener(n, f); this._bound = []; this._el?.remove(); this._el = null }
  isOpen () { return !!this._el?.classList.contains('is-open') }
  toggle () { if (this.isOpen()) return this.close(); return this.open() }
  open () { this._build(); this._el.classList.add('is-open'); const S = SERVICES.omnisense; if (S && !S.isOpen()) S.open(); this._render() }
  close () { this._el?.classList.remove('is-open'); SERVICES.omnisense?.close() }
  _build () {
    if (this._el) return
    if (!document.getElementById('osp-styles')) { const s = document.createElement('style'); s.id = 'osp-styles'; s.textContent = STYLES; document.head.appendChild(s) }
    const el = document.createElement('div'); el.className = 'osp'; el.id = 'omni-sense-panel'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'OmniSense')
    el.innerHTML = '<div class="osp-head"><b>▦ OMNISENSE</b><button data-a="close" title="Close (hides the plane)">✕</button></div><div class="osp-body"></div>'
    document.body.appendChild(el); this._el = el
    el.addEventListener('click', (e) => this._click(e)); el.addEventListener('keydown', (e) => { e.stopPropagation() })
    let drag = null; const head = el.querySelector('.osp-head')
    head.addEventListener('pointerdown', (e) => { if (e.target.closest('button')) return; const r = el.getBoundingClientRect(); drag = { dx: e.clientX - r.left, dy: e.clientY - r.top }; head.setPointerCapture?.(e.pointerId) })
    head.addEventListener('pointermove', (e) => { if (drag) { el.style.left = Math.max(0, e.clientX - drag.dx) + 'px'; el.style.top = Math.max(0, e.clientY - drag.dy) + 'px' } }); head.addEventListener('pointerup', () => { drag = null })
  }
  _msg (t) { const m = this._el?.querySelector('.osp-msg'); if (m) m.textContent = t || '' }
  _render () {
    const S = SERVICES.omnisense, body = this._el?.querySelector('.osp-body'); if (!body) return
    if (!S) { body.innerHTML = '<div class="osp-note">OmniSense is not running.</div>'; return }
    const rooms = S.rooms(); if (!this._key || !rooms.some(r => r.key === this._key)) this._key = SERVICES.voxel?.selected && rooms.some(r => r.key === SERVICES.voxel.selected) ? SERVICES.voxel.selected : (rooms[0]?.key ?? null)
    const keep = body.querySelector('textarea')?.value; const focused = document.activeElement === body.querySelector('textarea')
    body.innerHTML = `<div>${VIEWS.map(v => `<button data-view="${v}" class="${S.view() === v ? 'on' : ''}">${esc(VIEW_NAMES[v])}</button>`).join('')}</div>
      <div class="osp-note">${rooms.length ? rooms.length + ' room' + (rooms.length === 1 ? '' : 's') + ' on the plane. Click a tile, or a room below. Orbit with the mouse from any view.' : 'No rooms yet: add one in the OmniVoxel panel, then come back.'}</div>
      <div class="osp-rooms">${rooms.map(r => `<button data-room="${esc(r.key)}" class="${r.key === this._key ? 'on' : ''}">${esc(r.label || r.key)}</button>`).join('')}</div>
      ${this._key ? `<div><b>Equation</b> of ${esc(this._key)}</div><textarea data-ref="eq" spellcheck="false" aria-label="OmniVon equation">${esc(focused && keep != null ? keep : S.vonText(this._key))}</textarea><div><button data-a="apply">Apply</button><button data-a="reset">Reset to what the room gives</button></div>` : ''}
      <div class="osp-msg"></div><div class="osp-note">▦ and ◉ come from the room itself. Add any terms: ⧖:"Real time" ⓘ:3 \u26a1:5. The place always stays the room's.</div>`
  }
  _click (e) {
    const b = e.target.closest('button'); const S = SERVICES.omnisense; if (!b || !S) return
    if (b.dataset.a === 'close') return this.close()
    if (b.dataset.view) { const r = S.setView(b.dataset.view); this._msg(r.ok ? '' : r.error); return this._render() }
    if (b.dataset.room) { this._key = b.dataset.room; S.select(b.dataset.room); return this._render() }
    if (b.dataset.a === 'apply' && this._key) { const t = this._el.querySelector('[data-ref="eq"]').value; const r = S.setText(this._key, t); this._render(); this._msg(r.ok ? (r.problems.length ? 'Kept what it could read: ' + r.problems.join('; ') : 'Saved.') : r.error) }
    if (b.dataset.a === 'reset' && this._key) { S.clearUser(this._key); this._render(); this._msg('Back to what the room gives.') }
  }
}
