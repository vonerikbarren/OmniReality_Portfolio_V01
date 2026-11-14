import test from 'node:test'
import assert from 'node:assert/strict'
import * as V from '../utils/OmniVonModel.js'

test('seven scales: 3 out, planet neutral, 3 in', () => {
  assert.equal(V.LEVELS.length, 7); assert.deepEqual(V.LEVELS.map(l => l.n), [-3, -2, -1, 0, 1, 2, 3])
  assert.equal(V.levelName(0), 'planet'); assert.equal(V.levelName(3), 'galaxy'); assert.equal(V.levelName(-3), 'subatomic'); assert.equal(V.levelName(9), '')
})
test('an OmniVon prints and parses as the same equation', () => {
  const von = { terms: [{ symbol: '▦', value: 'Room' }, { symbol: '⧖', value: 'Real time' }, { symbol: '⚡', value: 3 }, { symbol: '⟐N', value: null }], level: -1, place: [2, 0, 5], t: 12.5 }
  const text = V.printOmniVon(von); assert.equal(text, '⟐ L-1 @(2,0,5) t=12.5 ▦:Room ⧖:"Real time" ⚡:3 ⟐N')
  const back = V.parseOmniVon(text); assert.deepEqual(back.problems, []); assert.deepEqual(back.von, V.sanitizeOmniVon(von)); assert.equal(V.printOmniVon(back.von), text)
})
test('the leading ⟐ is optional, + is allowed, and the order of terms is kept', () => {
  const a = V.parseOmniVon('▦:Room + ⧖:2 ◉').von; assert.deepEqual(a.terms.map(t => t.symbol), ['▦', '⧖', '◉']); assert.equal(a.terms[1].value, 2)
  assert.deepEqual(V.parseOmniVon('⟐ ▦:Room ⧖:2 ◉').von, a)
})
test('several perspectives of one axiom are several terms', () => { const v = V.parseOmniVon('▦:Room ▦:Map ▦:Inside').von; assert.equal(v.terms.length, 3); assert.equal(V.aspect(v, '▦').terms.length, 3); assert.equal(V.aspect(v, '⧖').terms.length, 0) })
test('unreadable tokens are reported, never guessed', () => {
  const r = V.parseOmniVon('L9 @(1,2) t=x a:b:c "x ▦'); assert.ok(r.problems.length >= 3); assert.ok(r.von.terms.some(t => t.symbol === '▦'))
  assert.equal(V.parseOmniVon('').von.terms.length, 0); assert.equal(V.parseOmniVon(null).problems.length, 0)
  const many = V.parseOmniVon(Array.from({ length: 200 }, (_, i) => 'a' + i).join(' ')); assert.equal(many.von.terms.length, V.LIMITS.terms); assert.ok(many.problems.some(p => /only the first/.test(p)))
})
test('an undefined symbol is honest: valid, but listed as not yet defined', () => {
  const v = V.parseOmniVon('▦ 🜂 ⧖').von; assert.deepEqual(V.undefinedTerms(v), ['🜂']); assert.equal(V.isKnown('▦'), true); assert.equal(V.isKnown('constructor'), false)
})
test('hone in: a view with fewer terms still matches the whole', () => {
  const whole = V.parseOmniVon('▦:Room ⧖:2 ⚡:1').von; assert.equal(V.contains(whole, V.aspect(whole, '⧖')), true); assert.equal(V.contains(whole, V.parseOmniVon('⧖:3').von), false); assert.equal(V.contains(whole, V.parseOmniVon('◉').von), false)
})
test('sanitize: never throws, idempotent, clamps, no prototype pollution', () => {
  for (const junk of [null, undefined, 5, 'x', [], { terms: 'no' }, { terms: [null, 3, { symbol: 'a b' }, { symbol: ':' }, { symbol: '⟐' }, { symbol: 'abcd' }] }, { level: 99, place: ['a', NaN, 1e99], t: 'x' }, JSON.parse('{"__proto__":{"x":1},"terms":[{"symbol":"▦","__proto__":{"y":1}}]}')]) {
    const s = V.sanitizeOmniVon(junk); assert.deepEqual(V.sanitizeOmniVon(s), s); assert.ok(s.level >= -3 && s.level <= 3); assert.equal({}.x, undefined); assert.equal({}.y, undefined)
  }
  assert.equal(V.sanitizeOmniVon({ level: 99 }).level, 3); assert.equal(V.sanitizeOmniVon({ terms: [{ symbol: 'a b' }] }).terms.length, 0)
})
test('a nested clock maps liveTime into a child timeline', () => {
  const c = { offset: 10, rate: 2, length: 8, loop: false }
  assert.equal(V.clockAt(c, 5), null); assert.equal(V.clockAt(c, 11), 2); assert.equal(V.clockAt(c, 100), 8, 'holds the last moment')
  assert.equal(V.clockAt({ ...c, loop: true }, 15), 2, 'wraps: (15-10)*2 = 10, 10 % 8 = 2')
  assert.equal(V.nestedTime([{ offset: 0, rate: 1 }, { offset: 2, rate: 0.5 }], 6), 2); assert.equal(V.nestedTime([{ offset: 5 }], 1), null); assert.equal(V.clockAt(null, 3), 3)
})
test('nesting: no loops, no self, depth is capped', () => {
  assert.equal(V.canNest({}, 'a', 'a').ok, false)
  const g = { a: ['b'], b: ['c'] }
  assert.equal(V.canNest(g, 'c', 'a').ok, false, 'a loop'); assert.match(V.canNest(g, 'c', 'a').reason, /loop/)
  assert.equal(V.canNest(g, 'c', 'd').ok, true, 'a-b-c-d is three levels in: allowed'); assert.equal(V.canNest({ a: ['b'], b: ['c'], c: ['d'] }, 'd', 'e').ok, false, 'a fourth level in is refused'); assert.match(V.canNest({ a: ['b'], b: ['c'], c: ['d'] }, 'd', 'e').reason, /limit is 3/); assert.equal(V.canNest({}, 'a', 'b').ok, true)
  assert.equal(V.canNest(g, 'x', 'a').ok, true); assert.equal(V.canNest(g, 'x', 'a', 1).ok, false); assert.equal(V.canNest(null, 'a', 'b').ok, true)
})
