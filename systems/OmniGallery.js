/**
 * systems/OmniGallery.js — ⟐g OmniGallery
 *
 * A default, browsable gallery of textures for the ⟐mniReality's nodes.
 * Follows the exact same architectural pattern as systems/OmniPresenter.js
 * (toggleable floating panel built from a template string, its own scoped
 * CSS, module contract constructor/init/update/destroy).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Panel
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   Anchored bottom-left, above the Dock — same slot shape as OmniPresenter
 *   (bottom-right), mirrored to the left so the two don't collide.
 *
 *   Opens via:
 *     window.dispatchEvent(new CustomEvent('omni:system-toggle', {
 *       detail: { system: 'omnigallery' }
 *     }))
 *   or the dedicated:
 *     window.dispatchEvent(new CustomEvent('omni:gallery-toggle', {
 *       detail: { select: true }   // optional — opens in "pick a texture" mode
 *     }))
 *   Or directly: omniGallery.open() / close() / toggle() / openForSelect()
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Folder tree
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   ToBeSorted                         — empty bucket, future/uncategorized
 *   SystemAssets
 *     └ Geometries                     — one folder per real node geometry
 *         ├ Box / Sphere / Cylinder / … (20 types, matches OmniNode's
 *           GEOMETRY_DEFS registry — the real set swappable on a node)
 *         Box and Plane are the two folders the 13 uploaded texture
 *         swatches were placed in (per the literal ask); the other 18
 *         geometry folders exist and are real, navigable, just empty for
 *         now — nothing else was supplied to put in them.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Selection flow
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   Clicking a texture thumbnail always dispatches:
 *     omni:gallery-texture-select  { path, label }
 *   on window — any inspector can listen for this and apply `path` as a
 *   THREE.TextureLoader map on the selected mesh's material. When the
 *   gallery was opened via openForSelect() (select mode), picking a
 *   texture also closes the panel immediately afterward, same as a
 *   native file-picker "choose" action.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Usage in main.js
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   import OmniGallery from './systems/OmniGallery.js'
 *   const omniGallery = new OmniGallery(base.context)
 *   omniGallery.init()
 *
 * Follows the standard module contract (constructor / init / update / destroy).
 */

import gsap from 'gsap'
import { GEOMETRY_DEFS, GEO_LABELS } from './OmniNode.js'

// ── Layout constants (mirrors OmniPresenter's own slot, flipped to the left) ──

const DOCK_H    = 52    // px — Dock height (bottom anchor)
const PANEL_W   = 460   // px — wider than OmniPresenter: needs room for tree + grid
const PANEL_H   = 380   // px — matches OmniPresenter
const SLIDE_DUR = 0.30  // s  — slide animation

// ── Asset registry — the 13 uploaded swatches, named for what they depict ─────
// Paths are relative, matching the project convention seen in
// modules/WallpaperSphere.js's DEFAULT_IMG_URL ('./assets/images/<name>').

// V168: exported so the payload panel (ui/OmniPayloadPanel.js) can list the same swatches in-panel.
export const GALLERY_ASSETS = [
  { id: 'lotus-emblem',            label: 'Lotus Emblem',              file: 'gallery-tex-lotus-emblem.svg' },
  { id: 'panel-square-a',          label: 'Panel Square A',            file: 'gallery-tex-panel-square-a.svg' },
  { id: 'panel-square-b',          label: 'Panel Square B',            file: 'gallery-tex-panel-square-b.svg' },
  { id: 'panel-square-c',          label: 'Panel Square C',            file: 'gallery-tex-panel-square-c.svg' },
  { id: 'panel-nested-square-a',   label: 'Nested Square A',           file: 'gallery-tex-panel-nested-square-a.svg' },
  { id: 'panel-nested-square-b',   label: 'Nested Square B',           file: 'gallery-tex-panel-nested-square-b.svg' },
  { id: 'panel-nested-square-c',   label: 'Nested Square C',           file: 'gallery-tex-panel-nested-square-c.svg' },
  { id: 'connector-bar',           label: 'Connector Bar',             file: 'gallery-tex-connector-bar.svg' },
  { id: 'blueprint-grid-corner',   label: 'Blueprint Grid Corner',     file: 'gallery-tex-blueprint-grid-corner.svg' },
  { id: 'technical-corner-frame',  label: 'Technical Corner Frame',    file: 'gallery-tex-technical-corner-frame.svg' },
  { id: 'schematic-burst-emblem',  label: 'Schematic Burst Emblem',    file: 'gallery-tex-schematic-burst-emblem.svg' },
  { id: 'quadrant-schematic',      label: 'Quadrant Schematic',        file: 'gallery-tex-quadrant-schematic-pattern.svg' },
  { id: 'dashed-rule-pair',        label: 'Dashed Rule Pair',          file: 'gallery-tex-dashed-rule-pair.svg' },
].map(a => ({ ...a, path: `./assets/images/${a.file}` }))

