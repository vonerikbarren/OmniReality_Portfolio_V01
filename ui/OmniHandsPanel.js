/**
 * ui/OmniHandsPanel.js — ⟐OmniHands (V163): one settings panel for the four hands.
 *
 * Opened from the ⟐mniMenu drawer sub-menu (ui/Drawer.js LEFT_ITEMS):
 *   ⟐LogicalHand   -> lh         bottom-left   Process
 *   ⟐CreativeHand  -> rh         bottom-right  Object
 *   ⟐ConsciousHand -> conscious  top-right     VisualStates
 *   ⟐OmniHand      -> omnihand   top-left      MetaStates
 * (ids / storage keys keep their old names; the product names are display only.)
 *
 * The panel has a 4-button hand switcher; opening a child opens the panel on that
 * hand's view. Only REAL, wired settings are shown:
 *
 *   all four        Show pad on start       utils/OmniHandsSettings.js  padOnStart (applied in main.js)
 *                   Pad docked / detached   omni:pad-detach-state  /  omni:pad-redock {hand}  (ui/MovementPad.js)
 *                   Reset this hand's settings (not the marker position or the pad dock state)
 *   all four (V165) Speed  1x..25x slider  -> utils/OmniHandsSettings.js `speed` (the SAME value as the
 *                   pad's » Speed popover, ui/HandSpeedPanel.js; systems follow the eased value in
 *                   utils/OmniHandSpeed.js). The V163 "Dash multiplier" row was removed (Dash is gone).
 *   lh, rh (V165)   Ammo: the magazine (checkbox grid of all 34 behaviours by class, Load all / Clear /
 *                   Reset to default), the CURRENT ammo, max simultaneous, anchor mode / count, and
 *                   Release all (omni:hand-ammo-release-all). The default split is a PROPOSAL.
 *                   Lifecycle: omni:hands-panel-state {open, hand} on every open/close/minimize/tab
 *                   change; omni:hands-panel-close closes it (the pad's ⚙ settings button toggles it).
 *   lh, rh (V168)   Fire (the pad's CENTRE button, systems/OmniFlowFire.js): lh = element kind, chain on/off + End
 *                   chain, fire distance (HUD-centre point), max alive, Remove all fired elements, master toggle;
 *                   rh = payload library (current ammo, open the payload panel), default word delay, fire distance,
 *                   max alive, Remove all. Activation (behaviours) is separate and unchanged.
 *   lh              px / py / pz step   -> 'omni:admin:settings' (the SAME store
 *                   ui/CameraMovementOptionsPanel.js edits; dispatches omni:admin-settings-saved)
 *   rh              altitude-up / -down + vertical / horizontal orbit speed -> same admin store
 *   conscious,      tunnel pin (omni:axinator-tunnel-visible-set), tunnels-follow-pads (shared master,
 *   omnihand        omni:dimension-axes-visible-set), step travel / relative-axis duration, hold-repeat
 *                   interval, clock hour (live re-aim), OmniHand stagger, Reset marker
 *                   (omni:dimension-axes-reset {hand}), live position readout (omni:dimension-state)
 *
 * Standard module contract: constructor / init / update / destroy / onResize.
 * Window: WindowManager id 'omnihands'; minimize -> omni:panel-minimized; restore via
 * omni:panel-restore { id: 'omnihands' }.
 */

import gsap from 'gsap'
import * as WindowManager from './WindowManager.js'
import {
  getHandSettings, getHandSetting, setHandSetting, resetHand, getDefault, LIMITS, ENUMS, CHANGE_EVENT,
} from '../utils/OmniHandsSettings.js'
import { listPayloads, getCurrentId, setCurrentPayload, CHANGED_EVENT as PAYLOAD_CHANGED, CURRENT_EVENT as PAYLOAD_CURRENT } from '../utils/OmniPayloads.js'
import { BEHAVIOR_TABLE, BEHAVIOR_CLASSES } from '../systems/OmniNodeBehavior.js'
import { formatSpeed, SPEED_PRESETS } from './HandSpeedPanel.js'

export const NAV_TO_HAND = {
  '⟐LogicalHand':   'lh',
  '⟐CreativeHand':  'rh',
  '⟐ConsciousHand': 'conscious',
  '⟐OmniHand':      'omnihand',
}

export const HAND_META = {
  lh:        { product: '⟐LogicalHand',   corner: 'bottom-left',  role: 'Process',      keys: 'W A S D' },
  rh:        { product: '⟐CreativeHand',  corner: 'bottom-right', role: 'Object',        keys: 'R / F altitude, ← → yaw (arrow keys)' },
  conscious: { product: '⟐ConsciousHand', corner: 'top-right',    role: 'VisualStates', keys: 'Numpad 5 / 6 primary axis, 7 / 9 scale (Υ)' },
  omnihand:  { product: '⟐OmniHand',      corner: 'top-left',     role: 'MetaStates',   keys: 'Numpad − / + primary axis, / and * tier (Υ)' },
}
const ORDER = ['lh', 'rh', 'conscious', 'omnihand']
const SYMBOL = { conscious: 'Δ', omnihand: '⟐', lh: 'Λ', rh: 'Ψ' }   // V166: lh / rh tunnel symbols (data/OmniDimensionalAxesData.js)

const ADMIN_KEY = 'omni:admin:settings'
const ADMIN_STEP_DEFAULTS = { px: 1, py: 1, pz: 1, altitudeUp: 1, altitudeDown: 1, orbitVertical: 1, orbitHorizontal: 1, globalSpeed: false, globalValue: 1 }

