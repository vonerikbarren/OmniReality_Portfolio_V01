/**
 * ui/TreeView.js — ⟐mniReality Collapsible Logic Tree
 *
 * Owns the ⟐LH panel body slot (`panel-body-lh`). Installs a two-tab
 * controller — GRID (the 5×5 GridPanel) and TREE (the logic tree) — so
 * both components coexist inside the same panel without fighting for space.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Layout inside panel-body-lh  (316 × 292 px content area)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   Tab bar       28 px    GRID · TREE selector + node count badge
 *   ───────────────────
 *   Active pane  264 px    GridPanel  or  Tree view (scrollable)
 *
 *   Tree pane breakdown:
 *     Tree controls  26 px    depth display · expand-all · collapse-all
 *     Separator       1 px
 *     Scrollable     237 px   ~8 rows visible at 28 px / row
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Tree row anatomy
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   [indent: depth×14px] [▶toggle] [●primitive] [label────────] [d.N] [→]
 *
 *   toggle  16 px  ▶ (collapsed) / ▾ (expanded) / · (leaf)
 *   dot     10 px  coloured by node primitive type
 *   label   flex   truncated with ellipsis
 *   depth    28 px  d.0 … d.N badge
 *   teleport 26 px  → button — appears on row hover
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Node primitive → dot colour
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   ⟐objective   white   #ffffff    confirmed, factual
 *   ⟐subjective  colour  per-node   perspectival (uses node.color.hex)
 *   ⟐undefined   gray    #808080    unresolved
 *   ⟐false       near-black #1a1a1a  negated
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Internal node schema (what setTree / addNode accept)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   {
 *     id        : string            unique identifier
 *     label     : string            display name
 *     primitive : '⟐objective' | '⟐subjective' | '⟐undefined' | '⟐false'
 *     parentId  : string | null     null = root
 *     depth     : number            levels from root (auto-computed if omitted)
 *     position  : { x, y, z }      THREE.js world position (optional — for teleport)
 *     color     : { hex: string }   used if primitive === '⟐subjective'
 *   }
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Events consumed (window)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   omni:node-created    →  { node }         add node to tree
 *   omni:node-deleted    →  { id }           remove node; promote children
 *   omni:node-updated    →  { node }         relabel / re-primitive existing node
 *   omni:node-entered    →  { id }           mark as current, scroll into view
 *   omni:portal-activated→  { label, id? }   try to match a node as current
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Events dispatched (window)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   omni:tree-teleport   →  { id, label, position }
 *                            Phase 4 NodeManager responds by moving camera
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Public API
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   tree.init()
 *   tree.destroy()
 *   tree.update(delta)           no per-frame work — noop
 *   tree.setTree(nodeArray)      replace entire tree
 *   tree.addNode(nodeData)       insert one node
 *   tree.removeNode(id)          delete; children promoted to parent
 *   tree.setCurrentNode(id)      highlight + scroll into view
 *   tree.expandAll()
 *   tree.collapseAll()
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ui/index.js integration
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   import TreeView  from './TreeView.js'
 *   import GridPanel from './GridPanel.js'
 *
 *   // In init(), AFTER panels.lh.init():
 *   this.treeView = new TreeView(this._ctx)
 *   this.treeView.init()                   // takes over panel-body-lh, creates tab bar
 *                                          // exposes slot:  #lh-grid-pane
 *
 *   this.gridLH = new GridPanel(this._ctx, 'lh', 'lh-grid-pane')  // custom slot
 *   this.gridLH.init()
 *
 *   // In destroy():
 *   this.gridLH?.destroy()
 *   this.treeView?.destroy()
 *
 *   // GridPanel.js needs one tiny addition to accept the optional slotId:
 *   //   constructor(context, panelId, slotId)
 *   //   this.slotId = slotId ?? `panel-body-${panelId}`
 *   // Then in init(): document.getElementById(this.slotId)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Seed tree (shown at startup before Phase 4 supplies real nodes)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   Root  ⟐objective
 *   ├── Axiom A  ⟐objective
 *   │   ├── Derivation B  ⟐undefined
 *   │   └── Derivation C  ⟐undefined   ← YOU ARE HERE
 *   │       ├── Inference D  ⟐undefined
 *   │       └── Inference E  ⟐subjective
 *   ├── Axiom F  ⟐false
 *   └── Axiom G  ⟐undefined
 */

import gsap from 'gsap'

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const INDENT_W    = 14    // px per depth level
const ROW_H       = 28    // px — each node row height
const TAB_H       = 28    // px — tab bar height
const CTRL_H      = 27    // px — tree controls row (incl separator)
const EXPAND_MS   = 220   // ms — expand / collapse animation duration

// Primitive type → dot colour
const PRIMITIVE_COLORS = {
  '⟐objective' : '#ffffff',
  '⟐undefined' : '#808080',
  '⟐false'     : '#1e1e1e',
  '⟐subjective': null,      // uses node.color.hex at render time
}

// Default colour for ⟐subjective when no node color is specified
const SUBJECTIVE_FALLBACK = '#a082ff'

// ─────────────────────────────────────────────────────────────────────────────
// Seed tree data — visible before Phase 4 supplies real nodes
// ─────────────────────────────────────────────────────────────────────────────

