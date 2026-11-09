import test from 'node:test'
import assert from 'node:assert/strict'
import { COURSE, NODES, EDGES, LANES, positionOf } from '../data/OmniMbtaCourse.js'
import { LAYERS, LIMITS, sanitizeEpistemics } from '../utils/OmniEpistemicsModel.js'
import { MEANING_IDS } from '../utils/OmniLineModel.js'

test('every course node fits the Epistemics limits and names its source', () => {
  const ids = new Set()
  for (const x of NODES) {
    assert.ok(!ids.has(x.id), 'duplicate ' + x.id); ids.add(x.id)
    assert.ok(LAYERS.includes(x.layer), x.id + ' layer'); assert.ok(x.lane in LANES, x.id + ' lane')
    assert.ok(x.text.length > 20 && x.text.length <= LIMITS.text, `${x.id} text ${x.text.length}`)
    assert.ok(x.source.length > 0 && x.source.length <= LIMITS.source, `${x.id} source ${x.source.length}`)
    assert.ok(x.note.length > 0 && x.note.length <= LIMITS.note, `${x.id} note ${x.note.length}`)
    const s = sanitizeEpistemics({ layer: x.layer, text: x.text, source: x.source, note: x.note }); assert.equal(s.text, x.text); assert.equal(s.source, x.source); assert.equal(s.note, x.note)
  }
})
test('every node except the overview has an address and no emoji', () => {
  for (const x of NODES) { if (x.id !== 'mbta_ov') assert.match(x.note, /^https:\/\//, x.id); assert.ok(!/[\u{1F300}-\u{1FAFF}☀-➿]/u.test(x.text + x.source + x.note), x.id + ' emoji') }
})
test('lines join real nodes, use real meanings, and every node is connected', () => {
  const ids = new Set(NODES.map(x => x.id)); const linked = new Set(); const seen = new Set()
  for (const l of EDGES) { assert.ok(ids.has(l.from) && ids.has(l.to) && l.from !== l.to, l.from + '->' + l.to); assert.ok(MEANING_IDS.includes(l.meaning), l.meaning); const k = l.from + '|' + l.to; assert.ok(!seen.has(k)); seen.add(k); linked.add(l.from); linked.add(l.to) }
  for (const id of ids) assert.ok(linked.has(id), id + ' is alone')
})
test('no two nodes share a place, and the four lanes are all there', () => {
  const at = new Set(); for (const x of NODES) { const k = positionOf(x).join(','); assert.ok(!at.has(k), 'overlap ' + x.id); at.add(k) }
  for (const lane of ['red', 'orange', 'green', 'mattapan']) assert.ok(NODES.some(x => x.lane === lane), lane)
  assert.ok(COURSE.scale <= 18 && COURSE.name.length <= 60 && COURSE.summary.length <= 400)
})
test('the cautions from the research are in the course', () => {
  const all = NODES.map(x => x.text).join(' ')
  assert.match(all, /did not cause the purchase/); assert.match(all, /track and signal/); assert.match(all, /NOT happened/)
})
