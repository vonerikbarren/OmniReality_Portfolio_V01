/**
 * ui/MovementPad.js — ⟐mniReality Directional Movement Pad
 *
 * Manages four corner-anchored directional pads — one per Hand.
 * All four share a single component instance; visibility is toggled
 * per-hand via omni:pad-toggle, or globally via omni:pads-global.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Hand → Pad function
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   ⟐mniHand  TL  →  DIMENSIONAL AXIS (⟐) — NO camera movement
 *                      Left/Right → back/forth along OmniHand's primary axis
 *                                   (starts at the origin toward 11 o'clock; OmniProducts)
 *                      Up/Down    → Υ axis: product tier up/down
 *   ⟐CH       TR  →  DIMENSIONAL AXIS (Δ) — NO camera movement
 *                      Left/Right → back/forth along Conscious Hand's primary
 *                                   axis (starts at the origin toward 2 o'clock; perspectives)
 *                      Up/Down    → Υ axis: scale degree (Human → Atomic)
 *                      Both call systems/OmniDimensionalAxes.js; see
 *                      setDimensionalAxes(). A press steps one position and
 *                      holding repeats.
 *   ⟐LH       BL  →  WASD — horizontal movement through space (XZ plane)
 *                      W → Forward   S → Backward
 *                      A → Strafe L  D → Strafe R
 *   ⟐RH       BR  →  HEIGHT + ORBIT
 *                      Up    → Rise     (R key)
 *                      Down  → Fall     (F key)
 *                      Left  → Orbit L  (arc around world Y)
 *                      Right → Orbit R  (arc around world Y)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Aesthetic
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   Rotating dashed ring inside each pad — pure CSS ::before pseudo-element.
 *   Spins continuously and breathes (hums): bright + small at the pulse peak,
 *   dim + large at the outer edge. Zero JS, zero memory cost.
 *
 *   Buttons have depth shadow + translateY(2px) on press for physical feel.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Duplicate pad fix
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   omni:pads-global only toggles movable pads (lh + rh). TBD pads are never
 *   shown by the global toggle.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Events consumed
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   omni:pad-toggle   →  { hand, visible }
 *   omni:pads-global  →  { visible }
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Events dispatched
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   omni:movement  →  { hand, direction, active, mode }
 *                     (lh / rh only — the dimensional pads move no camera,
 *                      so they dispatch omni:dimension-state via the axes
 *                      system instead)
 */

import gsap from 'gsap'
import * as THREE from 'three'
import {
  CONSCIOUS_SYMBOL, OMNIHAND_SYMBOL, REL_AXIS_SYMBOL, HOLD_REPEAT_MS,
} from '../systems/OmniDimensionalAxes.js'

// ── Motion constants ──────────────────────────────────────────────────────────

const MOVE_SPEED = 20
const YAW_SPEED  = 0.8

// ── Layout constants ──────────────────────────────────────────────────────────

const BAR_H      = 48
const DOCK_H     = 52
const HAND_CELL  = 44
const HAND_GAP   = 2
const HAND_WH    = HAND_CELL * 2 + HAND_GAP

const PAD_CELL   = 40
const PAD_GAP    = 3
const PAD_INNER  = 8
const PAD_OFFSET = 4

// ── Pad configuration ─────────────────────────────────────────────────────────

const PAD_CONFIGS = {
  // OmniHand and ConsciousHand do NOT move the camera (decided V158). Their
  // four buttons drive the dimensional-axis system (systems/
  // OmniDimensionalAxes.js): left/right travel the hand's PRIMARY axis,
  // up/down travel its relative (Υ) axis. Pad chrome (show/hide, satellites,
  // release/detach, z-index handling) is unchanged from V150/V151.
  omnihand: {
    id: 'omnihand', corner: 'tl', abbr: '⟐H', modeLabel: `${OMNIHAND_SYMBOL} AXIS`,
    movable: true, keyboard: 'omnihand-axes', dimensional: true,
    dirLabels: { up: `${REL_AXIS_SYMBOL}▲`, down: `${REL_AXIS_SYMBOL}▼`, left: `${OMNIHAND_SYMBOL}◂`, right: `${OMNIHAND_SYMBOL}▸` },
    centerLabel: OMNIHAND_SYMBOL,
  },
  conscious: {
    id: 'conscious', corner: 'tr', abbr: 'CH', modeLabel: `${CONSCIOUS_SYMBOL} AXIS`,
    movable: true, keyboard: 'conscious-axes', dimensional: true,
    dirLabels: { up: `${REL_AXIS_SYMBOL}▲`, down: `${REL_AXIS_SYMBOL}▼`, left: `${CONSCIOUS_SYMBOL}◂`, right: `${CONSCIOUS_SYMBOL}▸` },
    centerLabel: CONSCIOUS_SYMBOL,
  },
  lh: {
    id: 'lh', corner: 'bl', abbr: 'LH', modeLabel: 'MOVE',
    movable: true, keyboard: 'wasd',
    dirLabels: { up: 'FWD', down: 'BCK', left: 'STR-L', right: 'STR-R' },
    centerLabel: '⟐LH',
  },
  rh: {
    id: 'rh', corner: 'br', abbr: 'RH', modeLabel: 'NAV',
    movable: true, keyboard: 'rf',
    dirLabels: { up: 'RISE', down: 'FALL', left: 'ORB-L', right: 'ORB-R' },
    centerLabel: '⟐RH',
  },
}

const DIRS       = ['up', 'down', 'left', 'right']
const DIR_GLYPHS = { up: '▲', down: '▼', left: '◄', right: '►' }

// ── Satellite cluster geometry ─────────────────────────────────────────────────
//
// Three buttons (Release / Dash / an inert TBD slot) sit on each movable
// pad's own circular rim, not inside its 3×3 cross. LH spans the 3–6 o'clock
// arc of its own circle; RH spans 6–9 o'clock, mirrored — both clusters face
// inward-and-down (toward screen-bottom-center), just reflected left/right,
// per direct request ("to mirror the other hand"). Clock angle θ is measured
// clockwise from 12 o'clock; (dx, dy) is the screen offset from the pad's own
// center (dx: +right, dy: +down), at radius R from that center.

function _clockOffset (clockDeg, r) {
  const rad = (clockDeg * Math.PI) / 180
  return { dx: r * Math.sin(rad), dy: -r * Math.cos(rad) }
}

// LH: Release @ 3 o'clock (90°, nearest screen-center), Dash @ 135°,
// TBD @ 6 o'clock (180°, straight down). RH mirrors across the vertical
// axis: same roles, angles reflected (360 − θ), landing in the 180–270° arc.
//
// OmniHand/ConsciousHand (top corners) mirror that same pair vertically —
// direct request, same "mirror the lh and rh" that gave them real pads at
// all. LH/RH's cluster leans inward-and-DOWN, toward the bottom-center gap
// between them near the Dock; OmniHand/ConsciousHand's leans inward-and-UP
// instead, toward the top-center gap between THEM — the straight-down 180°
// TBD slot becomes straight-up 0°, and the diagonal Dash slot flips from
// 135°/225° to 45°/315° to match. Release stays nearest screen-center either
// way (90°/270°), since that relationship doesn't depend on top vs bottom.
const _SAT_ANGLES = {
  lh:        { release: 90,  dash: 135, undefined: 180 },
  rh:        { release: 270, dash: 225, undefined: 180 },
  omnihand:  { release: 90,  dash: 45,  undefined: 0   },
  conscious: { release: 270, dash: 315, undefined: 0   },
}
const _SAT_SIDE   = { lh: 'left', rh: 'right', omnihand: 'left', conscious: 'right' }
const _SAT_ANCHOR = { lh: 'bottom', rh: 'bottom', omnihand: 'top', conscious: 'top' }

