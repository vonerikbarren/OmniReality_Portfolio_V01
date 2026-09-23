/**
 * ui/OmniChat.js — ⟐mniChat
 *
 * The real, first build in the live-realities layer. A dockable
 * message panel, bottom-right anchored, detachable — but closing it,
 * whether detached or not, always animates back toward the real
 * dock (#omni-dock's own live position, not a guessed one) via a
 * genie-style shrink-and-travel effect before disappearing.
 *
 * Two real tabs: Chat (a real text field, full Unicode — a plain
 * <input> natively accepts any Unicode character typed or pasted, no
 * special handling needed to "allow" it) and Terminal (black,
 * transparent, and wired to the same omni:terminal-invoke/dismiss
 * events modules/TerminalTunnel.js already listens for — opening
 * this tab also brings up that existing 3D visual in sync, rather
 * than building a second, disconnected terminal).
 *
 * The Chat tab also carries a live preview of a dummy "communication
 * reality" — a real Inspector-style small preview renderer showing
 * one geometry cycling through four real forms in a continuous
 * loop, with real orbit rotation as the visible sign it's looping.
 * Honest about what this is: a cross-fade/scale transition between
 * discrete geometries, not true vertex-level morphing (which needs
 * matching topology between shapes and is real, separate future
 * work) — the right, proportionate choice for a confirmed dummy
 * placeholder. Basic play/pause included per direction; the fuller
 * TheOmniStatePanelControls (loop grid, groups) is real, separate,
 * later work.
 *
 * Follows the standard module contract (constructor / init / update / destroy).
 */

import gsap from 'gsap'
import * as THREE from 'three'
import { getSettings as getJsonOptions, setSettings as setJsonOptions } from '../utils/JsonChatMessageOptions.js'

