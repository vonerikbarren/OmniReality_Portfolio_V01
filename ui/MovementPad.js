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
 * Satellite buttons (V165: FOUR per movable pad, on the pad's own rim)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   id: omni-pad-sat-${hand}-${role}, in this order along the arc:
 *     1 release   ⏏  detach the pad into a free-floating, draggable group (unchanged)
 *     2 speed     »  opens ui/HandSpeedPanel.js: slider 1.0x..25.0x, per hand, stored in
 *                    utils/OmniHandsSettings.js `speed`. Replaces the V150-V164 Dash toggle.
 *                    The systems follow the EASED value (utils/OmniHandSpeed.js, ~0.15 s):
 *                    lh translate, rh altitude/orbit, conscious/omnihand axis tween
 *                    durations ÷ speed and hold-repeat interval ÷ speed (>= 60 ms).
 *                    Lit (aria-pressed) while speed > 1.0x; the "×N" shows on the button.
 *     3 activate  the hand's FX. omnihand/conscious (◎): toggles that hand's dimensional
 *                    TUNNEL (systems/OmniAxinator.js; precedence off > pin > pad-follow).
 *                    lh/rh (✦): FIRES the current "ammo" behaviour at the target node
 *                    (systems/OmniHandAmmo.js). A small ammo chip beside it names the
 *                    current ammo; click / tap cycles (Shift+click: previous); "[" / "]"
 *                    cycle the last-touched lower hand. Both dispatch omni:hand-activate.
 *     4 settings  ⚙  toggles ⟐OmniHands on that hand's view (omni:nav-select
 *                    '⟐LogicalHand' | '⟐CreativeHand' | '⟐ConsciousHand' | '⟐OmniHand';
 *                    omni:hands-panel-close when it is already open on that hand).
 *   The V150-V164 inert "undefined" 3rd satellite is gone (replaced by activate).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Centre FIRE button (V168, lh and rh ONLY)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   The centre cell of the lh / rh cross is a real round button (id omni-pad-fire-${hand}):
 *   dispatches omni:hand-fire { hand } (systems/OmniFlowFire.js). lh fires the current flowchart
 *   ELEMENT KIND, rh displays the current PAYLOAD (utils/OmniPayloads.js); the glyph is lit
 *   ("ready") when there is something to fire (lh always, rh with a current payload; dim
 *   otherwise or when the flow master toggle is off) and the ammo name sits beneath it,
 *   truncated. Fires on click (mouse, touch, and Space / Enter while the button has focus; it is
 *   a real <button>, so no global key is bound and F / R / WASD / arrows are untouched). Pressed /
 *   held feedback while the pointer is down. omnihand / conscious keep their inert centre label:
 *   Fire is UNDEFINED for those two.
 *   Listens: omni:payload-changed / -current, omni:hands-settings-changed (elementKind),
 *   omni:flow-state, omni:flow-fire-master-changed, omni:hand-fire-feedback.
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
 *   omni:pad-redock   →  { hand }   (V163 ⟐OmniHands: snap a detached pad back to its dock)
 *   omni:hands-settings-changed (speed / ammo -> button + chip labels), omni:axinator-tunnel-visible /
 *   omni:axinator-list (Activation lit state), omni:hand-ammo-state / -feedback,
 *   omni:hands-panel-state (settings button lit state), omni:hand-speed-panel-state
 *   emits omni:pad-detach-state { hand, detached } on every detach/re-dock
 *   omni:pads-global  →  { visible }
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Events dispatched
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   omni:hand-activate     →  { hand }              (Activation satellite, all four hands)
 *   omni:hand-fire         →  { hand }              (V168: centre Fire button, lh / rh only)
 *   omni:hand-ammo-cycle   →  { hand, dir }         (ammo chip, [ ] keys)
 *   omni:nav-select        →  { item }              (settings satellite -> ⟐OmniHands view)
 *   omni:hands-panel-close →  {}                    (settings satellite, panel already on this hand)
 *   omni:movement  →  { hand, direction, active, mode }
 *                     (lh / rh only — the dimensional pads move no camera,
 *                      so they dispatch omni:dimension-state via the axes
 *                      system instead)
 */

