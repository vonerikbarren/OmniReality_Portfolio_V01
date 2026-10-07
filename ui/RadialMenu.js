/**
 * ui/RadialMenu.js — ⟐mniReality Radial Tool Menu
 *
 * Manages four corner-anchored radial menus — one per Hand ⬢ button.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Changes from prior version
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   Text visibility   — tool names bumped to 8px/7px with strong dark shadow
 *                       so they read on any background (white or black scene)
 *
 *   Toggle fix        — removed st.visible === visible early-return guard so
 *                       clicking ⬢ again always closes the menu correctly
 *
 *   Animation bug     — _show() kills ALL in-flight tweens (container + children)
 *                       and hard-resets child elements before animating in,
 *                       preventing _hide()'s onComplete from corrupting state
 *
 *   Rotation buttons  — two small ◄ ► buttons below the centre disc on every
 *                       menu. Each click rotates all tool slots ±36° (one slot)
 *                       with a smooth GSAP tween. Tools use GSAP x/y properties
 *                       so rotation tweens compose cleanly with show/hide tweens.
 *
 *   Positions         — bottom hands (bl/br) keep extraLift=250 and
 *                       extraShift=±200 from prior version unchanged.
 *                       Top hands are unmodified.
 */

import gsap from 'gsap'
import { getTopOffset } from '../utils/OmniLayout.js'
import { getHandSetting, CHANGE_EVENT as HANDS_CHANGE_EVENT } from '../utils/OmniHandsSettings.js'

// ── Geometry constants ────────────────────────────────────────────────────────

const CENTER_R  = 28
const SPIN_R    = 36
const INNER_R   = 76
const PAGE_R    = 20
const OUTER_R   = 148
const TOOL_R    = 22
const CONTAINER = 420
const HALF      = CONTAINER / 2   // 210

const MARGIN    = 150

const BAR_H  = 48   // GlobalBar COLLAPSED_H. V169: top-corner anchors use getTopOffset() (bar + ribbon) instead
const DOCK_H = 52

// ── Angle distributions ───────────────────────────────────────────────────────

const PAGE_ANGLES = [-90, 30, 150]
const TOOL_ANGLES = Array.from({ length: 10 }, (_, i) => -90 + i * 36)

// ── Tool data ─────────────────────────────────────────────────────────────────

// Page ⟐1 is REAL for the two lower hands only (V168; omnihand / conscious keep it null/blank, planned
// for the search + scan feature, docs/planning/BACKLOG.md). Page ⟐3 remains the planned OmniKeyboard
// launcher for all four (null, locked).
//   lh ⟐1  FLOWCHART ELEMENTS — the ammo KIND the LeftHand's centre Fire button shoots:
//          Terminator, Process, Decision, InputOutput, Connector, Loop (slots 1-6). Clicking one sets the
//          LH's current element kind (OmniHandsSettings `elementKind`, applied by systems/OmniFlowFire.js
//          from the omni:tool-select below); the highlight shows the current kind (default Process) and,
//          unlike the other pages, clicking the lit one again does NOT un-select it (a kind is always set).
//   rh ⟐1  #1 DataTypes (opens ui/OmniPayloadPanel.js), #2 Color, #3 Texture, #4 Material (the same panel,
//          focused on that section) — they edit the CURRENT payload, the RightHand's ammo. Select = open /
//          focus, select again = close.
// Both still dispatch omni:tool-select / omni:tool-deselect {hand, tool, toolIndex, page} like every tool.
// Page switching: omni:page-select {hand, page}; a LOCKED page (⟐3, and ⟐1 on omnihand / conscious) only
// flashes and dispatches nothing — unchanged.
//
// V167 — page 2 now follows the SCOPIC STATES structure (see
// docs/architecture/SCOPIC_STATES_DESIGN.md). Each hand is its own tool
// system over one scope of what the user sees/does:
//   omnihand   MetaStates   (Realities / OmniProducts — axiomatic, persistent anchors)
//   conscious  VisualStates (Perspectives — the options an OmniProduct offers;
//                            may be a DIFFERENT product than OmniHand's)
//   lh         Process      (physical state of a node: behaviours, down to the number unit)
//   rh         Object       (identity of a node: the OmniDraw object itself)
// The tool names are PLACEHOLDER LABELS (nothing behind them yet — they only
// dispatch omni:tool-select, same as before); they are named for what each
// scope will do so the structure reads correctly. abbr/color stay each
// hand's own. V168: rh ⟐2 lost ColorShift / MaterialMorph / TextureWeave (they live on ⟐1 as Color /
// Material / Texture now: no duplicates) and gained Geometry, Glyph, Label.
const TOOLS = {
  omnihand: {
    abbr : '⟐mH',
    color: 'rgba(255, 255, 255, 0.90)',
    '⟐1' : null,
    '⟐2' : ['SelectMetaState','StageAtOrigin','LayerMetaState','SoloMetaState','PinAnchor',
             'CompareMetaStates','MetaStateLaws','SaveMetaState','MetaStateInfo','ReturnToDefault'],
    '⟐3' : null,
  },
  conscious: {
    abbr : '⟐CH',
    color: 'rgba(180, 210, 255, 0.90)',
    '⟐1' : null,
    '⟐2' : ['SelectVisualState','SwapSourceProduct','ScaleDegree','BlendVisualStates','FilterByState',
             'RevealHidden','LensSettings','SaveVisualState','VisualStateInfo','ReturnToDefault'],
    '⟐3' : null,
  },
  lh: {
    abbr : '⟐LH',
    color: 'rgba(200, 255, 220, 0.90)',
    '⟐1' : ['Terminator','Process','Decision','InputOutput','Connector','Loop'],
    '⟐2' : ['Translate3D','Rotate3D','Scale3D','SetValue','StepValue',
             'Orbit','AttractRepel','FollowAnchor','Oscillate','Quantize'],
    '⟐3' : null,
  },
  rh: {
    abbr : '⟐RH',
    color: 'rgba(255, 200, 240, 0.90)',
    '⟐1' : ['DataTypes','Color','Texture','Material'],
    '⟐2' : ['DrawObject','NodeType','ShapeBlend','SymbolStamp','Jsonify',
             'BehaviorNode','ObjectInfo','Geometry','Glyph','Label'],
    '⟐3' : null,
  },
}

