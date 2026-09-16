/**
 * modules/OmniFloor.js — ⟐Floor
 *
 * A real ground-plane grid, sized to match the scene's own outer
 * boundary (VoidBoundary.js's cube shell, 3000 units) — not an
 * arbitrary small default. At that scale, a single high-density mesh
 * would be genuinely expensive, so this is deliberately NOT one giant
 * plane: the floor is divided into fixed-size tiles, and only the
 * tiles within a real window around the camera are ever built into
 * geometry at all.
 *
 * The actual GPU-cost answer, concretely: every currently-visible
 * tile's line segments are merged into ONE buffer, so the entire
 * visible floor costs exactly one draw call regardless of how large
 * the boundary is — not one draw call per tile. That merged buffer is
 * only rebuilt when the camera actually crosses into a different
 * tile, not every frame.
 *
 * Shape choice is scoped to genuinely flat, tileable forms — Plane,
 * Circle, Ring — rather than the full shape catalog; a volumetric
 * shape like a Sphere doesn't tile into a continuous floor surface
 * the way a flat one does. Whatever shape is chosen still always
 * sits flattened at floor level, per the request that this stay
 * recognizably "the floor" regardless of shape — future expressions,
 * not a full-shape floor.
 *
 * Follows the standard module contract (constructor / init / update / destroy).
 */

import * as THREE from 'three'
import { createWallpaperStore } from '../utils/WallpaperStorage.js'

const BOUNDARY_SIZE = 3000     // matches VoidBoundary.js's own outer cube extent
const TILE_SIZE = 100          // each tile's own width/depth
const TILE_DIVISIONS = 5       // internal grid lines per tile — 20 units/cell at TILE_SIZE=100
const WINDOW_RADIUS_TILES = 3  // 7x7 tile window actively built around the camera
const REBUILD_CHECK_INTERVAL = 0.2   // seconds — throttled, not every frame

const FLOOR_Y = -0.08   // just beneath the platform rings (which sit at y=0), never fighting them visually
const FLOOR_SHAPES = ['PlaneGeometry', 'CircleGeometry', 'RingGeometry']   // genuinely flat, tileable forms only

const FLOOR_TEXTURE_SLOTS = 5
const floorTextureStore = createWallpaperStore('floor-plane', FLOOR_TEXTURE_SLOTS)

const STORE_KEY = 'omni:floor:settings'
function loadSettings () {
  const defaults = { shape: 'PlaneGeometry', color: '#ffffff', alpha: 0.35, activeSlot: null }
  try {
    const raw = localStorage.getItem(STORE_KEY)
    return raw ? { ...defaults, ...JSON.parse(raw) } : defaults
  } catch (_) { return defaults }
}
function saveSettings (s) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(s)) } catch (_) {}
}

// Appends one tile's own line-segment vertices (in world XZ, flattened
// to Y=0 locally) directly into a shared array — no per-tile geometry
// objects, no merge utility, just raw vertex data built once per
// rebuild. Shape changes which lines get drawn within the tile, not
// whether tiling itself works.
function appendTileVertices (verts, tileX, tileZ, shape) {
  const x0 = tileX * TILE_SIZE
  const z0 = tileZ * TILE_SIZE
  const step = TILE_SIZE / TILE_DIVISIONS

  if (shape === 'CircleGeometry' || shape === 'RingGeometry') {
    // Concentric rings within the tile footprint, radial spokes —
    // reads as a real circle/ring pattern, not a plain grid.
    const cx = x0 + TILE_SIZE / 2
    const cz = z0 + TILE_SIZE / 2
    const maxR = TILE_SIZE / 2
    const innerSkip = shape === 'RingGeometry' ? 1 : 0   // Ring skips the innermost ring, leaving a hole
    for (let r = innerSkip; r <= TILE_DIVISIONS; r++) {
      const radius = (r / TILE_DIVISIONS) * maxR
      const segments = 12
      for (let i = 0; i < segments; i++) {
        const a0 = (i / segments) * Math.PI * 2
        const a1 = ((i + 1) / segments) * Math.PI * 2
        verts.push(cx + Math.cos(a0) * radius, 0, cz + Math.sin(a0) * radius)
        verts.push(cx + Math.cos(a1) * radius, 0, cz + Math.sin(a1) * radius)
      }
    }
    return
  }

  // Default: PlaneGeometry — a plain subdivided grid, horizontal and vertical lines
  for (let i = 0; i <= TILE_DIVISIONS; i++) {
    const x = x0 + i * step
    verts.push(x, 0, z0, x, 0, z0 + TILE_SIZE)
  }
  for (let j = 0; j <= TILE_DIVISIONS; j++) {
    const z = z0 + j * step
    verts.push(x0, 0, z, x0 + TILE_SIZE, 0, z)
  }
}