import gsap from 'gsap'
import * as THREE from 'three'
import { getHandSetting, CHANGE_EVENT as HANDS_CHANGE_EVENT } from '../utils/OmniHandsSettings.js'
import { getCurrentPayload, CHANGED_EVENT as PAYLOAD_CHANGED, CURRENT_EVENT as PAYLOAD_CURRENT } from '../utils/OmniPayloads.js'
import { getEffectiveSpeed, stepSpeeds, repeatInterval } from '../utils/OmniHandSpeed.js'
import HandSpeedPanel, { HAND_NAMES, formatSpeed } from './HandSpeedPanel.js'
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
// FOUR buttons (V165: Release / Speed / Activate / Settings) sit on each movable pad's
// own circular rim, not inside its 3×3 cross. Clock angle θ is measured clockwise from
// 12 o'clock; (dx, dy) is the screen offset from the pad's own center (dx: +right,
// dy: +down), at radius R from that center.
//
// LH spans the 3–6 o'clock arc of its own circle (90°, 120°, 150°, 180°: a 30° step, so
// neighbouring buttons are 2·R·sin 15° ≈ 69 px apart on desktop / 57 px on mobile — more
// than the 40 / 34 px button size); RH mirrors it across the vertical axis (360 − θ),
// landing in 6–9 o'clock. Both clusters face inward-and-down. OmniHand / ConsciousHand
// (top corners) mirror that vertically (180 − θ): inward-and-UP, the straight-down 180°
// slot becoming straight-up 0°. Release stays nearest screen-center (90° / 270°) on all
// four. 180° / 0° is the farthest slot from Release and the one the V150 layout already
// used, so no slot reaches past the screen edge that the old layout did not.
const _SAT_ROLES = ['release', 'speed', 'activate', 'settings']
const _SAT_ANGLES = {
  lh:        { release: 90,  speed: 120, activate: 150, settings: 180 },
  rh:        { release: 270, speed: 240, activate: 210, settings: 180 },
  omnihand:  { release: 90,  speed: 60,  activate: 30,  settings: 0   },
  conscious: { release: 270, speed: 300, activate: 330, settings: 0   },
}
// V166 phone layout (<= 460px). The inward arcs above put each bottom pad's Release / Speed on
// top of the OTHER bottom pad's (two 180px pads leave a 22px gap, 111px-radius clusters reach
// the centre line), so on a phone the Speed buttons of the two pads sat on top of each other.
// Mobile therefore fans the four buttons over the arc facing the screen's vertical middle
// (above the bottom pads, below the top pads), 24 degrees apart, Release innermost as before.
// Mirror rules are unchanged: RH = 360 - LH, top hands = 180 - bottom hands.
const _SAT_ANGLES_MOBILE = {
  lh:        { release: 30,  speed: 6,   activate: 342, settings: 318 },
  rh:        { release: 330, speed: 354, activate: 18,  settings: 42  },
  omnihand:  { release: 150, speed: 174, activate: 198, settings: 222 },
  conscious: { release: 210, speed: 186, activate: 162, settings: 138 },
}
const _SAT_SIDE   = { lh: 'left', rh: 'right', omnihand: 'left', conscious: 'right' }
const _SAT_ANCHOR = { lh: 'bottom', rh: 'bottom', omnihand: 'top', conscious: 'top' }
const CHIP_W = 64
const CHIP_H = 16
const FIRE_HANDS = ['lh', 'rh']   // V168: the centre cell is the Fire button on these two only
const CHIP_HANDS = ['lh', 'rh']   // the ammo chip (beside Activate) exists on the two lower hands only

function _clockOffset (clockDeg, r) {
  const rad = (clockDeg * Math.PI) / 180
  return { dx: r * Math.sin(rad), dy: -r * Math.cos(rad) }
}

function _buildSatGeom (padHalf, satHalf, angles = _SAT_ANGLES, chipOutside = false) {
  const R = padHalf + PAD_OFFSET + satHalf
  const center = padHalf + 4 // pad's own left/right CSS offset is 4px
  const bottomBase = DOCK_H + HAND_WH + PAD_OFFSET + padHalf
  const topBase    = BAR_H  + HAND_WH + PAD_OFFSET + padHalf
  const out = {}
  Object.keys(angles).forEach(hand => {
    out[hand] = {}
    const side   = _SAT_SIDE[hand]
    const anchor = _SAT_ANCHOR[hand]
    // CSS offset of a box whose own center sits (dx, dy) from the pad center.
    const place = (dx, dy, halfW, halfH) => {
      // Left-anchored hands (dx>0 moves right → larger `left`); right-
      // anchored hands (dx>0 moves right → SMALLER `right`, so subtract).
      const d = side === 'left' ? (center + dx - halfW) : (center - dx - halfW)
      // Bottom-anchored hands: moving down (dy>0) means a SMALLER
      // `bottom` offset (closer to the screen's actual bottom edge).
      // Top-anchored hands: moving down means a LARGER `top` offset
      // (further from the screen's actual top edge) — opposite sign.
      const v = anchor === 'bottom' ? (bottomBase - dy - halfH) : (topBase + dy - halfH)
      return { d: Math.round(d), v: Math.round(v), side, anchor }
    }
    _SAT_ROLES.forEach(role => {
      const clockDeg = angles[hand][role]
      const { dx, dy } = _clockOffset(clockDeg, R)
      out[hand][role] = { ...place(dx, dy, satHalf, satHalf), dx, dy }
    })
    if (CHIP_HANDS.includes(hand)) {
      // The ammo chip sits directly BELOW the Activate button (both lower hands face down), nudged
      // outward away from the pad so it also clears the 180° Settings button. A 4 px gap keeps the
      // two boxes from touching.
      const a = out[hand].activate
      const rad = (angles[hand].activate * Math.PI) / 180
      const dx = a.dx + Math.sign(Math.sin(rad)) * 8
      // desktop: below Activate. Phone: ABOVE it (the phone arc is above the pad, so "below" would land on the pad's rim).
      const dy = chipOutside ? a.dy - satHalf - CHIP_H / 2 - 4 : a.dy + satHalf + CHIP_H / 2 + 4
      out[hand].chip = { ...place(dx, dy, CHIP_W / 2, CHIP_H / 2), dx, dy }
    }
  })
  return out
}

const _SAT_GEOM        = _buildSatGeom(110, 20) // desktop: 220px pad, 40px satellite buttons
const _SAT_GEOM_MOBILE = _buildSatGeom(90, 17, _SAT_ANGLES_MOBILE, true)  // mobile: 180px pad, 34px buttons, fanned toward screen middle

/** Test / tooling hook: the computed geometry, and the sizes it was built for. */
export const SAT_LAYOUT = {
  roles: _SAT_ROLES, angles: _SAT_ANGLES, chip: { w: CHIP_W, h: CHIP_H },
  desktop: { geom: _SAT_GEOM, padHalf: 110, satHalf: 20 },
  mobile:  { geom: _SAT_GEOM_MOBILE, padHalf: 90, satHalf: 17, angles: _SAT_ANGLES_MOBILE },
  barH: BAR_H, dockH: DOCK_H, handWH: HAND_WH, padOffset: PAD_OFFSET,
}

