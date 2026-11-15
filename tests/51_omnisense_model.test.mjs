import test from 'node:test'
import assert from 'node:assert/strict'
import * as S from '../utils/OmniSenseModel.js'
import { parseOmniVon } from '../utils/OmniVonModel.js'

const cell = { key: '2,0,5', x: 2, y: 0, z: 5, label: 'Kitchen' }
test('a room has an OmniVon by being a room', () => {
  const v = S.roomVon(cell); assert.deepEqual(v.place, [2, 0, 5]); assert.equal(v.level, 0); assert.deepEqual(v.terms.map(t => t.symbol), ['▦', '◉'])
  assert.equal(S.roomText(cell), '⟐ L0 @(2,0,5) ▦:Room ◉:Kitchen'); assert.deepEqual(S.derivedTerms({ x: 0, y: 0, z: 0 }).map(t => t.symbol), ['▦'])
  assert.deepEqual(S.roomVon(null).place, [0, 0, 0])
})
test('user terms are added, and replace a derived one of the same symbol', () => {
  const u = { terms: [{ symbol: '⧖', value: 'Real time' }, { symbol: '◉', value: 'Pantry' }], level: 1 }
  const v = S.roomVon(cell, u); assert.equal(v.level, 1); assert.deepEqual(v.terms.map(t => t.symbol + ':' + t.value), ['▦:Room', '⧖:Real time', '◉:Pantry'])
  assert.equal(S.hasSymbol(v, '⧖'), true); assert.equal(S.hasSymbol(v, '⚡'), false)
})
test('editing the text: round trip, derived terms are not stored, the place is the room\'s', () => {
  const user = S.sanitizeUserVon({ terms: [{ symbol: '⧖', value: 'Real time' }], level: 1 })
  const text = S.roomText(cell, user); const back = S.userFromText(text, cell); assert.deepEqual(back.user, user); assert.deepEqual(back.problems, [])
  const moved = S.userFromText('⟐ L0 @(9,9,9) ▦:Room ◉:Kitchen ⓘ:3', cell); assert.deepEqual(moved.user.terms, [{ symbol: 'ⓘ', value: 3 }]); assert.deepEqual(S.roomVon(cell, moved.user).place, [2, 0, 5])
  const bad = S.userFromText('⟐ ▦ ?? \u0001', cell); assert.ok(Array.isArray(bad.problems))
  assert.equal(S.userFromText(null, cell).user.terms.length, 0)
})
test('junk never throws', () => {
  for (const j of [null, undefined, 5, 'x', [], { terms: 'no' }, { terms: [null, 1, { symbol: '' }] }, JSON.parse('{"__proto__":{"level":3}}')]) { assert.doesNotThrow(() => S.sanitizeUserVon(j)); assert.doesNotThrow(() => S.roomVon(j, j)) }
  assert.deepEqual(S.sanitizeUserVon(S.sanitizeUserVon({ terms: [{ symbol: '◉', value: 'a' }], level: 9 })), S.sanitizeUserVon({ terms: [{ symbol: '◉', value: 'a' }], level: 9 }))
  assert.ok(S.sanitizeUserVon({ terms: Array.from({ length: 200 }, (_, i) => ({ symbol: 'ab' + String.fromCharCode(97 + (i % 26)), value: i })) }).terms.length <= 32)
})
test('bounds of the rooms', () => {
  const b = S.boundsOf([[0, 0, 0], [40, 0, 20]]); assert.deepEqual(b.center, [20, 0, 10]); assert.deepEqual(b.size, [40, 0, 20]); assert.deepEqual(S.boundsOf([]).center, [0, 0, 0]); assert.deepEqual(S.boundsOf([[NaN, 0, 0]]).size, [0, 0, 0])
})
test('views: top is straight above looking down; the plane fits; iso and orbit are off to a corner; deterministic', () => {
  const b = S.boundsOf([[0, 0, 0], [100, 0, 60]]); const top = S.viewPose('top', b, 20, 60, 1.6)
  assert.ok(Math.abs(top.pos[0] - 50) < 0.01 && Math.abs(top.pos[2] - 30) < 0.01 && top.pos[1] > 50); assert.deepEqual(top.up, [0, 0, -1]); assert.deepEqual(top.target, [50, 0, 30])
  // the whole plane (with a room's margin) is inside the field of view both ways
  const fy = Math.tan(30 * Math.PI / 180); assert.ok(top.pos[1] * fy * 1.6 >= 50 + 18 - 1e-6); assert.ok(top.pos[1] * fy >= 30 + 18 - 1e-6)
  const iso = S.viewPose('iso', b), orb = S.viewPose('orbit', b); assert.ok(iso.pos[1] > 0 && iso.pos[0] > 50 && iso.pos[2] > 30); assert.ok(Math.hypot(...orb.pos.map((v, i) => v - orb.target[i])) > Math.hypot(...iso.pos.map((v, i) => v - iso.target[i])))
  assert.deepEqual(S.viewPose('top', b), S.viewPose('top', b)); assert.deepEqual(S.viewPose('nonsense', b).up, [0, 1, 0]); assert.doesNotThrow(() => S.viewPose('top', null))
  const near = S.viewPose('top', S.boundsOf([[0, 0, 0]])); assert.ok(near.pos[1] > 0)
})
test('tiles carry the equation text and skip broken rooms', () => {
  const t = S.tiles([{ ...cell, world: [50, 10, 110] }, { key: 'bad', x: 0, y: 0, z: 0, world: [NaN, 0, 0] }, null], 20, { '2,0,5': { terms: [{ symbol: '⧖', value: 'Now' }] } })
  assert.equal(t.length, 1); assert.equal(t[0].size, 18.8); assert.equal(t[0].terms, 3); assert.ok(t[0].text.includes('⧖:Now'))
})
