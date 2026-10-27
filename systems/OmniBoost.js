/**
 * systems/OmniBoost.js (V220) — the Boost button of the LH and RH pads.
 *
 * Hold Boost: the hand's speed is multiplied by `boostMult` (eased in over `boostRamp` seconds, held `boostSustain` seconds after release).
 * Layered effects, each its own switch in ⟐OmniHands (utils/OmniHandsSettings.js, lh and rh):
 *   boostVibration   an OmniVibration program run on you while boosting ('none' = off). Its envelope attack / release come from
 *                    boostVibAttack / boostVibRelease; it sustains until the boost ends (the boost's own sustain, not the program's hold).
 *   boostAfterimage  capsule ghosts left behind where you were (boostGhostMs apart, each fades in ~0.6 s) + a speed-streak screen trail
 *   boostGlitch      RGB-split bands and a small canvas shudder
 *   boostBlink       multiPointPosition: while you move under boost your view blinks between random points scattered around your
 *                    path (boostBlinkMs apart, within boostBlinkRadius). Real movement is unchanged, so you still reach point B; the
 *                    scatter vanishes the moment you stop or release.
 * Events in:  omni:boost-press { hand }, omni:boost-release { hand }          Events out: omni:boost-state { hand, active, level, factor }
 * Service:    Extra.SERVICES.boost = this    (press / release / isActive / level / factor)
 * Module contract: constructor(context) / init / update(delta) / destroy / onResize.
 */
import * as THREE from 'three'
import { SERVICES } from '../utils/OmniExtraKinds.js'
import { getHandSetting } from '../utils/OmniHandsSettings.js'
import { setBoostFactor, BOOST_HANDS } from '../utils/OmniBoostState.js'
import { CAPSULE } from './OmniAvatar.js'

const MAX_GHOSTS = 24
const GHOST_LIFE = 0.6

export default class OmniBoost {
  constructor (context) {
    this.ctx = context
    this._h = Object.fromEntries(BOOST_HANDS.map(h => [h, { held: false, sustain: 0, level: 0, vib: null, el: null, blinkT: 0, wasOn: false }]))
    this._ghosts = []; this._ghostT = 0; this._bound = []; this._inited = false
    this._prev = null; this._extra = new THREE.Vector3(); this._glitchT = 0; this._lastMoving = false
    this._geo = null; this._streak = null; this._glitch = null
  }

  // ── api ──
  press (hand) { const s = this._h[hand]; if (!s) return false; s.held = true; s.sustain = 0; return true }
  release (hand) { const s = this._h[hand]; if (!s || !s.held) return false; s.held = false; s.sustain = Math.max(0, Number(getHandSetting(hand, 'boostSustain')) || 0); return true }
  isActive (hand) { const s = this._h[hand]; return !!s && (s.held || s.sustain > 0 || s.level > 0.001) }
  level (hand) { return this._h[hand]?.level ?? 0 }
  factor (hand) { const s = this._h[hand]; return s ? 1 + ((Number(getHandSetting(hand, 'boostMult')) || 1) - 1) * s.level : 1 }
  get anyActive () { return BOOST_HANDS.some(h => this.isActive(h)) }

  init () {
    if (this._inited) return; this._inited = true
    const on = (t, fn) => { const h = (e) => fn(e.detail ?? {}); window.addEventListener(t, h); this._bound.push([t, h]) }
    on('omni:boost-press', d => this.press(d.hand)); on('omni:boost-release', d => this.release(d.hand))
    on('omni:orbit-disable', () => this._clearExtra())
    this._geo = new THREE.CapsuleGeometry(CAPSULE.radius, CAPSULE.length, 4, 12)
    this._buildOverlays(); BOOST_HANDS.forEach(h => this._buildButton(h))
    SERVICES.boost = this
  }

