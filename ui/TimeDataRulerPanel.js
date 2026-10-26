/**
 * ui/TimeDataRulerPanel.js — ⟐TimeDataRuler: the vertical TimeData ruler window (V192, window-chrome class A)
 *
 * What it draws (one <canvas>, 2D, redrawn once a second / on resize / zoom / settings; no WebGL):
 *   - the BASELINE (00:00:00) at the top, at the moment chosen in ⟐TimeDataRulerSettings (default: local midnight today);
 *   - top to bottom 00:00 .. 24:00 clock notches (25 labelled hours + 15-minute minors) scaled to the window height;
 *   - TIME CONSUMPTION: the part of the day already used is dimmed and filled with a bar along the spine, a marker line moves
 *     down once a second with a readout (elapsed / remaining HH:MM:SS), a pulse rings on every hour boundary, and past 24:00 the
 *     window follows the next day ("Day +1") or stays (setting). prefers-reduced-motion / animate off: no pulse, the marker
 *     steps once a minute (the numbers still tick);
 *   - HIERARCHY lines for days, weeks, months, years and decade years (longer, heavier and brighter higher up) and a zoom
 *     Day / Week / Month / Year / Decade (+ / - buttons, mouse wheel, pinch, keys + - and arrow keys). The baseline stays the zero line.
 * All maths and the draw plan live in utils/TimeRulerMath.js / utils/TimeDataRuler.js (unit-tested); this file only paints the plan.
 * Settings: utils/TimeDataRulerSettings.js, edited in ui/TimeDataRulerSettingsPanel.js (Admin). Opened by the nav item '⟐TimeDataRuler'
 * (⟐Times slot 1, ribbon Realities > Chronos > Time ruler). Built on ui/OmniSettingsPanelBase.js (resize + maximize from OmniWindowChrome).
 */

import OmniSettingsPanelBase, { esc, PHONE_MAX } from './OmniSettingsPanelBase.js'
import { handsSafe, DOCK_H } from '../utils/OmniStoreLayout.js'
import * as S from '../utils/TimeDataRulerSettings.js'
import * as R from '../utils/TimeDataRuler.js'
import { timeAt, formatStamp, formatClock, formatHMS, HOUR } from '../utils/TimeRulerMath.js'

export const PANEL_ID = 'timedataruler'
export const NAV_ITEM = '⟐TimeDataRuler'
export const SETTINGS_NAV_ITEM = '⟐TimeDataRulerSettings'
export const HOUR_EVENT = 'omni:timedata-ruler-hour'
export const DAY_EVENT = 'omni:timedata-ruler-day'
const tip = (name, desc, key = '—') => `data-omni-tip="${esc(name)}" data-omni-tip-key="${esc(key)}" data-omni-tip-desc="${esc(desc)}"`

const STYLES = `
.oss-panel.tdr-panel { width: 346px; height: 560px; }
.tdr-panel .oss-body { display: flex; flex-direction: column; gap: 6px; padding: 6px 8px 8px; overflow: hidden; }
.tdr-read { display: grid; grid-template-columns: 1fr 1fr; gap: 0 8px; align-items: baseline; flex: 0 0 auto; }
.tdr-read .tdr-k { font-size: 9px; letter-spacing: .08em; text-transform: uppercase; opacity: .62; }
.tdr-read .tdr-v { font-size: 16px; letter-spacing: .03em; font-variant-numeric: tabular-nums; }
.tdr-read .tdr-v.is-acc { color: var(--tdr-accent, #ffb347); }
.tdr-meta { grid-column: 1 / -1; font-size: 10px; opacity: .72; line-height: 1.35; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tdr-tools { display: flex; flex-wrap: wrap; gap: 3px; flex: 0 0 auto; align-items: center; }
.tdr-tools .oss-btn { min-width: 24px; min-height: 26px; padding: 0 4px; }
.tdr-tools .tdr-sep { flex: 1 1 2px; }
.tdr-wrap { position: relative; flex: 1 1 auto; min-height: 140px; border: 1px solid var(--omni-theme-border, rgba(255,255,255,.14)); border-radius: 6px; overflow: hidden; touch-action: none; background: rgba(0,0,0,.18); }
.tdr-wrap canvas { position: absolute; left: 0; top: 0; width: 100%; height: 100%; display: block; outline: none; }
.tdr-wrap canvas:focus-visible { box-shadow: inset 0 0 0 2px var(--tdr-accent, #ffb347); }
.tdr-pulse { position: absolute; width: 14px; height: 14px; margin: -7px 0 0 -7px; border-radius: 50%; border: 2px solid var(--tdr-accent, #ffb347); opacity: 0; pointer-events: none; }
.tdr-pulse.is-on { animation: tdr-pulse 1.3s ease-out 1; }
@keyframes tdr-pulse { 0% { opacity: .95; transform: scale(.6); } 100% { opacity: 0; transform: scale(5); } }
.tdr-cursor { flex: 0 0 auto; min-height: 13px; font-size: 10px; opacity: .72; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
@media (prefers-reduced-motion: reduce) { .tdr-pulse.is-on { animation: none; } }
@media (max-width: ${PHONE_MAX}px) {
  .oss-panel.tdr-panel.tdr-panel { left: auto !important; right: 0 !important; top: var(--omni-top-stack, 150px) !important; bottom: var(--omni-dock-h, 52px) !important; width: min(250px, 74vw) !important; height: auto !important; max-height: none !important; border-radius: 14px 0 0 14px; }
  .tdr-tools .oss-btn { min-width: 34px; min-height: 34px; }
}
`

