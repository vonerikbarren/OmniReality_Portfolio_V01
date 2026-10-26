/**
 * ui/NavMapPanel.js — ⟐NavMapPanel
 *
 * Fast-travel panel for testing a room's nodes directly, without
 * waiting on the fixed-path travel system (explicitly deferred).
 * Clicking a node snaps the camera straight to it and pushes a real
 * notification via OmniNotifyPanel — "there needs to be a
 * notification letting the user know where they are going," now
 * genuinely true, not just a shell.
 *
 * Deliberately built generic — "every Navbar will have a
 * NavMapPanel" — so any future room (not just OmniLandingRoom) can
 * get one by constructing this with its own node list, rather than
 * this being a one-off tied to a single room.
 */

import gsap from 'gsap'
import * as WindowManager from './WindowManager.js'

const STYLES = `

.omni-navmap-panel {
  pointer-events   : auto;
  position         : fixed;
  width            : 220px;
  min-width        : 180px;
  max-width        : 90vw;
  height           : 320px;
  min-height       : 200px;
  max-height       : 80vh;

  display          : flex;
  flex-direction   : column;

  background       : var(--omni-theme-bg, rgba(8, 8, 12, 0.92));
  backdrop-filter  : blur(20px) saturate(1.5);
  -webkit-backdrop-filter: blur(20px) saturate(1.5);
  border           : 1px solid var(--omni-theme-border, rgba(255,255,255,0.09));
  border-radius    : 12px;
  box-shadow       : 0 0 20px rgba(0,0,0,0.4), 0 10px 30px rgba(0,0,0,0.5);

  font-family      : 'Courier New', Courier, monospace;
  z-index          : 60;
  overflow         : hidden;
  resize           : both;
  opacity          : 0;
  visibility       : hidden;
}

.nm-header {
  height           : 34px;
  flex-shrink      : 0;
  display          : flex;
  align-items      : center;
  justify-content  : center;
  background       : var(--omni-theme-header-bg, rgba(255,255,255,0.03));
  border-bottom    : 1px solid var(--omni-theme-border, rgba(255,255,255,0.09));
  cursor           : grab;
  user-select      : none;
  font-size        : 11px;
  color            : var(--omni-theme-text-dim, rgba(255,255,255,0.7));
  position         : relative;
  padding          : 0 36px;   /* V191: room for the close (and maximize) buttons on the right */
}
.nm-controls { position: absolute; right: 6px; top: 0; bottom: 0; display: flex; align-items: center; gap: 4px; }
.nm-ctrl {
  width: 22px; height: 22px; padding: 0; border-radius: 5px; cursor: pointer;
  background: transparent; border: 1px solid transparent; color: inherit;
  font: inherit; font-size: 14px; line-height: 1;
}
.nm-ctrl:hover, .nm-ctrl:focus-visible { background: rgba(255,255,255,0.10); border-color: rgba(255,255,255,0.18); outline: none; }
.omni-navmap-panel:focus { outline: none; }

.nm-list { flex: 1 1 auto; overflow-y: auto; padding: 8px; }
.nm-item {
  padding          : 8px 10px;
  border-radius    : 6px;
  margin-bottom    : 4px;
  font-size        : 11px;
  color            : var(--omni-theme-text, rgba(255,255,255,0.9));
  cursor           : pointer;
  display          : flex;
  justify-content  : space-between;
  border           : 1px solid transparent;
}
.nm-item:hover { background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.15); }
.nm-item-geo { color: var(--omni-theme-text-dim, rgba(255,255,255,0.4)); font-size: 9px; }

`

