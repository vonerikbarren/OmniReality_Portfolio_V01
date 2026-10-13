/**
 * ui/HandToolsPanel.js — the tool options of ⟐OmniHand and ⟐ConsciousHand, on their pads (V191)
 *
 * Owner: "the tool options for ConsciousHand and OmniHand ... bring them out so they are like the
 * tool options for RH and LH ... they are like at the axis". The lower hands show their tool options
 * on the pad (Activate + the ammo chip). The two axis hands now do too: their pad carries the same
 * round Activate (◎ tunnel) button and a round DATA CHIP showing the marker's current node (ui/MovementPad.js);
 * clicking the chip opens this small menu, which holds every option the axis offers:
 *
 *   TakeMeThere   fly into the marker's current node           (the node menu's TakeMeThere, systems/OmniAxinator.js)
 *   Root          fly to the tunnel's root node                (the node menu's Root)
 *   ◂ Back / Forth ▸   step along the PRIMARY axis             (the pad's left / right buttons; axes.step)
 *   Υ▲ / Υ▼       step along the RELATIVE axis                 (the pad's up / down buttons; axes.step)
 *   Reset marker  back to the root (omni:dimension-axes-reset { hand })
 *   Tunnel        show / hide this hand's tunnel               (omni:hand-activate, same as the ◎ button)
 *   Follow pads   tunnels follow their pads (the shared master, omni:dimension-axes-visible-set)
 *   Settings      ⟐OmniHands on this hand (omni:nav-select; closes when already on this hand)
 *
 * The axis keeps working exactly as before: the 3D tunnel's own node menu (click a node), the
 * readout HUD, ⟐DimensionalAxesSettings and ⟐OmniHands are untouched. Nothing here is a new axis feature;
 * every action calls the same API the axis already had.
 *
 * Lightweight popover, deliberately NOT registered with ui/WindowManager (a transient control tied to
 * its chip, like ui/HandSpeedPanel.js: window-chrome class B, "not a window"). Anchored beside the chip,
 * clamped to the viewport, draggable by its header, closed by x, Escape, or the chip again. z-index 62.
 * Events dispatched: omni:hand-tools-panel-state { hand, open }
 * Events consumed:   omni:dimension-state, omni:axinator-tunnel-visible, omni:axinator-list, omni:dimension-axes-visible
 */

import { HAND_NAMES } from './HandSpeedPanel.js'

const MARGIN = 8
const SYMBOL = { conscious: '◬', omnihand: '⟐' }

const STYLES = `
.omni-hand-tools {
  --ht-bg: var(--omni-theme-bg, rgba(8, 8, 12, 0.94));
  --ht-border: var(--omni-theme-border, rgba(255, 255, 255, 0.16));
  --ht-header-bg: var(--omni-theme-header-bg, rgba(255, 255, 255, 0.04));
  --ht-text: var(--omni-theme-text, rgba(255, 255, 255, 0.92));
  --ht-dim: var(--omni-theme-text-dim, rgba(255, 255, 255, 0.65));
  --mono: 'Courier New', Courier, monospace;
  position: fixed; left: 0; top: 0; width: 252px; max-width: calc(100vw - 16px); z-index: 62;
  pointer-events: auto;   /* #omni-ui is pointer-events:none (see HandSpeedPanel) */
  display: none; flex-direction: column;
  background: var(--ht-bg); border: 1px solid var(--ht-border); border-radius: 12px;
  backdrop-filter: blur(20px) saturate(1.5); -webkit-backdrop-filter: blur(20px) saturate(1.5);
  box-shadow: 0 0 20px rgba(0,0,0,0.4), 0 10px 30px rgba(0,0,0,0.5);
  font-family: var(--mono); color: var(--ht-text); user-select: none; -webkit-user-select: none;
}
.omni-hand-tools.is-open { display: flex; }
.oht-header {
  height: 34px; display: flex; align-items: center; justify-content: center; position: relative;
  background: var(--ht-header-bg); border-bottom: 1px solid var(--ht-border);
  border-radius: 12px 12px 0 0; cursor: grab; touch-action: none;
}
.oht-title { font-size: 11px; letter-spacing: 0.05em; color: var(--ht-dim); pointer-events: none; }
.oht-close {
  position: absolute; right: 7px; width: 22px; height: 22px; border-radius: 6px; cursor: pointer;
  border: 1px solid var(--ht-border); background: rgba(255,255,255,0.04); color: var(--ht-dim); font-size: 12px;
  display: flex; align-items: center; justify-content: center; padding: 0;
}
.oht-close:hover { background: rgba(255,255,255,0.12); color: var(--ht-text); }
.oht-body { padding: 10px 12px 12px; display: flex; flex-direction: column; gap: 8px; }
.oht-readout { font-size: 10px; line-height: 1.5; color: var(--ht-dim); }
.oht-readout b { color: var(--ht-text); font-weight: bold; }
.oht-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.oht-btn {
  font-family: var(--mono); font-size: 10px; cursor: pointer; color: var(--ht-text); text-align: left;
  background: rgba(255,255,255,0.05); border: 1px solid var(--ht-border); border-radius: 8px;
  padding: 8px 8px; min-height: 36px; display: flex; align-items: center; gap: 6px; touch-action: manipulation;
}
.oht-btn:hover { background: rgba(255,255,255,0.13); }
.oht-btn:focus-visible { outline: 2px solid rgba(255,255,255,0.9); outline-offset: 1px; }
.oht-btn.is-on { background: rgba(255,255,255,0.22); border-color: rgba(255,255,255,0.55); }
.oht-btn .oht-g { font-size: 14px; line-height: 1; min-width: 16px; text-align: center; }
.oht-note { font-size: 9px; color: var(--ht-dim); line-height: 1.45; }
`

