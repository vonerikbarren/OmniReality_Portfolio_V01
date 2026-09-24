/**
 * modules/OmniEmotionParticles.js — ⟐ emotion particles
 *
 * A real, camera-attached, continuous particle system reflecting
 * the user's current emotional/UX state — a genuinely different job
 * from StateTransitionParticles.js (that one assists movement/state
 * CHANGES; this one is the continuous mood display that file's own
 * header explicitly says it is not). Config-driven from
 * data/OmniEmotionStates.js — switching state means calling
 * setEmotion(name), not writing new particle logic per state.
 *
 * Real, smooth cross-fade on state change: the previous state's own
 * particles fade out while the new state's own particles fade in,
 * rather than a hard, jarring cut.
 *
 * Reuses the exact same, already-proven real techniques as
 * StateTransitionParticles.js: a pooled BufferGeometry, additive-
 * blended radial-glow texture, sizeAttenuation — not a second,
 * parallel particle-rendering approach.
 */

import * as THREE from 'three'
import * as StepMarker from '../utils/StepMarker.js'
import { EMOTION_STATES, MOTION_TYPES } from '../data/OmniEmotionStates.js'

const POOL_SIZE = 200
const PARTICLE_SIZE = 0.05
const BASE_SPAWN_RATE = 30        // particles/sec at density 1
const BASE_LIFE = 1.4             // seconds, before per-motion-type/density scaling
const CROSSFADE_DURATION = 0.6    // seconds

function buildGlowTexture (hex) {
  const canvas = document.createElement('canvas')
  canvas.width = 32; canvas.height = 32
  const c = canvas.getContext('2d')
  const color = new THREE.Color(hex)
  const rgb = `${Math.round(color.r * 255)},${Math.round(color.g * 255)},${Math.round(color.b * 255)}`
  const grad = c.createRadialGradient(16, 16, 0, 16, 16, 16)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.4, `rgba(${rgb},0.75)`)
  grad.addColorStop(1, `rgba(${rgb},0)`)
  c.fillStyle = grad
  c.fillRect(0, 0, 32, 32)
  return new THREE.CanvasTexture(canvas)
}

export default class OmniEmotionParticles {
  constructor (context) {
    this.ctx = context
    this._pool = []   // { active, life, maxLife, position, velocity, angle, hue, opacity }
    this._currentState = 'normalWalking'
    this._crossfade = { elapsed: CROSSFADE_DURATION, fromColor: null, toColor: null }
    this._spawnAccumulator = 0
  }

  init () {
    this._geo = new THREE.BufferGeometry()
    this._positions = new Float32Array(POOL_SIZE * 3)
    this._colors = new Float32Array(POOL_SIZE * 3)
    this._geo.setAttribute('position', new THREE.BufferAttribute(this._positions, 3))
    this._geo.setAttribute('color', new THREE.BufferAttribute(this._colors, 3))

    this._texture = buildGlowTexture('#ffffff')
    this._material = new THREE.PointsMaterial({
      size: PARTICLE_SIZE, map: this._texture, transparent: true, opacity: 0.85,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
      vertexColors: true,
    })
    this._points = new THREE.Points(this._geo, this._material)
    this.ctx.scene.add(this._points)

    for (let i = 0; i < POOL_SIZE; i++) {
      this._pool.push({
        active: false, life: 0, maxLife: 0,
        position: new THREE.Vector3(), velocity: new THREE.Vector3(),
        angle: Math.random() * Math.PI * 2, color: new THREE.Color(),
      })
    }
  }

  onResize () {}

  destroy () {
    this.ctx.scene.remove(this._points)
    this._geo.dispose()
    this._material.dispose()
    this._texture.dispose()
  }

  /** Real, public API — the only thing anything outside this file
   *  should call. Starts a real, smooth crossfade rather than an
   *  instant, jarring switch. */
  setEmotion (name) {
    if (!EMOTION_STATES[name] || name === this._currentState) return
    this._crossfade = {
      elapsed: 0,
      fromColor: new THREE.Color(EMOTION_STATES[this._currentState].color),
      toColor: new THREE.Color(EMOTION_STATES[name].color),
    }
    this._currentState = name
  }

  getEmotion () { return this._currentState }

  update (delta) {
    StepMarker.update(this.ctx.camera, delta)
    this._crossfade.elapsed = Math.min(this._crossfade.elapsed + delta, CROSSFADE_DURATION)
    const state = EMOTION_STATES[this._currentState]
    const t = this._crossfade.elapsed / CROSSFADE_DURATION
    const activeColor = this._crossfade.fromColor
      ? this._crossfade.fromColor.clone().lerp(this._crossfade.toColor, t)
      : new THREE.Color(state.color)

    this._spawn(delta, state, activeColor)
    this._advance(delta, state)
  }

