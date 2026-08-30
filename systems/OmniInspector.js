/**
 * systems/OmniInspector.js — ⟐i OmniInspector
 *
 * The per-node property inspector for the ⟐mniReality. Every attribute of
 * a node is readable and editable here. ⟐N creates and places nodes — ⟐i
 * is where they are fully defined.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Panel
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   Self-contained system panel anchored top-right, below the GlobalBar.
 *   Mirrors OmniNode's panel but slides in from the right.
 *   Auto-opens when a node is selected (omni:node-selected).
 *
 *   Opens via:
 *     window.dispatchEvent(new CustomEvent('omni:system-toggle', {
 *       detail: { system: 'omniinspector' }
 *     }))
 *   Or directly: omniInspector.open() / close() / toggle()
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Four accordion sections (all independently collapsible)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   IDENTITY
 *     ID         — auto-generated, read-only + copy button
 *     Label      — editable text input
 *     Text       — surface text textarea (rendered on node geometry in Phase 6)
 *     Primitive  — epistemological type buttons (objective/subjective/undefined/false)
 *
 *   HIERARCHY
 *     Parent Node — read-only ID (set via PATH mode in ⟐N)
 *     Root Node   — read-only ID
 *     Depth       — integer depth from root
 *
 *   APPEARANCE
 *     Color picker  — RGBA: large swatch + hex input + R/G/B/A sliders
 *     Material      — dropdown (Standard/Physical/Basic/Lambert/Phong/Toon/Normal/Depth)
 *     Geometry      — dropdown (all 20 native Three.js types)
 *     Wireframe     — toggle
 *     Scale         — X / Y / Z number inputs
 *     Texture slot  — file drop zone + URL input + apply/clear
 *
 *   MEDIA
 *     Images  — drop zone + URL input per item, list of applied items
 *     Sound   — drop zone + URL input per item
 *     Media   — drop zone + URL input per item
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Color picker design
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   Large swatch (click → triggers native <input type="color">)
 *   Hex text input — bidirectionally synced
 *   R / G / B sliders — 0–255, individually controlled
 *   A slider — 0–100% (maps to 0–1 opacity)
 *
 *   State: { r, g, b, a }  — single source of truth.
 *   All UI elements sync from this state on every change.
 *   Changes propagate live to the Three.js mesh material.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Persistence
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   Core node fields (label, color, geometry, position) — saved via events
 *   dispatched to OmniNode, which owns the omni:nodes localStorage key.
 *
 *   Extended inspector fields (text, wireframe, material type, scale, texture,
 *   media) — saved in the inspector's own key:
 *     localStorage: 'omni:inspector:{nodeId}'
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Events dispatched (window)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   omni:node-label-set    { id, label }           → OmniNode syncs its data
 *   omni:node-color-set    { id, color }           → OmniNode syncs material
 *   omni:node-geo-set      { id, geometry }        → OmniNode swaps mesh
 *   omni:node-material-set { id, material }        → OmniNode syncs material type
 *   omni:node-scale-set    { id, scale: {x,y,z} }  → OmniNode syncs scale
 *
 * Events consumed (window)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   omni:node-selected    { node, mesh } — load node into inspector (auto-open)
 *   omni:node-deselected  {}             — show empty state
 *   omni:node-created     { node, mesh } — same as node-selected
 *   omni:node-deleted     { id }         — clear if this node was loaded
 *   omni:system-toggle    { system: 'omniinspector' } — open / close panel
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Usage in main.js
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   import OmniInspector from './systems/OmniInspector.js'
 *   const omniInspector = new OmniInspector(base.context)
 *   omniInspector.init()
 *   // update() call not required — inspector is event-driven, not frame-driven
 *
 * Follows the standard module contract (constructor / init / update / destroy).
 */

import * as THREE from 'three'
import gsap       from 'gsap'
import { generateId, GEOMETRY_DEFS } from './OmniNode.js'
import * as WindowManager from '../ui/WindowManager.js'
import * as GridWidgets   from '../ui/GridWidgets.js'

// ── Layout constants (must match OmniNode.js and GlobalBar.js) ────────────────

const BAR_H     = 36    // px — GlobalBar collapsed height
const DOCK_H    = 52    // px — Dock height
const PANEL_W   = 340   // px — inspector panel width
const SLIDE_DUR = 0.30  // s  — slide animation
const GLITCH_DUR = 0.20 // s  — glitch sequence

// ── Material type registry ────────────────────────────────────────────────────

const MATERIALS = {
  MeshStandardMaterial : THREE.MeshStandardMaterial,
  MeshPhysicalMaterial : THREE.MeshPhysicalMaterial,
  MeshBasicMaterial    : THREE.MeshBasicMaterial,
  MeshLambertMaterial  : THREE.MeshLambertMaterial,
  MeshPhongMaterial    : THREE.MeshPhongMaterial,
  MeshToonMaterial     : THREE.MeshToonMaterial,
  MeshNormalMaterial   : THREE.MeshNormalMaterial,
  MeshDepthMaterial    : THREE.MeshDepthMaterial,
}

// Materials that don't support color / map (render as-is)
const COLORLESS_MATS = new Set(['MeshNormalMaterial', 'MeshDepthMaterial'])

// Materials that support the full PBR property set
const PBR_MATS = new Set(['MeshStandardMaterial', 'MeshPhysicalMaterial'])

// ── Geometry type list (matches OmniNode.js) ──────────────────────────────────

const GEO_TYPES = [
  'BoxGeometry', 'SphereGeometry', 'CylinderGeometry', 'ConeGeometry',
  'TorusGeometry', 'TorusKnotGeometry', 'OctahedronGeometry', 'TetrahedronGeometry',
  'IcosahedronGeometry', 'DodecahedronGeometry', 'PlaneGeometry', 'CircleGeometry',
  'RingGeometry', 'CapsuleGeometry', 'LatheGeometry', 'TubeGeometry',
  'ExtrudeGeometry', 'ShapeGeometry', 'EdgesGeometry', 'WireframeGeometry',
]

// ── Primitive type definitions ────────────────────────────────────────────────

const PRIMITIVES = [
  { key: 'objective',  label: '⟐objective',  color: '#ffffff', title: 'Confirmed, deterministic' },
  { key: 'subjective', label: '⟐subjective', color: '#88aaff', title: 'Perspectival, expressive' },
  { key: 'undefined',  label: '⟐undefined',  color: '#888888', title: 'Unknown, unresolved' },
  { key: 'false',      label: '⟐false',      color: '#111111', title: 'Negated, null' },
]

// ── Texture loader (shared instance) ─────────────────────────────────────────

const texLoader = new THREE.TextureLoader()

// ── Storage ───────────────────────────────────────────────────────────────────

const STORE_PREFIX = 'omni:inspector:'

// ── Color utilities ───────────────────────────────────────────────────────────

function rgbToHex (r, g, b) {
  return '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('')
}

function hexToRgb (hex) {
  const clean = hex.replace('#', '')
  if (clean.length < 6) return null
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  }
}

function clamp (v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }

// ── Stylesheet ────────────────────────────────────────────────────────────────

