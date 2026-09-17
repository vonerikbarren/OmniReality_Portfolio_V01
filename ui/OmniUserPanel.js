/**
 * ui/OmniUserPanel.js — ⟐OmniUser
 *
 * A real profile panel, distinct from OmniPlayer's game Dashboard —
 * "OmniUser is more for non-gamers while OmniPlayer is for gamers,"
 * stated directly. Toggled from a real button in the Dashboard's own
 * header, but renders as its own separate panel, not another tab in
 * the same game-first surface — the audience distinction is real,
 * so the panel stays visually and structurally separate too.
 *
 * Profile fields (display name, bio, avatar symbol) plus the 14
 * Dimensions of Wellness, each a real, user-set 0-100 slider.
 */

import gsap from 'gsap'
import * as WindowManager from './WindowManager.js'
import { WELLNESS_DIMENSIONS } from '../data/OmniUserWellness.js'

const STYLES = `

.omni-user-panel {
  pointer-events   : auto;
  --up-bg          : var(--omni-theme-bg, rgba(8, 8, 12, 0.92));
  --up-border      : var(--omni-theme-border, rgba(255, 255, 255, 0.09));
  --up-header-bg   : var(--omni-theme-header-bg, rgba(255, 255, 255, 0.03));
  --up-text        : var(--omni-theme-text, rgba(255, 255, 255, 0.92));
  --up-text-dim    : var(--omni-theme-text-dim, rgba(255, 255, 255, 0.65));
  --up-accent      : var(--omni-theme-accent, #7fd8ff);
  --mono           : 'Courier New', Courier, monospace;

  position         : fixed;
  top              : 110px;
  left             : 540px;
  width            : 340px;
  min-width        : 280px;
  max-width        : 92vw;
  height           : 520px;
  min-height       : 320px;
  max-height       : 88vh;

  display          : flex;
  flex-direction   : column;

  background       : var(--up-bg);
  backdrop-filter  : blur(20px) saturate(1.5);
  -webkit-backdrop-filter: blur(20px) saturate(1.5);
  border           : 1px solid var(--up-border);
  border-radius    : 12px;
  box-shadow       : 0 0 20px rgba(0,0,0,0.4), 0 10px 30px rgba(0,0,0,0.5);

  font-family      : var(--mono);
  z-index          : 60;
  overflow         : hidden;
  resize           : both;
  opacity          : 0;
  visibility       : hidden;
}

.up-header {
  height           : 38px;
  flex-shrink      : 0;
  display          : flex;
  align-items      : center;
  justify-content  : center;
  background       : var(--up-header-bg);
  border-bottom    : 1px solid var(--up-border);
  cursor           : grab;
  user-select      : none;
  position         : relative;
}
.up-title { font-size: 11px; letter-spacing: 0.05em; color: var(--up-text-dim); }
.up-controls { position: absolute; right: 8px; display: flex; gap: 4px; }
.up-ctrl {
  width: 20px; height: 20px; border-radius: 5px;
  border: 1px solid var(--up-border); background: rgba(255,255,255,0.04);
  color: var(--up-text-dim); font-size: 11px;
  display: flex; align-items: center; justify-content: center; cursor: pointer;
}
.up-ctrl:hover { background: rgba(255,255,255,0.1); color: var(--up-text); }

.up-body { flex: 1 1 auto; overflow-y: auto; padding: 14px 16px; }
.up-section-title {
  font-size: 10px; letter-spacing: 0.06em; text-transform: uppercase;
  color: var(--up-accent); margin: 14px 0 8px; padding-top: 10px;
  border-top: 1px solid var(--up-border);
}
.up-section-title:first-child { margin-top: 0; padding-top: 0; border-top: none; }

.up-field-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.up-field-label { width: 80px; flex-shrink: 0; font-size: 10.5px; color: var(--up-text-dim); }
.up-text-input, .up-symbol-input {
  flex: 1; background: rgba(255,255,255,0.04); border: 1px solid var(--up-border);
  border-radius: 4px; color: var(--up-text); font-family: inherit; font-size: 11px; padding: 5px 7px;
}
.up-symbol-input { flex: none; width: 40px; text-align: center; font-size: 16px; }
.up-bio-input { width: 100%; height: 50px; resize: vertical; }

.up-wellness-row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.up-wellness-label { width: 90px; flex-shrink: 0; font-size: 10px; color: var(--up-text-dim); }
.up-wellness-slider { flex: 1; accent-color: var(--up-accent); }
.up-wellness-value { width: 28px; text-align: right; font-size: 10px; color: var(--up-text); }

.up-avg-row { display: flex; justify-content: space-between; font-size: 11px; color: var(--up-text); margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid var(--up-border); }

.up-resize-handle { position: absolute; right: 0; bottom: 0; width: 14px; height: 14px; cursor: nwse-resize; }
.up-resize-handle::before {
  content: ''; position: absolute; right: 3px; bottom: 3px; width: 7px; height: 7px;
  border-right: 2px solid rgba(255,255,255,0.25); border-bottom: 2px solid rgba(255,255,255,0.25);
}

`

