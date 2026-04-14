/**
 * modules/Portfolio2D.js — ⟐Portfolio 2D Projects
 *
 * Spawns 24 portfolio spheres from data/portfolio.2d.json — one per project.
 * Projects are grouped into 5 category clusters arranged in a ring around
 * the Root space. Each sphere carries four information zones:
 *
 *   Zone 1 — Above sphere     : project name Sprite, always billboards to camera
 *   Zone 2 — Front panel      : GitHub + Live links, glassmorphism CanvasTexture plane
 *   Zone 3 — On orbital ring  : category tag Sprite, orbits the sphere continuously
 *   Zone 4 — Inside sphere    : ⟐Platform (scaled interior) + CanvasTexture content
 *                               D3 projects receive a type-matched canvas visualization
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Triggered by
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   omni:nav-select { item: '2D Projects', parent: '⟐Portfolio' }
 *   Calling the same event a second time toggles group visibility.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Interaction — two phases
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   Phase 1 — Click sphere
 *     → Sphere scales up via GSAP (×2.2)
 *     → HTML overlay appears with project name, GitHub/Live links, two action buttons
 *
 *   Phase 2A — Stay Outside
 *     → Camera moves to radial orbital position facing the sphere
 *     → Zones 1–3 fully readable; overlay shows links + Enter / Back buttons
 *
 *   Phase 2B — Enter Node
 *     → Sphere fades to near-invisible; camera flies inside (1.4s GSAP)
 *     → ⟐Platform spawns at sphere center (scale 0.055 — fits r=1.4 interior)
 *     → Zone 4 CanvasTexture plane activates inside the sphere
 *     → D3 projects: canvas renders chart-type visualization
 *     → Overlay shows links + Exit button; ESC also exits
 *
 *   Exit — camera flies back to stored return position; orbit re-enabled
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Events consumed
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   omni:nav-select  { item, parent }
 *
 * Events dispatched
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   omni:node-created  { node: { id, label }, mesh }  — NodeManager LOD registry
 *   omni:orbit-disable                                 — suspends orbit during fly-to
 *   omni:orbit-enable                                  — restores orbit after arrival
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Module contract
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   constructor(context)   — context = { scene, camera, renderer, sizes, ticker }
 *   init()                 — bind nav-select listener; deferred spawn
 *   update(delta)          — floats, orbits, billboards, hover, platform tick
 *   destroy()              — full teardown: geometry, materials, textures, DOM
 */

import * as THREE   from 'three'
import gsap         from 'gsap'
import OmniPlatform from './OmniPlatform.js'

// ── Layout ──────────────────────────────────────────────────────────────────

const DATA_PATH      = './data/portfolio.2d.json'
const SPHERE_RADIUS  = 1.4
const SPHERE_SEGS    = 32
const CLUSTER_RING_R = 42        // world-space radius for category cluster ring
const SPHERE_Y       = 2         // eye level — matches Root camera rest height
const PLATFORM_SCALE = 0.055     // OmniPlatform outer ring r=20 → ~1.1 inside r=1.4

// ── Category configuration ───────────────────────────────────────────────────
//   subR = intra-cluster radius for sphere sub-ring distribution

const CATEGORY_META = {
  web_components:      { color: 0xaaddff, label: 'Web Components',  subR: 8 },
  web_sites:           { color: 0xffddaa, label: 'Web Sites',        subR: 5 },
  web_apps_general:    { color: 0xaaffcc, label: 'Web Apps',         subR: 5 },
  web_apps_crypto:     { color: 0xffcc88, label: 'Crypto Apps',      subR: 5 },
  web_apps_large_data: { color: 0xddaaff, label: 'Large Data / D3',  subR: 5 },
}

// ── Canvas helpers ───────────────────────────────────────────────────────────

/** Manually draw a rounded rectangle path (no ctx.roundRect dependency) */
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y,     x + w, y + r,     r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x,     y + h, x,     y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x,     y,     x + r, y,         r)
  ctx.closePath()
}

/** Convert a Three.js integer color to a CSS hex string */
function hexStr(intColor) {
  return '#' + intColor.toString(16).padStart(6, '0')
}

/** Decompose a Three.js integer color to [r, g, b] bytes (0–255) */
function rgbBytes(intColor) {
  return [
    (intColor >> 16) & 0xff,
    (intColor >>  8) & 0xff,
     intColor        & 0xff,
  ]
}

// ── Main class ───────────────────────────────────────────────────────────────

