/**
 * TerminalTunnel.js — ⟐T Terminal Tunnel
 *
 * A black cylinder nested inside the Root concentric cylinders.
 * NOT permanently visible — it spawns only when invoked via invoke()
 * and is dismissed via dismiss() or when the user presses ✕ on
 * the terminal panel.
 *
 * The black cylinder creates a visual "tunnel within the tunnel" —
 * the innermost layer of the Root's concentric geometry.
 *
 * The center panel is a CanvasTexture plane floating at the center
 * of the cylinder at camera eye level — terminal I/O interface.
 * In Phase 2 this renders a placeholder. The full terminal input
 * system is wired in Phase 4.
 *
 * Context: { scene, camera, renderer, sizes, ticker }
 */

import * as THREE from 'three'
import gsap       from 'gsap'

const TERMINAL_RADIUS   = 10
const TERMINAL_HEIGHT   = 260
const TERMINAL_SEGMENTS = 48
const CYLINDER_Y        = 28    // matches RootSpace center offset

const PANEL_WIDTH       = 5
const PANEL_HEIGHT      = 3.5

export default class TerminalTunnel {
  constructor(context) {
    this.ctx     = context
    this.group   = new THREE.Group()
    this.group.name = 'terminal-tunnel'

    this._cylinder   = null
    this._panel      = null
    this._canvas     = null
    this._ctx2d      = null
    this._texture    = null
    this._visible    = false
  }

  init() {
    this._buildCylinder()
    this._buildPanel()

    // Start fully hidden
    this.group.scale.set(0, 0, 0)
    this.group.visible = false

    this.ctx.scene.add(this.group)

    // Listen for OS-level invoke event (Phase 4 will use this)
    this._onInvoke  = () => this.invoke()
    this._onDismiss = () => this.dismiss()
    window.addEventListener('omni:terminal-invoke',  this._onInvoke)
    window.addEventListener('omni:terminal-dismiss', this._onDismiss)
  }

  _buildCylinder() {
    const geo = new THREE.CylinderGeometry(
      TERMINAL_RADIUS, TERMINAL_RADIUS,
      TERMINAL_HEIGHT,
      TERMINAL_SEGMENTS,
      2,
      true
    )

    const mat = new THREE.MeshBasicMaterial({
      color:       0x000000,
      side:        THREE.BackSide,
      transparent: true,
      opacity:     0.92,
    })

    this._cylinder = new THREE.Mesh(geo, mat)
    this._cylinder.position.y = CYLINDER_Y
    this._cylinder.name = 'terminal-cylinder'

    this.group.add(this._cylinder)

    // Subtle green scanline tint on the inner surface — wireframe overlay
    const wireGeo = new THREE.CylinderGeometry(
      TERMINAL_RADIUS - 0.1, TERMINAL_RADIUS - 0.1,
      TERMINAL_HEIGHT,
      TERMINAL_SEGMENTS,
      20,
      true
    )
    const wireEdges = new THREE.EdgesGeometry(wireGeo)
    const wireMat   = new THREE.LineBasicMaterial({
      color:       0x00ff88,
      transparent: true,
      opacity:     0.08,
    })
    const wireLines = new THREE.LineSegments(wireEdges, wireMat)
    wireLines.position.y = CYLINDER_Y
    wireGeo.dispose()

    this.group.add(wireLines)
  }

  _buildPanel() {
    // CanvasTexture panel — rendered via Canvas 2D API
    this._canvas = document.createElement('canvas')
    this._canvas.width  = 512
    this._canvas.height = 360
    this._ctx2d  = this._canvas.getContext('2d')

    this._texture = new THREE.CanvasTexture(this._canvas)
    this._renderPanelContent('idle')

    const geo = new THREE.PlaneGeometry(PANEL_WIDTH, PANEL_HEIGHT)
    const mat = new THREE.MeshBasicMaterial({
      map:         this._texture,
      transparent: true,
      depthWrite:  false,
      side:        THREE.DoubleSide,
    })

    this._panel = new THREE.Mesh(geo, mat)
    this._panel.position.set(0, 2.5, 0)   // eye level, center of tunnel
    this._panel.name = 'terminal-panel'

    this.group.add(this._panel)
  }

