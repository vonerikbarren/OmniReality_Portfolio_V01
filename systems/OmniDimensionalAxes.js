/**
 * systems/OmniDimensionalAxes.js — the two dimensional axes of the top hands
 *
 * Each top hand owns a PAIR of axes that are separate from world XYZ:
 *
 *   Conscious Hand (Δ)  primary axis: a world-fixed diagonal through the
 *                       origin toward 2 o'clock (top-down), one-sided. Nodes are
 *                       perspectives. Relative (Υ) axis: scale degrees.
 *   OmniHand (⟐)        primary axis: starts at the origin toward 11 o'clock, one-sided. Nodes are
 *                       OmniProducts. Relative (Υ) axis: product tier.
 *
 * Each primary axis is drawn as a large transparent TUNNEL rendered as a
 * grid (LineSegments, the same technique modules/OmniFloor.js uses),
 * strung with massive translucent container nodes. The relative axis is a
 * short vertical grid column with tick rings that rides with the marker.
 *
 * Every position is also a STATE: {primary, relative} integer indices per
 * hand, clamped to the axis, persisted to localStorage, and announced via
 * `omni:dimension-state`. Movement tweens smoothly with gsap. The camera
 * is NEVER touched by this module.
 *
 * What this is NOT: the massive nodes are labeled container shapes only.
 * The data layer they are meant to contain does not exist yet. Content
 * lives in data/OmniDimensionalAxesData.js.
 *
 * Events dispatched (window):
 *   omni:dimension-state         { hand, phase: 'init'|'travel'|'settle',
 *                                  primaryIndex, primaryPosition,
 *                                  relativeIndex, relativePosition,
 *                                  primaryCount, relativeCount,
 *                                  activeNode:{id,name,index},
 *                                  activeLevel:{id,name,index} }
 *                                'travel' fires when a step begins (values
 *                                are the destination), 'settle' when the
 *                                tween finishes. primaryPosition ==
 *                                primaryIndex: positions ARE node indices.
 *   omni:dimension-axes-visible  { visible }   after the visibility changes
 *
 * Events consumed (window):
 *   omni:dimension-axes-visible-set  { visible }   live toggle
 *   omni:dimension-axes-reset                       back to defaults
 *
 * Public API:
 *   axes.step(hand, 'left'|'right'|'up'|'down')   -> true if it moved
 *   axes.goTo(hand, primaryIndex, relativeIndex)
 *   axes.getState(hand)
 *   axes.setVisible(bool) / axes.isVisible() / axes.reset()
 *
 * Follows the standard module contract (constructor / init / update / destroy).
 */

import * as THREE from 'three'
import gsap from 'gsap'
import {
  CONSCIOUS_SYMBOL, OMNIHAND_SYMBOL, REL_AXIS_SYMBOL, CLOCK,
  CONSCIOUS_PERSPECTIVES, CONSCIOUS_SCALE_DEGREES,
  OMNIHAND_PRODUCTS, OMNIHAND_TIERS,
} from '../data/OmniDimensionalAxesData.js'

export { CONSCIOUS_SYMBOL, OMNIHAND_SYMBOL, REL_AXIS_SYMBOL }

// ── Geometry / motion constants ─────────────────────────────────────────────
//
// Bounds: with the default data, the farthest node surface sits ~790 units
// from the origin, inside VoidBoundary's 1000-radius sphere and far below
// the camera's far plane (100000; BaseScene also uses a logarithmic depth
// buffer, and there is no fog), so nothing here clips or z-fights.

// V159: every geometry size below is V158's value times GEO_SCALE (user: "5x the
// size"). Label sizes are deliberately NOT multiplied — they are set to half of
// their V158 world size (see LABEL_WIDTH_*).
const GEO_SCALE         = 5
const AXIS_Y            = 0     // tunnels start at the world origin
const NODE_SPACING      = 160 * GEO_SCALE   // distance between node centres along an axis
const NODE_RADIUS       = 64 * GEO_SCALE    // massive nodes: scene-sized, < spacing/2 so neighbours don't overlap
const TUNNEL_RADIUS     = 44 * GEO_SCALE
const TUNNEL_END_PAD    = 24 * GEO_SCALE    // tunnel extends this far past the outermost node surface
const GRID_RING_STEP    = 40 * GEO_SCALE    // spacing of the tunnel's grid rings
const TUNNEL_COLOR      = 0xffffff          // both tunnels white (nodes/markers keep their hand colour)
const LABEL_WIDTH_NODE  = 56 / 2            // half of V158's 56
const LABEL_WIDTH_LEVEL = 30 / 2            // half of V158's 30
const GRID_LONGITUDES   = 24    // longitudinal grid lines
const RING_SEGMENTS     = 48

