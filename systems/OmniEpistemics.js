/**
 * systems/OmniEpistemics.js (V271) — the runtime of the OmniEpistemicsNode: one node kind with a LAYER (event, observation, memory, rumour, gossip, narrative, meta view, documentary, absence, what-if).
 *   Each node holds data.epistemics (utils/OmniEpistemicsModel.js). A node never decides what is true; it says how it was made and what it kept. Certainty is derived (from its layer, or from a linked claim).
 *   DERIVE   derive(fromId, step) makes the NEXT layer's node from a node (a lossy copy, seeded) and joins them with a line that says how (Derives / Distorts / Spreads to). Append-only.
 *   TRACE    trace(claimId) lays a claim out as an event, one observation per testimony, absences from what is unknown, and a what-if per open branch.
 *   EXAMPLE  buildExample('bridge') builds "The Bridge Rumor" (ids ex_bridge_*; building it twice adds nothing).
 *   SERVICES.epistemics: create(opts) get(id) set(id, patch) setAttr(id, key, value) setLayer(id, layer) link(id, claimId|null) derive(id, step, opts) trace(claimId, opts) buildExample(name)
 *                        report(id) look(id) list() isNode(id)       Events out: omni:epistemics-changed { nodeId, reason }.   In: omni:epistemics-node-create { ...opts } (answer in detail.out).
 */
import * as THREE from 'three'
import * as M from '../utils/OmniEpistemicsModel.js'
import * as LM from '../utils/OmniLineModel.js'
import { KIND_EPISTEMICS, GEO_EPISTEMICS, SERVICES } from '../utils/OmniExtraKinds.js'
import { applyEpistemicsLook } from '../utils/OmniEpistemicsNodeMesh.js'

const PIN_DISTANCE = 7, PERSIST_MS = 300, SCAN_MS = 1000, GAP = 2.2
const send = (n, d) => { try { window.dispatchEvent(new CustomEvent(n, { detail: d })) } catch (_) { /* no window */ } }
const newId = () => 'omni_' + Math.random().toString(36).slice(2, 8)

export default class OmniEpistemics {
  constructor (context, omniNode = null) { this.ctx = context; this.omniNode = omniNode ?? context?.omniNode ?? null; this._inited = false; this._bound = []; this._sane = new WeakMap(); this._persist = new Map(); this._scanAt = 0; this._seq = 1 }
  init () {
    if (this._inited) return; this._inited = true
    const on = (n, fn) => { const h = (e) => fn(e.detail ?? {}, e); window.addEventListener(n, h); this._bound.push([n, h]) }
    on('omni:epistemics-node-create', (d, e) => { const out = this.request(d); if (e.detail && typeof e.detail === 'object') e.detail.out = out })
    on('omni:node-created', (d) => this._fixNode(d.node)); on('omni:claim-changed', () => { this._scanAt = 0 })
    this._syncAll(); SERVICES.epistemics = this
  }
  destroy () { this._persist.forEach(t => clearTimeout(t)); this._persist.clear(); for (const [n, h] of this._bound) window.removeEventListener(n, h); this._bound = []; if (SERVICES.epistemics === this) SERVICES.epistemics = null }
  onResize () {}

