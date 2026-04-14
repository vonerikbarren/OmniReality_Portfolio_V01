/**
 * data/NodeLoader.js — ⟐mniReality Data Layer
 *
 * Loads node JSON files (conforming to node.schema.json Shape 1) into the live
 * Three.js scene, wires every loaded node into NodeManager, and manages the mesh
 * lifecycle across a depth-based lazy-load window as the user traverses the tree.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Responsibilities
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   1. PARSE     — fetch or accept a Shape 1 node object, validate all required
 *                  fields, reject bad data with clear errors before any Three.js
 *                  work happens.
 *
 *   2. HYDRATE   — build a Three.js mesh from the node's geometry and primitive
 *                  type using the same GEOMETRY_DEFS factories and material
 *                  parameters as OmniNode, so loader-managed nodes and
 *                  user-created nodes are visually indistinguishable.
 *
 *   3. PERSIST   — write accepted nodes to 'omni:loader:nodes' (localStorage).
 *                  Never writes to 'omni:nodes' — that key is owned by OmniNode.
 *                  No risk of duplicate meshes when OmniNode._load() runs.
 *
 *   4. WIRE      — dispatch omni:node-created { node, mesh } so NodeManager
 *                  auto-registers every mesh for LOD management.
 *                  Dispatch omni:nodes-updated { nodes, edges } with the full
 *                  merged set (loader nodes + OmniNode nodes from localStorage)
 *                  so NodeManager._rebuildTree() keeps an accurate adjacency map.
 *
 *   5. LAZY      — listen to omni:navigate. On every navigation, walk the loader
 *                  registry and apply the depth window against the new current
 *                  node via a BFS through NodeManager's tree:
 *
 *                    depth 0 — current              → ensure loaded (sync)
 *                    depth 1 — neighbours           → ensure loaded (sync)
 *                    depth 2 — near                 → load deferred (queue)
 *                    depth ≥ 3 — distant            → unload mesh (dispose)
 *
 *                  Unloading calls nodeManager.unregisterMesh() directly —
 *                  NOT omni:node-deleted — so NodeManager never prunes the
 *                  node from its history stacks or tree.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Storage
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   omni:loader:nodes   — JSON array of Shape 1 objects managed by NodeLoader.
 *                         Read on destroy / session restore.
 *                         Never read by OmniNode.
 *
 *   omni:nodes          — READ ONLY from NodeLoader's perspective. Written by
 *                         OmniNode. Read here to build the merged node set for
 *                         omni:nodes-updated broadcasts.
 *
 *   omni:edges          — READ ONLY from NodeLoader's perspective. Written by
 *                         OmniNode. Forwarded in omni:nodes-updated broadcasts
 *                         so NodeManager can wire parent→child relationships.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Node registry — LoaderEntry
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   Map<id, LoaderEntry>
 *
 *   {
 *     data       : object           — Shape 1 node data
 *     url        : string | null   — source URL (null for inline loadNode())
 *     mesh       : THREE.Object3D | null
 *     state      : 'unloaded' | 'loading' | 'loaded' | 'deferred'
 *   }
 *
 *   'unloaded'  — data accepted, mesh disposed or never built
 *   'loading'   — fetch in flight (URL-based loads)
 *   'loaded'    — mesh in scene, registered with NodeManager
 *   'deferred'  — queued for background hydration on the next available frame
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Events dispatched (window)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   omni:node-created    { node, mesh }              — hydration complete
 *   omni:nodes-updated   { nodes, edges, source }    — any registry change;
 *                                                      source: 'loader'
 *   omni:loader-ready    { ids: string[] }           — bootstrap complete
 *
 * Events consumed (window)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   omni:navigate        { from, to, direction }     — triggers depth evaluation
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Usage in main.js
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   import NodeLoader  from './data/NodeLoader.js'
 *   import NodeManager from './systems/NodeManager.js'
 *
 *   const nodeManager = new NodeManager(base.context)
 *   nodeManager.init()
 *
 *   const nodeLoader = new NodeLoader(base.context)
 *   nodeLoader.setNodeManager(nodeManager)
 *   nodeLoader.init()
 *
 *   // Bootstrap — awaited so Root geometry exists before the camera descent ends
 *   await nodeLoader.loadFromURL('./data/root.json')
 *
 *   // After bootstrap, navigate NodeManager to the Root
 *   nodeManager.navigate('omni_root01', 'jump')
 *
 *   // Register with BaseScene for update() calls
 *   base.addModule(nodeLoader)
 *
 * Follows the standard module contract (constructor / init / update / destroy).
 */