const SEED_NODES = [
  { id: 'seed_root', label: 'Root',         primitive: '⟐objective',  parentId: null,        depth: 0, position: { x: 0, y: 0, z: 0 } },
  { id: 'seed_a',    label: 'Axiom A',      primitive: '⟐objective',  parentId: 'seed_root', depth: 1, position: { x: 10, y: 0, z: 0 } },
  { id: 'seed_b',    label: 'Derivation B', primitive: '⟐undefined',  parentId: 'seed_a',    depth: 2, position: { x: 10, y: 0, z: 10 } },
  { id: 'seed_c',    label: 'Derivation C', primitive: '⟐undefined',  parentId: 'seed_a',    depth: 2, position: { x: 20, y: 0, z: 10 } },
  { id: 'seed_d',    label: 'Inference D',  primitive: '⟐undefined',  parentId: 'seed_c',    depth: 3, position: { x: 20, y: 0, z: 20 } },
  { id: 'seed_e',    label: 'Inference E',  primitive: '⟐subjective', parentId: 'seed_c',    depth: 3, position: { x: 30, y: 0, z: 20 }, color: { hex: '#a082ff' } },
  { id: 'seed_f',    label: 'Axiom F',      primitive: '⟐false',      parentId: 'seed_root', depth: 1, position: { x: -10, y: 0, z: 0 } },
  { id: 'seed_g',    label: 'Axiom G',      primitive: '⟐undefined',  parentId: 'seed_root', depth: 1, position: { x: 0, y: 0, z: -10 } },
]

// ─────────────────────────────────────────────────────────────────────────────
// Stylesheet
// ─────────────────────────────────────────────────────────────────────────────

