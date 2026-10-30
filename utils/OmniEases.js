/**
 * utils/OmniEases.js (V245) — pure easing curves with GSAP's names, so they feel familiar: linear (none), power1..power4, sine, expo, circ, back, elastic, bounce, each as .in / .out / .inOut.
 *   easeFn('power2.out') -> (t 0..1) => 0..1 (back and elastic overshoot a little)      easeNames() -> every name      isEase(name)
 *   humpAt(name, u) -> the one-beat HUMP used by the vibration waves: ground (u = 0) -> apex (u = 0.5) -> ground (u = 1), the rise through the chosen ease, the fall its mirror image.
 * Formulas are the standard ones (the GSAP defaults: back overshoot 1.70158, elastic amplitude 1 and period 0.3). Never throws; a bad name is linear.
 */
const BASES = ['linear', 'power1', 'power2', 'power3', 'power4', 'sine', 'expo', 'circ', 'back', 'elastic', 'bounce']
const TYPES = ['in', 'out', 'inOut']
const PI = Math.PI

const bounceOut = (t) => { const n = 7.5625; const d = 2.75; if (t < 1 / d) return n * t * t; if (t < 2 / d) { t -= 1.5 / d; return n * t * t + 0.75 } if (t < 2.5 / d) { t -= 2.25 / d; return n * t * t + 0.9375 } t -= 2.625 / d; return n * t * t + 0.984375 }
// the IN curve of each base (out = 1 - in(1 - t), inOut = symmetric); bounce is defined by its OUT curve below
const IN = {
  linear: (t) => t,
  power1: (t) => t * t, power2: (t) => t ** 3, power3: (t) => t ** 4, power4: (t) => t ** 5,
  sine: (t) => 1 - Math.cos(t * PI / 2),
  expo: (t) => (t === 0 ? 0 : 2 ** (10 * (t - 1))),
  circ: (t) => 1 - Math.sqrt(Math.max(0, 1 - t * t)),
  back: (t) => t * t * ((1.70158 + 1) * t - 1.70158),
  elastic: (t) => (t === 0 ? 0 : t === 1 ? 1 : -(2 ** (10 * (t - 1))) * Math.sin((t - 1 - 0.3 / 4) * (2 * PI) / 0.3)),
  bounce: (t) => 1 - bounceOut(1 - t),
}
export const easeNames = () => BASES.flatMap(b => (b === 'linear' ? ['linear'] : TYPES.map(t => `${b}.${t}`)))
export const isEase = (n) => typeof n === 'string' && easeNames().includes(n)

export function easeFn (name) {
  const [b, tp = 'out'] = String(name ?? '').split('.'); const f = IN[b]
  if (!f) return IN.linear
  if (b === 'linear') return IN.linear
  const c = (t) => Math.min(1, Math.max(0, Number.isFinite(t) ? t : 0))
  if (tp === 'in') return (t) => f(c(t))
  if (tp === 'inOut') return (t) => { const x = c(t); return x < 0.5 ? f(2 * x) / 2 : 1 - f(2 * (1 - x)) / 2 }
  return (t) => 1 - f(1 - c(t))
}
const CACHE = new Map()
export function humpAt (name, u) {
  let f = CACHE.get(name); if (!f) { f = easeFn(name); CACHE.set(name, f) }
  const x = u - Math.floor(u)
  return f(1 - Math.abs(2 * x - 1))
}
export default { easeNames, isEase, easeFn, humpAt }
