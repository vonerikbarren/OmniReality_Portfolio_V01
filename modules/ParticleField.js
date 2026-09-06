/**
 * ParticleField.js — Ambient particle system inside the Root
 *
 * A soft cloud of ~1800 particles distributed throughout the cylinder
 * interior. Each particle drifts slowly — a mix of gentle vertical
 * oscillation and lateral rotation, making the space feel alive
 * without being distracting.
 *
 * Motion strategy:
 *   - Particles are stored as Float32Array positions
 *   - Each particle has a unique phase offset and drift speed
 *   - Positions updated via update(delta) — no GSAP per-particle
 *     (too many tweens). Instead a fast JS loop each frame.
 *
 * Rendering:
 *   - CanvasTexture radial gradient — bright core fading to transparent edge
 *   - AdditiveBlending — overlapping particles add brightness (shiny glow)
 *   - alphaMap drives the soft circular falloff, eliminating square corners
 *
 * Context: { scene, camera, renderer, sizes, ticker }
 */

import * as THREE from 'three'

const DEFAULT_COUNT  = 2200   // "a little more" — bumped from 1800, staying clearly below Spread's 3000
const SPREAD_COUNT    = 3000   // "slightly increase the number... to fit the space"
const CONDENSED_COUNT = 1800

const DEFAULT_INNER_RADIUS = 20     // original — stays within the inner wireframe cylinder
const SPREAD_INNER_RADIUS  = 850    // reaches out toward the wallpaper sphere's own scale
const CONDENSED_RADIUS     = 45     // a small, distinct sphere near the origin

// Raised so the floor sits right at the user's actual starting camera
// height (y=2 — see main.js's returnToLanding()), not the old -98,
// which was centered on the world's abstract vertical midpoint (28,
// shared with WallpaperSphere/VoidBoundary) rather than where anyone
// actually begins. Most of that old range sat below where a user
// would ever naturally be at the start of the experience — this puts
// particles immediately present from the first moment instead.
const MIN_Y          = 0     // floor of particle volume (default/spread modes)
const MAX_Y          = 250   // top of particle volume (default/spread modes)
const SPREAD_MIN_Y   = -900
const SPREAD_MAX_Y   = 900

export default class ParticleField {
  constructor(context) {
    this.ctx    = context
    this.points = null
    this._meta  = null   // per-particle motion metadata
    this._time  = 0
    this._count = DEFAULT_COUNT

    this._mode = 'default'   // 'default' | 'spread' | 'condensed'
    this._condensedRotate = { x: false, y: false, z: true }
    this._condensedSpeed  = 0.1

    this._onSettingsSet = null
  }

  init() {
    this._buildParticles(this._mode)
    this.ctx.scene.add(this.points)

    // From ui/ParticleSettingsPanel.js (Admin02) — a partial patch,
    // only whichever keys actually changed.
    this._onSettingsSet = (e) => {
      const patch = e.detail ?? {}
      let needsRebuild = false

      if (patch.mode !== undefined && patch.mode !== this._mode) {
        this._mode = patch.mode
        needsRebuild = true
      }
      if (patch.rotateX !== undefined) this._condensedRotate.x = patch.rotateX
      if (patch.rotateY !== undefined) this._condensedRotate.y = patch.rotateY
      if (patch.rotateZ !== undefined) this._condensedRotate.z = patch.rotateZ
      if (patch.speed   !== undefined) this._condensedSpeed = patch.speed

      if (needsRebuild) this._rebuild()
    }
    window.addEventListener('omni:particle-settings-set', this._onSettingsSet)
  }

  /** Tears down and recreates the whole Points object for a mode
   *  switch — happens rarely (a user picking a mode in the settings
   *  panel), so simplicity here matters more than avoiding a rebuild;
   *  the three modes need genuinely different particle counts and
   *  distributions, not just different per-frame motion. */
  _rebuild () {
    const wasInScene = !!this.points
    if (wasInScene) {
      this.ctx.scene.remove(this.points)
      this.points.geometry.dispose()
      this.points.material.dispose()
    }
    this._buildParticles(this._mode)
    if (wasInScene) this.ctx.scene.add(this.points)
  }

  // ── Orb texture ────────────────────────────────────────────────────────────

  _makeOrbTexture() {
    const SIZE   = 64
    const canvas = document.createElement('canvas')
    canvas.width = SIZE
    canvas.height = SIZE
    const ctx = canvas.getContext('2d')

    // Radial gradient — bright white core fading to fully transparent edge
    const gradient = ctx.createRadialGradient(
      SIZE / 2, SIZE / 2, 0,       // inner circle center + radius
      SIZE / 2, SIZE / 2, SIZE / 2 // outer circle center + radius
    )
    gradient.addColorStop(0.00, 'rgba(255, 255, 255, 1.0)')  // bright core
    gradient.addColorStop(0.20, 'rgba(255, 255, 255, 0.85)') // inner glow
    gradient.addColorStop(0.50, 'rgba(255, 255, 255, 0.25)') // soft falloff
    gradient.addColorStop(0.80, 'rgba(255, 255, 255, 0.05)') // near edge
    gradient.addColorStop(1.00, 'rgba(255, 255, 255, 0.00)') // transparent edge

    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, SIZE, SIZE)

