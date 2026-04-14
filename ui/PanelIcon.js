/**
 * ui/PanelIcon.js — ⟐mniReality Freeform Panel Icon
 *
 * Manager that listens for `omni:panel-minimized` and spawns a draggable
 * ⟐ icon at the panel's last position. The icon can be:
 *
 *   • Clicked       → dispatches `omni:panel-restore { id }` to re-open
 *   • Dragged       → follows pointer freely anywhere on screen
 *   • Dropped       → if released within the Dock drop-zone, hands off to
 *                     Dock.js via `omni:dock-drop`; icon self-destructs
 *   • Right-clicked → context menu: Restore | Dock | Dismiss
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Lifecycle per icon
 * ─────────────────────────────────────────────────────────────────────────────
 *   1. `omni:panel-minimized` fires with { id, iconLabel, fromRect }
 *   2. Icon spawns at fromRect centre, scales from 0 with a glitch burst
 *   3. User can drag it anywhere — position stored in this._icons Map
 *   4a. Click (no drag) → restore animation → dispatch omni:panel-restore
 *   4b. Drop on Dock   → exit animation → dispatch omni:dock-drop → destroy
 *   4c. Context → Dock → same as 4b
 *   4d. Context → Dismiss → exit animation → destroy (panel stays closed)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Events consumed (window):
 *   omni:panel-minimized   { id, label, iconLabel, fromRect }
 *
 * Events dispatched (window):
 *   omni:panel-restore     { id }
 *   omni:dock-dragover     {}                   — Dock.js lights up drop-zone
 *   omni:dock-dragleave    {}                   — Dock.js dims drop-zone
 *   omni:dock-drop         { id, label, tooltip, onRestore }
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Follows the standard module contract (constructor / init / update / destroy).
 */

import gsap from 'gsap'

// ── Constants ─────────────────────────────────────────────────────────────────

const ICON_SIZE      = 44    // px — icon button diameter
const DOCK_H         = 52    // px — Dock height (bottom strip)
const DOCK_ZONE      = 80    // px — proximity threshold to trigger dock highlight
const DRAG_THRESHOLD = 5     // px — min pointer travel to count as a drag

const ENTRY_DUR      = 0.30  // s  — spawn animation
const EXIT_DUR       = 0.22  // s  — restore / dismiss exit
const DOCK_EXIT_DUR  = 0.28  // s  — slide-to-dock animation
const GLITCH_STEPS   = [     // x offsets for mini glitch on spawn
  -5, 6, -3, 4, -1, 0
]

// ── Stylesheet ────────────────────────────────────────────────────────────────

