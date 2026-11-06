/**
 * systems/OmniSelectMode.js (V265) — select, then connect. From a node's tooltip menu: "Select / Connect". That node becomes the ORIGIN and a small bar appears
 * (ui-less: built here, DOM only). Click other nodes to pick them (a ring shows each pick, a thin preview line runs to the origin). The bar's options:
 *   Connect      join everything picked so far to the origin (or chained, see Pattern) and keep joining: every node you click next gets a real line
 *   Pattern      star (every line starts at the origin) · chain (each pick joins the one before it)
 *   Clear        forget the picks (the lines already drawn stay)         Delete   delete the picked nodes (asks first)        Done / Esc   leave
 * The picks and rings are an overlay and are never saved; the lines drawn by Connect are ordinary lines (OmniNode.connectNodes), saved with the scene.
 *   SERVICES.selectmode: start(id) pick(id) connect() setPattern(p) clear() remove() done() state() isActive()      Events in: omni:select-mode-request { action, id, pattern }
 *   Out: omni:select-mode-changed { active, state }.  Model: utils/OmniSelectModel.js.
 */
import * as THREE from 'three'
import { SERVICES } from '../utils/OmniExtraKinds.js'
import * as SM from '../utils/OmniSelectModel.js'
import * as LM from '../utils/OmniLineModel.js'