// V169: a top-anchored satellite's offset was measured from the screen top (BAR_H + hands banner + ...).
// It now rides --omni-top-stack (bar + ribbon + banner, utils/OmniLayout.js) so the ribbon and a hidden
// banner move it; the geometry numbers (SAT_LAYOUT) are unchanged, and the fallback equals the old value.
const _vCss = (g) => g.anchor === 'top'
  ? `calc(${g.v - BAR_H - HAND_WH}px + var(--omni-top-stack, ${BAR_H + HAND_WH}px))`
  : `${g.v}px`

const _satRules = (geom) => Object.keys(_SAT_ANGLES).map(hand => {
  const rules = _SAT_ROLES.map(role => {
    const g = geom[hand][role]
    return `.omni-pad-sat--${hand}-${role} { ${g.side}: ${g.d}px; ${g.anchor}: ${_vCss(g)}; }`
  })
  if (geom[hand].chip) {
    const g = geom[hand].chip
    rules.push(`.omni-pad-chip--${hand} { ${g.side}: ${g.d}px; ${g.anchor}: ${_vCss(g)}; }`)
  }
  return rules.join('\n')
}).join('\n')

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

.omni-pad--tl { top: calc(var(--omni-top-stack, ${BAR_H + HAND_WH}px) + ${PAD_OFFSET}px); left: 4px; transform-origin: top left; }
.omni-pad--tr { top: calc(var(--omni-top-stack, ${BAR_H + HAND_WH}px) + ${PAD_OFFSET}px); right: 4px; transform-origin: top right; }
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

/* ── Satellite cluster — Release / Speed / Activate / Settings, on each pad's own rim ──
   Position math (see _buildSatGeom above): LH spans the 3–6 o'clock arc of its own
   circle (the quadrant facing inward/down, toward screen center), RH mirrors it across
   6–9 o'clock, the top hands mirror that vertically — one consistent idea on every
   corner rather than four unrelated layouts.                                      */

.omni-pad-sat {
  position         : fixed;
  width            : 40px;
  height           : 40px;
  display          : flex;
  flex-direction   : column;
  align-items      : center;
  justify-content  : center;
  gap              : 0;
  background       : rgba(8, 8, 12, 0.20);
  border           : 1px solid rgba(255, 255, 255, 0.85);
  border-radius    : 8px;
  color            : rgba(255, 255, 255, 0.90);
  font-size        : 13px;
  line-height      : 1;
  letter-spacing   : 0.02em;
  cursor           : pointer;
  /* V166: none at rest. A closed pad's satellites are opacity 0; with auto they were
     invisible hit targets (GSAP's inline style flips this to auto while the pad is open
     and back to none once the retract finishes). */
  pointer-events   : none;
  padding          : 0;
  /* Rest state — hidden until its own pad is toggled visible. _animateSatellitesIn/Out
     fade this to 1 and back via GSAP, mirroring the pad's own opacity choreography. */
  opacity          : 0;
  /* Strictly above the pad (.omni-pad is 41): a square button's corner can dip a few px
     inside the pad's bounding circle at a diagonal slot and would otherwise eat clicks
     (V151). V166: 47 — above the minimap (42; same value + later DOM order covered the
     ConsciousHand ⚙ button), the hand wrappers (43) and the drawers (44/45); below the
     tooltips / dock (50) and every WindowManager panel (those start at z 200 by design, so
     a floating panel such as the Inspector, which auto-opens over x 202-542 when a node is
     selected, still covers the left pads' Release / Speed buttons — drag it away). */
  z-index          : 47;
  font-family      : 'Courier New', Courier, monospace;
  transition       : background 120ms ease, color 120ms ease, box-shadow 120ms ease, opacity 120ms ease;
}
.omni-pad-sat:hover   { background: rgba(255, 255, 255, 0.13); }
.omni-pad-sat:active  { background: rgba(255, 255, 255, 0.26); }
.omni-pad-sat:focus-visible { outline: 2px solid rgba(255, 255, 255, 0.9); outline-offset: 2px; }
.omni-pad-sat.is-active {
  background       : rgba(255, 255, 255, 0.26);
  color            : rgba(255, 255, 255, 0.96);
  box-shadow       : 0 0 14px rgba(255, 255, 255, 0.40);
  text-shadow      : 0 0 10px rgba(255, 255, 255, 0.22);
}
.omni-pad-sat .sat-glyph { pointer-events: none; }
.omni-pad-sat .sat-sub   { pointer-events: none; font-size: 8px; margin-top: 2px; opacity: 0.85; }
/* "No target" / "blocked" / "empty magazine" — a brief red pulse on Activate (V165). */
.omni-pad-sat.is-nope { animation: pad-sat-nope 0.5s ease; }
.omni-pad-sat.is-fired { animation: pad-sat-fired 0.35s ease; }
@keyframes pad-sat-nope {
  0%, 100% { box-shadow: none; }
  30%      { box-shadow: 0 0 0 2px rgba(255, 110, 110, 0.95), 0 0 14px rgba(255, 110, 110, 0.6); }
}
@keyframes pad-sat-fired {
  0%   { box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.9); }
  100% { box-shadow: 0 0 0 12px rgba(255, 255, 255, 0); }
}

/* Ammo chip (lh / rh): the current behaviour, beside the Activate button. */
.omni-pad-chip {
  position         : fixed;
  width            : ${CHIP_W}px;
  height           : ${CHIP_H}px;
  box-sizing       : border-box;
  padding          : 0 4px;
  display          : block;
  background       : rgba(8, 8, 12, 0.55);
  border           : 1px solid rgba(255, 255, 255, 0.70);
  border-radius    : 8px;
  color            : rgba(255, 255, 255, 0.92);
  font-family      : 'Courier New', Courier, monospace;
  font-size        : 9px;
  line-height      : ${CHIP_H - 2}px;
  text-align       : center;
  white-space      : nowrap;
  overflow         : hidden;
  text-overflow    : ellipsis;
  cursor           : pointer;
  pointer-events   : none;   /* V166: see .omni-pad-sat (inline auto while the pad is open) */
  opacity          : 0;
  z-index          : 47;
  -webkit-tap-highlight-color: transparent;
}
.omni-pad-chip:hover { background: rgba(255, 255, 255, 0.18); }
.omni-pad-chip:focus-visible { outline: 2px solid rgba(255, 255, 255, 0.9); outline-offset: 1px; }

