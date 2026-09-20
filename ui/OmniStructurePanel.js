/**
 * ui/OmniStructurePanel.js — ⟐OmniStructurePanel
 *
 * "They seem to form like trees... let's say I want the structure
 * to be linear either vertically or horizontally or via depth."
 * Confirmed directly: real alternatives alongside the existing
 * toggle mechanic, not a replacement for it — this panel only
 * changes *how* a branch's children are arranged in space, never
 * whether they're shown at all.
 *
 * Retargeted by selection, matching OmniCommunicationPanel/
 * OmniCellPanel's own real model, including the same real UX fix —
 * never force-opens for a node with no real children to arrange.
 *
 * Holds a direct reference to the real OmniJsonifier instance (the
 * same real pattern OmniGrab already has in ToolTipMenu) since
 * layout is genuinely Jsonifier's own tree data, not a separate
 * system to duplicate.
 */

import gsap from 'gsap'
import * as WindowManager from './WindowManager.js'
import { LAYOUT_MODES } from '../utils/TreeLayout.js'

const MODE_LABELS = {
  'tree': 'Tree (circular)',
  'linear-vertical': 'Linear — Vertical',
  'linear-horizontal': 'Linear — Horizontal',
  'linear-depth': 'Linear — Depth (Z-axis)',
  'sphere': 'Sphere',
  'spiral': 'Spiral',
}

const STYLES = `

.omni-structure-panel {
  pointer-events   : auto;
  --osp-bg         : var(--omni-theme-bg, rgba(8, 8, 12, 0.92));
  --osp-border     : var(--omni-theme-border, rgba(255, 255, 255, 0.09));
  --osp-header-bg  : var(--omni-theme-header-bg, rgba(255, 255, 255, 0.03));
  --osp-text       : var(--omni-theme-text, rgba(255, 255, 255, 0.92));
  --osp-text-dim   : var(--omni-theme-text-dim, rgba(255, 255, 255, 0.65));
  --osp-accent     : var(--omni-theme-accent, #7fd8ff);
  --mono           : 'Courier New', Courier, monospace;

  position         : fixed;
  top              : 130px;
  left             : 540px;
  width            : 280px;
  min-width        : 240px;
  height           : 260px;
  min-height       : 200px;

  display          : flex;
  flex-direction   : column;

  background       : var(--osp-bg);
  backdrop-filter  : blur(20px) saturate(1.5);
  -webkit-backdrop-filter: blur(20px) saturate(1.5);
  border           : 1px solid var(--osp-border);
  border-radius    : 12px;
  box-shadow       : 0 0 20px rgba(0,0,0,0.4), 0 10px 30px rgba(0,0,0,0.5);

  font-family      : var(--mono);
  z-index          : 60;
  overflow         : hidden;
  resize           : both;
  opacity          : 0;
  visibility       : hidden;
}

.osp-header {
  height           : 38px;
  flex-shrink      : 0;
  display          : flex;
  align-items      : center;
  justify-content  : center;
  background       : var(--osp-header-bg);
  border-bottom    : 1px solid var(--osp-border);
  cursor           : grab;
  user-select      : none;
  position         : relative;
}
.osp-title { font-size: 11px; letter-spacing: 0.05em; color: var(--osp-text-dim); }
.osp-controls { position: absolute; right: 8px; display: flex; gap: 4px; }
.osp-ctrl {
  width: 20px; height: 20px; border-radius: 5px;
  border: 1px solid var(--osp-border); background: rgba(255,255,255,0.04);
  color: var(--osp-text-dim); font-size: 11px;
  display: flex; align-items: center; justify-content: center; cursor: pointer;
}
.osp-ctrl:hover { background: rgba(255,255,255,0.1); color: var(--osp-text); }

.osp-body { flex: 1 1 auto; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 6px; }
.osp-empty { color: var(--osp-text-dim); font-size: 11px; text-align: center; padding: 30px 10px; line-height: 1.6; }
.osp-mode-btn {
  background: rgba(255,255,255,0.05); border: 1px solid var(--osp-border);
  color: var(--osp-text); font-family: inherit; font-size: 11px; padding: 9px; border-radius: 6px;
  cursor: pointer; text-align: left;
}
.osp-mode-btn:hover { background: rgba(255,255,255,0.1); }
.osp-mode-btn.is-active { border-color: var(--osp-accent); color: var(--osp-accent); background: rgba(127,216,255,0.1); }

`

