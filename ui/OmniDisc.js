/**
 * ui/OmniDisc.js — ⟐mniReality OmniDisc
 *
 * A new UI primitive, not built on any existing pattern in this
 * project — a small spinning disc that attaches to the PERIMETER of
 * any panel and can be dragged along that border, rather than being
 * freely draggable anywhere on screen. Think of it as a bead sliding
 * along the edge of a frame, not a sticker you can place wherever.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * The perimeter math — closest-edge-point, not clamp-to-box
 * ─────────────────────────────────────────────────────────────────────────────
 * Dragging computes the nearest point on the RECTANGLE'S BORDER (not
 * inside it) to the pointer, expressed as a single parameter `t` from
 * 0 to 1 going clockwise from the top-left corner — top edge, right
 * edge, bottom edge, left edge, back to start. This makes the disc's
 * position resize-safe (recompute the actual x/y from t any time the
 * host panel's size changes) and makes "attach to any panel" a real,
 * generic capability rather than something tied to one panel's fixed
 * dimensions.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Usage
 * ─────────────────────────────────────────────────────────────────────────────
 * const disc = new OmniDisc(panelEl, { imageUrl: coverArtUrl, size: 48 })
 * disc.attach()               // creates the element, positions it, wires dragging
 * disc.setSpinning(true)      // starts/stops the spin animation
 * disc.setImage(newUrl)       // swap the artwork
 * disc.destroy()              // removes it, cleans up listeners
 *
 * No default export dependency on any specific panel — genuinely
 * reusable, per the brief ("we have never had an item like this
 * before... let's create it so it can attach to any panel").
 */

const DEFAULT_SIZE = 48

function injectStyles () {
  if (document.getElementById('omni-disc-styles')) return
  const tag = document.createElement('style')
  tag.id = 'omni-disc-styles'
  tag.textContent = /* css */`
    .omni-disc {
      position: absolute;
      border-radius: 50%;
      cursor: grab;
      z-index: 65;
      box-shadow: 0 2px 10px rgba(0,0,0,0.5), 0 0 0 2px rgba(255,255,255,0.15);
      background-size: cover;
      background-position: center;
      background-color: #1a1a1a;
      transform: translate(-50%, -50%);
    }
    .omni-disc.is-dragging { cursor: grabbing; }
    .omni-disc.is-spinning { animation: omni-disc-spin 3s linear infinite; }
    .omni-disc::after {
      content: '';
      position: absolute;
      inset: 38%;
      border-radius: 50%;
      background: rgba(10,10,10,0.85);
      box-shadow: inset 0 0 0 1.5px rgba(255,255,255,0.15);
    }
    @keyframes omni-disc-spin {
      from { transform: translate(-50%, -50%) rotate(0deg); }
      to   { transform: translate(-50%, -50%) rotate(360deg); }
    }
  `
  document.head.appendChild(tag)
}

/** Default artwork — a plain vinyl-style disc drawn on canvas, used
 *  until a real image is supplied (e.g., real album art). Matches the
 *  project's existing convention of canvas-drawn default graphics
 *  (see modules/ParticleField.js's own orb texture). */
function makeDefaultArtwork (size) {
  const canvas = document.createElement('canvas')
  canvas.width = size * 2
  canvas.height = size * 2
  const ctx = canvas.getContext('2d')
  const r = size
  const gradient = ctx.createRadialGradient(r, r, r * 0.35, r, r, r)
  gradient.addColorStop(0, '#2a2a2a')
  gradient.addColorStop(0.7, '#161616')
  gradient.addColorStop(1, '#0a0a0a')
  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.arc(r, r, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.05)'
  for (let i = 1; i <= 4; i++) {
    ctx.beginPath()
    ctx.arc(r, r, (r * 0.4) + i * (r * 0.13), 0, Math.PI * 2)
    ctx.stroke()
  }
  return canvas.toDataURL()
}

export default class OmniDisc {
  /**
   * @param {HTMLElement} hostPanelEl — the panel this disc attaches to
   * @param {object} [options]
   * @param {string} [options.imageUrl] — artwork; falls back to a drawn default
   * @param {number} [options.size=48] — diameter in pixels
   * @param {number} [options.initialT=0] — starting position on the perimeter, 0 to 1
   * @param {boolean} [options.spinning=false]
   */
  constructor (hostPanelEl, options = {}) {
    this.hostPanelEl = hostPanelEl
    this.size = options.size ?? DEFAULT_SIZE
    this.imageUrl = options.imageUrl ?? makeDefaultArtwork(this.size)
    this.t = options.initialT ?? 0
    this.spinning = options.spinning ?? false
    this._el = null
    this._drag = { active: false }
    this._onResize = null
  }

