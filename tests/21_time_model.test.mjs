import test from 'node:test'
import assert from 'node:assert/strict'
import * as T from '../utils/OmniTimeModel.js'
import { hostile } from './helpers.mjs'

const Z = 'America/New_York'
const mk = (o = {}) => T.sanitizeEntry({ id: 'a', startDate: '2026-06-01', startTime: '09:00', endDate: '2026-06-01', endTime: '11:00', zone: 'UTC', ...o })

test('zones: wall clock round trips, including across DST', () => {
  for (const [y, mo, d, h] of [[2026, 3, 8, 12], [2026, 11, 1, 12], [2026, 7, 4, 0], [2027, 1, 1, 23]]) {
    const ms = T.zonedToUtc({ y, mo, d, h, mi: 30, s: 0 }, Z); const p = T.partsOf(ms, Z)
    assert.deepEqual([p.y, p.mo, p.d, p.h, p.mi], [y, mo, d, h, 30])
  }
  assert.equal(T.zonedToUtc({ y: 2026, mo: 7, d: 1, h: 12, mi: 0, s: 0 }, Z), Date.UTC(2026, 6, 1, 16))
  assert.equal(T.cleanZone('Not/AZone'), 'UTC')
})
test('calendar units: a day/month is a calendar day/month', () => {
  const jan31 = Date.UTC(2026, 0, 31, 12); assert.equal(T.dateString(T.addUnits(jan31, 'month', 1), 'UTC'), '2026-02-28')
  const mar7 = T.zonedToUtc({ y: 2026, mo: 3, d: 7, h: 12, mi: 0, s: 0 }, Z)
  assert.equal(T.timeString(T.addUnits(mar7, 'day', 1, Z), Z), '12:00')   // across spring-forward, still noon
  assert.equal(T.dateString(T.startOfUnit(Date.UTC(2026, 9, 31), 'week', 'UTC'), 'UTC'), '2026-10-26')   // Monday
  assert.equal(T.bucketKey(Date.UTC(2026, 9, 31, 21, 5), 'hour'), '2026-10-31T21')
})
test('progress: waiting, running, fulfilled', () => {
  const e = mk(); assert.equal(T.stateOf(e, e.startUtc - 1).status, 'waiting')
  assert.equal(T.stateOf(e, e.startUtc + 3600e3).progress, 0.5)
  const done = T.stateOf(e, e.endUtc + 5); assert.equal(done.fulfilled, true); assert.equal(done.status, 'fulfilled')
  assert.equal(T.stateOf(mk({ endTime: '09:00' }), e.startUtc).fulfilled, true)   // zero length
})
test('halt freezes just that cube and resume carries on', () => {
  let e = mk(); const t0 = e.startUtc
  e = T.halt(e, t0 + 1800e3); assert.equal(T.stateOf(e, t0 + 5000e3).status, 'halted'); assert.equal(T.stateOf(e, t0 + 5000e3).progress, 0.25)
  e = T.resume(e, t0 + 3600e3)   // halted for 30 minutes
  assert.equal(T.stateOf(e, t0 + 3600e3).progress, 0.25); assert.equal(T.stateOf(e, t0 + 3600e3 + 1800e3).progress, 0.5)
  assert.equal(T.halt(T.halt(e, 1), 2).halt.since, 1)   // halting twice keeps the first moment
})
test('own clock: starts on activation, runs at its rate', () => {
  let e = mk({ bind: 'own', rate: 2 }); assert.equal(T.stateOf(e, 1e12).status, 'waiting')
  e = T.activate(e, 1000); assert.equal(T.stateOf(e, 1000 + 1800e3).progress, 0.5)   // 2h long at x2 => 1h of wall time
  assert.equal(T.stateOf(e, 1000 + 3600e3).fulfilled, true)
  const r = T.reset(e); assert.equal(T.stateOf(r, 1e12).status, 'waiting')
  const f = T.replay(mk(), 5e12); assert.equal(f.bind, 'own'); assert.equal(T.stateOf(f, 5e12).progress, 0)
  assert.equal(T.tickLoop(mk({ loop: true }), mk().endUtc + 10).bind, 'own')
  assert.equal(T.tickLoop(mk(), mk().endUtc + 10).bind, 'node')
})
test('repeats clamp month ends and respect times', () => {
  const e = mk({ startDate: '2026-01-31', endDate: '2026-01-31', repeat: { every: 'month', times: 3 } })
  const o = T.occurrences(e, Date.UTC(2025, 0, 1), Date.UTC(2030, 0, 1)); assert.equal(o.length, 3)
  assert.deepEqual(o.map(x => T.dateString(x.startUtc, 'UTC')), ['2026-01-31', '2026-02-28', '2026-03-31'])
  assert.equal(T.occurrences(mk(), 0, 1).length, 0)
})
test('filter and timeline by hour / day / week / month / year', () => {
  const list = [mk({ id: 'a' }), mk({ id: 'b', startDate: '2026-06-02', endDate: '2026-06-02' }), mk({ id: 'c', startDate: '2027-01-01', endDate: '2027-01-01' })]
  assert.deepEqual(T.filterBy(list, 'day', '2026-06-01').map(x => x.id), ['a'])
  assert.deepEqual(T.filterBy(list, 'hour', '2026-06-01T10').map(x => x.id), ['a'])
  assert.deepEqual(T.filterBy(list, 'month', '2026-06').map(x => x.id), ['a', 'b'])
  assert.deepEqual(T.filterBy(list, 'year', '2027').map(x => x.id), ['c'])
  assert.deepEqual(T.filterBy(list, 'week', 'W2026-06-01').map(x => x.id), ['a', 'b'])
  assert.deepEqual(T.filterBy(list, 'minute', '2026-06-01T09:30').map(x => x.id), ['a'])
  assert.equal(T.filterBy(list, 'century', 'x').length, 0)
  const tl = T.timeline(list, 'day', Date.UTC(2026, 5, 1), Date.UTC(2026, 5, 4)); assert.deepEqual(tl.map(b => b.count), [1, 1, 0])
})
test('every calendar view, in order, has sensible columns', () => {
  assert.deepEqual([...T.SPANS], ['1d', '3d', '5d', '7d', '14d', '1m', '3m', '6m', '1y', '2y', '3y', '5y', '10y', '20y', 'custom'])
  const anchor = Date.UTC(2026, 9, 31, 12); const list = [mk({ startDate: '2026-10-31', endDate: '2026-10-31' })]
  const expectCols = { '1d': 24, '3d': 72, '5d': 5, '7d': 7, '14d': 14, '1m': 31, '3m': 14, '6m': 27, '1y': 12, '2y': 24, '3y': 36, '5y': 60, '10y': 10, '20y': 20 }
  for (const sp of T.SPANS.filter(s => s !== 'custom')) {
    const v = T.viewData(list, sp, anchor); assert.ok(v.columns.length > 0 && v.columns.length < 800, sp)
    assert.ok(Math.abs(v.columns.length - expectCols[sp]) <= 2, sp + ' ' + v.columns.length)
    for (let i = 1; i < v.columns.length; i++) assert.equal(v.columns[i].from, v.columns[i - 1].to)
  }
  assert.equal(T.viewData(list, '7d', anchor).columns[0].items.length, 1)   // the 7-day view starts that day
  assert.equal(T.viewData(list, '1d', anchor).columns.reduce((n, c) => n + c.items.length, 0) > 0, true)
  const c = T.viewRange('custom', anchor, 'UTC', 45); assert.equal(c.days, 45); assert.equal(c.unit, 'day')
  assert.equal(T.viewRange('1y', anchor).from, Date.UTC(2026, 0, 1))
  assert.equal(T.nextSpan('7d'), '14d'); assert.equal(T.nextSpan('1d', -1), '1d'); assert.equal(T.nextSpan('custom'), 'custom')
  assert.equal(T.dateString(T.stepView('1m', anchor, 1), 'UTC'), '2026-11-01'); assert.equal(T.dateString(T.stepView('7d', anchor, -1), 'UTC'), '2026-10-24')
})
test('sequence order follows prev links and survives cycles', () => {
  const n = [{ id: 'c', time: { sequence: 's', prev: 'b' } }, { id: 'a', time: { sequence: 's', prev: '' } }, { id: 'b', time: { sequence: 's', prev: 'a' } }, { id: 'z', time: { sequence: 'other', prev: '' } }]
  assert.deepEqual(T.orderSequence(n, 's'), ['a', 'b', 'c'])
  assert.equal(T.orderSequence([{ id: 'x', time: { sequence: 's', prev: 'y' } }, { id: 'y', time: { sequence: 's', prev: 'x' } }], 's').length, 2)
})
test('face info covers the six sides', () => {
  for (const f of T.FACES) { const i = T.faceInfo(mk(), f, 0); assert.ok(i.label && typeof i.value === 'string' && Array.isArray(i.lines), f) }
})
test('sanitizers are hostile-proof and idempotent', () => {
  for (const h of hostile()) { for (const fn of [T.sanitizeEntry, T.sanitizeTime]) { const a = fn(h); assert.deepEqual(fn(a), a) } }
  const p = T.sanitizeEntry(JSON.parse('{"__proto__":{"x":1},"title":"<b>hi</b>","startDate":"2026-02-30","rate":-5,"halt":{"__proto__":1,"on":"yes"}}'))
  assert.equal(({}).x, undefined); assert.equal(p.title, 'bhi/b'); assert.equal(p.rate, 0.01); assert.equal(p.halt.on, false)
  assert.equal(T.stateOf(null, NaN).status, 'waiting'); assert.deepEqual(T.filterBy(null, 'day', 'x'), []); assert.equal(T.viewData(undefined, 'zzz', 'x').columns.length > 0, true)
})

