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
import { SERVICES } from '../utils/OmniExtraKinds.js'
import * as CULL from '../utils/OmniTooltipCull.js'
import { getSettings as getTooltipSettings } from '../utils/ToolTipSettings.js'
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
.ttm-action-btn--danger { color: rgba(255,140,140,0.95); }
.ttm-action-btn--danger:hover { background: rgba(255,80,80,0.16); }
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
    this.omniTranslator = null   // set later via setOmniTranslator(), same real reason
    this.omniPocket = null   // set later via setOmniPocket(), same real reason
    this._headers = new Map()   // mesh -> { el, mesh }
    this._openMenuMesh = null
    this._menuEl = null
    this._onDocClick = null
    this._onNodeContextMenu = null
    this._pinnedPoint = null   // {x,y} screen coords when opened via right-click on the 3D object, instead of the node's own header tooltip
  }

  /** Wired in after both modules exist, since OmniJsonifier is
   *  created later than ToolTipMenu in main.js's real module order. */
  setJsonifier (jsonifier) {
    this.jsonifier = jsonifier
  }

  setOmniTranslator (omniTranslator) {
    this.omniTranslator = omniTranslator
  }

  setOmniPocket (omniPocket) {
    this.omniPocket = omniPocket
  }

  init () {
    injectStyles()
    SERVICES.tooltips = this
    this._onDocClick = (e) => {
      if (!this._openMenuMesh) return
      if (this._ignoreNextDocClick) return
      if (e.target.closest('.ttm-quickmenu') || e.target.closest('.ttm-header')) return
      this._closeQuickMenu()
    }
    document.addEventListener('click', this._onDocClick)

    // Real right-click/context-menu on the 3D object itself (Developer
    // Queue item 5) — systems/OmniNode.js raycasts on 'contextmenu' the
    // same way it does on 'click' and dispatches this with the hit
    // node's id + cursor position. Reuses this same quick menu (now
    // with Duplicate/Delete) rather than building a second, competing
    // menu system for what's functionally the same set of actions.
    this._onNodeContextMenu = (e) => {
      const { id, x, y } = e.detail ?? {}
      const mesh = id ? this.omniNode?.getMeshById?.(id) : null
      if (!mesh) return
      this._toggleQuickMenu(mesh, { x, y })
    }
    window.addEventListener('omni:node-contextmenu-request', this._onNodeContextMenu)
  }

  /**
   * V264: only the nearest few on-screen headers are positioned (the rest cost nothing), DOM is written only when a header actually moved, and a header whose node is
   * behind another object is hidden (or dimmed, per ToolTipSettings 'occlusion'). The look-through test is a ray from the camera to the node, a few per frame, each result kept for ~300 ms.
   */
  update () {
    const meshes = this.omniNode?.getAllMeshes?.() ?? []
    const liveSet = new Set(meshes)
    for (const [mesh, entry] of this._headers) {
      if (!liveSet.has(mesh)) {
        entry.el.remove()
        this._headers.delete(mesh)
        if (this._openMenuMesh === mesh) this._closeQuickMenu()
      }
    }
    const cam = this.ctx.camera; const prefs = getTooltipSettings(); const now = performance.now()
    if (!cam) return
    const tmp = (this._tmp ??= { v: new THREE.Vector3(), c: new THREE.Vector3(), ray: new THREE.Raycaster(), d: new THREE.Vector3() })
    cam.getWorldPosition(tmp.c)
    const items = []
    for (const mesh of meshes) {
      let e = this._headers.get(mesh); if (!e) { e = { el: this._buildHeaderEl(mesh), mesh, shown: true, lx: NaN, ly: NaN, occ: false, occAt: 0, state: 'visible' }; this._headers.set(mesh, e) }
      mesh.getWorldPosition(tmp.v); e.dist = tmp.v.distanceTo(tmp.c)
      tmp.v.y += HEADER_Y_OFFSET; const p = tmp.v.project(cam)
      e.sx = (p.x * 0.5 + 0.5) * window.innerWidth; e.sy = (-p.y * 0.5 + 0.5) * window.innerHeight
      e.onScreen = p.z <= 1 && e.sx > -40 && e.sx < window.innerWidth + 40 && e.sy > -40 && e.sy < window.innerHeight + 40
      items.push({ id: mesh.uuid, dist: e.dist, onScreen: e.onScreen })
    }
    const keep = new Set(); if (this._openMenuMesh) keep.add(this._openMenuMesh.uuid)
    const sel = this.omniNode?.getSelectedId?.() ?? this.omniNode?._selected; const selMesh = sel ? this.omniNode?.getMeshById?.(sel) : null; if (selMesh) keep.add(selMesh.uuid)
    const show = CULL.chooseHeaders(items, prefs.max, keep)
    // occlusion: a small budget of rays per frame, nearest-first among the headers that are showing
    let budget = prefs.occlusion === 'show' ? 0 : 6
    if (budget) {
      const need = []
      for (const mesh of meshes) { const e = this._headers.get(mesh); if (e && show.has(mesh.uuid) && e.onScreen && now - e.occAt > 300) need.push(e) }
      need.sort((a, b) => a.occAt - b.occAt)
      for (const e of need) { if (budget-- <= 0) break; e.occAt = now; e.occ = this._isOccluded(e, tmp, meshes) }
    }
    for (const mesh of meshes) {
      const e = this._headers.get(mesh); const vis = show.has(mesh.uuid) && e.onScreen
      const state = !vis ? 'hidden' : CULL.stateFor(keep.has(mesh.uuid) ? false : e.occ, prefs.occlusion)
      if (state !== e.state) {
        e.state = state
        e.el.style.display = state === 'hidden' ? 'none' : ''
        e.el.style.opacity = state === 'dim' ? String(prefs.dimOpacity) : ''
      }
      if (state === 'hidden') continue
      const lx = Math.round(e.sx * 2) / 2; const ly = Math.round(e.sy * 2) / 2
      if (lx !== e.lx || ly !== e.ly) { e.lx = lx; e.ly = ly; e.el.style.left = `${lx}px`; e.el.style.top = `${ly}px` }
    }
    if (this._openMenuMesh && this._menuEl) this._positionQuickMenu(this._openMenuMesh)
  }
  /** true when another node's mesh is between the camera and this node's centre */
  _isOccluded (e, tmp, meshes) {
    e.mesh.getWorldPosition(tmp.v); tmp.d.copy(tmp.v).sub(tmp.c); const dist = tmp.d.length(); if (dist < 0.01) return false
    tmp.ray.set(tmp.c, tmp.d.normalize()); tmp.ray.far = dist; tmp.ray.camera = this.ctx.camera   // V279: a text sprite in the way needs the camera to be raycast
    const others = meshes.filter(m => m !== e.mesh && m.visible !== false)
    const hits = tmp.ray.intersectObjects(others, false)
    for (const h of hits) { if (CULL.isBlocked(h.distance, dist, 0.05) && !this._isChildOf(h.object, e.mesh)) { e.blocker = h.object.userData?.nodeId ?? h.object.name ?? '?'; return true } }
    e.blocker = null; return false
  }
  _isChildOf (obj, parent) { for (let o = obj; o; o = o.parent) if (o === parent) return true; return false }
  /** for tests and the settings panel: 'visible' | 'dim' | 'hidden' for a node id (null when it has no header) */
  blockerOf (nodeId) { const m = this.omniNode?.getMeshById?.(nodeId); return (m && this._headers.get(m)?.blocker) || null }
  headerState (nodeId) { const m = this.omniNode?.getMeshById?.(nodeId); const e = m ? this._headers.get(m) : null; return e ? e.state : null }
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

  _toggleQuickMenu (mesh, atPoint = null) {
    if (this._openMenuMesh === mesh && !atPoint) { this._closeQuickMenu(); return }
    this._closeQuickMenu()
    this._openMenuMesh = mesh
    this._pinnedPoint = atPoint
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
      <button class="ttm-action-btn" data-action="take-me-there">◎ Take Me There</button>
      <button class="ttm-action-btn" data-action="edit">✎ Edit</button>
      <button class="ttm-action-btn" data-action="pocket-this">⟐ PocketThis⟐</button>
      <button class="ttm-action-btn" data-action="${isPlaced ? 'release' : 'grab'}">${isPlaced ? '○ Release' : '● Grab'}</button>
      <button class="ttm-action-btn" data-action="translator-vault">⟐ Add to Translator</button>
      ${hasChildren ? `<button class="ttm-action-btn" data-action="toggle-children">⑂ ${childrenVisible ? 'Hide' : 'Show'} Children (${childCount})</button>` : ''}
      ${hasChildren ? `<button class="ttm-action-btn" data-action="structure">⊿ Structure</button>` : ''}
      ${isJsonLeaf ? `<button class="ttm-action-btn" data-action="show-value">⊙ Show Value</button>` : ''}
      <button class="ttm-action-btn" data-action="edit-tooltip">◒ Edit Tooltip</button>
      <button class="ttm-action-btn" data-action="sticky">❏ Stick a note on this</button>
      <button class="ttm-action-btn" data-action="flash" style="display:none">▥ Study / edit cards</button>
      <button class="ttm-action-btn" data-action="epistemics" style="display:none">◉ Trace / next layer</button>
      <button class="ttm-action-btn" data-action="rhythm">♩ Put this on a beat</button>
      <button class="ttm-action-btn" data-action="transform">⇄ Move / Rotate / Scale…</button>
      <button class="ttm-action-btn" data-action="select-mode">☑ Select / Connect…</button>
      <button class="ttm-action-btn" data-action="duplicate">⧉ Duplicate</button>
      <button class="ttm-action-btn ttm-action-btn--danger" data-action="delete">⌫ Delete</button>
    `
    this._menuEl.querySelector('[data-action="take-me-there"]').addEventListener('click', () => {
      goToObject(this.ctx, mesh)
      this._closeQuickMenu()
    })

    this._menuEl.querySelector('[data-action="edit"]').addEventListener('click', () => {
      const data = this.omniNode?.getNodeData(nodeId)
      if (data) window.dispatchEvent(new CustomEvent('omni:node-selected', { detail: { node: data, mesh } }))
      window.dispatchEvent(new CustomEvent('omni:edit-request', { detail: { nodeId, mesh } }))
      this._closeQuickMenu()
    })

    this._menuEl.querySelector('[data-action="pocket-this"]').addEventListener('click', () => {
      const data = this.omniNode?.getNodeData(nodeId)
      this.omniPocket?.pocketThis(data, mesh)
      this._closeQuickMenu()
    })

    this._menuEl.querySelector('[data-action="edit-tooltip"]').addEventListener('click', () => this._renderTooltipEditor(mesh))

    // Duplicate/Delete — real, unconditional for every node type (there
    // was no such button anywhere before this, for anything). Delete
    // reuses the existing omni:node-delete-request event Inspector's own
    // delete button already dispatches; Duplicate is a new, generic
    // clone-with-offset request handled in systems/OmniNode.js.
    this._menuEl.querySelector('[data-action="sticky"]').addEventListener('click', () => {
      const nid = mesh.userData?.nodeId; this._closeQuickMenu()
      if (nid) window.dispatchEvent(new CustomEvent('omni:sticky-note-create', { detail: { target: nid, select: true } }))
    })
    { const fb = this._menuEl.querySelector('[data-action="flash"]'); if (mesh.userData?.extraKind?.kind === 'flashNode') fb.style.display = ''
      fb.addEventListener('click', () => { const nid = mesh.userData?.nodeId; this._closeQuickMenu(); if (nid) { window.dispatchEvent(new CustomEvent('omni:flash-ui-request', { detail: { action: 'study', id: nid } })); window.dispatchEvent(new CustomEvent('omni:flash-ui-request', { detail: { action: 'edit', id: nid } })) } }) }
    { const eb = this._menuEl.querySelector('[data-action="epistemics"]'); const ek = mesh.userData?.extraKind?.kind
      if (ek === 'epistemicsNode' || ek === 'claimNode') { eb.style.display = ''; eb.textContent = ek === 'claimNode' ? '◉ Trace this claim' : '◉ Make the next layer' }
      eb.addEventListener('click', () => { const nid = mesh.userData?.nodeId; this._closeQuickMenu(); if (nid) window.dispatchEvent(new CustomEvent('omni:epistemics-node-create', { detail: { fromSelected: false, deriveFrom: ek === 'epistemicsNode' ? nid : undefined, claimId: ek === 'claimNode' ? nid : undefined, select: true } })) }) }
    this._menuEl.querySelector('[data-action="rhythm"]').addEventListener('click', () => {
      const nid = mesh.userData?.nodeId; this._closeQuickMenu()
      if (nid) window.dispatchEvent(new CustomEvent('omni:rhythm-node-create', { detail: { bindTo: nid, start: true, openPanel: true, onlyBind: true } }))
    })
    this._menuEl.querySelector('[data-action="transform"]').addEventListener('click', () => {
      const nid = mesh.userData?.nodeId; this._closeQuickMenu()
      if (nid) { try { this.omniNode?._selectNode?.(nid) } catch (_) { /* not selectable */ } window.dispatchEvent(new CustomEvent('omni:transform-bar-request', { detail: { action: 'open' } })) }
    })
    this._menuEl.querySelector('[data-action="select-mode"]').addEventListener('click', () => {
      const nid = mesh.userData?.nodeId; this._closeQuickMenu()
      if (nid) window.dispatchEvent(new CustomEvent('omni:select-mode-request', { detail: { action: 'start', id: nid } }))
    })
    this._menuEl.querySelector('[data-action="duplicate"]').addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('omni:node-duplicate-request', { detail: { id: nodeId } }))
      this._closeQuickMenu()
    })
    this._menuEl.querySelector('[data-action="delete"]').addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('omni:node-delete-request', { detail: { id: nodeId } }))
      this._closeQuickMenu()
    })

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

    this._menuEl.querySelector('[data-action="translator-vault"]').addEventListener('click', () => this._renderVaultPicker(mesh))

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
      ${hands.map(([id, label]) => `<button class="ttm-action-btn" data-hand="${id}">● ${label}</button>`).join('')}
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

  /** Real vault picker — the exact same real, low-risk "menu-driven
   *  placement, no dragging" pattern as _renderHandPicker above,
   *  reused directly for OmniTranslator's four vaults. */
  _renderVaultPicker (mesh) {
    const sides = [['top', 'Top — Notifications'], ['right', 'Right — Problems'], ['bottom', 'Bottom — Tools'], ['left', 'Left — Solutions']]
    this._menuEl.innerHTML = `
      <button class="ttm-action-btn" data-action="back">← Back</button>
      ${sides.map(([id, label]) => `<button class="ttm-action-btn" data-vault="${id}">⟐ ${label}</button>`).join('')}
    `
    this._menuEl.querySelector('[data-action="back"]').addEventListener('click', () => this._renderMainMenu(mesh))
    sides.forEach(([id]) => {
      this._menuEl.querySelector(`[data-vault="${id}"]`).addEventListener('click', () => {
        this.omniTranslator?.addToVault(mesh, id)
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
    this._pinnedPoint = null
  }

  _positionQuickMenu (mesh) {
    if (!this._menuEl) return
    // Opened via right-click on the 3D object — anchor to the cursor,
    // not the node's own floating header (which may be far from where
    // the user actually clicked, or off-screen entirely).
    if (this._pinnedPoint) {
      this._menuEl.style.left = `${this._pinnedPoint.x}px`
      this._menuEl.style.top = `${this._pinnedPoint.y}px`
      return
    }
    const entry = this._headers.get(mesh)
    if (!entry) return
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
