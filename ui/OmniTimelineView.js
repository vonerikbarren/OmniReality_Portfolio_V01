/**
 * ui/OmniTimelineView.js — the Premiere-style sequencer (V172). A view over utils/OmniTimeline.js (the data) and
 * systems/OmniTimelinePlayer.js (the evaluation); it holds no timeline data of its own, only selection and view state.
 *
 *   toolbar     Add node… · ＋ Selected · Split (C) · Duplicate · Delete · ◇ Key + property · Marker · Snap · ＋ Track · zoom
 *   ruler       one <canvas>, ticks adapt to zoom (frames -> seconds -> minutes -> hours), markers, work-area bar, red playhead head
 *   headers     track name (double-click to rename), M mute · S solo · L lock, ▸ expand the keyframe sub-lanes
 *   lanes       clips as coloured blocks (drag = move, edges = trim, snapping), keyframe diamonds on the sub-lanes
 *   playhead    ONE line inside the scrolling content and ONE head on the ruler, moved with transform only
 *
 * Rendering: DOM with keyed element pools, culled to the visible time / row range (100+ clips stay cheap); the
 * ruler is a single canvas redrawn on scroll / zoom / resize only (never per playing frame).
 * Touch: pointer events everywhere, touch-action:none on clips / handles / ruler; empty lane area scrolls natively;
 * two-finger pinch zooms (best effort) and the zoom buttons always work.
 *
 * Keyboard (handled via handleKey(), which ui/OmniChronos.js only calls while the window is hovered / focused):
 *   Space play/pause · ←/→ one frame (Shift: one second) · Home/End · I/O work area · M marker · C split · Delete · +/- zoom
 */

import * as TL from '../utils/OmniTimeline.js'
import { getPlayer, listNodes, nodeInfo, getNodeValue, getSelectedNodeId } from '../systems/OmniTimelinePlayer.js'

const ROW_H = 40
const SUB_H = 18
const HEAD_W = 150
const RULER_H = 26
const MIN_CLIP_PX = 4
const SNAP_PX = 8
const TRIM_PX = 7
const MAX_CONTENT_W = 4_000_000

const STYLES = /* css */`
.otv {
  --otv-bg      : var(--omni-theme-bg, #1e1e1e);
  --otv-text    : var(--omni-theme-text, #d8d8d8);
  --otv-dim     : var(--omni-theme-text-dim, #a8a8a8);
  --otv-muted   : var(--omni-theme-text-muted, #808080);
  --otv-border  : var(--omni-theme-border, rgba(255,255,255,0.12));
  --otv-accent  : var(--omni-theme-accent, #ffd27f);
  --otv-play    : #ff453a;
  --otv-panel   : color-mix(in srgb, var(--otv-text) 7%, transparent);
  --otv-lane-a  : color-mix(in srgb, var(--otv-text) 3%, transparent);
  --otv-lane-b  : color-mix(in srgb, var(--otv-text) 6%, transparent);
  --otv-hover   : color-mix(in srgb, var(--otv-text) 14%, transparent);
  position: relative; display: flex; flex-direction: column; min-height: 0; flex: 1 1 auto;
  color: var(--otv-text); font: 11px 'Courier New', Courier, monospace; user-select: none; -webkit-user-select: none;
}
.otv * { box-sizing: border-box; }
.otv-tools { flex: 0 0 auto; display: flex; flex-wrap: wrap; align-items: center; gap: 4px; padding: 4px 6px; border-bottom: 1px solid var(--otv-border); background: var(--otv-panel); }
.otv-tools .sp { flex: 1 1 auto; }
.otv-tools .sep { width: 1px; height: 18px; background: var(--otv-border); margin: 0 2px; }
.otv-btn { min-width: 26px; height: 24px; padding: 0 7px; border-radius: 4px; border: 1px solid var(--otv-border); background: transparent; color: var(--otv-dim); font: inherit; cursor: pointer; white-space: nowrap; }
.otv-btn:hover { background: var(--otv-hover); color: var(--otv-text); }
.otv-btn.is-on { background: color-mix(in srgb, var(--otv-accent) 22%, transparent); border-color: var(--otv-accent); color: var(--otv-accent); }
.otv-btn:disabled { opacity: .4; cursor: default; }
.otv-sel { height: 24px; max-width: 150px; border-radius: 4px; border: 1px solid var(--otv-border); background: var(--otv-bg); color: var(--otv-text); font: inherit; padding: 0 4px; }
.otv-main { position: relative; flex: 1 1 auto; min-height: 0; display: grid; grid-template-columns: ${HEAD_W}px minmax(0, 1fr); grid-template-rows: ${RULER_H}px minmax(0, 1fr); }
.otv-corner { border-right: 1px solid var(--otv-border); border-bottom: 1px solid var(--otv-border); background: var(--otv-panel); display: flex; align-items: center; justify-content: center; color: var(--otv-muted); font-size: 10px; letter-spacing: .06em; }
.otv-ruler { position: relative; overflow: hidden; border-bottom: 1px solid var(--otv-border); background: var(--otv-panel); touch-action: none; cursor: ew-resize; }
.otv-ruler canvas { position: absolute; left: 0; top: 0; width: 100%; height: 100%; display: block; }
.otv-rlayer { position: absolute; left: 0; top: 0; height: 100%; width: 0; will-change: transform; pointer-events: none; }
.otv-wa { position: absolute; bottom: 0; height: 5px; background: color-mix(in srgb, var(--otv-accent) 55%, transparent); border-radius: 2px 2px 0 0; }
.otv-mk { position: absolute; top: 0; width: 0; height: 100%; pointer-events: none; }
.otv-mk > b { position: absolute; left: -5px; top: 2px; width: 10px; height: 12px; background: var(--c, #e0a030); clip-path: polygon(0 0, 100% 0, 100% 60%, 50% 100%, 0 60%); pointer-events: auto; cursor: pointer; touch-action: none; }
.otv-mk.is-sel > b { outline: 1px solid #fff; }
.otv-head { position: absolute; top: 0; left: 0; width: 0; height: 100%; pointer-events: none; will-change: transform; z-index: 3; }
.otv-head > i { position: absolute; left: -7px; top: 0; width: 14px; height: 16px; background: var(--otv-play); clip-path: polygon(0 0, 100% 0, 100% 55%, 50% 100%, 0 55%); pointer-events: auto; cursor: ew-resize; touch-action: none; }
.otv-head::after { content: ''; position: absolute; left: 0; top: 16px; bottom: 0; width: 1px; background: var(--otv-play); }
.otv-heads { position: relative; overflow: hidden; border-right: 1px solid var(--otv-border); background: var(--otv-panel); }
.otv-hin { position: absolute; left: 0; top: 0; width: 100%; will-change: transform; }
.otv-th { position: absolute; left: 0; width: 100%; border-bottom: 1px solid var(--otv-border); padding: 3px 4px 0 4px; }
.otv-th.is-sub { padding-left: 24px; color: var(--otv-muted); font-size: 10px; display: flex; align-items: center; background: color-mix(in srgb, var(--otv-text) 4%, transparent); }
.otv-th .r1 { display: flex; align-items: center; gap: 3px; height: 20px; }
.otv-th .nm { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--otv-text); }
.otv-th input.nm { width: 100%; font: inherit; background: var(--otv-bg); color: var(--otv-text); border: 1px solid var(--otv-accent); }
.otv-th .tg { width: 18px; height: 18px; padding: 0; border-radius: 3px; border: 1px solid var(--otv-border); background: transparent; color: var(--otv-muted); font: 10px 'Courier New', monospace; cursor: pointer; }
.otv-th .tg.is-on[data-a=mute] { background: #b3412c; color: #fff; border-color: #b3412c; }
.otv-th .tg.is-on[data-a=solo] { background: #c7a026; color: #111; border-color: #c7a026; }
.otv-th .tg.is-on[data-a=lock] { background: #4a6fa5; color: #fff; border-color: #4a6fa5; }
.otv-th .ex { width: 14px; padding: 0; border: 0; background: transparent; color: var(--otv-dim); cursor: pointer; font-size: 10px; }
.otv-th .ct { font-size: 9px; color: var(--otv-muted); padding-left: 17px; }
.otv-scroll { position: relative; overflow: auto; background: var(--otv-bg); touch-action: pan-x pan-y; overscroll-behavior: contain; }
.otv-content { position: relative; }
.otv-lane { position: absolute; left: 0; right: 0; border-bottom: 1px solid var(--otv-border); background: var(--otv-lane-a); }
.otv-lane.alt { background: var(--otv-lane-b); }
.otv-lane.is-sub { background: color-mix(in srgb, var(--otv-text) 2%, transparent); border-bottom-style: dotted; }
.otv-lane.is-muted { opacity: .5; }
.otv-clip { position: absolute; height: ${ROW_H - 8}px; border-radius: 3px; overflow: hidden; background: var(--c, #7b5cd6); border: 1px solid rgba(0,0,0,.45); box-shadow: inset 0 1px 0 rgba(255,255,255,.25); color: #fff; cursor: grab; touch-action: none; }
.otv-clip.is-sel { outline: 2px solid #fff; outline-offset: -2px; z-index: 2; }
.otv-clip.is-locked { cursor: not-allowed; filter: saturate(.5); }
.otv-clip.is-missing { background-image: repeating-linear-gradient(45deg, rgba(0,0,0,.35) 0 6px, transparent 6px 12px); }
.otv-clip.is-off { opacity: .45; }
.otv-clip .lb { position: absolute; left: 8px; right: 8px; top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-shadow: 0 1px 1px rgba(0,0,0,.6); pointer-events: none; font-size: 11px; }
.otv-clip .kd { position: absolute; bottom: 2px; width: 7px; height: 7px; margin-left: -3px; background: #fff; transform: rotate(45deg); opacity: .9; pointer-events: none; }
.otv-clip .tr { position: absolute; top: 0; bottom: 0; width: ${TRIM_PX}px; cursor: ew-resize; touch-action: none; }
.otv-clip .tr.l { left: 0; background: linear-gradient(90deg, rgba(255,255,255,.35), transparent); }
.otv-clip .tr.r { right: 0; background: linear-gradient(270deg, rgba(255,255,255,.35), transparent); }
.otv-kf { position: absolute; width: 12px; height: 12px; margin: -6px 0 0 -6px; background: var(--c, #fff); border: 1px solid rgba(0,0,0,.6); transform: rotate(45deg); cursor: ew-resize; touch-action: none; z-index: 1; }
.otv-kf.is-sel { outline: 2px solid #fff; background: var(--otv-accent); }
.otv-mline { position: absolute; top: 0; bottom: 0; width: 1px; background: color-mix(in srgb, var(--c, #e0a030) 70%, transparent); pointer-events: none; }
.otv-pl { position: absolute; left: 0; top: 0; bottom: 0; width: 1px; background: var(--otv-play); pointer-events: none; will-change: transform; z-index: 4; }
.otv-snap { position: absolute; top: 0; bottom: 0; width: 1px; background: #fff; pointer-events: none; z-index: 4; display: none; }
.otv-empty { position: absolute; left: 0; top: 0; right: 0; padding: 18px; color: var(--otv-muted); line-height: 1.6; pointer-events: none; }
.otv-menu { position: absolute; z-index: 20; min-width: 170px; padding: 4px; border-radius: 6px; background: var(--otv-bg); border: 1px solid var(--otv-border); box-shadow: 0 8px 24px rgba(0,0,0,.5); }
.otv-menu button { display: block; width: 100%; text-align: left; padding: 5px 9px; border: 0; background: transparent; color: var(--otv-text); font: inherit; border-radius: 3px; cursor: pointer; }
.otv-menu button:hover { background: var(--otv-hover); }
.otv-menu hr { border: 0; border-top: 1px solid var(--otv-border); margin: 3px 0; }
@media (max-width: 700px) {
  .otv { --head-w: 104px; }
  .otv-main { grid-template-columns: 104px minmax(0, 1fr); }
  .otv-btn { min-width: 32px; height: 30px; padding: 0 5px; }
  .otv-sel { height: 30px; max-width: 120px; }
  .otv-tools { gap: 3px; padding: 3px 4px; }
  .otv-th .tg { width: 22px; height: 22px; }
}
`

