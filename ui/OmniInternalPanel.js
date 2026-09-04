/**
 * ui/OmniInternalPanel.js — ⟐mniReality Internal Data Panel
 *
 * Internal Display / Internal Code used to live as inline textareas
 * inside systems/OmniInspector.js's Data section. Per explicit
 * request, they now live in their own dedicated panel instead —
 * opened via the "Open Panel" button next to "Internal Data" in the
 * Inspector's Data section.
 *
 * Critically: pressing Save HERE actually, unconditionally persists
 * the change to the same per-node storage OmniInspector itself uses
 * (STORE_PREFIX + nodeId in localStorage) — the person does not need
 * to also save in the Inspector. OmniInspector listens for this
 * panel's save event too, so if the same node happens to be loaded
 * there at the same time, its own in-memory copy stays in sync rather
 * than going stale and overwriting this save later.
 *
 * Event contract:
 *   omni:internal-panel-open-request   { id, internalDisplay, internalCode }
 *     — dispatched by OmniInspector's "Open Panel" button
 *   omni:node-internal-data-set        { id, internalDisplay, internalCode }
 *     — dispatched by this panel's Save button; OmniInspector.js
 *       listens for this and does the actual localStorage write
 *
 * Follows the standard module contract (constructor / init / update / destroy).
 */

import gsap from 'gsap'
import * as WindowManager from './WindowManager.js'

