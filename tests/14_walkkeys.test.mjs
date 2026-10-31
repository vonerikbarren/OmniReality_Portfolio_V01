import test from 'node:test'
import assert from 'node:assert/strict'
import { imp } from './helpers.mjs'

const K = await imp('utils/OmniWalkKeys.js')
const T = await imp('utils/OmniShortcutTable.js')
const ev = (code, o = {}) => ({ code, altKey: true, ...o })

test('Alt chords map to lineup and page actions', () => {
  assert.equal(K.walkKeyAction(ev('KeyW')).detail.action, 'walkFirst')
  assert.equal(K.walkKeyAction(ev('Comma')).detail.action, 'prev')
  assert.equal(K.walkKeyAction(ev('Period')).detail.action, 'next')
  assert.equal(K.walkKeyAction(ev('BracketLeft')).detail.dir, -1)
  assert.equal(K.walkKeyAction(ev('BracketRight')).detail.dir, 1)
})
test('plain keys, other modifiers, repeats and typing never trigger', () => {
  assert.equal(K.walkKeyAction({ code: 'KeyW' }), null)
  assert.equal(K.walkKeyAction(ev('KeyW', { ctrlKey: true })), null)
  assert.equal(K.walkKeyAction(ev('KeyW', { metaKey: true })), null)
  assert.equal(K.walkKeyAction(ev('KeyW', { shiftKey: true })), null)
  assert.equal(K.walkKeyAction(ev('KeyW', { repeat: true })), null)
  assert.equal(K.walkKeyAction(ev('KeyW'), true), null)
  assert.equal(K.walkKeyAction(ev('KeyQ')), null)
  assert.equal(K.walkKeyAction(null), null)
})
test('typing targets are recognised', () => {
  assert.ok(K.isTypingTarget({ tagName: 'INPUT' })); assert.ok(K.isTypingTarget({ tagName: 'DIV', isContentEditable: true }))
  assert.ok(!K.isTypingTarget({ tagName: 'DIV' })); assert.ok(!K.isTypingTarget(null))
})
test('shortcut table entries fire the same codes the module listens for', () => {
  for (const code of ['KeyW', 'Comma', 'Period', 'BracketLeft', 'BracketRight']) {
    const hit = T.SHORTCUTS.some(s => s.fire.some(f => f.altKey && f.code === code))
    assert.ok(hit, 'no Alt shortcut entry fires ' + code)
  }
})
