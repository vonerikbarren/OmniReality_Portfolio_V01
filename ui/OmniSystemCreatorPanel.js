/**
 * ui/OmniSystemCreatorPanel.js — ⟐mniSystem Inspector
 *
 * Two formations now, sharing one Inspector and one per-node field
 * language (shape-icon preview, id/label, the primitive "truth"
 * dropdown, RGBA channels — the same language OmniDraw established).
 *
 * SKELETAL CROSS — fixed 7 nodes: 1 center (future OmniCore) + 6 arms,
 * one per axis direction.
 *
 * RADIAL RING — Stonehenge-style: 1 center (future OmniCore) + N outer
 * nodes, evenly spaced. The general formula, confirmed against every
 * worked example: node i sits at angle i*(360/N)°, measured clockwise
 * starting from 12 o'clock, always — no per-count exceptions. This one
 * formula reproduces N=2 (12&6 o'clock), N=3 (12,4,8), N=4 (12,3,6,9),
 * N=6 (every 2 hours), and works identically for any N, including
 * 8/10/12 — so the node count is a free "number of outer nodes" input,
 * not a fixed lookup table.
 *
 * Both formations share the same Group Lock mechanic: locked (default)
 * — one shared distance/radius value drives every outer node at once,
 * symmetrically; unlocked — each outer node gets its own independent
 * value. This is the concrete stand-in for what OmniCore will
 * eventually own and propagate, before OmniCore itself exists as code.
 *
 * "Create System" builds every node through NodeLoader's own real,
 * validated loadNode(data) path. Alpha is applied directly to each
 * created mesh's material right after creation — NodeLoader's saved
 * schema has no opacity field, so this is visible immediately but
 * won't survive a reload; an honest limitation, not a hidden one.
 *
 * Follows the standard module contract (constructor / init / update / destroy).
 */

import * as THREE from 'three'
import gsap from 'gsap'
import * as WindowManager from './WindowManager.js'

const GEOMETRIES = [
  'BoxGeometry', 'SphereGeometry', 'CylinderGeometry', 'ConeGeometry',
  'TorusGeometry', 'TorusKnotGeometry', 'OctahedronGeometry',
  'TetrahedronGeometry', 'IcosahedronGeometry', 'DodecahedronGeometry',
  'PlaneGeometry', 'CircleGeometry', 'RingGeometry', 'CapsuleGeometry',
]
const GEO_ICONS = {
  BoxGeometry: '⬜', SphereGeometry: '⬤', CylinderGeometry: '⬭', ConeGeometry: '▲',
  TorusGeometry: '◎', TorusKnotGeometry: '✤', OctahedronGeometry: '◆', TetrahedronGeometry: '△',
  IcosahedronGeometry: '⬡', DodecahedronGeometry: '⬠', PlaneGeometry: '▭', CircleGeometry: '○',
  RingGeometry: '◯', CapsuleGeometry: '⬮',
}
const PRIMITIVES = ['objective', 'subjective', 'undefined', 'false']
const DEFAULT_DISTANCE = 18
const MAX_DISTANCE = 60
const MAX_RING_NODES = 24
const MAX_SPHERE_NODES = 256
const MAX_GALAXY_NODES = 200   // main nodes only — the particle field carries the rest, uncapped in the same way
const MAX_SPIRAL_NODES = 150
const MAX_HELIX_NODES = 150
const MAX_STAR_NODES = 100   // lower than the others — each spike carries its own continuous per-frame animation cost, not just a static mesh
const MAX_GRID_AXIS = 12       // per-axis cap (columns, rows, or drawers individually)
const MAX_GRID_TOTAL = 512     // hard cap on the product — keeps the worst case in the same
                                // performance ballpark as Sphere's own 256-node ceiling
const GOLDEN_RATIO = (1 + Math.sqrt(5)) / 2

function rgbToHex (r, g, b) {
  const c = v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')
  return `#${c(r)}${c(g)}${c(b)}`
}

// ── Formation definitions ─────────────────────────────────────────────────
// Each returns an array of node defs: { key, label, isCenter, pos(distance) }

function crossDefs () {
  return [
    { key: 'center', label: 'OmniCore (future) — center', isCenter: true, pos: () => [0, 0, 0] },
    { key: 'up',      label: 'Arm — Up',      pos: d => [0, d, 0] },
    { key: 'down',    label: 'Arm — Down',    pos: d => [0, -d, 0] },
    { key: 'left',    label: 'Arm — Left',    pos: d => [-d, 0, 0] },
    { key: 'right',   label: 'Arm — Right',   pos: d => [d, 0, 0] },
    { key: 'forward', label: 'Arm — Forward', pos: d => [0, 0, -d] },
    { key: 'back',    label: 'Arm — Back',    pos: d => [0, 0, d] },
  ]
}

// One formula, confirmed against every worked example (N=2,3,4,6) —
// clockwise from 12 o'clock, always, no per-count exceptions. Works
// identically for any N, including 8/10/12.
function ringDefs (n) {
  const defs = [{ key: 'center', label: 'OmniCore (future) — center', isCenter: true, pos: () => [0, 0, 0] }]
  for (let i = 0; i < n; i++) {
    const angleDeg = i * (360 / n)
    const rad = angleDeg * Math.PI / 180
    defs.push({
      key: `ring-${i}`,
      label: `Ring Node ${i + 1} — ${Math.round(angleDeg)}°`,
      pos: d => [d * Math.sin(rad), 0, -d * Math.cos(rad)],
    })
  }
  return defs
}

