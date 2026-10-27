/**
 * systems/OmniRemix.js (V226) — applies a Remix deal (utils/OmniRemixModel.js) to the nodes in the scene, with one level of undo.
 *
 *   SERVICES.remix.roll({ scope:'all'|'selected'|'sandbox'|[ids], seed, what:[...], scheme, layout, axiom, motion:boolean }) -> { text, deal }
 *   SERVICES.remix.undo()  SERVICES.remix.sparks(n)   // sparks: ideas as text only, nothing changes
 * Colour, scale, rotation, label, position use the same events as `Omni Node set`. Motion starts OmniVibration on the node (opt in). Layout moves nodes (opt in).
 * Never touches: nodes without a mesh. Capped at 60 nodes per roll. Undo restores colour, scale, rotation, label and position; it stops vibrations it started.
 */
import { SERVICES } from '../utils/OmniExtraKinds.js'
import { rollScene, layoutPositions, makeRng, ASPECTS, LAYOUTS, SCHEMES } from '../utils/OmniRemixModel.js'
import { AXIOMS } from '../data/OmniAxiomData.js'

const MAX = 60
const send = (n, d) => window.dispatchEvent(new CustomEvent(n, { detail: d }))
const arr = (v) => [v.x, v.y, v.z]

export default class OmniRemix {
  constructor (context, omniNode) { this.context = context; this.omniNode = omniNode ?? context?.omniNode ?? null; this._undo = null; this._lastSeed = null }
  init () {
    SERVICES.remix = this
    this._onReq = (e) => {   // from the ribbon button: omni:remix-request { action: 'roll'|'undo'|'sparks', ...roll options }
      const d = e.detail ?? {}
      try {
        if (d.action === 'undo') { this._toast(`Undid ${this.undo()} node(s)`) }
        else if (d.action === 'sparks') this._toast(this.sparks(5).join('\n'), false)
        else { const r = this.roll({ scope: this._selectedId() ? 'selected' : 'all', ...d }); this._toast(r.text.split('\n').slice(0, 2).join('\n'), true) }
      } catch (err) { this._toast(err.message) }
    }
    window.addEventListener('omni:remix-request', this._onReq)
    this._onSbx = () => {   // ribbon / StarLight: omni:sandbox-request { action:'spawn' }
      try { const r = SERVICES.sandbox.spawn({}); this._toast(r.text.split('\n').slice(0, 3).join('\n'), true) } catch (err) { this._toast(err.message) }
    }
    window.addEventListener('omni:sandbox-request', this._onSbx)
  }
  update () {}
  onResize () {}
  destroy () { window.removeEventListener('omni:remix-request', this._onReq); window.removeEventListener('omni:sandbox-request', this._onSbx); this._toast.el?.remove?.(); if (SERVICES.remix === this) SERVICES.remix = null; this._undo = null }
  /** A small bottom-centre note. #omni-ui ignores the pointer, so the Undo button sets pointer-events itself. */
  _toast (text, undo = false) {
    const host = document.getElementById('omni-ui') ?? document.body
    this._toast.el?.remove?.(); clearTimeout(this._toastT)
    const el = document.createElement('div'); el.setAttribute('data-omni-remix-toast', '')
    Object.assign(el.style, { position: 'fixed', left: '50%', bottom: '86px', transform: 'translateX(-50%)', maxWidth: 'min(92vw,460px)', padding: '10px 14px', background: 'rgba(12,12,16,.88)', color: '#fff', border: '1px solid rgba(255,255,255,.25)', borderRadius: '10px', font: '12px/1.4 system-ui,sans-serif', whiteSpace: 'pre-line', zIndex: 9000, pointerEvents: 'none' })
    el.textContent = text
    if (undo && this.canUndo()) {
      const b = document.createElement('button'); b.textContent = 'Undo'
      Object.assign(b.style, { marginLeft: '10px', pointerEvents: 'auto', cursor: 'pointer', background: 'transparent', color: '#ffd36b', border: '1px solid #ffd36b', borderRadius: '6px', padding: '2px 8px' })
      b.onclick = () => { try { this.undo(); el.textContent = 'Undone' } catch (_) {} }
      el.appendChild(b)
    }
    host.appendChild(el); this._toast.el = el
    this._toastT = setTimeout(() => el.remove(), 7000)
  }

  _selectedId () { const o = this.omniNode, id = o?.getSelectedId?.() ?? o?._selected ?? null; return id && o?.getMeshById?.(id) ? id : null }   // a stale selection counts as none
  _ids (scope) {
    const on = this.omniNode; if (!on) throw new Error('the node system is not available here')
    if (Array.isArray(scope)) return scope.filter(id => on.getMeshById?.(id)).slice(0, MAX)
    if (scope === 'sandbox') { const ids = SERVICES.sandbox?.ids().slice(0, MAX) ?? []; if (!ids.length) throw new Error('the Sandbox is empty: Omni Sandbox spawn'); return ids }
    if (scope === 'selected') { const s = this._selectedId(); if (!s || !on.getMeshById?.(s)) throw new Error('nothing is selected (select a node, or use scope(all))'); return [s] }
    return (on.getAllNodes?.() ?? []).map(n => n.id).filter(id => on.getMeshById?.(id)).slice(0, MAX)
  }

