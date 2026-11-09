/**
 * systems/OmniSources.js (V281) — the runtime of the SourceNode: where a claim came from, kept ONCE so many claims can cite it. Model: utils/OmniSourceModel.js.
 *   An Epistemics node keeps its short `source` label (so it is whole on its own) and may point here with epistemics.sourceId (+ cite { page, quote }); the pointer is drawn as a "Cites" line (claim -> source).
 *   The node never fetches its address: it stores the link, you open it yourself.
 *   SERVICES.sources: create(opts) get(id) set(id, patch) list() isNode(id)
 *                     link(claimId, sourceId, cite) unlink(claimId) citedBy(sourceId) sourcesOf(claimId) support(claimId, mode)
 *                     liftFrom(claimId) (make / reuse a source from the claim's own label + address, then link)   mergeDuplicates()
 *                     markStatus(id, status) recheck(id, today) report(today)
 *   Events out: omni:source-changed { nodeId, reason }.   In: omni:source-node-create { ...opts } (answer in detail.out).
 */
import * as THREE from 'three'
import * as M from '../utils/OmniSourceModel.js'
import * as LM from '../utils/OmniLineModel.js'
import { KIND_SOURCE, GEO_SOURCE, KIND_EPISTEMICS, SERVICES } from '../utils/OmniExtraKinds.js'
import { applySourceLook } from '../utils/OmniSourceNodeMesh.js'

const PIN_DISTANCE = 7, PERSIST_MS = 300, STALE_DAYS = 365
const send = (n, d) => { try { window.dispatchEvent(new CustomEvent(n, { detail: d })) } catch (_) { /* no window */ } }
const newId = () => 'omni_' + Math.random().toString(36).slice(2, 8)
const today = () => new Date().toISOString().slice(0, 10)

export default class OmniSources {
  constructor (context, omniNode = null) { this.ctx = context; this.omniNode = omniNode ?? context?.omniNode ?? null; this._inited = false; this._bound = []; this._persist = new Map() }
  init () {
    if (this._inited) return; this._inited = true
    const on = (n, fn) => { const h = (e) => fn(e.detail ?? {}, e); window.addEventListener(n, h); this._bound.push([n, h]) }
    on('omni:source-node-create', (d, e) => { const out = this.request(d); if (e.detail && typeof e.detail === 'object') e.detail.out = out })
    on('omni:node-created', (d) => this._fixNode(d.node))
    this._syncAll(); SERVICES.sources = this
  }
  destroy () { this._persist.forEach(t => clearTimeout(t)); this._persist.clear(); for (const [n, h] of this._bound) window.removeEventListener(n, h); this._bound = []; if (SERVICES.sources === this) SERVICES.sources = null; this._inited = false }
  onResize () {}
  update () {}

  // ── store ──
  _data (id) { return this.omniNode?.getNodeData?.(id) ?? null }
  isNode (id) { return this._data(id)?.nodeKind === KIND_SOURCE }
  list () { try { return (this.omniNode?.getAllNodes?.() ?? []).filter(d => d?.nodeKind === KIND_SOURCE).map(d => d.id) } catch (_) { return [] } }
  get (id) { const d = this._data(id); if (!d || d.nodeKind !== KIND_SOURCE) return null; const s = M.sanitizeSource(d.source); d.source = s; return s }
  set (id, patch, reason = 'edit') {
    const cur = this.get(id), d = this._data(id); if (!cur || !d) return { ok: false, error: 'That is not a source node.' }
    const next = M.sanitizeSource({ ...cur, ...(patch && typeof patch === 'object' ? patch : {}) }); d.source = next
    if (next.title && next.title !== cur.title) d.label = next.title.slice(0, 40)
    this._refresh(id); this._mirror(id, next); send('omni:source-changed', { nodeId: id, reason }); this._persistSoon(id); return { ok: true, source: next }
  }
  _persistSoon (id) { clearTimeout(this._persist.get(id)); this._persist.set(id, setTimeout(() => this.flush(id), PERSIST_MS)) }
  flush (id) { if (id) { clearTimeout(this._persist.get(id)); this._persist.delete(id) } const d = id ? this._data(id) : null; if (!d) return false; send('omni:force-save', {}); send('omni:node-updated', { id, data: d }); return true }
  _fixNode (d) { if (!d || d.nodeKind !== KIND_SOURCE) return; d.source = M.sanitizeSource(d.source); this._refresh(d.id) }
  _syncAll () { try { for (const d of this.omniNode?.getAllNodes?.() ?? []) this._fixNode(d) } catch (_) { /* none yet */ } }
  _refresh (id) { const mesh = this.omniNode?.getMeshById?.(id); const s = this.get(id); if (mesh && s) applySourceLook(mesh, s) }
  _pos (id) { const m = this.omniNode?.getMeshById?.(id); return m ? m.position.toArray() : null }
  /** keep the short label of every claim that cites this source in step with its title */
  _mirror (id, s) { const EP = SERVICES.epistemics; if (!EP || !s.title) return; for (const c of this.citedBy(id)) { const e = EP.get(c); if (e && e.source !== s.title.slice(0, 80)) EP.set(c, { source: s.title.slice(0, 80) }, 'source') } }

