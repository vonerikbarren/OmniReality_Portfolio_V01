/**
 * ui/OmniProgramPanel.js — ⟐OmniProgram panel
 *
 * The real dev tool (and, per direct confirmation, usable by a
 * regular user too, not gated to developers) that builds a real
 * OmniBotProgram — displayed in-scene as OmniNavi. Confirmed real
 * placement: Developer menu's own slot 2 (Dev02), sibling to
 * OmniCommandTerminal at slot 1 (Dev01).
 *
 * Confirmed unbounded/open-ended scope on purpose — left open for
 * future context upgrades and output sourcing. This builds the
 * real, first, honest version: label, tier, color, spawn position.
 */

const STYLES = `

.omni-program-panel {
  pointer-events   : auto;
  position         : fixed;
  top              : 130px;
  left             : 770px;
  width            : 280px;
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
.omni-program-panel.open { opacity: 1; visibility: visible; }

.opp-header {
  display: flex; align-items: center; justify-content: center;
  height: 36px; border-bottom: 1px solid rgba(255,255,255,0.08);
  font-size: 11px; color: rgba(255,255,255,0.7); position: relative;
}
.opp-close {
  position: absolute; right: 8px; background: none; border: none;
  color: rgba(255,255,255,0.4); font-size: 13px; cursor: pointer;
}
.opp-body { padding: 12px; display: flex; flex-direction: column; gap: 8px; }
.opp-input, .opp-select {
  width: 100%; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12);
  border-radius: 6px; color: #fff; font-family: inherit; font-size: 11px; padding: 6px 8px;
}
.opp-row { display: flex; gap: 6px; }
.opp-row .opp-input { flex: 1; }
.opp-spawn-btn {
  background: rgba(255,255,255,0.10); border: 1px solid rgba(255,255,255,0.15);
  color: #fff; border-radius: 6px; padding: 8px; cursor: pointer; font-size: 11px; margin-top: 4px;
}
.opp-list { font-size: 9.5px; color: rgba(255,255,255,0.5); margin-top: 4px; max-height: 100px; overflow-y: auto; }
`

function injectStyles () {
  if (document.getElementById('opp-styles')) return
  const tag = document.createElement('style')
  tag.id = 'opp-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

export default class OmniProgramPanel {
  constructor (omniBotProgram) {
    this._omniBotProgram = omniBotProgram
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
      if (e.detail?.item !== '⟐OmniProgram' && e.detail?.item !== '⟐OmniNavi') return
      this.open()
    }
    window.addEventListener('omni:nav-select', this._onNavSelect)
  }

  update () {}
  onResize () {}

  destroy () {
    window.removeEventListener('omni:nav-select', this._onNavSelect)
    this._el?.parentNode?.removeChild(this._el)
  }

  open () { this._isOpen = true; this._el.classList.add('open'); this._renderList() }
  close () { this._isOpen = false; this._el.classList.remove('open') }

  _buildDOM () {
    const el = document.createElement('div')
    el.className = 'omni-program-panel'
    el.innerHTML = `
      <div class="opp-header">⟐ OmniProgram<button class="opp-close">✕</button></div>
      <div class="opp-body">
        <input class="opp-input" id="opp-label" placeholder="Label" value="OmniNavi" />
        <div class="opp-row">
          <select class="opp-select" id="opp-tier">
            <option value="basic">Basic</option>
            <option value="intelligent">Intelligent</option>
          </select>
          <input class="opp-input" id="opp-color" type="color" value="#8899ff" />
        </div>
        <div class="opp-row">
          <input class="opp-input" id="opp-x" type="number" placeholder="x" value="0" />
          <input class="opp-input" id="opp-y" type="number" placeholder="y" value="0" />
          <input class="opp-input" id="opp-z" type="number" placeholder="z" value="0" />
        </div>
        <button class="opp-spawn-btn" id="opp-spawn">Build OmniBotProgram</button>
        <div class="opp-list" id="opp-list"></div>
      </div>
    `
    return el
  }

  _bindEvents () {
    this._el.querySelector('.opp-close').addEventListener('click', () => this.close())
    this._el.querySelector('#opp-spawn').addEventListener('click', () => {
      this._omniBotProgram.spawn({
        label: this._el.querySelector('#opp-label').value.trim() || 'OmniNavi',
        tier: this._el.querySelector('#opp-tier').value,
        color: this._el.querySelector('#opp-color').value,
        position: [
          Number(this._el.querySelector('#opp-x').value) || 0,
          Number(this._el.querySelector('#opp-y').value) || 0,
          Number(this._el.querySelector('#opp-z').value) || 0,
        ],
      })
      this._renderList()
    })
  }

  _renderList () {
    const list = this._el.querySelector('#opp-list')
    const bots = this._omniBotProgram.getBots()
    list.textContent = bots.length === 0
      ? 'No OmniBotPrograms built yet.'
      : bots.map(b => `${b.label} (${b.tier})`).join(', ')
  }
}
