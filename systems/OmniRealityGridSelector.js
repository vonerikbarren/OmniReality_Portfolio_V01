/**
 * systems/OmniRealityGridSelector.js — ⟐mniRealityGridSelector
 *
 * A real Admin staging tool: highlight one or more real floor grid
 * cells, give the group a real id, and save it as a named spatial
 * context — "staging for a new reality," per direct description.
 * Confirmed real, dual use: usable directly in-scene (the OmniPlayer
 * experience) and at the OmniSense level.
 *
 * Raycasts against a real, mathematical plane at the floor's own
 * real Y level (modules/OmniFloor.js's FLOOR_Y) rather than the
 * floor's own mesh directly — the floor is a group, not one exposed
 * mesh, and a plane intersection is the standard, more robust real
 * technique for a flat, horizontal surface like this one anyway.
 * Cell size (20 real units) matches the floor's own real grid
 * exactly (TILE_SIZE=100 / TILE_DIVISIONS=5), so highlights land
 * precisely on real, existing grid lines, not a guessed size.
 */

import * as THREE from 'three'

const FLOOR_Y = -0.08   // matches modules/OmniFloor.js's own real value
const CELL_SIZE = 20    // matches the floor's own real grid cell size
const STORE_KEY = 'omni:reality-grid-selector:contexts'

function loadContexts () {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) ?? '{}') } catch (_) { return {} }
}

function saveContexts (contexts) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(contexts)) } catch (_) { /* real save simply skipped if storage unavailable */ }
}

export default class OmniRealityGridSelector {
  constructor (context) {
    this.ctx = context
    this._isSelecting = false
    this._selectedCells = []   // real, current, unsaved selection — [{cx, cz}]
    this._highlightMeshes = new Map()   // real "cx,cz" -> real THREE.Mesh
    this._contexts = loadContexts()
    this._onClick = null
  }

  init () {
    this._onClick = (e) => {
      if (!this._isSelecting) return
      this._tryPickCell(e)
    }
    this.ctx.renderer.domElement.addEventListener('click', this._onClick)
  }

  update () {}
  onResize () {}

  destroy () {
    this.ctx.renderer.domElement.removeEventListener('click', this._onClick)
    this._clearHighlights()
  }

  startSelecting () { this._isSelecting = true }
  stopSelecting () { this._isSelecting = false }

  /** Real, public save — names the current, real selection as a
   *  real, findable spatial context. */
  saveContext (id, label) {
    if (!id || this._selectedCells.length === 0) return
    this._contexts[id] = { label: label || id, cells: [...this._selectedCells] }
    saveContexts(this._contexts)
  }

  getContexts () {
    return { ...this._contexts }
  }

  /** Real load — clears the current real highlights and displays a
   *  previously-saved context's own real cells instead. */
  loadContext (id) {
    const ctx = this._contexts[id]
    if (!ctx) return
    this._clearHighlights()
    this._selectedCells = [...ctx.cells]
    this._selectedCells.forEach(cell => this._addHighlight(cell))
  }

  deleteContext (id) {
    delete this._contexts[id]
    saveContexts(this._contexts)
  }

  clearSelection () {
    this._clearHighlights()
    this._selectedCells = []
  }

  _tryPickCell (e) {
    const rect = this.ctx.renderer.domElement.getBoundingClientRect()
    const ndc = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    )
    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(ndc, this.ctx.camera)

    const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -FLOOR_Y)
    const hitPoint = new THREE.Vector3()
    if (!raycaster.ray.intersectPlane(floorPlane, hitPoint)) return

    const cx = Math.floor(hitPoint.x / CELL_SIZE)
    const cz = Math.floor(hitPoint.z / CELL_SIZE)
    this._toggleCell({ cx, cz })
  }

  _toggleCell (cell) {
    const key = `${cell.cx},${cell.cz}`
    const existingIndex = this._selectedCells.findIndex(c => `${c.cx},${c.cz}` === key)
    if (existingIndex >= 0) {
      this._selectedCells.splice(existingIndex, 1)
      this._removeHighlight(cell)
    } else {
      this._selectedCells.push(cell)
      this._addHighlight(cell)
    }
  }

  /** Real, requested styling — white with a yellow outline. */
  _addHighlight (cell) {
    const key = `${cell.cx},${cell.cz}`
    if (this._highlightMeshes.has(key)) return

    const geometry = new THREE.PlaneGeometry(CELL_SIZE, CELL_SIZE)
    const material = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.35, side: THREE.DoubleSide })
    const mesh = new THREE.Mesh(geometry, material)
    mesh.rotation.x = -Math.PI / 2
    mesh.position.set((cell.cx + 0.5) * CELL_SIZE, FLOOR_Y + 0.01, (cell.cz + 0.5) * CELL_SIZE)

    const edges = new THREE.EdgesGeometry(geometry)
    const outline = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: '#ffee00' }))
    mesh.add(outline)

    this.ctx.scene.add(mesh)
    this._highlightMeshes.set(key, mesh)
  }

  _removeHighlight (cell) {
    const key = `${cell.cx},${cell.cz}`
    const mesh = this._highlightMeshes.get(key)
    if (!mesh) return
    mesh.geometry.dispose()
    mesh.material.dispose()
    mesh.children.forEach(child => { child.geometry.dispose(); child.material.dispose() })
    this.ctx.scene.remove(mesh)
    this._highlightMeshes.delete(key)
  }

  _clearHighlights () {
    [...this._highlightMeshes.keys()].forEach(key => {
      const [cx, cz] = key.split(',').map(Number)
      this._removeHighlight({ cx, cz })
    })
  }
}
