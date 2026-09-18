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

const HEADER_Y_OFFSET = 0.9   // world units above the node's own position

const STYLES = `

.ttm-header {
  position: fixed; pointer-events: auto; transform: translate(-50%, -100%);
  background: rgba(8,8,12,0.82); color: #fff; font: 10px 'Courier New', monospace;
  padding: 3px 8px; border-radius: 5px; border: 1px solid rgba(255,255,255,0.15);
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
    this._headers = new Map()   // mesh -> { el, mesh }
    this._openMenuMesh = null
    this._menuEl = null
    this._onDocClick = null
  }

  init () {
    injectStyles()
    this._onDocClick = (e) => {
      if (!this._openMenuMesh) return
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
    el.addEventListener('click', (e) => { e.stopPropagation(); this._toggleQuickMenu(mesh) })
    document.body.appendChild(el)
    return el
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
    this._menuEl.innerHTML = `
      <button class="ttm-action-btn" data-action="take-me-there">🎯 Take Me There</button>
      <button class="ttm-action-btn" data-action="grab">✊ Grab</button>
    `
    this._menuEl.querySelector('[data-action="take-me-there"]').addEventListener('click', () => {
      goToObject(this.ctx, mesh)
      this._closeQuickMenu()
    })
    this._menuEl.querySelector('[data-action="grab"]').addEventListener('click', () => {
      this.omniGrab?.grabMesh(mesh)
      this._closeQuickMenu()
    })
    document.body.appendChild(this._menuEl)
    this._positionQuickMenu(mesh)
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
