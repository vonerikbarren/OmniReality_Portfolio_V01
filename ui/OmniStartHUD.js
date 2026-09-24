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
import { findOwnerOf } from '../utils/JsonifierRegistry.js'

const STYLES = /* css */`

#omni-start-hud {
  position        : fixed;
  inset           : 7%;   /* meaningful margin from the true viewport edges — a HUD shouldn't fill the whole screen */
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
  transition      : opacity 0.2s ease;
}
/* Real quadrant maximize — expands to fill this same, bounded
   #omni-start-hud container (never the full browser viewport), so
   the rest of the real UI (drawer, Admin, etc.) stays reachable
   while one quadrant is maximized, per direct request. */
.osh-quadrant.is-maximized {
  top: 0 !important; left: 0 !important; right: 0 !important; bottom: 0 !important;
  width: 100%; height: 100%; z-index: 5;
}
.osh-quadrant.is-hidden { opacity: 0; visibility: hidden; pointer-events: none; }
.osh-maximize-btn {
  position: absolute; top: 4px; right: 4px; z-index: 6; pointer-events: auto;
  background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15);
  border-radius: 5px; color: rgba(255,255,255,0.6); font-size: 11px;
  width: 20px; height: 20px; cursor: pointer; line-height: 1;
}
.osh-maximize-btn:hover { background: rgba(255,255,255,0.18); color: #fff; }
.osh-panel--minimap { display: flex; flex-direction: column; width: 100%; height: 100%; pointer-events: auto; }
.osh-minimap-header { font-size: 10px; color: rgba(255,255,255,0.7); padding: 4px 8px; font-family: 'Courier New', Courier, monospace; }
.osh-minimap-canvas { flex: 1; width: 100%; cursor: pointer; }
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
  background      : rgba(8, 8, 12, 0.50);
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

/* ── Q1 live-data grid — moved here from GlobalBar's old expanded state ──── */

.osh-panel--data {
  align-items     : stretch;
  justify-content  : stretch;
  padding         : 10px;
  overflow-y      : auto;
  border           : 2px solid rgba(0, 0, 0, 0.7);
  box-shadow       : inset 0 0 0 1px rgba(255, 255, 255, 0.12), 0 4px 18px rgba(0, 0, 0, 0.55);
}

/* Real grid-line background — graph-paper style — data sits at its
   perimeter (corners/edges), center left open. */
/* Real grid-line background — graph-paper style. Organized middle
   outward by data class: the core transform data (Position/Rotation/
   Scale) sits in the cells directly edge-adjacent to the empty center
   (ml/mr/bm — sharing an actual edge with the middle, not just a
   corner), while more contextual/peripheral data (Performance, System
   Details, Dimension, Dimensional+) sits in the four corners, furthest
   from center. A soft drop-shadow sits behind the grid lines
   specifically so they stay visible whether the current domain's
   background happens to be dark or light. */
.osh-data-grid {
  display              : grid;
  grid-template-columns: 1fr 1fr 1fr;
  grid-template-rows   : auto 1fr auto;
  grid-template-areas  :
    "tl  .   tr"
    "ml  .   mr"
    "bl  bm  br";
  gap                  : 8px 10px;
  width                : 100%;
  height               : 100%;
  font-family          : 'Courier New', Courier, monospace;
  background-image     :
    linear-gradient(rgba(255, 255, 255, 0.07) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.07) 1px, transparent 1px);
  background-size      : 18px 18px;
  filter               : drop-shadow(0 2px 10px rgba(0, 0, 0, 0.65));
}

.osh-json-tree {
  width: 100%; height: 100%; overflow-y: auto; pointer-events: auto;
  font-family: 'Courier New', Courier, monospace;
}
/* Real fix — .oj-node/.oj-key/etc. (reused here from
   OmniJsonifier.js's own _renderNode output) rely on CSS variables
   scoped to .omni-jsonifier's own root; those variables are
   undefined here, so text was silently falling back to the browser
   default instead of white. Explicit override for this reuse. */
.osh-json-tree .oj-node,
.osh-json-tree .oj-toggle,
.osh-json-tree .oj-key,
.osh-json-tree .oj-leaf-value {
  color: #ffffff;
}
.osh-json-empty {
  color: rgba(255,255,255,0.45); font-size: 10px; text-align: center;
  padding: 20px 10px; line-height: 1.6; font-family: 'Courier New', Courier, monospace;
}

.osh-pocket-header {
  font-size: 10px; color: rgba(255,255,255,0.7); padding: 4px 8px;
  border-bottom: 1px solid rgba(255,255,255,0.08); font-family: 'Courier New', Courier, monospace;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.osh-pocket-list { flex: 1; overflow-y: auto; padding: 4px; pointer-events: auto; }
.osh-pocket-item {
  display: flex; align-items: center; gap: 4px; padding: 4px 6px; margin-bottom: 3px;
  background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); border-radius: 5px;
  cursor: grab; font-size: 9.5px; color: rgba(255,255,255,0.85); font-family: 'Courier New', Courier, monospace;
}
.osh-pocket-item.dragging { opacity: 0.4; }
.osh-pocket-item-label { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.osh-pocket-btn {
  background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); border-radius: 4px;
  color: #fff; font-size: 8.5px; padding: 2px 5px; cursor: pointer;
}
.osh-pocket-btn:hover { background: rgba(255,255,255,0.18); }
.osh-pocket-preview {
  margin-top: 4px; padding: 6px; background: rgba(0,0,0,0.3); border-radius: 5px;
  font-size: 9px; color: rgba(255,255,255,0.7); max-height: 100px; overflow-y: auto; white-space: pre-wrap;
}
/* Real fix — same real cause as Q3's own fix above: this preview
   also reuses OmniJsonifier's _renderNode output for JSON-type
   entries, with the same undefined-CSS-variable problem. */
.osh-pocket-preview .oj-node,
.osh-pocket-preview .oj-toggle,
.osh-pocket-preview .oj-key,
.osh-pocket-preview .oj-leaf-value {
  color: #ffffff;
}

.osh-data-group--performance      { grid-area: tl; text-align: left;   }
.osh-data-group--systemdetails    { grid-area: tr; text-align: right;  }
.osh-data-group--position         { grid-area: ml; text-align: left;   }
.osh-data-group--rotation         { grid-area: mr; text-align: right;  }
.osh-data-group--dimension        { grid-area: bl; text-align: left;   }
.osh-data-group--scale            { grid-area: bm; text-align: center; }
.osh-data-group--dimensionalplus  { grid-area: br; text-align: right;  }

.osh-data-group-label {
  font-size        : 8.5px;
  letter-spacing   : 0.1em;
  text-transform   : uppercase;
  color            : rgba(255, 255, 255, 0.65);
  margin-bottom    : 2px;
}

.osh-data-xyz {
  display          : flex;
  flex-direction   : column;
  gap              : 2px;
}
.osh-data-group--rotation .osh-data-xyz { align-items: flex-end; }
.osh-data-group--scale .osh-data-xyz { align-items: center; }

.osh-data-xyz-item {
  display          : flex;
  align-items      : center;
  gap              : 4px;
  font-size        : 9.5px;
}
.osh-data-xyz-axis { color: rgba(255, 255, 255, 0.55); }
.osh-data-xyz-val  { color: rgba(255, 255, 255, 1);    font-weight: 600; }

.osh-data-kv {
  display          : flex;
  justify-content  : space-between;
  gap              : 8px;
  font-size        : 9.5px;
}
.osh-data-group--systemdetails .osh-data-kv,
.osh-data-group--dimensionalplus .osh-data-kv { flex-direction: row-reverse; }
.osh-data-kv-key { color: rgba(255, 255, 255, 0.55); }
.osh-data-kv-val { color: rgba(255, 255, 255, 1); font-weight: 600; }
.osh-data-kv-val.undef { color: rgba(255, 255, 255, 0.4); font-weight: 400; }

.osh-data-fps-badge {
  display          : flex;
  align-items      : baseline;
  gap              : 4px;
  justify-content  : flex-start;   /* Performance now sits on the left (tl) */
}
.osh-data-fps-num {
  font-size        : 20px;
  font-weight      : bold;
  color            : #ffffff;
  text-shadow      : 0 0 8px rgba(255, 255, 255, 0.5);
}
.osh-data-fps-unit {
  font-size        : 9px;
  color            : rgba(255, 255, 255, 0.6);
}
.osh-data-perf-label {
  font-size        : 9px;
  color            : rgba(255, 255, 255, 0.75);
  margin-top       : 2px;
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
    this._onGlobalBarData = null
    this._preview = null   // the center diamond's own tiny renderer/scene/mesh
    this.omniPocket = null   // set later via setOmniPocket() — needed for Q2's own real pocket manager
    this.omniNode = null   // set later via setOmniNode() — needed for Q4's real node markers
    this.omniRealityGridSelector = null   // set later via setOmniRealityGridSelector() — needed for Q4's real staged-context regions
  }

  init () {
    injectStyles()
    this._el = this._buildDOM()
    const shell = document.getElementById('omni-ui') ?? document.body
    shell.appendChild(this._el)

    // Real fix — this decorative preview is small on purpose; a real
    // WebGL failure here should never take down everything
    // registered after it in init(), including Q3.
    try { this._setupPreview() } catch (err) { console.warn('⟐OmniStartHUD — preview diamond failed to initialize, continuing without it', err) }
    this._buildDataGrid()

    this._onToggle = () => this.toggle()
    window.addEventListener('omni:osh-toggle', this._onToggle)

    // Q1's live-data grid — moved here from GlobalBar's old expanded
    // state. GlobalBar still owns the actual computation (FPS averaging,
    // camera feed); this just renders whatever it broadcasts.
    this._onGlobalBarData = (e) => this._updateDataGrid(e.detail)
    window.addEventListener('omni:globalbar-data', this._onGlobalBarData)

    // Q3 — reflects whatever's currently selected in the scene,
    // regardless of which real Jsonifier instance's tree it belongs
    // to (the standalone panel, About Me's own, or any future
    // section) — the same real, shared selection signal every other
    // selection-aware system here already reacts to.
    this._onNodeSelected = (e) => this._updateJsonTree(e.detail?.mesh?.userData?.nodeId)
    this._onNodeDeselected = () => this._updateJsonTree(null)
    window.addEventListener('omni:node-selected', this._onNodeSelected)
    window.addEventListener('omni:node-deselected', this._onNodeDeselected)
    this._updateJsonTree(null)   // real, immediate empty state

    // Q2 — real, live pocket manager. Re-renders whenever the
    // pocket's own real contents genuinely change, not just once on open.
    this._onPocketChanged = () => this._renderPocketList()
    window.addEventListener('omni:node-extracted', this._onPocketChanged)
    window.addEventListener('omni:node-reinstated', this._onPocketChanged)
    this._renderPocketList()

    this._maximizedQuadrant = null
    this._el.querySelectorAll('.osh-maximize-btn').forEach(btn => {
      btn.addEventListener('click', () => this._toggleMaximize(btn.dataset.quadrant))
    })

    // Q4 — real, live minimap. Re-renders on any real, genuine
    // change to node data, not just once on open.
    this._onNodesUpdatedForMinimap = () => this._renderMinimap()
    window.addEventListener('omni:nodes-updated', this._onNodesUpdatedForMinimap)
    this._el.querySelector('#osh-minimap-canvas').addEventListener('click', (e) => this._onMinimapClick(e))
    this._renderMinimap()
  }

  /** Real quadrant maximize — expands the chosen quadrant to fill
   *  the whole, already-bounded #omni-start-hud container (never
   *  the full browser viewport, so the rest of the real UI stays
   *  reachable, per direct request) and hides the other three.
   *  Clicking the same button again restores the normal layout. */
  _toggleMaximize (quadrant) {
    const isRestoring = this._maximizedQuadrant === quadrant
    this._maximizedQuadrant = isRestoring ? null : quadrant

    this._el.querySelectorAll('.osh-quadrant').forEach(q => {
      const isThisOne = q.dataset.quadrant === quadrant
      q.classList.toggle('is-maximized', !isRestoring && isThisOne)
      q.classList.toggle('is-hidden', !isRestoring && !isThisOne)
      const btn = q.querySelector('.osh-maximize-btn')
      btn.textContent = (!isRestoring && isThisOne) ? '⊡' : '⛶'
    })

    // The canvas's own real pixel size only settles once its
    // container is done resizing (e.g. just maximized) — re-render
    // on the next frame so the minimap isn't left stretched/blurry
    // at its old, pre-maximize size.
    requestAnimationFrame(() => this._renderMinimap())
  }

  /** Q4 — real, live minimap, fit to whatever real content actually
   *  exists (real node positions, real staged-context regions, and
   *  the real landing point) rather than the floor's full, mostly-
   *  empty 3000-unit extent, which would leave everything a tiny
   *  cluster in the center. A genuinely empty minimap is the honest,
   *  correct state when nothing real exists yet — matches
   *  OmniFloor's own real discipline of only building what actually
   *  needs to exist. */
  _renderMinimap () {
    const canvas = this._el?.querySelector('#osh-minimap-canvas')
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return   // not laid out yet — nothing real to draw against
    canvas.width = rect.width
    canvas.height = rect.height
    const c = canvas.getContext('2d')
    c.clearRect(0, 0, canvas.width, canvas.height)

    const CELL_SIZE = 20   // matches the floor's own real grid (OmniFloor.js) and OmniRealityGridSelector's own real cells
    const LANDING = { x: 0, z: 0.001 }   // matches main.js's own real returnToLanding()

    const nodes = this.omniNode?.getAllNodes() ?? []
    const contexts = this.omniRealityGridSelector?.getContexts() ?? {}

    // Real, current bounding box across every real thing that
    // exists — nodes, every staged context's own real cells, and
    // the real landing point — with a real, sensible fallback range
    // when nothing exists yet, so the minimap never divides by zero.
    let minX = LANDING.x, maxX = LANDING.x, minZ = LANDING.z, maxZ = LANDING.z
    nodes.forEach(n => {
      const [x, , z] = n.position ?? [0, 0, 0]
      minX = Math.min(minX, x); maxX = Math.max(maxX, x)
      minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z)
    })
    Object.values(contexts).forEach(ctx => {
      ctx.cells.forEach(cell => {
        const x0 = cell.cx * CELL_SIZE, x1 = x0 + CELL_SIZE
        const z0 = cell.cz * CELL_SIZE, z1 = z0 + CELL_SIZE
        minX = Math.min(minX, x0); maxX = Math.max(maxX, x1)
        minZ = Math.min(minZ, z0); maxZ = Math.max(maxZ, z1)
      })
    })
    const rangeX = Math.max(maxX - minX, CELL_SIZE * 4)
    const rangeZ = Math.max(maxZ - minZ, CELL_SIZE * 4)
    const pad = 0.2
    minX -= rangeX * pad; maxX += rangeX * pad
    minZ -= rangeZ * pad; maxZ += rangeZ * pad

    const worldToCanvas = (x, z) => [
      ((x - minX) / (maxX - minX)) * canvas.width,
      ((z - minZ) / (maxZ - minZ)) * canvas.height,
    ]
    // Stored so a click on the canvas can reverse this exact
    // mapping back to real world coordinates.
    this._minimapMapping = { minX, maxX, minZ, maxZ, width: canvas.width, height: canvas.height }

    // Faint grid background, at the real, matching cell size
    c.strokeStyle = 'rgba(255,255,255,0.06)'
    c.lineWidth = 1
    const [gx0] = worldToCanvas(Math.ceil(minX / CELL_SIZE) * CELL_SIZE, 0)
    const stepX = (CELL_SIZE / (maxX - minX)) * canvas.width
    for (let x = gx0; x < canvas.width; x += stepX) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, canvas.height); c.stroke() }
    const stepZ = (CELL_SIZE / (maxZ - minZ)) * canvas.height
    const [, gz0] = worldToCanvas(0, Math.ceil(minZ / CELL_SIZE) * CELL_SIZE)
    for (let z = gz0; z < canvas.height; z += stepZ) { c.beginPath(); c.moveTo(0, z); c.lineTo(canvas.width, z); c.stroke() }

    // Real, staged contexts — drawn as real regions, exactly as
    // they'll also appear as a real, in-scene wireframe boundary
    // (OmniRealityGridSelector's own real loadContext), so the same
    // area reads consistently both places, per direct request.
    Object.entries(contexts).forEach(([id, ctx]) => {
      c.fillStyle = 'rgba(255, 238, 0, 0.18)'
      c.strokeStyle = 'rgba(255, 238, 0, 0.5)'
      ctx.cells.forEach(cell => {
        const [px, py] = worldToCanvas(cell.cx * CELL_SIZE, cell.cz * CELL_SIZE)
        const [px2, py2] = worldToCanvas((cell.cx + 1) * CELL_SIZE, (cell.cz + 1) * CELL_SIZE)
        c.fillRect(px, py, px2 - px, py2 - py)
        c.strokeRect(px, py, px2 - px, py2 - py)
      })
      const firstCell = ctx.cells[0]
      if (firstCell) {
        const [lx, ly] = worldToCanvas(firstCell.cx * CELL_SIZE, firstCell.cz * CELL_SIZE)
        c.fillStyle = 'rgba(255, 238, 0, 0.9)'
        c.font = '8px monospace'
        c.fillText(ctx.label ?? id, lx + 2, ly + 9)
      }
    })

    // Real nodes, as simple markers
    c.fillStyle = 'rgba(140, 255, 180, 0.9)'
    nodes.forEach(n => {
      const [x, , z] = n.position ?? [0, 0, 0]
      const [px, py] = worldToCanvas(x, z)
      c.beginPath(); c.arc(px, py, 2.5, 0, Math.PI * 2); c.fill()
    })

    // The real landing point — a distinct marker
    const [lpx, lpy] = worldToCanvas(LANDING.x, LANDING.z)
    c.strokeStyle = '#ffffff'
    c.lineWidth = 1.5
    c.beginPath()
    c.moveTo(lpx - 5, lpy); c.lineTo(lpx + 5, lpy)
    c.moveTo(lpx, lpy - 5); c.lineTo(lpx, lpy + 5)
    c.stroke()
  }

  /** Real click-to-fast-travel — reverses the same real mapping
   *  _renderMinimap used to draw the map, so the clicked point maps
   *  back to the real world coordinate it visually represents. */
  _onMinimapClick (e) {
    const m = this._minimapMapping
    if (!m) return
    const rect = e.target.getBoundingClientRect()
    const px = e.clientX - rect.left, py = e.clientY - rect.top
    const worldX = m.minX + (px / m.width) * (m.maxX - m.minX)
    const worldZ = m.minZ + (py / m.height) * (m.maxZ - m.minZ)

    const cam = this.ctx.camera
    gsap.to(cam.position, {
      x: worldX, y: Math.max(cam.position.y, 8), z: worldZ + 15,
      duration: 1.0, ease: 'power2.inOut',
      onUpdate: () => cam.lookAt(worldX, 0, worldZ),
    })
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
    window.removeEventListener('omni:globalbar-data', this._onGlobalBarData)
    window.removeEventListener('omni:node-selected', this._onNodeSelected)
    window.removeEventListener('omni:node-deselected', this._onNodeDeselected)
    window.removeEventListener('omni:node-extracted', this._onPocketChanged)
    window.removeEventListener('omni:node-reinstated', this._onPocketChanged)
    window.removeEventListener('omni:nodes-updated', this._onNodesUpdatedForMinimap)
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

  // ── Q1 live-data grid — same content GlobalBar's old expanded state
  // showed, transplanted here rather than reinvented. GlobalBar still
  // computes it (FPS averaging, camera feed) and broadcasts it; this
  // just renders it.

  _buildDataGrid () {
    const grid = this._el?.querySelector('#osh-data-grid')
    if (!grid) return

    const xyzRow = (idPrefix) => /* html */`
      <div class="osh-data-xyz">
        <span class="osh-data-xyz-item"><span class="osh-data-xyz-axis">x</span><span class="osh-data-xyz-val" id="${idPrefix}-x">0.00</span></span>
        <span class="osh-data-xyz-item"><span class="osh-data-xyz-axis">y</span><span class="osh-data-xyz-val" id="${idPrefix}-y">0.00</span></span>
        <span class="osh-data-xyz-item"><span class="osh-data-xyz-axis">z</span><span class="osh-data-xyz-val" id="${idPrefix}-z">0.00</span></span>
      </div>
    `
    const kvRow = (key, id) => /* html */`
      <div class="osh-data-kv">
        <span class="osh-data-kv-key">${key}</span>
        <span class="osh-data-kv-val undef" id="${id}">undefined</span>
      </div>
    `

    grid.innerHTML = /* html */`
      <div class="osh-data-group osh-data-group--position">
        <div class="osh-data-group-label">Position</div>
        ${xyzRow('osh-pos')}
      </div>
      <div class="osh-data-group osh-data-group--rotation">
        <div class="osh-data-group-label">Rotation</div>
        ${xyzRow('osh-rot')}
      </div>
      <div class="osh-data-group osh-data-group--scale">
        <div class="osh-data-group-label">Scale</div>
        ${xyzRow('osh-sca')}
      </div>
      <div class="osh-data-group osh-data-group--performance">
        <div class="osh-data-group-label">Performance</div>
        <div class="osh-data-fps-badge">
          <span class="osh-data-fps-num" id="osh-fps">--</span>
          <span class="osh-data-fps-unit">fps</span>
        </div>
        <div class="osh-data-perf-label" id="osh-perf">—</div>
      </div>
      <div class="osh-data-group osh-data-group--systemdetails">
        <div class="osh-data-group-label">System Details</div>
        ${kvRow('Roots', 'osh-roots')}
        ${kvRow('Parents', 'osh-parents')}
        ${kvRow('Child', 'osh-child')}
      </div>
      <div class="osh-data-group osh-data-group--dimension">
        <div class="osh-data-group-label">Dimension</div>
        ${kvRow('Reality', 'osh-reality')}
        ${kvRow('Experience', 'osh-experience')}
        ${kvRow('Perspective', 'osh-perspective')}
      </div>
      <div class="osh-data-group osh-data-group--dimensionalplus">
        <div class="osh-data-group-label">Dimensional+</div>
        ${kvRow('Time', 'osh-dim-time')}
        ${kvRow('Space', 'osh-dim-space')}
        ${kvRow('Object', 'osh-dim-object')}
      </div>
    `
  }

  _updateDataGrid (d) {
    if (!d || !this._el) return

    const setEl = (id, text) => { const el = this._el.querySelector(`#${id}`); if (el) el.textContent = text }
    const setKV = (id, value) => {
      const el = this._el.querySelector(`#${id}`)
      if (!el) return
      if (value == null) { el.textContent = 'undefined'; el.classList.add('undef') }
      else { el.textContent = String(value); el.classList.remove('undef') }
    }
    const fmt = (n) => (n == null || isNaN(n)) ? '---' : Number(n).toFixed(2)

    if (d.pos)   { setEl('osh-pos-x', fmt(d.pos.x));   setEl('osh-pos-y', fmt(d.pos.y));   setEl('osh-pos-z', fmt(d.pos.z))   }
    if (d.rot)   { setEl('osh-rot-x', fmt(d.rot.x));   setEl('osh-rot-y', fmt(d.rot.y));   setEl('osh-rot-z', fmt(d.rot.z))   }
    if (d.scale) { setEl('osh-sca-x', fmt(d.scale.x)); setEl('osh-sca-y', fmt(d.scale.y)); setEl('osh-sca-z', fmt(d.scale.z)) }

    setEl('osh-fps',  String(d.fps ?? 0))
    setEl('osh-perf', d.perf ?? '—')

    setKV('osh-roots',       d.roots)
    setKV('osh-parents',     d.parents)
    setKV('osh-child',       d.child)
    setKV('osh-reality',     d.reality)
    setKV('osh-experience',  d.experience)
    setKV('osh-perspective', d.perspective)
    setKV('osh-dim-time',    d.dimTime)
    setKV('osh-dim-space',   d.dimSpace)
    setKV('osh-dim-object',  d.dimObject)
  }

  /** Q3 — just the toggleable tree for whatever node is currently
   *  selected, discovered from its own real Jsonifier tree, not a
   *  separate copy of one. Reuses the owning instance's own real
   *  _renderNode()/_bindTreeClicks() directly, so toggling here
   *  behaves identically to toggling in that instance's own panel. */
  _updateJsonTree (nodeId) {
    const container = this._el?.querySelector('#osh-json-tree')
    if (!container) return

    const owner = nodeId ? findOwnerOf(nodeId) : null
    if (!owner) {
      container.innerHTML = `<div class="osh-json-empty">Select a node that's part of a JSON structure to browse its tree here.</div>`
      return
    }

    const { jsonifier, node } = owner
    container.innerHTML = jsonifier._renderNode(node)
    jsonifier._bindTreeClicks(container)
  }

  setOmniPocket (omniPocket) {
    this.omniPocket = omniPocket
    this._renderPocketList()
  }

  setOmniNode (omniNode) {
    this.omniNode = omniNode
    this._renderMinimap()
  }

  setOmniRealityGridSelector (selector) {
    this.omniRealityGridSelector = selector
    this._renderMinimap()
  }

  /** Q2 — real, live pocket manager. Renders every real, currently-
   *  pocketed item, draggable to reorder (a real, separate, locally-
   *  persisted order, since OmniPocket itself has no reorder concept
   *  of its own), with TakeOutOfPocket and a type-aware preview per
   *  item. */
  _renderPocketList () {
    const list = this._el?.querySelector('#osh-pocket-list')
    if (!list || !this.omniPocket) return

    const entries = this.omniPocket.getExtracted()
    const order = this._loadPocketOrder()
    entries.sort((a, b) => {
      const ai = order.indexOf(a.id), bi = order.indexOf(b.id)
      if (ai === -1 && bi === -1) return 0
      if (ai === -1) return 1
      if (bi === -1) return -1
      return ai - bi
    })

    if (entries.length === 0) {
      list.innerHTML = `<div class="osh-json-empty">Nothing pocketed yet. Use PocketThis⟐ from a node's quick menu.</div>`
      this._el.querySelector('#osh-pocket-header').textContent = 'Pocket'
      return
    }

    list.innerHTML = entries.map(e => `
      <div class="osh-pocket-item" draggable="true" data-id="${e.id}">
        <span class="osh-pocket-item-label">${e.node.label ?? e.id}</span>
        <button class="osh-pocket-btn" data-action="preview" data-id="${e.id}">👁</button>
        <button class="osh-pocket-btn" data-action="take-out" data-id="${e.id}">Take Out</button>
      </div>
    `).join('')

    list.querySelectorAll('.osh-pocket-item').forEach(row => {
      row.addEventListener('mouseenter', () => {
        const entry = entries.find(e => e.id === row.dataset.id)
        this._el.querySelector('#osh-pocket-header').textContent = entry?.node.label ?? row.dataset.id
      })
      row.addEventListener('dragstart', () => row.classList.add('dragging'))
      row.addEventListener('dragend', () => { row.classList.remove('dragging'); this._savePocketOrderFromDom() })
      row.addEventListener('dragover', (e) => {
        e.preventDefault()
        const dragging = list.querySelector('.dragging')
        if (!dragging || dragging === row) return
        const rect = row.getBoundingClientRect()
        const after = (e.clientY - rect.top) > rect.height / 2
        row.parentNode.insertBefore(dragging, after ? row.nextSibling : row)
      })
    })

    list.querySelectorAll('[data-action="take-out"]').forEach(btn => {
      btn.addEventListener('click', () => this.omniPocket.reinstateNode(btn.dataset.id))
    })
    list.querySelectorAll('[data-action="preview"]').forEach(btn => {
      btn.addEventListener('click', () => this._togglePocketPreview(btn, entries.find(e => e.id === btn.dataset.id)))
    })
  }

  /** Real, type-aware preview — a JSON tree via the real, existing
   *  Jsonifier registry when this node genuinely belongs to one, the
   *  node's own real data otherwise, or its full real string for a
   *  dynamic-data node. */
  _togglePocketPreview (btn, entry) {
    const row = btn.closest('.osh-pocket-item')
    const existing = row.nextElementSibling?.classList?.contains('osh-pocket-preview') ? row.nextElementSibling : null
    if (existing) { existing.remove(); return }

    const el = document.createElement('div')
    el.className = 'osh-pocket-preview'

    const owner = findOwnerOf(entry.id)
    if (owner) {
      el.innerHTML = owner.jsonifier._renderNode(owner.node)
    } else if (entry.node.dynamicString !== undefined) {
      el.textContent = entry.node.dynamicString
    } else {
      el.textContent = JSON.stringify(entry.node, null, 2)
    }
    row.insertAdjacentElement('afterend', el)
  }

  _loadPocketOrder () {
    try { return JSON.parse(localStorage.getItem('omni:starthud:pocket-order') ?? '[]') } catch (_) { return [] }
  }

  _savePocketOrderFromDom () {
    const ids = [...this._el.querySelectorAll('.osh-pocket-item')].map(el => el.dataset.id)
    try { localStorage.setItem('omni:starthud:pocket-order', JSON.stringify(ids)) } catch (_) { /* real save simply skipped if storage unavailable */ }
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
        opacity: 1, scale: 1, duration: 0.3, ease: 'back.out(1.6)', stagger: 0.05,
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

      <div class="osh-quadrant osh-quadrant--tl" data-quadrant="tl">
        <button class="osh-maximize-btn" data-quadrant="tl">⛶</button>
        <div class="osh-panel osh-panel--data" data-panel="CUIQ01">
          <div class="osh-data-grid" id="osh-data-grid">
            <!-- populated by _updateDataGrid() from omni:globalbar-data -->
          </div>
        </div>
      </div>
      <div class="osh-quadrant osh-quadrant--tr" data-quadrant="tr">
        <button class="osh-maximize-btn" data-quadrant="tr">⛶</button>
        <div class="osh-panel osh-panel--data" data-panel="CUIQ02">
          <div class="osh-pocket-header" id="osh-pocket-header">Pocket</div>
          <div class="osh-pocket-list" id="osh-pocket-list"></div>
        </div>
      </div>
      <div class="osh-quadrant osh-quadrant--bl" data-quadrant="bl">
        <button class="osh-maximize-btn" data-quadrant="bl">⛶</button>
        <div class="osh-panel osh-panel--data" data-panel="CUIQ03">
          <div class="osh-json-tree" id="osh-json-tree">
            <!-- populated by _updateJsonTree() whenever a Jsonifier-owned node is selected -->
          </div>
        </div>
      </div>
      <div class="osh-quadrant osh-quadrant--br" data-quadrant="br">
        <button class="osh-maximize-btn" data-quadrant="br">⛶</button>
        <div class="osh-panel osh-panel--minimap" data-panel="CUIQ04">
          <div class="osh-minimap-header" id="osh-minimap-header">⟐ Reality Map</div>
          <canvas class="osh-minimap-canvas" id="osh-minimap-canvas"></canvas>
        </div>
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
