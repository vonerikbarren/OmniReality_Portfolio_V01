/**
 * ui/MovementPad.js — ⟐mniReality Directional Movement Pad
 *
 * Manages four corner-anchored directional pads — one per Hand.
 * All four share a single component instance; visibility is toggled
 * per-hand via omni:pad-toggle, or globally via omni:pads-global
 * (dispatched by ⟐LH ⚇, which is the global pad toggle).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Pad layout — 3×3 CSS grid cross
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   [ ]  [▲]  [ ]
 *   [◄]  [·]  [►]
 *   [ ]  [▼]  [ ]
 *
 * Center cell:
 *   ⟐LH  → static label  (⟐LH)
 *   ⟐RH  → mode toggle   (TILT ↔ XY)
 *   others → empty
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Hand → Pad function
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   ⟐mniHand  TL  →  Switch axiomatic app          (TBD — UI renders, no camera)
 *   ⟐CH       TR  →  Switch axiomatic spatial fn    (TBD — UI renders, no camera)
 *   ⟐LH       BL  →  WASD — positional movement through space
 *                      Up    → Move forward  (along camera facing, XZ-projected)
 *                      Down  → Move backward
 *                      Left  → Strafe left
 *                      Right → Strafe right
 *                      Keyboard: W A S D
 *   ⟐RH       BR  →  Camera tilt / spatial translation
 *                      Mode 1 — TILT (default)
 *                        Up    → Pitch up
 *                        Down  → Pitch down
 *                        Left  → Yaw left
 *                        Right → Yaw right
 *                      Mode 2 — XY (translate)
 *                        Up    → Move camera Y+  (world up)
 *                        Down  → Move camera Y−
 *                        Left  → Move camera X−
 *                        Right → Move camera X+
 *                      Keyboard: Arrow keys
 *                      Mode toggle: center button in pad, or omni:rh-mode-set event
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Events consumed (window)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   omni:pad-toggle   →  { hand, visible }          per-hand show/hide
 *   omni:pads-global  →  { visible }                all-pads show/hide (⟐LH ⚇)
 *   omni:rh-mode-set  →  { mode: 'tilt'|'translate' }  external mode override
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Events dispatched (window)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   omni:movement        →  { hand, direction, active, mode }
 *   omni:rh-mode-change  →  { mode }
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Public API
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   pad.init()
 *   pad.update(delta)              ← call every frame from UI.update()
 *   pad.destroy()
 *   pad.setVisible(handId, bool)
 *   pad.setAllVisible(bool)
 *   pad.setRHMode('tilt'|'translate')
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ui/index.js integration
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   import MovementPad from './MovementPad.js'
 *
 *   // in constructor:
 *   this.movementPad = null
 *
 *   // in init(), after hands:
 *   this.movementPad = new MovementPad(this._ctx)
 *   this.movementPad.init()
 *
 *   // in update(delta):
 *   this.movementPad?.update(delta)
 *
 *   // in destroy():
 *   this.movementPad?.destroy()
 *
 *   // replace pad-toggle and pads-global stubs in _bridgeEvents():
 *   window.addEventListener('omni:pad-toggle', (e) => {
 *     const { hand, visible } = e.detail ?? {}
 *     if (hand) this.movementPad?.setVisible(hand, visible)
 *   })
 *   window.addEventListener('omni:pads-global', (e) => {
 *     this.movementPad?.setAllVisible(e.detail?.visible ?? false)
 *   })
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Camera note
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   For correct FPS-style tilt (RH Mode 1), the camera's Euler order
 *   should be 'YXZ'. Set once in BaseScene.js or OrbitModule.js:
 *     camera.rotation.order = 'YXZ'
 *   Without this, pitch and yaw will bleed into each other (gimbal).
 *
 *   OrbitControls conflict: when the pad is pressed, it takes direct
 *   control of the camera. OrbitControls may fight this. Phase 4 will
 *   resolve this via a unified camera controller. For now the pad wins
 *   on each frame tick.
 */

import gsap from 'gsap'
import * as THREE from 'three'

// ─────────────────────────────────────────────────────────────────────────────
// Motion constants
// ─────────────────────────────────────────────────────────────────────────────

const MOVE_SPEED  = 20          // units / second — LH forward/strafe + RH translate
const TILT_SPEED  = 1.2         // radians / second — RH pitch + yaw
const PITCH_LIMIT = Math.PI * 0.48   // ±86° — clamp to avoid gimbal flip

