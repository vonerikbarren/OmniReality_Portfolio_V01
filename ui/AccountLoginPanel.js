/**
 * ui/AccountLoginPanel.js — ⟐AccountLogin
 *
 * A real, futuristic-styled way to create and switch between
 * OmniIdentities — different named save states of the scene.
 * Honest, stated plainly in the panel itself: this is a real, local
 * profile switcher, not server-backed authentication. There's no
 * backend yet; that's a genuine, separate, later decision.
 */

import gsap from 'gsap'
import * as WindowManager from './WindowManager.js'
import { getIdentities, getActiveIdentity, createIdentity, setActiveIdentity, deleteIdentity } from '../utils/OmniIdentity.js'

const STYLES = `

.account-login-panel {
  pointer-events   : auto;
  --alp-bg         : var(--omni-theme-bg, rgba(6, 8, 14, 0.94));
  --alp-border     : var(--omni-theme-border, rgba(127, 216, 255, 0.18));
  --alp-header-bg  : var(--omni-theme-header-bg, rgba(255, 255, 255, 0.03));
  --alp-text       : var(--omni-theme-text, rgba(255, 255, 255, 0.94));
  --alp-text-dim   : var(--omni-theme-text-dim, rgba(255, 255, 255, 0.6));
  --alp-accent     : var(--omni-theme-accent, #7fd8ff);
  --mono           : 'Courier New', Courier, monospace;

  position         : fixed;
  top              : 90px;
  left             : 50%;
  transform        : translateX(-50%);
  width            : 340px;
  min-width        : 300px;
  height           : 420px;
  min-height       : 340px;

  display          : flex;
  flex-direction   : column;

  background       : var(--alp-bg);
  backdrop-filter  : blur(24px) saturate(1.6);
  -webkit-backdrop-filter: blur(24px) saturate(1.6);
  border           : 1px solid var(--alp-border);
  border-radius    : 14px;
  box-shadow       : 0 0 40px rgba(127,216,255,0.08), 0 20px 50px rgba(0,0,0,0.55);

  font-family      : var(--mono);
  z-index          : 60;
  overflow         : hidden;
  resize           : both;
  opacity          : 0;
  visibility       : hidden;
}

.alp-header {
  height           : 40px;
  flex-shrink      : 0;
  display          : flex;
  align-items      : center;
  justify-content  : center;
  background       : var(--alp-header-bg);
  border-bottom    : 1px solid var(--alp-border);
  cursor           : grab;
  user-select      : none;
  position         : relative;
}
.alp-title { font-size: 11px; letter-spacing: 0.12em; color: var(--alp-accent); text-transform: uppercase; }
.alp-controls { position: absolute; right: 8px; display: flex; gap: 4px; }
.alp-ctrl {
  width: 20px; height: 20px; border-radius: 5px;
  border: 1px solid var(--alp-border); background: rgba(255,255,255,0.04);
  color: var(--alp-text-dim); font-size: 11px;
  display: flex; align-items: center; justify-content: center; cursor: pointer;
}
.alp-ctrl:hover { background: rgba(255,255,255,0.1); color: var(--alp-text); }

.alp-body { flex: 1 1 auto; overflow-y: auto; padding: 22px 24px; display: flex; flex-direction: column; gap: 16px; }

.alp-glyph { text-align: center; font-size: 26px; color: var(--alp-accent); text-shadow: 0 0 16px rgba(127,216,255,0.5); letter-spacing: 0.2em; }
.alp-sub { text-align: center; font-size: 9px; color: var(--alp-text-dim); letter-spacing: 0.08em; text-transform: uppercase; margin-top: -8px; }

.alp-field-label { font-size: 9px; color: var(--alp-text-dim); letter-spacing: 0.06em; text-transform: uppercase; margin-bottom: 5px; }
.alp-input {
  width: 100%; background: rgba(255,255,255,0.05); border: 1px solid var(--alp-border);
  border-radius: 6px; color: var(--alp-text); font-family: inherit; font-size: 12px; padding: 9px 10px;
  outline: none; box-sizing: border-box;
}
.alp-input:focus { border-color: var(--alp-accent); box-shadow: 0 0 0 1px var(--alp-accent); }

.alp-create-btn {
  background: rgba(127,216,255,0.14); border: 1px solid var(--alp-accent);
  color: var(--alp-accent); font-family: inherit; font-size: 11px; letter-spacing: 0.06em;
  padding: 10px; border-radius: 6px; cursor: pointer; text-transform: uppercase;
}
.alp-create-btn:hover { background: rgba(127,216,255,0.24); }

.alp-divider { display: flex; align-items: center; gap: 8px; font-size: 8px; color: var(--alp-text-dim); text-transform: uppercase; letter-spacing: 0.08em; }
.alp-divider::before, .alp-divider::after { content: ''; flex: 1; height: 1px; background: var(--alp-border); }

.alp-identity-list { display: flex; flex-direction: column; gap: 6px; }
.alp-identity-row {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  padding: 8px 10px; border-radius: 6px; border: 1px solid var(--alp-border);
  background: rgba(255,255,255,0.03); cursor: pointer; font-size: 11px; color: var(--alp-text);
}
.alp-identity-row:hover { background: rgba(255,255,255,0.07); }
.alp-identity-row.is-active { border-color: var(--alp-accent); background: rgba(127,216,255,0.1); color: var(--alp-accent); }
.alp-identity-remove { color: var(--alp-text-dim); font-size: 12px; cursor: pointer; padding: 2px 5px; }
.alp-identity-remove:hover { color: #ff8c8c; }

.alp-empty { font-size: 10px; color: var(--alp-text-dim); text-align: center; padding: 6px 0; }
.alp-cryptx-status { background: rgba(127,216,255,0.06); border: 1px solid var(--alp-border); border-radius: 6px; padding: 8px 10px; }
.alp-cryptx-steps { font-size: 10px; color: var(--alp-accent); line-height: 1.5; }
.alp-note { font-size: 8px; color: var(--alp-text-dim); opacity: 0.7; line-height: 1.5; text-align: center; margin-top: auto; padding-top: 10px; }

`

