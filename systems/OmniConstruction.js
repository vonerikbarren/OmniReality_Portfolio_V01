/**
 * systems/OmniConstruction.js (V232) — OmniConstruction, the painter: drag across the scene to spray small nodes into the Sandbox.
 *
 *   SERVICES.construction.arm(true|false)   turn the brush on / off (on: a drag sprays instead of turning the camera; Escape or the chip turns it off)
 *   .set({ shape, color, size, radius, density, spacing, jitterColor, mode, height, distance, rainbow })   .get()
 *   .sprayAt(pointer {x,y}) one step at a screen position      .undo() takes back the last stroke      .strokes()
 * Pieces are ordinary nodes in the Sandbox (so Sandbox hide / lock / remix / clear apply). The Sandbox cap (60) stops a stroke with a notice.
 * Settings saved in localStorage 'omni:construction:v1'. Pure maths: utils/OmniConstructionModel.js.
 */
import * as THREE from 'three'
import { SERVICES } from '../utils/OmniExtraKinds.js'
import { DEFAULTS, normalise, hitPoint, sprayStep, makeRng, SHAPES, hueColor } from '../utils/OmniConstructionModel.js'
import * as LAB from '../utils/OmniConstructionLabs.js'
import { MAX_NODES } from './OmniSandbox.js'

export const STORE_KEY = 'omni:construction:v1'
export const LABS_KEY = 'omni:construction-labs:v1'
export const PALETTE = Object.freeze(['#7fd6ff', '#ff7a59', '#ffe27a', '#5aa84a', '#c58bff', '#ff8fd0', '#ffffff', '#9a9a9a'])   // V256: RH Color steps through these
const send = (n, d) => window.dispatchEvent(new CustomEvent(n, { detail: d }))

export default class OmniConstruction {
  constructor (context, omniNode) {
    this.context = context; this.omniNode = omniNode ?? context?.omniNode ?? null
    this.s = { ...DEFAULTS }; this.labs = []; this.armed = false; this._strokes = []; this._cur = null; this._bound = []; this._chip = null; this._ray = new THREE.Raycaster(); this._seed = 1
  }
  init () {
    try { const v = JSON.parse(localStorage.getItem(STORE_KEY)); if (v && typeof v === 'object') this.s = normalise(v, this.s) } catch (_) {}
    try { this.labs = LAB.sanitizeLabs(JSON.parse(localStorage.getItem(LABS_KEY))) } catch (_) { this.labs = [] }
    SERVICES.construction = this
    // V256: the bound hand's ⟐1 tools steer the brush while the painter is on (RH: Color, Texture, Material, DataTypes). Press again (deselect) steps again.
    const handTool = (d) => { if (this.armed && this.s.hand !== 'none' && d.hand === this.s.hand && d.page === '⟐1') this._handTool(String(d.tool)) }
    const hs = (e) => handTool(e.detail ?? {}); window.addEventListener('omni:tool-select', hs); window.addEventListener('omni:tool-deselect', hs)
    this._bound.push(['omni:tool-select', hs, window], ['omni:tool-deselect', hs, window])
    const on = (name, fn, target = window, opt) => { const h = (e) => fn(e.detail ?? {}, e); target.addEventListener(name, h, opt); this._bound.push([name, h, target, opt]) }
    on('omni:construction-request', (d) => { try { if (d.action === 'toggle') this.arm(!this.armed); else if (d.action === 'undo') this.undo(); else if (d.action === 'paintmode') { const p = this.s.paint === 'spray' ? 'surface' : 'spray'; this.set({ paint: p }); send('omni:notify-info', { text: p === 'surface' ? 'Painter: colour onto surfaces' : 'Painter: spray pieces into the Sandbox' }) } else if (d.action === 'nextlab') { const all = this.listLabs(); const i = all.findIndex(l => JSON.stringify(LAB.labBrush(l, this.s)) === JSON.stringify(this.s)); const l = this.useLab(all[(i + 1) % all.length].id); send('omni:notify-info', { text: 'Painter lab: ' + l.name }) } else if (d.action === 'arm') this.arm(d.on !== false) } catch (e) { send('omni:notify-info', { text: 'OmniConstruction: ' + e.message }) } })
    on('keydown', (_d, e) => { if (e.key === 'Escape' && this.armed) this.arm(false) }, document)
    const canvas = this.context?.renderer?.domElement
    if (canvas) {
      // window capture runs before the camera controls on the canvas see the pointer: while armed, a drag is a spray, not an orbit
      const down = (e) => { if (!this.armed || e.target !== canvas || (e.pointerType === 'mouse' && e.button !== 0)) return; e.stopPropagation(); e.stopImmediatePropagation?.(); e.preventDefault?.(); this._begin(e) }
      const move = (e) => { if (!this._cur) return; e.stopPropagation(); e.stopImmediatePropagation?.(); this._stepAt(e.clientX, e.clientY) }
      const up = () => this._end()
      window.addEventListener('pointerdown', down, true); window.addEventListener('pointermove', move, true)
      window.addEventListener('pointerup', up, true); window.addEventListener('pointercancel', up, true)
      this._bound.push(['pointerdown', down, window, true], ['pointermove', move, window, true], ['pointerup', up, window, true], ['pointercancel', up, window, true])
    }
  }
  update () {} onResize () {}
  destroy () { for (const [n, h, t, o] of this._bound) t.removeEventListener(n, h, o); this._bound = []; this._chip?.remove(); this._chip = null; if (SERVICES.construction === this) SERVICES.construction = null }

