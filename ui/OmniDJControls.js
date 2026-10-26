/**
 * ui/OmniDJControls.js (V195) — the small control components of the OmniDJ. Each one is an independent class:
 *   new X(opts).mount(host)  .destroy()  .setValue(v)  and (where useful) .value / .data.
 * Pure DOM + inline SVG (no canvas, no WebGL). Sizes come from the container (flex + SVG viewBox + cq units), so the same component works in a
 * 4x4-cell grid slot, a window, or - later - as one face of a cube in space (DJCircle.data is plain data a 3D version can read).
 *
 *   DJKnob    rotary 0..1 (or min..max): drag vertical or circular, wheel, double-click reset, keyboard, detents, value readout
 *   DJFader   linear slider (vertical / horizontal) with an optional level meter
 *   DJButton  button / toggle with the press-depth animation, tick and buzz
 *   DJCircle  the big jog wheel: spins by the deck's playback rate, scrubbing it seeks the deck; id 'dj-circle-N'
 * `feel` = { tick(kind) } from createClickFeel (ui/OmniGridLayout.js); optional.
 */

import { arcPath, clamp, num, angleDelta, normAngle, angleToSeconds, spinDegPerSec, fmtTime } from '../utils/OmniDJModel.js'

export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
export const tip = (name, desc, key = '—') => `data-omni-tip="${esc(name)}" data-omni-tip-key="${esc(key)}" data-omni-tip-desc="${esc(desc)}"`
const SVGNS = 'http://www.w3.org/2000/svg'
const KNOB_A0 = -135; const KNOB_A1 = 135

