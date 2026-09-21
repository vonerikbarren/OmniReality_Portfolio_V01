/**
 * ui/AccountDashboardPanel.js — ⟐AccountDashboard
 *
 * Admin-facing analytics: visitor traffic, guest signups tied to
 * whose reality they belong to. Honest, matching the exact
 * "honest placeholder, not filled in" pattern OmniPlayerDashboard
 * itself already uses: no real backend or IP-tracking exists yet, so
 * this shows clearly-labeled example data in the real, intended
 * layout — not invented numbers presented as if they were real.
 */

import gsap from 'gsap'
import * as WindowManager from './WindowManager.js'
import { getActiveIdentity } from '../utils/OmniIdentity.js'

const EXAMPLE_VISITORS = [
  { ip: '203.0.113.42', page: '/portfolio', time: '2 min ago' },
  { ip: '198.51.100.17', page: '/', time: '11 min ago' },
  { ip: '203.0.113.88', page: '/contact', time: '34 min ago' },
]
const EXAMPLE_SIGNUPS = [
  { name: 'Guest — R. Alvarez', reality: 'Musician', time: '1 hr ago' },
  { name: 'Guest — J. Kim', reality: 'Developer', time: '3 hrs ago' },
]

const STYLES = `

.account-dashboard-panel {
  pointer-events   : auto;
  --adp-bg         : var(--omni-theme-bg, rgba(6, 8, 14, 0.94));
  --adp-border     : var(--omni-theme-border, rgba(127, 216, 255, 0.18));
  --adp-header-bg  : var(--omni-theme-header-bg, rgba(255, 255, 255, 0.03));
  --adp-text       : var(--omni-theme-text, rgba(255, 255, 255, 0.94));
  --adp-text-dim   : var(--omni-theme-text-dim, rgba(255, 255, 255, 0.6));
  --adp-accent     : var(--omni-theme-accent, #7fd8ff);
  --mono           : 'Courier New', Courier, monospace;

  position         : fixed;
  top              : 80px;
  left             : 50%;
  transform        : translateX(-50%);
  width            : 420px;
  min-width        : 340px;
  height           : 480px;
  min-height       : 360px;

  display          : flex;
  flex-direction   : column;

  background       : var(--adp-bg);
  backdrop-filter  : blur(24px) saturate(1.6);
  -webkit-backdrop-filter: blur(24px) saturate(1.6);
  border           : 1px solid var(--adp-border);
  border-radius    : 14px;
  box-shadow       : 0 0 40px rgba(127,216,255,0.08), 0 20px 50px rgba(0,0,0,0.55);

  font-family      : var(--mono);
  z-index          : 60;
  overflow         : hidden;
  resize           : both;
  opacity          : 0;
  visibility       : hidden;
}

.adp-header {
  height           : 40px;
  flex-shrink      : 0;
  display          : flex;
  align-items      : center;
  justify-content  : center;
  background       : var(--adp-header-bg);
  border-bottom    : 1px solid var(--adp-border);
  cursor           : grab;
  user-select      : none;
  position         : relative;
}
.adp-title { font-size: 11px; letter-spacing: 0.12em; color: var(--adp-accent); text-transform: uppercase; }
.adp-controls { position: absolute; right: 8px; display: flex; gap: 4px; }
.adp-ctrl {
  width: 20px; height: 20px; border-radius: 5px;
  border: 1px solid var(--adp-border); background: rgba(255,255,255,0.04);
  color: var(--adp-text-dim); font-size: 11px;
  display: flex; align-items: center; justify-content: center; cursor: pointer;
}
.adp-ctrl:hover { background: rgba(255,255,255,0.1); color: var(--adp-text); }

.adp-body { flex: 1 1 auto; overflow-y: auto; padding: 18px 20px; display: flex; flex-direction: column; gap: 16px; }

.adp-owner { text-align: center; font-size: 10px; color: var(--adp-text-dim); }
.adp-owner span { color: var(--adp-accent); }

.adp-section-label { font-size: 9px; color: var(--adp-text-dim); letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 6px; }
.adp-example-tag {
  display: inline-block; font-size: 8px; color: #ffb347; border: 1px solid rgba(255,179,71,0.4);
  border-radius: 4px; padding: 1px 5px; margin-left: 6px; text-transform: uppercase; letter-spacing: 0.04em;
}

.adp-row {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  padding: 7px 10px; border-radius: 6px; background: rgba(255,255,255,0.03); font-size: 10px; margin-bottom: 4px;
}
.adp-row-main { color: var(--adp-text); }
.adp-row-sub { color: var(--adp-text-dim); }

.adp-empty { font-size: 10px; color: var(--adp-text-dim); text-align: center; padding: 10px 0; line-height: 1.6; }
.adp-note { font-size: 8px; color: var(--adp-text-dim); opacity: 0.75; line-height: 1.6; text-align: center; margin-top: auto; padding-top: 10px; }

`

