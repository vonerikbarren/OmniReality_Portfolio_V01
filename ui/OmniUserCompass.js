/**
 * ui/OmniUserCompass.js — the userCompass (V188; V190: a small floating panel of its own)
 *
 * A small, clear (transparent) spinning wireframe globe in a little panel the person can DRAG anywhere. Click it (without
 * dragging) / right-click / Enter or Space opens Admin > UI Settings > userCompass; the arrow keys nudge it (Shift = bigger
 * steps). In 'heading' mode the globe turns with the camera's yaw so it works as a real compass.
 *
 * V190 changes: it is no longer tied to the strip under the logo, so it is never hidden for lack of room. It is positioned with
 * plain left/top (px): the saved spot ('omni:user-compass-pos-v1') or, until the person drags it, a default free spot
 * (utils/OmniUserCompassSettings.js defaultCompassPos: the strip under the logo while the OmniNotify box is docked beside the
 * ribbon, otherwise the right edge just below the top hands banner). Whatever the spot, it is clamped into the viewport and kept
 * off the bar, the ribbon and the dock (clampCompassPos); the clamp never overwrites the saved spot.
 *
 * Drawn on a plain 2D <canvas> with the pure math of utils/OmniSphereGrid.js: it adds ZERO WebGL contexts.
 * No own requestAnimationFrame: BaseScene calls update(delta) every frame from the shared ticker (the app convention), which
 * also means the loop is idle while the tab is hidden. Work is skipped while the compass is hidden / the tab is hidden,
 * redrawn at <= ~30 fps while it moves and only on change when it is still.
 *
 * Options + storage + events: utils/OmniUserCompassSettings.js.   Window-chrome class B (a tiny widget, NOT a window: no
 * header, no resize / maximize, never registered with the WindowManager); it has its own pointer-event drag.
 * Module contract: constructor / init / update / destroy / onResize. A user-facing module: imports no Dev* module.
 */


import {
  STORE_KEY, SET_EVENT, CHANGED_EVENT, OPEN_ADMIN_EVENT, SIZES, SPINS, COLORS, DEFAULTS,
  loadOverrides, saveOverrides, sanitizePatch, resolveSettings, prefersReducedMotion,
  POS_KEY, PAD, EDGE, boxFor, sanitizePos, loadPos, savePos, clampCompassPos, defaultCompassPos,
} from '../utils/OmniUserCompassSettings.js'
import { buildSphereGrid, projectSphere, bucketSegments, headingFromQuaternion, headingToYaw, DEFAULT_TILT, DEFAULT_PITCH } from '../utils/OmniSphereGrid.js'
import { getLayout, getDockRow, getDockRowInset } from '../utils/OmniLayout.js'

export const ROOT_ID = 'omni-user-compass'
const STYLE_ID = 'omni-user-compass-styles'
const FRAME_MS = 1000 / 30          // redraw cap while moving
const LEVELS = 4                    // depth buckets = stroke() calls per frame (+ equator + prime)
const BACK_ALPHA = 0.16, FRONT_ALPHA = 0.95
const ACCENT_FALLBACK = [255, 178, 127]
const PERF_N = 240

const DRAG_PX = 4                   // movement before a press becomes a drag (below it, it is a click)
const NUDGE = 8, NUDGE_BIG = 32     // arrow-key steps

