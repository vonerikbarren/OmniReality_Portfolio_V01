/**
 * ui/OmniUserCompass.js — the userCompass (V188)
 *
 * A small, clear (transparent), spinning wireframe globe that sticks to the strip directly under the Global Bar's logo
 * cell and above the top-left hand's MENU cell. It is decorative + clickable (opens Admin > UI Settings > userCompass),
 * and in 'heading' mode it turns with the camera's yaw so it works as a real compass.
 *
 * Drawn on a plain 2D <canvas> with the pure math of utils/OmniSphereGrid.js: it adds ZERO WebGL contexts.
 * No own requestAnimationFrame: BaseScene calls update(delta) every frame from the shared ticker (the app convention), which
 * also means the loop is idle while the tab is hidden. Work is skipped while the compass is hidden / unavailable / the tab
 * is hidden, redrawn at <= ~30 fps while it moves and only on change when it is still.
 *
 * Slot geometry: utils/OmniLayout.js computeCompassSlot() (+ the --omni-compass-slot-* CSS variables). The box follows the
 * ribbon's height (--omni-ribbon-h) and never overlaps the hand cell, the ribbon, the notify box or the Global Bar: when
 * the ribbon covers the slot (narrow screens, floated notify box) or the strip is under 24px, the compass hides itself.
 * Only the round button takes pointer events; the rest of the slot box is pointer-events:none.
 *
 * Options + storage + events: utils/OmniUserCompassSettings.js.   This is a class-B overlay (NOT a window: no resize / maximize).
 * Module contract: constructor / init / update / destroy / onResize. A user-facing module: imports no Dev* module.
 */

import {
  STORE_KEY, SET_EVENT, CHANGED_EVENT, OPEN_ADMIN_EVENT, SIZES, SPINS, COLORS, DEFAULTS,
  loadOverrides, saveOverrides, sanitizePatch, resolveSettings, prefersReducedMotion,
} from '../utils/OmniUserCompassSettings.js'
import { buildSphereGrid, projectSphere, bucketSegments, headingFromQuaternion, headingToYaw, DEFAULT_TILT, DEFAULT_PITCH } from '../utils/OmniSphereGrid.js'
import { getLayout, computeCompassSlot, COMPASS_PAD_X, COMPASS_PAD_Y, HAND_COL_W } from '../utils/OmniLayout.js'

export const ROOT_ID = 'omni-user-compass'
const STYLE_ID = 'omni-user-compass-styles'
const FRAME_MS = 1000 / 30          // redraw cap while moving
const LEVELS = 4                    // depth buckets = stroke() calls per frame (+ equator + prime)
const BACK_ALPHA = 0.16, FRONT_ALPHA = 0.95
const ACCENT_FALLBACK = [255, 178, 127]
const PERF_N = 240

