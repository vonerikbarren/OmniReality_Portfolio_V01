/**
 * ui/MiniMap.js — ⟐mniReality Spatial Mini Map
 *
 * A live top-down canvas rendering of the camera's position within the
 * current space. Fixed to the viewport, bottom-center, just above the Dock.
 * Redraws every frame via update(delta).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Layout
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   Position   →  bottom-center, bottom: DOCK_H + GAP = 60px from viewport floor
 *   Size       →  154 × 154 px  (spec: ~150px)
 *   z-index    →  42  (above Hands 40, below Panels/Drawers 45)
 *   Default    →  visible
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Canvas layers (drawn back → front each frame)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   1. Outer cylinder ring        faint white circle  r = OUTER_R world units
 *   2. Middle cylinder ring       faintest circle     r = MIDDLE_R world units
 *   3. Inner cylinder ring        faint circle        r = INNER_R  world units
 *   4. Axis crosshair             1px lines through centre
 *   5. Portal sphere markers      coloured dots at XZ world positions
 *      └─ Active flash ring       pulse circle on omni:portal-activated
 *   6. Camera heading line        direction the camera faces (XZ projected)
 *   7. Camera dot                 bright white dot with glow
 *   8. "OUT" indicator            shown when camera is outside world bounds
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * World → Canvas projection (top-down, XZ plane)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   World bounds default: OUTER_R + 2 = 40 units half-width
 *   Canvas half-width:    77 px
 *   Scale:                77 / 40 = 1.925 px per world unit
 *
 *   canvasX = MAP_HALF + worldX * scale
 *   canvasY = MAP_HALF + worldZ * scale   ← Z maps to vertical canvas axis
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Default portal positions (from Phase 2 PortalSpheres.js)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   5 spheres at ring radius 14, equally spaced. Used as default markers
 *   until Phase 5 NodeManager calls setPortals() with real data.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Events consumed (window)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   omni:portal-activated  →  { id, label }   flash the matching portal marker
 *   omni:space-changed     →  { worldRadius }  update world bounds (Phase 5+)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Events dispatched (window)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   omni:minimap-toggle    →  { visible }      emitted when map is shown/hidden
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Public API
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   map.init()
 *   map.update(delta)             call every frame from UI.update()
 *   map.destroy()
 *   map.setVisible(bool)
 *   map.toggle()
 *   map.setPortals(portals)       replace markers — [{ id, label, x, z, color }]
 *   map.setWorldBounds(radius)    update scale when entering a new space
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ui/index.js integration
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   import MiniMap from './MiniMap.js'
 *
 *   // in constructor:
 *   this.miniMap = null
 *
 *   // in init(), after all other components:
 *   this.miniMap = new MiniMap(this._ctx)
 *   this.miniMap.init()
 *
 *   // in update(delta):
 *   this.miniMap?.update(delta)
 *
 *   // in destroy():
 *   this.miniMap?.destroy()
 */

import gsap        from 'gsap'
import * as THREE  from 'three'

// ─────────────────────────────────────────────────────────────────────────────
// Layout constants
// ─────────────────────────────────────────────────────────────────────────────

const DOCK_H   = 52      // px — Dock height (from Phase 3a Dock.js)
const GAP      = 8       // px — breathing room above the Dock
const MAP_W    = 154     // px — map canvas width  (logical)
const MAP_H    = 154     // px — map canvas height (logical)
const MAP_HALF = MAP_W / 2   // 77

// ─────────────────────────────────────────────────────────────────────────────
// World-space constants (from Phase 2 RootSpace.js + PortalSpheres.js)
// ─────────────────────────────────────────────────────────────────────────────

const OUTER_R   = 38    // outer cylinder radius
const MIDDLE_R  = 30    // middle cylinder radius
const INNER_R   = 22    // inner cylinder radius (wireframe grid)
const PORTAL_RING_R  = 14    // portal sphere orbit radius
const PORTAL_COUNT   = 5

// World window = OUTER_R + padding (2 units). Canvas HALF = MAP_HALF.
const WORLD_HALF_DEFAULT = OUTER_R + 2   // 40 world units

// ─────────────────────────────────────────────────────────────────────────────
// Default portal definitions (mirrors PortalSpheres.js PORTAL_DEFINITIONS)
// ─────────────────────────────────────────────────────────────────────────────

