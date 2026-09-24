/**
 * ui/OmniRealityGridPointSelectorPanel.js — ⟐OmniRealityGridPointSelector panel
 *
 * Real Admin-reachable UI for the point-staging tool — start/stop
 * selecting real points, subdivide the cell under the last-picked
 * point for finer anchor points, and raise a real vertical wall
 * from a chosen edge of that same cell.
 */

const STYLES = `

.omni-grid-point-selector-panel {
  pointer-events   : auto;
  position         : fixed;
  top              : 130px;
  left             : 450px;
  width            : 300px;
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
.omni-grid-point-selector-panel.open { opacity: 1; visibility: visible; }

.ogps-header {
  display: flex; align-items: center; justify-content: center;
  height: 36px; border-bottom: 1px solid rgba(255,255,255,0.08);
  font-size: 11px; color: rgba(255,255,255,0.7); position: relative;
}
.ogps-close {
  position: absolute; right: 8px; background: none; border: none;
  color: rgba(255,255,255,0.4); font-size: 13px; cursor: pointer;
}
.ogps-body { padding: 12px; display: flex; flex-direction: column; gap: 8px; }
.ogps-select-btn {
  background: rgba(255,255,255,0.10); border: 1px solid rgba(255,255,255,0.15);
  color: #fff; border-radius: 8px; padding: 8px; cursor: pointer; font-size: 11px;
}
.ogps-select-btn.active { background: rgba(255, 238, 0, 0.18); border-color: rgba(255, 238, 0, 0.4); }
.ogps-point-count { font-size: 9.5px; color: rgba(255,255,255,0.5); }
.ogps-section-label { font-size: 9.5px; color: rgba(255,255,255,0.5); margin-top: 4px; }
.ogps-row { display: flex; gap: 6px; }
.ogps-input, .ogps-select {
  flex: 1; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12);
  border-radius: 6px; color: #fff; font-family: inherit; font-size: 11px; padding: 6px 8px;
}
.ogps-action-btn {
  background: rgba(255,255,255,0.10); border: 1px solid rgba(255,255,255,0.15);
  color: #fff; border-radius: 6px; padding: 6px 10px; cursor: pointer; font-size: 11px;
}
`

function injectStyles () {
  if (document.getElementById('ogps-styles')) return
  const tag = document.createElement('style')
  tag.id = 'ogps-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

export default class OmniRealityGridPointSelectorPanel {
  constructor (pointSelector) {
    this._pointSelector = pointSelector
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
      if (e.detail?.item !== '⟐OmniRealityGridPointSelector') return
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

  open () { this._isOpen = true; this._el.classList.add('open') }
  close () { this._isOpen = false; this._el.classList.remove('open') }

  _buildDOM () {
    const el = document.createElement('div')
    el.className = 'omni-grid-point-selector-panel'
    el.innerHTML = `
      <div class="ogps-header">⟐ OmniRealityGridPointSelector<button class="ogps-close">✕</button></div>
      <div class="ogps-body">
        <button class="ogps-select-btn" id="ogps-toggle">Start Selecting</button>
        <div class="ogps-point-count" id="ogps-point-count">0 points selected</div>

        <div class="ogps-section-label">Local subdivision — finer anchors within one real cell, floor grid unaffected</div>
        <div class="ogps-row">
          <input class="ogps-input" id="ogps-cx" placeholder="cx" type="number" />
          <input class="ogps-input" id="ogps-cz" placeholder="cz" type="number" />
          <select class="ogps-select" id="ogps-subdiv">
            <option value="1">1× (corners only)</option>
            <option value="2">2×</option>
            <option value="4">4×</option>
            <option value="8">8×</option>
          </select>
          <button class="ogps-action-btn" id="ogps-apply-subdiv">Set</button>
        </div>

        <div class="ogps-section-label">Vertical wall — grows from one real edge of a cell</div>
        <div class="ogps-row">
          <select class="ogps-select" id="ogps-edge">
            <option value="north">North</option>
            <option value="south">South</option>
            <option value="east">East</option>
            <option value="west">West</option>
          </select>
          <input class="ogps-input" id="ogps-height" placeholder="Height (cells)" type="number" value="3" />
          <button class="ogps-action-btn" id="ogps-raise-wall">Raise</button>
        </div>
      </div>
    `
    return el
  }

  _bindEvents () {
    this._el.querySelector('.ogps-close').addEventListener('click', () => this.close())

    const toggleBtn = this._el.querySelector('#ogps-toggle')
    toggleBtn.addEventListener('click', () => {
      if (this._pointSelector._isSelecting) {
        this._pointSelector.stopSelecting()
        toggleBtn.textContent = 'Start Selecting'
        toggleBtn.classList.remove('active')
      } else {
        this._pointSelector.startSelecting()
        toggleBtn.textContent = 'Stop Selecting'
        toggleBtn.classList.add('active')
      }
    })

    this._el.querySelector('#ogps-apply-subdiv').addEventListener('click', () => {
      const cx = Number(this._el.querySelector('#ogps-cx').value)
      const cz = Number(this._el.querySelector('#ogps-cz').value)
      const level = Number(this._el.querySelector('#ogps-subdiv').value)
      this._pointSelector.setSubdivision(cx, cz, level)
    })

    this._el.querySelector('#ogps-raise-wall').addEventListener('click', () => {
      const cx = Number(this._el.querySelector('#ogps-cx').value)
      const cz = Number(this._el.querySelector('#ogps-cz').value)
      const edge = this._el.querySelector('#ogps-edge').value
      const height = Number(this._el.querySelector('#ogps-height').value) || 3
      const id = `wall-${cx}-${cz}-${edge}`
      this._pointSelector.raiseWall(id, cx, cz, edge, height)
    })
  }
}
