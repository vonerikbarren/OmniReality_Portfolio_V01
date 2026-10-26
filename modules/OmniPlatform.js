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

const RING_SEGMENTS  = 64
const OCTAHEDRON_R   = 0.6

const STORE_KEY = 'omni:platform:settings'
function loadSettings () {
  const defaults = { ringCount: 5, rippleDistance: 20 }
  try {
    const raw = localStorage.getItem(STORE_KEY)
    return raw ? { ...defaults, ...JSON.parse(raw) } : defaults
  } catch (_) { return defaults }
}
function saveSettings (s) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(s)) } catch (_) {}
}

// Generates N rings following the exact same halving pattern the
// original fixed 5-entry RING_CONFIG used — outermost ring's radius
// is rippleDistance itself, so the ripple effect and the outermost
// ring always agree with each other, not two separately-tuned numbers.
function buildRingConfig (ringCount, rippleDistance) {
  const config = []
  for (let i = 0; i < ringCount; i++) {
    const outerR = rippleDistance / Math.pow(2, i)
    config.push({
      outerR,
      innerR: outerR * 0.96,
      yOffset: i === 0 ? 0 : -(0.6 * i * (5 / Math.max(1, ringCount))),
    })
  }
  return config
}

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
    this._ringMeshes = []
    this._ringCount = 5
    this._rippleDistance = 20
    this._octYOffset = 0
    this._onSettingsSet = null
  }

  init() {
    const saved = loadSettings()
    this._ringCount = saved.ringCount
    this._rippleDistance = saved.rippleDistance
    this._buildRings()
    this._buildOctahedron()
    this._buildPulseRings()

    this.group.position.copy(this.position)
    this.ctx.scene.add(this.group)

    this._onSettingsSet = (e) => {
      const patch = e.detail ?? {}
      let changed = false
      if (patch.ringCount !== undefined && patch.ringCount !== this._ringCount) {
        this._ringCount = Math.max(1, Math.min(20, Math.round(patch.ringCount)))
        changed = true
      }
      if (patch.rippleDistance !== undefined && patch.rippleDistance !== this._rippleDistance) {
        this._rippleDistance = Math.max(1, patch.rippleDistance)
        changed = true
      }
      if (changed) {
        this._disposeRings()
        this._buildRings()
        // Octahedron + glow position depends on _octYOffset, which
        // _buildRings() just recomputed — reposition rather than
        // fully rebuild, since the octahedron's own geometry hasn't changed.
        if (this._octahedron) {
          this._octahedron.position.y = this._octYOffset - 0.3
          this._glow.position.set(0, this._octYOffset - 0.3, 0)
        }
        this._pulseRings.forEach(ring => { ring.position.y = this._octYOffset })
        saveSettings({ ringCount: this._ringCount, rippleDistance: this._rippleDistance })
      }
    }
    window.addEventListener('omni:platform-set', this._onSettingsSet)
  }

  _buildRings() {
    const config = buildRingConfig(this._ringCount, this._rippleDistance)
    this._octYOffset = config.length ? config[config.length - 1].yOffset : 0

    config.forEach((cfg, i) => {
      const geo = new THREE.RingGeometry(
        cfg.innerR,
        cfg.outerR,
        RING_SEGMENTS
      )

      const mat = new THREE.MeshBasicMaterial({
        color:       0xffffff,
        side:        THREE.DoubleSide,
        transparent: true,
        opacity:     Math.max(0.15, 0.55 - i * 0.06),   // outer rings slightly more visible
        depthWrite:  false,
      })

      const ring = new THREE.Mesh(geo, mat)
      ring.rotation.x = -Math.PI / 2   // lay flat on XZ plane
      ring.position.y = cfg.yOffset
      ring.name = `omni-platform-ring-${i + 1}`

      this.group.add(ring)
      this._ringMeshes.push(ring)
    })
  }

  _disposeRings () {
    this._ringMeshes.forEach(ring => {
      this.group.remove(ring)
      ring.geometry.dispose()
      ring.material.dispose()
    })
    this._ringMeshes = []
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
    this._octahedron.position.y = this._octYOffset - 0.3
    this._octahedron.name = 'omni-platform-octahedron'

    // Emissive-style: a point light at the octahedron to make it glow
    this._glow = new THREE.PointLight(0xffffff, 1.2, 6, 2)
    this._glow.position.set(0, this._octYOffset - 0.3, 0)
    this.group.add(this._glow)

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
      ring.position.y = this._octYOffset
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

      // Scale expands 1 -> rippleDistance + 1, so the ripple's actual
      // reach always matches the configured setting, not a hardcoded number
      const scale = 1 + t * this._rippleDistance
      ring.scale.set(scale, scale, scale)

      // Opacity peaks at t=0.1, fades to 0 at t=1
      const opacity = t < 0.1
        ? t / 0.1 * 0.4
        : 0.4 * (1 - (t - 0.1) / 0.9)

      ring.material.opacity = opacity
    })
  }

  destroy() {
    window.removeEventListener('omni:platform-set', this._onSettingsSet)
    this.group.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose()
      if (obj.material) obj.material.dispose()
    })
    this.ctx.scene.remove(this.group)
  }
}