// The canonical spherical Fibonacci lattice — confirmed against the
// standard reference. Distributes N points evenly across a sphere's
// surface in one pass, using the golden ratio as the spiral step —
// the same pattern seen in sunflower seed heads and pinecones. Works
// identically well for any N; no special-casing by count needed.
function sphereDefs (n) {
  const defs = [{ key: 'center', label: 'OmniCore (future) — center', isCenter: true, pos: () => [0, 0, 0] }]
  for (let i = 0; i < n; i++) {
    const y = n > 1 ? 1 - (2 * i) / (n - 1) : 0   // +1 (top) to -1 (bottom)
    const radiusAtY = Math.sqrt(Math.max(0, 1 - y * y))
    const theta = 2 * Math.PI * i / GOLDEN_RATIO
    const ux = Math.cos(theta) * radiusAtY
    const uz = Math.sin(theta) * radiusAtY
    defs.push({
      key: `sphere-${i}`,
      label: `Sphere Node ${i + 1}`,
      pos: d => [ux * d, y * d, uz * d],
    })
  }
  return defs
}

// Spreadsheet-style column letters (0-indexed in, 'A'/'B'/.../'Z'/'AA'/... out) —
// the naming scheme is structural here, not arbitrary, per OMNISYSTEM_DESIGN.md.
function columnLetter (index) {
  let n = index, s = ''
  do { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1 } while (n >= 0)
  return s
}

// Genuine 3D lattice — columns along X, rows along Y, drawers along Z,
// like a filing cabinet. OmniCore is a separate, additional center
// node (never one of the grid cells themselves), positioned at the
// lattice's true geometric center — sidesteps the even/odd "is there
// a real center cell" question entirely, the same way Cross/Ring/
// Sphere already keep OmniCore distinct from their own outer nodes.
// One shared spacing value (d) applies to all three axes at once.
function gridDefs (cols, rows, drawers) {
  const defs = [{ key: 'center', label: 'OmniCore (future) — center', isCenter: true, pos: () => [0, 0, 0] }]
  const colOffset = (cols - 1) / 2
  const rowOffset = (rows - 1) / 2
  const drawerOffset = (drawers - 1) / 2
  for (let dr = 0; dr < drawers; dr++) {
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        const letter = columnLetter(c)
        defs.push({
          key: `grid-d${dr + 1}-${letter}${r + 1}`,
          label: `Grid — Drawer ${dr + 1}, Column ${letter}, Row ${r + 1}`,
          pos: d => [(c - colOffset) * d, (rowOffset - r) * d, (dr - drawerOffset) * d],
        })
      }
    }
  }
  return defs
}

const Y_AXIS = new THREE.Vector3(0, 1, 0)   // hoisted — reused every frame in Star's rotation, never recreated
const GALAXY_ARMS = 3            // fixed — only main node count is user-selected, per the spec
const GALAXY_SPIRAL_TURNS = 2.2   // matches the particle field preset's own default exactly

// Main nodes only — the bulk "galaxy" visual is a separate particle
// field (modules/OmniExpressionator.js's "galaxy" preset), not more
// individual meshes. Same logarithmic-spiral arm placement language as
// that preset, so the two visually agree with each other. OmniCore
// sits at the galaxy's true center, same pattern as every other
// formation — never one of the main nodes itself.
function galaxyDefs (n) {
  const defs = [{ key: 'center', label: 'OmniCore (future) — center', isCenter: true, pos: () => [0, 0, 0] }]
  for (let i = 0; i < n; i++) {
    const armIndex = i % GALAXY_ARMS
    const t = Math.floor(i / GALAXY_ARMS) / Math.max(1, Math.ceil(n / GALAXY_ARMS))
    const angle = armIndex * (2 * Math.PI / GALAXY_ARMS) + t * GALAXY_SPIRAL_TURNS * 2 * Math.PI
    defs.push({
      key: `galaxy-${i}`,
      label: `Galaxy Main Node ${i + 1}`,
      pos: d => [t * d * Math.cos(angle), 0, t * d * Math.sin(angle)],
    })
  }
  return defs
}

const SPIRAL_ANGLE_STEP = (40 * Math.PI) / 180   // 40° per node — enough turns to read as a spiral over a reasonable N
const SPIRAL_RADIUS_GROWTH = 0.35   // radius grows per node, scaled by d — the thing that distinguishes this from Ring, which holds radius constant
const SPIRAL_HEIGHT_STEP = 0.25     // vertical drift per node, scaled by d

// One core spiral formula, shared by both formations below — a single
// strand at phaseOffset=0 is Single Spiral; Helix is exactly this same
// formula called twice with a second strand at phaseOffset=π, per
// OMNISYSTEM_DESIGN.md's own framing of Helix as "not a new mechanic."
function spiralPoint (i, d, phaseOffset = 0) {
  const angle = i * SPIRAL_ANGLE_STEP + phaseOffset
  const radius = i * d * SPIRAL_RADIUS_GROWTH
  const y = i * d * SPIRAL_HEIGHT_STEP
  return [radius * Math.cos(angle), y, radius * Math.sin(angle)]
}

function spiralDefs (n) {
  const defs = [{ key: 'center', label: 'OmniCore (future) — center', isCenter: true, pos: () => [0, 0, 0] }]
  for (let i = 1; i <= n; i++) {
    defs.push({ key: `spiral-${i}`, label: `Spiral Node ${i}`, pos: d => spiralPoint(i, d) })
  }
  return defs
}

function helixDefs (n) {
  const defs = [{ key: 'center', label: 'OmniCore (future) — center', isCenter: true, pos: () => [0, 0, 0] }]
  const perStrand = Math.ceil(n / 2)
  for (let i = 1; i <= n; i++) {
    const strand = (i - 1) % 2          // 0 or 1 — which of the two strands this node belongs to
    const step = Math.floor((i - 1) / 2) + 1   // this node's position along its own strand
    const phaseOffset = strand === 0 ? 0 : Math.PI
    defs.push({
      key: `helix-s${strand + 1}-${step}`,
      label: `Helix Strand ${strand + 1} — Node ${step}`,
      pos: d => spiralPoint(step, d, phaseOffset),
    })
  }
  return defs
}

