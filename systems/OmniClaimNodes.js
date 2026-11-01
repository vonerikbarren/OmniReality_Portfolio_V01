/**
 * systems/OmniClaimNodes.js (V260) — ClaimNodes (DimensionalScripting) in the space. The model is utils/OmniClaimModel.js; the private form is utils/OmniClaimVault.js.
 *   - PUBLIC claim: data.claim (plain). PRIVATE claim: data.claimSealed only (AES-GCM under your key); the key is kept in memory for this session ONLY, never saved.
 *     While locked, the node shows a padlock, a grey ring and its title; nothing else can be read or changed. Edits to an unlocked private claim re-seal it.
 *   - The node's gauge ring and colour follow the shares at the claim's scale; the share curve is registered for OmniCell (utils/ChartDataRegistry.js).
 * SERVICES.claims = this.  Commands: Omni Claim ... (systems/OmniLangCommands.js).  Events out: omni:claim-changed { nodeId }, omni:claim-locked { nodeId, locked }.
 */
import { SERVICES, KIND_CLAIM, GEO_CLAIM, isClaimNodeData } from '../utils/OmniExtraKinds.js'
import * as C from '../utils/OmniClaimModel.js'
import * as V from '../utils/OmniClaimVault.js'
import { setClaimLook } from '../utils/OmniClaimNodeMesh.js'
import { registerChart, unregisterChart } from '../utils/ChartDataRegistry.js'

const send = (n, d) => { try { window.dispatchEvent(new CustomEvent(n, { detail: d })) } catch (_) { /* no window */ } }
const newId = () => 'cl' + Date.now().toString(36) + Math.floor(Math.random() * 46656).toString(36)

export default class OmniClaimNodes {
  constructor (context, omniNode = null) { this.ctx = context; this.omniNode = omniNode ?? context?.omniNode ?? null; this._open = new Map(); this._looks = new Map(); this._sealing = new Map(); this._bound = []; this._t = 0; this._inited = false }
  init () {
    if (this._inited) return; this._inited = true
    const on = (n, fn) => { const h = (e) => fn(e.detail ?? {}, e); window.addEventListener(n, h); this._bound.push([n, h]) }
    on('omni:claim-node-create', (d, e) => { const out = this.createClaimNode(d); if (e.detail && typeof e.detail === 'object') e.detail.out = out })
    on('omni:node-deleted', (d) => this._gone(d.id)); on('omni:scene-clear-request', () => { for (const id of [...this._looks.keys()]) this._gone(id); this._open.clear() })
    SERVICES.claims = this
  }
  destroy () { for (const id of [...this._looks.keys()]) this._gone(id); this._open.clear(); for (const [n, h] of this._bound) window.removeEventListener(n, h); this._bound = []; if (SERVICES.claims === this) SERVICES.claims = null; this._inited = false }
  onResize () {}
  getData (id) { return this.omniNode?.getNodeData?.(id) ?? null }
  isClaim (id) { return isClaimNodeData(this.getData(id)) }
  list () { try { return (this.omniNode?.getAllNodes?.() ?? []).filter(isClaimNodeData).map(d => d.id) } catch (_) { return [] } }
  isPrivate (id) { const d = this.getData(id); return !!d && (!!d.claimSealed || d.claim?.visibility === 'private') }
  isLocked (id) { const d = this.getData(id); return !!d?.claimSealed && !this._open.has(id) }
  /** The claim, or null if it is private and still locked. */
  get (id) { const d = this.getData(id); if (!isClaimNodeData(d)) return null; if (d.claimSealed) return this._open.get(id)?.claim ?? null; return C.sanitizeClaim(d.claim) }
  title (id) { const d = this.getData(id); return d?.claimSealed ? V.publicFace(d.claimSealed)?.claim ?? '' : C.sanitizeClaim(d?.claim).claim }
  _need (id) { if (!this.isClaim(id)) throw new Error('That is not a ClaimNode.'); const c = this.get(id); if (!c) throw new Error('This claim is private and locked. Unlock it with its key first.'); return c }
  /** Write an edited claim back (public: into the node; private: kept in memory and re-sealed). Returns the stored claim. */
  _put (id, claim) {
    const d = this.getData(id); const c = C.sanitizeClaim(claim)
    if (d.claimSealed) { const o = this._open.get(id); o.claim = { ...c, visibility: 'private' }; this._reseal(id) } else { d.claim = c; this._save(id) }
    this._looks.delete(id); send('omni:claim-changed', { nodeId: id }); return this.get(id)
  }
  _save (id) { const d = this.getData(id); send('omni:force-save', {}); if (d) send('omni:node-updated', { node: d }) }
  _reseal (id) {
    const o = this._open.get(id); if (!o) return Promise.resolve()
    const run = V.sealClaim(o.claim, o.key).then(sealed => { const d = this.getData(id); if (d && this._open.get(id) === o) { d.claimSealed = sealed; this._save(id) } }).catch(() => {}).finally(() => { if (this._sealing.get(id) === run) this._sealing.delete(id) })
    this._sealing.set(id, run); return run
  }
  /** Wait until every private claim has finished re-sealing (before saving a scene). */
  flush () { return Promise.all([...this._sealing.values()]) }