const STYLES = /* css */`
#${ROOT_ID} {
  position: fixed; left: 0; top: 0; box-sizing: border-box;
  width: var(--ouc-box, 54px); height: var(--ouc-box, 54px);
  display: flex; align-items: center; justify-content: center;
  pointer-events: auto;              /* #omni-ui is pointer-events:none and children inherit it: the panel must take the pointer itself */
  z-index: 42;                       /* with the minimap, under the hands (43), drawers (45), ribbon / bar / dock / notify box (49-51) and every window panel */
  background: var(--omni-theme-bg, rgba(10, 10, 14, 0.42));
  border: 1px solid var(--omni-theme-border, rgba(255, 255, 255, 0.12)); border-radius: 12px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.28);
  cursor: grab; touch-action: none;  /* the whole panel is the drag handle (touch-action: none so a finger drags the panel, not the page / camera) */
  user-select: none; -webkit-user-select: none;
}
#${ROOT_ID}.is-dragging { cursor: grabbing; box-shadow: 0 8px 22px rgba(0, 0, 0, 0.5); opacity: 0.96; }
#${ROOT_ID}[data-show="false"], #${ROOT_ID}[data-available="false"] { display: none; }
#${ROOT_ID} .ouc-btn {
  all: unset; box-sizing: border-box; display: block; flex: 0 0 auto; position: relative;
  width: var(--ouc-d, 44px); height: var(--ouc-d, 44px); border-radius: 50%;
  cursor: inherit; background: transparent;
  -webkit-tap-highlight-color: transparent;
}
#${ROOT_ID} .ouc-btn:focus-visible { outline: 2px solid var(--omni-theme-accent, rgba(255,255,255,0.9)); outline-offset: 2px; }
#${ROOT_ID}:hover .ouc-canvas { filter: brightness(1.25); }
#${ROOT_ID} .ouc-canvas { display: block; width: 100%; height: 100%; background: transparent; pointer-events: none; }
`

function injectStyles () {
  if (document.getElementById(STYLE_ID)) return
  const tag = document.createElement('style')
  tag.id = STYLE_ID
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

/** '#rgb' | '#rrggbb' | 'rgb(...)' | 'rgba(...)' -> [r,g,b] or null. */
export function parseCssColor (str) {
  const s = String(str ?? '').trim().toLowerCase()
  let m = /^#([0-9a-f]{3})$/.exec(s)
  if (m) return [...m[1]].map(c => parseInt(c + c, 16))
  m = /^#([0-9a-f]{6})(?:[0-9a-f]{2})?$/.exec(s)
  if (m) return [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16))
  m = /^rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/.exec(s)
  if (m) return [m[1], m[2], m[3]].map(v => Math.min(255, Math.max(0, Math.round(Number(v)))))
  return null
}

/** The sphere diameter: the chosen size, bounded by the viewport (a panel must fit on a tiny screen); 0 = hide. */
export function fitDiameter (sizeName, vw = 1280) {
  const want = SIZES[sizeName] ?? SIZES.medium
  return Math.max(0, Math.min(want, Math.floor((Number(vw) || 0) - 2 * PAD - 2 * EDGE)))
}

export default class OmniUserCompass {
  constructor (context) {
    this.ctx = context
    this._el = null; this._btn = null; this._canvas = null; this._g2 = null
    this._overrides = {}
    this._settings = resolveSettings({})
    this._grid = buildSphereGrid()
    this._d = 0; this._box = 0; this._dpr = 1
    this._saved = null          // the person's dragged spot { x, y } (or null = the default spot)
    this._pos = { x: 0, y: 0 }  // where the panel is drawn right now (clamped)
    this._drag = null; this._justDragged = false
    this._yaw = 0; this._lastHeading = null; this._acc = 0; this._dirty = true
    this._rgb = COLORS.white; this._accentAt = 0
    this._perf = new Float32Array(PERF_N); this._perfN = 0
    this._onSet = null; this._onLayout = null; this._onVis = null; this._onClick = null; this._onCtx = null; this._mq = null; this._onMq = null
    this._onDown = null; this._onMove = null; this._onUp = null; this._onKey = null
    this._drawn = 0
  }

  // ── lifecycle ───────────────────────────────────────────────────────────────

