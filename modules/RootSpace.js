/**
 * RootSpace.js — The Root cylinder environment
 *
 * Three concentric vertical cylinders — user is inside all three,
 * camera looks along the Y axis (vertical). Each layer has a
 * distinct visual role:
 *
 *   Outer  → Structural shell — bright white, solid, BackSide
 *   Middle → Identity layer — slightly translucent, subtle tint
 *   Inner  → White wireframe grid — always crisp white
 *
 * All cylinders are open-ended (openEnded: true) so the camera
 * can enter from above without hitting a cap.
 *
 * Floor grid sits at the base of the cylinder space.
 *
 * Context: { scene, camera, renderer, sizes, ticker }
 */

import * as THREE from 'three'
import gsap       from 'gsap'

// ── Cylinder constants ──────────────────────────────────────
const CYLINDER_HEIGHT   = 260
const CYLINDER_SEGMENTS = 64    // smooth curve
const CYLINDER_Y        = 28    // center offset — camera rests at Y=2, floor at Y=-102

const OUTER_RADIUS      = 38
const MIDDLE_RADIUS     = 30
const INNER_RADIUS      = 22

const FLOOR_Y           = CYLINDER_Y - CYLINDER_HEIGHT / 2   // bottom of cylinders

export default class RootSpace {
  constructor(context) {
    this.ctx     = context
    this.group   = new THREE.Group()
    this.meshes  = {}

    // ⟐OmniChronos controls — tunnel enabled/disabled with a light-
    // teleport transition, and Y-axis (default) vs Z-axis orientation.
    this._chronosEnabled = true
    this._chronosAxis = 'y'
    this._flashLight = null
    this._flashSprite = null
    this._onChronosToggle = null
    this._onChronosAxisSet = null
  }

  init() {
    this._buildOuter()
    this._buildMiddle()
    this._buildInner()
    this._buildFloor()
    this._buildTopLight()
    this._buildFlashEffect()

    this.ctx.scene.add(this.group)

    // ⟐OmniChronos — "It is time." Two toggles, dispatched from
    // ui/OmniChronos.js's Admin-style Save button (not live-per-change,
    // per that panel's explicit save pattern):
    //   omni:chronos-toggle    { enabled }  — plays the light-teleport
    //     transition in or out, Wind Waker warp / Mega Man teleport
    //     style: a bright flash from the top, then the tunnel snaps
    //     into existence (or gets yanked away).
    //   omni:chronos-axis-set  { axis: 'y'|'z' }  — reorients the whole
    //     tunnel from vertical (Y, default — "start it from the top")
    //     to Z-axis, with radius scaled 1.5x in Z mode.
    this._onChronosToggle = (e) => {
      const enabled = !!e.detail?.enabled
      if (enabled === this._chronosEnabled) return
      this._chronosEnabled = enabled
      enabled ? this._playTeleportIn() : this._playTeleportOut()
    }
    window.addEventListener('omni:chronos-toggle', this._onChronosToggle)

    this._onChronosAxisSet = (e) => {
      const axis = e.detail?.axis === 'z' ? 'z' : 'y'
      this._chronosAxis = axis
      this._applyAxis(axis)
    }
    window.addEventListener('omni:chronos-axis-set', this._onChronosAxisSet)

    // omni:chronos-transparency-set { enabled } — the real "clear and
    // almost non-existent, but there" treatment OmniChronos specifically
    // asked for. Applied only when this fires, and only to THIS
    // RootSpace instance's own materials — WallpaperSphere/
    // TerminalTunnel/VoidBoundary's own use of RootSpace keeps its
    // normal, opaque default untouched.
    this._onChronosTransparencySet = (e) => this._applyChronosTransparency(!!e.detail?.enabled)
    window.addEventListener('omni:chronos-transparency-set', this._onChronosTransparencySet)
  }

