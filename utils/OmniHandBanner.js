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
 * Storage: localStorage 'omni:hands-banner-v2' = '1' | '0'  (the person's explicit choice, either way)
 * Default (no stored choice): HIDDEN everywhere (V171; was shown on desktop in V169/V170). Key bumped to -v2 so an older stored choice does not keep it visible.
 */

import { setHandsBannerHeight, HANDS_BANNER_H } from './OmniLayout.js'

export const STORAGE_KEY = 'omni:hands-banner-v2'
export const OFF_CLASS   = 'omni-hands-banner-off'
const STYLE_ID = 'omni-hands-banner-styles'
const STYLES = `
html.${OFF_CLASS} .omni-hand--tl,
html.${OFF_CLASS} .omni-hand--tr { display: none !important; pointer-events: none !important; }
`

let visible = true
let inited  = false
let onSet   = null

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

export function getDefaultVisible () { return false }   // V171: hidden by default everywhere; the dock / ribbon / OmniHands panel bring it back
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
}

export function destroy () {
  if (!inited) return
  inited = false
  window.removeEventListener('omni:hands-banner-set', onSet)
  onSet = null
  document.documentElement.classList.remove(OFF_CLASS)
  document.getElementById(STYLE_ID)?.remove()
}