function injectStyles () {
  if (document.getElementById('omni-user-panel-styles')) return
  const tag = document.createElement('style')
  tag.id = 'omni-user-panel-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

export default class OmniUserPanel {
  constructor (context, userProfile) {
    this.ctx = context
    this.userProfile = userProfile
    this._el = null
    this._isOpen = false
    this._onToggleRequest = null
  }

  init () {
    injectStyles()
    this._onToggleRequest = () => this.toggle()
    window.addEventListener('omni:omniuser-toggle', this._onToggleRequest)
  }

  update () {}
  onResize () {}

  destroy () {
    window.removeEventListener('omni:omniuser-toggle', this._onToggleRequest)
    this._el?.parentNode?.removeChild(this._el)
    WindowManager.unregister('omniuserpanel')
  }

  toggle () { this._isOpen ? this.close() : this.open() }

  open () {
    if (!this._el) this._el = this._buildDOM()
    const shell = document.getElementById('omni-ui') ?? document.body
    if (!this._el.parentNode) shell.appendChild(this._el)
    this._refreshFromProfile()
    this._el.style.visibility = 'visible'
    gsap.to(this._el, { opacity: WindowManager.getPanelOpacity(), duration: 0.25 })
    this._isOpen = true
  }

  close () {
    if (!this._el) return
    gsap.to(this._el, { opacity: 0, duration: 0.18, onComplete: () => { this._el.style.visibility = 'hidden' } })
    this._isOpen = false
  }

  _refreshFromProfile () {
    const profile = this.userProfile.getProfile()
    this._el.querySelector('[data-field="displayName"]').value = profile.displayName
    this._el.querySelector('[data-field="bio"]').value = profile.bio
    this._el.querySelector('[data-field="avatarSymbol"]').value = profile.avatarSymbol
    WELLNESS_DIMENSIONS.forEach(dim => {
      const slider = this._el.querySelector(`[data-wellness="${dim}"]`)
      const valueLabel = this._el.querySelector(`[data-wellness-value="${dim}"]`)
      if (slider) slider.value = profile.wellness[dim]
      if (valueLabel) valueLabel.textContent = profile.wellness[dim]
    })
    this._refreshAverage()
  }

  _refreshAverage () {
    const avgEl = this._el.querySelector('#up-avg-value')
    if (avgEl) avgEl.textContent = String(this.userProfile.getWellnessAverage())
  }

  _buildDOM () {
    const el = document.createElement('div')
    el.className = 'omni-user-panel'
    el.innerHTML = `
      <div class="up-header">
        <span class="up-title">⟐OmniUser — Profile</span>
        <div class="up-controls">
          <button class="up-ctrl" data-action="close" title="Close">×</button>
        </div>
      </div>
      <div class="up-body">
        <div class="up-section-title">Profile</div>
        <div class="up-field-row"><span class="up-field-label">Display Name</span><input type="text" class="up-text-input" data-field="displayName" placeholder="Anonymous"></div>
        <div class="up-field-row"><span class="up-field-label">Avatar Symbol</span><input type="text" class="up-symbol-input" data-field="avatarSymbol" maxlength="2"></div>
        <div class="up-field-row"><span class="up-field-label">Bio</span><textarea class="up-text-input up-bio-input" data-field="bio" placeholder="A short bio..."></textarea></div>

        <div class="up-section-title">Dimensions of Wellness</div>
        <div class="up-avg-row"><span>Overall Average</span><span id="up-avg-value">50</span></div>
        <div id="up-wellness-list">
          ${WELLNESS_DIMENSIONS.map(dim => `
            <div class="up-wellness-row">
              <span class="up-wellness-label">${dim}</span>
              <input type="range" class="up-wellness-slider" min="0" max="100" data-wellness="${dim}">
              <span class="up-wellness-value" data-wellness-value="${dim}">50</span>
            </div>
          `).join('')}
        </div>
      </div>
      <div class="up-resize-handle" aria-hidden="true"></div>
    `

    el.querySelector('[data-action="close"]').addEventListener('click', () => this.close())
    el.querySelector('[data-field="displayName"]').addEventListener('input', (e) => this.userProfile.setField('displayName', e.target.value))
    el.querySelector('[data-field="avatarSymbol"]').addEventListener('input', (e) => this.userProfile.setField('avatarSymbol', e.target.value))
    el.querySelector('[data-field="bio"]').addEventListener('input', (e) => this.userProfile.setField('bio', e.target.value))

    WELLNESS_DIMENSIONS.forEach(dim => {
      const slider = el.querySelector(`[data-wellness="${dim}"]`)
      const valueLabel = el.querySelector(`[data-wellness-value="${dim}"]`)
      slider.addEventListener('input', (e) => {
        const value = Number(e.target.value)
        valueLabel.textContent = String(value)
        this.userProfile.setWellness(dim, value)
        this._refreshAverage()
      })
    })

    this._bindHeader(el)
    this._bindResize(el)
    el.dataset.winId = 'omniuserpanel'
    WindowManager.register('omniuserpanel', el, 'OmniUser')
    WindowManager.watchPanelOpacity(el, () => this._isOpen)

    return el
  }

  _bindHeader (el) {
    const header = el.querySelector('.up-header')
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
    const handle = el.querySelector('.up-resize-handle')
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
