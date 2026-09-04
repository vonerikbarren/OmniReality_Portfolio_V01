/**
 * ui/OmniExpressionInspector.js — ⟐mniReality OmniExpression Inspector
 *
 * OmniExpression's own dedicated Inspector, per explicit request. The
 * main OmniExpression panel handles primary interaction (mode toggle,
 * lock-point presets, media URL, recording new waypoints); this
 * Inspector handles finer editing: exact numeric position/radius, and
 * managing the waypoint list itself (adjusting hold duration,
 * deleting entries) — neither of which the main panel exposes.
 *
 * Edits flow back to ui/OmniExpression.js via omni:expression-state-set
 * — this panel doesn't own the avatar mesh or persistence itself.
 *
 * Follows the standard module contract (constructor / init / update / destroy).
 */

import gsap from 'gsap'
import * as WindowManager from './WindowManager.js'

const STYLES = /* css */`

.omni-expression-inspector-panel {
  --oei-bg          : var(--omni-theme-bg, rgba(8, 8, 12, 0.92));
  --oei-border      : var(--omni-theme-border, rgba(255, 255, 255, 0.09));
  --oei-header-bg   : var(--omni-theme-header-bg, rgba(255, 255, 255, 0.03));
  --oei-text        : var(--omni-theme-text, rgba(255, 255, 255, 1));
  --oei-text-dim    : var(--omni-theme-text-dim, rgba(255, 255, 255, 0.85));
  --oei-text-muted  : var(--omni-theme-text-muted, rgba(255, 255, 255, 0.6));
  --oei-accent      : var(--omni-theme-accent, #c9a3ff);
  --mono            : 'Courier New', Courier, monospace;

  position         : fixed;
  top              : 110px;
  right            : 90px;
  width            : 300px;
  min-width        : 260px;
  max-width        : 90vw;
  height           : 480px;
  min-height       : 320px;
  max-height       : 92vh;

  display          : flex;
  flex-direction   : column;

  background       : var(--oei-bg);
  backdrop-filter  : blur(22px) saturate(1.5);
  -webkit-backdrop-filter: blur(22px) saturate(1.5);
  border           : 1px solid var(--oei-border);
  border-radius    : 14px;
  box-shadow       : 0 0 24px rgba(0,0,0,0.4), 0 12px 40px rgba(0,0,0,0.55);

  font-family      : var(--mono);
  color            : var(--oei-text);
  z-index          : 62;
  overflow         : hidden;
  pointer-events   : auto;
  resize           : both;

  opacity          : 0;
  transform        : scale(0.94);
}

.oei-header {
  position         : relative;
  height           : 42px;
  flex-shrink      : 0;
  display          : flex;
  align-items      : center;
  justify-content  : center;
  background       : var(--oei-header-bg);
  border-bottom    : 1px solid var(--oei-border);
  cursor           : grab;
  user-select      : none;
}
.oei-header.is-dragging { cursor: grabbing; }
.oei-title { position: absolute; left: 14px; font-size: 11px; letter-spacing: 0.06em; color: var(--oei-text-dim); }
.oei-controls { position: absolute; right: 10px; display: flex; align-items: center; gap: 8px; }
.oei-ctrl {
  width: 22px; height: 22px; border-radius: 6px;
  border: 1px solid var(--oei-border);
  background: rgba(255,255,255,0.04);
  color: var(--oei-text-dim);
  font-size: 10px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
}
.oei-ctrl:hover { background: rgba(255,255,255,0.10); color: var(--oei-text); }

.oei-notify-banner {
  flex-shrink: 0; max-height: 0; overflow: hidden;
  display: flex; align-items: center; justify-content: center;
  font-size: 9px;
  color: rgba(201, 163, 255, 0.95);
  background: rgba(201, 163, 255, 0.10);
  transition: max-height 0.2s ease, padding 0.2s ease;
}
.oei-notify-banner.is-visible { max-height: 22px; padding: 5px; }

.oei-body { flex: 1 1 auto; overflow-y: auto; padding: 12px; }

.oei-group-title {
  font-size: 9.5px; letter-spacing: 0.08em; text-transform: uppercase;
  color: var(--oei-accent); margin: 12px 0 6px; padding-top: 8px;
  border-top: 1px solid rgba(255,255,255,0.06);
}
.oei-group-title:first-child { margin-top: 0; padding-top: 0; border-top: none; }

.oei-row { display: flex; align-items: center; gap: 8px; margin-bottom: 7px; }
.oei-row-label { width: 46px; flex-shrink: 0; font-size: 9.5px; color: var(--oei-text-muted); }
.oei-num {
  flex: 1;
  background: var(--omni-theme-input-bg, rgba(255,255,255,0.09));
  border: 1px solid var(--omni-theme-input-border, rgba(255,255,255,0.18));
  border-radius: 5px;
  color: var(--oei-text);
  font-family: var(--mono);
  font-size: 10px;
  padding: 4px 6px;
}

.oei-wp-item {
  display: flex; align-items: center; gap: 6px;
  background: rgba(201, 163, 255, 0.06);
  border: 1px solid rgba(201, 163, 255, 0.15);
  border-radius: 5px;
  padding: 6px;
  margin-bottom: 5px;
  font-size: 9.5px;
}
.oei-wp-item-label { flex: 1; color: var(--oei-text-dim); }
.oei-wp-hold {
  width: 60px;
  background: var(--omni-theme-input-bg, rgba(255,255,255,0.09));
  border: 1px solid var(--omni-theme-input-border, rgba(255,255,255,0.18));
  border-radius: 4px;
  color: var(--oei-text);
  font-family: var(--mono);
  font-size: 9px;
  padding: 3px 5px;
}
.oei-wp-delete {
  background: rgba(255, 100, 100, 0.12);
  border: 1px solid rgba(255, 100, 100, 0.3);
  color: rgba(255, 160, 160, 0.9);
  border-radius: 4px;
  width: 20px; height: 20px;
  cursor: pointer;
  font-size: 10px;
}
.oei-wp-delete:hover { background: rgba(255, 100, 100, 0.22); }
.oei-wp-empty { font-size: 9.5px; color: var(--oei-text-muted); font-style: italic; }

.oei-resize-handle { position: absolute; right: 0; bottom: 0; width: 16px; height: 16px; cursor: nwse-resize; }
.oei-resize-handle::before {
  content: ''; position: absolute; right: 3px; bottom: 3px; width: 8px; height: 8px;
  border-right: 2px solid rgba(255,255,255,0.25); border-bottom: 2px solid rgba(255,255,255,0.25);
}

`

