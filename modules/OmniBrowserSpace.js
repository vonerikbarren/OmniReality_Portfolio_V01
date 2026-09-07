/**
 * modules/OmniBrowserSpace.js — ⟐mniReality OmniBrowserSpace
 *
 * Rebuilt from the CSS3D version — that approach put live iframes on
 * the cube's faces, but CSS3DRenderer and WebGLRenderer are two
 * separate rendering pipelines stitched together by plain DOM
 * z-index, with no shared depth buffer at all. A CSS3D iframe can
 * never be correctly occluded by WebGL geometry "in front of" it —
 * only approximated with per-frame raycasting — and it visually
 * dominates the scene regardless of what's actually in front of it.
 * That's a real, structural limitation, not a bug to fix.
 *
 * This version drops CSS3D and iframes entirely: a shape-changeable
 * cube with 4 simple, real WebGL objects — styled like typical
 * OmniDraw primitives, varied geometry and PRIMITIVE_COLORS — sitting
 * at the center of 4 of its faces (front/back/left/right; top/bottom
 * stay plain). These are genuine geometry, parented to the same group
 * as the cube itself, so they rotate/scale with it correctly and
 * participate in the normal depth buffer like everything else in the
 * scene — no compositing quirks, because there's no DOM content
 * involved at all.
 *
 * Because there's no longer anything expensive to defer (no CSS3D
 * layer, no live iframes), the earlier click-to-activate / Put Away
 * mechanism is gone too — it existed specifically to defer that cost,
 * which doesn't exist in this version. The whole thing is cheap real
 * geometry, present from boot, same as WallpaperSphere/ParticleField.
 *
 * Not literally created via the global OmniNode creation pipeline —
 * that system positions nodes independently in world space and isn't
 * designed to stay rigidly attached to another object's own rotating
 * transform. These 4 objects are plain child meshes of this module's
 * own group instead, so they inherit its position/rotation/scale
 * directly and correctly.
 *
 * Follows the standard module contract (constructor / init / update / destroy).
 */

import * as THREE from 'three'
import { WALLPAPER_SHAPES } from './WallpaperSphere.js'
import { createWallpaperStore } from '../utils/WallpaperStorage.js'

export { WALLPAPER_SHAPES as BROWSERSPACE_SHAPES }

const ROOM_Y = 15               // lifted above the platform, not sitting inside it
const DEFAULT_EDGE = 10         // world units — see sizing-reference note below
const REFERENCE_RADIUS = DEFAULT_EDGE / 2   // 5 — the cube's own half-edge, the target "reach" every shape aims for
const MIN_SCALE = 0.5
const MAX_SCALE = 2.5
const DEFAULT_SHAPE = 'BoxGeometry'

/**
 * Per-shape construction, each tuned to reach REFERENCE_RADIUS along
 * the 6 cardinal axes where the face objects sit — "the dimensions
 * have to match the circumference." Clean for shapes that are
 * genuinely uniform in all 6 cardinal directions (Box, Sphere,
 * Cylinder, Octahedron). An honest best-effort approximation for
 * shapes that aren't naturally 6-way-symmetric (Cone, Torus/TorusKnot,
 * Tetrahedron) — some face objects will sit slightly proud of or
 * recessed into the actual surface there. A real geometric limit, not
 * a bug.
 */
const SHAPE_BUILDERS = {
  BoxGeometry:          (r) => new THREE.BoxGeometry(r * 2, r * 2, r * 2),
  SphereGeometry:       (r) => new THREE.SphereGeometry(r, 32, 32),
  CylinderGeometry:     (r) => new THREE.CylinderGeometry(r, r, r * 2, 32),
  ConeGeometry:         (r) => new THREE.ConeGeometry(r, r * 2, 32),
  TorusGeometry:        (r) => new THREE.TorusGeometry(r * 0.75, r * 0.3, 16, 48),
  TorusKnotGeometry:    (r) => new THREE.TorusKnotGeometry(r * 0.6, r * 0.2, 128, 16),
  OctahedronGeometry:   (r) => new THREE.OctahedronGeometry(r),
  TetrahedronGeometry:  (r) => new THREE.TetrahedronGeometry(r),
  IcosahedronGeometry:  (r) => new THREE.IcosahedronGeometry(r, 1),
  DodecahedronGeometry: (r) => new THREE.DodecahedronGeometry(r),
  CapsuleGeometry:      (r) => new THREE.CapsuleGeometry(r * 0.6, r, 16, 32),
}

