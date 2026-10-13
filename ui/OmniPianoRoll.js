/**
 * ui/OmniPianoRoll.js — the PIANO ROLL of ONE track of a MusicNode (V198). One 2D canvas (no WebGL) plus a small DOM toolbar; the math is utils/OmniPianoRollMath.js (pure,
 * unit tested), the note conversions are utils/OmniMusicModel.js (eventsToNotes / notesToEvents). Embedded by ui/OmniSequencerView.js (per track 'Grid | Roll').
 *
 *   keyboard strip   left: white / black rows, the Cs are labelled; press a key to hear it (SoundEngine.playNote through the track's instrument = sequencer.preview), slide for a glissando
 *   grid             pitch rows x step columns (bar / beat / step lines, half-step lines when zoomed), scale highlight (key + scale) and optional snap-to-scale
 *   notes            ✎ Draw: click an empty cell = a note (drag sideways = its length; with Paint on, drag = a run of notes) · drag a note = move (steps + pitch) ·
 *                    drag its right (or left) edge = resize · ▭ Select: rubber band, Shift+click adds · ⌫ Erase: click / drag deletes · ✋ Pan · right click or LONG PRESS
 *                    (touch) on a note deletes it · two fingers pan and pinch-zoom, the wheel scrolls (Shift = sideways), Ctrl/Cmd + wheel = zoom (a trackpad pinch too)
 *   velocity lane    under the grid: one bar per note, drag a bar (or sweep across several) to set the velocity; a selected group follows the dragged bar
 *   keys             Delete · arrows (move by the snap / transpose; Shift = bar / octave) · Ctrl/Cmd+A all · +C copy · +V paste · +D duplicate after the selection · +Z / +Y undo / redo · Esc
 *   playhead         a DOM line moved from the sequencer position (<= 30 fps, only while the transport runs); optionally scrolls to follow
 *
 * Data: ONLY through the store of systems/OmniMusicNodes.js (opts.svc or Extra.SERVICES.music): replaceEvents (all the events of the track, sanitized by the commit), beginStroke /
 * endStroke (a drag = ONE undo step, taken lazily at the first real change), undo / redo (the same stack as the grid's buttons). Stored notes are never mutated. The canvas is redrawn
 * only when something changed (data, view, selection, theme, size) and at most once per frame. Same-pitch overlaps follow the "trim" policy of OmniMusicModel.notesToEvents.
 *
 * Module contract: init() (= mount), update(delta) (playhead), destroy(), onResize(). User-facing: imports no system and no Dev module.
 */

import * as MM from '../utils/OmniMusicModel.js'
import * as PR from '../utils/OmniPianoRollMath.js'
import { SERVICES } from '../utils/OmniExtraKinds.js'
import { esc, tip } from './OmniSoundFields.js'

const RULER_H = 16
const LONG_PRESS_MS = 450
const HEAD_FPS = 30
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v)
const r3 = (v) => Math.round(v * 1000) / 1000
let CLIP = null   // { notes: [{start,length,midi,velocity,prob}], span } shared by every roll

export const STYLES = `
.opr { font-size: 11px; outline: none; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
.opr .opr-bar { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; margin: 2px 0 4px; }
.opr .opr-b, .opr .opr-s { min-height: 28px; box-sizing: border-box; padding: 2px 8px; font: inherit; color: inherit; border-radius: 6px; background: rgba(255,255,255,.07); border: 1px solid var(--omni-theme-border, rgba(255,255,255,.2)); }
.opr .opr-b { cursor: pointer; min-width: 28px; } .opr .opr-b:hover:not(:disabled) { background: rgba(255,255,255,.17); } .opr .opr-b:disabled { opacity: .4; cursor: default; }
.opr .opr-b.is-on { background: rgba(255,184,107,.32); border-color: rgba(255,184,107,.85); }
.opr .opr-s option { color: #111; background: #fff; }
.opr .opr-sep { width: 1px; align-self: stretch; background: rgba(255,255,255,.18); margin: 0 2px; }
.opr .opr-stage { position: relative; border-radius: 6px; overflow: hidden; background: rgba(0,0,0,.3); touch-action: none; }
.opr .opr-cv { display: block; width: 100%; height: 100%; touch-action: none; outline: none; cursor: crosshair; }
.opr .opr-cv:focus-visible { box-shadow: inset 0 0 0 2px rgba(255,184,107,.9); }
.opr .opr-head { position: absolute; top: 0; bottom: 0; left: 0; width: 2px; background: #ffb86b; box-shadow: 0 0 6px #ffb86b; pointer-events: none; display: none; will-change: transform; }
.opr .opr-info { min-height: 14px; margin-top: 3px; opacity: .85; font-size: 10px; }
@media (max-width: 700px) { .opr .opr-b, .opr .opr-s { min-height: 40px; min-width: 40px; } }
`
let styled = false
export function injectPianoRollStyles () {
  if (typeof document === 'undefined') return
  if (styled && document.getElementById('opr-styles')) return
  styled = true
  const s = document.createElement('style'); s.id = 'opr-styles'; s.textContent = STYLES; document.head.appendChild(s)
}

const TOOLS = [
  ['draw', '✎', 'Draw', 'Click an empty cell to add a note, drag sideways to set its length. Drag a note to move it, drag its edge to resize it.'],
  ['select', '▭', 'Select', 'Drag a rectangle to select notes (Shift adds). Drag a selected note to move the whole group.'],
  ['erase', '⌫', 'Erase', 'Click or drag over notes to delete them. (Right click or a long press on a note deletes it in every tool.)'],
  ['pan', '✋', 'Pan', 'Drag to scroll the roll (useful on a phone; two fingers scroll and zoom in every tool).'],
]
const SNAPS = [['step', 'Snap: step'], ['half', 'Snap: ½ step'], ['bar', 'Snap: bar'], ['off', 'Snap: off']]