function injectStyles () {
  if (typeof document === 'undefined' || document.getElementById('omni-hand-tools-styles')) return
  const tag = document.createElement('style')
  tag.id = 'omni-hand-tools-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

/** The option list (exported for tests / docs): id, glyph, label, tooltip. */
export const TOOL_OPTIONS = [
  { id: 'here',    glyph: '🎯', label: 'TakeMeThere', tip: 'Fly into the marker\'s current node (the same as TakeMeThere in the tunnel\'s node menu).' },
  { id: 'root',    glyph: '⟐', label: 'Root',        tip: 'Fly to this tunnel\'s root node at the origin.' },
  { id: 'back',    glyph: '◂', label: 'Back',        tip: 'One step back along the primary axis (the pad\'s left button).' },
  { id: 'forth',   glyph: '▸', label: 'Forth',       tip: 'One step forth along the primary axis (the pad\'s right button).' },
  { id: 'up',      glyph: '▲', label: 'Υ up',        tip: 'One step up the relative (Υ) axis (the pad\'s up button).' },
  { id: 'down',    glyph: '▼', label: 'Υ down',      tip: 'One step down the relative (Υ) axis (the pad\'s down button).' },
  { id: 'reset',   glyph: '↺', label: 'Reset marker', tip: 'Put this hand\'s marker back on the root.' },
  { id: 'tunnel',  glyph: '◎', label: 'Tunnel',      tip: 'Show or hide this hand\'s tunnel (the same as the pad\'s ◎ button).' },
  { id: 'follow',  glyph: '⛓', label: 'Follow pads', tip: 'Tunnels follow their pads (shared by both axis hands). Off: they only show when pinned.' },
  { id: 'settings', glyph: '⚙', label: 'Settings',   tip: 'Open ⟐OmniHands on this hand.' },
]

export default class HandToolsPanel {
  /** @param {{getAxes?: () => object|null}} [opts] getAxes returns the OmniDimensionalAxes instance (set later by main.js). */
  constructor (opts = {}) {
    this._getAxes = opts.getAxes ?? (() => null)
    this._el = null
    this._hand = null
    this._anchor = null
    this._drag = null
    this._bound = false
    this._follow = true
    this._tunnelOn = { conscious: false, omnihand: false }
    this._onKey = (e) => { if (e.key === 'Escape' && this.isOpen()) this.close() }
    this._onState = (e) => { if (this.isOpen() && e.detail?.hand === this._hand) this._sync() }
    this._onTunnel = (e) => {
      const d = e.detail ?? {}
      if (d.id in this._tunnelOn) { this._tunnelOn[d.id] = !!d.visible; if (this.isOpen(d.id)) this._sync() }
    }
    this._onList = (e) => (e.detail?.tunnels ?? []).forEach(t => {
      if (t.id in this._tunnelOn) this._tunnelOn[t.id] = !!t.visible
      if (this.isOpen()) this._sync()
    })
    this._onFollow = (e) => { this._follow = !!e.detail?.visible; if (this.isOpen()) this._sync() }
    this._onMove = (e) => this._dragMove(e)
    this._onUp = () => this._dragEnd()
    this._onResize = () => { if (this.isOpen()) this._clamp() }
  }

  init () {
    if (this._bound) return
    injectStyles()
    window.addEventListener('keydown', this._onKey)
    window.addEventListener('omni:dimension-state', this._onState)
    window.addEventListener('omni:axinator-tunnel-visible', this._onTunnel)
    window.addEventListener('omni:axinator-list', this._onList)
    window.addEventListener('omni:dimension-axes-visible', this._onFollow)
    window.addEventListener('resize', this._onResize)
    this._bound = true
  }

  destroy () {
    window.removeEventListener('keydown', this._onKey)
    window.removeEventListener('omni:dimension-state', this._onState)
    window.removeEventListener('omni:axinator-tunnel-visible', this._onTunnel)
    window.removeEventListener('omni:axinator-list', this._onList)
    window.removeEventListener('omni:dimension-axes-visible', this._onFollow)
    window.removeEventListener('resize', this._onResize)
    window.removeEventListener('pointermove', this._onMove)
    window.removeEventListener('pointerup', this._onUp)
    this._el?.parentNode?.removeChild(this._el)
    this._el = null; this._bound = false
  }

  isOpen (hand) { return !!this._el?.classList.contains('is-open') && (hand === undefined || this._hand === hand) }
  getHand () { return this._hand }
  getElement () { return this._el }

  open (hand, anchorEl) {
    if (!SYMBOL[hand]) return
    if (!this._bound) this.init()
    if (!this._el) this._el = this._build()
    const shell = document.getElementById('omni-ui') ?? document.body
    if (!this._el.parentNode) shell.appendChild(this._el)
    const wasOpen = this.isOpen()
    const prev = this._hand
    this._hand = hand
    this._anchor = anchorEl ?? null
    this._el.setAttribute('aria-label', `${HAND_NAMES[hand]} tool options`)
    this._el.dataset.hand = hand
    this._el.querySelector('.oht-title').textContent = `${SYMBOL[hand]} ${HAND_NAMES[hand]} Tools`
    this._el.classList.add('is-open')
    this._sync()
    this._place()
    if (wasOpen && prev !== hand) this._emit(prev, false)
    this._emit(hand, true)
  }

  close () {
    if (!this._el || !this.isOpen()) return
    this._el.classList.remove('is-open')
    this._dragEnd()
    this._emit(this._hand, false)
  }

  toggle (hand, anchorEl) {
    if (this.isOpen(hand)) this.close()
    else this.open(hand, anchorEl)
  }

  /** Run one option for the open hand (exported through the buttons; also callable from tests). */
  run (id, hand = this._hand) {
    const axes = this._getAxes()
    const ax = axes?.getAxinator?.()
    const send = (name, detail) => window.dispatchEvent(new CustomEvent(name, { detail }))
    switch (id) {
      case 'here': {
        const st = axes?.getState?.(hand)
        if (ax && st) {
          ax.travelToNode(hand, st.activeNode.id)
          send('omni:axinator-node-menu-action', { tunnel: hand, nodeId: st.activeNode.id, action: 'take-me-there' })
        }
        break
      }
      case 'root': {
        const t = ax?.getTunnel?.(hand)
        const nd = t?.def?.nodes?.[t.def.rootIndex ?? 0]
        if (ax && nd) {
          ax.travelToNode(hand, nd.id)
          send('omni:axinator-node-menu-action', { tunnel: hand, nodeId: nd.id, action: 'root' })
        }
        break
      }
      case 'back': axes?.step?.(hand, 'left'); break
      case 'forth': axes?.step?.(hand, 'right'); break
      case 'up': axes?.step?.(hand, 'up'); break
      case 'down': axes?.step?.(hand, 'down'); break
      case 'reset': send('omni:dimension-axes-reset', { hand }); break
      case 'tunnel': send('omni:hand-activate', { hand }); break
      case 'follow': send('omni:dimension-axes-visible-set', { visible: !(axes?.isVisible?.() ?? this._follow) }); break
      case 'settings': {
        const NAV = { conscious: '⟐ConsciousHand', omnihand: '⟐OmniHand' }
        send('omni:nav-select', { item: NAV[hand] })
        break
      }
      default: return false
    }
    this._sync()
    return true
  }

  // ── DOM ─────────────────────────────────────────────────────────────────────

  _build () {
    const root = document.createElement('div')
    root.className = 'omni-hand-tools'
    root.setAttribute('role', 'dialog')
    root.innerHTML = `
      <div class="oht-header"><span class="oht-title"></span><button class="oht-close" type="button" title="Close" aria-label="Close tool options">×</button></div>
      <div class="oht-body">
        <div class="oht-readout" data-role="readout"></div>
        <div class="oht-grid"></div>
        <div class="oht-note">Same actions as the axis: the tunnel's node menu, the pad's buttons and ⟐OmniHands. The axis itself is unchanged.</div>
      </div>`
    const grid = root.querySelector('.oht-grid')
    TOOL_OPTIONS.forEach(o => {
      const b = document.createElement('button')
      b.type = 'button'; b.className = 'oht-btn'; b.dataset.option = o.id
      b.innerHTML = `<span class="oht-g"></span><span class="oht-l"></span>`
      b.querySelector('.oht-g').textContent = o.glyph
      b.querySelector('.oht-l').textContent = o.label
      b.title = o.tip
      b.dataset.omniTip = o.label
      b.dataset.omniTipKey = '—'
      b.dataset.omniTipDesc = o.tip
      b.dataset.omniTipSource = 'Hand tool option'
      b.addEventListener('click', () => this.run(o.id))
      grid.appendChild(b)
    })
    root.querySelector('.oht-close').addEventListener('click', () => this.close())
    root.querySelector('.oht-header').addEventListener('pointerdown', (e) => this._dragStart(e))
    return root
  }

  _sync () {
    if (!this._el || !this._hand) return
    const axes = this._getAxes()
    const st = axes?.getState?.(this._hand)
    const ro = this._el.querySelector('[data-role="readout"]')
    ro.textContent = ''
    if (st) {
      const b1 = document.createElement('b'); b1.textContent = st.activeNode.name
      const b2 = document.createElement('b'); b2.textContent = st.activeLevel.name
      ro.append('Node ', b1, ` ${st.primaryIndex + 1}/${st.primaryCount}`, document.createElement('br'), 'Υ ', b2, ` ${st.relativeIndex + 1}/${st.relativeCount}`)
    } else ro.textContent = 'The axis is not connected yet.'
    const on = { tunnel: !!this._tunnelOn[this._hand], follow: axes?.isVisible?.() ?? this._follow }
    this._el.querySelectorAll('.oht-btn').forEach(b => {
      const id = b.dataset.option
      if (id in on) { b.classList.toggle('is-on', !!on[id]); b.setAttribute('aria-pressed', String(!!on[id])) }
      b.disabled = !st && id !== 'settings'
    })
  }

  _emit (hand, open) {
    window.dispatchEvent(new CustomEvent('omni:hand-tools-panel-state', { detail: { hand, open } }))
  }

  // ── Placement (same rules as HandSpeedPanel) ────────────────────────────────

  _size () {
    const r = this._el.getBoundingClientRect()
    return { w: r.width || 252, h: r.height || 300 }
  }

  _place () {
    const { w, h } = this._size()
    const a = this._anchor?.getBoundingClientRect?.()
    const vw = window.innerWidth, vh = window.innerHeight
    let x, y
    if (a && (a.width || a.height)) {
      const towardsRight = this._hand === 'omnihand'
      x = towardsRight ? a.right + 10 : a.left - 10 - w
      y = a.top + a.height / 2 - h / 2
      if (towardsRight ? x + w > vw - MARGIN : x < MARGIN) x = towardsRight ? a.left - 10 - w : a.right + 10   // flip if it would not fit
    } else {
      x = (vw - w) / 2; y = (vh - h) / 2
    }
    this._setPos(x, y)
  }

  _setPos (x, y) {
    const { w, h } = this._size()
    const vw = window.innerWidth, vh = window.innerHeight
    const cx = Math.min(Math.max(MARGIN, x), Math.max(MARGIN, vw - w - MARGIN))
    const cy = Math.min(Math.max(MARGIN, y), Math.max(MARGIN, vh - h - MARGIN))
    this._el.style.left = `${Math.round(cx)}px`
    this._el.style.top = `${Math.round(cy)}px`
  }

  _clamp () {
    const r = this._el.getBoundingClientRect()
    this._setPos(r.left, r.top)
  }

  _dragStart (e) {
    if (e.target.closest?.('.oht-close')) return
    const r = this._el.getBoundingClientRect()
    this._drag = { dx: e.clientX - r.left, dy: e.clientY - r.top }
    window.addEventListener('pointermove', this._onMove)
    window.addEventListener('pointerup', this._onUp)
  }

  _dragMove (e) {
    if (!this._drag) return
    this._setPos(e.clientX - this._drag.dx, e.clientY - this._drag.dy)
  }

  _dragEnd () {
    if (!this._drag) return
    this._drag = null
    window.removeEventListener('pointermove', this._onMove)
    window.removeEventListener('pointerup', this._onUp)
  }
}
