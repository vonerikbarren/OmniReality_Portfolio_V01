/**
 * ui/OmniSystemCreatorPanel.js — ⟐mniSystem Inspector
 *
 * Two formations now, sharing one Inspector and one per-node field
 * language (shape-icon preview, id/label, the primitive "truth"
 * dropdown, RGBA channels — the same language OmniDraw established).
 *
 * SKELETAL CROSS — fixed 7 nodes: 1 center (future OmniCore) + 6 arms,
 * one per axis direction.
 *
 * RADIAL RING — Stonehenge-style: 1 center (future OmniCore) + N outer
 * nodes, evenly spaced. The general formula, confirmed against every
 * worked example: node i sits at angle i*(360/N)°, measured clockwise
 * starting from 12 o'clock, always — no per-count exceptions. This one
 * formula reproduces N=2 (12&6 o'clock), N=3 (12,4,8), N=4 (12,3,6,9),
 * N=6 (every 2 hours), and works identically for any N, including
 * 8/10/12 — so the node count is a free "number of outer nodes" input,
 * not a fixed lookup table.
 *
 * Both formations share the same Group Lock mechanic: locked (default)
 * — one shared distance/radius value drives every outer node at once,
 * symmetrically; unlocked — each outer node gets its own independent
 * value. This is the concrete stand-in for what OmniCore will
 * eventually own and propagate, before OmniCore itself exists as code.
 *
 * "Create System" builds every node through NodeLoader's own real,
 * validated loadNode(data) path. Alpha is applied directly to each
 * created mesh's material right after creation — NodeLoader's saved
 * schema has no opacity field, so this is visible immediately but
 * won't survive a reload; an honest limitation, not a hidden one.
 *
 * Follows the standard module contract (constructor / init / update / destroy).
 */

import gsap from 'gsap'
import * as WindowManager from './WindowManager.js'

const GEOMETRIES = [
  'BoxGeometry', 'SphereGeometry', 'CylinderGeometry', 'ConeGeometry',
  'TorusGeometry', 'TorusKnotGeometry', 'OctahedronGeometry',
  'TetrahedronGeometry', 'IcosahedronGeometry', 'DodecahedronGeometry',
  'PlaneGeometry', 'CircleGeometry', 'RingGeometry', 'CapsuleGeometry',
]
const GEO_ICONS = {
  BoxGeometry: '⬜', SphereGeometry: '⬤', CylinderGeometry: '⬭', ConeGeometry: '▲',
  TorusGeometry: '◎', TorusKnotGeometry: '✤', OctahedronGeometry: '◆', TetrahedronGeometry: '△',
  IcosahedronGeometry: '⬡', DodecahedronGeometry: '⬠', PlaneGeometry: '▭', CircleGeometry: '○',
  RingGeometry: '◯', CapsuleGeometry: '⬮',
}
const PRIMITIVES = ['objective', 'subjective', 'undefined', 'false']
const DEFAULT_DISTANCE = 18
const MAX_DISTANCE = 60
const MAX_RING_NODES = 24
const MAX_SPHERE_NODES = 256
const GOLDEN_RATIO = (1 + Math.sqrt(5)) / 2

function rgbToHex (r, g, b) {
  const c = v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')
  return `#${c(r)}${c(g)}${c(b)}`
}

// ── Formation definitions ─────────────────────────────────────────────────
// Each returns an array of node defs: { key, label, isCenter, pos(distance) }

function crossDefs () {
  return [
    { key: 'center', label: 'OmniCore (future) — center', isCenter: true, pos: () => [0, 0, 0] },
    { key: 'up',      label: 'Arm — Up',      pos: d => [0, d, 0] },
    { key: 'down',    label: 'Arm — Down',    pos: d => [0, -d, 0] },
    { key: 'left',    label: 'Arm — Left',    pos: d => [-d, 0, 0] },
    { key: 'right',   label: 'Arm — Right',   pos: d => [d, 0, 0] },
    { key: 'forward', label: 'Arm — Forward', pos: d => [0, 0, -d] },
    { key: 'back',    label: 'Arm — Back',    pos: d => [0, 0, d] },
  ]
}

