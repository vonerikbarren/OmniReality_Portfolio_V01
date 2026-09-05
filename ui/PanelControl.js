/**
 * ui/PanelControl.js — ⟐mniReality PanelControl
 *
 * A dedicated panel for controlling in-space panels (currently: the
 * External info-plane built in systems/OmniInspector.js). Pulled out
 * of that Inspector's Data section into its own panel, per explicit
 * request — "we should have a separate panel for this now."
 *
 * Covers: the scroll buttons (Up/Down/Page Up/Page Down), a manual
 * Position/Rotation/Scale offset on top of the plane's automatic
 * positioning, and three tabbed color targets — Panel (background),
 * Border, and Text. Everything here applies live, not staged behind a
 * Save button — the size-slider precedent (OmniExpression) showed
 * staged changes reading as "doesn't work" when nothing visibly
 * updates until a separate click.
 *
 * Doesn't own any plane state itself — dispatches abstract commands
 * that systems/OmniInspector.js (which owns the actual planes)
 * applies to whichever node is currently loaded there. Keeps the real
 * mechanism in one place rather than duplicating it here.
 *
 * Follows the standard module contract (constructor / init / update / destroy).
 */

import gsap from 'gsap'
import * as WindowManager from './WindowManager.js'

const STYLES = /* css */`

.omni-panel-control {
  --pc-bg          : var(--omni-theme-bg, rgba(8, 8, 12, 0.92));
  --pc-border      : var(--omni-theme-border, rgba(255, 255, 255, 0.09));
  --pc-header-bg   : var(--omni-theme-header-bg, rgba(255, 255, 255, 0.03));
  --pc-text        : var(--omni-theme-text, rgba(255, 255, 255, 1));
  --pc-text-dim    : var(--omni-theme-text-dim, rgba(255, 255, 255, 0.85));
  --pc-text-muted  : var(--omni-theme-text-muted, rgba(255, 255, 255, 0.6));
  --pc-accent      : var(--omni-theme-accent, #8cffb4);
  --mono           : 'Courier New', Courier, monospace;

  position         : fixed;
  top              : 120px;
  left             : 140px;
  width            : 300px;
  min-width        : 260px;
  max-width        : 90vw;
  height           : 560px;
  min-height       : 340px;
  max-height       : 92vh;

  display          : flex;
  flex-direction   : column;

  background       : var(--pc-bg);
  backdrop-filter  : blur(22px) saturate(1.5);
  -webkit-backdrop-filter: blur(22px) saturate(1.5);
  border           : 1px solid var(--pc-border);
  border-radius    : 14px;
  box-shadow       : 0 0 24px rgba(0,0,0,0.4), 0 12px 40px rgba(0,0,0,0.55);

  font-family      : var(--mono);
  color            : var(--pc-text);
  z-index          : 60;
  overflow         : hidden;
  pointer-events   : auto;
  resize           : both;

  opacity          : 0;
  transform        : scale(0.94);
}

.pc-header {
  position         : relative;
  height           : 40px;
  flex-shrink      : 0;
  display          : flex;
  align-items      : center;
  justify-content  : center;
  background       : var(--pc-header-bg);
  border-bottom    : 1px solid var(--pc-border);
  cursor           : grab;
  user-select      : none;
}
.pc-header.is-dragging { cursor: grabbing; }
.pc-title { position: absolute; left: 12px; font-size: 10.5px; letter-spacing: 0.06em; color: var(--pc-text-dim); }
.pc-controls { position: absolute; right: 8px; display: flex; align-items: center; gap: 6px; }
.pc-ctrl {
  width: 20px; height: 20px; border-radius: 5px;
  border: 1px solid var(--pc-border);
  background: rgba(255,255,255,0.04);
  color: var(--pc-text-dim);
  font-size: 10px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
}
.pc-ctrl:hover { background: rgba(255,255,255,0.10); color: var(--pc-text); }

.pc-body { flex: 1 1 auto; overflow-y: auto; padding: 14px; display: flex; flex-direction: column; gap: 10px; }

.pc-section-title {
  font-size        : 9.5px;
  letter-spacing   : 0.08em;
  text-transform   : uppercase;
  color            : var(--pc-accent);
  margin-top       : 4px;
  padding-top      : 10px;
  border-top       : 1px solid rgba(255,255,255,0.08);
}
.pc-section-title:first-child { margin-top: 0; padding-top: 0; border-top: none; }

.pc-btn-grid {
  display              : grid;
  grid-template-columns: 1fr 1fr;
  gap                  : 8px;
}
.pc-scroll-btn {
  background       : rgba(255,255,255,0.06);
  border           : 1px solid var(--pc-border);
  border-radius    : 8px;
  color            : var(--pc-text-dim);
  font-size        : 18px;
  cursor           : pointer;
  user-select      : none;
  touch-action     : none;
  display          : flex;
  align-items      : center;
  justify-content  : center;
  gap              : 8px;
  height           : 52px;
}
.pc-scroll-btn .pc-btn-label { font-size: 10px; letter-spacing: 0.04em; }
.pc-scroll-btn:hover { background: rgba(255,255,255,0.12); color: var(--pc-text); }
.pc-scroll-btn:active, .pc-scroll-btn.is-pressed {
  background       : rgba(140, 255, 180, 0.18);
  border-color     : rgba(140, 255, 180, 0.4);
  color            : rgba(160, 255, 195, 0.95);
}
.pc-scroll-btn--page { font-size: 15px; opacity: 0.85; }

.pc-xyz-grid {
  display              : grid;
  grid-template-columns: auto 1fr 1fr 1fr;
  gap                  : 6px 6px;
  align-items          : center;
}
.pc-xyz-row-label { font-size: 9.5px; color: var(--pc-text-muted); }
.pc-xyz-input {
  width            : 100%;
  background       : rgba(255,255,255,0.09);
  border           : 1px solid rgba(255,255,255,0.18);
  border-radius    : 5px;
  color            : var(--pc-text);
  font-family      : var(--mono);
  font-size        : 10px;
  padding          : 4px 5px;
  box-sizing       : border-box;
}

.pc-tabs { display: flex; gap: 4px; }
.pc-tab {
  flex             : 1;
  padding          : 7px;
  background       : rgba(255,255,255,0.05);
  border           : 1px solid var(--pc-border);
  border-radius    : 6px;
  color            : var(--pc-text-muted);
  font-family      : var(--mono);
  font-size        : 9.5px;
  letter-spacing   : 0.03em;
  cursor           : pointer;
}
.pc-tab:hover { color: var(--pc-text); }
.pc-tab.is-active { background: rgba(140, 255, 180, 0.16); border-color: rgba(140, 255, 180, 0.35); color: rgba(160, 255, 195, 0.95); }

.pc-rgba-row { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.pc-rgba-label { width: 14px; flex-shrink: 0; font-size: 9.5px; color: var(--pc-text-muted); }
.pc-rgba-slider { flex: 1; accent-color: var(--pc-accent); }
.pc-rgba-val { width: 32px; text-align: right; font-size: 9px; color: var(--pc-text-dim); }

.pc-color-preview {
  height: 28px; border-radius: 6px; margin-top: 4px;
  border: 1px solid var(--pc-border);
}

.pc-note {
  font-size        : 9px;
  color            : var(--pc-text-muted);
  text-align       : center;
  line-height      : 1.4;
}

.pc-resize-handle { position: absolute; right: 0; bottom: 0; width: 16px; height: 16px; cursor: nwse-resize; }
.pc-resize-handle::before {
  content: ''; position: absolute; right: 3px; bottom: 3px; width: 8px; height: 8px;
  border-right: 2px solid rgba(255,255,255,0.25); border-bottom: 2px solid rgba(255,255,255,0.25);
}

`