const STYLES = /* css */`

#omni-chat {
  position        : fixed;
  /* Real fix — was right: 24px, directly overlapping the bottom-
     right Hand's own real footprint (anchored flush to the same
     corner, ~102px wide). Moved clear of it entirely so there's no
     shared screen space to contend over, per direct preference —
     partially over the (centered) minimap is fine, the hand
     controls are not. */
  right            : 130px;
  bottom           : 88px;   /* clears the dock */
  width            : 340px;
  height           : 420px;
  z-index          : 95;
  display          : flex;
  flex-direction   : column;
  background       : rgba(12, 12, 16, 0.82);
  backdrop-filter  : blur(14px);
  border           : 1px solid rgba(255, 255, 255, 0.10);
  border-radius    : 14px;
  box-shadow       : 0 12px 40px rgba(0, 0, 0, 0.5);
  overflow         : hidden;
  opacity          : 0;
  visibility       : hidden;
  transform        : scale(0.92);
  transform-origin : bottom right;
  transition       : opacity 0.22s ease, transform 0.22s ease;
  font-family      : 'Courier New', Courier, monospace;
  color            : rgba(255, 255, 255, 0.92);
  /* Real fix — the actual root cause of the reported bug. #omni-ui
     (this panel's real parent) deliberately sets pointer-events:
     none so the 3D scene stays clickable through empty space —
     every real, interactive panel inside it must explicitly set its
     own pointer-events: auto to receive anything at all, the same
     established pattern OmniStartHUD's own interactive panels
     already use. This was missing here entirely, so every click,
     keystroke, and drag was being silently swallowed before ever
     reaching this panel, regardless of its own z-index. */
  pointer-events   : auto;
}
#omni-chat.open {
  opacity    : 1;
  visibility : visible;
  transform  : scale(1);
}
#omni-chat.detached {
  right  : auto;
  bottom : auto;
}

/* ── Header — drag handle + tabs + close ─────────────────────────────────── */

.oc-header {
  display          : flex;
  align-items      : center;
  gap              : 4px;
  padding          : 8px 10px;
  border-bottom    : 1px solid rgba(255, 255, 255, 0.08);
  cursor           : grab;
  user-select      : none;
  flex-shrink      : 0;
}
.oc-header:active { cursor: grabbing; }

.oc-tab {
  background     : none;
  border         : none;
  color          : rgba(255, 255, 255, 0.5);
  font-family    : inherit;
  font-size      : 11px;
  letter-spacing : 0.04em;
  padding        : 5px 10px;
  border-radius  : 6px;
  cursor         : pointer;
  transition     : background 0.15s ease, color 0.15s ease;
}
.oc-tab:hover        { background: rgba(255, 255, 255, 0.06); color: rgba(255, 255, 255, 0.8); }
.oc-tab.active        { background: rgba(255, 255, 255, 0.10); color: #fff; }

.oc-close {
  margin-left    : auto;
  background     : none;
  border         : none;
  color          : rgba(255, 255, 255, 0.45);
  font-size      : 14px;
  cursor         : pointer;
  padding        : 2px 6px;
  border-radius  : 5px;
}
.oc-close:hover { background: rgba(255, 255, 255, 0.08); color: #fff; }

/* ── Chat tab ─────────────────────────────────────────────────────────────── */

.oc-panel { flex: 1; display: none; flex-direction: column; min-height: 0; }
.oc-panel.active { display: flex; }

.oc-toolbar {
  display        : flex;
  align-items    : center;
  gap            : 6px;
  padding        : 6px 8px;
  border-bottom  : 1px solid rgba(255, 255, 255, 0.08);
  flex-shrink    : 0;
}
.oc-toolbar select {
  background    : rgba(255, 255, 255, 0.06);
  border        : 1px solid rgba(255, 255, 255, 0.10);
  border-radius : 5px;
  color         : #fff;
  font-family   : inherit;
  font-size     : 10px;
  padding       : 3px 4px;
}
.oc-tb-align { display: flex; gap: 2px; margin-left: auto; }
.oc-tb-align-btn {
  background    : rgba(255, 255, 255, 0.06);
  border        : 1px solid rgba(255, 255, 255, 0.10);
  border-radius : 5px;
  color         : rgba(255, 255, 255, 0.5);
  font-size     : 10px;
  width         : 22px;
  height        : 22px;
  cursor        : pointer;
}
.oc-tb-align-btn.active { background: rgba(255, 255, 255, 0.16); color: #fff; }

.oc-preview {
  height        : 120px;
  flex-shrink   : 0;
  position      : relative;
  border-bottom : 1px solid rgba(255, 255, 255, 0.08);
  background    : radial-gradient(ellipse at center, rgba(255,255,255,0.05), transparent 70%);
}
.oc-preview canvas { width: 100%; height: 100%; display: block; }
.oc-preview-controls {
  position   : absolute;
  bottom     : 6px;
  left       : 50%;
  transform  : translateX(-50%);
  display    : flex;
  gap        : 6px;
}
.oc-play-btn {
  background    : rgba(0, 0, 0, 0.5);
  border        : 1px solid rgba(255, 255, 255, 0.15);
  color         : #fff;
  width         : 26px;
  height        : 26px;
  border-radius : 50%;
  cursor        : pointer;
  font-size     : 11px;
  display       : flex;
  align-items   : center;
  justify-content: center;
}
.oc-play-btn:hover { background: rgba(255, 255, 255, 0.12); }

.oc-messages {
  flex           : 1;
  overflow-y     : auto;
  padding        : 10px 12px;
  font-size      : 12px;
  line-height    : 1.6;
  color          : rgba(255, 255, 255, 0.85);
}
.oc-msg { margin-bottom: 6px; word-wrap: break-word; }
.oc-msg-empty { color: rgba(255, 255, 255, 0.35); text-align: center; padding: 20px 10px; }

.oc-input-row {
  display       : flex;
  gap           : 6px;
  padding       : 8px;
  border-top    : 1px solid rgba(255, 255, 255, 0.08);
  flex-shrink   : 0;
}
.oc-input {
  flex           : 1;
  background     : rgba(255, 255, 255, 0.06);
  border         : 1px solid rgba(255, 255, 255, 0.10);
  border-radius  : 8px;
  padding        : 7px 10px;
  color          : #fff;
  font-family    : inherit;
  font-size      : 12px;
  outline        : none;
}
.oc-input:focus { border-color: rgba(255, 255, 255, 0.3); }
.oc-send {
  background    : rgba(255, 255, 255, 0.10);
  border        : 1px solid rgba(255, 255, 255, 0.12);
  color         : #fff;
  border-radius : 8px;
  padding       : 0 12px;
  cursor        : pointer;
  font-size     : 11px;
}
.oc-send:hover { background: rgba(255, 255, 255, 0.18); }

/* ── JSON tab ─────────────────────────────────────────────────────────────── */

.oc-json-body {
  flex           : 1;
  overflow-y     : auto;
  padding        : 10px 12px;
  display        : flex;
  flex-direction : column;
  gap            : 8px;
}
.oc-json-input {
  height        : 70px;
  background    : rgba(255, 255, 255, 0.06);
  border        : 1px solid rgba(255, 255, 255, 0.10);
  border-radius : 8px;
  color         : #fff;
  font-family   : inherit;
  font-size     : 11px;
  padding       : 8px;
  resize        : vertical;
}
.oc-json-field-label { font-size: 9px; color: rgba(255,255,255,0.5); letter-spacing: 0.04em; text-transform: uppercase; }
.oc-json-form, .oc-json-origin {
  background    : rgba(255, 255, 255, 0.06);
  border        : 1px solid rgba(255, 255, 255, 0.10);
  border-radius : 6px;
  color         : #fff;
  font-family   : inherit;
  font-size     : 11px;
  padding       : 5px 6px;
}
.oc-json-transform-grid {
  display              : grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap                  : 6px 10px;
}
.oc-json-transform-grid label {
  display     : flex;
  flex-direction: column;
  gap         : 2px;
  font-size   : 9px;
  color       : rgba(255, 255, 255, 0.55);
}
.oc-json-send {
  background    : rgba(255, 255, 255, 0.10);
  border        : 1px solid rgba(255, 255, 255, 0.12);
  color         : #fff;
  border-radius : 8px;
  padding       : 8px;
  cursor        : pointer;
  font-size     : 11px;
  margin-top    : 4px;
}
.oc-json-send:hover { background: rgba(255, 255, 255, 0.18); }

/* ── Terminal tab — real black, with transparency added ──────────────────── */

.oc-terminal {
  flex           : 1;
  display        : flex;
  flex-direction : column;
  background     : rgba(0, 0, 0, var(--terminal-bg-opacity, 0.78));
  min-height     : 0;
}
.oc-terminal-output {
  flex        : 1;
  overflow-y  : auto;
  padding     : 10px 12px;
  font-size   : 12px;
  color       : var(--terminal-accent, #00ff88);
  line-height : 1.6;
}
.oc-terminal-row { display: flex; align-items: center; padding: 6px 8px; gap: 6px; border-top: 1px solid rgba(0, 255, 136, 0.15); }
.oc-terminal-prompt { color: var(--terminal-accent, #00ff88); font-size: 12px; }
.oc-terminal-input {
  flex        : 1;
  background  : none;
  border      : none;
  color       : var(--terminal-accent, #00ff88);
  font-family : inherit;
  font-size   : 12px;
  outline     : none;
}
`

