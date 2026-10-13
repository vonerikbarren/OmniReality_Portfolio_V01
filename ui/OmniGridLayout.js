/**
 * ui/OmniGridLayout.js (V195) — a reusable MultiTimer-style GRID ORGANIZER.
 *
 * Components sit on a snap grid (cols x rows cells, default 24 x 14). In EDIT mode you drag a component (pointer or touch), resize it
 * with the corner handle, send it ▲ to the front / ▼ to the back (components may overlap and stack), hide it (✕) and add hidden ones back
 * from the "+ Add" list; arrow keys move the focused component (Shift+arrows resize, PageUp / PageDown stack, Delete hides). In PLAY mode
 * the components just work (the edit layer is off). Layout = versioned JSON, sanitized on load, kept in localStorage 'omni:dj-layout-v1'.
 * The maths is pure (utils/OmniGridMath.js). DOM only (no canvas, no WebGL). Positions are percentages of the grid, so the layout scales
 * with its host; below a minimum size the host scrolls instead of squeezing the controls.
 *
 *   const layout = new OmniGridLayout({ components: [{ id, title, x, y, w, h, minW, minH, create(slotEl, { id, layout, feel }) -> { destroy() } }], onChange })
 *   layout.mount(host)  ...  layout.destroy()
 *   layout.setEdit(true) setSnap(false) reset() hide(id) show(id) bringToFront(id) sendToBack(id) raise(id) lower(id) moveBy(id, dx, dy) resizeBy(id, dw, dh)
 *
 * CLICK FEELING (createClickFeel): a very short tick (WebAudio blip, optional setting) and navigator.vibrate(8) where supported, called by
 * the controls on press of buttons and on detents; plus a CSS press-depth animation (.ogl-press).
 */

import * as GM from '../utils/OmniGridMath.js'

export const STORAGE_KEY = 'omni:dj-layout-v1'
const SAVE_DELAY = 200
export const tip = (name, desc, key = '—') => `data-omni-tip="${escAttr(name)}" data-omni-tip-key="${escAttr(key)}" data-omni-tip-desc="${escAttr(desc)}"`
export function escAttr (v) { return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])) }

/** The tick + buzz. getContext() should return an already RUNNING AudioContext (it never creates one: no sound without a gesture). */
export function createClickFeel (opts = {}) {
  const st = { sound: opts.sound === true, haptic: opts.haptic !== false }
  let last = 0
  const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())
  function blip (kind) {
    const c = typeof opts.getContext === 'function' ? opts.getContext() : null
    if (!c || c.state !== 'running') return false
    const o = c.createOscillator(); const g = c.createGain(); const t = c.currentTime
    o.type = 'sine'; o.frequency.value = kind === 'detent' ? 2600 : 1700
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(kind === 'detent' ? 0.03 : 0.06, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.014)
    o.connect(g); g.connect(c.destination); o.onended = () => { try { o.disconnect(); g.disconnect() } catch (_) { /* ignore */ } }
    o.start(t); o.stop(t + 0.025); return true
  }
  return {
    get state () { return { ...st } },
    set (key, v) { if (key === 'sound' || key === 'haptic') st[key] = !!v },
    /** kind: 'press' (button) or 'detent' (a knob passing a notch). Throttled to one per 25 ms. */
    tick (kind = 'press') {
      const t = nowMs(); if (t - last < 25) return false; last = t
      if (st.haptic) { try { if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(kind === 'detent' ? 5 : 8) } catch (_) { /* ignore */ } }
      if (st.sound) { try { blip(kind) } catch (_) { /* ignore */ } }
      return true
    },
  }
}

