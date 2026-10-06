/**
 * systems/OmniDimensionalAxes.js — thin hand-driven adapter around the OmniAxinator
 *
 * V160: the tunnel-building code moved out into the reusable component
 * systems/OmniAxinator.js. This module now only
 *   - instantiates ONE OmniAxinator (the "main" channel) with the built-in tunnels
 *     from data/OmniAxinatorData.js: the two hand tunnels the top-hand pads drive
 *       Conscious Hand (Δ)  world-fixed diagonal toward 2 o'clock, one-sided,
 *                           nodes = perspectives, relative (Υ) axis = scale degrees
 *       OmniHand (⟐)        toward 11 o'clock, one-sided, nodes = OmniProducts,
 *                           relative (Υ) axis = product tier
 *     plus X / Y / Z axis tunnels and the 2↔8 / 11↔5 clock diagonals (view only,
 *     default off, toggled from the ⟐OmniAxinator panel);
 *   - keeps the pad-facing API, persistence, readout HUD and events exactly as V159.
 *
 * Every hand position is still a STATE {primary, relative} (integer indices,
 * clamped, persisted to localStorage 'omni:dimension-axes-v2', announced via
 * `omni:dimension-state`). The camera is NEVER touched by this module.
 *
 * V160 visibility: the tunnels are shown ONLY while their hand's pad is open
 * (omni:pad-toggle / omni:pads-global / omni:pad-state), animated by the tunnel
 * itself. The old master toggle "Dimensional Axes Visible" now means "tunnels
 * follow the pads" (default ON). Per-tunnel checkboxes (⟐OmniAxinator panel) are
 * a manual override: shown = checkbox OR (pad open AND follow-pads). The readout
 * HUD is shown while at least one hand tunnel is visible.
 *
 * Content lives in data/OmniDimensionalAxesData.js and data/OmniAxinatorData.js.
 *
 * Events dispatched (window):
 *   omni:dimension-state         { hand, phase: 'init'|'travel'|'settle',
 *                                  primaryIndex, primaryPosition,
 *                                  relativeIndex, relativePosition,
 *                                  primaryCount, relativeCount,
 *                                  activeNode:{id,name,index},
 *                                  activeLevel:{id,name,index} }
 *                                'travel' fires when a step begins (values
 *                                are the destination), 'settle' when the
 *                                tween finishes.
 *   omni:dimension-axes-visible  { visible }   after the follow-pads flag changes
 *
 * Events consumed (window):
 *   omni:dimension-axes-visible-set  { visible }   follow-pads toggle
 *   omni:dimension-axes-reset  { hand? }            back to defaults (V163: optional single hand)
 *
 * Public API:
 *   axes.step(hand, 'left'|'right'|'up'|'down')   -> true if it moved
 *   axes.goTo(hand, primaryIndex, relativeIndex)
 *   axes.getState(hand)
 *   axes.setVisible(bool) / axes.isVisible()      (follow-pads flag)
 *   axes.reset(hand?)                             (markers back to the first node)
 *   axes.getAxinator()                            -> the OmniAxinator instance
 *
 * Follows the standard module contract (constructor / init / update / destroy).
 */

import OmniAxinator, { HOLD_REPEAT_MS } from './OmniAxinator.js'
import { buildDefaultTunnelDefs } from '../data/OmniAxinatorData.js'
import {
  CONSCIOUS_SYMBOL, OMNIHAND_SYMBOL, REL_AXIS_SYMBOL,
} from '../data/OmniDimensionalAxesData.js'

export { CONSCIOUS_SYMBOL, OMNIHAND_SYMBOL, REL_AXIS_SYMBOL, HOLD_REPEAT_MS }

// v2: V159 moved the axes to start at the origin; old saved positions (V158 centred the
// axis on the origin) would start the markers mid-tunnel, so they are not reused.
const STORE_KEY = 'omni:dimension-axes-v2'

const HAND_IDS = ['conscious', 'omnihand']

const STYLES = /* css */`
.omni-dim-readout {
  position        : fixed;
  top             : 56px;
  left            : 50%;
  transform       : translateX(-50%);
  z-index         : 40;
  pointer-events  : none;
  display         : flex;
  flex-direction  : column;
  gap             : 3px;
  padding         : 6px 10px;
  max-width       : 92vw;
  background      : var(--ttm-bg, rgba(8, 8, 12, 0.82));
  border          : 1px solid var(--ttm-border, rgba(255, 255, 255, 0.15));
  border-radius   : 8px;
  color           : var(--ttm-color, #ffffff);
  font-family     : 'Courier New', Courier, monospace;
  font-size       : 10px;
  letter-spacing  : 0.03em;
  white-space     : nowrap;
  overflow        : hidden;
  backdrop-filter : blur(10px);
  -webkit-backdrop-filter: blur(10px);
}
.omni-dim-readout[hidden] { display: none; }
.odr-row  { display: flex; gap: 8px; align-items: baseline; }
.odr-sym  { font-size: 12px; min-width: 14px; text-align: center; }
.odr-dim  { opacity: 0.6; }
.odr-name { font-weight: bold; }
.odr-idx  { opacity: 0.55; }
`

