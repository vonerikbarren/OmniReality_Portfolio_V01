/**
 * ui/OmniChronos.js — ⟐mniReality OmniChronos
 *
 * "It is time." V172: a Premiere-style editing window over Primary Time. The PLAYHEAD IS PRIMARY TIME: playing or
 * scrubbing here moves utils/PrimaryTime.js, which the floor clock (modules/ChronosFloorClock.js) and the travelling
 * reality node (modules/ChronosRealityNode.js) already read every frame.
 *
 *   Desktop   EDITOR tab (docked, like Premiere): top = PROGRAM MONITOR (timecode, transport, speed, in / out / marker)
 *             + a project / selected-clip strip; bottom = the TIMELINE (ui/OmniTimelineView.js).      SETTINGS tab.
 *   Phones    <= 700px: tabs PLAYER | TIMELINE | SETTINGS (one at a time), the window fills the width under the ribbon.
 *
 * Data lives in utils/OmniTimeline.js and is evaluated by systems/OmniTimelinePlayer.js (a module in main.js), so
 * the ribbon buttons and the Inspector's Time section work with this window closed. Timeline edits are LIVE
 * (auto-persisted, debounced). The SETTINGS tab keeps the original Admin-style STAGED save:
 *
 *   Tunnel Enabled / Z-axis Mode / Transparency / Time Format  ->  nothing is applied until 💾 is pressed, then
 *   omni:chronos-toggle | omni:chronos-axis-set | omni:chronos-transparency-set go to modules/RootSpace.js.
 *
 * Keyboard shortcuts (Space, ←/→, Home/End, I/O, M, C, Delete, +/-) are handled ONLY while the pointer is over this
 * window or focus is inside it (capture listener, stops those keys reaching the global handlers in main.js).
 *
 * Follows the standard module contract (constructor / init / update / destroy).
 */

import gsap from 'gsap'
import * as WindowManager from './WindowManager.js'
import * as PrimaryTime from '../utils/PrimaryTime.js'
import * as TL from '../utils/OmniTimeline.js'
import { formatSeconds } from '../utils/TimeData.js'
import { getTopOffset, PHONE_MAX } from '../utils/OmniLayout.js'
import { getPlayer } from '../systems/OmniTimelinePlayer.js'
import OmniTimelineView from './OmniTimelineView.js'

const STORE_KEY = 'omni:chronos:settings'
const DEFAULTS = { enabled: true, zAxis: false, transparency: true, timeFormat: 'military' }
const DOCK_H = 52
const DAY = 86400

function loadSettings () {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS }
  } catch (_) {
    return { ...DEFAULTS }
  }
}

const ev = (n, d) => window.dispatchEvent(new CustomEvent(n, { detail: d }))
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e }