const STYLES = `
.ogl { display: flex; flex-direction: column; width: 100%; height: 100%; min-height: 0; color: var(--omni-theme-text, #e8f4ff); font-family: 'Courier New', Courier, monospace; box-sizing: border-box; }
.ogl *, .ogl *::before, .ogl *::after { box-sizing: border-box; }
.ogl-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; padding: 3px 4px; flex: 0 0 auto; border-bottom: 1px solid var(--omni-theme-border, rgba(255,255,255,.14)); }
.ogl-bar .ogl-sp { flex: 1 1 4px; }
.ogl-btn { font: inherit; font-size: 11px; line-height: 1; min-height: 24px; min-width: 24px; padding: 0 7px; color: inherit; cursor: pointer; background: rgba(255,255,255,.06); border: 1px solid var(--omni-theme-border, rgba(255,255,255,.2)); border-radius: 5px; transition: transform .06s ease, background .12s ease, box-shadow .06s ease; }
.ogl-btn:hover { background: rgba(255,255,255,.12); }
.ogl-btn[aria-pressed="true"], .ogl-btn.is-on { background: var(--omni-theme-accent, #5ce8c4); color: #04121a; border-color: transparent; }
.ogl-btn:focus-visible, .ogl-edit:focus-visible { outline: 2px solid var(--omni-theme-accent, #5ce8c4); outline-offset: 1px; }
.ogl-press:active, .ogl-btn:active { transform: translateY(1px) scale(.96); box-shadow: inset 0 2px 4px rgba(0,0,0,.45); }
@keyframes ogl-pressed { 0% { transform: scale(1); } 40% { transform: scale(.94); } 100% { transform: scale(1); } }
.ogl-pulse { animation: ogl-pressed .14s ease-out; }
.ogl-add { font: inherit; font-size: 11px; min-height: 24px; color: inherit; background: rgba(255,255,255,.06); border: 1px solid var(--omni-theme-border, rgba(255,255,255,.2)); border-radius: 5px; max-width: 150px; }
.ogl-add option { color: #111; }
.ogl-scroll { flex: 1 1 auto; min-height: 0; overflow: auto; position: relative; touch-action: pan-x pan-y; }
.ogl-grid { position: relative; width: 100%; height: 100%; min-width: var(--ogl-min-w, 640px); min-height: var(--ogl-min-h, 300px); }
.ogl-editing .ogl-grid { background-image: linear-gradient(to right, rgba(255,255,255,.09) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,.09) 1px, transparent 1px); background-size: calc(100% / var(--ogl-cols)) calc(100% / var(--ogl-rows)); }
.ogl-item { position: absolute; min-width: 0; min-height: 0; }
.ogl-item[hidden] { display: none; }
.ogl-content { position: absolute; inset: 0; overflow: hidden; container-type: size; }
.ogl-editing .ogl-content { pointer-events: none; opacity: .72; }
.ogl-edit { display: none; position: absolute; inset: 0; border: 1px dashed var(--omni-theme-accent, #5ce8c4); border-radius: 4px; background: rgba(92,232,196,.07); cursor: grab; touch-action: none; user-select: none; -webkit-user-select: none; }
.ogl-editing .ogl-edit { display: block; }
.ogl-edit.is-selected { border-style: solid; background: rgba(92,232,196,.16); }
.ogl-edit.is-dragging { cursor: grabbing; }
.ogl-title { position: absolute; left: 3px; top: 1px; max-width: calc(100% - 6px); font-size: 9px; line-height: 1.1; opacity: .9; pointer-events: none; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-shadow: 0 0 3px #000; }
.ogl-ebtns { position: absolute; right: 2px; top: 2px; display: flex; gap: 2px; }
.ogl-ebtns button { font: inherit; font-size: 10px; line-height: 1; width: 18px; height: 18px; padding: 0; cursor: pointer; color: inherit; background: rgba(0,0,0,.55); border: 1px solid rgba(255,255,255,.3); border-radius: 3px; }
.ogl-ebtns button:hover { background: rgba(255,255,255,.25); }
.ogl-rz { position: absolute; right: 0; bottom: 0; width: 16px; height: 16px; cursor: nwse-resize; background: linear-gradient(135deg, transparent 50%, var(--omni-theme-accent, #5ce8c4) 50%); border-radius: 0 0 4px 0; touch-action: none; }
@media (prefers-reduced-motion: reduce) { .ogl-btn, .ogl-pulse { transition: none; animation: none; } }
`
let stylesIn = false
function injectStyles () {
  if (stylesIn || typeof document === 'undefined') return
  if (document.getElementById('omni-grid-layout-styles')) { stylesIn = true; return }
  const s = document.createElement('style'); s.id = 'omni-grid-layout-styles'; s.textContent = STYLES; (document.head || document.documentElement).appendChild(s); stylesIn = true
}

const safeGet = (k) => { try { return localStorage.getItem(k) } catch (_) { return null } }
const safeSet = (k, v) => { try { localStorage.setItem(k, v); return true } catch (_) { return false } }