  init () {
    if (this._el) return                                    // never twice
    injectStyles()
    this._overrides = loadOverrides()
    this._settings = resolveSettings(this._overrides)
    this._saved = loadPos()
    this._build()
    this._onSet = (e) => this._handleSet(e?.detail)
    this._onLayout = () => this._layout()
    this._onVis = () => { this._dirty = true }
    this._onClick = () => { if (this._justDragged) { this._justDragged = false; return } this.openSettings() }
    this._onCtx = (e) => { e.preventDefault(); this.openSettings() }
    this._onDown = (e) => this._beginDrag(e)
    this._onMove = (e) => this._moveDrag(e)
    this._onUp = (e) => this._endDrag(e)
    this._onKey = (e) => this._keyNudge(e)
    window.addEventListener(SET_EVENT, this._onSet)
    window.addEventListener('omni:layout-changed', this._onLayout)
    window.addEventListener('resize', this._onLayout)
    document.addEventListener('visibilitychange', this._onVis)
    this._btn.addEventListener('click', this._onClick)
    this._btn.addEventListener('contextmenu', this._onCtx)
    this._btn.addEventListener('keydown', this._onKey)
    this._el.addEventListener('pointerdown', this._onDown)
    try {
      this._mq = window.matchMedia?.('(prefers-reduced-motion: reduce)') ?? null
      this._onMq = () => { this._settings = resolveSettings(this._overrides); this._apply(); this._announce() }
      this._mq?.addEventListener?.('change', this._onMq)
    } catch (_) { this._mq = null }
    this._apply()
    this._announce()
  }

  update (delta) {
    if (!this._el || !this._g2 || !this._d || !this._shown() || document.hidden) return
    const s = this._settings
    let need = this._dirty
    if (s.mode === 'heading') {
      const h = this._readHeading()
      if (h !== null && (this._lastHeading === null || Math.abs(h - this._lastHeading) > 0.002)) {
        this._lastHeading = h; this._yaw = headingToYaw(h); need = true
      }
    } else {
      const secs = SPINS[s.spin] ?? 0
      if (secs > 0) { this._yaw = (this._yaw + (2 * Math.PI * Math.min(delta, 0.5)) / secs) % (2 * Math.PI); need = true }
    }
    if (!need) return
    this._acc += delta * 1000
    if (!this._dirty && this._acc < FRAME_MS) return        // moving: cap at ~30 fps (a settings change redraws at once)
    this._acc = 0
    const t0 = performance.now()
    this._draw()
    this._dirty = false
    this._perf[this._perfN++ % PERF_N] = performance.now() - t0
  }

  onResize () { this._layout() }

  destroy () {
    this._stopDragListeners()
    window.removeEventListener(SET_EVENT, this._onSet)
    window.removeEventListener('omni:layout-changed', this._onLayout)
    window.removeEventListener('resize', this._onLayout)
    document.removeEventListener('visibilitychange', this._onVis)
    this._btn?.removeEventListener('click', this._onClick)
    this._btn?.removeEventListener('contextmenu', this._onCtx)
    this._btn?.removeEventListener('keydown', this._onKey)
    this._el?.removeEventListener('pointerdown', this._onDown)
    try { this._mq?.removeEventListener?.('change', this._onMq) } catch (_) {}
    this._el?.remove()
    document.getElementById(STYLE_ID)?.remove()
    this._el = this._btn = this._canvas = this._g2 = null
    this._onSet = this._onLayout = this._onVis = this._onClick = this._onCtx = this._onMq = this._mq = null
    this._onDown = this._onMove = this._onUp = this._onKey = null
  }

  // ── public API ──────────────────────────────────────────────────────────────