function injectStyles () {
  if (document.getElementById('alp-styles')) return
  const tag = document.createElement('style')
  tag.id = 'alp-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

export default class AccountLoginPanel {
  constructor (loginCryptx) {
    this.loginCryptx = loginCryptx
    this._el = null
    this._isOpen = false
    this._onNavSelect = null
    this._onPatternChanged = null
  }

  init () {
    injectStyles()
    this._onNavSelect = (e) => {
      if (e.detail?.item !== 'Login') return
      this.open()
    }
    window.addEventListener('omni:nav-select', this._onNavSelect)
    this._onPatternChanged = () => this._render()
    window.addEventListener('omni:login-cryptx-pattern-changed', this._onPatternChanged)
  }

  update () {}
  onResize () {}

  destroy () {
    window.removeEventListener('omni:nav-select', this._onNavSelect)
    window.removeEventListener('omni:login-cryptx-pattern-changed', this._onPatternChanged)
    this._el?.parentNode?.removeChild(this._el)
    WindowManager.unregister('accountlogin')
  }

  open () {
    if (!this._el) this._el = this._buildDOM()
    const shell = document.getElementById('omni-ui') ?? document.body
    if (!this._el.parentNode) shell.appendChild(this._el)
    this._el.style.visibility = 'visible'
    gsap.to(this._el, { opacity: WindowManager.getPanelOpacity(), duration: 0.25 })
    this._isOpen = true
    this.loginCryptx?.activate()
    this._render()
  }

  close () {
    if (!this._el) return
    gsap.to(this._el, { opacity: 0, duration: 0.18, onComplete: () => { this._el.style.visibility = 'hidden' } })
    this._isOpen = false
    this.loginCryptx?.deactivate()
  }

  minimize () {
    if (!this._el) return
    const rect = this._el.getBoundingClientRect()
    gsap.to(this._el, { opacity: 0, scale: 0.3, duration: 0.2, onComplete: () => { this._el.style.visibility = 'hidden' } })
    this._isOpen = false
    this.loginCryptx?.deactivate()
    window.dispatchEvent(new CustomEvent('omni:panel-minimized', {
      detail: { id: 'accountlogin', label: '⟐AccountLogin', iconLabel: '⟐◈',
        fromRect: { x: rect.left, y: rect.top, w: rect.width, h: rect.height }, variant: 'app' }
    }))
  }

  _render () {
    const body = this._el?.querySelector('.alp-body')
    if (!body) return
    const identities = getIdentities()
    const active = getActiveIdentity()

    const pattern = this.loginCryptx?.getPattern?.() ?? []

    body.innerHTML = `
      <div class="alp-glyph">⟐</div>
      <div class="alp-sub">OmniIdentity Access</div>

      <div>
        <div class="alp-field-label">Username</div>
        <input type="text" class="alp-input" id="alp-username-input" placeholder="username" />
      </div>
      <div>
        <div class="alp-field-label">Password</div>
        <input type="password" class="alp-input" id="alp-password-input" placeholder="password" />
      </div>
      <div class="alp-cryptx-status">
        <div class="alp-field-label">OmniCryptx Pattern (spatial, in the scene)</div>
        <div class="alp-cryptx-steps">${pattern.length === 0 ? 'No ring selections yet — drill into the rings docked beside the scene.' : pattern.map((s, i) => `${i + 1}. ${s.ringType}`).join(' → ')}</div>
      </div>

      <div>
        <div class="alp-field-label">New OmniIdentity Name</div>
        <input type="text" class="alp-input" id="alp-name-input" placeholder="e.g. Musician, Developer, Studio" />
      </div>
      <button class="alp-create-btn" id="alp-create-btn">＋ Create &amp; Enter</button>

      <div class="alp-divider">Existing</div>
      <div class="alp-identity-list" id="alp-identity-list">
        ${identities.length === 0 ? '<div class="alp-empty">No OmniIdentities yet — create one above.</div>' : identities.map(i => `
          <div class="alp-identity-row ${active?.id === i.id ? 'is-active' : ''}" data-id="${i.id}">
            <span>${i.name}${active?.id === i.id ? ' — active' : ''}</span>
            <span class="alp-identity-remove" data-remove="${i.id}">×</span>
          </div>
        `).join('')}
      </div>

      <div class="alp-note">Real and local — a named save state of this scene, not server-backed authentication. No backend exists yet.</div>
    `

    body.querySelector('#alp-create-btn').addEventListener('click', () => {
      const input = body.querySelector('#alp-name-input')
      const name = input.value.trim()
      if (!name) return
      createIdentity(name)
      this._render()
    })

    body.querySelectorAll('.alp-identity-row').forEach(row => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('.alp-identity-remove')) return
        setActiveIdentity(row.dataset.id)
        this._render()
      })
    })

    body.querySelectorAll('.alp-identity-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation()
        deleteIdentity(btn.dataset.remove)
        this._render()
      })
    })
  }

  _buildDOM () {
    const el = document.createElement('div')
    el.className = 'account-login-panel'
    el.innerHTML = `
      <div class="alp-header">
        <span class="alp-title">⟐ Account — Login</span>
        <div class="alp-controls">
          <button class="alp-ctrl" data-action="minimize" title="Minimize">–</button>
          <button class="alp-ctrl" data-action="close" title="Close">×</button>
        </div>
      </div>
      <div class="alp-body"></div>
    `

    el.querySelector('[data-action="minimize"]').addEventListener('click', () => this.minimize())
    el.querySelector('[data-action="close"]').addEventListener('click', () => this.close())

    this._bindHeader(el)
    el.dataset.winId = 'accountlogin'
    WindowManager.register('accountlogin', el, 'AccountLogin')
    WindowManager.watchPanelOpacity(el, () => this._isOpen)

    return el
  }

  _bindHeader (el) {
    const header = el.querySelector('.alp-header')
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
