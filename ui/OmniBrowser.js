/**
 * ui/OmniBrowser.js — ⟐mniReality OmniBrowser
 *
 * A single iframe in a normal screen-space panel — deliberately the
 * user's first, most familiar interaction with the reality, a bridge
 * into the rest of it rather than a separate simplified tool.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * The iframe security reality — why there's no "unlock other sites" option
 * ─────────────────────────────────────────────────────────────────────────────
 * Whether a site can be embedded is the TARGET site's decision, sent via
 * its own HTTP headers (X-Frame-Options / CSP frame-ancestors), enforced
 * by the browser to prevent clickjacking. No iframe attribute on this
 * side can override a site's refusal — sandbox/allow attributes only
 * ever restrict what embedded content can DO once it's loaded, never
 * force a refusing site to load at all. When a site blocks framing, the
 * frame just stays blank — this shows an honest fallback (open in a new
 * tab) rather than pretending it worked.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Navigation is NOT iframe.contentWindow.history — this matters
 * ─────────────────────────────────────────────────────────────────────────────
 * For a cross-origin iframe, the browser blocks script access to its
 * internal history/location entirely (same security boundary as the
 * framing restriction above). Back/Forward here work by replaying an
 * externally-tracked URL list against the iframe's `src` attribute —
 * the only approach that works regardless of the embedded site's
 * origin. See ui/OmniBrowserProperties.js, which owns that history list.
 *
 * Controlled entirely by ui/OmniBrowserProperties.js (its "Inspector")
 * via `omni:browser-set` patches — this panel owns the iframe and the
 * reveal effect, nothing about URL/navigation/sandbox state.
 *
 * Follows the standard module contract (constructor / init / update / destroy).
 */

import gsap from 'gsap'
import * as WindowManager from './WindowManager.js'

const REVEAL_PARTICLE_COUNT = 220
const REVEAL_DURATION = 0.7

const STYLES = /* css */`

.omni-browser {
  --ob-bg          : var(--omni-theme-bg, rgba(8, 8, 12, 0.92));
  --ob-border      : var(--omni-theme-border, rgba(255, 255, 255, 0.09));
  --ob-header-bg   : var(--omni-theme-header-bg, rgba(255, 255, 255, 0.03));
  --ob-text        : var(--omni-theme-text, rgba(255, 255, 255, 1));
  --ob-text-dim    : var(--omni-theme-text-dim, rgba(255, 255, 255, 0.85));
  --ob-text-muted  : var(--omni-theme-text-muted, rgba(255, 255, 255, 0.6));
  --ob-accent      : var(--omni-theme-accent, #8cc4ff);
  --mono           : 'Courier New', Courier, monospace;

  position         : fixed;
  top              : 90px;
  left             : 120px;
  width            : 780px;
  min-width        : 360px;
  max-width        : 94vw;
  height           : 560px;
  min-height       : 300px;
  max-height       : 94vh;

  display          : flex;
  flex-direction   : column;

  background       : var(--ob-bg);
  backdrop-filter  : blur(22px) saturate(1.5);
  -webkit-backdrop-filter: blur(22px) saturate(1.5);
  border           : 1px solid var(--ob-border);
  border-radius    : 14px;
  box-shadow       : 0 0 24px rgba(0,0,0,0.4), 0 12px 40px rgba(0,0,0,0.55);

  font-family      : var(--mono);
  color            : var(--ob-text);
  z-index          : 60;
  overflow         : hidden;
  pointer-events   : auto;
  resize           : both;

  opacity          : 0;
}

.ob-header {
  position         : relative;
  height           : 40px;
  flex-shrink      : 0;
  display          : flex;
  align-items      : center;
  justify-content  : center;
  background       : var(--ob-header-bg);
  border-bottom    : 1px solid var(--ob-border);
  cursor           : grab;
  user-select      : none;
}
.ob-header.is-dragging { cursor: grabbing; }
.ob-title { position: absolute; left: 12px; font-size: 11px; letter-spacing: 0.06em; color: var(--ob-text-dim); }
.ob-url-display { font-size: 10px; color: var(--ob-text-muted); max-width: 50%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ob-controls { position: absolute; right: 8px; display: flex; align-items: center; gap: 6px; }
.ob-ctrl {
  width: 20px; height: 20px; border-radius: 5px;
  border: 1px solid var(--ob-border);
  background: rgba(255,255,255,0.04);
  color: var(--ob-text-dim);
  font-size: 10px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
}
.ob-ctrl:hover { background: rgba(255,255,255,0.10); color: var(--ob-text); }

.ob-body { flex: 1 1 auto; position: relative; background: #000; }
.ob-iframe { width: 100%; height: 100%; border: none; display: block; }

.ob-reveal-canvas { position: absolute; inset: 0; pointer-events: none; z-index: 5; }

.ob-fallback {
  position: absolute; inset: 0; display: none;
  flex-direction: column; align-items: center; justify-content: center; gap: 10px;
  background: rgba(8,8,12,0.95); color: var(--ob-text-dim); text-align: center; padding: 20px;
}
.ob-fallback.is-visible { display: flex; }
.ob-fallback-title { font-size: 12px; color: var(--ob-accent); }
.ob-fallback-note { font-size: 10px; color: var(--ob-text-muted); max-width: 320px; line-height: 1.6; }
.ob-fallback-btn {
  margin-top: 4px; padding: 8px 16px;
  background: rgba(140, 196, 255, 0.12); border: 1px solid rgba(140, 196, 255, 0.35);
  color: var(--ob-accent); border-radius: 6px; font-family: var(--mono); font-size: 10px; cursor: pointer;
}
.ob-fallback-btn:hover { background: rgba(140, 196, 255, 0.2); }

.ob-resize-handle { position: absolute; right: 0; bottom: 0; width: 16px; height: 16px; cursor: nwse-resize; z-index: 6; }
.ob-resize-handle::before {
  content: ''; position: absolute; right: 3px; bottom: 3px; width: 8px; height: 8px;
  border-right: 2px solid rgba(255,255,255,0.35); border-bottom: 2px solid rgba(255,255,255,0.35);
}

`

