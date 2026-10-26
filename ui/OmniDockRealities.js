/**
 * ui/OmniDockRealities.js — the OmniDock_Realities (V191)
 *
 * A second dock row directly ABOVE the bottom Dock (#omni-dock): one small WIREFRAME icon per main geometry (the 20 shapes a node can
 * have, utils/OmniGeometryCensus.js), in a horizontal strip of its own that scrolls sideways (momentum, no visible scrollbar; the mouse
 * wheel scrolls it too). The userCompass lives at its left end by default (ui/OmniUserCompass.js reads getDockRow() from utils/OmniLayout.js).
 *
 *   CLICK (mouse / pen / keyboard)  -> opens the "realities in this shape" panel (ui/OmniRealitiesInShape.js) for that geometry; click the
 *                                      same shape again to close it.
 *   HOVER (desktop)                 -> a quickTip in the OmniNotify box: the shape's name and its number of nodes ("4 nodes"). It uses the
 *                                      ordinary data-omni-tip attributes, refreshed whenever the counts change.
 *   TAP (touch)                     -> the first tap on a shape shows that quickTip (omni:notify-info) and arms the shape; a second tap on the
 *                                      same shape (within 6 s) opens the panel. A long-press still shows the tip through the OmniNotify hub.
 *
 * Counts come from the real node registry (OmniNode.getAllNodes()), refreshed (debounced 120 ms) on omni:node-created / -deleted / -updated /
 * omni:nodes-updated. Icons are SVG <path>s built from the pure wireframes (NO canvas, NO WebGL context). The shape under the pointer turns slowly
 * (<= 30 fps, one path) unless prefers-reduced-motion; nothing else animates and there is no loop while nothing is hovered.
 *
 * Options + storage + events: utils/OmniDockRealitiesSettings.js (omni:dock-realities-v1). Settings panel: ui/OmniDockRealitiesSettingsPanel.js.
 * Layout: the row announces its height through utils/OmniLayout.js setDockRow() -> --omni-dock-stack-h (the X meter and the bottom sheets sit above it).
 * Window-chrome class B (a bar, not a window). Module contract: constructor / init / update / destroy / onResize. No Dev* import.
 */

import {
  GEOMETRIES, GEOMETRY_IDS, countByGeometry, nodesPhrase, wireframeOf, projectWireframe, toPathData, isGeometryId,
} from '../utils/OmniGeometryCensus.js'
import * as S from '../utils/OmniDockRealitiesSettings.js'
import * as UCS from '../utils/OmniUserCompassSettings.js'
import { setDockRow, getDockRowInset, getTopStack, DOCK_BASE_H } from '../utils/OmniLayout.js'

export const ROOT_ID = 'omni-dock-realities'
const STYLE_ID = 'omni-dock-realities-styles'
const REFRESH_MS = 120
const ARM_MS = 6000
const SPIN_RAD_PER_S = 1.1
const SPIN_FRAME_MS = 1000 / 30
const BASE_YAW = 0.62, BASE_PITCH = 0.5
const VIEW = 40

