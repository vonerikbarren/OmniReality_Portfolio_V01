/**
 * systems/OmniLineEffects.js (V268) — what lines can SHOW beyond their shape. Nothing here is saved; it is all overlay.
 *   Pulse    a small light travels along a line, flashes the node it reaches, and carries on along the next line of the path (up to 40 hops, 3 at a time).
 *   Caption  a line with a caption (style.label) shows it as a small chip at its middle when the camera is near (nearest 12 only).
 *   SERVICES.lines: pulse({ path: [ids] } | { from, to }) -> { ok, hops } · findPath(from, to) -> [ids] | null · captionsShown() · setCaptions(on) · captionsOn()
 *   Events in: omni:line-pulse-request { path | from, to }.   Model: utils/OmniLineModel.js.   Commands: Omni Line pulse|style|meaning|list|meanings
 */
import * as THREE from 'three'
import { SERVICES } from '../utils/OmniExtraKinds.js'

const MAX_HOPS = 40, MAX_PULSES = 3, SPEED = 16, MIN_SEG = 0.35, CAP_NEAR = 200, CAP_MAX = 12, SCAN_MS = 500
const STYLES = `.olf-cap { position: fixed; left: 0; top: 0; z-index: 9000; pointer-events: none; padding: 1px 6px; font: 10.5px system-ui, sans-serif; color: #eaf1ff; background: rgba(14,18,28,.82); border: 1px solid rgba(154,208,255,.45); border-radius: 8px; white-space: nowrap; transform: translate(-50%, -50%); }`
let glowTex = null
const glow = () => {
  if (glowTex) return glowTex
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const r = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.3, 'rgba(160,220,255,.7)'); r.addColorStop(1, 'rgba(160,220,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64)
  glowTex = new THREE.CanvasTexture(c); return glowTex
}
export default class OmniLineEffects {
  constructor (context, omniNode = null) { this.ctx = context; this.omniNode = omniNode ?? context?.omniNode ?? null; this._pulses = []; this._flashes = []; this._group = null; this._caps = new Map(); this._edges = []; this._scanAt = 0; this._on = true; this._bound = []; this._inited = false; this._tmp = new THREE.Vector3() }
  init () {
    if (this._inited) return; this._inited = true
    const on = (n, fn) => { const h = (e) => fn(e.detail ?? {}, e); window.addEventListener(n, h); this._bound.push([n, h]) }
    on('omni:line-pulse-request', (d) => { try { this.pulse(d) } catch (_) { /* nothing to pulse */ } })
    on('omni:scene-clear-request', () => { this._clearFx(); this._scanAt = 0 }); on('omni:edge-style-changed', () => { this._scanAt = 0 }); on('omni:node-deleted', () => { this._scanAt = 0 })
    SERVICES.lines = this
  }
  destroy () { this._clearFx(); for (const c of this._caps.values()) c.remove(); this._caps.clear(); for (const [n, h] of this._bound) window.removeEventListener(n, h); this._bound = []; if (SERVICES.lines === this) SERVICES.lines = null; this._inited = false }
  onResize () {}
  captionsOn () { return this._on }
  setCaptions (on) { this._on = !!on; if (!this._on) for (const c of this._caps.values()) c.style.display = 'none'; return this._on }
  captionsShown () { return [...this._caps.values()].filter(c => c.style.display !== 'none').length }

  // ── path ──
  findPath (from, to) {
    if (!from || !to) return null; if (from === to) return [from]
    const adj = new Map(); for (const e of this.omniNode?.getAllEdges?.() ?? []) { (adj.get(e.from) ?? adj.set(e.from, []).get(e.from)).push(e.to); (adj.get(e.to) ?? adj.set(e.to, []).get(e.to)).push(e.from) }
    const prev = new Map([[from, null]]); const q = [from]
    while (q.length) { const a = q.shift(); if (a === to) break; for (const b of adj.get(a) ?? []) if (!prev.has(b)) { prev.set(b, a); q.push(b) } }
    if (!prev.has(to)) return null
    const out = []; for (let n = to; n !== null; n = prev.get(n)) out.push(n); return out.reverse()
  }

