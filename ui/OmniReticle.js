/**
 * ui/OmniReticle.js — the centre HUD reticle (V190): "a multi tech circle in the middle with an opacity at like .15"
 *
 * Interpretation (the owner was not asked): a decorative technical-HUD reticle centred on the screen: concentric thin rings with
 * tick marks, a dashed ring, a few bold arcs, corner brackets and small cross ticks. Pure SVG built with createElementNS (no
 * innerHTML, no canvas, NO WebGL context: the page already holds 5). The whole drawing is ONE element with opacity 0.15 by default.
 *
 * Cost: none per frame. The rings turn slowly with CSS keyframe animations (compositor-only `transform`), so update(delta)
 * is empty and the shared ticker does no work for it. With prefers-reduced-motion: reduce nothing rotates (a still drawing).
 *
 * Layering: pointer-events:none everywhere (it can never block the camera or a click), z-index 1 inside #omni-ui so it sits
 * above the 3D canvas and below every UI element; it is the FIRST child of #omni-ui. Window-chrome class B (a decoration,
 * not a window: no header, no handles, never registered with the WindowManager).
 *
 * Options (show, opacity) + storage + events: utils/OmniReticleSettings.js; user-facing in Admin > UI Settings > Reticle.
 * Module contract: constructor / init / update / destroy / onResize. A user-facing module: imports no Dev* module.
 */

import {
  SET_EVENT, CHANGED_EVENT, STORE_KEY, DEFAULTS,
  loadOverrides, saveOverrides, sanitizePatch, resolveSettings, prefersReducedMotion,
} from '../utils/OmniReticleSettings.js'

export const ROOT_ID = 'omni-reticle'
const STYLE_ID = 'omni-reticle-styles'
const SVG_NS = 'http://www.w3.org/2000/svg'

const STYLES = /* css */`
#${ROOT_ID} {
  position: fixed; left: 50%; top: 50%; z-index: 1;
  width: min(64vmin, 640px); height: min(64vmin, 640px); transform: translate(-50%, -50%);
  pointer-events: none; user-select: none; -webkit-user-select: none;
  opacity: var(--oret-opacity, 0.15);
  color: var(--omni-theme-accent, #fff);
}
#${ROOT_ID}[data-show="false"] { display: none; }
#${ROOT_ID} svg.oret-layer { position: absolute; left: 0; top: 0; display: block; width: 100%; height: 100%; overflow: visible; pointer-events: none; }
#${ROOT_ID} svg * { pointer-events: none; }
#${ROOT_ID} .oret-line { fill: none; stroke: currentColor; stroke-width: 1; vector-effect: non-scaling-stroke; stroke-linecap: butt; }
#${ROOT_ID} .oret-thin { stroke-width: 0.6; }
#${ROOT_ID} .oret-bold { stroke-width: 2.2; }
#${ROOT_ID} .oret-dash { stroke-dasharray: 2 3.2; }
#${ROOT_ID} svg.oret-spin { transform-origin: 50% 50%; will-change: transform; }   /* each turning ring is its own <svg> = its own compositor layer */
#${ROOT_ID}[data-motion="on"] .oret-cw1  { animation: oret-cw  240s linear infinite; }
#${ROOT_ID}[data-motion="on"] .oret-ccw1 { animation: oret-ccw 160s linear infinite; }
#${ROOT_ID}[data-motion="on"] .oret-cw2  { animation: oret-cw   90s linear infinite; }
#${ROOT_ID}[data-motion="on"] .oret-ccw2 { animation: oret-ccw  60s linear infinite; }
@keyframes oret-cw  { to { transform: rotate(360deg); } }
@keyframes oret-ccw { to { transform: rotate(-360deg); } }
@media (prefers-reduced-motion: reduce) { #${ROOT_ID} svg.oret-spin { animation: none !important; will-change: auto; } }
`