const STYLES = /* css */`

/* ── Inspector panel root ─────────────────────────────────────────────────── */

.oi-panel {
  --oi-bg           : var(--omni-theme-bg, rgba(6, 6, 10, 0.93));
  --oi-border       : var(--omni-theme-border, rgba(255, 255, 255, 0.09));
  --oi-sep          : var(--omni-theme-border, rgba(255, 255, 255, 0.05));
  --oi-header-bg    : var(--omni-theme-header-bg, rgba(255, 255, 255, 0.03));
  --oi-text         : var(--omni-theme-text, rgba(255, 255, 255, 0.97));
  --oi-text-dim     : var(--omni-theme-text-dim, rgba(255, 255, 255, 0.74));
  --oi-text-muted   : var(--omni-theme-text-muted, rgba(255, 255, 255, 0.50));
  --oi-accent       : var(--omni-theme-accent, rgba(255, 255, 255, 0.96));
  --oi-ctrl-hover   : rgba(255, 255, 255, 0.08);
  --oi-ctrl-active  : rgba(255, 255, 255, 0.16);
  --oi-input-bg     : var(--omni-theme-input-bg, rgba(255, 255, 255, 0.11));
  --oi-input-border : var(--omni-theme-input-border, rgba(255, 255, 255, 0.20));
  --oi-focus-border : var(--omni-theme-accent, rgba(255, 255, 255, 0.45));
  --oi-r-color      : rgba(255, 100, 100, 0.85);
  --oi-g-color      : rgba(100, 220, 130, 0.85);
  --oi-b-color      : rgba(100, 150, 255, 0.85);
  --oi-a-color      : rgba(255, 255, 255, 0.50);
  --mono            : 'Courier New', Courier, monospace;

  position          : fixed;
  top               : ${BAR_H}px;
  right             : 0;
  width             : ${PANEL_W}px;
  min-width         : 260px;
  max-width         : 640px;
  height            : calc(100vh - ${BAR_H}px - ${DOCK_H}px);
  min-height        : 240px;
  max-height        : 90vh;

  display           : flex;
  flex-direction    : column;

  background        : var(--oi-bg);
  backdrop-filter   : blur(24px) saturate(1.6);
  -webkit-backdrop-filter: blur(24px) saturate(1.6);
  border-left       : 1px solid var(--oi-border);
  border-bottom     : 1px solid var(--oi-border);
  border-radius     : 0 0 0 10px;

  font-family       : var(--mono);
  color             : var(--oi-text);
  font-size         : 11px;
  z-index           : 46;
  pointer-events    : auto;
  user-select       : none;
  overflow          : hidden;
  -webkit-font-smoothing: antialiased;

  visibility        : hidden;
}

/* ── Header ───────────────────────────────────────────────────────────────── */

.oi-header {
  flex-shrink       : 0;
  display           : flex;
  align-items       : center;
  padding           : 0 14px 0 10px;
  height            : 38px;
  background        : var(--oi-header-bg);
  border-bottom     : 1px solid var(--oi-sep);
  gap               : 8px;
  cursor            : grab;
  user-select       : none;
}

.oi-header.is-dragging { cursor: grabbing; }

/* ── Resize handle — bottom-left corner (panel is right-anchored) ─────────── */

.oi-resize-handle {
  position          : absolute;
  left              : 0;
  bottom            : 0;
  width             : 16px;
  height            : 16px;
  cursor            : nesw-resize;
  z-index           : 2;
}

.oi-resize-handle::before {
  content           : '';
  position          : absolute;
  left              : 3px;
  bottom            : 3px;
  width             : 8px;
  height            : 8px;
  border-left       : 2px solid rgba(255, 255, 255, 0.25);
  border-bottom     : 2px solid rgba(255, 255, 255, 0.25);
  border-radius     : 0 0 0 2px;
  transition        : border-color 0.12s ease;
}

.oi-resize-handle:hover::before {
  border-color      : rgba(255, 255, 255, 0.6);
}

/* ── Parent picker ─────────────────────────────────────────────────────────── */

.oi-parent-picker-btn {
  text-align        : left;
  cursor            : pointer;
  transition        : border-color 0.12s ease, background 0.12s ease;
}
.oi-parent-picker-btn:hover {
  border-color      : var(--oi-focus-border);
  background        : rgba(255, 255, 255, 0.15);
}

.oi-parent-picker {
  position          : absolute;
  left              : 14px;
  right             : 14px;
  top               : 40px;
  max-height        : 220px;
  background        : rgba(10, 10, 14, 0.98);
  border            : 1px solid rgba(255, 255, 255, 0.18);
  border-radius     : 8px;
  box-shadow        : 0 12px 32px rgba(0,0,0,0.6);
  z-index           : 5;
  display           : flex;
  flex-direction    : column;
  overflow          : hidden;
}

.oi-parent-picker-header {
  display           : flex;
  align-items       : center;
  justify-content   : space-between;
  padding           : 8px 10px;
  font-size         : 10px;
  letter-spacing    : 0.08em;
  text-transform    : uppercase;
  color             : var(--oi-text-dim);
  border-bottom     : 1px solid var(--oi-sep);
  flex-shrink       : 0;
}

.oi-parent-picker-close {
  background        : none;
  border            : none;
  color             : var(--oi-text-dim);
  cursor            : pointer;
  font-size         : 11px;
}
.oi-parent-picker-close:hover { color: var(--oi-text); }

.oi-parent-picker-list {
  overflow-y        : auto;
  padding           : 4px;
}

.oi-parent-picker-item {
  display           : flex;
  align-items       : center;
  justify-content   : space-between;
  padding           : 7px 9px;
  border-radius     : 5px;
  font-size         : 10.5px;
  color             : var(--oi-text);
  cursor            : pointer;
}
.oi-parent-picker-item:hover { background: rgba(255,255,255,0.08); }
.oi-parent-picker-item.is-disabled {
  color             : var(--oi-text-muted);
  cursor            : not-allowed;
}
.oi-parent-picker-item.is-disabled:hover { background: none; }

.oi-parent-picker-item-geo {
  font-size         : 9px;
  color             : var(--oi-text-muted);
}

.oi-parent-picker-empty {
  padding           : 14px;
  text-align        : center;
  color             : var(--oi-text-muted);
  font-size         : 10px;
}

.oi-parent-picker-none {
  border-bottom     : 1px solid var(--oi-sep);
  margin-bottom     : 4px;
  padding-bottom    : 6px;
}

/* ── Genealogy tree explorer ──────────────────────────────────────────────── */

.oi-geneo-title {
  font-size         : 9px;
  letter-spacing    : 0.08em;
  text-transform    : uppercase;
  color             : var(--oi-text-muted);
  margin            : 12px 0 4px;
}

.oi-geneo-root { max-height: 220px; overflow-y: auto; }

.oi-geneo-node { margin-left: 4px; }
.oi-geneo-node .oi-geneo-node { margin-left: 14px; border-left: 1px solid rgba(255,255,255,0.08); padding-left: 6px; }

.oi-geneo-row {
  display           : flex;
  align-items       : center;
  gap               : 6px;
  padding           : 4px 6px;
  border-radius     : 4px;
  font-size         : 10px;
  color             : var(--oi-text-dim);
}
.oi-geneo-row:hover { background: rgba(255,255,255,0.05); }
.oi-geneo-row.is-current { color: var(--oi-accent); font-weight: bold; }

.oi-geneo-arrow { width: 10px; flex-shrink: 0; color: var(--oi-text-muted); font-size: 8px; }
.oi-geneo-label { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.oi-geneo-count {
  font-size         : 8px;
  color             : var(--oi-text-muted);
  background        : rgba(255,255,255,0.08);
  border-radius     : 8px;
  padding           : 1px 6px;
}

/* ── Domain section ────────────────────────────────────────────────────────── */

.oi-domain-status {
  font-size         : 9.5px;
  color             : var(--oi-text-muted);
  padding           : 6px 8px;
  border             : 1px solid var(--oi-sep);
  border-radius     : 5px;
  background        : rgba(255,255,255,0.02);
}
.oi-domain-status.is-current {
  color             : rgba(190, 160, 255, 0.95);
  border-color      : rgba(190, 160, 255, 0.3);
  background        : rgba(190, 160, 255, 0.08);
}

.oi-domain-btn {
  flex              : 1;
  height            : 28px;
  border-radius     : 5px;
  border            : 1px solid rgba(190, 160, 255, 0.28);
  background        : rgba(190, 160, 255, 0.08);
  color             : rgba(210, 185, 255, 0.95);
  font-family       : var(--mono);
  font-size         : 9.5px;
  cursor            : pointer;
  transition        : background 0.12s ease;
}
.oi-domain-btn:hover:not(:disabled) { background: rgba(190, 160, 255, 0.18); }
.oi-domain-btn:disabled {
  opacity           : 0.3;
  cursor            : not-allowed;
}
.oi-domain-btn--exit {
  border-color      : rgba(255, 150, 150, 0.28);
  background        : rgba(255, 150, 150, 0.08);
  color             : rgba(255, 180, 180, 0.95);
}
.oi-domain-btn--exit:hover:not(:disabled) { background: rgba(255, 150, 150, 0.18); }

.oi-domain-note {
  font-size         : 9px;
  line-height       : 1.5;
  color             : var(--oi-text-muted);
  padding-top       : 2px;
}

/* ── Create section ───────────────────────────────────────────────────────── */

.oi-create-preview-wrap {
  display           : flex;
  flex-direction    : column;
  align-items       : center;
  gap               : 8px;
}

.oi-create-canvas {
  width             : 120px;
  height            : 120px;
  border-radius     : 8px;
  border            : 1px solid var(--oi-sep);
  background        : rgba(255,255,255,0.02);
}

.oi-create-btns {
  display           : flex;
  gap               : 6px;
  width             : 100%;
}

.oi-create-btn {
  flex              : 1;
  height            : 26px;
  border-radius     : 5px;
  border            : 1px solid rgba(127, 216, 255, 0.28);
  background        : rgba(127, 216, 255, 0.08);
  color             : rgba(150, 220, 255, 0.95);
  font-family       : var(--mono);
  font-size         : 9px;
  cursor            : pointer;
  transition        : background 0.12s ease;
}
.oi-create-btn:hover { background: rgba(127, 216, 255, 0.18); }

.oi-create-btn--export {
  border-color      : rgba(140, 255, 180, 0.28);
  background        : rgba(140, 255, 180, 0.08);
  color             : rgba(160, 255, 195, 0.95);
}
.oi-create-btn--export:hover { background: rgba(140, 255, 180, 0.18); }

.oi-create-transform-title {
  font-size         : 9px;
  letter-spacing    : 0.08em;
  text-transform    : uppercase;
  color             : var(--oi-text-muted);
  margin            : 12px 0 4px;
}

.oi-create-range {
  flex              : 1;
  accent-color      : var(--oi-accent);
}

.oi-create-range-val {
  width             : 42px;
  font-size         : 9.5px;
  color             : var(--oi-text-dim);
  text-align        : right;
}

.oi-controls {
  display           : flex;
  align-items       : center;
  gap               : 3px;
  flex-shrink       : 0;
}

.oi-ctrl {
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
  color             : var(--oi-text-dim);
  cursor            : pointer;
  transition        : background 0.12s, color 0.12s, border-color 0.12s;
}
.oi-ctrl:hover   { background: var(--oi-ctrl-hover); color: var(--oi-accent); border-color: rgba(255,255,255,0.18); }
.oi-ctrl:active  { background: var(--oi-ctrl-active); }
.oi-ctrl--close:hover {
  background    : rgba(255, 80, 80, 0.14);
  border-color  : rgba(255, 80, 80, 0.28);
  color         : rgba(255, 150, 150, 0.90);
}

.oi-ctrl--save {
  color         : rgba(140, 255, 180, 0.85);
  border-color  : rgba(140, 255, 180, 0.22);
}
.oi-ctrl--save:hover {
  background    : rgba(140, 255, 180, 0.14);
  border-color  : rgba(140, 255, 180, 0.35);
  color         : rgba(180, 255, 205, 1);
}
.oi-ctrl--save.is-saved {
  background    : rgba(140, 255, 180, 0.22);
  border-color  : rgba(140, 255, 180, 0.5);
}

.oi-ctrl--genealogy {
  color         : rgba(190, 160, 255, 0.85);
  border-color  : rgba(190, 160, 255, 0.22);
}
.oi-ctrl--genealogy:hover {
  background    : rgba(190, 160, 255, 0.14);
  border-color  : rgba(190, 160, 255, 0.35);
  color         : rgba(210, 185, 255, 1);
}
.oi-ctrl--genealogy.is-active {
  background    : rgba(190, 160, 255, 0.22);
  border-color  : rgba(190, 160, 255, 0.5);
}

.oi-title {
  flex              : 1 1 auto;
  font-size         : 10px;
  color             : var(--oi-accent);
  letter-spacing    : 0.12em;
  text-transform    : uppercase;
  text-align        : right;
}

/* ── Node identity badge (below header, shown when node loaded) ───────────── */

.oi-node-badge {
  flex-shrink       : 0;
  display           : none;
  align-items       : center;
  gap               : 8px;
  padding           : 7px 12px;
  border-bottom     : 1px solid var(--oi-sep);
  background        : rgba(255,255,255,0.02);
}
.oi-node-badge.is-visible { display: flex; }

.oi-badge-dot {
  width             : 8px;
  height            : 8px;
  border-radius     : 50%;
  flex-shrink       : 0;
  border            : 1px solid rgba(255,255,255,0.15);
}

.oi-badge-label {
  flex              : 1 1 auto;
  font-size         : 9px;
  color             : var(--oi-accent);
  letter-spacing    : 0.06em;
  overflow          : hidden;
  text-overflow     : ellipsis;
  white-space       : nowrap;
}

.oi-badge-geo {
  font-size         : 8px;
  color             : var(--oi-text-muted);
  flex-shrink       : 0;
}

.oi-inspect-preview-wrap {
  flex-shrink       : 0;
  display           : none;
  align-items       : center;
  justify-content   : center;
  padding           : 10px 0;
  border-bottom     : 1px solid var(--oi-sep);
  background        : rgba(255,255,255,0.015);
}
.oi-inspect-preview-wrap.is-visible { display: flex; }

.oi-inspect-canvas {
  width             : 90px;
  height            : 90px;
  border-radius     : 8px;
  border            : 1px solid var(--oi-sep);
  background        : rgba(255,255,255,0.02);
}

/* ── Scrollable content body ──────────────────────────────────────────────── */

.oi-body {
  flex              : 1 1 auto;
  overflow-y        : auto;
  overflow-x        : hidden;

  scrollbar-width   : thin;
  scrollbar-color   : rgba(255,255,255,0.06) transparent;
}
.oi-body::-webkit-scrollbar       { width: 3px; }
.oi-body::-webkit-scrollbar-track { background: transparent; }
.oi-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.06); border-radius: 2px; }

/* ── Empty state ──────────────────────────────────────────────────────────── */

.oi-empty {
  display           : flex;
  flex-direction    : column;
  align-items       : center;
  justify-content   : center;
  height            : 100%;
  min-height        : 160px;
  gap               : 10px;
  color             : var(--oi-text-muted);
  font-size         : 9px;
  letter-spacing    : 0.10em;
  text-align        : center;
  padding           : 24px;
}

.oi-empty-glyph {
  font-size         : 24px;
  opacity           : 0.15;
  display           : block;
}

/* ── Accordion section ────────────────────────────────────────────────────── */

.oi-section {
  border-bottom     : 1px solid var(--oi-sep);
}

.oi-section-toggle {
  display           : flex;
  align-items       : center;
  gap               : 6px;
  padding           : 8px 12px;
  cursor            : pointer;
  background        : rgba(255,255,255,0.01);
  border            : none;
  font-family       : var(--mono);
  color             : var(--oi-text-muted);
  font-size         : 8px;
  letter-spacing    : 0.14em;
  text-transform    : uppercase;
  width             : 100%;
  text-align        : left;
  transition        : background 0.10s, color 0.10s;
}
.oi-section-toggle:hover { background: rgba(255,255,255,0.03); color: var(--oi-text-dim); }

.oi-section-arrow {
  font-size         : 8px;
  transition        : transform 0.18s ease;
  display           : inline-block;
  flex-shrink       : 0;
}
.oi-section-toggle.is-open .oi-section-arrow { transform: rotate(90deg); }

.oi-section-content {
  overflow          : hidden;
  max-height        : 0;
  padding           : 0;
  transition        : none; /* GSAP handles animation */
}
.oi-section-content.is-open {
  max-height        : 2000px; /* large enough */
}

.oi-section-inner {
  position          : relative;
  padding           : 10px 12px 14px;
  display           : flex;
  flex-direction    : column;
  gap               : 10px;
}

/* ── Form rows ────────────────────────────────────────────────────────────── */

.oi-row {
  display           : flex;
  align-items       : center;
  gap               : 8px;
}

.oi-label {
  font-size         : 10px;
  color             : var(--oi-text-dim);
  text-transform    : uppercase;
  letter-spacing    : 0.12em;
  flex-shrink       : 0;
  width             : 54px;
}

.oi-label--full {
  width             : auto;
  flex              : 1 1 auto;
}

/* ── Text inputs ──────────────────────────────────────────────────────────── */

.oi-input {
  flex              : 1 1 auto;
  height            : 26px;
  padding           : 0 8px;
  background        : var(--oi-input-bg);
  border            : 1px solid var(--oi-input-border);
  border-radius     : 4px;
  font-family       : var(--mono);
  font-size         : 10.5px;
  color             : var(--oi-text);
  outline           : none;
  transition        : border-color 0.12s;
  min-width         : 0;
}
.oi-input:focus     { border-color: var(--oi-focus-border); }
.oi-input:read-only { color: var(--oi-text-muted); cursor: default; }
.oi-input--sm       { width: 60px; flex: 0 0 60px; }

.oi-textarea {
  flex              : 1 1 auto;
  min-height        : 52px;
  resize            : vertical;
  padding           : 6px 8px;
  background        : var(--oi-input-bg);
  border            : 1px solid var(--oi-input-border);
  border-radius     : 4px;
  font-family       : var(--mono);
  font-size         : 9px;
  color             : var(--oi-text);
  outline           : none;
  transition        : border-color 0.12s;
  line-height       : 1.5;
}
.oi-textarea:focus { border-color: var(--oi-focus-border); }

.oi-data-field {
  display           : flex;
  flex-direction    : column;
  gap               : 4px;
  margin-bottom     : 4px;
}
.oi-data-field .oi-textarea { min-height: 64px; width: 100%; }
.oi-textarea--mono {
  background        : rgba(0,0,0,0.25);
  color             : rgba(150, 255, 190, 0.9);
}
.oi-data-note {
  font-size         : 9px;
  line-height       : 1.5;
  color             : var(--oi-text-muted);
  padding-top       : 2px;
}

/* ── Copy button ──────────────────────────────────────────────────────────── */

.oi-copy-btn {
  flex-shrink       : 0;
  height            : 22px;
  padding           : 0 7px;
  background        : rgba(255,255,255,0.04);
  border            : 1px solid rgba(255,255,255,0.08);
  border-radius     : 4px;
  font-family       : var(--mono);
  font-size         : 8px;
  color             : var(--oi-text-muted);
  cursor            : pointer;
  transition        : background 0.10s, color 0.10s;
}
.oi-copy-btn:hover { background: rgba(255,255,255,0.08); color: var(--oi-accent); }

/* ── Primitive type buttons ───────────────────────────────────────────────── */

.oi-primitives {
  display           : flex;
  gap               : 4px;
}

.oi-primitive {
  flex              : 1;
  height            : 24px;
  display           : flex;
  align-items       : center;
  justify-content   : center;
  background        : rgba(255,255,255,0.03);
  border            : 1px solid rgba(255,255,255,0.08);
  border-radius     : 4px;
  font-family       : var(--mono);
  font-size         : 7px;
  color             : var(--oi-text-muted);
  cursor            : pointer;
  letter-spacing    : 0.04em;
  transition        : background 0.10s, border-color 0.10s, color 0.10s;
  white-space       : nowrap;
  overflow          : hidden;
  text-overflow     : ellipsis;
  padding           : 0 3px;
}
.oi-primitive:hover { background: rgba(255,255,255,0.07); color: var(--oi-text); }
.oi-primitive.is-active {
  border-color      : rgba(255,255,255,0.35);
  color             : var(--oi-accent);
  background        : rgba(255,255,255,0.10);
}

/* ── RGBA color picker ────────────────────────────────────────────────────── */

.oi-color-block {
  display           : flex;
  flex-direction    : column;
  gap               : 8px;
}

.oi-color-top {
  display           : flex;
  align-items       : center;
  gap               : 8px;
}

/* The large swatch with checkerboard transparency indicator */
.oi-swatch-wrap {
  position          : relative;
  width             : 38px;
  height            : 38px;
  border-radius     : 5px;
  overflow          : hidden;
  cursor            : pointer;
  flex-shrink       : 0;
  border            : 1px solid rgba(255,255,255,0.12);
  transition        : border-color 0.12s;
}
.oi-swatch-wrap:hover { border-color: rgba(255,255,255,0.30); }

/* Checkerboard layer (shows through for alpha < 1) */
.oi-swatch-check {
  position          : absolute;
  inset             : 0;
  background        : repeating-conic-gradient(
    rgba(255,255,255,0.12) 0% 25%,
    rgba(0,0,0,0.20) 0% 50%
  ) 0 0 / 8px 8px;
}

/* Colour fill layer on top */
.oi-swatch-fill {
  position          : absolute;
  inset             : 0;
  transition        : background-color 0.05s;
}

/* Hidden native color input — triggered by swatch click */
.oi-native-color {
  position          : absolute;
  inset             : 0;
  opacity           : 0;
  cursor            : pointer;
  width             : 100%;
  height            : 100%;
  padding           : 0;
  border            : none;
}

.oi-hex-input {
  width             : 76px;
  flex-shrink       : 0;
  height            : 26px;
  padding           : 0 7px;
  background        : var(--oi-input-bg);
  border            : 1px solid var(--oi-input-border);
  border-radius     : 4px;
  font-family       : var(--mono);
  font-size         : 9px;
  color             : var(--oi-text);
  outline           : none;
  letter-spacing    : 0.04em;
  transition        : border-color 0.12s;
}
.oi-hex-input:focus { border-color: var(--oi-focus-border); }

/* Alpha percentage readout next to swatch */
.oi-alpha-readout {
  font-size         : 9px;
  color             : var(--oi-text-muted);
  flex-shrink       : 0;
  min-width         : 32px;
  text-align        : right;
}

/* RGBA sliders */
.oi-slider-grid {
  display           : flex;
  flex-direction    : column;
  gap               : 5px;
}

.oi-slider-row {
  display           : flex;
  align-items       : center;
  gap               : 6px;
}

.oi-slider-label {
  width             : 12px;
  font-size         : 8px;
  flex-shrink       : 0;
  letter-spacing    : 0.05em;
}
.oi-slider-label--r { color: var(--oi-r-color); }
.oi-slider-label--g { color: var(--oi-g-color); }
.oi-slider-label--b { color: var(--oi-b-color); }
.oi-slider-label--a { color: var(--oi-a-color); }

.oi-slider {
  flex              : 1 1 auto;
  -webkit-appearance: none;
  appearance        : none;
  height            : 3px;
  border-radius     : 2px;
  outline           : none;
  cursor            : pointer;
  background        : rgba(255,255,255,0.10);
}
.oi-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width             : 11px;
  height            : 11px;
  border-radius     : 50%;
  background        : rgba(255,255,255,0.85);
  border            : 1px solid rgba(255,255,255,0.30);
  cursor            : pointer;
  box-shadow        : 0 0 4px rgba(0,0,0,0.40);
}
.oi-slider::-moz-range-thumb {
  width             : 11px;
  height            : 11px;
  border-radius     : 50%;
  background        : rgba(255,255,255,0.85);
  border            : 1px solid rgba(255,255,255,0.30);
  cursor            : pointer;
  box-shadow        : 0 0 4px rgba(0,0,0,0.40);
}

.oi-slider-val {
  font-size         : 8px;
  color             : var(--oi-text-dim);
  width             : 28px;
  text-align        : right;
  flex-shrink       : 0;
}

/* Gradient tracks for each channel */
.oi-slider--r { background: linear-gradient(to right, #000, #ff4444); }
.oi-slider--g { background: linear-gradient(to right, #000, #44dd66); }
.oi-slider--b { background: linear-gradient(to right, #000, #4488ff); }
.oi-slider--a { background: linear-gradient(to right, transparent, #fff); }

/* ── Select / dropdown ────────────────────────────────────────────────────── */

.oi-select {
  flex              : 1 1 auto;
  height            : 26px;
  padding           : 0 6px;
  background        : var(--oi-input-bg);
  border            : 1px solid var(--oi-input-border);
  border-radius     : 4px;
  font-family       : var(--mono);
  font-size         : 9px;
  color             : var(--oi-text);
  outline           : none;
  cursor            : pointer;
  transition        : border-color 0.12s;
  -webkit-appearance: none;
  appearance        : none;
  background-image  : url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='5'%3E%3Cpath d='M0 0l4 5 4-5z' fill='rgba(255,255,255,0.3)'/%3E%3C/svg%3E");
  background-repeat : no-repeat;
  background-position: right 8px center;
  padding-right     : 22px;
}
.oi-select:focus { border-color: var(--oi-focus-border); }

/* ── Toggle (wireframe) ───────────────────────────────────────────────────── */

.oi-toggle-wrap {
  display           : flex;
  align-items       : center;
  gap               : 8px;
  cursor            : pointer;
}

.oi-toggle {
  position          : relative;
  width             : 30px;
  height            : 16px;
  flex-shrink       : 0;
}

.oi-toggle input {
  opacity           : 0;
  width             : 0;
  height            : 0;
  position          : absolute;
}

.oi-toggle-track {
  position          : absolute;
  inset             : 0;
  background        : rgba(255,255,255,0.10);
  border            : 1px solid rgba(255,255,255,0.14);
  border-radius     : 8px;
  transition        : background 0.18s, border-color 0.18s;
}

.oi-toggle-thumb {
  position          : absolute;
  top               : 2px;
  left              : 2px;
  width             : 10px;
  height            : 10px;
  background        : rgba(255,255,255,0.45);
  border-radius     : 50%;
  transition        : transform 0.18s, background 0.18s;
}

.oi-toggle input:checked + .oi-toggle-track { background: rgba(255,255,255,0.20); border-color: rgba(255,255,255,0.35); }
.oi-toggle input:checked + .oi-toggle-track + .oi-toggle-thumb {
  transform         : translateX(14px);
  background        : rgba(255,255,255,0.90);
}

.oi-toggle-label {
  font-size         : 9px;
  color             : var(--oi-text-dim);
}

/* ── Scale XYZ inputs ─────────────────────────────────────────────────────── */

.oi-xyz-row {
  display           : flex;
  align-items       : center;
  gap               : 5px;
}

.oi-xyz-field {
  flex              : 1;
  display           : flex;
  flex-direction    : column;
  gap               : 3px;
}

.oi-xyz-label {
  font-size         : 7px;
  color             : var(--oi-text-muted);
  text-align        : center;
  letter-spacing    : 0.10em;
}

.oi-xyz-input {
  height            : 26px;
  padding           : 0 5px;
  background        : var(--oi-input-bg);
  border            : 1px solid var(--oi-input-border);
  border-radius     : 4px;
  font-family       : var(--mono);
  font-size         : 9px;
  color             : var(--oi-text);
  outline           : none;
  text-align        : center;
  transition        : border-color 0.12s;
  width             : 100%;
}
.oi-xyz-input:focus { border-color: var(--oi-focus-border); }

/* ── Texture / media slots ────────────────────────────────────────────────── */

.oi-slot {
  display           : flex;
  flex-direction    : column;
  gap               : 5px;
}

.oi-slot-label {
  font-size         : 8px;
  color             : var(--oi-text-muted);
  text-transform    : uppercase;
  letter-spacing    : 0.12em;
}

.oi-drop-zone {
  height            : 46px;
  display           : flex;
  align-items       : center;
  justify-content   : center;
  gap               : 6px;
  background        : rgba(255,255,255,0.02);
  border            : 1px dashed rgba(255,255,255,0.12);
  border-radius     : 5px;
  font-size         : 8px;
  color             : var(--oi-text-muted);
  cursor            : pointer;
  letter-spacing    : 0.08em;
  transition        : background 0.12s, border-color 0.12s, color 0.12s;
  text-align        : center;
  padding           : 0 8px;
}
.oi-drop-zone:hover,
.oi-drop-zone.drag-over {
  background        : rgba(255,255,255,0.05);
  border-color      : rgba(255,255,255,0.25);
  color             : var(--oi-text);
}

.oi-drop-zone-icon {
  font-size         : 14px;
  opacity           : 0.35;
}

.oi-slot-url-row {
  display           : flex;
  gap               : 5px;
}

.oi-slot-apply {
  flex-shrink       : 0;
  height            : 26px;
  padding           : 0 9px;
  background        : rgba(255,255,255,0.05);
  border            : 1px solid rgba(255,255,255,0.12);
  border-radius     : 4px;
  font-family       : var(--mono);
  font-size         : 8px;
  color             : var(--oi-text-dim);
  cursor            : pointer;
  letter-spacing    : 0.08em;
  transition        : background 0.10s, color 0.10s;
}
.oi-slot-apply:hover { background: rgba(255,255,255,0.09); color: var(--oi-accent); }

/* Applied item list */
.oi-slot-items {
  display           : flex;
  flex-direction    : column;
  gap               : 3px;
}

.oi-slot-item {
  display           : flex;
  align-items       : center;
  gap               : 6px;
  padding           : 4px 7px;
  background        : rgba(255,255,255,0.03);
  border            : 1px solid rgba(255,255,255,0.06);
  border-radius     : 4px;
  font-size         : 8px;
  color             : var(--oi-text-dim);
}

.oi-slot-item-name {
  flex              : 1 1 auto;
  overflow          : hidden;
  text-overflow     : ellipsis;
  white-space       : nowrap;
  letter-spacing    : 0.04em;
}

.oi-slot-item-rm {
  flex-shrink       : 0;
  width             : 16px;
  height            : 16px;
  display           : flex;
  align-items       : center;
  justify-content   : center;
  background        : none;
  border            : none;
  font-size         : 10px;
  color             : rgba(255,255,255,0.20);
  cursor            : pointer;
  border-radius     : 3px;
  transition        : background 0.10s, color 0.10s;
}
.oi-slot-item-rm:hover { background: rgba(255,80,80,0.12); color: rgba(255,150,150,0.70); }

/* Texture preview thumbnail */
.oi-tex-preview {
  display           : none;
  width             : 100%;
  height            : 60px;
  border-radius     : 4px;
  border            : 1px solid rgba(255,255,255,0.08);
  object-fit        : cover;
}
.oi-tex-preview.is-visible { display: block; }

.oi-tex-clear {
  align-self        : flex-start;
  height            : 20px;
  padding           : 0 7px;
  background        : rgba(255,80,80,0.08);
  border            : 1px solid rgba(255,80,80,0.18);
  border-radius     : 3px;
  font-family       : var(--mono);
  font-size         : 7px;
  color             : rgba(255,150,150,0.70);
  cursor            : pointer;
  letter-spacing    : 0.06em;
  transition        : background 0.10s;
  display           : none;
}
.oi-tex-clear.is-visible { display: block; }
.oi-tex-clear:hover { background: rgba(255,80,80,0.16); }

/* ── Footer ───────────────────────────────────────────────────────────────── */

.oi-footer {
  flex-shrink       : 0;
  height            : 26px;
  padding           : 0 12px;
  display           : flex;
  align-items       : center;
  border-top        : 1px solid var(--oi-sep);
  gap               : 8px;
}

.oi-footer-badge {
  font-size         : 8px;
  color             : var(--oi-text-muted);
  text-transform    : uppercase;
  letter-spacing    : 0.10em;
  margin-left       : auto;
}

.oi-footer-id {
  font-size         : 8px;
  color             : var(--oi-text-muted);
  letter-spacing    : 0.04em;
  flex              : 1 1 auto;
  overflow          : hidden;
  text-overflow     : ellipsis;
  white-space       : nowrap;
  min-width         : 0;
}

/* ── Glitch scan line ─────────────────────────────────────────────────────── */

.oi-glitch-line {
  position          : absolute;
  left              : 0;
  width             : 100%;
  height            : 2px;
  background        : rgba(255,255,255,0.30);
  pointer-events    : none;
  z-index           : 10;
  opacity           : 0;
}

/* ── Mobile ───────────────────────────────────────────────────────────────── */

@media (max-width: 560px) {
  .oi-panel { width: min(${PANEL_W}px, 90vw); }
}

`

