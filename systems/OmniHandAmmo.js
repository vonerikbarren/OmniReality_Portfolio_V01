/**
 * systems/OmniHandAmmo.js — ⟐LogicalHand / ⟐CreativeHand "ammo" (V165)
 *
 * The node BEHAVIOURS (systems/OmniNodeBehavior.js, 34 of them) are the AMMO of the two
 * lower hands, "in terms of communication styles". Each hand carries a MAGAZINE (a list
 * of behaviour names, persisted in utils/OmniHandsSettings.js as `magazine`) and one
 * CURRENT ammo (`ammo`). The ◎/✦ Activation satellite on the pad FIRES the current ammo
 * at a target node: the behaviour is attached to that node with
 * `behavior.source = 'hand:lh' | 'hand:rh'`, so a hand-fired behaviour is always
 * distinguishable from a user-authored one.
 *
 * Fire rules (fire(hand)):
 *   target     the currently selected node (omni:node-selected). OmniTargeting /
 *              OmniAimReticle expose no aim query of their own (the reticle only decorates
 *              the selection), so "the node under the reticle" IS the selection. With no
 *              selection: the node nearest the screen-centre ray (within CENTER_CONE_DEG).
 *              Nothing found -> feedback 'no-target', nothing changes.
 *   same ammo at the same target again, while it is still the hand's own hand-fired
 *              behaviour -> UN-FIRE (the behaviour is removed, rest pose restored).
 *   a target that already carries a USER-authored behaviour (no `source`) is never
 *              overwritten -> feedback 'blocked'. (A node holds exactly one behaviour.)
 *   a target carrying the OTHER hand's / another ammo's hand-fired behaviour is replaced.
 *   per-hand cap `maxActive` (default 8): firing past it releases that hand's OLDEST.
 *   two-node behaviours (needs 'target' / 'targets': Orbit, Follow, Attract...) are
 *              attached TO the target node and given the hand's "anchor": the nearest other
 *              node(s) to the target (`anchorMode` 'nearest', default; 'none' attaches with
 *              no pair, `anchorCount` nodes for multi-target rows, 1 for single-target).
 *              The engine resolves targets by node id only, so the camera cannot be a pair.
 *   tracer     a short-lived THREE.Line from the hand's screen corner to the target,
 *              class-coloured, tweened out and disposed (never more than MAX_TRACERS).
 *
 * Events consumed (window):
 *   omni:hand-activate        { hand }        pad Activation press (lh / rh only here)
 *   omni:hand-ammo-cycle      { hand, dir }   next (+1) / previous (-1) loaded ammo
 *   omni:hand-ammo-release-all{ hand }        un-fire every behaviour that hand fired
 *   omni:hand-ammo-request    {}              re-announce omni:hand-ammo-state for both hands
 *   omni:node-selected        { node, mesh }
 *   omni:node-behavior-changed{ nodeId, behavior }   (keeps the registry honest)
 *   omni:node-deleted / omni:nodes-updated / omni:node-restored  (drop / adopt hand-sourced)
 *   omni:hands-settings-changed (magazine / ammo / maxActive changes re-announce state)
 * Events dispatched (window):
 *   omni:node-behavior-set    { nodeId, behavior|null }   (the engine's own input event)
 *   omni:hand-ammo-state      { hand, ammo, magazine, active:[{nodeId,type}], max }
 *   omni:hand-ammo-feedback   { hand, kind:'fired'|'released'|'no-target'|'empty'|'blocked', type?, nodeId? }
 *
 * Module contract: constructor(context) / init / update / destroy / onResize.
 */

import * as THREE from 'three'
import gsap from 'gsap'
import { BEHAVIOR_TABLE, behaviorDefaults, behaviorClassColorHex } from './OmniNodeBehavior.js'
import { getHandSetting, setHandSetting, CHANGE_EVENT } from '../utils/OmniHandsSettings.js'

export const AMMO_HANDS = ['lh', 'rh']
export const CENTER_CONE_DEG = 25
export const MAX_TRACERS = 8
const sourceOf = (hand) => `hand:${hand}`

