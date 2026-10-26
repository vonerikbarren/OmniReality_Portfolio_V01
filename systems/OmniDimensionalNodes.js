/**
 * systems/OmniDimensionalNodes.js — runtime of the Dimensional Node (V217): a glass pocket that shows its x-ray / head signature only while the viewer's channel
 * (OmniHand axiom + ConsciousHand perspective, systems/OmniAxioms.js) matches the channel it is tuned to; otherwise it stays veiled.
 *
 *   create(opts)              -> { ok, nodeId }   opts: { position?, label?, id?, dimensional:{axiom,perspective,signature,mode}, select? }  (default: in front of the camera)
 *   tune(nodeId, patch)       change its channel / signature / mode (saved with the node)        tuneToView(nodeId)  = tune to the viewer's current channel
 *   isRevealed(nodeId)        list()  spawnDemo()  removeDemo()  demoCount()
 * Events in: omni:dimensional-node-create { ...opts }.  Out: omni:dimensional-changed { nodeId, reason }.
 * The first time it runs in a space with no Dimensional Nodes it scatters a dozen DEMO nodes (tagged demo:true; "Remove demo nodes" takes them away) so the effect can be seen.
 * The cube spin and satellite run on the TIME axiom's scaled clock, so hyperlapse / slow-mo / a held moment can be seen on them. Registers Extra.SERVICES.dimensional.
 */
import * as THREE from 'three'
import { SERVICES, KIND_DIMENSIONAL, GEO_DIMENSIONAL } from '../utils/OmniExtraKinds.js'
import { sanitizeDimensional, defaultDimensional, matches, demoSpecs } from '../utils/OmniDimensionalModel.js'
import { setReveal, setSignature } from '../utils/OmniDimensionalNodeMesh.js'
import { getTimeScale } from '../utils/OmniTimeScale.js'

export const DEMO_FLAG = 'omni:dimensional:demo-v1'
const NODE_COLOR = '#9ad7ff', PIN_DISTANCE = 7, AUTO_DEMO_MS = 3000
const newId = () => 'dim_' + Math.random().toString(36).slice(2, 8)

export default class OmniDimensionalNodes {
  constructor (context, omniNode = null, { autoDemo = true } = {}) {
    this.ctx = context; this.omniNode = omniNode; this._bound = []; this._inited = false
    this._cache = new Map(); this._scan = 0; this._clock = 0; this._autoDemo = autoDemo; this._demoTimer = null
  }
  init () {
    if (this._inited) return; this._inited = true
    const on = (t, fn) => { const h = (e) => fn(e.detail ?? {}, e); window.addEventListener(t, h); this._bound.push([t, h]) }
    on('omni:dimensional-node-create', (d, e) => { const out = this.create(d); if (e.detail && typeof e.detail === 'object') e.detail.out = out })
    on('omni:node-created', () => { this._scan = 0 }); on('omni:node-restored', () => { this._scan = 0 }); on('omni:node-deleted', () => { this._scan = 0 })
    SERVICES.dimensional = this
    if (this._autoDemo) this._demoTimer = setTimeout(() => { try { if (!localStorage.getItem(DEMO_FLAG) && !this.list().length) { this.spawnDemo(); localStorage.setItem(DEMO_FLAG, '1') } else localStorage.setItem(DEMO_FLAG, '1') } catch (_) {} }, AUTO_DEMO_MS)
  }
  destroy () {
    clearTimeout(this._demoTimer)
    for (const [t, h] of this._bound) window.removeEventListener(t, h); this._bound = []; this._cache.clear()
    if (SERVICES.dimensional === this) SERVICES.dimensional = null; this._inited = false
  }
  onResize () {}
  data (id) { const d = this.omniNode?.getNodeData?.(id); return d?.nodeKind === KIND_DIMENSIONAL ? d : null }
  list () { try { return (this.omniNode?.getAllNodes?.() ?? []).filter(d => d?.nodeKind === KIND_DIMENSIONAL).map(d => d.id) } catch (_) { return [] } }
  demoCount () { try { return (this.omniNode?.getAllNodes?.() ?? []).filter(d => d?.nodeKind === KIND_DIMENSIONAL && d.dimensional?.demo).length } catch (_) { return 0 } }