const STYLES = /* css */`
#${ROOT_ID} {
  position: fixed; left: var(--odr-inset, 112px); right: var(--odr-inset, 112px); bottom: ${DOCK_BASE_H}px; height: var(--odr-h, 52px);
  box-sizing: border-box; display: flex; align-items: center; gap: 4px; padding: 0 4px 0 calc(var(--odr-reserve, 0px) + 4px);
  z-index: 49;                                   /* beside the Dock (50), over the hands (43) / compass (42) */
  pointer-events: none;                          /* the strip itself takes the pointer; the left end is the userCompass's spot */
  background: var(--omni-theme-bg, rgba(10, 10, 14, 0.5));
  border: 1px solid var(--omni-theme-border, rgba(255, 255, 255, 0.08)); border-bottom: none; border-radius: 10px 10px 0 0;
  backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
  font-family: 'Courier New', Courier, monospace; color: var(--omni-theme-text, rgba(255,255,255,.92));
  user-select: none; -webkit-user-select: none;
}
#${ROOT_ID}[data-show="false"] { display: none; }
/* V211: the other places the dock can sit */
#${ROOT_ID}[data-edge="top"] { top: calc(var(--odr-top, 100px) + 4px); bottom: auto; border: 1px solid var(--omni-theme-border, rgba(255,255,255,.08)); border-top: none; border-radius: 0 0 10px 10px; z-index: 44; }
#${ROOT_ID}[data-edge="left"], #${ROOT_ID}[data-edge="right"] {
  top: calc(var(--odr-top, 100px) + 8px); bottom: ${DOCK_BASE_H + 8}px; height: auto; width: calc(var(--odr-d, 40px) + 18px); flex-direction: column; padding: 4px 0;
  z-index: 44; border-radius: 10px; border: 1px solid var(--omni-theme-border, rgba(255,255,255,.08));
}
#${ROOT_ID}[data-edge="left"] { left: 4px; right: auto; }
#${ROOT_ID}[data-edge="right"] { right: 4px; left: auto; }
#${ROOT_ID}[data-edge="left"] .odr-scroll, #${ROOT_ID}[data-edge="right"] .odr-scroll, #${ROOT_ID}[data-edge="panel"] .odr-scroll { flex-direction: row; }
#${ROOT_ID}[data-edge="left"] .odr-scroll, #${ROOT_ID}[data-edge="right"] .odr-scroll {
  flex-direction: column; width: 100%; height: auto; overflow-x: hidden; overflow-y: auto; touch-action: pan-y; overscroll-behavior-y: contain;
  -webkit-mask-image: linear-gradient(180deg, transparent 0, #000 10px, #000 calc(100% - 10px), transparent 100%); mask-image: linear-gradient(180deg, transparent 0, #000 10px, #000 calc(100% - 10px), transparent 100%);
}
#${ROOT_ID}[data-edge="panel"] {
  left: var(--odr-px, 80px); top: var(--odr-py, 140px); right: auto; bottom: auto; width: min(560px, calc(100vw - 16px)); height: calc(var(--odr-h, 52px) + 22px);
  flex-direction: column; align-items: stretch; padding: 0 4px 4px; z-index: 46; border-radius: 10px; border: 1px solid var(--omni-theme-border, rgba(255,255,255,.14));
  box-shadow: 0 8px 28px rgba(0,0,0,.45);
}
#${ROOT_ID}[data-edge="panel"] .odr-scroll { height: var(--odr-h, 52px); flex: 0 0 auto; }
#${ROOT_ID} .odr-grip { display: none; }
#${ROOT_ID}[data-edge="panel"] .odr-grip {
  all: unset; display: block; box-sizing: border-box; height: 18px; cursor: grab; text-align: center; font-size: 11px; line-height: 18px; opacity: .6; pointer-events: auto; touch-action: none;
}
#${ROOT_ID}[data-edge="panel"] .odr-grip::after { content: '⋯⋯  drag  ⋯⋯'; }
#${ROOT_ID}[data-edge="panel"] .odr-grip:active { cursor: grabbing; }
#${ROOT_ID} .odr-scroll {
  flex: 1 1 auto; min-width: 0; height: 100%; display: flex; align-items: center; gap: 2px;
  overflow-x: auto; overflow-y: hidden; scrollbar-width: none; -ms-overflow-style: none;
  -webkit-overflow-scrolling: touch; overscroll-behavior-x: contain; touch-action: pan-x; scroll-behavior: auto;
  pointer-events: auto;
  -webkit-mask-image: linear-gradient(90deg, transparent 0, #000 10px, #000 calc(100% - 10px), transparent 100%);
          mask-image: linear-gradient(90deg, transparent 0, #000 10px, #000 calc(100% - 10px), transparent 100%);
}
#${ROOT_ID} .odr-scroll::-webkit-scrollbar { display: none; width: 0; height: 0; }
#${ROOT_ID} .odr-btn {
  all: unset; box-sizing: border-box; flex: 0 0 auto; position: relative; cursor: pointer;
  width: calc(var(--odr-d, 40px) + 6px); height: calc(var(--odr-d, 40px) + 6px); border-radius: 8px;
  display: flex; align-items: center; justify-content: center; -webkit-tap-highlight-color: transparent;
}
#${ROOT_ID} .odr-btn[hidden] { display: none; }
#${ROOT_ID} .odr-btn:hover { background: rgba(255,255,255,.1); }
#${ROOT_ID} .odr-btn:focus-visible { outline: 2px solid var(--omni-theme-accent, rgba(255,255,255,.9)); outline-offset: -2px; }
#${ROOT_ID} .odr-btn[aria-pressed="true"] { background: rgba(255,255,255,.2); box-shadow: inset 0 0 0 1px rgba(255,255,255,.55); }
#${ROOT_ID} .odr-btn[data-armed="true"] { box-shadow: inset 0 0 0 1px rgba(255,255,255,.4); }
#${ROOT_ID} .odr-btn[data-empty="true"] svg { opacity: .35; }
#${ROOT_ID} .odr-btn svg { width: var(--odr-d, 40px); height: var(--odr-d, 40px); display: block; overflow: visible; pointer-events: none; }
#${ROOT_ID} .odr-btn path { fill: none; stroke: currentColor; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; }
#${ROOT_ID} .odr-n {
  position: absolute; right: 1px; bottom: 0; min-width: 12px; padding: 0 3px; border-radius: 6px; text-align: center; pointer-events: none;
  font-size: max(9px, calc(var(--odr-d, 40px) * .26)); line-height: 1.25; color: #fff; background: rgba(0,0,0,.6);
}
#${ROOT_ID} .odr-btn[data-empty="true"] .odr-n { display: none; }
#${ROOT_ID} .odr-gear {
  all: unset; box-sizing: border-box; flex: 0 0 auto; cursor: pointer; pointer-events: auto; text-align: center;
  width: calc(var(--odr-d, 40px) * .7); height: calc(var(--odr-d, 40px) * .7); min-width: 24px; min-height: 24px; line-height: calc(var(--odr-d, 40px) * .7);
  border-radius: 7px; opacity: .65; font-size: 13px; -webkit-tap-highlight-color: transparent;
}
#${ROOT_ID} .odr-gear:hover, #${ROOT_ID} .odr-gear:focus-visible { opacity: 1; background: rgba(255,255,255,.12); }
@media (prefers-reduced-motion: reduce) { #${ROOT_ID} .odr-scroll { scroll-behavior: auto; } }
`