  getSettings () { return { ...this._settings } }
  /** V190: the panel's rectangle { x, y, w, h } in css px (what the old slot used to be) + whether it is the person's own spot. */
  getRect () { return { x: this._pos.x, y: this._pos.y, w: this._box, h: this._box, custom: !!this._saved } }
  getPosition () { return { x: this._pos.x, y: this._pos.y, custom: !!this._saved } }
  getDiameter () { return this._d }
  getYaw () { return this._yaw }
  /** { n, p50, p95, max } of the last draws in ms (for tooling). */
  getPerf () {
    const n = Math.min(this._perfN, PERF_N); if (!n) return { n: 0, p50: 0, p95: 0, max: 0 }
    const a = Array.from(this._perf.subarray(0, n)).sort((x, y) => x - y)
    return { n, p50: a[Math.floor(n * 0.5)], p95: a[Math.min(n - 1, Math.floor(n * 0.95))], max: a[n - 1] }
  }
  /** Programmatic form of the omni:user-compass-set event. */
  setSettings (patch) { return this._handleSet({ patch }) }
  /** Move the panel (clamped to the free screen) and remember the spot. */
  setPosition (x, y) { return this._handleSet({ pos: { x, y } }) }
  resetPosition () { return this._handleSet({ resetPos: true }) }
  reset () { return this._handleSet({ reset: true }) }
  openSettings () {
    window.dispatchEvent(new CustomEvent(OPEN_ADMIN_EVENT, { detail: { section: 'uisettings', focus: 'usercompass' } }))
  }

  // ── internals ───────────────────────────────────────────────────────────────

  _shown () { return !!this._el && this._settings.show && this._d > 0 }

  _build () {
    const el = document.createElement('div')
    el.id = ROOT_ID
    el.innerHTML = /* html */`
      <button class="ouc-btn" type="button" aria-label="userCompass"
              data-omni-tip="userCompass" data-omni-tip-key="Drag · click for settings"
              data-omni-tip-desc="Your orientation globe, a small panel of its own. Drag it anywhere (it remembers the spot; arrow keys nudge it). Click for its settings, where you can also put it back.">
        <canvas class="ouc-canvas" aria-hidden="true"></canvas>
      </button>`
    this._el = el
    this._btn = el.querySelector('.ouc-btn')
    this._canvas = el.querySelector('canvas')
    try { this._g2 = this._canvas.getContext('2d') } catch (_) { this._g2 = null }   // jsdom has none: the DOM + options still work
    ;(document.getElementById('omni-ui') ?? document.body).appendChild(el)
  }

  _handleSet (detail) {
    if (!this._el) return false
    let changed = false, posChanged = false
    if (detail?.reset === true) {
      changed = Object.keys(this._overrides).length > 0
      this._overrides = {}
      if (this._saved) { this._saved = null; savePos(null); posChanged = true }
    } else {
      const clean = sanitizePatch(detail?.patch)
      for (const k of Object.keys(clean)) {
        if (this._overrides[k] !== clean[k]) { this._overrides[k] = clean[k]; changed = true }
      }
      if (detail?.resetPos === true && this._saved) { this._saved = null; savePos(null); posChanged = true }
      const p = sanitizePos(detail?.pos)
      if (p) {
        const c = this._clamp(p)                                   // remember the clamped spot: what the person sees is what is kept
        if (!this._saved || this._saved.x !== c.x || this._saved.y !== c.y) { this._saved = c; savePos(c); posChanged = true }
      }
    }
    if (!changed && !posChanged) return false
    if (changed) saveOverrides(this._overrides)
    this._settings = resolveSettings(this._overrides)
    this._apply()
    this._announce()
    return true
  }

  _announce () {
    window.dispatchEvent(new CustomEvent(CHANGED_EVENT, { detail: { settings: this.getSettings(), pos: this.getPosition() } }))
  }

  /** Settings -> DOM (show, size) + a redraw. */
  _apply () {
    const s = this._settings
    this._el.dataset.show = String(!!s.show)
    this._el.dataset.size = s.size
    this._el.dataset.color = s.color
    this._el.dataset.mode = s.mode
    this._btn.setAttribute('aria-label', 'userCompass')
    this._rgb = this._resolveColor()
    this._layout()
  }

  /** The viewport + chrome numbers the pure clamp / default functions need. */
  _viewport () {
    const lay = getLayout()
    return {
      vw: window.innerWidth || 1280, vh: window.innerHeight || 720,
      barH: lay.barH, topOffset: lay.topOffset, topStack: lay.topStack, ribbonH: lay.ribbonH, ribbonLeft: lay.ribbonLeft,
    }
  }

