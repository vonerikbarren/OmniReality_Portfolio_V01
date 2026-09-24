/**
 * systems/OmniRealityGridPointSelector.js — ⟐mniRealityGridPointSelector
 *
 * Real sibling to OmniRealityGridSelector: selects real grid POINTS
 * (vertices, where lines cross) rather than whole cells, as precise
 * placement anchors for building. Same real floor-plane raycast,
 * snapped to the nearest vertex (round) instead of the nearest cell
 * (floor).
 *
 * Three real, additional pieces, per direct request:
 * 1. Local subdivision — a selected cell can be subdivided into a
 *    finer sub-grid of points (2x/4x/8x), computed only within that
 *    one cell's own bounds. The floor's own global 20-unit grid
 *    never changes; this is a local, on-demand denser net, not a
 *    global resolution change.
 * 2. A real vertical grid — grows from one edge of an already-
 *    selected cell (its own real anchor, not a plane floating with
 *    no relationship to anything), rotatable in real 90° steps by
 *    picking which of the cell's four edges to raise it from, at
 *    the same real cell size, so a vertical anchor point and a
 *    floor anchor point are always the same real distance apart.
 * 3. Nexus labels — each real point shows its own real world
 *    position ("objectively to the scene") and its real grid-cell
 *    index ("relative to the amount of squares they reserve").
 */

import * as THREE from 'three'

const FLOOR_Y = -0.08   // matches OmniRealityGridSelector's own real value
const CELL_SIZE = 20    // matches the floor's own real grid cell size

export default class OmniRealityGridPointSelector {
  constructor (context) {
    this.ctx = context
    this._isSelecting = false
    this._selectedPoints = []   // real, current selection — [{px, pz}], real world units, not cell indices
    this._markerMeshes = new Map()   // real "px,pz" -> real THREE.Group (marker + label sprite)
    this._subdivisions = new Map()   // real "cx,cz" -> real subdivision level (2, 4, 8) for that one cell
    this._wallMeshes = new Map()   // real wall id -> real THREE.Group
    this._onClick = null
  }

  init () {
    this._onClick = (e) => {
      if (!this._isSelecting) return
      this._tryPickPoint(e)
    }
    this.ctx.renderer.domElement.addEventListener('click', this._onClick)
  }

  update () {}
  onResize () {}

  destroy () {
    this.ctx.renderer.domElement.removeEventListener('click', this._onClick)
    this._clearMarkers();
    [...this._wallMeshes.keys()].forEach(id => this._removeWall(id))
  }

  startSelecting () { this._isSelecting = true }
  stopSelecting () { this._isSelecting = false }

  clearSelection () {
    this._clearMarkers()
    this._selectedPoints = []
  }

  /** Real, local subdivision — only affects anchor points inside
   *  this one real cell, never the floor's own global grid. Passing
   *  1 clears any subdivision (back to the cell's own 4 corners). */
  setSubdivision (cx, cz, level) {
    const key = `${cx},${cz}`
    if (level <= 1) this._subdivisions.delete(key)
    else this._subdivisions.set(key, level)
  }

  getSubdivision (cx, cz) {
    return this._subdivisions.get(`${cx},${cz}`) ?? 1
  }

  /** Real vertical wall — grows from one real edge of a real,
   *  already-selected cell. edge is one of 'north'|'south'|'east'|
   *  'west' (picking which of the cell's four edges to raise it
   *  from, real 90°-step orientation rather than free rotation).
   *  heightCells is how many real 20-unit cells tall the wall is. */
  raiseWall (id, cx, cz, edge, heightCells = 3) {
    this._removeWall(id)

    const x0 = cx * CELL_SIZE, x1 = x0 + CELL_SIZE
    const z0 = cz * CELL_SIZE, z1 = z0 + CELL_SIZE
    const height = heightCells * CELL_SIZE

    // Real edge midpoint and real width/depth span, so the wall's
    // own geometry always spans exactly one real cell's edge.
    let centerX, centerZ, width, rotationY
    if (edge === 'north') { centerX = (x0 + x1) / 2; centerZ = z0; width = CELL_SIZE; rotationY = 0 }
    else if (edge === 'south') { centerX = (x0 + x1) / 2; centerZ = z1; width = CELL_SIZE; rotationY = 0 }
    else if (edge === 'east') { centerX = x1; centerZ = (z0 + z1) / 2; width = CELL_SIZE; rotationY = Math.PI / 2 }
    else { centerX = x0; centerZ = (z0 + z1) / 2; width = CELL_SIZE; rotationY = Math.PI / 2 }   // 'west'

    const geometry = new THREE.PlaneGeometry(width, height, 1, heightCells)
    const wireframe = new THREE.WireframeGeometry(geometry)
    const mesh = new THREE.LineSegments(wireframe, new THREE.LineBasicMaterial({ color: '#ffee00', transparent: true, opacity: 0.5 }))
    mesh.rotation.y = rotationY
    mesh.position.set(centerX, FLOOR_Y + height / 2, centerZ)

    this.ctx.scene.add(mesh)
    this._wallMeshes.set(id, mesh)
    return mesh
  }

