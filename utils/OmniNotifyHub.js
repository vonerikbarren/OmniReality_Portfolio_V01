/**
 * utils/OmniNotifyHub.js — ⟐OmniNotify's model (V169): "a notifier for anything".
 *
 * Two inputs, one small state object that any view (ui/OmniNotifyBox.js) subscribes to:
 *
 *  1. INFO — what the pointer is on. Any element can carry
 *        data-omni-tip="Name"  data-omni-tip-key="Shortcut"  data-omni-tip-desc="Description"
 *     (optional data-omni-tip-source="Where it lives"). ONE delegated capture listener set on
 *     `document` handles all of them, including elements added later — no per-element listeners and
 *     no per-frame work. Mouse: shown after a ~120 ms intent delay, reverts ~1.2 s after the pointer
 *     leaves. Keyboard focus: shown at once. Touch: long-press (~450 ms), reverts after ~2.5 s.
 *     Code can also call setInfo({name,key,desc,source}, {holdMs}) or dispatch
 *     window event `omni:notify-info {name,key,desc,source,holdMs}` (held 4 s by default).
 *
 *  2. NOTIFICATIONS — `omni:notify-push {text}` (the same event ui/OmniNotifyPanel.js turns into
 *     its drop-down feed). The hub only remembers the latest one so the box can show it.
 *
 * State: { mode: 'info' | 'idle', info: {name,key,desc,source}|null, note: {text,time}|null }
 * Timers are looked up on globalThis at call time, so tests can swap in fake timers.
 */

export const INTENT_MS    = 120
export const REVERT_MS    = 1200
export const LONGPRESS_MS = 450
export const TOUCH_HOLD_MS = 2500
export const EVENT_HOLD_MS = 4000
export const SELECTOR = '[data-omni-tip]'

const state = { mode: 'idle', info: null, note: null }
const subs  = new Set()
let showTimer = null, revertTimer = null, pressTimer = null
let hoverEl = null
let installed = false
let handlers = null

const T = {
  set:   (fn, ms) => globalThis.setTimeout(fn, ms),
  clear: (id)     => globalThis.clearTimeout(id),
}

function emit () {
  const snap = getState()
  subs.forEach(fn => { try { fn(snap) } catch (err) { console.warn('⟐OmniNotifyHub subscriber failed:', err) } })
}

export function getState () {
  return { mode: state.mode, info: state.info ? { ...state.info } : null, note: state.note ? { ...state.note } : null }
}

export function subscribe (fn) {
  subs.add(fn)
  return () => subs.delete(fn)
}

function clean (info) {
  const name = String(info?.name ?? '').trim()
  if (!name) return null
  return {
    name,
    key:    String(info?.key ?? '').trim(),
    desc:   String(info?.desc ?? '').trim(),
    source: String(info?.source ?? '').trim(),
  }
}

/** Show info now. holdMs > 0 schedules the revert to idle; 0 leaves it until clearInfo(). */
export function setInfo (info, { holdMs = 0 } = {}) {
  const next = clean(info)
  if (!next) return
  T.clear(revertTimer); revertTimer = null
  const prev = state.info
  const same = state.mode === 'info' && prev && prev.name === next.name && prev.key === next.key &&
               prev.desc === next.desc && prev.source === next.source
  state.mode = 'info'
  state.info = next
  if (!same) emit()
  if (holdMs > 0) revertTimer = T.set(() => clearInfo(), holdMs)
}

export function clearInfo () {
  T.clear(showTimer); showTimer = null
  T.clear(revertTimer); revertTimer = null
  if (state.mode === 'idle' && !state.info) return
  state.mode = 'idle'
  state.info = null
  emit()
}

/** Record a notification (the latest one is what the box shows when idle). */
export function pushNote (text) {
  const t = String(text ?? '').trim()
  if (!t) return
  state.note = { text: t, time: Date.now() }
  emit()
}

function scheduleRevert (ms = REVERT_MS) {
  T.clear(revertTimer)
  revertTimer = T.set(() => clearInfo(), ms)
}

export function infoFromElement (el) {
  if (!el) return null
  const d = el.dataset ?? {}
  return clean({
    name: d.omniTip, key: d.omniTipKey, desc: d.omniTipDesc,
    source: d.omniTipSource ?? el.closest?.('[data-omni-tip-source]')?.dataset?.omniTipSource,
  })
}