export default class OmniPianoRoll {
  /**
   * @param host element to fill. @param opts { nodeId, trackId, svc?, seq?, color?, prefs? (a plain object, read and updated), onPrefs?(prefs), preview?(midi), say?(text, err), height?, phone?, autoLoop? }
   */
  constructor (host, opts = {}) {
    this.host = host
    this.opts = opts
    this._nodeId = opts.nodeId ?? null
    this._trackId = opts.trackId ?? null
    this.prefs = Object.assign({ snap: 'step', key: 0, scale: 'chromatic', snapScale: false, tool: 'draw', paint: false, follow: true, zx: 0, zy: 0 }, opts.prefs || {})
    this._notes = []
    this._sel = new Set()
    this._idc = 1
    this._v = PR.makeView({})
    this._dirty = true
    this._rq = 0
    this._W = 0; this._H = 0; this._dpr = 1
    this._ptrs = new Map()
    this._g = null
    this._band = null
    this._pal = null
    this._bound = []
    this._dead = false
    this._built = false
    this._acc = 0
    this._lastHeadX = NaN
    this._keyDown = -1
    this._cursor = null
    this._stroke = false
    this._centered = false
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  init () { return this.mount() }

  mount () {
    if (this._built) return this
    this._built = true
    injectPianoRollStyles()
    const h = this.host
    h.__oprRoll = this   // handle for tests / the console
    h.classList.add('opr'); h.tabIndex = h.tabIndex >= 0 ? h.tabIndex : 0
    h.innerHTML = this._barHTML() + '<div class="opr-stage" data-ref="stage"><canvas class="opr-cv" data-ref="cv" role="application" aria-label="Piano roll"></canvas><div class="opr-head" data-ref="head"></div></div><div class="opr-info" data-ref="info" role="status" aria-live="polite"></div>'
    this.cv = h.querySelector('[data-ref="cv"]'); this.stage = h.querySelector('[data-ref="stage"]'); this.head = h.querySelector('[data-ref="head"]'); this.info = h.querySelector('[data-ref="info"]')
    this._onClick = (e) => this._click(e); this._onChange = (e) => this._change(e); this._onKey = (e) => this._key(e)
    h.addEventListener('click', this._onClick); h.addEventListener('change', this._onChange); h.addEventListener('keydown', this._onKey)
    const cv = this.cv
    cv.addEventListener('pointerdown', (e) => this._down(e)); cv.addEventListener('pointermove', (e) => this._move(e))
    cv.addEventListener('pointerup', (e) => this._up(e)); cv.addEventListener('pointercancel', (e) => this._up(e, true))
    cv.addEventListener('contextmenu', (e) => e.preventDefault())
    cv.addEventListener('wheel', (e) => this._wheel(e), { passive: false })
    const on = (name, fn) => { const f = (e) => fn(e.detail ?? {}); window.addEventListener(name, f); this._bound.push([name, f]) }
    on('omni:music-data-changed', (d) => { if (d.nodeId === this._nodeId) this._syncFromStore() })
    on('omni:theme-changed', () => { this._pal = null; this.invalidate() })
    on('omni:music-transport', () => { this._lastHeadX = NaN; this._syncButtons() })
    try { if (typeof ResizeObserver === 'function') { this._ro = new ResizeObserver(() => this.onResize()); this._ro.observe(this.stage) } } catch (_) { this._ro = null }
    this._size()
    this._syncFromStore()
    this._syncButtons()
    if (this.opts.autoLoop && typeof requestAnimationFrame === 'function') { let last = performance.now(); const loop = (t) => { if (this._dead) return; this.update((t - last) / 1000); last = t; this._raf = requestAnimationFrame(loop) }; this._raf = requestAnimationFrame(loop) }
    return this
  }

  destroy () {
    this._dead = true
    this._bound.forEach(([n, f]) => window.removeEventListener(n, f)); this._bound = []
    try { this._ro?.disconnect() } catch (_) { /* ignore */ }
    if (this._raf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(this._raf)
    if (this._rq && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(this._rq)
    this._rq = 0
    clearTimeout(this._g?.timer); this._g = null
    this._endStroke()
    if (this._built && this.host) { this.host.removeEventListener('click', this._onClick); this.host.removeEventListener('change', this._onChange); this.host.removeEventListener('keydown', this._onKey); this.host.innerHTML = ''; this.host.classList.remove('opr'); delete this.host.__oprRoll }
    this._built = false
  }

  onResize () { if (this._dead || !this._built) return; this._size(); this.invalidate() }

  /** Point the roll at another node / track. */
  setTarget (nodeId, trackId) {
    if (nodeId === this._nodeId && trackId === this._trackId) return
    this._nodeId = nodeId; this._trackId = trackId; this._sel.clear(); this._notes = []; this._centered = false
    if (this._built) { this._syncFromStore(); this._syncButtons() }
  }
  get nodeId () { return this._nodeId }
  get trackId () { return this._trackId }
  get notes () { return this._notes }
  get selection () { return this._notes.filter(n => this._sel.has(n.id)) }
  get view () { return this._v }

  // ── Store access ────────────────────────────────────────────────────────────

  _svc () { return this.opts.svc ?? SERVICES.music }
  _seq () { return this.opts.seq ?? SERVICES.sequencer }
  _music () { try { return this._nodeId ? this._svc()?.getMusic(this._nodeId) ?? null : null } catch (_) { return null } }
  _track () { const m = this._music(); return m ? MM.findTrack(m, this._trackId) : null }
  _say (t, err = false) { if (this.opts.say) { try { this.opts.say(t, err) } catch (_) { /* ignore */ } if (this.info) this.info.textContent = ''; return } if (this.info) this.info.textContent = t }
  _savePrefs () { try { this.opts.onPrefs?.({ ...this.prefs }) } catch (_) { /* ignore */ } }

  _key1 (n) { return Math.round(n.start * 1000) + ':' + n.midi }

  /** Re-read the track: ids are kept for notes at the same place (so a selection survives our own edits and undo), new notes get new ids. */
  _syncFromStore () {
    if (this._dead) return
    const m = this._music(); const t = this._track()
    if (!m || !t) { this._notes = []; this._sel.clear(); this.invalidate(); return }
    const idByKey = new Map(this._notes.map(n => [this._key1(n), n.id]))
    const stored = MM.eventsToNotes(t)
    const sel = new Set()
    this._notes = stored.map(n => {
      const id = idByKey.get(this._key1(n)) ?? this._idc++
      if (this._sel.has(id)) sel.add(id)
      return { ...n, id }
    })
    this._sel = sel
    const total = MM.patternLengthSteps(m)
    this._v.total = total; this._v.spb = MM.stepsPerBar(m); this._v.beat = Math.max(1, Math.round(1 / MM.stepBeats(m)))
    if (!this._centered && this._L) this._firstLayout(t)
    this._clampScroll()
    this._syncButtons()
    this.invalidate()
  }

  // ── Layout ──────────────────────────────────────────────────────────────────

  _phone () { return this.opts.phone ?? (typeof window !== 'undefined' && window.innerWidth <= 700) }

  _size () {
    const phone = this._phone()
    const hostW = this.host.clientWidth || this.stage.clientWidth || 360
    const winH = typeof window !== 'undefined' ? window.innerHeight || 720 : 720
    const h = Math.round(this.opts.height ?? clamp(winH * (phone ? 0.42 : 0.5), 220, 520))
    this.stage.style.height = h + 'px'
    const w = Math.max(160, Math.round(this.stage.clientWidth || hostW))
    this._dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1)
    this._W = w; this._H = h
    this.cv.width = Math.round(w * this._dpr); this.cv.height = Math.round(h * this._dpr)
    const velH = phone ? 64 : 48
    this._L = { W: w, H: h, rulerH: RULER_H, gridTop: RULER_H, velH, gridH: Math.max(40, h - RULER_H - velH - 4), velTop: h - velH }
    this._v.keyW = phone ? 40 : 46
    this._edge = phone ? 14 : 7
    this._clampScroll()
  }

  _firstLayout (t) {
    this._centered = true
    const keep = this.opts.view
    if (keep && Number.isFinite(keep.pxPerStep)) {   // a rebuilt roll comes back where it was
      this._v.pxPerStep = clamp(keep.pxPerStep, PR.ZOOM_X.min, PR.ZOOM_X.max); this._v.rowH = clamp(keep.rowH, PR.ZOOM_Y.min, PR.ZOOM_Y.max)
      this._v.scrollX = Math.max(0, keep.scrollX || 0); this._v.scrollY = Math.max(0, keep.scrollY || 0)
      return
    }
    const phone = this._phone()
    const gw = this._L.W - this._v.keyW
    const fit = gw / Math.max(1, this._v.total)
    this._v.pxPerStep = clamp(this.prefs.zx > 0 ? this.prefs.zx : clamp(fit, phone ? 20 : 14, 44), PR.ZOOM_X.min, PR.ZOOM_X.max)
    this._v.rowH = clamp(this.prefs.zy > 0 ? this.prefs.zy : (phone ? 22 : 14), PR.ZOOM_Y.min, PR.ZOOM_Y.max)
    let lo = t.note; let hi = t.note
    if (t.steps.length) { lo = 127; hi = 0; for (const e of t.steps) { if (e.midi < lo) lo = e.midi; if (e.midi > hi) hi = e.midi } }
    this._v = PR.scrollToPitches(this._v, lo - 2, hi + 2, this._L.gridH)
    this._v.scrollX = 0
  }

  _clampScroll () {
    if (!this._L) return
    this._v = PR.clampScroll(this._v, this._L.W - this._v.keyW, this._L.gridH)
  }

  invalidate () {
    this._dirty = true
    if (this._rq || this._dead) return
    if (this.opts.active && !this.opts.active()) return   // a closed window draws nothing; onResize() / the next change redraws when it opens
    if (typeof requestAnimationFrame !== 'function') { this._draw(); return }
    this._rq = requestAnimationFrame(() => { this._rq = 0; if (!this._dead && this._dirty) this._draw() })
  }

  // ── Drawing ─────────────────────────────────────────────────────────────────

  _palette () {
    if (this._pal) return this._pal
    let cs = null
    try { cs = getComputedStyle(this.host) } catch (_) { cs = null }
    const css = (n, d) => { try { return (cs?.getPropertyValue(n) || '').trim() || d } catch (_) { return d } }
    this._pal = { accent: css('--omni-theme-accent', '#ffb86b'), text: css('--omni-theme-text', '#e8eaf0'), bg: css('--omni-theme-bg', '#12141a'), border: css('--omni-theme-border', 'rgba(255,255,255,.22)') }
    return this._pal
  }

  /** Draw now (public for the tests). */
  _draw () {
    this._dirty = false
    let g = null
    try { g = this.cv.getContext('2d') } catch (_) { g = null }
    if (!g || !this._L) return
    const L = this._L; const v = this._v; const P = this._palette()
    const color = this.opts.color || P.accent
    g.setTransform?.(this._dpr, 0, 0, this._dpr, 0, 0)
    g.clearRect?.(0, 0, L.W, L.H)
    g.fillStyle = 'rgba(8,9,13,0.55)'; g.fillRect?.(0, 0, L.W, L.H)
    const gx0 = v.keyW; const gw = L.W - v.keyW
    const mask = PR.scaleMask(this.prefs.key, this.prefs.scale); const showScale = this.prefs.scale !== 'chromatic'
    // grid rows (clipped to the grid area)
    g.save?.(); g.beginPath?.(); g.rect?.(gx0, L.gridTop, gw, L.gridH); g.clip?.()
    const vis = PR.visibleRange(v, gw, L.gridH)
    for (let midi = vis.hi; midi >= vis.lo; midi--) {
      const y = L.gridTop + PR.midiToY(v, midi)
      g.fillStyle = PR.isBlack(midi) ? 'rgba(0,0,0,0.30)' : 'rgba(255,255,255,0.045)'; g.fillRect?.(gx0, y, gw, v.rowH)
      if (showScale && !mask[PR.pitchClass(midi)]) { g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect?.(gx0, y, gw, v.rowH) }
      else if (showScale && PR.isRoot(midi, this.prefs.key)) { g.fillStyle = 'rgba(255,184,107,0.13)'; g.fillRect?.(gx0, y, gw, v.rowH) }
      g.fillStyle = PR.pitchClass(midi) === 0 ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.07)'; g.fillRect?.(gx0, y + v.rowH - 1, gw, 1)
    }
    // beyond the pattern end
    const endX = PR.stepToX(v, v.total)
    if (endX < L.W) { g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect?.(Math.max(gx0, endX), L.gridTop, L.W, L.gridH) }
    const lines = PR.gridLines(v, gw, PR.gridSize(this.prefs.snap, v.spb))
    for (const ln of lines) {
      const x = Math.round(PR.stepToX(v, ln.step)); if (x < gx0 || x > L.W) continue
      g.fillStyle = ln.kind === 'bar' ? 'rgba(255,255,255,0.5)' : ln.kind === 'beat' ? 'rgba(255,255,255,0.22)' : ln.kind === 'step' ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.05)'
      g.fillRect?.(x, L.gridTop, 1, L.gridH)
    }
    // notes
    for (const n of this._notes) {
      const r = PR.noteRect(v, n); if (r.x + r.w < gx0 || r.x > L.W || r.y + r.h < 0 || r.y > L.gridH) continue
      const sel = this._sel.has(n.id)
      g.globalAlpha = 0.4 + 0.6 * n.velocity; g.fillStyle = sel ? '#fff' : color; g.fillRect?.(r.x, L.gridTop + r.y, r.w, r.h)
      g.globalAlpha = 1
      if (sel) { g.strokeStyle = color; g.lineWidth = 2; g.strokeRect?.(r.x, L.gridTop + r.y, r.w, r.h) }
      else { g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect?.(r.x + r.w - 2, L.gridTop + r.y, 2, r.h) }
      if (r.w > 30 && v.rowH >= 12) { g.fillStyle = sel ? '#222' : 'rgba(0,0,0,0.75)'; g.font = '9px sans-serif'; g.fillText?.(PR.pitchName(n.midi), r.x + 3, L.gridTop + r.y + v.rowH - 4) }
    }
    if (this._band) {
      const b = this._band; g.fillStyle = 'rgba(255,184,107,0.18)'; g.strokeStyle = P.accent; g.lineWidth = 1
      g.fillRect?.(b.x0, L.gridTop + b.y0, b.x1 - b.x0, b.y1 - b.y0); g.strokeRect?.(b.x0, L.gridTop + b.y0, b.x1 - b.x0, b.y1 - b.y0)
    }
    // scrollbars
    g.fillStyle = 'rgba(255,255,255,0.28)'
    const sx = this._thumbX(); if (sx) g.fillRect?.(sx.x, L.gridTop + L.gridH - 6, sx.w, 5)
    const sy = this._thumbY(); if (sy) g.fillRect?.(L.W - 6, L.gridTop + sy.y, 5, sy.h)
    g.restore?.()
    // key strip
    g.save?.(); g.beginPath?.(); g.rect?.(0, L.gridTop, gx0, L.gridH); g.clip?.()
    for (let midi = vis.hi; midi >= vis.lo; midi--) {
      const y = L.gridTop + PR.midiToY(v, midi); const black = PR.isBlack(midi)
      g.fillStyle = midi === this._keyDown ? P.accent : '#ececec'; g.fillRect?.(0, y, gx0 - 1, v.rowH - 1)
      if (black) { g.fillStyle = midi === this._keyDown ? P.accent : '#262626'; g.fillRect?.(0, y, gx0 * 0.62, v.rowH - 1) }
      if (showScale && mask[PR.pitchClass(midi)] && !black) { g.fillStyle = 'rgba(255,184,107,0.35)'; g.fillRect?.(gx0 - 6, y, 5, v.rowH - 1) }
      const lab = PR.keyLabel(midi, v.rowH >= 18); if (lab) { g.fillStyle = black ? '#e8e8e8' : '#333'; g.font = '9px sans-serif'; g.fillText?.(lab, black ? 3 : gx0 - 22, y + v.rowH - 3) }
    }
    g.restore?.()
    // ruler (bar numbers)
    g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect?.(0, 0, L.W, L.rulerH)
    g.fillStyle = P.text; g.font = '9px sans-serif'
    const every = Math.max(1, Math.ceil(36 / Math.max(1, v.spb * v.pxPerStep)))
    for (let b = 0; b * v.spb < v.total; b += every) { const x = PR.stepToX(v, b * v.spb); if (x >= gx0 && x < L.W - 12) g.fillText?.(String(b + 1), x + 3, 11) }
    // velocity lane
    g.fillStyle = 'rgba(0,0,0,0.30)'; g.fillRect?.(0, L.velTop, L.W, L.velH)
    g.fillStyle = P.text; g.font = '9px sans-serif'; g.fillText?.('Vel', 4, L.velTop + 12)
    g.save?.(); g.beginPath?.(); g.rect?.(gx0, L.velTop, gw, L.velH); g.clip?.()
    for (const n of this._notes) {
      const x = PR.stepToX(v, n.start); if (x < gx0 - 6 || x > L.W) continue
      const h = Math.max(2, (L.velH - 4) * n.velocity)
      g.fillStyle = this._sel.has(n.id) ? '#fff' : color; g.globalAlpha = 0.85; g.fillRect?.(x, L.velTop + L.velH - 2 - h, 3, h); g.globalAlpha = 1
      g.fillRect?.(x - 2, L.velTop + L.velH - 2 - h, 7, 3)
    }
    g.restore?.()
    this._moveHead(true)
  }

