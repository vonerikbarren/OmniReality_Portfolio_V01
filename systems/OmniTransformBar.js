/**
 * systems/OmniTransformBar.js (V267) — a small DOM bar that follows the selected node(s) so you can move, rotate or scale ANY node with exact numbers.
 *   Move / Rotate / Scale tabs · X Y Z boxes (type a number, or use − / +) · step · World / Local (for the rotate ± buttons) · "Keep shape" (scale lock, ON by default: change one
 *   scale box and all three grow by the same ratio, so no odd shapes) · Reset (back to how the node was when the bar picked it) · Undo · Pin (docks at the bottom) · collapse · close.
 *   Targets: the selected node, or, while Select / Connect is active, its origin + picked nodes (moved / rotated as a group about their centre; scale multiplies each node's own scale).
 *   Locked nodes (tracking / structural: behaviorLocked, skipAutoSelect) are refused and the bar says so.  Changes go through the app's own events (omni:node-pos-set / -rotation-set / -scale-set), so they save.
 *   SERVICES.transform: open() close() toggle() isOpen() setMode(m) setPrefs(p) prefs() set(mode, axis, value) nudge(mode, axis, dir) undo() reset() state()
 *   Events in: omni:transform-bar-request { action: open|close|toggle|undo|reset }.   Model: utils/OmniTransformModel.js.
 */
import * as THREE from 'three'
import { SERVICES } from '../utils/OmniExtraKinds.js'
import * as TM from '../utils/OmniTransformModel.js'
import * as SA from '../utils/StrictAlign.js'

const send = (n, d) => { try { window.dispatchEvent(new CustomEvent(n, { detail: d })) } catch (_) { /* no window */ } }
const STORE = 'omni.transformbar.v1', AX = ['x', 'y', 'z'], DEG = 180 / Math.PI
const STYLES = `
.otb { position: fixed; z-index: 10030; left: 0; top: 0; width: 262px; max-width: 96vw; padding: 6px 8px; background: rgba(14,18,28,.95); color: #eaf1ff; border: 1px solid rgba(154,208,255,.5); border-radius: 10px; font: 11px system-ui, sans-serif; box-shadow: 0 4px 18px rgba(0,0,0,.45); touch-action: manipulation; }
.otb.otb-docked { left: 50% !important; top: auto !important; bottom: calc(var(--omni-dock-stack-h, 52px) + 8px); transform: translateX(-50%); }
.otb-row { display: flex; gap: 4px; align-items: center; margin: 3px 0; flex-wrap: wrap; }
.otb button, .otb select, .otb input { font: inherit; color: inherit; background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.22); border-radius: 6px; padding: 3px 6px; min-height: 26px; }
.otb button { cursor: pointer; } .otb button:hover { background: rgba(154,208,255,.25); }
.otb .otb-on { background: rgba(120,220,160,.3); border-color: rgba(120,220,160,.8); }
.otb-ax { display: flex; align-items: center; gap: 2px; flex: 1 1 0; }
.otb-ax b { width: 12px; text-align: center; } .otb-ax input { width: 100%; min-width: 0; text-align: right; }
.otb-ax button { padding: 3px 5px; }
.otb-msg { font-size: 10px; opacity: .8; min-height: 12px; } .otb label { display: flex; align-items: center; gap: 4px; }
.otb input[type=checkbox] { min-height: 0; width: 15px; height: 15px; }
.otb.otb-min .otb-body { display: none; }
@media (pointer: coarse) { .otb button, .otb select, .otb input { min-height: 40px; } .otb input[type=checkbox] { width: 24px; height: 24px; } .otb { width: min(96vw, 340px); } }
`
export default class OmniTransformBar {
  constructor (context, omniNode = null) { this.ctx = context; this.omniNode = omniNode ?? context?.omniNode ?? null; this._el = null; this._open = false; this._prefs = TM.sanitizeTransformPrefs(null); this._undo = []; this._origin = new Map(); this._key = ''; this._bound = []; this._inited = false; this._refreshAt = 0; this._tmp = new THREE.Vector3(); this._lastXY = ''; this._loadPrefs() }
  init () {
    if (this._inited) return; this._inited = true
    const on = (n, fn) => { const h = (e) => fn(e.detail ?? {}, e); window.addEventListener(n, h); this._bound.push([n, h]) }
    on('omni:transform-bar-request', (d) => { try { this.request(d) } catch (err) { this._say(String(err?.message ?? err)) } })
    on('omni:scene-clear-request', () => { this._undo = []; this._origin.clear(); this._key = '' })
    on('omni:node-deleted', () => { this._key = '' })
    SERVICES.transform = this
  }
  destroy () { this.close(); for (const [n, h] of this._bound) window.removeEventListener(n, h); this._bound = []; if (SERVICES.transform === this) SERVICES.transform = null; this._inited = false }
  onResize () {}
  request (d) { switch (d.action) { case 'open': return this.open(); case 'close': return this.close(); case 'undo': return this.undo(); case 'reset': return this.reset(); default: return this.toggle() } }

