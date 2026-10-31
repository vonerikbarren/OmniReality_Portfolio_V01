import test from 'node:test'
import assert from 'node:assert/strict'
import { imp, shimBrowser, hostile } from './helpers.mjs'
shimBrowser()
const C = await imp('utils/OmniCurveModel.js')
const V = await imp('utils/OmniVibrationModel.js')
const hump = [[0, 0], [0.5, 1], [1, 0]]

test('curves saved before V254 play exactly the same (no handles = cosine ease)', () => {
  const c = C.sanitizeCurve(hump)
  for (const u of [0, 0.1, 0.25, 0.4, 0.5, 0.75, 0.9]) {
    const seg = u <= 0.5 ? [hump[0], hump[1]] : [hump[1], hump[2]]; const f = (u - seg[0][0]) / (seg[1][0] - seg[0][0])
    assert.ok(Math.abs(C.curveAt(c, u) - (seg[0][1] + (seg[1][1] - seg[0][1]) * (1 - Math.cos(f * Math.PI)) / 2)) < 1e-9, 'u=' + u)
  }
  assert.ok(c.every(p => p.length === 2))
})

test('a handle bends only its own segment; the curve stays a function of time and inside -1..1', () => {
  const c = C.moveHandle(C.sanitizeCurve(hump), 1, 'out', 0.9, 1.9)
  assert.equal(c[1].length, 6); assert.ok(c[1][4] <= 0.5 && c[1][4] >= 0)
  let prev = -2
  for (let i = 0; i <= 200; i++) { const y = C.curveAt(c, i / 200 * 0.999); assert.ok(y >= -1 && y <= 1); prev = y }
  // first segment (0 -> 0.5) has no handles on its two ends except point 1's IN side, which is 0: still the cosine
  const plain = C.sanitizeCurve(hump); assert.equal(C.curveAt(c, 0.25), C.curveAt(plain, 0.25))
  assert.notEqual(C.curveAt(c, 0.75), C.curveAt(plain, 0.75))
})

test('bezier hits its own points and is continuous across a joint', () => {
  const c = C.smoothCurve([[0, 0], [0.3, 0.8], [0.7, -0.6], [1, 0]], 0.7)
  for (const p of c) assert.ok(Math.abs(C.curveAt(c, Math.min(p[0], 0.999999)) - p[1]) < 5e-3, 'point ' + p[0])
  for (const p of c.slice(1, -1)) assert.ok(Math.abs(C.curveAt(c, p[0] - 1e-4) - C.curveAt(c, p[0] + 1e-4)) < 5e-3)
})

test('mirror keeps the joint smooth; ends have a single handle', () => {
  const c = C.moveHandle(C.sanitizeCurve(hump), 1, 'out', 0.7, 0.8, { mirror: true })
  assert.ok(Math.abs(c[1][2] + c[1][4]) < 1e-9 && Math.abs(c[1][3] + c[1][5]) < 1e-9)
  assert.equal(C.handleOf(c, 0, 'in'), null); assert.equal(C.handleOf(c, 2, 'out'), null)
  assert.deepEqual(C.moveHandle(c, 0, 'in', 0.5, 0.5), c)
})

test('handles stay inside the neighbouring points when points move', () => {
  let c = C.moveHandle(C.sanitizeCurve(hump), 1, 'out', 1, 0, {}); c = C.moveHandle(c, 1, 'in', 0, 0, {})
  c = C.movePoint(c, 1, 0.95, 1)
  assert.ok(c[1][0] <= 0.99 && c[1][4] <= 0.0501 + 1e-9)
  c = C.movePoint(c, 1, 0.3, 0.5); assert.ok(c[1][4] >= 0 && c[1][2] <= 0)
})

test('straighten removes handles; smooth with tension 0 is plain', () => {
  const s = C.smoothCurve(hump, 0.8); assert.ok(C.hasHandles(s[1]))
  assert.ok(C.clearHandles(s).every(p => p.length === 2)); assert.ok(C.clearHandles(s, 1)[1].length === 2 && C.hasHandles(C.clearHandles(s, 1)[1]) === false)
  assert.ok(C.smoothCurve(hump, 0).every(p => p.length === 2))
})

test('hostile handle values never throw or escape the limits', () => {
  for (const h of hostile()) assert.doesNotThrow(() => C.sanitizeCurve([[0, 0, h, h, h, h], [1, 0, h, h, h, h]]))
  const c = C.sanitizeCurve([[0, 0, -9, 99, 9, -99], [0.5, 0, -9, 9, 9, 9], [1, 0, -9, 9, 9, 9]])
  for (const p of c) if (p.length === 6) { assert.ok(p[2] <= 0 && p[4] >= 0 && Math.abs(p[3]) <= 2 && Math.abs(p[5]) <= 2) }
  assert.ok(Number.isFinite(C.curveAt(c, 0.3)))
  assert.equal(C.sanitizeCurve([[0, 0, NaN, 1, 1, 1], [1, 0]]).length, 2)
})

test('a vibration program with a bezier curve survives sanitize and evaluates', () => {
  const curve = C.smoothCurve([[0, 0], [0.5, 1], [1, 0]], 0.6)
  const p = V.sanitizeProgram({ id: 'bz', channels: [{ prop: 'pos.y', wave: 'curve', curve, amp: 2 }] })
  assert.deepEqual(p.channels[0].curve, curve)
  const out = V.evaluate(p, 0.25, 0.25); assert.ok(Object.values(out).flat().every(v => Number.isFinite(v)))
})