  _view () { return SERVICES.axioms?.channel?.() ?? null }
  isRevealed (id) { const d = this.data(id); return !!d && matches(d.dimensional, this._view(), SERVICES.spaces?.channelFor?.(id) ?? null) }

  create (opts = {}) {
    try {
      const o = opts && typeof opts === 'object' ? opts : {}
      const dim = sanitizeDimensional(o.dimensional && typeof o.dimensional === 'object' ? o.dimensional : (SERVICES.axioms ? { ...this._view(), perspective: '*', signature: o.signature || 'Signature' } : defaultDimensional()))
      const id = typeof o.id === 'string' && /^[\w-]{1,64}$/.test(o.id) ? o.id : newId()
      window.dispatchEvent(new CustomEvent('omni:node-create-request', { detail: {
        nodeKind: KIND_DIMENSIONAL, dimensional: dim, id, label: String(o.label || 'Dimensional node').slice(0, 40), geometry: GEO_DIMENSIONAL, primitive: 'objective', color: NODE_COLOR,
        position: this._position(o), rotation: [0, 0, 0], scale: [1, 1, 1], noParent: true, noSelect: o.select !== true } }))
      if (this.omniNode && !this.omniNode.getNodeData?.(id)) return { ok: false, error: 'The dimensional node could not be created.' }
      this._scan = 0; return { ok: true, nodeId: id }
    } catch (err) { return { ok: false, error: String(err?.message ?? err) } }
  }
  _position (o) {
    const p = o.position
    if (Array.isArray(p) && p.length >= 3 && p.slice(0, 3).every(Number.isFinite)) return [p[0], p[1], p[2]]
    const cam = this.ctx.camera; if (!cam) return [0, 2, 0]
    const dir = new THREE.Vector3(); cam.getWorldDirection(dir); const q = cam.position.clone().addScaledVector(dir, PIN_DISTANCE); return [q.x, q.y, q.z]
  }
  tune (id, patch = {}) {
    const d = this.data(id); if (!d) return false
    d.dimensional = sanitizeDimensional({ ...d.dimensional, ...patch })
    this._flush(d, 'tune'); return true
  }
  tuneToView (id) { const v = this._view(); return v ? this.tune(id, { axiom: v.axiom, perspective: v.perspective }) : false }
  _flush (d, reason) {
    try { window.dispatchEvent(new CustomEvent('omni:force-save', { detail: {} })) } catch (_) {}
    try { window.dispatchEvent(new CustomEvent('omni:node-updated', { detail: { node: d } })) } catch (_) {}
    try { window.dispatchEvent(new CustomEvent('omni:dimensional-changed', { detail: { nodeId: d.id, reason } })) } catch (_) {}
  }
  spawnDemo () {
    let n = 0
    for (const s of demoSpecs()) { if (this.omniNode?.getNodeData?.(s.id)) continue; if (this.create(s).ok) n++ }
    return n
  }
  removeDemo () {
    let n = 0
    try { for (const d of this.omniNode?.getAllNodes?.() ?? []) if (d?.nodeKind === KIND_DIMENSIONAL && d.dimensional?.demo) { window.dispatchEvent(new CustomEvent('omni:node-delete-request', { detail: { id: d.id } })); n++ } } catch (_) {}
    this._scan = 0; return n
  }

  update (dt = 0.016) {
    dt = Math.min(Math.max(dt, 0), 0.1)
    this._clock += dt * getTimeScale()   // the Time axiom: a held moment freezes the spin, hyperlapse speeds it up
    this._scan -= dt
    if (this._scan <= 0) {
      this._scan = 1
      this._cache.clear()
      for (const id of this.list()) { const m = this.omniNode?.getMeshById?.(id); if (m?.userData?.dimNode) this._cache.set(id, m) }
    }
    const view = this._view(), k = Math.min(1, dt * 6)
    for (const [id, m] of this._cache) {
      const d = this.data(id); if (!d) continue
      const dn = m.userData.dimNode; if (!dn) continue
      const want = matches(d.dimensional, view, SERVICES.spaces?.channelFor?.(id) ?? null) ? 1 : 0
      const r = dn.reveal + (want - dn.reveal) * k
      setSignature(m, d.dimensional.signature)
      setReveal(m, Math.abs(r - want) < 0.002 ? want : r, this._clock, d.dimensional.mode, d.dimensional.axiom || SERVICES.spaces?.channelFor?.(id)?.axiom || null)
    }
  }
}
