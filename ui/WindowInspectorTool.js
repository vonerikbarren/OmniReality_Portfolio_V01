/**
 * ui/WindowInspectorTool.js — ⟐indow Inspector
 *
 * The concrete tool this exists to support: dragging/resizing a panel
 * to exactly where you want it, reading off its real, live pixel
 * metrics, and handing those numbers over directly rather than
 * describing a position in words and hoping it lands right. Built
 * specifically after tracing the OmniBrowser mobile off-screen issue —
 * this is the tool to actually diagnose that with real numbers, not
 * guesses, on the real device.
 *
 * Purely additive — reads every panel WindowManager already tracks
 * (getRegisteredWindows()) and their real getBoundingClientRect(), with
 * zero changes to any of the ~25+ existing panel files. Toggle via F6
 * or Admin Settings slot 7. While active:
 *   - Desktop: hovering any registered panel live-updates the readout
 *     and draws a highlight outline around it — pure observation, no
 *     click/drag interception, so normal panel dragging/resizing still
 *     works exactly as before even while this is on.
 *   - Touch: tapping a panel pins its readout (no hover to fall back
 *     on) — also non-intercepting, so the panel's own touch-drag
 *     handling still fires normally alongside it.
 *
 * Follows the standard module contract (constructor / init / update / destroy).
 */

import * as WindowManager from './WindowManager.js'

const STYLES = `

.omni-wi-hud {
  position        : fixed;
  bottom           : 16px;
  right            : 16px;
  width            : 260px;
  padding          : 12px 14px;
  background       : rgba(8, 8, 12, 0.92);
  backdrop-filter  : blur(20px) saturate(1.5);
  -webkit-backdrop-filter: blur(20px) saturate(1.5);
  border           : 1px solid rgba(255, 178, 127, 0.35);
  border-radius    : 10px;
  box-shadow       : 0 0 20px rgba(0,0,0,0.4), 0 10px 30px rgba(0,0,0,0.5);
  font-family      : 'Courier New', Courier, monospace;
  font-size        : 10.5px;
  color            : rgba(255, 255, 255, 0.9);
  z-index          : 999999;
  pointer-events   : auto;
  display          : none;
}
.omni-wi-hud.is-active { display: block; }
.omni-wi-title { font-size: 10px; letter-spacing: 0.06em; color: rgba(255, 178, 127, 0.9); text-transform: uppercase; margin-bottom: 8px; }
.omni-wi-row { display: flex; justify-content: space-between; padding: 2px 0; color: rgba(255,255,255,0.75); }
.omni-wi-row b { color: rgba(255,255,255,0.95); font-weight: normal; }
.omni-wi-warn { color: rgba(255, 120, 120, 0.95); margin-top: 6px; font-size: 9.5px; line-height: 1.4; }
.omni-wi-empty { color: rgba(255,255,255,0.5); font-size: 9.5px; }
.omni-wi-copy {
  width: 100%; margin-top: 8px; padding: 5px; border-radius: 5px; cursor: pointer;
  border: 1px solid rgba(255, 178, 127, 0.3); background: rgba(255, 178, 127, 0.08);
  color: rgba(255, 178, 127, 0.9); font-family: inherit; font-size: 9.5px;
}
.omni-wi-copy:hover { background: rgba(255, 178, 127, 0.16); }

.omni-wi-outline {
  position: fixed; pointer-events: none; z-index: 999998;
  border: 2px solid rgba(255, 178, 127, 0.85);
  box-shadow: 0 0 0 2000px rgba(0,0,0,0.15);
  display: none;
}
.omni-wi-outline.is-active { display: block; }

`

