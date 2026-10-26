/**
 * systems/OmniStoreScene.js — ⟐OmniStore's 3D shelf (V176, SANDBOX)
 *
 * A shelf of the current section's products placed at a store anchor in front of the landing view, away from the origin
 * tunnels. Hidden until `omni:store-open` (ribbon, drawer ⟐OmniStore); `omni:store-close` hides it.
 *
 * PRODUCT GEOMETRY (per product, switchable: product.shape)
 *   cube  BoxGeometry, the SAME texture on all six faces (six basic materials, slightly tinted per face for depth).
 *   disc  two CircleGeometry panels BACK-TO-BACK (the back one turned 180° about Y) + a thin rim. Each panel is
 *         front-face-only on purpose: one DoubleSide panel would show the texture MIRRORED from behind (emoji and text
 *         reversed); two opposed panels read correctly from both sides.
 * TEXTURE = the product's ACTIVE media kind: emoji -> CanvasTexture (cache by emoji + size, ref-counted, disposed when
 *   unused and on destroy); image -> TextureLoader (URL or data URL; the emoji shows until it loads, and stays on error);
 *   video -> muted looping <video> + VideoTexture (at most MAX_VIDEOS at once; beyond that the emoji is kept).
 *
 * Interaction: hover = ring + spin + tooltip + `omni:notify-info`; click / tap = select -> `omni:store-product-select`
 * and `omni:exchange-open {productId}` (ui/OmniExchangeRadial.js opens). Products are NOT registered as OmniNodes: this
 * module owns its meshes. At most `perPage` (default 24, dev knob 6..60) products are on screen, with pagination; all geometry is shared.
 * No per-frame allocation: update() only touches pooled slots.
 *
 * Events consumed: omni:store-open {sectionId?, productId?, fly?}, omni:store-close, omni:nav-select (⟐OmniStore),
 *   omni:store-changed, omni:identity-changed, omni:value-changed (none needed; the shelf shows no balances).
 * Events dispatched: omni:store-state {open, sectionId, page, pages, count}, omni:store-product-select {productId},
 *   omni:exchange-open {productId, mode:'buy'}, omni:notify-info, omni:orbit-target-set (when it flies the camera).
 *
 * V179 — SWAPPABLE LAYOUTS (BuildOrder item 4). Where the products go and what the store looks like come from
 * utils/OmniStoreLayouts.js (pure data: placements + furniture + camera). This module only APPLIES a layout in place:
 * the pooled slot meshes are re-positioned / re-oriented, the pooled FURNITURE meshes (plank, wall, floor, pillar, table, rail;
 * shared geometries + the settings-coloured shared materials) are re-assigned, extra pooled furniture is released on close.
 * Layout id = the store's `layout` setting (OmniStoreSettings), or a temporary dev preview (omni:store-layout-set {layout, preview:true}).
 * Events consumed (added): omni:store-layout-set {layout, preview?}  (layout persists via OmniStoreSettings; preview does not).
 * Camera: flyToLayout() (flyToShelf is kept as an alias); ring: setView('inside'|'outside'); aisle: stepStop(+1|-1). Arrow keys are NOT
 * bound (ui/MovementPad.js / OmniKeys.js own them globally): the HUD buttons are the way.
 *
 * V182 — SEVERAL STORES (BuildOrder item 6). The scene shows ONE store, the identity's ACTIVE store (OmniStoreModel.activeStoreId); the others are not loaded
 * at all (the mall-hub rule). A switch (omni:store-changed {kind:'active-store'}, or a new identity) runs _storeSwitched(): re-point the anchor / group, apply the
 * store's look, rebuild the SAME pooled slots and furniture in place (no new meshes, textures or videos pile up) and fly to the new layout's default view.
 * HUD: a store chip (emoji + name, hidden while you own one store) with a small menu; it calls Store.setActiveStore like the Stores tab does.
 *
 * Module contract: constructor(ctx, opts) / init / update / destroy / onResize.
 */

import * as THREE from 'three'
import gsap from 'gsap'
import * as Store from '../utils/OmniStoreModel.js'
import * as Value from '../utils/OmniValueModel.js'
import { handsSafe, DOCK_H, isPhone } from '../utils/OmniStoreLayout.js'
import * as Look from '../utils/OmniStoreSettings.js'
import * as Layouts from '../utils/OmniStoreLayouts.js'   // V179: pure layout engine
import * as DevData from '../utils/DevOmniStoreData.js'   // V177: ONLY the per-page knob (default 24 when no dev data); nothing user-facing depends on the dev panel

export const PER_PAGE = 24   // the default; the live value comes from DevOmniStoreData.getItemsPerPage() (6..60)
export const BACKDROP_RADIUS = 120
export const BACKDROP_ORDER = -1.5   // after the wallpaper sphere (-2, modules/WallpaperSphere.js: depthWrite false) so it is not painted over, before the domain grid (-1)
export const MAX_VIDEOS = 4
export const TEX_SIZE = 256
export const DEFAULT_ANCHOR = Look.DEFAULT_ANCHOR   // V181: defined in OmniStoreSettings (the location is now a user setting); re-exported for old imports
const SPACING = Layouts.SPACING
export const STOP_GLIDE_S = 0.9
const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Twemoji Mozilla",sans-serif'
const FACE_TINT = [0.82, 0.82, 1, 0.6, 1, 0.82]   // +x -x +y -y +z -z

const STYLES = `
.osh { position: fixed; left: 50%; transform: none; top: calc(var(--omni-top-offset, 96px) + 6px); z-index: 44;
  width: min(640px, calc(100vw - 16px)); box-sizing: border-box; display: none; flex-direction: column; gap: 4px; padding: 6px 8px;
  font-family: 'Courier New', Courier, monospace; font-size: 11px; color: var(--omni-theme-text, rgba(255,255,255,.92));
  background: var(--omni-theme-bg, rgba(8,8,12,.82)); border: 1px solid var(--omni-theme-border, rgba(255,255,255,.14)); border-radius: 10px;
  backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); pointer-events: auto; }
.osh.is-open { display: flex; }
.osh-row { display: flex; align-items: center; gap: 6px; min-width: 0; }
.osh-title { letter-spacing: .06em; white-space: nowrap; }
.osh-sandbox { padding: 1px 6px; border-radius: 4px; background: #ffb02e; color: #1b1200; font-weight: bold; letter-spacing: .08em; white-space: nowrap; }
.osh-spacer { flex: 1; }
.osh-btn { min-height: 28px; min-width: 28px; padding: 2px 8px; font: inherit; color: inherit; cursor: pointer; border-radius: 6px;
  background: rgba(255,255,255,.07); border: 1px solid var(--omni-theme-border, rgba(255,255,255,.18)); }
.osh-btn:hover:not(:disabled) { background: rgba(255,255,255,.16); border-color: var(--osh-hover, rgba(255,255,255,.5)); }
.osh-btn:disabled { opacity: .35; cursor: default; }
.osh-chips { display: flex; gap: 4px; overflow-x: auto; flex: 1; min-width: 0; scrollbar-width: none; padding-bottom: 1px; }
.osh-chips::-webkit-scrollbar { display: none; }
.osh-chip { flex: 0 0 auto; min-height: 28px; padding: 2px 9px; font: inherit; color: inherit; cursor: pointer; border-radius: 14px; white-space: nowrap;
  background: rgba(255,255,255,.05); border: 1px solid var(--omni-theme-border, rgba(255,255,255,.18)); }
.osh-chip.is-media { border-style: dashed; }
.osh-chip:hover { border-color: var(--osh-hover, rgba(255,255,255,.5)); }
.osh-chip.is-active { background: rgba(255,255,255,.24); border-color: var(--osh-select, rgba(255,255,255,.75)); box-shadow: 0 0 0 1px var(--osh-select, transparent); }
.osh-layoutrow { flex-wrap: wrap; }
.osh-stop { white-space: nowrap; min-width: 64px; text-align: center; }
.osh-storebtn { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.osh-menu { display: none; position: absolute; left: 6px; top: calc(100% + 4px); z-index: 47; flex-direction: column; gap: 2px; min-width: 200px; max-width: calc(100vw - 32px); max-height: 50vh; overflow-y: auto; padding: 4px;
  background: var(--omni-theme-bg, rgba(8,8,12,.96)); border: 1px solid var(--omni-theme-border, rgba(255,255,255,.22)); border-radius: 8px; }
.osh-menu.is-open { display: flex; }
.osh-menu button { display: block; width: 100%; min-height: 32px; text-align: left; padding: 3px 8px; font: inherit; color: inherit; cursor: pointer; border-radius: 6px; background: transparent; border: 1px solid transparent; white-space: normal; overflow-wrap: anywhere; }
.osh-menu button:hover { background: rgba(255,255,255,.12); }
.osh-menu button[aria-checked="true"] { background: rgba(255,255,255,.2); border-color: var(--osh-select, rgba(255,255,255,.6)); }
.osh [hidden] { display: none !important; }
.osh-pager { display: flex; align-items: center; gap: 4px; flex: 0 0 auto; }
.osh-tip { position: fixed; z-index: 46; pointer-events: none; display: none; max-width: 240px; padding: 4px 8px; border-radius: 6px;
  font-family: 'Courier New', Courier, monospace; font-size: 11px; color: #fff; background: rgba(8,8,12,.88); border: 1px solid rgba(255,255,255,.22); }
@media (max-width: 700px) {
  .osh { padding: 5px 6px; } .osh-btn, .osh-chip { min-height: 36px; } .osh-title { font-size: 10px; }
}
`

