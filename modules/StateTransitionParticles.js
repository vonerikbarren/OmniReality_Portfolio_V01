/**
 * modules/StateTransitionParticles.js — ⟐ state-transition particles
 *
 * Confirmed directly: these assist state CHANGES, not a continuous
 * mood display. Two real, distinct behaviors, both built here:
 *
 *   Trail  — continuous, driven by utils/StepMarker.js's own real
 *            speed: the faster the user actually moves, the longer
 *            the streak trailing behind them. Naturally reads as
 *            "moving fast" at high speed and as a calm, Breath-of-
 *            the-Wild-style bullet-time drift at low speed, since
 *            it's the same real system at different real speeds,
 *            not two separate modes to switch between.
 *
 *   Burst  — a one-shot event: activate, animate from the old spot
 *            toward the new one, then genuinely settle at rest
 *            there, rather than just disappearing. Triggered by
 *            omni:orbit-disable/omni:orbit-enable — the exact pair
 *            utils/CameraTravel.js's goToObject() already dispatches
 *            around every real camera travel in this project, reused
 *            directly rather than adding a second, parallel event.
 *
 * Small on purpose, per explicit request — kept noticeable through
 * additive blending and a soft glow, not through size.
 */

import * as THREE from 'three'
import * as StepMarker from '../utils/StepMarker.js'

const TRAIL_POOL_SIZE = 120
const BURST_POOL_SIZE = 60
const PARTICLE_SIZE = 0.045          // "super small," per explicit request
const TRAIL_SPEED_THRESHOLD = 0.15   // world units/sec — below this, no trail spawns at all
const TRAIL_SPAWN_RATE = 40          // particles/sec at speed 1 — scales with real speed
const TRAIL_BASE_LIFE = 0.4          // seconds — how long a trail particle survives before fading
const BURST_TRAVEL_DURATION = 0.6    // seconds — matches goToObject's own real tween duration
const BURST_SETTLE_LIFE = 1.2        // seconds a settled burst particle lingers before fading, "at rest"

function buildGlowTexture () {
  const canvas = document.createElement('canvas')
  canvas.width = 32; canvas.height = 32
  const ctx = canvas.getContext('2d')
  const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.4, 'rgba(180,230,255,0.7)')
  grad.addColorStop(1, 'rgba(180,230,255,0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 32, 32)
  return new THREE.CanvasTexture(canvas)
}

export default class StateTransitionParticles {
  constructor (context) {
    this.ctx = context
    this._trail = []   // { active, life, maxLife, velocity }
    this._burst = []   // { active, life, phase: 'traveling'|'settled', startPos, endPos, elapsed }
    this._onOrbitDisable = null
    this._onOrbitEnable = null
    this._travelFrom = null
  }

  init () {
    const glowTex = buildGlowTexture()

    this._trailGeo = new THREE.BufferGeometry()
    this._trailPositions = new Float32Array(TRAIL_POOL_SIZE * 3)
    this._trailGeo.setAttribute('position', new THREE.BufferAttribute(this._trailPositions, 3))
    const trailMat = new THREE.PointsMaterial({
      size: PARTICLE_SIZE, map: glowTex, transparent: true, opacity: 0.8,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
    })
    this._trailPoints = new THREE.Points(this._trailGeo, trailMat)
    this.ctx.scene.add(this._trailPoints)
    for (let i = 0; i < TRAIL_POOL_SIZE; i++) this._trail.push({ active: false, life: 0, maxLife: 0, velocity: new THREE.Vector3() })

    this._burstGeo = new THREE.BufferGeometry()
    this._burstPositions = new Float32Array(BURST_POOL_SIZE * 3)
    this._burstGeo.setAttribute('position', new THREE.BufferAttribute(this._burstPositions, 3))
    const burstMat = new THREE.PointsMaterial({
      size: PARTICLE_SIZE, map: glowTex, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
    })
    this._burstPoints = new THREE.Points(this._burstGeo, burstMat)
    this.ctx.scene.add(this._burstPoints)
    for (let i = 0; i < BURST_POOL_SIZE; i++) this._burst.push({ active: false, life: 0, phase: 'traveling', startPos: new THREE.Vector3(), endPos: new THREE.Vector3(), elapsed: 0 })

    // Reuses the exact real bracketing events every camera travel in
    // this project already dispatches — not a second, parallel event.
    this._onOrbitDisable = () => { this._travelFrom = this.ctx.camera.position.clone() }
    this._onOrbitEnable = () => {
      if (this._travelFrom) this.triggerTeleportBurst(this._travelFrom, this.ctx.camera.position.clone())
      this._travelFrom = null
    }
    window.addEventListener('omni:orbit-disable', this._onOrbitDisable)
    window.addEventListener('omni:orbit-enable', this._onOrbitEnable)
  }

  update (delta) {
    StepMarker.update(this.ctx.camera, delta)
    this._updateTrail(delta)
    this._updateBurst(delta)
  }