function injectStyles () {
  if (document.getElementById('omni-wi-styles')) return
  const tag = document.createElement('style')
  tag.id = 'omni-wi-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

export default class WindowInspectorTool {
  constructor (context) {
    this.ctx = context
    this._active = false
    this._hud = null
    this._outline = null
    this._pinned = null   // panel id pinned via tap, for touch devices
  }

  init () {
    injectStyles()
    this._hud = document.createElement('div')
    this._hud.className = 'omni-wi-hud'
    document.body.appendChild(this._hud)

    this._outline = document.createElement('div')
    this._outline.className = 'omni-wi-outline'
    document.body.appendChild(this._outline)

    this._onMove = (e) => this._handlePoint(e.clientX, e.clientY)
    this._onTouch = (e) => {
      const t = e.touches?.[0]
      if (t) { this._pinned = null; this._handlePoint(t.clientX, t.clientY) }
    }
    this._onKey = (e) => {
      if (e.key !== 'F6' || e.repeat) return
      const isTyping = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)
      if (isTyping) return
      this.toggle()
    }
    this._onNavSelect = (e) => {
      if (e.detail?.item !== '⟐WindowInspector') return
      this.toggle()
    }

    window.addEventListener('mousemove', this._onMove)
    window.addEventListener('touchstart', this._onTouch, { passive: true })
    window.addEventListener('keydown', this._onKey)
    window.addEventListener('omni:nav-select', this._onNavSelect)
  }

  update () {}
  onResize () {}

  destroy () {
    window.removeEventListener('mousemove', this._onMove)
    window.removeEventListener('touchstart', this._onTouch)
    window.removeEventListener('keydown', this._onKey)
    window.removeEventListener('omni:nav-select', this._onNavSelect)
    this._hud?.remove()
    this._outline?.remove()
  }

  toggle () {
    this._active = !this._active
    this._hud.classList.toggle('is-active', this._active)
    this._outline.classList.toggle('is-active', this._active)
    if (!this._active) this._pinned = null
  }

  _handlePoint (x, y) {
    if (!this._active) return
    const windows = WindowManager.getRegisteredWindows()
    let hit = null
    for (const w of windows) {
      if (!w.isOpen) continue
      const rect = w.el.getBoundingClientRect()
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        hit = { ...w, rect }
        break
      }
    }
    if (hit) this._render(hit)
    else if (!this._pinned) this._renderEmpty()
  }

  _render ({ id, label, rect }) {
    const vw = window.innerWidth
    const vh = window.innerHeight
    const offRight = Math.max(0, Math.round(rect.right - vw))
    const offBottom = Math.max(0, Math.round(rect.bottom - vh))
    const offLeft = Math.max(0, Math.round(-rect.left))
    const offTop = Math.max(0, Math.round(-rect.top))
    const isOffscreen = offRight > 0 || offBottom > 0 || offLeft > 0 || offTop > 0

    const left = Math.round(rect.left)
    const top = Math.round(rect.top)
    const width = Math.round(rect.width)
    const height = Math.round(rect.height)

    this._lastMetrics = { id, label, left, top, width, height, viewportWidth: vw, viewportHeight: vh }

    this._hud.innerHTML = `
      <div class="omni-wi-title">⟐${label || id}</div>
      <div class="omni-wi-row"><span>left</span><b>${left}px</b></div>
      <div class="omni-wi-row"><span>top</span><b>${top}px</b></div>
      <div class="omni-wi-row"><span>width</span><b>${width}px</b></div>
      <div class="omni-wi-row"><span>height</span><b>${height}px</b></div>
      <div class="omni-wi-row"><span>viewport</span><b>${vw}×${vh}</b></div>
      ${isOffscreen ? `<div class="omni-wi-warn">⚠ off-screen — ${[
        offLeft ? `${offLeft}px past left` : null,
        offRight ? `${offRight}px past right` : null,
        offTop ? `${offTop}px past top` : null,
        offBottom ? `${offBottom}px past bottom` : null,
      ].filter(Boolean).join(', ')}</div>` : ''}
      <button class="omni-wi-copy" data-action="copy">Copy metrics</button>
    `
    this._hud.querySelector('[data-action="copy"]').addEventListener('click', () => this._copyMetrics())

    Object.assign(this._outline.style, {
      left: `${rect.left}px`, top: `${rect.top}px`,
      width: `${rect.width}px`, height: `${rect.height}px`,
    })
  }

  _renderEmpty () {
    this._hud.innerHTML = `<div class="omni-wi-title">⟐Window Inspector</div><div class="omni-wi-empty">Hover or tap a panel to read its live metrics.</div>`
    this._outline.style.width = '0'
    this._outline.style.height = '0'
  }

  _copyMetrics () {
    if (!this._lastMetrics) return
    const m = this._lastMetrics
    const text = `${m.label} (${m.id}) — left:${m.left}px top:${m.top}px width:${m.width}px height:${m.height}px  [viewport ${m.viewportWidth}×${m.viewportHeight}]`
    navigator.clipboard?.writeText(text).catch(() => {})
    const btn = this._hud.querySelector('[data-action="copy"]')
    if (btn) { const original = btn.textContent; btn.textContent = 'Copied!'; setTimeout(() => { if (btn) btn.textContent = original }, 1200) }
  }
}
