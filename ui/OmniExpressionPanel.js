/**
 * ui/OmniExpressionPanel.js (V195) — the OmniExpression panel (window-chrome class A, ui/OmniSettingsPanelBase.js + utils/OmniWindowChrome.js).
 *
 * OPENED: nav item 'OmniExpression' (also 'OmniExpressionPanel' / '⟐OmniExpressionPanel'; the old drawer panel keeps '⟐OmniExpression'), the window
 * event `omni:expression-open`, the ribbon button Expression (Home > Tools) and OmniStarLight.
 * FIRST LOOK (not maximized): JUST the keyboard — both hands together (ui/OmniExpressionKeyboard.js): LH block and RH block, black row + two
 * white rows each, labelled with the computer key and the note name; keys light up from the InputBus; octave readout per hand; sustain / bend /
 * mod lamps. Touch: several fingers = several notes. A Split button splits it into two windows (see below).
 * MAXIMIZED (window chrome maximize, event omni:window-maximized-changed): the 4-quadrant layout of the Start HUD (corner brackets, thin
 * perimeter line, split lines, glass panels): top-left, top-right, bottom-left, bottom-right. Every quadrant has a HEADER with a dropdown
 * (utils/OmniQuadrantRegistry.js listQuadrantContents(q)); DEFAULT_LAYOUT = dj / beatpad / keysL / keysR. The choice is saved
 * (`omni:expression-panel-v1`) and announced with `omni:quadrant-changed` { quadrant, id }. Contents are mounted with the registry's
 * mount(host, ctx) and destroyed on swap, on un-maximize and on close (no leaks). A content id that is not registered (OmniDJ / sequencer not
 * merged) shows a friendly placeholder, and is mounted as soon as it registers.
 * SPLIT / JOIN: Split closes the panel and opens TWO windows (left hand, right hand), each class A and independently movable; Join (button of
 * either window) merges them back. The state and the window positions are saved. On a phone (<= 700 px: bottom sheets) Split is not offered.
 * Registry contents registered by registerExpressionContents(): 'keysL', 'keysR', 'mixer' (+ 'beatpad' from ui/OmniBeatPad.js).
 */
import * as WindowManager from './WindowManager.js'
import OmniSettingsPanelBase, { PHONE_MAX } from './OmniSettingsPanelBase.js'
import * as Registry from '../utils/OmniQuadrantRegistry.js'
import * as M from '../utils/OmniExpressionPanelModel.js'
import { mountKeyboard } from './OmniExpressionKeyboard.js'
import { mountMixer } from './OmniExpressionMixer.js'
import { registerBeatPadContent } from './OmniBeatPad.js'

