/**
 * ui/OmniDraw.js — ⟐mniReality OmniDraw (formerly the Object Panel)
 *
 * The authoring panel for "container" objects — the base form every
 * reality starts as (default: cube). Opens from the top-left ⟐mniHand
 * drawer ('⟐mniMenu' → '⟐OmniDraw™' — a top-level trademark item, not
 * nested under a parent).
 *
 * Draggable, glass-themed to match ui/Panel.js. Contains a small LIVE
 * Three.js preview (its own tiny renderer/scene, not the main scene) so
 * you can see the container object update as you edit it — cube by
 * default, with a "⟐ Domain Expansion" trigger that morphs it to a
 * sphere.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * What's actually LIVE in this pass vs. schema-only
 * ─────────────────────────────────────────────────────────────────────────────
 *   LIVE   — position / rotation / scale, wireframe, alpha/transparency,
 *            mesh type (material swap), cube↔sphere morph, draggable
 *            toggle (drags the panel itself), minimize → orb icon
 *   SCHEMA-ONLY (stored, editable, NOT yet rendered/behavioral) —
 *            particles, particle wind, particle shape, video embed,
 *            image embed, image→particle tie, automatic axis/rotation
 *            systems, external/internal cycle rotation. These need real
 *            subsystems (texture pipeline, particle emitter, orbit-ring
 *            mesh generation) — tracked in BACKLOG.md, not built here.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Modes
 * ─────────────────────────────────────────────────────────────────────────────
 *   Edit  — the property list (default)
 *   Drag  — shortcut that just toggles ID_Draggable and returns to Edit
 *   Enter — "enter this container as a space" — NOT wired yet (stub tab,
 *           honestly shown as not-yet-built rather than faked)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Events consumed (window):
 *   omni:nav-select     { item: '⟐OmniDraw' }   — opens the panel
 *   omni:panel-restore  { id: 'omnidraw' }   — reopen from orb icon
 *
 * Events dispatched (window):
 *   omni:panel-minimized  { id, label, iconLabel, fromRect, variant: 'orb' }
 *   omni:object-enter-space  { }   — stub, Enter tab click (not consumed anywhere yet)
 *
 * Follows the standard module contract (constructor / init / update / destroy).
 */

import * as THREE from 'three'
import gsap        from 'gsap'
import { GEOMETRY_DEFS, GEO_LABELS, generateId } from '../systems/OmniNode.js'
import { flashHeaderLine } from './Panel.js'
import * as WindowManager from './WindowManager.js'
import * as GridWidgets   from './GridWidgets.js'

// ── Constants ────────────────────────────────────────────────────────────────

const PANEL_W    = 360
const PANEL_H    = 560
const PREVIEW_SZ = 168   // px — embedded live-preview canvas, square

const MATERIAL_TYPES = [
  'MeshStandardMaterial',
  'MeshBasicMaterial',
  'MeshPhongMaterial',
  'MeshLambertMaterial',
  'MeshToonMaterial',
  'MeshNormalMaterial',
  'MeshPhysicalMaterial',
]

const PARTICLE_SHAPE_OPTIONS = Object.keys(GEOMETRY_DEFS)

// ── Property schema ─────────────────────────────────────────────────────────
// One row-descriptor per requested field. Rendered generically by
// _buildRow() below rather than hand-written per field — keeps this from
// being 25 near-duplicate DOM blocks.