  /** A bright flash — light + a camera-facing sprite — used by both
   *  the teleport-in and teleport-out transitions. Built once, reused. */
  _buildFlashEffect() {
    this._flashLight = new THREE.PointLight(0xffffff, 0, 200, 1.0)
    this._flashLight.position.set(0, CYLINDER_Y + CYLINDER_HEIGHT * 0.48, 0)
    this.group.add(this._flashLight)

    const canvas = document.createElement('canvas')
    canvas.width = 128; canvas.height = 128
    const c2d = canvas.getContext('2d')
    const grad = c2d.createRadialGradient(64, 64, 0, 64, 64, 64)
    grad.addColorStop(0, 'rgba(255,255,255,1)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    c2d.fillStyle = grad
    c2d.fillRect(0, 0, 128, 128)

    const texture = new THREE.CanvasTexture(canvas)
    const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: 0, depthWrite: false })
    this._flashSprite = new THREE.Sprite(mat)
    this._flashSprite.scale.set(60, 60, 1)
    this._flashSprite.position.copy(this._flashLight.position)
    this.group.add(this._flashSprite)
  }

  /** Toggle ON — "light then it teleports kind of out... like an
   *  inverse of Mega Man entering a scene." A bright flash from the
   *  top, then the tunnel snaps into existence with a quick
   *  overshoot-settle, as if it just arrived. */
  _playTeleportIn() {
    this.group.visible = true
    const targetScale = this._chronosAxis === 'z' ? { x: 1.5, y: 1.5, z: 1 } : { x: 1, y: 1, z: 1 }
    const tl = gsap.timeline()
    tl.set(this.group.scale, { x: 0, y: 0, z: 0 })
    tl.to(this._flashLight, { intensity: 6, duration: 0.12, ease: 'power2.out' })
    tl.to(this._flashSprite.material, { opacity: 1, duration: 0.12, ease: 'power2.out' }, '<')
    tl.to(this.group.scale, { ...targetScale, duration: 0.5, ease: 'back.out(2.2)' }, '-=0.05')
    tl.to(this._flashLight, { intensity: 0, duration: 0.35, ease: 'power2.in' }, '-=0.35')
    tl.to(this._flashSprite.material, { opacity: 0, duration: 0.35, ease: 'power2.in' }, '<')
  }

  /** Toggle OFF — the reverse: a flash from the top, then the tunnel
   *  gets yanked up and vanishes (Wind Waker light-arrow-warp read on
   *  Mega Man's own teleport-out). */
  _playTeleportOut() {
    const tl = gsap.timeline()
    tl.to(this._flashLight, { intensity: 6, duration: 0.1, ease: 'power2.out' })
    tl.to(this._flashSprite.material, { opacity: 1, duration: 0.1, ease: 'power2.out' }, '<')
    tl.to(this.group.scale, { x: 0.02, y: 3, z: 0.02, duration: 0.22, ease: 'power3.in' }, '-=0.02')
    tl.to(this.group.scale, { x: 0, y: 0, z: 0, duration: 0.1, ease: 'power1.in' })
    tl.to(this._flashLight, { intensity: 0, duration: 0.25, ease: 'power2.in' }, '-=0.3')
    tl.to(this._flashSprite.material, { opacity: 0, duration: 0.25, ease: 'power2.in' }, '<')
    tl.set(this.group, { visible: false })
  }

  /** Reorients the tunnel: 'y' is the default (vertical, "start it
   *  from the top"); 'z' rotates the whole group 90° so the cylinders'
   *  length runs along world Z instead, with radius scaled 1.5x (the
   *  cylinders' original cross-section — X/Z locally — becomes the
   *  X/Y world plane after this rotation, so scaling X and Y is what
   *  actually grows the visible radius; the new length axis, Z, is
   *  left at 1x so the tunnel's length doesn't change). */
  _applyAxis(axis) {
    if (axis === 'z') {
      gsap.to(this.group.rotation, { x: Math.PI / 2, duration: 0.6, ease: 'power2.inOut' })
      gsap.to(this.group.scale, { x: 1.5, y: 1.5, z: 1, duration: 0.6, ease: 'power2.inOut' })
    } else {
      gsap.to(this.group.rotation, { x: 0, duration: 0.6, ease: 'power2.inOut' })
      gsap.to(this.group.scale, { x: 1, y: 1, z: 1, duration: 0.6, ease: 'power2.inOut' })
    }
  }

  /** OmniChronos's own "clear and almost non-existent, but there"
   *  treatment — real, toggleable, and reversible. Captures each
   *  material's own original opacity/emissiveIntensity the first
   *  time this runs, so turning it back off restores the exact
   *  values WallpaperSphere/TerminalTunnel/VoidBoundary already
   *  expect, rather than a guessed default. */
  _applyChronosTransparency(enabled) {
    const outerMat = this.meshes.outer?.material
    const middleMat = this.meshes.middle?.material
    if (!outerMat || !middleMat) return

    if (!this._chronosOriginalMaterialState) {
      this._chronosOriginalMaterialState = {
        outerOpacity: outerMat.opacity, outerTransparent: outerMat.transparent, outerEmissive: outerMat.emissiveIntensity,
        middleOpacity: middleMat.opacity, middleEmissive: middleMat.emissiveIntensity,
      }
    }
    const orig = this._chronosOriginalMaterialState

    if (enabled) {
      outerMat.transparent = true
      gsap.to(outerMat, { opacity: 0.06, emissiveIntensity: 0.02, duration: 0.6, ease: 'power2.inOut' })
      gsap.to(middleMat, { opacity: 0.15, emissiveIntensity: 0.015, duration: 0.6, ease: 'power2.inOut' })
    } else {
      gsap.to(outerMat, {
        opacity: orig.outerOpacity, emissiveIntensity: orig.outerEmissive, duration: 0.6, ease: 'power2.inOut',
        onComplete: () => { outerMat.transparent = orig.outerTransparent },
      })
      gsap.to(middleMat, { opacity: orig.middleOpacity, emissiveIntensity: orig.middleEmissive, duration: 0.6, ease: 'power2.inOut' })
    }
  }

  // ── Outer cylinder — structural shell ──────────────────────

  _buildOuter() {
    const geo = new THREE.CylinderGeometry(
      OUTER_RADIUS, OUTER_RADIUS,
      CYLINDER_HEIGHT,
      CYLINDER_SEGMENTS,
      4,            // heightSegments — allows subtle texture variation
      true          // openEnded
    )

    const mat = new THREE.MeshStandardMaterial({
      color:     0xffffff,
      emissive:  0xffffff,
      emissiveIntensity: 0.08,
      side:      THREE.BackSide,
      roughness: 0.85,
      metalness: 0.0,
    })

    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.y = CYLINDER_Y
    mesh.name = 'root-outer'

    this.group.add(mesh)
    this.meshes.outer = mesh
  }

  // ── Middle cylinder — visual identity layer ─────────────────

  _buildMiddle() {
    const geo = new THREE.CylinderGeometry(
      MIDDLE_RADIUS, MIDDLE_RADIUS,
      CYLINDER_HEIGHT - 2,
      CYLINDER_SEGMENTS,
      2,
      true
    )

    const mat = new THREE.MeshStandardMaterial({
      color:       0xf0f4ff,      // very faint cool white
      emissive:    0xe8eeff,
      emissiveIntensity: 0.04,
      side:        THREE.BackSide,
      transparent: true,
      opacity:     0.55,
      roughness:   0.6,
      metalness:   0.1,
    })

    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.y = CYLINDER_Y
    mesh.name = 'root-middle'

    this.group.add(mesh)
    this.meshes.middle = mesh
  }

  // ── Inner cylinder — white wireframe grid ──────────────────

  _buildInner() {
    const geo = new THREE.CylinderGeometry(
      INNER_RADIUS, INNER_RADIUS,
      CYLINDER_HEIGHT - 4,
      CYLINDER_SEGMENTS,
      24,           // many height segments → dense horizontal grid lines
      true
    )

    // EdgesGeometry to get the wireframe lines cleanly
    const edges = new THREE.EdgesGeometry(geo)
    const mat   = new THREE.LineBasicMaterial({
      color:       0xffffff,
      transparent: true,
      opacity:     0.18,
    })

    const wireframe = new THREE.LineSegments(edges, mat)
    wireframe.position.y = CYLINDER_Y
    wireframe.name = 'root-inner-grid'

    this.group.add(wireframe)
    this.meshes.innerGrid = wireframe
  }

  // ── Floor grid ──────────────────────────────────────────────

  _buildFloor() {
    // GridHelper — 2D grid at the base
    const grid = new THREE.GridHelper(
      OUTER_RADIUS * 2,   // total size — matches outer diameter
      24,                 // divisions
      0xffffff,           // center line color
      0xffffff            // grid line color
    )

    // Tint grid lines — very subtle so they don't dominate
    grid.material.transparent = true
    grid.material.opacity     = 0.12
    grid.position.y           = FLOOR_Y
    grid.name = 'root-floor-grid'

    this.group.add(grid)
    this.meshes.floor = grid

    // Solid floor disc — gives the space a defined base plane
    const discGeo = new THREE.CircleGeometry(OUTER_RADIUS, CYLINDER_SEGMENTS)
    const discMat = new THREE.MeshStandardMaterial({
      color:     0xffffff,
      roughness: 0.9,
      metalness: 0.0,
    })

    const disc = new THREE.Mesh(discGeo, discMat)
    disc.rotation.x = -Math.PI / 2
    disc.position.y  = FLOOR_Y - 0.01   // just below the grid to avoid z-fighting
    disc.receiveShadow = true
    disc.name = 'root-floor-disc'

    this.group.add(disc)
    this.meshes.floorDisc = disc
  }

  // ── Top fill light — keeps the interior luminous ────────────

  _buildTopLight() {
    // Point light near the top of the cylinder
    const top = new THREE.PointLight(0xffffff, 3.0, 120, 1.2)
    top.position.set(0, CYLINDER_Y + CYLINDER_HEIGHT * 0.3, 0)
    this.group.add(top)

    // Center fill — makes the middle bright even without camera proximity
    const center = new THREE.PointLight(0xeeeeff, 2.0, 80, 1.0)
    center.position.set(0, CYLINDER_Y, 0)
    this.group.add(center)

    // Floor bounce — subtle warmth from below
    const floor = new THREE.PointLight(0xffffff, 0.8, 60, 1.5)
    floor.position.set(0, FLOOR_Y + 5, 0)
    this.group.add(floor)

    this.lights = { top, center, floor }
  }

  update() {
    // Static geometry — no per-frame update needed
  }

  destroy() {
    window.removeEventListener('omni:chronos-toggle', this._onChronosToggle)
    window.removeEventListener('omni:chronos-axis-set', this._onChronosAxisSet)
    window.removeEventListener('omni:chronos-transparency-set', this._onChronosTransparencySet)

    // Dispose all geometries + materials (+ any texture maps, e.g. the
    // flash sprite's canvas texture)
    this.group.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose()
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
        mats.forEach(m => { m.map?.dispose(); m.dispose() })
      }
    })

    this.ctx.scene.remove(this.group)
  }
}