  attach () {
    injectStyles()
    this._el = document.createElement('div')
    this._el.className = 'omni-disc'
    this._el.style.width = `${this.size}px`
    this._el.style.height = `${this.size}px`
    this._el.style.backgroundImage = `url(${this.imageUrl})`
    if (this.spinning) this._el.classList.add('is-spinning')

    this.hostPanelEl.appendChild(this._el)
    this._reposition()
    this._bindDrag()

    this._onResize = () => this._reposition()
    window.addEventListener('resize', this._onResize)

    return this
  }

  setSpinning (spinning) {
    this.spinning = spinning
    this._el?.classList.toggle('is-spinning', spinning)
  }

  setImage (url) {
    this.imageUrl = url
    if (this._el) this._el.style.backgroundImage = `url(${url})`
  }

  destroy () {
    window.removeEventListener('resize', this._onResize)
    this._el?.parentNode?.removeChild(this._el)
    this._el = null
  }

  // ── Perimeter math ───────────────────────────────────────────────────────

  /** Given a point in the host panel's local coordinates, returns the
   *  closest point ON THE BORDER (not inside it) as {x, y, t} —
   *  x/y for immediate positioning, t (0-1, clockwise from top-left)
   *  for resize-safe storage. */
  _closestPerimeterPoint (localX, localY, width, height) {
    const cx = Math.min(Math.max(localX, 0), width)
    const cy = Math.min(Math.max(localY, 0), height)

    const distTop = cy
    const distBottom = height - cy
    const distLeft = cx
    const distRight = width - cx
    const min = Math.min(distTop, distBottom, distLeft, distRight)

    const perimeter = 2 * (width + height)
    let x, y, t

    if (min === distTop) {
      x = cx; y = 0
      t = x / perimeter
    } else if (min === distRight) {
      x = width; y = cy
      t = (width + y) / perimeter
    } else if (min === distBottom) {
      x = cx; y = height
      t = (width + height + (width - x)) / perimeter
    } else {
      x = 0; y = cy
      t = (2 * width + height + (height - y)) / perimeter
    }
    return { x, y, t }
  }

  /** Inverse of the above — given t (0-1), returns the x/y point on
   *  the current perimeter. Used to reposition correctly after a
   *  resize, when width/height have changed but t (the meaningful,
   *  persisted position) hasn't. */
  _perimeterPointFromT (t, width, height) {
    const perimeter = 2 * (width + height)
    let d = ((t % 1) + 1) % 1 * perimeter

    if (d <= width) return { x: d, y: 0 }
    d -= width
    if (d <= height) return { x: width, y: d }
    d -= height
    if (d <= width) return { x: width - d, y: height }
    d -= width
    return { x: 0, y: height - d }
  }

  _reposition () {
    if (!this._el) return
    const rect = this.hostPanelEl.getBoundingClientRect()
    const { x, y } = this._perimeterPointFromT(this.t, rect.width, rect.height)
    this._el.style.left = `${x}px`
    this._el.style.top = `${y}px`
  }

  _bindDrag () {
    const onDown = (e) => {
      e.preventDefault()
      this._drag.active = true
      this._el.classList.add('is-dragging')
    }
    const onMove = (e) => {
      if (!this._drag.active) return
      const rect = this.hostPanelEl.getBoundingClientRect()
      const clientX = e.touches?.[0]?.clientX ?? e.clientX
      const clientY = e.touches?.[0]?.clientY ?? e.clientY
      const localX = clientX - rect.left
      const localY = clientY - rect.top
      const { x, y, t } = this._closestPerimeterPoint(localX, localY, rect.width, rect.height)
      this.t = t
      this._el.style.left = `${x}px`
      this._el.style.top = `${y}px`
    }
    const onUp = () => {
      this._drag.active = false
      this._el.classList.remove('is-dragging')
    }

    this._el.addEventListener('mousedown', onDown)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    this._el.addEventListener('touchstart', onDown, { passive: false })
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', onUp)
  }
}
