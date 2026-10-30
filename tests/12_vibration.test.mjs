// V216/V217 vibration model, V245 beat landing + eases, V246 curve editor maths.
import test from 'node:test'
import assert from 'node:assert/strict'
import { imp, shimBrowser } from './helpers.mjs'
shimBrowser()
const V = await imp('utils/OmniVibrationModel.js'); const E = await imp('utils/OmniEases.js'); const C = await imp('utils/OmniCurveModel.js')
const near = (a, b, e = 1e-3) => assert.ok(Math.abs(a - b) <= e, `${a} vs ${b}`)

test('presets: all valid, all loop (period 1 beat / cycle), none changed by the beat landing', () => {
  assert.equal(V.PRESETS.length, 7); assert.ok(V.PRESETS.every(p => p.land === 'none' && p.sync === 'none'))
  for (const p of V.PRESETS) for (const ch of p.channels) { const a = V.waveAt({ ...ch, freq: 1 }, 0.3); const b = V.waveAt({ ...ch, freq: 1 }, 1.3); near(a, b, 1e-9) }
})
test('beat landing: apex / ground / middle put the beat on the lead channel exactly', () => {
  const base = V.sanitizeProgram({ mode: 'beat', bpm: 120, channels: [{ prop: 'pos.y', wave: 'bounce', amp: 0.6 }] })
  const y = (land, beats) => V.evaluate({ ...base, land }, 0, beats).pos[1]
  for (const k of [0, 1, 7]) { near(y('apex', k), 0.6); near(y('ground', k), 0); near(y('middle', k), 0.3, 0.01) }
  near(y('apex', 0.5), 0, 0.01); near(y('none', 0), 0)
  const off = V.sanitizeProgram({ land: 'apex', landOffset: 0.25, channels: [{ prop: 'pos.y', wave: 'ease', ease: 'power2.out', amp: 1 }] })
  assert.ok(V.evaluate(off, 0, 0).pos[1] < 0.95, 'an offset moves the beat off the apex')
  assert.equal(V.sanitizeProgram({ land: 'sideways', landOffset: 9, sync: 'x' }).land, 'none'); assert.equal(V.sanitizeProgram({ landOffset: 9 }).landOffset, 0.5)
})
test('lead channel: the beat follows the chosen channel', () => {
  const p = V.sanitizeProgram({ land: 'apex', lead: 1, channels: [{ prop: 'pos.x', wave: 'sine', amp: 1 }, { prop: 'pos.y', wave: 'curve', amp: 1, curve: [[0, 0], [0.3, 1], [1, 0]] }] })
  near(V.beatPosition(p), 0.3); near(V.evaluate(p, 0, 5).pos[1], 1); assert.equal(V.sanitizeProgram({ lead: 9, channels: [{}] }).lead, 0)
})
test('eases: GSAP names, endpoints, overshoot, bad name = linear', () => {
  assert.equal(E.easeNames().length, 31)
  for (const n of E.easeNames()) { const f = E.easeFn(n); near(f(0), 0, 1e-9); near(f(1), 1, 1e-9) }
  assert.ok(E.easeFn('back.out')(0.7) > 1); assert.equal(E.easeFn('nonsense')(0.3), 0.3); near(E.humpAt('power2.out', 0.5), 1); near(E.humpAt('power2.out', 0), 0)
})
test('curve model: sanitize closes the loop, caps points, moves ends together, snaps, add / remove', () => {
  const c = C.sanitizeCurve([[0, 0], [0.5, 2], [0.5, 0.3], [1, 0.7], [0.2, -5]]); assert.equal(c[0][0], 0); assert.equal(c.at(-1)[0], 1); assert.equal(c[0][1], c.at(-1)[1]); assert.ok(c.every(p => p[1] >= -1 && p[1] <= 1))
  assert.deepEqual(C.sanitizeCurve(null), C.DEFAULT_CURVE.map(p => p.slice()))
  const m = C.movePoint(c, 0, 0.5, 0.4); assert.equal(m[0][1], m.at(-1)[1]); assert.equal(m[0][0], 0)
  let q = C.sanitizeCurve([[0, 0], [1, 0]]); for (let i = 1; i < 40; i++) q = C.addPoint(q, i / 41, 0); assert.ok(q.length <= C.CURVE_LIMITS.max)
  const r = C.removePoint(C.sanitizeCurve([[0, 0], [0.5, 1], [1, 0]]), 1); assert.equal(r.length, 2, 'the minimum is the two ends'); assert.equal(C.removePoint(r, 0).length, 2, 'the ends cannot be removed')
  near(C.curveAt(C.sanitizeCurve([[0, 0], [0.25, 1], [0.75, -1], [1, 0]]), 0.25), 1)
})
