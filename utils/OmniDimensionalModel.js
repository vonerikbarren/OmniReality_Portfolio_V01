/**
 * utils/OmniDimensionalModel.js (V217) — pure helpers for the Dimensional Node (a pocket tuned to one dimensional channel) and its demo set.
 *
 * data = { nodeKind:'dimensionalNode', dimensional:{ axiom, perspective, signature, mode, demo? } }
 *   axiom        an axiom id, or '' = inherit the channel of the Space the node belongs to
 *   perspective  a perspective id of that axiom, or '*' = revealed under ANY perspective of the axiom
 *   signature    the "head signature" shown inside when the node is revealed (text)
 *   mode         'xray' (the inside structure) | 'signature' (only the text)
 * A node is REVEALED while the viewer's channel (OmniHand axiom + ConsciousHand perspective) matches; otherwise it is a veiled glass cube.
 */
import { AXIOMS, AXIOM_IDS, getPerspective } from '../data/OmniAxiomData.js'

export const MODES = ['xray', 'signature']
export function defaultDimensional () { return { axiom: 'time', perspective: '*', signature: 'Signature', mode: 'xray' } }
export function sanitizeDimensional (v) {
  const o = v && typeof v === 'object' ? v : {}
  const axiom = o.axiom === '' ? '' : (AXIOM_IDS.includes(o.axiom) ? o.axiom : 'time')
  const perspective = axiom && o.perspective !== '*' && getPerspective(axiom, o.perspective) ? o.perspective : '*'
  const out = {
    axiom, perspective,
    signature: typeof o.signature === 'string' ? o.signature.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 60) || 'Signature' : 'Signature',
    mode: MODES.includes(o.mode) ? o.mode : 'xray',
  }
  if (o.demo) out.demo = true
  return out
}
/** does the viewer's channel reveal this node?  `inherit` is the channel of the node's Space ({axiom, perspective}) or null */
export function matches (dim, view, inherit = null) {
  if (!dim || !view) return false
  const ch = dim.axiom === '' ? inherit : dim
  if (!ch || !ch.axiom) return false
  return ch.axiom === view.axiom && (ch.perspective === '*' || ch.perspective === view.perspective)
}
export function channelLabel (dim) {
  if (!dim) return ''
  const a = AXIOMS.find(x => x.id === dim.axiom)
  if (!a) return 'Inherits its Space'
  return `${a.name} · ${dim.perspective === '*' ? 'any' : (getPerspective(a.id, dim.perspective)?.name ?? dim.perspective)}`
}

/** A deterministic scatter of demo nodes around the origin, one or two per axiom, so every axiom and the Time perspectives show something. */
export function demoSpecs (seed = 217) {
  let a = seed >>> 0
  const rnd = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
  const plan = [
    ['identity', '*', 'Who is here'], ['identity', 'mask', 'The face worn'],
    ['information', '*', 'What is known'], ['information', 'noise', 'Static'],
    ['space', '*', 'Where this is'], ['space', 'aerial', 'The view from above'],
    ['time', '*', 'The clock'], ['time', 'moment', 'Frozen instant'], ['time', 'hyperlapse', 'Sped-up hours'], ['time', 'slowmo', 'Drawn-out second'],
    ['power', '*', 'What it can do'], ['expression', '*', 'How it speaks'],
  ]
  return plan.map(([axiom, perspective, signature], i) => {
    const ang = rnd() * Math.PI * 2, r = 14 + rnd() * 46
    return { id: `dim_demo_${i + 1}`, label: `Dimensional ${i + 1}`, position: [Math.cos(ang) * r, 2 + rnd() * 12, Math.sin(ang) * r],
      dimensional: { axiom, perspective, signature, mode: i % 3 === 2 ? 'signature' : 'xray', demo: true } }
  })
}