const STYLES = /* css */`
#${ROOT_ID} {
  position: fixed; left: 0; box-sizing: border-box;
  top: var(--omni-compass-slot-top, 48px);
  width: var(--omni-compass-slot-w, ${HAND_COL_W}px);
  height: var(--omni-compass-slot-h, 0px);
  padding: ${COMPASS_PAD_Y}px ${COMPASS_PAD_X}px;
  display: flex; align-items: center; justify-content: center;
  z-index: 42;                       /* with the minimap, under the hands (43), drawers (45), ribbon / bar / dock / notify box (49-51) and every panel */
  pointer-events: none;              /* only the round button below takes the pointer */
  user-select: none; -webkit-user-select: none;
}
#${ROOT_ID}[data-available="false"], #${ROOT_ID}[data-show="false"] { display: none; }
#${ROOT_ID}[data-align="left"]   { justify-content: flex-start; }
#${ROOT_ID}[data-align="right"]  { justify-content: flex-end; }
#${ROOT_ID} .ouc-btn {
  all: unset; box-sizing: border-box; display: block; flex: 0 0 auto; position: relative;
  width: var(--ouc-d, 44px); height: var(--ouc-d, 44px); border-radius: 50%;
  pointer-events: auto; cursor: pointer; background: transparent;
  -webkit-tap-highlight-color: transparent;
}
#${ROOT_ID} .ouc-btn:focus-visible { outline: 2px solid var(--omni-theme-accent, rgba(255,255,255,0.9)); outline-offset: 2px; }
#${ROOT_ID} .ouc-btn:hover .ouc-canvas { filter: brightness(1.25); }
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

/** The sphere diameter that fits the slot: the chosen size, bounded by the slot; 0 = hide (under the 24px minimum). */
export function fitDiameter (sizeName, slot) {
  if (!slot?.available) return 0
  return Math.min(SIZES[sizeName] ?? SIZES.medium, slot.maxD)
}

export default class OmniUserCompass {
  constructor (context) {
    this.ctx = context
    this._el = null; this._btn = null; this._canvas = null; this._g2 = null
    this._overrides = {}
    this._settings = resolveSettings({})
    this._grid = buildSphereGrid()
    this._slot = null; this._d = 0; this._dpr = 1
    this._yaw = 0; this._lastHeading = null; this._acc = 0; this._dirty = true
    this._rgb = COLORS.white; this._accentAt = 0
    this._perf = new Float32Array(PERF_N); this._perfN = 0
    this._onSet = null; this._onLayout = null; this._onVis = null; this._onClick = null; this._onCtx = null; this._mq = null; this._onMq = null
    this._drawn = 0
  }

  // ── lifecycle ───────────────────────────────────────────────────────────────

  init () {
    if (this._el) return                                    // never twice
    injectStyles()
    this._overrides = loadOverrides()
    this._settings = resolveSettings(this._overrides)
    this._build()
    this._onSet = (e) => this._handleSet(e?.detail)
    this._onLayout = () => this._layout()
    this._onVis = () => { this._dirty = true }
    this._onClick = () => this.openSettings()
    this._onCtx = (e) => { e.preventDefault(); this.openSettings() }
    window.addEventListener(SET_EVENT, this._onSet)
    window.addEventListener('omni:layout-changed', this._onLayout)
    window.addEventListener('resize', this._onLayout)
    document.addEventListener('visibilitychange', this._onVis)
    this._btn.addEventListener('click', this._onClick)
    this._btn.addEventListener('contextmenu', this._onCtx)
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
    window.removeEventListener(SET_EVENT, this._onSet)
    window.removeEventListener('omni:layout-changed', this._onLayout)
    window.removeEventListener('resize', this._onLayout)
    document.removeEventListener('visibilitychange', this._onVis)
    this._btn?.removeEventListener('click', this._onClick)
    this._btn?.removeEventListener('contextmenu', this._onCtx)
    try { this._mq?.removeEventListener?.('change', this._onMq) } catch (_) {}
    this._el?.remove()
    document.getElementById(STYLE_ID)?.remove()
    this._el = this._btn = this._canvas = this._g2 = null
    this._onSet = this._onLayout = this._onVis = this._onClick = this._onCtx = this._onMq = this._mq = null
  }

  // ── public API ──────────────────────────────────────────────────────────────

  getSettings () { return { ...this._settings } }
  getSlot () { return this._slot ? { ...this._slot } : null }
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
  reset () { return this._handleSet({ reset: true }) }
  openSettings () {
    window.dispatchEvent(new CustomEvent(OPEN_ADMIN_EVENT, { detail: { section: 'uisettings', focus: 'usercompass' } }))
  }

  // ── internals ───────────────────────────────────────────────────────────────

  _shown () { return !!this._el && this._settings.show && this._slot?.available && this._d > 0 }

  _build () {
    const el = document.createElement('div')
    el.id = ROOT_ID
    el.innerHTML = /* html */`
      <button class="ouc-btn" type="button" aria-label="userCompass"
              data-omni-tip="userCompass" data-omni-tip-key="—"
              data-omni-tip-desc="Your orientation globe. Click for settings.">
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
    let changed = false
    if (detail?.reset === true) {
      changed = Object.keys(this._overrides).length > 0
      this._overrides = {}
    } else {
      const clean = sanitizePatch(detail?.patch)
      for (const k of Object.keys(clean)) {
        if (this._overrides[k] !== clean[k]) { this._overrides[k] = clean[k]; changed = true }
      }
    }
    if (!changed) return false
    saveOverrides(this._overrides)
    this._settings = resolveSettings(this._overrides)
    this._apply()
    this._announce()
    return true
  }

  _announce () {
    window.dispatchEvent(new CustomEvent(CHANGED_EVENT, { detail: { settings: this.getSettings() } }))
  }

  /** Settings -> DOM (alignment, show, size) + a redraw. */
  _apply () {
    const s = this._settings
    this._el.dataset.align = s.align
    this._el.dataset.show = String(!!s.show)
    this._el.dataset.size = s.size
    this._el.dataset.color = s.color
    this._el.dataset.mode = s.mode
    this._btn.setAttribute('aria-label', 'userCompass')
    this._rgb = this._resolveColor()
    this._layout()
  }

  _layout () {
    if (!this._el) return
    const vw = window.innerWidth || 1280
    this._slot = computeCompassSlot(getLayout(), vw)
    this._d = fitDiameter(this._settings.size, this._slot)
    this._el.dataset.available = String(this._slot.available)
    if (!this._slot.available) this._el.dataset.reason = this._slot.reason; else delete this._el.dataset.reason
    this._el.style.setProperty('--ouc-d', this._d + 'px')
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const px = Math.max(1, Math.round(this._d * dpr))
    if (this._canvas && (this._canvas.width !== px || dpr !== this._dpr)) { this._canvas.width = px; this._canvas.height = px }
    this._dpr = dpr
    this._dirty = true
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

export { STORE_KEY, SET_EVENT, CHANGED_EVENT, DEFAULTS }