function injectStyles () {
  if (document.getElementById('adp-styles')) return
  const tag = document.createElement('style')
  tag.id = 'adp-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

export default class AccountDashboardPanel {
  constructor () {
    this._el = null
    this._isOpen = false
    this._onNavSelect = null
  }

  init () {
    injectStyles()
    this._onNavSelect = (e) => {
      if (e.detail?.item !== 'Dashboard') return
      this.open()
    }
    window.addEventListener('omni:nav-select', this._onNavSelect)
  }

  update () {}
  onResize () {}

  destroy () {
    window.removeEventListener('omni:nav-select', this._onNavSelect)
    this._el?.parentNode?.removeChild(this._el)
    WindowManager.unregister('accountdashboard')
  }

  open () {
    if (!this._el) this._el = this._buildDOM()
    const shell = document.getElementById('omni-ui') ?? document.body
    if (!this._el.parentNode) shell.appendChild(this._el)
    this._el.style.visibility = 'visible'
    gsap.to(this._el, { opacity: WindowManager.getPanelOpacity(), duration: 0.25 })
    this._isOpen = true
    this._render()
  }

  close () {
    if (!this._el) return
    gsap.to(this._el, { opacity: 0, duration: 0.18, onComplete: () => { this._el.style.visibility = 'hidden' } })
    this._isOpen = false
  }

  minimize () {
    if (!this._el) return
    const rect = this._el.getBoundingClientRect()
    gsap.to(this._el, { opacity: 0, scale: 0.3, duration: 0.2, onComplete: () => { this._el.style.visibility = 'hidden' } })
    this._isOpen = false
    window.dispatchEvent(new CustomEvent('omni:panel-minimized', {
      detail: { id: 'accountdashboard', label: '⟐AccountDashboard', iconLabel: '⟐▦',
        fromRect: { x: rect.left, y: rect.top, w: rect.width, h: rect.height }, variant: 'app' }
    }))
  }

  _render () {
    const body = this._el?.querySelector('.adp-body')
    if (!body) return
    const active = getActiveIdentity()

    body.innerHTML = `
      <div class="adp-owner">Reality owner: <span>${active ? active.name : 'No active OmniIdentity'}</span></div>

      <div>
        <div class="adp-section-label">Recent Visitors<span class="adp-example-tag">Example</span></div>
        ${EXAMPLE_VISITORS.map(v => `
          <div class="adp-row"><span class="adp-row-main">${v.ip}</span><span class="adp-row-sub">${v.page} · ${v.time}</span></div>
        `).join('')}
      </div>

      <div>
        <div class="adp-section-label">Guest Signups Into This Reality<span class="adp-example-tag">Example</span></div>
        ${EXAMPLE_SIGNUPS.map(s => `
          <div class="adp-row"><span class="adp-row-main">${s.name}</span><span class="adp-row-sub">${s.reality} · ${s.time}</span></div>
        `).join('')}
      </div>

      <div class="adp-note">Honest placeholder, not filled in — real visitor and signup data needs a real backend, which doesn't exist yet. The layout and data shape here are real; the numbers are not.</div>
    `
  }

  _buildDOM () {
    const el = document.createElement('div')
    el.className = 'account-dashboard-panel'
    el.innerHTML = `
      <div class="adp-header">
        <span class="adp-title">⟐ Account — Dashboard</span>
        <div class="adp-controls">
          <button class="adp-ctrl" data-action="minimize" title="Minimize">–</button>
          <button class="adp-ctrl" data-action="close" title="Close">×</button>
        </div>
      </div>
      <div class="adp-body"></div>
    `

    el.querySelector('[data-action="minimize"]').addEventListener('click', () => this.minimize())
    el.querySelector('[data-action="close"]').addEventListener('click', () => this.close())

    this._bindHeader(el)
    el.dataset.winId = 'accountdashboard'
    WindowManager.register('accountdashboard', el, 'AccountDashboard')
    WindowManager.watchPanelOpacity(el, () => this._isOpen)

    return el
  }

  _bindHeader (el) {
    const header = el.querySelector('.adp-header')
    const drag = { active: false }
    const onDown = (e) => {
      if (e.target.closest('button')) return
      const cx = e.touches?.[0]?.clientX ?? e.clientX
      const cy = e.touches?.[0]?.clientY ?? e.clientY
      const rect = el.getBoundingClientRect()
      drag.active = true; drag.startX = cx; drag.startY = cy; drag.originX = rect.left; drag.originY = rect.top
    }
    const onMove = (e) => {
      if (!drag.active) return
      const cx = e.touches?.[0]?.clientX ?? e.clientX
      const cy = e.touches?.[0]?.clientY ?? e.clientY
      gsap.set(el, { left: drag.originX + (cx - drag.startX), top: drag.originY + (cy - drag.startY), transform: 'none' })
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
