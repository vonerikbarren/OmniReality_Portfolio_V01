/**
 * ui/OmniStateStrictAlign.js — OmniState_StrictAlign (V191)
 *
 * The "`" (Backquote) key toggles a mode in which the selected node can move along exactly ONE axis (X, Y or Z) with exact coordinates:
 *
 *   panel      bottom centre, above the OmniDock_Realities row: three coordinate fields X / Y / Z (the node's exact WORLD coordinates).
 *              The chosen axis is editable; the other two are locked (read-only) and show their exact values underneath.
 *   axis       (V192) a CHECKMARK beside each coordinate: exactly one is checked (checking one unchecks the others, the last one cannot be
 *              unchecked); the checked axis is the focused axis. The keys 1 2 3 / x y z toggle it too.
 *   target     (V192) click any node in the scene while the mode is on to switch the target to it (omni:node-select-by-id); the displayed X / Y / Z
 *              are the node's real WORLD position; every move is an ABSOLUTE set rounded to the "precision" setting (default 4 decimals).
 *   move       - drag the coloured axis line / arrow (or the node itself) with the mouse or a finger: the node follows along the line only
 *              - the panel's arrow buttons (- / +, hold to repeat) move by the STEP FIELD (any number; chips 0.01 / 0.1 / 1 / 10; persisted)
 *              - arrow keys (Up / Right = +, Down / Left = -), PageUp / PageDown, or the mouse wheel over the node / line: one step (Shift = x10, Alt = /10)
 *              - type an exact value in the field and press Enter
 *              - Ctrl+Z undoes the last move made in the mode (this session)
 *   leave      Esc, the "`" key again, or the close button.
 *   together   the move applies to the primary node AND to the "moves together" set (omni:strictalign-selection-set { ids } / the nodes grouped by
 *              an OmniSelector volume): each moves by the same delta along the chosen axis (a group moves its members with it; nothing moves twice).
 *
 * It reuses the app's own position API: `omni:node-pos-set { id, position }` (what the Inspector Location fields and programs use), so OmniNode
 * keeps persistence ('omni:nodes'), tapered edges, labels and the Inspector in step; the Inspector's Location fields are refreshed too. While a
 * mouse drag is running the mesh follows the pointer every frame and the event is sent at most every 100 ms (and once at the end).
 *
 * Cannot be moved (the panel says why): nothing selected, tracking nodes (they orbit on their own), objects that are not OmniNodes, behaviour-locked
 * nodes, structural nodes (skipAutoSelect), nodes that are not in the scene.
 *
 * Keys: "`" used to open the terminal; the terminal keeps F1 (main.js's handler is untouched: this capture-phase handler takes the Backquote first).
 * The key is ignored while typing in an input / textarea / select / contentEditable. Window-chrome class B (an overlay, not a window).
 *
 * Options + storage + events: utils/OmniStateStrictAlignSettings.js (omni:strictalign-v1); pure math: utils/StrictAlign.js.
 * Module contract: constructor / init / update / destroy / onResize. User-facing: imports no Dev* module.
 */

import * as THREE from 'three'
import * as SA from '../utils/StrictAlign.js'
import * as S from '../utils/OmniStateStrictAlignSettings.js'
import * as Extra from '../utils/OmniExtraKinds.js'
import { isExpressionOn } from '../utils/OmniExpressionFlag.js'   // V195

export const ROOT_ID = 'omni-state-strictalign'
const STYLE_ID = 'omni-state-strictalign-styles'
const LEN = 5                       // gizmo half-length in gizmo units (the group is scaled with the camera distance)
const COMMIT_MS = 100
const HISTORY_MAX = 100
const HOLD_DELAY_MS = 380, HOLD_REPEAT_MS = 70   // arrow buttons: hold to repeat
const CLICK_SLOP_PX = 6

