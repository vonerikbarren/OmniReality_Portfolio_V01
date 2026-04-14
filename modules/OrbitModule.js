/**
 * OrbitModule.js — Camera rig + OrbitControls
 *
 * Provides smooth orbital camera control after the entry animation
 * completes. Starts disabled — main.js calls enable() once the
 * descent finishes so controls never fight the GSAP animation.
 *
 * Context: { scene, camera, renderer, sizes, ticker }
 */

import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

export default class OrbitModule {
  constructor(context) {
    this.ctx      = context
    this.controls = null
  }

  init() {
    const { camera, renderer } = this.ctx

    this.controls = new OrbitControls(camera, renderer.domElement)

    // Smooth inertia — essential for the ethereal feel
    this.controls.enableDamping    = true
    this.controls.dampingFactor    = 0.06

    // Look + orbit around scene origin
    this.controls.target.set(0, 2, 0)

    // Restrict zoom range — don't let the camera clip geometry or fly to infinity
    this.controls.minDistance = 1
    this.controls.maxDistance = 80

    // Allow full vertical rotation — user can look up into the cylinder
    this.controls.minPolarAngle = 0
    this.controls.maxPolarAngle = Math.PI

    // No pan — the space is navigated spatially, not panned
    this.controls.enablePan = false

    // Disabled on boot — entry animation owns the camera first
    this.controls.enabled = false
  }

  /**
   * Enable controls. Called by main.js after the entry animation completes.
   */
  enable() {
    if (this.controls) {
      this.controls.enabled = true
      this.controls.update()
    }
  }

  /**
   * Disable controls — called during any programmatic camera transition
   * (e.g. entering a portal sphere).
   */
  disable() {
    if (this.controls) this.controls.enabled = false
  }

  update() {
    if (this.controls?.enabled) {
      this.controls.update()
    }
  }

  onResize() {
    // OrbitControls adapts automatically — no action needed
  }

  destroy() {
    this.controls?.dispose()
  }
}
