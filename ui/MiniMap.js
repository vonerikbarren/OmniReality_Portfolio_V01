/**
 * ui/MiniMap.js — ⟐mniReality Spatial Mini Map
 *
 * A live top-down canvas rendering of the camera's position within the
 * current space. Fixed to the viewport, bottom-center, just above the Dock.
 * Redraws every frame via update(delta).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Shape
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   Perfect circle — border-radius 50% on a square container.
 *   The canvas fills the circle entirely. Space name + coordinates are
 *   drawn as canvas text inside the circle — no header/footer DOM elements
 *   that would break the circular shape.
 *
 *   A small minimize button sits just outside the circle edge (top-right).
 *   It is NOT inside overflow:hidden so it is never clipped.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * States
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   Expanded  →  full 154px circle, all canvas layers drawn
 *   Minimized →  small 36px circle showing ⟐ glyph, click to restore
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Draggable
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   Drag the circle in either state. Position persists within the session.
 *   Uses pointer capture — works on touch and mouse.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Canvas layers (drawn back → front each frame)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   1. Outer cylinder ring        faint white circle
 *   2. Middle cylinder ring       faintest circle
 *   3. Inner cylinder ring        dashed circle
 *   4. Axis crosshair             1px lines through centre
 *   5. Portal sphere markers      coloured dots at XZ world positions
 *      └─ Active flash ring       pulse circle on omni:portal-activated
 *   6. Camera heading line        direction camera faces (XZ projected)
 *   7. Camera dot                 bright white dot with glow
 *   8. Space name                 top-center canvas text
 *   9. Coordinates                bottom-center canvas text
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Events consumed (window)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   omni:portal-activated  →  { id, label }   flash portal marker, update name
 *   omni:space-changed     →  { worldRadius }  update world bounds
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Events dispatched (window)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   omni:minimap-toggle    →  { visible }
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Public API
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   map.init()
 *   map.update(delta)
 *   map.destroy()
 *   map.setVisible(bool)
 *   map.toggle()
 *   map.setPortals(portals)       [{ id, label, x, z, color }]
 *   map.setWorldBounds(radius)
 */

import gsap       from 'gsap'
import * as THREE from 'three'

// ─────────────────────────────────────────────────────────────────────────────
// Layout constants
// ─────────────────────────────────────────────────────────────────────────────

const DOCK_H    = 52    // px — Dock height
const GAP       = 8     // px — breathing room above Dock
const MAP_SIZE  = 154   // px — circle diameter (expanded)
const MINI_SIZE = 36    // px — circle diameter (minimized)
const MAP_HALF  = MAP_SIZE / 2   // 77

// ─────────────────────────────────────────────────────────────────────────────
// World-space constants
// ─────────────────────────────────────────────────────────────────────────────

const OUTER_R        = 38
const MIDDLE_R       = 30
const INNER_R        = 22
const PORTAL_RING_R  = 14
const PORTAL_COUNT   = 5

const WORLD_HALF_DEFAULT = OUTER_R + 2   // 40 world units

// ─────────────────────────────────────────────────────────────────────────────
// Default portal definitions
// ─────────────────────────────────────────────────────────────────────────────