  // ── store ──
  _data (id) { return this.omniNode?.getNodeData?.(id) ?? null }
  isNode (id) { return this._data(id)?.nodeKind === KIND_EPISTEMICS }
  list () { try { return (this.omniNode?.getAllNodes?.() ?? []).filter(d => d?.nodeKind === KIND_EPISTEMICS).map(d => d.id) } catch (_) { return [] } }
  get (id) {
    const d = this._data(id); if (!d || d.nodeKind !== KIND_EPISTEMICS) return null
    const raw = d.epistemics; if (!raw || typeof raw !== 'object') { const m = M.sanitizeEpistemics({}); this._sane.set(m, m); d.epistemics = m; return m }
    let m = this._sane.get(raw); if (!m) { m = M.sanitizeEpistemics(raw); this._sane.set(raw, m); this._sane.set(m, m) }
    return m
  }
  _need (id) { const e = this.get(id); if (!e) throw new Error('That is not an epistemics node.'); return e }
  set (id, patch, reason = 'edit') {
    const cur = this.get(id); const d = this._data(id); if (!cur || !d) return { ok: false, error: 'That is not an epistemics node.' }
    const p = patch && typeof patch === 'object' ? patch : {}
    const layer = M.isLayer(p.layer) ? p.layer : cur.layer
    const next = M.sanitizeEpistemics({ ...cur, ...p, layer, attrs: { ...(layer === cur.layer ? cur.attrs : keep(cur.attrs, layer)), ...(p.attrs && typeof p.attrs === 'object' ? p.attrs : {}) } })
    this._sane.set(next, next); d.epistemics = next
    if (next.text && next.text !== cur.text) d.label = next.text.slice(0, 40)
    this._refreshLook(id); send('omni:epistemics-changed', { nodeId: id, reason }); this._persistSoon(id); return { ok: true, epistemics: next }
  }
  setAttr (id, key, value) { const cur = this._need(id); if (!M.LAYER_INFO[cur.layer].attrs.some(a => a.key === key)) throw new Error(`a ${cur.layer} has no "${key}" (it has: ${M.LAYER_INFO[cur.layer].attrs.map(a => a.key).join(', ')})`); return this.set(id, { attrs: { [key]: value } }, 'attr') }
  setLayer (id, layer) { if (!M.isLayer(layer)) throw new Error('layer must be one of: ' + M.LAYERS.join(', ')); return this.set(id, { layer }, 'layer') }
  link (id, claimId) { return this.set(id, { claimId: claimId ?? '' }, 'claim') }
  _persistSoon (id) { clearTimeout(this._persist.get(id)); this._persist.set(id, setTimeout(() => this.flush(id), PERSIST_MS)) }
  flush (id) { if (id) { clearTimeout(this._persist.get(id)); this._persist.delete(id) } const d = id ? this._data(id) : null; if (!d) return false; send('omni:force-save', {}); send('omni:node-updated', { id, data: d }); return true }
  _fixNode (d) { if (!d || d.nodeKind !== KIND_EPISTEMICS) return; if (!d.epistemics || typeof d.epistemics !== 'object' || Array.isArray(d.epistemics)) { d.epistemics = M.sanitizeEpistemics({}); this._persistSoon(d.id) } this._scanAt = 0 }
  _syncAll () { try { for (const d of this.omniNode?.getAllNodes?.() ?? []) this._fixNode(d) } catch (_) { /* none yet */ } }

  // ── looks ──
  _confidence (e) { if (!e.claimId) return null; try { const c = SERVICES.claims?.get?.(e.claimId); return c ? M.confidenceFromClaim(c) : null } catch (_) { return null } }
  look (id) { const e = this.get(id); return e ? M.visualOf(e, { confidence: this._confidence(e) }) : null }
  _refreshLook (id) { const mesh = this.omniNode?.getMeshById?.(id); const lk = this.look(id); if (mesh && lk) applyEpistemicsLook(mesh, lk) }
  update (delta) { const t = (typeof performance !== 'undefined' ? performance.now() : Date.now()); if (t < this._scanAt) return; this._scanAt = t + SCAN_MS; for (const id of this.list()) { try { this._refreshLook(id) } catch (_) { /* mesh gone */ } } }
  /** the numbers behind a node: certainty, the equations that apply to its layer, and the forces on it */
  report (id, ctx = {}) {
    const e = this._need(id); const at = e.attrs; const out = { layer: e.layer, certainty: M.certaintyOf(e), confidence: this._confidence(e), forces: M.forceReport(e, ctx) }
    if (e.layer === 'rumor') out.rumorStrength = M.rumorStrength(at)
    if (e.layer === 'narrative') { out.belief = M.belief(at); out.realityResistance = M.realityResistance(at); out.narrativeStability = M.narrativeStability(at) }
    if (e.layer === 'documentary') out.realityResistance = M.realityResistance(at)
    return out
  }