const SCHEMA = [
  { group: 'Core', key: 'classMaster', label: 'ID_ClassMaster', type: 'text', default: 'Object', readonly: true },
  { group: 'Core', key: 'rootIsGroup', label: 'ID_RootIsGroup', type: 'bool', default: false },
  { group: 'Core', key: 'numParents', label: 'ID_NumOfParents', type: 'number', default: 0, min: 0, step: 1 },

  { group: 'Cycles / Orbits', key: 'numExternalCycles', label: 'ID_NumOfExternalCycles', type: 'number', default: 0, min: 0, step: 1 },
  { group: 'Cycles / Orbits', key: 'numInternalCycles', label: 'ID_NumOfInternalCycles', type: 'number', default: 0, min: 0, step: 1 },
  { group: 'Cycles / Orbits', key: 'cycleOrbitSize', label: 'ID_CycleOrbitSize', type: 'vec', default: [0.45, 0.18, 10, 28], sublabels: ['radius', 'tube', 'radialSeg', 'tubularSeg'] },
  { group: 'Cycles / Orbits', key: 'externalCycleRotation', label: 'externalCycleRotation', type: 'bool', default: false },
  { group: 'Cycles / Orbits', key: 'externalCycleRotationSpeed', label: 'externalCycleRotationSpeed', type: 'number', default: 1, min: -5, step: 0.1 },
  { group: 'Cycles / Orbits', key: 'internalCycleRotation', label: 'internalCycleRotation', type: 'bool', default: false },
  { group: 'Cycles / Orbits', key: 'internalCycleRotationSpeed', label: 'internalCycleRotationSpeed', type: 'number', default: 1, min: -5, step: 0.1 },

  { group: 'Particles', key: 'particles', label: 'ID_Particles', type: 'bool', default: false },
  { group: 'Particles', key: 'particleWind', label: 'ID_ParticleWind', type: 'bool', default: false },
  { group: 'Particles', key: 'particleShape', label: 'ID_ParticleShape', type: 'select', options: PARTICLE_SHAPE_OPTIONS, default: 'SphereGeometry' },
  { group: 'Particles', key: 'imgParticleTie', label: 'Image → Particle Mesh', type: 'bool', default: false },

  { group: 'Surface', key: 'alphaChannel', label: 'ID_AlphaChannel', type: 'bool', default: false, live: true },
  { group: 'Surface', key: 'wireFrameChannel', label: 'ID_WireFrameChannel', type: 'bool', default: false, live: true },
  { group: 'Surface', key: 'meshTypeChannel', label: 'ID_MeshTypeChannel', type: 'select', options: MATERIAL_TYPES, default: 'MeshStandardMaterial', live: true },

  { group: 'Media', key: 'videoMeshEnabled', label: 'Video Mesh (wraps sphere)', type: 'bool', default: false },
  { group: 'Media', key: 'imgMeshEnabled', label: 'Image Mesh (wraps sphere)', type: 'bool', default: false },
  { group: 'Media', key: 'mediaURL', label: 'Media URL', type: 'text', default: '', placeholder: 'video or image URL' },

  { group: 'Transform', key: 'px', label: 'px', type: 'range', default: 0, min: -100, max: 100, step: 1, live: true },
  { group: 'Transform', key: 'py', label: 'py', type: 'range', default: 0, min: -100, max: 100, step: 1, live: true },
  { group: 'Transform', key: 'pz', label: 'pz', type: 'range', default: 0, min: -100, max: 100, step: 1, live: true },
  { group: 'Transform', key: 'rx', label: 'rx', type: 'range', default: 0, min: -3.14, max: 3.14, step: 0.01, live: true },
  { group: 'Transform', key: 'ry', label: 'ry', type: 'range', default: 0, min: -3.14, max: 3.14, step: 0.01, live: true },
  { group: 'Transform', key: 'rz', label: 'rz', type: 'range', default: 0, min: -3.14, max: 3.14, step: 0.01, live: true },
  { group: 'Transform', key: 'sx', label: 'sx', type: 'range', default: 1, min: -100, max: 100, step: 1, live: true },
  { group: 'Transform', key: 'sy', label: 'sy', type: 'range', default: 1, min: -100, max: 100, step: 1, live: true },
  { group: 'Transform', key: 'sz', label: 'sz', type: 'range', default: 1, min: -100, max: 100, step: 1, live: true },
  { group: 'Transform', key: 'draggable', label: 'Draggable', type: 'bool', default: true, live: true },

  { group: 'Automation', key: 'autoAxisX', label: 'automatic x axis', type: 'bool', default: false },
  { group: 'Automation', key: 'autoAxisY', label: 'automatic y axis', type: 'bool', default: false },
  { group: 'Automation', key: 'autoAxisZ', label: 'automatic z axis', type: 'bool', default: false },
  { group: 'Automation', key: 'autoRotation', label: 'automatic rotation', type: 'bool', default: false, live: true },
  { group: 'Automation', key: 'autoRotationAxisX', label: 'Vertical rotation (rx)', type: 'bool', default: false, live: true },
  { group: 'Automation', key: 'autoRotationSpeedX', label: 'Vertical rotation speed', type: 'range', default: 1, min: -5, max: 5, step: 0.1, live: true },
  { group: 'Automation', key: 'autoRotationAxisY', label: 'Horizontal rotation (ry)', type: 'bool', default: true, live: true },
  { group: 'Automation', key: 'autoRotationSpeedY', label: 'Horizontal rotation speed', type: 'range', default: 1, min: -5, max: 5, step: 0.1, live: true },
  { group: 'Automation', key: 'autoRotationAxisZ', label: 'Depth rotation (rz)', type: 'bool', default: false, live: true },
  { group: 'Automation', key: 'autoRotationSpeedZ', label: 'Depth rotation speed', type: 'range', default: 1, min: -5, max: 5, step: 0.1, live: true },
  { group: 'Automation', key: 'autoRotationToObject', label: 'rotationToObject (id list)', type: 'text', default: '', placeholder: 'node ids, comma separated' },
  { group: 'Automation', key: 'autoRotationToOriginCoordinates', label: 'rotationToOriginCoordinates', type: 'bool', default: false },
]

// ── Style injection ───────────────────────────────────────────────────────────