export default class Portfolio2D {
  /**
   * @param {object} context  — { scene, camera, renderer, sizes, ticker }
   */
  constructor(context) {
    this.ctx = context

    // Root group for all portfolio geometry
    this.group      = new THREE.Group()
    this.group.name = 'portfolio-2d'

    // Entry registry — one SphereEntry per project
    this._entries = []

    // Interaction state
    this._active    = null   // SphereEntry: currently expanded sphere
    this._inside    = false  // true while camera is inside a sphere
    this._platform  = null   // live OmniPlatform (Zone 4 — destroyed on exit)
    this._overlay   = null   // HTML DOM element — prompt/overlay panel
    this._returnCam = null   // { pos: Vector3, target: Vector3 } for exit fly-back
    this._hovered   = null   // THREE.Mesh currently under cursor

    // Raycasting
    this._raycaster = new THREE.Raycaster()
    this._mouse     = new THREE.Vector2()

    // Reusable Vector3 (avoids per-frame allocation in update loop)
    this._v3 = new THREE.Vector3()

    // Time accumulator for float/orbit animations
    this._t = 0

    // Spawn guard — geometry built once on first nav-select
    this._spawned = false

    // Bound handlers
    this._onNavSelect   = this._handleNavSelect.bind(this)
    this._onPointerMove = this._handlePointerMove.bind(this)
    this._onPointerDown = this._handlePointerDown.bind(this)
    this._onKeyDown     = this._handleKeyDown.bind(this)
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────

  init() {
    window.addEventListener('omni:nav-select', this._onNavSelect)
  }

  update(delta) {
    if (!this._spawned || !this.group.visible) return

    this._t += delta

    this._entries.forEach((entry) => {
      if (!entry.mesh) return

      // ── Float — idle sine drift on Y (suspended while expanded or inside) ──
      if (!entry._isExpanded && !this._inside) {
        const floatY = Math.sin(this._t * 0.5 + entry._floatPhase) * 0.12

        entry.mesh.position.y      = entry.basePos.y + floatY
        entry.z1Sprite.position.y  = entry.basePos.y + SPHERE_RADIUS + 0.95 + floatY
        entry.light.position.y     = entry.basePos.y + floatY
      }

      // ── Zone 2 — position in front of sphere toward camera, billboard ──────
      const meshPos = entry.mesh.position
      this._v3
        .subVectors(this.ctx.camera.position, meshPos)
        .setY(0)
        .normalize()

      const z2Dist = SPHERE_RADIUS * 1.35
      entry.z2Plane.position.set(
        meshPos.x + this._v3.x * z2Dist,
        meshPos.y,
        meshPos.z + this._v3.z * z2Dist,
      )
      entry.z2Plane.quaternion.copy(this.ctx.camera.quaternion)

      // ── Zone 3 — orbit category tag around sphere on XZ plane ────────────
      entry._orbitAngle += delta * entry._orbitSpeed
      const oa = entry._orbitAngle
      const or = SPHERE_RADIUS * 2.1
      const oc = entry.basePos
      entry.z3Sprite.position.set(
        oc.x + Math.cos(oa) * or,
        oc.y,
        oc.z + Math.sin(oa) * or,
      )

      // ── Torus — slow axial rotation ───────────────────────────────────────
      if (entry.torus) {
        entry.torus.rotation.y += delta * entry.torus._rotSpeed
      }

      // ── Zone 4 — billboard content plane + OmniPlatform tick ─────────────
      if (entry.z4Plane) {
        entry.z4Plane.quaternion.copy(this.ctx.camera.quaternion)
      }
      if (entry.platform) {
        entry.platform.update(delta)
      }
    })

    // ── Hover detection (disabled while inside a sphere) ──────────────────
    if (!this._inside) {
      this._updateHover()
    }
  }

  destroy() {
    // Listeners
    window.removeEventListener('omni:nav-select', this._onNavSelect)
    this._unbindCanvasEvents()
    this._removeOverlay()

    // Destroy all live OmniPlatform instances (own their own scene objects)
    this._entries.forEach((entry) => {
      if (entry.platform) {
        entry.platform.destroy()
        entry.platform = null
      }
    })
    if (this._platform) {
      this._platform.destroy()
      this._platform = null
    }

    // Dispose all group geometry / materials / textures
    this.group.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose()
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
        mats.forEach((m) => {
          if (m.map) m.map.dispose()
          m.dispose()
        })
      }
    })

    this.ctx.scene.remove(this.group)
    this._entries = []
  }

  // ── Navigation trigger ────────────────────────────────────────────────────

  _handleNavSelect(e) {
    const { item, parent } = e.detail || {}
    if (parent !== '⟐Portfolio' || item !== '2D Projects') return

    if (!this._spawned) {
      this._spawn()
    } else {
      // Toggle visibility on repeat navigation
      this.group.visible = !this.group.visible
      if (!this.group.visible) {
        this._removeOverlay()
        this._collapseActive()
      }
    }
  }

  // ── Async spawn ───────────────────────────────────────────────────────────

  async _spawn() {
    this._spawned = true

    let data
    try {
      const res = await fetch(DATA_PATH)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      data = await res.json()
    } catch (err) {
      console.error('[Portfolio2D] Failed to load portfolio.2d.json:', err)
      this._spawned = false
      return
    }

    this._buildFromData(data)
    this.ctx.scene.add(this.group)
    this._bindCanvasEvents()
    this._playEntrance()
  }

  // ── Build all geometry ────────────────────────────────────────────────────

  _buildFromData(data) {
    const cats    = data.portfolioCore.categories
    const catKeys = Object.keys(cats)

    catKeys.forEach((catKey, catIdx) => {
      const meta     = CATEGORY_META[catKey]
      const projects = cats[catKey]
      const catAngle = (catIdx / catKeys.length) * Math.PI * 2

      // Cluster anchor in world space
      const cx = Math.cos(catAngle) * CLUSTER_RING_R
      const cz = Math.sin(catAngle) * CLUSTER_RING_R

      // Floating category header label (hovers above cluster)
      this._buildClusterLabel(meta.label, cx, SPHERE_Y + 5.5, cz, meta.color)

      // Individual project spheres in a sub-ring around the cluster center
      projects.forEach((project, pIdx) => {
        const pAngle = (pIdx / projects.length) * Math.PI * 2
        const sx     = cx + Math.cos(pAngle) * meta.subR
        const sy     = SPHERE_Y
        const sz     = cz + Math.sin(pAngle) * meta.subR

        const entry = this._buildSphereEntry(project, catKey, meta, sx, sy, sz)
        this._entries.push(entry)
      })
    })
  }

  // ── Staggered entrance animation ──────────────────────────────────────────

  _playEntrance() {
    this._entries.forEach((entry, i) => {
      const delay = i * 0.04

      entry.mesh.material.opacity      = 0
      entry.z1Sprite.material.opacity  = 0
      entry.z2Plane.material.opacity   = 0
      entry.z3Sprite.material.opacity  = 0

      gsap.to(entry.mesh.material,     { opacity: 0.75, duration: 0.7, delay,           ease: 'power2.out' })
      gsap.to(entry.z1Sprite.material, { opacity: 1,    duration: 0.5, delay: delay + 0.10 })
      gsap.to(entry.z2Plane.material,  { opacity: 1,    duration: 0.5, delay: delay + 0.15 })
      gsap.to(entry.z3Sprite.material, { opacity: 0.8,  duration: 0.5, delay: delay + 0.20 })
    })
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SphereEntry builder
  // ─────────────────────────────────────────────────────────────────────────

  _buildSphereEntry(project, catKey, meta, x, y, z) {
    // ── Main sphere ────────────────────────────────────────────────────────
    const sphereGeo = new THREE.SphereGeometry(SPHERE_RADIUS, SPHERE_SEGS, SPHERE_SEGS)
    const sphereMat = new THREE.MeshPhysicalMaterial({
      color:             meta.color,
      emissive:          meta.color,
      emissiveIntensity: 0.20,
      roughness:         0.08,
      metalness:         0.00,
      transmission:      0.50,
      transparent:       true,
      opacity:           0.75,
      thickness:         1.50,
      side:              THREE.DoubleSide,
    })
    const mesh = new THREE.Mesh(sphereGeo, sphereMat)
    mesh.position.set(x, y, z)
    mesh.name     = `port2d-${project.name.replace(/[\s/]+/g, '-').toLowerCase()}`
    mesh.userData = { isPortfolio2D: true, project, catKey }
    this.group.add(mesh)

    // ── Point light — gives each sphere a soft colored glow ───────────────
    const light = new THREE.PointLight(meta.color, 0.65, 7, 2)
    light.position.set(x, y, z)
    this.group.add(light)

    // ── Orbital torus — child of sphere so it moves with it ───────────────
    const torusGeo = new THREE.TorusGeometry(SPHERE_RADIUS * 1.95, 0.04, 8, 64)
    const torusMat = new THREE.MeshBasicMaterial({
      color:       meta.color,
      transparent: true,
      opacity:     0.50,
    })
    const torus = new THREE.Mesh(torusGeo, torusMat)
    // Tilted so it reads as an orbital ring rather than lying flat
    torus.rotation.x  = Math.PI / 2 + 0.18
    torus.rotation.z  = Math.random() * 0.24
    torus._rotSpeed   = 0.18 + Math.random() * 0.22
    mesh.add(torus)   // parented to sphere

    // ── Zone 1 — project name label (Sprite, auto-billboards) ─────────────
    const z1Sprite = this._makeNameSprite(project.name, meta.color)
    z1Sprite.position.set(x, y + SPHERE_RADIUS + 0.95, z)
    this.group.add(z1Sprite)

    // ── Zone 2 — links panel (PlaneGeometry CanvasTexture, billboarded) ───
    // Initial position set here; repositioned toward camera every frame.
    const z2Plane = this._makeLinksPanel(project, meta.color)
    z2Plane.position.set(x, y, z + SPHERE_RADIUS + 0.8)
    this.group.add(z2Plane)

    // ── Zone 3 — category tag Sprite (orbits sphere on XZ plane) ──────────
    const z3Sprite       = this._makeCategoryTag(meta.label)
    const orbitAngle     = Math.random() * Math.PI * 2
    const orbitSpeed     = 0.28 + Math.random() * 0.22
    z3Sprite.position.set(x, y, z)   // real position set each frame in update()
    this.group.add(z3Sprite)

    // Dispatch to NodeManager for LOD registration
    window.dispatchEvent(new CustomEvent('omni:node-created', {
      detail: { node: { id: mesh.name, label: project.name }, mesh }
    }))

    return {
      mesh,
      light,
      torus,
      z1Sprite,
      z2Plane,
      z3Sprite,
      project,
      catKey,
      meta,
      basePos:      new THREE.Vector3(x, y, z),
      _floatPhase:  Math.random() * Math.PI * 2,
      _orbitAngle:  orbitAngle,
      _orbitSpeed:  orbitSpeed,
      _isExpanded:  false,
      platform:     null,   // OmniPlatform — spawned in Zone 4
      z4Plane:      null,   // CanvasTexture plane — spawned in Zone 4
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Zone 1 — Name sprite
  // ─────────────────────────────────────────────────────────────────────────

  _makeNameSprite(name, color) {
    const W = 512, H = 96
    const canvas = document.createElement('canvas')
    canvas.width = W; canvas.height = H
    const ctx = canvas.getContext('2d')

    ctx.clearRect(0, 0, W, H)
    ctx.font         = 'bold 26px monospace'
    ctx.textAlign    = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle    = hexStr(color)
    ctx.shadowColor  = hexStr(color)
    ctx.shadowBlur   = 12
    ctx.fillText(name, W / 2, H / 2)

    const tex = new THREE.CanvasTexture(canvas)
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })
    const spr = new THREE.Sprite(mat)
    spr.scale.set(4.0, 0.75, 1)
    return spr
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Zone 2 — Links panel (glassmorphism CanvasTexture plane)
  // ─────────────────────────────────────────────────────────────────────────

  _makeLinksPanel(project, color) {
    const W = 384, H = 160
    const canvas = document.createElement('canvas')
    canvas.width = W; canvas.height = H
    const ctx = canvas.getContext('2d')
    const [r, g, b] = rgbBytes(color)
    const hex = hexStr(color)

    // Glassmorphism background
    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = 'rgba(255,255,255,0.07)'
    roundRect(ctx, 8, 8, W - 16, H - 16, 10)
    ctx.fill()

    // Colored border
    ctx.strokeStyle = `rgba(${r},${g},${b},0.45)`
    ctx.lineWidth   = 1.5
    roundRect(ctx, 8, 8, W - 16, H - 16, 10)
    ctx.stroke()

    ctx.textAlign    = 'center'
    ctx.textBaseline = 'middle'

    // GitHub link row
    ctx.font        = '500 22px monospace'
    ctx.fillStyle   = '#aaddff'
    ctx.shadowColor = '#aaddff'
    ctx.shadowBlur  = 6
    ctx.fillText('⟐ GitHub', W / 2, 60)

    // Divider line
    ctx.shadowBlur  = 0
    ctx.strokeStyle = `rgba(${r},${g},${b},0.22)`
    ctx.lineWidth   = 0.8
    ctx.beginPath()
    ctx.moveTo(32, 88); ctx.lineTo(W - 32, 88)
    ctx.stroke()

    // Live link row
    ctx.fillStyle   = hex
    ctx.shadowColor = hex
    ctx.shadowBlur  = 6
    ctx.fillText('⟐ Live', W / 2, 118)
    ctx.shadowBlur  = 0

    const tex = new THREE.CanvasTexture(canvas)
    const mat = new THREE.MeshBasicMaterial({
      map:         tex,
      transparent: true,
      depthWrite:  false,
      side:        THREE.DoubleSide,
    })
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 1.05), mat)
    plane.name     = `port2d-z2-${project.name}`
    plane.userData = {
      isZ2:   true,
      github: project.github || '#',
      live:   project.live   || '#',
    }
    return plane
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Zone 3 — Category tag sprite (orbits)
  // ─────────────────────────────────────────────────────────────────────────

  _makeCategoryTag(label) {
    const W = 256, H = 56
    const canvas = document.createElement('canvas')
    canvas.width = W; canvas.height = H
    const ctx = canvas.getContext('2d')

    ctx.clearRect(0, 0, W, H)
    ctx.font         = '16px monospace'
    ctx.textAlign    = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle    = 'rgba(255,255,255,0.75)'
    ctx.shadowColor  = 'rgba(255,255,255,0.95)'
    ctx.shadowBlur   = 5
    ctx.fillText(label, W / 2, H / 2)

    const tex = new THREE.CanvasTexture(canvas)
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })
    const spr = new THREE.Sprite(mat)
    spr.scale.set(2.2, 0.48, 1)
    return spr
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Cluster header label
  // ─────────────────────────────────────────────────────────────────────────

  _buildClusterLabel(label, x, y, z, color) {
    const W = 512, H = 72
    const canvas = document.createElement('canvas')
    canvas.width = W; canvas.height = H
    const ctx = canvas.getContext('2d')

    ctx.clearRect(0, 0, W, H)
    ctx.font         = 'bold 24px monospace'
    ctx.textAlign    = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle    = hexStr(color)
    ctx.shadowColor  = hexStr(color)
    ctx.shadowBlur   = 14
    ctx.fillText(`⟐ ${label}`, W / 2, H / 2)

    const tex = new THREE.CanvasTexture(canvas)
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })
    const spr = new THREE.Sprite(mat)
    spr.scale.set(6.5, 0.91, 1)
    spr.position.set(x, y, z)
    this.group.add(spr)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Zone 4 — Inside sphere: ⟐Platform + content plane
  // ─────────────────────────────────────────────────────────────────────────

  _spawnZone4(entry) {
    if (entry.platform) return   // guard: already spawned

    // ⟐Platform scaled to fit inside sphere interior
    // OmniPlatform outermost ring r=20 → at scale 0.055 → radius ≈ 1.1 < SPHERE_RADIUS
    const platform = new OmniPlatform(this.ctx, entry.basePos.clone())
    platform.group.scale.setScalar(PLATFORM_SCALE)
    platform.init()
    entry.platform  = platform
    this._platform  = platform

    // CanvasTexture content plane — billboarded every frame
    const isD3   = /D3\b/.test(entry.project.name)
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 512
    this._drawZone4Canvas(canvas, entry.project, isD3)

    const tex = new THREE.CanvasTexture(canvas)
    const mat = new THREE.MeshBasicMaterial({
      map:         tex,
      transparent: true,
      depthWrite:  false,
      side:        THREE.DoubleSide,
    })
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(1.45, 1.45), mat)
    plane.position.copy(entry.basePos)
    plane.position.y += 0.55    // slight upward offset within sphere interior
    plane.name = `port2d-z4-${entry.project.name}`
    this.group.add(plane)
    entry.z4Plane = plane
  }

  _destroyZone4(entry) {
    if (entry.platform) {
      if (entry.platform === this._platform) this._platform = null
      entry.platform.destroy()
      entry.platform = null
    }
    if (entry.z4Plane) {
      entry.z4Plane.geometry.dispose()
      if (entry.z4Plane.material.map) entry.z4Plane.material.map.dispose()
      entry.z4Plane.material.dispose()
      this.group.remove(entry.z4Plane)
      entry.z4Plane = null
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Zone 4 canvas — content drawing
  // ─────────────────────────────────────────────────────────────────────────

  _drawZone4Canvas(canvas, project, isD3) {
    const ctx = canvas.getContext('2d')
    const W = 512, H = 512
    ctx.clearRect(0, 0, W, H)

    // Dark glassmorphism background
    ctx.fillStyle = 'rgba(8,8,20,0.88)'
    roundRect(ctx, 0, 0, W, H, 18)
    ctx.fill()

    // Project name header
    ctx.font         = 'bold 24px monospace'
    ctx.textAlign    = 'center'
    ctx.textBaseline = 'alphabetic'
    ctx.fillStyle    = '#ffffff'
    ctx.shadowColor  = '#ffffff'
    ctx.shadowBlur   = 10
    ctx.fillText(project.name, W / 2, 50)
    ctx.shadowBlur   = 0

    // D3 projects get a type-matched visualization
    if (isD3) {
      this._drawD3Viz(ctx, project.name, W, H)
    }

    // Links row at bottom
    ctx.font         = '18px monospace'
    ctx.textAlign    = 'center'

    ctx.fillStyle    = '#aaddff'
    ctx.shadowColor  = '#aaddff'
    ctx.shadowBlur   = 6
    ctx.fillText('⟐ GitHub', W / 2, H - 70)

    ctx.fillStyle    = '#aaffcc'
    ctx.shadowColor  = '#aaffcc'
    ctx.fillText('⟐ Live →', W / 2, H - 38)
    ctx.shadowBlur   = 0
  }

  /** Render a chart-type D3 visualization preview based on project name keywords */
  _drawD3Viz(ctx, name, W, H) {
    const cx = W / 2
    const cy = H / 2 + 18   // center area with header + links padding

    // ── Sunburst — concentric partial arcs ─────────────────────────────────
    if (name.includes('Sunburst')) {
      const colors = ['#ddaaff', '#bb88ee', '#9966cc', '#7744aa', '#553388']
      colors.forEach((c, i) => {
        const r = 34 + i * 30
        const s = Math.PI * 0.28 * i
        ctx.beginPath()
        ctx.arc(cx, cy, r, s, s + Math.PI * 1.55)
        ctx.strokeStyle = c
        ctx.lineWidth   = 24
        ctx.globalAlpha = 0.50
        ctx.stroke()
      })
      ctx.globalAlpha = 1

    // ── Circle Packing — nested circles ───────────────────────────────────
    } else if (name.includes('Circle') || name.includes('Packing')) {
      const circles = [
        { r: 85,  x: cx,      y: cy      },
        { r: 48,  x: cx - 77, y: cy - 52 },
        { r: 48,  x: cx + 77, y: cy - 52 },
        { r: 34,  x: cx - 82, y: cy + 68 },
        { r: 34,  x: cx + 82, y: cy + 68 },
        { r: 22,  x: cx,      y: cy + 115 },
      ]
      const clrs = ['#ddaaff', '#bb88ee', '#9966cc', '#7744aa', '#553388', '#ccbbff']
      circles.forEach((c, i) => {
        ctx.beginPath()
        ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2)
        ctx.strokeStyle  = clrs[i % clrs.length]
        ctx.lineWidth    = 2
        ctx.globalAlpha  = 0.65
        ctx.stroke()
        ctx.fillStyle    = clrs[i % clrs.length]
        ctx.globalAlpha  = 0.08
        ctx.fill()
      })
      ctx.globalAlpha = 1

    // ── TreeMap — nested rectangles ───────────────────────────────────────
    } else if (name.includes('TreeMap') || name.includes('Tree Map')) {
      const rects = [
        [18,  68, 276, 200, '#ddaaff'],
        [304, 68, 190, 200, '#bb88ee'],
        [18,  276, 136, 184, '#9966cc'],
        [162, 276, 196, 184, '#7744aa'],
        [366, 276, 128, 184, '#553388'],
      ]
      rects.forEach(([rx, ry, rw, rh, c]) => {
        ctx.fillStyle    = c
        ctx.globalAlpha  = 0.18
        ctx.fillRect(rx, ry, rw, rh)
        ctx.globalAlpha  = 1.0
        ctx.strokeStyle  = c
        ctx.lineWidth    = 1.5
        ctx.strokeRect(rx, ry, rw, rh)
      })

    // ── Choropleth — grid of color-density cells ──────────────────────────
    } else if (name.includes('Choropleth')) {
      const cols = 8, rows = 6
      const cw = 460 / cols, ch = 310 / rows
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const t = (row * cols + col) / (rows * cols)
          ctx.fillStyle = `rgba(100,200,255,${0.09 + t * 0.56})`
          ctx.fillRect(26 + col * cw, 70 + row * ch, cw - 2, ch - 2)
        }
      }

    // ── Crypto line chart ─────────────────────────────────────────────────
    } else if (name.includes('Crypto')) {
      const pts = Array.from({ length: 20 }, (_, i) => ({
        x: 30 + i * 23,
        y: 250 - Math.sin(i * 0.72) * 65 - Math.sin(i * 2.0) * 28,
      }))
      ctx.beginPath()
      pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)))
      ctx.strokeStyle = '#ffcc88'
      ctx.lineWidth   = 2.5
      ctx.stroke()
      // Fill under chart
      ctx.lineTo(pts[pts.length - 1].x, 360)
      ctx.lineTo(pts[0].x, 360)
      ctx.closePath()
      ctx.fillStyle   = 'rgba(255,204,136,0.12)'
      ctx.fill()

    // ── Dashboard / bar chart ─────────────────────────────────────────────
    } else if (name.includes('Dashboard') || name.includes('Voxlmart')) {
      const bars = [0.42, 0.70, 0.55, 0.90, 0.65, 0.82, 0.50]
      bars.forEach((h, i) => {
        const bh = h * 255
        ctx.fillStyle    = i % 2 ? '#ddaaff' : '#bb88ee'
        ctx.globalAlpha  = 0.60
        ctx.fillRect(32 + i * 62, 368 - bh, 48, bh)
        ctx.globalAlpha  = 1
      })

    // ── Matrix Nodes — node-link graph ────────────────────────────────────
    } else if (name.includes('Matrix') || name.includes('Nodes')) {
      const nodes = [
        { x: 256, y: 130 },
        { x: 148, y: 255 }, { x: 362, y: 255 },
        { x:  90, y: 370 }, { x: 202, y: 370 },
        { x: 308, y: 370 }, { x: 422, y: 370 },
      ]
      const edges = [[0,1],[0,2],[1,3],[1,4],[2,5],[2,6]]
      ctx.strokeStyle = '#aaffcc'
      ctx.lineWidth   = 1.5
      ctx.globalAlpha = 0.42
      edges.forEach(([a, b2]) => {
        ctx.beginPath()
        ctx.moveTo(nodes[a].x, nodes[a].y)
        ctx.lineTo(nodes[b2].x, nodes[b2].y)
        ctx.stroke()
      })
      ctx.globalAlpha = 1
      nodes.forEach((nd) => {
        ctx.beginPath()
        ctx.arc(nd.x, nd.y, 14, 0, Math.PI * 2)
        ctx.fillStyle    = 'rgba(170,255,204,0.16)'
        ctx.fill()
        ctx.strokeStyle  = '#aaffcc'
        ctx.lineWidth    = 2
        ctx.stroke()
      })
    }
    // (non-matching D3 names fall through cleanly — title + links still render)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Hover detection
  // ─────────────────────────────────────────────────────────────────────────

  _updateHover() {
    this._raycaster.setFromCamera(this._mouse, this.ctx.camera)
    const meshes = this._entries.map((e) => e.mesh)
    const hits   = this._raycaster.intersectObjects(meshes, false)
    const hit    = hits.length > 0 ? hits[0].object : null

    const prev = this._hovered
    this._hovered = hit

    if (prev && prev !== hit) {
      const pe = this._entries.find((e) => e.mesh === prev)
      if (pe && !pe._isExpanded) {
        gsap.to(prev.scale, { x: 1, y: 1, z: 1, duration: 0.28 })
        gsap.to(pe.light, { intensity: 0.65, duration: 0.28 })
      }
      this.ctx.renderer.domElement.style.cursor = 'default'
    }

    if (hit && hit !== prev) {
      const ce = this._entries.find((e) => e.mesh === hit)
      if (ce && !ce._isExpanded) {
        gsap.to(hit.scale, { x: 1.10, y: 1.10, z: 1.10, duration: 0.28 })
        gsap.to(ce.light, { intensity: 2.2, duration: 0.28 })
      }
      this.ctx.renderer.domElement.style.cursor = 'pointer'
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Canvas event binding
  // ─────────────────────────────────────────────────────────────────────────

  _bindCanvasEvents() {
    const el = this.ctx.renderer.domElement
    el.addEventListener('pointermove', this._onPointerMove)
    el.addEventListener('pointerdown', this._onPointerDown)
    window.addEventListener('keydown', this._onKeyDown)
  }

  _unbindCanvasEvents() {
    const el = this.ctx.renderer.domElement
    el.removeEventListener('pointermove', this._onPointerMove)
    el.removeEventListener('pointerdown', this._onPointerDown)
    window.removeEventListener('keydown', this._onKeyDown)
    el.style.cursor = 'default'
  }

  _handlePointerMove(e) {
    const rect     = this.ctx.renderer.domElement.getBoundingClientRect()
    this._mouse.x  =  ((e.clientX - rect.left) / rect.width)  * 2 - 1
    this._mouse.y  = -((e.clientY - rect.top)  / rect.height) * 2 + 1
  }

  _handlePointerDown(e) {
    if (e.button !== 0) return
    if (this._inside) return   // clicks handled exclusively by overlay while inside

    this._raycaster.setFromCamera(this._mouse, this.ctx.camera)

    // ── Zone 2 click — open link in new tab ───────────────────────────────
    const z2Planes = this._entries.map((en) => en.z2Plane)
    const z2Hits   = this._raycaster.intersectObjects(z2Planes, false)
    if (z2Hits.length > 0) {
      const ud = z2Hits[0].object.userData
      // Shift-click → GitHub, plain click → Live
      const url = e.shiftKey ? ud.github : ud.live
      if (url && url !== '#') window.open(url, '_blank')
      return
    }

    // ── Sphere click ───────────────────────────────────────────────────────
    const meshes = this._entries.map((e) => e.mesh)
    const hits   = this._raycaster.intersectObjects(meshes, false)
    if (hits.length === 0) return

    const entry = this._entries.find((e) => e.mesh === hits[0].object)
    if (!entry) return

    if (entry._isExpanded) {
      // Already expanded and clicked again — enter the sphere
      this._enterSphere(entry)
    } else {
      this._expandSphere(entry)
    }
  }

  _handleKeyDown(e) {
    if (e.key !== 'Escape') return
    if (this._inside) this._exitSphere()
    else              this._collapseActive()
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Phase 1 — Expansion
  // ─────────────────────────────────────────────────────────────────────────

  _expandSphere(entry) {
    // Collapse any other currently expanded sphere first
    if (this._active && this._active !== entry) {
      this._collapseActive()
    }

    entry._isExpanded = true
    this._active      = entry

    gsap.killTweensOf(entry.mesh.scale)
    gsap.to(entry.mesh.scale, {
      x: 2.2, y: 2.2, z: 2.2,
      duration: 0.50,
      ease: 'power2.inOut',
    })
    gsap.to(entry.light, { intensity: 2.8, duration: 0.30 })
    gsap.to(entry.mesh.material, { emissiveIntensity: 0.50, duration: 0.30 })

    this._showExpandOverlay(entry)
  }

  _collapseActive() {
    if (!this._active) return
    const entry       = this._active
    entry._isExpanded = false
    this._active      = null

    gsap.killTweensOf(entry.mesh.scale)
    gsap.to(entry.mesh.scale, {
      x: 1, y: 1, z: 1,
      duration: 0.38,
      ease: 'power2.out',
    })
    gsap.to(entry.light, { intensity: 0.65, duration: 0.30 })
    gsap.to(entry.mesh.material, { emissiveIntensity: 0.20, duration: 0.30 })
    this._removeOverlay()
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HTML overlays
  // ─────────────────────────────────────────────────────────────────────────

  /** Shared overlay shell styles */
  _overlayShell(entry) {
    const [r, g, b] = rgbBytes(entry.meta.color)
    const hex = hexStr(entry.meta.color)
    return {
      wrap: `
        position: fixed;
        bottom: 120px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(8,8,20,0.84);
        backdrop-filter: blur(18px);
        -webkit-backdrop-filter: blur(18px);
        border: 1px solid rgba(${r},${g},${b},0.35);
        border-radius: 16px;
        padding: 20px 30px 22px;
        color: #fff;
        font-family: monospace;
        text-align: center;
        z-index: 200;
        min-width: 320px;
        pointer-events: all;
        box-shadow: 0 8px 32px rgba(0,0,0,0.55), 0 0 24px rgba(${r},${g},${b},0.12);
      `,
      hex,
      r, g, b,
      linkBtn: (url, label, clr) => `
        <a href="${url || '#'}" target="_blank" style="
          padding:7px 16px;
          background:rgba(${clr},0.10);
          border:1px solid rgba(${clr},0.35);
          border-radius:7px;
          color:rgb(${clr});
          text-decoration:none;
          font-family:monospace;
          font-size:12px;
          text-shadow:0 0 5px rgb(${clr});
        ">${label}</a>
      `,
      actionBtn: (id, label, bg, border, clr) => `
        <button id="${id}" style="
          padding:8px 20px;
          background:${bg};
          border:1px solid ${border};
          border-radius:8px;
          color:${clr};
          font-family:monospace;
          font-size:13px;
          cursor:pointer;
        ">${label}</button>
      `,
    }
  }

  /** Overlay: expanded sphere — Stay / Enter choice */
  _showExpandOverlay(entry) {
    this._removeOverlay()
    const { project, meta } = entry
    const s = this._overlayShell(entry)
    const [r, g, b] = [s.r, s.g, s.b]
    const hex = s.hex

    const div = document.createElement('div')
    div.id = 'port2d-overlay'
    div.style.cssText = s.wrap

    div.innerHTML = `
      <div style="font-size:11px;letter-spacing:2px;opacity:0.45;margin-bottom:5px;text-transform:uppercase;">${meta.label}</div>
      <div style="font-size:18px;font-weight:bold;margin-bottom:16px;color:${hex};text-shadow:0 0 10px ${hex};">${project.name}</div>
      <div style="display:flex;gap:10px;justify-content:center;margin-bottom:14px;">
        ${s.linkBtn(project.github, '⟐ GitHub', '170,221,255')}
        ${s.linkBtn(project.live,   '⟐ Live',   `${r},${g},${b}`)}
      </div>
      <div style="display:flex;gap:10px;justify-content:center;">
        ${s.actionBtn('port2d-stay',  '⦿ Stay Outside', 'rgba(255,255,255,0.06)', 'rgba(255,255,255,0.20)', '#fff')}
        ${s.actionBtn('port2d-enter', '⟐ Enter Node',   `rgba(${r},${g},${b},0.18)`, hex, hex)}
      </div>
      <div style="margin-top:11px;font-size:10px;opacity:0.30;">Click sphere again to enter · ESC to dismiss</div>
    `

    this._mountOverlay(div)

    document.getElementById('port2d-stay')?.addEventListener('click', () => {
      this._stayOutside(entry)
    })
    document.getElementById('port2d-enter')?.addEventListener('click', () => {
      this._enterSphere(entry)
    })
  }

  /** Overlay: Stay Outside orbital view — Enter / Back */
  _showOrbitalOverlay(entry) {
    this._removeOverlay()
    const { project } = entry
    const s   = this._overlayShell(entry)
    const hex = s.hex
    const [r, g, b] = [s.r, s.g, s.b]

    const div = document.createElement('div')
    div.id = 'port2d-overlay'
    div.style.cssText = s.wrap

    div.innerHTML = `
      <div style="font-size:14px;font-weight:bold;margin-bottom:12px;color:${hex};">${project.name}</div>
      <div style="display:flex;gap:8px;justify-content:center;margin-bottom:12px;">
        ${s.linkBtn(project.github, '⟐ GitHub', '170,221,255')}
        ${s.linkBtn(project.live,   '⟐ Live',   `${r},${g},${b}`)}
      </div>
      <div style="display:flex;gap:8px;justify-content:center;">
        ${s.actionBtn('port2d-goenter', '⟐ Enter Node', `rgba(${r},${g},${b},0.18)`, hex, hex)}
        ${s.actionBtn('port2d-goback',  '← Back',       'rgba(255,255,255,0.05)', 'rgba(255,255,255,0.15)', 'rgba(255,255,255,0.60)')}
      </div>
    `

    this._mountOverlay(div)

    document.getElementById('port2d-goenter')?.addEventListener('click', () => {
      this._enterSphere(entry)
    })
    document.getElementById('port2d-goback')?.addEventListener('click', () => {
      this._returnFromOrbital()
    })
  }

  /** Overlay: Inside sphere — links + Exit */
  _showInsideOverlay(entry) {
    this._removeOverlay()
    const { project } = entry
    const s   = this._overlayShell(entry)
    const hex = s.hex
    const [r, g, b] = [s.r, s.g, s.b]

    const div = document.createElement('div')
    div.id = 'port2d-overlay'
    div.style.cssText = s.wrap + `border-color: ${hex}44; box-shadow: 0 0 28px ${hex}22;`

    div.innerHTML = `
      <div style="font-size:11px;letter-spacing:2px;opacity:0.40;margin-bottom:4px;text-transform:uppercase;">⟐ Node Interior</div>
      <div style="font-size:16px;font-weight:bold;margin-bottom:14px;color:${hex};text-shadow:0 0 8px ${hex};">${project.name}</div>
      <div style="display:flex;gap:8px;justify-content:center;margin-bottom:13px;">
        ${s.linkBtn(project.github, '⟐ GitHub', '170,221,255')}
        ${s.linkBtn(project.live,   '⟐ Live',   `${r},${g},${b}`)}
      </div>
      ${s.actionBtn('port2d-exit', '← Exit Node', 'rgba(255,255,255,0.06)', 'rgba(255,255,255,0.18)', 'rgba(255,255,255,0.65)')}
      <div style="margin-top:9px;font-size:10px;opacity:0.28;">ESC to exit</div>
    `

    div.querySelector('#port2d-exit').style.width = '100%'
    this._mountOverlay(div)

    document.getElementById('port2d-exit')?.addEventListener('click', () => {
      this._exitSphere()
    })
  }

  _mountOverlay(div) {
    document.body.appendChild(div)
    this._overlay = div
    // Fade in
    div.style.opacity    = '0'
    div.style.transition = 'opacity 0.22s ease'
    requestAnimationFrame(() => { div.style.opacity = '1' })
  }

  _removeOverlay() {
    if (this._overlay) {
      this._overlay.remove()
      this._overlay = null
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Phase 2A — Stay outside (orbital view)
  // ─────────────────────────────────────────────────────────────────────────

  _stayOutside(entry) {
    this._removeOverlay()
    const cam = this.ctx.camera

    // Radial outward direction from scene center toward cluster
    const radial = new THREE.Vector3(
      entry.basePos.x, 0, entry.basePos.z
    ).normalize()

    const orbitPos = entry.basePos.clone().add(
      radial.multiplyScalar(SPHERE_RADIUS * 6.0)
    )
    orbitPos.y = entry.basePos.y + 0.8

    // Store camera state for return
    this._returnCam = {
      pos:    cam.position.clone(),
      target: entry.basePos.clone(),
    }

    window.dispatchEvent(new Event('omni:orbit-disable'))

    gsap.to(cam.position, {
      x: orbitPos.x, y: orbitPos.y, z: orbitPos.z,
      duration: 1.2,
      ease: 'power2.inOut',
      onUpdate: () => cam.lookAt(entry.basePos),
      onComplete: () => {
        cam.lookAt(entry.basePos)
        this._showOrbitalOverlay(entry)
      },
    })
  }

  _returnFromOrbital() {
    this._removeOverlay()
    const cam = this.ctx.camera
    const ret = this._returnCam

    const endPos    = ret?.pos    ?? new THREE.Vector3(0, SPHERE_Y, 0)
    const lookTarget = ret?.target ?? new THREE.Vector3(0, SPHERE_Y, -1)

    gsap.to(cam.position, {
      x: endPos.x, y: endPos.y, z: endPos.z,
      duration: 1.0,
      ease: 'power2.inOut',
      onUpdate: () => cam.lookAt(lookTarget),
      onComplete: () => {
        window.dispatchEvent(new Event('omni:orbit-enable'))
        this._collapseActive()
        this._returnCam = null
      },
    })
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Phase 2B — Enter sphere
  // ─────────────────────────────────────────────────────────────────────────

  _enterSphere(entry) {
    if (this._inside) return
    this._removeOverlay()

    const cam    = this.ctx.camera
    const target = entry.basePos.clone()

    // Store camera state for exit fly-back
    if (!this._returnCam) {
      this._returnCam = {
        pos:    cam.position.clone(),
        target: target.clone(),
      }
    }

    window.dispatchEvent(new Event('omni:orbit-disable'))
    this._inside = true

    // Fade sphere shell and torus so user can see through them
    gsap.to(entry.mesh.material,  { opacity: 0.07, duration: 0.50, delay: 0.35 })
    gsap.to(entry.torus.material, { opacity: 0.04, duration: 0.40, delay: 0.28 })

    // Fly camera inside
    gsap.to(cam.position, {
      x: target.x,
      y: target.y,
      z: target.z,
      duration: 1.40,
      ease: 'power3.inOut',
      onUpdate: () => cam.lookAt(target),
      onComplete: () => {
        this._spawnZone4(entry)
        this._showInsideOverlay(entry)
      },
    })
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Exit sphere
  // ─────────────────────────────────────────────────────────────────────────

  _exitSphere() {
    if (!this._inside || !this._active) return

    const entry = this._active
    const cam   = this.ctx.camera

    this._removeOverlay()
    this._destroyZone4(entry)

    // Restore sphere visuals
    gsap.to(entry.mesh.material,  { opacity: 0.75, duration: 0.50 })
    gsap.to(entry.torus.material, { opacity: 0.50, duration: 0.40 })

    // Fly camera back to stored position
    const ret     = this._returnCam
    const retPos  = ret?.pos    ?? entry.basePos.clone().add(new THREE.Vector3(0, 0, SPHERE_RADIUS * 7))
    const retLook = ret?.target ?? entry.basePos.clone()

    gsap.to(cam.position, {
      x: retPos.x, y: retPos.y, z: retPos.z,
      duration: 1.20,
      ease: 'power2.inOut',
      onUpdate: () => cam.lookAt(retLook),
      onComplete: () => {
        this._inside = false
        window.dispatchEvent(new Event('omni:orbit-enable'))
        this._collapseActive()
        this._returnCam = null
      },
    })
  }
}