// ── Folder tree builder ────────────────────────────────────────────────────────
// Geometry folder list is built from OmniNode's own GEOMETRY_DEFS registry —
// the real, live set of geometry types a node can actually be swapped to —
// rather than an invented list. EssenceData is OmniNode's special internal
// type (not a plain THREE.*Geometry swap target in the picker), so it's
// left out here the same way OmniInspector's own GEO_TYPES list leaves it out.

function buildGeometryFolders () {
  return Object.keys(GEOMETRY_DEFS)
    .filter(key => key !== 'EssenceData')
    .map(key => ({
      id       : `geo-${key}`,
      label    : GEO_LABELS[key] ?? key,
      type     : 'folder',
      // Judgment call: the ask was literal — all 13 swatches go in BOTH
      // the Plane and the Box folders. None of the 13 are obviously
      // unsuited to either (they're all flat decorative/UI textures,
      // not something like a skybox cross that would only make sense
      // on one shape), so no asset was excluded from either folder.
      children : (key === 'PlaneGeometry' || key === 'BoxGeometry')
        ? GALLERY_ASSETS.map(a => ({ ...a, type: 'texture' }))
        : [],
    }))
}

function buildTree () {
  return [
    { id: 'tobesorted', label: 'ToBeSorted', type: 'folder', children: [] },
    {
      id: 'systemassets', label: 'SystemAssets', type: 'folder',
      children: [
        { id: 'geometries', label: 'Geometries', type: 'folder', children: buildGeometryFolders() },
      ],
    },
  ]
}

// ── Storage ───────────────────────────────────────────────────────────────────

const STORE_KEY = 'omni:gallery:ui'

// ── Stylesheet ────────────────────────────────────────────────────────────────