const STYLES = /* css */`

/* ── Freeform icon ────────────────────────────────────────────────────────── */

.omni-panel-icon {
  --ic-size        : ${ICON_SIZE}px;
  --ic-bg          : rgba(8, 8, 12, 0.88);
  --ic-border      : rgba(255, 255, 255, 0.14);
  --ic-hover-bg    : rgba(255, 255, 255, 0.10);
  --ic-hover-border: rgba(255, 255, 255, 0.28);
  --ic-active-bg   : rgba(255, 255, 255, 0.18);
  --ic-glow        : 0 0 14px rgba(255, 255, 255, 0.22), 0 4px 20px rgba(0,0,0,0.55);
  --ic-drag-glow   : 0 0 22px rgba(255, 255, 255, 0.32), 0 8px 28px rgba(0,0,0,0.65);
  --ic-text        : rgba(255, 255, 255, 0.92);
  --ic-text-sub    : rgba(255, 255, 255, 0.30);
  --mono           : 'Courier New', Courier, monospace;

  position         : fixed;
  width            : var(--ic-size);
  height           : var(--ic-size);
  z-index          : 70;            /* above everything during free drag */

  display          : flex;
  flex-direction   : column;
  align-items      : center;
  justify-content  : center;
  gap              : 2px;

  background       : var(--ic-bg);
  backdrop-filter  : blur(16px) saturate(1.4);
  -webkit-backdrop-filter: blur(16px) saturate(1.4);
  border           : 1px solid var(--ic-border);
  border-radius    : 10px;
  box-shadow       : var(--ic-glow);

  font-family      : var(--mono);
  cursor           : grab;
  user-select      : none;
  touch-action     : none;    /* prevent scroll interference on touch */

  transform-origin : center center;

  /* Entry state — GSAP drives to final */
  opacity          : 0;
  transform        : scale(0.3);

  -webkit-font-smoothing: antialiased;
  transition       : background 0.12s ease, border-color 0.12s ease;
}

.omni-panel-icon:hover {
  background       : var(--ic-hover-bg);
  border-color     : var(--ic-hover-border);
  box-shadow       : var(--ic-drag-glow);
}

.omni-panel-icon.is-dragging {
  cursor           : grabbing;
  box-shadow       : var(--ic-drag-glow);
  z-index          : 80;
}

/* Near dock — glow intensifies, border brightens */
.omni-panel-icon.near-dock {
  border-color     : rgba(255, 255, 255, 0.40);
  box-shadow       : 0 0 28px rgba(255,255,255,0.28), 0 10px 32px rgba(0,0,0,0.70);
}

/* ── Icon label ───────────────────────────────────────────────────────────── */

.panel-icon-glyph {
  font-size        : 13px;
  color            : var(--ic-text);
  line-height      : 1;
  pointer-events   : none;
  letter-spacing   : -0.01em;
}

.panel-icon-sub {
  font-size        : 7px;
  color            : var(--ic-text-sub);
  text-transform   : uppercase;
  letter-spacing   : 0.08em;
  pointer-events   : none;
}

/* ── Tooltip ──────────────────────────────────────────────────────────────── */

.omni-panel-icon::before {
  content          : attr(data-tooltip);
  position         : absolute;
  bottom           : calc(100% + 6px);
  left             : 50%;
  transform        : translateX(-50%) translateY(3px);
  background       : rgba(10, 10, 14, 0.92);
  border           : 1px solid rgba(255,255,255,0.12);
  color            : rgba(255,255,255,0.88);
  font-size        : 9px;
  font-family      : var(--mono);
  padding          : 3px 7px;
  border-radius    : 4px;
  white-space      : nowrap;
  pointer-events   : none;
  opacity          : 0;
  z-index          : 90;
  letter-spacing   : 0.05em;
  backdrop-filter  : blur(8px);
  transition       : opacity 0.14s ease, transform 0.14s ease;
}

.omni-panel-icon:not(.is-dragging):hover::before {
  opacity          : 1;
  transform        : translateX(-50%) translateY(0);
}

/* ── Context menu ─────────────────────────────────────────────────────────── */

.omni-icon-context {
  position         : fixed;
  z-index          : 90;
  background       : rgba(8, 8, 12, 0.94);
  backdrop-filter  : blur(18px);
  border           : 1px solid rgba(255,255,255,0.12);
  border-radius    : 7px;
  padding          : 4px 0;
  min-width        : 130px;
  overflow         : hidden;
  box-shadow       : 0 8px 32px rgba(0,0,0,0.60);
  font-family      : 'Courier New', Courier, monospace;
  pointer-events   : auto;
  user-select      : none;
}

.icon-ctx-item {
  display          : flex;
  align-items      : center;
  gap              : 8px;
  padding          : 0 14px;
  height           : 32px;
  font-size        : 11px;
  color            : rgba(255,255,255,0.75);
  cursor           : pointer;
  transition       : background 0.10s ease, color 0.10s ease;
}

.icon-ctx-item:hover {
  background       : rgba(255,255,255,0.07);
  color            : rgba(255,255,255,0.95);
}

.icon-ctx-item:active {
  background       : rgba(255,255,255,0.13);
}

.icon-ctx-glyph {
  font-size        : 11px;
  opacity          : 0.55;
  flex-shrink      : 0;
}

.icon-ctx-divider {
  height           : 1px;
  margin           : 3px 10px;
  background       : rgba(255,255,255,0.06);
}

/* Dismiss option — subtle danger tint */
.icon-ctx-item--dismiss:hover {
  background       : rgba(255, 60, 60, 0.10);
  color            : rgba(255, 150, 150, 0.90);
}

`