export const CONTROL_CSS = `
.dj { --dj-accent: var(--omni-theme-accent, #5ce8c4); --dj-text: var(--omni-theme-text, #e8f4ff); --dj-dim: rgba(255,255,255,.55); --dj-line: var(--omni-theme-border, rgba(255,255,255,.2)); --dj-bg: rgba(255,255,255,.05); font-family: 'Courier New', Courier, monospace; color: var(--dj-text); }
.dj *, .dj *::before, .dj *::after { box-sizing: border-box; }
.djk, .djf, .djc, .djb { user-select: none; -webkit-user-select: none; -webkit-tap-highlight-color: transparent; }
.djk { display: flex; flex-direction: column; align-items: stretch; justify-content: center; flex: 1 1 0; min-width: 0; min-height: 0; height: 100%; touch-action: none; cursor: ns-resize; outline: none; }
.djk[data-mode="circular"] { cursor: grab; }
.djk svg { flex: 1 1 0; min-height: 0; width: 100%; display: block; overflow: visible; }
.djk-label, .djk-val { text-align: center; line-height: 1.1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: clamp(7px, 9cqmin, 11px); }
.djk-label { color: var(--dj-dim); letter-spacing: .06em; }
.djk-val { font-variant-numeric: tabular-nums; }
.djk .k-base { fill: #1b2a3a; stroke: rgba(255,255,255,.38); stroke-width: 1.4; }
.djk .k-track { fill: none; stroke: rgba(255,255,255,.22); stroke-width: 3; stroke-linecap: round; }
.djk .k-arc { fill: none; stroke: var(--dj-accent); stroke-width: 3; stroke-linecap: round; }
.djk .k-ptr { stroke: var(--dj-text); stroke-width: 2.4; stroke-linecap: round; }
.djk .k-det { stroke: rgba(255,255,255,.4); stroke-width: 1.4; }
.djk:focus-visible .k-base, .djf:focus-visible .djf-track, .djc:focus-visible .c-outer { stroke: var(--dj-accent); stroke-width: 2.2; }
.djk.is-detent svg { animation: dj-pop .14s ease-out; }
@keyframes dj-pop { 0% { transform: scale(1); } 40% { transform: scale(.93); } 100% { transform: scale(1); } }
.djf { position: relative; display: flex; width: 100%; height: 100%; min-height: 0; touch-action: none; outline: none; cursor: pointer; padding: 2px; }
.djf[data-o="v"] { flex-direction: row; justify-content: center; gap: 3px; }
.djf[data-o="h"] { flex-direction: column; justify-content: center; gap: 2px; }
.djf-track { position: relative; background: #0c1620; border: 1px solid var(--dj-line); border-radius: 4px; flex: 1 1 0; min-width: 0; min-height: 0; }
.djf[data-o="v"] .djf-track { max-width: 14px; margin: 0 auto; }
.djf[data-o="h"] .djf-track { max-height: 12px; margin: auto 0; }
.djf-fill { position: absolute; background: color-mix(in srgb, var(--dj-accent) 55%, transparent); border-radius: 3px; pointer-events: none; }
.djf[data-o="v"] .djf-fill { left: 0; right: 0; bottom: 0; }
.djf[data-o="h"] .djf-fill { top: 0; bottom: 0; left: 0; }
.djf-thumb { position: absolute; background: var(--dj-text); border: 1px solid #000; border-radius: 3px; pointer-events: none; box-shadow: 0 1px 3px rgba(0,0,0,.6); }
.djf[data-o="v"] .djf-thumb { left: -3px; right: -3px; height: 9px; margin-bottom: -4px; }
.djf[data-o="h"] .djf-thumb { top: -3px; bottom: -3px; width: 9px; margin-left: -4px; }
.djf-meter { flex: 0 0 5px; position: relative; background: #0c1620; border: 1px solid var(--dj-line); border-radius: 2px; overflow: hidden; }
.djf-meter i { position: absolute; left: 0; right: 0; bottom: 0; height: 100%; transform-origin: bottom; transform: scaleY(0); background: linear-gradient(to top, #3ddc84 0%, #3ddc84 60%, #ffd23f 80%, #ff4d4d 100%); }
.djf-read { font-size: clamp(7px, 9cqmin, 11px); text-align: center; white-space: nowrap; color: var(--dj-dim); font-variant-numeric: tabular-nums; }
.djb { font: inherit; font-size: clamp(8px, 11cqmin, 12px); line-height: 1; min-width: 0; min-height: 0; padding: 0 3px; flex: 1 1 0; color: var(--dj-text); cursor: pointer; background: var(--dj-bg); border: 1px solid var(--dj-line); border-radius: 5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; transition: transform .06s ease, box-shadow .06s ease, background .12s ease; }
.djb:hover { background: rgba(255,255,255,.12); }
.djb:active, .djb.is-pulse { transform: translateY(1px) scale(.95); box-shadow: inset 0 2px 4px rgba(0,0,0,.5); }
.djb[aria-pressed="true"], .djb.is-on { background: var(--dj-accent); color: #04121a; border-color: transparent; }
.djb.is-warn[aria-pressed="true"] { background: #ff6b6b; }
.djb:focus-visible { outline: 2px solid var(--dj-accent); outline-offset: 1px; }
.djb:disabled { opacity: .4; cursor: default; }
.djc { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; min-height: 0; touch-action: none; cursor: grab; outline: none; }
.djc.is-scrub { cursor: grabbing; }
.djc svg { max-width: 100%; max-height: 100%; aspect-ratio: 1; width: auto; height: 100%; display: block; overflow: visible; }
.djc .c-outer { fill: #0c1620; stroke: var(--dj-line); stroke-width: 1.4; }
.djc .c-prog { fill: none; stroke: var(--dj-accent); stroke-width: 2.4; stroke-linecap: round; transform: rotate(-90deg); transform-origin: 50px 50px; }
.djc .c-progbg { fill: none; stroke: rgba(255,255,255,.12); stroke-width: 2.4; }
.djc .c-ticks { fill: none; stroke: rgba(255,255,255,.28); stroke-width: 4; }
.djc .c-plat { fill: #14212e; stroke: rgba(255,255,255,.16); stroke-width: 1; }
.djc .c-mark { stroke: var(--dj-accent); stroke-width: 3; stroke-linecap: round; }
.djc .c-num { fill: var(--dj-text); font-size: 17px; text-anchor: middle; font-weight: bold; }
.djc .c-time { fill: var(--dj-dim); font-size: 7.5px; text-anchor: middle; font-variant-numeric: tabular-nums; }
.djc .c-glow { fill: none; stroke: var(--dj-accent); stroke-width: 3; opacity: 0; }
@media (prefers-reduced-motion: reduce) { .djb, .djk.is-detent svg { transition: none; animation: none; } }
`
let cssIn = false
export function injectControlStyles () {
  if (cssIn || typeof document === 'undefined') return
  if (document.getElementById('omni-dj-control-styles')) { cssIn = true; return }
  const s = document.createElement('style'); s.id = 'omni-dj-control-styles'; s.textContent = CONTROL_CSS; (document.head || document.documentElement).appendChild(s); cssIn = true
}
const el = (tag, cls, attrs) => { const e = document.createElement(tag); if (cls) e.className = cls; if (attrs) for (const k of Object.keys(attrs)) e.setAttribute(k, attrs[k]); return e }
const sv = (tag, attrs) => { const e = document.createElementNS(SVGNS, tag); if (attrs) for (const k of Object.keys(attrs)) e.setAttribute(k, attrs[k]); return e }
const pulse = (node, cls) => { node.classList.remove(cls); void node.offsetWidth; node.classList.add(cls); setTimeout(() => node.classList.remove(cls), 160) }

