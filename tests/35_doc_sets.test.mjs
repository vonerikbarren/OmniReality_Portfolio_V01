import test from 'node:test'
import assert from 'node:assert/strict'
import * as WM from '../utils/OmniDocWindowModel.js'

const win = (o = {}) => ({ id: 'w', src: 'd', layout: 'helix', count: 8, center: [0, 0, 0], pages: 40, start: 1, slots: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'], ...o })
test('page down moves a whole set, for every sheet count', () => {
  for (const n of [2, 4, 6, 8, 10, 25]) {
    const slots = Array.from({ length: n }, (_, i) => 's' + i)
    const p = WM.pagePlan(win({ count: n, slots, pages: 100, start: 1 }), 1)
    assert.equal(p.start, 1 + n, 'count ' + n); assert.equal(p.pages.length, n); assert.equal(p.pages[n - 1].page, 2 * n)
    const back = WM.pagePlan(win({ count: n, slots, pages: 100, start: 1 + n }), -1); assert.equal(back.start, 1)
  }
})
test('page up at the start and page down at the end do nothing; the last set stops at the end of the document', () => {
  assert.equal(WM.pagePlan(win(), -1), null)
  assert.equal(WM.pagePlan(win({ pages: 20, start: 13 }), 1), null)            // 13..20 is the last full set
  assert.equal(WM.pagePlan(win({ pages: 20, start: 9 }), 1).start, 13)         // 17 would run off the end: stops at 13
  assert.equal(WM.pagePlan(win({ pages: 20, start: 13 }), -1).start, 5)
  assert.equal(WM.pagePlan(win({ pages: 8 }), 1), null)                         // one set only
})
test('hostile input gives null, never throws', () => {
  for (const bad of [null, undefined, 5, 'x', {}, { id: '../x' }, { id: 'w', count: 'many' }]) assert.equal(WM.pagePlan(bad, 1), null)
})