function injectStyles () {
  if (document.getElementById(STYLE_ID)) return
  const tag = document.createElement('style'); tag.id = STYLE_ID; tag.textContent = STYLES; document.head.appendChild(tag)
}

const SVGNS = 'http://www.w3.org/2000/svg'

/** The pure layout numbers: the icon size, the row height (the compass's box counts when it is docked in the row). */
export function rowMetrics (vw, size, compassBox = 0) {
  const d = S.iconPx(vw, size)
  const btn = d + 6
  const h = Math.max(btn + 8, compassBox > 0 ? compassBox + 6 : 0)
  return { d, btn, h, reserve: compassBox > 0 ? compassBox + 6 : 0 }
}

const el_attr = (el, k, v) => { if (el.getAttribute(k) !== v) el.setAttribute(k, v) }

export default class OmniDockRealities {
  constructor (context, omniNode = null) {
    this.ctx = context
    this.omniNode = omniNode
    this._el = null; this._scroll = null; this._gear = null
    this._btns = new Map()           // geometry id -> { btn, path, n }
    this._overrides = {}
    this._settings = S.resolveSettings({})
    this._counts = null; this._total = 0
    this._compass = { show: true, size: 'medium', custom: false }
    this._timer = null
    this._active = null              // geometry the panel is showing
    this._armed = null; this._armTimer = null
    this._ptype = ''
    this._spin = null                // { id, yaw, acc }
    this._reduced = false
    this._on = {}
  }