// The 4 face objects — varied geometry + OmniDraw's own PRIMITIVE_COLORS
// (systems/OmniNode.js), for visual consistency with real OmniDraw objects.
const FACE_OBJECTS = [
  { axis: 'z', sign:  1, geometry: () => new THREE.BoxGeometry(1.4, 1.4, 1.4),      color: 0xffffff }, // objective
  { axis: 'z', sign: -1, geometry: () => new THREE.SphereGeometry(0.9, 20, 20),     color: 0x88aaff }, // subjective
  { axis: 'x', sign:  1, geometry: () => new THREE.ConeGeometry(0.9, 1.6, 20),      color: 0x888888 }, // undefined
  { axis: 'x', sign: -1, geometry: () => new THREE.OctahedronGeometry(1.0),         color: 0x88aaff }, // subjective
]

const CUBE_TEXTURE_SLOTS = 5
const cubeTextureStore = createWallpaperStore('browserspace-cube', CUBE_TEXTURE_SLOTS)

const STORE_KEY = 'omni:browserspace:settings'
function loadSettings () {
  const defaults = {
    shape: DEFAULT_SHAPE,
    rotation: { x: 0, y: 0, z: 0 },
    color: '#8cc4ff', alpha: 0.6,
    activeSlot: null,
  }
  try {
    const raw = localStorage.getItem(STORE_KEY)
    return raw ? { ...defaults, ...JSON.parse(raw) } : defaults
  } catch (_) { return defaults }
}
function saveSettings (s) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(s)) } catch (_) {}
}

export default class OmniBrowserSpace {
  constructor (context) {
    this.ctx = context
    this._glGroup = null
    this._wireframe = null
    this._solidMesh = null
    this._faceMeshes = []
    this._texture = null
    this._shape = DEFAULT_SHAPE
    this._rotation = { x: 0, y: 0, z: 0 }
    this._color = '#8cc4ff'
    this._alpha = 0.6
    this._activeSlot = null
    this._onSettingsSet = null
  }

  init () {
    const saved = loadSettings()
    this._shape = saved.shape
    this._rotation = { ...saved.rotation }
    this._color = saved.color
    this._alpha = saved.alpha
    this._activeSlot = saved.activeSlot

    this._glGroup = new THREE.Group()
    this._glGroup.position.set(0, ROOM_Y, 0)
    this.ctx.scene.add(this._glGroup)

    this._buildShapeMesh()
    this._buildFaceObjects()
    this._applyRotation()

    if (this._activeSlot) this._applySlotTexture(this._activeSlot)

    // From ui/OmniBrowserSpacePanel.js — "instant save," applies and
    // persists immediately, no staged Save button.
    this._onSettingsSet = (e) => {
      const patch = e.detail ?? {}
      if (patch.shape !== undefined && patch.shape !== this._shape) this._changeShape(patch.shape)
      if (patch.rotation) { this._rotation = { ...this._rotation, ...patch.rotation }; this._applyRotation() }
      if (patch.color !== undefined) { this._color = patch.color; this._applyColor() }
      if (patch.alpha !== undefined) { this._alpha = patch.alpha; this._applyColor() }
      if (patch.activeSlot !== undefined) {
        this._activeSlot = patch.activeSlot
        if (this._activeSlot) this._applySlotTexture(this._activeSlot)
        else this._clearTexture()
      }
    }
    window.addEventListener('omni:browserspace-set', this._onSettingsSet)
  }

  update () {}
  onResize () {}

  destroy () {
    window.removeEventListener('omni:browserspace-set', this._onSettingsSet)
    this._texture?.dispose()
    if (this._glGroup) {
      this.ctx.scene.remove(this._glGroup)
      this._glGroup.traverse(obj => { obj.geometry?.dispose(); obj.material?.dispose() })
    }
  }

  // ── Geometry ─────────────────────────────────────────────────────────────

