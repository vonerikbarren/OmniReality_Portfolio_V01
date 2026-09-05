/**
 * systems/OmniNode.js — ⟐N OmniNode Manager
 *
 * The node creation and management brain of the ⟐mniReality. Responsible for
 * the full lifecycle of every node in the logic tree — spawn, select, connect,
 * delete, and persist.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Panel
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   Self-contained system panel anchored top-left, below the GlobalBar.
 *   Slides in from the left. Follows the universal panel design language —
 *   glassmorphism, monospace, ✕ / _ / ⟐ controls.
 *
 *   Opens via:
 *     window.dispatchEvent(new CustomEvent('omni:system-toggle', {
 *       detail: { system: 'omninode' }
 *     }))
 *   Or directly: omniNode.open() / omniNode.close() / omniNode.toggle()
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Three Operational Modes
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   SELECT  (default)
 *     Hover  →  node highlights (scale pulse)
 *     Click  →  node selected, dispatches omni:node-selected { node, mesh }
 *               OmniInspector consumes this to populate its property panel
 *
 *   PATH
 *     Click node A  →  marked as path start (glows amber)
 *     Click node B  →  LineGeometry drawn from A → B, both recorded
 *     Next click    →  extends path (B becomes new A)
 *     Path sequence readable by ⟐p OmniPresenter
 *
 *   PLACE  (transient — active while waiting to drop a new node)
 *     Cursor changes to crosshair
 *     Click in scene  →  raycasts floor plane (Y = 0), spawns node there
 *     Exits back to SELECT after placement
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Node Schema (localStorage: 'omni:nodes')
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   {
 *     id        : 'omni_a1b2c3',          // auto-generated
 *     label     : 'Node 1',               // user-editable via ⟐i
 *     geometry  : 'SphereGeometry',       // Three.js geometry type
 *     primitive : 'objective',            // objective|subjective|undefined|false
 *     color     : '#ffffff',              // hex — overridden by primitive if set
 *     position  : [x, y, z],             // world position
 *     parentId  : null,                   // ID of parent node (if any)
 *     createdAt : '2024-...',
 *   }
 *
 * Edge Schema (localStorage: 'omni:edges')
 *
 *   { from: 'omni_a1b2c3', to: 'omni_d4e5f6' }
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Events dispatched (window)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   omni:node-selected   { node, mesh }       — SELECT click on a node
 *   omni:node-created    { node, mesh }       — new node placed in scene
 *   omni:node-deleted    { id }               — node removed
 *   omni:node-deselected {}                   — click on empty space
 *   omni:path-step       { from, to, edges }  — edge drawn in PATH mode
 *   omni:nodes-updated   { nodes, edges }     — any storage change
 *
 * Events consumed (window)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   omni:system-toggle   { system: 'omninode' }  — open / close panel
 *   omni:node-label-set  { id, label }            — ⟐i updates label
 *   omni:node-color-set  { id, color }            — ⟐i updates color
 *   omni:node-geo-set    { id, geometry }         — ⟐i swaps geometry
 *   omni:node-pos-set    { id, position }         — ⟐i moves node
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Usage in main.js
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   import OmniNode from './systems/OmniNode.js'
 *   const omniNode = new OmniNode(base.context)
 *   omniNode.init()
 *
 *   // In the render loop update:
 *   omniNode.update(delta)
 *
 * Follows the standard module contract (constructor / init / update / destroy).
 */

import * as THREE from 'three'
import gsap       from 'gsap'

// ── Layout constants ──────────────────────────────────────────────────────────

const BAR_H      = 36    // px — GlobalBar collapsed height (must match GlobalBar.js)
const PANEL_W    = 340   // px — system panel width
const SLIDE_DUR  = 0.30  // s  — panel slide animation
const GLITCH_DUR = 0.20  // s  — glitch sequence total

// ── Node placement ────────────────────────────────────────────────────────────

const DEFAULT_NODE_SCALE  = 0.8     // world units — default new node radius/half-size
const PLACE_Y_OFFSET      = 0.4     // lift node slightly above floor (y = 0)
const HOVER_SCALE_FACTOR  = 1.12    // scale-up on hover, RELATIVE to the node's own base scale — not an absolute target
const SELECT_EMISSIVE     = 0x222244
const PATH_START_EMISSIVE = 0x443300
const FLOOR_PLANE         = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)

// Edge (genealogy line) tapering — root-to-child connections start thick
// and taper thinner with each generation, but never fully disappear.
// Native WebGL Line width is unreliable across browsers (most ignore
// `linewidth` entirely), so edges are real tapered cylinders instead —
// gives true, consistent thickness rather than an unreliable approximation.
const EDGE_BASE_RADIUS = 0.05    // radius at depth 0 (root-level connections)
const EDGE_MIN_RADIUS  = 0.012   // floor — thinnest an edge can ever get
const EDGE_TAPER       = 0.72    // multiplier applied per additional depth level
const GENEALOGY_HIGHLIGHT_COLOR = 0xb99cff   // persistent Ξ selection highlight

// ── Primitive color map ───────────────────────────────────────────────────────

const PRIMITIVE_COLORS = {
  objective  : 0xffffff,   // white — confirmed, deterministic
  subjective : 0x88aaff,   // blue  — perspectival, expressive
  undefined  : 0x888888,   // gray  — unknown, unresolved
  false      : 0x111111,   // black — negated, null
}

// ── All native Three.js geometry definitions ──────────────────────────────────
// Factory functions — called at node creation time, not at import.

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
                             new THREE.Vector3(-0.5, 0, 0),
                             new THREE.Vector3(-0.1, 0.4, 0),
                             new THREE.Vector3( 0.1,-0.4, 0),
                             new THREE.Vector3( 0.5, 0, 0),
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
  // Line-segment types — rendered as THREE.LineSegments instead of Mesh
  EdgesGeometry        : () => new THREE.EdgesGeometry(new THREE.BoxGeometry(0.9, 0.9, 0.9)),
  WireframeGeometry    : () => new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(0.55, 1)),
}

// Which types use LineSegments instead of Mesh
const LINE_GEO_TYPES = new Set(['EdgesGeometry', 'WireframeGeometry'])

// Short display labels for the geometry picker grid
const GEO_LABELS = {
  BoxGeometry          : 'Box',
  SphereGeometry       : 'Sphere',
  CylinderGeometry     : 'Cylinder',
  ConeGeometry         : 'Cone',
  TorusGeometry        : 'Torus',
  TorusKnotGeometry    : 'TorusKnot',
  OctahedronGeometry   : 'Octahedron',
  TetrahedronGeometry  : 'Tetrahedron',
  IcosahedronGeometry  : 'Icosahedron',
  DodecahedronGeometry : 'Dodecahedron',
  PlaneGeometry        : 'Plane',
  CircleGeometry       : 'Circle',
  RingGeometry         : 'Ring',
  CapsuleGeometry      : 'Capsule',
  LatheGeometry        : 'Lathe',
  TubeGeometry         : 'Tube',
  ExtrudeGeometry      : 'Extrude',
  ShapeGeometry        : 'Shape',
  EdgesGeometry        : 'Edges',
  WireframeGeometry    : 'Wireframe',
}

// ── Storage keys ──────────────────────────────────────────────────────────────

const STORE_NODES = 'omni:nodes'
const STORE_EDGES = 'omni:edges'

// ── Stylesheet ────────────────────────────────────────────────────────────────

