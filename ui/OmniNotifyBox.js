/**
 * ui/OmniNotifyBox.js — ⟐OmniNotify hover-info box (V169)
 *
 * The visible half of ⟐OmniNotify. It grows the old ⟐Notify column (ui/GlobalBar.js
 * #ob-col-notify + the ui/OmniNotifyPanel.js drop-down feed, both unchanged) with an Apple-Logic-
 * inspector style box: hover / focus / long-press anything that carries data-omni-tip and this box
 * shows its NAME, its shortcut chip and a description (model + delegation: utils/OmniNotifyHub.js).
 * Idle, it shows the latest `omni:notify-push` text instead. Clicking that notification line opens
 * the existing feed (`omni:notify-panel-toggle`).
 *
 * Placement (measured, not guessed):
 *   side   desktop default. Docked right under the "Current State" column (#ob-col03's left edge),
 *          same height as the ribbon; the ribbon starts to its right (utils/OmniLayout
 *          --omni-ribbon-left). Used only while at least MIN_RIBBON px remain for the ribbon.
 *   under  too narrow for side (or a phone): a small floating box just under the ribbon.
 *   float  the person dragged it: stays where they put it; the ribbon gets the full width back.
 *          Double-click the header to dock it again.
 * Phones (<= 700px): collapsed by default (header + the current name inline); the chevron expands it;
 * no resize grip on touch.
 *
 * Drag = Pointer Events on the header (mouse + touch). Resize = the bottom-right grip (width only
 * while docked at the side, where the height follows the ribbon). Position / size / collapsed state
 * persist in localStorage 'omni:notify-box-v1' and are clamped into the viewport on load / resize.
 *
 * Module contract: constructor / init / update / destroy / onResize.
 */

import * as Hub from '../utils/OmniNotifyHub.js'
import { BAR_H, getTopOffset, getRibbonHeight, setRibbonInset } from '../utils/OmniLayout.js'

export const STORAGE_KEY = 'omni:notify-box-v1'
export const HEADER_H   = 28
export const MIN_W      = 200
export const MAX_W      = 560
export const MIN_H      = HEADER_H + 56
export const MAX_H      = 420
export const DEFAULT_W  = 260
export const MIN_RIBBON = 520       // px the ribbon needs next to the box, or the box drops under it
export const GAP        = 8
export const PHONE_MAX  = 700
const COL03_FALLBACK_LEFT = 222     // 64 (Col00) + 48 (Col01) + 110 (Col02) — GlobalBar's fixed widths

const IDLE_DESC = 'Hover any tool, button or icon to see its name, shortcut and what it does.'

