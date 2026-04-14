/**
 * PortalSpheres.js — Navigation portal spheres
 *
 * Spheres placed within the Root that act as exits to other spaces.
 * Each sphere represents a unique destination in the logic tree.
 *
 * Behavior:
 *   - Hover  → subtle scale pulse + glow brightens
 *   - Click  → sphere expands via GSAP, then transitions camera
 *              (transition logic stubbed — wired in Phase 5 NodeManager)
 *
 * Placement: a ring of spheres at camera eye level (Y ≈ 2),
 * distributed along a circle of radius ~14 — comfortably inside
 * the inner cylinder (r=22).
 *
 * Context: { scene, camera, renderer, sizes, ticker }
 */

import * as THREE from 'three'
import gsap       from 'gsap'

// Five portal spheres by default — each maps to a destination
const PORTAL_DEFINITIONS = [
  { id: 'portfolio',  label: '⟐Portfolio',   color: 0xaaddff },
  { id: 'about',      label: '⟐About',        color: 0xffffff },
  { id: 'work',       label: '⟐Work',          color: 0xffd0ff },
  { id: 'omninode',   label: '⟐N',             color: 0xffffff },
  { id: 'undefined',  label: '⟐Undefined',    color: 0x888888 },
]

const SPHERE_RADIUS      = 1.2
const RING_RADIUS        = 14     // distance from center axis
const SPHERE_Y           = 2      // eye level
const SPHERE_SEGMENTS    = 32

export default class PortalSpheres {
  constructor(context) {
    this.ctx      = context
    this.group    = new THREE.Group()
    this.spheres  = []          // { mesh, light, id, label }
    this._raycaster   = new THREE.Raycaster()
    this._mouse       = new THREE.Vector2()
    this._hovered     = null
    this._hoveredPrev = null
    this._onClick     = this._handleClick.bind(this)
    this._onMove      = this._handleMove.bind(this)
  }

  init() {
    this._buildSpheres()
    this._bindEvents()
    this.ctx.scene.add(this.group)
  }

  _buildSpheres() {
    const count = PORTAL_DEFINITIONS.length

    PORTAL_DEFINITIONS.forEach((def, i) => {
      const angle = (i / count) * Math.PI * 2

      const geo = new THREE.SphereGeometry(SPHERE_RADIUS, SPHERE_SEGMENTS, SPHERE_SEGMENTS)
      const mat = new THREE.MeshPhysicalMaterial({
        color:            def.color,
        emissive:         def.color,
        emissiveIntensity: 0.25,
        roughness:        0.1,
        metalness:        0.0,
        transmission:     0.5,    // glass-like
        transparent:      true,
        opacity:          0.75,
        thickness:        1.5,
      })

      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.set(
        Math.cos(angle) * RING_RADIUS,
        SPHERE_Y,
        Math.sin(angle) * RING_RADIUS
      )
      mesh.name = `portal-${def.id}`
      mesh.userData = { portalId: def.id, label: def.label, baseScale: 1 }

      // Glow point light at each sphere
      const light = new THREE.PointLight(def.color, 0.8, 8, 2)
      light.position.copy(mesh.position)
      this.group.add(light)

      // Orbital ring around the sphere
      const ringGeo = new THREE.TorusGeometry(SPHERE_RADIUS * 1.7, 0.04, 8, 64)
      const ringMat = new THREE.MeshBasicMaterial({
        color:       def.color,
        transparent: true,
        opacity:     0.45,
      })
      const ring = new THREE.Mesh(ringGeo, ringMat)
      ring.rotation.x = Math.PI / 2 + Math.random() * 0.3  // slight tilt per sphere
      ring.rotation.z = Math.random() * 0.3
      mesh.add(ring)   // child of sphere — orbits with it

      // Slow orbital tilt animation
      ring._rotSpeed = 0.25 + Math.random() * 0.3
      this._orbitalRings = this._orbitalRings || []
      this._orbitalRings.push(ring)

      this.group.add(mesh)
      this.spheres.push({ mesh, light, id: def.id, label: def.label })
    })
  }

  _bindEvents() {
    const canvas = this.ctx.renderer.domElement
    canvas.addEventListener('pointermove', this._onMove)
    canvas.addEventListener('pointerdown', this._onClick)
  }

