import test from 'node:test'
import assert from 'node:assert/strict'
import * as S from '../utils/OmniStickyModel.js'

test('stickyNote: plain text becomes escaped paragraphs; colours; caps', () => {
  const n = S.stickyNote({ text: 'buy <b>milk</b>\n\nand "eggs"', color: 'pink', title: '<x>Todo' })
  assert.ok(n.html.includes('&lt;b&gt;milk&lt;/b&gt;') && !n.html.includes('<b>')); assert.equal(n.paper, S.STICKY_COLORS.pink); assert.equal(n.fit, 'grow'); assert.ok(!n.title.includes('<'))
  assert.equal(S.stickyNote({ color: 'nonsense' }).paper, S.STICKY_COLORS.yellow); assert.equal(S.stickyNote({ color: '#00ff00' }).paper, '#00ff00')
  assert.ok(S.stickyNote({ text: 'x'.repeat(5000) }).html.length < 1000); assert.equal(S.stickyNote(null).html, '<p></p>')
  assert.equal(S.plainText(n.html), 'buy <b>milk</b>\nand "eggs"')
})
test('sanitizeAttach: ids, offsets, hostile input, idempotent', () => {
  assert.equal(S.sanitizeAttach(null), null); assert.equal(S.sanitizeAttach({ to: '<x>' }), null); assert.equal(S.sanitizeAttach({ to: '__proto__' }), null)
  const a = S.sanitizeAttach({ to: 'n1', off: [1, 'x', 99999] }); assert.deepEqual(a.off, [1, 1.2, 1000]); assert.deepEqual(S.sanitizeAttach(a), a)
  assert.deepEqual(S.sanitizeAttach({ to: 'n1' }).off, [1.6, 1.2, 0.1])
})
test('follow and offset round-trip; offsets stack up', () => {
  const t = [3, 4, 5]; const off = S.offsetFrom(t, [4, 6, 5]); assert.deepEqual(S.followPosition(t, off), [4, 6, 5])
  assert.ok(S.defaultOffset(2)[1] > S.defaultOffset(0)[1]); assert.ok(Number.isFinite(S.defaultOffset(NaN)[0]))
})
