/**
 * utils/OmniWindowChrome.js — resize + maximize for EVERY panel window (V187)
 *
 * ONE central mechanism instead of per-panel code. ui/WindowManager.js calls enhanceWindow(el, opts) from register(),
 * so every panel that registers there (about 70 of them) gets, without a line of its own code:
 *   - 8 resize handles (4 edges + 4 corners), pointer events with pointer capture (mouse, pen and touch), rAF-throttled;
 *   - a maximize / restore button injected into the header's control cluster (next to minimize / close), plus
 *     double-click on the header;
 *   - min size (220 x 120 or the panel's own CSS min-width / min-height if larger) and a max of the free area,
 *     so a window can never be dragged under the bar / ribbon / dock or off the viewport;
 *   - the last size per window id in localStorage 'omni:window-rects-v1' (size only; never maximized; validated + clamped).
 * Panels that do not register call enhanceWindow() themselves (see docs/architecture/WINDOW_CHROME_DESIGN.md).
 *
 * Pure helpers (clampRect / resizeRect / sanitizeRects / maximizedRect ...) are exported for the jsdom tests.
 * No dependencies except utils/OmniLayout.js. Nothing here runs per frame: handlers exist only while a gesture is active.
 *
 * Rules worth knowing:
 *   - Every rect write is an INLINE style with `!important`, because the phone bottom-sheet CSS of several panels uses
 *     `left:0 !important; top:auto !important` and would otherwise win. Legacy per-panel drag code writes plain inline
 *     left/top, which replaces the declaration (priority included), so dragging keeps working.
 *   - Maximize remembers the exact inline value + priority of every property it touches and puts them back on restore.
 *   - A legacy per-panel SE resize grip (`[class*="resize-handle"]`) is hidden, so a window has ONE resize affordance.
 *   - Maximized area = full width, from the top of the hands banner stack (`getTopStack()`, so the top hands stay visible)
 *     down to the dock. The window keeps its own z-index inside #omni-ui, so modal pickers (65) and the grid (80) stay above.
 *   - Esc and Alt+Enter are NOT bound (Esc closes panels, drawers and pickers elsewhere); the button and header
 *     double-click are the gestures.
 */

import { getTopOffset, getTopStack, PHONE_MAX } from './OmniLayout.js'

export const RECTS_KEY = 'omni:window-rects-v1'
export const MAX_ENTRIES = 100
export const MIN_W = 220
export const MIN_H = 120
const ABS_MAX = 10000
const STYLE_ID = 'omni-window-chrome-styles'
const DIRS = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']
const CURSORS = { n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize', ne: 'nesw-resize', sw: 'nesw-resize', nw: 'nwse-resize', se: 'nwse-resize' }
const TOUCHED = ['left', 'top', 'width', 'height', 'right', 'bottom', 'max-width', 'max-height', 'min-width', 'min-height', 'margin', 'transform', 'transition-property']
const MAX_GLYPH = '⛶'
const RESTORE_GLYPH = '❐'

const states = new WeakMap()        // el -> state
const live = new Set()              // every enhanced el (for resetWindowSizes / refit)

// ── Pure helpers ──────────────────────────────────────────────────────────────

const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d)
export const clamp = (v, lo, hi) => (lo > hi ? lo : Math.min(hi, Math.max(lo, v)))

/** The free area a window may occupy while resizing: below the bar + ribbon, above the dock, inside the viewport. */
export function getResizeArea () {
  const W = num(typeof window !== 'undefined' ? window.innerWidth : 1280, 1280)
  const H = num(typeof window !== 'undefined' ? window.innerHeight : 720, 720)
  const dt = dockTop(H)
  const top = Math.min(getTopOffset(), Math.max(0, dt - MIN_H))
  const bottom = Math.max(top + 40, dt)
  return { left: 0, top, right: W, bottom, width: W, height: bottom - top }
}

/** The area a MAXIMIZED window fills: full width, below the top hands banner (when shown), above the dock. */
export function getMaximizeArea () {
  const r = getResizeArea()
  const top = Math.min(Math.max(r.top, getTopStack()), Math.max(r.top, r.bottom - MIN_H))
  return { left: r.left, top, right: r.right, bottom: r.bottom, width: r.width, height: r.bottom - top }
}

function dockTop (H) {
  try {
    const d = typeof document !== 'undefined' ? document.getElementById('omni-dock') : null
    if (d) {
      const cs = getComputedStyle(d)
      const r = d.getBoundingClientRect()
      if (cs.display !== 'none' && cs.visibility !== 'hidden' && r.height > 0 && r.top > H * 0.4 && r.top <= H) return Math.round(r.top)
    }
  } catch (_) { /* no dock */ }
  return H
}

