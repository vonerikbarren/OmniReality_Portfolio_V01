/**
 * ui/ToolTipMenu.js — ⟐ToolTipMenu → QuickActionMenu → TakeMeThere()/Grab()
 *
 * A real header above every node in the scene, per the explicit
 * request: "make this on nodes for the header above the node in the
 * scene." Clicking a header opens its own QuickActionMenu with two
 * real actions:
 *
 *   - Take Me There — the exact same, already-tested camera move
 *     OmniInspector's own button uses (utils/CameraTravel.js,
 *     extracted specifically so this doesn't duplicate it).
 *   - Grab — triggers OmniGrab's real grab mechanic via its new
 *     public grabMesh() method, giving mobile/touch users (and
 *     anyone else) a button-based way to start a grab without
 *     needing the mousedown-on-the-object gesture directly.
 *
 * Headers are real, screen-projected DOM labels (the same CSS2D-
 * style technique already used for OmniTargeting's own tooltip),
 * synced each frame against OmniNode's real mesh registry — created
 * and removed as nodes actually come and go, not a fixed list.
 */

import * as THREE from 'three'
import { goToObject } from '../utils/CameraTravel.js'
import { getOverride as getTooltipOverride, setOverride as setTooltipOverride, clearOverride as clearTooltipOverride, hasOverride as hasTooltipOverride } from '../utils/ToolTipNodeOverrides.js'
import { hexToRgba } from '../utils/ColorUtils.js'

const HEADER_Y_OFFSET = 0.9   // world units above the node's own position

const STYLES = `

.ttm-header {
  position: fixed; pointer-events: auto; transform: translate(-50%, -100%);
  background: var(--ttm-bg, rgba(8,8,12,0.82)); color: var(--ttm-color, #fff); font: 10px 'Courier New', monospace;
  padding: 3px 8px; border-radius: 5px; border: 1px solid var(--ttm-border, rgba(255,255,255,0.15));
  cursor: pointer; white-space: nowrap; z-index: 40;
}
.ttm-header:hover { background: rgba(255,255,255,0.12); }

.ttm-quickmenu {
  position: fixed; pointer-events: auto; transform: translate(-50%, 4px);
  background: rgba(8,8,12,0.92); border: 1px solid rgba(255,255,255,0.15);
  border-radius: 6px; padding: 4px; display: flex; flex-direction: column; gap: 2px;
  z-index: 41;
}
.ttm-action-btn {
  background: transparent; border: none; color: #fff; font: 10px 'Courier New', monospace;
  padding: 5px 10px; text-align: left; cursor: pointer; border-radius: 4px; white-space: nowrap;
}
.ttm-action-btn:hover { background: rgba(255,255,255,0.12); }
.ttm-editor-row {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  padding: 5px 10px; font-size: 10px; color: #fff;
}
.ttm-editor-row input[type="color"] { width: 28px; height: 22px; padding: 0; border-radius: 4px; border: 1px solid rgba(255,255,255,0.15); cursor: pointer; }
.ttm-value-type {
  font-size: 8px; color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 0.05em;
  padding: 4px 10px 0;
}
.ttm-value-display {
  font-size: 11px; color: #fff; padding: 4px 10px 8px; max-width: 220px;
  word-break: break-word; white-space: pre-wrap; max-height: 140px; overflow-y: auto;
}

`