export default class OmniHandAmmo {
  constructor (context) {
    this.ctx = context
    this._engine = null
    this._active = { lh: [], rh: [] }     // per hand, oldest first: { nodeId, type }
    this._known = new Map()               // nodeId -> last behaviour seen (fallback when no engine is wired)
    this._selected = null                 // { id, mesh, data }
    this._tracers = new Set()
    this._bound = []
    this._v = new THREE.Vector3()
    this._f = new THREE.Vector3()
  }

  /** Optional: the OmniNodeBehavior instance (reads current behaviours exactly). */
  setBehaviorEngine (engine) { this._engine = engine }

  init () {
    if (this._bound.length) return
    const on = (n, fn) => { window.addEventListener(n, fn); this._bound.push([n, fn]) }
    on('omni:hand-activate', (e) => { const h = e.detail?.hand; if (AMMO_HANDS.includes(h)) this.fire(h) })
    on('omni:hand-ammo-cycle', (e) => { const h = e.detail?.hand; if (AMMO_HANDS.includes(h)) this.cycle(h, e.detail?.dir === -1 ? -1 : 1) })
    on('omni:hand-ammo-request', () => AMMO_HANDS.forEach(h => this._emitState(h)))
    on('omni:hand-ammo-release-all', (e) => { const h = e.detail?.hand; if (AMMO_HANDS.includes(h)) this.releaseAll(h) })
    on('omni:node-selected', (e) => {
      const { node, mesh } = e.detail ?? {}
      this._selected = node?.id && mesh ? { id: node.id, mesh, data: node } : null
      if (node?.id && node.behavior) this._known.set(node.id, node.behavior)
      this._adopt(node?.id, node?.behavior)
    })
    on('omni:node-behavior-changed', (e) => {
      const { nodeId, behavior } = e.detail ?? {}
      if (!nodeId) return
      if (behavior) this._known.set(nodeId, behavior); else this._known.delete(nodeId)
      this._reconcile(nodeId, behavior)
    })
    on('omni:node-deleted', (e) => { const id = e.detail?.id; if (id) { this._known.delete(id); this._drop(id) } })
    on('omni:node-restored', (e) => { const n = e.detail?.node; if (n?.id) this._adopt(n.id, n.behavior) })
    on('omni:nodes-updated', (e) => { (e.detail?.nodes ?? []).forEach(n => { if (n?.id) this._adopt(n.id, n.behavior) }) })
    on(CHANGE_EVENT, (e) => {
      const { hand, key } = e.detail ?? {}
      if (!AMMO_HANDS.includes(hand)) return
      if (key === 'maxActive') this._enforceMax(hand)
      if (key === 'magazine' || key === 'ammo' || key === 'maxActive') this._emitState(hand)
    })
  }

  update () {}
  onResize () {}

  destroy () {
    this._bound.forEach(([n, fn]) => window.removeEventListener(n, fn))
    this._bound.length = 0
    this._tracers.forEach(t => this._disposeTracer(t))
    this._tracers.clear()
    this._active = { lh: [], rh: [] }
  }

  // ── Magazine / ammo ─────────────────────────────────────────────────────────

  /** The hand's loaded behaviours, in stored order, minus names the engine does not know. */
  getMagazine (hand) {
    return (getHandSetting(hand, 'magazine') ?? []).filter(n => !!BEHAVIOR_TABLE[n])
  }

  /** The current ammo: the stored one if it is loaded, else the first loaded, else null. */
  getAmmo (hand) {
    const mag = this.getMagazine(hand)
    const cur = getHandSetting(hand, 'ammo')
    return mag.includes(cur) ? cur : (mag[0] ?? null)
  }

  getActive (hand) { return this._active[hand].map(a => ({ ...a })) }

  cycle (hand, dir = 1) {
    const mag = this.getMagazine(hand)
    if (!mag.length) { this._feedback(hand, 'empty'); return null }
    const i = Math.max(0, mag.indexOf(this.getAmmo(hand)))
    const next = mag[(i + (dir < 0 ? -1 : 1) + mag.length) % mag.length]
    setHandSetting(hand, 'ammo', next)       // announces omni:hands-settings-changed -> chip / panel refresh
    this._emitState(hand)
    return next
  }

  // ── Fire / release ──────────────────────────────────────────────────────────

