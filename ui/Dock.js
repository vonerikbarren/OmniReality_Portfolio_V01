/**
 * ui/Dock.js — ⟐mniReality Dock
 *
 * Persistent bottom bar spanning the full viewport width.
 * Sits at the very base of the UI stack — below all panels and drawers,
 * below the four Hand components, below the MiniMap overlay.
 *
 * Two responsibilities:
 *
 *   1. STRUCTURE — the bottom anchor of the OS frame. Always present.
 *      Mirrors the Global Bar in weight and visual language. Left / Right
 *      wings are reserved for future permanent app slots. Centre tray
 *      holds docked icons.
 *
 *   2. DOCKED ICON TRAY — minimized ⟐ panel icons can be dragged into
 *      the Dock (handled by PanelIcon.js). On arrival each icon snaps in
 *      and scales up with a GSAP stagger. Clicking a docked icon fires
 *      an `omni:panel-restore` CustomEvent so the originating Panel can
 *      re-open itself.
 *
 * Public API:
 *   dock.addIcon({ id, label, onRestore })
 *     → Inserts a docked icon into the tray with entry animation.
 *       id       — unique string  (e.g. 'omninode', 'inspector')
 *       label    — display string (e.g. '⟐N', '⟐i', '⟐p', '⟐T')
 *       onRestore— optional callback fired when icon is clicked
 *
 *   dock.removeIcon(id)
 *     → Removes a docked icon with exit animation, then destroys the element.
 *
 *   dock.hasIcon(id) → boolean
 *
 *   dock.getHeight() → number   (px — useful for panels to avoid overlap)
 *
 * Events dispatched on window:
 *   omni:panel-restore  →  detail: { id }
 *
 * Follows the standard module contract (constructor / init / update / destroy).
 * The update() hook is a no-op for now — reserved for future badge counters
 * or live status indicators on docked icons.
 */

import gsap from 'gsap'

// ── Constants ────────────────────────────────────────────────────────────────

const DOCK_H        = 52    // px — dock bar height
const ICON_SIZE     = 32    // px — docked icon button size
const ICON_GAP      = 6     // px — gap between docked icons
const ENTRY_DUR     = 0.28  // s  — per-icon entry tween
const ENTRY_STAGGER = 0.06  // s  — stagger between icons on batch arrival
const EXIT_DUR      = 0.18  // s  — per-icon exit tween

// ── Stylesheet ───────────────────────────────────────────────────────────────