const STYLES = /* css */`

.omni-internal-panel {
  --oip-bg          : var(--omni-theme-bg, rgba(8, 8, 12, 0.92));
  --oip-border      : var(--omni-theme-border, rgba(255, 255, 255, 0.09));
  --oip-header-bg   : var(--omni-theme-header-bg, rgba(255, 255, 255, 0.03));
  --oip-text        : var(--omni-theme-text, rgba(255, 255, 255, 1));
  --oip-text-dim    : var(--omni-theme-text-dim, rgba(255, 255, 255, 0.85));
  --oip-text-muted  : var(--omni-theme-text-muted, rgba(255, 255, 255, 0.6));
  --oip-accent      : var(--omni-theme-accent, #8cffb4);
  --mono            : 'Courier New', Courier, monospace;

  position         : fixed;
  top              : 110px;
  right            : 90px;
  width            : 320px;
  min-width        : 260px;
  max-width        : 90vw;
  height           : 440px;
  min-height       : 300px;
  max-height       : 92vh;

  display          : flex;
  flex-direction   : column;

  background       : var(--oip-bg);
  backdrop-filter  : blur(22px) saturate(1.5);
  -webkit-backdrop-filter: blur(22px) saturate(1.5);
  border           : 1px solid var(--oip-border);
  border-radius    : 14px;
  box-shadow       : 0 0 24px rgba(0,0,0,0.4), 0 12px 40px rgba(0,0,0,0.55);

  font-family      : var(--mono);
  color            : var(--oip-text);
  z-index          : 62;
  overflow         : hidden;
  pointer-events   : auto;
  resize           : both;

  opacity          : 0;
  transform        : scale(0.94);
}

.oip-header {
  position         : relative;
  height           : 42px;
  flex-shrink      : 0;
  display          : flex;
  align-items      : center;
  justify-content  : center;
  background       : var(--oip-header-bg);
  border-bottom    : 1px solid var(--oip-border);
  cursor           : grab;
  user-select      : none;
}
.oip-header.is-dragging { cursor: grabbing; }
.oip-title { position: absolute; left: 14px; font-size: 11px; letter-spacing: 0.06em; color: var(--oip-text-dim); }
.oip-controls { position: absolute; right: 10px; display: flex; align-items: center; gap: 8px; }
.oip-ctrl {
  width: 22px; height: 22px; border-radius: 6px;
  border: 1px solid var(--oip-border);
  background: rgba(255,255,255,0.04);
  color: var(--oip-text-dim);
  font-size: 10px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
}
.oip-ctrl:hover { background: rgba(255,255,255,0.10); color: var(--oip-text); }
.oip-ctrl--save { color: rgba(140, 255, 180, 0.9); border-color: rgba(140, 255, 180, 0.25); }
.oip-ctrl--save:hover { background: rgba(140, 255, 180, 0.14); }
.oip-ctrl--save.is-saved { background: rgba(140, 255, 180, 0.3); }

.oip-unsaved-banner {
  flex-shrink      : 0;
  display          : none;
  align-items      : center;
  justify-content  : center;
  gap              : 6px;
  padding          : 6px;
  font-size        : 9.5px;
  color            : rgba(255, 200, 140, 0.95);
  background       : rgba(255, 180, 100, 0.12);
  border-bottom    : 1px solid rgba(255, 180, 100, 0.2);
}
.oip-unsaved-banner.is-visible { display: flex; }

.oip-saved-banner {
  flex-shrink: 0; max-height: 0; overflow: hidden;
  display: flex; align-items: center; justify-content: center;
  font-size: 9px;
  color: rgba(160, 255, 195, 0.95);
  background: rgba(140, 255, 180, 0.10);
  transition: max-height 0.2s ease, padding 0.2s ease;
}
.oip-saved-banner.is-visible { max-height: 22px; padding: 5px; }

.oip-empty { flex: 1; display: flex; align-items: center; justify-content: center; color: var(--oip-text-muted); font-size: 10px; text-align: center; padding: 20px; }

.oip-body { flex: 1 1 auto; overflow-y: auto; padding: 12px; display: none; }
.oip-body.is-visible { display: flex; flex-direction: column; gap: 12px; }

.oip-node-badge { font-size: 9px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--oip-text-muted); }

.oip-field { display: flex; flex-direction: column; gap: 4px; flex: 1; }
.oip-field-label { font-size: 9px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--oip-accent); }
.oip-textarea {
  flex: 1;
  min-height: 100px;
  resize: vertical;
  background: var(--omni-theme-input-bg, rgba(255,255,255,0.09));
  border: 1px solid var(--omni-theme-input-border, rgba(255,255,255,0.18));
  border-radius: 6px;
  color: var(--oip-text);
  font-family: var(--mono);
  font-size: 10.5px;
  padding: 8px;
}
.oip-textarea--mono { font-family: var(--mono); }

.oip-resize-handle { position: absolute; right: 0; bottom: 0; width: 16px; height: 16px; cursor: nwse-resize; }
.oip-resize-handle::before {
  content: ''; position: absolute; right: 3px; bottom: 3px; width: 8px; height: 8px;
  border-right: 2px solid rgba(255,255,255,0.25); border-bottom: 2px solid rgba(255,255,255,0.25);
}

`

