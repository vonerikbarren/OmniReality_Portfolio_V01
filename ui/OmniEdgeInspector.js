/**
 * ui/OmniEdgeInspector.js — ⟐mniReality Edge Inspector
 *
 * Opens when an edge (connector between two nodes) is clicked in
 * SELECT mode, or via the "✎" button in ⟐OmniNode's own edge list.
 * Edges are real, richly-configurable objects per the project's own
 * design: kind (cylinder / line / double), color, thickness, dashed
 * on/off, and an optional highlight halo + color. All actual geometry
 * building/rebuilding lives in systems/OmniNode.js (_buildEdgeLine,
 * _rebuildSingleEdge) — this panel only edits the style and dispatches
 * `omni:edge-style-set`, following the same "external panel writes
 * through owner module" pattern as MiniMap/Floor settings.
 *
 * Note on "line": native WebGL line width is unreliable across
 * browsers (most ignore `linewidth` entirely), so this codebase's
 * edges — including the "line" kind here — are real tapered cylinder
 * meshes, just a much thinner one for "line" than for "cylinder".
 * That gives true, consistent thickness rather than an unreliable
 * per-browser approximation, at the cost of "line" not being a
 * literal native line primitive.
 *
 * Follows the standard module contract (constructor / init / update / destroy).
 */

import * as WindowManager from './WindowManager.js'

const STYLES = /* css */`

.omni-edge-inspector-panel {
  --oei-bg          : var(--omni-theme-bg, rgba(8, 8, 12, 0.92));
  --oei-border      : var(--omni-theme-border, rgba(255, 255, 255, 0.09));
  --oei-header-bg   : var(--omni-theme-header-bg, rgba(255, 255, 255, 0.03));
  --oei-text        : var(--omni-theme-text, rgba(255, 255, 255, 1));
  --oei-text-dim    : var(--omni-theme-text-dim, rgba(255, 255, 255, 0.85));
  --oei-text-muted  : var(--omni-theme-text-muted, rgba(255, 255, 255, 0.6));
  --oei-accent      : var(--omni-theme-accent, #66ccff);
  --mono            : 'Courier New', Courier, monospace;

  position         : fixed;
  top              : 110px;
  right              : 400px;
  width            : 270px;
  min-width        : 240px;
  max-width        : 90vw;
  height           : 420px;
  min-height       : 300px;
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

.oei-empty { flex: 1; display: flex; align-items: center; justify-content: center; color: var(--oei-text-muted); font-size: 10px; text-align: center; padding: 20px; }

.oei-body { flex: 1 1 auto; overflow-y: auto; padding: 12px; display: none; }
.oei-body.is-visible { display: block; }

.oei-relation {
  font-size: 11px; color: var(--oei-text-dim); text-align: center;
  padding: 8px; margin-bottom: 10px;
  background: rgba(102, 204, 255, 0.06);
  border: 1px solid rgba(102, 204, 255, 0.18);
  border-radius: 6px;
}
.oei-relation-arrow { color: var(--oei-accent); margin: 0 6px; }

.oei-group-title {
  font-size: 9.5px; letter-spacing: 0.08em; text-transform: uppercase;
  color: var(--oei-accent); margin: 12px 0 6px; padding-top: 8px;
  border-top: 1px solid rgba(255,255,255,0.06);
}
.oei-group-title:first-child { margin-top: 0; padding-top: 0; border-top: none; }

.oei-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.oei-label { flex: 1; font-size: 9.5px; color: var(--oei-text-muted); }
.oei-select {
  flex: 1.2; height: 26px; background: rgba(255,255,255,0.05);
  border: 1px solid var(--oei-border); border-radius: 4px;
  color: var(--oei-text); font-family: var(--mono); font-size: 9.5px;
  padding: 0 6px;
}
.oei-range { flex: 1.2; accent-color: var(--oei-accent); }
.oei-range-val { width: 30px; text-align: right; font-size: 9px; color: var(--oei-text-dim); }
.oei-color { width: 34px; height: 22px; border: 1px solid var(--oei-border); border-radius: 4px; background: none; cursor: pointer; padding: 0; }

.oei-toggle-wrap { flex: 1.2; display: flex; justify-content: flex-end; }
.oei-toggle { position: relative; display: inline-block; width: 34px; height: 18px; }
.oei-toggle input { opacity: 0; width: 0; height: 0; }
.oei-toggle-track {
  position: absolute; inset: 0; background: rgba(255,255,255,0.12);
  border-radius: 10px; transition: background 0.15s;
}
.oei-toggle-track::before {
  content: ''; position: absolute; left: 2px; top: 2px; width: 14px; height: 14px;
  background: var(--oei-text-dim); border-radius: 50%; transition: transform 0.15s;
}
.oei-toggle input:checked + .oei-toggle-track { background: rgba(102, 204, 255, 0.55); }
.oei-toggle input:checked + .oei-toggle-track::before { transform: translateX(16px); background: #fff; }

.oei-note { font-size: 9px; line-height: 1.4; color: var(--oei-text-muted); margin-top: 6px; }

.oei-resize-handle { position: absolute; right: 0; bottom: 0; width: 16px; height: 16px; cursor: nwse-resize; }
.oei-resize-handle::before {
  content: ''; position: absolute; right: 3px; bottom: 3px; width: 8px; height: 8px;
  border-right: 2px solid rgba(255,255,255,0.25); border-bottom: 2px solid rgba(255,255,255,0.25);
}

`

