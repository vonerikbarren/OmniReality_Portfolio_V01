/**
 * ui/Drawer.js — ⟐mniReality Drawer Component
 *
 * Top-level sliding drawers — one from the LEFT (⟐mniMenu, owned by ⟐mniHand),
 * one from the RIGHT (⟐NavMenu, owned by ⟐ConsciousHand).
 *
 * Drawers sit beneath the Global Bar and above the Dock. They slide in
 * horizontally from off-screen and occupy the full available height between
 * the two persistent bars.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Left drawer  — ⟐mniMenu  — system / OS-level navigation (10 flat items)
 * Right drawer — ⟐NavMenu  — public / user-facing navigation (nested tree)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Nav tree (right drawer) supports one level of children. Top-level items
 * with children render an expand arrow; clicking expands with a GSAP height
 * tween. Clicking a leaf item fires `omni:nav-select`.
 *
 * Events consumed (from window):
 *   omni:hamburger   →  { hand: 'omnihand'|'conscious', open: bool }
 *                       Opens or closes the matching drawer.
 *
 * Events dispatched (to window):
 *   omni:nav-select  →  { drawer, item, parent|null, path }
 *   omni:hamburger   →  { hand, type:'drawer', dir, open: false }
 *                       Re-emitted when drawer self-closes (✕ button) so
 *                       Hand.js can clear its ☰ active state.
 *
 * Public API:
 *   drawer.open()
 *   drawer.close()
 *   drawer.toggle()
 *   drawer.isOpen   → boolean
 *
 * Usage (via factory):
 *   import { createDrawers } from './ui/Drawer.js'
 *   const { left, right } = createDrawers(context)
 *   left.init()
 *   right.init()
 *
 * Follows the standard module contract (constructor / init / update / destroy).
 */

import gsap from 'gsap'

// ── Layout constants (must match GlobalBar and Dock) ──────────────────────────

const BAR_H   = 36    // px — GlobalBar collapsed height
const DOCK_H  = 52    // px — Dock height
const WIDTH   = 300   // px — drawer width (desktop)
const OPEN_D  = 0.34  // s  — open tween duration
const CLOSE_D = 0.26  // s  — close tween duration

// ── Nav content ───────────────────────────────────────────────────────────────

const LEFT_ITEMS = [
  { label: '⟐OmniExp'        },
  { label: '⟐Admin'          },
  { label: '⟐Experiences'    },
  { label: '⟐Realities'      },
  { label: '⟐Governance'     },
  { label: '⟐Systems'        },
  { label: '⟐Intelligence'   },
  { label: '⟐Infrastructure' },
  { label: '⟐Experience'     },
  { label: '⟐Objects'        },
]

const RIGHT_ITEMS = [
  { label: '⟐Account',        children: ['Login', 'Profile', 'Dashboard'] },
  { label: '⟐Home'                                                         },
  { label: '⟐About',          children: ['About Me', 'About Supporters']  },
  { label: '⟐Portfolio',      children: ['2D Projects', '3D Projects', 'XD Projects'] },
  { label: '⟐Work'                                                         },
  { label: '⟐Products'                                                     },
  { label: '⟐Services'                                                     },
  { label: '⟐Resources'                                                    },
  { label: '⟐SocialNetworks', children: ['LinkTree', 'Communities', 'Collaborators'] },
  { label: '⟐OmniChannels',   children: [
    'OmniFeeds: Updates',
    'OmniFeeds: Logs',
    'OmniFeeds: Drops',
    'OmniFeeds: Perspectives',
    'OmniFeeds: Experiments',
    'OmniFeeds: Media',
  ]},
  { label: '⟐Contact'                                                      },
]

// ── Stylesheet ────────────────────────────────────────────────────────────────

