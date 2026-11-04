import test from 'node:test'
import assert from 'node:assert/strict'
import * as L from '../utils/OmniLineModel.js'
test('defaults and repair', () => {
  const d = L.sanitizeLineStyle(null); assert.equal(d.kind, 'cylinder'); assert.equal(d.thickness, 1); assert.equal(d.startEnd, 'none'); assert.equal(d.meaning, undefined)
  const s = L.sanitizeLineStyle({ kind: 'x', color: 'red', thickness: 99, dashed: true, dotted: true, startEnd: 'boom', meaning: '__proto__', label: '<b>hi</b>' + 'x'.repeat(200) })
  assert.equal(s.kind, 'cylinder'); assert.equal(s.color, null); assert.equal(s.thickness, 4); assert.equal(s.dashed, false); assert.equal(s.startEnd, 'none'); assert.equal(s.meaning, undefined); assert.ok(s.label.length <= 80 && !s.label.includes('<'))
  assert.deepEqual(L.sanitizeLineStyle(s), s)
})
test('every meaning applies and reads back', () => {
  for (const id of L.MEANING_IDS) { const s = L.applyMeaning(null, id); assert.equal(L.meaningOf(s), id); assert.deepEqual(L.sanitizeLineStyle(s), s) }
  const st = L.applyMeaning(null, 'step'); assert.equal(L.strokeOf(st), 'dotted'); assert.equal(st.endEnd, 'arrow')
  assert.equal(L.strokeOf(L.applyMeaning(null, 'optional')), 'dashed'); assert.equal(L.weightOf(L.applyMeaning(null, 'strong')), 'bold'); assert.equal(L.strokeOf(L.applyMeaning(null, 'conflict')), 'double')
  assert.equal(L.meaningOf(L.applyMeaning(null, 'nope')), 'link')
})
test('plain words', () => {
  const s = L.withWords(null, { stroke: 'dotted', weight: 'bold', ends: 'both', color: '#FF0000', label: 'hello' })
  assert.equal(L.strokeOf(s), 'dotted'); assert.equal(s.thickness, 2.2); assert.equal(s.startEnd, 'arrow'); assert.equal(s.endEnd, 'arrow'); assert.equal(s.color, '#ff0000'); assert.equal(s.label, 'hello')
  assert.throws(() => L.withWords(null, { stroke: 'wavy' })); assert.throws(() => L.withWords(null, { color: 'red' })); assert.throws(() => L.withWords(null, { ends: 'x' }))
  const sw = L.swapEnds(L.withWords(null, { ends: 'forward' })); assert.equal(sw.startEnd, 'arrow'); assert.equal(sw.endEnd, 'none')
})
test('describe', () => { assert.match(L.describeStyle(L.applyMeaning(null, 'step')), /Step.*dotted/) })
