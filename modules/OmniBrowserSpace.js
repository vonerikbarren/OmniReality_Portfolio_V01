/**
 * modules/OmniBrowserSpace.js — ⟐mniReality OmniBrowserSpace
 *
 * Phase 2 of the OmniBrowser roadmap (see OMNIBROWSER.md) — "a room
 * for the site instead of just a window." A wireframe cube with up to
 * 2 live CSS3D iframe faces and 4 static placeholder panel faces,
 * built as a genuine performance test before scaling up to the full
 * "4 quadrants per face" vision.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Why two parallel groups (_glGroup and _cssGroup), not one
 * ─────────────────────────────────────────────────────────────────────────────
 * The wireframe cube and the 4 placeholder panels are real WebGL
 * geometry — they belong in the main scene, rendered by the normal
 * THREE.WebGLRenderer. The 2 live iframes are CSS3DObjects — real DOM
 * elements positioned in 3D via CSS transforms, rendered by a SEPARATE
 * THREE.CSS3DRenderer layered on top of the WebGL canvas. They can't
 * share one Object3D tree cleanly (a CSS3DRenderer traversal ignores
 * regular meshes, and mixing them risks a stray CSS3DObject getting
 * picked up by raycasting meant for real geometry elsewhere in the
 * app). Kept as two groups with identical position/rotation/scale
 * applied to both, rather than one shared tree.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Sizing reference — anchored to a real object already in the scene
 * ─────────────────────────────────────────────────────────────────────────────
 * modules/OmniPlatform.js's outermost ring has radius 20 (diameter
 * 40) — a real, already-existing landmark at the world's center. This
 * room's default edge length (10) and slider range are chosen to sit
 * comfortably within that footprint, not an arbitrary guess. The
 * upper end of "how big before frame rate drops" is left for empirical
 * testing via the live slider, not something hard-coded here — that's
 * genuinely hardware-dependent.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * The on/off switches ARE the face-culling mechanic, made manual
 * ─────────────────────────────────────────────────────────────────────────────
 * Per the OmniBrowserSpace performance conversation: an iframe that's
 * off has its `src` fully cleared (not just hidden) — the browsing
 * context actually unloads, freeing its memory/CPU/network entirely,
 * not just visually hiding a still-running page. Automatic camera-
 * facing culling is the eventual goal; this manual toggle is the
 * simplest version of the same idea, for this first test.
 *
 * Follows the standard module contract (constructor / init / update / destroy).
 */

