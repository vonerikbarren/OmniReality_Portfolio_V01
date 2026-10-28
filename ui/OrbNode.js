/**
 * ui/OrbNode.js (V234) — OrbNode: the orb class. One instance per hand (lh, rh, conscious, omnihand). The old LH-only OmniOrbPanel (V221) is now OrbNode('lh').
 *
 * An orb shows the POTENTIALS (what could be done: words, utils/OmniOrbPotentials.js, about 30 synonyms plus the same idea in 19 more languages,
 * a handful shown at a time and swapped at random) around a core, while the TOOLS streaming into the core are what is actually available
 * (LH / RH: the magazine; ConsciousHand: its axis options; OmniHand: the OmniProducts you can open now; the products you cannot open yet stay in the orbit, dim).
 *
 *   open / close   the hand's ⦿ Orb-it cell (omni:orbiter { hand }), `Omni Orb open hand(rh)`, or omni:orb-open { hand }. It sits BEHIND the hand's ⬢ tools menu:
 *                  centred on the radial (#omni-radial-<hand>), under it (z-index 63 < 65). Drag the rim to move it for this session.
 *   click a word   select / unselect it (a selected word stays in view);   click a tool   LH / RH: load as ammo · OmniHand: open that product
 *   hold the core  charge, release: LH / RH fire the loaded ammo (as the pad's Activation) · ConsciousHand / OmniHand summon an orb into the scene, bigger when charged
 *   Summon button  put an OrbNode in the SCENE (systems/OmniOrbNodes.js) looping the selected words (or the ones in view) at a spot in front of you
 * Look (⟐OmniHands → the hand → ◉ Orb): words, count shown, speed, panel colour, opacity, and one picture or video (utils/OmniOrbMedia.js).
 * Drawn on a plain 2D canvas (no second WebGL context); animates only while open.
 * Events: omni:orb-open / -close / -toggle in; omni:orb-state { hand, open } and omni:orb-fired { hand, charge, ammo } out.
 */
import { getHandSetting, setHandSetting } from '../utils/OmniHandsSettings.js'
import { STRONG_AT, FULL_AT } from '../utils/OmniChargeTier.js'
import { cleanWords, wordPositions, streamPositions, chargeAt, greyAt, wordTip as lhTip } from '../utils/OmniOrbModel.js'
import { HANDS, defaultPool, wordInfo, createLoop, stepLoop, syncLoop, fadeIn } from '../utils/OmniOrbPotentials.js'
import { loadMedia } from '../utils/OmniOrbMedia.js'
import { resolveSites } from '../utils/OmniStarLightSites.js'

const SIZE = 300
const ORB_R = 0.40            // the orb's radius as a fraction of the panel; the margin outside it is the rim you drag by
const CORE_HIT = 0.2
const STYLE_ID = 'omni-orb-styles'
const CSS = `
.omni-orb { position: fixed; z-index: 63; width: ${SIZE}px; height: ${SIZE}px; max-width: calc(100vw - 16px); max-height: calc(100vw - 16px); display: none; pointer-events: auto; overflow: hidden; border-radius: 50%;
  border: 1px solid rgba(255,255,255,.22); box-shadow: 0 0 26px rgba(255,255,255,.08), 0 10px 34px rgba(0,0,0,.55);
  font-family: 'Courier New', monospace, sans-serif; color: #eee; user-select: none; -webkit-user-select: none; }
.omni-orb.is-open { display: block; }
.oorb-media { position: absolute; inset: 0; border-radius: 50%; overflow: hidden; pointer-events: none; }
.oorb-media > * { width: 100%; height: 100%; object-fit: cover; display: block; }
.oorb-canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; touch-action: none; cursor: crosshair; }
.oorb-canvas.is-rim { cursor: grab; } .oorb-canvas.is-drag { cursor: grabbing; }
.oorb-close { position: absolute; top: 3.5%; left: 50%; transform: translateX(-50%); width: 22px; height: 22px; border-radius: 50%; border: 1px solid rgba(255,255,255,.3); background: rgba(0,0,0,.35); color: #ccc; cursor: pointer; font-size: 14px; line-height: 1; padding: 0; }
.oorb-close:hover { background: rgba(255,255,255,.2); }
.oorb-summon { position: absolute; bottom: 7.5%; left: 50%; transform: translateX(-50%); padding: 3px 12px; border-radius: 12px; border: 1px solid rgba(255,255,255,.4); background: rgba(0,0,0,.45); color: #fff; font: 700 10px system-ui, sans-serif; letter-spacing: .08em; cursor: pointer; touch-action: manipulation; }
.oorb-summon:hover { background: rgba(255,255,255,.25); }
.oorb-tip { position: absolute; left: 18%; right: 18%; bottom: 19%; text-align: center; font-size: 10px; line-height: 1.3; color: #ccc; pointer-events: none; text-shadow: 0 0 6px #000; }
.oorb-tip b { color: #fff; }
`
const FLASH = { lh: 'LH', rh: 'RH', conscious: 'ConsciousHand', omnihand: 'OmniHand' }
const CONSCIOUS_TOOLS = ['TakeMeThere', 'Root', 'Back', 'Forth', 'Up', 'Down', 'Reset marker', 'Tunnel', 'Follow pads']
const AMMO_HANDS = ['lh', 'rh']
const hexRgb = (h) => { const n = parseInt(String(h).slice(1), 16) || 0; return [(n >> 16) & 255, (n >> 8) & 255, n & 255] }
const shade = (hex, k) => 'rgb(' + hexRgb(hex).map(v => Math.round(v * k)).join(',') + ')'

