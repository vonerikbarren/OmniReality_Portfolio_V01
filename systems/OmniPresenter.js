/**
 * systems/OmniPresenter.js — ⟐p OmniPresenter
 *
 * The presentation and traversal system of the ⟐mniReality. Builds an
 * ordered sequence of nodes, then walks them linearly or jumps freely —
 * like a spatial PowerPoint that moves the camera through the logic tree.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Panel
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   Anchored bottom-right, above the Dock. Slides in from the right.
 *   Same slot and geometry as the Phase 3a ⟐RH panel
 *   (bottom: DOCK_H, right: 0, width: PANEL_W, height: PANEL_H).
 *
 *   Opens via:
 *     window.dispatchEvent(new CustomEvent('omni:system-toggle', {
 *       detail: { system: 'omnipresenter' }
 *     }))
 *   Or directly: omniPresenter.open() / close() / toggle()
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Two sequence sources
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   PATH SEQUENCE  (automatic, from ⟐N PATH mode)
 *     Loaded automatically when omni:path-step fires.
 *     Edges are ordered as built: edges[0].from is always the origin.
 *     The traversal order is the order in which edges were drawn.
 *
 *   MANUAL SEQUENCE  (built inside the presenter panel)
 *     Add nodes by clicking in the scene (ADD mode) or entering an ID.
 *     Nodes appear in a reorderable list — drag rows to reorder.
 *     A manual sequence overrides the path sequence until cleared.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Three presenter modes
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   IDLE      No presentation active. Sequence list editable.
 *   PLAYING   Linear traversal — Prev / Next / keyboard arrows step through.
 *             Camera flies to each node in sequence.
 *   PAUSED    Mid-sequence pause. Position held. Resume resumes from here.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Camera fly-to
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   On each step, the camera animates to a viewing position offset from the
 *   target node: slightly behind and above it, looking at it.
 *
 *   Orbit controls are suspended during the tween via omni:orbit-disable /
 *   omni:orbit-enable events (consumed by OrbitModule in main.js).
 *
 *   Fly-to is a two-phase GSAP tween:
 *     1. Camera position eases to target offset (power2.inOut, 1.2s default)
 *     2. lookAt() applied each frame via onUpdate callback
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Panel layout (PANEL_H = 380px, PANEL_W = 340px)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   ┌─────────────────────────────────────────┐  ← top of panel
 *   │  [✕] [_] [⟐]          ⟐p OmniPresenter │  38px header
 *   ├─────────────────────────────────────────┤
 *   │  Sequence  (n nodes)     [+ Add] [Clear] │  34px toolbar
 *   ├─────────────────────────────────────────┤
 *   │  ① Node A label         Sphere  [✕]     │
 *   │  ② Node B label         Box     [✕]     │  ~140px list
 *   │  ③ Node C label         Torus   [✕]     │  (scrollable)
 *   │  …                                      │
 *   ├─────────────────────────────────────────┤
 *   │  ID input  ────────────── [Add by ID]   │  30px id row
 *   ├─────────────────────────────────────────┤
 *   │  ┌──────────────────────────────────┐   │
 *   │  │  ◀◀  ◀  ▶/⏸  ▶  ▶▶            │   │  56px transport
 *   │  │  [⏮ First]  [⏭ Last]           │   │
 *   │  └──────────────────────────────────┘   │
 *   ├─────────────────────────────────────────┤
 *   │  ① / ③  Node A label                   │  40px current node
 *   ├─────────────────────────────────────────┤
 *   │  Fly speed  [●──────────] 1.2s          │  26px speed row
 *   ├─────────────────────────────────────────┤
 *   │  ⟐p  idle               ③ Node C       │  26px footer
 *   └─────────────────────────────────────────┘
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Events dispatched (window)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   omni:presenter-step    { index, total, node }  — step completed
 *   omni:presenter-jump    { id, node }            — free jump completed
 *   omni:presenter-active  { active: bool }        — play/pause/stop
 *   omni:orbit-disable     {}                      — freeze orbit controls
 *   omni:orbit-enable      {}                      — restore orbit controls
 *
 * Events consumed (window)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   omni:system-toggle    { system: 'omnipresenter' }
 *   omni:nodes-updated    { nodes, edges }   — sync sequence from storage
 *   omni:path-step        { from, to, edges } — load path sequence from ⟐N
 *   omni:node-selected    { node, mesh }     — ADD mode: append to sequence
 *   omni:node-deleted     { id }             — remove from sequence if present
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Keyboard shortcuts (active when panel is open)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   ArrowRight / ArrowDown  →  Next
 *   ArrowLeft  / ArrowUp    →  Prev
 *   Space                   →  Play / Pause
 *   Escape                  →  Stop (return to IDLE)
 *   Home                    →  Jump to first
 *   End                     →  Jump to last
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Persistence — localStorage: 'omni:presenter'
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   { sequence: ['id1','id2',…], source: 'path'|'manual', flySpeed: 1.2 }
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Usage in main.js
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   import OmniPresenter from './systems/OmniPresenter.js'
 *   const omniPresenter = new OmniPresenter(base.context)
 *   omniPresenter.init()
 *   omniPresenter.update(delta)  // call from render loop
 *
 * Follows the standard module contract (constructor / init / update / destroy).
 */

import * as THREE from 'three'
import gsap       from 'gsap'

// ── Layout constants ──────────────────────────────────────────────────────────

const DOCK_H    = 52    // px — Dock height (bottom anchor)
const PANEL_W   = 340   // px — panel width  (matches Phase 3a ⟐RH)
const PANEL_H   = 380   // px — panel height (matches Phase 3a ⟐RH)
const SLIDE_DUR = 0.30  // s  — slide animation
const GLITCH_DUR = 0.20 // s  — glitch total duration

// ── Camera fly-to ─────────────────────────────────────────────────────────────

const FLY_SPEED_DEFAULT = 1.2   // s  — default fly duration
const FLY_SPEED_MIN     = 0.2   // s
const FLY_SPEED_MAX     = 4.0   // s
const FLY_OFFSET_BACK   = 4.0   // world units — camera behind node
const FLY_OFFSET_UP     = 2.0   // world units — camera above node
const FLY_EASE          = 'power2.inOut'

// ── Presenter states ──────────────────────────────────────────────────────────

const STATE = { IDLE: 'idle', PLAYING: 'playing', PAUSED: 'paused' }

// ── Storage key ───────────────────────────────────────────────────────────────

const STORE_KEY = 'omni:presenter'

// ── Primitive dot colours (mirrors OmniNode) ──────────────────────────────────

const PRIM_COLORS = {
  objective  : '#ffffff',
  subjective : '#88aaff',
  undefined  : '#888888',
  false      : '#333333',
}

// ── Stylesheet ────────────────────────────────────────────────────────────────

