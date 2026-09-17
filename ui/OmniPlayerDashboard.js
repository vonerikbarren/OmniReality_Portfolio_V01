/**
 * ui/OmniPlayerDashboard.js — ⟐OmniPlayer main menu
 *
 * The Dashboard, with tabs for every gaming element: Status, Visors,
 * Boundaries, Languages, Skills. Status and Visors carry real,
 * functional data from OmniPlayerGame — Boundaries/Languages/Skills
 * are honest, clearly-labeled placeholders, since no real design for
 * them exists yet ("I honestly at this point didn't have any real
 * design aspects" — stated directly), matching this project's
 * established pattern of an honest not-yet-filled-in state rather
 * than inventing content to look more finished than it is.
 *
 * Meant to work alongside any other OmniProduct, per the request —
 * this is a normal WindowManager panel, not a full-screen takeover,
 * so it never blocks whatever else is open.
 */

import gsap from 'gsap'
import * as WindowManager from './WindowManager.js'
import { EMOTIONAL_STATES } from '../systems/OmniPlayerGame.js'

const TABS = ['status', 'visors', 'boundaries', 'languages', 'skills']
const PLACEHOLDER_TABS = new Set(['boundaries', 'languages'])

const STYLES = `

.omni-player-dashboard {
  pointer-events   : auto;
  --pd-bg          : var(--omni-theme-bg, rgba(8, 8, 12, 0.92));
  --pd-border      : var(--omni-theme-border, rgba(255, 255, 255, 0.09));
  --pd-header-bg   : var(--omni-theme-header-bg, rgba(255, 255, 255, 0.03));
  --pd-text        : var(--omni-theme-text, rgba(255, 255, 255, 0.92));
  --pd-text-dim    : var(--omni-theme-text-dim, rgba(255, 255, 255, 0.65));
  --pd-accent      : var(--omni-theme-accent, #ffd700);
  --mono           : 'Courier New', Courier, monospace;

  position         : fixed;
  top              : 90px;
  left             : 90px;
  width            : 420px;
  min-width        : 320px;
  max-width        : 92vw;
  height           : 480px;
  min-height       : 300px;
  max-height       : 88vh;

  display          : flex;
  flex-direction   : column;

  background       : var(--pd-bg);
  backdrop-filter  : blur(20px) saturate(1.5);
  -webkit-backdrop-filter: blur(20px) saturate(1.5);
  border           : 1px solid var(--pd-border);
  border-radius    : 12px;
  box-shadow       : 0 0 20px rgba(0,0,0,0.4), 0 10px 30px rgba(0,0,0,0.5);

  font-family      : var(--mono);
  z-index          : 60;
  overflow         : hidden;
  resize           : both;
  opacity          : 0;
  visibility       : hidden;
}

.pd-header {
  height           : 38px;
  flex-shrink      : 0;
  display          : flex;
  align-items      : center;
  justify-content  : center;
  background       : var(--pd-header-bg);
  border-bottom    : 1px solid var(--pd-border);
  cursor           : grab;
  user-select      : none;
  position         : relative;
}
.pd-title { font-size: 11px; letter-spacing: 0.05em; color: var(--pd-text-dim); }
.pd-controls { position: absolute; right: 8px; display: flex; gap: 4px; }
.pd-ctrl {
  width: 20px; height: 20px; border-radius: 5px;
  border: 1px solid var(--pd-border); background: rgba(255,255,255,0.04);
  color: var(--pd-text-dim); font-size: 11px;
  display: flex; align-items: center; justify-content: center; cursor: pointer;
}
.pd-ctrl:hover { background: rgba(255,255,255,0.1); color: var(--pd-text); }

.pd-tabs { display: flex; flex-shrink: 0; border-bottom: 1px solid var(--pd-border); overflow-x: auto; }
.pd-tab {
  flex: 1 1 auto; padding: 8px 10px; text-align: center; font-size: 10px;
  letter-spacing: 0.03em; color: var(--pd-text-dim); cursor: pointer;
  border-bottom: 2px solid transparent; white-space: nowrap;
}
.pd-tab:hover { color: var(--pd-text); background: rgba(255,255,255,0.03); }
.pd-tab.is-active { color: var(--pd-accent); border-bottom-color: var(--pd-accent); }

.pd-body { flex: 1 1 auto; overflow-y: auto; padding: 14px 16px; }

.pd-stat-row { display: flex; justify-content: space-between; font-size: 11px; color: var(--pd-text); margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid var(--pd-border); }
.pd-stat-label { color: var(--pd-text-dim); }

.pd-reality-item { display: flex; align-items: center; gap: 8px; padding: 6px 0; font-size: 10.5px; }
.pd-reality-glyph { width: 18px; text-align: center; }
.pd-reality-name { flex: 1; color: var(--pd-text); }
.pd-reality-name.is-exposed { color: var(--pd-accent); }
.pd-reality-progress { color: var(--pd-text-dim); font-size: 9.5px; }

.pd-visor-swatch { width: 100%; height: 60px; border-radius: 8px; margin-bottom: 12px; border: 1px solid var(--pd-border); transition: background 0.3s; }
.pd-visor-list { display: flex; flex-direction: column; gap: 6px; }
.pd-visor-row { display: flex; align-items: center; gap: 8px; font-size: 10.5px; color: var(--pd-text-dim); }
.pd-visor-row.is-current { color: var(--pd-text); }
.pd-visor-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }

.pd-placeholder { font-size: 11px; color: var(--pd-text-dim); opacity: 0.75; line-height: 1.6; text-align: center; padding-top: 40px; }

.pd-resize-handle { position: absolute; right: 0; bottom: 0; width: 14px; height: 14px; cursor: nwse-resize; }
.pd-resize-handle::before {
  content: ''; position: absolute; right: 3px; bottom: 3px; width: 7px; height: 7px;
  border-right: 2px solid rgba(255,255,255,0.25); border-bottom: 2px solid rgba(255,255,255,0.25);
}

`