const STYLES = /* css */`

/* ── OmniNode system panel ────────────────────────────────────────────────── */

.on-panel {
  --on-bg           : rgba(6, 6, 10, 0.92);
  --on-border       : rgba(255, 255, 255, 0.09);
  --on-sep          : rgba(255, 255, 255, 0.05);
  --on-header-bg    : rgba(255, 255, 255, 0.03);
  --on-text         : rgba(255, 255, 255, 0.82);
  --on-text-dim     : rgba(255, 255, 255, 0.35);
  --on-text-muted   : rgba(255, 255, 255, 0.18);
  --on-accent       : rgba(255, 255, 255, 0.96);
  --on-ctrl-hover   : rgba(255, 255, 255, 0.08);
  --on-ctrl-active  : rgba(255, 255, 255, 0.16);
  --on-select-color : rgba(100, 140, 255, 0.25);
  --on-path-color   : rgba(255, 180, 60, 0.25);
  --on-place-color  : rgba(80, 255, 160, 0.18);
  --mono            : 'Courier New', Courier, monospace;

  position          : fixed;
  top               : ${BAR_H}px;
  left              : 0;
  width             : ${PANEL_W}px;
  height            : calc(100vh - ${BAR_H}px - 52px); /* fill between bar and dock */
  max-height        : 520px;

  display           : flex;
  flex-direction    : column;

  background        : var(--on-bg);
  backdrop-filter   : blur(24px) saturate(1.6);
  -webkit-backdrop-filter: blur(24px) saturate(1.6);
  border-right      : 1px solid var(--on-border);
  border-bottom     : 1px solid var(--on-border);
  border-radius     : 0 0 10px 0;

  font-family       : var(--mono);
  color             : var(--on-text);
  font-size         : 10px;
  z-index           : 46;
  pointer-events    : auto;
  user-select       : none;
  overflow          : hidden;
  -webkit-font-smoothing: antialiased;

  visibility        : hidden;
}

/* ── Header ───────────────────────────────────────────────────────────────── */

.on-header {
  flex-shrink       : 0;
  display           : flex;
  align-items       : center;
  justify-content   : space-between;
  padding           : 0 10px 0 14px;
  height            : 38px;
  background        : var(--on-header-bg);
  border-bottom     : 1px solid var(--on-sep);
  gap               : 8px;
}

.on-title {
  font-size         : 10px;
  color             : var(--on-accent);
  letter-spacing    : 0.12em;
  text-transform    : uppercase;
  flex              : 1 1 auto;
}

.on-controls {
  display           : flex;
  align-items       : center;
  gap               : 3px;
  flex-shrink       : 0;
}

.on-ctrl {
  width             : 26px;
  height            : 26px;
  display           : flex;
  align-items       : center;
  justify-content   : center;
  background        : none;
  border            : 1px solid rgba(255,255,255,0.08);
  border-radius     : 5px;
  font-family       : var(--mono);
  font-size         : 11px;
  color             : var(--on-text-dim);
  cursor            : pointer;
  line-height       : 1;
  transition        : background 0.12s, color 0.12s, border-color 0.12s;
}
.on-ctrl:hover    { background: var(--on-ctrl-hover); color: var(--on-accent); border-color: rgba(255,255,255,0.18); }
.on-ctrl:active   { background: var(--on-ctrl-active); }
.on-ctrl--close:hover {
  background    : rgba(255, 80, 80, 0.14);
  border-color  : rgba(255, 80, 80, 0.28);
  color         : rgba(255, 150, 150, 0.90);
}

/* ── Mode toggle row ──────────────────────────────────────────────────────── */

.on-mode-row {
  flex-shrink       : 0;
  display           : flex;
  align-items       : center;
  gap               : 6px;
  padding           : 8px 12px;
  border-bottom     : 1px solid var(--on-sep);
}

.on-mode-label {
  font-size         : 8px;
  color             : var(--on-text-muted);
  text-transform    : uppercase;
  letter-spacing    : 0.14em;
  flex-shrink       : 0;
}

.on-mode-btn {
  flex              : 1;
  height            : 26px;
  display           : flex;
  align-items       : center;
  justify-content   : center;
  background        : rgba(255,255,255,0.03);
  border            : 1px solid rgba(255,255,255,0.08);
  border-radius     : 5px;
  font-family       : var(--mono);
  font-size         : 9px;
  color             : var(--on-text-dim);
  cursor            : pointer;
  letter-spacing    : 0.10em;
  text-transform    : uppercase;
  transition        : background 0.12s, color 0.12s, border-color 0.12s, box-shadow 0.12s;
}
.on-mode-btn:hover { background: var(--on-ctrl-hover); color: var(--on-accent); }

.on-mode-btn.is-active[data-mode="select"] {
  background        : var(--on-select-color);
  border-color      : rgba(100, 140, 255, 0.40);
  color             : rgba(140, 170, 255, 0.95);
  box-shadow        : 0 0 8px rgba(100,140,255,0.15);
}

.on-mode-btn.is-active[data-mode="path"] {
  background        : var(--on-path-color);
  border-color      : rgba(255, 180, 60, 0.40);
  color             : rgba(255, 200, 100, 0.95);
  box-shadow        : 0 0 8px rgba(255,180,60,0.15);
}

/* PLACE mode — highlights whole panel border */
.on-panel.is-place-mode {
  border-right      : 1px solid rgba(80, 255, 160, 0.30);
  border-bottom     : 1px solid rgba(80, 255, 160, 0.30);
  box-shadow        : 2px 0 16px rgba(80,255,160,0.08);
}

.on-place-hint {
  flex-shrink       : 0;
  display           : none;
  align-items       : center;
  gap               : 6px;
  padding           : 6px 12px;
  background        : rgba(80, 255, 160, 0.06);
  border-bottom     : 1px solid rgba(80, 255, 160, 0.12);
  font-size         : 8px;
  color             : rgba(80, 255, 160, 0.80);
  letter-spacing    : 0.10em;
}
.on-panel.is-place-mode .on-place-hint { display: flex; }

.on-place-dot {
  width             : 6px;
  height            : 6px;
  border-radius     : 50%;
  background        : rgba(80, 255, 160, 0.80);
  flex-shrink       : 0;
  animation         : on-pulse 1.2s ease-in-out infinite;
}
@keyframes on-pulse {
  0%, 100% { opacity: 1;    transform: scale(1);    }
  50%       { opacity: 0.4; transform: scale(0.7);  }
}

/* ── Nodes section ────────────────────────────────────────────────────────── */

.on-section-header {
  flex-shrink       : 0;
  display           : flex;
  align-items       : center;
  justify-content   : space-between;
  padding           : 6px 12px;
  border-bottom     : 1px solid var(--on-sep);
}

.on-section-title {
  font-size         : 8px;
  color             : var(--on-text-muted);
  text-transform    : uppercase;
  letter-spacing    : 0.14em;
}

.on-add-btn {
  display           : flex;
  align-items       : center;
  gap               : 4px;
  padding           : 3px 8px;
  background        : rgba(255,255,255,0.05);
  border            : 1px solid rgba(255,255,255,0.12);
  border-radius     : 4px;
  font-family       : var(--mono);
  font-size         : 8px;
  color             : var(--on-text-dim);
  cursor            : pointer;
  letter-spacing    : 0.08em;
  text-transform    : uppercase;
  transition        : background 0.12s, color 0.12s, border-color 0.12s;
}
.on-add-btn:hover { background: rgba(255,255,255,0.09); color: var(--on-accent); border-color: rgba(255,255,255,0.22); }

/* ── Node list ────────────────────────────────────────────────────────────── */

.on-node-list {
  flex              : 1 1 auto;
  overflow-y        : auto;
  overflow-x        : hidden;

  scrollbar-width   : thin;
  scrollbar-color   : rgba(255,255,255,0.06) transparent;
}
.on-node-list::-webkit-scrollbar       { width: 3px; }
.on-node-list::-webkit-scrollbar-track { background: transparent; }
.on-node-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.06); border-radius: 2px; }

.on-node-empty {
  display           : flex;
  flex-direction    : column;
  align-items       : center;
  justify-content   : center;
  gap               : 8px;
  padding           : 28px 16px;
  color             : var(--on-text-muted);
  font-size         : 9px;
  letter-spacing    : 0.10em;
  text-align        : center;
}

.on-node-empty-glyph {
  font-size         : 22px;
  opacity           : 0.18;
}

.on-node-item {
  display           : flex;
  align-items       : center;
  gap               : 8px;
  padding           : 7px 12px;
  border-bottom     : 1px solid var(--on-sep);
  cursor            : pointer;
  transition        : background 0.10s;
}
.on-node-item:hover { background: rgba(255,255,255,0.03); }

.on-node-item.is-selected {
  background        : var(--on-select-color);
  border-left       : 2px solid rgba(100,140,255,0.6);
  padding-left      : 10px;
}

.on-node-item.is-path-start {
  background        : var(--on-path-color);
  border-left       : 2px solid rgba(255,180,60,0.6);
  padding-left      : 10px;
}

.on-node-dot {
  width             : 7px;
  height            : 7px;
  border-radius     : 50%;
  flex-shrink       : 0;
  border            : 1px solid rgba(255,255,255,0.20);
}

.on-node-info {
  flex              : 1 1 auto;
  min-width         : 0;
}

.on-node-label {
  font-size         : 9px;
  color             : var(--on-text);
  white-space       : nowrap;
  overflow          : hidden;
  text-overflow     : ellipsis;
  letter-spacing    : 0.04em;
}

.on-node-geo {
  font-size         : 8px;
  color             : var(--on-text-muted);
  letter-spacing    : 0.06em;
}

.on-node-delete {
  flex-shrink       : 0;
  width             : 20px;
  height            : 20px;
  display           : flex;
  align-items       : center;
  justify-content   : center;
  background        : none;
  border            : none;
  border-radius     : 3px;
  font-size         : 11px;
  color             : rgba(255,255,255,0.18);
  cursor            : pointer;
  transition        : background 0.10s, color 0.10s;
}
.on-node-delete:hover { background: rgba(255,80,80,0.14); color: rgba(255,150,150,0.80); }

/* ── Edges section ────────────────────────────────────────────────────────── */

.on-edges-section {
  flex-shrink       : 0;
  max-height        : 110px;
  overflow-y        : auto;
  border-top        : 1px solid var(--on-sep);

  scrollbar-width   : thin;
  scrollbar-color   : rgba(255,255,255,0.06) transparent;
}

.on-edges-item {
  display           : flex;
  align-items       : center;
  gap               : 6px;
  padding           : 5px 12px;
  border-bottom     : 1px solid rgba(255,255,255,0.03);
  font-size         : 8px;
  color             : var(--on-text-muted);
  letter-spacing    : 0.06em;
}

.on-edges-arrow {
  color             : rgba(255, 180, 60, 0.50);
  flex-shrink       : 0;
}

.on-edges-delete {
  margin-left       : auto;
  flex-shrink       : 0;
  width             : 18px;
  height            : 18px;
  display           : flex;
  align-items       : center;
  justify-content   : center;
  background        : none;
  border            : none;
  border-radius     : 3px;
  font-size         : 10px;
  color             : rgba(255,255,255,0.14);
  cursor            : pointer;
  transition        : background 0.10s, color 0.10s;
}
.on-edges-delete:hover { background: rgba(255,80,80,0.12); color: rgba(255,150,150,0.70); }

/* ── Footer ───────────────────────────────────────────────────────────────── */

.on-footer {
  flex-shrink       : 0;
  height            : 26px;
  padding           : 0 12px;
  display           : flex;
  align-items       : center;
  border-top        : 1px solid var(--on-sep);
  gap               : 8px;
}

.on-footer-badge {
  font-size         : 8px;
  color             : var(--on-text-muted);
  text-transform    : uppercase;
  letter-spacing    : 0.10em;
}

.on-footer-count {
  margin-left       : auto;
  font-size         : 8px;
  color             : var(--on-text-muted);
  letter-spacing    : 0.06em;
}

/* ── Glitch scan line ─────────────────────────────────────────────────────── */

.on-glitch-line {
  position          : absolute;
  left              : 0;
  width             : 100%;
  height            : 2px;
  background        : rgba(255,255,255,0.32);
  pointer-events    : none;
  z-index           : 10;
  opacity           : 0;
}

/* ── Geometry picker overlay ──────────────────────────────────────────────── */

.on-geo-picker {
  position          : fixed;
  top               : ${BAR_H}px;
  left              : 0;
  width             : ${PANEL_W}px;
  max-height        : 520px;
  display           : flex;
  flex-direction    : column;

  background        : rgba(6, 6, 10, 0.96);
  backdrop-filter   : blur(24px) saturate(1.6);
  border-right      : 1px solid var(--on-border, rgba(255,255,255,0.09));
  border-bottom     : 1px solid var(--on-border, rgba(255,255,255,0.09));
  border-radius     : 0 0 10px 0;
  font-family       : 'Courier New', Courier, monospace;
  z-index           : 48;
  overflow          : hidden;
  visibility        : hidden;
  opacity           : 0;
}

.on-geo-header {
  flex-shrink       : 0;
  display           : flex;
  align-items       : center;
  justify-content   : space-between;
  padding           : 0 10px 0 14px;
  height            : 38px;
  border-bottom     : 1px solid rgba(255,255,255,0.05);
  background        : rgba(255,255,255,0.03);
}

.on-geo-title {
  font-size         : 10px;
  color             : rgba(255,255,255,0.96);
  letter-spacing    : 0.12em;
  text-transform    : uppercase;
}

.on-geo-cancel {
  padding           : 4px 8px;
  background        : none;
  border            : 1px solid rgba(255,255,255,0.10);
  border-radius     : 4px;
  font-family       : 'Courier New', Courier, monospace;
  font-size         : 8px;
  color             : rgba(255,255,255,0.40);
  cursor            : pointer;
  letter-spacing    : 0.10em;
  transition        : background 0.10s, color 0.10s;
}
.on-geo-cancel:hover { background: rgba(255,80,80,0.12); color: rgba(255,150,150,0.80); }

.on-geo-primitive-row {
  flex-shrink       : 0;
  display           : flex;
  gap               : 4px;
  padding           : 8px 10px;
  border-bottom     : 1px solid rgba(255,255,255,0.05);
}

.on-primitive-btn {
  flex              : 1;
  height            : 22px;
  display           : flex;
  align-items       : center;
  justify-content   : center;
  background        : rgba(255,255,255,0.03);
  border            : 1px solid rgba(255,255,255,0.08);
  border-radius     : 4px;
  font-family       : 'Courier New', Courier, monospace;
  font-size         : 7px;
  color             : rgba(255,255,255,0.40);
  cursor            : pointer;
  letter-spacing    : 0.06em;
  text-transform    : uppercase;
  transition        : background 0.10s, color 0.10s, border-color 0.10s;
}
.on-primitive-btn:hover  { background: rgba(255,255,255,0.07); color: rgba(255,255,255,0.80); }
.on-primitive-btn.is-active {
  border-color      : rgba(255,255,255,0.30);
  color             : rgba(255,255,255,0.92);
  background        : rgba(255,255,255,0.08);
}

.on-geo-grid {
  flex              : 1 1 auto;
  display           : grid;
  grid-template-columns: repeat(4, 1fr);
  gap               : 4px;
  padding           : 8px 10px;
  overflow-y        : auto;

  scrollbar-width   : thin;
  scrollbar-color   : rgba(255,255,255,0.06) transparent;
}

.on-geo-cell {
  display           : flex;
  flex-direction    : column;
  align-items       : center;
  justify-content   : center;
  gap               : 4px;
  padding           : 8px 4px;
  background        : rgba(255,255,255,0.03);
  border            : 1px solid rgba(255,255,255,0.07);
  border-radius     : 5px;
  cursor            : pointer;
  transition        : background 0.10s, border-color 0.10s, transform 0.10s;
}
.on-geo-cell:hover {
  background        : rgba(255,255,255,0.08);
  border-color      : rgba(255,255,255,0.22);
  transform         : scale(1.04);
}
.on-geo-cell:active { transform: scale(0.97); }

.on-geo-icon {
  font-size         : 16px;
  line-height       : 1;
}

.on-geo-name {
  font-size         : 7px;
  color             : rgba(255,255,255,0.50);
  letter-spacing    : 0.06em;
  text-align        : center;
}

/* ── Canvas cursor in place mode ──────────────────────────────────────────── */

.on-place-cursor canvas,
body.on-place-mode { cursor: crosshair !important; }

/* ── Mobile ───────────────────────────────────────────────────────────────── */

@media (max-width: 560px) {
  .on-panel,
  .on-geo-picker {
    width           : min(${PANEL_W}px, 88vw);
    max-height      : 70vh;
  }
}

`

