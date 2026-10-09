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
 * module owns its meshes. At most PER_PAGE (24) products are on screen, with pagination; all geometry is shared.
 * No per-frame allocation: update() only touches pooled slots.
 *
 * Events consumed: omni:store-open {sectionId?, productId?, fly?}, omni:store-close, omni:nav-select (⟐OmniStore),
 *   omni:store-changed, omni:identity-changed, omni:value-changed (none needed; the shelf shows no balances).
 * Events dispatched: omni:store-state {open, sectionId, page, pages, count}, omni:store-product-select {productId},
 *   omni:exchange-open {productId, mode:'buy'}, omni:notify-info, omni:orbit-target-set (when it flies the camera).
 *
 * Module contract: constructor(ctx, opts) / init / update / destroy / onResize.
 */

import * as THREE from 'three'
import gsap from 'gsap'
import * as Store from '../utils/OmniStoreModel.js'
import * as Value from '../utils/OmniValueModel.js'
import { handsSafe, DOCK_H, isPhone } from '../utils/OmniStoreLayout.js'

export const PER_PAGE = 24
export const MAX_VIDEOS = 4
export const TEX_SIZE = 256
export const DEFAULT_ANCHOR = [0, 3, -40]
const SPACING = 1.5
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
.osh-btn:hover:not(:disabled) { background: rgba(255,255,255,.16); }
.osh-btn:disabled { opacity: .35; cursor: default; }
.osh-chips { display: flex; gap: 4px; overflow-x: auto; flex: 1; min-width: 0; scrollbar-width: none; padding-bottom: 1px; }
.osh-chips::-webkit-scrollbar { display: none; }
.osh-chip { flex: 0 0 auto; min-height: 28px; padding: 2px 9px; font: inherit; color: inherit; cursor: pointer; border-radius: 14px; white-space: nowrap;
  background: rgba(255,255,255,.05); border: 1px solid var(--omni-theme-border, rgba(255,255,255,.18)); }
