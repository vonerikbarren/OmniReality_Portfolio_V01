/**
 * ui/AccountProfilePanel.js — ⟐AccountProfile
 *
 * "Profile will bring up basically a basic version of OmniPlayer...
 * this is where the OmniUser Profile goes." A real, simplified
 * summary card — reuses the exact same real, persisted OmniPlayerGame
 * data OmniPlayerDashboard's own full view reads from, rather than a
 * second, separate data source. Shows the active OmniIdentity too,
 * since a profile is genuinely tied to which identity is active.
 */

import gsap from 'gsap'
import * as WindowManager from './WindowManager.js'
import { getActiveIdentity } from '../utils/OmniIdentity.js'

const STYLES = `

.account-profile-panel {
  pointer-events   : auto;
  --app-bg         : var(--omni-theme-bg, rgba(6, 8, 14, 0.94));
  --app-border     : var(--omni-theme-border, rgba(127, 216, 255, 0.18));
  --app-header-bg  : var(--omni-theme-header-bg, rgba(255, 255, 255, 0.03));
  --app-text       : var(--omni-theme-text, rgba(255, 255, 255, 0.94));
  --app-text-dim   : var(--omni-theme-text-dim, rgba(255, 255, 255, 0.6));
  --app-accent     : var(--omni-theme-accent, #7fd8ff);
  --mono           : 'Courier New', Courier, monospace;

  position         : fixed;
  top              : 90px;
  left             : 50%;
  transform        : translateX(-50%);
  width            : 320px;
  min-width        : 280px;
  height           : 380px;
  min-height       : 320px;

  display          : flex;
  flex-direction   : column;

  background       : var(--app-bg);
  backdrop-filter  : blur(24px) saturate(1.6);
  -webkit-backdrop-filter: blur(24px) saturate(1.6);
  border           : 1px solid var(--app-border);
  border-radius    : 14px;
  box-shadow       : 0 0 40px rgba(127,216,255,0.08), 0 20px 50px rgba(0,0,0,0.55);

  font-family      : var(--mono);
  z-index          : 60;
  overflow         : hidden;
  resize           : both;
  opacity          : 0;
  visibility       : hidden;
}

.app-header {
  height           : 40px;
  flex-shrink      : 0;
  display          : flex;
  align-items      : center;
  justify-content  : center;
  background       : var(--app-header-bg);
  border-bottom    : 1px solid var(--app-border);
  cursor           : grab;
  user-select      : none;
  position         : relative;
}
.app-title { font-size: 11px; letter-spacing: 0.12em; color: var(--app-accent); text-transform: uppercase; }
.app-controls { position: absolute; right: 8px; display: flex; gap: 4px; }
.app-ctrl {
  width: 20px; height: 20px; border-radius: 5px;
  border: 1px solid var(--app-border); background: rgba(255,255,255,0.04);
  color: var(--app-text-dim); font-size: 11px;
  display: flex; align-items: center; justify-content: center; cursor: pointer;
}
.app-ctrl:hover { background: rgba(255,255,255,0.1); color: var(--app-text); }

.app-body { flex: 1 1 auto; overflow-y: auto; padding: 22px 24px; display: flex; flex-direction: column; gap: 14px; }

.app-avatar { text-align: center; font-size: 30px; color: var(--app-accent); text-shadow: 0 0 18px rgba(127,216,255,0.5); }
.app-name { text-align: center; font-size: 14px; color: var(--app-text); letter-spacing: 0.04em; }
.app-subname { text-align: center; font-size: 9px; color: var(--app-text-dim); text-transform: uppercase; letter-spacing: 0.08em; margin-top: -8px; }

.app-stat-row { display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; border-radius: 6px; background: rgba(255,255,255,0.04); font-size: 11px; }
.app-stat-label { color: var(--app-text-dim); }
.app-stat-value { color: var(--app-accent); }

.app-empty { font-size: 10px; color: var(--app-text-dim); text-align: center; padding: 10px 0; line-height: 1.6; }
.app-note { font-size: 8px; color: var(--app-text-dim); opacity: 0.7; line-height: 1.5; text-align: center; margin-top: auto; padding-top: 10px; }

`

function injectStyles () {
  if (document.getElementById('app-profile-styles')) return
  const tag = document.createElement('style')
  tag.id = 'app-profile-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

export default class AccountProfilePanel {
  constructor (context, playerGame) {
    this.ctx = context
    this.playerGame = playerGame
    this._el = null
    this._isOpen = false
    this._onNavSelect = null
  }

  init () {
    injectStyles()
    this._onNavSelect = (e) => {
      if (e.detail?.item !== 'Profile') return
      this.open()
    }
    window.addEventListener('omni:nav-select', this._onNavSelect)
  }

  update () {}
  onResize () {}

  destroy () {
    window.removeEventListener('omni:nav-select', this._onNavSelect)
    this._el?.parentNode?.removeChild(this._el)
    WindowManager.unregister('accountprofile')
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
      detail: { id: 'accountprofile', label: '⟐AccountProfile', iconLabel: '⟐☺',
        fromRect: { x: rect.left, y: rect.top, w: rect.width, h: rect.height }, variant: 'app' }
    }))
  }

  _render () {
    const body = this._el?.querySelector('.app-body')
    if (!body) return
    const active = getActiveIdentity()

    if (!active) {
      body.innerHTML = `<div class="app-empty">No active OmniIdentity yet.<br>Create or select one from Login first.</div>`
      return
    }

    const realities = this.playerGame?.getRealities?.() ?? []
    const exposedCount = this.playerGame?.getExposedCount?.() ?? 0
    const totalCollected = this.playerGame?.getTotalAspectsCollected?.() ?? 0
    const totalPossible = realities.reduce((sum, r) => sum + (r.aspects?.length ?? 0), 0)
    const lifeSkillsCount = this.playerGame?.getLifeSkillsCount?.() ?? 0

    body.innerHTML = `
      <div class="app-avatar">⟐</div>
      <div class="app-name">${active.name}</div>
      <div class="app-subname">Active OmniIdentity</div>

      <div class="app-stat-row"><span class="app-stat-label">Truths Exposed</span><span class="app-stat-value">${exposedCount} / ${realities.length}</span></div>
      <div class="app-stat-row"><span class="app-stat-label">Aspects Collected</span><span class="app-stat-value">${totalCollected} / ${totalPossible}</span></div>
      <div class="app-stat-row"><span class="app-stat-label">Life Skills</span><span class="app-stat-value">${lifeSkillsCount}</span></div>

      <div class="app-note">A basic view of OmniPlayer's own real progress — the full dashboard has more.</div>
    `
  }

  _buildDOM () {
    const el = document.createElement('div')
    el.className = 'account-profile-panel'
    el.innerHTML = `
      <div class="app-header">
        <span class="app-title">⟐ Account — Profile</span>
        <div class="app-controls">
          <button class="app-ctrl" data-action="minimize" title="Minimize">–</button>
          <button class="app-ctrl" data-action="close" title="Close">×</button>
        </div>
      </div>
      <div class="app-body"></div>
    `

    el.querySelector('[data-action="minimize"]').addEventListener('click', () => this.minimize())
    el.querySelector('[data-action="close"]').addEventListener('click', () => this.close())

    this._bindHeader(el)
    el.dataset.winId = 'accountprofile'
    WindowManager.register('accountprofile', el, 'AccountProfile')
    WindowManager.watchPanelOpacity(el, () => this._isOpen)

    return el
  }

  _bindHeader (el) {
    const header = el.querySelector('.app-header')
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