  // ── create ──
  _positionFor (o) {
    const p = o.position; if (Array.isArray(p) && p.length >= 3 && p.slice(0, 3).every(Number.isFinite)) return [p[0], p[1], p[2]]
    const cam = this.ctx.camera; const dir = new THREE.Vector3(); cam.getWorldDirection(dir); const q = cam.position.clone().addScaledVector(dir, PIN_DISTANCE); return [q.x, q.y, q.z]
  }
  create (opts = {}) {
    try {
      const o = opts && typeof opts === 'object' ? opts : {}
      const ep = M.sanitizeEpistemics({ layer: o.layer, text: o.text, attrs: o.attrs, claimId: o.claimId, source: o.source, sourceId: o.sourceId, cite: o.cite, derivedFrom: o.derivedFrom, note: o.note })
      const nodeId = typeof o.id === 'string' && /^[\w-]{1,64}$/.test(o.id) ? o.id : newId()
      if (this._data(nodeId)) return { ok: false, error: 'There is already a node called ' + nodeId }
      send('omni:node-create-request', { nodeKind: KIND_EPISTEMICS, epistemics: ep, id: nodeId, label: (ep.text || M.LAYER_INFO[ep.layer].label).slice(0, 40), geometry: GEO_EPISTEMICS, primitive: 'objective', color: M.layerColor(ep.layer), position: this._positionFor(o), rotation: [0, 0, 0], scale: [1, 1, 1], noParent: true, noSelect: o.select !== true })
      if (this.omniNode && !this._data(nodeId)) return { ok: false, error: 'The node could not be created.' }
      return { ok: true, nodeId }
    } catch (err) { return { ok: false, error: String(err?.message ?? err) } }
  }
  request (d = {}) {
    try {
      const sel = this.omniNode?.getSelectedId?.() ?? null
      if (d.fromSelected && sel && !this.isNode(sel) && SERVICES.claims?.isClaim?.(sel)) return this.trace(sel, d)
      if (d.deriveFrom || (d.fromSelected && sel && this.isNode(sel))) return this.derive(String(d.deriveFrom || sel), d.step || d.to || null, d)
      if (d.claimId && !d.layer && d.trace !== false) return this.trace(String(d.claimId), d)
      const out = this.create(d); if (!out.ok) return out
      if (d.linkSelected && sel && sel !== out.nodeId) this._line(sel, out.nodeId, d.meaning || 'note')
      return out
    } catch (err) { return { ok: false, error: String(err?.message ?? err) } }
  }
  _line (a, b, meaning) { try { if (this.omniNode?.connectNodes?.(a, b)) this.omniNode?.setEdgeStyle?.(a, b, LM.applyMeaning(null, meaning)) } catch (_) { /* the line is a bonus */ } }
  _posOf (id) { const m = this.omniNode?.getMeshById?.(id); return m ? m.position.toArray() : null }

  // ── derive: the next layer ──
  derive (fromId, step, opts = {}) {
    try {
      const src = this._need(fromId); const o = opts && typeof opts === 'object' ? opts : {}
      let tid = step && M.TRANSFORMS[step] ? step : (step && M.isLayer(step) ? M.transformFor(src.layer, step) : null)
      if (!tid) { const n = M.nextSteps(src.layer); if (!step && n.length) tid = n[0].transform; else return { ok: false, error: `a ${src.layer} cannot become ${step || 'anything'}; it can become: ${n.map(s => s.to).join(', ') || 'nothing'}` } }
      const seed = Number.isFinite(Number(o.seed)) ? Number(o.seed) : (Date.now() ^ (this._seq++ * 2654435761)) >>> 0
      const r = M.derive({ ...src, id: fromId }, tid, { seed, text: o.text, id: fromId }); if (!r.ok) return r
      const sp = this._posOf(fromId) ?? this._positionFor({}); const kids = this._kids(fromId); const pos = o.position ?? [sp[0] + GAP, sp[1] - GAP * 0.55 * kids, sp[2] + 0.4 * kids]
      const made = this.create({ ...r.spec, id: o.id, position: pos, select: o.select }); if (!made.ok) return made
      this._line(fromId, made.nodeId, r.meaning)
      return { ok: true, nodeId: made.nodeId, from: fromId, step: tid, layer: r.spec.layer, seed }
    } catch (err) { return { ok: false, error: String(err?.message ?? err) } }
  }
  _kids (id) { let n = 0; try { for (const d of this.omniNode?.getAllNodes?.() ?? []) if (d?.nodeKind === KIND_EPISTEMICS && Array.isArray(d.epistemics?.derivedFrom) && d.epistemics.derivedFrom.includes(id)) n++ } catch (_) { /* none */ } return n }

