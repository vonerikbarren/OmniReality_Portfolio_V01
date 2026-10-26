/**
 * BaseScene.js — Core Three.js host
 *
 * Responsibilities:
 *   - WebGLRenderer (logarithmic depth buffer, pixel ratio, shadows)
 *   - PerspectiveCamera (near/far tuned for deep tree traversal)
 *   - Scene + base lighting
 *   - Viewport resize handling via Sizes util
 *   - GSAP-ticker-driven render loop via Ticker util
 *   - Module registry: addModule() / removeModule()
 *
 * The base scene never changes after Phase 1.
 * All features are added via modules registered through addModule().
 */

import * as THREE from 'three'
import Sizes     from '../utils/sizes.js'
import Ticker    from '../utils/ticker.js'

export default class BaseScene {
  /**
   * @param {string} canvasSelector  — CSS selector for the <canvas> element
   * @param {object} [Sound]         — a loaded SoundManager instance, made
   *                                    available to every module as ctx.Sound.
   *                                    Must be passed in here, not attached
   *                                    later — this.context is frozen at the
   *                                    end of this constructor, so there is
   *                                    no way to add or reassign a property
   *                                    on it afterward.
   */
  constructor(canvasSelector = '#omni-canvas', Sound = null) {
    this._canvas   = document.querySelector(canvasSelector)
    this._modules  = []
    this._tickerId = null
    this._Sound    = Sound

    this._initSizes()
    this._initRenderer()
    this._initCamera()
    this._initScene()
    this._initLights()
    this._initResize()
    this._initLoop()

    // Expose a frozen context object shared with all modules
    this.context = Object.freeze({
      scene:    this.scene,
      camera:   this.camera,
      renderer: this.renderer,
      sizes:    this.sizes,
      ticker:   this.ticker,
      Sound:    this._Sound,
    })
  }

  // ─────────────────────────────────────────────
  // Init
  // ─────────────────────────────────────────────