// ── Style injection ───────────────────────────────────────────────────────────

function injectStyles () {
  if (document.getElementById('omni-panelicon-styles')) return
  const tag = document.createElement('style')
  tag.id          = 'omni-panelicon-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

// ── Mini glitch burst ─────────────────────────────────────────────────────────

function glitchBurst (el) {
  const tl = gsap.timeline()
  GLITCH_STEPS.forEach((x, i) => {
    const last = i === GLITCH_STEPS.length - 1
    tl.to(el, {
      x,
      duration: last ? 0.04 : 0.025,
      ease    : 'none',
      ...(last ? { clearProps: 'x' } : {}),
    })
  })
  return tl
}

// ── PanelIcon manager ─────────────────────────────────────────────────────────

export default class PanelIcon {

  /**
   * @param {object} context  — { scene, camera, renderer, sizes, ticker, Sound }
   */
  constructor (context) {
    this.ctx    = context
    // Map of panelId → { el, id, label, iconLabel, pos: {x,y} }
    this._icons = new Map()
    this._contextMenu = null   // active context menu element

    this._onMinimized = null   // bound listener ref
  }

  // ── Module contract ──────────────────────────────────────────────────────

  init () {
    injectStyles()
    this._listen()

    // Close context menu on outside click
    document.addEventListener('pointerdown', (e) => {
      if (this._contextMenu && !this._contextMenu.contains(e.target)) {
        this._destroyContextMenu()
      }
    })
  }

  update (_delta) {}

  destroy () {
    window.removeEventListener('omni:panel-minimized', this._onMinimized)
    // Remove all live icons
    this._icons.forEach(({ el }) => el?.remove())
    this._icons.clear()
    this._destroyContextMenu()

    const style = document.getElementById('omni-panelicon-styles')
    if (style) style.remove()
  }

  // ── Listener — spawn on panel-minimized ──────────────────────────────────

  _listen () {
    this._onMinimized = (e) => {
      const { id, label, iconLabel, fromRect } = e.detail ?? {}
      if (!id) return
      // If icon already exists (double-minimize guard), skip
      if (this._icons.has(id)) return
      this._spawnIcon({ id, label, iconLabel, fromRect })
    }
    window.addEventListener('omni:panel-minimized', this._onMinimized)
  }

  // ── Spawn ─────────────────────────────────────────────────────────────────

  _spawnIcon ({ id, label, iconLabel, fromRect }) {
    // Start position — centre of the panel's last bounding rect
    const startX = (fromRect?.x ?? window.innerWidth  / 2) + (fromRect?.w ?? 0) / 2 - ICON_SIZE / 2
    const startY = (fromRect?.y ?? window.innerHeight / 2) + (fromRect?.h ?? 0) / 2 - ICON_SIZE / 2

    const el = document.createElement('div')
    el.className      = 'omni-panel-icon'
    el.dataset.panelId = id
    el.dataset.tooltip = `${iconLabel} — click to restore`
    el.setAttribute('role', 'button')
    el.setAttribute('aria-label', `Restore ${label}`)
    el.setAttribute('tabindex', '0')

    el.innerHTML = /* html */`
      <span class="panel-icon-glyph">${iconLabel}</span>
      <span class="panel-icon-sub">min</span>
    `

    // Position before mount so no layout flash
    gsap.set(el, { left: startX, top: startY, scale: 0.3, opacity: 0 })

    const shell = document.getElementById('omni-ui') ?? document.body
    shell.appendChild(el)

    // Store entry
    this._icons.set(id, { el, id, label, iconLabel, pos: { x: startX, y: startY } })

    // Entry animation: scale up + glitch burst
    gsap.to(el, {
      scale   : 1,
      opacity : 1,
      duration: ENTRY_DUR,
      ease    : 'back.out(1.6)',
      onComplete: () => glitchBurst(el),
    })

    this._playSound('open')

    // Wire interactions
    this._bindIcon(id, el)
  }

  // ── Bind drag + click + context menu ─────────────────────────────────────

  _bindIcon (id, el) {
    let dragStartX  = 0
    let dragStartY  = 0
    let originLeft  = 0
    let originTop   = 0
    let didDrag     = false
    let nearDock    = false

    // ── Pointer down — begin tracking ──────────────────────────────────────
    const onDown = (e) => {
      if (e.button === 2) return   // right-click handled by contextmenu event

      e.preventDefault()
      didDrag    = false
      nearDock   = false

      const rect = el.getBoundingClientRect()
      originLeft = rect.left
      originTop  = rect.top

      const cx = e.touches ? e.touches[0].clientX : e.clientX
      const cy = e.touches ? e.touches[0].clientY : e.clientY
      dragStartX = cx
      dragStartY = cy

      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup',   onUp)
    }

    // ── Pointer move — drag ────────────────────────────────────────────────
    const onMove = (e) => {
      const cx = e.clientX
      const cy = e.clientY
      const dx = cx - dragStartX
      const dy = cy - dragStartY

      // Threshold — avoid accidental drags on tap
      if (!didDrag && Math.hypot(dx, dy) < DRAG_THRESHOLD) return

      if (!didDrag) {
        didDrag = true
        el.classList.add('is-dragging')
      }

      const newLeft = originLeft + dx
      const newTop  = originTop  + dy

      gsap.set(el, { left: newLeft, top: newTop })

      // Update stored position
      const entry = this._icons.get(id)
      if (entry) entry.pos = { x: newLeft, y: newTop }

      // Dock proximity
      const fromBottom = window.innerHeight - cy
      const isNear     = fromBottom <= DOCK_ZONE

      if (isNear && !nearDock) {
        nearDock = true
        el.classList.add('near-dock')
        window.dispatchEvent(new CustomEvent('omni:dock-dragover'))
      } else if (!isNear && nearDock) {
        nearDock = false
        el.classList.remove('near-dock')
        window.dispatchEvent(new CustomEvent('omni:dock-dragleave'))
      }
    }

    // ── Pointer up — drop ──────────────────────────────────────────────────
    const onUp = (e) => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup',   onUp)

      el.classList.remove('is-dragging')

      if (nearDock) {
        el.classList.remove('near-dock')
        window.dispatchEvent(new CustomEvent('omni:dock-dragleave'))
        this._dockIcon(id)
        return
      }

      if (!didDrag) {
        // Pure click — restore
        this._restoreIcon(id)
      }
    }

    // ── Context menu (right-click / long-press) ────────────────────────────
    const onContext = (e) => {
      e.preventDefault()
      this._showContextMenu(id, e.clientX, e.clientY)
    }

    el.addEventListener('pointerdown',   onDown)
    el.addEventListener('contextmenu',   onContext)

    // Keyboard: Enter / Space → restore
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        this._restoreIcon(id)
      }
    })
  }

  // ── Restore — click to re-open panel ─────────────────────────────────────

  _restoreIcon (id) {
    const entry = this._icons.get(id)
    if (!entry) return

    this._playSound('open')

    // Glitch burst, then scale down to nothing and dispatch restore
    glitchBurst(entry.el).eventCallback('onComplete', () => {
      gsap.to(entry.el, {
        scale   : 0,
        opacity : 0,
        duration: EXIT_DUR,
        ease    : 'power2.in',
        onComplete: () => {
          entry.el.remove()
          this._icons.delete(id)
        }
      })
    })

    window.dispatchEvent(new CustomEvent('omni:panel-restore', { detail: { id } }))
  }

  // ── Dock — slide icon to Dock, hand off, destroy floating icon ───────────

  _dockIcon (id) {
    const entry = this._icons.get(id)
    if (!entry) return

    this._playSound('click')

    // Animate icon sliding down to bottom centre of screen
    const targetX = window.innerWidth  / 2 - ICON_SIZE / 2
    const targetY = window.innerHeight - DOCK_H / 2 - ICON_SIZE / 2

    gsap.to(entry.el, {
      left    : targetX,
      top     : targetY,
      scale   : 0.5,
      opacity : 0,
      duration: DOCK_EXIT_DUR,
      ease    : 'power3.in',
      onComplete: () => {
        entry.el.remove()
        this._icons.delete(id)
      }
    })

    // Hand off to Dock.js — Dock will create and animate its own docked button
    window.dispatchEvent(new CustomEvent('omni:dock-drop', {
      detail: {
        id       : id,
        label    : entry.iconLabel,
        tooltip  : entry.label,
        onRestore: () => {
          window.dispatchEvent(new CustomEvent('omni:panel-restore', { detail: { id } }))
        }
      }
    }))
  }

  // ── Dismiss — destroy icon without restoring panel ───────────────────────

  _dismissIcon (id) {
    const entry = this._icons.get(id)
    if (!entry) return

    this._playSound('close')

    gsap.to(entry.el, {
      scale   : 0,
      opacity : 0,
      duration: EXIT_DUR,
      ease    : 'power2.in',
      onComplete: () => {
        entry.el.remove()
        this._icons.delete(id)
      }
    })
  }

  // ── Context menu ──────────────────────────────────────────────────────────

  _showContextMenu (id, cx, cy) {
    this._destroyContextMenu()

    const entry = this._icons.get(id)
    if (!entry) return

    const menu = document.createElement('div')
    menu.className = 'omni-icon-context'

    menu.innerHTML = /* html */`
      <div class="icon-ctx-item" data-action="restore">
        <span class="icon-ctx-glyph">↩</span>
        <span>Restore</span>
      </div>
      <div class="icon-ctx-item" data-action="dock">
        <span class="icon-ctx-glyph">⬇</span>
        <span>Send to Dock</span>
      </div>
      <div class="icon-ctx-divider"></div>
      <div class="icon-ctx-item icon-ctx-item--dismiss" data-action="dismiss">
        <span class="icon-ctx-glyph">✕</span>
        <span>Dismiss</span>
      </div>
    `

    // Position — keep within viewport
    const menuW = 140
    const menuH = 120
    let left = cx + 6
    let top  = cy + 6
    if (left + menuW > window.innerWidth)  left = cx - menuW - 6
    if (top  + menuH > window.innerHeight) top  = cy - menuH - 6
    gsap.set(menu, { left, top, scale: 0.88, opacity: 0, transformOrigin: 'top left' })

    const shell = document.getElementById('omni-ui') ?? document.body
    shell.appendChild(menu)
    this._contextMenu = menu

    gsap.to(menu, { scale: 1, opacity: 1, duration: 0.16, ease: 'back.out(1.8)' })

    menu.addEventListener('click', (e) => {
      const item   = e.target.closest('.icon-ctx-item')
      if (!item) return
      const action = item.dataset.action
      this._destroyContextMenu()
      switch (action) {
        case 'restore' : this._restoreIcon(id);  break
        case 'dock'    : this._dockIcon(id);     break
        case 'dismiss' : this._dismissIcon(id);  break
      }
    })
  }

  _destroyContextMenu () {
    if (!this._contextMenu) return
    const menu = this._contextMenu
    this._contextMenu = null
    gsap.to(menu, {
      scale  : 0.88,
      opacity: 0,
      duration: 0.12,
      ease   : 'power2.in',
      onComplete: () => menu.remove(),
    })
  }

  // ── Sound ─────────────────────────────────────────────────────────────────

  _playSound (id) {
    try {
      const Sound = this.ctx?.Sound
      if (Sound && typeof Sound.play === 'function') Sound.play(id)
    } catch (_) {}
  }
}