const STYLES = /* css */`

/* ── Dock root ───────────────────────────────────────────────────────────── */

#omni-dock {
  --dock-bg          : rgba(10, 10, 14, 0.72);
  --dock-border      : rgba(255, 255, 255, 0.08);
  --dock-separator   : rgba(255, 255, 255, 0.06);
  --dock-text        : rgba(255, 255, 255, 0.82);
  --dock-text-dim    : rgba(255, 255, 255, 0.35);
  --dock-text-muted  : rgba(255, 255, 255, 0.18);
  --dock-accent      : rgba(255, 255, 255, 0.92);
  --dock-glow        : 0 0 8px rgba(255, 255, 255, 0.22);
  --dock-icon-bg     : rgba(255, 255, 255, 0.06);
  --dock-icon-hover  : rgba(255, 255, 255, 0.12);
  --dock-icon-active : rgba(255, 255, 255, 0.18);
  --mono             : 'Courier New', Courier, monospace;

  position           : fixed;
  bottom             : 0;
  left               : 0;
  width              : 100%;
  height             : ${DOCK_H}px;

  display            : flex;
  align-items        : center;

  background         : var(--dock-bg);
  backdrop-filter    : blur(18px) saturate(1.4);
  -webkit-backdrop-filter: blur(18px) saturate(1.4);
  border-top         : 1px solid var(--dock-border);

  font-family        : var(--mono);
  color              : var(--dock-text);
  z-index            : 50;
  pointer-events     : auto;
  user-select        : none;
  -webkit-font-smoothing: antialiased;
}

/* ── Dock wings (left / right reserved zones) ───────────────────────────── */

.dock-wing {
  flex               : 0 0 auto;
  width              : 64px;
  height             : 100%;
  display            : flex;
  align-items        : center;
  padding            : 0 10px;
}

.dock-wing--left {
  border-right       : 1px solid var(--dock-separator);
  justify-content    : flex-start;
}

.dock-wing--right {
  border-left        : 1px solid var(--dock-separator);
  justify-content    : flex-end;
}

/* Wing label — ⟐ glyph, very muted */
.dock-wing-label {
  font-size          : 10px;
  color              : var(--dock-text-muted);
  letter-spacing     : 0.05em;
  pointer-events     : none;
}

/* ── Centre tray ─────────────────────────────────────────────────────────── */

#dock-tray {
  flex               : 1 1 auto;
  height             : 100%;
  display            : flex;
  align-items        : center;
  justify-content    : center;
  gap                : ${ICON_GAP}px;
  padding            : 0 12px;
  overflow           : hidden;
  position           : relative;
}

/* Empty-state hint — visible only when tray has no icons */
#dock-tray-hint {
  font-size          : 9px;
  color              : var(--dock-text-muted);
  letter-spacing     : 0.12em;
  text-transform     : uppercase;
  pointer-events     : none;
  white-space        : nowrap;
  position           : absolute;
  transition         : opacity 0.3s ease;
}

#dock-tray-hint.hidden {
  opacity            : 0;
}

/* ── Docked icon button ──────────────────────────────────────────────────── */

.dock-icon {
  --sz               : ${ICON_SIZE}px;

  width              : var(--sz);
  height             : var(--sz);
  flex-shrink        : 0;

  display            : flex;
  align-items        : center;
  justify-content    : center;
  flex-direction     : column;
  gap                : 1px;

  background         : var(--dock-icon-bg);
  border             : 1px solid rgba(255, 255, 255, 0.10);
  border-radius      : 7px;

  font-family        : var(--mono);
  font-size          : 10px;
  color              : var(--dock-text);
  line-height        : 1;
  letter-spacing     : 0;

  cursor             : pointer;
  position           : relative;
  overflow           : hidden;

  /* entry starts from this state — GSAP animates to 1 */
  transform          : scale(0.4);
  opacity            : 0;

  transition         : background 0.15s ease, border-color 0.15s ease,
                       box-shadow 0.15s ease;
}

.dock-icon:hover {
  background         : var(--dock-icon-hover);
  border-color       : rgba(255, 255, 255, 0.22);
  box-shadow         : var(--dock-glow);
}

.dock-icon:active {
  background         : var(--dock-icon-active);
  transform          : scale(0.92) !important;
}

/* Glyph label — main identifier text (e.g. ⟐N) */
.dock-icon-label {
  font-size          : 11px;
  color              : var(--dock-accent);
  pointer-events     : none;
  white-space        : nowrap;
}

/* Sub-label — one line below, very small, for future use */
.dock-icon-sub {
  font-size          : 7px;
  color              : var(--dock-text-muted);
  pointer-events     : none;
  white-space        : nowrap;
  text-transform     : uppercase;
  letter-spacing     : 0.05em;
}

/* ── Drop-zone highlight — lit when a PanelIcon is dragged over ─────────── */

#omni-dock.drag-over #dock-tray {
  background         : rgba(255, 255, 255, 0.04);
  border-radius      : 6px;
}

#omni-dock.drag-over {
  border-top         : 1px solid rgba(255, 255, 255, 0.22);
  box-shadow         : 0 -2px 18px rgba(255, 255, 255, 0.06);
}

/* ── Tooltip ─────────────────────────────────────────────────────────────── */

.dock-icon::after {
  content            : attr(data-tooltip);
  position           : absolute;
  bottom             : calc(100% + 6px);
  left               : 50%;
  transform          : translateX(-50%) translateY(4px);
  background         : rgba(10, 10, 14, 0.92);
  border             : 1px solid rgba(255,255,255,0.12);
  color              : var(--dock-accent);
  font-size          : 9px;
  padding            : 3px 6px;
  border-radius      : 4px;
  white-space        : nowrap;
  pointer-events     : none;
  opacity            : 0;
  transition         : opacity 0.15s ease, transform 0.15s ease;
  letter-spacing     : 0.06em;
  backdrop-filter    : blur(8px);
}

.dock-icon:hover::after {
  opacity            : 1;
  transform          : translateX(-50%) translateY(0);
}

/* ── Mobile ──────────────────────────────────────────────────────────────── */

@media (max-width: 460px) {
  .dock-wing {
    width            : 40px;
    padding          : 0 6px;
  }
}

`

// ── Helpers ──────────────────────────────────────────────────────────────────

