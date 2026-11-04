import test from 'node:test'
import assert from 'node:assert/strict'
import * as F from '../utils/OmniFlashcardModel.js'
const deck3 = () => { let d = F.defaultDeck(); for (const [a, b] of [['one', '1'], ['two', '2'], ['three', '3']]) d = F.addCard(d, F.newCard(a, b)); return d }
test('sanitize: junk repaired, idempotent, hostile data dropped', () => {
  const s = F.sanitizeDeck({ title: 5, cards: [{ id: 'a', front: { text: 'x'.repeat(999), img: 'javascript:alert(1)', snd: 'data:text/html;base64,AAA' }, back: null }, null, { id: 'a' }], queue: ['zzz', 'a', 'a'], side: 'back', __proto__: { evil: 1 } })
  assert.equal(s.cards.length, 2); assert.equal(s.cards[0].front.text.length, 400); assert.equal(s.cards[0].front.img, undefined); assert.equal(s.cards[0].front.snd, undefined)
  assert.notEqual(s.cards[0].id, s.cards[1].id); assert.deepEqual(s.queue, ['a']); assert.equal(s.evil, undefined)
  assert.deepEqual(F.sanitizeDeck(s), s); assert.deepEqual(F.sanitizeDeck(null), F.sanitizeDeck(undefined))
})
test('a good small image is kept; a huge one is not', () => {
  const ok = 'data:image/png;base64,iVBORw0KGgo='; const big = 'data:image/png;base64,' + 'A'.repeat(200000)
  const s = F.sanitizeDeck({ cards: [{ front: { img: ok }, back: { img: big } }] }); assert.equal(s.cards[0].front.img, ok); assert.equal(s.cards[0].back.img, undefined)
})
test('study queue: flip, next, prev, got, again, round over', () => {
  let d = deck3(); assert.equal(F.current(d).front.text, 'one'); d = F.flip(d); assert.equal(d.side, 'back')
  d = F.next(d); assert.equal(F.current(d).front.text, 'two'); assert.equal(d.side, 'front'); d = F.prev(d); assert.equal(F.current(d).front.text, 'one')
  d = F.mark(d, 'again'); assert.equal(F.current(d).front.text, 'two'); assert.equal(d.again, 1); assert.equal(d.queue.length, 3)
  d = F.mark(d, 'got'); d = F.mark(d, 'got'); assert.equal(F.progress(d).left, 1); assert.equal(F.current(d).front.text, 'one'); d = F.mark(d, 'got')
  const p = F.progress(d); assert.ok(p.done); assert.equal(p.got, 3); assert.equal(F.current(d), null)
  d = F.restart(d); assert.equal(F.progress(d).left, 3); assert.equal(d.rounds, 1); assert.equal(d.got, 0)
})
test('inputs are not mutated; shuffle keeps every card', () => {
  const d = deck3(); const before = JSON.stringify(d); F.mark(d, 'got'); F.next(d); assert.equal(JSON.stringify(d), before)
  const r = F.restart(d, true, () => 0.3); assert.deepEqual([...r.queue].sort(), d.cards.map(c => c.id).sort())
})
test('edit: add, update, move, remove', () => {
  let d = deck3(); const id = d.cards[1].id
  d = F.updateCard(d, id, { front: { text: 'TWO' } }); assert.equal(d.cards[1].front.text, 'TWO')
  d = F.moveCard(d, id, 0); assert.equal(d.cards[0].id, id); d = F.removeCard(d, id); assert.equal(d.cards.length, 2); assert.ok(!d.queue.includes(id))
  let big = F.defaultDeck(); for (let i = 0; i < 520; i++) big = F.addCard(big, F.newCard('q' + i, 'a')); assert.equal(big.cards.length, 500)
})
test('json and csv round trip; bad files refused', () => {
  const d = F.updateCard(deck3(), F.sanitizeDeck(deck3()).cards[0].id, { front: { text: 'with, comma and "quotes"\nand a line' } })
  const j = F.fromJSON(F.toJSON(d)); assert.equal(j.cards.length, 3); assert.equal(j.cards[0].front.text, d.cards[0].front.text)
  const c = F.fromCSV(F.toCSV(d)); assert.equal(c.cards.length, 3); assert.equal(c.cards[0].front.text, d.cards[0].front.text); assert.equal(c.cards[2].back.text, '3')
  assert.throws(() => F.fromJSON('nope')); assert.throws(() => F.fromJSON('{"schema":"x"}')); assert.throws(() => F.fromCSV('  \n '))
  assert.equal(F.fromCSV('front,back\nhi,there\n').cards.length, 1)
})