export const PANEL_ID = 'expressionpanel'
export const NAV_ITEMS = ['OmniExpression', 'OmniExpressionPanel', '⟐OmniExpressionPanel']
export const QUAD_NAMES = { tl: 'Top left', tr: 'Top right', bl: 'Bottom left', br: 'Bottom right' }

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const tip = (name, desc, key = '—') => `data-omni-tip="${esc(name)}" data-omni-tip-key="${esc(key)}" data-omni-tip-desc="${esc(desc)}"`
/** Height the dock stack takes at the bottom of the screen (--omni-dock-h, set by utils/OmniLayout.js), with a fallback. */
const dockClear = () => { try { return (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--omni-dock-h')) || 118) + 12 } catch (_) { return 130 } }
const isPhone = () => typeof window !== 'undefined' && window.innerWidth <= PHONE_MAX

// ── shared saved state ─────────────────────────────────────────────────────────────────────────────────────────────────────

let pstate = null
export function getPanelState () { if (!pstate) pstate = M.loadState(); return pstate }
export function savePanelState () { M.saveState(getPanelState()) }
export function _resetPanelState () { pstate = null }

/** Registers the contents this part owns. `registry` is injectable for tests. */
export function registerExpressionContents (registry = Registry) {
  const st = () => getPanelState()
  const keys = (defHand) => (host, ctx = {}) => {
    const hand = ctx.hand === 'L' || ctx.hand === 'R' ? ctx.hand : defHand
    return mountKeyboard(host, { hands: [hand], fill: ctx.maximized !== false, octave: st().octave, onOctave: (h, v) => { st().octave[h] = v; savePanelState() } })
  }
  registry.registerQuadrantContent('keysL', { label: 'Keyboard: left hand', order: 30, mount: keys('L') })
  registry.registerQuadrantContent('keysR', { label: 'Keyboard: right hand', order: 31, mount: keys('R') })
  registry.registerQuadrantContent('mixer', { label: 'Mixer (placeholder)', order: 40, mount: (host, ctx) => mountMixer(host, ctx, { state: st(), save: savePanelState }) })
  registerBeatPadContent(registry)
  return true
}

// ── styles ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

const STYLES = `
.oss-panel.xp-panel { width: 760px; max-width: calc(100vw - 16px); }
.oss-panel.xp-split { width: 400px; }
.xp-panel .oss-body, .xp-split .oss-body { padding: 0; overflow: hidden; display: flex; flex-direction: column; }
.xp-compact { flex: 1 1 auto; min-height: 0; padding: 8px 10px 10px; overflow: hidden; }
.xp-panel.win-maximized .xp-compact, .xp-panel.omni-win-max .xp-compact { display: none; }
.xp-hbtn { height: 24px; padding: 0 9px; border-radius: 5px; border: 1px solid var(--omni-theme-border, rgba(255,255,255,.14)); background: rgba(255,255,255,.05); color: inherit; font: inherit; cursor: pointer; touch-action: manipulation; }
.xp-hbtn:hover { background: rgba(255,255,255,.17); }
.xp-hud { position: relative; flex: 1 1 auto; min-height: 0; overflow: hidden; }
.xp-hud[hidden] { display: none; }
.xp-edge { position: absolute; background: rgba(255,255,255,.28); pointer-events: none; }
.xp-edge.t { top: 10px; left: 10px; right: 10px; height: 1px; } .xp-edge.b { bottom: 10px; left: 10px; right: 10px; height: 1px; }
.xp-edge.l { top: 10px; bottom: 10px; left: 10px; width: 1px; } .xp-edge.r { top: 10px; bottom: 10px; right: 10px; width: 1px; }
.xp-corner { position: absolute; width: 28px; height: 28px; pointer-events: none; filter: drop-shadow(0 0 5px rgba(255,255,255,.9)); }
.xp-corner::before, .xp-corner::after { content: ''; position: absolute; background: #fff; }
.xp-corner::before { width: 100%; height: 2px; } .xp-corner::after { width: 2px; height: 100%; }
.xp-corner.tl { top: 6px; left: 6px; } .xp-corner.tr { top: 6px; right: 6px; } .xp-corner.bl { bottom: 6px; left: 6px; } .xp-corner.br { bottom: 6px; right: 6px; }
.xp-corner.tr::before, .xp-corner.tr::after { right: 0; } .xp-corner.bl::before, .xp-corner.bl::after { bottom: 0; } .xp-corner.br::before, .xp-corner.br::after { right: 0; bottom: 0; }
.xp-line { position: absolute; background: #fff; box-shadow: 0 0 10px rgba(255,255,255,.9), 0 0 3px #fff; pointer-events: none; opacity: .9; }
.xp-line.h { left: 12px; right: 12px; top: 50%; height: 1px; transform: translateY(-50%); } .xp-line.v { top: 12px; bottom: 12px; left: 50%; width: 1px; transform: translateX(-50%); }
.xp-quads { position: absolute; inset: 22px; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); grid-template-rows: minmax(0, 1fr) minmax(0, 1fr); gap: 18px; }
.xp-q { position: relative; display: flex; flex-direction: column; min-width: 0; min-height: 0; overflow: hidden; background: rgba(255,255,255,.045); border: 1px solid rgba(255,255,255,.14); border-radius: 10px; -webkit-backdrop-filter: saturate(1.4); backdrop-filter: saturate(1.4); }
.xp-qh { flex: 0 0 auto; display: flex; align-items: center; gap: 6px; height: 28px; padding: 0 6px; background: rgba(255,255,255,.05); border-bottom: 1px solid rgba(255,255,255,.1); }
.xp-qsel { flex: 1 1 auto; min-width: 0; height: 22px; padding: 0 4px; font: inherit; color: inherit; border-radius: 5px; background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.18); }
.xp-qsel option { color: #111; background: #fff; }
.xp-qtag { font-size: 9px; opacity: .55; letter-spacing: .08em; text-transform: uppercase; white-space: nowrap; }
.xp-qb { position: relative; flex: 1 1 0; min-height: 0; }
.xp-qbi { position: absolute; inset: 0; overflow: auto; }
.xp-ph { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; padding: 10px; text-align: center; opacity: .72; font-size: 11px; }
.xp-ph b { font-size: 12px; }
@media (max-width: ${PHONE_MAX}px) {
  .oss-panel.xp-panel.xp-panel, .oss-panel.xp-split.xp-split { max-width: 100vw; }
  .oss-panel.xp-panel.xp-panel { max-height: 64vh; }
  .xp-qh { height: 42px; }
  .oss-panel.xp-panel.xp-panel.win-maximized, .oss-panel.xp-panel.xp-panel.omni-win-max { max-height: none; }
  .xp-quads { position: absolute; inset: 14px; overflow-y: auto; grid-template-columns: minmax(0, 1fr); grid-template-rows: none; grid-auto-rows: minmax(300px, auto); gap: 12px; }
  .xp-line, .xp-edge { display: none; }
  .xp-hbtn, .xp-qsel { min-height: 32px; }
  .xp-split-btn { display: none; }
}
`
function injectStyles () {
  if (typeof document === 'undefined' || document.getElementById('xp-styles')) return
  const s = document.createElement('style'); s.id = 'xp-styles'; s.textContent = STYLES; document.head.appendChild(s)
}

// ── the quadrants ──────────────────────────────────────────────────────────────────────────────────────────────────────────

export class QuadrantHost {
  constructor (root, { registry = Registry, getLayout, setLayout, onChange } = {}) {
    this.root = root; this.registry = registry
    this.getLayout = getLayout; this.setLayout = setLayout; this.onChange = onChange
    this.handles = {}; this.hosts = {}; this.selects = {}
    this.destroyed = false
    this._build()
    this._unsub = registry.subscribeQuadrantRegistry(() => this._registryChanged())
    for (const q of M.QUADS) this.mount(q)
  }
  _build () {
    this.root.innerHTML = `<i class="xp-edge t"></i><i class="xp-edge b"></i><i class="xp-edge l"></i><i class="xp-edge r"></i>
      <i class="xp-corner tl"></i><i class="xp-corner tr"></i><i class="xp-corner bl"></i><i class="xp-corner br"></i>
      <i class="xp-line h"></i><i class="xp-line v"></i>
      <div class="xp-quads">${M.QUADS.map(q => `<section class="xp-q" data-q="${q}" aria-label="${QUAD_NAMES[q]} quadrant">
        <div class="xp-qh"><select class="xp-qsel" data-q="${q}" aria-label="${QUAD_NAMES[q]}: what to show" ${tip(QUAD_NAMES[q] + ' quadrant', 'Choose what this quadrant shows. The choice is remembered.')}></select><span class="xp-qtag">${q}</span></div>
        <div class="xp-qb"><div class="xp-qbi" data-r="host"></div></div></section>`).join('')}</div>`
    for (const q of M.QUADS) {
      const sec = this.root.querySelector(`.xp-q[data-q="${q}"]`)
      this.hosts[q] = sec.querySelector('[data-r="host"]'); this.selects[q] = sec.querySelector('select')
      this.selects[q].addEventListener('change', () => this.change(q, this.selects[q].value))
      this.fillSelect(q)
    }
  }
  fillSelect (q) {
    const cur = this.getLayout()[q], list = this.registry.listQuadrantContents(q)
    const opts = list.map(c => `<option value="${esc(c.id)}">${esc(c.label)}</option>`)
    if (!list.some(c => c.id === cur)) opts.unshift(`<option value="${esc(cur)}">${esc(cur)} (not available yet)</option>`)
    this.selects[q].innerHTML = opts.join(''); this.selects[q].value = cur
  }
  mount (q) {
    this.unmount(q)
    const id = this.getLayout()[q], host = this.hosts[q], def = this.registry.getQuadrantContent(id)
    host.textContent = ''
    if (!def) { this.placeholder(host, id, 'is not available in this build yet. Pick another content in the dropdown; it appears here by itself as soon as it exists.'); return }
    try {
      const h = def.mount(host, { quadrant: q, maximized: true, hand: id === 'keysL' ? 'L' : id === 'keysR' ? 'R' : undefined })
      this.handles[q] = h && typeof h === 'object' ? h : { destroy () {} }
      this.handles[q].__id = id
    } catch (err) {
      host.textContent = ''; this.placeholder(host, id, 'could not start (' + String(err && err.message || err).slice(0, 80) + ').')
    }
  }
  unmount (q) {
    const h = this.handles[q]; delete this.handles[q]
    if (h && typeof h.destroy === 'function') { try { h.destroy() } catch (_) { /* a broken content never blocks the panel */ } }
    if (this.hosts[q]) this.hosts[q].textContent = ''
  }
  placeholder (host, id, msg) {
    const d = document.createElement('div'); d.className = 'xp-ph'; d.dataset.placeholder = id
    d.innerHTML = `<b>${esc(id)}</b><span>${esc(msg)}</span>`; host.appendChild(d)
  }
  change (q, id) {
    if (!M.QUADS.includes(q) || typeof id !== 'string') return false
    const lay = this.getLayout(); if (lay[q] === id) return false
    this.setLayout(q, id); this.mount(q); this.fillSelect(q)
    try { window.dispatchEvent(new CustomEvent('omni:quadrant-changed', { detail: { quadrant: q, id } })) } catch (_) { /* no window */ }
    return true
  }
  _registryChanged () {
    if (this.destroyed) return
    for (const q of M.QUADS) {
      this.fillSelect(q)
      const id = this.getLayout()[q], h = this.handles[q], def = this.registry.getQuadrantContent(id)
      if (!h && def) this.mount(q)                       // it registered after the panel opened
    }
  }
  onResize () { for (const h of Object.values(this.handles)) { try { h.onResize?.() } catch (_) { /* ignore */ } } }
  liveCount () { return Object.keys(this.handles).length }
  destroy () {
    if (this.destroyed) return
    this.destroyed = true
    this._unsub?.()
    for (const q of M.QUADS) this.unmount(q)
    this.root.textContent = ''
  }
}

// ── one hand in its own window (after Split) ───────────────────────────────────────────────────────────────────────────────

class KeysWindow extends OmniSettingsPanelBase {
  constructor (hand, owner) {
    super({ id: `${PANEL_ID}-${hand.toLowerCase()}`, label: `OmniExpression: ${M.HAND_NAME[hand].toLowerCase()}`, iconLabel: '⟐X' + hand, navItems: [], className: 'xp-split' })
    this.hand = hand; this.owner = owner; this._kb = null
  }
  buildBody (body) {
    const head = body.parentNode.querySelector('.oss-header')
    const b = document.createElement('button'); b.type = 'button'; b.className = 'xp-hbtn'; b.dataset.ctl = 'join'; b.textContent = 'Join'
    b.setAttribute('aria-label', 'Join the two keyboards'); b.setAttribute('data-omni-tip', 'Join'); b.setAttribute('data-omni-tip-key', '—'); b.setAttribute('data-omni-tip-desc', 'Puts the two hands back into one OmniExpression window.')
    b.addEventListener('click', () => this.owner.join())
    head.insertBefore(b, head.querySelector('.oss-ctrl'))
    const host = document.createElement('div'); host.className = 'xp-compact'; host.dataset.r = 'host'; body.appendChild(host)
  }
  onOpened () {
    if (!this._kb) {
      const st = getPanelState()
      this._kb = mountKeyboard(this._el.querySelector('[data-r="host"]'), { hands: [this.hand], octave: st.octave, onOctave: (h, v) => { st.octave[h] = v; savePanelState() } })
    }
    if (window.innerWidth > PHONE_MAX && this._el.dataset.moved !== '1') this._place()   // content now has its height
  }
  close () { this._kb?.destroy(); this._kb = null; super.close() }
  onDestroy () { this._kb?.destroy(); this._kb = null }
  _place () {
    const saved = getPanelState().pos[this.hand]
    const w = this._el.offsetWidth || 400
    const h = this._el.offsetHeight || 300
    const left = saved ? saved.left : (this.hand === 'L' ? Math.max(12, window.innerWidth / 2 - w - 12) : Math.min(window.innerWidth - w - 12, window.innerWidth / 2 + 12))
    const top = saved ? saved.top : Math.max(60, window.innerHeight - h - dockClear())
    this._el.style.left = Math.max(0, Math.min(window.innerWidth - 60, left)) + 'px'
    this._el.style.top = Math.max(0, Math.min(window.innerHeight - 40, top)) + 'px'
  }
  position () { if (!this._el || !this._isOpen) return null; const r = this._el.getBoundingClientRect(); return { left: Math.round(r.left), top: Math.round(r.top) } }
}

// ── the panel ──────────────────────────────────────────────────────────────────────────────────────────────────────────────

export default class OmniExpressionPanel extends OmniSettingsPanelBase {
  constructor (opts = {}) {
    super({ id: PANEL_ID, label: 'OmniExpression', iconLabel: '⟐X', navItems: NAV_ITEMS, className: 'xp-panel' })
    this.registry = opts.registry || Registry
    this._kb = null; this._quads = null; this._maxed = false; this._h = {}
    this._split = { L: new KeysWindow('L', this), R: new KeysWindow('R', this) }
  }
  get state () { return getPanelState() }
  get isSplit () { return this.state.split === true }
  get quadrants () { return this._quads }

  onInit () {
    injectStyles()
    this._h.open = () => this.open()
    this._h.max = (e) => { if (e.detail?.id === PANEL_ID) { this._maxed = !!e.detail.maximized; if (this._isOpen) this._render() } }
    this._h.res = (e) => { if (e.detail?.id === PANEL_ID && this._quads) this._quads.onResize() }
    this._h.up = () => this._savePositions()
    window.addEventListener('omni:expression-open', this._h.open)
    window.addEventListener('omni:window-maximized-changed', this._h.max)
    window.addEventListener('omni:window-resized', this._h.res)
    window.addEventListener('mouseup', this._h.up); window.addEventListener('touchend', this._h.up)
    this._split.L.init(); this._split.R.init()
  }
  onDestroy () {
    window.removeEventListener('omni:expression-open', this._h.open)
    window.removeEventListener('omni:window-maximized-changed', this._h.max)
    window.removeEventListener('omni:window-resized', this._h.res)
    window.removeEventListener('mouseup', this._h.up); window.removeEventListener('touchend', this._h.up)
    this._teardown()
    this._split.L.destroy(); this._split.R.destroy()
  }

  buildBody (body) {
    const head = body.parentNode.querySelector('.oss-header')
    const b = document.createElement('button'); b.type = 'button'; b.className = 'xp-hbtn xp-split-btn'; b.dataset.ctl = 'split'; b.textContent = 'Split'
    b.setAttribute('aria-label', 'Split the keyboard into two windows')
    b.setAttribute('data-omni-tip', 'Split'); b.setAttribute('data-omni-tip-key', '—'); b.setAttribute('data-omni-tip-desc', 'Splits the keyboard into two windows, one per hand, that you can move apart. Join puts them back.')
    b.addEventListener('click', () => this.splitKeys())
    head.insertBefore(b, head.querySelector('.oss-ctrl'))
    this._splitBtn = b
    body.innerHTML = '<div class="xp-compact" data-r="compact"></div><div class="xp-hud" data-r="hud" hidden></div>'
  }

  /** Open: split state -> the two hand windows, otherwise this window. */
  open () {
    if (this.isSplit && !isPhone()) { this._openSplit(); return }
    if (this.isSplit && isPhone()) { this.state.split = false; savePanelState() }
    super.open()
  }
  _openSplit () {
    if (this._isOpen) this.close()
    this._split.L.open(); this._split.R.open()
  }
  onOpened () {
    this._maxed = WindowManager.isMaximized(PANEL_ID)
    this._render()
    // the base places the window BEFORE the content exists (height unknown): place it again now that the keyboard is mounted
    if (!this._maxed && window.innerWidth > PHONE_MAX && this._el.dataset.moved !== '1') this._place()
  }
  refresh () { /* the content is mounted in onOpened */ }

  /** The one place that decides what is mounted: maximized -> quadrants; otherwise the keyboard. Always tears the other down first. */
  _render () {
    if (!this._el) return
    const compact = this._el.querySelector('[data-r="compact"]'), hud = this._el.querySelector('[data-r="hud"]')
    if (this._maxed) {
      this._kb?.destroy(); this._kb = null; compact.textContent = ''
      hud.hidden = false
      if (!this._quads) this._quads = new QuadrantHost(hud, { registry: this.registry, getLayout: () => this.state.layout, setLayout: (q, id) => { this.state.layout[q] = id; savePanelState() } })
      this._splitBtn.style.display = 'none'
    } else {
      this._quads?.destroy(); this._quads = null; hud.hidden = true; hud.textContent = ''
      this._splitBtn.style.display = ''
      if (!this._kb) {
        this._kb = mountKeyboard(compact, { hands: ['L', 'R'], octave: this.state.octave, onOctave: (h, v) => { this.state.octave[h] = v; savePanelState() } })
      }
    }
  }
  /** Desktop: centred above the dock, low on the screen (the keyboard is played with the hands near the bottom). */
  _place () {
    const w = this._el.offsetWidth || 760, h = this._el.offsetHeight || 320
    const top = Math.max(60, window.innerHeight - h - dockClear())
    this._el.style.top = top + 'px'
    this._el.style.left = Math.max(8, Math.round((window.innerWidth - w) / 2)) + 'px'
  }
  _teardown () { this._kb?.destroy(); this._kb = null; this._quads?.destroy(); this._quads = null }
  close () { this._teardown(); super.close() }
  onResize () { this._quads?.onResize() }

  splitKeys () {
    if (isPhone()) return false
    this.state.split = true; savePanelState()
    this.close()
    this._split.L.open(); this._split.R.open()
    return true
  }
  join () {
    this._savePositions()
    this.state.split = false; savePanelState()
    this._split.L.close(); this._split.R.close()
    this.open()
    return true
  }
  _savePositions () {
    if (!this.isSplit) return
    let changed = false
    for (const h of ['L', 'R']) {
      const p = this._split[h].position(); const o = this.state.pos[h]
      if (p && (!o || o.left !== p.left || o.top !== p.top)) { this.state.pos[h] = p; changed = true }
    }
    if (changed) savePanelState()
  }
  get splitWindows () { return this._split }
}
