/**
 * ui/OmniStartHUD.js — ⟐mniReality Start HUD
 *
 * A HUD overlay, toggled by the Enter key (binding lives in
 * main.js, which dispatches omni:osh-toggle — same pattern as every
 * other keybinding in the project). Unlike a modal, the 3D world stays
 * interactive while it's open: the split lines and perimeter frame are
 * purely decorative (pointer-events: none), and the four quadrant panels
 * are inset with breathing room rather than covering the full screen
 * edge-to-edge, so there's always open space to keep navigating through.
 *
 * This first pass builds the shell only, per request — four empty
 * placeholder panels (CUIQ01–CUIQ04), one per quadrant. What goes inside
 * each one is future work.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Frame design
 * ─────────────────────────────────────────────────────────────────────────────
 * Bright corner brackets (a common HUD motif) as the primary framing
 * element, plus a thin, dimmer full-perimeter line for continuity
 * between them — matches the project's existing thin-border/glass
 * aesthetic rather than introducing a new visual language. The
 * lateral/longitudinal split lines animate outward from center on open,
 * bright white with a soft glow.
 *
 * Follows the standard module contract (constructor / init / update / destroy).
 */

import gsap from 'gsap'
import * as THREE from 'three'

const STYLES = /* css */`

#omni-start-hud {
  position        : fixed;
  inset           : 0;
  z-index         : 90;
  pointer-events  : none;
  opacity         : 0;
  visibility      : hidden;
}

/* ── Perimeter frame ──────────────────────────────────────────────────────── */

.osh-frame-edge {
  position        : absolute;
  background      : rgba(255, 255, 255, 0.28);
  pointer-events  : none;
}
.osh-frame-edge--top    { top: 14px; left: 14px; right: 14px; height: 1px; }
.osh-frame-edge--bottom { bottom: 14px; left: 14px; right: 14px; height: 1px; }
.osh-frame-edge--left   { top: 14px; bottom: 14px; left: 14px; width: 1px; }
.osh-frame-edge--right  { top: 14px; bottom: 14px; right: 14px; width: 1px; }

.osh-corner {
  position        : absolute;
  width           : 34px;
  height          : 34px;
  pointer-events  : none;
  filter          : drop-shadow(0 0 6px rgba(255,255,255,0.9));
}
.osh-corner::before, .osh-corner::after {
  content         : '';
  position        : absolute;
  background      : #ffffff;
}
.osh-corner::before { width: 100%; height: 2px; }
.osh-corner::after  { width: 2px; height: 100%; }

.osh-corner--tl { top: 10px; left: 10px; }
.osh-corner--tr { top: 10px; right: 10px; }
.osh-corner--bl { bottom: 10px; left: 10px; }
.osh-corner--br { bottom: 10px; right: 10px; }
.osh-corner--tl::before, .osh-corner--tl::after { top: 0; left: 0; }
.osh-corner--tr::before { top: 0; right: 0; }
.osh-corner--tr::after  { top: 0; right: 0; }
.osh-corner--bl::before { bottom: 0; left: 0; }
.osh-corner--bl::after  { bottom: 0; left: 0; }
.osh-corner--br::before { bottom: 0; right: 0; }
.osh-corner--br::after  { bottom: 0; right: 0; }

/* ── Split lines ──────────────────────────────────────────────────────────── */

.osh-line {
  position        : absolute;
  background      : #ffffff;
  box-shadow      : 0 0 12px rgba(255,255,255,0.95), 0 0 3px rgba(255,255,255,1);
  pointer-events  : none;
}
.osh-line--h {
  top             : 50%;
  left            : 0;
  right           : 0;
  height          : 1px;
  transform       : translateY(-50%) scaleX(0);
  transform-origin: center;
}
.osh-line--v {
  left            : 50%;
  top             : 0;
  bottom          : 0;
  width           : 1px;
  transform       : translateX(-50%) scaleY(0);
  transform-origin: center;
}

/* ── Quadrant panels ──────────────────────────────────────────────────────── */

.osh-quadrant {
  position        : absolute;
  width           : calc(50% - 46px);
  height          : calc(50% - 46px);
  display         : flex;
  align-items     : center;
  justify-content : center;
  pointer-events  : none;   /* the box below re-enables it */
}
.osh-quadrant--tl { top: 28px;    left: 28px; }
.osh-quadrant--tr { top: 28px;    right: 28px; }
.osh-quadrant--bl { bottom: 28px; left: 28px; }
.osh-quadrant--br { bottom: 28px; right: 28px; }

.osh-panel {
  width           : 100%;
  height          : 100%;
  display         : flex;
  align-items     : center;
  justify-content : center;
  background      : rgba(8, 8, 12, 0.10);
  backdrop-filter : saturate(1.4);   /* blur removed — this is a HUD, must stay see-through */
  -webkit-backdrop-filter: saturate(1.4);
  border          : 1px solid rgba(255, 255, 255, 0.14);
  border-radius   : 10px;
  pointer-events  : auto;
  opacity         : 0;
  transform       : scale(0.94);
}

.osh-panel-label {
  font-family     : 'Courier New', Courier, monospace;
  font-size       : 12px;
  letter-spacing  : 0.2em;
  color           : rgba(255, 255, 255, 0.55);
}

/* ── Center diamond — live preview of the current reality ─────────────────── */

.osh-ring {
  position        : absolute;
  top             : 50%;
  left            : 50%;
  width           : 210px;
  height          : 210px;
  border-radius   : 50%;
  border          : 2px solid rgba(255, 255, 255, 0.20);
  border-top-color: rgba(255, 255, 255, 0.95);   /* bright arc — makes the rotation ("circling") visible */
  box-shadow      : 0 0 14px rgba(255, 255, 255, 0.5);
  transform       : translate(-50%, -50%) scale(0) rotate(0deg);
  opacity         : 0;
  pointer-events  : none;
  animation       : osh-ring-pulse 3.2s ease-in-out infinite;
}

@keyframes osh-ring-pulse {
  0%   { transform: translate(-50%, -50%) scale(0.85) rotate(0deg);   opacity: 0.35; }
  50%  { transform: translate(-50%, -50%) scale(1.15) rotate(180deg); opacity: 0.75; }
  100% { transform: translate(-50%, -50%) scale(0.85) rotate(360deg); opacity: 0.35; }
}

.osh-diamond-wrap {
  position        : absolute;
  top             : 50%;
  left            : 50%;
  width           : 128px;
  height          : 128px;
  transform       : translate(-50%, -50%) rotate(45deg) scale(0);
  pointer-events  : none;
  opacity         : 0;
}

.osh-diamond {
  width           : 100%;
  height          : 100%;
  display         : flex;
  align-items     : center;
  justify-content : center;
  background      : rgba(8, 8, 12, 0.25);
  backdrop-filter : saturate(1.4);   /* blur removed — this is a HUD, must stay see-through */
  -webkit-backdrop-filter: saturate(1.4);
  border          : 1px solid rgba(255, 255, 255, 0.22);
  box-shadow      : 0 0 20px rgba(255, 255, 255, 0.12);
  pointer-events  : auto;
  overflow        : hidden;
}

.osh-diamond-inner {
  width           : 100%;
  height          : 100%;
  display         : flex;
  align-items     : center;
  justify-content : center;
  transform       : rotate(-45deg);   /* counter-rotate so the preview reads normally */
}

.osh-diamond-canvas {
  width           : 72px;
  height          : 72px;
}

`