// ─────────────────────────────────────────────────────────────────────────────
// Layout constants — must stay in sync with Hand.js
// ─────────────────────────────────────────────────────────────────────────────

const BAR_H      = 36    // px — GlobalBar collapsed height
const DOCK_H     = 52    // px — Dock height
const HAND_CELL  = 44    // px — one hand cell
const HAND_GAP   = 2     // px — hand grid gap
const HAND_WH    = HAND_CELL * 2 + HAND_GAP   // 90px — hand matrix total size

const PAD_CELL   = 44    // px — one directional button
const PAD_GAP    = 4     // px — gap inside pad cross grid
const PAD_INNER  = 10    // px — padding inside pad container
const PAD_OFFSET = 8     // px — gap between hand matrix and pad

// ─────────────────────────────────────────────────────────────────────────────
// Pad configuration table
// ─────────────────────────────────────────────────────────────────────────────

const PAD_CONFIGS = {
  omnihand: {
    id          : 'omnihand',
    corner      : 'tl',
    abbr        : '⟐H',
    modeLabel   : 'TBD',
    movable     : false,         // no camera control — function TBD
    keyboard    : null,
    dirLabels   : { up: '▲', down: '▼', left: '◄', right: '►' },
    centerLabel : null,
  },
  conscious: {
    id          : 'conscious',
    corner      : 'tr',
    abbr        : 'CH',
    modeLabel   : 'TBD',
    movable     : false,
    keyboard    : null,
    dirLabels   : { up: '▲', down: '▼', left: '◄', right: '►' },
    centerLabel : null,
  },
  lh: {
    id          : 'lh',
    corner      : 'bl',
    abbr        : 'LH',
    modeLabel   : 'MOVE',
    movable     : true,
    moveMode    : 'wasd',
    keyboard    : 'wasd',
    dirLabels   : { up: 'FWD', down: 'BCK', left: 'STR-L', right: 'STR-R' },
    centerLabel : '⟐LH',
  },
  rh: {
    id          : 'rh',
    corner      : 'br',
    abbr        : 'RH',
    modeLabel   : 'TILT',       // updated live as mode changes
    movable     : true,
    keyboard    : 'arrows',
    modeToggle  : true,
    modes: {
      tilt: {
        label    : 'TILT',
        dirLabels: { up: 'PITCH↑', down: 'PITCH↓', left: 'YAW-L', right: 'YAW-R' },
      },
      translate: {
        label    : 'XY',
        dirLabels: { up: 'Y+', down: 'Y−', left: 'X−', right: 'X+' },
      },
    },
  },
}

const DIRS      = ['up', 'down', 'left', 'right']
const DIR_GLYPHS = { up: '▲', down: '▼', left: '◄', right: '►' }

// ─────────────────────────────────────────────────────────────────────────────
// Stylesheet
// ─────────────────────────────────────────────────────────────────────────────