  _thumbX () {
    const v = this._v; const L = this._L; const vw = L.W - v.keyW; const cw = PR.gridWidth(v)
    if (cw <= vw + 1) return null
    const len = Math.max(24, vw * vw / cw); const mx = cw - vw
    return { x: v.keyW + (v.scrollX / mx) * (vw - len), w: len, max: mx, track: vw - len }
  }
  _thumbY () {
    const v = this._v; const L = this._L; const ch = PR.gridHeight(v)
    if (ch <= L.gridH + 1) return null
    const len = Math.max(24, L.gridH * L.gridH / ch); const mx = ch - L.gridH
    return { y: (v.scrollY / mx) * (L.gridH - len), h: len, max: mx, track: L.gridH - len }
  }

  // ── Playhead ────────────────────────────────────────────────────────────────

  /** Called every frame by the owner (the sequencer view); the playhead moves at most HEAD_FPS times a second and only while the transport runs. */
  update (delta = 0) {
    if (this._dead || !this._built) return
    this._acc += Math.max(0, delta)
    if (this._acc < 1 / HEAD_FPS) return
    this._acc = 0
    this._moveHead(false)
  }

  _playPos () {
    const seq = this._seq(); const m = this._music()
    if (!seq || !m || seq.nodeId !== this._nodeId || seq.state === 'stop' || typeof seq.getPosition !== 'function') return NaN
    const pos = seq.getPosition(); if (!(pos >= 0)) return NaN
    const total = MM.patternLengthSteps(m)
    return seq.mode === 'step' ? pos : (m.loop ? ((pos % total) + total) % total : Math.min(pos, total))
  }