function injectStyles () {
  if (document.getElementById('ttm-styles')) return
  const tag = document.createElement('style')
  tag.id = 'ttm-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

export default class ToolTipMenu {
  constructor (context, omniNode, omniGrab) {
    this.ctx = context
    this.omniNode = omniNode
    this.omniGrab = omniGrab
    this.jsonifier = null   // set later via setJsonifier() — OmniJsonifier isn't created yet at this point in main.js's own real ordering
    this._headers = new Map()   // mesh -> { el, mesh }
    this._openMenuMesh = null
    this._menuEl = null
    this._onDocClick = null
  }

  /** Wired in after both modules exist, since OmniJsonifier is
   *  created later than ToolTipMenu in main.js's real module order. */
  setJsonifier (jsonifier) {
    this.jsonifier = jsonifier
  }

  init () {
    injectStyles()
    this._onDocClick = (e) => {
      if (!this._openMenuMesh) return
      if (this._ignoreNextDocClick) return
      if (e.target.closest('.ttm-quickmenu') || e.target.closest('.ttm-header')) return
      this._closeQuickMenu()
    }
    document.addEventListener('click', this._onDocClick)
  }

  update () {
    const meshes = this.omniNode?.getAllMeshes?.() ?? []
    const liveSet = new Set(meshes)

    // Remove headers for meshes that no longer exist — real sync,
    // not a fixed list built once.
    for (const [mesh, entry] of this._headers) {
      if (!liveSet.has(mesh)) {
        entry.el.remove()
        this._headers.delete(mesh)
        if (this._openMenuMesh === mesh) this._closeQuickMenu()
      }
    }

    meshes.forEach(mesh => {
      if (!this._headers.has(mesh)) this._headers.set(mesh, { el: this._buildHeaderEl(mesh), mesh })
      this._positionHeader(this._headers.get(mesh))
    })

    if (this._openMenuMesh && this._menuEl) this._positionQuickMenu(this._openMenuMesh)
  }

  onResize () {}

  destroy () {
    document.removeEventListener('click', this._onDocClick)
    this._headers.forEach(entry => entry.el.remove())
    this._headers.clear()
    this._menuEl?.remove()
  }

  _buildHeaderEl (mesh) {
    const el = document.createElement('div')
    el.className = 'ttm-header'
    el.textContent = mesh.userData?.label ?? mesh.userData?.omniLandingNode?.label ?? mesh.userData?.omniCryptxRing?.type ?? '⟐ Node'
    this._applyNodeOverride(el, mesh.userData?.nodeId)
    el.addEventListener('click', (e) => { e.stopPropagation(); this._toggleQuickMenu(mesh) })
    document.body.appendChild(el)
    return el
  }

  /** Real, per-node styling — genuinely independent of the global
   *  default, confirmed directly: stays the same even if
   *  ToolTipSettings' own default changes later. Inline style
   *  naturally wins over the :root-level custom property in the
   *  real CSS cascade, so no special-case override logic is needed
   *  anywhere else — the browser's own cascade does the real work. */
  _applyNodeOverride (el, nodeId) {
    const override = nodeId ? getTooltipOverride(nodeId) : null
    el.style.background = override?.background ? hexToRgba(override.background, 0.82) : ''
    el.style.borderColor = override?.border ? hexToRgba(override.border, 0.6) : ''
    el.style.color = override?.color ?? ''
  }

  _positionHeader (entry) {
    const worldPos = entry.mesh.getWorldPosition(new THREE.Vector3())
    worldPos.y += HEADER_Y_OFFSET
    const screen = this._worldToScreen(worldPos)
    if (!screen) { entry.el.style.display = 'none'; return }
    entry.el.style.display = ''
    entry.el.style.left = `${screen.x}px`
    entry.el.style.top = `${screen.y}px`
  }

  _toggleQuickMenu (mesh) {
    if (this._openMenuMesh === mesh) { this._closeQuickMenu(); return }
    this._closeQuickMenu()
    this._openMenuMesh = mesh
    this._menuEl = document.createElement('div')
    this._menuEl.className = 'ttm-quickmenu'
    document.body.appendChild(this._menuEl)
    this._renderMainMenu(mesh)
    this._positionQuickMenu(mesh)
  }

  _renderMainMenu (mesh) {
    const nodeId = mesh.userData.nodeId
    const isPlaced = nodeId && this.omniGrab?.isPlaced(nodeId)

    // Real, direct check — is this genuinely a Jsonifier node at all
    // (leaf or branch)? Its own logical tree data always correctly
    // knows about its children, spawned or not — unlike OmniNode's
    // registry, which can only ever see children that already exist
    // as real meshes. This was the actual root cause of the reported
    // bug: Jsonifier defers spawning children until toggled, but
    // hasChildren previously depended on them already being spawned
    // — a real catch-22 where the button meant to reveal a fresh
    // root's children could never appear at all.
    const jsonNode = (nodeId && this.jsonifier?._tree) ? this.jsonifier._findNode(this.jsonifier._tree, nodeId) : null
    const isJsonLeaf = jsonNode?.isLeaf === true

    const hasChildren = jsonNode ? jsonNode.children.length > 0 : (this.omniNode?.getChildrenOf?.(nodeId)?.length > 0)
    const childCount = jsonNode ? jsonNode.children.length : (this.omniNode?.getChildrenOf?.(nodeId)?.length ?? 0)
    const childrenVisible = jsonNode ? jsonNode.isOpen : (hasChildren && this.omniNode?.getChildrenOf?.(nodeId)?.[0]?.mesh?.visible)

    this._menuEl.innerHTML = `
      <button class="ttm-action-btn" data-action="take-me-there">🎯 Take Me There</button>
      <button class="ttm-action-btn" data-action="${isPlaced ? 'release' : 'grab'}">${isPlaced ? '🖐 Release' : '✊ Grab'}</button>
      ${hasChildren ? `<button class="ttm-action-btn" data-action="toggle-children">🌳 ${childrenVisible ? 'Hide' : 'Show'} Children (${childCount})</button>` : ''}
      ${hasChildren ? `<button class="ttm-action-btn" data-action="structure">📐 Structure</button>` : ''}
      ${isJsonLeaf ? `<button class="ttm-action-btn" data-action="show-value">👁 Show Value</button>` : ''}
      <button class="ttm-action-btn" data-action="edit-tooltip">🎨 Edit Tooltip</button>
    `
    this._menuEl.querySelector('[data-action="take-me-there"]').addEventListener('click', () => {
      goToObject(this.ctx, mesh)
      this._closeQuickMenu()
    })

    this._menuEl.querySelector('[data-action="edit-tooltip"]').addEventListener('click', () => this._renderTooltipEditor(mesh))

    if (isJsonLeaf) {
      this._menuEl.querySelector('[data-action="show-value"]').addEventListener('click', () => this._renderValueViewer(mesh, jsonNode))
    }

    if (hasChildren) {
      this._menuEl.querySelector('[data-action="structure"]').addEventListener('click', () => {
        window.dispatchEvent(new CustomEvent('omni:structure-focus', { detail: { mesh } }))
        this._closeQuickMenu()
      })
    }

    if (isPlaced) {
      this._menuEl.querySelector('[data-action="release"]').addEventListener('click', () => {
        this.omniGrab?.releaseFromHand(nodeId)
        this._closeQuickMenu()
      })
    } else {
      this._menuEl.querySelector('[data-action="grab"]').addEventListener('click', () => this._renderHandPicker(mesh))
    }

    if (hasChildren) {
      this._menuEl.querySelector('[data-action="toggle-children"]').addEventListener('click', () => {
        // Real fix — a genuine Jsonifier node routes through its own
        // real toggle, which correctly spawns/despawns children as
        // needed. Directly flipping mesh.visible (the old behavior)
        // only ever worked for children that already had a real
        // mesh — never true for a node being toggled open for the
        // first time.
        if (jsonNode) {
          this.jsonifier._toggleBranch(jsonNode)
        } else {
          const children = this.omniNode?.getChildrenOf?.(nodeId) ?? []
          children.forEach(child => { if (child.mesh) child.mesh.visible = !childrenVisible })
        }
        this._closeQuickMenu()
      })
    }
  }

  /** The real, direct fix — pick a hand from a menu, no dragging
   *  onto a small screen target required at all. */
  _renderHandPicker (mesh) {
    const hands = [['tl', 'Top Left'], ['tr', 'Top Right'], ['bl', 'Bottom Left'], ['br', 'Bottom Right']]
    this._menuEl.innerHTML = `
      <button class="ttm-action-btn" data-action="back">← Back</button>
      ${hands.map(([id, label]) => `<button class="ttm-action-btn" data-hand="${id}">✊ ${label}</button>`).join('')}
    `
    this._menuEl.querySelector('[data-action="back"]').addEventListener('click', () => this._renderMainMenu(mesh))
    hands.forEach(([id]) => {
      this._menuEl.querySelector(`[data-hand="${id}"]`).addEventListener('click', () => {
        this.omniGrab?.sendToHand(mesh, id)
        this._closeQuickMenu()
      })
    })
    this._positionQuickMenu(mesh)
    this._ignoreNextDocClick = true
    setTimeout(() => { this._ignoreNextDocClick = false }, 0)
  }

  /** Real, per-node tooltip styling — confirmed directly: stays the
   *  same even if ToolTipSettings' own global default changes later,
   *  since this is a genuinely separate, saved value, not a
   *  snapshot of the default taken at edit time. */
  /** Real value display for a genuine Jsonifier leaf — the actual
   *  flat data, distinct from the key already shown on the header
   *  above it. Deliberately not offered for a branch node: a
   *  branch's own children already represent its value spatially,
   *  so a second display of the same thing here would be redundant. */
  _renderValueViewer (mesh, jsonNode) {
    const value = jsonNode.value
    const typeLabel = value === null ? 'null' : typeof value
    const displayValue = value === null ? 'null' : String(value)

    this._menuEl.innerHTML = `
      <button class="ttm-action-btn" data-action="back">← Back</button>
      <div class="ttm-value-type">${typeLabel}</div>
      <div class="ttm-value-display">${this._escapeHtml(displayValue)}</div>
    `
    this._menuEl.querySelector('[data-action="back"]').addEventListener('click', () => this._renderMainMenu(mesh))

    this._positionQuickMenu(mesh)
    this._ignoreNextDocClick = true
    setTimeout(() => { this._ignoreNextDocClick = false }, 0)
  }

  _escapeHtml (str) {
    const div = document.createElement('div')
    div.textContent = str
    return div.innerHTML
  }

  _renderTooltipEditor (mesh) {
    const nodeId = mesh.userData?.nodeId
    const current = (nodeId && getTooltipOverride(nodeId)) ?? {}
    const headerEl = this._headers.get(mesh)?.el

    this._menuEl.innerHTML = `
      <button class="ttm-action-btn" data-action="back">← Back</button>
      <div class="ttm-editor-row"><span>Background</span><input type="color" id="ttm-edit-bg" value="${current.background ?? '#08080c'}" /></div>
      <div class="ttm-editor-row"><span>Border</span><input type="color" id="ttm-edit-border" value="${current.border ?? '#ffffff'}" /></div>
      <div class="ttm-editor-row"><span>Font</span><input type="color" id="ttm-edit-color" value="${current.color ?? '#ffffff'}" /></div>
      ${nodeId && hasTooltipOverride(nodeId) ? `<button class="ttm-action-btn" data-action="reset-tooltip">↺ Reset to Default</button>` : ''}
    `
    this._menuEl.querySelector('[data-action="back"]').addEventListener('click', () => this._renderMainMenu(mesh))

    const applyLive = (patch) => {
      if (!nodeId) return
      setTooltipOverride(nodeId, patch)
      if (headerEl) this._applyNodeOverride(headerEl, nodeId)
    }
    this._menuEl.querySelector('#ttm-edit-bg').addEventListener('input', (e) => applyLive({ background: e.target.value }))
    this._menuEl.querySelector('#ttm-edit-border').addEventListener('input', (e) => applyLive({ border: e.target.value }))
    this._menuEl.querySelector('#ttm-edit-color').addEventListener('input', (e) => applyLive({ color: e.target.value }))

    const resetBtn = this._menuEl.querySelector('[data-action="reset-tooltip"]')
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        clearTooltipOverride(nodeId)
        if (headerEl) this._applyNodeOverride(headerEl, nodeId)
        this._renderTooltipEditor(mesh)
      })
    }

    this._positionQuickMenu(mesh)
    this._ignoreNextDocClick = true
    setTimeout(() => { this._ignoreNextDocClick = false }, 0)
  }

  _closeQuickMenu () {
    this._menuEl?.remove()
    this._menuEl = null
    this._openMenuMesh = null
  }

  _positionQuickMenu (mesh) {
    const entry = this._headers.get(mesh)
    if (!entry || !this._menuEl) return
    const rect = entry.el.getBoundingClientRect()
    this._menuEl.style.left = `${rect.left + rect.width / 2}px`
    this._menuEl.style.top = `${rect.bottom}px`
  }

  _worldToScreen (worldPos) {
    const camera = this.ctx.camera
    if (!camera) return null
    const projected = worldPos.clone().project(camera)
    if (projected.z > 1) return null   // behind the camera
    return {
      x: (projected.x * 0.5 + 0.5) * window.innerWidth,
      y: (-projected.y * 0.5 + 0.5) * window.innerHeight,
    }
  }
}