/** Size limits for a window: our defaults or the panel's own CSS min-*, whichever is larger, never above the area. */
export function minSizeFor (el, area, opts = {}) {
  let mw = num(opts.min?.w, MIN_W), mh = num(opts.min?.h, MIN_H)
  try {
    const cs = getComputedStyle(el)
    const cw = parseFloat(cs.minWidth), ch = parseFloat(cs.minHeight)
    if (Number.isFinite(cw) && cw > mw) mw = cw
    if (Number.isFinite(ch) && ch > mh) mh = ch
  } catch (_) { /* detached */ }
  return { w: Math.min(mw, area.width), h: Math.min(mh, area.height) }
}

/** New rect for a drag of `dir` by (dx, dy) from rect0, kept inside `area`, never below `min`. Pure. */
export function resizeRect (rect0, dir, dx, dy, area, min) {
  let l = rect0.left, t = rect0.top, r = rect0.left + rect0.width, b = rect0.top + rect0.height
  if (dir.includes('e')) r = clamp(r + dx, l + min.w, Math.max(area.right, l + min.w))
  if (dir.includes('w')) l = clamp(l + dx, Math.min(area.left, r - min.w), r - min.w)
  if (dir.includes('s')) b = clamp(b + dy, t + min.h, Math.max(area.bottom, t + min.h))
  if (dir.includes('n')) t = clamp(t + dy, Math.min(area.top, b - min.h), b - min.h)
  return { left: l, top: t, width: r - l, height: b - t }
}

/** Keep a rect inside the area (shift first, shrink only if it is bigger than the area). Pure. */
export function clampRect (rect, area, min = { w: MIN_W, h: MIN_H }) {
  const width = clamp(rect.width, Math.min(min.w, area.width), area.width)
  const height = clamp(rect.height, Math.min(min.h, area.height), area.height)
  return {
    left: clamp(rect.left, area.left, area.right - width),
    top: clamp(rect.top, area.top, area.bottom - height),
    width, height,
  }
}

export const maximizedRect = (area) => ({ left: area.left, top: area.top, width: area.width, height: area.height })

/** Validate the stored object: only { v:1, rects:{ id: {w,h,t} } } with finite, sane numbers; at most MAX_ENTRIES. Pure. */
export function sanitizeRects (raw) {
  const out = Object.create(null)
  let obj = raw
  if (typeof raw === 'string') { try { obj = JSON.parse(raw) } catch (_) { return out } }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj) || obj.v !== 1 || !obj.rects || typeof obj.rects !== 'object' || Array.isArray(obj.rects)) return out
  const rows = []
  for (const k of Object.keys(obj.rects)) {
    if (typeof k !== 'string' || !k || k.length > 80 || k === '__proto__' || k === 'constructor' || k === 'prototype') continue
    const e = obj.rects[k]
    if (!e || typeof e !== 'object') continue
    const w = Number(e.w), h = Number(e.h), t = Number(e.t)
    const okW = Number.isFinite(w) && w >= 80 && w <= ABS_MAX
    const okH = Number.isFinite(h) && h >= 60 && h <= ABS_MAX
    if (!okW && !okH) continue
    rows.push([k, { w: okW ? Math.round(w) : 0, h: okH ? Math.round(h) : 0, t: Number.isFinite(t) && t > 0 ? t : 0 }])
  }
  rows.sort((a, b) => b[1].t - a[1].t)                 // newest first; the cap drops the oldest
  for (const [k, v] of rows.slice(0, MAX_ENTRIES)) out[k] = v
  return out
}

// ── Persistence (size only) ───────────────────────────────────────────────────

export function loadRects () {
  try { return sanitizeRects(localStorage.getItem(RECTS_KEY)) } catch (_) { return Object.create(null) }
}
function writeRects (map) {
  try { localStorage.setItem(RECTS_KEY, JSON.stringify({ v: 1, rects: map })) } catch (_) { /* private mode / quota */ }
}
const isPhone = () => (typeof window !== 'undefined' ? window.innerWidth : 1280) <= PHONE_MAX
const keyFor = (id) => (isPhone() ? `${id}@p` : id)

/** Remember a window's size (phone sheets only keep the height; the key is separate per layout class). */
export function saveSize (id, w, h) {
  if (!id) return
  const map = loadRects()
  map[keyFor(id)] = { w: isPhone() ? 0 : Math.round(w), h: Math.round(h), t: Date.now() }
  writeRects(sanitizeRects({ v: 1, rects: map }))   // re-sanitize: applies the cap
}
export function getSavedSize (id) {
  if (!id) return null
  const e = loadRects()[keyFor(id)]
  return e ? { w: e.w || 0, h: e.h || 0 } : null
}
export function clearSavedSizes () { try { localStorage.removeItem(RECTS_KEY) } catch (_) { /* ignore */ } }

// ── Styles ────────────────────────────────────────────────────────────────────