  _moveHead (force) {
    if (!this.head || !this._L) return
    const p = this._playPos()
    if (Number.isNaN(p)) { if (this.head.style.display !== 'none') this.head.style.display = 'none'; this._lastHeadX = NaN; return }
    const v = this._v; const L = this._L
    let x = PR.stepToX(v, p)
    if (this.prefs.follow && (x > L.W - 12 || x < v.keyW) && !this._g) {
      this._v.scrollX = Math.max(0, p * v.pxPerStep - (L.W - v.keyW) * 0.12); this._clampScroll(); x = PR.stepToX(this._v, p); this.invalidate()
    }
    if (!force && Math.abs(x - this._lastHeadX) < 0.5) return
    this._lastHeadX = x
    if (x < v.keyW || x > L.W) { this.head.style.display = 'none'; return }
    this.head.style.display = 'block'; this.head.style.transform = `translateX(${x.toFixed(1)}px)`
  }

  // ── Toolbar ─────────────────────────────────────────────────────────────────

  _barHTML () {
    const b = (act, label, name, desc, extra = '') => `<button type="button" class="opr-b" data-opr="${act}" ${extra} ${tip(name, '—', desc)}>${label}</button>`
    const tools = TOOLS.map(([id, ic, name, desc]) => b('tool:' + id, `${ic}<span class="opr-tl"> ${name}</span>`, name, desc, 'aria-pressed="false"')).join('')
    const snap = `<select class="opr-s" data-oprf="snap" aria-label="Snap" ${tip('Snap', '—', 'What note starts and lengths snap to when you draw, move and resize: a step, half a step, a bar, or off (free).')}>${SNAPS.map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}</select>`
    const keys = `<select class="opr-s" data-oprf="key" aria-label="Key" ${tip('Key', '—', 'The root note of the scale shown in the rows (rows outside the scale are dimmed).')}>${PR.KEY_NAMES.map((n, i) => `<option value="${i}">${esc(n)}</option>`).join('')}</select>`
    const scales = `<select class="opr-s" data-oprf="scale" aria-label="Scale" ${tip('Scale', '—', 'Highlights a scale: major, minor, pentatonic ... Chromatic shows every row.')}>${PR.SCALE_IDS.map(s => `<option value="${s}">${esc(s.replace('-', ' '))}</option>`).join('')}</select>`
    return `<div class="opr-bar" data-ref="bar">${tools}
      ${b('paint', 'Paint', 'Paint', 'On: dragging in Draw mode paints a run of notes, one per cell. Off: dragging sideways sets the length of the new note.', 'aria-pressed="false"')}
      <span class="opr-sep"></span>${snap}${keys}${scales}
      ${b('snapscale', '♯ Scale', 'Snap to scale', 'On: new and moved notes snap to the nearest pitch of the chosen scale.', 'aria-pressed="false"')}
      <span class="opr-sep"></span>
      ${b('zoomout', '−', 'Zoom out', 'Shows more steps (also Ctrl / Cmd + wheel, or pinch).')}${b('zoomin', '+', 'Zoom in', 'Shows fewer steps, bigger.')}${b('fit', 'Fit', 'Fit', 'Zooms so the whole pattern fits the width.')}
      ${b('zoomrows', '↕', 'Row height', 'Cycles the height of the pitch rows (small, medium, large).')}${b('follow', 'Follow', 'Follow playhead', 'While the pattern plays the roll scrolls to keep the playhead in view.', 'aria-pressed="false"')}
      <span class="opr-sep"></span>
      ${b('undo', '↶', 'Undo', 'Takes back the last change of the pattern (the same Undo as the grid).')}${b('redo', '↷', 'Redo', 'Puts back what Undo took away.')}
      ${b('all', 'All', 'Select all', 'Selects every note of the track (Ctrl / Cmd + A).')}${b('dup', '⧉', 'Duplicate', 'Copies the selected notes right after the selection (Ctrl / Cmd + D).')}${b('copy', 'Copy', 'Copy', 'Copies the selected notes (Ctrl / Cmd + C).')}${b('paste', 'Paste', 'Paste', 'Pastes the copied notes at the last place you clicked (Ctrl / Cmd + V).')}
      ${b('up', '♯+', 'Transpose up', 'Moves the selected notes up a semitone (Shift: an octave). With Snap to scale on, to the next scale note.')}${b('down', '♭−', 'Transpose down', 'Moves the selected notes down a semitone (Shift: an octave).')}
      ${b('delete', '🗑', 'Delete notes', 'Deletes the selected notes (Delete key).')}</div>`
  }

