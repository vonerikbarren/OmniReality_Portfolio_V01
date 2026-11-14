/**
 * ui/OmniTeleprompt.js (V285) — the OmniTeleprompt: a panel that comes out of the bottom (or the left, or the top) of the screen and gives the user information.
 * Model: utils/OmniTelepromptModel.js. Settings saved in this browser ('omni:teleprompt-v1').
 * SERVICES.teleprompt: show({title, text, edge?, seconds?}) hide() toggle() isOpen() get() set(patch)
 * Events in:  omni:teleprompt-show {title, text, edge?, seconds?} · omni:teleprompt-hide · omni:teleprompt-toggle · omni:teleprompt-set {patch}
 * Events out: omni:teleprompt-state {open, edge}
 * Later (OmniMetaNode): a key on a timeline can send omni:teleprompt-show, so a node can talk to the viewer.
 */
import * as M from '../utils/OmniTelepromptModel.js'
import { SERVICES } from '../utils/OmniExtraKinds.js'

export const STORE_KEY = 'omni:teleprompt-v1'
const send = (n, d = {}) => { try { window.dispatchEvent(new CustomEvent(n, { detail: d })) } catch (_) { /* no window */ } }
const STYLES = `
.otp { position: fixed; z-index: 58; display: none; flex-direction: column; box-sizing: border-box; font: 15px/1.5 system-ui, sans-serif; pointer-events: auto; box-shadow: 0 0 24px rgba(0,0,0,.25);
  transition: transform .28s ease, opacity .2s ease; background: var(--otp-bg, rgba(255,255,255,.94)); color: var(--otp-fg, #111); border: 1px solid var(--otp-line, rgba(0,0,0,.2)); }
.otp.is-open { display: flex; }
.otp[data-edge="bottom"] { border-bottom: 0; padding-bottom: env(safe-area-inset-bottom, 0px); } .otp[data-edge="top"] { border-top: 0; } .otp[data-edge="left"] { border-left: 0; }
.otp.is-dark { --otp-bg: rgba(10,10,14,.94); --otp-fg: #f2f2f2; --otp-line: rgba(255,255,255,.25); }
.otp-head { display: flex; align-items: center; gap: 8px; padding: 6px 12px; border-bottom: 1px solid var(--otp-line, rgba(0,0,0,.15)); font-size: .72em; letter-spacing: .1em; text-transform: uppercase; }
.otp-title { flex: 1; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.otp button, .otp select, .otp input { font: inherit; font-size: 11px; background: transparent; color: inherit; border: 1px solid var(--otp-line, rgba(0,0,0,.25)); border-radius: 6px; padding: 2px 8px; cursor: pointer; }
.otp-body { flex: 1; overflow: auto; padding: 8px 14px 12px; white-space: pre-wrap; overflow-wrap: anywhere; }
.otp-set { display: none; padding: 6px 12px; gap: 8px; flex-wrap: wrap; align-items: center; border-bottom: 1px solid var(--otp-line, rgba(0,0,0,.15)); font-size: 11px; } .otp-set.is-open { display: flex; }
.otp-set label { display: flex; align-items: center; gap: 4px; } .otp-set input[type=number] { width: 58px; cursor: text; }
`
export default class OmniTeleprompt {
  constructor (context) { this.ctx = context; this._set = M.sanitizeTeleprompt(null); this._el = null; this._open = false; this._bound = []; this._hideT = 0; this._raf = 0; this._edge = this._set.edge; this._msg = { title: '', text: '' }; this._scrollAt = 0 }
  init () {
    if (this._inited) return; this._inited = true
    try { this._set = M.sanitizeTeleprompt(JSON.parse(localStorage.getItem(STORE_KEY))) } catch (_) { this._set = M.sanitizeTeleprompt(null) }
    const on = (n, f) => { const h = (e) => f(e.detail ?? {}); window.addEventListener(n, h); this._bound.push([n, h]) }
    on('omni:teleprompt-show', (d) => this.show(d)); on('omni:teleprompt-hide', () => this.hide()); on('omni:teleprompt-toggle', () => this.toggle()); on('omni:teleprompt-set', (d) => this.set(d.patch ?? {}))
    on('omni:layout-changed', () => { if (this._open) this._place() })
    const esc = (e) => { if (e.key === 'Escape' && this._open) this.hide() }; window.addEventListener('keydown', esc); this._bound.push(['keydown', esc]); window.addEventListener('resize', () => this._open && this._place()); SERVICES.teleprompt = this
  }
  update (delta) { if (this._open && this._set.scroll > 0 && this._el) { const b = this._el.querySelector('.otp-body'); this._scrollAt += this._set.scroll * Math.min(0.1, delta || 0); if (b.scrollHeight > b.clientHeight) { if (this._scrollAt >= b.scrollHeight - b.clientHeight) this._scrollAt = 0; b.scrollTop = this._scrollAt } } }
  onResize () { if (this._open) this._place() }
  destroy () { for (const [n, h] of this._bound) window.removeEventListener(n, h); this._bound = []; clearTimeout(this._hideT); this._el?.remove(); this._el = null; if (SERVICES.teleprompt === this) delete SERVICES.teleprompt }
  isOpen () { return this._open }
  get () { return { ...this._set, open: this._open, edge: this._edge } }
  set (patch) { this._set = M.sanitizeTeleprompt({ ...this._set, ...(patch && typeof patch === 'object' ? patch : {}) }); try { localStorage.setItem(STORE_KEY, JSON.stringify(this._set)) } catch (_) { /* private */ } if (this._open) { this._edge = this._set.edge; this._place(); this._fill() } return this.get() }
  show (raw) {
    const m = M.sanitizeMessage(raw); if (!m.text && !m.title) return { ok: false, error: 'There is nothing to show.' }
    this._build(); this._msg = m; this._edge = m.edge ?? this._set.edge; this._open = true; this._scrollAt = 0; this._el.classList.add('is-open'); this._place(); this._fill()
    clearTimeout(this._hideT); const secs = m.seconds ?? this._set.seconds; if (secs > 0) this._hideT = setTimeout(() => this.hide(), secs * 1000)
    send('omni:teleprompt-state', { open: true, edge: this._edge }); return { ok: true, edge: this._edge }
  }
  hide () { if (!this._open) return false; this._open = false; clearTimeout(this._hideT); this._el?.classList.remove('is-open'); send('omni:teleprompt-state', { open: false, edge: this._edge }); return true }
  toggle () { if (this._open) return this.hide(); return this.show(this._msg.text || this._msg.title ? this._msg : { title: 'OmniTeleprompt', text: 'It gives you information here. Commands and nodes can send it text: Omni Teleprompt show text(...)' }) }
  _build () {
    if (this._el) return
    if (!document.getElementById('otp-styles')) { const s = document.createElement('style'); s.id = 'otp-styles'; s.textContent = STYLES; document.head.appendChild(s) }
    const el = document.createElement('div'); el.className = 'otp'; el.id = 'omni-teleprompt'; el.setAttribute('role', 'region'); el.setAttribute('aria-label', 'OmniTeleprompt'); el.setAttribute('aria-live', 'polite')
    el.innerHTML = '<div class="otp-head"><span class="otp-title"></span><button data-a="gear" title="Settings">⚙</button><button data-a="close" title="Close (Esc)">✕</button></div>' +
      '<div class="otp-set"><label>Edge <select data-k="edge"><option>bottom</option><option>left</option><option>top</option></select></label><label>Size <input type="number" data-k="size" min="80" max="600" step="10"></label><label>Text <input type="number" data-k="fontSize" min="10" max="40"></label>' +
      '<label>Opacity <input type="number" data-k="opacity" min="0.3" max="1" step="0.05"></label><label>Scroll px/s <input type="number" data-k="scroll" min="0" max="400" step="5"></label><label>Hide after s <input type="number" data-k="seconds" min="0" max="600"></label><label><input type="checkbox" data-k="dark"> Dark</label></div><div class="otp-body"></div>'
    document.body.appendChild(el); this._el = el
    el.querySelector('[data-a=close]').addEventListener('click', () => this.hide()); el.querySelector('[data-a=gear]').addEventListener('click', () => { el.querySelector('.otp-set').classList.toggle('is-open'); this._syncSet() })
    el.querySelector('.otp-set').addEventListener('change', (e) => { const t = e.target; const k = t.dataset?.k; if (!k) return; this.set({ [k]: t.type === 'checkbox' ? t.checked : t.value }); this._syncSet() })
  }
  _syncSet () { const s = this._el?.querySelector('.otp-set'); if (!s) return; for (const i of s.querySelectorAll('[data-k]')) { const v = this._set[i.dataset.k]; if (i.type === 'checkbox') i.checked = !!v; else if (document.activeElement !== i) i.value = v } }
  _fill () { const el = this._el; el.querySelector('.otp-title').textContent = this._msg.title || 'OmniTeleprompt'; el.querySelector('.otp-body').textContent = this._msg.text; el.classList.toggle('is-dark', this._set.dark); el.style.opacity = String(this._set.opacity); el.style.fontSize = this._set.fontSize + 'px'; this._syncSet() }
  _place () {
    const el = this._el; if (!el) return; const cs = getComputedStyle(document.documentElement); const px = (v, d) => { const n = parseFloat(v); return Number.isFinite(n) ? n : d }
    const box = M.boxFor(this._edge, this._set.size, { top: px(cs.getPropertyValue('--omni-top-offset'), 48), bottom: px(cs.getPropertyValue('--omni-dock-stack-h'), 52) })
    el.dataset.edge = this._edge; for (const k of ['left', 'right', 'top', 'bottom', 'width', 'height']) el.style[k] = ''
    for (const [k, v] of Object.entries(box)) el.style[k] = typeof v === 'number' ? v + 'px' : v
    if (this._edge === 'left') el.style.maxWidth = '90vw'; else el.style.maxHeight = '60vh'
  }
}
