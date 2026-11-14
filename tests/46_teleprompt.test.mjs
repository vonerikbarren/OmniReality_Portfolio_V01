import test from 'node:test'
import assert from 'node:assert/strict'
import * as M from '../utils/OmniTelepromptModel.js'

test('settings: defaults, clamps, junk', () => {
  assert.deepEqual(M.sanitizeTeleprompt(null), M.DEFAULTS)
  const s = M.sanitizeTeleprompt({ edge: 'right', size: 99999, fontSize: 1, opacity: 5, scroll: -3, seconds: '12', dark: 'yes' })
  assert.equal(s.edge, 'bottom'); assert.equal(s.size, 600); assert.equal(s.fontSize, 10); assert.equal(s.opacity, 1); assert.equal(s.scroll, 0); assert.equal(s.seconds, 12); assert.equal(s.dark, false)
  assert.deepEqual(M.sanitizeTeleprompt(s), s)
  assert.equal(M.sanitizeTeleprompt(JSON.parse('{"__proto__":{"edge":"left"}}')).edge, 'bottom')
})
test('message: cut to size, edge and seconds kept only when valid', () => {
  const m = M.sanitizeMessage({ title: 'T', text: 'x'.repeat(9000), edge: 'left', seconds: '5' })
  assert.equal(m.text.length, M.LIMITS.text); assert.equal(m.edge, 'left'); assert.equal(m.seconds, 5)
  assert.equal('edge' in M.sanitizeMessage({ text: 'a', edge: 'up' }), false)
  assert.equal(M.sanitizeMessage(5).text, '')
})
test('box: each edge sits against its own side', () => {
  assert.deepEqual(M.boxFor('bottom', 150, { bottom: 52 }), { left: 0, right: 0, bottom: 52, height: 150 })
  assert.equal(M.boxFor('top', 150, { top: 48 }).top, 48)
  assert.equal(M.boxFor('left', 200, { top: 48, bottom: 52 }).width, 200)
})