const CSS = /* css */`
.omni-win-chrome { resize: none !important; }
.omni-win-rzs { position: absolute; inset: 0; pointer-events: none; z-index: 5; }
.omni-win-rz { position: absolute; pointer-events: auto; touch-action: none; background: transparent; }
.omni-win-rz[data-dir="n"]  { top: 0;    left: 14px; right: 14px; height: 6px; cursor: ns-resize; }
.omni-win-rz[data-dir="s"]  { bottom: 0; left: 14px; right: 14px; height: 6px; cursor: ns-resize; }
.omni-win-rz[data-dir="e"]  { right: 0;  top: 14px; bottom: 14px; width: 6px; cursor: ew-resize; }
.omni-win-rz[data-dir="w"]  { left: 0;   top: 14px; bottom: 14px; width: 6px; cursor: ew-resize; }
.omni-win-rz[data-dir="ne"] { top: 0;    right: 0;  width: 14px; height: 14px; cursor: nesw-resize; }
.omni-win-rz[data-dir="nw"] { top: 0;    left: 0;   width: 14px; height: 14px; cursor: nwse-resize; }
.omni-win-rz[data-dir="se"] { bottom: 0; right: 0;  width: 14px; height: 14px; cursor: nwse-resize; }
.omni-win-rz[data-dir="sw"] { bottom: 0; left: 0;   width: 14px; height: 14px; cursor: nesw-resize; }
.omni-win-rz[data-dir="se"]::after { content: ''; position: absolute; right: 3px; bottom: 3px; width: 7px; height: 7px; border-right: 2px solid rgba(255,255,255,.38); border-bottom: 2px solid rgba(255,255,255,.38); pointer-events: none; }
.omni-win-rz[data-dir="se"]:hover::after { border-color: rgba(255,255,255,.75); }
@media (pointer: coarse) {
  .omni-win-rz[data-dir="n"], .omni-win-rz[data-dir="s"] { height: 14px; left: 22px; right: 22px; }
  .omni-win-rz[data-dir="e"], .omni-win-rz[data-dir="w"] { width: 14px; top: 22px; bottom: 22px; }
  .omni-win-rz[data-dir="ne"], .omni-win-rz[data-dir="nw"], .omni-win-rz[data-dir="se"], .omni-win-rz[data-dir="sw"] { width: 22px; height: 22px; }
  .omni-win-rz[data-dir="se"]::after { right: 5px; bottom: 5px; width: 9px; height: 9px; }
}
.omni-win-chrome.omni-win-max .omni-win-rzs, .omni-win-chrome.omni-win-sheet .omni-win-rz:not([data-dir="n"]) { display: none; }
.omni-win-chrome.omni-win-sheet .omni-win-rz[data-dir="n"] { height: 14px; left: 0; right: 0; }
.omni-win-chrome.omni-win-sheet .omni-win-rz[data-dir="n"]::after { content: ''; position: absolute; left: 50%; top: 4px; width: 36px; height: 3px; margin-left: -18px; border-radius: 2px; background: rgba(255,255,255,.32); }
.omni-win-legacy-rz { display: none !important; }
.omni-win-header button, .omni-win-header [data-ctl] { z-index: 6; }
.omni-win-max-btn { flex: none; cursor: pointer; font: inherit; line-height: 1; padding: 0; }
.omni-win-max-btn:not([class*=" "]):not([class*="-ctrl"]) { width: 24px; height: 24px; border-radius: 5px; border: 1px solid rgba(255,255,255,.14); background: rgba(255,255,255,.05); color: inherit; }
@media (max-width: ${PHONE_MAX}px) { .omni-win-max-btn, [data-omni-win-max] { min-width: 36px; min-height: 36px; } }
html.omni-win-resizing, html.omni-win-resizing * { user-select: none !important; -webkit-user-select: none !important; }
html.omni-win-resizing iframe, html.omni-win-resizing canvas, html.omni-win-resizing video { pointer-events: none !important; }
`
function injectStyles () {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return
  const tag = document.createElement('style'); tag.id = STYLE_ID; tag.textContent = CSS; document.head.appendChild(tag)
}

// ── DOM helpers ───────────────────────────────────────────────────────────────

const HEADER_CLASS_RE = /(^|[-_\s])(header|titlebar|title-bar|head|hdr|hd|topbar|bar)($|[-_\s])/i
const CONTROL_RE = /(minimi[sz]e|close|dismiss)/i

/** Find the draggable header: [data-win-header], else the first child (or grandchild) whose class says header, else cursor grab / move. */
export function findHeader (el) {
  const explicit = el.querySelector('[data-win-header]')
  if (explicit) return explicit
  const level = [...el.children]
  const grand = []
  for (const c of level) for (const g of c.children) grand.push(g)
  for (const list of [level, grand]) {
    for (const c of list) {
      if (c.classList.contains('omni-win-rzs')) continue
      const cls = typeof c.className === 'string' ? c.className : ''
      if (HEADER_CLASS_RE.test(cls) || /(^|[-_\s])(header|titlebar)/i.test(cls) || /-(header|hd|head|titlebar)\b/i.test(cls)) return c
    }
    for (const c of list) {
      try { const cur = getComputedStyle(c).cursor; if (cur === 'grab' || cur === 'move') return c } catch (_) { /* detached */ }
    }
  }
  return null
}

