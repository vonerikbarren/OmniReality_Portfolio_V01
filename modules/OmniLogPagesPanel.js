/**
 * modules/OmniLogPagesPanel.js — ⟐mniLogPagesPanel
 *
 * The real, confirmed multi-page structure behind an OmniLog entry —
 * genuinely separate, real 3D panels positioned in sequence, not one
 * panel with internally-scrolling text (confirmed directly, both
 * options were on the table). Scrolling travels the camera between
 * them, reusing the same real, proven goToObject() every other
 * "take me there" interaction in this project already uses.
 *
 * The whole structure is one real, transformable object — parented
 * under a single group with its own real px/py/pz/rx/ry/rz/sx/sy/sz,
 * the exact same schema OmniDraw's own Transform group already uses,
 * not a new, separate transform system.
 */

import * as THREE from 'three'
import { generateId } from '../systems/OmniNode.js'
import { goToObject } from '../utils/CameraTravel.js'
import { paginate, PAGE_WIDTH, PAGE_HEIGHT } from '../utils/OmniLogPagination.js'
import { registerLogEntry, unregisterLogEntry } from '../utils/OmniLogRegistry.js'

const PAGE_GAP = 3   // real, vertical world-unit gap between consecutive real pages
const CANVAS_SCALE = 2   // real supersampling for crisp real text on the canvas texture

export default class OmniLogPagesPanel {
  constructor (context) {
    this.ctx = context
    this._groupNodeId = null
    this._group = null
    this._pageMeshes = []
    this._currentPageIndex = 0
    this._isActive = false
    this._onWheel = null
    this._onNodeSelected = null
    this._onNodeDeselected = null
  }

  init () {
    this._onNodeSelected = (e) => {
      this._isActive = e.detail?.mesh?.userData?.nodeId === this._groupNodeId
    }
    this._onNodeDeselected = () => { this._isActive = false }
    window.addEventListener('omni:node-selected', this._onNodeSelected)
    window.addEventListener('omni:node-deselected', this._onNodeDeselected)

    this._onWheel = (e) => {
      if (!this._isActive || this._pageMeshes.length === 0) return
      e.preventDefault()
      const direction = e.deltaY > 0 ? 1 : -1
      this.scrollToPage(this._currentPageIndex + direction)
    }
    window.addEventListener('wheel', this._onWheel, { passive: false })
  }

  update () {}
  onResize () {}

  destroy () {
    window.removeEventListener('omni:node-selected', this._onNodeSelected)
    window.removeEventListener('omni:node-deselected', this._onNodeDeselected)
    window.removeEventListener('wheel', this._onWheel)
    this._disposePages()
    if (this._groupNodeId) window.dispatchEvent(new CustomEvent('omni:node-delete-request', { detail: { id: this._groupNodeId } }))
  }