  // ── making ──
  createClaimNode (o = {}) {
    try {
      const opts = o && typeof o === 'object' ? o : {}; const nodeId = typeof opts.id === 'string' && /^[\w-]{1,64}$/.test(opts.id) ? opts.id : newId()
      const claim = C.newClaim({ claim: String(opts.claim ?? opts.title ?? 'A claim'), identity: opts.identity, scale: opts.scale ?? 10, laws: Array.isArray(opts.laws) ? opts.laws : [], conditions: opts.conditions && typeof opts.conditions === 'object' ? opts.conditions : {}, id: nodeId })
      const pos = Array.isArray(opts.position) ? opts.position : (SERVICES.poly?._positionFor?.({}) ?? [0, 1.5, 0])
      const parent = typeof opts.parent === 'string' && this.getData(opts.parent) ? opts.parent : null   // a branch reality is joined to its source by an ordinary line
      send('omni:node-create-request', { nodeKind: KIND_CLAIM, claim, id: nodeId, label: String(opts.label || claim.claim).slice(0, 40), geometry: GEO_CLAIM, primitive: 'objective', color: '#9ad0ff', position: pos, rotation: [0, 0, 0], scale: [1, 1, 1], parentId: parent ?? undefined, noParent: !parent, noSelect: opts.select !== true })
      if (this.omniNode && !this.getData(nodeId)) return { ok: false, error: 'The ClaimNode could not be created.' }
      return { ok: true, nodeId }
    } catch (err) { return { ok: false, error: String(err?.message ?? err) } }
  }

  // ── editing (each returns the new claim) ──
  testify (id, t) { return this._put(id, C.addTestimony(this._need(id), t)) }
  setScale (id, n) { return this._put(id, C.setScale(this._need(id), n)) }
  setState (id, changes, reason) { return this._put(id, C.setState(this._need(id), changes, reason)) }
  setClaimText (id, text) { const c = this._need(id); return this._put(id, { ...c, claim: text }) }
  addUnknown (id, layer, text, by) { return this._put(id, C.addUnknown(this._need(id), layer, text, by)) }
  stage (id, statement, support) { return this._put(id, C.stageTheory(this._need(id), statement, support)) }
  resolve (id, theoryId, confirmed, reason) { return this._put(id, C.resolveTheory(this._need(id), theoryId, confirmed, reason)) }
  promote (id, opts) { return this._put(id, C.promote(this._need(id), opts)) }
  removeTestimony (id, testimonyId) { const c = this._need(id); return this._put(id, { ...c, testimonies: c.testimonies.filter(t => t.id !== testimonyId) }) }

  // ── awareness, identification, branch realities ──
  addAwareness (id, a) { return this._put(id, C.addAwareness(this._need(id), a)) }
  removeAwareness (id, aid) { return this._put(id, C.removeAwareness(this._need(id), aid)) }
  becomeFamiliar (id, aid, subject) { return this._put(id, C.becomeFamiliar(this._need(id), aid, subject)) }
  accept (id, aid, subject) { return this._put(id, C.accept(this._need(id), aid, subject)) }
  scoreEffectiveness (id, aid, subject, score) { return this._put(id, C.scoreEffectiveness(this._need(id), aid, subject, score)) }
  /** Run every awareness over a subject. Returns [{ awareness, result, revealsValues }]. Declined subjects (branch sources) are put on the record and a branch is born. */
  identify (id, subject) { const r = C.identify(this._need(id), subject); this._put(id, r.claim); return r.results }
  setBranch (id, branchId, status, reason) { return this._put(id, C.setBranch(this._need(id), branchId, status, reason)) }
  /** Grow a branch into a reality of its own: a new ClaimNode about the declined subject, joined to this claim by a line. */
  growBranch (id, branchId) {
    const c = this._need(id); const b = c.branches.find(x => x.id === branchId); if (!b) throw new Error('No such branch.')
    const pp = this.getData(id)?.position; const pos = Array.isArray(pp) ? [pp[0] + 4, pp[1], pp[2] + 3 * (b.nodes.length + 1)] : undefined
    const r = this.createClaimNode({ claim: b.subject, parent: id, position: pos }); if (!r.ok) throw new Error(r.error)
    this._put(id, C.growBranch(c, branchId, r.nodeId)); return r.nodeId
  }