function injectStyles () {
  if (document.getElementById('omni-player-dashboard-styles')) return
  const tag = document.createElement('style')
  tag.id = 'omni-player-dashboard-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

export default class OmniPlayerDashboard {
  constructor (context, playerGame) {
    this.ctx = context
    this.playerGame = playerGame
    this._el = null
    this._isOpen = false
    this._activeTab = 'status'
    this._onNavSelect = null
    this._onAspectCollected = null
    this._onStateChanged = null
  }

  init () {
    injectStyles()
    this._onNavSelect = (e) => {
      if (e.detail?.item !== '⟐OmniPlayer') return
      this.open()
    }
    window.addEventListener('omni:nav-select', this._onNavSelect)

    this._onAspectCollected = () => { if (this._isOpen && this._activeTab === 'status') this._renderActiveTab() }
    window.addEventListener('omni:player-aspect-collected', this._onAspectCollected)
    window.addEventListener('omni:reality-truth-exposed', this._onAspectCollected)

    this._onStateChanged = () => { if (this._isOpen && this._activeTab === 'visors') this._renderActiveTab() }
    window.addEventListener('omni:player-emotional-state-changed', this._onStateChanged)

    this._onLifeSkillAdded = () => { if (this._isOpen && this._activeTab === 'skills') this._renderActiveTab() }
    window.addEventListener('omni:player-lifeskill-added', this._onLifeSkillAdded)
  }

  update () {}
  onResize () {}

  destroy () {
    window.removeEventListener('omni:nav-select', this._onNavSelect)
    window.removeEventListener('omni:player-aspect-collected', this._onAspectCollected)
    window.removeEventListener('omni:reality-truth-exposed', this._onAspectCollected)
    window.removeEventListener('omni:player-emotional-state-changed', this._onStateChanged)
    window.removeEventListener('omni:player-lifeskill-added', this._onLifeSkillAdded)
    this._el?.parentNode?.removeChild(this._el)
    WindowManager.unregister('omniplayerdashboard')
  }

  open () {
    if (!this._el) this._el = this._buildDOM()
    const shell = document.getElementById('omni-ui') ?? document.body
    if (!this._el.parentNode) shell.appendChild(this._el)
    this._renderActiveTab()
    this._el.style.visibility = 'visible'
    gsap.to(this._el, { opacity: WindowManager.getPanelOpacity(), duration: 0.25 })
    this._isOpen = true
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
      detail: { id: 'omniplayerdashboard', label: '⟐OmniPlayer', iconLabel: '⟐P',
        fromRect: { x: rect.left, y: rect.top, w: rect.width, h: rect.height }, variant: 'orb' }
    }))
  }

  _switchTab (tabId) {
    if (!TABS.includes(tabId)) return
    this._activeTab = tabId
    this._el.querySelectorAll('.pd-tab').forEach(btn => btn.classList.toggle('is-active', btn.dataset.tab === tabId))
    this._renderActiveTab()
  }

  _renderActiveTab () {
    const body = this._el?.querySelector('#pd-body')
    if (!body) return
    if (PLACEHOLDER_TABS.has(this._activeTab)) {
      const label = this._activeTab.charAt(0).toUpperCase() + this._activeTab.slice(1)
      body.innerHTML = `<div class="pd-placeholder">⟐ ${label} — no real design exists yet.<br>Honest placeholder, not filled in.</div>`
      return
    }
    if (this._activeTab === 'status') return this._renderStatusTab(body)
    if (this._activeTab === 'visors') return this._renderVisorsTab(body)
    if (this._activeTab === 'skills') return this._renderSkillsTab(body)
  }

  /** Real content now — "Number of Life Skills... should be shown,"
   *  per the request, even with no fuller design given yet for what
   *  constitutes one. Just the real, persisted count, honestly. */
  _renderSkillsTab (body) {
    const count = this.playerGame.getLifeSkillsCount()
    body.innerHTML = `
      <div class="pd-stat-row"><span class="pd-stat-label">Number of Life Skills</span><span>${count}</span></div>
      <div class="pd-placeholder" style="padding-top:16px">What specifically counts as a Life Skill isn't defined yet — this is the real, persisted count, not a placeholder.</div>
    `
  }

  _renderStatusTab (body) {
    const realities = this.playerGame.getRealities()
    const exposedCount = this.playerGame.getExposedCount()
    const totalCollected = this.playerGame.getTotalAspectsCollected()
    const totalPossible = realities.reduce((sum, r) => sum + r.aspects.length, 0)

    let html = `
      <div class="pd-stat-row"><span class="pd-stat-label">Truths Exposed</span><span>${exposedCount} / ${realities.length}</span></div>
      <div class="pd-stat-row"><span class="pd-stat-label">Aspects Collected</span><span>${totalCollected} / ${totalPossible}</span></div>
    `
    html += realities.map(r => {
      const collected = r.aspects.filter(a => a.collected).length
      return `
        <div class="pd-reality-item">
          <span class="pd-reality-glyph">${r.glyph}</span>
          <span class="pd-reality-name ${r.exposed ? 'is-exposed' : ''}">${r.label}</span>
          <span class="pd-reality-progress">${collected}/${r.aspects.length}</span>
        </div>
      `
    }).join('')
    body.innerHTML = html
  }

  _renderVisorsTab (body) {
    const currentColor = this.playerGame.getCurrentVisorColor()
    let html = `<div class="pd-visor-swatch" style="background:${currentColor}"></div><div class="pd-visor-list">`
    Object.entries(EMOTIONAL_STATES).forEach(([key, def]) => {
      const isCurrent = this.playerGame.emotionalState === key
      html += `
        <div class="pd-visor-row ${isCurrent ? 'is-current' : ''}">
          <span class="pd-visor-dot" style="background:${def.color}"></span>
          <span>${def.label}${isCurrent ? ' — active' : ''}</span>
        </div>
      `
    })
    html += '</div>'
    body.innerHTML = html
  }

  _buildDOM () {
    const el = document.createElement('div')
    el.className = 'omni-player-dashboard'
    el.innerHTML = `
      <div class="pd-header">
        <span class="pd-title">⟐OmniPlayer</span>
        <div class="pd-controls">
          <button class="pd-ctrl" data-action="omniuser" title="Toggle OmniUser — profile &amp; wellness (for non-gamers)">⟐U</button>
          <button class="pd-ctrl" data-action="minimize" title="Minimize">–</button>
          <button class="pd-ctrl" data-action="close" title="Close">×</button>
        </div>
      </div>
      <div class="pd-tabs">
        ${TABS.map(t => `<button class="pd-tab ${t === 'status' ? 'is-active' : ''}" data-tab="${t}">${t.charAt(0).toUpperCase() + t.slice(1)}</button>`).join('')}
      </div>
      <div class="pd-body" id="pd-body"></div>
      <div class="pd-resize-handle" aria-hidden="true"></div>
    `

    el.querySelectorAll('.pd-tab').forEach(btn => btn.addEventListener('click', () => this._switchTab(btn.dataset.tab)))
    el.querySelector('[data-action="omniuser"]').addEventListener('click', () => window.dispatchEvent(new CustomEvent('omni:omniuser-toggle')))
    el.querySelector('[data-action="minimize"]').addEventListener('click', () => this.minimize())
    el.querySelector('[data-action="close"]').addEventListener('click', () => this.close())
    this._bindHeader(el)
    this._bindResize(el)

    el.dataset.winId = 'omniplayerdashboard'
    WindowManager.register('omniplayerdashboard', el, 'OmniPlayer')
    WindowManager.watchPanelOpacity(el, () => this._isOpen)

    return el
  }

  _bindHeader (el) {
    const header = el.querySelector('.pd-header')
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

  _bindResize (el) {
    const handle = el.querySelector('.pd-resize-handle')
    const resize = { active: false }
    const onDown = (e) => {
      e.stopPropagation()
      const cx = e.touches?.[0]?.clientX ?? e.clientX
      const cy = e.touches?.[0]?.clientY ?? e.clientY
      const rect = el.getBoundingClientRect()
      resize.active = true; resize.startX = cx; resize.startY = cy; resize.startW = rect.width; resize.startH = rect.height
    }
    const onMove = (e) => {
      if (!resize.active) return
      const cx = e.touches?.[0]?.clientX ?? e.clientX
      const cy = e.touches?.[0]?.clientY ?? e.clientY
      gsap.set(el, { width: resize.startW + (cx - resize.startX), height: resize.startH + (cy - resize.startY) })
    }
    const onUp = () => { resize.active = false }
    handle.addEventListener('mousedown', onDown)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    handle.addEventListener('touchstart', onDown, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', onUp)
  }
}