const NOTES = {
  lh: 'Not configurable yet: the ⦿ Orbiter is undefined on all four hands (DeveloperQueue item 38); the ⬢ radial page ⟐1 (flowchart element kinds) is real, page ⟐2 is a static placeholder set; WASD key bindings are fixed. The step values are the same as ⟐CameraMovementOptions, edited in either place. Speed (V165) composes with them: effective = step (or Global override) × Speed. The default magazine split (logic side here, expressive side on CreativeHand) is a proposal, not a decided taxonomy.',
  rh: 'Not configurable yet: the ⦿ Orbiter is undefined on all four hands (DeveloperQueue item 38); the ⬢ radial page ⟐1 (DataTypes / Color / Texture / Material) is real, page ⟐2 is a static placeholder set; key bindings are fixed. Speeds are the same values as ⟐CameraMovementOptions, edited in either place. Speed (V165) composes with them: effective = step (or Global override) × Speed. The default magazine split is a proposal, not a decided taxonomy.',
  conscious: 'Not configurable yet: the ⦿ Orbiter is undefined on all four hands (DeveloperQueue item 38); the ⬢ radial tool list is a static placeholder set; perspectives / scale degrees are placeholder data (data/OmniDimensionalAxesData.js); key bindings are fixed.',
  omnihand: 'Not configurable yet: the ⦿ Orbiter is undefined on all four hands (DeveloperQueue item 38); the ⬢ radial tool list is a static placeholder set; the product / tier lists are data (data/OmniDimensionalAxesData.js); key bindings are fixed.',
}

const STYLES = `
.omni-hands-panel {
  pointer-events   : auto;
  --omh-bg         : var(--omni-theme-bg, rgba(8, 8, 12, 0.92));
  --omh-border     : var(--omni-theme-border, rgba(255, 255, 255, 0.09));
  --omh-header-bg  : var(--omni-theme-header-bg, rgba(255, 255, 255, 0.03));
  --omh-text       : var(--omni-theme-text, rgba(255, 255, 255, 0.92));
  --omh-text-dim   : var(--omni-theme-text-dim, rgba(255, 255, 255, 0.65));
  --mono           : 'Courier New', Courier, monospace;
  position         : fixed;
  top              : 110px;
  left             : 180px;
  width            : 330px;
  min-width        : 280px;
  max-height       : 84vh;
  display          : flex;
  flex-direction   : column;
  background       : var(--omh-bg);
  backdrop-filter  : blur(20px) saturate(1.5);
  -webkit-backdrop-filter: blur(20px) saturate(1.5);
  border           : 1px solid var(--omh-border);
  border-radius    : 12px;
  box-shadow       : 0 0 20px rgba(0,0,0,0.4), 0 10px 30px rgba(0,0,0,0.5);
  font-family      : var(--mono);
  z-index          : 60;
  overflow         : hidden;
  opacity          : 0;
  visibility       : hidden;
}
.omh-header {
  height: 38px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;
  background: var(--omh-header-bg); border-bottom: 1px solid var(--omh-border);
  cursor: grab; user-select: none; position: relative;
}
.omh-title { font-size: 11px; letter-spacing: 0.05em; color: var(--omh-text-dim); }
.omh-controls { position: absolute; right: 8px; display: flex; gap: 4px; }
.omh-ctrl {
  width: 20px; height: 20px; border-radius: 5px; border: 1px solid var(--omh-border);
  background: rgba(255,255,255,0.04); color: var(--omh-text-dim); font-size: 11px;
  display: flex; align-items: center; justify-content: center; cursor: pointer;
}
.omh-ctrl:hover { background: rgba(255,255,255,0.1); color: var(--omh-text); }
.omh-switch { display: grid; grid-template-columns: 1fr 1fr; gap: 5px; padding: 10px 14px 0; }
.omh-tab {
  background: rgba(255,255,255,0.04); border: 1px solid var(--omh-border); color: var(--omh-text-dim);
  border-radius: 6px; padding: 6px 4px; font-family: var(--mono); font-size: 9.5px; cursor: pointer;
}
.omh-tab:hover { background: rgba(255,255,255,0.09); color: var(--omh-text); }
.omh-tab.is-active {
  background: rgba(var(--omni-color-accent-blue-rgb, 80, 140, 255), 0.25);
  border-color: rgba(var(--omni-color-accent-blue-rgb, 80, 140, 255), 0.6); color: var(--omh-text);
}
.omh-body { padding: 10px 14px 14px; display: flex; flex-direction: column; gap: 10px; overflow-y: auto; }
.omh-hand-title { font-size: 11px; color: var(--omh-text); line-height: 1.4; }
.omh-hand-sub { font-size: 9px; color: var(--omh-text-dim); }
.omh-group-title {
  font-size: 9px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--omh-text-dim);
  border-bottom: 1px solid var(--omh-border); padding-bottom: 3px; margin-top: 4px;
}
.omh-group { display: flex; flex-direction: column; gap: 7px; }
.omh-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: 10px; color: var(--omh-text); }
.omh-row-label { flex: 1; }
.omh-num {
  width: 70px; background: rgba(255,255,255,0.06); border: 1px solid var(--omh-border); color: var(--omh-text);
  border-radius: 5px; padding: 3px 5px; font-family: var(--mono); font-size: 10px;
}
.omh-num:disabled { opacity: 0.4; }
.omh-unit { font-size: 9px; color: var(--omh-text-dim); min-width: 16px; }
.omh-toggle { position: relative; width: 34px; height: 18px; flex-shrink: 0; }
.omh-toggle input { position: absolute; inset: 0; opacity: 0; margin: 0; cursor: pointer; }
.omh-toggle-track {
  position: absolute; inset: 0; border-radius: 999px;
  background: rgba(255,255,255,0.14); border: 1px solid rgba(255,255,255,0.18); transition: background 0.15s;
}
.omh-toggle input:checked + .omh-toggle-track { background: rgba(var(--omni-color-accent-blue-rgb, 80, 140, 255), 0.55); border-color: rgba(var(--omni-color-accent-blue-rgb, 80, 140, 255), 0.7); }
.omh-toggle-track::after {
  content: ''; position: absolute; top: 1px; left: 1px; width: 14px; height: 14px;
  border-radius: 50%; background: #fff; transition: transform 0.15s;
}
.omh-toggle input:checked + .omh-toggle-track::after { transform: translateX(16px); }
.omh-btn {
  background: rgba(140, 255, 180, 0.1); border: 1px solid rgba(140, 255, 180, 0.3);
  color: rgba(160, 255, 195, 0.95); border-radius: 6px; padding: 6px 10px;
  font-family: var(--mono); font-size: 9.5px; cursor: pointer; text-align: center;
}
.omh-btn:hover:not(:disabled) { background: rgba(140, 255, 180, 0.18); }
.omh-btn:disabled { opacity: 0.4; cursor: default; }
.omh-btn--reset { background: rgba(255, 140, 140, 0.1); border-color: rgba(255, 140, 140, 0.3); color: rgba(255, 175, 175, 0.95); }
.omh-readout { font-size: 9.5px; color: var(--omh-text); }
.omh-note { font-size: 9px; color: var(--omh-text-dim); opacity: 0.8; line-height: 1.5; }
`