// One formula, confirmed against every worked example (N=2,3,4,6) —
// clockwise from 12 o'clock, always, no per-count exceptions. Works
// identically for any N, including 8/10/12.
function ringDefs (n) {
  const defs = [{ key: 'center', label: 'OmniCore (future) — center', isCenter: true, pos: () => [0, 0, 0] }]
  for (let i = 0; i < n; i++) {
    const angleDeg = i * (360 / n)
    const rad = angleDeg * Math.PI / 180
    defs.push({
      key: `ring-${i}`,
      label: `Ring Node ${i + 1} — ${Math.round(angleDeg)}°`,
      pos: d => [d * Math.sin(rad), 0, -d * Math.cos(rad)],
    })
  }
  return defs
}

// The canonical spherical Fibonacci lattice — confirmed against the
// standard reference. Distributes N points evenly across a sphere's
// surface in one pass, using the golden ratio as the spiral step —
// the same pattern seen in sunflower seed heads and pinecones. Works
// identically well for any N; no special-casing by count needed.
function sphereDefs (n) {
  const defs = [{ key: 'center', label: 'OmniCore (future) — center', isCenter: true, pos: () => [0, 0, 0] }]
  for (let i = 0; i < n; i++) {
    const y = n > 1 ? 1 - (2 * i) / (n - 1) : 0   // +1 (top) to -1 (bottom)
    const radiusAtY = Math.sqrt(Math.max(0, 1 - y * y))
    const theta = 2 * Math.PI * i / GOLDEN_RATIO
    const ux = Math.cos(theta) * radiusAtY
    const uz = Math.sin(theta) * radiusAtY
    defs.push({
      key: `sphere-${i}`,
      label: `Sphere Node ${i + 1}`,
      pos: d => [ux * d, y * d, uz * d],
    })
  }
  return defs
}