import * as PAD from '../utils/OmniTimePadModel.js'
test('timepad: build, plan a press in order, prune, hostile', () => {
  let p = PAD.newPad('Show'); p = PAD.addButton(p, { label: 'Go', actions: [{ op: 'halt', target: 'b', at: 500 }, { op: 'activate', target: 'a', at: 0 }, { op: 'bogus', target: 'a' }, { op: 'reset' }] })
  const id = p.buttons[0].id; assert.equal(p.buttons[0].actions.length, 2)
  assert.deepEqual(PAD.planPress(p, id, 1000).map(a => [a.op, a.when]), [['activate', 1000], ['halt', 1500]])
  assert.equal(PAD.planPress(p, 'nope'), null)
  p = PAD.addAction(p, id, { op: 'replay', target: 'c', at: 10 }); assert.equal(p.buttons[0].actions.length, 3)
  assert.throws(() => PAD.addAction(p, id, { op: 'x' })); assert.throws(() => PAD.addAction(p, 'zz', { op: 'halt', target: 'a' }))
  assert.equal(PAD.pruneTargets(p, (t) => t === 'a').buttons[0].actions.length, 1)
  assert.equal(PAD.removeAction(p, id, 0).buttons[0].actions.length, 2)
  for (const h of hostile()) { const a = PAD.sanitizePad(h); assert.deepEqual(PAD.sanitizePad(a), a); assert.ok(Array.isArray(PAD.sanitizePads(h))) }
})
