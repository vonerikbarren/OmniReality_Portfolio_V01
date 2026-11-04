import test from 'node:test'
import assert from 'node:assert/strict'
import * as S from '../utils/OmniSelectModel.js'

test('select phase collects and toggles; no edges yet', () => {
  let s = S.newSelection('o'); assert.equal(s.phase, 'select')
  let r = S.pick(s, 'a'); assert.equal(r.action, 'added'); s = r.state; r = S.pick(s, 'b'); s = r.state
  assert.deepEqual(s.members, ['a', 'b']); assert.deepEqual(r.edges, [])
  r = S.pick(s, 'a'); assert.equal(r.action, 'removed'); assert.deepEqual(r.state.members, ['b'])
  assert.equal(S.pick(s, 'o').action, 'ignored'); assert.equal(S.pick(s, '__proto__').action, 'ignored')
})
test('connect star joins the origin to every pick; chain joins pick to pick', () => {
  let s = S.newSelection('o'); s = S.pick(s, 'a').state; s = S.pick(s, 'b').state
  const star = S.startConnect(s); assert.deepEqual(star.edges, [['o', 'a'], ['o', 'b']]); assert.equal(star.state.phase, 'connect')
  assert.deepEqual(S.pick(star.state, 'c').edges, [['o', 'c']])
  const chain = S.startConnect(S.setPattern(s, 'chain')); assert.deepEqual(chain.edges, [['o', 'a'], ['a', 'b']])
  const r = S.pick(chain.state, 'c'); assert.deepEqual(r.edges, [['b', 'c']]); assert.deepEqual(S.pick(r.state, 'd').edges, [['c', 'd']])
  assert.deepEqual(S.pick(r.state, 'c').edges, [])   // already joined
})
test('sanitizeSelection: hostile input, idempotent, capped', () => {
  const bad = S.sanitizeSelection({ origin: '<x>', members: ['a', 'a', 'o', 5, '__proto__'], pattern: 'zigzag', phase: 'x' })
  assert.equal(bad.origin, null); assert.deepEqual(bad.members, ['a', 'o']); assert.equal(bad.pattern, 'star'); assert.equal(bad.phase, 'select')
  assert.deepEqual(S.sanitizeSelection(bad), bad)
  const many = S.sanitizeSelection({ origin: 'o', members: Array.from({ length: 500 }, (_, i) => 'n' + i) }); assert.equal(many.members.length, S.MAX_MEMBERS)
  assert.equal(S.pick(S.newSelection(null), 'a').action, 'ignored')
})
