/**
 * ui/OmniRealityGridSelectorPanel.js — ⟐OmniRealityGridSelector panel
 *
 * The real, Admin-reachable UI for the grid-staging tool — start/stop
 * selecting real floor cells, name and save the current real
 * selection as a spatial context, and browse/load/delete real,
 * previously-saved contexts.
 */

import * as WindowManager from './WindowManager.js'

const STYLES = `

.omni-grid-selector-panel {
  pointer-events   : auto;
  position         : fixed;
  top              : 130px;
  left             : 130px;
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
.omni-grid-selector-panel.open { opacity: 1; visibility: visible; }

.ogs-header {
  display: flex; align-items: center; justify-content: center;
  height: 36px; border-bottom: 1px solid rgba(255,255,255,0.08);
  font-size: 11px; color: rgba(255,255,255,0.7); position: relative;
}
.ogs-close {
  position: absolute; right: 8px; background: none; border: none;
  color: rgba(255,255,255,0.4); font-size: 13px; cursor: pointer;
}
.ogs-body { padding: 12px; display: flex; flex-direction: column; gap: 8px; }
.ogs-select-btn {
  background: rgba(255,255,255,0.10); border: 1px solid rgba(255,255,255,0.15);
  color: #fff; border-radius: 8px; padding: 8px; cursor: pointer; font-size: 11px;
}
.ogs-select-btn.active { background: rgba(255, 238, 0, 0.18); border-color: rgba(255, 238, 0, 0.4); }
.ogs-row { display: flex; gap: 6px; }
.ogs-input {
  flex: 1; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12);
  border-radius: 6px; color: #fff; font-family: inherit; font-size: 11px; padding: 6px 8px;
}
.ogs-save-btn {
  background: rgba(255,255,255,0.10); border: 1px solid rgba(255,255,255,0.15);
  color: #fff; border-radius: 6px; padding: 6px 10px; cursor: pointer; font-size: 11px;
}
.ogs-cell-count { font-size: 9.5px; color: rgba(255,255,255,0.5); }
.ogs-context-list { display: flex; flex-direction: column; gap: 4px; max-height: 160px; overflow-y: auto; }
.ogs-context-item {
  display: flex; align-items: center; gap: 6px; padding: 5px 8px;
  background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px;
  font-size: 10px; color: rgba(255,255,255,0.85);
}
.ogs-context-item span { flex: 1; }
.ogs-context-btn {
  background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); border-radius: 4px;
  color: #fff; font-size: 9px; padding: 2px 6px; cursor: pointer;
}
`

function injectStyles () {
  if (document.getElementById('ogs-styles')) return
  const tag = document.createElement('style')
  tag.id = 'ogs-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

export default class OmniRealityGridSelectorPanel {
  constructor (gridSelector) {
    this._gridSelector = gridSelector
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
      if (e.detail?.item !== '⟐OmniRealityGridSelector') return
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

  open () { this._isOpen = true; this._el.classList.add('open'); this._renderContexts() }
  close () { this._isOpen = false; this._el.classList.remove('open') }

  _buildDOM () {
    const el = document.createElement('div')
    el.className = 'omni-grid-selector-panel'
    el.innerHTML = `
      <div class="ogs-header">⟐ OmniRealityGridSelector<button class="ogs-close">✕</button></div>
      <div class="ogs-body">
        <button class="ogs-select-btn" id="ogs-toggle">Start Selecting</button>
        <div class="ogs-cell-count" id="ogs-cell-count">0 cells selected</div>
        <div class="ogs-row">
          <input class="ogs-input" id="ogs-id" placeholder="Context id" />
          <button class="ogs-save-btn" id="ogs-save">Save</button>
        </div>
        <div class="ogs-context-list" id="ogs-context-list"></div>
      </div>
    `
    return el
  }

  _bindEvents () {
    this._el.querySelector('.ogs-close').addEventListener('click', () => this.close())

    const toggleBtn = this._el.querySelector('#ogs-toggle')
    toggleBtn.addEventListener('click', () => {
      if (this._gridSelector._isSelecting) {
        this._gridSelector.stopSelecting()
        toggleBtn.textContent = 'Start Selecting'
        toggleBtn.classList.remove('active')
      } else {
        this._gridSelector.startSelecting()
        toggleBtn.textContent = 'Stop Selecting'
        toggleBtn.classList.add('active')
      }
    })

    this._el.querySelector('#ogs-save').addEventListener('click', () => {
      const id = this._el.querySelector('#ogs-id').value.trim()
      if (!id) return
      this._gridSelector.saveContext(id, id)
      this._gridSelector.clearSelection()
      this._el.querySelector('#ogs-id').value = ''
      this._updateCellCount()
      this._renderContexts()
    })
  }

  _updateCellCount () {
    this._el.querySelector('#ogs-cell-count').textContent = `${this._gridSelector._selectedCells.length} cells selected`
  }

  _renderContexts () {
    const list = this._el.querySelector('#ogs-context-list')
    const contexts = this._gridSelector.getContexts()
    const ids = Object.keys(contexts)

    if (ids.length === 0) {
      list.innerHTML = `<div class="ogs-cell-count">No saved contexts yet.</div>`
      return
    }

    list.innerHTML = ids.map(id => `
      <div class="ogs-context-item">
        <span>${contexts[id].label} (${contexts[id].cells.length})</span>
        <button class="ogs-context-btn" data-action="load" data-id="${id}">Load</button>
        <button class="ogs-context-btn" data-action="delete" data-id="${id}">✕</button>
      </div>
    `).join('')

    list.querySelectorAll('[data-action="load"]').forEach(btn => {
      btn.addEventListener('click', () => this._gridSelector.loadContext(btn.dataset.id))
    })
    list.querySelectorAll('[data-action="delete"]').forEach(btn => {
      btn.addEventListener('click', () => { this._gridSelector.deleteContext(btn.dataset.id); this._renderContexts() })
    })
  }
}