function injectStyles () {
  if (document.getElementById('omni-dim-axes-styles')) return
  const tag = document.createElement('style')
  tag.id = 'omni-dim-axes-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

function esc (s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
}

const hex = (n) => '#' + n.toString(16).padStart(6, '0')

export default class OmniDimensionalAxes {
  constructor (context) {
    this.ctx = context
    this._axinator = null
    this._readoutEl = null
    this._visible = true           // follow-pads flag (legacy name kept for the public API)
    this._onVisibleSet = (e) => this.setVisible(!!e.detail?.visible)
    this._onReset = (e) => this.reset(e?.detail?.hand)
    this._onTunnelVisible = () => this._applyVisibility()
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  init () {
    if (this._axinator) return   // base.addModule may call init() after a manual call
    injectStyles()
    const saved = this._load()
    this._visible = saved.visible !== false   // default ON (follow the pads)

    this._axinator = new OmniAxinator(this.ctx, {
      name: 'main',
      tunnels: buildDefaultTunnelDefs(),
      followPads: this._visible,
      states: saved.hands ?? {},
      onState: (d) => { if (d.phase === 'travel') this._renderReadout() },
      onStateChange: () => this._persist(),
    })
    this._axinator.init()

    this._buildReadout()
    this._renderReadout()
    this._applyVisibility()

    window.addEventListener('omni:dimension-axes-visible-set', this._onVisibleSet)
    window.addEventListener('omni:dimension-axes-reset', this._onReset)
    window.addEventListener('omni:axinator-tunnel-visible', this._onTunnelVisible)

    HAND_IDS.forEach(id => this._axinator.emitState(id, 'init'))
    console.log('⟐ OmniDimensionalAxes: initialized (OmniAxinator main channel).')
  }

  update (delta) {
    this._axinator?.update(delta)
  }

  destroy () {
    window.removeEventListener('omni:dimension-axes-visible-set', this._onVisibleSet)
    window.removeEventListener('omni:dimension-axes-reset', this._onReset)
    window.removeEventListener('omni:axinator-tunnel-visible', this._onTunnelVisible)
    this._axinator?.destroy()
    this._axinator = null
    this._readoutEl?.parentNode?.removeChild(this._readoutEl)
    this._readoutEl = null
  }

  onResize () {}

  // ── Public API ──────────────────────────────────────────────────────────────

  getAxinator () { return this._axinator }

  /** "Tunnels follow the pads" flag. */
  isVisible () { return this._visible }

  setVisible (visible) {
    visible = !!visible
    if (visible === this._visible) return
    this._visible = visible
    this._axinator?.setFollowPads(visible)
    this._applyVisibility()
    this._persist()
    window.dispatchEvent(new CustomEvent('omni:dimension-axes-visible', { detail: { visible } }))
  }

  getState (hand) {
    return this._axinator?.getState(hand) ?? null
  }

  /** Pad entry point. left/right = primary axis, up/down = relative axis. */
  step (hand, direction) {
    return this._axinator ? this._axinator.step(hand, direction) : false
  }

  goTo (hand, primaryIndex, relativeIndex) {
    this._axinator?.goTo(hand, primaryIndex, relativeIndex)
  }

  /** Back to the first node. V163: optional `hand` ('conscious'|'omnihand') resets
   *  just that marker (⟐OmniHands "Reset marker"); no argument resets both. */
  reset (hand) {
    if (!this._axinator) return
    ;(HAND_IDS.includes(hand) ? [hand] : HAND_IDS).forEach(id => {
      const d = this._axinator.getDefaultState(id)
      if (d) this._axinator.goTo(id, d.p, d.r)
    })
  }

  // ── Persistence ─────────────────────────────────────────────────────────────

  _load () {
    try {
      const raw = localStorage.getItem(STORE_KEY)
      const parsed = raw ? JSON.parse(raw) : null
      return parsed && typeof parsed === 'object' ? parsed : {}
    } catch (_) { return {} }
  }

  _persist () {
    try {
      const hands = {}
      HAND_IDS.forEach(id => {
        const s = this._axinator?.getState(id)
        if (s) hands[id] = { p: s.primaryIndex, r: s.relativeIndex }
      })
      localStorage.setItem(STORE_KEY, JSON.stringify({ visible: this._visible, hands }))
    } catch (_) {}
  }

  // ── Readout ─────────────────────────────────────────────────────────────────
  //
  // A small fixed HUD plate styled with the same --ttm-* variables the global
  // tooltip styling (utils/ToolTipSettings.js) already writes onto :root, so
  // it follows the user's tooltip colours instead of introducing a new scheme.
  // V160: shown while at least one hand tunnel is visible.

  _applyVisibility () {
    if (!this._readoutEl || !this._axinator) return
    this._readoutEl.hidden = !HAND_IDS.some(id => this._axinator.isTunnelVisible(id))
  }

  _buildReadout () {
    const shell = document.getElementById('omni-ui') ?? document.body
    const el = document.createElement('div')
    el.className = 'omni-dim-readout'
    el.setAttribute('role', 'status')
    el.setAttribute('aria-live', 'polite')
    shell.appendChild(el)
    this._readoutEl = el
  }

  _renderReadout () {
    if (!this._readoutEl || !this._axinator) return
    this._readoutEl.innerHTML = HAND_IDS.map(id => {
      const t = this._axinator.getTunnel(id)
      const node = t.def.nodes[t.state.p]
      const level = t.def.levels[t.state.r]
      const tip = [node.view, level.view].filter(Boolean).join(' / ')
      return `<div class="odr-row" title="${esc(tip)}">` +
        `<span class="odr-sym" style="color:${hex(t.def.color)}">${esc(t.def.symbol)}</span>` +
        `<span class="odr-dim">${esc(t.def.primaryTerm)}</span>` +
        `<span class="odr-name">${esc(node.name)}</span>` +
        `<span class="odr-idx">${t.state.p + 1}/${t.def.nodes.length}</span>` +
        `<span class="odr-dim">${esc(REL_AXIS_SYMBOL)} ${esc(t.def.relativeTerm)}</span>` +
        `<span class="odr-name">${esc(level.name)}</span>` +
        `<span class="odr-idx">${t.state.r + 1}/${t.def.levels.length}</span>` +
        `</div>`
    }).join('')
  }
}
