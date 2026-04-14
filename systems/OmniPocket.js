/**
 * systems/OmniPocket.js — ⟐mniPocket
 *
 * The spatial bookmark and personal dimension manager of the ⟐mniReality.
 * Three distinct superpowers, one unified panel.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Panel
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   Anchored bottom-left, above the Dock — the one corner not yet claimed.
 *   Symmetric with OmniPresenter (bottom-right).
 *   (bottom: DOCK_H, left: 0, width: PANEL_W, height: PANEL_H)
 *   Slides in from the left.
 *
 *   Opens via:
 *     window.dispatchEvent(new CustomEvent('omni:system-toggle', {
 *       detail: { system: 'omnipocket' }
 *     }))
 *   Or directly: omniPocket.open() / close() / toggle()
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * EXTRACT — pull a node out of the active scene
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   Selecting a node in the scene and pressing Extract (or clicking Extract in
 *   the pocket panel while a node is selected) hides that node's mesh from the
 *   Three.js scene. The node data is stored in the pocket registry.
 *
 *   The node is NOT deleted — it still exists in OmniNode's registry, but its
 *   mesh is invisible and unselectable. The pocket entry shows its label,
 *   geometry type, and a Reinstate button.
 *
 *   Reinstate restores mesh visibility and removes it from the pocket.
 *
 *   Visual effect: on extract, a GSAP implosion (scale → 0, opacity → 0) then
 *   the mesh goes invisible. On reinstate, mesh appears with elastic pop-in.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SHORTCUT — teleport camera to any pocket node
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   Any node in the pocket can be reached instantly regardless of where the
 *   camera currently is. Camera fly-to uses the same GSAP pattern as
 *   OmniPresenter — offset behind and above target, lookAt() per frame.
 *
 *   Shortcuts work even for extracted nodes (invisible but still positioned).
 *   Orbit controls suspended during flight via omni:orbit-disable/enable.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ATTACH — camera-following floating panel
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   When any system panel dispatches omni:panel-attached { id }, OmniPocket
 *   takes ownership. It:
 *
 *   1. Registers the panel element in its attach registry.
 *   2. Creates a THREE.Object3D anchor parented to the camera, positioned
 *      slightly to the right and in front of the camera eye.
 *   3. Every frame (update()), projects the anchor's world position to NDC
 *      then to screen pixels, and sets the panel element's left/top via GSAP.
 *   4. The panel floats in world-space perspective — it moves as the camera
 *      rotates, staying anchored to the view rather than the viewport.
 *
 *   Detach: clicking the ⟐ button again on the attached panel fires
 *   omni:panel-detached { id }, removing it from the attach registry and
 *   disposing the camera anchor.
 *
 *   Multiple panels can be attached simultaneously. Each gets its own anchor
 *   Object3D with a slight offset so they don't stack.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Panel layout
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   ┌─────────────────────────────────────────┐
 *   │  [✕][_][⟐]         ⟐mniPocket          │  38px header
 *   ├─────────────────────────────────────────┤
 *   │  [Extract]  [Shortcuts]  [Attached]     │  32px tab bar
 *   ├─────────────────────────────────────────┤
 *   │                                         │
 *   │   Tab content area (scrollable)         │  ~240px
 *   │                                         │
 *   ├─────────────────────────────────────────┤
 *   │  Selected: Node Label            [Extr] │  34px action strip
 *   ├─────────────────────────────────────────┤
 *   │  ⟐mniPocket   n extracted               │  26px footer
 *   └─────────────────────────────────────────┘
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Events dispatched (window)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   omni:node-extracted   { id, node }        — node hidden from scene
 *   omni:node-reinstated  { id, node }        — node visible again
 *   omni:pocket-shortcut  { id, node }        — camera fly-to completed
 *   omni:orbit-disable    {}                  — freeze orbit during fly
 *   omni:orbit-enable     {}                  — restore orbit after fly
 *
 * Events consumed (window)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   omni:system-toggle    { system: 'omnipocket' }
 *   omni:node-selected    { node, mesh }        — track active selection
 *   omni:node-deselected  {}                    — clear selection
 *   omni:node-deleted     { id }                — prune from pocket
 *   omni:nodes-updated    { nodes, edges }      — sync node map
 *   omni:panel-attached   { id }                — take ownership of panel
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Persistence — localStorage: 'omni:pocket'
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   { extracted: [{ id, node }], shortcuts: ['id1', 'id2', …] }
 *
 *   Mesh visibility is reconciled with OmniNode's scene on restore.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Usage in main.js
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   import OmniPocket from './systems/OmniPocket.js'
 *   const omniPocket = new OmniPocket(base.context)
 *   omniPocket.init()
 *   // In the render loop:
 *   omniPocket.update(delta)   // drives camera-attach billboard repositioning
 *
 * Follows the standard module contract (constructor / init / update / destroy).
 */

import * as THREE from 'three'
import gsap       from 'gsap'

// ── Layout constants ──────────────────────────────────────────────────────────

const DOCK_H    = 52    // px — Dock height
const PANEL_W   = 340   // px — panel width
const PANEL_H   = 380   // px — panel height
const SLIDE_DUR = 0.30  // s
const GLITCH_DUR = 0.20 // s

// ── Camera fly-to (mirrors OmniPresenter) ─────────────────────────────────────

const FLY_SPEED    = 1.2   // s
const FLY_EASE     = 'power2.inOut'
const FLY_BACK     = 4.0   // world units — offset behind node
const FLY_UP       = 2.0   // world units — offset above node

// ── Camera attach — anchor offsets per slot ───────────────────────────────────
// Each attached panel gets an anchor Object3D parented to the camera.
// Slots are staggered so multiple panels don't overlap.

const ATTACH_BASE = { x:  0.9, y:  0.1, z: -2.2 }  // right-forward of camera
const ATTACH_STEP = { x:  0.0, y: -0.5, z:  0.0 }  // each additional panel shifts down

// ── Primitive colours (mirrors OmniNode) ──────────────────────────────────────

const PRIM_COLORS = {
  objective  : '#ffffff',
  subjective : '#88aaff',
  undefined  : '#888888',
  false      : '#333333',
}

// ── Storage key ───────────────────────────────────────────────────────────────

const STORE_KEY = 'omni:pocket'

// ── Tab IDs ───────────────────────────────────────────────────────────────────

const TABS = ['extract', 'shortcuts', 'attached']

// ── Stylesheet ────────────────────────────────────────────────────────────────

