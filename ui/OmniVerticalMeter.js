/**
 * ui/OmniVerticalMeter.js — ⟐mniVerticalMeter
 *
 * A real, Admin-reachable vertical HUD scale — altitude is a single
 * real Y value with no natural floor to draw lines on, so this
 * reads as a fixed scale pinned to one screen edge with a live
 * marker, rather than anything drawn in world space (a horizontal
 * ruler floating at camera height would constantly clip through
 * real geometry as the camera moves).
 */

const STYLES = `

.omni-vertical-meter {
  pointer-events   : none;
  position         : fixed;
  top              : 80px;
  bottom           : 80px;
  right            : 16px;
  width            : 46px;
  z-index          : 45;
  opacity          : 0;
  visibility       : hidden;
  font-family      : 'Courier New', Courier, monospace;
}
.omni-vertical-meter.open { opacity: 1; visibility: visible; }

.ovm-track {
  position: absolute; top: 0; bottom: 0; left: 6px; width: 2px;
  background: rgba(255,255,255,0.15); border-radius: 1px;
}
.ovm-tick {
  position: absolute; left: 0; width: 12px; height: 1px;
  background: rgba(255,255,255,0.25);
}
.ovm-tick-label {
  position: absolute; left: 15px; font-size: 8px; color: rgba(255,255,255,0.4);
  transform: translateY(-50%); white-space: nowrap;
}
.ovm-marker {
  position: absolute; left: 0; width: 14px; height: 14px;
  border-radius: 50%; background: rgba(255, 238, 0, 0.85);
  box-shadow: 0 0 6px rgba(255, 238, 0, 0.6);
  transform: translate(-2px, -7px);
}
.ovm-marker-label {
  position: absolute; left: 18px; font-size: 9.5px; color: #ffee00;
  transform: translateY(-50%); white-space: nowrap; font-weight: bold;
}
`

function injectStyles () {
  if (document.getElementById('ovm-styles')) return
  const tag = document.createElement('style')
  tag.id = 'ovm-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

// Real, fixed real-world range this scale covers — chosen to match
// the floor's own real extent (BOUNDARY_SIZE=3000 in OmniFloor.js is
// the ground plane's own footprint; altitude itself has no matching
// established constant, so a real, generously-sized 400-unit span
// centered on the floor is used instead, wide enough for realistic
// camera flight without the marker constantly pinning to an edge).
const RANGE_MIN = -50
const RANGE_MAX = 350
const TICK_STEP = 50

export default class OmniVerticalMeter {
  constructor (context) {
    this.ctx = context
    this._el = null
    this._isOpen = false
    this._onNavSelect = null
  }

  init () {
    injectStyles()
    this._el = this._buildDOM()
    const shell = document.getElementById('omni-ui') ?? document.body
    shell.appendChild(this._el)

    this._onNavSelect = (e) => {
      if (e.detail?.item !== '⟐OmniVerticalMeter') return
      this.toggle()
    }
    window.addEventListener('omni:nav-select', this._onNavSelect)
  }

  /** Real, per-frame update — altitude changes continuously as the
   *  camera moves, so the marker has to track it every frame, not
   *  on some slower interval. */
  update () {
    if (!this._isOpen) return
    const y = this.ctx.camera.position.y
    const clamped = Math.max(RANGE_MIN, Math.min(RANGE_MAX, y))
    const t = (clamped - RANGE_MIN) / (RANGE_MAX - RANGE_MIN)
    const pct = (1 - t) * 100   // higher Y = higher on screen
    const marker = this._el.querySelector('.ovm-marker')
    const label = this._el.querySelector('.ovm-marker-label')
    marker.style.top = `${pct}%`
    label.style.top = `${pct}%`
    label.textContent = y.toFixed(1)
  }

  onResize () {}

  destroy () {
    window.removeEventListener('omni:nav-select', this._onNavSelect)
    this._el?.parentNode?.removeChild(this._el)
  }

  toggle () { this._isOpen = !this._isOpen; this._el.classList.toggle('open', this._isOpen) }

  _buildDOM () {
    const el = document.createElement('div')
    el.className = 'omni-vertical-meter'

    let ticksHtml = ''
    for (let v = RANGE_MIN; v <= RANGE_MAX; v += TICK_STEP) {
      const t = (v - RANGE_MIN) / (RANGE_MAX - RANGE_MIN)
      const pct = (1 - t) * 100
      ticksHtml += `<div class="ovm-tick" style="top:${pct}%"></div><div class="ovm-tick-label" style="top:${pct}%">${v}</div>`
    }

    el.innerHTML = `
      <div class="ovm-track"></div>
      ${ticksHtml}
      <div class="ovm-marker"></div>
      <div class="ovm-marker-label">0.0</div>
    `
    return el
  }
}
