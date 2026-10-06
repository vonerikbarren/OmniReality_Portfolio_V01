/**
 * ui/OmniDrawBehavior.js — ⟐OmniDraw(BehaviorNode)
 *
 * The creation flow for a NodeBehavior node. Pick a behaviour from a grid
 * (grouped by the five NodeBehaviorPackage classes; the user's Leader and
 * Follower sit in Relational), tweak its parameters (the form is generated
 * from systems/OmniNodeBehavior.js's BEHAVIOR_TABLE), choose targets (a
 * dropdown of existing nodes, or "Pick in scene"), then "Create
 * NodeBehavior" — which dispatches the ordinary omni:node-create-request,
 * carrying { isBehaviorNode: true, behavior: {…} }. systems/OmniNodeBehavior.js
 * starts it off omni:node-created. Nothing here animates anything itself.
 *
 * Opens on omni:nav-select { item: '⟐OmniDrawBehavior' } (the mode picker's
 * "BehaviorNode" tile).
 *
 * Tier B behaviours (Transform … Mediate) are a visual signal metaphor and
 * are marked "≈" in the grid.
 */

import * as THREE from 'three'
import gsap from 'gsap'
import * as WindowManager from './WindowManager.js'
import { generateId } from '../systems/OmniNode.js'
import { BEHAVIOR_TABLE, BEHAVIOR_CLASSES, CLASS_COLORS, behaviorDefaults, behaviorClassColorHex } from '../systems/OmniNodeBehavior.js'
import { createBehaviorForm } from './OmniNodeBehaviorForm.js'

const STYLES = `
.omni-draw-behavior-panel {
  pointer-events: auto;
  --odb-bg: var(--omni-theme-bg, rgba(8, 8, 12, 0.92));
  --odb-border: var(--omni-theme-border, rgba(255, 255, 255, 0.09));
  --odb-header-bg: var(--omni-theme-header-bg, rgba(255, 255, 255, 0.03));
  --odb-text: var(--omni-theme-text, rgba(255, 255, 255, 0.92));
  --odb-dim: var(--omni-theme-text-dim, rgba(255, 255, 255, 0.65));
  --odb-accent: var(--omni-theme-accent, #ffb347);
  --mono: 'Courier New', Courier, monospace;
  position: fixed; top: 90px; left: 440px; width: 380px; max-width: 94vw; height: 640px; max-height: 88vh; min-height: 260px;
  display: flex; flex-direction: column;
  background: var(--odb-bg); backdrop-filter: blur(20px) saturate(1.5); -webkit-backdrop-filter: blur(20px) saturate(1.5);
  border: 1px solid var(--odb-border); border-radius: 12px; box-shadow: 0 0 20px rgba(0,0,0,0.4), 0 10px 30px rgba(0,0,0,0.5);
  font-family: var(--mono); color: var(--odb-text); z-index: 60; overflow: hidden; resize: both; opacity: 0; visibility: hidden;
}
.odb-header { height: 38px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: var(--odb-header-bg); border-bottom: 1px solid var(--odb-border); cursor: grab; user-select: none; position: relative; }
.odb-title { font-size: 11px; letter-spacing: 0.05em; color: var(--odb-dim); }
.odb-controls { position: absolute; right: 8px; display: flex; gap: 4px; }
.odb-ctrl { width: 20px; height: 20px; border-radius: 5px; border: 1px solid var(--odb-border); background: rgba(255,255,255,0.04); color: var(--odb-dim); font-size: 11px; display: flex; align-items: center; justify-content: center; cursor: pointer; }
.odb-ctrl:hover { background: rgba(255,255,255,0.1); color: var(--odb-text); }
.odb-body { flex: 1 1 auto; min-height: 0; overflow-y: auto; padding: 12px 14px; display: flex; flex-direction: column; gap: 10px; }
.odb-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(86px, 1fr)); gap: 6px; }
.odb-class { grid-column: 1 / -1; font-size: 10px; letter-spacing: 0.08em; color: var(--odb-dim); padding: 6px 2px 2px; border-bottom: 1px solid var(--odb-border); display: flex; align-items: center; gap: 6px; }
.odb-class i { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
.odb-tile { position: relative; background: rgba(255,255,255,0.04); border: 1px solid var(--odb-border); border-left: 3px solid var(--c, #888); border-radius: 7px; color: var(--odb-text); font-family: inherit; font-size: 11px; padding: 8px 6px; cursor: pointer; text-align: center; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.odb-tile:hover { background: rgba(255,255,255,0.1); }
.odb-tile.is-active { background: rgba(255,255,255,0.16); border-color: var(--c, #888); box-shadow: 0 0 0 1px var(--c, #888) inset; }
.odb-tile sup { font-size: 8px; opacity: 0.7; margin-left: 2px; }
.odb-sel { font-size: 11px; color: var(--odb-dim); line-height: 1.5; }
.odb-name { background: rgba(255,255,255,0.04); border: 1px solid var(--odb-border); border-radius: 5px; color: var(--odb-text); font-family: inherit; font-size: 11px; padding: 7px; }
.odb-create { background: rgba(255,179,71,0.15); border: 1px solid var(--odb-accent); color: var(--odb-accent); font-family: inherit; font-size: 11px; padding: 8px; border-radius: 5px; cursor: pointer; }
.odb-create:hover { background: rgba(255,179,71,0.25); }
.odb-create:disabled { opacity: 0.4; cursor: default; }
.odb-master { display: flex; align-items: center; gap: 6px; font-size: 10px; color: var(--odb-dim); }
.odb-note { font-size: 9px; color: var(--odb-dim); opacity: 0.75; line-height: 1.5; }
@media (max-width: 520px) {
  .omni-draw-behavior-panel { left: 3vw !important; width: 94vw; }
  .odb-grid { grid-template-columns: repeat(auto-fill, minmax(72px, 1fr)); }
}
`

