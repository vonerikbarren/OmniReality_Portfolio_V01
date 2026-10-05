/**
 * ui/OmniAxinatorPanel.js — ⟐OmniAxinator, Admin slot 18
 *
 * Settings panel for the OmniAxinator component (systems/OmniAxinator.js).
 * Same panel pattern as ui/DimensionalAxesSettingsPanel.js: a small draggable
 * panel opened from an Admin slot via omni:nav-select, registered with
 * WindowManager, minimize event id 'axinatorpanel'. The axinator lives inside
 * the main.js-scoped OmniDimensionalAxes module, so events are the bridge:
 *
 *   dispatches  omni:axinator-list-request                (on open)
 *   dispatches  omni:axinator-tunnel-visible-set { id, visible }   (a row checkbox,
 *               Show all / Hide all) -> pins the tunnel on/off (manual override)
 *   dispatches  omni:dimension-axes-visible-set { visible }        (master toggle:
 *               "Tunnels follow the pads", same flag the older
 *               ⟐DimensionalAxesSettings toggle drives)
 *   listens     omni:axinator-list { name, followPads, tunnels:[...] }
 *   listens     omni:axinator-tunnel-visible { id, visible, manual, auto, ... }
 *   listens     omni:dimension-axes-visible { visible }
 *
 * Visibility rule shown in the note: a tunnel is shown if (its checkbox is on)
 * OR (its hand's pad is open AND "Tunnels follow the pads" is on). A row badge
 * "pad" marks a tunnel that is visible only because its pad is open.
 */

import gsap from 'gsap'
import * as WindowManager from './WindowManager.js'
import { TUNNEL_GROUPS } from '../data/OmniAxinatorData.js'

const STYLES = `
.oaxp-panel {
  pointer-events   : auto;
  --oaxp-bg        : var(--omni-theme-bg, rgba(8, 8, 12, 0.92));
  --oaxp-border    : var(--omni-theme-border, rgba(255, 255, 255, 0.09));
  --oaxp-header-bg : var(--omni-theme-header-bg, rgba(255, 255, 255, 0.03));
  --oaxp-text      : var(--omni-theme-text, rgba(255, 255, 255, 0.92));
  --oaxp-text-dim  : var(--omni-theme-text-dim, rgba(255, 255, 255, 0.65));
  --mono           : 'Courier New', Courier, monospace;
  position         : fixed;
  top              : 120px;
  left             : 150px;
  width            : 310px;
  min-width        : 260px;
  max-height       : 80vh;
  display          : flex;
  flex-direction   : column;
  background       : var(--oaxp-bg);
  backdrop-filter  : blur(20px) saturate(1.5);
  -webkit-backdrop-filter: blur(20px) saturate(1.5);
  border           : 1px solid var(--oaxp-border);
  border-radius    : 12px;
  box-shadow       : 0 0 20px rgba(0,0,0,0.4), 0 10px 30px rgba(0,0,0,0.5);
  font-family      : var(--mono);
  z-index          : 60;
  overflow         : hidden;
  opacity          : 0;
  visibility       : hidden;
}
.oaxp-header {
  height: 38px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;
  background: var(--oaxp-header-bg); border-bottom: 1px solid var(--oaxp-border);
  cursor: grab; user-select: none; position: relative;
}
.oaxp-title { font-size: 11px; letter-spacing: 0.05em; color: var(--oaxp-text-dim); }
.oaxp-controls { position: absolute; right: 8px; display: flex; gap: 4px; }
.oaxp-ctrl {
  width: 20px; height: 20px; border-radius: 5px; border: 1px solid var(--oaxp-border);
  background: rgba(255,255,255,0.04); color: var(--oaxp-text-dim); font-size: 11px;
  display: flex; align-items: center; justify-content: center; cursor: pointer;
}
.oaxp-ctrl:hover { background: rgba(255,255,255,0.1); color: var(--oaxp-text); }
.oaxp-body { padding: 12px 14px; display: flex; flex-direction: column; gap: 10px; overflow-y: auto; }
.oaxp-group-title {
  font-size: 9px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--oaxp-text-dim);
  border-bottom: 1px solid var(--oaxp-border); padding-bottom: 3px; margin-bottom: 2px;
}
.oaxp-rows { display: flex; flex-direction: column; gap: 5px; }
.oaxp-row { display: flex; align-items: center; gap: 8px; font-size: 10px; color: var(--oaxp-text); cursor: pointer; }
.oaxp-row input { margin: 0; cursor: pointer; }
.oaxp-swatch { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; border: 1px solid rgba(255,255,255,0.5); }
.oaxp-sym { min-width: 22px; text-align: center; font-size: 11px; }
.oaxp-name { flex: 1; }
.oaxp-badge {
  font-size: 8px; padding: 1px 5px; border-radius: 8px; letter-spacing: 0.05em;
  border: 1px solid rgba(255,255,255,0.3); color: var(--oaxp-text-dim); display: none;
}
.oaxp-badge.is-on { display: inline-block; }
.oaxp-btns { display: flex; gap: 8px; }
.oaxp-btn {
  flex: 1; background: rgba(140, 255, 180, 0.1); border: 1px solid rgba(140, 255, 180, 0.3);
  color: rgba(160, 255, 195, 0.95); border-radius: 6px; padding: 7px 10px;
  font-family: var(--mono); font-size: 9.5px; cursor: pointer; text-align: center;
}
.oaxp-btn:hover { background: rgba(140, 255, 180, 0.18); }
.oaxp-master { border-bottom: 1px solid var(--oaxp-border); padding-bottom: 8px; }
.oaxp-note { font-size: 9px; color: var(--oaxp-text-dim); opacity: 0.8; line-height: 1.5; }
`

