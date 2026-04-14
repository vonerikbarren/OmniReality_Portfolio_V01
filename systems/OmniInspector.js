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
  --oi-bg           : rgba(6, 6, 10, 0.93);
  --oi-border       : rgba(255, 255, 255, 0.09);
  --oi-sep          : rgba(255, 255, 255, 0.05);
  --oi-header-bg    : rgba(255, 255, 255, 0.03);
  --oi-text         : rgba(255, 255, 255, 0.82);
  --oi-text-dim     : rgba(255, 255, 255, 0.38);
  --oi-text-muted   : rgba(255, 255, 255, 0.18);
  --oi-accent       : rgba(255, 255, 255, 0.96);
  --oi-ctrl-hover   : rgba(255, 255, 255, 0.08);
  --oi-ctrl-active  : rgba(255, 255, 255, 0.16);
  --oi-input-bg     : rgba(255, 255, 255, 0.04);
  --oi-input-border : rgba(255, 255, 255, 0.10);
  --oi-focus-border : rgba(255, 255, 255, 0.30);
  --oi-r-color      : rgba(255, 100, 100, 0.85);
  --oi-g-color      : rgba(100, 220, 130, 0.85);
  --oi-b-color      : rgba(100, 150, 255, 0.85);
  --oi-a-color      : rgba(255, 255, 255, 0.50);
  --mono            : 'Courier New', Courier, monospace;

  position          : fixed;
  top               : ${BAR_H}px;
  right             : 0;
  width             : ${PANEL_W}px;
  height            : calc(100vh - ${BAR_H}px - ${DOCK_H}px);
  max-height        : 560px;

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
  font-size         : 10px;
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
  font-size         : 8px;
  color             : var(--oi-text-muted);
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
  font-size         : 9px;
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
    }

    // ── Bound event handlers for cleanup ────────────────────────────────
    this._onToggle    = null
    this._onSelected  = null
    this._onDeselect  = null
    this._onCreated   = null
    this._onDeleted   = null
  }

  // ── Module contract ──────────────────────────────────────────────────────

  init () {
    injectStyles()
    this._buildPanel()
    this._bindEvents()
    this._showEmpty()
  }

  update (_delta) {}   // inspector is event-driven

  destroy () {
    this._el?.parentNode?.removeChild(this._el)
    window.removeEventListener('omni:system-toggle', this._onToggle)
    window.removeEventListener('omni:node-selected', this._onSelected)
    window.removeEventListener('omni:node-deselected', this._onDeselect)
    window.removeEventListener('omni:node-created',  this._onCreated)
    window.removeEventListener('omni:node-deleted',  this._onDeleted)
  }

  // ── Public API ───────────────────────────────────────────────────────────

  open () {
    if (this._isOpen) return
    this._isOpen = true
    this._el.style.visibility = 'visible'
    gsap.fromTo(this._el,
      { x: '100%', opacity: 1 },
      {
        x        : '0%',
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
    this._ext = this._loadExt(data.id) ?? this._defaultExt(data)

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

    if (!this._isOpen) this.open()
  }

  /** Clear the inspector back to its empty state. */
  clearNode () {
    this._currentId   = null
    this._currentMesh = null
    this._currentData = null
    this._ext         = null
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
        </div>
        <span class="oi-title">OmniInspector ⟐i</span>
      </div>

      <!-- Node identity badge — visible when node is loaded -->
      <div class="oi-node-badge" id="oi-node-badge">
        <span class="oi-badge-dot" id="oi-badge-dot"></span>
        <span class="oi-badge-label" id="oi-badge-label">—</span>
        <span class="oi-badge-geo"  id="oi-badge-geo">—</span>
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
        case 'close':    this.close();     break
        case 'minimize': this._minimize(); break
        case 'attach':   this._attach();   break
      }
    })
  }

  // ── Empty state ───────────────────────────────────────────────────────────

  _showEmpty () {
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

    // Build four accordion sections
    body.innerHTML = /* html */`
      ${this._sectionHTML('identity',   '▶ Identity',   this._identityHTML(data, ext))}
      ${this._sectionHTML('hierarchy',  '▶ Hierarchy',  this._hierarchyHTML(data))}
      ${this._sectionHTML('appearance', '▶ Appearance', this._appearanceHTML(data, ext))}
      ${this._sectionHTML('media',      '▶ Media',      this._mediaHTML(ext))}
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
    this._wireAppearance(body, data, ext)
    this._wireMedia(body, ext)
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

  // ── HIERARCHY section HTML ────────────────────────────────────────────────

  _hierarchyHTML (data) {
    const parentId = data.parentId ?? '—'
    const rootId   = data.rootId   ?? '—'
    const depth    = data.depth    ?? '—'
    return /* html */`
      <div class="oi-row">
        <span class="oi-label">Parent</span>
        <input class="oi-input" value="${parentId}" readonly tabindex="-1"
               title="Set via PATH mode in ⟐N">
      </div>
      <div class="oi-row">
        <span class="oi-label">Root</span>
        <input class="oi-input" value="${rootId}" readonly tabindex="-1">
      </div>
      <div class="oi-row">
        <span class="oi-label">Depth</span>
        <input class="oi-input oi-input--sm" value="${depth}" readonly tabindex="-1">
      </div>
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

    window.addEventListener('omni:system-toggle', this._onToggle)
    window.addEventListener('omni:node-selected', this._onSelected)
    window.addEventListener('omni:node-deselected', this._onDeselect)
    window.addEventListener('omni:node-created',  this._onCreated)
    window.addEventListener('omni:node-deleted',  this._onDeleted)
  }

  // ── Sound ─────────────────────────────────────────────────────────────────

  _playSound (id) {
    try {
      const Sound = this.ctx?.Sound
      if (Sound && typeof Sound.play === 'function') Sound.play(id)
    } catch (_) {}
  }
}
