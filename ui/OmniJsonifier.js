/**
 * ui/OmniJsonifier.js — ⟐OmniJsonifier
 *
 * JSON tree construction for OmniDraw(Dynamic) — "data manipulation
 * based on type of data structure type." Confirmed scope, per the
 * explicit request: live, manual, toggle-per-branch reveal, "so we
 * don't break anything" — not OmniCryptexLab's replace-on-drill
 * pattern. Multiple branches can be open at once; each toggle
 * controls its own real 3D children, created and removed live as
 * the toggle opens and closes.
 *
 * Reuses two real, existing mechanisms rather than inventing new
 * ones: `omni:node-create-request` (Static's own placement pattern,
 * now with a real `parentId` — previously always null in Dynamic)
 * for every tree/leaf node, and `WordTicker` (utils/WordTicker.js)
 * for any leaf whose value is a multi-word string — "these are
 * forms," a ticker among them, reused, not duplicated.
 */

import * as THREE from 'three'
import gsap from 'gsap'
import * as WindowManager from './WindowManager.js'
import { generateId } from '../systems/OmniNode.js'
import { confirmPrimaryForce } from '../utils/DesirePrimaryForce.js'
import WordTicker from '../utils/WordTicker.js'

const CHILD_OFFSET = 2.4   // world units each child sits from its own parent

const STYLES = `

.omni-jsonifier-panel {
  pointer-events   : auto;
  --oj-bg          : var(--omni-theme-bg, rgba(8, 8, 12, 0.92));
  --oj-border      : var(--omni-theme-border, rgba(255, 255, 255, 0.09));
  --oj-header-bg   : var(--omni-theme-header-bg, rgba(255, 255, 255, 0.03));
  --oj-text        : var(--omni-theme-text, rgba(255, 255, 255, 0.92));
  --oj-text-dim    : var(--omni-theme-text-dim, rgba(255, 255, 255, 0.65));
  --oj-accent      : var(--omni-theme-accent, #7fd8ff);
  --mono           : 'Courier New', Courier, monospace;

  position         : fixed;
  top              : 120px;
  left             : 480px;
  width            : 340px;
  min-width        : 280px;
  max-width        : 92vw;
  height           : 420px;
  min-height       : 260px;

  display          : flex;
  flex-direction   : column;

  background       : var(--oj-bg);
  backdrop-filter  : blur(20px) saturate(1.5);
  -webkit-backdrop-filter: blur(20px) saturate(1.5);
  border           : 1px solid var(--oj-border);
  border-radius    : 12px;
  box-shadow       : 0 0 20px rgba(0,0,0,0.4), 0 10px 30px rgba(0,0,0,0.5);

  font-family      : var(--mono);
  z-index          : 60;
  overflow         : hidden;
  resize           : both;
  opacity          : 0;
  visibility       : hidden;
}

.oj-header {
  height           : 38px;
  flex-shrink      : 0;
  display          : flex;
  align-items      : center;
  justify-content  : center;
  background       : var(--oj-header-bg);
  border-bottom    : 1px solid var(--oj-border);
  cursor           : grab;
  user-select      : none;
  position         : relative;
}
.oj-title { font-size: 11px; letter-spacing: 0.05em; color: var(--oj-text-dim); }
.oj-controls { position: absolute; right: 8px; display: flex; gap: 4px; }
.oj-ctrl {
  width: 20px; height: 20px; border-radius: 5px;
  border: 1px solid var(--oj-border); background: rgba(255,255,255,0.04);
  color: var(--oj-text-dim); font-size: 11px;
  display: flex; align-items: center; justify-content: center; cursor: pointer;
}
.oj-ctrl:hover { background: rgba(255,255,255,0.1); color: var(--oj-text); }

.oj-body { flex: 1 1 auto; overflow-y: auto; padding: 10px 12px; }
.oj-text-input {
  width: 100%; height: 56px; resize: vertical; margin-bottom: 8px;
  background: rgba(255,255,255,0.04); border: 1px solid var(--oj-border);
  border-radius: 5px; color: var(--oj-text); font-family: inherit; font-size: 11px; padding: 7px;
}
.oj-create-btn {
  width: 100%; background: rgba(127,216,255,0.15); border: 1px solid var(--oj-accent);
  color: var(--oj-accent); font-family: inherit; font-size: 11px; padding: 7px; border-radius: 5px;
  cursor: pointer; margin-bottom: 10px;
}
.oj-create-btn:hover { background: rgba(127,216,255,0.25); }
.oj-error { color: #ff8c8c; font-size: 10px; margin-bottom: 8px; }

.oj-node { font-size: 11px; color: var(--oj-text); }
.oj-row { display: flex; align-items: center; gap: 6px; padding: 3px 0; cursor: pointer; }
.oj-row:hover { color: var(--oj-accent); }
.oj-toggle { width: 14px; text-align: center; color: var(--oj-text-dim); flex-shrink: 0; }
.oj-key { color: var(--oj-accent); }
.oj-leaf-value { color: var(--oj-text-dim); }
.oj-children { padding-left: 16px; border-left: 1px solid var(--oj-border); margin-left: 6px; }
.oj-children.is-collapsed { display: none; }

.oj-resize-handle { position: absolute; right: 0; bottom: 0; width: 14px; height: 14px; cursor: nwse-resize; }
.oj-resize-handle::before {
  content: ''; position: absolute; right: 3px; bottom: 3px; width: 7px; height: 7px;
  border-right: 2px solid rgba(255,255,255,0.25); border-bottom: 2px solid rgba(255,255,255,0.25);
}

`