import * as THREE from 'three'
import gsap from 'gsap'
import { CSS3DRenderer, CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js'
import { WALLPAPER_SHAPES } from './WallpaperSphere.js'
import { createWallpaperStore } from '../utils/WallpaperStorage.js'

export { WALLPAPER_SHAPES as BROWSERSPACE_SHAPES }

const ROOM_Y = 15               // lifted above the platform, not sitting inside it
const DEFAULT_EDGE = 10         // world units — see sizing-reference note above
const REFERENCE_RADIUS = DEFAULT_EDGE / 2   // 5 — the cube's own half-edge, the target "reach" every shape aims for
const MIN_SCALE = 0.5
const MAX_SCALE = 2.5
const CSS_PX_PER_UNIT = 100     // how many CSS pixels represent one world unit at scale 1
const DEFAULT_SHAPE = 'BoxGeometry'

/**
 * Per-shape construction, each tuned to reach REFERENCE_RADIUS along
 * the 6 cardinal axes where the iframe/panel faces attach — "the
 * dimensions have to match the circumference" from the brief. This
 * works cleanly for shapes whose geometry is genuinely uniform in all
 * 6 cardinal directions (Box, Sphere, Cylinder, Octahedron — an
 * octahedron's 6 vertices sit exactly on those axes, arguably an even
 * more natural fit than a cube). It's an honest best-effort
 * approximation for shapes that AREN'T naturally 6-way-symmetric —
 * Cone (tapers to a point, so its side reach shrinks toward one end),
 * Torus/TorusKnot (very little vertical extent — a doughnut is not
 * tall), and Tetrahedron (only 4 vertices, not 6). For those, some
 * panels will sit slightly proud of or recessed into the actual
 * surface at that exact point — a real geometric limit, not a bug,
 * and not fixable without either distorting the shape past
 * recognition or abandoning fixed cardinal-axis attachment points.
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

const CUBE_TEXTURE_SLOTS = 5
const cubeTextureStore = createWallpaperStore('browserspace-cube', CUBE_TEXTURE_SLOTS)

const STORE_KEY = 'omni:browserspace:settings'
function loadSettings () {
  const defaults = {
    shape: DEFAULT_SHAPE,
    rotation: { x: 0, y: 0, z: 0 },
    color: '#8cc4ff', alpha: 0.6,
    activeSlot: null,   // null = default (wireframe, no texture)
  }
  try {
    const raw = localStorage.getItem(STORE_KEY)
    return raw ? { ...defaults, ...JSON.parse(raw) } : defaults
  } catch (_) { return defaults }
}
function saveSettings (s) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(s)) } catch (_) {}
}


const FACES = [
  { id: 'front',  axis: 'z', sign:  1, rot: [0, 0, 0] },
  { id: 'back',   axis: 'z', sign: -1, rot: [0, Math.PI, 0] },
  { id: 'right',  axis: 'x', sign:  1, rot: [0, Math.PI / 2, 0] },
  { id: 'left',   axis: 'x', sign: -1, rot: [0, -Math.PI / 2, 0] },
  { id: 'top',    axis: 'y', sign:  1, rot: [-Math.PI / 2, 0, 0] },
  { id: 'bottom', axis: 'y', sign: -1, rot: [Math.PI / 2, 0, 0] },
]

// Which faces get a live iframe, and what's on them. The remaining
// faces (right/left/top/bottom) are static placeholder panels — "the
// rest can be just panels," per the brief. Easy to move/add later.
const IFRAME_FACES = {
  front: { label: 'Clock', url: './pages/01-Clock/index.html' },
  back:  { label: 'Wikipedia', url: 'https://en.m.wikipedia.org/wiki/Special:Random' },
}

function injectStyles () {
  if (document.getElementById('omni-browser-space-styles')) return
  const tag = document.createElement('style')
  tag.id = 'omni-browser-space-styles'
  tag.textContent = /* css */`
    .obs-css3d-layer {
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 40;
      overflow: hidden;
    }
    .obs-face-iframe {
      border: none;
      background: #111;
    }
    .obs-controls {
      position: fixed;
      bottom: 16px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      align-items: center;
      gap: 14px;
      background: rgba(8, 8, 12, 0.85);
      backdrop-filter: blur(14px);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 10px;
      padding: 10px 16px;
      font-family: 'Courier New', monospace;
      font-size: 10px;
      color: rgba(255,255,255,0.8);
      z-index: 70;
    }
    .obs-toggle-group { display: flex; align-items: center; gap: 6px; }
    .obs-toggle-sm {
      width: 30px; height: 16px; border-radius: 9px;
      border: 1px solid rgba(255,255,255,0.18);
      background: rgba(255,255,255,0.08);
      position: relative; cursor: pointer;
    }
    .obs-toggle-sm::after {
      content: ''; position: absolute; top: 1px; left: 1px;
      width: 12px; height: 12px; border-radius: 50%;
      background: rgba(255,255,255,0.6);
      transition: transform 0.15s ease, background 0.15s ease;
    }
    .obs-toggle-sm.is-on { background: rgba(140,196,255,0.3); border-color: rgba(140,196,255,0.5); }
    .obs-toggle-sm.is-on::after { transform: translateX(14px); background: #8cc4ff; }
    .obs-scale-row { display: flex; align-items: center; gap: 8px; }
    .obs-scale-slider { width: 140px; accent-color: #8cc4ff; }
    .obs-scale-val { width: 34px; text-align: right; color: rgba(255,255,255,0.6); }
  `
  document.head.appendChild(tag)
}

export default class OmniBrowserSpace {
  constructor (context) {
    this.ctx = context
    this._glGroup = null
    this._cssGroup = null
    this._cssScene = null
    this._cssRenderer = null
    this._cssLayer = null
    this._controlsEl = null
    this._iframeEls = {}       // faceId -> <iframe>
    this._iframeOn = { front: true, back: false }   // "try that being the only iframe" — Clock on, Wikipedia off by default
    this._scale = 1
    this._shape = DEFAULT_SHAPE
    this._rotation = { x: 0, y: 0, z: 0 }
    this._color = '#8cc4ff'
    this._alpha = 0.6
    this._activeSlot = null
    this._texture = null
    this._onSettingsSet = null
  }