function injectStyles () {
  if (document.getElementById('omni-panel-control-styles')) return
  const tag = document.createElement('style')
  tag.id = 'omni-panel-control-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

export default class PanelControl {
  constructor (context) {
    this.ctx = context
    this._el = null
    this._isOpen = false
    this._drag = { active: false, startX: 0, startY: 0, originX: 0, originY: 0 }
    this._onNavSelect = null
    this._activeTab = 'panel'
    this._state = {
      offset: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      bgColor: { r: 8, g: 8, b: 14, a: 0.88 },
      borderColor: { r: 255, g: 255, b: 255, a: 0.25 },
      textColor: { r: 220, g: 230, b: 255, a: 0.9 },
    }
  }

  init () {
    injectStyles()
    this._onNavSelect = (e) => {
      if (e.detail?.item !== '⟐PanelControl') return
      this.open()
    }
    window.addEventListener('omni:nav-select', this._onNavSelect)

    this._onStateResponse = (e) => {
      const d = e.detail ?? {}
      if (d.offset) this._state.offset = d.offset
      if (d.rotation) this._state.rotation = d.rotation
      if (d.scale) this._state.scale = d.scale
      if (d.bgColor) this._state.bgColor = d.bgColor
      if (d.borderColor) this._state.borderColor = d.borderColor
      if (d.textColor) this._state.textColor = d.textColor
      this._syncFieldsFromState()
    }
    window.addEventListener('omni:panelcontrol-state-response', this._onStateResponse)
  }

  update () {}
  onResize () {}

  destroy () {
    window.removeEventListener('omni:nav-select', this._onNavSelect)
    window.removeEventListener('omni:panelcontrol-state-response', this._onStateResponse)
    this._el?.parentNode?.removeChild(this._el)
    WindowManager.unregister('panelcontrol')
  }

  open () {
    if (!this._el) this._el = this._buildDOM()
    const shell = document.getElementById('omni-ui') ?? document.body
    shell.appendChild(this._el)
    this._el.style.visibility = 'visible'
    gsap.to(this._el, { opacity: WindowManager.getPanelOpacity(), scale: 1, duration: 0.28, ease: 'back.out(1.4)' })
    this._isOpen = true
    this._playSound('open')
    window.dispatchEvent(new CustomEvent('omni:panelcontrol-state-request'))
  }

  close () {
    if (!this._el) return
    gsap.to(this._el, {
      opacity: 0, scale: 0.94, duration: 0.18, ease: 'power1.in',
      onComplete: () => { this._el.style.visibility = 'hidden' },
    })
    this._isOpen = false
    this._playSound('close')
  }

  minimize () {
    if (!this._el) return
    const rect = this._el.getBoundingClientRect()
    gsap.to(this._el, {
      opacity: 0, scale: 0.3, duration: 0.22, ease: 'power2.in',
      onComplete: () => { this._el.style.visibility = 'hidden' },
    })
    this._isOpen = false
    this._playSound('close')
    window.dispatchEvent(new CustomEvent('omni:panel-minimized', {
      detail: {
        id: 'panelcontrol', label: '⟐PanelControl', iconLabel: '⟐P',
        fromRect: { x: rect.left, y: rect.top, w: rect.width, h: rect.height },
        variant: 'orb',
      }
    }))
  }

  _playSound (id) {
    try {
      const Sound = this.ctx?.Sound
      if (Sound && typeof Sound.play === 'function') Sound.play(id)
    } catch (_) {}
  }

  // ── DOM ──────────────────────────────────────────────────────────────────

  _buildDOM () {
    const el = document.createElement('div')
    el.className = 'omni-panel-control'
    el.innerHTML = /* html */`
      <div class="pc-header">
        <span class="pc-title">⟐PanelControl</span>
        <div class="pc-controls">
          <button class="pc-ctrl" data-action="minimize" title="Minimize">–</button>
          <button class="pc-ctrl" data-action="close" title="Close">×</button>
        </div>
      </div>
      <div class="pc-body">
        <div class="pc-section-title">Scroll</div>
        <div class="pc-note">
          Scrolls whichever in-space panel is currently open in the
          Inspector, when Scrollable is on. Hold a button to keep
          scrolling.
        </div>
        <div class="pc-btn-grid">
          <button class="pc-scroll-btn pc-scroll-btn--page" id="pc-pageup"><span>⏫</span><span class="pc-btn-label">Page Up</span></button>
          <button class="pc-scroll-btn" id="pc-up"><span>▲</span><span class="pc-btn-label">Up</span></button>
          <button class="pc-scroll-btn" id="pc-down"><span>▼</span><span class="pc-btn-label">Down</span></button>
          <button class="pc-scroll-btn pc-scroll-btn--page" id="pc-pagedown"><span>⏬</span><span class="pc-btn-label">Page Down</span></button>
        </div>

        <div class="pc-section-title">Transform</div>
        <div class="pc-xyz-grid">
          <span class="pc-xyz-row-label">Pos</span>
          <input type="number" class="pc-xyz-input" id="pc-px" step="0.1" placeholder="X" value="0">
          <input type="number" class="pc-xyz-input" id="pc-py" step="0.1" placeholder="Y" value="0">
          <input type="number" class="pc-xyz-input" id="pc-pz" step="0.1" placeholder="Z" value="0">
          <span class="pc-xyz-row-label">Rot</span>
          <input type="number" class="pc-xyz-input" id="pc-rx" step="0.05" placeholder="X" value="0">
          <input type="number" class="pc-xyz-input" id="pc-ry" step="0.05" placeholder="Y" value="0">
          <input type="number" class="pc-xyz-input" id="pc-rz" step="0.05" placeholder="Z" value="0">
          <span class="pc-xyz-row-label">Scale</span>
          <input type="number" class="pc-xyz-input" id="pc-sx" step="0.05" min="0.01" placeholder="X" value="1">
          <input type="number" class="pc-xyz-input" id="pc-sy" step="0.05" min="0.01" placeholder="Y" value="1">
          <input type="number" class="pc-xyz-input" id="pc-sz" step="0.05" min="0.01" placeholder="Z" value="1">
        </div>
        <div class="pc-note">
          Rotation only visibly holds while Face Camera (in the
          Inspector's Data section) is off — otherwise billboarding
          overrides it every frame.
        </div>

        <div class="pc-section-title">Appearance</div>
        <div class="pc-tabs">
          <button class="pc-tab is-active" data-tab="panel">Panel</button>
          <button class="pc-tab" data-tab="border">Border</button>
          <button class="pc-tab" data-tab="text">Text</button>
        </div>
        <div id="pc-rgba-container"></div>
        <div class="pc-color-preview" id="pc-color-preview"></div>
      </div>
      <div class="pc-resize-handle" aria-hidden="true"></div>
    `

    this._bindHeader(el)
    this._bindResize(el)
    this._bindScrollButtons(el)
    this._bindTransformFields(el)
    this._bindTabs(el)
    this._renderTabContent(el)

    el.querySelector('[data-action="minimize"]').addEventListener('click', () => this.minimize())
    el.querySelector('[data-action="close"]').addEventListener('click', () => this.close())

    el.dataset.winId = 'panelcontrol'
    WindowManager.register('panelcontrol', el, 'PanelControl')
    WindowManager.watchPanelOpacity(el, () => this._isOpen)

    return el
  }

  /** Populates the Position/Rotation/Scale fields and re-renders the
   *  active color tab from whatever state Inspector just sent back. */
  _syncFieldsFromState () {
    if (!this._el) return
    const s = this._state
    const set = (id, val) => { const el = this._el.querySelector(`#${id}`); if (el) el.value = val }
    set('pc-px', s.offset.x); set('pc-py', s.offset.y); set('pc-pz', s.offset.z)
    set('pc-rx', s.rotation.x); set('pc-ry', s.rotation.y); set('pc-rz', s.rotation.z)
    set('pc-sx', s.scale.x); set('pc-sy', s.scale.y); set('pc-sz', s.scale.z)
    this._renderTabContent(this._el)
  }

  _dispatchTransform (patch) {
    window.dispatchEvent(new CustomEvent('omni:panelcontrol-transform-set', { detail: patch }))
  }

  _bindTransformFields (el) {
    const bind = (id, group, axis) => {
      const input = el.querySelector(`#${id}`)
      input?.addEventListener('input', () => {
        const v = parseFloat(input.value)
        if (!Number.isFinite(v)) return
        this._state[group][axis] = v
        this._dispatchTransform({ [group]: { [axis]: v } })
      })
    }
    bind('pc-px', 'offset', 'x'); bind('pc-py', 'offset', 'y'); bind('pc-pz', 'offset', 'z')
    bind('pc-rx', 'rotation', 'x'); bind('pc-ry', 'rotation', 'y'); bind('pc-rz', 'rotation', 'z')
    bind('pc-sx', 'scale', 'x'); bind('pc-sy', 'scale', 'y'); bind('pc-sz', 'scale', 'z')
  }

  _bindTabs (el) {
    el.querySelectorAll('.pc-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this._activeTab = tab.dataset.tab
        el.querySelectorAll('.pc-tab').forEach(t => t.classList.toggle('is-active', t === tab))
        this._renderTabContent(el)
      })
    })
  }

  /** Renders the 4 RGBA sliders for whichever tab (Panel/Border/Text)
   *  is currently active, targeting the matching color in state. */
  _renderTabContent (el) {
    const container = el.querySelector('#pc-rgba-container')
    if (!container) return
    const colorKey = { panel: 'bgColor', border: 'borderColor', text: 'textColor' }[this._activeTab]
    const color = this._state[colorKey]

    const row = (ch, max, step) => /* html */`
      <div class="pc-rgba-row">
        <span class="pc-rgba-label">${ch.toUpperCase()}</span>
        <input type="range" class="pc-rgba-slider" data-ch="${ch}" min="0" max="${max}" step="${step}" value="${color[ch]}">
        <span class="pc-rgba-val" data-val-for="${ch}">${ch === 'a' ? Number(color.a).toFixed(2) : color[ch]}</span>
      </div>
    `
    container.innerHTML = row('r', 255, 1) + row('g', 255, 1) + row('b', 255, 1) + row('a', 1, 0.01)

    container.querySelectorAll('[data-ch]').forEach(input => {
      input.addEventListener('input', () => {
        const ch = input.dataset.ch
        const value = Number(input.value)
        this._state[colorKey][ch] = value
        const valEl = container.querySelector(`[data-val-for="${ch}"]`)
        if (valEl) valEl.textContent = ch === 'a' ? value.toFixed(2) : value
        this._updateColorPreview(el)
        this._dispatchTransform({ [colorKey]: { [ch]: value } })
      })
    })
    this._updateColorPreview(el)
  }

  _updateColorPreview (el) {
    const preview = el.querySelector('#pc-color-preview')
    if (!preview) return
    const colorKey = { panel: 'bgColor', border: 'borderColor', text: 'textColor' }[this._activeTab]
    const c = this._state[colorKey]
    preview.style.background = `rgba(${c.r}, ${c.g}, ${c.b}, ${c.a})`
  }

  /** Press-and-hold — steps once immediately on press (a quick tap
   *  still does something), then after a short delay starts repeating
   *  continuously until release. Covers mouse and touch identically,
   *  since this panel is explicitly meant to work on mobile. */
  _bindScrollButtons (el) {
    const bindHold = (id, direction) => {
      const btn = el.querySelector(`#${id}`)
      if (!btn) return
      let holdTimer = null
      let repeatTimer = null
      const fire = () => {
        window.dispatchEvent(new CustomEvent('omni:panel-control-scroll', { detail: { direction } }))
      }
      const stop = () => {
        clearTimeout(holdTimer)
        clearInterval(repeatTimer)
        btn.classList.remove('is-pressed')
      }
      const start = (e) => {
        e.preventDefault()
        btn.classList.add('is-pressed')
        fire()
        holdTimer = setTimeout(() => { repeatTimer = setInterval(fire, 60) }, 400)
      }
      btn.addEventListener('mousedown', start)
      btn.addEventListener('touchstart', start, { passive: false })
      btn.addEventListener('mouseup', stop)
      btn.addEventListener('mouseleave', stop)
      btn.addEventListener('touchend', stop)
      btn.addEventListener('touchcancel', stop)
    }

    bindHold('pc-up', 'up')
    bindHold('pc-down', 'down')
    bindHold('pc-pageup', 'pageup')
    bindHold('pc-pagedown', 'pagedown')
  }

  // ── Header drag / resize — same pattern as every other panel ─────────────

  _bindHeader (el) {
    const header = el.querySelector('.pc-header')
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
    const handle = el.querySelector('.pc-resize-handle')
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