import * as THREE from 'three'
import gsap       from 'gsap'

// ── Depth window thresholds ───────────────────────────────────────────────────

const LOAD_DEPTH_EAGER    = 1   // 0–1  → hydrate immediately
const LOAD_DEPTH_DEFERRED = 2   // 2    → queue for next available frame
const UNLOAD_DEPTH        = 3   // 3+   → dispose mesh (data kept)
const BFS_LIMIT           = UNLOAD_DEPTH + 2  // cap BFS traversal cost

// ── Deferred queue — drain rate ───────────────────────────────────────────────

const DEQUEUE_PER_FRAME = 1   // one deferred hydration per frame

// ── Hydration animation ───────────────────────────────────────────────────────

const ENTRY_DURATION  = 0.45   // s — mesh materialise
const ENTRY_EASE      = 'elastic.out(1, 0.55)'
const UNLOAD_DURATION = 0.30   // s — mesh fade-out before dispose

// ── Storage keys ──────────────────────────────────────────────────────────────

const STORE_LOADER = 'omni:loader:nodes'   // owned by NodeLoader
const STORE_NODES  = 'omni:nodes'          // owned by OmniNode — READ ONLY
const STORE_EDGES  = 'omni:edges'          // owned by OmniNode — READ ONLY

// ── Validation ────────────────────────────────────────────────────────────────

const REQUIRED_FIELDS = ['id', 'label', 'geometry', 'primitive', 'color', 'position', 'createdAt']

const VALID_GEOMETRIES = new Set([
  'BoxGeometry', 'SphereGeometry', 'CylinderGeometry', 'ConeGeometry',
  'TorusGeometry', 'TorusKnotGeometry', 'OctahedronGeometry', 'TetrahedronGeometry',
  'IcosahedronGeometry', 'DodecahedronGeometry', 'PlaneGeometry', 'CircleGeometry',
  'RingGeometry', 'CapsuleGeometry', 'LatheGeometry', 'TubeGeometry',
  'ExtrudeGeometry', 'ShapeGeometry', 'EdgesGeometry', 'WireframeGeometry',
])

const VALID_PRIMITIVES = new Set(['objective', 'subjective', 'undefined', 'false'])

// ── Primitive color map — matches OmniNode PRIMITIVE_COLORS exactly ───────────

const PRIMITIVE_COLORS = {
  objective  : 0xffffff,   // white — confirmed, deterministic
  subjective : 0x88aaff,   // blue  — perspectival, expressive
  undefined  : 0x888888,   // gray  — unknown, unresolved
  false      : 0x111111,   // black — negated, null
}

// ── Which geometry types render as LineSegments instead of Mesh ───────────────

const LINE_GEO_TYPES = new Set(['EdgesGeometry', 'WireframeGeometry'])

// ── Geometry factories — identical to OmniNode GEOMETRY_DEFS ─────────────────
// Factory functions called at hydration time, never at import.

