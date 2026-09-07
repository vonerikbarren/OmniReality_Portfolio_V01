/**
 * ui/OrbiterVisual.js — ⟐mniReality Orbiter Visual
 *
 * A purely aesthetic placeholder for the ⦿ Orbiter symbol that
 * already exists on all four Hand.js corners (previously a stub —
 * "behaviour undefined... last to be specified"). No cycling/repeat
 * logic yet — that's real, separate design work for later. This is
 * just: give Orbiter something to visibly show when pressed, on all
 * four hands, before any of the functional design is settled.
 *
 * Deliberately built with plain SVG + CSS, not a WebGL scene. A full
 * Three.js context (its own renderer, camera, render loop) would be
 * real, measurable overkill for a static wireframe sphere and one
 * orbiting dot — the "keep everything in the DOM where it can be"
 * principle, since performance was the explicit priority here.
 *
 * Listens for the same `omni:orbiter { hand }` event Hand.js already
 * dispatches — one popup per hand, shown at that hand's own corner,
 * so multiple can be open at once if more than one hand's Orbiter is
 * toggled.
 *
 * Follows the standard module contract (constructor / init / update / destroy).
 */

const HAND_CORNERS = {
  omnihand:  'tl',
  conscious: 'tr',
  lh:        'bl',
  rh:        'br',
}

const STYLES = /* css */`
  .orbiter-visual {
    position: fixed;
    width: 110px;
    height: 110px;
    z-index: 55;
    pointer-events: none;
    opacity: 0;
    transform: scale(0.85);
    transition: opacity 0.2s ease, transform 0.2s ease;
  }
  .orbiter-visual.is-visible {
    opacity: 1;
    transform: scale(1);
  }
  .orbiter-visual--tl { top: 100px;    left: 24px; }
  .orbiter-visual--tr { top: 100px;    right: 24px; }
  .orbiter-visual--bl { bottom: 100px; left: 24px; }
  .orbiter-visual--br { bottom: 100px; right: 24px; }

  .orbiter-visual svg { width: 100%; height: 100%; }
  .orbiter-sphere-line {
    fill: none;
    stroke: rgba(255, 255, 255, 0.55);
    stroke-width: 1;
  }

  .orbiter-track {
    position: absolute;
    inset: 8%;
    border-radius: 50%;
    animation: orbiter-spin 4s linear infinite;
  }
  .orbiter-dot {
    position: absolute;
    top: -3px;
    left: 50%;
    width: 6px;
    height: 6px;
    margin-left: -3px;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 0 6px 1px rgba(255,255,255,0.7);
  }
  @keyframes orbiter-spin {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }
`

function injectStyles () {
  if (document.getElementById('orbiter-visual-styles')) return
  const tag = document.createElement('style')
  tag.id = 'orbiter-visual-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

function sphereSvg () {
  return /* html */`
    <svg viewBox="0 0 100 100">
      <circle class="orbiter-sphere-line" cx="50" cy="50" r="36" />
      <ellipse class="orbiter-sphere-line" cx="50" cy="50" rx="36" ry="13" />
      <ellipse class="orbiter-sphere-line" cx="50" cy="50" rx="13" ry="36" />
    </svg>
  `
}

export default class OrbiterVisual {
  constructor (context) {
    this.ctx = context
    this._els = {}
    this._visible = {}
    this._onOrbiter = null
  }

  init () {
    injectStyles()
    Object.keys(HAND_CORNERS).forEach(hand => { this._visible[hand] = false })

    this._onOrbiter = (e) => {
      const hand = e.detail?.hand
      if (!hand || !HAND_CORNERS[hand]) return
      this._toggle(hand)
    }
    window.addEventListener('omni:orbiter', this._onOrbiter)
  }

  update () {}
  onResize () {}

  destroy () {
    window.removeEventListener('omni:orbiter', this._onOrbiter)
    Object.values(this._els).forEach(el => el.parentNode?.removeChild(el))
    this._els = {}
  }

  _toggle (hand) {
    this._visible[hand] = !this._visible[hand]
    if (this._visible[hand]) this._show(hand)
    else this._hide(hand)
  }

  _show (hand) {
    if (!this._els[hand]) this._els[hand] = this._buildEl(hand)
    const el = this._els[hand]
    const shell = document.getElementById('omni-ui') ?? document.body
    if (!el.parentNode) shell.appendChild(el)
    void el.offsetWidth
    el.classList.add('is-visible')
  }

  _hide (hand) {
    const el = this._els[hand]
    if (el) el.classList.remove('is-visible')
  }

  _buildEl (hand) {
    const corner = HAND_CORNERS[hand]
    const el = document.createElement('div')
    el.className = `orbiter-visual orbiter-visual--${corner}`
    el.innerHTML = /* html */`
      ${sphereSvg()}
      <div class="orbiter-track"><div class="orbiter-dot"></div></div>
    `
    return el
  }
}
