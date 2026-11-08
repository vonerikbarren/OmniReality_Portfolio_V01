import test from 'node:test'
import assert from 'node:assert/strict'
import * as P from '../utils/OmniProfilerModel.js'

test('add, log, edit, remove, search', () => {
  let b = { entries: [] }
  const a = P.addEntry(b, { name: 'Ada Lovelace', kind: 'person', tags: ['Math', 'math'] }, 10); b = a.book
  assert.equal(a.added, true); assert.equal(a.id, 'ada-lovelace'); assert.deepEqual(b.entries[0].tags, ['math'])
  assert.equal(P.addEntry(b, { name: 'Ada Lovelace' }, 11).added, false)
  b = P.addLog(b, 'ada-lovelace', 'Testified on the cup claim', 20, { ref: 'cup1' }); assert.equal(b.entries[0].met, 1); assert.equal(b.entries[0].log[0].ref, 'cup1'); assert.equal(b.entries[0].updated, 20)
  b = P.addLog(b, 'ada-lovelace', 'Noted', 21, { meet: false }); assert.equal(b.entries[0].met, 1)
  b = P.editEntry(b, 'ada-lovelace', { note: 'Met in the bridge course', kind: 'nonsense' }, 30); assert.equal(b.entries[0].kind, 'person'); assert.match(b.entries[0].note, /bridge/)
  assert.equal(P.search(b, 'cup claim').length, 1); assert.equal(P.search(b, 'zzz').length, 0)
  assert.equal(P.entryOfNode(P.addEntry(b, { name: 'Door', kind: 'thing', nodeId: 'door1' }, 40).book, 'door1').name, 'Door')
  assert.equal(P.removeEntry(b, 'ada-lovelace').entries.length, 0)
})
test('caps: entries, log lines, text', () => {
  let b = { entries: [] }
  for (let i = 0; i < 320; i++) b = P.addEntry(b, { name: 'p' + i }, i).book
  assert.equal(b.entries.length, P.LIMITS.entries)
  for (let i = 0; i < 150; i++) b = P.addLog(b, 'p0', 'line ' + i, i)
  assert.equal(b.entries[0].log.length, P.LIMITS.log); assert.equal(b.entries[0].log.at(-1).what, 'line 149')
  assert.equal(P.sanitizeEntry({ id: 'x', name: 'n'.repeat(500) }).name.length, P.LIMITS.name)
})
test('hostile input', () => {
  assert.equal(P.sanitizeEntry(null), null); assert.equal(P.sanitizeEntry({ id: '../x', name: 'a' }), null); assert.equal(P.sanitizeLogLine({ what: '' }), null)
  const s = P.sanitizeBook(JSON.parse('{"entries":[{"id":"a","name":"A","__proto__":{"x":1},"log":[{"what":"hi","at":"x"}]},{"id":"a","name":"dup"}]}'))
  assert.equal(s.entries.length, 1); assert.equal(s.entries[0].log[0].at, 0); assert.equal({}.x, undefined)
  assert.deepEqual(P.sanitizeBook(P.sanitizeBook({ entries: [{ id: 'a', name: 'A', tags: ['T'] }] })), P.sanitizeBook({ entries: [{ id: 'a', name: 'A', tags: ['T'] }] }))
})