function buildDefaultPortals () {
  const defs = [
    { id: 'portfolio', label: '⟐Portfolio', color: '#aaddff' },
    { id: 'about',     label: '⟐About',     color: '#ffffff' },
    { id: 'work',      label: '⟐Work',      color: '#ffd0ff' },
    { id: 'omninode',  label: '⟐N',         color: '#ffffff' },
    { id: 'undefined', label: '⟐Undefined', color: '#888888' },
  ]
  return defs.map((def, i) => {
    const angle = (i / PORTAL_COUNT) * Math.PI * 2
    return {
      id   : def.id,
      label: def.label,
      color: def.color,
      x    : Math.cos(angle) * PORTAL_RING_R,
      z    : Math.sin(angle) * PORTAL_RING_R,
    }
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Canvas helpers
// ─────────────────────────────────────────────────────────────────────────────

function circle (ctx, x, y, r, fill, stroke, lineWidth = 1) {
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  if (fill)   { ctx.fillStyle = fill; ctx.fill() }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.stroke() }
}

function ring (ctx, x, y, r, stroke, lineWidth = 1, dash = []) {
  ctx.beginPath()
  ctx.setLineDash(dash)
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.strokeStyle = stroke
  ctx.lineWidth   = lineWidth
  ctx.stroke()
  ctx.setLineDash([])
}

// ─────────────────────────────────────────────────────────────────────────────
// Stylesheet
// ─────────────────────────────────────────────────────────────────────────────

const STYLES = /* css */`

/* ── Outer wrapper — position anchor, draggable ────────────────────────────── */

.omni-minimap {
  position        : fixed;
  bottom          : ${DOCK_H + GAP}px;
  left            : 50%;
  transform       : translateX(-50%);
  z-index         : 42;
  pointer-events  : auto;
  user-select     : none;
  -webkit-user-select    : none;
  -webkit-touch-callout  : none;
  cursor          : grab;
  width           : ${MAP_SIZE}px;
  height          : ${MAP_SIZE}px;
  -webkit-touch-callout : none;
  -webkit-user-select   : none;
  user-select           : none;
}

.omni-minimap:active {
  cursor          : grabbing;
}

/* ── Circle — the visible map, contains canvas ─────────────────────────────── */

.omni-minimap-circle {
  width           : ${MAP_SIZE}px;
  height          : ${MAP_SIZE}px;
  border-radius   : 50%;
  overflow        : hidden;
  border          : 1px solid rgba(255, 255, 255, 0.09);
  background      : rgba(6, 6, 10, 0.20);
  backdrop-filter : blur(20px) saturate(1.6);
  -webkit-backdrop-filter: blur(20px) saturate(1.6);
  box-shadow      : 0 0 20px rgba(0, 0, 0, 0.40), 0 0 1px rgba(255,255,255,0.08);
  transition      : width 0.22s ease, height 0.22s ease, border-radius 0.22s ease;
  -webkit-touch-callout : none;
}

/* Canvas fills the circle exactly */
.mm-canvas {
  display         : block;
  width           : ${MAP_SIZE}px;
  height          : ${MAP_SIZE}px;
}

/* ── Minimize button — sits outside overflow:hidden, never clipped ─────────── */

.mm-mini-btn {
  position        : absolute;
  top             : 2px;
  right           : 2px;
  width           : 18px;
  height          : 18px;
  border-radius   : 50%;
  background      : rgba(6, 6, 10, 0.80);
  border          : 1px solid rgba(255, 255, 255, 0.18);
  color           : rgba(255, 255, 255, 0.65);
  font-family     : 'Courier New', Courier, monospace;
  font-size       : 9px;
  line-height     : 1;
  cursor          : pointer;
  display         : flex;
  align-items     : center;
  justify-content : center;
  z-index         : 2;
  transition      : background 0.12s, border-color 0.12s, color 0.12s;
  padding         : 0;
  -webkit-tap-highlight-color: transparent;
}

.mm-mini-btn:hover {
  background      : rgba(255, 255, 255, 0.12);
  border-color    : rgba(255, 255, 255, 0.40);
  color           : rgba(255, 255, 255, 0.95);
}

/* ── Minimized state ───────────────────────────────────────────────────────── */

.omni-minimap.is-minimized {
  width           : ${MINI_SIZE}px;
  height          : ${MINI_SIZE}px;
  cursor          : pointer;
}

.omni-minimap.is-minimized .omni-minimap-circle {
  width           : ${MINI_SIZE}px;
  height          : ${MINI_SIZE}px;
}

.omni-minimap.is-minimized .mm-canvas {
  display         : none;
}

.omni-minimap.is-minimized .mm-mini-btn {
  display         : none;
}

/* ── Portal tooltip ────────────────────────────────────────────────────────── */

.mm-portal-tooltip {
  position        : fixed;
  background      : rgba(8, 8, 12, 0.94);
  border          : 1px solid rgba(255, 255, 255, 0.12);
  color           : rgba(255, 255, 255, 0.88);
  font-family     : 'Courier New', Courier, monospace;
  font-size       : 8.5px;
  padding         : 3px 8px;
  border-radius   : 4px;
  pointer-events  : none;
  z-index         : 80;
  letter-spacing  : 0.06em;
  white-space     : nowrap;
  opacity         : 0;
  transition      : opacity 0.12s ease;
  backdrop-filter : blur(8px);
}

.mm-portal-tooltip.is-visible {
  opacity         : 1;
}

`

function injectStyles () {
  if (document.getElementById('omni-minimap-styles')) return
  const tag = document.createElement('style')
  tag.id          = 'omni-minimap-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

// ─────────────────────────────────────────────────────────────────────────────
// MiniMap class
// ─────────────────────────────────────────────────────────────────────────────

export default class MiniMap {

  constructor (context) {
    this.ctx = context

    // DOM refs
    this._el         = null   // .omni-minimap wrapper
    this._circleEl   = null   // .omni-minimap-circle
    this._canvas     = null
    this._ctx2d      = null
    this._dpr        = 1
    this._tooltip    = null
    this._miniBtn    = null

    // State
    this._visible    = true
    this._minimized  = false
    this._spaceName  = 'Root'

    // World
    this._worldHalf  = WORLD_HALF_DEFAULT
    this._scale      = MAP_HALF / WORLD_HALF_DEFAULT

    // Portals
    this._portals    = buildDefaultPortals()
    this._flashState = {}         // portalId → { alpha, ringRadius }

    // Hover
    this._mouseCanvas   = { x: -999, y: -999 }
    this._hoveredPortal = null

    // THREE helper
    this._dir = new THREE.Vector3()

    // Drag state
    this._dragging   = false
    this._dragStartX = 0
    this._dragStartY = 0
    this._dragOrigL  = 0
    this._dragOrigT  = 0
    this._hasDragged = false   // distinguish drag from click

    // Bound handlers
    this._onPortalActivated = e => this._handlePortalActivated(e)
    this._onSpaceChanged    = e => this._handleSpaceChanged(e)
    this._onMouseMove       = e => this._handleCanvasMouseMove(e)
    this._onMouseLeave      = ()  => this._handleMouseLeave()
    this._onPointerDown     = e => this._handlePointerDown(e)
    this._onPointerMove     = e => this._handlePointerMove(e)
    this._onPointerUp       = e => this._handlePointerUp(e)
  }

  // ── Module contract ──────────────────────────────────────────────────────

  init () {
    injectStyles()
    this._dpr = Math.min(window.devicePixelRatio || 1, 2)
    this._buildDOM()
    this._bindEvents()
    console.log('⟐ MiniMap: initialized.')
  }

  update (delta) {
    if (!this._visible || this._minimized || !this._ctx2d) return

    const cam = this.ctx?.camera
    if (!cam) return

    // Decay flash alphas
    Object.keys(this._flashState).forEach(id => {
      this._flashState[id].alpha -= delta * 1.4
      if (this._flashState[id].alpha <= 0) delete this._flashState[id]
    })

    this._draw(cam)
  }

  destroy () {
    this._el?.parentNode?.removeChild(this._el)
    this._tooltip?.parentNode?.removeChild(this._tooltip)
    window.removeEventListener('omni:portal-activated', this._onPortalActivated)
    window.removeEventListener('omni:space-changed',    this._onSpaceChanged)
    this._canvas?.removeEventListener('mousemove',  this._onMouseMove)
    this._canvas?.removeEventListener('mouseleave', this._onMouseLeave)
    this._el?.removeEventListener('pointerdown', this._onPointerDown)
    window.removeEventListener('pointermove', this._onPointerMove)
    window.removeEventListener('pointerup',   this._onPointerUp)
  }

  // ── Public API ────────────────────────────────────────────────────────────

  setVisible (visible) {
    if (this._visible === visible) return
    this._visible = visible

    if (visible) {
      gsap.fromTo(this._el,
        { opacity: 0, scale: 0.88 },
        { opacity: 1, scale: 1, duration: 0.22, ease: 'back.out(1.8)' }
      )
    } else {
      gsap.to(this._el, {
        opacity : 0,
        scale   : 0.88,
        duration: 0.16,
        ease    : 'power2.in',
        onComplete: () => gsap.set(this._el, { scale: 1 }),
      })
    }

    window.dispatchEvent(new CustomEvent('omni:minimap-toggle', { detail: { visible } }))
  }

  toggle () {
    this.setVisible(!this._visible)
    this._playSound(this._visible ? 'open' : 'close')
  }

  setPortals (portals) {
    this._portals = portals
  }

  setWorldBounds (radius) {
    this._worldHalf = radius + 2
    this._scale     = MAP_HALF / this._worldHalf
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DOM construction
  // ─────────────────────────────────────────────────────────────────────────

  _buildDOM () {
    // Outer wrapper — draggable, position anchor
    const el = document.createElement('div')
    el.id        = 'omni-minimap'
    el.className = 'omni-minimap'
    el.setAttribute('aria-label', 'Spatial mini map')
    el.setAttribute('role', 'img')

    // Circle container — overflow:hidden keeps canvas inside circle
    const circle = document.createElement('div')
    circle.className = 'omni-minimap-circle'

    // Canvas — fills the circle
    const canvas = document.createElement('canvas')
    canvas.className = 'mm-canvas'
    canvas.width     = MAP_SIZE * this._dpr
    canvas.height    = MAP_SIZE * this._dpr
    canvas.style.width  = `${MAP_SIZE}px`
    canvas.style.height = `${MAP_SIZE}px`

    const ctx = canvas.getContext('2d')
    ctx.scale(this._dpr, this._dpr)

    circle.appendChild(canvas)
    el.appendChild(circle)

    // Minimize button — sibling of circle, NOT inside overflow:hidden
    const miniBtn = document.createElement('button')
    miniBtn.className   = 'mm-mini-btn'
    miniBtn.textContent = '—'
    miniBtn.title       = 'Minimize map'
    miniBtn.setAttribute('aria-label', 'Minimize mini map')
    el.appendChild(miniBtn)

    // Tooltip — appended to body, not inside map
    const tooltip = document.createElement('div')
    tooltip.className = 'mm-portal-tooltip'
    document.body.appendChild(tooltip)

    this._el       = el
    this._circleEl = circle
    this._canvas   = canvas
    this._ctx2d    = ctx
    this._miniBtn  = miniBtn
    this._tooltip  = tooltip

    const shell = document.getElementById('omni-ui') ?? document.body
    shell.appendChild(el)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Event binding
  // ─────────────────────────────────────────────────────────────────────────

  _bindEvents () {
    window.addEventListener('omni:portal-activated', this._onPortalActivated)
    window.addEventListener('omni:space-changed',    this._onSpaceChanged)
    this._el.addEventListener('contextmenu', (e) => e.preventDefault())

    // Canvas hover for portal tooltip
    this._canvas.addEventListener('mousemove',  this._onMouseMove)
    this._canvas.addEventListener('mouseleave', this._onMouseLeave)

    // Minimize button
    this._miniBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      this._setMinimized(true)
      this._playSound('close')
    })

    // Click minimized circle to restore
    this._el.addEventListener('click', (e) => {
      if (this._minimized && !this._hasDragged) {
        this._setMinimized(false)
        this._playSound('open')
      }
    })

    // Drag
    this._el.addEventListener('pointerdown', this._onPointerDown)
    window.addEventListener('pointermove',   this._onPointerMove)
    window.addEventListener('pointerup',     this._onPointerUp)
    window.addEventListener('pointercancel', this._onPointerUp)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Minimize / restore
  // ─────────────────────────────────────────────────────────────────────────

  _setMinimized (val) {
    this._minimized = val

    if (val) {
      this._el.classList.add('is-minimized')
      gsap.to(this._circleEl, {
        width: MINI_SIZE, height: MINI_SIZE,
        duration: 0.20, ease: 'power2.inOut',
      })
    } else {
      this._el.classList.remove('is-minimized')
      gsap.to(this._circleEl, {
        width: MAP_SIZE, height: MAP_SIZE,
        duration: 0.22, ease: 'back.out(1.4)',
      })
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Drag
  // ─────────────────────────────────────────────────────────────────────────

  _handlePointerDown (e) {
    // Don't drag when clicking the minimize button
    if (e.target === this._miniBtn) return

    this._dragging   = true
    this._hasDragged = false

    this._dragStartX = e.clientX
    this._dragStartY = e.clientY

    // Switch from bottom/transform positioning to left/top for drag
    const rect = this._el.getBoundingClientRect()
    this._dragOrigL = rect.left
    this._dragOrigT = rect.top

    this._el.style.bottom    = 'auto'
    this._el.style.transform = 'none'
    this._el.style.left      = `${rect.left}px`
    this._el.style.top       = `${rect.top}px`

    this._el.setPointerCapture(e.pointerId)
    e.preventDefault()
  }

  _handlePointerMove (e) {
    if (!this._dragging) return

    const dx = e.clientX - this._dragStartX
    const dy = e.clientY - this._dragStartY

    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      this._hasDragged = true
    }

    this._el.style.left = `${this._dragOrigL + dx}px`
    this._el.style.top  = `${this._dragOrigT + dy}px`
  }

  _handlePointerUp (e) {
    this._dragging = false
    // Reset hasDragged after a tick so click handler can read it
    setTimeout(() => { this._hasDragged = false }, 0)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Canvas drawing
  // ─────────────────────────────────────────────────────────────────────────

  _draw (camera) {
    const ctx   = this._ctx2d
    const scale = this._scale
    const cx    = MAP_HALF
    const cy    = MAP_HALF

    // Clear
    ctx.clearRect(0, 0, MAP_SIZE, MAP_SIZE)

    // Cylinder rings
    ring(ctx, cx, cy, OUTER_R  * scale, 'rgba(255,255,255,0.10)', 1)
    ring(ctx, cx, cy, MIDDLE_R * scale, 'rgba(255,255,255,0.06)', 0.6)
    ring(ctx, cx, cy, INNER_R  * scale, 'rgba(255,255,255,0.05)', 0.5, [3, 4])

    // Axis crosshair
    ctx.beginPath()
    ctx.moveTo(cx - MAP_HALF * 0.18, cy)
    ctx.lineTo(cx + MAP_HALF * 0.18, cy)
    ctx.moveTo(cx, cy - MAP_HALF * 0.18)
    ctx.lineTo(cx, cy + MAP_HALF * 0.18)
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'
    ctx.lineWidth   = 0.5
    ctx.stroke()

    // Portal markers
    this._portals.forEach(portal => {
      const px = cx + portal.x * scale
      const pz = cy + portal.z * scale

      const flash = this._flashState[portal.id]
      if (flash && flash.alpha > 0) {
        ring(ctx, px, pz, flash.ringRadius,
          `rgba(255,255,255,${(Math.max(0, flash.alpha) * 0.55).toFixed(3)})`, 1)
      }

      ring(ctx, px, pz, 7, `${portal.color}30`, 3)
      circle(ctx, px, pz, 4, portal.color, 'rgba(255,255,255,0.30)', 0.5)

      if (this._hoveredPortal?.id === portal.id) {
        ring(ctx, px, pz, 8, 'rgba(255,255,255,0.40)', 1)
      }
    })

    // Camera position
    const camX = camera.position.x
    const camZ = camera.position.z
    const dotX = Math.max(6, Math.min(MAP_SIZE - 6, cx + camX * scale))
    const dotY = Math.max(6, Math.min(MAP_SIZE - 6, cy + camZ * scale))

    const isOut = (
      Math.abs(camX) > this._worldHalf ||
      Math.abs(camZ) > this._worldHalf
    )

    // Camera heading line
    camera.getWorldDirection(this._dir)
    const dx  = this._dir.x
    const dz  = this._dir.z
    const len = Math.sqrt(dx * dx + dz * dz)

    if (len > 0.001) {
      const ndx = dx / len
      const ndz = dz / len
      const LINE_LEN = 16

      ctx.beginPath()
      ctx.moveTo(dotX, dotY)
      ctx.lineTo(dotX + ndx * LINE_LEN, dotY + ndz * LINE_LEN)
      ctx.strokeStyle = isOut ? 'rgba(255,180,100,0.50)' : 'rgba(255,255,255,0.55)'
      ctx.lineWidth   = 1.5
      ctx.lineCap     = 'round'
      ctx.stroke()
      ctx.lineCap     = 'butt'

      // Arrowhead
      const tipX  = dotX + ndx * LINE_LEN
      const tipY  = dotY + ndz * LINE_LEN
      const perpX = -ndz
      const perpY =  ndx
      const AH    = 4
      ctx.beginPath()
      ctx.moveTo(tipX, tipY)
      ctx.lineTo(tipX - ndx * AH * 1.4 + perpX * AH, tipY - ndz * AH * 1.4 + perpY * AH)
      ctx.lineTo(tipX - ndx * AH * 1.4 - perpX * AH, tipY - ndz * AH * 1.4 - perpY * AH)
      ctx.closePath()
      ctx.fillStyle = isOut ? 'rgba(255,180,100,0.55)' : 'rgba(255,255,255,0.60)'
      ctx.fill()
    }

    // Camera dot
    ctx.shadowBlur  = 10
    ctx.shadowColor = isOut ? 'rgba(255,180,100,0.60)' : 'rgba(255,255,255,0.65)'
    circle(ctx, dotX, dotY, 3.5, isOut ? 'rgba(255,180,100,0.90)' : 'rgba(255,255,255,0.95)')
    ctx.shadowBlur  = 0
    ctx.shadowColor = 'transparent'

    // Space name — top-center text inside circle
    ctx.font         = '6px "Courier New", monospace'
    ctx.textAlign    = 'center'
    ctx.textBaseline = 'top'
    ctx.fillStyle    = 'rgba(255,255,255,0.38)'
    ctx.fillText(this._spaceName, cx, 10)

    // Coordinates — bottom-center text inside circle
    const coordText = isOut
      ? `OUT  x${camX.toFixed(1)} z${camZ.toFixed(1)}`
      : `x ${camX.toFixed(1)}  z ${camZ.toFixed(1)}`
    ctx.font      = '5.5px "Courier New", monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    ctx.fillStyle = isOut ? 'rgba(255,180,100,0.55)' : 'rgba(255,255,255,0.22)'
    ctx.fillText(coordText, cx, MAP_SIZE - 10)

    // Portal hover check
    this._checkPortalHover(cx, cy, scale)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Portal hover
  // ─────────────────────────────────────────────────────────────────────────

  _checkPortalHover (cx, cy, scale) {
    const mx = this._mouseCanvas.x
    const my = this._mouseCanvas.y

    let found = null
    for (const portal of this._portals) {
      const px   = cx + portal.x * scale
      const pz   = cy + portal.z * scale
      const dist = Math.sqrt((mx - px) ** 2 + (my - pz) ** 2)
      if (dist <= 8) { found = portal; break }
    }

    if (found !== this._hoveredPortal) {
      this._hoveredPortal = found
      if (found) this._showTooltip(found.label)
      else       this._hideTooltip()
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Tooltip
  // ─────────────────────────────────────────────────────────────────────────

  _showTooltip (text) {
    if (!this._tooltip) return
    this._tooltip.textContent = text
    this._tooltip.classList.add('is-visible')
  }

  _hideTooltip () {
    this._tooltip?.classList.remove('is-visible')
  }

  _handleCanvasMouseMove (e) {
    const rect = this._canvas.getBoundingClientRect()
    this._mouseCanvas.x = e.clientX - rect.left
    this._mouseCanvas.y = e.clientY - rect.top
    // Position tooltip near cursor
    if (this._tooltip) {
      this._tooltip.style.left = `${e.clientX + 12}px`
      this._tooltip.style.top  = `${e.clientY - 20}px`
    }
  }

  _handleMouseLeave () {
    this._mouseCanvas.x = -999
    this._mouseCanvas.y = -999
    this._hoveredPortal = null
    this._hideTooltip()
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Flash
  // ─────────────────────────────────────────────────────────────────────────

  _flashPortal (id) {
    this._flashState[id] = { alpha: 1.0, ringRadius: 4 }
    gsap.to(this._flashState[id], {
      ringRadius: 18,
      duration  : 0.70,
      ease      : 'power2.out',
    })
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Window event handlers
  // ─────────────────────────────────────────────────────────────────────────

  _handlePortalActivated (e) {
    const { id, label } = e.detail ?? {}
    if (id)    this._flashPortal(id)
    if (label) this._spaceName = label
  }

  _handleSpaceChanged (e) {
    const { worldRadius } = e.detail ?? {}
    if (typeof worldRadius === 'number' && worldRadius > 0) {
      this.setWorldBounds(worldRadius)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Sound
  // ─────────────────────────────────────────────────────────────────────────

  _playSound (id) {
    try {
      const Sound = this.ctx?.Sound
      if (Sound && typeof Sound.play === 'function') Sound.play(id)
    } catch (_) {}
  }
}