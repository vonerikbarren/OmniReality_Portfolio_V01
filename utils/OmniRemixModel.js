/**
 * utils/OmniRemixModel.js (V226) — pure model for "Remix": a seeded random COMBINATION for each node, to get ideas moving.
 *
 *   rollNode(rng, opts)     one combination: { axiom, perspective, color, scale, spin, label, motion }
 *   rollScene(ids, seed, opts)  a deal for every id (same seed + same ids => same deal, so a good one can be found again)
 *   layoutPositions(kind, n, centre, rng)   scatter | ring | spiral | grid | stack
 *
 * No DOM, no THREE. The system (systems/OmniRemix.js) applies the deal and keeps one undo snapshot.
 */
import { AXIOMS } from '../data/OmniAxiomData.js'

export const SCHEMES = ['analogous', 'triad', 'complement', 'split', 'mono']
export const LAYOUTS = ['scatter', 'ring', 'spiral', 'grid', 'stack']
export const MOTIONS = ['bounce', 'hop', 'sway', 'pulse', 'shake', 'float', 'dance']
export const ASPECTS = ['what', 'color', 'scale', 'spin', 'label', 'motion', 'layout']

// small, fast, seedable (mulberry32). Seed may be a number or any string.
export function hashSeed (s) { let h = 2166136261; const t = String(s); for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619) } return h >>> 0 }
export function makeRng (seed) {
  let a = (typeof seed === 'number' ? seed >>> 0 : hashSeed(seed)) || 1
  const next = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
  next.int = (lo, hi) => lo + Math.floor(next() * (hi - lo + 1))
  next.pick = (arr) => arr[Math.floor(next() * arr.length)]
  return next
}

// a spark word per axiom, so the label reads like a prompt, not a table row
const NOUNS = ['gate', 'engine', 'garden', 'mirror', 'signal', 'tide', 'ledger', 'echo', 'loom', 'lantern', 'bridge', 'seed', 'orbit', 'archive', 'forge', 'thread', 'harbor', 'compass', 'chorus', 'vault']

export function hslToHex (h, s, l) {
  h = ((h % 360) + 360) % 360; s = Math.max(0, Math.min(1, s)); l = Math.max(0, Math.min(1, l))
  const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l)
  const f = (n) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))))
  return '#' + [f(0), f(8), f(4)].map(v => v.toString(16).padStart(2, '0')).join('')
}

/** A palette of n colours from a random base hue and scheme. */
export function palette (rng, n, scheme) {
  const base = rng() * 360, s = scheme ?? rng.pick(SCHEMES)
  const offs = { analogous: [0, 25, -25, 50, -50], triad: [0, 120, 240], complement: [0, 180], split: [0, 150, 210], mono: [0] }[s] ?? [0]
  const out = []
  for (let i = 0; i < Math.max(1, n); i++) {
    const o = offs[i % offs.length], mono = s === 'mono'
    out.push(hslToHex(base + o, 0.55 + rng() * 0.35, mono ? 0.3 + rng() * 0.45 : 0.45 + rng() * 0.2))
  }
  return { scheme: s, colors: out }
}

export function rollNode (rng, opts = {}) {
  const axiom = opts.axiom ? (AXIOMS.find(a => a.id === opts.axiom) ?? rng.pick(AXIOMS)) : rng.pick(AXIOMS)
  const perspective = rng.pick(axiom.perspectives)
  const noun = rng.pick(NOUNS)
  const sc = opts.scaleRange ?? [0.5, 2.2]
  const s = +(sc[0] + rng() * (sc[1] - sc[0])).toFixed(2)
  return {
    axiom: axiom.id, perspective: perspective.id,
    label: `${axiom.name} · ${perspective.name} ${noun}`,
    scale: [s, +(s * (0.6 + rng() * 0.8)).toFixed(2), s],            // not always a cube: a little lopsided
    spin: [0, rng.int(0, 7) * 45, 0],                                  // degrees, in 45 steps so it looks chosen
    motion: rng() < 0.5 ? rng.pick(MOTIONS) : null,
  }
}

/** The whole deal. `what` limits which aspects are applied; the model always rolls all of them so the seed stays stable. */
export function rollScene (ids, seed, opts = {}) {
  const rng = makeRng(seed)
  const pal = palette(rng, Math.max(1, Math.min(6, ids.length)), opts.scheme)
  const layout = opts.layout ?? null
  const items = ids.map(id => ({ id, ...rollNode(rng, opts), color: rng.pick(pal.colors) }))
  return { seed, scheme: pal.scheme, palette: pal.colors, layout, items, spark: sparkLine(items) }
}

/** One line to start a thought: the strongest three combinations. */
export function sparkLine (items) {
  return items.slice(0, 3).map(i => i.label).join('  +  ')
}

export function layoutPositions (kind, n, centre = [0, 1, 0], rng = Math.random) {
  const [cx, cy, cz] = centre, out = []
  const gap = 3
  for (let i = 0; i < n; i++) {
    let p
    if (kind === 'ring') { const r = Math.max(3, n * 0.6), a = (i / n) * Math.PI * 2; p = [cx + Math.cos(a) * r, cy, cz + Math.sin(a) * r] }
    else if (kind === 'spiral') { const a = i * 0.9, r = 2 + i * 0.7; p = [cx + Math.cos(a) * r, cy + i * 0.4, cz + Math.sin(a) * r] }
    else if (kind === 'grid') { const c = Math.ceil(Math.sqrt(n)); p = [cx + (i % c - (c - 1) / 2) * gap, cy, cz + (Math.floor(i / c) - (Math.ceil(n / c) - 1) / 2) * gap] }
    else if (kind === 'stack') p = [cx, cy + i * 1.6, cz]
    else p = [cx + (rng() - 0.5) * 16, cy + (rng() - 0.5) * 6, cz + (rng() - 0.5) * 16]
    out.push(p.map(v => +v.toFixed(2)))
  }
  return out
}
