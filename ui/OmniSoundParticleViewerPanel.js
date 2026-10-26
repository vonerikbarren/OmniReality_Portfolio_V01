/**
 * ui/OmniSoundParticleViewerPanel.js — ⟐SoundParticleViewer: the FORMATION viewer of a sound node's particles (V194, window-chrome class A)
 *
 * Shows the cloud that systems/OmniSoundParticles.js draws in the scene for the selected node, flat, on one 2D canvas (no WebGL):
 *   - VIEWS       Top, Front, Side, and Orbit (a turntable; drag the picture to turn it, it spins by itself unless you switch Spin off);
 *   - LIVE        with the node playing, the particles move exactly as in the scene (the SAME maths: utils/OmniSoundParticleModel.js
 *                 layoutFormation + bandsToMotion + displaceParticles) and glow with their band; silent: the static resting formation,
 *                 nothing is redrawn except the orbit turn;
 *   - BANDS       a strip of the 7 bands with their live activity and what each one drives (radius, height, swirl ...);
 *   - COUNT       the live readout: drawn / count (granted by the LOD and the shared cap) / global cap, and why (far, cap, silent ...);
 *   - EDIT        formation picker, particle count slider (0..4000), size slider and the on/off switch write `data.soundParticles` of the
 *                 selected node (sanitized), apply live (omni:sound-particles-changed, the scene reacts within a quarter of a second) and are saved
 *                 with the node (omni:node-updated + omni:force-save, debounced while a slider moves).
 * No node selected: a hint. The node picker: 'auto' follows the selected node (it must have sound), or pick any node with sound.
 * The picture draws at most 30 times a second, from update(delta) (the shared ticker), only while the window is open.
 */

import OmniSettingsPanelBase, { esc, PHONE_MAX } from './OmniSettingsPanelBase.js'
import SoundEngine from '../systems/OmniSoundEngine.js'
import { handsSafe } from '../utils/OmniStoreLayout.js'
import { PARTICLE_SERVICES } from '../systems/OmniSoundParticles.js'
import {
  FORMATIONS, BAND_IDS, PARTICLE_FIELDS, defaultParticles, sanitizeParticles, layoutFormation,
  createMotionState, bandsToMotion, displaceParticles, createBarState, updateBarColumns, bandToMotion, bandColor, hexToRgb01, rgbToHue, hslToRgb, pitchHue,
} from '../utils/OmniSoundParticleModel.js'
import * as VM from '../utils/OmniSoundVizMath.js'

export const PANEL_ID = 'soundparticleviewer'
export const NAV_ITEM = '⟐SoundParticleViewer'
export const VIEWS = ['top', 'front', 'side', 'orbit']
const VIEW_LABELS = { top: 'Top', front: 'Front', side: 'Side', orbit: 'Orbit' }
const VIEW_DESC = { top: 'Looking down on the cloud (X across, Z down).', front: 'Looking at the cloud from the front (X across, Y up).', side: 'Looking at the cloud from the side (Z across, Y up).', orbit: 'A turntable view: drag the picture to turn the cloud.' }
const BAND_SHORT = ['SUB', 'BAS', 'LMD', 'MID', 'HMD', 'PRS', 'BRL']
const TARGET_SHORT = { none: '—', radius: 'rad', height: 'hgt', swirl: 'swl', jitter: 'jit', size: 'siz', brightness: 'brt', hue: 'hue' }
const LAYOUT_KEYS = ['formation', 'radius', 'height', 'turns', 'thickness', 'layers', 'seed', 'count', 'nodeCap', 'tilt']
const FPS = 30
const tip = (name, desc, key = '—') => `data-omni-tip="${esc(name)}" data-omni-tip-key="${esc(key)}" data-omni-tip-desc="${esc(desc)}"`

