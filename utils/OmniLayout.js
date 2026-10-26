/**
 * utils/OmniLayout.js — the ONE source of truth for "how far down is the top of the free screen?"
 * (V169)
 *
 * Before V169 every consumer hard-coded its own copy of the GlobalBar height (48 in most files, a
 * stale 36 in the Inspector / Drawer / OmniNode). The ribbon (ui/OmniRibbon.js) now sits under the
 * bar and changes height (collapse, mobile tabs-only), so each anchored UI reads CSS variables
 * written HERE instead:
 *
 *   --omni-bar-h              GlobalBar height                                  48px
 *   --omni-ribbon-h           ribbon height (tabs + body; 0 until mounted)      0px .. ~96px
 *   --omni-top-offset         bar + ribbon  = first free y under the chrome
 *   --omni-hands-banner-h     the top ConsciousHand / OmniHand banner (90px, 0 when hidden)
 *   --omni-top-stack          top-offset + banner = where the top pads start
 *   --omni-ribbon-left        ribbon left inset (the docked OmniNotify box sits to its left)
 *   --omni-compass-slot-top   (V188) the userCompass slot: the strip right under the logo cell and above the top-left hand
 *   --omni-compass-slot-w     (V188)   x 0..w (= the top-left hand's width), y bar-bottom .. top-offset (= the ribbon's height)
 *   --omni-compass-slot-h     (V188)   h = 0 when the ribbon (hence the slot) is not there yet
 *   --omni-compass-slot-on    (V188) 1 when the slot is really free, 0 when the ribbon covers it or it is too small (see computeCompassSlot)
 *
 * JS consumers call getTopOffset() / getTopStack() at use time (never cache at module load).
 * Every change dispatches `omni:layout-changed` with the same numbers. No per-frame work.
 */

export const BAR_H = 48               // must match ui/GlobalBar.js COLLAPSED_H
export const HANDS_BANNER_H = 90      // 2 x 44px cells + 2px gap = ui/Hand.js CELL grid at desktop

// Ribbon sizing lives here (not in ui/OmniRibbon.js) so panels that position themselves BEFORE the
// ribbon is built (every module registered ahead of ui.init(), see ui/WindowManager.js's cascade)
// can still reserve the right amount of room.
export const PHONE_MAX = 700
export const RIBBON_TABS_H_DESKTOP = 28
export const RIBBON_TABS_H_PHONE = 36
export const RIBBON_BODY_H = 68
export const RIBBON_STORAGE_KEY = 'omni:ribbon-v1'

/** Total ribbon height: tabs (+ body when docked) + its own 1px bottom border. */
export function computeRibbonHeight ({ phone, collapsed }) {
  const tabs = phone ? RIBBON_TABS_H_PHONE : RIBBON_TABS_H_DESKTOP
  return tabs + ((phone || collapsed) ? 0 : RIBBON_BODY_H) + 1
}

/** What the ribbon WILL measure (from the viewport and its saved collapsed flag) — usable before it is built. */
export function estimateRibbonHeight () {
  let collapsed = false
  try { collapsed = JSON.parse(localStorage.getItem(RIBBON_STORAGE_KEY) ?? 'null')?.collapsed === true } catch (_) {}
  const phone = (typeof window !== 'undefined' ? (window.innerWidth || 1024) : 1024) <= PHONE_MAX
  return computeRibbonHeight({ phone, collapsed })
}

// ── userCompass slot (V188) ──────────────────────────────────────────────────
// The slot is the empty strip directly under the Global Bar's logo cell (#ob-col00) and directly above the top-left hand
// (.omni-hand--tl starts at --omni-top-offset). Vertically it is exactly the ribbon's height (bar bottom .. top-offset);
// horizontally it is the hand's own column (103px, 83px on <= 460px screens where the hand cells shrink to 40px).
// It is only FREE while the ribbon starts to the right of it: the ribbon sits at --omni-ribbon-left, which is 0 whenever the
// OmniNotify box is not docked beside it (narrow screens, phones, a floated box). Then the ribbon covers the slot and the
// compass hides itself (reason 'ribbon-overlaps'); it never draws on top of the ribbon.
export const HAND_COL_W = 103
export const HAND_COL_W_SMALL = 83
export const HAND_SMALL_MAX = 460
export const COMPASS_PAD_X = 4
export const COMPASS_PAD_Y = 2
export const COMPASS_MIN_D = 24

/** Pure: the compass slot for a layout snapshot ({barH, ribbonH, ribbonLeft}) and a viewport width. */
export function computeCompassSlot (layout, viewportW = 1280) {
  const barH = Math.max(0, Number(layout?.barH) || 0)
  const h = Math.max(0, Math.round(Number(layout?.ribbonH) || 0))
  const ribbonLeft = Math.max(0, Number(layout?.ribbonLeft) || 0)
  const w = (Number(viewportW) || 0) <= HAND_SMALL_MAX ? HAND_COL_W_SMALL : HAND_COL_W
  const maxD = Math.max(0, Math.floor(Math.min(w - 2 * COMPASS_PAD_X, h - 2 * COMPASS_PAD_Y)))
  const clear = ribbonLeft >= w
  const reason = !clear ? 'ribbon-overlaps' : (maxD < COMPASS_MIN_D ? 'too-small' : '')
  return { x: 0, y: barH, w, h, maxD, available: reason === '', reason }
}