export default class OmniGridLayout {
  /**
   * opts: { cols=24, rows=14, components:[{id,title,x,y,w,h,minW,minH,z,hidden,create}], storageKey=STORAGE_KEY (null = no storage),
   *         feel (createClickFeel result), onChange(why, state), toolbar(barEl) (add your own buttons), minWidth, minHeight }
   */
  constructor (opts = {}) {
    this.opts = opts
    this.grid = GM.sanitizeGrid(opts)
    this.comps = (Array.isArray(opts.components) ? opts.components : []).filter(c => c && typeof c.id === 'string' && typeof c.create === 'function')
    this.specs = this.comps.map(c => ({ id: c.id, x: c.x, y: c.y, w: c.w, h: c.h, z: c.z, minW: c.minW, minH: c.minH, hidden: c.hidden }))
    this.storageKey = opts.storageKey === undefined ? STORAGE_KEY : opts.storageKey
    this.feel = opts.feel || createClickFeel()
    this.state = this._load()
    this.feel.set('sound', this.state.click.sound); this.feel.set('haptic', this.state.click.haptic)
    this.edit = false
    this.selected = null
    this._items = new Map()
    this._host = null; this._root = null; this._gridEl = null; this._ui = {}
    this._saveT = null; this._resetT = null; this._drag = null
    this._destroyed = false
  }

  _load () {
    const raw = this.storageKey ? safeGet(this.storageKey) : null
    return GM.parseLayout(raw, this.specs, this.grid)
  }
  _min (id) { const s = this.specs.find(x => x.id === id); return GM.specMin(s) }

  // ── mount ───────────────────────────────────────────────────────────────────────────────────────────────────────────
  mount (host) {
    if (!host || this._root) return this
    injectStyles()
    this._host = host
    const root = document.createElement('div'); root.className = 'ogl'
    root.style.setProperty('--ogl-cols', String(this.grid.cols)); root.style.setProperty('--ogl-rows', String(this.grid.rows))
    if (this.opts.minWidth) root.style.setProperty('--ogl-min-w', this.opts.minWidth + 'px')
    if (this.opts.minHeight) root.style.setProperty('--ogl-min-h', this.opts.minHeight + 'px')
    root.innerHTML = `
      <div class="ogl-bar" role="toolbar" aria-label="Layout">
        <button type="button" class="ogl-btn" data-a="edit" aria-pressed="false" ${tip('Edit layout', 'Switch between PLAY (the controls work) and EDIT (drag, resize, stack, hide and add components on the grid).', '—')}>Edit</button>
        <button type="button" class="ogl-btn" data-a="snap" aria-pressed="true" ${tip('Snap to grid', 'Edit mode: components snap to whole grid cells. Off = free placement in small steps.', '—')}>Snap</button>
        <select class="ogl-add" data-a="add" aria-label="Add a hidden component" hidden ${tip('Add component', 'Brings back a component you hid with the cross.', '—')}></select>
        <button type="button" class="ogl-btn" data-a="reset" hidden ${tip('Reset layout', 'Puts every component back where it started (press twice).', '—')}>Reset layout</button>
        <span class="ogl-sp"></span>
        <span class="ogl-extra" data-r="extra" style="display:contents"></span>
      </div>
      <div class="ogl-scroll"><div class="ogl-grid" role="group" aria-label="Components"></div></div>`
    this._root = root; this._gridEl = root.querySelector('.ogl-grid')
    this._ui = { edit: root.querySelector('[data-a="edit"]'), snap: root.querySelector('[data-a="snap"]'), add: root.querySelector('[data-a="add"]'), reset: root.querySelector('[data-a="reset"]'), extra: root.querySelector('[data-r="extra"]') }
    root.querySelector('.ogl-bar').addEventListener('click', (e) => this._barClick(e))
    this._ui.add.addEventListener('change', () => { const id = this._ui.add.value; if (id) this.show(id); this._ui.add.value = '' })
    for (const c of this.comps) this._buildItem(c)
    host.appendChild(root)
    if (typeof this.opts.toolbar === 'function') { try { this.opts.toolbar(this._ui.extra, this) } catch (err) { console.warn('OmniGridLayout toolbar:', err) } }
    this._syncBar()
    return this
  }