const STYLES = `
.oss-panel.spv-panel { width: 380px; height: 590px; }
.spv-panel .oss-body { display: flex; flex-direction: column; gap: 6px; padding: 6px 8px 8px; overflow: hidden; }
.spv-top, .spv-tools { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; flex: 0 0 auto; }
.spv-top .oss-select { flex: 1 1 140px; min-width: 0; }
.spv-tools .oss-btn { min-width: 28px; min-height: 26px; padding: 0 6px; }
.spv-tools .spv-sep { flex: 1 1 2px; }
.spv-count { display: grid; grid-template-columns: 1fr 1fr; gap: 0 8px; align-items: baseline; flex: 0 0 auto; }
.spv-k { font-size: 9px; letter-spacing: .08em; text-transform: uppercase; opacity: .62; }
.spv-v { font-size: 15px; font-variant-numeric: tabular-nums; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.spv-v.is-acc { color: var(--omni-theme-accent, #7fd8ff); }
.spv-wrap { position: relative; flex: 1 1 auto; min-height: 170px; border: 1px solid var(--omni-theme-border, rgba(255,255,255,.14)); border-radius: 6px; overflow: hidden; background: rgba(0,0,0,.22); touch-action: none; }
.spv-wrap canvas { position: absolute; left: 0; top: 0; width: 100%; height: 100%; display: block; outline: none; cursor: grab; }
.spv-wrap canvas:focus-visible { box-shadow: inset 0 0 0 2px var(--omni-theme-accent, #7fd8ff); }
.spv-edit { display: grid; grid-template-columns: 58px 1fr 52px; gap: 4px 6px; align-items: center; flex: 0 0 auto; }
.spv-edit label { font-size: 10px; opacity: .8; }
.spv-edit input[type=range] { width: 100%; min-width: 0; accent-color: var(--omni-theme-accent, #7fd8ff); }
.spv-edit .spv-num { font-size: 10px; text-align: right; font-variant-numeric: tabular-nums; }
.spv-edit .oss-select { grid-column: 2 / 4; min-width: 0; }
.spv-hint { flex: 0 0 auto; min-height: 13px; font-size: 10px; opacity: .72; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
@media (max-width: ${PHONE_MAX}px) {
  .oss-panel.spv-panel.spv-panel { max-height: 72vh; height: 72vh; }
  .spv-panel .oss-select, .spv-tools .oss-btn { min-height: 36px; }
  .spv-edit input[type=range] { min-height: 30px; }
}
`

function injectStyles () {
  if (typeof document === 'undefined' || document.getElementById('spv-styles')) return
  const s = document.createElement('style'); s.id = 'spv-styles'; s.textContent = STYLES; document.head.appendChild(s)
}

const safeCall = (fn) => { try { return fn() } catch (_) { return null } }
const rgbCss = (r, g, b) => `rgb(${Math.round(Math.max(0, Math.min(1, r)) * 255)},${Math.round(Math.max(0, Math.min(1, g)) * 255)},${Math.round(Math.max(0, Math.min(1, b)) * 255)})`

export default class OmniSoundParticleViewerPanel extends OmniSettingsPanelBase {
  constructor (omniNode = null) {
    super({ id: PANEL_ID, label: NAV_ITEM, iconLabel: '⟐✦', navItems: [NAV_ITEM], className: 'spv-panel' })
    this.omniNode = omniNode
    this._view = 'orbit'; this._spin = true; this._yaw = 0.6
    this._pick = 'auto'; this._selected = null
    this._W = 0; this._H = 0; this._dpr = 1
    this._acc = 0; this._now = 0; this._dt = 1 / FPS; this._ro = null; this._h = {}; this._ui = null
    this._p = null; this._L = null; this._layoutKey = ''; this._out = null; this._outCap = 0
    this._motion = createMotionState(); this._bars = createBarState(); this._swirl = 0; this._pitch = 0; this._pitchInit = false
    this._bandsBuf = { sub: 0, bass: 0, lowMid: 0, mid: 0, highMid: 0, presence: 0, brilliance: 0, level: 0 }
    this._dirty = true; this._playing = false; this._shown = {}
    this._optKey = ''; this._saveTimer = null; this._pending = null
    this._bucket = null; this._bucketCnt = new Uint32Array(40); this._bucketOff = new Uint32Array(41); this._classOf = null; this._depthOf = null
    this._drag = null; this._pr = { x: 0, y: 0, d: 0 }
    this.lastDraw = null; this.draws = 0
  }

  // ── lifecycle ──────────────────────────────────────────────────────────────

