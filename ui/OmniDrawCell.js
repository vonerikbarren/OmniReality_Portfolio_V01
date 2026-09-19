/**
 * ui/OmniDrawCell.js — ⟐OmniDraw(OmniCell)
 *
 * The real, fourth, standalone mode — confirmed directly: even
 * though Jsonifier already produces chart-eligible nodes, OmniCell
 * gets its own dedicated entry point, matching the real 4-hand
 * architecture in count, and because its own D3-specific settings
 * deserve a dedicated creation surface, not one buried inside a
 * general JSON-tree explorer.
 *
 * Reuses the exact same shared detection
 * (utils/ChartEligibility.js) Jsonifier's own tree-walker uses —
 * one real implementation, not two — and the same real placement
 * pattern (omni:node-create-request) every other mode already uses.
 * No tree, no toggles here — this mode goes straight from data to a
 * real chart node, since the point of a dedicated entry is skipping
 * the general explorer.
 */

import * as THREE from 'three'
import gsap from 'gsap'
import * as WindowManager from './WindowManager.js'
import { generateId } from '../systems/OmniNode.js'
import { confirmPrimaryForce } from '../utils/DesirePrimaryForce.js'
import { detectSeriesData } from '../utils/ChartEligibility.js'
import { registerChart } from '../utils/ChartDataRegistry.js'

const STYLES = `

.omni-draw-cell-panel {
  pointer-events   : auto;
  --odc-bg         : var(--omni-theme-bg, rgba(8, 8, 12, 0.92));
  --odc-border     : var(--omni-theme-border, rgba(255, 255, 255, 0.09));
  --odc-header-bg  : var(--omni-theme-header-bg, rgba(255, 255, 255, 0.03));
  --odc-text       : var(--omni-theme-text, rgba(255, 255, 255, 0.92));
  --odc-text-dim   : var(--omni-theme-text-dim, rgba(255, 255, 255, 0.65));
  --odc-accent     : var(--omni-theme-accent, #ffb347);
  --mono           : 'Courier New', Courier, monospace;

  position         : fixed;
  top              : 110px;
  left             : 480px;
  width            : 320px;
  min-width        : 260px;
  max-width        : 92vw;
  height           : 300px;
  min-height       : 220px;

  display          : flex;
  flex-direction   : column;

  background       : var(--odc-bg);
  backdrop-filter  : blur(20px) saturate(1.5);
  -webkit-backdrop-filter: blur(20px) saturate(1.5);
  border           : 1px solid var(--odc-border);
  border-radius    : 12px;
  box-shadow       : 0 0 20px rgba(0,0,0,0.4), 0 10px 30px rgba(0,0,0,0.5);

  font-family      : var(--mono);
  z-index          : 60;
  overflow         : hidden;
  resize           : both;
  opacity          : 0;
  visibility       : hidden;
}

.odc-header {
  height           : 38px;
  flex-shrink      : 0;
  display          : flex;
  align-items      : center;
  justify-content  : center;
  background       : var(--odc-header-bg);
  border-bottom    : 1px solid var(--odc-border);
  cursor           : grab;
  user-select      : none;
  position         : relative;
}
.odc-title { font-size: 11px; letter-spacing: 0.05em; color: var(--odc-text-dim); }
.odc-controls { position: absolute; right: 8px; display: flex; gap: 4px; }
.odc-ctrl {
  width: 20px; height: 20px; border-radius: 5px;
  border: 1px solid var(--odc-border); background: rgba(255,255,255,0.04);
  color: var(--odc-text-dim); font-size: 11px;
  display: flex; align-items: center; justify-content: center; cursor: pointer;
}
.odc-ctrl:hover { background: rgba(255,255,255,0.1); color: var(--odc-text); }

.odc-body { flex: 1 1 auto; padding: 14px 16px; display: flex; flex-direction: column; gap: 8px; }
.odc-name-input, .odc-json-input {
  background: rgba(255,255,255,0.04); border: 1px solid var(--odc-border);
  border-radius: 5px; color: var(--odc-text); font-family: inherit; font-size: 11px; padding: 7px;
}
.odc-json-input { flex: 1; resize: vertical; min-height: 90px; }
.odc-create-btn {
  background: rgba(255,179,71,0.15); border: 1px solid var(--odc-accent);
  color: var(--odc-accent); font-family: inherit; font-size: 11px; padding: 8px; border-radius: 5px; cursor: pointer;
}
.odc-create-btn:hover { background: rgba(255,179,71,0.25); }
.odc-error { color: #ff8c8c; font-size: 10px; }
.odc-note { font-size: 9px; color: var(--odc-text-dim); opacity: 0.75; line-height: 1.5; }

`