// Deliberately NOT deterministic like every other formation's defs —
// "shoot out at random" is the actual aesthetic here, not an
// implementation detail to hide; re-generating a Star is meant to
// give a genuinely different spike arrangement each time, the same
// way clicking Generate again for other formations just re-runs the
// same fixed formula. Count = number of spikes, one node per spike
// tip, exactly as specified. This only sets each spike's STARTING
// direction — the live, continuous random drift happens after
// creation, in the panel's own update() loop below, since a fixed
// pos(d) formula can't express "keeps moving over time" at all.
function starDefs (n) {
  const defs = [{ key: 'center', label: 'OmniCore (future) — center', isCenter: true, pos: () => [0, 0, 0] }]
  for (let i = 1; i <= n; i++) {
    // Random point on a unit sphere — uniform, not clustered at the poles
    const u = Math.random(), v = Math.random()
    const theta = 2 * Math.PI * u
    const phi = Math.acos(2 * v - 1)
    const dir = [Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta)]
    defs.push({
      key: `star-${i}`,
      label: `Star Spike ${i}`,
      pos: d => [dir[0] * d, dir[1] * d, dir[2] * d],
    })
  }
  return defs
}

const STYLES = `

.omni-syscreator-panel {
  pointer-events   : auto;
  --sc-bg          : var(--omni-theme-bg, rgba(8, 8, 12, 0.92));
  --sc-border      : var(--omni-theme-border, rgba(255, 255, 255, 0.09));
  --sc-header-bg   : var(--omni-theme-header-bg, rgba(255, 255, 255, 0.03));
  --sc-text        : var(--omni-theme-text, rgba(255, 255, 255, 0.9));
  --sc-text-dim    : var(--omni-theme-text-dim, rgba(255, 255, 255, 0.6));
  --sc-input-bg    : var(--omni-theme-input-bg, rgba(255, 255, 255, 0.04));
  --sc-input-border: var(--omni-theme-input-border, rgba(255, 255, 255, 0.18));
  --sc-accent      : var(--omni-theme-accent, rgba(255, 178, 127, 0.9));
  --mono           : 'Courier New', Courier, monospace;

  position         : fixed;
  top              : 60px;
  left             : 120px;
  width            : 480px;
  min-width        : 380px;
  max-width        : 94vw;
  height           : 640px;
  min-height       : 340px;
  max-height       : 90vh;

  display          : flex;
  flex-direction   : column;

  background       : var(--sc-bg);
  backdrop-filter  : blur(22px) saturate(1.5);
  -webkit-backdrop-filter: blur(22px) saturate(1.5);
  border           : 1px solid var(--sc-border);
  border-radius    : 14px;
  box-shadow       : 0 0 24px rgba(0,0,0,0.4), 0 12px 40px rgba(0,0,0,0.55);

  font-family      : var(--mono);
  z-index          : 60;
  overflow         : hidden;
  opacity          : 0;
  visibility       : hidden;
}

.sc-header {
  height           : 40px;
  flex-shrink      : 0;
  display          : flex;
  align-items      : center;
  justify-content  : center;
  background       : var(--sc-header-bg);
  border-bottom    : 1px solid var(--sc-border);
  cursor           : grab;
  user-select      : none;
  position         : relative;
}
.sc-header.is-dragging { cursor: grabbing; }
.sc-title { font-size: 11px; letter-spacing: 0.05em; color: var(--sc-text-dim); }
.sc-controls { position: absolute; right: 8px; display: flex; gap: 4px; }
.sc-ctrl {
  width: 20px; height: 20px; border-radius: 5px;
  border: 1px solid var(--sc-border);
  background: rgba(255,255,255,0.04);
  color: var(--sc-text-dim);
  font-size: 11px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
}
.sc-ctrl:hover { background: rgba(255,255,255,0.1); color: var(--sc-text); }

.sc-formation-row {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 14px; border-bottom: 1px solid var(--sc-border); flex-shrink: 0; flex-wrap: wrap;
}
.sc-formation-row label { font-size: 10.5px; color: var(--sc-text-dim); }
.sc-formation-row select, .sc-formation-row input {
  background: var(--sc-input-bg); border: 1px solid var(--sc-input-border);
  border-radius: 4px; color: var(--sc-text); font-family: var(--mono);
  font-size: 10.5px; padding: 4px 6px;
}
.sc-count-input { width: 55px; }
.sc-grid-only { display: inline-flex; align-items: center; gap: 4px; }
.sc-grid-only label { font-size: 10.5px; color: var(--sc-text-dim); }
.sc-grid-only input { width: 42px; }
.sc-lock-btn {
  padding: 5px 12px; border-radius: 5px; cursor: pointer;
  border: 1px solid rgba(255, 178, 127, 0.3);
  background: rgba(255, 178, 127, 0.08); color: var(--sc-accent);
  font-family: var(--mono); font-size: 10.5px;
}
.sc-lock-btn.is-unlocked { background: rgba(255,255,255,0.04); color: var(--sc-text-dim); border-color: var(--sc-input-border); }
.sc-gen-btn {
  padding: 5px 12px; border-radius: 5px; cursor: pointer;
  border: 1px solid rgba(255, 178, 127, 0.3);
  background: rgba(255, 178, 127, 0.08); color: var(--sc-accent);
  font-family: var(--mono); font-size: 10.5px;
}
.sc-gen-btn:hover { background: rgba(255, 178, 127, 0.16); }

.sc-origin-row {
  padding: 8px 14px 10px; border-bottom: 1px solid var(--sc-border); flex-shrink: 0;
}
.sc-origin-title { font-size: 9px; color: var(--sc-text-dim); margin-bottom: 6px; }
.sc-origin-grid { display: flex; gap: 12px; flex-wrap: wrap; }
.sc-origin-group { display: flex; align-items: center; gap: 4px; }
.sc-origin-group span { font-size: 9px; color: var(--sc-accent); min-width: 46px; }
.sc-origin-group input {
  width: 48px; background: var(--sc-input-bg); border: 1px solid var(--sc-input-border);
  border-radius: 4px; color: var(--sc-text); font-family: var(--mono); font-size: 10px; padding: 3px 4px;
}

.sc-body { flex: 1 1 auto; overflow-y: auto; padding: 10px 14px; }
.sc-body::-webkit-scrollbar { width: 6px; }
.sc-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 3px; }
.sc-empty { font-size: 10.5px; color: var(--sc-text-dim); text-align: center; padding: 30px 10px; }

.sc-node-row {
  border: 1px solid var(--sc-input-border); border-radius: 8px;
  padding: 8px 10px; margin-bottom: 8px; display: flex; gap: 10px;
}
.sc-preview {
  width: 40px; height: 40px; flex-shrink: 0; border-radius: 6px;
  background: var(--sc-input-bg); border: 1px solid var(--sc-input-border);
  display: flex; align-items: center; justify-content: center; font-size: 20px;
}
.sc-node-main { flex: 1; min-width: 0; }
.sc-node-head { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.sc-node-index { font-size: 9.5px; color: var(--sc-accent); white-space: nowrap; }
.sc-goto-btn {
  margin-left: auto; background: var(--sc-input-bg); border: 1px solid var(--sc-input-border);
  border-radius: 4px; font-size: 11px; padding: 2px 6px; cursor: pointer; color: var(--sc-text);
}
.sc-goto-btn:hover:not(:disabled) { background: rgba(255, 178, 127, 0.16); }
.sc-goto-btn:disabled { opacity: 0.35; cursor: not-allowed; }
.sc-node-label-input {
  flex: 1; background: var(--sc-input-bg);
  border: 1px solid var(--sc-input-border); border-radius: 4px;
  color: var(--sc-text); font-family: var(--mono); font-size: 10.5px; padding: 3px 6px;
}
.sc-node-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 10px; }
.sc-field { display: flex; flex-direction: column; gap: 2px; }
.sc-field label { font-size: 9px; color: var(--sc-text-dim); }
.sc-field select, .sc-field input {
  background: var(--sc-input-bg); border: 1px solid var(--sc-input-border);
  border-radius: 4px; color: var(--sc-text); font-family: var(--mono);
  font-size: 10px; padding: 3px 5px;
}
.sc-rgba-row { display: flex; gap: 6px; grid-column: 1 / -1; }
.sc-rgba-row .sc-field { flex: 1; }
.sc-range-row { grid-column: 1 / -1; display: flex; align-items: center; gap: 6px; }
.sc-range-row input[type="range"] { flex: 1; }
.sc-range-row input[type="number"] { width: 60px; }
.sc-center-note { grid-column: 1 / -1; font-size: 8.5px; color: var(--sc-text-dim); opacity: 0.7; }

.sc-save-row { padding: 10px 14px; border-top: 1px solid var(--sc-border); flex-shrink: 0; }
.sc-save-btn {
  width: 100%; padding: 8px; border-radius: 6px;
  border: 1px solid rgba(255, 178, 127, 0.3);
  background: rgba(255, 178, 127, 0.08); color: var(--sc-accent);
  font-family: var(--mono); font-size: 11px; cursor: pointer;
}
.sc-save-btn:hover { background: rgba(255, 178, 127, 0.16); }
.sc-save-status { font-size: 9px; color: var(--sc-text-dim); text-align: center; margin-top: 5px; min-height: 12px; }
.sc-alpha-note { font-size: 8.5px; color: var(--sc-text-dim); opacity: 0.7; text-align: center; margin-top: 2px; }

.sc-resize-handle { position: absolute; right: 0; bottom: 0; width: 16px; height: 16px; cursor: nwse-resize; }
.sc-resize-handle::before {
  content: ''; position: absolute; right: 3px; bottom: 3px; width: 8px; height: 8px;
  border-right: 2px solid rgba(255,255,255,0.25); border-bottom: 2px solid rgba(255,255,255,0.25);
}

`

