/**
 * modules/WallpaperSphere.js — ⟐mniReality Space Wallpaper
 *
 * A solid (not wireframe) shape sitting just outside VoidBoundary's
 * wireframe sphere — the "wallpaper" backdrop of the main space. Uses
 * THREE.BackSide so it renders as a backdrop from inside, same
 * technique as VoidBoundary. Despite the class name (kept for
 * continuity), the actual shape is now configurable — "sphere" was
 * just the original, and only, option.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Settings now live in ui/WallpaperSettingsPanel.js (Admin03), not here
 * ─────────────────────────────────────────────────────────────────────────────
 * Color/alpha/rotation/spin used to be configured from the main Admin
 * panel. They've moved to their own dedicated panel, consolidated with
 * the new shape/position/rotation/scale controls and the 20-slot
 * wallpaper browser, rather than splitting wallpaper options across
 * two places. This module reads from `omni:wallpaper:settings` and
 * listens for `omni:wallpaper-settings-set` now.
 *
 * One-time migration: if `omni:wallpaper:settings` doesn't exist yet
 * but the old `omni:admin:settings.wallpaper` does, this seeds the new
 * settings from the old ones on first load — so nobody who already had
 * a wallpaper configured loses it just because the settings moved.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Shape options — curated, not "every THREE.js geometry"
 * ─────────────────────────────────────────────────────────────────────────────
 * Box, Sphere, Cylinder, Cone, Torus, TorusKnot, Octahedron,
 * Tetrahedron, Icosahedron, Dodecahedron, Capsule — all closed,
 * parameter-free (radius-only) primitives that scale cleanly to world
 * size. Deliberately excludes Plane/Circle/Ring (flat, no "inside" to
 * stand in) and the hand-authored Lathe/Tube/Extrude/Shape geometries
 * (their exact form depends on custom control points that don't scale
 * sensibly to an arbitrary world-enveloping size).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * The "image never shows up" bug — actual root cause (kept from before)
 * ─────────────────────────────────────────────────────────────────────────────
 * This was never a texture-loading problem. VoidBoundary's grid sphere
 * sits just inside this shape and is wireframe + transparent — but
 * wireframe rendering only changes what gets DRAWN, not what gets
 * written to the depth buffer. Three.js still writes depth across that
 * sphere's FULL triangle surface, not just the visible lines, so
 * without depthWrite:false it silently occluded this shape behind it —
 * texture loaded fine, it just could never be seen. Fixed with
 * depthWrite:false + explicit renderOrder on all three concentric
 * shells (cube/domain-grid/wallpaper) so they always draw back-to-front
 * regardless of Three.js's automatic transparent-object sorting, which
 * isn't reliable for objects centered at the exact same point.
 *
 * Follows the standard module contract (constructor / init / update / destroy).
 */

import * as THREE from 'three'
import { loadWallpaper, wallpaperVideoStore } from '../utils/WallpaperStorage.js'

// wallpaperVideoStore now has the same 20 slots as the image browser
// (previously a single-slot, maxSlots=1 store, always slot 1) — see
// utils/WallpaperStorage.js. this._activeVideoSlot (default 1) tracks
// which one is currently active, same role activeSlot plays for images.
const DEFAULT_VIDEO_SLOT = 1

const CENTER_Y = 28        // matches VoidBoundary / RootSpace
const BASE_SIZE = 1050     // 5x — the space should feel genuinely massive; same scale as before

const DEFAULT_COLOR   = '#445566'
const DEFAULT_ALPHA   = 0.9
const DEFAULT_IMG_URL = './assets/images/wallpaper-default.jpg'
const DEFAULT_SHAPE   = 'SphereGeometry'

const STORE_KEY = 'omni:wallpaper:settings'