function injectStyles () {
  if (document.getElementById('omni-dock-styles')) return
  const tag = document.createElement('style')
  tag.id          = 'omni-dock-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

// ── Dock class ───────────────────────────────────────────────────────────────

export default class Dock {

  /**
   * @param {object} context  — { scene, camera, renderer, sizes, ticker, Sound }
   */
  constructor (context) {
    this.ctx    = context
    this._el    = null         // root element  #omni-dock
    this._tray  = null         // #dock-tray
    this._hint  = null         // #dock-tray-hint
    this._icons = new Map()    // id → { el, onRestore }
  }

  // ── Module contract ─────────────────────────────────────────────────────

  init () {
    injectStyles()
    this._buildDOM()
    this._bindDragEvents()
  }

  /** No per-frame work needed yet — reserved for future badge animations. */
  update (_delta) {}

  destroy () {
    if (this._el?.parentNode) this._el.parentNode.removeChild(this._el)
    const style = document.getElementById('omni-dock-styles')
    if (style) style.remove()
    this._icons.clear()
  }

  // ── Public API ──────────────────────────────────────────────────────────

  /**
   * Insert a docked icon into the tray with entry animation.
   *
   * @param {object} opts
   * @param {string}   opts.id         Unique identifier (e.g. 'omninode')
   * @param {string}   opts.label      Display glyph string (e.g. '⟐N')
   * @param {string}   [opts.tooltip]  Longer name for tooltip (e.g. 'OmniNode')
   * @param {Function} [opts.onRestore] Called when icon is clicked to re-open
   */
  addIcon ({ id, label, tooltip = '', onRestore = null }) {
    if (this._icons.has(id)) return   // already docked

    const el = document.createElement('button')
    el.className     = 'dock-icon'
    el.dataset.id    = id
    el.dataset.tooltip = tooltip || label
    el.setAttribute('aria-label', `Restore ${tooltip || label}`)

    el.innerHTML = /* html */`
      <span class="dock-icon-label">${label}</span>
    `

    el.addEventListener('click', () => this._onIconClick(id))

    this._tray.appendChild(el)
    this._icons.set(id, { el, onRestore })
    this._updateHint()

    // Entry animation — scale + fade in from compressed state
    gsap.to(el, {
      scale    : 1,
      opacity  : 1,
      duration : ENTRY_DUR,
      ease     : 'back.out(1.4)',
    })

    this._playSound('click')
  }

  /**
   * Remove a docked icon with exit animation, then destroy the element.
   * @param {string} id
   */
  removeIcon (id) {
    const entry = this._icons.get(id)
    if (!entry) return
    const { el } = entry

    gsap.to(el, {
      scale    : 0.3,
      opacity  : 0,
      duration : EXIT_DUR,
      ease     : 'power2.in',
      onComplete: () => {
        el.remove()
        this._icons.delete(id)
        this._updateHint()
      },
    })
  }

  /** @returns {boolean} */
  hasIcon (id) {
    return this._icons.has(id)
  }

  /** @returns {number} Dock height in px — for panels to calculate clearance. */
  getHeight () {
    return DOCK_H
  }

  /**
   * Batch dock several icons at once with a visual stagger.
   * Useful when restoring a saved session.
   *
   * @param {Array<{id, label, tooltip, onRestore}>} items
   */
  addIcons (items) {
    items.forEach((item, i) => {
      // Delay each icon's entry tween by stagger offset
      setTimeout(() => this.addIcon(item), i * ENTRY_STAGGER * 1000)
    })
  }

  // ── DOM ─────────────────────────────────────────────────────────────────

  _buildDOM () {
    const el = document.createElement('div')
    el.id = 'omni-dock'
    el.innerHTML = /* html */`

      <!-- Left wing — reserved for future permanent slots -->
      <div class="dock-wing dock-wing--left" aria-hidden="true">
        <span class="dock-wing-label">⟐</span>
      </div>

      <!-- Centre tray — docked ⟐ icons live here -->
      <div id="dock-tray" role="toolbar" aria-label="Docked panels">
        <span id="dock-tray-hint">no docked panels</span>
      </div>

      <!-- Right wing — reserved -->
      <div class="dock-wing dock-wing--right" aria-hidden="true">
        <span class="dock-wing-label">⟐</span>
      </div>

    `

    this._el   = el
    this._tray = el.querySelector('#dock-tray')
    this._hint = el.querySelector('#dock-tray-hint')

    const shell = document.getElementById('omni-ui')
    if (shell) shell.appendChild(el)
    else document.body.appendChild(el)
  }

  // ── Icon click ───────────────────────────────────────────────────────────

  _onIconClick (id) {
    this._playSound('open')

    // Notify any listeners (Panel.js will listen)
    window.dispatchEvent(new CustomEvent('omni:panel-restore', { detail: { id } }))

    // Fire local callback if provided
    const entry = this._icons.get(id)
    if (entry?.onRestore) entry.onRestore(id)

    // Remove from dock — panel is re-opening
    this.removeIcon(id)
  }

  // ── Hint visibility ──────────────────────────────────────────────────────

  _updateHint () {
    if (!this._hint) return
    if (this._icons.size > 0) {
      this._hint.classList.add('hidden')
    } else {
      this._hint.classList.remove('hidden')
    }
  }

  // ── Drag-over highlight (for PanelIcon drop targeting) ───────────────────

  _bindDragEvents () {
    // PanelIcon.js dispatches 'omni:dock-dragover' / 'omni:dock-dragleave'
    // to light up the dock during a drag gesture.
    window.addEventListener('omni:dock-dragover', () => {
      this._el?.classList.add('drag-over')
    })

    window.addEventListener('omni:dock-dragleave', () => {
      this._el?.classList.remove('drag-over')
    })

    // PanelIcon.js dispatches 'omni:dock-drop' with { id, label, tooltip, onRestore }
    // when the user drops a panel icon onto the dock.
    window.addEventListener('omni:dock-drop', (e) => {
      this._el?.classList.remove('drag-over')
      if (e.detail) this.addIcon(e.detail)
    })
  }

  // ── Sound ────────────────────────────────────────────────────────────────

  _playSound (id) {
    try {
      const Sound = this.ctx?.Sound
      if (Sound && typeof Sound.play === 'function') Sound.play(id)
    } catch (_) {}
  }
}