  onInit () {
    injectStyles()
    this._h.sel = (e) => { const n = e.detail?.node; this._selected = n && n.id ? n.id : null; if (this._isOpen) this._onSourceChanged() }
    this._h.desel = () => { this._selected = null; if (this._isOpen) this._onSourceChanged() }
    this._h.nodes = () => { this._optKey = ''; if (this._isOpen) { this._fillPicker(); this._dirty = true } }
    this._h.resized = (e) => { if ((!e || !e.detail || e.detail.id === PANEL_ID) && this._isOpen) this._resize() }
    window.addEventListener('omni:node-selected', this._h.sel)
    window.addEventListener('omni:node-deselected', this._h.desel)
    for (const n of ['omni:node-created', 'omni:node-deleted', 'omni:node-updated', 'omni:nodes-updated', 'omni:sound-particles-changed']) window.addEventListener(n, this._h.nodes)
    window.addEventListener('omni:window-resized', this._h.resized)
    window.addEventListener('resize', this._h.resized)
  }
  onDestroy () {
    this._flushSave()
    window.removeEventListener('omni:node-selected', this._h.sel)
    window.removeEventListener('omni:node-deselected', this._h.desel)
    for (const n of ['omni:node-created', 'omni:node-deleted', 'omni:node-updated', 'omni:nodes-updated', 'omni:sound-particles-changed']) window.removeEventListener(n, this._h.nodes)
    window.removeEventListener('omni:window-resized', this._h.resized)
    window.removeEventListener('resize', this._h.resized)
    this._ro?.disconnect?.(); this._ro = null
    this._L = null; this._out = null; this._ui = null
  }