const STYLES = `

.omni-syscreator-panel {
  pointer-events   : auto;
  --sc-bg          : var(--omni-theme-bg, rgba(8, 8, 12, 0.92));
  --sc-border      : var(--omni-theme-border, rgba(255, 255, 255, 0.09));
  --sc-header-bg   : var(--omni-theme-header-bg, rgba(255, 255, 255, 0.03));
  --sc-text        : var(--omni-theme-text, rgba(255, 255, 255, 0.9));
  --sc-text-dim    : var(--omni-theme-text-dim, rgba(255, 255, 255, 0.6));
  --sc-input-bg    : var(--omni-theme-input-bg, rgba(255, 255, 255, 0.04));
  --sc-input-border: var(--omni-theme-input-border, rgba(255, 255, 255, 0.18));
  --sc-accent      : var(--omni-theme-accent, rgba(255, 178, 127, 0.9));
  --mono           : 'Courier New', Courier, monospace;

  position         : fixed;
  top              : 60px;
  left             : 120px;
  width            : 480px;
  min-width        : 380px;
  max-width        : 94vw;
  height           : 640px;
  min-height       : 340px;
  max-height       : 90vh;

  display          : flex;
  flex-direction   : column;

  background       : var(--sc-bg);
  backdrop-filter  : blur(22px) saturate(1.5);
  -webkit-backdrop-filter: blur(22px) saturate(1.5);
  border           : 1px solid var(--sc-border);
  border-radius    : 14px;
  box-shadow       : 0 0 24px rgba(0,0,0,0.4), 0 12px 40px rgba(0,0,0,0.55);

  font-family      : var(--mono);
  z-index          : 60;
  overflow         : hidden;
  opacity          : 0;
  visibility       : hidden;
}

.sc-header {
  height           : 40px;
  flex-shrink      : 0;
  display          : flex;
  align-items      : center;
  justify-content  : center;
  background       : var(--sc-header-bg);
  border-bottom    : 1px solid var(--sc-border);
  cursor           : grab;
  user-select      : none;
  position         : relative;
}
.sc-header.is-dragging { cursor: grabbing; }
.sc-title { font-size: 11px; letter-spacing: 0.05em; color: var(--sc-text-dim); }
.sc-controls { position: absolute; right: 8px; display: flex; gap: 4px; }
.sc-ctrl {
  width: 20px; height: 20px; border-radius: 5px;
  border: 1px solid var(--sc-border);
  background: rgba(255,255,255,0.04);
  color: var(--sc-text-dim);
  font-size: 11px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
}
.sc-ctrl:hover { background: rgba(255,255,255,0.1); color: var(--sc-text); }

.sc-formation-row {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 14px; border-bottom: 1px solid var(--sc-border); flex-shrink: 0; flex-wrap: wrap;
}
.sc-formation-row label { font-size: 10.5px; color: var(--sc-text-dim); }
.sc-formation-row select, .sc-formation-row input {
  background: var(--sc-input-bg); border: 1px solid var(--sc-input-border);
  border-radius: 4px; color: var(--sc-text); font-family: var(--mono);
  font-size: 10.5px; padding: 4px 6px;
}
.sc-count-input { width: 55px; }
.sc-lock-btn {
  padding: 5px 12px; border-radius: 5px; cursor: pointer;
  border: 1px solid rgba(255, 178, 127, 0.3);
  background: rgba(255, 178, 127, 0.08); color: var(--sc-accent);
  font-family: var(--mono); font-size: 10.5px;
}
.sc-lock-btn.is-unlocked { background: rgba(255,255,255,0.04); color: var(--sc-text-dim); border-color: var(--sc-input-border); }
.sc-gen-btn {
  padding: 5px 12px; border-radius: 5px; cursor: pointer;
  border: 1px solid rgba(255, 178, 127, 0.3);
  background: rgba(255, 178, 127, 0.08); color: var(--sc-accent);
  font-family: var(--mono); font-size: 10.5px;
}
.sc-gen-btn:hover { background: rgba(255, 178, 127, 0.16); }

.sc-body { flex: 1 1 auto; overflow-y: auto; padding: 10px 14px; }
.sc-body::-webkit-scrollbar { width: 6px; }
.sc-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 3px; }
.sc-empty { font-size: 10.5px; color: var(--sc-text-dim); text-align: center; padding: 30px 10px; }

.sc-node-row {
  border: 1px solid var(--sc-input-border); border-radius: 8px;
  padding: 8px 10px; margin-bottom: 8px; display: flex; gap: 10px;
}
.sc-preview {
  width: 40px; height: 40px; flex-shrink: 0; border-radius: 6px;
  background: var(--sc-input-bg); border: 1px solid var(--sc-input-border);
  display: flex; align-items: center; justify-content: center; font-size: 20px;
}
.sc-node-main { flex: 1; min-width: 0; }
.sc-node-head { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.sc-node-index { font-size: 9.5px; color: var(--sc-accent); white-space: nowrap; }
.sc-node-label-input {
  flex: 1; background: var(--sc-input-bg);
  border: 1px solid var(--sc-input-border); border-radius: 4px;
  color: var(--sc-text); font-family: var(--mono); font-size: 10.5px; padding: 3px 6px;
}
.sc-node-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 10px; }
.sc-field { display: flex; flex-direction: column; gap: 2px; }
.sc-field label { font-size: 9px; color: var(--sc-text-dim); }
.sc-field select, .sc-field input {
  background: var(--sc-input-bg); border: 1px solid var(--sc-input-border);
  border-radius: 4px; color: var(--sc-text); font-family: var(--mono);
  font-size: 10px; padding: 3px 5px;
}
.sc-rgba-row { display: flex; gap: 6px; grid-column: 1 / -1; }
.sc-rgba-row .sc-field { flex: 1; }
.sc-range-row { grid-column: 1 / -1; display: flex; align-items: center; gap: 6px; }
.sc-range-row input[type="range"] { flex: 1; }
.sc-range-row input[type="number"] { width: 60px; }
.sc-center-note { grid-column: 1 / -1; font-size: 8.5px; color: var(--sc-text-dim); opacity: 0.7; }

.sc-save-row { padding: 10px 14px; border-top: 1px solid var(--sc-border); flex-shrink: 0; }
.sc-save-btn {
  width: 100%; padding: 8px; border-radius: 6px;
  border: 1px solid rgba(255, 178, 127, 0.3);
  background: rgba(255, 178, 127, 0.08); color: var(--sc-accent);
  font-family: var(--mono); font-size: 11px; cursor: pointer;
}
.sc-save-btn:hover { background: rgba(255, 178, 127, 0.16); }
.sc-save-status { font-size: 9px; color: var(--sc-text-dim); text-align: center; margin-top: 5px; min-height: 12px; }
.sc-alpha-note { font-size: 8.5px; color: var(--sc-text-dim); opacity: 0.7; text-align: center; margin-top: 2px; }

.sc-resize-handle { position: absolute; right: 0; bottom: 0; width: 16px; height: 16px; cursor: nwse-resize; }
.sc-resize-handle::before {
  content: ''; position: absolute; right: 3px; bottom: 3px; width: 8px; height: 8px;
  border-right: 2px solid rgba(255,255,255,0.25); border-bottom: 2px solid rgba(255,255,255,0.25);
}

`