  /** Press of the Activation satellite. Returns the feedback kind. */
  fire (hand) {
    const ammo = this.getAmmo(hand)
    if (!ammo) return this._feedback(hand, 'empty')
    const target = this.resolveTarget()
    if (!target) return this._feedback(hand, 'no-target', { type: ammo })
    const src = sourceOf(hand)
    const existing = this._behaviorOf(target.id)
    if (existing?.source === src && existing.type === ammo && this._active[hand].some(a => a.nodeId === target.id)) {
      this._setBehavior(target.id, null)
      this._drop(target.id)
      this._emitState(hand)
      return this._feedback(hand, 'released', { type: ammo, nodeId: target.id })
    }
    if (existing && !(typeof existing.source === 'string' && existing.source.startsWith('hand:'))) {
      return this._feedback(hand, 'blocked', { type: ammo, nodeId: target.id })
    }
    const row = BEHAVIOR_TABLE[ammo]
    const cfg = {
      type: ammo, params: behaviorDefaults(ammo), enabled: true, source: src,
      targets: this._anchorsFor(row, target, hand),
    }
    this._drop(target.id)                    // a replaced hand-fired behaviour leaves ITS hand's list
    this._setBehavior(target.id, cfg)       // the engine's omni:node-behavior-changed may already have adopted it
    if (!this._active[hand].some(a => a.nodeId === target.id)) this._active[hand].push({ nodeId: target.id, type: ammo })
    this._enforceMax(hand)
    this._trace(hand, target.mesh, ammo)
    this._emitState(hand)
    return this._feedback(hand, 'fired', { type: ammo, nodeId: target.id })
  }

  releaseAll (hand) {
    const list = this._active[hand].splice(0)
    list.forEach(a => this._setBehavior(a.nodeId, null))
    this._emitState(hand)
    return list.length
  }

  _enforceMax (hand) {
    const max = Math.max(1, Math.round(Number(getHandSetting(hand, 'maxActive')) || 8))
    const list = this._active[hand]
    let changed = false
    while (list.length > max) {
      const old = list.shift()
      this._setBehavior(old.nodeId, null)
      changed = true
    }
    if (changed) this._emitState(hand)
  }

  // ── Registry upkeep ─────────────────────────────────────────────────────────

  _drop (nodeId) {
    AMMO_HANDS.forEach(h => {
      const i = this._active[h].findIndex(a => a.nodeId === nodeId)
      if (i >= 0) { this._active[h].splice(i, 1); this._emitState(h) }
    })
  }

  /** A node's behaviour changed (by anyone): keep the per-hand lists truthful. */
  _reconcile (nodeId, behavior) {
    AMMO_HANDS.forEach(h => {
      const i = this._active[h].findIndex(a => a.nodeId === nodeId)
      if (i >= 0 && behavior?.source !== sourceOf(h)) { this._active[h].splice(i, 1); this._emitState(h) }   // removed, or the user took the node over
    })
    this._adopt(nodeId, behavior)
  }

  /** A hand-sourced behaviour we did not fire this session (reloaded scene): track it so Release all / the cap see it. */
  _adopt (nodeId, behavior) {
    const src = behavior?.source
    if (!nodeId || typeof src !== 'string') return
    const hand = AMMO_HANDS.find(h => sourceOf(h) === src)
    if (!hand || this._active[hand].some(a => a.nodeId === nodeId)) return
    this._active[hand].push({ nodeId, type: behavior.type })
    this._emitState(hand)
  }

  _behaviorOf (id) {
    if (this._engine?.getBehavior) return this._engine.getBehavior(id)
    return this._known.get(id) ?? (this._selected?.id === id ? this._selected.data?.behavior : null) ?? null
  }

  _setBehavior (id, behavior) {
    window.dispatchEvent(new CustomEvent('omni:node-behavior-set', { detail: { nodeId: id, behavior } }))
  }

  // ── Targeting ───────────────────────────────────────────────────────────────

  /** Selected node, else nearest-to-screen-centre node; null when neither exists. */
  resolveTarget () {
    const sel = this._selected
    if (sel?.mesh?.parent) return sel
    return this._centerNode()
  }

