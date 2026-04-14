/**
 * systems/NodeManager.js — ⟐mniReality Tree Traversal Engine
 *
 * The navigation brain of the ⟐mniReality. NodeManager sits between the raw
 * scene and every system that needs to know "where are we" and "what can be
 * seen". It owns three responsibilities:
 *
 *   1. TRAVERSAL — maintain a history stack of visited node IDs, expose
 *      navigate(id) / back() / forward() to move through the logic tree.
 *
 *   2. LOD VISIBILITY — every frame, walk all registered meshes and apply
 *      distance-based visibility tiers so only geometry near the camera costs
 *      GPU cycles (mirrors the three-tier strategy from PROJECT_STRUCTURE.md).
 *
 *   3. ORBIT BRIDGE — listen for omni:orbit-disable / omni:orbit-enable and
 *      forward them to OrbitModule. This is the single wiring point so
 *      OmniPresenter and OmniPocket don't need direct module references.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * No panel — NodeManager is a pure engine, no UI of its own.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Traversal model
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   The logic tree is a directed graph of nodes connected by edges.
 *   NodeManager maintains:
 *
 *     _current   : string | null   — ID of the node the camera inhabits now
 *     _back      : string[]        — undo stack  (most recent last)
 *     _forward   : string[]        — redo stack  (most recent last)
 *     _tree      : Map<id, TreeNode>  — adjacency list built from edges
 *
 *   TreeNode = { id, parentId, childIds: Set<string>, depth }
 *
 *   navigate(id)  — push current onto _back, clear _forward, set _current = id
 *   back()        — push current onto _forward, pop _back, set _current
 *   forward()     — push current onto _back,   pop _forward, set _current
 *
 *   Max history depth: HISTORY_MAX (default 64) — oldest entries drop off
 *   the tail when exceeded.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LOD distance tiers (from PROJECT_STRUCTURE.md)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   Tier 0 — NEAR   : distance < 50      → fully visible, full scale
 *   Tier 1 — MID    : 50 ≤ d < 500       → visible, dimmed (opacity 0.4)
 *   Tier 2 — FAR    : 500 ≤ d < 2000     → minimal (scale 0.3, opacity 0.15)
 *   Tier 3 — HIDDEN : distance ≥ 2000    → invisible (visible = false)
 *
 *   Applied every frame in update() to every mesh in _meshRegistry.
 *   Tier transitions use GSAP tweens so fades are smooth, not hard cuts.
 *   Only fires a tween when the tier actually changes — no per-frame GSAP spam.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Orbit bridge
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   OmniPresenter and OmniPocket dispatch:
 *     omni:orbit-disable  →  NodeManager calls this._orbitModule?.disable()
 *     omni:orbit-enable   →  NodeManager calls this._orbitModule?.enable()
 *
 *   OrbitModule reference is injected via:
 *     nodeManager.setOrbitModule(orbitMod)   ← called from main.js
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Mesh registry
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   OmniNode fires omni:node-created { node, mesh } — NodeManager registers
 *   the mesh automatically. omni:node-deleted { id } unregisters it.
 *
 *   External registration also available:
 *     nodeManager.registerMesh(id, mesh)
 *     nodeManager.unregisterMesh(id)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * GlobalBar integration
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   On every traversal event, NodeManager dispatches omni:space-changed so
 *   ui/index.js can call setSpaceName() and setSpaceEntry() — decoupling the
 *   engine from the UI shell entirely.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Events dispatched (window)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   omni:space-changed   { id, label, depth, canBack, canForward }
 *   omni:tree-updated    { tree: Map, current }
 *   omni:navigate        { from, to, direction: 'forward'|'back'|'jump' }
 *
 * Events consumed (window)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   omni:portal-activated  { id, label }       — portal sphere clicked
 *   omni:nodes-updated     { nodes, edges }    — OmniNode storage changed
 *   omni:node-created      { node, mesh }      — register new mesh
 *   omni:node-deleted      { id }              — unregister mesh
 *   omni:presenter-jump    { id, node }        — presenter free jump → navigate
 *   omni:presenter-step    { index, node }     — presenter step → navigate
 *   omni:pocket-shortcut   { id, node }        — pocket teleport → navigate
 *   omni:orbit-disable     {}                  — forward to OrbitModule
 *   omni:orbit-enable      {}                  — forward to OrbitModule
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Usage in main.js
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   import NodeManager from './systems/NodeManager.js'
 *
 *   const nodeManager = new NodeManager(base.context)
 *   nodeManager.init()
 *
 *   // After OrbitModule is created:
 *   nodeManager.setOrbitModule(orbitMod)
 *
 *   // In the render loop (base.addModule handles this automatically):
 *   nodeManager.update(delta)
 *
 * Follows the standard module contract (constructor / init / update / destroy).
 */