function injectStyles () {
  if (typeof document === 'undefined' || document.getElementById('omni-store-hud-styles')) return
  const s = document.createElement('style')
  s.id = 'omni-store-hud-styles'
  s.textContent = STYLES
  document.head.appendChild(s)
}

const mkEl = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e }

export default class OmniStoreScene {
  /**
   * @param {{scene:THREE.Scene, camera:THREE.Camera, renderer:{domElement:HTMLElement}}} ctx
   * @param {{anchor?:number[], loadImage?:Function, maxVideos?:number}} [opts]  test hooks: loadImage(url, onLoad, onError)
   */
  constructor (ctx, opts = {}) {
    this.ctx = ctx
    this.anchor = [...(opts.anchor ?? Look.getSettings().anchor)]   // V181: the user's saved location (setting `anchor`); opts.anchor is a test hook
    this._loadImage = opts.loadImage ?? null
    this.maxVideos = opts.maxVideos ?? MAX_VIDEOS
    this._open = false
    this._inited = 0
    this._page = 0
    this._time = 0
    this._dirty = true
    this._cols = 6
    this._rows = 4
    this._slots = []
    this._hit = []
    this._cache = new Map()
    this._videoEntries = []
    this._hover = -1
    this._selectedId = null
    this._down = null
    this._pointer = { x: 0, y: 0 }
    this._hudRefs = null
    this._flyTween = null
    this._geo = {}
    this._mats = {}
    this.group = null
    this._perPage = PER_PAGE
    this._backdrop = null
    this._fps = 0
    this._look = null
    this._layoutId = Layouts.DEFAULT_LAYOUT   // V179: the layout currently built (setting, or the dev preview)
    this._previewLayout = null
    this._spec = null                         // the last Layouts.build() result
    this._view = 'outside'                    // ring: 'outside' | 'inside'
    this._stop = 0                            // aisle: index into spec.camera.stops (0 = entrance)
    this._pools = null                        // furniture mesh pools by geometry: plank, plane, box, cyl, annulus
    this._occ = []                            // visible furniture meshes (occluders for picking, non-shelf layouts)
    this._opening = false
    this._snapRot = false
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  init () {
    this._inited++   // BaseScene.addModule() calls init(); a second call must not double everything (V170 bug)
    if (this._inited > 1) return
    injectStyles()
    Look.attach()
    this._perPage = DevData.getItemsPerPage()
    this._buildShared()
    this._buildGroup()
    this._ray = new THREE.Raycaster()
    this._ndc = new THREE.Vector2()
    this._tmpV = new THREE.Vector3()

    this._on = {
      open: (e) => this.open(e.detail ?? {}),
      close: () => this.close(),
      nav: (e) => { if (e.detail?.item === '⟐OmniStore') this.open({}) },
      changed: (e) => { this._dirty = true; const k = e.detail?.kind; if (k === 'active-store') this._storeSwitched(); else if (typeof k === 'string' && k.startsWith('store-')) this._syncStoreChip() },
      identity: () => { this._dirty = true; this._storeSwitched() },   // another identity has its own stores: show ITS active store
      key: (e) => { if (e.key === 'Escape' && this._menuOpen) this._toggleMenu(false) },
      outside: (e) => { if (this._menuOpen && !this._hud?.contains(e.target)) this._toggleMenu(false) },
      look: (e) => {
        const id = e.detail?.storeId
        if (id && id !== Look.currentStoreId()) return
        if (this._previewLayout && (e.detail?.key === 'layout' || e.detail?.keys?.includes('layout'))) this._previewLayout = null   // the user picked a layout: a dev preview ends
        this._applyLook()
        if (e.detail?.key === 'anchor' || e.detail?.keys?.includes('anchor')) this._syncAnchor()   // V181: the store location changed
      },
      placeAtCamera: () => this.placeAtCamera(),
      dev: (e) => { if (!e.detail?.key || e.detail.key === 'perf') this._setPerPage(DevData.getItemsPerPage()) },
      stats: (e) => { if (e.detail && typeof e.detail === 'object') e.detail.out = this.getStats() },
      select: (e) => { this._selectedId = e.detail?.productId ?? null; this._placeRings() },
      exchangeClosed: () => { this._selectedId = null; this._placeRings() },
      xrState: (e) => { const was = this._xr; this._xr = e.detail ?? null; this._placeHud(); if (this._open && this._xr?.open && !was?.open) this.flyToLayout() },
      layout: () => { if (this._open) this._placeHud() },
      panel: () => { if (this._open) { this._placeHud(); this.flyToLayout() } },
      layoutSet: (e) => this._onLayoutSet(e.detail ?? {}),
    }
    window.addEventListener('omni:store-open', this._on.open)
    window.addEventListener('omni:store-close', this._on.close)
    window.addEventListener('omni:nav-select', this._on.nav)
    window.addEventListener(Store.CHANGED_EVENT, this._on.changed)
    window.addEventListener('omni:identity-changed', this._on.identity)
    window.addEventListener(Look.CHANGED_EVENT, this._on.look)
    window.addEventListener(DevData.CHANGED_EVENT, this._on.dev)
    window.addEventListener('omni:store-stats-get', this._on.stats)
    window.addEventListener('omni:store-product-select', this._on.select)
    window.addEventListener('omni:exchange-closed', this._on.exchangeClosed)
    window.addEventListener('omni:exchange-state', this._on.xrState)
    window.addEventListener('omni:layout-changed', this._on.layout)
    window.addEventListener('omni:store-panel-changed', this._on.panel)
    window.addEventListener('omni:store-layout-set', this._on.layoutSet)
    window.addEventListener('omni:store-place-at-camera', this._on.placeAtCamera)
    window.addEventListener('resize', this._on.layout)
    window.addEventListener('keydown', this._on.key)

    const el = this.ctx.renderer?.domElement
    this._canvas = el ?? null
    if (el) {
      this._ptr = {
        move: (e) => this._onPointerMove(e),
        down: (e) => this._onPointerDown(e),
        up: (e) => this._onPointerUp(e),
        leave: () => this._setHover(-1),
      }
      el.addEventListener('pointermove', this._ptr.move)
      el.addEventListener('pointerdown', this._ptr.down)
      el.addEventListener('pointerup', this._ptr.up)
      el.addEventListener('pointerleave', this._ptr.leave)
    }
  }

  onResize () { if (this._open) { this._dirty = true; this._placeHud() } }

  destroy () {
    if (this._inited === 0) return
    window.removeEventListener('omni:store-open', this._on.open)
    window.removeEventListener('omni:store-close', this._on.close)
    window.removeEventListener('omni:nav-select', this._on.nav)
    window.removeEventListener(Store.CHANGED_EVENT, this._on.changed)
    window.removeEventListener('omni:identity-changed', this._on.identity)
    window.removeEventListener(Look.CHANGED_EVENT, this._on.look)
    window.removeEventListener(DevData.CHANGED_EVENT, this._on.dev)
    window.removeEventListener('omni:store-stats-get', this._on.stats)
    window.removeEventListener('omni:store-product-select', this._on.select)
    window.removeEventListener('omni:exchange-closed', this._on.exchangeClosed)
    window.removeEventListener('omni:exchange-state', this._on.xrState)
    window.removeEventListener('omni:layout-changed', this._on.layout)
    window.removeEventListener('omni:store-panel-changed', this._on.panel)
    window.removeEventListener('omni:store-layout-set', this._on.layoutSet)
    window.removeEventListener('omni:store-place-at-camera', this._on.placeAtCamera)
    window.removeEventListener('resize', this._on.layout)
    window.removeEventListener('keydown', this._on.key)
    window.removeEventListener('pointerdown', this._on.outside)
    if (this._canvas && this._ptr) {
      this._canvas.removeEventListener('pointermove', this._ptr.move)
      this._canvas.removeEventListener('pointerdown', this._ptr.down)
      this._canvas.removeEventListener('pointerup', this._ptr.up)
      this._canvas.removeEventListener('pointerleave', this._ptr.leave)
    }
    this._flyTween?.kill()
    this._disposeBackdrop()
    Look.detach()
    this._slots.forEach(s => this._releaseHeld(s))
    ;[...this._cache.keys()].forEach(k => this._disposeEntry(k))
    this._slots.forEach(s => s.mats.forEach(m => m.dispose()))
    Object.values(this._geo).forEach(g => g.dispose())
    Object.values(this._mats).forEach(m => m.dispose())
    this.ctx.scene.remove(this.group)
    this._hud?.parentNode?.removeChild(this._hud)
    this._tip?.parentNode?.removeChild(this._tip)
    this._inited = 0
    this._open = false
  }

  // ── Build ───────────────────────────────────────────────────────────────────

  _buildShared () {
    this._geo = {
      cube: new THREE.BoxGeometry(0.9, 0.9, 0.9),
      circle: new THREE.CircleGeometry(0.46, 40),
      rim: new THREE.CylinderGeometry(0.46, 0.46, 0.04, 40, 1, true),
      ring: new THREE.RingGeometry(0.56, 0.63, 40),
      unit: new THREE.PlaneGeometry(1, 1),
      plank: new THREE.BoxGeometry(1, 0.1, 0.7),
      box1: new THREE.BoxGeometry(1, 1, 1),                         // V179 furniture: table slabs / risers (scaled)
      cyl: new THREE.CylinderGeometry(1, 1, 1, 40),                 // pillars, round floors (scaled)
      annulus: new THREE.RingGeometry(0.86, 1, 64),                 // ring-shelf band (scaled, laid flat)
    }
    this._geo.rim.rotateX(Math.PI / 2)
    this._mats = {
      rim: new THREE.MeshBasicMaterial({ color: 0x5b4a36, toneMapped: false }),
      back: new THREE.MeshBasicMaterial({ color: 0xd8cdb9, toneMapped: false }),
      plank: new THREE.MeshBasicMaterial({ color: 0xa57d52, toneMapped: false }),
      floor: new THREE.MeshBasicMaterial({ color: 0x7b5e3d, toneMapped: false, side: THREE.DoubleSide }),   // V179: floors / ring shelf band: the plank colour, darker
      hover: new THREE.MeshBasicMaterial({ color: 0xffb02e, toneMapped: false, transparent: true, opacity: 0.95, depthTest: false, side: THREE.DoubleSide }),
      select: new THREE.MeshBasicMaterial({ color: 0x2e9bff, toneMapped: false, transparent: true, opacity: 0.95, depthTest: false, side: THREE.DoubleSide }),
    }
  }

  _buildGroup () {
    const g = new THREE.Group()
    g.name = 'OmniStoreShelf'
    g.position.set(this.anchor[0], this.anchor[1], this.anchor[2])
    g.visible = false
    this.back = new THREE.Mesh(this._geo.unit, this._mats.back)
    this.back.position.z = -0.65
    g.add(this.back)
    this.planks = []
    this._pools = { plank: this.planks, plane: [this.back], box: [], cyl: [], annulus: [] }
    this.group = g
    this._ensurePlanks(6)
    this._ensurePool(this._perPage, g)
    this.hoverRing = new THREE.Mesh(this._geo.ring, this._mats.hover)
    this.selectRing = new THREE.Mesh(this._geo.ring, this._mats.select)
    this.hoverRing.visible = this.selectRing.visible = false
    this.hoverRing.renderOrder = this.selectRing.renderOrder = 10
    g.add(this.hoverRing, this.selectRing)
    this.ctx.scene.add(g)
    this._applyLook()
  }

  /** Grow the slot pool to n (never shrinks; slots past the per-page count stay hidden). New meshes are appended to the group. */
  _ensurePool (n, g = this.group) {
    while (this._slots.length < n) g.add(this._buildSlot(this._slots.length).group)
  }
  _ensurePlanks (n) {
    while (this.planks.length < n) { const p = new THREE.Mesh(this._geo.plank, this._mats.plank); p.visible = false; this.group.add(p); this.planks.push(p) }
  }

  // ── Furniture pools (V179) ───────────────────────────────────────────────────
  // geometry per pool; the shared materials come from the store settings. `back` is plane[0] (the shelf's back panel, as before).
  static get POOL_GEO () { return { plank: 'plank', plane: 'unit', box: 'box1', cyl: 'cyl', annulus: 'annulus' } }
  _addFurnitureMesh (pool) {
    const m = new THREE.Mesh(this._geo[OmniStoreScene.POOL_GEO[pool]], this._mats.plank)
    m.visible = false
    m.userData.furniture = pool
    this.group.add(m)
    this._pools[pool].push(m)
    return m
  }
  _furnitureCount () { return Object.values(this._pools).reduce((n, a) => n + a.length, 0) }
  _furnitureVisible () { return Object.values(this._pools).reduce((n, a) => n + a.filter(m => m.visible).length, 0) }

  /** Re-assign the pooled furniture meshes to a layout's furniture list (grows a pool only when a layout needs more). */
  _applyFurniture (list) {
    const used = { plank: 0, plane: 0, box: 0, cyl: 0, annulus: 0 }
    const M = this._mats
    this._occ.length = 0
    for (let k = 0; k < list.length; k++) {
      const f = list[k]
      let pool, mat = 'plank'
      switch (f.kind) {
        case 'plank': pool = 'plank'; break
        case 'wall': pool = 'plane'; mat = 'back'; break
        case 'floor': pool = f.shape === 'plane' ? 'plane' : 'cyl'; mat = 'floor'; break
        case 'pillar': pool = 'cyl'; mat = M[f.mat] ? f.mat : 'plank'; break
        case 'table': pool = 'box'; break
        case 'rail': pool = 'annulus'; mat = 'floor'; break
        default: continue
      }
      const arr = this._pools[pool]
      const i = used[pool]++
      const m = i < arr.length ? arr[i] : this._addFurnitureMesh(pool)
      m.material = M[mat]
      m.visible = true
      m.rotation.set(0, 0, 0)
      m.position.set(f.x, f.y, f.z)
      switch (f.kind) {
        case 'plank': m.rotation.y = f.ry ?? 0; m.scale.set(f.sx ?? 1, 1, f.sz ?? 1); break
        case 'wall': m.rotation.y = f.ry ?? 0; m.scale.set(f.sx ?? 1, f.sy ?? 1, 1); break
        case 'floor': if (f.shape === 'plane') { m.rotation.x = -Math.PI / 2; m.scale.set(f.sx ?? 1, f.sz ?? 1, 1) } else m.scale.set(f.r ?? 1, f.h ?? 0.06, f.r ?? 1); break
        case 'pillar': m.scale.set(f.r ?? 0.1, f.h ?? 1, f.r ?? 0.1); break
        case 'table': m.rotation.y = f.ry ?? 0; m.scale.set(f.sx ?? 1, f.sy ?? 1, f.sz ?? 1); break
        case 'rail': m.rotation.x = -Math.PI / 2; m.scale.set(f.r ?? 1, f.r ?? 1, 1); break
      }
      if (this._layoutId !== 'shelf') this._occ.push(m)
    }
    for (const key in this._pools) { const arr = this._pools[key]; for (let i = used[key]; i < arr.length; i++) arr[i].visible = false }
  }

  /** Drop the pooled furniture beyond the shelf's baseline (6 planks + the back panel) and the other pools: frees the meshes of the old layout. Geometries / materials are shared and disposed in destroy(). */
  _trimFurniture () {
    for (const key in this._pools) {
      const arr = this._pools[key]
      const keep = key === 'plank' ? 6 : key === 'plane' ? 1 : 0
      while (arr.length > keep) { const m = arr.pop(); this.group.remove(m) }
    }
    this._occ.length = 0
  }

  _buildSlot (i) {
    const group = new THREE.Group()
    group.visible = false
    // cube: six materials sharing one texture, tinted per face
    const mats = FACE_TINT.map(t => new THREE.MeshBasicMaterial({ color: new THREE.Color(t, t, t), toneMapped: false }))
    const cube = new THREE.Mesh(this._geo.cube, mats)
    // disc: two opposed front-face panels (they share the first material) + rim
    const faceA = new THREE.Mesh(this._geo.circle, mats[4])
    const faceB = new THREE.Mesh(this._geo.circle, mats[4])
    faceA.position.z = 0.021
    faceB.position.z = -0.021
    faceB.rotation.y = Math.PI
    const rim = new THREE.Mesh(this._geo.rim, this._mats.rim)
    const disc = new THREE.Group()
    disc.add(faceA, faceB, rim)
    group.add(cube, disc)
    const slot = { i, group, cube, disc, faceA, faceB, mats, productId: null, held: [], shownKey: '', wantKey: '', baseX: 0, baseY: 0, baseZ: 0, ry: 0, rx: 0, baseScale: 1, shape: 'cube', hoverAmt: 0, scale: 1 }
    cube.userData.slot = i; faceA.userData.slot = i; faceB.userData.slot = i
    this._slots.push(slot)
    return slot
  }

  // ── Look (OmniStoreSettings) ────────────────────────────────────────────────

  /**
   * Read the user's OmniStoreSettings for the current store and apply them: material colours (no rebuild of the shelf),
   * HUD accents and name, and the backdrop. Cheap, so it runs on every settings event.
   */
  _applyLook () {
    if (!this._mats.rim) return
    const L = Look.getSettings()
    this._look = L
    const c = L.colors
    this._mats.rim.color.setHex(Look.hexToInt(c.shelfRim))
    this._mats.back.color.setHex(Look.hexToInt(c.shelfBack))
    this._mats.plank.color.setHex(Look.hexToInt(c.shelfPlank))
    this._mats.floor.color.setHex(Look.hexToInt(c.shelfPlank)).multiplyScalar(0.72)   // V179: floors are the plank colour, darker
    this._mats.hover.color.setHex(Look.hexToInt(c.hover))
    this._mats.select.color.setHex(Look.hexToInt(c.selected))
    if (this._hud) {
      this._hud.style.setProperty('--osh-hover', c.hover)
      this._hud.style.setProperty('--osh-select', c.selected)
    }
    this._syncTitle()
    if (this._open) this._applyBackdrop(L)
    else this._disposeBackdrop()
    const want = this._previewLayout ?? Layouts.normalizeId(L.layout)
    if (want !== this._layoutId) {
      this._layoutId = want
      if (this._open && !this._opening) this._afterLayoutChange()
    }
  }

  // ── Store location (V181) ────────────────────────────────────────────────────

  /**
   * Move the whole store to x, y, z (clamped like the setting; a bad axis is ignored) and SAVE it (OmniStoreSettings `anchor`).
   * The change comes back through omni:store-settings-changed -> _syncAnchor(), which does the live move. Returns the saved [x,y,z]
   * or null when nothing valid was given.
   */
  setAnchor (x, y, z) {
    const next = Look.normalizeAnchor([x, y, z], this.anchor)
    Look.setSettings({ anchor: next })
    this._syncAnchor()   // idempotent; also covers a settings write that failed to emit
    return [...this.anchor]
  }

  /** Make the group follow the saved anchor. If the camera is near the store (viewing it), camera and orbit target move by the same delta, so the view is unchanged. */
  _syncAnchor () {
    const want = Look.getSettings().anchor
    const old = this.anchor
    if (want[0] === old[0] && want[1] === old[1] && want[2] === old[2]) return false
    const d = [want[0] - old[0], want[1] - old[1], want[2] - old[2]]
    const cam = this.ctx.camera
    const viewing = this._open && !!this.group && cam.position.distanceTo(this.group.position) < BACKDROP_RADIUS * 0.92   // the same "inside the dome" test the backdrop uses
    this.anchor = [...want]
    this.group?.position.set(want[0], want[1], want[2])
    if (viewing) {
      const flying = this._flyTween?.isActive?.() === true
      cam.position.x += d[0]; cam.position.y += d[1]; cam.position.z += d[2]
      if (this._lastFly) {
        this._lastFly.pos = this._lastFly.pos.map((v, i) => v + d[i]); this._lastFly.target = this._lastFly.target.map((v, i) => v + d[i])
        const [tx, ty, tz] = this._lastFly.target
        window.dispatchEvent(new CustomEvent('omni:orbit-target-set', { detail: { x: tx, y: ty, z: tz } }))   // the orbit pivot moves with the store
        if (!flying) cam.lookAt(tx, ty, tz)
      }
      if (flying) this.flyToLayout(0.5)   // a glide in progress was aimed at the old place: re-aim it from where the camera is now
    }
    if (this._open) this._emitState()
    return true
  }

  // ── Switching stores (V182) ──────────────────────────────────────────────────

  /**
   * The active store (or the identity) changed. One rebuild, in place: the group moves to the new store's anchor, its look and layout are applied,
   * the view / page / selection reset and (store open) the camera flies to the new layout's default view. Closed: only the hidden group and the look follow.
   */
  _storeSwitched () {
    if (!this._inited || !this.group) return
    this._toggleMenu(false)
    const want = Look.getSettings().anchor
    this.anchor = [...want]
    this.group.position.set(want[0], want[1], want[2])
    this._previewLayout = null
    this._selectedId = null
    this._view = 'outside'; this._stop = 0; this._page = 0; this._snapRot = true
    this._setHover(-1); this._hideTip()
    this._opening = true       // _applyLook must not start its own rebuild + fly: this method does it once
    try { this._applyLook() } finally { this._opening = false }
    if (this._open) {
      this._rebuild(); this._emitState()
      const cam = this.ctx.camera.position, a = this.anchor
      const far = Math.hypot(cam.x - a[0], cam.y - a[1], cam.z - a[2])
      this.flyToLayout(Math.min(2.4, 1.2 + far / 600))   // a far store gets a slightly longer glide; the camera always ends in front of the new store
    } else this._dirty = true
    this._placeRings()
  }

  /** Make another of your stores the active one (the HUD chip and the Stores tab use the same model call). */
  switchStore (id) { return Store.setActiveStore(id) }

  /** Put the store about 30 units in front of the camera's look direction, at the camera's height (the layout is not turned). */
  placeAtCamera (dist = 30) {
    const cam = this.ctx.camera
    const dir = new THREE.Vector3()
    cam.getWorldDirection(dir)
    dir.y = 0
    if (dir.lengthSq() < 1e-6) dir.set(0, 0, -1)   // looking straight up / down: use the default facing
    dir.normalize()
    return this.setAnchor(cam.position.x + dir.x * dist, cam.position.y, cam.position.z + dir.z * dist)
  }

  // ── Layout switching (V179) ──────────────────────────────────────────────────

  get layoutId () { return this._layoutId }
  get layoutSpec () { return this._spec }
  get previewLayout () { return this._previewLayout }

  /** The layout changed while the store is open: rebuild in place, reset the camera state and fly to the new layout's default pose. */
  _afterLayoutChange () {
    this._view = 'outside'
    this._stop = 0
    this._snapRot = true
    this._rebuild()
    this._emitState()
    this.flyToLayout()
  }

  _onLayoutSet (d) {
    if (d.preview === true) { if (d.layout === null || d.layout === undefined) this.clearPreview(); else this.previewLayoutSet(d.layout); return }
    if (d.preview === false && (d.layout === null || d.layout === undefined)) { this.clearPreview(); return }
    this.setLayout(d.layout)
  }

  /** Persist a layout for the current store (OmniStoreSettings). Unknown ids are ignored. Ends a dev preview. */
  setLayout (id) {
    if (!Layouts.isLayoutId(id)) return false
    if (this._previewLayout) { this._previewLayout = null; this._applyLook() }
    Look.setSettings({ layout: id })
    return true
  }

  /** TEMPORARY layout (dev preview): not persisted; ends on close, on clearPreview(), or when the user picks a layout. */
  previewLayoutSet (id) {
    if (!Layouts.isLayoutId(id) || !this._open) return false   // a preview applies to the OPEN store only
    this._previewLayout = id
    this._applyLook()
    this._syncHud()
    return true
  }
  clearPreview () {
    if (!this._previewLayout) return false
    this._previewLayout = null
    this._applyLook()
    this._syncHud()
    return true
  }

  _syncTitle () {
    const t = this._hudRefs?.title
    if (!t) return
    const nm = this._look?.name
    t.textContent = nm ? `⟐${nm}` : '⟐OmniStore'
    this._hud.setAttribute('aria-label', nm || 'OmniStore')
  }

  /**
   * The store backdrop: ONE inward-facing sphere (radius BACKDROP_RADIUS) centred on the shelf anchor, a child of the
   * shelf group (so it follows the anchor and is hidden whenever the store is). Why a dome and not a back panel: orbiting
   * around the shelf never shows an edge, and one cheap unlit mesh (MeshBasicMaterial, BackSide, fog off) costs one draw call.
   * renderOrder -1.5: the app's wallpaper sphere is renderOrder -2 with depthWrite false, so a dome drawn before it (first
   * attempt, -1000) was painted over by the wallpaper (found in Chromium); -1.5 draws after it and before the domain grid (-1).
   * depthWrite is ON while opaque (the wallpaper / stars beyond the dome then fail the depth test) and OFF while translucent
   * (it only tints what is behind it). The camera far plane is 1e5 with a logarithmic
   * depth buffer, so R=120 is far inside it. Outside the store nothing of it exists (disposed on close / mode none), and
   * zoomed far out of the dome (> 0.92 R from the anchor) it is hidden so it can never become a coloured ball over the
   * wallpaper. Gradient = vertex colours (colour at the top, second colour at the bottom); solid = both ends equal.
   */
  _applyBackdrop (L) {
    const b = L.backdrop
    if (b.mode === 'none') { this._disposeBackdrop(); return }
    if (!this._backdrop) {
      const geo = new THREE.SphereGeometry(BACKDROP_RADIUS, 32, 16)
      geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 3), 3))
      const mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, depthWrite: true, toneMapped: false, fog: false })
      const m = new THREE.Mesh(geo, mat)
      m.name = 'OmniStoreBackdrop'
      m.renderOrder = BACKDROP_ORDER
      m.frustumCulled = false
      m.raycast = () => {}   // never intercepts a pick
      this.group.add(m)
      this._backdrop = m
    }
    const m = this._backdrop
    const top = new THREE.Color(Look.hexToInt(L.colors.backdrop ?? b.color))
    const bottom = b.mode === 'gradient' ? new THREE.Color(Look.hexToInt(b.color2)) : top
    const pos = m.geometry.attributes.position, col = m.geometry.attributes.color
    const tmp = new THREE.Color()
    for (let i = 0; i < pos.count; i++) {
      tmp.copy(bottom).lerp(top, (pos.getY(i) / BACKDROP_RADIUS + 1) / 2)
      col.setXYZ(i, tmp.r, tmp.g, tmp.b)
    }
    col.needsUpdate = true
    const transparent = b.opacity < 1
    if (m.material.transparent !== transparent) { m.material.transparent = transparent; m.material.needsUpdate = true }
    m.material.depthWrite = !transparent   // opaque: write depth so the scene's far objects (the wallpaper sphere, stars) cannot draw over the dome; translucent: tint what is behind
    m.material.opacity = b.opacity
    m.visible = true
  }

  _disposeBackdrop () {
    const m = this._backdrop
    if (!m) return
    this.group?.remove(m)
    m.geometry.dispose()
    m.material.dispose()
    this._backdrop = null
  }

  /** Dev knob: products per shelf page (6..60). Keeps the first product on screen where it can. */
  _setPerPage (n) {
    const v = DevData.clampPerPage(n)
    if (v === this._perPage) return
    const first = this._page * this._perPage
    this._perPage = v
    this._page = Math.floor(first / v)
    this._ensurePool(v)
    this._dirty = true
    if (this._open) { this._rebuild(); this._emitState() }
  }

  /** Live numbers for the dev panel (read via the omni:store-stats-get event). */
  getStats () {
    const info = this.ctx.renderer?.info
    const shown = this._visibleCount()
    return {
      open: this._open, perPage: this._perPage, page: this._page, pages: this.pages, productsShown: shown, productsInSection: this._products().length,
      slotsBuilt: this._slots.length, meshes: this._slots.reduce((n, s) => n + (s.productId ? (s.shape === 'cube' ? 1 : 3) : 0), 0),
      texturesCached: this._cache.size, activeVideos: this._videoCount(), backdrop: !!this._backdrop,
      drawCalls: info?.render?.calls ?? null, triangles: info?.render?.triangles ?? null, gpuGeometries: info?.memory?.geometries ?? null, gpuTextures: info?.memory?.textures ?? null,
      fps: this._open && this._fps > 0 ? Math.round(this._fps) : null,
      furnitureMeshes: this._furnitureVisible(), furnitureBuilt: this._furnitureCount(),
      anchor: [...this.anchor],
      storeId: Store.activeStoreId(), stores: Store.listStores().length, groupChildren: this.group.children.length,
      layout: this._layoutStats(),
    }
  }

  _layoutStats () {
    const sp = this._spec
    if (!sp) return { id: this._layoutId, preview: !!this._previewLayout, built: false }
    const discs = this._slots.filter(s => s.productId && s.shape === 'disc').length
    const st = Layouts.layoutStats(sp, discs)
    return { ...st, preview: !!this._previewLayout, setting: Layouts.normalizeId(this._look?.layout), view: this._view, stop: this._stop, domeOk: !!sp.bounds.ok && sp.bounds.radius < BACKDROP_RADIUS * 0.5, visibleFurniture: this._furnitureVisible() }
  }

  // ── Open / close / page ─────────────────────────────────────────────────────

  get isOpen () { return this._open }
  get page () { return this._page }
  get pages () { return Math.max(1, Math.ceil(this._products().length / this._perPage)) }
  get perPage () { return this._perPage }

  open ({ sectionId, productId, fly = true } = {}) {
    if (sectionId) Store.setCurrentSection(sectionId)
    this._open = true
    this._opening = true
    this.group.visible = true
    this._view = 'outside'
    this._stop = 0
    this._applyLook()
    this._ensureHud()
    this._hud.classList.add('is-open')
    this._placeHud()
    this._page = 0
    this._dirty = true
    this._rebuild()
    if (productId) {
      const idx = this._products().findIndex(p => p.id === productId)
      if (idx >= 0) { this._page = Math.floor(idx / this._perPage); this._rebuild() }
      const stops = this._spec?.camera.stops   // aisle: start at the stop that holds the product
      const sl = stops ? this._slotOf(productId) : null
      if (sl) { const k = stops.findIndex((s2, i) => i > 0 && sl.i >= s2.slotRange[0] && sl.i < s2.slotRange[1]); if (k > 0) this._stop = k }
    }
    this._opening = false
    if (fly) this.flyToLayout()
    this._emitState()
  }

  close () {
    if (!this._open) return
    this._open = false
    this.group.visible = false
    this._disposeBackdrop()
    this._previewLayout = null   // a dev preview never outlives the open store
    this._applyLook()
    this._trimFurniture()
    this._hud?.classList.remove('is-open')
    this._setHover(-1)
    this._hideTip()
    this._slots.forEach(s => { this._releaseHeld(s); s.productId = null; s.group.visible = false })   // free textures while closed
    this._hit.length = 0
    this._emitState()
  }

  setPage (n) {
    const p = Math.max(0, Math.min(this.pages - 1, n | 0))
    if (p === this._page) return
    this._page = p
    this._rebuild()
    this._emitState()
  }

  /** Rect of the open settings panel (any element `.oss-panel[data-store-panel][data-open="1"]`), or null. DOM-only: no import of the panels. */
  _settingsPanelRect () {
    if (typeof document === 'undefined') return null
    const el = document.querySelector('.oss-panel[data-store-panel][data-open="1"]')
    if (!el) return null
    const r = el.getBoundingClientRect()
    return r.width && r.height ? r : null
  }

  /** The part of the viewport the shelf may use: clear of the HUD on top, the dock, the hands (desktop) and the exchange panel. */
  _usable () {
    const W = window.innerWidth || 1280, H = window.innerHeight || 720
    let rt = 0
    if (this._hud && this._open && this._hud.style.display !== 'none') { const hb = this._hud.getBoundingClientRect(); if (hb.height) rt = Math.max(0, hb.bottom + 6) }
    if (!rt && typeof document !== 'undefined') { const rb = document.getElementById('omni-ribbon')?.getBoundingClientRect(); rt = rb && rb.height ? rb.bottom + 6 : 0 }
    if (isPhone() && typeof document !== 'undefined' && !(this._hud && this._open && this._hud.style.display !== 'none')) {
      // HUD hidden (a sheet is open): still keep the shelf clear of the two top hands
      document.querySelectorAll('.omni-hand--tl, .omni-hand--tr').forEach(h => { const r = h.getBoundingClientRect(); if (r.width && r.height && getComputedStyle(h).display !== 'none') rt = Math.max(rt, r.bottom + 22) })
    }
    let x0 = 0, x1 = W, y1 = H - DOCK_H - 4
    const xr = this._xr
    const sp = this._settingsPanelRect()   // V177: an open OmniStoreSettings / DevOmniStoreSettings panel takes its share of the screen
    if (isPhone()) { if (xr?.open && xr.rect) y1 = Math.min(y1, xr.rect.y - 4); if (sp) y1 = Math.min(y1, sp.top - 4) }
    else {
      const sf = handsSafe(rt, y1)
      x0 = sf.left; x1 = sf.right
      if (xr?.open && xr.rect) x1 = Math.min(x1, xr.rect.x - 8)
      if (sp) { if (sp.left + sp.width / 2 < W / 2) x0 = Math.max(x0, sp.right + 8); else x1 = Math.min(x1, sp.left - 8) }
    }
    return { W, H, x0, x1: Math.max(x0 + 120, x1), y0: rt, y1: Math.max(rt + 120, y1) }
  }

  /** What a layout's camera needs to know: the camera and the FREE part of the viewport (_usable). */
  _viewInfo () {
    const cam = this.ctx.camera
    const u = this._usable()
    return { fov: cam.fov || 60, aspect: cam.aspect || 1.78, W: u.W, H: u.H, x0: u.x0, x1: u.x1, y0: u.y0, y1: u.y1 }
  }

  /**
   * Fly the camera to the current layout's pose (shelf: face the wall; ring: outside overview or inside the ring; aisle:
   * the current stop; island: 3/4 view from above), sized to the free part of the viewport (_usable) and shifted so the
   * subject is centred in it. Sets the orbit target (the pose's target, in anchor space). The shelf maths are V178's flyToShelf.
   */
  flyToLayout (duration = 1.1) {
    if (!this._spec) this._rebuild()
    const spec = this._spec
    if (!spec) return 0
    const pose = spec.camera.pose(this._viewInfo(), { mode: this._view, stop: this._stop })
    return this._flyTo(pose, duration)
  }
  flyToShelf () { return this.flyToLayout() }   // V178 name, kept

  _flyTo (pose, duration) {
    const cam = this.ctx.camera
    const a = this.anchor
    const tx = a[0] + pose.target[0], ty = a[1] + pose.target[1], tz = a[2] + pose.target[2]
    const px = a[0] + pose.pos[0], py = a[1] + pose.pos[1], pz = a[2] + pose.pos[2]
    this._lastFly = { dist: pose.dist, dx: pose.dx, dy: pose.dy, pos: [px, py, pz], target: [tx, ty, tz], mode: pose.mode ?? null, stop: pose.stop ?? null }
    window.dispatchEvent(new CustomEvent('omni:orbit-target-set', { detail: { x: tx, y: ty, z: tz } }))
    this._flyTween?.kill()
    this._flyTween = gsap.to(cam.position, { x: px, y: py, z: pz, duration, ease: 'power2.inOut', onUpdate: () => cam.lookAt(tx, ty, tz) })   // cancelled by the user's own pointer-down (orbit)
    return pose.dist
  }

  /** Ring: 'inside' puts the camera at the centre of the ring, 'outside' is the default overview. */
  setView (mode) {
    const m = mode === 'inside' ? 'inside' : 'outside'
    if (!this._spec?.camera.modes) return false
    this._view = m
    this.flyToLayout()
    this._syncHud()
    return true
  }
  toggleView () { return this.setView(this._view === 'inside' ? 'outside' : 'inside') }

  /** Aisle: glide to the previous (-1) / next (+1) stop (0.9 s, GSAP). Returns false at an end or when the layout has no stops. */
  stepStop (d) { const n = this._spec?.camera.stops?.length ?? 0; return n ? this.goToStop(this._stop + d) : false }
  goToStop (i) {
    const stops = this._spec?.camera.stops
    if (!stops) return false
    const k = Math.max(0, Math.min(stops.length - 1, i | 0))
    if (k === this._stop) return false
    this._stop = k
    this._flyTo(this._spec.camera.pose(this._viewInfo(), { stop: k }), STOP_GLIDE_S)
    this._syncHud()
    this._emitState()
    return true
  }

  _products () { return Store.productsFor() }

  _emitState () {
    window.dispatchEvent(new CustomEvent('omni:store-state', { detail: { open: this._open, sectionId: Store.getCurrentSectionId(), page: this._page, pages: this.pages, count: this._open ? this._visibleCount() : 0, layout: this._layoutId, stop: this._stop, view: this._view } }))
    this._syncHud()
  }
  _visibleCount () { return this._slots.filter(s => s.productId).length }

  // ── Layout / assignment ─────────────────────────────────────────────────────

  _rebuild () {
    this._dirty = false
    if (!this._open) return
    const aspect = this.ctx.camera?.aspect || 1.78
    const per = this._perPage
    this._ensurePool(per)
    const list = this._products()
    const pages = Math.max(1, Math.ceil(list.length / per))
    if (this._page >= pages) this._page = pages - 1
    const pageItems = list.slice(this._page * per, (this._page + 1) * per)
    const spec = Layouts.build(this._layoutId, { count: pageItems.length, perPage: per, aspect, isPhone: isPhone(), settings: this._look })
    this._spec = spec
    if (spec.id === 'shelf') { this._cols = spec.meta.cols; this._rows = spec.meta.rows }
    const nStops = spec.camera.stops ? spec.camera.stops.length : 0
    const stopLost = nStops > 0 && this._stop > nStops - 1   // a page with fewer products has fewer stops
    if (!nStops) this._stop = 0
    else if (stopLost) this._stop = nStops - 1
    this._ensurePlanks(6)
    const order = spec.id === 'shelf' ? 'XYZ' : 'YXZ'   // YXZ: yaw first, then tilt about the product's own x axis
    this._hit.length = 0
    for (let i = 0; i < this._slots.length; i++) {
      const slot = this._slots[i]
      const p = i < per ? pageItems[i] : null
      const pl = p ? spec.slots[i] : null
      if (!p || !pl) { this._releaseHeld(slot); slot.productId = null; slot.group.visible = false; continue }
      slot.baseX = pl.x; slot.baseY = pl.y; slot.baseZ = pl.z; slot.ry = pl.ry; slot.rx = pl.rx; slot.baseScale = pl.scale
      if (slot.group.rotation.order !== order) slot.group.rotation.order = order
      slot.group.position.set(pl.x, pl.y, pl.z)
      if (this._snapRot) { slot.group.rotation.set(pl.rx, pl.ry, 0); slot.hoverAmt = 0 }
      slot.group.visible = true
      slot.productId = p.id
      slot.shape = p.shape
      slot.cube.visible = p.shape === 'cube'
      slot.disc.visible = p.shape === 'disc'
      this._showMedia(slot, p)
      if (p.shape === 'cube') this._hit.push(slot.cube); else this._hit.push(slot.faceA, slot.faceB)
    }
    this._snapRot = false
    this._applyFurniture(spec.furniture)
    if (stopLost && !this._opening) this.flyToLayout(STOP_GLIDE_S)
    this.hoverRing.rotation.order = this.selectRing.rotation.order = order
    this._placeRings()
    this._syncHud()
  }

  _slotOf (productId) { return this._slots.find(s => s.productId === productId) ?? null }

  /** Selector rings sit just in front of the slot, turned to face the slot's normal (so they work on a ring wall, an aisle, a tilted table). */
  _placeRing (ring, sl, off) {
    const rx = sl.rx || 0, ry = sl.ry || 0
    const cx = Math.cos(rx)
    ring.position.set(sl.baseX + Math.sin(ry) * cx * off, sl.baseY - Math.sin(rx) * off, (sl.baseZ || 0) + Math.cos(ry) * cx * off)
    ring.rotation.set(rx, ry, 0)
  }

  _placeRings () {
    const sel = this._selectedId ? this._slotOf(this._selectedId) : null
    this.selectRing.visible = !!sel
    if (sel) this._placeRing(this.selectRing, sel, 0.25)
    const h = this._hover >= 0 ? this._slots[this._hover] : null
    this.hoverRing.visible = !!(h && h.productId)
    if (h && h.productId) this._placeRing(this.hoverRing, h, 0.3)
  }

  // ── Textures ────────────────────────────────────────────────────────────────

  _emojiKey (p) { return `e|${p.media.emoji}|${TEX_SIZE}|${p.category}` }

  _wantKey (p) {
    const k = p.media.active
    if (k === 'image' && p.media.image) return { kind: 'image', key: `i|${p.media.image}`, src: p.media.image }
    if (k === 'video' && p.media.video) return { kind: 'video', key: `v|${p.media.video}`, src: p.media.video }
    return { kind: 'emoji', key: this._emojiKey(p) }
  }

  _makeEmojiTexture (p) {
    const size = TEX_SIZE
    const cv = document.createElement('canvas')
    cv.width = cv.height = size
    const g = cv.getContext('2d')
    if (g) {
      const veg = p.category === 'vegetable'
      const grad = g.createLinearGradient ? g.createLinearGradient(0, 0, size, size) : null
      if (grad) { grad.addColorStop(0, veg ? '#eaf6dc' : '#fff1dc'); grad.addColorStop(1, veg ? '#cfe8b8' : '#ffd9b8'); g.fillStyle = grad } else g.fillStyle = veg ? '#dcefc8' : '#ffe4c8'
      g.fillRect(0, 0, size, size)
      g.font = `${Math.round(size * 0.58)}px ${EMOJI_FONT}`
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillStyle = '#000'
      g.fillText(p.media.emoji, size / 2, size / 2 + size * 0.04)
    }
    const tex = new THREE.CanvasTexture(cv)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 4
    return tex
  }

  _acquire (want, p) {
    let e = this._cache.get(want.key)
    if (!e) {
      e = { key: want.key, kind: want.kind, tex: null, refs: 0, state: 'loading', video: null }
      this._cache.set(want.key, e)
      if (want.kind === 'emoji') { e.tex = this._makeEmojiTexture(p); e.state = 'ready' }
      else if (want.kind === 'image') this._startImage(e, want.src)
      else if (want.kind === 'video') this._startVideo(e, want.src)
    }
    e.refs++
    return e
  }

  _startImage (e, src) {
    const ok = (tex) => { tex.colorSpace = THREE.SRGBColorSpace; e.tex = tex; e.state = 'ready'; this._entryReady(e) }
    const bad = () => { e.state = 'error'; this._entryReady(e) }
    try {
      if (this._loadImage) this._loadImage(src, ok, bad)
      else { this._texLoader = this._texLoader ?? new THREE.TextureLoader(); this._texLoader.setCrossOrigin('anonymous'); this._texLoader.load(src, ok, undefined, bad) }
    } catch (_) { bad() }
  }

  _startVideo (e, src) {
    const v = document.createElement('video')
    v.muted = true; v.loop = true; v.playsInline = true; v.crossOrigin = 'anonymous'; v.preload = 'auto'
    v.setAttribute('muted', ''); v.setAttribute('playsinline', '')
    e.video = v
    this._videoEntries.push(e)
    const tex = new THREE.VideoTexture(v)
    tex.colorSpace = THREE.SRGBColorSpace
    e.tex = tex
    v.addEventListener('loadeddata', () => { e.state = 'ready'; this._entryReady(e); try { const pr = v.play(); pr?.catch?.(() => {}) } catch (_) { /* autoplay blocked: still frame */ } })
    v.addEventListener('error', () => { e.state = 'error'; this._entryReady(e) })
    v.src = src
    try { v.load() } catch (_) { /* jsdom */ }
  }

  _entryReady (e) {
    // swap in any slot that was showing a fallback while this entry loaded
    this._slots.forEach(s => {
      if (s.productId && s.wantKey === e.key) { const p = Store.getProduct(s.productId); if (p) this._showMedia(s, p, true) }
    })
  }

  _release (key) {
    const e = this._cache.get(key)
    if (!e) return
    e.refs--
    if (e.refs <= 0) this._disposeEntry(key)
  }

  _disposeEntry (key) {
    const e = this._cache.get(key)
    if (!e) return
    const vi = this._videoEntries.indexOf(e)
    if (vi >= 0) this._videoEntries.splice(vi, 1)
    if (e.video) { try { e.video.pause(); e.video.removeAttribute('src'); e.video.load() } catch (_) { /* ignore */ } e.video = null }
    e.tex?.dispose()
    e.tex = null
    this._cache.delete(key)
  }

  _releaseHeld (slot) {
    slot.held.forEach(k => this._release(k))
    slot.held.length = 0
    slot.shownKey = ''
    slot.wantKey = ''
  }

  _videoCount () { let n = 0; this._cache.forEach(e => { if (e.kind === 'video' && e.refs > 0) n++ }); return n }

  /** Show the product's ACTIVE media on its slot (emoji while an image / video is loading, errored, or over the video cap). */
  _showMedia (slot, p, force = false) {
    let want = this._wantKey(p)
    if (want.kind === 'video' && !this._cache.has(want.key) && this._videoCount() >= this.maxVideos) want = { kind: 'emoji', key: this._emojiKey(p) }
    if (!force && slot.wantKey === want.key && slot.shownKey) return
    const next = []
    const primary = this._acquire(want, p)
    next.push(want.key)
    let show = primary
    if (!(primary.state === 'ready' && primary.tex)) {
      const fb = { kind: 'emoji', key: this._emojiKey(p) }
      show = this._acquire(fb, p)
      next.push(fb.key)
    }
    slot.held.forEach(k => this._release(k))   // release the old AFTER acquiring the new (no dispose churn when unchanged)
    slot.held = next
    slot.wantKey = want.key
    slot.shownKey = show.key
    slot.mats.forEach(m => { m.map = show.tex; m.needsUpdate = true })
  }

  /** Test / HUD helper: the key of the texture currently on a product's slot. */
  shownKeyFor (productId) { return this._slotOf(productId)?.shownKey ?? null }
  getSlotInfo (productId) {
    const s = this._slotOf(productId)
    return s ? { slot: s, shown: s.shownKey, want: s.wantKey, shape: s.shape } : null
  }
  get cacheSize () { return this._cache.size }
  get hitMeshes () { return this._hit }

  // ── Pointer ─────────────────────────────────────────────────────────────────

  _pick (e) {
    if (!this._open || !this._hit.length || !this._canvas) return -1
    const r = this._canvas.getBoundingClientRect()
    const w = r.width || window.innerWidth, h = r.height || window.innerHeight
    this._ndc.set(((e.clientX - r.left) / w) * 2 - 1, -((e.clientY - r.top) / h) * 2 + 1)
    this.group.updateMatrixWorld(true)
    this._ray.setFromCamera(this._ndc, this.ctx.camera)
    const hits = this._ray.intersectObjects(this._hit, false)
    if (!hits.length) return -1
    if (this._occ.length) {   // V179: furniture in front of a product (a rail, a wall, the table slab) hides it from the pointer too
      const oc = this._ray.intersectObjects(this._occ, false)
      if (oc.length && oc[0].distance < hits[0].distance - 1e-4) return -1
    }
    return hits[0].object.userData.slot
  }

  _onPointerMove (e) {
    if (!this._open || e.pointerType === 'touch') return
    this._pointer.x = e.clientX; this._pointer.y = e.clientY
    this._setHover(this._pick(e))
  }

  _onPointerDown (e) {
    this._down = { x: e.clientX, y: e.clientY, t: performance.now() }
    if (this._flyTween) { this._flyTween.kill(); this._flyTween = null }   // V179: the user's own orbit / click cancels a glide
  }

  _onPointerUp (e) {
    const d = this._down
    this._down = null
    if (!this._open || !d) return
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8 || performance.now() - d.t > 700) return   // a drag (orbit) is not a click
    if (e.button !== undefined && e.button !== 0) return
    const idx = this._pick(e)
    if (idx >= 0) this.selectSlot(idx)
  }

  selectSlot (idx) {
    const s = this._slots[idx]
    if (!s?.productId) return false
    this.selectProduct(s.productId)
    return true
  }

  selectProduct (productId) {
    this._selectedId = productId
    this._placeRings()
    window.dispatchEvent(new CustomEvent('omni:store-product-select', { detail: { productId } }))
    window.dispatchEvent(new CustomEvent('omni:exchange-open', { detail: { productId, mode: 'buy' } }))
  }

  _setHover (idx) {
    if (idx === this._hover) { if (idx >= 0) this._moveTip(); return }
    this._hover = idx
    this._placeRings()
    if (idx < 0) { this._hideTip(); return }
    const p = Store.getProduct(this._slots[idx].productId)
    if (!p) return
    this._showTip(p)
    const f = p.price[0]
    window.dispatchEvent(new CustomEvent('omni:notify-info', { detail: {
      name: `${p.emoji} ${p.name}`, key: 'click', source: '⟐OmniStore · SANDBOX',
      desc: `${p.category}, ${p.shape}, ${p.stock} in stock. From ${f ? Value.describeForm(f) : '—'}${p.price.length > 1 ? ` (+${p.price.length - 1} more forms)` : ''}. Click for the exchange.`, holdMs: 3000 } }))
  }

  _showTip (p) {
    if (!this._tip) { this._tip = mkEl('div', 'osh-tip'); document.body.appendChild(this._tip) }
    this._tip.textContent = `${p.emoji} ${p.name} · ${p.stock} left · ${p.price.length} forms`
    this._tip.style.display = 'block'
    this._moveTip()
  }
  _moveTip () { if (this._tip && this._tip.style.display !== 'none') { this._tip.style.left = Math.min(window.innerWidth - 250, this._pointer.x + 14) + 'px'; this._tip.style.top = (this._pointer.y + 14) + 'px' } }
  _hideTip () { if (this._tip) this._tip.style.display = 'none' }

  // ── HUD ─────────────────────────────────────────────────────────────────────

  _ensureHud () {
    if (this._hud) return
    const hud = mkEl('div', 'osh')
    hud.id = 'omni-store-hud'
    hud.setAttribute('role', 'toolbar')
    hud.setAttribute('aria-label', 'OmniStore')
    const r1 = mkEl('div', 'osh-row')
    const title = mkEl('span', 'osh-title', '⟐OmniStore')
    r1.appendChild(title)
    const sb = mkEl('span', 'osh-sandbox', 'SANDBOX'); sb.title = 'All value here is fake. No real payments.'
    r1.appendChild(sb)
    r1.appendChild(mkEl('span', 'osh-spacer'))
    const btn = (label, action, tip, desc) => {
      const b = mkEl('button', 'osh-btn', label); b.type = 'button'; b.dataset.action = action
      b.dataset.omniTip = tip; b.dataset.omniTipDesc = desc; b.setAttribute('aria-label', tip)
      b.addEventListener('click', () => this._hudAction(action))
      return b
    }
    r1.appendChild(btn('List', 'list', 'Shopping list', 'Opens the exchange panel on the List tab: window, wishlist and cart, and the compare view.'))
    r1.appendChild(btn('Wallet', 'wallet', 'Wallet', 'Opens the sandbox wallet: balances per value type, remainders, transactions.'))
    r1.appendChild(btn('⌖', 'recenter', 'Recentre', 'Flies the camera back to face the shelf.'))
    r1.appendChild(btn('✕', 'close', 'Close store', 'Hides the store shelf.'))
    const r2 = mkEl('div', 'osh-row')
    const chips = mkEl('div', 'osh-chips'); chips.setAttribute('role', 'tablist')
    const pager = mkEl('div', 'osh-pager')
    const prev = btn('‹', 'prev', 'Previous page', 'Previous page of products.')
    const label = mkEl('span', 'osh-page', '1/1')
    const next = btn('›', 'next', 'Next page', 'Next page of products.')
    pager.append(prev, label, next)
    r2.append(chips, pager)
    // V179 row 3: layout chip (cycles shelf -> ring -> aisle -> island), aisle stop buttons, ring enter / exit
    const r3 = mkEl('div', 'osh-row osh-layoutrow')
    const layoutBtn = btn('', 'layout', 'Layout', 'Switch the store layout.')
    layoutBtn.classList.add('osh-layout')
    const stopPrev = btn('◀', 'stop-prev', 'Previous stop', 'Glide to the previous stop along the aisle.')
    const stopLabel = mkEl('span', 'osh-stop', 'Entrance'); stopLabel.setAttribute('aria-live', 'polite')
    const stopNext = btn('▶', 'stop-next', 'Next stop', 'Glide to the next stop along the aisle.')
    const enter = btn('Enter', 'view', 'Enter the ring', 'Moves the camera to the middle of the ring so you look out at the products. Recentre (⌖) returns to the overview.')
    // V182 store chip (first in row 3): hidden while the identity owns one store; opens a small menu of the stores
    const storeBtn = btn('', 'store', 'Stores', 'Switch to another of your stores.')
    storeBtn.classList.add('osh-storebtn'); storeBtn.hidden = true; storeBtn.setAttribute('aria-haspopup', 'menu'); storeBtn.setAttribute('aria-expanded', 'false')
    const menu = mkEl('div', 'osh-menu'); menu.setAttribute('role', 'menu'); menu.setAttribute('aria-label', 'Your stores')
    r3.append(storeBtn, layoutBtn, stopPrev, stopLabel, stopNext, enter)
    hud.append(r1, r2, r3, menu)
    ;(document.getElementById('omni-ui') ?? document.body).appendChild(hud)
    this._hud = hud
    this._hudRefs = { chips, prev, next, label, title, layoutBtn, stopPrev, stopLabel, stopNext, enter, storeBtn, menu }
    this._applyLook()
  }

  /** Desktop: the HUD sits between the left hands and the exchange panel / right hands; phone: full width. */
  _placeHud () {
    const hud = this._hud
    if (!hud) return
    const W = window.innerWidth || 1280
    if (isPhone()) {
      hud.style.left = '8px'; hud.style.width = (W - 16) + 'px'
      // phone: the HUD sits below the two top hands; while the bottom sheet is open it steps aside so the shelf stays visible
      let t = 0
      document.querySelectorAll('.omni-hand--tl, .omni-hand--tr').forEach(h => { const r = h.getBoundingClientRect(); if (r.width && r.height && getComputedStyle(h).display !== 'none') t = Math.max(t, r.bottom + 22) })
      hud.style.top = t ? t + 'px' : ''
      hud.style.display = this._xr?.open || this._settingsPanelRect() ? 'none' : ''   // the exchange sheet or a settings sheet needs the room; the shelf stays visible above it
      return
    }
    hud.style.display = ''
    const xr = this._xr
    const top = hud.getBoundingClientRect().top || 150
    const sf = handsSafe(top, top + 90)
    let right = sf.right
    if (xr?.open && xr.rect) right = Math.min(right, xr.rect.x - 8)
    const avail = Math.max(280, right - sf.left)
    const width = Math.min(640, avail)
    hud.style.width = width + 'px'
    hud.style.left = Math.round(sf.left + (avail - width) / 2) + 'px'
  }

  _hudAction (a) {
    if (a === 'close') window.dispatchEvent(new CustomEvent('omni:store-close'))
    else if (a === 'recenter') { this._view = 'outside'; this._stop = 0; this.flyToLayout(); this._syncHud() }   // the default pose of the layout
    else if (a === 'layout') this.setLayout(Layouts.nextLayoutId(this._layoutId))
    else if (a === 'store') this._toggleMenu()
    else if (a === 'stop-prev') this.stepStop(-1)
    else if (a === 'stop-next') this.stepStop(1)
    else if (a === 'view') this.toggleView()
    else if (a === 'prev') this.setPage(this._page - 1)
    else if (a === 'next') this.setPage(this._page + 1)
    else if (a === 'list') window.dispatchEvent(new CustomEvent('omni:exchange-open', { detail: { tab: 'list' } }))
    else if (a === 'wallet') window.dispatchEvent(new CustomEvent('omni:wallet-open'))
  }

  _syncHud () {
    if (!this._hudRefs) return
    const { chips, prev, next, label } = this._hudRefs
    const cur = Store.getCurrentSectionId()
    const secs = Store.getSections()
    const sig = secs.map(s => s.id).join()
    if (chips.dataset.sig !== sig) {
      chips.dataset.sig = sig
      chips.textContent = ''
      secs.forEach(s => {
        const b = mkEl('button', 'osh-chip' + (s.kind === 'media' ? ' is-media' : ''), s.name)
        b.type = 'button'; b.dataset.section = s.id; b.setAttribute('role', 'tab')
        b.dataset.omniTip = s.name; b.dataset.omniTipDesc = `${s.kind === 'media' ? 'Media lens' : 'Identity section'}: ${s.desc}`
        b.addEventListener('click', () => { Store.setCurrentSection(s.id); this._page = 0; this._rebuild(); this._emitState() })
        chips.appendChild(b)
      })
    }
    chips.querySelectorAll('.osh-chip').forEach(b => { const on = b.dataset.section === cur; b.classList.toggle('is-active', on); b.setAttribute('aria-selected', on ? 'true' : 'false') })
    const n = this._products().length
    label.textContent = `${this._page + 1}/${this.pages} · ${n}`
    prev.disabled = this._page <= 0
    next.disabled = this._page >= this.pages - 1
    this._syncLayoutRow()
    this._syncStoreChip()
  }

  /** The store chip (emoji + name of the active store; hidden with one store) and its menu. */
  _syncStoreChip () {
    const r = this._hudRefs
    if (!r?.storeBtn) return
    const list = Store.listStores()
    r.storeBtn.hidden = list.length < 2
    if (list.length < 2) { this._toggleMenu(false); return }
    const act = list.find(x => x.active) ?? list[0]
    r.storeBtn.textContent = `${act.emoji} ${act.name} ▾`
    r.storeBtn.dataset.omniTip = `Store: ${act.name}`
    r.storeBtn.dataset.omniTipDesc = `${list.length} stores. Click to switch; the camera flies to the one you pick.`
    r.storeBtn.setAttribute('aria-label', `Store: ${act.name}. ${list.length} stores. Open the store menu.`)
    if (this._menuOpen) this._fillMenu(list)
  }
  _fillMenu (list = Store.listStores()) {
    const menu = this._hudRefs.menu
    menu.textContent = ''
    list.forEach(x => {
      const b = mkEl('button', '', `${x.emoji} ${x.name} · ${Layouts.getLayout(x.layout).name}`)
      b.type = 'button'; b.setAttribute('role', 'menuitemradio'); b.setAttribute('aria-checked', String(x.active)); b.dataset.storeId = x.id
      b.addEventListener('click', () => { this._toggleMenu(false); this.switchStore(x.id) })
      menu.appendChild(b)
    })
  }
  _toggleMenu (force) {
    const r = this._hudRefs
    if (!r?.menu) return
    const open = force === undefined ? !this._menuOpen : !!force
    if (open === !!this._menuOpen) return
    this._menuOpen = open
    if (open) this._fillMenu()
    r.menu.classList.toggle('is-open', open)
    r.storeBtn.setAttribute('aria-expanded', String(open))
    if (open) window.addEventListener('pointerdown', this._on.outside); else window.removeEventListener('pointerdown', this._on.outside)
  }

  /** The layout chip (always) + the controls only some layouts have (aisle stops, ring enter / exit). */
  _syncLayoutRow () {
    const r = this._hudRefs
    if (!r?.layoutBtn) return
    const lay = Layouts.getLayout(this._layoutId), nxt = Layouts.getLayout(Layouts.nextLayoutId(this._layoutId))
    r.layoutBtn.textContent = `${lay.icon} ${lay.short}`
    const tip = `Layout: ${lay.name}${this._previewLayout ? ' (preview)' : ''}`
    r.layoutBtn.dataset.omniTip = tip
    r.layoutBtn.dataset.omniTipDesc = `${lay.description} Click for ${nxt.name}.`
    r.layoutBtn.setAttribute('aria-label', `${tip}. Click for ${nxt.name}.`)
    r.layoutBtn.dataset.layout = lay.id
    const stops = this._spec?.camera.stops
    r.stopPrev.hidden = r.stopNext.hidden = r.stopLabel.hidden = !stops
    if (stops) {
      r.stopLabel.textContent = stops[this._stop]?.label ?? ''
      r.stopPrev.disabled = this._stop <= 0
      r.stopNext.disabled = this._stop >= stops.length - 1
    }
    const modes = this._spec?.camera.modes
    r.enter.hidden = !modes
    if (modes) {
      const inside = this._view === 'inside'
      r.enter.textContent = inside ? 'Exit' : 'Enter'
      r.enter.dataset.omniTip = inside ? 'Leave the ring' : 'Enter the ring'
      r.enter.setAttribute('aria-label', r.enter.dataset.omniTip)
      r.enter.setAttribute('aria-pressed', String(inside))
    }
  }

  // ── Frame ───────────────────────────────────────────────────────────────────

  update (delta) {
    if (!this._open) return
    if (this._dirty) { this._rebuild(); this._emitState() }
    this._time += delta
    if (delta > 0) this._fps += (1 / delta - this._fps) * Math.min(1, delta * 2)   // smoothed frame rate from update(), for the dev readout
    if (this._backdrop) this._backdrop.visible = this.ctx.camera.position.distanceTo(this.group.position) < BACKDROP_RADIUS * 0.92   // zoomed far outside the dome: hide it
    const k = Math.min(1, delta * 8)
    for (let i = 0; i < this._slots.length; i++) {
      const s = this._slots[i]
      if (!s.productId) continue
      const hov = i === this._hover
      s.hoverAmt += ((hov ? 1 : 0) - s.hoverAmt) * k
      const sc = (s.baseScale || 1) * (1 + 0.14 * s.hoverAmt)
      s.group.scale.set(sc, sc, sc)
      const sway = s.ry + Math.sin(this._time * 0.7 + i * 0.9) * 0.35
      if (hov) s.group.rotation.y += delta * 2.4
      else {
        let diff = sway - s.group.rotation.y
        diff -= Math.PI * 2 * Math.round(diff / (Math.PI * 2))
        s.group.rotation.y += diff * k
      }
      s.group.rotation.x = s.rx + Math.sin(this._time * 0.5 + i) * 0.06 * (1 - s.hoverAmt)
    }
    for (let i = 0; i < this._videoEntries.length; i++) { const e = this._videoEntries[i]; if (e.state === 'ready' && e.tex) e.tex.update() }
  }
}
