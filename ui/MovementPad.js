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
 *   ⟐RH       BR  →  HEIGHT — vertical world-space movement
 *                      Up   → Rise  (R key)
 *                      Down → Fall  (F key)
 *                      Left/Right → reserved
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

const MOVE_SPEED = 20

const BAR_H      = 36
const DOCK_H     = 52
const HAND_CELL  = 44
const HAND_GAP   = 2
const HAND_WH    = HAND_CELL * 2 + HAND_GAP

const PAD_CELL   = 44
const PAD_GAP    = 4
const PAD_INNER  = 10
const PAD_OFFSET = 4

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
    id: 'rh', corner: 'br', abbr: 'RH', modeLabel: 'HEIGHT',
    movable: true, keyboard: 'rf',
    dirLabels: { up: 'RISE', down: 'FALL', left: '—', right: '—' },
    centerLabel: '⟐RH',
  },
}

const DIRS       = ['up', 'down', 'left', 'right']
const DIR_GLYPHS = { up: '▲', down: '▼', left: '◄', right: '►' }

const STYLES = `
.omni-pad {
  --pad-bg          : rgba(8, 8, 12, 0.50);
  --pad-border      : rgba(255, 255, 255, 0.08);
  --pad-btn-bg      : rgba(255, 255, 255, 0.05);
  --pad-btn-hover   : rgba(255, 255, 255, 0.13);
  --pad-btn-press   : rgba(255, 255, 255, 0.26);
  --pad-text        : rgba(255, 255, 255, 0.90);
  --pad-text-dim    : rgba(255, 255, 255, 0.70);
  --pad-accent      : rgba(255, 255, 255, 0.96);
  --pad-glow        : 0 0 10px rgba(255, 255, 255, 0.22);
  --pad-glow-press  : 0 0 14px rgba(255, 255, 255, 0.40);
  --mono            : 'Courier New', Courier, monospace;
  --pad-cell        : ${PAD_CELL}px;
  --pad-gap         : ${PAD_GAP}px;
  --pad-inner       : ${PAD_INNER}px;

  position          : fixed;
  z-index           : 41;
  pointer-events    : none;
  opacity           : 0;
  user-select       : none;

  background        : var(--pad-bg);
  backdrop-filter   : blur(18px) saturate(1.5);
  -webkit-backdrop-filter: blur(18px) saturate(1.5);
  border            : 1px solid var(--pad-border);
  border-radius     : 50.0%;
  padding           : var(--pad-inner);
  padding-bottom    : 90px;
  width             : 205px;
  height            : 205px;
  overflow          : hidden;

  display           : flex;
  flex-direction    : column;
  gap               : 7px;

  -webkit-font-smoothing: antialiased;
}

/* ── Corner anchoring ──────────────────────────────────────────────────────── */

.omni-pad--tl {
  top              : ${BAR_H + HAND_WH + PAD_OFFSET}px;
  left             : 4px;
  transform-origin : top left;
}
.omni-pad--tr {
  top              : ${BAR_H + HAND_WH + PAD_OFFSET}px;
  right            : 4px;
  transform-origin : top right;
}
.omni-pad--bl {
  bottom           : ${DOCK_H + HAND_WH + PAD_OFFSET}px;
  left             : 4px;
  transform-origin : bottom left;
}
.omni-pad--br {
  bottom           : ${DOCK_H + HAND_WH + PAD_OFFSET}px;
  right            : 4px;
  transform-origin : bottom right;
}

/* ── Header ────────────────────────────────────────────────────────────────── */

.pad-header {
  display          : flex;
  align-items      : center;
  justify-content  : space-between;
  padding          : 0 2px;
  padding-bottom   : 1px;
  border-bottom    : 1px solid rgba(255, 255, 255, 0.05);
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
  padding-top           : 12px;
  padding-left          : 20px;
  
}

.pad-slot-empty {}

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

.pad-btn--tbd,
.pad-btn--inactive {
  opacity          : 0.22;
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
    width          : 148px;
    height         : 148px;
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
    const modeLabel = document.createElement('span')
    modeLabel.className   = 'pad-mode-label'
    modeLabel.textContent = cfg.modeLabel
    header.appendChild(abbr)
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
    const cfg        = PAD_CONFIGS[handId]
    const isTBD      = !cfg.movable
    const isInactive = handId === 'rh' && (dir === 'left' || dir === 'right')
    const label      = cfg.dirLabels?.[dir] ?? DIR_GLYPHS[dir]
    const btn = document.createElement('button')
    btn.className = ['pad-btn', `pad-btn--${dir}`, isTBD ? 'pad-btn--tbd' : '', isInactive ? 'pad-btn--inactive' : ''].filter(Boolean).join(' ')
    btn.dataset.hand = handId
    btn.dataset.dir  = dir
    if (isTBD || isInactive) {
      btn.disabled = true
    } else {
      btn.setAttribute('aria-label', `${dir}: ${label}`)
    }
    btn.innerHTML = `<span class="pad-glyph">${DIR_GLYPHS[dir]}</span><span class="pad-dir-label">${label}</span>`
    if (!isTBD && !isInactive) {
      btn.addEventListener('pointerdown', (e) => { e.preventDefault(); btn.setPointerCapture(e.pointerId); this._setPressed(handId, dir, true) })
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
    lbl.className = 'pad-keys-label'
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

  _animateIn (handId) {
    const el = this._els[handId]
    if (!el) return
    gsap.killTweensOf(el)
    el.style.pointerEvents = 'auto'
    gsap.fromTo(el, { opacity: 0, scale: 0.80 }, { opacity: 1, scale: 1, duration: 0.24, ease: 'back.out(1.8)', onComplete () { el.style.transform = '' } })
  }

  _animateOut (handId) {
    const el = this._els[handId]
    if (!el) return
    gsap.killTweensOf(el)
    gsap.to(el, { opacity: 0, scale: 0.82, duration: 0.16, ease: 'power2.in', onComplete: () => {
      el.style.pointerEvents = 'none'
      el.style.transform = ''
      if (this._pressed[handId]) DIRS.forEach(d => this._setPressed(handId, d, false, true))
    }})
  }

  _setPressed (handId, dir, active, silent = false) {
    const state = this._pressed[handId]
    if (!state) return
    if (state[dir] === active) return
    state[dir] = active
    this._btnEls[handId]?.[dir]?.classList.toggle('is-pressed', active)
    this._keyEls[handId]?.[dir]?.classList.toggle('is-active',  active)
    if (!silent) {
      window.dispatchEvent(new CustomEvent('omni:movement', {
        detail: { hand: handId, direction: dir, active, mode: handId === 'rh' ? 'vertical' : 'wasd' }
      }))
    }
  }

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
    if (!p.up && !p.down) return
    const speed = MOVE_SPEED * delta
    if (p.up)   cam.position.y += speed
    if (p.down) cam.position.y -= speed
  }

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

  _bindGlobalEvents () {
    window.addEventListener('omni:pad-toggle',  this._onPadToggle)
    window.addEventListener('omni:pads-global', this._onPadsGlobal)
  }

  _handlePadToggle (e) {
    const { hand, visible } = e.detail ?? {}
    if (hand) this.setVisible(hand, visible)
  }

  _handlePadsGlobal (e) {
    this.setAllVisible(e.detail?.visible ?? false)
  }
}