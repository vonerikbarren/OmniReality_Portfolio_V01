/**
 * utils/OmniOrbModel.js (V221) — the maths and vocabulary of the LeftHand orb (greyscale, "possibility"). Pure: no DOM, no THREE.
 * ui/OmniOrbPanel.js draws it; the tests drive it directly.
 */
export const DEFAULT_WORDS = ['Opportunities', 'Unknowns', 'Undefined', 'Possibilities', '?', 'Maybe', 'Perhaps', 'Potential', 'Unwritten', 'Open', 'Unmapped', 'What if']
export const WORD_TIPS = {
  opportunities: 'Doors that are open right now. Each loaded tool is one.',
  unknowns: 'What you have not met yet. The orb keeps room for it.',
  undefined: 'Not yet given a shape. Fire a tool at it and it takes one.',
  possibilities: 'Everything the loaded tools could still become.',
  '?': 'The question that starts every build.',
  maybe: 'Not decided, which means not closed.',
  perhaps: 'A softer maybe. Still a beginning.',
  potential: 'Stored, not spent.',
  unwritten: 'Nothing is there yet. That is the point.',
  open: 'Nothing has been ruled out.',
  unmapped: 'No route here yet. Be the first.',
  'what if': 'The shortest way to start a Reality.',
}
export const MAX_WORDS = 24
export const MAX_WORD_LEN = 24
export const MAX_STREAM = 24
export const RINGS = [{ tilt: 0.35, rot: 0.0, rx: 1.0, ry: 0.42 }, { tilt: -0.5, rot: 1.1, rx: 0.86, ry: 0.36 }, { tilt: 0.1, rot: 2.2, rx: 0.7, ry: 0.3 }]

export function cleanWords (list) {
  const out = []
  ;(Array.isArray(list) ? list : []).forEach(w => { const s = String(w ?? '').trim().slice(0, MAX_WORD_LEN); if (s && !out.some(o => o.toLowerCase() === s.toLowerCase()) && out.length < MAX_WORDS) out.push(s) })
  return out.length ? out : [...DEFAULT_WORDS]
}
export const parseWords = (text) => cleanWords(String(text ?? '').split(/[,\n]/))
export const wordTip = (w) => WORD_TIPS[String(w).toLowerCase()] ?? 'Your word. Edit the list in ⟐OmniHands.'

/** Words on tilted orbit ellipses. Returns [{ i, word, x, y, z, s }] with x, y in -1..1 of the orb radius, z in -1..1 (front = +), s the size factor. */
export function wordPositions (words, t, speed = 1) {
  const n = words.length, perRing = RINGS.map(() => 0)
  const ring = words.map((_, i) => { const r = i % RINGS.length; perRing[r]++; return r })
  const seen = RINGS.map(() => 0)
  return words.map((word, i) => {
    const r = ring[i], R = RINGS[r], k = seen[r]++
    const dir = r % 2 ? -1 : 1
    const a = (k / Math.max(1, perRing[r])) * Math.PI * 2 + dir * t * speed * (0.22 + 0.07 * r)
    const ex = Math.cos(a) * R.rx, ey = Math.sin(a) * R.ry
    const c = Math.cos(R.tilt), s = Math.sin(R.tilt)
    const x = ex * c - ey * s, y = ex * s + ey * c
    const z = Math.sin(a)                  // the far side of the ring is behind the core
    return { i, word, x, y, z, s: 0.72 + 0.28 * (z + 1) / 2 * 1.3 }
  })
}

/** Tool nodes spiralling into the core. p: 0 at the rim .. 1 absorbed. Returns [{ i, name, x, y, p, a }]. */
export function streamPositions (names, t, speed = 1) {
  const list = names.slice(0, MAX_STREAM), n = list.length
  return list.map((name, i) => {
    const p = (((t * 0.1 * speed) + i / Math.max(1, n)) % 1 + 1) % 1
    const r = 1 - p * 0.82                 // 1.0 at the rim .. 0.18 at the core
    const ang = i * 2.399 + p * 4.2        // golden-angle spread, wound as it falls in
    return { i, name, x: Math.cos(ang) * r, y: Math.sin(ang) * r * 0.82, p, a: Math.min(1, p * 3) * (1 - Math.max(0, p - 0.85) / 0.15) }
  })
}

/** Charge 0..1 after holding for `ms` against a full charge of `fullMs`. */
export const chargeAt = (ms, fullMs) => Math.max(0, Math.min(1, ms / Math.max(100, fullMs)))
/** Grey level 0..255 for depth z (-1 back .. 1 front). */
export const greyAt = (z, charge = 0) => Math.round(Math.min(255, 110 + 105 * (z + 1) / 2 + 40 * charge))