  // ── lifecycle ───────────────────────────────────────────────────────────────

  init () {
    if (this._el) return                                     // never twice
    injectStyles()
    this._overrides = S.loadOverrides()
    this._settings = S.resolveSettings(this._overrides)
    this._reduced = S.prefersReducedMotion()
    try { this._compass = { ...this._compass, ...this._readCompass(UCS.resolveSettings(UCS.loadOverrides()), !!UCS.loadPos()) } } catch (_) {}
    this._build()
    const on = this._on
    on.set = (e) => this._handleSet(e?.detail)
    on.nodes = () => this._scheduleRefresh()
    on.layout = () => this._layout()
    on.compass = (e) => { if (e?.detail?.settings) { this._compass = this._readCompass(e.detail.settings, !!e.detail.pos?.custom); this._layout() } }
    on.shape = (e) => { this._active = e?.detail?.geometry ?? null; this._syncPressed() }
    on.vis = () => { if (!document.hidden) this._refresh() }
    on.wheel = (e) => this._wheel(e)
    on.click = (e) => this._click(e)
    on.down = (e) => { this._ptype = e.pointerType || '' }
    on.over = (e) => this._hover(e, true)
    on.out = (e) => this._hover(e, false)
    on.key = (e) => this._key(e)
    window.addEventListener(S.SET_EVENT, on.set)
    on.grip = (e) => this._gripDown(e)
    this._grip?.addEventListener('pointerdown', on.grip)
    for (const ev of ['omni:node-created', 'omni:node-deleted', 'omni:node-updated', 'omni:nodes-updated']) window.addEventListener(ev, on.nodes)
    window.addEventListener('omni:layout-changed', on.layout)
    window.addEventListener('resize', on.layout)
    window.addEventListener(UCS.CHANGED_EVENT, on.compass)
    window.addEventListener(S.IN_SHAPE_CHANGED_EVENT, on.shape)
    document.addEventListener('visibilitychange', on.vis)
    this._scroll.addEventListener('wheel', on.wheel, { passive: false })
    this._scroll.addEventListener('click', on.click)
    this._scroll.addEventListener('pointerdown', on.down)
    this._scroll.addEventListener('pointerover', on.over)
    this._scroll.addEventListener('pointerout', on.out)
    this._scroll.addEventListener('keydown', on.key)
    this._gear.addEventListener('click', () => this.openSettings())
    this._apply()
    this._refresh()
    this._announce()
  }

  update (delta) {
    const sp = this._spin
    if (!sp || this._reduced || document.hidden) return
    sp.acc += delta * 1000
    sp.yaw += SPIN_RAD_PER_S * Math.min(delta, 0.1)
    if (sp.acc < SPIN_FRAME_MS) return
    sp.acc = 0
    this._drawIcon(sp.id, sp.yaw)
  }

  onResize () { this._layout() }

  destroy () {
    const on = this._on
    window.removeEventListener(S.SET_EVENT, on.set)
    this._grip?.removeEventListener('pointerdown', on.grip)
    for (const ev of ['omni:node-created', 'omni:node-deleted', 'omni:node-updated', 'omni:nodes-updated']) window.removeEventListener(ev, on.nodes)
    window.removeEventListener('omni:layout-changed', on.layout)
    window.removeEventListener('resize', on.layout)
    window.removeEventListener(UCS.CHANGED_EVENT, on.compass)
    window.removeEventListener(S.IN_SHAPE_CHANGED_EVENT, on.shape)
    document.removeEventListener('visibilitychange', on.vis)
    clearTimeout(this._timer); clearTimeout(this._armTimer)
    this._el?.remove()
    document.getElementById(STYLE_ID)?.remove()
    try { setDockRow({ on: false }) } catch (_) {}
    this._el = this._scroll = this._gear = null
    this._btns.clear(); this._on = {}
  }