// ── Style injection ───────────────────────────────────────────────────────────

function injectStyles () {
  if (document.getElementById('omni-node-styles')) return
  const tag = document.createElement('style')
  tag.id          = 'omni-node-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

// ── Geometry icon map (Unicode approximations) ────────────────────────────────

const GEO_ICONS = {
  BoxGeometry          : '⬜',
  SphereGeometry       : '⬤',
  CylinderGeometry     : '⬭',
  ConeGeometry         : '▲',
  TorusGeometry        : '◎',
  TorusKnotGeometry    : '✤',
  OctahedronGeometry   : '◆',
  TetrahedronGeometry  : '△',
  IcosahedronGeometry  : '⬡',
  DodecahedronGeometry : '⬠',
  PlaneGeometry        : '▭',
  CircleGeometry       : '○',
  RingGeometry         : '◯',
  CapsuleGeometry      : '⬮',
  LatheGeometry        : '⌀',
  TubeGeometry         : '〜',
  ExtrudeGeometry      : '⬟',
  ShapeGeometry        : '⭐',
  EdgesGeometry        : '⬕',
  WireframeGeometry    : '⊹',
}

// ── ID generator ──────────────────────────────────────────────────────────────

function generateId () {
  return 'omni_' + Math.random().toString(36).slice(2, 8)
}

// ── Glitch helper ─────────────────────────────────────────────────────────────

function glitch (el) {
  return new Promise(resolve => {
    const line = el.querySelector('.on-glitch-line')
    const tl = gsap.timeline({ onComplete: resolve })
    tl.to(el, { x: -3, duration: 0.030, ease: 'none' })
      .to(el, { x:  4, duration: 0.025, ease: 'none' })
      .to(el, { x: -2, opacity: 0.65, duration: 0.020, ease: 'none' })
      .to(el, { x:  0, opacity: 1,    duration: 0.030, ease: 'power1.out' })
    if (line) {
      gsap.fromTo(line,
        { top: '-2px', opacity: 0.85 },
        { top: '100%', opacity: 0,    duration: GLITCH_DUR, ease: 'power1.in' }
      )
    }
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// OmniNode class
// ─────────────────────────────────────────────────────────────────────────────

// Exported for reuse — e.g. ui/OmniDraw.js's ParticleShape/MeshType pickers
// need the same canonical geometry list rather than a duplicated one, and
// generateId keeps any externally-requested node using the same id scheme.
export { GEOMETRY_DEFS, GEO_LABELS, generateId }

export default class OmniNode {

  /**
   * @param {object} context  — { scene, camera, renderer, sizes, ticker, Sound? }
   */
  constructor (context) {
    this.ctx = context

    // ── Panel state ────────────────────────────────────────────────
    this._el       = null   // panel DOM root
    this._geoPick  = null   // geometry picker overlay DOM
    this._isOpen   = false
    this._mode     = 'select'   // 'select' | 'path' | 'place'

    // ── Node registry ──────────────────────────────────────────────
    // nodes: Map<id, { data, mesh }>
    // edges: Array<{ from, to, line }>
    this._nodes    = new Map()
    this._edges    = []

    // ── Selection / path state ─────────────────────────────────────
    this._selected   = null   // id of currently selected node
    this._currentSpaceId = null   // id of the domain/space currently "entered" — null means top-level scene
    this._genealogyHighlighted = new Set()   // node ids currently Ξ-highlighted
    this._genealogyOutlines    = new Map()   // nodeId -> outline mesh, for cleanup
    this._pathStart  = null   // id of first node in PATH mode click

    // ── Pending node creation ──────────────────────────────────────
    this._pendingGeo       = null   // geometry type chosen in picker
    this._pendingPrimitive = 'objective'   // selected primitive type

    // ── Raycast system ─────────────────────────────────────────────
    this._raycaster  = new THREE.Raycaster()
    this._mouse      = new THREE.Vector2()
    this._planeRay   = new THREE.Ray()
    this._hovered    = null   // id of currently hovered node

    // ── Bound handlers for cleanup ─────────────────────────────────
    this._onToggle      = null
    this._onLabelSet    = null
    this._onColorSet    = null
    this._onGeoSet      = null
    this._onPosSet      = null
    this._onMaterialSet = null
    this._onScaleSet    = null
    this._onRotationSet = null
    this._onDeleteRequest = null
    this._onTextSet = null
    this._onSequenceSet = null
    this._onMediaSet    = null
    this._onCreateRequest = null
    this._onSetDomain     = null
    this._onEnterSpace    = null
    this._onExitSpace     = null
    this._onForceSave     = null
    this._onParentSet     = null
    this._onGenealogySelect = null
    this._onMouseMove   = null
    this._onMouseClick  = null
  }

  // ── Module contract ──────────────────────────────────────────────────────

  init () {
    injectStyles()
    this._buildPanel()
    this._buildGeoPicker()
    this._bindEvents()
    this._bindRaycast()
    this._load()
    this._updateNodeList()
    this._updateEdgeList()
  }

  /**
   * Called every frame by the BaseScene render loop.
   * Drives hover highlight detection.
   */
  update (delta) {
    // Auto-rotation applies regardless of whether ⟐N's own panel is
    // open — it's a property of the object, not of the editor UI.
    for (const entry of this._nodes.values()) {
      const mode = entry.data.lookAtMode
      if (mode === 'Camera') {
        entry.mesh.lookAt(this.ctx.camera.position)
        continue   // lookAt and auto-rotation are mutually exclusive — an
                    // object can't both hold a fixed orientation toward
                    // something and spin freely at the same time.
      }
      if (mode === 'Coordinate' && entry.data.lookAtCoordinate) {
        entry.mesh.lookAt(...entry.data.lookAtCoordinate)
        continue
      }

      if (!entry.data.autoRotation) continue
      const mesh = entry.mesh
      if (entry.data.autoRotationAxisX) mesh.rotation.x += entry.data.autoRotationSpeedX * delta
      if (entry.data.autoRotationAxisY) mesh.rotation.y += entry.data.autoRotationSpeedY * delta
      if (entry.data.autoRotationAxisZ) mesh.rotation.z += entry.data.autoRotationSpeedZ * delta
    }

    if (!this._isOpen) return
    if (this._mode === 'place') return   // hover skipped in place mode
    this._detectHover()
  }

  destroy () {
    // Remove panel DOM
    this._el?.parentNode?.removeChild(this._el)
    this._geoPick?.parentNode?.removeChild(this._geoPick)

    // Remove Three.js objects
    this._nodes.forEach(({ mesh }) => {
      this.ctx.scene.remove(mesh)
      mesh.geometry?.dispose()
      mesh.material?.dispose()
    })
    this._edges.forEach(({ line }) => {
      this.ctx.scene.remove(line)
      line.geometry?.dispose()
      line.material?.dispose()
    })

    // Unbind events
    window.removeEventListener('omni:system-toggle',  this._onToggle)
    window.removeEventListener('omni:node-label-set', this._onLabelSet)
    window.removeEventListener('omni:node-color-set', this._onColorSet)
    window.removeEventListener('omni:node-geo-set',   this._onGeoSet)
    window.removeEventListener('omni:node-pos-set',      this._onPosSet)
    window.removeEventListener('omni:node-material-set', this._onMaterialSet)
    window.removeEventListener('omni:node-scale-set',    this._onScaleSet)
    window.removeEventListener('omni:node-rotation-set', this._onRotationSet)
    window.removeEventListener('omni:node-delete-request', this._onDeleteRequest)
    window.removeEventListener('omni:node-text-set', this._onTextSet)
    window.removeEventListener('omni:node-sequence-set', this._onSequenceSet)
    window.removeEventListener('omni:node-media-set',    this._onMediaSet)
    window.removeEventListener('omni:node-create-request', this._onCreateRequest)
    window.removeEventListener('omni:node-set-domain', this._onSetDomain)
    window.removeEventListener('omni:node-rotation-automation-set', this._onRotationAutomationSet)
    window.removeEventListener('omni:enter-space-request', this._onEnterSpace)
    window.removeEventListener('omni:exit-space-request', this._onExitSpace)
    window.removeEventListener('omni:force-save', this._onForceSave)
    window.removeEventListener('omni:node-parent-set', this._onParentSet)
    window.removeEventListener('omni:genealogy-select-request', this._onGenealogySelect)
    window.removeEventListener('omni:nodes-request', this._onNodesRequest)

    const canvas = this.ctx.renderer?.domElement
    if (canvas) {
      canvas.removeEventListener('mousemove', this._onMouseMove)
      canvas.removeEventListener('click',     this._onMouseClick)
    }

    document.body.classList.remove('on-place-mode')
  }

  // ── Public API ───────────────────────────────────────────────────────────

  open () {
    if (this._isOpen) return
    this._isOpen = true

    this._el.style.visibility = 'visible'
    gsap.fromTo(this._el,
      { x: '-100%', opacity: 1 },
      { x: '0%', duration: SLIDE_DUR, ease: 'power3.out',
        onComplete: () => glitch(this._el)
      }
    )
    this._playSound('open')
  }

  close () {
    if (!this._isOpen) return

    glitch(this._el).then(() => {
      gsap.to(this._el, {
        x: '-100%', duration: SLIDE_DUR * 0.85, ease: 'power2.in',
        onComplete: () => {
          this._el.style.visibility = 'hidden'
          gsap.set(this._el, { x: '-100%' })
        }
      })
    })

    this._isOpen = false
    this._cancelPlace()
    this._playSound('close')
  }

  toggle () {
    this._isOpen ? this.close() : this.open()
  }

  /**
   * External API — select a node by ID (called by OmniInspector after editing).
   * @param {string} id
   */
  selectById (id) {
    this._selectNode(id)
  }

  /**
   * External API — return all nodes as plain data objects.
   * @returns {Array}
   */
  getAllNodes () {
    return [...this._nodes.values()].map(n => n.data)
  }

  /**
   * External API — return all edges.
   * @returns {Array<{from,to}>}
   */
  getAllEdges () {
    return this._edges.map(e => ({ from: e.from, to: e.to }))
  }

  // ── Panel DOM ────────────────────────────────────────────────────────────

  _buildPanel () {
    const el = document.createElement('div')
    el.className  = 'on-panel'
    el.id         = 'omni-node-panel'

    el.innerHTML = /* html */`
      <div class="on-glitch-line" aria-hidden="true"></div>

      <!-- Header -->
      <div class="on-header">
        <span class="on-title">⟐N — OmniNode</span>
        <div class="on-controls">
          <button class="on-ctrl on-ctrl--attach"   data-action="attach"   title="⟐ Pocket attach" aria-label="Pocket attach">⟐</button>
          <button class="on-ctrl on-ctrl--minimize" data-action="minimize" title="_ Minimize"      aria-label="Minimize">_</button>
          <button class="on-ctrl on-ctrl--close"    data-action="close"    title="✕ Close"         aria-label="Close">✕</button>
        </div>
      </div>

      <!-- Mode toggle -->
      <div class="on-mode-row">
        <span class="on-mode-label">Mode</span>
        <button class="on-mode-btn is-active" data-mode="select">⊙ Select</button>
        <button class="on-mode-btn"           data-mode="path">⌁ Path</button>
      </div>

      <!-- Place mode hint -->
      <div class="on-place-hint">
        <span class="on-place-dot"></span>
        Click in scene to place node
      </div>

      <!-- Nodes section header -->
      <div class="on-section-header">
        <span class="on-section-title" id="on-node-count">Nodes (0)</span>
        <button class="on-add-btn" id="on-add-btn">+ Add Node</button>
      </div>

      <!-- Node list -->
      <div class="on-node-list" id="on-node-list">
        <div class="on-node-empty">
          <span class="on-node-empty-glyph">⟐</span>
          <span>No nodes yet</span>
        </div>
      </div>

      <!-- Edges section -->
      <div class="on-edges-section" id="on-edges-section">
        <div class="on-section-header">
          <span class="on-section-title" id="on-edge-count">Edges (0)</span>
        </div>
        <div id="on-edge-list"></div>
      </div>

      <!-- Footer -->
      <div class="on-footer">
        <span class="on-footer-badge" id="on-mode-badge">⟐N  select</span>
        <span class="on-footer-count" id="on-sel-badge">—</span>
      </div>
    `

    // Start off-screen
    gsap.set(el, { x: '-100%' })

    this._el = el
    const shell = document.getElementById('omni-ui') ?? document.body
    shell.appendChild(el)

    // Bind internal panel controls
    el.querySelector('.on-controls').addEventListener('click', (e) => {
      const btn = e.target.closest('.on-ctrl')
      if (!btn) return
      this._playSound('click')
      switch (btn.dataset.action) {
        case 'close':    this.close();     break
        case 'minimize': this._minimize(); break
        case 'attach':   this._attach();   break
      }
    })

    // Mode buttons
    el.querySelector('.on-mode-row').addEventListener('click', (e) => {
      const btn = e.target.closest('.on-mode-btn')
      if (!btn) return
      this._enterMode(btn.dataset.mode)
      this._playSound('click')
    })

    // Add node button
    el.querySelector('#on-add-btn').addEventListener('click', () => {
      this._openGeoPicker()
      this._playSound('click')
    })
  }

  // ── Geometry picker overlay ───────────────────────────────────────────────

  _buildGeoPicker () {
    const el = document.createElement('div')
    el.className = 'on-geo-picker'
    el.id        = 'omni-geo-picker'

    const geoNames  = Object.keys(GEOMETRY_DEFS)
    const primNames = Object.keys(PRIMITIVE_COLORS)

    const gridCells = geoNames.map(name => /* html */`
      <div class="on-geo-cell" data-geo="${name}" title="${name}">
        <span class="on-geo-icon">${GEO_ICONS[name] ?? '◈'}</span>
        <span class="on-geo-name">${GEO_LABELS[name] ?? name}</span>
      </div>
    `).join('')

    const primBtns = primNames.map((p, i) => /* html */`
      <button class="on-primitive-btn ${i === 0 ? 'is-active' : ''}"
              data-primitive="${p}">${p}</button>
    `).join('')

    el.innerHTML = /* html */`
      <div class="on-geo-header">
        <span class="on-geo-title">Select Geometry</span>
        <button class="on-geo-cancel" id="on-geo-cancel">✕ Cancel</button>
      </div>
      <div class="on-geo-primitive-row" id="on-primitive-row">${primBtns}</div>
      <div class="on-geo-grid" id="on-geo-grid">${gridCells}</div>
    `

    this._geoPick = el
    const shell = document.getElementById('omni-ui') ?? document.body
    shell.appendChild(el)

    // Primitive selection
    el.querySelector('#on-primitive-row').addEventListener('click', (e) => {
      const btn = e.target.closest('.on-primitive-btn')
      if (!btn) return
      el.querySelectorAll('.on-primitive-btn').forEach(b => b.classList.remove('is-active'))
      btn.classList.add('is-active')
      this._pendingPrimitive = btn.dataset.primitive
      this._playSound('click')
    })

    // Geometry cell click
    el.querySelector('#on-geo-grid').addEventListener('click', (e) => {
      const cell = e.target.closest('.on-geo-cell')
      if (!cell) return
      this._confirmGeometry(cell.dataset.geo)
      this._playSound('click')
    })

    // Cancel
    el.querySelector('#on-geo-cancel').addEventListener('click', () => {
      this._closeGeoPicker()
      this._playSound('close')
    })
  }

  // ── Geometry picker open / close ─────────────────────────────────────────

  _openGeoPicker () {
    this._geoPick.style.visibility = 'visible'
    gsap.to(this._geoPick, { opacity: 1, duration: 0.18, ease: 'power2.out' })
  }

  _closeGeoPicker () {
    gsap.to(this._geoPick, {
      opacity: 0, duration: 0.14, ease: 'power2.in',
      onComplete: () => { this._geoPick.style.visibility = 'hidden' }
    })
  }

  /**
   * Geometry type chosen — close picker, enter PLACE mode.
   * @param {string} geoType
   */
  _confirmGeometry (geoType) {
    this._pendingGeo = geoType
    this._closeGeoPicker()
    this._enterPlaceMode()
  }

  // ── Mode management ───────────────────────────────────────────────────────

  /**
   * Switch between 'select' and 'path' modes.
   * PLACE is entered separately via _enterPlaceMode().
   * @param {'select'|'path'} mode
   */
  _enterMode (mode) {
    if (mode === this._mode && mode !== 'place') return

    // Clear path state when leaving PATH mode
    if (this._mode === 'path' && mode !== 'path') {
      this._clearPathStart()
    }

    this._mode = mode

    // Sync mode buttons
    this._el.querySelectorAll('.on-mode-btn').forEach(btn => {
      btn.classList.toggle('is-active', btn.dataset.mode === mode)
    })

    // Update footer badge
    this._updateFooter()
  }

  _enterPlaceMode () {
    this._mode = 'place'
    this._el.classList.add('is-place-mode')
    document.body.classList.add('on-place-mode')

    // Deactivate mode buttons while in place mode
    this._el.querySelectorAll('.on-mode-btn').forEach(b => b.classList.remove('is-active'))
    this._updateFooter()
  }

  _cancelPlace () {
    if (this._mode !== 'place') return
    this._pendingGeo = null
    this._mode       = 'select'
    this._el.classList.remove('is-place-mode')
    document.body.classList.remove('on-place-mode')
    this._el.querySelectorAll('.on-mode-btn').forEach(btn => {
      btn.classList.toggle('is-active', btn.dataset.mode === 'select')
    })
    this._updateFooter()
  }

  // ── Raycast system ────────────────────────────────────────────────────────

  _bindRaycast () {
    const canvas = this.ctx.renderer?.domElement
    if (!canvas) return

    this._onMouseMove = (e) => this._updateMouse(e)
    this._onMouseClick = (e) => this._handleClick(e)

    canvas.addEventListener('mousemove', this._onMouseMove,  { passive: true })
    canvas.addEventListener('click',     this._onMouseClick)
  }

  _updateMouse (e) {
    const canvas = this.ctx.renderer.domElement
    const rect   = canvas.getBoundingClientRect()
    this._mouse.x =  ((e.clientX - rect.left)  / rect.width)  * 2 - 1
    this._mouse.y = -((e.clientY - rect.top)   / rect.height) * 2 + 1
  }

  /** Runs every frame — finds the closest hovered node mesh and highlights it. */
  _detectHover () {
    this._raycaster.setFromCamera(this._mouse, this.ctx.camera)

    const meshes = [...this._nodes.values()]
      .map(n => n.mesh)
      .filter(Boolean)

    if (meshes.length === 0) {
      if (this._hovered) this._clearHover()
      return
    }

    const hits = this._raycaster.intersectObjects(meshes, false)

    if (hits.length > 0) {
      const id = hits[0].object.userData.nodeId
      if (id !== this._hovered) {
        this._clearHover()
        this._setHover(id)
      }
    } else {
      if (this._hovered) this._clearHover()
    }
  }

  /** Hover/select scale pulses need to be RELATIVE to a node's own
   *  actual scale, not an absolute target — otherwise any node that
   *  isn't at scale 1 (a domain marked via "Is Domain," scaled to 10x;
   *  or anything the user resized via the Inspector) would visibly
   *  snap back down to scale 1 the moment it's deselected or
   *  hover-ends, even though its real saved scale never changed. */
  _baseScale (entry) {
    const [x, y, z] = entry.data.scale ?? [1, 1, 1]
    return { x, y, z }
  }

  _setHover (id) {
    this._hovered = id
    const entry = this._nodes.get(id)
    if (!entry) return
    const mesh = entry.mesh
    // Only scale-pulse meshes (not LineSegments)
    if (mesh instanceof THREE.Mesh) {
      const base = this._baseScale(entry)
      gsap.to(mesh.scale, {
        x: base.x * HOVER_SCALE_FACTOR, y: base.y * HOVER_SCALE_FACTOR, z: base.z * HOVER_SCALE_FACTOR,
        duration: 0.18, ease: 'power2.out'
      })
    }
  }

  _clearHover () {
    if (!this._hovered) return
    const entry = this._nodes.get(this._hovered)
    if (entry?.mesh instanceof THREE.Mesh) {
      const isSelected = this._hovered === this._selected
      const factor = isSelected ? 1.04 : 1.0
      const base = this._baseScale(entry)
      gsap.to(entry.mesh.scale, {
        x: base.x * factor, y: base.y * factor, z: base.z * factor,
        duration: 0.18, ease: 'power2.out'
      })
    }
    this._hovered = null
  }

  /**
   * Mouse click on canvas — route to the active mode handler.
   */
  _handleClick (e) {
    this._updateMouse(e)

    switch (this._mode) {
      case 'select': this._onSelectClick(); break
      case 'path':   this._onPathClick();   break
      case 'place':  this._onPlaceClick();  break
    }
  }

  // ── SELECT mode click ─────────────────────────────────────────────────────

  _onSelectClick () {
    this._raycaster.setFromCamera(this._mouse, this.ctx.camera)

    const meshes = [...this._nodes.values()].map(n => n.mesh).filter(Boolean)
    const hits   = this._raycaster.intersectObjects(meshes, false)

    if (hits.length > 0) {
      const id = hits[0].object.userData.nodeId
      this._selectNode(id)
    } else {
      this._deselectAll()
    }
  }

  // ── PATH mode click ───────────────────────────────────────────────────────

  _onPathClick () {
    this._raycaster.setFromCamera(this._mouse, this.ctx.camera)

    const meshes = [...this._nodes.values()].map(n => n.mesh).filter(Boolean)
    const hits   = this._raycaster.intersectObjects(meshes, false)

    if (hits.length === 0) return

    const id    = hits[0].object.userData.nodeId
    const entry = this._nodes.get(id)
    if (!entry) return

    if (this._pathStart === null) {
      // First click — mark start
      this._pathStart = id
      this._highlightPathStart(id)
      this._updateFooter()
    } else if (this._pathStart !== id) {
      // Second+ click — draw edge from pathStart → id
      this._connectNodes(this._pathStart, id)
      // Extend path: old B becomes new A
      this._clearPathStart()
      this._pathStart = id
      this._highlightPathStart(id)
      this._updateFooter()
    }
    // Same node clicked again — do nothing
  }

  // ── PLACE mode click ──────────────────────────────────────────────────────

  _onPlaceClick () {
    if (!this._pendingGeo) return

    // Raycast against floor plane (Y = 0)
    this._raycaster.setFromCamera(this._mouse, this.ctx.camera)
    const target = new THREE.Vector3()
    const hit    = this._raycaster.ray.intersectPlane(FLOOR_PLANE, target)

    let position
    if (hit) {
      position = [target.x, PLACE_Y_OFFSET, target.z]
    } else {
      // Fallback: place 6 units in front of camera
      const cam = this.ctx.camera
      const dir = new THREE.Vector3()
      cam.getWorldDirection(dir)
      dir.multiplyScalar(6)
      position = [
        cam.position.x + dir.x,
        Math.max(PLACE_Y_OFFSET, cam.position.y + dir.y),
        cam.position.z + dir.z,
      ]
    }

    const geoType  = this._pendingGeo
    const prim     = this._pendingPrimitive

    this._createNode({
      id        : generateId(),
      label     : geoType.replace('Geometry', '') + '_' + Date.now().toString(36).slice(-4),
      geometry  : geoType,
      primitive : prim,
      color     : '#' + PRIMITIVE_COLORS[prim].toString(16).padStart(6, '0'),
      position,
      parentId  : this._selected ?? null,
      createdAt : new Date().toISOString(),
    })

    this._cancelPlace()
  }

  // ── Node lifecycle ────────────────────────────────────────────────────────

  /**
   * Create a node — adds to scene, registry, storage, and panel list.
   * @param {object} data  — node schema object
   */
  _createNode (data) {
    const color  = data.geometry === 'DimensionalText' ? (data.color ?? '#ffffff') : (PRIMITIVE_COLORS[data.primitive] ?? 0xffffff)
    const mesh   = this._buildMesh(data.geometry, color, data.text)

    mesh.position.set(...data.position)
    if (data.rotation) mesh.rotation.set(...data.rotation)
    if (data.scale) mesh.scale.set(...data.scale)
    mesh.userData.nodeId = data.id

    this.ctx.scene.add(mesh)
    this._nodes.set(data.id, { data, mesh })

    // If a space/domain is currently "entered", new objects belong to it —
    // re-parent into that space's container mesh. .attach() (rather than
    // .add()) preserves the mesh's current WORLD position by adjusting its
    // local transform for us, so `data.position` above can stay a normal
    // world-space spawn point and still end up correctly placed relative
    // to the space's own local origin once attached.
    if (this._currentSpaceId && this._currentSpaceId !== data.id) {
      const spaceEntry = this._nodes.get(this._currentSpaceId)
      if (spaceEntry) {
        spaceEntry.mesh.attach(mesh)
        data.spaceId = this._currentSpaceId
      }
    }

    // If there's a parent node, draw an edge
    if (data.parentId && this._nodes.has(data.parentId)) {
      this._connectNodes(data.parentId, data.id)
    }

    this._save()
    this._updateNodeList()
    this._selectNode(data.id)

    window.dispatchEvent(new CustomEvent('omni:node-created',  { detail: { node: data, mesh } }))
    window.dispatchEvent(new CustomEvent('omni:nodes-updated', { detail: this._storageSnapshot() }))

    // GSAP entry — materialise from nothing
    mesh.scale.set(0, 0, 0)
    gsap.to(mesh.scale, {
      x: 1, y: 1, z: 1,
      duration: 0.45, ease: 'elastic.out(1, 0.55)',
    })
  }

  /**
   * Delete a node and all its connected edges.
   * @param {string} id
   */
  _deleteNode (id) {
    const entry = this._nodes.get(id)
    if (!entry) return

    // Drop any Ξ genealogy outline this node was carrying
    if (this._genealogyOutlines.has(id)) {
      this._genealogyOutlines.get(id).material.dispose()
      this._genealogyOutlines.delete(id)
      this._genealogyHighlighted.delete(id)
    }

    // Remove edges connected to this node
    const toRemove = this._edges.filter(e => e.from === id || e.to === id)
    toRemove.forEach(e => this._removeEdge(e.from, e.to))

    // Remove mesh from scene
    const { mesh } = entry
    gsap.to(mesh.scale, {
      x: 0, y: 0, z: 0, duration: 0.22, ease: 'power2.in',
      onComplete: () => {
        this.ctx.scene.remove(mesh)
        mesh.geometry?.dispose()
        mesh.material?.dispose()
      }
    })

    this._nodes.delete(id)

    // Clear selection if this was the selected node
    if (this._selected === id)  this._selected   = null
    if (this._pathStart === id) this._pathStart   = null
    if (this._hovered === id)   this._hovered     = null

    this._save()
    this._updateNodeList()
    this._updateEdgeList()

    window.dispatchEvent(new CustomEvent('omni:node-deleted',  { detail: { id } }))
    window.dispatchEvent(new CustomEvent('omni:nodes-updated', { detail: this._storageSnapshot() }))
  }

  /**
   * Select a node — highlight mesh, update panel, dispatch event.
   * @param {string} id
   */
  _selectNode (id) {
    // Clear previous selection highlight
    if (this._selected && this._selected !== id) {
      const prev = this._nodes.get(this._selected)
      if (prev?.mesh instanceof THREE.Mesh) {
        prev.mesh.material.emissive?.setHex(0x000000)
        gsap.to(prev.mesh.scale, { x: 1, y: 1, z: 1, duration: 0.15 })
      }
    }

    this._selected = id
    const entry = this._nodes.get(id)
    if (!entry) return

    const { data, mesh } = entry

    if (mesh instanceof THREE.Mesh) {
      mesh.material.emissive?.setHex(SELECT_EMISSIVE)
      const base = this._baseScale(entry)
      gsap.to(mesh.scale, { x: base.x * 1.04, y: base.y * 1.04, z: base.z * 1.04, duration: 0.15 })
    }

    this._updateNodeList()
    this._updateFooter()

    window.dispatchEvent(new CustomEvent('omni:node-selected', { detail: { node: data, mesh } }))
  }

  /** Deselect all nodes — fires omni:node-deselected. */
  _deselectAll () {
    if (!this._selected) return

    const entry = this._nodes.get(this._selected)
    if (entry?.mesh instanceof THREE.Mesh) {
      entry.mesh.material.emissive?.setHex(0x000000)
      const base = this._baseScale(entry)
      gsap.to(entry.mesh.scale, { x: base.x, y: base.y, z: base.z, duration: 0.15 })
    }

    this._selected = null
    this._updateNodeList()
    this._updateFooter()

    window.dispatchEvent(new CustomEvent('omni:node-deselected', { detail: {} }))
  }

  // ── Path / edge management ────────────────────────────────────────────────

  /**
   * Draw a LineGeometry edge between two nodes and record it.
   * @param {string} fromId
   * @param {string} toId
   */
  _connectNodes (fromId, toId) {
    if (fromId === toId) return

    // Prevent duplicate edges
    const exists = this._edges.some(
      e => (e.from === fromId && e.to === toId) ||
           (e.from === toId   && e.to === fromId)
    )
    if (exists) return

    const entryA = this._nodes.get(fromId)
    const entryB = this._nodes.get(toId)
    if (!entryA || !entryB) return

    const posA = entryA.mesh.getWorldPosition(new THREE.Vector3())
    const posB = entryB.mesh.getWorldPosition(new THREE.Vector3())

    // toId is the child in this connection — its depth (parentId is
    // already set on its data by the time _connectNodes runs) determines
    // how thick/thin this edge renders.
    const childDepth = this._computeAncestry(toId).depth
    const line = this._buildEdgeLine(posA, posB, childDepth)
    this.ctx.scene.add(line)

    const edgeRecord = { from: fromId, to: toId, line }
    this._edges.push(edgeRecord)

    this._save()
    this._updateEdgeList()

    // Animate line opacity in
    gsap.fromTo(line.material, { opacity: 0 }, { opacity: 0.45, duration: 0.35, ease: 'power2.out' })

    window.dispatchEvent(new CustomEvent('omni:path-step', {
      detail: {
        from  : entryA.data,
        to    : entryB.data,
        edges : this._edges.map(e => ({ from: e.from, to: e.to })),
      }
    }))
    window.dispatchEvent(new CustomEvent('omni:nodes-updated', { detail: this._storageSnapshot() }))
  }

  /**
   * Remove a specific edge from scene and registry.
   * @param {string} fromId
   * @param {string} toId
   */
  _removeEdge (fromId, toId) {
    const idx = this._edges.findIndex(
      e => (e.from === fromId && e.to === toId) ||
           (e.from === toId   && e.to === fromId)
    )
    if (idx === -1) return

    const edge = this._edges[idx]
    this.ctx.scene.remove(edge.line)
    edge.line.geometry?.dispose()
    edge.line.material?.dispose()

    this._edges.splice(idx, 1)
    this._save()
    this._updateEdgeList()
  }

  _highlightPathStart (id) {
    const entry = this._nodes.get(id)
    if (!entry) return
    if (entry.mesh instanceof THREE.Mesh) {
      entry.mesh.material.emissive?.setHex(PATH_START_EMISSIVE)
    }
    this._updateNodeList()
  }

  _clearPathStart () {
    if (!this._pathStart) return
    const entry = this._nodes.get(this._pathStart)
    if (entry?.mesh instanceof THREE.Mesh) {
      const isSelected = this._pathStart === this._selected
      entry.mesh.material.emissive?.setHex(isSelected ? SELECT_EMISSIVE : 0x000000)
    }
    this._pathStart = null
    this._updateNodeList()
  }

  // ── Mesh factory ──────────────────────────────────────────────────────────

  /**
   * Build a Three.js mesh (or LineSegments) for the given geometry type.
   * @param {string} geoType
   * @param {number} color   — hex integer
   * @returns {THREE.Mesh | THREE.LineSegments}
   */
  _buildMesh (geoType, color, text) {
    if (geoType === 'DimensionalText') return this._buildTextSprite(text ?? '', color)

    const factory = GEOMETRY_DEFS[geoType] ?? GEOMETRY_DEFS.SphereGeometry
    const geo     = factory()

    if (LINE_GEO_TYPES.has(geoType)) {
      const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.85 })
      return new THREE.LineSegments(geo, mat)
    }

    const mat = new THREE.MeshStandardMaterial({
      color,
      roughness   : 0.35,
      metalness   : 0.08,
      emissive    : new THREE.Color(0x000000),
      emissiveIntensity: 1,
    })
    return new THREE.Mesh(geo, mat)
  }

  /**
   * Dimensional Text — the foundational version. A THREE.Sprite (not a
   * Mesh/PlaneGeometry) is deliberately the most performance-conscious
   * choice available: sprites are natively billboarded by the renderer
   * (no manual lookAt bookkeeping) and use the cheapest possible quad
   * geometry — this matters once a scene has many of these. Text itself
   * is drawn once onto a canvas and uploaded as a texture (same
   * technique already used elsewhere in this project — Inspector's
   * info-plane, the wallpaper sphere) rather than real 3D letterforms,
   * which would be dramatically more expensive per node.
   *
   * The plane "extends with the text" per the design brief — canvas
   * width is measured from the actual string, not fixed.
   *
   * Deliberately NOT built here yet (see DIMENSIONAL_TEXT_DESIGN.md):
   * the comic-book-style transformational animation system, sound/FX
   * attachment, and multi-axis (textX/textY/textZ) composition. This is
   * the foundation those build on, not those systems themselves.
   */
  _buildTextSprite (text, color) {
    const canvas = document.createElement('canvas')
    const c2d    = canvas.getContext('2d')
    const fontSize = 64

    c2d.font = `bold ${fontSize}px 'Courier New', monospace`
    const measured = c2d.measureText(text || ' ').width
    canvas.width  = Math.max(64, Math.ceil(measured) + 48)
    canvas.height = Math.ceil(fontSize * 1.7)

    // Canvas resize clears context state — font must be reapplied.
    c2d.font = `bold ${fontSize}px 'Courier New', monospace`
    c2d.textBaseline = 'middle'
    c2d.textAlign    = 'center'
    c2d.fillStyle    = typeof color === 'number' ? '#' + color.toString(16).padStart(6, '0') : (color ?? '#ffffff')
    c2d.fillText(text || ' ', canvas.width / 2, canvas.height / 2)

    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace

    const mat = new THREE.SpriteMaterial({ map: texture, transparent: true })
    const sprite = new THREE.Sprite(mat)
    const aspect = canvas.width / canvas.height
    sprite.scale.set(aspect * 1.4, 1.4, 1)
    sprite.userData.isDimensionalText = true
    sprite.userData.text = text ?? ''
    return sprite
  }

  /** Redraws an existing text sprite's canvas in place — used when a
   *  Dimensional Text node's string or color changes, without needing
   *  to rebuild the whole node/mesh. */
  _updateTextSprite (sprite, text, color) {
    if (!sprite?.material?.map?.image) return
    const canvas = sprite.material.map.image
    const c2d = canvas.getContext('2d')
    const fontSize = 64

    c2d.font = `bold ${fontSize}px 'Courier New', monospace`
    const measured = c2d.measureText(text || ' ').width
    canvas.width  = Math.max(64, Math.ceil(measured) + 48)
    canvas.height = Math.ceil(fontSize * 1.7)

    c2d.font = `bold ${fontSize}px 'Courier New', monospace`
    c2d.textBaseline = 'middle'
    c2d.textAlign    = 'center'
    c2d.fillStyle    = color ?? '#ffffff'
    c2d.fillText(text || ' ', canvas.width / 2, canvas.height / 2)

    sprite.material.map.needsUpdate = true
    const aspect = canvas.width / canvas.height
    sprite.scale.set(aspect * 1.4, 1.4, 1)
    sprite.userData.text = text ?? ''
  }

  /**
   * Build a THREE.Line connecting two positions (logic tree edge).
   * @param {THREE.Vector3} posA
   * @param {THREE.Vector3} posB
   * @returns {THREE.Line}
   */
  /**
   * Walk the parentId chain to find a node's root and depth. Cycle-safe
   * (visited set + hard iteration cap) since parentId chains are
   * user-editable now (via the Inspector's parent picker) and could in
   * theory be pointed into a loop.
   */
  _computeAncestry (id) {
    let depth = 0
    let current = this._nodes.get(id)
    let rootId = id
    const visited = new Set([id])

    while (current?.data?.parentId) {
      const parentId = current.data.parentId
      if (visited.has(parentId) || depth > 500) break   // cycle guard
      visited.add(parentId)
      const parentEntry = this._nodes.get(parentId)
      if (!parentEntry) break
      rootId = parentId
      depth++
      current = parentEntry
    }

    return { rootId, depth }
  }

  /** Every descendant id of `id` (children, grandchildren, ...), via parentId links. */
  _collectDescendants (id, out = new Set()) {
    for (const [nodeId, entry] of this._nodes) {
      if (entry.data.parentId === id && !out.has(nodeId)) {
        out.add(nodeId)
        this._collectDescendants(nodeId, out)
      }
    }
    return out
  }

  /** Removes every Ξ genealogy outline/highlight currently active. Safe
   *  to call even when nothing is highlighted. */
  _clearGenealogyHighlight () {
    for (const [nodeId, outline] of this._genealogyOutlines) {
      const n = this._nodes.get(nodeId)
      n?.mesh?.remove(outline)
      outline.material.dispose()   // never dispose outline.geometry — it's shared with the real mesh
    }
    this._genealogyOutlines.clear()

    for (const nodeId of this._genealogyHighlighted) {
      const n = this._nodes.get(nodeId)
      if (n?.mesh?.material) {
        n.mesh.material.emissive?.setHex?.(0x000000)
        n.mesh.material.emissiveIntensity = 0
        n.mesh.material.needsUpdate = true
      }
    }
    for (const edge of this._edges) {
      edge.line.material.opacity = 0.45
      edge.line.material.color.setHex(0xffffff)
    }
    this._genealogyHighlighted = new Set()
  }

  _buildEdgeLine (posA, posB, depth = 0) {
    const radius = Math.max(
      EDGE_MIN_RADIUS,
      EDGE_BASE_RADIUS * Math.pow(EDGE_TAPER, depth)
    )

    const direction = new THREE.Vector3().subVectors(posB, posA)
    const length    = direction.length()
    const midpoint  = new THREE.Vector3().addVectors(posA, posB).multiplyScalar(0.5)

    const geo = new THREE.CylinderGeometry(radius, radius, length, 8, 1)
    const mat = new THREE.MeshBasicMaterial({
      color       : 0xffffff,
      transparent : true,
      opacity     : 0,    // animated in after add
    })

    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.copy(midpoint)
    // Cylinders default to standing along Y — rotate to point along `direction`.
    mesh.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      direction.clone().normalize()
    )
    return mesh
  }

  // ── Panel UI — node list ──────────────────────────────────────────────────

  _updateNodeList () {
    const list = this._el?.querySelector('#on-node-list')
    const countEl = this._el?.querySelector('#on-node-count')
    if (!list) return

    const nodes = [...this._nodes.values()]
    if (countEl) countEl.textContent = `Nodes (${nodes.length})`

    if (nodes.length === 0) {
      list.innerHTML = /* html */`
        <div class="on-node-empty">
          <span class="on-node-empty-glyph">⟐</span>
          <span>No nodes yet.<br>Click + Add Node to begin.</span>
        </div>
      `
      return
    }

    list.innerHTML = nodes.map(({ data }) => {
      const isSelected   = data.id === this._selected
      const isPathStart  = data.id === this._pathStart
      const colorHex     = PRIMITIVE_COLORS[data.primitive] ?? 0xffffff
      const dotColor     = '#' + colorHex.toString(16).padStart(6, '0')
      const cls = [
        'on-node-item',
        isSelected  ? 'is-selected'   : '',
        isPathStart ? 'is-path-start' : '',
      ].filter(Boolean).join(' ')

      return /* html */`
        <div class="${cls}" data-node-id="${data.id}">
          <span class="on-node-dot" style="background:${dotColor};border-color:${dotColor}40"></span>
          <div class="on-node-info">
            <div class="on-node-label" title="${data.id}">${data.label}</div>
            <div class="on-node-geo">${GEO_LABELS[data.geometry] ?? data.geometry}</div>
          </div>
          <button class="on-node-delete" data-delete-id="${data.id}" title="Delete node">✕</button>
        </div>
      `
    }).join('')

    // Node item click → select
    list.querySelectorAll('.on-node-item').forEach(row => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('.on-node-delete')) return
        const id = row.dataset.nodeId
        if (this._mode === 'select') {
          this._selectNode(id)
        } else if (this._mode === 'path') {
          if (this._pathStart === null) {
            this._pathStart = id
            this._highlightPathStart(id)
          } else if (this._pathStart !== id) {
            this._connectNodes(this._pathStart, id)
            this._clearPathStart()
          }
        }
        this._playSound('click')
      })
    })

    // Delete buttons
    list.querySelectorAll('.on-node-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation()
        this._deleteNode(btn.dataset.deleteId)
        this._playSound('close')
      })
    })
  }

  // ── Panel UI — edge list ──────────────────────────────────────────────────

  _updateEdgeList () {
    const edgeList = this._el?.querySelector('#on-edge-list')
    const countEl  = this._el?.querySelector('#on-edge-count')
    if (!edgeList) return

    if (countEl) countEl.textContent = `Edges (${this._edges.length})`

    edgeList.innerHTML = this._edges.map((e, idx) => {
      const fromData = this._nodes.get(e.from)?.data
      const toData   = this._nodes.get(e.to)?.data
      const fromLabel = fromData?.label ?? e.from.slice(0, 10)
      const toLabel   = toData?.label   ?? e.to.slice(0, 10)
      return /* html */`
        <div class="on-edges-item">
          <span>${fromLabel}</span>
          <span class="on-edges-arrow">→</span>
          <span>${toLabel}</span>
          <button class="on-edges-delete" data-edge-idx="${idx}" title="Remove edge">✕</button>
        </div>
      `
    }).join('')

    edgeList.querySelectorAll('.on-edges-delete').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx  = parseInt(btn.dataset.edgeIdx, 10)
        const edge = this._edges[idx]
        if (edge) {
          this._removeEdge(edge.from, edge.to)
          this._playSound('close')
        }
      })
    })
  }

  // ── Footer ────────────────────────────────────────────────────────────────

  _updateFooter () {
    const badge  = this._el?.querySelector('#on-mode-badge')
    const selBdg = this._el?.querySelector('#on-sel-badge')
    if (!badge) return

    let modeStr = this._mode
    if (this._mode === 'path' && this._pathStart !== null) {
      modeStr = 'path — A marked'
    } else if (this._mode === 'place') {
      modeStr = 'place — click scene'
    }

    badge.textContent = `⟐N  ${modeStr}`

    if (selBdg) {
      if (this._selected) {
        const entry = this._nodes.get(this._selected)
        selBdg.textContent = entry ? entry.data.label : '—'
      } else {
        selBdg.textContent = '—'
      }
    }
  }

  // ── Panel controls (minimize, attach) ────────────────────────────────────

  _minimize () {
    const rect = this._el.getBoundingClientRect()
    gsap.to(this._el, {
      scale: 0.88, opacity: 0, duration: 0.18, ease: 'power2.in',
      onComplete: () => {
        this._el.style.visibility = 'hidden'
        gsap.set(this._el, { scale: 1, opacity: 1 })
      }
    })
    this._isOpen = false
    this._cancelPlace()

    window.dispatchEvent(new CustomEvent('omni:panel-minimized', {
      detail: {
        id        : 'omninode',
        label     : '⟐N',
        iconLabel : '⟐N',
        fromRect  : { x: rect.left, y: rect.top, w: rect.width, h: rect.height },
      }
    }))
    window.dispatchEvent(new CustomEvent('omni:panel-restore-handler', {
      detail: { id: 'omninode', handler: () => this.open() }
    }))
  }

  _attach () {
    window.dispatchEvent(new CustomEvent('omni:panel-attached', {
      detail: { id: 'omninode' }
    }))
    // Phase 5: camera.attach(this._el) for XR follow-mode
  }

  // ── Event listeners ───────────────────────────────────────────────────────

  _bindEvents () {

    // omni:system-toggle { system: 'omninode' } → open/close
    this._onToggle = (e) => {
      if (e.detail?.system !== 'omninode') return
      this.toggle()
    }

    // ⟐i updates — propagate changes back to Three.js mesh
    this._onLabelSet = (e) => {
      const { id, label } = e.detail ?? {}
      const entry = this._nodes.get(id)
      if (!entry) return
      entry.data.label = label
      this._save()
      this._updateNodeList()
      window.dispatchEvent(new CustomEvent('omni:node-updated', { detail: { node: entry.data } }))
    }

    this._onColorSet = (e) => {
      const { id, color } = e.detail ?? {}
      const entry = this._nodes.get(id)
      if (!entry) return
      entry.data.color = color
      if (entry.mesh?.userData?.isDimensionalText) {
        this._updateTextSprite(entry.mesh, entry.data.text, color)
      } else if (entry.mesh?.material?.color) {
        entry.mesh.material.color.set(color)
      }
      this._save()
      this._updateNodeList()
      window.dispatchEvent(new CustomEvent('omni:node-updated', { detail: { node: entry.data } }))
    }

    /** Dimensional Text nodes only — redraws the sprite's canvas with
     *  new content, rather than rebuilding the whole node. */
    this._onTextSet = (e) => {
      const { id, text } = e.detail ?? {}
      const entry = this._nodes.get(id)
      if (!entry || !entry.mesh?.userData?.isDimensionalText) return
      entry.data.text = text
      this._updateTextSprite(entry.mesh, text, entry.data.color)
      this._save()
      this._updateNodeList()
    }

    this._onSequenceSet = (e) => {
      const { id, textSequence } = e.detail ?? {}
      const entry = this._nodes.get(id)
      if (!entry) return
      entry.data.textSequence = textSequence
      this._save()
    }

    this._onGeoSet = (e) => {
      const { id, geometry } = e.detail ?? {}
      const entry = this._nodes.get(id)
      if (!entry) return

      // Swap geometry in-place
      const color = PRIMITIVE_COLORS[entry.data.primitive] ?? 0xffffff
      const newMesh = this._buildMesh(geometry, color)

      newMesh.position.copy(entry.mesh.position)
      newMesh.rotation.copy(entry.mesh.rotation)
      newMesh.scale.copy(entry.mesh.scale)
      newMesh.userData.nodeId = id

      this.ctx.scene.remove(entry.mesh)
      entry.mesh.geometry?.dispose()
      entry.mesh.material?.dispose()

      this.ctx.scene.add(newMesh)
      entry.mesh     = newMesh
      entry.data.geometry = geometry

      this._save()
      this._updateNodeList()
      window.dispatchEvent(new CustomEvent('omni:node-updated', { detail: { node: entry.data } }))
    }

    this._onMaterialSet = (e) => {
      const { id, material } = e.detail ?? {}
      const entry = this._nodes.get(id)
      if (!entry) return
      // Mesh material is already swapped by OmniInspector (same mesh object) —
      // this just keeps OmniNode's own record in sync for persistence/TreeView.
      entry.data.material = material
      this._save()
      this._updateNodeList()
    }

    this._onScaleSet = (e) => {
      const { id, scale } = e.detail ?? {}
      const entry = this._nodes.get(id)
      if (!entry) return
      // Mesh scale is already applied by OmniInspector (same mesh object) —
      // this just keeps OmniNode's own record in sync.
      entry.data.scale = scale
      this._save()
      this._updateNodeList()
    }

    this._onRotationSet = (e) => {
      const { id, rotation } = e.detail ?? {}
      const entry = this._nodes.get(id)
      if (!entry) return
      // Same pattern as scale — mesh rotation is already applied by
      // OmniInspector (same mesh object), this just keeps OmniNode's
      // own record in sync for persistence/TreeView.
      entry.data.rotation = rotation
      this._save()
      this._updateNodeList()
    }

    /** Inspector's trashcan button. Removes the node + its own mesh and
     *  any edges touching it. Children are re-parented to the deleted
     *  node's own parent rather than being silently orphaned or deleted
     *  themselves — same instinct as deleting a folder: its contents
     *  move up a level, they don't vanish with it. */
    this._onDeleteRequest = (e) => {
      const { id } = e.detail ?? {}
      const entry = this._nodes.get(id)
      if (!entry) return

      this._edges = this._edges.filter(edge => {
        if (edge.from !== id && edge.to !== id) return true
        this.ctx.scene.remove(edge.line)
        edge.line.geometry?.dispose()
        edge.line.material?.dispose()
        return false
      })

      this._nodes.forEach(childEntry => {
        if (childEntry.data.parentId === id) {
          childEntry.data.parentId = entry.data.parentId ?? null
        }
      })

      this.ctx.scene.remove(entry.mesh)
      entry.mesh.geometry?.dispose()
      entry.mesh.material?.map?.dispose()   // canvas texture, for Dimensional Text sprites
      entry.mesh.material?.dispose()
      this._nodes.delete(id)

      this._save()
      this._updateNodeList()
      window.dispatchEvent(new CustomEvent('omni:node-deleted', { detail: { id } }))
    }

    this._onMediaSet = (e) => {
      const { id, type, url, label } = e.detail ?? {}
      const entry = this._nodes.get(id)
      if (!entry) return
      // Media itself lives in the Inspector's extended-record store already —
      // just track a lightweight reference so TreeView/Pocket can show a badge.
      entry.data.media = entry.data.media ?? []
      entry.data.media.push({ type, url, label })
      this._save()
      this._updateNodeList()
    }

    // External creation request — lets other modules (e.g. ui/OmniDraw's
    // "Export to Scene" button) spawn a real, registered node without ever
    // needing a direct reference to this OmniNode instance.
    this._onCreateRequest = (e) => {
      const d = e.detail ?? {}
      this._createNode({
        id        : d.id ?? generateId(),
        label     : d.label ?? 'Object_' + Date.now().toString(36).slice(-4),
        geometry  : d.geometry ?? 'BoxGeometry',
        primitive : d.primitive ?? 'objective',
        color     : d.color ?? '#ffffff',
        position  : d.position ?? [0, 1, 0],
        rotation  : d.rotation ?? [0, 0, 0],
        scale     : d.scale ?? [1, 1, 1],
        parentId  : d.parentId ?? this._selected ?? null,
        createdAt : new Date().toISOString(),
        autoRotation      : d.autoRotation ?? false,
        autoRotationAxisX : d.autoRotationAxisX ?? false,
        autoRotationAxisY : d.autoRotationAxisY ?? false,
        autoRotationAxisZ : d.autoRotationAxisZ ?? false,
        autoRotationSpeedX: d.autoRotationSpeedX ?? 1,
        autoRotationSpeedY: d.autoRotationSpeedY ?? 1,
        autoRotationSpeedZ: d.autoRotationSpeedZ ?? 1,
        lookAtMode: d.lookAtMode ?? 'None',
        lookAtCoordinate: d.lookAtCoordinate ?? [0, 0, 0],
        text: d.text ?? '',
        textSequence: d.textSequence ?? null,
      })
    }

    // Explicit save request — from OmniInspector's Save button. All fields
    // already autosave on change; this just guarantees an immediate,
    // unconditional flush of whatever is currently in memory.
    this._onForceSave = () => this._save()

    // Parent reassignment — from OmniInspector's Root/Parent picker list.
    // Refuses to create a cycle (can't set a node's parent to one of its
    // own descendants).
    this._onParentSet = (e) => {
      const { id, parentId } = e.detail ?? {}
      const entry = this._nodes.get(id)
      if (!entry || id === parentId) return
      if (parentId && this._collectDescendants(id).has(parentId)) {
        console.warn(`⟐N — refused to set parent: ${parentId} is a descendant of ${id} (would create a cycle).`)
        return
      }

      // Remove any existing edge for this node as a child
      const oldParentId = entry.data.parentId
      if (oldParentId) this._removeEdge(oldParentId, id)

      entry.data.parentId = parentId ?? null
      if (parentId) this._connectNodes(parentId, id)

      this._save()
      this._updateNodeList()
      window.dispatchEvent(new CustomEvent('omni:nodes-updated', { detail: this._storageSnapshot() }))
    }

    // Whole-genealogy selection — from OmniInspector's Ξ button. Finds the
    // node's root, then pulses every node + edge in that whole connected
    // tree. This is a visual "here's the structure" confirmation, not a
    // persistent multi-select (nodes aren't individually selectable as a
    // group yet — dragging/editing the whole tree together would be a
    // separate, larger feature).
    this._onGenealogySelect = (e) => {
      const { id } = e.detail ?? {}
      const entry = this._nodes.get(id)
      if (!entry) return

      const { rootId } = this._computeAncestry(id)
      const treeIds = new Set([rootId, ...this._collectDescendants(rootId)])

      // Toggle off if this exact tree is already the highlighted one.
      const sameTree = this._genealogyHighlighted.size === treeIds.size &&
        [...treeIds].every(tid => this._genealogyHighlighted.has(tid))

      this._clearGenealogyHighlight()

      if (sameTree) {
        window.dispatchEvent(new CustomEvent('omni:genealogy-selected', { detail: { rootId: null, ids: [] } }))
        return
      }

      for (const nodeId of treeIds) {
        const n = this._nodes.get(nodeId)
        if (!n?.mesh) continue

        if (n.mesh.material) {
          n.mesh.material.emissive?.setHex?.(GENEALOGY_HIGHLIGHT_COLOR)
          n.mesh.material.emissiveIntensity = 1.1
          n.mesh.material.needsUpdate = true
        }

        // Outline — a slightly larger, backface-only duplicate sharing the
        // same geometry (classic cheap selection-outline technique). Added
        // as a child of the node's own mesh, so it inherits position and
        // moves/scales with it automatically.
        const outline = new THREE.Mesh(
          n.mesh.geometry,
          new THREE.MeshBasicMaterial({
            color: GENEALOGY_HIGHLIGHT_COLOR, side: THREE.BackSide,
            transparent: true, opacity: 0.85,
          })
        )
        outline.scale.setScalar(1.12)   // local to parent — do NOT multiply by parent's own scale
        n.mesh.add(outline)
        this._genealogyOutlines.set(nodeId, outline)
      }

      this._genealogyHighlighted = treeIds

      for (const edge of this._edges) {
        if (treeIds.has(edge.from) && treeIds.has(edge.to)) {
          edge.line.material.opacity = 1
          edge.line.material.color.setHex(GENEALOGY_HIGHLIGHT_COLOR)
        }
      }

      window.dispatchEvent(new CustomEvent('omni:genealogy-selected', {
        detail: { rootId, ids: [...treeIds] }
      }))
    }

    // Mark/unmark a node as a domain/space, with an optional space image —
    // from OmniInspector's new Domain section.
    this._onSetDomain = (e) => {
      const { id, isDomain, spaceImage } = e.detail ?? {}
      const entry = this._nodes.get(id)
      if (!entry) return
      entry.data.isDomain = !!isDomain
      if (spaceImage !== undefined) entry.data.spaceImage = spaceImage

      // Becoming a domain: double-sided (camera ends up inside/near it
      // once entered — single-sided faces would cull from that angle)
      // and scaled up 10x to actually have room to contain other objects.
      if (isDomain && entry.mesh?.material) {
        entry.mesh.material.side = THREE.DoubleSide
        entry.mesh.material.needsUpdate = true
        entry.mesh.scale.set(10, 10, 10)
        entry.data.scale = [10, 10, 10]
      }

      this._save()
      this._updateNodeList()
      window.dispatchEvent(new CustomEvent('omni:node-updated', { detail: { node: entry.data } }))
    }

    // Enter a space — everything created from now on is parented into it
    // (see _createNode) until omni:exit-space-request fires. Camera moves
    // to the space's own local origin, per the "context starts from the
    // origin point" rule.
    this._onEnterSpace = (e) => {
      const { id } = e.detail ?? {}
      const entry = this._nodes.get(id)
      if (!entry) return
      if (!entry.data.isDomain) {
        console.warn(`⟐N — "${entry.data.label ?? id}" isn't marked as a domain/space yet — enable "Is Domain" in the Inspector first.`)
        return
      }

      this._currentSpaceId = id
      const worldPos = entry.mesh.getWorldPosition(new THREE.Vector3())
      gsap.to(this.ctx.camera.position, {
        x: worldPos.x, y: worldPos.y, z: worldPos.z,
        duration: 1.4, ease: 'power2.inOut',
      })

      window.dispatchEvent(new CustomEvent('omni:space-entered', {
        detail: { id, label: entry.data.label, spaceImage: entry.data.spaceImage ?? null }
      }))
    }

    this._onExitSpace = () => {
      const prevId = this._currentSpaceId
      if (!prevId) return
      this._currentSpaceId = null
      window.dispatchEvent(new CustomEvent('omni:space-exited', { detail: { id: prevId } }))
    }

    this._onPosSet = (e) => {
      const { id, position } = e.detail ?? {}
      const entry = this._nodes.get(id)
      if (!entry) return

      entry.mesh.position.set(...position)
      entry.data.position = position

      // Rebuild all edges connected to this node — edges are tapered
      // cylinder meshes (not simple 2-point lines), so a moved endpoint
      // means rebuilding the cylinder's geometry/orientation from
      // scratch, not just patching a vertex buffer. Reuses the existing
      // edge.line's material so its current opacity/color survives.
      this._edges
        .filter(edge => edge.from === id || edge.to === id)
        .forEach(edge => {
          const entryA = this._nodes.get(edge.from)
          const entryB = this._nodes.get(edge.to)
          if (!entryA || !entryB) return

          const posA  = entryA.mesh.getWorldPosition(new THREE.Vector3())
          const posB  = entryB.mesh.getWorldPosition(new THREE.Vector3())
          const depth = this._computeAncestry(edge.to).depth

          const fresh = this._buildEdgeLine(posA, posB, depth)
          edge.line.geometry.dispose()
          edge.line.geometry = fresh.geometry
          edge.line.position.copy(fresh.position)
          edge.line.quaternion.copy(fresh.quaternion)
          fresh.material.dispose()   // throwaway — edge.line keeps its own material
        })

      this._save()
      window.dispatchEvent(new CustomEvent('omni:node-updated', { detail: { node: entry.data } }))
    }

    window.addEventListener('omni:system-toggle',  this._onToggle)
    window.addEventListener('omni:node-label-set', this._onLabelSet)
    window.addEventListener('omni:node-color-set', this._onColorSet)
    window.addEventListener('omni:node-geo-set',   this._onGeoSet)
    window.addEventListener('omni:node-pos-set',      this._onPosSet)
    window.addEventListener('omni:node-material-set', this._onMaterialSet)
    window.addEventListener('omni:node-scale-set',    this._onScaleSet)
    window.addEventListener('omni:node-rotation-set', this._onRotationSet)
    window.addEventListener('omni:node-delete-request', this._onDeleteRequest)
    window.addEventListener('omni:node-text-set', this._onTextSet)
    window.addEventListener('omni:node-sequence-set', this._onSequenceSet)
    window.addEventListener('omni:node-media-set',    this._onMediaSet)
    window.addEventListener('omni:node-create-request', this._onCreateRequest)
    window.addEventListener('omni:node-set-domain', this._onSetDomain)

    // Rotation automation — previously only ever set once, at
    // creation time, via ui/OmniDraw.js's schema, with no way to
    // adjust it afterward on an already-placed object. Mirrors
    // WallpaperSphere's own pattern: stays editable anytime, not just
    // at the moment of creation.
    this._onRotationAutomationSet = (e) => {
      const { id, ...patch } = e.detail ?? {}
      const entry = this._nodes.get(id)
      if (!entry) return
      Object.assign(entry.data, patch)
      this._save()
    }
    window.addEventListener('omni:node-rotation-automation-set', this._onRotationAutomationSet)
    window.addEventListener('omni:enter-space-request', this._onEnterSpace)
    window.addEventListener('omni:exit-space-request', this._onExitSpace)
    window.addEventListener('omni:force-save', this._onForceSave)
    window.addEventListener('omni:node-parent-set', this._onParentSet)
    window.addEventListener('omni:genealogy-select-request', this._onGenealogySelect)

    // On-demand snapshot — for anything (e.g. ui/OmniInspection.js)
    // that needs the current node list right now, rather than relying
    // on having already caught a prior passive nodes-updated broadcast.
    this._onNodesRequest = () => {
      window.dispatchEvent(new CustomEvent('omni:nodes-updated', { detail: this._storageSnapshot() }))
    }
    window.addEventListener('omni:nodes-request', this._onNodesRequest)

    // Escape key — cancel place mode or deselect
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (this._mode === 'place') {
          this._cancelPlace()
          this._closeGeoPicker()
        } else if (this._mode === 'path' && this._pathStart) {
          this._clearPathStart()
        } else if (this._selected) {
          this._deselectAll()
        }
      }
    })
  }

  // ── Persistence — localStorage ────────────────────────────────────────────

  _save () {
    try {
      const nodes = [...this._nodes.values()].map(n => ({
        ...n.data,
        position: [n.mesh.position.x, n.mesh.position.y, n.mesh.position.z],
      }))
      const edges = this._edges.map(e => ({ from: e.from, to: e.to }))
      localStorage.setItem(STORE_NODES, JSON.stringify(nodes))
      localStorage.setItem(STORE_EDGES, JSON.stringify(edges))
    } catch (err) {
      console.warn('⟐N — localStorage save failed:', err)
    }
  }

  /**
   * Restore nodes and edges from localStorage.
   * Rebuilds Three.js meshes and line geometries.
   */
  _load () {
    try {
      const rawNodes = localStorage.getItem(STORE_NODES)
      const rawEdges = localStorage.getItem(STORE_EDGES)

      if (rawNodes) {
        const nodes = JSON.parse(rawNodes)
        nodes.forEach(data => {
          // Use the node's own saved color if it has one — falling back
          // to the primitive-type default only for older saves that
          // predate per-node color. This was the actual "color/texture
          // doesn't stick after reload" bug: it always used the
          // primitive default here, discarding whatever the user set.
          const color = data.color ?? (PRIMITIVE_COLORS[data.primitive] ?? 0xffffff)
          const mesh  = this._buildMesh(data.geometry, color, data.text)
          mesh.position.set(...(data.position ?? [0, PLACE_Y_OFFSET, 0]))
          // Same bug for rotation/scale — previously never reapplied on
          // restore, so a saved node always came back at default
          // rotation and scale=1 regardless of what was saved.
          if (data.rotation) mesh.rotation.set(...data.rotation)
          if (data.scale)    mesh.scale.set(...data.scale)
          mesh.userData.nodeId = data.id
          this.ctx.scene.add(mesh)
          this._nodes.set(data.id, { data, mesh })
        })
      }

      if (rawEdges) {
        const edges = JSON.parse(rawEdges)
        edges.forEach(({ from, to }) => {
          const entryA = this._nodes.get(from)
          const entryB = this._nodes.get(to)
          if (!entryA || !entryB) return

          const line = this._buildEdgeLine(
            entryA.mesh.getWorldPosition(new THREE.Vector3()),
            entryB.mesh.getWorldPosition(new THREE.Vector3()),
            this._computeAncestry(to).depth
          )
          line.material.opacity = 0.45
          this.ctx.scene.add(line)
          this._edges.push({ from, to, line })
        })
      }

      if (this._nodes.size > 0) {
        console.log(`⟐N — restored ${this._nodes.size} node(s), ${this._edges.length} edge(s) from storage.`)
      }

    } catch (err) {
      console.warn('⟐N — localStorage load failed:', err)
    }
  }

  _storageSnapshot () {
    return {
      nodes : [...this._nodes.values()].map(n => {
        const { rootId, depth } = this._computeAncestry(n.data.id)
        return { ...n.data, rootId, depth }
      }),
      edges : this._edges.map(e => ({ from: e.from, to: e.to })),
    }
  }

  // ── Sound ─────────────────────────────────────────────────────────────────

  _playSound (id) {
    try {
      const Sound = this.ctx?.Sound
      if (Sound && typeof Sound.play === 'function') Sound.play(id)
    } catch (_) {}
  }
}