function buildDefaultPortals () {
  const defs = [
    { id: 'portfolio', label: '⟐Portfolio', color: '#aaddff' },
    { id: 'about',     label: '⟐About',     color: '#ffffff' },
    { id: 'work',      label: '⟐Work',       color: '#ffd0ff' },
    { id: 'omninode',  label: '⟐N',          color: '#ffffff' },
    { id: 'undefined', label: '⟐Undefined',  color: '#888888' },
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
// Canvas drawing helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Draw a filled circle on a 2D canvas context.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x @param {number} y @param {number} r
 * @param {string} fill   @param {string} [stroke]  @param {number} [lineWidth]
 */
function circle (ctx, x, y, r, fill, stroke, lineWidth = 1) {
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  if (fill)   { ctx.fillStyle   = fill;      ctx.fill()   }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.stroke() }
}

/**
 * Draw a ring (stroke-only circle).
 */
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

/* ── Map container ─────────────────────────────────────────────────────────── */

.omni-minimap {
  --mm-bg      : rgba(6, 6, 10, 0.75);
  --mm-border  : rgba(255, 255, 255, 0.09);
  --mm-text    : rgba(255, 255, 255, 0.32);
  --mm-accent  : rgba(255, 255, 255, 0.88);
  --mono       : 'Courier New', Courier, monospace;

  position     : fixed;
  bottom       : ${DOCK_H + GAP}px;
  left         : 50%;
  transform    : translateX(-50%);
  width        : ${MAP_W}px;
  z-index      : 42;
  pointer-events : auto;
  user-select  : none;

  background   : var(--mm-bg);
  backdrop-filter: blur(20px) saturate(1.6);
  -webkit-backdrop-filter: blur(20px) saturate(1.6);
  border       : 1px solid var(--mm-border);
  border-radius: 8px;
  overflow     : hidden;

  -webkit-font-smoothing: antialiased;
}

/* ── Header strip ──────────────────────────────────────────────────────────── */

.mm-header {
  display      : flex;
  align-items  : center;
  justify-content: space-between;
  height       : 20px;
  padding      : 0 7px 0 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  flex-shrink  : 0;
}

.mm-label {
  font-family  : var(--mono);
  font-size    : 6.5px;
  letter-spacing: 0.14em;
  color        : var(--mm-text);
  text-transform: uppercase;
  pointer-events: none;
  line-height  : 1;
}

/* Space name — updates when portal is entered */
.mm-space {
  font-family  : var(--mono);
  font-size    : 6.5px;
  letter-spacing: 0.06em;
  color        : rgba(255, 255, 255, 0.50);
  flex         : 1;
  text-align   : center;
  overflow     : hidden;
  text-overflow: ellipsis;
  white-space  : nowrap;
  pointer-events: none;
  padding      : 0 4px;
}

/* Toggle button — top-right of header */
.mm-toggle {
  width        : 16px;
  height       : 16px;
  display      : flex;
  align-items  : center;
  justify-content: center;
  background   : none;
  border       : 1px solid rgba(255, 255, 255, 0.10);
  border-radius: 3px;
  font-family  : var(--mono);
  font-size    : 8px;
  color        : var(--mm-text);
  cursor       : pointer;
  flex-shrink  : 0;
  line-height  : 1;
  transition   : color 0.12s, border-color 0.12s, background 0.12s;
  padding      : 0;
}

.mm-toggle:hover {
  color        : var(--mm-accent);
  border-color : rgba(255, 255, 255, 0.28);
  background   : rgba(255, 255, 255, 0.07);
}

/* ── Canvas ─────────────────────────────────────────────────────────────────── */

.mm-canvas {
  display      : block;
  width        : ${MAP_W}px;
  height       : ${MAP_H}px;
  /* DPR scaling is applied in JS */
}

/* ── Footer strip — coordinates ─────────────────────────────────────────────── */

.mm-footer {
  display      : flex;
  align-items  : center;
  justify-content: center;
  height       : 16px;
  border-top   : 1px solid rgba(255, 255, 255, 0.05);
  padding      : 0 8px;
  gap          : 8px;
}

.mm-coord {
  font-family  : var(--mono);
  font-size    : 5.5px;
  color        : rgba(255, 255, 255, 0.22);
  letter-spacing: 0.05em;
  pointer-events: none;
  white-space  : nowrap;
  transition   : color 0.14s ease;
}

.mm-coord.is-out {
  color        : rgba(255, 180, 100, 0.60);
}

/* ── Portal marker tooltip ──────────────────────────────────────────────────── */

.mm-portal-tooltip {
  position     : fixed;
  background   : rgba(8, 8, 12, 0.94);
  border       : 1px solid rgba(255, 255, 255, 0.12);
  color        : rgba(255, 255, 255, 0.88);
  font-family  : 'Courier New', Courier, monospace;
  font-size    : 8.5px;
  padding      : 3px 8px;
  border-radius: 4px;
  pointer-events: none;
  z-index      : 80;
  letter-spacing: 0.06em;
  white-space  : nowrap;
  opacity      : 0;
  transition   : opacity 0.12s ease;
  backdrop-filter: blur(8px);
}

.mm-portal-tooltip.is-visible {
  opacity      : 1;
}

/* ── Collapsed (hidden) state — only toggle button remains ──────────────────── */

.omni-minimap.is-hidden {
  width        : auto;
  background   : rgba(6, 6, 10, 0.82);
  border-radius: 6px;
}

.omni-minimap.is-hidden .mm-canvas,
.omni-minimap.is-hidden .mm-footer,
.omni-minimap.is-hidden .mm-space {
  display      : none;
}

.omni-minimap.is-hidden .mm-label {
  display      : none;
}

/* ── Mobile — nudge up slightly to clear soft keyboard if present ───────────── */

@media (max-width: 460px) {
  .omni-minimap {
    bottom     : ${DOCK_H + GAP + 4}px;
  }
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

  /**
   * @param {object} context  — { scene, camera, renderer, sizes, ticker, Sound }
   */
  constructor (context) {
    this.ctx = context

    // ── DOM refs ──────────────────────────────────────────────────────────
    this._el        = null   // .omni-minimap container
    this._canvas    = null   // <canvas> element
    this._ctx2d     = null   // CanvasRenderingContext2D
    this._dpr       = 1      // devicePixelRatio — set in init
    this._coordEl   = null   // coordinate display in footer
    this._spaceEl   = null   // space name in header
    this._tooltip   = null   // portal tooltip element

    // ── State ─────────────────────────────────────────────────────────────
    this._visible     = true
    this._worldHalf   = WORLD_HALF_DEFAULT   // current world bounds
    this._scale       = MAP_HALF / WORLD_HALF_DEFAULT  // px per world unit

    // ── Portal data ───────────────────────────────────────────────────────
    this._portals     = buildDefaultPortals()

    // ── Flash state — id → alpha (0–1, counts down each frame) ───────────
    this._flashState  = {}   // portalId → { alpha, ringRadius }

    // ── Hover state (canvas mouse position) ──────────────────────────────
    this._mouseCanvas = { x: -999, y: -999 }  // logical canvas coords
    this._hoveredPortal = null

    // ── THREE helper — allocated once ─────────────────────────────────────
    this._dir = new THREE.Vector3()

    // ── Bound handlers ────────────────────────────────────────────────────
    this._onPortalActivated = e => this._handlePortalActivated(e)
    this._onSpaceChanged    = e => this._handleSpaceChanged(e)
    this._onPortalEntered   = e => this._handlePortalEntered(e)
    this._onMouseMove       = e => this._handleMouseMove(e)
    this._onMouseLeave      = ()  => this._handleMouseLeave()
  }

  // ── Module contract ──────────────────────────────────────────────────────

  init () {
    injectStyles()
    this._dpr = Math.min(window.devicePixelRatio || 1, 2)   // cap at 2× for perf
    this._buildDOM()
    this._bindEvents()
    console.log('⟐ MiniMap: initialized — 154×154 canvas, scale', this._scale.toFixed(3), 'px/unit.')
  }

  /**
   * Called every frame from UI.update(delta).
   * Redraws the full canvas.
   * @param {number} delta — seconds since last frame
   */
  update (delta) {
    if (!this._visible || !this._ctx2d) return

    const cam = this.ctx?.camera
    if (!cam) return

    // Decay flash alphas
    const ids = Object.keys(this._flashState)
    ids.forEach(id => {
      this._flashState[id].alpha -= delta * 1.4   // ~0.7s fade
      if (this._flashState[id].alpha <= 0) delete this._flashState[id]
    })

    this._draw(cam)
  }

  destroy () {
    this._el?.parentNode?.removeChild(this._el)
    this._tooltip?.parentNode?.removeChild(this._tooltip)

    window.removeEventListener('omni:portal-activated', this._onPortalActivated)
    window.removeEventListener('omni:space-changed',    this._onSpaceChanged)
    window.removeEventListener('omni:portal-activated', this._onPortalEntered)

    this._canvas?.removeEventListener('mousemove',  this._onMouseMove)
    this._canvas?.removeEventListener('mouseleave', this._onMouseLeave)
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Show or hide the map.
   * @param {boolean} visible
   */
  setVisible (visible) {
    if (this._visible === visible) return
    this._visible = visible

    if (visible) {
      this._el.classList.remove('is-hidden')
      gsap.fromTo(this._el,
        { opacity: 0, scale: 0.90 },
        { opacity: 1, scale: 1, duration: 0.22, ease: 'back.out(1.8)' }
      )
    } else {
      gsap.to(this._el, {
        opacity : 0,
        scale   : 0.90,
        duration: 0.16,
        ease    : 'power2.in',
        onComplete: () => {
          this._el.classList.add('is-hidden')
          gsap.set(this._el, { opacity: 1, scale: 1 })
        },
      })
    }

    window.dispatchEvent(new CustomEvent('omni:minimap-toggle', {
      detail: { visible },
    }))
  }

  toggle () {
    this.setVisible(!this._visible)
    this._playSound(this._visible ? 'open' : 'close')
  }

  /**
   * Replace portal markers with new data.
   * @param {{ id: string, label: string, x: number, z: number, color: string }[]} portals
   */
  setPortals (portals) {
    this._portals = portals
  }

  /**
   * Update the world-space radius the map displays.
   * Call when the camera enters a new space of a different scale.
   * @param {number} radius  — world units from centre to edge
   */
  setWorldBounds (radius) {
    this._worldHalf = radius + 2   // 2-unit padding
    this._scale     = MAP_HALF / this._worldHalf
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DOM Construction
  // ─────────────────────────────────────────────────────────────────────────

  _buildDOM () {
    const el = document.createElement('div')
    el.id        = 'omni-minimap'
    el.className = 'omni-minimap'
    el.setAttribute('aria-label', 'Spatial mini map')
    el.setAttribute('role', 'img')

    el.appendChild(this._buildHeader())
    el.appendChild(this._buildCanvas())
    el.appendChild(this._buildFooter())

    this._el = el

    const shell = document.getElementById('omni-ui') ?? document.body
    shell.appendChild(el)

    // Tooltip
    this._buildTooltip()
  }

  _buildHeader () {
    const header = document.createElement('div')
    header.className = 'mm-header'

    const label = document.createElement('span')
    label.className   = 'mm-label'
    label.textContent = 'MAP'

    const space = document.createElement('span')
    space.className   = 'mm-space'
    space.textContent = 'Root'
    this._spaceEl = space

    const toggleBtn = document.createElement('button')
    toggleBtn.className = 'mm-toggle'
    toggleBtn.innerHTML = '✕'
    toggleBtn.title = 'Hide mini map'
    toggleBtn.setAttribute('aria-label', 'Toggle mini map')
    toggleBtn.addEventListener('click', () => this.toggle())
    this._toggleBtn = toggleBtn

    header.appendChild(label)
    header.appendChild(space)
    header.appendChild(toggleBtn)

    return header
  }

  _buildCanvas () {
    const canvas = document.createElement('canvas')
    canvas.className = 'mm-canvas'

    // HiDPI — physical px = logical × DPR
    canvas.width  = MAP_W * this._dpr
    canvas.height = MAP_H * this._dpr
    canvas.style.width  = `${MAP_W}px`
    canvas.style.height = `${MAP_H}px`

    const ctx = canvas.getContext('2d')
    ctx.scale(this._dpr, this._dpr)

    this._canvas = canvas
    this._ctx2d  = ctx

    return canvas
  }

  _buildFooter () {
    const footer = document.createElement('div')
    footer.className = 'mm-footer'

    const coord = document.createElement('span')
    coord.className   = 'mm-coord'
    coord.textContent = 'x — · z —'
    this._coordEl = coord

    footer.appendChild(coord)
    return footer
  }

  _buildTooltip () {
    const tt = document.createElement('div')
    tt.className = 'mm-portal-tooltip'
    document.body.appendChild(tt)
    this._tooltip = tt
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Canvas drawing — called every frame
  // ─────────────────────────────────────────────────────────────────────────

  _draw (camera) {
    const ctx   = this._ctx2d
    const scale = this._scale
    const cx    = MAP_HALF   // canvas centre X
    const cy    = MAP_HALF   // canvas centre Y

    // ── Clear ──────────────────────────────────────────────────────────
    ctx.clearRect(0, 0, MAP_W, MAP_H)

    // ── Cylinder rings (world-space radii → canvas) ─────────────────────
    ring(ctx, cx, cy, OUTER_R  * scale, 'rgba(255,255,255,0.10)', 1)
    ring(ctx, cx, cy, MIDDLE_R * scale, 'rgba(255,255,255,0.06)', 0.6)
    ring(ctx, cx, cy, INNER_R  * scale, 'rgba(255,255,255,0.05)', 0.5, [3, 4])

    // ── Axis crosshair ─────────────────────────────────────────────────
    ctx.beginPath()
    ctx.moveTo(cx - MAP_HALF * 0.18, cy)
    ctx.lineTo(cx + MAP_HALF * 0.18, cy)
    ctx.moveTo(cx, cy - MAP_HALF * 0.18)
    ctx.lineTo(cx, cy + MAP_HALF * 0.18)
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'
    ctx.lineWidth   = 0.5
    ctx.stroke()

    // ── Portal sphere markers ───────────────────────────────────────────
    this._portals.forEach(portal => {
      const px = cx + portal.x * scale
      const pz = cy + portal.z * scale

      // Flash ring — expands and fades on portal activation
      const flash = this._flashState[portal.id]
      if (flash && flash.alpha > 0) {
        const a = Math.max(0, flash.alpha)
        const rExpand = flash.ringRadius
        ring(ctx, px, pz, rExpand, `rgba(255,255,255,${(a * 0.55).toFixed(3)})`, 1)
      }

      // Outer glow ring
      ring(ctx, px, pz, 7, `${portal.color}30`, 3)

      // Portal dot — coloured fill
      circle(ctx, px, pz, 4, portal.color, 'rgba(255,255,255,0.30)', 0.5)

      // Hover highlight
      if (this._hoveredPortal?.id === portal.id) {
        ring(ctx, px, pz, 8, 'rgba(255,255,255,0.40)', 1)
      }
    })

    // ── Camera position → canvas coords ────────────────────────────────
    const camWorldX = camera.position.x
    const camWorldZ = camera.position.z

    const camCX = cx + camWorldX * scale
    const camCY = cy + camWorldZ * scale

    const isOut = (
      Math.abs(camWorldX) > this._worldHalf ||
      Math.abs(camWorldZ) > this._worldHalf
    )

    // ── Camera heading line (XZ plane direction) ────────────────────────
    camera.getWorldDirection(this._dir)
    const dirX  = this._dir.x
    const dirZ  = this._dir.z
    const len   = Math.sqrt(dirX * dirX + dirZ * dirZ)

    if (len > 0.001) {
      const ndx = dirX / len
      const ndz = dirZ / len
      const LINE_LEN = 16   // px

      // Clamp heading line start to visible canvas area
      const startX = Math.max(4, Math.min(MAP_W - 4, camCX))
      const startY = Math.max(4, Math.min(MAP_H - 4, camCY))

      ctx.beginPath()
      ctx.moveTo(startX, startY)
      ctx.lineTo(startX + ndx * LINE_LEN, startY + ndz * LINE_LEN)
      ctx.strokeStyle = isOut
        ? 'rgba(255, 180, 100, 0.50)'
        : 'rgba(255, 255, 255, 0.55)'
      ctx.lineWidth   = 1.5
      ctx.lineCap     = 'round'
      ctx.stroke()
      ctx.lineCap     = 'butt'

      // Arrowhead — tiny triangle at the tip of the heading line
      const tipX  = startX + ndx * LINE_LEN
      const tipY  = startY + ndz * LINE_LEN
      const perpX = -ndz  // perpendicular
      const perpY =  ndx
      const AH    = 4     // arrowhead half-width

      ctx.beginPath()
      ctx.moveTo(tipX, tipY)
      ctx.lineTo(tipX - ndx * AH * 1.4 + perpX * AH, tipY - ndz * AH * 1.4 + perpY * AH)
      ctx.lineTo(tipX - ndx * AH * 1.4 - perpX * AH, tipY - ndz * AH * 1.4 - perpY * AH)
      ctx.closePath()
      ctx.fillStyle = isOut
        ? 'rgba(255, 180, 100, 0.55)'
        : 'rgba(255, 255, 255, 0.60)'
      ctx.fill()
    }

    // ── Camera dot ─────────────────────────────────────────────────────
    const dotX = Math.max(4, Math.min(MAP_W - 4, camCX))
    const dotY = Math.max(4, Math.min(MAP_H - 4, camCY))

    // Glow
    ctx.shadowBlur  = 10
    ctx.shadowColor = isOut ? 'rgba(255,180,100,0.60)' : 'rgba(255,255,255,0.65)'

    circle(ctx, dotX, dotY, 3.5,
      isOut ? 'rgba(255,180,100,0.90)' : 'rgba(255,255,255,0.95)')

    ctx.shadowBlur  = 0
    ctx.shadowColor = 'transparent'

    // ── "OUT" indicator text — camera outside world bounds ──────────────
    if (isOut) {
      ctx.fillStyle = 'rgba(255,180,100,0.55)'
      ctx.font      = `bold ${5.5 * this._dpr / this._dpr}px "Courier New"`
      ctx.fillText('OUT', MAP_W - 22, 10)
    }

    // ── Update coordinate footer ────────────────────────────────────────
    this._updateCoords(camWorldX, camWorldZ, isOut)

    // ── Check hover over portals ────────────────────────────────────────
    this._checkPortalHover(cx, cy, scale)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Coordinate display
  // ─────────────────────────────────────────────────────────────────────────

  _updateCoords (x, z, isOut) {
    if (!this._coordEl) return
    this._coordEl.textContent = `x ${x.toFixed(1)} · z ${z.toFixed(1)}`
    this._coordEl.classList.toggle('is-out', isOut)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Portal hover detection (canvas mouse coords)
  // ─────────────────────────────────────────────────────────────────────────

  _checkPortalHover (cx, cy, scale) {
    const mx = this._mouseCanvas.x
    const my = this._mouseCanvas.y

    let found = null
    for (const portal of this._portals) {
      const px  = cx + portal.x * scale
      const pz  = cy + portal.z * scale
      const dx  = mx - px
      const dy  = my - pz
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist <= 8) { found = portal; break }
    }

    if (found !== this._hoveredPortal) {
      this._hoveredPortal = found
      if (found) {
        this._showTooltip(found.label)
      } else {
        this._hideTooltip()
      }
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

  _positionTooltip (clientX, clientY) {
    if (!this._tooltip) return
    this._tooltip.style.left = `${clientX + 12}px`
    this._tooltip.style.top  = `${clientY - 20}px`
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Flash animation (portal activation)
  // ─────────────────────────────────────────────────────────────────────────

  _flashPortal (id) {
    // Animate ring radius from 4 → 18 while alpha decays in update()
    this._flashState[id] = { alpha: 1.0, ringRadius: 4 }
    gsap.to(this._flashState[id], {
      ringRadius: 18,
      duration  : 0.70,
      ease      : 'power2.out',
    })
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Event handlers
  // ─────────────────────────────────────────────────────────────────────────

  _bindEvents () {
    window.addEventListener('omni:portal-activated', this._onPortalActivated)
    window.addEventListener('omni:space-changed',    this._onSpaceChanged)

    // Canvas mouse tracking for portal hover
    this._canvas.addEventListener('mousemove',  this._onMouseMove)
    this._canvas.addEventListener('mouseleave', this._onMouseLeave)
  }

  _handlePortalActivated (e) {
    const { id, label } = e.detail ?? {}

    // Flash the portal marker
    if (id) this._flashPortal(id)

    // Update space name
    if (label && this._spaceEl) {
      this._spaceEl.textContent = label
    }
  }

  _handlePortalEntered (e) {
    const { label } = e.detail ?? {}
    if (label && this._spaceEl) {
      this._spaceEl.textContent = label
    }
  }

  _handleSpaceChanged (e) {
    const { worldRadius } = e.detail ?? {}
    if (typeof worldRadius === 'number' && worldRadius > 0) {
      this.setWorldBounds(worldRadius)
    }
  }

  _handleMouseMove (e) {
    const rect = this._canvas.getBoundingClientRect()
    this._mouseCanvas.x = e.clientX - rect.left
    this._mouseCanvas.y = e.clientY - rect.top
    this._positionTooltip(e.clientX, e.clientY)
  }

  _handleMouseLeave () {
    this._mouseCanvas.x = -999
    this._mouseCanvas.y = -999
    this._hoveredPortal = null
    this._hideTooltip()
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