function injectStyles () {
  if (typeof document === 'undefined' || document.getElementById('tdr-styles')) return
  const s = document.createElement('style'); s.id = 'tdr-styles'; s.textContent = STYLES; document.head.appendChild(s)
}

// ── painting (pure given a 2D context) ───────────────────────────────────────

function hexToRgb (hex) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex || ''); const n = m ? parseInt(m[1], 16) : 0xbcd2ff
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t))
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${Math.max(0, Math.min(1, a)).toFixed(3)})`

/** Colour of a line: the base colour, lighter the higher the level; baseline / decade lines take the accent colour. */
export function lineColor (line, st) {
  const op = (st.lineOpacity ?? 85) / 100
  if (line.kind === 'accent') return rgba(hexToRgb(st.accentColor), op * line.a)
  const rank = { minute: 0, hour: 1, day: 2, week: 3, month: 4, year: 5, decade: 6 }[line.level] ?? 0
  return rgba(mix(hexToRgb(st.lineColor), [255, 255, 255], Math.min(0.6, rank * 0.1)), op * line.a)
}

/**
 * Paints a plan on a 2D context (CSS-pixel coordinates; the caller scales for devicePixelRatio).
 * st = { lineColor, accentColor, lineOpacity, pastOpacity, text (css colour), font, fontPx, hoverY, reduced }
 */
export function paintPlan (ctx, plan, W, H, st) {
  if (!ctx || !plan) return
  ctx.clearRect(0, 0, W, H)
  const fontPx = st.fontPx || 10
  ctx.font = `${fontPx}px ${st.font || '"Courier New", monospace'}`
  ctx.textBaseline = 'middle'
  const accent = hexToRgb(st.accentColor)
  const lines = plan.lines.slice().sort((a, b) => (a.len - b.len))
  const crisp = (v, w) => (Math.round(w) % 2 === 1 || w < 1.5) ? Math.round(v) + 0.5 : Math.round(v)
  const drawContent = () => {
    // spine
    ctx.strokeStyle = rgba(hexToRgb(st.lineColor), 0.55 * (st.lineOpacity / 100)); ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(plan.spineX + 0.5, plan.padY); ctx.lineTo(plan.spineX + 0.5, H - plan.padY); ctx.stroke()
    for (const ln of lines) {
      ctx.strokeStyle = lineColor(ln, st); ctx.lineWidth = ln.w
      const y = crisp(ln.y, ln.w)
      ctx.beginPath(); ctx.moveTo(plan.lineX0, y); ctx.lineTo(plan.lineX0 + plan.lineW * ln.len, y); ctx.stroke()
    }
    ctx.textAlign = 'right'
    const baseAlpha = ctx.globalAlpha
    for (const lb of plan.left) {
      ctx.fillStyle = st.text; ctx.globalAlpha = baseAlpha * (lb.bold ? 1 : 0.8)
      ctx.fillText(lb.text, plan.spineX - 5, Math.round(lb.y))
    }
    ctx.globalAlpha = baseAlpha
    for (const lb of plan.right) {
      ctx.fillStyle = lb.level === 'decade' ? rgba(accent, 1) : st.text
      ctx.fillText(lb.text, W - 4, Math.round(lb.y))
    }
  }
  const fill = plan.fill
  const split = fill ? fill.y1 : -1
  if (fill && split > 0) {
    // future (bright) below the marker, past (dimmed) above it
    ctx.save(); ctx.beginPath(); ctx.rect(0, split, W, Math.max(0, H - split)); ctx.clip(); ctx.globalAlpha = 1; drawContent(); ctx.restore()
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, split); ctx.clip(); ctx.globalAlpha = Math.max(0.15, 1 - (st.pastOpacity / 100) * 0.75); drawContent(); ctx.restore()
    // consumed wash + bar along the spine
    ctx.fillStyle = rgba(accent, 0.07 * (st.pastOpacity / 55)); ctx.fillRect(0, fill.y0, W, Math.max(0, fill.y1 - fill.y0))
    ctx.fillStyle = rgba(accent, 0.95); ctx.fillRect(plan.spineX - 2, fill.y0, 4, Math.max(0, fill.y1 - fill.y0))
  } else {
    ctx.save(); ctx.globalAlpha = 1; drawContent(); ctx.restore()
  }
  // the moving marker
  const now = plan.now
  if (now) {
    const y = Math.round(now.y) + 0.5
    ctx.strokeStyle = rgba(accent, 1); ctx.lineWidth = 1.5
    if (now.state === 'in') {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
      ctx.fillStyle = rgba(accent, 1)
      ctx.beginPath(); ctx.moveTo(plan.spineX - 8, y - 5); ctx.lineTo(plan.spineX - 1, y); ctx.lineTo(plan.spineX - 8, y + 5); ctx.closePath(); ctx.fill()
      if (st.nowText) {
        const tw = ctx.measureText ? ctx.measureText(st.nowText).width : st.nowText.length * 6
        const cx = plan.lineX0 + 4, cy = Math.min(H - plan.padY - 7, Math.max(plan.padY + 7, now.y - 9))
        ctx.fillStyle = 'rgba(8,8,12,0.85)'; ctx.fillRect(cx - 3, cy - 7, tw + 6, 14)
        ctx.fillStyle = rgba(accent, 1); ctx.textAlign = 'left'; ctx.fillText(st.nowText, cx, cy)
      }
    } else {
      // not inside this window: an arrow at the edge that tells where "now" is
      ctx.fillStyle = rgba(accent, 1); ctx.textAlign = 'left'
      ctx.fillText(now.state === 'above' ? '▲ starts later' : '▼ now is further down', plan.lineX0 + 4, now.state === 'above' ? plan.padY + 14 : H - plan.padY - 14)
    }
  }
  if (Number.isFinite(st.hoverY)) {
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1; ctx.setLineDash?.([3, 3])
    ctx.beginPath(); ctx.moveTo(0, Math.round(st.hoverY) + 0.5); ctx.lineTo(W, Math.round(st.hoverY) + 0.5); ctx.stroke(); ctx.setLineDash?.([])
  }
}

// ── the window ───────────────────────────────────────────────────────────────

export default class TimeDataRulerPanel extends OmniSettingsPanelBase {
  constructor () {
    super({ id: PANEL_ID, label: NAV_ITEM, iconLabel: '⟐◷', navItems: [NAV_ITEM, '⟐TimeDataRulerPanel'], className: 'tdr-panel' })
    this.now = () => Date.now()          // test hook
    this._settings = S.getSettings()
    this._page = 0; this._stopPage = 0; this._follow = true
    this._sec = -1; this._minute = -1; this._hourKey = null; this._dayKey = null
    this._dirty = true; this._plan = null; this._hoverY = null; this._wheel = 0
    this._ptrs = new Map(); this._pinch0 = 0
    this._W = 0; this._H = 0; this._dpr = 1
    this._ro = null; this._h = {}
    this.lastCounts = null
  }

  get reduced () {
    try { return !!(typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) } catch (_) { return false }
  }
  /** Marker animates every second only when the setting is on AND the system does not ask for reduced motion. */
  get animated () { return this._settings.animate !== false && !this.reduced }

  onInit () {
    injectStyles()
    this._h.changed = (e) => {
      const prev = this._settings
      this._settings = e.detail?.settings ?? S.getSettings()
      if (prev.baselineMs !== this._settings.baselineMs || prev.rollover !== this._settings.rollover) this._resync(true)
      this._dirty = true
      if (this._isOpen) { this._syncUi(); this._tick(true) }
    }
    this._h.set = (e) => { const d = e.detail || {}; if (d.reset) S.resetSettings(); else if (d.patch) S.updateSettings(d.patch) }
    this._h.resized = (e) => { if (e.detail?.id === PANEL_ID && this._isOpen) this._resize() }
    window.addEventListener(S.CHANGED_EVENT, this._h.changed)
    window.addEventListener(S.SET_EVENT, this._h.set)
    window.addEventListener('omni:window-resized', this._h.resized)
    window.addEventListener('resize', this._h.resized2 = () => { if (this._isOpen) this._resize() })
  }
  onDestroy () {
    window.removeEventListener(S.CHANGED_EVENT, this._h.changed)
    window.removeEventListener(S.SET_EVENT, this._h.set)
    window.removeEventListener('omni:window-resized', this._h.resized)
    if (this._h.resized2) window.removeEventListener('resize', this._h.resized2)
    this._ro?.disconnect?.(); this._ro = null
  }

  /** Desktop: a tall window at the right edge, clear of the hands, between the ribbon and the dock. */
  _place () {
    const cs = getComputedStyle(document.documentElement)
    const top = (parseFloat(cs.getPropertyValue('--omni-top-offset')) || 76) + 8          // just under the ribbon: the hands only take the left / right edge, handsSafe() keeps clear of them
    const dock = parseFloat(cs.getPropertyValue('--omni-dock-h')) || DOCK_H               // the Dock plus the OmniDock_Realities row when it is shown
    const h = Math.max(300, window.innerHeight - top - dock - 10)
    const sf = handsSafe(top, top + h)
    const w = this._el.offsetWidth || 346
    this._el.style.top = top + 'px'
    this._el.style.left = Math.max(12, Math.min(window.innerWidth - w - 12, sf.right - w)) + 'px'
    this._el.style.height = h + 'px'
    this._el.style.maxHeight = h + 'px'
  }

  buildBody (body) {
    body.innerHTML = `
      <div class="tdr-read" role="timer" aria-label="Time consumed on the ruler">
        <div><div class="tdr-k">Elapsed</div><div class="tdr-v is-acc" data-r="elapsed">00:00:00</div></div>
        <div><div class="tdr-k">Remaining</div><div class="tdr-v" data-r="remaining">00:00:00</div></div>
        <div class="tdr-meta" data-r="meta"></div>
      </div>
      <div class="tdr-tools" data-r="tools">
        <button type="button" class="oss-btn" data-a="zoom-out" aria-label="Zoom out" ${tip('Zoom out', 'Shows a longer stretch of time: day, week, month, year, decade. The mouse wheel and a pinch do the same.', '− / wheel')}>−</button>
        <button type="button" class="oss-btn" data-a="zoom-in" aria-label="Zoom in" ${tip('Zoom in', 'Shows a shorter stretch of time, down to the 24-hour day.', '+ / wheel')}>＋</button>
        ${R.ZOOMS.map(z => `<button type="button" class="oss-btn" data-zoom="${z}" aria-pressed="false" ${tip(R.ZOOM_LABELS[z] + ' scale', `Show one ${z === 'decade' ? 'century (decades are the major lines)' : z} from the baseline.`)}>${{ day: 'D', week: 'W', month: 'M', year: 'Y', decade: 'X' }[z]}</button>`).join('')}
        <span class="tdr-sep"></span>
        <button type="button" class="oss-btn" data-a="prev" aria-label="Earlier" ${tip('Earlier', 'Moves the window one step back in time (and stops following now).', '↑')}>▲</button>
        <button type="button" class="oss-btn" data-a="next" aria-label="Later" ${tip('Later', 'Moves the window one step forward in time (and stops following now).', '↓')}>▼</button>
        <button type="button" class="oss-btn" data-a="now" aria-label="Go to now" ${tip('Now', 'Follows the current moment again.', 'N')}>⌖</button>
        <button type="button" class="oss-btn" data-a="base" aria-label="Go to the baseline" ${tip('Baseline', 'Shows the window that starts at the baseline (00:00:00).', 'Home')}>⊤</button>
        <button type="button" class="oss-btn" data-a="settings" aria-label="Ruler settings" ${tip('Ruler settings', 'Opens ⟐TimeDataRulerSettings: the baseline date and time, week start, which lines to show.')}>⚙</button>
      </div>
      <div class="tdr-wrap" data-r="wrap"><canvas tabindex="0" role="img" aria-label="Vertical time ruler: 00:00 at the top to 24:00 at the bottom" data-r="canvas"></canvas><div class="tdr-pulse" data-r="pulse"></div></div>
      <div class="tdr-cursor" data-r="cursor" aria-live="off"></div>`
    const q = (r) => body.querySelector(`[data-r="${r}"]`)
    this._ui = { elapsed: q('elapsed'), remaining: q('remaining'), meta: q('meta'), wrap: q('wrap'), canvas: q('canvas'), pulse: q('pulse'), cursor: q('cursor'), tools: q('tools') }
    body.addEventListener('click', (e) => this._click(e))
    const cv = this._ui.canvas
    cv.addEventListener('wheel', (e) => this._onWheel(e), { passive: false })
    cv.addEventListener('pointerdown', (e) => this._onPointer(e, 'down'))
    cv.addEventListener('pointermove', (e) => this._onPointer(e, 'move'))
    cv.addEventListener('pointerup', (e) => this._onPointer(e, 'up'))
    cv.addEventListener('pointercancel', (e) => this._onPointer(e, 'up'))
    cv.addEventListener('pointerleave', (e) => { if (e.pointerType !== 'touch') this._hover(null) })
    cv.addEventListener('keydown', (e) => this._onKey(e))
    if (typeof ResizeObserver !== 'undefined') { this._ro = new ResizeObserver(() => { if (this._isOpen) this._resize() }); this._ro.observe(this._ui.wrap) }
  }

  onOpened () {
    this._settings = S.getSettings()
    this._resync(true)
    this._syncUi()
    this._resize()
    this._sec = -1; this._minute = -1; this._hourKey = null
    this._tick(true)
  }

  refresh () { if (this._ui) { this._syncUi(); this._dirty = true } }

  // ── time keeping ───────────────────────────────────────────────────────────

  _baseline (now = this.now()) { return S.resolveBaseline(this._settings, now) }

  /** Re-pin the page to "now" (follow) after the baseline / zoom / rollover changed or the window opened. */
  _resync (follow) {
    const now = this.now(), b = this._baseline(now)
    if (follow) this._follow = true
    this._page = R.followPage(b, this._settings.zoom, now)
    this._stopPage = R.followPage(b, 'day', now)
    this._dirty = true
  }
  _effPage (now, b) { return (this._follow && this._settings.rollover !== 'stop') ? R.followPage(b, this._settings.zoom, now) : this._page }
  _dayPageNow (now, b) { return R.dayPage(b, now, this._settings.rollover, this._stopPage) }

  update () {
    if (!this._isOpen || !this._ui) return
    const sec = Math.floor(this.now() / 1000)
    if (sec === this._sec) return
    this._sec = sec
    this._tick(false)
  }

  /** Once per second: numbers always; the canvas every second when animated, else only when the minute changed (or something changed). */
  _tick (force) {
    if (!this._ui) return
    const now = this.now(), b = this._baseline(now)
    const dayPage = this._dayPageNow(now, b)
    const c = R.consumption(b, now, dayPage)
    const ro = R.readout(c, dayPage)
    this._ui.elapsed.textContent = ro.elapsed
    this._ui.remaining.textContent = ro.remaining
    this._ui.meta.textContent = `${ro.day} · ${ro.text}`
    this._baseText = `Baseline ${formatStamp(b)}${S.baselineMode(this._settings) === 'auto' ? ' (today 00:00)' : ''}`
    if (this._hoverY == null) { this._ui.cursor.textContent = this._baseText; this._ui.cursor.title = this._baseText }
    // hour / day boundaries
    if (c) {
      const hk = `${dayPage}:${c.hourIndex}`
      if (this._hourKey != null && hk !== this._hourKey) this._onHour(c, now, dayPage)
      this._hourKey = hk
      if (this._dayKey != null && this._dayKey !== dayPage) { try { window.dispatchEvent(new CustomEvent(DAY_EVENT, { detail: { page: dayPage, at: now } })) } catch (_) {} }
      this._dayKey = dayPage
    }
    const minute = Math.floor(now / 60000)
    if (force || this._dirty || this.animated || minute !== this._minute) { this._minute = minute; this._draw(now, b) }
  }

  _onHour (c, now, dayPage) {
    try { window.dispatchEvent(new CustomEvent(HOUR_EVENT, { detail: { hour: c.hourIndex, page: dayPage, at: now } })) } catch (_) {}
    if (!this.animated || !this._ui?.pulse) return
    const p = this._ui.pulse
    p.classList.remove('is-on'); void p.offsetWidth; p.classList.add('is-on')   // restart the CSS animation
  }

  // ── drawing ────────────────────────────────────────────────────────────────

  _resize () {
    if (!this._ui) return
    const r = this._ui.wrap.getBoundingClientRect()
    const W = Math.max(60, Math.floor(r.width) || 230), H = Math.max(60, Math.floor(r.height) || 460)
    const dpr = Math.min(3, Math.max(1, (typeof window !== 'undefined' && window.devicePixelRatio) || 1))
    if (W === this._W && H === this._H && dpr === this._dpr) return
    this._W = W; this._H = H; this._dpr = dpr
    const cv = this._ui.canvas
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr)
    this._dirty = true
    this._draw(this.now(), this._baseline())
  }

  _phone () { return (window.innerWidth || 1280) <= PHONE_MAX }

  _draw (now, b) {
    if (!this._ui) return
    if (!this._W) { this._W = 230; this._H = 460 }
    const st = this._settings
    const phone = this._phone()
    const fontPx = phone ? 11 : 10
    const page = this._effPage(now, b)
    if (this._follow && st.rollover !== 'stop') this._page = page
    const plan = R.buildPlan({
      baselineTs: b, nowTs: now, zoom: st.zoom, page, settings: st, width: this._W, height: this._H,
      fontPx, padY: Math.round(fontPx * 1.3), gutterL: phone ? 46 : 42, gutterR: phone ? 66 : 62,
    })
    this._plan = plan; this._dirty = false
    this.lastCounts = plan?.counts ?? null
    // the pulse ring sits on the marker
    if (plan?.now && this._ui.pulse) { this._ui.pulse.style.left = plan.spineX + 'px'; this._ui.pulse.style.top = plan.now.y + 'px' }
    const ctx = this._ui.canvas.getContext?.('2d')
    if (!ctx || !plan) return
    ctx.setTransform(this._dpr, 0, 0, this._dpr, 0, 0)
    let text = '#e8ecf5'
    try { text = getComputedStyle(this._el).color || text } catch (_) {}
    paintPlan(ctx, plan, this._W, this._H, {
      lineColor: st.lineColor, accentColor: st.accentColor, lineOpacity: st.lineOpacity, pastOpacity: st.pastOpacity,
      text, fontPx, hoverY: this._hoverY, nowText: plan.now?.state !== 'in' ? '' : (st.zoom === 'day' ? formatHMS(now - plan.win.start) : 'now ' + formatClock(now)),   // day zoom: the chip reads on the ruler's own 00:00 .. 24:00 scale
    })
  }

  // ── ui ─────────────────────────────────────────────────────────────────────

  _syncUi () {
    if (!this._ui) return
    const st = this._settings
    this._el.style.setProperty('--tdr-accent', st.accentColor)
    this._ui.tools.querySelectorAll('[data-zoom]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.zoom === st.zoom)))
    this._ui.tools.querySelectorAll('[data-zoom]').forEach(b => b.classList.toggle('is-on', b.dataset.zoom === st.zoom))
    this._ui.canvas.setAttribute('aria-label', `Vertical time ruler, ${R.ZOOM_LABELS[st.zoom]} scale: the baseline 00:00:00 is at the top`)
  }

  _click (e) {
    const t = e.target.closest?.('button'); if (!t) return
    const z = t.dataset.zoom
    if (z) return this.setZoom(z)
    switch (t.dataset.a) {
      case 'zoom-in': return this.zoomStep(-1)
      case 'zoom-out': return this.zoomStep(1)
      case 'prev': return this.pageBy(-1)
      case 'next': return this.pageBy(1)
      case 'now': return this.goNow()
      case 'base': return this.goBaseline()
      case 'settings': window.dispatchEvent(new CustomEvent('omni:nav-select', { detail: { item: SETTINGS_NAV_ITEM } })); return
      default:
    }
  }

  setZoom (z) { S.updateSettings({ zoom: z }); this._resync(true); this._tick(true) }
  zoomStep (dir) { this.setZoom(R.stepZoom(this._settings.zoom, dir)) }
  pageBy (n) {
    const now = this.now(), b = this._baseline(now)
    const cur = this._effPage(now, b)
    const w = R.windowFor(b, this._settings.zoom, cur + n)
    if (!w) return
    this._follow = false; this._page = cur + n; this._dirty = true; this._tick(true)
  }
  goNow () { this._resync(true); this._tick(true) }
  goBaseline () { this._follow = false; this._page = 0; this._dirty = true; this._tick(true) }

  _onWheel (e) {
    e.preventDefault()
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1
    this._wheel += (e.deltaY || 0) * unit
    if (Math.abs(this._wheel) >= 60) { const dir = this._wheel > 0 ? 1 : -1; this._wheel = 0; this.zoomStep(dir) }
  }
  _onKey (e) {
    const k = e.key; let h = true
    if (k === '+' || k === '=') this.zoomStep(-1)
    else if (k === '-' || k === '_') this.zoomStep(1)
    else if (k === 'ArrowUp') this.pageBy(-1)
    else if (k === 'ArrowDown') this.pageBy(1)
    else if (k === 'Home') this.goBaseline()
    else if (k === 'n' || k === 'N') this.goNow()
    else h = false
    if (h) { e.preventDefault(); e.stopPropagation() }
  }
  _onPointer (e, kind) {
    const cv = this._ui.canvas
    if (kind === 'down') {
      this._ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY })
      try { cv.setPointerCapture?.(e.pointerId) } catch (_) {}
      if (this._ptrs.size === 2) this._pinch0 = this._pinchDist()
    } else if (kind === 'move') {
      if (this._ptrs.has(e.pointerId)) this._ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (this._ptrs.size === 2 && this._pinch0 > 0) {
        const r = this._pinchDist() / this._pinch0
        if (r > 1.4) { this._pinch0 = this._pinchDist(); this.zoomStep(-1) } else if (r < 0.7) { this._pinch0 = this._pinchDist(); this.zoomStep(1) }
        return
      }
      if (this._ptrs.size <= 1) this._hover(e.clientY - cv.getBoundingClientRect().top)
    } else {
      this._ptrs.delete(e.pointerId); this._pinch0 = 0
      if (e.pointerType === 'touch') this._hover(null)
    }
  }
  _pinchDist () { const [a, b] = [...this._ptrs.values()]; return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0 }

  _hover (y) {
    this._hoverY = y
    if (!this._plan || y == null || !Number.isFinite(y)) { if (this._ui) this._ui.cursor.textContent = this._baseText || ''; this._dirtyHover(); return }
    const t = timeAt(y, this._plan.view)
    const b = this._baseline()
    const rel = t - b
    this._ui.cursor.textContent = Number.isFinite(t) && y >= this._plan.padY - 2 && y <= this._H - this._plan.padY + 2
      ? `${formatStamp(t)}  (${rel < 0 ? '−' : '+'}${formatHMS(Math.abs(rel))})` : (this._baseText || '')
    this._dirtyHover()
  }
  _dirtyHover () {
    if (this._hoverRaf) return
    const run = () => { this._hoverRaf = 0; this._dirty = true; this._draw(this.now(), this._baseline()) }
    if (typeof requestAnimationFrame === 'function') this._hoverRaf = requestAnimationFrame(run); else run()
  }

  // test / debug access
  get plan () { return this._plan }
  get page () { return this._page }
  get following () { return this._follow }
}
