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
import { registerTicker, unregisterTicker } from '../utils/WordTickerRegistry.js'
import { registerChart, unregisterChart } from '../utils/ChartDataRegistry.js'
import { detectSeriesData } from '../utils/ChartEligibility.js'
import { computeChildPosition } from '../utils/TreeLayout.js'

const CHILD_OFFSET = 2.4   // world units each child sits from its own parent
const STORE_KEY = 'omni:jsonifier:tree'   // real persistence — the actual fix for "the toggle tree doesn't reappear" after a page refresh

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
.oj-toolbar-row { display: flex; gap: 6px; margin-bottom: 10px; }
.oj-create-btn {
  flex: 1; background: rgba(127,216,255,0.15); border: 1px solid var(--oj-accent);
  color: var(--oj-accent); font-family: inherit; font-size: 11px; padding: 7px; border-radius: 5px;
  cursor: pointer;
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
  constructor (context, omniNode) {
    this.ctx = context
    this.omniNode = omniNode
    this._el = null
    this._isOpen = false
    this._tree = null        // the real, parsed tree — { key, value, children: [...], nodeId, isOpen, meshCreated }
    this._tickers = []       // real WordTicker instances for multi-word leaves, live across open/close
    this._landingPlatform = null   // the root's own real landing platform mesh, disposed and recreated on each fresh JSON load
    this._onNavSelect = null
  }

  init () {
    injectStyles()
    this._onNavSelect = (e) => {
      if (e.detail?.item !== '⟐OmniDrawJsonifier') return
      this.open()
    }
    window.addEventListener('omni:nav-select', this._onNavSelect)
    this._restoreState()

    // Real fix — trashing a node (Inspector's own 🗑) previously only
    // ever removed that one node's own mesh; every descendant's real
    // mesh was silently orphaned in the scene, since OmniNode's own
    // delete handler re-parents children rather than deleting them —
    // the right instinct for a regular node, but wrong for a JSON
    // tree, where children are genuinely part of their parent, not
    // independent siblings. Reacts to the same real event OmniNode's
    // own handler already uses, but only ever cascades the matched
    // node's own children — never the node itself, since the
    // original event already handles that one directly — so this
    // never re-processes the same id twice.
    this._onDeleteRequest = (e) => {
      const { id } = e.detail ?? {}
      if (!this._tree) return
      const node = this._findNode(this._tree, id)
      if (!node) return

      node.children.forEach(child => this._collapseRecursive(child))

      if (node === this._tree) {
        this._tree = null
        this._lastRawJson = null
        this._disposeLandingPlatform()
        try { localStorage.removeItem(STORE_KEY) } catch (_) { /* real cleanup simply skipped if storage unavailable */ }
        this._renderTree()
      } else {
        const parent = this._findParent(this._tree, id)
        if (parent) parent.children = parent.children.filter(c => c.nodeId !== id)
        this._renderTree()
        this._saveState()
      }
    }
    window.addEventListener('omni:node-delete-request', this._onDeleteRequest)
  }

  update (delta) {
    this._tickers.forEach(t => t.update(delta))
  }

  onResize () {}

  destroy () {
    window.removeEventListener('omni:nav-select', this._onNavSelect)
    window.removeEventListener('omni:node-delete-request', this._onDeleteRequest)
    this._tickers.forEach(t => { unregisterTicker(t.nodeId); t.destroy() })
    this._tickers = []
    this._disposeLandingPlatform()
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
        fromRect: { x: rect.left, y: rect.top, w: rect.width, h: rect.height }, variant: 'app' }
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

    // Real cleanup — without this, loading a second JSON string would
    // leave the previous tree's nodes (and any of its open branches)
    // orphaned in the scene, since this._tree is about to be overwritten.
    // _collapseRecursive already despawns the node itself, not just its
    // children, so this one call is sufficient.
    if (this._tree) this._collapseRecursive(this._tree)

    const cam = this.ctx.camera
    const dir = new THREE.Vector3()
    cam.getWorldDirection(dir)
    dir.multiplyScalar(6)
    const rootPos = new THREE.Vector3(cam.position.x + dir.x, Math.max(0.5, cam.position.y + dir.y), cam.position.z + dir.z)

    this._disposeLandingPlatform()
    this._tree = this._buildTreeNode('root', parsed, rootPos, null, 'root')
    this._spawnRootWithFall(this._tree)   // the root falls into place and lands on a real platform — everything under it still waits for a real toggle
    this._renderTree()
    this._lastRawJson = rawText
    this._saveState()

    confirmPrimaryForce('json-tree-created', true, { rootKey: 'root' })
  }

  /** Real persistence — the actual fix for "the toggle tree doesn't
   *  reappear": without this, the tree only ever lived in memory,
   *  gone completely the moment the page refreshed. Keyed by each
   *  node's real, stable path (not its random, regenerating nodeId),
   *  since a fresh re-parse of the same JSON produces new ids but
   *  the same real paths. */
  _saveState () {
    if (!this._tree || !this._lastRawJson) return
    const openPaths = []
    const layoutModes = {}
    const walk = (node) => {
      if (node.isOpen) openPaths.push(node.path)
      if (node.layoutMode !== 'tree') layoutModes[node.path] = node.layoutMode
      node.children.forEach(walk)
    }
    walk(this._tree)
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ rawJson: this._lastRawJson, openPaths, layoutModes }))
    } catch (_) { /* real save simply skipped if storage unavailable */ }
  }

  /** The other half of the real fix — rebuilds the tree from the
   *  real, saved JSON on init, then re-applies real open/layout
   *  state by matching each node's own real, stable path, spawning
   *  every branch that was genuinely open before, in real parent-
   *  before-child order (a child can't spawn before its own parent
   *  does). */
  _restoreState () {
    let saved
    try {
      const raw = localStorage.getItem(STORE_KEY)
      if (!raw) return
      saved = JSON.parse(raw)
    } catch (_) { return }
    if (!saved?.rawJson) return

    let parsed
    try { parsed = JSON.parse(saved.rawJson) } catch (_) { return }

    const cam = this.ctx.camera
    const dir = new THREE.Vector3()
    cam.getWorldDirection(dir)
    dir.multiplyScalar(6)
    const rootPos = new THREE.Vector3(cam.position.x + dir.x, Math.max(0.5, cam.position.y + dir.y), cam.position.z + dir.z)

    this._tree = this._buildTreeNode('root', parsed, rootPos, null, 'root')
    this._lastRawJson = saved.rawJson
    this._spawnMesh(this._tree)

    const openPathSet = new Set(saved.openPaths ?? [])
    const applyLayoutModes = (node) => {
      if (saved.layoutModes?.[node.path]) node.layoutMode = saved.layoutModes[node.path]
      node.children.forEach(applyLayoutModes)
    }
    applyLayoutModes(this._tree)

    // Real parent-before-child order — walk breadth-first from the
    // root so a branch only ever opens once its own parent already has.
    const queue = [this._tree]
    while (queue.length) {
      const node = queue.shift()
      if (openPathSet.has(node.path) && !node.isLeaf) {
        node.isOpen = true
        node.children.forEach(child => this._spawnMesh(child))
      }
      queue.push(...node.children)
    }
  }

  /** Builds the real, in-memory tree structure recursively — no 3D
   *  side effects here at all; mesh creation is deferred until a
   *  branch is actually toggled open. `path` is a real, stable
   *  identifier (unlike nodeId, which is random and regenerates on
   *  every reload) — the actual mechanism real persistence depends
   *  on, since open/layout state needs something durable to key off. */
  _buildTreeNode (key, value, position, parentNodeId, path) {
    const nodeId = generateId()
    const isLeaf = value === null || typeof value !== 'object'
    const node = {
      nodeId, key, value, position, parentNodeId, path,
      isLeaf, isOpen: false, meshCreated: false, children: [],
      isChartEligible: false, seriesData: null,
      layoutMode: 'tree',   // real, per-node — 'tree' (default) | 'linear-vertical' | 'linear-horizontal' | 'linear-depth'
    }
    if (!isLeaf) {
      const entries = Array.isArray(value) ? value.map((v, i) => [String(i), v]) : Object.entries(value)
      node.children = entries.map(([childKey, childValue], i) => {
        const childPos = computeChildPosition(position, i, entries.length, node.layoutMode)
        return this._buildTreeNode(childKey, childValue, new THREE.Vector3(childPos.x, childPos.y, childPos.z), nodeId, `${path}.${childKey}`)
      })
      this._detectChartEligibility(node)
    }
    return node
  }

  /** Real chart-eligibility detection — delegates to the shared
   *  utils/ChartEligibility.js, so this and OmniDrawCell's own
   *  standalone creation panel share one real implementation. */
  _detectChartEligibility (node) {
    const seriesData = detectSeriesData(node.key, node.value)
    if (seriesData) {
      node.isChartEligible = true
      node.seriesData = seriesData
    }
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
        geometry: node.isChartEligible ? 'BoxGeometry' : (node.isLeaf ? 'SphereGeometry' : 'OctahedronGeometry'),
        primitive: 'objective',
        color: node.isChartEligible ? '#ffb347' : (node.isLeaf ? '#8cff8c' : '#7fd8ff'),
        position: [node.position.x, node.position.y, node.position.z],
        rotation: [0, 0, 0],
        scale: node.isLeaf ? [0.22, 0.22, 0.22] : [0.3, 0.3, 0.3],
        parentId: node.parentNodeId,   // the real fix — Dynamic's own ticker still sends null; a tree node never should
        // Real fix — every spawned node used to auto-select by
        // default, meaning opening a branch with several children
        // (or restoring several open branches on a page refresh)
        // fired the full, real selection cascade — all 8 systems
        // that listen for it, including Inspector's own heavy WebGL
        // preview setup — once per node, all at once. A user's own
        // deliberate click already selects a node correctly through
        // its own real path; bulk-spawning during toggle/restore
        // never should.
        skipAutoSelect: true,
      }
    }))

    if (node.isChartEligible) {
      registerChart(node.nodeId, {
        seriesData: node.seriesData,
        seriesVisibility: Object.fromEntries(Object.keys(node.seriesData).map(name => [name, true])),
        chartType: 'bar',
      })
    }

    if (isTickerLeaf) {
      const ticker = new WordTicker(this.ctx.camera, node.position.clone(), words)
      ticker.nodeId = node.nodeId
      registerTicker(node.nodeId, ticker)
      this._tickers.push(ticker)
    }
  }

  /** The root's own real fall-from-sky spawn — confirmed directly as
   *  root-only, never for children/parents beneath it. The node's own
   *  logical position stays at its real, intended value throughout
   *  (children positioning and persistence both depend on it) —
   *  only the real mesh's own Y gets animated down separately, high
   *  above its real landing point. */
  _spawnRootWithFall (node) {
    const FALL_HEIGHT = 14      // world units above the real landing point
    const FALL_DURATION = 1.8   // slow and deliberate, not a quick drop

    const realY = node.position.y
    node.position.y = realY + FALL_HEIGHT
    this._spawnMesh(node)
    node.position.y = realY   // restore immediately — the real, logical position never actually left this value

    const mesh = this.omniNode?.getMeshById(node.nodeId)
    if (!mesh) { this._spawnLandingPlatform(node.position.x, realY, node.position.z); return }

    mesh.position.y = realY + FALL_HEIGHT   // the real mesh does start high, even though node.position itself was only ever offset briefly
    gsap.to(mesh.position, {
      y: realY,
      duration: FALL_DURATION,
      ease: 'power2.out',
      onComplete: () => this._spawnLandingPlatform(node.position.x, realY, node.position.z),
    })
  }

  /** A real, small, persistent landing platform beneath the root —
   *  a single flat circle, trivial on memory (one draw call, a
   *  couple dozen vertices), created once per fresh JSON load, not
   *  once per node. */
  _spawnLandingPlatform (x, y, z) {
    const geometry = new THREE.CircleGeometry(1.1, 32)
    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff, wireframe: true, wireframeLinewidth: 3,
      // wireframeLinewidth above 1 is real, valid three.js API, but
      // most browsers/GPUs silently ignore it (a real WebGL spec
      // limitation, not a bug here) — included honestly rather than
      // silently dropped, since it does work on a few platforms.
      transparent: true, opacity: 0.6,
    })
    const platform = new THREE.Mesh(geometry, material)
    platform.rotation.x = -Math.PI / 2   // lie flat, facing up
    // Real fix — the root's own actual radius at its real scale is
    // ~0.18 (0.6 base OctahedronGeometry × 0.3 scale); the old 0.05
    // offset sat well inside that, cutting through it. 0.22 clears
    // the real radius with a small, deliberate gap, so the node
    // genuinely sits on top rather than intersecting.
    platform.position.set(x, y - 0.22, z)
    this.ctx.scene.add(platform)
    this._landingPlatform = platform
  }

  _disposeLandingPlatform () {
    if (!this._landingPlatform) return
    this.ctx.scene.remove(this._landingPlatform)
    this._landingPlatform.geometry?.dispose()
    this._landingPlatform.material?.dispose()
    this._landingPlatform = null
  }

  _despawnMesh (node) {
    if (!node.meshCreated) return
    node.meshCreated = false
    window.dispatchEvent(new CustomEvent('omni:node-delete-request', { detail: { id: node.nodeId } }))
    if (node.isChartEligible) unregisterChart(node.nodeId)
    this._tickers = this._tickers.filter(t => {
      const isThisNode = t.nodeId === node.nodeId
      if (isThisNode) { unregisterTicker(t.nodeId); t.destroy() }
      return !isThisNode
    })
  }

  /** The real toggle — opening a branch spawns every one of its
   *  direct children live; closing it despawns them (and, recursively,
   *  anything open beneath them), rather than leaving orphaned nodes
   *  behind. */
  /** The real mechanism behind the Structure panel — recomputes
   *  every real child's position under the new layout mode, and for
   *  any child already spawned in the scene, moves its real mesh
   *  live rather than requiring the branch to be closed and
   *  reopened to see the new formation. */
  setLayoutMode (node, mode) {
    node.layoutMode = mode
    node.children.forEach((child, i) => {
      const newPos = computeChildPosition(node.position, i, node.children.length, mode)
      child.position.set(newPos.x, newPos.y, newPos.z)
      if (child.meshCreated) {
        window.dispatchEvent(new CustomEvent('omni:node-position-set', { detail: { id: child.nodeId, position: newPos } }))
      }
    })
    this._saveState()
  }

  /** Real, tree-wide reapplication — since spacing is a global
   *  setting, not tied to any one node's own selection, changing it
   *  needs to walk the whole tree and recompute every node's real
   *  position under its own parent's current layout mode, not just
   *  the currently-selected node's direct children. */
  reapplySpacing () {
    if (!this._tree) return
    const walk = (node) => {
      node.children.forEach((child, i) => {
        const newPos = computeChildPosition(node.position, i, node.children.length, node.layoutMode)
        child.position.set(newPos.x, newPos.y, newPos.z)
        if (child.meshCreated) {
          window.dispatchEvent(new CustomEvent('omni:node-position-set', { detail: { id: child.nodeId, position: newPos } }))
        }
        walk(child)
      })
    }
    walk(this._tree)
    this._saveState()
  }

  _toggleBranch (node) {
    node.isOpen = !node.isOpen
    if (node.isOpen) {
      node.children.forEach(child => this._spawnMesh(child))
    } else {
      node.children.forEach(child => this._collapseRecursive(child))
    }
    this._renderTree()
    this._saveState()
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
    const chartIcon = node.isChartEligible ? ' 📊' : ''
    let html = `
      <div class="oj-node">
        <div class="oj-row" data-node-id="${node.nodeId}">
          <span class="oj-toggle">${toggleSymbol}</span>
          <span class="oj-key">${node.key}${chartIcon}</span>
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
        if (!node) return
        if (!node.isLeaf) this._toggleBranch(node)
        const mesh = this.omniNode?.getMeshById(nodeId)
        if (mesh) window.dispatchEvent(new CustomEvent('omni:structure-focus', { detail: { mesh } }))
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

  /** The real parent-lookup counterpart to _findNode — needed so a
   *  non-root node's own delete can remove it from its real parent's
   *  children array, not just despawn its mesh. */
  _findParent (node, nodeId) {
    if (!node) return null
    for (const child of node.children) {
      if (child.nodeId === nodeId) return node
      const found = this._findParent(child, nodeId)
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
        <div class="oj-toolbar-row">
          <button class="oj-create-btn" id="oj-create">Build Tree</button>
          <button class="oj-create-btn" id="oj-open-structure" title="Open the Structure panel for the root node">📐 Structure</button>
        </div>
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
    el.querySelector('#oj-open-structure').addEventListener('click', () => {
      if (!this._tree) return
      const mesh = this.omniNode?.getMeshById(this._tree.nodeId)
      if (mesh) window.dispatchEvent(new CustomEvent('omni:structure-focus', { detail: { mesh } }))
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