class Base {
  constructor (opts = {}) { this.opts = opts; this.id = opts.id || ''; this.feel = opts.feel || null; this.root = null; this._off = []; this._destroyed = false }
  _on (target, ev, fn, o) { target.addEventListener(ev, fn, o); this._off.push(() => target.removeEventListener(ev, fn, o)) }
  _tick (kind) { try { this.feel && this.feel.tick && this.feel.tick(kind) } catch (_) { /* ignore */ } }
  mount (host) { injectControlStyles(); if (host && this.root) { host.classList.add('dj'); host.appendChild(this.root) } return this }
  destroy () { if (this._destroyed) return; this._destroyed = true; for (const f of this._off) f(); this._off = []; if (this.root && this.root.parentNode) this.root.parentNode.removeChild(this.root); this.root = null }
}

// ── DJKnob ───────────────────────────────────────────────────────────────────────────────────────────────────────────
export class DJKnob extends Base {
  /** opts: { id, label, min=0, max=1, value, def, detents:[values], mode:'vertical'|'circular', step=0.01, fmt(v), onInput(v), feel, tipName, tipDesc } */
  constructor (opts = {}) {
    super(opts)
    this.min = num(opts.min, 0); this.max = num(opts.max, 1); if (this.max <= this.min) this.max = this.min + 1
    this.def = clamp(num(opts.def, (this.min + this.max) / 2), this.min, this.max)
    this._v = clamp(num(opts.value, this.def), this.min, this.max)
    this.detents = (Array.isArray(opts.detents) ? opts.detents : []).map(d => num(d, NaN)).filter(Number.isFinite)
    this.mode = opts.mode === 'circular' ? 'circular' : 'vertical'
    this.step = num(opts.step, 0.01, 0.0001, 1)
    this.fmt = typeof opts.fmt === 'function' ? opts.fmt : (v) => v.toFixed(2)
    this._drag = null; this._atDetent = null
    this._build()
  }
  get value () { return this._v }
  get fraction () { return (this._v - this.min) / (this.max - this.min) }
  _build () {
    const o = this.opts
    const r = this.root = el('div', 'djk', { role: 'slider', tabindex: '0', 'aria-label': o.label || this.id, 'data-mode': this.mode })
    if (this.id) r.dataset.id = this.id
    r.setAttribute('data-omni-tip', o.tipName || o.label || 'Knob'); r.setAttribute('data-omni-tip-key', '—')
    r.setAttribute('data-omni-tip-desc', o.tipDesc || 'Drag up or down to turn it, mouse wheel for fine steps, double-click to reset, arrow keys when focused.')
    const lab = el('div', 'djk-label'); lab.textContent = o.label || ''
    const svg = sv('svg', { viewBox: '0 0 48 48', 'aria-hidden': 'true' })
    svg.appendChild(sv('circle', { class: 'k-base', cx: 24, cy: 24, r: 17 }))
    svg.appendChild(sv('path', { class: 'k-track', d: arcPath(24, 24, 21.5, KNOB_A0, KNOB_A1) }))
    for (const d of this.detents) { const a = (KNOB_A0 + (KNOB_A1 - KNOB_A0) * ((d - this.min) / (this.max - this.min)) - 90) * Math.PI / 180; svg.appendChild(sv('line', { class: 'k-det', x1: 24 + 18.6 * Math.cos(a), y1: 24 + 18.6 * Math.sin(a), x2: 24 + 23.6 * Math.cos(a), y2: 24 + 23.6 * Math.sin(a) })) }
    this._arc = sv('path', { class: 'k-arc', d: '' }); svg.appendChild(this._arc)
    this._ptr = sv('line', { class: 'k-ptr', x1: 24, y1: 24, x2: 24, y2: 10 }); svg.appendChild(this._ptr)
    this._val = el('div', 'djk-val')
    r.appendChild(lab); r.appendChild(svg); r.appendChild(this._val)
    this._svg = svg
    this._on(r, 'pointerdown', (e) => this._down(e)); this._on(r, 'pointermove', (e) => this._move(e)); this._on(r, 'pointerup', (e) => this._up(e)); this._on(r, 'pointercancel', (e) => this._up(e))
    this._on(r, 'wheel', (e) => { e.preventDefault(); this._userSet(this._v + (e.deltaY < 0 ? 1 : -1) * (e.shiftKey ? 0.25 : 1) * this.step * (this.max - this.min) * 2, true) }, { passive: false })
    this._on(r, 'dblclick', () => { this._tick('press'); this._userSet(this.def, true) })
    this._on(r, 'keydown', (e) => this._key(e))
    this._paint()
  }
  setValue (v) { this._v = clamp(num(v, this._v), this.min, this.max); this._paint(); return this._v }
  _paint () {
    if (!this.root) return
    const f = this.fraction; const a = KNOB_A0 + (KNOB_A1 - KNOB_A0) * f
    this._ptr.setAttribute('transform', `rotate(${a.toFixed(1)} 24 24)`)
    const a0 = this.min < this.def && this.def < this.max ? KNOB_A0 + (KNOB_A1 - KNOB_A0) * ((this.def - this.min) / (this.max - this.min)) : KNOB_A0
    this._arc.setAttribute('d', Math.abs(a - a0) < 0.5 ? '' : arcPath(24, 24, 21.5, Math.min(a0, a), Math.max(a0, a)))
    this._val.textContent = this.fmt(this._v)
    this.root.setAttribute('aria-valuemin', String(this.min)); this.root.setAttribute('aria-valuemax', String(this.max)); this.root.setAttribute('aria-valuenow', String(+this._v.toFixed(3))); this.root.setAttribute('aria-valuetext', this.fmt(this._v))
  }
  /** a user change: clamp, detent-snap, repaint, call onInput. */
  _userSet (v, exact = false) {
    let x = clamp(num(v, this._v), this.min, this.max)
    // drag: sticky detents (snap within 1.8 % of the range). wheel / keys / reset pass exact = true: they step through a detent, ticking when they land on it.
    const win = (this.max - this.min) * 0.018; let at = null
    for (const d of this.detents) if (exact ? Math.abs(x - d) < 1e-9 : Math.abs(x - d) <= win) { x = d; at = d }
    if (at !== null && at !== this._atDetent) { this._tick('detent'); pulse(this.root, 'is-detent') }
    this._atDetent = at
    if (x === this._v) return
    this._v = x; this._paint()
    if (typeof this.opts.onInput === 'function') this.opts.onInput(x, this)
  }
  _down (e) {
    if (e.button != null && e.button > 0) return
    const rect = this._svg.getBoundingClientRect()
    this._drag = { pid: e.pointerId, y0: e.clientY, f0: this.fraction, cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2, a0: Math.atan2(e.clientY - (rect.top + rect.height / 2), e.clientX - (rect.left + rect.width / 2)) * 180 / Math.PI, acc: 0 }
    try { this.root.setPointerCapture && this.root.setPointerCapture(e.pointerId) } catch (_) { /* ignore */ }
    try { this.root.focus({ preventScroll: true }) } catch (_) { /* ignore */ }
    e.preventDefault()
  }
  _move (e) {
    const d = this._drag; if (!d || e.pointerId !== d.pid) return
    let f
    if (this.mode === 'circular') {
      const a = Math.atan2(e.clientY - d.cy, e.clientX - d.cx) * 180 / Math.PI
      d.acc += angleDelta(d.a0, a); d.a0 = a
      f = d.f0 + d.acc / (KNOB_A1 - KNOB_A0) / (e.shiftKey ? 5 : 1)
    } else f = d.f0 + ((d.y0 - e.clientY) / (e.shiftKey ? 800 : 160))
    this._userSet(this.min + clamp(f, 0, 1) * (this.max - this.min))
  }
  _up (e) { const d = this._drag; if (!d || (e && e.pointerId !== d.pid)) return; this._drag = null; try { this.root.releasePointerCapture && this.root.releasePointerCapture(d.pid) } catch (_) { /* ignore */ } }
  _key (e) {
    const rng = this.max - this.min; let v = null
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') v = this._v + this.step * rng
    else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') v = this._v - this.step * rng
    else if (e.key === 'PageUp') v = this._v + this.step * rng * 10
    else if (e.key === 'PageDown') v = this._v - this.step * rng * 10
    else if (e.key === 'Home') v = this.min
    else if (e.key === 'End') v = this.max
    else if (e.key === 'Delete' || e.key === 'Backspace') { this._userSet(this.def, true); e.preventDefault(); e.stopPropagation(); return }
    if (v === null) return
    e.preventDefault(); e.stopPropagation(); this._userSet(v, true)
  }
}

