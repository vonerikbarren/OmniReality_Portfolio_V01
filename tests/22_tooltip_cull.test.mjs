import test from 'node:test'
import assert from 'node:assert/strict'
import * as C from '../utils/OmniTooltipCull.js'

test('cull prefs: defaults, clamps, hostile input', () => {
  assert.deepEqual(C.sanitizeCullPrefs(null), { ...C.DEFAULT_CULL })
  const p = C.sanitizeCullPrefs({ occlusion: 'sideways', max: 99999, dimOpacity: -3 })
  assert.equal(p.occlusion, 'hide'); assert.equal(p.max, 400); assert.equal(p.dimOpacity, 0.1)
  assert.deepEqual(C.sanitizeCullPrefs(p), p)
})
test('chooseHeaders: nearest on-screen first, off-screen free, kept ones always', () => {
  const items = [{ id: 'a', dist: 5, onScreen: true }, { id: 'b', dist: 1, onScreen: true }, { id: 'c', dist: 0.5, onScreen: false }, { id: 'd', dist: 9, onScreen: true }]
  assert.deepEqual([...C.chooseHeaders(items, 2)].sort(), ['a', 'b'])
  assert.ok(C.chooseHeaders(items, 1, new Set(['d'])).has('d'))
  assert.ok(!C.chooseHeaders(items, 10).has('c'))
  assert.equal(C.chooseHeaders(null).size, 0)
})
test('isBlocked and stateFor', () => {
  assert.equal(C.isBlocked(3, 10), true); assert.equal(C.isBlocked(9.99, 10), false); assert.equal(C.isBlocked(NaN, 10), false)
  assert.equal(C.stateFor(true, 'hide'), 'hidden'); assert.equal(C.stateFor(true, 'dim'), 'dim'); assert.equal(C.stateFor(true, 'show'), 'visible'); assert.equal(C.stateFor(false, 'hide'), 'visible')
})