const STYLES = /* css */`

.omni-draw {
  --od-bg          : var(--omni-theme-bg, rgba(8, 8, 12, 0.92));
  --od-border      : var(--omni-theme-border, rgba(255, 255, 255, 0.09));
  --od-header-bg   : var(--omni-theme-header-bg, rgba(255, 255, 255, 0.03));
  --od-text        : var(--omni-theme-text, rgba(255, 255, 255, 0.92));
  --od-text-dim    : var(--omni-theme-text-dim, rgba(255, 255, 255, 0.68));
  --od-text-muted  : var(--omni-theme-text-muted, rgba(255, 255, 255, 0.45));
  --od-accent      : var(--omni-theme-accent, #7fd8ff);
  --od-line        : var(--omni-theme-text, rgba(255, 255, 255, 0.45));
  --od-input-bg    : var(--omni-theme-input-bg, rgba(255, 255, 255, 0.05));
  --od-input-border: var(--omni-theme-input-border, var(--od-border));
  --mono           : 'Courier New', Courier, monospace;

  position         : fixed;
  top              : 90px;
  left             : 90px;
  width            : ${PANEL_W}px;
  min-width        : 280px;
  max-width        : 720px;
  height           : ${PANEL_H}px;
  min-height       : 300px;
  max-height       : 92vh;

  display          : flex;
  flex-direction   : column;

  background       : var(--od-bg);
  backdrod-filter  : blur(22px) saturate(1.5);
  -webkit-backdrod-filter: blur(22px) saturate(1.5);
  border           : 1px solid var(--od-border);
  border-radius    : 14px;
  box-shadow       : 0 0 24px rgba(0,0,0,0.4), 0 12px 40px rgba(0,0,0,0.55);

  font-family      : var(--mono);
  color            : var(--od-text);
  z-index          : 60;
  overflow         : hidden;
  pointer-events   : auto;

  opacity          : 0;
  transform        : scale(0.92);
}

.od-header {
  position         : relative;
  height           : 42px;
  flex-shrink      : 0;
  display          : flex;
  align-items      : center;
  justify-content  : center;
  background       : var(--od-header-bg);
  border-bottom    : 1px solid var(--od-border);
  cursor           : grab;
  user-select      : none;
  overflow         : hidden;
}

.od-header.is-dragging { cursor: grabbing; }

.od-header .panel-glitch-line {
  position         : absolute;
  left             : 0;
  top              : 0;
  width            : 18%;
  height           : 2px;
  background       : var(--od-line);
  opacity          : 0;
  pointer-events   : none;
}

.od-title {
  position         : absolute;
  left             : 14px;
  font-size        : 12px;
  letter-spacing   : 0.06em;
  color            : var(--od-text-dim);
  pointer-events   : none;
}

.od-controls {
  display          : flex;
  align-items      : center;
  gap              : 8px;
}

.od-ctrl {
  width            : 24px;
  height           : 24px;
  border-radius    : 6px;
  border           : 1px solid var(--od-border);
  background       : rgba(255,255,255,0.04);
  color            : var(--od-text-dim);
  font-size        : 11px;
  display          : flex;
  align-items      : center;
  justify-content  : center;
  cursor           : pointer;
  transition       : background 0.12s ease, color 0.12s ease, border-color 0.12s ease;
}

.od-ctrl:hover {
  background       : rgba(255,255,255,0.10);
  border-color     : rgba(255,255,255,0.24);
  color            : var(--od-text);
}

.od-ctrl--minimize { order: -1; } /* center/first button, per spec */
.od-ctrl--close     { }

.od-ctrl--save {
  color         : rgba(140, 255, 180, 0.85);
  border-color  : rgba(140, 255, 180, 0.22);
}
.od-ctrl--save:hover {
  background    : rgba(140, 255, 180, 0.14);
  border-color  : rgba(140, 255, 180, 0.35);
}
.od-ctrl--save.is-saved {
  background    : rgba(140, 255, 180, 0.22);
  border-color  : rgba(140, 255, 180, 0.5);
}

/* ── Resize handle — bottom-right corner (panel is left-anchored) ─────────── */

.od-resize-handle {
  position          : absolute;
  right             : 0;
  bottom            : 0;
  width             : 16px;
  height            : 16px;
  cursor            : nwse-resize;
  z-index           : 2;
}
.od-resize-handle::before {
  content           : '';
  position          : absolute;
  right             : 3px;
  bottom            : 3px;
  width             : 8px;
  height            : 8px;
  border-right      : 2px solid rgba(255, 255, 255, 0.25);
  border-bottom     : 2px solid rgba(255, 255, 255, 0.25);
  border-radius     : 0 0 2px 0;
  transition        : border-color 0.12s ease;
}
.od-resize-handle:hover::before { border-color: rgba(255, 255, 255, 0.6); }

/* ── Mode tabs ────────────────────────────────────────────────────────────── */

.od-modes {
  display          : flex;
  flex-shrink      : 0;
  border-bottom    : 1px solid var(--od-border);
}

.od-mode {
  flex             : 1;
  padding          : 8px 0;
  text-align       : center;
  font-size        : 10px;
  letter-spacing   : 0.08em;
  text-transform   : uppercase;
  color            : var(--od-text-muted);
  cursor           : pointer;
  border-bottom    : 2px solid transparent;
  transition       : color 0.12s ease, border-color 0.12s ease;
}

.od-mode:hover  { color: var(--od-text-dim); }
.od-mode.is-active { color: var(--od-accent); border-bottom-color: var(--od-accent); }

/* ── Preview ──────────────────────────────────────────────────────────────── */

.od-preview-wrap {
  flex-shrink      : 0;
  display          : flex;
  flex-direction   : column;
  align-items      : center;
  gap              : 8px;
  padding          : 14px 0 10px;
  border-bottom    : 1px solid var(--od-border);
}

.od-preview-canvas {
  width            : ${PREVIEW_SZ}px;
  height           : ${PREVIEW_SZ}px;
  border-radius    : 10px;
  border           : 1px solid var(--od-border);
  background       : rgba(255,255,255,0.02);
}

.od-expand-btn {
  font-family      : var(--mono);
  font-size        : 10px;
  letter-spacing   : 0.06em;
  color            : var(--od-accent);
  background       : rgba(127, 216, 255, 0.08);
  border           : 1px solid rgba(127, 216, 255, 0.35);
  border-radius    : 6px;
  padding          : 5px 10px;
  cursor           : pointer;
  transition       : background 0.12s ease;
}

.od-expand-btn:hover { background: rgba(127, 216, 255, 0.16); }

.od-export-btn {
  color            : #7fffb0;
  background       : rgba(127, 255, 176, 0.08);
  border-color     : rgba(127, 255, 176, 0.35);
}

.od-export-btn:hover { background: rgba(127, 255, 176, 0.16); }

/* ── Body / property list ─────────────────────────────────────────────────── */

.od-body {
  flex             : 1;
  overflow-y       : auto;
  padding          : 6px 14px 14px;
}

.od-body::-webkit-scrollbar { width: 6px; }
.od-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 3px; }

.od-group-title {
  font-size        : 10px;
  letter-spacing   : 0.10em;
  text-transform   : uppercase;
  color            : var(--od-text-muted);
  margin           : 14px 0 6px;
}

.od-group-block:first-child .od-group-title { margin-top: 4px; }

.od-row {
  display          : flex;
  align-items      : center;
  justify-content  : space-between;
  gap              : 10px;
  padding          : 5px 0;
  border-bottom    : 1px solid rgba(255,255,255,0.04);
}

.od-row-label {
  font-size        : 10.5px;
  color            : var(--od-text-dim);
  white-space      : nowrap;
  overflow         : hidden;
  text-overflow    : ellipsis;
}

.od-row-control { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }

.od-toggle {
  width            : 30px;
  height           : 16px;
  border-radius    : 8px;
  background       : rgba(255,255,255,0.10);
  border           : 1px solid var(--od-border);
  cursor           : pointer;
  position         : relative;
  transition       : background 0.15s ease;
}

.od-toggle::after {
  content          : '';
  position         : absolute;
  top              : 1px;
  left             : 1px;
  width            : 12px;
  height           : 12px;
  border-radius    : 50%;
  background       : var(--od-text-dim);
  transition       : transform 0.15s ease, background 0.15s ease;
}

.od-toggle.is-on { background: rgba(127, 216, 255, 0.35); border-color: rgba(127, 216, 255, 0.5); }
.od-toggle.is-on::after { transform: translateX(14px); background: var(--od-accent); }

.od-num {
  width            : 56px;
  background       : var(--od-input-bg);
  border           : 1px solid var(--od-input-border);
  border-radius    : 4px;
  color            : var(--od-text);
  font-family      : var(--mono);
  font-size        : 10.5px;
  padding          : 3px 5px;
  text-align       : right;
}

.od-text {
  width            : 140px;
  background       : var(--od-input-bg);
  border           : 1px solid var(--od-input-border);
  border-radius    : 4px;
  color            : var(--od-text);
  font-family      : var(--mono);
  font-size        : 10.5px;
  padding          : 3px 6px;
}

.od-select {
  background       : var(--od-input-bg);
  border           : 1px solid var(--od-input-border);
  border-radius    : 4px;
  color            : var(--od-text);
  font-family      : var(--mono);
  font-size        : 10px;
  padding          : 3px 4px;
  max-width        : 150px;
}

.od-range {
  width            : 90px;
  accent-color     : var(--od-accent);
}

.od-range-val {
  width            : 40px;
  font-size        : 10px;
  color            : var(--od-text-muted);
  text-align       : right;
}

.od-vec { display: flex; gap: 4px; }
.od-vec .od-num { width: 40px; }

.od-schema-tag {
  font-size        : 8px;
  color            : rgba(255,255,255,0.28);
  letter-spacing   : 0.05em;
  margin-left      : 6px;
}

/* ── Enter mode stub ──────────────────────────────────────────────────────── */

.od-stub {
  flex             : 1;
  display          : flex;
  align-items      : center;
  justify-content  : center;
  flex-direction   : column;
  gap              : 6px;
  color            : var(--od-text-muted);
  font-size        : 11px;
  text-align       : center;
  padding          : 30px;
}

`