const STYLES = /* css */`

/* ── Root container ────────────────────────────────────────────────────────── */

.omni-pad {
  --pad-bg          : rgba(8, 8, 12, 0.80);
  --pad-border      : rgba(255, 255, 255, 0.08);
  --pad-btn-bg      : rgba(255, 255, 255, 0.05);
  --pad-btn-hover   : rgba(255, 255, 255, 0.13);
  --pad-btn-press   : rgba(255, 255, 255, 0.26);
  --pad-text        : rgba(255, 255, 255, 0.80);
  --pad-text-dim    : rgba(255, 255, 255, 0.30);
  --pad-accent      : rgba(255, 255, 255, 0.96);
  --pad-glow        : 0 0 10px rgba(255, 255, 255, 0.22);
  --pad-glow-press  : 0 0 14px rgba(255, 255, 255, 0.40);
  --mono            : 'Courier New', Courier, monospace;
  --pad-cell        : ${PAD_CELL}px;
  --pad-gap         : ${PAD_GAP}px;
  --pad-inner       : ${PAD_INNER}px;

  position          : fixed;
  z-index           : 41;        /* above Hands (40) below Drawers/Panels (45) */
  pointer-events    : none;
  opacity           : 0;
  user-select       : none;

  background        : var(--pad-bg);
  backdrop-filter   : blur(18px) saturate(1.5);
  -webkit-backdrop-filter: blur(18px) saturate(1.5);
  border            : 1px solid var(--pad-border);
  border-radius     : 10px;
  padding           : var(--pad-inner);

  display           : flex;
  flex-direction    : column;
  gap               : 7px;

  -webkit-font-smoothing : antialiased;
}

/* ── Corner anchoring ──────────────────────────────────────────────────────── */

.omni-pad--tl {
  top              : ${BAR_H + HAND_WH + PAD_OFFSET}px;
  left             : 4px;
  transform-origin : top left;
  border-top-left-radius: 2px;
}

.omni-pad--tr {
  top              : ${BAR_H + HAND_WH + PAD_OFFSET}px;
  right            : 4px;
  transform-origin : top right;
  border-top-right-radius: 2px;
}

.omni-pad--bl {
  bottom           : ${DOCK_H + HAND_WH + PAD_OFFSET}px;
  left             : 4px;
  transform-origin : bottom left;
  border-bottom-left-radius: 2px;
}

.omni-pad--br {
  bottom           : ${DOCK_H + HAND_WH + PAD_OFFSET}px;
  right            : 4px;
  transform-origin : bottom right;
  border-bottom-right-radius: 2px;
}

/* ── Header ────────────────────────────────────────────────────────────────── */

.pad-header {
  display          : flex;
  align-items      : center;
  justify-content  : space-between;
  padding          : 0 2px 0 2px;
  border-bottom    : 1px solid rgba(255, 255, 255, 0.05);
  padding-bottom   : 5px;
}

.pad-abbr {
  font-family      : var(--mono);
  font-size        : 8.5px;
  color            : var(--pad-text-dim);
  letter-spacing   : 0.14em;
  text-transform   : uppercase;
}

.pad-mode-label {
  font-family      : var(--mono);
  font-size        : 8px;
  color            : var(--pad-accent);
  letter-spacing   : 0.12em;
  text-transform   : uppercase;
  text-shadow      : var(--pad-glow);
}

/* ── Directional cross grid ────────────────────────────────────────────────── */

.pad-cross {
  display               : grid;
  grid-template-columns : repeat(3, var(--pad-cell));
  grid-template-rows    : repeat(3, var(--pad-cell));
  gap                   : var(--pad-gap);
}

.pad-slot-empty {
  /* corner placeholder — intentionally empty */
}

/* ── Directional buttons ───────────────────────────────────────────────────── */

.pad-btn {
  display          : flex;
  flex-direction   : column;
  align-items      : center;
  justify-content  : center;
  gap              : 3px;

  width            : var(--pad-cell);
  height           : var(--pad-cell);

  background       : var(--pad-btn-bg);
  border           : 1px solid rgba(255, 255, 255, 0.07);
  border-radius    : 7px;
  cursor           : pointer;
  color            : var(--pad-text);
  font-family      : var(--mono);
  outline          : none;

  transition       : background 0.10s ease, border-color 0.10s ease;
  -webkit-tap-highlight-color: transparent;
  touch-action     : manipulation;
}

.pad-btn:hover {
  background       : var(--pad-btn-hover);
  border-color     : rgba(255, 255, 255, 0.16);
}

.pad-btn:hover .pad-glyph {
  color            : var(--pad-accent);
  text-shadow      : var(--pad-glow);
}

.pad-btn.is-pressed {
  background       : var(--pad-btn-press);
  border-color     : rgba(255, 255, 255, 0.32);
}

.pad-btn.is-pressed .pad-glyph {
  color            : var(--pad-accent);
  text-shadow      : var(--pad-glow-press);
}

.pad-btn.is-pressed .pad-dir-label {
  color            : rgba(255, 255, 255, 0.60);
}

/* TBD buttons — visible but inert */
.pad-btn--tbd {
  opacity          : 0.40;
  cursor           : default;
  pointer-events   : none;
}

/* ── Glyph + direction label ───────────────────────────────────────────────── */

.pad-glyph {
  font-size        : 14px;
  line-height      : 1;
  pointer-events   : none;
  color            : var(--pad-text);
  transition       : color 0.10s ease, text-shadow 0.10s ease;
}

.pad-dir-label {
  font-size        : 6px;
  color            : var(--pad-text-dim);
  text-transform   : uppercase;
  letter-spacing   : 0.05em;
  line-height      : 1;
  pointer-events   : none;
  white-space      : nowrap;
  transition       : color 0.10s ease;
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
  border           : 1px solid rgba(255, 255, 255, 0.05);
}

.pad-center-label {
  font-family      : var(--mono);
  font-size        : 7.5px;
  color            : var(--pad-text-dim);
  letter-spacing   : 0.10em;
}

/* ── Center as RH mode toggle ──────────────────────────────────────────────── */

.pad-center--toggle {
  cursor           : pointer;
  transition       : background 0.15s ease, border-color 0.15s ease;
}

.pad-center--toggle:hover {
  background       : rgba(255, 255, 255, 0.10);
  border-color     : rgba(255, 255, 255, 0.22);
}

.pad-center--toggle:hover .pad-mode-indicator .mode-name {
  color            : var(--pad-accent);
  text-shadow      : var(--pad-glow);
}

.pad-mode-indicator {
  display          : flex;
  flex-direction   : column;
  align-items      : center;
  gap              : 2px;
  pointer-events   : none;
  font-family      : var(--mono);
}

.pad-mode-indicator .mode-name {
  font-size        : 8.5px;
  letter-spacing   : 0.10em;
  color            : var(--pad-accent);
  text-shadow      : var(--pad-glow);
  transition       : color 0.12s, text-shadow 0.12s;
  line-height      : 1;
}

.pad-mode-indicator .mode-hint {
  font-size        : 6px;
  color            : var(--pad-text-dim);
  letter-spacing   : 0.08em;
  line-height      : 1;
}

/* ── TBD pad overlay ───────────────────────────────────────────────────────── */

.omni-pad--tbd .pad-cross {
  opacity          : 0.38;
  pointer-events   : none;
}

/* ── Keyboard hint strip ───────────────────────────────────────────────────── */

.pad-keys {
  display          : flex;
  align-items      : center;
  justify-content  : center;
  gap              : 3px;
  border-top       : 1px solid rgba(255, 255, 255, 0.05);
  padding-top      : 5px;
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
  min-width        : 16px;
  height           : 14px;
  padding          : 0 4px;
  color            : var(--pad-text-dim);
  letter-spacing   : 0.04em;
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
    --pad-cell     : 40px;
    --pad-gap      : 3px;
    --pad-inner    : 8px;
  }
}

`