  _syncButtons () {
    if (!this._built) return
    const q = (sel) => this.host.querySelector(sel)
    this.host.querySelectorAll('[data-opr^="tool:"]').forEach(b => { const on = b.dataset.opr === 'tool:' + this.prefs.tool; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', String(on)) })
    const flag = (a, on) => { const b = q(`[data-opr="${a}"]`); if (b) { b.classList.toggle('is-on', !!on); b.setAttribute('aria-pressed', String(!!on)) } }
    flag('paint', this.prefs.paint); flag('snapscale', this.prefs.snapScale); flag('follow', this.prefs.follow)
    const sset = (k, val) => { const el = q(`[data-oprf="${k}"]`); if (el && el.value !== String(val)) el.value = String(val) }
    sset('snap', this.prefs.snap); sset('key', this.prefs.key); sset('scale', this.prefs.scale)
    const svc = this._svc(); const id = this._nodeId
    const dis = (a, d) => { const b = q(`[data-opr="${a}"]`); if (b) b.disabled = !!d }
    const has = this._sel.size > 0
    dis('undo', !svc?.canUndo?.(id)); dis('redo', !svc?.canRedo?.(id)); dis('dup', !has); dis('copy', !has); dis('paste', !CLIP); dis('up', !has); dis('down', !has); dis('delete', !has)
  }

  _click (e) {
    const b = e.target.closest?.('[data-opr]'); if (!b || b.disabled || !this.host.contains(b)) return
    this.act(b.dataset.opr)
  }

  _change (e) {
    const el = e.target; const f = el?.dataset?.oprf; if (!f) return
    if (f === 'snap') this.prefs.snap = ['step', 'half', 'bar', 'off'].includes(el.value) ? el.value : 'step'
    else if (f === 'key') this.prefs.key = clamp(Math.round(Number(el.value)) || 0, 0, 11)
    else if (f === 'scale') this.prefs.scale = PR.SCALE_IDS.includes(el.value) ? el.value : 'chromatic'
    this._savePrefs(); this.invalidate()
  }

  /** Every button as a method (the tests call it as well as clicking). Returns { ok } or whatever the store answered. */
  act (a, arg = null) {
    const L = this._L; const gw = L ? L.W - this._v.keyW : 300
    switch (a) {
      case 'paint': this.prefs.paint = !this.prefs.paint; break
      case 'snapscale': this.prefs.snapScale = !this.prefs.snapScale; break
      case 'follow': this.prefs.follow = !this.prefs.follow; break
      case 'zoomin': this._v = PR.zoomX(this._v, 1.35, null, gw); this.prefs.zx = this._v.pxPerStep; break
      case 'zoomout': this._v = PR.zoomX(this._v, 1 / 1.35, null, gw); this.prefs.zx = this._v.pxPerStep; break
      case 'fit': this._v = PR.fitX(this._v, gw); this.prefs.zx = 0; break
      case 'zoomrows': { const next = this._v.rowH < 12 ? 14 : this._v.rowH < 18 ? 22 : 9; this._v = PR.zoomY(this._v, next / this._v.rowH, L ? L.gridH / 2 : 0, L?.gridH ?? null); this.prefs.zy = this._v.rowH; break }
      case 'undo': return this._history('undo')
      case 'redo': return this._history('redo')
      case 'all': this._sel = new Set(this._notes.map(n => n.id)); break
      case 'none': this._sel.clear(); break
      case 'copy': return this.copy()
      case 'paste': return this.paste()
      case 'dup': return this.duplicate()
      case 'up': return this.transpose(arg ?? 1)
      case 'down': return this.transpose(arg ?? -1)
      case 'delete': return this.deleteSelection()
      default:
        if (typeof a === 'string' && a.startsWith('tool:')) { const t = a.slice(5); if (TOOLS.some(x => x[0] === t)) this.prefs.tool = t }
        else return { ok: false }
    }
    this._savePrefs(); this._clampScroll(); this._syncButtons(); this.invalidate()
    return { ok: true }
  }

  _history (which) {
    const svc = this._svc(); const r = svc?.[which]?.(this._nodeId) ?? { ok: false, error: 'Nothing to ' + which + '.' }
    if (!r.ok) this._say(r.error || 'Nothing to ' + which + '.', true)
    return r
  }

  // ── Editing (all through the store) ─────────────────────────────────────────

  _grid () { return PR.gridSize(this.prefs.snap, this._v.spb) }
  _pitch (midi, dir = 0) { return this.prefs.snapScale ? PR.snapToScale(midi, this.prefs.key, this.prefs.scale, dir) : clamp(Math.round(midi), 0, 127) }
  _plain (n) { return { start: n.start, length: n.length, midi: n.midi, velocity: n.velocity, prob: n.prob } }

  _ensureStroke () {
    if (this._stroke) return
    const svc = this._svc(); if (svc?.beginStroke?.(this._nodeId)) this._stroke = true
  }
  _endStroke () { if (this._stroke) { try { this._svc()?.endStroke?.() } catch (_) { /* ignore */ } this._stroke = false } }

  /** Write `notes` (with ids) as the whole track. `stroke`: part of a drag (one undo step). Returns the store's answer. */
  _commit (notes, stroke) {
    const svc = this._svc(); const m = this._music(); if (!svc || !m) return { ok: false, error: 'The music system is not running.' }
    const total = MM.patternLengthSteps(m)
    const norm = notes.map(n => {
      const so = MM.startToStepOffset(n.start, total)
      return { ...n, start: r3(so.step + so.offset), length: clamp(n.length, MM.LIMITS.gateMin, MM.gateMaxFor(m)) }
    })
    this._notes = norm   // so the ids follow the notes to their new place in _syncFromStore
    const events = MM.notesToEvents(norm.map(n => this._plain(n)), { total })
    if (stroke) this._ensureStroke()
    const r = svc.replaceEvents(this._nodeId, this._trackId, events)
    if (!r.ok) this._say(r.error || 'That did not work.', true)
    this._syncFromStore()
    return r
  }

  _audition (midi, vel = 0.8) {
    try { if (this.opts.preview) this.opts.preview(midi, vel); else this._seq()?.preview?.(this._nodeId, this._trackId, midi, vel) } catch (_) { /* no sound */ }
  }

  deleteSelection () {
    if (!this._sel.size) return { ok: false }
    const n = this._sel.size
    const r = this._commit(this._notes.filter(x => !this._sel.has(x.id)), false)
    this._sel.clear(); this._syncButtons(); this.invalidate()
    if (r.ok) this._say(`${n} note${n === 1 ? '' : 's'} deleted. Undo brings ${n === 1 ? 'it' : 'them'} back.`)
    return r
  }

  /** Move the selection by semitones (clamped so nothing leaves 0..127). With snap-to-scale each note goes to the scale pitch. */
  transpose (semis) {
    const sel = this.selection; if (!sel.length) return { ok: false }
    const c = PR.clampMove(sel, 0, semis, this._v.total)
    if (!c.dSemis) return { ok: false }
    const dir = c.dSemis > 0 ? 1 : -1
    const moved = new Map(sel.map(n => [n.id, { ...n, midi: this.prefs.snapScale ? PR.snapToScale(n.midi + c.dSemis, this.prefs.key, this.prefs.scale, dir) : n.midi + c.dSemis }]))
    const r = this._commit(this._notes.map(n => moved.get(n.id) ?? n), false)
    const lead = moved.values().next().value; if (lead) this._audition(lead.midi, lead.velocity)
    return r
  }

  /** Move the selection by `dSteps` (clamped into the pattern). */
  nudge (dSteps) {
    const sel = this.selection; if (!sel.length) return { ok: false }
    const c = PR.clampMove(sel, dSteps, 0, this._v.total)
    if (!c.dSteps) return { ok: false }
    const moved = new Map(PR.moveNotes(sel, c.dSteps, 0).map(n => [n.id, n]))
    return this._commit(this._notes.map(n => moved.get(n.id) ?? n), false)
  }

  copy () {
    const sel = this.selection; if (!sel.length) return { ok: false }
    const s0 = Math.min(...sel.map(n => n.start)); const e1 = Math.max(...sel.map(n => n.start + n.length))
    CLIP = { notes: sel.map(n => ({ ...this._plain(n), start: r3(n.start - s0) })), span: e1 - s0 }
    this._syncButtons(); this._say(`${sel.length} note${sel.length === 1 ? '' : 's'} copied.`)
    return { ok: true, count: sel.length }
  }

  /** Paste the copied notes at `at` (steps; default the last place you clicked, else the first visible step). Pasted notes become the selection. */
  paste (at = null) {
    if (!CLIP || !CLIP.notes.length) return { ok: false, error: 'Nothing was copied.' }
    const g = this._grid()
    let s = at ?? this._cursor ?? Math.max(0, PR.xToStep(this._v, this._v.keyW))
    s = g > 0 ? PR.snapTo(s, g, 'floor') : s
    const span = Math.max(...CLIP.notes.map(n => n.start))
    s = clamp(s, 0, Math.max(0, this._v.total - 0.05 - span))
    const fresh = CLIP.notes.map(n => ({ ...n, start: r3(n.start + s), id: this._idc++ }))
    this._sel = new Set(fresh.map(f => f.id))
    const r = this._commit([...this._notes, ...fresh], false)
    this._syncButtons(); this.invalidate()
    if (r.ok) this._say(`${fresh.length} note${fresh.length === 1 ? '' : 's'} pasted.`)
    return r
  }

  /** Copy the selection right behind itself (the offset is its length rounded up to the snap grid; no room = refused). */
  duplicate () {
    const sel = this.selection; if (!sel.length) return { ok: false }
    const s0 = Math.min(...sel.map(n => n.start)); const e1 = Math.max(...sel.map(n => n.start + n.length))
    const g = this._grid() > 0 ? this._grid() : 1
    const off = Math.max(g, PR.snapTo(e1 - s0, g, 'ceil'))
    const lastStart = Math.max(...sel.map(n => n.start))
    if (lastStart + off >= this._v.total - 0.05) { this._say('There is no room after the selection.', true); return { ok: false, error: 'no room' } }
    const fresh = sel.map(n => ({ ...n, start: r3(n.start + off), id: this._idc++ }))
    this._sel = new Set(fresh.map(f => f.id))
    const r = this._commit([...this._notes, ...fresh], false)
    this._syncButtons(); this.invalidate()
    if (r.ok) this._say(`${fresh.length} note${fresh.length === 1 ? '' : 's'} duplicated.`)
    return r
  }

  // ── Pointer ─────────────────────────────────────────────────────────────────

  _local (e) { const r = this.cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top } }

  /** Where a point is: 'key' | 'ruler' | 'grid' | 'vel' | 'thumbx' | 'thumby' | 'none'. */
  _region (x, y) {
    const L = this._L; const v = this._v
    if (y < L.gridTop) return 'ruler'
    if (y >= L.velTop) return x < v.keyW ? 'none' : 'vel'
    if (y > L.gridTop + L.gridH) return 'none'
    const gy = y - L.gridTop
    const tx = this._thumbX(); if (tx && gy >= L.gridH - 10 && x >= tx.x && x <= tx.x + tx.w) return 'thumbx'
    const ty = this._thumbY(); if (ty && x >= L.W - 12 && gy >= ty.y && gy <= ty.y + ty.h) return 'thumby'
    return x < v.keyW ? 'key' : 'grid'
  }

  _down (e) {
    if (!this._L) return
    const p = this._local(e)
    try { this.cv.setPointerCapture?.(e.pointerId) } catch (_) { /* synthetic */ }
    try { this.cv.focus?.({ preventScroll: true }) } catch (_) { /* ignore */ }
    this._ptrs.set(e.pointerId, { x: p.x, y: p.y, x0: p.x, y0: p.y })
    if (this._ptrs.size === 2) { this._startPinch(); return }
    if (this._ptrs.size > 2) return
    if (e.button != null && e.button === 1) { this._g = { kind: 'pan', pid: e.pointerId, x0: p.x, y0: p.y, sx: this._v.scrollX, sy: this._v.scrollY }; return }
    const region = this._region(p.x, p.y)
    const L = this._L; const v = this._v
    if (region === 'thumbx') { const t = this._thumbX(); this._g = { kind: 'sbx', pid: e.pointerId, x0: p.x, sx: v.scrollX, t }; return }
    if (region === 'thumby') { const t = this._thumbY(); this._g = { kind: 'sby', pid: e.pointerId, y0: p.y, sy: v.scrollY, t }; return }
    if (region === 'key') { const midi = PR.clampMidi(v, PR.yToMidi(v, p.y - L.gridTop)); this._keyDown = midi; this._g = { kind: 'key', pid: e.pointerId, midi }; this._audition(midi); this.invalidate(); return }
    if (region === 'vel') { this._startVel(e, p); return }
    if (region !== 'grid') return
    const gy = p.y - L.gridTop
    const step = PR.xToStep(v, p.x)
    this._cursor = Math.max(0, step)
    const hit = PR.hitNote(this._notes, v, p.x, gy, this._edge)
    const tool = this.prefs.tool
    const right = e.button === 2
    if (tool === 'pan' && !right) { this._g = { kind: 'pan', pid: e.pointerId, x0: p.x, y0: p.y, sx: v.scrollX, sy: v.scrollY }; return }
    if (right || tool === 'erase') {
      this._g = { kind: 'erase', pid: e.pointerId, base: this._notes.map(n => ({ ...n })), gone: new Set() }
      if (hit) this._eraseAt(hit.index)
      return
    }
    if (hit) {
      const n = this._notes[hit.index]
      const shift = !!(e.shiftKey || e.ctrlKey || e.metaKey)
      let changedSel = false
      if (shift) { if (this._sel.has(n.id)) this._sel.delete(n.id); else this._sel.add(n.id); changedSel = true }
      else if (!this._sel.has(n.id)) { this._sel = new Set([n.id]); changedSel = true }
      this._syncButtons(); if (changedSel) this.invalidate()
      if (shift && !this._sel.has(n.id)) return
      const ids = new Set(this._sel)
      const base = this._notes.map(x => ({ ...x }))
      const kind = hit.part === 'right' ? 'resize' : hit.part === 'left' ? 'resizel' : 'move'
      const ref = base.find(x => x.id === n.id)
      this._g = { kind, pid: e.pointerId, x0: p.x, y0: p.y, base, ids, ref, firstStart: Math.min(...base.filter(x => ids.has(x.id)).map(x => x.start)), moved: false, clickId: n.id, lastMidi: n.midi, timer: null, shift }
      if (e.pointerType === 'touch' || e.pointerType === 'pen') {   // long press on a note = erase it
        const gg = this._g
        gg.timer = setTimeout(() => { if (this._g !== gg || gg.moved) return; gg.timer = null; this._g = null; this._sel = new Set([n.id]); this.deleteSelection() }, LONG_PRESS_MS)
      }
      this._audition(n.midi, n.velocity)
      return
    }
    // empty cell
    if (tool === 'select') {
      if (!(e.shiftKey || e.ctrlKey || e.metaKey) && this._sel.size) { this._sel.clear(); this._syncButtons() }
      this._g = { kind: 'band', pid: e.pointerId, x0: p.x, y0: gy, add: !!(e.shiftKey || e.ctrlKey || e.metaKey), pre: new Set(this._sel) }
      this._band = { x0: p.x, y0: gy, x1: p.x, y1: gy }
      this.invalidate(); return
    }
    // draw: a new note
    if (!(e.shiftKey)) this._sel.clear()
    const grid = this._grid()
    const midi = this._pitch(PR.clampMidi(v, PR.yToMidi(v, gy)))
    const start = PR.newNoteStart(step, grid, v.total)
    const len = PR.newNoteLength(start, grid, v.total)
    const base = this._notes.map(x => ({ ...x }))
    const nn = { id: this._idc++, start, length: len, midi, velocity: 0.8, prob: 1 }
    this._g = { kind: this.prefs.paint ? 'paint' : 'create', pid: e.pointerId, x0: p.x, y0: p.y, base, nn, visited: new Set([Math.floor(start * 1000) + ':' + midi]), added: [nn], last: { start, midi } }
    this._sel = new Set([nn.id])
    this._commit([...base, nn], true)
    this._audition(midi)
    this._syncButtons(); this.invalidate()
  }

  _eraseAt (index) {
    const g = this._g; const n = this._notes[index]; if (!g || !n || g.gone.has(n.id)) return
    g.gone.add(n.id)
    this._sel.delete(n.id)
    this._commit(this._notes.filter(x => x.id !== n.id), true)
    this._syncButtons(); this.invalidate()
  }

  _move (e) {
    const q = this._ptrs.get(e.pointerId); if (!q || !this._L) return
    const p = this._local(e); q.x = p.x; q.y = p.y
    if (this._pinch) { this._movePinch(); return }
    const g = this._g; if (!g || (g.pid != null && g.pid !== e.pointerId)) return
    const L = this._L; const v = this._v; const gy = p.y - L.gridTop; const grid = this._grid()
    switch (g.kind) {
      case 'pan': this._v.scrollX = g.sx - (p.x - g.x0); this._v.scrollY = g.sy - (p.y - g.y0); this._clampScroll(); this.invalidate(); break
      case 'sbx': this._v.scrollX = g.sx + ((p.x - g.x0) / Math.max(1, g.t.track)) * g.t.max; this._clampScroll(); this.invalidate(); break
      case 'sby': this._v.scrollY = g.sy + ((p.y - g.y0) / Math.max(1, g.t.track)) * g.t.max; this._clampScroll(); this.invalidate(); break
      case 'key': { const midi = PR.clampMidi(v, PR.yToMidi(v, gy)); if (midi !== g.midi) { g.midi = midi; this._keyDown = midi; this._audition(midi); this.invalidate() } break }
      case 'vel': this._moveVel(p); break
      case 'band': this._moveBand(p, gy); break
      case 'erase': { const h = PR.hitNote(this._notes, v, p.x, gy, 0); if (h) this._eraseAt(h.index); break }
      case 'create': {
        const nn = g.nn; const end = PR.xToStep(v, p.x)
        const len = grid > 0 ? Math.max(grid, PR.snapTo(end - nn.start, grid, 'ceil')) : Math.max(0.05, end - nn.start)
        const l2 = Math.min(len, v.total - nn.start)
        if (Math.abs(l2 - nn.length) > 1e-9) { nn.length = l2; this._commit([...g.base, nn], true); this.invalidate() }
        break
      }
      case 'paint': {   // every cell on the way from the last one to this pointer position gets a note (a fast drag leaves no gaps)
        const step = PR.xToStep(v, p.x); const midi = this._pitch(PR.clampMidi(v, PR.yToMidi(v, gy)))
        const start = PR.newNoteStart(step, grid, v.total)
        const from = g.last ?? { start, midi }
        const gs = grid > 0 ? grid : 1
        const n = Math.max(1, Math.round(Math.abs(start - from.start) / gs))
        let changed = false
        for (let i = 1; i <= n; i++) {
          const f = i / n; const st = r3(from.start + (start - from.start) * f); const md = this._pitch(Math.round(from.midi + (midi - from.midi) * f))
          const key = Math.floor(st * 1000) + ':' + md
          if (g.visited.has(key)) continue
          g.visited.add(key); changed = true
          g.added.push({ id: this._idc++, start: st, length: PR.newNoteLength(st, grid, v.total), midi: md, velocity: 0.8, prob: 1 })
        }
        g.last = { start, midi }
        if (changed) { this._commit([...g.base, ...g.added], true); this._audition(midi); this.invalidate() }
        break
      }
      case 'move': case 'resize': case 'resizel': this._moveNotes(g, p, gy, grid); break
      default: break
    }
  }

  _moveNotes (g, p, gy, grid) {
    const v = this._v
    const dx = p.x - g.x0; const dy = p.y - g.y0
    if (!g.moved) {
      if (Math.abs(dx) < 3 && Math.abs(dy) < 3) return
      g.moved = true; clearTimeout(g.timer); g.timer = null
    }
    const sel = g.base.filter(n => g.ids.has(n.id)); const rest = g.base.filter(n => !g.ids.has(n.id))
    let out
    if (g.kind === 'move') {
      const d = PR.dragDelta(v, dx, dy, grid, g.firstStart)
      let c = PR.clampMove(sel, d.dSteps, d.dSemis, v.total)
      let moved = PR.moveNotes(sel, c.dSteps, c.dSemis)
      if (this.prefs.snapScale && c.dSemis) moved = moved.map(n => ({ ...n, midi: PR.snapToScale(n.midi, this.prefs.key, this.prefs.scale, c.dSemis > 0 ? 1 : -1) }))
      out = moved
      const lead = moved.find(n => n.id === g.clickId)
      if (lead && lead.midi !== g.lastMidi) { g.lastMidi = lead.midi; this._audition(lead.midi, lead.velocity) }
    } else if (g.kind === 'resize') {
      out = PR.resizeRight(sel, g.ref, PR.xToStep(v, p.x), grid, v.total)
    } else out = PR.resizeLeft(sel, g.ref, PR.xToStep(v, p.x), grid)
    this._sel = new Set(sel.map(n => n.id))
    this._commit([...rest, ...out], true)
    this.invalidate()
  }

  _moveBand (p, gy) {
    const g = this._g; const v = this._v
    this._band = { ...PR.normRect(g.x0, g.y0, p.x, gy) }
    const idx = PR.notesInRect(this._notes, v, this._band)
    const sel = new Set(g.add ? g.pre : [])
    for (const i of idx) sel.add(this._notes[i].id)
    this._sel = sel; this._syncButtons(); this.invalidate()
  }

  _up (e, cancel = false) {
    this._ptrs.delete(e.pointerId)
    if (this._pinch) { if (this._ptrs.size < 2) this._pinch = null; return }
    const g = this._g; if (!g || (g.pid != null && g.pid !== e.pointerId)) return
    clearTimeout(g.timer); this._g = null
    this._band = null
    if (g.kind === 'key') { this._keyDown = -1; this.invalidate() }
    if ((g.kind === 'move' || g.kind === 'resize' || g.kind === 'resizel') && !g.moved && !cancel && !g.shift && g.ids.size > 1) {   // a plain click on a note of a group selects just that note
      this._sel = new Set([g.clickId]); this._syncButtons()
    }
    this._endStroke()
    this._syncButtons(); this.invalidate()
    if (g.kind === 'band') this._say(this._sel.size ? `${this._sel.size} note${this._sel.size === 1 ? '' : 's'} selected.` : '')
    else this._noteInfo()
  }

  _noteInfo () {
    const sel = this.selection
    if (sel.length === 1) { const n = sel[0]; this._say(`${PR.pitchName(n.midi)} · step ${r3(n.start + 1)} · length ${r3(n.length)} · velocity ${Math.round(n.velocity * 100)}%`) }
    else if (sel.length) this._say(`${sel.length} notes selected.`)
  }

  // velocity lane
  _startVel (e, p) {
    const v = this._v; const L = this._L
    const i = PR.hitVelocity(this._notes, v, p.x, this._phone() ? 14 : 9)
    const n = i == null ? null : this._notes[i]
    // pressing a bar edits it (and the selected group); pressing between bars starts a sweep that sets every bar it passes
    this._g = { kind: 'vel', pid: e.pointerId, x0: p.x, base: this._notes.map(x => ({ ...x })), ids: !n ? new Set() : this._sel.has(n.id) ? new Set(this._sel) : new Set([n.id]), lastX: p.x }
    if (!n) return
    if (!this._sel.has(n.id)) { this._sel = new Set([n.id]); this._syncButtons() }
    this._setVel(p)
    void L
  }
  _moveVel (p) {
    const g = this._g; const v = this._v
    // sweeping sideways: every bar between the last and this x joins the group
    const a = Math.min(g.lastX, p.x) - 2; const b = Math.max(g.lastX, p.x) + 2
    for (const n of g.base) { const x = PR.stepToX(v, n.start); if (x >= a && x <= b) g.ids.add(n.id) }
    g.lastX = p.x
    this._setVel(p)
  }
  _setVel (p) {
    const g = this._g; const L = this._L
    if (!g.ids.size) return
    const val = PR.yToVelocity(L.velH - 4, p.y - L.velTop - 2)
    const out = g.base.map(n => (g.ids.has(n.id) ? { ...n, velocity: val } : n))
    this._sel = new Set([...this._sel, ...g.ids].filter(id => out.some(n => n.id === id)))
    this._commit(out, true)
    this._say(`Velocity ${Math.round(val * 100)}%`)
    this.invalidate()
  }

  // pinch (two pointers): zoom about the midpoint, pan with it
  _startPinch () {
    this._g = null; this._band = null; this._endStroke()
    const [a, b] = [...this._ptrs.values()]
    this._pinch = { d: Math.max(10, Math.hypot(a.x - b.x, a.y - b.y)), dx: Math.max(10, Math.abs(a.x - b.x)), dy: Math.max(10, Math.abs(a.y - b.y)), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 }
  }
  _movePinch () {
    const pz = this._pinch; const L = this._L; if (!pz || this._ptrs.size < 2) return
    const [a, b] = [...this._ptrs.values()]
    const dx = Math.max(10, Math.abs(a.x - b.x)); const dy = Math.max(10, Math.abs(a.y - b.y)); const mx = (a.x + b.x) / 2; const my = (a.y + b.y) / 2
    let v = this._v
    const fx = dx / pz.dx
    if (Math.abs(fx - 1) > 0.01) v = PR.zoomX(v, fx, mx, L.W - v.keyW)
    if (dy > 40 && pz.dy > 40) { const fy = dy / pz.dy; if (Math.abs(fy - 1) > 0.01) v = PR.zoomY(v, fy, my - L.gridTop, L.gridH) }
    v = { ...v, scrollX: v.scrollX - (mx - pz.mx), scrollY: v.scrollY - (my - pz.my) }
    this._v = PR.clampScroll(v, L.W - v.keyW, L.gridH); this.prefs.zx = this._v.pxPerStep; this.prefs.zy = this._v.rowH
    pz.dx = dx; pz.dy = dy; pz.mx = mx; pz.my = my
    this.invalidate()
  }

  _wheel (e) {
    if (!this._L) return
    e.preventDefault()
    const p = this._local(e); const L = this._L; const v = this._v
    if (e.ctrlKey || e.metaKey) { this._v = PR.zoomX(v, Math.exp(-e.deltaY * 0.0025), p.x, L.W - v.keyW); this.prefs.zx = this._v.pxPerStep }
    else if (e.altKey) { this._v = PR.zoomY(v, Math.exp(-e.deltaY * 0.0025), p.y - L.gridTop, L.gridH); this.prefs.zy = this._v.rowH }
    else if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) this._v.scrollX += (e.shiftKey ? e.deltaY : e.deltaX)
    else this._v.scrollY += e.deltaY
    this._clampScroll(); this.invalidate()
  }