  _buildItem (c) {
    const el = document.createElement('div'); el.className = 'ogl-item'; el.dataset.id = c.id
    const content = document.createElement('div'); content.className = 'ogl-content'
    const ed = document.createElement('div'); ed.className = 'ogl-edit'; ed.tabIndex = 0; ed.setAttribute('role', 'group'); ed.dataset.id = c.id
    ed.setAttribute('aria-label', `${c.title || c.id}. Edit mode: drag to move, arrow keys move, Shift plus arrows resize, Page Up and Page Down stack, Delete hides.`)
    ed.innerHTML = `<span class="ogl-title"></span><span class="ogl-ebtns"><button type="button" data-a="front" aria-label="Bring to front" ${tip('Bring to front', 'Stack this component on top of the others.', 'PgUp')}>▲</button><button type="button" data-a="back" aria-label="Send to back" ${tip('Send to back', 'Stack this component below the others.', 'PgDn')}>▼</button><button type="button" data-a="hide" aria-label="Hide" ${tip('Hide component', 'Removes it from the layout. Bring it back with + Add.', 'Del')}>✕</button></span><span class="ogl-rz" data-a="resize" aria-hidden="true"></span>`
    ed.querySelector('.ogl-title').textContent = c.title || c.id
    el.appendChild(content); el.appendChild(ed)
    this._gridEl.appendChild(el)
    let comp = null
    try { comp = c.create(content, { id: c.id, layout: this, feel: this.feel }) } catch (err) { console.warn('OmniGridLayout component', c.id, err) }
    const it = { spec: c, el, content, ed, comp }
    this._items.set(c.id, it)
    ed.addEventListener('pointerdown', (e) => this._down(e, c.id))
    ed.addEventListener('pointermove', (e) => this._move(e))
    ed.addEventListener('pointerup', (e) => this._up(e))
    ed.addEventListener('pointercancel', (e) => this._up(e))
    ed.addEventListener('keydown', (e) => this._key(e, c.id))
    ed.addEventListener('focus', () => this.select(c.id))
    ed.addEventListener('click', (e) => { const b = e.target.closest('button[data-a]'); if (!b) return; e.stopPropagation(); this.feel.tick('press'); this._edAction(c.id, b.dataset.a) })
    this._applyRect(c.id)
  }

  _edAction (id, a) {
    if (a === 'front') this.bringToFront(id)
    else if (a === 'back') this.sendToBack(id)
    else if (a === 'hide') this.hide(id)
  }

  // ── toolbar ─────────────────────────────────────────────────────────────────────────────────────────────────────────
  _barClick (e) {
    const b = e.target.closest('button[data-a]'); if (!b) return
    this.feel.tick('press')
    const a = b.dataset.a
    if (a === 'edit') this.setEdit(!this.edit)
    else if (a === 'snap') this.setSnap(!this.state.snap)
    else if (a === 'reset') this._resetPress()
  }
  _resetPress () {
    const b = this._ui.reset; if (!b) return
    if (this._resetT) { clearTimeout(this._resetT); this._resetT = null; b.textContent = 'Reset layout'; this.reset(); return }
    b.textContent = 'Sure? Reset'
    this._resetT = setTimeout(() => { this._resetT = null; b.textContent = 'Reset layout' }, 2500)
  }
  _syncBar () {
    if (!this._root) return
    this._root.classList.toggle('ogl-editing', this.edit)
    const u = this._ui
    u.edit.setAttribute('aria-pressed', String(this.edit)); u.edit.textContent = this.edit ? 'Done' : 'Edit'
    u.snap.setAttribute('aria-pressed', String(this.state.snap))
    u.snap.hidden = !this.edit; u.reset.hidden = !this.edit
    const hid = this.hiddenIds()
    u.add.hidden = !this.edit || hid.length === 0
    const label = (id) => this.comps.find(c => c.id === id)?.title || id
    u.add.innerHTML = '<option value="">+ Add…</option>' + hid.map(id => `<option value="${escAttr(id)}">${escAttr(label(id))}</option>`).join('')
  }