const REL_STEP          = 14 * GEO_SCALE    // vertical distance between relative-axis ticks
const REL_COLUMN_RADIUS = 14 * GEO_SCALE
const REL_COLUMN_PAD    = 8 * GEO_SCALE

const TRAVEL_DURATION   = 0.55  // seconds per primary step
const REL_DURATION      = 0.45  // seconds per relative step
const HOLD_REPEAT_MS    = 450   // exported for the pad: hold-to-repeat interval

// v2: V159 moved the axes to start at the origin; old saved positions (V158 centred the
// axis on the origin) would start the markers mid-tunnel, so they are not reused.
const STORE_KEY = 'omni:dimension-axes-v2'

export { HOLD_REPEAT_MS }

const NODE_LABEL_PREFIX = { conscious: '', omnihand: '⟐' }

// Colours chosen to read on both the white scene background and dark themes.
const AXIS_DEFS = {
  conscious: {
    symbol: CONSCIOUS_SYMBOL, title: 'Conscious Hand', primaryTerm: 'Perspective',
    relativeTerm: 'Scale', color: 0x8a5cff,
    nodes: CONSCIOUS_PERSPECTIVES, levels: CONSCIOUS_SCALE_DEGREES,
    // Visual direction of increasing index on the relative column: -1 means
    // deeper scale degrees sit LOWER, so pad Up moves back toward Human scale.
    relDir: -1, nodeShape: 'icosahedron',
  },
  omnihand: {
    symbol: OMNIHAND_SYMBOL, title: 'OmniHand', primaryTerm: 'Product',
    relativeTerm: 'Tier', color: 0xff8a1f,
    nodes: OMNIHAND_PRODUCTS, levels: OMNIHAND_TIERS,
    // +1: higher tiers sit higher, pad Up moves to a higher tier.
    relDir: 1, nodeShape: 'octahedron',
  },
}

const HAND_IDS = ['conscious', 'omnihand']

const STYLES = /* css */`
.omni-dim-readout {
  position        : fixed;
  top             : 56px;
  left            : 50%;
  transform       : translateX(-50%);
  z-index         : 40;
  pointer-events  : none;
  display         : flex;
  flex-direction  : column;
  gap             : 3px;
  padding         : 6px 10px;
  max-width       : 92vw;
  background      : var(--ttm-bg, rgba(8, 8, 12, 0.82));
  border          : 1px solid var(--ttm-border, rgba(255, 255, 255, 0.15));
  border-radius   : 8px;
  color           : var(--ttm-color, #ffffff);
  font-family     : 'Courier New', Courier, monospace;
  font-size       : 10px;
  letter-spacing  : 0.03em;
  white-space     : nowrap;
  overflow        : hidden;
  backdrop-filter : blur(10px);
  -webkit-backdrop-filter: blur(10px);
}
.omni-dim-readout[hidden] { display: none; }
.odr-row  { display: flex; gap: 8px; align-items: baseline; }
.odr-sym  { font-size: 12px; min-width: 14px; text-align: center; }
.odr-dim  { opacity: 0.6; }
.odr-name { font-weight: bold; }
.odr-idx  { opacity: 0.55; }
`