const STYLES = /* css */`

/* ── Pocket panel root ────────────────────────────────────────────────────── */

.opk-panel {
  --opk-bg           : rgba(6, 6, 10, 0.93);
  --opk-border       : rgba(255, 255, 255, 0.09);
  --opk-sep          : rgba(255, 255, 255, 0.05);
  --opk-header-bg    : rgba(255, 255, 255, 0.03);
  --opk-text         : rgba(255, 255, 255, 0.82);
  --opk-text-dim     : rgba(255, 255, 255, 0.38);
  --opk-text-muted   : rgba(255, 255, 255, 0.18);
  --opk-accent       : rgba(255, 255, 255, 0.96);
  --opk-ctrl-hover   : rgba(255, 255, 255, 0.08);
  --opk-ctrl-active  : rgba(255, 255, 255, 0.16);
  --opk-input-bg     : rgba(255, 255, 255, 0.04);
  --opk-input-border : rgba(255, 255, 255, 0.10);
  --opk-focus-border : rgba(255, 255, 255, 0.30);
  --opk-extract-color: rgba(255, 140, 60,  0.80);
  --opk-short-color  : rgba(100, 220, 255, 0.80);
  --opk-attach-color : rgba(180, 120, 255, 0.80);
  --mono             : 'Courier New', Courier, monospace;

  position           : fixed;
  bottom             : ${DOCK_H}px;
  left               : 0;
  width              : ${PANEL_W}px;
  height             : ${PANEL_H}px;

  display            : flex;
  flex-direction     : column;

  background         : var(--opk-bg);
  backdrop-filter    : blur(24px) saturate(1.6);
  -webkit-backdrop-filter: blur(24px) saturate(1.6);
  border-top         : 1px solid var(--opk-border);
  border-right       : 1px solid var(--opk-border);
  border-bottom      : none;
  border-left        : none;
  border-radius      : 0 10px 0 0;

  font-family        : var(--mono);
  color              : var(--opk-text);
  font-size          : 10px;
  z-index            : 46;
  pointer-events     : auto;
  user-select        : none;
  overflow           : hidden;
  -webkit-font-smoothing: antialiased;

  visibility         : hidden;
}

/* ── Header ───────────────────────────────────────────────────────────────── */

.opk-header {
  flex-shrink        : 0;
  display            : flex;
  align-items        : center;
  padding            : 0 14px 0 10px;
  height             : 38px;
  background         : var(--opk-header-bg);
  border-bottom      : 1px solid var(--opk-sep);
  gap                : 8px;
}

.opk-controls {
  display            : flex;
  align-items        : center;
  gap                : 3px;
  flex-shrink        : 0;
}

.opk-ctrl {
  width              : 26px;
  height             : 26px;
  display            : flex;
  align-items        : center;
  justify-content    : center;
  background         : none;
  border             : 1px solid rgba(255,255,255,0.08);
  border-radius      : 5px;
  font-family        : var(--mono);
  font-size          : 11px;
  color              : var(--opk-text-dim);
  cursor             : pointer;
  transition         : background 0.12s, color 0.12s, border-color 0.12s;
}
.opk-ctrl:hover   { background: var(--opk-ctrl-hover); color: var(--opk-accent); border-color: rgba(255,255,255,0.18); }
.opk-ctrl:active  { background: var(--opk-ctrl-active); }
.opk-ctrl--close:hover {
  background    : rgba(255, 80, 80, 0.14);
  border-color  : rgba(255, 80, 80, 0.28);
  color         : rgba(255, 150, 150, 0.90);
}

.opk-title {
  flex               : 1 1 auto;
  font-size          : 10px;
  color              : var(--opk-accent);
  letter-spacing     : 0.12em;
  text-transform     : uppercase;
  text-align         : right;
}

/* ── Tab bar ──────────────────────────────────────────────────────────────── */

.opk-tabs {
  flex-shrink        : 0;
  display            : flex;
  border-bottom      : 1px solid var(--opk-sep);
}

.opk-tab {
  flex               : 1;
  height             : 32px;
  display            : flex;
  align-items        : center;
  justify-content    : center;
  gap                : 5px;
  background         : none;
  border             : none;
  border-bottom      : 2px solid transparent;
  font-family        : var(--mono);
  font-size          : 8px;
  color              : var(--opk-text-muted);
  cursor             : pointer;
  letter-spacing     : 0.12em;
  text-transform     : uppercase;
  transition         : color 0.12s, border-color 0.12s, background 0.12s;
}
.opk-tab:hover { background: rgba(255,255,255,0.03); color: var(--opk-text-dim); }

.opk-tab.is-active[data-tab="extract"]  {
  color         : var(--opk-extract-color);
  border-color  : var(--opk-extract-color);
}
.opk-tab.is-active[data-tab="shortcuts"] {
  color         : var(--opk-short-color);
  border-color  : var(--opk-short-color);
}
.opk-tab.is-active[data-tab="attached"] {
  color         : var(--opk-attach-color);
  border-color  : var(--opk-attach-color);
}

.opk-tab-badge {
  min-width          : 14px;
  height             : 14px;
  padding            : 0 3px;
  display            : flex;
  align-items        : center;
  justify-content    : center;
  background         : rgba(255,255,255,0.06);
  border-radius      : 7px;
  font-size          : 7px;
  color              : var(--opk-text-muted);
}

/* ── Tab content pane ─────────────────────────────────────────────────────── */

.opk-pane {
  flex               : 1 1 auto;
  overflow-y         : auto;
  overflow-x         : hidden;
  display            : none;
  flex-direction     : column;

  scrollbar-width    : thin;
  scrollbar-color    : rgba(255,255,255,0.06) transparent;
}
.opk-pane::-webkit-scrollbar       { width: 3px; }
.opk-pane::-webkit-scrollbar-track { background: transparent; }
.opk-pane::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.06); border-radius: 2px; }
.opk-pane.is-active { display: flex; }

/* Empty state inside panes */
.opk-pane-empty {
  display            : flex;
  flex-direction     : column;
  align-items        : center;
  justify-content    : center;
  gap                : 8px;
  padding            : 28px 16px;
  color              : var(--opk-text-muted);
  font-size          : 9px;
  letter-spacing     : 0.10em;
  text-align         : center;
  flex               : 1;
}
.opk-pane-empty-glyph { font-size: 20px; opacity: 0.18; display: block; }

/* ── Generic pocket item row ──────────────────────────────────────────────── */

.opk-item {
  display            : flex;
  align-items        : center;
  gap                : 8px;
  padding            : 7px 12px;
  border-bottom      : 1px solid var(--opk-sep);
  transition         : background 0.10s;
}
.opk-item:hover { background: rgba(255,255,255,0.03); }

.opk-item-dot {
  width              : 6px;
  height             : 6px;
  border-radius      : 50%;
  flex-shrink        : 0;
  border             : 1px solid rgba(255,255,255,0.15);
}

.opk-item-info {
  flex               : 1 1 auto;
  min-width          : 0;
}

.opk-item-name {
  font-size          : 9px;
  color              : var(--opk-text);
  white-space        : nowrap;
  overflow           : hidden;
  text-overflow      : ellipsis;
  letter-spacing     : 0.04em;
}

.opk-item-sub {
  font-size          : 7px;
  color              : var(--opk-text-muted);
  letter-spacing     : 0.06em;
}

/* Row action buttons */
.opk-item-actions {
  display            : flex;
  gap                : 4px;
  flex-shrink        : 0;
}

.opk-item-btn {
  height             : 20px;
  padding            : 0 6px;
  display            : flex;
  align-items        : center;
  background         : rgba(255,255,255,0.04);
  border             : 1px solid rgba(255,255,255,0.08);
  border-radius      : 3px;
  font-family        : var(--mono);
  font-size          : 7px;
  color              : var(--opk-text-muted);
  cursor             : pointer;
  letter-spacing     : 0.06em;
  text-transform     : uppercase;
  white-space        : nowrap;
  transition         : background 0.10s, color 0.10s, border-color 0.10s;
}
.opk-item-btn:hover { background: rgba(255,255,255,0.09); color: var(--opk-accent); border-color: rgba(255,255,255,0.18); }

.opk-item-btn--reinstate:hover {
  background    : rgba(100, 255, 160, 0.10);
  border-color  : rgba(100, 255, 160, 0.25);
  color         : rgba(100, 255, 160, 0.85);
}
.opk-item-btn--fly:hover {
  background    : rgba(100, 220, 255, 0.10);
  border-color  : rgba(100, 220, 255, 0.25);
  color         : rgba(100, 220, 255, 0.85);
}
.opk-item-btn--detach:hover {
  background    : rgba(255, 100, 100, 0.10);
  border-color  : rgba(255, 100, 100, 0.22);
  color         : rgba(255, 150, 150, 0.80);
}
.opk-item-btn--rm:hover {
  background    : rgba(255, 80, 80, 0.10);
  border-color  : rgba(255, 80, 80, 0.20);
  color         : rgba(255, 150, 150, 0.75);
}

/* ── Action strip — selected node ─────────────────────────────────────────── */

.opk-action-strip {
  flex-shrink        : 0;
  display            : flex;
  align-items        : center;
  gap                : 8px;
  padding            : 0 12px;
  height             : 34px;
  border-top         : 1px solid var(--opk-sep);
  background         : rgba(255,255,255,0.01);
}

.opk-sel-dot {
  width              : 6px;
  height             : 6px;
  border-radius      : 50%;
  flex-shrink        : 0;
  background         : rgba(255,255,255,0.20);
  border             : 1px solid rgba(255,255,255,0.10);
  transition         : background 0.15s;
}

.opk-sel-label {
  flex               : 1 1 auto;
  font-size          : 9px;
  color              : var(--opk-text-dim);
  white-space        : nowrap;
  overflow           : hidden;
  text-overflow      : ellipsis;
  letter-spacing     : 0.04em;
}

.opk-extract-btn {
  flex-shrink        : 0;
  height             : 24px;
  padding            : 0 10px;
  background         : rgba(255, 140, 60, 0.10);
  border             : 1px solid rgba(255, 140, 60, 0.22);
  border-radius      : 4px;
  font-family        : var(--mono);
  font-size          : 8px;
  color              : var(--opk-extract-color);
  cursor             : pointer;
  letter-spacing     : 0.08em;
  text-transform     : uppercase;
  transition         : background 0.10s, border-color 0.10s;
}
.opk-extract-btn:hover { background: rgba(255,140,60,0.18); border-color: rgba(255,140,60,0.38); }
.opk-extract-btn:disabled { opacity: 0.30; pointer-events: none; }

.opk-shortcut-btn {
  flex-shrink        : 0;
  height             : 24px;
  padding            : 0 10px;
  background         : rgba(100, 220, 255, 0.08);
  border             : 1px solid rgba(100, 220, 255, 0.18);
  border-radius      : 4px;
  font-family        : var(--mono);
  font-size          : 8px;
  color              : var(--opk-short-color);
  cursor             : pointer;
  letter-spacing     : 0.08em;
  text-transform     : uppercase;
  transition         : background 0.10s, border-color 0.10s;
}
.opk-shortcut-btn:hover { background: rgba(100,220,255,0.14); border-color: rgba(100,220,255,0.32); }
.opk-shortcut-btn:disabled { opacity: 0.30; pointer-events: none; }

/* ── Footer ───────────────────────────────────────────────────────────────── */

.opk-footer {
  flex-shrink        : 0;
  height             : 26px;
  padding            : 0 12px;
  display            : flex;
  align-items        : center;
  border-top         : 1px solid var(--opk-sep);
  gap                : 8px;
}

.opk-footer-badge {
  font-size          : 8px;
  color              : var(--opk-text-muted);
  text-transform     : uppercase;
  letter-spacing     : 0.10em;
}

.opk-footer-counts {
  margin-left        : auto;
  font-size          : 8px;
  color              : var(--opk-text-muted);
  letter-spacing     : 0.04em;
}

/* ── Glitch scan line ─────────────────────────────────────────────────────── */

.opk-glitch-line {
  position           : absolute;
  left               : 0;
  width              : 100%;
  height             : 2px;
  background         : rgba(255,255,255,0.30);
  pointer-events     : none;
  z-index            : 10;
  opacity            : 0;
}

/* ── Attached panel billboard wrapper ─────────────────────────────────────── */
/* Wraps an attached system panel, positioning it in screen-space via JS      */

.opk-attach-wrap {
  position           : fixed;
  z-index            : 55;
  pointer-events     : auto;
  transition         : none;  /* GSAP handles all motion */
}

/* Attachment indicator ribbon on the panel edge */
.opk-attach-ribbon {
  position           : absolute;
  top                : 0;
  left               : 0;
  width              : 3px;
  height             : 100%;
  background         : linear-gradient(
    to bottom,
    rgba(180,120,255,0),
    rgba(180,120,255,0.55),
    rgba(180,120,255,0)
  );
  border-radius      : 2px 0 0 2px;
  pointer-events     : none;
}

/* ── Flying badge (teleport indicator) ───────────────────────────────────── */

.opk-fly-badge {
  display            : none;
  position           : fixed;
  top                : 50%;
  left               : 50%;
  transform          : translate(-50%, -50%);
  padding            : 6px 14px;
  background         : rgba(6, 6, 10, 0.88);
  border             : 1px solid rgba(100, 220, 255, 0.22);
  border-radius      : 6px;
  font-family        : 'Courier New', Courier, monospace;
  font-size          : 9px;
  color              : rgba(100, 220, 255, 0.70);
  letter-spacing     : 0.12em;
  text-transform     : uppercase;
  pointer-events     : none;
  z-index            : 80;
  backdrop-filter    : blur(8px);
}
.opk-fly-badge.is-visible { display: block; }

/* ── Mobile ───────────────────────────────────────────────────────────────── */

@media (max-width: 560px) {
  .opk-panel { width: min(${PANEL_W}px, 92vw); height: min(${PANEL_H}px, 58vh); }
}

`