// ── DJFader ──────────────────────────────────────────────────────────────────────────────────────────────────────────
export class DJFader extends Base {
  /** opts: { id, label, orientation:'v'|'h', min=0, max=1, value, def, meter:bool, step, fmt, onInput, feel } */
  constructor (opts = {}) {
    super(opts)
    this.min = num(opts.min, 0); this.max = num(opts.max, 1); if (this.max <= this.min) this.max = this.min + 1
    this.def = clamp(num(opts.def, this.min), this.min, this.max)
    this._v = clamp(num(opts.value, this.def), this.min, this.max)
    this.o = opts.orientation === 'h' ? 'h' : 'v'
    this.step = num(opts.step, 0.02, 0.001, 1)
    this.fmt = typeof opts.fmt === 'function' ? opts.fmt : (v) => v.toFixed(2)
    this._drag = null; this._level = 0
    this._build()
  }
  get value () { return this._v }
  _build () {
    const o = this.opts
    const r = this.root = el('div', 'djf', { role: 'slider', tabindex: '0', 'aria-label': o.label || this.id, 'data-o': this.o })
    if (this.id) r.dataset.id = this.id
    r.setAttribute('data-omni-tip', o.tipName || o.label || 'Fader'); r.setAttribute('data-omni-tip-key', '—')
    r.setAttribute('data-omni-tip-desc', o.tipDesc || 'Drag the cap, click the track, mouse wheel, arrow keys when focused. Double-click resets.')
    this._track = el('div', 'djf-track'); this._fill = el('div', 'djf-fill'); this._thumb = el('div', 'djf-thumb')
    this._track.appendChild(this._fill); this._track.appendChild(this._thumb); r.appendChild(this._track)
    if (o.meter) { const m = el('div', 'djf-meter'); this._meter = document.createElement('i'); m.appendChild(this._meter); r.appendChild(m) }
    if (o.readout) { this._read = el('div', 'djf-read'); if (this.o === 'v') this._read.style.cssText = 'position:absolute;left:0;right:0;bottom:-1px;'; r.appendChild(this._read) }
    this._on(r, 'pointerdown', (e) => this._down(e)); this._on(r, 'pointermove', (e) => this._move(e)); this._on(r, 'pointerup', (e) => this._up(e)); this._on(r, 'pointercancel', (e) => this._up(e))
    this._on(r, 'wheel', (e) => { e.preventDefault(); this._userSet(this._v + (e.deltaY < 0 ? 1 : -1) * this.step * (this.max - this.min)) }, { passive: false })
    this._on(r, 'dblclick', () => { this._tick('press'); this._userSet(this.def, true) })
    this._on(r, 'keydown', (e) => {
      const rng = this.max - this.min; let v = null
      if (e.key === 'ArrowUp' || e.key === 'ArrowRight') v = this._v + this.step * rng
      else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') v = this._v - this.step * rng
      else if (e.key === 'PageUp') v = this._v + this.step * rng * 5
      else if (e.key === 'PageDown') v = this._v - this.step * rng * 5
      else if (e.key === 'Home') v = this.min
      else if (e.key === 'End') v = this.max
      else if (e.key === 'Delete' || e.key === 'Backspace') { this._userSet(this.def, true); e.preventDefault(); e.stopPropagation(); return }
      if (v === null) return
      e.preventDefault(); e.stopPropagation(); this._userSet(v)
    })
    this._paint()
  }
  setValue (v) { this._v = clamp(num(v, this._v), this.min, this.max); this._paint(); return this._v }
  /** 0..1 level for the meter. */
  setMeter (l) { if (!this._meter) return; const x = clamp(num(l, 0), 0, 1); if (Math.abs(x - this._level) < 0.01) return; this._level = x; this._meter.style.transform = `scaleY(${x.toFixed(3)})` }
  _paint () {
    if (!this.root) return
    const f = (this._v - this.min) / (this.max - this.min); const pct = (f * 100).toFixed(2) + '%'
    if (this.o === 'v') { this._fill.style.height = pct; this._thumb.style.bottom = pct } else { this._fill.style.width = pct; this._thumb.style.left = pct }
    if (this._read) this._read.textContent = this.fmt(this._v)
    this.root.setAttribute('aria-valuemin', String(this.min)); this.root.setAttribute('aria-valuemax', String(this.max)); this.root.setAttribute('aria-valuenow', String(+this._v.toFixed(3))); this.root.setAttribute('aria-valuetext', this.fmt(this._v))
  }
  _userSet (v, exact = false) {
    const x = clamp(num(v, this._v), this.min, this.max)
    if (x === this._v) return
    if (!exact && ((x === this.min && this._v !== this.min) || (x === this.max && this._v !== this.max) || (this.def !== this.min && Math.abs(x - this.def) < (this.max - this.min) * 0.012 && Math.abs(this._v - this.def) >= (this.max - this.min) * 0.012))) this._tick('detent')
    this._v = x; this._paint()
    if (typeof this.opts.onInput === 'function') this.opts.onInput(x, this)
  }
  _fromPointer (e) {
    const r = this._track.getBoundingClientRect()
    const f = this.o === 'v' ? (r.height > 0 ? 1 - (e.clientY - r.top) / r.height : 0) : (r.width > 0 ? (e.clientX - r.left) / r.width : 0)
    return this.min + clamp(f, 0, 1) * (this.max - this.min)
  }
  _down (e) {
    if (e.button != null && e.button > 0) return
    this._drag = { pid: e.pointerId }
    try { this.root.setPointerCapture && this.root.setPointerCapture(e.pointerId) } catch (_) { /* ignore */ }
    try { this.root.focus({ preventScroll: true }) } catch (_) { /* ignore */ }
    this._userSet(this._fromPointer(e)); e.preventDefault()
  }
  _move (e) { const d = this._drag; if (!d || e.pointerId !== d.pid) return; this._userSet(this._fromPointer(e)) }
  _up (e) { const d = this._drag; if (!d || (e && e.pointerId !== d.pid)) return; this._drag = null; try { this.root.releasePointerCapture && this.root.releasePointerCapture(d.pid) } catch (_) { /* ignore */ } }
}