  // ── public API ──────────────────────────────────────────────────────────────────────────────────────────────────────
  setEdit (on) {
    this.edit = !!on
    if (!this.edit) { this.selected = null; this._drag = null }
    this._syncBar(); this._syncSelection()
    this._emit('edit'); return this.edit
  }
  setSnap (on) {
    this.state.snap = !!on
    if (on) { for (const id of Object.keys(this.state.items)) this.state.items[id] = { ...this.state.items[id], ...GM.clampRect(this.state.items[id], this.grid, this._min(id), true) }; this._applyAll() }
    this._syncBar(); this._changed('snap'); return this.state.snap
  }
  setClick (key, on) { if (key !== 'sound' && key !== 'haptic') return; this.state.click[key] = !!on; this.feel.set(key, !!on); this._changed('click') }
  reset () {
    const keep = { sound: this.state.click.sound, haptic: this.state.click.haptic }
    this.state = GM.defaultLayout(this.specs, this.grid); this.state.click = keep
    this._applyAll(); this._syncBar(); this._changed('reset')
  }
  hiddenIds () { return this.comps.filter(c => this.state.items[c.id]?.hidden).map(c => c.id) }
  hide (id) { const r = this.state.items[id]; if (!r || r.hidden) return false; r.hidden = true; if (this.selected === id) this.selected = null; this._applyRect(id); this._syncBar(); this._changed('hide'); return true }
  show (id) {
    const r = this.state.items[id]; if (!r || !r.hidden) return false
    r.hidden = false; this._zset(GM.bringToFront(this._zmap(), id)); this._applyRect(id); this._syncBar(); this._changed('show'); return true
  }
  bringToFront (id) { return this._zop(id, GM.bringToFront) }
  sendToBack (id) { return this._zop(id, GM.sendToBack) }
  raise (id) { return this._zop(id, GM.raiseOne) }
  lower (id) { return this._zop(id, GM.lowerOne) }
  _zmap () { const z = {}; for (const id of Object.keys(this.state.items)) z[id] = this.state.items[id].z; return z }
  _zset (zs) { for (const id of Object.keys(zs)) if (this.state.items[id]) { this.state.items[id].z = zs[id]; this._applyRect(id) } }
  _zop (id, fn) { if (!this.state.items[id]) return false; this._zset(fn(this._zmap(), id)); this._changed('z'); return true }
  getRect (id) { const r = this.state.items[id]; return r ? { x: r.x, y: r.y, w: r.w, h: r.h, z: r.z, hidden: !!r.hidden } : null }
  getState () { return JSON.parse(GM.serializeLayout(this.state)) }
  /** Replace the layout with any (hostile or old) JSON; it is sanitized. */
  setLayout (input) { this.state = GM.parseLayout(input, this.specs, this.grid); this.feel.set('sound', this.state.click.sound); this.feel.set('haptic', this.state.click.haptic); this._applyAll(); this._syncBar(); this._changed('set') }
  moveBy (id, dx, dy) { const r = this.state.items[id]; if (!r) return null; const n = GM.moveRect(r, dx, dy, this.grid, this._min(id), this.state.snap); Object.assign(r, n); this._applyRect(id); this._changed('move'); return n }
  resizeBy (id, dw, dh) { const r = this.state.items[id]; if (!r) return null; const n = GM.resizeRect(r, dw, dh, this.grid, this._min(id), this.state.snap); Object.assign(r, n); this._applyRect(id); this._changed('resize'); return n }
  select (id) { this.selected = id; this._syncSelection() }
  element (id) { return this._items.get(id)?.el ?? null }
  component (id) { return this._items.get(id)?.comp ?? null }
  get root () { return this._root }

  // ── dom sync ────────────────────────────────────────────────────────────────────────────────────────────────────────
  _applyRect (id, rect) {
    const it = this._items.get(id); const r = rect || this.state.items[id]; if (!it || !r) return
    const p = GM.rectToPercent(r, this.grid); const s = it.el.style
    s.left = p.left + '%'; s.top = p.top + '%'; s.width = p.width + '%'; s.height = p.height + '%'; s.zIndex = String(Math.round(r.z))
    const h = !!this.state.items[id]?.hidden
    if (h) it.el.setAttribute('hidden', ''); else it.el.removeAttribute('hidden')
  }
  _applyAll () { for (const id of this._items.keys()) this._applyRect(id) }
  _syncSelection () { for (const [id, it] of this._items) it.ed.classList.toggle('is-selected', this.edit && this.selected === id) }