export default class OrbNode {
  constructor (hand = 'lh') {
    if (!HANDS[hand]) throw new Error('OrbNode: hand is one of ' + Object.keys(HANDS).join(', '))
    this.hand = hand; this.pal = HANDS[hand].palette
    this._el = null; this._cv = null; this._g = null; this._tipEl = null; this._media = null; this._mediaUrl = null; this._bound = []; this._inited = false
    this._open = false; this._t = 0; this._last = 0; this._raf = 0; this._hold = null; this._charge = 0; this._burst = 0; this._hits = []; this._hover = null; this._msg = ''
    this._pos = null; this._drag = null; this._loop = null; this._sel = new Set(); this._products = []; this._now = 0
  }
  isOpen () { return this._open }
  get charge () { return this._charge }
  _set (k) { return getHandSetting(this.hand, k) }

  init () {
    if (this._inited) return; this._inited = true
    if (!document.getElementById(STYLE_ID)) { const s = document.createElement('style'); s.id = STYLE_ID; s.textContent = CSS; document.head.appendChild(s) }
    const on = (t, fn, tgt = window) => { tgt.addEventListener(t, fn); this._bound.push([tgt, t, fn]) }
    const mine = (e) => (e.detail?.hand ?? this.hand) === this.hand
    on('omni:orb-open', (e) => { if (mine(e)) this.open() })
    on('omni:orb-close', (e) => { if (!e.detail?.hand || mine(e)) this.close() })
    on('omni:orb-toggle', (e) => { if (mine(e)) this.toggle() })
    on('omni:orbiter', (e) => { if (e.detail?.hand === this.hand) this.toggle() })       // the hand's ⦿ Orb-it cell
    on('omni:hand-ammo-feedback', (e) => this._feedback(e.detail ?? {}))
    on('omni:radial-toggle', (e) => { if (e.detail?.hand === this.hand && this._open && !this._pos) setTimeout(() => this._place(), 0) })
    on('omni:hands-settings-changed', (e) => { if (e.detail?.hand === this.hand) this._settingChanged(e.detail.key) })
    on('omni:orb-media-changed', (e) => { if (e.detail?.hand === this.hand) { this._mediaSig = null; this._applyMedia() } })
    on('keydown', (e) => { if (e.key === 'Escape' && this._open) this.close() })
    on('resize', () => { if (this._open) this._place() })
  }

  // ── open / close ──
  open () {
    if (!this._el) this._build()
    this._el.classList.add('is-open'); this._open = true; this._applyLook(); this._place(); this._sync(); this._refreshProducts()
    this._last = 0; this._runLoop()
    this._emit('omni:orb-state', { hand: this.hand, open: true })
  }
  close () {
    if (!this._open) return
    this._open = false; this._el?.classList.remove('is-open'); this._hold = null; this._charge = 0
    cancelAnimationFrame(this._raf)
    this._emit('omni:orb-state', { hand: this.hand, open: false })
  }
  toggle () { this._open ? this.close() : this.open() }
  _emit (name, detail) { try { window.dispatchEvent(new CustomEvent(name, { detail })) } catch (_) {} }
  _settingChanged (key) {
    if (/^orb(Opacity|Color|MediaOpacity)$/.test(key)) this._applyLook()
    if (/^orbMedia(Kind|Name)$/.test(key)) this._applyMedia()
  }