const state = { ribbonH: 0, bannerH: HANDS_BANNER_H, ribbonLeft: 0 }

function snapshot () {
  const topOffset = BAR_H + state.ribbonH
  return {
    barH: BAR_H, ribbonH: state.ribbonH, topOffset,
    bannerH: state.bannerH, topStack: topOffset + state.bannerH,
    ribbonLeft: state.ribbonLeft,
  }
}

function apply (announce) {
  const snap = snapshot()
  const root = typeof document !== 'undefined' ? document.documentElement : null
  if (root?.style) {
    const set = (k, v) => root.style.setProperty(k, `${v}px`)
    set('--omni-bar-h', snap.barH)
    set('--omni-ribbon-h', snap.ribbonH)
    set('--omni-top-offset', snap.topOffset)
    set('--omni-hands-banner-h', snap.bannerH)
    set('--omni-top-stack', snap.topStack)
    set('--omni-ribbon-left', snap.ribbonLeft)
    const slot = computeCompassSlot(snap, typeof window !== 'undefined' ? window.innerWidth : 1280)
    set('--omni-compass-slot-top', slot.y)
    set('--omni-compass-slot-w', slot.w)
    set('--omni-compass-slot-h', slot.h)
    root.style.setProperty('--omni-compass-slot-on', slot.available ? '1' : '0')
  }
  if (announce && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('omni:layout-changed', { detail: snap }))
  }
}

let resizeBound = false
/** Idempotent: writes the variables with the current values (call early). V188: also re-writes them on window resize (the slot width follows the viewport). */
export function initLayout () {
  apply(false)
  if (!resizeBound && typeof window !== 'undefined' && window.addEventListener) {
    resizeBound = true
    window.addEventListener('resize', () => apply(false))
  }
}

export function setRibbonHeight (px) {
  const v = Math.max(0, Math.round(Number(px) || 0))
  if (v === state.ribbonH) return
  state.ribbonH = v
  apply(true)
}

export function setHandsBannerHeight (px) {
  const v = Math.max(0, Math.round(Number(px) || 0))
  if (v === state.bannerH) return
  state.bannerH = v
  apply(true)
}

export function setRibbonInset (px) {
  const v = Math.max(0, Math.round(Number(px) || 0))
  if (v === state.ribbonLeft) return
  state.ribbonLeft = v
  apply(true)
}

export const getRibbonHeight = () => state.ribbonH
export const getTopOffset    = () => BAR_H + state.ribbonH
export const getTopStack     = () => BAR_H + state.ribbonH + state.bannerH
export const getLayout       = () => snapshot()

// ── OmniDock_Realities row (V191) ────────────────────────────────────────────
// The wireframe-geometry strip (ui/OmniDockRealities.js) sits directly ABOVE the Dock. Whatever anchors itself to "the top of the
// bottom chrome" (the X meter, the bottom sheets) reads --omni-dock-stack-h = Dock (52) + the row's height (0 while the row is hidden).
//   --omni-dock-row-h     the row's height (0 when hidden)
//   --omni-dock-stack-h   Dock + row            (the X meter's `_layoutDock` uses it)
//   --omni-dock-h         kept in step with the stack so the bottom sheets (`bottom: var(--omni-dock-h, 52px)`) clear the row too
export const DOCK_BASE_H = 52           // = ui/Dock.js DOCK_H
export const DOCK_ROW_INSET = 112       // clear of the two bottom hands (103px wide); 90 on <= 460px screens (the hands shrink to 83px)
export const DOCK_ROW_INSET_SMALL = 90
const dockRow = { h: 0, on: false }

export function getDockRowInset (viewportW = (typeof window !== 'undefined' ? window.innerWidth : 1280)) {
  return (Number(viewportW) || 0) <= HAND_SMALL_MAX ? DOCK_ROW_INSET_SMALL : DOCK_ROW_INSET
}

/** The row announces its height ({ on:false } / h 0 when hidden). Writes the three variables and fires omni:layout-changed once per change. */
export function setDockRow ({ h = 0, on = true } = {}) {
  const v = on ? Math.max(0, Math.round(Number(h) || 0)) : 0
  const isOn = on && v > 0
  if (v === dockRow.h && isOn === dockRow.on) return
  dockRow.h = v; dockRow.on = isOn
  const root = typeof document !== 'undefined' ? document.documentElement : null
  if (root?.style) {
    root.style.setProperty('--omni-dock-row-h', `${v}px`)
    root.style.setProperty('--omni-dock-stack-h', `${DOCK_BASE_H + v}px`)
    root.style.setProperty('--omni-dock-h', `${DOCK_BASE_H + v}px`)
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('omni:layout-changed', { detail: snapshot() }))
}
export const getDockRow = () => ({ h: dockRow.h, on: dockRow.on, bottom: DOCK_BASE_H })
export const getDockStackHeight = () => DOCK_BASE_H + dockRow.h
