/**
 * ui/Dev_FPS_Exp_ListOfEmotions.js — ⟐Dev_FPS_Exp_ListOfEmotions
 *
 * Real Dev panel — one button per real state in
 * data/OmniEmotionStates.js, each directly calling
 * OmniEmotionParticles.setEmotion(name) for live testing. Named
 * exactly as given.
 */

import { EMOTION_STATES } from '../data/OmniEmotionStates.js'

const STYLES = `

.dev-fps-exp-emotions-panel {
  pointer-events   : auto;
  position         : fixed;
  top              : 130px;
  left             : 1420px;
  width            : 220px;
  background       : rgba(8, 8, 12, 0.92);
  border           : 1px solid rgba(255, 255, 255, 0.10);
  border-radius    : 12px;
  font-family      : 'Courier New', Courier, monospace;
  z-index          : 60;
  opacity          : 0;
  visibility       : hidden;
  display          : flex;
  flex-direction   : column;
}
.dev-fps-exp-emotions-panel.open { opacity: 1; visibility: visible; }

.dfe-header {
  display: flex; align-items: center; justify-content: center;
  height: 32px; border-bottom: 1px solid rgba(255,255,255,0.08);
  font-size: 10px; color: rgba(255,255,255,0.7); position: relative;
}
.dfe-close {
  position: absolute; right: 8px; background: none; border: none;
  color: rgba(255,255,255,0.4); font-size: 13px; cursor: pointer;
}
.dfe-body { padding: 8px; display: flex; flex-direction: column; gap: 4px; max-height: 360px; overflow-y: auto; }
.dfe-btn {
  background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.14);
  border-radius: 6px; padding: 6px 8px; cursor: pointer; font-size: 10.5px;
  color: #fff; text-align: left; display: flex; align-items: center; gap: 6px;
}
.dfe-btn:hover { background: rgba(255,255,255,0.16); }
.dfe-btn.active { border-color: rgba(255, 238, 0, 0.6); }
.dfe-swatch { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.dfe-current { font-size: 9.5px; color: rgba(255,255,255,0.5); padding: 4px 8px 8px; }
`

function injectStyles () {
  if (document.getElementById('dfe-styles')) return
  const tag = document.createElement('style')
  tag.id = 'dfe-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

export default class Dev_FPS_Exp_ListOfEmotions {
  constructor (omniEmotionParticles) {
    this._particles = omniEmotionParticles
    this._el = null
    this._isOpen = false
    this._onNavSelect = null
  }

  init () {
    injectStyles()
    this._el = this._buildDOM()
    const shell = document.getElementById('omni-ui') ?? document.body
    shell.appendChild(this._el)
    this._bindEvents()

    this._onNavSelect = (e) => {
      if (e.detail?.item !== '⟐Dev_FPS_Exp_ListOfEmotions') return
      this.open()
    }
    window.addEventListener('omni:nav-select', this._onNavSelect)
  }

  update () {
    if (!this._isOpen) return
    const current = this._particles.getEmotion()
    this._el.querySelectorAll('.dfe-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.state === current)
    })
    this._el.querySelector('.dfe-current').textContent = `Current: ${EMOTION_STATES[current]?.label ?? current}`
  }

  onResize () {}

  destroy () {
    window.removeEventListener('omni:nav-select', this._onNavSelect)
    this._el?.parentNode?.removeChild(this._el)
  }

  open () { this._isOpen = true; this._el.classList.add('open') }
  close () { this._isOpen = false; this._el.classList.remove('open') }

  _buildDOM () {
    const el = document.createElement('div')
    el.className = 'dev-fps-exp-emotions-panel'
    const buttons = Object.entries(EMOTION_STATES).map(([key, s]) => `
      <button class="dfe-btn" data-state="${key}">
        <span class="dfe-swatch" style="background:${s.color}"></span>${s.label}
      </button>
    `).join('')
    el.innerHTML = `
      <div class="dfe-header">⟐ Dev_FPS_Exp_ListOfEmotions<button class="dfe-close">✕</button></div>
      <div class="dfe-body">${buttons}</div>
      <div class="dfe-current">Current: —</div>
    `
    return el
  }

  _bindEvents () {
    this._el.querySelector('.dfe-close').addEventListener('click', () => this.close())
    this._el.querySelectorAll('.dfe-btn').forEach(btn => {
      btn.addEventListener('click', () => this._particles.setEmotion(btn.dataset.state))
    })
  }
}