  // ── create ──
  _positionFor (o) {
    const p = o.position; if (Array.isArray(p) && p.length >= 3 && p.slice(0, 3).every(Number.isFinite)) return [p[0], p[1], p[2]]
    const cam = this.ctx.camera; const dir = new THREE.Vector3(); cam.getWorldDirection(dir); const q = cam.position.clone().addScaledVector(dir, PIN_DISTANCE); return [q.x, q.y, q.z]
  }
  create (opts = {}) {
    try {
      const o = opts && typeof opts === 'object' ? opts : {}
      const sc = M.sanitizeSource({ ...(o.source && typeof o.source === 'object' ? o.source : {}), ...Object.fromEntries(Object.keys(M.defaultSource()).filter(k => o[k] !== undefined).map(k => [k, o[k]])) })
      const nodeId = typeof o.id === 'string' && /^[\w-]{1,64}$/.test(o.id) ? o.id : newId()
      if (this._data(nodeId)) return { ok: false, error: 'There is already a node called ' + nodeId }
      send('omni:node-create-request', { nodeKind: KIND_SOURCE, source: sc, id: nodeId, label: (sc.title || 'Source').slice(0, 40), geometry: GEO_SOURCE, primitive: 'objective', color: '#c9b27a', position: this._positionFor(o), rotation: [0, 0, 0], scale: [1, 1, 1], noParent: true, noSelect: o.select !== true })
      if (this.omniNode && !this._data(nodeId)) return { ok: false, error: 'The node could not be created.' }
      return { ok: true, nodeId }
    } catch (err) { return { ok: false, error: String(err?.message ?? err) } }
  }
  request (d = {}) {
    try {
      const sel = this.omniNode?.getSelectedId?.() ?? null
      if (d.fromSelected && sel && SERVICES.epistemics?.isNode?.(sel)) return this.liftFrom(sel, d)
      const out = this.create(d); if (!out.ok) return out
      if (d.linkSelected && sel && SERVICES.epistemics?.isNode?.(sel)) this.link(sel, out.nodeId, d.cite)
      return out
    } catch (err) { return { ok: false, error: String(err?.message ?? err) } }
  }