    return new THREE.CanvasTexture(canvas)
  }

  // ── Particle geometry + material ───────────────────────────────────────────

  _buildParticles(mode = 'default') {
    this._orbTex?.dispose()

    const count = mode === 'spread' ? SPREAD_COUNT : mode === 'condensed' ? CONDENSED_COUNT : DEFAULT_COUNT
    this._count = count

    const positions = new Float32Array(count * 3)

    // Per-particle motion metadata — stored once, used every frame
    this._meta = new Float32Array(count * 4)
    // [i*4 + 0] = base angle (radians around Y axis) — default/spread only
    // [i*4 + 1] = base radius (distance from Y axis, or from center for condensed)
    // [i*4 + 2] = base Y (default/spread) or base polar angle (condensed)
    // [i*4 + 3] = phase offset (unique oscillation timing)

    if (mode === 'condensed') {
      // Spherical distribution — a small, distinct sphere near the
      // origin, rather than filling the cylinder volume like the
      // other two modes. Auto-rotation (see update()) spins this
      // whole sphere as a rigid body, so per-particle drift stays
      // subtle here — the rotation is the main motion.
      for (let i = 0; i < count; i++) {
        const theta  = Math.random() * Math.PI * 2       // azimuthal
        const phi    = Math.acos(2 * Math.random() - 1)  // polar, uniform on sphere
        const r      = CONDENSED_RADIUS * Math.cbrt(Math.random())  // uniform within volume, not just surface
        const phase  = Math.random() * Math.PI * 2

        positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta)
        positions[i * 3 + 1] = r * Math.cos(phi)
        positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta)

        this._meta[i * 4]     = theta
        this._meta[i * 4 + 1] = r
        this._meta[i * 4 + 2] = phi
        this._meta[i * 4 + 3] = phase
      }
    } else {
      const innerRadius = mode === 'spread' ? SPREAD_INNER_RADIUS : DEFAULT_INNER_RADIUS
      const minY = mode === 'spread' ? SPREAD_MIN_Y : MIN_Y
      const maxY = mode === 'spread' ? SPREAD_MAX_Y : MAX_Y

      for (let i = 0; i < count; i++) {
        const angle  = Math.random() * Math.PI * 2
        const radius = Math.random() * innerRadius * 0.9
        const y      = minY + Math.random() * (maxY - minY)
        const phase  = Math.random() * Math.PI * 2

        positions[i * 3]     = Math.cos(angle) * radius
        positions[i * 3 + 1] = y
        positions[i * 3 + 2] = Math.sin(angle) * radius

        this._meta[i * 4]     = angle
        this._meta[i * 4 + 1] = radius
        this._meta[i * 4 + 2] = y
        this._meta[i * 4 + 3] = phase
      }
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))

    // Generate the orb texture once
    this._orbTex = this._makeOrbTexture()

    const mat = new THREE.PointsMaterial({
      color:           0xffffff,
      size:            0.30,           // slightly larger so orb shape reads clearly
      sizeAttenuation: true,
      transparent:     true,
      opacity:         0.75,
      depthWrite:      false,
      map:             this._orbTex,   // drives color + shape
      alphaMap:        this._orbTex,   // drives per-pixel transparency
      blending:        THREE.AdditiveBlending,  // overlapping orbs add glow
    })

    this.points = new THREE.Points(geo, mat)
    this.points.name = 'root-particles'
  }

  // ── Per-frame update ───────────────────────────────────────────────────────

  update(delta) {
    this._time += delta

    const positions = this.points.geometry.attributes.position.array
    const t         = this._time

    if (this._mode === 'condensed') {
      for (let i = 0; i < this._count; i++) {
        const theta = this._meta[i * 4]
        const r     = this._meta[i * 4 + 1]
        const phi   = this._meta[i * 4 + 2]
        const phase = this._meta[i * 4 + 3]

        // Gentle radius breathing only — rotation of the whole group
        // (below) is the main motion in this mode, individual drift
        // stays subtle so it doesn't fight the rigid-body rotation.
        const rr = r + Math.sin(t * 0.4 + phase) * 0.15

        positions[i * 3]     = rr * Math.sin(phi) * Math.cos(theta)
        positions[i * 3 + 1] = rr * Math.cos(phi)
        positions[i * 3 + 2] = rr * Math.sin(phi) * Math.sin(theta)
      }

      const spin = this._condensedSpeed * delta
      if (this._condensedRotate.x) this.points.rotation.x += spin
      if (this._condensedRotate.y) this.points.rotation.y += spin
      if (this._condensedRotate.z) this.points.rotation.z += spin
    } else {
      for (let i = 0; i < this._count; i++) {
        const baseAngle  = this._meta[i * 4]
        const baseRadius = this._meta[i * 4 + 1]
        const baseY      = this._meta[i * 4 + 2]
        const phase      = this._meta[i * 4 + 3]

        // Slow angular drift around Y axis
        const angle = baseAngle + t * 0.025 + phase * 0.01

        // Gentle radius breathing
        const r = baseRadius + Math.sin(t * 0.4 + phase) * 0.4

        // Vertical oscillation — very slow, per-particle phase
        const yOff = Math.sin(t * 0.18 + phase) * 1.2

        positions[i * 3]     = Math.cos(angle) * r
        positions[i * 3 + 1] = baseY + yOff
        positions[i * 3 + 2] = Math.sin(angle) * r
      }
    }

    this.points.geometry.attributes.position.needsUpdate = true
  }

  // ── Teardown ───────────────────────────────────────────────────────────────

  destroy() {
    window.removeEventListener('omni:particle-settings-set', this._onSettingsSet)
    this._orbTex?.dispose()
    this.points.geometry.dispose()
    this.points.material.dispose()
    this.ctx.scene.remove(this.points)
  }
}