// ── Style injection ───────────────────────────────────────────────────────────

function injectStyles () {
  if (document.getElementById('omni-inspector-styles')) return
  const tag = document.createElement('style')
  tag.id          = 'omni-inspector-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

// ── Glitch helper ─────────────────────────────────────────────────────────────

function glitch (el) {
  return new Promise(resolve => {
    const line = el.querySelector('.oi-glitch-line')
    const tl   = gsap.timeline({ onComplete: resolve })
    tl.to(el, { x:  3, duration: 0.030, ease: 'none' })
      .to(el, { x: -4, duration: 0.025, ease: 'none' })
      .to(el, { x:  2, opacity: 0.70, duration: 0.020, ease: 'none' })
      .to(el, { x:  0, opacity: 1,    duration: 0.030, ease: 'power1.out' })
    if (line) {
      gsap.fromTo(line,
        { top: '-2px', opacity: 0.80 },
        { top: '100%', opacity: 0,    duration: GLITCH_DUR, ease: 'power1.in' }
      )
    }
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// OmniInspector class
// ─────────────────────────────────────────────────────────────────────────────

export default class OmniInspector {

  /**
   * @param {object} context  — { scene, camera, renderer, sizes, ticker, Sound? }
   */
  constructor (context) {
    this.ctx = context

    // ── Panel state ────────────────────────────────────────────────────
    this._el     = null
    this._isOpen = false
    this._isMaximized = false
    this._gridEl = null
    this._gridWidgets = null
    this._drag   = { active: false, startX: 0, startY: 0, originX: 0, originY: 0 }
    this._allNodes = []   // cached from omni:nodes-updated — feeds the parent picker
    this._currentSpaceId = null   // cached from omni:space-entered/exited
    this._createPreview = null   // the Create section's own tiny renderer/scene/mesh
    this._createTransform = { px: 0, py: 0, pz: 0, rx: 0, ry: 0, rz: 0, sx: 1, sy: 1, sz: 1 }
    this._inspectPreview = null   // spinning preview of the ACTUAL loaded node
    this._infoPlane = null   // floating plane showing External Display/Code

    // ── Loaded node ────────────────────────────────────────────────────
    this._currentId   = null   // node ID currently loaded
    this._currentMesh = null   // THREE.Mesh reference
    this._currentData = null   // raw node data from OmniNode

    // ── Color state — single source of truth ───────────────────────────
    this._color = { r: 255, g: 255, b: 255, a: 1.0 }

    // ── Extended data (persisted per-node in inspector's own store) ─────
    // { text, wireframe, material, scale:{x,y,z}, texture, images:[], sound:[], media:[] }
    this._ext = null

    // ── Section open states ────────────────────────────────────────────
    this._sectionOpen = {
      identity   : true,
      hierarchy  : false,
      appearance : true,
      media      : false,
      domain     : false,
      data       : false,
      create     : false,
    }

    // ── Bound event handlers for cleanup ────────────────────────────────
    this._onToggle    = null
    this._onSelected  = null
    this._onDeselect  = null
    this._onCreated   = null
    this._onDeleted   = null
    this._onNodesUpdated = null
    this._onSpaceEntered = null
    this._onSpaceExited  = null
  }

  // ── Module contract ──────────────────────────────────────────────────────

  init () {
    injectStyles()
    this._buildPanel()
    this._bindEvents()
    this._showEmpty()
  }

  update (delta) {
    if (this._createPreview) {
      // No idle auto-spin here — this preview now has explicit rx/ry/rz
      // sliders tied to the node being created; an uncontrollable spin
      // would fight with them and make "ry = 0" meaningless.
      this._createPreview.renderer.render(this._createPreview.scene, this._createPreview.camera)
    }
    if (this._inspectPreview) {
      this._inspectPreview.mesh.rotation.y += delta * 0.4
      this._inspectPreview.renderer.render(this._inspectPreview.scene, this._inspectPreview.camera)
    }
    if (this._infoPlane && this._currentMesh) {
      // Follows the node in case it moves/rotates, and always faces the
      // camera (billboard) so the text stays readable.
      const worldPos = this._currentMesh.getWorldPosition(new THREE.Vector3())
      this._infoPlane.mesh.position.copy(worldPos).add(this._infoPlane.offset)
      this._infoPlane.mesh.lookAt(this.ctx.camera.position)
    }
  }

  destroy () {
    this._teardownCreatePreview()
    this._teardownInspectPreview()
    this._hideInfoPlane()
    this._el?.parentNode?.removeChild(this._el)
    WindowManager.unregister('omniinspector')
    window.removeEventListener('omni:system-toggle', this._onToggle)
    window.removeEventListener('omni:node-selected', this._onSelected)
    window.removeEventListener('omni:node-deselected', this._onDeselect)
    window.removeEventListener('omni:node-created',  this._onCreated)
    window.removeEventListener('omni:node-deleted',  this._onDeleted)
    window.removeEventListener('omni:nodes-updated', this._onNodesUpdated)
    window.removeEventListener('omni:space-entered', this._onSpaceEntered)
    window.removeEventListener('omni:space-exited', this._onSpaceExited)
  }

  // ── Public API ───────────────────────────────────────────────────────────

  open () {
    if (this._isOpen) return
    this._isOpen = true
    this._el.style.visibility = 'visible'
    const targetOpacity = WindowManager.getPanelOpacity()
    gsap.fromTo(this._el,
      { x: '100%', opacity: targetOpacity },
      {
        x        : '0%',
        opacity  : targetOpacity,
        duration : SLIDE_DUR,
        ease     : 'power3.out',
        onComplete: () => glitch(this._el)
      }
    )
    this._playSound('open')
  }

  close () {
    if (!this._isOpen) return
    glitch(this._el).then(() => {
      gsap.to(this._el, {
        x        : '100%',
        duration : SLIDE_DUR * 0.85,
        ease     : 'power2.in',
        onComplete: () => {
          this._el.style.visibility = 'hidden'
          gsap.set(this._el, { x: '100%' })
        }
      })
    })
    this._isOpen = false
    this._playSound('close')
  }

  toggle () {
    this._isOpen ? this.close() : this.open()
  }

  /**
   * Load a node into the inspector.
   * Called when omni:node-selected fires, or externally.
   *
   * @param {{ id, label, geometry, primitive, color, position, parentId, createdAt }} data
   * @param {THREE.Mesh | THREE.LineSegments} mesh
   */
  loadNode (data, mesh) {
    this._currentId   = data.id
    this._currentMesh = mesh
    this._currentData = data

    // Load extended inspector data from localStorage
    this._ext = { ...this._defaultExt(data), ...(this._loadExt(data.id) ?? {}) }

    // Sync color state from node data
    const meshColor = mesh?.material?.color
    if (meshColor) {
      this._color = {
        r : Math.round(meshColor.r * 255),
        g : Math.round(meshColor.g * 255),
        b : Math.round(meshColor.b * 255),
        a : mesh.material.opacity ?? 1.0,
      }
    } else {
      this._color = { r: 255, g: 255, b: 255, a: 1.0 }
    }

    // Sync scale from mesh
    if (mesh?.scale) {
      this._ext.scale = {
        x: parseFloat(mesh.scale.x.toFixed(3)),
        y: parseFloat(mesh.scale.y.toFixed(3)),
        z: parseFloat(mesh.scale.z.toFixed(3)),
      }
    }

    this._renderLoaded()
    this._updateFooter()

    if (this._ext.showOnPlane) this._showInfoPlane(data, this._ext)
    else this._hideInfoPlane()

    if (!this._isOpen) this.open()
  }

  /** Clear the inspector back to its empty state. */
  clearNode () {
    this._currentId   = null
    this._currentMesh = null
    this._currentData = null
    this._ext         = null
    this._teardownCreatePreview()
    this._teardownInspectPreview()
    this._hideInfoPlane()
    this._el?.querySelector('#oi-inspect-preview-wrap')?.classList.remove('is-visible')
    this._showEmpty()
    this._updateFooter()
  }

  // ── Panel DOM ────────────────────────────────────────────────────────────

  _buildPanel () {
    const el = document.createElement('div')
    el.className = 'oi-panel'
    el.id        = 'omni-inspector-panel'

    el.innerHTML = /* html */`
      <div class="oi-glitch-line" aria-hidden="true"></div>

      <!-- Header — controls on left, title on right (mirrors ⟐N top-left) -->
      <div class="oi-header">
        <div class="oi-controls">
          <button class="oi-ctrl oi-ctrl--close"    data-action="close"    title="✕ Close"         >✕</button>
          <button class="oi-ctrl oi-ctrl--minimize" data-action="minimize" title="_ Minimize"      >_</button>
          <button class="oi-ctrl oi-ctrl--attach"   data-action="attach"   title="⟐ Pocket attach" >⟐</button>
          <button class="oi-ctrl oi-ctrl--save"     data-action="save"     title="Save to local storage">💾</button>
          <button class="oi-ctrl oi-ctrl--genealogy" data-action="genealogy" title="Select whole genealogy tree">Ξ</button>
          <button class="oi-ctrl oi-ctrl--maximize" data-action="maximize" title="Maximize"></button>
        </div>
        <span class="oi-title">OmniInspector ⟐i</span>
      </div>

      <!-- Node identity badge — visible when node is loaded -->
      <div class="oi-node-badge" id="oi-node-badge">
        <span class="oi-badge-dot" id="oi-badge-dot"></span>
        <span class="oi-badge-label" id="oi-badge-label">—</span>
        <span class="oi-badge-geo"  id="oi-badge-geo">—</span>
      </div>

      <!-- Live spinning preview of the actual object being inspected —
           same visual language as ⟐Objects' preview, but reflecting the
           real selected node's geometry/color, not a blank new object. -->
      <div class="oi-inspect-preview-wrap" id="oi-inspect-preview-wrap">
        <canvas class="oi-inspect-canvas" id="oi-inspect-canvas" width="90" height="90"></canvas>
      </div>

      <!-- Scrollable content -->
      <div class="oi-body" id="oi-body">
        <!-- populated by _showEmpty() or _renderLoaded() -->
      </div>

      <!-- Footer -->
      <div class="oi-footer">
        <span class="oi-footer-id"    id="oi-footer-id">—</span>
        <span class="oi-footer-badge" id="oi-footer-badge">⟐i</span>
      </div>

      <div class="oi-resize-handle" aria-hidden="true"></div>
    `

    gsap.set(el, { x: '100%' })
    this._el = el

    const shell = document.getElementById('omni-ui') ?? document.body
    shell.appendChild(el)

    // Header controls
    el.querySelector('.oi-controls').addEventListener('click', (e) => {
      const btn = e.target.closest('.oi-ctrl')
      if (!btn) return
      this._playSound('click')
      switch (btn.dataset.action) {
        case 'close':      this.close();     break
        case 'minimize':   this._minimize(); break
        case 'attach':     this._attach();   break
        case 'genealogy':  this._selectGenealogy(btn); break
      }
    })

    this._bindDrag(el)

    el.dataset.winId = 'omniinspector'
    WindowManager.register('omniinspector', el)
    WindowManager.watchPanelOpacity(el, () => this._isOpen)
    WindowManager.makeMaximizable(el, el.querySelector('.oi-ctrl--maximize'), {
      onMaximize: () => { this._isMaximized = true; this._toGridDashboard() },
      onRestore : () => { this._isMaximized = false; this._fromGridDashboard() },
    })
    WindowManager.wireSaveButton(el.querySelector('.oi-ctrl--save'), 'omniinspector', () => this._explicitSave())
  }

  /**
   * Header drag — same left/top approach as ui/OmniDraw.js. This is a
   * separate CSS property from the open/close slide (which animates
   * `transform: translateX` via GSAP's `x`), so the two compose safely:
   * dragging only ever happens while the panel is open (x: '0%'), and the
   * slide animation always resolves back to x:'0%'/'100%' without leaving
   * a lingering transform offset for drag to fight with.
   */
  _bindDrag (el) {
    const header = el.querySelector('.oi-header')

    const onDown = (e) => {
      if (e.target.closest('.oi-ctrl')) return   // don't drag when clicking a button
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
      // Switch from the default right-anchored position to left/top once
      // dragging starts — inline left/width takes precedence over the
      // stylesheet's `right: 0` per the CSS spec's over-constrained rule.
      gsap.set(el, { left: this._drag.originX + dx, top: this._drag.originY + dy, right: 'auto' })
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

    this._bindResize(el)
  }

  /**
   * Resize via the bottom-left corner handle. Dragging left grows width
   * (panel is right-anchored, so width grows toward the left); dragging
   * down grows height. Clamped to the min/max bounds set in .oi-panel's
   * CSS (min-width/max-width/min-height/max-height) so it can't be
   * resized into something unusably small or off-screen.
   */
  _bindResize (el) {
    const handle = el.querySelector('.oi-resize-handle')
    if (!handle) return

    const resize = { active: false, startX: 0, startY: 0, startW: 0, startH: 0 }

    const onDown = (e) => {
      e.stopPropagation()   // don't also trigger header drag
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
      const newW = resize.startW - (cx - resize.startX)   // dragging left grows it
      const newH = resize.startH + (cy - resize.startY)   // dragging down grows it
      gsap.set(el, { width: newW, height: newH })
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
  // Each accordion section's content becomes a draggable, reorderable
  // card (see ui/GridWidgets.js). The section elements themselves are
  // MOVED into the grid, not cloned, so everything already wired inside
  // them (inputs, the parent picker, the create-preview canvas, etc.)
  // keeps working untouched. Restoring puts them back exactly where
  // they came from.

  _toGridDashboard () {
    if (this._gridEl) return
    const body = this._el.querySelector('#oi-body')
    if (!body) return

    const labels = {
      identity: 'Identity', hierarchy: 'Hierarchy', domain: 'Domain',
      appearance: 'Appearance', media: 'Media', create: 'Create New',
    }

    const widgets = []
    body.querySelectorAll('.oi-section').forEach(section => {
      const toggleBtn = section.querySelector('.oi-section-toggle')
      const id    = toggleBtn?.dataset.section
      const inner = section.querySelector('.oi-section-inner')
      if (!id || !inner) return
      widgets.push({ id, title: labels[id] ?? id, el: inner })
    })
    if (widgets.length === 0) return

    this._gridWidgets = widgets
    body.style.display = 'none'
    this._gridEl = GridWidgets.mountGrid(body.parentElement, widgets, 'omniinspector')
  }

  _fromGridDashboard () {
    if (!this._gridEl) return
    GridWidgets.unmountGrid(this._gridEl, this._gridWidgets ?? [])
    this._gridEl = null
    this._gridWidgets = null
    const body = this._el.querySelector('#oi-body')
    if (body) body.style.display = ''
  }

  /**
   * Explicit Save button. Every field already autosaves to localStorage
   * on change (OmniNode._save() per node-level edit, _saveExt() per
   * Inspector-only field) — this exists for a visible, deliberate "yes,
   * it's saved" confirmation rather than trusting a silent background
   * write. Also broadcasts omni:force-save so OmniNode flushes its
   * current in-memory state unconditionally, covering anything that
   * hasn't triggered its own save yet. Button flash + last-saved
   * timestamp are handled generically by WindowManager.wireSaveButton.
   */
  _explicitSave () {
    this._saveExt()
    window.dispatchEvent(new CustomEvent('omni:force-save'))
  }

  /**
   * Ξ button — selects (visually pulses) the entire genealogy tree the
   * currently loaded node belongs to: its root, and every descendant of
   * that root. The actual pulse logic lives in OmniNode (it owns the
   * meshes/edges); this just requests it and gives a brief active-state
   * flash on the button itself as confirmation the click landed.
   */
  _selectGenealogy (btn) {
    if (!this._currentId) return
    window.dispatchEvent(new CustomEvent('omni:genealogy-select-request', {
      detail: { id: this._currentId }
    }))
    this._playSound('click')

    if (!btn) return
    btn.classList.add('is-active')
    setTimeout(() => btn.classList.remove('is-active'), 900)
  }

  // ── Empty state ───────────────────────────────────────────────────────────

  _showEmpty () {
    if (this._gridEl) this._fromGridDashboard()

    const body  = this._el.querySelector('#oi-body')
    const badge = this._el.querySelector('#oi-node-badge')
    badge?.classList.remove('is-visible')

    body.innerHTML = /* html */`
      <div class="oi-empty">
        <span class="oi-empty-glyph">⟐i</span>
        <span>No node selected</span>
        <span style="font-size:8px;opacity:0.7">Click a node in the scene<br>or select one in ⟐N</span>
      </div>
    `
  }

  // ── Loaded state — render all four sections ───────────────────────────────

  _renderLoaded () {
    // If the dashboard grid is currently active, the section elements
    // have been MOVED out of #oi-body into grid cards — rebuilding
    // #oi-body's innerHTML right now would happen in a disconnected,
    // hidden element while the visible grid keeps showing the previous
    // node's stale content. Restore to the plain accordion first, rebuild,
    // then re-grid the fresh sections at the end of this method.
    const wasGridded = !!this._gridEl
    if (wasGridded) this._fromGridDashboard()

    const body  = this._el.querySelector('#oi-body')
    const badge = this._el.querySelector('#oi-node-badge')
    const data  = this._currentData
    const ext   = this._ext

    // Update node badge
    if (badge) {
      const prim = PRIMITIVES.find(p => p.key === data.primitive) ?? PRIMITIVES[0]
      badge.classList.add('is-visible')
      badge.querySelector('#oi-badge-dot').style.background   = prim.color
      badge.querySelector('#oi-badge-dot').style.borderColor  = prim.color + '50'
      badge.querySelector('#oi-badge-label').textContent      = data.label ?? data.id
      badge.querySelector('#oi-badge-geo').textContent        = (data.geometry ?? '').replace('Geometry', '')
    }

    this._el.querySelector('#oi-inspect-preview-wrap')?.classList.add('is-visible')
    this._updateInspectPreview(data, ext)

    // Build accordion sections
    body.innerHTML = /* html */`
      ${this._sectionHTML('identity',   '▶ Identity',   this._identityHTML(data, ext))}
      ${this._sectionHTML('hierarchy',  '▶ Hierarchy',  this._hierarchyHTML(data))}
      ${this._sectionHTML('domain',     '▶ Domain',     this._domainHTML(data))}
      ${this._sectionHTML('appearance', '▶ Appearance', this._appearanceHTML(data, ext))}
      ${this._sectionHTML('media',      '▶ Media',      this._mediaHTML(ext))}
      ${this._sectionHTML('data',       '▶ Data',       this._dataHTML(ext))}
      ${this._sectionHTML('create',     '▶ Create New', this._createSectionHTML())}
    `

    // Restore open states
    Object.entries(this._sectionOpen).forEach(([id, isOpen]) => {
      const toggle  = body.querySelector(`[data-section="${id}"]`)
      const content = body.querySelector(`#oisec-${id}`)
      if (!toggle || !content) return
      if (isOpen) {
        toggle.classList.add('is-open')
        content.classList.add('is-open')
        gsap.set(content, { maxHeight: 2000 })
      } else {
        gsap.set(content, { maxHeight: 0 })
      }
    })

    // Wire all section toggles
    body.querySelectorAll('.oi-section-toggle').forEach(btn => {
      btn.addEventListener('click', () => this._toggleSection(btn.dataset.section))
    })

    // Wire all interactive controls
    this._wireIdentity(body, data, ext)
    this._wireHierarchy(body, data)
    this._wireDomain(body, data)
    this._wireAppearance(body, data, ext)
    this._wireMedia(body, ext)
    this._wireData(body, data, ext)
    this._wireCreateSection(body)

    if (this._isMaximized) this._toGridDashboard()
  }

  // ── Section scaffold HTML ─────────────────────────────────────────────────

  _sectionHTML (id, label, innerHtml) {
    return /* html */`
      <div class="oi-section">
        <button class="oi-section-toggle" data-section="${id}">
          <span class="oi-section-arrow">▶</span>
          ${label.replace('▶ ', '')}
        </button>
        <div class="oi-section-content" id="oisec-${id}">
          <div class="oi-section-inner">
            ${innerHtml}
          </div>
        </div>
      </div>
    `
  }

  _toggleSection (id) {
    const btn     = this._el.querySelector(`[data-section="${id}"]`)
    const content = this._el.querySelector(`#oisec-${id}`)
    if (!btn || !content) return

    const isOpen = this._sectionOpen[id]
    this._sectionOpen[id] = !isOpen

    if (isOpen) {
      btn.classList.remove('is-open')
      gsap.to(content, { maxHeight: 0, duration: 0.22, ease: 'power2.in',
        onComplete: () => content.classList.remove('is-open') })
    } else {
      content.classList.add('is-open')
      btn.classList.add('is-open')
      gsap.fromTo(content, { maxHeight: 0 }, { maxHeight: 2000, duration: 0.28, ease: 'power2.out' })
    }
    this._playSound('click')
  }

  // ── IDENTITY section HTML ─────────────────────────────────────────────────

  _identityHTML (data, ext) {
    const primBtns = PRIMITIVES.map(p => /* html */`
      <button class="oi-primitive ${data.primitive === p.key ? 'is-active' : ''}"
              data-primitive="${p.key}"
              title="${p.title}"
              style="${data.primitive === p.key ? `border-color:${p.color}40;color:${p.color};background:${p.color}14` : ''}">
        ${p.label}
      </button>
    `).join('')

    return /* html */`
      <!-- ID (read-only) -->
      <div class="oi-row">
        <span class="oi-label">ID</span>
        <input class="oi-input" id="oi-id" value="${data.id}" readonly tabindex="-1">
        <button class="oi-copy-btn" id="oi-copy-id" title="Copy ID">copy</button>
      </div>

      <!-- Label -->
      <div class="oi-row">
        <span class="oi-label">Label</span>
        <input class="oi-input" id="oi-label" type="text"
               value="${(data.label ?? '').replace(/"/g, '&quot;')}"
               placeholder="Node label…">
      </div>

      <!-- Text (surface content) -->
      <div class="oi-row" style="align-items:flex-start">
        <span class="oi-label" style="padding-top:6px">Text</span>
        <textarea class="oi-textarea" id="oi-text"
                  placeholder="Surface text rendered on node geometry…">${ext?.text ?? ''}</textarea>
      </div>

      <!-- Primitive type -->
      <div class="oi-row" style="flex-direction:column;align-items:flex-start;gap:5px">
        <span class="oi-label oi-label--full">Primitive</span>
        <div class="oi-primitives" id="oi-primitives">${primBtns}</div>
      </div>
    `
  }

  // ── DOMAIN section HTML — mark as space, enter/exit ─────────────────────

  _domainHTML (data) {
    const isDomain   = !!data.isDomain
    const spaceImage = data.spaceImage ?? ''
    const isCurrent  = this._currentSpaceId === data.id

    return /* html */`
      <div class="oi-row">
        <span class="oi-label">Is Domain</span>
        <button class="oi-toggle ${isDomain ? 'is-on' : ''}" id="oi-is-domain" role="switch" aria-checked="${isDomain}"></button>
      </div>
      <div class="oi-row">
        <span class="oi-label">Space Img</span>
        <input class="oi-input" id="oi-space-image" value="${spaceImage}"
               placeholder="Image URL for this space's theme…">
      </div>
      <div class="oi-domain-status ${isCurrent ? 'is-current' : ''}">
        ${isCurrent
          ? '⟐ This is the currently entered space'
          : (isDomain ? 'Marked as a domain — not currently entered' : 'Not yet marked as a domain')}
      </div>
      <div class="oi-row" style="gap:8px">
        <button class="oi-domain-btn oi-domain-btn--enter" id="oi-enter-space" ${(!isDomain || isCurrent) ? 'disabled' : ''}>
          ⟐ Enter as Space
        </button>
        <button class="oi-domain-btn oi-domain-btn--exit" id="oi-exit-space" ${!isCurrent ? 'disabled' : ''}>
          Exit Space
        </button>
      </div>
      <div class="oi-domain-note">
        Objects created (below, or via the ⟐Objects panel) while this
        space is entered will belong to it — parented to its geometry,
        positioned relative to its own origin.
      </div>
    `
  }

  // ── HIERARCHY section HTML ────────────────────────────────────────────────

  _hierarchyHTML (data) {
    const parentId = data.parentId ?? '—'
    const rootId   = data.rootId   ?? '—'
    const depth    = data.depth    ?? 0
    return /* html */`
      <div class="oi-row">
        <span class="oi-label">Parent</span>
        <button class="oi-input oi-parent-picker-btn" id="oi-parent-picker-btn"
                title="Click to choose a parent from all created objects">${parentId}</button>
      </div>
      <div class="oi-row">
        <span class="oi-label">Root</span>
        <input class="oi-input" value="${rootId}" readonly tabindex="-1">
      </div>
      <div class="oi-row">
        <span class="oi-label">Depth</span>
        <input class="oi-input oi-input--sm" value="${depth}" readonly tabindex="-1">
      </div>

      <!-- Parent picker — populated live from the full node array on open -->
      <div class="oi-parent-picker" id="oi-parent-picker" style="display:none">
        <div class="oi-parent-picker-header">
          <span>Choose parent</span>
          <button class="oi-parent-picker-close" id="oi-parent-picker-close">✕</button>
        </div>
        <div class="oi-parent-picker-list" id="oi-parent-picker-list"></div>
      </div>

      <div class="oi-geneo-title">Genealogy — click to expand</div>
      <div class="oi-geneo-root" id="oi-geneo-root"></div>
    `
  }

  // ── APPEARANCE section HTML ───────────────────────────────────────────────

  _appearanceHTML (data, ext) {
    const { r, g, b, a } = this._color
    const hex = rgbToHex(r, g, b)
    const apc = Math.round(a * 100)
    const swatchBg = `rgba(${r},${g},${b},${a})`

    // Material options
    const matOptions = Object.keys(MATERIALS).map(m => /* html */`
      <option value="${m}" ${(ext?.material ?? 'MeshStandardMaterial') === m ? 'selected' : ''}>${m.replace('Mesh', '').replace('Material', '')}</option>
    `).join('')

    // Geometry options
    const geoOptions = GEO_TYPES.map(g => /* html */`
      <option value="${g}" ${(data.geometry ?? 'SphereGeometry') === g ? 'selected' : ''}>${g.replace('Geometry', '')}</option>
    `).join('')

    const scl = ext?.scale ?? { x: 1, y: 1, z: 1 }
    const wf  = ext?.wireframe ?? false

    return /* html */`
      <!-- RGBA Color picker -->
      <div class="oi-slot-label">Color</div>
      <div class="oi-color-block" id="oi-color-block">

        <!-- Swatch + hex + alpha readout row -->
        <div class="oi-color-top">
          <div class="oi-swatch-wrap" id="oi-swatch-wrap" title="Click to open color picker">
            <div class="oi-swatch-check"></div>
            <div class="oi-swatch-fill" id="oi-swatch-fill" style="background:${swatchBg}"></div>
            <input class="oi-native-color" id="oi-native-color" type="color" value="${hex}">
          </div>
          <input class="oi-hex-input" id="oi-hex-input" type="text"
                 value="${hex}" maxlength="7" spellcheck="false" placeholder="#rrggbb">
          <span class="oi-alpha-readout" id="oi-alpha-readout">${apc}%</span>
        </div>

        <!-- RGBA sliders -->
        <div class="oi-slider-grid">
          <div class="oi-slider-row">
            <span class="oi-slider-label oi-slider-label--r">R</span>
            <input class="oi-slider oi-slider--r" id="oi-r" type="range" min="0" max="255" value="${r}">
            <span class="oi-slider-val" id="oi-r-val">${r}</span>
          </div>
          <div class="oi-slider-row">
            <span class="oi-slider-label oi-slider-label--g">G</span>
            <input class="oi-slider oi-slider--g" id="oi-g" type="range" min="0" max="255" value="${g}">
            <span class="oi-slider-val" id="oi-g-val">${g}</span>
          </div>
          <div class="oi-slider-row">
            <span class="oi-slider-label oi-slider-label--b">B</span>
            <input class="oi-slider oi-slider--b" id="oi-b" type="range" min="0" max="255" value="${b}">
            <span class="oi-slider-val" id="oi-b-val">${b}</span>
          </div>
          <div class="oi-slider-row">
            <span class="oi-slider-label oi-slider-label--a">A</span>
            <input class="oi-slider oi-slider--a" id="oi-a" type="range" min="0" max="100" value="${apc}">
            <span class="oi-slider-val" id="oi-a-val">${apc}%</span>
          </div>
        </div>
      </div>

      <!-- Material selector -->
      <div class="oi-row">
        <span class="oi-label">Material</span>
        <select class="oi-select" id="oi-material">${matOptions}</select>
      </div>

      <!-- Geometry selector -->
      <div class="oi-row">
        <span class="oi-label">Geometry</span>
        <select class="oi-select" id="oi-geometry">${geoOptions}</select>
      </div>

      <!-- Wireframe toggle -->
      <div class="oi-row">
        <span class="oi-label">Wire</span>
        <div class="oi-toggle-wrap">
          <label class="oi-toggle">
            <input type="checkbox" id="oi-wireframe" ${wf ? 'checked' : ''}>
            <div class="oi-toggle-track"></div>
            <div class="oi-toggle-thumb"></div>
          </label>
          <span class="oi-toggle-label">Wireframe</span>
        </div>
      </div>

      <!-- Scale XYZ -->
      <div class="oi-row" style="flex-direction:column;align-items:flex-start;gap:4px">
        <span class="oi-label">Scale</span>
        <div class="oi-xyz-row">
          <div class="oi-xyz-field">
            <span class="oi-xyz-label">X</span>
            <input class="oi-xyz-input" id="oi-sx" type="number"
                   value="${scl.x}" step="0.01" min="0.001">
          </div>
          <div class="oi-xyz-field">
            <span class="oi-xyz-label">Y</span>
            <input class="oi-xyz-input" id="oi-sy" type="number"
                   value="${scl.y}" step="0.01" min="0.001">
          </div>
          <div class="oi-xyz-field">
            <span class="oi-xyz-label">Z</span>
            <input class="oi-xyz-input" id="oi-sz" type="number"
                   value="${scl.z}" step="0.01" min="0.001">
          </div>
        </div>
      </div>

      <!-- Texture slot -->
      <div class="oi-slot">
        <span class="oi-slot-label">Texture</span>
        <div class="oi-drop-zone" id="oi-tex-drop">
          <span class="oi-drop-zone-icon">🖼</span>
          Drop image file or enter URL
        </div>
        <img class="oi-tex-preview" id="oi-tex-preview" alt="Texture preview">
        <div class="oi-slot-url-row">
          <input class="oi-input" id="oi-tex-url" type="url"
                 placeholder="https://…" value="${ext?.texture ?? ''}">
          <button class="oi-slot-apply" id="oi-tex-apply">Apply</button>
        </div>
        <button class="oi-tex-clear ${ext?.texture ? 'is-visible' : ''}" id="oi-tex-clear">✕ Clear texture</button>
        <input type="file" id="oi-tex-file" accept="image/*" style="display:none">
      </div>
    `
  }

  // ── MEDIA section HTML ────────────────────────────────────────────────────

  // ── CREATE section HTML — mini live preview, create while inspecting ────
  // Mirrors ui/OmniDraw.js's preview+export, embedded here so you don't
  // have to leave the Inspector to make a new object while looking at
  // another one. Uses the exact same omni:node-create-request event, so
  // it automatically respects space-scoping (OmniNode parents into
  // whatever space is currently entered, same as OmniDraw's button).

  // ── DATA section HTML — Internal/External Display/Code + plane toggle ───
  // "Internal" = shown here, in the flat panel. "External" = shown
  // spatially, on the floating plane mesh (toggle below) — the plane
  // renders whatever's currently in External Display + External Code.

  _dataHTML (ext) {
    const ta = (label, key, value, mono = false) => /* html */`
      <div class="oi-data-field">
        <span class="oi-label" style="width:auto">${label}</span>
        <textarea class="oi-textarea ${mono ? 'oi-textarea--mono' : ''}" data-data-key="${key}"
                  placeholder="${label}…">${value ?? ''}</textarea>
      </div>
    `
    return /* html */`
      ${ta('Internal Display', 'internalDisplay', ext.internalDisplay)}
      ${ta('Internal Code', 'internalCode', ext.internalCode, true)}
      ${ta('External Display', 'externalDisplay', ext.externalDisplay)}
      ${ta('External Code', 'externalCode', ext.externalCode, true)}
      <div class="oi-row">
        <span class="oi-label" style="width:auto">Show External on plane</span>
        <button class="oi-toggle ${ext.showOnPlane ? 'is-on' : ''}" id="oi-show-on-plane" role="switch" aria-checked="${ext.showOnPlane}"></button>
      </div>
      <div class="oi-data-note">
        External fields render onto a floating plane next to the object
        in the 3D world while this is on.
      </div>
    `
  }

  _wireData (body, data, ext) {
    body.querySelectorAll('[data-data-key]').forEach(textarea => {
      let timer = null
      textarea.addEventListener('input', () => {
        ext[textarea.dataset.dataKey] = textarea.value
        clearTimeout(timer)
        timer = setTimeout(() => {
          this._saveExt()
          if (ext.showOnPlane && (textarea.dataset.dataKey === 'externalDisplay' || textarea.dataset.dataKey === 'externalCode')) {
            this._updateInfoPlaneTexture()
          }
        }, 300)
      })
    })

    const planeToggle = body.querySelector('#oi-show-on-plane')
    planeToggle?.addEventListener('click', () => {
      const next = !planeToggle.classList.contains('is-on')
      planeToggle.classList.toggle('is-on', next)
      planeToggle.setAttribute('aria-checked', String(next))
      ext.showOnPlane = next
      this._saveExt()
      if (next) this._showInfoPlane(data, ext)
      else this._hideInfoPlane()
    })
  }

  _createSectionHTML () {
    const t = this._createTransform
    const row = (label, key, val, min, max, step) => /* html */`
      <div class="oi-row">
        <span class="oi-row-label" style="width:26px">${label}</span>
        <input type="range" class="oi-create-range" data-transform-key="${key}"
               min="${min}" max="${max}" step="${step}" value="${val}">
        <span class="oi-create-range-val" data-transform-val-for="${key}">${Number(val).toFixed(step < 1 ? 2 : 0)}</span>
      </div>
    `
    return /* html */`
      <div class="oi-create-preview-wrap">
        <canvas class="oi-create-canvas" id="oi-create-canvas" width="120" height="120"></canvas>
        <div class="oi-create-btns">
          <button class="oi-create-btn" id="oi-create-morph">⟐ Morph → Sphere</button>
          <button class="oi-create-btn oi-create-btn--export" id="oi-create-export">⟐ Export to Scene</button>
        </div>
        <div class="oi-row" style="justify-content:flex-start;gap:8px">
          <button class="oi-toggle" id="oi-create-as-space" role="switch" aria-checked="false"></button>
          <span class="oi-label" style="width:auto">Mark + enter as new space on export</span>
        </div>
      </div>

      <div class="oi-create-transform-title">
        Transform — tied to this node, applied on Export
      </div>
      ${row('px', 'px', t.px, -100, 100, 1)}
      ${row('py', 'py', t.py, -100, 100, 1)}
      ${row('pz', 'pz', t.pz, -100, 100, 1)}
      ${row('rx', 'rx', t.rx, -3.14, 3.14, 0.01)}
      ${row('ry', 'ry', t.ry, -3.14, 3.14, 0.01)}
      ${row('rz', 'rz', t.rz, -3.14, 3.14, 0.01)}
      ${row('sx', 'sx', t.sx, -10, 10, 0.1)}
      ${row('sy', 'sy', t.sy, -10, 10, 0.1)}
      ${row('sz', 'sz', t.sz, -10, 10, 0.1)}
    `
  }

  _mediaHTML (ext) {
    const slots = [
      { key: 'images', label: 'Images', icon: '🖼',  accept: 'image/*'  },
      { key: 'sound',  label: 'Sound',  icon: '🔊',  accept: 'audio/*'  },
      { key: 'media',  label: 'Media',  icon: '📎',  accept: '*/*'      },
    ]

    return slots.map(slot => {
      const items    = (ext?.[slot.key] ?? [])
      const itemHtml = items.map((item, idx) => /* html */`
        <div class="oi-slot-item">
          <span class="oi-slot-item-name" title="${item.src}">${item.label || item.src}</span>
          <button class="oi-slot-item-rm"
                  data-media-key="${slot.key}"
                  data-media-idx="${idx}">✕</button>
        </div>
      `).join('')

      return /* html */`
        <div class="oi-slot" id="oi-slot-${slot.key}">
          <span class="oi-slot-label">${slot.label}</span>
          <div class="oi-drop-zone" data-media-drop="${slot.key}">
            <span class="oi-drop-zone-icon">${slot.icon}</span>
            Drop file or enter URL
          </div>
          <div class="oi-slot-url-row">
            <input class="oi-input" type="url" id="oi-url-${slot.key}"
                   placeholder="https://…">
            <button class="oi-slot-apply" data-media-apply="${slot.key}">Add</button>
          </div>
          <div class="oi-slot-items" id="oi-items-${slot.key}">${itemHtml}</div>
          <input type="file" id="oi-file-${slot.key}" accept="${slot.accept}" style="display:none">
        </div>
      `
    }).join('')
  }

  // ── Wire IDENTITY controls ────────────────────────────────────────────────

  _wireIdentity (body, data, ext) {
    // Copy ID
    body.querySelector('#oi-copy-id')?.addEventListener('click', () => {
      navigator.clipboard?.writeText(data.id).catch(() => {})
      const btn = body.querySelector('#oi-copy-id')
      if (btn) { btn.textContent = 'copied'; setTimeout(() => { btn.textContent = 'copy' }, 1200) }
      this._playSound('click')
    })

    // Label input — debounced dispatch
    let labelTimer = null
    body.querySelector('#oi-label')?.addEventListener('input', (e) => {
      clearTimeout(labelTimer)
      labelTimer = setTimeout(() => {
        const label = e.target.value.trim()
        this._currentData.label = label
        this._updateBadge()
        window.dispatchEvent(new CustomEvent('omni:node-label-set', {
          detail: { id: data.id, label }
        }))
        this._saveExt()
      }, 300)
    })

    // Text textarea
    let textTimer = null
    body.querySelector('#oi-text')?.addEventListener('input', (e) => {
      clearTimeout(textTimer)
      textTimer = setTimeout(() => {
        ext.text = e.target.value
        this._saveExt()
      }, 400)
    })

    // Primitive buttons
    body.querySelector('#oi-primitives')?.addEventListener('click', (e) => {
      const btn  = e.target.closest('.oi-primitive')
      if (!btn) return
      const prim = btn.dataset.primitive
      const def  = PRIMITIVES.find(p => p.key === prim)
      if (!def) return

      // Update active state
      body.querySelectorAll('.oi-primitive').forEach(b => {
        const isThis = b.dataset.primitive === prim
        b.classList.toggle('is-active', isThis)
        b.style.borderColor = isThis ? def.color + '40' : ''
        b.style.color       = isThis ? def.color        : ''
        b.style.background  = isThis ? def.color + '14' : ''
      })

      this._currentData.primitive = prim
      this._playSound('click')

      // If the primitive changes, update the color picker to match its base color
      const rgb = hexToRgb(def.color)
      if (rgb) {
        this._color = { ...rgb, a: this._color.a }
        this._syncColorUI(body)
        this._applyColorToMesh()
      }

      window.dispatchEvent(new CustomEvent('omni:node-color-set', {
        detail: { id: data.id, color: rgbToHex(this._color.r, this._color.g, this._color.b) }
      }))
    })
  }

  // ── Wire HIERARCHY controls — parent picker ─────────────────────────────

  _wireHierarchy (body, data) {
    const btn    = body.querySelector('#oi-parent-picker-btn')
    const picker = body.querySelector('#oi-parent-picker')
    const list   = body.querySelector('#oi-parent-picker-list')
    const close  = body.querySelector('#oi-parent-picker-close')
    if (!btn || !picker || !list) return

    btn.addEventListener('click', () => {
      const isOpen = picker.style.display !== 'none'
      if (isOpen) { picker.style.display = 'none'; return }
      this._renderParentPickerList(list, data)
      picker.style.display = 'flex'
    })

    close?.addEventListener('click', () => { picker.style.display = 'none' })

    const geneoRoot = body.querySelector('#oi-geneo-root')
    if (geneoRoot) {
      geneoRoot.innerHTML = ''
      const rootId   = data.rootId ?? data.id
      const rootNode = (this._allNodes ?? []).find(n => n.id === rootId) ?? data
      const expandPath = this._ancestorPathIds(data.id)
      geneoRoot.appendChild(this._buildGeneoNode(rootNode, { expandPath, currentId: data.id }))
      geneoRoot.querySelector('.oi-geneo-row.is-current')?.scrollIntoView({ block: 'center' })
    }
  }

  /** Every id from the given node up to its root, inclusive — used to
   *  auto-expand the tree down to whichever node is currently loaded,
   *  so ancestors are visible without needing to click through them. */
  _ancestorPathIds (id) {
    const path = new Set([id])
    let current = (this._allNodes ?? []).find(n => n.id === id)
    let guard = 0
    while (current?.parentId && guard++ < 500) {
      if (path.has(current.parentId)) break   // cycle guard
      path.add(current.parentId)
      current = (this._allNodes ?? []).find(n => n.id === current.parentId)
    }
    return path
  }

  /**
   * One row of the genealogy tree explorer — auto-generated from real
   * hierarchy data (this._allNodes, kept in sync via omni:nodes-updated),
   * NOT the freeform Data fields. Rendered from the absolute root down,
   * with the ancestor path to the currently loaded node auto-expanded
   * (so you see the full lineage immediately) while every other branch
   * stays collapsed until clicked. Clicking a row with children expands/
   * collapses it in place; it never re-selects a different node in the
   * Inspector — "the reality becomes discoverable" by drilling down
   * through the same view, not by navigating away from it.
   */
  _buildGeneoNode (node, { expandPath = new Set(), currentId = null } = {}) {
    const children = (this._allNodes ?? []).filter(n => n.parentId === node.id)
    const wrap = document.createElement('div')
    wrap.className = 'oi-geneo-node'

    const isCurrent = node.id === currentId
    const row = document.createElement('div')
    row.className = 'oi-geneo-row' + (isCurrent ? ' is-current' : '')
    row.innerHTML = /* html */`
      <span class="oi-geneo-arrow">${children.length ? '▶' : '·'}</span>
      <span class="oi-geneo-label">${node.label || node.id}</span>
      ${children.length ? `<span class="oi-geneo-count">${children.length}</span>` : ''}
    `
    wrap.appendChild(row)

    const childContainer = document.createElement('div')
    childContainer.className = 'oi-geneo-children'
    wrap.appendChild(childContainer)

    let built = false
    const buildChildren = () => {
      children.forEach(c => childContainer.appendChild(this._buildGeneoNode(c, { expandPath, currentId })))
      built = true
    }

    const autoExpand = expandPath.has(node.id) && children.length > 0
    if (autoExpand) {
      buildChildren()
      childContainer.style.display = 'block'
    } else {
      childContainer.style.display = 'none'
    }

    if (children.length) {
      row.style.cursor = 'pointer'
      if (autoExpand) row.querySelector('.oi-geneo-arrow').textContent = '▼'
      row.addEventListener('click', () => {
        const isOpen = childContainer.style.display !== 'none'
        if (!built) buildChildren()
        childContainer.style.display = isOpen ? 'none' : 'block'
        row.querySelector('.oi-geneo-arrow').textContent = isOpen ? '▶' : '▼'
      })
    }

    return wrap
  }

  /**
   * Populates the parent-picker list from the full node array (kept in
   * sync via omni:nodes-updated — see _bindEvents). Excludes the node
   * itself and anything already downstream of it (would create a cycle;
   * OmniNode also refuses this server-side, but disabling it here avoids
   * a confusing round-trip).
   */
  _renderParentPickerList (list, data) {
    const all = this._allNodes ?? []
    const descendantIds = this._descendantIdsOf(data.id, all)

    const options = all.filter(n => n.id !== data.id)

    let html = /* html */`
      <div class="oi-parent-picker-item oi-parent-picker-none" data-parent-id="">
        <span>— None (make root) —</span>
      </div>
    `

    if (options.length === 0) {
      list.innerHTML = html + `<div class="oi-parent-picker-empty">No other objects created yet.</div>`
    } else {
      html += options.map(n => {
        const disabled = descendantIds.has(n.id)
        return /* html */`
          <div class="oi-parent-picker-item ${disabled ? 'is-disabled' : ''}"
               data-parent-id="${disabled ? '' : n.id}"
               title="${disabled ? 'Would create a cycle — this is a descendant' : ''}">
            <span>${n.label || n.id}</span>
            <span class="oi-parent-picker-item-geo">${(n.geometry ?? '').replace('Geometry', '')}</span>
          </div>
        `
      }).join('')
      list.innerHTML = html
    }

    list.querySelectorAll('.oi-parent-picker-item:not(.is-disabled)').forEach(item => {
      item.addEventListener('click', () => {
        const parentId = item.dataset.parentId || null
        window.dispatchEvent(new CustomEvent('omni:node-parent-set', {
          detail: { id: data.id, parentId }
        }))
        this._playSound('click')
        list.closest('.oi-parent-picker').style.display = 'none'
      })
    })
  }

  _descendantIdsOf (id, allNodes) {
    const out = new Set()
    const walk = (parentId) => {
      for (const n of allNodes) {
        if (n.parentId === parentId && !out.has(n.id)) {
          out.add(n.id)
          walk(n.id)
        }
      }
    }
    walk(id)
    return out
  }

  // ── Wire DOMAIN controls — mark as space, enter/exit ────────────────────

  _wireDomain (body, data) {
    const toggle = body.querySelector('#oi-is-domain')
    const imgInput = body.querySelector('#oi-space-image')
    const enterBtn = body.querySelector('#oi-enter-space')
    const exitBtn  = body.querySelector('#oi-exit-space')

    toggle?.addEventListener('click', () => {
      const next = !toggle.classList.contains('is-on')
      toggle.classList.toggle('is-on', next)
      toggle.setAttribute('aria-checked', String(next))
      data.isDomain = next
      window.dispatchEvent(new CustomEvent('omni:node-set-domain', {
        detail: { id: data.id, isDomain: next }
      }))
      this._refreshDomainSection()
    })

    let imgTimer = null
    imgInput?.addEventListener('input', (e) => {
      clearTimeout(imgTimer)
      const value = e.target.value.trim()
      imgTimer = setTimeout(() => {
        data.spaceImage = value
        window.dispatchEvent(new CustomEvent('omni:node-set-domain', {
          detail: { id: data.id, isDomain: !!data.isDomain, spaceImage: value }
        }))
      }, 350)
    })

    enterBtn?.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('omni:enter-space-request', { detail: { id: data.id } }))
      this._playSound('click')
    })

    exitBtn?.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('omni:exit-space-request', { detail: {} }))
      this._playSound('click')
    })
  }

  /** Re-render just the Domain section's HTML — used after entering/
   *  exiting a space, or toggling Is Domain, so button enabled-state and
   *  the status line stay accurate without a full panel re-render. */
  _refreshDomainSection () {
    if (!this._currentData || !this._isOpen) return
    const body = this._el?.querySelector('#oi-body')
    const section = body?.querySelector('#oisec-domain .oi-section-inner')
    if (!section) return
    section.innerHTML = this._domainHTML(this._currentData)
    this._wireDomain(body, this._currentData)
  }

  // ── Wire APPEARANCE controls ──────────────────────────────────────────────

  _wireAppearance (body, data, ext) {
    // ── Color picker ─────────────────────────────────────────────────

    // Native color input (triggered by swatch click via z-stacked input)
    body.querySelector('#oi-native-color')?.addEventListener('input', (e) => {
      const rgb = hexToRgb(e.target.value)
      if (!rgb) return
      this._color = { ...rgb, a: this._color.a }
      this._syncColorUI(body)
      this._applyColorToMesh()
      this._dispatchColor()
    })

    // Hex text input
    body.querySelector('#oi-hex-input')?.addEventListener('change', (e) => {
      let val = e.target.value.trim()
      if (!val.startsWith('#')) val = '#' + val
      const rgb = hexToRgb(val)
      if (!rgb) return
      this._color = { ...rgb, a: this._color.a }
      this._syncColorUI(body)
      this._applyColorToMesh()
      this._dispatchColor()
    })

    // R / G / B sliders
    const channels = ['r', 'g', 'b']
    channels.forEach(ch => {
      body.querySelector(`#oi-${ch}`)?.addEventListener('input', (e) => {
        this._color[ch] = parseInt(e.target.value, 10)
        this._syncColorUI(body)
        this._applyColorToMesh()
        this._dispatchColor()
      })
    })

    // Alpha slider
    body.querySelector('#oi-a')?.addEventListener('input', (e) => {
      this._color.a = clamp(parseInt(e.target.value, 10) / 100, 0, 1)
      this._syncColorUI(body)
      this._applyColorToMesh()
    })

    // ── Material selector ─────────────────────────────────────────────

    body.querySelector('#oi-material')?.addEventListener('change', (e) => {
      const matName = e.target.value
      this._applyMaterial(matName)
      ext.material = matName
      this._saveExt()
      this._playSound('click')
    })

    // ── Geometry selector ─────────────────────────────────────────────

    body.querySelector('#oi-geometry')?.addEventListener('change', (e) => {
      const geoType = e.target.value
      this._currentData.geometry = geoType
      window.dispatchEvent(new CustomEvent('omni:node-geo-set', {
        detail: { id: data.id, geometry: geoType }
      }))
      this._updateBadge()
      this._playSound('click')
    })

    // ── Wireframe toggle ──────────────────────────────────────────────

    body.querySelector('#oi-wireframe')?.addEventListener('change', (e) => {
      ext.wireframe = e.target.checked
      if (this._currentMesh?.material) {
        // MeshBasicMaterial and MeshStandardMaterial support wireframe
        const mat = this._currentMesh.material
        if ('wireframe' in mat) {
          mat.wireframe = e.target.checked
          mat.needsUpdate = true
        }
      }
      this._saveExt()
      this._playSound('click')
    })

    // ── Scale XYZ ─────────────────────────────────────────────────────

    let scaleTimer = null
    const scaleHandler = () => {
      clearTimeout(scaleTimer)
      scaleTimer = setTimeout(() => {
        const x = parseFloat(body.querySelector('#oi-sx')?.value) || 1
        const y = parseFloat(body.querySelector('#oi-sy')?.value) || 1
        const z = parseFloat(body.querySelector('#oi-sz')?.value) || 1
        const scale = {
          x: clamp(x, 0.001, 1000),
          y: clamp(y, 0.001, 1000),
          z: clamp(z, 0.001, 1000),
        }

        if (this._currentMesh) {
          this._currentMesh.scale.set(scale.x, scale.y, scale.z)
        }

        ext.scale = scale
        this._saveExt()

        window.dispatchEvent(new CustomEvent('omni:node-scale-set', {
          detail: { id: data.id, scale }
        }))
      }, 200)
    }

    body.querySelector('#oi-sx')?.addEventListener('input', scaleHandler)
    body.querySelector('#oi-sy')?.addEventListener('input', scaleHandler)
    body.querySelector('#oi-sz')?.addEventListener('input', scaleHandler)

    // ── Texture slot ──────────────────────────────────────────────────

    // Drop zone — click opens file picker
    const texDrop  = body.querySelector('#oi-tex-drop')
    const texFile  = body.querySelector('#oi-tex-file')
    const texUrl   = body.querySelector('#oi-tex-url')
    const texApply = body.querySelector('#oi-tex-apply')
    const texClear = body.querySelector('#oi-tex-clear')

    texDrop?.addEventListener('click', () => texFile?.click())

    texDrop?.addEventListener('dragover', (e) => {
      e.preventDefault()
      texDrop.classList.add('drag-over')
    })
    texDrop?.addEventListener('dragleave', () => texDrop.classList.remove('drag-over'))
    texDrop?.addEventListener('drop', (e) => {
      e.preventDefault()
      texDrop.classList.remove('drag-over')
      const file = e.dataTransfer?.files?.[0]
      if (file) this._loadTextureFile(file, body, ext)
    })

    texFile?.addEventListener('change', () => {
      const file = texFile.files?.[0]
      if (file) this._loadTextureFile(file, body, ext)
      texFile.value = ''
    })

    texApply?.addEventListener('click', () => {
      const url = texUrl?.value?.trim()
      if (url) {
        this._applyTextureUrl(url, body, ext)
        this._playSound('click')
      }
    })

    texClear?.addEventListener('click', () => {
      this._clearTexture(body, ext)
      this._playSound('close')
    })

    // Restore texture preview if one exists
    if (ext?.texture) {
      const preview = body.querySelector('#oi-tex-preview')
      if (preview) {
        preview.src = ext.texture
        preview.classList.add('is-visible')
      }
    }
  }

  // ── Wire MEDIA controls ───────────────────────────────────────────────────

  _wireMedia (body, ext) {
    const ext_ = ext ?? this._ext
    const slots = ['images', 'sound', 'media']

    slots.forEach(key => {
      const dropZone = body.querySelector(`[data-media-drop="${key}"]`)
      const fileInp  = body.querySelector(`#oi-file-${key}`)
      const urlInp   = body.querySelector(`#oi-url-${key}`)
      const addBtn   = body.querySelector(`[data-media-apply="${key}"]`)

      // Drop zone click → file picker
      dropZone?.addEventListener('click', () => fileInp?.click())

      // Drag events
      dropZone?.addEventListener('dragover', (e) => {
        e.preventDefault()
        dropZone.classList.add('drag-over')
      })
      dropZone?.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'))
      dropZone?.addEventListener('drop', (e) => {
        e.preventDefault()
        dropZone.classList.remove('drag-over')
        const file = e.dataTransfer?.files?.[0]
        if (file) this._addMediaFile(key, file, body, ext_)
      })

      // File input change
      fileInp?.addEventListener('change', () => {
        const file = fileInp.files?.[0]
        if (file) this._addMediaFile(key, file, body, ext_)
        fileInp.value = ''
      })

      // URL add button
      addBtn?.addEventListener('click', () => {
        const url = urlInp?.value?.trim()
        if (!url) return
        this._addMediaItem(key, { src: url, label: url.split('/').pop() || url }, body, ext_)
        if (urlInp) urlInp.value = ''
        this._playSound('click')
      })
    })

    // Remove item buttons (delegated from body)
    body.addEventListener('click', (e) => {
      const btn = e.target.closest('.oi-slot-item-rm')
      if (!btn) return
      const key = btn.dataset.mediaKey
      const idx = parseInt(btn.dataset.mediaIdx, 10)
      if (key && !isNaN(idx)) {
        ext_[key].splice(idx, 1)
        this._saveExt()
        this._refreshMediaList(key, body, ext_)
        this._playSound('close')
      }
    })
  }

  // ── Wire CREATE section — mini preview, morph, export ────────────────────

  _wireCreateSection (body) {
    this._teardownCreatePreview()

    const canvas = body.querySelector('#oi-create-canvas')
    if (!canvas) return

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
    renderer.setSize(120, 120, false)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

    const scene  = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 10)
    camera.position.set(0, 0.6, 2.2)
    camera.lookAt(0, 0, 0)
    scene.add(new THREE.AmbientLight(0xffffff, 0.6))
    const key = new THREE.DirectionalLight(0xffffff, 1.0)
    key.position.set(2, 3, 2)
    scene.add(key)

    const geo  = new THREE.BoxGeometry(1, 1, 1)
    const mat  = new THREE.MeshStandardMaterial({ color: 0xb99cff, roughness: 0.4, metalness: 0.1 })
    const mesh = new THREE.Mesh(geo, mat)
    scene.add(mesh)

    this._createPreview = { renderer, scene, camera, mesh, geoType: 'BoxGeometry' }
    this._applyCreateTransform()

    body.querySelector('#oi-create-morph')?.addEventListener('click', () => this._createMorph())
    body.querySelector('#oi-create-export')?.addEventListener('click', (e) => this._createExport(e.currentTarget))

    const spaceToggle = body.querySelector('#oi-create-as-space')
    spaceToggle?.addEventListener('click', () => {
      const next = !spaceToggle.classList.contains('is-on')
      spaceToggle.classList.toggle('is-on', next)
      spaceToggle.setAttribute('aria-checked', String(next))
    })

    body.querySelectorAll('[data-transform-key]').forEach(input => {
      input.addEventListener('input', () => {
        const key = input.dataset.transformKey
        this._createTransform[key] = Number(input.value)
        const valEl = body.querySelector(`[data-transform-val-for="${key}"]`)
        if (valEl) valEl.textContent = Number(input.value).toFixed(Number(input.step) < 1 ? 2 : 0)
        this._applyCreateTransform()
      })
    })
  }

  /** Pushes _createTransform onto the live preview mesh — px/py/pz are
   *  scaled down (matching ui/OmniDraw.js's convention) since the
   *  preview's tiny scene uses much smaller units than the main world. */
  _applyCreateTransform () {
    const mesh = this._createPreview?.mesh
    if (!mesh) return
    const t = this._createTransform
    mesh.position.set(t.px / 20, t.py / 20, t.pz / 20)
    mesh.rotation.set(t.rx, t.ry, t.rz)
    mesh.scale.set(t.sx, t.sy, t.sz)
  }

  _teardownCreatePreview () {
    if (!this._createPreview) return
    this._createPreview.mesh.geometry?.dispose()
    this._createPreview.mesh.material?.dispose()
    this._createPreview.renderer.dispose()
    this._createPreview = null
  }

  // ── Inspect preview — spinning view of the ACTUAL loaded node ───────────
  // Same visual language as the Create section (and ui/OmniDraw's own
  // preview), but reflects the real selected node's geometry/color/
  // wireframe rather than a blank new object. One renderer is created
  // lazily and reused across node switches — just its mesh's geometry/
  // material gets updated, rather than tearing the whole thing down and
  // rebuilding it every time you select something different.

  _setupInspectPreviewIfNeeded () {
    if (this._inspectPreview) return
    const canvas = this._el?.querySelector('#oi-inspect-canvas')
    if (!canvas) return

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
    renderer.setSize(90, 90, false)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

    const scene  = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 10)
    camera.position.set(0, 0.5, 2.1)
    camera.lookAt(0, 0, 0)
    scene.add(new THREE.AmbientLight(0xffffff, 0.6))
    const key = new THREE.DirectionalLight(0xffffff, 1.0)
    key.position.set(2, 3, 2)
    scene.add(key)

    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, metalness: 0.1 })
    )
    scene.add(mesh)

    this._inspectPreview = { renderer, scene, camera, mesh, geoType: 'BoxGeometry' }
  }

  /** Syncs the inspect-preview mesh to match the currently loaded node's
   *  geometry/color/wireframe. Called every time _renderLoaded() runs. */
  _updateInspectPreview (data, ext) {
    this._setupInspectPreviewIfNeeded()
    const p = this._inspectPreview
    if (!p) return

    if (data.geometry && data.geometry !== p.geoType) {
      const builder = GEOMETRY_DEFS[data.geometry]
      p.mesh.geometry.dispose()
      p.mesh.geometry = builder ? builder() : new THREE.BoxGeometry(1, 1, 1)
      p.geoType = data.geometry
    }
    if (data.color) {
      try { p.mesh.material.color.set(data.color) } catch (_) {}
    }
    p.mesh.material.wireframe = !!ext?.wireframe
    p.mesh.material.needsUpdate = true
  }

  _teardownInspectPreview () {
    if (!this._inspectPreview) return
    this._inspectPreview.mesh.geometry?.dispose()
    this._inspectPreview.mesh.material?.dispose()
    this._inspectPreview.renderer.dispose()
    this._inspectPreview = null
  }

  // ── Info plane — floating plane showing External Display/Code ──────────
  // One plane, positioned just beside the selected node, billboarded to
  // face the camera every frame (see update()). Content is drawn onto a
  // plain 2D canvas and uploaded as a CanvasTexture — cheap, and easy to
  // redraw on every edit without touching Three.js geometry at all.

  _showInfoPlane (data, ext) {
    if (!this._currentMesh) return

    if (!this._infoPlane) {
      const canvas = document.createElement('canvas')
      canvas.width = 512
      canvas.height = 512
      const texture = new THREE.CanvasTexture(canvas)
      const mat = new THREE.MeshBasicMaterial({
        map: texture, transparent: true, side: THREE.DoubleSide, depthTest: false,
      })
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), mat)
      mesh.renderOrder = 999   // always draw on top, like a HUD label
      this.ctx.scene.add(mesh)

      // Offset to the side of the node in world space, roughly matching
      // its own scale so it doesn't overlap a large object.
      const scale = this._currentMesh.scale
      const offset = new THREE.Vector3(2 + Math.max(scale.x, scale.y, scale.z), 0, 0)

      this._infoPlane = { mesh, canvas, ctx2d: canvas.getContext('2d'), texture, offset }
    }

    this._updateInfoPlaneTexture()
  }

  _hideInfoPlane () {
    if (!this._infoPlane) return
    this.ctx.scene.remove(this._infoPlane.mesh)
    this._infoPlane.mesh.geometry.dispose()
    this._infoPlane.mesh.material.dispose()
    this._infoPlane.texture.dispose()
    this._infoPlane = null
  }

  _updateInfoPlaneTexture () {
    if (!this._infoPlane) return
    const { ctx2d: c, canvas } = this._infoPlane
    const ext = this._ext ?? {}

    c.clearRect(0, 0, canvas.width, canvas.height)
    c.fillStyle = 'rgba(8, 8, 14, 0.88)'
    c.strokeStyle = 'rgba(255, 255, 255, 0.25)'
    c.lineWidth = 3
    c.fillRect(0, 0, canvas.width, canvas.height)
    c.strokeRect(1.5, 1.5, canvas.width - 3, canvas.height - 3)

    const wrapText = (text, x, y, maxWidth, lineHeight, maxLines) => {
      const words = (text ?? '').split(/\s+/)
      let line = ''
      let lines = 0
      for (const word of words) {
        const test = line ? line + ' ' + word : word
        if (c.measureText(test).width > maxWidth && line) {
          c.fillText(line, x, y)
          line = word
          y += lineHeight
          lines++
          if (lines >= maxLines) { c.fillText(line + ' …', x, y); return y }
        } else {
          line = test
        }
      }
      if (line) c.fillText(line, x, y)
      return y
    }

    // "DISPLAY" section
    c.fillStyle = 'rgba(150, 220, 255, 0.9)'
    c.font = 'bold 20px "Courier New", monospace'
    c.fillText('DISPLAY', 24, 40)
    c.fillStyle = 'rgba(255, 255, 255, 0.92)'
    c.font = '16px "Courier New", monospace'
    let y = wrapText(ext.externalDisplay || '(empty)', 24, 72, canvas.width - 48, 22, 8)

    // Divider
    y += 24
    c.strokeStyle = 'rgba(255,255,255,0.15)'
    c.beginPath(); c.moveTo(24, y); c.lineTo(canvas.width - 24, y); c.stroke()

    // "CODE" section
    y += 32
    c.fillStyle = 'rgba(150, 255, 190, 0.9)'
    c.font = 'bold 20px "Courier New", monospace'
    c.fillText('CODE', 24, y)
    c.fillStyle = 'rgba(150, 255, 190, 0.85)'
    c.font = '14px "Courier New", monospace'
    wrapText(ext.externalCode || '(empty)', 24, y + 30, canvas.width - 48, 19, 10)

    this._infoPlane.texture.needsUpdate = true
  }

  /** Same squash-swap-restore approximation as OmniDraw's Domain
   *  Expansion — see that file's comment for why it's not true
   *  vertex-interpolated morphing. */
  _createMorph () {
    if (!this._createPreview) return
    const mesh = this._createPreview.mesh
    const toSphere = this._createPreview.geoType !== 'SphereGeometry'
    const nextType = toSphere ? 'SphereGeometry' : 'BoxGeometry'

    gsap.timeline()
      .to(mesh.scale, { x: 0.01, y: 0.01, z: 1.4, duration: 0.22, ease: 'power2.in' })
      .call(() => {
        mesh.geometry.dispose()
        mesh.geometry = toSphere
          ? new THREE.SphereGeometry(0.62, 32, 32)
          : new THREE.BoxGeometry(1, 1, 1)
        this._createPreview.geoType = nextType
      })
      .to(mesh.scale, { x: 1, y: 1, z: 1, duration: 0.35, ease: 'elastic.out(1, 0.55)' })
  }

  /**
   * Export to Scene — identical event contract to OmniDraw's button
   * (omni:node-create-request), so it automatically respects whatever
   * space is currently entered (OmniNode handles the parenting) without
   * this code needing to know anything about spaces itself. If "mark +
   * enter as new space on export" is checked, also flags the new node as
   * a domain and immediately enters it.
   */
  _createExport (btn) {
    if (!this._createPreview) return
    const mesh = this._createPreview.mesh
    const t    = this._createTransform
    const cam  = this.ctx.camera
    const dir  = new THREE.Vector3()
    cam.getWorldDirection(dir)
    dir.multiplyScalar(6)

    const id = generateId()
    const asSpace = this._el?.querySelector('#oi-create-as-space')?.classList.contains('is-on')

    window.dispatchEvent(new CustomEvent('omni:node-create-request', {
      detail: {
        id,
        label    : 'Container_' + Date.now().toString(36).slice(-4),
        geometry : this._createPreview.geoType,
        primitive: 'objective',
        color    : '#' + (mesh.material.color?.getHexString?.() ?? 'ffffff'),
        position : [
          cam.position.x + dir.x + t.px / 20,
          Math.max(0.5, cam.position.y + dir.y + t.py / 20),
          cam.position.z + dir.z + t.pz / 20,
        ],
        rotation : [t.rx, t.ry, t.rz],
        scale    : [t.sx, t.sy, t.sz],
        parentId : null,
      }
    }))

    if (asSpace) {
      window.dispatchEvent(new CustomEvent('omni:node-set-domain', { detail: { id, isDomain: true } }))
      // Give OmniNode a tick to register the node before entering it.
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('omni:enter-space-request', { detail: { id } }))
      }, 50)
    }

    if (!btn) return
    const original = btn.textContent
    btn.textContent = '⟐ Exported ✓'
    gsap.fromTo(btn, { scale: 1.08 }, { scale: 1, duration: 0.3, ease: 'back.out(2)' })
    setTimeout(() => { btn.textContent = original }, 900)
  }

  // ── Color sync — pushes this._color state to all UI elements ─────────────

  _syncColorUI (body) {
    const { r, g, b, a } = this._color
    const hex = rgbToHex(r, g, b)
    const apc = Math.round(a * 100)
    const swatchBg = `rgba(${r},${g},${b},${a})`

    const q = (id) => body.querySelector(id)

    const swatchFill = q('#oi-swatch-fill')
    if (swatchFill) swatchFill.style.background = swatchBg

    const nativeColor = q('#oi-native-color')
    if (nativeColor) nativeColor.value = hex

    const hexInput = q('#oi-hex-input')
    if (hexInput && document.activeElement !== hexInput) hexInput.value = hex

    const alphaReadout = q('#oi-alpha-readout')
    if (alphaReadout) alphaReadout.textContent = apc + '%'

    const rSlider = q('#oi-r')
    const gSlider = q('#oi-g')
    const bSlider = q('#oi-b')
    const aSlider = q('#oi-a')
    if (rSlider) rSlider.value = r
    if (gSlider) gSlider.value = g
    if (bSlider) bSlider.value = b
    if (aSlider) aSlider.value = apc

    const rVal = q('#oi-r-val')
    const gVal = q('#oi-g-val')
    const bVal = q('#oi-b-val')
    const aVal = q('#oi-a-val')
    if (rVal) rVal.textContent = r
    if (gVal) gVal.textContent = g
    if (bVal) bVal.textContent = b
    if (aVal) aVal.textContent = apc + '%'
  }

  // ── Apply color to Three.js mesh material ─────────────────────────────────

  _applyColorToMesh () {
    const mat = this._currentMesh?.material
    if (!mat) return
    const { r, g, b, a } = this._color

    // Skip colorless materials (Normal, Depth)
    if (!COLORLESS_MATS.has(this._ext?.material)) {
      if (mat.color) mat.color.setRGB(r / 255, g / 255, b / 255)
    }

    mat.opacity     = a
    mat.transparent = a < 1
    mat.needsUpdate = true
  }

  _dispatchColor () {
    if (!this._currentId) return
    window.dispatchEvent(new CustomEvent('omni:node-color-set', {
      detail: { id: this._currentId, color: rgbToHex(this._color.r, this._color.g, this._color.b) }
    }))
  }

  // ── Apply material type swap ──────────────────────────────────────────────

  _applyMaterial (typeName) {
    const mesh = this._currentMesh
    if (!mesh) return

    const MatClass = MATERIALS[typeName]
    if (!MatClass) return

    const { r, g, b, a } = this._color
    const oldMat = mesh.material

    const newProps = {
      opacity     : a,
      transparent : a < 1,
    }

    // Only add color if the material type supports it
    if (!COLORLESS_MATS.has(typeName)) {
      newProps.color = new THREE.Color(r / 255, g / 255, b / 255)
    }

    // Copy PBR props from old material if applicable
    if (PBR_MATS.has(typeName) && 'roughness' in oldMat) {
      newProps.roughness = oldMat.roughness
      newProps.metalness = oldMat.metalness
    }

    // Copy wireframe setting
    if ('wireframe' in oldMat && this._ext?.wireframe) {
      newProps.wireframe = this._ext.wireframe
    }

    const newMat = new MatClass(newProps)

    // Transfer texture map if present
    if (oldMat.map && !COLORLESS_MATS.has(typeName)) newMat.map = oldMat.map

    oldMat.dispose()
    mesh.material = newMat

    window.dispatchEvent(new CustomEvent('omni:node-material-set', {
      detail: { id: this._currentId, material: typeName }
    }))
  }

  // ── Texture helpers ───────────────────────────────────────────────────────

  _loadTextureFile (file, body, ext) {
    if (!file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = (e) => {
      const dataUrl = e.target.result
      this._applyTextureUrl(dataUrl, body, ext)
    }
    reader.readAsDataURL(file)
  }

  _applyTextureUrl (url, body, ext) {
    texLoader.load(
      url,
      (texture) => {
        const mat = this._currentMesh?.material
        if (mat && !COLORLESS_MATS.has(this._ext?.material)) {
          mat.map = texture
          mat.needsUpdate = true
        }

        ext.texture = url
        this._saveExt()

        // Show preview and clear button
        const preview = body.querySelector('#oi-tex-preview')
        const clear   = body.querySelector('#oi-tex-clear')
        if (preview) { preview.src = url; preview.classList.add('is-visible') }
        if (clear)   { clear.classList.add('is-visible') }

        // Update drop zone text
        const drop = body.querySelector('#oi-tex-drop')
        if (drop) drop.innerHTML = `<span class="oi-drop-zone-icon">✓</span>Texture applied`
      },
      undefined,
      () => {
        const drop = body.querySelector('#oi-tex-drop')
        if (drop) drop.innerHTML = `<span class="oi-drop-zone-icon">✗</span>Load failed — check URL`
      }
    )
  }

  _clearTexture (body, ext) {
    const mat = this._currentMesh?.material
    if (mat) {
      mat.map?.dispose()
      mat.map = null
      mat.needsUpdate = true
    }

    ext.texture = null
    this._saveExt()

    const preview = body.querySelector('#oi-tex-preview')
    const clear   = body.querySelector('#oi-tex-clear')
    const urlInp  = body.querySelector('#oi-tex-url')
    if (preview) { preview.src = ''; preview.classList.remove('is-visible') }
    if (clear)   { clear.classList.remove('is-visible') }
    if (urlInp)  { urlInp.value = '' }

    const drop = body.querySelector('#oi-tex-drop')
    if (drop) drop.innerHTML = `<span class="oi-drop-zone-icon">🖼</span>Drop image file or enter URL`
  }

  // ── Media helpers ─────────────────────────────────────────────────────────

  _addMediaFile (key, file, body, ext) {
    const reader = new FileReader()
    reader.onload = (e) => {
      const item = { src: e.target.result, label: file.name, type: file.type }
      this._addMediaItem(key, item, body, ext)
    }
    reader.readAsDataURL(file)
  }

  _addMediaItem (key, item, body, ext) {
    if (!ext[key]) ext[key] = []
    ext[key].push(item)
    this._saveExt()
    this._refreshMediaList(key, body, ext)

    window.dispatchEvent(new CustomEvent('omni:node-media-set', {
      detail: { id: this._currentId, type: key, url: item.src, label: item.label }
    }))
  }

  _refreshMediaList (key, body, ext) {
    const list = body.querySelector(`#oi-items-${key}`)
    if (!list) return
    const items = ext[key] ?? []
    list.innerHTML = items.map((item, idx) => /* html */`
      <div class="oi-slot-item">
        <span class="oi-slot-item-name" title="${item.src}">${item.label || item.src}</span>
        <button class="oi-slot-item-rm"
                data-media-key="${key}"
                data-media-idx="${idx}">✕</button>
      </div>
    `).join('')
  }

  // ── Extended data — per-node inspector state ──────────────────────────────

  /**
   * Default extended data structure for a new node.
   * @param {object} data  — raw node data from OmniNode
   */
  _defaultExt (data) {
    return {
      text      : '',
      wireframe : false,
      material  : 'MeshStandardMaterial',
      scale     : { x: 1, y: 1, z: 1 },
      texture   : null,
      images    : [],
      sound     : [],
      media     : [],
      internalDisplay : '',
      internalCode    : '',
      externalDisplay : '',
      externalCode    : '',
      showOnPlane     : false,
    }
  }

  _saveExt () {
    if (!this._currentId || !this._ext) return
    try {
      // Don't save full base64 data URIs — too large for localStorage.
      // Store a flag for file-based textures/media; URL-based ones store as-is.
      const safe = {
        ...this._ext,
        texture : this._ext.texture?.startsWith('data:') ? null : this._ext.texture,
        images  : (this._ext.images ?? []).filter(i => !i.src?.startsWith('data:')),
        sound   : (this._ext.sound  ?? []).filter(i => !i.src?.startsWith('data:')),
        media   : (this._ext.media  ?? []).filter(i => !i.src?.startsWith('data:')),
      }
      localStorage.setItem(STORE_PREFIX + this._currentId, JSON.stringify(safe))
    } catch (err) {
      console.warn('⟐i — localStorage save failed:', err)
    }
  }

  _loadExt (id) {
    try {
      const raw = localStorage.getItem(STORE_PREFIX + id)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  }

  // ── Badge update ──────────────────────────────────────────────────────────

  _updateBadge () {
    const data = this._currentData
    if (!data) return

    const prim = PRIMITIVES.find(p => p.key === data.primitive) ?? PRIMITIVES[0]
    const dot  = this._el.querySelector('#oi-badge-dot')
    const lbl  = this._el.querySelector('#oi-badge-label')
    const geo  = this._el.querySelector('#oi-badge-geo')

    if (dot) { dot.style.background = prim.color; dot.style.borderColor = prim.color + '50' }
    if (lbl) lbl.textContent = data.label ?? data.id
    if (geo) geo.textContent = (data.geometry ?? '').replace('Geometry', '')
  }

  // ── Footer ────────────────────────────────────────────────────────────────

  _updateFooter () {
    const idEl  = this._el.querySelector('#oi-footer-id')
    const badge = this._el.querySelector('#oi-footer-badge')
    if (idEl)  idEl.textContent  = this._currentId ? this._currentId.slice(0, 18) + '…' : '—'
    if (badge) badge.textContent = this._currentId ? '⟐i  loaded' : '⟐i'
  }

  // ── Panel controls ────────────────────────────────────────────────────────

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

    window.dispatchEvent(new CustomEvent('omni:panel-minimized', {
      detail: {
        id        : 'omniinspector',
        label     : '⟐i',
        iconLabel : '⟐i',
        fromRect  : { x: rect.left, y: rect.top, w: rect.width, h: rect.height },
      }
    }))
    window.dispatchEvent(new CustomEvent('omni:panel-restore-handler', {
      detail: { id: 'omniinspector', handler: () => this.open() }
    }))
  }

  _attach () {
    window.dispatchEvent(new CustomEvent('omni:panel-attached', {
      detail: { id: 'omniinspector' }
    }))
    // Phase 5: camera.attach(this._el) for XR follow-mode
  }

  // ── Event listeners ───────────────────────────────────────────────────────

  _bindEvents () {
    // Toggle open/close
    this._onToggle = (e) => {
      if (e.detail?.system !== 'omniinspector') return
      this.toggle()
    }

    // Node selected → load into inspector, auto-open
    this._onSelected = (e) => {
      const { node, mesh } = e.detail ?? {}
      if (node && mesh) this.loadNode(node, mesh)
    }

    // Node deselected → show empty state
    this._onDeselect = () => {
      this.clearNode()
    }

    // Node created → same as selected (auto-open inspector for new nodes)
    this._onCreated = (e) => {
      const { node, mesh } = e.detail ?? {}
      if (node && mesh) this.loadNode(node, mesh)
    }

    // Node deleted → clear if this was the loaded node
    this._onDeleted = (e) => {
      if (e.detail?.id === this._currentId) this.clearNode()
    }

    // Full node array — cached for the parent picker, and used to keep
    // the Root/Parent/Depth display live if this node's place in the
    // hierarchy changes from elsewhere (e.g. another node re-parented
    // under it, shifting its own depth).
    this._onNodesUpdated = (e) => {
      this._allNodes = e.detail?.nodes ?? []
      if (!this._currentId || !this._isOpen) return
      const updated = this._allNodes.find(n => n.id === this._currentId)
      if (!updated) return
      this._currentData = updated
      const body = this._el?.querySelector('#oi-body')
      const section = body?.querySelector('#oisec-hierarchy .oi-section-inner')
      if (section) section.innerHTML = this._hierarchyHTML(updated)
      if (section) this._wireHierarchy(body, updated)
    }

    // Space entered/exited — refresh the Domain section's Enter/Exit
    // button state if it affects the currently loaded node.
    this._onSpaceEntered = (e) => {
      this._currentSpaceId = e.detail?.id ?? null
      this._refreshDomainSection()
    }
    this._onSpaceExited = () => {
      this._currentSpaceId = null
      this._refreshDomainSection()
    }

    window.addEventListener('omni:system-toggle', this._onToggle)
    window.addEventListener('omni:node-selected', this._onSelected)
    window.addEventListener('omni:node-deselected', this._onDeselect)
    window.addEventListener('omni:node-created',  this._onCreated)
    window.addEventListener('omni:node-deleted',  this._onDeleted)
    window.addEventListener('omni:nodes-updated', this._onNodesUpdated)
    window.addEventListener('omni:space-entered', this._onSpaceEntered)
    window.addEventListener('omni:space-exited', this._onSpaceExited)
  }

  // ── Sound ─────────────────────────────────────────────────────────────────

  _playSound (id) {
    try {
      const Sound = this.ctx?.Sound
      if (Sound && typeof Sound.play === 'function') Sound.play(id)
    } catch (_) {}
  }
}
