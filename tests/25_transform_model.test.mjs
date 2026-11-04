import test from 'node:test'
import assert from 'node:assert/strict'
import * as T from '../utils/OmniTransformModel.js'
test('prefs: uniform defaults on, junk repaired, idempotent', () => {
  const d = T.sanitizeTransformPrefs(null); assert.equal(d.uniform, true); assert.equal(d.mode, 'move')
  const p = T.sanitizeTransformPrefs({ mode: 'zz', space: 5, uniform: false, step: -3, __proto__: { x: 1 } })
  assert.equal(p.mode, 'move'); assert.equal(p.uniform, false); assert.equal(p.step, 1)
  assert.deepEqual(T.sanitizeTransformPrefs(p), p)
})
test('scale lock keeps the shape; unlocked changes one axis', () => {
  assert.deepEqual(T.scaleWithLock([1, 2, 4], 'x', 2, true), [2, 4, 8])
  assert.deepEqual(T.scaleWithLock([1, 2, 4], 'y', 5, false), [1, 5, 4])
  assert.deepEqual(T.scaleWithLock([1, 1, 1], 'x', 0, true), [0.01, 0.01, 0.01])
  assert.deepEqual(T.clampScale([NaN, 1e9, -3]), [1, 1000, 0.01])
})
test('rotate and scale about a centre', () => {
  assert.deepEqual(T.rotateAbout([1, 0, 0], [0, 0, 0], 'z', Math.PI / 2), [0, 1, 0])
  assert.deepEqual(T.rotateAbout([2, 0, 0], [1, 0, 0], 'y', Math.PI), [0, 0, 0])
  assert.deepEqual(T.scaleAbout([2, 0, 0], [1, 0, 0], 3), [4, 0, 0])
  assert.deepEqual(T.centreOf([[0, 0, 0], [2, 4, 6]]), [1, 2, 3])
})
test('undo stack is bounded', () => {
  let s = []; for (let i = 0; i < 80; i++) s = T.pushUndo(s, i)
  assert.equal(s.length, T.UNDO_MAX); assert.equal(s[s.length - 1], 79)
})
