/**
 * ui/OmniSelectorInspector.js — ⟐mniReality OmniSelector Inspector
 *
 * OmniSelector's own dedicated Inspector, opened either from its
 * panel's own ⟐i button or by clicking a placed selection volume in
 * the 3D world. Shows the volume's transform + RGBA (edits flow back
 * to ui/OmniSelector.js, which owns the actual mesh) and the live
 * "grouped" list — whichever nodes currently fall inside the volume's
 * bounds.
 *
 * Follows the standard module contract (constructor / init / update / destroy).
 */

import gsap from 'gsap'
import * as WindowManager from './WindowManager.js'

const STYLES = /* css */`

.omni-selector-inspector-panel {
  --osi-bg          : var(--omni-theme-bg, rgba(8, 8, 12, 0.92));
  --osi-border      : var(--omni-theme-border, rgba(255, 255, 255, 0.09));
  --osi-header-bg   : var(--omni-theme-header-bg, rgba(255, 255, 255, 0.03));
  --osi-text        : var(--omni-theme-text, rgba(255, 255, 255, 1));
  --osi-text-dim    : var(--omni-theme-text-dim, rgba(255, 255, 255, 0.85));
  --osi-text-muted  : var(--omni-theme-text-muted, rgba(255, 255, 255, 0.6));
  --osi-accent      : var(--omni-theme-accent, #8cffb4);
  --mono            : 'Courier New', Courier, monospace;

  position         : fixed;
  top              : 110px;
  right            : 90px;
  width            : 290px;
  min-width        : 260px;
  max-width        : 90vw;
  height           : 500px;
  min-height       : 320px;
  max-height       : 92vh;

  display          : flex;
  flex-direction   : column;

  background       : var(--osi-bg);
  backdrop-filter  : blur(22px) saturate(1.5);
  -webkit-backdrop-filter: blur(22px) saturate(1.5);
  border           : 1px solid var(--osi-border);
  border-radius    : 14px;
  box-shadow       : 0 0 24px rgba(0,0,0,0.4), 0 12px 40px rgba(0,0,0,0.55);

  font-family      : var(--mono);
  color            : var(--osi-text);
  z-index          : 62;
  overflow         : hidden;
  pointer-events   : auto;
  resize           : both;

  opacity          : 0;
  transform        : scale(0.94);
}

.osi-header {
  position         : relative;
  height           : 42px;
  flex-shrink      : 0;
  display          : flex;
  align-items      : center;
  justify-content  : center;
  background       : var(--osi-header-bg);
  border-bottom    : 1px solid var(--osi-border);
  cursor           : grab;
  user-select      : none;
}
.osi-header.is-dragging { cursor: grabbing; }
.osi-title { position: absolute; left: 14px; font-size: 11px; letter-spacing: 0.06em; color: var(--osi-text-dim); }
.osi-controls { position: absolute; right: 10px; display: flex; align-items: center; gap: 8px; }
.osi-ctrl {
  width: 22px; height: 22px; border-radius: 6px;
  border: 1px solid var(--osi-border);
  background: rgba(255,255,255,0.04);
  color: var(--osi-text-dim);
  font-size: 10px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
}
.osi-ctrl:hover { background: rgba(255,255,255,0.10); color: var(--osi-text); }
.osi-ctrl--save { color: rgba(140, 255, 180, 0.85); border-color: rgba(140, 255, 180, 0.22); }
.osi-ctrl--save.is-saved { background: rgba(140, 255, 180, 0.22); }

.osi-notify-banner {
  flex-shrink: 0; max-height: 0; overflow: hidden;
  display: flex; align-items: center; justify-content: center;
  font-size: 9px;
  color: rgba(160, 255, 195, 0.95);
  background: rgba(140, 255, 180, 0.10);
  transition: max-height 0.2s ease, padding 0.2s ease;
}
.osi-notify-banner.is-visible { max-height: 24px; padding: 5px; }

.osi-empty { flex: 1; display: flex; align-items: center; justify-content: center; color: var(--osi-text-muted); font-size: 10px; text-align: center; padding: 20px; }

.osi-body { flex: 1 1 auto; overflow-y: auto; padding: 12px; display: none; }
.osi-body.is-visible { display: block; }

.osi-group-title {
  font-size: 9.5px; letter-spacing: 0.08em; text-transform: uppercase;
  color: var(--osi-accent); margin: 12px 0 6px; padding-top: 8px;
  border-top: 1px solid rgba(255,255,255,0.06);
}
.osi-group-title:first-child { margin-top: 0; padding-top: 0; border-top: none; }

.osi-row { display: flex; align-items: center; gap: 8px; margin-bottom: 7px; }
.osi-row-label { width: 26px; flex-shrink: 0; font-size: 9.5px; color: var(--osi-text-muted); }
.osi-range { flex: 1; accent-color: var(--osi-accent); }
.osi-range-val { width: 34px; text-align: right; font-size: 9px; color: var(--osi-text-dim); }

.osi-grouped-list { display: flex; flex-direction: column; gap: 4px; max-height: 160px; overflow-y: auto; }
.osi-grouped-item {
  font-size: 10px; color: var(--osi-text-dim);
  background: rgba(140, 255, 180, 0.06);
  border: 1px solid rgba(140, 255, 180, 0.15);
  border-radius: 4px;
  padding: 4px 7px;
}
.osi-grouped-empty { font-size: 9.5px; color: var(--osi-text-muted); font-style: italic; }
.osi-grouped-count { font-size: 9px; color: var(--osi-accent); margin-bottom: 6px; }

.osi-resize-handle { position: absolute; right: 0; bottom: 0; width: 16px; height: 16px; cursor: nwse-resize; }
.osi-resize-handle::before {
  content: ''; position: absolute; right: 3px; bottom: 3px; width: 8px; height: 8px;
  border-right: 2px solid rgba(255,255,255,0.25); border-bottom: 2px solid rgba(255,255,255,0.25);
}

`