  // ── prefs ──
  _loadPrefs () { try { this._prefs = TM.sanitizeTransformPrefs(JSON.parse(localStorage.getItem(STORE) || 'null')) } catch (_) { this._prefs = TM.sanitizeTransformPrefs(null) } }
  _savePrefs () { try { localStorage.setItem(STORE, JSON.stringify(this._prefs)) } catch (_) { /* storage off */ } }
  prefs () { return { ...this._prefs } }
  setPrefs (p) { this._prefs = TM.sanitizeTransformPrefs({ ...this._prefs, ...(p || {}) }); this._savePrefs(); this._render(); return this.prefs() }
  setMode (m) { return this.setPrefs({ mode: m }).mode }
  isOpen () { return this._open }
  state () { return { open: this._open, ...this._prefs, targets: this._targets().map(t => t.id), undo: this._undo.length } }

  // ── targets ──
  _ids () {
    const sm = SERVICES.selectmode?.state?.()
    if (sm?.origin) return [sm.origin, ...sm.members.filter(m => m !== sm.origin)]
    const s = this.omniNode?.getSelectedId?.(); return s ? [s] : []
  }
  _refused () { return this._ids().filter(id => { const m = this.omniNode?.getMeshById?.(id), d = this.omniNode?.getNodeData?.(id); return !m || !d || m.userData?.behaviorLocked || d.skipAutoSelect || !m.parent }) }
  _targets () {
    const out = []
    for (const id of this._ids()) { const mesh = this.omniNode?.getMeshById?.(id), data = this.omniNode?.getNodeData?.(id); if (!mesh || !data || mesh.userData?.behaviorLocked || data.skipAutoSelect || !mesh.parent) continue; out.push({ id, mesh }) }
    return this._prefs.group ? out : out.slice(0, 1)
  }
  _snap (t) { const r = t.mesh.userData?.restPosition; return { id: t.id, pos: [t.mesh.position.x, t.mesh.position.y, t.mesh.position.z], q: [t.mesh.quaternion.x, t.mesh.quaternion.y, t.mesh.quaternion.z, t.mesh.quaternion.w], rot: [t.mesh.rotation.x, t.mesh.rotation.y, t.mesh.rotation.z], scale: [t.mesh.scale.x, t.mesh.scale.y, t.mesh.scale.z], rest: r?.isVector3 ? [r.x, r.y, r.z] : null } }
  _restore (s) {
    const mesh = this.omniNode?.getMeshById?.(s.id); if (!mesh) return false
    mesh.position.set(...s.pos); mesh.rotation.set(...s.rot); mesh.scale.set(...s.scale)
    const r = mesh.userData?.restPosition; if (s.rest && r?.isVector3) r.set(...s.rest)
    mesh.updateMatrixWorld(true); return true
  }
  _commit (ids) {
    for (const id of ids) {
      const m = this.omniNode?.getMeshById?.(id); if (!m) continue
      send('omni:node-pos-set', { id, position: [SA.cleanNumber(m.position.x), SA.cleanNumber(m.position.y), SA.cleanNumber(m.position.z)] })
      send('omni:node-rotation-set', { id, rotation: [SA.cleanNumber(m.rotation.x), SA.cleanNumber(m.rotation.y), SA.cleanNumber(m.rotation.z)] })
      send('omni:node-scale-set', { id, scale: [m.scale.x, m.scale.y, m.scale.z] })
    }
  }
  _syncTargets () {
    const key = this._ids().join('|'); if (key === this._key) return
    this._key = key; this._origin = new Map(this._targets().map(t => [t.id, this._snap(t)])); this._refreshAt = 0
  }