const SHAPE_BUILDERS = {
  BoxGeometry:          (s) => new THREE.BoxGeometry(s * 1.7, s * 1.7, s * 1.7),
  SphereGeometry:       (s) => new THREE.SphereGeometry(s, 32, 32),
  CylinderGeometry:     (s) => new THREE.CylinderGeometry(s, s, s * 2, 32),
  ConeGeometry:         (s) => new THREE.ConeGeometry(s, s * 2, 32),
  TorusGeometry:        (s) => new THREE.TorusGeometry(s * 0.75, s * 0.3, 16, 48),
  TorusKnotGeometry:    (s) => new THREE.TorusKnotGeometry(s * 0.6, s * 0.2, 128, 16),
  OctahedronGeometry:   (s) => new THREE.OctahedronGeometry(s),
  TetrahedronGeometry:  (s) => new THREE.TetrahedronGeometry(s),
  IcosahedronGeometry:  (s) => new THREE.IcosahedronGeometry(s, 1),
  DodecahedronGeometry: (s) => new THREE.DodecahedronGeometry(s),
  CapsuleGeometry:      (s) => new THREE.CapsuleGeometry(s * 0.6, s, 16, 32),
}
export const WALLPAPER_SHAPES = Object.keys(SHAPE_BUILDERS)

function readAdminSettings () {
  try {
    const raw = localStorage.getItem('omni:admin:settings')
    return raw ? JSON.parse(raw) : null
  } catch (_) { return null }
}

function readWallpaperSettings () {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (raw) return JSON.parse(raw)
  } catch (_) { /* fall through to migration */ }

  // One-time migration from the old Admin-panel wallpaper group.
  const oldWallpaper = readAdminSettings()?.wallpaper
  const migrated = {
    shape: DEFAULT_SHAPE,
    color: oldWallpaper?.color ?? DEFAULT_COLOR,
    alpha: oldWallpaper?.alpha ?? DEFAULT_ALPHA,
    imgUrl: oldWallpaper?.imgUrl ?? DEFAULT_IMG_URL,
    activeSlot: null,   // null = using imgUrl/default, not a stored wallpaper-browser slot
    rotationSpeed: oldWallpaper?.rotationSpeed ?? 0.05,
    autoSpinX: oldWallpaper?.autoSpinX ?? false,
    autoSpinY: oldWallpaper?.autoSpinY ?? true,
    autoSpinZ: oldWallpaper?.autoSpinZ ?? true,
    position: { x: 0, y: 0, z: 0 },
    rotationOffset: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    videoActive: false, videoLoop: true, videoMuted: true, videoVolume: 0, activeVideoSlot: null,
  }
  try { localStorage.setItem(STORE_KEY, JSON.stringify(migrated)) } catch (_) {}
  return migrated
}

export default class WallpaperSphere {
  constructor (context) {
    this.ctx = context
    this._mesh = null
    this._shape = DEFAULT_SHAPE
    this._texture = null
    this._loader = new THREE.TextureLoader()
    this._imgUrl = ''
    this._imgUrlIsObjectUrl = false

    // Video wallpaper — separate from the image texture above; when
    // active, its texture takes priority as material.map (mutual
    // exclusivity, same rule BACKLOG.md already calls for on
    // ObjectPanel's video/image toggle). The image URL/texture is kept
    // around, not torn down, so clearing the video falls straight back
    // to whatever image or color was set before it.
    this._videoEl = null
    this._videoTexture = null
    this._videoUrl = ''
    this._videoUrlIsObjectUrl = false
    this._videoActive = false
    this._videoLoop = true
    this._videoMuted = true
    this._videoVolume = 0
    this._activeVideoSlot = null

    this._onSettingsSet = null
    this._onSpinDirection = null

    this._rotationSpeed = 0
    this._spinX = false
    this._spinY = false
    this._spinZ = false
    this._direction = 1   // flipped live by '(' / ')', not persisted

    this._position = { x: 0, y: 0, z: 0 }
    this._rotationOffset = { x: 0, y: 0, z: 0 }
    this._scale = { x: 1, y: 1, z: 1 }
  }

