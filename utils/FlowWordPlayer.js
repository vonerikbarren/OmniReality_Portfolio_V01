/**
 * utils/FlowWordPlayer.js — plays a payload's DISPLAY as word tooltips (V168).
 *
 * The same technique as the "DynamicNode" (ui/OmniDrawDynamic.js + utils/WordTicker.js): a
 * string is shown word by word as small tooltip labels that animate upward, but here every
 * word is its own label (cheap DOM, styled by the --ttm-* tooltip variables the global
 * tooltip settings write, so it follows ToolTipSettings) and the timing comes from the
 * payload's `display` block: wordDelayMs between words, holdMs, risePx, direction, loop,
 * maxWords. Numbers / booleans are ONE tooltip with a type badge ("123 · number").
 *
 * The player owns no position: it appends word elements to a `container` the caller places
 * (OmniFlowFire projects a world point into it every frame; the payload panel's preview area
 * just sits there). Words are absolutely positioned at the container's origin and rise from it.
 *
 * Limits: at most MAX_LIVE_WORDS word elements alive across ALL players (oldest dropped);
 * every tween / timeline / element is killed and removed on stop().
 */

import gsap from 'gsap'

export const MAX_LIVE_WORDS = 24
const FADE_IN = 0.15
const FADE_OUT = 0.35
const START_LIFT = 24              // px above the anchor, so words start clear of the node's own tooltip label
const X_PATTERN = [0, -26, 26]     // a small deterministic spread so fast streams do not stack on one pixel column

const STYLE_ID = 'omni-flow-word-styles'
const STYLES = `
.omni-flow-anchor { position: fixed; left: 0; top: 0; width: 0; height: 0; pointer-events: none; z-index: 55; will-change: transform; }
.omni-flow-word {
  position: absolute; left: 0; top: 0; pointer-events: none; white-space: nowrap;
  background: var(--ttm-bg, rgba(8, 8, 12, 0.86)); border: 1px solid var(--ttm-border, rgba(255, 255, 255, 0.2));
  font: 600 13px 'Courier New', Courier, monospace; padding: 3px 9px; border-radius: 6px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35); opacity: 0;
}
.omni-flow-word .omni-flow-badge { opacity: 0.7; font-weight: 400; font-size: 10px; white-space: pre; }
`

export function injectWordStyles () {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return
  const s = document.createElement('style')
  s.id = STYLE_ID
  s.textContent = STYLES
  document.head.appendChild(s)
}

// ── Pure helpers (unit-tested) ───────────────────────────────────────────────

/** Splits on whitespace; over `maxWords` the result is `maxWords` long and ends with an ellipsis word. */
export function splitWords (text, maxWords = 40) {
  const all = String(text ?? '').trim().split(/\s+/).filter(Boolean)
  const max = Math.max(1, Math.round(maxWords) || 1)
  if (all.length <= max) return { words: all, truncated: false }
  return { words: [...all.slice(0, Math.max(0, max - 1)), '…'], truncated: true }
}

/** What a payload plays: { single: false, items: [{text}] } for strings, { single: true, items: [{text, badge}] } otherwise. */
export function buildItems (payload) {
  if (!payload) return { single: false, items: [] }
  if (payload.type === 'string') {
    return { single: false, items: splitWords(payload.value, payload.display?.maxWords).words.map(text => ({ text })) }
  }
  return { single: true, items: [{ text: String(payload.value), badge: payload.type }] }
}

const luma = (r, g, b) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255

/** The payload colour, lightened toward white until it reads on the (dark) tooltip background. */
export function readableColor (hex, minLuma = 0.55) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex ?? ''))
  if (!m) return '#ffffff'
  let r = parseInt(m[1].slice(0, 2), 16), g = parseInt(m[1].slice(2, 4), 16), b = parseInt(m[1].slice(4, 6), 16)
  for (let i = 0; i < 12 && luma(r, g, b) < minLuma; i++) {
    r = Math.round(r + (255 - r) * 0.25); g = Math.round(g + (255 - g) * 0.25); b = Math.round(b + (255 - b) * 0.25)
  }
  const h = (v) => v.toString(16).padStart(2, '0')
  return `#${h(r)}${h(g)}${h(b)}`
}