// ── DJButton ─────────────────────────────────────────────────────────────────────────────────────────────────────────
export class DJButton extends Base {
  /** opts: { id, label, toggle:bool, value, warn:bool, onPress(), onChange(on), feel, tipName, tipDesc, tipKey, ariaLabel } */
  constructor (opts = {}) {
    super(opts)
    this._on_ = opts.value === true; this.toggle = opts.toggle === true
    const b = this.root = el('button', 'djb' + (opts.warn ? ' is-warn' : ''), { type: 'button' })
    if (this.id) b.dataset.id = this.id
    b.setAttribute('aria-label', opts.ariaLabel || opts.tipName || opts.label || this.id)
    b.setAttribute('data-omni-tip', opts.tipName || opts.label || 'Button'); b.setAttribute('data-omni-tip-key', opts.tipKey || '—'); b.setAttribute('data-omni-tip-desc', opts.tipDesc || opts.tipName || '')
    b.textContent = opts.label || ''
    if (this.toggle) b.setAttribute('aria-pressed', String(this._on_))
    this._on(b, 'pointerdown', () => { this._tick('press'); b.classList.remove('is-pulse'); this._kbTick = false })
    this._on(b, 'click', (e) => {
      if (e.detail === 0) this._tick('press')   // keyboard / assistive click (the pointer path ticked on pointerdown)
      if (this.toggle) { this._on_ = !this._on_; b.setAttribute('aria-pressed', String(this._on_)); if (typeof opts.onChange === 'function') opts.onChange(this._on_, this) }
      if (typeof opts.onPress === 'function') opts.onPress(this)
    })
  }
  get value () { return this._on_ }
  setValue (on) { this._on_ = !!on; if (this.toggle && this.root) this.root.setAttribute('aria-pressed', String(this._on_)); else if (this.root) this.root.classList.toggle('is-on', this._on_); return this._on_ }
  setLabel (t) { if (this.root) this.root.textContent = t }
  setDisabled (d) { if (this.root) this.root.disabled = !!d }
}