const STYLES = /* css */`
#${ROOT_ID} {
  position: fixed; left: 50%; transform: translateX(-50%); bottom: calc(var(--omni-dock-stack-h, 52px) + 56px);
  z-index: 1500; box-sizing: border-box; width: min(430px, calc(100vw - 16px)); padding: 8px 10px 9px; pointer-events: auto;
  display: none; flex-direction: column; gap: 6px;
  background: var(--omni-theme-bg, rgba(10, 10, 14, 0.9)); color: var(--omni-theme-text, rgba(255,255,255,.93));
  border: 1px solid var(--omni-theme-border, rgba(255,255,255,.18)); border-radius: 12px; box-shadow: 0 8px 28px rgba(0,0,0,.5);
  backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); font: 11px 'Courier New', Courier, monospace; user-select: none; -webkit-user-select: none;
}
#${ROOT_ID}[data-open="1"] { display: flex; }
#${ROOT_ID} .osa-head { display: flex; align-items: center; gap: 8px; }
#${ROOT_ID} .osa-title { font-weight: bold; letter-spacing: .04em; }
#${ROOT_ID} .osa-node { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; opacity: .8; text-align: right; }
#${ROOT_ID} button, #${ROOT_ID} input { font: inherit; color: inherit; box-sizing: border-box; min-height: 30px; border-radius: 7px; border: 1px solid var(--omni-theme-border, rgba(255,255,255,.22)); background: rgba(255,255,255,.07); }
#${ROOT_ID} button { cursor: pointer; padding: 0 10px; -webkit-tap-highlight-color: transparent; } #${ROOT_ID} button:hover { background: rgba(255,255,255,.17); }
#${ROOT_ID} .osa-close { min-width: 30px; padding: 0; }
#${ROOT_ID} .osa-chk { display: inline-flex; align-items: center; gap: 5px; cursor: pointer; font-weight: bold; min-height: 24px; }
#${ROOT_ID} input.osa-axis { appearance: auto; -webkit-appearance: checkbox; width: 18px; height: 18px; min-height: 0; padding: 0; margin: 0; cursor: pointer; accent-color: var(--osa-c, #fff); }
#${ROOT_ID} .osa-f[data-f="x"] { --osa-c: ${SA.AXIS_COLORS.x}; } #${ROOT_ID} .osa-f[data-f="y"] { --osa-c: ${SA.AXIS_COLORS.y}; } #${ROOT_ID} .osa-f[data-f="z"] { --osa-c: ${SA.AXIS_COLORS.z}; }
#${ROOT_ID} .osa-f[data-active="true"] .osa-chk { color: var(--osa-c); }
#${ROOT_ID} .osa-move { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
#${ROOT_ID} .osa-arrow { min-width: 44px; font-size: 15px; font-weight: bold; touch-action: none; }
#${ROOT_ID} .osa-arrow[data-dir="-1"] { color: #ffb0b0; } #${ROOT_ID} .osa-arrow[data-dir="1"] { color: #b0ffc4; }
#${ROOT_ID} .osa-steplab { opacity: .75; } #${ROOT_ID} .osa-step { width: 74px; text-align: right; padding: 0 8px; user-select: text; -webkit-user-select: text; }
#${ROOT_ID} .osa-step.is-bad { border-color: #ff6b6b; box-shadow: 0 0 0 1px #ff6b6b; }
#${ROOT_ID} .osa-chips { display: flex; gap: 4px; margin-left: auto; } #${ROOT_ID} .osa-chip { min-height: 26px; padding: 0 7px; border-radius: 13px; font-size: 10.5px; }
#${ROOT_ID} .osa-chip[aria-pressed="true"] { background: rgba(255,255,255,.85); color: #111; font-weight: bold; }
#${ROOT_ID}[data-blocked="true"] .osa-move { opacity: .5; }
#${ROOT_ID} .osa-coords { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
#${ROOT_ID} .osa-f { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
#${ROOT_ID} .osa-flab { display: flex; justify-content: space-between; align-items: center; opacity: .95; }
#${ROOT_ID} .osa-f input { width: 100%; padding: 0 8px; text-align: right; user-select: text; -webkit-user-select: text; }
#${ROOT_ID} .osa-f input[readonly] { opacity: .65; background: rgba(255,255,255,.03); border-style: dashed; cursor: default; }
#${ROOT_ID} .osa-f[data-active="true"] input { border-color: var(--osa-axis, #fff); box-shadow: 0 0 0 1px var(--osa-axis, #fff); }
#${ROOT_ID} .osa-f input.is-bad { border-color: #ff6b6b; box-shadow: 0 0 0 1px #ff6b6b; }
#${ROOT_ID} .osa-msg { min-height: 14px; opacity: .85; line-height: 1.35; } #${ROOT_ID} .osa-msg.is-warn { color: #ffb347; }
#${ROOT_ID} .osa-hint { font-size: 10px; opacity: .6; line-height: 1.35; }
#${ROOT_ID} .osa-more { display: none; align-items: center; gap: 6px; } #${ROOT_ID} .osa-more[data-n] { display: flex; }
#${ROOT_ID}[data-blocked="true"] .osa-coords input { opacity: .5; }
@media (max-width: 700px) { #${ROOT_ID} button, #${ROOT_ID} input:not(.osa-axis) { min-height: 40px; } #${ROOT_ID} .osa-chip { min-height: 34px; } #${ROOT_ID} input.osa-axis { width: 24px; height: 24px; } #${ROOT_ID} .osa-hint { display: none; } }
`

function injectStyles () {
  if (document.getElementById(STYLE_ID)) return
  const tag = document.createElement('style'); tag.id = STYLE_ID; tag.textContent = STYLES; document.head.appendChild(tag)
}

const v3 = (v) => [v.x, v.y, v.z]
const IDENT = new THREE.Matrix4()

export default class OmniStateStrictAlign {
  constructor (context, omniNode = null) {
    this.ctx = context
    this.omniNode = omniNode
    this._el = null
    this._settings = S.resolveSettings({})
    this._overrides = {}
    this._active = false
    this._axis = 'x'
    this._primary = null            // { id, mesh, node }
    this._extra = []                // ids that move together with the primary
    this._volumeIds = []            // the nodes of the last OmniSelector volume group
    this._gizmo = null
    this._drag = null
    this._history = []
    this._commitTimer = null; this._commitDirty = null
    this._swallowClick = false
    this._downAt = null
    this._hold = null
    this._lastShown = ''
    this._ray = new THREE.Raycaster()
    this._tmp = new THREE.Vector3()
    this._on = {}
    this._canvas = null
  }

  // ── lifecycle ───────────────────────────────────────────────────────────────

  init () {
    if (this._el) return                                           // never twice
    injectStyles()
    this._overrides = S.loadOverrides()
    this._settings = S.resolveSettings(this._overrides)
    this._build()
    const on = this._on
    on.key = (e) => this._onKey(e)
    on.set = (e) => this._handleSet(e?.detail)
    on.selected = (e) => this._onSelected(e?.detail)
    on.deselected = () => { this._primary = null; this._extra = []; if (this._active) this._refreshPanel(true) }
    on.deleted = (e) => this._onDeleted(e?.detail?.id)
    on.volume = (e) => { const ids = e?.detail?.containedIds; this._volumeIds = Array.isArray(ids) ? ids.filter(x => typeof x === 'string') : []; this._renderMore() }
    on.sel = (e) => this.setExtra(e?.detail?.ids)
    on.toggle = () => this.toggle()
    on.axis = (e) => this.setAxis(e?.detail?.axis)
    on.down = (e) => this._pointerDown(e)
    on.click = (e) => { if (this._swallowClick) { this._swallowClick = false; e.stopImmediatePropagation(); e.preventDefault(); return } this._pickClick(e) }
    on.wheel = (e) => this._wheel(e)
    on.move = (e) => this._pointerMove(e)
    on.up = (e) => this._pointerUp(e)
    on.layout = () => this._refreshPanel(true)
    window.addEventListener('keydown', on.key, true)
    window.addEventListener(S.SET_EVENT, on.set)
    window.addEventListener('omni:node-selected', on.selected)
    window.addEventListener('omni:node-deselected', on.deselected)
    window.addEventListener('omni:node-deleted', on.deleted)
    window.addEventListener('omni:selector-volume-grouped', on.volume)
    window.addEventListener('omni:strictalign-selection-set', on.sel)
    window.addEventListener('omni:strictalign-toggle', on.toggle)
    window.addEventListener('omni:strictalign-axis-set', on.axis)
    this._announceSettings()
  }

