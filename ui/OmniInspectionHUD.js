/**
 * ui/OmniInspectionHUD.js — ⟐mniReality OmniInspection HUD
 *
 * The four-quadrant data display for OmniVisor/OmniInspection — see
 * OMNIVISOR_DESIGN.md. This is the increment explicitly deferred when
 * ui/OmniInspection.js (the lens + perimeter detection) was built:
 * that module dispatches `omni:inspection-scope-updated` and
 * `omni:inspection-active-changed` specifically so this HUD could be
 * built as its own next piece, consuming those events rather than
 * needing to know how the lens itself works.
 *
 * Visually matches ui/OmniStartHUD.js's chrome (corner brackets,
 * center cross-lines, translucent quadrant panels) — its own CSS
 * namespace, not a shared import, but the same visual language on
 * purpose, since this is the same kind of full-screen HUD moment.
 *
 * Per the design doc's recommended scope: all four quadrants render,
 * but only Physical/Dimensional and Senses/Experiential show real
 * data. Cosmic shows one honest real number (how many objects are in
 * range — "a data overview," per the doc's own words) plus an
 * explicit "not yet defined" for anything deeper. Metaphysical is
 * entirely undefined right now and says so rather than faking a value.
 *
 * v1 simplification: the "primary" object shown in Physical/Senses is
 * just the first one in scope, not distance-sorted — nearest-object
 * would need this module to also know the inspection center point,
 * which isn't shared yet. Fine for a first pass; revisit if it matters.
 *
 * Follows the standard module contract (constructor / init / update / destroy).
 */

import gsap from 'gsap'

const STYLES = /* css */`

.oiv-hud {
  position         : fixed;
  inset            : 0;
  pointer-events   : none;
  z-index          : 75;
  opacity          : 0;
  font-family      : 'Courier New', Courier, monospace;
}

.oiv-corner {
  position         : absolute;
  width            : 34px;
  height           : 34px;
  pointer-events   : none;
  filter           : drop-shadow(0 0 6px rgba(140, 255, 180, 0.85));
}
.oiv-corner::before, .oiv-corner::after { content: ''; position: absolute; background: #8cffb4; }
.oiv-corner::before { width: 100%; height: 2px; }
.oiv-corner::after  { width: 2px; height: 100%; }
.oiv-corner--tl { top: 10px; left: 10px; }
.oiv-corner--tr { top: 10px; right: 10px; }
.oiv-corner--tr::after { right: 0; }
.oiv-corner--tr::before { right: 0; }
.oiv-corner--bl { bottom: 10px; left: 10px; }
.oiv-corner--bl::before { bottom: 0; }
.oiv-corner--br { bottom: 10px; right: 10px; }
.oiv-corner--br::before { bottom: 0; right: 0; }
.oiv-corner--br::after { right: 0; }

.oiv-line { position: absolute; background: rgba(140, 255, 180, 0.4); }
.oiv-line--h { top: 50%; left: 0; right: 0; height: 1px; }
.oiv-line--v { left: 50%; top: 0; bottom: 0; width: 1px; }

.oiv-quadrant {
  position         : absolute;
  width            : calc(50% - 46px);
  height           : calc(50% - 46px);
  display          : flex;
  pointer-events   : none;
}
.oiv-quadrant--tl { top: 28px;    left: 28px; }
.oiv-quadrant--tr { top: 28px;    right: 28px; }
.oiv-quadrant--bl { bottom: 28px; left: 28px; }
.oiv-quadrant--br { bottom: 28px; right: 28px; }

.oiv-panel {
  width            : 100%;
  height           : 100%;
  background       : rgba(8, 8, 12, 0.55);
  backdrop-filter  : saturate(1.4);
  -webkit-backdrop-filter: saturate(1.4);
  border           : 1px solid rgba(140, 255, 180, 0.22);
  border-radius    : 10px;
  padding          : 12px;
  overflow-y       : auto;
  pointer-events   : auto;
}

.oiv-panel-title {
  font-size        : 10px;
  letter-spacing   : 0.18em;
  color            : rgba(140, 255, 180, 0.85);
  margin-bottom     : 8px;
}
.oiv-row { font-size: 10px; color: rgba(255,255,255,0.8); margin-bottom: 4px; display: flex; justify-content: space-between; gap: 8px; }
.oiv-row-label { color: rgba(255,255,255,0.5); }
.oiv-undefined {
  font-size        : 9.5px;
  font-style       : italic;
  color            : rgba(255,255,255,0.35);
  line-height      : 1.5;
}
.oiv-swatch {
  display          : inline-block;
  width            : 12px; height: 12px;
  border-radius    : 3px;
  border           : 1px solid rgba(255,255,255,0.3);
  vertical-align   : middle;
  margin-right     : 6px;
}
.oiv-empty-note { font-size: 9.5px; color: rgba(255,255,255,0.4); }

`

