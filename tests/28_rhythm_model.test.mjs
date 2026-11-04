import test from 'node:test'
import assert from 'node:assert/strict'
import * as R from '../utils/OmniRhythmModel.js'
import * as L from '../utils/OmniLineModel.js'
test('defaults, repair, idempotence, hostile input', () => {
  const d = R.sanitizeRhythm(null); assert.equal(d.steps.length, 16); assert.equal(d.tempo, 100)
  const s = R.sanitizeRhythm({ tempo: 9999, steps: [5, -1, 'x', NaN], swing: 9, follow: { nodeId: '__proto__' }, bindings: [{ target: 'a', anim: 'zzz', amount: 99, every: 0 }, { target: '../x' }, null, { target: 'a', id: 'b1' }, { target: 'c', id: 'b1' }], __proto__: { evil: 1 } })
  assert.equal(s.tempo, 300); assert.equal(s.steps.length, 4); assert.deepEqual(s.steps.slice(0, 2), [1, 0]); assert.equal(s.swing, 0.75); assert.equal(s.follow, null); assert.equal(s.bindings.length, 3)
  assert.equal(s.bindings[0].anim, 'pulse'); assert.equal(s.bindings[0].amount, 2); assert.equal(s.bindings[0].every, 1); assert.notEqual(s.bindings[1].id, s.bindings[2].id); assert.equal(s.evil, undefined)
  assert.deepEqual(R.sanitizeRhythm(s), s)
})
test('pattern text round trip', () => {
  assert.deepEqual(R.parsePattern('x.o. x.o.'), [1, 0, 0.5, 0, 1, 0, 0.5, 0]); assert.equal(R.patternText([1, 0, 0.5, 0.2]), 'x.oo'); assert.throws(() => R.parsePattern('x.'))
})
test('timing: 120 bpm = 0.125 s a step; swing delays odd steps; due steps are found once', () => {
  const r = R.sanitizeRhythm({ tempo: 120, steps: R.parsePattern('x.x.x.x.'), swing: 0.5 })
  assert.equal(R.stepSeconds(r), 0.125); assert.equal(R.stepTime(r, 0), 0); assert.equal(R.stepTime(r, 1), 0.125 + 0.0625)
  const a = R.dueSteps(r, 10, -1, 10.3); assert.deepEqual(a.events.map(e => e.g), [0, 2]); const b = R.dueSteps(r, 10, a.lastG, 10.3); assert.equal(b.events.length, 0)
  const c = R.dueSteps(r, 10, a.lastG, 10.6); assert.ok(c.events.every(e => e.g > a.lastG))
  const big = R.dueSteps(r, 0, -1, 500); assert.ok(big.events.length <= 64 && big.lastG > 3000, 'a long gap skips ahead: ' + big.lastG)
})
test('envelope shape', () => {
  assert.equal(R.envelope(-1), 0); assert.equal(R.envelope(0.02, 0.02, 0.25), 1); assert.equal(R.envelope(5, 0.02, 0.25), 0); assert.ok(R.envelope(0.1, 0.02, 0.25, 'linear') < 1 && R.envelope(0.1, 0.02, 0.25, 'linear') > 0)
  assert.ok(R.envelope(0.01, 0.02, 0.25) > 0 && R.envelope(0.01, 0.02, 0.25) < 1)
})
test('every animation gives finite offsets, zero at rest, never throws', () => {
  for (const a of R.ANIMS) { const z = R.offsetFor(a, 0, 1, 1); assert.ok(z.glow === 0 && z.pos.every(Number.isFinite) && z.scale.every(Number.isFinite)); const o = R.offsetFor(a, 1, 0.3, 2, 5, -1); assert.ok([...o.pos, ...o.rot, ...o.scale, o.glow].every(Number.isFinite), a) }
  assert.ok(R.offsetFor('pulse', 1, 0, 1).scale[0] > 0); assert.ok(R.offsetFor('bounce', 1, 0, 1).pos[1] > 0); assert.ok(R.offsetFor('squash', 1, 0, 1).scale[1] < 0); assert.ok(R.offsetFor('flash', 1, 0, 1).glow > 0)
  assert.ok(R.offsetFor('sway', 1, 0.5, 1, 0, 1).pos[0] > 0 && R.offsetFor('sway', 1, 0.5, 1, 0, -1).pos[0] < 0); assert.ok(Math.abs(R.offsetFor('kick', 1, 1, 1).rot[1] - Math.PI * 2) < 1e-9)
  assert.deepEqual(R.offsetFor('nope', 1, 1, 1).scale, [0, 0, 0])
})
test('firing rules', () => {
  const b = R.newBinding('t', 'pulse', { every: 2, accentOnly: true }); assert.ok(R.shouldFire(b, 0, 1)); assert.ok(!R.shouldFire(b, 1, 1)); assert.ok(!R.shouldFire(b, 2, 0.5)); assert.ok(!R.shouldFire({ ...b, on: false }, 0, 1))
})
test('the Drives meaning exists', () => { const s = L.applyMeaning(null, 'drives'); assert.equal(L.meaningOf(s), 'drives'); assert.equal(s.endEnd, 'arrow') })