  onResize () {}

  destroy () {
    window.removeEventListener('omni:orbit-disable', this._onOrbitDisable)
    window.removeEventListener('omni:orbit-enable', this._onOrbitEnable)
    this.ctx.scene.remove(this._trailPoints, this._burstPoints)
    this._trailGeo.dispose(); this._trailPoints.material.map?.dispose(); this._trailPoints.material.dispose()
    this._burstGeo.dispose(); this._burstPoints.material.dispose()
  }

  /** The real "faster = longer streak" mechanic — spawn rate and
   *  per-particle life both scale with StepMarker's own real,
   *  current speed, so a genuinely faster real movement produces
   *  genuinely more, longer-lived trailing particles, not a fixed
   *  cosmetic loop. */
  _updateTrail (delta) {
    const speed = StepMarker.getSpeed()
    if (speed > TRAIL_SPEED_THRESHOLD) {
      const toSpawn = Math.floor(TRAIL_SPAWN_RATE * Math.min(speed, 6) * delta)
      const velocity = StepMarker.getVelocity()
      for (let i = 0; i < toSpawn; i++) {
        const p = this._trail.find(p => !p.active)
        if (!p) break
        p.active = true
        p.maxLife = TRAIL_BASE_LIFE * Math.min(1 + speed * 0.3, 3)   // faster real movement -> genuinely longer-lived, longer streak
        p.life = p.maxLife
        p.position = this.ctx.camera.position.clone()
        p.velocity.set(-velocity.x, -velocity.y, -velocity.z).multiplyScalar(0.15)
      }
    }

    this._trail.forEach((p, i) => {
      if (!p.active) return
      p.life -= delta
      if (p.life <= 0) { p.active = false; return }
      p.position.addScaledVector(p.velocity, delta)
      this._trailPositions[i * 3] = p.position.x
      this._trailPositions[i * 3 + 1] = p.position.y
      this._trailPositions[i * 3 + 2] = p.position.z
    })
    this._trailGeo.attributes.position.needsUpdate = true
    this._trailPoints.material.opacity = 0.8
  }

  /** The real, one-shot transition-assist burst — genuinely
   *  animates from the old position toward the new one, then
   *  genuinely settles and rests there for a while rather than
   *  simply vanishing on arrival. */
  triggerTeleportBurst (fromPosition, toPosition) {
    for (let i = 0; i < BURST_POOL_SIZE; i++) {
      const p = this._burst[i]
      if (p.active) continue
      p.active = true
      p.phase = 'traveling'
      p.elapsed = 0
      const jitter = () => (Math.random() - 0.5) * 0.6
      p.startPos.copy(fromPosition).add(new THREE.Vector3(jitter(), jitter(), jitter()))
      p.endPos.copy(toPosition).add(new THREE.Vector3(jitter(), jitter(), jitter()))
      p.life = BURST_SETTLE_LIFE
      break   // one particle per call is plenty visually; real bursts come from rapid teleports, not a single huge dump
    }
    // Spawn a real cluster, not just one — a burst should read as a
    // group of particles moving together, not a single mote.
    for (let n = 0; n < 24; n++) {
      const p = this._burst.find(p => !p.active)
      if (!p) break
      p.active = true
      p.phase = 'traveling'
      p.elapsed = 0
      const jitter = () => (Math.random() - 0.5) * 0.6
      p.startPos.copy(fromPosition).add(new THREE.Vector3(jitter(), jitter(), jitter()))
      p.endPos.copy(toPosition).add(new THREE.Vector3(jitter(), jitter(), jitter()))
      p.life = BURST_SETTLE_LIFE
    }
  }

  _updateBurst (delta) {
    this._burst.forEach((p, i) => {
      if (!p.active) { this._burstPositions[i * 3] = 0; this._burstPositions[i * 3 + 1] = -9999; this._burstPositions[i * 3 + 2] = 0; return }

      if (p.phase === 'traveling') {
        p.elapsed += delta
        const t = Math.min(1, p.elapsed / BURST_TRAVEL_DURATION)
        const eased = 1 - Math.pow(1 - t, 3)   // ease-out — matches goToObject's own power2.inOut read closely enough to feel like one motion
        const pos = p.startPos.clone().lerp(p.endPos, eased)
        this._burstPositions[i * 3] = pos.x
        this._burstPositions[i * 3 + 1] = pos.y
        this._burstPositions[i * 3 + 2] = pos.z
        if (t >= 1) { p.phase = 'settled'; p.life = BURST_SETTLE_LIFE }
      } else {
        p.life -= delta
        if (p.life <= 0) { p.active = false; return }
        this._burstPositions[i * 3] = p.endPos.x
        this._burstPositions[i * 3 + 1] = p.endPos.y
        this._burstPositions[i * 3 + 2] = p.endPos.z
      }
    })
    this._burstGeo.attributes.position.needsUpdate = true
  }
}