import * as THREE from 'three'
import gsap       from 'gsap'

// ── Traversal config ──────────────────────────────────────────────────────────

const HISTORY_MAX = 64   // max back/forward stack depth

// ── LOD distance thresholds (world units) ─────────────────────────────────────

const LOD_NEAR   =   50   // < 50    → full visibility
const LOD_MID    =  500   // < 500   → dimmed
const LOD_FAR    = 2000   // < 2000  → minimal
                          // ≥ 2000  → hidden

// ── LOD tier → visual properties ─────────────────────────────────────────────

const LOD_TIERS = [
  { id: 0, label: 'near',   opacity: 1.00, scale: 1.00, visible: true  },
  { id: 1, label: 'mid',    opacity: 0.45, scale: 1.00, visible: true  },
  { id: 2, label: 'far',    opacity: 0.14, scale: 0.30, visible: true  },
  { id: 3, label: 'hidden', opacity: 0.00, scale: 0.30, visible: false },
]

const LOD_TWEEN_DUR = 0.35   // s — tier transition fade duration

// ── localStorage key ──────────────────────────────────────────────────────────

const STORE_KEY = 'omni:nodemanager'

// ── Scratch objects (reused every frame to avoid GC pressure) ─────────────────

const _camPos  = new THREE.Vector3()
const _meshPos = new THREE.Vector3()

// ─────────────────────────────────────────────────────────────────────────────
// NodeManager class
// ─────────────────────────────────────────────────────────────────────────────

export default class NodeManager {

  /**
   * @param {object} context  — { scene, camera, renderer, sizes, ticker }
   */
  constructor (context) {
    this.ctx = context

    // ── Traversal state ────────────────────────────────────────────────
    this._current  = null   // current node ID (null = Root / unset)
    this._back     = []     // history stack — push on navigate, pop on back()
    this._forward  = []     // redo stack    — push on back(),   pop on forward()

    // ── Tree structure ─────────────────────────────────────────────────
    // Map<id, { id, label, parentId, childIds: Set<string>, depth }>
    this._tree     = new Map()

    // ── Node data shadow ───────────────────────────────────────────────
    // Map<id, nodeData>  — kept in sync with omni:nodes-updated
    this._nodeMap  = new Map()

    // ── Mesh registry ──────────────────────────────────────────────────
    // Map<id, { mesh: THREE.Object3D, tier: 0|1|2|3, tweening: bool }>
    this._meshRegistry = new Map()

    // ── Orbit module reference (injected via setOrbitModule) ───────────
    this._orbitModule  = null

    // ── LOD frame throttle — recalculate every N frames to save CPU ────
    this._lodFrame      = 0
    this._lodInterval   = 3   // recalculate every 3 frames

    // ── Bound event handlers ───────────────────────────────────────────
    this._onPortal      = null
    this._onNodesUp     = null
    this._onNodeCreated = null
    this._onNodeDeleted = null
    this._onPresJump    = null
    this._onPresStep    = null
    this._onPocketShort = null
    this._onOrbitDis    = null
    this._onOrbitEn     = null
  }

  // ── Module contract ──────────────────────────────────────────────────────

  init () {
    this._bindEvents()
    this._loadHistory()
    this._refreshNodeMap()
    this._rebuildTree()
    console.log('⟐ NodeManager — initialised.')
  }

  /**
   * Called every frame by BaseScene render loop.
   * Drives LOD tier evaluation on a throttled cadence.
   * @param {number} _delta
   */
  update (_delta) {
    this._lodFrame++
    if (this._lodFrame % this._lodInterval !== 0) return
    if (this._meshRegistry.size === 0) return
    this._evaluateLOD()
  }

  destroy () {
    window.removeEventListener('omni:portal-activated',  this._onPortal)
    window.removeEventListener('omni:nodes-updated',     this._onNodesUp)
    window.removeEventListener('omni:node-created',      this._onNodeCreated)
    window.removeEventListener('omni:node-deleted',      this._onNodeDeleted)
    window.removeEventListener('omni:presenter-jump',    this._onPresJump)
    window.removeEventListener('omni:presenter-step',    this._onPresStep)
    window.removeEventListener('omni:pocket-shortcut',   this._onPocketShort)
    window.removeEventListener('omni:orbit-disable',     this._onOrbitDis)
    window.removeEventListener('omni:orbit-enable',      this._onOrbitEn)
  }

  // ── Public API ───────────────────────────────────────────────────────────