function findExistingMaxButton (header) {
  if (!header) return null
  return header.querySelector('.omni-win-max-btn, .win-max-btn, [data-action="maximize"], [data-ctl="maximize"], [class*="ctrl--maximize"], [class*="maximize"]')
}

function controlAnchor (header) {
  const btns = [...header.querySelectorAll('button')]
  return btns.find(b => CONTROL_RE.test(`${b.getAttribute('aria-label') ?? ''} ${b.dataset?.ctl ?? ''} ${b.dataset?.action ?? ''} ${b.className} ${b.title ?? ''}`)) ?? null
}

function originOf (el) {
  const cs = getComputedStyle(el)
  if (cs.position === 'fixed') return { x: 0, y: 0 }
  const p = el.offsetParent
  if (!p || p === document.body || p === document.documentElement) return { x: 0, y: 0 }
  const r = p.getBoundingClientRect()
  return { x: r.left + p.clientLeft - p.scrollLeft, y: r.top + p.clientTop - p.scrollTop }
}

function snapshot (el) {
  const o = {}
  for (const p of TOUCHED) o[p] = [el.style.getPropertyValue(p), el.style.getPropertyPriority(p)]
  return o
}
function restoreSnapshot (el, snap) {
  for (const p of TOUCHED) {
    const [v, pr] = snap[p] ?? ['', '']
    el.style.removeProperty(p)
    if (p === 'margin') for (const side of ['top', 'right', 'bottom', 'left']) el.style.removeProperty('margin-' + side)
    if (v !== '') el.style.setProperty(p, v, pr)
  }
}
const imp = (el, p, v) => el.style.setProperty(p, v, 'important')

/** Write an explicit rect (viewport coordinates) as important inline styles. */
function applyRect (el, rect, origin) {
  imp(el, 'left', `${Math.round(rect.left - origin.x)}px`)
  imp(el, 'top', `${Math.round(rect.top - origin.y)}px`)
  imp(el, 'width', `${Math.round(rect.width)}px`)
  imp(el, 'height', `${Math.round(rect.height)}px`)
  imp(el, 'right', 'auto'); imp(el, 'bottom', 'auto')
  imp(el, 'max-width', 'none'); imp(el, 'max-height', 'none')
  imp(el, 'margin', '0')
  // a CSS min-width / min-height larger than the room we have (a 560 px keyboard on a 390 px phone) would win over the width we set: lift it
  try {
    const cs = getComputedStyle(el)
    if (parseFloat(cs.minWidth) > rect.width + 0.5) imp(el, 'min-width', '0')
    if (parseFloat(cs.minHeight) > rect.height + 0.5) imp(el, 'min-height', '0')
  } catch (_) { /* detached */ }
}

/** Fold a pure-translate transform into left/top so explicit left/top mean what they say. */
function neutralizeTransform (el) {
  const t = getComputedStyle(el).transform
  if (!t || t === 'none') return
  const m = /^matrix\(([^)]+)\)$/.exec(t)
  if (!m) return
  const [a, b, c, d] = m[1].split(',').map(Number)
  const [, , , , tx, ty] = m[1].split(',').map(Number)
  // a real translation (e.g. translate(-50%, -50%) centring) is folded into left/top; an identity matrix (gsap's resting state)
  // is left alone so panels that animate x / y / scale (slide-in drawers, open pops) keep animating.
  if (Math.abs(a - 1) < 1e-3 && Math.abs(d - 1) < 1e-3 && Math.abs(b) < 1e-3 && Math.abs(c) < 1e-3 && (Math.abs(tx) > 0.5 || Math.abs(ty) > 0.5)) {
    el.style.setProperty('transform', 'none', 'important')
    // a panel that animates its transform (open pop) must not animate the fold-in, or it would visibly slide from the old translate to none
    try { const tp = getComputedStyle(el).transitionProperty || ''; if (/\b(all|transform)\b/.test(tp)) el.style.setProperty('transition-property', 'opacity, visibility, background-color, border-color, box-shadow', 'important') } catch (_) { /* detached */ }
  }
}

const rectOf = (el) => { const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height } }

// ── enhanceWindow ─────────────────────────────────────────────────────────────

/**
 * Give a panel root resize handles + a maximize button. Idempotent per element (a second call returns the same disposer).
 * @param {HTMLElement} el  panel root (position: fixed | absolute)
 * @param {object} [opts]   { id, header, min:{w,h}, onWindowResize(rect), onMaximize(), onRestore(), noButton, noDblClick }
 * @returns {() => void} disposer
 */
