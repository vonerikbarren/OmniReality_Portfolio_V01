/**
 * systems/TerminalShellNodes.js — the runtime of the TerminalShellTunnel node kind (V192).
 *
 * The model (shell records, the master on/off, focus) is utils/TerminalShells.js; the node kind (data.nodeKind 'terminalShell', a small tube marker
 * mesh) is utils/OmniExtraKinds.js; the in-scene terminal itself is modules/TerminalShellTunnel.js. This module joins them:
 *
 *   - every TerminalShellTunnel NODE in the scene gets one TerminalShellTunnel instance (a tunnel + terminal panel that moves with the node);
 *     when the node is deleted its instance and its record go with it. Several nodes are allowed (utils/TerminalShells.js MAX_SHELLS).
 *   - they all follow the one master on/off, exactly like the built-in tunnel (modules/TerminalTunnel.js): a Terminal button toggles ALL of them.
 *   - Events   omni:terminal-shell-create-request { name?, position?, orientation?, select? }   (the answer is written to detail.out)
 *              omni:terminal-shell-delete-request { nodeId }
 *
 * Module contract: constructor(context, omniNode) / init (guarded against a second call) / update(delta) / destroy / onResize.
 */

import * as THREE from 'three'
import TerminalShellTunnel from '../modules/TerminalShellTunnel.js'
import * as Shells from '../utils/TerminalShells.js'
import { KIND_TERMINAL_SHELL, GEO_TERMINAL_SHELL, SERVICES } from '../utils/OmniExtraKinds.js'

const SYNC_INTERVAL = 1
const PIN_DISTANCE = 12
const newId = () => 'omni_' + Math.random().toString(36).slice(2, 8)
const note = (name, desc) => { try { window.dispatchEvent(new CustomEvent('omni:notify-info', { detail: { name, desc, holdMs: 3000 } })) } catch (_) { /* no window */ } }

export default class TerminalShellNodes {
  constructor (context, omniNode = null) {
    this.ctx = context
    this.omniNode = omniNode
    this._inited = 0
    this._bound = []
    this._shells = new Map()   // nodeId -> TerminalShellTunnel
    this._acc = 0
  }

  init () {
    this._inited++
    if (this._inited > 1) return   // BaseScene.addModule() calls init(); a second call must not double the listeners
    const on = (name, fn) => { const h = (e) => fn(e.detail ?? {}, e); window.addEventListener(name, h); this._bound.push([name, h]) }
    on('omni:node-created', () => this._sync())
    on('omni:node-deleted', (d) => this._onDeleted(d.id))
    on('omni:nodes-updated', () => this._sync())
    on('omni:node-updated', () => this._sync())   // a label edited in the Inspector renames the shell
    on('omni:scene-clear-request', () => { for (const id of [...this._shells.keys()]) this._drop(id, true); for (const s of Shells.listShells()) Shells.deleteShell(s.id) })
    on('omni:terminal-shell-create-request', (d, e) => { const out = this.createShellNode(d); if (e.detail && typeof e.detail === 'object') e.detail.out = out })
    on('omni:terminal-shell-delete-request', (d) => { if (d.nodeId) this.deleteShellNode(d.nodeId) })
    on(Shells.CHANGED_EVENT, (d) => { if (d.reason === 'rename') this._renameNode(d.id) })
    SERVICES.shells = this
    this._sync()
  }

  update (delta) {
    this._acc += delta || 0
    if (this._acc >= SYNC_INTERVAL) { this._acc = 0; this._sync() }
    this._shells.forEach(t => t.update(delta))
  }

  onResize () {}

  destroy () {
    if (!this._inited) return
    this._bound.forEach(([n, h]) => window.removeEventListener(n, h))
    this._bound = []
    this._shells.forEach(t => t.destroy())
    this._shells.clear()
    if (SERVICES.shells === this) SERVICES.shells = null
    this._inited = 0
  }

  // ── Reading the scene ───────────────────────────────────────────────────────