function injectStyles () {
  if (document.getElementById('omni-inspection-hud-styles')) return
  const tag = document.createElement('style')
  tag.id = 'omni-inspection-hud-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

export default class OmniInspectionHUD {
  constructor (context) {
    this.ctx = context
    this._el = null
    this._allNodes = []
    this._inRangeIds = []
    this._onActiveChanged = null
    this._onScopeUpdated = null
    this._onNodesUpdated = null
  }

  init () {
    injectStyles()
    this._el = this._buildDOM()
    const shell = document.getElementById('omni-ui') ?? document.body
    shell.appendChild(this._el)

    this._onActiveChanged = (e) => {
      if (e.detail?.active) this._show()
      else this._hide()
    }
    window.addEventListener('omni:inspection-active-changed', this._onActiveChanged)

    this._onScopeUpdated = (e) => {
      this._inRangeIds = e.detail?.inRangeIds ?? []
      this._render()
    }
    window.addEventListener('omni:inspection-scope-updated', this._onScopeUpdated)

    this._onNodesUpdated = (e) => {
      this._allNodes = e.detail?.nodes ?? []
      this._render()
    }
    window.addEventListener('omni:nodes-updated', this._onNodesUpdated)
  }

  update () {}
  onResize () {}

  destroy () {
    window.removeEventListener('omni:inspection-active-changed', this._onActiveChanged)
    window.removeEventListener('omni:inspection-scope-updated', this._onScopeUpdated)
    window.removeEventListener('omni:nodes-updated', this._onNodesUpdated)
    this._el?.parentNode?.removeChild(this._el)
  }

  _show () {
    this._el.style.visibility = 'visible'
    gsap.to(this._el, { opacity: 1, duration: 0.4, ease: 'power2.out' })
  }

  _hide () {
    gsap.to(this._el, {
      opacity: 0, duration: 0.25, ease: 'power2.in',
      onComplete: () => { this._el.style.visibility = 'hidden' },
    })
  }

  _buildDOM () {
    const el = document.createElement('div')
    el.className = 'oiv-hud'
    el.style.visibility = 'hidden'
    el.innerHTML = /* html */`
      <div class="oiv-corner oiv-corner--tl" aria-hidden="true"></div>
      <div class="oiv-corner oiv-corner--tr" aria-hidden="true"></div>
      <div class="oiv-corner oiv-corner--bl" aria-hidden="true"></div>
      <div class="oiv-corner oiv-corner--br" aria-hidden="true"></div>
      <div class="oiv-line oiv-line--h" aria-hidden="true"></div>
      <div class="oiv-line oiv-line--v" aria-hidden="true"></div>

      <div class="oiv-quadrant oiv-quadrant--tl">
        <div class="oiv-panel" id="oiv-cosmic">
          <div class="oiv-panel-title">COSMIC</div>
        </div>
      </div>
      <div class="oiv-quadrant oiv-quadrant--tr">
        <div class="oiv-panel" id="oiv-metaphysical">
          <div class="oiv-panel-title">METAPHYSICAL</div>
        </div>
      </div>
      <div class="oiv-quadrant oiv-quadrant--bl">
        <div class="oiv-panel" id="oiv-physical">
          <div class="oiv-panel-title">PHYSICAL / DIMENSIONAL</div>
        </div>
      </div>
      <div class="oiv-quadrant oiv-quadrant--br">
        <div class="oiv-panel" id="oiv-senses">
          <div class="oiv-panel-title">SENSES / EXPERIENTIAL</div>
        </div>
      </div>
    `
    return el
  }

  _render () {
    if (!this._el) return
    const inRange = this._allNodes.filter(n => this._inRangeIds.includes(n.id))
    const primary = inRange[0] ?? null

    this._renderCosmic(inRange.length)
    this._renderMetaphysical()
    this._renderPhysical(primary, inRange.length)
    this._renderSenses(primary)
  }

  _renderCosmic (count) {
    const el = this._el.querySelector('#oiv-cosmic')
    el.innerHTML = /* html */`
      <div class="oiv-panel-title">COSMIC</div>
      <div class="oiv-row"><span class="oiv-row-label">Objects in range</span><span>${count}</span></div>
      <div class="oiv-undefined">Reality-layer depth — not yet defined.</div>
    `
  }

  _renderMetaphysical () {
    const el = this._el.querySelector('#oiv-metaphysical')
    el.innerHTML = /* html */`
      <div class="oiv-panel-title">METAPHYSICAL</div>
      <div class="oiv-undefined">Language/objectiveness correlation — not yet defined.</div>
    `
  }

  _renderPhysical (primary, count) {
    const el = this._el.querySelector('#oiv-physical')
    if (!primary) {
      el.innerHTML = `<div class="oiv-panel-title">PHYSICAL / DIMENSIONAL</div><div class="oiv-empty-note">Nothing in range.</div>`
      return
    }
    const pos = primary.position ?? [0, 0, 0]
    const rot = primary.rotation ?? [0, 0, 0]
    const scl = primary.scale ?? [1, 1, 1]
    const fmt = (n) => Number(n).toFixed(2)
    el.innerHTML = /* html */`
      <div class="oiv-panel-title">PHYSICAL / DIMENSIONAL</div>
      <div class="oiv-row"><span class="oiv-row-label">Object</span><span>${primary.label ?? primary.id}</span></div>
      <div class="oiv-row"><span class="oiv-row-label">Geometry</span><span>${primary.geometry ?? '—'}</span></div>
      <div class="oiv-row"><span class="oiv-row-label">Position</span><span>${fmt(pos[0])}, ${fmt(pos[1])}, ${fmt(pos[2])}</span></div>
      <div class="oiv-row"><span class="oiv-row-label">Rotation</span><span>${fmt(rot[0])}, ${fmt(rot[1])}, ${fmt(rot[2])}</span></div>
      <div class="oiv-row"><span class="oiv-row-label">Scale</span><span>${fmt(scl[0])}, ${fmt(scl[1])}, ${fmt(scl[2])}</span></div>
      ${count > 1 ? `<div class="oiv-empty-note">+ ${count - 1} more in range</div>` : ''}
    `
  }

  _renderSenses (primary) {
    const el = this._el.querySelector('#oiv-senses')
    if (!primary) {
      el.innerHTML = `<div class="oiv-panel-title">SENSES / EXPERIENTIAL</div><div class="oiv-empty-note">Nothing in range.</div>`
      return
    }
    const color = primary.color ?? '#ffffff'
    el.innerHTML = /* html */`
      <div class="oiv-panel-title">SENSES / EXPERIENTIAL</div>
      <div class="oiv-row"><span class="oiv-row-label">Color</span><span><span class="oiv-swatch" style="background:${color}"></span>${color}</span></div>
      <div class="oiv-row"><span class="oiv-row-label">Primitive</span><span>${primary.primitive ?? '—'}</span></div>
      <div class="oiv-undefined">Emotion/felt-quality data — not yet defined.</div>
    `
  }
}