export function enhanceWindow (el, opts = {}) {
  if (!el || typeof el.appendChild !== 'function') return () => {}
  if (states.has(el)) {                  // idempotent: merge options (a later register() may bring the id / callbacks)
    const prev = states.get(el)
    Object.assign(prev.opts, opts)
    if (opts.id && opts.id !== prev.id) { prev.id = opts.id; if (!prev.sized) applySavedSize(prev) }
    prev.ensureParts?.()
    return prev.dispose
  }
  injectStyles()

  const st = {
    el, opts: { ...opts }, id: opts.id ?? el.dataset?.winId ?? el.id ?? '', header: null, btn: null, ownBtn: false,
    max: false, saved: null, orig: snapshot(el), sized: false, disposed: false, drag: null, raf: 0, obs: [], offs: [],
  }
  const on = (target, type, fn, o) => { target.addEventListener(type, fn, o); st.offs.push(() => target.removeEventListener(type, fn, o)) }

  el.classList.add('omni-win-chrome')
  // 1) handles (one container child)
  const rzs = document.createElement('div'); rzs.className = 'omni-win-rzs'; rzs.setAttribute('aria-hidden', 'true')
  for (const d of DIRS) { const h = document.createElement('div'); h.className = 'omni-win-rz'; h.dataset.dir = d; h.style.cursor = CURSORS[d]; rzs.appendChild(h) }
  el.appendChild(rzs)
  st.rzs = rzs

  const ensureParts = () => {
    if (st.disposed) return
    if (!rzs.parentNode) el.appendChild(rzs)                       // a panel that re-renders its root children wiped them
    for (const lg of el.querySelectorAll('[class*="resize-handle"]:not(.omni-win-rz)')) lg.classList.add('omni-win-legacy-rz')
    const hdr = st.opts.header ?? (st.header && el.contains(st.header) ? st.header : findHeader(el))
    if (hdr && hdr !== st.header) {
      st.header = hdr; hdr.classList.add('omni-win-header')
      if (!st.opts.noDblClick) { const fn = (e) => { if (e.target.closest('button, input, select, textarea, a, [contenteditable="true"], .omni-win-rz')) return; toggleMaximize(el) }; hdr.addEventListener('dblclick', fn); st.offs.push(() => hdr.removeEventListener('dblclick', fn)) }
    }
    if (st.header && !st.opts.noButton && !(st.btn && st.header.contains(st.btn))) {
      const existing = findExistingMaxButton(st.header)
      if (existing) { st.btn = existing; st.ownBtn = false; wireButton(st, existing) } else { st.btn = buildButton(st); st.ownBtn = true }
    }
    syncButton(st)
  }
  st.ensureParts = ensureParts
  ensureParts()

  // shallow observers: the root's children (handles / header replaced) and the header's children (buttons re-rendered)
  if (typeof MutationObserver !== 'undefined') {
    let queued = false
    const cb = () => { if (queued) return; queued = true; (typeof requestAnimationFrame === 'function' ? requestAnimationFrame : setTimeout)(() => { queued = false; ensureParts(); watchHeader() }) }
    const mo = new MutationObserver(cb); mo.observe(el, { childList: true }); st.obs.push(mo)
    let mh = null, watched = null
    const watchHeader = () => { if (st.header && st.header !== watched) { mh?.disconnect(); watched = st.header; mh = new MutationObserver(cb); mh.observe(st.header, { childList: true }); st.obs.push(mh) } }
    watchHeader(); st.watchHeader = watchHeader
  }

  // 2) resize gestures
  on(rzs, 'pointerdown', (e) => startResize(st, e))
  // 3) while maximized the header must not start a legacy drag
  const stopDrag = (e) => { if (st.max && st.header && st.header.contains(e.target) && !e.target.closest('button, input, select, textarea, a')) e.stopPropagation() }
  on(el, 'mousedown', stopDrag, true); on(el, 'touchstart', stopDrag, { capture: true, passive: true })
  // a touch / click on a phone panel that sits partly off-screen pulls it fully into view (once)
  on(el, 'pointerdown', () => { if (!st.sized && !st.max) ensureInView(el) }, true)
  // 4) keep things inside the viewport
  const refit = () => refitWindow(st)
  on(window, 'resize', refit); on(window, 'omni:layout-changed', refit)
  // 5) per-panel resize hook + saved size
  if (typeof ResizeObserver !== 'undefined' && (st.opts.onWindowResize || st.opts.observe !== false)) {
    let last = ''
    const ro = new ResizeObserver(() => {
      if (st.disposed) return
      const r = el.getBoundingClientRect(); const k = `${Math.round(r.width)}x${Math.round(r.height)}`
      if (k === last) return; const first = last === ''; last = k
      if (first) return
      announceResize(st)
    })
    ro.observe(el); st.obs.push(ro)
  }
  applySavedSize(st)

  st.dispose = () => {
    if (st.disposed) return
    st.disposed = true
    cancelGesture(st)
    for (const o of st.obs) o.disconnect()
    for (const off of st.offs) off()
    st.rzs?.remove()
    if (st.ownBtn) st.btn?.remove()
    st.header?.classList.remove('omni-win-header')
    if (st.max) { restoreSnapshot(el, st.saved ?? st.orig); el.classList.remove('omni-win-max', 'win-maximized'); delete el.dataset.omniMaximized }
    el.classList.remove('omni-win-chrome', 'omni-win-sheet')
    live.delete(el); states.delete(el)
  }
  states.set(el, st); live.add(el)
  return st.dispose
}