  /** Make the instances match the TerminalShellTunnel nodes that exist. Cheap; safe to call at any time. */
  _sync () {
    let nodes = []
    try { nodes = (this.omniNode?.getAllNodes?.() ?? []).filter(d => d?.nodeKind === KIND_TERMINAL_SHELL) } catch (_) { nodes = [] }
    const live = new Set(nodes.map(d => d.id))
    for (const id of [...this._shells.keys()]) if (!live.has(id)) this._drop(id, true)   // the node is gone (deleted, or the scene was cleared): its shell goes with it
    for (const d of nodes) {
      const rec = Shells.ensureShell(d.shellId, d.id, d.label)
      if (rec && d.label && rec.name !== d.label) Shells.renameShell(rec.id, d.label)   // the node's label is the name
      if (!rec || this._shells.has(d.id)) continue
      const t = new TerminalShellTunnel(this.ctx, { shellId: rec.id, nodeId: d.id, omniNode: this.omniNode })
      t.init()
      this._shells.set(d.id, t)
    }
  }

  _drop (nodeId, deleteRecord) {
    const t = this._shells.get(nodeId)
    if (t) { t.destroy(); this._shells.delete(nodeId) }
    if (deleteRecord) { const s = Shells.shellByNode(nodeId); if (s) Shells.deleteShell(s.id) }
  }

  _onDeleted (id) {
    if (!id) return
    this._drop(id, true)
    const s = Shells.shellByNode(id)
    if (s) Shells.deleteShell(s.id)
  }

  _renameNode (shellId) {
    const s = Shells.getShell(shellId)
    if (s?.nodeId) window.dispatchEvent(new CustomEvent('omni:node-label-set', { detail: { id: s.nodeId, label: s.name } }))
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /** The TerminalShellTunnel instances (one per node). */
  getInstances () { return [...this._shells.values()] }
  getInstance (nodeId) { return this._shells.get(nodeId) ?? null }
  get count () { return this._shells.size }
  /** For tests / the dev panel. */
  getStats () { return { nodes: this._shells.size, visible: [...this._shells.values()].filter(t => t.isShown()).length, on: Shells.isOn() } }

  _frontOfCamera () {
    const cam = this.ctx.camera
    const dir = new THREE.Vector3(); cam.getWorldDirection(dir)
    const p = cam.position.clone().addScaledVector(dir, PIN_DISTANCE)
    return [p.x, Math.max(1.5, p.y), p.z]
  }

  _nextName () {
    const names = new Set(Shells.listShells().map(s => s.name))
    if (!names.has(Shells.SHELL_LABEL)) return Shells.SHELL_LABEL
    for (let i = 2; i < 99; i++) if (!names.has(`${Shells.SHELL_LABEL} ${i}`)) return `${Shells.SHELL_LABEL} ${i}`
    return Shells.SHELL_LABEL
  }

  /** New shell record + its TerminalShellTunnel node. Returns { ok, shellId, nodeId } or { ok:false, error }. */
  createShellNode (opts = {}) {
    try {
      const r = Shells.createShell({ name: opts.name || this._nextName(), orientation: opts.orientation ?? null })
      if (!r.ok) { note('TerminalShellTunnel', r.error); return r }
      const nodeId = newId()
      Shells.setNodeId(r.shell.id, nodeId)   // before the node exists, so a delete can always find its record
      window.dispatchEvent(new CustomEvent('omni:node-create-request', { detail: {
        nodeKind: KIND_TERMINAL_SHELL, shellId: r.shell.id, id: nodeId, label: r.shell.name, geometry: GEO_TERMINAL_SHELL, primitive: 'objective', color: '#7fd8ff',
        position: opts.position ?? this._frontOfCamera(), rotation: [0, 0, 0], scale: [1, 1, 1], noParent: true, noSelect: opts.select !== true,
      } }))
      if (this.omniNode && !this.omniNode.getNodeData?.(nodeId)) {
        // the request was refused: do not leave a record without its node
        Shells.deleteShell(r.shell.id)
        return { ok: false, error: 'The TerminalShellTunnel node could not be created.' }
      }
      this._sync()
      return { ok: true, shellId: r.shell.id, nodeId }
    } catch (err) { return { ok: false, error: String(err?.message ?? err) } }
  }

  deleteShellNode (nodeId) {
    if (!nodeId || !this.omniNode?.getNodeData?.(nodeId)) return false
    window.dispatchEvent(new CustomEvent('omni:node-delete-request', { detail: { id: nodeId } }))
    return true
  }
}
