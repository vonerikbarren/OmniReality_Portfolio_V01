/**
 * utils/OmniLineModel.js (V268) — line styles with MEANINGS. Pure: no DOM, no Three.js.
 * A line (edge) keeps the style fields it always had (kind cylinder|line|double, color, thickness, dashed, highlight, highlightColor) and gains:
 *   dotted    short round dots instead of long dashes          startEnd / endEnd   'none' | 'arrow' | 'dot'  (the end at the FROM node / at the TO node)
 *   meaning   the id of a preset below (what the line SAYS)    label               a short tooltip / caption (<= 80 chars)
 * MEANINGS are presets (link, flow, step, optional, depends, strong, weak, contains, both, note, conflict, drives, derives, distorts, propagates, highlight). Picking one sets the look; the look can still be tweaked after (the meaning id stays, so it still reads as "a Step line with a custom colour").
 *   link · flow · step · optional · depends · strong · weak · contains · both · note · conflict · highlight
 *   sanitizeLineStyle(style)    never throws, idempotent, only known keys, hex colours only
 *   applyMeaning(style, id)     the style with that preset's look applied (unknown id -> unchanged)
 *   meaningOf(style) / describeStyle(style)   short plain-language reading of a line
 *   swapEnds(style)             exchange startEnd/endEnd (when a command names the pair the other way round)
 */
export const STROKES = Object.freeze(['solid', 'dashed', 'dotted', 'double'])
export const ENDS = Object.freeze(['none', 'arrow', 'dot'])
export const WEIGHTS = Object.freeze({ thin: 0.45, normal: 1, bold: 2.2 })
export const LABEL_MAX = 80, THICK_MIN = 0.2, THICK_MAX = 4

/** id -> { label, summary, stroke, weight, startEnd, endEnd, color, highlight } */
export const MEANINGS = Object.freeze({
  link:      { label: 'Link',      summary: 'A plain connection between two things.',                 stroke: 'solid',  weight: 'normal', startEnd: 'none',  endEnd: 'none',  color: null },
  flow:      { label: 'Flow',      summary: 'Goes from the first node to the second.',               stroke: 'solid',  weight: 'normal', startEnd: 'none',  endEnd: 'arrow', color: '#66ccff' },
  step:      { label: 'Step',      summary: 'The next step in a sequence (dotted, with an arrow).',   stroke: 'dotted', weight: 'normal', startEnd: 'none',  endEnd: 'arrow', color: '#ffdc64' },
  optional:  { label: 'Optional',  summary: 'May apply, may not.',                                    stroke: 'dashed', weight: 'thin',   startEnd: 'none',  endEnd: 'none',  color: '#aab4c4' },
  depends:   { label: 'Depends on', summary: 'The first needs the second (the arrow points at what is needed).', stroke: 'dashed', weight: 'normal', startEnd: 'none', endEnd: 'arrow', color: '#ffa860' },
  strong:    { label: 'Strong',    summary: 'A strong tie.',                                          stroke: 'solid',  weight: 'bold',   startEnd: 'none',  endEnd: 'none',  color: '#ffffff' },
  weak:      { label: 'Weak',      summary: 'A faint or loose tie.',                                  stroke: 'dotted', weight: 'thin',   startEnd: 'none',  endEnd: 'none',  color: '#8c96a8' },
  contains:  { label: 'Contains',  summary: 'The first holds the second (a dot marks the holder).',   stroke: 'solid',  weight: 'normal', startEnd: 'dot',   endEnd: 'none',  color: '#9be3a8' },
  both:      { label: 'Both ways', summary: 'Works in both directions.',                              stroke: 'solid',  weight: 'normal', startEnd: 'arrow', endEnd: 'arrow', color: '#c9a8ff' },
  note:      { label: 'Note',      summary: 'A note attached to a thing (sticky notes use this).',    stroke: 'dotted', weight: 'thin',   startEnd: 'none',  endEnd: 'none',  color: '#ffe97a' },
  conflict:  { label: 'Conflicts', summary: 'These two disagree or cannot both hold.',                stroke: 'double', weight: 'normal', startEnd: 'none',  endEnd: 'none',  color: '#ff6b6b' },
  drives:    { label: 'Drives',    summary: 'The first sets the beat the second moves to (rhythm to animation).', stroke: 'solid',  weight: 'thin',   startEnd: 'none',  endEnd: 'arrow', color: '#ff9ad2' },
  derives:   { label: 'Derives',   summary: 'The second is a copy made from the first (an observation of an event, a record of a story).', stroke: 'solid',  weight: 'thin',   startEnd: 'none',  endEnd: 'arrow', color: '#7fd6ff' },
  distorts:  { label: 'Distorts',  summary: 'The second is a changed copy of the first: something was lost or added on the way.', stroke: 'dashed', weight: 'normal', startEnd: 'none',  endEnd: 'arrow', color: '#d9a0ff' },
  propagates:{ label: 'Spreads to', summary: 'The first was passed on and became the second (a rumour told, gossip retold).', stroke: 'dotted', weight: 'bold',   startEnd: 'none',  endEnd: 'arrow', color: '#ff8a5c' },
  highlight: { label: 'Highlight', summary: 'Draws the eye to this line (glow).',                     stroke: 'solid',  weight: 'bold',   startEnd: 'none',  endEnd: 'none',  color: '#66ccff', highlight: true }
})
export const MEANING_IDS = Object.freeze(Object.keys(MEANINGS))