const HAND_CORNER = {
  omnihand : 'tl',
  conscious: 'tr',
  lh       : 'bl',
  rh       : 'br',
}

const PAGES = ['⟐1', '⟐2', '⟐3']

/** Page ⟐2 is always real; ⟐1 only where TOOLS carries a list (lh, rh); ⟐3 never. */
const pageAvailable = (handId, page) => page === '⟐2' || (page === '⟐1' && Array.isArray(TOOLS[handId]['⟐1']))
const KIND_PAGE = '⟐1'

// ── Geometry helpers ──────────────────────────────────────────────────────────

const toRad  = deg => deg * Math.PI / 180
const polar  = (angleDeg, r) => ({ x: Math.cos(toRad(angleDeg)) * r, y: Math.sin(toRad(angleDeg)) * r })
const placeAt = (x, y) => `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`

function splitName (name) {
  const spaced = name
    .replace(/([0-9]+[A-Za-z]*)/g, ' $1 ')
    .replace(/([A-Z][a-z]+)/g, ' $1')
    .trim()
  const parts = spaced.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { a: name.slice(0, 7), b: '' }
  if (parts.length === 1) return { a: parts[0].slice(0, 7), b: '' }
  return { a: parts[0].slice(0, 7), b: parts.slice(1).join('').slice(0, 6) }
}

// ── SVG helper ────────────────────────────────────────────────────────────────

const SVG_NS = 'http://www.w3.org/2000/svg'
const svgEl  = (tag, attrs = {}) => {
  const el = document.createElementNS(SVG_NS, tag)
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v))
  return el
}

// ── Stylesheet ────────────────────────────────────────────────────────────────