function _buildSatGeom (padHalf, satHalf) {
  const R = padHalf + PAD_OFFSET + satHalf
  const center = padHalf + 4 // pad's own left/right CSS offset is 4px
  const bottomBase = DOCK_H + HAND_WH + PAD_OFFSET + padHalf
  const topBase    = BAR_H  + HAND_WH + PAD_OFFSET + padHalf
  const out = {}
  Object.keys(_SAT_ANGLES).forEach(hand => {
    out[hand] = {}
    const side   = _SAT_SIDE[hand]
    const anchor = _SAT_ANCHOR[hand]
    Object.entries(_SAT_ANGLES[hand]).forEach(([role, clockDeg]) => {
      const { dx, dy } = _clockOffset(clockDeg, R)
      // Left-anchored hands (dx>0 moves right → larger `left`); right-
      // anchored hands (dx>0 moves right → SMALLER `right`, so subtract).
      const d = side === 'left' ? (center + dx - satHalf) : (center - dx - satHalf)
      // Bottom-anchored hands: moving down (dy>0) means a SMALLER
      // `bottom` offset (closer to the screen's actual bottom edge).
      // Top-anchored hands: moving down means a LARGER `top` offset
      // (further from the screen's actual top edge) — opposite sign.
      const v = anchor === 'bottom' ? (bottomBase - dy - satHalf) : (topBase + dy - satHalf)
      out[hand][role] = { d: Math.round(d), v: Math.round(v), side, anchor }
    })
  })
  return out
}

const _SAT_GEOM        = _buildSatGeom(110, 20) // desktop: 220px pad, 40px satellite buttons
const _SAT_GEOM_MOBILE = _buildSatGeom(90, 17)  // mobile:  180px pad, 34px satellite buttons

// ── Stylesheet ────────────────────────────────────────────────────────────────

