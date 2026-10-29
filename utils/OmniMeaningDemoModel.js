/**
 * utils/OmniMeaningDemoModel.js (V241) — the 10-second "meaning by change" demo as DATA: pure, no DOM, no Three.js.
 * Three nodes (A, B, C). Each axiom makes ONE change, shown by its own channel, with a caption (symbol + colour from data/OmniAxiomData.js):
 *   0-1.5 s   the three nodes appear, equal and calm
 *   1.5-3.5   Power:       A grows and brightens                (channel: size + brightness)
 *   3.5-5.5   Time:        B spins faster                       (channel: rate of motion)
 *   5.5-7.5   Expression:  C turns from cool to warm            (channel: colour)
 *   7.5-9.5   Space:       A and B move closer to C             (channel: distance)
 *   9.5-10    rest
 * `steps(opts)` returns the timeline; `valueAt(t)` is the state at time t (used by the runtime and by the tests).
 */
export const DURATION = 10
export const IDS = ['demo_meaning_a', 'demo_meaning_b', 'demo_meaning_c']
export const AXES = {
  power: { name: 'Power', symbol: '⚡', color: '#ff7a5c' },
  time: { name: 'Time', symbol: '⧖', color: '#ffd36b' },
  expression: { name: 'Expression', symbol: '❖', color: '#c79bff' },
  space: { name: 'Space', symbol: '▦', color: '#8dffb0' },
}
export const STEPS = [
  { axis: 'power', from: 1.5, to: 3.5, caption: 'Power ↑  one grows and glows' },
  { axis: 'time', from: 3.5, to: 5.5, caption: 'Time ↑  one spins faster' },
  { axis: 'expression', from: 5.5, to: 7.5, caption: 'Expression  one changes colour' },
  { axis: 'space', from: 7.5, to: 9.5, caption: 'Space ↓  they move closer' },
]
export const BASE = { scale: 1, spin: 0.6, cool: '#5aa9ff', warm: '#ff8a3c', gap: 4.5, near: 1.8, grow: 2.4 }

const clamp01 = (x) => Math.max(0, Math.min(1, x))
const ease = (x) => { x = clamp01(x); return x * x * (3 - 2 * x) }
const prog = (t, a, b) => ease((t - a) / (b - a))
const lerp = (a, b, k) => a + (b - a) * k

/** Which step is showing at time t (or null). */
export const stepAt = (t) => STEPS.find(s => t >= s.from && t < s.to) ?? null

/** The full state at time t: per node scale / glow / spin speed / colour mix (0 cool .. 1 warm) / x offset from C. */
export function valueAt (t, base = BASE) {
  const tt = Math.max(0, Math.min(DURATION, Number(t) || 0))
  const appear = prog(tt, 0, 1.5)
  const p = prog(tt, 1.5, 3.5), ti = prog(tt, 3.5, 5.5), ex = prog(tt, 5.5, 7.5), sp = prog(tt, 7.5, 9.5)
  return {
    t: tt, appear,
    a: { scale: lerp(0.0001, 1, appear) * lerp(1, base.grow, p), glow: lerp(0.25, 1, p), spin: base.spin, mix: 0, x: -lerp(base.gap, base.near, sp) },
    b: { scale: lerp(0.0001, 1, appear), glow: 0.25, spin: lerp(base.spin, base.spin * 7, ti), mix: 0, x: lerp(base.gap, base.near, sp) },
    c: { scale: lerp(0.0001, 1, appear), glow: 0.25, spin: base.spin, mix: ex, x: 0 },
    step: stepAt(tt),
  }
}

/** The unchanged baseline used for the "captions off" test: same timeline, same changes. */
export const describe = () => STEPS.map(s => `${s.from}-${s.to} s: ${AXES[s.axis].name}: ${s.caption}`).join('\n')