  /**
   * Inject the OrbitModule instance so NodeManager can relay orbit control
   * events dispatched by OmniPresenter and OmniPocket.
   * Call from main.js immediately after creating both modules.
   *
   * @param {object} orbitModule  — OrbitModule instance with enable()/disable()
   */
  setOrbitModule (orbitModule) {
    this._orbitModule = orbitModule
  }

  /**
   * Navigate to a node by ID.
   * Pushes the current node onto the back stack, clears forward stack.
   *
   * @param {string} id        — target node ID
   * @param {'jump'|'forward'|'back'} [direction='jump']
   */
  navigate (id, direction = 'jump') {
    if (!id) return
    if (id === this._current) return

    const from = this._current

    if (direction === 'jump' || direction === 'forward') {
      if (from !== null) {
        this._back.push(from)
        if (this._back.length > HISTORY_MAX) this._back.shift()
      }
      if (direction === 'jump') this._forward = []
    }

    this._current = id
    this._saveHistory()
    this._onTraversal(from, id, direction)
  }

  /**
   * Navigate backward one step in history.
   * @returns {boolean} true if navigation occurred
   */
  back () {
    if (this._back.length === 0) return false
    const from = this._current
    const to   = this._back.pop()
    this._forward.push(from)
    if (this._forward.length > HISTORY_MAX) this._forward.shift()
    this._current = to
    this._saveHistory()
    this._onTraversal(from, to, 'back')
    return true
  }

  /**
   * Navigate forward one step (re-do).
   * @returns {boolean} true if navigation occurred
   */
  forward () {
    if (this._forward.length === 0) return false
    const from = this._current
    const to   = this._forward.pop()
    this._back.push(from)
    if (this._back.length > HISTORY_MAX) this._back.shift()
    this._current = to
    this._saveHistory()
    this._onTraversal(from, to, 'forward')
    return true
  }

  /**
   * Return the current node's data object, or null if none.
   * @returns {object|null}
   */
  get currentNode () {
    return this._current ? (this._nodeMap.get(this._current) ?? null) : null
  }

  /** Whether a back step is available. */
  get canBack ()    { return this._back.length > 0 }

  /** Whether a forward step is available. */
  get canForward () { return this._forward.length > 0 }

  /**
   * Manually register a mesh under a node ID for LOD management.
   * OmniNode calls this automatically via the omni:node-created event.
   *
   * @param {string}          id
   * @param {THREE.Object3D}  mesh
   */
  registerMesh (id, mesh) {
    if (!id || !mesh) return
    this._meshRegistry.set(id, { mesh, tier: -1, tweening: false })
  }

  /**
   * Unregister a mesh. Called automatically on omni:node-deleted.
   * @param {string} id
   */
  unregisterMesh (id) {
    this._meshRegistry.delete(id)
  }

  /**
   * Return a snapshot of the current traversal state.
   * @returns {{ current, back: string[], forward: string[], depth: number }}
   */
  getState () {
    return {
      current  : this._current,
      back     : [...this._back],
      forward  : [...this._forward],
      depth    : this._treeDepth(this._current),
    }
  }

  /**
   * Return all IDs in traversal order (back → current → forward).
   * Useful for debugging or feeding a breadcrumb trail UI.
   * @returns {string[]}
   */
  getBreadcrumb () {
    const crumb = [...this._back]
    if (this._current) crumb.push(this._current)
    return crumb
  }

  /**
   * Return the tree node record for a given ID.
   * @param {string} id
   * @returns {{ id, label, parentId, childIds: Set, depth }|undefined}
   */
  getTreeNode (id) {
    return this._tree.get(id)
  }

  // ── Tree building ─────────────────────────────────────────────────────────

  /**
   * Rebuild the in-memory adjacency tree from the current node map and
   * edge list stored in localStorage.
   * Called on init and whenever omni:nodes-updated fires.
   */
  _rebuildTree () {
    this._tree.clear()

    // Seed tree nodes from node map
    for (const [id, node] of this._nodeMap) {
      this._tree.set(id, {
        id,
        label    : node.label ?? id,
        parentId : node.parentId ?? null,
        childIds : new Set(),
        depth    : 0,
      })
    }

    // Load edges and wire parent→child relationships
    try {
      const raw = localStorage.getItem('omni:edges')
      if (raw) {
        const edges = JSON.parse(raw)
        for (const { from, to } of edges) {
          const parent = this._tree.get(from)
          const child  = this._tree.get(to)
          if (parent && child) {
            parent.childIds.add(to)
            if (!child.parentId) child.parentId = from
          }
        }
      }
    } catch { /* silent */ }

    // Assign depth values via BFS from roots (nodes with no parentId)
    const roots = [...this._tree.values()].filter(n => !n.parentId)
    const queue = roots.map(r => ({ id: r.id, depth: 0 }))
    const seen  = new Set()

    while (queue.length > 0) {
      const { id, depth } = queue.shift()
      if (seen.has(id)) continue
      seen.add(id)

      const node = this._tree.get(id)
      if (node) {
        node.depth = depth
        for (const childId of node.childIds) {
          if (!seen.has(childId)) queue.push({ id: childId, depth: depth + 1 })
        }
      }
    }

    window.dispatchEvent(new CustomEvent('omni:tree-updated', {
      detail: { tree: this._tree, current: this._current }
    }))
  }

