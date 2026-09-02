/**
 * ui/OmniKeys.js — ⟐mniReality OmniKeys
 *
 * The flat (2D) layer of the dimensional keyboard — see
 * OMNIKEYBOARD_DESIGN.md for the full staged design. This is Stage 1:
 * a flat panel, same chrome as every other panel, with a basic grid of
 * keys. The dimensional (3D cube-face) system, Hybrid/QuadBrid
 * hand-split modes, and RGBA/spacing controls are all documented there
 * and deliberately NOT built here.
 *
 * Opens from the top-left drawer (⟐mniMenu → ⟐OmniKeys™ — a top-level
 * trademark item).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Layout
 * ─────────────────────────────────────────────────────────────────────────────
 * 8 rows × 16 columns (128 keys) — deliberately not a real-keyboard
 * mirror ("it doesn't need to, and I think it's outdated anyway").
 * Pre-filled with a sensible default character layout on first use.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Three modes
 * ─────────────────────────────────────────────────────────────────────────────
 *   Edit     — click a key to open it in OmniKeys' own Inspector
 *              (title + string macro value). CRUD, persisted.
 *   Delivery — click a key to actually create a Dimensional Text node
 *              in the 3D world using that key's string (see
 *              systems/OmniNode.js's _buildTextSprite — canvas-texture
 *              sprite, not real 3D letterforms, for performance).
 *   Sequence — click a key to open it in the Inspector focused on its
 *              start/end transformation fields (see
 *              DIMENSIONAL_TEXT_DESIGN.md). Fields only in this pass —
 *              the actual transformation playback is future work.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Persistence
 * ─────────────────────────────────────────────────────────────────────────────
 * All 128 keys' title/string/sequence data live in one localStorage
 * key (`omni:omnikeys:keys`) — a flat object keyed by key index,
 * following the same "one blob" pattern as Admin's settings rather
 * than 128 separate storage entries.
 *
 * Follows the standard module contract (constructor / init / update / destroy).
 */

import gsap from 'gsap'
import * as WindowManager from './WindowManager.js'
import { generateId } from '../systems/OmniNode.js'

const ROWS = 8
const COLS = 16
const TOTAL_KEYS = ROWS * COLS
const STORE_KEY = 'omni:omnikeys:keys'

const MODES = ['Edit', 'Delivery', 'Sequence']

// Default character fill — letters, digits, common symbols, cycling to
// fill all 128 slots. Not a real-keyboard layout by design.
const DEFAULT_CHARS = (
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ' +
  'abcdefghijklmnopqrstuvwxyz' +
  '0123456789' +
  '!@#$%^&*()-_=+[]{};:\'",.<>/?\\|~` '
).split('')

function defaultKeyData (index) {
  const ch = DEFAULT_CHARS[index % DEFAULT_CHARS.length]
  return {
    title: ch === ' ' ? 'Space' : ch,
    string: ch,
    sequenceStart: { fontSize: 1, case: 'none', opacity: 1, color: '#ffffff' },
    sequenceEnd:   { fontSize: 1, case: 'none', opacity: 1, color: '#ffffff' },
  }
}

function loadKeys () {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    const saved = raw ? JSON.parse(raw) : {}
    const keys = {}
    for (let i = 0; i < TOTAL_KEYS; i++) {
      keys[i] = { ...defaultKeyData(i), ...(saved[i] ?? {}) }
    }
    return keys
  } catch (_) {
    const keys = {}
    for (let i = 0; i < TOTAL_KEYS; i++) keys[i] = defaultKeyData(i)
    return keys
  }
}

function saveKeys (keys) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(keys)) } catch (err) {
    console.warn('⟐OmniKeys — localStorage save failed:', err)
  }
}

