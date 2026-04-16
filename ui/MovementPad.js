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
 *   ⟐mniHand  TL  →  TBD
 *   ⟐CH       TR  →  TBD
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
 */

import gsap from 'gsap'
import * as THREE from 'three'

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
  omnihand: {
    id: 'omnihand', corner: 'tl', abbr: '⟐H', modeLabel: 'TBD',
    movable: false, keyboard: null,
    dirLabels: { up: '▲', down: '▼', left: '◄', right: '►' },
    centerLabel: null,
  },
  conscious: {
    id: 'conscious', corner: 'tr', abbr: 'CH', modeLabel: 'TBD',
    movable: false, keyboard: null,
    dirLabels: { up: '▲', down: '▼', left: '◄', right: '►' },
    centerLabel: null,
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
  touch-action     : manipulation;

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
      lh: { up: false, down: false, left: false, right: false },
      rh: { up: false, down: false, left: false, right: false },
    }

    this._v3fwd   = new THREE.Vector3()
    this._v3right = new THREE.Vector3()
    this._worldUp = new THREE.Vector3(0, 1, 0)

    this._onPadToggle  = this._handlePadToggle.bind(this)
    this._onPadsGlobal = this._handlePadsGlobal.bind(this)
    this._onKeyDown    = this._handleKeyDown.bind(this)
    this._onKeyUp      = this._handleKeyUp.bind(this)
  }

  init () {
    injectStyles()
    this._buildAllPads()
    this._bindGlobalEvents()
    this._bindKeyboard()
    console.log('⟐ MovementPad: initialized.')
  }

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
    window.removeEventListener('keydown',          this._onKeyDown)
    window.removeEventListener('keyup',            this._onKeyUp)
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

  // ── DOM construction ────────────────────────────────────────────────────────

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
    el.className = ['omni-pad', `omni-pad--${cfg.corner}`, isTBD ? 'omni-pad--tbd' : ''].filter(Boolean).join(' ')
    el.setAttribute('aria-label', `${cfg.abbr} movement pad`)
    el.setAttribute('role', 'group')
    el.appendChild(this._buildHeader(handId))
    el.appendChild(this._buildCross(handId))
    if (cfg.keyboard) el.appendChild(this._buildKeyHint(handId))
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
        btn.setPointerCapture(e.pointerId)
        this._setPressed(handId, dir, true)
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
    const isRH = handId === 'rh'
    const keys = isRH ? ['R', 'F'] : ['W', 'A', 'S', 'D']
    const dirs = isRH ? ['up', 'down'] : ['up', 'left', 'down', 'right']
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
  }

  // ── Press state ─────────────────────────────────────────────────────────────

  _setPressed (handId, dir, active, silent = false) {
    const state = this._pressed[handId]
    if (!state) return
    if (state[dir] === active) return
    state[dir] = active
    this._btnEls[handId]?.[dir]?.classList.toggle('is-pressed', active)
    this._keyEls[handId]?.[dir]?.classList.toggle('is-active',  active)
    if (!silent) {
      window.dispatchEvent(new CustomEvent('omni:movement', {
        detail: { hand: handId, direction: dir, active, mode: handId === 'rh' ? 'nav' : 'wasd' }
      }))
    }
  }

  // ── Camera movement ─────────────────────────────────────────────────────────

  _applyLHMovement (cam, delta) {
    const p = this._pressed.lh
    if (!p.up && !p.down && !p.left && !p.right) return
    const speed = MOVE_SPEED * delta
    cam.getWorldDirection(this._v3fwd)
    this._v3fwd.y = 0
    if (this._v3fwd.lengthSq() < 0.0001) return
    this._v3fwd.normalize()
    this._v3right.crossVectors(this._v3fwd, this._worldUp).normalize()
    if (p.up)    cam.position.addScaledVector(this._v3fwd,    speed)
    if (p.down)  cam.position.addScaledVector(this._v3fwd,   -speed)
    if (p.right) cam.position.addScaledVector(this._v3right,  speed)
    if (p.left)  cam.position.addScaledVector(this._v3right, -speed)
  }

  _applyRHMovement (cam, delta) {
    const p = this._pressed.rh
    if (!p.up && !p.down && !p.left && !p.right) return

    const vSpeed = MOVE_SPEED * delta
    if (p.up)   cam.position.y += vSpeed
    if (p.down) cam.position.y -= vSpeed

    if (p.left || p.right) {
      const angle = (p.right ? -1 : 1) * YAW_SPEED * delta
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
  }

  _handleKeyDown (e) {
    const tag = document.activeElement?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
    const mapped = this._mapKey(e.code)
    if (!mapped) return
    const { handId, dir } = mapped
    if (!this._visible[handId]) return
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
      default:     return null
    }
  }

  // ── Global events ───────────────────────────────────────────────────────────

  _bindGlobalEvents () {
    window.addEventListener('omni:pad-toggle',  this._onPadToggle)
    window.addEventListener('omni:pads-global', this._onPadsGlobal)
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