export default class OmniFloor {
  constructor (context) {
    this.ctx = context
    this._group = null
    this._wireframe = null
    this._solidMesh = null
    this._texture = null
    this._shape = 'PlaneGeometry'
    this._color = '#ffffff'
    this._alpha = 0.35
    this._activeSlot = null
    this._onSettingsSet = null
    this._lastCenterTileX = null
    this._lastCenterTileZ = null
    this._sinceLastCheck = 0
  }

  init () {
    const saved = loadSettings()
    this._shape = FLOOR_SHAPES.includes(saved.shape) ? saved.shape : 'PlaneGeometry'
    this._color = saved.color
    this._alpha = saved.alpha
    this._activeSlot = saved.activeSlot

    this._group = new THREE.Group()
    this._group.position.set(0, FLOOR_Y, 0)
    this.ctx.scene.add(this._group)

    this._buildWireframe()
    this._buildSolidBackdrop()
    this._rebuildWindow(0, 0)   // initial window around the origin, before the camera has moved at all
    if (this._activeSlot) this._applySlotTexture(this._activeSlot)

    this._onSettingsSet = (e) => {
      const patch = e.detail ?? {}
      let needsRebuild = false
      if (patch.shape !== undefined && FLOOR_SHAPES.includes(patch.shape) && patch.shape !== this._shape) {
        this._shape = patch.shape
        needsRebuild = true
      }
      if (patch.color !== undefined) { this._color = patch.color; this._applyColor() }
      if (patch.alpha !== undefined) { this._alpha = patch.alpha; this._applyColor() }
      if (patch.activeSlot !== undefined) {
        this._activeSlot = patch.activeSlot
        if (this._activeSlot) this._applySlotTexture(this._activeSlot)
        else this._clearTexture()
      }
      if (needsRebuild) {
        this._lastCenterTileX = null   // force a rebuild even if the camera hasn't moved
        this._rebuildWindow(this._lastCameraTileX ?? 0, this._lastCameraTileZ ?? 0)
        this._saveAll()
      } else if (patch.color !== undefined || patch.alpha !== undefined || patch.activeSlot !== undefined) {
        this._saveAll()
      }
    }
    window.addEventListener('omni:floor-set', this._onSettingsSet)
  }

  update (delta) {
    this._sinceLastCheck += delta
    if (this._sinceLastCheck < REBUILD_CHECK_INTERVAL) return
    this._sinceLastCheck = 0

    const cam = this.ctx.camera
    if (!cam) return
    const tileX = Math.floor(cam.position.x / TILE_SIZE)
    const tileZ = Math.floor(cam.position.z / TILE_SIZE)
    this._lastCameraTileX = tileX
    this._lastCameraTileZ = tileZ
    if (tileX === this._lastCenterTileX && tileZ === this._lastCenterTileZ) return   // camera hasn't crossed into a new tile — no rebuild needed
    this._rebuildWindow(tileX, tileZ)
  }

  onResize () {}