const STYLES = /* css */`

.omni-chronos-panel {
  --oc-bg          : var(--omni-theme-bg, rgba(8, 8, 12, 0.92));
  --oc-border      : var(--omni-theme-border, rgba(255, 255, 255, 0.09));
  --oc-header-bg   : var(--omni-theme-header-bg, rgba(255, 255, 255, 0.03));
  --oc-text        : var(--omni-theme-text, rgba(255, 255, 255, 1));
  --oc-text-dim    : var(--omni-theme-text-dim, rgba(255, 255, 255, 0.85));
  --oc-text-muted  : var(--omni-theme-text-muted, rgba(255, 255, 255, 0.6));
  --oc-accent      : var(--omni-theme-accent, #ffd27f);
  --mono           : 'Courier New', Courier, monospace;

  position         : fixed;
  top              : 130px;
  left             : 130px;
  width            : 940px;
  min-width        : 420px;
  max-width        : 100vw;
  height           : 540px;
  min-height       : 300px;
  max-height       : 96vh;

  display          : flex;
  flex-direction   : column;

  background       : var(--oc-bg);
  backdrop-filter  : blur(22px) saturate(1.5);
  -webkit-backdrop-filter: blur(22px) saturate(1.5);
  border           : 1px solid var(--oc-border);
  border-radius    : 12px;
  box-shadow       : 0 0 24px rgba(0,0,0,0.4), 0 12px 40px rgba(0,0,0,0.55);

  font-family      : var(--mono);
  color            : var(--oc-text);
  z-index          : 60;
  overflow         : hidden;
  pointer-events   : auto;

  opacity          : 0;
  transform        : scale(0.94);
}

.chr-header {
  position         : relative;
  height           : 36px;
  flex-shrink      : 0;
  display          : flex;
  align-items      : center;
  justify-content  : center;
  background       : var(--oc-header-bg);
  border-bottom    : 1px solid var(--oc-border);
  cursor           : grab;
  user-select      : none;
  touch-action     : none;
}
.chr-header.is-dragging { cursor: grabbing; }
.chr-title { position: absolute; left: 14px; font-size: 11px; letter-spacing: 0.06em; color: var(--oc-text-dim); }
.chr-controls { position: absolute; right: 10px; display: flex; align-items: center; gap: 8px; }
.chr-ctrl {
  width: 22px; height: 22px; border-radius: 6px;
  border: 1px solid var(--oc-border);
  background: rgba(255,255,255,0.04);
  color: var(--oc-text-dim);
  font-size: 10px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
}
.chr-ctrl:hover { background: rgba(255,255,255,0.10); color: var(--oc-text); }
.chr-ctrl--save { color: rgba(255, 210, 127, 0.9); border-color: rgba(255, 210, 127, 0.25); }
.chr-ctrl--save:hover { background: rgba(255, 210, 127, 0.14); }

.oc-unsaved-banner {
  flex-shrink      : 0;
  display          : none;
  align-items      : center;
  justify-content  : center;
  gap              : 6px;
  padding          : 6px;
  font-size        : 9.5px;
  letter-spacing   : 0.03em;
  color            : rgba(255, 200, 140, 0.95);
  background       : rgba(255, 180, 100, 0.12);
  border-bottom    : 1px solid rgba(255, 180, 100, 0.2);
}
.oc-unsaved-banner.is-visible { display: flex; }

.chr-tabs { flex: 0 0 auto; display: flex; gap: 2px; padding: 0 6px; border-bottom: 1px solid var(--oc-border); background: var(--oc-header-bg); }
.chr-tab { padding: 6px 12px; font: 10.5px var(--mono); letter-spacing: .08em; color: var(--oc-text-muted); background: transparent; border: 0; border-bottom: 2px solid transparent; cursor: pointer; }
.chr-tab:hover { color: var(--oc-text); }
.chr-tab.is-active { color: var(--oc-accent); border-bottom-color: var(--oc-accent); }
.omni-chronos-panel[data-mode=desktop] .chr-tab.mob-only { display: none; }
.omni-chronos-panel[data-mode=mobile] .chr-tab.desk-only, .omni-chronos-panel[data-mode=mobile] .chr-tab-hint { display: none; }
.chr-tab-hint { margin-left: auto; align-self: center; font-size: 9px; color: var(--oc-text-muted); padding-right: 6px; }

.chr-views { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; }
.chr-view { display: none; min-height: 0; }
.omni-chronos-panel[data-mode=desktop][data-tab=edit] .chr-view-player { display: flex; flex: 0 0 auto; }
.omni-chronos-panel[data-mode=desktop][data-tab=edit] .chr-view-timeline { display: flex; flex: 1 1 auto; flex-direction: column; border-top: 1px solid var(--oc-border); }
.omni-chronos-panel[data-mode=mobile][data-tab=player] .chr-view-player { display: flex; flex: 1 1 auto; overflow-y: auto; }
.omni-chronos-panel[data-mode=mobile][data-tab=timeline] .chr-view-timeline { display: flex; flex: 1 1 auto; flex-direction: column; }
.omni-chronos-panel[data-tab=settings] .chr-view-settings { display: block; flex: 1 1 auto; overflow-y: auto; }

/* PLAYER (program monitor + project strip) */
.chr-player { display: flex; flex-wrap: wrap; gap: 10px; padding: 8px 10px; width: 100%; box-sizing: border-box; }
.chr-mon { flex: 0 1 470px; max-width: 100%; display: flex; flex-direction: column; gap: 6px; padding: 8px 10px; border: 1px solid var(--oc-border); border-radius: 8px; background: rgba(0,0,0,.28); }
.chr-tc { font: 600 36px/1 var(--mono); letter-spacing: .04em; color: var(--oc-accent); text-align: center; font-variant-numeric: tabular-nums; }
.chr-sub { display: flex; justify-content: space-between; gap: 8px; font-size: 10px; color: var(--oc-text-muted); }
.chr-day { height: 5px; border-radius: 3px; background: rgba(255,255,255,.1); overflow: hidden; }
.chr-day > i { display: block; height: 100%; width: 0; background: var(--oc-accent); }
.chr-trans { display: flex; align-items: center; justify-content: center; gap: 4px; flex-wrap: wrap; }
.chr-tbtn { min-width: 32px; height: 30px; border-radius: 5px; border: 1px solid var(--oc-border); background: rgba(255,255,255,.05); color: var(--oc-text-dim); font: 13px var(--mono); cursor: pointer; padding: 0 6px; }
.chr-tbtn:hover { background: rgba(255,255,255,.12); color: var(--oc-text); }
.chr-tbtn.is-on { border-color: var(--oc-accent); color: var(--oc-accent); background: rgba(255,210,127,.14); }
.chr-tbtn--play { min-width: 48px; font-size: 14px; }
.chr-tsel { height: 30px; border-radius: 5px; border: 1px solid var(--oc-border); background: rgba(0,0,0,.35); color: var(--oc-text); font: 11px var(--mono); }
.chr-now { font-size: 10px; color: var(--oc-text-muted); min-height: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.chr-now b { color: var(--oc-text-dim); font-weight: 600; }
.chr-info { flex: 1 1 220px; min-width: 200px; display: flex; flex-direction: column; gap: 4px; padding: 8px 10px; border: 1px solid var(--oc-border); border-radius: 8px; background: rgba(0,0,0,.2); max-height: 176px; overflow-y: auto; font-size: 10.5px; }
.chr-info h4 { margin: 0 0 2px; font: 600 10px var(--mono); letter-spacing: .1em; color: var(--oc-text-muted); }
.chr-info .row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.chr-info label { color: var(--oc-text-muted); font-size: 10px; }
.chr-info input[type=number], .chr-info input[type=text], .chr-info select { height: 22px; max-width: 92px; background: rgba(0,0,0,.35); color: var(--oc-text); border: 1px solid var(--oc-border); border-radius: 3px; font: 10.5px var(--mono); padding: 0 4px; }
.chr-info input[type=text] { max-width: 130px; }
.chr-info input[type=color] { width: 26px; height: 22px; padding: 0; border: 1px solid var(--oc-border); background: transparent; }
.chr-info .kr { display: flex; align-items: center; gap: 5px; padding: 1px 0; border-top: 1px dotted var(--oc-border); }
.chr-info .kr span { color: var(--oc-text-dim); }
.chr-info button { height: 20px; padding: 0 6px; border-radius: 3px; border: 1px solid var(--oc-border); background: transparent; color: var(--oc-text-dim); font: 10px var(--mono); cursor: pointer; }
.chr-info button:hover { background: rgba(255,255,255,.1); }
.chr-info .muted { color: var(--oc-text-muted); }

.omni-chronos-panel[data-mode=mobile] .chr-player { flex-direction: column; padding: 6px; }
.omni-chronos-panel[data-mode=mobile] .chr-mon { flex: 0 0 auto; }
.omni-chronos-panel[data-mode=mobile] .chr-tc { font-size: 34px; }
.omni-chronos-panel[data-mode=mobile] .chr-tbtn { min-width: 44px; height: 44px; }
.omni-chronos-panel[data-mode=mobile] .chr-tsel { height: 44px; }
.omni-chronos-panel[data-mode=mobile] .chr-info { max-height: none; }
.omni-chronos-panel[data-mode=desktop].is-short .chr-info { max-height: 130px; }

/* SETTINGS (the original staged-save toggles) */
.chr-body { padding: 14px; }

.chr-tagline {
  font-size        : 10px;
  font-style       : italic;
  color            : var(--oc-text-muted);
  margin-bottom    : 14px;
  text-align       : center;
}

.chr-row {
  display          : flex;
  align-items      : center;
  justify-content  : space-between;
  gap              : 10px;
  padding          : 10px 0;
  border-bottom    : 1px solid rgba(255,255,255,0.06);
  max-width        : 520px;
  margin           : 0 auto;
}
.chr-row:last-of-type { border-bottom: none; }
.chr-row-label { font-size: 10.5px; color: var(--oc-text-dim); }
.chr-row-sub { font-size: 8.5px; color: var(--oc-text-muted); margin-top: 2px; }

.chr-primary-time {
  display: flex; align-items: center; justify-content: space-between; max-width: 520px; margin: 10px auto 0;
  padding-top: 10px; border-top: 1px solid var(--oc-border);
}
.oc-clock-display {
  font-family: var(--mono); font-size: 20px; color: var(--oc-accent); letter-spacing: 0.05em;
}
.chr-play-btn {
  background: rgba(255,210,127,0.15); border: 1px solid var(--oc-accent);
  color: var(--oc-accent); font-family: var(--mono); font-size: 11px;
  padding: 6px 12px; border-radius: 5px; cursor: pointer;
}
.chr-play-btn:hover { background: rgba(255,210,127,0.25); }

.chr-toggle {
  width            : 34px;
  height           : 18px;
  border-radius    : 10px;
  border           : 1px solid var(--oc-border);
  background       : rgba(255,255,255,0.08);
  position         : relative;
  cursor           : pointer;
  flex-shrink      : 0;
}
.chr-toggle::after {
  content          : '';
  position         : absolute;
  top              : 1px; left: 1px;
  width            : 14px; height: 14px;
  border-radius    : 50%;
  background       : var(--oc-text-dim);
  transition       : transform 0.15s ease, background 0.15s ease;
}
.chr-toggle.is-on { background: rgba(255, 210, 127, 0.3); border-color: rgba(255, 210, 127, 0.5); }
.chr-toggle.is-on::after { transform: translateX(16px); background: var(--oc-accent); }

.chr-resize-handle { position: absolute; right: 0; bottom: 0; width: 18px; height: 18px; cursor: nwse-resize; touch-action: none; z-index: 30; }
.chr-resize-handle::before {
  content: ''; position: absolute; right: 3px; bottom: 3px; width: 8px; height: 8px;
  border-right: 2px solid rgba(255,255,255,0.25); border-bottom: 2px solid rgba(255,255,255,0.25);
}

@media (max-width: ${PHONE_MAX}px) {
  .omni-chronos-panel { left: 0 !important; width: 100vw !important; min-width: 0; border-radius: 0; border-left: 0; border-right: 0; }
  .chr-resize-handle { display: none; }
}
`

