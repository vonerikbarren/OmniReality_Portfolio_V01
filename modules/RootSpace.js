/**
 * RootSpace.js — The Root cylinder environment
 *
 * Three concentric vertical cylinders — user is inside all three,
 * camera looks along the Y axis (vertical). Each layer has a
 * distinct visual role:
 *
 *   Outer  → Structural shell — bright white, solid, BackSide
 *   Middle → Identity layer — slightly translucent, subtle tint
 *   Inner  → White wireframe grid — always crisp white
 *
 * All cylinders are open-ended (openEnded: true) so the camera
 * can enter from above without hitting a cap.
 *
 * Floor grid sits at the base of the cylinder space.
 *
 * Context: { scene, camera, renderer, sizes, ticker }
 */

import * as THREE from 'three'

// ── Cylinder constants ──────────────────────────────────────
const CYLINDER_HEIGHT   = 260
const CYLINDER_SEGMENTS = 64    // smooth curve
const CYLINDER_Y        = 28    // center offset — camera rests at Y=2, floor at Y=-102

const OUTER_RADIUS      = 38
const MIDDLE_RADIUS     = 30
const INNER_RADIUS      = 22

const FLOOR_Y           = CYLINDER_Y - CYLINDER_HEIGHT / 2   // bottom of cylinders

export default class RootSpace {
  constructor(context) {
    this.ctx     = context
    this.group   = new THREE.Group()
    this.meshes  = {}
  }

  init() {
    this._buildOuter()
    this._buildMiddle()
    this._buildInner()
    this._buildFloor()
    this._buildTopLight()

    this.ctx.scene.add(this.group)
  }

  // ── Outer cylinder — structural shell ──────────────────────

  _buildOuter() {
    const geo = new THREE.CylinderGeometry(
      OUTER_RADIUS, OUTER_RADIUS,
      CYLINDER_HEIGHT,
      CYLINDER_SEGMENTS,
      4,            // heightSegments — allows subtle texture variation
      true          // openEnded
    )

    const mat = new THREE.MeshStandardMaterial({
      color:     0xffffff,
      emissive:  0xffffff,
      emissiveIntensity: 0.08,
      side:      THREE.BackSide,
      roughness: 0.85,
      metalness: 0.0,
    })

    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.y = CYLINDER_Y
    mesh.name = 'root-outer'

    this.group.add(mesh)
    this.meshes.outer = mesh
  }

  // ── Middle cylinder — visual identity layer ─────────────────

  _buildMiddle() {
    const geo = new THREE.CylinderGeometry(
      MIDDLE_RADIUS, MIDDLE_RADIUS,
      CYLINDER_HEIGHT - 2,
      CYLINDER_SEGMENTS,
      2,
      true
    )

    const mat = new THREE.MeshStandardMaterial({
      color:       0xf0f4ff,      // very faint cool white
      emissive:    0xe8eeff,
      emissiveIntensity: 0.04,
      side:        THREE.BackSide,
      transparent: true,
      opacity:     0.55,
      roughness:   0.6,
      metalness:   0.1,
    })

    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.y = CYLINDER_Y
    mesh.name = 'root-middle'

    this.group.add(mesh)
    this.meshes.middle = mesh
  }

  // ── Inner cylinder — white wireframe grid ──────────────────

  _buildInner() {
    const geo = new THREE.CylinderGeometry(
      INNER_RADIUS, INNER_RADIUS,
      CYLINDER_HEIGHT - 4,
      CYLINDER_SEGMENTS,
      24,           // many height segments → dense horizontal grid lines
      true
    )

    // EdgesGeometry to get the wireframe lines cleanly
    const edges = new THREE.EdgesGeometry(geo)
    const mat   = new THREE.LineBasicMaterial({
      color:       0xffffff,
      transparent: true,
      opacity:     0.18,
    })

    const wireframe = new THREE.LineSegments(edges, mat)
    wireframe.position.y = CYLINDER_Y
    wireframe.name = 'root-inner-grid'

    this.group.add(wireframe)
    this.meshes.innerGrid = wireframe
  }

  // ── Floor grid ──────────────────────────────────────────────

  _buildFloor() {
    // GridHelper — 2D grid at the base
    const grid = new THREE.GridHelper(
      OUTER_RADIUS * 2,   // total size — matches outer diameter
      24,                 // divisions
      0xffffff,           // center line color
      0xffffff            // grid line color
    )

    // Tint grid lines — very subtle so they don't dominate
    grid.material.transparent = true
    grid.material.opacity     = 0.12
    grid.position.y           = FLOOR_Y
    grid.name = 'root-floor-grid'

    this.group.add(grid)
    this.meshes.floor = grid

    // Solid floor disc — gives the space a defined base plane
    const discGeo = new THREE.CircleGeometry(OUTER_RADIUS, CYLINDER_SEGMENTS)
    const discMat = new THREE.MeshStandardMaterial({
      color:     0xffffff,
      roughness: 0.9,
      metalness: 0.0,
    })

    const disc = new THREE.Mesh(discGeo, discMat)
    disc.rotation.x = -Math.PI / 2
    disc.position.y  = FLOOR_Y - 0.01   // just below the grid to avoid z-fighting
    disc.receiveShadow = true
    disc.name = 'root-floor-disc'

    this.group.add(disc)
    this.meshes.floorDisc = disc
  }

  // ── Top fill light — keeps the interior luminous ────────────

  _buildTopLight() {
    // Point light near the top of the cylinder
    const top = new THREE.PointLight(0xffffff, 3.0, 120, 1.2)
    top.position.set(0, CYLINDER_Y + CYLINDER_HEIGHT * 0.3, 0)
    this.group.add(top)

    // Center fill — makes the middle bright even without camera proximity
    const center = new THREE.PointLight(0xeeeeff, 2.0, 80, 1.0)
    center.position.set(0, CYLINDER_Y, 0)
    this.group.add(center)

    // Floor bounce — subtle warmth from below
    const floor = new THREE.PointLight(0xffffff, 0.8, 60, 1.5)
    floor.position.set(0, FLOOR_Y + 5, 0)
    this.group.add(floor)

    this.lights = { top, center, floor }
  }

  update() {
    // Static geometry — no per-frame update needed
  }

  destroy() {
    // Dispose all geometries + materials
    this.group.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose()
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose())
        else obj.material.dispose()
      }
    })

    this.ctx.scene.remove(this.group)
  }
}
