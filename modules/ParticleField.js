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
 * Context: { scene, camera, renderer, sizes, ticker }
 */

import * as THREE from 'three'

const PARTICLE_COUNT = 1800
const INNER_RADIUS   = 20    // stay within the inner wireframe cylinder
const MIN_Y          = -98   // floor of particle volume
const MAX_Y          = 155   // top of particle volume

export default class ParticleField {
  constructor(context) {
    this.ctx    = context
    this.points = null
    this._meta  = null   // per-particle motion metadata
    this._time  = 0
  }

  init() {
    this._buildParticles()
    this.ctx.scene.add(this.points)
  }

  _buildParticles() {
    const positions = new Float32Array(PARTICLE_COUNT * 3)
    const opacities = new Float32Array(PARTICLE_COUNT)

    // Per-particle motion metadata — stored once, used every frame
    this._meta = new Float32Array(PARTICLE_COUNT * 4)
    // [i*4 + 0] = base angle (radians around Y axis)
    // [i*4 + 1] = base radius (distance from Y axis)
    // [i*4 + 2] = base Y
    // [i*4 + 3] = phase offset (unique oscillation timing)

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const angle  = Math.random() * Math.PI * 2
      const radius = Math.random() * INNER_RADIUS * 0.9  // keep inside inner cylinder
      const y      = MIN_Y + Math.random() * (MAX_Y - MIN_Y)
      const phase  = Math.random() * Math.PI * 2

      // Initial position
      positions[i * 3]     = Math.cos(angle) * radius
      positions[i * 3 + 1] = y
      positions[i * 3 + 2] = Math.sin(angle) * radius

      // Opacity — vary for depth feel
      opacities[i] = 0.3 + Math.random() * 0.7

      this._meta[i * 4]     = angle
      this._meta[i * 4 + 1] = radius
      this._meta[i * 4 + 2] = y
      this._meta[i * 4 + 3] = phase
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))

    // Custom shader material — soft round points with glow falloff
    const mat = new THREE.PointsMaterial({
      color:        0xffffff,
      size:         0.10,
      sizeAttenuation: true,
      transparent:  true,
      opacity:      0.55,
      depthWrite:   false,      // prevents particles from occluding each other harshly
      blending:     THREE.AdditiveBlending,  // luminous additive glow
    })

    this.points = new THREE.Points(geo, mat)
    this.points.name = 'root-particles'
  }

  update(delta) {
    this._time += delta

    const positions = this.points.geometry.attributes.position.array
    const t         = this._time

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const baseAngle  = this._meta[i * 4]
      const baseRadius = this._meta[i * 4 + 1]
      const baseY      = this._meta[i * 4 + 2]
      const phase      = this._meta[i * 4 + 3]

      // Slow angular drift around Y axis
      const angle  = baseAngle + t * 0.025 + phase * 0.01

      // Gentle radius breathing
      const r      = baseRadius + Math.sin(t * 0.4 + phase) * 0.4

      // Vertical oscillation — very slow, per-particle phase
      const yOff   = Math.sin(t * 0.18 + phase) * 1.2

      positions[i * 3]     = Math.cos(angle) * r
      positions[i * 3 + 1] = baseY + yOff
      positions[i * 3 + 2] = Math.sin(angle) * r
    }

    this.points.geometry.attributes.position.needsUpdate = true
  }

  destroy() {
    this.points.geometry.dispose()
    this.points.material.dispose()
    this.ctx.scene.remove(this.points)
  }
}