const STYLES = /* css */`

.omni-radial {
  --r-bg          : rgba(6, 6, 10, 0.82);
  --r-border      : rgba(255, 255, 255, 0.09);
  --r-ring        : rgba(255, 255, 255, 0.10);
  --r-ring-inner  : rgba(255, 255, 255, 0.07);
  --r-spoke       : rgba(255, 255, 255, 0.06);
  --r-text        : rgba(255, 255, 255, 0.95);
  --r-text-dim    : rgba(255, 255, 255, 0.55);
  --r-accent      : rgba(255, 255, 255, 1.00);
  --r-glow        : 0 0 10px rgba(255, 255, 255, 0.24);
  --r-glow-strong : 0 0 16px rgba(255, 255, 255, 0.48);
  --mono          : 'Courier New', Courier, monospace;

  position        : fixed;
  width           : ${CONTAINER}px;
  height          : ${CONTAINER}px;
  /* Real fix — was 55. MovementPad.js's own _handleRadialToggle
     deliberately bumps a hand's pad to z-index 60 while that hand's
     radial is open (so the pad stays clickable through it), which
     left the radial popup itself rendering BELOW the pad whenever
     both were out at once — invisible, not just hard to reach. That
     bump was never noticed before because OmniHand/ConsciousHand's
     own pads used to be permanently invisible (TBD, movable:false);
     now that they're real pads, the overlap is real too. Raised past
     60 so the popup always wins regardless of that bump, on every
     hand, not just the two that happened to go unnoticed. */
  z-index         : 65;
  pointer-events  : none;
  opacity         : 0;
  /* V166: a closed radial must not be hit-testable. Its .radial-item children set
     pointer-events:auto (which wins over this container's none), and _hide() resets
     them to scale 1 / opacity 1 for the next open, so a CLOSED menu used to leave
     invisible discs on top of whatever sat under its 420px box (the pad's Speed /
     Settings satellites at 768px and on phones). visibility:hidden removes the
     whole subtree from hit-testing; _show() sets it to visible, _hide() back. */
  visibility      : hidden;
  user-select     : none;

  -webkit-font-smoothing: antialiased;
}

/* ── SVG decorative ─────────────────────────────────────────────────────────── */

.radial-svg {
  position        : absolute;
  inset           : 0;
  width           : 100%;
  height          : 100%;
  pointer-events  : none;
  overflow        : visible;
}

.svg-ring        { fill: none; stroke-linecap: round; }
.svg-ring--outer { stroke: rgba(255,255,255,0.10); stroke-width: 1; }
.svg-ring--inner { stroke: rgba(255,255,255,0.07); stroke-width: 1; }
.svg-ring--center{ stroke: rgba(255,255,255,0.14); stroke-width: 1; }

.svg-spoke        { stroke: rgba(255,255,255,0.06); stroke-width: 0.6; stroke-linecap: round; }
.svg-spoke--inner { stroke: rgba(255,255,255,0.08); stroke-width: 0.5; stroke-dasharray: 2 3; }
.svg-tick         { stroke: rgba(255,255,255,0.12); stroke-width: 1; stroke-linecap: round; }

/* ── Interactive base ───────────────────────────────────────────────────────── */

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
  background      : rgba(12, 12, 18, 0.92);
  border          : 1px solid rgba(255, 255, 255, 0.30);
  cursor          : default;
  pointer-events  : none;
  z-index         : 3;
}

.radial-center-abbr {
  font-size       : 12px;
  font-weight     : 600;
  letter-spacing  : 0.08em;
  color           : rgba(255, 255, 255, 1.0); /* full white */
  text-shadow     : 0 0 12px rgba(255,255,255,0.60), var(--r-glow-strong);
  pointer-events  : none;
  line-height     : 1;
  position        : relative;
  z-index         : 2;
}

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

/* ── Page selectors (inner ring) ────────────────────────────────────────────── */

.radial-page {
  width           : ${PAGE_R * 2}px;
  height          : ${PAGE_R * 2}px;
  background      : rgba(255, 255, 255, 0.05);
  border          : 1px solid rgba(255, 255, 255, 0.12);
  z-index         : 2;
  gap             : 1px;
}

.radial-page:hover { background: rgba(255,255,255,0.12); border-color: rgba(255,255,255,0.28); }

.radial-page.is-active {
  background      : rgba(255,255,255,0.14);
  border-color    : rgba(255,255,255,0.55);
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
  border-color    : rgba(255,255,255,0.10);
}

.radial-page.is-locked:hover {
  background      : rgba(255,255,255,0.05);
  border-color    : rgba(255,255,255,0.10);
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

/* ── Tool slots (outer ring) ────────────────────────────────────────────────── */

.radial-tool {
  width           : ${TOOL_R * 2}px;
  height          : ${TOOL_R * 2}px;
  background      : rgba(255, 255, 255, 0.05);
  border          : 1px solid rgba(255, 255, 255, 0.12);
  z-index         : 2;
  gap             : 1px;
  overflow        : hidden;
}

.radial-tool:hover {
  background      : rgba(255, 255, 255, 0.13);
  border-color    : rgba(255, 255, 255, 0.30);
}

.radial-tool:hover .tool-name-a {
  color           : var(--r-accent);
}

.radial-tool.is-active {
  background      : rgba(255, 255, 255, 0.20);
  border-color    : rgba(255, 255, 255, 0.65);
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
  color           : rgba(255, 255, 255, 0.22);
  pointer-events  : none;
  letter-spacing  : 0.04em;
  line-height     : 1;
}

/* ── Tool text — readable on any background ─────────────────────────────────── */

.tool-name-a {
  font-size       : 8px;
  font-weight     : 600;
  color           : var(--r-text);
  /* Strong dark halo — readable on white OR black backgrounds */
  text-shadow     : 0 0 6px rgba(0,0,0,1.0),
                    0 1px 4px rgba(0,0,0,1.0),
                    0 2px 8px rgba(0,0,0,0.90),
                    0 0 14px rgba(0,0,0,0.70);
  letter-spacing  : 0.02em;
  pointer-events  : none;
  line-height     : 1.1;
  text-align      : center;
  transition      : color 0.12s ease;
  max-width       : ${TOOL_R * 2 - 2}px;
  overflow        : hidden;
  white-space     : nowrap;
  text-overflow   : ellipsis;
}

.tool-name-b {
  font-size       : 7px;
  color           : var(--r-text-dim);
  text-shadow     : 0 0 6px rgba(0,0,0,1.0),
                    0 1px 4px rgba(0,0,0,0.90);
  letter-spacing  : 0.02em;
  pointer-events  : none;
  line-height     : 1.1;
  text-align      : center;
  transition      : color 0.12s ease;
  max-width       : ${TOOL_R * 2 - 2}px;
  overflow        : hidden;
  white-space     : nowrap;
}

/* ── Rotation buttons ───────────────────────────────────────────────────────── */

.radial-rotate-btn {
  position        : absolute;
  left            : 50%;
  top             : 50%;
  width           : 22px;
  height          : 22px;
  border-radius   : 50%;
  background      : rgba(255, 255, 255, 0.06);
  border          : 1px solid rgba(255, 255, 255, 0.18);
  color           : rgba(255, 255, 255, 0.75);
  font-family     : var(--mono);
  font-size       : 9px;
  cursor          : pointer;
  display         : flex;
  align-items     : center;
  justify-content : center;
  z-index         : 4;
  pointer-events  : auto;
  -webkit-tap-highlight-color: transparent;
  touch-action    : manipulation;
  transition      : background 0.12s ease, border-color 0.12s ease, color 0.12s ease;
  padding         : 0;
  outline         : none;
  line-height     : 1;
}

.radial-rotate-btn:hover {
  background      : rgba(255, 255, 255, 0.16);
  border-color    : rgba(255, 255, 255, 0.45);
  color           : rgba(255, 255, 255, 1.00);
}

.radial-rotate-btn:active {
  background      : rgba(255, 255, 255, 0.24);
  transform       : translate(-50%, -50%) scale(0.92);
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

.radial-tooltip.is-visible { opacity: 1; }

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

  constructor (context) {
    this.ctx = context

    this._els       = {}
    this._svgRefs   = {}
    this._spinEl    = {}
    this._pageEls   = {}
    this._toolEls   = {}
    this._tooltip   = null
    this._spinTweens = {}

    // Rotation offset per hand (degrees, accumulates)
    this._rotOffset = { omnihand: 0, conscious: 0, lh: 0, rh: 0 }

    this._state = {
      omnihand : { visible: false, page: '⟐2', activeTool: null },
      conscious: { visible: false, page: '⟐2', activeTool: null },
      lh       : { visible: false, page: '⟐2', activeTool: null },
      rh       : { visible: false, page: '⟐2', activeTool: null },
    }

    this._onResize = this._handleResize.bind(this)
    this._onToggle = this._handleToggle.bind(this)
    // V168: the LeftHand's element kind can also change from ⟐OmniHands; keep the ⟐1 highlight honest.
    this._onHandSetting = (e) => { if (e.detail?.hand === 'lh' && e.detail?.key === 'elementKind') this._syncKindHighlight('lh') }
    // V168: closing the payload panel with its own × un-lights the RightHand's ⟐1 tool that opened it.
    this._onPayloadPanel = (e) => {
      const st = this._state.rh
      if (e.detail?.open || st.page !== KIND_PAGE || !st.activeTool) return
      this._toolEls.rh?.forEach(el => el.classList.remove('is-active'))
      st.activeTool = null
    }
  }

  // ── Module contract ──────────────────────────────────────────────────────

  init () {
    // V168: init() runs twice (main.js calls it, then base.addModule calls it again); the second pass built a
    // second, orphaned set of menus + a second tooltip in the DOM (same guard MovementPad has).
    if (this._els.omnihand) return
    injectStyles()
    this._buildTooltip()
    this._buildAllMenus()
    this._bindGlobalEvents()
    console.log('⟐ RadialMenu: initialized.')
  }

  destroy () {
    Object.values(this._spinTweens).forEach(t => t?.kill())
    Object.values(this._els).forEach(el => el?.parentNode?.removeChild(el))
    this._tooltip?.parentNode?.removeChild(this._tooltip)
    window.removeEventListener('omni:radial-toggle', this._onToggle)
    window.removeEventListener('resize', this._onResize)
    window.removeEventListener(HANDS_CHANGE_EVENT, this._onHandSetting)
    window.removeEventListener('omni:payload-panel-state', this._onPayloadPanel)
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Show or hide a hand's radial menu.
   * Guard removed — always processes to ensure ⬢ button always toggles correctly.
   */
  toggle (handId, visible) {
    if (!this._els[handId]) return
    this._state[handId].visible = visible
    visible ? this._show(handId) : this._hide(handId)
  }

  setVisible (handId, visible) {
    this.toggle(handId, visible)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Build
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

    container.appendChild(this._buildSVG(handId))

    const spinRing = document.createElement('div')
    spinRing.className = 'radial-spin-ring'
    container.appendChild(spinRing)
    this._spinEl[handId] = spinRing

    container.appendChild(this._buildCenter(handId))
    this._buildInnerRing(handId, container)
    this._buildOuterRing(handId, container)
    this._buildRotateButtons(handId, container)

    return container
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SVG layer
  // ─────────────────────────────────────────────────────────────────────────

  _buildSVG (handId) {
    const svg = svgEl('svg', {
      viewBox : `${-HALF} ${-HALF} ${CONTAINER} ${CONTAINER}`,
      width   : CONTAINER,
      height  : CONTAINER,
      class   : 'radial-svg',
    })

    const outerCirc = svgEl('circle', { r: OUTER_R, cx: 0, cy: 0, class: 'svg-ring svg-ring--outer' })
    const innerCirc = svgEl('circle', { r: INNER_R, cx: 0, cy: 0, class: 'svg-ring svg-ring--inner' })
    const centCirc  = svgEl('circle', { r: SPIN_R + 2, cx: 0, cy: 0, class: 'svg-ring svg-ring--center' })

    const outerC = 2 * Math.PI * OUTER_R
    const innerC = 2 * Math.PI * INNER_R
    const centC  = 2 * Math.PI * (SPIN_R + 2)

    outerCirc.style.cssText = `stroke-dasharray:${outerC};stroke-dashoffset:${outerC}`
    innerCirc.style.cssText = `stroke-dasharray:${innerC};stroke-dashoffset:${innerC}`
    centCirc.style.cssText  = `stroke-dasharray:${centC};stroke-dashoffset:${centC}`

    svg.appendChild(outerCirc)
    svg.appendChild(innerCirc)
    svg.appendChild(centCirc)

    TOOL_ANGLES.forEach(angleDeg => {
      const p1 = polar(angleDeg, INNER_R)
      const p2 = polar(angleDeg, OUTER_R)
      svg.appendChild(svgEl('line', { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, class: 'svg-spoke' }))
    })

    PAGE_ANGLES.forEach(angleDeg => {
      const p1 = polar(angleDeg, SPIN_R + 3)
      const p2 = polar(angleDeg, INNER_R - PAGE_R - 2)
      svg.appendChild(svgEl('line', { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, class: 'svg-spoke svg-spoke--inner' }))
    })

    const TICK_HALF = 3
    TOOL_ANGLES.forEach(angleDeg => {
      const cos = Math.cos(toRad(angleDeg))
      const sin = Math.sin(toRad(angleDeg))
      const perp   = { x: -sin, y: cos }
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
    disc.className   = 'radial-item radial-center'
    disc.style.transform = placeAt(0, 0)

    const abbr = document.createElement('span')
    abbr.className   = 'radial-center-abbr'
    abbr.textContent = TOOLS[handId].abbr
    disc.appendChild(abbr)

    // Click centre disc to collapse this radial menu
    disc.style.pointerEvents = 'auto'
    disc.addEventListener('click', () => {
      this.toggle(handId, false)
      window.dispatchEvent(new CustomEvent('omni:radial-toggle', {
        detail: { hand: handId, visible: false, _fromCenter: true }
      }))
    })

    return disc
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Inner ring — page selectors
  // ─────────────────────────────────────────────────────────────────────────

  _buildInnerRing (handId, container) {
    this._pageEls[handId] = []

    PAGES.forEach((page, i) => {
      const angleDeg  = PAGE_ANGLES[i]
      const { x, y } = polar(angleDeg, INNER_R)
      // Page 2 is real everywhere; page 1 is real on lh / rh (V168) and reserved/locked for the
      // planned search + scan feature on the top hands; page 3 is the planned OmniKeyboard
      // launcher — see the TOOLS comment above and docs/planning/BACKLOG.md.
      const available = pageAvailable(handId, page)

      const btn = document.createElement('div')
      btn.className = ['radial-item','radial-page', available ? '' : 'is-locked', (page === '⟐2') ? 'is-active' : ''].filter(Boolean).join(' ')
      btn.dataset.page = page
      btn.dataset.hand = handId
      btn.style.transform = placeAt(x, y)
      btn.tabIndex = available ? 0 : -1
      btn.setAttribute('role', 'button')
      btn.setAttribute('aria-label', available ? `Page ${page}` : `Page ${page} — unavailable`)

      const lbl = document.createElement('span')
      lbl.className   = 'page-label'
      lbl.textContent = page
      btn.appendChild(lbl)

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
  // Tool positions use GSAP x/y so _rotateMenu can tween them cleanly.
  // ─────────────────────────────────────────────────────────────────────────

  _buildOuterRing (handId, container) {
    this._toolEls[handId] = []

    const tools      = TOOLS[handId]['⟐2']
    const accentColor = TOOLS[handId].color

    TOOL_ANGLES.forEach((angleDeg, i) => {
      const { x, y } = polar(angleDeg, OUTER_R)
      const toolName  = tools[i] ?? '—'
      const { a, b }  = splitName(toolName)

      const slot = document.createElement('div')
      slot.className = 'radial-item radial-tool'
      slot.dataset.toolIndex = i
      slot.dataset.tool      = toolName
      slot.dataset.hand      = handId
      slot.tabIndex = 0
      slot.setAttribute('role', 'button')
      slot.setAttribute('aria-label', toolName)
      slot.dataset.omniTip = toolName   // V169: ⟐OmniNotify hover info (kept in sync in _switchPage below)
      slot.dataset.omniTipKey = '—'
      slot.dataset.omniTipDesc = `Radial tool of ${TOOLS[handId]?.abbr ?? handId}: click to select it (click again to deselect).`
      slot.dataset.omniTipSource = 'Radial menu'

      // Use GSAP set for positioning so rotation tweens can tween x/y directly
      gsap.set(slot, {
        xPercent : -50,
        yPercent : -50,
        x,
        y,
      })

      const idx = document.createElement('span')
      idx.className   = 'tool-index'
      idx.textContent = i + 1
      slot.appendChild(idx)

      const nameA = document.createElement('span')
      nameA.className   = 'tool-name-a'
      nameA.textContent = a
      slot.appendChild(nameA)

      if (b) {
        const nameB = document.createElement('span')
        nameB.className   = 'tool-name-b'
        nameB.textContent = b
        slot.appendChild(nameB)
      }

      slot.style.setProperty('--tool-accent', accentColor)

      // V168: read the slot's CURRENT name (dataset.tool, rewritten by _switchPage) — the build-time
      // closure value is the page-⟐2 name, so before this a click on a switched page reported the old tool.
      slot.addEventListener('mouseenter', (e) => this._showTooltip(slot.dataset.tool, e))
      slot.addEventListener('mouseleave', ()  => this._hideTooltip())
      slot.addEventListener('mousemove',  (e) => this._moveTooltip(e))
      slot.addEventListener('click', () => this._handleToolClick(handId, slot.dataset.tool, i, slot))
      slot.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); slot.click() }
      })

      container.appendChild(slot)
      this._toolEls[handId].push(slot)
    })
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Rotation buttons — ◄ ► below the centre disc
  // ─────────────────────────────────────────────────────────────────────────

  _buildRotateButtons (handId, container) {
    // Position: just below the centre disc, left and right
    const btnL = document.createElement('button')
    btnL.className    = 'radial-rotate-btn'
    btnL.textContent  = '◄'
    btnL.title        = 'Rotate left'
    btnL.style.transform = placeAt(-22, CENTER_R + 16)
    btnL.addEventListener('click', (e) => {
      e.stopPropagation()
      this._rotateMenu(handId, -1)
    })

    const btnR = document.createElement('button')
    btnR.className    = 'radial-rotate-btn'
    btnR.textContent  = '►'
    btnR.title        = 'Rotate right'
    btnR.style.transform = placeAt(22, CENTER_R + 16)
    btnR.addEventListener('click', (e) => {
      e.stopPropagation()
      this._rotateMenu(handId, 1)
    })

    container.appendChild(btnL)
    container.appendChild(btnR)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Rotate outer ring tools by ±36° (one slot)
  // ─────────────────────────────────────────────────────────────────────────

  _rotateMenu (handId, direction) {
    const step   = 36
    this._rotOffset[handId] += step * direction
    const offset = this._rotOffset[handId]

    const toolEls = this._toolEls[handId]

    TOOL_ANGLES.forEach((baseAngle, i) => {
      const newAngle  = baseAngle + offset
      const { x, y } = polar(newAngle, OUTER_R)

      gsap.to(toolEls[i], {
        x,
        y,
        duration : 0.38,
        ease     : 'power2.inOut',
      })
    })

    this._playSound('click')
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Tooltip
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
    this._tooltip.style.left = `${e.clientX + 14}px`
    this._tooltip.style.top  = `${e.clientY - 14}px`
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Click handlers
  // ─────────────────────────────────────────────────────────────────────────

  _handlePageClick (handId, page, btn, available) {
    if (!available) {
      btn.classList.remove('locked-flash')
      void btn.offsetWidth
      btn.classList.add('locked-flash')
      this._playSound('click')
      return
    }

    const st = this._state[handId]
    if (st.page === page) return

    st.page       = page
    st.activeTool = null
    this._toolEls[handId].forEach(el => el.classList.remove('is-active'))   // a lit slot belongs to the page we just left

    this._playSound('click')
    this._updatePageActiveState(handId)
    this._switchPage(handId, page)

    window.dispatchEvent(new CustomEvent('omni:page-select', { detail: { hand: handId, page } }))
  }

  _handleToolClick (handId, toolName, toolIndex, slot) {
    const st       = this._state[handId]
    const wasActive = st.activeTool === toolName
    if (handId === 'lh' && st.page === KIND_PAGE) {
      // flowchart element kinds are a radio group: empty slots do nothing, the lit one stays lit
      if (toolName === '—') return
      this._toolEls[handId].forEach(el => el.classList.remove('is-active'))
      st.activeTool = toolName
      slot.classList.add('is-active')
      this._playSound('click')
      gsap.fromTo(slot, { scale: 0.88 }, { scale: 1, duration: 0.20, ease: 'back.out(2.5)' })
      window.dispatchEvent(new CustomEvent('omni:tool-select', {
        detail: { hand: handId, tool: toolName, toolIndex: toolIndex + 1, page: st.page }
      }))
      return
    }

    this._toolEls[handId].forEach(el => el.classList.remove('is-active'))

    if (wasActive) {
      st.activeTool = null
      this._playSound('close')
      window.dispatchEvent(new CustomEvent('omni:tool-deselect', {
        detail: { hand: handId, tool: toolName, page: st.page }
      }))
    } else {
      st.activeTool = toolName
      slot.classList.add('is-active')
      this._playSound('click')
      gsap.fromTo(slot, { scale: 0.88 }, { scale: 1, duration: 0.20, ease: 'back.out(2.5)' })
      window.dispatchEvent(new CustomEvent('omni:tool-select', {
        detail: { hand: handId, tool: toolName, toolIndex: toolIndex + 1, page: st.page }
      }))
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Page switching
  // ─────────────────────────────────────────────────────────────────────────

  _updatePageActiveState (handId) {
    const st  = this._state[handId]
    const els = this._pageEls[handId]
    PAGES.forEach((page, i) => {
      if (els[i]) els[i].classList.toggle('is-active', page === st.page)
    })
  }

  _switchPage (handId, page) {
    const tools   = TOOLS[handId][page]
    const toolEls = this._toolEls[handId]
    const stagger = 0.025

    gsap.to(toolEls, {
      scale: 0, opacity: 0,
      duration: 0.12, stagger,
      ease: 'power2.in',
      onComplete: () => {
        toolEls.forEach((slot, i) => {
          const name    = tools?.[i] ?? '—'
          const { a, b } = splitName(name)

          slot.dataset.tool = name
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
          slot.dataset.omniTip = name
        })

        gsap.to(toolEls, { scale: 1, opacity: 1, duration: 0.18, stagger, ease: 'back.out(1.6)' })
        this._syncKindHighlight(handId)
      },
    })
  }

  /** lh ⟐1: light the slot of the LeftHand's current element kind (and make it the active tool). */
  _syncKindHighlight (handId) {
    const st = this._state[handId]
    if (handId !== 'lh' || st.page !== KIND_PAGE) return
    const kind = getHandSetting('lh', 'elementKind')
    this._toolEls.lh.forEach(el => el.classList.toggle('is-active', el.dataset.tool === kind))
    st.activeTool = kind
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Positioning — bottom hands keep prior extraLift/extraShift
  // ─────────────────────────────────────────────────────────────────────────

  _computeCenter (corner) {
    const w = window.innerWidth
    const h = window.innerHeight
    const m = Math.max(20, Math.min(MARGIN, w * 0.13))
    switch (corner) {
      case 'tl': return { x: m,     y: getTopOffset() + m }
      case 'tr': return { x: w - m, y: getTopOffset() + m }
      case 'bl': return { x: m,     y: h - DOCK_H - m }
      case 'br': return { x: w - m, y: h - DOCK_H - m }
    }
  }

  _positionMenu (handId) {
    const el = this._els[handId]
    if (!el) return
    const corner     = HAND_CORNER[handId]
    const { x, y }   = this._computeCenter(corner)

    // The 200/250px "shift toward center" is a fixed pixel value that
    // was never scaled for viewport width — harmless on a wide desktop
    // screen where it's a small fraction of the width, but on a narrow
    // mobile viewport (this menu's own container is 420px wide) it
    // pushes the menu proportionally much further across the screen,
    // landing directly on top of the movement pad instead of staying
    // near its own corner. Tapers linearly to 0 below 500px width,
    // fully off below 380px, rather than a hard cutoff.
    const w = window.innerWidth
    const shiftScale = w >= 500 ? 1 : w <= 380 ? 0 : (w - 380) / 120

    const extraLift  = ((corner === 'bl' || corner === 'br') ? 250 : 0) * shiftScale
    const extraShift = (corner === 'bl' ? 200 : corner === 'br' ? -200 : 0) * shiftScale
    el.style.left = `${x - HALF + extraShift}px`
    el.style.top  = `${y - HALF - extraLift}px`
  }

  _handleResize () {
    Object.keys(this._els).forEach(id => this._positionMenu(id))
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Show / Hide
  // ─────────────────────────────────────────────────────────────────────────

  _show (handId) {
    const el = this._els[handId]
    if (!el) return

    this._positionMenu(handId)

    const { outerCirc, innerCirc, centCirc } = this._svgRefs[handId]
    const outerC = 2 * Math.PI * OUTER_R
    const innerC = 2 * Math.PI * INNER_R
    const centC  = 2 * Math.PI * (SPIN_R + 2)

    const pageEls = this._pageEls[handId]
    const toolEls = this._toolEls[handId]

    // ── Kill ALL in-flight tweens — prevents _hide onComplete from corrupting ──
    gsap.killTweensOf(el)
    gsap.killTweensOf(toolEls)
    gsap.killTweensOf(pageEls)

    // ── Hard-reset children to known good state ────────────────────────────
    gsap.set(toolEls, { scale: 1, opacity: 1 })
    gsap.set(pageEls, { scale: 1, opacity: 1 })

    // Restore tool positions with current rotation offset applied
    const offset = this._rotOffset[handId]
    TOOL_ANGLES.forEach((baseAngle, i) => {
      const { x, y } = polar(baseAngle + offset, OUTER_R)
      gsap.set(toolEls[i], { x, y })
    })

    // ── Reset SVG rings ────────────────────────────────────────────────────
    gsap.set(outerCirc, { strokeDashoffset: outerC })
    gsap.set(innerCirc, { strokeDashoffset: innerC })
    gsap.set(centCirc,  { strokeDashoffset: centC  })

    // ── Animate container in ───────────────────────────────────────────────
    gsap.fromTo(el,
      { opacity: 0, scale: 0.70 },
      { opacity: 1, scale: 1, duration: 0.28, ease: 'back.out(1.6)' }
    )
    el.style.pointerEvents = 'auto'
    el.style.visibility    = 'visible'   // V166: only an open radial is hit-testable

    // ── SVG rings draw in ──────────────────────────────────────────────────
    gsap.to(centCirc,  { strokeDashoffset: 0, duration: 0.30, ease: 'power2.out', delay: 0.06 })
    gsap.to(innerCirc, { strokeDashoffset: 0, duration: 0.40, ease: 'power2.out', delay: 0.12 })
    gsap.to(outerCirc, { strokeDashoffset: 0, duration: 0.55, ease: 'power2.out', delay: 0.18 })

    // ── Page buttons spring in ─────────────────────────────────────────────
    gsap.fromTo(pageEls,
      { scale: 0, opacity: 0 },
      { scale: 1, opacity: 1, duration: 0.22, ease: 'back.out(2)', stagger: 0.06, delay: 0.22 }
    )

    // ── Tool slots cascade in ──────────────────────────────────────────────
    gsap.fromTo(toolEls,
      { scale: 0, opacity: 0 },
      { scale: 1, opacity: 1, duration: 0.18, ease: 'back.out(1.8)', stagger: 0.03, delay: 0.32 }
    )

    this._startSpin(handId)
  }

  _hide (handId) {
    const el = this._els[handId]
    if (!el) return

    this._hideTooltip()

    const pageEls = this._pageEls[handId]
    const toolEls = this._toolEls[handId]

    gsap.to(toolEls, {
      scale: 0, opacity: 0,
      duration: 0.10, stagger: 0.02, ease: 'power2.in',
    })

    gsap.to(pageEls, {
      scale: 0, opacity: 0,
      duration: 0.10, stagger: 0.04, ease: 'power2.in', delay: 0.05,
    })

    gsap.to(el, {
      opacity: 0,
      scale  : 0.78,
      duration: 0.18,
      ease   : 'power2.in',
      delay  : 0.10,
      onComplete: () => {
        el.style.pointerEvents = 'none'
        el.style.visibility    = 'hidden'   // V166: see .omni-radial
        el.style.transform     = ''
        // Reset children — _show will re-override if already reopening
        gsap.set([...toolEls, ...pageEls], { scale: 1, opacity: 1 })
      },
    })

    this._stopSpin(handId)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Spin
  // ─────────────────────────────────────────────────────────────────────────

  _startSpin (handId) {
    const ring = this._spinEl[handId]
    if (!ring) return
    if (this._spinTweens[handId]) this._spinTweens[handId].kill()
    this._spinTweens[handId] = gsap.to(ring, {
      rotation: 360, repeat: -1, duration: 7, ease: 'none', transformOrigin: '50% 50%',
    })
  }

  _stopSpin (handId) {
    const tween = this._spinTweens[handId]
    if (!tween) return
    gsap.to(this._spinEl[handId], {
      timeScale: 0, duration: 0.6, ease: 'power2.out',
      onComplete: () => tween.pause(),
    })
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Global events
  // ─────────────────────────────────────────────────────────────────────────

  _bindGlobalEvents () {
    window.addEventListener('omni:radial-toggle', this._onToggle)
    window.addEventListener('resize', this._onResize)
    window.addEventListener(HANDS_CHANGE_EVENT, this._onHandSetting)
    window.addEventListener('omni:payload-panel-state', this._onPayloadPanel)
  }

  _handleToggle (e) {
    if (e.detail?._fromCenter) return   // ← add this — prevents double-fire
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