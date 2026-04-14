/**
 * ui/RadialMenu.js — ⟐mniReality Radial Tool Menu
 *
 * Manages four corner-anchored radial menus — one per Hand ⬢ button.
 * Each menu is a three-layer circular structure that opens diagonally
 * toward the screen centre, anchored in its corner quadrant.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Three-layer structure
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *                  [ tool ]  [ tool ]  [ tool ]       ← OUTER RING
 *               [ tool ]                   [ tool ]      10 slots @ 36° each
 *             [ tool ]    [ ⟐1 ][ ⟐3 ]    [ tool ]    ← INNER RING
 *           [ tool ]   [⟐2] [  ⟐H  ] [·]  [ tool ]      3 page selectors
 *             [ tool ]    [    ⟐1  ]    [ tool ]       ← CENTER
 *               [ tool ]                   [ tool ]      spinning disc + abbr
 *                  [ tool ]  [ tool ]  [ tool ]
 *
 * CENTER     →  Spinning ring overlay on static disc — shows hand abbr (⟐H, CH, LH, RH)
 * INNER RING →  3 page selectors at 120° intervals: ⟐1 (active), ⟐2, ⟐3 (unavailable)
 * OUTER RING →  10 tool slots at 36° intervals — content updates per active page
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Geometry (all radii in px, measured from menu centre)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   CENTER_R  =  28    centre disc radius
 *   SPIN_R    =  36    spinning dashed ring radius (orbits the disc)
 *   INNER_R   =  76    radius to centre of page selector buttons
 *   PAGE_R    =  20    page button radius
 *   OUTER_R   = 148    radius to centre of tool slots
 *   TOOL_R    =  22    tool slot radius
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Corner → Direction mapping (from PROJECT_STRUCTURE.md)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   ⟐mniHand  TL  →  center-right   radial centre at (MARGIN, BAR_H + MARGIN)
 *   ⟐CH       TR  →  center-left    radial centre at (vw - MARGIN, BAR_H + MARGIN)
 *   ⟐LH       BL  →  center-right   radial centre at (MARGIN, vh - DOCK_H - MARGIN)
 *   ⟐RH       BR  →  center-left    radial centre at (vw - MARGIN, vh - DOCK_H - MARGIN)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Pages
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   ⟐1  →  ACTIVE — 10 tools populated from hands.tools.json (embedded)
 *   ⟐2  →  UNAVAILABLE — renders locked, click gives pulse feedback only
 *   ⟐3  →  UNAVAILABLE — same as ⟐2
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Events consumed (window)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   omni:radial-toggle  →  { hand, abbr, corner, radialDir, visible }
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Events dispatched (window)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   omni:tool-select   →  { hand, tool, toolIndex, page }
 *   omni:tool-deselect →  { hand, tool, page }
 *   omni:page-select   →  { hand, page }  (only for ⟐1 — ⟐2/⟐3 are locked)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Public API
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   menu.init()
 *   menu.destroy()
 *   menu.toggle(handId, visible)
 *   menu.setVisible(handId, visible)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ui/index.js integration
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   import RadialMenu from './RadialMenu.js'
 *
 *   // in constructor:
 *   this.radialMenu = null
 *
 *   // in init(), after hands:
 *   this.radialMenu = new RadialMenu(this._ctx)
 *   this.radialMenu.init()
 *
 *   // in destroy():
 *   this.radialMenu?.destroy()
 *
 *   // replace radial-toggle stub in _bridgeEvents():
 *   window.addEventListener('omni:radial-toggle', (e) => {
 *     const { hand, visible } = e.detail ?? {}
 *     if (hand !== undefined) this.radialMenu?.toggle(hand, visible)
 *   })
 */

import gsap from 'gsap'

// ─────────────────────────────────────────────────────────────────────────────
// Geometry constants
// ─────────────────────────────────────────────────────────────────────────────

const CENTER_R    = 28     // centre disc radius
const SPIN_R      = 36     // orbiting dashed ring radius
const INNER_R     = 76     // inner ring: distance to page button centres
const PAGE_R      = 20     // page button radius
const OUTER_R     = 148    // outer ring: distance to tool slot centres
const TOOL_R      = 22     // tool slot radius
const CONTAINER   = 420    // square container px — must exceed 2*(OUTER_R + TOOL_R)
const HALF        = CONTAINER / 2   // 210

// Distance from viewport corner to radial centre — keeps all tools on-screen
// for every corner. Derived: MARGIN > OUTER_R + TOOL_R = 170px.
const MARGIN      = 182

// ─────────────────────────────────────────────────────────────────────────────
// Layout constants — keep in sync with Hand.js
// ─────────────────────────────────────────────────────────────────────────────

const BAR_H  = 36    // GlobalBar collapsed height
const DOCK_H = 52    // Dock height

// ─────────────────────────────────────────────────────────────────────────────
// Angle distributions
// ─────────────────────────────────────────────────────────────────────────────