  // ── trace a claim ──
  trace (claimId, opts = {}) {
    try {
      const cs = SERVICES.claims; if (!cs) return { ok: false, error: 'The claim system is not running.' }
      if (cs.isLocked?.(claimId)) return { ok: false, error: 'That claim is sealed; open it first.' }
      const claim = cs.get(claimId); if (!claim) return { ok: false, error: 'There is no claim node ' + claimId }
      const T = M.traceClaim(claim); const base = this._posOf(claimId) ?? this._positionFor(opts); const ids = {}; const made = []
      const place = (key, spec, x, y, z) => { const o = this.create({ ...spec, id: 'tr_' + String(claimId).slice(0, 20) + '_' + key.replace(/[^\w-]/g, '_').slice(0, 30), position: [base[0] + x, base[1] + y, base[2] + z] }); if (o.ok) { ids[key] = o.nodeId; made.push(o.nodeId) } return o }
      place('event', T.event, GAP * 2, 0, 0)
      T.observations.forEach((o, i) => place(o.key, o.spec, GAP * 4, (i - (T.observations.length - 1) / 2) * GAP, 0))
      T.absences.forEach((o, i) => place(o.key, o.spec, GAP * 2 + (i - (T.absences.length - 1) / 2) * GAP, -GAP * 1.8, 0.5))
      T.counterfactuals.forEach((o, i) => place(o.key, o.spec, GAP * 2 + (i - (T.counterfactuals.length - 1) / 2) * GAP, GAP * 1.8, -0.5))
      for (const l of T.links) if (ids[l.from] && ids[l.to]) this._line(ids[l.from], ids[l.to], l.meaning)
      if (ids.event) this._line(claimId, ids.event, 'contains')
      return { ok: true, nodeIds: made, event: ids.event ?? null, observations: T.observations.length, absences: T.absences.length, whatIfs: T.counterfactuals.length }
    } catch (err) { return { ok: false, error: String(err?.message ?? err) } }
  }

  // ── the sandbox example ──
  buildExample (name = 'bridge') {
    try {
      if (String(name || 'bridge').toLowerCase() !== 'bridge') return { ok: false, error: 'The examples are: bridge' }
      const ex = M.bridgeExample(); const base = this._positionFor({}); const col = { event: 0, observation: 1, memory: 2, rumor: 3, gossip: 4, narrative: 5, documentary: 5, absence: 0, counterfactual: 1 }; const rowOf = {}
      const made = []; const have = new Set()
      for (const n of ex.nodes) {
        const c = col[n.layer] ?? 0; rowOf[c] = (rowOf[c] ?? 0) + 1; const y = n.layer === 'absence' ? -GAP * 2.2 : n.layer === 'counterfactual' ? -GAP * 2.2 : n.layer === 'documentary' ? GAP * 1.4 : n.layer === 'observation' ? (rowOf[c] - 2) * GAP * 0.9 : 0
        if (this._data(n.id)) { have.add(n.id); continue }
        const o = this.create({ ...n, position: [base[0] + (c - 2.5) * GAP * 1.5, base[1] + y, base[2]] }); if (o.ok) { made.push(o.nodeId); have.add(n.id) }
      }
      for (const l of ex.links) { if (have.has(l.from) && have.has(l.to) && made.some(id => id === l.from || id === l.to)) this._line(l.from, l.to, l.meaning) }
      return { ok: true, built: made.length, nodeIds: made, already: ex.nodes.length - made.length }
    } catch (err) { return { ok: false, error: String(err?.message ?? err) } }
  }
}
function keep (attrs, layer) { const o = {}; for (const a of M.LAYER_INFO[layer].attrs) if (Object.prototype.hasOwnProperty.call(attrs, a.key)) o[a.key] = attrs[a.key]; return o }