  init () {
    injectStyles()
    const saved = loadSettings()
    this._shape = saved.shape
    this._rotation = { ...saved.rotation }
    this._color = saved.color
    this._alpha = saved.alpha
    this._activeSlot = saved.activeSlot

    this._glGroup = new THREE.Group()
    this._glGroup.position.set(0, ROOM_Y, 0)
    this.ctx.scene.add(this._glGroup)

    this._cssScene = new THREE.Scene()
    this._cssGroup = new THREE.Group()
    this._cssGroup.position.set(0, ROOM_Y, 0)
    this._cssScene.add(this._cssGroup)

    this._buildCssLayer()
    this._buildWireframeCube()
    this._buildFaces()
    this._buildControls()
    this._applyRotation()

    if (this._activeSlot) this._applySlotTexture(this._activeSlot)

    // Only the Clock is on by default — "try that being the only
    // iframe" — Wikipedia's iframe exists but starts unloaded (empty
    // src) until its switch is flipped on.
    this._applyIframeState('front')
    this._applyIframeState('back')

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

  update () {
    if (!this._cssRenderer) return
    this._cssRenderer.render(this._cssScene, this.ctx.camera)
  }

  onResize () {
    if (!this._cssRenderer) return
    this._cssRenderer.setSize(window.innerWidth, window.innerHeight)
  }

  destroy () {
    window.removeEventListener('omni:browserspace-set', this._onSettingsSet)
    this._texture?.dispose()
    Object.keys(this._iframeEls).forEach(id => this._unloadIframe(id))
    this._cssLayer?.parentNode?.removeChild(this._cssLayer)
    this._controlsEl?.parentNode?.removeChild(this._controlsEl)
    if (this._glGroup) {
      this.ctx.scene.remove(this._glGroup)
      this._glGroup.traverse(obj => { obj.geometry?.dispose(); obj.material?.dispose() })
    }
  }

  // ── CSS3D layer setup ────────────────────────────────────────────────────

  _buildCssLayer () {
    this._cssLayer = document.createElement('div')
    this._cssLayer.className = 'obs-css3d-layer'
    document.body.appendChild(this._cssLayer)

    this._cssRenderer = new CSS3DRenderer({ element: this._cssLayer })
    this._cssRenderer.setSize(window.innerWidth, window.innerHeight)
  }

  // ── Geometry ─────────────────────────────────────────────────────────────

  _buildWireframeCube () {
    const builder = SHAPE_BUILDERS[this._shape] ?? SHAPE_BUILDERS[DEFAULT_SHAPE]
    const geo = builder(REFERENCE_RADIUS)

    const edges = new THREE.EdgesGeometry(geo)
    const lineMat = new THREE.LineBasicMaterial({ color: this._color, transparent: true, opacity: this._alpha })
    this._wireframe = new THREE.LineSegments(edges, lineMat)
    this._glGroup.add(this._wireframe)

    // Hidden until a texture slot is actually selected — "the option
    // of undoing the wireframe and adding a texture," from the
    // original OmniBrowserSpace spec.
    const solidMat = new THREE.MeshBasicMaterial({ color: this._color, transparent: true, opacity: this._alpha, side: THREE.DoubleSide })
    this._solidMesh = new THREE.Mesh(geo.clone(), solidMat)
    this._solidMesh.visible = false
    this._glGroup.add(this._solidMesh)

    geo.dispose()
  }

  /** Rebuilds both the wireframe and solid-mesh geometry for a new
   *  shape — geometry type can't be swapped in place. Face/iframe
   *  positions themselves don't move (they're fixed at the 6
   *  cardinal-axis points, per the brief) — only the shape underneath
   *  them changes. */
  _changeShape (shape) {
    if (!SHAPE_BUILDERS[shape]) return
    this._glGroup.remove(this._wireframe)
    this._glGroup.remove(this._solidMesh)
    this._wireframe.geometry.dispose(); this._wireframe.material.dispose()
    this._solidMesh.geometry.dispose(); this._solidMesh.material.dispose()

    this._shape = shape
    this._buildWireframeCube()
    if (this._activeSlot) {
      this._solidMesh.visible = true
      this._wireframe.visible = false
    }
    if (this._texture) { this._solidMesh.material.map = this._texture; this._solidMesh.material.color.set(0xffffff); this._solidMesh.material.needsUpdate = true }

    saveSettings({ shape: this._shape, rotation: this._rotation, color: this._color, alpha: this._alpha, activeSlot: this._activeSlot })
  }

  _applyRotation () {
    if (!this._glGroup) return
    this._glGroup.rotation.set(this._rotation.x, this._rotation.y, this._rotation.z)
    this._cssGroup.rotation.set(this._rotation.x, this._rotation.y, this._rotation.z)
    saveSettings({ shape: this._shape, rotation: this._rotation, color: this._color, alpha: this._alpha, activeSlot: this._activeSlot })
  }

  _applyColor () {
    if (!this._wireframe) return
    this._wireframe.material.color.set(this._color)
    this._wireframe.material.opacity = this._alpha
    // Only re-tint the solid mesh if it ISN'T currently showing a
    // texture — a textured face should show the image's true colors,
    // not a color tint on top of it.
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

  _buildFaces () {
    const half = REFERENCE_RADIUS
    FACES.forEach(face => {
      const iframeConfig = IFRAME_FACES[face.id]
      const [rx, ry, rz] = face.rot
      const position = new THREE.Vector3()
      position[face.axis] = half * face.sign

      if (iframeConfig) {
        this._buildIframeFace(face, position, [rx, ry, rz], iframeConfig)
      } else {
        this._buildPlaceholderFace(face, position, [rx, ry, rz])
      }
    })
  }

  /** A static, non-interactive panel — "the rest can be just panels."
   *  Real WebGL geometry, not an iframe — near-zero cost regardless
   *  of how many of these exist. */
  _buildPlaceholderFace (face, position, rotation) {
    const geo = new THREE.PlaneGeometry(DEFAULT_EDGE * 0.94, DEFAULT_EDGE * 0.94)
    const mat = new THREE.MeshBasicMaterial({
      color: 0x1c2230, transparent: true, opacity: 0.55, side: THREE.DoubleSide,
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.copy(position)
    mesh.rotation.set(...rotation)
    this._glGroup.add(mesh)
  }

  _buildIframeFace (face, position, rotation, config) {
    const pxSize = DEFAULT_EDGE * CSS_PX_PER_UNIT
    const iframe = document.createElement('iframe')
    iframe.className = 'obs-face-iframe'
    iframe.style.width = `${pxSize}px`
    iframe.style.height = `${pxSize}px`
    iframe.style.pointerEvents = 'auto'
    // Minimal permissions by default, per the sandboxing discussion —
    // this is a passive test face, not something that needs forms or popups.
    iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin')
    iframe.dataset.faceId = face.id
    this._iframeEls[face.id] = iframe

    const cssObject = new CSS3DObject(iframe)
    cssObject.position.copy(position)
    cssObject.rotation.set(...rotation)
    // Inverse-scale so the CSS-pixel-sized iframe visually matches the
    // room's actual world-unit face size, at scale 1.
    const worldScale = DEFAULT_EDGE / pxSize
    cssObject.scale.set(worldScale, worldScale, 1)
    this._cssGroup.add(cssObject)
  }

  // ── Iframe on/off — the manual face-culling mechanic ────────────────────

  _applyIframeState (faceId) {
    const iframe = this._iframeEls[faceId]
    const config = IFRAME_FACES[faceId]
    if (!iframe || !config) return
    if (this._iframeOn[faceId]) {
      if (iframe.src !== config.url) iframe.src = config.url
    } else {
      this._unloadIframe(faceId)
    }
  }

  _unloadIframe (faceId) {
    const iframe = this._iframeEls[faceId]
    if (!iframe) return
    iframe.src = 'about:blank'
  }

  _toggleIframe (faceId) {
    this._iframeOn[faceId] = !this._iframeOn[faceId]
    this._applyIframeState(faceId)
    return this._iframeOn[faceId]
  }

  // ── Grouped, live scale — cube + both iframe faces scale as one unit ────

  _setScale (scale) {
    this._scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale))
    this._glGroup.scale.set(this._scale, this._scale, this._scale)
    this._cssGroup.scale.set(this._scale, this._scale, this._scale)
  }

  // ── Minimal on-screen controls ───────────────────────────────────────────

  _buildControls () {
    const el = document.createElement('div')
    el.className = 'obs-controls'
    el.innerHTML = /* html */`
      <div class="obs-toggle-group">
        <span>Clock</span>
        <button class="obs-toggle-sm ${this._iframeOn.front ? 'is-on' : ''}" data-face-toggle="front"></button>
      </div>
      <div class="obs-toggle-group">
        <span>Wikipedia</span>
        <button class="obs-toggle-sm ${this._iframeOn.back ? 'is-on' : ''}" data-face-toggle="back"></button>
      </div>
      <div class="obs-scale-row">
        <span>Room Scale</span>
        <input type="range" class="obs-scale-slider" id="obs-scale-slider" min="${MIN_SCALE}" max="${MAX_SCALE}" step="0.05" value="1">
        <span class="obs-scale-val" id="obs-scale-val">1.00×</span>
      </div>
    `
    document.body.appendChild(el)
    this._controlsEl = el

    el.querySelectorAll('[data-face-toggle]').forEach(btn => {
      btn.addEventListener('click', () => {
        const faceId = btn.dataset.faceToggle
        const on = this._toggleIframe(faceId)
        btn.classList.toggle('is-on', on)
      })
    })

    const slider = el.querySelector('#obs-scale-slider')
    const val = el.querySelector('#obs-scale-val')
    slider.addEventListener('input', (e) => {
      const s = Number(e.target.value)
      this._setScale(s)
      val.textContent = `${s.toFixed(2)}×`
    })
  }
}