const GEOMETRY_DEFS = {
  BoxGeometry          : () => new THREE.BoxGeometry(1, 1, 1),
  SphereGeometry       : () => new THREE.SphereGeometry(0.5, 20, 20),
  CylinderGeometry     : () => new THREE.CylinderGeometry(0.5, 0.5, 1, 20),
  ConeGeometry         : () => new THREE.ConeGeometry(0.5, 1, 20),
  TorusGeometry        : () => new THREE.TorusGeometry(0.45, 0.18, 10, 28),
  TorusKnotGeometry    : () => new THREE.TorusKnotGeometry(0.38, 0.12, 64, 10),
  OctahedronGeometry   : () => new THREE.OctahedronGeometry(0.6),
  TetrahedronGeometry  : () => new THREE.TetrahedronGeometry(0.65),
  IcosahedronGeometry  : () => new THREE.IcosahedronGeometry(0.6, 0),
  DodecahedronGeometry : () => new THREE.DodecahedronGeometry(0.58, 0),
  PlaneGeometry        : () => new THREE.PlaneGeometry(1, 1),
  CircleGeometry       : () => new THREE.CircleGeometry(0.5, 20),
  RingGeometry         : () => new THREE.RingGeometry(0.28, 0.55, 20),
  CapsuleGeometry      : () => new THREE.CapsuleGeometry(0.3, 0.5, 6, 12),
  LatheGeometry        : () => new THREE.LatheGeometry([
                           new THREE.Vector2(0,     -0.5),
                           new THREE.Vector2(0.30,  -0.2),
                           new THREE.Vector2(0.38,   0.0),
                           new THREE.Vector2(0.25,   0.3),
                           new THREE.Vector2(0.08,   0.5),
                         ], 18),
  TubeGeometry         : () => new THREE.TubeGeometry(
                           new THREE.CatmullRomCurve3([
                             new THREE.Vector3(-0.5, 0,  0),
                             new THREE.Vector3(-0.1, 0.4, 0),
                             new THREE.Vector3( 0.1,-0.4, 0),
                             new THREE.Vector3( 0.5, 0,  0),
                           ]), 24, 0.1, 8, false),
  ExtrudeGeometry      : () => {
    const s = new THREE.Shape()
    s.moveTo( 0,    0   )
    s.lineTo( 0,    0.5 )
    s.lineTo( 0.35, 0.7 )
    s.lineTo( 0.7,  0.5 )
    s.lineTo( 0.7,  0   )
    s.lineTo( 0,    0   )
    return new THREE.ExtrudeGeometry(s, { depth: 0.3, bevelEnabled: false })
  },
  ShapeGeometry        : () => {
    const s = new THREE.Shape()
    s.moveTo( 0,    0.5 )
    s.lineTo( 0.47, 0.16)
    s.lineTo( 0.29,-0.4 )
    s.lineTo(-0.29,-0.4 )
    s.lineTo(-0.47, 0.16)
    s.lineTo( 0,    0.5 )
    return new THREE.ShapeGeometry(s)
  },
  EdgesGeometry        : () => new THREE.EdgesGeometry(new THREE.BoxGeometry(0.9, 0.9, 0.9)),
  WireframeGeometry    : () => new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(0.55, 1)),
}

// ─────────────────────────────────────────────────────────────────────────────
// NodeLoader class
// ─────────────────────────────────────────────────────────────────────────────

export default class NodeLoader {

  /**
   * @param {object} context  — { scene, camera, renderer, sizes, ticker }
   */
  constructor (context) {
    this.ctx = context

    // ── Node registry ──────────────────────────────────────────────────
    // Map<id, { data, url, mesh, state }>
    this._registry = new Map()

    // ── Deferred hydration queue ───────────────────────────────────────
    // Each item is () => void — calling it hydrates one node.
    this._loadQueue = []

    // ── NodeManager reference (injected via setNodeManager) ────────────
    this._nodeManager = null

    // ── Guard: prevents omni:nodes-updated listener loop ──────────────
    this._broadcasting = false

    // ── Bound event handlers ───────────────────────────────────────────
    this._onNavigate = null
  }

  // ── Module contract ──────────────────────────────────────────────────────

  init () {
    this._bindEvents()
    this._restoreFromStorage()
    console.log('⟐ NodeLoader — initialised.')
  }

  /**
   * Called every frame by BaseScene render loop.
   * Drains one deferred hydration task per frame to avoid load spikes.
   * @param {number} _delta
   */
  update (_delta) {
    if (this._loadQueue.length === 0) return
    for (let i = 0; i < DEQUEUE_PER_FRAME; i++) {
      const task = this._loadQueue.shift()
      if (task) task()
      if (this._loadQueue.length === 0) break
    }
  }

  destroy () {
    window.removeEventListener('omni:navigate', this._onNavigate)

    // Dispose all loaded meshes
    for (const [id, entry] of this._registry) {
      if (entry.mesh) {
        this._disposeMesh(entry)
        this._nodeManager?.unregisterMesh(id)
      }
    }

    this._registry.clear()
    this._loadQueue = []
    console.log('⟐ NodeLoader — destroyed.')
  }

  // ── Public API ───────────────────────────────────────────────────────────