  update () {
    if (!this._active) return
    this._followGizmo()
    this._refreshPanel(false)
  }

  onResize () {}

  destroy () {
    this._exit(true)
    const on = this._on
    window.removeEventListener('keydown', on.key, true)
    window.removeEventListener(S.SET_EVENT, on.set)
    window.removeEventListener('omni:node-selected', on.selected)
    window.removeEventListener('omni:node-deselected', on.deselected)
    window.removeEventListener('omni:node-deleted', on.deleted)
    window.removeEventListener('omni:selector-volume-grouped', on.volume)
    window.removeEventListener('omni:strictalign-selection-set', on.sel)
    window.removeEventListener('omni:strictalign-toggle', on.toggle)
    window.removeEventListener('omni:strictalign-axis-set', on.axis)
    this._disposeGizmo()
    this._el?.remove(); this._el = null
    document.getElementById(STYLE_ID)?.remove()
    this._on = {}
  }

  // ── public API ──────────────────────────────────────────────────────────────

  get active () { return this._active }
  get axis () { return this._axis }
  getSettings () { return { ...this._settings } }
  getPrimaryId () { return this._primary?.id ?? null }
  getExtraIds () { return [...this._extra] }
  canMove () { return this._blockReason() === '' }
  /** '' when the selected node can be moved, else the sentence the panel shows. */
  getBlockReason () { return this._blockReason() }
  set (detail) { return this._handleSet(detail) }
  toggle () { return this._active ? this._exit() : this._enter() }
  enter () { return this._enter() }
  exit () { return this._exit() }

  setAxis (a) {
    if (!SA.isAxis(a) || a === this._axis) return false
    this._axis = a
    this._applyAxisToGizmo()
    this._refreshPanel(true)
    this._announceState()
    return true
  }

  /** Extra nodes that move together with the primary one (unknown ids are dropped; the primary itself is not repeated). */
  setExtra (ids) {
    const list = Array.isArray(ids) ? ids.filter(x => typeof x === 'string' && x !== this._primary?.id && this.omniNode?.getNodeData?.(x)) : []
    this._extra = [...new Set(list)]
    this._renderMore(); this._announceState()
    return this._extra.length
  }

  /** Move to an exact world coordinate on the chosen axis (what typing a value and pressing Enter does). Returns the coordinate reached, or null. */
  moveTo (value) {
    const v = SA.parseCoord(value); if (v === null || this._blockReason()) return null
    const items = this._snapshot(); if (!items.length) return null
    const cur = items[0].startWorld[SA.axisIndex(this._axis)]
    this._pushHistory(items)
    const d = this._applyDelta(items, SA.roundTo(SA.clampToWorld(this._axis, v), this._settings.precision) - cur)
    this._commit(true)
    this._refreshPanel(true)
    return SA.roundTo(cur + d, 6)
  }

  /** One step up (dir > 0) or down. Shift = 10 x step (or the legacy fixed Shift step), Alt = step / 10. The new coordinate is an absolute value on the step grid. */
  step (dir, shift = false, alt = false) {
    return this._stepCore(dir, shift, alt, true, true)
  }

  _stepCore (dir, shift, alt, history, force) {
    if (this._blockReason()) return null
    const items = this._snapshot(); if (!items.length) return null
    const i = SA.axisIndex(this._axis), cur = items[0].startWorld[i]
    const target = SA.roundTo(SA.nudge(cur, dir, SA.stepFor(this._settings, shift, alt)), this._settings.precision)
    if (history) this._pushHistory(items)
    const d = this._applyDelta(items, target - cur)
    this._commit(force)
    this._refreshPanel(true)
    return SA.roundTo(cur + d, 6)
  }

  /** The step distance per arrow press (the "space iterator"): validated, saved in omni:strictalign-v1. Returns the step in force. */
  setStep (v) {
    const n = S.cleanValue('step', v); if (n === undefined) return this._settings.step
    this._handleSet({ patch: { step: n } })
    return this._settings.step
  }

  /** The target node by id (the same selection every other panel follows: omni:node-select-by-id). */
  selectNode (id) {
    if (typeof id !== 'string' || !this.omniNode?.getNodeData?.(id)) return false
    window.dispatchEvent(new CustomEvent('omni:node-select-by-id', { detail: { id } }))
    return true
  }

  undo () {
    const h = this._history.pop(); if (!h) return false
    for (const it of h) {
      const entry = this.omniNode?.getMeshById?.(it.id); if (!entry) continue
      entry.position.set(it.local[0], it.local[1], it.local[2])
      const rest = entry.userData?.restPosition; if (rest?.isVector3 && it.rest) rest.set(it.rest[0], it.rest[1], it.rest[2])
      this._dispatchPos(it.id, entry)
    }
    this._syncInspector()
    this._refreshPanel(true)
    return true
  }

  // ── build ───────────────────────────────────────────────────────────────────