  /**
   * Render content to the Canvas 2D panel texture.
   * @param {'idle'|'active'} state
   */
  _renderPanelContent(state) {
    const c   = this._ctx2d
    const w   = this._canvas.width
    const h   = this._canvas.height

    // Clear
    c.clearRect(0, 0, w, h)

    // Panel background — dark glassmorphism
    c.fillStyle = 'rgba(0, 0, 0, 0.75)'
    this._roundRect(c, 0, 0, w, h, 16)
    c.fill()

    // Border
    c.strokeStyle = 'rgba(0, 255, 136, 0.4)'
    c.lineWidth   = 2
    this._roundRect(c, 1, 1, w - 2, h - 2, 15)
    c.stroke()

    // Header bar
    c.fillStyle = 'rgba(0, 255, 136, 0.1)'
    c.fillRect(1, 1, w - 2, 36)

    c.fillStyle = '#00ff88'
    c.font      = '13px "Courier New", monospace'
    c.fillText('⟐T  TERMINAL TUNNEL', 16, 24)

    // Close glyph (visual — actual logic Phase 4)
    c.fillStyle = 'rgba(255,255,255,0.4)'
    c.fillText('✕', w - 30, 24)

    // Body text
    c.fillStyle = 'rgba(0, 255, 136, 0.7)'
    c.font      = '11px "Courier New", monospace'

    if (state === 'idle') {
      const lines = [
        '> Terminal ready.',
        '> Type a command to begin.',
        '',
        '  available: help, ls, cd, create,',
        '             inspect, present, pocket',
        '',
        '> _',
      ]
      lines.forEach((line, i) => {
        c.fillText(line, 16, 72 + i * 20)
      })
    }

    if (this._texture) this._texture.needsUpdate = true
  }

  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + w - r, y)
    ctx.quadraticCurveTo(x + w, y, x + w, y + r)
    ctx.lineTo(x + w, y + h - r)
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
    ctx.lineTo(x + r, y + h)
    ctx.quadraticCurveTo(x, y + h, x, y + h - r)
    ctx.lineTo(x, y + r)
    ctx.quadraticCurveTo(x, y, x + r, y)
    ctx.closePath()
  }

  /**
   * Spawn the terminal tunnel into the scene.
   * Called by external event or main.js directly.
   */
  invoke() {
    if (this._visible) return
    this._visible = true

    this.group.visible = true
    gsap.killTweensOf(this.group.scale)
    gsap.fromTo(this.group.scale,
      { x: 0.01, y: 0.01, z: 0.01 },
      { x: 1,    y: 1,    z: 1,
        duration: 0.5,
        ease: 'back.out(1.4)',
      }
    )
  }

  /**
   * Remove the terminal tunnel from view.
   */
  dismiss() {
    if (!this._visible) return
    this._visible = false

    gsap.killTweensOf(this.group.scale)
    gsap.to(this.group.scale, {
      x: 0.01, y: 0.01, z: 0.01,
      duration: 0.35,
      ease: 'power2.in',
      onComplete: () => {
        this.group.visible = false
        this.group.scale.set(0, 0, 0)
      }
    })
  }

  /** Make panel face the camera each frame */
  update() {
    if (!this._visible) return
    if (this._panel) {
      this._panel.lookAt(this.ctx.camera.position)
    }
  }

  destroy() {
    window.removeEventListener('omni:terminal-invoke',  this._onInvoke)
    window.removeEventListener('omni:terminal-dismiss', this._onDismiss)

    this._texture?.dispose()
    this.group.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose()
      if (obj.material) obj.material.dispose()
    })
    this.ctx.scene.remove(this.group)
  }
}
