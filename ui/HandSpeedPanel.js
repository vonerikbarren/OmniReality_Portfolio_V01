/**
 * ui/HandSpeedPanel.js — the ⟫ Speed popover of a hand's pad (V165)
 *
 * A small floating panel opened by the Speed satellite (2nd button of every movable pad,
 * ui/MovementPad.js). Title "⟐<HandName> Speed"; a large continuous range slider 1.0x..25.0x
 * (step 0.1, hard limit 25x, V166), a live "×3.4" readout, preset chips (1x 2x 5x 10x 25x) and a
 * Reset-to-1x button. The slider writes `speed` for that hand straight into
 * utils/OmniHandsSettings.js on every `input` event (no debounce); the systems follow it
 * through the eased value in utils/OmniHandSpeed.js, so a drag never makes movement jump.
 *
 * Lightweight popover, deliberately NOT registered with ui/WindowManager (it is a transient
 * control tied to its button, not a window that belongs in the panel tray). Anchored beside
 * the clicked button, clamped to the viewport, draggable by its header, closed by ×, by
 * Escape, or by pressing the Speed button again. z-index 62: above the pad (41), its
 * satellites (42) and ⟐OmniHands (60).
 *
 * Events dispatched: omni:hand-speed-panel-state { hand, open }
 * Events consumed:   omni:hands-settings-changed (key 'speed' -> refresh the open view)
 *
 * Theme variables (same as OmniHandsPanel / DimensionalAxesSettingsPanel):
 *   --omni-theme-bg / -border / -header-bg / -text / -text-dim.
 */

import { getHandSetting, setHandSetting, CHANGE_EVENT, LIMITS } from '../utils/OmniHandsSettings.js'

export const SPEED_PRESETS = [1, 2, 5, 10, 25]
export const HAND_NAMES = { lh: 'LogicalHand', rh: 'CreativeHand', conscious: 'ConsciousHand', omnihand: 'OmniHand' }
const MARGIN = 8

const STYLES = `
.omni-hand-speed {
  --hs-bg: var(--omni-theme-bg, rgba(8, 8, 12, 0.94));
  --hs-border: var(--omni-theme-border, rgba(255, 255, 255, 0.16));
  --hs-header-bg: var(--omni-theme-header-bg, rgba(255, 255, 255, 0.04));
  --hs-text: var(--omni-theme-text, rgba(255, 255, 255, 0.92));
  --hs-dim: var(--omni-theme-text-dim, rgba(255, 255, 255, 0.65));
  --mono: 'Courier New', Courier, monospace;
  position: fixed; left: 0; top: 0; width: 244px; z-index: 62;
  /* V166: #omni-ui (this popover's parent) is pointer-events:none so the canvas stays interactive;
     without an explicit auto here every click / hover / drag on the popover fell through to the
     canvas (found in real Chromium: elementFromPoint on the slider and chips returned the canvas). */
  pointer-events: auto;
  display: none; flex-direction: column;
  background: var(--hs-bg); border: 1px solid var(--hs-border); border-radius: 12px;
  backdrop-filter: blur(20px) saturate(1.5); -webkit-backdrop-filter: blur(20px) saturate(1.5);
  box-shadow: 0 0 20px rgba(0,0,0,0.4), 0 10px 30px rgba(0,0,0,0.5);
  font-family: var(--mono); color: var(--hs-text); user-select: none; -webkit-user-select: none;
}
.omni-hand-speed.is-open { display: flex; }
.ohs-header {
  height: 34px; display: flex; align-items: center; justify-content: center; position: relative;
  background: var(--hs-header-bg); border-bottom: 1px solid var(--hs-border);
  border-radius: 12px 12px 0 0; cursor: grab; touch-action: none;
}
.ohs-header:active { cursor: grabbing; }
.ohs-title { font-size: 11px; letter-spacing: 0.05em; color: var(--hs-dim); pointer-events: none; }
.ohs-close {
  position: absolute; right: 7px; width: 20px; height: 20px; border-radius: 5px; cursor: pointer;
  border: 1px solid var(--hs-border); background: rgba(255,255,255,0.04); color: var(--hs-dim); font-size: 12px;
  display: flex; align-items: center; justify-content: center; padding: 0;
}
.ohs-close:hover { background: rgba(255,255,255,0.12); color: var(--hs-text); }
.ohs-body { padding: 12px 14px 14px; display: flex; flex-direction: column; gap: 12px; }
.ohs-readout { font-size: 26px; text-align: center; letter-spacing: 0.04em; text-shadow: 0 0 10px rgba(255,255,255,0.2); }
.ohs-slider { width: 100%; height: 28px; margin: 0; cursor: pointer; accent-color: rgb(var(--omni-color-accent-blue-rgb, 80, 140, 255)); touch-action: pan-y; }
.ohs-scale { display: flex; justify-content: space-between; font-size: 9px; color: var(--hs-dim); margin-top: -8px; }
.ohs-chips { display: flex; gap: 5px; }
.ohs-chip, .ohs-reset {
  font-family: var(--mono); font-size: 10px; cursor: pointer; color: var(--hs-text);
  background: rgba(255,255,255,0.05); border: 1px solid var(--hs-border); border-radius: 6px; padding: 6px 0;
}
.ohs-chip { flex: 1; }
.ohs-chip:hover, .ohs-reset:hover { background: rgba(255,255,255,0.13); }
.ohs-chip.is-active { background: rgba(var(--omni-color-accent-blue-rgb, 80, 140, 255), 0.28); border-color: rgba(var(--omni-color-accent-blue-rgb, 80, 140, 255), 0.65); }
.ohs-reset { padding: 6px 10px; }
.ohs-note { font-size: 9px; color: var(--hs-dim); line-height: 1.45; }
`