function injectStyles () {
  if (document.getElementById('omni-internal-panel-styles')) return
  const tag = document.createElement('style')
  tag.id = 'omni-internal-panel-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

export default class OmniInternalPanel {
  constructor (context) {
    this.ctx = context
    this._el = null
    this._isOpen = false
    this._drag = { active: false, startX: 0, startY: 0, originX: 0, originY: 0 }

    this._nodeId = null
    this._saved = { internalDisplay: '', internalCode: '' }
    this._staged = { internalDisplay: '', internalCode: '' }
    this._onOpenRequest = null
  }

  init () {
    injectStyles()
    this._onOpenRequest = (e) => {
      const { id, internalDisplay, internalCode } = e.detail ?? {}
      if (!id) return
      this._nodeId = id
      this._saved = { internalDisplay: internalDisplay ?? '', internalCode: internalCode ?? '' }
      this._staged = structuredClone(this._saved)
      this.open()
      this._render()
    }
    window.addEventListener('omni:internal-panel-open-request', this._onOpenRequest)
  }

  update () {}
  onResize () {}

  destroy () {
    window.removeEventListener('omni:internal-panel-open-request', this._onOpenRequest)
    this._el?.parentNode?.removeChild(this._el)
    WindowManager.unregister('omniinternalpanel')
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
    el.className = 'omni-internal-panel'
    el.innerHTML = /* html */`
      <div class="oip-header">
        <span class="oip-title">Internal Data</span>
        <div class="oip-controls">
          <button class="oip-ctrl oip-ctrl--save" data-action="save" title="Save">💾</button>
          <button class="oip-ctrl" data-action="close" title="Close">×</button>
        </div>
      </div>
      <div class="oip-unsaved-banner" id="oip-unsaved-banner">⚠ Unsaved changes — click 💾 to apply</div>
      <div class="oip-saved-banner" id="oip-saved-banner"></div>
      <div class="oip-empty" id="oip-empty">Open a node's Inspector and click "Open Panel" next to Internal Data.</div>
      <div class="oip-body" id="oip-body"></div>
      <div class="oip-resize-handle" aria-hidden="true"></div>
    `
    this._bindHeader(el)
    this._bindResize(el)
    el.querySelector('[data-action="close"]').addEventListener('click', () => this.close())
    el.querySelector('[data-action="save"]').addEventListener('click', () => this._save())

    el.dataset.winId = 'omniinternalpanel'
    WindowManager.register('omniinternalpanel', el, 'Internal Data')
    WindowManager.watchPanelOpacity(el, () => this._isOpen)

    return el
  }

  _render () {
    if (!this._el) return
    this._el.querySelector('#oip-empty').style.display = 'none'
    const body = this._el.querySelector('#oip-body')
    body.classList.add('is-visible')

    body.innerHTML = /* html */`
      <div class="oip-node-badge">Node: ${this._nodeId}</div>
      <div class="oip-field">
        <span class="oip-field-label">Internal Display</span>
        <textarea class="oip-textarea" id="oip-display" placeholder="Internal Display…">${this._staged.internalDisplay}</textarea>
      </div>
      <div class="oip-field">
        <span class="oip-field-label">Internal Code</span>
        <textarea class="oip-textarea oip-textarea--mono" id="oip-code" placeholder="Internal Code…">${this._staged.internalCode}</textarea>
      </div>
    `

    body.querySelector('#oip-display').addEventListener('input', (e) => this._setStaged('internalDisplay', e.target.value))
    body.querySelector('#oip-code').addEventListener('input', (e) => this._setStaged('internalCode', e.target.value))
  }

  _setStaged (key, value) {
    this._staged[key] = value
    this._el?.querySelector('#oip-unsaved-banner')?.classList.add('is-visible')
  }

  /** The ONLY place a change actually takes effect — persists
   *  immediately and unconditionally (via OmniInspector.js's listener,
   *  which owns the actual localStorage write), so the person doesn't
   *  need to also save in the Inspector for this to stick. */
  _save () {
    if (!this._nodeId) return
    this._saved = structuredClone(this._staged)

    window.dispatchEvent(new CustomEvent('omni:node-internal-data-set', {
      detail: { id: this._nodeId, internalDisplay: this._saved.internalDisplay, internalCode: this._saved.internalCode }
    }))

    this._el?.querySelector('#oip-unsaved-banner')?.classList.remove('is-visible')

    const savedBanner = this._el?.querySelector('#oip-saved-banner')
    if (savedBanner) {
      savedBanner.textContent = '✓ Saved'
      savedBanner.classList.add('is-visible')
      clearTimeout(this._savedBannerTimer)
      this._savedBannerTimer = setTimeout(() => savedBanner.classList.remove('is-visible'), 1400)
    }

    const saveBtn = this._el?.querySelector('[data-action="save"]')
    saveBtn?.classList.add('is-saved')
    setTimeout(() => saveBtn?.classList.remove('is-saved'), 500)
  }

  // ── Header drag / resize ─────────────────────────────────────────────────

  _bindHeader (el) {
    const header = el.querySelector('.oip-header')
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
    const handle = el.querySelector('.oip-resize-handle')
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