// ── DJCircle ─────────────────────────────────────────────────────────────────────────────────────────────────────────
/**
 * One jog wheel. Independent component: id 'dj-circle-N', no knowledge of the grid. A 3D version can build its own face from `.data`
 * (angle, velocity, progress, level, playing, loaded) and call setSpin / setValue / scrub the same way.
 * opts: { index: 1..6, onScrubStart(), onScrub(deltaSeconds, angle), onScrubEnd(), onReset(), feel }
 */
export class DJCircle extends Base {
  constructor (opts = {}) {
    const index = Math.max(1, Math.min(6, Math.round(num(opts.index, 1))))
    super({ ...opts, id: opts.id || `dj-circle-${index}` })
    this.index = index
    this._angle = 0; this._vel = 0; this._progress = 0; this._level = 0; this._playing = false; this._loaded = false; this._time = 0; this._drag = null; this._lastLabel = ''
    this._build()
  }
  get data () { return { id: this.id, index: this.index, angle: this._angle, velocity: this._vel, progress: this._progress, level: this._level, playing: this._playing, loaded: this._loaded, time: this._time } }
  _build () {
    const r = this.root = el('div', 'djc', { role: 'slider', tabindex: '0', 'aria-label': `Deck ${this.index} jog wheel`, 'aria-valuemin': '0', 'aria-valuemax': '360' })
    r.dataset.id = this.id; r.dataset.circle = String(this.index)
    r.setAttribute('data-omni-tip', `Deck ${this.index} jog wheel`); r.setAttribute('data-omni-tip-key', '—')
    r.setAttribute('data-omni-tip-desc', 'Spins at the speed of the deck. Drag it in a circle to scrub the track (one turn = 1.8 seconds), mouse wheel nudges, double-click returns to the cue point. Left and right arrows nudge when focused.')
    const svg = this._svg = sv('svg', { viewBox: '0 0 100 100', 'aria-hidden': 'true' })
    svg.appendChild(sv('circle', { class: 'c-outer', cx: 50, cy: 50, r: 48 }))
    this._glow = sv('circle', { class: 'c-glow', cx: 50, cy: 50, r: 48 }); svg.appendChild(this._glow)
    svg.appendChild(sv('circle', { class: 'c-progbg', cx: 50, cy: 50, r: 44 }))
    this._prog = sv('circle', { class: 'c-prog', cx: 50, cy: 50, r: 44, pathLength: 100, 'stroke-dasharray': '0 100' }); svg.appendChild(this._prog)
    this._rot = sv('g', { transform: 'rotate(0 50 50)' })
    this._rot.appendChild(sv('circle', { class: 'c-ticks', cx: 50, cy: 50, r: 37, pathLength: 120, 'stroke-dasharray': '0.7 2.3' }))
    this._rot.appendChild(sv('circle', { class: 'c-plat', cx: 50, cy: 50, r: 30 }))
    this._rot.appendChild(sv('line', { class: 'c-mark', x1: 50, y1: 22, x2: 50, y2: 10 }))
    svg.appendChild(this._rot)
    this._num = sv('text', { class: 'c-num', x: 50, y: 52 }); this._num.textContent = String(this.index); svg.appendChild(this._num)
    this._timeEl = sv('text', { class: 'c-time', x: 50, y: 63 }); this._timeEl.textContent = '0:00'; svg.appendChild(this._timeEl)
    r.appendChild(svg)
    this._on(r, 'pointerdown', (e) => this._down(e)); this._on(r, 'pointermove', (e) => this._move(e)); this._on(r, 'pointerup', (e) => this._up(e)); this._on(r, 'pointercancel', (e) => this._up(e))
    this._on(r, 'wheel', (e) => { e.preventDefault(); const deg = (e.deltaY > 0 ? 1 : -1) * 12; this._rotateBy(deg, false) }, { passive: false })
    this._on(r, 'dblclick', () => { this._tick('press'); this.setValue(0); if (typeof this.opts.onReset === 'function') this.opts.onReset() })
    this._on(r, 'keydown', (e) => {
      const s = e.shiftKey ? 10 : 1
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') this._rotateBy(30 * s, false)
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') this._rotateBy(-30 * s, false)
      else return
      e.preventDefault(); e.stopPropagation()
    })
    this._paintAngle()
  }
  /** The visible rotation in degrees (the wheel's value). */
  setValue (deg) { this._angle = normAngle(deg); this._paintAngle(); return this._angle }
  setSpin (degPerSec) { this._vel = num(degPerSec, 0, -3600, 3600) }
  /** Called every UI frame with the deck snapshot: spin speed from the playback rate, progress ring, time, level glow. */
  sync (deck, level = 0, dt = 0) {
    if (!this.root) return
    const playing = !!(deck && deck.playing); this._playing = playing; this._loaded = !!(deck && deck.loaded)
    this.setSpin(spinDegPerSec(deck ? deck.rate : 1, playing))
    if (!this._drag && dt > 0 && this._vel) { this._angle = normAngle(this._angle + this._vel * dt); this._paintAngle() }
    const dur = deck && deck.duration > 0 ? deck.duration : 0; const t = deck ? deck.time : 0
    this._time = t; this._progress = dur ? clamp(t / dur, 0, 1) : 0; this._level = clamp(num(level, 0), 0, 1)
    this._prog.setAttribute('stroke-dasharray', `${(this._progress * 100).toFixed(2)} 100`)
    this._glow.style.opacity = String(Math.min(0.85, this._level * 2.5).toFixed(2))
    const label = fmtTime(t)
    if (label !== this._lastLabel) { this._lastLabel = label; this._timeEl.textContent = deck && deck.loaded ? label : '--:--' }
  }
  _paintAngle () {
    if (!this.root) return
    this._rot.setAttribute('transform', `rotate(${this._angle.toFixed(1)} 50 50)`)
    this.root.setAttribute('aria-valuenow', String(Math.round(this._angle)))
  }
  _rotateBy (deg, scrubbing) {
    this._angle = normAngle(this._angle + deg); this._paintAngle()
    if (typeof this.opts.onScrub === 'function') this.opts.onScrub(angleToSeconds(deg), this._angle, scrubbing)
  }
  _pointerAngle (e) { const r = this._svg.getBoundingClientRect(); return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180 / Math.PI }
  _down (e) {
    if (e.button != null && e.button > 0) return
    this._drag = { pid: e.pointerId, a: this._pointerAngle(e) }
    try { this.root.setPointerCapture && this.root.setPointerCapture(e.pointerId) } catch (_) { /* ignore */ }
    try { this.root.focus({ preventScroll: true }) } catch (_) { /* ignore */ }
    this.root.classList.add('is-scrub'); this._tick('press')
    if (typeof this.opts.onScrubStart === 'function') this.opts.onScrubStart()
    e.preventDefault()
  }
  _move (e) {
    const d = this._drag; if (!d || e.pointerId !== d.pid) return
    const a = this._pointerAngle(e); const da = angleDelta(d.a, a); d.a = a
    if (da) this._rotateBy(da, true)
  }
  _up (e) {
    const d = this._drag; if (!d || (e && e.pointerId !== d.pid)) return
    this._drag = null; this.root.classList.remove('is-scrub')
    try { this.root.releasePointerCapture && this.root.releasePointerCapture(d.pid) } catch (_) { /* ignore */ }
    if (typeof this.opts.onScrubEnd === 'function') this.opts.onScrubEnd()
  }
  destroy () {
    if (this._drag && typeof this.opts.onScrubEnd === 'function') { try { this.opts.onScrubEnd() } catch (_) { /* ignore */ } }
    this._drag = null; super.destroy()
  }
}

export default { DJKnob, DJFader, DJButton, DJCircle, injectControlStyles, tip, esc }