${_satRules(_SAT_GEOM)}

@media (max-width: 460px) {
  .omni-pad-sat { width: 34px; height: 34px; font-size: 11px; }
  .omni-pad-sat .sat-sub { font-size: 7px; margin-top: 1px; }
  ${_satRules(_SAT_GEOM_MOBILE).replace(/\n/g, '\n  ')}
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

/* ── Centre FIRE button (V168, lh / rh) ────────────────────────────────────── */

.pad-center.pad-fire {
  place-self       : center;
  box-sizing       : border-box;
  width            : calc(var(--pad-cell) + 4px);
  height           : calc(var(--pad-cell) + 4px);
  margin           : -2px;
  padding          : 0;
  display          : flex;
  flex-direction   : column;
  align-items      : center;
  justify-content  : center;
  gap              : 1px;
  background       : radial-gradient(circle at 50% 38%, rgba(255,255,255,0.10), rgba(255,255,255,0.03) 70%);
  border           : 1.5px solid rgba(255, 255, 255, 0.45);
  color            : var(--pad-text);
  font-family      : var(--mono);
  cursor           : pointer;
  outline          : none;
  position         : relative;
  touch-action     : none;
  -webkit-tap-highlight-color: transparent;
  box-shadow       : 0 2px 4px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.08);
  transition       : background 0.10s ease, border-color 0.10s ease, box-shadow 0.12s ease, transform 0.08s ease, opacity 0.12s ease;
}
.pad-fire .pad-fire-glyph { font-size: 15px; line-height: 1; pointer-events: none; color: rgba(255,255,255,0.55); transition: color 0.12s, text-shadow 0.12s; }
.pad-fire .pad-fire-ammo  {
  font-size: 6px; line-height: 1; letter-spacing: 0.02em; max-width: 36px; overflow: hidden; text-overflow: ellipsis;
  white-space: nowrap; pointer-events: none; color: var(--pad-text-dim);
}
.pad-fire.is-ready { border-color: rgba(255, 255, 255, 0.95); box-shadow: 0 0 12px rgba(255,255,255,0.35), 0 2px 4px rgba(0,0,0,0.30), inset 0 0 8px rgba(255,255,255,0.14); }
.pad-fire.is-ready .pad-fire-glyph { color: #fff; text-shadow: 0 0 10px rgba(255,255,255,0.8); }
.pad-fire.is-empty { opacity: 0.5; border-style: dashed; }
.pad-fire:hover { background: radial-gradient(circle at 50% 38%, rgba(255,255,255,0.22), rgba(255,255,255,0.08) 70%); }
.pad-fire:focus-visible { outline: 2px solid rgba(255, 255, 255, 0.9); outline-offset: 2px; }
.pad-fire.is-pressed {
  background: rgba(255,255,255,0.30); transform: scale(0.94);
  box-shadow: 0 0 18px rgba(255,255,255,0.55), inset 0 2px 5px rgba(0,0,0,0.30);
}
.pad-fire.is-fired { animation: pad-fire-fired 0.4s ease; }
.pad-fire.is-nope  { animation: pad-fire-nope 0.5s ease; }
@keyframes pad-fire-fired {
  0%   { box-shadow: 0 0 0 0 rgba(255,255,255,0.9), 0 0 12px rgba(255,255,255,0.35); }
  100% { box-shadow: 0 0 0 14px rgba(255,255,255,0), 0 0 12px rgba(255,255,255,0.35); }
}
@keyframes pad-fire-nope {
  0%, 100% { box-shadow: none; }
  30%      { box-shadow: 0 0 0 2px rgba(255,110,110,0.95), 0 0 14px rgba(255,110,110,0.6); }
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

    // V165: the V150-V164 Dash toggle (and its admin dashMultiplier) is gone. Speed is the
    // per-hand slider (ui/HandSpeedPanel.js) and is applied as getEffectiveSpeed(hand)
    // x the admin step multiplier above — composed once, never twice. The eased value is
    // advanced once per frame in update().
    this._satEls         = { lh: {}, rh: {}, omnihand: {}, conscious: {} }
    this._chipEls        = { lh: null, rh: null }
    this._speedPanel     = new HandSpeedPanel()
    this._tunnelOn       = { conscious: false, omnihand: false }   // Activation lit state (mirrors the tunnel)
    this._ammoActive     = { lh: 0, rh: 0 }                        // hand-fired behaviours currently held
    this._handsPanel     = { open: false, hand: null }             // ⟐OmniHands state (settings button lit state)
    this._ammoHand       = 'lh'                                    // which lower hand [ ] cycle
    this._fireEls        = {}                                      // V168: centre Fire buttons (lh / rh)
    this._flowOn         = true                                    // flow master toggle (omni:flow-fire-master-changed)
    try { this._flowOn = localStorage.getItem('omni:flow-fire-master-v1') !== '0' } catch (_) {}

    // Released/detached pads — "released from its location so we can
    // move it around the space," one toggle per movable hand. The whole
    // cluster (cross + all 4 satellites + ammo chip) moves as one group via a shared
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
    this._onPadRedock  = (e) => { const h = e.detail?.hand; if (PAD_CONFIGS[h]?.movable && this._detached[h]) this._setDetached(h, false, true) }
    this._onRadialToggle = this._handleRadialToggle.bind(this)
    this._onAdminSteps = this._handleAdminSteps.bind(this)
    this._onHandSetting = (e) => this._handleHandSetting(e)
    this._onTunnelVisible = (e) => {
      const d = e.detail ?? {}
      if (d.id in this._tunnelOn) { this._tunnelOn[d.id] = !!d.visible; this._refreshActivate(d.id) }
    }
    this._onAxinatorList = (e) => (e.detail?.tunnels ?? []).forEach(t => {
      if (t.id in this._tunnelOn) { this._tunnelOn[t.id] = !!t.visible; this._refreshActivate(t.id) }
    })
    this._onAmmoState = (e) => {
      const d = e.detail ?? {}
      if (d.hand in this._ammoActive) { this._ammoActive[d.hand] = (d.active ?? []).length; this._refreshActivate(d.hand); this._refreshChip(d.hand) }
    }
    this._onAmmoFeedback = (e) => this._handleAmmoFeedback(e.detail ?? {})
    this._onFireRefresh = () => FIRE_HANDS.forEach(h => this._refreshFire(h))
    this._onFireMaster = (e) => { this._flowOn = !!e.detail?.enabled; this._onFireRefresh() }
    this._onFireFeedback = (e) => this._handleFireFeedback(e.detail ?? {})
    this._onHandsPanelState = (e) => {
      const d = e.detail ?? {}
      this._handsPanel = { open: !!d.open, hand: d.hand ?? null }
      Object.keys(this._satEls).forEach(h => this._refreshSettings(h))
    }
    this._onSpeedPanelState = (e) => {
      const { hand, open } = e.detail ?? {}
      this._satEls[hand]?.speed?.setAttribute('aria-expanded', String(!!open))
    }
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
    this._speedPanel.init()
    this._bindGlobalEvents()
    this._bindKeyboard()
    const initialAll = this._computeAllMultipliers(this._readAdminSteps())
    this._moveSpeedMultiplier = initialAll.move
    this._altitudeUpMultiplier = initialAll.altitudeUp
    this._altitudeDownMultiplier = initialAll.altitudeDown
    this._orbitVerticalMultiplier = initialAll.orbitVertical
    this._orbitHorizontalMultiplier = initialAll.orbitHorizontal
    this._restoreDetachState()
    Object.keys(this._satEls).forEach(h => { this._refreshSpeed(h); this._refreshChip(h) })
    window.dispatchEvent(new CustomEvent('omni:axinator-list-request'))   // Activation lit state (axes may already be up)
    console.log('⟐ MovementPad: initialized.')
  }

  update (delta) {
    stepSpeeds(delta)   // V165: ease every hand's speed toward its slider value (~0.15 s)
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
    Object.values(this._chipEls).forEach(el => el?.parentNode?.removeChild(el))
    this._speedPanel?.destroy()
    clearTimeout(this._nopeTimers?.lh); clearTimeout(this._nopeTimers?.rh)
    window.removeEventListener(HANDS_CHANGE_EVENT, this._onHandSetting)
    window.removeEventListener('omni:axinator-tunnel-visible', this._onTunnelVisible)
    window.removeEventListener('omni:axinator-list', this._onAxinatorList)
    window.removeEventListener('omni:hand-ammo-state', this._onAmmoState)
    window.removeEventListener('omni:hand-ammo-feedback', this._onAmmoFeedback)
    window.removeEventListener(PAYLOAD_CHANGED, this._onFireRefresh)
    window.removeEventListener(PAYLOAD_CURRENT, this._onFireRefresh)
    window.removeEventListener('omni:flow-state', this._onFireRefresh)
    window.removeEventListener('omni:flow-fire-master-changed', this._onFireMaster)
    window.removeEventListener('omni:hand-fire-feedback', this._onFireFeedback)
    clearTimeout(this._fireTimers?.lh); clearTimeout(this._fireTimers?.rh)
    window.removeEventListener('omni:hands-panel-state', this._onHandsPanelState)
    window.removeEventListener('omni:hand-speed-panel-state', this._onSpeedPanelState)
    window.removeEventListener('omni:pad-toggle',  this._onPadToggle)
    window.removeEventListener('omni:pads-global', this._onPadsGlobal)
    window.removeEventListener('omni:pad-redock', this._onPadRedock)
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
    if (!visible && this._speedPanel.isOpen(handId)) this._speedPanel.close()   // V165: its popover belongs to the pad
    // V160: MovementPad is the single source of truth for pad visibility. Every
    // real change is announced so ui/Hand.js (the ⚇ cell state) and
    // systems/OmniAxinator.js (tunnels follow the pads) can never drift from it.
    window.dispatchEvent(new CustomEvent('omni:pad-state', { detail: { hand: handId, visible } }))
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

  /** The 4-button satellite cluster (Release / Speed / Activate / Settings) on each
   *  movable pad's own rim — see _SAT_GEOM above for the arc math. Own top-level
   *  fixed elements, siblings of the pad, so moving them together with the pad
   *  (see _setDetached) is just applying the same GSAP offset to all of them. */
  _buildAllSatelliteClusters () {
    Object.keys(PAD_CONFIGS)
      .filter(id => PAD_CONFIGS[id].movable)
      .forEach(handId => {
        if (Object.keys(this._satEls[handId]).length) return // double-init guard, matches _buildAllPads
        this._buildSatelliteCluster(handId)
      })
  }

  _satSpecs (handId) {
    const name = HAND_NAMES[handId]
    const tunnelHand = !!PAD_CONFIGS[handId].dimensional
    return {
      release:  { glyph: '⏏', title: 'Release — detach this pad into a free-floating panel', label: 'Release pad from its docked position', pressed: true },
      speed:    { glyph: '»', sub: '×1.0', title: `${name} speed`, label: `${name} speed`, pressed: true },
      activate: tunnelHand
        ? { glyph: '◎', title: `${name} tunnel — show / hide`, label: `Toggle the ${name} tunnel`, pressed: true }
        : { glyph: '✦', title: `${name} — fire the loaded behaviour at the target`, label: `Fire ${name} ammo`, pressed: true },
      settings: { glyph: '⚙', title: `${name} settings`, label: `${name} settings`, pressed: true },
    }
  }

  _buildSatelliteCluster (handId) {
    const shell = document.getElementById('omni-ui') ?? document.body
    const specs = this._satSpecs(handId)
    Object.entries(specs).forEach(([role, spec]) => {
      const el = document.createElement('button')
      el.id        = `omni-pad-sat-${handId}-${role}`
      el.className = `omni-pad-sat omni-pad-sat--${handId}-${role}`
      el.type      = 'button'
      el.title     = spec.title
      el.dataset.hand = handId
      el.dataset.role = role
      el.setAttribute('aria-label', spec.label)
      // V169: ⟐OmniNotify hover info (data attributes only)
      el.dataset.omniTip = spec.label
      el.dataset.omniTipKey = '—'
      el.dataset.omniTipDesc = spec.title
      el.dataset.omniTipSource = 'Pad satellite'
      if (spec.pressed) el.setAttribute('aria-pressed', 'false')
      el.innerHTML = `<span class="sat-glyph">${spec.glyph}</span>` + (spec.sub ? `<span class="sat-sub">${spec.sub}</span>` : '')
      if (role === 'release')  el.addEventListener('click', () => this._toggleDetach(handId))
      if (role === 'speed')    el.addEventListener('click', () => this._speedPanel.toggle(handId, el))
      if (role === 'activate') el.addEventListener('click', () => this._activate(handId))
      if (role === 'settings') el.addEventListener('click', () => this._toggleHandSettings(handId))
      if (role === 'speed') el.setAttribute('aria-expanded', 'false')
      el.addEventListener('pointerenter', () => { if (CHIP_HANDS.includes(handId)) this._ammoHand = handId })
      shell.appendChild(el)
      this._satEls[handId][role] = el
    })
    if (CHIP_HANDS.includes(handId)) {
      const chip = document.createElement('button')
      chip.id = `omni-pad-chip-${handId}`
      chip.className = `omni-pad-chip omni-pad-chip--${handId}`
      chip.type = 'button'
      chip.dataset.hand = handId
      chip.addEventListener('click', (e) => {
        this._ammoHand = handId
        window.dispatchEvent(new CustomEvent('omni:hand-ammo-cycle', { detail: { hand: handId, dir: e.shiftKey ? -1 : 1 } }))
      })
      shell.appendChild(chip)
      this._chipEls[handId] = chip
    }
    this._refreshSpeed(handId)
    this._refreshChip(handId)
  }

  // ── Satellite behaviour (V165) ───────────────────────────────────────────────

  /** Activation: both families announce omni:hand-activate; the receiver differs
   *  (systems/OmniAxinator.js for the tunnels, systems/OmniHandAmmo.js for ammo). */
  _activate (handId) {
    this._ammoHand = CHIP_HANDS.includes(handId) ? handId : this._ammoHand
    window.dispatchEvent(new CustomEvent('omni:hand-activate', { detail: { hand: handId } }))
  }

  _toggleHandSettings (handId) {
    const NAV = { lh: '⟐LogicalHand', rh: '⟐CreativeHand', conscious: '⟐ConsciousHand', omnihand: '⟐OmniHand' }
    if (this._handsPanel.open && this._handsPanel.hand === handId) {
      window.dispatchEvent(new CustomEvent('omni:hands-panel-close'))
    } else {
      window.dispatchEvent(new CustomEvent('omni:nav-select', { detail: { item: NAV[handId] } }))
    }
  }

  _handleHandSetting (e) {
    const { hand, key } = e.detail ?? {}
    if (!this._satEls[hand]) return
    if (key === 'speed') this._refreshSpeed(hand)
    if (key === 'ammo' || key === 'magazine') this._refreshChip(hand)
    if (key === 'elementKind') this._refreshFire(hand)
  }

  _refreshSpeed (handId) {
    const el = this._satEls[handId]?.speed
    if (!el) return
    const v = Number(getHandSetting(handId, 'speed')) || 1
    const on = v > 1.0001
    el.classList.toggle('is-active', on)
    el.setAttribute('aria-pressed', String(on))
    const sub = el.querySelector('.sat-sub')
    if (sub) sub.textContent = formatSpeed(v)
    el.title = `${HAND_NAMES[handId]} speed ${formatSpeed(v)}`
    el.setAttribute('aria-label', `${HAND_NAMES[handId]} speed, currently ${formatSpeed(v)}`)
  }

  _refreshActivate (handId) {
    const el = this._satEls[handId]?.activate
    if (!el) return
    const on = PAD_CONFIGS[handId].dimensional ? !!this._tunnelOn[handId] : this._ammoActive[handId] > 0
    el.classList.toggle('is-active', on)
    el.setAttribute('aria-pressed', String(on))
  }

  _refreshSettings (handId) {
    const el = this._satEls[handId]?.settings
    if (!el) return
    const on = this._handsPanel.open && this._handsPanel.hand === handId
    el.classList.toggle('is-active', on)
    el.setAttribute('aria-pressed', String(on))
  }

  /** The current-ammo chip's text: stored ammo if loaded, else the first loaded one. */
  _refreshChip (handId) {
    const chip = this._chipEls[handId]
    if (!chip) return
    const mag = (getHandSetting(handId, 'magazine') ?? [])
    const cur = getHandSetting(handId, 'ammo')
    const ammo = mag.includes(cur) ? cur : (mag[0] ?? null)
    chip.textContent = ammo ?? 'empty'
    chip.title = ammo
      ? `Ammo: ${ammo} (${mag.length} loaded). Click to cycle, Shift+click for previous, [ ] keys.`
      : 'Magazine empty — load behaviours in ⟐OmniHands'
    chip.setAttribute('aria-label', ammo ? `Current ammo ${ammo}. Click to cycle to the next loaded behaviour.` : 'Magazine empty')
    const act = this._satEls[handId]?.activate
    if (act) act.title = ammo
      ? `${HAND_NAMES[handId]} — fire ${ammo} at the target (again on the same node to release it)`
      : `${HAND_NAMES[handId]} — magazine empty`
  }

  _handleAmmoFeedback ({ hand, kind }) {
    const el = this._satEls[hand]?.activate
    if (!el) return
    const cls = kind === 'fired' || kind === 'released' ? 'is-fired' : 'is-nope'
    el.classList.remove('is-fired', 'is-nope')
    void el.offsetWidth                       // restart the CSS animation
    el.classList.add(cls)
    this._nopeTimers = this._nopeTimers ?? {}
    clearTimeout(this._nopeTimers[hand])
    this._nopeTimers[hand] = setTimeout(() => el.classList.remove('is-fired', 'is-nope'), 600)
    if (kind === 'no-target' || kind === 'blocked' || kind === 'empty') {
      const msg = { 'no-target': 'No target — select a node', blocked: 'Target has its own behaviour', empty: 'Magazine empty' }[kind]
      el.dataset.hint = msg
      el.title = msg
      setTimeout(() => { delete el.dataset.hint; this._refreshChip(hand) }, 1600)
    }
  }

  // ── Centre Fire button (V168) ────────────────────────────────────────────────

  _buildFireButton (handId) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.id = `omni-pad-fire-${handId}`
    btn.className = 'pad-center pad-fire'
    btn.dataset.hand = handId
    btn.innerHTML = '<span class="pad-fire-glyph">⟐</span><span class="pad-fire-ammo"></span>'
    btn.addEventListener('contextmenu', (e) => e.preventDefault())
    btn.addEventListener('pointerdown',   () => btn.classList.add('is-pressed'))
    btn.addEventListener('pointerup',     () => btn.classList.remove('is-pressed'))
    btn.addEventListener('pointercancel', () => btn.classList.remove('is-pressed'))
    btn.addEventListener('pointerleave',  () => btn.classList.remove('is-pressed'))
    btn.addEventListener('keydown', (e) => { if (e.code === 'Space' || e.code === 'Enter') btn.classList.add('is-pressed') })
    btn.addEventListener('keyup',   (e) => { if (e.code === 'Space' || e.code === 'Enter') btn.classList.remove('is-pressed') })
    btn.addEventListener('blur', () => btn.classList.remove('is-pressed'))
    btn.addEventListener('click', () => this._fire(handId))
    this._fireEls[handId] = btn
    this._refreshFire(handId)
    return btn
  }

  _fire (handId) {
    window.dispatchEvent(new CustomEvent('omni:hand-fire', { detail: { hand: handId } }))
  }

  /** What the centre button names: lh = the current flowchart element kind, rh = the current payload. */
  _fireAmmo (handId) {
    if (handId === 'lh') return { name: getHandSetting('lh', 'elementKind') || 'Process', ready: this._flowOn }
    const p = getCurrentPayload()
    return { name: p?.name ?? '', ready: !!p && this._flowOn }
  }

  _refreshFire (handId) {
    const btn = this._fireEls[handId]
    if (!btn) return
    const { name, ready } = this._fireAmmo(handId)
    btn.classList.toggle('is-ready', ready)
    btn.classList.toggle('is-empty', !ready)
    btn.querySelector('.pad-fire-ammo').textContent = name || 'no ammo'
    const label = name || 'no ammo'
    btn.setAttribute('aria-label', `Fire ${label}`)
    btn.title = !this._flowOn ? 'Fire is switched off (flow master toggle)'
      : handId === 'lh' ? `Fire — shoot a ${label} flowchart element at the target (or the HUD centre). Space / Enter when focused.`
      : name ? `Fire — display "${label}" at the target (or the HUD centre). Space / Enter when focused.`
        : 'Fire — no payload yet: RH radial ⟐1 > DataTypes creates one'
    // V169: ⟐OmniNotify hover info (utils/OmniNotifyHub.js) — data attributes only, mirrors the title.
    btn.dataset.omniTip = `Fire ${label}`
    btn.dataset.omniTipKey = 'Space / Enter (focused)'
    btn.dataset.omniTipDesc = btn.title
    btn.dataset.omniTipSource = 'Pad centre'
  }

  _handleFireFeedback ({ hand, kind }) {
    const btn = this._fireEls[hand]
    if (!btn) return
    btn.classList.remove('is-fired', 'is-nope')
    void btn.offsetWidth                       // restart the CSS animation
    btn.classList.add(kind === 'fired' ? 'is-fired' : 'is-nope')
    this._fireTimers = this._fireTimers ?? {}
    clearTimeout(this._fireTimers[hand])
    this._fireTimers[hand] = setTimeout(() => btn.classList.remove('is-fired', 'is-nope'), 600)
  }

  // ── Detach / release ─────────────────────────────────────────────────────────

  /** All elements belonging to one pad's group — the cross itself plus
   *  its 4 satellites (and the ammo chip on lh / rh) — moved together as a
   *  unit whenever it's dragged or snapped back. */
  _groupEls (handId) {
    return [this._els[handId], ...Object.values(this._satEls[handId] ?? {}), this._chipEls[handId]].filter(Boolean)
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
    // Real fix (bug-squash pass) — aria-pressed alone is screen-reader-only; the visible
    // .is-active glow is what makes clicking Release read as having done something.
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
    // V163: announced for ⟐OmniHands (readout). `omni:pad-redock { hand }` is the inverse request.
    window.dispatchEvent(new CustomEvent('omni:pad-detach-state', { detail: { hand: handId, detached } }))
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
    if (FIRE_HANDS.includes(handId)) return this._buildFireButton(handId)
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

  /** Satellites (and the ammo chip) come out and retract WITH their own pad.
   *  Same fromTo/to shape and timing as the pad's own _animateIn/_animateOut,
   *  applied to each button individually since they are independent top-level
   *  elements, not children of the pad. */
  _satAndChipEls (handId) {
    return [...Object.values(this._satEls[handId] ?? {}), this._chipEls[handId]].filter(Boolean)
  }

  _animateSatellitesIn (handId) {
    this._satAndChipEls(handId).forEach(sat => {
      gsap.killTweensOf(sat)
      sat.style.pointerEvents = 'auto'
      gsap.fromTo(sat,
        { opacity: 0, scale: 0.80 },
        { opacity: 1, scale: 1, duration: 0.22, ease: 'back.out(1.8)' }
      )
    })
  }

  _animateSatellitesOut (handId) {
    this._satAndChipEls(handId).forEach(sat => {
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
      clearTimeout(this._dimRepeat[key])
      delete this._dimRepeat[key]
    }
    if (!active) return
    this._axes?.step(handId, dir)
    // V165: a chained timeout (not setInterval) so every repeat re-reads the EASED speed:
    // changing the slider mid-hold speeds the repeat up smoothly.
    const tick = () => {
      this._axes?.step(handId, dir)
      this._dimRepeat[key] = setTimeout(tick, this._repeatMs(handId))
    }
    this._dimRepeat[key] = setTimeout(tick, this._repeatMs(handId))
  }

  /** Hold-to-repeat interval: the V163 ⟐OmniHands setting (default == HOLD_REPEAT_MS) divided
   *  by the hand's eased speed, never below 60 ms (utils/OmniHandSpeed.js repeatInterval). */
  _repeatMs (handId) {
    return repeatInterval(getHandSetting(handId, 'holdRepeatMs') ?? HOLD_REPEAT_MS, handId)
  }

  _releaseAllDimensionPresses () {
    Object.keys(PAD_CONFIGS).filter(id => PAD_CONFIGS[id].dimensional).forEach(handId => {
      DIRS.forEach(d => this._setPressed(handId, d, false, true))
    })
    Object.values(this._dimRepeat).forEach(t => clearTimeout(t))
    this._dimRepeat = {}
  }

  // ── Camera movement ─────────────────────────────────────────────────────────

  /** LH's translate-move logic. Still parameterized by handId from V150, but
   *  as of V158 only 'lh' calls it — OmniHand no longer moves the camera.
   *  V165: translate speed = MOVE_SPEED x admin step multiplier (or Global override) x the
   *  hand's EASED Speed (1x by default) x delta. Applied exactly once. */
  _applyTranslateMovement (cam, delta, handId) {
    const p = this._pressed[handId]
    if (!p.up && !p.down && !p.left && !p.right) return
    const speed = MOVE_SPEED * this._moveSpeedMultiplier * getEffectiveSpeed(handId) * delta
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

    // V165: x the hand's EASED Speed (1x by default) on top of the admin multipliers.
    const hs = getEffectiveSpeed(handId)
    if (p.up)   cam.position.y += MOVE_SPEED * this._altitudeUpMultiplier * hs * delta
    if (p.down) cam.position.y -= MOVE_SPEED * this._altitudeDownMultiplier * hs * delta

    if (p.left || p.right) {
      const angle = (p.right ? -1 : 1) * YAW_SPEED * this._orbitHorizontalMultiplier * hs * delta
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
    // V165: [ / ] cycle the loaded ammo of the last-touched lower hand (both keys were free).
    if ((e.code === 'BracketLeft' || e.code === 'BracketRight') && !e.ctrlKey && !e.metaKey && !e.altKey && !e.repeat) {
      const hand = this._visible[this._ammoHand] ? this._ammoHand : CHIP_HANDS.find(h => this._visible[h])
      if (hand) {
        e.preventDefault()
        this._ammoHand = hand
        window.dispatchEvent(new CustomEvent('omni:hand-ammo-cycle', { detail: { hand, dir: e.code === 'BracketLeft' ? -1 : 1 } }))
      }
      return
    }
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
    window.addEventListener('omni:pad-redock', this._onPadRedock)
    window.addEventListener('omni:radial-toggle', this._onRadialToggle)
    window.addEventListener('omni:admin-settings-saved', this._onAdminSteps)
    window.addEventListener('omni:node-selected', this._onNodeSelected)
    window.addEventListener('omni:omnikeys-rotate', this._onOmniKeysRotate)
    window.addEventListener(HANDS_CHANGE_EVENT, this._onHandSetting)
    window.addEventListener('omni:axinator-tunnel-visible', this._onTunnelVisible)
    window.addEventListener('omni:axinator-list', this._onAxinatorList)
    window.addEventListener('omni:hand-ammo-state', this._onAmmoState)
    window.addEventListener('omni:hand-ammo-feedback', this._onAmmoFeedback)
    window.addEventListener(PAYLOAD_CHANGED, this._onFireRefresh)
    window.addEventListener(PAYLOAD_CURRENT, this._onFireRefresh)
    window.addEventListener('omni:flow-state', this._onFireRefresh)
    window.addEventListener('omni:flow-fire-master-changed', this._onFireMaster)
    window.addEventListener('omni:hand-fire-feedback', this._onFireFeedback)
    window.addEventListener('omni:hands-panel-state', this._onHandsPanelState)
    window.addEventListener('omni:hand-speed-panel-state', this._onSpeedPanelState)
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
    // (V165: the admin `dashMultiplier` field is no longer read — Dash became Speed.)
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