const STYLES = /* css */`

/* ── Drawer root ──────────────────────────────────────────────────────────── */

.omni-drawer {
  --dr-bg          : rgba(8, 8, 12, 0.88);
  --dr-border      : rgba(255, 255, 255, 0.08);
  --dr-separator   : rgba(255, 255, 255, 0.05);
  --dr-text        : rgba(255, 255, 255, 0.80);
  --dr-text-dim    : rgba(255, 255, 255, 0.35);
  --dr-text-muted  : rgba(255, 255, 255, 0.18);
  --dr-accent      : rgba(255, 255, 255, 0.95);
  --dr-hover-bg    : rgba(255, 255, 255, 0.05);
  --dr-active-bg   : rgba(255, 255, 255, 0.10);
  --dr-glow        : 0 0 10px rgba(255, 255, 255, 0.15);
  --dr-child-indent: 16px;
  --mono           : 'Courier New', Courier, monospace;

  position         : fixed;
  top              : ${BAR_H}px;
  width            : ${WIDTH}px;
  height           : calc(100% - ${BAR_H}px - ${DOCK_H}px);
  max-height       : calc(100% - ${BAR_H}px - ${DOCK_H}px);

  display          : flex;
  flex-direction   : column;

  background       : var(--dr-bg);
  backdrop-filter  : blur(22px) saturate(1.5);
  -webkit-backdrop-filter: blur(22px) saturate(1.5);

  font-family      : var(--mono);
  color            : var(--dr-text);
  z-index          : 45;
  pointer-events   : auto;
  user-select      : none;
  overflow         : hidden;

  -webkit-font-smoothing: antialiased;

  /* Hidden off-screen by default — GSAP controls translateX */
  visibility       : hidden;
}

/* ── Left drawer ──────────────────────────────────────────────────────────── */

.omni-drawer--left {
  left             : 0;
  border-right     : 1px solid var(--dr-border);
  border-bottom    : 1px solid var(--dr-border);
  border-radius    : 0 0 10px 0;
}

/* ── Right drawer ─────────────────────────────────────────────────────────── */

.omni-drawer--right {
  right            : 0;
  border-left      : 1px solid var(--dr-border);
  border-bottom    : 1px solid var(--dr-border);
  border-radius    : 0 0 0 10px;
}

/* ── Header ───────────────────────────────────────────────────────────────── */

.drawer-header {
  flex-shrink      : 0;
  display          : flex;
  align-items      : center;
  justify-content  : space-between;
  padding          : 0 14px;
  height           : 42px;
  border-bottom    : 1px solid var(--dr-separator);
}

.drawer-title {
  font-size        : 11px;
  color            : var(--dr-accent);
  letter-spacing   : 0.12em;
  text-transform   : uppercase;
}

.drawer-close {
  width            : 26px;
  height           : 26px;
  display          : flex;
  align-items      : center;
  justify-content  : center;
  background       : none;
  border           : 1px solid rgba(255,255,255,0.10);
  border-radius    : 5px;
  color            : var(--dr-text-dim);
  font-family      : var(--mono);
  font-size        : 11px;
  cursor           : pointer;
  transition       : background 0.15s ease, color 0.15s ease;
}

.drawer-close:hover {
  background       : rgba(255,255,255,0.08);
  color            : var(--dr-accent);
}

/* ── Scrollable body ──────────────────────────────────────────────────────── */

.drawer-body {
  flex             : 1 1 auto;
  overflow-y       : auto;
  overflow-x       : hidden;
  padding          : 8px 0;

  scrollbar-width  : thin;
  scrollbar-color  : rgba(255,255,255,0.10) transparent;
}

.drawer-body::-webkit-scrollbar        { width: 3px; }
.drawer-body::-webkit-scrollbar-track  { background: transparent; }
.drawer-body::-webkit-scrollbar-thumb  { background: rgba(255,255,255,0.10); border-radius: 2px; }

/* ── Nav item — top-level row ─────────────────────────────────────────────── */

.drawer-item {
  display          : flex;
  flex-direction   : column;
}

.drawer-item-row {
  display          : flex;
  align-items      : center;
  justify-content  : space-between;
  padding          : 0 16px;
  height           : 38px;
  cursor           : pointer;
  transition       : background 0.12s ease;
  position         : relative;
}

.drawer-item-row:hover {
  background       : var(--dr-hover-bg);
}

.drawer-item-row:active,
.drawer-item-row.is-active {
  background       : var(--dr-active-bg);
}

/* Left accent line on active item */
.drawer-item-row.is-active::before {
  content          : '';
  position         : absolute;
  left             : 0;
  top              : 20%;
  height           : 60%;
  width            : 2px;
  background       : rgba(255,255,255,0.55);
  border-radius    : 0 2px 2px 0;
}

.drawer-item-label {
  font-size        : 12px;
  color            : var(--dr-text);
  letter-spacing   : 0.04em;
  pointer-events   : none;
  flex             : 1 1 auto;
  overflow         : hidden;
  text-overflow    : ellipsis;
  white-space      : nowrap;
}

.drawer-item-row:hover .drawer-item-label {
  color            : var(--dr-accent);
}

/* Expand arrow — only on items with children */
.drawer-item-arrow {
  font-size        : 9px;
  color            : var(--dr-text-muted);
  pointer-events   : none;
  flex-shrink      : 0;
  margin-left      : 8px;
  transition       : transform 0.20s ease, color 0.15s ease;
  display          : inline-block;
}

.drawer-item--expanded .drawer-item-arrow {
  transform        : rotate(90deg);
  color            : var(--dr-text-dim);
}

/* ── Children container ───────────────────────────────────────────────────── */

.drawer-children {
  overflow         : hidden;
  height           : 0;   /* GSAP animates this to auto-height equivalent */
}

.drawer-child-item {
  display          : flex;
  align-items      : center;
  padding          : 0 16px 0 calc(16px + var(--dr-child-indent));
  height           : 32px;
  cursor           : pointer;
  transition       : background 0.12s ease;
  position         : relative;
}

.drawer-child-item:hover {
  background       : var(--dr-hover-bg);
}

.drawer-child-item:active {
  background       : var(--dr-active-bg);
}

/* Connector line */
.drawer-child-item::before {
  content          : '';
  position         : absolute;
  left             : calc(16px + 6px);
  top              : 50%;
  width            : 6px;
  height            : 1px;
  background       : rgba(255,255,255,0.12);
}

.drawer-child-label {
  font-size        : 11px;
  color            : var(--dr-text-dim);
  letter-spacing   : 0.03em;
  pointer-events   : none;
  overflow         : hidden;
  text-overflow    : ellipsis;
  white-space      : nowrap;
}

.drawer-child-item:hover .drawer-child-label {
  color            : var(--dr-text);
}

/* ── Section divider (thin rule between nav items) ────────────────────────── */

.drawer-divider {
  height           : 1px;
  margin           : 4px 16px;
  background       : var(--dr-separator);
}

/* ── Footer — drawer identity ─────────────────────────────────────────────── */

.drawer-footer {
  flex-shrink      : 0;
  padding          : 10px 16px;
  border-top       : 1px solid var(--dr-separator);
  display          : flex;
  align-items      : center;
  gap              : 6px;
}

.drawer-footer-glyph {
  font-size        : 9px;
  color            : var(--dr-text-muted);
  letter-spacing   : 0.10em;
  text-transform   : uppercase;
}

/* ── Overlay scrim — behind the drawer, catches outside clicks ───────────── */

.omni-drawer-scrim {
  position         : fixed;
  inset            : 0;
  z-index          : 44;
  background       : transparent;
  pointer-events   : none;
  opacity          : 0;
  transition       : opacity 0.3s ease;
}

.omni-drawer-scrim.active {
  pointer-events   : auto;
}

/* ── Mobile ───────────────────────────────────────────────────────────────── */

@media (max-width: 560px) {
  .omni-drawer {
    width          : 85vw;
  }
}

`