const STYLES = /* css */`
#omni-notify-box {
  --onb-bg     : var(--omni-theme-bg, rgba(10, 10, 14, 0.80));
  --onb-border : var(--omni-theme-border, rgba(255, 255, 255, 0.12));
  --onb-text   : var(--omni-theme-text, rgba(255, 255, 255, 0.95));
  --onb-dim    : var(--omni-theme-text-dim, rgba(255, 255, 255, 0.68));
  --onb-accent : var(--omni-theme-accent, rgba(255, 255, 255, 0.92));
  --onb-head   : var(--omni-theme-header-bg, rgba(255, 255, 255, 0.05));
  --mono       : 'Courier New', Courier, monospace;

  position: fixed; left: 0; top: ${BAR_H}px; width: ${DEFAULT_W}px; height: ${HEADER_H}px;
  z-index: 51; box-sizing: border-box; overflow: hidden;
  display: flex; flex-direction: column;
  background: var(--onb-bg);
  backdrop-filter: blur(18px) saturate(1.4); -webkit-backdrop-filter: blur(18px) saturate(1.4);
  border: 1px solid var(--onb-border); border-radius: 0 0 8px 8px;
  box-shadow: 0 6px 20px rgba(0,0,0,0.35);
  font-family: var(--mono); color: var(--onb-text);
  pointer-events: auto; user-select: none; -webkit-font-smoothing: antialiased;
}
#omni-notify-box[data-mode="float"] { border-radius: 8px; }
#omni-notify-box.is-dragging { box-shadow: 0 10px 30px rgba(0,0,0,0.55); opacity: 0.96; }
#omni-notify-box.is-flash .onb-head { background: rgba(255,255,255,0.16); }

.onb-head {
  flex: 0 0 ${HEADER_H}px; height: ${HEADER_H}px; display: flex; align-items: center; gap: 6px;
  padding: 0 6px 0 8px; background: var(--onb-head);
  border-bottom: 1px solid var(--onb-border);
  cursor: grab; touch-action: none; transition: background 0.4s ease;
}
.onb-head:active { cursor: grabbing; }
.onb-grip  { color: var(--onb-dim); font-size: 11px; letter-spacing: -2px; flex-shrink: 0; }
.onb-title { font-size: 10px; letter-spacing: 0.06em; text-transform: uppercase; white-space: nowrap; flex-shrink: 0; }
.onb-inline { display: none; flex: 1; min-width: 0; font-size: 10px; color: var(--onb-dim); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.onb-spacer { flex: 1; }
.onb-chev {
  flex: 0 0 22px; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center;
  background: none; border: 1px solid transparent; border-radius: 5px; color: var(--onb-dim);
  font-size: 11px; cursor: pointer; padding: 0; font-family: var(--mono); transition: transform 0.15s ease;
}
.onb-chev:hover { color: var(--onb-text); background: rgba(255,255,255,0.08); }
#omni-notify-box[data-collapsed="true"] .onb-chev { transform: rotate(-90deg); }

.onb-body { flex: 1; min-height: 0; padding: 6px 10px 6px; overflow-y: auto; scrollbar-width: thin; user-select: text; -webkit-user-select: text; }
#omni-notify-box[data-collapsed="true"] .onb-body,
#omni-notify-box[data-collapsed="true"] .onb-resize { display: none; }
.onb-top  { display: flex; align-items: center; gap: 8px; min-height: 18px; }
.onb-name { flex: 1; min-width: 0; font-size: 14px; font-weight: bold; line-height: 1.25; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.onb-key  {
  flex-shrink: 0; font-family: var(--mono); font-size: 10px; line-height: 1; padding: 3px 6px;
  border: 1px solid var(--onb-border); border-bottom-width: 2px; border-radius: 4px;
  background: rgba(255,255,255,0.08); color: var(--onb-text); white-space: nowrap;
}
.onb-key[hidden] { display: none; }
.onb-src  { font-size: 9px; color: var(--onb-dim); text-transform: uppercase; letter-spacing: 0.06em; margin-top: 1px; min-height: 0; }
.onb-src:empty { display: none; }
.onb-desc { font-size: 10.5px; line-height: 1.4; color: var(--onb-dim); margin-top: 3px; overflow-wrap: anywhere; }
.onb-note {
  display: block; margin-top: 5px; padding-top: 4px; border-top: 1px dashed var(--onb-border);
  font-size: 9.5px; color: var(--onb-dim); cursor: pointer; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.onb-note:empty { display: none; }
.onb-note:hover { color: var(--onb-text); }

.onb-resize {
  position: absolute; right: 0; bottom: 0; width: 16px; height: 16px; cursor: nwse-resize; touch-action: none;
  background: linear-gradient(135deg, transparent 0 55%, var(--onb-dim) 55% 62%, transparent 62% 72%, var(--onb-dim) 72% 79%, transparent 79%);
  opacity: 0.7;
}
.onb-resize:hover { opacity: 1; }

@media (max-width: ${PHONE_MAX}px) {
  .onb-inline { display: block; }
  .onb-resize { display: none !important; }
  .onb-spacer { display: none; }
  .onb-chev { flex-basis: 30px; width: 30px; height: 26px; }
  .onb-desc { font-size: 11px; }
}
`

function injectStyles () {
  if (document.getElementById('omni-notify-box-styles')) return
  const tag = document.createElement('style')
  tag.id = 'omni-notify-box-styles'
  tag.textContent = STYLES
  document.head.appendChild(tag)
}

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), Math.max(lo, hi))
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null)