  /** Real, public entry point — builds the whole real, multi-page
   *  structure from a real OmniLog entry's own title and rich HTML,
   *  at the given real transform. Passing a real, existing nodeId
   *  re-edits that same entry in place (updates its real transform,
   *  rebuilds its real pages) instead of creating a new, duplicate
   *  node. */
  build (title, html, transform = {}, existingNodeId = null) {
    this._disposePages()

    const t = { px: 0, py: 0, pz: -5, rx: 0, ry: 0, rz: 0, sx: 1, sy: 1, sz: 1, ...transform }

    if (existingNodeId) {
      this._groupNodeId = existingNodeId
      // Real, confirmed, already-established event — position only
      // (this project has no real rotation-set equivalent), object
      // payload shape, not an array. The anchor's own rotation isn't
      // critical (it's a tiny, near-invisible anchor mesh — the
      // real, visible pages below are controlled directly via
      // this._group, set right after this).
      window.dispatchEvent(new CustomEvent('omni:node-position-set', {
        detail: { id: existingNodeId, position: { x: t.px, y: t.py, z: t.pz } },
      }))
    } else {
      this._groupNodeId = generateId()
      window.dispatchEvent(new CustomEvent('omni:node-create-request', {
        detail: {
          id: this._groupNodeId, label: title || 'OmniLog Entry',
          geometry: 'BoxGeometry', primitive: 'objective', color: '#8899ff',
          position: [t.px, t.py, t.pz], rotation: [t.rx, t.ry, t.rz], scale: [0.001, 0.001, 0.001],
          // A near-invisible real anchor mesh — the actual, visible content is the real page planes below it.
          parentId: null,
        }
      }))
    }

    this._group = new THREE.Group()
    this._group.position.set(t.px, t.py, t.pz)
    this._group.rotation.set(t.rx, t.ry, t.rz)
    this._group.scale.set(t.sx, t.sy, t.sz)
    this._group.userData.nodeId = this._groupNodeId
    this.ctx.scene.add(this._group)

    const pages = paginate(html)
    pages.forEach((page, i) => {
      const mesh = this._buildPageMesh(page, title, i, pages.length, t.colorRgba)
      mesh.position.set(0, -i * PAGE_GAP, 0)
      this._group.add(mesh)
      this._pageMeshes.push(mesh)
    })

    this._currentPageIndex = 0
    registerLogEntry(this._groupNodeId, { title, html, transform: t })
    return this._groupNodeId
  }

  scrollToPage (index) {
    const clamped = Math.max(0, Math.min(this._pageMeshes.length - 1, index))
    this._currentPageIndex = clamped
    const mesh = this._pageMeshes[clamped]
    if (mesh) goToObject(this.ctx, mesh)
  }

  _buildPageMesh (blocks, title, pageIndex, totalPages, colorRgba) {
    const canvas = document.createElement('canvas')
    canvas.width = PAGE_WIDTH * CANVAS_SCALE
    canvas.height = PAGE_HEIGHT * CANVAS_SCALE
    const c = canvas.getContext('2d')
    c.scale(CANVAS_SCALE, CANVAS_SCALE)

    c.fillStyle = colorRgba || 'rgba(250, 248, 244, 0.97)'
    c.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT)
    c.strokeStyle = 'rgba(0,0,0,0.15)'
    c.strokeRect(1, 1, PAGE_WIDTH - 2, PAGE_HEIGHT - 2)

    c.fillStyle = '#111'
    let y = 40
    const margin = 32
    blocks.forEach(block => {
      const bold = block.type === 'h1' || block.type === 'h2'
      const size = block.type === 'h1' ? 26 : block.type === 'h2' ? 21 : 16
      const lineHeight = block.type === 'h1' ? 34 : block.type === 'h2' ? 28 : 22
      c.font = `${bold ? 'bold ' : ''}${size}px 'Courier New', monospace`
      block.lines.forEach(line => {
        const prefix = block.type === 'li' ? '• ' : ''
        c.fillText(prefix + line, margin, y)
        y += lineHeight
      })
    })

    c.fillStyle = 'rgba(0,0,0,0.4)'
    c.font = '11px "Courier New", monospace'
    c.fillText(`${title} — page ${pageIndex + 1} / ${totalPages}`, margin, PAGE_HEIGHT - 14)

    const texture = new THREE.CanvasTexture(canvas)
    const geometry = new THREE.PlaneGeometry(2.4, 2.4 * (PAGE_HEIGHT / PAGE_WIDTH))
    const material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide })
    const mesh = new THREE.Mesh(geometry, material)
    mesh.userData.nodeId = `${this._groupNodeId}-page-${pageIndex}`
    return mesh
  }

  _disposePages () {
    this._pageMeshes.forEach(mesh => {
      mesh.geometry.dispose()
      mesh.material.map?.dispose()
      mesh.material.dispose()
      this._group?.remove(mesh)
    })
    this._pageMeshes = []
    if (this._group) {
      this.ctx.scene.remove(this._group)
      this._group = null
    }
  }
}