  /**
   * Inject a NodeManager reference.
   * Call from main.js before any loadFromURL / loadNode calls.
   * @param {import('../systems/NodeManager.js').default} nm
   */
  setNodeManager (nm) {
    this._nodeManager = nm
  }

  /**
   * Fetch a node JSON file, validate it, hydrate it into the scene.
   * Async — safe to await before starting the camera entry animation.
   *
   * The JSON may contain a top-level '_notes' key (documentation only) —
   * it is stripped before validation so it never reaches Three.js.
   *
   * @param  {string}  url   — relative or absolute path to a node.schema.json Shape 1 file
   * @returns {Promise<{ node: object, mesh: THREE.Object3D }>}
   * @throws  if fetch fails or schema validation fails
   */
  async loadFromURL (url) {
    const existingId = this._findByURL(url)
    if (existingId) {
      const entry = this._registry.get(existingId)
      console.log(`⟐ NodeLoader — ${url} already loaded (${existingId}), skipping.`)
      return { node: entry.data, mesh: entry.mesh }
    }

    // Mark as loading
    const placeholder = { data: null, url, mesh: null, state: 'loading' }
    const tempId = '__loading__' + url
    this._registry.set(tempId, placeholder)

    let raw
    try {
      const response = await fetch(url)
      if (!response.ok) throw new Error(`HTTP ${response.status} — ${url}`)
      raw = await response.json()
    } catch (err) {
      this._registry.delete(tempId)
      throw new Error(`⟐ NodeLoader — fetch failed: ${err.message}`)
    }

    this._registry.delete(tempId)

    // Strip documentation-only keys before validation
    const data = this._stripMeta(raw)

    const { ok, errors } = this._validate(data)
    if (!ok) {
      throw new Error(`⟐ NodeLoader — validation failed for ${url}:\n  ${errors.join('\n  ')}`)
    }

    return this._ingest(data, url)
  }

  /**
   * Load a node from a plain data object (already fetched or inline).
   * Synchronous — the mesh is in the scene before this returns.
   *
   * @param  {object}  data  — Shape 1 node object conforming to node.schema.json
   * @returns {{ node: object, mesh: THREE.Object3D }}
   * @throws  if schema validation fails
   */
  loadNode (data) {
    const clean = this._stripMeta(data)
    const { ok, errors } = this._validate(clean)
    if (!ok) {
      throw new Error(`⟐ NodeLoader — validation failed:\n  ${errors.join('\n  ')}`)
    }
    return this._ingest(clean, null)
  }

  /**
   * Return data for all loader-managed nodes regardless of load state.
   * @returns {object[]}
   */
  getAllNodes () {
    return [...this._registry.values()]
      .filter(e => e.data !== null)
      .map(e => e.data)
  }

  /**
   * Return the LoaderEntry for a given node ID, or undefined.
   * @param  {string} id
   * @returns {{ data, url, mesh, state }|undefined}
   */
  getEntry (id) {
    return this._registry.get(id)
  }

  /**
   * Whether a given ID is currently hydrated (mesh in scene).
   * @param  {string} id
   * @returns {boolean}
   */
  isLoaded (id) {
    return this._registry.get(id)?.state === 'loaded'
  }

  // ── Validation ───────────────────────────────────────────────────────────

  /**
   * Validate a candidate Shape 1 object against all schema constraints.
   * Returns { ok: true } or { ok: false, errors: string[] }.
   *
   * @param  {object} data
   * @returns {{ ok: boolean, errors: string[] }}
   */
  _validate (data) {
    const errors = []

    if (!data || typeof data !== 'object') {
      return { ok: false, errors: ['data must be a non-null object'] }
    }

    // Required fields
    for (const field of REQUIRED_FIELDS) {
      if (data[field] === undefined || data[field] === null) {
        errors.push(`missing required field: "${field}"`)
      }
    }

    // id — non-empty string
    if (typeof data.id !== 'string' || data.id.trim() === '') {
      errors.push('id must be a non-empty string')
    }

    // label — string
    if (typeof data.label !== 'string') {
      errors.push('label must be a string')
    }

    // geometry — valid enum
    if (data.geometry && !VALID_GEOMETRIES.has(data.geometry)) {
      errors.push(`geometry "${data.geometry}" is not a valid Three.js geometry type`)
    }

    // primitive — bare key, no ⟐ prefix
    if (data.primitive && !VALID_PRIMITIVES.has(data.primitive)) {
      errors.push(
        `primitive "${data.primitive}" is invalid — use bare keys: objective | subjective | undefined | false (no ⟐ prefix)`
      )
    }

    // color — hex string #rrggbb
    if (data.color && (typeof data.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(data.color))) {
      errors.push(`color "${data.color}" must be a 6-digit hex string e.g. "#ffffff"`)
    }

    // position — [x, y, z] number array
    if (data.position !== undefined) {
      if (
        !Array.isArray(data.position) ||
        data.position.length !== 3 ||
        data.position.some(v => typeof v !== 'number')
      ) {
        errors.push('position must be a 3-element number array [x, y, z]')
      }
    }

    // createdAt — non-empty string
    if (data.createdAt !== undefined && typeof data.createdAt !== 'string') {
      errors.push('createdAt must be an ISO date-time string')
    }

    return { ok: errors.length === 0, errors }
  }