  // ── look ──
  _applyLook () {
    const el = this._el; if (!el) return
    el.style.opacity = String(Math.min(1, Math.max(0.15, Number(this._set('orbOpacity')) || 1)))
    const c = /^#[0-9a-f]{6}$/i.test(this._set('orbColor')) ? this._set('orbColor') : this.pal.disc
    el.style.background = `radial-gradient(circle at 50% 50%, ${c} 0%, ${shade(c, 0.35)} 78%)`
    if (this._media) this._media.style.opacity = String(Math.min(1, Math.max(0.1, Number(this._set('orbMediaOpacity')) || 0.55)))
    this._applyMedia()
  }
  async _applyMedia () {
    const el = this._el; if (!el) return
    const kind = this._set('orbMediaKind'), name = this._set('orbMediaName'), sig = kind + '|' + name
    if (this._mediaSig === sig && this._media && !this._mediaDirty) return
    this._mediaSig = sig
    const drop = () => { this._media?.remove(); this._media = null; if (this._mediaUrl) { try { URL.revokeObjectURL(this._mediaUrl) } catch (_) {} this._mediaUrl = null } }
    drop(); if (kind !== 'image' && kind !== 'video') return
    let rec = null; try { rec = await loadMedia(this.hand) } catch (_) {}
    if (!rec || this._mediaSig !== sig || !this._el) return
    drop()   // a second load for the same picture may have finished first: never leave two layers
    let url; try { url = URL.createObjectURL(rec.blob) } catch (_) { return }
    this._mediaUrl = url
    const wrap = document.createElement('div'); wrap.className = 'oorb-media'
    const m = document.createElement(rec.kind === 'video' ? 'video' : 'img')
    if (rec.kind === 'video') { m.muted = true; m.loop = true; m.autoplay = true; m.playsInline = true; m.setAttribute('playsinline', ''); m.src = url; try { m.play?.()?.catch?.(() => {}) } catch (_) {} } else { m.src = url; m.alt = '' }
    wrap.appendChild(m); el.insertBefore(wrap, el.firstChild); this._media = wrap
    wrap.style.opacity = String(Math.min(1, Math.max(0.1, Number(this._set('orbMediaOpacity')) || 0.55)))
  }

  // ── dom ──
  _shell () { return document.getElementById('omni-ui') ?? document.body }
  _build () {
    const el = document.createElement('div'); el.className = 'omni-orb'; el.id = 'omni-orb-' + this.hand; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', FLASH[this.hand] + ' orb')
    el.innerHTML = `<canvas class="oorb-canvas" width="${SIZE * 2}" height="${SIZE * 2}"></canvas><button type="button" class="oorb-close" aria-label="Close the orb">×</button><div class="oorb-tip"></div><button type="button" class="oorb-summon" title="Put an orb in the scene that loops the selected words">✦ Summon</button>`
    this._shell().appendChild(el); this._el = el
    this._cv = el.querySelector('canvas'); this._g = this._cv.getContext('2d'); this._tipEl = el.querySelector('.oorb-tip')
    el.querySelector('.oorb-close').addEventListener('click', () => this.close())
    el.querySelector('.oorb-summon').addEventListener('click', () => this.summon())
    this._applyLook()
    const cv = this._cv
    cv.addEventListener('pointerdown', (e) => this._down(e)); cv.addEventListener('pointermove', (e) => this._move(e))
    cv.addEventListener('pointerup', (e) => this._up(e)); cv.addEventListener('pointercancel', () => { this._hold = null; this._charge = 0; this._drag = null; cv.classList.remove('is-drag') })
    cv.addEventListener('pointerleave', () => { this._hover = null; this._showTip() })
    cv.addEventListener('contextmenu', e => e.preventDefault())
  }
  /** Centre the orb on this hand's ⬢ tools menu (it sits behind it); fall back to the hand's corner. */
  _place () {
    if (!this._el) return
    const w = this._el.offsetWidth || SIZE, h = this._el.offsetHeight || SIZE
    let x, y
    if (this._pos) ({ x, y } = this._pos)
    else {
      const rad = document.getElementById('omni-radial-' + this.hand), r = rad?.getBoundingClientRect?.()
      if (r && r.width > 0) { x = r.left + r.width / 2 - w / 2; y = r.top + r.height / 2 - h / 2 }
      else { const top = this.hand === 'omnihand' || this.hand === 'conscious', left = this.hand === 'omnihand' || this.hand === 'lh'; x = left ? 20 : window.innerWidth - w - 20; y = top ? 120 : window.innerHeight - h - 80 }
    }
    x = Math.max(8, Math.min(window.innerWidth - w - 8, x)); y = Math.max(8, Math.min(window.innerHeight - h - 8, y))
    this._el.style.left = x + 'px'; this._el.style.top = y + 'px'
  }
  update () {}