/** Use an existing header button (e.g. one a panel already built for makeMaximizable) as THE maximize control of this window. */
export function adoptButton (el, btn) {
  const st = states.get(el)
  if (!st || !btn) return false
  if (st.btn && st.btn !== btn && st.ownBtn) st.btn.remove()
  st.btn = btn; st.ownBtn = false
  wireButton(st, btn); syncButton(st)
  return true
}
export function isEnhanced (el) { return states.has(el) }
export function getWindowState (el) {
  const st = states.get(el)
  if (!st) return null
  return { id: st.id, maximized: st.max, sized: st.sized, hasHeader: !!st.header, hasButton: !!st.btn, handles: st.rzs ? st.rzs.querySelectorAll('.omni-win-rz').length : 0, button: st.btn }
}
export function isMaximized (el) { return !!states.get(el)?.max }

// ── Maximize button ───────────────────────────────────────────────────────────

function buildButton (st) {
  const b = document.createElement('button')
  b.type = 'button'
  const anchor = controlAnchor(st.header)
  // match the sibling control's look (class only: no data-* so delegated handlers ignore it)
  b.className = `${anchor && typeof anchor.className === 'string' ? anchor.className.replace(/\bis-[\w-]+\b/g, '').trim() : ''} omni-win-max-btn`.trim()
  b.dataset.omniWinMax = '1'
  b.textContent = MAX_GLYPH
  if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(b, anchor); else st.header.appendChild(b)
  // a copied class may carry `position: absolute; right: N` (a corner close button): shift the copy left of its sibling so the two never overlap
  try {
    if (anchor && getComputedStyle(b).position === 'absolute') {
      const cs = getComputedStyle(anchor)
      const w = Math.max(18, anchor.getBoundingClientRect().width || parseFloat(cs.width) || 0)
      if (cs.right && cs.right !== 'auto') b.style.right = `calc(${cs.right} + ${Math.round(w)}px + 4px)`
      else if (cs.left && cs.left !== 'auto') b.style.left = `calc(${cs.left} + ${Math.round(w)}px + 4px)`
      b.style.fontSize = cs.fontSize
    }
  } catch (_) { /* detached */ }
  wireButton(st, b)
  return b
}
function wireButton (st, b) {
  b.dataset.omniWinMax = '1'
  if (b.__omniWinWired) return                      // one click handler per button, however many paths found it
  b.__omniWinWired = true
  const fn = (e) => { e.preventDefault(); e.stopPropagation(); toggleMaximize(st.el) }
  b.addEventListener('click', fn); st.offs.push(() => { b.removeEventListener('click', fn); b.__omniWinWired = false })
}
function syncButton (st) {
  const b = st.btn
  if (!b) return
  const m = st.max
  b.textContent = m ? RESTORE_GLYPH : MAX_GLYPH
  b.setAttribute('aria-label', m ? 'Restore window size' : 'Maximize window')
  b.setAttribute('aria-pressed', m ? 'true' : 'false')
  b.title = m ? 'Restore' : 'Maximize'
  b.setAttribute('data-omni-tip', m ? 'Restore window' : 'Maximize window')
  b.setAttribute('data-omni-tip-key', 'Double-click the title bar')
  b.setAttribute('data-omni-tip-desc', m ? 'Puts the window back to the size and place it had before.' : 'Fills the free screen area below the ribbon and above the dock. Drag the edges or corners to resize instead.')
}

// ── Maximize / restore ────────────────────────────────────────────────────────

export function toggleMaximize (el) {
  const st = states.get(el)
  if (!st || st.disposed) return false
  return st.max ? restoreWindow(el) : maximizeWindow(el)
}

export function maximizeWindow (el) {
  const st = states.get(el)
  if (!st || st.disposed || st.max) return false
  cancelGesture(st)
  st.saved = snapshot(el)
  st.savedRect = rectOf(el)
  neutralizeTransform(el)
  st.max = true
  const area = getMaximizeArea()
  applyRect(el, maximizedRect(area), originOf(el))
  el.classList.add('omni-win-max', 'win-maximized'); el.dataset.omniMaximized = '1'
  syncButton(st)
  announceMax(st)
  st.opts.onMaximize?.()
  return true
}

