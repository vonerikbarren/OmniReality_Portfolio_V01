/**
 * ui/OmniOrbPanel.js (V221) — the LeftHand orb: a greyscale charge-beam sphere of possibility.
 *
 * Opens from the ◉ ORB button that sits beside BOOST above the LH pad, from `Omni Orb open`, or from omni:orb-open { hand:'lh' }.
 *   - words orbit the core on tilted rings (Opportunities, Unknowns, Undefined, Possibilities, ? ...); edit them in ⟐OmniHands → LH → ◉ Orb
 *   - the LH magazine's tools stream into the core; click one to load it as the hand's ammo
 *   - hover or tap a word or tool for its tooltip
 *   - HOLD the core to charge, RELEASE to fire the loaded ammo (the same as the pad's Activation: omni:hand-activate { hand:'lh', charge })
 * Drawn on a plain 2D canvas inside the panel (no second WebGL context, light on phones); animates only while open.
 * LH only. RH, ConsciousHand and OmniHand get their own orbs later (claude/OMNIORB_ToolMenu_Ideas.md).
 * Events: omni:orb-open / omni:orb-close / omni:orb-toggle in; omni:orb-state { hand, open } and omni:orb-fired { hand, charge, ammo } out.
 * Module contract: constructor / init / update / destroy / onResize (the frame loop is its own rAF, only while open).
 */
import { getHandSetting } from '../utils/OmniHandsSettings.js'
import { cleanWords, wordPositions, streamPositions, chargeAt, greyAt, wordTip } from '../utils/OmniOrbModel.js'
import { setHandSetting } from '../utils/OmniHandsSettings.js'

const HAND = 'lh'
const SIZE = 300
const CORE_HIT = 0.2          // core radius as a fraction of the orb radius
const STYLE_ID = 'omni-orb-styles'
const CSS = `
.omni-orb { position: fixed; z-index: 63; width: ${SIZE}px; max-width: calc(100vw - 16px); display: none; flex-direction: column; pointer-events: auto;
  background: rgba(6,6,8,.94); border: 1px solid rgba(255,255,255,.16); border-radius: 14px; box-shadow: 0 10px 34px rgba(0,0,0,.55); font-family: 'Courier New', monospace; color: #eee; user-select: none; -webkit-user-select: none; }
.omni-orb.is-open { display: flex; }
.oorb-head { height: 30px; display: flex; align-items: center; justify-content: center; position: relative; cursor: grab; touch-action: none; font-size: 11px; color: #aaa; border-bottom: 1px solid rgba(255,255,255,.12); }
.oorb-close { position: absolute; right: 6px; width: 20px; height: 20px; border-radius: 6px; border: 1px solid rgba(255,255,255,.2); background: transparent; color: #bbb; cursor: pointer; padding: 0; }
.oorb-canvas { width: 100%; aspect-ratio: 1; display: block; touch-action: none; cursor: crosshair; }
.oorb-tip { min-height: 30px; padding: 4px 10px 8px; font-size: 10px; line-height: 1.4; color: #bbb; }
.oorb-tip b { color: #fff; }
`

export default class OmniOrbPanel {
  constructor () {
    this._el = null; this._cv = null; this._g = null; this._tipEl = null; this._btn = null; this._bound = []; this._inited = false
    this._open = false; this._t = 0; this._last = 0; this._raf = 0
    this._hold = null; this._charge = 0; this._burst = 0; this._hits = []; this._hover = null; this._msg = ''
    this._pos = null; this._drag = null
  }
  isOpen () { return this._open }
  get charge () { return this._charge }

  init () {
    if (this._inited) return; this._inited = true
    if (!document.getElementById(STYLE_ID)) { const s = document.createElement('style'); s.id = STYLE_ID; s.textContent = CSS; document.head.appendChild(s) }
    const on = (t, fn, tgt = window) => { tgt.addEventListener(t, fn); this._bound.push([tgt, t, fn]) }
    on('omni:orb-open', (e) => { if ((e.detail?.hand ?? HAND) === HAND) this.open() })
    on('omni:orb-close', () => this.close())
    on('omni:orb-toggle', (e) => { if ((e.detail?.hand ?? HAND) === HAND) this.toggle() })
    on('omni:hand-ammo-feedback', (e) => this._feedback(e.detail ?? {}))
    on('keydown', (e) => { if (e.key === 'Escape' && this._open) this.close() })
    on('resize', () => { if (this._open) this._place() })
    this._buildButton()
  }