const send = (n, d) => { try { window.dispatchEvent(new CustomEvent(n, { detail: d })) } catch (_) { /* no window */ } }
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const STYLES = `
.osm-bar { position: fixed; top: calc(var(--omni-top-offset, 48px) + 38px); left: 50%; transform: translateX(-50%); z-index: 10040; display: flex; flex-wrap: wrap; gap: 6px; align-items: center; max-width: min(96vw, 760px); padding: 6px 10px; background: var(--omni-theme-bg, rgba(14,18,28,.95)); color: var(--omni-theme-text, #eaf1ff); border: 1px solid var(--omni-theme-border, rgba(154,208,255,.55)); border-radius: 10px; font: 11px var(--omni-theme-font, system-ui, sans-serif); box-shadow: 0 4px 18px rgba(0,0,0,.45); }
.osm-bar b { color: var(--omni-theme-accent, #9ad0ff); }
.osm-bar button, .osm-bar select { font: inherit; color: inherit; background: var(--omni-theme-input-bg, rgba(255,255,255,.08)); border: 1px solid var(--omni-theme-input-border, rgba(255,255,255,.22)); border-radius: 6px; padding: 5px 9px; min-height: 30px; cursor: pointer; }
.osm-bar button:hover:not(:disabled) { color-mix(in srgb, var(--omni-theme-accent, #9ad0ff) 28%, transparent); }
.osm-bar button:disabled { opacity: .4; cursor: default; }
.osm-bar .osm-on { background: color-mix(in srgb, var(--omni-theme-accent, #78dca0) 35%, transparent); border-color: var(--omni-theme-accent, #78dca0); }
.osm-bar .osm-danger { border-color: rgba(255,120,120,.6); }
.osm-msg { flex: 1 1 100%; font-size: 10.5px; opacity: .8; }
@media (pointer: coarse) { .osm-bar button, .osm-bar select { min-height: 44px; } }
`
export default class OmniSelectMode {
  constructor (context, omniNode = null) { this.ctx = context; this.omniNode = omniNode ?? context?.omniNode ?? null; this._s = null; this._bar = null; this._rings = new Map(); this._lines = new Map(); this._group = null; this._bound = []; this._inited = false; this._msg = ''; this._meaning = 'link' }
  init () {
    if (this._inited) return; this._inited = true
    const on = (n, fn) => { const h = (e) => fn(e.detail ?? {}, e); window.addEventListener(n, h); this._bound.push([n, h]) }
    on('omni:select-mode-request', (d) => { try { this.request(d) } catch (err) { this._say(String(err?.message ?? err)) } })
    on('omni:node-selected', (d) => { if (this._s && d.node?.id) this.pick(d.node.id) })
    on('omni:node-deleted', (d) => { if (!this._s) return; if (d.id === this._s.origin) this.done(); else { this._s = SM.sanitizeSelection({ ...this._s, members: this._s.members.filter(m => m !== d.id) }); this._sync() } })
    on('omni:scene-clear-request', () => this.done())
    this._esc = (e) => { if (this._s && e.key === 'Escape') this.done() }; document.addEventListener('keydown', this._esc)
    SERVICES.selectmode = this
  }
  destroy () { this.done(); try { document.removeEventListener('keydown', this._esc) } catch (_) { /* gone */ } for (const [n, h] of this._bound) window.removeEventListener(n, h); this._bound = []; if (SERVICES.selectmode === this) SERVICES.selectmode = null; this._inited = false }
  onResize () {}
  isActive () { return !!this._s }
  state () { return this._s ? { ...this._s, members: [...this._s.members] } : null }
  request (d) {
    switch (d.action) {
      case 'start': return this.start(d.id)
      case 'connect': return this.connect()
      case 'pattern': return this.setPattern(d.pattern)
      case 'clear': return this.clear()
      case 'delete': return this.remove(true)
      case 'pick': return this.pick(d.id)
      default: return this.done()
    }
  }
  start (id) {
    if (!this.omniNode?.getNodeData?.(id)) throw new Error('That node is not in the scene.')
    this.done(true); this._s = SM.newSelection(id); this._say('Click nodes to pick them. Connect draws lines as you click.'); this._ensureOverlay(); this._buildBar(); this._sync(); send('omni:select-mode-changed', { active: true, state: this.state() }); return true
  }
  /** V268: the meaning new lines get (Link = a plain line) */
  meaning () { return this._meaning }
  setMeaning (id) { if (!Object.prototype.hasOwnProperty.call(LM.MEANINGS, id)) throw new Error('meaning must be one of: ' + LM.MEANING_IDS.join(', ')); this._meaning = id; const sel = this._bar?.querySelector('[data-a=meaning]'); if (sel) sel.value = id; return id }
  _join (a, b) {
    const made = this.omniNode?.connectNodes?.(a, b)
    if (made) { if (this._meaning !== 'link') this.omniNode?.setEdgeStyle?.(a, b, LM.applyMeaning(null, this._meaning)); try { SERVICES.lines?.pulse?.({ path: [a, b] }) } catch (_) { /* no effects */ } }
    return made
  }
  pick (id) {
    if (!this._s) return false
    const r = SM.pick(this._s, id); this._s = r.state
    for (const [a, b] of r.edges) this._join(a, b)
    if (r.action === 'ignored') { this._say(id === this._s.origin ? 'That is the origin.' : this._msg); return false }
    this._say(r.edges.length ? `Joined ${r.edges.length} line${r.edges.length > 1 ? 's' : ''}.` : (r.action === 'added' ? 'Picked.' : 'Un-picked.')); this._sync(); return true
  }
  connect () {
    if (!this._s) throw new Error('Start from a node first (tooltip menu > Select / Connect).')
    const r = SM.startConnect(this._s); this._s = r.state; let made = 0; for (const [a, b] of r.edges) if (this._join(a, b)) made++
    this._say(`Connecting (${this._s.pattern}). ${made ? made + ' line' + (made > 1 ? 's' : '') + ' drawn. ' : ''}Click nodes to join them.`); this._sync(); return made
  }
  setPattern (p) { if (!this._s) throw new Error('Not selecting.'); this._s = SM.setPattern(this._s, p); this._sync(); return this._s.pattern }
  clear () { if (!this._s) return false; this._s = { ...SM.clear(this._s), phase: 'select' }; this._say('Picks cleared (lines already drawn stay).'); this._sync(); return true }
  /** delete the picked nodes; `confirmed` skips the question (the bar asks first) */
  remove (confirmed = false) {
    if (!this._s || !this._s.members.length) { this._say('Nothing picked.'); return 0 }
    const ids = [...this._s.members]
    if (!confirmed && typeof confirm === 'function' && !confirm(`Delete ${ids.length} picked node${ids.length > 1 ? 's' : ''}? This cannot be undone.`)) return 0
    for (const id of ids) send('omni:node-delete-request', { id }); this._s = SM.clear(this._s); this._say(`Deleted ${ids.length}.`); this._sync(); return ids.length
  }
  done (silent = false) {
    const was = !!this._s; this._s = null; this._clearOverlay(); this._bar?.remove(); this._bar = null
    if (was && !silent) send('omni:select-mode-changed', { active: false, state: null }); return was
  }
  _say (t) { this._msg = t; const m = this._bar?.querySelector('.osm-msg'); if (m) m.textContent = t }
  _ensureOverlay () { if (!this._group && this.ctx?.scene) { this._group = new THREE.Group(); this._group.name = 'omni-select-overlay'; this._group.userData.omniOverlay = true; this.ctx.scene.add(this._group) } }
  _clearOverlay () {
    for (const m of [...this._rings.values(), ...this._lines.values()]) { m.parent?.remove(m); m.geometry?.dispose?.(); m.material?.dispose?.() }
    this._rings.clear(); this._lines.clear(); if (this._group) { this._group.parent?.remove(this._group); this._group = null }
  }
  _ringFor (id, color) {
    let r = this._rings.get(id); if (r) return r
    r = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(1, 1)), new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9, depthTest: false })); r.raycast = () => {}; r.renderOrder = 999
    this._group.add(r); this._rings.set(id, r); return r
  }
  _lineFor (id) {
    let l = this._lines.get(id); if (l) return l
    l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineDashedMaterial({ color: 0x9ad0ff, dashSize: 0.3, gapSize: 0.2, transparent: true, opacity: 0.7, depthTest: false })); l.raycast = () => {}; l.renderOrder = 998
    this._group.add(l); this._lines.set(id, l); return l
  }
  /** rebuild rings, preview lines and the bar to match the state (positions follow the nodes every frame in update()) */
  _sync () {
    if (!this._s || !this._group) return
    const want = new Set([this._s.origin, ...this._s.members])
    for (const [id, r] of [...this._rings]) if (!want.has(id)) { r.parent?.remove(r); r.geometry.dispose(); r.material.dispose(); this._rings.delete(id) }
    for (const [id, l] of [...this._lines]) if (!this._s.members.includes(id) || this._s.phase === 'connect') { l.parent?.remove(l); l.geometry.dispose(); l.material.dispose(); this._lines.delete(id) }
    this._ringFor(this._s.origin, 0xffd24a); for (const m of this._s.members) { this._ringFor(m, 0x78dcff); if (this._s.phase === 'select') this._lineFor(m) }
    this._refreshBar(); this.update()
  }
  update () {
    if (!this._s || !this._group) return
    const tmp = new THREE.Vector3(); const o = this.omniNode?.getMeshById?.(this._s.origin); const op = o ? o.getWorldPosition(new THREE.Vector3()) : null
    for (const [id, r] of this._rings) { const m = this.omniNode?.getMeshById?.(id); if (!m) { r.visible = false; continue } r.visible = true; m.getWorldPosition(tmp); r.position.copy(tmp); const bb = new THREE.Box3().setFromObject(m); const rad = Math.max(0.4, bb.getBoundingSphere(new THREE.Sphere()).radius * 1.25); r.scale.setScalar(rad); r.rotation.y += 0.01 }
    for (const [id, l] of this._lines) { const m = this.omniNode?.getMeshById?.(id); if (!m || !op) { l.visible = false; continue } l.visible = true; const pts = l.geometry.attributes.position; pts.setXYZ(0, op.x, op.y, op.z); m.getWorldPosition(tmp); pts.setXYZ(1, tmp.x, tmp.y, tmp.z); pts.needsUpdate = true; l.computeLineDistances() }
  }
  _buildBar () {
    if (!document.getElementById('osm-styles')) { const st = document.createElement('style'); st.id = 'osm-styles'; st.textContent = STYLES; document.head.appendChild(st) }
    const bar = document.createElement('div'); bar.className = 'osm-bar'; bar.setAttribute('role', 'toolbar'); bar.setAttribute('aria-label', 'Select and connect')
    bar.innerHTML = `<span data-ref="title"></span>
      <button data-a="connect" title="Join the picked nodes to the origin and keep drawing a line to every node you click next">⟡ Connect</button>
      <select data-a="pattern" aria-label="Line pattern"><option value="star">Star (all from the origin)</option><option value="chain">Chain (one after another)</option></select>
      <select data-a="meaning" aria-label="What the new lines say" title="What the new lines say (their look and meaning)">${LM.MEANING_IDS.map(m => `<option value="${m}">${LM.MEANINGS[m].label}</option>`).join('')}</select>
      <button data-a="clear" title="Forget the picks. Lines already drawn stay">Clear</button>
      <button data-a="delete" class="osm-danger" title="Delete the picked nodes">⌫ Delete picked</button>
      <button data-a="done" title="Leave (Esc)">Done</button><span class="osm-msg" role="status" aria-live="polite"></span>`
    bar.addEventListener('click', (e) => { const b = e.target.closest('[data-a]'); if (!b || b.tagName === 'SELECT') return; try { ({ connect: () => this.connect(), clear: () => this.clear(), delete: () => this.remove(false), done: () => this.done() })[b.dataset.a]?.() } catch (err) { this._say(String(err?.message ?? err)) } })
    bar.addEventListener('change', (e) => { if (e.target.dataset?.a === 'pattern') this.setPattern(e.target.value); else if (e.target.dataset?.a === 'meaning') this.setMeaning(e.target.value) })
    document.body.appendChild(bar); this._bar = bar; this._say(this._msg)
  }
  _refreshBar () {
    const b = this._bar; if (!b || !this._s) return
    const label = this.omniNode?.getNodeData?.(this._s.origin)?.label || this._s.origin
    b.querySelector('[data-ref=title]').innerHTML = `Origin <b>${esc(label)}</b> · ${this._s.members.length} picked${this._s.phase === 'connect' ? ' · <b>connecting</b>' : ''}`
    b.querySelector('[data-a=pattern]').value = this._s.pattern; b.querySelector('[data-a=meaning]').value = this._meaning; b.querySelector('[data-a=connect]').classList.toggle('osm-on', this._s.phase === 'connect')
    b.querySelector('[data-a=delete]').disabled = !this._s.members.length; b.querySelector('[data-a=clear]').disabled = !this._s.members.length
  }
}