  // ── Ingestion ─────────────────────────────────────────────────────────────

  /**
   * Accept a validated Shape 1 object, register it, hydrate the mesh.
   * Idempotent — calling with the same id twice is a no-op after the first.
   *
   * @param  {object}        data
   * @param  {string | null} url   — source URL or null for inline nodes
   * @returns {{ node: object, mesh: THREE.Object3D }}
   */
  _ingest (data, url) {
    // Idempotency — same id already registered
    if (this._registry.has(data.id)) {
      const existing = this._registry.get(data.id)
      console.log(`⟐ NodeLoader — ${data.id} already in registry (${existing.state}), skipping.`)
      return { node: existing.data, mesh: existing.mesh }
    }

    const entry = { data, url, mesh: null, state: 'unloaded' }
    this._registry.set(data.id, entry)

    // Persist to loader storage
    this._writeToStorage(data)

    // Hydrate immediately — all bootstrap nodes load sync
    this._hydrate(data.id)

    // Broadcast merged node set to NodeManager
    this._broadcastUpdate()

    console.log(`⟐ NodeLoader — ingested ${data.id} (${data.label}) [${data.geometry}, ${data.primitive}]`)

    // Signal that the loader registry has changed
    window.dispatchEvent(new CustomEvent('omni:loader-ready', {
      detail: { ids: [...this._registry.keys()].filter(k => !k.startsWith('__loading__')) }
    }))

    return { node: data, mesh: entry.mesh }
  }

  // ── Hydration ─────────────────────────────────────────────────────────────

  /**
   * Build the Three.js mesh for a registered node and add it to the scene.
   * Dispatches omni:node-created for NodeManager registration.
   * Safe to call on an already-loaded node — no-op.
   *
   * @param {string} id
   */
  _hydrate (id) {
    const entry = this._registry.get(id)
    if (!entry || !entry.data) return
    if (entry.state === 'loaded') return

    const { data } = entry

    // Build mesh — material params identical to OmniNode._buildMesh
    const color = PRIMITIVE_COLORS[data.primitive] ?? PRIMITIVE_COLORS.undefined
    const mesh  = this._buildMesh(data.geometry, color)

    // Place at declared world position [x, y, z]
    mesh.position.set(...data.position)

    // userData — flags consumed by OmniNode raycast, NodeManager LOD, etc.
    mesh.userData.nodeId       = data.id
    mesh.userData.loaderManaged = true
    // Root-level nodes (no parent) are stationary — cannot be moved by the user
    mesh.userData.stationary   = !data.parentId

    this.ctx.scene.add(mesh)

    entry.mesh  = mesh
    entry.state = 'loaded'

    // Register with NodeManager for LOD management (direct call — no event needed)
    this._nodeManager?.registerMesh(data.id, mesh)

    // Dispatch omni:node-created — NodeManager._onNodeCreated also calls registerMesh
    // (harmless double-register: registerMesh is idempotent via Map.set)
    window.dispatchEvent(new CustomEvent('omni:node-created', {
      detail: { node: data, mesh }
    }))

    // GSAP entry — materialise from nothing, same as OmniNode._createNode
    mesh.scale.set(0, 0, 0)
    gsap.to(mesh.scale, {
      x: 1, y: 1, z: 1,
      duration : ENTRY_DURATION,
      ease     : ENTRY_EASE,
    })

    console.log(`⟐ NodeLoader — hydrated ${data.id} at (${data.position.map(v => v.toFixed(1)).join(', ')})`)
  }