const STYLES = `

/* ── Keyframes ─────────────────────────────────────────────────────────────── */

@keyframes pad-spin {
  from { transform: translate(-50%, -50%) rotate(0deg);   }
  to   { transform: translate(-50%, -50%) rotate(360deg); }
}

@keyframes pad-hum {
  0%, 100% {
    width        : 88%;
    height       : 88%;
    border-color : rgba(255, 255, 255, 0.10);
    box-shadow   : none;
  }
  50% {
    width        : 60%;
    height       : 60%;
    border-color : rgba(255, 255, 255, 0.80);
    box-shadow   : 0 0 16px rgba(255, 255, 255, 0.28), inset 0 0 10px rgba(255, 255, 255, 0.14);
  }
}

/* ── Pad container ─────────────────────────────────────────────────────────── */

.omni-pad {
  --pad-bg         : rgba(8, 8, 12, 0.20);
  --pad-border     : rgba(255, 255, 255, 0.85);
  --pad-btn-bg     : rgba(255, 255, 255, 0.05);
  --pad-btn-hover  : rgba(255, 255, 255, 0.13);
  --pad-btn-press  : rgba(255, 255, 255, 0.26);
  --pad-text       : rgba(255, 255, 255, 0.90);
  --pad-text-dim   : rgba(255, 255, 255, 0.70);
  --pad-accent     : rgba(255, 255, 255, 0.96);
  --pad-glow       : 0 0 10px rgba(255, 255, 255, 0.22);
  --pad-glow-press : 0 0 14px rgba(255, 255, 255, 0.40);
  --mono           : 'Courier New', Courier, monospace;
  --pad-cell       : ${PAD_CELL}px;
  --pad-gap        : ${PAD_GAP}px;
  --pad-inner      : ${PAD_INNER}px;

  position         : fixed;
  z-index          : 41;
  pointer-events   : none;
  opacity          : 0;
  user-select      : none;
  -webkit-user-select    : none;
  -webkit-touch-callout  : none;

  background       : var(--pad-bg);
  backdrop-filter  : blur(18px) saturate(1.5);
  -webkit-backdrop-filter: blur(18px) saturate(1.5);
  border           : 1px solid var(--pad-border);
  border-radius    : 50%;
  width            : 220px;
  height           : 220px;
  overflow         : hidden;
  box-shadow       : 0 0 12px rgba(255,255,255,0.25), inset 0 0 8px rgba(255,255,255,0.05);

  display          : flex;
  flex-direction   : column;
  align-items      : center;
  justify-content  : center;
  gap              : 4px;
  padding          : 20px;

  -webkit-font-smoothing: antialiased;
}

/* ── Rotating hum ring — pure CSS, zero JS, zero memory cost ───────────────── */

.omni-pad::before {
  content          : '';
  position         : absolute;
  border-radius    : 50%;
  border           : 1.5px dashed rgba(255, 255, 255, 0.10);
  pointer-events   : none;
  top              : 50%;
  left             : 50%;
  z-index          : 0;

  /* spin + breathe combined — two animations on one element */
  animation        : pad-spin 10s linear infinite,
                     pad-hum  4s ease-in-out infinite;
}

/* Everything inside the pad sits above the hum ring */
.pad-header,
.pad-cross,
.pad-keys {
  position         : relative;
  z-index          : 1;
}

/* ── Corner anchoring ──────────────────────────────────────────────────────── */

.omni-pad--tl { top: ${BAR_H + HAND_WH + PAD_OFFSET}px; left: 4px; transform-origin: top left; }
.omni-pad--tr { top: ${BAR_H + HAND_WH + PAD_OFFSET}px; right: 4px; transform-origin: top right; }
.omni-pad--bl { bottom: ${DOCK_H + HAND_WH + PAD_OFFSET}px; left: 4px; transform-origin: bottom left; }
.omni-pad--br { bottom: ${DOCK_H + HAND_WH + PAD_OFFSET}px; right: 4px; transform-origin: bottom right; }

/* ── Released / detached pad — floats, draggable by its own header ─────────── */

.omni-pad.is-detached {
  box-shadow       : 0 0 16px rgba(255, 255, 255, 0.35), inset 0 0 8px rgba(255, 255, 255, 0.06);
}
.omni-pad.is-detached .pad-header {
  cursor           : grab;
}
.omni-pad.is-detached .pad-header:active {
  cursor           : grabbing;
}

/* ── Satellite cluster — Release / Dash / TBD, sitting on each pad's own rim ──
   Position math (see MovementPad.js's _SAT_GEOM): LH spans the 3–6 o'clock
   arc of its own circle (the quadrant facing inward/down, toward screen
   center), RH mirrors it across 6–9 o'clock — both clusters face the same
   inward-and-down direction, just mirrored left/right, so they read as one
   consistent idea on either side rather than two unrelated layouts.        */

.omni-pad-sat {
  position         : fixed;
  width            : 40px;
  height           : 40px;
  display          : flex;
  align-items      : center;
  justify-content  : center;
  background       : rgba(8, 8, 12, 0.20);
  border           : 1px solid rgba(255, 255, 255, 0.85);
  border-radius    : 8px;
  color            : rgba(255, 255, 255, 0.90);
  font-size        : 13px;
  letter-spacing   : 0.02em;
  cursor           : pointer;
  pointer-events   : auto;
  /* Rest state — hidden until its own pad is toggled visible (direct
     request: "the 3 buttons... come out when the movement pads come
     out"). _animateIn/_animateOut's own _animateSatellitesIn/Out
     fade this to 1 (or 0.30 for the reserved slot) and back via GSAP,
     mirroring the pad's own opacity choreography exactly. */
  opacity          : 0;
  /* Real fix (bug-squash pass) — was 40, BELOW .omni-pad's own z-index
     of 41. Each satellite sits just outside the pad's circular edge by
     design (see _buildSatGeom's R formula), but a square button's own
     corner nearest the pad still dips a few px inside the pad's
     bounding circle at the diagonal (Dash) position. With the pad on
     top there, that corner silently ate clicks — likely why "the speed
     button doesnt work" even though the click handler was always
     wired correctly. Now strictly above the pad, so the full button is
     always clickable regardless of any sliver of geometric overlap. */
  z-index          : 42;
  transition       : background 120ms ease, color 120ms ease, box-shadow 120ms ease, opacity 120ms ease;
}
.omni-pad-sat:hover   { background: rgba(255, 255, 255, 0.13); }
.omni-pad-sat:active  { background: rgba(255, 255, 255, 0.26); }
.omni-pad-sat.is-active {
  background       : rgba(255, 255, 255, 0.26);
  color            : rgba(255, 255, 255, 0.96);
  box-shadow       : 0 0 14px rgba(255, 255, 255, 0.40);
  text-shadow      : 0 0 10px rgba(255, 255, 255, 0.22);
}
.omni-pad-sat .sat-glyph { pointer-events: none; }

.omni-pad-sat--undefined {
  opacity          : 0.30;
  cursor           : default;
  pointer-events   : none;
  border-style     : dashed;
}

${Object.keys(_SAT_ANGLES).map(hand => ['release', 'dash', 'undefined'].map(role => {
    const g = _SAT_GEOM[hand][role]
    return `.omni-pad-sat--${hand}-${role} { ${g.side}: ${g.d}px; ${g.anchor}: ${g.v}px; }`
  }).join('\n')).join('\n')}

@media (max-width: 460px) {
  .omni-pad-sat { width: 34px; height: 34px; font-size: 11px; }
  ${Object.keys(_SAT_ANGLES).map(hand => ['release', 'dash', 'undefined'].map(role => {
      const g = _SAT_GEOM_MOBILE[hand][role]
      return `.omni-pad-sat--${hand}-${role} { ${g.side}: ${g.d}px; ${g.anchor}: ${g.v}px; }`
    }).join('\n')).join('\n')}
}

/* ── Header — compact and centered so it reads inside the circle ───────────── */

.pad-header {
  display          : flex;
  align-items      : center;
  justify-content  : center;
  gap              : 6px;
  width            : 100%;
  flex-shrink      : 0;
  /* slant slightly so text fits the curve of the circle top */
  transform        : scaleX(0.82);
}

.pad-abbr {
  font-family      : var(--mono);
  font-size        : 8px;
  color            : var(--pad-text-dim);
  letter-spacing   : 0.10em;
  text-transform   : uppercase;
}

.pad-mode-label {
  font-family      : var(--mono);
  font-size        : 8px;
  color            : var(--pad-accent);
  letter-spacing   : 0.10em;
  text-transform   : uppercase;
  text-shadow      : var(--pad-glow);
}

/* ── Cross grid ────────────────────────────────────────────────────────────── */

.pad-cross {
  display               : grid;
  grid-template-columns : repeat(3, var(--pad-cell));
  grid-template-rows    : repeat(3, var(--pad-cell));
  gap                   : var(--pad-gap);
  flex-shrink           : 0;
}

.pad-slot-empty {}

/* ── Directional buttons ───────────────────────────────────────────────────── */

.pad-btn {
  display          : flex;
  flex-direction   : column;
  align-items      : center;
  justify-content  : center;
  gap              : 2px;
  width            : var(--pad-cell);
  height           : var(--pad-cell);
  background       : var(--pad-btn-bg);
  border           : 1px solid rgba(255, 255, 255, 0.10);
  border-radius    : 7px;
  cursor           : pointer;
  color            : var(--pad-text);
  font-family      : var(--mono);
  outline          : none;
  -webkit-touch-callout  : none;
  -webkit-user-select    : none;
  user-select            : none;
  -webkit-tap-highlight-color: transparent;
  touch-action     : none;

  /* Depth shadow — makes buttons look raised */
  /* Subtle — still reads as raised but doesn't compete */
  box-shadow : 0 2px 4px rgba(0, 0, 0, 0.30),
             0 1px 2px rgba(0, 0, 0, 0.18),
             inset 0 1px 0 rgba(255, 255, 255, 0.06);
  transition       : background 0.10s ease,
                     border-color 0.10s ease,
                     box-shadow 0.08s ease,
                     transform 0.08s ease;
}

.pad-btn:hover {
  background       : var(--pad-btn-hover);
  border-color     : rgba(255, 255, 255, 0.22);
  box-shadow       : 0 6px 12px rgba(0, 0, 0, 0.15),
                     0 2px 4px rgba(0, 0, 0, 0.30),
                     inset 0 1px 0 rgba(255, 255, 255, 0.12);
}

.pad-btn:hover .pad-glyph {
  color            : var(--pad-accent);
  text-shadow      : var(--pad-glow);
}

/* Pressed — sinks into the surface */
.pad-btn.is-pressed {
  background       : var(--pad-btn-press);
  border-color     : rgba(255, 255, 255, 0.32);
  transform        : translateY(0.5px);
  box-shadow : 0 1px 1px rgba(0, 0, 0, 0.30),
             inset 0 1px 3px rgba(0, 0, 0, 0.22);
}

.pad-btn.is-pressed .pad-glyph {
  color            : var(--pad-accent);
  text-shadow      : var(--pad-glow-press);
}

.pad-btn.is-pressed .pad-dir-label {
  color            : rgba(255, 255, 255, 0.60);
}

.pad-btn--tbd,
.pad-btn--inactive {
  opacity          : 0.22;
  cursor           : default;
  pointer-events   : none;
  box-shadow       : none;
}

/* ── Glyph + direction label ───────────────────────────────────────────────── */

.pad-glyph {
  font-size        : 13px;
  line-height      : 1;
  pointer-events   : none;
  color            : var(--pad-text);
  transition       : color 0.10s ease, text-shadow 0.10s ease;
}

.pad-dir-label {
  font-size        : 5.5px;
  color            : var(--pad-text-dim);
  text-transform   : uppercase;
  letter-spacing   : 0.05em;
  line-height      : 1;
  pointer-events   : none;
  white-space      : nowrap;
}

/* ── Center cell ───────────────────────────────────────────────────────────── */

.pad-center {
  display          : flex;
  align-items      : center;
  justify-content  : center;
  width            : var(--pad-cell);
  height           : var(--pad-cell);
  border-radius    : 50%;
  background       : rgba(255, 255, 255, 0.03);
  border           : 1px solid rgba(255, 255, 255, 0.07);
}

.pad-center-label {
  font-family      : var(--mono);
  font-size        : 7px;
  color            : var(--pad-text-dim);
  letter-spacing   : 0.10em;
}

/* ── TBD pad ───────────────────────────────────────────────────────────────── */

.omni-pad--tbd .pad-cross {
  opacity          : 0.38;
  pointer-events   : none;
}

/* ── Keyboard hint ─────────────────────────────────────────────────────────── */

.pad-keys {
  display          : flex;
  align-items      : center;
  justify-content  : center;
  gap              : 3px;
  flex-shrink      : 0;
}

.pad-keys-label {
  font-family      : var(--mono);
  font-size        : 6px;
  color            : var(--pad-text-dim);
  letter-spacing   : 0.08em;
  margin-right     : 2px;
}

.pad-key {
  display          : inline-flex;
  align-items      : center;
  justify-content  : center;
  font-family      : var(--mono);
  font-size        : 7px;
  min-width        : 14px;
  height           : 13px;
  padding          : 0 3px;
  color            : var(--pad-text-dim);
  border           : 1px solid rgba(255, 255, 255, 0.10);
  border-radius    : 3px;
  line-height      : 1;
  transition       : color 0.10s, border-color 0.10s, background 0.10s;
}

.pad-key.is-active {
  color            : var(--pad-accent);
  border-color     : rgba(255, 255, 255, 0.32);
  background       : rgba(255, 255, 255, 0.08);
}

/* ── Mobile ────────────────────────────────────────────────────────────────── */

@media (max-width: 460px) {
  .omni-pad {
    width          : 180px;
    height         : 180px;
    padding        : 16px;
    --pad-cell     : 36px;
  }
}

`

