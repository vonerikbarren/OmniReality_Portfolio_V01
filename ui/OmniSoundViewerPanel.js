/**
 * ui/OmniSoundViewerPanel.js — ⟐SoundViewer: the frequency viewer of a sound node (V194, window-chrome class A)
 *
 * Shows what the selected sound node (or the whole mix, 'master') sounds like, from SoundEngine.getAnalysis(nodeId) / getMasterAnalysis():
 *   - SPECTRUM    log-frequency BARS with peak-hold dots and a LINE (the same data as a smooth curve), a dB scale and a labelled frequency grid;
 *   - SCOPE       the waveform, started at a rising zero crossing so a steady tone stands still;
 *   - SPECTROGRAM the spectrum scrolling by (about 8 seconds), colours from the theme;
 *   - 7 BAND METERS (sub .. brilliance, the same seven bands that move the particles) with peak hold;
 *   - READOUT     peak frequency + note name + cents, level in dB, the ADSR phase (attack / decay / sustain / release lit), iteration / loop,
 *                 the current dynamic mark;
 *   - FREEZE      holds the picture (a copy of the data; the engine reuses its arrays), FFT ZOOM (20 Hz-20 kHz down to 20-120 Hz), the NODE PICKER
 *                 ('auto' = the selected node when it has sound, else master; 'master'; every node that has sound).
 * One 2D canvas (no WebGL), DPI aware, redrawn at most 30 times a second from the module's update(delta) (the app's shared ticker: BaseScene
 * calls update every frame), and only while the window is open and not frozen. Colours come from the OmniOS theme variables
 * (--omni-theme-*), re-read every 2 seconds. Silence / no engine / no analysis: the empty grid and a hint, never an error.
 * Built on ui/OmniSettingsPanelBase.js (resize + maximize from utils/OmniWindowChrome.js through WindowManager.register).
 * Pure maths: utils/OmniSoundVizMath.js. Opened by the nav item '⟐SoundViewer'.
 */

import OmniSettingsPanelBase, { esc, PHONE_MAX } from './OmniSettingsPanelBase.js'
import SoundEngine from '../systems/OmniSoundEngine.js'
import { handsSafe } from '../utils/OmniStoreLayout.js'
import { BAND_IDS } from '../utils/OmniSoundParticleModel.js'
import * as VM from '../utils/OmniSoundVizMath.js'

export const PANEL_ID = 'soundviewer'
export const NAV_ITEM = '⟐SoundViewer'
export const STORE_KEY = 'omni:soundviewer-v1'
export const VIEWS = ['all', 'bars', 'line', 'scope', 'spectro']
const VIEW_LABELS = { all: 'All', bars: 'Bars', line: 'Line', scope: 'Scope', spectro: 'Spectro' }
const VIEW_SHORT = { all: 'All', bars: 'Bars', line: 'Line', scope: 'Scope', spectro: 'Spec' }
const VIEW_DESC = {
  all: 'Spectrum (bars and line), spectrogram and scope together.',
  bars: 'Only the spectrum as bars with peak-hold dots.',
  line: 'Only the spectrum as a smooth log-frequency line.',
  scope: 'Only the waveform (oscilloscope).',
  spectro: 'Only the spectrogram: frequency up, time to the left.',
}
const PHASES = ['attack', 'decay', 'sustain', 'release']
const BAND_SHORT = ['SUB', 'BAS', 'LMD', 'MID', 'HMD', 'PRS', 'BRL']
const FPS = 30
const HIST = 256
const ROWS = 96
const tip = (name, desc, key = '—') => `data-omni-tip="${esc(name)}" data-omni-tip-key="${esc(key)}" data-omni-tip-desc="${esc(desc)}"`