function injectStyles () {
  if (document.getElementById('omni-navmap-panel-styles')) return
  const tag = document.createElement('style')
  tag.id = 'omni-navmap-panel-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

export default class NavMapPanel {
  /**
   * @param {object} context — shared camera/etc context
   * @param {object} room — any object exposing `.nodes` (array of
   *   { key, label, geometryType, position }) — not tied to
   *   OmniLandingRoom specifically, per the "every Navbar" request.
   * @param {string} [navLabel='⟐NavMap'] — the drawer label this
   *   panel listens for, so multiple NavMapPanels (one per future
   *   Navbar) don't collide on the same nav-select string.
   */
  constructor (context, room, navLabel = '⟐NavMap') {
    this.ctx = context
    this.room = room
    this.navLabel = navLabel
    this._el = null
    this._isOpen = false
    this._onNavSelect = null
  }

  init () {
    injectStyles()
    this._onNavSelect = (e) => {
      if (e.detail?.item !== this.navLabel) return
      this.open()
    }
    window.addEventListener('omni:nav-select', this._onNavSelect)
  }

  update () {}
  onResize () {}

  destroy () {
    window.removeEventListener('omni:nav-select', this._onNavSelect)
    this._el?.parentNode?.removeChild(this._el)
    WindowManager.unregister('navmap-' + this.navLabel)
  }

  open () {
    if (!this._el) this._el = this._buildDOM()
    const shell = document.getElementById('omni-ui') ?? document.body
    if (!this._el.parentNode) shell.appendChild(this._el)
    gsap.killTweensOf(this._el)   // a re-open during the close fade must not be hidden by its onComplete
    this._el.style.visibility = 'visible'
    gsap.to(this._el, { opacity: WindowManager.getPanelOpacity(), duration: 0.25 })
    WindowManager.bringToFront('navmap-' + this.navLabel)   // V191: on top, and on a phone pulled fully on-screen (the cascade spot left the close button off the right edge)
    this._isOpen = true
    try { this._el.focus({ preventScroll: true }) } catch (_) { /* detached */ }
  }

  close () {
    if (!this._el) return
    const el = this._el
    gsap.killTweensOf(el)
    gsap.to(el, { opacity: 0, duration: 0.18, onComplete: () => { if (!this._isOpen) el.style.visibility = 'hidden' } })
    this._isOpen = false
    if (el.contains(document.activeElement)) { try { document.activeElement.blur() } catch (_) { /* ignore */ } }
  }

  /** Real fast-travel: snaps the camera directly to the node's real
   *  position, and pushes a real, honest notification via the real
   *  OmniNotify system — not a placeholder alert. */
  travelTo (node) {
    const cam = this.ctx.camera
    if (cam) {
      const offset = node.position.clone().normalize().multiplyScalar(6)
      cam.position.copy(node.position).add(offset)
      cam.lookAt(node.position)
    }
    window.dispatchEvent(new CustomEvent('omni:notify-push', {
      detail: { text: `⟐ Traveling to: ${node.label} (${node.geometryType.replace('Geometry', '')})` }
    }))
    window.dispatchEvent(new CustomEvent('omni:navmap-traveled', { detail: { key: node.key } }))
  }

  _buildDOM () {
    const el = document.createElement('div')
    el.className = 'omni-navmap-panel'
    el.innerHTML = `
      <div class="nm-header">
        <span class="nm-title">${this.navLabel}</span>
        <div class="nm-controls">
          <button class="nm-ctrl" data-action="close" title="Close" aria-label="Close ${this.navLabel}"
            data-omni-tip="Close" data-omni-tip-key="Esc" data-omni-tip-desc="Closes the NavMap. Open it again from the ribbon Home tab (NavMap) or the nav drawer. Esc also closes it while the panel is focused.">×</button>
        </div>
      </div>
      <div class="nm-list" id="nm-list"></div>
    `
    const list = el.querySelector('#nm-list')
    this.room.nodes.forEach(node => {
      const item = document.createElement('div')
      item.className = 'nm-item'
      item.innerHTML = `<span>${node.label}</span><span class="nm-item-geo">${node.geometryType.replace('Geometry', '')}</span>`
      item.addEventListener('click', () => this.travelTo(node))
      list.appendChild(item)
    })

    this._bindHeader(el)
    el.tabIndex = -1   // focusable, so Escape can close it ONLY while the panel itself has focus
    el.setAttribute('role', 'dialog')
    el.setAttribute('aria-label', this.navLabel)
    el.querySelector('[data-action="close"]').addEventListener('click', () => this.close())
    el.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || e.defaultPrevented || !this._isOpen) return
      e.preventDefault(); e.stopPropagation()
      this.close()
    })
    el.dataset.winId = 'navmap-' + this.navLabel
    WindowManager.register('navmap-' + this.navLabel, el, this.navLabel)
    WindowManager.watchPanelOpacity(el, () => this._isOpen)

    return el
  }

  _bindHeader (el) {
    const header = el.querySelector('.nm-header')
    const drag = { active: false }
    const onDown = (e) => {
      if (e.target.closest?.('button')) return   // V191: the close / maximize buttons are not drag handles
      const cx = e.touches?.[0]?.clientX ?? e.clientX
      const cy = e.touches?.[0]?.clientY ?? e.clientY
      const rect = el.getBoundingClientRect()
      drag.active = true; drag.startX = cx; drag.startY = cy; drag.originX = rect.left; drag.originY = rect.top
    }
    const onMove = (e) => {
      if (!drag.active) return
      const cx = e.touches?.[0]?.clientX ?? e.clientX
      const cy = e.touches?.[0]?.clientY ?? e.clientY
      gsap.set(el, { left: drag.originX + (cx - drag.startX), top: drag.originY + (cy - drag.startY) })
    }
    const onUp = () => { drag.active = false }
    header.addEventListener('mousedown', onDown)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    header.addEventListener('touchstart', onDown, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', onUp)
  }
}