  /** Free width to the left of a docked OmniNotify box (0 unless the box really is docked beside the ribbon). */
  _leftFree (vp) {
    if (!(vp.ribbonLeft > 0)) return 0
    const nb = document.getElementById('omni-notify-box')
    if (!nb || nb.dataset.mode !== 'side') return 0
    const x = parseFloat(nb.style.left)
    return Number.isFinite(x) && x > 0 ? x : 0
  }

  /** V191: a compass that is NOT docked stays above the OmniDock_Realities row (and the Dock); the docked default sits in the row itself. */
  _vpFor (docked) {
    const vp = this._viewport(), row = getDockRow()
    return docked ? vp : { ...vp, dockH: row.bottom + (row.on ? row.h : 0) }
  }

  _clamp (pos) { return clampCompassPos(pos, this._box, this._vpFor(false)) }

  _layout () {
    if (!this._el) return
    const vp = this._viewport()
    this._d = fitDiameter(this._settings.size, vp.vw)
    this._box = boxFor(this._d)
    const dockRow = { ...getDockRow(), inset: getDockRowInset(vp.vw) }      // V191: the default spot is the left end of the OmniDock_Realities row
    const spot = this._saved ?? defaultCompassPos(this._box, vp.vw, { ...vp, leftFree: this._leftFree(vp), dockRow })
    const docked = !this._saved && !this._drag?.live && dockRow.on
    this._pos = clampCompassPos(this._drag?.live ?? spot, this._box, this._vpFor(docked))
    const st = this._el.style
    st.left = this._pos.x + 'px'; st.top = this._pos.y + 'px'
    st.setProperty('--ouc-box', this._box + 'px')
    st.setProperty('--ouc-d', this._d + 'px')
    this._el.dataset.available = String(this._d > 0)
    this._el.dataset.pos = this._saved ? 'custom' : (docked ? 'docked' : 'default')
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const px = Math.max(1, Math.round(this._d * dpr))
    if (this._canvas && (this._canvas.width !== px || dpr !== this._dpr)) { this._canvas.width = px; this._canvas.height = px }
    this._dpr = dpr
    this._dirty = true
  }

  // ── dragging (pointer events: mouse, pen and touch) ─────────────────────────

  _beginDrag (e) {
    if (e.button > 0 || this._drag) return
    this._drag = { px: e.clientX, py: e.clientY, ox: this._pos.x, oy: this._pos.y, moved: false, id: e.pointerId, live: null }
    try { this._el.setPointerCapture?.(e.pointerId) } catch (_) {}
    window.addEventListener('pointermove', this._onMove)
    window.addEventListener('pointerup', this._onUp)
    window.addEventListener('pointercancel', this._onUp)
  }

  _moveDrag (e) {
    const d = this._drag
    if (!d || (d.id !== undefined && e.pointerId !== undefined && e.pointerId !== d.id)) return
    const dx = e.clientX - d.px, dy = e.clientY - d.py
    if (!d.moved && Math.hypot(dx, dy) < DRAG_PX) return
    if (!d.moved) { d.moved = true; this._el.classList.add('is-dragging') }
    d.live = { x: d.ox + dx, y: d.oy + dy }
    this._layout()
  }

  _endDrag (e) {
    const d = this._drag
    if (!d) return
    const commit = d.moved && e?.type !== 'pointercancel'
    this._stopDragListeners()
    this._drag = null
    this._el?.classList.remove('is-dragging')
    if (d.moved) {
      this._justDragged = true                                   // swallow the click that follows a drag
      setTimeout(() => { this._justDragged = false }, 0)
      if (commit) this._handleSet({ pos: this._pos }); else this._layout()
    }
  }

  _stopDragListeners () {
    window.removeEventListener('pointermove', this._onMove)
    window.removeEventListener('pointerup', this._onUp)
    window.removeEventListener('pointercancel', this._onUp)
  }