const STYLES = `
.oss-panel.sv-panel { width: 380px; height: 560px; }
.sv-panel .oss-body { display: flex; flex-direction: column; gap: 6px; padding: 6px 8px 8px; overflow: hidden; }
.sv-top, .sv-tools { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; flex: 0 0 auto; }
.sv-top .oss-select { flex: 1 1 140px; min-width: 0; }
.sv-tools { gap: 3px; }
.sv-tools .oss-btn { min-width: 24px; min-height: 26px; padding: 0 5px; }
.sv-tools .sv-sep { flex: 1 1 2px; }
.sv-zoomlabel { font-size: 10px; opacity: .72; white-space: nowrap; }
.sv-read { display: grid; grid-template-columns: 1.3fr 1fr; gap: 0 8px; align-items: baseline; flex: 0 0 auto; }
.sv-k { font-size: 9px; letter-spacing: .08em; text-transform: uppercase; opacity: .62; }
.sv-v { font-size: 15px; letter-spacing: .02em; font-variant-numeric: tabular-nums; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sv-v.is-acc { color: var(--omni-theme-accent, #7fd8ff); }
.sv-phases { grid-column: 1 / -1; display: flex; gap: 4px; align-items: center; margin-top: 3px; }
.sv-chip { padding: 1px 7px; border-radius: 10px; border: 1px solid var(--omni-theme-border, rgba(255,255,255,.2)); font-size: 10px; opacity: .55; }
.sv-chip.is-on { opacity: 1; background: var(--omni-theme-accent, #7fd8ff); color: var(--omni-theme-bg, #08080c); border-color: transparent; font-weight: bold; }
.sv-meta { margin-left: auto; font-size: 10px; opacity: .72; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sv-wrap { position: relative; flex: 1 1 auto; min-height: 150px; border: 1px solid var(--omni-theme-border, rgba(255,255,255,.14)); border-radius: 6px; overflow: hidden; background: rgba(0,0,0,.2); touch-action: none; }
.sv-wrap canvas { position: absolute; left: 0; top: 0; width: 100%; height: 100%; display: block; outline: none; }
.sv-wrap canvas:focus-visible { box-shadow: inset 0 0 0 2px var(--omni-theme-accent, #7fd8ff); }
.sv-hint { flex: 0 0 auto; min-height: 13px; font-size: 10px; opacity: .72; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
@media (max-width: ${PHONE_MAX}px) {
  .oss-panel.sv-panel.sv-panel { max-height: 66vh; height: 66vh; }
  .sv-panel .oss-select, .sv-tools .oss-btn { min-height: 36px; }
  .sv-v { font-size: 14px; }
}
`

function injectStyles () {
  if (typeof document === 'undefined' || document.getElementById('sv-styles')) return
  const s = document.createElement('style'); s.id = 'sv-styles'; s.textContent = STYLES; document.head.appendChild(s)
}

const safeCall = (fn, ...a) => { try { return fn(...a) } catch (_) { return null } }
function readAnalysis (key) {
  const E = SoundEngine
  if (!E) return null
  const a = key === 'master' ? (typeof E.getMasterAnalysis === 'function' ? safeCall(() => E.getMasterAnalysis()) : null) : (typeof E.getAnalysis === 'function' ? safeCall(() => E.getAnalysis(key)) : null)
  return a && typeof a === 'object' ? a : null
}

export default class OmniSoundViewerPanel extends OmniSettingsPanelBase {
  constructor (omniNode = null) {
    super({ id: PANEL_ID, label: NAV_ITEM, iconLabel: '⟐♪', navItems: [NAV_ITEM], className: 'sv-panel' })
    this.omniNode = omniNode
    this._view = 'all'; this._zoom = 0; this._frozen = false
    this._pick = 'auto'; this._selected = null
    this._W = 0; this._H = 0; this._dpr = 1
    this._acc = 0; this._ro = null; this._h = {}
    this._ui = null; this._sg = null; this._sgx = null
    this._peaks = new Float32Array(128); this._meters = new Float32Array(7); this._mpeaks = new Float32Array(7)
    this._hold = null; this._shown = {}
    this._theme = null; this._themeAt = -1e9; this._lut = null
    this._barKey = ''; this._barBins = null; this._barN = 0; this._rowKey = ''; this._rowBins = null
    this._optKey = ''; this._now = 0
    this.lastDraw = null    // test hook: what the last frame drew
    this.draws = 0
    this._loadPrefs()
  }

  _loadPrefs () {
    try {
      const o = JSON.parse(localStorage.getItem(STORE_KEY) || 'null')
      if (o && VIEWS.includes(o.view)) this._view = o.view
      if (o && Number.isInteger(o.zoom) && o.zoom >= 0 && o.zoom < VM.ZOOMS.length) this._zoom = o.zoom
    } catch (_) { /* no storage */ }
  }
  _savePrefs () { try { localStorage.setItem(STORE_KEY, JSON.stringify({ view: this._view, zoom: this._zoom })) } catch (_) { /* no storage */ } }

  onInit () {
    injectStyles()
    const nodesChanged = () => { this._optKey = ''; if (this._isOpen) this._fillPicker() }
    this._h.sel = (e) => { const n = e.detail?.node; this._selected = n && n.id ? n.id : null; if (this._isOpen) this._onSourceChanged() }
    this._h.desel = () => { this._selected = null; if (this._isOpen) this._onSourceChanged() }
    this._h.nodes = nodesChanged
    this._h.resized = (e) => { if ((!e || !e.detail || e.detail.id === PANEL_ID) && this._isOpen) this._resize() }
    window.addEventListener('omni:node-selected', this._h.sel)
    window.addEventListener('omni:node-deselected', this._h.desel)
    for (const n of ['omni:node-created', 'omni:node-deleted', 'omni:node-updated', 'omni:nodes-updated']) window.addEventListener(n, this._h.nodes)
    window.addEventListener('omni:window-resized', this._h.resized)
    window.addEventListener('resize', this._h.resized)
  }