function injectStyles () {
  if (document.getElementById('omni-syscreator-styles')) return
  const tag = document.createElement('style')
  tag.id = 'omni-syscreator-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

let _idCounter = 0
function makeId () { return `omnisystem-${Date.now()}-${_idCounter++}` }

export default class OmniSystemCreatorPanel {
  constructor (context, nodeLoader) {
    this.ctx = context
    this.nodeLoader = nodeLoader
    this._el = null
    this._isOpen = false
    this._generated = false
    this._locked = true
    this._formation = 'cross'
    this._drag = { active: false }
  }

  init () {
    injectStyles()
    this._onNavSelect = (e) => {
      if (e.detail?.item !== '⟐OmniSystemCreator') return
      this.open()
    }
    window.addEventListener('omni:nav-select', this._onNavSelect)
  }

  update () {}
  onResize () {}

  destroy () {
    window.removeEventListener('omni:nav-select', this._onNavSelect)
    this._el?.parentNode?.removeChild(this._el)
    WindowManager.unregister('syscreator')
  }

  open () {
    if (!this._el) this._el = this._buildDOM()
    const shell = document.getElementById('omni-ui') ?? document.body
    if (!this._el.parentNode) shell.appendChild(this._el)
    this._el.style.visibility = 'visible'
    gsap.to(this._el, { opacity: WindowManager.getPanelOpacity(), duration: 0.25 })
    this._isOpen = true
  }

  close () {
    if (!this._el) return
    gsap.to(this._el, { opacity: 0, duration: 0.18, onComplete: () => { this._el.style.visibility = 'hidden' } })
    this._isOpen = false
  }

  minimize () {
    if (!this._el) return
    const rect = this._el.getBoundingClientRect()
    gsap.to(this._el, { opacity: 0, scale: 0.3, duration: 0.2, onComplete: () => { this._el.style.visibility = 'hidden' } })
    this._isOpen = false
    window.dispatchEvent(new CustomEvent('omni:panel-minimized', {
      detail: {
        id: 'syscreator', label: '⟐OmniSystemCreator', iconLabel: '⟐SC',
        fromRect: { x: rect.left, y: rect.top, w: rect.width, h: rect.height },
        variant: 'orb',
      }
    }))
  }

  // ── Generation ────────────────────────────────────────────────────────

  _currentDefs () {
    if (this._formation === 'ring') {
      const n = Math.max(2, Math.min(MAX_RING_NODES, parseInt(this._el.querySelector('.sc-count-input')?.value, 10) || 6))
      return ringDefs(n)
    }
    if (this._formation === 'sphere') {
      const n = Math.max(2, Math.min(MAX_SPHERE_NODES, parseInt(this._el.querySelector('.sc-count-input')?.value, 10) || 64))
      return sphereDefs(n)
    }
    return crossDefs()
  }

  _generate () {
    this._generated = true
    this._defs = this._currentDefs()
    this._distances = {}
    this._nodeMeta = {}
    this._defs.forEach(def => {
      if (!def.isCenter) this._distances[def.key] = DEFAULT_DISTANCE
      this._nodeMeta[def.key] = { label: def.label, geometry: 'BoxGeometry', primitive: 'objective', r: 255, g: 255, b: 255, a: 1 }
    })
    this._sharedDistance = DEFAULT_DISTANCE
    this._renderNodeList()
  }

  _toggleLock () {
    this._locked = !this._locked
    if (this._generated) this._renderNodeList()
  }

  _renderNodeList () {
    const list = this._el.querySelector('.sc-body')
    list.innerHTML = ''

    this._defs.forEach(def => {
      const meta = this._nodeMeta[def.key]
      const row = document.createElement('div')
      row.className = 'sc-node-row'
      row.dataset.key = def.key

      const distanceLabel = (this._formation === 'ring' || this._formation === 'sphere') ? 'Radius' : 'Distance'
      const rangeFieldHTML = def.isCenter ? '' : `
        <div class="sc-range-row">
          <label style="min-width:70px">${distanceLabel}${this._locked ? ' (shared)' : ''}</label>
          <input type="range" data-field="distance" min="0" max="${MAX_DISTANCE}" step="0.5"
                 value="${this._locked ? this._sharedDistance : this._distances[def.key]}">
          <input type="number" data-field="distance-num" min="0" max="${MAX_DISTANCE}" step="0.5"
                 value="${this._locked ? this._sharedDistance : this._distances[def.key]}">
        </div>`

      row.innerHTML = `
        <div class="sc-preview" data-role="preview">${GEO_ICONS[meta.geometry] ?? '◈'}</div>
        <div class="sc-node-main">
          <div class="sc-node-head"><span class="sc-node-index">${def.label}</span></div>
          <input class="sc-node-label-input" data-field="label" value="${meta.label}">
          <div class="sc-node-grid">
            <div class="sc-field">
              <label>Shape</label>
              <select data-field="geometry">
                ${GEOMETRIES.map(g => `<option value="${g}" ${g === meta.geometry ? 'selected' : ''}>${g}</option>`).join('')}
              </select>
            </div>
            <div class="sc-field">
              <label>Truth (primitive)</label>
              <select data-field="primitive">
                ${PRIMITIVES.map(p => `<option value="${p}" ${p === meta.primitive ? 'selected' : ''}>${p}</option>`).join('')}
              </select>
            </div>
            <div class="sc-rgba-row">
              <div class="sc-field"><label>R</label><input type="number" min="0" max="255" data-field="r" value="${meta.r}"></div>
              <div class="sc-field"><label>G</label><input type="number" min="0" max="255" data-field="g" value="${meta.g}"></div>
              <div class="sc-field"><label>B</label><input type="number" min="0" max="255" data-field="b" value="${meta.b}"></div>
              <div class="sc-field"><label>A</label><input type="number" min="0" max="1" step="0.05" data-field="a" value="${meta.a}"></div>
            </div>
            ${rangeFieldHTML}
            ${def.isCenter ? '<div class="sc-center-note">Center is always the origin — not a distance field.</div>' : ''}
          </div>
        </div>
      `
      list.appendChild(row)

      row.querySelector('[data-field="geometry"]')?.addEventListener('change', (e) => {
        meta.geometry = e.target.value
        row.querySelector('[data-role="preview"]').textContent = GEO_ICONS[meta.geometry] ?? '◈'
      })
      row.querySelector('[data-field="label"]')?.addEventListener('change', (e) => { meta.label = e.target.value })
      row.querySelector('[data-field="primitive"]')?.addEventListener('change', (e) => { meta.primitive = e.target.value })
      ;['r', 'g', 'b', 'a'].forEach(ch => {
        row.querySelector(`[data-field="${ch}"]`)?.addEventListener('change', (e) => { meta[ch] = Number(e.target.value) })
      })

      if (!def.isCenter) {
        const slider = row.querySelector('[data-field="distance"]')
        const numInput = row.querySelector('[data-field="distance-num"]')
        const onDistanceChange = (value) => {
          if (this._locked) {
            this._sharedDistance = value
            this._el.querySelectorAll('.sc-node-row').forEach(r => {
              if (r.dataset.key === 'center') return
              r.querySelector('[data-field="distance"]').value = value
              r.querySelector('[data-field="distance-num"]').value = value
            })
          } else {
            this._distances[def.key] = value
          }
        }
        slider.addEventListener('input', () => { numInput.value = slider.value; onDistanceChange(Number(slider.value)) })
        numInput.addEventListener('input', () => {
          const clamped = Math.min(MAX_DISTANCE, Math.max(0, Number(numInput.value) || 0))
          slider.value = clamped
          onDistanceChange(clamped)
        })
      }
    })
  }

  _readRows () {
    return this._defs.map(def => {
      const meta = this._nodeMeta[def.key]
      const distance = def.isCenter ? 0 : (this._locked ? this._sharedDistance : this._distances[def.key])
      const [x, y, z] = def.pos(distance)
      return { ...meta, x, y, z }
    })
  }

  _createSystem () {
    if (!this._generated) return
    const rows = this._readRows()
    let created = 0
    const errors = []

    for (const row of rows) {
      const data = {
        id: makeId(),
        label: row.label,
        geometry: row.geometry,
        primitive: row.primitive,
        color: rgbToHex(row.r, row.g, row.b),
        position: [row.x, row.y, row.z],
        createdAt: new Date().toISOString(),
      }
      try {
        const { mesh } = this.nodeLoader.loadNode(data)
        if (mesh?.material && row.a < 1) {
          mesh.material.transparent = true
          mesh.material.opacity = row.a
        }
        created++
      } catch (err) {
        errors.push(`${row.label}: ${err.message}`)
      }
    }

    const status = this._el.querySelector('.sc-save-status')
    status.textContent = errors.length
      ? `Created ${created}/${rows.length} — ${errors.length} failed (see console)`
      : `Created ${created} node${created === 1 ? '' : 's'}`
    if (errors.length) console.error('⟐ OmniSystemCreator — some nodes failed:', errors)
  }

  _buildDOM () {
    const el = document.createElement('div')
    el.className = 'omni-syscreator-panel'
    el.innerHTML = `
      <div class="sc-header">
        <span class="sc-title">⟐OmniSystem Inspector</span>
        <div class="sc-controls">
          <button class="sc-ctrl" data-action="minimize" title="Minimize">–</button>
          <button class="sc-ctrl" data-action="close" title="Close">×</button>
        </div>
      </div>
      <div class="sc-formation-row">
        <label>Formation</label>
        <select data-field="formation">
          <option value="cross">Skeletal Cross (fixed 7)</option>
          <option value="ring">Radial Ring (Stonehenge)</option>
          <option value="sphere">Sphere (Fibonacci)</option>
        </select>
        <label class="sc-count-only" style="display:none">Outer nodes</label>
        <input class="sc-count-input sc-count-only" type="number" min="2" max="${MAX_SPHERE_NODES}" value="6" style="display:none">
        <button class="sc-lock-btn" data-action="toggle-lock">Locked (shared)</button>
        <button class="sc-gen-btn" data-action="generate">Generate</button>
      </div>
      <div class="sc-body"><div class="sc-empty">Choose a formation and click "Generate" to begin.</div></div>
      <div class="sc-save-row">
        <button class="sc-save-btn" data-action="create">Create System</button>
        <div class="sc-save-status"></div>
        <div class="sc-alpha-note">Alpha is applied live to created nodes but isn't saved — a reload resets it to opaque.</div>
      </div>
      <div class="sc-resize-handle" aria-hidden="true"></div>
    `

    this._bindHeader(el)
    this._bindResize(el)
    el.querySelector('[data-action="minimize"]').addEventListener('click', () => this.minimize())
    el.querySelector('[data-action="close"]').addEventListener('click', () => this.close())
    el.querySelector('[data-action="generate"]').addEventListener('click', () => this._generate())
    el.querySelector('[data-action="create"]').addEventListener('click', () => this._createSystem())
    el.querySelector('[data-action="toggle-lock"]').addEventListener('click', (e) => {
      this._toggleLock()
      e.target.textContent = this._locked ? 'Locked (shared)' : 'Unlocked (individual)'
      e.target.classList.toggle('is-unlocked', !this._locked)
    })
    el.querySelector('[data-field="formation"]').addEventListener('change', (e) => {
      this._formation = e.target.value
      const showCount = this._formation === 'ring' || this._formation === 'sphere'
      el.querySelectorAll('.sc-count-only').forEach(node => { node.style.display = showCount ? '' : 'none' })
      const countInput = el.querySelector('.sc-count-input')
      if (this._formation === 'ring') { countInput.value = '6'; countInput.max = String(MAX_RING_NODES) }
      if (this._formation === 'sphere') { countInput.value = '64'; countInput.max = String(MAX_SPHERE_NODES) }
    })

    el.dataset.winId = 'syscreator'
    WindowManager.register('syscreator', el, 'OmniSystem Inspector')
    WindowManager.watchPanelOpacity(el, () => this._isOpen)

    return el
  }

  _bindHeader (el) {
    const header = el.querySelector('.sc-header')
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
    const handle = el.querySelector('.sc-resize-handle')
    if (!handle) return
    const resize = { active: false }
    const onDown = (e) => {
      e.stopPropagation()
      const cx = e.touches?.[0]?.clientX ?? e.clientX
      const cy = e.touches?.[0]?.clientY ?? e.clientY
      const rect = el.getBoundingClientRect()
      resize.active = true; resize.startX = cx; resize.startY = cy; resize.startW = rect.width; resize.startH = rect.height
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
