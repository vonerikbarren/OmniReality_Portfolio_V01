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
    if (!this._preview) return
    if (this._isPlaying) this._advanceMorph(delta)
    this._preview.group.rotation.y += delta * 0.5   // real orbit — the visible sign the loop is alive
    this._preview.renderer.render(this._preview.scene, this._preview.camera)
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
    this._el?.parentNode?.removeChild(this._el)
  }

  // ── DOM ──────────────────────────────────────────────────────────────────

  _buildDOM () {
    const el = document.createElement('div')
    el.id = 'omni-chat'
    el.innerHTML = `
      <div class="oc-header">
        <button class="oc-tab active" data-tab="chat">⟐ Chat</button>
        <button class="oc-tab" data-tab="terminal">⟐ Terminal</button>
        <button class="oc-close" aria-label="Close">✕</button>
      </div>

      <div class="oc-panel active" data-panel="chat">
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

    this._bindDrag()
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
}