// Page selectors — 3 equidistant positions, ⟐1 at top (−90°)
const PAGE_ANGLES = [-90, 30, 150]

// Tool slots — 10 equidistant positions, slot 1 at top (−90°), clockwise
const TOOL_ANGLES = Array.from({ length: 10 }, (_, i) => -90 + i * 36)

// ─────────────────────────────────────────────────────────────────────────────
// Tool data — embedded from hands.tools.json
// ─────────────────────────────────────────────────────────────────────────────

const TOOLS = {
  omnihand: {
    abbr : '⟐H',
    color: 'rgba(255, 255, 255, 0.90)',  // white — omni system
    '⟐1' : ['OmniTime','OmniIdentity','OmniMemory','OmniMap','OmniFlow',
             'OmniTask','OmniRitual','OmniLaw','OmniArchive','OmniActualize'],
    '⟐2' : null,
    '⟐3' : null,
  },
  conscious: {
    abbr : 'CH',
    color: 'rgba(180, 210, 255, 0.90)', // cool blue — perspective / visor
    '⟐1' : ['SpatialVisor','ThermalVisor','EnergeticVisor','StructuralVisor','SemanticVisor',
             'IdentityVisor','TemporalVisor','RelationalVisor','MythicVisor','OmniPerspective'],
    '⟐2' : null,
    '⟐3' : null,
  },
  lh: {
    abbr : 'LH',
    color: 'rgba(200, 255, 220, 0.90)', // cool green — analytical / spatial
    '⟐1' : ['Translate3D','Rotate3D','Scale3D','OrbitControl','PathfindingStep',
             'SnapToGrid','PhysicsImpulse','CollisionCheck','AnchorPointSet','StateToggle'],
    '⟐2' : null,
    '⟐3' : null,
  },
  rh: {
    abbr : 'RH',
    color: 'rgba(255, 200, 240, 0.90)', // warm rose — creative / expressive
    '⟐1' : ['ColorShift','MaterialMorph','ShapeBlend','ParticleEmote','AuraField',
             'SymbolStamp','GestureTrail','SoundResonance','TextureWeave','MoodLighting'],
    '⟐2' : null,
    '⟐3' : null,
  },
}

// Hand corner lookup (mirrors Hand.js config)
const HAND_CORNER = {
  omnihand : 'tl',
  conscious: 'tr',
  lh       : 'bl',
  rh       : 'br',
}

const PAGES = ['⟐1', '⟐2', '⟐3']

// ─────────────────────────────────────────────────────────────────────────────
// Geometry helpers
// ─────────────────────────────────────────────────────────────────────────────

const toRad = deg => deg * Math.PI / 180

/** Polar → Cartesian (from origin). Returns { x, y } in px. */
const polar = (angleDeg, r) => ({
  x: Math.cos(toRad(angleDeg)) * r,
  y: Math.sin(toRad(angleDeg)) * r,
})

/**
 * CSS transform string to place an element at (x, y) relative to
 * a parent whose centre is at 50%/50% (all radial items use this).
 */
const placeAt = (x, y) =>
  `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`

/**
 * Split a camelCase tool name into two display lines.
 * "ColorShift" → { a: "Color", b: "Shift" }
 * "Translate3D" → { a: "Translat", b: "3D" }
 */
function splitName (name) {
  // Preserve numeric suffixes like "3D", "2D" as tokens
  const spaced = name
    .replace(/([0-9]+[A-Za-z]*)/g, ' $1 ')
    .replace(/([A-Z][a-z]+)/g, ' $1')
    .trim()
  const parts = spaced.split(/\s+/).filter(Boolean)

  if (parts.length === 0) return { a: name.slice(0, 7), b: '' }
  if (parts.length === 1) return { a: parts[0].slice(0, 7), b: '' }

  return {
    a: parts[0].slice(0, 7),
    b: parts.slice(1).join('').slice(0, 6),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SVG namespace helper
// ─────────────────────────────────────────────────────────────────────────────

const SVG_NS = 'http://www.w3.org/2000/svg'
const svgEl = (tag, attrs = {}) => {
  const el = document.createElementNS(SVG_NS, tag)
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v))
  return el
}

// ─────────────────────────────────────────────────────────────────────────────
// Stylesheet
// ─────────────────────────────────────────────────────────────────────────────