const STYLES = /* css */`

.og-panel {
  --og-bg           : var(--omni-theme-bg, rgba(6, 6, 10, 0.93));
  --og-border       : var(--omni-theme-border, rgba(255, 255, 255, 0.09));
  --og-sep          : var(--omni-theme-border, rgba(255, 255, 255, 0.05));
  --og-header-bg    : var(--omni-theme-header-bg, rgba(255, 255, 255, 0.03));
  --og-text         : var(--omni-theme-text, rgba(255, 255, 255, 0.82));
  --og-text-dim     : var(--omni-theme-text-dim, rgba(255, 255, 255, 0.60));
  --og-text-muted   : var(--omni-theme-text-muted, rgba(255, 255, 255, 0.34));
  --og-accent       : var(--omni-theme-accent, rgba(255, 255, 255, 0.96));
  --og-select-glow  : rgba(120, 200, 255, 0.20);
  --og-select-border: rgba(120, 200, 255, 0.40);
  --mono            : 'Courier New', Courier, monospace;

  position          : fixed;
  bottom            : ${DOCK_H}px;
  left              : 0;
  width             : ${PANEL_W}px;
  height            : ${PANEL_H}px;

  display           : flex;
  flex-direction    : column;

  background        : var(--og-bg);
  backdrop-filter   : blur(24px) saturate(1.6);
  -webkit-backdrop-filter: blur(24px) saturate(1.6);
  border-top        : 1px solid var(--og-border);
  border-right      : 1px solid var(--og-border);
  border-bottom     : none;
  border-left       : none;
  border-radius     : 0 10px 0 0;

  font-family       : var(--mono);
  color             : var(--og-text);
  font-size         : 10px;
  z-index           : 46;
  pointer-events    : auto;
  user-select       : none;
  overflow          : hidden;
  -webkit-font-smoothing: antialiased;

  visibility        : hidden;
}

/* Selection-mode glow — lets the person see at a glance that picking a
   texture now will actually hand it off to something waiting on it. */
.og-panel.is-select-mode {
  border-top-color  : var(--og-select-border);
  border-right-color: var(--og-select-border);
  box-shadow        : 2px -2px 18px var(--og-select-glow);
}

.og-header {
  flex-shrink       : 0;
  display           : flex;
  align-items       : center;
  padding           : 0 10px 0 14px;
  height            : 38px;
  background        : var(--og-header-bg);
  border-bottom     : 1px solid var(--og-sep);
  gap               : 8px;
}

.og-title {
  flex              : 1 1 auto;
  font-size         : 10px;
  color             : var(--og-accent);
  letter-spacing    : 0.12em;
  text-transform    : uppercase;
}

.og-select-badge {
  display           : none;
  font-size         : 7px;
  color             : rgba(150, 215, 255, 0.85);
  border            : 1px solid var(--og-select-border);
  border-radius     : 3px;
  padding           : 2px 6px;
  letter-spacing    : 0.08em;
  text-transform    : uppercase;
}
.og-panel.is-select-mode .og-select-badge { display: inline-block; }

.og-controls {
  display           : flex;
  align-items       : center;
  gap               : 3px;
  flex-shrink       : 0;
}

.og-ctrl {
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
  color             : var(--og-text-dim);
  cursor            : pointer;
  transition        : background 0.12s, color 0.12s, border-color 0.12s;
}
.og-ctrl:hover  { background: rgba(255,255,255,0.08); color: var(--og-accent); border-color: rgba(255,255,255,0.18); }
.og-ctrl:active { background: rgba(255,255,255,0.16); }
.og-ctrl--close:hover {
  background    : rgba(255, 80, 80, 0.14);
  border-color  : rgba(255, 80, 80, 0.28);
  color         : rgba(255, 150, 150, 0.90);
}

/* ── Body split: tree (left) + grid (right) ───────────────────────────────── */

.og-body {
  flex              : 1 1 auto;
  display           : flex;
  min-height        : 0;
}

.og-tree {
  flex              : 0 0 168px;
  overflow-y        : auto;
  border-right      : 1px solid var(--og-sep);
  padding           : 6px 0;
  scrollbar-width   : thin;
  scrollbar-color   : rgba(255,255,255,0.06) transparent;
}
.og-tree::-webkit-scrollbar       { width: 3px; }
.og-tree::-webkit-scrollbar-track { background: transparent; }
.og-tree::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.06); border-radius: 2px; }

.og-tree-row {
  display           : flex;
  align-items       : center;
  gap               : 5px;
  padding           : 4px 10px;
  cursor            : pointer;
  font-size         : 9px;
  color             : var(--og-text-dim);
  letter-spacing    : 0.02em;
  white-space       : nowrap;
  overflow          : hidden;
  text-overflow     : ellipsis;
  transition        : background 0.10s, color 0.10s;
}
.og-tree-row:hover    { background: rgba(255,255,255,0.04); color: var(--og-text); }
.og-tree-row.is-active {
  background        : rgba(255,255,255,0.08);
  color             : var(--og-accent);
}

.og-tree-arrow {
  width             : 9px;
  flex-shrink       : 0;
  font-size         : 7px;
  color             : var(--og-text-muted);
  display           : inline-block;
  transition        : transform 0.14s ease;
}
.og-tree-row.is-expanded .og-tree-arrow { transform: rotate(90deg); }
.og-tree-arrow.is-leaf { visibility: hidden; }

.og-tree-count {
  margin-left       : auto;
  font-size         : 7px;
  color             : var(--og-text-muted);
  flex-shrink       : 0;
  padding-left      : 4px;
}

/* ── Grid of swatches ─────────────────────────────────────────────────────── */

.og-grid-pane {
  flex              : 1 1 auto;
  display           : flex;
  flex-direction    : column;
  min-width         : 0;
}

.og-grid-header {
  flex-shrink       : 0;
  padding           : 7px 12px;
  font-size         : 8px;
  color             : var(--og-text-muted);
  letter-spacing    : 0.08em;
  text-transform    : uppercase;
  border-bottom     : 1px solid var(--og-sep);
  overflow          : hidden;
  text-overflow     : ellipsis;
  white-space       : nowrap;
}

.og-grid {
  flex              : 1 1 auto;
  overflow-y        : auto;
  padding           : 10px;
  display           : grid;
  grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
  gap               : 8px;
  align-content     : flex-start;
  scrollbar-width   : thin;
  scrollbar-color   : rgba(255,255,255,0.06) transparent;
}
.og-grid::-webkit-scrollbar       { width: 3px; }
.og-grid::-webkit-scrollbar-track { background: transparent; }
.og-grid::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.06); border-radius: 2px; }

.og-swatch {
  display           : flex;
  flex-direction    : column;
  align-items       : center;
  gap               : 4px;
  padding           : 6px 4px 5px;
  background        : rgba(255,255,255,0.03);
  border            : 1px solid rgba(255,255,255,0.08);
  border-radius     : 6px;
  cursor            : pointer;
  transition        : background 0.12s, border-color 0.12s, transform 0.08s;
}
.og-swatch:hover   { background: rgba(255,255,255,0.07); border-color: rgba(255,255,255,0.20); }
.og-swatch:active  { transform: scale(0.96); }

.og-swatch-thumb-wrap {
  width             : 56px;
  height            : 56px;
  border-radius     : 4px;
  overflow          : hidden;
  background        : repeating-conic-gradient(
    rgba(255,255,255,0.08) 0% 25%,
    rgba(0,0,0,0.18) 0% 50%
  ) 0 0 / 8px 8px;
  display           : flex;
  align-items       : center;
  justify-content   : center;
  flex-shrink       : 0;
}

.og-swatch-thumb {
  max-width         : 100%;
  max-height        : 100%;
  object-fit        : contain;
}

.og-swatch-label {
  font-size         : 7px;
  color             : var(--og-text-muted);
  text-align        : center;
  line-height       : 1.3;
  max-width         : 70px;
  overflow          : hidden;
  text-overflow     : ellipsis;
  white-space       : nowrap;
}

.og-grid-empty {
  display           : flex;
  flex-direction    : column;
  align-items       : center;
  justify-content   : center;
  gap               : 7px;
  padding           : 24px 16px;
  color             : var(--og-text-muted);
  font-size         : 9px;
  letter-spacing    : 0.08em;
  text-align        : center;
  grid-column       : 1 / -1;
}
.og-grid-empty-glyph { font-size: 18px; opacity: 0.18; display: block; }

/* ── Footer ───────────────────────────────────────────────────────────────── */

.og-footer {
  flex-shrink       : 0;
  height            : 24px;
  padding           : 0 12px;
  display           : flex;
  align-items       : center;
  border-top        : 1px solid var(--og-sep);
  font-size         : 8px;
  color             : var(--og-text-muted);
  letter-spacing    : 0.04em;
  overflow          : hidden;
  text-overflow     : ellipsis;
  white-space       : nowrap;
}

/* ── Mobile ───────────────────────────────────────────────────────────────── */

@media (max-width: 680px) {
  .og-panel { width: min(${PANEL_W}px, 94vw); height: min(${PANEL_H}px, 58vh); }
  .og-tree  { flex: 0 0 120px; }
}

`