export default class OmniNotifyBox {
  constructor (context) {
    this.ctx = context
    this._el = null
    this._s = { docked: true, x: null, y: null, w: null, h: null, collapsed: null }
    this._unsub = null
    this._flashTimer = null
    this._raf = 0
    this._drag = null
  }

  // ── Module contract ─────────────────────────────────────────────────────

  init () {
    if (document.getElementById('omni-notify-box')) { this._dup = true; return }   // already mounted (defence only — UI.init now runs once, V170)
    injectStyles()
    Hub.install()
    this._load()
    this._build()
    this._unsub = Hub.subscribe((st) => this._render(st))
    this._render(Hub.getState())

    this._onResizeWin = () => this.onResize()
    window.addEventListener('resize', this._onResizeWin)
    this._onLayout = () => this._layoutSoon()
    window.addEventListener('omni:layout-changed', this._onLayout)
    this._onPush = () => this._flash()
    window.addEventListener('omni:notify-push', this._onPush)
    this._layout()
  }

  update () {}

  onResize () { this._layout() }

  destroy () {
    if (this._dup) return
    this._unsub?.()
    window.removeEventListener('resize', this._onResizeWin)
    window.removeEventListener('omni:layout-changed', this._onLayout)
    window.removeEventListener('omni:notify-push', this._onPush)
    this._endDrag()
    clearTimeout(this._flashTimer)
    if (typeof cancelAnimationFrame === 'function' && this._raf) cancelAnimationFrame(this._raf)
    setRibbonInset(0)
    Hub.uninstall()
    this._el?.remove()
    document.getElementById('omni-notify-box-styles')?.remove()
  }

  // ── Public ──────────────────────────────────────────────────────────────

  getState () { return { ...this._s, mode: this._el?.dataset.mode, collapsed: this.isCollapsed() } }
  isPhone () { return (window.innerWidth || 1024) <= PHONE_MAX }
  isCollapsed () { return this._s.collapsed ?? this.isPhone() }

  setCollapsed (v) {
    this._s.collapsed = !!v
    this._save()
    this._layout()
  }

  dock () {
    Object.assign(this._s, { docked: true, x: null, y: null, h: null })
    this._save()
    this._layout()
  }

  // ── Persistence ─────────────────────────────────────────────────────────