function injectStyles () {
  if (document.getElementById('omni-chronos-styles')) return
  const tag = document.createElement('style')
  tag.id = 'omni-chronos-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

export default class OmniChronos {
  constructor (context) {
    this.ctx = context
    this._el = null
    this._isOpen = false
    this._drag = { active: false, startX: 0, startY: 0, originX: 0, originY: 0 }

    this._saved = loadSettings()
    this._staged = structuredClone(this._saved)   // what the form shows, pre-save
    this._onNavSelect = null
    this._bound = []
    this._view = null
    this._tab = 'edit'
    this._hover = false
    this._tcShown = ''
    this._nowAt = 0
    this._infoRaf = 0
    this._placed = false
  }

  init () {
    injectStyles()
    this._onNavSelect = (e) => {
      if (e.detail?.item !== '⟐OmniChronos') return
      this.open()
    }
    window.addEventListener('omni:nav-select', this._onNavSelect)

    // Apply whatever was already saved from a previous session, on boot
    // — RootSpace's own defaults match DEFAULTS above, so this is only
    // meaningfully different when the user has customized it before.
    window.dispatchEvent(new CustomEvent('omni:chronos-toggle', { detail: { enabled: this._saved.enabled } }))
    window.dispatchEvent(new CustomEvent('omni:chronos-axis-set', { detail: { axis: this._saved.zAxis ? 'z' : 'y' } }))
    window.dispatchEvent(new CustomEvent('omni:chronos-transparency-set', { detail: { enabled: this._saved.transparency } }))
  }

  update (delta) {
    PrimaryTime.advance(delta)
    if (this._isOpen) this._updateClockDisplay()
  }
  onResize () { if (this._isOpen) this._fitToViewport(false) }

  destroy () {
    window.removeEventListener('omni:nav-select', this._onNavSelect)
    for (const [t, n, f, o] of this._bound) t.removeEventListener(n, f, o)
    this._bound.length = 0
    cancelAnimationFrame(this._infoRaf)
    this._view?.destroy(); this._view = null
    this._el?.parentNode?.removeChild(this._el)
    WindowManager.unregister('omnichronos')
  }

  _on (target, name, fn, opts) { target.addEventListener(name, fn, opts); this._bound.push([target, name, fn, opts]) }

  open () {
    if (!this._el) this._el = this._buildDOM()
    const shell = document.getElementById('omni-ui') ?? document.body
    shell.appendChild(this._el)
    this._el.style.visibility = 'visible'
    this._syncTransport()
    this._fitToViewport(!this._placed)
    this._placed = true
    gsap.to(this._el, { opacity: WindowManager.getPanelOpacity(), scale: 1, duration: 0.28, ease: 'back.out(1.4)' })
    this._isOpen = true
    this._view?.renderNow()
    this._renderInfo()
    this._playSound('open')
  }

  close () {
    if (!this._el) return
    gsap.to(this._el, {
      opacity: 0, scale: 0.94, duration: 0.18, ease: 'power1.in',
      onComplete: () => { this._el.style.visibility = 'hidden' },
    })
    this._isOpen = false
    this._hover = false
    this._playSound('close')
  }

  minimize () {
    if (!this._el) return
    const rect = this._el.getBoundingClientRect()
    gsap.to(this._el, {
      opacity: 0, scale: 0.3, duration: 0.22, ease: 'power2.in',
      onComplete: () => { this._el.style.visibility = 'hidden' },
    })
    this._isOpen = false
    this._hover = false
    this._playSound('close')
    window.dispatchEvent(new CustomEvent('omni:panel-minimized', {
      detail: {
        id: 'omnichronos', label: '⟐OmniChronos', iconLabel: '⟐C',
        fromRect: { x: rect.left, y: rect.top, w: rect.width, h: rect.height },
        variant: 'app',
      }
    }))
  }

  isMobile () { return (window.innerWidth || 1280) <= PHONE_MAX }

  /** Size / place the window so it clears the GlobalBar + ribbon (top) and the Dock (bottom) and stays on screen. */
  _fitToViewport (initial) {
    const el = this._el
    if (!el) return
    const vw = window.innerWidth || 1280, vh = window.innerHeight || 720
    const top = getTopOffset() + 6
    const free = Math.max(300, vh - top - DOCK_H - 6)
    this._applyMode()
    if (this.isMobile()) {
      gsap.set(el, { left: 0, top, width: vw, height: free })
      return
    }
    const rect = el.getBoundingClientRect()
    if (initial) {
      const w = Math.min(940, vw - 16), h = Math.min(560, free)
      gsap.set(el, { width: w, height: h, left: Math.max(8, Math.round((vw - w) / 2)), top })
      return
    }
    // keep inside the viewport after a resize
    const w = Math.min(rect.width || 940, vw - 8), h = Math.min(rect.height || 540, free)
    const left = Math.min(Math.max(0, rect.left), Math.max(0, vw - w)), tp = Math.min(Math.max(top - 6, rect.top), Math.max(top - 6, vh - DOCK_H - h))
    gsap.set(el, { width: w, height: h, left, top: tp })
    el.classList.toggle('is-short', h < 480)
  }

  _applyMode () {
    const el = this._el
    if (!el) return
    const mobile = this.isMobile()
    const mode = mobile ? 'mobile' : 'desktop'
    if (el.dataset.mode !== mode) {
      el.dataset.mode = mode
      if (mobile && this._tab === 'edit') this._tab = 'player'
      if (!mobile && (this._tab === 'player' || this._tab === 'timeline')) this._tab = 'edit'
      this._setTab(this._tab)
    }
  }

  _setTab (tab) {
    this._tab = tab
    const el = this._el
    if (!el) return
    el.dataset.tab = tab
    el.querySelectorAll('.chr-tab').forEach(b => {
      const on = b.dataset.tab === tab
      b.classList.toggle('is-active', on)
      b.setAttribute('aria-selected', String(on))
    })
    if (tab === 'edit' || tab === 'timeline') { this._view?.renderNow() }
    if (tab !== 'settings') { this._tcShown = ''; this._updateMonitor(true); this._renderInfo() }
  }

  // ── Program monitor (the PLAYER) ──────────────────────────────────────────

  /** Live, real clock text — reads PrimaryTime's actual current value every frame while open. */
  _updateClockDisplay () {
    const display = this._el?.querySelector('#oc-clock-display')
    if (display) display.textContent = formatSeconds(PrimaryTime.getCurrentSeconds(), this._saved.timeFormat)
    if (this._tab !== 'settings') this._updateMonitor(false)
  }

  _updateMonitor (force) {
    const el = this._el
    if (!el) return
    const t = PrimaryTime.getCurrentSeconds()
    const tc = TL.toTimecode(t)
    if (tc !== this._tcShown || force) {
      this._tcShown = tc
      const q = (s) => el.querySelector(s)
      q('.chr-tc').textContent = tc
      q('[data-r="clock"]').textContent = `Clock ${formatSeconds(t, this._saved.timeFormat)}`
      q('[data-r="secs"]').textContent = `${t.toFixed(2)} s · day ${Math.floor(t / DAY)}`
      q('[data-r="day"]').style.width = `${((t % DAY) / DAY * 100).toFixed(2)}%`
      q('[data-r="dayl"]').textContent = `Tunnel height ${((t % DAY) / DAY * 100).toFixed(1)}%`
    }
    // "now playing" a few times a second (not every frame)
    const now = performance.now()
    if (force || now - this._nowAt > 250) {
      this._nowAt = now
      const names = []
      const tracks = new Map(TL.getTracks().map(x => [x.id, x]))
      const solo = TL.getTracks().some(x => x.solo)
      for (const c of TL.getClips()) {
        const tr = tracks.get(c.trackId)
        if (!tr || tr.muted || (solo && !tr.solo)) continue
        if (t >= c.start && t < c.start + c.duration) names.push(c.label)
      }
      const nowEl = el.querySelector('[data-r="now"]')
      const txt = names.length ? `Active: ${names.slice(0, 4).join(', ')}${names.length > 4 ? ` +${names.length - 4}` : ''}` : (TL.getClips().length ? 'Active: none at the playhead' : 'No clips yet — add a node in the TIMELINE')
      if (nowEl.textContent !== txt) nowEl.textContent = txt
    }
  }

  _syncTransport () {
    const el = this._el
    if (!el) return
    const playing = PrimaryTime.isPlaying()
    const pb = el.querySelector('[data-t="play"]')
    pb.textContent = playing ? '❚❚' : '▶'
    pb.classList.toggle('is-on', playing)
    pb.setAttribute('aria-pressed', String(playing))
    const sp = el.querySelector('[data-r="speed"]')
    const v = String(PrimaryTime.getSpeed())
    if (![...sp.options].some(o => o.value === v)) { const o = el.ownerDocument.createElement('option'); o.value = v; o.textContent = `${+PrimaryTime.getSpeed().toFixed(2)}×`; sp.appendChild(o) }
    sp.value = v
    el.querySelector('[data-t="loop"]').classList.toggle('is-on', TL.getState().loop)
    const sb = el.querySelector('#oc-play-pause')
    if (sb) sb.textContent = playing ? '⏸ Pause' : '▶ Play'
  }

  _playerHTML () {
    return /* html */`
      <div class="chr-player">
        <div class="chr-mon" aria-label="Program monitor">
          <div class="chr-tc" aria-live="off">00:00:00:00</div>
          <div class="chr-sub"><span data-r="clock">Clock 00:00</span><span data-r="secs">0.00 s</span></div>
          <div class="chr-day" title="Where the travelling reality node is in the tunnel: one trip per 24 h of Primary Time"><i data-r="day"></i></div>
          <div class="chr-sub"><span data-r="dayl">Tunnel height 0%</span><span>30 fps</span></div>
          <div class="chr-trans" role="toolbar" aria-label="Transport">
            <button class="chr-tbtn" data-t="start" title="Go to start (Home) — the work-area in point if set">⇤</button>
            <button class="chr-tbtn" data-t="back" title="Step back one frame (←) — Shift+← one second">◂</button>
            <button class="chr-tbtn chr-tbtn--play" data-t="play" title="Play / pause Primary Time (Space)">▶</button>
            <button class="chr-tbtn" data-t="fwd" title="Step forward one frame (→) — Shift+→ one second">▸</button>
            <button class="chr-tbtn" data-t="end" title="Go to the end (End) — the work-area out point, else the last clip end">⇥</button>
            <button class="chr-tbtn" data-t="loop" title="Loop: when playing reaches the work-area out point (or the last clip end) go back to the in point">↻</button>
            <select class="chr-tsel" data-r="speed" title="Speed of Primary Time (also moves the floor clock and the reality node faster / slower)">
              ${TL.SPEEDS.map(s => `<option value="${s}">${s}×</option>`).join('')}
            </select>
            <button class="chr-tbtn" data-t="in" title="Set work-area in point at the playhead (I)">I</button>
            <button class="chr-tbtn" data-t="out" title="Set work-area out point at the playhead (O)">O</button>
            <button class="chr-tbtn" data-t="mark" title="Add a marker at the playhead (M)">⚑</button>
          </div>
          <div class="chr-now" data-r="now"></div>
        </div>
        <div class="chr-info" data-r="info"></div>
      </div>`
  }

  // ── Project / selected clip strip (Premiere's effect controls, small) ─────

  _scheduleInfo () {
    if (this._infoRaf) return
    this._infoRaf = requestAnimationFrame(() => { this._infoRaf = 0; this._renderInfo() })
  }

  _renderInfo () {
    const root = this._el?.querySelector('[data-r="info"]')
    if (!root) return
    const act = document.activeElement
    if (act && root.contains(act) && (act.tagName === 'INPUT' || act.tagName === 'SELECT') && this._infoTyping) return
    root.textContent = ''
    const ids = this._view ? [...this._view.sel.clips] : []
    const clip = ids.length === 1 ? TL.getClip(ids[0]) : null
    if (!clip) {
      const st = TL.getState()
      root.append(el('h4', null, ids.length > 1 ? `${ids.length} CLIPS SELECTED` : 'PROJECT'))
      const pl = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`
      root.append(el('div', 'muted', `${pl(st.tracks.length, 'track')} · ${pl(st.clips.length, 'clip')} · ${pl(st.keys.length, 'keyframe')} · ${pl(st.markers.length, 'marker')}`))
      const wa = st.workArea
      root.append(el('div', 'muted', `Work area: ${wa.in != null ? TL.toTimecode(wa.in) : 'start'} → ${wa.out != null ? TL.toTimecode(wa.out) : 'end'}   ·   Snap ${st.snap ? 'on' : 'off'}`))
      for (const m of [...st.markers].sort((a, b) => a.t - b.t).slice(0, 6)) {
        const r = el('div', 'kr')
        const go = el('button', null, `⚑ ${TL.toTimecode(m.t)}`); go.title = 'Jump to this marker'
        go.addEventListener('click', () => { ev('omni:timeline-seek', { t: m.t }) })
        r.append(go, el('span', null, m.name))
        root.append(r)
      }
      if (!st.clips.length) root.append(el('div', 'muted', 'Tip: select a node in the scene → ＋ Selected. Or open the Inspector’s Time section.'))
      return
    }
    root.append(el('h4', null, 'SELECTED CLIP'))
    const field = (label, type, value, onChange, attrs = {}) => {
      const wrap = el('span'); wrap.append(el('label', null, label + ' '))
      const i = el('input'); i.type = type; Object.assign(i, attrs)
      if (type === 'checkbox') i.checked = !!value; else i.value = value
      i.addEventListener('focus', () => { this._infoTyping = true })
      i.addEventListener('blur', () => { this._infoTyping = false })
      i.addEventListener('change', () => { this._infoTyping = false; onChange(type === 'checkbox' ? i.checked : i.value) })
      wrap.append(i); return wrap
    }
    const r1 = el('div', 'row')
    r1.append(field('Name', 'text', clip.label, v => TL.updateClip(clip.id, { label: v })), field('Colour', 'color', clip.color, v => TL.updateClip(clip.id, { color: v })), field('Loop', 'checkbox', clip.loop, v => TL.updateClip(clip.id, { loop: v })))
    const r2 = el('div', 'row')
    const num = (label, key, min) => field(label, 'number', +clip[key].toFixed(3), v => { const n = parseFloat(v); if (Number.isFinite(n)) { TL.updateClip(clip.id, { [key]: n }); getPlayer()?.evaluateNow() } }, { step: 0.1, min })
    r2.append(num('Start', 'start', 0), num('Dur', 'duration', TL.MIN_DUR), num('In', 'inPoint', 0))
    const tr = el('span'); tr.append(el('label', null, 'Track '))
    const ts = el('select')
    for (const t of TL.getTracks().filter(x => x.kind === 'node')) { const o = el('option', null, t.name); o.value = t.id; ts.appendChild(o) }
    ts.value = clip.trackId
    ts.addEventListener('change', () => TL.updateClip(clip.id, { trackId: ts.value }))
    tr.append(ts); r2.append(tr)
    root.append(r1, r2)
    const keys = TL.getKeysForClip(clip.id)
    root.append(el('div', 'muted', `${keys.length} keyframe${keys.length === 1 ? '' : 's'} · ${TL.toTimecode(clip.start)} → ${TL.toTimecode(clip.start + clip.duration)}`))
    for (const k of keys.slice(0, 40)) {
      const p = TL.getKeyProp(k.property)
      const r = el('div', 'kr')
      const tt = clip.start + (k.t - clip.inPoint)
      const go = el('button', null, TL.toTimecode(tt)); go.title = 'Jump to this keyframe'
      go.addEventListener('click', () => ev('omni:timeline-seek', { t: tt }))
      r.append(go, el('span', null, p?.label ?? k.property))
      const vi = el('input'); vi.type = p?.kind === 'color' ? 'color' : 'number'
      if (p?.kind !== 'color') { vi.step = String(p?.step ?? 0.1); if (p?.min != null) vi.min = String(p.min); if (p?.max != null) vi.max = String(p.max); vi.value = String(+k.value.toFixed(3)) } else vi.value = k.value
      vi.addEventListener('focus', () => { this._infoTyping = true }); vi.addEventListener('blur', () => { this._infoTyping = false })
      vi.addEventListener('change', () => { this._infoTyping = false; TL.updateKey(k.id, { value: p?.kind === 'color' ? vi.value : parseFloat(vi.value) }); getPlayer()?.evaluateNow() })
      const es = el('select')
      for (const z of TL.EASES) { const o = el('option', null, z); o.value = z; es.appendChild(o) }
      es.value = k.ease
      es.addEventListener('change', () => TL.updateKey(k.id, { ease: es.value }))
      const del = el('button', null, '✕'); del.title = 'Delete keyframe'
      del.addEventListener('click', () => { TL.removeKey(k.id); getPlayer()?.evaluateNow() })
      r.append(vi, es, del)
      root.append(r)
    }
  }

  // ── Transport wiring (every button speaks the same events as the ribbon) ──

  _bindTransport (el) {
    el.querySelector('.chr-trans').addEventListener('click', (e) => {
      const b = e.target.closest('[data-t]')
      if (!b) return
      const wa = TL.getState().workArea
      switch (b.dataset.t) {
        case 'start': ev('omni:timeline-seek', { t: wa.in ?? 0 }); break
        case 'back': ev('omni:timeline-step', { frames: -1 }); break
        case 'play': ev('omni:timeline-play-set', { toggle: true }); break
        case 'fwd': ev('omni:timeline-step', { frames: 1 }); break
        case 'end': ev('omni:timeline-seek', { t: wa.out ?? getPlayer()?.projectEnd() ?? 0 }); break
        case 'loop': TL.setLoop(!TL.getState().loop); break
        case 'in': { const o = wa.out; TL.setWorkArea(TL.getT(), o != null && o > TL.getT() ? o : null); break }
        case 'out': { const i = wa.in; const t = TL.getT(); TL.setWorkArea(i != null && i < t ? i : null, t); break }
        case 'mark': ev('omni:timeline-marker-add', { t: TL.getT() }); break
      }
    })
    el.querySelector('[data-r="speed"]').addEventListener('change', (e) => TL.setSpeed(parseFloat(e.target.value)))
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
    el.className = 'omni-chronos-panel'
    el.dataset.mode = this.isMobile() ? 'mobile' : 'desktop'
    this._tab = this.isMobile() ? 'player' : 'edit'
    el.dataset.tab = this._tab
    const s = this._staged
    el.innerHTML = /* html */`
      <div class="chr-header">
        <span class="chr-title">⟐OmniChronos</span>
        <div class="chr-controls">
          <button class="chr-ctrl chr-ctrl--save" data-action="save" title="Save the SETTINGS tab (tunnel toggles)">💾</button>
          <button class="chr-ctrl" data-action="minimize" title="Minimize">–</button>
          <button class="chr-ctrl" data-action="maximize" title="Maximize">▢</button>
          <button class="chr-ctrl" data-action="close" title="Close">×</button>
        </div>
      </div>
      <div class="oc-unsaved-banner" id="oc-unsaved-banner">⚠ Unsaved changes — click 💾 to apply</div>
      <div class="chr-tabs" role="tablist">
        <button class="chr-tab desk-only" data-tab="edit" role="tab">EDITOR</button>
        <button class="chr-tab mob-only" data-tab="player" role="tab">PLAYER</button>
        <button class="chr-tab mob-only" data-tab="timeline" role="tab">TIMELINE</button>
        <button class="chr-tab" data-tab="settings" role="tab">SETTINGS</button>
        <span class="chr-tab-hint desk-only">Playhead = Primary Time · keys work while the pointer is over this window</span>
      </div>
      <div class="chr-views">
        <div class="chr-view chr-view-player" data-v="player">${this._playerHTML()}</div>
        <div class="chr-view chr-view-timeline" data-v="timeline"></div>
        <div class="chr-view chr-view-settings" data-v="settings">
          <div class="chr-body">
            <div class="chr-tagline">It is time.</div>

            <div class="chr-row">
              <div>
                <div class="chr-row-label">Tunnel Enabled</div>
                <div class="chr-row-sub">Light-teleport transition in/out</div>
              </div>
              <button class="chr-toggle ${s.enabled ? 'is-on' : ''}" data-key="enabled" role="switch" aria-checked="${s.enabled}"></button>
            </div>

            <div class="chr-row">
              <div>
                <div class="chr-row-label">Z-axis Mode</div>
                <div class="chr-row-sub">Vertical → Z-axis, radius ×1.5</div>
              </div>
              <button class="chr-toggle ${s.zAxis ? 'is-on' : ''}" data-key="zAxis" role="switch" aria-checked="${s.zAxis}"></button>
            </div>

            <div class="chr-row">
              <div>
                <div class="chr-row-label">Transparency</div>
                <div class="chr-row-sub">"Clear and almost non-existent, but there"</div>
              </div>
              <button class="chr-toggle ${s.transparency ? 'is-on' : ''}" data-key="transparency" role="switch" aria-checked="${s.transparency}"></button>
            </div>

            <div class="chr-row">
              <div>
                <div class="chr-row-label">Time Format</div>
                <div class="chr-row-sub">Both real, switchable — neither replaces the other</div>
              </div>
              <button class="chr-toggle ${s.timeFormat === 'ampm' ? 'is-on' : ''}" data-key="timeFormatToggle" role="switch" aria-checked="${s.timeFormat === 'ampm'}"></button>
            </div>

            <div class="chr-primary-time">
              <div class="oc-clock-display" id="oc-clock-display">00:00</div>
              <button class="chr-play-btn" id="oc-play-pause">${PrimaryTime.isPlaying() ? '⏸ Pause' : '▶ Play'}</button>
            </div>
          </div>
        </div>
      </div>
      <div class="chr-resize-handle" aria-hidden="true"></div>
    `

    el.querySelector('#oc-play-pause').addEventListener('click', () => ev('omni:timeline-play-set', { toggle: true }))
    el.querySelectorAll('.chr-tab').forEach(b => b.addEventListener('click', () => this._setTab(b.dataset.tab)))

    this._bindHeader(el)
    this._bindResize(el)
    this._bindControls(el)
    this._bindTransport(el)

    el.querySelector('[data-action="minimize"]').addEventListener('click', () => this.minimize())
    el.querySelector('[data-action="close"]').addEventListener('click', () => this.close())
    el.querySelector('[data-action="save"]').addEventListener('click', () => this._save())
    WindowManager.makeMaximizable(el, el.querySelector('[data-action="maximize"]'), { onMaximize: () => this._view?.renderNow(), onRestore: () => this._view?.renderNow() })

    el.dataset.winId = 'omnichronos'
    WindowManager.register('omnichronos', el, 'OmniChronos')
    WindowManager.watchPanelOpacity(el, () => this._isOpen)

    // the sequencer (timeline view)
    this._view = new OmniTimelineView({ onRender: () => {} })
    this._view.mount(el.querySelector('.chr-view-timeline'))

    // keep the monitor / transport / info strip in step with the data (events, never polling)
    this._on(window, 'omni:primarytime-state', () => this._syncTransport())
    this._on(window, 'omni:timeline-changed', (e) => { this._syncTransport(); this._tcShown = ''; if (e.detail?.kind !== 'view') this._scheduleInfo() })
    this._on(window, 'omni:timeline-selection', () => this._scheduleInfo())
    this._on(window, 'omni:timeline-playhead', () => { this._tcShown = ''; if (this._isOpen && this._tab !== 'settings') this._updateMonitor(false) })
    this._syncTransport()

    // keyboard: only while hovered / focused; capture + stopImmediatePropagation so the global single-key handlers (m, c, ...) stay quiet
    this._on(el, 'mouseenter', () => { this._hover = true })
    this._on(el, 'mouseleave', () => { this._hover = false })
    this._on(window, 'keydown', (e) => this._onKey(e), true)

    // size changes (drag-resize, maximize, window resize) re-lay out the timeline
    if (typeof ResizeObserver !== 'undefined') { const ro = new ResizeObserver(() => { el.classList.toggle('is-short', el.clientHeight < 480); this._view?.renderNow() }); ro.observe(el); this._ro = ro }
    return el
  }

  _onKey (e) {
    if (!this._isOpen || !this._view || this._tab === 'settings') return
    const t = e.target
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return
    if (t && t.tagName === 'BUTTON' && (e.key === ' ' || e.key === 'Enter')) return
    if (!(this._hover || this._el.contains(document.activeElement))) return
    if (this._tab === 'player' && this.isMobile()) { /* transport keys still apply on the PLAYER tab */ }
    if (this._view.handleKey(e)) { e.preventDefault(); e.stopImmediatePropagation() }
  }

  _bindControls (el) {
    el.querySelectorAll('.chr-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.dataset.key === 'timeFormatToggle') {
          const nextFormat = this._staged.timeFormat === 'ampm' ? 'military' : 'ampm'
          this._setStaged('timeFormat', nextFormat)
          btn.classList.toggle('is-on', nextFormat === 'ampm')
          btn.setAttribute('aria-checked', String(nextFormat === 'ampm'))
          return
        }
        const next = !this._staged[btn.dataset.key]
        this._setStaged(btn.dataset.key, next)
        btn.classList.toggle('is-on', next)
        btn.setAttribute('aria-checked', String(next))
      })
    })
  }

  /** Sets a key on the staged object and shows the unsaved-changes
   *  banner — nothing applied to RootSpace yet, matching AdminPanel's
   *  exact save pattern (explicit request). */
  _setStaged (key, value) {
    this._staged[key] = value
    const banner = this._el?.querySelector('#oc-unsaved-banner')
    banner?.classList.add('is-visible')
  }

  /** Save button — the ONLY place staged changes take effect:
   *  persisted to localStorage and broadcast to RootSpace. */
  _save () {
    this._saved = structuredClone(this._staged)
    const banner = this._el?.querySelector('#oc-unsaved-banner')

    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(this._saved))
      banner?.classList.remove('is-visible')
    } catch (err) {
      console.warn('⟐Chronos — localStorage save failed:', err)
      if (banner) banner.textContent = '⚠ Save failed'
    }

    window.dispatchEvent(new CustomEvent('omni:chronos-toggle', { detail: { enabled: this._saved.enabled } }))
    window.dispatchEvent(new CustomEvent('omni:chronos-axis-set', { detail: { axis: this._saved.zAxis ? 'z' : 'y' } }))
    window.dispatchEvent(new CustomEvent('omni:chronos-transparency-set', { detail: { enabled: this._saved.transparency } }))
    this._tcShown = ''
  }

  // ── Header drag / resize — same pattern as every other panel ─────────────

  _bindHeader (el) {
    const header = el.querySelector('.chr-header')
    const onDown = (e) => {
      if (e.target.closest('button') || el.classList.contains('win-maximized') || this.isMobile()) return
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
      const top = Math.max(getTopOffset() - 4, this._drag.originY + (cy - this._drag.startY))
      gsap.set(el, { left: this._drag.originX + (cx - this._drag.startX), top })
    }
    const onUp = () => { this._drag.active = false; header.classList.remove('is-dragging') }

    header.addEventListener('mousedown', onDown)
    this._on(window, 'mousemove', onMove)
    this._on(window, 'mouseup', onUp)
    header.addEventListener('touchstart', onDown, { passive: true })
    this._on(window, 'touchmove', onMove, { passive: true })
    this._on(window, 'touchend', onUp)
  }

  _bindResize (el) {
    const handle = el.querySelector('.chr-resize-handle')
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
      gsap.set(el, { width: Math.max(420, resize.startW + (cx - resize.startX)), height: Math.max(300, resize.startH + (cy - resize.startY)) })
    }
    const onUp = () => { resize.active = false }
    handle.addEventListener('mousedown', onDown)
    this._on(window, 'mousemove', onMove)
    this._on(window, 'mouseup', onUp)
    handle.addEventListener('touchstart', onDown, { passive: true })
    this._on(window, 'touchmove', onMove, { passive: true })
    this._on(window, 'touchend', onUp)
  }
}