  // ── reading ──
  shares (id, n = null) { return C.sharesAt(this._need(id), n) }
  data (id, n = null) { return C.chartData(this._need(id), n) }
  path (id, subject = null) { return C.pathOf(this._need(id), subject) }

  // ── private / public ──
  /** Seal a public claim under a key (the key stays in memory this session; it is never saved). */
  async makePrivate (id, key) {
    const c = this._need(id); const d = this.getData(id); if (d.claimSealed) throw new Error('This claim is already private.')
    const sealed = await V.sealClaim(c, key); d.claimSealed = sealed; delete d.claim; this._open.set(id, { claim: { ...c, visibility: 'private' }, key }); this._looks.delete(id); this._save(id)
    send('omni:claim-locked', { nodeId: id, locked: false }); send('omni:claim-changed', { nodeId: id }); return true
  }
  /** Open a private claim for this session. A wrong key throws and changes nothing. */
  async unlock (id, key) {
    const d = this.getData(id); if (!isClaimNodeData(d)) throw new Error('That is not a ClaimNode.'); if (!d.claimSealed) return true
    const claim = await V.openClaim(d.claimSealed, key); this._open.set(id, { claim, key }); this._looks.delete(id)
    send('omni:claim-locked', { nodeId: id, locked: false }); send('omni:claim-changed', { nodeId: id }); return true
  }
  /** Forget the key and the open copy: the claim is sealed again until unlocked. */
  async lock (id) { await this._sealing.get(id); const d = this.getData(id); if (!d?.claimSealed) throw new Error('Only a private claim can be locked.'); this._open.delete(id); unregisterChart(id); this._looks.delete(id); send('omni:claim-locked', { nodeId: id, locked: true }); send('omni:claim-changed', { nodeId: id }); return true }
  /** Take the seal off (needs it unlocked). The claim becomes plain data in the node. */
  makePublic (id) { const c = this._need(id); const d = this.getData(id); if (!d.claimSealed) throw new Error('This claim is already public.'); d.claim = C.sanitizeClaim({ ...c, visibility: 'public' }); delete d.claimSealed; this._open.delete(id); this._looks.delete(id); this._save(id); send('omni:claim-changed', { nodeId: id }); return true }

  // ── per frame: gauge, colour, OmniCell chart ──
  update () {
    if (!this._inited) return; const t = (typeof performance !== 'undefined' ? performance.now() : Date.now()); if (t - this._t < 250) return; this._t = t   // real time, not frames: a slow frame rate must not slow the gauge
    for (const id of this.list()) {
      const mesh = this.omniNode?.getMeshById?.(id); if (!mesh?.userData?.claimMesh) continue
      const c = this.get(id)
      if (!c) { if (this._looks.get(id) !== 'sealed') { setClaimLook(mesh, { sealed: true }); this._looks.set(id, 'sealed'); unregisterChart(id) } continue }
      const sig = JSON.stringify([c.testimonies.length, c.state, c.theories.length, c.events.length, c.testimonies.map(t => t.truthType + t.verdict + t.region + t.weight + t.entity.resolution).join()])
      if (this._looks.get(id) === sig) continue; this._looks.set(id, sig)
      const s = C.sharesAt(c); const obj = s.undefined < 1e-9 && c.state.laws.length > 0
      setClaimLook(mesh, { truth: s.truth, false: s.false, undefined: s.undefined, objective: obj, sealed: false })
      const cv = C.curve(c); const row = (k) => Object.fromEntries(cv.map(p => [String(p.scale), Math.round(p[k] * 100)]))
      registerChart(id, { seriesData: { True: row('truth'), False: row('false'), Undefined: row('undefined') }, seriesVisibility: { True: true, False: true, Undefined: true }, chartType: 'line' })
    }
  }
  _gone (id) { this._looks.delete(id); this._open.delete(id); this._sealing.delete(id); unregisterChart(id) }
}