const tipOf = (t) => (t && t.closest ? t.closest(SELECTOR) : null)

export function install () {
  if (installed || typeof document === 'undefined') return
  installed = true

  const onOver = (e) => {
    const el = tipOf(e.target)
    if (!el) return
    if (el === hoverEl) { T.clear(revertTimer); revertTimer = null; return }
    hoverEl = el
    T.clear(revertTimer); revertTimer = null
    T.clear(showTimer)
    // Intent delay — a pointer sweeping across a toolbar must not flicker through every button.
    // (When info is already showing, the swap to the next button is also delayed the same ~120 ms.)
    showTimer = T.set(() => {
      showTimer = null
      if (hoverEl === el) setInfo(infoFromElement(el))
    }, INTENT_MS)
  }
  const onOut = (e) => {
    const el = tipOf(e.target)
    if (!el) return
    const to = tipOf(e.relatedTarget)
    if (to === el) return            // moved between children of the same tipped element
    if (hoverEl === el) hoverEl = null
    T.clear(showTimer); showTimer = null
    if (!to) scheduleRevert()
  }
  const onFocusIn = (e) => {
    const el = tipOf(e.target)
    if (el) setInfo(infoFromElement(el))
  }
  const onFocusOut = (e) => {
    if (tipOf(e.target)) scheduleRevert()
  }
  const onTouchStart = (e) => {
    const el = tipOf(e.target)
    if (!el) return
    T.clear(pressTimer)
    pressTimer = T.set(() => {
      pressTimer = null
      setInfo(infoFromElement(el), { holdMs: TOUCH_HOLD_MS })
    }, LONGPRESS_MS)
  }
  const onTouchEnd = () => {
    if (pressTimer) { T.clear(pressTimer); pressTimer = null }
  }
  const onInfoEvent = (e) => {
    const d = e.detail ?? {}
    setInfo(d, { holdMs: Number(d.holdMs) > 0 ? Number(d.holdMs) : EVENT_HOLD_MS })
  }
  const onPush = (e) => pushNote(e.detail?.text)

  handlers = { onOver, onOut, onFocusIn, onFocusOut, onTouchStart, onTouchEnd, onInfoEvent, onPush }
  document.addEventListener('mouseover',  onOver,  true)
  document.addEventListener('mouseout',   onOut,   true)
  document.addEventListener('focusin',    onFocusIn,  true)
  document.addEventListener('focusout',   onFocusOut, true)
  document.addEventListener('touchstart', onTouchStart, { capture: true, passive: true })
  document.addEventListener('touchend',   onTouchEnd,   true)
  document.addEventListener('touchcancel', onTouchEnd,  true)
  window.addEventListener('omni:notify-info', onInfoEvent)
  window.addEventListener('omni:notify-push', onPush)
}

export function uninstall () {
  if (!installed) return
  installed = false
  const h = handlers; handlers = null
  document.removeEventListener('mouseover',  h.onOver,  true)
  document.removeEventListener('mouseout',   h.onOut,   true)
  document.removeEventListener('focusin',    h.onFocusIn,  true)
  document.removeEventListener('focusout',   h.onFocusOut, true)
  document.removeEventListener('touchstart', h.onTouchStart, true)
  document.removeEventListener('touchend',   h.onTouchEnd,   true)
  document.removeEventListener('touchcancel', h.onTouchEnd,  true)
  window.removeEventListener('omni:notify-info', h.onInfoEvent)
  window.removeEventListener('omni:notify-push', h.onPush)
  T.clear(showTimer); T.clear(revertTimer); T.clear(pressTimer)
  showTimer = revertTimer = pressTimer = null
  hoverEl = null
}

/** Test hook: back to a clean slate (keeps listeners installed state as is). */
export function _reset () {
  T.clear(showTimer); T.clear(revertTimer); T.clear(pressTimer)
  showTimer = revertTimer = pressTimer = null
  hoverEl = null
  state.mode = 'idle'; state.info = null; state.note = null
  subs.clear()
}

const OmniNotifyHub = { install, uninstall, setInfo, clearInfo, pushNote, getState, subscribe, infoFromElement }
export default OmniNotifyHub