const STYLES = /* css */`

/* ── Presenter panel root ─────────────────────────────────────────────────── */

.op-panel {
  --op-bg           : rgba(6, 6, 10, 0.93);
  --op-border       : rgba(255, 255, 255, 0.09);
  --op-sep          : rgba(255, 255, 255, 0.05);
  --op-header-bg    : rgba(255, 255, 255, 0.03);
  --op-text         : rgba(255, 255, 255, 0.82);
  --op-text-dim     : rgba(255, 255, 255, 0.38);
  --op-text-muted   : rgba(255, 255, 255, 0.18);
  --op-accent       : rgba(255, 255, 255, 0.96);
  --op-ctrl-hover   : rgba(255, 255, 255, 0.08);
  --op-ctrl-active  : rgba(255, 255, 255, 0.16);
  --op-input-bg     : rgba(255, 255, 255, 0.04);
  --op-input-border : rgba(255, 255, 255, 0.10);
  --op-focus-border : rgba(255, 255, 255, 0.30);
  --op-playing-glow : rgba(255, 220, 100, 0.18);
  --op-playing-border: rgba(255, 220, 100, 0.30);
  --mono            : 'Courier New', Courier, monospace;

  position          : fixed;
  bottom            : ${DOCK_H}px;
  right             : 0;
  width             : ${PANEL_W}px;
  height            : ${PANEL_H}px;

  display           : flex;
  flex-direction    : column;

  background        : var(--op-bg);
  backdrop-filter   : blur(24px) saturate(1.6);
  -webkit-backdrop-filter: blur(24px) saturate(1.6);
  border-top        : 1px solid var(--op-border);
  border-left       : 1px solid var(--op-border);
  border-bottom     : none;
  border-right      : none;
  border-radius     : 10px 0 0 0;

  font-family       : var(--mono);
  color             : var(--op-text);
  font-size         : 10px;
  z-index           : 46;
  pointer-events    : auto;
  user-select       : none;
  overflow          : hidden;
  -webkit-font-smoothing: antialiased;

  visibility        : hidden;
}

/* Playing state — warm amber glow on left+top border */
.op-panel.is-playing {
  border-top-color  : var(--op-playing-border);
  border-left-color : var(--op-playing-border);
  box-shadow        : -2px -2px 18px rgba(255,200,60,0.06);
}

/* ── Header ───────────────────────────────────────────────────────────────── */

.op-header {
  flex-shrink       : 0;
  display           : flex;
  align-items       : center;
  padding           : 0 14px 0 10px;
  height            : 38px;
  background        : var(--op-header-bg);
  border-bottom     : 1px solid var(--op-sep);
  gap               : 8px;
}

.op-controls {
  display           : flex;
  align-items       : center;
  gap               : 3px;
  flex-shrink       : 0;
}

.op-ctrl {
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
  color             : var(--op-text-dim);
  cursor            : pointer;
  transition        : background 0.12s, color 0.12s, border-color 0.12s;
}
.op-ctrl:hover   { background: var(--op-ctrl-hover); color: var(--op-accent); border-color: rgba(255,255,255,0.18); }
.op-ctrl:active  { background: var(--op-ctrl-active); }
.op-ctrl--close:hover {
  background    : rgba(255, 80, 80, 0.14);
  border-color  : rgba(255, 80, 80, 0.28);
  color         : rgba(255, 150, 150, 0.90);
}

.op-title {
  flex              : 1 1 auto;
  font-size         : 10px;
  color             : var(--op-accent);
  letter-spacing    : 0.12em;
  text-transform    : uppercase;
  text-align        : right;
}

/* ── Toolbar — sequence label + action buttons ────────────────────────────── */

.op-toolbar {
  flex-shrink       : 0;
  display           : flex;
  align-items       : center;
  gap               : 6px;
  padding           : 0 12px;
  height            : 34px;
  border-bottom     : 1px solid var(--op-sep);
}

.op-seq-label {
  flex              : 1 1 auto;
  font-size         : 8px;
  color             : var(--op-text-muted);
  text-transform    : uppercase;
  letter-spacing    : 0.14em;
}

.op-source-badge {
  font-size         : 7px;
  color             : var(--op-text-muted);
  padding           : 2px 5px;
  border            : 1px solid rgba(255,255,255,0.07);
  border-radius     : 3px;
  letter-spacing    : 0.08em;
  flex-shrink       : 0;
}
.op-source-badge.is-path   { color: rgba(255,180,60,0.70);  border-color: rgba(255,180,60,0.20); }
.op-source-badge.is-manual { color: rgba(100,180,255,0.70); border-color: rgba(100,180,255,0.20); }

.op-btn {
  flex-shrink       : 0;
  height            : 22px;
  padding           : 0 8px;
  display           : flex;
  align-items       : center;
  gap               : 4px;
  background        : rgba(255,255,255,0.04);
  border            : 1px solid rgba(255,255,255,0.09);
  border-radius     : 4px;
  font-family       : var(--mono);
  font-size         : 8px;
  color             : var(--op-text-dim);
  cursor            : pointer;
  letter-spacing    : 0.08em;
  transition        : background 0.10s, color 0.10s, border-color 0.10s;
  white-space       : nowrap;
}
.op-btn:hover { background: rgba(255,255,255,0.08); color: var(--op-accent); border-color: rgba(255,255,255,0.20); }
.op-btn:active { background: rgba(255,255,255,0.14); }

.op-btn--add.is-active {
  background        : rgba(80, 255, 160, 0.10);
  border-color      : rgba(80, 255, 160, 0.25);
  color             : rgba(80, 255, 160, 0.85);
}

.op-btn--clear:hover {
  background        : rgba(255, 80, 80, 0.10);
  border-color      : rgba(255, 80, 80, 0.22);
  color             : rgba(255, 150, 150, 0.80);
}

/* ── Sequence list ────────────────────────────────────────────────────────── */

.op-seq-list {
  flex              : 1 1 auto;
  overflow-y        : auto;
  overflow-x        : hidden;
  min-height        : 0;

  scrollbar-width   : thin;
  scrollbar-color   : rgba(255,255,255,0.06) transparent;
}
.op-seq-list::-webkit-scrollbar       { width: 3px; }
.op-seq-list::-webkit-scrollbar-track { background: transparent; }
.op-seq-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.06); border-radius: 2px; }

/* Empty state inside list */
.op-list-empty {
  display           : flex;
  flex-direction    : column;
  align-items       : center;
  justify-content   : center;
  gap               : 7px;
  padding           : 22px 16px;
  color             : var(--op-text-muted);
  font-size         : 9px;
  letter-spacing    : 0.10em;
  text-align        : center;
}
.op-list-empty-glyph { font-size: 18px; opacity: 0.18; display: block; }

/* Sequence row */
.op-seq-row {
  display           : flex;
  align-items       : center;
  gap               : 7px;
  padding           : 5px 12px 5px 10px;
  border-bottom     : 1px solid var(--op-sep);
  cursor            : pointer;
  transition        : background 0.10s;
}
.op-seq-row:hover { background: rgba(255,255,255,0.03); }

/* Current / active row */
.op-seq-row.is-current {
  background        : rgba(255, 220, 100, 0.08);
  border-left       : 2px solid rgba(255, 220, 100, 0.50);
  padding-left      : 8px;
}

/* Drag-in-progress */
.op-seq-row.is-dragging {
  opacity           : 0.40;
}
.op-seq-row.drag-target {
  border-top        : 1px solid rgba(255,220,100,0.45);
}

.op-seq-index {
  font-size         : 8px;
  color             : var(--op-text-muted);
  flex-shrink       : 0;
  width             : 18px;
  text-align        : right;
  letter-spacing    : 0.04em;
}

.op-seq-dot {
  width             : 6px;
  height            : 6px;
  border-radius     : 50%;
  flex-shrink       : 0;
  border            : 1px solid rgba(255,255,255,0.15);
}

.op-seq-info {
  flex              : 1 1 auto;
  min-width         : 0;
}

.op-seq-name {
  font-size         : 9px;
  color             : var(--op-text);
  white-space       : nowrap;
  overflow          : hidden;
  text-overflow     : ellipsis;
  letter-spacing    : 0.04em;
}

.op-seq-geo {
  font-size         : 7px;
  color             : var(--op-text-muted);
  letter-spacing    : 0.06em;
}

/* Jump button (shows on hover) */
.op-seq-jump {
  flex-shrink       : 0;
  font-size         : 9px;
  color             : rgba(255,220,100,0.40);
  opacity           : 0;
  transition        : opacity 0.10s;
  cursor            : pointer;
  padding           : 2px 4px;
}
.op-seq-row:hover .op-seq-jump { opacity: 1; }
.op-seq-row.is-current .op-seq-jump { opacity: 0.6; }

.op-seq-rm {
  flex-shrink       : 0;
  width             : 18px;
  height            : 18px;
  display           : flex;
  align-items       : center;
  justify-content   : center;
  background        : none;
  border            : none;
  font-size         : 10px;
  color             : rgba(255,255,255,0.15);
  cursor            : pointer;
  border-radius     : 3px;
  transition        : background 0.10s, color 0.10s;
}
.op-seq-rm:hover { background: rgba(255,80,80,0.12); color: rgba(255,150,150,0.70); }

/* ── ID input row ─────────────────────────────────────────────────────────── */

.op-id-row {
  flex-shrink       : 0;
  display           : flex;
  gap               : 5px;
  padding           : 5px 12px;
  border-top        : 1px solid var(--op-sep);
}

.op-id-input {
  flex              : 1 1 auto;
  height            : 24px;
  padding           : 0 7px;
  background        : var(--op-input-bg);
  border            : 1px solid var(--op-input-border);
  border-radius     : 4px;
  font-family       : var(--mono);
  font-size         : 8px;
  color             : var(--op-text);
  outline           : none;
  transition        : border-color 0.12s;
  letter-spacing    : 0.04em;
  min-width         : 0;
}
.op-id-input:focus { border-color: var(--op-focus-border); }
.op-id-input::placeholder { color: var(--op-text-muted); }

.op-id-add {
  flex-shrink       : 0;
  height            : 24px;
  padding           : 0 8px;
  background        : rgba(255,255,255,0.05);
  border            : 1px solid rgba(255,255,255,0.10);
  border-radius     : 4px;
  font-family       : var(--mono);
  font-size         : 8px;
  color             : var(--op-text-dim);
  cursor            : pointer;
  letter-spacing    : 0.08em;
  white-space       : nowrap;
  transition        : background 0.10s, color 0.10s;
}
.op-id-add:hover { background: rgba(255,255,255,0.09); color: var(--op-accent); }

/* ── Transport bar ────────────────────────────────────────────────────────── */

.op-transport {
  flex-shrink       : 0;
  display           : flex;
  flex-direction    : column;
  gap               : 4px;
  padding           : 8px 12px;
  border-top        : 1px solid var(--op-sep);
  background        : rgba(255,255,255,0.01);
}

/* Main transport row — centre-justify buttons */
.op-transport-main {
  display           : flex;
  align-items       : center;
  justify-content   : center;
  gap               : 6px;
}

.op-t-btn {
  display           : flex;
  align-items       : center;
  justify-content   : center;
  background        : rgba(255,255,255,0.04);
  border            : 1px solid rgba(255,255,255,0.09);
  border-radius     : 5px;
  font-family       : var(--mono);
  font-size         : 12px;
  color             : var(--op-text-dim);
  cursor            : pointer;
  transition        : background 0.10s, color 0.10s, border-color 0.10s, transform 0.08s;
}
.op-t-btn:hover  { background: rgba(255,255,255,0.09); color: var(--op-accent); border-color: rgba(255,255,255,0.20); }
.op-t-btn:active { transform: scale(0.92); background: rgba(255,255,255,0.14); }

.op-t-btn--sm  { width: 28px; height: 28px; font-size: 10px; }
.op-t-btn--md  { width: 34px; height: 34px; font-size: 13px; }
.op-t-btn--lg  { width: 40px; height: 40px; font-size: 16px; }

/* Play button — primary, gold accent when playing */
.op-t-btn--play.is-playing {
  background        : rgba(255, 220, 100, 0.14);
  border-color      : rgba(255, 220, 100, 0.35);
  color             : rgba(255, 220, 100, 0.90);
  box-shadow        : 0 0 10px rgba(255,200,60,0.12);
}

/* Disabled state */
.op-t-btn:disabled,
.op-t-btn[data-disabled] {
  opacity           : 0.28;
  pointer-events    : none;
}

/* Second row — first / last jump buttons */
.op-transport-aux {
  display           : flex;
  align-items       : center;
  gap               : 5px;
}

.op-t-aux {
  flex              : 1;
  height            : 20px;
  display           : flex;
  align-items       : center;
  justify-content   : center;
  background        : rgba(255,255,255,0.02);
  border            : 1px solid rgba(255,255,255,0.06);
  border-radius     : 4px;
  font-family       : var(--mono);
  font-size         : 8px;
  color             : var(--op-text-muted);
  cursor            : pointer;
  letter-spacing    : 0.08em;
  transition        : background 0.10s, color 0.10s;
}
.op-t-aux:hover { background: rgba(255,255,255,0.06); color: var(--op-text); }
.op-t-aux:disabled,
.op-t-aux[data-disabled] { opacity: 0.25; pointer-events: none; }

/* ── Current node readout ─────────────────────────────────────────────────── */

.op-current {
  flex-shrink       : 0;
  display           : flex;
  align-items       : center;
  gap               : 7px;
  padding           : 0 12px;
  height            : 32px;
  border-top        : 1px solid var(--op-sep);
  background        : rgba(255,255,255,0.01);
}

.op-current-pos {
  font-size         : 8px;
  color             : var(--op-text-muted);
  flex-shrink       : 0;
  letter-spacing    : 0.04em;
  min-width         : 36px;
}

.op-current-dot {
  width             : 6px;
  height            : 6px;
  border-radius     : 50%;
  flex-shrink       : 0;
  background        : rgba(255,220,100,0.60);
  border            : 1px solid rgba(255,220,100,0.30);
  transition        : background 0.20s;
}

.op-current-label {
  flex              : 1 1 auto;
  font-size         : 9px;
  color             : var(--op-accent);
  overflow          : hidden;
  text-overflow     : ellipsis;
  white-space       : nowrap;
  letter-spacing    : 0.04em;
}

.op-current-geo {
  font-size         : 8px;
  color             : var(--op-text-muted);
  flex-shrink       : 0;
}

/* ── Fly speed row ────────────────────────────────────────────────────────── */

.op-speed-row {
  flex-shrink       : 0;
  display           : flex;
  align-items       : center;
  gap               : 8px;
  padding           : 0 12px;
  height            : 26px;
  border-top        : 1px solid var(--op-sep);
}

.op-speed-label {
  font-size         : 8px;
  color             : var(--op-text-muted);
  text-transform    : uppercase;
  letter-spacing    : 0.12em;
  flex-shrink       : 0;
}

.op-speed-slider {
  flex              : 1 1 auto;
  -webkit-appearance: none;
  appearance        : none;
  height            : 3px;
  border-radius     : 2px;
  background        : rgba(255,255,255,0.10);
  outline           : none;
  cursor            : pointer;
}
.op-speed-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width             : 11px;
  height            : 11px;
  border-radius     : 50%;
  background        : rgba(255,255,255,0.80);
  border            : 1px solid rgba(255,255,255,0.25);
  cursor            : pointer;
  box-shadow        : 0 0 4px rgba(0,0,0,0.40);
}
.op-speed-slider::-moz-range-thumb {
  width             : 11px;
  height            : 11px;
  border-radius     : 50%;
  background        : rgba(255,255,255,0.80);
  border            : 1px solid rgba(255,255,255,0.25);
  cursor            : pointer;
}

.op-speed-val {
  font-size         : 8px;
  color             : var(--op-text-dim);
  flex-shrink       : 0;
  width             : 28px;
  text-align        : right;
}

/* ── Footer ───────────────────────────────────────────────────────────────── */

.op-footer {
  flex-shrink       : 0;
  height            : 26px;
  padding           : 0 12px;
  display           : flex;
  align-items       : center;
  border-top        : 1px solid var(--op-sep);
  gap               : 8px;
}

.op-footer-state {
  font-size         : 8px;
  color             : var(--op-text-muted);
  text-transform    : uppercase;
  letter-spacing    : 0.10em;
}
.op-footer-state.is-playing { color: rgba(255, 220, 100, 0.65); }
.op-footer-state.is-paused  { color: rgba(100, 180, 255, 0.65); }

.op-footer-node {
  margin-left       : auto;
  font-size         : 8px;
  color             : var(--op-text-muted);
  letter-spacing    : 0.04em;
  overflow          : hidden;
  text-overflow     : ellipsis;
  white-space       : nowrap;
  max-width         : 160px;
}

/* ── Glitch scan line ─────────────────────────────────────────────────────── */

.op-glitch-line {
  position          : absolute;
  left              : 0;
  width             : 100%;
  height            : 2px;
  background        : rgba(255,255,255,0.30);
  pointer-events    : none;
  z-index           : 10;
  opacity           : 0;
}

/* ── ADD mode cursor hint on canvas ───────────────────────────────────────── */

body.op-add-mode { cursor: cell !important; }

/* ── Flying indicator ─────────────────────────────────────────────────────── */

.op-flying-badge {
  display           : none;
  position          : fixed;
  top               : 50%;
  left              : 50%;
  transform         : translate(-50%, -50%);
  padding           : 6px 14px;
  background        : rgba(6, 6, 10, 0.85);
  border            : 1px solid rgba(255, 220, 100, 0.25);
  border-radius     : 6px;
  font-family       : 'Courier New', Courier, monospace;
  font-size         : 9px;
  color             : rgba(255, 220, 100, 0.70);
  letter-spacing    : 0.12em;
  text-transform    : uppercase;
  pointer-events    : none;
  z-index           : 80;
  backdrop-filter   : blur(8px);
}
.op-flying-badge.is-visible { display: block; }

/* ── Mobile ───────────────────────────────────────────────────────────────── */

@media (max-width: 560px) {
  .op-panel { width: min(${PANEL_W}px, 92vw); height: min(${PANEL_H}px, 58vh); }
}

`