  // ── editing ──
  _begin () { const ts = this._targets(); if (!ts.length) { this._say(this._ids().length ? 'This node is locked (tracking / structural), so it cannot be moved here.' : 'Select a node first.'); return null } this._syncTargets(); return ts }
  _push (ts) { this._undo = TM.pushUndo(this._undo, ts.map(t => this._snap(t))) }
  /** absolute set of one axis box in `mode` for the primary node (the group follows by the same change) */
  set (mode, axis, value) {
    const i = SA.axisIndex(axis); const v = Number(value); if (i < 0 || !Number.isFinite(v)) { this._say('Type a number.'); return false }
    const ts = this._begin(); if (!ts) return false
    this._push(ts)
    const p = ts[0].mesh
    if (mode === 'move') {
      const delta = SA.clampToWorld(axis, v) - p.position.getComponent(i)
      for (const t of ts) { const nv = SA.clampToWorld(axis, t.mesh.position.getComponent(i) + delta); const d = nv - t.mesh.position.getComponent(i); t.mesh.position.setComponent(i, SA.cleanNumber(nv)); const r = t.mesh.userData?.restPosition; if (r?.isVector3) r.setComponent(i, r.getComponent(i) + d) }
    } else if (mode === 'rotate') {
      const rad = v / DEG, delta = rad - p.rotation[axis]
      if (ts.length > 1) { const c = TM.centreOf(ts.map(t => [t.mesh.position.x, t.mesh.position.y, t.mesh.position.z])); for (const t of ts) { const q = TM.rotateAbout([t.mesh.position.x, t.mesh.position.y, t.mesh.position.z], c, axis, delta); t.mesh.position.set(...q) } }
      for (const t of ts) t.mesh.rotation[axis] = t === ts[0] ? rad : t.mesh.rotation[axis] + delta
    } else {
      const next = TM.scaleWithLock([p.scale.x, p.scale.y, p.scale.z], axis, v, this._prefs.uniform)
      const ratio = [0, 1, 2].map(k => next[k] / (p.scale.getComponent(k) || 1))
      for (const t of ts) { const cur = [t.mesh.scale.x, t.mesh.scale.y, t.mesh.scale.z]; const out = t === ts[0] ? next : TM.clampScale(cur.map((x, k) => x * ratio[k])); t.mesh.scale.set(...out) }
    }
    for (const t of ts) t.mesh.updateMatrixWorld(true)
    this._commit(ts.map(t => t.id)); this._say(''); this._render(true); return true
  }
  nudge (mode, axis, dir) {
    const i = SA.axisIndex(axis); const d = dir < 0 ? -1 : 1; const step = this._prefs.step; const ts = this._begin(); if (!ts || i < 0) return false
    const p = ts[0].mesh
    if (mode === 'move') return this.set('move', axis, SA.cleanNumber(p.position.getComponent(i) + d * step))
    if (mode === 'scale') return this.set('scale', axis, SA.cleanNumber(p.scale.getComponent(i) + d * step * 0.1))
    if (this._prefs.space === 'local' || ts.length > 1) return this.set('rotate', axis, SA.cleanNumber(p.rotation[axis] * DEG + d * step))
    this._push(ts)   // world space, one node: turn about the world axis whatever its current spin
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(...SA.axisVector(axis)), d * step / DEG); p.quaternion.premultiply(q); p.updateMatrixWorld(true)
    this._commit([ts[0].id]); this._render(true); return true
  }
  undo () { const s = this._undo.pop(); if (!s) { this._say('Nothing to undo.'); return false } const ids = []; for (const x of s) if (this._restore(x)) ids.push(x.id); this._commit(ids); this._say('Undone.'); this._render(true); return true }
  reset () {
    const ts = this._begin(); if (!ts) return false; this._push(ts); const ids = []
    for (const t of ts) { const o = this._origin.get(t.id); if (o && this._restore(o)) ids.push(t.id) }
    this._commit(ids); this._say(ids.length ? 'Back to how they were when picked.' : 'Nothing to reset.'); this._render(true); return ids.length > 0
  }

  // ── bar ──
  open () { if (this._open) return true; this._open = true; this._build(); this._syncTargets(); this._render(true); return true }
  close () { this._open = false; this._el?.remove(); this._el = null; this._key = '' }
  toggle () { return this._open ? (this.close(), false) : this.open() }
  _say (t) { this._msg = t; const m = this._el?.querySelector('.otb-msg'); if (m) m.textContent = t || '' }
  _build () {
    if (!document.getElementById('otb-style')) { const s = document.createElement('style'); s.id = 'otb-style'; s.textContent = STYLES; document.head.appendChild(s) }
    const el = document.createElement('div'); el.className = 'otb'; el.setAttribute('role', 'toolbar'); el.setAttribute('aria-label', 'Transform bar')
    el.innerHTML = `<div class="otb-row"><b style="color:#9ad0ff">Transform</b><span style="flex:1"></span><button data-k="min" title="Collapse">▁</button><button data-k="pin" title="Dock at the bottom">📌</button><button data-k="close" title="Close">✕</button></div>
<div class="otb-body"><div class="otb-row" data-r="modes">${TM.MODES.map(m => `<button data-mode="${m}">${m[0].toUpperCase() + m.slice(1)}</button>`).join('')}<select data-k="space" title="World: rotate buttons turn about the world axes. Local: change the node's own angle."><option value="world">World</option><option value="local">Local</option></select></div>
<div class="otb-row" data-r="axes">${AX.map(a => `<div class="otb-ax"><b style="color:${SA.AXIS_COLORS[a]}">${a.toUpperCase()}</b><button data-n="${a}-" aria-label="${a} minus">−</button><input data-a="${a}" inputmode="decimal" aria-label="${a} value"><button data-n="${a}+" aria-label="${a} plus">+</button></div>`).join('')}</div>
<div class="otb-row"><label title="On: change one scale box and all three change together, so the shape is kept."><input type="checkbox" data-k="uniform"> Keep shape (scale all 3)</label></div>
<div class="otb-row"><label>Step <input data-k="step" style="width:56px" inputmode="decimal"></label><label title="Move the whole selection together"><input type="checkbox" data-k="group"> Group</label></div>
<div class="otb-row"><button data-k="reset">Reset</button><button data-k="undo">Undo</button></div></div><div class="otb-msg" aria-live="polite"></div>`
    el.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return
      if (b.dataset.mode) return void this.setMode(b.dataset.mode)
      if (b.dataset.n) return void this.nudge(this._prefs.mode, b.dataset.n[0], b.dataset.n[1] === '-' ? -1 : 1)
      switch (b.dataset.k) { case 'close': return this.close(); case 'min': return void this.setPrefs({ collapsed: !this._prefs.collapsed }); case 'pin': return void this.setPrefs({ pinned: !this._prefs.pinned }); case 'reset': return void this.reset(); case 'undo': return void this.undo() }
    })
    el.addEventListener('change', (e) => {
      const t = e.target
      if (t.dataset.a) { const v = SA.parseCoord(t.value); if (v === null) { this._say('Type a number.'); this._render(true) } else this.set(this._prefs.mode, t.dataset.a, this._prefs.mode === 'rotate' ? v : v) }
      else if (t.dataset.k === 'uniform') this.setPrefs({ uniform: t.checked })
      else if (t.dataset.k === 'group') this.setPrefs({ group: t.checked })
      else if (t.dataset.k === 'space') this.setPrefs({ space: t.value })
      else if (t.dataset.k === 'step') { const v = SA.parseCoord(t.value); this.setPrefs({ step: v && v > 0 ? v : 1 }) }
    })
    el.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter' && e.target.dataset?.a) e.target.blur(); else if (e.key === 'Escape') this.close() })
    document.body.appendChild(el); this._el = el
  }
  _render (values) {
    const el = this._el; if (!el) return; const p = this._prefs
    el.classList.toggle('otb-min', p.collapsed); el.classList.toggle('otb-docked', p.pinned || (window.matchMedia?.('(pointer: coarse)').matches ?? false))
    el.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('otb-on', b.dataset.mode === p.mode))
    el.querySelector('[data-k="pin"]').classList.toggle('otb-on', p.pinned)
    const set = (k, f) => { const n = el.querySelector(`[data-k="${k}"]`); if (n && document.activeElement !== n) f(n) }
    set('uniform', n => { n.checked = p.uniform; n.parentElement.style.opacity = p.mode === 'scale' ? 1 : .5 }); set('group', n => { n.checked = p.group }); set('space', n => { n.value = p.space }); set('step', n => { n.value = String(p.step) })
    if (values) this._values()
    this._say(this._msg || '')
  }
  _values () {
    const el = this._el; if (!el) return; const ts = this._targets(); const m = ts[0]?.mesh
    el.querySelectorAll('input[data-a]').forEach(inp => {
      if (document.activeElement === inp) return
      if (!m) { inp.value = ''; inp.disabled = true; return } inp.disabled = false
      const a = inp.dataset.a, i = SA.axisIndex(a), mode = this._prefs.mode
      inp.value = SA.formatCoord(mode === 'move' ? m.position.getComponent(i) : mode === 'rotate' ? m.rotation[a] * DEG : m.scale.getComponent(i), 4)
    })
  }
  update () {
    if (!this._open || !this._el) return
    this._syncTargets()
    const now = performance.now(); if (now - this._refreshAt > 150) { this._refreshAt = now; this._values(); if (!this._ids().length && !this._msg) this._say('Select a node.') }
    if (this._el.classList.contains('otb-docked')) return
    const m = this._targets()[0]?.mesh ?? this.omniNode?.getMeshById?.(this._ids()[0]); const cam = this.ctx?.camera; if (!m || !cam) return
    m.getWorldPosition(this._tmp); this._tmp.project(cam)
    if (this._tmp.z > 1) { this._el.style.display = 'none'; return } this._el.style.display = ''
    const w = this._el.offsetWidth || 262, h = this._el.offsetHeight || 140
    const x = Math.round(Math.min(window.innerWidth - w - 4, Math.max(4, (this._tmp.x * .5 + .5) * window.innerWidth - w / 2)))
    const y = Math.round(Math.min(window.innerHeight - h - 4, Math.max(4, (-this._tmp.y * .5 + .5) * window.innerHeight + 46)))
    const k = x + ',' + y; if (k !== this._lastXY) { this._lastXY = k; this._el.style.left = x + 'px'; this._el.style.top = y + 'px' }
  }
}