  // ── pulse ──
  _ensureGroup () { if (!this._group && this.ctx?.scene) { this._group = new THREE.Group(); this._group.name = 'omni-line-fx'; this._group.userData.omniOverlay = true; this.ctx.scene.add(this._group) } return this._group }
  _clearFx () { for (const p of this._pulses) for (const s of p.sprites) { s.parent?.remove(s); s.material.dispose() } for (const f of this._flashes) { f.s.parent?.remove(f.s); f.s.material.dispose() } this._pulses = []; this._flashes = []; if (this._group) { this._group.parent?.remove(this._group); this._group = null } }
  _sprite (color, size, opacity) {
    const m = new THREE.SpriteMaterial({ map: glow(), color, transparent: true, opacity, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending })
    const s = new THREE.Sprite(m); s.scale.setScalar(size); s.renderOrder = 997; s.raycast = () => {}; return s
  }
  _posOf (id) { const m = this.omniNode?.getMeshById?.(id); return m ? m.getWorldPosition(new THREE.Vector3()) : null }
  pulse (d = {}) {
    let path = Array.isArray(d.path) ? d.path.map(String) : (d.from && d.to ? this.findPath(String(d.from), String(d.to)) : null)
    if (!path || path.length < 2) return { ok: false, hops: 0, error: 'No line path to pulse along.' }
    path = path.slice(0, MAX_HOPS + 1); const g = this._ensureGroup(); if (!g) return { ok: false, hops: 0, error: 'No scene.' }
    const edges = new Set((this.omniNode?.getAllEdges?.() ?? []).flatMap(e => [e.from + '>' + e.to, e.to + '>' + e.from]))
    for (let i = 0; i + 1 < path.length; i++) if (!edges.has(path[i] + '>' + path[i + 1])) return { ok: false, hops: 0, error: `No line between ${path[i]} and ${path[i + 1]}.` }
    while (this._pulses.length >= MAX_PULSES) { const o = this._pulses.shift(); for (const s of o.sprites) { s.parent?.remove(s); s.material.dispose() } }
    const sprites = [this._sprite(0xffffff, 1.0, 0.95), this._sprite(0x9ad0ff, 0.7, 0.55), this._sprite(0x9ad0ff, 0.45, 0.3)]; sprites.forEach(s => g.add(s))
    this._pulses.push({ path, hop: 0, t: 0, sprites, trail: [] }); return { ok: true, hops: path.length - 1 }
  }
  _flash (pos) { const g = this._ensureGroup(); if (!g) return; const s = this._sprite(0xffffff, 1, 0.9); s.position.copy(pos); g.add(s); this._flashes.push({ s, age: 0 }) }
  update (delta = 0.016) {
    const t = performance.now(); const dt = Math.min(0.25, Math.max(0, (t - (this._lastT ?? t)) / 1000)); this._lastT = t   // real time: the app's ticker smooths lag, which would slow a pulse on a slow frame
    for (const p of [...this._pulses]) {
      const a = this._posOf(p.path[p.hop]), b = this._posOf(p.path[p.hop + 1])
      if (!a || !b) { this._endPulse(p); continue }
      const dur = Math.max(MIN_SEG, a.distanceTo(b) / SPEED); p.t += dt / dur
      if (p.t >= 1) { this._flash(b); p.hop++; p.t = 0; if (p.hop >= p.path.length - 1) { this._endPulse(p); continue } }
      const pos = a.lerp(b, Math.min(1, p.t)); p.trail.unshift(pos.clone()); if (p.trail.length > 12) p.trail.pop()
      p.sprites[0].position.copy(pos); p.sprites[1].position.copy(p.trail[Math.min(4, p.trail.length - 1)]); p.sprites[2].position.copy(p.trail[Math.min(9, p.trail.length - 1)])
    }
    for (const f of [...this._flashes]) { f.age += dt; const k = f.age / 0.45; if (k >= 1) { f.s.parent?.remove(f.s); f.s.material.dispose(); this._flashes.splice(this._flashes.indexOf(f), 1); continue } f.s.scale.setScalar(1 + k * 3); f.s.material.opacity = 0.9 * (1 - k) }
    this._captions()
  }
  _endPulse (p) { for (const s of p.sprites) { s.parent?.remove(s); s.material.dispose() } const i = this._pulses.indexOf(p); if (i >= 0) this._pulses.splice(i, 1) }

  // ── captions ──
  _captions () {
    const cam = this.ctx?.camera; if (!cam || !this.omniNode) return
    const now = performance.now()
    if (now - this._scanAt > SCAN_MS) { this._scanAt = now; this._edges = (this.omniNode.getEdgesDetailed?.() ?? []).filter(e => e.style.label).map(e => ({ from: e.from, to: e.to, label: e.style.label })) }
    if (!this._on || !this._edges.length) { for (const c of this._caps.values()) c.style.display = 'none'; return }
    if (!document.getElementById('olf-style')) { const s = document.createElement('style'); s.id = 'olf-style'; s.textContent = STYLES; document.head.appendChild(s) }
    const items = []
    for (const e of this._edges) { const a = this._posOf(e.from), b = this._posOf(e.to); if (!a || !b) continue; const mid = a.add(b).multiplyScalar(0.5); const d = mid.distanceTo(cam.position); if (d <= CAP_NEAR) items.push({ e, mid, d }) }
    items.sort((x, y) => x.d - y.d); const shown = new Set()
    for (const it of items.slice(0, CAP_MAX)) {
      const key = it.e.from + '>' + it.e.to; let el = this._caps.get(key)
      if (!el) { el = document.createElement('div'); el.className = 'olf-cap'; el.setAttribute('role', 'note'); document.body.appendChild(el); this._caps.set(key, el) }
      if (el.textContent !== it.e.label) el.textContent = it.e.label
      this._tmp.copy(it.mid).project(cam)
      if (this._tmp.z > 1) { el.style.display = 'none'; continue }
      el.style.display = ''; el.style.left = Math.round((this._tmp.x * .5 + .5) * window.innerWidth) + 'px'; el.style.top = Math.round((-this._tmp.y * .5 + .5) * window.innerHeight) + 'px'; shown.add(key)
    }
    for (const [k, el] of [...this._caps]) if (!shown.has(k)) { if (!this._edges.some(e => e.from + '>' + e.to === k)) { el.remove(); this._caps.delete(k) } else el.style.display = 'none' }
  }
}
