/**
 * ui/OmniQuickLauncher.js — ⟐ Quick Launcher
 *
 * A small, always-draggable ⟐ icon, free-floating anywhere on screen —
 * "a moveable icon of ⟐ as a custom menu of sorts," built specifically
 * for the MX Ergo / mouse-only presentation use case, where the user
 * does not want to have to travel to a fixed corner for a tool.
 *
 * Clicking it (not dragging it) opens a small radial popup anchored at
 * its current position — "a similar menu to the hands menu... circular
 * or radial." This is deliberately a NEW, separate, much smaller radial
 * implementation, not an extension of ui/RadialMenu.js — that file is
 * hardcoded to exactly 4 corner-anchored hand menus with corner-based
 * positioning math; this one has to anchor at an arbitrary, user-moved
 * point instead, and genuinely didn't need that file's paging/rotation
 * machinery. Shares the same general visual language (dark glass,
 * monospace, circular items) by eye, not by shared code.
 *
 * Tool list is deliberately an array of {id, label, onSelect} — "a
 * custom menu of sorts" implies more will land here later, not just the
 * one keyboard entry. Adding a second tool is adding one array entry.
 *
 * ─────────────────────────────────────────────────────────────────────
 * Events dispatched
 * ─────────────────────────────────────────────────────────────────────
 *
 *   omni:cryptx-keyboard-toggle   →  {}   (no detail — the keyboard
 *                                          module owns its own open/
 *                                          closed state and just flips it)
 *
 * ─────────────────────────────────────────────────────────────────────
 * Persistence
 * ─────────────────────────────────────────────────────────────────────
 *
 *   omni:quicklauncher:pos — {x, y}, reload-persistent on this browser/
 *   profile only, same convention as the movement pad release feature.
 *   A different user/machine starts at the default position.
 */

import gsap from 'gsap'

const STORAGE_KEY = 'omni:quicklauncher:pos'
const SIZE = 48
const RING_R = 76   // V191: three 44 px items now fan out; 76 px keeps them >= 8 px apart (2 x 76 x sin 21 = 54)
const RING_STEP = 42   // degrees between neighbouring items
const DRAG_THRESHOLD_SQ = 36 // ~6px — below this, a pointerup is a click, not a drag
const DOCK_H = 52 // px — matches Dock.js's own DOCK_H; kept as a local copy, same
                   // pattern MovementPad.js already uses for this same constant

// V191: + OmniKeys (the OmniKeys panel, the other keyboard) and OmniDraw (the mode picker). `detail` is sent with the event.
const TOOLS = [
  { id: 'keyboard', label: 'Keyboard', glyph: '⌨', event: 'omni:cryptx-keyboard-toggle', tip: 'Opens the CryptX keyboard (the keyboard tool this launcher always had).' },
  { id: 'omnikeys', label: 'OmniKeys', glyph: '⟐⌨', event: 'omni:nav-select', detail: { item: '⟐OmniKeys' }, tip: 'Opens the OmniKeys panel (the other keyboard: QWERTY grid, symbols, command mode).' },
  { id: 'omnidraw', label: 'OmniDraw', glyph: '✎', event: 'omni:nav-select', detail: { item: '⟐OmniDraw' }, tip: 'Opens the OmniDraw mode picker (Static, Dynamic, Behavior, Cell, Chat, Log).' },
]

const STYLES = /* css */`

.oql-launcher {
  position        : fixed;
  width            : ${SIZE}px;
  height           : ${SIZE}px;
  border-radius    : 50%;
  background       : rgba(10, 10, 14, 0.80);
  border           : 1px solid rgba(255, 255, 255, 0.55);
  color            : rgba(255, 255, 255, 0.95);
  display          : flex;
  align-items      : center;
  justify-content  : center;
  font-size        : 20px;
  font-family      : 'Courier New', Courier, monospace;
  cursor           : grab;
  z-index          : 56;
  /* Real fix (bug-squash pass) — #omni-ui (this element's shell parent)
     sets pointer-events:none on itself so the canvas stays interactive
     through it; every interactive child must explicitly opt back in,
     same established pattern as RadialMenu's .radial-item and
     MovementPad's .omni-pad-sat. This element never did, so it never
     received a single pointerdown — confirmed root cause of "the ⟐
     symbol at the top really doesnt do anything." */
  pointer-events   : auto;
  user-select      : none;
  -webkit-user-select: none;
  touch-action     : none;
  box-shadow       : 0 0 10px rgba(255, 255, 255, 0.20);
  transition       : box-shadow 0.15s ease, background 0.15s ease;
}
.oql-launcher:hover  { box-shadow: 0 0 16px rgba(255, 255, 255, 0.38); }
.oql-launcher.is-dragging { cursor: grabbing; }
.oql-launcher.is-open {
  background       : rgba(255, 255, 255, 0.14);
  box-shadow       : 0 0 18px rgba(255, 255, 255, 0.45);
}

.oql-ring {
  position        : fixed;
  z-index          : 56;
  pointer-events   : none;
  opacity          : 0;
}

.oql-item {
  position         : fixed;
  width            : 44px;
  height           : 44px;
  border-radius    : 50%;
  background       : rgba(10, 10, 14, 0.88);
  border           : 1px solid rgba(255, 255, 255, 0.22);
  color            : rgba(255, 255, 255, 0.90);
  display          : flex;
  flex-direction   : column;
  align-items      : center;
  justify-content  : center;
  font-family      : 'Courier New', Courier, monospace;
  cursor           : pointer;
  z-index          : 56;
  pointer-events   : none;
  opacity          : 0;
  transition       : background 0.12s ease, border-color 0.12s ease;
}
.oql-item:hover {
  background       : rgba(255, 255, 255, 0.16);
  border-color     : rgba(255, 255, 255, 0.45);
}
.oql-item-glyph { font-size: 14px; white-space: nowrap; line-height: 1; pointer-events: none; }
.oql-item-label { font-size: 7px; white-space: nowrap; letter-spacing: 0.06em; color: rgba(255,255,255,0.65); pointer-events: none; margin-top: 2px; }

@media (max-width: 460px) {
  .oql-launcher { width: 40px; height: 40px; font-size: 17px; }
  .oql-item     { width: 38px; height: 38px; }
  .oql-item-label { font-size: 6px; }
  .oql-item-glyph { font-size: 12px; }
}

`

