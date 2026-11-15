/**
 * systems/OmniLogicalExpression.js (V287) — plays the user's LogicalExpression: a precalculated burst of hyperlapses and teleport steps
 * (utils/OmniLogicalExpressionModel.js) that carries the camera through the reality and ends with the user placed in the scene, facing the way they were.
 *   The opening plays it after the fall (omni:user-landed). Any summoning tool (a node, an Omni command, OmniIDE, a finished structure) plays it as the success reward.
 *   SERVICES.logicalexpression: play(opts) isPlaying() skip() get() setSignature(patch) setPref(patch) derive() stats() reset()
 *     opts = { kind:'opening'|'success', title, stats:{...}, signature, from:[x,y,z], to:[x,y,z], reduced, card }  (card:false = no results card)
 *   Events in:  omni:logical-expression-play { ...opts }
 *   Events out: omni:logical-expression-cue { name, t, kind } (the sound system listens), omni:logical-expression-done { kind, skipped }
 *   Skip: press Space (a Skip button appears), then click it twice. The calm version is used with reduced motion (the system setting or the panel's Calm switch).
 */
import * as THREE from 'three'
import * as L from '../utils/OmniLogicalExpressionModel.js'
import { SERVICES } from '../utils/OmniExtraKinds.js'

export const STORE_KEY = 'omni:logicalexpression:v1'
const send = (n, d) => { try { window.dispatchEvent(new CustomEvent(n, { detail: d })) } catch (_) { /* no window */ } }
const STYLES = `
.ole-flash { position: fixed; inset: 0; z-index: 70; pointer-events: none; opacity: 0; mix-blend-mode: screen; }
.ole-skip { position: fixed; z-index: 72; left: 50%; bottom: 84px; transform: translateX(-50%); display: none; padding: 8px 18px; border-radius: 999px; border: 1px solid rgba(255,255,255,.7); background: rgba(10,10,14,.75); color: #fff; font: 13px system-ui, sans-serif; cursor: pointer; }
.ole-skip.is-on { display: block; }
.ole-card { position: fixed; z-index: 71; left: 50%; top: 50%; transform: translate(-50%, -50%); min-width: 260px; max-width: min(92vw, 420px); padding: 18px 22px; border-radius: 14px; background: rgba(255,255,255,.95); color: #111; border: 1px solid rgba(0,0,0,.2); box-shadow: 0 8px 40px rgba(0,0,0,.35); font: 14px system-ui, sans-serif; }
.ole-card h3 { margin: 0 0 8px; font-size: 16px; letter-spacing: .06em; text-transform: uppercase; } .ole-card dl { margin: 8px 0 12px; display: grid; grid-template-columns: 1fr auto; gap: 4px 16px; } .ole-card dd { margin: 0; font-weight: 700; text-align: right; }
.ole-card button { border: 1px solid rgba(0,0,0,.3); background: #111; color: #fff; border-radius: 8px; padding: 6px 16px; cursor: pointer; font: inherit; }
`
export default class OmniLogicalExpression {
  constructor (context, omniNode = null) { this.ctx = context; this.omniNode = omniNode ?? context?.omniNode ?? null; this._bound = []; this._run = null; this._prefs = { signature: { ...L.DEFAULT_SIGNATURE }, calm: false, onLanding: true }; this._inited = false }
  init () {
    if (this._inited) return; this._inited = true
    try { const s = JSON.parse(localStorage.getItem(STORE_KEY)); if (s && typeof s === 'object') this._prefs = { signature: L.sanitizeSignature(s.signature), calm: s.calm === true, onLanding: s.onLanding !== false } } catch (_) { /* first run */ }
    const on = (t, f, tgt = window) => { tgt.addEventListener(t, f); this._bound.push([t, f, tgt]) }
    on('omni:logical-expression-play', (e) => { const out = this.play(e.detail ?? {}); if (e.detail && typeof e.detail === 'object') e.detail.out = out })
    on('omni:user-landed', () => { this._landedAt = Date.now(); if (this._landingAllowed()) setTimeout(() => this.play({ kind: 'opening' }), 400) })
    on('keydown', (e) => { if (this._run && (e.code === 'Space')) { e.preventDefault(); this._skipBtn?.classList.add('is-on') } else if (this._card && e.key === 'Escape') this._closeCard() })
    SERVICES.logicalexpression = this
  }
  destroy () { this.skip(true); this._closeCard(); for (const [t, f, g] of this._bound) g.removeEventListener(t, f); this._bound = []; if (SERVICES.logicalexpression === this) SERVICES.logicalexpression = null; this._inited = false }
  onResize () {}
  _oc () { return SERVICES.orbit?.controls ?? this.ctx?.controls ?? null }
  _landingAllowed () { try { return this._prefs.onLanding && window.self === window.top && !/(^|[?&])gate=off(&|$)/.test(window.location.search) } catch (_) { return false } }