  init () {
    const saved = readWallpaperSettings()

    this._shape = saved.shape ?? DEFAULT_SHAPE
    this._buildMesh(this._shape, saved.alpha ?? DEFAULT_ALPHA)

    this._rotationSpeed = saved.rotationSpeed ?? 0.05
    this._spinX = saved.autoSpinX ?? false
    this._spinY = saved.autoSpinY ?? true
    this._spinZ = saved.autoSpinZ ?? true

    this._position = { ...(saved.position ?? { x: 0, y: 0, z: 0 }) }
    this._rotationOffset = { ...(saved.rotationOffset ?? { x: 0, y: 0, z: 0 }) }
    this._scale = { ...(saved.scale ?? { x: 1, y: 1, z: 1 }) }
    this._applyTransform()

    if (saved.activeSlot) {
      this._applyFromSlot(saved.activeSlot)
    } else {
      // Using || rather than ?? deliberately: a previously-saved EMPTY
      // STRING must also fall through to the default, not just
      // null/undefined — this was the actual bug behind the starfield
      // never appearing, from before this file's last rewrite.
      this._applyImage(saved.imgUrl || DEFAULT_IMG_URL)
      if (!saved.imgUrl) this._mesh.material.color.set(saved.color ?? DEFAULT_COLOR)
    }

    this._videoLoop = saved.videoLoop ?? true
    this._videoMuted = saved.videoMuted ?? true
    this._videoVolume = saved.videoVolume ?? 0
    // Migration: an install saved before slots existed has
    // videoActive:true with no activeVideoSlot at all — that video is
    // really sitting in slot 1 (the old single-slot store's only slot).
    this._activeVideoSlot = saved.activeVideoSlot ?? (saved.videoActive ? DEFAULT_VIDEO_SLOT : null)
    if (saved.videoActive) this._loadVideoFromStore()

    this._onSettingsSet = (e) => {
      const w = e.detail ?? {}
      if (w.shape !== undefined && w.shape !== this._shape) this._changeShape(w.shape)
      if (w.alpha !== undefined) this._mesh.material.opacity = w.alpha
      if (w.rotationSpeed !== undefined) this._rotationSpeed = w.rotationSpeed
      if (w.autoSpinX !== undefined) this._spinX = w.autoSpinX
      if (w.autoSpinY !== undefined) this._spinY = w.autoSpinY
      if (w.autoSpinZ !== undefined) this._spinZ = w.autoSpinZ
      if (w.position) { this._position = { ...this._position, ...w.position }; this._applyTransform() }
      if (w.rotationOffset) { this._rotationOffset = { ...this._rotationOffset, ...w.rotationOffset }; this._applyTransform() }
      if (w.scale) { this._scale = { ...this._scale, ...w.scale }; this._applyTransform() }
      if (w.imgUrl) this._applyImage(w.imgUrl)
      else if (w.imgUrl === '') this._clearImage(w.color ?? DEFAULT_COLOR)
      else if (w.color !== undefined && !this._texture) this._mesh.material.color.set(w.color)
      if (w.activeSlot) this._applyFromSlot(w.activeSlot)

      // ── Video wallpaper ──────────────────────────────────────────
      if (w.activeVideoSlot) this._applyVideoFromSlot(w.activeVideoSlot)
      else if (w.videoUrl) this._applyVideo(w.videoUrl, !!w.videoUrlIsObjectUrl)
      else if (w.videoUrl === '') this._clearVideo()
      if (w.videoLoop !== undefined) {
        this._videoLoop = w.videoLoop
        if (this._videoEl) this._videoEl.loop = w.videoLoop
      }
      if (w.videoMuted !== undefined) {
        this._videoMuted = w.videoMuted
        if (this._videoEl) this._videoEl.muted = w.videoMuted
      }
      if (w.videoVolume !== undefined) {
        this._videoVolume = w.videoVolume
        if (this._videoEl) this._videoEl.volume = w.videoVolume
      }
      if (w.videoPlaying !== undefined && this._videoEl) {
        if (w.videoPlaying) this._videoEl.play().catch(() => {})
        else this._videoEl.pause()
      }
    }
    window.addEventListener('omni:wallpaper-settings-set', this._onSettingsSet)

    // '(' / ')' quick direction override — see main.js
    this._onSpinDirection = (e) => {
      this._direction = e.detail?.direction ?? 1
      if (!this._spinX && !this._spinY && !this._spinZ) this._spinY = true
      if (!this._rotationSpeed) this._rotationSpeed = 0.3
    }
    window.addEventListener('omni:wallpaper-spin-direction', this._onSpinDirection)
  }