const num = (v, d) => { const n = Number(v); return Number.isFinite(n) ? n : d }
const HEX = /^#[0-9a-fA-F]{6}$/
const KINDS = ['cylinder', 'line', 'double']
const cleanColor = (c) => (typeof c === 'string' && HEX.test(c) ? c.toLowerCase() : null)
const cleanText = (t) => String(t ?? '').replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, LABEL_MAX)

export function sanitizeLineStyle (style) {
  const s = (style && typeof style === 'object') ? style : {}
  const out = {
    kind: KINDS.includes(s.kind) ? s.kind : 'cylinder',
    color: cleanColor(s.color),
    thickness: Math.min(THICK_MAX, Math.max(THICK_MIN, num(s.thickness, 1))),
    dashed: s.dashed === true, dotted: s.dotted === true,
    highlight: s.highlight === true, highlightColor: cleanColor(s.highlightColor) ?? '#66ccff',
    startEnd: ENDS.includes(s.startEnd) ? s.startEnd : 'none', endEnd: ENDS.includes(s.endEnd) ? s.endEnd : 'none'
  }
  if (out.dashed && out.dotted) out.dashed = false
  if (typeof s.meaning === 'string' && Object.prototype.hasOwnProperty.call(MEANINGS, s.meaning)) out.meaning = s.meaning
  const label = cleanText(s.label); if (label) out.label = label
  return out
}

export function applyMeaning (style, id) {
  const base = sanitizeLineStyle(style)
  if (typeof id !== 'string' || !Object.prototype.hasOwnProperty.call(MEANINGS, id)) return base
  const m = MEANINGS[id]
  return sanitizeLineStyle({
    ...base, meaning: id, color: m.color, thickness: WEIGHTS[m.weight] ?? 1,
    kind: m.stroke === 'double' ? 'double' : 'cylinder', dashed: m.stroke === 'dashed', dotted: m.stroke === 'dotted',
    startEnd: m.startEnd, endEnd: m.endEnd, highlight: m.highlight === true
  })
}

export function strokeOf (style) { const s = sanitizeLineStyle(style); return s.kind === 'double' ? 'double' : s.dotted ? 'dotted' : s.dashed ? 'dashed' : 'solid' }
export function weightOf (style) { const t = sanitizeLineStyle(style).thickness; return t <= 0.6 ? 'thin' : t >= 1.8 ? 'bold' : 'normal' }
export function meaningOf (style) { return sanitizeLineStyle(style).meaning ?? 'link' }
export function swapEnds (style) { const s = sanitizeLineStyle(style); return { ...s, startEnd: s.endEnd, endEnd: s.startEnd } }

/** apply plain words (what a command or panel passes): stroke, weight, ends ('none'|'arrow'|'forward'|'back'|'both'|'dot'), color, label */
export function withWords (style, w) {
  const s = sanitizeLineStyle(style); const o = (w && typeof w === 'object') ? w : {}; const next = { ...s }
  if (o.stroke !== undefined) { const k = String(o.stroke).toLowerCase(); if (!STROKES.includes(k)) throw new Error('stroke must be one of: ' + STROKES.join(', ')); next.kind = k === 'double' ? 'double' : 'cylinder'; next.dashed = k === 'dashed'; next.dotted = k === 'dotted' }
  if (o.weight !== undefined) { const k = String(o.weight).toLowerCase(); if (!(k in WEIGHTS)) throw new Error('weight must be one of: ' + Object.keys(WEIGHTS).join(', ')); next.thickness = WEIGHTS[k] }
  if (o.ends !== undefined) {
    const k = String(o.ends).toLowerCase()
    const map = { none: ['none', 'none'], arrow: ['none', 'arrow'], forward: ['none', 'arrow'], back: ['arrow', 'none'], both: ['arrow', 'arrow'], dot: ['dot', 'none'] }
    if (!map[k]) throw new Error('ends must be one of: ' + Object.keys(map).join(', ')); [next.startEnd, next.endEnd] = map[k]
  }
  if (o.color !== undefined) { const c = String(o.color); if (c === 'none' || c === '') next.color = null; else { const cc = cleanColor(c); if (!cc) throw new Error('color must look like #rrggbb'); next.color = cc } }
  if (o.label !== undefined) next.label = o.label
  if (o.meaning !== undefined) { if (!Object.prototype.hasOwnProperty.call(MEANINGS, String(o.meaning))) throw new Error('meaning must be one of: ' + MEANING_IDS.join(', ')) }
  return sanitizeLineStyle(next)
}

export function describeStyle (style) {
  const s = sanitizeLineStyle(style); const m = MEANINGS[s.meaning ?? 'link']
  const ends = s.startEnd === 'none' && s.endEnd === 'none' ? '' : s.startEnd !== 'none' && s.endEnd !== 'none' ? ', ends at both nodes' : s.endEnd !== 'none' ? ', pointing to the second node' : ', marked at the first node'
  return `${m.label} (${weightOf(s)} ${strokeOf(s)}${ends})${s.label ? ' — ' + s.label : ''}`
}