function injectStyles () {
  if (document.getElementById('odc-styles')) return
  const tag = document.createElement('style')
  tag.id = 'odc-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

export default class OmniDrawCell {
  constructor (context) {
    this.ctx = context
    this._el = null
    this._isOpen = false
    this._onNavSelect = null
  }

  init () {
    injectStyles()
    this._onNavSelect = (e) => {
      if (e.detail?.item !== '⟐OmniDrawCell') return
      this.open()
    }
    window.addEventListener('omni:nav-select', this._onNavSelect)
  }

  update () {}
  onResize () {}

  destroy () {
    window.removeEventListener('omni:nav-select', this._onNavSelect)
    this._el?.parentNode?.removeChild(this._el)
    WindowManager.unregister('omnidrawcell')
  }

  open () {
    if (!this._el) this._el = this._buildDOM()
    const shell = document.getElementById('omni-ui') ?? document.body
    if (!this._el.parentNode) shell.appendChild(this._el)
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
      detail: { id: 'omnidrawcell', label: '⟐OmniDraw(OmniCell)', iconLabel: '⟐📊',
        fromRect: { x: rect.left, y: rect.top, w: rect.width, h: rect.height }, variant: 'app' }
    }))
  }

  /** Real, direct creation — data straight to a chart node, no tree,
   *  no toggles. Uses the exact same shared detectSeriesData as
   *  Jsonifier's own tree-walker, so both agree on what counts as a
   *  real chart shape. */
  _createCell (name, rawJson) {
    let parsed
    try { parsed = JSON.parse(rawJson) } catch (err) {
      this._showError('Not valid JSON — ' + err.message)
      return
    }
    const seriesData = detectSeriesData(name || 'Untitled', parsed)
    if (!seriesData) {
      this._showError('Not a real chart shape — every value must be a number, or every group must contain only numbers.')
      return
    }
    this._clearError()

    const id = generateId()
    const cam = this.ctx.camera
    const dir = new THREE.Vector3()
    cam.getWorldDirection(dir)
    dir.multiplyScalar(6)
    const position = [cam.position.x + dir.x, Math.max(0.5, cam.position.y + dir.y), cam.position.z + dir.z]

    window.dispatchEvent(new CustomEvent('omni:node-create-request', {
      detail: {
        id, label: name || 'OmniCell_' + Date.now().toString(36).slice(-4),
        geometry: 'BoxGeometry', primitive: 'objective', color: '#ffb347',
        position, rotation: [0, 0, 0], scale: [0.3, 0.3, 0.3], parentId: null,
      }
    }))

    registerChart(id, {
      seriesData,
      seriesVisibility: Object.fromEntries(Object.keys(seriesData).map(n => [n, true])),
      chartType: 'bar',
    })

    confirmPrimaryForce('omnicell-created', true, { id, seriesCount: Object.keys(seriesData).length })
  }

  _showError (msg) {
    const el = this._el?.querySelector('#odc-error')
    if (el) { el.textContent = msg; el.style.display = ''; }
  }
  _clearError () {
    const el = this._el?.querySelector('#odc-error')
    if (el) el.style.display = 'none'
  }

  _buildDOM () {
    const el = document.createElement('div')
    el.className = 'omni-draw-cell-panel'
    el.innerHTML = `
      <div class="odc-header">
        <span class="odc-title">⟐OmniDraw(OmniCell)</span>
        <div class="odc-controls">
          <button class="odc-ctrl" data-action="minimize" title="Minimize">–</button>
          <button class="odc-ctrl" data-action="close" title="Close">×</button>
        </div>
      </div>
      <div class="odc-body">
        <input type="text" class="odc-name-input" id="odc-name-input" placeholder="Chart name — e.g. Sales 2026" />
        <textarea class="odc-json-input" id="odc-json-input" placeholder='{"Jan": 12000, "Feb": 15500}'></textarea>
        <button class="odc-create-btn" id="odc-create">Create Chart Node</button>
        <div class="odc-error" id="odc-error" style="display:none"></div>
        <div class="odc-note">Every value a number → one series. Every group all-numeric → multiple series, toggleable later in OmniCellPanel.</div>
      </div>
    `

    el.querySelector('[data-action="minimize"]').addEventListener('click', () => this.minimize())
    el.querySelector('[data-action="close"]').addEventListener('click', () => this.close())
    el.querySelector('#odc-create').addEventListener('click', () => {
      this._createCell(el.querySelector('#odc-name-input').value, el.querySelector('#odc-json-input').value)
    })

    this._bindHeader(el)
    el.dataset.winId = 'omnidrawcell'
    WindowManager.register('omnidrawcell', el, 'OmniDraw(OmniCell)')
    WindowManager.watchPanelOpacity(el, () => this._isOpen)

    return el
  }

  _bindHeader (el) {
    const header = el.querySelector('.odc-header')
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
}