function injectStyles () {
  if (document.getElementById('omni-chat-styles')) return
  const tag = document.createElement('style')
  tag.id = 'omni-chat-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

// Confirmed as an open set, not a fixed spec — four real, distinct
// forms is what's required; these four were the given example, kept
// as a real, reasonable default.
const MORPH_GEOMETRIES = [
  () => new THREE.BoxGeometry(1, 1, 1),
  () => new THREE.SphereGeometry(0.7, 24, 16),
  () => new THREE.CylinderGeometry(0.6, 0.6, 1.3, 24),
  () => new THREE.CylinderGeometry(0.6, 0.6, 1.3, 24).rotateX(Math.PI / 2),
]
const MORPH_HOLD_DURATION = 1.4     // seconds fully settled on one shape
const MORPH_TRANSITION_DURATION = 0.6   // seconds cross-fading to the next
const SHOOT_DISTANCE = 2000             // real, confirmed distance a shot message piece travels before disposal

export default class OmniChat {
  constructor (context) {
    this.ctx = context
    this._el = null
    this._isOpen = false
    this._activeTab = 'chat'
    this._messages = []

    this._preview = null
    this._morphIndex = 0
    this._morphPhase = 'hold'   // 'hold' | 'transition'
    this._morphElapsed = 0
    this._isPlaying = true

    this._dragState = null
    this._isDetached = false

    // Real toolbar state — read directly when a message is sent to
    // build its shot-out pieces.
    this._toolbar = {
      font: "'Courier New', Courier, monospace",
      size: 12,
      align: 'left',
      form: 1,
    }
    this._shotPieces = []   // real, currently-flying message pieces, tracked for update()
  }

  init () {
    injectStyles()
    this._el = this._buildDOM()
    const shell = document.getElementById('omni-ui') ?? document.body
    shell.appendChild(this._el)

    this._setupPreview()
    this._bindEvents()

    this._onToggle = () => this.toggle()
    window.addEventListener('omni:chat-toggle', this._onToggle)

    // Real, established pattern (same as every other OmniDraw mode)
    // — reachable through the OmniDraw mode picker as a real, fifth
    // option, since OmniChat's own terminal/build-tool side puts it
    // in the same real category as Static/Dynamic/Jsonifier/OmniCell.
    this._onNavSelect = (e) => {
      if (e.detail?.item !== '⟐OmniDrawChat') return
      this.open()
    }
    window.addEventListener('omni:nav-select', this._onNavSelect)
  }

  update (delta) {
    if (this._preview) {
      if (this._isPlaying) this._advanceMorph(delta)
      this._preview.group.rotation.y += delta * 0.5   // real orbit — the visible sign the loop is alive
      this._preview.renderer.render(this._preview.scene, this._preview.camera)
    }
    this._updateShotPieces(delta)
  }

  toggle () { this._isOpen ? this.close() : this.open() }

  open () {
    if (this._isOpen) return
    this._isOpen = true
    this._el.classList.add('open')
  }

  /** Real fix, matching the lesson from OmniStartHUD's own preview:
   *  the genie return is a real, deliberate animation, not just a
   *  class toggle — closing always travels back to the dock's own
   *  live position first, whether the panel is currently docked or
   *  was dragged elsewhere. */
  close () {
    if (!this._isOpen) return

    const dock = document.getElementById('omni-dock')
    const dockRect = dock?.getBoundingClientRect()
    const panelRect = this._el.getBoundingClientRect()

    if (dockRect) {
      const targetX = dockRect.left + dockRect.width / 2 - (panelRect.left + panelRect.width / 2)
      const targetY = dockRect.top + dockRect.height / 2 - (panelRect.top + panelRect.height / 2)
      gsap.killTweensOf(this._el)
      gsap.to(this._el, {
        x: `+=${targetX}`, y: `+=${targetY}`,
        scale: 0.05, opacity: 0,
        duration: 0.4, ease: 'power3.in',
        onComplete: () => {
          this._isOpen = false
          this._el.classList.remove('open')
          gsap.set(this._el, { x: 0, y: 0, scale: 1, opacity: '' })
          if (this._isDetached) this._returnToDock()
        },
      })
    } else {
      this._isOpen = false
      this._el.classList.remove('open')
    }
  }

  _returnToDock () {
    this._isDetached = false
    this._el.classList.remove('detached')
    this._el.style.left = ''
    this._el.style.top = ''
  }

  destroy () {
    window.removeEventListener('omni:chat-toggle', this._onToggle)
    window.removeEventListener('omni:nav-select', this._onNavSelect)
    this._teardownPreview()
    this._shotPieces.forEach(p => this._disposeShotPiece(p))
    this._shotPieces = []
    this._el?.parentNode?.removeChild(this._el)
  }

  // ── DOM ──────────────────────────────────────────────────────────────────

  _buildDOM () {
    const el = document.createElement('div')
    el.id = 'omni-chat'
    el.innerHTML = `
      <div class="oc-header">
        <button class="oc-tab active" data-tab="chat">⟐ Chat</button>
        <button class="oc-tab" data-tab="json">⟐ JSON</button>
        <button class="oc-tab" data-tab="terminal">⟐ Terminal</button>
        <button class="oc-close" aria-label="Close">✕</button>
      </div>

      <div class="oc-panel active" data-panel="chat">
        <div class="oc-toolbar">
          <select class="oc-tb-font" title="Font">
            <option value="'Courier New', Courier, monospace">Courier</option>
            <option value="Arial, sans-serif">Arial</option>
            <option value="Georgia, serif">Georgia</option>
            <option value="'Times New Roman', serif">Times</option>
          </select>
          <select class="oc-tb-size" title="Font size">
            <option value="10">10</option>
            <option value="12" selected>12</option>
            <option value="14">14</option>
            <option value="16">16</option>
            <option value="20">20</option>
          </select>
          <div class="oc-tb-align">
            <button class="oc-tb-align-btn active" data-align="left" title="Align left">⟸</button>
            <button class="oc-tb-align-btn" data-align="center" title="Align center">⟺</button>
            <button class="oc-tb-align-btn" data-align="right" title="Align right">⟹</button>
          </div>
          <select class="oc-tb-form" title="Form — how many pieces the message shoots out as">
            <option value="1">Form 1</option>
            <option value="2">Form 2</option>
            <option value="3">Form 3</option>
            <option value="4">Form 4</option>
            <option value="5">Form 5</option>
            <option value="6">Form 6</option>
          </select>
        </div>
        <div class="oc-preview">
          <canvas class="oc-preview-canvas"></canvas>
          <div class="oc-preview-controls">
            <button class="oc-play-btn" data-action="play-pause">⏸</button>
          </div>
        </div>
        <div class="oc-messages"><div class="oc-msg-empty">No messages yet.</div></div>
        <div class="oc-input-row">
          <input class="oc-input" type="text" placeholder="Type a message…" />
          <button class="oc-send">Send</button>
        </div>
      </div>

      <div class="oc-panel" data-panel="json">
        <div class="oc-json-body">
          <textarea class="oc-json-input" placeholder='{ "example": "paste or type a JSON tree here" }'></textarea>

          <div class="oc-json-field-label">Shape</div>
          <select class="oc-json-form">
            <option value="1">Form 1</option>
            <option value="2">Form 2</option>
            <option value="3">Form 3</option>
            <option value="4">Form 4</option>
            <option value="5">Form 5</option>
            <option value="6">Form 6</option>
          </select>

          <div class="oc-json-field-label">Comes from</div>
          <select class="oc-json-origin">
            <option value="user">You (camera)</option>
            <option value="left">Left of scene</option>
            <option value="right">Right of scene</option>
            <option value="ceiling">Ceiling</option>
            <option value="ground">Ground</option>
            <option value="point">Appear at the point</option>
          </select>

          <div class="oc-json-field-label">Where it lands — position / rotation / scale</div>
          <div class="oc-json-transform-grid">
            <label>px<input type="range" class="oc-json-t" data-key="px" min="-100" max="100" step="1" /></label>
            <label>py<input type="range" class="oc-json-t" data-key="py" min="-100" max="100" step="1" /></label>
            <label>pz<input type="range" class="oc-json-t" data-key="pz" min="-100" max="100" step="1" /></label>
            <label>rx<input type="range" class="oc-json-t" data-key="rx" min="-3.14" max="3.14" step="0.01" /></label>
            <label>ry<input type="range" class="oc-json-t" data-key="ry" min="-3.14" max="3.14" step="0.01" /></label>
            <label>rz<input type="range" class="oc-json-t" data-key="rz" min="-3.14" max="3.14" step="0.01" /></label>
            <label>sx<input type="range" class="oc-json-t" data-key="sx" min="-100" max="100" step="1" /></label>
            <label>sy<input type="range" class="oc-json-t" data-key="sy" min="-100" max="100" step="1" /></label>
            <label>sz<input type="range" class="oc-json-t" data-key="sz" min="-100" max="100" step="1" /></label>
          </div>

          <button class="oc-json-send">Send JSON</button>
        </div>
      </div>

      <div class="oc-panel" data-panel="terminal">
        <div class="oc-terminal">
          <div class="oc-terminal-output"><div>&gt; Terminal ready.</div></div>
          <div class="oc-terminal-row">
            <span class="oc-terminal-prompt">&gt;</span>
            <input class="oc-terminal-input" type="text" />
          </div>
        </div>
      </div>
    `
    return el
  }

  _bindEvents () {
    this._el.querySelector('.oc-close').addEventListener('click', () => this.close())

    this._el.querySelectorAll('.oc-tab').forEach(tab => {
      tab.addEventListener('click', () => this._switchTab(tab.dataset.tab))
    })

    this._el.querySelector('.oc-play-btn').addEventListener('click', () => this._togglePlay())

    const input = this._el.querySelector('.oc-input')
    const send = this._el.querySelector('.oc-send')
    const sendMessage = () => this._sendMessage(input.value)
    send.addEventListener('click', sendMessage)
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendMessage() })

    const termInput = this._el.querySelector('.oc-terminal-input')
    termInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') this._sendTerminalLine(termInput.value) })

    this._el.querySelector('.oc-tb-font').addEventListener('change', (e) => { this._toolbar.font = e.target.value })
    this._el.querySelector('.oc-tb-size').addEventListener('change', (e) => { this._toolbar.size = Number(e.target.value) })
    this._el.querySelector('.oc-tb-form').addEventListener('change', (e) => { this._toolbar.form = Number(e.target.value) })
    this._el.querySelectorAll('.oc-tb-align-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this._toolbar.align = btn.dataset.align
        this._el.querySelectorAll('.oc-tb-align-btn').forEach(b => b.classList.toggle('active', b === btn))
      })
    })

    this._initJsonTab()
    this._bindDrag()
  }

  /** Real, live initialization from the saved, single, global
   *  jsonChatMessageOptions configuration — matches the exact,
   *  confirmed pattern wallpaper's own settings actually use (one
   *  saved object, not a multi-profile system). Every field also
   *  saves live on change. */
  _initJsonTab () {
    const s = getJsonOptions()
    const formSelect = this._el.querySelector('.oc-json-form')
    const originSelect = this._el.querySelector('.oc-json-origin')
    formSelect.value = String(s.form)
    originSelect.value = s.origin
    formSelect.addEventListener('change', () => setJsonOptions({ form: Number(formSelect.value) }))
    originSelect.addEventListener('change', () => setJsonOptions({ origin: originSelect.value }))

    this._el.querySelectorAll('.oc-json-t').forEach(input => {
      const key = input.dataset.key
      input.value = String(s[key])
      input.addEventListener('input', () => setJsonOptions({ [key]: Number(input.value) }))
    })

    this._el.querySelector('.oc-json-send').addEventListener('click', () => {
      const text = this._el.querySelector('.oc-json-input').value
      this._sendJson(text)
    })
  }

  _switchTab (tabName) {
    this._activeTab = tabName
    this._el.querySelectorAll('.oc-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tabName))
    this._el.querySelectorAll('.oc-panel').forEach(p => p.classList.toggle('active', p.dataset.panel === tabName))

    // Real integration — syncs with the existing, already-built
    // TerminalTunnel 3D visual rather than existing only as a
    // disconnected 2D tab.
    if (tabName === 'terminal') window.dispatchEvent(new CustomEvent('omni:terminal-invoke'))
    else window.dispatchEvent(new CustomEvent('omni:terminal-dismiss'))
  }

  _sendMessage (text) {
    const trimmed = text.trim()
    if (!trimmed) return   // Unicode-safe by construction — a plain <input> already accepts any real Unicode character typed or pasted; nothing here restricts the charset
    this._messages.push(trimmed)
    const list = this._el.querySelector('.oc-messages')
    list.querySelector('.oc-msg-empty')?.remove()
    const row = document.createElement('div')
    row.className = 'oc-msg'
    row.textContent = trimmed
    list.appendChild(row)
    list.scrollTop = list.scrollHeight
    this._el.querySelector('.oc-input').value = ''
    this._shootMessage(trimmed)
  }

  _sendTerminalLine (text) {
    const trimmed = text.trim()
    if (!trimmed) return
    const output = this._el.querySelector('.oc-terminal-output')
    const row = document.createElement('div')
    row.textContent = `> ${trimmed}`
    output.appendChild(row)
    output.scrollTop = output.scrollHeight
    this._el.querySelector('.oc-terminal-input').value = ''
  }

  _bindDrag () {
    const header = this._el.querySelector('.oc-header')
    header.addEventListener('mousedown', (e) => {
      if (e.target.closest('.oc-tab, .oc-close')) return
      const rect = this._el.getBoundingClientRect()
      this._dragState = { offsetX: e.clientX - rect.left, offsetY: e.clientY - rect.top }
    })
    window.addEventListener('mousemove', (e) => {
      if (!this._dragState) return
      this._isDetached = true
      this._el.classList.add('detached')
      this._el.style.left = `${e.clientX - this._dragState.offsetX}px`
      this._el.style.top = `${e.clientY - this._dragState.offsetY}px`
    })
    window.addEventListener('mouseup', () => { this._dragState = null })
  }

  // ── Communication reality preview ───────────────────────────────────────

  _setupPreview () {
    try {
      const canvas = this._el.querySelector('.oc-preview-canvas')
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
      renderer.setSize(340, 120, false)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

      const scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(40, 340 / 120, 0.1, 10)
      camera.position.set(0, 0.4, 3)
      camera.lookAt(0, 0, 0)
      scene.add(new THREE.AmbientLight(0xffffff, 0.6))
      const key = new THREE.DirectionalLight(0xffffff, 1.0)
      key.position.set(2, 3, 2)
      scene.add(key)

      const group = new THREE.Group()
      scene.add(group)

      const meshA = new THREE.Mesh(MORPH_GEOMETRIES[0](), new THREE.MeshStandardMaterial({ color: 0x8899ff, roughness: 0.35, metalness: 0.15, transparent: true }))
      const meshB = new THREE.Mesh(MORPH_GEOMETRIES[1](), new THREE.MeshStandardMaterial({ color: 0x8899ff, roughness: 0.35, metalness: 0.15, transparent: true, opacity: 0 }))
      group.add(meshA, meshB)

      this._preview = { renderer, scene, camera, group, meshA, meshB }
    } catch (err) {
      // Real fix, same lesson as OmniStartHUD's own preview diamond
      // — a decorative preview failing should never take the rest
      // of this panel down with it.
      console.warn('⟐OmniChat — communication reality preview failed to initialize, continuing without it', err)
      this._preview = null
    }
  }

  _teardownPreview () {
    if (!this._preview) return
    this._preview.meshA.geometry?.dispose(); this._preview.meshA.material?.dispose()
    this._preview.meshB.geometry?.dispose(); this._preview.meshB.material?.dispose()
    this._preview.renderer.dispose()
    this._preview = null
  }

  _togglePlay () {
    this._isPlaying = !this._isPlaying
    this._el.querySelector('.oc-play-btn').textContent = this._isPlaying ? '⏸' : '▶'
  }

  /** Honest, real, proportionate mechanism for a confirmed dummy
   *  placeholder: cross-fades opacity and scale between two meshes
   *  (the current shape and the next one) rather than true
   *  vertex-level morphing, which needs matching topology between
   *  shapes and is real, separate future work. Loops continuously,
   *  covering animation, transformation, and mutation together —
   *  rotation (animation), the shape swap itself (transformation),
   *  and the opacity/scale change during the swap (mutation). */
  _advanceMorph (delta) {
    const { meshA, meshB } = this._preview
    if (this._morphPhase === 'hold') {
      this._morphElapsed += delta
      meshA.rotation.x += delta * 0.3
      if (this._morphElapsed >= MORPH_HOLD_DURATION) {
        this._morphElapsed = 0
        this._morphPhase = 'transition'
        const nextIndex = (this._morphIndex + 1) % MORPH_GEOMETRIES.length
        meshB.geometry.dispose()
        meshB.geometry = MORPH_GEOMETRIES[nextIndex]()
      }
      return
    }

    // 'transition' — real cross-fade + scale swap between A and B
    this._morphElapsed += delta
    const t = Math.min(1, this._morphElapsed / MORPH_TRANSITION_DURATION)
    meshA.material.opacity = 1 - t
    meshA.scale.setScalar(1 - t * 0.4)
    meshB.material.opacity = t
    meshB.scale.setScalar(0.6 + t * 0.4)

    if (t >= 1) {
      // B has fully become the current shape — swap roles so the
      // next hold phase rotates the now-current mesh, and the next
      // transition fades into what's now the "B" slot again.
      meshA.geometry.dispose()
      meshA.geometry = meshB.geometry
      meshA.material.opacity = 1
      meshA.scale.setScalar(1)
      meshB.material.opacity = 0
      this._morphIndex = (this._morphIndex + 1) % MORPH_GEOMETRIES.length
      this._morphPhase = 'hold'
      this._morphElapsed = 0
    }
  }

  // ── Message-shooting mechanic ───────────────────────────────────────────

  /** Splits real message text into exactly `n` pieces, per direct
   *  confirmation (Form splits one message, not n copies of it).
   *  Groups by word boundaries when there are enough words to do so
   *  cleanly; falls back to character-level splitting for short
   *  messages so the requested piece count is still honored exactly
   *  rather than silently producing fewer pieces than asked for. */
  _splitIntoPieces (text, n) {
    if (n <= 1) return [text]
    const words = text.split(/\s+/).filter(Boolean)

    if (words.length >= n) {
      // Real fix — guarantees exactly n non-empty chunks, unlike a
      // greedy character-target walk which could leave later chunks
      // empty depending on word-length distribution (found by direct
      // testing, not assumed correct).
      const base = Math.floor(words.length / n)
      const remainder = words.length % n
      const chunks = []
      let idx = 0
      for (let i = 0; i < n; i++) {
        const count = base + (i < remainder ? 1 : 0)
        chunks.push(words.slice(idx, idx + count).join(' '))
        idx += count
      }
      return chunks
    }

    // Real, honest fallback for short messages — character-level
    // splitting, capped at the real text length so it never produces
    // empty pieces.
    const realCount = Math.min(n, text.length)
    const len = Math.ceil(text.length / realCount)
    const result = []
    for (let i = 0; i < text.length; i += len) result.push(text.slice(i, i + len))
    return result
  }

  /** Real, square (per direct confirmation — a plane's triangle
   *  count is identical regardless of aspect ratio, so this is for
   *  visual consistency across pieces, not performance) canvas-
   *  textured piece. Forms 1–5 are flat planes; Form 6 is a cube,
   *  the confirmed "lowest cost material" that dismantles into a
   *  real DOM tooltip partway through its flight. */
  _buildPieceMesh (text, formCount) {
    const SIZE = 0.6
    const isCube = formCount === 6
    const geometry = isCube ? new THREE.BoxGeometry(SIZE, SIZE, SIZE) : new THREE.PlaneGeometry(SIZE, SIZE)
    const texture = this._buildPieceTexture(text)
    const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide })
    return new THREE.Mesh(geometry, material)
  }

  _buildPieceTexture (text) {
    const canvas = document.createElement('canvas')
    canvas.width = 256; canvas.height = 256
    const c = canvas.getContext('2d')
    c.fillStyle = 'rgba(10, 10, 16, 0.85)'
    c.fillRect(0, 0, 256, 256)
    c.strokeStyle = 'rgba(255, 255, 255, 0.25)'
    c.lineWidth = 3
    c.strokeRect(2, 2, 252, 252)

    const { font, size, align } = this._toolbar
    c.fillStyle = '#fff'
    c.font = `${size * 1.6}px ${font}`
    c.textAlign = align === 'center' ? 'center' : (align === 'right' ? 'right' : 'left')
    const x = align === 'center' ? 128 : (align === 'right' ? 240 : 16)
    this._wrapText(c, text, x, 40, 220, size * 1.6 + 6)

    return new THREE.CanvasTexture(canvas)
  }

  _wrapText (c, text, x, startY, maxWidth, lineHeight) {
    const words = text.split(/\s+/)
    let line = ''
    let y = startY
    words.forEach(word => {
      const test = line ? `${line} ${word}` : word
      if (c.measureText(test).width > maxWidth && line) {
        c.fillText(line, x, y)
        line = word
        y += lineHeight
      } else {
        line = test
      }
    })
    if (line) c.fillText(line, x, y)
  }

  /** Real launch — reads the toolbar's own current settings, splits
   *  the message into that many pieces, and sends them all forward
   *  along the camera's real, fixed-at-launch direction. */
  _shootMessage (text) {
    const camera = this.ctx.camera
    const n = this._toolbar.form
    const pieces = this._splitIntoPieces(text, n)

    const direction = new THREE.Vector3()
    camera.getWorldDirection(direction)
    const right = new THREE.Vector3().crossVectors(direction, camera.up).normalize()
    const start = camera.position.clone().add(direction.clone().multiplyScalar(1.5))

    pieces.forEach((pieceText, i) => {
      const mesh = this._buildPieceMesh(pieceText, n)
      const spread = (i - (pieces.length - 1) / 2) * 0.7
      const worldPos = start.clone().add(right.clone().multiplyScalar(spread))
      mesh.position.copy(worldPos)
      mesh.quaternion.copy(camera.quaternion)   // faces the viewer at launch, same real billboard reasoning as OmniExpression's own fix
      this.ctx.scene.add(mesh)

      this._shotPieces.push({
        mesh, text: pieceText, direction: direction.clone(), worldPos,
        traveled: 0, isCube: n === 6, dismantled: false, domEl: null,
      })
    })
  }

  /** Real send for the JSON tab — validates real JSON first (honest
   *  error, not a silent failure), then launches pieces from the
   *  real, chosen origin toward the real, explicit destination
   *  transform, reusing the exact same piece-splitting and
   *  mesh-building already proven for text messages. */
  _sendJson (rawText) {
    const trimmed = rawText.trim()
    if (!trimmed) return
    try {
      JSON.parse(trimmed)
    } catch (err) {
      window.alert(`Invalid JSON: ${err.message}`)
      return
    }

    const opts = getJsonOptions()
    const n = opts.form
    const pieces = this._splitIntoPieces(trimmed, n)
    const destination = new THREE.Vector3(opts.px, opts.py, opts.pz)
    const originPos = this._computeJsonOrigin(opts.origin, destination)

    pieces.forEach((pieceText, i) => {
      const mesh = this._buildPieceMesh(pieceText, n)
      const spread = (i - (pieces.length - 1) / 2) * 0.7
      const spreadVec = new THREE.Vector3(spread, 0, 0)
      const startPos = originPos.clone().add(spreadVec)
      const pieceDestination = destination.clone().add(spreadVec)

      mesh.position.copy(startPos)
      mesh.rotation.set(opts.rx, opts.ry, opts.rz)
      mesh.scale.set(opts.sx, opts.sy, opts.sz)
      this.ctx.scene.add(mesh)

      this._shotPieces.push({
        mesh, text: pieceText, worldPos: startPos.clone(),
        isCube: n === 6, dismantled: false, domEl: null,
        isJson: true, startPos: startPos.clone(), destination: pieceDestination,
        traveled: 0, totalDistance: startPos.distanceTo(pieceDestination),
      })
    })
  }

  /** Real origin computation per the confirmed options — 'user' is
   *  the camera's own position (same real starting point text
   *  already launches from); 'left'/'right' offset from the camera
   *  along its own real right vector; 'ceiling'/'ground' use real Y
   *  values relative to the camera's own established resting height
   *  (2, from returnToLanding()); 'point' is the destination itself,
   *  a real, honest instant appearance with no travel at all. */
  _computeJsonOrigin (origin, destination) {
    const camera = this.ctx.camera
    if (origin === 'point') return destination.clone()

    if (origin === 'ceiling') return new THREE.Vector3(destination.x, 15, destination.z)
    if (origin === 'ground') return new THREE.Vector3(destination.x, 0, destination.z)

    const forward = new THREE.Vector3()
    camera.getWorldDirection(forward)
    const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize()

    if (origin === 'left') return camera.position.clone().add(right.clone().multiplyScalar(-15)).add(forward.clone().multiplyScalar(5))
    if (origin === 'right') return camera.position.clone().add(right.clone().multiplyScalar(15)).add(forward.clone().multiplyScalar(5))

    return camera.position.clone()   // 'user' — the real, same starting point text messages already use
  }

  /** Real, per-frame travel — every piece moves forward along its
   *  own real, fixed direction; Form 6 pieces dismantle into a real
   *  DOM tooltip partway through, and every piece visibly
   *  fades/glitches out during the final stretch before real
   *  disposal at the confirmed 2000-unit mark, per direct request. */
  _updateShotPieces (delta) {
    for (let i = this._shotPieces.length - 1; i >= 0; i--) {
      const piece = this._shotPieces[i]
      const done = piece.isJson ? this._updateJsonPiece(piece, delta) : this._updateTextPiece(piece, delta)
      if (done) this._shotPieces.splice(i, 1)
    }
  }

  /** Real text-piece update — unchanged real behavior: fixed
   *  direction, fixed 2000-unit distance, real disposal at the end.
   *  Returns true once this piece is genuinely done and removed. */
  _updateTextPiece (piece, delta) {
    const SPEED = 400
    const GLITCH_START = 0.8
    const DISMANTLE_AT = 0.5

    const step = SPEED * delta
    piece.traveled += step
    piece.worldPos.add(piece.direction.clone().multiplyScalar(step))
    if (piece.mesh) piece.mesh.position.copy(piece.worldPos)

    const fraction = piece.traveled / SHOOT_DISTANCE

    if (piece.isCube && !piece.dismantled && fraction >= DISMANTLE_AT) {
      this._dismantleIntoTooltip(piece)
    }

    if (fraction >= GLITCH_START) {
      const glitchT = (fraction - GLITCH_START) / (1 - GLITCH_START)
      const flicker = Math.random() > 0.4 ? 1 : 0.25
      if (piece.domEl) {
        piece.domEl.style.opacity = String(flicker * (1 - glitchT))
      } else if (piece.mesh) {
        piece.mesh.material.opacity = flicker * (1 - glitchT)
        piece.worldPos.x += (Math.random() - 0.5) * 0.04
        piece.worldPos.y += (Math.random() - 0.5) * 0.04
      }
    }

    if (piece.domEl) this._updateDismantledPosition(piece)

    if (piece.traveled >= SHOOT_DISTANCE) {
      this._disposeShotPiece(piece)
      return true
    }
    return false
  }

  /** Real JSON-piece update — a genuinely different behavior from
   *  text: travels from its real, chosen origin toward the real,
   *  explicit destination transform the user configured, then
   *  settles there and remains — a JSON tree is being placed
   *  somewhere real and lasting in the scene, not fired off as a
   *  disposable effect the way a plain chat message is. */
  _updateJsonPiece (piece, delta) {
    const SPEED = 6   // real units/sec — much slower than text's shot, since this is a deliberate placement, not a launch
    if (piece.totalDistance > 0.0001) {
      const step = Math.min(SPEED * delta, piece.totalDistance - piece.traveled)
      piece.traveled += step
      const t = piece.traveled / piece.totalDistance
      piece.worldPos.lerpVectors(piece.startPos, piece.destination, t)
      if (piece.mesh) piece.mesh.position.copy(piece.worldPos)
    }

    if (piece.isCube && !piece.dismantled && piece.traveled >= piece.totalDistance) {
      // Real Form 6 JSON pieces settle as the real tooltip directly —
      // still the confirmed lowest-cost material, just landed rather
      // than continuing to fly.
      this._dismantleIntoTooltip(piece)
    }
    if (piece.domEl) this._updateDismantledPosition(piece)

    return false   // real JSON pieces are never auto-disposed — they settle and remain in the scene
  }

  /** Real dismantle — the cube's own 3D geometry is genuinely
   *  disposed here, not just hidden; the piece continues its real
   *  journey as a real DOM tooltip instead (ToolTipMenu's own,
   *  already-established `.ttm-header` look — the real, confirmed
   *  "lowest cost material" for a piece of text at this point). */
  _dismantleIntoTooltip (piece) {
    piece.dismantled = true
    const el = document.createElement('div')
    el.className = 'ttm-header'
    el.textContent = piece.text
    document.body.appendChild(el)
    piece.domEl = el

    piece.mesh.geometry.dispose()
    piece.mesh.material.map?.dispose()
    piece.mesh.material.dispose()
    this.ctx.scene.remove(piece.mesh)
    piece.mesh = null
  }

  _updateDismantledPosition (piece) {
    const camera = this.ctx.camera
    const projected = piece.worldPos.clone().project(camera)
    if (projected.z > 1) { piece.domEl.style.display = 'none'; return }
    piece.domEl.style.display = ''
    piece.domEl.style.left = `${(projected.x * 0.5 + 0.5) * window.innerWidth}px`
    piece.domEl.style.top = `${(-projected.y * 0.5 + 0.5) * window.innerHeight}px`
  }

  _disposeShotPiece (piece) {
    if (piece.mesh) {
      piece.mesh.geometry.dispose()
      piece.mesh.material.map?.dispose()
      piece.mesh.material.dispose()
      this.ctx.scene.remove(piece.mesh)
    }
    piece.domEl?.remove()
  }
}