  // ── public API ──────────────────────────────────────────────────────────────

  getSettings () { return JSON.parse(JSON.stringify(this._settings)) }
  getCounts () { return this._counts ? { ...this._counts } : null }
  getRowHeight () { return this._el && this._settings.show ? this._h : 0 }
  /** Programmatic form of the omni:dock-realities-set event. Returns true when something changed. */
  set (detail) { return this._handleSet(detail) }
  refreshNow () { this._refresh() }
  openSettings () { window.dispatchEvent(new CustomEvent(S.OPEN_SETTINGS_EVENT)) }
  /** The same thing a click does: ask the panel to show a shape (a second ask for the open shape closes it). */
  openShape (id) { if (isGeometryId(id)) window.dispatchEvent(new CustomEvent(S.IN_SHAPE_OPEN_EVENT, { detail: { geometry: id } })) }

  // ── build ───────────────────────────────────────────────────────────────────

  _build () {
    const el = document.createElement('div')
    el.id = ROOT_ID
    el.setAttribute('role', 'toolbar')
    el.setAttribute('aria-label', 'OmniDock_Realities: the main geometries')
    el.setAttribute('aria-orientation', 'horizontal')
    const scroll = document.createElement('div'); scroll.className = 'odr-scroll'
    for (const g of GEOMETRIES) {
      const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'odr-btn'; btn.dataset.geo = g.id
      btn.setAttribute('aria-pressed', 'false')
      const svg = document.createElementNS(SVGNS, 'svg'); svg.setAttribute('viewBox', `0 0 ${VIEW} ${VIEW}`); svg.setAttribute('aria-hidden', 'true')
      const path = document.createElementNS(SVGNS, 'path'); svg.appendChild(path)
      const n = document.createElement('span'); n.className = 'odr-n'
      btn.append(svg, n)
      scroll.appendChild(btn)
      this._btns.set(g.id, { btn, path, n })
      this._drawIcon(g.id, BASE_YAW)
    }
    const gear = document.createElement('button'); gear.type = 'button'; gear.className = 'odr-gear'; gear.textContent = '⚙'
    gear.setAttribute('aria-label', 'OmniDock_Realities settings')
    gear.setAttribute('data-omni-tip', 'OmniDock_Realities settings'); gear.setAttribute('data-omni-tip-key', '—')
    gear.setAttribute('data-omni-tip-desc', 'Icon size (S / M / L and a slider), opacity, a colour and opacity for each shape, hide shapes with 0 nodes, hide the whole row, and put the userCompass back in the row.')
    const grip = document.createElement('button'); grip.type = 'button'; grip.className = 'odr-grip'; grip.setAttribute('aria-label', 'Drag OmniDock_Realities')
    el.append(grip, scroll, gear)
    this._grip = grip
    this._el = el; this._scroll = scroll; this._gear = gear
    ;(document.getElementById('omni-ui') ?? document.body).appendChild(el)
  }

  /** (Re)draw one icon at a yaw. The base pose is cached per shape; only a spinning icon recomputes. */
  _drawIcon (id, yaw) {
    const b = this._btns.get(id); if (!b) return
    const d = toPathData(projectWireframe(wireframeOf(id), { yaw, pitch: BASE_PITCH, size: VIEW, pad: 3 }))
    b.path.setAttribute('d', d)
  }

  // ── settings ────────────────────────────────────────────────────────────────

  _handleSet (detail) {
    if (!this._el) return false
    const { overrides, changed } = S.applyChange(this._overrides, detail)
    if (!changed) return false
    this._overrides = overrides
    S.saveOverrides(overrides)
    this._settings = S.resolveSettings(overrides)
    this._apply()
    this._announce()
    return true
  }

  _announce () {
    window.dispatchEvent(new CustomEvent(S.CHANGED_EVENT, { detail: { settings: this.getSettings(), counts: this.getCounts() } }))
  }