  // ── open / close ──
  open () {
    if (!this._el) this._build()
    this._el.classList.add('is-open'); this._open = true; this._place(); this._sync()
    this._last = 0; this._loop()
    this._emit('omni:orb-state', { hand: HAND, open: true })
  }
  close () {
    if (!this._open) return
    this._open = false; this._el?.classList.remove('is-open'); this._hold = null; this._charge = 0
    cancelAnimationFrame(this._raf)
    this._emit('omni:orb-state', { hand: HAND, open: false })
  }
  toggle () { this._open ? this.close() : this.open() }
  _emit (name, detail) { try { window.dispatchEvent(new CustomEvent(name, { detail })) } catch (_) {} }

  // ── dom ──
  _shell () { return document.getElementById('omni-ui') ?? document.body }
  _build () {
    const el = document.createElement('div'); el.className = 'omni-orb'; el.id = 'omni-orb-lh'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'LH orb')
    el.innerHTML = `<div class="oorb-head"><span>◉ LH · possibility</span><button type="button" class="oorb-close" aria-label="Close">×</button></div><canvas class="oorb-canvas" width="${SIZE * 2}" height="${SIZE * 2}"></canvas><div class="oorb-tip"></div>`
    this._shell().appendChild(el); this._el = el
    this._cv = el.querySelector('canvas'); this._g = this._cv.getContext('2d'); this._tipEl = el.querySelector('.oorb-tip')
    el.querySelector('.oorb-close').addEventListener('click', () => this.close())
    const head = el.querySelector('.oorb-head')
    head.addEventListener('pointerdown', (e) => { if (e.target.closest('.oorb-close')) return; const r = el.getBoundingClientRect(); this._drag = { dx: e.clientX - r.left, dy: e.clientY - r.top }; try { head.setPointerCapture(e.pointerId) } catch (_) {} })
    head.addEventListener('pointermove', (e) => { if (!this._drag) return; this._pos = { x: e.clientX - this._drag.dx, y: e.clientY - this._drag.dy }; this._place() })
    const end = () => { this._drag = null }
    head.addEventListener('pointerup', end); head.addEventListener('pointercancel', end)
    const cv = this._cv
    cv.addEventListener('pointerdown', (e) => this._down(e)); cv.addEventListener('pointermove', (e) => this._move(e))
    cv.addEventListener('pointerup', (e) => this._up(e)); cv.addEventListener('pointercancel', () => { this._hold = null; this._charge = 0 })
    cv.addEventListener('pointerleave', () => { this._hover = null; this._showTip() })
    cv.addEventListener('contextmenu', e => e.preventDefault())
  }
  _buildButton () {
    const b = document.createElement('button'); b.type = 'button'; b.id = 'omni-orb-btn-lh'; b.textContent = '◉ ORB'
    b.title = 'LH orb: a sphere of possibility. Hold its core to charge, release to fire the loaded tool.'; b.setAttribute('aria-label', 'Open the LH orb')
    b.dataset.omniTip = 'LH orb'; b.dataset.omniTipKey = '—'; b.dataset.omniTipDesc = b.title
    Object.assign(b.style, { position: 'fixed', zIndex: '9000', display: 'none', padding: '6px 9px', borderRadius: '14px', font: '700 10px system-ui,sans-serif', letterSpacing: '.08em',
      color: '#fff', background: 'rgba(20,20,24,.72)', border: '1px solid rgba(255,255,255,.45)', cursor: 'pointer', userSelect: 'none', touchAction: 'manipulation' })
    b.addEventListener('click', () => this.toggle())
    this._shell().appendChild(b); this._btn = b
  }
  _place () {
    if (!this._el) return
    const w = this._el.offsetWidth || SIZE, h = this._el.offsetHeight || SIZE + 70
    let x, y
    if (this._pos) ({ x, y } = this._pos)
    else { const chip = document.getElementById('omni-pad-chip-lh'); const r = chip?.getBoundingClientRect(); x = r ? r.right + 12 : 20; y = r ? r.top - h + 40 : 80 }
    x = Math.max(8, Math.min(window.innerWidth - w - 8, x)); y = Math.max(8, Math.min(window.innerHeight - h - 8, y))
    this._el.style.left = x + 'px'; this._el.style.top = y + 'px'
  }
  /** keep the ◉ button above the LH chip, left of BOOST, only while the pad is open */
  update () {
    const b = this._btn; if (!b) return
    const chip = document.getElementById('omni-pad-chip-lh'); const cs = chip ? getComputedStyle(chip) : null
    const vis = !!cs && cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) > 0.1 && cs.pointerEvents !== 'none' && chip.getClientRects().length > 0
    if (!vis) { b.style.display = 'none'; return }
    const r = chip.getBoundingClientRect(); b.style.display = 'block'
    const w = b.offsetWidth || 54, boost = document.getElementById('omni-boost-lh')
    const bx = boost && boost.style.display !== 'none' ? boost.getBoundingClientRect().left : r.left + r.width / 2
    b.style.top = Math.max(4, r.top - 30) + 'px'; b.style.left = Math.max(4, Math.min(window.innerWidth - w - 4, bx - w - 6)) + 'px'
    b.style.background = this._open ? 'rgba(255,255,255,.88)' : 'rgba(20,20,24,.72)'; b.style.color = this._open ? '#111' : '#fff'
  }

  // ── content ──
  _words () { return cleanWords(getHandSetting(HAND, 'orbWords')) }
  _tools () { const mag = getHandSetting(HAND, 'magazine') ?? []; return mag }
  _ammo () { const mag = this._tools(), cur = getHandSetting(HAND, 'ammo'); return mag.includes(cur) ? cur : (mag[0] ?? null) }
  _sync () { this._showTip() }
  _feedback (d) {
    if (d.hand !== HAND) return
    this._msg = { fired: 'Fired.', released: 'Released.', 'no-target': 'No target: select a node first.', blocked: 'That node has its own behaviour.', empty: 'The magazine is empty.' }[d.kind] ?? ''
    this._msgT = 2.2; this._hover = null; this._showTip()
  }
  _showTip () {
    if (!this._tipEl) return
    const h = this._hover
    if (h) { this._tipEl.innerHTML = ''; const b = document.createElement('b'); b.textContent = h.title; this._tipEl.append(b, document.createTextNode(' · ' + h.text)); return }
    const a = this._ammo()
    this._tipEl.textContent = this._msg || (a ? `Loaded: ${a}. Hold the core to charge, release to fire.` : 'The magazine is empty. Load tools in ⟐OmniHands.')
  }

  // ── pointer ──
  _pt (e) { const r = this._cv.getBoundingClientRect(); const k = SIZE / Math.max(1, r.width); return { x: (e.clientX - r.left) * k - SIZE / 2, y: (e.clientY - r.top) * k - SIZE / 2 } }
  _hit (p) {
    const R = SIZE * 0.46
    if (Math.hypot(p.x, p.y) < R * CORE_HIT * 1.3) return { kind: 'core' }
    let best = null, bd = 1e9
    for (const h of this._hits) { const d = Math.hypot(p.x - h.x, p.y - h.y); if (d < h.r && d < bd) { bd = d; best = h } }
    return best
  }
  _down (e) {
    e.preventDefault(); try { this._cv.setPointerCapture(e.pointerId) } catch (_) {}
    const h = this._hit(this._pt(e))
    if (h?.kind === 'core') { this._hold = { at: performance.now() }; this._charge = 0; this._msg = '' }
    else if (h?.kind === 'tool') { setHandSetting(HAND, 'ammo', h.name); this._msg = `Loaded ${h.name}.`; this._msgT = 2; this._burst = 0.5; this._showTip() }
  }
  _move (e) {
    const h = this._hit(this._pt(e)); let next = null
    if (h?.kind === 'word') next = { title: h.word, text: wordTip(h.word) }
    else if (h?.kind === 'tool') next = { title: h.name, text: (h.name === this._ammo() ? 'Loaded. ' : '') + 'Click to load this tool as your ammo.' }
    else if (h?.kind === 'core') next = { title: 'Core', text: 'Hold to charge, release to fire the loaded tool.' }
    if ((next?.title ?? null) !== (this._hover?.title ?? null)) { this._hover = next; this._showTip() }
  }
  _up (e) {
    try { this._cv.releasePointerCapture(e.pointerId) } catch (_) {}
    if (!this._hold) return
    const charge = this._charge; this._hold = null; this._charge = 0
    this.fire(charge)
  }
  /** fire the loaded ammo, as the pad's Activation does */
  fire (charge = 0) {
    const ammo = this._ammo(); this._burst = 1 + charge
    this._emit('omni:hand-activate', { hand: HAND, charge })
    this._emit('omni:orb-fired', { hand: HAND, charge, ammo })
  }

  // ── frame ──
  _loop () {
    cancelAnimationFrame(this._raf)
    const step = (now) => { if (!this._open) return; this.frame(now); this._raf = requestAnimationFrame(step) }
    this._raf = requestAnimationFrame(step)
  }
  frame (now = performance.now()) {
    const dt = this._last ? Math.min(0.1, (now - this._last) / 1000) : 0; this._last = now
    this._t += dt * (Number(getHandSetting(HAND, 'orbSpeed')) || 1)
    if (this._hold) this._charge = chargeAt(now - this._hold.at, Number(getHandSetting(HAND, 'orbChargeMs')) || 1200)
    this._burst = Math.max(0, this._burst - dt * 2.2)
    if (this._msgT > 0) { this._msgT -= dt; if (this._msgT <= 0) { this._msg = ''; this._showTip() } }
    this._draw()
  }
  _draw () {
    const g = this._g; if (!g) return
    const S = SIZE, R = S * 0.46, c = this._charge, t = this._t, burst = this._burst
    g.setTransform(2, 0, 0, 2, 0, 0); g.clearRect(0, 0, S, S); g.save(); g.translate(S / 2, S / 2)
    // rings
    g.lineWidth = 0.6
    for (let r = 0; r < 3; r++) {
      g.save(); const k = [1.0, 0.86, 0.7][r], tl = [0.35, -0.5, 0.1][r]; g.rotate(tl); g.strokeStyle = `rgba(200,200,200,${0.13 + 0.12 * c})`; g.beginPath()
      g.ellipse(0, 0, R * k, R * [0.42, 0.36, 0.3][r], 0, 0, Math.PI * 2); g.stroke(); g.restore()
    }
    const words = wordPositions(this._words(), t, 1), tools = streamPositions(this._tools(), t, 1), ammo = this._ammo()
    this._hits = []
    const drawWord = (w) => {
      const gr = greyAt(w.z, c), px = w.x * R, py = w.y * R
      g.font = `${Math.round(10 + 3 * w.s)}px 'Courier New', monospace`; g.textAlign = 'center'; g.textBaseline = 'middle'
      g.fillStyle = `rgba(${gr},${gr},${gr},${0.35 + 0.65 * (w.z + 1) / 2})`; g.fillText(w.word, px, py)
      this._hits.push({ kind: 'word', word: w.word, x: px, y: py, r: Math.max(14, g.measureText(w.word).width / 2 + 4) })
    }
    words.filter(w => w.z < 0).forEach(drawWord)
    // tools falling into the core
    for (const s of tools) {
      const px = s.x * R, py = s.y * R, loaded = s.name === ammo
      g.fillStyle = `rgba(255,255,255,${(loaded ? 0.9 : 0.55) * s.a})`; g.beginPath(); g.arc(px, py, (loaded ? 3.6 : 2.4) * (1.2 - s.p * 0.6), 0, Math.PI * 2); g.fill()
      if (loaded) { g.strokeStyle = `rgba(255,255,255,${0.7 * s.a})`; g.lineWidth = 0.8; g.beginPath(); g.arc(px, py, 6, 0, Math.PI * 2); g.stroke() }
      if (s.a > 0.25) this._hits.push({ kind: 'tool', name: s.name, x: px, y: py, r: 11 })
    }
    // core
    const cr = R * CORE_HIT * (0.8 + 0.5 * c + 0.4 * burst) * (1 + 0.04 * Math.sin(t * 5))
    const grad = g.createRadialGradient(0, 0, 0, 0, 0, cr * 2.6)
    grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.35, `rgba(210,210,210,${0.8 + 0.2 * c})`); grad.addColorStop(0.7, 'rgba(90,90,90,0.35)'); grad.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = grad; g.beginPath(); g.arc(0, 0, cr * 2.6, 0, Math.PI * 2); g.fill()
    if (c > 0) { g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, cr * 1.5, -Math.PI / 2, -Math.PI / 2 + c * Math.PI * 2); g.stroke() }
    if (burst > 0) { g.strokeStyle = `rgba(255,255,255,${burst * 0.8})`; g.lineWidth = 1.5; g.beginPath(); g.arc(0, 0, R * (1.05 - burst * 0.9), 0, Math.PI * 2); g.stroke() }
    words.filter(w => w.z >= 0).forEach(drawWord)
    g.restore()
  }

  onResize () { if (this._open) this._place() }
  destroy () {
    cancelAnimationFrame(this._raf)
    for (const [tgt, t, fn] of this._bound) tgt.removeEventListener(t, fn); this._bound = []
    this._el?.remove(); this._btn?.remove(); this._el = null; this._btn = null; this._open = false; this._inited = false
  }
}
