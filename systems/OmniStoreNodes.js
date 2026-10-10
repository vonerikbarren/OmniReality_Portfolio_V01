/**
 * systems/OmniStoreNodes.js — the runtime of the two OmniNode kinds StoreItemNode and OmniValueNode (V183, SANDBOX).
 *
 * The nodes themselves are ordinary OmniNode nodes (systems/OmniNode.js, data.nodeKind; shape and textures in utils/OmniNodeKinds.js). This module
 * only does what needs the live models and the scene context:
 *   - LAZY LIVE UPDATES: it listens to the store model's and the value model's change events (and the identity change) and redraws only the
 *     faces whose description changed, ONE pass per animation frame however many events arrived. Nothing runs per frame otherwise.
 *   - PIN requests  omni:node-pin-request { kind:'storeItem', storeId?, productId } | { kind:'omniValue', valueTypeId }  (the store's "Pin to my
 *     space" button, the wallet / OmniTalent "Pin this value type", the dev panel). The node is dropped in front of the camera through the ordinary
 *     omni:node-create-request; the caller gets { ok, id, error } in event.detail.out.
 *   - CONVERSION LABELS: an edge between two OmniValueNodes is a real OmniNode edge; this module puts a small rate label (read from the model) at its
 *     midpoint. The label is only a view: no rate is stored on the edge or on a node.
 *   - STATS and TEST nodes for the dev panel (omni:node-kinds-stats-get, omni:node-kinds-test).
 *
 * Module contract: constructor(context, omniNode) / init (guarded against a second call) / update(delta) / destroy / onResize.
 */

import * as THREE from 'three'
import * as Store from '../utils/OmniStoreModel.js'
import * as Value from '../utils/OmniValueModel.js'
import * as Kinds from '../utils/OmniNodeKinds.js'

export const PIN_EVENT = 'omni:node-pin-request'
export const PINNED_EVENT = 'omni:node-pinned'
export const STATS_EVENT = 'omni:node-kinds-stats-get'
export const TEST_EVENT = 'omni:node-kinds-test'
export const TEST_PREFIX = 'kt_'
const PIN_DISTANCE = 6
const newId = () => 'omni_' + Math.random().toString(36).slice(2, 8)

export default class OmniStoreNodes {
  constructor (context, omniNode = null) {
    this.ctx = context
    this.omniNode = omniNode
    this._inited = 0
    this._bound = []
    this._raf = 0
    this._dirty = false
    this._pinSeq = 0
    this._edgeLabels = new Map()   // 'fromId>toId' -> Sprite
    this._edgeDirty = true   // first update() builds the labels for conversion edges restored from storage
    this._tmpA = new THREE.Vector3()
    this._tmpB = new THREE.Vector3()
  }

  init () {
    this._inited++
    if (this._inited > 1) return   // BaseScene.addModule() calls init(); a second call must not double the listeners
    const on = (name, fn) => { const h = (e) => fn(e.detail ?? {}, e); window.addEventListener(name, h); this._bound.push([name, h]) }
    on(Store.CHANGED_EVENT, () => this.scheduleRefresh())
    on(Value.CHANGED_EVENT, () => this.scheduleRefresh())
    on('omni:identity-changed', () => this.scheduleRefresh())
    on(PIN_EVENT, (d, e) => { const out = this.pin(d); if (e.detail && typeof e.detail === 'object') e.detail.out = out })
    on(STATS_EVENT, (d, e) => { if (e.detail && typeof e.detail === 'object') e.detail.out = this.getStats() })
    on(TEST_EVENT, (d, e) => { const out = d.action === 'remove' ? this.removeTestNodes() : this.createTestNodes(d.storeItems, d.values); if (e.detail && typeof e.detail === 'object') e.detail.out = out })
    // edges: a new / removed edge or node changes which conversion labels exist
    on('omni:nodes-updated', () => { this._edgeDirty = true })
    on('omni:node-deleted', () => { this._edgeDirty = true })
    on('omni:node-restored', () => { this._edgeDirty = true })
    on('omni:edge-removed', () => { this._edgeDirty = true })
    on('omni:scene-clear-request', () => { this._edgeDirty = true })
  }

  update () {
    if (this._edgeDirty) { this._edgeDirty = false; this._syncEdgeLabels() }
    if (this._edgeLabels.size) this._placeEdgeLabels()
  }

  onResize () {}