function injectStyles () {
  if (document.getElementById('omni-selector-inspector-styles')) return
  const tag = document.createElement('style')
  tag.id = 'omni-selector-inspector-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

export default class OmniSelectorInspector {
  constructor (context) {
    this.ctx = context
    this._el = null
    this._isOpen = false
    this._drag = { active: false, startX: 0, startY: 0, originX: 0, originY: 0 }
    this._volumeId = null
    this._transform = null
    this._color = null
    this._wireframe = true
    this._groupedLabels = []
    this._saveTimer = null
    this._bannerTimer = null
    this._onInspectRequest = null
    this._onGrouped = null
  }

  init () {
    injectStyles()
    this._onInspectRequest = (e) => {
      const { volumeId, transform, color, wireframe, groupedLabels } = e.detail ?? {}
      if (!volumeId) return
      this._volumeId = volumeId
      this._transform = { ...transform }
      this._color = { ...color }
      this._wireframe = wireframe
      this._groupedLabels = groupedLabels ?? []
      this.open()
      this._render()
    }
    window.addEventListener('omni:selector-inspect-request', this._onInspectRequest)

    // Keep the grouped list live as OmniSelector recomputes containment
    // (e.g. from its own panel's sliders, not just this Inspector).
    this._onGrouped = (e) => {
      const { volumeId, containedIds } = e.detail ?? {}
      if (volumeId !== this._volumeId) return
      this._groupedLabels = containedIds
      this._renderGroupedList()
    }
    window.addEventListener('omni:selector-volume-grouped', this._onGrouped)
  }

  update () {}
  onResize () {}

  destroy () {
    window.removeEventListener('omni:selector-inspect-request', this._onInspectRequest)
    window.removeEventListener('omni:selector-volume-grouped', this._onGrouped)
    this._el?.parentNode?.removeChild(this._el)
    WindowManager.unregister('omniselectorinspector')
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
    el.className = 'omni-selector-inspector-panel'
    el.innerHTML = /* html */`
      <div class="osi-header">
        <span class="osi-title">⟐OmniSelect Inspector</span>
        <div class="osi-controls">
          <button class="osi-ctrl osi-ctrl--save" data-action="save" title="Save now">💾</button>
          <button class="osi-ctrl" data-action="close" title="Close">×</button>
        </div>
      </div>
      <div class="osi-notify-banner" id="osi-notify-banner"></div>
      <div class="osi-empty" id="osi-empty">Click a placed selection volume in the world, or open ⟐OmniSelect and place one.</div>
      <div class="osi-body" id="osi-body"></div>
      <div class="osi-resize-handle" aria-hidden="true"></div>
    `
    this._bindHeader(el)
    this._bindResize(el)
    el.querySelector('[data-action="close"]').addEventListener('click', () => this.close())
    el.querySelector('[data-action="save"]').addEventListener('click', (e) => this._explicitSave(e.currentTarget))

    el.dataset.winId = 'omniselectorinspector'
    WindowManager.register('omniselectorinspector', el, 'OmniSelect Inspector')
    WindowManager.watchPanelOpacity(el, () => this._isOpen)

    return el
  }

  _render () {
    if (!this._el) return
    this._el.querySelector('#osi-empty').style.display = 'none'
    const body = this._el.querySelector('#osi-body')
    body.classList.add('is-visible')

    const t = this._transform
    const c = this._color
    const rangeRow = (label, key, val, min, max, step) => /* html */`
      <div class="osi-row">
        <span class="osi-row-label">${label}</span>
        <input type="range" class="osi-range" data-key="${key}" min="${min}" max="${max}" step="${step}" value="${val}">
        <span class="osi-range-val" data-val-for="${key}">${Number(val).toFixed(step < 1 ? 2 : 0)}</span>
      </div>
    `

    body.innerHTML = /* html */`
      <div class="osi-group-title">Color (RGBA)</div>
      ${rangeRow('R', 'r', c.r, 0, 255, 1)}
      ${rangeRow('G', 'g', c.g, 0, 255, 1)}
      ${rangeRow('B', 'b', c.b, 0, 255, 1)}
      ${rangeRow('A', 'a', c.a, 0, 1, 0.01)}

      <div class="osi-group-title">Position</div>
      ${rangeRow('X', 'px', t.px, -100, 100, 1)}
      ${rangeRow('Y', 'py', t.py, -100, 100, 1)}
      ${rangeRow('Z', 'pz', t.pz, -100, 100, 1)}

      <div class="osi-group-title">Rotation</div>
      ${rangeRow('X', 'rx', t.rx, -3.14, 3.14, 0.01)}
      ${rangeRow('Y', 'ry', t.ry, -3.14, 3.14, 0.01)}
      ${rangeRow('Z', 'rz', t.rz, -3.14, 3.14, 0.01)}

      <div class="osi-group-title">Scale — resize to change what's selected</div>
      ${rangeRow('X', 'sx', t.sx, 0.1, 100, 0.1)}
      ${rangeRow('Y', 'sy', t.sy, 0.1, 100, 0.1)}
      ${rangeRow('Z', 'sz', t.sz, 0.1, 100, 0.1)}

      <div class="osi-group-title">Grouped — nodes currently inside this volume</div>
      <div class="osi-grouped-count" id="osi-grouped-count"></div>
      <div class="osi-grouped-list" id="osi-grouped-list"></div>
    `

    body.querySelectorAll('[data-key]').forEach(input => {
      input.addEventListener('input', (e) => {
        const key = input.dataset.key
        const value = Number(e.target.value)
        const valEl = body.querySelector(`[data-val-for="${key}"]`)
        if (valEl) valEl.textContent = value.toFixed(Number(input.step) < 1 ? 2 : 0)

        if (['r', 'g', 'b', 'a'].includes(key)) this._color[key] = value
        else this._transform[key] = value

        this._commit()
      })
    })

    this._renderGroupedList()
  }

  _renderGroupedList () {
    const list = this._el?.querySelector('#osi-grouped-list')
    const count = this._el?.querySelector('#osi-grouped-count')
    if (!list || !count) return
    count.textContent = `${this._groupedLabels.length} selected`
    list.innerHTML = this._groupedLabels.length
      ? this._groupedLabels.map(l => `<div class="osi-grouped-item">${l}</div>`).join('')
      : `<div class="osi-grouped-empty">Nothing inside the volume yet — try scaling it up.</div>`
  }

  /** Debounced — pushes edits back to ui/OmniSelector.js, which owns
   *  the actual mesh and recomputes the grouped selection. */
  _commit () {
    clearTimeout(this._saveTimer)
    this._saveTimer = setTimeout(() => {
      window.dispatchEvent(new CustomEvent('omni:selector-volume-updated', {
        detail: { volumeId: this._volumeId, transform: this._transform, color: this._color }
      }))
      this._flashBanner()
    }, 200)
  }

  _flashBanner (text = '✓ Saved') {
    const banner = this._el?.querySelector('#osi-notify-banner')
    if (!banner) return
    banner.textContent = text
    banner.classList.add('is-visible')
    clearTimeout(this._bannerTimer)
    this._bannerTimer = setTimeout(() => banner.classList.remove('is-visible'), 1400)
  }

  _explicitSave (btn) {
    if (!this._volumeId) return
    clearTimeout(this._saveTimer)
    window.dispatchEvent(new CustomEvent('omni:selector-volume-updated', {
      detail: { volumeId: this._volumeId, transform: this._transform, color: this._color }
    }))
    this._flashBanner('✓ Saved')
    btn?.classList.add('is-saved')
    setTimeout(() => btn?.classList.remove('is-saved'), 500)
  }

  // ── Header drag / resize ─────────────────────────────────────────────────

  _bindHeader (el) {
    const header = el.querySelector('.osi-header')
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
    const handle = el.querySelector('.osi-resize-handle')
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