function injectStyles () {
  if (document.getElementById('omni-dim-axes-styles')) return
  const tag = document.createElement('style')
  tag.id = 'omni-dim-axes-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

function esc (s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const hex = (n) => '#' + n.toString(16).padStart(6, '0')

/** Top-down clock hour -> world unit vector. 12 = -Z, 3 = +X. */
function clockToDir (hour) {
  const a = (hour / 12) * Math.PI * 2
  return new THREE.Vector3(Math.sin(a), 0, -Math.cos(a))
}

/** These objects are huge and translucent: they must never be hit by a
 *  raycast. Every existing raycaster (OmniNode, OmniPointing, OmniGrab...)
 *  uses explicit mesh lists or plane math, so none would touch them today;
 *  this guards any future scene-wide raycast too. */
function makeInert (obj) {
  obj.traverse(o => {
    o.raycast = () => {}
    o.userData.omniDimensionAxes = true
  })
}

function makeLabelSprite (text, colorHex, widthWorld) {
  const W = 512, H = 128
  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  const c = canvas.getContext('2d')
  c.fillStyle = 'rgba(8, 8, 12, 0.78)'
  const r = 28
  c.beginPath()
  c.moveTo(r, 6); c.lineTo(W - r, 6); c.quadraticCurveTo(W - 6, 6, W - 6, r)
  c.lineTo(W - 6, H - r); c.quadraticCurveTo(W - 6, H - 6, W - r, H - 6)
  c.lineTo(r, H - 6); c.quadraticCurveTo(6, H - 6, 6, H - r)
  c.lineTo(6, r); c.quadraticCurveTo(6, 6, r, 6); c.closePath()
  c.fill()
  c.lineWidth = 5
  c.strokeStyle = colorHex
  c.stroke()
  c.fillStyle = '#ffffff'
  c.font = '600 54px "Courier New", Courier, monospace'
  c.textAlign = 'center'
  c.textBaseline = 'middle'
  c.fillText(text, W / 2, H / 2 + 3, W - 40)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })
  const sprite = new THREE.Sprite(mat)
  sprite.scale.set(widthWorld, widthWorld * (H / W), 1)
  sprite.renderOrder = 10
  return sprite
}