  // ── drag / resize ───────────────────────────────────────────────────────────────────────────────────────────────────
  _cell () {
    const r = this._gridEl.getBoundingClientRect()
    return { w: (r.width > 0 ? r.width : 30 * this.grid.cols) / this.grid.cols, h: (r.height > 0 ? r.height : 30 * this.grid.rows) / this.grid.rows }
  }
  _down (e, id) {
    if (!this.edit || (e.button != null && e.button > 0)) return
    if (e.target.closest && e.target.closest('.ogl-ebtns')) return
    const it = this._items.get(id); const r = this.state.items[id]; if (!it || !r) return
    const mode = e.target.closest && e.target.closest('.ogl-rz') ? 'resize' : 'move'
    this._drag = { id, mode, sx: e.clientX, sy: e.clientY, r0: { x: r.x, y: r.y, w: r.w, h: r.h }, pid: e.pointerId, cell: this._cell(), moved: false }
    try { it.ed.setPointerCapture && it.ed.setPointerCapture(e.pointerId) } catch (_) { /* ignore */ }
    it.ed.classList.add('is-dragging'); this.select(id)
    try { e.preventDefault() } catch (_) { /* ignore */ }
  }
  _move (e) {
    const d = this._drag; if (!d || (d.pid != null && e.pointerId != null && e.pointerId !== d.pid)) return
    const dx = GM.pxToCells(e.clientX - d.sx, d.cell.w); const dy = GM.pxToCells(e.clientY - d.sy, d.cell.h)
    if (Math.abs(dx) + Math.abs(dy) > 0.001) d.moved = true
    const min = this._min(d.id); const snap = this.state.snap
    const n = d.mode === 'resize' ? GM.resizeRect(d.r0, dx, dy, this.grid, min, snap) : GM.moveRect(d.r0, dx, dy, this.grid, min, snap)
    Object.assign(this.state.items[d.id], n); this._applyRect(d.id)
  }
  _up (e) {
    const d = this._drag; if (!d || (d.pid != null && e && e.pointerId != null && e.pointerId !== d.pid)) return
    this._drag = null
    const it = this._items.get(d.id); if (it) { it.ed.classList.remove('is-dragging'); try { it.ed.releasePointerCapture && it.ed.releasePointerCapture(d.pid) } catch (_) { /* ignore */ } }
    if (d.moved) this._changed(d.mode)
  }
  _key (e, id) {
    if (!this.edit) return
    const step = this.state.snap ? 1 : 0.25; let used = true
    switch (e.key) {
      case 'ArrowLeft': e.shiftKey ? this.resizeBy(id, -step, 0) : this.moveBy(id, -step, 0); break
      case 'ArrowRight': e.shiftKey ? this.resizeBy(id, step, 0) : this.moveBy(id, step, 0); break
      case 'ArrowUp': e.shiftKey ? this.resizeBy(id, 0, -step) : this.moveBy(id, 0, -step); break
      case 'ArrowDown': e.shiftKey ? this.resizeBy(id, 0, step) : this.moveBy(id, 0, step); break
      case 'PageUp': this.raise(id); break
      case 'PageDown': this.lower(id); break
      case 'Home': this.bringToFront(id); break
      case 'End': this.sendToBack(id); break
      case 'Delete': case 'Backspace': this.hide(id); break
      default: used = false
    }
    if (used) { e.preventDefault(); e.stopPropagation(); this.feel.tick('detent') }
  }

  // ── persistence ─────────────────────────────────────────────────────────────────────────────────────────────────────
  _emit (why) { if (typeof this.opts.onChange === 'function') { try { this.opts.onChange(why, this.state) } catch (_) { /* ignore */ } } }
  _changed (why) { this._queueSave(); this._emit(why) }
  _queueSave () { if (!this.storageKey) return; if (this._saveT) clearTimeout(this._saveT); this._saveT = setTimeout(() => this.flush(), SAVE_DELAY) }
  flush () { if (this._saveT) { clearTimeout(this._saveT); this._saveT = null } if (this.storageKey) safeSet(this.storageKey, GM.serializeLayout(this.state)) }

  destroy () {
    if (this._destroyed) return
    this._destroyed = true
    if (this._saveT) this.flush()
    if (this._resetT) clearTimeout(this._resetT)
    for (const it of this._items.values()) { try { it.comp && it.comp.destroy && it.comp.destroy() } catch (_) { /* ignore */ } }
    this._items.clear()
    if (this._root && this._root.parentNode) this._root.parentNode.removeChild(this._root)
    this._root = null; this._gridEl = null; this._host = null; this._drag = null
  }
}
export { OmniGridLayout }
