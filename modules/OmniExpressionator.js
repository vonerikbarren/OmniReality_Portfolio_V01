/**
 * modules/OmniExpressionator.js — ⟐mniExpressionator particle engine
 *
 * One shared particle engine, not one system per emotion — the same
 * "one formula, many presets" pattern already proven elsewhere in
 * this project (one Fibonacci sphere for any node count, one Group
 * Lock for any formation). A preset is just a data-driven config —
 * color, size, sprite, speed, spread, blending — swapped on the same
 * underlying renderer, not a rebuilt system each time.
 *
 * Real GPU efficiency, not just "small particles": every particle in
 * a preset lives in ONE shared buffer and draws in a single GPU call,
 * via THREE.Points (soft glowing dots) or THREE.LineSegments (streaks/
 * trails) depending on what that preset actually needs to look like.
 * Smallness helps, but the real cost that would ever matter at scale
 * is overdraw from dense, additive-blended overlap — not particle
 * count or size on their own.
 *
 * First real preset: "entrance" — the light-speed-travel-then-arrival
 * effect for the moment the user first descends into the scene. White
 * streaks race past, camera-relative (so the illusion holds regardless
 * of the camera's actual world-space fall path), decelerating and
 * fading out as the preset's duration completes.
 *
 * Follows the standard module contract (constructor / init / update / destroy).
 */

import * as THREE from 'three'

// ── Sprite texture, generated procedurally — no external image asset needed ──
function makeSoftDotTexture () {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.4, 'rgba(255,255,255,0.6)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, size, size)
  const tex = new THREE.CanvasTexture(canvas)
  tex.needsUpdate = true
  return tex
}

// ── Preset: entrance — camera-relative streaking lines ─────────────────────
function startEntrancePreset (ctx, opts = {}, onComplete) {
  const count      = opts.count ?? 500
  const color      = opts.color ?? 0xffffff
  const spread     = opts.spread ?? 40        // how wide/tall the streak field is, around the camera's forward axis
  const spawnAhead = opts.spawnAhead ?? 260    // how far in front particles spawn
  const trailLen   = opts.trailLen ?? 6        // length of each streak, in local units
  const baseSpeed  = opts.baseSpeed ?? 220     // local units/sec toward the camera at full speed
  const duration   = opts.duration ?? 4.6      // matches CAM_ENTRY phase 1's own duration in main.js

  const positions = new Float32Array(count) // per-particle current local Z only — X/Y are fixed per particle
  const lateral   = new Float32Array(count * 2) // x, y per particle, fixed for its lifetime
  for (let i = 0; i < count; i++) {
    positions[i] = -Math.random() * spawnAhead
    lateral[i * 2]     = (Math.random() - 0.5) * spread
    lateral[i * 2 + 1] = (Math.random() - 0.5) * spread
  }

  const geo = new THREE.BufferGeometry()
  const verts = new Float32Array(count * 2 * 3)   // 2 vertices per line segment
  geo.setAttribute('position', new THREE.BufferAttribute(verts, 3))

  const mat = new THREE.LineBasicMaterial({
    color, transparent: true, opacity: 1,
    blending: THREE.AdditiveBlending, depthWrite: false,
  })
  const lines = new THREE.LineSegments(geo, mat)
  lines.frustumCulled = false
  ctx.camera.add(lines)   // camera-relative — a child of the camera itself, not the scene

  let elapsed = 0

  function update (delta) {
    elapsed += delta
    const t = Math.min(1, elapsed / duration)
    // Decelerate across the preset's duration — fast at first, easing
    // toward a stop as "arrival" approaches, fading out at the same time.
    const speedFactor = 1 - t * t
    const speed = baseSpeed * speedFactor
    mat.opacity = 1 - t

    const posAttr = geo.attributes.position
    for (let i = 0; i < count; i++) {
      positions[i] += speed * delta
      if (positions[i] > 2) positions[i] = -spawnAhead   // recycle once it passes the camera
      const z0 = positions[i]
      const z1 = positions[i] - trailLen * Math.max(0.15, speedFactor)   // shorter trail as it decelerates
      const x = lateral[i * 2]
      const y = lateral[i * 2 + 1]
      const idx = i * 6
      verts[idx]     = x; verts[idx + 1] = y; verts[idx + 2] = z0
      verts[idx + 3] = x; verts[idx + 4] = y; verts[idx + 5] = z1
    }
    posAttr.needsUpdate = true

    if (t >= 1) { dispose(); onComplete?.() }
  }

  function dispose () {
    ctx.camera.remove(lines)
    geo.dispose()
    mat.dispose()
  }

  return { update, dispose }
}