const STYLES = /* css */`

.omni-keys-panel {
  --ok-bg          : var(--omni-theme-bg, rgba(8, 8, 12, 0.92));
  --ok-border      : var(--omni-theme-border, rgba(255, 255, 255, 0.09));
  --ok-header-bg   : var(--omni-theme-header-bg, rgba(255, 255, 255, 0.03));
  --ok-text        : var(--omni-theme-text, rgba(255, 255, 255, 1));
  --ok-text-dim    : var(--omni-theme-text-dim, rgba(255, 255, 255, 0.85));
  --ok-text-muted  : var(--omni-theme-text-muted, rgba(255, 255, 255, 0.6));
  --ok-accent      : var(--omni-theme-accent, #7fd8ff);
  --mono           : 'Courier New', Courier, monospace;

  position         : fixed;
  top              : 90px;
  left             : 90px;
  width            : 760px;
  min-width        : 520px;
  max-width        : 96vw;
  height           : 420px;
  min-height       : 300px;
  max-height       : 92vh;

  display          : flex;
  flex-direction   : column;

  background       : var(--ok-bg);
  backdrop-filter  : blur(22px) saturate(1.5);
  -webkit-backdrop-filter: blur(22px) saturate(1.5);
  border           : 1px solid var(--ok-border);
  border-radius    : 14px;
  box-shadow       : 0 0 24px rgba(0,0,0,0.4), 0 12px 40px rgba(0,0,0,0.55);

  font-family      : var(--mono);
  color            : var(--ok-text);
  z-index          : 60;
  overflow         : hidden;
  pointer-events   : auto;
  resize           : both;

  opacity          : 0;
  transform        : scale(0.94);
}

.ok-header {
  position         : relative;
  height           : 44px;
  flex-shrink      : 0;
  display          : flex;
  align-items      : center;
  justify-content  : space-between;
  padding          : 0 12px;
  gap              : 10px;
  background       : var(--ok-header-bg);
  border-bottom    : 1px solid var(--ok-border);
  cursor           : grab;
  user-select      : none;
}
.ok-header.is-dragging { cursor: grabbing; }

.ok-title {
  font-size        : 12px;
  letter-spacing   : 0.06em;
  color            : var(--ok-text-dim);
  flex-shrink      : 0;
}

.ok-modes {
  display          : flex;
  gap              : 4px;
  background       : rgba(255,255,255,0.05);
  border           : 1px solid var(--ok-border);
  border-radius    : 7px;
  padding          : 2px;
}
.ok-mode-btn {
  background       : none;
  border           : none;
  color            : var(--ok-text-muted);
  font-family      : var(--mono);
  font-size        : 10px;
  letter-spacing   : 0.03em;
  padding          : 5px 10px;
  border-radius    : 5px;
  cursor           : pointer;
  transition       : background 0.12s ease, color 0.12s ease;
}
.ok-mode-btn:hover { color: var(--ok-text); }
.ok-mode-btn.is-active {
  background       : rgba(127, 216, 255, 0.18);
  color            : var(--ok-accent);
}
.ok-mode-btn--delivery.is-active { background: rgba(140, 255, 180, 0.18); color: rgba(160, 255, 195, 0.95); }
.ok-mode-btn--sequence.is-active { background: rgba(190, 160, 255, 0.18); color: rgba(210, 185, 255, 0.95); }

.ok-controls { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.ok-ctrl {
  width            : 24px;
  height           : 24px;
  border-radius    : 6px;
  border           : 1px solid var(--ok-border);
  background       : rgba(255,255,255,0.04);
  color            : var(--ok-text-dim);
  font-size        : 11px;
  display          : flex;
  align-items      : center;
  justify-content  : center;
  cursor           : pointer;
  transition       : background 0.12s ease, color 0.12s ease, border-color 0.12s ease;
}
.ok-ctrl:hover { background: rgba(255,255,255,0.10); border-color: rgba(255,255,255,0.24); color: var(--ok-text); }
.ok-ctrl--inspector { color: rgba(190, 160, 255, 0.85); border-color: rgba(190, 160, 255, 0.22); }
.ok-ctrl--inspector:hover { background: rgba(190, 160, 255, 0.14); }

.ok-mode-note {
  flex-shrink      : 0;
  text-align       : center;
  font-size        : 9px;
  color            : var(--ok-text-muted);
  padding          : 4px;
  border-bottom    : 1px solid rgba(255,255,255,0.05);
}

.ok-grid-wrap {
  flex             : 1 1 auto;
  overflow         : auto;
  padding          : 10px;
}

.ok-grid {
  display              : grid;
  grid-template-columns: repeat(${COLS}, minmax(34px, 1fr));
  grid-template-rows   : repeat(${ROWS}, minmax(34px, 1fr));
  gap                  : 4px;
  min-width            : 620px;
  height               : 100%;
}

.ok-key {
  display          : flex;
  align-items      : center;
  justify-content  : center;
  background       : rgba(255,255,255,0.05);
  border           : 1px solid rgba(255,255,255,0.10);
  border-radius    : 5px;
  color            : var(--ok-text-dim);
  font-family      : var(--mono);
  font-size        : 11px;
  cursor           : pointer;
  user-select      : none;
  transition       : background 0.1s ease, border-color 0.1s ease, transform 0.06s ease;
  overflow         : hidden;
  white-space      : nowrap;
  text-overflow    : ellipsis;
  padding          : 0 3px;
}
.ok-key:hover { background: rgba(255,255,255,0.11); border-color: rgba(255,255,255,0.25); color: var(--ok-text); }
.ok-key:active { transform: scale(0.93); }
.ok-key.is-selected { border-color: var(--ok-accent); box-shadow: 0 0 0 1px var(--ok-accent); color: var(--ok-text); }

.ok-resize-handle {
  position         : absolute; right: 0; bottom: 0;
  width            : 16px; height: 16px;
  cursor           : nwse-resize;
  z-index          : 2;
}
.ok-resize-handle::before {
  content          : '';
  position         : absolute; right: 3px; bottom: 3px;
  width            : 8px; height: 8px;
  border-right     : 2px solid rgba(255, 255, 255, 0.25);
  border-bottom    : 2px solid rgba(255, 255, 255, 0.25);
  border-radius    : 0 0 2px 0;
}
.ok-resize-handle:hover::before { border-color: rgba(255, 255, 255, 0.6); }

`