// ── Style injection ───────────────────────────────────────────────────────────

function injectStyles () {
  if (document.getElementById('omni-drawer-styles')) return
  const tag = document.createElement('style')
  tag.id          = 'omni-drawer-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

// ── Drawer class ──────────────────────────────────────────────────────────────

export default class Drawer {

  /**
   * @param {object} context  — { scene, camera, renderer, sizes, ticker, Sound }
   * @param {object} config
   * @param {string}   config.id        — 'left' | 'right'
   * @param {string}   config.dir       — 'left' | 'right'
   * @param {string}   config.hand      — matching hand id ('omnihand' | 'conscious')
   * @param {string}   config.title     — header label (e.g. '⟐mniMenu')
   * @param {Array}    config.items     — nav tree array (see LEFT_ITEMS / RIGHT_ITEMS)
   */
  constructor (context, config) {
    this.ctx    = context
    this.cfg    = config
    this._el    = null
    this._scrim = null
    this._open  = false

    // Track expanded state of parent items { label → bool }
    this._expanded = {}
  }

  // ── Module contract ──────────────────────────────────────────────────────

  init () {
    injectStyles()
    this._buildDOM()
    this._bindEvents()
    this._listen()
  }

  update (_delta) {}

  destroy () {
    if (this._el?.parentNode)    this._el.parentNode.removeChild(this._el)
    if (this._scrim?.parentNode) this._scrim.parentNode.removeChild(this._scrim)
    window.removeEventListener('omni:hamburger', this._onHamburger)
  }

  // ── Public API ───────────────────────────────────────────────────────────

  get isOpen () { return this._open }

  open () {
    if (this._open) return
    this._open = true

    this._el.style.visibility = 'visible'
    this._scrim.classList.add('active')

    const x = this.cfg.dir === 'left' ? '-100%' : '100%'
    gsap.fromTo(this._el,
      { x },
      { x: '0%', duration: OPEN_D, ease: 'power3.out' }
    )

    this._playSound('open')
  }

  close () {
    if (!this._open) return
    this._open = false

    const x = this.cfg.dir === 'left' ? '-100%' : '100%'

    gsap.to(this._el, {
      x        : x,
      duration : CLOSE_D,
      ease     : 'power2.in',
      onComplete: () => {
        this._el.style.visibility = 'hidden'
      }
    })

    this._scrim.classList.remove('active')
    this._playSound('close')

    // Notify Hand.js to clear ☰ active state
    window.dispatchEvent(new CustomEvent('omni:hamburger', {
      detail: {
        hand : this.cfg.hand,
        type : 'drawer',
        dir  : this.cfg.dir,
        open : false,
      }
    }))
  }

  toggle () {
    this._open ? this.close() : this.open()
  }

  // ── DOM ──────────────────────────────────────────────────────────────────

  _buildDOM () {
    // Scrim — catches outside-click to close
    const scrim = document.createElement('div')
    scrim.className = 'omni-drawer-scrim'
    scrim.id        = `omni-drawer-scrim-${this.cfg.id}`

    // Drawer root
    const el = document.createElement('div')
    el.id        = `omni-drawer-${this.cfg.id}`
    el.className = `omni-drawer omni-drawer--${this.cfg.dir}`
    el.setAttribute('aria-label', this.cfg.title)
    el.setAttribute('role', 'navigation')

    el.innerHTML = /* html */`
      <div class="drawer-header">
        <span class="drawer-title">${this.cfg.title}</span>
        <button class="drawer-close" aria-label="Close drawer">✕</button>
      </div>
      <div class="drawer-body">
        <nav class="drawer-nav" id="drawer-nav-${this.cfg.id}">
          ${this._buildNavHTML(this.cfg.items)}
        </nav>
      </div>
      <div class="drawer-footer">
        <span class="drawer-footer-glyph">⟐ ${this.cfg.hand === 'omnihand' ? 'mniHand' : 'ConsciousHand'}</span>
      </div>
    `

    // Set initial off-screen position without animation
    const offX = this.cfg.dir === 'left' ? '-100%' : '100%'
    gsap.set(el, { x: offX })

    this._el    = el
    this._scrim = scrim

    const shell = document.getElementById('omni-ui')
    const mount = shell ?? document.body
    mount.appendChild(scrim)
    mount.appendChild(el)
  }

  _buildNavHTML (items) {
    return items.map((item, i) => {
      const hasChildren = item.children?.length > 0
      const slug        = this._slug(item.label)

      if (hasChildren) {
        const childrenHTML = item.children.map(child => /* html */`
          <div class="drawer-child-item"
               data-parent="${slug}"
               data-child="${this._slug(child)}"
               data-label="${child}"
               role="menuitem"
               tabindex="-1">
            <span class="drawer-child-label">${child}</span>
          </div>
        `).join('')

        return /* html */`
          <div class="drawer-item drawer-item--has-children" data-slug="${slug}">
            <div class="drawer-item-row"
                 data-slug="${slug}"
                 data-label="${item.label}"
                 data-has-children="true"
                 role="menuitem"
                 tabindex="0"
                 aria-expanded="false"
                 aria-haspopup="true">
              <span class="drawer-item-label">${item.label}</span>
              <span class="drawer-item-arrow">▸</span>
            </div>
            <div class="drawer-children" id="drawer-children-${slug}" aria-hidden="true">
              ${childrenHTML}
            </div>
          </div>
          ${i < items.length - 1 ? '' : ''}
        `
      }

      return /* html */`
        <div class="drawer-item" data-slug="${slug}">
          <div class="drawer-item-row"
               data-slug="${slug}"
               data-label="${item.label}"
               role="menuitem"
               tabindex="0">
            <span class="drawer-item-label">${item.label}</span>
          </div>
        </div>
      `
    }).join('')
  }

  // ── Events ───────────────────────────────────────────────────────────────

  _bindEvents () {
    // Close button
    this._el.querySelector('.drawer-close').addEventListener('click', () => {
      this.close()
    })

    // Scrim click — close
    this._scrim.addEventListener('click', () => {
      this.close()
    })

    // Nav interaction — delegation
    this._el.querySelector('.drawer-nav').addEventListener('click', (e) => {
      this._handleNavClick(e)
    })

    // Keyboard support on nav rows
    this._el.querySelector('.drawer-nav').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        this._handleNavClick(e)
      }
    })

    // Escape key closes
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this._open) this.close()
    })
  }

  _handleNavClick (e) {
    const row   = e.target.closest('.drawer-item-row')
    const child = e.target.closest('.drawer-child-item')

    if (child) {
      const parent = child.dataset.parent
      const label  = child.dataset.label

      // Clear active on all rows, set on this one
      this._clearActive()
      child.classList.add('is-active')

      this._playSound('click')
      this._emitSelect(label, parent, `${parent}/${this._slug(label)}`)
      return
    }

    if (row) {
      const hasChildren = row.dataset.hasChildren === 'true'
      const slug        = row.dataset.slug
      const label       = row.dataset.label

      if (hasChildren) {
        this._toggleExpand(slug, row)
      } else {
        this._clearActive()
        row.classList.add('is-active')
        this._playSound('click')
        this._emitSelect(label, null, slug)
      }
    }
  }

  // ── Expand / collapse children ───────────────────────────────────────────

  _toggleExpand (slug, rowEl) {
    const isExpanded = this._expanded[slug] ?? false
    const next       = !isExpanded
    this._expanded[slug] = next

    const container = this._el.querySelector(`#drawer-children-${slug}`)
    const arrow     = rowEl.querySelector('.drawer-item-arrow')
    const itemEl    = this._el.querySelector(`.drawer-item[data-slug="${slug}"]`)

    if (!container) return

    this._playSound('click')

    if (next) {
      // Expand — measure natural height then animate
      itemEl?.classList.add('drawer-item--expanded')
      rowEl.setAttribute('aria-expanded', 'true')
      container.setAttribute('aria-hidden', 'false')

      // Temporarily release height to measure
      container.style.height = 'auto'
      const fullH = container.scrollHeight
      container.style.height = '0px'

      gsap.to(container, {
        height   : fullH,
        duration : 0.22,
        ease     : 'power2.out',
        onComplete: () => { container.style.height = 'auto' },
      })

    } else {
      // Collapse
      itemEl?.classList.remove('drawer-item--expanded')
      rowEl.setAttribute('aria-expanded', 'false')
      container.setAttribute('aria-hidden', 'true')

      // Force explicit px before animating to 0
      container.style.height = container.scrollHeight + 'px'

      gsap.to(container, {
        height   : 0,
        duration : 0.18,
        ease     : 'power2.in',
      })
    }
  }

  // ── Listen for Hand.js hamburger events ──────────────────────────────────

  _listen () {
    this._onHamburger = (e) => {
      const d = e.detail
      if (!d || d.hand !== this.cfg.hand) return
      // Ignore the close event that WE fired (open: false)
      if (d.open === true)  this.open()
      if (d.open === false && this._open) this.close()
    }
    window.addEventListener('omni:hamburger', this._onHamburger)
  }

  // ── Emit nav-select ───────────────────────────────────────────────────────

  _emitSelect (item, parent, path) {
    window.dispatchEvent(new CustomEvent('omni:nav-select', {
      detail: {
        drawer : this.cfg.id,
        item,
        parent : parent ?? null,
        path,
      }
    }))
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  _clearActive () {
    this._el.querySelectorAll('.is-active').forEach(el => el.classList.remove('is-active'))
  }

  /** Convert a label to a URL-safe slug for data attributes and IDs */
  _slug (label) {
    return label
      .toLowerCase()
      .replace(/[⟐\s]+/g, '-')
      .replace(/[^a-z0-9\-]/g, '')
      .replace(/^-+|-+$/g, '')
  }

  // ── Sound ─────────────────────────────────────────────────────────────────

  _playSound (id) {
    try {
      const Sound = this.ctx?.Sound
      if (Sound && typeof Sound.play === 'function') Sound.play(id)
    } catch (_) {}
  }
}

// ── Factory ───────────────────────────────────────────────────────────────────

/**
 * Create both drawers pre-configured with their nav content.
 * Returns { left, right } — call .init() on each.
 *
 * @param {object} context
 * @returns {{ left: Drawer, right: Drawer }}
 */
export function createDrawers (context) {
  const left = new Drawer(context, {
    id    : 'left',
    dir   : 'left',
    hand  : 'omnihand',
    title : '⟐mniMenu',
    items : LEFT_ITEMS,
  })

  const right = new Drawer(context, {
    id    : 'right',
    dir   : 'right',
    hand  : 'conscious',
    title : '⟐NavMenu',
    items : RIGHT_ITEMS,
  })

  return { left, right }
}