// ── Style injection ───────────────────────────────────────────────────────────

function injectStyles () {
  if (document.getElementById('omni-gallery-styles')) return
  const tag = document.createElement('style')
  tag.id          = 'omni-gallery-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

// ─────────────────────────────────────────────────────────────────────────────
// OmniGallery class
// ─────────────────────────────────────────────────────────────────────────────

export default class OmniGallery {

  /**
   * @param {object} context — { scene, camera, renderer, sizes, ticker, Sound? }
   */
  constructor (context) {
    this.ctx = context

    this._el         = null
    this._isOpen     = false
    this._selectMode = false

    this._tree       = buildTree()
    this._expanded   = new Set(['tobesorted', 'systemassets', 'geometries'])
    this._activeFolderId = null   // id of the folder whose contents are shown in the grid

    this._onToggle       = null
    this._onGalleryToggle = null
  }

  // ── Module contract ──────────────────────────────────────────────────────

  init () {
    injectStyles()
    this._buildPanel()
    this._bindEvents()
    this._load()
    this._renderTree()
    this._renderGrid()
  }

  update (_delta) {
    // Nothing per-frame — purely event/DOM driven
  }

  destroy () {
    this._el?.parentNode?.removeChild(this._el)
    window.removeEventListener('omni:system-toggle',  this._onToggle)
    window.removeEventListener('omni:gallery-toggle', this._onGalleryToggle)
  }

  // ── Public API ───────────────────────────────────────────────────────────

  open () {
    if (this._isOpen) return
    this._isOpen = true
    this._el.style.visibility = 'visible'
    gsap.fromTo(this._el,
      { x: '-100%', opacity: 1 },
      { x: '0%', duration: SLIDE_DUR, ease: 'power3.out' }
    )
    this._playSound('open')
  }

  close () {
    if (!this._isOpen) return
    this._isOpen = false
    this._setSelectMode(false)
    gsap.to(this._el, {
      x: '-100%', duration: SLIDE_DUR * 0.85, ease: 'power2.in',
      onComplete: () => {
        this._el.style.visibility = 'hidden'
        gsap.set(this._el, { x: '-100%' })
      }
    })
    this._playSound('close')
  }

  toggle () { this._isOpen ? this.close() : this.open() }

  /** Opens the gallery in "pick a texture" mode — picking a swatch then
   *  auto-closes the panel, same as a native file-picker's choose action. */
  openForSelect () {
    this._setSelectMode(true)
    this.open()
  }

  _setSelectMode (active) {
    this._selectMode = active
    this._el?.classList.toggle('is-select-mode', active)
  }

  // ── Panel DOM ────────────────────────────────────────────────────────────

  _buildPanel () {
    const el = document.createElement('div')
    el.className = 'og-panel'
    el.id        = 'omni-gallery-panel'

    el.innerHTML = /* html */`
      <div class="og-header">
        <span class="og-title">OmniGallery ⟐g</span>
        <span class="og-select-badge">Pick a texture</span>
        <div class="og-controls">
          <button class="og-ctrl og-ctrl--close" data-action="close" title="✕ Close">✕</button>
        </div>
      </div>

      <div class="og-body">
        <div class="og-tree" id="og-tree"></div>
        <div class="og-grid-pane">
          <div class="og-grid-header" id="og-grid-header">SystemAssets</div>
          <div class="og-grid" id="og-grid"></div>
        </div>
      </div>

      <div class="og-footer" id="og-footer">⟐g  0 textures</div>
    `

    gsap.set(el, { x: '-100%' })
    this._el = el

    const shell = document.getElementById('omni-ui') ?? document.body
    shell.appendChild(el)

    el.querySelector('.og-controls').addEventListener('click', (e) => {
      const btn = e.target.closest('.og-ctrl')
      if (!btn) return
      this._playSound('click')
      if (btn.dataset.action === 'close') this.close()
    })
  }

  // ── Events ───────────────────────────────────────────────────────────────

  _bindEvents () {
    this._onToggle = (e) => {
      if (e.detail?.system !== 'omnigallery') return
      this.toggle()
    }
    window.addEventListener('omni:system-toggle', this._onToggle)

    // Dedicated gallery event — also carries an optional select-mode flag,
    // the way "any inspector" (per the ask) opens the gallery to pick a
    // texture for the currently-selected mesh.
    this._onGalleryToggle = (e) => {
      if (e.detail?.select) {
        this.openForSelect()
      } else {
        this.toggle()
      }
    }
    window.addEventListener('omni:gallery-toggle', this._onGalleryToggle)
  }

  // ── Tree render ──────────────────────────────────────────────────────────

  _flattenVisible (nodes, depth, out) {
    for (const node of nodes) {
      out.push({ node, depth })
      if (node.type === 'folder' && this._expanded.has(node.id)) {
        this._flattenVisible(node.children ?? [], depth + 1, out)
      }
    }
    return out
  }

  _countTextures (node) {
    if (node.type === 'texture') return 1
    return (node.children ?? []).reduce((sum, c) => sum + this._countTextures(c), 0)
  }

  _renderTree () {
    const treeEl = this._el?.querySelector('#og-tree')
    if (!treeEl) return

    const rows = this._flattenVisible(this._tree, 0, [])

    treeEl.innerHTML = rows.map(({ node, depth }) => {
      const isFolder   = node.type === 'folder'
      const isExpanded = isFolder && this._expanded.has(node.id)
      const isActive   = node.id === this._activeFolderId
      const count      = isFolder ? this._countTextures(node) : null
      return /* html */`
        <div class="og-tree-row ${isExpanded ? 'is-expanded' : ''} ${isActive ? 'is-active' : ''}"
             data-node-id="${node.id}"
             style="padding-left:${10 + depth * 12}px"
             title="${node.label}">
          <span class="og-tree-arrow ${isFolder ? '' : 'is-leaf'}">${isFolder ? '▸' : ''}</span>
          <span>${node.label}</span>
          ${count !== null ? `<span class="og-tree-count">${count}</span>` : ''}
        </div>
      `
    }).join('')

    treeEl.querySelectorAll('.og-tree-row').forEach(row => {
      row.addEventListener('click', () => {
        const id   = row.dataset.nodeId
        const hit  = this._findNode(id)
        if (!hit) return
        if (hit.type === 'folder') {
          if (this._expanded.has(id)) this._expanded.delete(id)
          else this._expanded.add(id)
          this._activeFolderId = id
          this._save()
          this._renderTree()
          this._renderGrid()
        }
        this._playSound('click')
      })
    })
  }

  _findNode (id, nodes = this._tree) {
    for (const node of nodes) {
      if (node.id === id) return node
      if (node.type === 'folder') {
        const hit = this._findNode(id, node.children ?? [])
        if (hit) return hit
      }
    }
    return null
  }

  // ── Grid render ──────────────────────────────────────────────────────────

  _renderGrid () {
    const gridEl   = this._el?.querySelector('#og-grid')
    const headerEl = this._el?.querySelector('#og-grid-header')
    const footerEl = this._el?.querySelector('#og-footer')
    if (!gridEl) return

    const folder = this._activeFolderId ? this._findNode(this._activeFolderId) : null
    const items  = (folder?.children ?? []).filter(c => c.type === 'texture')

    if (headerEl) headerEl.textContent = folder ? folder.label : 'Select a folder'

    if (items.length === 0) {
      gridEl.innerHTML = /* html */`
        <div class="og-grid-empty">
          <span class="og-grid-empty-glyph">⟐g</span>
          <span>${folder ? 'No textures in this folder yet.' : 'Select a folder on the left.'}</span>
        </div>
      `
    } else {
      gridEl.innerHTML = items.map(item => /* html */`
        <div class="og-swatch" data-path="${item.path}" data-label="${item.label}" title="${item.label}">
          <div class="og-swatch-thumb-wrap">
            <img class="og-swatch-thumb" src="${item.path}" alt="${item.label}" loading="lazy">
          </div>
          <span class="og-swatch-label">${item.label}</span>
        </div>
      `).join('')

      gridEl.querySelectorAll('.og-swatch').forEach(swEl => {
        swEl.addEventListener('click', () => {
          this._selectTexture(swEl.dataset.path, swEl.dataset.label)
        })
      })
    }

    if (footerEl) {
      footerEl.textContent = `⟐g  ${items.length} texture${items.length === 1 ? '' : 's'}`
    }
  }

  // ── Selection ────────────────────────────────────────────────────────────

  _selectTexture (path, label) {
    window.dispatchEvent(new CustomEvent('omni:gallery-texture-select', {
      detail: { path, label }
    }))
    this._playSound('click')
    if (this._selectMode) this.close()
  }

  // ── Persistence — which folders are expanded / last active folder ────────

  _save () {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({
        expanded: Array.from(this._expanded),
        active  : this._activeFolderId,
      }))
    } catch (err) {
      console.warn('⟐g — localStorage save failed:', err)
    }
  }

  _load () {
    try {
      const raw = localStorage.getItem(STORE_KEY)
      if (!raw) return
      const data = JSON.parse(raw)
      if (Array.isArray(data.expanded)) this._expanded = new Set(data.expanded)
      if (typeof data.active === 'string') this._activeFolderId = data.active
    } catch (err) {
      console.warn('⟐g — localStorage load failed:', err)
    }
  }

  // ── Sound (mirrors OmniPresenter's own pattern) ───────────────────────────

  _playSound (id) {
    try {
      const Sound = this.ctx?.Sound
      if (Sound && typeof Sound.play === 'function') Sound.play(id)
    } catch (_) {}
  }
}