function injectStyles () {
  if (typeof document === 'undefined' || document.getElementById('omni-hand-speed-styles')) return
  const tag = document.createElement('style')
  tag.id = 'omni-hand-speed-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

export function formatSpeed (v) { return `×${Number(v).toFixed(1)}` }

/** What Speed means for each hand (shown as the panel's one-line note). */
const NOTES = {
  lh: 'Multiplies walking speed. Composes with the px / py / pz steps (or the Global speed override).',
  rh: 'Multiplies altitude and orbit speed. Composes with the altitude / orbit steps (or the Global speed override).',
  conscious: 'Axis travel runs this many times faster; hold-to-repeat steps quicker (never under 60 ms).',
  omnihand: 'Axis travel runs this many times faster; hold-to-repeat steps quicker (never under 60 ms).',
}

export default class HandSpeedPanel {
  constructor () {
    this._el = null
    this._hand = null
    this._anchor = null
    this._drag = null
    this._bound = false
    this._onKey = (e) => { if (e.key === 'Escape' && this.isOpen()) this.close() }
    this._onSetting = (e) => { if (this.isOpen() && e.detail?.hand === this._hand && e.detail?.key === 'speed') this._sync() }
    this._onMove = (e) => this._dragMove(e)
    this._onUp = () => this._dragEnd()
    this._onResize = () => { if (this.isOpen()) this._clamp() }
  }

  init () {
    if (this._bound) return
    injectStyles()
    window.addEventListener('keydown', this._onKey)
    window.addEventListener(CHANGE_EVENT, this._onSetting)
    window.addEventListener('resize', this._onResize)
    this._bound = true
  }

  destroy () {
    window.removeEventListener('keydown', this._onKey)
    window.removeEventListener(CHANGE_EVENT, this._onSetting)
    window.removeEventListener('resize', this._onResize)
    window.removeEventListener('pointermove', this._onMove)
    window.removeEventListener('pointerup', this._onUp)
    this._el?.parentNode?.removeChild(this._el)
    this._el = null; this._bound = false
  }

  isOpen (hand) { return !!this._el?.classList.contains('is-open') && (hand === undefined || this._hand === hand) }
  getHand () { return this._hand }
  getElement () { return this._el }

  /** Open for `hand`, anchored beside `anchorEl` (the Speed satellite). Re-targets if another hand's was open. */
  open (hand, anchorEl) {
    if (!HAND_NAMES[hand]) return
    if (!this._bound) this.init()
    if (!this._el) this._el = this._build()
    const shell = document.getElementById('omni-ui') ?? document.body
    if (!this._el.parentNode) shell.appendChild(this._el)
    const wasOpen = this.isOpen()
    const prev = this._hand
    this._hand = hand
    this._anchor = anchorEl ?? null
    this._el.setAttribute('aria-label', `${HAND_NAMES[hand]} speed`)
    this._el.dataset.hand = hand
    this._el.querySelector('.ohs-title').textContent = `⟐${HAND_NAMES[hand]} Speed`
    this._el.querySelector('.ohs-note').textContent = NOTES[hand]
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

  // ── DOM ─────────────────────────────────────────────────────────────────────

  _build () {
    const root = document.createElement('div')
    root.className = 'omni-hand-speed'
    root.setAttribute('role', 'dialog')
    root.innerHTML = `
      <div class="ohs-header"><span class="ohs-title"></span><button class="ohs-close" type="button" title="Close" aria-label="Close speed panel">×</button></div>
      <div class="ohs-body">
        <div class="ohs-readout" data-role="readout">×1.0</div>
        <input class="ohs-slider" type="range" min="${LIMITS.speed.min}" max="${LIMITS.speed.max}" step="0.1" value="1" aria-label="Speed multiplier">
        <div class="ohs-scale"><span>×1</span><span>×25</span></div>
        <div class="ohs-chips"></div>
        <button class="ohs-reset" type="button">Reset to ×1</button>
        <div class="ohs-note"></div>
      </div>`
    const slider = root.querySelector('.ohs-slider')
    slider.addEventListener('input', () => this._write(Number(slider.value)))     // continuous: every input event, no debounce
    const chips = root.querySelector('.ohs-chips')
    SPEED_PRESETS.forEach(p => {
      const b = document.createElement('button')
      b.type = 'button'; b.className = 'ohs-chip'; b.dataset.preset = String(p); b.textContent = `${p}×`
      b.addEventListener('click', () => this._write(p))
      chips.appendChild(b)
    })
    root.querySelector('.ohs-reset').addEventListener('click', () => this._write(1))
    root.querySelector('.ohs-close').addEventListener('click', () => this.close())
    const header = root.querySelector('.ohs-header')
    header.addEventListener('pointerdown', (e) => this._dragStart(e))
    return root
  }

  _write (v) {
    if (this._hand) setHandSetting(this._hand, 'speed', v)
    this._sync()
  }

  _sync () {
    if (!this._el || !this._hand) return
    const v = Number(getHandSetting(this._hand, 'speed')) || 1
    const slider = this._el.querySelector('.ohs-slider')
    if (Number(slider.value) !== v) slider.value = String(v)
    this._el.querySelector('[data-role="readout"]').textContent = formatSpeed(v)
    this._el.querySelectorAll('.ohs-chip').forEach(c => c.classList.toggle('is-active', Math.abs(Number(c.dataset.preset) - v) < 0.005))
  }

  // ── Placement ───────────────────────────────────────────────────────────────

  _size () {
    const r = this._el.getBoundingClientRect()
    return { w: r.width || 244, h: r.height || 230 }
  }

  /** Beside the anchor: to its right for left-corner hands, to its left for right-corner hands (towards screen centre). */
  _place () {
    const { w, h } = this._size()
    const a = this._anchor?.getBoundingClientRect?.()
    const vw = window.innerWidth, vh = window.innerHeight
    let x, y
    if (a && (a.width || a.height)) {
      const towardsRight = this._hand === 'lh' || this._hand === 'omnihand'
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
    if (e.target.closest('button')) return
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
    this._drag = null
    window.removeEventListener('pointermove', this._onMove)
    window.removeEventListener('pointerup', this._onUp)
  }

  _emit (hand, open) {
    window.dispatchEvent(new CustomEvent('omni:hand-speed-panel-state', { detail: { hand, open } }))
  }
}