  // ── content ──
  _pool () {
    const base = cleanWords(this._set('orbWords'), defaultPool(this.hand))
    if (this.hand !== 'omnihand') return base
    return [...new Set([...base, ...this._products.map(p => p.name)])]
  }
  _refreshProducts () { if (this.hand === 'omnihand') { try { this._products = resolveSites() } catch (_) { this._products = [] } } }
  _product (name) { return this._products.find(p => p.name === name) ?? null }
  _tools () {
    if (AMMO_HANDS.includes(this.hand)) return this._set('magazine') ?? []
    if (this.hand === 'omnihand') return this._products.filter(p => p.available).map(p => p.name)
    return CONSCIOUS_TOOLS
  }
  _ammo () { if (!AMMO_HANDS.includes(this.hand)) return null; const mag = this._tools(), cur = this._set('ammo'); return mag.includes(cur) ? cur : (mag[0] ?? null) }
  /** The words in view: the loop's current window, kept in step with the pool and the count setting. */
  _shown (now) {
    const pool = this._pool(), n = Math.max(4, Math.min(24, Number(this._set('orbShown')) || 12))
    this._loop = this._loop ? syncLoop(this._loop, pool, n) : createLoop(pool, n)
    for (const w of this._sel) if (!this._loop.shown.includes(w) && pool.includes(w)) { const free = this._loop.shown.findIndex(x => !this._sel.has(x)); if (free >= 0) this._loop.shown[free] = w }
    stepLoop(this._loop, now, 1400, Math.random, this._sel)
    return this._loop.shown
  }
  _sync () { this._showTip() }
  _feedback (d) {
    if (d.hand !== this.hand) return
    const tn = d.kind === 'fired' && d.tier && d.tier !== 'normal' ? (d.tier === 'full' ? ' Full charge: strongest, widest reach.' : ' Strong shot.') : ''
    this._msg = ({ fired: 'Fired.' + tn, released: 'Released.', 'no-target': 'No target: select a node first.', blocked: 'That node has its own behaviour.', empty: 'The magazine is empty.' }[d.kind] ?? '')
    this._msgT = 2.2; this._hover = null; this._showTip()
  }
  _wordTip (w) {
    const info = wordInfo(this.hand, w), p = this.hand === 'omnihand' ? this._product(w) : null
    if (info) return `${info.langName} for "${info.gloss}".`
    if (p) return p.available ? `${p.desc?.slice(0, 90) ?? ''} Click it to open.` : `Not available yet: ${p.reason}`
    if (this.hand === 'lh') return lhTip(w)
    return HANDS[this.hand].title.split(' · ')[1] ? `A potential of ${HANDS[this.hand].title.split(' · ')[1]}.` : 'A potential.'
  }
  _showTip () {
    if (!this._tipEl) return
    const h = this._hover
    if (h) { this._tipEl.innerHTML = ''; const b = document.createElement('b'); b.textContent = h.title; this._tipEl.append(b, document.createTextNode(' · ' + h.text)); return }
    const a = this._ammo(), sel = this._sel.size
    this._tipEl.textContent = this._msg || (sel ? `${sel} selected. ✦ Summon puts them in the scene.` : (AMMO_HANDS.includes(this.hand) ? (a ? `Loaded: ${a}. Hold the core to charge, release to fire.` : 'The magazine is empty. Load tools in ⟐OmniHands.') : 'Click words to choose them, then ✦ Summon. Hold the core to charge a bigger orb.'))
  }