  // ── dom ──
  _shell () { return document.getElementById('omni-ui') ?? document.body }
  _buildButton (hand) {
    const el = document.createElement('button')
    el.type = 'button'; el.id = `omni-boost-${hand}`; el.className = 'omni-boost-btn'; el.textContent = 'BOOST'
    el.dataset.hand = hand; el.title = `${hand.toUpperCase()} Boost: hold to move faster (settings in ⟐OmniHands)`
    el.setAttribute('aria-label', `${hand.toUpperCase()} Boost, hold`)
    el.dataset.omniTip = `${hand.toUpperCase()} Boost`; el.dataset.omniTipKey = '—'; el.dataset.omniTipDesc = el.title
    Object.assign(el.style, { position: 'fixed', zIndex: '9000', pointerEvents: 'auto', display: 'none',   // #omni-ui is pointer-events:none; without this the button gets no hover or click (V224 fix)
      padding: '6px 9px', borderRadius: '14px', font: '700 10px system-ui,sans-serif', letterSpacing: '.08em',
      color: '#fff', background: 'rgba(20,20,24,.72)', border: '1px solid rgba(255,255,255,.45)', touchAction: 'none', userSelect: 'none', cursor: 'pointer' })
    const down = (e) => { e.preventDefault(); try { el.setPointerCapture(e.pointerId) } catch (_) {} this.press(hand) }
    const up = () => this.release(hand)
    el.addEventListener('pointerdown', down); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('lostpointercapture', up)
    el.addEventListener('contextmenu', e => e.preventDefault())
    this._shell().appendChild(el); this._h[hand].el = el
  }
  _buildOverlays () {
    const mk = (id, css) => { const d = document.createElement('div'); d.id = id; Object.assign(d.style, { position: 'fixed', inset: '0', pointerEvents: 'none', zIndex: '8000', opacity: '0', ...css }); this._shell().appendChild(d); return d }
    this._streak = mk('omni-boost-streak', { background: 'repeating-conic-gradient(from 0deg at 50% 50%, rgba(255,255,255,.55) 0deg 0.6deg, transparent 0.6deg 7deg)',
      WebkitMaskImage: 'radial-gradient(circle at 50% 50%, transparent 38%, #000 100%)', maskImage: 'radial-gradient(circle at 50% 50%, transparent 38%, #000 100%)', mixBlendMode: 'screen' })
    this._glitch = mk('omni-boost-glitch', { overflow: 'hidden' })
    for (let i = 0; i < 5; i++) { const b = document.createElement('div'); Object.assign(b.style, { position: 'absolute', left: '0', right: '0', height: '6%', background: i % 2 ? 'rgba(255,0,80,.22)' : 'rgba(0,220,255,.22)', mixBlendMode: 'screen' }); this._glitch.appendChild(b) }
  }
  _placeButtons () {
    for (const hand of BOOST_HANDS) {
      const el = this._h[hand].el; if (!el) continue
      const chip = document.getElementById(`omni-pad-chip-${hand}`)
      const cs = chip ? getComputedStyle(chip) : null   // the pad opens / closes through opacity + pointer-events (CSS rest state + gsap)
      const vis = !!cs && cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) > 0.1 && cs.pointerEvents !== 'none' && chip.getClientRects().length > 0
      if (!vis) { el.style.display = 'none'; continue }
      const r = chip.getBoundingClientRect(); el.style.display = 'block'
      const w = el.offsetWidth || 54
      el.style.top = Math.max(4, r.top - 30) + 'px'; el.style.left = Math.min(window.innerWidth - w - 4, Math.max(4, r.left + r.width / 2 - w / 2)) + 'px'
      el.style.background = this.isActive(hand) ? 'rgba(255,255,255,.88)' : 'rgba(20,20,24,.72)'; el.style.color = this.isActive(hand) ? '#111' : '#fff'
    }
  }

  // ── per frame ──
  update (dt = 0.016) {
    dt = Math.min(Math.max(dt, 0), 0.1)
    let top = 0, glitchOn = false, ghostOn = false, blinkOn = false, blinkMs = 90, blinkR = 3, ghostMs = 60
    for (const hand of BOOST_HANDS) {
      const s = this._h[hand]
      if (!s.held && s.sustain > 0) s.sustain = Math.max(0, s.sustain - dt)
      const want = (s.held || s.sustain > 0) ? 1 : 0
      const ramp = Math.max(0.02, Number(getHandSetting(hand, 'boostRamp')) || 0.25)
      const k = dt / ramp
      s.level = want > s.level ? Math.min(want, s.level + k) : Math.max(want, s.level - k)
      if (s.level < 0.001) s.level = 0
      const f = this.factor(hand); setBoostFactor(hand, f)
      const on = want === 1
      if (on !== s.wasOn) { s.wasOn = on; this._vib(hand, on); this._emit(hand) }
      top = Math.max(top, s.level)
      if (s.level > 0) {
        if (getHandSetting(hand, 'boostGlitch')) glitchOn = true
        if (getHandSetting(hand, 'boostAfterimage')) { ghostOn = true; ghostMs = Number(getHandSetting(hand, 'boostGhostMs')) || ghostMs }
        if (getHandSetting(hand, 'boostBlink')) { blinkOn = true; blinkMs = Number(getHandSetting(hand, 'boostBlinkMs')) || blinkMs; blinkR = Number(getHandSetting(hand, 'boostBlinkRadius')) || blinkR }
      }
    }
    const cam = this.ctx.camera
    // did the user move (not counting our own blink offset)?
    let moving = false
    if (cam) {
      const here = cam.position.clone().sub(this._extra)
      if (this._prev) moving = here.distanceToSquared(this._prev) > 1e-8
      this._prev = here
    }
    this._lastMoving = moving
    this._ghostsStep(dt, ghostOn && moving, ghostMs)
    this._blinkStep(dt, blinkOn && moving, blinkMs, blinkR)
    this._screen(dt, top, ghostOn, glitchOn)
    this._placeButtons()
  }

  _vib (hand, on) {
    const vib = SERVICES.vibration; const s = this._h[hand]
    if (on) {
      const prog = String(getHandSetting(hand, 'boostVibration') ?? 'shake')
      if (!vib || prog === 'none' || s.vib) return
      s.vib = vib.start('user', prog, { attack: getHandSetting(hand, 'boostVibAttack'), release: getHandSetting(hand, 'boostVibRelease'), hold: 0 })
    } else if (s.vib) { vib?.stop(s.vib); s.vib = null }
  }
  _emit (hand) { try { window.dispatchEvent(new CustomEvent('omni:boost-state', { detail: { hand, active: this.isActive(hand), level: this.level(hand), factor: this.factor(hand) } })) } catch (_) {} }

  _ghostsStep (dt, spawn, ms) {
    const scene = this.ctx.scene, cam = this.ctx.camera
    if (spawn && scene && cam) {
      this._ghostT += dt * 1000
      if (this._ghostT >= ms) {
        this._ghostT = 0
        if (this._ghosts.length >= MAX_GHOSTS) this._dropGhost(this._ghosts.shift())
        const m = new THREE.Mesh(this._geo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending }))
        m.position.copy(cam.position).sub(this._extra); m.position.y -= CAPSULE.length * 0.7; m.raycast = () => {}; m.name = 'omni-boost-ghost'
        scene.add(m); this._ghosts.push({ m, t: 0 })
      }
    }
    for (let i = this._ghosts.length - 1; i >= 0; i--) {
      const g = this._ghosts[i]; g.t += dt
      g.m.material.opacity = 0.45 * Math.max(0, 1 - g.t / GHOST_LIFE)
      if (g.t >= GHOST_LIFE) { this._dropGhost(g); this._ghosts.splice(i, 1) }
    }
  }
  _dropGhost (g) { g.m.parent?.remove(g.m); g.m.material.dispose() }

  _blinkStep (dt, on, ms, radius) {
    if (!on) { if (this._extra.lengthSq() > 0) this._setExtra(0, 0, 0); return }
    const s = this._blinkClock = (this._blinkClock ?? 0) + dt * 1000
    if (s < ms) return
    this._blinkClock = 0
    const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, rr = Math.sqrt(1 - u * u), d = radius * Math.cbrt(Math.random())
    this._setExtra(rr * Math.cos(a) * d, u * d * 0.5, rr * Math.sin(a) * d)
  }
  _setExtra (x, y, z) {
    const v = SERVICES.vibration; if (!v?.userExtra) { this._extra.set(0, 0, 0); return }
    this._extra.set(x, y, z); v.userExtra.set(x, y, z)
  }
  _clearExtra () { this._extra.set(0, 0, 0); const v = SERVICES.vibration; if (v?.userExtra) v.userExtra.set(0, 0, 0) }

  _screen (dt, level, streakOn, glitchOn) {
    if (this._streak) this._streak.style.opacity = streakOn ? String(Math.min(0.55, level * 0.55)) : '0'
    if (!this._glitch) return
    if (!glitchOn || level <= 0) { this._glitch.style.opacity = '0'; const c = this.ctx.renderer?.domElement; if (c && c.style.transform) c.style.transform = ''; return }
    this._glitchT += dt
    if (this._glitchT > 0.08) {
      this._glitchT = 0
      this._glitch.style.opacity = String(0.4 + 0.5 * Math.random() * level)
      for (const b of this._glitch.children) { b.style.top = (Math.random() * 94) + '%'; b.style.height = (2 + Math.random() * 9) + '%'; b.style.transform = `translateX(${(Math.random() * 2 - 1) * 24}px)` }
      const c = this.ctx.renderer?.domElement; if (c) c.style.transform = Math.random() < 0.35 ? `translate(${(Math.random() * 2 - 1) * 6 * level}px, 0)` : ''
    }
  }

  onResize () {}
  destroy () {
    for (const [t, h] of this._bound) window.removeEventListener(t, h); this._bound = []
    BOOST_HANDS.forEach(h => { const s = this._h[h]; if (s.vib) SERVICES.vibration?.stop(s.vib, { immediate: true }); s.el?.remove(); setBoostFactor(h, 1) })
    this._ghosts.forEach(g => this._dropGhost(g)); this._ghosts = []; this._clearExtra()
    this._streak?.remove(); this._glitch?.remove(); const c = this.ctx.renderer?.domElement; if (c) c.style.transform = ''
    this._geo?.dispose(); if (SERVICES.boost === this) SERVICES.boost = null; this._inited = false
  }
}