  destroy () {
    if (!this._inited) return
    this._bound.forEach(([n, h]) => window.removeEventListener(n, h))
    this._bound = []
    if (this._raf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(this._raf)
    this._raf = 0
    this._clearEdgeLabels()
    this._inited = 0
  }

  // ── Lazy refresh ────────────────────────────────────────────────────────────

  /** One refresh pass per frame however many change events came in. */
  scheduleRefresh () {
    this._dirty = true
    if (this._raf) return
    const run = () => { this._raf = 0; if (this._dirty) { this._dirty = false; this.refreshNow() } }
    if (typeof requestAnimationFrame === 'function') this._raf = requestAnimationFrame(run); else this._raf = setTimeout(run, 0)
  }

  /** Redraw the faces that changed; labels on conversion edges follow. Returns how many node faces changed. */
  refreshNow () {
    const n = Kinds.refreshAll()
    this._edgeLabels.forEach((sprite, key) => this._labelFor(sprite, key))
    return n
  }

  // ── Pin ─────────────────────────────────────────────────────────────────────

  /** A point in front of the camera (6 units ahead), fanned sideways so repeated pins do not stack. */
  _frontOfCamera () {
    const cam = this.ctx.camera
    const dir = new THREE.Vector3(); cam.getWorldDirection(dir)
    const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0))
    if (right.lengthSq() < 1e-6) right.set(1, 0, 0); right.normalize()
    // centre first, then right / left alternately; the step shrinks on a narrow (phone) view so every slot stays on screen
    const slot = [0, 1, -1, 2, -2][this._pinSeq++ % 5]
    const halfW = PIN_DISTANCE * Math.tan(THREE.MathUtils.degToRad((cam.fov ?? 60) / 2)) * (cam.aspect || 1)
    const step = Math.min(1.3, Math.max(0.3, halfW * 0.4))
    const p = cam.position.clone().addScaledVector(dir, PIN_DISTANCE).addScaledVector(right, slot * step)
    return [p.x, p.y, p.z]   // no floor clamp: in the store the camera can sit below y=0.5 and a clamp would push the node out of view
  }

  /**
   * Create a reference node. spec: { kind:'storeItem', productId, storeId? (default: the active store) } | { kind:'omniValue', valueTypeId }.
   * Returns { ok, id, label } or { ok:false, error }. The node is not selected (the store view stays uncovered, and it stays clickable); click it to inspect it.
   */
  pin (spec = {}, opts = {}) {
    try {
      let ref = null
      if (spec.kind === Kinds.KIND_STORE_ITEM) {
        const storeId = spec.storeId || Store.activeStoreId()
        ref = { nodeKind: Kinds.KIND_STORE_ITEM, storeId, productId: spec.productId }
        const st = Store.peekStore(storeId)
        if (!st || !st.products.some(p => p.id === spec.productId)) return { ok: false, error: 'That product is not in your store.' }
      } else if (spec.kind === Kinds.KIND_VALUE) {
        ref = { nodeKind: Kinds.KIND_VALUE, valueTypeId: spec.valueTypeId }
        if (!Value.getType(spec.valueTypeId)) return { ok: false, error: 'That value type does not exist.' }
      } else return { ok: false, error: 'Unknown node kind.' }
      const kf = Kinds.kindCreateFields(ref)
      if (!kf) return { ok: false, error: 'That reference is not valid.' }
      const id = opts.id ?? newId()
      const position = opts.position ?? this._frontOfCamera()
      window.dispatchEvent(new CustomEvent('omni:node-create-request', { detail: {
        ...ref, id, label: kf.label, geometry: kf.geometry, primitive: 'objective', color: '#ffffff', position, rotation: [0, 0, 0], scale: [1, 1, 1],
        noParent: true, noSelect: opts.select !== true,
      } }))
      window.dispatchEvent(new CustomEvent(PINNED_EVENT, { detail: { id, kind: spec.kind, label: kf.label } }))
      return { ok: true, id, label: kf.label }
    } catch (err) { return { ok: false, error: String(err?.message ?? err) } }
  }

  // ── Conversion labels on edges between two value nodes ─────────────────────

  _valueEdges () {
    const on = this.omniNode
    if (!on?.getAllEdges) return []
    const out = []
    for (const e of on.getAllEdges()) {
      const pair = Kinds.valuePairOf(on.getNodeData(e.from), on.getNodeData(e.to))
      if (pair) out.push({ key: `${e.from}>${e.to}`, from: e.from, to: e.to, pair })
    }
    return out
  }

  _syncEdgeLabels () {
    const want = new Map(this._valueEdges().map(e => [e.key, e]))
    for (const [key, sprite] of this._edgeLabels) {
      if (!want.has(key)) { Kinds.detachLabel(sprite); sprite.material.dispose(); this.ctx.scene.remove(sprite); this._edgeLabels.delete(key) }
    }
    for (const [key, e] of want) {
      let sprite = this._edgeLabels.get(key)
      if (!sprite) {
        sprite = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false }))
        sprite.userData.isKindEdgeLabel = true
        sprite.userData.labelWidth = 2.8
        sprite.userData.edge = e
        this.ctx.scene.add(sprite)
        this._edgeLabels.set(key, sprite)
      }
      sprite.userData.edge = e
      this._labelFor(sprite, key)
    }
  }

  _labelFor (sprite, key) {
    const e = sprite.userData.edge
    if (!e) return
    const info = Kinds.pairInfo(e.pair[0], e.pair[1])
    const head = `${info.aName} ⇄ ${info.bName}`
    Kinds.attachLabel(sprite, [head, ...info.shortLines].map(l => (l.length > Kinds.LIMITS.labelChars ? l.slice(0, Kinds.LIMITS.labelChars - 1) + '…' : l)))
  }

  /** The label sits at the midpoint of the two nodes; cheap, and only runs while at least one conversion edge exists. */
  _placeEdgeLabels () {
    const on = this.omniNode
    for (const sprite of this._edgeLabels.values()) {
      const e = sprite.userData.edge
      const ma = on.getMeshById(e.from), mb = on.getMeshById(e.to)
      if (!ma || !mb) { sprite.visible = false; continue }
      ma.getWorldPosition(this._tmpA); mb.getWorldPosition(this._tmpB)
      sprite.position.copy(this._tmpA).add(this._tmpB).multiplyScalar(0.5)
      sprite.position.y += 0.35
      if (sprite.userData.labelKey) sprite.visible = ma.visible && mb.visible
    }
  }

  _clearEdgeLabels () {
    for (const sprite of this._edgeLabels.values()) { Kinds.detachLabel(sprite); sprite.material.dispose(); this.ctx.scene.remove(sprite) }
    this._edgeLabels.clear()
  }

  // ── Dev: stats and test nodes ───────────────────────────────────────────────

  getStats () {
    const k = Kinds.kindStats()
    return { ...k, edgeLabels: this._edgeLabels.size, testNodes: this._testIds().length }
  }

  _testIds () { return (this.omniNode?.getAllNodes?.() ?? []).filter(n => typeof n.id === 'string' && n.id.startsWith(TEST_PREFIX)).map(n => n.id) }

  /**
   * Dev helper: N store item nodes (cycling the active store's products) and M value nodes (cycling the value types) on a grid in front of the
   * camera, ids prefixed `kt_` so removeTestNodes() can find them. Returns { ok, storeItems, values }.
   */
  createTestNodes (storeItems = 30, values = 20) {
    const st = Store.getStore(), types = Value.getTypes()
    const cam = this.ctx.camera
    const dir = new THREE.Vector3(); cam.getWorldDirection(dir); dir.y = 0; if (dir.lengthSq() < 1e-6) dir.set(0, 0, -1); dir.normalize()
    const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize()
    const base = cam.position.clone().addScaledVector(dir, 12)
    const nS = Math.max(0, Math.min(200, Math.round(+storeItems || 0))), nV = Math.max(0, Math.min(50, Math.round(+values || 0)))
    const at = (i, row) => { const c = i % 10, r = Math.floor(i / 10) + row; const p = base.clone().addScaledVector(right, (c - 4.5) * 1.6); return [p.x, 0.6 + r * 1.5, p.z] }
    let a = 0, b = 0
    for (let i = 0; i < nS && st.products.length; i++) { if (this.pin({ kind: Kinds.KIND_STORE_ITEM, storeId: st.id, productId: st.products[i % st.products.length].id }, { id: `${TEST_PREFIX}s${i}_${newId().slice(5)}`, position: at(i, 0) }).ok) a++ }
    const rows = Math.ceil(nS / 10)
    for (let i = 0; i < nV && types.length; i++) { if (this.pin({ kind: Kinds.KIND_VALUE, valueTypeId: types[i % types.length].id }, { id: `${TEST_PREFIX}v${i}_${newId().slice(5)}`, position: at(i, rows + 1) }).ok) b++ }
    return { ok: true, storeItems: a, values: b }
  }

  removeTestNodes () {
    const ids = this._testIds()
    ids.forEach(id => window.dispatchEvent(new CustomEvent('omni:node-delete-request', { detail: { id } })))
    return { ok: true, removed: ids.length }
  }
}