function injectStyles () {
  if (document.getElementById('omni-edge-inspector-styles')) return
  const tag = document.createElement('style')
  tag.id = 'omni-edge-inspector-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

export default class OmniEdgeInspector {
  constructor (context) {
    this.ctx = context
    this._el = null
    this._isOpen = false
    this._drag = { active: false, startX: 0, startY: 0, originX: 0, originY: 0 }
    this._from = null
    this._to = null
    this._fromLabel = ''
    this._toLabel = ''
    this._style = null
    this._onInspectRequest = null
  }

  init () {
    injectStyles()
    this._onInspectRequest = (e) => {
      const { from, to, fromLabel, toLabel, style } = e.detail ?? {}
      if (!from || !to) return
      this._from = from
      this._to = to
      this._fromLabel = fromLabel ?? from
      this._toLabel = toLabel ?? to
      this._style = { kind: 'cylinder', color: null, thickness: 1, dashed: false, highlight: false, highlightColor: '#66ccff', ...style }
      this.open()
      this._render()
    }
    window.addEventListener('omni:edge-inspect-request', this._onInspectRequest)
  }

  update () {}
  onResize () {}

  destroy () {
    window.removeEventListener('omni:edge-inspect-request', this._onInspectRequest)
    this._el?.parentNode?.removeChild(this._el)
    WindowManager.unregister('omniedgeinspector')
  }

  open () {
    if (!this._el) this._el = this._buildDOM()
    const shell = document.getElementById('omni-ui') ?? document.body
    shell.appendChild(this._el)
    this._el.style.visibility = 'visible'
    this._el.style.opacity = '0'
    this._el.style.transform = 'scale(0.94)'
    requestAnimationFrame(() => {
      this._el.style.transition = 'opacity 0.28s ease, transform 0.28s cubic-bezier(0.2, 1.4, 0.4, 1)'
      this._el.style.opacity = String(WindowManager.getPanelOpacity())
      this._el.style.transform = 'scale(1)'
    })
    this._isOpen = true
    this._playSound('open')
  }

  close () {
    if (!this._el) return
    this._el.style.transition = 'opacity 0.18s ease, transform 0.18s ease'
    this._el.style.opacity = '0'
    this._el.style.transform = 'scale(0.94)'
    setTimeout(() => { if (this._el) this._el.style.visibility = 'hidden' }, 180)
    this._isOpen = false
    this._playSound('close')
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
    el.className = 'omni-edge-inspector-panel'
    el.innerHTML = /* html */`
      <div class="oei-header">
        <span class="oei-title">⟐ Edge Inspector</span>
        <div class="oei-controls">
          <button class="oei-ctrl" data-action="close" title="Close">×</button>
        </div>
      </div>
      <div class="oei-empty" id="oei-empty">Click a connector between two nodes in SELECT mode, or use the ✎ button in ⟐OmniNode's edge list.</div>
      <div class="oei-body" id="oei-body"></div>
      <div class="oei-resize-handle" aria-hidden="true"></div>
    `
    this._bindHeader(el)
    this._bindResize(el)
    el.querySelector('[data-action="close"]').addEventListener('click', () => this.close())

    el.dataset.winId = 'omniedgeinspector'
    WindowManager.register('omniedgeinspector', el, 'Edge Inspector')
    WindowManager.watchPanelOpacity(el, () => this._isOpen)

    return el
  }

  _render () {
    if (!this._el) return
    this._el.querySelector('#oei-empty').style.display = 'none'
    const body = this._el.querySelector('#oei-body')
    body.classList.add('is-visible')

    const s = this._style
    const thicknessPct = Math.round((s.thickness ?? 1) * 100)

    body.innerHTML = /* html */`
      <div class="oei-relation">${this._fromLabel}<span class="oei-relation-arrow">→</span>${this._toLabel}</div>

      <div class="oei-group-title">Kind</div>
      <div class="oei-row">
        <span class="oei-label">Style</span>
        <select class="oei-select" id="oei-kind">
          <option value="cylinder" ${s.kind === 'cylinder' ? 'selected' : ''}>Cylinder (default)</option>
          <option value="line"     ${s.kind === 'line'     ? 'selected' : ''}>Thin line</option>
          <option value="double"   ${s.kind === 'double'   ? 'selected' : ''}>Double line</option>
        </select>
      </div>

      <div class="oei-group-title">Appearance</div>
      <div class="oei-row">
        <span class="oei-label">Color</span>
        <input type="color" class="oei-color" id="oei-color" value="${s.color ?? '#ffffff'}">
      </div>
      <div class="oei-row">
        <span class="oei-label">Thickness</span>
        <input type="range" class="oei-range" id="oei-thickness" min="20" max="300" step="5" value="${thicknessPct}">
        <span class="oei-range-val" id="oei-thickness-val">${thicknessPct}%</span>
      </div>
      <div class="oei-row">
        <span class="oei-label">Dashed</span>
        <div class="oei-toggle-wrap">
          <label class="oei-toggle">
            <input type="checkbox" id="oei-dashed" ${s.dashed ? 'checked' : ''}>
            <div class="oei-toggle-track"></div>
          </label>
        </div>
      </div>

      <div class="oei-group-title">Highlight</div>
      <div class="oei-row">
        <span class="oei-label">Enabled</span>
        <div class="oei-toggle-wrap">
          <label class="oei-toggle">
            <input type="checkbox" id="oei-highlight" ${s.highlight ? 'checked' : ''}>
            <div class="oei-toggle-track"></div>
          </label>
        </div>
      </div>
      <div class="oei-row">
        <span class="oei-label">Highlight color</span>
        <input type="color" class="oei-color" id="oei-highlight-color" value="${s.highlightColor ?? '#66ccff'}">
      </div>

      <div class="oei-note">"Thin line" is still a real cylinder mesh, just a much thinner one — native WebGL line width isn't reliable across browsers, so every edge kind here renders as a true, consistently-thick mesh instead.</div>
    `

    const commit = (patch) => {
      this._style = { ...this._style, ...patch }
      window.dispatchEvent(new CustomEvent('omni:edge-style-set', {
        detail: { from: this._from, to: this._to, style: this._style }
      }))
    }

    body.querySelector('#oei-kind').addEventListener('change', (e) => commit({ kind: e.target.value }))
    body.querySelector('#oei-color').addEventListener('input', (e) => commit({ color: e.target.value }))
    body.querySelector('#oei-thickness').addEventListener('input', (e) => {
      const pct = Number(e.target.value)
      body.querySelector('#oei-thickness-val').textContent = `${pct}%`
      commit({ thickness: pct / 100 })
    })
    body.querySelector('#oei-dashed').addEventListener('change', (e) => commit({ dashed: e.target.checked }))
    body.querySelector('#oei-highlight').addEventListener('change', (e) => commit({ highlight: e.target.checked }))
    body.querySelector('#oei-highlight-color').addEventListener('input', (e) => commit({ highlightColor: e.target.value }))
  }

  // ── Header drag / resize — same pattern as every other panel ─────────────

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
      el.style.left = `${this._drag.originX + (cx - this._drag.startX)}px`
      el.style.top  = `${this._drag.originY + (cy - this._drag.startY)}px`
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
      el.style.width = `${resize.startW + (cx - resize.startX)}px`
      el.style.height = `${resize.startH + (cy - resize.startY)}px`
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