  _buildShapeMesh () {
    const builder = SHAPE_BUILDERS[this._shape] ?? SHAPE_BUILDERS[DEFAULT_SHAPE]
    const geo = builder(REFERENCE_RADIUS)

    const edges = new THREE.EdgesGeometry(geo)
    const lineMat = new THREE.LineBasicMaterial({ color: this._color, transparent: true, opacity: this._alpha })
    this._wireframe = new THREE.LineSegments(edges, lineMat)
    this._glGroup.add(this._wireframe)

    // Hidden until a texture slot is actually selected — "the option
    // of undoing the wireframe and adding a texture."
    const solidMat = new THREE.MeshBasicMaterial({ color: this._color, transparent: true, opacity: this._alpha, side: THREE.DoubleSide })
    this._solidMesh = new THREE.Mesh(geo.clone(), solidMat)
    this._solidMesh.visible = false
    this._glGroup.add(this._solidMesh)

    geo.dispose()
  }

  /** 4 small, real WebGL objects at the center of 4 faces — varied
   *  geometry and OmniDraw's own PRIMITIVE_COLORS, genuine child
   *  meshes of this module's own group (not the global OmniNode
   *  pipeline, which positions nodes independently and wouldn't stay
   *  attached to this group's own rotation/scale). */
  _buildFaceObjects () {
    FACE_OBJECTS.forEach(face => {
      const geo = face.geometry()
      const mat = new THREE.MeshStandardMaterial({ color: face.color, roughness: 0.4, metalness: 0.1 })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position[face.axis] = REFERENCE_RADIUS * face.sign
      this._glGroup.add(mesh)
      this._faceMeshes.push(mesh)
    })
  }

  _changeShape (shape) {
    if (!SHAPE_BUILDERS[shape]) return
    this._glGroup.remove(this._wireframe)
    this._glGroup.remove(this._solidMesh)
    this._wireframe.geometry.dispose(); this._wireframe.material.dispose()
    this._solidMesh.geometry.dispose(); this._solidMesh.material.dispose()

    this._shape = shape
    this._buildShapeMesh()
    // Re-add the (unaffected) face objects on top, since removing the
    // shape mesh doesn't touch them, but a fresh _buildShapeMesh call
    // inserts the new shape at the end of _glGroup's children — order
    // doesn't matter for rendering here, so no reordering needed.
    if (this._activeSlot) { this._solidMesh.visible = true; this._wireframe.visible = false }
    if (this._texture) { this._solidMesh.material.map = this._texture; this._solidMesh.material.color.set(0xffffff); this._solidMesh.material.needsUpdate = true }

    saveSettings({ shape: this._shape, rotation: this._rotation, color: this._color, alpha: this._alpha, activeSlot: this._activeSlot })
  }

  _applyRotation () {
    if (!this._glGroup) return
    this._glGroup.rotation.set(this._rotation.x, this._rotation.y, this._rotation.z)
    saveSettings({ shape: this._shape, rotation: this._rotation, color: this._color, alpha: this._alpha, activeSlot: this._activeSlot })
  }

  _applyColor () {
    if (!this._wireframe) return
    this._wireframe.material.color.set(this._color)
    this._wireframe.material.opacity = this._alpha
    if (!this._texture) this._solidMesh.material.color.set(this._color)
    this._solidMesh.material.opacity = this._alpha
    saveSettings({ shape: this._shape, rotation: this._rotation, color: this._color, alpha: this._alpha, activeSlot: this._activeSlot })
  }

  async _applySlotTexture (slot) {
    try {
      const record = await cubeTextureStore.loadWallpaper(slot)
      if (!record) return
      const url = URL.createObjectURL(record.blob)
      new THREE.TextureLoader().load(url, (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace
        this._texture?.dispose()
        this._texture = texture
        this._solidMesh.material.map = texture
        this._solidMesh.material.color.set(0xffffff)
        this._solidMesh.material.needsUpdate = true
        this._solidMesh.visible = true
        this._wireframe.visible = false
      })
      saveSettings({ shape: this._shape, rotation: this._rotation, color: this._color, alpha: this._alpha, activeSlot: slot })
    } catch (err) {
      console.warn('⟐OmniBrowserSpace — failed to load cube texture slot', slot, err)
    }
  }

  _clearTexture () {
    this._texture?.dispose()
    this._texture = null
    this._solidMesh.visible = false
    this._wireframe.visible = true
    saveSettings({ shape: this._shape, rotation: this._rotation, color: this._color, alpha: this._alpha, activeSlot: null })
  }
}