function injectStyles () {
  if (document.getElementById('odb-styles')) return
  const t = document.createElement('style'); t.id = 'odb-styles'; t.textContent = STYLES; document.head.appendChild(t)
}

const PACKAGE_URL = './data/NodeBehaviorPackage.json'

export default class OmniDrawBehavior {
  constructor (context) {
    this.ctx = context
    this._el = null
    this._isOpen = false
    this._onNavSelect = null
    this._pkg = null          // { name -> { class, summary, source } }
    this._type = 'Orbit'
    this._form = null
    this._cfg = null
  }

  init () {
    injectStyles()
    this._onNavSelect = (e) => { if (e.detail?.item === '⟐OmniDrawBehavior') this.open() }
    window.addEventListener('omni:nav-select', this._onNavSelect)
  }

  update () {}
  onResize () {}

  destroy () {
    window.removeEventListener('omni:nav-select', this._onNavSelect)
    this._form?.destroy()
    this._el?.parentNode?.removeChild(this._el)
    WindowManager.unregister('omnidrawbehavior')
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
      detail: { id: 'omnidrawbehavior', label: '⟐OmniDraw(BehaviorNode)', iconLabel: '⟐⟳',
        fromRect: { x: rect.left, y: rect.top, w: rect.width, h: rect.height }, variant: 'app' }
    }))
  }

  /** Tooltip text for a behaviour: the package summary when loaded, else the table hint. */
  _summary (name) { return this._pkg?.[name]?.summary ?? BEHAVIOR_TABLE[name]?.hint ?? '' }

  _loadPackage () {
    if (typeof fetch !== 'function') return
    fetch(PACKAGE_URL).then(r => r.ok ? r.json() : null).then(j => {
      const list = j?.NodeBehaviorPackage?.behaviors
      if (!Array.isArray(list)) return
      this._pkg = {}
      for (const b of list) this._pkg[b.name] = b
      this._renderGrid()
    }).catch(() => {})
  }

  _renderGrid () {
    const grid = this._el?.querySelector('#odb-grid')
    if (!grid) return
    grid.textContent = ''
    // Group by class. Order within a class: package order when loaded, else table order.
    const names = this._pkg ? Object.keys(this._pkg).filter(n => BEHAVIOR_TABLE[n]) : Object.keys(BEHAVIOR_TABLE)
    for (const cls of BEHAVIOR_CLASSES) {
      const inCls = names.filter(n => BEHAVIOR_TABLE[n].cls === cls)
      if (!inCls.length) continue
      const h = document.createElement('div'); h.className = 'odb-class'
      const dot = document.createElement('i'); dot.style.background = '#' + CLASS_COLORS[cls].toString(16).padStart(6, '0')
      h.append(dot, document.createTextNode(cls.toUpperCase()))
      grid.appendChild(h)
      for (const n of inCls) {
        const b = document.createElement('button'); b.type = 'button'
        b.className = 'odb-tile' + (n === this._type ? ' is-active' : '')
        b.dataset.behavior = n
        b.style.setProperty('--c', behaviorClassColorHex(n))
        b.title = this._summary(n) + (BEHAVIOR_TABLE[n].tier === 'B' ? '  [signal metaphor]' : '')
        b.textContent = n
        if (BEHAVIOR_TABLE[n].tier === 'B') { const s = document.createElement('sup'); s.textContent = '≈'; b.appendChild(s) }
        b.addEventListener('click', () => this._select(n))
        grid.appendChild(b)
      }
    }
  }

  _select (type) {
    this._type = type
    this._el.querySelectorAll('.odb-tile').forEach(t => t.classList.toggle('is-active', t.dataset.behavior === type))
    const keepTargets = this._cfg?.targets ?? []
    this._cfg = { type, params: behaviorDefaults(type), targets: keepTargets, enabled: true, role: BEHAVIOR_TABLE[type]?.role ?? null }
    this._el.querySelector('#odb-sel').textContent = `${type} — ${this._summary(type)}`
    const nameInput = this._el.querySelector('#odb-name')
    if (!nameInput.dataset.touched) nameInput.placeholder = '⟐' + type
    this._renderForm()
  }

  _renderForm () {
    const host = this._el.querySelector('#odb-form')
    this._form?.destroy()
    host.textContent = ''
    this._form = createBehaviorForm({ cfg: this._cfg, onChange: (c) => { this._cfg = c } })
    host.appendChild(this._form.el)
  }

  /** Real creation — an ordinary omni:node-create-request carrying the behaviour. */
  _create () {
    const cfg = this._form?.getConfig() ?? this._cfg
    if (!cfg?.type) return
    const id = generateId()
    const cam = this.ctx.camera
    const dir = new THREE.Vector3()
    cam.getWorldDirection(dir)
    dir.multiplyScalar(6)
    const position = [cam.position.x + dir.x, Math.max(0.5, cam.position.y + dir.y), cam.position.z + dir.z]
    const name = this._el.querySelector('#odb-name').value.trim()
    window.dispatchEvent(new CustomEvent('omni:node-create-request', {
      detail: {
        id, label: name || '⟐' + cfg.type, geometry: 'OctahedronGeometry', primitive: 'objective',
        color: behaviorClassColorHex(cfg.type), position, rotation: [0, 0, 0], scale: [0.5, 0.5, 0.5], parentId: null,
        isBehaviorNode: true, behavior: { ...cfg, enabled: true },
      }
    }))
    const status = this._el.querySelector('#odb-status')
    status.textContent = `Created ${name || '⟐' + cfg.type}. It starts about a second after it appears.`
  }

  _buildDOM () {
    const el = document.createElement('div')
    this._el = el   // set early: the render helpers below query this._el
    el.className = 'omni-draw-behavior-panel'
    el.innerHTML = `
      <div class="odb-header">
        <span class="odb-title">⟐OmniDraw(BehaviorNode)</span>
        <div class="odb-controls">
          <button class="odb-ctrl" data-action="minimize" title="Minimize">–</button>
          <button class="odb-ctrl" data-action="close" title="Close">×</button>
        </div>
      </div>
      <div class="odb-body">
        <div class="odb-grid" id="odb-grid"></div>
        <div class="odb-sel" id="odb-sel"></div>
        <div id="odb-form"></div>
        <input type="text" class="odb-name" id="odb-name" placeholder="Name (optional)" />
        <button class="odb-create" id="odb-create">Create NodeBehavior</button>
        <div class="odb-note" id="odb-status"></div>
        <label class="odb-master"><input type="checkbox" id="odb-master" checked> All behaviours running</label>
        <div class="odb-note">≈ = signal metaphor (beads along tethers): it illustrates the idea, there is no real signal/data layer yet. Everything else moves real nodes; they return to their saved spot when stopped.</div>
      </div>
    `
    el.querySelector('[data-action="minimize"]').addEventListener('click', () => this.minimize())
    el.querySelector('[data-action="close"]').addEventListener('click', () => this.close())
    el.querySelector('#odb-create').addEventListener('click', () => this._create())
    el.querySelector('#odb-name').addEventListener('input', (e) => { e.target.dataset.touched = e.target.value ? '1' : '' })
    const master = el.querySelector('#odb-master')
    try { master.checked = localStorage.getItem('omni:behavior-master-v1') !== '0' } catch (_) {}
    master.addEventListener('change', () => window.dispatchEvent(new CustomEvent('omni:node-behavior-master-set', { detail: { enabled: master.checked } })))

    this._renderGrid()
    this._loadPackage()
    this._select(this._type)
    this._bindHeader(el)
    el.dataset.winId = 'omnidrawbehavior'
    WindowManager.register('omnidrawbehavior', el, 'OmniDraw(BehaviorNode)')
    WindowManager.watchPanelOpacity(el, () => this._isOpen)
    return el
  }

  _bindHeader (el) {
    const header = el.querySelector('.odb-header')
    const drag = { active: false }
    const onDown = (e) => {
      if (e.target.closest('button')) return
      const cx = e.touches?.[0]?.clientX ?? e.clientX, cy = e.touches?.[0]?.clientY ?? e.clientY
      const rect = el.getBoundingClientRect()
      drag.active = true; drag.startX = cx; drag.startY = cy; drag.originX = rect.left; drag.originY = rect.top
    }
    const onMove = (e) => {
      if (!drag.active) return
      const cx = e.touches?.[0]?.clientX ?? e.clientX, cy = e.touches?.[0]?.clientY ?? e.clientY
      gsap.set(el, { left: drag.originX + (cx - drag.startX), top: drag.originY + (cy - drag.startY) })
    }
    const onUp = () => { drag.active = false }
    header.addEventListener('mousedown', onDown)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    header.addEventListener('touchstart', onDown, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', onUp)
  }
}