function injectStyles () {
  if (document.getElementById('omh-styles')) return
  const tag = document.createElement('style')
  tag.id = 'omh-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

// ── Admin-store bridge (LogicalHand / CreativeHand speeds) ────────────────────

function readAdmin () {
  try {
    const raw = localStorage.getItem(ADMIN_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch (_) { return {} }
}

function adminValue (key) {
  const s = readAdmin()
  const v = Number((s.steps ?? {})[key])
  return Number.isFinite(v) && v > 0 ? v : ADMIN_STEP_DEFAULTS[key]
}

/** Same read-merge-write + event as ui/CameraMovementOptionsPanel.js _save(). */
function writeAdmin (patch) {
  const current = readAdmin()
  const merged = {
    ...current,
    steps: { ...ADMIN_STEP_DEFAULTS, ...(current.steps ?? {}), ...patch },
  }
  try { localStorage.setItem(ADMIN_KEY, JSON.stringify(merged)) } catch (_) {}
  window.dispatchEvent(new CustomEvent('omni:admin-settings-saved', { detail: merged }))
}

function readDetached (hand) {
  try {
    const data = JSON.parse(localStorage.getItem('omni:movementpad:detach') ?? 'null')
    return !!data?.[hand]?.detached
  } catch (_) { return false }
}

function el (tag, cls, text) {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (text !== undefined) e.textContent = text
  return e
}

export default class OmniHandsPanel {
  constructor () {
    this._el = null
    this._isOpen = false
    this._hand = 'lh'
    this._sync = []                 // refreshers for the current view
    this._tunnels = new Map()       // id -> axinator summary
    this._followPads = true
    this._axisState = {}            // hand -> last omni:dimension-state detail
    this._detached = {}             // hand -> bool
    this._ammo = {}                 // hand -> last omni:hand-ammo-state detail
    this._flow = {}                 // hand -> last omni:flow-state detail (V168)
    this._flowOn = true             // omni:flow-fire-master-changed
    try { this._flowOn = localStorage.getItem('omni:flow-fire-master-v1') !== '0' } catch (_) {}
    ORDER.forEach(h => { this._detached[h] = readDetached(h) })
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  init () {
    injectStyles()
    this._onNavSelect = (e) => {
      const hand = NAV_TO_HAND[e.detail?.item]
      if (hand) this.open(hand)
    }
    this._onRestore = (e) => { if (e.detail?.id === 'omnihands') this.open() }
    this._onList = (e) => {
      const d = e.detail ?? {}
      if (typeof d.followPads === 'boolean') this._followPads = d.followPads
      ;(d.tunnels ?? []).forEach(t => this._tunnels.set(t.id, t))
      this._refresh()
    }
    this._onTunnelVisible = (e) => {
      const d = e.detail ?? {}
      if (!d.id) return
      this._tunnels.set(d.id, { ...(this._tunnels.get(d.id) ?? {}), ...d })
      this._refresh()
    }
    this._onFollow = (e) => { this._followPads = !!e.detail?.visible; this._refresh() }
    this._onDimState = (e) => {
      const d = e.detail
      if (d?.hand) { this._axisState[d.hand] = d; this._refresh() }
    }
    this._onDetach = (e) => {
      const { hand, detached } = e.detail ?? {}
      if (hand) { this._detached[hand] = !!detached; this._refresh() }
    }
    this._onSetting = () => this._refresh()
    this._onAmmoState = (e) => { const d = e.detail; if (d?.hand) { this._ammo[d.hand] = d; this._refresh() } }
    this._onFlowState = (e) => { const d = e.detail; if (d?.hand) { this._flow[d.hand] = d; this._refresh() } }
    this._onFlowMaster = (e) => { this._flowOn = !!e.detail?.enabled; this._refresh() }
    this._onClose = () => this.close()
    this._onAdminSaved = () => this._refresh()
    window.addEventListener('omni:nav-select', this._onNavSelect)
    window.addEventListener('omni:hand-ammo-state', this._onAmmoState)
    window.addEventListener('omni:flow-state', this._onFlowState)
    window.addEventListener('omni:flow-fire-master-changed', this._onFlowMaster)
    window.addEventListener(PAYLOAD_CHANGED, this._onSetting)
    window.addEventListener(PAYLOAD_CURRENT, this._onSetting)
    window.addEventListener('omni:hands-panel-close', this._onClose)
    window.addEventListener('omni:panel-restore', this._onRestore)
    window.addEventListener('omni:axinator-list', this._onList)
    window.addEventListener('omni:axinator-tunnel-visible', this._onTunnelVisible)
    window.addEventListener('omni:dimension-axes-visible', this._onFollow)
    window.addEventListener('omni:dimension-state', this._onDimState)
    window.addEventListener('omni:pad-detach-state', this._onDetach)
    window.addEventListener(CHANGE_EVENT, this._onSetting)
    window.addEventListener('omni:admin-settings-saved', this._onAdminSaved)
  }

  update () {}
  onResize () {}

  destroy () {
    window.removeEventListener('omni:nav-select', this._onNavSelect)
    window.removeEventListener('omni:hand-ammo-state', this._onAmmoState)
    window.removeEventListener('omni:flow-state', this._onFlowState)
    window.removeEventListener('omni:flow-fire-master-changed', this._onFlowMaster)
    window.removeEventListener(PAYLOAD_CHANGED, this._onSetting)
    window.removeEventListener(PAYLOAD_CURRENT, this._onSetting)
    window.removeEventListener('omni:hands-panel-close', this._onClose)
    window.removeEventListener('omni:panel-restore', this._onRestore)
    window.removeEventListener('omni:axinator-list', this._onList)
    window.removeEventListener('omni:axinator-tunnel-visible', this._onTunnelVisible)
    window.removeEventListener('omni:dimension-axes-visible', this._onFollow)
    window.removeEventListener('omni:dimension-state', this._onDimState)
    window.removeEventListener('omni:pad-detach-state', this._onDetach)
    window.removeEventListener(CHANGE_EVENT, this._onSetting)
    window.removeEventListener('omni:admin-settings-saved', this._onAdminSaved)
    this._unbindHeader?.()
    this._el?.parentNode?.removeChild(this._el)
    WindowManager.unregister('omnihands')
  }

  // ── Open / close / minimize ─────────────────────────────────────────────────

  /** @param {string} [hand] 'lh'|'rh'|'conscious'|'omnihand' — omitted keeps the current hand. */
  open (hand) {
    if (!this._el) this._el = this._buildDOM()
    if (hand && HAND_META[hand]) this._hand = hand
    const shell = document.getElementById('omni-ui') ?? document.body
    if (!this._el.parentNode) shell.appendChild(this._el)
    this._renderView()
    gsap.killTweensOf(this._el)   // a pending close/minimize must not hide a re-open
    this._el.style.visibility = 'visible'
    gsap.to(this._el, { opacity: WindowManager.getPanelOpacity(), scale: 1, duration: 0.25 })
    this._isOpen = true
    WindowManager.bringToFront('omnihands', false)
    window.dispatchEvent(new CustomEvent('omni:axinator-list-request'))
    window.dispatchEvent(new CustomEvent('omni:hand-ammo-request'))
    window.dispatchEvent(new CustomEvent('omni:flow-state-request'))
    this._emitState()
  }

  close () {
    if (!this._el) return
    gsap.to(this._el, { opacity: 0, duration: 0.18, onComplete: () => { this._el.style.visibility = 'hidden' } })
    this._isOpen = false
    this._emitState()
  }

  /** V165: announced so the pad's ⚙ settings satellite can light up / toggle this panel. */
  _emitState () {
    window.dispatchEvent(new CustomEvent('omni:hands-panel-state', { detail: { open: this._isOpen, hand: this._hand } }))
  }

  minimize () {
    if (!this._el) return
    const rect = this._el.getBoundingClientRect()
    gsap.to(this._el, { opacity: 0, scale: 0.3, duration: 0.2, onComplete: () => { this._el.style.visibility = 'hidden' } })
    this._isOpen = false
    this._emitState()
    window.dispatchEvent(new CustomEvent('omni:panel-minimized', {
      detail: { id: 'omnihands', label: '⟐OmniHands', iconLabel: '⟐OH',
        fromRect: { x: rect.left, y: rect.top, w: rect.width, h: rect.height }, variant: 'app' }
    }))
  }

  /** Current hand id (read by tests / other modules). */
  getHand () { return this._hand }

  // ── DOM ─────────────────────────────────────────────────────────────────────

  _buildDOM () {
    const root = el('div', 'omni-hands-panel')
    root.innerHTML = `
      <div class="omh-header">
        <span class="omh-title">⟐OmniHands</span>
        <div class="omh-controls">
          <button class="omh-ctrl" data-action="minimize" title="Minimize">–</button>
          <button class="omh-ctrl" data-action="close" title="Close">×</button>
        </div>
      </div>
      <div class="omh-switch"></div>
      <div class="omh-body"></div>
    `
    root.querySelector('[data-action="minimize"]').addEventListener('click', () => this.minimize())
    root.querySelector('[data-action="close"]').addEventListener('click', () => this.close())
    const sw = root.querySelector('.omh-switch')
    ORDER.forEach(h => {
      const b = el('button', 'omh-tab', HAND_META[h].product)
      b.dataset.hand = h
      b.addEventListener('click', () => { this._hand = h; this._renderView(); this._emitState() })
      sw.appendChild(b)
    })
    this._bindHeader(root)
    root.dataset.winId = 'omnihands'
    WindowManager.register('omnihands', root, 'OmniHands')
    WindowManager.watchPanelOpacity(root, () => this._isOpen)
    return root
  }

  _renderView () {
    if (!this._el) return
    const hand = this._hand
    const meta = HAND_META[hand]
    this._el.querySelectorAll('.omh-tab').forEach(b => b.classList.toggle('is-active', b.dataset.hand === hand))
    const body = this._el.querySelector('.omh-body')
    body.textContent = ''
    this._sync = []

    const title = el('div', 'omh-hand-title', `${meta.product} · ${meta.corner} · ${meta.role}`)
    title.dataset.role = 'hand-title'
    body.appendChild(title)
    body.appendChild(el('div', 'omh-hand-sub', `Keys: ${meta.keys}`))

    this._viewSpeed(body, hand)
    if (hand === 'lh') this._viewLogical(body)
    if (hand === 'rh') this._viewCreative(body)
    if (hand === 'lh' || hand === 'rh') this._viewAmmo(body, hand)
    if (hand === 'lh' || hand === 'rh') this._viewFlow(body, hand)   // V168: the centre Fire button
    if (hand === 'lh' || hand === 'rh') this._viewTunnel(body, hand)   // V166: view-only tunnel pin
    if (hand === 'conscious' || hand === 'omnihand') this._viewAxis(body, hand)
    this._viewPad(body, hand)

    const reset = el('button', 'omh-btn omh-btn--reset', `Reset ${meta.product} settings to defaults`)
    reset.dataset.action = 'reset-hand'
    reset.addEventListener('click', () => this._resetHand(hand))
    body.appendChild(reset)
    body.appendChild(el('div', 'omh-note', NOTES[hand]))
    this._refresh()
  }

  // ── Views ───────────────────────────────────────────────────────────────────

  /** V165: the same slider as the pad's » popover, bound to the same store value. */
  _viewSpeed (body, hand) {
    const g = this._group(body, '» Speed (shared with the pad\'s » button)')
    const row = el('div', 'omh-row')
    const slider = el('input')
    slider.type = 'range'; slider.min = LIMITS.speed.min; slider.max = LIMITS.speed.max; slider.step = '0.1'
    slider.dataset.key = 'speed'; slider.style.flex = '1'
    slider.setAttribute('aria-label', `${HAND_META[hand].product} speed`)
    const read = el('span', 'omh-readout', formatSpeed(1))
    read.dataset.role = 'speed-readout'
    slider.addEventListener('input', () => { setHandSetting(hand, 'speed', Number(slider.value)); read.textContent = formatSpeed(getHandSetting(hand, 'speed')) })
    row.append(slider, read)
    g.appendChild(row)
    const chips = el('div', 'omh-row')
    SPEED_PRESETS.forEach(p => {
      const b = el('button', 'omh-btn', `${p}×`)
      b.dataset.preset = String(p)
      b.addEventListener('click', () => setHandSetting(hand, 'speed', p))
      chips.appendChild(b)
    })
    g.appendChild(chips)
    const meaning = {
      lh: 'Multiplies walking speed (× the px / py / pz steps, or the Global override).',
      rh: 'Multiplies altitude and orbit speed (× the altitude / orbit steps, or the Global override).',
      conscious: 'Divides the step travel / relative-axis durations and the hold-repeat interval (never under 60 ms).',
      omnihand: 'Divides the step travel / relative-axis durations and the hold-repeat interval (never under 60 ms).',
    }[hand]
    g.appendChild(el('div', 'omh-note', `${meaning} 1× = the pre-V165 behaviour; hard limit 25×. Changes ease in over about 0.15 s.`))
    this._sync.push(() => {
      const v = Number(getHandSetting(hand, 'speed')) || 1
      if (Number(slider.value) !== v) slider.value = String(v)
      read.textContent = formatSpeed(v)
    })
  }

  /** V165: LogicalHand / CreativeHand ammo = node behaviours (systems/OmniHandAmmo.js). */
  _viewAmmo (body, hand) {
    const g = this._group(body, '✦ Ammo (node behaviours)')
    // current ammo (ordered list = the magazine in load order)
    const cur = el('div', 'omh-row')
    cur.appendChild(el('span', 'omh-row-label', 'Current ammo'))
    const sel = el('select', 'omh-num')
    sel.dataset.key = 'ammo'; sel.style.width = '120px'
    sel.addEventListener('change', () => setHandSetting(hand, 'ammo', sel.value))
    cur.appendChild(sel)
    g.appendChild(cur)
    // active count + Release all
    const act = el('div', 'omh-row')
    const actLabel = el('span', 'omh-row-label')
    actLabel.dataset.role = 'ammo-active'
    const rel = el('button', 'omh-btn omh-btn--reset', 'Release all')
    rel.dataset.action = 'release-all'
    rel.addEventListener('click', () => window.dispatchEvent(new CustomEvent('omni:hand-ammo-release-all', { detail: { hand } })))
    act.append(actLabel, rel)
    g.appendChild(act)
    this._numRow(g, 'Max fired at once', 'maxActive', this._storeNum(hand, 'maxActive', 1, ''))
    const mode = el('div', 'omh-row')
    mode.appendChild(el('span', 'omh-row-label', 'Pair for two-node behaviours'))
    const modeSel = el('select', 'omh-num')
    modeSel.dataset.key = 'anchorMode'; modeSel.style.width = '120px'
    ;[['nearest', 'nearest node'], ['none', 'none (self only)']].forEach(([v, t]) => { const o = el('option', null, t); o.value = v; modeSel.appendChild(o) })
    modeSel.addEventListener('change', () => setHandSetting(hand, 'anchorMode', modeSel.value))
    mode.appendChild(modeSel)
    g.appendChild(mode)
    this._numRow(g, 'Nearest nodes for multi-target', 'anchorCount', this._storeNum(hand, 'anchorCount', 1, ''))

    // magazine grid, grouped by class
    const mg = this._group(body, 'Magazine (loaded behaviours)')
    const tools = el('div', 'omh-row')
    ;[['load-all', 'Load all', () => setHandSetting(hand, 'magazine', Object.keys(BEHAVIOR_TABLE))],
      ['clear', 'Clear', () => setHandSetting(hand, 'magazine', [])],
      ['reset-magazine', 'Reset to default', () => { setHandSetting(hand, 'magazine', getDefault(hand, 'magazine')); setHandSetting(hand, 'ammo', getDefault(hand, 'ammo')) }]]
      .forEach(([action, label, fn]) => { const b = el('button', 'omh-btn', label); b.dataset.action = action; b.addEventListener('click', fn); tools.appendChild(b) })
    mg.appendChild(tools)
    const boxes = new Map()
    BEHAVIOR_CLASSES.forEach(cls => {
      const names = Object.keys(BEHAVIOR_TABLE).filter(n => BEHAVIOR_TABLE[n].cls === cls)
      if (!names.length) return
      mg.appendChild(el('div', 'omh-hand-sub', cls))
      const wrap = el('div', 'omh-row')
      wrap.style.flexWrap = 'wrap'; wrap.style.justifyContent = 'flex-start'
      names.forEach(n => {
        const lab = el('label', 'omh-hand-sub')
        lab.style.cssText = 'display:flex;align-items:center;gap:3px;width:31%;cursor:pointer'
        const cb = el('input'); cb.type = 'checkbox'; cb.dataset.behavior = n
        cb.addEventListener('change', () => {
          const mag = getHandSetting(hand, 'magazine')
          setHandSetting(hand, 'magazine', cb.checked ? (mag.includes(n) ? mag : [...mag, n]) : mag.filter(x => x !== n))
        })
        lab.append(cb, document.createTextNode(n))
        wrap.appendChild(lab)
        boxes.set(n, cb)
      })
      mg.appendChild(wrap)
    })
    mg.appendChild(el('div', 'omh-note', 'Activation (✦ on the pad) fires the current ammo at the selected node (else the node nearest the screen centre); fire it again at the same node to release it. Nodes with their own (user-made) behaviour are never overwritten. Cycle ammo with the chip on the pad or the [ ] keys. The default class split between the two hands is a proposal you can edit here, not a decided taxonomy.'))

    let sig = ''
    this._sync.push(() => {
      const mag = getHandSetting(hand, 'magazine').filter(n => BEHAVIOR_TABLE[n])
      boxes.forEach((cb, n) => { cb.checked = mag.includes(n) })
      const ammo = mag.includes(getHandSetting(hand, 'ammo')) ? getHandSetting(hand, 'ammo') : (mag[0] ?? '')
      const nextSig = mag.join('|')
      if (nextSig !== sig) {
        sig = nextSig
        sel.textContent = ''
        mag.forEach(n => { const o = el('option', null, n); o.value = n; sel.appendChild(o) })
        if (!mag.length) { const o = el('option', null, '(empty)'); o.value = ''; sel.appendChild(o) }
      }
      sel.value = ammo
      sel.disabled = !mag.length
      modeSel.value = getHandSetting(hand, 'anchorMode')
      const n = (this._ammo[hand]?.active ?? []).length
      actLabel.textContent = `Fired and held: ${n}`
      rel.disabled = n === 0
    })
  }

  /** V168: the pad's CENTRE button = Fire (systems/OmniFlowFire.js). Activation (behaviours, above) is separate. */
  _viewFlow (body, hand) {
    const g = this._group(body, '⟐ Fire (the centre button)')
    this._toggleRow(g, 'Fire enabled (master)', 'flowMaster', () => this._flowOn,
      (on) => window.dispatchEvent(new CustomEvent('omni:flow-fire-master-set', { detail: { enabled: on } })))
    if (hand === 'lh') {
      const kindRow = el('div', 'omh-row')
      kindRow.appendChild(el('span', 'omh-row-label', 'Element kind (also radial ⟐1)'))
      const kind = el('select', 'omh-num')
      kind.dataset.key = 'elementKind'; kind.style.width = '120px'
      ENUMS.elementKind.forEach(k => { const o = el('option', null, k); o.value = k; kind.appendChild(o) })
      kind.addEventListener('change', () => setHandSetting('lh', 'elementKind', kind.value))
      kindRow.appendChild(kind)
      g.appendChild(kindRow)
      this._sync.push(() => { kind.value = getHandSetting('lh', 'elementKind') })
      this._toggleRow(g, 'Chain consecutive elements', 'chainEnabled',
        () => !!getHandSetting('lh', 'chainEnabled'), (on) => setHandSetting('lh', 'chainEnabled', on))
      const chainRow = el('div', 'omh-row')
      const chainLabel = el('span', 'omh-row-label'); chainLabel.dataset.role = 'chain-length'
      const endChain = el('button', 'omh-btn', 'End chain'); endChain.dataset.action = 'end-chain'
      endChain.addEventListener('click', () => window.dispatchEvent(new CustomEvent('omni:flow-end-chain', { detail: { hand: 'lh' } })))
      chainRow.append(chainLabel, endChain)
      g.appendChild(chainRow)
      this._sync.push(() => {
        const n = this._flow.lh?.chainLength ?? 0
        chainLabel.textContent = `Current chain: ${n} element${n === 1 ? '' : 's'}`
        endChain.disabled = n === 0
      })
    } else {
      const row = el('div', 'omh-row')
      row.appendChild(el('span', 'omh-row-label', 'Current ammo (payload)'))
      const sel = el('select', 'omh-num')
      sel.dataset.key = 'payload'; sel.style.width = '140px'
      sel.addEventListener('change', () => setCurrentPayload(sel.value || null))
      row.appendChild(sel)
      g.appendChild(row)
      const open = el('button', 'omh-btn', 'Open the payload panel (create / edit ammo)')
      open.dataset.action = 'open-payload'
      open.addEventListener('click', () => window.dispatchEvent(new CustomEvent('omni:payload-open', { detail: { section: 'datatype' } })))
      g.appendChild(open)
      this._numRow(g, 'Default word delay for new payloads', 'defaultWordDelayMs', this._storeNum('rh', 'defaultWordDelayMs', 10, 'ms'))
      let sig = ''
      this._sync.push(() => {
        const items = listPayloads(), cur = getCurrentId()
        const next = items.map(p => p.id + ':' + p.name).join('|')
        if (next !== sig) {
          sig = next
          sel.textContent = ''
          items.forEach(p => { const o = el('option', null, `${p.name} (${p.type})`); o.value = p.id; sel.appendChild(o) })
          if (!items.length) { const o = el('option', null, '(none — create one)'); o.value = ''; sel.appendChild(o) }
        }
        sel.value = cur ?? ''
        sel.disabled = !items.length
      })
    }
    this._numRow(g, 'Fire distance (HUD centre)', 'fireDistance', this._storeNum(hand, 'fireDistance', 1, 'units'))
    this._numRow(g, 'Max fired elements alive', 'maxAlive', this._storeNum(hand, 'maxAlive', 1, ''))
    const aliveRow = el('div', 'omh-row')
    const aliveLabel = el('span', 'omh-row-label'); aliveLabel.dataset.role = 'flow-alive'
    const clear = el('button', 'omh-btn omh-btn--reset', hand === 'lh' ? 'Remove all fired elements' : 'Remove all fired displays')
    clear.dataset.action = 'flow-clear'
    clear.addEventListener('click', () => window.dispatchEvent(new CustomEvent('omni:flow-clear', { detail: { hand } })))
    aliveRow.append(aliveLabel, clear)
    g.appendChild(aliveRow)
    this._sync.push(() => {
      const n = this._flow[hand]?.alive ?? 0
      aliveLabel.textContent = `Alive: ${n}`
      clear.disabled = n === 0
    })
    g.appendChild(el('div', 'omh-note', hand === 'lh'
      ? 'The pad\'s CENTRE button fires the current element kind at the selected node (else the node nearest the screen centre; none: the point Fire distance ahead of the camera). Elements are real nodes (visual / structural only: nothing executes). A chain links consecutive elements while the target stays the same. Activation (✦) is separate: it still fires behaviours.'
      : 'The pad\'s CENTRE button displays the current payload at the selected node (else the node nearest the screen centre; none: the point Fire distance ahead of the camera) as word tooltips, on a small anchor. Create ammo in the payload panel (radial ⟐1 > DataTypes). Activation (✦) is separate: it still fires behaviours (a known mismatch with the Object scope, DeveloperQueue item 53).'))
  }

  _viewLogical (body) {
    const g = this._group(body, 'Movement (shared with ⟐CameraMovementOptions)')
    ;[['px', 'px step (side)'], ['py', 'py step (vertical)'], ['pz', 'pz step (forward)']].forEach(([k, label]) => {
      this._numRow(g, label, k, { get: () => adminValue(k), set: (v) => writeAdmin({ [k]: v }), min: 0.1, max: 10, step: 0.1,
        disabled: () => !!readAdmin().steps?.globalSpeed })
    })
    const info = el('div', 'omh-note')
    info.dataset.role = 'global-note'
    g.appendChild(info)
    this._sync.push(() => {
      info.textContent = readAdmin().steps?.globalSpeed
        ? 'Global speed is ON in ⟐CameraMovementOptions: the px / py / pz steps are overridden by its one universal value (Speed above still multiplies it).'
        : 'Walking speed = average of px / py / pz, × Speed.'
    })
  }

  _viewCreative (body) {
    const g = this._group(body, 'Movement (shared with ⟐CameraMovementOptions)')
    ;[['altitudeUp', 'Altitude-up (R) speed'], ['altitudeDown', 'Altitude-down (F) speed'],
      ['orbitHorizontal', 'Horizontal orbit / yaw speed'], ['orbitVertical', 'Vertical orbit speed (OmniKeys pitch)']].forEach(([k, label]) => {
      this._numRow(g, label, k, { get: () => adminValue(k), set: (v) => writeAdmin({ [k]: v }), min: 0.1, max: 10, step: 0.1,
        disabled: () => !!readAdmin().steps?.globalSpeed })
    })
    const info = el('div', 'omh-note')
    info.dataset.role = 'global-note'
    g.appendChild(info)
    this._sync.push(() => {
      info.textContent = readAdmin().steps?.globalSpeed
        ? 'Global speed is ON in ⟐CameraMovementOptions: these four are overridden by its one universal value (Speed above still multiplies it).'
        : 'Independent per direction, × Speed. 1 = the original speed.'
    })
  }

  /** V166: LogicalHand / CreativeHand tunnels are VIEW ONLY (7↔1 and 4↔10): shown while the pad is
   *  open (and "follow the pads" is on), or pinned here. Their ✦ button fires ammo, not the tunnel. */
  _viewTunnel (body, hand) {
    const sym = SYMBOL[hand]
    const g = this._group(body, `${sym} Tunnel (view only)`)
    g.appendChild(el('div', 'omh-note', hand === 'lh'
      ? 'The 7↔1 o\'clock tunnel (green), root + Mechanic / Relational / Transformational nodes (placeholders). Shown while this pad is open, or pinned here. Not steppable: the pad still walks the camera.'
      : 'The 4↔10 o\'clock tunnel (red / green / blue grid), root + Temporal / Emergent / Expressive nodes (placeholders). Shown while this pad is open, or pinned here. Not steppable: the pad still flies the camera.'))
    this._tunnelPinRows(g, hand)
  }

  _tunnelPinRows (g, hand) {
    this._toggleRow(g, 'Pin this tunnel visible', 'pin',
      () => !!this._tunnels.get(hand)?.manual,
      (on) => window.dispatchEvent(new CustomEvent('omni:axinator-tunnel-visible-set', { detail: { id: hand, visible: on } })))
    this._toggleRow(g, 'Tunnels follow the pads (shared by all four hands)', 'follow',
      () => this._followPads,
      (on) => window.dispatchEvent(new CustomEvent('omni:dimension-axes-visible-set', { detail: { visible: on } })))
    const vis = el('div', 'omh-readout')
    vis.dataset.role = 'tunnel-visible'
    g.appendChild(vis)
    this._sync.push(() => {
      const t = this._tunnels.get(hand)
      vis.textContent = t
        ? `Tunnel now: ${t.visible ? 'visible' : 'hidden'}${t.visible && !t.manual ? ' (pad open)' : ''}${t.off ? ' (hidden by ◎ Activation until the pad is toggled)' : ''}`
        : 'Tunnel now: unknown (axes system not reporting)'
    })
  }

  _viewAxis (body, hand) {
    const sym = SYMBOL[hand]
    const g = this._group(body, `${sym} Tunnel`)
    g.appendChild(el('div', 'omh-note', 'The pad\'s ◎ Activation button is the primary control: pressed while visible = explicit OFF (until the pad is next toggled); pressed while hidden = explicit ON (this pin). Precedence: OFF > pin > pad-follow.'))
    this._tunnelPinRows(g, hand)

    const m = this._group(body, `${sym} Motion`)
    this._numRow(m, 'Step travel duration', 'travelDuration', this._storeNum(hand, 'travelDuration', 0.05, 's'))
    this._numRow(m, 'Relative (Υ) axis duration', 'relDuration', this._storeNum(hand, 'relDuration', 0.05, 's'))
    this._numRow(m, 'Hold-to-repeat interval', 'holdRepeatMs', this._storeNum(hand, 'holdRepeatMs', 50, 'ms'))
    if (hand === 'omnihand') {
      this._toggleRow(m, 'Travel stagger (node flash)', 'stagger',
        () => !!getHandSetting('omnihand', 'stagger'),
        (on) => setHandSetting('omnihand', 'stagger', on))
    }
    this._numRow(m, 'Clock hour (direction)', 'clockHour', this._storeNum(hand, 'clockHour', 0.5, 'o\'clock'))
    m.appendChild(el('div', 'omh-note', 'Durations and hold-repeat apply on the next step; the clock hour re-aims the tunnel immediately (12 = away from you, 3 = right; the tunnel runs through the origin, so the opposite hour is its other end). Defaults: 0.55 s / 0.45 s / 450 ms, ' + getDefault(hand, 'clockHour') + ' o\'clock.'))

    const p = this._group(body, `${sym} Marker`)
    const pos = el('div', 'omh-readout')
    pos.dataset.role = 'position'
    p.appendChild(pos)
    this._sync.push(() => {
      const d = this._axisState[hand]
      pos.textContent = d
        ? `At: ${d.activeNode.name} (${d.primaryIndex + 1}/${d.primaryCount}) · Υ ${d.activeLevel.name} (${d.relativeIndex + 1}/${d.relativeCount})`
        : 'At: — (moves once the axes report a position)'
    })
    const rb = el('button', 'omh-btn', 'Reset marker to the root (origin)')
    rb.dataset.action = 'reset-marker'
    rb.addEventListener('click', () => window.dispatchEvent(new CustomEvent('omni:dimension-axes-reset', { detail: { hand } })))
    p.appendChild(rb)
  }

  _viewPad (body, hand) {
    const g = this._group(body, '⚇ Pad')
    this._toggleRow(g, 'Show pad on start', 'padOnStart',
      () => !!getHandSetting(hand, 'padOnStart'),
      (on) => setHandSetting(hand, 'padOnStart', on))
    const row = el('div', 'omh-row')
    const label = el('span', 'omh-row-label')
    label.dataset.role = 'detach-state'
    const btn = el('button', 'omh-btn', 'Re-dock pad')
    btn.dataset.action = 'redock'
    btn.addEventListener('click', () => window.dispatchEvent(new CustomEvent('omni:pad-redock', { detail: { hand } })))
    row.append(label, btn)
    g.appendChild(row)
    this._sync.push(() => {
      const d = !!this._detached[hand]
      label.textContent = `Pad position: ${d ? 'detached (floating)' : 'docked'}`
      btn.disabled = !d
    })
    g.appendChild(el('div', 'omh-note', 'Show-on-start opens this pad once when the app loads. Detach / drag is the ⏏ button beside the pad.'))
  }

  // ── Row helpers ─────────────────────────────────────────────────────────────

  _group (body, title) {
    body.appendChild(el('div', 'omh-group-title', title))
    const g = el('div', 'omh-group')
    body.appendChild(g)
    return g
  }

  _storeNum (hand, key, step, unit) {
    return {
      get: () => getHandSetting(hand, key),
      set: (v) => setHandSetting(hand, key, v),
      min: LIMITS[key].min, max: LIMITS[key].max, step, unit,
    }
  }

  _numRow (parent, label, key, cfg) {
    const row = el('label', 'omh-row')
    row.appendChild(el('span', 'omh-row-label', label))
    const input = el('input', 'omh-num')
    input.type = 'number'
    input.min = cfg.min; input.max = cfg.max; input.step = cfg.step
    input.dataset.key = key
    input.addEventListener('change', () => {
      const n = Number(input.value)
      if (input.value === '' || !Number.isFinite(n)) { input.value = cfg.get(); return }
      cfg.set(Math.min(cfg.max, Math.max(cfg.min, n)))
      input.value = cfg.get()
    })
    row.appendChild(input)
    row.appendChild(el('span', 'omh-unit', cfg.unit ?? ''))
    parent.appendChild(row)
    this._sync.push(() => {
      if (document.activeElement !== input) input.value = cfg.get()
      input.disabled = !!cfg.disabled?.()
    })
  }

  _toggleRow (parent, label, key, get, set) {
    const row = el('div', 'omh-row')
    row.appendChild(el('span', 'omh-row-label', label))
    const wrap = el('label', 'omh-toggle')
    const input = el('input')
    input.type = 'checkbox'
    input.dataset.key = key
    input.addEventListener('change', () => set(input.checked))
    wrap.append(input, el('div', 'omh-toggle-track'))
    row.appendChild(wrap)
    parent.appendChild(row)
    this._sync.push(() => { input.checked = !!get() })
  }

  _refresh () {
    if (!this._el) return
    this._sync.forEach(fn => { try { fn() } catch (_) {} })
  }

  // ── Actions ─────────────────────────────────────────────────────────────────

  _resetHand (hand) {
    resetHand(hand)
    if (hand === 'lh') writeAdmin({ px: 1, py: 1, pz: 1 })
    if (hand === 'rh') writeAdmin({ altitudeUp: 1, altitudeDown: 1, orbitVertical: 1, orbitHorizontal: 1 })
    // V166: all four hands own a tunnel now; resetting unpins it
    window.dispatchEvent(new CustomEvent('omni:axinator-tunnel-visible-set', { detail: { id: hand, visible: false } }))
    this._refresh()
  }

  // ── Dragging (same as the other settings panels) ────────────────────────────

  _bindHeader (root) {
    const header = root.querySelector('.omh-header')
    const drag = { active: false }
    const pt = (e) => ({ x: e.touches?.[0]?.clientX ?? e.clientX, y: e.touches?.[0]?.clientY ?? e.clientY })
    const onDown = (e) => {
      if (e.target.closest('button')) return
      const { x, y } = pt(e)
      const rect = root.getBoundingClientRect()
      drag.active = true; drag.startX = x; drag.startY = y; drag.originX = rect.left; drag.originY = rect.top
    }
    const onMove = (e) => {
      if (!drag.active) return
      const { x, y } = pt(e)
      gsap.set(root, { left: drag.originX + (x - drag.startX), top: drag.originY + (y - drag.startY) })
    }
    const onUp = () => { drag.active = false }
    header.addEventListener('mousedown', onDown)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    header.addEventListener('touchstart', onDown, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', onUp)
    this._unbindHeader = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onUp)
    }
  }
}