function injectStyles () {
  if (document.getElementById('omni-quicklauncher-styles')) return
  const tag = document.createElement('style')
  tag.id = 'omni-quicklauncher-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

export default class OmniQuickLauncher {

  constructor (context) {
    this.ctx = context
    this._el = null
    this._itemEls = []
    this._open = false
    this._pos = { x: 0, y: 0 }
    this._dragState = null

    this._onPointerMove = this._handlePointerMove.bind(this)
    this._onPointerUp   = this._handlePointerUp.bind(this)
    this._onResize       = this._handleResize.bind(this)
    this._onOutsideClick = this._handleOutsideClick.bind(this)
  }

  init () {
    injectStyles()
    this._buildLauncher()
    this._restorePosition()
    window.addEventListener('resize', this._onResize)
    console.log('⟐ OmniQuickLauncher: initialized.')
  }

  destroy () {
    this._closeRing()
    this._el?.parentNode?.removeChild(this._el)
    window.removeEventListener('pointermove', this._onPointerMove)
    window.removeEventListener('pointerup',   this._onPointerUp)
    window.removeEventListener('resize', this._onResize)
    document.removeEventListener('pointerdown', this._onOutsideClick, true)
  }

  // ── Build ────────────────────────────────────────────────────────────────

  _buildLauncher () {
    const shell = document.getElementById('omni-ui') ?? document.body
    const el = document.createElement('div')
    el.id        = 'omni-quick-launcher'
    el.className = 'oql-launcher'
    el.setAttribute('role', 'button')
    el.setAttribute('aria-label', '⟐ Quick Launcher')
    el.textContent = '⟐'
    el.addEventListener('pointerdown', (e) => this._onPointerDown(e))
    shell.appendChild(el)
    this._el = el
  }

  // ── Default position — dead-center of the bottom Dock, "kind of like
  //    apple's hold-home-button on their legacy phones" (direct request).
  //    Clear of the four Hand corners and both movement pads either way,
  //    so it never spawns on top of something else the first time an app
  //    loads with no saved position yet. ──────────────────────────────

  _defaultPosition () {
    return {
      x: window.innerWidth / 2 - SIZE / 2,
      y: window.innerHeight - DOCK_H / 2 - SIZE / 2,
    }
  }

  _restorePosition () {
    let saved = null
    try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') } catch (_) { saved = null }
    this._pos = saved && Number.isFinite(saved.x) && Number.isFinite(saved.y) ? saved : this._defaultPosition()
    this._applyPosition()
  }

  _applyPosition () {
    if (!this._el) return
    this._el.style.left = `${this._pos.x}px`
    this._el.style.top  = `${this._pos.y}px`
  }

  _persistPosition () {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this._pos)) } catch (_) {}
  }

  _handleResize () {
    // Keep it on-screen if the viewport shrank out from under it —
    // doesn't reset position, just clamps it back into view.
    const maxX = window.innerWidth - SIZE
    const maxY = window.innerHeight - SIZE
    this._pos.x = Math.min(Math.max(0, this._pos.x), Math.max(0, maxX))
    this._pos.y = Math.min(Math.max(0, this._pos.y), Math.max(0, maxY))
    this._applyPosition()
  }

  // ── Drag vs. click ───────────────────────────────────────────────────────

  _onPointerDown (e) {
    e.preventDefault()
    this._dragState = {
      startX: e.clientX, startY: e.clientY,
      startPos: { ...this._pos },
      moved: false,
    }
    try { this._el.setPointerCapture(e.pointerId) } catch (_) {}
    window.addEventListener('pointermove', this._onPointerMove)
    window.addEventListener('pointerup',   this._onPointerUp)
  }

  _handlePointerMove (e) {
    const d = this._dragState
    if (!d) return
    const dx = e.clientX - d.startX
    const dy = e.clientY - d.startY
    if ((dx * dx + dy * dy) > DRAG_THRESHOLD_SQ) {
      d.moved = true
      this._el.classList.add('is-dragging')
      if (this._open) this._closeRing()
    }
    if (!d.moved) return
    this._pos = { x: d.startPos.x + dx, y: d.startPos.y + dy }
    this._applyPosition()
  }

  _handlePointerUp () {
    const d = this._dragState
    this._dragState = null
    window.removeEventListener('pointermove', this._onPointerMove)
    window.removeEventListener('pointerup',   this._onPointerUp)
    this._el.classList.remove('is-dragging')
    if (!d) return
    if (d.moved) {
      this._persistPosition()
    } else {
      this._toggleRing()
    }
  }

  // ── Radial popup ─────────────────────────────────────────────────────────

  _toggleRing () {
    this._open ? this._closeRing() : this._openRing()
  }

  _openRing () {
    this._open = true
    this._el.classList.add('is-open')
    const cx = this._pos.x + SIZE / 2
    const cy = this._pos.y + SIZE / 2
    const n  = TOOLS.length
    // Fan the items in an arc above the launcher by default so they
    // don't get lost behind it — clamps toward screen center if the
    // launcher is sitting near an edge, same spirit as RadialMenu's own
    // viewport-aware shifting.
    const half = window.innerWidth <= 460 ? 19 : 22   // item radius (CSS: 44 px, 38 px on a phone)
    // V191: fan the items around "up" by default; near an edge, turn the whole fan (try 15 degree steps
    // either side of up, then sideways and down) to the first angle that keeps every item on screen.
    const fits = (base) => TOOLS.every((_, i) => {
      const a = ((base + (i - (n - 1) / 2) * RING_STEP) * Math.PI) / 180
      const x = cx + Math.cos(a) * RING_R, y = cy + Math.sin(a) * RING_R
      return x >= half + 4 && x <= window.innerWidth - half - 4 && y >= half + 4 && y <= window.innerHeight - half - 4
    })
    const baseAngle = [-90, -75, -105, -60, -120, -45, -135, -30, -150, -15, -165, 0, 180, 15, 165, 90, 60, 120].find(fits) ?? -90
    const startAngle = baseAngle - (n - 1) * (RING_STEP / 2)
    this._itemEls = TOOLS.map((tool, i) => {
      const angleDeg = startAngle + i * RING_STEP
      const rad = (angleDeg * Math.PI) / 180
      // V191: keep every item fully on screen (the launcher can sit near any edge)
      const x = Math.min(Math.max(half + 4, cx + Math.cos(rad) * RING_R), window.innerWidth - half - 4)
      const y = Math.min(Math.max(half + 4, cy + Math.sin(rad) * RING_R), window.innerHeight - half - 4)

      const el = document.createElement('div')
      el.className = 'oql-item'
      el.setAttribute('role', 'button')
      el.setAttribute('aria-label', tool.label)
      el.dataset.tool = tool.id
      el.dataset.omniTip = tool.label
      el.dataset.omniTipKey = '—'
      el.dataset.omniTipDesc = tool.tip ?? tool.label
      el.title = tool.tip ?? tool.label
      el.innerHTML = `<span class="oql-item-glyph">${tool.glyph}</span><span class="oql-item-label">${tool.label}</span>`
      el.style.left = `${x - half}px`
      el.style.top  = `${y - half}px`
      el.addEventListener('pointerdown', (e) => {
        e.stopPropagation()
        window.dispatchEvent(tool.detail ? new CustomEvent(tool.event, { detail: tool.detail }) : new CustomEvent(tool.event))
        this._closeRing()
      })
      document.getElementById('omni-ui')?.appendChild(el) ?? document.body.appendChild(el)

      gsap.fromTo(el, { opacity: 0, scale: 0.5 }, { opacity: 1, scale: 1, duration: 0.18, delay: i * 0.03, ease: 'back.out(1.8)' })
      el.style.pointerEvents = 'auto'
      return el
    })

    document.addEventListener('pointerdown', this._onOutsideClick, true)
  }

  _closeRing () {
    this._open = false
    this._el?.classList.remove('is-open')
    const els = this._itemEls
    this._itemEls = []
    els.forEach(el => {
      gsap.to(el, {
        opacity: 0, scale: 0.6, duration: 0.12, ease: 'power2.in',
        onComplete: () => el.parentNode?.removeChild(el),
      })
    })
    document.removeEventListener('pointerdown', this._onOutsideClick, true)
  }

  _handleOutsideClick (e) {
    if (this._el?.contains(e.target)) return
    if (this._itemEls.some(el => el.contains(e.target))) return
    this._closeRing()
  }
}