  // ── Unloading ─────────────────────────────────────────────────────────────

  /**
   * Dispose a node's mesh and remove it from the scene.
   * The data record is kept — the node can be re-hydrated on demand.
   *
   * Calls nodeManager.unregisterMesh() directly (NOT omni:node-deleted)
   * to avoid NodeManager pruning the node from its history stacks and tree.
   *
   * @param {string} id
   */
  _unloadMesh (id) {
    const entry = this._registry.get(id)
    if (!entry?.mesh) return

    const mesh = entry.mesh

    // Unregister from LOD before the fade starts (stops needless tween updates)
    this._nodeManager?.unregisterMesh(id)

    // Fade out then dispose
    const mat = mesh.material
    if (mat) {
      mat.transparent = true
      gsap.to(mat, {
        opacity  : 0,
        duration : UNLOAD_DURATION,
        ease     : 'power1.inOut',
        onComplete: () => {
          this.ctx.scene.remove(mesh)
          this._disposeMesh(entry)
          entry.state = 'unloaded'
          console.log(`⟐ NodeLoader — unloaded ${id} (depth > ${UNLOAD_DEPTH - 1})`)
        }
      })
    } else {
      this.ctx.scene.remove(mesh)
      this._disposeMesh(entry)
      entry.state = 'unloaded'
    }

    entry.mesh = null
  }

  /**
   * Release Three.js resources for the mesh in an entry.
   * @param {{ mesh: THREE.Object3D | null }} entry
   */
  _disposeMesh (entry) {
    const mesh = entry.mesh
    if (!mesh) return
    mesh.geometry?.dispose()
    if (Array.isArray(mesh.material)) {
      mesh.material.forEach(m => m.dispose())
    } else {
      mesh.material?.dispose()
    }
    entry.mesh = null
  }

  // ── Mesh factory — identical to OmniNode._buildMesh ──────────────────────

  /**
   * Build a THREE.Mesh or THREE.LineSegments for the given geometry type and
   * primitive color. Material parameters match OmniNode exactly so loader
   * nodes and user-created nodes are visually consistent.
   *
   * @param  {string}  geoType    — Three.js geometry class name
   * @param  {number}  colorHex   — integer hex color e.g. 0xffffff
   * @returns {THREE.Mesh | THREE.LineSegments}
   */
  _buildMesh (geoType, colorHex) {
    const factory = GEOMETRY_DEFS[geoType] ?? GEOMETRY_DEFS.SphereGeometry
    const geo     = factory()

    if (LINE_GEO_TYPES.has(geoType)) {
      const mat = new THREE.LineBasicMaterial({
        color       : colorHex,
        transparent : true,
        opacity     : 0.85,
      })
      return new THREE.LineSegments(geo, mat)
    }

    const mat = new THREE.MeshStandardMaterial({
      color            : colorHex,
      roughness        : 0.35,
      metalness        : 0.08,
      emissive         : new THREE.Color(0x000000),
      emissiveIntensity: 1,
    })
    return new THREE.Mesh(geo, mat)
  }

  // ── Lazy depth window ─────────────────────────────────────────────────────

  /**
   * Walk the registry and apply load / defer / unload decisions based on each
   * node's graph-distance from currentId.
   *
   * Called every time omni:navigate fires (i.e. every traversal event).
   *
   * @param {string | null} currentId
   */
  _evaluateDepthWindow (currentId) {
    if (!currentId) return
    if (this._registry.size === 0) return

    for (const [id, entry] of this._registry) {
      if (!entry.data) continue

      const dist = this._treeDistance(currentId, id)

      if (dist <= LOAD_DEPTH_EAGER) {
        // Must be in scene immediately
        if (entry.state === 'unloaded') {
          this._hydrate(id)
        } else if (entry.state === 'deferred') {
          // Promote from deferred to immediate
          this._removeFromQueue(id)
          this._hydrate(id)
        }

      } else if (dist === LOAD_DEPTH_DEFERRED) {
        // Load in background — only if not already loaded or queued
        if (entry.state === 'unloaded') {
          entry.state = 'deferred'
          this._loadQueue.push(() => {
            // State may have changed by the time this runs — check again
            const e = this._registry.get(id)
            if (e?.state === 'deferred') this._hydrate(id)
          })
        }

      } else if (dist >= UNLOAD_DEPTH) {
        // Too far — release the mesh if it exists
        if (entry.state === 'loaded') {
          this._unloadMesh(id)
        } else if (entry.state === 'deferred') {
          this._removeFromQueue(id)
          entry.state = 'unloaded'
        }
      }
    }
  }