  /** Settings -> DOM (visibility, per-shape colour + opacity) and the layout. */
  _apply () {
    const s = this._settings
    this._el.dataset.show = String(!!s.show)
    for (const [id, b] of this._btns) {
      const g = s.geo[id]
      b.btn.style.color = g.color
      b.btn.style.opacity = String(Math.round((s.opacity * g.opacity) / 100) / 100)
    }
    this._renderCounts()
    this._layout()
  }

  _readCompass (settings, custom) {
    return { show: settings?.show !== false, size: settings?.size ?? 'medium', custom: !!custom }
  }

  /** Width the userCompass takes at the left end of the row (0 when it is hidden or the person dragged it away). */
  _compassBox (vw) {
    const c = this._compass
    if (!c.show || c.custom) return 0
    const d = UCS.SIZES[c.size] ?? UCS.SIZES.medium
    const fit = Math.max(0, Math.min(d, Math.floor((Number(vw) || 0) - 2 * UCS.PAD - 2 * UCS.EDGE)))
    return fit > 0 ? UCS.boxFor(fit) : 0
  }

  _layout () {
    if (!this._el) return
    const vw = window.innerWidth || 1280
    const m = rowMetrics(vw, this._settings.size, this._compassBox(vw))
    this._h = m.h
    const st = this._el.style
    st.setProperty('--odr-d', m.d + 'px'); st.setProperty('--odr-h', m.h + 'px'); st.setProperty('--odr-reserve', m.reserve + 'px')
    st.setProperty('--odr-inset', getDockRowInset(vw) + 'px')
    const edge = this._settings.edge ?? 'bottom'
    el_attr(this._el, 'data-edge', edge)
    el_attr(this._el, 'aria-orientation', edge === 'left' || edge === 'right' ? 'vertical' : 'horizontal')
    st.setProperty('--odr-top', getTopStack() + 'px')
    const px = Math.max(0, Math.min(this._settings.px ?? 80, Math.max(0, (window.innerWidth || 1280) - 120)))
    const py = Math.max(0, Math.min(this._settings.py ?? 140, Math.max(0, (window.innerHeight || 720) - 80)))
    st.setProperty('--odr-px', px + 'px'); st.setProperty('--odr-py', py + 'px')
    setDockRow({ h: m.h, on: !!this._settings.show && edge === 'bottom' })   // only the bottom row pushes the sheets up
  }

  // ── counts ──────────────────────────────────────────────────────────────────

  _scheduleRefresh () {
    if (this._timer) return
    this._timer = setTimeout(() => { this._timer = null; this._refresh() }, REFRESH_MS)
  }

  _nodes () {
    try { return this.omniNode?.getAllNodes?.() ?? [] } catch (_) { return [] }
  }

  _refresh () {
    if (!this._el) return
    const { counts, total } = countByGeometry(this._nodes())
    const prev = this._counts
    this._counts = counts; this._total = total
    if (prev && GEOMETRY_IDS.every(id => prev[id] === counts[id])) return
    this._renderCounts()
    window.dispatchEvent(new CustomEvent(S.CHANGED_EVENT, { detail: { settings: this.getSettings(), counts: this.getCounts() } }))
  }

  _renderCounts () {
    const counts = this._counts ?? Object.fromEntries(GEOMETRY_IDS.map(id => [id, 0]))
    const hideEmpty = this._settings.hideEmpty
    for (const g of GEOMETRIES) {
      const b = this._btns.get(g.id); const n = counts[g.id] ?? 0
      const hide = hideEmpty && n === 0 && this._active !== g.id
      b.btn.hidden = hide
      b.btn.dataset.empty = String(n === 0)
      b.n.textContent = n > 99 ? '99+' : String(n)
      const phrase = nodesPhrase(n)
      b.btn.setAttribute('data-omni-tip', g.label)
      b.btn.setAttribute('data-omni-tip-key', phrase)
      b.btn.setAttribute('data-omni-tip-desc', n === 0
        ? `No ${g.label} nodes in this reality yet. ${this._touch() ? 'Tap again' : 'Click'} to open the list anyway.`
        : `${phrase} in this reality use the ${g.label} shape. ${this._touch() ? 'Tap again' : 'Click'} to list them with their ids.`)
      b.btn.setAttribute('aria-label', `${g.label}: ${phrase}`)
    }
  }