  // ── preferences ──
  get () { return { signature: { ...this._prefs.signature }, calm: this._prefs.calm, onLanding: this._prefs.onLanding, playing: this.isPlaying(), last: this._last ?? null, landedAt: this._landedAt ?? null } }
  _save () { try { localStorage.setItem(STORE_KEY, JSON.stringify(this._prefs)) } catch (_) { /* private */ } }
  setSignature (patch) { this._prefs.signature = L.sanitizeSignature({ ...this._prefs.signature, ...(patch && typeof patch === 'object' ? patch : {}) }); this._save(); return this.get() }
  setPref (patch) { const p = patch && typeof patch === 'object' ? patch : {}; if (typeof p.calm === 'boolean') this._prefs.calm = p.calm; if (typeof p.onLanding === 'boolean') this._prefs.onLanding = p.onLanding; this._save(); return this.get() }
  reset () { this._prefs = { signature: { ...L.DEFAULT_SIGNATURE }, calm: false, onLanding: true }; this._save(); return this.get() }
  /** what the user has built so far (read from the nodes) */
  stats () {
    const all = (() => { try { return this.omniNode?.getAllNodes?.() ?? [] } catch (_) { return [] } })(); const ax = {}
    for (const d of all) { const k = d?.nodeKind || d?.geometry || 'node'; ax[k] = (ax[k] || 0) + 1 }
    let edges = 0; try { edges = this.omniNode?.getAllEdges?.().length ?? 0 } catch (_) { /* none */ }
    return { nodes: all.length, edges, depth: 0, axioms: ax, perMinute: 0 }
  }
  /** a signature drawn from the work, mixed with the one they chose */
  derive () { this._prefs.signature = L.deriveSignature(this.stats(), this._prefs.signature); this._save(); return this.get() }

