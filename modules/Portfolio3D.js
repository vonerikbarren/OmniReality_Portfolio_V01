/**
 * modules/Portfolio3D.js — ⟐Portfolio 3D Projects
 *
 * Follows the identical structure and module contract as Portfolio2D.js.
 * Reads data/portfolio.3d.json and spawns one sphere per project across
 * five 3D-discipline categories. Categories are arranged in an outer ring
 * (CLUSTER_RING_R = 65) beyond Portfolio2D's inner ring (R = 42), so both
 * can coexist in the scene simultaneously without spatial overlap.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Differences from Portfolio2D
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   DATA_PATH       ./data/portfolio.3d.json
 *   Nav trigger     omni:nav-select { item: '3D Projects', parent: '⟐Portfolio' }
 *   Cluster ring    R = 65  (outer ring — no overlap with 2D at R = 42)
 *   Group name      portfolio-3d
 *   Mesh prefix     port3d-
 *   Categories      three_js · blender · webgl · xr · generative
 *   Sphere material MeshPhysicalMaterial — metallic (metalness 0.35, transmission 0.25)
 *                   Evokes rendered 3D objects vs. the glassy 2D style
 *   Zone 4 canvas   Category-matched geometry wireframe preview
 *                   (icosahedron, mesh grid, shader bands, floor grid, fractal)
 *   Empty state     portfolio.3d.json ships empty — each empty category renders
 *                   a wireframe placeholder sphere at cluster center with an
 *                   "In Development" label. Placeholders are non-interactive.
 *                   All sphere-building code activates automatically once
 *                   projects are added to the JSON.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Four information zones (identical contract to Portfolio2D)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   Zone 1 — Above sphere     : project name Sprite, always billboards to camera
 *   Zone 2 — Front panel      : GitHub + Live links, glassmorphism CanvasTexture plane
 *   Zone 3 — On orbital ring  : category tag Sprite, orbits the sphere continuously
 *   Zone 4 — Inside sphere    : ⟐Platform (scale 0.055) + geometry viz CanvasTexture
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Interaction — identical two-phase flow as Portfolio2D
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   Click sphere  →  GSAP scale-up (×2.2)  →  HTML overlay (Stay / Enter)
 *   Stay Outside  →  camera radial orbital position  →  Enter / Back overlay
 *   Enter Node    →  camera flies inside  →  ⟐Platform + Zone 4 canvas spawn
 *   Exit          →  destroy Zone 4  →  camera flies back  →  orbit restored
 *   ESC           →  exits inside or collapses expanded sphere
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

const DATA_PATH      = './data/portfolio.3d.json'
const SPHERE_RADIUS  = 1.4
const SPHERE_SEGS    = 32
const CLUSTER_RING_R = 65       // outer ring — Portfolio2D occupies R=42
const SPHERE_Y       = 2        // eye level — matches Root camera rest height
const PLATFORM_SCALE = 0.055    // OmniPlatform outer ring r=20 → ~1.1 inside r=1.4

// ── Category configuration ───────────────────────────────────────────────────
//   Colors carry the visual identity of each 3D discipline.
//   subR = intra-cluster sphere distribution radius (active when projects exist).

const CATEGORY_META = {
  three_js:   { color: 0x00ccff, label: 'Three.js',   subR: 6 },
  blender:    { color: 0xff8800, label: 'Blender',     subR: 6 },
  webgl:      { color: 0xff4488, label: 'WebGL',       subR: 5 },
  xr:         { color: 0x44ffaa, label: 'XR / Spatial', subR: 5 },
  generative: { color: 0xffdd44, label: 'Generative',  subR: 5 },
}

// ── Canvas helpers ───────────────────────────────────────────────────────────

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

function hexStr(intColor) {
  return '#' + intColor.toString(16).padStart(6, '0')
}

function rgbBytes(intColor) {
  return [
    (intColor >> 16) & 0xff,
    (intColor >>  8) & 0xff,
     intColor        & 0xff,
  ]
}

// ── Main class ───────────────────────────────────────────────────────────────

export default class Portfolio3D {
  /**
   * @param {object} context  — { scene, camera, renderer, sizes, ticker }
   */
  constructor(context) {
    this.ctx = context

    this.group      = new THREE.Group()
    this.group.name = 'portfolio-3d'

    // Live project sphere entries
    this._entries = []

    // Wireframe placeholder meshes for empty categories (non-interactive)
    this._placeholders = []

    // Interaction state
    this._active    = null
    this._inside    = false
    this._platform  = null
    this._overlay   = null
    this._returnCam = null
    this._hovered   = null

    // Raycasting
    this._raycaster = new THREE.Raycaster()
    this._mouse     = new THREE.Vector2()

    // Reusable Vector3 (avoids per-frame allocation)
    this._v3 = new THREE.Vector3()

    // Time accumulator for float/orbit animations
    this._t = 0

    // Spawn guard
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

    // Slowly rotate placeholder wireframe spheres
    this._placeholders.forEach((ph, i) => {
      ph.rotation.y += delta * (0.12 + i * 0.04)
      ph.rotation.x += delta * 0.06
    })

    this._entries.forEach((entry) => {
      if (!entry.mesh) return

      // Float — idle sine drift on Y
      if (!entry._isExpanded && !this._inside) {
        const floatY = Math.sin(this._t * 0.5 + entry._floatPhase) * 0.12

        entry.mesh.position.y     = entry.basePos.y + floatY
        entry.z1Sprite.position.y = entry.basePos.y + SPHERE_RADIUS + 0.95 + floatY
        entry.light.position.y    = entry.basePos.y + floatY
      }

      // Zone 2 — position toward camera, billboard
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

      // Zone 3 — orbit category tag on XZ plane
      entry._orbitAngle += delta * entry._orbitSpeed
      const oa = entry._orbitAngle
      const or = SPHERE_RADIUS * 2.1
      const oc = entry.basePos
      entry.z3Sprite.position.set(
        oc.x + Math.cos(oa) * or,
        oc.y,
        oc.z + Math.sin(oa) * or,
      )

      // Torus rotation
      if (entry.torus) {
        entry.torus.rotation.y += delta * entry.torus._rotSpeed
      }

      // Zone 4 platform tick + billboard content plane
      if (entry.z4Plane) {
        entry.z4Plane.quaternion.copy(this.ctx.camera.quaternion)
      }
      if (entry.platform) {
        entry.platform.update(delta)
      }
    })

    if (!this._inside) {
      this._updateHover()
    }
  }

  destroy() {
    window.removeEventListener('omni:nav-select', this._onNavSelect)
    this._unbindCanvasEvents()
    this._removeOverlay()

    // Destroy live OmniPlatform instances
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
    this._entries      = []
    this._placeholders = []
  }

  // ── Navigation trigger ────────────────────────────────────────────────────

  _handleNavSelect(e) {
    const { item, parent } = e.detail || {}
    if (parent !== '⟐Portfolio' || item !== '3D Projects') return

    if (!this._spawned) {
      this._spawn()
    } else {
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
      console.error('[Portfolio3D] Failed to load portfolio.3d.json:', err)
      this._spawned = false
      return
    }

    this._buildFromData(data)
    this.ctx.scene.add(this.group)
    this._bindCanvasEvents()

    if (this._entries.length > 0) {
      this._playEntrance()
    }
  }

  // ── Build all geometry ────────────────────────────────────────────────────

  _buildFromData(data) {
    const cats    = data.portfolioCore.categories
    const catKeys = Object.keys(cats)

    catKeys.forEach((catKey, catIdx) => {
      const meta     = CATEGORY_META[catKey]
      const projects = cats[catKey]
      const catAngle = (catIdx / catKeys.length) * Math.PI * 2

      const cx = Math.cos(catAngle) * CLUSTER_RING_R
      const cz = Math.sin(catAngle) * CLUSTER_RING_R

      // Cluster header label — always shown regardless of project count
      this._buildClusterLabel(
        meta.label,
        cx, SPHERE_Y + 5.5, cz,
        meta.color,
        projects.length === 0,   // dim flag for empty clusters
      )

      if (projects.length === 0) {
        // Empty category — wireframe placeholder at cluster center
        this._buildPlaceholder(catKey, meta, cx, SPHERE_Y, cz)
      } else {
        // Live projects — sphere sub-ring
        projects.forEach((project, pIdx) => {
          const pAngle = (pIdx / projects.length) * Math.PI * 2
          const sx     = cx + Math.cos(pAngle) * meta.subR
          const sy     = SPHERE_Y
          const sz     = cz + Math.sin(pAngle) * meta.subR

          const entry = this._buildSphereEntry(project, catKey, meta, sx, sy, sz)
          this._entries.push(entry)
        })
      }
    })
  }

  // ── Placeholder for empty categories ─────────────────────────────────────

  _buildPlaceholder(catKey, meta, x, y, z) {
    // Wireframe sphere — visually distinct from live project spheres
    const geo = new THREE.SphereGeometry(1.8, 10, 8)
    const mat = new THREE.MeshBasicMaterial({
      color:       meta.color,
      wireframe:   true,
      transparent: true,
      opacity:     0.18,
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set(x, y, z)
    mesh.name = `port3d-placeholder-${catKey}`
    this.group.add(mesh)
    this._placeholders.push(mesh)

    // Dim point light
    const light = new THREE.PointLight(meta.color, 0.22, 8, 2)
    light.position.set(x, y, z)
    this.group.add(light)

    // "In Development" label above placeholder
    const label = this._makeNameSprite('In Development', meta.color, 0.30)
    label.position.set(x, y + 2.4, z)
    this.group.add(label)
  }

  // ── Staggered entrance for live spheres ───────────────────────────────────

  _playEntrance() {
    this._entries.forEach((entry, i) => {
      const delay = i * 0.05

      entry.mesh.material.opacity      = 0
      entry.z1Sprite.material.opacity  = 0
      entry.z2Plane.material.opacity   = 0
      entry.z3Sprite.material.opacity  = 0

      gsap.to(entry.mesh.material,     { opacity: 0.78, duration: 0.7, delay,           ease: 'power2.out' })
      gsap.to(entry.z1Sprite.material, { opacity: 1,    duration: 0.5, delay: delay + 0.10 })
      gsap.to(entry.z2Plane.material,  { opacity: 1,    duration: 0.5, delay: delay + 0.15 })
      gsap.to(entry.z3Sprite.material, { opacity: 0.8,  duration: 0.5, delay: delay + 0.20 })
    })
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SphereEntry builder
  // ─────────────────────────────────────────────────────────────────────────

  _buildSphereEntry(project, catKey, meta, x, y, z) {
    // ── Main sphere — metallic material evokes 3D rendered objects ─────────
    const sphereGeo = new THREE.SphereGeometry(SPHERE_RADIUS, SPHERE_SEGS, SPHERE_SEGS)
    const sphereMat = new THREE.MeshPhysicalMaterial({
      color:             meta.color,
      emissive:          meta.color,
      emissiveIntensity: 0.18,
      roughness:         0.15,
      metalness:         0.35,   // metallic — distinguishes 3D from 2D's glassy look
      transmission:      0.25,   // slight translucency, less than 2D's 0.5
      transparent:       true,
      opacity:           0.78,
      thickness:         2.0,
      side:              THREE.DoubleSide,
    })
    const mesh = new THREE.Mesh(sphereGeo, sphereMat)
    mesh.position.set(x, y, z)
    mesh.name     = `port3d-${project.name.replace(/[\s/]+/g, '-').toLowerCase()}`
    mesh.userData = { isPortfolio3D: true, project, catKey }
    this.group.add(mesh)

    // Point light
    const light = new THREE.PointLight(meta.color, 0.65, 7, 2)
    light.position.set(x, y, z)
    this.group.add(light)

    // Orbital torus — child of sphere
    const torusGeo = new THREE.TorusGeometry(SPHERE_RADIUS * 1.95, 0.04, 8, 64)
    const torusMat = new THREE.MeshBasicMaterial({
      color:       meta.color,
      transparent: true,
      opacity:     0.50,
    })
    const torus = new THREE.Mesh(torusGeo, torusMat)
    torus.rotation.x  = Math.PI / 2 + 0.18
    torus.rotation.z  = Math.random() * 0.24
    torus._rotSpeed   = 0.18 + Math.random() * 0.22
    mesh.add(torus)

    // Zone 1 — name label
    const z1Sprite = this._makeNameSprite(project.name, meta.color, 1.0)
    z1Sprite.position.set(x, y + SPHERE_RADIUS + 0.95, z)
    this.group.add(z1Sprite)

    // Zone 2 — links panel
    const z2Plane = this._makeLinksPanel(project, meta.color)
    z2Plane.position.set(x, y, z + SPHERE_RADIUS + 0.8)
    this.group.add(z2Plane)

    // Zone 3 — category tag (orbits)
    const z3Sprite    = this._makeCategoryTag(meta.label)
    const orbitAngle  = Math.random() * Math.PI * 2
    const orbitSpeed  = 0.28 + Math.random() * 0.22
    z3Sprite.position.set(x, y, z)
    this.group.add(z3Sprite)

    // Register with NodeManager for LOD
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
      basePos:     new THREE.Vector3(x, y, z),
      _floatPhase: Math.random() * Math.PI * 2,
      _orbitAngle: orbitAngle,
      _orbitSpeed: orbitSpeed,
      _isExpanded: false,
      platform:    null,
      z4Plane:     null,
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Zone 1 — Name sprite
  // ─────────────────────────────────────────────────────────────────────────

  _makeNameSprite(name, color, opacityMult = 1.0) {
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
    const mat = new THREE.SpriteMaterial({
      map:         tex,
      transparent: true,
      depthWrite:  false,
      opacity:     opacityMult,
    })
    const spr = new THREE.Sprite(mat)
    spr.scale.set(4.0, 0.75, 1)
    return spr
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Zone 2 — Links panel
  // ─────────────────────────────────────────────────────────────────────────

  _makeLinksPanel(project, color) {
    const W = 384, H = 160
    const canvas = document.createElement('canvas')
    canvas.width = W; canvas.height = H
    const ctx = canvas.getContext('2d')
    const [r, g, b] = rgbBytes(color)
    const hex = hexStr(color)

    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = 'rgba(255,255,255,0.07)'
    roundRect(ctx, 8, 8, W - 16, H - 16, 10)
    ctx.fill()

    ctx.strokeStyle = `rgba(${r},${g},${b},0.45)`
    ctx.lineWidth   = 1.5
    roundRect(ctx, 8, 8, W - 16, H - 16, 10)
    ctx.stroke()

    ctx.textAlign    = 'center'
    ctx.textBaseline = 'middle'

    // GitHub
    ctx.font        = '500 22px monospace'
    ctx.fillStyle   = '#aaddff'
    ctx.shadowColor = '#aaddff'
    ctx.shadowBlur  = 6
    ctx.fillText('⟐ GitHub', W / 2, 60)

    // Divider
    ctx.shadowBlur  = 0
    ctx.strokeStyle = `rgba(${r},${g},${b},0.22)`
    ctx.lineWidth   = 0.8
    ctx.beginPath()
    ctx.moveTo(32, 88); ctx.lineTo(W - 32, 88)
    ctx.stroke()

    // Live
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
    plane.name     = `port3d-z2-${project.name}`
    plane.userData = {
      isZ2:   true,
      github: project.github || '#',
      live:   project.live   || '#',
    }
    return plane
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Zone 3 — Category tag sprite
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

  _buildClusterLabel(label, x, y, z, color, isEmpty) {
    const W = 512, H = 72
    const canvas = document.createElement('canvas')
    canvas.width = W; canvas.height = H
    const ctx = canvas.getContext('2d')

    const text   = isEmpty ? `⟐ ${label}` : `⟐ ${label}`
    const alpha  = isEmpty ? 0.42 : 1.0    // dim empty cluster headers

    ctx.clearRect(0, 0, W, H)
    ctx.globalAlpha  = alpha
    ctx.font         = 'bold 24px monospace'
    ctx.textAlign    = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle    = hexStr(color)
    ctx.shadowColor  = hexStr(color)
    ctx.shadowBlur   = isEmpty ? 6 : 14
    ctx.fillText(text, W / 2, H / 2)
    ctx.globalAlpha  = 1

    const tex = new THREE.CanvasTexture(canvas)
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })
    const spr = new THREE.Sprite(mat)
    spr.scale.set(6.5, 0.91, 1)
    spr.position.set(x, y, z)
    this.group.add(spr)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Zone 4 — Inside sphere
  // ─────────────────────────────────────────────────────────────────────────

  _spawnZone4(entry) {
    if (entry.platform) return

    const platform = new OmniPlatform(this.ctx, entry.basePos.clone())
    platform.group.scale.setScalar(PLATFORM_SCALE)
    platform.init()
    entry.platform = platform
    this._platform = platform

    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 512
    this._drawZone4Canvas(canvas, entry.project, entry.catKey)

    const tex = new THREE.CanvasTexture(canvas)
    const mat = new THREE.MeshBasicMaterial({
      map:         tex,
      transparent: true,
      depthWrite:  false,
      side:        THREE.DoubleSide,
    })
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(1.45, 1.45), mat)
    plane.position.copy(entry.basePos)
    plane.position.y += 0.55
    plane.name = `port3d-z4-${entry.project.name}`
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
  // Zone 4 canvas — 3D geometry preview per category
  // ─────────────────────────────────────────────────────────────────────────

  _drawZone4Canvas(canvas, project, catKey) {
    const ctx = canvas.getContext('2d')
    const W = 512, H = 512
    ctx.clearRect(0, 0, W, H)

    // Dark background
    ctx.fillStyle = 'rgba(6,6,18,0.90)'
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

    // Category-matched geometry visualization
    const meta = CATEGORY_META[catKey]
    if (meta) {
      this._drawGeometryViz(ctx, catKey, meta.color, W, H)
    }

    // Links row
    ctx.font      = '18px monospace'
    ctx.textAlign = 'center'

    ctx.fillStyle   = '#aaddff'
    ctx.shadowColor = '#aaddff'
    ctx.shadowBlur  = 6
    ctx.fillText('⟐ GitHub', W / 2, H - 70)

    ctx.fillStyle   = '#aaffcc'
    ctx.shadowColor = '#aaffcc'
    ctx.fillText('⟐ Live →', W / 2, H - 38)
    ctx.shadowBlur  = 0
  }

  /**
   * Draw a category-matched 3D geometry preview on a Canvas 2D context.
   * Each discipline gets its own visual language:
   *
   *   three_js   → icosahedron edge wireframe
   *   blender    → subdivision surface mesh grid
   *   webgl      → GLSL-style shader gradient bands
   *   xr         → perspective floor grid + horizon
   *   generative → recursive fractal branch tree
   */
  _drawGeometryViz(ctx, catKey, color, W, H) {
    const cx  = W / 2
    const cy  = H / 2 + 22
    const hex = hexStr(color)
    const [r, g, b] = rgbBytes(color)

    switch (catKey) {

      // ── Three.js — icosahedron wireframe ─────────────────────────────────
      case 'three_js': {
        // Approximate projected icosahedron vertices (20 faces, 12 vertices)
        const phi = (1 + Math.sqrt(5)) / 2
        const ico = [
          [  0,  1,  phi], [  0, -1,  phi], [  0,  1, -phi], [  0, -1, -phi],
          [  1,  phi,  0], [ -1,  phi,  0], [  1, -phi,  0], [ -1, -phi,  0],
          [  phi,  0,  1], [ -phi,  0,  1], [  phi,  0, -1], [ -phi,  0, -1],
        ]
        const edges = [
          [0,1],[0,4],[0,5],[0,8],[0,9],
          [1,6],[1,7],[1,8],[1,9],
          [2,3],[2,4],[2,5],[2,10],[2,11],
          [3,6],[3,7],[3,10],[3,11],
          [4,5],[4,8],[4,10],
          [5,9],[5,11],
          [6,7],[6,8],[6,10],
          [7,9],[7,11],[8,10],[9,11],
        ]
        const scale  = 100
        const tilt   = 0.38        // mild x-rotation for perspective feel
        const project3D = ([x, y, z]) => {
          // Rotate slightly on X
          const yr = y * Math.cos(tilt) - z * Math.sin(tilt)
          const zr = y * Math.sin(tilt) + z * Math.cos(tilt)
          const fov = 3.5
          const d   = zr + fov
          return [cx + (x / d) * scale * 1.5, cy + (yr / d) * scale * 1.5]
        }

        ctx.strokeStyle = hex
        ctx.lineWidth   = 1.5
        ctx.globalAlpha = 0.65
        edges.forEach(([a, b2]) => {
          const [ax, ay] = project3D(ico[a])
          const [bx, by] = project3D(ico[b2])
          ctx.beginPath()
          ctx.moveTo(ax, ay)
          ctx.lineTo(bx, by)
          ctx.stroke()
        })
        // Vertex dots
        ctx.globalAlpha = 0.90
        ico.forEach((v) => {
          const [px, py] = project3D(v)
          ctx.beginPath()
          ctx.arc(px, py, 3, 0, Math.PI * 2)
          ctx.fillStyle = hex
          ctx.fill()
        })
        ctx.globalAlpha = 1
        break
      }

      // ── Blender — subdivision surface mesh grid ──────────────────────────
      case 'blender': {
        const gridSize = 8
        const cellW    = 360 / gridSize
        const cellH    = 280 / gridSize
        const offX     = cx - 180
        const offY     = cy - 140 - 10

        // Distort grid lines with a smooth sine-based displacement (subdivided mesh feel)
        const displace = (gx, gy) => {
          const nx = gx / gridSize, ny = gy / gridSize
          const dx = Math.sin(ny * Math.PI * 2.2) * 18
          const dy = Math.sin(nx * Math.PI * 1.8) * 14
          return [offX + gx * cellW + dx, offY + gy * cellH + dy]
        }

        ctx.strokeStyle = hex
        ctx.lineWidth   = 1.2
        ctx.globalAlpha = 0.55

        // Horizontal lines
        for (let gy = 0; gy <= gridSize; gy++) {
          ctx.beginPath()
          for (let gx = 0; gx <= gridSize; gx++) {
            const [px, py] = displace(gx, gy)
            gx === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)
          }
          ctx.stroke()
        }
        // Vertical lines
        for (let gx = 0; gx <= gridSize; gx++) {
          ctx.beginPath()
          for (let gy = 0; gy <= gridSize; gy++) {
            const [px, py] = displace(gx, gy)
            gy === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)
          }
          ctx.stroke()
        }

        // Highlight face centers
        ctx.globalAlpha = 0.35
        ctx.fillStyle   = hex
        for (let gy = 0; gy < gridSize; gy++) {
          for (let gx = 0; gx < gridSize; gx++) {
            const [px, py] = displace(gx + 0.5, gy + 0.5)
            ctx.beginPath()
            ctx.arc(px, py, 2, 0, Math.PI * 2)
            ctx.fill()
          }
        }
        ctx.globalAlpha = 1
        break
      }

      // ── WebGL — GLSL-style gradient spectrum bands ───────────────────────
      case 'webgl': {
        const bands = 12
        const bandH = 280 / bands
        const top   = cy - 140 - 10
        const left  = cx - 190

        for (let i = 0; i < bands; i++) {
          const t     = i / bands
          // Shift hue across spectrum — red → magenta → pink
          const hue   = 300 + t * 80
          const light = 30 + t * 45
          ctx.fillStyle   = `hsl(${hue},90%,${light}%)`
          ctx.globalAlpha = 0.55
          ctx.fillRect(left, top + i * bandH, 380, bandH - 1)

          // Scanline highlight
          ctx.fillStyle   = `rgba(${r},${g},${b},0.12)`
          ctx.globalAlpha = 1
          ctx.fillRect(left, top + i * bandH, 380, 1)
        }

        // Overlay: UV grid lines
        ctx.strokeStyle = `rgba(${r},${g},${b},0.30)`
        ctx.lineWidth   = 0.8
        const cols = 6
        for (let c = 0; c <= cols; c++) {
          const px = left + (c / cols) * 380
          ctx.beginPath()
          ctx.moveTo(px, top)
          ctx.lineTo(px, top + 280)
          ctx.stroke()
        }
        const rows = bands
        for (let row = 0; row <= rows; row++) {
          const py = top + (row / rows) * 280
          ctx.beginPath()
          ctx.moveTo(left, py)
          ctx.lineTo(left + 380, py)
          ctx.stroke()
        }

        // Center label
        ctx.font         = 'bold 14px monospace'
        ctx.textAlign    = 'center'
        ctx.fillStyle    = 'rgba(255,255,255,0.6)'
        ctx.shadowColor  = hex
        ctx.shadowBlur   = 8
        ctx.fillText('GLSL · vertex · fragment', cx, cy + 158)
        ctx.shadowBlur   = 0
        break
      }

      // ── XR — perspective floor grid + horizon ────────────────────────────
      case 'xr': {
        const horizon = cy - 30
        const vp      = { x: cx, y: horizon - 60 }    // vanishing point

        // Sky tone
        const grad = ctx.createLinearGradient(0, 70, 0, horizon)
        grad.addColorStop(0, 'rgba(10,10,25,0)')
        grad.addColorStop(1, `rgba(${r},${g},${b},0.08)`)
        ctx.fillStyle = grad
        ctx.fillRect(cx - 200, 70, 400, horizon - 70)

        // Horizon line
        ctx.strokeStyle = `rgba(${r},${g},${b},0.55)`
        ctx.lineWidth   = 1.5
        ctx.beginPath()
        ctx.moveTo(cx - 220, horizon)
        ctx.lineTo(cx + 220, horizon)
        ctx.stroke()

        // Floor grid — perspective lines converging to vanishing point
        const gridLines = 10
        const floorBot  = horizon + 180
        const floorW    = 420

        ctx.globalAlpha = 0.45
        // Converging lines (left→vp, right→vp)
        for (let i = 0; i <= gridLines; i++) {
          const t  = i / gridLines
          const gx = cx - floorW / 2 + t * floorW
          ctx.beginPath()
          ctx.moveTo(gx, floorBot)
          ctx.lineTo(vp.x, vp.y)
          ctx.strokeStyle = `rgba(${r},${g},${b},${0.5 - t * 0.35})` // fade toward center
          ctx.lineWidth   = 0.9
          ctx.stroke()
        }
        // Horizontal grid rows
        for (let i = 1; i <= 6; i++) {
          const t  = i / 7
          const py = horizon + t * (floorBot - horizon)
          const hw = (floorW / 2) * (t * 0.9 + 0.1)
          ctx.beginPath()
          ctx.moveTo(cx - hw, py)
          ctx.lineTo(cx + hw, py)
          ctx.strokeStyle = `rgba(${r},${g},${b},0.35)`
          ctx.lineWidth   = 0.8
          ctx.stroke()
        }
        ctx.globalAlpha = 1

        // VR headset silhouette hint (two lens circles)
        ctx.strokeStyle = `rgba(${r},${g},${b},0.55)`
        ctx.lineWidth   = 2
        ctx.beginPath()
        ctx.arc(cx - 30, vp.y - 12, 18, 0, Math.PI * 2)
        ctx.stroke()
        ctx.beginPath()
        ctx.arc(cx + 30, vp.y - 12, 18, 0, Math.PI * 2)
        ctx.stroke()
        // Bridge
        ctx.beginPath()
        ctx.moveTo(cx - 12, vp.y - 12)
        ctx.lineTo(cx + 12, vp.y - 12)
        ctx.stroke()
        break
      }

      // ── Generative — recursive fractal branch tree ───────────────────────
      case 'generative': {
        const drawBranch = (x, y, angle, length, depth) => {
          if (depth === 0 || length < 3) return

          const ex = x + Math.cos(angle) * length
          const ey = y + Math.sin(angle) * length

          const t    = 1 - depth / 8
          const a    = 0.1 + (1 - t) * 0.55
          ctx.strokeStyle = hex
          ctx.lineWidth   = (depth * 0.9)
          ctx.globalAlpha = a

          ctx.beginPath()
          ctx.moveTo(x, y)
          ctx.lineTo(ex, ey)
          ctx.stroke()

          const spread = 0.38 + depth * 0.02
          drawBranch(ex, ey, angle - spread, length * 0.70, depth - 1)
          drawBranch(ex, ey, angle + spread, length * 0.68, depth - 1)
          // Occasional triple branch for generative feel
          if (depth % 3 === 0) {
            drawBranch(ex, ey, angle, length * 0.62, depth - 1)
          }
        }

        // Trunk starts at bottom-center, grows upward
        drawBranch(cx, cy + 145, -Math.PI / 2, 80, 8)
        ctx.globalAlpha = 1

        // Scattered leaf dots at tips
        ctx.fillStyle   = hex
        ctx.globalAlpha = 0.30
        for (let i = 0; i < 30; i++) {
          const angle = Math.random() * Math.PI * 2
          const dist  = 50 + Math.random() * 120
          const lx    = cx + Math.cos(angle) * dist * 0.85
          const ly    = (cy - 80) + Math.sin(angle) * dist * 0.55
          if (ly > 68 && ly < H - 80) {
            ctx.beginPath()
            ctx.arc(lx, ly, 1.5 + Math.random() * 2, 0, Math.PI * 2)
            ctx.fill()
          }
        }
        ctx.globalAlpha = 1
        break
      }
    }
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
    if (this._inside) return

    this._raycaster.setFromCamera(this._mouse, this.ctx.camera)

    // Zone 2 click — open link in new tab
    const z2Planes = this._entries.map((en) => en.z2Plane)
    const z2Hits   = this._raycaster.intersectObjects(z2Planes, false)
    if (z2Hits.length > 0) {
      const ud  = z2Hits[0].object.userData
      const url = e.shiftKey ? ud.github : ud.live
      if (url && url !== '#') window.open(url, '_blank')
      return
    }

    // Sphere click — placeholders are excluded (not in _entries)
    const meshes = this._entries.map((e) => e.mesh)
    const hits   = this._raycaster.intersectObjects(meshes, false)
    if (hits.length === 0) return

    const entry = this._entries.find((e) => e.mesh === hits[0].object)
    if (!entry) return

    if (entry._isExpanded) {
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
    gsap.to(entry.mesh.material, { emissiveIntensity: 0.18, duration: 0.30 })
    this._removeOverlay()
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HTML overlays — shared shell + three states
  // ─────────────────────────────────────────────────────────────────────────

  _overlayShell(entry) {
    const [r, g, b] = rgbBytes(entry.meta.color)
    const hex       = hexStr(entry.meta.color)
    return {
      wrap: `
        position: fixed;
        bottom: 120px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(6,6,18,0.86);
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
        box-shadow: 0 8px 32px rgba(0,0,0,0.55), 0 0 24px rgba(${r},${g},${b},0.10);
      `,
      hex, r, g, b,
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

  _showExpandOverlay(entry) {
    this._removeOverlay()
    const { project, meta } = entry
    const s = this._overlayShell(entry)
    const { hex, r, g, b } = s

    const div = document.createElement('div')
    div.id = 'port3d-overlay'
    div.style.cssText = s.wrap

    div.innerHTML = `
      <div style="font-size:11px;letter-spacing:2px;opacity:0.45;margin-bottom:5px;text-transform:uppercase;">${meta.label}</div>
      <div style="font-size:18px;font-weight:bold;margin-bottom:16px;color:${hex};text-shadow:0 0 10px ${hex};">${project.name}</div>
      <div style="display:flex;gap:10px;justify-content:center;margin-bottom:14px;">
        ${s.linkBtn(project.github, '⟐ GitHub', '170,221,255')}
        ${s.linkBtn(project.live,   '⟐ Live',   `${r},${g},${b}`)}
      </div>
      <div style="display:flex;gap:10px;justify-content:center;">
        ${s.actionBtn('port3d-stay',  '⦿ Stay Outside', 'rgba(255,255,255,0.06)', 'rgba(255,255,255,0.20)', '#fff')}
        ${s.actionBtn('port3d-enter', '⟐ Enter Node',   `rgba(${r},${g},${b},0.18)`, hex, hex)}
      </div>
      <div style="margin-top:11px;font-size:10px;opacity:0.30;">Click sphere again to enter · ESC to dismiss</div>
    `

    this._mountOverlay(div)
    document.getElementById('port3d-stay')?.addEventListener('click',  () => this._stayOutside(entry))
    document.getElementById('port3d-enter')?.addEventListener('click', () => this._enterSphere(entry))
  }

  _showOrbitalOverlay(entry) {
    this._removeOverlay()
    const { project } = entry
    const s = this._overlayShell(entry)
    const { hex, r, g, b } = s

    const div = document.createElement('div')
    div.id = 'port3d-overlay'
    div.style.cssText = s.wrap

    div.innerHTML = `
      <div style="font-size:14px;font-weight:bold;margin-bottom:12px;color:${hex};">${project.name}</div>
      <div style="display:flex;gap:8px;justify-content:center;margin-bottom:12px;">
        ${s.linkBtn(project.github, '⟐ GitHub', '170,221,255')}
        ${s.linkBtn(project.live,   '⟐ Live',   `${r},${g},${b}`)}
      </div>
      <div style="display:flex;gap:8px;justify-content:center;">
        ${s.actionBtn('port3d-goenter', '⟐ Enter Node', `rgba(${r},${g},${b},0.18)`, hex, hex)}
        ${s.actionBtn('port3d-goback',  '← Back',       'rgba(255,255,255,0.05)', 'rgba(255,255,255,0.15)', 'rgba(255,255,255,0.60)')}
      </div>
    `

    this._mountOverlay(div)
    document.getElementById('port3d-goenter')?.addEventListener('click', () => this._enterSphere(entry))
    document.getElementById('port3d-goback')?.addEventListener('click',  () => this._returnFromOrbital())
  }

  _showInsideOverlay(entry) {
    this._removeOverlay()
    const { project } = entry
    const s = this._overlayShell(entry)
    const { hex, r, g, b } = s

    const div = document.createElement('div')
    div.id = 'port3d-overlay'
    div.style.cssText = s.wrap + `border-color:${hex}44; box-shadow:0 0 28px ${hex}22;`

    div.innerHTML = `
      <div style="font-size:11px;letter-spacing:2px;opacity:0.40;margin-bottom:4px;text-transform:uppercase;">⟐ Node Interior</div>
      <div style="font-size:16px;font-weight:bold;margin-bottom:14px;color:${hex};text-shadow:0 0 8px ${hex};">${project.name}</div>
      <div style="display:flex;gap:8px;justify-content:center;margin-bottom:13px;">
        ${s.linkBtn(project.github, '⟐ GitHub', '170,221,255')}
        ${s.linkBtn(project.live,   '⟐ Live',   `${r},${g},${b}`)}
      </div>
      ${s.actionBtn('port3d-exit', '← Exit Node', 'rgba(255,255,255,0.06)', 'rgba(255,255,255,0.18)', 'rgba(255,255,255,0.65)')}
      <div style="margin-top:9px;font-size:10px;opacity:0.28;">ESC to exit</div>
    `

    const exitBtn = div.querySelector('#port3d-exit')
    if (exitBtn) exitBtn.style.width = '100%'

    this._mountOverlay(div)
    document.getElementById('port3d-exit')?.addEventListener('click', () => this._exitSphere())
  }

  _mountOverlay(div) {
    document.body.appendChild(div)
    this._overlay = div
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

    // Radial direction from scene center outward toward this cluster
    const radial = new THREE.Vector3(entry.basePos.x, 0, entry.basePos.z).normalize()
    const orbitPos = entry.basePos.clone().add(radial.multiplyScalar(SPHERE_RADIUS * 6.0))
    orbitPos.y = entry.basePos.y + 0.8

    this._returnCam = { pos: cam.position.clone(), target: entry.basePos.clone() }
    window.dispatchEvent(new Event('omni:orbit-disable'))

    gsap.to(cam.position, {
      x: orbitPos.x, y: orbitPos.y, z: orbitPos.z,
      duration: 1.2,
      ease: 'power2.inOut',
      onUpdate:   () => cam.lookAt(entry.basePos),
      onComplete: () => {
        cam.lookAt(entry.basePos)
        this._showOrbitalOverlay(entry)
      },
    })
  }

  _returnFromOrbital() {
    this._removeOverlay()
    const cam    = this.ctx.camera
    const ret    = this._returnCam
    const endPos = ret?.pos    ?? new THREE.Vector3(0, SPHERE_Y, 0)
    const look   = ret?.target ?? new THREE.Vector3(0, SPHERE_Y, -1)

    gsap.to(cam.position, {
      x: endPos.x, y: endPos.y, z: endPos.z,
      duration: 1.0,
      ease: 'power2.inOut',
      onUpdate:   () => cam.lookAt(look),
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

    if (!this._returnCam) {
      this._returnCam = { pos: cam.position.clone(), target: target.clone() }
    }

    window.dispatchEvent(new Event('omni:orbit-disable'))
    this._inside = true

    gsap.to(entry.mesh.material,  { opacity: 0.07, duration: 0.50, delay: 0.35 })
    gsap.to(entry.torus.material, { opacity: 0.04, duration: 0.40, delay: 0.28 })

    gsap.to(cam.position, {
      x: target.x, y: target.y, z: target.z,
      duration: 1.40,
      ease: 'power3.inOut',
      onUpdate:   () => cam.lookAt(target),
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

    gsap.to(entry.mesh.material,  { opacity: 0.78, duration: 0.50 })
    gsap.to(entry.torus.material, { opacity: 0.50, duration: 0.40 })

    const ret     = this._returnCam
    const retPos  = ret?.pos    ?? entry.basePos.clone().add(new THREE.Vector3(0, 0, SPHERE_RADIUS * 7))
    const retLook = ret?.target ?? entry.basePos.clone()

    gsap.to(cam.position, {
      x: retPos.x, y: retPos.y, z: retPos.z,
      duration: 1.20,
      ease: 'power2.inOut',
      onUpdate:   () => cam.lookAt(retLook),
      onComplete: () => {
        this._inside = false
        window.dispatchEvent(new Event('omni:orbit-enable'))
        this._collapseActive()
        this._returnCam = null
      },
    })
  }
}