  removeWall (id) { this._removeWall(id) }

  _removeWall (id) {
    const mesh = this._wallMeshes.get(id)
    if (!mesh) return
    mesh.geometry.dispose()
    mesh.material.dispose()
    this.ctx.scene.remove(mesh)
    this._wallMeshes.delete(id)
  }

  _tryPickPoint (e) {
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

    // Real cell this hit falls within, so a local subdivision (if
    // any) is honored — snaps to the finer sub-grid inside this one
    // cell instead of just its 4 corners.
    const cx = Math.floor(hitPoint.x / CELL_SIZE)
    const cz = Math.floor(hitPoint.z / CELL_SIZE)
    const n = this.getSubdivision(cx, cz)
    const step = CELL_SIZE / n

    const px = Math.round(hitPoint.x / step) * step
    const pz = Math.round(hitPoint.z / step) * step
    this._togglePoint({ px, pz })
  }

  _togglePoint (point) {
    const key = `${point.px},${point.pz}`
    const existingIndex = this._selectedPoints.findIndex(p => `${p.px},${p.pz}` === key)
    if (existingIndex >= 0) {
      this._selectedPoints.splice(existingIndex, 1)
      this._removeMarker(point)
    } else {
      this._selectedPoints.push(point)
      this._addMarker(point)
    }
  }

  /** Real marker — a small octahedron (real, distinct from the cell
   *  selector's own flat highlight, since a point is 0-dimensional,
   *  not an area), white with a yellow outline, matching the
   *  established real styling. Carries a real nexus label showing
   *  both its real world position and its real grid-cell index. */
  _addMarker (point) {
    const key = `${point.px},${point.pz}`
    if (this._markerMeshes.has(key)) return

    const group = new THREE.Group()
    group.position.set(point.px, FLOOR_Y + 0.3, point.pz)

    const geometry = new THREE.OctahedronGeometry(0.6)
    const material = new THREE.MeshBasicMaterial({ color: '#ffffff' })
    const marker = new THREE.Mesh(geometry, material)
    const edges = new THREE.EdgesGeometry(geometry)
    const outline = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: '#ffee00' }))
    marker.add(outline)
    group.add(marker)

    const cx = Math.floor(point.px / CELL_SIZE)
    const cz = Math.floor(point.pz / CELL_SIZE)
    const label = this._buildNexusLabel(point, cx, cz)
    label.position.set(0, 1.2, 0)
    group.add(label)

    this.ctx.scene.add(group)
    this._markerMeshes.set(key, group)
  }

  /** Real nexus label — world position ("objectively to the
   *  scene") and grid-cell index ("relative to the amount of
   *  squares they reserve"), per direct request. A real canvas-
   *  texture sprite, so it billboards to the camera for free
   *  (THREE.Sprite always faces the camera) rather than needing a
   *  manual per-frame lookAt. */
  _buildNexusLabel (point, cx, cz) {
    const canvas = document.createElement('canvas')
    canvas.width = 256; canvas.height = 64
    const c = canvas.getContext('2d')
    c.fillStyle = 'rgba(0,0,0,0.55)'
    c.fillRect(0, 0, canvas.width, canvas.height)
    c.font = '20px monospace'
    c.fillStyle = '#ffffff'
    c.fillText(`(${point.px.toFixed(0)}, ${point.pz.toFixed(0)})`, 8, 26)
    c.font = '16px monospace'
    c.fillStyle = '#ffee00'
    c.fillText(`cell [${cx}, ${cz}]`, 8, 50)

    const texture = new THREE.CanvasTexture(canvas)
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }))
    sprite.scale.set(3.2, 0.8, 1)
    return sprite
  }

  _removeMarker (point) {
    const key = `${point.px},${point.pz}`
    const group = this._markerMeshes.get(key)
    if (!group) return
    group.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose()
      if (obj.material) {
        obj.material.map?.dispose?.()
        obj.material.dispose()
      }
    })
    this.ctx.scene.remove(group)
    this._markerMeshes.delete(key)
  }

  _clearMarkers () {
    [...this._markerMeshes.keys()].forEach(key => {
      const [px, pz] = key.split(',').map(Number)
      this._removeMarker({ px, pz })
    })
  }
}
