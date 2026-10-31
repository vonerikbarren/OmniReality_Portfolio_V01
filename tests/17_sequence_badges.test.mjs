import test from 'node:test'
import assert from 'node:assert/strict'
import { imp, shimBrowser, hostile } from './helpers.mjs'
shimBrowser()
const B = await imp('utils/OmniSequenceBadgeModel.js')
const state = { lineups: { A: { order: ['x', 'y', 'z'] }, B: { order: ['y', 'q'] } }, attach: {} }

test('each lineup member gets its place; a node in two lineups is numbered by the first', () => {
  const b = B.badgesFor(state)
  assert.deepEqual(b.map(i => i.nodeId + ':' + i.text), ['x:1', 'y:2', 'z:3', 'q:2'])
  assert.equal(b.find(i => i.nodeId === 'q').lineupId, 'B')
})
test('showTotal writes n/total', () => { assert.equal(B.badgesFor(state, { showTotal: true })[0].text, '1/3') })
test('empty and hostile states give no badges and never throw', () => {
  for (const h of hostile()) assert.doesNotThrow(() => B.badgesFor(h))
  assert.deepEqual(B.badgesFor(null), []); assert.deepEqual(B.badgesFor({ lineups: { A: { order: [1, null, {}] } } }), [])
})
test('prefs sanitize', () => {
  assert.deepEqual(B.sanitizePrefs(undefined), { on: true, showTotal: false }); assert.deepEqual(B.sanitizePrefs({ on: false, showTotal: 'x' }), { on: false, showTotal: false })
  for (const h of hostile()) assert.doesNotThrow(() => B.sanitizePrefs(h))
})
test('badge size grows with distance and stays sane', () => {
  assert.ok(B.badgeScale(100) > B.badgeScale(10)); assert.ok(B.badgeScale(0) >= 0.3); assert.ok(Number.isFinite(B.badgeScale(NaN, NaN, NaN))); assert.ok(B.badgeScale(1e6, 5) <= 2 * 1e6 * Math.tan(Math.PI / 3) * 0.3 + 1)
})