export function restoreWindow (el) {
  const st = states.get(el)
  if (!st || st.disposed || !st.max) return false
  st.max = false
  restoreSnapshot(el, st.saved ?? st.orig)
  st.saved = null
  if (st.sized) refitWindow(st)                  // a window that overflowed the free area before is pulled back inside
  el.classList.remove('omni-win-max', 'win-maximized'); delete el.dataset.omniMaximized
  syncButton(st)
  announceMax(st)
  st.opts.onRestore?.()
  return true
}

function announceMax (st) {
  announceResize(st)
  try { window.dispatchEvent(new CustomEvent('omni:window-maximized-changed', { detail: { id: st.id, maximized: st.max } })) } catch (_) { /* no window */ }
}
function announceResize (st) {
  const r = rectOf(st.el)
  try { st.opts.onWindowResize?.(r) } catch (err) { console.warn('⟐ OmniWindowChrome — onWindowResize failed:', err) }
  try {
    st.el.dispatchEvent(new CustomEvent('omni:window-resized', { bubbles: false, detail: { id: st.id, rect: r, maximized: st.max } }))
    window.dispatchEvent(new CustomEvent('omni:window-resized', { detail: { id: st.id, rect: r, maximized: st.max } }))
  } catch (_) { /* no window */ }
}

// ── Resize gesture ────────────────────────────────────────────────────────────

function sheetMode (st) {
  if (st.max) return false
  const r = st.el.getBoundingClientRect()
  return isPhone() && r.width >= (window.innerWidth || 0) - 2
}

function startResize (st, e) {
  if (st.max || st.disposed || (e.button != null && e.button > 0)) return
  const h = e.target.closest?.('.omni-win-rz')
  if (!h) return
  const el = st.el
  const sheet = sheetMode(st)
  st.el.classList.toggle('omni-win-sheet', sheet)
  if (sheet && h.dataset.dir !== 'n') return          // phone bottom sheet: only the top edge resizes; let other touches through
  e.preventDefault(); e.stopPropagation()
  const dir = h.dataset.dir
  st.want = null
  const rect0 = rectOf(el)             // measured BEFORE the centring translate is dropped: this is where the window visibly is
  if (!sheet) neutralizeTransform(el)   // a sheet only changes its height: leave a centring translate alone so it does not jump
  const area = getResizeArea()
  st.drag = { dir, rect0, x0: e.clientX, y0: e.clientY, area, min: minSizeFor(el, area, st.opts), pid: e.pointerId, h, sheet, last: null }
  try { h.setPointerCapture(e.pointerId) } catch (_) { /* synthetic events */ }
  document.documentElement.classList.add('omni-win-resizing')
  document.documentElement.style.cursor = CURSORS[dir]
  el.dispatchEvent(new CustomEvent('omni:window-focus', { bubbles: true }))
  try { st.opts.onFocus?.() } catch (_) { /* ignore */ }
  const move = (ev) => { if (!st.drag || ev.pointerId !== st.drag.pid) return; st.drag.cx = ev.clientX; st.drag.cy = ev.clientY; if (!st.raf) st.raf = requestAnimationFrame(() => { st.raf = 0; flush(st) }) }
  const up = (ev) => { if (!st.drag || ev.pointerId !== st.drag.pid) return; st.drag.cx = ev.clientX; st.drag.cy = ev.clientY; finishResize(st) }
  h.addEventListener('pointermove', move); h.addEventListener('pointerup', up); h.addEventListener('pointercancel', up); h.addEventListener('lostpointercapture', up)
  st.drag.off = () => { h.removeEventListener('pointermove', move); h.removeEventListener('pointerup', up); h.removeEventListener('pointercancel', up); h.removeEventListener('lostpointercapture', up) }
}

function flush (st) {
  const d = st.drag
  if (!d) return
  const dx = (d.cx ?? d.x0) - d.x0, dy = (d.cy ?? d.y0) - d.y0
  const next = resizeRect(d.rect0, d.dir, dx, dy, d.area, d.min)
  const el = st.el
  if (d.sheet) {                           // bottom sheet: only the height changes, it stays anchored to the dock
    imp(el, 'height', `${Math.round(next.height)}px`); imp(el, 'max-height', 'none')
    const rr = rectOf(el)                  // a sheet that is anchored by its top (OmniChronos) grows downward: keep it above the dock
    if (rr.top + rr.height > d.area.bottom + 1) imp(el, 'height', `${Math.max(Math.round(d.min.h), Math.round(next.height - (rr.top + rr.height - d.area.bottom)))}px`)
  } else {
    applyRect(el, next, originOf(el))
  }
  st.sized = true
  d.last = next
}