export default class OmniDimensionalAxes {
  constructor (context) {
    this.ctx = context
    this._root = null
    this._hands = {}
    this._readoutEl = null
    this._visible = true
    this._time = 0
    this._disposables = []
    this._onVisibleSet = (e) => this.setVisible(!!e.detail?.visible)
    this._onReset = () => this.reset()
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  init () {
    if (this._root) return   // base.addModule may call init() after a manual call
    injectStyles()
    const saved = this._load()
    this._visible = saved.visible !== false   // default ON

    this._root = new THREE.Group()
    this._root.name = 'OmniDimensionalAxes'
    this.ctx.scene.add(this._root)

    HAND_IDS.forEach(id => {
      const h = this._buildHand(id, saved.hands?.[id])
      this._hands[id] = h
      this._root.add(h.group)
    })
    makeInert(this._root)

    this._buildReadout()
    this._applyVisibility()
    this._syncFromAnim()
    this._renderReadout()

    window.addEventListener('omni:dimension-axes-visible-set', this._onVisibleSet)
    window.addEventListener('omni:dimension-axes-reset', this._onReset)

    HAND_IDS.forEach(id => this._emit(id, 'init'))
    console.log('⟐ OmniDimensionalAxes: initialized.')
  }

  update (delta) {
    if (!this._root || !this._visible) return
    this._time += delta
    this._syncFromAnim(delta)
  }

  destroy () {
    window.removeEventListener('omni:dimension-axes-visible-set', this._onVisibleSet)
    window.removeEventListener('omni:dimension-axes-reset', this._onReset)
    Object.values(this._hands).forEach(h => {
      h.tweens.p?.kill(); h.tweens.r?.kill()
      gsap.killTweensOf([h.anim, h, ...h.nodes, ...h.ticks])
    })
    if (this._root) {
      this.ctx.scene.remove(this._root)
      this._root.traverse(o => {
        o.geometry?.dispose()
        const mats = Array.isArray(o.material) ? o.material : (o.material ? [o.material] : [])
        mats.forEach(m => { m.map?.dispose(); m.dispose() })
      })
    }
    this._readoutEl?.parentNode?.removeChild(this._readoutEl)
    this._root = null
    this._hands = {}
  }

  onResize () {}

  // ── Public API ──────────────────────────────────────────────────────────────

  isVisible () { return this._visible }

  setVisible (visible) {
    visible = !!visible
    if (visible === this._visible) return
    this._visible = visible
    this._applyVisibility()
    if (visible) this._syncFromAnim()
    this._persist()
    window.dispatchEvent(new CustomEvent('omni:dimension-axes-visible', { detail: { visible } }))
  }

  getState (hand) {
    const h = this._hands[hand]
    if (!h) return null
    return this._detail(h, 'settle')
  }

  /** Pad entry point. left/right = primary axis, up/down = relative axis. */
  step (hand, direction) {
    const h = this._hands[hand]
    if (!h) return false
    let p = h.state.p
    let r = h.state.r
    if (direction === 'left')  p -= 1
    if (direction === 'right') p += 1
    if (direction === 'up')    r += h.def.relDir
    if (direction === 'down')  r -= h.def.relDir
    p = clamp(p, 0, h.def.nodes.length - 1)
    r = clamp(r, 0, h.def.levels.length - 1)
    if (p === h.state.p && r === h.state.r) {
      this._bump(h)   // at the end of the axis: pulse the marker, don't move
      return false
    }
    this._setState(h, p, r, true)
    return true
  }

  goTo (hand, primaryIndex, relativeIndex) {
    const h = this._hands[hand]
    if (!h) return
    const p = clamp(Math.round(primaryIndex ?? h.state.p), 0, h.def.nodes.length - 1)
    const r = clamp(Math.round(relativeIndex ?? h.state.r), 0, h.def.levels.length - 1)
    this._setState(h, p, r, true)
  }

  reset () {
    HAND_IDS.forEach(id => {
      const h = this._hands[id]
      this._setState(h, h.defaults.p, h.defaults.r, true)
    })
  }

  // ── State ───────────────────────────────────────────────────────────────────

  _defaultState (def) {
    // V159: axes start at the origin, so the marker starts at the first node.
    return { p: 0, r: 0 }
  }

  _load () {
    try {
      const raw = localStorage.getItem(STORE_KEY)
      const parsed = raw ? JSON.parse(raw) : null
      return parsed && typeof parsed === 'object' ? parsed : {}
    } catch (_) { return {} }
  }

  _persist () {
    try {
      const hands = {}
      HAND_IDS.forEach(id => { if (this._hands[id]) hands[id] = { ...this._hands[id].state } })
      localStorage.setItem(STORE_KEY, JSON.stringify({ visible: this._visible, hands }))
    } catch (_) {}
  }

  _detail (h, phase) {
    const node = h.def.nodes[h.state.p]
    const level = h.def.levels[h.state.r]
    return {
      hand: h.id,
      phase,
      primaryIndex: h.state.p,
      primaryPosition: h.state.p,
      relativeIndex: h.state.r,
      relativePosition: h.state.r,
      primaryCount: h.def.nodes.length,
      relativeCount: h.def.levels.length,
      activeNode: { id: node.id, name: node.name, index: h.state.p },
      activeLevel: { id: level.id, name: level.name, index: h.state.r },
    }
  }

  _emit (handId, phase) {
    const h = this._hands[handId]
    if (!h) return
    window.dispatchEvent(new CustomEvent('omni:dimension-state', { detail: this._detail(h, phase) }))
  }

  /** Commit a new state and tween the animated values toward it. */
  _setState (h, p, r, animate) {
    const pChanged = p !== h.state.p
    const rChanged = r !== h.state.r
    const prevP = h.state.p
    h.state.p = p
    h.state.r = r
    this._persist()

    if (!animate) {
      h.anim.p = p; h.anim.r = r
    } else {
      if (pChanged) {
        const moving = h.tweens.p?.isActive()
        h.tweens.p?.kill()
        h.tweens.p = gsap.to(h.anim, {
          p, duration: TRAVEL_DURATION * Math.min(2, Math.max(1, Math.abs(p - h.anim.p))),
          ease: moving ? 'power2.out' : 'power2.inOut',
          onComplete: () => { h.tweens.p = null; this._maybeSettle(h) },
        })
        if (h.id === 'omnihand') this._staggerNodes(h, prevP, p)
      }
      if (rChanged) {
        const moving = h.tweens.r?.isActive()
        h.tweens.r?.kill()
        h.tweens.r = gsap.to(h.anim, {
          r, duration: REL_DURATION, ease: moving ? 'power2.out' : 'power2.inOut',
          onComplete: () => { h.tweens.r = null; this._maybeSettle(h) },
        })
        if (h.id === 'omnihand') this._staggerTicks(h, r)
      }
    }
    this._renderReadout()
    this._emit(h.id, 'travel')
    if (!animate) this._emit(h.id, 'settle')
  }

  /** 'settle' fires once, when neither axis is still tweening. */
  _maybeSettle (h) {
    if (!h.tweens.p && !h.tweens.r) this._emit(h.id, 'settle')
  }

  // ── OmniHand stagger ────────────────────────────────────────────────────────
  //
  // OmniHand's travel is accompanied by two gsap staggers on its own elements:
  //   1. every product node between the old and new position flashes in
  //      travel order, a wave that follows the marker;
  //   2. on a tier change the tier ticks flash outward from the new tier.
  // Conscious Hand deliberately has none (simpler, per the design).

  _staggerNodes (h, from, to) {
    const lo = Math.min(from, to), hi = Math.max(from, to)
    const path = h.nodes.slice(lo, hi + 1)
    if (from > to) path.reverse()
    gsap.killTweensOf(path)
    gsap.fromTo(path, { pulse: 1 }, {
      pulse: 0, duration: 0.8, ease: 'power2.out',
      stagger: { each: Math.min(0.12, TRAVEL_DURATION / Math.max(1, path.length)), from: 'start' },
    })
  }

  _staggerTicks (h, activeIndex) {
    gsap.killTweensOf(h.ticks)
    gsap.fromTo(h.ticks, { pulse: 1 }, {
      pulse: 0, duration: 0.7, ease: 'power2.out',
      stagger: { each: 0.08, from: activeIndex },
    })
  }

  _bump (h) {
    gsap.killTweensOf(h, 'bump')
    gsap.fromTo(h, { bump: 1 }, { bump: 0, duration: 0.35, ease: 'power2.out' })
  }

  // ── Scene construction ──────────────────────────────────────────────────────

  _yOf (h, j) {
    return (j - (h.def.levels.length - 1) / 2) * h.def.relDir * REL_STEP
  }

  _axisPoint (h, p, out) {
    const s = NODE_RADIUS + p * NODE_SPACING      // first node's near surface touches the origin
    return out.copy(h.dir).multiplyScalar(s).setY(AXIS_Y)
  }

  _buildHand (id, savedState) {
    const def = AXIS_DEFS[id]
    const n = def.nodes.length
    const m = def.levels.length
    const dir = clockToDir(CLOCK[id].pos)     // tunnel starts at the origin and runs toward this hour
    const colorHex = hex(def.color)

    const defaults = this._defaultState(def)
    const state = {
      p: clamp(Number.isFinite(savedState?.p) ? Math.round(savedState.p) : defaults.p, 0, n - 1),
      r: clamp(Number.isFinite(savedState?.r) ? Math.round(savedState.r) : defaults.r, 0, m - 1),
    }

    const h = {
      id, def, dir, defaults, state,
      anim: { p: state.p, r: state.r },
      tweens: { p: null, r: null },
      bump: 0,
      group: new THREE.Group(),
      nodes: [],
      ticks: [],
    }
    h.group.name = `OmniDimensionalAxes:${id}`

    // ── Tunnel: faint cylinder body + grid lines, built along local +Y then
    //    rotated so +Y lies on this hand's diagonal.
    const len = NODE_RADIUS + (n - 1) * NODE_SPACING + NODE_RADIUS + TUNNEL_END_PAD   // origin -> past last node
    const tunnel = new THREE.Group()
    tunnel.position.y = AXIS_Y
    tunnel.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir)

    const bodyGeo = new THREE.CylinderGeometry(TUNNEL_RADIUS, TUNNEL_RADIUS, len, GRID_LONGITUDES * 2, 1, true)
    bodyGeo.translate(0, len / 2, 0)             // span y = 0 .. len so the tunnel starts at the origin
    const bodyMat = new THREE.MeshBasicMaterial({
      color: TUNNEL_COLOR, transparent: true, opacity: 0.05, side: THREE.DoubleSide, depthWrite: false,
    })
    tunnel.add(new THREE.Mesh(bodyGeo, bodyMat))

    const verts = []
    for (let i = 0; i < GRID_LONGITUDES; i++) {
      const a = (i / GRID_LONGITUDES) * Math.PI * 2
      const x = Math.cos(a) * TUNNEL_RADIUS, z = Math.sin(a) * TUNNEL_RADIUS
      verts.push(x, 0, z, x, len, z)
    }
    for (let y = 0; y <= len; y += GRID_RING_STEP) {
      for (let i = 0; i < RING_SEGMENTS; i++) {
        const a0 = (i / RING_SEGMENTS) * Math.PI * 2
        const a1 = ((i + 1) / RING_SEGMENTS) * Math.PI * 2
        verts.push(Math.cos(a0) * TUNNEL_RADIUS, y, Math.sin(a0) * TUNNEL_RADIUS,
                   Math.cos(a1) * TUNNEL_RADIUS, y, Math.sin(a1) * TUNNEL_RADIUS)
      }
    }
    const gridGeo = new THREE.BufferGeometry()
    gridGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts), 3))
    const gridMat = new THREE.LineBasicMaterial({ color: TUNNEL_COLOR, transparent: true, opacity: 0.38, depthWrite: false })
    tunnel.add(new THREE.LineSegments(gridGeo, gridMat))
    h.group.add(tunnel)

    // ── Massive container nodes strung along the tunnel.
    const tmp = new THREE.Vector3()
    def.nodes.forEach((nd, i) => {
      const center = this._axisPoint(h, i, tmp).clone()
      const geo = def.nodeShape === 'octahedron'
        ? new THREE.OctahedronGeometry(NODE_RADIUS, 1)
        : new THREE.IcosahedronGeometry(NODE_RADIUS, 1)
      const fillMat = new THREE.MeshBasicMaterial({
        color: def.color, transparent: true, opacity: 0.05, side: THREE.DoubleSide, depthWrite: false,
      })
      const fill = new THREE.Mesh(geo, fillMat)
      const edgeMat = new THREE.LineBasicMaterial({ color: def.color, transparent: true, opacity: 0.22, depthWrite: false })
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), edgeMat)
      const label = makeLabelSprite(`${NODE_LABEL_PREFIX[id]}${nd.name}`, colorHex, LABEL_WIDTH_NODE)
      label.position.set(0, NODE_RADIUS + 10 * GEO_SCALE, 0)

      const g = new THREE.Group()
      g.position.copy(center)
      g.add(fill, edges, label)
      h.group.add(g)
      h.nodes.push({ group: g, fillMat, edgeMat, labelMat: label.material, glow: 0, pulse: 0 })
    })

    // ── Primary marker: a ring spanning the tunnel + an orb on the axis.
    const marker = new THREE.Group()
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(TUNNEL_RADIUS * 0.97, 0.9 * GEO_SCALE, 8, 64),
      new THREE.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.95, depthWrite: false })
    )
    ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir)
    const orb = new THREE.Mesh(
      new THREE.SphereGeometry(4.5 * GEO_SCALE, 16, 12),
      new THREE.MeshBasicMaterial({ color: def.color })
    )
    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(10 * GEO_SCALE, 16, 12),
      new THREE.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.22, depthWrite: false })
    )
    marker.add(ring, orb, halo)
    h.marker = marker
    h.markerRing = ring
    h.group.add(marker)

    // ── Relative axis: short vertical grid column + tick rings + orb, riding
    //    with the marker. World-vertical on screen, but semantically the hand's
    //    own dimension, not world up and not the camera.
    const colH = (m - 1) * REL_STEP + REL_COLUMN_PAD * 2
    const column = new THREE.Group()
    const cv = []
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2
      const x = Math.cos(a) * REL_COLUMN_RADIUS, z = Math.sin(a) * REL_COLUMN_RADIUS
      cv.push(x, -colH / 2, z, x, colH / 2, z)
    }
    const colGeo = new THREE.BufferGeometry()
    colGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(cv), 3))
    column.add(new THREE.LineSegments(colGeo,
      new THREE.LineBasicMaterial({ color: def.color, transparent: true, opacity: 0.45, depthWrite: false })))

    def.levels.forEach((lv, j) => {
      const y = this._yOf(h, j)
      const tickMat = new THREE.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.4, depthWrite: false })
      const tick = new THREE.Mesh(new THREE.TorusGeometry(REL_COLUMN_RADIUS * 1.15, 0.5 * GEO_SCALE, 6, 40), tickMat)
      tick.rotation.x = Math.PI / 2
      tick.position.y = y
      const lbl = makeLabelSprite(lv.name, colorHex, LABEL_WIDTH_LEVEL)
      lbl.position.set(REL_COLUMN_RADIUS * 1.15 + 17 * GEO_SCALE, y, 0)
      column.add(tick, lbl)
      h.ticks.push({ y, tickMat, labelMat: lbl.material, pulse: 0 })
    })

    const relOrb = new THREE.Mesh(
      new THREE.OctahedronGeometry(3.2 * GEO_SCALE, 0),
      new THREE.MeshBasicMaterial({ color: def.color })
    )
    column.add(relOrb)
    h.column = column
    h.relOrb = relOrb
    h.group.add(column)

    return h
  }

  // ── Per-frame visual sync ───────────────────────────────────────────────────

  _syncFromAnim (delta = 0) {
    const tmp = this._tmp || (this._tmp = new THREE.Vector3())
    const k = Math.min(1, delta * 9)
    HAND_IDS.forEach(id => {
      const h = this._hands[id]
      if (!h) return
      this._axisPoint(h, h.anim.p, tmp)
      h.marker.position.copy(tmp)
      h.column.position.copy(tmp)

      const breathe = 1 + 0.03 * Math.sin(this._time * 3) + 0.25 * h.bump
      h.markerRing.scale.setScalar(breathe)

      // relative orb rides along the column between the tick positions
      const j = h.anim.r
      const lo = Math.floor(j), hi = Math.min(h.ticks.length - 1, lo + 1)
      const f = j - lo
      const y = h.ticks[lo].y + (h.ticks[hi].y - h.ticks[lo].y) * f
      h.relOrb.position.y = y

      // nearest node = active; glow eases toward it, pulse (OmniHand stagger) adds on top
      const near = clamp(Math.round(h.anim.p), 0, h.nodes.length - 1)
      h.nodes.forEach((nd, i) => {
        nd.glow += ((i === near ? 1 : 0) - nd.glow) * (delta > 0 ? k : 1)
        const e = Math.max(nd.glow, nd.pulse)
        nd.fillMat.opacity = 0.05 + 0.13 * e
        nd.edgeMat.opacity = 0.22 + 0.7 * e
        nd.labelMat.opacity = 0.7 + 0.3 * e
        nd.group.scale.setScalar(1 + 0.04 * nd.glow)
      })

      // tick rings: brightness by proximity to the (animated) relative position
      h.ticks.forEach((tk, jj) => {
        const e = Math.max(1 - Math.min(1, Math.abs(jj - j)), tk.pulse)
        tk.tickMat.opacity = 0.35 + 0.65 * e
        tk.labelMat.opacity = 0.45 + 0.55 * e
      })
    })
  }

  // ── Visibility ──────────────────────────────────────────────────────────────

  _applyVisibility () {
    if (this._root) this._root.visible = this._visible
    if (this._readoutEl) this._readoutEl.hidden = !this._visible
  }

  // ── Readout ─────────────────────────────────────────────────────────────────
  //
  // A small fixed HUD plate styled with the same --ttm-* variables the global
  // tooltip styling (utils/ToolTipSettings.js) already writes onto :root, so
  // it follows the user's tooltip colours instead of introducing a new scheme.

  _buildReadout () {
    const shell = document.getElementById('omni-ui') ?? document.body
    const el = document.createElement('div')
    el.className = 'omni-dim-readout'
    el.setAttribute('role', 'status')
    el.setAttribute('aria-live', 'polite')
    shell.appendChild(el)
    this._readoutEl = el
  }

  _renderReadout () {
    if (!this._readoutEl) return
    this._readoutEl.innerHTML = HAND_IDS.map(id => {
      const h = this._hands[id]
      const node = h.def.nodes[h.state.p]
      const level = h.def.levels[h.state.r]
      const tip = [node.view, level.view].filter(Boolean).join(' / ')
      return `<div class="odr-row" title="${esc(tip)}">` +
        `<span class="odr-sym" style="color:${hex(h.def.color)}">${esc(h.def.symbol)}</span>` +
        `<span class="odr-dim">${esc(h.def.primaryTerm)}</span>` +
        `<span class="odr-name">${esc(node.name)}</span>` +
        `<span class="odr-idx">${h.state.p + 1}/${h.def.nodes.length}</span>` +
        `<span class="odr-dim">${esc(REL_AXIS_SYMBOL)} ${esc(h.def.relativeTerm)}</span>` +
        `<span class="odr-name">${esc(level.name)}</span>` +
        `<span class="odr-idx">${h.state.r + 1}/${h.def.levels.length}</span>` +
        `</div>`
    }).join('')
  }
}