  /**
   * Compute depth of a node from root. Returns 0 if id is null/unknown.
   * @param {string|null} id
   * @returns {number}
   */
  _treeDepth (id) {
    if (!id) return 0
    return this._tree.get(id)?.depth ?? 0
  }

  // ── LOD evaluation ────────────────────────────────────────────────────────

  /**
   * Walk the mesh registry and apply distance-based visibility tiers.
   * Runs every LOD_INTERVAL frames, not every frame, for CPU efficiency.
   */
  _evaluateLOD () {
    this.ctx.camera.getWorldPosition(_camPos)

    for (const [id, entry] of this._meshRegistry) {
      const { mesh } = entry
      if (!mesh) continue

      // Skip meshes extracted by OmniPocket (they are intentionally hidden)
      if (!mesh.visible && entry.tier === 3) continue

      // Get mesh world position
      mesh.getWorldPosition(_meshPos)
      const dist = _camPos.distanceTo(_meshPos)

      // Resolve tier
      const newTier =
        dist < LOD_NEAR  ? 0 :
        dist < LOD_MID   ? 1 :
        dist < LOD_FAR   ? 2 : 3

      if (newTier === entry.tier) continue   // no change — skip
      if (entry.tweening) continue           // mid-transition — let it finish

      this._applyLODTier(id, entry, newTier)
    }
  }

  /**
   * Apply a LOD tier to a registered mesh entry with a GSAP transition.
   * @param {string}  id
   * @param {object}  entry   — { mesh, tier, tweening }
   * @param {number}  newTier — 0 | 1 | 2 | 3
   */
  _applyLODTier (id, entry, newTier) {
    const tier = LOD_TIERS[newTier]
    const mesh = entry.mesh

    entry.tier     = newTier
    entry.tweening = true

    // Tier 3 — hidden: fade out then set visible=false
    if (newTier === 3) {
      const mat = mesh.material
      if (mat) {
        const prevTransparent = mat.transparent
        mat.transparent = true
        gsap.to(mat, {
          opacity  : 0,
          duration : LOD_TWEEN_DUR,
          ease     : 'power1.inOut',
          onComplete: () => {
            mesh.visible       = false
            mat.transparent    = prevTransparent
            entry.tweening     = false
          }
        })
      } else {
        mesh.visible   = false
        entry.tweening = false
      }
      return
    }

    // Tiers 0–2 — visible: ensure mesh is shown, then tween opacity + scale
    mesh.visible = true
    const mat = mesh.material

    if (mat) {
      mat.transparent = tier.opacity < 1
      gsap.to(mat, {
        opacity  : tier.opacity,
        duration : LOD_TWEEN_DUR,
        ease     : 'power1.inOut',
        onComplete: () => {
          // Only lock transparent=false when fully opaque to avoid z-fighting
          if (tier.opacity >= 1) mat.transparent = false
          entry.tweening = false
        }
      })
    } else {
      entry.tweening = false
    }

    // Scale down for far-tier minimised representation
    gsap.to(mesh.scale, {
      x: tier.scale, y: tier.scale, z: tier.scale,
      duration : LOD_TWEEN_DUR,
      ease     : 'power1.inOut',
    })
  }

  // ── Traversal event emission ──────────────────────────────────────────────