  // ── pointer ──
  _pt (e) { const r = this._cv.getBoundingClientRect(); const k = SIZE / Math.max(1, r.width); return { x: (e.clientX - r.left) * k - SIZE / 2, y: (e.clientY - r.top) * k - SIZE / 2 } }
  _hit (p) {
    const R = SIZE * ORB_R
    if (Math.hypot(p.x, p.y) < R * CORE_HIT * 1.3) return { kind: 'core' }
    let best = null, bd = 1e9
    for (const h of this._hits) { const d = Math.hypot(p.x - h.x, p.y - h.y); if (d < h.r && d < bd) { bd = d; best = h } }
    return best
  }
  _rim (p) { return Math.hypot(p.x, p.y) > SIZE * ORB_R + 6 }
  _down (e) {
    e.preventDefault(); try { this._cv.setPointerCapture(e.pointerId) } catch (_) {}
    const pt = this._pt(e)
    if (this._rim(pt)) { const r = this._el.getBoundingClientRect(); this._drag = { dx: e.clientX - r.left, dy: e.clientY - r.top }; this._cv.classList.add('is-drag'); return }
    const h = this._hit(pt)
    if (h?.kind === 'core') { this._hold = { at: performance.now() }; this._charge = 0; this._msg = '' }
    else if (h?.kind === 'tool') this._toolClick(h.name)
    else if (h?.kind === 'word') { if (this._sel.has(h.word)) this._sel.delete(h.word); else if (this._sel.size < 12) this._sel.add(h.word); this._msg = ''; this._burst = 0.3; this._showTip() }
  }
  _toolClick (name) {
    if (AMMO_HANDS.includes(this.hand)) { setHandSetting(this.hand, 'ammo', name); this._msg = `Loaded ${name}.`; this._msgT = 2; this._burst = 0.5; this._showTip(); return }
    if (this.hand === 'omnihand') { const ok = this.openProduct(name); this._msg = ok ? `Opening ${name}.` : `${name} is not available.`; this._msgT = 2; this._burst = 0.5; this._showTip(); return }
    this._msg = `${name}: use it on the ConsciousHand pad.`; this._msgT = 2.5; this._showTip()
  }
  /** Open an OmniProduct from the orb with the same action OmniStarLight uses. */
  openProduct (name) {
    const s = this._product(name); if (!s || !s.available || !s.open) return false
    const o = s.open, ev = (n, d) => this._emit(n, d)
    if (o.type === 'nav') ev('omni:nav-select', { drawer: 'starlight', item: o.item, parent: o.parent ?? null, path: `starlight/${o.item}` })
    else if (o.type === 'sys') ev('omni:system-toggle', { system: o.system })
    else if (o.type === 'event') ev(o.name, o.detail)
    else return false
    ev('omni:orb-product-opened', { hand: this.hand, id: s.id, name: s.name }); return true
  }
  _move (e) {
    if (this._drag) { this._pos = { x: e.clientX - this._drag.dx, y: e.clientY - this._drag.dy }; this._place(); return }
    const pt = this._pt(e); this._cv.classList.toggle('is-rim', this._rim(pt))
    const h = this._hit(pt); let next = null
    if (h?.kind === 'word') next = { title: h.word, text: this._wordTip(h.word) + (this._sel.has(h.word) ? ' (selected)' : ' Click to select.') }
    else if (h?.kind === 'tool') next = { title: h.name, text: AMMO_HANDS.includes(this.hand) ? (h.name === this._ammo() ? 'Loaded. ' : '') + 'Click to load this tool as your ammo.' : this.hand === 'omnihand' ? 'Available now. Click to open.' : 'An option on the ConsciousHand pad.' }
    else if (h?.kind === 'core') next = { title: 'Core', text: AMMO_HANDS.includes(this.hand) ? 'Hold to charge, release to fire. Past the first mark (40%) the shot is stronger; at a full ring it is strongest and reaches wider.' : 'Hold to charge, release to summon an orb into the scene. A fuller charge makes a bigger orb.' }
    if ((next?.title ?? null) !== (this._hover?.title ?? null)) { this._hover = next; this._showTip() }
  }
  _up (e) {
    try { this._cv.releasePointerCapture(e.pointerId) } catch (_) {}
    if (this._drag) { this._drag = null; this._cv.classList.remove('is-drag'); return }
    if (!this._hold) return
    const charge = this._charge; this._hold = null; this._charge = 0
    this.fire(charge)
  }
  /** LH / RH: fire the loaded ammo, as the pad's Activation does. ConsciousHand / OmniHand: summon an orb into the scene (bigger when charged). */
  fire (charge = 0) {
    this._burst = 1 + charge
    if (AMMO_HANDS.includes(this.hand)) { const ammo = this._ammo(); this._emit('omni:hand-activate', { hand: this.hand, charge }); this._emit('omni:orb-fired', { hand: this.hand, charge, ammo }); return }
    this.summon({ scale: 1 + charge })
    this._emit('omni:orb-fired', { hand: this.hand, charge, ammo: null })
  }
  /** Put an OrbNode in the scene looping the selected words (or the ones in view). */
  summon (opt = {}) {
    const words = this._sel.size ? [...this._sel] : (this._loop?.shown ?? []).slice(0, 8)
    const d = { hand: this.hand, words, scale: opt.scale ?? 1, pos: opt.pos }
    this._emit('omni:orbnode-summon', d)
    this._msg = d.error ? d.error : (d.out ? `Summoned: ${words.length} word${words.length === 1 ? '' : 's'} orbit in the scene.` : 'The scene orbs are not running here.'); this._msgT = 3; this._burst = 1; this._hover = null; this._showTip()
    return d.out ?? null
  }

