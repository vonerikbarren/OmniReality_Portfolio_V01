/**
 * utils/OmniHandBanner.js — show / hide the hands: the top "hands banner" (V169), the bottom pair (V174) and each hand on its own (V187)
 *
 * Four hands, built by ui/Hand.js:  omnihand (⟐OmniHand, top-left, .omni-hand--tl)   conscious (⟐ConsciousHand, top-right, --tr)
 *                                   lh (⟐LogicalHand, bottom-left, --bl)             rh (⟐CreativeHand, bottom-right, --br)
 * The banner = the two top hands; the bottom pair = lh + rh. This controller only toggles their LAYOUT (a class on <html>
 * => display:none) and tells utils/OmniLayout.js how tall the top banner is, so the top pads / satellites
 * (ui/MovementPad.js) follow it. It never touches pad state, tunnels or any Hand logic: omni:pad-toggle, omni:pad-state,
 * OmniAxinator, the radial menus and the 1-4 / Shift key bindings (which .click() the cells) all keep working while hidden.
 *
 * PAIR switches (unchanged API, now built on the per-hand model): setVisible / toggle (top pair), setBottomVisible /
 * toggleBottom (bottom pair). A pair is "visible" only when BOTH hands are shown; with one shown it is "mixed", and the
 * pair switch then shows both (hidden -> shown, mixed -> shown, shown -> hidden).
 * PER-HAND (V187): isHandVisible(hand) / setHandVisible(hand, v) / toggleHand(hand) / getHandStates() / getPairState(group).
 *
 * Events (in):   omni:hands-banner-set   { visible }        top pair
 *                omni:hands-bottom-set   { visible }        bottom pair
 *                omni:hand-visible-set   { hand, visible }  one hand ('omnihand' | 'conscious' | 'lh' | 'rh')
 * Events (out):  omni:hands-banner-state { visible, mixed, any }   (visible = both top hands shown)  after every change and once at init
 *                omni:hands-bottom-state { visible, mixed, any }   same for the bottom pair
 *                omni:hand-visible-state { hand, visible }          one per hand: when it changes, and all four once at init
 * Storage: 'omni:hands-banner-v3' = '1' | '0' (top pair, the person's explicit choice, either way), 'omni:hands-bottom-v1' (bottom pair),
 *          and per hand 'omni:hand-omnihand-v1' / 'omni:hand-conscious-v1' / 'omni:hand-lh-v1' / 'omni:hand-rh-v1'. On load a hand
 *          uses its own key, else its pair's key, else shown.
 * Default (no stored choice): SHOWN everywhere (V173). V171 hid it by default, which removed both top hands; reverted. Key bumped to -v3 so the V171/V172 stored state cannot keep it hidden.
 */

import { setHandsBannerHeight, HANDS_BANNER_H } from './OmniLayout.js'

export const STORAGE_KEY = 'omni:hands-banner-v3'
export const OFF_CLASS   = 'omni-hands-banner-off'
export const BOTTOM_STORAGE_KEY = 'omni:hands-bottom-v1'
export const BOTTOM_OFF_CLASS   = 'omni-hands-bottom-off'
export const HANDS = {
  omnihand:  { corner: 'tl', group: 'top',    key: 'omni:hand-omnihand-v1',  label: '⟐OmniHand' },
  conscious: { corner: 'tr', group: 'top',    key: 'omni:hand-conscious-v1', label: '⟐ConsciousHand' },
  lh:        { corner: 'bl', group: 'bottom', key: 'omni:hand-lh-v1',        label: '⟐LogicalHand' },
  rh:        { corner: 'br', group: 'bottom', key: 'omni:hand-rh-v1',        label: '⟐CreativeHand' },
}
export const HAND_IDS = Object.keys(HANDS)
export const handOffClass = (hand) => `omni-hand-off--${HANDS[hand].corner}`
const STYLE_ID = 'omni-hands-banner-styles'
const STYLES = `
html.${OFF_CLASS} .omni-hand--tl,
html.${OFF_CLASS} .omni-hand--tr,
html.${BOTTOM_OFF_CLASS} .omni-hand--bl,
html.${BOTTOM_OFF_CLASS} .omni-hand--br { display: none !important; pointer-events: none !important; }
html.omni-hand-off--tl .omni-hand--tl,
html.omni-hand-off--tr .omni-hand--tr,
html.omni-hand-off--bl .omni-hand--bl,
html.omni-hand-off--br .omni-hand--br { display: none !important; pointer-events: none !important; }
`

const shown = { omnihand: true, conscious: true, lh: true, rh: true }   // per-hand visibility
let visible = true          // top pair: BOTH top hands shown (the V169 meaning of "the banner is visible")
let inited  = false
let onSet   = null
let bottomVisible = true    // bottom pair: both shown
let onBottomSet   = null
let onHandSet = null

function isPhone () {
  return typeof window !== 'undefined' && (window.innerWidth || 1024) <= 700
}