  /** Builds the mesh fresh for a given shape — used at init and
   *  whenever the shape changes, since geometry type can't be swapped
   *  in place the way a texture or color can. */
  _buildMesh (shape, alpha) {
    const builder = SHAPE_BUILDERS[shape] ?? SHAPE_BUILDERS[DEFAULT_SHAPE]
    const geo = builder(BASE_SIZE)
    const mat = new THREE.MeshBasicMaterial({
      color: DEFAULT_COLOR,
      transparent: true,
      opacity: alpha,
      side: THREE.BackSide,
      depthWrite: false,
    })
    this._mesh = new THREE.Mesh(geo, mat)
    this._mesh.renderOrder = -2   // between the cube (-3) and domain grid (-1)
    this.ctx.scene.add(this._mesh)
  }

  _changeShape (shape) {
    if (!SHAPE_BUILDERS[shape]) return
    const prevAlpha = this._mesh.material.opacity
    const prevTexture = this._texture
    const prevColor = this._mesh.material.color.clone()

    this.ctx.scene.remove(this._mesh)
    this._mesh.geometry.dispose()
    this._mesh.material.dispose()

    this._shape = shape
    this._buildMesh(shape, prevAlpha)
    if (prevTexture) {
      this._mesh.material.map = prevTexture
      this._mesh.material.color.set(0xffffff)
    } else {
      this._mesh.material.color.copy(prevColor)
    }
    this._mesh.material.needsUpdate = true
    this._applyTransform()
  }

  /** Position/rotation offset/scale are all applied on top of the
   *  shape's own base placement (centered at CENTER_Y) — a Position of
   *  (0,0,0) means "no additional offset," not "at the world origin." */
  _applyTransform () {
    if (!this._mesh) return
    this._mesh.position.set(
      this._position.x,
      CENTER_Y + this._position.y,
      this._position.z,
    )
    this._mesh.rotation.set(this._rotationOffset.x, this._rotationOffset.y, this._rotationOffset.z)
    this._mesh.scale.set(this._scale.x, this._scale.y, this._scale.z)
  }

  async _applyFromSlot (slot) {
    try {
      const record = await loadWallpaper(slot)
      if (!record) {
        // Real fix — this used to return here with zero logging, no
        // way to tell "no wallpaper was ever saved to this slot"
        // apart from "a real read failure happened." Safari's own
        // IndexedDB implementation has a real, documented history of
        // blob-storage bugs specifically — this warning is the
        // direct way to confirm whether that's what's happening here,
        // rather than guessing at it from the visual symptom alone.
        console.warn(`⟐WallpaperSphere — slot ${slot} was requested but came back empty. If a wallpaper was genuinely saved to this slot before, this may be Safari's own known IndexedDB blob-storage issue rather than a real missing save.`)
        return
      }
      const url = URL.createObjectURL(record.blob)
      this._applyImage(url, /* isObjectUrl */ true)
    } catch (err) {
      console.warn('⟐WallpaperSphere — failed to load wallpaper slot', slot, err)
    }
  }

  /** Real fix, applies to every texture this module ever shows (image
   *  or video): this sphere is rendered THREE.BackSide — visible from
   *  inside, not outside. A standard sphere UV unwrap looks correct
   *  from outside, but the same UVs read mirrored left-right once
   *  you're looking at the geometry from the inside instead (the same
   *  reason text printed on a flag reads backwards from behind it).
   *  Negative-repeat on U is the standard fix — flips sampling
   *  horizontally without touching geometry/winding. Unnoticeable on
   *  most photos, which is why this went uncaught until video (where
   *  motion/on-screen text/faces make a mirrored image obvious). */
  _flipForInteriorView (texture) {
    texture.wrapS = THREE.RepeatWrapping
    texture.repeat.x = -1
    return texture
  }