function injectStyles () {
  if (document.getElementById('omni-pad-styles')) return
  const tag = document.createElement('style')
  tag.id = 'omni-pad-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

// ── MovementPad class ─────────────────────────────────────────────────────────

export default class MovementPad {

  constructor (context) {
    this.ctx = context
    this._els    = {}
    this._btnEls = {}
    this._keyEls = {}
    this._visible = { omnihand: false, conscious: false, lh: false, rh: false }
    this._pressed = {
      lh:        { up: false, down: false, left: false, right: false },
      rh:        { up: false, down: false, left: false, right: false },
      omnihand:  { up: false, down: false, left: false, right: false },
      conscious: { up: false, down: false, left: false, right: false },
    }

    this._v3fwd   = new THREE.Vector3()
    this._v3right = new THREE.Vector3()
    this._worldUp = new THREE.Vector3(0, 1, 0)

    // WASD speed multiplier, driven by Admin's px/py/pz step setting —
    // "when the number is smaller I move more slowly on all axis, when
    // larger I move greater distances." Defaults to 1 (the average of
    // the default px/py/pz = 1/1/1) so existing behavior is completely
    // unchanged until the admin setting actually says otherwise.
    this._moveSpeedMultiplier = 1
    this._altitudeUpMultiplier = 1
    this._altitudeDownMultiplier = 1
    this._orbitVerticalMultiplier = 1
    this._orbitHorizontalMultiplier = 1

    // Dash — a manual on/off modifier layered ON TOP of the step-based
    // _moveSpeedMultiplier above, LH (WASD) movement only. Triples by
    // default (raised from 2x per direct request); the exact multiplier
    // is admin-configurable under DashMovementSettings in
    // ui/CameraMovementOptionsPanel.js, same storage key/broadcast
    // every other Admin-driven value here uses.
    this._dashActive     = false
    this._dashMultiplier = 3
    this._satEls         = { lh: {}, rh: {}, omnihand: {}, conscious: {} }

    // Released/detached pads — "released from its location so we can
    // move it around the space," one toggle per movable hand. The whole
    // cluster (cross + all 3 satellites) moves as one group via a shared
    // GSAP x/y offset from its docked position, not a re-parented DOM
    // container — simplest way to keep every element's own corner-anchor
    // CSS as the "home" position while still moving them together.
    // Persists across a reload (same browser/profile) by direct request;
    // a different user/machine starts docked, which is just ordinary
    // localStorage scoping, nothing extra needed. OmniCustomLayout is the
    // real cross-everything answer, noted for later, not built here.
    this._detached = { lh: false, rh: false, omnihand: false, conscious: false }
    this._detachOffset = {
      lh: { x: 0, y: 0 }, rh: { x: 0, y: 0 },
      omnihand: { x: 0, y: 0 }, conscious: { x: 0, y: 0 },
    }
    this._dragState = null

    // Dimensional axes (OmniHand / ConsciousHand) — set by main.js via
    // setDimensionalAxes(). Hold-to-repeat timers are keyed `${hand}-${dir}`.
    this._axes = null
    this._dimRepeat = {}

    // Rotation pivot for OmniKeys' center-pad camera rotation —
    // defaults to the same point OrbitControls itself defaults to
    // (0, 2, 0), so keyboard rotation and mouse-drag orbit agree on
    // "the center of the scene" until a node is selected, at which
    // point both switch to orbiting that node instead.
    this._rotationPivot = new THREE.Vector3(0, 2, 0)
    const ROTATE_STEP = Math.PI / 24   // 7.5° per press — deliberately not a module-level const, kept local to where it's used
    this._rotateStep = ROTATE_STEP
    this._pitchLimit = (85 * Math.PI) / 180   // stop just short of straight up/down — avoids the gimbal flip where left/right suddenly invert

    this._onPadToggle  = this._handlePadToggle.bind(this)
    this._onPadsGlobal = this._handlePadsGlobal.bind(this)
    this._onRadialToggle = this._handleRadialToggle.bind(this)
    this._onAdminSteps = this._handleAdminSteps.bind(this)
    this._onNodeSelected = this._handleNodeSelected.bind(this)
    this._onOmniKeysRotate = this._handleOmniKeysRotate.bind(this)
    this._onKeyDown    = this._handleKeyDown.bind(this)
    this._onBlur       = () => this._releaseAllDimensionPresses()
    this._onKeyUp      = this._handleKeyUp.bind(this)
    this._onDragMove   = this._handleDragMove.bind(this)
    this._onDragEnd    = this._handleDragEnd.bind(this)
  }

  init () {
    injectStyles()
    this._buildAllPads()
    this._buildAllSatelliteClusters()
    this._bindGlobalEvents()
    this._bindKeyboard()
    const initialAll = this._computeAllMultipliers(this._readAdminSteps())
    this._moveSpeedMultiplier = initialAll.move
    this._altitudeUpMultiplier = initialAll.altitudeUp
    this._altitudeDownMultiplier = initialAll.altitudeDown
    this._orbitVerticalMultiplier = initialAll.orbitVertical
    this._orbitHorizontalMultiplier = initialAll.orbitHorizontal
    this._readDashMultiplierFromStorage()
    this._restoreDetachState()
    console.log('⟐ MovementPad: initialized.')
  }

  update (delta) {
    const cam = this.ctx?.camera
    if (!cam) return
    this._lhCallCount = (this._lhCallCount || 0) + 1
    try {
      this._applyTranslateMovement(cam, delta, 'lh')
      this._lastLHError = null
    } catch (err) {
      // Surfaced on the Input Monitor panel — the goal is making an
      // otherwise console-only, invisible-on-mobile failure directly
      // readable on the phone screen itself.
      this._lastLHError = err.message
    }
    this._applyNavMovement(cam, delta, 'rh')
    // omnihand / conscious intentionally absent: they never move the camera.
  }

  destroy () {
    Object.values(this._els).forEach(el => el?.parentNode?.removeChild(el))
    Object.values(this._satEls).forEach(group =>
      Object.values(group).forEach(el => el?.parentNode?.removeChild(el)))
    window.removeEventListener('omni:pad-toggle',  this._onPadToggle)
    window.removeEventListener('omni:pads-global', this._onPadsGlobal)
    window.removeEventListener('omni:radial-toggle', this._onRadialToggle)
    window.removeEventListener('omni:admin-settings-saved', this._onAdminSteps)
    window.removeEventListener('omni:node-selected', this._onNodeSelected)
    window.removeEventListener('omni:omnikeys-rotate', this._onOmniKeysRotate)
    window.removeEventListener('keydown',          this._onKeyDown)
    window.removeEventListener('keyup',            this._onKeyUp)
    window.removeEventListener('blur',             this._onBlur)
    this._releaseAllDimensionPresses()
    window.removeEventListener('pointermove', this._onDragMove)
    window.removeEventListener('pointerup',   this._onDragEnd)
  }

  setVisible (handId, visible) {
    if (!this._els[handId]) return
    if (this._visible[handId] === visible) return
    this._visible[handId] = visible
    visible ? this._animateIn(handId) : this._animateOut(handId)
  }

  setAllVisible (visible) {
    Object.keys(this._els).forEach(id => this.setVisible(id, visible))
  }

  /** Connects the OmniHand / ConsciousHand pads to the dimensional-axis
   *  system (systems/OmniDimensionalAxes.js). Until this is called their
   *  buttons still light up but do nothing. */
  setDimensionalAxes (axes) {
    this._axes = axes
  }

  // ── DOM construction ────────────────────────────────────────────────────────

  _buildAllPads () {
    const shell = document.getElementById('omni-ui') ?? document.body
    Object.keys(PAD_CONFIGS).forEach(handId => {
      if (this._els[handId]) return   // already built — init() can run twice (base.addModule calls it again after the manual call in main.js), this must not create a duplicate, invisible pad with a duplicate DOM id every time
      const el = this._buildPad(handId)
      this._els[handId] = el
      shell.appendChild(el)
    })
  }

  /** The 3-button satellite cluster (Release / Dash / TBD) on each
   *  movable pad's own rim — see _SAT_GEOM above for the arc math.
   *  Own top-level fixed elements, same sibling-of-the-pad approach
   *  MovementPad already used for the old standalone dash button, so
   *  moving them together with the pad (see _setDetached) is just
   *  applying the same GSAP offset to all of them, no DOM nesting. */
  _buildAllSatelliteClusters () {
    Object.keys(PAD_CONFIGS)
      .filter(id => PAD_CONFIGS[id].movable)
      .forEach(handId => {
        if (Object.keys(this._satEls[handId]).length) return // double-init guard, matches _buildAllPads
        this._buildSatelliteCluster(handId)
      })
  }

  _buildSatelliteCluster (handId) {
    const shell = document.getElementById('omni-ui') ?? document.body
    const specs = {
      release: { glyph: '⏏', title: 'Release — detach this pad into a free-floating panel', label: 'Release pad from its docked position' },
      dash:    { glyph: '⟫⟫', title: 'Dash (multiplies LH movement speed)', label: 'Toggle dash' },
      undefined: { glyph: '—', title: 'Reserved — not yet assigned', label: 'Reserved, not yet assigned' },
    }
    Object.entries(specs).forEach(([role, spec]) => {
      const el = document.createElement('button')
      el.id        = `omni-pad-sat-${handId}-${role}`
      el.className = `omni-pad-sat omni-pad-sat--${handId}-${role}`
      el.type      = 'button'
      el.title     = spec.title
      el.setAttribute('aria-label', spec.label)
      if (role !== 'undefined') el.setAttribute('aria-pressed', 'false')
      el.innerHTML = `<span class="sat-glyph">${spec.glyph}</span>`
      if (role === 'release') el.addEventListener('click', () => this._toggleDetach(handId))
      if (role === 'dash' && handId === 'lh') el.addEventListener('click', () => this.toggleDash())
      // RH/OmniHand/ConsciousHand's own Dash slots exist for visual
      // mirror symmetry only — dash is specifically an LH (WASD) speed
      // modifier, not a real control on any other hand, so they stay
      // inert (no handler, read as reserved). Release, by contrast, is
      // wired for every movable hand — full parity is the whole point
      // of giving OmniHand/ConsciousHand real pads at all.
      shell.appendChild(el)
      this._satEls[handId][role] = el
      if (role === 'dash' && handId === 'lh') this._dashButtonEl = el
    })
  }

  toggleDash (force) {
    this._dashActive = typeof force === 'boolean' ? force : !this._dashActive
    this._dashButtonEl?.classList.toggle('is-active', this._dashActive)
    this._dashButtonEl?.setAttribute('aria-pressed', String(this._dashActive))
  }

  // ── Detach / release ─────────────────────────────────────────────────────────

  /** All elements belonging to one pad's group — the cross itself plus
   *  its 3 satellites — moved together as a unit whenever it's dragged
   *  or snapped back. */
  _groupEls (handId) {
    return [this._els[handId], ...Object.values(this._satEls[handId] ?? {})].filter(Boolean)
  }

  _toggleDetach (handId) {
    this._setDetached(handId, !this._detached[handId], true)
  }

  _setDetached (handId, detached, animate) {
    this._detached[handId] = detached
    const padEl = this._els[handId]
    const satEls = this._satEls[handId]
    padEl?.classList.toggle('is-detached', detached)
    Object.values(satEls ?? {}).forEach(el => el?.classList.toggle('is-detached', detached))
    satEls?.release?.setAttribute('aria-pressed', String(detached))
    // Real fix (bug-squash pass) — this only ever set aria-pressed
    // (screen-reader-only, invisible on screen) and never the actual
    // .is-active glow class Dash's own toggleDash() applies to itself.
    // The pad's own is-detached box-shadow bump is subtle enough that
    // clicking Release genuinely looked like it did nothing — this
    // gives Release the same unmistakable lit-up feedback Dash has.
    satEls?.release?.classList.toggle('is-active', detached)

    if (!detached) {
      this._detachOffset[handId] = { x: 0, y: 0 }
      const els = this._groupEls(handId)
      if (animate) {
        gsap.to(els, { x: 0, y: 0, duration: 0.28, ease: 'power2.out' })
      } else {
        gsap.set(els, { x: 0, y: 0 })
      }
    }
    this._persistDetachState()
  }

  /** Drag handle is each pad's own header — the small abbr/mode-label
   *  strip at the top. Direction buttons and satellites keep their own
   *  press behavior; only the header becomes grabbable, and only once
   *  the pad is actually detached (same gating Panel.js uses for its
   *  own attach()/_bindDrag — docked pads are never draggable). */
  _bindPadDrag (handId, headerEl) {
    headerEl.style.pointerEvents = 'auto'
    headerEl.addEventListener('pointerdown', (e) => {
      if (!this._detached[handId]) return
      e.preventDefault()
      this._dragState = {
        handId,
        startX: e.clientX,
        startY: e.clientY,
        startOffset: { ...this._detachOffset[handId] },
      }
      window.addEventListener('pointermove', this._onDragMove)
      window.addEventListener('pointerup',   this._onDragEnd)
    })
  }

  _handleDragMove (e) {
    const d = this._dragState
    if (!d) return
    const offset = {
      x: d.startOffset.x + (e.clientX - d.startX),
      y: d.startOffset.y + (e.clientY - d.startY),
    }
    this._detachOffset[d.handId] = offset
    gsap.set(this._groupEls(d.handId), { x: offset.x, y: offset.y })
  }

  _handleDragEnd () {
    if (!this._dragState) return
    this._dragState = null
    window.removeEventListener('pointermove', this._onDragMove)
    window.removeEventListener('pointerup',   this._onDragEnd)
    this._persistDetachState()
  }

  _persistDetachState () {
    try {
      const data = {}
      Object.keys(PAD_CONFIGS)
        .filter(id => PAD_CONFIGS[id].movable)
        .forEach(handId => {
          data[handId] = { detached: this._detached[handId], offset: this._detachOffset[handId] }
        })
      localStorage.setItem('omni:movementpad:detach', JSON.stringify(data))
    } catch (_) {}
  }

  /** Reload-persistent by direct request; a different user/machine
   *  starts docked since this is plain localStorage, nothing extra
   *  needed for that half of the ask. Cross-everything save is the
   *  future OmniCustomLayout feature, not this. Now covers all four
   *  movable hands, not just LH/RH, now that OmniHand/ConsciousHand
   *  are real, detachable pads too. */
  _restoreDetachState () {
    let data = null
    try {
      data = JSON.parse(localStorage.getItem('omni:movementpad:detach') ?? 'null')
    } catch (_) { data = null }
    if (!data) return
    Object.keys(PAD_CONFIGS)
      .filter(id => PAD_CONFIGS[id].movable)
      .forEach(handId => {
        const saved = data[handId]
        if (!saved?.detached) return
        this._detachOffset[handId] = saved.offset ?? { x: 0, y: 0 }
        this._setDetached(handId, true, false)
        gsap.set(this._groupEls(handId), { x: this._detachOffset[handId].x, y: this._detachOffset[handId].y })
      })
  }

  _buildPad (handId) {
    const cfg   = PAD_CONFIGS[handId]
    const isTBD = !cfg.movable
    const el = document.createElement('div')
    el.id        = `omni-pad-${handId}`
    el.className = ['omni-pad', `omni-pad--${cfg.corner}`, isTBD ? 'omni-pad--tbd' : ''].filter(Boolean).join(' ')
    el.setAttribute('aria-label', `${cfg.abbr} movement pad`)
    el.setAttribute('role', 'group')
    const header = this._buildHeader(handId)
    el.appendChild(header)
    el.appendChild(this._buildCross(handId))
    if (cfg.keyboard) el.appendChild(this._buildKeyHint(handId))
    if (cfg.movable) this._bindPadDrag(handId, header)
    return el
  }

  _buildHeader (handId) {
    const cfg    = PAD_CONFIGS[handId]
    const header = document.createElement('div')
    header.className = 'pad-header'
    const abbr = document.createElement('span')
    abbr.className   = 'pad-abbr'
    abbr.textContent = cfg.abbr
    const sep = document.createElement('span')
    sep.className   = 'pad-abbr'
    sep.textContent = '·'
    const modeLabel = document.createElement('span')
    modeLabel.className   = 'pad-mode-label'
    modeLabel.textContent = cfg.modeLabel
    header.appendChild(abbr)
    header.appendChild(sep)
    header.appendChild(modeLabel)
    return header
  }

  _buildCross (handId) {
    const cross = document.createElement('div')
    cross.className = 'pad-cross'
    const layout = ['empty','up','empty','left','center','right','empty','down','empty']
    this._btnEls[handId] = {}
    layout.forEach(slot => {
      let cell
      if (slot === 'empty') {
        cell = document.createElement('div')
        cell.className = 'pad-slot-empty'
      } else if (slot === 'center') {
        cell = this._buildCenter(handId)
      } else {
        cell = this._buildDirBtn(handId, slot)
        this._btnEls[handId][slot] = cell
      }
      cross.appendChild(cell)
    })
    return cross
  }

  _buildDirBtn (handId, dir) {
    const cfg   = PAD_CONFIGS[handId]
    const isTBD = !cfg.movable
    const label = cfg.dirLabels?.[dir] ?? DIR_GLYPHS[dir]
    const btn   = document.createElement('button')
    btn.className = ['pad-btn', `pad-btn--${dir}`, isTBD ? 'pad-btn--tbd' : ''].filter(Boolean).join(' ')
    btn.dataset.hand = handId
    btn.dataset.dir  = dir
    if (!isTBD) btn.setAttribute('aria-label', `${dir}: ${label}`)
    btn.innerHTML = `<span class="pad-glyph">${DIR_GLYPHS[dir]}</span><span class="pad-dir-label">${label}</span>`

    if (!isTBD) {
      btn.addEventListener('contextmenu', (e) => e.preventDefault())
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault()
        this._setPressed(handId, dir, true)
        // Pointer capture is a nice-to-have (keeps drag-release working
        // if the pointer moves off the button) — it must never be able
        // to block the actual movement command above if it fails for
        // any reason.
        try { btn.setPointerCapture(e.pointerId) } catch (_) {}
      })
      btn.addEventListener('pointerup',     () => this._setPressed(handId, dir, false))
      btn.addEventListener('pointercancel', () => this._setPressed(handId, dir, false))
      btn.addEventListener('pointerleave',  (e) => { if (e.buttons === 0) this._setPressed(handId, dir, false) })
    }
    return btn
  }

  _buildCenter (handId) {
    const cfg    = PAD_CONFIGS[handId]
    const center = document.createElement('div')
    center.className = 'pad-center'
    if (cfg.centerLabel) {
      const lbl = document.createElement('span')
      lbl.className   = 'pad-center-label'
      lbl.textContent = cfg.centerLabel
      center.appendChild(lbl)
    }
    return center
  }

  _buildKeyHint (handId) {
    const strip = document.createElement('div')
    strip.className = 'pad-keys'
    const lbl = document.createElement('span')
    lbl.className   = 'pad-keys-label'
    lbl.textContent = 'KB'
    strip.appendChild(lbl)
    // Keyed by PAD_CONFIGS[handId].keyboard — one entry per real
    // keyboard scheme this pad responds to (see _mapKey for the
    // matching e.code bindings). OmniHand/ConsciousHand's own schemes
    // use free Numpad keys, since Numpad1-4 are already the app's
    // hand-menu shortcuts (main.js's HAND_KEY_BINDINGS).
    const HINTS = {
      wasd:            { keys: ['W', 'A', 'S', 'D'], dirs: ['up', 'left', 'down', 'right'] },
      rf:              { keys: ['R', 'F'],           dirs: ['up', 'down'] },
      'omnihand-axes': { keys: ['/', '*', '-', '+'],       dirs: ['up', 'down', 'left', 'right'] },
      'conscious-axes': { keys: ['N7', 'N9', 'N5', 'N6'],  dirs: ['up', 'down', 'left', 'right'] },
    }
    const hint = HINTS[PAD_CONFIGS[handId].keyboard] ?? { keys: [], dirs: [] }
    const { keys, dirs } = hint
    this._keyEls[handId] = {}
    keys.forEach((k, i) => {
      const span = document.createElement('span')
      span.className   = 'pad-key'
      span.textContent = k
      strip.appendChild(span)
      this._keyEls[handId][dirs[i]] = span
    })
    return strip
  }

  // ── Animations ──────────────────────────────────────────────────────────────

  _animateIn (handId) {
    const el = this._els[handId]
    if (!el) return
    gsap.killTweensOf(el)
    el.style.pointerEvents = 'auto'
    gsap.fromTo(el,
      { opacity: 0, scale: 0.80 },
      { opacity: 1, scale: 1, duration: 0.24, ease: 'back.out(1.8)',
        onComplete () { el.style.transform = '' } }
    )
    this._animateSatellitesIn(handId)
  }

  _animateOut (handId) {
    const el = this._els[handId]
    if (!el) return
    gsap.killTweensOf(el)
    gsap.to(el, {
      opacity: 0, scale: 0.82, duration: 0.16, ease: 'power2.in',
      onComplete: () => {
        el.style.pointerEvents = 'none'
        el.style.transform = ''
        if (this._pressed[handId]) DIRS.forEach(d => this._setPressed(handId, d, false, true))
      }
    })
    this._animateSatellitesOut(handId)
  }

  /** Satellites (Release/Dash/reserved) now come out and retract WITH
   *  their own pad — direct request: "put it so that the 3 buttons...
   *  come out when the movement pads come out." Same fromTo/to shape
   *  and timing as the pad's own _animateIn/_animateOut, just applied
   *  to each satellite button individually since they're independent
   *  top-level elements, not children of the pad. The reserved/
   *  "undefined" slot settles at its own dimmed 0.30 opacity instead
   *  of 1 — matching `.omni-pad-sat--undefined`'s existing look — and
   *  never gets pointer-events, same as it always has. */
  _animateSatellitesIn (handId) {
    const group = this._satEls[handId] ?? {}
    Object.entries(group).forEach(([role, sat]) => {
      if (!sat) return
      gsap.killTweensOf(sat)
      if (role !== 'undefined') sat.style.pointerEvents = 'auto'
      const targetOpacity = role === 'undefined' ? 0.30 : 1
      gsap.fromTo(sat,
        { opacity: 0, scale: 0.80 },
        { opacity: targetOpacity, scale: 1, duration: 0.22, ease: 'back.out(1.8)' }
      )
    })
  }

  _animateSatellitesOut (handId) {
    const group = this._satEls[handId] ?? {}
    Object.values(group).forEach(sat => {
      if (!sat) return
      gsap.killTweensOf(sat)
      gsap.to(sat, {
        opacity: 0, scale: 0.82, duration: 0.16, ease: 'power2.in',
        onComplete: () => { sat.style.pointerEvents = 'none' }
      })
    })
  }

  // ── Press state ─────────────────────────────────────────────────────────────

  _setPressed (handId, dir, active, silent = false) {
    const state = this._pressed[handId]
    if (!state) return
    if (state[dir] === active) return
    state[dir] = active
    this._btnEls[handId]?.[dir]?.classList.toggle('is-pressed', active)
    this._keyEls[handId]?.[dir]?.classList.toggle('is-active',  active)
    if (PAD_CONFIGS[handId]?.dimensional) {
      // Axis pads: never dispatch omni:movement (main.js uses it to disable
      // OrbitControls and re-sync the orbit target, which is camera business).
      // Runs even when `silent`, so a silent release still clears its timer.
      this._handleDimensionPress(handId, dir, active)
      return
    }
    if (!silent) {
      window.dispatchEvent(new CustomEvent('omni:movement', {
        detail: { hand: handId, direction: dir, active, mode: (handId === 'rh' || handId === 'conscious') ? 'nav' : 'wasd' }
      }))
    }
  }

  // ── Dimensional axes (OmniHand / ConsciousHand) ─────────────────────────────

  /** Press = one step along the axis immediately; holding repeats. The axis
   *  system tweens each step smoothly, so repeats chain into continuous travel. */
  _handleDimensionPress (handId, dir, active) {
    const key = `${handId}-${dir}`
    if (this._dimRepeat[key]) {
      clearInterval(this._dimRepeat[key])
      delete this._dimRepeat[key]
    }
    if (!active) return
    this._axes?.step(handId, dir)
    this._dimRepeat[key] = setInterval(() => this._axes?.step(handId, dir), HOLD_REPEAT_MS)
  }

  _releaseAllDimensionPresses () {
    Object.keys(PAD_CONFIGS).filter(id => PAD_CONFIGS[id].dimensional).forEach(handId => {
      DIRS.forEach(d => this._setPressed(handId, d, false, true))
    })
    Object.values(this._dimRepeat).forEach(t => clearInterval(t))
    this._dimRepeat = {}
  }

  // ── Camera movement ─────────────────────────────────────────────────────────

  /** LH's translate-move logic. Still parameterized by handId from V150, but
   *  as of V158 only 'lh' calls it — OmniHand no longer moves the camera.
   *  Dash is an LH-exclusive modifier (OmniHand/RH Dash slots are inert). */
  _applyTranslateMovement (cam, delta, handId) {
    const p = this._pressed[handId]
    if (!p.up && !p.down && !p.left && !p.right) return
    const dashMult = handId === 'lh' && this._dashActive ? this._dashMultiplier : 1
    const speed = MOVE_SPEED * this._moveSpeedMultiplier * dashMult * delta
    cam.getWorldDirection(this._v3fwd)
    this._v3fwd.y = 0

    // The actual bug: looking near-straight up/down makes the
    // horizontal component of "forward" collapse toward zero — this
    // used to just return here, doing nothing at all, silently
    // freezing WASD. Right hand's movement never depended on camera
    // facing in the first place, which is exactly why only left hand
    // was ever vulnerable to this. Falls back to the last known-good
    // horizontal direction instead of stopping — movement keeps
    // working, just doesn't re-derive a direction from a currently
    // degenerate one.
    if (this._v3fwd.lengthSq() < 0.0001) {
      if (!this._lastValidFwd) return   // truly no prior direction exists yet (e.g. very first frame) — nothing sensible to fall back to
      this._v3fwd.copy(this._lastValidFwd)
    } else {
      this._v3fwd.normalize()
      if (!this._lastValidFwd) this._lastValidFwd = new THREE.Vector3()
      this._lastValidFwd.copy(this._v3fwd)
    }

    this._v3right.crossVectors(this._v3fwd, this._worldUp).normalize()
    if (p.up)    cam.position.addScaledVector(this._v3fwd,    speed)
    if (p.down)  cam.position.addScaledVector(this._v3fwd,   -speed)
    if (p.right) cam.position.addScaledVector(this._v3right,  speed)
    if (p.left)  cam.position.addScaledVector(this._v3right, -speed)
  }

  /** RH's altitude+yaw logic. Still parameterized by handId from V150, but
   *  as of V158 only 'rh' calls it — ConsciousHand no longer moves the camera. */
  _applyNavMovement (cam, delta, handId) {
    const p = this._pressed[handId]
    if (!p.up && !p.down && !p.left && !p.right) return

    if (p.up)   cam.position.y += MOVE_SPEED * this._altitudeUpMultiplier * delta
    if (p.down) cam.position.y -= MOVE_SPEED * this._altitudeDownMultiplier * delta

    if (p.left || p.right) {
      const angle = (p.right ? -1 : 1) * YAW_SPEED * this._orbitHorizontalMultiplier * delta
      const cos   = Math.cos(angle)
      const sin   = Math.sin(angle)
      const x     = cam.position.x
      const z     = cam.position.z
      cam.position.x = x * cos - z * sin
      cam.position.z = x * sin + z * cos
      cam.lookAt(0, cam.position.y, 0)
    }
  }

  // ── Keyboard ────────────────────────────────────────────────────────────────

  _bindKeyboard () {
    window.addEventListener('keydown', this._onKeyDown)
    window.addEventListener('keyup',   this._onKeyUp)
    window.addEventListener('blur',    this._onBlur)
  }

  _handleKeyDown (e) {
    const tag = document.activeElement?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
    const mapped = this._mapKey(e.code)
    if (!mapped) return
    const { handId, dir } = mapped
    e.preventDefault()
    if (this._pressed[handId]?.[dir]) return
    this._setPressed(handId, dir, true)
  }

  _handleKeyUp (e) {
    const mapped = this._mapKey(e.code)
    if (!mapped) return
    this._setPressed(mapped.handId, mapped.dir, false)
  }

  _mapKey (code) {
    switch (code) {
      case 'KeyW': return { handId: 'lh', dir: 'up'    }
      case 'KeyS': return { handId: 'lh', dir: 'down'  }
      case 'KeyA': return { handId: 'lh', dir: 'left'  }
      case 'KeyD': return { handId: 'lh', dir: 'right' }
      case 'KeyR': return { handId: 'rh', dir: 'up'    }
      case 'KeyF': return { handId: 'rh', dir: 'down'  }
      case 'ArrowUp':    return { handId: 'rh', dir: 'up'    }
      case 'ArrowDown':  return { handId: 'rh', dir: 'down'  }
      case 'ArrowLeft':  return { handId: 'rh', dir: 'left'  }
      case 'ArrowRight': return { handId: 'rh', dir: 'right' }
      // OmniHand axis pad (V158: dimensional axes, not camera) — the numpad's
      // operator row, deliberately NOT Numpad1-4 (main.js's HAND_KEY_BINDINGS
      // for opening the hand menus). Same four keys as before, same four
      // positions: up/down = Υ tier, left/right = primary axis.
      case 'NumpadDivide':   return { handId: 'omnihand', dir: 'up'    }
      case 'NumpadMultiply': return { handId: 'omnihand', dir: 'down'  }
      case 'NumpadSubtract': return { handId: 'omnihand', dir: 'left'  }
      case 'NumpadAdd':      return { handId: 'omnihand', dir: 'right' }
      // ConsciousHand axis pad. Numpad7/9 kept as up/down (Υ scale degree);
      // Numpad5/6 added for left/right (primary axis) so the keyboard can
      // reach both axes. Numpad0 was avoided on purpose: main.js's '0'/'9'
      // domain-grid toggle matches e.key, so Numpad0 would fire it too.
      case 'Numpad7': return { handId: 'conscious', dir: 'up'    }
      case 'Numpad9': return { handId: 'conscious', dir: 'down'  }
      case 'Numpad5': return { handId: 'conscious', dir: 'left'  }
      case 'Numpad6': return { handId: 'conscious', dir: 'right' }
      default:     return null
    }
  }

  // ── Global events ───────────────────────────────────────────────────────────

  _bindGlobalEvents () {
    window.addEventListener('omni:pad-toggle',  this._onPadToggle)
    window.addEventListener('omni:pads-global', this._onPadsGlobal)
    window.addEventListener('omni:radial-toggle', this._onRadialToggle)
    window.addEventListener('omni:admin-settings-saved', this._onAdminSteps)
    window.addEventListener('omni:node-selected', this._onNodeSelected)
    window.addEventListener('omni:omnikeys-rotate', this._onOmniKeysRotate)
  }

  /** Switches the rotation pivot to whatever was just selected — "so
   *  they can orbit the reality they're working on" instead of always
   *  orbiting the world's center. getWorldPosition (not the raw saved
   *  data.position) matches the same lesson already learned fixing
   *  GoTo/TravelTo earlier — a mesh's actual current position, not its
   *  possibly-stale saved coordinates. Also keeps OrbitControls' own
   *  mouse-drag target in sync via the same event-bridge pattern
   *  already used for omni:orbit-disable/enable, so keyboard rotation
   *  and mouse orbit never disagree about what they're circling. */
  _handleNodeSelected (e) {
    const mesh = e.detail?.mesh
    if (!mesh) return
    mesh.getWorldPosition(this._rotationPivot)
    window.dispatchEvent(new CustomEvent('omni:orbit-target-set', {
      detail: { x: this._rotationPivot.x, y: this._rotationPivot.y, z: this._rotationPivot.z }
    }))
  }

  _handleOmniKeysRotate (e) {
    const direction = e.detail?.direction
    if (!direction || !this.ctx?.camera) return
    this._rotateAroundPivot(this.ctx.camera, direction)
  }

  /** The actual rotation: rotate the camera's offset from the pivot,
   *  then re-aim at the pivot — the same "rotate position, then
   *  lookAt" shape _applyRHMovement's existing yaw already uses, now
   *  generalized to (a) orbit a switchable pivot instead of a
   *  hardcoded origin, and (b) support vertical (pitch) rotation too,
   *  not just horizontal (yaw). */
  _rotateAroundPivot (cam, direction) {
    const offset = cam.position.clone().sub(this._rotationPivot)
    const radius = offset.length()
    if (radius < 0.0001) return   // camera is essentially AT the pivot — nothing meaningful to rotate around

    if (direction === 'left' || direction === 'right') {
      const angle = (direction === 'right' ? -1 : 1) * this._rotateStep * this._orbitHorizontalMultiplier
      offset.applyAxisAngle(this._worldUp, angle)
    } else {
      // Pitch — rotate around the camera's own "right" axis relative
      // to the pivot, clamped so it can't flip past straight up/down.
      const currentPitch = Math.asin(THREE.MathUtils.clamp(offset.y / radius, -1, 1))
      const delta = (direction === 'up' ? 1 : -1) * this._rotateStep * this._orbitVerticalMultiplier
      const nextPitch = THREE.MathUtils.clamp(currentPitch + delta, -this._pitchLimit, this._pitchLimit)
      const actualDelta = nextPitch - currentPitch
      if (Math.abs(actualDelta) < 0.0001) return   // already at the limit

      const horizontal = new THREE.Vector3(offset.x, 0, offset.z)
      const pitchAxis = horizontal.lengthSq() > 0.0001
        ? this._v3right.crossVectors(this._worldUp, horizontal).normalize()
        : new THREE.Vector3(1, 0, 0)   // degenerate case: already looking straight down/up
      offset.applyAxisAngle(pitchAxis, actualDelta)
    }

    cam.position.copy(this._rotationPivot).add(offset)
    cam.lookAt(this._rotationPivot)
  }

  /** Mirrors the exact pattern already used in OmniDraw.js / OmniInspector.js. */
  /** A step of 0, null, an empty string, or anything non-numeric
   *  doesn't make sense for either this field's original UI-increment
   *  purpose or its use here as a speed multiplier — falls back to 1
   *  rather than silently producing a multiplier of 0 (and therefore
   *  zero movement speed) if a stale or blanked value is sitting in
   *  storage from earlier testing. */
  _sanitizeStep (value) {
    const n = Number(value)
    return Number.isFinite(n) && n > 0 ? n : 1
  }

  _readAdminSteps () {
    const fallback = { px: 1, py: 1, pz: 1, altitudeUp: 1, altitudeDown: 1, orbitVertical: 1, orbitHorizontal: 1, globalSpeed: false, globalValue: 1 }
    try {
      const raw = localStorage.getItem('omni:admin:settings')
      const saved = raw ? JSON.parse(raw)?.steps : null
      // Migration: the old, combined "vertical"/"rotation" fields (pre-split)
      // become the starting point for their new, more granular replacements,
      // so anyone who already tuned those doesn't silently lose that tuning.
      const migrated = saved
        ? {
            altitudeUp: saved.altitudeUp ?? saved.vertical,
            altitudeDown: saved.altitudeDown ?? saved.vertical,
            orbitVertical: saved.orbitVertical ?? saved.rotation,
            orbitHorizontal: saved.orbitHorizontal ?? saved.rotation,
            ...saved,
          }
        : null
      const merged = migrated ? { ...fallback, ...migrated } : fallback
      return {
        px: this._sanitizeStep(merged.px),
        py: this._sanitizeStep(merged.py),
        pz: this._sanitizeStep(merged.pz),
        altitudeUp: this._sanitizeStep(merged.altitudeUp),
        altitudeDown: this._sanitizeStep(merged.altitudeDown),
        orbitVertical: this._sanitizeStep(merged.orbitVertical),
        orbitHorizontal: this._sanitizeStep(merged.orbitHorizontal),
        globalSpeed: !!merged.globalSpeed,
        globalValue: this._sanitizeStep(merged.globalValue),
      }
    } catch (_) { return fallback }
  }

  /** dashMultiplier lives at the top level of omni:admin:settings, NOT
   *  inside the nested `.steps` object _readAdminSteps() returns — read
   *  it directly here rather than through that helper. */
  _readDashMultiplierFromStorage () {
    try {
      const raw = localStorage.getItem('omni:admin:settings')
      const dashMultiplier = raw ? JSON.parse(raw)?.dashMultiplier : null
      if (typeof dashMultiplier === 'number' && dashMultiplier > 0) {
        this._dashMultiplier = dashMultiplier
      }
    } catch (_) {
      // falls back to the constructor default (2)
    }
  }

  /** "When the number is smaller I move more slowly on all axis, when
   *  larger I move greater distances" — one combined multiplier
   *  across all three axes, not a separate per-axis speed, matching
   *  how WASD itself moves (forward/right are already blends of
   *  world X/Z depending on camera facing, not distinct per-axis
   *  motions). Average of px/py/pz; at the default 1/1/1 this is
   *  exactly 1, so existing speed is unchanged until the setting
   *  actually moves.
   *
   *  Altitude and orbit speed are kept as four separate values
   *  (altitude-up, altitude-down, orbit-vertical, orbit-horizontal)
   *  per CAMERA_MOVEMENT_OPTIONS_DESIGN.md, rather than the two
   *  combined values used earlier — up/down and left/right may want
   *  to feel different from each other, same reasoning as WASD's own
   *  independent px/py/pz. Independent by default, same as those.
   *
   *  When globalSpeed is on, one shared value overrides all five
   *  (move + the four above) at once — a universal speed — rather
   *  than needing to change each independently. */
  _computeAllMultipliers (steps) {
    if (steps.globalSpeed) {
      return {
        move: steps.globalValue,
        altitudeUp: steps.globalValue,
        altitudeDown: steps.globalValue,
        orbitVertical: steps.globalValue,
        orbitHorizontal: steps.globalValue,
      }
    }
    return {
      move: (steps.px + steps.py + steps.pz) / 3,
      altitudeUp: steps.altitudeUp,
      altitudeDown: steps.altitudeDown,
      orbitVertical: steps.orbitVertical,
      orbitHorizontal: steps.orbitHorizontal,
    }
  }

  _handleAdminSteps (e) {
    // dashMultiplier lives at the top level of the saved settings object
    // (alongside `steps`, `theme`, etc.), not inside `steps` itself — see
    // ui/CameraMovementOptionsPanel.js's DashMovementSettings group.
    const dashMultiplier = e.detail?.dashMultiplier
    if (typeof dashMultiplier === 'number' && dashMultiplier > 0) {
      this._dashMultiplier = dashMultiplier
    }

    const steps = e.detail?.steps
    if (!steps) return
    const merged = { ...this._readAdminSteps(), ...steps }
    const sanitized = {
      px: this._sanitizeStep(merged.px),
      py: this._sanitizeStep(merged.py),
      pz: this._sanitizeStep(merged.pz),
      altitudeUp: this._sanitizeStep(merged.altitudeUp),
      altitudeDown: this._sanitizeStep(merged.altitudeDown),
      orbitVertical: this._sanitizeStep(merged.orbitVertical),
      orbitHorizontal: this._sanitizeStep(merged.orbitHorizontal),
      globalSpeed: !!merged.globalSpeed,
      globalValue: this._sanitizeStep(merged.globalValue),
    }
    const all = this._computeAllMultipliers(sanitized)
    this._moveSpeedMultiplier = all.move
    this._altitudeUpMultiplier = all.altitudeUp
    this._altitudeDownMultiplier = all.altitudeDown
    this._orbitVerticalMultiplier = all.orbitVertical
    this._orbitHorizontalMultiplier = all.orbitHorizontal
  }

  /** Fixes a real bug: RadialMenu shifts 200px toward screen-center
   *  (+250px up) when it opens — see its own _positionMenu — which
   *  lands directly in the path of each pad's "toward center" button
   *  (left hand's Right, right hand's Left). RadialMenu's container
   *  itself is pointer-events:none, but its individual .radial-item
   *  buttons are pointer-events:auto and sit at z-index 55, above this
   *  pad's default 41 — whichever one lands on the same pixel wins the
   *  click, silently swallowing it before the pad button ever sees it.
   *  Temporarily raising this hand's own pad above that z-index while
   *  its radial menu is open guarantees the pad stays clickable,
   *  without needing to chase exact pixel geometry that could shift
   *  again with any future style tweak. */
  _handleRadialToggle (e) {
    const { hand, visible } = e.detail ?? {}
    const el = this._els[hand]
    if (!el) return
    el.style.zIndex = visible ? '60' : ''
  }

  _handlePadToggle (e) {
    const { hand, visible } = e.detail ?? {}
    if (hand) this.setVisible(hand, visible)
  }

  _handlePadsGlobal (e) {
    const visible = e.detail?.visible ?? false
    Object.keys(PAD_CONFIGS)
      .filter(id => PAD_CONFIGS[id].movable)
      .forEach(id => this.setVisible(id, visible))
  }
}