/**
 * systems/OmniAxioms.js — OmniAxioms (V217): the current AXIOM (chosen on the OmniHand) and PERSPECTIVE (chosen on the ConsciousHand).
 *
 *   axiom / perspective / mult        the current choice;  channel() = { axiom, perspective }  (what Dimensional Nodes compare against)
 *   setAxiom(id)  setPerspective(id)  setMult(v)  cycleAxiom(dir)  cyclePerspective(dir)
 *   timeScale()                       what the Time axiom is doing right now (1 when another axiom is chosen)
 * Each axiom remembers its own perspective and multiplier. Changing the axiom changes the perspective list; the perspective falls back to the one that axiom last used.
 * TIME really acts: its perspective sets utils/OmniTimeScale.js. Leave Time and motion returns to real time.
 * Events in:  omni:axiom-set { axiom?, perspective?, mult? }.   Events out: omni:axiom-changed { axiom, perspective, mult, timeScale }.
 * Registers Extra.SERVICES.axioms. Saved in localStorage 'omni:axioms:v1'.
 */
import { SERVICES } from '../utils/OmniExtraKinds.js'
import { AXIOMS, getAxiom, getPerspective } from '../data/OmniAxiomData.js'
import { setTimeScale } from '../utils/OmniTimeScale.js'

export const STORE_KEY = 'omni:axioms:v1'

export default class OmniAxioms {
  constructor (context) {
    this.ctx = context; this._bound = []; this._inited = false
    this.axiom = 'identity'
    this._per = {}   // axiomId -> { perspective, mult }
    for (const a of AXIOMS) this._per[a.id] = { perspective: a.perspectives[0].id, mult: a.perspectives.find(p => p.mult)?.mult?.value ?? 1 }
    this._mults = {} // perspectiveId -> mult (each multiplier perspective keeps its own)
  }
  init () {
    if (this._inited) return; this._inited = true
    try {
      const s = JSON.parse(localStorage.getItem(STORE_KEY))
      if (s && typeof s === 'object') {
        if (getAxiom(s.axiom)) this.axiom = s.axiom
        for (const a of AXIOMS) { const p = s.per?.[a.id]; if (p && getPerspective(a.id, p.perspective)) this._per[a.id].perspective = p.perspective }
        if (s.mults && typeof s.mults === 'object') for (const [k, v] of Object.entries(s.mults)) if (Number.isFinite(Number(v))) this._mults[k] = Number(v)
      }
    } catch (_) {}
    const on = (t, fn) => { const h = (e) => fn(e.detail ?? {}); window.addEventListener(t, h); this._bound.push([t, h]) }
    on('omni:axiom-set', (d) => { if (d.axiom) this.setAxiom(d.axiom); if (d.perspective) this.setPerspective(d.perspective); if (d.mult !== undefined) this.setMult(d.mult) })
    SERVICES.axioms = this
    this._apply(false)
  }
  destroy () {
    for (const [t, h] of this._bound) window.removeEventListener(t, h); this._bound = []
    setTimeScale(1, 0)
    if (SERVICES.axioms === this) SERVICES.axioms = null; this._inited = false
  }
  onResize () {}
  update () {}

  list () { return AXIOMS }
  get axiomDef () { return getAxiom(this.axiom) }
  get perspective () { return this._per[this.axiom].perspective }
  get perspectiveDef () { return getPerspective(this.axiom, this.perspective) }
  get mult () { const p = this.perspectiveDef; return p?.mult ? (this._mults[p.id] ?? p.mult.value) : 1 }
  channel () { return { axiom: this.axiom, perspective: this.perspective } }
  multFor (pid) { const p = this.axiomDef.perspectives.find(x => x.id === pid); return p?.mult ? (this._mults[pid] ?? p.mult.value) : null }

  /** what the Time axiom does right now: { scale, loop } */
  timeEffect () {
    if (this.axiom !== 'time') return { scale: 1, loop: 0 }
    const p = this.perspectiveDef, m = this.mult
    if (!p) return { scale: 1, loop: 0 }
    if (p.loop) return { scale: 1, loop: m }
    if (p.mult) return { scale: p.mult.kind === 'slowdown' ? 1 / m : m, loop: 0 }
    return { scale: p.timeScale ?? 1, loop: 0 }
  }
  timeScale () { return this.timeEffect().scale }

  setAxiom (id) { if (!getAxiom(id) || id === this.axiom) return false; this.axiom = id; this._apply(true); return true }
  setPerspective (pid) {
    if (!getPerspective(this.axiom, pid) || this._per[this.axiom].perspective === pid) return false
    this._per[this.axiom].perspective = pid; this._apply(true); return true
  }
  setMult (v) {
    const p = this.perspectiveDef; if (!p?.mult) return false
    const n = Number(v); if (!Number.isFinite(n)) return false
    const c = Math.min(p.mult.max, Math.max(p.mult.min, n))
    if (c === this.mult) return false
    this._mults[p.id] = c; this._apply(true); return true
  }
  cycleAxiom (dir = 1) { const i = AXIOMS.findIndex(a => a.id === this.axiom); return this.setAxiom(AXIOMS[(i + (dir < 0 ? -1 : 1) + AXIOMS.length) % AXIOMS.length].id) }
  cyclePerspective (dir = 1) {
    const L = this.axiomDef.perspectives, i = L.findIndex(p => p.id === this.perspective)
    return this.setPerspective(L[(i + (dir < 0 ? -1 : 1) + L.length) % L.length].id)
  }
  _apply (announce) {
    const te = this.timeEffect(); setTimeScale(te.scale, te.loop)
    try { localStorage.setItem(STORE_KEY, JSON.stringify({ axiom: this.axiom, per: this._per, mults: this._mults })) } catch (_) {}
    if (announce) try { window.dispatchEvent(new CustomEvent('omni:axiom-changed', { detail: { axiom: this.axiom, perspective: this.perspective, mult: this.mult, timeScale: te.scale, loop: te.loop } })) } catch (_) {}
  }
}