  _touch () { return this._ptype === 'touch' }

  _syncPressed () {
    for (const [id, b] of this._btns) b.btn.setAttribute('aria-pressed', String(this._active === id))
    if (this._settings.hideEmpty) this._renderCounts()
  }

  // ── interaction ─────────────────────────────────────────────────────────────

  _btnOf (e) { return e.target?.closest?.('.odr-btn') ?? null }

  _click (e) {
    const btn = this._btnOf(e); if (!btn) return
    const id = btn.dataset.geo
    const touch = this._ptype === 'touch'
    this._ptype = ''
    if (touch && this._armed !== id) { this._arm(id); return }   // first tap: just the quickTip
    this._disarm()
    this.openShape(id)
  }

  _arm (id) {
    this._disarm()
    this._armed = id
    const b = this._btns.get(id); b.btn.dataset.armed = 'true'
    const g = GEOMETRIES.find(x => x.id === id), n = this._counts?.[id] ?? 0
    window.dispatchEvent(new CustomEvent('omni:notify-info', { detail: { name: g.label, key: nodesPhrase(n), desc: `${nodesPhrase(n)} in this reality. Tap again to list them.`, holdMs: 4000 } }))
    this._armTimer = setTimeout(() => this._disarm(), ARM_MS)
  }

  _disarm () {
    clearTimeout(this._armTimer); this._armTimer = null
    if (this._armed) { const b = this._btns.get(this._armed); if (b) delete b.btn.dataset.armed }
    this._armed = null
  }

  _hover (e, over) {
    if (this._reduced) return
    const btn = this._btnOf(e); if (!btn || e.pointerType === 'touch') return
    const id = btn.dataset.geo
    if (over) { this._spin = { id, yaw: BASE_YAW, acc: 0 } }
    else if (this._spin?.id === id) { this._spin = null; this._drawIcon(id, BASE_YAW) }
  }

  /** V211: drag the floating panel by its grip; the position is saved when the pointer lets go. */
  _gripDown (e) {
    if (this._settings.edge !== 'panel' || e.button > 0) return
    e.preventDefault()
    const sx = e.clientX, sy = e.clientY, ox = this._settings.px, oy = this._settings.py
    const move = (ev) => {
      const nx = Math.max(0, Math.min(Math.round(ox + ev.clientX - sx), (window.innerWidth || 1280) - 120)), ny = Math.max(0, Math.min(Math.round(oy + ev.clientY - sy), (window.innerHeight || 720) - 80))
      this._el.style.setProperty('--odr-px', nx + 'px'); this._el.style.setProperty('--odr-py', ny + 'px'); this._dragXY = [nx, ny]
    }
    const up = () => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up)
      if (this._dragXY) { const [px, py] = this._dragXY; this._dragXY = null; this._handleSet({ patch: { px, py } }) }
    }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up)
  }

  _wheel (e) {
    const s = this._scroll
    if (!s || this._settings.edge === 'left' || this._settings.edge === 'right' || e.ctrlKey || Math.abs(e.deltaX) >= Math.abs(e.deltaY) || s.scrollWidth <= s.clientWidth) return
    e.preventDefault()
    s.scrollLeft += e.deltaY
  }

  _key (e) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Home' && e.key !== 'End') return
    const list = [...this._scroll.querySelectorAll('.odr-btn:not([hidden])')]
    const i = list.indexOf(document.activeElement); if (i < 0 && e.key.startsWith('Arrow')) return
    e.preventDefault()
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? list.length - 1 : Math.min(list.length - 1, Math.max(0, i + (e.key === 'ArrowRight' ? 1 : -1)))
    list[next]?.focus(); list[next]?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
  }
}