  _initSizes() {
    this.sizes = new Sizes()
  }

  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas:               this._canvas,
      antialias:            true,
      logarithmicDepthBuffer: true,   // prevents z-fighting across deep tree distances
      alpha:                false,
    })

    this.renderer.setSize(this.sizes.width, this.sizes.height)
    this.renderer.setPixelRatio(this.sizes.pixelRatio)

    // Tone mapping — keeps the bright white interior luminous, not blown out
    this.renderer.toneMapping        = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.2

    // Shadows — enabled at base; modules opt in per mesh
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type    = THREE.PCFSoftShadowMap

    // WebGL context loss is a distinct, GPU-driver-level event — separate
    // from a normal JS exception — that produces exactly this symptom:
    // the canvas goes blank/black while the rest of the page (anything
    // not touching the lost context) keeps working completely normally.
    // Can be triggered by genuine memory pressure, but just as often by
    // a single bad value (NaN in a position/geometry) the driver can't
    // handle. Logging this directly settles which one it actually is,
    // instead of inferring it from the symptom alone.
    this._canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault()   // without this, the browser won't even attempt to restore the context
      console.error('⟐ WebGL context LOST — the GPU driver terminated the rendering context itself (not a JS error). Common causes: GPU memory pressure, or an invalid value (NaN/Infinity) in a geometry or material somewhere in the scene.')
    })
    this._canvas.addEventListener('webglcontextrestored', () => {
      console.warn('⟐ WebGL context RESTORED — the renderer will need a full re-initialization to recover; a page reload is the reliable fix for now.')
    })
  }

  _initCamera() {
    this.camera = new THREE.PerspectiveCamera(
      60,                        // field of view
      this.sizes.aspect,
      0.01,                      // near — very close, no pop-in at small scale
      100000                     // far  — deep tree traversal coverage
    )

    // Default resting position (overridden by entry animation in main.js)
    this.camera.position.set(0, 0, 0)
    this.scene?.add(this.camera)
  }

  _initScene() {
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0xffffff)

    // Camera added to scene after both are created
    this.scene.add(this.camera)
  }

  _initLights() {
    // Ambient — fills the space evenly, keeps the white interior luminous
    const ambient = new THREE.AmbientLight(0xffffff, 1.8)
    this.scene.add(ambient)

    // Directional — gives form to geometry without harsh shadows
    const directional = new THREE.DirectionalLight(0xffffff, 1.2)
    directional.position.set(5, 10, 7)
    directional.castShadow = true

    directional.shadow.mapSize.width  = 2048
    directional.shadow.mapSize.height = 2048
    directional.shadow.camera.near   = 0.1
    directional.shadow.camera.far    = 500
    directional.shadow.bias          = -0.001

    this.scene.add(directional)

    // Subtle fill from below — prevents absolute black underside on geometry
    const fill = new THREE.DirectionalLight(0xffffff, 0.4)
    fill.position.set(-3, -5, -3)
    this.scene.add(fill)
  }

  _initResize() {
    this.sizes.addEventListener('resize', () => {
      // Camera
      this.camera.aspect = this.sizes.aspect
      this.camera.updateProjectionMatrix()

      // Renderer
      this.renderer.setSize(this.sizes.width, this.sizes.height)
      this.renderer.setPixelRatio(this.sizes.pixelRatio)

      // Notify modules so they can react to viewport changes if needed
      for (const mod of this._modules) {
        try {
          mod.onResize?.(this.sizes)
        } catch (err) {
          console.error('⟐ Module onResize() threw — isolated, other modules continue:', mod.constructor?.name ?? mod, err)
        }
      }
    })
  }

  _initLoop() {
    this.ticker = new Ticker()

    this._tickerId = this.ticker.add((delta) => {
      this._update(delta)
      try {
        this._render()
      } catch (err) {
        console.error('⟐ _render() threw — isolated so the ticker keeps running next frame:', err)
      }
    })
  }

  // ─────────────────────────────────────────────
  // Loop
  // ─────────────────────────────────────────────

  _update(delta) {
    for (const mod of this._modules) {
      try {
        mod.update?.(delta)
      } catch (err) {
        // One module's bug must never be able to silently freeze every
        // module registered after it — surface it and keep going,
        // rather than the whole update loop quietly dying mid-frame.
        console.error('⟐ Module update() threw — isolated, other modules continue:', mod.constructor?.name ?? mod, err)
      }
    }
  }

  _render() {
    this.renderer.render(this.scene, this.camera)
  }

  // ─────────────────────────────────────────────
  // Module Registry
  // ─────────────────────────────────────────────

  /**
   * Register a module. Calls its init() immediately.
   * Module will receive update(delta) every frame from this point on.
   *
   * @param {object} module — must follow the module contract:
   *   { init(), update(delta), destroy(), onResize?(sizes) }
   * @returns {object} the module — for chaining or external reference
   */
  addModule(module) {
    try {
      module.init?.()
    } catch (err) {
      console.error('⟐ Module init() threw — isolated, boot continues:', module.constructor?.name ?? module, err)
    }
    this._modules.push(module)
    return module
  }

  /**
   * Remove and destroy a module by reference.
   * @param {object} module
   */
  removeModule(module) {
    const idx = this._modules.indexOf(module)
    if (idx !== -1) {
      module.destroy?.()
      this._modules.splice(idx, 1)
    }
  }

  // ─────────────────────────────────────────────
  // Start
  // ─────────────────────────────────────────────

  /**
   * Called by main.js after all modules are registered.
   * The ticker is already running — this is a hook for
   * any post-registration startup logic if needed.
   */
  start() {
    // Ticker is already running from _initLoop.
    // This method is reserved for future startup hooks.
  }

  // ─────────────────────────────────────────────
  // Teardown
  // ─────────────────────────────────────────────

  destroy() {
    // Destroy all modules
    for (const mod of [...this._modules]) {
      this.removeModule(mod)
    }

    // Stop the ticker
    this.ticker.remove(this._tickerId)
    this.ticker.destroy()

    // Dispose renderer
    this.renderer.dispose()

    // Dispose sizes listener
    this.sizes.destroy()
  }
}