  /** Loads and applies an image texture — used for the default asset,
   *  a regular URL, a data: URI, or an Object URL from the IndexedDB
   *  wallpaper browser (all handled the same way by TextureLoader).
   *  Still loads/stores the texture even while a video is active (so
   *  it's ready the instant the video is cleared) — it just doesn't
   *  touch the live material.map until then, since video takes
   *  priority per the same mutual-exclusivity rule BACKLOG.md already
   *  calls for on ObjectPanel's video/image toggle. */
  _applyImage (url, isObjectUrl = false) {
    if (!url || url === this._imgUrl) return
    this._loader.load(
      url,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace
        this._flipForInteriorView(texture)
        this._texture?.dispose()
        if (this._imgUrlIsObjectUrl) URL.revokeObjectURL(this._imgUrl)
        this._texture = texture
        this._imgUrl = url
        this._imgUrlIsObjectUrl = isObjectUrl
        if (this._videoActive) return   // video stays on top — texture is ready for when it's cleared
        this._mesh.material.map = texture
        this._mesh.material.color.set(0xffffff)   // true color — don't tint the photo
        this._mesh.material.needsUpdate = true
      },
      undefined,
      (err) => console.warn('⟐WallpaperSphere — failed to load image:', url, err)
    )
  }

  _clearImage (fallbackColor) {
    this._texture?.dispose()
    if (this._imgUrlIsObjectUrl) URL.revokeObjectURL(this._imgUrl)
    this._texture = null
    this._imgUrl = ''
    if (this._videoActive) return   // don't touch the live material — video owns it right now
    this._mesh.material.map = null
    this._mesh.material.color.set(fallbackColor)
    this._mesh.material.needsUpdate = true
  }

  // ── Video wallpaper ────────────────────────────────────────────────────

  /** Boot-time restore — mirrors _applyFromSlot's image equivalent,
   *  reading whichever slot this._activeVideoSlot points at from the
   *  IndexedDB video store rather than a data URI (a real video is far
   *  too large for localStorage/data: URIs, same reasoning
   *  WallpaperStorage.js documents for the image browser). */
  async _loadVideoFromStore () {
    const slot = this._activeVideoSlot ?? DEFAULT_VIDEO_SLOT
    try {
      const record = await wallpaperVideoStore.loadWallpaper(slot)
      if (!record) {
        console.warn('⟐WallpaperSphere — videoActive was true but no video is stored in slot', slot, '— clearing the flag.')
        this._commitVideoActive(false)
        return
      }
      this._applyVideo(URL.createObjectURL(record.blob), /* isObjectUrl */ true)
    } catch (err) {
      console.warn('⟐WallpaperSphere — failed to load stored video wallpaper:', err)
    }
  }

  /** Live slot switch — dispatched by ui/WallpaperSettingsPanel.js's
   *  video slot grid exactly the way `activeSlot` triggers
   *  `_applyFromSlot` for images. */
  async _applyVideoFromSlot (slot) {
    this._activeVideoSlot = slot
    try {
      const record = await wallpaperVideoStore.loadWallpaper(slot)
      if (!record) {
        console.warn('⟐WallpaperSphere — video slot', slot, 'was requested but came back empty.')
        return
      }
      this._applyVideo(URL.createObjectURL(record.blob), /* isObjectUrl */ true)
      this._commitVideoActive(true, slot)
    } catch (err) {
      console.warn('⟐WallpaperSphere — failed to load video slot', slot, err)
    }
  }

  _commitVideoActive (active, slot = this._activeVideoSlot) {
    try {
      const raw = localStorage.getItem(STORE_KEY)
      const s = raw ? JSON.parse(raw) : {}
      s.videoActive = active
      if (slot != null) s.activeVideoSlot = slot
      localStorage.setItem(STORE_KEY, JSON.stringify(s))
    } catch (_) { /* non-fatal — worst case it re-prompts next boot */ }
  }

  /**
   * Builds a real HTMLVideoElement + THREE.VideoTexture — same
   * loop/muted/playsInline/crossOrigin setup ui/OmniExpression.js's
   * `_loadMedia('video')` already established elsewhere in this app,
   * kept consistent rather than reinvented here. `muted` starts true
   * unconditionally on first load regardless of the saved preference —
   * every browser blocks autoplay-with-sound outright, so an unmuted
   * `.play()` would silently fail to start at all; the saved
   * `_videoMuted`/`_videoVolume` are applied right after, once the
   * element already exists and playback has actually begun.
   */
  _applyVideo (url, isObjectUrl = false) {
    if (!url) return
    this._disposeVideo(/* keepFlagged */ true)

    const video = document.createElement('video')
    video.src = url
    video.loop = this._videoLoop
    video.muted = true
    video.playsInline = true
    video.crossOrigin = 'anonymous'
    video.play().catch(() => {})   // ignore autoplay-blocked errors — still loads, just paused until a user gesture

    video.addEventListener('loadedmetadata', () => {
      video.muted = this._videoMuted
      video.volume = this._videoVolume
      if (video.videoWidth && video.videoHeight) {
        const ratio = video.videoWidth / video.videoHeight
        if (Math.abs(ratio - 2) > 0.1) {
          console.warn(`⟐WallpaperSphere — this video is ${video.videoWidth}×${video.videoHeight} (${ratio.toFixed(2)}:1). This sphere's UV unwrap is equirectangular, so a 2:1 width:height video maps without stretching — this one will look vertically stretched or squished. See ui/WallpaperSettingsPanel.js's Video section note.`)
        }
      }
    }, { once: true })

    this._videoEl = video
    this._videoUrl = url
    this._videoUrlIsObjectUrl = isObjectUrl
    this._videoActive = true
    this._commitVideoActive(true)

    const texture = new THREE.VideoTexture(video)
    texture.colorSpace = THREE.SRGBColorSpace
    this._flipForInteriorView(texture)
    this._videoTexture = texture
    this._mesh.material.map = texture
    this._mesh.material.color.set(0xffffff)
    this._mesh.material.needsUpdate = true
  }

  /** @param {boolean} keepFlagged — true while _applyVideo is about to
   *  immediately replace the video (avoids a one-frame flash back to
   *  the underlying image/color); false for a real, user-requested clear. */
  _disposeVideo (keepFlagged = false) {
    if (this._videoEl) {
      this._videoEl.pause()
      this._videoEl.src = ''
      this._videoEl.load()
      this._videoEl = null
    }
    this._videoTexture?.dispose()
    this._videoTexture = null
    if (this._videoUrlIsObjectUrl) URL.revokeObjectURL(this._videoUrl)
    this._videoUrl = ''
    if (!keepFlagged) this._videoActive = false
  }

  _clearVideo () {
    this._disposeVideo(false)
    this._commitVideoActive(false)
    // Fall back to whatever image/color was already loaded — same
    // texture _applyImage kept ready in the background the whole time.
    if (this._texture) {
      this._mesh.material.map = this._texture
      this._mesh.material.color.set(0xffffff)
    } else {
      this._mesh.material.map = null
      this._mesh.material.color.set(DEFAULT_COLOR)
    }
    this._mesh.material.needsUpdate = true
  }

  update (delta) {
    if (!this._mesh) return
    if (!this._spinX && !this._spinY && !this._spinZ) return
    const amount = this._rotationSpeed * this._direction * delta
    if (this._spinX) this._mesh.rotation.x += amount
    if (this._spinY) this._mesh.rotation.y += amount
    if (this._spinZ) this._mesh.rotation.z += amount
  }
  onResize () {}

  destroy () {
    window.removeEventListener('omni:wallpaper-settings-set', this._onSettingsSet)
    window.removeEventListener('omni:wallpaper-spin-direction', this._onSpinDirection)
    this._texture?.dispose()
    if (this._imgUrlIsObjectUrl) URL.revokeObjectURL(this._imgUrl)
    this._disposeVideo(false)
    if (!this._mesh) return
    this.ctx.scene.remove(this._mesh)
    this._mesh.geometry.dispose()
    this._mesh.material.dispose()
  }
}