.osh-chip.is-media { border-style: dashed; }
.osh-chip.is-active { background: rgba(255,255,255,.24); border-color: rgba(255,255,255,.75); }
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
    this.anchor = opts.anchor ?? DEFAULT_ANCHOR
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
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  init () {
    this._inited++   // BaseScene.addModule() calls init(); a second call must not double everything (V170 bug)
    if (this._inited > 1) return
    injectStyles()
    this._buildShared()
    this._buildGroup()
    this._ray = new THREE.Raycaster()
    this._ndc = new THREE.Vector2()
    this._tmpV = new THREE.Vector3()

    this._on = {
      open: (e) => this.open(e.detail ?? {}),
      close: () => this.close(),
      nav: (e) => { if (e.detail?.item === '⟐OmniStore') this.open({}) },
      changed: () => { this._dirty = true },
      select: (e) => { this._selectedId = e.detail?.productId ?? null; this._placeRings() },
      exchangeClosed: () => { this._selectedId = null; this._placeRings() },
      xrState: (e) => { const was = this._xr; this._xr = e.detail ?? null; this._placeHud(); if (this._open && this._xr?.open && !was?.open) this.flyToShelf() },
      layout: () => { if (this._open) this._placeHud() },
    }
    window.addEventListener('omni:store-open', this._on.open)
    window.addEventListener('omni:store-close', this._on.close)
    window.addEventListener('omni:nav-select', this._on.nav)
    window.addEventListener(Store.CHANGED_EVENT, this._on.changed)
    window.addEventListener('omni:identity-changed', this._on.changed)
    window.addEventListener('omni:store-product-select', this._on.select)
    window.addEventListener('omni:exchange-closed', this._on.exchangeClosed)
    window.addEventListener('omni:exchange-state', this._on.xrState)
    window.addEventListener('omni:layout-changed', this._on.layout)
    window.addEventListener('resize', this._on.layout)

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
    window.removeEventListener('omni:identity-changed', this._on.changed)
    window.removeEventListener('omni:store-product-select', this._on.select)
    window.removeEventListener('omni:exchange-closed', this._on.exchangeClosed)
    window.removeEventListener('omni:exchange-state', this._on.xrState)
    window.removeEventListener('omni:layout-changed', this._on.layout)
    window.removeEventListener('resize', this._on.layout)
    if (this._canvas && this._ptr) {
      this._canvas.removeEventListener('pointermove', this._ptr.move)
      this._canvas.removeEventListener('pointerdown', this._ptr.down)
      this._canvas.removeEventListener('pointerup', this._ptr.up)
      this._canvas.removeEventListener('pointerleave', this._ptr.leave)
    }
    this._flyTween?.kill()
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
    }
    this._geo.rim.rotateX(Math.PI / 2)
    this._mats = {
      rim: new THREE.MeshBasicMaterial({ color: 0x5b4a36, toneMapped: false }),
      back: new THREE.MeshBasicMaterial({ color: 0xd8cdb9, toneMapped: false }),
      plank: new THREE.MeshBasicMaterial({ color: 0xa57d52, toneMapped: false }),
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
    for (let r = 0; r < 6; r++) { const p = new THREE.Mesh(this._geo.plank, this._mats.plank); p.visible = false; g.add(p); this.planks.push(p) }
    for (let i = 0; i < PER_PAGE; i++) g.add(this._buildSlot(i).group)
    this.hoverRing = new THREE.Mesh(this._geo.ring, this._mats.hover)
    this.selectRing = new THREE.Mesh(this._geo.ring, this._mats.select)
    this.hoverRing.visible = this.selectRing.visible = false
    this.hoverRing.renderOrder = this.selectRing.renderOrder = 10
    g.add(this.hoverRing, this.selectRing)
    this.group = g
    this.ctx.scene.add(g)
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
    const slot = { i, group, cube, disc, faceA, faceB, mats, productId: null, held: [], shownKey: '', wantKey: '', baseX: 0, baseY: 0, shape: 'cube', hoverAmt: 0, scale: 1 }
    cube.userData.slot = i; faceA.userData.slot = i; faceB.userData.slot = i
    this._slots.push(slot)
    return slot
  }

  // ── Open / close / page ─────────────────────────────────────────────────────

  get isOpen () { return this._open }
  get page () { return this._page }
  get pages () { return Math.max(1, Math.ceil(this._products().length / PER_PAGE)) }

  open ({ sectionId, productId, fly = true } = {}) {
    if (sectionId) Store.setCurrentSection(sectionId)
    this._open = true
    this.group.visible = true
    this._ensureHud()
    this._hud.classList.add('is-open')
    this._placeHud()
    this._page = 0
    this._dirty = true
    this._rebuild()
    if (productId) {
      const idx = this._products().findIndex(p => p.id === productId)
      if (idx >= 0) { this._page = Math.floor(idx / PER_PAGE); this._rebuild() }
    }
    if (fly) this.flyToShelf()
    this._emitState()
  }

  close () {
    if (!this._open) return
    this._open = false
    this.group.visible = false
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

  /** The part of the viewport the shelf may use: clear of the HUD on top, the dock, the hands (desktop) and the exchange panel. */
  _usable () {
    const W = window.innerWidth || 1280, H = window.innerHeight || 720
    let rt = 0
    if (this._hud && this._open && this._hud.style.display !== 'none') { const hb = this._hud.getBoundingClientRect(); if (hb.height) rt = Math.max(0, hb.bottom + 6) }
    if (!rt && typeof document !== 'undefined') { const rb = document.getElementById('omni-ribbon')?.getBoundingClientRect(); rt = rb && rb.height ? rb.bottom + 6 : 0 }
    let x0 = 0, x1 = W, y1 = H - DOCK_H - 4
    const xr = this._xr
    if (isPhone()) { if (xr?.open && xr.rect) y1 = Math.min(y1, xr.rect.y - 4) }
    else {
      const sf = handsSafe(rt, y1)
      x0 = sf.left; x1 = sf.right
      if (xr?.open && xr.rect) x1 = Math.min(x1, xr.rect.x - 8)
    }
    return { W, H, x0, x1: Math.max(x0 + 120, x1), y0: rt, y1: Math.max(rt + 120, y1) }
  }

  /**
   * Fly the camera to face the shelf, sized to the free part of the viewport (_usable) and shifted so the shelf is centred in
   * it. Sets the orbit target to the (shifted) shelf centre.
   */
  flyToShelf () {
    const cam = this.ctx.camera
    const aspect = cam.aspect || 1.78
    const { W, H, x0, x1, y0, y1 } = this._usable()
    const uw = x1 - x0, uh = y1 - y0
    const w = this._cols * SPACING + 1, h = this._rows * SPACING + 1.2
    const tanV = Math.tan((cam.fov || 60) * Math.PI / 360)
    const needV = h * (H / uh), needW = w * (W / uw)
    const dist = Math.max(needV / 2 / tanV, needW / 2 / (tanV * aspect)) * 1.04 + 1
    const visH = 2 * dist * tanV, visW = visH * aspect
    const ox = (x0 + uw / 2) - W / 2, oy = (y0 + uh / 2) - H / 2     // where the shelf should sit, from the screen centre
    const dx = -ox / W * visW, dy = oy / H * visH                       // the camera moves the opposite way
    const cx = this.anchor[0] + dx, cy = this.anchor[1] + dy, cz = this.anchor[2]
    this._lastFly = { dist, dx, dy }
    window.dispatchEvent(new CustomEvent('omni:orbit-target-set', { detail: { x: cx, y: cy, z: cz } }))
    this._flyTween?.kill()
    this._flyTween = gsap.to(cam.position, { x: cx, y: cy, z: cz + dist, duration: 1.1, ease: 'power2.inOut', onUpdate: () => cam.lookAt(cx, cy, cz) })
    return dist
  }

  _products () { return Store.productsFor() }

  _emitState () {
    window.dispatchEvent(new CustomEvent('omni:store-state', { detail: { open: this._open, sectionId: Store.getCurrentSectionId(), page: this._page, pages: this.pages, count: this._open ? this._visibleCount() : 0 } }))
    this._syncHud()
  }
  _visibleCount () { return this._slots.filter(s => s.productId).length }

  // ── Layout / assignment ─────────────────────────────────────────────────────

  _rebuild () {
    this._dirty = false
    if (!this._open) return
    const aspect = this.ctx.camera?.aspect || 1.78
    this._cols = aspect < 0.85 ? 4 : 6
    this._rows = PER_PAGE / this._cols
    const list = this._products()
    const pages = Math.max(1, Math.ceil(list.length / PER_PAGE))
    if (this._page >= pages) this._page = pages - 1
    const pageItems = list.slice(this._page * PER_PAGE, (this._page + 1) * PER_PAGE)
    const rowsUsed = Math.max(1, Math.ceil(pageItems.length / this._cols))
    const w = this._cols * SPACING, h = rowsUsed * SPACING
    this._hit.length = 0
    for (let i = 0; i < PER_PAGE; i++) {
      const slot = this._slots[i]
      const p = pageItems[i]
      if (!p) { this._releaseHeld(slot); slot.productId = null; slot.group.visible = false; continue }
      const col = i % this._cols, row = Math.floor(i / this._cols)
      slot.baseX = (col - (this._cols - 1) / 2) * SPACING
      slot.baseY = ((rowsUsed - 1) / 2 - row) * SPACING + 0.15
      slot.group.position.set(slot.baseX, slot.baseY, 0)
      slot.group.visible = true
      slot.productId = p.id
      slot.shape = p.shape
      slot.cube.visible = p.shape === 'cube'
      slot.disc.visible = p.shape === 'disc'
      this._showMedia(slot, p)
      if (p.shape === 'cube') this._hit.push(slot.cube); else this._hit.push(slot.faceA, slot.faceB)
    }
    this.back.scale.set(w + 0.8, h + 0.8, 1)
    this.back.position.y = 0.15
    this.planks.forEach((pl, r) => {
      pl.visible = r < rowsUsed
      if (pl.visible) { pl.scale.set(w + 0.6, 1, 1); pl.position.set(0, ((rowsUsed - 1) / 2 - r) * SPACING + 0.15 - 0.55, -0.25) }
    })
    this._placeRings()
    this._syncHud()
  }

  _slotOf (productId) { return this._slots.find(s => s.productId === productId) ?? null }

  _placeRings () {
    const sel = this._selectedId ? this._slotOf(this._selectedId) : null
    this.selectRing.visible = !!sel
    if (sel) this.selectRing.position.set(sel.baseX, sel.baseY, 0.25)
    const h = this._hover >= 0 ? this._slots[this._hover] : null
    this.hoverRing.visible = !!(h && h.productId)
    if (h && h.productId) this.hoverRing.position.set(h.baseX, h.baseY, 0.3)
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
    return hits.length ? hits[0].object.userData.slot : -1
  }

  _onPointerMove (e) {
    if (!this._open || e.pointerType === 'touch') return
    this._pointer.x = e.clientX; this._pointer.y = e.clientY
    this._setHover(this._pick(e))
  }

  _onPointerDown (e) { this._down = { x: e.clientX, y: e.clientY, t: performance.now() } }

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
    r1.appendChild(mkEl('span', 'osh-title', '⟐OmniStore'))
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
    hud.append(r1, r2)
    ;(document.getElementById('omni-ui') ?? document.body).appendChild(hud)
    this._hud = hud
    this._hudRefs = { chips, prev, next, label }
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
      hud.style.display = this._xr?.open ? 'none' : ''
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
    else if (a === 'recenter') this.flyToShelf()
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
  }

  // ── Frame ───────────────────────────────────────────────────────────────────

  update (delta) {
    if (!this._open) return
    if (this._dirty) { this._rebuild(); this._emitState() }
    this._time += delta
    const k = Math.min(1, delta * 8)
    for (let i = 0; i < PER_PAGE; i++) {
      const s = this._slots[i]
      if (!s.productId) continue
      const hov = i === this._hover
      s.hoverAmt += ((hov ? 1 : 0) - s.hoverAmt) * k
      const sc = 1 + 0.14 * s.hoverAmt
      s.group.scale.set(sc, sc, sc)
      const sway = Math.sin(this._time * 0.7 + i * 0.9) * 0.35
      if (hov) s.group.rotation.y += delta * 2.4
      else {
        let diff = sway - s.group.rotation.y
        diff -= Math.PI * 2 * Math.round(diff / (Math.PI * 2))
        s.group.rotation.y += diff * k
      }
      s.group.rotation.x = Math.sin(this._time * 0.5 + i) * 0.06 * (1 - s.hoverAmt)
    }
    for (let i = 0; i < this._videoEntries.length; i++) { const e = this._videoEntries[i]; if (e.state === 'ready' && e.tex) e.tex.update() }
  }
}