function injectStyles () {
  if (typeof document === 'undefined' || document.getElementById('omni-timeline-styles')) return
  const tag = document.createElement('style')
  tag.id = 'omni-timeline-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e }
const ev = (n, d) => window.dispatchEvent(new CustomEvent(n, { detail: d }))
const notify = (desc) => ev('omni:notify-info', { name: 'Timeline', desc, holdMs: 3000 })

/** Short ruler label for a tick (trailing/leading zero groups trimmed to the zoom level). */
export function tickLabel (t, step) {
  let tc = TL.toTimecode(t)
  let parts = tc.split(':')
  if (step >= 1) parts = parts.slice(0, 3)
  while (parts.length > 2 && parts[0] === '00') parts.shift()
  tc = parts.join(':')
  return step >= 1 && parts.length === 2 ? tc : tc
}

const STEPS = [1, 2, 5, 10, 15].map(f => f / TL.FPS).concat([1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200, 14400, 21600, 43200, 86400])
/** Pick the major tick step (seconds) giving at least `minPx` between labelled ticks. */
export function pickStep (pps, minPx = 84) {
  for (const s of STEPS) if (s * pps >= minPx) return s
  return STEPS[STEPS.length - 1]
}

export default class OmniTimelineView {
  constructor (opts = {}) {
    this.opts = opts
    this.root = null
    this.sel = { clips: new Set(), keys: new Set(), markers: new Set() }
    this.keyProp = 'position.y'
    this._pool = { clip: new Map(), lane: new Map(), head: new Map(), kf: new Map(), mk: new Map(), mline: new Map() }
    this._rows = []
    this._totalH = 0
    this._raf = 0
    this._drag = null
    this._bound = []
    this._ro = null
    this._lastT = 0
    this._fallbackW = 700
    this._pinch = null
    this._renderCount = 0
  }

  // ── lifecycle ─────────────────────────────────────────────────────────────

  mount (parent) {
    injectStyles()
    TL.load()
    const root = this.root = el('div', 'otv')
    root.innerHTML = /* html */`
      <div class="otv-tools">
        <select class="otv-sel" data-r="addnode" title="Add any node of the scene (both registries) as a clip at the playhead"><option value="">Add node…</option></select>
        <button class="otv-btn" data-a="add-sel" title="Add the node selected in the scene to the timeline at the playhead (5 s)">＋ Selected</button>
        <span class="sep"></span>
        <button class="otv-btn" data-a="split" title="Razor: split the selected clips (or every clip under the playhead) at the playhead — C">✂ Split</button>
        <button class="otv-btn" data-a="dup" title="Duplicate the selected clips after themselves">⧉</button>
        <button class="otv-btn" data-a="del" title="Delete the selected clip / keyframe / marker — Delete">🗑</button>
        <span class="sep"></span>
        <select class="otv-sel" data-r="keyprop" title="Property for the keyframe button"></select>
        <button class="otv-btn" data-a="key" title="Add a keyframe at the playhead on the selected clip (value = the node's current value)">◇ Key</button>
        <button class="otv-btn" data-a="marker" title="Add a marker at the playhead — M">⚑</button>
        <span class="sp"></span>
        <button class="otv-btn" data-a="snap" title="Snap clip edges to the playhead, markers and other clips">⌁ Snap</button>
        <button class="otv-btn" data-a="track" title="Add a track">＋ Track</button>
        <button class="otv-btn" data-a="zoom-out" title="Zoom out — minus">−</button>
        <button class="otv-btn" data-a="zoom-in" title="Zoom in — plus">＋</button>
        <button class="otv-btn" data-a="fit" title="Zoom to fit all clips">⤢</button>
      </div>
      <div class="otv-main">
        <div class="otv-corner">TRACKS</div>
        <div class="otv-ruler" data-r="ruler"><canvas></canvas><div class="otv-rlayer" data-r="rlayer"></div><div class="otv-head" data-r="head"><i></i></div></div>
        <div class="otv-heads" data-r="heads"><div class="otv-hin" data-r="hin"></div></div>
        <div class="otv-scroll" data-r="scroll"><div class="otv-content" data-r="content"><div class="otv-pl" data-r="pl"></div><div class="otv-snap" data-r="snapline"></div></div></div>
      </div>`
    this.q = (r) => root.querySelector(`[data-r="${r}"]`)
    this.ruler = this.q('ruler'); this.canvas = this.ruler.querySelector('canvas'); this.rlayer = this.q('rlayer'); this.headEl = this.q('head')
    this.heads = this.q('heads'); this.hin = this.q('hin'); this.scroll = this.q('scroll'); this.content = this.q('content')
    this.pl = this.q('pl'); this.snapLine = this.q('snapline')
    const kp = this.q('keyprop')
    for (const p of TL.KEY_PROPS) { const o = el('option', null, p.label); o.value = p.id; kp.appendChild(o) }
    kp.value = this.keyProp
    parent.appendChild(root)
    this._bind()
    this.renderNow()
    this._applyScroll(TL.getState().view.scroll)
    return root
  }

  destroy () {
    for (const [t, n, f, o] of this._bound) t.removeEventListener(n, f, o)
    this._bound.length = 0
    cancelAnimationFrame(this._raf)
    this._ro?.disconnect()
    this.root?.remove()
    this.root = null
  }

  _on (target, name, fn, opts) { target.addEventListener(name, fn, opts); this._bound.push([target, name, fn, opts]) }

  _bind () {
    const r = this.root
    this._on(r, 'click', (e) => this._onClick(e))
    this._on(r.querySelector('[data-r="addnode"]'), 'focus', () => this._fillNodes())
    this._on(r.querySelector('[data-r="addnode"]'), 'mousedown', () => this._fillNodes())
    this._on(r.querySelector('[data-r="addnode"]'), 'change', (e) => {
      const id = e.target.value
      e.target.value = ''
      if (id) { getPlayer()?.addNode(id); this._selectLatestClipOf(id) }
    })
    this._on(r.querySelector('[data-r="keyprop"]'), 'change', (e) => { this.keyProp = e.target.value })
    this._on(this.content, 'pointerdown', (e) => this._onLaneDown(e))
    this._on(this.content, 'dblclick', (e) => this._onLaneDbl(e))
    this._on(this.content, 'contextmenu', (e) => this._onContext(e))
    this._on(this.heads, 'click', (e) => this._onHeadClick(e))
    this._on(this.heads, 'dblclick', (e) => this._onHeadDbl(e))
    this._on(this.heads, 'contextmenu', (e) => this._onHeadContext(e))
    this._on(this.ruler, 'pointerdown', (e) => this._onRulerDown(e))
    this._on(this.ruler, 'contextmenu', (e) => this._onRulerContext(e))
    this._on(this.scroll, 'scroll', () => this._onScroll())
    this._on(this.scroll, 'wheel', (e) => this._onWheel(e), { passive: false })
    this._on(this.ruler, 'wheel', (e) => this._onWheel(e), { passive: false })
    this._on(this.heads, 'wheel', (e) => { this.scroll.scrollTop += e.deltaY; e.preventDefault() }, { passive: false })
    this._on(this.scroll, 'touchmove', (e) => this._onTouchMove(e), { passive: false })
    this._on(this.scroll, 'touchend', () => { this._pinch = null })
    this._on(window, 'pointermove', (e) => this._onMove(e))
    this._on(window, 'pointerup', (e) => this._onUp(e))
    this._on(window, 'pointercancel', (e) => this._onUp(e))
    this._on(window, 'pointerdown', (e) => { if (this._menu && !e.target.closest?.('.otv-menu')) this._closeMenu() }, true)
    this._on(window, 'omni:timeline-changed', () => this._schedule())
    this._on(window, 'omni:timeline-playhead', (e) => this._onPlayhead(e.detail?.t))
    this._on(window, 'omni:timeline-reveal', (e) => this.reveal(e.detail?.nodeId))
    this._on(window, 'omni:node-deleted', () => this._schedule())
    if (typeof ResizeObserver !== 'undefined') { this._ro = new ResizeObserver(() => this._schedule()); this._ro.observe(this.scroll) }
  }

  // ── geometry ──────────────────────────────────────────────────────────────

  get pps () { return TL.getState().view.pps }
  get viewW () { return this.scroll?.clientWidth || this._fallbackW }
  get viewH () { return this.scroll?.clientHeight || 240 }
  timeAt (clientX) { const r = this.scroll.getBoundingClientRect(); return Math.max(0, (clientX - r.left + this.scroll.scrollLeft) / this.pps) }
  rowAtY (clientY) {
    const r = this.scroll.getBoundingClientRect()
    const y = clientY - r.top + this.scroll.scrollTop
    return this._rows.find(row => y >= row.y && y < row.y + row.h) ?? null
  }

  _computeLayout () {
    const rows = []
    let y = 0
    const keysByClip = new Map()
    for (const k of TL.getKeys()) { let s = keysByClip.get(k.clipId); if (!s) keysByClip.set(k.clipId, s = new Set()); s.add(k.property) }
    TL.getTracks().forEach((track, i) => {
      let props = []
      if (track.open) {
        const have = new Set()
        for (const c of TL.getClips()) if (c.trackId === track.id) for (const p of keysByClip.get(c.id) ?? []) have.add(p)
        props = TL.KEY_PROP_IDS.filter(p => have.has(p))
      }
      const subs = track.open ? Math.max(1, props.length) : 0
      const h = ROW_H + subs * SUB_H
      rows.push({ track, y, h, props, index: i })
      y += h
    })
    this._rows = rows
    this._totalH = y
  }

  _contentWidth () {
    const st = TL.getState()
    let end = Math.max(TL.getT(), st.workArea.out ?? 0)
    for (const c of st.clips) end = Math.max(end, c.start + c.duration)
    for (const m of st.markers) end = Math.max(end, m.t)
    return Math.min(MAX_CONTENT_W, Math.max(this.viewW, (end + 30) * this.pps))
  }

  // ── rendering ─────────────────────────────────────────────────────────────

  _schedule () {
    if (this._raf || !this.root) return
    this._raf = requestAnimationFrame(() => { this._raf = 0; this.renderNow() })
  }

  renderNow () {
    if (!this.root) return
    this._renderCount++
    cancelAnimationFrame(this._raf); this._raf = 0
    const st = TL.getState()
    this._computeLayout()
    const pps = this.pps
    const cw = this._contentWidth()
    this.content.style.width = cw + 'px'
    this.content.style.height = Math.max(this._totalH, this.viewH - 2) + 'px'
    this.q('rlayer').style.width = cw + 'px'
    const sl = this.scroll.scrollLeft, sw = this.viewW
    const t0 = (sl - 300) / pps, t1 = (sl + sw + 300) / pps
    const sTop = this.scroll.scrollTop, sh = this.viewH
    const rowVisible = (row) => row.y + row.h >= sTop - 80 && row.y <= sTop + sh + 80

    // lanes + headers (few: one per track and sub-lane)
    const laneSeen = new Set(), headSeen = new Set()
    for (const row of this._rows) {
      const tr = row.track
      let lane = this._pool.lane.get(tr.id)
      if (!lane) { lane = el('div', 'otv-lane'); lane.dataset.track = tr.id; this.content.insertBefore(lane, this.pl); this._pool.lane.set(tr.id, lane) }
      lane.style.top = row.y + 'px'; lane.style.height = ROW_H + 'px'
      lane.classList.toggle('alt', row.index % 2 === 1)
      lane.classList.toggle('is-muted', tr.muted)
      laneSeen.add(tr.id)
      let head = this._pool.head.get(tr.id)
      if (!head) { head = el('div', 'otv-th'); head.dataset.track = tr.id; this.hin.appendChild(head); this._pool.head.set(tr.id, head) }
      this._fillTrackHead(head, row)
      headSeen.add(tr.id)
      const nSub = tr.open ? Math.max(1, row.props.length) : 0
      for (let s = 0; s < nSub; s++) {
        const key = `${tr.id}:${s}`
        let sl2 = this._pool.lane.get(key)
        if (!sl2) { sl2 = el('div', 'otv-lane is-sub'); this.content.insertBefore(sl2, this.pl); this._pool.lane.set(key, sl2) }
        sl2.dataset.track = tr.id; sl2.dataset.prop = row.props[s] ?? ''
        sl2.style.top = (row.y + ROW_H + s * SUB_H) + 'px'; sl2.style.height = SUB_H + 'px'
        laneSeen.add(key)
        let sh2 = this._pool.head.get(key)
        if (!sh2) { sh2 = el('div', 'otv-th is-sub'); this.hin.appendChild(sh2); this._pool.head.set(key, sh2) }
        sh2.style.top = (row.y + ROW_H + s * SUB_H) + 'px'; sh2.style.height = SUB_H + 'px'
        sh2.textContent = row.props[s] ? (TL.getKeyProp(row.props[s])?.label ?? row.props[s]) : 'no keyframes yet'
        headSeen.add(key)
      }
    }
    for (const [k, v] of this._pool.lane) if (!laneSeen.has(k)) { v.remove(); this._pool.lane.delete(k) }
    for (const [k, v] of this._pool.head) if (!headSeen.has(k)) { v.remove(); this._pool.head.delete(k) }
    this.hin.style.height = this._totalH + 'px'

    // clips + their keyframe diamonds on sub-lanes
    const rowOf = new Map(this._rows.map(r => [r.track.id, r]))
    const keysBy = new Map()
    for (const k of TL.getKeys()) { let a = keysBy.get(k.clipId); if (!a) keysBy.set(k.clipId, a = []); a.push(k) }
    const player = getPlayer()
    const clipSeen = new Set(), kfSeen = new Set()
    const anySolo = st.tracks.some(t => t.solo)
    for (const c of st.clips) {
      const row = rowOf.get(c.trackId)
      if (!row || !rowVisible(row) || c.start + c.duration < t0 || c.start > t1) continue
      clipSeen.add(c.id)
      let ce = this._pool.clip.get(c.id)
      if (!ce) {
        ce = el('div', 'otv-clip'); ce.dataset.clip = c.id
        ce.append(el('span', 'tr l'), el('span', 'lb'), el('span', 'tr r'))
        this.content.insertBefore(ce, this.pl); this._pool.clip.set(c.id, ce)
      }
      const x = c.start * pps, w = Math.max(MIN_CLIP_PX, c.duration * pps)
      ce.style.left = x + 'px'; ce.style.width = w + 'px'; ce.style.top = (row.y + 3) + 'px'
      ce.style.setProperty('--c', c.color)
      const missing = !!player && !player.nodeInfo(c.nodeId).exists
      ce.classList.toggle('is-sel', this.sel.clips.has(c.id))
      ce.classList.toggle('is-locked', row.track.locked)
      ce.classList.toggle('is-missing', missing)
      ce.classList.toggle('is-off', row.track.muted || (anySolo && !row.track.solo))
      const ks = keysBy.get(c.id) ?? []
      const sig = `${c.label}|${c.loop}|${missing}|${w > 40}|${ks.map(k => k.t.toFixed(3)).join(',')}|${c.inPoint}|${pps}`
      if (ce._sig !== sig) {
        ce._sig = sig
        ce.querySelector('.lb').textContent = `${c.loop ? '↻ ' : ''}${missing ? '⚠ ' : ''}${c.label}`
        ce.querySelectorAll('.kd').forEach(n => n.remove())
        if (w > 24) for (const k of ks) { const kx = (k.t - c.inPoint) * pps; if (kx >= 0 && kx <= w) { const d = el('i', 'kd'); d.style.left = kx + 'px'; ce.appendChild(d) } }
        ce.title = `${c.label}\nstart ${TL.toTimecode(c.start)}  duration ${c.duration.toFixed(2)}s  in ${c.inPoint.toFixed(2)}s`
      }
      // keyframe diamonds on the expanded sub-lanes
      if (row.track.open) for (const k of ks) {
        const si = row.props.indexOf(k.property)
        if (si < 0) continue
        const tt = c.start + (k.t - c.inPoint)
        if (tt < c.start - 1e-6 || tt > c.start + c.duration + 1e-6) continue
        kfSeen.add(k.id)
        let ke = this._pool.kf.get(k.id)
        if (!ke) { ke = el('div', 'otv-kf'); ke.dataset.key = k.id; this.content.insertBefore(ke, this.pl); this._pool.kf.set(k.id, ke) }
        ke.style.left = (tt * pps) + 'px'; ke.style.top = (row.y + ROW_H + si * SUB_H + SUB_H / 2) + 'px'
        ke.style.setProperty('--c', c.color)
        ke.classList.toggle('is-sel', this.sel.keys.has(k.id))
        ke.title = `${TL.getKeyProp(k.property)?.label ?? k.property} = ${typeof k.value === 'number' ? +k.value.toFixed(3) : k.value}  @ ${TL.toTimecode(tt)}  (${k.ease})`
      }
    }
    for (const [k, v] of this._pool.clip) if (!clipSeen.has(k)) { v.remove(); this._pool.clip.delete(k) }
    for (const [k, v] of this._pool.kf) if (!kfSeen.has(k)) { v.remove(); this._pool.kf.delete(k) }

    // markers: flag on the ruler + thin line across the lanes
    const mkSeen = new Set()
    for (const m of st.markers) {
      if (m.t < t0 || m.t > t1) continue
      mkSeen.add(m.id)
      let me = this._pool.mk.get(m.id)
      if (!me) { me = el('div', 'otv-mk'); me.dataset.marker = m.id; me.appendChild(el('b')); this.rlayer.appendChild(me); this._pool.mk.set(m.id, me) }
      me.style.left = (m.t * pps) + 'px'; me.style.setProperty('--c', m.color)
      me.querySelector('b').title = `${m.name} — ${TL.toTimecode(m.t)}`
      me.classList.toggle('is-sel', this.sel.markers.has(m.id))
      let ml = this._pool.mline.get(m.id)
      if (!ml) { ml = el('div', 'otv-mline'); this.content.insertBefore(ml, this.pl); this._pool.mline.set(m.id, ml) }
      ml.style.left = (m.t * pps) + 'px'; ml.style.setProperty('--c', m.color)
    }
    for (const [k, v] of this._pool.mk) if (!mkSeen.has(k)) { v.remove(); this._pool.mk.delete(k) }
    for (const [k, v] of this._pool.mline) if (!mkSeen.has(k)) { v.remove(); this._pool.mline.delete(k) }

    // work area bar
    let wa = this.rlayer.querySelector('.otv-wa')
    const wi = st.workArea.in, wo = st.workArea.out
    if (wi != null || wo != null) {
      if (!wa) { wa = el('div', 'otv-wa'); this.rlayer.appendChild(wa) }
      const a = (wi ?? 0) * pps, b = (wo ?? cw / pps) * pps
      wa.style.left = a + 'px'; wa.style.width = Math.max(2, b - a) + 'px'
      wa.title = `Work area ${wi != null ? TL.toTimecode(wi) : 'start'} – ${wo != null ? TL.toTimecode(wo) : 'end'}`
    } else wa?.remove()

    // empty hint
    let hint = this.content.querySelector('.otv-empty')
    if (!st.tracks.length) {
      if (!hint) { hint = el('div', 'otv-empty'); hint.textContent = 'The timeline is empty. Select a node in the scene and press ＋ Selected, or pick one from “Add node…”. Each clip shows its node only while the playhead is inside it (nodes without clips are never touched).'; this.content.appendChild(hint) }
    } else hint?.remove()

    // toolbar state
    this.q('snapline'); this.root.querySelector('[data-a="snap"]').classList.toggle('is-on', st.snap)
    this.hin.style.transform = `translateY(${-this.scroll.scrollTop}px)`
    this._drawRuler()
    this._placePlayhead(TL.getT())
    this.opts.onRender?.()
  }

  _fillTrackHead (head, row) {
    const tr = row.track
    head.style.top = row.y + 'px'; head.style.height = ROW_H + 'px'
    const n = TL.getClips().reduce((a, c) => a + (c.trackId === tr.id ? 1 : 0), 0)
    const sig = `${tr.name}|${tr.muted}|${tr.solo}|${tr.locked}|${tr.open}|${n}`
    if (head._sig === sig) return
    head._sig = sig
    head.textContent = ''
    const r1 = el('div', 'r1')
    const ex = el('button', 'ex', tr.open ? '▾' : '▸'); ex.dataset.a = 'open'; ex.title = 'Show or hide this track\'s keyframe sub-lanes'
    const nm = el('span', 'nm', tr.name); nm.title = 'Double-click to rename'
    const mk = (a, t, tip) => { const b = el('button', 'tg' + (tr[a] ? ' is-on' : ''), t); b.dataset.a = a; b.title = tip; b.setAttribute('aria-pressed', String(!!tr[a])); return b }
    r1.append(ex, nm, mk('muted', 'M', 'Mute: clips on this track are ignored'), mk('solo', 'S', 'Solo: only soloed tracks play'), mk('locked', 'L', 'Lock: clips on this track cannot be edited'))
    head.append(r1, el('div', 'ct', `${n} clip${n === 1 ? '' : 's'}`))
    head.dataset.track = tr.id
  }

  _drawRuler () {
    const cv = this.canvas
    if (!cv) return
    const w = this.viewW, h = RULER_H
    const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr) }
    const g = cv.getContext?.('2d')
    if (!g) return
    const cs = getComputedStyle(this.root)
    const col = cs.color || '#ccc'
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    g.clearRect(0, 0, w, h)
    const pps = this.pps, sl = this.scroll.scrollLeft
    const step = pickStep(pps)
    const minor = step * pps >= 60 ? step / 5 : 0
    const first = Math.floor(sl / pps / step) * step
    g.fillStyle = col; g.strokeStyle = col; g.font = '10px "Courier New", monospace'; g.textBaseline = 'top'
    g.globalAlpha = 0.9
    g.beginPath()
    for (let t = first; t * pps - sl < w + 80; t += step) {
      const x = Math.round(t * pps - sl) + 0.5
      g.moveTo(x, 12); g.lineTo(x, h)
    }
    g.stroke()
    if (minor && minor * pps >= 6) {
      g.globalAlpha = 0.45; g.beginPath()
      for (let t = first; t * pps - sl < w + 80; t += minor) { const x = Math.round(t * pps - sl) + 0.5; g.moveTo(x, h - 6); g.lineTo(x, h) }
      g.stroke()
    }
    g.globalAlpha = 0.95
    for (let t = first; t * pps - sl < w + 80; t += step) {
      const x = Math.round(t * pps - sl) + 0.5
      g.fillText(tickLabel(t, step), x + 3, 1)
    }
    g.globalAlpha = 1
    this.rlayer.style.transform = `translateX(${-sl}px)`
  }

  _placePlayhead (t) {
    if (!this.pl) return
    const x = t * this.pps
    this.pl.style.transform = `translateX(${x}px)`
    const hx = x - this.scroll.scrollLeft
    this.headEl.style.transform = `translateX(${hx}px)`
    this.headEl.style.display = hx < -10 || hx > this.viewW + 10 ? 'none' : ''
  }

  _onPlayhead (t) {
    if (!this.root || !Number.isFinite(t)) return
    this._lastT = t
    const x = t * this.pps
    // follow the playhead while playing (page the view), and grow the scroll area as time runs on
    if (!this._drag && TL.isPlaying()) {
      const sl = this.scroll.scrollLeft, w = this.viewW
      if (x > sl + w - 24 || x < sl) this._applyScroll(Math.max(0, x - 60))
    }
    if (x + 200 > parseFloat(this.content.style.width || '0') && x < MAX_CONTENT_W) this.content.style.width = Math.min(MAX_CONTENT_W, x + 60 * this.pps + 200) + 'px'
    this._placePlayhead(t)
    this.opts.onPlayhead?.(t)
  }

  _applyScroll (x) {
    this.scroll.scrollLeft = x
    this._onScroll()
  }

  _onScroll () {
    if (!this.root) return
    this.hin.style.transform = `translateY(${-this.scroll.scrollTop}px)`
    this._drawRuler()
    this._placePlayhead(TL.getT())
    TL.setView({ scroll: this.scroll.scrollLeft })
    this._schedule()
  }

  // ── zoom ──────────────────────────────────────────────────────────────────

  zoomBy (factor, anchorPx) {
    const old = this.pps
    const next = Math.min(TL.ZOOM_MAX, Math.max(TL.ZOOM_MIN, old * factor))
    if (next === old) return
    const ax = anchorPx ?? this.viewW / 2
    const tAnchor = (this.scroll.scrollLeft + ax) / old
    TL.setView({ pps: next })
    this.content.style.width = this._contentWidth() + 'px'
    this.scroll.scrollLeft = Math.max(0, tAnchor * next - ax)
    this.renderNow()
    this._onScroll()
  }

  fit () {
    const clips = TL.getClips()
    if (!clips.length) { TL.setView({ pps: 40 }); this.renderNow(); return }
    const a = Math.min(...clips.map(c => c.start)), b = Math.max(...clips.map(c => c.start + c.duration))
    const pps = Math.min(TL.ZOOM_MAX, Math.max(TL.ZOOM_MIN, (this.viewW - 40) / Math.max(0.5, b - a)))
    TL.setView({ pps })
    this.content.style.width = this._contentWidth() + 'px'
    this.scroll.scrollLeft = Math.max(0, a * pps - 20)
    this.renderNow(); this._onScroll()
  }

  _onWheel (e) {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      const r = this.scroll.getBoundingClientRect()
      this.zoomBy(e.deltaY < 0 ? 1.2 : 1 / 1.2, e.clientX - r.left)
    } else if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY) || e.currentTarget === this.ruler) {
      e.preventDefault()
      this.scroll.scrollLeft += (e.deltaX || e.deltaY)
    }
  }

  _onTouchMove (e) {
    if (e.touches.length !== 2) { this._pinch = null; return }
    const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY)
    if (this._pinch && d > 0) {
      if (e.cancelable) e.preventDefault()
      const r = this.scroll.getBoundingClientRect()
      this.zoomBy(d / this._pinch, (e.touches[0].clientX + e.touches[1].clientX) / 2 - r.left)
    }
    this._pinch = d
  }

  // ── selection ─────────────────────────────────────────────────────────────

  _setSel (kind, ids, additive) {
    if (!additive) { this.sel.clips.clear(); this.sel.keys.clear(); this.sel.markers.clear() }
    for (const id of ids) {
      const s = this.sel[kind]
      if (additive && s.has(id)) s.delete(id); else s.add(id)
    }
    ev('omni:timeline-selection', { clipIds: [...this.sel.clips], keyIds: [...this.sel.keys], markerIds: [...this.sel.markers] })
    this._schedule()
  }

  clearSelection () { this._setSel('clips', [], false) }

  _selectLatestClipOf (nodeId) {
    const cs = TL.getClipsForNode(nodeId)
    const c = cs[cs.length - 1]
    if (c) { this._setSel('clips', [c.id], false); this.scrollToTime(c.start) }
  }

  /** Show a node's clip: select it and scroll the playhead-independent view to it. */
  reveal (nodeId) {
    const cs = TL.getClipsForNode(nodeId)
    if (!cs.length) return false
    this._setSel('clips', cs.map(c => c.id), false)
    this.scrollToTime(cs[0].start)
    return true
  }

  scrollToTime (t) {
    const x = t * this.pps
    if (x < this.scroll.scrollLeft || x > this.scroll.scrollLeft + this.viewW - 40) this._applyScroll(Math.max(0, x - 60))
  }

  _selectedClips () { return [...this.sel.clips].map(TL.getClip).filter(Boolean) }
  _locked (c) { return !!TL.getTrack(c.trackId)?.locked }

  // ── toolbar / buttons ─────────────────────────────────────────────────────

  _fillNodes () {
    const sel = this.q('addnode')
    const cur = new Set([...sel.options].map(o => o.value))
    const nodes = listNodes()
    const ids = new Set(nodes.map(n => n.id))
    if (cur.size - 1 === ids.size && nodes.every(n => cur.has(n.id))) return
    while (sel.options.length > 1) sel.remove(1)
    for (const n of nodes) { const o = el('option', null, `${n.label}  ·  ${n.id.slice(0, 10)}`); o.value = n.id; sel.appendChild(o) }
  }

  _onClick (e) {
    const b = e.target.closest('[data-a]')
    if (!b || !this.root.contains(b) || b.closest('.otv-heads')) return
    this.act(b.dataset.a)
  }

  act (a) {
    switch (a) {
      case 'add-sel': ev('omni:timeline-add-selected'); { const id = getSelectedNodeId(); if (id) this._selectLatestClipOf(id) } break
      case 'split': this.splitAtPlayhead(); break
      case 'dup': this.duplicateSelected(); break
      case 'del': this.deleteSelected(); break
      case 'key': this.addKeyForSelected(); break
      case 'marker': ev('omni:timeline-marker-add', { t: TL.getT() }); break
      case 'snap': TL.setSnap(!TL.getState().snap); break
      case 'track': TL.addTrack(); break
      case 'zoom-in': this.zoomBy(1.4); break
      case 'zoom-out': this.zoomBy(1 / 1.4); break
      case 'fit': this.fit(); break
    }
  }

  splitAtPlayhead () {
    const t = TL.getT()
    let targets = this._selectedClips().filter(c => !this._locked(c))
    if (!targets.length) targets = TL.getClips().filter(c => !this._locked(c) && t > c.start && t < c.start + c.duration)
    let n = 0
    for (const c of targets) if (TL.splitClip(c.id, t)) n++
    if (!n) notify('Nothing to split: put the playhead inside an unlocked clip.')
    return n
  }

  duplicateSelected () {
    const made = this._selectedClips().filter(c => !this._locked(c)).map(c => TL.duplicateClip(c.id)).filter(Boolean)
    if (made.length) this._setSel('clips', made.map(c => c.id), false)
    return made.length
  }

  deleteSelected () {
    let n = 0
    if (this.sel.keys.size) { for (const id of [...this.sel.keys]) if (TL.removeKey(id)) n++; this.sel.keys.clear() }
    else if (this.sel.clips.size) { for (const c of this._selectedClips()) if (!this._locked(c) && TL.removeClip(c.id)) n++; this.sel.clips.clear() }
    else if (this.sel.markers.size) { for (const id of [...this.sel.markers]) if (TL.removeMarker(id)) n++; this.sel.markers.clear() }
    if (n) ev('omni:timeline-selection', { clipIds: [...this.sel.clips], keyIds: [...this.sel.keys], markerIds: [...this.sel.markers] })
    this._schedule()
    return n
  }

  addKeyForSelected (property = this.keyProp) {
    const t = TL.getT()
    let clips = this._selectedClips().filter(c => !this._locked(c))
    if (!clips.length) clips = TL.getClips().filter(c => !this._locked(c) && t >= c.start && t <= c.start + c.duration && getSelectedNodeId() === c.nodeId)
    let n = 0
    for (const c of clips) if (this.addKeyAt(c, property, t)) n++
    if (!n) notify('Select a clip (with the playhead inside it) first, then add a keyframe.')
    return n
  }

  /** The value a new key should get: the clip's own animation at that time if it has keys for the property, else the node's real value. */
  keyValueAt (c, property, t) {
    const list = TL.getKeysForClip(c.id).filter(k => k.property === property)
    if (list.length) return TL.evalKeyList(list, TL.sourceTime(c, t, c.loop ? TL.cycleLength(c) : 0), property)
    return getNodeValue(c.nodeId, property)
  }

  addKeyAt (c, property, t) {
    const v = this.keyValueAt(c, property, t)
    if (v == null) { notify('That node is not in the scene right now, so there is no value to key.'); return null }
    const k = TL.addKeyAtTime(c.id, property, t, v)
    if (k) getPlayer()?.evaluateNow()
    return k
  }

  // ── tracks ────────────────────────────────────────────────────────────────

  _trackOf (e) { const h = e.target.closest('.otv-th'); return h?.dataset.track ? TL.getTrack(h.dataset.track) : null }

  _onHeadClick (e) {
    const b = e.target.closest('button[data-a]')
    const tr = this._trackOf(e)
    if (!b || !tr) return
    const a = b.dataset.a
    if (a === 'open') TL.updateTrack(tr.id, { open: !tr.open })
    else TL.updateTrack(tr.id, { [a]: !tr[a] })
  }

  _onHeadDbl (e) {
    const nm = e.target.closest('.nm')
    const tr = this._trackOf(e)
    if (!nm || !tr || nm.tagName === 'INPUT') return
    const input = el('input', 'nm'); input.value = tr.name; input.maxLength = 60
    nm.replaceWith(input); input.focus(); input.select()
    const done = (ok) => { if (!input.isConnected) return; if (ok && input.value.trim()) TL.updateTrack(tr.id, { name: input.value.trim() }); else { input.replaceWith(nm) } }
    input.addEventListener('keydown', (k) => { k.stopPropagation(); if (k.key === 'Enter') done(true); else if (k.key === 'Escape') done(false) })
    input.addEventListener('blur', () => done(true))
  }

  _onHeadContext (e) {
    const tr = this._trackOf(e)
    if (!tr) return
    e.preventDefault()
    this._openMenu(e, [
      ['Rename track', () => this._onHeadDbl({ target: this.hin.querySelector(`.otv-th[data-track="${tr.id}"] .nm`) ?? document.body, })],
      ['Add track', () => TL.addTrack()],
      ['—'],
      ['Delete track and its clips', () => { TL.removeTrack(tr.id); getPlayer()?.evaluateNow() }],
    ])
  }

  // ── pointer: ruler scrub ──────────────────────────────────────────────────

  _onRulerDown (e) {
    if (e.button > 0) return
    const mk = e.target.closest?.('.otv-mk b')
    if (mk) {
      const id = mk.parentNode.dataset.marker
      this._setSel('markers', [id], e.shiftKey)
      const m = TL.getMarker(id)
      if (m) { TL.seek(m.t); getPlayer()?.evaluateNow() }
      this._drag = { kind: 'marker', id, startX: e.clientX, origT: m?.t ?? 0, moved: false }
      return
    }
    e.preventDefault()
    this._drag = { kind: 'scrub' }
    TL.beginScrub()
    this._scrubTo(e.clientX)
  }

  _scrubTo (clientX) {
    const t = this.timeAt(clientX)
    TL.seek(t)
    getPlayer()?.evaluateNow()
  }

  _onRulerContext (e) {
    const mk = e.target.closest?.('.otv-mk b')
    e.preventDefault()
    const t = this.timeAt(e.clientX)
    if (mk) {
      const id = mk.parentNode.dataset.marker
      this._openMenu(e, [
        ['Go to marker', () => { const m = TL.getMarker(id); if (m) { TL.seek(m.t); getPlayer()?.evaluateNow() } }],
        ['Rename…', () => { const m = TL.getMarker(id); const n = typeof prompt === 'function' ? prompt('Marker name', m?.name ?? '') : null; if (n) TL.updateMarker(id, { name: n }) }],
        ['Delete marker', () => TL.removeMarker(id)],
      ])
    } else {
      this._openMenu(e, [
        ['Add marker here', () => TL.addMarker({ t })],
        ['Set work area in here', () => { const o = TL.getState().workArea.out; TL.setWorkArea(t, o != null && o > t ? o : null) }],
        ['Set work area out here', () => { const i = TL.getState().workArea.in; TL.setWorkArea(i != null && i < t ? i : null, t) }],
        ['Clear work area', () => TL.setWorkArea(null, null)],
      ])
    }
  }

  // ── pointer: lanes ────────────────────────────────────────────────────────

  _onLaneDown (e) {
    if (e.button > 0) return
    this._closeMenu()
    const kfEl = e.target.closest('.otv-kf')
    const clipEl = e.target.closest('.otv-clip')
    if (kfEl) {
      const k = TL.getKey(kfEl.dataset.key)
      const c = k && TL.getClip(k.clipId)
      if (!k || !c) return
      e.preventDefault()
      this._setSel('keys', [k.id], e.shiftKey)
      if (this._locked(c)) return
      this._drag = { kind: 'key', id: k.id, clipId: c.id, startX: e.clientX, origT: k.t, moved: false }
      return
    }
    if (clipEl) {
      const c = TL.getClip(clipEl.dataset.clip)
      if (!c) return
      e.preventDefault()
      const trim = e.target.closest('.tr')
      const rect = clipEl.getBoundingClientRect()
      const edge = trim ? (trim.classList.contains('l') ? 'l' : 'r') : (e.clientX - rect.left <= TRIM_PX ? 'l' : rect.right - e.clientX <= TRIM_PX ? 'r' : null)
      if (e.shiftKey) this._setSel('clips', [c.id], true)
      else if (!this.sel.clips.has(c.id)) this._setSel('clips', [c.id], false)
      else this._schedule()
      if (this._locked(c) || !this.sel.clips.has(c.id)) return
      const group = this._selectedClips().filter(x => !this._locked(x))
      this._drag = {
        kind: edge ? 'trim' : 'move', edge, id: c.id, startX: e.clientX, startY: e.clientY, moved: false,
        orig: new Map(group.map(x => [x.id, { start: x.start, duration: x.duration, inPoint: x.inPoint, trackId: x.trackId }])),
        exclude: new Set(group.map(x => x.id)),
      }
      return
    }
    // empty lane: deselect; a plain click also parks the playhead nowhere (Premiere leaves it) — shift keeps the selection
    if (!e.shiftKey) this._setSel('clips', [], false)
  }

  _onMove (e) {
    const d = this._drag
    if (!d) return
    if (d.kind === 'scrub') { this._scrubTo(e.clientX); return }
    const pps = this.pps
    const dx = e.clientX - d.startX
    if (!d.moved && Math.abs(dx) < 3 && Math.abs((e.clientY ?? 0) - (d.startY ?? 0)) < 3) return
    d.moved = true
    const thr = SNAP_PX / pps
    if (d.kind === 'marker') { TL.updateMarker(d.id, { t: TL.snapTime(Math.max(0, d.origT + dx / pps), thr, null) }); return }
    if (d.kind === 'key') {
      const c = TL.getClip(d.clipId), k = TL.getKey(d.id)
      if (!c || !k) return
      const tl = TL.snapTime(c.start + (d.origT + dx / pps - c.inPoint), thr, d.exclude ?? new Set())
      TL.updateKey(d.id, { t: Math.max(0, c.inPoint + (tl - c.start)) })
      getPlayer()?.evaluateNow()
      return
    }
    const primary = d.orig.get(d.id)
    if (!primary) return
    if (d.kind === 'move') {
      let minStart = Infinity
      for (const o of d.orig.values()) minStart = Math.min(minStart, o.start)
      let ns = Math.max(0, primary.start + dx / pps)
      ns = TL.snapMove(ns, primary.duration, thr, d.exclude)
      let delta = ns - primary.start
      if (minStart + delta < 0) delta = -minStart
      const snapped = Math.abs(delta - dx / pps) > 1e-9
      for (const [id, o] of d.orig) TL.updateClip(id, { start: o.start + delta })
      // vertical: move the dragged clip to the track under the pointer
      const row = this.rowAtY(e.clientY)
      if (row && row.track.kind === 'node' && !row.track.locked && row.track.id !== TL.getClip(d.id).trackId) {
        const from = TL.getTrack(primary.trackId), fi = TL.getTracks().indexOf(from), ti = TL.getTracks().indexOf(row.track)
        for (const [id, o] of d.orig) {
          const idx = TL.getTracks().indexOf(TL.getTrack(o.trackId)) + (ti - fi)
          const tgt = TL.getTracks()[idx]
          if (tgt && tgt.kind === 'node' && !tgt.locked) TL.updateClip(id, { trackId: tgt.id })
        }
      }
      this._showSnap(snapped ? TL.getClip(d.id) : null, ns)
    } else if (d.kind === 'trim') {
      const c = TL.getClip(d.id)
      if (!c) return
      if (d.edge === 'l') {
        const end = primary.start + primary.duration
        let ns = TL.snapTime(primary.start + dx / pps, thr, d.exclude)
        ns = Math.min(end - TL.MIN_DUR, Math.max(ns, Math.max(0, primary.start - primary.inPoint)))
        TL.updateClip(d.id, { start: ns, duration: end - ns, inPoint: primary.inPoint + (ns - primary.start) })
        this._showSnap(ns !== primary.start + dx / pps ? c : null, ns)
      } else {
        let ne = TL.snapTime(primary.start + primary.duration + dx / pps, thr, d.exclude)
        ne = Math.max(primary.start + TL.MIN_DUR, ne)
        TL.updateClip(d.id, { duration: ne - primary.start })
        this._showSnap(ne !== primary.start + primary.duration + dx / pps ? c : null, ne)
      }
    }
    getPlayer()?.evaluateNow()
  }

  _showSnap (on, t) {
    if (!this.snapLine) return
    this.snapLine.style.display = on ? 'block' : 'none'
    if (on) this.snapLine.style.transform = `translateX(${t * this.pps}px)`
  }

  _onUp () {
    const d = this._drag
    if (!d) return
    this._drag = null
    this._showSnap(null)
    if (d.kind === 'scrub') TL.endScrub()
  }

  _onLaneDbl (e) {
    const lane = e.target.closest('.otv-lane.is-sub')
    if (!lane || !lane.dataset.prop) return
    const t = this.timeAt(e.clientX)
    const c = TL.getClips().find(x => x.trackId === lane.dataset.track && t >= x.start && t <= x.start + x.duration)
    if (c && !this._locked(c)) this.addKeyAt(c, lane.dataset.prop, TL.snapTime(t, SNAP_PX / this.pps, null))
  }

  _onContext (e) {
    e.preventDefault()
    const kfEl = e.target.closest('.otv-kf')
    const clipEl = e.target.closest('.otv-clip')
    if (kfEl) {
      const id = kfEl.dataset.key
      this._openMenu(e, [
        ...TL.EASES.map(z => [`Ease: ${z}`, () => TL.updateKey(id, { ease: z })]),
        ['—'],
        ['Delete keyframe', () => { TL.removeKey(id); getPlayer()?.evaluateNow() }],
      ])
      return
    }
    if (!clipEl) return
    const id = clipEl.dataset.clip
    const c = TL.getClip(id)
    if (!c) return
    if (!this.sel.clips.has(id)) this._setSel('clips', [id], false)
    this._openMenu(e, [
      ['Split at playhead', () => this.splitAtPlayhead()],
      ['Duplicate', () => this.duplicateSelected()],
      [c.loop ? 'Loop: on (turn off)' : 'Loop: off (turn on)', () => TL.updateClip(id, { loop: !c.loop })],
      ['Select node in scene', () => ev('omni:node-select-by-id', { id: c.nodeId })],
      ['—'],
      ['Delete', () => this.deleteSelected()],
    ])
  }

  // ── context menu ──────────────────────────────────────────────────────────

  _openMenu (e, items) {
    this._closeMenu()
    const m = el('div', 'otv-menu')
    for (const [label, fn] of items) {
      if (label === '—') { m.appendChild(el('hr')); continue }
      const b = el('button', null, label); b.type = 'button'
      b.addEventListener('click', () => { this._closeMenu(); try { fn() } catch (err) { console.warn('⟐Timeline menu action failed', err) } })
      m.appendChild(b)
    }
    const r = this.root.getBoundingClientRect()
    m.style.left = Math.max(0, Math.min(e.clientX - r.left, r.width - 180)) + 'px'
    m.style.top = Math.max(0, Math.min(e.clientY - r.top, r.height - 40 - items.length * 26)) + 'px'
    this.root.appendChild(m)
    this._menu = m
  }

  _closeMenu () { this._menu?.remove(); this._menu = null }

  // ── keyboard (called by ui/OmniChronos.js only while the window is hovered / focused) ──

  /** Returns true when the key was used. */
  handleKey (e) {
    if (!this.root) return false
    const k = e.key
    const lower = k.length === 1 ? k.toLowerCase() : k
    const mod = e.ctrlKey || e.metaKey || e.altKey
    if (mod) return false
    switch (true) {
      case k === ' ': TL.togglePlay(); return true
      case k === 'ArrowLeft': TL.step(e.shiftKey ? -TL.FPS : -1); getPlayer()?.evaluateNow(); return true
      case k === 'ArrowRight': TL.step(e.shiftKey ? TL.FPS : 1); getPlayer()?.evaluateNow(); return true
      case k === 'Home': TL.seek(TL.getState().workArea.in ?? 0); getPlayer()?.evaluateNow(); return true
      case k === 'End': TL.seek(TL.getState().workArea.out ?? getPlayer()?.projectEnd() ?? 0); getPlayer()?.evaluateNow(); return true
      case lower === 'i': { const o = TL.getState().workArea.out; TL.setWorkArea(TL.getT(), o != null && o > TL.getT() ? o : null); return true }
      case lower === 'o': { const i = TL.getState().workArea.in; const t = TL.getT(); TL.setWorkArea(i != null && i < t ? i : null, t); return true }
      case lower === 'm': ev('omni:timeline-marker-add', { t: TL.getT() }); return true
      case lower === 'c': this.splitAtPlayhead(); return true
      case k === 'Delete' || k === 'Backspace': return this.deleteSelected() > 0
      case k === '+' || k === '=': this.zoomBy(1.4); return true
      case k === '-' || k === '_': this.zoomBy(1 / 1.4); return true
      case k === 'Escape': if (this._menu) { this._closeMenu(); return true } this.clearSelection(); return false
    }
    return false
  }
}