function injectStyles () {
  if (document.getElementById('omni-browser-styles')) return
  const tag = document.createElement('style')
  tag.id = 'omni-browser-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

export default class OmniBrowser {
  /**
   * @param {object} context
   * @param {object} [config]
   * @param {number} [config.windowId=1] — which of up to 3 simultaneous
   *   browser windows this instance is. Included in this panel's own
   *   WindowManager id/title so multiple instances don't collide, and
   *   used to filter `omni:browser-set` patches to the matching window
   *   only (a patch with no windowId, or windowId 1, applies to window 1).
   */
  constructor (context, config = {}) {
    this.ctx = context
    this.windowId = config.windowId ?? 1
    this._el = null
    this._isOpen = false
    this._drag = { active: false, startX: 0, startY: 0, originX: 0, originY: 0 }
    this._currentUrl = ''
    this._sandbox = 'allow-scripts allow-same-origin allow-forms allow-popups'
    this._loadWatchdog = null
    this._onNavSelect = null
    this._onBrowserSet = null
  }

  init () {
    injectStyles()
    // Window 1 opens directly from the drawer's own OmniBrowser item
    // for backward compatibility with anyone already relying on that;
    // windows 2/3 only ever open via ui/OmniBrowserProperties.js's own
    // "+ New Window" control, not the drawer.
    this._onNavSelect = (e) => {
      if (this.windowId !== 1) return
      if (e.detail?.item !== '⟐OmniBrowserWindow') return
      this.open()
    }
    window.addEventListener('omni:nav-select', this._onNavSelect)

    // From ui/OmniBrowserProperties.js — this panel owns the iframe
    // and reveal effect, nothing about URL/nav/sandbox state itself.
    // Ignores patches meant for a different window.
    this._onBrowserSet = (e) => {
      const patch = e.detail ?? {}
      if ((patch.windowId ?? 1) !== this.windowId) return
      if (patch.url !== undefined) this._navigate(patch.url)
      if (patch.sandbox !== undefined) this._setSandbox(patch.sandbox)
    }
    window.addEventListener('omni:browser-set', this._onBrowserSet)

    this._onOpenWindow = (e) => {
      if (e.detail?.windowId === this.windowId) this.open()
    }
    window.addEventListener('omni:browser-open-window', this._onOpenWindow)
  }

  update () {}
  onResize () {}

  destroy () {
    window.removeEventListener('omni:nav-select', this._onNavSelect)
    window.removeEventListener('omni:browser-set', this._onBrowserSet)
    window.removeEventListener('omni:browser-open-window', this._onOpenWindow)
    clearTimeout(this._loadWatchdog)
    this._el?.parentNode?.removeChild(this._el)
    WindowManager.unregister(`omnibrowser-${this.windowId}`)
  }

  open () {
    const firstOpen = !this._el
    if (firstOpen) this._el = this._buildDOM()
    const shell = document.getElementById('omni-ui') ?? document.body
    shell.appendChild(this._el)
    this._el.style.visibility = 'visible'
    this._isOpen = true
    this._playSound('open')

    if (firstOpen) this._playMaterialize()
    else gsap.to(this._el, { opacity: WindowManager.getPanelOpacity(), duration: 0.28, ease: 'power2.out' })
  }

  /** Boot-time entrance only — slides in from the left edge rather
   *  than the regular fade, since this is meant to be the very first
   *  thing a landing user sees, not just another panel being opened. */
  openFromSide () {
    if (!this._el) this._el = this._buildDOM()
    const shell = document.getElementById('omni-ui') ?? document.body
    shell.appendChild(this._el)
    this._el.style.visibility = 'visible'
    this._isOpen = true
    this._playSound('open')

    const targetLeft = parseFloat(this._el.style.left) || 120
    gsap.fromTo(this._el,
      { opacity: 0, left: targetLeft - 260 },
      { opacity: WindowManager.getPanelOpacity(), left: targetLeft, duration: 0.65, ease: 'power3.out' }
    )
  }

  close () {
    if (!this._el) return
    gsap.to(this._el, {
      opacity: 0, duration: 0.18, ease: 'power1.in',
      onComplete: () => { this._el.style.visibility = 'hidden' },
    })
    this._isOpen = false
    this._playSound('close')
  }

  minimize () {
    if (!this._el) return
    const rect = this._el.getBoundingClientRect()
    gsap.to(this._el, {
      opacity: 0, duration: 0.22, ease: 'power2.in',
      onComplete: () => { this._el.style.visibility = 'hidden' },
    })
    this._isOpen = false
    this._playSound('close')
    window.dispatchEvent(new CustomEvent('omni:panel-minimized', {
      detail: {
        id: `omnibrowser-${this.windowId}`, label: `⟐OmniBrowser ${this.windowId}`, iconLabel: '⟐B',
        fromRect: { x: rect.left, y: rect.top, w: rect.width, h: rect.height },
        variant: 'app',
      }
    }))
  }

  _playSound (id) {
    try {
      const Sound = this.ctx?.Sound
      if (Sound && typeof Sound.play === 'function') Sound.play(id)
    } catch (_) {}
  }

  // ── DOM ──────────────────────────────────────────────────────────────────

  _buildDOM () {
    const el = document.createElement('div')
    el.className = 'omni-browser'
    el.innerHTML = /* html */`
      <div class="ob-header">
        <span class="ob-title">⟐OmniBrowser</span>
        <span class="ob-url-display" id="ob-url-display"></span>
        <div class="ob-controls">
          <button class="ob-ctrl" data-action="minimize" title="Minimize">–</button>
          <button class="ob-ctrl" data-action="close" title="Close">×</button>
        </div>
      </div>
      <div class="ob-body">
        <iframe class="ob-iframe" id="ob-iframe" sandbox="${this._sandbox}"></iframe>
        <canvas class="ob-reveal-canvas" id="ob-reveal-canvas"></canvas>
        <div class="ob-fallback" id="ob-fallback">
          <div class="ob-fallback-title">This site can't be embedded here</div>
          <div class="ob-fallback-note">
            The site itself blocks embedding (its own security header,
            not something this panel can override) — same restriction
            every browser enforces, on every site that sets it.
          </div>
          <button class="ob-fallback-btn" id="ob-fallback-open">Open in a new tab ↗</button>
        </div>
      </div>
      <div class="ob-resize-handle" aria-hidden="true"></div>
    `

    this._bindHeader(el)
    this._bindResize(el)

    el.querySelector('[data-action="minimize"]').addEventListener('click', () => this.minimize())
    el.querySelector('[data-action="close"]').addEventListener('click', () => this.close())
    el.querySelector('#ob-fallback-open').addEventListener('click', () => {
      if (this._currentUrl) window.open(this._currentUrl, '_blank', 'noopener,noreferrer')
    })

    el.dataset.winId = `omnibrowser-${this.windowId}`
    if (this.windowId > 1) {
      // Stagger windows 2/3 so they don't land exactly on top of window 1.
      el.style.left = `${120 + (this.windowId - 1) * 50}px`
      el.style.top = `${90 + (this.windowId - 1) * 50}px`
    }
    WindowManager.register(`omnibrowser-${this.windowId}`, el, `⟐OmniBrowser ${this.windowId}`)
    WindowManager.watchPanelOpacity(el, () => this._isOpen)

    return el
  }

  _navigate (url) {
    if (!url) return
    this._currentUrl = url
    const iframe = this._el?.querySelector('#ob-iframe')
    const urlDisplay = this._el?.querySelector('#ob-url-display')
    const fallback = this._el?.querySelector('#ob-fallback')
    if (urlDisplay) urlDisplay.textContent = url
    if (fallback) fallback.classList.remove('is-visible')
    if (!iframe) return

    iframe.style.display = ''
    iframe.src = url

    // A blocked frame doesn't error — the browser just quietly leaves
    // it blank, no load event, no exception. There's no reliable
    // "did this actually render" signal across origins, so this uses
    // the most honest signal actually available: if `load` hasn't
    // fired within a generous window, assume it was refused and show
    // the fallback rather than leave a dead black rectangle with no
    // explanation.
    clearTimeout(this._loadWatchdog)
    let loaded = false
    const onLoad = () => { loaded = true }
    iframe.addEventListener('load', onLoad, { once: true })
    this._loadWatchdog = setTimeout(() => {
      if (!loaded && fallback) {
        fallback.classList.add('is-visible')
        iframe.style.display = 'none'
      }
    }, 4000)
  }

  _setSandbox (sandbox) {
    this._sandbox = sandbox
    const iframe = this._el?.querySelector('#ob-iframe')
    if (iframe) iframe.setAttribute('sandbox', sandbox)
  }

  /** The materialization reveal — small dots scattered outside the
   *  panel's eventual bounds converge inward to fill it, then fade,
   *  revealing the real content. Driven by ONE shared GSAP progress
   *  value updating every particle in a single batched loop each
   *  frame — not one tween per particle, which is what made an
   *  earlier version of this exact idea frame-heavy. This only runs
   *  once, briefly, on first open — not an ongoing per-frame cost. */
  _playMaterialize () {
    const canvas = this._el.querySelector('#ob-reveal-canvas')
    const rect = this._el.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    const c = canvas.getContext('2d')
    c.scale(dpr, dpr)

    const particles = []
    for (let i = 0; i < REVEAL_PARTICLE_COUNT; i++) {
      const targetX = Math.random() * rect.width
      const targetY = Math.random() * rect.height
      const angle = Math.random() * Math.PI * 2
      const dist = 200 + Math.random() * 260
      particles.push({
        startX: targetX + Math.cos(angle) * dist,
        startY: targetY + Math.sin(angle) * dist,
        targetX, targetY,
        size: 1.5 + Math.random() * 2.5,
      })
    }

    this._el.style.opacity = '1'
    const progress = { t: 0 }
    gsap.to(progress, {
      t: 1, duration: REVEAL_DURATION, ease: 'power2.out',
      onUpdate: () => {
        c.clearRect(0, 0, rect.width, rect.height)
        c.fillStyle = `rgba(140, 196, 255, ${0.9 * (1 - progress.t * 0.3)})`
        for (const p of particles) {
          const x = p.startX + (p.targetX - p.startX) * progress.t
          const y = p.startY + (p.targetY - p.startY) * progress.t
          c.beginPath()
          c.arc(x, y, p.size, 0, Math.PI * 2)
          c.fill()
        }
      },
      onComplete: () => {
        gsap.to(canvas, { opacity: 0, duration: 0.3, onComplete: () => { canvas.style.display = 'none' } })
      },
    })
  }

  // ── Header drag / resize — same pattern as every other panel ─────────────

  _bindHeader (el) {
    const header = el.querySelector('.ob-header')
    const onDown = (e) => {
      if (e.target.closest('button')) return
      const cx = e.touches?.[0]?.clientX ?? e.clientX
      const cy = e.touches?.[0]?.clientY ?? e.clientY
      const rect = el.getBoundingClientRect()
      this._drag = { active: true, startX: cx, startY: cy, originX: rect.left, originY: rect.top }
      header.classList.add('is-dragging')
    }
    const onMove = (e) => {
      if (!this._drag.active) return
      const cx = e.touches?.[0]?.clientX ?? e.clientX
      const cy = e.touches?.[0]?.clientY ?? e.clientY
      gsap.set(el, { left: this._drag.originX + (cx - this._drag.startX), top: this._drag.originY + (cy - this._drag.startY) })
    }
    const onUp = () => { this._drag.active = false; header.classList.remove('is-dragging') }

    header.addEventListener('mousedown', onDown)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    header.addEventListener('touchstart', onDown, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', onUp)
  }

  _bindResize (el) {
    const handle = el.querySelector('.ob-resize-handle')
    if (!handle) return
    const resize = { active: false, startX: 0, startY: 0, startW: 0, startH: 0 }
    const onDown = (e) => {
      e.stopPropagation()
      const cx = e.touches?.[0]?.clientX ?? e.clientX
      const cy = e.touches?.[0]?.clientY ?? e.clientY
      const rect = el.getBoundingClientRect()
      resize.active = true; resize.startX = cx; resize.startY = cy
      resize.startW = rect.width; resize.startH = rect.height
    }
    const onMove = (e) => {
      if (!resize.active) return
      const cx = e.touches?.[0]?.clientX ?? e.clientX
      const cy = e.touches?.[0]?.clientY ?? e.clientY
      gsap.set(el, { width: resize.startW + (cx - resize.startX), height: resize.startH + (cy - resize.startY) })
    }
    const onUp = () => { resize.active = false }
    handle.addEventListener('mousedown', onDown)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    handle.addEventListener('touchstart', onDown, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', onUp)
  }
}