// ── Preset: galaxy — persistent, world-space, slowly rotating particle field ─
// Unlike entrance (camera-relative, one-shot, auto-disposing), this is a
// lasting decorative part of a Galaxy system: positioned at a fixed world
// point (the system's own OmniCore), never auto-stops on its own, and
// keeps existing until its owning system is explicitly deleted.
function startGalaxyPreset (ctx, opts = {}) {
  const count       = opts.count ?? 1200
  const color       = opts.color ?? 0x8cc4ff
  const radius      = opts.radius ?? 40         // overall spread of the particle field
  const arms        = opts.arms ?? 3            // matches galaxyDefs' own arm count, for visual consistency
  const spiralTurns = opts.spiralTurns ?? 2.2    // how many full winds each arm makes out to full radius
  const flatness    = opts.flatness ?? 0.12      // vertical spread as a fraction of radius — galaxies are thin discs
  const rotateSpeed = opts.rotateSpeed ?? 0.03    // radians/sec, slow and ambient
  const center      = opts.center ?? [0, 0, 0]

  const positions = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    // Deterministic scatter (not Math.random) so the same count always
    // produces the same field — matches every other formation in this
    // project being a pure function of its inputs, not randomized per click.
    const armIndex = i % arms
    const t = (Math.floor(i / arms) / Math.ceil(count / arms))
    const jitter = Math.sin(i * 12.9898) * 0.5 + 0.5   // deterministic pseudo-random 0..1
    const r = t * radius * (0.85 + jitter * 0.3)
    const angle = armIndex * (2 * Math.PI / arms) + t * spiralTurns * 2 * Math.PI
    const y = (Math.sin(i * 78.233) * 0.5) * radius * flatness

    positions[i * 3]     = center[0] + r * Math.cos(angle)
    positions[i * 3 + 1] = center[1] + y
    positions[i * 3 + 2] = center[2] + r * Math.sin(angle)
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))

  const mat = new THREE.PointsMaterial({
    color, size: 0.6, map: opts.dotTexture,
    transparent: true, opacity: 0.75,
    blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
  })
  const points = new THREE.Points(geo, mat)
  points.frustumCulled = false
  ctx.scene.add(points)   // world-space, not camera-relative — this stays where the galaxy actually is

  function update (delta) {
    points.rotation.y += rotateSpeed * delta   // slow ambient rotation, never stops on its own
  }

  function dispose () {
    ctx.scene.remove(points)
    geo.dispose()
    mat.dispose()
  }

  return { update, dispose }
}

const PRESETS = {
  entrance: startEntrancePreset,
  galaxy: startGalaxyPreset,
}

export default class OmniExpressionator {
  constructor (context) {
    this.ctx = context
    this._instances = new Map()   // instanceId -> { update, dispose }
    this._sharedDotTexture = null
  }

  init () {
    this._sharedDotTexture = makeSoftDotTexture()
  }

  update (delta) {
    for (const instance of this._instances.values()) instance.update(delta)
  }

  onResize () {}

  destroy () {
    this.stopAll()
    this._sharedDotTexture?.dispose()
  }

  /**
   * Starts a named preset under the given instance id, replacing
   * whatever was previously running under that SAME id only — a
   * second, different id keeps running untouched. Defaults to a
   * shared 'default' id, which is exactly the old single-slot
   * behavior the entrance effect already relies on; multi-instance
   * use (Galaxy's per-system particle fields) passes its own unique
   * id explicitly.
   */
  play (presetName, opts, instanceId = 'default') {
    this.stop(instanceId)
    const starter = PRESETS[presetName]
    if (!starter) {
      console.warn(`⟐ OmniExpressionator — unknown preset "${presetName}"`)
      return
    }
    const fullOpts = { ...opts, dotTexture: this._sharedDotTexture }
    const instance = starter(this.ctx, fullOpts, () => { this._instances.delete(instanceId) })
    this._instances.set(instanceId, instance)
  }

  stop (instanceId = 'default') {
    this._instances.get(instanceId)?.dispose()
    this._instances.delete(instanceId)
  }

  stopAll () {
    for (const id of [...this._instances.keys()]) this.stop(id)
  }

  isPlaying (instanceId = 'default') {
    return this._instances.has(instanceId)
  }
}
