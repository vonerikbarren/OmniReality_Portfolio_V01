/**
 * OmniPlatform.js — ⟐Platform
 *
 * A descending stack of five concentric RingGeometry planes,
 * each smaller and lower than the last — like a tiered landing pad
 * tapering toward its center.
 *
 * A spinning OctahedronGeometry sits at the innermost center.
 *
 * Ring radii halve at each step:
 *   Ring 1  r=20  (outermost, highest)
 *   Ring 2  r=10
 *   Ring 3  r=5
 *   Ring 4  r=2.5
 *   Ring 5  r=1.25  (innermost, lowest)
 *
 * Reusable — accepts a position vector in its constructor.
 * Placed in the Root room as a spatial anchor.
 *
 * Context: { scene, camera, renderer, sizes, ticker }
 */

import * as THREE from 'three'

const RING_CONFIG = [
  { outerR: 20,   innerR: 19.5,  yOffset: 0    },
  { outerR: 10,   innerR: 9.6,   yOffset: -0.6 },
  { outerR: 5,    innerR: 4.7,   yOffset: -1.1 },
  { outerR: 2.5,  innerR: 2.25,  yOffset: -1.5 },
  { outerR: 1.25, innerR: 1.05,  yOffset: -1.8 },
]

const RING_SEGMENTS  = 64
const OCTAHEDRON_R   = 0.6
const OCT_Y_OFFSET   = -1.8    // same Y as innermost ring

export default class OmniPlatform {
  /**
   * @param {object} context   — shared scene context
   * @param {THREE.Vector3} [position] — world position (default origin)
   */
  constructor(context, position = new THREE.Vector3(0, 0, 0)) {
    this.ctx      = context
    this.position = position
    this.group    = new THREE.Group()
    this._octahedron = null
  }

  init() {
    this._buildRings()
    this._buildOctahedron()
    this._buildPulseRings()

    this.group.position.copy(this.position)
    this.ctx.scene.add(this.group)
  }

  _buildRings() {
    RING_CONFIG.forEach((cfg, i) => {
      const geo = new THREE.RingGeometry(
        cfg.innerR,
        cfg.outerR,
        RING_SEGMENTS
      )

      const mat = new THREE.MeshBasicMaterial({
        color:       0xffffff,
        side:        THREE.DoubleSide,
        transparent: true,
        opacity:     0.55 - i * 0.06,   // outer rings slightly more visible
        depthWrite:  false,
      })

      const ring = new THREE.Mesh(geo, mat)
      ring.rotation.x = -Math.PI / 2   // lay flat on XZ plane
      ring.position.y = cfg.yOffset
      ring.name = `omni-platform-ring-${i + 1}`

      this.group.add(ring)
    })
  }

  _buildOctahedron() {
    const geo = new THREE.OctahedronGeometry(OCTAHEDRON_R, 0)
    const mat = new THREE.MeshBasicMaterial({
      color:       0xffffff,
      wireframe:   false,
      transparent: true,
      opacity:     0.9,
    })

    this._octahedron = new THREE.Mesh(geo, mat)
    this._octahedron.position.y = OCT_Y_OFFSET - 0.3
    this._octahedron.name = 'omni-platform-octahedron'

    // Emissive-style: a point light at the octahedron to make it glow
    const glow = new THREE.PointLight(0xffffff, 1.2, 6, 2)
    glow.position.set(0, OCT_Y_OFFSET - 0.3, 0)
    this.group.add(glow)

    this.group.add(this._octahedron)
  }

  /**
   * Pulse rings — radar-style ripples expanding outward from center.
   * Three rings stagger-looped via GSAP in update() using manual scaling.
   */
  _buildPulseRings() {
    this._pulseRings = []

    for (let i = 0; i < 3; i++) {
      const geo = new THREE.RingGeometry(0.8, 1.0, RING_SEGMENTS)
      const mat = new THREE.MeshBasicMaterial({
        color:       0xffffff,
        side:        THREE.DoubleSide,
        transparent: true,
        opacity:     0,
        depthWrite:  false,
      })

      const ring = new THREE.Mesh(geo, mat)
      ring.rotation.x = -Math.PI / 2
      ring.position.y = OCT_Y_OFFSET
      ring.name = `omni-pulse-ring-${i}`

      // Phase offset so rings stagger across a 3s cycle
      ring._phase      = (i / 3) * Math.PI * 2
      ring._cycleTime  = 2.8

      this.group.add(ring)
      this._pulseRings.push(ring)
    }

    this._pulseTime = 0
  }

  update(delta) {
    // Spin the octahedron
    if (this._octahedron) {
      this._octahedron.rotation.y += delta * 1.1
      this._octahedron.rotation.x += delta * 0.4
    }

    // Animate pulse rings — expand scale + fade opacity
    this._pulseTime += delta

    this._pulseRings.forEach((ring) => {
      const cycle = this._pulseTime / ring._cycleTime
      const t     = (cycle + ring._phase / (Math.PI * 2)) % 1.0

      // Scale expands 1 → 22 (outermost ring radius)
      const scale = 1 + t * 21
      ring.scale.set(scale, scale, scale)

      // Opacity peaks at t=0.1, fades to 0 at t=1
      const opacity = t < 0.1
        ? t / 0.1 * 0.4
        : 0.4 * (1 - (t - 0.1) / 0.9)

      ring.material.opacity = opacity
    })
  }

  destroy() {
    this.group.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose()
      if (obj.material) obj.material.dispose()
    })
    this.ctx.scene.remove(this.group)
  }
}