  // ── frame ──
  _runLoop () {
    cancelAnimationFrame(this._raf)
    const step = (now) => { if (!this._open) return; this.frame(now); this._raf = requestAnimationFrame(step) }
    this._raf = requestAnimationFrame(step)
  }
  frame (now = performance.now()) {
    const dt = this._last ? Math.min(0.1, (now - this._last) / 1000) : 0; this._last = now; this._now = now
    this._t += dt * (Number(this._set('orbSpeed')) || 1)
    if (this._hold) this._charge = chargeAt(now - this._hold.at, Number(this._set('orbChargeMs')) || 1200)
    this._burst = Math.max(0, this._burst - dt * 2.2)
    if (this._msgT > 0) { this._msgT -= dt; if (this._msgT <= 0) { this._msg = ''; this._showTip() } }
    this._draw()
  }
  _draw () {
    const g = this._g; if (!g) return
    const S = SIZE, R = S * ORB_R, c = this._charge, t = this._t, burst = this._burst, pal = this.pal, now = this._now
    const [rr, rg, rb] = hexRgb(pal.ring), [cr0, cg0, cb0] = hexRgb(pal.core), [tr, tg, tb] = hexRgb(pal.text)
    g.setTransform(2, 0, 0, 2, 0, 0); g.clearRect(0, 0, S, S); g.save(); g.translate(S / 2, S / 2)
    g.lineWidth = 0.6
    for (let r = 0; r < 3; r++) {
      g.save(); const k = [1.0, 0.86, 0.7][r], tl = [0.35, -0.5, 0.1][r]; g.rotate(tl); g.strokeStyle = `rgba(${rr},${rg},${rb},${0.16 + 0.14 * c})`; g.beginPath()
      g.ellipse(0, 0, R * k, R * [0.42, 0.36, 0.3][r], 0, 0, Math.PI * 2); g.stroke(); g.restore()
    }
    const shown = this._shown(now), words = wordPositions(shown, t, 1), tools = streamPositions(this._tools(), t, 1), ammo = this._ammo()
    this._hits = []
    const drawWord = (w) => {
      const px = w.x * R, py = w.y * R, p = this.hand === 'omnihand' ? this._product(w.word) : null, off = p && !p.available
      const slot = this._loop.shown.indexOf(w.word), f = slot >= 0 ? fadeIn(this._loop.born[slot], now) : 1, sel = this._sel.has(w.word)
      const depth = 0.35 + 0.65 * (w.z + 1) / 2, a = depth * f * (off ? 0.45 : 1)
      g.font = `${Math.round(10 + 3 * w.s)}px 'Courier New', 'Noto Sans', 'Noto Sans CJK SC', sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'
      if (pal.grey) { const gr = greyAt(w.z, c); g.fillStyle = `rgba(${gr},${gr},${gr},${a})` } else g.fillStyle = `rgba(${tr},${tg},${tb},${a})`
      if (sel) { g.shadowColor = pal.ring; g.shadowBlur = 8 }
      g.fillText(w.word, px, py); g.shadowBlur = 0
      if (sel) { const tw = g.measureText(w.word).width; g.strokeStyle = pal.ring; g.lineWidth = 1; g.beginPath(); g.moveTo(px - tw / 2, py + 8); g.lineTo(px + tw / 2, py + 8); g.stroke() }
      this._hits.push({ kind: 'word', word: w.word, x: px, y: py, r: Math.max(14, g.measureText(w.word).width / 2 + 4) })
    }
    words.filter(w => w.z < 0).forEach(drawWord)
    for (const s of tools) {
      const px = s.x * R, py = s.y * R, loaded = s.name === ammo
      g.fillStyle = `rgba(${cr0},${cg0},${cb0},${(loaded ? 0.9 : 0.55) * s.a})`; g.beginPath(); g.arc(px, py, (loaded ? 3.6 : 2.4) * (1.2 - s.p * 0.6), 0, Math.PI * 2); g.fill()
      if (loaded) { g.strokeStyle = `rgba(${cr0},${cg0},${cb0},${0.7 * s.a})`; g.lineWidth = 0.8; g.beginPath(); g.arc(px, py, 6, 0, Math.PI * 2); g.stroke() }
      if (s.a > 0.25) this._hits.push({ kind: 'tool', name: s.name, x: px, y: py, r: 11 })
    }
    const cr = R * CORE_HIT * (0.8 + 0.5 * c + 0.4 * burst) * (1 + 0.04 * Math.sin(t * 5))
    const grad = g.createRadialGradient(0, 0, 0, 0, 0, cr * 2.6)
    grad.addColorStop(0, `rgba(${cr0},${cg0},${cb0},1)`); grad.addColorStop(0.35, `rgba(${rr},${rg},${rb},${0.8 + 0.2 * c})`); grad.addColorStop(0.7, `rgba(${rr >> 1},${rg >> 1},${rb >> 1},0.35)`); grad.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = grad; g.beginPath(); g.arc(0, 0, cr * 2.6, 0, Math.PI * 2); g.fill()
    if (c > 0) { g.strokeStyle = `rgba(${cr0},${cg0},${cb0},0.9)`; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, cr * 1.5, -Math.PI / 2, -Math.PI / 2 + c * Math.PI * 2); g.stroke() }
    { const r2 = cr * 1.5, a = -Math.PI / 2 + STRONG_AT * Math.PI * 2; g.strokeStyle = c >= STRONG_AT ? `rgba(${cr0},${cg0},${cb0},1)` : `rgba(${cr0},${cg0},${cb0},0.45)`; g.lineWidth = 2; g.beginPath(); g.moveTo(Math.cos(a) * (r2 - 5), Math.sin(a) * (r2 - 5)); g.lineTo(Math.cos(a) * (r2 + 5), Math.sin(a) * (r2 + 5)); g.stroke()
      if (c >= FULL_AT) { g.strokeStyle = `rgba(${cr0},${cg0},${cb0},1)`; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, r2 + 5, 0, Math.PI * 2); g.stroke() } }
    if (burst > 0) { g.strokeStyle = `rgba(${cr0},${cg0},${cb0},${burst * 0.8})`; g.lineWidth = 1.5; g.beginPath(); g.arc(0, 0, R * (1.05 - burst * 0.9), 0, Math.PI * 2); g.stroke() }
    words.filter(w => w.z >= 0).forEach(drawWord)
    g.restore()
  }

  onResize () { if (this._open) this._place() }
  destroy () {
    cancelAnimationFrame(this._raf)
    for (const [tgt, t, fn] of this._bound) tgt.removeEventListener(t, fn); this._bound = []
    if (this._mediaUrl) { try { URL.revokeObjectURL(this._mediaUrl) } catch (_) {} }
    this._el?.remove(); this._el = null; this._media = null; this._open = false; this._inited = false
  }
}
