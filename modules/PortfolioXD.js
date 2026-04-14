/**
 * modules/PortfolioXD.js — ⟐Portfolio XD Projects
 *
 * Follows the identical structure and module contract as Portfolio2D.js
 * and Portfolio3D.js. Reads data/portfolio.xd.json and spawns one sphere
 * per project across five XD-discipline categories. Categories are arranged
 * on the outermost ring (CLUSTER_RING_R = 88) — beyond Portfolio2D (R=42)
 * and Portfolio3D (R=65) — so all three portfolio modules coexist spatially
 * without overlap.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Differences from Portfolio2D / Portfolio3D
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   DATA_PATH       ./data/portfolio.xd.json
 *   Nav trigger     omni:nav-select { item: 'XD Projects', parent: '⟐Portfolio' }
 *   Cluster ring    R = 88  (outermost ring)
 *   Group name      portfolio-xd
 *   Mesh prefix     portxd-
 *   Categories      ux_design · ui_design · prototypes · case_studies · ar_vr
 *   Sphere material MeshPhysicalMaterial — frosted glass / iridescent
 *                   (metalness 0.0, roughness 0.0, transmission 0.70, iridescence 1.0)
 *                   Evokes interface screens and polished UX surfaces
 *   Zone 4 canvas   Category-matched XD preview:
 *                     ux_design    → user journey flow diagram
 *                     ui_design    → component library grid
 *                     prototypes   → wireframe screen stack
 *                     case_studies → timeline + annotation rows
 *                     ar_vr        → depth-layered spatial UI panels
 *   Empty state     portfolio.xd.json ships empty — wireframe placeholder sphere
 *                   at each cluster center with "In Development" label.
 *                   All sphere-building activates once projects are added to JSON.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Four information zones (identical contract to Portfolio2D / Portfolio3D)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   Zone 1 — Above sphere     : project name Sprite, always billboards to camera
 *   Zone 2 — Front panel      : GitHub + Live links, glassmorphism CanvasTexture plane
 *   Zone 3 — On orbital ring  : category tag Sprite, orbits the sphere continuously
 *   Zone 4 — Inside sphere    : ⟐Platform (scale 0.055) + XD viz CanvasTexture plane
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Interaction — identical two-phase flow
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

const DATA_PATH      = './data/portfolio.xd.json'
const SPHERE_RADIUS  = 1.4
const SPHERE_SEGS    = 32
const CLUSTER_RING_R = 88       // outermost ring — Portfolio3D at R=65, 2D at R=42
const SPHERE_Y       = 2        // eye level — matches Root camera rest height
const PLATFORM_SCALE = 0.055    // OmniPlatform outer ring r=20 → ~1.1 inside r=1.4

// ── Category configuration ───────────────────────────────────────────────────
//   Colors reflect the warm, human-centered language of XD discipline.
//   subR = intra-cluster sphere distribution radius.

const CATEGORY_META = {
  ux_design:    { color: 0xff6699, label: 'UX Design',      subR: 6 },
  ui_design:    { color: 0x99ccff, label: 'UI Design',       subR: 6 },
  prototypes:   { color: 0xccff99, label: 'Prototypes',      subR: 5 },
  case_studies: { color: 0xffcc55, label: 'Case Studies',    subR: 5 },
  ar_vr:        { color: 0xcc99ff, label: 'AR / VR',         subR: 5 },
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

export default class PortfolioXD {
  /**
   * @param {object} context  — { scene, camera, renderer, sizes, ticker }
   */
  constructor(context) {
    this.ctx = context

    this.group      = new THREE.Group()
    this.group.name = 'portfolio-xd'

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

    // Slowly drift placeholder wireframe spheres
    this._placeholders.forEach((ph, i) => {
      ph.rotation.y += delta * (0.10 + i * 0.03)
      ph.rotation.x += delta * 0.05
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
    if (parent !== 'portfolio' || item !== 'XD Projects') return

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
      console.error('[PortfolioXD] Failed to load portfolio.xd.json:', err)
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

      // Cluster header — always shown, dimmed when empty
      this._buildClusterLabel(
        meta.label,
        cx, SPHERE_Y + 5.5, cz,
        meta.color,
        projects.length === 0,
      )

      if (projects.length === 0) {
        this._buildPlaceholder(catKey, meta, cx, SPHERE_Y, cz)
      } else {
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
    const geo = new THREE.SphereGeometry(1.8, 10, 8)
    const mat = new THREE.MeshBasicMaterial({
      color:       meta.color,
      wireframe:   true,
      transparent: true,
      opacity:     0.16,
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set(x, y, z)
    mesh.name = `portxd-placeholder-${catKey}`
    this.group.add(mesh)
    this._placeholders.push(mesh)

    const light = new THREE.PointLight(meta.color, 0.20, 8, 2)
    light.position.set(x, y, z)
    this.group.add(light)

    const label = this._makeNameSprite('In Development', meta.color, 0.28)
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

      gsap.to(entry.mesh.material,     { opacity: 0.72, duration: 0.7, delay,           ease: 'power2.out' })
      gsap.to(entry.z1Sprite.material, { opacity: 1,    duration: 0.5, delay: delay + 0.10 })
      gsap.to(entry.z2Plane.material,  { opacity: 1,    duration: 0.5, delay: delay + 0.15 })
      gsap.to(entry.z3Sprite.material, { opacity: 0.8,  duration: 0.5, delay: delay + 0.20 })
    })
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SphereEntry builder
  // ─────────────────────────────────────────────────────────────────────────

  _buildSphereEntry(project, catKey, meta, x, y, z) {
    // Frosted glass / iridescent — evokes polished UI surfaces and screens
    const sphereGeo = new THREE.SphereGeometry(SPHERE_RADIUS, SPHERE_SEGS, SPHERE_SEGS)
    const sphereMat = new THREE.MeshPhysicalMaterial({
      color:              meta.color,
      emissive:           meta.color,
      emissiveIntensity:  0.15,
      roughness:          0.00,
      metalness:          0.00,
      transmission:       0.70,   // highly transparent — screen-like
      transparent:        true,
      opacity:            0.72,
      thickness:          1.20,
      iridescence:        1.00,   // thin-film shimmer — XD design language
      iridescenceIOR:     1.40,
      iridescenceThicknessRange: [100, 600],
      side:               THREE.DoubleSide,
    })
    const mesh = new THREE.Mesh(sphereGeo, sphereMat)
    mesh.position.set(x, y, z)
    mesh.name     = `portxd-${project.name.replace(/[\s/]+/g, '-').toLowerCase()}`
    mesh.userData = { isPortfolioXD: true, project, catKey }
    this.group.add(mesh)

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

    // Zone 1 — name label sprite
    const z1Sprite = this._makeNameSprite(project.name, meta.color, 1.0)
    z1Sprite.position.set(x, y + SPHERE_RADIUS + 0.95, z)
    this.group.add(z1Sprite)

    // Zone 2 — links panel
    const z2Plane = this._makeLinksPanel(project, meta.color)
    z2Plane.position.set(x, y, z + SPHERE_RADIUS + 0.8)
    this.group.add(z2Plane)

    // Zone 3 — category tag sprite (orbits)
    const z3Sprite   = this._makeCategoryTag(meta.label)
    const orbitAngle = Math.random() * Math.PI * 2
    const orbitSpeed = 0.28 + Math.random() * 0.22
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

    ctx.font        = '500 22px monospace'
    ctx.fillStyle   = '#aaddff'
    ctx.shadowColor = '#aaddff'
    ctx.shadowBlur  = 6
    ctx.fillText('⟐ GitHub', W / 2, 60)

    ctx.shadowBlur  = 0
    ctx.strokeStyle = `rgba(${r},${g},${b},0.22)`
    ctx.lineWidth   = 0.8
    ctx.beginPath()
    ctx.moveTo(32, 88); ctx.lineTo(W - 32, 88)
    ctx.stroke()

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
    plane.name     = `portxd-z2-${project.name}`
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

    ctx.clearRect(0, 0, W, H)
    ctx.globalAlpha  = isEmpty ? 0.42 : 1.0
    ctx.font         = 'bold 24px monospace'
    ctx.textAlign    = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle    = hexStr(color)
    ctx.shadowColor  = hexStr(color)
    ctx.shadowBlur   = isEmpty ? 6 : 14
    ctx.fillText(`⟐ ${label}`, W / 2, H / 2)
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
    plane.name = `portxd-z4-${entry.project.name}`
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
  // Zone 4 canvas — XD discipline preview per category
  // ─────────────────────────────────────────────────────────────────────────

  _drawZone4Canvas(canvas, project, catKey) {
    const ctx = canvas.getContext('2d')
    const W = 512, H = 512
    ctx.clearRect(0, 0, W, H)

    ctx.fillStyle = 'rgba(5,5,16,0.92)'
    roundRect(ctx, 0, 0, W, H, 18)
    ctx.fill()

    ctx.font         = 'bold 24px monospace'
    ctx.textAlign    = 'center'
    ctx.textBaseline = 'alphabetic'
    ctx.fillStyle    = '#ffffff'
    ctx.shadowColor  = '#ffffff'
    ctx.shadowBlur   = 10
    ctx.fillText(project.name, W / 2, 50)
    ctx.shadowBlur   = 0

    const meta = CATEGORY_META[catKey]
    if (meta) {
      this._drawXDViz(ctx, catKey, meta.color, W, H)
    }

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
   * Draw a category-matched XD discipline preview on a Canvas 2D context.
   *
   *   ux_design    → user journey flow diagram (nodes + labeled arrows)
   *   ui_design    → component library grid (buttons, fields, cards, tags)
   *   prototypes   → wireframe screen stack (layered phone frames)
   *   case_studies → timeline + annotation rows (dated milestone track)
   *   ar_vr        → depth-layered spatial UI panels (three receding planes)
   */
  _drawXDViz(ctx, catKey, color, W, H) {
    const cx  = W / 2
    const cy  = H / 2 + 22
    const hex = hexStr(color)
    const [r, g, b] = rgbBytes(color)

    switch (catKey) {

      // ── UX Design — user journey flow diagram ────────────────────────────
      case 'ux_design': {
        // Five journey stage nodes connected by labeled arrows
        const stages = ['Discover', 'Define', 'Ideate', 'Prototype', 'Test']
        const nodeW  = 64, nodeH = 30, nodeR = 6
        const totalW = stages.length * nodeW + (stages.length - 1) * 28
        const startX = cx - totalW / 2 + nodeW / 2

        stages.forEach((label, i) => {
          const nx = startX + i * (nodeW + 28)
          const ny = cy - 14

          // Node background
          ctx.fillStyle   = `rgba(${r},${g},${b},0.16)`
          ctx.globalAlpha = 1
          roundRect(ctx, nx - nodeW / 2, ny, nodeW, nodeH, nodeR)
          ctx.fill()

          ctx.strokeStyle = `rgba(${r},${g},${b},0.65)`
          ctx.lineWidth   = 1.5
          roundRect(ctx, nx - nodeW / 2, ny, nodeW, nodeH, nodeR)
          ctx.stroke()

          // Label
          ctx.font         = 'bold 11px monospace'
          ctx.textAlign    = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillStyle    = hex
          ctx.shadowColor  = hex
          ctx.shadowBlur   = 4
          ctx.fillText(label, nx, ny + nodeH / 2)
          ctx.shadowBlur   = 0

          // Arrow to next node
          if (i < stages.length - 1) {
            const ax = nx + nodeW / 2 + 2
            const ay = ny + nodeH / 2
            const bx = ax + 24
            ctx.strokeStyle  = `rgba(${r},${g},${b},0.45)`
            ctx.lineWidth    = 1.2
            ctx.beginPath()
            ctx.moveTo(ax, ay)
            ctx.lineTo(bx, ay)
            ctx.stroke()
            // Arrowhead
            ctx.beginPath()
            ctx.moveTo(bx,     ay)
            ctx.lineTo(bx - 5, ay - 4)
            ctx.lineTo(bx - 5, ay + 4)
            ctx.closePath()
            ctx.fillStyle = `rgba(${r},${g},${b},0.45)`
            ctx.fill()
          }
        })

        // Emotion curve below nodes — wavy line tracking user sentiment
        const curveTop = cy + 40
        ctx.strokeStyle = `rgba(${r},${g},${b},0.50)`
        ctx.lineWidth   = 2
        ctx.beginPath()
        stages.forEach((_, i) => {
          const nx  = startX + i * (nodeW + 28)
          const amp = [18, -10, -22, 12, 24][i]   // frustration → delight arc
          const py  = curveTop + amp
          i === 0 ? ctx.moveTo(nx, py) : ctx.lineTo(nx, py)
        })
        ctx.stroke()

        // Sentiment dots on curve
        stages.forEach((_, i) => {
          const nx  = startX + i * (nodeW + 28)
          const amp = [18, -10, -22, 12, 24][i]
          ctx.beginPath()
          ctx.arc(nx, curveTop + amp, 4, 0, Math.PI * 2)
          ctx.fillStyle   = hex
          ctx.globalAlpha = 0.75
          ctx.fill()
        })
        ctx.globalAlpha = 1

        // Axis label
        ctx.font         = '11px monospace'
        ctx.textAlign    = 'left'
        ctx.fillStyle    = 'rgba(255,255,255,0.30)'
        ctx.fillText('user sentiment', 28, curveTop + 55)
        break
      }

      // ── UI Design — component library grid ──────────────────────────────
      case 'ui_design': {
        const top  = cy - 155
        const left = cx - 195

        // ── Row 1: Primary button + Ghost button ────────────────────────────
        const drawButton = (bx, by, bw, bh, label, filled) => {
          roundRect(ctx, bx, by, bw, bh, 6)
          if (filled) {
            ctx.fillStyle   = `rgba(${r},${g},${b},0.22)`
            ctx.globalAlpha = 1
            ctx.fill()
          }
          ctx.strokeStyle = `rgba(${r},${g},${b},0.60)`
          ctx.lineWidth   = 1.5
          roundRect(ctx, bx, by, bw, bh, 6)
          ctx.stroke()
          ctx.font         = 'bold 12px monospace'
          ctx.textAlign    = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillStyle    = hex
          ctx.shadowColor  = hex
          ctx.shadowBlur   = 3
          ctx.fillText(label, bx + bw / 2, by + bh / 2)
          ctx.shadowBlur   = 0
        }
        drawButton(left,       top,      148, 32, 'Primary',   true)
        drawButton(left + 158, top,      148, 32, 'Ghost',     false)

        // ── Row 2: Text input field ─────────────────────────────────────────
        const fy = top + 50
        ctx.strokeStyle = `rgba(${r},${g},${b},0.35)`
        ctx.lineWidth   = 1.2
        roundRect(ctx, left, fy, 310, 34, 5)
        ctx.stroke()
        ctx.font         = '12px monospace'
        ctx.textAlign    = 'left'
        ctx.textBaseline = 'middle'
        ctx.fillStyle    = `rgba(${r},${g},${b},0.40)`
        ctx.fillText('⟐ Input field placeholder…', left + 10, fy + 17)

        // ── Row 3: Cards ───────────────────────────────────────────────────
        const cardY = top + 104
        for (let c = 0; c < 3; c++) {
          const cardX = left + c * 104
          ctx.fillStyle   = `rgba(${r},${g},${b},0.07)`
          ctx.globalAlpha = 1
          roundRect(ctx, cardX, cardY, 96, 72, 7)
          ctx.fill()
          ctx.strokeStyle = `rgba(${r},${g},${b},0.25)`
          ctx.lineWidth   = 1
          roundRect(ctx, cardX, cardY, 96, 72, 7)
          ctx.stroke()
          // Card thumbnail bar
          ctx.fillStyle   = `rgba(${r},${g},${b},0.20)`
          roundRect(ctx, cardX + 6, cardY + 6, 84, 30, 4)
          ctx.fill()
          // Card text lines
          ctx.fillStyle = `rgba(255,255,255,0.18)`
          ctx.fillRect(cardX + 6, cardY + 44, 50, 5)
          ctx.fillRect(cardX + 6, cardY + 54, 34, 4)
        }

        // ── Row 4: Tag chips ───────────────────────────────────────────────
        const tagY  = top + 196
        const tags  = ['Design', 'System', 'Tokens', 'A11y']
        let tagX    = left
        tags.forEach((tag) => {
          const tw = tag.length * 9 + 18
          ctx.fillStyle   = `rgba(${r},${g},${b},0.12)`
          roundRect(ctx, tagX, tagY, tw, 22, 11)
          ctx.fill()
          ctx.strokeStyle = `rgba(${r},${g},${b},0.40)`
          ctx.lineWidth   = 1
          roundRect(ctx, tagX, tagY, tw, 22, 11)
          ctx.stroke()
          ctx.font         = '11px monospace'
          ctx.textAlign    = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillStyle    = hex
          ctx.fillText(tag, tagX + tw / 2, tagY + 11)
          tagX += tw + 8
        })

        // ── Row 5: Icon row ────────────────────────────────────────────────
        const iconY   = top + 238
        const symbols = ['⟐', '⬢', '⦿', '☰', '⚇', '✕']
        symbols.forEach((sym, i) => {
          ctx.font         = '18px monospace'
          ctx.textAlign    = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillStyle    = `rgba(${r},${g},${b},0.70)`
          ctx.fillText(sym, left + i * 52 + 26, iconY + 14)
        })

        // Grid label
        ctx.font      = '11px monospace'
        ctx.textAlign = 'left'
        ctx.fillStyle = 'rgba(255,255,255,0.25)'
        ctx.fillText('⟐ Component Library', left, top + 295)
        break
      }

      // ── Prototypes — wireframe screen stack ──────────────────────────────
      case 'prototypes': {
        // Three overlapping phone-shaped wireframes at different depths
        const frames = [
          { x: cx - 40, y: cy - 100, w: 80,  h: 130, depth: 0.50 },
          { x: cx - 20, y: cy - 115, w: 80,  h: 130, depth: 0.75 },
          { x: cx,      y: cy - 130, w: 80,  h: 130, depth: 1.00 },
        ]

        frames.forEach(({ x, y, w, h, depth }) => {
          // Phone frame
          ctx.strokeStyle = `rgba(${r},${g},${b},${depth * 0.65})`
          ctx.lineWidth   = 1.5
          roundRect(ctx, x, y, w, h, 10)
          ctx.stroke()

          // Screen inner
          ctx.strokeStyle = `rgba(${r},${g},${b},${depth * 0.30})`
          ctx.lineWidth   = 0.8
          roundRect(ctx, x + 5, y + 12, w - 10, h - 22, 5)
          ctx.stroke()

          // Content wireframe lines within screen
          const lineAlpha = depth * 0.25
          ctx.fillStyle   = `rgba(${r},${g},${b},${lineAlpha})`
          ctx.fillRect(x + 9,  y + 18, w - 22, 8)   // header bar
          ctx.fillRect(x + 9,  y + 32, w - 22, 4)   // text line 1
          ctx.fillRect(x + 9,  y + 40, (w - 22) * 0.70, 4) // text line 2
          ctx.fillRect(x + 9,  y + 54, w - 22, 24)  // image block
          ctx.fillRect(x + 9,  y + 84, w - 22, 4)   // text line 3
          ctx.fillRect(x + 9,  y + 92, (w - 22) * 0.55, 4) // text line 4

          // Home indicator
          ctx.beginPath()
          ctx.arc(x + w / 2, y + h - 7, 3, 0, Math.PI * 2)
          ctx.fillStyle   = `rgba(${r},${g},${b},${depth * 0.45})`
          ctx.fill()
        })

        // Connection arrow between screens (flow)
        ctx.strokeStyle = `rgba(${r},${g},${b},0.35)`
        ctx.lineWidth   = 1.2
        ctx.setLineDash([4, 4])
        ctx.beginPath()
        ctx.moveTo(cx + 80, cy - 65)
        ctx.lineTo(cx + 95, cy - 72)
        ctx.stroke()
        ctx.setLineDash([])

        // Label
        ctx.font         = 'bold 12px monospace'
        ctx.textAlign    = 'center'
        ctx.fillStyle    = `rgba(${r},${g},${b},0.55)`
        ctx.fillText('flow →', cx + 95, cy - 55)

        ctx.font      = '11px monospace'
        ctx.textAlign = 'left'
        ctx.fillStyle = 'rgba(255,255,255,0.25)'
        ctx.fillText('⟐ Interactive Prototype', cx - 190, cy + 125)
        break
      }

      // ── Case Studies — timeline + annotation rows ────────────────────────
      case 'case_studies': {
        const timeTop  = cy - 120
        const timeLeft = cx - 185
        const timeW    = 370

        // Horizontal timeline axis
        ctx.strokeStyle = `rgba(${r},${g},${b},0.45)`
        ctx.lineWidth   = 1.5
        ctx.beginPath()
        ctx.moveTo(timeLeft, timeTop + 10)
        ctx.lineTo(timeLeft + timeW, timeTop + 10)
        ctx.stroke()

        // Arrowhead at right end
        ctx.beginPath()
        ctx.moveTo(timeLeft + timeW,     timeTop + 10)
        ctx.lineTo(timeLeft + timeW - 7, timeTop + 5)
        ctx.lineTo(timeLeft + timeW - 7, timeTop + 15)
        ctx.closePath()
        ctx.fillStyle = `rgba(${r},${g},${b},0.45)`
        ctx.fill()

        // Milestones
        const milestones = [
          { t: 0.0,  label: 'Research',  note: 'User interviews · field study' },
          { t: 0.25, label: 'Synthesis', note: 'Affinity mapping · insights'   },
          { t: 0.50, label: 'Design',    note: 'Ideation · wireframes'         },
          { t: 0.75, label: 'Test',      note: 'Usability sessions · metrics'  },
          { t: 1.0,  label: 'Ship',      note: 'Launch · impact measurement'   },
        ]

        milestones.forEach(({ t, label, note }, i) => {
          const mx    = timeLeft + t * timeW
          const above = i % 2 === 0   // alternate above / below axis

          // Tick mark
          ctx.strokeStyle = `rgba(${r},${g},${b},0.70)`
          ctx.lineWidth   = 1.5
          ctx.beginPath()
          ctx.moveTo(mx, timeTop + 4)
          ctx.lineTo(mx, timeTop + 16)
          ctx.stroke()

          // Dot
          ctx.beginPath()
          ctx.arc(mx, timeTop + 10, 4, 0, Math.PI * 2)
          ctx.fillStyle   = hex
          ctx.globalAlpha = 0.80
          ctx.fill()
          ctx.globalAlpha = 1

          // Label
          const labelY = above ? timeTop - 8 : timeTop + 30
          ctx.font         = 'bold 11px monospace'
          ctx.textAlign    = 'center'
          ctx.textBaseline = above ? 'bottom' : 'top'
          ctx.fillStyle    = hex
          ctx.shadowColor  = hex
          ctx.shadowBlur   = 4
          ctx.fillText(label, mx, labelY)
          ctx.shadowBlur   = 0

          // Annotation note
          const noteY = above ? timeTop - 22 : timeTop + 44
          ctx.font      = '9px monospace'
          ctx.fillStyle = `rgba(255,255,255,0.30)`
          ctx.fillText(note, mx, noteY)
        })

        // Metrics strip below timeline
        const metricsTop = timeTop + 90
        const metrics    = [
          { label: 'SUS', val: '82' },
          { label: 'NPS', val: '+64' },
          { label: 'Time', val: '−38%' },
          { label: 'Conv', val: '+21%' },
        ]
        metrics.forEach(({ label, val }, i) => {
          const mx = timeLeft + i * 94 + 42
          // Metric card
          ctx.fillStyle   = `rgba(${r},${g},${b},0.08)`
          roundRect(ctx, mx - 38, metricsTop, 76, 44, 6)
          ctx.fill()
          ctx.strokeStyle = `rgba(${r},${g},${b},0.22)`
          ctx.lineWidth   = 1
          roundRect(ctx, mx - 38, metricsTop, 76, 44, 6)
          ctx.stroke()

          ctx.font         = 'bold 15px monospace'
          ctx.textAlign    = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillStyle    = hex
          ctx.shadowColor  = hex
          ctx.shadowBlur   = 5
          ctx.fillText(val, mx, metricsTop + 18)
          ctx.shadowBlur   = 0

          ctx.font      = '10px monospace'
          ctx.fillStyle = 'rgba(255,255,255,0.38)'
          ctx.fillText(label, mx, metricsTop + 34)
        })

        ctx.font      = '11px monospace'
        ctx.textAlign = 'left'
        ctx.fillStyle = 'rgba(255,255,255,0.22)'
        ctx.fillText('⟐ Case Study Timeline', timeLeft, metricsTop + 62)
        break
      }

      // ── AR / VR — depth-layered spatial UI panels ────────────────────────
      case 'ar_vr': {
        // Three receding glass panels at different perceived depths
        const layers = [
          { scale: 1.00, yOff:  0,   alpha: 0.60, blur: 12, zLabel: 'z: 0m'  },
          { scale: 0.72, yOff: -20,  alpha: 0.42, blur: 6,  zLabel: 'z: 2m'  },
          { scale: 0.50, yOff: -38,  alpha: 0.28, blur: 3,  zLabel: 'z: 5m'  },
        ]

        layers.forEach(({ scale, yOff, alpha, zLabel }, li) => {
          const pw  = 280 * scale
          const ph  = 155 * scale
          const px  = cx - pw / 2
          const py  = cy - ph / 2 + yOff + (li * -5)

          // Panel glass background
          ctx.fillStyle   = `rgba(${r},${g},${b},${alpha * 0.10})`
          ctx.globalAlpha = 1
          roundRect(ctx, px, py, pw, ph, 8 * scale)
          ctx.fill()

          ctx.strokeStyle = `rgba(${r},${g},${b},${alpha * 0.80})`
          ctx.lineWidth   = scale * 1.4
          roundRect(ctx, px, py, pw, ph, 8 * scale)
          ctx.stroke()

          // Panel content lines (mimic floating UI)
          const lh = scale * 8
          const lw = pw - scale * 22
          const lx = px + scale * 11
          ctx.fillStyle   = `rgba(${r},${g},${b},${alpha * 0.40})`
          ctx.fillRect(lx, py + scale * 12, lw * 0.45, lh)      // title
          ctx.fillRect(lx, py + scale * 26, lw,         lh * 0.7) // line 1
          ctx.fillRect(lx, py + scale * 36, lw * 0.75,  lh * 0.7) // line 2

          // Button strip at bottom
          const btnW = lw * 0.38
          const btnY = py + ph - scale * 28
          ctx.strokeStyle = `rgba(${r},${g},${b},${alpha * 0.60})`
          ctx.lineWidth   = scale
          roundRect(ctx, lx, btnY, btnW, scale * 18, 3 * scale)
          ctx.stroke()
          roundRect(ctx, lx + btnW + scale * 8, btnY, btnW * 0.65, scale * 18, 3 * scale)
          ctx.stroke()

          // Depth label top-right
          ctx.font         = `${Math.round(9 * scale)}px monospace`
          ctx.textAlign    = 'right'
          ctx.textBaseline = 'top'
          ctx.fillStyle    = `rgba(${r},${g},${b},${alpha * 0.70})`
          ctx.fillText(zLabel, px + pw - scale * 6, py + scale * 5)
        })

        // Gaze cursor (reticle) at scene center
        const rcx = cx, rcy = cy + 12
        ctx.strokeStyle = `rgba(${r},${g},${b},0.70)`
        ctx.lineWidth   = 1.5
        ctx.beginPath()
        ctx.arc(rcx, rcy, 8, 0, Math.PI * 2)
        ctx.stroke()
        // Crosshair
        ctx.beginPath()
        ctx.moveTo(rcx - 13, rcy); ctx.lineTo(rcx - 9, rcy)
        ctx.moveTo(rcx + 9,  rcy); ctx.lineTo(rcx + 13, rcy)
        ctx.moveTo(rcx, rcy - 13); ctx.lineTo(rcx, rcy - 9)
        ctx.moveTo(rcx, rcy + 9);  ctx.lineTo(rcx, rcy + 13)
        ctx.stroke()

        ctx.font      = '11px monospace'
        ctx.textAlign = 'left'
        ctx.fillStyle = 'rgba(255,255,255,0.25)'
        ctx.fillText('⟐ Spatial UI · Depth Layers', cx - 185, cy + 115)
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

    // Sphere click — placeholders excluded from _entries, never hit
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
    gsap.to(entry.mesh.material, { emissiveIntensity: 0.48, duration: 0.30 })

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
    gsap.to(entry.mesh.material, { emissiveIntensity: 0.15, duration: 0.30 })
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
        background: rgba(5,5,16,0.88);
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
    div.id = 'portxd-overlay'
    div.style.cssText = s.wrap

    div.innerHTML = `
      <div style="font-size:11px;letter-spacing:2px;opacity:0.45;margin-bottom:5px;text-transform:uppercase;">${meta.label}</div>
      <div style="font-size:18px;font-weight:bold;margin-bottom:16px;color:${hex};text-shadow:0 0 10px ${hex};">${project.name}</div>
      <div style="display:flex;gap:10px;justify-content:center;margin-bottom:14px;">
        ${s.linkBtn(project.github, '⟐ GitHub', '170,221,255')}
        ${s.linkBtn(project.live,   '⟐ Live',   `${r},${g},${b}`)}
      </div>
      <div style="display:flex;gap:10px;justify-content:center;">
        ${s.actionBtn('portxd-stay',  '⦿ Stay Outside', 'rgba(255,255,255,0.06)', 'rgba(255,255,255,0.20)', '#fff')}
        ${s.actionBtn('portxd-enter', '⟐ Enter Node',   `rgba(${r},${g},${b},0.18)`, hex, hex)}
      </div>
      <div style="margin-top:11px;font-size:10px;opacity:0.30;">Click sphere again to enter · ESC to dismiss</div>
    `

    this._mountOverlay(div)
    document.getElementById('portxd-stay')?.addEventListener('click',  () => this._stayOutside(entry))
    document.getElementById('portxd-enter')?.addEventListener('click', () => this._enterSphere(entry))
  }

  _showOrbitalOverlay(entry) {
    this._removeOverlay()
    const { project } = entry
    const s = this._overlayShell(entry)
    const { hex, r, g, b } = s

    const div = document.createElement('div')
    div.id = 'portxd-overlay'
    div.style.cssText = s.wrap

    div.innerHTML = `
      <div style="font-size:14px;font-weight:bold;margin-bottom:12px;color:${hex};">${project.name}</div>
      <div style="display:flex;gap:8px;justify-content:center;margin-bottom:12px;">
        ${s.linkBtn(project.github, '⟐ GitHub', '170,221,255')}
        ${s.linkBtn(project.live,   '⟐ Live',   `${r},${g},${b}`)}
      </div>
      <div style="display:flex;gap:8px;justify-content:center;">
        ${s.actionBtn('portxd-goenter', '⟐ Enter Node', `rgba(${r},${g},${b},0.18)`, hex, hex)}
        ${s.actionBtn('portxd-goback',  '← Back',       'rgba(255,255,255,0.05)', 'rgba(255,255,255,0.15)', 'rgba(255,255,255,0.60)')}
      </div>
    `

    this._mountOverlay(div)
    document.getElementById('portxd-goenter')?.addEventListener('click', () => this._enterSphere(entry))
    document.getElementById('portxd-goback')?.addEventListener('click',  () => this._returnFromOrbital())
  }

  _showInsideOverlay(entry) {
    this._removeOverlay()
    const { project } = entry
    const s = this._overlayShell(entry)
    const { hex, r, g, b } = s

    const div = document.createElement('div')
    div.id = 'portxd-overlay'
    div.style.cssText = s.wrap + `border-color:${hex}44; box-shadow:0 0 28px ${hex}22;`

    div.innerHTML = `
      <div style="font-size:11px;letter-spacing:2px;opacity:0.40;margin-bottom:4px;text-transform:uppercase;">⟐ Node Interior</div>
      <div style="font-size:16px;font-weight:bold;margin-bottom:14px;color:${hex};text-shadow:0 0 8px ${hex};">${project.name}</div>
      <div style="display:flex;gap:8px;justify-content:center;margin-bottom:13px;">
        ${s.linkBtn(project.github, '⟐ GitHub', '170,221,255')}
        ${s.linkBtn(project.live,   '⟐ Live',   `${r},${g},${b}`)}
      </div>
      ${s.actionBtn('portxd-exit', '← Exit Node', 'rgba(255,255,255,0.06)', 'rgba(255,255,255,0.18)', 'rgba(255,255,255,0.65)')}
      <div style="margin-top:9px;font-size:10px;opacity:0.28;">ESC to exit</div>
    `

    const exitBtn = div.querySelector('#portxd-exit')
    if (exitBtn) exitBtn.style.width = '100%'

    this._mountOverlay(div)
    document.getElementById('portxd-exit')?.addEventListener('click', () => this._exitSphere())
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

    const radial   = new THREE.Vector3(entry.basePos.x, 0, entry.basePos.z).normalize()
    const orbitPos = entry.basePos.clone().add(radial.multiplyScalar(SPHERE_RADIUS * 6.0))
    orbitPos.y     = entry.basePos.y + 0.8

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

    gsap.to(entry.mesh.material,  { opacity: 0.72, duration: 0.50 })
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