  _keyNudge (e) {
    const k = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key]
    if (!k || e.ctrlKey || e.metaKey || e.altKey) return
    e.preventDefault(); e.stopPropagation()
    const step = e.shiftKey ? NUDGE_BIG : NUDGE
    this._handleSet({ pos: { x: this._pos.x + k[0] * step, y: this._pos.y + k[1] * step } })
  }

  _resolveColor () {
    const c = COLORS[this._settings.color]
    if (c) return c
    this._accentAt = performance.now()
    try { return parseCssColor(getComputedStyle(document.documentElement).getPropertyValue('--omni-theme-accent')) ?? ACCENT_FALLBACK } catch (_) { return ACCENT_FALLBACK }
  }

  _readHeading () {
    const q = this.ctx?.camera?.quaternion
    return q ? headingFromQuaternion(q) : null
  }

  _draw () {
    const g = this._g2, d = this._d
    if (!g || !d) return
    const s = this._settings
    if (s.color === 'accent' && performance.now() - this._accentAt > 2000) { this._rgb = this._resolveColor(); }
    const px = this._canvas.width
    g.setTransform(1, 0, 0, 1, 0, 0)
    g.clearRect(0, 0, px, px)                                // fully transparent background: nothing is ever filled
    const k = px / d                                         // css px -> device px
    const R = d / 2 - 1.5                                    // leave room for the stroke
    const segs = projectSphere(this._grid, { yaw: this._yaw, tilt: DEFAULT_TILT, pitch: DEFAULT_PITCH, radius: R * k, cx: px / 2, cy: px / 2 })
    const { buckets, equator, prime } = bucketSegments(segs, LEVELS)
    const [r, gg, b] = this._rgb
    const op = s.opacity / 100
    const alphaAt = (lvl) => op * (BACK_ALPHA + (FRONT_ALPHA - BACK_ALPHA) * ((lvl + 0.5) / LEVELS))
    g.lineCap = 'round'
    g.lineWidth = Math.max(1, 1.05 * k)
    for (let i = 0; i < LEVELS; i++) {                       // back -> front, one stroke() per level
      const list = buckets[i]; if (!list.length) continue
      g.strokeStyle = `rgba(${r},${gg},${b},${alphaAt(i).toFixed(3)})`
      g.beginPath()
      for (const q of list) { g.moveTo(q.x1, q.y1); g.lineTo(q.x2, q.y2) }
      g.stroke()
    }
    const heading = s.mode === 'heading'
    const strokeKind = (list, boost, width) => {              // equator / prime: one stroke per depth level, a touch brighter
      for (let i = 0; i < LEVELS; i++) {
        let any = false
        for (const e of list) if (e.i === i) { if (!any) { g.beginPath(); any = true } g.moveTo(e.s.x1, e.s.y1); g.lineTo(e.s.x2, e.s.y2) }
        if (!any) continue
        g.strokeStyle = `rgba(${r},${gg},${b},${Math.min(1, alphaAt(i) * boost).toFixed(3)})`
        g.lineWidth = Math.max(1, width * k)
        g.stroke()
      }
    }
    strokeKind(equator, 1.45, 1.35)
    // prime meridian: same as the other meridians in 'spin' mode, brighter in 'heading' mode (it is "north")
    strokeKind(prime, heading ? 1.6 : 1, heading ? 1.5 : 1.05)
    // a faint limb so the clear globe still reads as a ball
    g.strokeStyle = `rgba(${r},${gg},${b},${(op * 0.22).toFixed(3)})`
    g.lineWidth = Math.max(1, k)
    g.beginPath(); g.arc(px / 2, px / 2, R * k, 0, Math.PI * 2); g.stroke()
    this._drawn++
  }
}

export { STORE_KEY, SET_EVENT, CHANGED_EVENT, DEFAULTS, POS_KEY }