  roll (o = {}) {
    const ids = this._ids(o.scope ?? 'all'); if (!ids.length) throw new Error('no nodes to remix: Omni Draw node(sphere) first')
    const what = (o.what && o.what.length) ? o.what.map(w => String(w).toLowerCase()) : ['color', 'scale', 'spin', 'label']
    for (const w of what) if (!ASPECTS.includes(w) || w === 'what') throw new Error(`what(...) can be: ${ASPECTS.filter(a => a !== 'what').join(', ')}`)
    if (o.scheme && !SCHEMES.includes(o.scheme)) throw new Error(`scheme(...) is one of: ${SCHEMES.join(', ')}`)
    if (o.layout && !LAYOUTS.includes(o.layout)) throw new Error(`layout(...) is one of: ${LAYOUTS.join(', ')}`)
    if (o.axiom && !AXIOMS.some(a => a.id === o.axiom)) throw new Error(`axiom(...) is one of: ${AXIOMS.map(a => a.id).join(', ')}`)
    const seed = o.seed ?? Math.floor(Math.random() * 1e6); this._lastSeed = seed
    const deal = rollScene(ids, seed, { scheme: o.scheme, axiom: o.axiom })
    if (what.includes('layout') || o.layout) deal.layout = o.layout ?? 'ring'

    const on = this.omniNode, snap = { vib: [], items: [] }
    const pos = deal.layout ? layoutPositions(deal.layout, ids.length, this._centre(ids), makeRng(String(seed) + 'L')) : null
    deal.items.forEach((it, i) => {
      const m = on.getMeshById(it.id), d = on.getNodeData?.(it.id); if (!m) return
      snap.items.push({ id: it.id, color: d?.color, label: d?.label, scale: arr(m.scale), rot: [m.rotation.x, m.rotation.y, m.rotation.z], pos: arr(m.position) })
      if (what.includes('color')) send('omni:node-color-set', { id: it.id, color: it.color })
      if (what.includes('scale')) { m.scale.set(...it.scale); send('omni:node-scale-set', { id: it.id, scale: it.scale }) }
      if (what.includes('spin')) { const r = it.spin.map(d => d * Math.PI / 180); m.rotation.set(...r); send('omni:node-rotation-set', { id: it.id, rotation: r }) }
      if (what.includes('label')) send('omni:node-label-set', { id: it.id, label: it.label })
      if (pos) { m.position.set(...pos[i]); send('omni:node-pos-set', { id: it.id, position: pos[i] }) }
      if (what.includes('motion') && it.motion && SERVICES.vibration) { const r = SERVICES.vibration.start(it.id, it.motion, { hold: 0 }); if (r) snap.vib.push(it.id) }
    })
    if (this._undo) this._stopVib(this._undo.vib)
    this._undo = snap
    send('omni:remix', { seed, count: snap.items.length })
    const text = `Remixed ${snap.items.length} node${snap.items.length === 1 ? '' : 's'}  seed ${seed}  ${deal.scheme}${deal.layout ? '  ' + deal.layout : ''}\n${deal.spark}\nSame deal again: Omni Remix roll seed(${seed}) — undo: Omni Remix undo`
    return { text, deal }
  }
  _centre (ids) {
    const on = this.omniNode; let x = 0, y = 0, z = 0, n = 0
    for (const id of ids) { const m = on.getMeshById(id); if (m) { x += m.position.x; y += m.position.y; z += m.position.z; n++ } }
    return n ? [x / n, y / n, z / n] : [0, 1, 0]
  }
  _stopVib (ids) { for (const id of ids ?? []) { try { SERVICES.vibration?.stop(id, { immediate: true }) } catch (_) {} } }
  canUndo () { return !!this._undo }
  undo () {
    const u = this._undo; if (!u) throw new Error('nothing to undo')
    this._stopVib(u.vib); const on = this.omniNode; let n = 0
    for (const s of u.items) {
      const m = on.getMeshById?.(s.id); if (!m) continue
      if (s.color) send('omni:node-color-set', { id: s.id, color: s.color })
      m.scale.set(...s.scale); send('omni:node-scale-set', { id: s.id, scale: s.scale })
      m.rotation.set(...s.rot); send('omni:node-rotation-set', { id: s.id, rotation: s.rot })
      if (s.label !== undefined) send('omni:node-label-set', { id: s.id, label: s.label })
      m.position.set(...s.pos); send('omni:node-pos-set', { id: s.id, position: s.pos })
      n++
    }
    this._undo = null; send('omni:remix', { undo: true, count: n }); return n
  }
  /** Ideas as text only: nothing in the scene changes. */
  sparks (n = 5, seed) {
    const rng = makeRng(seed ?? Math.floor(Math.random() * 1e6)); const out = []
    const deal = rollScene(Array.from({ length: Math.max(1, Math.min(12, n)) }, (_, i) => 's' + i), rng.int(1, 1e9), {})
    for (const it of deal.items) out.push(`${it.label}${it.motion ? ' (' + it.motion + ')' : ''}  ${it.color}`)
    return out
  }
}