function injectStyles () {
  if (document.getElementById('oaxp-styles')) return
  const tag = document.createElement('style')
  tag.id = 'oaxp-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

const hex = (n) => '#' + Number(n).toString(16).padStart(6, '0')

export default class OmniAxinatorPanel {
  constructor () {
    this._el = null
    this._isOpen = false
    this._tunnels = new Map()   // id -> summary
    this._followPads = true
    this._rows = new Map()      // id -> { input, badge }
  }

  init () {
    injectStyles()
    this._onNavSelect = (e) => {
      if (e.detail?.item !== '⟐OmniAxinator') return
      this.open()
    }
    this._onList = (e) => {
      const d = e.detail ?? {}
      if (typeof d.followPads === 'boolean') this._followPads = d.followPads
      ;(d.tunnels ?? []).forEach(t => this._tunnels.set(t.id, t))
      if (this._el) this._renderList()
    }
    this._onTunnelVisible = (e) => {
      const d = e.detail ?? {}
      if (!d.id) return
      this._tunnels.set(d.id, { ...(this._tunnels.get(d.id) ?? {}), ...d })
      this._syncRow(d.id)
    }
    this._onFollow = (e) => {
      this._followPads = !!e.detail?.visible
      const cb = this._el?.querySelector('#oaxp-follow')
      if (cb) cb.checked = this._followPads
    }
    window.addEventListener('omni:nav-select', this._onNavSelect)
    window.addEventListener('omni:axinator-list', this._onList)
    window.addEventListener('omni:axinator-tunnel-visible', this._onTunnelVisible)
    window.addEventListener('omni:dimension-axes-visible', this._onFollow)
  }

  update () {}
  onResize () {}

  destroy () {
    window.removeEventListener('omni:nav-select', this._onNavSelect)
    window.removeEventListener('omni:axinator-list', this._onList)
    window.removeEventListener('omni:axinator-tunnel-visible', this._onTunnelVisible)
    window.removeEventListener('omni:dimension-axes-visible', this._onFollow)
    this._unbindHeader?.()
    this._el?.parentNode?.removeChild(this._el)
    WindowManager.unregister('axinatorpanel')
  }

  open () {
    if (!this._el) this._el = this._buildDOM()
    const shell = document.getElementById('omni-ui') ?? document.body
    if (!this._el.parentNode) shell.appendChild(this._el)
    this._el.style.visibility = 'visible'
    gsap.to(this._el, { opacity: WindowManager.getPanelOpacity(), duration: 0.25 })
    this._isOpen = true
    window.dispatchEvent(new CustomEvent('omni:axinator-list-request'))
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
      detail: { id: 'axinatorpanel', label: '⟐OmniAxinator', iconLabel: '⟐X',
        fromRect: { x: rect.left, y: rect.top, w: rect.width, h: rect.height }, variant: 'app' }
    }))
  }

  _buildDOM () {
    const el = document.createElement('div')
    el.className = 'oaxp-panel'
    el.innerHTML = `
      <div class="oaxp-header">
        <span class="oaxp-title">⟐OmniAxinator</span>
        <div class="oaxp-controls">
          <button class="oaxp-ctrl" data-action="minimize" title="Minimize">–</button>
          <button class="oaxp-ctrl" data-action="close" title="Close">×</button>
        </div>
      </div>
      <div class="oaxp-body">
        <label class="oaxp-row oaxp-master">
          <input type="checkbox" id="oaxp-follow" ${this._followPads ? 'checked' : ''}>
          <span class="oaxp-name">Tunnels follow the pads</span>
        </label>
        <div id="oaxp-list"></div>
        <div class="oaxp-btns">
          <button class="oaxp-btn" id="oaxp-all">Show all</button>
          <button class="oaxp-btn" id="oaxp-none">Hide all</button>
        </div>
        <div class="oaxp-note">A tunnel is shown if its checkbox is on OR its hand's pad is open (and "follow the pads" is on). A checkbox pins a tunnel visible on top of that; the "pad" badge marks a tunnel visible only because its pad is open. The OmniAxinator is a reusable component: the same axes can be reused for another channel.</div>
      </div>
    `
    el.querySelector('[data-action="minimize"]').addEventListener('click', () => this.minimize())
    el.querySelector('[data-action="close"]').addEventListener('click', () => this.close())
    el.querySelector('#oaxp-follow').addEventListener('change', (e) => {
      window.dispatchEvent(new CustomEvent('omni:dimension-axes-visible-set', { detail: { visible: e.target.checked } }))
    })
    el.querySelector('#oaxp-all').addEventListener('click', () => this._setAll(true))
    el.querySelector('#oaxp-none').addEventListener('click', () => this._setAll(false))
    this._bindHeader(el)
    el.dataset.winId = 'axinatorpanel'
    WindowManager.register('axinatorpanel', el, 'OmniAxinator')
    WindowManager.watchPanelOpacity(el, () => this._isOpen)
    this._el = el
    this._renderList()
    return el
  }

  _setAll (visible) {
    this._tunnels.forEach((_, id) => {
      window.dispatchEvent(new CustomEvent('omni:axinator-tunnel-visible-set', { detail: { id, visible } }))
    })
  }

  _renderList () {
    const host = this._el?.querySelector('#oaxp-list')
    if (!host) return
    host.textContent = ''
    this._rows.clear()
    const known = new Set(TUNNEL_GROUPS.map(g => g.id))
    const groups = [...TUNNEL_GROUPS]
    this._tunnels.forEach(t => { if (!known.has(t.group)) { known.add(t.group); groups.push({ id: t.group, title: t.group }) } })
    groups.forEach(g => {
      const members = [...this._tunnels.values()].filter(t => t.group === g.id)
      if (!members.length) return
      const wrap = document.createElement('div')
      const title = document.createElement('div')
      title.className = 'oaxp-group-title'
      title.textContent = g.title
      const rows = document.createElement('div')
      rows.className = 'oaxp-rows'
      members.forEach(t => rows.appendChild(this._buildRow(t)))
      wrap.append(title, rows)
      host.appendChild(wrap)
    })
    const follow = this._el.querySelector('#oaxp-follow')
    if (follow) follow.checked = this._followPads
  }

  _buildRow (t) {
    const row = document.createElement('label')
    row.className = 'oaxp-row'
    const input = document.createElement('input')
    input.type = 'checkbox'
    input.checked = !!t.manual
    input.addEventListener('change', () => {
      window.dispatchEvent(new CustomEvent('omni:axinator-tunnel-visible-set', { detail: { id: t.id, visible: input.checked } }))
    })
    const sw = document.createElement('span')
    sw.className = 'oaxp-swatch'
    sw.style.background = hex(t.color)
    const sym = document.createElement('span')
    sym.className = 'oaxp-sym'
    sym.textContent = t.symbol
    const name = document.createElement('span')
    name.className = 'oaxp-name'
    name.textContent = t.title
    const badge = document.createElement('span')
    badge.className = 'oaxp-badge'
    badge.textContent = 'pad'
    badge.title = 'Visible because its pad is open'
    row.append(input, sw, sym, name, badge)
    this._rows.set(t.id, { input, badge })
    badge.classList.toggle('is-on', !!(t.visible && !t.manual))
    return row
  }

  _syncRow (id) {
    const r = this._rows.get(id)
    const t = this._tunnels.get(id)
    if (!r || !t) return
    r.input.checked = !!t.manual
    r.badge.classList.toggle('is-on', !!(t.visible && !t.manual))
  }

  _bindHeader (el) {
    const header = el.querySelector('.oaxp-header')
    const drag = { active: false }
    const onDown = (e) => {
      if (e.target.closest('button')) return
      const cx = e.touches?.[0]?.clientX ?? e.clientX
      const cy = e.touches?.[0]?.clientY ?? e.clientY
      const rect = el.getBoundingClientRect()
      drag.active = true; drag.startX = cx; drag.startY = cy; drag.originX = rect.left; drag.originY = rect.top
    }
    const onMove = (e) => {
      if (!drag.active) return
      const cx = e.touches?.[0]?.clientX ?? e.clientX
      const cy = e.touches?.[0]?.clientY ?? e.clientY
      gsap.set(el, { left: drag.originX + (cx - drag.startX), top: drag.originY + (cy - drag.startY) })
    }
    const onUp = () => { drag.active = false }
    header.addEventListener('mousedown', onDown)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    header.addEventListener('touchstart', onDown, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', onUp)
    this._unbindHeader = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onUp)
    }
  }
}