  // ── Keyboard ────────────────────────────────────────────────────────────────

  _key (e) {
    const t = e.target
    if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return
    const mod = e.ctrlKey || e.metaKey; const k = e.key
    const grid = this._grid() > 0 ? this._grid() : 0.25
    let done = true
    if (k === 'Delete' || k === 'Backspace') this.deleteSelection()
    else if (mod && (k === 'a' || k === 'A')) this.act('all')
    else if (mod && (k === 'c' || k === 'C')) this.copy()
    else if (mod && (k === 'v' || k === 'V')) this.paste()
    else if (mod && (k === 'd' || k === 'D')) this.duplicate()
    else if (mod && (k === 'z' || k === 'Z')) this._history(e.shiftKey ? 'redo' : 'undo')
    else if (mod && (k === 'y' || k === 'Y')) this._history('redo')
    else if (k === 'Escape') { this._sel.clear(); this._g = null; this._band = null; this._endStroke(); this._syncButtons(); this.invalidate() }
    else if (k === 'ArrowLeft') this.nudge(-(e.shiftKey ? this._v.spb : grid))
    else if (k === 'ArrowRight') this.nudge(e.shiftKey ? this._v.spb : grid)
    else if (k === 'ArrowUp') this.transpose(e.shiftKey ? 12 : 1)
    else if (k === 'ArrowDown') this.transpose(e.shiftKey ? -12 : -1)
    else if (k === '+' || k === '=') this.act('zoomin')
    else if (k === '-' || k === '_') this.act('zoomout')
    else done = false
    if (done) { e.preventDefault(); e.stopPropagation() }
  }
}

export { OmniPianoRoll }