  onDestroy () {
    window.removeEventListener('omni:node-selected', this._h.sel)
    window.removeEventListener('omni:node-deselected', this._h.desel)
    for (const n of ['omni:node-created', 'omni:node-deleted', 'omni:node-updated', 'omni:nodes-updated']) window.removeEventListener(n, this._h.nodes)
    window.removeEventListener('omni:window-resized', this._h.resized)
    window.removeEventListener('resize', this._h.resized)
    this._ro?.disconnect?.(); this._ro = null
    this._sg = null; this._sgx = null; this._hold = null; this._ui = null
  }

  /** Desktop: a tall window at the right side, under the ribbon, clear of the hands (the particle viewer opens to its left). */
  _place () {
    const top = (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--omni-top-stack')) || 200) + 8
    const w = this._el.offsetWidth || 380
    const maxH = Math.max(260, window.innerHeight - top - 70)
    const sf = handsSafe(top, top + maxH)
    this._el.style.top = top + 'px'
    this._el.style.left = Math.max(12, Math.min(window.innerWidth - w - 12, sf.right - w)) + 'px'
    this._el.style.maxHeight = maxH + 'px'
  }

  buildBody (body) {
    body.innerHTML = `
      <div class="sv-top">
        <select class="oss-select" data-r="node" aria-label="Sound source" ${tip('Sound source', 'Which sound to look at: auto follows the node you select (master when it has no sound), master is the whole mix, or pick any node with sound.')}></select>
        <button type="button" class="oss-btn" data-a="freeze" aria-pressed="false" aria-label="Freeze" ${tip('Freeze', 'Holds the picture so you can read it. Press again to let it run (Space does the same while the picture has focus).', 'Space')}>❄ Freeze</button>
      </div>
      <div class="sv-read" role="status" aria-label="Sound readout">
        <div><div class="sv-k">Peak</div><div class="sv-v is-acc" data-r="peak">—</div></div>
        <div><div class="sv-k">Level</div><div class="sv-v" data-r="level">-inf dB</div></div>
        <div class="sv-phases" data-r="phases" role="group" aria-label="Envelope phase">${PHASES.map(p => `<span class="sv-chip" data-phase="${p}">${p[0].toUpperCase()}${p.slice(1, 3)}</span>`).join('')}<span class="sv-meta" data-r="meta"></span></div>
      </div>
      <div class="sv-tools" data-r="tools">
        ${VIEWS.map(v => `<button type="button" class="oss-btn" data-view="${v}" aria-pressed="false" ${tip(VIEW_LABELS[v] + ' view', VIEW_DESC[v])}>${VIEW_SHORT[v]}</button>`).join('')}
        <span class="sv-sep"></span>
        <button type="button" class="oss-btn" data-a="zoom-out" aria-label="Zoom out" ${tip('FFT zoom out', 'Shows a wider range of frequencies (down to 20 Hz - 20 kHz).', '−')}>−</button>
        <span class="sv-zoomlabel" data-r="zoom"></span>
        <button type="button" class="oss-btn" data-a="zoom-in" aria-label="Zoom in" ${tip('FFT zoom in', 'Zooms into the low frequencies: 20 Hz - 8 kHz, 2 kHz, 500 Hz, 120 Hz. The mouse wheel on the picture does the same.', '+')}>＋</button>
      </div>
      <div class="sv-wrap" data-r="wrap"><canvas tabindex="0" role="img" aria-label="Sound frequency viewer" data-r="canvas"></canvas></div>
      <div class="sv-hint" data-r="hint" aria-live="off"></div>`
    const q = (r) => body.querySelector(`[data-r="${r}"]`)
    this._ui = { node: q('node'), peak: q('peak'), level: q('level'), phases: q('phases'), meta: q('meta'), tools: q('tools'), zoom: q('zoom'), wrap: q('wrap'), canvas: q('canvas'), hint: q('hint') }
    body.addEventListener('click', (e) => this._click(e))
    this._ui.node.addEventListener('change', () => { this._pick = this._ui.node.value || 'auto'; this._onSourceChanged() })
    this._ui.canvas.addEventListener('wheel', (e) => { e.preventDefault(); this._zoomStep(e.deltaY > 0 ? -1 : 1) }, { passive: false })
    this._ui.canvas.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'f' || e.key === 'F') { this.toggleFreeze(); e.preventDefault(); e.stopPropagation() }
      else if (e.key === '+' || e.key === '=') { this._zoomStep(1); e.preventDefault(); e.stopPropagation() }
      else if (e.key === '-' || e.key === '_') { this._zoomStep(-1); e.preventDefault(); e.stopPropagation() }
    })
    if (typeof ResizeObserver !== 'undefined') { this._ro = new ResizeObserver(() => { if (this._isOpen) this._resize() }); this._ro.observe(this._ui.wrap) }
  }

  onOpened () {
    this._fillPicker()
    this._syncUi()
    this._resize()
    this._acc = 1
    this._clearSpectro()
  }
  refresh () { if (this._ui) { this._fillPicker(); this._syncUi() } }

  // ── the source ────────────────────────────────────────────────────────────

  _soundNodes () {
    let list = []
    try { list = this.omniNode?.getAllNodes?.() ?? [] } catch (_) { list = [] }
    return list.filter(d => d && d.id && d.sound && typeof d.sound === 'object')
  }
  _fillPicker () {
    if (!this._ui) return
    const nodes = this._soundNodes()
    const key = nodes.map(d => d.id + ':' + (d.label ?? '') + ':' + (d.sound.enabled === true)).join('|') + '#' + this._pick
    if (key === this._optKey) return
    this._optKey = key
    const opts = [['auto', 'Auto (selected node)'], ['master', 'Master (whole mix)'], ...nodes.map(d => [d.id, `${d.label || d.id}${d.sound.enabled === true ? '' : ' (off)'}`])]
    if (this._pick !== 'auto' && this._pick !== 'master' && !nodes.some(d => d.id === this._pick)) this._pick = 'auto'
    this._ui.node.innerHTML = opts.map(([v, l]) => `<option value="${esc(v)}"${v === this._pick ? ' selected' : ''}>${esc(l)}</option>`).join('')
    this._ui.node.value = this._pick
  }
  /** The analysis key in use: 'master' or a node id. */
  get sourceKey () {
    if (this._pick === 'master') return 'master'
    if (this._pick !== 'auto') return this._pick
    const sel = this._selected
    if (sel && this._soundNodes().some(d => d.id === sel)) return sel
    return 'master'
  }
  get sourceLabel () {
    const k = this.sourceKey
    if (k === 'master') return 'master'
    const d = this._soundNodes().find(x => x.id === k)
    return d?.label || k
  }
  _onSourceChanged () { this._clearSpectro(); this._peaks.fill(0); this._meters.fill(0); this._mpeaks.fill(0); this._acc = 1; this._draw(true) }

  // ── ui ───────────────────────────────────────────────────────────────────

  _click (e) {
    const t = e.target.closest?.('button'); if (!t) return
    if (t.dataset.view) return this.setView(t.dataset.view)
    switch (t.dataset.a) {
      case 'freeze': return this.toggleFreeze()
      case 'zoom-in': return this._zoomStep(1)
      case 'zoom-out': return this._zoomStep(-1)
      default:
    }
  }
  setView (v) { if (!VIEWS.includes(v)) return; this._view = v; this._savePrefs(); this._syncUi(); this._acc = 1; this._draw(true) }
  _zoomStep (d) { const z = Math.max(0, Math.min(VM.ZOOMS.length - 1, this._zoom + d)); if (z === this._zoom) return; this._zoom = z; this._savePrefs(); this._clearSpectro(); this._syncUi(); this._draw(true) }
  setZoom (i) { this._zoomStep(Math.max(0, Math.min(VM.ZOOMS.length - 1, Math.round(i))) - this._zoom) }
  toggleFreeze (on = !this._frozen) {
    this._frozen = !!on
    if (this._frozen) {
      const a = this._last
      this._hold = a ? { spectrum: Uint8Array.from(a.spectrum || []), waveform: Uint8Array.from(a.waveform || []), bands: { ...(a.bands || {}) }, peakHz: a.peakHz, level: a.level, phase: a.phase, binCount: a.binCount, sampleRate: a.sampleRate, iteration: a.iteration, loopCount: a.loopCount, dynamicNow: a.dynamicNow, playing: a.playing } : null
    } else this._hold = null
    this._syncUi()
  }
  get frozen () { return this._frozen }
  get view () { return this._view }
  get zoomIndex () { return this._zoom }

  _syncUi () {
    if (!this._ui) return
    this._ui.tools.querySelectorAll('[data-view]').forEach(b => { const on = b.dataset.view === this._view; b.setAttribute('aria-pressed', String(on)); b.classList.toggle('is-on', on) })
    const f = this._el.querySelector('[data-a="freeze"]'); if (f) { f.setAttribute('aria-pressed', String(this._frozen)); f.classList.toggle('is-on', this._frozen); f.textContent = this._frozen ? '▶ Run' : '❄ Freeze' }
    this._ui.zoom.textContent = VM.zoomRange(this._zoom).short; this._ui.zoom.title = VM.zoomRange(this._zoom).label
    this._ui.canvas.setAttribute('aria-label', `Sound frequency viewer: ${this.sourceLabel}, ${VIEW_LABELS[this._view]} view, ${VM.zoomRange(this._zoom).label}${this._frozen ? ', frozen' : ''}`)
  }

  // ── size ─────────────────────────────────────────────────────────────────

  _resize () {
    if (!this._ui) return
    const r = this._ui.wrap.getBoundingClientRect()
    const W = Math.max(60, Math.floor(r.width) || 340), H = Math.max(60, Math.floor(r.height) || 300)
    const dpr = Math.min(2.5, Math.max(1, (typeof window !== 'undefined' && window.devicePixelRatio) || 1))
    if (W === this._W && H === this._H && dpr === this._dpr) return
    this._W = W; this._H = H; this._dpr = dpr
    const cv = this._ui.canvas
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr)
    this._draw(true)
  }

  // ── the frame (30 fps at most, from the shared ticker via the module contract) ──────────────

  update (delta) {
    if (!this._isOpen || !this._ui) return
    this._acc += delta > 0 && delta < 1 ? delta : 0
    if (this._acc < 1 / FPS - 1e-4) return
    this._dt = Math.min(0.25, this._acc); this._acc = 0
    this._now += this._dt
    this._draw(false)
  }

  _themeColors () {
    if (this._theme && this._now - this._themeAt < 2) return this._theme
    this._themeAt = this._now
    let cs = null
    try { cs = getComputedStyle(this._el) } catch (_) { cs = null }
    const get = (n, d) => { const v = cs?.getPropertyValue?.(n)?.trim(); return v || d }
    const text = cs?.color || 'rgb(232,236,245)'
    const accent = get('--omni-theme-accent', '#7fd8ff')
    const bg = get('--omni-theme-bg', '#08080c')
    const border = get('--omni-theme-border', 'rgba(255,255,255,.14)')
    const t = { text, accent, bg, border, accentRgb: VM.parseColor(accent) || [127, 216, 255], textRgb: VM.parseColor(text) || [232, 236, 245], bgRgb: VM.parseColor(bg) || [8, 8, 12] }
    const key = t.accentRgb.join() + '|' + t.bgRgb.join()
    if (!this._lut || this._lutKey !== key) { this._lut = VM.heatLut(t.bgRgb.map(v => Math.round(v * 0.6)), t.accentRgb, 64); this._lutKey = key }
    this._theme = t
    return t
  }

  _readSource () {
    const key = this.sourceKey
    this._srcKey = key
    if (this._frozen && this._hold) return this._hold
    const a = readAnalysis(key)
    this._last = a
    return a
  }

  _dbRange () {
    const d = this.omniNode?.getNodeData?.(this._srcKey)?.sound
    const lo = Number(d?.minDb ?? d?.analysisMinDb ?? d?.minDecibels), hi = Number(d?.maxDb ?? d?.analysisMaxDb ?? d?.maxDecibels)
    return { lo: Number.isFinite(lo) ? lo : -100, hi: Number.isFinite(hi) && hi > (Number.isFinite(lo) ? lo : -100) ? hi : -30 }
  }

  _draw (force) {
    if (!this._ui) return
    if (!this._W) { this._W = 340; this._H = 300 }
    const a = this._readSource()
    const th = this._themeColors()
    const dt = this._dt || 1 / FPS
    // smoothed band meters / data for this frame
    const bands = a && a.bands ? a.bands : null
    for (let b = 0; b < 7; b++) {
      const raw = bands ? Math.max(0, Math.min(1, Number(bands[BAND_IDS[b]]) || 0)) : 0
      this._meters[b] += (raw - this._meters[b]) * (raw > this._meters[b] ? 0.6 : 0.18)
      this._mpeaks[b] = Math.max(this._meters[b], this._mpeaks[b] - dt * 0.5)
    }
    this._readouts(a)
    const cv = this._ui.canvas
    const ctx = cv.getContext?.('2d')
    if (!ctx) return
    const W = this._W, H = this._H
    ctx.setTransform?.(this._dpr, 0, 0, this._dpr, 0, 0)
    ctx.clearRect(0, 0, W, H)
    // layout
    const meterH = Math.max(44, Math.min(74, Math.round(H * 0.2)))
    const mainH = H - meterH - 4
    const lay = this._layout(W, mainH)
    const info = { view: this._view, silent: !a, rects: lay, src: this._srcKey, frozen: this._frozen }
    const { lo, hi } = VM.zoomRange(this._zoom)
    const db = this._dbRange()
    if (lay.spec) this._drawSpectrum(ctx, a, lay.spec, th, lo, hi, db, this._view !== 'line', this._view !== 'bars', dt)
    if (lay.sg) this._drawSpectrogram(ctx, a, lay.sg, th, lo, hi, !this._frozen)
    if (lay.scope) this._drawScope(ctx, a, lay.scope, th)
    this._drawMeters(ctx, { x: 0, y: H - meterH, w: W, h: meterH }, th)
    if (!a) {
      ctx.save(); ctx.fillStyle = th.text; ctx.globalAlpha = 0.65; ctx.font = '11px "Courier New", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText(this._srcKey === 'master' ? 'Silence. Play a sound node to see its sound.' : 'This node is silent. Press Play in the sound settings.', W / 2, lay.spec ? lay.spec.y + lay.spec.h / 2 : (lay.scope || lay.sg).y + (lay.scope || lay.sg).h / 2)
      ctx.restore()
    }
    this.lastDraw = info
    this.draws++
    void force
  }

  _layout (W, H) {
    const g = 4
    switch (this._view) {
      case 'bars': case 'line': return { spec: { x: 0, y: 0, w: W, h: H } }
      case 'scope': return { scope: { x: 0, y: 0, w: W, h: H } }
      case 'spectro': return { sg: { x: 0, y: 0, w: W, h: H } }
      default: {
        const h1 = Math.round(H * 0.42), h2 = Math.round(H * 0.3), h3 = H - h1 - h2 - 2 * g
        return { spec: { x: 0, y: 0, w: W, h: h1 }, sg: { x: 0, y: h1 + g, w: W, h: h2 }, scope: { x: 0, y: h1 + h2 + 2 * g, w: W, h: Math.max(20, h3) } }
      }
    }
  }

  _readouts (a) {
    const set = (el, key, text) => { if (this._shown[key] !== text) { this._shown[key] = text; el.textContent = text } }
    const hz = a ? Number(a.peakHz) : NaN
    const note = VM.hzToNote(hz)
    set(this._ui.peak, 'peak', a && hz > 0 ? `${VM.fmtHz(hz)}${note ? `  ${note.name}${note.cents ? (note.cents > 0 ? ' +' : ' ') + note.cents + '¢' : ''}` : ''}` : '—')
    set(this._ui.level, 'level', `${VM.levelToDb(a ? a.level : 0)} dB`)
    const ph = a ? String(a.phase) : 'idle'
    if (this._shown.phase !== ph) { this._shown.phase = ph; this._ui.phases.querySelectorAll('[data-phase]').forEach(c => c.classList.toggle('is-on', c.dataset.phase === ph)) }
    const meta = a ? [a.dynamicNow ? String(a.dynamicNow) : '', Number.isFinite(a.iteration) ? `it ${a.iteration}` : '', Number.isFinite(a.loopCount) && a.loopCount > 0 ? `loop ${a.loopCount}` : ''].filter(Boolean).join(' · ') : ''
    set(this._ui.meta, 'meta', meta)
    set(this._ui.hint, 'hint', `${this.sourceLabel}${this._frozen ? ' · frozen' : ''}${a ? '' : ' · silent'}`)
  }

  // ── spectrum: bars + line ────────────────────────────────────────────────

  _drawSpectrum (ctx, a, r, th, lo, hi, db, bars, line, dt) {
    const padL = 30, padB = 13
    const px = r.x + padL, pw = r.w - padL - 4, py = r.y + 2, ph = r.h - padB - 2
    ctx.save()
    ctx.font = '9px "Courier New", monospace'; ctx.textBaseline = 'middle'
    // dB grid
    ctx.strokeStyle = th.text; ctx.fillStyle = th.text; ctx.lineWidth = 1; ctx.textAlign = 'right'
    for (let i = 0; i <= 4; i++) {
      const y = Math.round(py + ph - (i / 4) * ph) + 0.5
      ctx.globalAlpha = 0.12; ctx.beginPath(); ctx.moveTo(px, y); ctx.lineTo(px + pw, y); ctx.stroke()
      ctx.globalAlpha = 0.6; ctx.fillText(String(Math.round(db.lo + (i / 4) * (db.hi - db.lo))), px - 3, Math.max(py + 5, Math.min(py + ph - 4, y)))
    }
    // frequency grid
    ctx.textAlign = 'center'
    let lastLabel = -1e9
    for (const f of VM.gridFreqs(lo, hi)) {
      const x = Math.round(px + VM.freqToX(f, lo, hi, pw)) + 0.5
      ctx.globalAlpha = 0.12; ctx.beginPath(); ctx.moveTo(x, py); ctx.lineTo(x, py + ph); ctx.stroke()
      const lx = Math.max(px + 12, Math.min(px + pw - 8, x))
      if (lx - lastLabel >= 26) { ctx.globalAlpha = 0.6; ctx.fillText(VM.fmtAxis(f), lx, py + ph + 7); lastLabel = lx }   // a label only when it has room
    }
    ctx.globalAlpha = 1
    const spec = a && a.spectrum && a.spectrum.length ? a.spectrum : null
    if (spec) {
      const bins = (a.binCount | 0) || spec.length, sr = Number(a.sampleRate) || 44100
      if (bars) {
        const n = Math.max(16, Math.min(96, Math.floor(pw / (this._W < 360 ? 5 : 6))))
        const key = [n, lo, hi, bins, sr, pw].join()
        if (key !== this._barKey) { this._barKey = key; this._barN = n; this._barBins = VM.binRanges(VM.logRanges(lo, hi, n), bins, sr); this._peaks.fill(0) }
        const bw = pw / n
        ctx.fillStyle = th.accent
        for (let i = 0; i < n; i++) {
          let mx = 0
          for (let b = this._barBins[i * 2], e = Math.min(spec.length, this._barBins[i * 2 + 1]); b < e; b++) if (spec[b] > mx) mx = spec[b]
          const v = mx / 255
          this._peaks[i] = Math.max(v, this._peaks[i] - dt * 0.35)
          const h = Math.max(0, v * ph)
          ctx.globalAlpha = line ? 0.45 : 0.85
          ctx.fillRect(px + i * bw + 0.5, py + ph - h, Math.max(1, bw - 1.5), h)
          ctx.globalAlpha = 0.95
          ctx.fillRect(px + i * bw + 0.5, py + ph - this._peaks[i] * ph - 1, Math.max(1, bw - 1.5), 2)
        }
        ctx.globalAlpha = 1
      }
      if (line) {
        const nyq = sr / 2
        ctx.beginPath()
        const step = 2
        let first = true
        for (let x = 0; x <= pw; x += step) {
          const f = VM.xToFreq(x, lo, hi, pw)
          const bf = Math.max(0, Math.min(bins - 1.001, (f / nyq) * bins)), b0 = Math.floor(bf), t = bf - b0
          const v = ((spec[b0] || 0) * (1 - t) + (spec[Math.min(spec.length - 1, b0 + 1)] || 0) * t) / 255
          const y = py + ph - v * ph
          if (first) { ctx.moveTo(px + x, y); first = false } else ctx.lineTo(px + x, y)
        }
        ctx.strokeStyle = th.accent; ctx.lineWidth = 1.5; ctx.globalAlpha = 1; ctx.stroke()
        ctx.lineTo(px + pw, py + ph); ctx.lineTo(px, py + ph); ctx.closePath()
        ctx.fillStyle = th.accent; ctx.globalAlpha = 0.14; ctx.fill(); ctx.globalAlpha = 1
      }
      // the peak marker
      const hz = Number(a.peakHz)
      if (hz >= lo && hz <= hi) {
        const x = Math.round(px + VM.freqToX(hz, lo, hi, pw)) + 0.5
        ctx.strokeStyle = th.text; ctx.globalAlpha = 0.8; ctx.setLineDash?.([3, 3]); ctx.beginPath(); ctx.moveTo(x, py); ctx.lineTo(x, py + ph); ctx.stroke(); ctx.setLineDash?.([])
        ctx.globalAlpha = 0.9; ctx.fillStyle = th.text; ctx.textAlign = x > px + pw - 50 ? 'right' : 'left'; ctx.fillText(VM.fmtHz(hz), x + (x > px + pw - 50 ? -3 : 3), py + 6)
      }
    }
    ctx.restore()
  }

  // ── spectrogram ──────────────────────────────────────────────────────────

  _ensureSg () {
    if (this._sg || typeof document === 'undefined') return !!this._sg
    try {
      const c = document.createElement('canvas'); c.width = HIST; c.height = ROWS
      const x = c.getContext?.('2d')
      if (!x) return false
      this._sg = c; this._sgx = x
    } catch (_) { return false }
    return true
  }
  _clearSpectro () { if (this._sgx) { this._sgx.clearRect(0, 0, HIST, ROWS) } this._rowKey = '' }

  _drawSpectrogram (ctx, a, r, th, lo, hi, advance) {
    if (!this._ensureSg()) return
    const sx = this._sgx
    if (advance) {
      sx.drawImage(this._sg, -1, 0)
      sx.clearRect(HIST - 1, 0, 1, ROWS)
      const spec = a && a.spectrum && a.spectrum.length ? a.spectrum : null
      if (spec) {
        const bins = (a.binCount | 0) || spec.length, sr = Number(a.sampleRate) || 44100
        const key = [lo, hi, bins, sr].join()
        if (key !== this._rowKey) { this._rowKey = key; this._rowBins = VM.binRanges(VM.logRanges(lo, hi, ROWS), bins, sr) }
        const lut = this._lut, ln = lut.length - 1
        for (let i = 0; i < ROWS; i++) {
          let mx = 0
          for (let b = this._rowBins[i * 2], e = Math.min(spec.length, this._rowBins[i * 2 + 1]); b < e; b++) if (spec[b] > mx) mx = spec[b]
          if (mx < 6) continue
          sx.fillStyle = lut[Math.min(ln, Math.round((mx / 255) * ln))]
          sx.fillRect(HIST - 1, ROWS - 1 - i, 1, 1)   // row 0 = lowest frequency, drawn at the bottom
        }
      }
    }
    ctx.save()
    ctx.fillStyle = `rgb(${this._theme.bgRgb.map(v => Math.round(v * 0.6)).join(',')})`; ctx.fillRect(r.x, r.y, r.w, r.h)
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(this._sg, 0, 0, HIST, ROWS, r.x, r.y, r.w, r.h)
    ctx.strokeStyle = th.border; ctx.lineWidth = 1; ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1)
    ctx.fillStyle = th.text; ctx.globalAlpha = 0.6; ctx.font = '9px "Courier New", monospace'; ctx.textBaseline = 'top'; ctx.textAlign = 'left'
    ctx.fillText(VM.fmtAxis(Math.round(hi)) + ' Hz', r.x + 4, r.y + 3)
    ctx.textBaseline = 'bottom'; ctx.fillText(VM.fmtAxis(Math.round(lo)) + ' Hz', r.x + 4, r.y + r.h - 3)
    ctx.restore()
  }

  // ── scope ───────────────────────────────────────────────────────────────

  _drawScope (ctx, a, r, th) {
    ctx.save()
    ctx.strokeStyle = th.border; ctx.lineWidth = 1; ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1)
    const mid = r.y + r.h / 2
    ctx.globalAlpha = 0.18; ctx.strokeStyle = th.text; ctx.beginPath(); ctx.moveTo(r.x, Math.round(mid) + 0.5); ctx.lineTo(r.x + r.w, Math.round(mid) + 0.5); ctx.stroke()
    const w = a && a.waveform && a.waveform.length ? a.waveform : null
    if (w) {
      const len = w.length, start = VM.scopeStart(w, len / 2), span = Math.max(8, len - start - 1)
      const take = Math.min(span, Math.max(64, Math.floor(len / 2)))
      ctx.beginPath()
      const n = Math.min(take, Math.floor(r.w))
      for (let i = 0; i < n; i++) {
        const v = (w[start + Math.floor((i / Math.max(1, n - 1)) * (take - 1))] - 128) / 128
        const x = r.x + (i / Math.max(1, n - 1)) * r.w, y = mid - v * (r.h / 2 - 3)
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
      }
      ctx.globalAlpha = 1; ctx.strokeStyle = th.accent; ctx.lineWidth = 1.5; ctx.stroke()
    }
    ctx.restore()
  }

  // ── band meters ────────────────────────────────────────────────────────

  _drawMeters (ctx, r, th) {
    ctx.save()
    const n = 7, gap = 6, bw = (r.w - gap * (n + 1)) / n, labelH = 12
    const mh = r.h - labelH - 2
    ctx.font = '9px "Courier New", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    for (let b = 0; b < n; b++) {
      const x = r.x + gap + b * (bw + gap)
      ctx.globalAlpha = 0.14; ctx.fillStyle = th.text; ctx.fillRect(x, r.y, bw, mh)
      ctx.globalAlpha = 0.92; ctx.fillStyle = `hsl(${VM.bandHue(b)}, 70%, 58%)`
      const h = this._meters[b] * mh
      ctx.fillRect(x, r.y + mh - h, bw, h)
      ctx.globalAlpha = 1; ctx.fillRect(x, r.y + mh - this._mpeaks[b] * mh - 1, bw, 2)
      ctx.globalAlpha = 0.7; ctx.fillStyle = th.text; ctx.fillText(BAND_SHORT[b], x + bw / 2, r.y + mh + labelH / 2 + 1)
    }
    ctx.restore()
  }
}
