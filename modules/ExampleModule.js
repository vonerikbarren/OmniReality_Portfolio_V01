/**
 * ExampleModule.js — Module contract template
 *
 * Copy this file to start any new module.
 * Register in main.js via:
 *   base.addModule(new ExampleModule(base.context))
 *
 * The context object:
 *   { scene, camera, renderer, sizes, ticker }
 */

export default class ExampleModule {
  constructor(context) {
    this.ctx = context
    // Destructure what you need:
    // const { scene, camera, renderer, sizes, ticker } = context
  }

  /**
   * Called once by BaseScene.addModule() immediately after registration.
   * Set up geometry, materials, meshes, GSAP timelines, event listeners here.
   */
  init() {
    // Example:
    // const geo = new THREE.BoxGeometry(1, 1, 1)
    // const mat = new THREE.MeshStandardMaterial({ color: 0xffffff })
    // this.mesh = new THREE.Mesh(geo, mat)
    // this.ctx.scene.add(this.mesh)
    //
    // this.tl = gsap.timeline()
    // this.tl.to(this.mesh.rotation, { y: Math.PI * 2, duration: 4, repeat: -1, ease: 'none' })
  }

  /**
   * Called every frame by BaseScene's render loop.
   * @param {number} delta — seconds since last frame
   */
  update(delta) {
    // Frame logic. Keep lightweight — GSAP handles most animation.
    // Use delta for physics or manual interpolation only.
  }

  /**
   * Optional — called when the viewport changes.
   * @param {Sizes} sizes
   */
  onResize(sizes) {
    // React to viewport dimension changes if needed.
  }

  /**
   * Called by BaseScene.removeModule(). Clean up everything.
   * Undisposed geometry/materials will leak GPU memory.
   */
  destroy() {
    // Example cleanup:
    // this.tl?.kill()
    // this.ctx.scene.remove(this.mesh)
    // this.mesh.geometry.dispose()
    // this.mesh.material.dispose()
  }
}