function finishResize (st) {
  const d = st.drag
  if (!d) return
  if (st.raf) { cancelAnimationFrame(st.raf); st.raf = 0 }
  flush(st)
  const r = rectOf(st.el)
  st.drag = null
  d.off?.()
  try { d.h.releasePointerCapture(d.pid) } catch (_) { /* already released */ }
  document.documentElement.classList.remove('omni-win-resizing')
  document.documentElement.style.cursor = ''
  if (d.last) { saveSize(st.id, r.width, r.height); announceResize(st) }
}

function cancelGesture (st) {
  if (!st.drag) return
  st.drag.off?.()
  if (st.raf) { cancelAnimationFrame(st.raf); st.raf = 0 }
  st.drag = null
  document.documentElement.classList.remove('omni-win-resizing')
  document.documentElement.style.cursor = ''
}

// ── Saved size / refit ────────────────────────────────────────────────────────

function applySavedSize (st) {
  const s = getSavedSize(st.id)
  if (!s) return
  const el = st.el
  const area = getResizeArea()
  const min = minSizeFor(el, area, st.opts)
  if (isPhone()) {
    if (!s.h) return
    imp(el, 'height', `${Math.round(clamp(s.h, min.h, area.height))}px`); imp(el, 'max-height', 'none')
  } else {
    if (s.w) { imp(el, 'width', `${Math.round(clamp(s.w, min.w, area.width))}px`); imp(el, 'max-width', 'none') }
    if (s.h) { imp(el, 'height', `${Math.round(clamp(s.h, min.h, area.height))}px`); imp(el, 'max-height', 'none') }
  }
  st.sized = true
  st.want = { w: s.w || 0, h: s.h || 0 }   // the remembered size; refit grows back toward it when the free area grows (ribbon folds) until the person resizes again
}

/** For a panel that sizes itself when it opens (OmniChronos): put the remembered size back after its own code ran. */
export function reapplySavedSize (el) {
  const st = states.get(el)
  if (!st || st.disposed || st.max || st.drag) return false
  applySavedSize(st)
  return st.sized
}

function refitWindow (st) {
  if (st.disposed) return
  const el = st.el
  if (st.max) { applyRect(el, maximizedRect(getMaximizeArea()), originOf(el)); announceResize(st); return }
  if (!st.sized || st.drag) return
  const cs = getComputedStyle(el)
  if (cs.display === 'none') return      // (a panel hidden with visibility / opacity still has a rect: refit it so it opens at the right size)
  const area = getResizeArea()
  const r = rectOf(el)
  if (r.width === 0 && r.height === 0) return
  const sheet = sheetMode(st)
  st.el.classList.toggle('omni-win-sheet', sheet)
  const wantH = st.want?.h || 0, wantW = st.want?.w || 0
  if (sheet) { const h = clamp(wantH || r.height, 0, area.height); if (h !== r.height) imp(el, 'height', `${Math.round(h)}px`); return }
  const base = st.want ? { ...r, width: wantW || r.width, height: wantH || r.height } : r
  const next = clampRect(base, area, minSizeFor(el, area, st.opts))
  if (Math.abs(next.left - r.left) > 1 || Math.abs(next.top - r.top) > 1 || Math.abs(next.width - r.width) > 1 || Math.abs(next.height - r.height) > 1) applyRect(el, next, originOf(el))
}

/** Pull a window that is partly off-screen back into view (used when a saved size made it overflow). */
export function ensureInView (el) {
  const st = states.get(el)
  if (!st || st.max) return false
  if (!st.sized) {                       // never resized: only rescue a phone panel that is wider than the screen (its buttons would be off-screen)
    if (!isPhone() || st.drag) return false
    const r = rectOf(el), vw = window.innerWidth || 0
    if (!(r.width > 0) || (r.left >= -1 && r.left + r.width <= vw + 1)) return false
    const cs = getComputedStyle(el)
    if (cs.display === 'none' || cs.visibility === 'hidden') return false
    const area = getResizeArea()
    neutralizeTransform(el)
    applyRect(el, clampRect(r, area, minSizeFor(el, area, st.opts)), originOf(el))
    st.sized = true
    return true
  }
  refitWindow(st)
  return true
}

/** Forget every saved size and drop the size overrides of the windows that are open right now. */
export function resetWindowSizes () {
  clearSavedSizes()
  let n = 0
  for (const el of live) {
    const st = states.get(el)
    if (!st || !st.sized) continue
    if (st.max) restoreWindow(el)
    for (const p of ['width', 'height', 'max-width', 'max-height', 'left', 'top', 'right', 'bottom', 'margin', 'transform']) {
      const [v, pr] = st.orig[p] ?? ['', '']
      if (v === '') el.style.removeProperty(p); else el.style.setProperty(p, v, pr)
    }
    st.sized = false; st.want = null; n++
  }
  try { window.dispatchEvent(new CustomEvent('omni:window-sizes-reset', { detail: { count: n } })) } catch (_) { /* no window */ }
  return n
}

export function listEnhanced () { return [...live] }
