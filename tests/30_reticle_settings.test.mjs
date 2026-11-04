import test from 'node:test'
import assert from 'node:assert/strict'
import * as R from '../utils/OmniReticleSettings.js'

test('defaults keep the old look', () => { assert.deepEqual({ ...R.DEFAULTS }, { show: true, opacity: 15, color: 'theme', brightness: 100, shadow: 0 }) })
test('colour accepts theme or #rrggbb only', () => {
  assert.equal(R.cleanValue('color', '#FF8800'), '#ff8800'); assert.equal(R.cleanValue('color', ' Theme '), 'theme')
  for (const bad of ['red', '#fff', '#12345g', 5, null, '', [], 'url(x)', '#ff8800; x']) assert.equal(R.cleanValue('color', bad), undefined, String(bad))
})
test('brightness and shadow clamp and reject junk', () => {
  assert.equal(R.cleanValue('brightness', 5), R.BRIGHT_MIN); assert.equal(R.cleanValue('brightness', 900), R.BRIGHT_MAX); assert.equal(R.cleanValue('brightness', '120'), 120)
  assert.equal(R.cleanValue('shadow', -4), 0); assert.equal(R.cleanValue('shadow', 400), 100)
  for (const bad of [true, null, '', 'x', NaN, [], {}]) { assert.equal(R.cleanValue('brightness', bad), undefined); assert.equal(R.cleanValue('shadow', bad), undefined) }
})
test('sanitizePatch keeps only valid known keys', () => {
  assert.deepEqual(R.sanitizePatch({ color: '#00ff00', shadow: 30, brightness: 'x', zzz: 1, __proto__: { opacity: 50 } }), { color: '#00ff00', shadow: 30 })
})
test('old saved settings (no colour etc.) still load with the new defaults', () => {
  const o = R.parseOverrides(JSON.stringify({ v: 1, opacity: 40 })); assert.deepEqual(R.resolveSettings(o), { show: true, opacity: 40, color: 'theme', brightness: 100, shadow: 0 })
})
test('filterFor is none by default and builds brightness and a shadow', () => {
  assert.equal(R.filterFor(R.DEFAULTS), 'none'); assert.equal(R.filterFor(null), 'none')
  assert.match(R.filterFor({ brightness: 150, shadow: 0 }), /^brightness\(1\.5\)$/); assert.match(R.filterFor({ brightness: 100, shadow: 50 }), /^drop-shadow\(0 0 [\d.]+px rgba\(0, 0, 0, [\d.]+\)\)$/)
  assert.match(R.filterFor({ brightness: 80, shadow: 10 }), /brightness\(0\.8\) drop-shadow/)
})