const STYLES = /* css */`

/* ── Root container ─────────────────────────────────────────────────────────── */

.omni-radial {
  --r-bg          : rgba(6, 6, 10, 0.82);
  --r-border      : rgba(255, 255, 255, 0.09);
  --r-ring        : rgba(255, 255, 255, 0.10);
  --r-ring-inner  : rgba(255, 255, 255, 0.07);
  --r-spoke       : rgba(255, 255, 255, 0.06);
  --r-text        : rgba(255, 255, 255, 0.82);
  --r-text-dim    : rgba(255, 255, 255, 0.32);
  --r-accent      : rgba(255, 255, 255, 0.96);
  --r-glow        : 0 0 10px rgba(255, 255, 255, 0.24);
  --r-glow-strong : 0 0 16px rgba(255, 255, 255, 0.48);
  --r-locked      : rgba(255, 255, 255, 0.18);
  --mono          : 'Courier New', Courier, monospace;

  position        : fixed;
  width           : ${CONTAINER}px;
  height          : ${CONTAINER}px;
  z-index         : 55;
  pointer-events  : none;
  opacity         : 0;
  user-select     : none;

  -webkit-font-smoothing: antialiased;
}

/* ── SVG ring layer (decorative — no pointer events) ─────────────────────────── */

.radial-svg {
  position        : absolute;
  inset           : 0;
  width           : 100%;
  height          : 100%;
  pointer-events  : none;
  overflow        : visible;
}

.svg-ring {
  fill            : none;
  stroke-linecap  : round;
}

.svg-ring--outer {
  stroke          : var(--r-ring);
  stroke-width    : 1;
}

.svg-ring--inner {
  stroke          : var(--r-ring-inner);
  stroke-width    : 1;
}

.svg-ring--center {
  stroke          : rgba(255, 255, 255, 0.14);
  stroke-width    : 1;
}

.svg-spoke {
  stroke          : var(--r-spoke);
  stroke-width    : 0.6;
  stroke-linecap  : round;
}

.svg-spoke--inner {
  stroke          : rgba(255, 255, 255, 0.08);
  stroke-width    : 0.5;
  stroke-dasharray: 2 3;
}

.svg-tick {
  stroke          : rgba(255, 255, 255, 0.12);
  stroke-width    : 1;
  stroke-linecap  : round;
}

/* ── Interactive element base (centre, page buttons, tool slots) ─────────────── */

.radial-item {
  position        : absolute;
  left            : 50%;
  top             : 50%;
  border-radius   : 50%;
  display         : flex;
  flex-direction  : column;
  align-items     : center;
  justify-content : center;
  pointer-events  : auto;
  cursor          : pointer;
  font-family     : var(--mono);
  -webkit-tap-highlight-color: transparent;
  touch-action    : manipulation;
  outline         : none;
  transition      : background 0.14s ease, border-color 0.14s ease;
}

/* ── Centre disc ────────────────────────────────────────────────────────────── */

.radial-center {
  width           : ${CENTER_R * 2}px;
  height          : ${CENTER_R * 2}px;
  background      : rgba(12, 12, 18, 0.96);
  border          : 1px solid rgba(255, 255, 255, 0.18);
  cursor          : default;
  pointer-events  : none;   /* centre is display only */
  z-index         : 3;
}

.radial-center-abbr {
  font-size       : 10px;
  font-weight     : 600;
  letter-spacing  : 0.08em;
  color           : var(--r-accent);
  text-shadow     : var(--r-glow-strong);
  pointer-events  : none;
  line-height     : 1;
  position        : relative;
  z-index         : 2;
}

/* Spinning dashed ring that orbits the centre disc */
.radial-spin-ring {
  position        : absolute;
  left            : 50%;
  top             : 50%;
  width           : ${SPIN_R * 2}px;
  height          : ${SPIN_R * 2}px;
  transform       : translate(-50%, -50%);
  border-radius   : 50%;
  border          : 1px dashed rgba(255, 255, 255, 0.22);
  pointer-events  : none;
  z-index         : 2;
  transform-origin: 50% 50%;
}

/* ── Page selector buttons (inner ring) ─────────────────────────────────────── */

.radial-page {
  width           : ${PAGE_R * 2}px;
  height          : ${PAGE_R * 2}px;
  background      : rgba(255, 255, 255, 0.05);
  border          : 1px solid rgba(255, 255, 255, 0.12);
  z-index         : 2;
  gap             : 1px;
}

.radial-page:hover {
  background      : rgba(255, 255, 255, 0.12);
  border-color    : rgba(255, 255, 255, 0.28);
}

.radial-page.is-active {
  background      : rgba(255, 255, 255, 0.14);
  border-color    : rgba(255, 255, 255, 0.55);
  box-shadow      : var(--r-glow);
}

.radial-page.is-active .page-label {
  color           : var(--r-accent);
  text-shadow     : var(--r-glow);
}

.radial-page.is-locked {
  opacity         : 0.35;
  cursor          : default;
  border-style    : dashed;
  border-color    : rgba(255, 255, 255, 0.10);
}

.radial-page.is-locked:hover {
  background      : rgba(255, 255, 255, 0.05);
  border-color    : rgba(255, 255, 255, 0.10);
}

.page-label {
  font-size       : 7px;
  letter-spacing  : 0.06em;
  color           : var(--r-text-dim);
  line-height     : 1;
  pointer-events  : none;
}

.page-num {
  font-size       : 6px;
  color           : var(--r-text-dim);
  letter-spacing  : 0.04em;
  pointer-events  : none;
  opacity         : 0.7;
}

/* ── Tool slot buttons (outer ring) ─────────────────────────────────────────── */

.radial-tool {
  width           : ${TOOL_R * 2}px;
  height          : ${TOOL_R * 2}px;
  background      : rgba(255, 255, 255, 0.04);
  border          : 1px solid rgba(255, 255, 255, 0.09);
  z-index         : 2;
  gap             : 1px;
  overflow        : hidden;
}

.radial-tool:hover {
  background      : rgba(255, 255, 255, 0.11);
  border-color    : rgba(255, 255, 255, 0.26);
}

.radial-tool:hover .tool-name-a {
  color           : var(--r-accent);
}

.radial-tool.is-active {
  background      : rgba(255, 255, 255, 0.18);
  border-color    : rgba(255, 255, 255, 0.60);
  box-shadow      : var(--r-glow);
}

.radial-tool.is-active .tool-name-a,
.radial-tool.is-active .tool-name-b {
  color           : var(--r-accent);
}

.tool-index {
  position        : absolute;
  top             : 3px;
  font-size       : 5px;
  color           : rgba(255, 255, 255, 0.20);
  pointer-events  : none;
  letter-spacing  : 0.04em;
  line-height     : 1;
}

.tool-name-a {
  font-size       : 5.5px;
  color           : var(--r-text);
  letter-spacing  : 0.04em;
  pointer-events  : none;
  line-height     : 1.1;
  text-align      : center;
  transition      : color 0.12s ease;
  max-width       : ${TOOL_R * 2 - 4}px;
  overflow        : hidden;
  white-space     : nowrap;
  text-overflow   : ellipsis;
}

.tool-name-b {
  font-size       : 5px;
  color           : var(--r-text-dim);
  letter-spacing  : 0.03em;
  pointer-events  : none;
  line-height     : 1.1;
  text-align      : center;
  transition      : color 0.12s ease;
  max-width       : ${TOOL_R * 2 - 4}px;
  overflow        : hidden;
  white-space     : nowrap;
}

/* ── Tooltip ────────────────────────────────────────────────────────────────── */

.radial-tooltip {
  position        : fixed;
  background      : rgba(8, 8, 12, 0.94);
  border          : 1px solid rgba(255, 255, 255, 0.12);
  color           : rgba(255, 255, 255, 0.90);
  font-family     : var(--mono);
  font-size       : 9px;
  padding         : 4px 9px;
  border-radius   : 5px;
  pointer-events  : none;
  z-index         : 80;
  letter-spacing  : 0.06em;
  backdrop-filter : blur(10px);
  white-space     : nowrap;
  opacity         : 0;
  transition      : opacity 0.14s ease;
}

.radial-tooltip.is-visible {
  opacity         : 1;
}

/* ── Locked page flash ──────────────────────────────────────────────────────── */

@keyframes radial-locked-flash {
  0%   { border-color: rgba(255,255,255,0.10); }
  40%  { border-color: rgba(255,255,255,0.42); }
  100% { border-color: rgba(255,255,255,0.10); }
}

.radial-page.locked-flash {
  animation: radial-locked-flash 0.35s ease forwards;
}

`