  /** Desktop: right side under the ribbon, clear of the hands, to the LEFT of the ⟐SoundViewer window when there is room (else cascaded below it). */
  _place () {
    const top = (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--omni-top-stack')) || 200) + 8
    const w = this._el.offsetWidth || 380
    const maxH = Math.max(280, window.innerHeight - top - 70)
    const sf = handsSafe(top, top + maxH)
    const want = sf.right - w * 2 - 12
    const fits = want >= sf.left
    this._el.style.top = (fits ? top : top + 30) + 'px'
    this._el.style.left = Math.max(12, Math.min(window.innerWidth - w - 12, fits ? want : sf.right - w - 30)) + 'px'
    this._el.style.maxHeight = maxH + 'px'
  }

  buildBody (body) {
    const d = defaultParticles()
    const cf = PARTICLE_FIELDS.count, sf = PARTICLE_FIELDS.size
    body.innerHTML = `
      <div class="spv-top">
        <select class="oss-select" data-r="node" aria-label="Sound node" ${tip('Sound node', 'Which node\'s particles to look at: auto follows the node you select (it must have sound), or pick any node with sound.')}></select>
        <button type="button" class="oss-btn" data-a="on" aria-pressed="false" aria-label="Particles on" ${tip('Particles on', 'Switches the particle cloud of this node on or off in the scene.')}>On</button>
      </div>
      <div class="spv-count" role="status" aria-label="Particle count">
        <div><div class="spv-k">Particles</div><div class="spv-v is-acc" data-r="drawn">—</div></div>
        <div><div class="spv-k">Formation</div><div class="spv-v" data-r="form">—</div></div>
      </div>
      <div class="spv-tools" data-r="tools">
        ${VIEWS.map(v => `<button type="button" class="oss-btn" data-view="${v}" aria-pressed="false" ${tip(VIEW_LABELS[v] + ' view', VIEW_DESC[v])}>${VIEW_LABELS[v]}</button>`).join('')}
        <span class="spv-sep"></span>
        <button type="button" class="oss-btn" data-a="spin" aria-pressed="true" ${tip('Spin', 'Lets the orbit view turn by itself. Drag the picture to turn it by hand.')}>⟳ Spin</button>
      </div>
      <div class="spv-wrap" data-r="wrap"><canvas tabindex="0" role="img" aria-label="Particle formation viewer" data-r="canvas"></canvas></div>
      <div class="spv-edit">
        <label for="spv-form">Formation</label>
        <select id="spv-form" class="oss-select" data-r="formation" ${tip('Formation', 'The resting shape of the particle cloud. The scene changes at once.')}>${FORMATIONS.map(f => `<option value="${f.id}">${esc(f.label)}</option>`).join('')}</select>
        <label for="spv-count">Count</label>
        <input id="spv-count" type="range" min="${cf.min}" max="${cf.max}" step="10" value="${d.count}" data-r="count" ${tip('Particle count', 'How many particles the node draws (0 to 4000). Far nodes draw fewer and all nodes share a global cap.')}>
        <span class="spv-num" data-r="countNum">${d.count}</span>
        <label for="spv-size">Size</label>
        <input id="spv-size" type="range" min="${sf.min}" max="${sf.max}" step="0.01" value="${d.size}" data-r="size" ${tip('Particle size', 'The size of one point in scene units (it shrinks with distance).')}>
        <span class="spv-num" data-r="sizeNum">${d.size}</span>
      </div>
      <div class="spv-hint" data-r="hint" aria-live="off"></div>`
    const q = (r) => body.querySelector(`[data-r="${r}"]`)
    this._ui = { node: q('node'), drawn: q('drawn'), form: q('form'), tools: q('tools'), wrap: q('wrap'), canvas: q('canvas'), formation: q('formation'), count: q('count'), countNum: q('countNum'), size: q('size'), sizeNum: q('sizeNum'), hint: q('hint'), on: q('on') ?? body.querySelector('[data-a="on"]') }
    body.addEventListener('click', (e) => this._click(e))
    this._ui.node.addEventListener('change', () => { this._pick = this._ui.node.value || 'auto'; this._onSourceChanged() })
    this._ui.formation.addEventListener('change', () => this._edit({ formation: this._ui.formation.value }))
    this._ui.count.addEventListener('input', () => { this._ui.countNum.textContent = this._ui.count.value; this._edit({ count: Number(this._ui.count.value) }, true) })
    this._ui.size.addEventListener('input', () => { this._ui.sizeNum.textContent = Number(this._ui.size.value).toFixed(2); this._edit({ size: Number(this._ui.size.value) }, true) })
    for (const el of [this._ui.count, this._ui.size]) el.addEventListener('change', () => this._flushSave())
    const cv = this._ui.canvas
    cv.addEventListener('pointerdown', (e) => { this._drag = { x: e.clientX, yaw: this._yaw, id: e.pointerId, moved: false }; try { cv.setPointerCapture?.(e.pointerId) } catch (_) {} })
    cv.addEventListener('pointermove', (e) => {
      if (!this._drag) return
      const dx = e.clientX - this._drag.x
      if (Math.abs(dx) > 2) { this._drag.moved = true; if (this._view !== 'orbit') this.setView('orbit'); this._yaw = this._drag.yaw + dx * 0.012; this._dirty = true }
    })
    const end = () => { this._drag = null }
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end)
    cv.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') { this._yaw -= 0.15; this._dirty = true } else if (e.key === 'ArrowRight') { this._yaw += 0.15; this._dirty = true } else return
      e.preventDefault(); e.stopPropagation()
    })
    if (typeof ResizeObserver !== 'undefined') { this._ro = new ResizeObserver(() => { if (this._isOpen) this._resize() }); this._ro.observe(this._ui.wrap) }
  }

  onOpened () {
    this._fillPicker(); this._syncUi(); this._resize(); this._acc = 1; this._dirty = true
    this._onSourceChanged()
  }
  refresh () { if (this._ui) { this._fillPicker(); this._syncUi() } }

  // ── the source node ───────────────────────────────────────────────────────

  _soundNodes () {
    let list = []
    try { list = this.omniNode?.getAllNodes?.() ?? [] } catch (_) { list = [] }
    return list.filter(d => d && d.id && ((d.sound && typeof d.sound === 'object') || d.nodeKind === 'soundNode'))
  }
  _fillPicker () {
    if (!this._ui) return
    const nodes = this._soundNodes()
    const key = nodes.map(d => d.id + ':' + (d.label ?? '') + ':' + (d.sound?.enabled === true)).join('|') + '#' + this._pick
    if (key === this._optKey) return
    this._optKey = key
    if (this._pick !== 'auto' && !nodes.some(d => d.id === this._pick)) this._pick = 'auto'
    const opts = [['auto', 'Auto (selected node)'], ...nodes.map(d => [d.id, `${d.label || d.id}${d.sound?.enabled === true ? '' : ' (sound off)'}`])]
    this._ui.node.innerHTML = opts.map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('')
    this._ui.node.value = this._pick
  }
  /** The node id in use (or null). */
  get nodeId () {
    if (this._pick !== 'auto') return this._pick
    const sel = this._selected
    return sel && this._soundNodes().some(d => d.id === sel) ? sel : null
  }
  _data () { const id = this.nodeId; return id ? (safeCall(() => this.omniNode?.getNodeData?.(id)) ?? this._soundNodes().find(d => d.id === id) ?? null) : null }
  _onSourceChanged () {
    this._layoutKey = ''; this._motion = createMotionState(); this._bars = createBarState(); this._swirl = 0
    this._syncUi(); this._dirty = true; this._acc = 1
    this._draw()
  }

  // ── editing (writes data.soundParticles) ──────────────────────────────────

  /** The current particles of the node (sanitized; defaults when the node has none yet). */
  get particles () { const d = this._data(); return sanitizeParticles(d?.soundParticles ?? defaultParticles()) }

  _edit (patch, defer = false) {
    const d = this._data()
    if (!d) return false
    const next = sanitizeParticles({ ...sanitizeParticles(d.soundParticles ?? defaultParticles()), ...patch })
    d.soundParticles = next
    this._dirty = true
    try { window.dispatchEvent(new CustomEvent('omni:sound-particles-changed', { detail: { nodeId: d.id, patch } })) } catch (_) { /* no window */ }
    this._pending = d
    if (defer) { clearTimeout(this._saveTimer); this._saveTimer = setTimeout(() => this._flushSave(), 400) } else this._flushSave()
    this._syncUi()
    return true
  }
  _flushSave () {
    clearTimeout(this._saveTimer); this._saveTimer = null
    const d = this._pending; this._pending = null
    if (!d) return
    try { window.dispatchEvent(new CustomEvent('omni:node-updated', { detail: { node: d } })) } catch (_) { /* no window */ }
    try { window.dispatchEvent(new CustomEvent('omni:force-save')) } catch (_) { /* no window */ }
  }

  // ── ui ──────────────────────────────────────────────────────────────────

  _click (e) {
    const t = e.target.closest?.('button'); if (!t) return
    if (t.dataset.view) return this.setView(t.dataset.view)
    if (t.dataset.a === 'spin') { this._spin = !this._spin; this._syncUi(); return }
    if (t.dataset.a === 'on') { const d = this._data(); if (d) this._edit({ enabled: !(sanitizeParticles(d.soundParticles ?? defaultParticles()).enabled && !!d.soundParticles) }); return }
  }
  setView (v) { if (!VIEWS.includes(v)) return; this._view = v; this._syncUi(); this._dirty = true }

  _syncUi () {
    if (!this._ui) return
    this._ui.tools.querySelectorAll('[data-view]').forEach(b => { const on = b.dataset.view === this._view; b.setAttribute('aria-pressed', String(on)); b.classList.toggle('is-on', on) })
    const sp = this._ui.tools.querySelector('[data-a="spin"]'); if (sp) { sp.setAttribute('aria-pressed', String(this._spin)); sp.classList.toggle('is-on', this._spin) }
    const d = this._data()
    const has = !!d
    const p = this.particles
    for (const el of [this._ui.formation, this._ui.count, this._ui.size, this._ui.on]) el.disabled = !has
    if (has) {
      if (document.activeElement !== this._ui.formation) this._ui.formation.value = p.formation
      if (document.activeElement !== this._ui.count) { this._ui.count.value = String(p.count) }
      if (document.activeElement !== this._ui.size) { this._ui.size.value = String(p.size) }
      this._ui.countNum.textContent = String(p.count); this._ui.sizeNum.textContent = p.size.toFixed(2)
      const on = !!d.soundParticles && p.enabled
      this._ui.on.setAttribute('aria-pressed', String(on)); this._ui.on.classList.toggle('is-on', on); this._ui.on.textContent = on ? 'On' : 'Off'
    }
    this._ui.canvas.setAttribute('aria-label', has ? `Particle formation viewer: ${d.label || d.id}, ${p.formation}, ${VIEW_LABELS[this._view]} view` : 'Particle formation viewer: no sound node selected')
  }

  _resize () {
    if (!this._ui) return
    const r = this._ui.wrap.getBoundingClientRect()
    const W = Math.max(60, Math.floor(r.width) || 340), H = Math.max(60, Math.floor(r.height) || 300)
    const dpr = Math.min(2.5, Math.max(1, (typeof window !== 'undefined' && window.devicePixelRatio) || 1))
    if (W === this._W && H === this._H && dpr === this._dpr) return
    this._W = W; this._H = H; this._dpr = dpr
    const cv = this._ui.canvas
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr)
    this._dirty = true
    this._draw()
  }

  // ── frame ──────────────────────────────────────────────────────────────

  update (delta) {
    if (!this._isOpen || !this._ui) return
    this._acc += delta > 0 && delta < 1 ? delta : 0
    if (this._acc < 1 / FPS - 1e-4) return
    const dt = Math.min(0.25, this._acc); this._acc = 0
    this._dt = dt; this._now += dt
    const playing = this._isPlaying()
    this._playing = playing
    const spinning = this._view === 'orbit' && this._spin && !this._drag
    if (spinning) { this._yaw += dt * 0.45; this._dirty = true }
    // a cloud that is settling after the sound stopped still needs frames until it is at rest
    if (playing || this._motion.energy > 0.002 || this._motion.level > 0.002) this._dirty = true
    if (!this._dirty) return
    this._draw()
  }

  _isPlaying () {
    const id = this.nodeId
    if (!id) return false
    try { return !!(SoundEngine && typeof SoundEngine.isPlaying === 'function' && SoundEngine.isPlaying(id)) } catch (_) { return false }
  }
  _analysis () {
    const id = this.nodeId
    if (!id || !SoundEngine || typeof SoundEngine.getAnalysis !== 'function') return null
    const a = safeCall(() => SoundEngine.getAnalysis(id))
    return a && typeof a === 'object' ? a : null
  }

  /** The layout of the node's current particles (cached by the layout keys). */
  _ensureLayout (p) {
    const key = LAYOUT_KEYS.map(k => p[k]).join('|')
    if (key === this._layoutKey && this._L) return this._L
    this._layoutKey = key
    this._L = layoutFormation(p)
    const cap = Math.max(256, this._L.n)
    if (!this._out || this._outCap < cap) { this._outCap = Math.ceil(cap / 512) * 512; this._out = new Float32Array(this._outCap * 3); this._classOf = new Uint8Array(this._outCap); this._depthOf = new Uint8Array(this._outCap); this._bucket = new Uint16Array(this._outCap) }
    this._out.set(this._L.pos)
    return this._L
  }

  _draw () {
    if (!this._ui) return
    if (!this._W) { this._W = 340; this._H = 300 }
    this._dirty = false
    const d = this._data()
    const p = this.particles
    const W = this._W, H = this._H
    const cv = this._ui.canvas
    const ctx = cv.getContext?.('2d')
    this._syncCountText(d, p)
    if (!ctx) return
    ctx.setTransform?.(this._dpr, 0, 0, this._dpr, 0, 0)
    ctx.clearRect(0, 0, W, H)
    let th = { text: 'rgb(232,236,245)', accent: '#7fd8ff', border: 'rgba(255,255,255,.2)' }
    try { const cs = getComputedStyle(this._el); th = { text: cs.color || th.text, accent: cs.getPropertyValue('--omni-theme-accent')?.trim() || th.accent, border: cs.getPropertyValue('--omni-theme-border')?.trim() || th.border } } catch (_) { /* no style */ }
    if (!d) {
      ctx.save(); ctx.fillStyle = th.text; ctx.globalAlpha = 0.7; ctx.font = '11px "Courier New", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText('Select a node with sound to see its particles.', W / 2, H / 2 - 8)
      ctx.globalAlpha = 0.5; ctx.fillText('(Create one with the ribbon: Home > Create > Sound node)', W / 2, H / 2 + 10)
      ctx.restore()
      this.lastDraw = { empty: true, view: this._view }
      this.draws++
      return
    }
    const L = this._ensureLayout(p)
    // live motion (the same smoother and kernel as the scene)
    const a = this._playing || this._motion.energy > 0.002 ? this._analysis() : null
    const live = a && a.playing !== false
    const bb = this._bandsBuf
    if (live && a.bands && typeof a.bands === 'object') { for (let b = 0; b < 7; b++) bb[BAND_IDS[b]] = a.bands[BAND_IDS[b]]; bb.level = a.level } else { for (let b = 0; b < 7; b++) bb[BAND_IDS[b]] = 0; bb.level = 0 }
    const m = bandsToMotion(bb, p, this._motion, this._dt)
    const active = m.energy > 0.0015 || m.level > 0.0015
    const k = Math.min(L.n, window.innerWidth <= PHONE_MAX ? 1500 : 2500)
    const bars = p.formation === 'bars'
    if (active || this._lastActive) {
      if (bars) updateBarColumns(this._bars, live ? a : null, this._motion.env, p, this._dt)
      this._swirl += p.swirlAmount * m.swirl * this._dt
      displaceParticles(this._out, L, p, m, k, this._now, this._swirl, p.noiseAmount * (active ? 1 : 0), bars ? this._bars : null)
    }
    this._lastActive = active
    this._paint(ctx, d, p, L, k, m, a, live, th)
    this.draws++
  }

  _syncCountText (d, p) {
    const set = (el, key, text) => { if (this._shown[key] !== text) { this._shown[key] = text; el.textContent = text } }
    if (!d) { set(this._ui.drawn, 'drawn', '—'); set(this._ui.form, 'form', '—'); set(this._ui.hint, 'hint', 'No sound node selected'); return }
    const sys = PARTICLE_SERVICES.system
    const st = safeCall(() => sys?.getStats?.(d.id))
    let text, why = ''
    if (st) {
      text = `${st.drawn} / ${p.count}`
      if (st.granted < (st.afterLod ?? st.wanted)) why = ` · cap ${sys.globalCap}`
      else if ((st.afterLod ?? st.wanted) < st.wanted) why = ' · LOD'
      if (!st.visible) why += ` · ${st.reason}`
      else if (st.reason === 'silent') why += ' · silent'
    } else {
      text = `${p.enabled && d.soundParticles ? Math.min(p.count, p.nodeCap) : 0} / ${p.count}`
      why = d.soundParticles ? ' · not in scene' : ' · no particles yet'
    }
    set(this._ui.drawn, 'drawn', text)
    set(this._ui.form, 'form', FORMATIONS.find(f => f.id === p.formation)?.label ?? p.formation)
    const soundOn = d.sound?.enabled === true
    set(this._ui.hint, 'hint', `${d.label || d.id}${why}${soundOn ? '' : ' · sound is off (turn it on in the sound settings)'}`)
  }

  // ── painting ─────────────────────────────────────────────────────────────

  _paint (ctx, d, p, L, k, m, a, live, th) {
    const W = this._W, H = this._H
    const stripH = 30
    const area = { x: 0, y: 0, w: W, h: H - stripH }
    const cx = area.w / 2, cy = area.h / 2
    const ext = Math.max(0.5, Math.max(p.radius, p.height) * (1 + Math.min(1.5, p.radiusAmount * 0.5)) * 1.08)
    const scale = Math.min(area.w, area.h) / 2 / ext
    const view = this._view
    ctx.save()
    // guides
    ctx.strokeStyle = th.text; ctx.lineWidth = 1; ctx.globalAlpha = 0.12
    ctx.beginPath(); ctx.moveTo(0, Math.round(cy) + 0.5); ctx.lineTo(area.w, Math.round(cy) + 0.5); ctx.moveTo(Math.round(cx) + 0.5, 0); ctx.lineTo(Math.round(cx) + 0.5, area.h); ctx.stroke()
    if (view === 'top' || view === 'orbit') { ctx.beginPath(); ctx.arc(cx, cy, p.radius * scale * (view === 'orbit' ? 1 : 1), 0, Math.PI * 2); ctx.stroke() }
    ctx.globalAlpha = 0.55; ctx.fillStyle = th.text; ctx.font = '9px "Courier New", monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'top'
    ctx.fillText(`${VIEW_LABELS[view]}${view === 'orbit' ? '' : view === 'top' ? '  X → · Z ↓' : view === 'front' ? '  X → · Y ↑' : '  Z → · Y ↑'}`, 5, 4)
    ctx.fillStyle = th.text
    ctx.textAlign = 'right'; ctx.fillText(live ? 'live' : 'resting', area.w - 5, 4)
    ctx.globalAlpha = 1
    // colours per class
    const mode = p.colorMode
    const nClass = mode === 'band' || mode === 'gradient' ? 7 : 1
    const rgb = this._rgbBuf || (this._rgbBuf = new Float32Array(3)), rgb2 = this._rgbBuf2 || (this._rgbBuf2 = new Float32Array(3))
    const css = this._cssBuf || (this._cssBuf = new Array(7).fill(''))
    hexToRgb01(p.color, rgb)
    const g = Math.max(0.2, Math.min(2, p.brightness * (0.7 + 0.5 * m.level)))
    const baseHue = rgbToHue(rgb[0], rgb[1], rgb[2])
    if (mode === 'band') {
      for (let b = 0; b < 7; b++) { bandColor(b, baseHue + m.hue * 0.08, p, rgb2, 0, g * (0.55 + 0.7 * Math.min(1, this._motion.env[b]))); css[b] = rgbCss(rgb2[0], rgb2[1], rgb2[2]) }
    } else if (mode === 'gradient') {
      hexToRgb01(p.color2, rgb2)
      for (let b = 0; b < 7; b++) { const t = b / 6; css[b] = rgbCss((rgb[0] + (rgb2[0] - rgb[0]) * t) * g, (rgb[1] + (rgb2[1] - rgb[1]) * t) * g, (rgb[2] + (rgb2[2] - rgb[2]) * t) * g) }
    } else if (mode === 'pitch') {
      const hz = live && a ? Number(a.peakHz) : 0
      if (hz > 20 && m.level > 0.02) { const target = pitchHue(hz); if (!this._pitchInit) { this._pitch = target; this._pitchInit = true } let dd = target - this._pitch; dd -= Math.round(dd); this._pitch = (this._pitch + dd * 0.25 + 1) % 1 }
      hslToRgb(baseHue + this._pitch, p.saturation, 0.55, rgb2, 0); css[0] = rgbCss(rgb2[0] * g, rgb2[1] * g, rgb2[2] * g)
    } else css[0] = rgbCss(rgb[0] * g, rgb[1] * g, rgb[2] * g)
    // bucket the first k particles by (class, depth) so each fillStyle / alpha is set 21 times, not k times
    const out = this._out, classOf = this._classOf, depthOf = this._depthOf, cnt = this._bucketCnt, off = this._bucketOff, bucket = this._bucket
    cnt.fill(0)
    const yaw = this._yaw
    const sz = Math.max(1.6, Math.min(7, p.size * scale * (1 + p.sizeByLevel * m.level + p.sizeAmount * m.size * 0.5) * 0.6 + 1))
    // pass 1: class and depth, counts (positions are projected again in pass 2 straight from `out`)
    for (let s = 0; s < k; s++) {
      const o = s * 3
      const pr = VM.project(out[o], out[o + 1], out[o + 2], view, yaw, this._pr)
      const cls = nClass === 7 ? (mode === 'band' ? L.band[s] : Math.min(6, Math.floor(L.t[s] * 6.999))) : 0
      const dl = pr.d < -0.33 ? 0 : pr.d < 0.33 ? 1 : 2
      classOf[s] = cls; depthOf[s] = dl
      cnt[cls * 3 + dl]++
    }
    off[0] = 0
    for (let i = 0; i < 21; i++) off[i + 1] = off[i] + cnt[i]
    cnt.fill(0)
    for (let s = 0; s < k; s++) { const bk = classOf[s] * 3 + depthOf[s]; bucket[off[bk] + cnt[bk]++] = s }
    ctx.globalCompositeOperation = p.blend === 'additive' ? 'lighter' : 'source-over'
    const half = sz / 2
    for (let bk = 0; bk < 21; bk++) {
      const from = off[bk], to = off[bk + 1]
      if (to === from) continue
      ctx.fillStyle = css[Math.floor(bk / 3)]
      ctx.globalAlpha = (bk % 3 === 0 ? 0.35 : bk % 3 === 1 ? 0.6 : 0.9) * (0.35 + 0.65 * p.opacity)
      for (let i = from; i < to; i++) {
        const s = bucket[i], o = s * 3
        const pr = VM.project(out[o], out[o + 1], out[o + 2], view, yaw, this._pr)
        ctx.fillRect(cx + pr.x * scale - half, cy - pr.y * scale - half, sz, sz)
      }
    }
    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = 1
    ctx.restore()
    // band strip: live activity + what each band drives
    this._paintBands(ctx, { x: 0, y: H - stripH, w: W, h: stripH }, p, th)
    this.lastDraw = { view, drawn: k, total: L.n, live: !!live, mode, formation: p.formation, buckets: 21 }
  }

  _paintBands (ctx, r, p, th) {
    ctx.save()
    const n = 7, gap = 5, bw = (r.w - gap * (n + 1)) / n
    ctx.font = '8px "Courier New", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    for (let b = 0; b < n; b++) {
      const x = r.x + gap + b * (bw + gap)
      const mp = bandToMotion(BAND_IDS[b], p)
      ctx.globalAlpha = 0.14; ctx.fillStyle = th.text; ctx.fillRect(x, r.y + 2, bw, 8)
      ctx.globalAlpha = 0.95; ctx.fillStyle = `hsl(${VM.bandHue(b)}, 70%, 58%)`
      ctx.fillRect(x, r.y + 2, bw * Math.min(1, this._motion.env[b]), 8)
      ctx.globalAlpha = 0.7; ctx.fillStyle = th.text
      ctx.fillText(`${BAND_SHORT[b]} ${mp.gain > 0 ? TARGET_SHORT[mp.target] : '—'}`, x + bw / 2, r.y + 19)
    }
    ctx.restore()
  }
}