  /**
   * Remove a pending deferred task for a given id from the load queue.
   * The task functions close over the id via _hydrate's own state check,
   * so we mark the entry as 'unloaded' before they run to make them no-ops.
   * @param {string} id
   */
  _removeFromQueue (id) {
    // We don't need to splice — the queue task checks entry.state before acting.
    // Just ensure the entry is no longer 'deferred' so the task self-aborts.
    const entry = this._registry.get(id)
    if (entry) entry.state = 'unloaded'
  }

  // ── Tree distance (BFS) ───────────────────────────────────────────────────

  /**
   * Compute the minimum hop count between two node IDs in the logic tree by
   * walking undirected edges (parentId + childIds) via NodeManager.getTreeNode().
   *
   * Falls back to _parentChainDistance() when NodeManager is unavailable.
   *
   * Returns Infinity if the nodes are not connected within BFS_LIMIT hops.
   *
   * @param  {string} fromId
   * @param  {string} toId
   * @returns {number}
   */
  _treeDistance (fromId, toId) {
    if (fromId === toId) return 0

    if (!this._nodeManager) {
      return this._parentChainDistance(fromId, toId)
    }

    const visited = new Set()
    const queue   = [{ id: fromId, dist: 0 }]

    while (queue.length > 0) {
      const { id, dist } = queue.shift()
      if (visited.has(id)) continue
      if (dist >= BFS_LIMIT) continue   // don't search beyond useful range
      visited.add(id)

      const treeNode = this._nodeManager.getTreeNode(id)
      if (!treeNode) {
        // Node not yet in NodeManager tree — use parentId from registry as fallback
        const entry = this._registry.get(id)
        if (entry?.data?.parentId && !visited.has(entry.data.parentId)) {
          const nextDist = dist + 1
          if (entry.data.parentId === toId) return nextDist
          queue.push({ id: entry.data.parentId, dist: nextDist })
        }
        continue
      }

      // Walk to parent
      if (treeNode.parentId && !visited.has(treeNode.parentId)) {
        const nextDist = dist + 1
        if (treeNode.parentId === toId) return nextDist
        queue.push({ id: treeNode.parentId, dist: nextDist })
      }

      // Walk to children
      if (treeNode.childIds) {
        for (const childId of treeNode.childIds) {
          if (!visited.has(childId)) {
            const nextDist = dist + 1
            if (childId === toId) return nextDist
            queue.push({ id: childId, dist: nextDist })
          }
        }
      }
    }

    return Infinity
  }

  /**
   * Fallback distance computation when NodeManager is not available.
   * Walks the parentId chain from both nodes, looking for a common ancestor.
   * Returns 1 for all non-identical nodes (conservative — load everything).
   *
   * @param  {string} fromId
   * @param  {string} toId
   * @returns {number}
   */
  _parentChainDistance (fromId, toId) {
    // Walk the parentId chain from fromId and collect ancestry
    const ancestorsFrom = new Map()   // id → depth from fromId
    let cursor = fromId
    let depth  = 0

    while (cursor && depth <= BFS_LIMIT) {
      ancestorsFrom.set(cursor, depth)
      const entry = this._registry.get(cursor)
      cursor = entry?.data?.parentId ?? null
      depth++
    }

    // Now walk from toId toward root — first common ancestor found
    cursor = toId
    depth  = 0
    while (cursor && depth <= BFS_LIMIT) {
      if (ancestorsFrom.has(cursor)) {
        return ancestorsFrom.get(cursor) + depth
      }
      const entry = this._registry.get(cursor)
      cursor = entry?.data?.parentId ?? null
      depth++
    }

    // No common ancestor found within limit — treat as adjacent (conservative)
    return 1
  }