  // ── playing ──
  isPlaying () { return !!this._run }
  _reduced () { try { return this._prefs.calm || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true } catch (_) { return this._prefs.calm } }
  play (opts = {}) {
    const cam = this.ctx?.camera; if (!cam) return { ok: false, error: 'There is no camera.' }
    if (this._run) return { ok: false, error: 'It is already playing.' }
    const o = opts && typeof opts === 'object' ? opts : {}; const kind = L.KINDS.includes(o.kind) ? o.kind : 'success'
    const sig = L.sanitizeSignature({ ...this._prefs.signature, ...(o.signature && typeof o.signature === 'object' ? o.signature : {}) })
    const from = Array.isArray(o.from) ? o.from : cam.position.toArray(); const to = Array.isArray(o.to) ? o.to : from
    const plan = L.planExpression(sig, { kind, from, to, reduced: o.reduced ?? this._reduced() })
    this._ensureDom(); this._last = { kind, at: Date.now() }
    this._run = { plan, kind, t: 0, last: -1, at: performance.now(), q0: cam.quaternion.clone(), fov0: cam.fov, title: o.title, stats: o.stats, card: o.card !== false && (kind === 'success' || !!o.stats || !!o.title), skipping: 0 }
    const oc = this._oc(); this._run.ocWas = oc ? oc.enabled : false; this._run.target0 = oc ? oc.target.clone() : null; if (oc) oc.enabled = false   // the orbit controls would pull the camera back (and clamp its distance) every frame
    try { window.dispatchEvent(new Event('omni:orbit-disable')) } catch (_) { /* no window */ }
    this._flash.style.background = `hsl(${sig.hue}, 100%, 82%)`; this._skipBtn.textContent = 'Skip'; return { ok: true, duration: plan.duration, segments: plan.segments.length }
  }
  skip (silent = false) { if (this._run) this._finish(true, silent) }
  update () {
    const r = this._run; if (!r) return; const cam = this.ctx.camera
    const now = performance.now(); r.t += Math.min(0.25, (now - r.at) / 1000); r.at = now
    const s = L.sampleExpression(r.plan, r.t)
    for (const c of r.plan.cues) if (c.t > r.last && c.t <= r.t) send('omni:logical-expression-cue', { name: c.name, t: c.t, kind: r.kind })
    r.last = r.t
    cam.position.set(s.pos[0] + s.shake[0], s.pos[1] + s.shake[1], s.pos[2] + s.shake[2])
    const look = s.look; cam.lookAt(look[0], look[1], look[2])
    if (s.index === r.plan.segments.length - 1 && r.plan.segments.length) { const q1 = cam.quaternion.clone(); cam.quaternion.slerpQuaternions(q1, r.q0, Math.max(0, Math.min(1, s.progress))) }
    if (cam.fov !== undefined) { cam.fov = r.fov0 + s.fov; cam.updateProjectionMatrix() }
    this._flash.style.opacity = String(Math.min(0.55, s.flash * 0.55))
    if (s.done) this._finish(false)
  }
  _finish (skipped, silent = false) {
    const r = this._run; if (!r) return; this._run = null; const cam = this.ctx.camera
    cam.position.set(...r.plan.to); cam.quaternion.copy(r.q0); if (cam.fov !== undefined) { cam.fov = r.fov0; cam.updateProjectionMatrix() }
    const oc = this._oc(); if (oc?.target && r.target0) oc.target.copy(r.target0)   // the orbit pivot goes back exactly where it was
    if (oc && r.ocWas) { oc.enabled = true; oc.update?.() }
    this._flash.style.opacity = '0'; this._skipBtn.classList.remove('is-on'); try { window.dispatchEvent(new Event('omni:orbit-enable')) } catch (_) { /* no window */ }
    if (silent) return
    send('omni:logical-expression-done', { kind: r.kind, skipped })
    if (r.card) this._showCard(r)
  }

  // ── the screen bits ──
  _ensureDom () {
    if (this._flash) return
    if (!document.getElementById('ole-styles')) { const s = document.createElement('style'); s.id = 'ole-styles'; s.textContent = STYLES; document.head.appendChild(s) }
    this._flash = document.createElement('div'); this._flash.className = 'ole-flash'; document.body.appendChild(this._flash)
    const b = document.createElement('button'); b.className = 'ole-skip'; b.type = 'button'; b.setAttribute('aria-label', 'Skip the expression (click twice)'); b.textContent = 'Skip'; document.body.appendChild(b); this._skipBtn = b
    b.addEventListener('click', () => { const r = this._run; if (!r) return; const t = performance.now(); if (r.skipping && t - r.skipping < 2500) { this.skip() } else { r.skipping = t; b.textContent = 'Click again to skip' } })
  }
  _showCard (r) {
    this._closeCard(); const lines = L.resultLines(r.stats ?? this.stats()); const el = document.createElement('div'); el.className = 'ole-card'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Result')
    const esc = (t) => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
    el.innerHTML = `<h3>${esc(r.title || (r.kind === 'opening' ? 'Welcome' : 'Complete'))}</h3>${lines.length ? '<dl>' + lines.map(l => `<dt>${esc(l.label)}</dt><dd>${esc(l.value)}</dd>`).join('') + '</dl>' : ''}<button type="button" data-a="ok">Continue</button>`
    el.querySelector('[data-a=ok]').addEventListener('click', () => this._closeCard()); document.body.appendChild(el); this._card = el; el.querySelector('button').focus?.()
  }
  _closeCard () { this._card?.remove(); this._card = null }
}