function injectStyles () {
  if (document.getElementById('omni-keys-styles')) return
  const tag = document.createElement('style')
  tag.id = 'omni-keys-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

export default class OmniKeys {
  constructor (context) {
    this.ctx = context
    this._el = null
    this._isOpen = false
    this._drag = { active: false, startX: 0, startY: 0, originX: 0, originY: 0 }
    this._mode = 'Edit'
    this._keys = loadKeys()
    this._selectedIndex = null
    this._onNavSelect = null
    this._onInspectorUpdate = null
  }

  init () {
    injectStyles()
    this._onNavSelect = (e) => {
      if (e.detail?.item !== '⟐OmniKeys') return
      this.open()
    }
    window.addEventListener('omni:nav-select', this._onNavSelect)

    // OmniKeysInspector edits flow back here so the grid's own display
    // (key titles) and persistence stay in sync with the Inspector.
    this._onInspectorUpdate = (e) => {
      const { index, keyData } = e.detail ?? {}
      if (index == null) return
      this._keys[index] = keyData
      saveKeys(this._keys)
      this._refreshKeyLabel(index)
    }
    window.addEventListener('omni:omnikeys-key-updated', this._onInspectorUpdate)
  }

  update () {}
  onResize () {}

  destroy () {
    window.removeEventListener('omni:nav-select', this._onNavSelect)
    window.removeEventListener('omni:omnikeys-key-updated', this._onInspectorUpdate)
    this._el?.parentNode?.removeChild(this._el)
    WindowManager.unregister('omnikeys')
  }

  open () {
    if (!this._el) this._el = this._buildDOM()
    const shell = document.getElementById('omni-ui') ?? document.body
    shell.appendChild(this._el)
    this._el.style.visibility = 'visible'
    gsap.to(this._el, { opacity: WindowManager.getPanelOpacity(), scale: 1, duration: 0.28, ease: 'back.out(1.4)' })
    this._isOpen = true
  }

  close () {
    if (!this._el) return
    gsap.to(this._el, {
      opacity: 0, scale: 0.94, duration: 0.18, ease: 'power1.in',
      onComplete: () => { this._el.style.visibility = 'hidden' },
    })
    this._isOpen = false
  }

  minimize () {
    if (!this._el) return
    const rect = this._el.getBoundingClientRect()
    gsap.to(this._el, {
      opacity: 0, scale: 0.3, duration: 0.22, ease: 'power2.in',
      onComplete: () => { this._el.style.visibility = 'hidden' },
    })
    this._isOpen = false
    window.dispatchEvent(new CustomEvent('omni:panel-minimized', {
      detail: {
        id: 'omnikeys', label: '⟐OmniKeys', iconLabel: '⟐K',
        fromRect: { x: rect.left, y: rect.top, w: rect.width, h: rect.height },
        variant: 'orb',
      }
    }))
  }

  // ── DOM ──────────────────────────────────────────────────────────────────

  _buildDOM () {
    const el = document.createElement('div')
    el.className = 'omni-keys-panel'
    el.innerHTML = /* html */`
      <div class="ok-header">
        <span class="ok-title">⟐OmniKeys</span>
        <div class="ok-modes" id="ok-modes">
          ${MODES.map(m => /* html */`
            <button class="ok-mode-btn ok-mode-btn--${m.toLowerCase()} ${m === this._mode ? 'is-active' : ''}" data-mode="${m}">${m}</button>
          `).join('')}
        </div>
        <div class="ok-controls">
          <button class="ok-ctrl ok-ctrl--inspector" data-action="inspector" title="Open OmniKeys Inspector">⟐i</button>
          <button class="ok-ctrl" data-action="minimize" title="Minimize">–</button>
          <button class="ok-ctrl" data-action="close" title="Close">×</button>
        </div>
      </div>
      <div class="ok-mode-note" id="ok-mode-note"></div>
      <div class="ok-grid-wrap">
        <div class="ok-grid" id="ok-grid"></div>
      </div>
      <div class="ok-resize-handle" aria-hidden="true"></div>
    `

    this._buildGrid(el.querySelector('#ok-grid'))
    this._updateModeNote(el)
    this._bindHeader(el)
    this._bindResize(el)

    el.querySelectorAll('[data-mode]').forEach(btn => {
      btn.addEventListener('click', () => this._setMode(btn.dataset.mode, el))
    })
    el.querySelector('[data-action="minimize"]').addEventListener('click', () => this.minimize())
    el.querySelector('[data-action="close"]').addEventListener('click', () => this.close())
    el.querySelector('[data-action="inspector"]').addEventListener('click', () => this._openInspectorForSelected())

    el.dataset.winId = 'omnikeys'
    WindowManager.register('omnikeys', el, 'OmniKeys')
    WindowManager.watchPanelOpacity(el, () => this._isOpen)
    WindowManager.registerContextMenu('omnikeys', {
      Objects: [
        { label: '⟐i Open Inspector', action: () => this._openInspectorForSelected() },
      ],
    })

    return el
  }

  _buildGrid (grid) {
    grid.innerHTML = ''
    for (let i = 0; i < TOTAL_KEYS; i++) {
      const key = this._keys[i]
      const btn = document.createElement('div')
      btn.className = 'ok-key'
      btn.dataset.index = String(i)
      btn.textContent = key.title
      btn.title = key.string
      btn.addEventListener('click', () => this._onKeyClick(i))
      grid.appendChild(btn)
    }
  }

  _refreshKeyLabel (index) {
    const btn = this._el?.querySelector(`.ok-key[data-index="${index}"]`)
    if (!btn) return
    btn.textContent = this._keys[index].title
    btn.title = this._keys[index].string
  }

  _setMode (mode, el) {
    this._mode = mode
    el.querySelectorAll('[data-mode]').forEach(btn => {
      btn.classList.toggle('is-active', btn.dataset.mode === mode)
    })
    this._updateModeNote(el)
  }

  _updateModeNote (el) {
    const note = el.querySelector('#ok-mode-note')
    if (!note) return
    const notes = {
      Edit: 'Click a key to edit its title + string in the Inspector',
      Delivery: 'Click a key to create a Dimensional Text node in the world',
      Sequence: 'Click a key to edit its start → end transformation in the Inspector',
    }
    note.textContent = notes[this._mode] ?? ''
  }

  _onKeyClick (index) {
    this._selectedIndex = index
    this._el?.querySelectorAll('.ok-key').forEach(k => k.classList.remove('is-selected'))
    this._el?.querySelector(`.ok-key[data-index="${index}"]`)?.classList.add('is-selected')

    if (this._mode === 'Delivery') {
      this._deliverKey(index)
      return
    }

    // Edit and Sequence modes both open the Inspector — same panel,
    // the Inspector itself decides which fields to bring into view
    // based on which mode requested it.
    this._openInspectorFor(index, this._mode)
  }

  /** Delivery mode — actually spawns a Dimensional Text node in the
   *  world using this key's string. Positioned a few units in front of
   *  the camera, same convention used by ui/OmniDraw.js and the
   *  Inspector's own Create section. */
  _deliverKey (index) {
    const key = this._keys[index]
    const cam = this.ctx.camera
    const fx = -Math.sin(cam.rotation.y) * Math.cos(cam.rotation.x)
    const fy = Math.sin(cam.rotation.x)
    const fz = -Math.cos(cam.rotation.y) * Math.cos(cam.rotation.x)

    window.dispatchEvent(new CustomEvent('omni:node-create-request', {
      detail: {
        id: generateId(),
        label: 'Text_' + Date.now().toString(36).slice(-4),
        geometry: 'DimensionalText',
        primitive: 'objective',
        color: key.sequenceStart?.color ?? '#ffffff',
        text: key.string,
        textSequence: { start: key.sequenceStart, end: key.sequenceEnd },
        position: [cam.position.x + fx * 5, Math.max(0.5, cam.position.y + fy * 5), cam.position.z + fz * 5],
        parentId: null,
      }
    }))
  }

  _openInspectorForSelected () {
    if (this._selectedIndex == null) return
    this._openInspectorFor(this._selectedIndex, this._mode === 'Sequence' ? 'Sequence' : 'Edit')
  }

  _openInspectorFor (index, focusMode) {
    window.dispatchEvent(new CustomEvent('omni:omnikeys-inspect-request', {
      detail: { index, keyData: this._keys[index], focusMode }
    }))
  }

  // ── Header drag / resize — same pattern as every other panel ─────────────

  _bindHeader (el) {
    const header = el.querySelector('.ok-header')
    const onDown = (e) => {
      if (e.target.closest('button')) return
      const cx = e.touches?.[0]?.clientX ?? e.clientX
      const cy = e.touches?.[0]?.clientY ?? e.clientY
      const rect = el.getBoundingClientRect()
      this._drag = { active: true, startX: cx, startY: cy, originX: rect.left, originY: rect.top }
      header.classList.add('is-dragging')
    }
    const onMove = (e) => {
      if (!this._drag.active) return
      const cx = e.touches?.[0]?.clientX ?? e.clientX
      const cy = e.touches?.[0]?.clientY ?? e.clientY
      gsap.set(el, { left: this._drag.originX + (cx - this._drag.startX), top: this._drag.originY + (cy - this._drag.startY) })
    }
    const onUp = () => { this._drag.active = false; header.classList.remove('is-dragging') }

    header.addEventListener('mousedown', onDown)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    header.addEventListener('touchstart', onDown, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', onUp)
  }

  _bindResize (el) {
    const handle = el.querySelector('.ok-resize-handle')
    if (!handle) return
    const resize = { active: false, startX: 0, startY: 0, startW: 0, startH: 0 }
    const onDown = (e) => {
      e.stopPropagation()
      const cx = e.touches?.[0]?.clientX ?? e.clientX
      const cy = e.touches?.[0]?.clientY ?? e.clientY
      const rect = el.getBoundingClientRect()
      resize.active = true; resize.startX = cx; resize.startY = cy
      resize.startW = rect.width; resize.startH = rect.height
    }
    const onMove = (e) => {
      if (!resize.active) return
      const cx = e.touches?.[0]?.clientX ?? e.clientX
      const cy = e.touches?.[0]?.clientY ?? e.clientY
      gsap.set(el, { width: resize.startW + (cx - resize.startX), height: resize.startH + (cy - resize.startY) })
    }
    const onUp = () => { resize.active = false }
    handle.addEventListener('mousedown', onDown)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    handle.addEventListener('touchstart', onDown, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', onUp)
  }
}