function injectStyles () {
  if (document.getElementById('oj-styles')) return
  const tag = document.createElement('style')
  tag.id = 'oj-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

export default class OmniJsonifier {
  constructor (context) {
    this.ctx = context
    this._el = null
    this._isOpen = false
    this._tree = null        // the real, parsed tree — { key, value, children: [...], nodeId, isOpen, meshCreated }
    this._tickers = []       // real WordTicker instances for multi-word leaves, live across open/close
    this._onNavSelect = null
  }

  init () {
    injectStyles()
    this._onNavSelect = (e) => {
      if (e.detail?.item !== '⟐OmniJsonifier') return
      this.open()
    }
    window.addEventListener('omni:nav-select', this._onNavSelect)
  }

  update (delta) {
    this._tickers.forEach(t => t.update(delta))
  }

  onResize () {}

  destroy () {
    window.removeEventListener('omni:nav-select', this._onNavSelect)
    this._tickers.forEach(t => t.destroy())
    this._tickers = []
    this._el?.parentNode?.removeChild(this._el)
    WindowManager.unregister('omnijsonifier')
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
      detail: { id: 'omnijsonifier', label: '⟐OmniJsonifier', iconLabel: '⟐J',
        fromRect: { x: rect.left, y: rect.top, w: rect.width, h: rect.height }, variant: 'orb' }
    }))
  }

  /** Real JSON parsing, then a real, recursive tree built from it —
   *  no 3D nodes yet at this point, only the root, matching "the
   *  user will have to manually open up the contexts." */
  _loadJson (rawText) {
    let parsed
    try { parsed = JSON.parse(rawText) } catch (err) {
      this._showError('Not valid JSON — ' + err.message)
      return
    }
    this._clearError()

    const cam = this.ctx.camera
    const dir = new THREE.Vector3()
    cam.getWorldDirection(dir)
    dir.multiplyScalar(6)
    const rootPos = new THREE.Vector3(cam.position.x + dir.x, Math.max(0.5, cam.position.y + dir.y), cam.position.z + dir.z)

    this._tree = this._buildTreeNode('root', parsed, rootPos, null)
    this._spawnMesh(this._tree)   // the root is always real immediately — everything under it waits for a real toggle
    this._renderTree()

    confirmPrimaryForce('json-tree-created', true, { rootKey: 'root' })
  }

  /** Builds the real, in-memory tree structure recursively — no 3D
   *  side effects here at all; mesh creation is deferred until a
   *  branch is actually toggled open. */
  _buildTreeNode (key, value, position, parentNodeId) {
    const nodeId = generateId()
    const isLeaf = value === null || typeof value !== 'object'
    const node = {
      nodeId, key, value, position, parentNodeId,
      isLeaf, isOpen: false, meshCreated: false, children: [],
    }
    if (!isLeaf) {
      const entries = Array.isArray(value) ? value.map((v, i) => [String(i), v]) : Object.entries(value)
      node.children = entries.map(([childKey, childValue], i) => {
        const angle = (i / Math.max(1, entries.length)) * Math.PI * 2
        const childPos = new THREE.Vector3(
          position.x + Math.cos(angle) * CHILD_OFFSET,
          position.y - 1.2,
          position.z + Math.sin(angle) * CHILD_OFFSET,
        )
        return this._buildTreeNode(childKey, childValue, childPos, nodeId)
      })
    }
    return node
  }

  /** Real 3D placement — reuses Static's own real mechanism, now
   *  with a genuine parentId instead of always null. Multi-word
   *  string leaves get a real WordTicker attached; everything else
   *  gets a plain labeled node. */
  _spawnMesh (node) {
    if (node.meshCreated) return
    node.meshCreated = true

    const words = node.isLeaf && typeof node.value === 'string' ? node.value.trim().split(/\s+/).filter(Boolean) : null
    const isTickerLeaf = words && words.length > 1

    window.dispatchEvent(new CustomEvent('omni:node-create-request', {
      detail: {
        id: node.nodeId,
        label: node.key,
        geometry: node.isLeaf ? 'SphereGeometry' : 'OctahedronGeometry',
        primitive: 'objective',
        color: node.isLeaf ? '#8cff8c' : '#7fd8ff',
        position: [node.position.x, node.position.y, node.position.z],
        rotation: [0, 0, 0],
        scale: node.isLeaf ? [0.22, 0.22, 0.22] : [0.3, 0.3, 0.3],
        parentId: node.parentNodeId,   // the real fix — Dynamic's own ticker still sends null; a tree node never should
      }
    }))

    if (isTickerLeaf) {
      this._tickers.push(new WordTicker(this.ctx.camera, node.position.clone(), words))
    }
  }

  _despawnMesh (node) {
    if (!node.meshCreated) return
    node.meshCreated = false
    window.dispatchEvent(new CustomEvent('omni:node-delete-request', { detail: { id: node.nodeId } }))
    this._tickers = this._tickers.filter(t => {
      const isThisNode = t.worldPos.equals(node.position)
      if (isThisNode) t.destroy()
      return !isThisNode
    })
  }

  /** The real toggle — opening a branch spawns every one of its
   *  direct children live; closing it despawns them (and, recursively,
   *  anything open beneath them), rather than leaving orphaned nodes
   *  behind. */
  _toggleBranch (node) {
    node.isOpen = !node.isOpen
    if (node.isOpen) {
      node.children.forEach(child => this._spawnMesh(child))
    } else {
      node.children.forEach(child => this._collapseRecursive(child))
    }
    this._renderTree()
  }

  _collapseRecursive (node) {
    if (node.isOpen) {
      node.children.forEach(child => this._collapseRecursive(child))
      node.isOpen = false
    }
    this._despawnMesh(node)
  }

  _renderTree () {
    const container = this._el?.querySelector('#oj-tree')
    if (!container || !this._tree) return
    container.innerHTML = this._renderNode(this._tree)
    this._bindTreeClicks(container)
  }

  _renderNode (node) {
    const valuePreview = node.isLeaf ? ` = ${JSON.stringify(node.value)}` : ` (${node.children.length})`
    const toggleSymbol = node.isLeaf ? '·' : (node.isOpen ? '▾' : '▸')
    let html = `
      <div class="oj-node">
        <div class="oj-row" data-node-id="${node.nodeId}">
          <span class="oj-toggle">${toggleSymbol}</span>
          <span class="oj-key">${node.key}</span>
          <span class="oj-leaf-value">${valuePreview}</span>
        </div>
    `
    if (!node.isLeaf) {
      html += `<div class="oj-children ${node.isOpen ? '' : 'is-collapsed'}">`
      html += node.children.map(child => this._renderNode(child)).join('')
      html += `</div>`
    }
    html += `</div>`
    return html
  }

  _bindTreeClicks (container) {
    container.querySelectorAll('.oj-row').forEach(row => {
      row.addEventListener('click', () => {
        const nodeId = row.dataset.nodeId
        const node = this._findNode(this._tree, nodeId)
        if (node && !node.isLeaf) this._toggleBranch(node)
      })
    })
  }

  _findNode (node, nodeId) {
    if (!node) return null
    if (node.nodeId === nodeId) return node
    for (const child of node.children) {
      const found = this._findNode(child, nodeId)
      if (found) return found
    }
    return null
  }

  _showError (msg) {
    const el = this._el?.querySelector('#oj-error')
    if (el) { el.textContent = msg; el.style.display = ''; }
  }
  _clearError () {
    const el = this._el?.querySelector('#oj-error')
    if (el) el.style.display = 'none'
  }

  _buildDOM () {
    const el = document.createElement('div')
    el.className = 'omni-jsonifier-panel'
    el.innerHTML = `
      <div class="oj-header">
        <span class="oj-title">⟐OmniJsonifier</span>
        <div class="oj-controls">
          <button class="oj-ctrl" data-action="minimize" title="Minimize">–</button>
          <button class="oj-ctrl" data-action="close" title="Close">×</button>
        </div>
      </div>
      <div class="oj-body">
        <textarea class="oj-text-input" id="oj-json-input" placeholder='{"example": {"nested": "value"}}'></textarea>
        <button class="oj-create-btn" id="oj-create">Build Tree</button>
        <div class="oj-error" id="oj-error" style="display:none"></div>
        <div id="oj-tree"></div>
      </div>
      <div class="oj-resize-handle" aria-hidden="true"></div>
    `

    el.querySelector('[data-action="minimize"]').addEventListener('click', () => this.minimize())
    el.querySelector('[data-action="close"]').addEventListener('click', () => this.close())
    el.querySelector('#oj-create').addEventListener('click', () => {
      this._loadJson(el.querySelector('#oj-json-input').value)
    })

    this._bindHeader(el)
    el.dataset.winId = 'omnijsonifier'
    WindowManager.register('omnijsonifier', el, 'OmniJsonifier')
    WindowManager.watchPanelOpacity(el, () => this._isOpen)

    return el
  }

  _bindHeader (el) {
    const header = el.querySelector('.oj-header')
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