  /**
   * Called after every navigation (forward, back, jump).
   * Dispatches events consumed by ui/index.js, TreeView, MiniMap, etc.
   *
   * @param {string|null} from
   * @param {string}      to
   * @param {string}      direction
   */
  _onTraversal (from, to, direction) {
    const toNode  = this._nodeMap.get(to)
    const depth   = this._treeDepth(to)
    const label   = toNode?.label ?? to

    // Brief GSAP pulse on all near meshes at the destination to signal arrival
    const destEntry = this._meshRegistry.get(to)
    if (destEntry?.mesh) {
      const m = destEntry.mesh
      gsap.fromTo(m.scale,
        { x: 1.25, y: 1.25, z: 1.25 },
        { x: 1,    y: 1,    z: 1,    duration: 0.55, ease: 'elastic.out(1, 0.5)' }
      )
    }

    window.dispatchEvent(new CustomEvent('omni:navigate', {
      detail: { from, to, direction }
    }))

    window.dispatchEvent(new CustomEvent('omni:space-changed', {
      detail: {
        id         : to,
        label,
        depth,
        canBack    : this.canBack,
        canForward : this.canForward,
        treeNode   : this._tree.get(to) ?? null,
      }
    }))

    // Feed GlobalBar — resolved by ui/index.js listening to omni:space-changed
    console.log(`⟐ NodeManager — navigated ${direction}: ${from ?? 'root'} → ${to} (${label}, depth ${depth})`)
  }

  // ── Event listeners ───────────────────────────────────────────────────────

  _bindEvents () {

    // ── Portal sphere activated (PortalSpheres.js Phase 2) ─────────────
    this._onPortal = (e) => {
      const { id, label } = e.detail ?? {}
      if (id) this.navigate(id, 'jump')
    }

    // ── Nodes updated (OmniNode saves) — rebuild tree ──────────────────
    this._onNodesUp = (e) => {
      const { nodes = [] } = e.detail ?? {}
      this._nodeMap.clear()
      nodes.forEach(n => this._nodeMap.set(n.id, n))
      this._rebuildTree()
    }

    // ── Mesh registry — auto-wire new nodes ────────────────────────────
    this._onNodeCreated = (e) => {
      const { node, mesh } = e.detail ?? {}
      if (node?.id && mesh) {
        this.registerMesh(node.id, mesh)
      }
    }

    this._onNodeDeleted = (e) => {
      const { id } = e.detail ?? {}
      if (id) {
        this.unregisterMesh(id)
        this._tree.delete(id)
        this._nodeMap.delete(id)
        // Prune from history stacks
        this._back    = this._back.filter(v => v !== id)
        this._forward = this._forward.filter(v => v !== id)
        if (this._current === id) {
          this._current = this._back.pop() ?? null
        }
        this._saveHistory()
      }
    }

    // ── OmniPresenter jump / step → navigate ───────────────────────────
    this._onPresJump = (e) => {
      const { id } = e.detail ?? {}
      if (id && id !== this._current) this.navigate(id, 'jump')
    }

    this._onPresStep = (e) => {
      const { node } = e.detail ?? {}
      if (node?.id && node.id !== this._current) this.navigate(node.id, 'forward')
    }

    // ── OmniPocket shortcut teleport → navigate ────────────────────────
    this._onPocketShort = (e) => {
      const { id } = e.detail ?? {}
      if (id && id !== this._current) this.navigate(id, 'jump')
    }

    // ── Orbit bridge — relay to OrbitModule ────────────────────────────
    this._onOrbitDis = () => {
      this._orbitModule?.disable?.()
    }

    this._onOrbitEn = () => {
      this._orbitModule?.enable?.()
    }

    window.addEventListener('omni:portal-activated',  this._onPortal)
    window.addEventListener('omni:nodes-updated',     this._onNodesUp)
    window.addEventListener('omni:node-created',      this._onNodeCreated)
    window.addEventListener('omni:node-deleted',      this._onNodeDeleted)
    window.addEventListener('omni:presenter-jump',    this._onPresJump)
    window.addEventListener('omni:presenter-step',    this._onPresStep)
    window.addEventListener('omni:pocket-shortcut',   this._onPocketShort)
    window.addEventListener('omni:orbit-disable',     this._onOrbitDis)
    window.addEventListener('omni:orbit-enable',      this._onOrbitEn)
  }

  // ── Node map bootstrap ────────────────────────────────────────────────────

  _refreshNodeMap () {
    try {
      const raw = localStorage.getItem('omni:nodes')
      if (!raw) return
      JSON.parse(raw).forEach(n => this._nodeMap.set(n.id, n))
    } catch { /* silent */ }
  }

  // ── History persistence ───────────────────────────────────────────────────

  _saveHistory () {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({
        current : this._current,
        back    : this._back,
        forward : this._forward,
      }))
    } catch (err) {
      console.warn('⟐ NodeManager — history save failed:', err)
    }
  }

  _loadHistory () {
    try {
      const raw = localStorage.getItem(STORE_KEY)
      if (!raw) return
      const data = JSON.parse(raw)
      this._current = data.current ?? null
      this._back    = Array.isArray(data.back)    ? data.back    : []
      this._forward = Array.isArray(data.forward) ? data.forward : []
    } catch (err) {
      console.warn('⟐ NodeManager — history load failed:', err)
    }
  }
}