function injectStyles () {
  if (document.getElementById('omni-radial-styles')) return
  const tag = document.createElement('style')
  tag.id          = 'omni-radial-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

// ─────────────────────────────────────────────────────────────────────────────
// RadialMenu class
// ─────────────────────────────────────────────────────────────────────────────

export default class RadialMenu {

  /**
   * @param {object} context  — { scene, camera, renderer, sizes, ticker, Sound }
   */
  constructor (context) {
    this.ctx = context

    // ── DOM refs ──────────────────────────────────────────────────────────
    this._els        = {}  // handId → container element
    this._svgRefs    = {}  // handId → { outerCirc, innerCirc, centerCirc }
    this._spinEl     = {}  // handId → spinning ring element
    this._pageEls    = {}  // handId → [p1, p2, p3] button elements
    this._toolEls    = {}  // handId → [t0 … t9] button elements
    this._tooltip    = null

    // ── GSAP tweens ───────────────────────────────────────────────────────
    this._spinTweens = {}  // handId → GSAP tween (continuous rotation)

    // ── State ─────────────────────────────────────────────────────────────
    this._state = {
      omnihand : { visible: false, page: '⟐1', activeTool: null },
      conscious: { visible: false, page: '⟐1', activeTool: null },
      lh       : { visible: false, page: '⟐1', activeTool: null },
      rh       : { visible: false, page: '⟐1', activeTool: null },
    }

    // ── Resize handler ────────────────────────────────────────────────────
    this._onResize  = this._handleResize.bind(this)
    this._onToggle  = this._handleToggle.bind(this)
  }

  // ── Module contract ──────────────────────────────────────────────────────

  init () {
    injectStyles()
    this._buildTooltip()
    this._buildAllMenus()
    this._bindGlobalEvents()
    console.log('⟐ RadialMenu: initialized — 4 menus mounted.')
  }

  destroy () {
    Object.values(this._spinTweens).forEach(t => t?.kill())
    Object.values(this._els).forEach(el => el?.parentNode?.removeChild(el))
    this._tooltip?.parentNode?.removeChild(this._tooltip)

    window.removeEventListener('omni:radial-toggle', this._onToggle)
    window.removeEventListener('resize', this._onResize)
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Show or hide a specific hand's radial.
   * @param {string}  handId  — 'omnihand' | 'conscious' | 'lh' | 'rh'
   * @param {boolean} visible
   */
  toggle (handId, visible) {
    if (!this._els[handId]) return
    const st = this._state[handId]
    if (st.visible === visible) return
    st.visible = visible
    visible ? this._show(handId) : this._hide(handId)
  }

  setVisible (handId, visible) {
    this.toggle(handId, visible)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Build — all four menus
  // ─────────────────────────────────────────────────────────────────────────

  _buildAllMenus () {
    const shell = document.getElementById('omni-ui') ?? document.body
    Object.keys(TOOLS).forEach(handId => {
      const el = this._buildMenu(handId)
      this._els[handId] = el
      shell.appendChild(el)
      this._positionMenu(handId)
    })
  }

  _buildMenu (handId) {
    const corner = HAND_CORNER[handId]

    const container = document.createElement('div')
    container.id        = `omni-radial-${handId}`
    container.className = `omni-radial omni-radial--${corner}`
    container.setAttribute('aria-label', `${TOOLS[handId].abbr} tool menu`)
    container.setAttribute('role', 'dialog')

    // Layer 1 — SVG decorative rings
    container.appendChild(this._buildSVG(handId))

    // Layer 2 — Spinning ring (orbit around centre)
    const spinRing = document.createElement('div')
    spinRing.className = 'radial-spin-ring'
    container.appendChild(spinRing)
    this._spinEl[handId] = spinRing

    // Layer 3 — Centre disc (static)
    container.appendChild(this._buildCenter(handId))

    // Layer 4 — Inner ring page selectors
    this._buildInnerRing(handId, container)

    // Layer 5 — Outer ring tool slots
    this._buildOuterRing(handId, container)

    return container
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SVG decorative layer
  // ─────────────────────────────────────────────────────────────────────────

  _buildSVG (handId) {
    const svg = svgEl('svg', {
      viewBox : `${-HALF} ${-HALF} ${CONTAINER} ${CONTAINER}`,
      width   : CONTAINER,
      height  : CONTAINER,
      class   : 'radial-svg',
    })

    // ── Decorative concentric ring circles ───────────────────────────────
    const outerCirc = svgEl('circle', { r: OUTER_R, cx: 0, cy: 0, class: 'svg-ring svg-ring--outer' })
    const innerCirc = svgEl('circle', { r: INNER_R, cx: 0, cy: 0, class: 'svg-ring svg-ring--inner' })
    const centCirc  = svgEl('circle', { r: SPIN_R + 2, cx: 0, cy: 0, class: 'svg-ring svg-ring--center' })

    // Set up stroke-dasharray for draw-in animation
    const outerC = 2 * Math.PI * OUTER_R   // ~930
    const innerC = 2 * Math.PI * INNER_R   // ~478
    const centC  = 2 * Math.PI * (SPIN_R + 2) // ~239

    outerCirc.style.cssText = `stroke-dasharray:${outerC};stroke-dashoffset:${outerC}`
    innerCirc.style.cssText = `stroke-dasharray:${innerC};stroke-dashoffset:${innerC}`
    centCirc.style.cssText  = `stroke-dasharray:${centC};stroke-dashoffset:${centC}`

    svg.appendChild(outerCirc)
    svg.appendChild(innerCirc)
    svg.appendChild(centCirc)

    // ── Radial spokes: inner ring → outer ring (at each of 10 tool angles) ──
    TOOL_ANGLES.forEach(angleDeg => {
      const p1 = polar(angleDeg, INNER_R)
      const p2 = polar(angleDeg, OUTER_R)
      svg.appendChild(svgEl('line', {
        x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y,
        class: 'svg-spoke',
      }))
    })

    // ── Dashed spokes: centre ring → inner ring (at each of 3 page angles) ─
    PAGE_ANGLES.forEach(angleDeg => {
      const p1 = polar(angleDeg, SPIN_R + 3)
      const p2 = polar(angleDeg, INNER_R - PAGE_R - 2)
      svg.appendChild(svgEl('line', {
        x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y,
        class: 'svg-spoke svg-spoke--inner',
      }))
    })

    // ── Outer ring tick marks (between each tool slot) ────────────────────
    const TICK_HALF   = 3   // half-length of tick mark in px
    TOOL_ANGLES.forEach(angleDeg => {
      // Tick is perpendicular to the radial direction, ON the outer ring circle
      const cos = Math.cos(toRad(angleDeg))
      const sin = Math.sin(toRad(angleDeg))
      const perp = { x: -sin, y: cos }  // tangent direction
      const centre = polar(angleDeg, OUTER_R)
      svg.appendChild(svgEl('line', {
        x1: centre.x + perp.x * TICK_HALF,
        y1: centre.y + perp.y * TICK_HALF,
        x2: centre.x - perp.x * TICK_HALF,
        y2: centre.y - perp.y * TICK_HALF,
        class: 'svg-tick',
      }))
    })

    this._svgRefs[handId] = { outerCirc, innerCirc, centCirc }
    return svg
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Centre disc
  // ─────────────────────────────────────────────────────────────────────────

  _buildCenter (handId) {
    const disc = document.createElement('div')
    disc.className = 'radial-item radial-center'
    disc.style.transform = placeAt(0, 0)

    const abbr = document.createElement('span')
    abbr.className   = 'radial-center-abbr'
    abbr.textContent = TOOLS[handId].abbr

    disc.appendChild(abbr)
    return disc
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Inner ring — page selectors
  // ─────────────────────────────────────────────────────────────────────────

  _buildInnerRing (handId, container) {
    this._pageEls[handId] = []

    PAGES.forEach((page, i) => {
      const angleDeg = PAGE_ANGLES[i]
      const { x, y } = polar(angleDeg, INNER_R)

      const available = (page === '⟐1')   // ⟐2 and ⟐3 unavailable per spec

      const btn = document.createElement('div')
      btn.className = [
        'radial-item',
        'radial-page',
        available ? '' : 'is-locked',
        (page === '⟐1') ? 'is-active' : '',
      ].filter(Boolean).join(' ')

      btn.dataset.page = page
      btn.dataset.hand = handId
      btn.style.transform = placeAt(x, y)
      btn.tabIndex = available ? 0 : -1
      btn.setAttribute('role', 'button')
      btn.setAttribute('aria-label', available ? `Page ${page}` : `Page ${page} — unavailable`)

      // Page label (⟐1 / ⟐2 / ⟐3)
      const lbl = document.createElement('span')
      lbl.className   = 'page-label'
      lbl.textContent = page
      btn.appendChild(lbl)

      // Lock indicator for unavailable pages
      if (!available) {
        const lock = document.createElement('span')
        lock.className   = 'page-num'
        lock.textContent = '—'
        btn.appendChild(lock)
      }

      btn.addEventListener('click', () => this._handlePageClick(handId, page, btn, available))

      container.appendChild(btn)
      this._pageEls[handId].push(btn)
    })
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Outer ring — tool slots
  // ─────────────────────────────────────────────────────────────────────────

  _buildOuterRing (handId, container) {
    this._toolEls[handId] = []

    const tools = TOOLS[handId]['⟐1']   // always start on ⟐1
    const accentColor = TOOLS[handId].color

    TOOL_ANGLES.forEach((angleDeg, i) => {
      const { x, y } = polar(angleDeg, OUTER_R)
      const toolName = tools[i] ?? '—'
      const { a, b } = splitName(toolName)

      const slot = document.createElement('div')
      slot.className = 'radial-item radial-tool'
      slot.style.transform = placeAt(x, y)
      slot.dataset.toolIndex = i
      slot.dataset.tool      = toolName
      slot.dataset.hand      = handId
      slot.tabIndex = 0
      slot.setAttribute('role', 'button')
      slot.setAttribute('aria-label', toolName)

      // Slot number (tiny index)
      const idx = document.createElement('span')
      idx.className   = 'tool-index'
      idx.textContent = i + 1
      slot.appendChild(idx)

      // Primary name line
      const nameA = document.createElement('span')
      nameA.className   = 'tool-name-a'
      nameA.textContent = a
      slot.appendChild(nameA)

      // Secondary name line
      if (b) {
        const nameB = document.createElement('span')
        nameB.className   = 'tool-name-b'
        nameB.textContent = b
        slot.appendChild(nameB)
      }

      // Hover → tooltip
      slot.addEventListener('mouseenter', (e) => this._showTooltip(toolName, e))
      slot.addEventListener('mouseleave', ()  => this._hideTooltip())
      slot.addEventListener('mousemove',  (e) => this._moveTooltip(e))

      // Click → select / deselect tool
      slot.addEventListener('click', () => this._handleToolClick(handId, toolName, i, slot))
      slot.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); slot.click() }
      })

      // Active state tint per hand
      slot.style.setProperty('--tool-accent', accentColor)

      container.appendChild(slot)
      this._toolEls[handId].push(slot)
    })
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Tooltip (shared, single instance)
  // ─────────────────────────────────────────────────────────────────────────

  _buildTooltip () {
    const tt = document.createElement('div')
    tt.className = 'radial-tooltip'
    document.body.appendChild(tt)
    this._tooltip = tt
  }

  _showTooltip (text, e) {
    if (!this._tooltip) return
    this._tooltip.textContent = text
    this._moveTooltip(e)
    this._tooltip.classList.add('is-visible')
  }

  _hideTooltip () {
    this._tooltip?.classList.remove('is-visible')
  }

  _moveTooltip (e) {
    if (!this._tooltip) return
    const OFFSET = 14
    this._tooltip.style.left = `${e.clientX + OFFSET}px`
    this._tooltip.style.top  = `${e.clientY - OFFSET}px`
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Click handlers
  // ─────────────────────────────────────────────────────────────────────────

  _handlePageClick (handId, page, btn, available) {
    if (!available) {
      // Locked — brief flash feedback, no action
      btn.classList.remove('locked-flash')
      // Force reflow to restart animation
      void btn.offsetWidth
      btn.classList.add('locked-flash')
      this._playSound('click')
      return
    }

    const st = this._state[handId]
    if (st.page === page) return   // already on this page

    st.page        = page
    st.activeTool  = null

    this._playSound('click')
    this._updatePageActiveState(handId)
    this._switchPage(handId, page)

    window.dispatchEvent(new CustomEvent('omni:page-select', {
      detail: { hand: handId, page },
    }))
  }

  _handleToolClick (handId, toolName, toolIndex, slot) {
    const st      = this._state[handId]
    const wasActive = st.activeTool === toolName

    // Deselect all tools for this hand
    this._toolEls[handId].forEach(el => el.classList.remove('is-active'))

    if (wasActive) {
      // Toggle off
      st.activeTool = null
      this._playSound('close')
      window.dispatchEvent(new CustomEvent('omni:tool-deselect', {
        detail: { hand: handId, tool: toolName, page: st.page },
      }))
    } else {
      // Select
      st.activeTool = toolName
      slot.classList.add('is-active')
      this._playSound('click')

      // Micro pulse
      gsap.fromTo(slot, { scale: 0.88 }, { scale: 1, duration: 0.20, ease: 'back.out(2.5)' })

      window.dispatchEvent(new CustomEvent('omni:tool-select', {
        detail: { hand: handId, tool: toolName, toolIndex: toolIndex + 1, page: st.page },
      }))
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Page switching — swap tool slot labels
  // ─────────────────────────────────────────────────────────────────────────

  _updatePageActiveState (handId) {
    const st   = this._state[handId]
    const els  = this._pageEls[handId]

    PAGES.forEach((page, i) => {
      if (els[i]) els[i].classList.toggle('is-active', page === st.page)
    })
  }

  _switchPage (handId, page) {
    const tools      = TOOLS[handId][page]  // null for ⟐2/⟐3 (never reaches here — locked)
    const toolEls    = this._toolEls[handId]
    const stagger    = 0.025

    // Animate out then in
    gsap.to(toolEls, {
      scale   : 0,
      opacity : 0,
      duration: 0.12,
      stagger,
      ease    : 'power2.in',
      onComplete: () => {
        // Update labels
        toolEls.forEach((slot, i) => {
          const name = tools?.[i] ?? '—'
          const { a, b } = splitName(name)

          slot.dataset.tool           = name
          slot.querySelector('.tool-name-a').textContent = a

          const bEl = slot.querySelector('.tool-name-b')
          if (bEl) bEl.textContent = b
          if (!bEl && b) {
            const nb = document.createElement('span')
            nb.className   = 'tool-name-b'
            nb.textContent = b
            slot.appendChild(nb)
          }

          slot.setAttribute('aria-label', name)
        })

        // Animate back in
        gsap.to(toolEls, {
          scale   : 1,
          opacity : 1,
          duration: 0.18,
          stagger,
          ease    : 'back.out(1.6)',
        })
      },
    })
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Positioning — viewport-relative, updated on resize
  // ─────────────────────────────────────────────────────────────────────────

  _computeCenter (corner) {
    const w = window.innerWidth
    const h = window.innerHeight
    // Adaptive margin — scales down on narrow screens
    const m = Math.max(120, Math.min(MARGIN, w * 0.13))

    switch (corner) {
      case 'tl': return { x: m,     y: BAR_H + m }
      case 'tr': return { x: w - m, y: BAR_H + m }
      case 'bl': return { x: m,     y: h - DOCK_H - m }
      case 'br': return { x: w - m, y: h - DOCK_H - m }
    }
  }

  _positionMenu (handId) {
    const el = this._els[handId]
    if (!el) return
    const corner = HAND_CORNER[handId]
    const { x, y } = this._computeCenter(corner)
    el.style.left = `${x - HALF}px`
    el.style.top  = `${y - HALF}px`
  }

  _handleResize () {
    Object.keys(this._els).forEach(id => this._positionMenu(id))
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Show / Hide Animation
  // ─────────────────────────────────────────────────────────────────────────

  _show (handId) {
    const el   = this._els[handId]
    if (!el) return

    // Re-position in case viewport changed
    this._positionMenu(handId)

    gsap.killTweensOf(el)
    el.style.pointerEvents = 'auto'

    const { outerCirc, innerCirc, centCirc } = this._svgRefs[handId]
    const outerC = 2 * Math.PI * OUTER_R
    const innerC = 2 * Math.PI * INNER_R
    const centC  = 2 * Math.PI * (SPIN_R + 2)

    // Reset ring dashoffsets before animating in
    gsap.set(outerCirc, { strokeDashoffset: outerC })
    gsap.set(innerCirc, { strokeDashoffset: innerC })
    gsap.set(centCirc,  { strokeDashoffset: centC  })

    const pageEls = this._pageEls[handId]
    const toolEls = this._toolEls[handId]

    // ── Phase 0: container fades in ────────────────────────────────────
    gsap.fromTo(el,
      { opacity: 0, scale: 0.70 },
      { opacity: 1, scale: 1, duration: 0.28, ease: 'back.out(1.6)' }
    )

    // ── Phase 1: rings draw in (staggered) ────────────────────────────
    gsap.to(centCirc,  { strokeDashoffset: 0, duration: 0.30, ease: 'power2.out', delay: 0.06 })
    gsap.to(innerCirc, { strokeDashoffset: 0, duration: 0.40, ease: 'power2.out', delay: 0.12 })
    gsap.to(outerCirc, { strokeDashoffset: 0, duration: 0.55, ease: 'power2.out', delay: 0.18 })

    // ── Phase 2: page buttons spring in ────────────────────────────────
    gsap.fromTo(pageEls,
      { scale: 0, opacity: 0 },
      { scale: 1, opacity: 1, duration: 0.22, ease: 'back.out(2)', stagger: 0.06, delay: 0.22 }
    )

    // ── Phase 3: tool slots cascade in (outer ring, staggered arc) ─────
    gsap.fromTo(toolEls,
      { scale: 0, opacity: 0 },
      { scale: 1, opacity: 1, duration: 0.18, ease: 'back.out(1.8)', stagger: 0.03, delay: 0.32 }
    )

    // ── Spin ring: start continuous rotation ───────────────────────────
    this._startSpin(handId)
  }

  _hide (handId) {
    const el = this._els[handId]
    if (!el) return

    this._hideTooltip()

    const pageEls = this._pageEls[handId]
    const toolEls = this._toolEls[handId]

    // ── Tools collapse first ───────────────────────────────────────────
    gsap.to(toolEls, {
      scale   : 0,
      opacity : 0,
      duration: 0.10,
      stagger : 0.02,
      ease    : 'power2.in',
    })

    // ── Pages collapse ─────────────────────────────────────────────────
    gsap.to(pageEls, {
      scale   : 0,
      opacity : 0,
      duration: 0.10,
      stagger : 0.04,
      ease    : 'power2.in',
      delay   : 0.05,
    })

    // ── Container scales out ───────────────────────────────────────────
    gsap.to(el, {
      opacity : 0,
      scale   : 0.78,
      duration: 0.18,
      ease    : 'power2.in',
      delay   : 0.10,
      onComplete: () => {
        el.style.pointerEvents = 'none'
        el.style.transform     = ''

        // Reset tool + page elements for next open
        gsap.set([...toolEls, ...pageEls], { scale: 1, opacity: 1, clearProps: 'transform,opacity,scale' })
      },
    })

    // ── Spin ring: pause ───────────────────────────────────────────────
    this._stopSpin(handId)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Spinning centre ring
  // ─────────────────────────────────────────────────────────────────────────

  _startSpin (handId) {
    const ring = this._spinEl[handId]
    if (!ring) return

    // Kill existing tween if any
    if (this._spinTweens[handId]) {
      this._spinTweens[handId].kill()
    }

    this._spinTweens[handId] = gsap.to(ring, {
      rotation       : 360,
      repeat         : -1,
      duration       : 7,
      ease           : 'none',
      transformOrigin: '50% 50%',
    })
  }

  _stopSpin (handId) {
    const tween = this._spinTweens[handId]
    if (!tween) return
    // Ease the spin to a natural stop
    gsap.to(this._spinEl[handId], {
      timeScale: 0,
      duration : 0.6,
      ease     : 'power2.out',
      onComplete: () => tween.pause(),
    })
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Global event binding
  // ─────────────────────────────────────────────────────────────────────────

  _bindGlobalEvents () {
    // omni:radial-toggle dispatched by Hand.js when ⬢ is clicked
    window.addEventListener('omni:radial-toggle', this._onToggle)
    window.addEventListener('resize', this._onResize)
  }

  _handleToggle (e) {
    const { hand, visible } = e.detail ?? {}
    if (hand !== undefined && visible !== undefined) {
      this.toggle(hand, visible)
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