  _sceneNodes (exclude) {
    const out = []
    const kids = this.ctx?.scene?.children ?? []
    for (let i = 0; i < kids.length; i++) {
      const m = kids[i]
      const id = m.userData?.nodeId
      if (id && id !== exclude && m.visible !== false) out.push({ id, mesh: m, data: null })
    }
    return out
  }

  _centerNode () {
    const cam = this.ctx?.camera
    if (!cam) return null
    cam.updateMatrixWorld?.()
    cam.getWorldDirection(this._f)
    const cosMin = Math.cos(CENTER_CONE_DEG * Math.PI / 180)
    let best = null, bestCos = cosMin
    this._sceneNodes().forEach(n => {
      n.mesh.getWorldPosition(this._v)
      this._v.sub(cam.position)
      const len = this._v.length()
      if (len < 1e-6) return
      const c = this._v.dot(this._f) / len
      if (c > bestCos) { bestCos = c; best = n }
    })
    return best
  }

  /** The hand's anchor(s): nearest other node(s) to the target, per anchorMode / row.needs. */
  _anchorsFor (row, target, hand) {
    if (!row || row.needs === 'self' || getHandSetting(hand, 'anchorMode') === 'none') return []
    const count = row.needs === 'target' ? 1 : Math.max(1, Math.round(Number(getHandSetting(hand, 'anchorCount')) || 3))
    const tp = new THREE.Vector3()
    target.mesh.getWorldPosition(tp)
    const p = new THREE.Vector3()
    return this._sceneNodes(target.id)
      .map(n => { n.mesh.getWorldPosition(p); return { id: n.id, d: p.distanceToSquared(tp) } })
      .sort((a, b) => a.d - b.d)
      .slice(0, count)
      .map(n => n.id)
  }

  // ── Tracer (cheap, self-cleaning) ───────────────────────────────────────────

  _trace (hand, mesh, type) {
    const cam = this.ctx?.camera, scene = this.ctx?.scene
    if (!cam || !scene || !mesh) return
    while (this._tracers.size >= MAX_TRACERS) this._disposeTracer(this._tracers.values().next().value)
    cam.updateMatrixWorld?.()
    const start = new THREE.Vector3(hand === 'lh' ? -0.85 : 0.85, -0.85, 0.5).unproject(cam)
    const end = new THREE.Vector3()
    mesh.getWorldPosition(end)
    const pos = new Float32Array([start.x, start.y, start.z, start.x, start.y, start.z])
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    const mat = new THREE.LineBasicMaterial({ color: new THREE.Color(behaviorClassColorHex(type)), transparent: true, opacity: 1, depthTest: false })
    const line = new THREE.Line(geo, mat)
    line.frustumCulled = false
    line.renderOrder = 999
    scene.add(line)
    const tr = { line, geo, mat, tl: null, u: 0 }
    this._tracers.add(tr)
    tr.tl = gsap.timeline({ onComplete: () => { this._disposeTracer(tr) } })
    tr.tl.to(tr, {
      u: 1, duration: 0.18, ease: 'power2.out',
      onUpdate: () => {
        pos[3] = start.x + (end.x - start.x) * tr.u
        pos[4] = start.y + (end.y - start.y) * tr.u
        pos[5] = start.z + (end.z - start.z) * tr.u
        geo.attributes.position.needsUpdate = true
      },
    })
    tr.tl.to(mat, { opacity: 0, duration: 0.25, ease: 'power1.in' })
  }

  _disposeTracer (tr) {
    if (!tr || !this._tracers.has(tr)) return
    this._tracers.delete(tr)
    tr.tl?.kill()
    tr.line.parent?.remove(tr.line)
    tr.geo.dispose()
    tr.mat.dispose()
  }

  // ── Events out ──────────────────────────────────────────────────────────────

  _feedback (hand, kind, extra = {}) {
    window.dispatchEvent(new CustomEvent('omni:hand-ammo-feedback', { detail: { hand, kind, ...extra } }))
    return kind
  }

  _emitState (hand) {
    window.dispatchEvent(new CustomEvent('omni:hand-ammo-state', {
      detail: {
        hand, ammo: this.getAmmo(hand), magazine: this.getMagazine(hand),
        active: this.getActive(hand), max: getHandSetting(hand, 'maxActive'),
      },
    }))
  }
}