  _unbindEvents() {
    const canvas = this.ctx.renderer.domElement
    canvas.removeEventListener('pointermove', this._onMove)
    canvas.removeEventListener('pointerdown', this._onClick)
  }

  _handleMove(e) {
    const rect = this.ctx.renderer.domElement.getBoundingClientRect()
    this._mouse.x = ((e.clientX - rect.left) / rect.width)  * 2 - 1
    this._mouse.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1
  }

  _handleClick(e) {
    if (e.button !== 0) return

    const hit = this._getHit()
    if (!hit) return

    const sphere = this.spheres.find(s => s.mesh === hit)
    if (!sphere) return

    this._triggerPortalExpansion(sphere)
  }

  _getHit() {
    this._raycaster.setFromCamera(this._mouse, this.ctx.camera)
    const meshes = this.spheres.map(s => s.mesh)
    const hits   = this._raycaster.intersectObjects(meshes, false)
    return hits.length > 0 ? hits[0].object : null
  }

  _triggerPortalExpansion(sphere) {
    const mesh = sphere.mesh

    // Prevent double-triggering
    if (mesh.userData._expanding) return
    mesh.userData._expanding = true

    // Kill any existing hover tween
    gsap.killTweensOf(mesh.scale)

    // Phase 1 — expand to large
    gsap.to(mesh.scale, {
      x: 6, y: 6, z: 6,
      duration: 0.55,
      ease: 'power2.inOut',
      onComplete: () => {
        // Phase 2 — shrink back (Phase 5 will intercept here for actual traversal)
        gsap.to(mesh.scale, {
          x: 1, y: 1, z: 1,
          duration: 0.4,
          ease: 'power2.out',
          onComplete: () => {
            mesh.userData._expanding = false
          }
        })

        // Dispatch event for Phase 5 NodeManager to intercept
        window.dispatchEvent(new CustomEvent('omni:portal-activated', {
          detail: { id: sphere.id, label: sphere.label }
        }))
      }
    })

    // Brighten glow during expansion
    gsap.to(sphere.light, { intensity: 4.0, duration: 0.3 })
    gsap.to(sphere.light, { intensity: 0.8, duration: 0.5, delay: 0.5 })
  }

  update(delta) {
    // Raycaster hover check
    this._raycaster.setFromCamera(this._mouse, this.ctx.camera)
    const meshes  = this.spheres.map(s => s.mesh)
    const hits    = this._raycaster.intersectObjects(meshes, false)
    const hovered = hits.length > 0 ? hits[0].object : null

    // Hover enter
    if (hovered !== this._hovered) {
      // Hover leave — reset previous
      if (this._hovered && !this._hovered.userData._expanding) {
        gsap.to(this._hovered.scale, { x: 1, y: 1, z: 1, duration: 0.3 })
        const prev = this.spheres.find(s => s.mesh === this._hovered)
        if (prev) gsap.to(prev.light, { intensity: 0.8, duration: 0.3 })
        this.ctx.renderer.domElement.style.cursor = 'default'
      }

      // Hover enter
      if (hovered && !hovered.userData._expanding) {
        gsap.to(hovered.scale, { x: 1.12, y: 1.12, z: 1.12, duration: 0.3 })
        const cur = this.spheres.find(s => s.mesh === hovered)
        if (cur) gsap.to(cur.light, { intensity: 2.0, duration: 0.3 })
        this.ctx.renderer.domElement.style.cursor = 'pointer'
      }

      this._hovered = hovered
    }

    // Slow idle float per sphere
    const t = performance.now() * 0.001
    this.spheres.forEach((s, i) => {
      if (!s.mesh.userData._expanding) {
        const baseY  = SPHERE_Y
        const floatY = Math.sin(t * 0.5 + i * 1.3) * 0.15
        s.mesh.position.y = baseY + floatY

        // Sync light position
        s.light.position.y = baseY + floatY
      }
    })

    // Rotate orbital rings
    if (this._orbitalRings) {
      this._orbitalRings.forEach((ring, i) => {
        ring.rotation.y += delta * ring._rotSpeed
      })
    }
  }

  destroy() {
    this._unbindEvents()
    this.ctx.renderer.domElement.style.cursor = 'default'

    this.group.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose()
      if (obj.material) obj.material.dispose()
    })
    this.ctx.scene.remove(this.group)
  }
}