function injectStyles () {
  if (document.getElementById('omni-draw-styles')) return
  const tag = document.createElement('style')
  tag.id          = 'omni-draw-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

// ── OmniDraw class ───────────────────────────────────────────────────────

export default class OmniDraw {
  constructor (context) {
    this.ctx = context

    this._el          = null
    this._isOpen       = false
    this._mode         = 'edit'   // 'edit' | 'drag' | 'enter'

    // Live data model — seeded from SCHEMA defaults
    this._data = {}
    SCHEMA.forEach(f => { this._data[f.key] = f.type === 'vec' ? [...f.default] : f.default })

    // Embedded preview renderer (own tiny scene, separate from ctx.scene)
    this._preview = null   // { renderer, scene, camera, mesh, canvas }
    this._pendingGeoType = null   // set by _loadPersisted, applied in _setupPreview
    this._gridEl = null
    this._gridWidgets = null

    this._drag = { active: false, startX: 0, startY: 0, originX: 0, originY: 0 }

    this._onNavSelect  = null
    this._onRestore    = null
    this._onAdminSaved = null
  }

  init () {
    injectStyles()
    this._bindEvents()
    this._applyAdminSteps(this._readAdminSteps())
    this._onAdminSaved = (e) => this._applyAdminSteps(e.detail?.steps)
    window.addEventListener('omni:admin-settings-saved', this._onAdminSaved)
  }

  _readAdminSteps () {
    try {
      const raw = localStorage.getItem('omni:admin:settings')
      return raw ? JSON.parse(raw)?.steps : null
    } catch (_) { return null }
  }

  /** Applies the Admin Panel's px/py/pz step sizes — updates the SCHEMA
   *  entries (so a freshly opened panel picks them up) and, if the
   *  panel's DOM already exists, the live range inputs' step attribute
   *  directly (matched via each row's label, since the range input
   *  itself carries no data-key). */
  _applyAdminSteps (steps) {
    if (!steps) return
    const fields = { px: steps.px, py: steps.py, pz: steps.pz }

    for (const [key, step] of Object.entries(fields)) {
      if (step === undefined) continue
      const field = SCHEMA.find(f => f.key === key)
      if (field) field.step = step
    }

    if (!this._el) return
    this._el.querySelectorAll('.od-row').forEach(row => {
      const label = row.querySelector('.od-row-label')?.textContent
      if (label === undefined || !(label in fields)) return
      const range = row.querySelector('input[type="range"]')
      if (range && fields[label] !== undefined) range.step = fields[label]
    })
  }

  update (delta) {
    if (!this._preview) return
    const mesh = this._preview.mesh

    if (this._data.autoRotation) {
      // Reflects the actual configured speeds — what you see here is
      // exactly what an exported object will do.
      if (this._data.autoRotationAxisX) mesh.rotation.x += this._data.autoRotationSpeedX * delta
      if (this._data.autoRotationAxisY) mesh.rotation.y += this._data.autoRotationSpeedY * delta
      if (this._data.autoRotationAxisZ) mesh.rotation.z += this._data.autoRotationSpeedZ * delta
    } else {
      // Gentle idle spin so the preview reads as "live" even with no
      // drag, when automatic rotation isn't configured — cheap: one
      // small mesh, one small canvas, only while panel is open.
      mesh.rotation.y += delta * 0.4
    }

    this._preview.renderer.render(this._preview.scene, this._preview.camera)
  }

  onResize () {}

  destroy () {
    window.removeEventListener('omni:nav-select',   this._onNavSelect)
    window.removeEventListener('omni:panel-restore', this._onRestore)
    window.removeEventListener('omni:admin-settings-saved', this._onAdminSaved)
    this._teardownPreview()
    this._el?.parentNode?.removeChild(this._el)
    WindowManager.unregister('omnidraw')
  }

  // ── Events ───────────────────────────────────────────────────────────────

  _bindEvents () {
    this._onNavSelect = (e) => {
      if (e.detail?.item !== '⟐OmniDraw') return
      this.open()
    }
    this._onRestore = (e) => {
      if (e.detail?.id !== 'omnidraw') return
      this.open()
    }
    window.addEventListener('omni:nav-select',   this._onNavSelect)
    window.addEventListener('omni:panel-restore', this._onRestore)
  }

  // ── Open / close / minimize ─────────────────────────────────────────────

  open () {
    if (!this._el) this._el = this._buildDOM()
    if (!this._preview) this._setupPreview()

    const shell = document.getElementById('omni-ui') ?? document.body
    shell.appendChild(this._el)

    this._el.style.visibility = 'visible'
    gsap.to(this._el, { opacity: WindowManager.getPanelOpacity(), scale: 1, duration: 0.28, ease: 'back.out(1.4)' })
    flashHeaderLine(this._el.querySelector('.od-header'), 'rgba(255,255,255,0.9)')
    this._isOpen = true
  }

  close () {
    if (!this._el) return
    gsap.to(this._el, {
      opacity: 0, scale: 0.92, duration: 0.18, ease: 'power1.in',
      onComplete: () => { this._el.style.visibility = 'hidden' },
    })
    this._isOpen = false
  }

  minimize () {
    if (!this._el) return
    const rect = this._el.getBoundingClientRect()

    gsap.to(this._el, {
      opacity: 0, scale: 0.3, duration: 0.22, ease: 'power2.in',
      onComplete: () => { this._el.style.visibility = 'hidden' },
    })
    this._isOpen = false

    window.dispatchEvent(new CustomEvent('omni:panel-minimized', {
      detail: {
        id       : 'omnidraw',
        label    : '⟐OmniDraw',
        iconLabel: '⟐O',
        fromRect : { x: rect.left, y: rect.top, w: rect.width, h: rect.height },
        variant  : 'orb',
      }
    }))
  }

  // ── DOM ──────────────────────────────────────────────────────────────────

  _buildDOM () {
    const el = document.createElement('div')
    el.className = 'omni-draw'
    el.innerHTML = /* html */`
      <div class="od-header">
        <span class="panel-glitch-line" aria-hidden="true"></span>
        <span class="od-title">⟐OmniDraw</span>
        <div class="od-controls">
          <button class="od-ctrl od-ctrl--minimize" data-action="minimize" title="Minimize" aria-label="Minimize">–</button>
          <button class="od-ctrl od-ctrl--save" data-action="save" title="Save to local storage" aria-label="Save">💾</button>
          <button class="od-ctrl od-ctrl--maximize" data-action="maximize" title="Maximize" aria-label="Maximize"></button>
          <button class="od-ctrl od-ctrl--close" data-action="close" title="Close" aria-label="Close">×</button>
        </div>
      </div>

      <div class="od-modes">
        <div class="od-mode is-active" data-mode="edit">Edit</div>
        <div class="od-mode" data-mode="drag">Drag</div>
        <div class="od-mode" data-mode="enter">Enter</div>
      </div>

      <div class="od-preview-wrap">
        <canvas class="od-preview-canvas" width="${PREVIEW_SZ}" height="${PREVIEW_SZ}"></canvas>
        <button class="od-expand-btn" data-action="expand">⟐ Domain Expansion (→ Sphere)</button>
        <button class="od-expand-btn od-export-btn" data-action="export">⟐ Export to Scene</button>
      </div>

      <div class="od-body"></div>
      <div class="od-stub" style="display:none">
        <span>⟐ Enter-space mode</span>
        <span>Not wired yet — will let you navigate into this container as its own space.</span>
      </div>

      <div class="od-resize-handle" aria-hidden="true"></div>
    `

    this._renderRows(el.querySelector('.od-body'))
    this._bindHeader(el)
    this._bindControls(el)
    this._bindModes(el)
    this._bindResize(el)
    this._loadPersisted()

    el.dataset.winId = 'omnidraw'
    WindowManager.register('omnidraw', el)
    WindowManager.watchPanelOpacity(el, () => this._isOpen)
    WindowManager.makeMaximizable(el, el.querySelector('.od-ctrl--maximize'), {
      onMaximize: () => this._toGridDashboard(),
      onRestore : () => this._fromGridDashboard(),
    })
    WindowManager.wireSaveButton(el.querySelector('.od-ctrl--save'), 'omnidraw', () => this._persist())

    return el
  }

  _renderRows (body) {
    let currentGroup = null
    let groupEl = null
    for (const field of SCHEMA) {
      if (field.group !== currentGroup) {
        currentGroup = field.group
        groupEl = document.createElement('div')
        groupEl.className = 'od-group-block'
        groupEl.dataset.group = currentGroup
        const h = document.createElement('div')
        h.className = 'od-group-title'
        h.textContent = currentGroup
        groupEl.appendChild(h)
        body.appendChild(groupEl)
      }
      groupEl.appendChild(this._buildRow(field))
    }
  }

  _buildRow (field) {
    const row = document.createElement('div')
    row.className = 'od-row'

    const label = document.createElement('span')
    label.className = 'od-row-label'
    label.textContent = field.label
    if (!field.live) {
      const tag = document.createElement('span')
      tag.className = 'od-schema-tag'
      tag.textContent = '(schema)'
      label.appendChild(tag)
    }

    const control = document.createElement('div')
    control.className = 'od-row-control'

    switch (field.type) {
      case 'bool':    control.appendChild(this._buildToggle(field));  break
      case 'number':  control.appendChild(this._buildNumber(field));  break
      case 'range':   control.appendChild(this._buildRange(field));   break
      case 'select':  control.appendChild(this._buildSelect(field));  break
      case 'vec':     control.appendChild(this._buildVec(field));     break
      case 'text':
      default:        control.appendChild(this._buildText(field));    break
    }

    row.appendChild(label)
    row.appendChild(control)
    return row
  }

  _buildToggle (field) {
    const btn = document.createElement('button')
    btn.className = 'od-toggle' + (this._data[field.key] ? ' is-on' : '')
    btn.setAttribute('role', 'switch')
    btn.setAttribute('aria-checked', String(!!this._data[field.key]))
    btn.addEventListener('click', () => {
      this._data[field.key] = !this._data[field.key]
      btn.classList.toggle('is-on', this._data[field.key])
      btn.setAttribute('aria-checked', String(this._data[field.key]))
      this._onFieldChange(field)
    })
    return btn
  }

  _buildNumber (field) {
    const input = document.createElement('input')
    input.type  = 'number'
    input.className = 'od-num'
    input.value = this._data[field.key]
    if (field.min !== undefined) input.min = field.min
    if (field.step !== undefined) input.step = field.step
    input.addEventListener('change', () => {
      this._data[field.key] = Number(input.value)
      this._onFieldChange(field)
    })
    return input
  }

  _buildRange (field) {
    const wrap = document.createElement('div')
    wrap.style.display = 'flex'
    wrap.style.alignItems = 'center'
    wrap.style.gap = '6px'

    const input = document.createElement('input')
    input.type  = 'range'
    input.className = 'od-range'
    input.min   = field.min
    input.max   = field.max
    input.step  = field.step
    input.value = this._data[field.key]

    const val = document.createElement('span')
    val.className = 'od-range-val'
    val.textContent = Number(this._data[field.key]).toFixed(field.step < 1 ? 2 : 0)

    input.addEventListener('input', () => {
      this._data[field.key] = Number(input.value)
      val.textContent = Number(input.value).toFixed(field.step < 1 ? 2 : 0)
      this._onFieldChange(field)
    })

    wrap.appendChild(input)
    wrap.appendChild(val)
    return wrap
  }

  _buildSelect (field) {
    const select = document.createElement('select')
    select.className = 'od-select'
    for (const opt of field.options) {
      const o = document.createElement('option')
      o.value = opt
      o.textContent = GEO_LABELS?.[opt] ?? opt
      if (opt === this._data[field.key]) o.selected = true
      select.appendChild(o)
    }
    select.addEventListener('change', () => {
      this._data[field.key] = select.value
      this._onFieldChange(field)
    })
    return select
  }

  _buildText (field) {
    const input = document.createElement('input')
    input.type  = 'text'
    input.className = 'od-text'
    input.value = this._data[field.key]
    input.readOnly = !!field.readonly
    if (field.placeholder) input.placeholder = field.placeholder
    input.addEventListener('change', () => {
      this._data[field.key] = input.value
      this._onFieldChange(field)
    })
    return input
  }

  _buildVec (field) {
    const wrap = document.createElement('div')
    wrap.className = 'od-vec'
    field.default.forEach((v, i) => {
      const input = document.createElement('input')
      input.type  = 'number'
      input.className = 'od-num'
      input.step  = 0.01
      input.title = field.sublabels?.[i] ?? `${field.key}[${i}]`
      input.value = this._data[field.key][i]
      input.addEventListener('change', () => {
        this._data[field.key][i] = Number(input.value)
        this._onFieldChange(field)
      })
      wrap.appendChild(input)
    })
    return wrap
  }

  // ── Field change → apply to live preview where marked `live` ────────────

  _onFieldChange (field) {
    // Video / Image mutual exclusivity — "if video mesh = true, then img
    // mesh is false (for now)".
    if (field.key === 'videoMeshEnabled' && this._data.videoMeshEnabled) {
      this._data.imgMeshEnabled = false
      this._syncTogglesFromData()
    }
    if (field.key === 'imgMeshEnabled' && this._data.imgMeshEnabled) {
      this._data.videoMeshEnabled = false
      this._syncTogglesFromData()
    }

    if (!field.live || !this._preview) return
    const mesh = this._preview.mesh

    switch (field.key) {
      case 'px': mesh.position.x = this._data.px / 20; break
      case 'py': mesh.position.y = this._data.py / 20; break
      case 'pz': mesh.position.z = this._data.pz / 20; break
      case 'rx': mesh.rotation.x = this._data.rx; break
      case 'ry': mesh.rotation.y = this._data.ry; break
      case 'rz': mesh.rotation.z = this._data.rz; break
      case 'sx': mesh.scale.x    = this._data.sx; break
      case 'sy': mesh.scale.y    = this._data.sy; break
      case 'sz': mesh.scale.z    = this._data.sz; break
      case 'wireFrameChannel':
        mesh.material.wireframe = this._data.wireFrameChannel
        break
      case 'alphaChannel':
        mesh.material.transparent = this._data.alphaChannel
        mesh.material.opacity     = this._data.alphaChannel ? 0.45 : 1
        mesh.material.needsUpdate = true
        break
      case 'meshTypeChannel':
        this._swapMaterial(this._data.meshTypeChannel)
        break
      case 'draggable':
        // Applies to the PANEL itself, not the preview mesh.
        this._el.querySelector('.od-header').style.cursor =
          this._data.draggable ? 'grab' : 'default'
        break
    }
  }

  /** Re-sync toggle button visuals after a programmatic data change
   *  (used for the video/image mutual-exclusivity rule). */
  _syncTogglesFromData () {
    if (!this._el) return
    this._el.querySelectorAll('.od-row').forEach(row => {
      const label = row.querySelector('.od-row-label')?.textContent ?? ''
      const toggle = row.querySelector('.od-toggle')
      if (!toggle) return
      if (label.startsWith('Video Mesh')) {
        toggle.classList.toggle('is-on', this._data.videoMeshEnabled)
      }
      if (label.startsWith('Image Mesh')) {
        toggle.classList.toggle('is-on', this._data.imgMeshEnabled)
      }
    })
  }

  /** Swap the preview mesh's material to a new THREE material type,
   *  preserving color/wireframe/opacity where the target type supports it. */
  _swapMaterial (typeName) {
    const mesh = this._preview.mesh
    const old  = mesh.material
    const common = {
      color: old.color ?? new THREE.Color(0x7fd8ff),
      wireframe: this._data.wireFrameChannel,
      transparent: this._data.alphaChannel,
      opacity: this._data.alphaChannel ? 0.45 : 1,
    }

    const ctor = THREE[typeName]
    if (typeof ctor !== 'function') return

    const next = typeName === 'MeshNormalMaterial'
      ? new THREE.MeshNormalMaterial({ wireframe: common.wireframe, transparent: common.transparent, opacity: common.opacity })
      : new ctor(common)

    mesh.material = next
    old.dispose()
  }

  // ── Header drag / controls / mode tabs ──────────────────────────────────

  _bindHeader (el) {
    const header = el.querySelector('.od-header')

    const onDown = (e) => {
      if (!this._data.draggable) return
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
      const dx = cx - this._drag.startX
      const dy = cy - this._drag.startY
      gsap.set(el, { left: this._drag.originX + dx, top: this._drag.originY + dy })
    }
    const onUp = () => {
      this._drag.active = false
      header.classList.remove('is-dragging')
    }

    header.addEventListener('mousedown', onDown)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    header.addEventListener('touchstart', onDown, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', onUp)
  }

  /** Bottom-right resize handle — panel is left-anchored, so dragging
   *  right/down both simply grow it. Clamped by the CSS min/max bounds. */
  _bindResize (el) {
    const handle = el.querySelector('.od-resize-handle')
    if (!handle) return

    const resize = { active: false, startX: 0, startY: 0, startW: 0, startH: 0 }

    const onDown = (e) => {
      e.stopPropagation()
      const cx = e.touches?.[0]?.clientX ?? e.clientX
      const cy = e.touches?.[0]?.clientY ?? e.clientY
      const rect = el.getBoundingClientRect()
      resize.active = true
      resize.startX = cx
      resize.startY = cy
      resize.startW = rect.width
      resize.startH = rect.height
    }
    const onMove = (e) => {
      if (!resize.active) return
      const cx = e.touches?.[0]?.clientX ?? e.clientX
      const cy = e.touches?.[0]?.clientY ?? e.clientY
      gsap.set(el, {
        width : resize.startW + (cx - resize.startX),
        height: resize.startH + (cy - resize.startY),
      })
    }
    const onUp = () => { resize.active = false }

    handle.addEventListener('mousedown', onDown)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    handle.addEventListener('touchstart', onDown, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', onUp)
  }

  // ── Maximize → grid dashboard ────────────────────────────────────────────
  // Each property group (Core, Cycles/Orbits, Particles, Surface, Media,
  // Transform, Automation) becomes a draggable, reorderable card. Groups
  // are moved, not cloned, so every field's existing listener keeps
  // working. Rows are static for this panel's lifetime (unlike
  // Inspector, which rebuilds per selected node), so there's no need to
  // guard against a mid-flight rebuild here.

  _toGridDashboard () {
    if (this._gridEl) return
    const body = this._el.querySelector('.od-body')
    if (!body) return

    const widgets = [...body.querySelectorAll('.od-group-block')].map(block => ({
      id: block.dataset.group,
      title: block.dataset.group,
      el: block,
    }))
    if (widgets.length === 0) return

    this._gridWidgets = widgets
    body.style.display = 'none'
    this._gridEl = GridWidgets.mountGrid(body.parentElement, widgets, 'omnidraw')
  }

  _fromGridDashboard () {
    if (!this._gridEl) return
    GridWidgets.unmountGrid(this._gridEl, this._gridWidgets ?? [])
    this._gridEl = null
    this._gridWidgets = null
    const body = this._el.querySelector('.od-body')
    if (body) body.style.display = ''
  }

  /** Persists the panel's current schema field values (not the preview's
   *  Three.js mesh itself) so reopening after a reload picks up where you
   *  left off. Called by the header Save button via WindowManager. */
  _persist () {
    try {
      localStorage.setItem('omni:omnidraw:data', JSON.stringify({
        data: this._data,
        geoType: this._preview?.geoType ?? 'BoxGeometry',
      }))
    } catch (err) {
      console.warn('⟐OmniDraw — localStorage save failed:', err)
    }
  }

  _loadPersisted () {
    try {
      const raw = localStorage.getItem('omni:omnidraw:data')
      if (!raw) return
      const { data, geoType } = JSON.parse(raw)
      if (data) Object.assign(this._data, data)
      // _preview doesn't exist yet at this point (built lazily in open())
      // — stash it, _setupPreview() applies it once the mesh exists.
      if (geoType) this._pendingGeoType = geoType
    } catch (err) {
      console.warn('⟐OmniDraw — localStorage load failed:', err)
    }
  }

  _bindControls (el) {
    el.querySelector('[data-action="minimize"]').addEventListener('click', () => this.minimize())
    el.querySelector('[data-action="close"]').addEventListener('click', () => this.close())
    el.querySelector('[data-action="expand"]').addEventListener('click', () => this._domainExpansion())
    el.querySelector('[data-action="export"]').addEventListener('click', () => this._exportToScene())
  }

  _bindModes (el) {
    const tabs = el.querySelectorAll('.od-mode')
    const body = el.querySelector('.od-body')
    const stub = el.querySelector('.od-stub')

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const mode = tab.dataset.mode

        if (mode === 'drag') {
          // "draggableMode is easy" — it's just the existing bool, flipped on.
          this._data.draggable = true
          this._syncDraggableToggleVisual()
          this._el.querySelector('.od-header').style.cursor = 'grab'
          return   // stay on whichever tab was already active
        }

        tabs.forEach(t => t.classList.toggle('is-active', t === tab))
        this._mode = mode
        body.style.display = mode === 'edit' ? '' : 'none'
        stub.style.display = mode === 'enter' ? 'flex' : 'none'

        if (mode === 'enter') {
          window.dispatchEvent(new CustomEvent('omni:object-enter-space', { detail: {} }))
        }
      })
    })
  }

  _syncDraggableToggleVisual () {
    if (!this._el) return
    this._el.querySelectorAll('.od-row').forEach(row => {
      if (row.querySelector('.od-row-label')?.textContent === 'Draggable') {
        row.querySelector('.od-toggle')?.classList.add('is-on')
      }
    })
  }

  /**
   * "Export to Scene" — this is the piece that was missing: everything
   * above only drives this panel's own small embedded preview. This is
   * what actually spawns a real object into the main world, as a proper
   * registered OmniNode (so it gets edges, Inspector, TreeView listing —
   * not just a bare mesh floating in the scene).
   *
   * Dispatches omni:node-create-request rather than reaching into OmniNode
   * directly — OmniDraw has no reference to it (only the shared
   * scene/camera/renderer context), and this keeps the same decoupled
   * event-bus pattern the rest of the project uses.
   */
  _exportToScene () {
    if (!this._preview) return
    const mesh = this._preview.mesh

    // Spawn in front of wherever the camera is actually looking — using a
    // fixed world offset (what this used to do) landed new objects almost
    // exactly on top of the camera itself, since the camera rests very
    // close to world origin. This mirrors OmniNode's own placement
    // fallback for the same reason.
    const cam = this.ctx.camera
    const dir = new THREE.Vector3()
    cam.getWorldDirection(dir)
    dir.multiplyScalar(6)

    const position = [
      cam.position.x + dir.x + this._data.px / 20,
      Math.max(0.5, cam.position.y + dir.y + this._data.py / 20),
      cam.position.z + dir.z + this._data.pz / 20,
    ]

    window.dispatchEvent(new CustomEvent('omni:node-create-request', {
      detail: {
        id       : generateId(),
        label    : 'Container_' + Date.now().toString(36).slice(-4),
        geometry : this._preview.geoType,
        primitive: 'objective',
        color    : '#' + (mesh.material.color?.getHexString?.() ?? 'ffffff'),
        position,
        rotation : [this._data.rx, this._data.ry, this._data.rz],
        scale    : [this._data.sx, this._data.sy, this._data.sz],
        parentId : null,
        autoRotation      : this._data.autoRotation,
        autoRotationAxisX : this._data.autoRotationAxisX,
        autoRotationAxisY : this._data.autoRotationAxisY,
        autoRotationAxisZ : this._data.autoRotationAxisZ,
        autoRotationSpeedX: this._data.autoRotationSpeedX,
        autoRotationSpeedY: this._data.autoRotationSpeedY,
        autoRotationSpeedZ: this._data.autoRotationSpeedZ,
      }
    }))

    const btn = this._el.querySelector('.od-export-btn')
    if (btn) {
      const original = btn.textContent
      btn.textContent = '⟐ Exported ✓'
      gsap.fromTo(btn, { scale: 1.08 }, { scale: 1, duration: 0.3, ease: 'back.out(2)' })
      setTimeout(() => { btn.textContent = original }, 900)
    }
  }

  // ── Embedded live preview (own tiny renderer, separate from ctx.scene) ──

  _setupPreview () {
    const canvas = this._el.querySelector('.od-preview-canvas')

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
    renderer.setSize(PREVIEW_SZ, PREVIEW_SZ, false)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

    const scene  = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 10)
    camera.position.set(0, 0.6, 2.4)
    camera.lookAt(0, 0, 0)

    scene.add(new THREE.AmbientLight(0xffffff, 0.6))
    const key = new THREE.DirectionalLight(0xffffff, 1.0)
    key.position.set(2, 3, 2)
    scene.add(key)

    const geo = new THREE.BoxGeometry(1, 1, 1)
    const mat = new THREE.MeshStandardMaterial({ color: 0x7fd8ff, roughness: 0.4, metalness: 0.1 })
    const mesh = new THREE.Mesh(geo, mat)
    scene.add(mesh)

    this._preview = { renderer, scene, camera, mesh, canvas, geoType: 'BoxGeometry' }

    if (this._pendingGeoType === 'SphereGeometry') {
      mesh.geometry.dispose()
      mesh.geometry = new THREE.SphereGeometry(0.62, 32, 32)
      this._preview.geoType = 'SphereGeometry'
    }
    this._pendingGeoType = null
  }

  _teardownPreview () {
    if (!this._preview) return
    this._preview.mesh.geometry?.dispose()
    this._preview.mesh.material?.dispose()
    this._preview.renderer.dispose()
    this._preview = null
  }

  /**
   * "Domain Expansion" — cube → sphere. True vertex-interpolated morphing
   * needs matching topology (morph targets authored for both shapes); as
   * a first pass this approximates a smooth morph via squash-swap-restore,
   * which reads as a fluid transition without that authoring step.
   */
  _domainExpansion () {
    if (!this._preview) return
    const mesh = this._preview.mesh
    const toSphere = this._preview.geoType !== 'SphereGeometry'
    const nextType = toSphere ? 'SphereGeometry' : 'BoxGeometry'

    gsap.timeline()
      .to(mesh.scale, { x: 0.01, y: 0.01, z: 1.4, duration: 0.22, ease: 'power2.in' })
      .call(() => {
        mesh.geometry.dispose()
        mesh.geometry = toSphere
          ? new THREE.SphereGeometry(0.62, 32, 32)
          : new THREE.BoxGeometry(1, 1, 1)
        this._preview.geoType = nextType
      })
      .to(mesh.scale, { x: 1, y: 1, z: 1, duration: 0.35, ease: 'elastic.out(1, 0.55)' })
  }
}