// ── Shared live-word registry (the global cap) ───────────────────────────────

const LIVE = []      // { el, tl } oldest first

function dropEntry (entry) {
  const i = LIVE.indexOf(entry)
  if (i >= 0) LIVE.splice(i, 1)
  const k = entry.owner?.mine.indexOf(entry) ?? -1
  if (k >= 0) entry.owner.mine.splice(k, 1)
  entry.tl?.kill()
  entry.el.remove()
}

export function liveWordCount () { return LIVE.length }

// ── Player ───────────────────────────────────────────────────────────────────

export default class FlowWordPlayer {
  /**
   * @param {object} o
   * @param {object} o.payload      a payload (or snapshot): { type, value, display, style }
   * @param {HTMLElement} o.container  positioned by the caller; words are appended to it
   * @param {(phase:'start'|'word'|'end', i?:number)=>void} [o.onPhase]
   */
  constructor ({ payload, container, onPhase } = {}) {
    this.payload = payload
    this.container = container
    this.onPhase = onPhase ?? (() => {})
    this.tl = null
    this.mine = []
    this.active = false
    this.shown = 0
    injectWordStyles()
  }

  get isActive () { return this.active }

  start () {
    this.stop(true)
    const p = this.payload
    if (!p || !this.container) return false
    const d = p.display ?? {}
    const { items } = buildItems(p)
    if (!items.length) return false
    const delay = Math.max(0.05, (d.wordDelayMs ?? 450) / 1000)
    const hold = Math.max(0, (d.holdMs ?? 900) / 1000)
    const life = FADE_IN + hold + FADE_OUT
    const endAt = (items.length - 1) * delay + life
    this.active = true
    this.shown = 0
    this.onPhase('start')
    const tl = gsap.timeline({ paused: true, repeat: d.loop ? -1 : 0, repeatDelay: d.loop ? 0.4 : 0 })
    items.forEach((item, i) => tl.call(() => this._show(item, i, hold, life), null, i * delay))
    tl.call(() => { if (!d.loop) { this.active = false; this.onPhase('end') } }, null, endAt)
    this.tl = tl
    tl.play()
    return true
  }

  /** Kills the timeline and every word element this player made. `silent` skips the 'end' phase. */
  stop (silent = false) {
    const was = this.active
    this.active = false
    this.tl?.kill()
    this.tl = null
    this.mine.slice().forEach(dropEntry)
    if (was && !silent) this.onPhase('end')
  }

  destroy () { this.stop(true); this.container = null }

  _show (item, i, hold, life) {
    const p = this.payload, d = p.display ?? {}
    const el = document.createElement('div')
    el.className = 'omni-flow-word'
    el.textContent = item.text
    const col = readableColor(p.style?.color)
    el.style.color = col
    el.style.borderColor = col
    if (item.badge) {
      const b = document.createElement('span')
      b.className = 'omni-flow-badge'
      b.textContent = ` · ${item.badge}`
      el.appendChild(b)
    }
    this.container.appendChild(el)
    const dir = d.direction === 'down' ? 1 : -1
    const rise = Math.max(0, d.risePx ?? 60)
    gsap.set(el, { xPercent: -50, yPercent: -100, x: X_PATTERN[i % X_PATTERN.length], y: -START_LIFT, opacity: 0 })
    const entry = { el, tl: null, owner: this }
    entry.tl = gsap.timeline({ onComplete: () => dropEntry(entry) })
    entry.tl.to(el, { opacity: 1, duration: FADE_IN }, 0)
      .to(el, { y: dir * rise - START_LIFT, duration: life, ease: 'power1.out' }, 0)
      .to(el, { opacity: 0, duration: FADE_OUT, ease: 'power1.in' }, FADE_IN + hold)
    LIVE.push(entry)
    this.mine.push(entry)
    while (LIVE.length > MAX_LIVE_WORDS) dropEntry(LIVE[0])
    this.shown++
    this.onPhase('word', i)
  }
}