const STYLES = /* css */`

/* ── LH panel body override — remove default padding ───────────────────────── */

#panel-body-lh {
  padding   : 0 !important;
  overflow  : hidden !important;
}

/* ── Tab controller root ────────────────────────────────────────────────────── */

.lh-tab-controller {
  display         : flex;
  flex-direction  : column;
  height          : 100%;
  font-family     : 'Courier New', Courier, monospace;
  -webkit-font-smoothing: antialiased;
}

/* ── Tab bar ────────────────────────────────────────────────────────────────── */

.lh-tab-bar {
  display         : flex;
  align-items     : stretch;
  height          : ${TAB_H}px;
  flex-shrink     : 0;
  border-bottom   : 1px solid rgba(255, 255, 255, 0.06);
  background      : rgba(255, 255, 255, 0.02);
}

.lh-tab {
  display         : flex;
  align-items     : center;
  justify-content : center;
  gap             : 5px;
  padding         : 0 14px;
  font-size       : 8px;
  letter-spacing  : 0.13em;
  text-transform  : uppercase;
  color           : rgba(255, 255, 255, 0.30);
  cursor          : pointer;
  position        : relative;
  border          : none;
  background      : none;
  font-family     : inherit;
  transition      : color 0.14s ease;
  user-select     : none;
  flex-shrink     : 0;
}

.lh-tab:hover {
  color           : rgba(255, 255, 255, 0.65);
}

.lh-tab.is-active {
  color           : rgba(255, 255, 255, 0.90);
}

/* Active underline */
.lh-tab.is-active::after {
  content         : '';
  position        : absolute;
  bottom          : 0;
  left            : 8px;
  right           : 8px;
  height          : 1px;
  background      : rgba(255, 255, 255, 0.55);
}

/* Node count badge — shown on TREE tab */
.lh-tab-badge {
  font-size       : 6.5px;
  letter-spacing  : 0.05em;
  color           : rgba(255, 255, 255, 0.28);
  background      : rgba(255, 255, 255, 0.07);
  border          : 1px solid rgba(255, 255, 255, 0.10);
  border-radius   : 8px;
  padding         : 0 5px;
  line-height     : 14px;
  font-family     : inherit;
  transition      : color 0.14s ease;
}

.lh-tab.is-active .lh-tab-badge {
  color           : rgba(255, 255, 255, 0.55);
  border-color    : rgba(255, 255, 255, 0.22);
}

/* Spacer pushes content to the right edge of the tab bar */
.lh-tab-spacer {
  flex            : 1;
}

/* ── Pane container ─────────────────────────────────────────────────────────── */

.lh-pane {
  flex            : 1 1 auto;
  overflow        : hidden;
  position        : relative;
  display         : none;
}

.lh-pane.is-active {
  display         : flex;
  flex-direction  : column;
}

/* Grid pane — GridPanel mounts inside, needs its own padding */
#lh-grid-pane {
  padding         : 12px;
  overflow-y      : auto;
  overflow-x      : hidden;
  scrollbar-width : thin;
  scrollbar-color : rgba(255,255,255,0.08) transparent;
}

#lh-grid-pane::-webkit-scrollbar       { width: 3px; }
#lh-grid-pane::-webkit-scrollbar-track { background: transparent; }
#lh-grid-pane::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 2px; }

/* Tree pane — has its own layout */
#lh-tree-pane {
  padding         : 0;
}

/* ── Tree controls bar ──────────────────────────────────────────────────────── */

.tree-controls {
  display         : flex;
  align-items     : center;
  gap             : 6px;
  height          : 26px;
  padding         : 0 12px;
  flex-shrink     : 0;
  border-bottom   : 1px solid rgba(255, 255, 255, 0.05);
}

.tree-depth-label {
  font-size       : 7.5px;
  color           : rgba(255, 255, 255, 0.28);
  letter-spacing  : 0.08em;
  flex            : 1;
  white-space     : nowrap;
  overflow        : hidden;
  text-overflow   : ellipsis;
}

.tree-depth-label .depth-value {
  color           : rgba(255, 255, 255, 0.65);
  font-size       : 8px;
}

.tree-ctrl-btn {
  font-size       : 7px;
  color           : rgba(255, 255, 255, 0.28);
  letter-spacing  : 0.07em;
  background      : none;
  border          : 1px solid rgba(255, 255, 255, 0.08);
  border-radius   : 3px;
  padding         : 1px 6px;
  cursor          : pointer;
  font-family     : inherit;
  flex-shrink     : 0;
  line-height     : 1.6;
  transition      : color 0.12s, border-color 0.12s, background 0.12s;
}

.tree-ctrl-btn:hover {
  color           : rgba(255, 255, 255, 0.72);
  border-color    : rgba(255, 255, 255, 0.20);
  background      : rgba(255, 255, 255, 0.05);
}

/* ── Scrollable tree body ───────────────────────────────────────────────────── */

.tree-scroll {
  flex            : 1 1 auto;
  overflow-y      : auto;
  overflow-x      : hidden;
  padding         : 4px 0 8px 0;

  scrollbar-width : thin;
  scrollbar-color : rgba(255,255,255,0.07) transparent;
}

.tree-scroll::-webkit-scrollbar       { width: 3px; }
.tree-scroll::-webkit-scrollbar-track { background: transparent; }
.tree-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.07); border-radius: 2px; }

/* ── Tree node row ──────────────────────────────────────────────────────────── */

.tree-node {
  position        : relative;
  width           : 100%;
}

/* Connector lines — vertical + horizontal guides */
.tree-node-row {
  display         : flex;
  align-items     : center;
  height          : ${ROW_H}px;
  cursor          : pointer;
  position        : relative;
  user-select     : none;
  transition      : background 0.10s ease;
  padding-right   : 8px;
}

.tree-node-row:hover {
  background      : rgba(255, 255, 255, 0.04);
}

/* Current node highlight */
.tree-node-row.is-current {
  background      : rgba(255, 255, 255, 0.07);
}

.tree-node-row.is-current::before {
  content         : '';
  position        : absolute;
  left            : 0;
  top             : 0;
  bottom          : 0;
  width           : 2px;
  background      : rgba(255, 255, 255, 0.60);
}

.tree-node-row.is-current .tree-label {
  color           : rgba(255, 255, 255, 0.95);
}

/* Current node YOU ARE HERE label */
.tree-node-row.is-current::after {
  content         : 'HERE';
  position        : absolute;
  right           : 36px;
  font-size       : 5.5px;
  letter-spacing  : 0.10em;
  color           : rgba(255, 255, 255, 0.28);
  font-family     : 'Courier New', Courier, monospace;
  pointer-events  : none;
}

/* ── Indent spacer ───────────────────────────────────────────────────────────── */

.tree-indent {
  flex-shrink     : 0;
  position        : relative;
}

/* Vertical guide line from parent to this row */
.tree-indent-guide {
  position        : absolute;
  top             : -${ROW_H / 2}px;   /* starts at parent's midline */
  bottom          : 50%;
  left            : calc(100% - 8px);
  width           : 1px;
  background      : rgba(255, 255, 255, 0.08);
  pointer-events  : none;
}

/* ── Toggle button ───────────────────────────────────────────────────────────── */

.tree-toggle {
  width           : 16px;
  height          : 16px;
  display         : flex;
  align-items     : center;
  justify-content : center;
  flex-shrink     : 0;
  font-size       : 9px;
  color           : rgba(255, 255, 255, 0.32);
  cursor          : pointer;
  border-radius   : 3px;
  transition      : color 0.12s, background 0.12s, transform 0.18s ease;
  border          : none;
  background      : none;
  padding         : 0;
  font-family     : inherit;
}

.tree-toggle:hover {
  color           : rgba(255, 255, 255, 0.72);
  background      : rgba(255, 255, 255, 0.07);
}

.tree-toggle.is-leaf {
  cursor          : default;
  opacity         : 0.35;
  pointer-events  : none;
}

/* ── Primitive dot ───────────────────────────────────────────────────────────── */

.tree-dot {
  width           : 8px;
  height          : 8px;
  border-radius   : 50%;
  flex-shrink     : 0;
  margin          : 0 6px 0 4px;
  position        : relative;
}

/* ⟐objective — bright white dot, strong glow */
.tree-dot--objective {
  background      : #ffffff;
  box-shadow      : 0 0 5px rgba(255, 255, 255, 0.55),
                    0 0 10px rgba(255, 255, 255, 0.18);
}

/* ⟐subjective — coloured, set via inline style */
.tree-dot--subjective {
  box-shadow      : 0 0 5px var(--dot-glow, rgba(160, 130, 255, 0.50));
}

/* ⟐undefined — gray, no glow */
.tree-dot--undefined {
  background      : #808080;
  box-shadow      : none;
  border          : 1px solid rgba(255, 255, 255, 0.12);
}

/* ⟐false — near-black, subtle white border */
.tree-dot--false {
  background      : #1a1a1a;
  box-shadow      : none;
  border          : 1px solid rgba(255, 255, 255, 0.22);
}

/* ── Label ───────────────────────────────────────────────────────────────────── */

.tree-label {
  flex            : 1;
  font-size       : 8.5px;
  color           : rgba(255, 255, 255, 0.72);
  letter-spacing  : 0.04em;
  overflow        : hidden;
  text-overflow   : ellipsis;
  white-space     : nowrap;
  pointer-events  : none;
  line-height     : 1;
  transition      : color 0.12s ease;
}

/* ── Depth badge ──────────────────────────────────────────────────────────────── */

.tree-depth-badge {
  font-size       : 6px;
  color           : rgba(255, 255, 255, 0.18);
  letter-spacing  : 0.05em;
  flex-shrink     : 0;
  margin-left     : 4px;
  line-height     : 1;
  pointer-events  : none;
}

/* ── Teleport button ─────────────────────────────────────────────────────────── */

.tree-teleport {
  width           : 22px;
  height          : 22px;
  display         : flex;
  align-items     : center;
  justify-content : center;
  flex-shrink     : 0;
  margin-left     : 4px;
  border          : 1px solid rgba(255, 255, 255, 0.10);
  border-radius   : 4px;
  background      : none;
  font-size       : 9px;
  color           : rgba(255, 255, 255, 0.28);
  cursor          : pointer;
  font-family     : inherit;
  opacity         : 0;
  transition      : opacity 0.12s ease,
                    color 0.12s ease,
                    background 0.12s ease,
                    border-color 0.12s ease;
}

.tree-node-row:hover .tree-teleport {
  opacity         : 1;
}

.tree-teleport:hover {
  color           : rgba(255, 255, 255, 0.90);
  background      : rgba(255, 255, 255, 0.08);
  border-color    : rgba(255, 255, 255, 0.28);
}

.tree-teleport:active {
  background      : rgba(255, 255, 255, 0.16);
}

/* Current node — teleport always visible */
.tree-node-row.is-current .tree-teleport {
  opacity         : 0.55;
}

/* ── Children container — animated height ────────────────────────────────────── */

.tree-children {
  overflow        : hidden;
}

/* ── Empty state ─────────────────────────────────────────────────────────────── */

.tree-empty {
  display         : flex;
  flex-direction  : column;
  align-items     : center;
  justify-content : center;
  height          : 120px;
  gap             : 8px;
  pointer-events  : none;
}

.tree-empty-glyph {
  font-size       : 20px;
  color           : rgba(255, 255, 255, 0.06);
}

.tree-empty-label {
  font-size       : 7.5px;
  color           : rgba(255, 255, 255, 0.18);
  letter-spacing  : 0.12em;
  text-transform  : uppercase;
}

`