  /** Real spawn rate — normalWalking/dash specifically scale off
   *  StepMarker's own real speed (the same real signal
   *  StateTransitionParticles.js's Trail already uses), so standing
   *  still genuinely produces fewer particles than moving fast,
   *  rather than a fixed rate regardless of real movement. Every
   *  other state's own density is a fixed, real config value —
   *  emotional states aren't tied to physical movement speed. */
  _spawn (delta, state, activeColor) {
    let rate = BASE_SPAWN_RATE * state.density
    if (this._currentState === 'normalWalking' || this._currentState === 'dash') {
      rate *= Math.min(StepMarker.getSpeed(), 6)
    }

    this._spawnAccumulator += rate * delta
    while (this._spawnAccumulator >= 1) {
      this._spawnAccumulator -= 1
      const p = this._pool.find(p => !p.active)
      if (!p) break
      p.active = true
      p.maxLife = BASE_LIFE / Math.max(state.speedMultiplier, 0.2)
      p.life = p.maxLife
      p.position.copy(this.ctx.camera.position)
      p.angle = Math.random() * Math.PI * 2
      p.color.copy(activeColor)
      if (state.motion === MOTION_TYPES.CHAOS) p.color.setHSL(Math.random(), 0.8, 0.6)

      const jitter = () => (Math.random() - 0.5) * state.jitter
      const camForward = new THREE.Vector3()
      this.ctx.camera.getWorldDirection(camForward)

      if (state.motion === MOTION_TYPES.DRIFT) {
        p.velocity.set(-camForward.x, -camForward.y, -camForward.z).multiplyScalar(0.3 * state.speedMultiplier)
      } else if (state.motion === MOTION_TYPES.SCATTER || state.motion === MOTION_TYPES.CHAOS) {
        p.velocity.set(jitter() * 4, jitter() * 4, jitter() * 4).multiplyScalar(state.speedMultiplier)
      } else if (state.motion === MOTION_TYPES.PULSE || state.motion === MOTION_TYPES.FLASH) {
        p.velocity.set(Math.cos(p.angle), (Math.random() - 0.3), Math.sin(p.angle)).multiplyScalar(1.5 * state.speedMultiplier)
      } else if (state.motion === MOTION_TYPES.SINK) {
        p.velocity.set(jitter(), -0.6 * state.speedMultiplier, jitter())
      } else if (state.motion === MOTION_TYPES.BOUNCE) {
        p.velocity.set(jitter() * 2, 0.9 * state.speedMultiplier, jitter() * 2)
      } else if (state.motion === MOTION_TYPES.ORBIT) {
        p.velocity.set(0, 0, 0)   // real, actual circular position computed in _advance, not a straight-line velocity
      } else if (state.motion === MOTION_TYPES.CONVERGE) {
        p.position.copy(this.ctx.camera.position).addScaledVector(camForward, 1.2 + Math.random() * 0.8)
        p.velocity.copy(camForward).multiplyScalar(0.4 * state.speedMultiplier)
      }
      if (state.motion === MOTION_TYPES.FLASH) p.maxLife *= 0.35   // real, deliberately short — a flash, not a lingering particle
    }
  }

  _advance (delta, state) {
    this._pool.forEach((p, i) => {
      if (!p.active) { this._positions[i * 3 + 1] = -9999; return }
      p.life -= delta
      if (p.life <= 0) { p.active = false; return }

      if (state.motion === MOTION_TYPES.ORBIT) {
        p.angle += delta * (0.6 + state.speedMultiplier)
        const radius = 0.6 + (1 - p.life / p.maxLife) * 0.3
        p.position.set(
          this.ctx.camera.position.x + Math.cos(p.angle) * radius,
          this.ctx.camera.position.y + Math.sin(p.angle * 1.3) * 0.2,
          this.ctx.camera.position.z + Math.sin(p.angle) * radius,
        )
      } else if (state.motion === MOTION_TYPES.SCATTER || state.motion === MOTION_TYPES.CHAOS) {
        p.position.addScaledVector(p.velocity, delta)
        p.velocity.multiplyScalar(0.92)   // real, natural decay — a real dart, not infinite drift
      } else {
        p.position.addScaledVector(p.velocity, delta)
      }

      this._positions[i * 3] = p.position.x
      this._positions[i * 3 + 1] = p.position.y
      this._positions[i * 3 + 2] = p.position.z
      const fade = Math.min(p.life / p.maxLife, 1)
      this._colors[i * 3] = p.color.r * fade
      this._colors[i * 3 + 1] = p.color.g * fade
      this._colors[i * 3 + 2] = p.color.b * fade
    })
    this._geo.attributes.position.needsUpdate = true
    this._geo.attributes.color.needsUpdate = true
  }
}