function injectStyles () {
  if (document.getElementById('omni-expression-inspector-styles')) return
  const tag = document.createElement('style')
  tag.id = 'omni-expression-inspector-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

export default class OmniExpressionInspector {
  constructor (context) {
    this.ctx = context
    this._el = null
    this._isOpen = false
    this._drag = { active: false, startX: 0, startY: 0, originX: 0, originY: 0 }
    this._state = null
    this._onInspectRequest = null
  }

  init () {
    injectStyles()
    this._onInspectRequest = (e) => {
      const { state } = e.detail ?? {}
      if (!state) return
      this._state = state
      this.open()
      this._render()
    }
    window.addEventListener('omni:expression-inspect-request', this._onInspectRequest)
  }

  update () {}
  onResize () {}

  destroy () {
    window.removeEventListener('omni:expression-inspect-request', this._onInspectRequest)
    this._el?.parentNode?.removeChild(this._el)
    WindowManager.unregister('omniexpressioninspector')
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

  // ── DOM ──────────────────────────────────────────────────────────────────

  _buildDOM () {
    const el = document.createElement('div')
    el.className = 'omni-expression-inspector-panel'
    el.innerHTML = /* html */`
      <div class="oei-header">
        <span class="oei-title">⟐Expression Inspector</span>
        <div class="oei-controls">
          <button class="oei-ctrl" data-action="close" title="Close">×</button>
        </div>
      </div>
      <div class="oei-notify-banner" id="oei-notify-banner"></div>
      <div class="oei-body" id="oei-body"></div>
      <div class="oei-resize-handle" aria-hidden="true"></div>
    `
    this._bindHeader(el)
    this._bindResize(el)
    el.querySelector('[data-action="close"]').addEventListener('click', () => this.close())

    el.dataset.winId = 'omniexpressioninspector'
    WindowManager.register('omniexpressioninspector', el, 'Expression Inspector')
    WindowManager.watchPanelOpacity(el, () => this._isOpen)

    return el
  }

  _render () {
    if (!this._el || !this._state) return
    const body = this._el.querySelector('#oei-body')
    const s = this._state

    const numRow = (label, key, val, step = 0.1) => /* html */`
      <div class="oei-row">
        <span class="oei-row-label">${label}</span>
        <input type="number" class="oei-num" data-key="${key}" step="${step}" value="${val}">
      </div>
    `

    body.innerHTML = /* html */`
      <div class="oei-group-title">Radius</div>
      ${numRow('Radius', 'radius', s.radius, 0.1)}

      <div class="oei-group-title">Panel Position (0-1)</div>
      ${numRow('X', 'panelX', s.panelX, 0.01)}
      ${numRow('Y', 'panelY', s.panelY, 0.01)}

      <div class="oei-group-title">Scene Position</div>
      ${numRow('X', 'sceneX', s.scenePos.x, 0.1)}
      ${numRow('Y', 'sceneY', s.scenePos.y, 0.1)}
      ${numRow('Z', 'sceneZ', s.scenePos.z, 0.1)}

      <div class="oei-group-title">Backing Circles (${s.backingCircles.length})</div>
      <div id="oei-circle-list">
        ${s.backingCircles.map(c => /* html */`
          <div class="oei-wp-item" data-circle-id="${c.id}">
            <span class="oei-wp-item-label">${c.label}</span>
            <input type="text" class="oei-wp-hold" style="width:90px" data-circle-media="${c.id}" value="${c.mediaUrl}" placeholder="media URL">
            <button class="oei-wp-hold" style="width:32px;cursor:pointer" data-circle-type="${c.id}">${c.mediaType === 'video' ? 'Vid' : 'Img'}</button>
            <button class="oei-wp-delete" data-circle-delete="${c.id}" title="Remove">🗑</button>
          </div>
        `).join('')}
      </div>
      <button class="oei-wp-hold" style="width:100%;cursor:pointer;margin-bottom:8px" id="oei-add-circle">+ Add Circle</button>

      <div class="oei-group-title">Waypoints (${s.waypoints.length})</div>
      <div id="oei-wp-list">
        ${s.waypoints.length === 0
          ? '<div class="oei-wp-empty">None recorded yet.</div>'
          : s.waypoints.map((wp, i) => /* html */`
            <div class="oei-wp-item" data-wp-index="${i}">
              <span class="oei-wp-item-label">#${i + 1} - ${wp.mode}</span>
              <input type="number" class="oei-wp-hold" data-wp-hold="${i}" value="${wp.holdMs}" step="100" title="Hold duration (ms)">
              <button class="oei-wp-delete" data-wp-delete="${i}" title="Delete">🗑</button>
            </div>
          `).join('')}
      </div>
    `

    body.querySelectorAll('[data-key]').forEach(input => {
      input.addEventListener('input', () => this._onFieldChange(input.dataset.key, Number(input.value)))
    })
    body.querySelectorAll('[data-wp-hold]').forEach(input => {
      input.addEventListener('input', () => {
        const i = Number(input.dataset.wpHold)
        this._state.waypoints[i].holdMs = Number(input.value)
        this._commit()
      })
    })
    body.querySelectorAll('[data-wp-delete]').forEach(btn => {
      btn.addEventListener('click', () => {
        const i = Number(btn.dataset.wpDelete)
        this._state.waypoints.splice(i, 1)
        this._commit()
        this._render()
      })
    })

    body.querySelectorAll('[data-circle-media]').forEach(input => {
      input.addEventListener('change', () => {
        this._requestCircleUpdate(input.dataset.circleMedia, { mediaUrl: input.value })
      })
    })
    body.querySelectorAll('[data-circle-type]').forEach(btn => {
      btn.addEventListener('click', () => {
        const circle = this._state.backingCircles.find(c => c.id === btn.dataset.circleType)
        const next = circle?.mediaType === 'video' ? 'image' : 'video'
        this._requestCircleUpdate(btn.dataset.circleType, { mediaType: next })
        this._render()
      })
    })
    body.querySelectorAll('[data-circle-delete]').forEach(btn => {
      btn.addEventListener('click', () => {
        window.dispatchEvent(new CustomEvent('omni:expression-backing-circle-request', {
          detail: { action: 'remove', id: btn.dataset.circleDelete }
        }))
        this._state.backingCircles = this._state.backingCircles.filter(c => c.id !== btn.dataset.circleDelete)
        this._render()
      })
    })
    body.querySelector('#oei-add-circle')?.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('omni:expression-backing-circle-request', { detail: { action: 'add' } }))
    })
  }

  _onFieldChange (key, value) {
    if (key === 'sceneX') this._state.scenePos.x = value
    else if (key === 'sceneY') this._state.scenePos.y = value
    else if (key === 'sceneZ') this._state.scenePos.z = value
    else this._state[key] = value
    this._commit()
  }

  _requestCircleUpdate (id, patch) {
    const circle = this._state.backingCircles.find(c => c.id === id)
    if (circle) Object.assign(circle, patch)
    window.dispatchEvent(new CustomEvent('omni:expression-backing-circle-request', {
      detail: { action: 'update', id, patch }
    }))
  }

  /** Every field here pushes the FULL current state back — simpler
   *  than diffing partial patches, and OmniExpression.js just merges
   *  whatever it receives with Object.assign. */
  _commit () {
    window.dispatchEvent(new CustomEvent('omni:expression-state-set', {
      detail: structuredClone(this._state)
    }))
    const banner = this._el?.querySelector('#oei-notify-banner')
    if (banner) {
      banner.textContent = '✓ Applied'
      banner.classList.add('is-visible')
      clearTimeout(this._bannerTimer)
      this._bannerTimer = setTimeout(() => banner.classList.remove('is-visible'), 1200)
    }
  }

  // ── Header drag / resize ─────────────────────────────────────────────────

  _bindHeader (el) {
    const header = el.querySelector('.oei-header')
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
    const handle = el.querySelector('.oei-resize-handle')
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