  destroy () {
    window.removeEventListener('omni:floor-set', this._onSettingsSet)
    this._texture?.dispose()
    if (this._group) {
      this.ctx.scene.remove(this._group)
      this._group.traverse(obj => { obj.geometry?.dispose(); obj.material?.dispose() })
    }
  }

  _buildWireframe () {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(0), 3))
    const mat = new THREE.LineBasicMaterial({ color: this._color, transparent: true, opacity: this._alpha })
    this._wireframe = new THREE.LineSegments(geo, mat)
    this._group.add(this._wireframe)
  }

  // A single flat plane sized to the actual boundary, hidden until a
  // texture is chosen — this is what actually carries a texture, since
  // a wireframe has no face to paint one onto. The wireframe tiling
  // system above is unaffected either way.
  _buildSolidBackdrop () {
    const geo = new THREE.PlaneGeometry(BOUNDARY_SIZE, BOUNDARY_SIZE)
    const mat = new THREE.MeshBasicMaterial({ color: this._color, transparent: true, opacity: this._alpha, side: THREE.DoubleSide })
    this._solidMesh = new THREE.Mesh(geo, mat)
    this._solidMesh.rotation.x = -Math.PI / 2
    this._solidMesh.visible = false
    this._group.add(this._solidMesh)
  }

  /** Rebuilds the merged wireframe buffer for the 7x7 tile window
   *  centered on the given tile coordinate — one draw call for the
   *  entire visible floor, however large the real boundary is. */
  _rebuildWindow (centerTileX, centerTileZ) {
    this._lastCenterTileX = centerTileX
    this._lastCenterTileZ = centerTileZ

    const maxTile = Math.floor((BOUNDARY_SIZE / 2) / TILE_SIZE)
    const verts = []
    for (let dx = -WINDOW_RADIUS_TILES; dx <= WINDOW_RADIUS_TILES; dx++) {
      for (let dz = -WINDOW_RADIUS_TILES; dz <= WINDOW_RADIUS_TILES; dz++) {
        const tileX = centerTileX + dx
        const tileZ = centerTileZ + dz
        if (Math.abs(tileX) > maxTile || Math.abs(tileZ) > maxTile) continue   // never build tiles outside the real boundary
        appendTileVertices(verts, tileX, tileZ, this._shape)
      }
    }

    this._wireframe.geometry.dispose()
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts), 3))
    this._wireframe.geometry = geo
  }

  _applyColor () {
    this._wireframe.material.color.set(this._color)
    this._wireframe.material.opacity = this._alpha
    if (!this._texture) this._solidMesh.material.color.set(this._color)
    this._solidMesh.material.opacity = this._alpha
  }

  async _applySlotTexture (slot) {
    try {
      const record = await floorTextureStore.loadWallpaper(slot)
      if (!record) return
      const url = URL.createObjectURL(record.blob)
      new THREE.TextureLoader().load(url, (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping
        texture.repeat.set(BOUNDARY_SIZE / TILE_SIZE, BOUNDARY_SIZE / TILE_SIZE)   // tiles at the same density as the wireframe grid
        this._texture?.dispose()
        this._texture = texture
        this._solidMesh.material.map = texture
        this._solidMesh.material.color.set(0xffffff)
        this._solidMesh.material.needsUpdate = true
        this._solidMesh.visible = true
        this._wireframe.visible = false
      })
      this._activeSlot = slot
      this._saveAll()
    } catch (err) {
      console.warn('⟐OmniFloor — failed to load floor texture slot', slot, err)
    }
  }

  _clearTexture () {
    this._texture?.dispose()
    this._texture = null
    this._solidMesh.visible = false
    this._wireframe.visible = true
    this._activeSlot = null
    this._saveAll()
  }

  _saveAll () {
    const current = loadSettings()
    saveSettings({ ...current, shape: this._shape, color: this._color, alpha: this._alpha, activeSlot: this._activeSlot })
  }
}

export { floorTextureStore, FLOOR_TEXTURE_SLOTS, FLOOR_SHAPES, BOUNDARY_SIZE }
