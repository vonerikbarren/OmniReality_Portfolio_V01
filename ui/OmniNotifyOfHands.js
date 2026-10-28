/**
 * ui/OmniNotifyOfHands.js (V235) — OmniNotifyOfHands: a small CIRCLE panel for each hand, the hand's own ⟐OmniNotify. One instance per hand.
 *
 * It repeats, outside the orb, what the hand's orb is saying (the hover tip, the "Loaded X" / "Fired" messages) and a small state line
 * (ammo, speed, words chosen, orb open / closed). It is a general class on purpose: other hand states can use the same panel later.
 *   default spot   12 o'clock above the hand's movement pad and 9 o'clock beside its ⬢ tools menu (utils/OmniNotifyOfHandsModel.js anchorFor)
 *   move           drag the panel          (double-click the rim to put it back at its default spot)
 *   extend         drag the grip on the rim at the lower right (stays a circle; 96..320 px)
 *   minimise       the – button, or the panel becomes a small dot; tap the dot to bring it back
 *   shows          while the hand's orb is open (default), always, or off:  hand setting notifyMode  (⟐OmniHands → ⦿ Orb-it, or Omni Setting)
 * Listens: omni:orb-text { hand, title, text, msg } · omni:orb-state · omni:orb-selection · omni:hands-settings-changed.  Position / size / minimised persist in localStorage 'omni:hand-notify-v1'.
 * Module contract: constructor / init / update / destroy / onResize.
 */
import { getHandSetting } from '../utils/OmniHandsSettings.js'
import * as M from '../utils/OmniNotifyOfHandsModel.js'

export const STORE_KEY = 'omni:hand-notify-v1'
const STYLE_ID = 'omni-notify-of-hands-styles'
const CSS = `
.onh { position: fixed; z-index: 66; display: none; box-sizing: border-box; border-radius: 50%; pointer-events: auto; touch-action: none; user-select: none; -webkit-user-select: none;
  background: var(--omni-theme-bg, rgba(10,10,14,.86)); border: 1px solid var(--omni-theme-border, rgba(255,255,255,.22)); color: var(--omni-theme-text, rgba(255,255,255,.95));
  box-shadow: 0 6px 22px rgba(0,0,0,.5); font-family: 'Courier New', monospace; overflow: hidden; cursor: grab; }
.onh.is-on { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 0; }
.onh.is-drag { cursor: grabbing; }
.onh-title { font-size: 9px; letter-spacing: .12em; text-transform: uppercase; opacity: .7; margin-bottom: 3px; pointer-events: none; }
.onh-main, .onh-state, .onh-title { max-width: 72%; }
.onh-main { line-height: 1.25; overflow: hidden; max-height: 58%; pointer-events: none; word-break: break-word; }
.onh-state { font-size: 8px; opacity: .6; margin-top: 4px; pointer-events: none; line-height: 1.2; }
.onh-min { position: absolute; top: 5%; left: 50%; transform: translateX(-50%); width: 20px; height: 18px; border-radius: 9px; border: 1px solid rgba(255,255,255,.3); background: rgba(0,0,0,.35); color: #ddd; font-size: 12px; line-height: 1; padding: 0; cursor: pointer; }
.onh-min:hover { background: rgba(255,255,255,.2); }
.onh-grip { position: absolute; width: 22px; height: 22px; right: 12.5%; bottom: 12.5%; transform: translate(50%, 50%); border-radius: 50%; border: 1px solid rgba(255,255,255,.35); background: rgba(255,255,255,.12); cursor: nwse-resize; touch-action: none; }
.onh.is-dot { padding: 0; align-items: center; justify-content: center; cursor: pointer; }
.onh.is-dot > :not(.onh-dot) { display: none; }
.onh-dot { display: none; font-size: 12px; pointer-events: none; }
.onh.is-dot .onh-dot { display: block; }
`
const GLYPH = { lh: '◐', rh: '◑', conscious: '◉', omnihand: '⟐' }
const loadAll = () => { try { return M.sanitizeStore(JSON.parse(localStorage.getItem(STORE_KEY))) } catch (_) { return {} } }
const saveAll = (o) => { try { localStorage.setItem(STORE_KEY, JSON.stringify(o)) } catch (_) {} }