// ── Style injection ───────────────────────────────────────────────────────────

function injectStyles () {
  if (document.getElementById('omni-pocket-styles')) return
  const tag = document.createElement('style')
  tag.id          = 'omni-pocket-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

// ── Glitch helper ─────────────────────────────────────────────────────────────

function glitch (el) {
  return new Promise(resolve => {
    const line = el.querySelector('.opk-glitch-line')
    const tl   = gsap.timeline({ onComplete: resolve })
    tl.to(el, { x: -3, duration: 0.028, ease: 'none' })
      .to(el, { x:  4, duration: 0.024, ease: 'none' })
      .to(el, { x: -2, opacity: 0.72, duration: 0.020, ease: 'none' })
      .to(el, { x:  0, opacity: 1,    duration: 0.028, ease: 'power1.out' })
    if (line) {
      gsap.fromTo(line,
        { top: '-2px', opacity: 0.80 },
        { top: '100%', opacity: 0,    duration: GLITCH_DUR, ease: 'power1.in' }
      )
    }
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// OmniPocket class
// ─────────────────────────────────────────────────────────────────────────────

export default class OmniPocket {

  /**
   * @param {object} context  — { scene, camera, renderer, sizes, ticker, Sound? }
   */
  constructor (context) {
    this.ctx = context

    // ── Panel state ────────────────────────────────────────────────────
    this._el       = null
    this._flyBadge = null
    this._isOpen   = false
    this._activeTab = 'extract'

    // ── Selected node (from omni:node-selected) ────────────────────────
    this._selected     = null   // { node, mesh }

    // ── EXTRACT registry ───────────────────────────────────────────────
    // Map<id, { node, meshRef: WeakRef<THREE.Object3D>? }>
    this._extracted    = new Map()

    // ── SHORTCUT registry ──────────────────────────────────────────────
    // Map<id, node>  — all nodes the user has bookmarked
    this._shortcuts    = new Map()

    // ── ATTACH registry ────────────────────────────────────────────────
    // Map<panelId, { el: HTMLElement, anchor: THREE.Object3D, wrap: HTMLElement, ribbon: HTMLElement }>
    this._attached     = new Map()

    // ── Shared node map (shadow of OmniNode storage) ───────────────────
    this._nodeMap      = new Map()

    // ── Camera fly state ───────────────────────────────────────────────
    this._flying       = false
    this._flyTween     = null

    // ── Scratch Vector3 for billboard projection ───────────────────────
    this._projVec      = new THREE.Vector3()

    // ── Bound handlers ────────────────────────────────────────────────
    this._onToggle     = null
    this._onNodeSel    = null
    this._onNodeDesel  = null
    this._onNodeDel    = null
    this._onNodesUp    = null
    this._onAttached   = null
  }

  // ── Module contract ──────────────────────────────────────────────────────

  init () {
    injectStyles()
    this._buildPanel()
    this._buildFlyBadge()
    this._bindEvents()
    this._refreshNodeMap()
    this._load()
    this._renderActiveTab()
    this._updateActionStrip()
    this._updateFooter()
  }

  /**
   * Called every frame. Repositions all camera-attached panel billboards.
   * @param {number} _delta
   */
  update (_delta) {
    if (this._attached.size === 0) return
    this._repositionAttached()
  }

  destroy () {
    this._stopFly()
    this._el?.parentNode?.removeChild(this._el)
    this._flyBadge?.parentNode?.removeChild(this._flyBadge)

    // Detach all attached panels
    for (const [id] of this._attached) {
      this._detachPanel(id)
    }

    window.removeEventListener('omni:system-toggle', this._onToggle)
    window.removeEventListener('omni:node-selected', this._onNodeSel)
    window.removeEventListener('omni:node-deselected', this._onNodeDesel)
    window.removeEventListener('omni:node-deleted',  this._onNodeDel)
    window.removeEventListener('omni:nodes-updated', this._onNodesUp)
    window.removeEventListener('omni:panel-attached', this._onAttached)
  }

  // ── Public API ───────────────────────────────────────────────────────────

  open () {
    if (this._isOpen) return
    this._isOpen = true
    this._el.style.visibility = 'visible'
    gsap.fromTo(this._el,
      { x: '-100%', opacity: 1 },
      {
        x: '0%', duration: SLIDE_DUR, ease: 'power3.out',
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
    this._playSound('close')
  }

  toggle () { this._isOpen ? this.close() : this.open() }

  // ── Panel DOM ────────────────────────────────────────────────────────────

  _buildPanel () {
    const el = document.createElement('div')
    el.className = 'opk-panel'
    el.id        = 'omni-pocket-panel'

    el.innerHTML = /* html */`
      <div class="opk-glitch-line" aria-hidden="true"></div>

      <!-- Header -->
      <div class="opk-header">
        <div class="opk-controls">
          <button class="opk-ctrl opk-ctrl--close"    data-action="close"    title="✕ Close"        >✕</button>
          <button class="opk-ctrl opk-ctrl--minimize" data-action="minimize" title="_ Minimize"     >_</button>
          <button class="opk-ctrl opk-ctrl--attach"   data-action="attach"   title="⟐ Pocket attach">⟐</button>
        </div>
        <span class="opk-title">⟐mniPocket</span>
      </div>

      <!-- Tab bar -->
      <div class="opk-tabs" role="tablist">
        <button class="opk-tab is-active" data-tab="extract"   role="tab" title="Extracted nodes">
          ⊖ Extract
          <span class="opk-tab-badge" id="opk-badge-extract">0</span>
        </button>
        <button class="opk-tab"          data-tab="shortcuts"  role="tab" title="Teleport shortcuts">
          ⟐ Shortcuts
          <span class="opk-tab-badge" id="opk-badge-shortcuts">0</span>
        </button>
        <button class="opk-tab"          data-tab="attached"   role="tab" title="Camera-attached panels">
          ⌂ Attached
          <span class="opk-tab-badge" id="opk-badge-attached">0</span>
        </button>
      </div>

      <!-- Tab panes — one per tab, only active pane is visible -->
      <div class="opk-pane is-active" id="opk-pane-extract"   role="tabpanel"></div>
      <div class="opk-pane"           id="opk-pane-shortcuts"  role="tabpanel"></div>
      <div class="opk-pane"           id="opk-pane-attached"   role="tabpanel"></div>

      <!-- Action strip — selected node context -->
      <div class="opk-action-strip">
        <span class="opk-sel-dot"  id="opk-sel-dot"></span>
        <span class="opk-sel-label" id="opk-sel-label">No node selected</span>
        <button class="opk-shortcut-btn" id="opk-shortcut-btn" disabled title="Bookmark selected node as shortcut">⟐ Shortcut</button>
        <button class="opk-extract-btn" id="opk-extract-btn"  disabled title="Extract selected node from scene">⊖ Extract</button>
      </div>

      <!-- Footer -->
      <div class="opk-footer">
        <span class="opk-footer-badge">⟐mniPocket</span>
        <span class="opk-footer-counts" id="opk-footer-counts">0 extracted · 0 shortcuts · 0 attached</span>
      </div>
    `

    gsap.set(el, { x: '-100%' })
    this._el = el

    const shell = document.getElementById('omni-ui') ?? document.body
    shell.appendChild(el)

    this._bindPanelControls()
  }

  _buildFlyBadge () {
    const el = document.createElement('div')
    el.className = 'opk-fly-badge'
    el.id        = 'opk-fly-badge'
    const shell = document.getElementById('omni-ui') ?? document.body
    shell.appendChild(el)
    this._flyBadge = el
  }

  // ── Panel controls ────────────────────────────────────────────────────────

  _bindPanelControls () {
    const el = this._el

    // Header ✕ _ ⟐
    el.querySelector('.opk-controls').addEventListener('click', (e) => {
      const btn = e.target.closest('.opk-ctrl')
      if (!btn) return
      this._playSound('click')
      switch (btn.dataset.action) {
        case 'close':    this.close();     break
        case 'minimize': this._minimize(); break
        case 'attach':   this._selfAttach(); break
      }
    })

    // Tab switching
    el.querySelector('.opk-tabs').addEventListener('click', (e) => {
      const tab = e.target.closest('.opk-tab')
      if (!tab) return
      this._switchTab(tab.dataset.tab)
      this._playSound('click')
    })

    // Extract button (action strip)
    el.querySelector('#opk-extract-btn').addEventListener('click', () => {
      if (this._selected) {
        this._extractNode(this._selected.node, this._selected.mesh)
        this._playSound('click')
      }
    })

    // Shortcut button (action strip)
    el.querySelector('#opk-shortcut-btn').addEventListener('click', () => {
      if (this._selected) {
        this._addShortcut(this._selected.node)
        this._playSound('click')
      }
    })
  }

  // ── Tab rendering ─────────────────────────────────────────────────────────

  _switchTab (tabId) {
    if (!TABS.includes(tabId)) return
    this._activeTab = tabId

    // Toggle tab button active state
    this._el.querySelectorAll('.opk-tab').forEach(btn => {
      btn.classList.toggle('is-active', btn.dataset.tab === tabId)
    })

    // Toggle pane visibility
    TABS.forEach(id => {
      const pane = this._el.querySelector(`#opk-pane-${id}`)
      pane?.classList.toggle('is-active', id === tabId)
    })

    this._renderActiveTab()
  }

  _renderActiveTab () {
    switch (this._activeTab) {
      case 'extract':   this._renderExtractTab();   break
      case 'shortcuts': this._renderShortcutsTab(); break
      case 'attached':  this._renderAttachedTab();  break
    }
  }

  // ── EXTRACT tab ───────────────────────────────────────────────────────────

  _renderExtractTab () {
    const pane = this._el?.querySelector('#opk-pane-extract')
    if (!pane) return

    if (this._extracted.size === 0) {
      pane.innerHTML = /* html */`
        <div class="opk-pane-empty">
          <span class="opk-pane-empty-glyph">⊖</span>
          <span>No nodes extracted.</span>
          <span style="font-size:8px;opacity:0.7">Select a node, then press<br>⊖ Extract to remove it from the scene.</span>
        </div>
      `
      return
    }

    pane.innerHTML = [...this._extracted.values()].map(entry => {
      const { node } = entry
      const dotColor = PRIM_COLORS[node.primitive] ?? '#888'
      const geoShort = (node.geometry ?? '').replace('Geometry', '')
      return /* html */`
        <div class="opk-item" data-item-id="${node.id}">
          <span class="opk-item-dot"
                style="background:${dotColor};border-color:${dotColor}40"></span>
          <div class="opk-item-info">
            <div class="opk-item-name">${node.label ?? node.id}</div>
            <div class="opk-item-sub">${geoShort} · extracted</div>
          </div>
          <div class="opk-item-actions">
            <button class="opk-item-btn opk-item-btn--fly"
                    data-action="fly" data-node-id="${node.id}"
                    title="Fly camera to this node's position">⟐ Go</button>
            <button class="opk-item-btn opk-item-btn--reinstate"
                    data-action="reinstate" data-node-id="${node.id}"
                    title="Reinstate node into scene">↑ Back</button>
            <button class="opk-item-btn opk-item-btn--rm"
                    data-action="remove-extract" data-node-id="${node.id}"
                    title="Remove from pocket (node stays hidden)">✕</button>
          </div>
        </div>
      `
    }).join('')

    this._bindItemActions(pane)
  }

  // ── SHORTCUTS tab ─────────────────────────────────────────────────────────

  _renderShortcutsTab () {
    const pane = this._el?.querySelector('#opk-pane-shortcuts')
    if (!pane) return

    if (this._shortcuts.size === 0) {
      pane.innerHTML = /* html */`
        <div class="opk-pane-empty">
          <span class="opk-pane-empty-glyph">⟐</span>
          <span>No shortcuts registered.</span>
          <span style="font-size:8px;opacity:0.7">Select a node, then press<br>⟐ Shortcut to bookmark it.</span>
        </div>
      `
      return
    }

    pane.innerHTML = [...this._shortcuts.values()].map(node => {
      const dotColor = PRIM_COLORS[node.primitive] ?? '#888'
      const geoShort = (node.geometry ?? '').replace('Geometry', '')
      const pos      = node.position
        ? `${node.position[0].toFixed(1)}, ${node.position[1].toFixed(1)}, ${node.position[2].toFixed(1)}`
        : '—'
      return /* html */`
        <div class="opk-item" data-item-id="${node.id}">
          <span class="opk-item-dot"
                style="background:${dotColor};border-color:${dotColor}40"></span>
          <div class="opk-item-info">
            <div class="opk-item-name">${node.label ?? node.id}</div>
            <div class="opk-item-sub">${geoShort} · (${pos})</div>
          </div>
          <div class="opk-item-actions">
            <button class="opk-item-btn opk-item-btn--fly"
                    data-action="fly" data-node-id="${node.id}"
                    title="Teleport camera to this node">⟐ Go</button>
            <button class="opk-item-btn opk-item-btn--rm"
                    data-action="remove-shortcut" data-node-id="${node.id}"
                    title="Remove shortcut">✕</button>
          </div>
        </div>
      `
    }).join('')

    this._bindItemActions(pane)
  }

  // ── ATTACHED tab ──────────────────────────────────────────────────────────

  _renderAttachedTab () {
    const pane = this._el?.querySelector('#opk-pane-attached')
    if (!pane) return

    if (this._attached.size === 0) {
      pane.innerHTML = /* html */`
        <div class="opk-pane-empty">
          <span class="opk-pane-empty-glyph">⌂</span>
          <span>No panels attached.</span>
          <span style="font-size:8px;opacity:0.7">Click ⟐ on any system panel to attach it<br>to your camera view.</span>
        </div>
      `
      return
    }

    pane.innerHTML = [...this._attached.entries()].map(([panelId, entry]) => {
      const name = panelId.charAt(0).toUpperCase() + panelId.slice(1)
      return /* html */`
        <div class="opk-item" data-item-id="${panelId}">
          <span class="opk-item-dot"
                style="background:rgba(180,120,255,0.70);border-color:rgba(180,120,255,0.25)"></span>
          <div class="opk-item-info">
            <div class="opk-item-name">${name}</div>
            <div class="opk-item-sub">Camera-attached · follows view</div>
          </div>
          <div class="opk-item-actions">
            <button class="opk-item-btn opk-item-btn--detach"
                    data-action="detach" data-panel-id="${panelId}"
                    title="Detach panel from camera">⌂ Detach</button>
          </div>
        </div>
      `
    }).join('')

    this._bindItemActions(pane)
  }

  // ── Pane item action delegation ───────────────────────────────────────────

  _bindItemActions (pane) {
    pane.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]')
      if (!btn) return
      const action   = btn.dataset.action
      const nodeId   = btn.dataset.nodeId
      const panelId  = btn.dataset.panelId

      switch (action) {
        case 'fly':
          if (nodeId) this._shortcutFly(nodeId)
          break
        case 'reinstate':
          if (nodeId) this._reinstateNode(nodeId)
          break
        case 'remove-extract':
          if (nodeId) {
            this._extracted.delete(nodeId)
            this._save()
            this._renderExtractTab()
            this._updateBadges()
            this._updateFooter()
          }
          break
        case 'remove-shortcut':
          if (nodeId) {
            this._shortcuts.delete(nodeId)
            this._save()
            this._renderShortcutsTab()
            this._updateBadges()
            this._updateFooter()
          }
          break
        case 'detach':
          if (panelId) {
            this._detachPanel(panelId)
            this._renderAttachedTab()
            this._updateBadges()
            this._updateFooter()
          }
          break
      }
      this._playSound('click')
    })
  }

  // ── EXTRACT ───────────────────────────────────────────────────────────────

  /**
   * Extract a node — hides its mesh, stores in pocket.
   * @param {object} node
   * @param {THREE.Object3D} mesh
   */
  _extractNode (node, mesh) {
    if (this._extracted.has(node.id)) return   // already extracted

    // GSAP implosion on the mesh
    if (mesh) {
      gsap.to(mesh.scale, {
        x: 0, y: 0, z: 0,
        duration: 0.30, ease: 'back.in(2)',
        onComplete: () => {
          mesh.visible = false
        }
      })
    }

    this._extracted.set(node.id, { node: { ...node }, meshRef: mesh ?? null })

    this._save()
    this._renderExtractTab()
    this._updateBadges()
    this._updateFooter()
    this._updateActionStrip()

    if (this._activeTab !== 'extract') this._switchTab('extract')

    window.dispatchEvent(new CustomEvent('omni:node-extracted', {
      detail: { id: node.id, node }
    }))
  }

  /**
   * Reinstate a previously extracted node — makes its mesh visible again.
   * @param {string} id
   */
  _reinstateNode (id) {
    const entry = this._extracted.get(id)
    if (!entry) return

    const mesh = entry.meshRef

    if (mesh) {
      mesh.visible = true
      mesh.scale.set(0, 0, 0)
      gsap.to(mesh.scale, {
        x: 1, y: 1, z: 1,
        duration: 0.40, ease: 'elastic.out(1, 0.55)'
      })
    }

    this._extracted.delete(id)
    this._save()
    this._renderExtractTab()
    this._updateBadges()
    this._updateFooter()

    window.dispatchEvent(new CustomEvent('omni:node-reinstated', {
      detail: { id, node: entry.node }
    }))
  }

  // ── SHORTCUT ──────────────────────────────────────────────────────────────

  /**
   * Register a node as a shortcut bookmark.
   * @param {object} node
   */
  _addShortcut (node) {
    if (this._shortcuts.has(node.id)) {
      // Already registered — flash feedback on tab badge
      const badge = this._el.querySelector('#opk-badge-shortcuts')
      if (badge) {
        gsap.fromTo(badge, { scale: 1.4 }, { scale: 1, duration: 0.30, ease: 'elastic.out(1,0.5)' })
      }
      return
    }

    this._shortcuts.set(node.id, { ...node })
    this._save()
    this._renderShortcutsTab()
    this._updateBadges()
    this._updateFooter()

    if (this._activeTab !== 'shortcuts') this._switchTab('shortcuts')
  }

  /**
   * Fly the camera to a node's world position.
   * Works for both shortcut and extracted nodes.
   * @param {string} id
   */
  _shortcutFly (id) {
    if (this._flying) return

    // Resolve node from shortcut map or extracted map
    const node =
      this._shortcuts.get(id)?.id ? this._shortcuts.get(id) :
      this._extracted.get(id)?.node ?? null

    if (!node?.position) {
      console.warn('⟐mniPocket: node has no position data —', id)
      return
    }

    const [nx, ny, nz] = node.position
    const target = new THREE.Vector3(nx, ny, nz)

    const cam = this.ctx.camera
    const dir = new THREE.Vector3().subVectors(cam.position, target).normalize()
    const dest = target.clone().add(new THREE.Vector3(
      dir.x * FLY_BACK,
      FLY_UP,
      dir.z * FLY_BACK,
    ))

    this._flying = true
    this._disableOrbit()
    this._showFlyBadge(true, node.label ?? id)

    this._flyTween = gsap.to(cam.position, {
      x: dest.x, y: dest.y, z: dest.z,
      duration  : FLY_SPEED,
      ease      : FLY_EASE,
      onUpdate  : () => { cam.lookAt(target) },
      onComplete: () => {
        this._flying = false
        this._showFlyBadge(false)
        this._enableOrbit()
        window.dispatchEvent(new CustomEvent('omni:pocket-shortcut', {
          detail: { id, node }
        }))
      },
    })
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

  _showFlyBadge (visible, label = '') {
    if (!this._flyBadge) return
    if (visible) {
      this._flyBadge.textContent = `⟐  Teleporting to ${label}`
      this._flyBadge.classList.add('is-visible')
      gsap.fromTo(this._flyBadge, { opacity: 0 }, { opacity: 1, duration: 0.14 })
    } else {
      gsap.to(this._flyBadge, {
        opacity: 0, duration: 0.20,
        onComplete: () => this._flyBadge.classList.remove('is-visible')
      })
    }
  }

  _disableOrbit () {
    window.dispatchEvent(new CustomEvent('omni:orbit-disable', { detail: {} }))
  }

  _enableOrbit () {
    window.dispatchEvent(new CustomEvent('omni:orbit-enable', { detail: {} }))
  }

  // ── ATTACH ────────────────────────────────────────────────────────────────

  /**
   * Take ownership of a system panel and attach it to the camera.
   * Called when omni:panel-attached { id } fires.
   *
   * @param {string} panelId  — e.g. 'omninode', 'omniinspector'
   */
  _attachPanel (panelId) {
    if (this._attached.has(panelId)) {
      // Already attached — detach instead (toggle)
      this._detachPanel(panelId)
      return
    }

    // Find the panel element by its known ID convention
    const el = document.getElementById(`omni-${panelId}-panel`)
    if (!el) {
      console.warn('⟐mniPocket: cannot find panel element for', panelId)
      return
    }

    // Slot index determines the camera anchor offset
    const slotIdx = this._attached.size

    // Create a Three.js anchor Object3D parented to the camera
    const anchor = new THREE.Object3D()
    anchor.position.set(
      ATTACH_BASE.x + ATTACH_STEP.x * slotIdx,
      ATTACH_BASE.y + ATTACH_STEP.y * slotIdx,
      ATTACH_BASE.z + ATTACH_STEP.z * slotIdx,
    )
    this.ctx.camera.add(anchor)

    // Wrap the panel element so we can add the attachment ribbon
    // without mutating the panel's own DOM structure
    const wrap = document.createElement('div')
    wrap.className = 'opk-attach-wrap'
    wrap.id        = `opk-wrap-${panelId}`
    const ribbon = document.createElement('div')
    ribbon.className = 'opk-attach-ribbon'

    // Re-parent panel el into the wrap
    el.parentNode?.insertBefore(wrap, el)
    wrap.appendChild(el)
    wrap.appendChild(ribbon)

    // Ensure panel is visible
    el.style.visibility = 'visible'
    gsap.set(el, { x: '0%' })

    this._attached.set(panelId, { el, anchor, wrap, ribbon })

    // Run initial position
    this._repositionSingle(panelId)

    // Animate ribbon in
    gsap.fromTo(ribbon, { opacity: 0 }, { opacity: 1, duration: 0.35 })

    this._renderAttachedTab()
    this._updateBadges()
    this._updateFooter()

    if (this._activeTab !== 'attached') this._switchTab('attached')
  }

  /**
   * Detach a panel from the camera — restore it to its original DOM parent.
   * @param {string} panelId
   */
  _detachPanel (panelId) {
    const entry = this._attached.get(panelId)
    if (!entry) return

    const { el, anchor, wrap, ribbon } = entry

    // Remove camera anchor from Three.js
    this.ctx.camera.remove(anchor)

    // Un-wrap: move panel el back to #omni-ui
    const shell = document.getElementById('omni-ui') ?? document.body
    wrap.parentNode?.insertBefore(el, wrap)
    wrap.parentNode?.removeChild(wrap)
    shell.appendChild(el)

    // Reset panel position to its default off-screen state (let the panel
    // system handle reopening via omni:panel-restore)
    el.style.visibility = 'hidden'
    gsap.set(el, { left: '', top: '', position: '', x: '-100%' })

    this._attached.delete(panelId)

    window.dispatchEvent(new CustomEvent('omni:panel-detached', {
      detail: { id: panelId }
    }))
  }

  /**
   * Called every frame via update() — projects all anchor Object3Ds to
   * screen coordinates and repositions their wrapper elements.
   */
  _repositionAttached () {
    const cam      = this.ctx.camera
    const renderer = this.ctx.renderer
    if (!cam || !renderer) return

    const w = renderer.domElement.clientWidth
    const h = renderer.domElement.clientHeight

    for (const [panelId] of this._attached) {
      this._repositionSingle(panelId, cam, w, h)
    }
  }

  _repositionSingle (panelId, cam, w, h) {
    const entry = this._attached.get(panelId)
    if (!entry) return

    cam = cam ?? this.ctx.camera
    const renderer = this.ctx.renderer
    if (!cam || !renderer) return

    w = w ?? renderer.domElement.clientWidth
    h = h ?? renderer.domElement.clientHeight

    const { anchor, wrap } = entry

    // Get the anchor's world position
    anchor.getWorldPosition(this._projVec)

    // Project world → NDC (–1 to +1 on each axis)
    this._projVec.project(cam)

    // Convert NDC to CSS pixel coordinates
    // NDC +1 = right/top, –1 = left/bottom. Y is inverted in CSS.
    const screenX = ( this._projVec.x + 1) * 0.5 * w
    const screenY = (-this._projVec.y + 1) * 0.5 * h

    // If the anchor is behind the camera (z > 1 in NDC), hide
    const behindCamera = this._projVec.z > 1
    wrap.style.display = behindCamera ? 'none' : ''

    if (!behindCamera) {
      // Clamp so the panel stays within viewport with a small margin
      const margin = 8
      const pw = PANEL_W
      const ph = PANEL_H
      const cx = Math.max(margin, Math.min(screenX, w - pw - margin))
      const cy = Math.max(margin, Math.min(screenY, h - ph - margin))

      gsap.set(wrap, { left: cx, top: cy })
    }
  }

  /**
   * Attach the OmniPocket panel itself to the camera (from the ⟐ header button).
   * Delegates to the generic attach flow by fabricating an attach event.
   */
  _selfAttach () {
    this._attachPanel('pocket')
  }

  // ── Action strip update ───────────────────────────────────────────────────

  _updateActionStrip () {
    const dot      = this._el?.querySelector('#opk-sel-dot')
    const label    = this._el?.querySelector('#opk-sel-label')
    const extrBtn  = this._el?.querySelector('#opk-extract-btn')
    const shortBtn = this._el?.querySelector('#opk-shortcut-btn')

    if (!this._selected) {
      if (dot)   { dot.style.background = 'rgba(255,255,255,0.20)'; dot.style.borderColor = '' }
      if (label) label.textContent = 'No node selected'
      extrBtn?.setAttribute('disabled', '')
      shortBtn?.setAttribute('disabled', '')
      return
    }

    const node     = this._selected.node
    const dotColor = PRIM_COLORS[node.primitive] ?? '#888'
    const alreadyExtracted = this._extracted.has(node.id)
    const alreadyShortcut  = this._shortcuts.has(node.id)

    if (dot)   { dot.style.background = dotColor; dot.style.borderColor = dotColor + '40' }
    if (label) label.textContent = node.label ?? node.id

    if (extrBtn) {
      if (alreadyExtracted) {
        extrBtn.textContent = '↑ Reinstate'
        extrBtn.removeAttribute('disabled')
        extrBtn.onclick = () => { this._reinstateNode(node.id); this._playSound('click') }
      } else {
        extrBtn.textContent = '⊖ Extract'
        extrBtn.removeAttribute('disabled')
        extrBtn.onclick = () => {
          this._extractNode(this._selected.node, this._selected.mesh)
          this._playSound('click')
        }
      }
    }

    if (shortBtn) {
      shortBtn.textContent = alreadyShortcut ? '⟐ Bookmarked' : '⟐ Shortcut'
      shortBtn.removeAttribute('disabled')
    }
  }

  // ── Tab badges ────────────────────────────────────────────────────────────

  _updateBadges () {
    const b1 = this._el?.querySelector('#opk-badge-extract')
    const b2 = this._el?.querySelector('#opk-badge-shortcuts')
    const b3 = this._el?.querySelector('#opk-badge-attached')
    if (b1) b1.textContent = this._extracted.size
    if (b2) b2.textContent = this._shortcuts.size
    if (b3) b3.textContent = this._attached.size
  }

  // ── Footer ────────────────────────────────────────────────────────────────

  _updateFooter () {
    const el = this._el?.querySelector('#opk-footer-counts')
    if (el) {
      el.textContent = `${this._extracted.size} extracted · ${this._shortcuts.size} shortcuts · ${this._attached.size} attached`
    }
  }

  // ── Minimize / attach (panel controls) ───────────────────────────────────

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
        id        : 'omnipocket',
        label     : '⟐mniPocket',
        iconLabel : '⟐P',
        fromRect  : { x: rect.left, y: rect.top, w: rect.width, h: rect.height },
      }
    }))
    window.dispatchEvent(new CustomEvent('omni:panel-restore-handler', {
      detail: { id: 'omnipocket', handler: () => this.open() }
    }))
  }

  // ── Event listeners ───────────────────────────────────────────────────────

  _bindEvents () {
    this._onToggle = (e) => {
      if (e.detail?.system !== 'omnipocket') return
      this.toggle()
    }

    // Node selected in scene — update action strip
    this._onNodeSel = (e) => {
      this._selected = e.detail ?? null
      this._updateActionStrip()
    }

    // Node deselected
    this._onNodeDesel = () => {
      this._selected = null
      this._updateActionStrip()
    }

    // Node deleted — remove from any pocket list
    this._onNodeDel = (e) => {
      const id = e.detail?.id
      if (!id) return
      let changed = false
      if (this._extracted.has(id))  { this._extracted.delete(id);  changed = true }
      if (this._shortcuts.has(id))  { this._shortcuts.delete(id);  changed = true }
      if (changed) {
        this._save()
        this._renderActiveTab()
        this._updateBadges()
        this._updateFooter()
      }
    }

    // Nodes updated — refresh node map and any stale labels in shortcut/extract lists
    this._onNodesUp = (e) => {
      const { nodes = [] } = e.detail ?? {}
      this._nodeMap.clear()
      nodes.forEach(n => this._nodeMap.set(n.id, n))

      // Refresh node data in shortcuts and extracted (labels may have changed)
      for (const [id, entry] of this._extracted) {
        const fresh = this._nodeMap.get(id)
        if (fresh) this._extracted.set(id, { ...entry, node: fresh })
      }
      for (const [id, node] of this._shortcuts) {
        const fresh = this._nodeMap.get(id)
        if (fresh) this._shortcuts.set(id, fresh)
      }

      this._renderActiveTab()
    }

    // Panel attach event — OmniPocket takes ownership
    this._onAttached = (e) => {
      const id = e.detail?.id
      if (!id) return
      this._attachPanel(id)
    }

    window.addEventListener('omni:system-toggle', this._onToggle)
    window.addEventListener('omni:node-selected', this._onNodeSel)
    window.addEventListener('omni:node-deselected', this._onNodeDesel)
    window.addEventListener('omni:node-deleted',  this._onNodeDel)
    window.addEventListener('omni:nodes-updated', this._onNodesUp)
    window.addEventListener('omni:panel-attached', this._onAttached)
  }

  // ── Node map bootstrap ────────────────────────────────────────────────────

  _refreshNodeMap () {
    try {
      const raw = localStorage.getItem('omni:nodes')
      if (!raw) return
      JSON.parse(raw).forEach(n => this._nodeMap.set(n.id, n))
    } catch { /* silent */ }
  }

  // ── Persistence ───────────────────────────────────────────────────────────

  _save () {
    try {
      const data = {
        extracted : [...this._extracted.values()].map(e => e.node),
        shortcuts : [...this._shortcuts.values()],
      }
      localStorage.setItem(STORE_KEY, JSON.stringify(data))
    } catch (err) {
      console.warn('⟐mniPocket — localStorage save failed:', err)
    }
  }

  _load () {
    try {
      const raw = localStorage.getItem(STORE_KEY)
      if (!raw) return
      const data = JSON.parse(raw)

      // Restore extracted nodes
      if (Array.isArray(data.extracted)) {
        data.extracted.forEach(node => {
          // meshRef is null on restore — OmniPocket re-hides the mesh by
          // traversing the scene in _reconcileExtracted() after scene loads.
          this._extracted.set(node.id, { node, meshRef: null })
        })
      }

      // Restore shortcuts
      if (Array.isArray(data.shortcuts)) {
        data.shortcuts.forEach(node => {
          this._shortcuts.set(node.id, node)
        })
      }

      // Defer mesh reconciliation until after OmniNode has restored scene objects
      if (this._extracted.size > 0) {
        Promise.resolve().then(() => this._reconcileExtracted())
      }

      this._updateBadges()
      this._updateFooter()

    } catch (err) {
      console.warn('⟐mniPocket — localStorage load failed:', err)
    }
  }

  /**
   * After restore, hide meshes of extracted nodes that OmniNode has rebuilt.
   * Runs as a microtask so OmniNode's _load() has completed first.
   */
  _reconcileExtracted () {
    if (!this.ctx.scene) return
    const extractedIds = new Set(this._extracted.keys())
    if (extractedIds.size === 0) return

    this.ctx.scene.traverse(obj => {
      const id = obj.userData?.nodeId
      if (id && extractedIds.has(id)) {
        obj.visible = false
        // Stash fresh meshRef
        const entry = this._extracted.get(id)
        if (entry) this._extracted.set(id, { ...entry, meshRef: obj })
      }
    })
  }

  // ── Sound ─────────────────────────────────────────────────────────────────

  _playSound (id) {
    try {
      const Sound = this.ctx?.Sound
      if (Sound && typeof Sound.play === 'function') Sound.play(id)
    } catch (_) {}
  }
}