  // ── Storage ───────────────────────────────────────────────────────────────

  /**
   * Merge a node into the loader's own localStorage key.
   * Never writes to 'omni:nodes' — that key is owned by OmniNode.
   * Idempotent — skips if id already present.
   *
   * @param {object} data  — Shape 1 node object
   */
  _writeToStorage (data) {
    try {
      const raw      = localStorage.getItem(STORE_LOADER)
      const existing = raw ? JSON.parse(raw) : []
      if (existing.find(n => n.id === data.id)) return   // already stored
      existing.push(data)
      localStorage.setItem(STORE_LOADER, JSON.stringify(existing))
    } catch (err) {
      console.warn('⟐ NodeLoader — storage write failed:', err)
    }
  }

  /**
   * On init, restore any nodes previously written to 'omni:loader:nodes'.
   * Re-ingest their data — hydration will occur normally.
   */
  _restoreFromStorage () {
    try {
      const raw = localStorage.getItem(STORE_LOADER)
      if (!raw) return
      const stored = JSON.parse(raw)
      let count = 0
      for (const data of stored) {
        if (!this._registry.has(data.id)) {
          const { ok } = this._validate(data)
          if (ok) {
            this._ingest(data, null)
            count++
          }
        }
      }
      if (count > 0) {
        console.log(`⟐ NodeLoader — restored ${count} node(s) from storage.`)
      }
    } catch (err) {
      console.warn('⟐ NodeLoader — storage restore failed:', err)
    }
  }

  // ── Broadcast ─────────────────────────────────────────────────────────────

  /**
   * Dispatch omni:nodes-updated with the full merged node set:
   *   loader-managed nodes (from this._registry)
   *   + OmniNode-managed nodes (read from 'omni:nodes' localStorage)
   *
   * NodeManager._onNodesUp clears and rebuilds nodeMap from this event, so
   * the merged set must always be complete or NodeManager loses knowledge of
   * one of the two node sources.
   *
   * The 'source: loader' tag in the detail prevents any future listener from
   * needing to guard against infinite dispatch loops.
   */
  _broadcastUpdate () {
    if (this._broadcasting) return
    this._broadcasting = true

    try {
      const loaderNodes = this.getAllNodes()

      // Read OmniNode's nodes from localStorage (read-only)
      let omniNodes = []
      try {
        const raw = localStorage.getItem(STORE_NODES)
        if (raw) omniNodes = JSON.parse(raw)
      } catch { /* silent */ }

      // Merge — loader nodes take precedence for any shared id
      const mergedMap = new Map()
      for (const n of omniNodes)  mergedMap.set(n.id, n)
      for (const n of loaderNodes) mergedMap.set(n.id, n)   // overwrite if same id
      const nodes = [...mergedMap.values()]

      // Read OmniNode's edges from localStorage (read-only)
      let edges = []
      try {
        const raw = localStorage.getItem(STORE_EDGES)
        if (raw) edges = JSON.parse(raw)
      } catch { /* silent */ }

      window.dispatchEvent(new CustomEvent('omni:nodes-updated', {
        detail: { nodes, edges, source: 'loader' }
      }))

    } finally {
      this._broadcasting = false
    }
  }

  // ── Event listeners ───────────────────────────────────────────────────────

  _bindEvents () {
    this._onNavigate = (e) => {
      const { to } = e.detail ?? {}
      if (to) this._evaluateDepthWindow(to)
    }

    window.addEventListener('omni:navigate', this._onNavigate)
  }

  // ── Utilities ─────────────────────────────────────────────────────────────

  /**
   * Remove documentation-only keys from a raw JSON object before validation.
   * Keys prefixed with '_' are treated as schema annotations, not node data.
   * @param  {object} raw
   * @returns {object}
   */
  _stripMeta (raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw
    const clean = {}
    for (const [k, v] of Object.entries(raw)) {
      if (!k.startsWith('_')) clean[k] = v
    }
    return clean
  }

  /**
   * Find a registry id by source URL. Returns the id or undefined.
   * @param  {string} url
   * @returns {string | undefined}
   */
  _findByURL (url) {
    for (const [id, entry] of this._registry) {
      if (entry.url === url) return id
    }
    return undefined
  }
}