export default class OmniNotifyOfHands {
  constructor (hand = 'rh') {
    if (!M.NAMES[hand]) throw new Error('OmniNotifyOfHands: hand is one of ' + Object.keys(M.NAMES).join(', '))
    this.hand = hand; this._el = null; this._bound = []; this._inited = false
    this.s = { hover: null, msg: '', orbOpen: false, selected: 0, idle: '' }; this.pos = null; this.d = null; this.min = false; this._sig = ''; this._t = 0
  }
  get el () { return this._el }
  _set (k) { return getHandSetting(this.hand, k) }

  init () {
    if (this._inited) return; this._inited = true
    if (!document.getElementById(STYLE_ID)) { const s = document.createElement('style'); s.id = STYLE_ID; s.textContent = CSS; document.head.appendChild(s) }
    const saved = loadAll()[this.hand] ?? {}
    this.pos = saved.x !== undefined ? { x: saved.x, y: saved.y } : null; this.d = saved.d ?? null; this.min = !!saved.min
    const on = (t, fn) => { const h = (e) => fn(e.detail ?? {}, e); window.addEventListener(t, h); this._bound.push([t, h]) }
    on('omni:orb-text', (d) => { if (d.hand !== this.hand) return; this.s.hover = d.title ? { title: d.title, text: d.text ?? '' } : null; this.s.msg = d.msg ?? ''; this._render() })
    on('omni:orb-state', (d) => { if (d.hand !== this.hand) return; this.s.orbOpen = !!d.open; if (!d.open) { this.s.hover = null; this.s.msg = '' } this._render() })
    on('omni:orb-selection', (d) => { if (d.hand === this.hand) { this.s.selected = d.count | 0; this._render() } })
    on('omni:hands-settings-changed', (d) => { if (d.hand === this.hand) this._render() })
    on('resize', () => { this._sig = ''; this._place() })
  }

  // ── dom ──
  _build () {
    const el = document.createElement('div'); el.className = 'onh'; el.id = 'omni-notify-of-hands-' + this.hand; el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite')
    el.setAttribute('aria-label', M.NAMES[this.hand] + ' notifications')
    el.innerHTML = `<button type="button" class="onh-min" aria-label="Minimise" title="Minimise">–</button><div class="onh-title"></div><div class="onh-main"></div><div class="onh-state"></div><div class="onh-grip" title="Drag to resize" aria-label="Resize"></div><span class="onh-dot">${GLYPH[this.hand]}</span>`
    document.getElementById('omni-ui')?.appendChild(el) ?? document.body.appendChild(el); this._el = el
    el.querySelector('.onh-min').addEventListener('click', (e) => { e.stopPropagation(); this.setMinimised(true) })
    el.addEventListener('dblclick', (e) => { if (this.min) return; if (e.target.closest('.onh-min,.onh-grip')) return; this.resetPosition() })
    el.addEventListener('pointerdown', (e) => this._down(e))
    el.addEventListener('pointermove', (e) => this._move(e)); el.addEventListener('pointerup', (e) => this._up(e)); el.addEventListener('pointercancel', (e) => this._up(e))
    return el
  }
  diameter () { return M.clampDiameter(this.d ?? M.defaultDiameter(window.innerWidth), window.innerWidth) }
  size () { return this.min ? M.SIZES.dot : this.diameter() }
  isVisible () { return M.shouldShow(this._set('notifyMode'), this.s.orbOpen) }

  // ── state ──
  setMinimised (v) { this.min = !!v; this._persist(); this._sig = ''; this._render(); return this.min }
  setSize (d) { this.d = M.clampDiameter(d, window.innerWidth); this._persist(); this._sig = ''; this._render(); return this.d }
  resetPosition () { this.pos = null; this._persist(); this._sig = ''; this._place() }
  _persist () { const all = loadAll(); all[this.hand] = { ...(this.pos ? { x: this.pos.x, y: this.pos.y } : {}), ...(this.d ? { d: this.d } : {}), min: this.min }; saveAll(all) }