function injectStyles () {
  if (document.getElementById('osp-styles')) return
  const tag = document.createElement('style')
  tag.id = 'osp-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

export default class OmniStructurePanel {
  constructor (context, jsonifier) {
    this.ctx = context
    this.jsonifier = jsonifier
    this._el = null
    this._isOpen = false
    this._currentNode = null
    this._onStructureFocus = null
  }

  init () {
    injectStyles()
    // Real fix — this used to listen to the shared omni:node-selected
    // event, the same one Inspector, OmniPocket, OmniTargeting, and
    // several other systems all listen to. Every time Structure was
    // opened, all of them fired too, regardless of intent — which is
    // exactly why Inspector appeared to "open instead." A dedicated
    // event means opening Structure now only ever does that.
    this._onStructureFocus = (e) => this._retarget(e.detail?.mesh)
    window.addEventListener('omni:structure-focus', this._onStructureFocus)
  }

  update () {}
  onResize () {}

  destroy () {
    window.removeEventListener('omni:structure-focus', this._onStructureFocus)
    this._el?.parentNode?.removeChild(this._el)
    WindowManager.unregister('omnistructurepanel')
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
      detail: { id: 'omnistructurepanel', label: '⟐OmniStructurePanel', iconLabel: '⟐▤',
        fromRect: { x: rect.left, y: rect.top, w: rect.width, h: rect.height }, variant: 'app' }
    }))
  }

  /** Real retargeting, matching the same UX fix already proven in
   *  OmniCommunicationPanel/OmniCellPanel: only auto-opens for a
   *  node with real children to arrange. */
  _retarget (mesh) {
    const nodeId = mesh?.userData?.nodeId ?? null
    const treeRoot = this.jsonifier?._tree
    this._currentNode = (nodeId && treeRoot) ? this.jsonifier._findNode(treeRoot, nodeId) : null

    if (this._currentNode && this._currentNode.children.length > 0) {
      if (!this._el) this._el = this._buildDOM()
      this.open()
    } else if (!this._isOpen) {
      return
    }
    this._render()
  }

  _render () {
    const body = this._el?.querySelector('.osp-body')
    if (!body) return
    if (!this._currentNode || this._currentNode.children.length === 0) {
      body.innerHTML = `<div class="osp-empty">Select a node with real children to arrange its structure here.</div>`
      return
    }

    const node = this._currentNode
    body.innerHTML = LAYOUT_MODES.map(mode => `
      <button class="osp-mode-btn ${mode === node.layoutMode ? 'is-active' : ''}" data-mode="${mode}">${MODE_LABELS[mode]}</button>
    `).join('')

    LAYOUT_MODES.forEach(mode => {
      body.querySelector(`[data-mode="${mode}"]`).addEventListener('click', () => {
        this.jsonifier.setLayoutMode(node, mode)
        this._render()
      })
    })
  }

  _buildDOM () {
    const el = document.createElement('div')
    el.className = 'omni-structure-panel'
    el.innerHTML = `
      <div class="osp-header">
        <span class="osp-title">⟐OmniStructurePanel</span>
        <div class="osp-controls">
          <button class="osp-ctrl" data-action="minimize" title="Minimize">–</button>
          <button class="osp-ctrl" data-action="close" title="Close">×</button>
        </div>
      </div>
      <div class="osp-body"></div>
    `

    el.querySelector('[data-action="minimize"]').addEventListener('click', () => this.minimize())
    el.querySelector('[data-action="close"]').addEventListener('click', () => this.close())

    this._bindHeader(el)
    el.dataset.winId = 'omnistructurepanel'
    WindowManager.register('omnistructurepanel', el, 'OmniStructurePanel')
    WindowManager.watchPanelOpacity(el, () => this._isOpen)

    return el
  }

  _bindHeader (el) {
    const header = el.querySelector('.osp-header')
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
