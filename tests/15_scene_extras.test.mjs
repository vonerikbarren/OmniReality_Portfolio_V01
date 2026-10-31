import test from 'node:test'
import assert from 'node:assert/strict'
import { imp, shimBrowser, hostile } from './helpers.mjs'
shimBrowser()
const X = await imp('utils/OmniSceneExtras.js')
const J = await imp('utils/OmniSceneJson.js')
const V = await imp('utils/OmniVibrationModel.js')

const node = (id) => ({ id, label: id, geometry: 'SphereGeometry', position: [0, 0, 0], primitive: 'objective' })
const lineups = { version: 1, lineups: { L: { layout: 'row', center: [0, 5, 0], spacing: 4, order: ['a', 'b', 'c'] } }, attach: { t: { to: 'a', off: [0, 3, 0] } } }
const win = { id: 'w', src: 'doc1', layout: 'helix', count: 2, center: [0, 0, 0], pages: 9, start: 3, slots: ['s1', 's2'] }
const prog = V.sanitizeProgram({ id: 'mine', name: 'Mine', channels: [{ prop: 'pos.y', wave: 'bounce', amp: 1 }] })
const file = (extras, nodes) => ({ schema: 'omni-scene/1', nodes: nodes ?? ['a', 'b', 'c', 't', 's1', 's2'].map(node), edges: [], extras })

test('buildExtras keeps only what is there and drops built-in programs', () => {
  assert.deepEqual(X.buildExtras({}), {})
  assert.deepEqual(X.buildExtras({ lineups: { lineups: {}, attach: {} }, docwindows: [], vibration: [] }), {})
  const e = X.buildExtras({ lineups, docwindows: [win], vibration: [prog, { ...V.PRESETS[0], builtin: true }] })
  assert.equal(Object.keys(e.lineups.lineups).length, 1); assert.equal(e.docwindows.length, 1); assert.equal(e.vibration.length, 1)
})

test('a file round-trips: build -> text -> parse -> check gives the same extras', () => {
  const f = J.buildFile({ nodes: ['a', 'b', 'c', 't', 's1', 's2'].map(node), edges: [] }, { extras: { lineups, docwindows: [win], vibration: [prog] } })
  const r = J.checkFile(J.parse(J.stringify(f)).file)
  assert.ok(r.ok, r.errors.join()); assert.deepEqual(r.extras.lineups.lineups.L.order, ['a', 'b', 'c']); assert.equal(r.extras.lineups.attach.t.to, 'a')
  assert.equal(r.extras.docwindows[0].start, 3); assert.equal(r.extras.vibration[0].id, 'mine')
  assert.match(J.describe(r.counts, r.extras), /1 lineup, 1 doc window, 1 vibration program/)
})

test('a file with no extras still loads, and old files are unchanged', () => {
  const r = J.checkFile(file(undefined)); assert.ok(r.ok); assert.deepEqual(r.extras, {})
})

test('references to missing nodes are dropped with a warning, never kept', () => {
  const r = J.checkFile(file({ lineups, docwindows: [win] }, ['a', 'b'].map(node)))
  assert.deepEqual(r.extras.lineups.lineups.L.order, ['a', 'b']); assert.equal(r.extras.lineups.attach.t, undefined)
  assert.equal(r.extras.docwindows, undefined); assert.ok(r.warnings.some(w => /missing sheets/.test(w)))
})

test('merge: renamed node ids are followed, clashing lineup / window / program ids are renamed', () => {
  const existing = ['a', 'zzz']
  const r = J.checkFile(file({ lineups, docwindows: [win], vibration: [prog] }), { mode: 'merge', existingIds: existing, genId: (() => { let i = 0; return () => 'n' + (++i) })(), taken: { lineups: ['L'], windows: ['w'], programs: ['mine'] } })
  assert.ok(r.ok); assert.equal(r.remap.a, 'n1')
  assert.ok(r.extras.lineups.lineups.L_2, 'lineup renamed'); assert.deepEqual(r.extras.lineups.lineups.L_2.order, ['n1', 'b', 'c']); assert.equal(r.extras.lineups.attach.t.to, 'n1')
  assert.equal(r.extras.docwindows[0].id, 'w_2'); assert.equal(r.extras.vibration[0].id, 'mine_2')
})

test('hostile extras never throw and never leak prototype keys', () => {
  for (const h of hostile()) { assert.doesNotThrow(() => X.readExtras(h)); assert.doesNotThrow(() => X.readExtras({ lineups: h, docwindows: h, vibration: h }, { ids: ['a'] })) }
  const r = X.readExtras(JSON.parse('{"lineups":{"lineups":{"__proto__":{"order":["a"]},"ok":{"order":["a"]}}},"docwindows":[{"id":"__proto__","slots":["a"]}]}'), { ids: ['a'] })
  assert.equal(Object.keys(r.extras.lineups.lineups).join(), 'ok'); assert.equal(r.extras.docwindows, undefined)
  assert.equal(({}).order, undefined)
})

test('caps: too many programs are cut', () => {
  const many = Array.from({ length: 100 }, (_, i) => ({ id: 'p' + i, name: 'p' + i }))
  const r = X.readExtras({ vibration: many }); assert.equal(r.extras.vibration.length, X.MAX_PROGRAMS); assert.ok(r.warnings.length)
})