function injectStyles () {
  if (document.getElementById('omni-syscreator-styles')) return
  const tag = document.createElement('style')
  tag.id = 'omni-syscreator-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

let _idCounter = 0
function makeId () { return `omnisystem-${Date.now()}-${_idCounter++}` }

export default class OmniSystemCreatorPanel {
  constructor (context, nodeLoader, expressionator) {
    this.ctx = context
    this.nodeLoader = nodeLoader
    this.expressionator = expressionator
    // Star systems need a genuine, continuous per-frame animation —
    // unlike every other formation, which just places nodes once.
    // Keyed by systemInstanceId so multiple Star systems can each
    // animate independently, same reasoning as Galaxy's own
    // multi-instance particle fields.
    this._activeStars = new Map()
    this._starScratchVec3 = new THREE.Vector3()   // reused every frame in update(), never recreated
    this._el = null
    this._isOpen = false
    this._generated = false
    this._locked = true
    this._formation = 'cross'
    // System-level transform — where OmniCore (and therefore the whole
    // system, anchored to it) actually lives in the world. Defaults to
    // identity so nothing changes unless explicitly set.
    this._origin = { px: 0, py: 0, pz: 0, rx: 0, ry: 0, rz: 0, sx: 1, sy: 1, sz: 1 }
    this._drag = { active: false }
  }

  init () {
    injectStyles()
    this._onNavSelect = (e) => {
      if (e.detail?.item !== '⟐OmniSystemCreator') return
      this.open()
    }
    window.addEventListener('omni:nav-select', this._onNavSelect)

    // A deleted system's particle field (if it had one — only Galaxy
    // systems do) has to go with it, or it's orphaned in the scene
    // forever with nothing left pointing back to it.
    this._onSystemDeleted = (e) => {
      const id = e.detail?.systemInstanceId
      if (!id) return
      this.expressionator?.stop(id)
      this._activeStars.delete(id)
    }
    window.addEventListener('omni:delete-system-request', this._onSystemDeleted)
  }

  update (delta = 0.016) {
    if (this._activeStars.size === 0) return
    const DRIFT_STRENGTH = 0.4      // how much each spike's direction wanders per second — organic, not chaotic
    const ROTATE_SPEED = 0.25       // radians/sec for rotating stars

    for (const star of this._activeStars.values()) {
      if (star.rotating) {
        star.rotationAngle += ROTATE_SPEED * delta
      }
      // OmniCore may have been dragged since creation — spikes must
      // follow its real, current position, not the position it had
      // at the moment the system was created.
      const livePos = star.centerMesh ? star.centerMesh.position : star.centerPos

      for (const spike of star.spikes) {
        // Small random walk on the unit sphere: nudge, then
        // renormalize — direction wanders continuously but never
        // grows or shrinks, so spike length stays constant.
        spike.dir.x += (Math.random() - 0.5) * DRIFT_STRENGTH * delta
        spike.dir.y += (Math.random() - 0.5) * DRIFT_STRENGTH * delta
        spike.dir.z += (Math.random() - 0.5) * DRIFT_STRENGTH * delta
        spike.dir.normalize()

        let dir = spike.dir
        if (star.rotating) {
          dir = this._starScratchVec3.copy(spike.dir).applyAxisAngle(Y_AXIS, star.rotationAngle)
        }
        spike.mesh.position.set(
          livePos.x + dir.x * spike.length,
          livePos.y + dir.y * spike.length,
          livePos.z + dir.z * spike.length,
        )
      }
    }
  }
  onResize () {}

  destroy () {
    window.removeEventListener('omni:nav-select', this._onNavSelect)
    window.removeEventListener('omni:delete-system-request', this._onSystemDeleted)
    this._el?.parentNode?.removeChild(this._el)
    WindowManager.unregister('syscreator')
  }

  open () {
    if (!this._el) this._el = this._buildDOM()
    const shell = document.getElementById('omni-ui') ?? document.body
    if (!this._el.parentNode) shell.appendChild(this._el)
    this._el.style.visibility = 'visible'
    gsap.to(this._el, { opacity: WindowManager.getPanelOpacity(), duration: 0.25 })
    this._isOpen = true
  }

  close () {
    if (!this._el) return
    gsap.to(this._el, { opacity: 0, duration: 0.18, onComplete: () => { this._el.style.visibility = 'hidden' } })
    this._isOpen = false
  }

  minimize () {
    if (!this._el) return
    const rect = this._el.getBoundingClientRect()
    gsap.to(this._el, { opacity: 0, scale: 0.3, duration: 0.2, onComplete: () => { this._el.style.visibility = 'hidden' } })
    this._isOpen = false
    window.dispatchEvent(new CustomEvent('omni:panel-minimized', {
      detail: {
        id: 'syscreator', label: '⟐OmniSystemCreator', iconLabel: '⟐SC',
        fromRect: { x: rect.left, y: rect.top, w: rect.width, h: rect.height },
        variant: 'orb',
      }
    }))
  }

  // ── Generation ────────────────────────────────────────────────────────

  _currentDefs () {
    if (this._formation === 'ring') {
      const n = Math.max(2, Math.min(MAX_RING_NODES, parseInt(this._el.querySelector('.sc-count-input')?.value, 10) || 6))
      return ringDefs(n)
    }
    if (this._formation === 'sphere') {
      const n = Math.max(2, Math.min(MAX_SPHERE_NODES, parseInt(this._el.querySelector('.sc-count-input')?.value, 10) || 64))
      return sphereDefs(n)
    }
    if (this._formation === 'galaxy') {
      const n = Math.max(1, Math.min(MAX_GALAXY_NODES, parseInt(this._el.querySelector('.sc-count-input')?.value, 10) || 30))
      return galaxyDefs(n)
    }
    if (this._formation === 'spiral') {
      const n = Math.max(2, Math.min(MAX_SPIRAL_NODES, parseInt(this._el.querySelector('.sc-count-input')?.value, 10) || 40))
      return spiralDefs(n)
    }
    if (this._formation === 'helix') {
      const n = Math.max(2, Math.min(MAX_HELIX_NODES, parseInt(this._el.querySelector('.sc-count-input')?.value, 10) || 40))
      return helixDefs(n)
    }
    if (this._formation === 'star') {
      const n = Math.max(2, Math.min(MAX_STAR_NODES, parseInt(this._el.querySelector('.sc-count-input')?.value, 10) || 20))
      return starDefs(n)
    }
    if (this._formation === 'grid') {
      let cols = Math.max(1, Math.min(MAX_GRID_AXIS, parseInt(this._el.querySelector('.sc-grid-cols')?.value, 10) || 3))
      let rows = Math.max(1, Math.min(MAX_GRID_AXIS, parseInt(this._el.querySelector('.sc-grid-rows')?.value, 10) || 3))
      let drawers = Math.max(1, Math.min(MAX_GRID_AXIS, parseInt(this._el.querySelector('.sc-grid-drawers')?.value, 10) || 3))
      // Enforce the total cap by scaling back drawers first, then rows,
      // then columns — keeps the visible column×row grid intact for as
      // long as possible, since drawers are depth layers the user is
      // least likely to be looking directly at.
      while (cols * rows * drawers > MAX_GRID_TOTAL && drawers > 1) drawers--
      while (cols * rows * drawers > MAX_GRID_TOTAL && rows > 1) rows--
      while (cols * rows * drawers > MAX_GRID_TOTAL && cols > 1) cols--
      return gridDefs(cols, rows, drawers)
    }
    return crossDefs()
  }

  _generate () {
    this._generated = true
    this._defs = this._currentDefs()
    this._distances = {}
    this._nodeMeta = {}
    this._defs.forEach(def => {
      if (!def.isCenter) this._distances[def.key] = DEFAULT_DISTANCE
      this._nodeMeta[def.key] = { label: def.label, geometry: 'BoxGeometry', primitive: 'objective', r: 255, g: 255, b: 255, a: 1 }
    })
    this._sharedDistance = DEFAULT_DISTANCE
    this._renderNodeList()
  }

  _toggleLock () {
    this._locked = !this._locked
    if (this._generated) this._renderNodeList()
  }

  _renderNodeList () {
    const list = this._el.querySelector('.sc-body')
    list.innerHTML = ''

    this._defs.forEach(def => {
      const meta = this._nodeMeta[def.key]
      const row = document.createElement('div')
      row.className = 'sc-node-row'
      row.dataset.key = def.key

      const distanceLabel = this._formation === 'grid' ? 'Spacing'
        : this._formation === 'galaxy' ? 'Arm reach'
        : this._formation === 'star' ? 'Spike length'
        : (this._formation === 'spiral' || this._formation === 'helix') ? 'Scale'
        : (this._formation === 'ring' || this._formation === 'sphere') ? 'Radius' : 'Distance'
      const rangeFieldHTML = def.isCenter ? '' : `
        <div class="sc-range-row">
          <label style="min-width:70px">${distanceLabel}${this._locked ? ' (shared)' : ''}</label>
          <input type="range" data-field="distance" min="0" max="${MAX_DISTANCE}" step="0.5"
                 value="${this._locked ? this._sharedDistance : this._distances[def.key]}">
          <input type="number" data-field="distance-num" min="0" max="${MAX_DISTANCE}" step="0.5"
                 value="${this._locked ? this._sharedDistance : this._distances[def.key]}">
        </div>`

      row.innerHTML = `
        <div class="sc-preview" data-role="preview">${GEO_ICONS[meta.geometry] ?? '◈'}</div>
        <div class="sc-node-main">
          <div class="sc-node-head">
            <span class="sc-node-index">${def.label}</span>
            <button class="sc-goto-btn" data-goto="${def.key}" disabled title="Create the system first">🎯</button>
          </div>
          <input class="sc-node-label-input" data-field="label" value="${meta.label}">
          <div class="sc-node-grid">
            <div class="sc-field">
              <label>Shape</label>
              <select data-field="geometry">
                ${GEOMETRIES.map(g => `<option value="${g}" ${g === meta.geometry ? 'selected' : ''}>${g}</option>`).join('')}
              </select>
            </div>
            <div class="sc-field">
              <label>Truth (primitive)</label>
              <select data-field="primitive">
                ${PRIMITIVES.map(p => `<option value="${p}" ${p === meta.primitive ? 'selected' : ''}>${p}</option>`).join('')}
              </select>
            </div>
            <div class="sc-rgba-row">
              <div class="sc-field"><label>R</label><input type="number" min="0" max="255" data-field="r" value="${meta.r}"></div>
              <div class="sc-field"><label>G</label><input type="number" min="0" max="255" data-field="g" value="${meta.g}"></div>
              <div class="sc-field"><label>B</label><input type="number" min="0" max="255" data-field="b" value="${meta.b}"></div>
              <div class="sc-field"><label>A</label><input type="number" min="0" max="1" step="0.05" data-field="a" value="${meta.a}"></div>
            </div>
            ${rangeFieldHTML}
            ${def.isCenter ? '<div class="sc-center-note">Center is always the origin — not a distance field.</div>' : ''}
          </div>
        </div>
      `
      list.appendChild(row)

      row.querySelector('[data-field="geometry"]')?.addEventListener('change', (e) => {
        meta.geometry = e.target.value
        row.querySelector('[data-role="preview"]').textContent = GEO_ICONS[meta.geometry] ?? '◈'
      })
      row.querySelector('[data-field="label"]')?.addEventListener('change', (e) => { meta.label = e.target.value })
      row.querySelector('[data-field="primitive"]')?.addEventListener('change', (e) => { meta.primitive = e.target.value })
      row.querySelector('[data-goto]')?.addEventListener('click', () => {
        const mesh = this._createdMeshes?.[def.key]
        if (mesh) window.dispatchEvent(new CustomEvent('omni:goto-mesh-request', { detail: { mesh } }))
      })
      ;['r', 'g', 'b', 'a'].forEach(ch => {
        row.querySelector(`[data-field="${ch}"]`)?.addEventListener('change', (e) => { meta[ch] = Number(e.target.value) })
      })

      if (!def.isCenter) {
        const slider = row.querySelector('[data-field="distance"]')
        const numInput = row.querySelector('[data-field="distance-num"]')
        const onDistanceChange = (value) => {
          if (this._locked) {
            this._sharedDistance = value
            this._el.querySelectorAll('.sc-node-row').forEach(r => {
              if (r.dataset.key === 'center') return
              r.querySelector('[data-field="distance"]').value = value
              r.querySelector('[data-field="distance-num"]').value = value
            })
          } else {
            this._distances[def.key] = value
          }
        }
        slider.addEventListener('input', () => { numInput.value = slider.value; onDistanceChange(Number(slider.value)) })
        numInput.addEventListener('input', () => {
          const clamped = Math.min(MAX_DISTANCE, Math.max(0, Number(numInput.value) || 0))
          slider.value = clamped
          onDistanceChange(clamped)
        })
      }
    })
  }

  _applyOrigin (localPos) {
    const { px, py, pz, rx, ry, rz, sx, sy, sz } = this._origin
    const v = new THREE.Vector3(localPos[0] * sx, localPos[1] * sy, localPos[2] * sz)
    const euler = new THREE.Euler(
      THREE.MathUtils.degToRad(rx),
      THREE.MathUtils.degToRad(ry),
      THREE.MathUtils.degToRad(rz),
      'XYZ'
    )
    v.applyEuler(euler)
    v.add(new THREE.Vector3(px, py, pz))
    return [v.x, v.y, v.z]
  }

  _readRows () {
    return this._defs.map(def => {
      const meta = this._nodeMeta[def.key]
      const distance = def.isCenter ? 0 : (this._locked ? this._sharedDistance : this._distances[def.key])
      const localPos = def.pos(distance)
      const [x, y, z] = this._applyOrigin(localPos)
      return { ...meta, x, y, z, isCenter: !!def.isCenter, key: def.key }
    })
  }

  _createSystem () {
    if (!this._generated) return
    const rows = this._readRows()
    let created = 0
    const errors = []
    // Shared by every node from this one click — the thing that lets
    // "delete this whole system" mean something at all, since nothing
    // previously tied a batch of created nodes back together as one unit.
    const systemInstanceId = `sysinstance-${Date.now()}-${Math.floor(Math.random() * 10000)}`

    for (const row of rows) {
      const data = {
        id: makeId(),
        label: row.label,
        geometry: row.geometry,
        primitive: row.primitive,
        color: rgbToHex(row.r, row.g, row.b),
        position: [row.x, row.y, row.z],
        createdAt: new Date().toISOString(),
        systemInstanceId,
        isOmniCore: row.isCenter,
        // Half the size of an OmniDraw/hand-placed node's default (1
        // -> 0.5) — easier on the OS as a whole, since a single system
        // can hold dozens of nodes at once, unlike a single hand-placed one.
        scale: 0.5,
      }
      try {
        const { mesh } = this.nodeLoader.loadNode(data)
        if (mesh?.material && row.a < 1) {
          mesh.material.transparent = true
          mesh.material.opacity = row.a
        }
        this._createdMeshes = this._createdMeshes || {}
        this._createdMeshes[row.key] = mesh
        const btn = this._el.querySelector(`[data-goto="${row.key}"]`)
        if (btn) { btn.disabled = false; btn.title = 'Take me there' }
        created++
      } catch (err) {
        errors.push(`${row.label}: ${err.message}`)
      }
    }

    const status = this._el.querySelector('.sc-save-status')
    status.textContent = errors.length
      ? `Created ${created}/${rows.length} — ${errors.length} failed (see console)`
      : `Created ${created} node${created === 1 ? '' : 's'}`
    if (errors.length) console.error('⟐ OmniSystemCreator — some nodes failed:', errors)

    if (this._formation === 'galaxy' && created > 0) {
      const centerRow = rows.find(r => r.isCenter)
      const reach = this._locked ? this._sharedDistance : Math.max(...rows.filter(r => !r.isCenter).map(r => this._distances[r.key] ?? DEFAULT_DISTANCE))
      this.expressionator?.play('galaxy', {
        center: centerRow ? [centerRow.x, centerRow.y, centerRow.z] : [0, 0, 0],
        radius: reach * 1.4,   // particle field reaches a bit past the main nodes, not stopping exactly at them
      }, systemInstanceId)
    }

    if (this._formation === 'star' && created > 0) {
      const centerRow = rows.find(r => r.isCenter)
      const centerMesh = this._createdMeshes[centerRow?.key]
      const spikes = []
      for (const row of rows) {
        if (row.isCenter) continue
        const mesh = this._createdMeshes[row.key]
        if (!mesh || !centerRow) continue
        const offset = new THREE.Vector3(row.x - centerRow.x, row.y - centerRow.y, row.z - centerRow.z)
        const length = offset.length()
        if (length < 0.0001) continue   // degenerate spike, nothing meaningful to animate
        spikes.push({ mesh, dir: offset.normalize(), length })
      }
      this._activeStars.set(systemInstanceId, {
        centerMesh,
        centerPos: new THREE.Vector3(centerRow.x, centerRow.y, centerRow.z),
        spikes,
        rotating: this._el.querySelector('.sc-star-rotating')?.checked ?? false,
        rotationAngle: 0,
      })
    }
  }

  _buildDOM () {
    const el = document.createElement('div')
    el.className = 'omni-syscreator-panel'
    el.innerHTML = `
      <div class="sc-header">
        <span class="sc-title">⟐OmniSystem Inspector</span>
        <div class="sc-controls">
          <button class="sc-ctrl" data-action="minimize" title="Minimize">–</button>
          <button class="sc-ctrl" data-action="close" title="Close">×</button>
        </div>
      </div>
      <div class="sc-formation-row">
        <label>Formation</label>
        <select data-field="formation">
          <option value="cross">Skeletal Cross (fixed 7)</option>
          <option value="ring">Radial Ring (Stonehenge)</option>
          <option value="sphere">Sphere (Fibonacci)</option>
          <option value="grid">Grid (columns × rows × drawers)</option>
          <option value="galaxy">Galaxy (spiral arms + particle field)</option>
          <option value="spiral">Single Spiral</option>
          <option value="helix">Helix (Double Spiral)</option>
          <option value="star">Star (random spikes)</option>
        </select>
        <label class="sc-star-only" style="display:none">
          <input type="checkbox" class="sc-star-rotating"> Rotating
        </label>
        <label class="sc-count-only" style="display:none">Outer nodes</label>
        <input class="sc-count-input sc-count-only" type="number" min="2" max="${MAX_SPHERE_NODES}" value="6" style="display:none">
        <span class="sc-grid-only" style="display:none">
          <label>Cols</label><input class="sc-grid-cols" type="number" min="1" max="${MAX_GRID_AXIS}" value="3">
          <label>Rows</label><input class="sc-grid-rows" type="number" min="1" max="${MAX_GRID_AXIS}" value="3">
          <label>Drawers</label><input class="sc-grid-drawers" type="number" min="1" max="${MAX_GRID_AXIS}" value="3">
        </span>
        <button class="sc-lock-btn" data-action="toggle-lock">Locked (shared)</button>
        <button class="sc-gen-btn" data-action="generate">Generate</button>
      </div>
      <div class="sc-origin-row">
        <div class="sc-origin-title">OmniCore Origin — where the whole system lives, as a unit</div>
        <div class="sc-origin-grid">
          <div class="sc-origin-group">
            <span>Position</span>
            <input type="number" step="0.5" data-origin="px" value="0" title="X"><input type="number" step="0.5" data-origin="py" value="0" title="Y"><input type="number" step="0.5" data-origin="pz" value="0" title="Z">
          </div>
          <div class="sc-origin-group">
            <span>Rotation °</span>
            <input type="number" step="5" data-origin="rx" value="0" title="X"><input type="number" step="5" data-origin="ry" value="0" title="Y"><input type="number" step="5" data-origin="rz" value="0" title="Z">
          </div>
          <div class="sc-origin-group">
            <span>Scale</span>
            <input type="number" step="0.1" min="0.01" data-origin="sx" value="1" title="X"><input type="number" step="0.1" min="0.01" data-origin="sy" value="1" title="Y"><input type="number" step="0.1" min="0.01" data-origin="sz" value="1" title="Z">
          </div>
        </div>
      </div>
      <div class="sc-body"><div class="sc-empty">Choose a formation and click "Generate" to begin.</div></div>
      <div class="sc-save-row">
        <button class="sc-save-btn" data-action="create">Create System</button>
        <div class="sc-save-status"></div>
        <div class="sc-alpha-note">Alpha is applied live to created nodes but isn't saved — a reload resets it to opaque.</div>
      </div>
      <div class="sc-resize-handle" aria-hidden="true"></div>
    `

    this._bindHeader(el)
    this._bindResize(el)
    el.querySelector('[data-action="minimize"]').addEventListener('click', () => this.minimize())
    el.querySelector('[data-action="close"]').addEventListener('click', () => this.close())
    el.querySelector('[data-action="generate"]').addEventListener('click', () => this._generate())
    el.querySelector('[data-action="create"]').addEventListener('click', () => this._createSystem())
    el.querySelector('[data-action="toggle-lock"]').addEventListener('click', (e) => {
      this._toggleLock()
      e.target.textContent = this._locked ? 'Locked (shared)' : 'Unlocked (individual)'
      e.target.classList.toggle('is-unlocked', !this._locked)
    })
    el.querySelector('[data-field="formation"]').addEventListener('change', (e) => {
      this._formation = e.target.value
      const showCount = this._formation === 'ring' || this._formation === 'sphere' || this._formation === 'galaxy' || this._formation === 'spiral' || this._formation === 'helix' || this._formation === 'star'
      el.querySelectorAll('.sc-count-only').forEach(node => { node.style.display = showCount ? '' : 'none' })
      const countInput = el.querySelector('.sc-count-input')
      if (this._formation === 'ring') { countInput.value = '6'; countInput.max = String(MAX_RING_NODES) }
      if (this._formation === 'sphere') { countInput.value = '64'; countInput.max = String(MAX_SPHERE_NODES) }
      if (this._formation === 'galaxy') { countInput.value = '30'; countInput.max = String(MAX_GALAXY_NODES) }
      if (this._formation === 'spiral') { countInput.value = '40'; countInput.max = String(MAX_SPIRAL_NODES) }
      if (this._formation === 'helix') { countInput.value = '40'; countInput.max = String(MAX_HELIX_NODES) }
      if (this._formation === 'star') { countInput.value = '20'; countInput.max = String(MAX_STAR_NODES) }
      const starGroup = el.querySelector('.sc-star-only')
      if (starGroup) starGroup.style.display = this._formation === 'star' ? '' : 'none'
      const gridGroup = el.querySelector('.sc-grid-only')
      if (gridGroup) gridGroup.style.display = this._formation === 'grid' ? '' : 'none'
    })

    el.querySelectorAll('[data-origin]').forEach(input => {
      input.addEventListener('input', () => {
        const key = input.dataset.origin
        const val = parseFloat(input.value)
        this._origin[key] = Number.isFinite(val) ? val : (key.startsWith('s') ? 1 : 0)
      })
    })

    el.dataset.winId = 'syscreator'
    WindowManager.register('syscreator', el, 'OmniSystem Inspector')
    WindowManager.watchPanelOpacity(el, () => this._isOpen)

    return el
  }

  _bindHeader (el) {
    const header = el.querySelector('.sc-header')
    const onDown = (e) => {
      if (e.target.closest('button')) return
      const cx = e.touches?.[0]?.clientX ?? e.clientX
      const cy = e.touches?.[0]?.clientY ?? e.clientY
      const rect = el.getBoundingClientRect()
      this._drag = { active: true, startX: cx, startY: cy, originX: rect.left, originY: rect.top }
      header.classList.add('is-dragging')
    }
    const onMove = (e) => {
      if (!this._drag.active) return
      const cx = e.touches?.[0]?.clientX ?? e.clientX
      const cy = e.touches?.[0]?.clientY ?? e.clientY
      gsap.set(el, { left: this._drag.originX + (cx - this._drag.startX), top: this._drag.originY + (cy - this._drag.startY) })
    }
    const onUp = () => { this._drag.active = false; header.classList.remove('is-dragging') }
    header.addEventListener('mousedown', onDown)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    header.addEventListener('touchstart', onDown, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', onUp)
  }

  _bindResize (el) {
    const handle = el.querySelector('.sc-resize-handle')
    if (!handle) return
    const resize = { active: false }
    const onDown = (e) => {
      e.stopPropagation()
      const cx = e.touches?.[0]?.clientX ?? e.clientX
      const cy = e.touches?.[0]?.clientY ?? e.clientY
      const rect = el.getBoundingClientRect()
      resize.active = true; resize.startX = cx; resize.startY = cy; resize.startW = rect.width; resize.startH = rect.height
    }
    const onMove = (e) => {
      if (!resize.active) return
      const cx = e.touches?.[0]?.clientX ?? e.clientX
      const cy = e.touches?.[0]?.clientY ?? e.clientY
      gsap.set(el, { width: resize.startW + (cx - resize.startX), height: resize.startH + (cy - resize.startY) })
    }
    const onUp = () => { resize.active = false }
    handle.addEventListener('mousedown', onDown)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    handle.addEventListener('touchstart', onDown, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', onUp)
  }
}