function injectStyles () {
  if (document.getElementById('omni-tree-styles')) return
  const tag = document.createElement('style')
  tag.id          = 'omni-tree-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal node record
// ─────────────────────────────────────────────────────────────────────────────

class TreeNode {
  constructor (data) {
    this.id        = data.id
    this.label     = data.label     ?? 'Unnamed Node'
    this.primitive = data.primitive ?? '⟐undefined'
    this.parentId  = data.parentId  ?? null
    this.depth     = data.depth     ?? 0
    this.position  = data.position  ?? null    // { x, y, z } or null
    this.color     = data.color     ?? null    // { hex } or null

    // DOM refs — set during render
    this.rowEl      = null   // .tree-node-row
    this.nodeEl     = null   // .tree-node  (row + children container)
    this.childrenEl = null   // .tree-children
    this.toggleEl   = null   // .tree-toggle button

    // Tree structure — populated by TreeView._buildTree()
    this.children  = []      // TreeNode refs
    this.parent    = null    // TreeNode ref

    // Collapse state — branches start expanded by default
    this.collapsed = false
  }

  get isLeaf () { return this.children.length === 0 }
  get isRoot () { return this.parentId === null }
}

// ─────────────────────────────────────────────────────────────────────────────
// TreeView class
// ─────────────────────────────────────────────────────────────────────────────

export default class TreeView {

  /**
   * @param {object} context  — { scene, camera, renderer, sizes, ticker, Sound }
   */
  constructor (context) {
    this.ctx = context

    // ── DOM refs ──────────────────────────────────────────────────────────
    this._slot       = null   // panel-body-lh element
    this._controller = null   // .lh-tab-controller root
    this._tabGrid    = null   // GRID tab button
    this._tabTree    = null   // TREE tab button
    this._badgeEl    = null   // node count badge on TREE tab
    this._depthEl    = null   // depth label in tree controls
    this._scrollEl   = null   // .tree-scroll container
    this._treeRoot   = null   // tree root mount point inside .tree-scroll
    this._countBadge = null   // tree count badge element

    // ── Tab state ─────────────────────────────────────────────────────────
    this._activeTab  = 'grid'  // 'grid' | 'tree'

    // ── Node registry ─────────────────────────────────────────────────────
    this._nodes      = new Map()   // id → TreeNode
    this._roots      = []          // TreeNode[] — top-level nodes
    this._currentId  = null        // id of currently highlighted node

    // ── Bound event handlers ──────────────────────────────────────────────
    this._onNodeCreated  = e => this._handleNodeCreated(e)
    this._onNodeDeleted  = e => this._handleNodeDeleted(e)
    this._onNodeUpdated  = e => this._handleNodeUpdated(e)
    this._onNodeEntered  = e => this._handleNodeEntered(e)
    this._onPortal       = e => this._handlePortalActivated(e)
  }

  // ── Module contract ──────────────────────────────────────────────────────

  init () {
    injectStyles()

    this._slot = document.getElementById('panel-body-lh')
    if (!this._slot) {
      console.warn('⟐ TreeView: #panel-body-lh not found — Panel.init() must run first.')
      return
    }

    // Clear Panel.js placeholder
    this._slot.innerHTML = ''

    // Build the tab controller shell
    this._buildTabController()

    // Seed the tree with demo data
    this.setTree(SEED_NODES)

    // Set initial current node
    this.setCurrentNode('seed_c')

    // Wire global events
    this._bindEvents()

    console.log('⟐ TreeView: initialized — GRID | TREE tabs mounted in ⟐LH panel.')
  }

  update (_delta) {}   // no per-frame work

  destroy () {
    window.removeEventListener('omni:node-created',     this._onNodeCreated)
    window.removeEventListener('omni:node-deleted',     this._onNodeDeleted)
    window.removeEventListener('omni:node-updated',     this._onNodeUpdated)
    window.removeEventListener('omni:node-entered',     this._onNodeEntered)
    window.removeEventListener('omni:portal-activated', this._onPortal)

    if (this._slot && this._controller?.parentNode === this._slot) {
      // Restore Panel.js placeholder
      this._slot.innerHTML = /* html */`
        <div class="panel-placeholder">
          <span class="panel-placeholder-glyph">⟐LH</span>
          <span class="panel-placeholder-label">panel content — phase 4</span>
        </div>
      `
    }

    this._nodes.clear()
    this._roots = []
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Replace the entire tree with a new flat array of node descriptors.
   * Parentage is resolved by parentId references.
   *
   * @param {object[]} nodeArray
   */
  setTree (nodeArray) {
    this._nodes.clear()
    this._roots = []

    // First pass: instantiate all TreeNodes
    nodeArray.forEach(data => {
      this._nodes.set(data.id, new TreeNode(data))
    })

    // Second pass: link parents and children
    this._linkTree()

    // Render
    this._render()
    this._updateBadge()
  }

  /**
   * Add a single node. Parent must already exist if parentId is set.
   * @param {object} nodeData
   */
  addNode (nodeData) {
    if (this._nodes.has(nodeData.id)) {
      // Already exists — treat as update
      this._updateNodeData(nodeData)
      return
    }

    const node = new TreeNode(nodeData)
    this._nodes.set(node.id, node)

    // Wire parent
    if (node.parentId) {
      const parent = this._nodes.get(node.parentId)
      if (parent) {
        parent.children.push(node)
        node.parent = parent
        node.depth  = parent.depth + 1
      }
    } else {
      this._roots.push(node)
    }

    // Incremental DOM insert
    this._insertNodeDOM(node)
    this._updateBadge()
  }

  /**
   * Remove a node. Its children are promoted to its parent's child list.
   * @param {string} id
   */
  removeNode (id) {
    const node = this._nodes.get(id)
    if (!node) return

    // Reparent children
    node.children.forEach(child => {
      child.parentId = node.parentId
      child.parent   = node.parent
      child.depth    = Math.max(0, child.depth - 1)

      if (node.parent) {
        node.parent.children.push(child)
      } else {
        this._roots.push(child)
      }
    })

    // Remove from parent's list
    if (node.parent) {
      node.parent.children = node.parent.children.filter(c => c.id !== id)
    } else {
      this._roots = this._roots.filter(n => n.id !== id)
    }

    // Remove DOM
    node.nodeEl?.parentNode?.removeChild(node.nodeEl)
    this._nodes.delete(id)

    if (this._currentId === id) {
      this._currentId = null
      this._updateDepthLabel()
    }

    this._updateBadge()
  }

  /**
   * Relabel or re-primitive an existing node without full re-render.
   * @param {object} nodeData
   */
  updateNode (nodeData) {
    this._updateNodeData(nodeData)
  }

  /**
   * Set the current (highlighted) node and scroll it into view.
   * @param {string} id
   */
  setCurrentNode (id) {
    const prev = this._nodes.get(this._currentId)
    const next = this._nodes.get(id)

    if (!next) return

    // Remove highlight from previous
    prev?.rowEl?.classList.remove('is-current')

    this._currentId = id
    next.rowEl?.classList.add('is-current')

    // Ensure all ancestors are expanded so the node is visible
    this._expandAncestors(next)

    // Scroll into view
    this._scrollToNode(next)

    // Update depth label in controls bar
    this._updateDepthLabel()
  }

  /** Expand every branch in the tree. */
  expandAll () {
    this._nodes.forEach(node => {
      if (!node.isLeaf && node.collapsed) this._setCollapsed(node, false, false)
    })
  }

  /** Collapse every branch except root-level nodes. */
  collapseAll () {
    this._nodes.forEach(node => {
      if (!node.isLeaf && !node.isRoot) this._setCollapsed(node, true, false)
    })
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DOM — Tab controller shell
  // ─────────────────────────────────────────────────────────────────────────

  _buildTabController () {
    const ctrl = document.createElement('div')
    ctrl.className = 'lh-tab-controller'

    ctrl.appendChild(this._buildTabBar())
    ctrl.appendChild(this._buildGridPane())
    ctrl.appendChild(this._buildTreePane())

    this._slot.appendChild(ctrl)
    this._controller = ctrl
  }

  _buildTabBar () {
    const bar = document.createElement('div')
    bar.className = 'lh-tab-bar'

    // GRID tab
    const tabGrid = document.createElement('button')
    tabGrid.className   = 'lh-tab is-active'
    tabGrid.textContent = 'GRID'
    tabGrid.dataset.tab = 'grid'
    tabGrid.setAttribute('aria-label', 'Grid panel')
    tabGrid.addEventListener('click', () => this._switchTab('grid'))
    this._tabGrid = tabGrid

    // TREE tab
    const tabTree = document.createElement('button')
    tabTree.className   = 'lh-tab'
    tabTree.dataset.tab = 'tree'
    tabTree.setAttribute('aria-label', 'Logic tree')

    // Node count badge
    const badge = document.createElement('span')
    badge.className   = 'lh-tab-badge'
    badge.textContent = '0'
    this._badgeEl = badge

    tabTree.appendChild(document.createTextNode('TREE '))
    tabTree.appendChild(badge)
    tabTree.addEventListener('click', () => this._switchTab('tree'))
    this._tabTree = tabTree

    bar.appendChild(tabGrid)
    bar.appendChild(tabTree)
    bar.appendChild(document.createElement('div')).className = 'lh-tab-spacer' // flex spacer

    return bar
  }

  _buildGridPane () {
    const pane = document.createElement('div')
    pane.id        = 'lh-grid-pane'
    pane.className = 'lh-pane is-active'
    // GridPanel.init('lh', 'lh-grid-pane') will mount into this div
    return pane
  }

  _buildTreePane () {
    const pane = document.createElement('div')
    pane.id        = 'lh-tree-pane'
    pane.className = 'lh-pane'

    pane.appendChild(this._buildTreeControls())

    const scroll = document.createElement('div')
    scroll.className  = 'tree-scroll'
    this._scrollEl    = scroll
    pane.appendChild(scroll)

    return pane
  }

  // ── Tree controls bar ──────────────────────────────────────────────────────

  _buildTreeControls () {
    const bar = document.createElement('div')
    bar.className = 'tree-controls'

    // Depth label — updates when current node changes
    const depthLbl = document.createElement('span')
    depthLbl.className   = 'tree-depth-label'
    depthLbl.innerHTML   = 'depth <span class="depth-value">—</span>'
    this._depthEl        = depthLbl

    // Expand-all button
    const expandBtn = document.createElement('button')
    expandBtn.className   = 'tree-ctrl-btn'
    expandBtn.textContent = 'EXP'
    expandBtn.title       = 'Expand all branches'
    expandBtn.addEventListener('click', () => {
      this.expandAll()
      this._playSound('click')
    })

    // Collapse-all button
    const collapseBtn = document.createElement('button')
    collapseBtn.className   = 'tree-ctrl-btn'
    collapseBtn.textContent = 'COL'
    collapseBtn.title       = 'Collapse all branches'
    collapseBtn.addEventListener('click', () => {
      this.collapseAll()
      this._playSound('click')
    })

    bar.appendChild(depthLbl)
    bar.appendChild(expandBtn)
    bar.appendChild(collapseBtn)

    return bar
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Tab switching
  // ─────────────────────────────────────────────────────────────────────────

  _switchTab (tab) {
    if (this._activeTab === tab) return
    this._activeTab = tab

    // Update tab button states
    this._tabGrid.classList.toggle('is-active', tab === 'grid')
    this._tabTree.classList.toggle('is-active', tab === 'tree')

    // Update pane visibility
    const gridPane = document.getElementById('lh-grid-pane')
    const treePane = document.getElementById('lh-tree-pane')

    gridPane?.classList.toggle('is-active', tab === 'grid')
    treePane?.classList.toggle('is-active', tab === 'tree')

    this._playSound('click')

    // When switching to TREE tab, scroll current node into view
    if (tab === 'tree' && this._currentId) {
      requestAnimationFrame(() => {
        const node = this._nodes.get(this._currentId)
        if (node) this._scrollToNode(node)
      })
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Tree linking (parentId → TreeNode refs)
  // ─────────────────────────────────────────────────────────────────────────

  _linkTree () {
    this._roots = []

    this._nodes.forEach(node => {
      node.parent   = null
      node.children = []
    })

    this._nodes.forEach(node => {
      if (node.parentId) {
        const parent = this._nodes.get(node.parentId)
        if (parent) {
          parent.children.push(node)
          node.parent = parent
          // Recompute depth from parent chain
          node.depth = parent.depth + 1
        } else {
          // Orphan — treat as root
          this._roots.push(node)
        }
      } else {
        this._roots.push(node)
      }
    })
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render — full tree
  // ─────────────────────────────────────────────────────────────────────────

  _render () {
    if (!this._scrollEl) return

    this._scrollEl.innerHTML = ''

    if (this._roots.length === 0) {
      this._scrollEl.appendChild(this._buildEmptyState())
      return
    }

    const mount = document.createDocumentFragment()
    this._roots.forEach(root => this._renderNode(root, mount))
    this._scrollEl.appendChild(mount)
  }

  /**
   * Recursively build the DOM for one node and all its children.
   * @param {TreeNode}                  node
   * @param {HTMLElement|DocumentFragment} parent
   */
  _renderNode (node, parent) {
    const nodeEl = document.createElement('div')
    nodeEl.className = 'tree-node'
    nodeEl.dataset.id = node.id
    node.nodeEl = nodeEl

    // Build row
    nodeEl.appendChild(this._buildRow(node))

    // Build children container
    const childrenEl = document.createElement('div')
    childrenEl.className = 'tree-children'
    if (node.collapsed) {
      gsap.set(childrenEl, { height: 0, overflow: 'hidden' })
    }
    node.childrenEl = childrenEl

    node.children.forEach(child => this._renderNode(child, childrenEl))
    nodeEl.appendChild(childrenEl)

    parent.appendChild(nodeEl)
  }

  _buildRow (node) {
    const row = document.createElement('div')
    row.className = 'tree-node-row'
    row.dataset.id = node.id

    // ── Indent ─────────────────────────────────────────────────────────
    const indent = document.createElement('div')
    indent.className   = 'tree-indent'
    indent.style.width = `${node.depth * INDENT_W + 8}px`  // +8px left gutter

    // Vertical connector guide (shown when depth > 0)
    if (node.depth > 0) {
      const guide = document.createElement('div')
      guide.className = 'tree-indent-guide'
      indent.appendChild(guide)
    }

    row.appendChild(indent)

    // ── Toggle ─────────────────────────────────────────────────────────
    const toggle = document.createElement('button')
    toggle.className = `tree-toggle${node.isLeaf ? ' is-leaf' : ''}`
    toggle.textContent = node.isLeaf ? '·' : (node.collapsed ? '▶' : '▾')
    toggle.setAttribute('aria-label', node.collapsed ? 'Expand' : 'Collapse')
    toggle.addEventListener('click', (e) => {
      e.stopPropagation()
      this._toggleCollapse(node)
    })
    node.toggleEl = toggle
    row.appendChild(toggle)

    // ── Primitive dot ──────────────────────────────────────────────────
    row.appendChild(this._buildDot(node))

    // ── Label ──────────────────────────────────────────────────────────
    const label = document.createElement('span')
    label.className   = 'tree-label'
    label.textContent = node.label
    label.title       = node.label   // tooltip for truncated names
    row.appendChild(label)

    // ── Depth badge ────────────────────────────────────────────────────
    const depthBadge = document.createElement('span')
    depthBadge.className   = 'tree-depth-badge'
    depthBadge.textContent = `d.${node.depth}`
    row.appendChild(depthBadge)

    // ── Teleport button ────────────────────────────────────────────────
    const teleport = document.createElement('button')
    teleport.className = 'tree-teleport'
    teleport.textContent = '→'
    teleport.title = `Teleport to ${node.label}`
    teleport.setAttribute('aria-label', `Go to ${node.label}`)
    teleport.addEventListener('click', (e) => {
      e.stopPropagation()
      this._teleportTo(node)
    })
    row.appendChild(teleport)

    // ── Row click = select as current ─────────────────────────────────
    row.addEventListener('click', () => {
      this.setCurrentNode(node.id)
      this._playSound('click')
    })

    node.rowEl = row
    return row
  }

  _buildDot (node) {
    const dot = document.createElement('div')
    const primitiveKey = node.primitive?.replace('⟐', '') ?? 'undefined'
    dot.className = `tree-dot tree-dot--${primitiveKey}`

    if (node.primitive === '⟐subjective') {
      const hex  = node.color?.hex ?? SUBJECTIVE_FALLBACK
      dot.style.background = hex
      // Glow colour as CSS var for the box-shadow
      dot.style.setProperty('--dot-glow', hex + '80')   // hex + 50% alpha
      dot.style.boxShadow  = `0 0 5px ${hex}80, 0 0 10px ${hex}30`
    }

    return dot
  }

  _buildEmptyState () {
    const empty = document.createElement('div')
    empty.className = 'tree-empty'
    empty.innerHTML = /* html */`
      <span class="tree-empty-glyph">⟐</span>
      <span class="tree-empty-label">No nodes yet</span>
    `
    return empty
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Incremental DOM insert (for addNode)
  // ─────────────────────────────────────────────────────────────────────────

  _insertNodeDOM (node) {
    if (!this._scrollEl) return

    // Remove empty state if present
    const emptyEl = this._scrollEl.querySelector('.tree-empty')
    if (emptyEl) this._scrollEl.removeChild(emptyEl)

    const nodeEl = document.createElement('div')
    nodeEl.className = 'tree-node'
    nodeEl.dataset.id = node.id
    node.nodeEl = nodeEl
    nodeEl.appendChild(this._buildRow(node))

    const childrenEl = document.createElement('div')
    childrenEl.className = 'tree-children'
    node.childrenEl = childrenEl
    nodeEl.appendChild(childrenEl)

    if (node.parent?.childrenEl) {
      // Append to parent's children container
      node.parent.childrenEl.appendChild(nodeEl)

      // Update parent toggle (was leaf, now has children)
      if (node.parent.children.length === 1) {
        node.parent.toggleEl.classList.remove('is-leaf')
        node.parent.toggleEl.textContent = '▾'
      }
    } else {
      this._scrollEl.appendChild(nodeEl)
    }

    // Animate in
    gsap.fromTo(nodeEl, { opacity: 0, x: -6 }, { opacity: 1, x: 0, duration: 0.22, ease: 'power2.out' })
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Collapse / expand with GSAP height tween
  // ─────────────────────────────────────────────────────────────────────────

  _toggleCollapse (node) {
    if (node.isLeaf) return
    this._setCollapsed(node, !node.collapsed, true)
    this._playSound(node.collapsed ? 'close' : 'open')
  }

  /**
   * @param {TreeNode} node
   * @param {boolean}  collapse   true = collapse, false = expand
   * @param {boolean}  animate
   */
  _setCollapsed (node, collapse, animate) {
    if (node.collapsed === collapse) return
    node.collapsed = collapse

    const el = node.childrenEl
    if (!el) return

    // Update toggle glyph + aria
    if (node.toggleEl) {
      node.toggleEl.textContent = collapse ? '▶' : '▾'
      node.toggleEl.setAttribute('aria-label', collapse ? 'Expand' : 'Collapse')
    }

    if (!animate) {
      gsap.set(el, { height: collapse ? 0 : 'auto', overflow: collapse ? 'hidden' : 'visible' })
      return
    }

    if (collapse) {
      const h = el.scrollHeight
      gsap.fromTo(el,
        { height: h, overflow: 'hidden' },
        { height: 0, duration: EXPAND_MS / 1000, ease: 'power2.inOut' }
      )
    } else {
      const h = el.scrollHeight
      gsap.fromTo(el,
        { height: 0, overflow: 'hidden' },
        {
          height    : h,
          duration  : EXPAND_MS / 1000,
          ease      : 'power2.out',
          onComplete: () => gsap.set(el, { height: 'auto', overflow: 'visible' }),
        }
      )
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Ancestor expansion + scroll to current node
  // ─────────────────────────────────────────────────────────────────────────

  _expandAncestors (node) {
    let cursor = node.parent
    while (cursor) {
      if (cursor.collapsed) this._setCollapsed(cursor, false, false)
      cursor = cursor.parent
    }
  }

  _scrollToNode (node) {
    if (!node.rowEl || !this._scrollEl) return

    // Use rAF to wait for any expand animations to start
    requestAnimationFrame(() => {
      const containerRect = this._scrollEl.getBoundingClientRect()
      const rowRect       = node.rowEl.getBoundingClientRect()

      const rowTop    = rowRect.top    - containerRect.top    + this._scrollEl.scrollTop
      const rowBottom = rowRect.bottom - containerRect.top    + this._scrollEl.scrollTop

      const viewTop    = this._scrollEl.scrollTop
      const viewBottom = viewTop + this._scrollEl.clientHeight

      if (rowTop < viewTop) {
        this._scrollEl.scrollTo({ top: rowTop - ROW_H, behavior: 'smooth' })
      } else if (rowBottom > viewBottom) {
        this._scrollEl.scrollTo({ top: rowBottom - this._scrollEl.clientHeight + ROW_H, behavior: 'smooth' })
      }
    })
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Update helpers
  // ─────────────────────────────────────────────────────────────────────────

  _updateNodeData (data) {
    const node = this._nodes.get(data.id)
    if (!node) return

    const labelChanged     = data.label     !== undefined && data.label     !== node.label
    const primitiveChanged = data.primitive !== undefined && data.primitive !== node.primitive

    if (data.label     !== undefined) node.label     = data.label
    if (data.primitive !== undefined) node.primitive = data.primitive
    if (data.position  !== undefined) node.position  = data.position
    if (data.color     !== undefined) node.color     = data.color

    if (!node.rowEl) return

    // Update label text
    if (labelChanged) {
      const lbl = node.rowEl.querySelector('.tree-label')
      if (lbl) { lbl.textContent = node.label; lbl.title = node.label }
    }

    // Update primitive dot
    if (primitiveChanged) {
      const oldDot = node.rowEl.querySelector('.tree-dot')
      if (oldDot) {
        const newDot = this._buildDot(node)
        oldDot.parentNode.replaceChild(newDot, oldDot)
      }
    }
  }

  _updateBadge () {
    const count = this._nodes.size
    if (this._badgeEl) this._badgeEl.textContent = count
  }

  _updateDepthLabel () {
    if (!this._depthEl) return
    const node = this._nodes.get(this._currentId)
    const depthSpan = this._depthEl.querySelector('.depth-value')
    if (depthSpan) {
      depthSpan.textContent = node ? `${node.depth}  ·  ${node.label}` : '—'
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Teleport
  // ─────────────────────────────────────────────────────────────────────────

  _teleportTo (node) {
    this._playSound('click')

    // Animate the row briefly to confirm the action
    gsap.fromTo(node.rowEl,
      { x: 4 },
      { x: 0, duration: 0.18, ease: 'power2.out' }
    )

    window.dispatchEvent(new CustomEvent('omni:tree-teleport', {
      detail: {
        id      : node.id,
        label   : node.label,
        position: node.position ?? null,
      },
    }))

    // Also mark as current
    this.setCurrentNode(node.id)

    console.log(`⟐ TreeView: teleport → ${node.label} (${node.id})`)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Event handlers (from Phase 4 NodeManager / Phase 2 portals)
  // ─────────────────────────────────────────────────────────────────────────

  _bindEvents () {
    window.addEventListener('omni:node-created',     this._onNodeCreated)
    window.addEventListener('omni:node-deleted',     this._onNodeDeleted)
    window.addEventListener('omni:node-updated',     this._onNodeUpdated)
    window.addEventListener('omni:node-entered',     this._onNodeEntered)
    window.addEventListener('omni:portal-activated', this._onPortal)
  }

  _handleNodeCreated (e) {
    const { node } = e.detail ?? {}
    if (!node?.id) return
    this.addNode(node)
  }

  _handleNodeDeleted (e) {
    const { id } = e.detail ?? {}
    if (id) this.removeNode(id)
  }

  _handleNodeUpdated (e) {
    const { node } = e.detail ?? {}
    if (node?.id) this._updateNodeData(node)
  }

  _handleNodeEntered (e) {
    const { id } = e.detail ?? {}
    if (id && this._nodes.has(id)) {
      this.setCurrentNode(id)
      // Auto-switch to TREE tab so the user sees the highlight
      if (this._activeTab !== 'tree') this._switchTab('tree')
    }
  }

  _handlePortalActivated (e) {
    const { id, label } = e.detail ?? {}

    // Try id match first (Phase 4 portals will have ids)
    if (id && this._nodes.has(id)) {
      this.setCurrentNode(id)
      return
    }

    // Fall back to label match (Phase 2 portals dispatch only label)
    if (label) {
      for (const [nodeId, node] of this._nodes) {
        if (node.label === label) {
          this.setCurrentNode(nodeId)
          return
        }
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Sound
  // ─────────────────────────────────────────────────────────────────────────

  _playSound (id) {
    try {
      const Sound = this.ctx?.Sound
      if (Sound && typeof Sound.play === 'function') Sound.play(id)
    } catch (_) {}
  }
}