  _load () {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
      if (!raw || typeof raw !== 'object') return
      const s = this._s
      s.docked = raw.docked !== false
      s.x = num(raw.x); s.y = num(raw.y); s.w = num(raw.w); s.h = num(raw.h)
      s.collapsed = typeof raw.collapsed === 'boolean' ? raw.collapsed : null
      if (!s.docked && (s.x === null || s.y === null)) s.docked = true   // a floating box needs a position
    } catch (_) {}
  }

  _save () {
    try {
      const s = this._s
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        v: 1, docked: s.docked, x: s.x, y: s.y, w: s.w, h: s.h, collapsed: s.collapsed,
      }))
    } catch (_) {}
  }

  // ── DOM ─────────────────────────────────────────────────────────────────

  _build () {
    const el = document.createElement('div')
    el.id = 'omni-notify-box'
    el.setAttribute('role', 'status')
    el.setAttribute('aria-live', 'polite')
    el.innerHTML = /* html */`
      <div class="onb-head" data-omni-tip="OmniNotify box" data-omni-tip-key="Drag · double-click to dock"
           data-omni-tip-desc="Shows what you point at (name, shortcut, description) and the latest notification. Drag the header to move it, the corner to resize it, double-click the header to dock it back under Current State.">
        <span class="onb-grip" aria-hidden="true">⠿</span>
        <span class="onb-title">⟐OmniNotify</span>
        <span class="onb-inline"></span>
        <span class="onb-spacer"></span>
        <button type="button" class="onb-chev" aria-label="Expand or collapse OmniNotify" aria-expanded="true"
                data-omni-tip="Collapse OmniNotify" data-omni-tip-key="—"
                data-omni-tip-desc="Folds the box down to its header (on phones it starts folded)">▾</button>
      </div>
      <div class="onb-body">
        <div class="onb-top"><div class="onb-name"></div><kbd class="onb-key" hidden></kbd></div>
        <div class="onb-src"></div>
        <div class="onb-desc"></div>
        <div class="onb-note" role="button" tabindex="0" title="Open the notification feed"></div>
      </div>
      <div class="onb-resize" aria-hidden="true"></div>
    `
    this._el = el
    this._q = {
      head: el.querySelector('.onb-head'), chev: el.querySelector('.onb-chev'),
      inline: el.querySelector('.onb-inline'), name: el.querySelector('.onb-name'),
      key: el.querySelector('.onb-key'), src: el.querySelector('.onb-src'),
      desc: el.querySelector('.onb-desc'), note: el.querySelector('.onb-note'),
      grip: el.querySelector('.onb-resize'),
    }
    ;(document.getElementById('omni-ui') ?? document.body).appendChild(el)

    this._q.chev.addEventListener('click', (e) => { e.stopPropagation(); this.setCollapsed(!this.isCollapsed()) })
    this._q.head.addEventListener('dblclick', (e) => { if (!e.target.closest('.onb-chev')) this.dock() })
    this._q.head.addEventListener('pointerdown', (e) => this._beginDrag(e, 'move'))
    this._q.grip.addEventListener('pointerdown', (e) => this._beginDrag(e, 'size'))
    const openFeed = () => window.dispatchEvent(new CustomEvent('omni:notify-panel-toggle'))
    this._q.note.addEventListener('click', openFeed)
    this._q.note.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openFeed() } })
  }

  // ── Render (hub state -> text) ──────────────────────────────────────────

  _render (st) {
    const q = this._q
    if (!q) return
    const time = (t) => new Date(t).toLocaleTimeString()
    let name, key = '', src = '', desc, note = ''
    if (st.mode === 'info' && st.info) {
      name = st.info.name; key = st.info.key || '—'; src = st.info.source
      desc = st.info.desc || 'No description yet.'
      if (st.note) note = `⟐ ${st.note.text}`
    } else if (st.note) {
      name = 'Latest notification'; desc = st.note.text; src = time(st.note.time)
    } else {
      name = '⟐OmniNotify'; desc = IDLE_DESC
    }
    q.name.textContent = name
    q.key.textContent = key
    q.key.hidden = !key
    q.src.textContent = src
    q.desc.textContent = desc
    q.note.textContent = note
    q.inline.textContent = st.mode === 'info' && st.info ? st.info.name : (st.note ? st.note.text : '')
  }

  _flash () {
    if (!this._el) return
    this._el.classList.add('is-flash')
    clearTimeout(this._flashTimer)
    this._flashTimer = setTimeout(() => this._el?.classList.remove('is-flash'), 700)
  }

  // ── Layout ──────────────────────────────────────────────────────────────

  _layoutSoon () {
    if (typeof requestAnimationFrame !== 'function') return this._layout()
    if (this._raf) return
    this._raf = requestAnimationFrame(() => { this._raf = 0; this._layout() })
  }

  _col03Left () {
    const r = document.getElementById('ob-col03')?.getBoundingClientRect?.()
    return r && r.width > 0 ? Math.round(r.left) : COL03_FALLBACK_LEFT
  }

  /** The measuring step: where does the box go, and how much room is left for the ribbon? */
  computePlacement () {
    const vw = window.innerWidth || 1024
    const vh = window.innerHeight || 768
    const phone = vw <= PHONE_MAX
    const collapsed = this.isCollapsed()
    const s = this._s
    let w = s.w ?? DEFAULT_W
    if (phone) w = collapsed ? Math.min(200, vw - 16) : Math.min(320, vw - 16)
    w = clamp(w, Math.min(MIN_W, vw - 8), Math.min(MAX_W, vw - 8))

    if (!s.docked) {
      const h = collapsed ? HEADER_H : clamp(s.h ?? 110, MIN_H, Math.min(MAX_H, vh - BAR_H - 60))
      const x = clamp(s.x ?? 8, 0, vw - w)
      const y = clamp(s.y ?? BAR_H, BAR_H, vh - 52 - HEADER_H)
      return { mode: 'float', x, y, w, h, inset: 0, collapsed }
    }
    const left = this._col03Left()
    if (!phone && vw - (left + w + GAP) >= MIN_RIBBON) {
      const ribbonH = getRibbonHeight() || 96
      return { mode: 'side', x: left, y: BAR_H, w, h: collapsed ? HEADER_H : Math.max(HEADER_H, ribbonH), inset: left + w + GAP, collapsed }
    }
    const h = collapsed ? HEADER_H : clamp(s.h ?? 110, MIN_H, Math.min(MAX_H, vh - getTopOffset() - 60))
    const x = phone ? 8 : Math.round((vw - w) / 2)
    return { mode: 'under', x, y: getTopOffset() + 6, w, h, inset: 0, collapsed }
  }

  _layout () {
    if (!this._el) return
    const p = this.computePlacement()
    const st = this._el.style
    st.left = `${Math.round(p.x)}px`; st.top = `${Math.round(p.y)}px`
    st.width = `${Math.round(p.w)}px`; st.height = `${Math.round(p.h)}px`
    this._el.dataset.mode = p.mode
    this._el.dataset.collapsed = String(p.collapsed)
    this._q.chev.setAttribute('aria-expanded', String(!p.collapsed))
    this._q.chev.dataset.omniTip = p.collapsed ? 'Expand OmniNotify' : 'Collapse OmniNotify'
    this._placement = p
    setRibbonInset(p.inset)
  }

  // ── Drag / resize (Pointer Events: mouse + touch) ───────────────────────

  _beginDrag (e, kind) {
    if (e.button > 0) return
    if (kind === 'move' && e.target.closest?.('.onb-chev')) return
    if (kind === 'size' && this.isPhone()) return
    const rect = this._el.getBoundingClientRect()
    const p = this._placement ?? this.computePlacement()
    // jsdom (and a not-yet-laid-out box) report zeros — fall back to the computed placement.
    const base = rect.width > 0 ? { x: rect.left, y: rect.top, w: rect.width, h: rect.height } : { x: p.x, y: p.y, w: p.w, h: p.h }
    this._drag = { kind, px: e.clientX, py: e.clientY, base, moved: false, id: e.pointerId }
    try { e.target.setPointerCapture?.(e.pointerId) } catch (_) {}
    this._onMove = (ev) => this._moveDrag(ev)
    this._onUp = () => this._endDrag(true)
    window.addEventListener('pointermove', this._onMove)
    window.addEventListener('pointerup', this._onUp)
    window.addEventListener('pointercancel', this._onUp)
  }

  _moveDrag (e) {
    const d = this._drag
    if (!d) return
    const dx = e.clientX - d.px, dy = e.clientY - d.py
    if (!d.moved && Math.hypot(dx, dy) < 4) return
    d.moved = true
    const vw = window.innerWidth || 1024, vh = window.innerHeight || 768
    const s = this._s
    this._el.classList.add('is-dragging')
    if (d.kind === 'move') {
      if (s.docked) {                       // first real movement undocks it (the ribbon gets the full width back)
        s.docked = false
        s.w = d.base.w; s.h = d.base.h
      }
      s.x = clamp(d.base.x + dx, 0, vw - d.base.w)
      s.y = clamp(d.base.y + dy, BAR_H, vh - 52 - HEADER_H)
    } else {
      s.w = clamp(d.base.w + dx, MIN_W, Math.min(MAX_W, vw - d.base.x))
      if (!(s.docked && this._placement?.mode === 'side')) {   // docked at the side: the height follows the ribbon
        s.h = clamp(d.base.h + dy, MIN_H, Math.min(MAX_H, vh - d.base.y - 4))
        if (this.isCollapsed()) s.collapsed = false
      }
    }
    this._layout()
  }

  _endDrag (commit = false) {
    const d = this._drag
    window.removeEventListener('pointermove', this._onMove)
    window.removeEventListener('pointerup', this._onUp)
    window.removeEventListener('pointercancel', this._onUp)
    this._drag = null
    this._el?.classList.remove('is-dragging')
    if (commit && d?.moved) this._save()
  }
}
