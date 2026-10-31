/**
 * systems/OmniPainterSounds.js (V256) — plays the painter's sounds (utils/OmniPainterSound.js) with a small WebAudio synth.
 *   SERVICES.paintersound.play(event, brush)       Events in: omni:painter-sound { event, brush }   (OmniConstruction sends these)
 * The AudioContext is made on the first sound after a tap or key press (browsers insist). No AudioContext (Node, jsdom): it does nothing
 * but still counts what it would have played, so tests can see it (`played()`).
 */
import { SERVICES } from '../utils/OmniExtraKinds.js'
import { soundPlan, tick } from '../utils/OmniPainterSound.js'

export default class OmniPainterSounds {
  constructor (context, omniNode = null) { this.context = context; this._ctx = null; this._bound = []; this._rate = { last: -Infinity }; this._log = []; this._inited = false }
  init () {
    if (this._inited) return; this._inited = true
    const h = (e) => { const d = e.detail ?? {}; try { this.play(d.event, d.brush) } catch (_) { /* a sound never breaks painting */ } }
    window.addEventListener('omni:painter-sound', h); this._bound.push(['omni:painter-sound', h])
    SERVICES.paintersound = this
  }
  destroy () { for (const [n, h] of this._bound) window.removeEventListener(n, h); this._bound = []; try { this._ctx?.close?.() } catch (_) { /* gone */ } this._ctx = null; if (SERVICES.paintersound === this) SERVICES.paintersound = null; this._inited = false }
  update () {} onResize () {}
  played () { return this._log.slice() }
  _audio () {
    if (this._ctx) return this._ctx
    const C = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null; if (!C) return null
    try { this._ctx = new C() } catch (_) { this._ctx = null } return this._ctx
  }
  play (event, brush = {}) {
    const fast = event === 'spray' || event === 'surface'
    const now = (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000
    if (fast && !tick(this._rate, now, 0.07)) return false
    const plan = soundPlan(event, brush); if (!plan.notes.length) return false
    this._log.push(event); if (this._log.length > 200) this._log.shift()
    const ctx = this._audio(); if (!ctx) return true
    try {
      if (ctx.state === 'suspended') ctx.resume?.()
      const t0 = ctx.currentTime
      for (const n of plan.notes) {
        const o = ctx.createOscillator(); const g = ctx.createGain(); o.type = n.type; o.frequency.value = n.f
        g.gain.setValueAtTime(0.0001, t0 + n.at); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, n.gain), t0 + n.at + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t0 + n.at + n.dur)
        o.connect(g); g.connect(ctx.destination); o.start(t0 + n.at); o.stop(t0 + n.at + n.dur + 0.02)
      }
    } catch (_) { /* audio refused: stay quiet */ }
    return true
  }
}