// ─────────────────────────────────────────────────────────────────────────────
// Style injection (once)
// ─────────────────────────────────────────────────────────────────────────────

function injectStyles () {
  if (document.getElementById('omni-pad-styles')) return
  const tag = document.createElement('style')
  tag.id          = 'omni-pad-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

// ─────────────────────────────────────────────────────────────────────────────
// MovementPad class
// ─────────────────────────────────────────────────────────────────────────────

export default class MovementPad {

  /**
   * @param {object} context  — { scene, camera, renderer, sizes, ticker, Sound }
   */
  constructor (context) {
    this.ctx = context

    // ── DOM elements ──────────────────────────────────────────────────────
    this._els        = {}   // handId → pad root element
    this._btnEls     = {}   // handId → { up, down, left, right } → button element
    this._keyEls     = {}   // handId → { up, down, left, right } → key hint span
    this._modeIndEl  = null // RH center mode indicator element
    this._modeHdrEl  = null // RH header mode label element

    // ── Visibility ────────────────────────────────────────────────────────
    this._visible = { omnihand: false, conscious: false, lh: false, rh: false }

    // ── Press state — only lh and rh are wired to camera ─────────────────
    this._pressed = {
      lh: { up: false, down: false, left: false, right: false },
      rh: { up: false, down: false, left: false, right: false },
    }

    // ── RH mode ───────────────────────────────────────────────────────────
    this._rhMode = 'tilt'   // 'tilt' | 'translate'

    // ── THREE.js helpers — allocated once to avoid GC pressure ────────────
    this._v3fwd   = new THREE.Vector3()
    this._v3right = new THREE.Vector3()
    this._worldUp = new THREE.Vector3(0, 1, 0)

    // ── Bound handlers for clean removeEventListener ──────────────────────
    this._onPadToggle  = this._handlePadToggle.bind(this)
    this._onPadsGlobal = this._handlePadsGlobal.bind(this)
    this._onRHModeSet  = this._handleRHModeSet.bind(this)
    this._onKeyDown    = this._handleKeyDown.bind(this)
    this._onKeyUp      = this._handleKeyUp.bind(this)
  }

  // ── Module contract ──────────────────────────────────────────────────────

  init () {
    injectStyles()
    this._buildAllPads()
    this._bindGlobalEvents()
    this._bindKeyboard()
    console.log('⟐ MovementPad: initialized — 4 pads mounted.')
  }

  /**
   * Per-frame camera movement. Must be called from UI.update(delta).
   * @param {number} delta — seconds since last frame
   */
  update (delta) {
    const cam = this.ctx?.camera
    if (!cam) return
    this._applyLHMovement(cam, delta)
    this._applyRHMovement(cam, delta)
  }

  destroy () {
    Object.values(this._els).forEach(el => el?.parentNode?.removeChild(el))

    window.removeEventListener('omni:pad-toggle',  this._onPadToggle)
    window.removeEventListener('omni:pads-global', this._onPadsGlobal)
    window.removeEventListener('omni:rh-mode-set', this._onRHModeSet)
    window.removeEventListener('keydown',          this._onKeyDown)
    window.removeEventListener('keyup',            this._onKeyUp)

    console.log('⟐ MovementPad: destroyed.')
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Show or hide a specific hand's pad.
   * @param {string}  handId  — 'omnihand' | 'conscious' | 'lh' | 'rh'
   * @param {boolean} visible
   */
  setVisible (handId, visible) {
    if (!this._els[handId]) return
    if (this._visible[handId] === visible) return
    this._visible[handId] = visible
    visible ? this._animateIn(handId) : this._animateOut(handId)
  }

  /**
   * Show or hide all four pads at once.
   * Called by the ⟐LH ⚇ global pad toggle.
   * @param {boolean} visible
   */
  setAllVisible (visible) {
    Object.keys(this._els).forEach(id => this.setVisible(id, visible))
  }

  /**
   * Set ⟐RH movement mode.
   * Can be called externally from the ⟐RH panel (Phase 4).
   * @param {'tilt'|'translate'} mode
   */
  setRHMode (mode) {
    if (mode !== 'tilt' && mode !== 'translate') return
    if (this._rhMode === mode) return
    this._rhMode = mode
    this._updateRHModeUI()
    window.dispatchEvent(new CustomEvent('omni:rh-mode-change', { detail: { mode } }))
    console.log(`⟐ MovementPad: RH mode → ${mode}`)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DOM Construction
  // ─────────────────────────────────────────────────────────────────────────

  _buildAllPads () {
    const shell = document.getElementById('omni-ui') ?? document.body
    Object.keys(PAD_CONFIGS).forEach(handId => {
      const el = this._buildPad(handId)
      this._els[handId] = el
      shell.appendChild(el)
    })
  }

  _buildPad (handId) {
    const cfg   = PAD_CONFIGS[handId]
    const isTBD = !cfg.movable

    const el = document.createElement('div')
    el.id        = `omni-pad-${handId}`
    el.className = ['omni-pad', `omni-pad--${cfg.corner}`, isTBD ? 'omni-pad--tbd' : '']
      .filter(Boolean).join(' ')
    el.setAttribute('aria-label', `${cfg.abbr} movement pad`)
    el.setAttribute('role', 'group')

    el.appendChild(this._buildHeader(handId))
    el.appendChild(this._buildCross(handId))

    if (cfg.keyboard) {
      el.appendChild(this._buildKeyHint(handId))
    }

    return el
  }

  // ── Header ───────────────────────────────────────────────────────────────

  _buildHeader (handId) {
    const cfg    = PAD_CONFIGS[handId]
    const header = document.createElement('div')
    header.className = 'pad-header'

    const abbr = document.createElement('span')
    abbr.className   = 'pad-abbr'
    abbr.textContent = cfg.abbr

    const modeLabel = document.createElement('span')
    modeLabel.className = 'pad-mode-label'

    // RH: live label — store reference
    if (handId === 'rh') {
      modeLabel.textContent = PAD_CONFIGS.rh.modes[this._rhMode].label
      this._modeHdrEl = modeLabel
    } else {
      modeLabel.textContent = cfg.modeLabel
    }

    header.appendChild(abbr)
    header.appendChild(modeLabel)
    return header
  }

  // ── Directional cross ─────────────────────────────────────────────────────

  _buildCross (handId) {
    const cross = document.createElement('div')
    cross.className = 'pad-cross'

    // 3×3 grid reading order — corners are empty
    const layout = [
      'empty', 'up',     'empty',
      'left',  'center', 'right',
      'empty', 'down',   'empty',
    ]

    this._btnEls[handId] = {}

    layout.forEach(slot => {
      let cell

      if (slot === 'empty') {
        cell = document.createElement('div')
        cell.className = 'pad-slot-empty'

      } else if (slot === 'center') {
        cell = this._buildCenter(handId)

      } else {
        // Directional button
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

    // Direction label — RH uses mode-specific text
    const label = handId === 'rh'
      ? PAD_CONFIGS.rh.modes[this._rhMode].dirLabels[dir]
      : (cfg.dirLabels?.[dir] ?? DIR_GLYPHS[dir])

    const btn = document.createElement('button')
    btn.className = [
      'pad-btn',
      `pad-btn--${dir}`,
      isTBD ? 'pad-btn--tbd' : '',
    ].filter(Boolean).join(' ')

    btn.dataset.hand = handId
    btn.dataset.dir  = dir

    if (isTBD) {
      btn.disabled = true
      btn.setAttribute('aria-label', `${dir} — TBD`)
    } else {
      btn.setAttribute('aria-label', `${dir}: ${label}`)
    }

    btn.innerHTML = /* html */`
      <span class="pad-glyph">${DIR_GLYPHS[dir]}</span>
      <span class="pad-dir-label">${label}</span>
    `

    // Pointer events (touch + mouse) — only wired for movable pads
    if (!isTBD) {
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault()
        btn.setPointerCapture(e.pointerId)
        this._setPressed(handId, dir, true)
      })

      btn.addEventListener('pointerup',     () => this._setPressed(handId, dir, false))
      btn.addEventListener('pointercancel', () => this._setPressed(handId, dir, false))

      // pointerleave only fires if pointer leaves without a pointerup
      btn.addEventListener('pointerleave', (e) => {
        if (e.buttons === 0) this._setPressed(handId, dir, false)
      })
    }

    return btn
  }

  // ── Center cell ───────────────────────────────────────────────────────────

  _buildCenter (handId) {
    const cfg = PAD_CONFIGS[handId]

    if (handId === 'rh' && cfg.modeToggle) {
      // ── RH: mode toggle button ──────────────────────────────────────
      const btn = document.createElement('div')
      btn.className        = 'pad-center pad-center--toggle'
      btn.setAttribute('role',       'button')
      btn.setAttribute('aria-label', 'Toggle RH camera mode')
      btn.tabIndex = 0

      const indicator = document.createElement('div')
      indicator.className = 'pad-mode-indicator'
      indicator.innerHTML = /* html */`
        <span class="mode-name">${PAD_CONFIGS.rh.modes[this._rhMode].label}</span>
        <span class="mode-hint">MODE</span>
      `

      btn.appendChild(indicator)
      this._modeIndEl = indicator   // store ref for live updates

      btn.addEventListener('click', () => {
        const next = this._rhMode === 'tilt' ? 'translate' : 'tilt'
        this.setRHMode(next)
        this._playSound('click')

        // Pulse feedback
        gsap.fromTo(btn, { scale: 0.88 }, { scale: 1, duration: 0.20, ease: 'back.out(2)' })
      })

      btn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          btn.click()
        }
      })

      return btn

    } else if (cfg.centerLabel) {
      // ── LH: static label ────────────────────────────────────────────
      const center = document.createElement('div')
      center.className = 'pad-center'

      const lbl = document.createElement('span')
      lbl.className   = 'pad-center-label'
      lbl.textContent = cfg.centerLabel
      center.appendChild(lbl)
      return center

    } else {
      // ── TBD pads: empty center ───────────────────────────────────────
      const center = document.createElement('div')
      center.className = 'pad-center'
      return center
    }
  }

  // ── Keyboard hint strip ───────────────────────────────────────────────────

  _buildKeyHint (handId) {
    const cfg   = PAD_CONFIGS[handId]
    const strip = document.createElement('div')
    strip.className = 'pad-keys'

    const lbl = document.createElement('span')
    lbl.className   = 'pad-keys-label'
    lbl.textContent = 'KB'
    strip.appendChild(lbl)

    // WASD order for LH → maps to: up, left, down, right
    const keys  = cfg.keyboard === 'wasd' ? ['W', 'A', 'S', 'D'] : ['↑', '←', '↓', '→']
    const dirs  = ['up', 'left', 'down', 'right']

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

  // ─────────────────────────────────────────────────────────────────────────
  // Show / Hide Animation
  // ─────────────────────────────────────────────────────────────────────────

  _animateIn (handId) {
    const el = this._els[handId]
    if (!el) return

    gsap.killTweensOf(el)
    el.style.pointerEvents = 'auto'

    gsap.fromTo(el,
      { opacity: 0, scale: 0.80 },
      {
        opacity  : 1,
        scale    : 1,
        duration : 0.24,
        ease     : 'back.out(1.8)',
        onComplete () { el.style.transform = '' },
      }
    )
  }

  _animateOut (handId) {
    const el = this._els[handId]
    if (!el) return

    gsap.killTweensOf(el)

    gsap.to(el, {
      opacity  : 0,
      scale    : 0.82,
      duration : 0.16,
      ease     : 'power2.in',
      onComplete: () => {
        el.style.pointerEvents = 'none'
        el.style.transform     = ''
        // Release all held directions — prevents stuck movement on hide
        if (this._pressed[handId]) {
          DIRS.forEach(d => this._setPressed(handId, d, false, /* silent */ true))
        }
      },
    })
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Press State
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Set pressed state for a direction on a hand.
   * Updates button visual, keyboard hint, dispatches omni:movement event.
   *
   * @param {string}  handId
   * @param {string}  dir     — 'up' | 'down' | 'left' | 'right'
   * @param {boolean} active
   * @param {boolean} silent  — skip event dispatch (used when pad hides mid-press)
   */
  _setPressed (handId, dir, active, silent = false) {
    const state = this._pressed[handId]
    if (!state) return
    if (state[dir] === active) return   // no change

    state[dir] = active

    // Visual — directional button
    this._btnEls[handId]?.[dir]?.classList.toggle('is-pressed', active)

    // Visual — keyboard hint key
    this._keyEls[handId]?.[dir]?.classList.toggle('is-active', active)

    if (!silent) {
      window.dispatchEvent(new CustomEvent('omni:movement', {
        detail: {
          hand     : handId,
          direction: dir,
          active,
          mode     : handId === 'rh' ? this._rhMode : 'wasd',
        },
      }))
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Camera Movement — applied every frame in update()
  // ─────────────────────────────────────────────────────────────────────────

  _applyLHMovement (cam, delta) {
    const p = this._pressed.lh
    if (!p.up && !p.down && !p.left && !p.right) return

    const speed = MOVE_SPEED * delta

    // Project camera facing direction onto XZ plane for ground-plane movement
    cam.getWorldDirection(this._v3fwd)
    this._v3fwd.y = 0

    if (this._v3fwd.lengthSq() < 0.0001) return   // camera pointing straight up/down

    this._v3fwd.normalize()

    // Right vector = forward × worldUp
    this._v3right.crossVectors(this._v3fwd, this._worldUp).normalize()

    if (p.up)    cam.position.addScaledVector(this._v3fwd,   speed)
    if (p.down)  cam.position.addScaledVector(this._v3fwd,  -speed)
    if (p.right) cam.position.addScaledVector(this._v3right, speed)
    if (p.left)  cam.position.addScaledVector(this._v3right,-speed)
  }

  _applyRHMovement (cam, delta) {
    const p = this._pressed.rh
    if (!p.up && !p.down && !p.left && !p.right) return

    if (this._rhMode === 'tilt') {
      this._applyRHTilt(cam, delta)
    } else {
      this._applyRHTranslate(cam, delta)
    }
  }

  /**
   * RH Mode 1 — TILT
   * Pitch (rotation.x) and Yaw (rotation.y).
   *
   * For correct behaviour, set camera.rotation.order = 'YXZ' in BaseScene.js.
   * Without YXZ order, yaw and pitch cross-contaminate (gimbal lock).
   */
  _applyRHTilt (cam, delta) {
    const p     = this._pressed.rh
    const speed = TILT_SPEED * delta

    if (p.up)    cam.rotation.x += speed
    if (p.down)  cam.rotation.x -= speed
    if (p.left)  cam.rotation.y += speed
    if (p.right) cam.rotation.y -= speed

    // Clamp pitch — prevents the camera flipping past vertical
    cam.rotation.x = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, cam.rotation.x))
  }

  /**
   * RH Mode 2 — XY TRANSLATE
   * Moves camera in world X/Y — useful for vertical repositioning + horizontal drift.
   */
  _applyRHTranslate (cam, delta) {
    const p     = this._pressed.rh
    const speed = MOVE_SPEED * delta

    if (p.up)    cam.position.y += speed
    if (p.down)  cam.position.y -= speed
    if (p.left)  cam.position.x -= speed
    if (p.right) cam.position.x += speed
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RH Mode UI Update
  // ─────────────────────────────────────────────────────────────────────────

  _updateRHModeUI () {
    const modeCfg = PAD_CONFIGS.rh.modes[this._rhMode]

    // ── Center indicator (mode name) ──────────────────────────────────────
    const nameEl = this._modeIndEl?.querySelector('.mode-name')
    if (nameEl) {
      gsap.to(nameEl, {
        opacity : 0,
        y       : -4,
        duration: 0.08,
        onComplete: () => {
          nameEl.textContent = modeCfg.label
          gsap.to(nameEl, { opacity: 1, y: 0, duration: 0.14 })
        },
      })
    }

    // ── Header label ──────────────────────────────────────────────────────
    if (this._modeHdrEl) {
      this._modeHdrEl.textContent = modeCfg.label
    }

    // ── Directional button labels ─────────────────────────────────────────
    const btns = this._btnEls['rh']
    if (btns) {
      DIRS.forEach(dir => {
        const labelEl = btns[dir]?.querySelector('.pad-dir-label')
        if (!labelEl) return
        gsap.to(labelEl, {
          opacity : 0,
          duration: 0.07,
          onComplete: () => {
            labelEl.textContent = modeCfg.dirLabels[dir]
            gsap.to(labelEl, { opacity: 1, duration: 0.12 })
          },
        })
      })
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Keyboard
  // ─────────────────────────────────────────────────────────────────────────

  _bindKeyboard () {
    window.addEventListener('keydown', this._onKeyDown)
    window.addEventListener('keyup',   this._onKeyUp)
  }

  _handleKeyDown (e) {
    // Ignore when user is typing in an input element
    const tag = document.activeElement?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

    const mapped = this._mapKey(e.code)
    if (!mapped) return

    const { handId, dir } = mapped

    // Only move if that pad is visible
    if (!this._visible[handId]) return

    e.preventDefault()

    // Guard repeat events (key held)
    if (this._pressed[handId]?.[dir]) return
    this._setPressed(handId, dir, true)
  }

  _handleKeyUp (e) {
    const mapped = this._mapKey(e.code)
    if (!mapped) return
    const { handId, dir } = mapped
    this._setPressed(handId, dir, false)
  }

  /**
   * Maps KeyboardEvent.code → { handId, dir }.
   * WASD  → ⟐LH
   * Arrows → ⟐RH
   */
  _mapKey (code) {
    switch (code) {
      // ⟐LH — WASD positional movement
      case 'KeyW':       return { handId: 'lh', dir: 'up'    }
      case 'KeyS':       return { handId: 'lh', dir: 'down'  }
      case 'KeyA':       return { handId: 'lh', dir: 'left'  }
      case 'KeyD':       return { handId: 'lh', dir: 'right' }
      // ⟐RH — Arrow camera control
      case 'ArrowUp':    return { handId: 'rh', dir: 'up'    }
      case 'ArrowDown':  return { handId: 'rh', dir: 'down'  }
      case 'ArrowLeft':  return { handId: 'rh', dir: 'left'  }
      case 'ArrowRight': return { handId: 'rh', dir: 'right' }
      default:           return null
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Global Event Bridge
  // ─────────────────────────────────────────────────────────────────────────

  _bindGlobalEvents () {
    window.addEventListener('omni:pad-toggle',  this._onPadToggle)
    window.addEventListener('omni:pads-global', this._onPadsGlobal)
    window.addEventListener('omni:rh-mode-set', this._onRHModeSet)
  }

  /** omni:pad-toggle — per-hand show/hide from Hand.js ⚇ (omnihand, conscious, rh) */
  _handlePadToggle (e) {
    const { hand, visible } = e.detail ?? {}
    if (hand) this.setVisible(hand, visible)
  }

  /** omni:pads-global — all-pads toggle from ⟐LH ⚇ */
  _handlePadsGlobal (e) {
    this.setAllVisible(e.detail?.visible ?? false)
  }

  /** omni:rh-mode-set — external mode override (from ⟐RH panel, Phase 4) */
  _handleRHModeSet (e) {
    const { mode } = e.detail ?? {}
    if (mode) this.setRHMode(mode)
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