function readKey (k) {
  try { const v = localStorage.getItem(k); if (v === '1') return true; if (v === '0') return false } catch (_) {}
  return null
}
export function readStored () { return readKey(STORAGE_KEY) }
export function readBottomStored () { return readKey(BOTTOM_STORAGE_KEY) }
export function readHandStored (hand) { return HANDS[hand] ? readKey(HANDS[hand].key) : null }
export function getDefaultVisible () { return true }   // V173: shown again (V171 hid it and the person lost both top hands); dock / ribbon / OmniHands panel still toggle it

const groupHands = (group) => HAND_IDS.filter(h => HANDS[h].group === group)

/** { visible: both shown, any: at least one shown, mixed: exactly one shown } for 'top' | 'bottom'. */
export function getPairState (group) {
  const hs = groupHands(group)
  const n = hs.filter(h => shown[h]).length
  return { visible: n === hs.length, any: n > 0, mixed: n > 0 && n < hs.length }
}
export function isHandVisible (hand) { return HANDS[hand] ? !!shown[hand] : false }
export function getHandStates () { return { ...shown } }
export function isVisible () { return visible }
export function isBottomVisible () { return bottomVisible }

function apply () {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  const top = getPairState('top'), bot = getPairState('bottom')
  visible = top.visible; bottomVisible = bot.visible
  root.classList.toggle(OFF_CLASS, !top.any)
  root.classList.toggle(BOTTOM_OFF_CLASS, !bot.any)
  for (const h of HAND_IDS) root.classList.toggle(handOffClass(h), !shown[h])
  setHandsBannerHeight(top.any ? HANDS_BANNER_H : 0)
}

function announcePair (group) {
  const st = getPairState(group)
  window.dispatchEvent(new CustomEvent(group === 'top' ? 'omni:hands-banner-state' : 'omni:hands-bottom-state', { detail: { visible: st.visible, mixed: st.mixed, any: st.any } }))
}
const announceHand = (hand) => window.dispatchEvent(new CustomEvent('omni:hand-visible-state', { detail: { hand, visible: !!shown[hand] } }))

function persistHand (hand) { try { localStorage.setItem(HANDS[hand].key, shown[hand] ? '1' : '0') } catch (_) {} }

/** One hand on its own. */
export function setHandVisible (hand, v, { persist = true } = {}) {
  if (!HANDS[hand]) return false
  const next = !!v
  const changed = next !== shown[hand]
  shown[hand] = next
  if (persist) persistHand(hand)
  apply()
  if (changed || persist) { announceHand(hand); announcePair(HANDS[hand].group) }
  return true
}
export function toggleHand (hand) { return setHandVisible(hand, !shown[hand]) }

function setGroup (group, v, persist) {
  const next = !!v
  const hs = groupHands(group)
  const before = hs.map(h => shown[h])
  for (const h of hs) shown[h] = next
  if (persist) {
    try { localStorage.setItem(group === 'top' ? STORAGE_KEY : BOTTOM_STORAGE_KEY, next ? '1' : '0') } catch (_) {}
    for (const h of hs) persistHand(h)
  }
  apply()
  hs.forEach((h, i) => { if (before[i] !== next || persist) announceHand(h) })
  announcePair(group)
}

/** @param {boolean} v  @param {{persist?:boolean}} [opts]  both top hands */
export function setVisible (v, { persist = true } = {}) { setGroup('top', v, persist) }
/** Pair switch: hidden or mixed -> show both, shown -> hide both. */
export function toggle () { setVisible(!visible) }

export function setBottomVisible (v, { persist = true } = {}) { setGroup('bottom', v, persist) }
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
  const topStored = readStored() ?? getDefaultVisible()
  const botStored = readBottomStored() ?? true
  for (const h of HAND_IDS) shown[h] = readHandStored(h) ?? (HANDS[h].group === 'top' ? topStored : botStored)
  apply()
  onSet = (e) => { if (typeof e.detail?.visible === 'boolean') setVisible(e.detail.visible) }
  window.addEventListener('omni:hands-banner-set', onSet)
  onBottomSet = (e) => { if (typeof e.detail?.visible === 'boolean') setBottomVisible(e.detail.visible) }
  window.addEventListener('omni:hands-bottom-set', onBottomSet)
  onHandSet = (e) => { if (HANDS[e.detail?.hand] && typeof e.detail?.visible === 'boolean') setHandVisible(e.detail.hand, e.detail.visible) }
  window.addEventListener('omni:hand-visible-set', onHandSet)
  announcePair('top')
  announcePair('bottom')
  for (const h of HAND_IDS) announceHand(h)
}

export function destroy () {
  if (!inited) return
  inited = false
  window.removeEventListener('omni:hands-banner-set', onSet)
  onSet = null
  window.removeEventListener('omni:hands-bottom-set', onBottomSet)
  onBottomSet = null
  window.removeEventListener('omni:hand-visible-set', onHandSet)
  onHandSet = null
  document.documentElement.classList.remove(OFF_CLASS, BOTTOM_OFF_CLASS, ...HAND_IDS.map(handOffClass))
  document.getElementById(STYLE_ID)?.remove()
}