  // ── claims <-> sources ──
  _line (a, b) { try { if (this.omniNode?.connectNodes?.(a, b)) this.omniNode?.setEdgeStyle?.(a, b, LM.applyMeaning(null, 'cites')) } catch (_) { /* the line is a bonus */ } }
  _unline (a, b) { try { this.omniNode?.disconnectNodes?.(a, b) } catch (_) { /* none */ } }
  link (claimId, sourceId, cite) {
    const EP = SERVICES.epistemics; if (!EP?.isNode(claimId)) return { ok: false, error: 'The first node must be an epistemics node.' }
    const s = this.get(sourceId); if (!s) return { ok: false, error: 'The second node must be a source node.' }
    const e = EP.get(claimId); if (e.sourceId && e.sourceId !== sourceId) this._unline(claimId, e.sourceId)
    const patch = { sourceId, cite: cite && typeof cite === 'object' ? cite : e.cite }
    if (!e.source && s.title) patch.source = s.title.slice(0, 80)
    EP.set(claimId, patch, 'source'); this._line(claimId, sourceId); send('omni:source-changed', { nodeId: sourceId, reason: 'cited', claimId }); return { ok: true }
  }
  unlink (claimId) {
    const EP = SERVICES.epistemics; const e = EP?.get(claimId); if (!e) return { ok: false, error: 'That is not an epistemics node.' }
    if (e.sourceId) this._unline(claimId, e.sourceId)
    EP.set(claimId, { sourceId: '', cite: { page: '', quote: '' } }, 'source'); return { ok: true }
  }
  citedBy (sourceId) { const EP = SERVICES.epistemics; if (!EP) return []; return EP.list().filter(id => EP.get(id)?.sourceId === sourceId) }
  sourcesOf (claimId) { const e = SERVICES.epistemics?.get(claimId); return e?.sourceId && this.isNode(e.sourceId) ? [e.sourceId] : [] }
  support (claimId, mode = 'weakest') { return M.claimSupport(this.sourcesOf(claimId).map(i => this.get(i)), { mode }) }
  /** the "Make source node" button: reuse a source that matches this claim's label + address, else make one beside it; then link */
  liftFrom (claimId, o = {}) {
    try {
      const EP = SERVICES.epistemics; const e = EP?.get(claimId); if (!e) return { ok: false, error: 'That is not an epistemics node.' }
      if (e.sourceId && this.isNode(e.sourceId)) return { ok: true, sourceId: e.sourceId, already: true }
      const spec = M.fromEpistemics({ epistemics: e }); if (!spec.title && !spec.url) return { ok: false, error: 'This node has no source label or address to lift. Fill in its source first.' }
      const hit = this.list().find(i => M.sameSource(this.get(i), spec))
      if (hit) { const r = this.link(claimId, hit, o.cite); return r.ok ? { ok: true, sourceId: hit, merged: true } : r }
      const at = this._pos(claimId) ?? [0, 0, 0]
      const made = this.create({ ...spec, accessed: today(), position: Array.isArray(o.position) ? o.position : [at[0], at[1] + 2.5, at[2]], select: false, id: o.id })
      if (!made.ok) return made
      const r = this.link(claimId, made.nodeId, o.cite); return r.ok ? { ok: true, sourceId: made.nodeId, merged: false } : r
    } catch (err) { return { ok: false, error: String(err?.message ?? err) } }
  }
  /** sources that are the same one are folded into the first; claims are re-pointed and the extra node is deleted. Returns the number removed. */
  mergeDuplicates () {
    const ids = this.list(); const gone = new Set(); let n = 0
    for (let i = 0; i < ids.length; i++) {
      if (gone.has(ids[i])) continue
      for (let j = i + 1; j < ids.length; j++) {
        if (gone.has(ids[j]) || !M.sameSource(this.get(ids[i]), this.get(ids[j]))) continue
        for (const c of this.citedBy(ids[j])) this.link(c, ids[i])
        send('omni:node-delete-request', { id: ids[j] }); gone.add(ids[j]); n++
      }
    }
    return n
  }

  // ── upkeep ──
  markStatus (id, status) { if (!M.STATUSES.includes(status)) return { ok: false, error: 'status must be one of: ' + M.STATUSES.join(', ') }; return this.set(id, { status }, 'status') }
  recheck (id, day) { return this.set(id, { accessed: M.safeDate(day) || today() }, 'accessed') }
  /** what needs a look: dead / retracted / old sources and the claims that rest on them, and claims that cite nothing */
  report (day = today()) {
    const EP = SERVICES.epistemics; const out = { sources: [], problems: [], uncited: [] }
    for (const id of this.list()) {
      const s = this.get(id), cites = this.citedBy(id), age = M.staleness(s, day)
      const flags = []; if (s.status === 'dead' || s.status === 'retracted') flags.push(s.status); if (age === null) flags.push('never checked'); else if (age > STALE_DAYS) flags.push('not checked for ' + age + ' days')
      out.sources.push({ id, title: s.title, trust: M.effectiveTrust(s), citedBy: cites.length, flags })
      if (flags.length && cites.length) out.problems.push({ id, title: s.title, flags, claims: cites })
    }
    if (EP) for (const id of EP.list()) { const e = EP.get(id); if (!e.sourceId && (e.layer === 'event' || e.layer === 'documentary')) out.uncited.push(id) }
    return out
  }
}