  _build () {
    const el = document.createElement('div')
    el.id = ROOT_ID
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'OmniState_StrictAlign: move along one axis')
    el.dataset.open = '0'
    const field = (a, i) => `<div class="osa-f" data-f="${a}"><div class="osa-flab"><label class="osa-chk" data-omni-tip="Focus ${a.toUpperCase()}" data-omni-tip-key="${i + 1} / ${a}" data-omni-tip-desc="Check ${a.toUpperCase()} to move along it. One axis at a time: checking one unchecks the others."><input type="checkbox" class="osa-axis" data-axis="${a}" aria-label="Focus the ${a.toUpperCase()} axis"><span>${a.toUpperCase()}</span></label><span class="osa-lock" aria-hidden="true"></span></div><input id="osa-${a}" class="osa-coord" data-axis="${a}" type="text" inputmode="decimal" autocomplete="off" spellcheck="false" aria-label="${a.toUpperCase()} coordinate"></div>`
    const arrow = (d) => `<button type="button" class="osa-arrow" data-dir="${d}" aria-label="${d < 0 ? 'Move in the negative direction' : 'Move in the positive direction'}" data-omni-tip="${d < 0 ? 'Move negative' : 'Move positive'}" data-omni-tip-key="Hold" data-omni-tip-desc="One step along the focused axis. Hold to repeat. Shift = 10 x step, Alt = step / 10.">${d < 0 ? '◀ −' : '+ ▶'}</button>`
    el.innerHTML = `
      <div class="osa-head"><span class="osa-title" data-omni-tip="OmniState_StrictAlign" data-omni-tip-key="\`" data-omni-tip-desc="Move any node along ONE axis with exact coordinates. Click a node to switch target. Esc or \` leaves the mode.">OmniState_StrictAlign</span><span class="osa-node"></span><button type="button" class="osa-close" aria-label="Close StrictAlign" data-omni-tip="Close StrictAlign" data-omni-tip-key="Esc" data-omni-tip-desc="Leaves the mode (the \` key does the same).">×</button></div>
      <div class="osa-coords">${field('x', 0)}${field('y', 1)}${field('z', 2)}</div>
      <div class="osa-move">${arrow(-1)}<label class="osa-steplab" for="osa-step">Step</label><input id="osa-step" class="osa-step" type="text" inputmode="decimal" autocomplete="off" spellcheck="false" aria-label="Step distance per arrow press" data-omni-tip="Step (space iterator)" data-omni-tip-key="Enter" data-omni-tip-desc="How far one arrow press moves the node, in world units. Saved for next time.">${arrow(1)}<span class="osa-chips" role="group" aria-label="Step presets">${S.STEP_PRESETS.map(v => `<button type="button" class="osa-chip" data-step="${v}" aria-pressed="false" data-omni-tip="Step ${v}" data-omni-tip-key="—" data-omni-tip-desc="Set the step to ${v}.">${v}</button>`).join('')}</span></div>
      <div class="osa-more"><span class="osa-more-t"></span><button type="button" class="osa-more-use" hidden data-omni-tip="Include the grouped nodes" data-omni-tip-key="—" data-omni-tip-desc="Moves the nodes grouped by the selector volume together with the target."></button><button type="button" class="osa-more-clear" hidden data-omni-tip="Clear the together set" data-omni-tip-key="—" data-omni-tip-desc="Only the target node moves again.">Clear</button></div>
      <div class="osa-msg" role="status" aria-live="polite"></div>
      <div class="osa-hint">Click any node to switch · check one axis · drag the line, press the arrows (hold = repeat) or type a value + Enter · Shift = 10 x step, Alt = step / 10 · Ctrl+Z undo · Esc or \` leaves</div>`
    this._el = el
    el.querySelector('.osa-close').addEventListener('click', () => this._exit())
    el.querySelectorAll('input.osa-axis').forEach(b => b.addEventListener('change', () => { if (b.checked) this.setAxis(b.dataset.axis); else this._refreshPanel(true) /* the last checkmark cannot be removed */ }))
    el.querySelectorAll('.osa-arrow').forEach(b => this._bindArrow(b))
    el.querySelectorAll('.osa-chip').forEach(b => b.addEventListener('click', () => this.setStep(Number(b.dataset.step))))
    const st = el.querySelector('.osa-step')
    st.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); this._commitStepField() } else if (e.key === 'Escape') { e.preventDefault(); st.classList.remove('is-bad'); st.value = SA.formatCoord(this._settings.step, 6); st.blur() } })
    st.addEventListener('input', () => st.classList.remove('is-bad'))
    st.addEventListener('blur', () => this._commitStepField(true))
    el.querySelector('.osa-more-clear').addEventListener('click', () => { this.setExtra([]) })
    el.querySelector('.osa-more-use').addEventListener('click', () => { this.setExtra(this._volumeIds) })
    el.querySelectorAll('.osa-f input.osa-coord').forEach(inp => {
      inp.addEventListener('keydown', (e) => this._fieldKey(e, inp))
      inp.addEventListener('input', () => inp.classList.remove('is-bad'))
      inp.addEventListener('blur', () => { inp.classList.remove('is-bad'); this._refreshPanel(true) })
    })
    ;(document.getElementById('omni-ui') ?? document.body).appendChild(el)
  }

  // ── gizmo (axis line + arrows + a fat invisible hit tube) ───────────────────

  _ensureGizmo () {
    if (this._gizmo) return this._gizmo
    const mat = (o = {}) => new THREE.MeshBasicMaterial({ depthTest: false, depthWrite: false, transparent: true, ...o })
    const g = new THREE.Group(); g.name = 'OmniState_StrictAlign gizmo'; g.renderOrder = 999
    const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-LEN, 0, 0), new THREE.Vector3(LEN, 0, 0)])
    const lineMat = new THREE.LineBasicMaterial({ depthTest: false, depthWrite: false, transparent: true, opacity: 0.95 })
    const line = new THREE.Line(lineGeo, lineMat); line.renderOrder = 999
    const coneGeo = new THREE.ConeGeometry(0.16, 0.5, 12)
    const coneMat = mat({ opacity: 0.95 })
    const c1 = new THREE.Mesh(coneGeo, coneMat); c1.rotation.z = -Math.PI / 2; c1.position.x = LEN; c1.renderOrder = 999
    const c2 = new THREE.Mesh(coneGeo, coneMat); c2.rotation.z = Math.PI / 2; c2.position.x = -LEN; c2.renderOrder = 999
    const hitGeo = new THREE.CylinderGeometry(0.3, 0.3, LEN * 2 + 0.5, 8)
    const hit = new THREE.Mesh(hitGeo, mat({ opacity: 0 })); hit.rotation.z = Math.PI / 2; hit.renderOrder = 998
    g.add(line, c1, c2, hit)
    g.userData.strictAlign = true
    this._gizmo = { group: g, line, lineMat, coneMat, hit, geos: [lineGeo, coneGeo, hitGeo], mats: [lineMat, coneMat, hit.material] }
    this._applyAxisToGizmo()
    return this._gizmo
  }

  _applyAxisToGizmo () {
    const gz = this._gizmo; if (!gz) return
    const col = SA.AXIS_COLORS[this._axis]
    gz.lineMat.color.set(col); gz.coneMat.color.set(col)
    gz.group.rotation.set(0, 0, 0)
    if (this._axis === 'y') gz.group.rotation.z = Math.PI / 2
    else if (this._axis === 'z') gz.group.rotation.y = -Math.PI / 2
    gz.line.visible = !!this._settings.showAxisLine
    this._el?.style.setProperty('--osa-axis', col)
  }

  _followGizmo () {
    const gz = this._gizmo, p = this._primary
    if (!gz) return
    const show = !!(this._active && p?.mesh && !this._blockReason())
    gz.group.visible = show
    if (!show) return
    p.mesh.getWorldPosition(this._tmp)
    gz.group.position.copy(this._tmp)
    const cam = this.ctx?.camera
    const dist = cam ? cam.position.distanceTo(this._tmp) : 20
    const k = Math.min(60, Math.max(0.3, dist * 0.06))
    gz.group.scale.setScalar(k)
    gz.group.updateMatrixWorld(true)
  }

  _disposeGizmo () {
    const gz = this._gizmo; if (!gz) return
    gz.group.parent?.remove(gz.group)
    gz.geos.forEach(g => g.dispose()); gz.mats.forEach(m => m.dispose())
    this._gizmo = null
  }

  // ── enter / exit ────────────────────────────────────────────────────────────

  _enter () {
    if (this._active || !this._el) return false
    this._active = true
    if (!this._primary) {                                          // pick up a selection made before the mode was entered
      const id = this.omniNode?._selected
      const mesh = id ? this.omniNode?.getMeshById?.(id) : null
      if (id && mesh) this._primary = { id, mesh, node: this.omniNode.getNodeData(id) }
    }
    const gz = this._ensureGizmo()
    this.ctx?.scene?.add(gz.group)
    this._canvas = this.ctx?.renderer?.domElement ?? null
    if (this._canvas) {
      this._canvas.addEventListener('pointerdown', this._on.down, true)
      this._canvas.addEventListener('click', this._on.click, true)
      this._canvas.addEventListener('wheel', this._on.wheel, { capture: true, passive: false })
    }
    this._el.dataset.open = '1'
    this._lastShown = ''
    this._followGizmo()
    this._refreshPanel(true)
    this._announceState()
    return true
  }

  _exit (silent = false) {
    if (!this._active) return false
    this._endDrag(true)
    this._holdStop()
    this._flushCommit()
    this._active = false
    const gz = this._gizmo; if (gz) gz.group.parent?.remove(gz.group)
    if (this._canvas) {
      this._canvas.removeEventListener('pointerdown', this._on.down, true)
      this._canvas.removeEventListener('click', this._on.click, true)
      this._canvas.removeEventListener('wheel', this._on.wheel, { capture: true })
    }
    this._canvas = null
    if (this._el) this._el.dataset.open = '0'
    if (!silent) this._announceState()
    return true
  }

  // ── selection ───────────────────────────────────────────────────────────────

  _onSelected (d) {
    const id = d?.node?.id ?? d?.mesh?.userData?.nodeId ?? null
    if (!id || !d?.mesh) { this._primary = null; if (this._active) this._refreshPanel(true); return }
    this._primary = { id, mesh: d.mesh, node: d.node ?? null }
    this._extra = this._extra.filter(x => x !== id)
    if (this._active) { this._followGizmo(); this._refreshPanel(true); this._announceState() }
  }

  _onDeleted (id) {
    if (!id) return
    if (this._primary?.id === id) this._primary = null
    this._extra = this._extra.filter(x => x !== id)
    if (this._active) this._refreshPanel(true)
  }

  _facts () {
    const p = this._primary
    const data = p ? this.omniNode?.getNodeData?.(p.id) : null
    const mesh = p ? (this.omniNode?.getMeshById?.(p.id) ?? null) : null
    return {
      selected: !!p,
      tracking: !!p?.mesh?.userData?.omniTrackingId,
      inRegistry: !!data && !!mesh,
      locked: !!mesh?.userData?.behaviorLocked,
      structural: !!data?.skipAutoSelect,
      inScene: !!mesh && (!!mesh.parent || mesh === this.ctx?.scene),
    }
  }

  _blockReason () { return SA.moveBlockReason(this._facts()) }

  // ── moving ──────────────────────────────────────────────────────────────────

  /** Movable targets: the primary node + the "moves together" ones. A node whose ancestor is also a target is skipped (it moves with it). */
  _targets () {
    const out = []
    const add = (id) => {
      const data = this.omniNode?.getNodeData?.(id), mesh = this.omniNode?.getMeshById?.(id)
      if (!data || !mesh || mesh.userData?.behaviorLocked || data.skipAutoSelect || !mesh.parent) return
      out.push({ id, mesh })
    }
    if (this._primary) add(this._primary.id)
    for (const id of this._extra) add(id)
    const meshes = new Set(out.map(t => t.mesh))
    return out.filter(t => { for (let a = t.mesh.parent; a; a = a.parent) if (meshes.has(a)) return false; return true })
  }

  _snapshot () {
    return this._targets().map(t => {
      t.mesh.parent?.updateWorldMatrix?.(true, false); t.mesh.updateWorldMatrix(true, false)
      const w = t.mesh.getWorldPosition(new THREE.Vector3())
      const rest = t.mesh.userData?.restPosition
      return { ...t, startWorld: v3(w), startLocal: v3(t.mesh.position), startRest: rest?.isVector3 ? v3(rest) : null }
    })
  }

  /** Shift every item by delta along the chosen axis (clamped as a group); the mesh moves now, the event follows (throttled). Returns the delta used. */
  _applyDelta (items, delta) {
    const axis = this._axis
    const d = SA.clampDelta(items.map(it => it.startWorld), axis, delta)
    const moved = SA.applyDelta(items.map(it => it.startWorld), axis, d)
    const ai = SA.axisIndex(axis)
    if (moved[0]) moved[0][ai] = SA.roundTo(moved[0][ai], this._settings.precision)   // the primary node lands EXACTLY on the rounded value (absolute set, not a sum of deltas)
    items.forEach((it, k) => {
      const w = new THREE.Vector3(moved[k][0], moved[k][1], moved[k][2])
      const local = this._toLocal(it.mesh, w)
      it.mesh.position.copy(local)
      const rest = it.mesh.userData?.restPosition
      if (rest?.isVector3 && it.startRest) rest.set(it.startRest[0] + (local.x - it.startLocal[0]), it.startRest[1] + (local.y - it.startLocal[1]), it.startRest[2] + (local.z - it.startLocal[2]))
      it.mesh.updateMatrixWorld(true)
    })
    this._commitDirty = items.map(it => ({ id: it.id, mesh: it.mesh }))
    return d
  }

  /** World -> the mesh's parent space. A parent whose world matrix is the identity (the scene) keeps the numbers untouched (no matrix noise). */
  _toLocal (mesh, w) {
    const p = mesh.parent; if (!p) return w
    p.updateWorldMatrix?.(true, false)
    if (p === this.ctx?.scene || p.matrixWorld.equals(IDENT)) return w
    return p.worldToLocal(w)
  }

  /** A floor panel node's grid fields (gx, gz, ox, oz) follow its new position, so its own data and the position agree (snap / rotate / move later start from here). */
  _syncFloorPanel (id, mesh) {
    const d = this.omniNode?.getNodeData?.(id)
    if (!Extra.isFloorPanelData(d) || !Number.isFinite(d.cellSize) || !(d.cellSize > 0)) return
    const cs = d.cellSize, lim = 64
    const gx = Math.max(-lim, Math.min(lim, Math.round(mesh.position.x / cs - 0.5))), gz = Math.max(-lim, Math.min(lim, Math.round(mesh.position.z / cs - 0.5)))
    d.gx = gx; d.gz = gz
    d.ox = SA.cleanNumber(Math.max(-cs / 2, Math.min(cs / 2, mesh.position.x - (gx + 0.5) * cs)))
    d.oz = SA.cleanNumber(Math.max(-cs / 2, Math.min(cs / 2, mesh.position.z - (gz + 0.5) * cs)))
    window.dispatchEvent(new CustomEvent('omni:floorpanel-changed', { detail: { id } }))
  }

  _dispatchPos (id, mesh) {
    this._syncFloorPanel(id, mesh)
    window.dispatchEvent(new CustomEvent('omni:node-pos-set', { detail: { id, position: [SA.cleanNumber(mesh.position.x), SA.cleanNumber(mesh.position.y), SA.cleanNumber(mesh.position.z)] } }))
  }

  /** Send `omni:node-pos-set` for what moved: now (force) or at most every COMMIT_MS. */
  _commit (force) {
    if (force) { clearTimeout(this._commitTimer); this._commitTimer = null; this._flushCommit(); return }
    if (this._commitTimer) return
    this._commitTimer = setTimeout(() => { this._commitTimer = null; this._flushCommit() }, COMMIT_MS)
  }

  _flushCommit () {
    clearTimeout(this._commitTimer); this._commitTimer = null
    const list = this._commitDirty; this._commitDirty = null
    if (!list?.length) return
    for (const it of list) this._dispatchPos(it.id, it.mesh)
    this._syncInspector()
  }

  /** The Inspector's Location fields (#oi-px / #oi-py / #oi-pz and their sliders) follow the primary node. */
  _syncInspector () {
    const m = this._primary?.mesh; if (!m || typeof document === 'undefined') return
    for (const [a, v] of [['x', m.position.x], ['y', m.position.y], ['z', m.position.z]]) {
      for (const id of [`oi-p${a}`, `oi-p${a}-slider`]) {
        const el = document.getElementById(id)
        if (el && document.activeElement !== el) el.value = String(SA.cleanNumber(v))
      }
    }
  }

  _pushHistory (items) {
    this._history.push(items.map(it => ({ id: it.id, local: it.startLocal, rest: it.startRest })))
    if (this._history.length > HISTORY_MAX) this._history.shift()
  }

  // ── pointer: drag along the axis ────────────────────────────────────────────

  _ndc (e) {
    const r = this._canvas.getBoundingClientRect()
    return new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
  }

  _rayAt (e) {
    this._ray.setFromCamera(this._ndc(e), this.ctx.camera)
    return this._ray.ray
  }

  _hitsHandle (e) {
    const p = this._primary, gz = this._gizmo
    if (!p?.mesh || !gz) return false
    this._ray.setFromCamera(this._ndc(e), this.ctx.camera)
    gz.group.updateMatrixWorld(true)
    const list = [gz.hit]; if (p.mesh.isMesh || p.mesh.isSprite) list.push(p.mesh)
    return this._ray.intersectObjects(list, false).length > 0
  }

  _pointerDown (e) {
    this._downAt = e.button > 0 ? null : { x: e.clientX, y: e.clientY }
    if (!this._active || e.button > 0 || this._drag || this._blockReason() || !this._canvas) return
    this._swallowClick = false
    if (!this._hitsHandle(e)) return
    const items = this._snapshot(); if (!items.length) return
    const ray = this._rayAt(e)
    const hit = SA.projectRayOnAxis(v3(ray.origin), v3(ray.direction), items[0].startWorld, this._axis)
    if (!hit) return
    e.stopImmediatePropagation(); e.preventDefault()
    this._swallowClick = true
    this._pushHistory(items)
    this._drag = { items, startRayCoord: hit.coord, startCoord: items[0].startWorld[SA.axisIndex(this._axis)], id: e.pointerId, moved: false }
    window.dispatchEvent(new CustomEvent('omni:orbit-disable', { detail: {} }))
    window.addEventListener('pointermove', this._on.move)
    window.addEventListener('pointerup', this._on.up)
    window.addEventListener('pointercancel', this._on.up)
  }

  _pointerMove (e) {
    const d = this._drag; if (!d || (d.id !== undefined && e.pointerId !== undefined && e.pointerId !== d.id)) return
    const ray = this._rayAt(e)
    const hit = SA.projectRayOnAxis(v3(ray.origin), v3(ray.direction), d.items[0].startWorld, this._axis)
    if (!hit) return
    const coord = SA.dragCoord({ startCoord: d.startCoord, startRayCoord: d.startRayCoord, nowRayCoord: hit.coord, step: this._settings.step, snap: this._settings.snapDrag, axis: this._axis, precision: this._settings.precision })
    d.moved = true
    this._applyDelta(d.items, coord - d.startCoord)
    this._commit(false)
  }

  _pointerUp () { this._endDrag(false) }

  _endDrag (silent) {
    const d = this._drag; if (!d) return
    this._drag = null
    window.removeEventListener('pointermove', this._on.move)
    window.removeEventListener('pointerup', this._on.up)
    window.removeEventListener('pointercancel', this._on.up)
    if (!d.moved) this._history.pop()                              // a press without movement is not an edit
    this._flushCommit()
    window.dispatchEvent(new CustomEvent('omni:orbit-enable', { detail: {} }))
    if (!silent) this._refreshPanel(true)
  }

  /** A plain click on the canvas while the mode is on: the node under the pointer becomes the target (any registry node). Drags (orbit) are ignored. */
  _pickClick (e) {
    if (!this._active || !this._canvas || !this.omniNode) return
    const d = this._downAt; this._downAt = null
    if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) > CLICK_SLOP_PX) return
    const list = (this.omniNode.getAllMeshes?.() ?? []).filter(m => m && !this.omniNode.getNodeData?.(m.userData?.nodeId)?.skipAutoSelect)
    let id = null
    if (list.length) {
      this._ray.setFromCamera(this._ndc(e), this.ctx.camera)
      this.ctx.scene?.updateMatrixWorld?.(true)
      const hit = this._ray.intersectObjects(list, false)[0]
      id = hit?.object?.userData?.nodeId ?? null
    }
    if (id) {
      e.stopImmediatePropagation(); e.preventDefault()               // the node's own modes (path / place) must not also act on this click
      if (id !== this._primary?.id) { this.selectNode(id); this._msg('') }
      return
    }
    if (this.omniNode._mode && this.omniNode._mode !== 'select') { e.stopImmediatePropagation(); e.preventDefault() }   // empty space in place / path mode must not place or connect anything
  }

  _wheel (e) {
    if (!this._active || this._blockReason() || !this._canvas || !e.deltaY) return
    if (!this._hitsHandle(e)) return                               // away from the node / line the wheel zooms as usual
    e.preventDefault(); e.stopImmediatePropagation()
    this.step(e.deltaY < 0 ? 1 : -1, e.shiftKey, e.altKey)
  }

  // ── keyboard ────────────────────────────────────────────────────────────────

  _onKey (e) {
    if (isExpressionOn()) return                    // V195: Expression typing owns every key while it is on
    const typing = SA.isTypingTarget(e.target) || SA.isTypingTarget(typeof document !== 'undefined' ? document.activeElement : null)
    const isBackquote = (e.code === 'Backquote' || e.key === '`') && !e.ctrlKey && !e.metaKey && !e.altKey && !(e.shiftKey && e.key === '~')
    if (isBackquote) {
      if (typing) return
      e.preventDefault(); e.stopImmediatePropagation()
      this.toggle()
      return
    }
    if (!this._active || typing) return
    const stop = () => { e.preventDefault(); e.stopImmediatePropagation() }
    if (e.key === 'Escape') { stop(); this._exit(); return }
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && (e.key === 'z' || e.key === 'Z')) { stop(); this.undo(); return }
    const ax = SA.axisFromKey(e)
    if (ax) { stop(); this.setAxis(ax); return }
    if (e.ctrlKey || e.metaKey || e.altKey) return
    const dir = { ArrowUp: 1, ArrowRight: 1, PageUp: 1, ArrowDown: -1, ArrowLeft: -1, PageDown: -1 }[e.key]
    if (dir) { stop(); this.step(dir, e.shiftKey); return }
    if (e.key === 'Enter') { stop(); const f = this._el?.querySelector(`.osa-f input.osa-coord[data-axis="${this._axis}"]`); f?.focus(); f?.select?.() }
  }

  _fieldKey (e, inp) {
    e.stopPropagation()
    if (e.key === 'Escape') { e.preventDefault(); inp.blur(); this._exit(); return }
    if (inp.readOnly) { if (e.key === 'Tab') return; return }
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); this.step(e.key === 'ArrowUp' ? 1 : -1, e.shiftKey, e.altKey); return }
    if (e.key !== 'Enter') return
    e.preventDefault()
    const v = SA.parseCoord(inp.value)
    if (v === null) { inp.classList.add('is-bad'); this._msg('Type a number, for example 12.5', true); return }
    const clamped = SA.roundTo(SA.clampToWorld(this._axis, v), this._settings.precision)
    const got = this.moveTo(v)
    if (got === null) { this._msg(this._blockReason() || 'Nothing to move.', true); return }
    inp.classList.remove('is-bad')
    const edge = SA.clampToWorld(this._axis, v) !== v
    this._msg(edge ? `Limited to the edge of the world: ${SA.formatCoord(clamped, this._settings.precision)}` : '', edge)
    if (this._settings.closeAfterEnter) this._exit()
  }

  // ── panel ───────────────────────────────────────────────────────────────────

  _msg (text, warn = false) {
    const m = this._el?.querySelector('.osa-msg'); if (!m) return
    m.textContent = text; m.classList.toggle('is-warn', !!warn)
  }

  _renderMore () {
    const box = this._el?.querySelector('.osa-more'); if (!box) return
    const n = this._extra.length, vol = this._volumeIds.filter(x => x !== this._primary?.id).length
    if (!n && !vol) { box.removeAttribute('data-n'); return }
    box.setAttribute('data-n', String(n))
    box.querySelector('.osa-more-t').textContent = n ? `Moves together with ${n} more node${n === 1 ? '' : 's'}` : ''
    const use = box.querySelector('.osa-more-use'); use.hidden = !(vol && n !== vol); use.textContent = `Include the ${vol} grouped by the selector volume`
    box.querySelector('.osa-more-clear').hidden = !n
  }

  /** Fill the panel from the selected node (cheap: skipped while nothing changed, unless force). */
  _refreshPanel (force) {
    const el = this._el; if (!el || !this._active) return
    const reason = this._blockReason()
    const p = this._primary
    let pos = null
    if (p?.mesh && !reason) { p.mesh.getWorldPosition(this._tmp); pos = v3(this._tmp) }
    const dec = this._settings.precision
    const key = `${reason}|${p?.id ?? ''}|${this._axis}|${pos ? pos.map(x => SA.formatCoord(x, dec)).join(',') : ''}|${this._extra.length}|${this._settings.step}|${dec}`
    if (!force && key === this._lastShown) return
    this._lastShown = key
    el.dataset.blocked = String(!!reason)
    el.querySelector('.osa-node').textContent = p ? `${p.node?.label ?? p.mesh?.userData?.label ?? ''} · ${p.id}` : 'no node selected'
    el.querySelectorAll('input.osa-axis').forEach(b => { b.checked = b.dataset.axis === this._axis; b.setAttribute('aria-checked', String(b.checked)) })
    const stepInp = el.querySelector('.osa-step'); if (stepInp && document.activeElement !== stepInp) { stepInp.value = SA.formatCoord(this._settings.step, 6); stepInp.classList.remove('is-bad') }
    el.querySelectorAll('.osa-chip').forEach(c => c.setAttribute('aria-pressed', String(Number(c.dataset.step) === this._settings.step)))
    const ax = this._axis.toUpperCase(), st = SA.formatCoord(this._settings.step, 6)
    el.querySelectorAll('.osa-arrow').forEach(b => { const neg = b.dataset.dir === '-1'; b.setAttribute('data-omni-tip', `${neg ? '−' : '+'}${st} on ${ax}`); b.disabled = !!reason })
    el.querySelectorAll('.osa-f').forEach(f => {
      const a = f.dataset.f, inp = f.querySelector('input.osa-coord'), act = a === this._axis
      f.dataset.active = String(act)
      inp.readOnly = !act || !!reason
      inp.tabIndex = act && !reason ? 0 : -1
      f.querySelector('.osa-lock').textContent = act ? '' : '🔒'
      if (document.activeElement !== inp || inp.readOnly) inp.value = pos ? SA.formatCoord(pos[SA.axisIndex(a)], dec) : ''
      inp.setAttribute('aria-label', `${a.toUpperCase()} coordinate${act ? '' : ' (locked)'}`)
    })
    if (reason) this._msg(reason, !!p)
    else if (!el.querySelector('.osa-msg').classList.contains('is-warn')) this._msg('')
    this._renderMore()
  }

  // ── settings + events ───────────────────────────────────────────────────────

  _handleSet (detail) {
    if (!this._el) return false
    const { overrides, changed } = S.applyChange(this._overrides, detail)
    if (!changed) return false
    this._overrides = overrides
    S.saveOverrides(overrides)
    this._settings = S.resolveSettings(overrides)
    this._applyAxisToGizmo()
    this._announceSettings()
    this._refreshPanel(true)
    return true
  }

  // ── arrow buttons (hold to repeat) + the step field ─────────────────────────

  _bindArrow (b) {
    const dir = Number(b.dataset.dir)
    b.addEventListener('pointerdown', (e) => {
      if (e.button > 0 || b.disabled) return
      e.preventDefault()
      this._holdStart(dir, e.shiftKey, e.altKey)
    })
    for (const t of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(t, () => this._holdStop())
    b.addEventListener('contextmenu', (e) => e.preventDefault())
    b.addEventListener('click', (e) => { if (e.detail === 0 && !b.disabled) this.step(dir, e.shiftKey, e.altKey) })   // keyboard Enter / Space on the focused button (a pointer press already stepped)
  }

  _holdStart (dir, shift, alt) {
    this._holdStop()
    if (this._blockReason()) { this._msg(this._blockReason(), true); return }
    const items = this._snapshot(); if (!items.length) return
    this._pushHistory(items)                                        // one undo for the whole press / hold
    this._stepCore(dir, shift, alt, false, true)
    const h = this._hold = { dir, shift, alt, timer: null, n: 1 }
    const tick = () => {
      if (this._hold !== h) return
      if (this._stepCore(dir, shift, alt, false, false) === null) { this._holdStop(); return }
      h.n++; h.timer = setTimeout(tick, HOLD_REPEAT_MS)
    }
    h.timer = setTimeout(tick, HOLD_DELAY_MS)
  }

  _holdStop () {
    const h = this._hold; if (!h) return
    clearTimeout(h.timer); this._hold = null
    this._flushCommit(); this._refreshPanel(true)
  }

  _commitStepField (quiet = false) {
    const inp = this._el?.querySelector('.osa-step'); if (!inp) return
    const v = SA.parseCoord(inp.value)
    const ok = v !== null ? S.cleanValue('step', v) : undefined
    if (ok === undefined) {
      if (quiet) { inp.classList.remove('is-bad'); inp.value = SA.formatCoord(this._settings.step, 6); return }
      inp.classList.add('is-bad'); this._msg(`The step must be a number from ${S.STEP_MIN} to ${S.STEP_MAX}`, true); return
    }
    inp.classList.remove('is-bad')
    this._handleSet({ patch: { step: ok } })
    inp.value = SA.formatCoord(this._settings.step, 6)
  }

  _announceSettings () {
    window.dispatchEvent(new CustomEvent(S.CHANGED_EVENT, { detail: { kind: 'settings', settings: this.getSettings() } }))
  }

  _announceState () {
    window.dispatchEvent(new CustomEvent(S.CHANGED_EVENT, { detail: { kind: 'state', state: S.STATE_NAME, active: this._active, axis: this._axis, ids: [this._primary?.id, ...this._extra].filter(Boolean), settings: this.getSettings() } }))
  }
}