function injectStyles () {
  if (document.getElementById('omni-start-hud-styles')) return
  const tag = document.createElement('style')
  tag.id = 'omni-start-hud-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

export default class OmniStartHUD {
  constructor (context) {
    this.ctx = context
    this._el = null
    this._isOpen = false
    this._onToggle = null
    this._preview = null   // the center diamond's own tiny renderer/scene/mesh
  }

  init () {
    injectStyles()
    this._el = this._buildDOM()
    const shell = document.getElementById('omni-ui') ?? document.body
    shell.appendChild(this._el)

    this._setupPreview()

    this._onToggle = () => this.toggle()
    window.addEventListener('omni:osh-toggle', this._onToggle)
  }

  update (delta) {
    if (!this._preview) return
    this._preview.mesh.rotation.x += delta * 0.3
    this._preview.mesh.rotation.y += delta * 0.5
    this._preview.renderer.render(this._preview.scene, this._preview.camera)
  }

  onResize () {}

  destroy () {
    window.removeEventListener('omni:osh-toggle', this._onToggle)
    this._teardownPreview()
    this._el?.parentNode?.removeChild(this._el)
  }

  /**
   * Embedded live preview inside the center diamond — for now, just a
   * spinning cube (per request, as a first pass). Intended to eventually
   * reflect "the shape and activity of the main reality the user is
   * inside of" — i.e. the currently entered domain's actual geometry —
   * but that needs hooking into the space-context system (see
   * systems/OmniNode.js's _currentSpaceId) and is future work.
   */
  _setupPreview () {
    const canvas = this._el.querySelector('.osh-diamond-canvas')
    if (!canvas) return

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
    renderer.setSize(72, 72, false)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

    const scene  = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 10)
    camera.position.set(0, 0.6, 2.2)
    camera.lookAt(0, 0, 0)
    scene.add(new THREE.AmbientLight(0xffffff, 0.6))
    const key = new THREE.DirectionalLight(0xffffff, 1.0)
    key.position.set(2, 3, 2)
    scene.add(key)

    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, metalness: 0.1 })
    )
    scene.add(mesh)

    this._preview = { renderer, scene, camera, mesh }
  }

  _teardownPreview () {
    if (!this._preview) return
    this._preview.mesh.geometry?.dispose()
    this._preview.mesh.material?.dispose()
    this._preview.renderer.dispose()
    this._preview = null
  }

  toggle () {
    this._isOpen ? this.close() : this.open()
  }

  open () {
    if (this._isOpen) return
    this._isOpen = true
    this._el.style.visibility = 'visible'

    const tl = gsap.timeline()
    tl.to(this._el, { opacity: 1, duration: 0.15 })
      .to(this._el.querySelector('.osh-line--h'), { scaleX: 1, duration: 0.35, ease: 'power3.out' }, '<')
      .to(this._el.querySelector('.osh-line--v'), { scaleY: 1, duration: 0.35, ease: 'power3.out' }, '<')
      .to(this._el.querySelectorAll('.osh-panel'), {
        opacity: 0.1, scale: 1, duration: 0.3, ease: 'back.out(1.6)', stagger: 0.05,
      }, '-=0.1')
      .to(this._el.querySelector('.osh-diamond-wrap'), {
        opacity: 1, scale: 1, duration: 0.35, ease: 'back.out(1.8)',
      }, '-=0.2')
  }

  close () {
    if (!this._isOpen) return
    this._isOpen = false

    const tl = gsap.timeline({ onComplete: () => { this._el.style.visibility = 'hidden' } })
    tl.to(this._el.querySelectorAll('.osh-panel'), { opacity: 0, scale: 0.94, duration: 0.16, stagger: 0.03 })
      .to(this._el.querySelector('.osh-diamond-wrap'), { opacity: 0, scale: 0, duration: 0.18, ease: 'power2.in' }, '<')
      .to(this._el.querySelector('.osh-line--h'), { scaleX: 0, duration: 0.22, ease: 'power2.in' }, '<')
      .to(this._el.querySelector('.osh-line--v'), { scaleY: 0, duration: 0.22, ease: 'power2.in' }, '<')
      .to(this._el, { opacity: 0, duration: 0.15 }, '-=0.1')
  }

  // ── DOM ──────────────────────────────────────────────────────────────────

  _buildDOM () {
    const el = document.createElement('div')
    el.id = 'omni-start-hud'
    el.innerHTML = /* html */`
      <div class="osh-frame-edge osh-frame-edge--top"    aria-hidden="true"></div>
      <div class="osh-frame-edge osh-frame-edge--bottom" aria-hidden="true"></div>
      <div class="osh-frame-edge osh-frame-edge--left"   aria-hidden="true"></div>
      <div class="osh-frame-edge osh-frame-edge--right"  aria-hidden="true"></div>

      <div class="osh-corner osh-corner--tl" aria-hidden="true"></div>
      <div class="osh-corner osh-corner--tr" aria-hidden="true"></div>
      <div class="osh-corner osh-corner--bl" aria-hidden="true"></div>
      <div class="osh-corner osh-corner--br" aria-hidden="true"></div>

      <div class="osh-line osh-line--h" aria-hidden="true"></div>
      <div class="osh-line osh-line--v" aria-hidden="true"></div>

      <div class="osh-quadrant osh-quadrant--tl">
        <div class="osh-panel" data-panel="CUIQ01"><span class="osh-panel-label">CUIQ01</span></div>
      </div>
      <div class="osh-quadrant osh-quadrant--tr">
        <div class="osh-panel" data-panel="CUIQ02"><span class="osh-panel-label">CUIQ02</span></div>
      </div>
      <div class="osh-quadrant osh-quadrant--bl">
        <div class="osh-panel" data-panel="CUIQ03"><span class="osh-panel-label">CUIQ03</span></div>
      </div>
      <div class="osh-quadrant osh-quadrant--br">
        <div class="osh-panel" data-panel="CUIQ04"><span class="osh-panel-label">CUIQ04</span></div>
      </div>

      <div class="osh-ring" aria-hidden="true"></div>

      <div class="osh-diamond-wrap">
        <div class="osh-diamond">
          <div class="osh-diamond-inner">
            <canvas class="osh-diamond-canvas" width="144" height="144"></canvas>
          </div>
        </div>
      </div>
    `
    return el
  }
}
