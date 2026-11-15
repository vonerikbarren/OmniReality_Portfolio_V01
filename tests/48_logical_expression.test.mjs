import test from 'node:test'
import assert from 'node:assert/strict'
import * as A from '../utils/OmniAnimationModel.js'
import * as L from '../utils/OmniLogicalExpressionModel.js'

test('animation classes: sanitize, sample, built-ins start at 0 and end at 1', () => {
  assert.deepEqual(A.sanitizeAnimation(A.sanitizeAnimation({ id: 'x y', dur: 999, tracks: { progress: [{ t: 2, v: 'a' }], nope: [] } })), A.sanitizeAnimation({ id: 'x y', dur: 999, tracks: { progress: [{ t: 2, v: 'a' }] } }))
  assert.equal(A.sanitizeAnimation({ dur: 999 }).dur, 20)
  assert.equal(A.sampleAnimation({}, 0.3).progress, 0.3)   // no track = linear
  for (const a of A.BUILTIN) { assert.equal(A.sampleAnimation(a, 0).progress, 0, a.id); assert.equal(A.sampleAnimation(a, 1).progress, 1, a.id); assert.ok(A.sampleAnimation(a, 0.5).progress >= 0) }
  assert.ok(A.sampleAnimation(A.getAnimation('teleport'), 0.3).progress === 0.35)   // a teleport holds, then jumps
})
test('signature: clamps, idempotent, junk safe', () => {
  const s = L.sanitizeSignature({ tempo: 99, hops: 1, sound: 'x', hue: -4, seed: 'abc' })
  assert.equal(s.tempo, 2); assert.equal(s.hops, 2); assert.equal(s.sound, 'laser'); assert.equal(s.hue, 0); assert.deepEqual(L.sanitizeSignature(s), s)
  assert.deepEqual(L.sanitizeSignature(null), L.DEFAULT_SIGNATURE); assert.equal(L.sanitizeSignature(JSON.parse('{"__proto__":{"tempo":2}}')).tempo, 1)
})
test('derived signature is stable and reflects the work', () => {
  const st = { axioms: { '◉': 3, '▦': 5, '⧖': 1 }, nodes: 30, depth: 2, perMinute: 3 }
  assert.deepEqual(L.deriveSignature(st), L.deriveSignature(st))
  assert.notEqual(L.deriveSignature(st).seed, L.deriveSignature({ ...st, nodes: 31 }).seed)
  assert.ok(L.deriveSignature({ axioms: { a: 1, b: 1, c: 1, d: 1, e: 1, f: 1, g: 1 } }).teleport > L.deriveSignature({ axioms: { a: 1 } }).teleport)
  assert.equal(L.deriveSignature(null).hops >= 2, true)
  const mixed = L.deriveSignature(st, { ...L.DEFAULT_SIGNATURE, tempo: 0.5 }); assert.ok(mixed.tempo >= 0.5 && mixed.tempo <= 2)
})
test('the plan is deterministic, capped, and ends exactly on the target', () => {
  const o = { kind: 'opening', from: [0, 100, 0], to: [4, 5, 9] }
  const a = L.planExpression({ seed: 9 }, o), b = L.planExpression({ seed: 9 }, o), c = L.planExpression({ seed: 10 }, o)
  assert.deepEqual(a, b); assert.notDeepEqual(a.segments.map(s => s.b), c.segments.map(s => s.b))
  assert.ok(a.duration <= L.CAPS.opening + 1e-9); assert.equal(a.segments.at(-1).anim, 'settle'); assert.deepEqual(a.segments.at(-1).b, [4, 5, 9])
  assert.deepEqual(L.sampleExpression(a, a.duration).pos, [4, 5, 9]); assert.deepEqual(L.sampleExpression(a, 999).pos, [4, 5, 9]); assert.equal(L.sampleExpression(a, 999).done, true)
  assert.deepEqual(L.sampleExpression(a, 0).pos.map(x => Math.round(x * 1000) / 1000), [0, 100, 0])
  const slow = L.planExpression({ tempo: 0.5 }, { kind: 'success' }); assert.ok(slow.duration <= L.CAPS.success)
})
test('a loop (start = end) still travels and comes back to the start', () => {
  const p = L.planExpression({ seed: 3, reach: 40 }, { kind: 'success', from: [1, 2, 3] })
  let far = 0; for (let t = 0; t < p.duration; t += 0.05) { const s = L.sampleExpression(p, t).pos; far = Math.max(far, Math.hypot(s[0] - 1, s[1] - 2, s[2] - 3)) }
  assert.ok(far > 5); assert.deepEqual(L.sampleExpression(p, p.duration).pos, [1, 2, 3])
})
test('reduced motion: same signature, calm: no flash, no shake, no sound cues but the arrival', () => {
  const p = L.planExpression({ seed: 4 }, { kind: 'opening', from: [0, 50, 0], to: [0, 1, 0], reduced: true })
  assert.ok(p.segments.every(s => s.anim === 'settle')); for (let t = 0; t < p.duration; t += 0.1) { const s = L.sampleExpression(p, t); assert.equal(s.flash, 0); assert.deepEqual(s.shake, [0, 0, 0]); assert.equal(s.fov, 0) }
  assert.deepEqual(p.cues.map(c => c.name), ['arrive'])
})
test('sound none gives no laser cues; result lines are safe', () => {
  assert.ok(!L.planExpression({ sound: 'none', teleport: 1 }, { kind: 'success' }).cues.some(c => c.name === 'laser'))
  assert.deepEqual(L.resultLines(null), []); assert.deepEqual(L.resultLines({ nodes: 5, axioms: { a: 1, b: 2 }, seconds: 12.345 }).map(x => x.label + x.value), ['Nodes5', 'Axioms used2', 'Time12.35 s'])
})