// ── Style injection ───────────────────────────────────────────────────────────

function injectStyles () {
  if (document.getElementById('omni-presenter-styles')) return
  const tag = document.createElement('style')
  tag.id          = 'omni-presenter-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

// ── Glitch helper ─────────────────────────────────────────────────────────────

function glitch (el) {
  return new Promise(resolve => {
    const line = el.querySelector('.op-glitch-line')
    const tl   = gsap.timeline({ onComplete: resolve })
    tl.to(el, { x:  3, duration: 0.028, ease: 'none' })
      .to(el, { x: -4, duration: 0.024, ease: 'none' })
      .to(el, { x:  2, opacity: 0.72, duration: 0.020, ease: 'none' })
      .to(el, { x:  0, opacity: 1,    duration: 0.028, ease: 'power1.out' })
    if (line) {
      gsap.fromTo(line,
        { top: '-2px', opacity: 0.80 },
        { top: '100%', opacity: 0,    duration: GLITCH_DUR, ease: 'power1.in' }
      )
    }
  })
}

// ── flySpeed ↔ slider mapping ─────────────────────────────────────────────────
// Slider: 0–100 integer. Speed: FLY_SPEED_MIN–FLY_SPEED_MAX seconds.

function sliderToSpeed (val) {
  // Invert: slider 100 = fastest (min seconds), slider 0 = slowest (max seconds)
  const t = 1 - (val / 100)
  return FLY_SPEED_MIN + t * (FLY_SPEED_MAX - FLY_SPEED_MIN)
}

function speedToSlider (speed) {
  const t = (speed - FLY_SPEED_MIN) / (FLY_SPEED_MAX - FLY_SPEED_MIN)
  return Math.round((1 - t) * 100)
}

// ─────────────────────────────────────────────────────────────────────────────
// OmniPresenter class
// ─────────────────────────────────────────────────────────────────────────────

export default class OmniPresenter {

  /**
   * @param {object} context  — { scene, camera, renderer, sizes, ticker, Sound? }
   */
  constructor (context) {
    this.ctx = context

    // ── Panel state ────────────────────────────────────────────────────
    this._el         = null
    this._flyBadge   = null
    this._isOpen     = false

    // ── Presenter state ────────────────────────────────────────────────
    this._state      = STATE.IDLE
    this._sequence   = []     // ordered array of node data objects
    this._index      = -1     // current position in sequence (-1 = none)
    this._source     = 'manual'  // 'path' | 'manual'
    this._flySpeed   = FLY_SPEED_DEFAULT

    // ── Node registry — shadow of OmniNode's storage ───────────────────
    // Populated on omni:nodes-updated. Used to resolve IDs → node data.
    this._nodeMap    = new Map()   // id → node data

    // ── ADD mode — clicking scene adds node to sequence ────────────────
    this._addMode    = false

    // ── Camera fly-to state ────────────────────────────────────────────
    this._flying     = false
    this._flyTween   = null

    // ── Raycaster ─────────────────────────────────────────────────────
    this._raycaster  = new THREE.Raycaster()
    this._mouse      = new THREE.Vector2()

    // ── Drag-reorder state ────────────────────────────────────────────
    this._dragIdx    = -1

    // ── Bound handlers ────────────────────────────────────────────────
    this._onToggle      = null
    this._onNodesUp     = null
    this._onPathStep    = null
    this._onNodeSel     = null
    this._onNodeDel     = null
    this._onKeyDown     = null
    this._onCanvasClick = null
    this._onCanvasMove  = null
  }

  // ── Module contract ──────────────────────────────────────────────────────

  init () {
    injectStyles()
    this._buildPanel()
    this._buildFlyBadge()
    this._bindEvents()
    this._bindKeyboard()
    this._bindRaycast()
    this._load()
    this._refreshNodeMap()
    this._renderList()
    this._syncTransport()
    this._updateFooter()
  }

  update (_delta) {
    // Nothing per-frame — fly-to is handled entirely by GSAP
  }

  destroy () {
    this._stopFly()
    this._el?.parentNode?.removeChild(this._el)
    this._flyBadge?.parentNode?.removeChild(this._flyBadge)

    window.removeEventListener('omni:system-toggle', this._onToggle)
    window.removeEventListener('omni:nodes-updated', this._onNodesUp)
    window.removeEventListener('omni:path-step',     this._onPathStep)
    window.removeEventListener('omni:node-selected', this._onNodeSel)
    window.removeEventListener('omni:node-deleted',  this._onNodeDel)
    document.removeEventListener('keydown',          this._onKeyDown)

    const canvas = this.ctx.renderer?.domElement
    if (canvas) {
      canvas.removeEventListener('click',     this._onCanvasClick)
      canvas.removeEventListener('mousemove', this._onCanvasMove)
    }

    document.body.classList.remove('op-add-mode')
    this._setAddMode(false)
  }

  // ── Public API ───────────────────────────────────────────────────────────

  open () {
    if (this._isOpen) return
    this._isOpen = true
    this._el.style.visibility = 'visible'
    gsap.fromTo(this._el,
      { x: '100%', opacity: 1 },
      {
        x: '0%', duration: SLIDE_DUR, ease: 'power3.out',
        onComplete: () => glitch(this._el)
      }
    )
    this._playSound('open')
  }

  close () {
    if (!this._isOpen) return
    if (this._state === STATE.PLAYING) this._pause()

    glitch(this._el).then(() => {
      gsap.to(this._el, {
        x: '100%', duration: SLIDE_DUR * 0.85, ease: 'power2.in',
        onComplete: () => {
          this._el.style.visibility = 'hidden'
          gsap.set(this._el, { x: '100%' })
        }
      })
    })
    this._isOpen = false
    this._setAddMode(false)
    this._playSound('close')
  }

  toggle () { this._isOpen ? this.close() : this.open() }

  // ── Panel DOM ────────────────────────────────────────────────────────────

  _buildPanel () {
    const el = document.createElement('div')
    el.className = 'op-panel'
    el.id        = 'omni-presenter-panel'

    el.innerHTML = /* html */`
      <div class="op-glitch-line" aria-hidden="true"></div>

      <!-- Header -->
      <div class="op-header">
        <div class="op-controls">
          <button class="op-ctrl op-ctrl--close"    data-action="close"    title="✕ Close"        >✕</button>
          <button class="op-ctrl op-ctrl--minimize" data-action="minimize" title="_ Minimize"     >_</button>
          <button class="op-ctrl op-ctrl--attach"   data-action="attach"   title="⟐ Pocket attach">⟐</button>
        </div>
        <span class="op-title">OmniPresenter ⟐p</span>
      </div>

      <!-- Toolbar -->
      <div class="op-toolbar">
        <span class="op-seq-label" id="op-seq-label">Sequence (0)</span>
        <span class="op-source-badge" id="op-source-badge">manual</span>
        <button class="op-btn op-btn--add" id="op-add-btn" title="Click nodes in scene to add them">+ Add</button>
        <button class="op-btn op-btn--clear" id="op-clear-btn" title="Clear sequence">Clear</button>
      </div>

      <!-- Sequence list -->
      <div class="op-seq-list" id="op-seq-list">
        <div class="op-list-empty">
          <span class="op-list-empty-glyph">⟐p</span>
          <span>No nodes in sequence.</span>
          <span style="font-size:8px;opacity:0.7">Use PATH mode in ⟐N,<br>or click + Add and select nodes.</span>
        </div>
      </div>

      <!-- ID input row -->
      <div class="op-id-row">
        <input class="op-id-input" id="op-id-input"
               placeholder="Enter node ID…" spellcheck="false">
        <button class="op-id-add" id="op-id-add-btn">Add by ID</button>
      </div>

      <!-- Transport -->
      <div class="op-transport">
        <div class="op-transport-main">
          <button class="op-t-btn op-t-btn--sm" id="op-t-prev-start" title="First (Home)">⏮</button>
          <button class="op-t-btn op-t-btn--md" id="op-t-prev"       title="Previous (←)">◀</button>
          <button class="op-t-btn op-t-btn--lg op-t-btn--play" id="op-t-play"
                  title="Play / Pause (Space)">▶</button>
          <button class="op-t-btn op-t-btn--md" id="op-t-next"       title="Next (→)">▶</button>
          <button class="op-t-btn op-t-btn--sm" id="op-t-next-end"   title="Last (End)">⏭</button>
        </div>
        <div class="op-transport-aux">
          <button class="op-t-aux" id="op-t-stop" title="Stop (Esc)">■ Stop</button>
        </div>
      </div>

      <!-- Current node readout -->
      <div class="op-current">
        <span class="op-current-pos" id="op-current-pos">— / —</span>
        <span class="op-current-dot" id="op-current-dot"></span>
        <span class="op-current-label" id="op-current-label">No node selected</span>
        <span class="op-current-geo"  id="op-current-geo"></span>
      </div>

      <!-- Fly speed -->
      <div class="op-speed-row">
        <span class="op-speed-label">Speed</span>
        <input class="op-speed-slider" id="op-speed-slider" type="range"
               min="0" max="100" value="${speedToSlider(FLY_SPEED_DEFAULT)}"
               title="Camera fly speed">
        <span class="op-speed-val" id="op-speed-val">${FLY_SPEED_DEFAULT.toFixed(1)}s</span>
      </div>

      <!-- Footer -->
      <div class="op-footer">
        <span class="op-footer-state" id="op-footer-state">⟐p  idle</span>
        <span class="op-footer-node"  id="op-footer-node">—</span>
      </div>
    `

    gsap.set(el, { x: '100%' })
    this._el = el

    const shell = document.getElementById('omni-ui') ?? document.body
    shell.appendChild(el)

    this._bindPanelControls()
  }

  _buildFlyBadge () {
    const el = document.createElement('div')
    el.className = 'op-flying-badge'
    el.id        = 'op-flying-badge'
    el.textContent = '⟐p  Flying…'
    const shell = document.getElementById('omni-ui') ?? document.body
    shell.appendChild(el)
    this._flyBadge = el
  }

  // ── Panel control bindings ────────────────────────────────────────────────

  _bindPanelControls () {
    const el = this._el

    // Header ✕ _ ⟐
    el.querySelector('.op-controls').addEventListener('click', (e) => {
      const btn = e.target.closest('.op-ctrl')
      if (!btn) return
      this._playSound('click')
      switch (btn.dataset.action) {
        case 'close':    this.close();     break
        case 'minimize': this._minimize(); break
        case 'attach':   this._attach();   break
      }
    })

    // Add mode toggle
    el.querySelector('#op-add-btn').addEventListener('click', () => {
      this._setAddMode(!this._addMode)
      this._playSound('click')
    })

    // Clear sequence
    el.querySelector('#op-clear-btn').addEventListener('click', () => {
      this._clearSequence()
      this._playSound('close')
    })

    // Add by ID
    el.querySelector('#op-id-add-btn').addEventListener('click', () => {
      const input = el.querySelector('#op-id-input')
      const id = input?.value?.trim()
      if (id) {
        this._addById(id)
        input.value = ''
        this._playSound('click')
      }
    })
    el.querySelector('#op-id-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        el.querySelector('#op-id-add-btn')?.click()
      }
    })

    // Transport buttons
    el.querySelector('#op-t-play')      ?.addEventListener('click', () => this._togglePlay())
    el.querySelector('#op-t-prev')      ?.addEventListener('click', () => this._step(-1))
    el.querySelector('#op-t-next')      ?.addEventListener('click', () => this._step(+1))
    el.querySelector('#op-t-prev-start')?.addEventListener('click', () => this._jumpToIndex(0))
    el.querySelector('#op-t-next-end')  ?.addEventListener('click', () => this._jumpToIndex(this._sequence.length - 1))
    el.querySelector('#op-t-stop')      ?.addEventListener('click', () => this._stop())

    // Fly speed slider
    el.querySelector('#op-speed-slider')?.addEventListener('input', (e) => {
      this._flySpeed = sliderToSpeed(parseInt(e.target.value, 10))
      const valEl = el.querySelector('#op-speed-val')
      if (valEl) valEl.textContent = this._flySpeed.toFixed(1) + 's'
      this._save()
    })
  }

  // ── Sequence list render ──────────────────────────────────────────────────

  _renderList () {
    const listEl  = this._el?.querySelector('#op-seq-list')
    const labelEl = this._el?.querySelector('#op-seq-label')
    const srcBadge = this._el?.querySelector('#op-source-badge')
    if (!listEl) return

    if (labelEl) labelEl.textContent = `Sequence (${this._sequence.length})`

    if (srcBadge) {
      srcBadge.textContent = this._source
      srcBadge.className   = `op-source-badge ${this._source === 'path' ? 'is-path' : 'is-manual'}`
    }

    if (this._sequence.length === 0) {
      listEl.innerHTML = /* html */`
        <div class="op-list-empty">
          <span class="op-list-empty-glyph">⟐p</span>
          <span>No nodes in sequence.</span>
          <span style="font-size:8px;opacity:0.7">Use PATH mode in ⟐N,<br>or click + Add and select nodes.</span>
        </div>
      `
      return
    }

    listEl.innerHTML = this._sequence.map((node, idx) => {
      const isCurrent = idx === this._index
      const dotColor  = PRIM_COLORS[node.primitive] ?? '#888888'
      const geoShort  = (node.geometry ?? '').replace('Geometry', '')
      return /* html */`
        <div class="op-seq-row ${isCurrent ? 'is-current' : ''}"
             data-seq-idx="${idx}"
             draggable="true"
             title="${node.id}">
          <span class="op-seq-index">${idx + 1}</span>
          <span class="op-seq-dot" style="background:${dotColor};border-color:${dotColor}40"></span>
          <div class="op-seq-info">
            <div class="op-seq-name">${node.label ?? node.id}</div>
            <div class="op-seq-geo">${geoShort}</div>
          </div>
          <span class="op-seq-jump" data-jump-idx="${idx}" title="Fly to this node">⟐</span>
          <button class="op-seq-rm" data-rm-idx="${idx}" title="Remove from sequence">✕</button>
        </div>
      `
    }).join('')

    this._bindListInteractions(listEl)
  }

  _bindListInteractions (listEl) {
    // Row click → jump to node
    listEl.querySelectorAll('.op-seq-row').forEach(row => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('.op-seq-rm')) return
        if (e.target.closest('.op-seq-jump')) return
        const idx = parseInt(row.dataset.seqIdx, 10)
        this._jumpToIndex(idx)
        this._playSound('click')
      })
    })

    // Jump button → fly to
    listEl.querySelectorAll('.op-seq-jump').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation()
        const idx = parseInt(btn.dataset.jumpIdx, 10)
        this._jumpToIndex(idx)
        this._playSound('click')
      })
    })

    // Remove button
    listEl.querySelectorAll('.op-seq-rm').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation()
        const idx = parseInt(btn.dataset.rmIdx, 10)
        this._removeAt(idx)
        this._playSound('close')
      })
    })

    // Drag-to-reorder
    listEl.querySelectorAll('[draggable]').forEach(row => {
      row.addEventListener('dragstart', (e) => {
        this._dragIdx = parseInt(row.dataset.seqIdx, 10)
        row.classList.add('is-dragging')
        e.dataTransfer.effectAllowed = 'move'
      })
      row.addEventListener('dragend', () => {
        row.classList.remove('is-dragging')
        listEl.querySelectorAll('.drag-target').forEach(r => r.classList.remove('drag-target'))
        this._dragIdx = -1
      })
      row.addEventListener('dragover', (e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        listEl.querySelectorAll('.drag-target').forEach(r => r.classList.remove('drag-target'))
        row.classList.add('drag-target')
      })
      row.addEventListener('drop', (e) => {
        e.preventDefault()
        const toIdx = parseInt(row.dataset.seqIdx, 10)
        if (this._dragIdx !== -1 && this._dragIdx !== toIdx) {
          this._reorderSequence(this._dragIdx, toIdx)
        }
        listEl.querySelectorAll('.drag-target').forEach(r => r.classList.remove('drag-target'))
      })
    })
  }

  // ── Transport sync — enable/disable buttons to match state ───────────────

  _syncTransport () {
    const el = this._el
    if (!el) return

    const hasSeq   = this._sequence.length > 0
    const isIdle   = this._state === STATE.IDLE
    const isPlaying = this._state === STATE.PLAYING
    const atStart  = this._index <= 0
    const atEnd    = this._index >= this._sequence.length - 1

    const setDisabled = (id, disabled) => {
      const btn = el.querySelector(id)
      if (!btn) return
      if (disabled) btn.setAttribute('data-disabled', '1')
      else btn.removeAttribute('data-disabled')
    }

    setDisabled('#op-t-play',       !hasSeq)
    setDisabled('#op-t-prev',       !hasSeq || atStart || this._flying)
    setDisabled('#op-t-next',       !hasSeq || atEnd   || this._flying)
    setDisabled('#op-t-prev-start', !hasSeq || atStart)
    setDisabled('#op-t-next-end',   !hasSeq || atEnd)
    setDisabled('#op-t-stop',       isIdle)

    // Play button icon and state
    const playBtn = el.querySelector('#op-t-play')
    if (playBtn) {
      playBtn.textContent = isPlaying ? '⏸' : '▶'
      playBtn.classList.toggle('is-playing', isPlaying)
    }

    // Panel playing glow
    el.classList.toggle('is-playing', isPlaying)
  }

  // ── Current node readout ──────────────────────────────────────────────────

  _updateCurrentReadout () {
    const el = this._el
    if (!el) return

    const posEl   = el.querySelector('#op-current-pos')
    const dotEl   = el.querySelector('#op-current-dot')
    const labelEl = el.querySelector('#op-current-label')
    const geoEl   = el.querySelector('#op-current-geo')

    if (this._index < 0 || this._index >= this._sequence.length) {
      if (posEl)   posEl.textContent   = '— / —'
      if (labelEl) labelEl.textContent = 'No node selected'
      if (geoEl)   geoEl.textContent   = ''
      return
    }

    const node = this._sequence[this._index]
    const total = this._sequence.length
    const dotColor = PRIM_COLORS[node.primitive] ?? '#888888'

    if (posEl)   posEl.textContent   = `${this._index + 1} / ${total}`
    if (dotEl)   { dotEl.style.background = dotColor; dotEl.style.borderColor = dotColor + '40' }
    if (labelEl) labelEl.textContent = node.label ?? node.id
    if (geoEl)   geoEl.textContent   = (node.geometry ?? '').replace('Geometry', '')
  }

  // ── Footer ────────────────────────────────────────────────────────────────

  _updateFooter () {
    const stateEl = this._el?.querySelector('#op-footer-state')
    const nodeEl  = this._el?.querySelector('#op-footer-node')

    if (stateEl) {
      stateEl.textContent = `⟐p  ${this._state}`
      stateEl.className   = `op-footer-state ${
        this._state === STATE.PLAYING ? 'is-playing' :
        this._state === STATE.PAUSED  ? 'is-paused'  : ''
      }`
    }

    if (nodeEl) {
      if (this._index >= 0 && this._index < this._sequence.length) {
        const node = this._sequence[this._index]
        nodeEl.textContent = node.label ?? node.id
      } else {
        nodeEl.textContent = '—'
      }
    }
  }

  // ── Sequence management ───────────────────────────────────────────────────

  /**
   * Append a node to the sequence (if not already present).
   * @param {object} nodeData
   * @returns {boolean} true if added
   */
  _appendNode (nodeData) {
    if (!nodeData?.id) return false
    if (this._sequence.some(n => n.id === nodeData.id)) return false
    this._sequence.push({ ...nodeData })
    this._source = 'manual'
    this._save()
    this._renderList()
    this._syncTransport()
    this._updateFooter()
    return true
  }

  /**
   * Add a node by ID — looks up _nodeMap.
   * @param {string} id
   */
  _addById (id) {
    const node = this._nodeMap.get(id)
    if (!node) {
      this._flashIdInput('not found')
      return
    }
    const added = this._appendNode(node)
    if (!added) this._flashIdInput('already in sequence')
  }

  /** Flash the ID input with a short error label. */
  _flashIdInput (msg) {
    const input = this._el?.querySelector('#op-id-input')
    if (!input) return
    const prev = input.placeholder
    input.placeholder = msg
    input.style.borderColor = 'rgba(255,80,80,0.40)'
    setTimeout(() => {
      input.placeholder = prev
      input.style.borderColor = ''
    }, 1600)
  }

  _removeAt (idx) {
    if (idx < 0 || idx >= this._sequence.length) return

    const wasCurrentOrBefore = idx <= this._index
    this._sequence.splice(idx, 1)

    if (wasCurrentOrBefore && this._index > 0) {
      this._index = Math.min(this._index - 1, this._sequence.length - 1)
    } else if (this._sequence.length === 0) {
      this._index = -1
      this._stop()
    }

    this._source = 'manual'
    this._save()
    this._renderList()
    this._syncTransport()
    this._updateCurrentReadout()
    this._updateFooter()
  }

  _clearSequence () {
    this._stop()
    this._sequence = []
    this._index    = -1
    this._source   = 'manual'
    this._save()
    this._renderList()
    this._syncTransport()
    this._updateCurrentReadout()
    this._updateFooter()
  }

  /**
   * Load a path sequence from OmniNode PATH mode edges.
   * Edges arrive ordered as built — reconstruct traversal order by walking
   * the chain: start at edges[0].from, then each edge's .to.
   *
   * @param {{ from: string, to: string }[]} edges
   */
  _loadPathSequence (edges) {
    if (!edges || edges.length === 0) return

    // Build an ordered ID list by walking the edge chain
    const orderedIds = [edges[0].from]
    for (const edge of edges) {
      if (orderedIds[orderedIds.length - 1] === edge.from) {
        orderedIds.push(edge.to)
      }
    }

    // Resolve IDs to node data
    const nodes = orderedIds
      .map(id => this._nodeMap.get(id))
      .filter(Boolean)

    if (nodes.length === 0) return

    this._sequence = nodes
    this._source   = 'path'
    this._index    = -1

    this._save()
    this._renderList()
    this._syncTransport()
    this._updateCurrentReadout()
    this._updateFooter()
  }

  _reorderSequence (fromIdx, toIdx) {
    if (fromIdx === toIdx) return
    const [moved] = this._sequence.splice(fromIdx, 1)
    this._sequence.splice(toIdx, 0, moved)

    // Adjust current index to track the same node
    if (this._index === fromIdx) {
      this._index = toIdx
    } else if (fromIdx < this._index && toIdx >= this._index) {
      this._index--
    } else if (fromIdx > this._index && toIdx <= this._index) {
      this._index++
    }

    this._source = 'manual'
    this._save()
    this._renderList()
    this._syncTransport()
  }

  // ── ADD mode ──────────────────────────────────────────────────────────────

  _setAddMode (active) {
    this._addMode = active
    document.body.classList.toggle('op-add-mode', active)

    const btn = this._el?.querySelector('#op-add-btn')
    btn?.classList.toggle('is-active', active)
  }

  // ── Transport actions ─────────────────────────────────────────────────────

  _togglePlay () {
    if (this._sequence.length === 0) return
    if (this._state === STATE.PLAYING) {
      this._pause()
    } else {
      this._play()
    }
  }

  _play () {
    if (this._sequence.length === 0) return
    this._state = STATE.PLAYING

    // If no current index, start from the beginning
    if (this._index < 0) this._index = 0

    this._setAddMode(false)
    this._syncTransport()
    this._updateFooter()
    this._renderList()

    this._flyToCurrentNode()

    window.dispatchEvent(new CustomEvent('omni:presenter-active', { detail: { active: true } }))
    this._playSound('open')
  }

  _pause () {
    if (this._state !== STATE.PLAYING) return
    this._state = STATE.PAUSED
    this._stopFly()
    this._syncTransport()
    this._updateFooter()
    window.dispatchEvent(new CustomEvent('omni:presenter-active', { detail: { active: false } }))
  }

  _stop () {
    this._stopFly()
    this._state = STATE.IDLE
    this._syncTransport()
    this._updateFooter()
    window.dispatchEvent(new CustomEvent('omni:presenter-active', { detail: { active: false } }))
    this._enableOrbit()
    this._playSound('close')
  }

  /**
   * Step forward (+1) or backward (-1) through the sequence.
   * @param {number} dir  — +1 or -1
   */
  _step (dir) {
    if (this._flying) return
    if (this._sequence.length === 0) return

    const next = this._index + dir

    if (next < 0 || next >= this._sequence.length) {
      // At boundary — pause if playing
      if (this._state === STATE.PLAYING) this._pause()
      return
    }

    this._index = next

    if (this._state === STATE.PLAYING || this._state === STATE.PAUSED) {
      this._flyToCurrentNode()
    }

    this._renderList()
    this._syncTransport()
    this._updateCurrentReadout()
    this._updateFooter()
    this._scrollListToCurrentRow()

    this._playSound('click')
  }

  /**
   * Jump directly to a sequence index — regardless of current position.
   * @param {number} idx
   */
  _jumpToIndex (idx) {
    if (idx < 0 || idx >= this._sequence.length) return
    if (this._flying) return

    this._index = idx

    if (this._state === STATE.IDLE) this._state = STATE.PAUSED
    this._flyToCurrentNode()

    this._renderList()
    this._syncTransport()
    this._updateCurrentReadout()
    this._updateFooter()
    this._scrollListToCurrentRow()

    const node = this._sequence[idx]
    window.dispatchEvent(new CustomEvent('omni:presenter-jump', {
      detail: { id: node.id, node }
    }))

    this._playSound('click')
  }

  // ── Scroll list to keep current row visible ───────────────────────────────

  _scrollListToCurrentRow () {
    const listEl = this._el?.querySelector('#op-seq-list')
    const row    = listEl?.querySelector('.op-seq-row.is-current')
    if (row) {
      row.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }

  // ── Camera fly-to ─────────────────────────────────────────────────────────

  /**
   * Animate camera to view the node at this._index.
   * Disables orbit controls during flight, re-enables after.
   */
  _flyToCurrentNode () {
    if (this._index < 0 || this._index >= this._sequence.length) return

    const node = this._sequence[this._index]
    if (!node?.position) {
      // No position data — skip fly, dispatch step event only
      this._onFlyComplete()
      return
    }

    const [nx, ny, nz] = node.position
    const target = new THREE.Vector3(nx, ny, nz)

    // Compute camera offset: behind (away from origin) and above
    const cam    = this.ctx.camera
    const dir    = new THREE.Vector3().subVectors(cam.position, target).normalize()
    const offset = new THREE.Vector3(
      dir.x * FLY_OFFSET_BACK,
      FLY_OFFSET_UP,
      dir.z * FLY_OFFSET_BACK,
    )
    const destPos = target.clone().add(offset)

    this._flying = true
    this._disableOrbit()
    this._showFlyBadge(true)
    this._syncTransport()

    this._stopFly()

    this._flyTween = gsap.to(cam.position, {
      x        : destPos.x,
      y        : destPos.y,
      z        : destPos.z,
      duration : this._flySpeed,
      ease     : FLY_EASE,
      onUpdate : () => { cam.lookAt(target) },
      onComplete: () => { this._onFlyComplete() },
    })
  }

  _onFlyComplete () {
    this._flying = false
    this._showFlyBadge(false)
    this._syncTransport()
    this._enableOrbit()

    const node  = this._sequence[this._index]
    const total = this._sequence.length

    window.dispatchEvent(new CustomEvent('omni:presenter-step', {
      detail: { index: this._index, total, node }
    }))

    // If playing, auto-advance to next after a brief hold
    if (this._state === STATE.PLAYING) {
      const isLast = this._index >= this._sequence.length - 1
      if (isLast) {
        this._pause()
      }
      // Manual advance via Next button — auto-play does not auto-advance
      // (presenter is step-on-demand, not timed slideshow)
    }
  }

  _stopFly () {
    if (this._flyTween) {
      this._flyTween.kill()
      this._flyTween = null
    }
    if (this._flying) {
      this._flying = false
      this._showFlyBadge(false)
      this._enableOrbit()
    }
  }

  _showFlyBadge (visible) {
    if (!this._flyBadge) return
    if (visible) {
      const node = this._sequence[this._index]
      this._flyBadge.textContent = `⟐p  Flying to ${node?.label ?? '…'}`
      this._flyBadge.classList.add('is-visible')
      gsap.fromTo(this._flyBadge, { opacity: 0 }, { opacity: 1, duration: 0.15 })
    } else {
      gsap.to(this._flyBadge, {
        opacity: 0, duration: 0.20,
        onComplete: () => this._flyBadge.classList.remove('is-visible')
      })
    }
  }

  // ── Orbit control events ──────────────────────────────────────────────────

  _disableOrbit () {
    window.dispatchEvent(new CustomEvent('omni:orbit-disable', { detail: {} }))
  }

  _enableOrbit () {
    window.dispatchEvent(new CustomEvent('omni:orbit-enable', { detail: {} }))
  }

  // ── Raycast — ADD mode canvas click ──────────────────────────────────────

  _bindRaycast () {
    const canvas = this.ctx.renderer?.domElement
    if (!canvas) return

    this._onCanvasMove = (e) => {
      if (!this._addMode) return
      const rect = canvas.getBoundingClientRect()
      this._mouse.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1
      this._mouse.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1
    }

    this._onCanvasClick = (e) => {
      // Only intercept when ADD mode is on
      if (!this._addMode) return

      const rect = canvas.getBoundingClientRect()
      this._mouse.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1
      this._mouse.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1

      this._raycaster.setFromCamera(this._mouse, this.ctx.camera)

      // Collect all node meshes from the scene by userData.nodeId
      const nodeMeshes = []
      this.ctx.scene.traverse(obj => {
        if (obj.userData?.nodeId) nodeMeshes.push(obj)
      })

      const hits = this._raycaster.intersectObjects(nodeMeshes, false)
      if (hits.length === 0) return

      const id   = hits[0].object.userData.nodeId
      const node = this._nodeMap.get(id)
      if (!node) return

      this._appendNode(node)
      this._playSound('click')
    }

    canvas.addEventListener('mousemove', this._onCanvasMove, { passive: true })
    canvas.addEventListener('click',     this._onCanvasClick)
  }

  // ── Keyboard shortcuts ────────────────────────────────────────────────────

  _bindKeyboard () {
    this._onKeyDown = (e) => {
      if (!this._isOpen) return

      // Don't intercept when typing in an input
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return

      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          e.preventDefault()
          this._step(+1)
          break
        case 'ArrowLeft':
        case 'ArrowUp':
          e.preventDefault()
          this._step(-1)
          break
        case ' ':
          e.preventDefault()
          this._togglePlay()
          break
        case 'Escape':
          e.preventDefault()
          this._stop()
          break
        case 'Home':
          e.preventDefault()
          this._jumpToIndex(0)
          break
        case 'End':
          e.preventDefault()
          this._jumpToIndex(this._sequence.length - 1)
          break
      }
    }

    document.addEventListener('keydown', this._onKeyDown)
  }

  // ── Event listeners ───────────────────────────────────────────────────────

  _bindEvents () {
    // Open / close toggle
    this._onToggle = (e) => {
      if (e.detail?.system !== 'omnipresenter') return
      this.toggle()
    }

    // Sync node map whenever OmniNode saves
    this._onNodesUp = (e) => {
      const { nodes = [] } = e.detail ?? {}
      this._nodeMap.clear()
      nodes.forEach(n => this._nodeMap.set(n.id, n))

      // Refresh sequence entries — labels or positions may have changed
      this._sequence = this._sequence
        .map(n => this._nodeMap.get(n.id) ?? n)
        .filter(Boolean)

      this._renderList()
      this._updateCurrentReadout()
    }

    // PATH mode edge drawn in ⟐N → auto-load path sequence
    this._onPathStep = (e) => {
      const { edges } = e.detail ?? {}
      if (edges && edges.length > 0) {
        this._loadPathSequence(edges)
      }
    }

    // Node selected in scene while in ADD mode → append
    this._onNodeSel = (e) => {
      if (!this._addMode) return
      const { node } = e.detail ?? {}
      if (node) this._appendNode(node)
    }

    // Node deleted → remove from sequence
    this._onNodeDel = (e) => {
      const { id } = e.detail ?? {}
      if (!id) return
      const idx = this._sequence.findIndex(n => n.id === id)
      if (idx !== -1) this._removeAt(idx)
    }

    window.addEventListener('omni:system-toggle', this._onToggle)
    window.addEventListener('omni:nodes-updated', this._onNodesUp)
    window.addEventListener('omni:path-step',     this._onPathStep)
    window.addEventListener('omni:node-selected', this._onNodeSel)
    window.addEventListener('omni:node-deleted',  this._onNodeDel)
  }

  // ── Node map bootstrap ────────────────────────────────────────────────────

  /** Read omni:nodes from localStorage to seed the node map at startup. */
  _refreshNodeMap () {
    try {
      const raw = localStorage.getItem('omni:nodes')
      if (!raw) return
      const nodes = JSON.parse(raw)
      this._nodeMap.clear()
      nodes.forEach(n => this._nodeMap.set(n.id, n))
    } catch { /* silent */ }
  }

  // ── Persistence ───────────────────────────────────────────────────────────

  _save () {
    try {
      const data = {
        sequence : this._sequence.map(n => n.id),
        source   : this._source,
        flySpeed : this._flySpeed,
      }
      localStorage.setItem(STORE_KEY, JSON.stringify(data))
    } catch (err) {
      console.warn('⟐p — localStorage save failed:', err)
    }
  }

  _load () {
    try {
      const raw = localStorage.getItem(STORE_KEY)
      if (!raw) return
      const data = JSON.parse(raw)

      if (typeof data.flySpeed === 'number') {
        this._flySpeed = data.flySpeed
        // Sync speed slider
        const slider = this._el?.querySelector('#op-speed-slider')
        const valEl  = this._el?.querySelector('#op-speed-val')
        if (slider) slider.value = speedToSlider(this._flySpeed)
        if (valEl)  valEl.textContent = this._flySpeed.toFixed(1) + 's'
      }

      if (Array.isArray(data.sequence) && data.sequence.length > 0) {
        this._source = data.source ?? 'manual'
        // IDs resolved after _refreshNodeMap() is called in init()
        // Resolve is deferred to the end of init via a microtask
        Promise.resolve().then(() => {
          const nodes = data.sequence
            .map(id => this._nodeMap.get(id))
            .filter(Boolean)
          if (nodes.length > 0) {
            this._sequence = nodes
            this._renderList()
            this._syncTransport()
            this._updateFooter()
          }
        })
      }

    } catch (err) {
      console.warn('⟐p — localStorage load failed:', err)
    }
  }

  // ── Minimize / attach ─────────────────────────────────────────────────────

  _minimize () {
    if (this._state === STATE.PLAYING) this._pause()
    const rect = this._el.getBoundingClientRect()

    gsap.to(this._el, {
      scale: 0.88, opacity: 0, duration: 0.18, ease: 'power2.in',
      onComplete: () => {
        this._el.style.visibility = 'hidden'
        gsap.set(this._el, { scale: 1, opacity: 1 })
      }
    })
    this._isOpen = false
    this._setAddMode(false)

    window.dispatchEvent(new CustomEvent('omni:panel-minimized', {
      detail: {
        id        : 'omnipresenter',
        label     : '⟐p',
        iconLabel : '⟐p',
        fromRect  : { x: rect.left, y: rect.top, w: rect.width, h: rect.height },
      }
    }))
    window.dispatchEvent(new CustomEvent('omni:panel-restore-handler', {
      detail: { id: 'omnipresenter', handler: () => this.open() }
    }))
  }

  _attach () {
    window.dispatchEvent(new CustomEvent('omni:panel-attached', {
      detail: { id: 'omnipresenter' }
    }))
    // Phase 5: camera.attach(this._el) for XR follow-mode
  }

  // ── Sound ─────────────────────────────────────────────────────────────────

  _playSound (id) {
    try {
      const Sound = this.ctx?.Sound
      if (Sound && typeof Sound.play === 'function') Sound.play(id)
    } catch (_) {}
  }
}