function injectStyles () {
  if (document.getElementById(STYLE_ID)) return
  const tag = document.createElement('style')
  tag.id = STYLE_ID
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

const f = (n) => Number(n.toFixed(2))
const pol = (r, deg) => { const a = (deg - 90) * Math.PI / 180; return [r * Math.cos(a), r * Math.sin(a)] }

/** Pure: a path of radial tick marks between two radii every `step` degrees; every `major`-th tick runs out to `rMajor`. */
export function tickPath (rIn, rOut, step, major = 0, rMajor = rOut) {
  let d = ''
  for (let i = 0, deg = 0; deg < 360 - 1e-6; i++, deg += step) {
    const [x1, y1] = pol(rIn, deg), [x2, y2] = pol(major && i % major === 0 ? rMajor : rOut, deg)
    d += `M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}`
  }
  return d
}
/** Pure: an arc path of radius r from degree a0 to a1 (clockwise from 12 o'clock). */
export function arcPath (r, a0, a1) {
  const [x0, y0] = pol(r, a0), [x1, y1] = pol(r, a1)
  const large = ((a1 - a0 + 360) % 360) > 180 ? 1 : 0
  return `M${f(x0)} ${f(y0)}A${r} ${r} 0 ${large} 1 ${f(x1)} ${f(y1)}`
}

function el (tag, attrs = {}, parent) {
  const n = document.createElementNS(SVG_NS, tag)
  for (const k of Object.keys(attrs)) n.setAttribute(k, String(attrs[k]))
  parent?.appendChild(n)
  return n
}

/** The drawing, in a -110..110 box, as stacked <svg> layers (outside in): ticked ring (cw), dashed ring (ccw), bold arcs (cw), mid ring + ticks (ccw), static brackets + cross ticks. */
export function buildReticleLayers () {
  const layer = (cls) => el('svg', { class: `oret-layer ${cls}`.trim(), viewBox: '-110 -110 220 220', 'aria-hidden': 'true', focusable: 'false' })
  const l1 = layer('oret-spin oret-cw1')                                     // outer ticked ring
  el('circle', { class: 'oret-line', r: 100 }, l1)
  el('path', { class: 'oret-line oret-thin', d: tickPath(100, 104, 5, 6, 108) }, l1)
  const l2 = layer('oret-spin oret-ccw1')                                    // dashed ring
  el('circle', { class: 'oret-line oret-thin oret-dash', r: 90 }, l2)
  el('circle', { class: 'oret-line oret-thin', r: 86 }, l2)
  const l3 = layer('oret-spin oret-cw2')                                     // bold arcs
  for (const a of [10, 130, 250]) el('path', { class: 'oret-line oret-bold', d: arcPath(76, a, a + 56) }, l3)
  el('path', { class: 'oret-line', d: arcPath(70, 70, 100) + arcPath(70, 190, 220) + arcPath(70, 310, 340) }, l3)
  const l4 = layer('oret-spin oret-ccw2')                                    // inner ring with fine ticks
  el('circle', { class: 'oret-line', r: 56 }, l4)
  el('path', { class: 'oret-line oret-thin', d: tickPath(46, 56, 10, 3, 56) }, l4)
  el('circle', { class: 'oret-line oret-thin oret-dash', r: 38 }, l4)
  const st = layer('oret-static')                                           // static: centre cross with a gap, diagonal "+" marks, corner brackets, edge ticks
  el('path', { class: 'oret-line', d: 'M-26 0H-8M8 0H26M0 -26V-8M0 8V26' }, st)
  el('circle', { class: 'oret-line oret-thin', r: 3 }, st)
  let plus = ''
  for (const deg of [45, 135, 225, 315]) { const [x, y] = pol(64, deg); plus += `M${f(x - 3)} ${f(y)}H${f(x + 3)}M${f(x)} ${f(y - 3)}V${f(y + 3)}` }
  el('path', { class: 'oret-line oret-thin', d: plus }, st)
  el('path', { class: 'oret-line oret-thin', d: 'M-110 -96V-110H-96M96 -110H110V-96M110 96V110H96M-96 110H-110V96' }, st)
  el('path', { class: 'oret-line', d: 'M-118 0H-112M112 0H118M0 -118V-112M0 112V118' }, st)
  return [l1, l2, l3, l4, st]
}

export default class OmniReticle {
  constructor (context) {
    this.ctx = context
    this._el = null
    this._overrides = {}
    this._settings = resolveSettings({})
    this._onSet = null; this._mq = null; this._onMq = null
  }

  init () {
    if (this._el) return                                    // never twice
    injectStyles()
    this._overrides = loadOverrides()
    this._settings = resolveSettings(this._overrides)
    const el = document.createElement('div')
    el.id = ROOT_ID
    el.setAttribute('aria-hidden', 'true')
    for (const layer of buildReticleLayers()) el.appendChild(layer)
    const shell = document.getElementById('omni-ui') ?? document.body
    shell.insertBefore(el, shell.firstChild)                // first child: below every other UI element
    this._el = el
    this._onSet = (e) => this._handleSet(e?.detail)
    window.addEventListener(SET_EVENT, this._onSet)
    try {
      this._mq = window.matchMedia?.('(prefers-reduced-motion: reduce)') ?? null
      this._onMq = () => this._apply()
      this._mq?.addEventListener?.('change', this._onMq)
    } catch (_) { this._mq = null }
    this._apply()
    this._announce()
  }

  update () {}            // nothing per frame: the rotation is CSS
  onResize () {}          // sized with vmin

  destroy () {
    window.removeEventListener(SET_EVENT, this._onSet)
    try { this._mq?.removeEventListener?.('change', this._onMq) } catch (_) {}
    this._el?.remove()
    document.getElementById(STYLE_ID)?.remove()
    this._el = null; this._onSet = this._onMq = this._mq = null
  }

  getSettings () { return { ...this._settings } }
  /** Programmatic form of the omni:reticle-set event. */
  setSettings (patch) { return this._handleSet({ patch }) }
  reset () { return this._handleSet({ reset: true }) }
  isMoving () { return this._el?.dataset.motion === 'on' }

  _handleSet (detail) {
    if (!this._el) return false
    let changed = false
    if (detail?.reset === true) {
      changed = Object.keys(this._overrides).length > 0
      this._overrides = {}
    } else {
      const clean = sanitizePatch(detail?.patch)
      for (const k of Object.keys(clean)) if (this._overrides[k] !== clean[k]) { this._overrides[k] = clean[k]; changed = true }
    }
    if (!changed) return false
    saveOverrides(this._overrides)
    this._settings = resolveSettings(this._overrides)
    this._apply()
    this._announce()
    return true
  }

  _apply () {
    const s = this._settings
    this._el.dataset.show = String(!!s.show)
    this._el.dataset.motion = prefersReducedMotion() ? 'off' : 'on'
    this._el.style.setProperty('--oret-opacity', String(s.opacity / 100))
  }

  _announce () {
    window.dispatchEvent(new CustomEvent(CHANGED_EVENT, { detail: { settings: this.getSettings() } }))
  }
}

export { STORE_KEY, SET_EVENT, CHANGED_EVENT, DEFAULTS }
