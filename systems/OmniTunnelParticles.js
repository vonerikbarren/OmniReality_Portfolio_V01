/**
 * systems/OmniTunnelParticles.js (V215) — a light particle stream through a whole hand tunnel.
 *
 * One THREE.Points per tunnel, built in the tunnel's local frame (+Y = along the tunnel, the same
 * frame OmniAxinator builds the body in, so it grows/fades with it). Particles drift from the
 * near (-y) end to the far (+y) end through the origin and wrap, so the stream never ends.
 *
 * Speed is NOT a new control: the caller passes the hand's existing speed multiplier
 * (utils/OmniHandSpeed.js, 0.01x..50x) and we move BASE_SPEED * multiplier units per second.
 *
 *   const ps = createTunnelParticles({ y0, y1, radius, color, count?, seed? })
 *   group.add(ps.points)
 *   ps.update(dt, speedMultiplier, opacityScale)
 *   ps.dispose()
 *
 * Pure geometry + arithmetic (no scene access), so it is testable without a renderer.
 */
import * as THREE from 'three'

export const BASE_SPEED = 600        // world units / second at 1x
export const MAX_STEP_FRAC = 0.5     // a single frame never moves a particle more than half the tunnel
export const DEFAULT_COUNT = 220

function rng (seed) {
  let a = seed >>> 0
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}

export function createTunnelParticles ({ y0, y1, radius, color = 0xffffff, count = DEFAULT_COUNT, seed = 215, size = 3 } = {}) {
  const span = Math.max(1, y1 - y0)
  const r = rng(seed)
  const pos = new Float32Array(count * 3)
  const phase = new Float32Array(count)    // 0..1 along the span
  const rad = new Float32Array(count)
  const ang = new Float32Array(count)
  const drift = new Float32Array(count)    // per-particle speed spread 0.6..1.4
  for (let i = 0; i < count; i++) {
    phase[i] = r(); ang[i] = r() * Math.PI * 2
    rad[i] = Math.sqrt(r()) * radius * 0.9
    drift[i] = 0.6 + r() * 0.8
  }
  const geo = new THREE.BufferGeometry()
  const attr = new THREE.BufferAttribute(pos, 3)
  geo.setAttribute('position', attr)
  const mat = new THREE.PointsMaterial({
    color, size, sizeAttenuation: true, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending,
  })
  const points = new THREE.Points(geo, mat)
  points.frustumCulled = false
  points.name = 'OmniTunnelParticles'

  function write () {
    for (let i = 0; i < count; i++) {
      pos[i * 3] = Math.cos(ang[i]) * rad[i]
      pos[i * 3 + 1] = y0 + phase[i] * span
      pos[i * 3 + 2] = Math.sin(ang[i]) * rad[i]
    }
    attr.needsUpdate = true
  }
  write()

  return {
    points, count, phase, material: mat,
    /** Advance by dt seconds at `speed` x. Negative speed flows the other way. */
    update (dt, speed = 1, opacityScale = 1) {
      const step = Math.max(-MAX_STEP_FRAC, Math.min(MAX_STEP_FRAC, (BASE_SPEED * speed * dt) / span))
      if (Number.isFinite(step) && step !== 0) {
        for (let i = 0; i < count; i++) {
          let p = phase[i] + step * drift[i]
          p -= Math.floor(p)
          phase[i] = p
        }
      }
      write()
      mat.opacity = 0.55 * Math.max(0, Math.min(1, opacityScale))
      points.visible = mat.opacity > 0.004
    },
    dispose () { geo.dispose(); mat.dispose() },
  }
}
