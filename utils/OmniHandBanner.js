/**
 * utils/OmniHandBanner.js — show / hide the top "hands banner" (V169)
 *
 * The banner = the two top hand matrices: ⟐OmniHand (top-left, .omni-hand--tl) and ⟐ConsciousHand
 * (top-right, .omni-hand--tr), built by ui/Hand.js. This controller only toggles their LAYOUT
 * (html.omni-hands-banner-off => display:none) and tells utils/OmniLayout.js how tall the banner
 * is, so the top pads / satellites (ui/MovementPad.js) follow it. It never touches pad state,
 * tunnels or any Hand logic: omni:pad-toggle, omni:pad-state, OmniAxinator, the radial menus and
 * the 1-4 / Shift key bindings (which .click() the cells) all keep working while hidden.
 *
 * Events:  omni:hands-banner-set   { visible }   (in)
 *          omni:hands-banner-state { visible }   (out, after every change and once at init)
 * Storage: localStorage 'omni:hands-banner-v3' = '1' | '0'  (the person's explicit choice, either way)
 * Default (no stored choice): SHOWN everywhere (V173). V171 hid it by default, which removed both top hands; reverted. Key bumped to -v3 so the V171/V172 stored state cannot keep it hidden.
 */

import { setHandsBannerHeight, HANDS_BANNER_H } from './OmniLayout.js'

export const STORAGE_KEY = 'omni:hands-banner-v3'
export const OFF_CLASS   = 'omni-hands-banner-off'
export const BOTTOM_STORAGE_KEY = 'omni:hands-bottom-v1'
export const BOTTOM_OFF_CLASS   = 'omni-hands-bottom-off'
const STYLE_ID = 'omni-hands-banner-styles'
const STYLES = `
html.${OFF_CLASS} .omni-hand--tl,
html.${OFF_CLASS} .omni-hand--tr,
html.${BOTTOM_OFF_CLASS} .omni-hand--bl,
html.${BOTTOM_OFF_CLASS} .omni-hand--br { display: none !important; pointer-events: none !important; }
`

let visible = true
let inited  = false
let onSet   = null

// V174: the bottom pair (⟐LogicalHand bl + ⟐CreativeHand br) gets the same show / hide summon as the top pair.
// Layout is unaffected (the bottom hands are corner-anchored; nothing is measured from them).
let bottomVisible = true
let onBottomSet   = null

function isPhone () {
  return typeof window !== 'undefined' && (window.innerWidth || 1024) <= 700
}

export function readStored () {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === '1') return true
    if (v === '0') return false
  } catch (_) {}
  return null
}

export function getDefaultVisible () { return true }   // V173: shown again (V171 hid it and the person lost both top hands); dock / ribbon / OmniHands panel still toggle it
export function isVisible () { return visible }

function apply () {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle(OFF_CLASS, !visible)
  setHandsBannerHeight(visible ? HANDS_BANNER_H : 0)
}

function announce () {
  window.dispatchEvent(new CustomEvent('omni:hands-banner-state', { detail: { visible } }))
}

/** @param {boolean} v  @param {{persist?:boolean}} [opts] */
export function setVisible (v, { persist = true } = {}) {
  const next = !!v
  const changed = next !== visible
  visible = next
  if (persist) { try { localStorage.setItem(STORAGE_KEY, next ? '1' : '0') } catch (_) {} }
  apply()
  if (changed || persist) announce()
}

export function toggle () { setVisible(!visible) }

export function isBottomVisible () { return bottomVisible }
export function readBottomStored () {
  try { const v = localStorage.getItem(BOTTOM_STORAGE_KEY); if (v === '1') return true; if (v === '0') return false } catch (_) {}
  return null
}
function announceBottom () {
  window.dispatchEvent(new CustomEvent('omni:hands-bottom-state', { detail: { visible: bottomVisible } }))
}
export function setBottomVisible (v, { persist = true } = {}) {
  const next = !!v
  const changed = next !== bottomVisible
  bottomVisible = next
  if (persist) { try { localStorage.setItem(BOTTOM_STORAGE_KEY, next ? '1' : '0') } catch (_) {} }
  if (typeof document !== 'undefined') document.documentElement.classList.toggle(BOTTOM_OFF_CLASS, !bottomVisible)
  if (changed || persist) announceBottom()
}
export function toggleBottom () { setBottomVisible(!bottomVisible) }

export function init () {
  if (inited) return
  inited = true
  if (typeof document !== 'undefined' && !document.getElementById(STYLE_ID)) {
    const tag = document.createElement('style')
    tag.id = STYLE_ID
    tag.textContent = STYLES
    document.head.appendChild(tag)
  }
  const stored = readStored()
  visible = stored ?? getDefaultVisible()
  apply()
  onSet = (e) => { if (typeof e.detail?.visible === 'boolean') setVisible(e.detail.visible) }
  window.addEventListener('omni:hands-banner-set', onSet)
  announce()
  bottomVisible = readBottomStored() ?? true
  document.documentElement.classList.toggle(BOTTOM_OFF_CLASS, !bottomVisible)
  onBottomSet = (e) => { if (typeof e.detail?.visible === 'boolean') setBottomVisible(e.detail.visible) }
  window.addEventListener('omni:hands-bottom-set', onBottomSet)
  announceBottom()
}

export function destroy () {
  if (!inited) return
  inited = false
  window.removeEventListener('omni:hands-banner-set', onSet)
  onSet = null
  window.removeEventListener('omni:hands-bottom-set', onBottomSet)
  onBottomSet = null
  document.documentElement.classList.remove(OFF_CLASS, BOTTOM_OFF_CLASS)
  document.getElementById(STYLE_ID)?.remove()
}
