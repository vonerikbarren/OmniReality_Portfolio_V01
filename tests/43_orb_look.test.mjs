import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import * as O from '../utils/OmniOrbModel.js'
import { HANDS } from '../utils/OmniOrbPotentials.js'
const read = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8')

test('a light panel gets dark ink and a dark panel keeps the glowing palette', () => {
  for (const h of Object.keys(HANDS)) {
    const pal = HANDS[h].palette
    assert.equal(O.inkFor(pal, '#ffffff').light, true); assert.equal(O.inkFor(pal, '#ffffff').text, '#16161c'); assert.equal(O.lightness(O.inkFor(pal, '#ffffff').core) < 0.5, true, h + ': the core shows on white')
    assert.deepEqual({ ...O.inkFor(pal, '#000000') }, { ...pal, light: false })
  }
  assert.equal(O.isLightPanel('#ffffff'), true); assert.equal(O.isLightPanel('#000000'), false); assert.equal(O.isLightPanel('#ffd24a'), true); assert.equal(O.isLightPanel('#2244aa'), false)
  assert.equal(O.isLightPanel('nonsense'), false); assert.equal(O.inkFor(null, 'x').light, false)
})
test('charging speeds the system up and gathers more motes', () => {
  assert.equal(O.spinFactor(0), 1); assert.ok(O.spinFactor(1) > 5.5 && O.spinFactor(0.5) < O.spinFactor(1)); assert.equal(O.spinFactor(9), O.spinFactor(1)); assert.equal(O.spinFactor('x'), 1)
  assert.equal(O.moteCount(0), 0, 'none at rest'); assert.ok(O.moteCount(0.1) >= 8 && O.moteCount(1) === O.MOTE_MAX && O.moteCount(0.5) < O.moteCount(1))
  const m = O.motePositions(O.moteCount(1), 3.3, 1); assert.equal(m.length, O.MOTE_MAX)
  for (const p of m) { assert.ok(Math.hypot(p.x, p.y) <= 1.2, 'inside the orb'); assert.ok(p.a >= 0 && p.a <= 1) }
  assert.deepEqual(O.motePositions(5, 1, 1), O.motePositions(5, 1, 1), 'deterministic'); assert.equal(O.motePositions(-3, 1).length, 0); assert.equal(O.motePositions(1e9, 1).length, O.MOTE_MAX)
})
test('every hand orb defaults to white, and an old saved dark colour becomes white', async () => {
  const S = await import('../utils/OmniHandsSettings.js')
  assert.equal(S.ORB_DEFAULT_COLOR, '#ffffff')
  for (const h of ['lh', 'rh', 'conscious', 'omnihand']) assert.equal(S.getDefault(h, 'orbColor'), '#ffffff')
  const src = read('utils/OmniHandsSettings.js'); assert.match(src, /OLD_ORB_DISCS\.includes\(v\) \? def : v/)
})
test('wired: the panel has White / Black presets and the orb spins with its charge', () => {
  assert.match(read('ui/OmniHandsPanel.js'), /orb-color-/); const o = read('ui/OrbNode.js'); assert.match(o, /spinFactor\(this\._spin\)/); assert.match(o, /motePositions\(nm/); assert.match(o, /classList\.toggle\('is-light'/)
})