  get () { return { ...this.s } }
  set (patch) { this.s = normalise(patch, this.s); try { localStorage.setItem(STORE_KEY, JSON.stringify(this.s)) } catch (_) {} send('omni:construction-state', { armed: this.armed, settings: this.get() }); return this.get() }
  strokes () { return this._strokes.length }
  _snd (event) { if (this.s.sound) send('omni:painter-sound', { event, brush: this.get() }) }
  /** V256: what the bound hand's tools do to the brush. Returns a short sentence (also shown as a note). */
  _handTool (tool) {
    let msg = ''
    if (tool === 'Color') { const i = PALETTE.indexOf(this.s.color); const c = PALETTE[(i + 1) % PALETTE.length]; this.set({ color: c, rainbow: false }); msg = 'Brush colour ' + c }
    else if (tool === 'Texture') {
      if (this.s.paint === 'surface') { const v = this.s.soft >= 1 ? 0 : this.s.soft >= 0.5 ? 1 : 0.5; this.set({ soft: v }); msg = 'Brush edge ' + (v === 0 ? 'hard' : v === 1 ? 'airbrush soft' : 'soft') } else { const i = SHAPES.indexOf(this.s.shape); const sh = SHAPES[(i + 1) % SHAPES.length]; this.set({ shape: sh }); msg = 'Brush shape ' + sh.replace('Geometry', '').toLowerCase() }
    } else if (tool === 'Material') { const p = this.s.paint === 'spray' ? 'surface' : 'spray'; this.set({ paint: p }); msg = p === 'surface' ? 'Painting onto surfaces' : 'Spraying pieces into the Sandbox' }
    else if (tool === 'DataTypes') { const m = this.s.mode === 'ground' ? 'air' : 'ground'; this.set({ mode: m }); msg = 'Spray in the ' + m }
    else return ''
    this._snd('hand'); send('omni:notify-info', { text: 'OmniConstruction (RH ' + tool + '): ' + msg }); return msg
  }
  // ── labs (V256): named brush setups ──
  listLabs () { return LAB.allLabs(this.labs) }
  useLab (key) { const l = LAB.findLab(this.labs, key); if (!l) throw new Error('no lab "' + key + '" (Omni Construction lab list)'); this.set(LAB.labBrush(l, this.s)); this._snd('lab'); return l }
  saveLab (name) {
    const l = LAB.labFromBrush(name, this.s); if (!l) throw new Error('a lab needs a name (letters and numbers)')
    let id = l.id; if (LAB.BUILTIN_LABS.some(b => b.id === id)) { id = LAB.slug(l.name + ' copy'); l.id = id; l.name = l.name + ' copy' }
    const rest = this.labs.filter(x => x.id !== id); if (rest.length >= LAB.MAX_LABS) throw new Error('you have ' + LAB.MAX_LABS + ' labs; delete one first')
    this.labs = [...rest, l]; this._saveLabs(); return l
  }
  deleteLab (key) {
    const l = LAB.findLab(this.labs, key); if (!l) throw new Error('no lab "' + key + '"'); if (l.builtin) throw new Error('"' + l.name + '" is built in and can not be deleted')
    this.labs = this.labs.filter(x => x.id !== l.id); this._saveLabs(); return l
  }
  _saveLabs () { try { localStorage.setItem(LABS_KEY, JSON.stringify(this.labs)) } catch (_) { /* full */ } send('omni:construction-labs', { labs: this.listLabs().map(l => l.id) }) }
  arm (v) {
    this.armed = !!v
    if (!this.armed) this._end()
    this._syncChip(); this._snd(this.armed ? 'arm' : 'disarm')
    send('omni:construction-state', { armed: this.armed, settings: this.get() })
    send('omni:notify-info', { text: this.armed ? 'OmniConstruction ON: drag to spray ' + this.s.shape.replace('Geometry', '').toLowerCase() + 's into the Sandbox. Esc or the chip turns it off.' : 'OmniConstruction off' })
    return this.armed
  }
  _syncChip () {
    if (!this.armed) { this._chip?.remove(); this._chip = null; return }
    if (this._chip) return
    const c = document.createElement('div'); c.className = 'omc-chip'
    c.style.cssText = 'position:fixed;left:50%;bottom:84px;transform:translateX(-50%);z-index:3000;pointer-events:auto;display:flex;gap:6px;align-items:center;padding:6px 10px;border:1px solid #7fd6ff;border-radius:16px;background:rgba(10,20,30,.85);color:#cfefff;font:12px system-ui;touch-action:manipulation'
    const mk = (t, fn) => { const b = document.createElement('button'); b.textContent = t; b.style.cssText = 'background:none;border:1px solid #7fd6ff55;color:inherit;border-radius:10px;padding:3px 8px;font:inherit;cursor:pointer'; b.addEventListener('click', fn); return b }
    const lab = document.createElement('span'); lab.textContent = '🖌 Painting'
    c.append(lab, mk('Undo', () => this.undo()), mk('Off', () => this.arm(false))); document.body.appendChild(c); this._chip = c
  }
  _rayFrom (x, y) {
    const cam = this.context?.camera, el = this.context?.renderer?.domElement; if (!cam || !el) return null
    const r = el.getBoundingClientRect(); this._ray.setFromCamera(new THREE.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1), cam)
    const { origin: o, direction: d } = this._ray.ray; return { o: [o.x, o.y, o.z], d: [d.x, d.y, d.z] }
  }
  _begin (e) {
    const sbx = SERVICES.sandbox; if (!sbx) { send('omni:notify-info', { text: 'OmniConstruction needs the Sandbox, which is not running' }); return }
    if (this.s.paint === 'surface') {
      const op = SERVICES.objectpaint; if (!op) { send('omni:notify-info', { text: 'Surface painting needs OmniObjectPainter, which is not running' }); return }
      op.begin(); this._cur = { surface: true, ids: [], hits: 0 }
      try { e.target.setPointerCapture?.(e.pointerId) } catch (_) {}
      this._stepAt(e.clientX, e.clientY); return
    }
    this._cur = { ids: [], state: { last: null, count: 0 }, rng: makeRng('paint' + (this._seed++) + Date.now()) }
    try { e.target.setPointerCapture?.(e.pointerId) } catch (_) {}
    this._stepAt(e.clientX, e.clientY)
  }
  /** One spray step at a screen position. Returns how many pieces were made. */
  _stepAt (x, y) {
    const cur = this._cur; if (cur?.surface) {   // V256: paint onto the surface under the pointer
      const hit = SERVICES.objectpaint?.dab({ x, y }, this.s.rainbow ? hueColor((cur.hits * 7) % 360) : this.s.color, this.s.dab, this.s.soft)
      if (hit) { cur.hits++; this._snd('surface') } return hit ? 1 : 0
    }
    const sbx = SERVICES.sandbox, on = this.omniNode; if (!cur || !sbx || !on) return 0
    const r = this._rayFrom(x, y); if (!r) return 0
    const room = MAX_NODES - sbx.ids().length
    if (room <= 0) { if (!cur.full) { cur.full = true; this._snd('full'); send('omni:notify-info', { text: `The Sandbox is full (${MAX_NODES}). Undo a stroke or Omni Sandbox clear confirm.` }) } return 0 }
    const pieces = sprayStep(hitPoint(r.o, r.d, this.s), this.s, cur.state, cur.rng, room); let made = 0
    for (const p of pieces) {
      const id = 'pnt_' + Math.random().toString(36).slice(2, 8)
      send('omni:node-create-request', { id, label: 'Paint ' + (sbx.ids().length + 1), geometry: p.geometry, primitive: 'objective', color: p.color, position: p.position, scale: p.scale, rotation: [0, 0, 0], noParent: true, noSelect: true })
      if (!on.getMeshById?.(id)) continue
      try { sbx.add(id) } catch (_) { send('omni:node-delete-request', { id }); continue }
      cur.ids.push(id); made++
    }
    if (made) this._snd('spray')
    return made
  }
  /** Spray one step at a screen point without a drag (for commands and tests). */
  sprayAt (pt) { if (!this._cur) { this._begin({ clientX: pt.x, clientY: pt.y, target: {}, pointerId: 0 }); return this._cur ? (this._cur.surface ? this._cur.hits : this._cur.ids.length) : 0 } return this._stepAt(pt.x, pt.y) }
  _end () {
    const c = this._cur; this._cur = null
    if (c?.surface) { if (SERVICES.objectpaint?.end() > 0) { this._strokes.push({ surface: true }); if (this._strokes.length > 50) this._strokes.shift(); this._snd('stroke') } return }
    if (c?.ids.length) { this._strokes.push(c.ids); if (this._strokes.length > 50) this._strokes.shift(); this._snd('stroke') }
  }
  undo () {
    this._end(); const ids = this._strokes.pop(); if (!ids) throw new Error('nothing to undo')
    if (!Array.isArray(ids)) { const n = SERVICES.objectpaint?.undo() ?? 0; this._snd('undo'); send('omni:notify-info', { text: 'OmniConstruction: took back a surface stroke' }); return n }
    this._snd('undo')
    for (const id of ids) send('omni:node-delete-request', { id })
    for (const id of ids) { try { SERVICES.spaces?.unassign(id, true) } catch (_) {} }
    send('omni:notify-info', { text: `OmniConstruction: took back ${ids.length} piece(s)` }); return ids.length
  }
}