  // ── render ──
  _render () {
    const show = this.isVisible()
    if (!show && !this._el) return
    const el = this._el ?? this._build()
    el.classList.toggle('is-on', show); el.classList.toggle('is-dot', show && this.min)
    if (!show) return
    const d = this.size(); el.style.width = el.style.height = d + 'px'
    const c = M.compose(this.hand, { ...this.s, ammo: this._set('ammo') && ['lh', 'rh'].includes(this.hand) ? this._set('ammo') : null, speed: Number(this._set('speed')) })
    el.querySelector('.onh-title').textContent = c.title
    const main = el.querySelector('.onh-main'); main.textContent = c.main; main.style.fontSize = M.fontFor(d, c.main.length) + 'px'
    el.querySelector('.onh-state').textContent = c.state
    el.querySelector('.onh-grip').style.display = this.min ? 'none' : ''
    this._sig = ''; this._place()
  }
  _rect (id) { const r = document.getElementById(id)?.getBoundingClientRect?.(); return r && r.width > 0 ? { left: r.left, top: r.top, width: r.width, height: r.height } : null }
  _place () {
    const el = this._el; if (!el || !el.classList.contains('is-on')) return
    const d = this.size(), vw = window.innerWidth, vh = window.innerHeight
    const p = this.pos ? M.clampPos(this.pos, d, vw, vh) : M.anchorFor(this.hand, this._rect('omni-pad-' + this.hand), this._rect('omni-radial-' + this.hand), vw, vh, d)
    el.style.left = p.x + 'px'; el.style.top = p.y + 'px'
  }
  /** keeps the default spot tied to the pad and tools menu (they can move); cheap: re-measures four times a second, only while shown and not dragged */
  update (delta) {
    this._t += delta ?? 0; if (this._t < 0.25 || !this._el || this.pos || this._drag) return; this._t = 0
    if (this._el.classList.contains('is-on')) this._place()
  }
  onResize () { this._place() }

  // ── pointer: move, extend, (dot) restore ──
  _down (e) {
    if (e.target.closest('.onh-min')) return
    const grip = e.target.closest('.onh-grip'); e.preventDefault(); try { this._el.setPointerCapture(e.pointerId) } catch (_) {}
    const r = this._el.getBoundingClientRect()
    this._drag = grip ? { kind: 'size', x0: e.clientX, y0: e.clientY, d0: r.width } : { kind: 'move', dx: e.clientX - r.left, dy: e.clientY - r.top, x0: e.clientX, y0: e.clientY, moved: false }
    this._el.classList.add('is-drag')
  }
  _move (e) {
    const g = this._drag; if (!g) return
    if (g.kind === 'size') { const d = g.d0 + Math.max(e.clientX - g.x0, e.clientY - g.y0); this.d = M.clampDiameter(d, window.innerWidth); const el = this._el; el.style.width = el.style.height = this.d + 'px'; el.querySelector('.onh-main').style.fontSize = M.fontFor(this.d, el.querySelector('.onh-main').textContent.length) + 'px'; this._place(); return }
    if (Math.abs(e.clientX - g.x0) + Math.abs(e.clientY - g.y0) > 4) g.moved = true
    if (g.moved) { this.pos = M.clampPos({ x: e.clientX - g.dx, y: e.clientY - g.dy }, this.size(), window.innerWidth, window.innerHeight); this._place() }
  }
  _up (e) {
    const g = this._drag; if (!g) return; this._drag = null; this._el.classList.remove('is-drag')
    try { this._el.releasePointerCapture(e.pointerId) } catch (_) {}
    if (g.kind === 'move' && !g.moved && this.min) { this.setMinimised(false); return }   // a tap on the dot brings the panel back
    this._persist()
  }

  destroy () {
    for (const [t, h] of this._bound) window.removeEventListener(t, h); this._bound = []
    this._el?.remove(); this._el = null; this._inited = false
  }
}
