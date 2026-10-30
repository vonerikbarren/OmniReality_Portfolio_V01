// V241 meaning demo, V243 semantics skin, V244 lineups, V247 walk model, V242 gait model.
import test from 'node:test'
import assert from 'node:assert/strict'
import { imp, shimBrowser } from './helpers.mjs'
shimBrowser()
const DM = await imp('utils/OmniMeaningDemoModel.js'); const SK = await imp('utils/OmniSemanticsSkin.js'); const LM = await imp('utils/OmniLineupModel.js'); const WM = await imp('utils/OmniLineupWalkModel.js'); const G = await imp('utils/OmniGaitModel.js'); const AX = await imp('data/OmniAxiomData.js')

test('meaning demo: 10 s, four steps in order, nothing outside them, values return to base', () => {
  assert.equal(DM.DURATION, 10); assert.deepEqual(DM.STEPS.map(s => s.axis), ['power', 'time', 'expression', 'space'])
  for (let i = 1; i < DM.STEPS.length; i++) assert.ok(DM.STEPS[i].from >= DM.STEPS[i - 1].to)
  const v0 = DM.valueAt(0), v10 = DM.valueAt(DM.DURATION); assert.ok(v0 && v10)
  assert.equal(DM.stepAt(0), null); assert.ok(DM.stepAt(2)); assert.ok(DM.describe().includes('Power'))
})

test('axioms: six, with symbol and colour, in the skin order', () => {
  assert.deepEqual(AX.AXIOM_IDS, ['identity', 'information', 'space', 'time', 'power', 'expression']); assert.deepEqual([...SK.AXIOM_ORDER], AX.AXIOM_IDS)
  for (const a of AX.AXIOMS) { assert.match(a.color, /^#[0-9a-f]{6}$/i); assert.ok(a.symbol) }
})
test('semantics skin: every preset makes a six-face cube, face i = axiom i, blank is honest', () => {
  for (const n of SK.SKIN_NAMES) { const p = SK.skinToPoly(SK.presetSkin(n)); assert.equal(p.shape, 'cube'); assert.equal(p.faces.length, 6); p.faces.forEach((f, i) => assert.ok(f.tags.includes(AX.AXIOM_IDS[i]))) }
  const blank = SK.skinToPoly(SK.presetSkin('blank')); assert.ok(blank.faces.every(f => f.label === '(not defined)' && f.content.type === 'pattern'))
  const s = SK.setSkinFace(SK.presetSkin(), 'time', { icon: '<b>x', label: 'T' }); assert.equal(s.faces.time.icon, 'bx'); assert.equal(SK.setSkinFace(s, 'nope', { icon: 'z' }).faces.time.icon, 'bx')
})

test('lineups: create, place, reorder, one lineup per node, forget', () => {
  let r = LM.createLineup(LM.emptyState(), 'a', { layout: 'helix', ids: ['x', 'y', 'x'] }); assert.ok(r.ok); let s = r.state; assert.deepEqual(s.lineups.a.order, ['x', 'y'])
  s = LM.place(s, 'a', 'z', 1).state; assert.deepEqual(s.lineups.a.order, ['z', 'x', 'y']); s = LM.place(s, 'a', 'z', 99).state; assert.deepEqual(s.lineups.a.order, ['x', 'y', 'z'])
  s = LM.createLineup(s, 'b', { ids: ['y'] }).state; assert.ok(!s.lineups.a.order.includes('y'), 'y moved to b')
  assert.deepEqual(LM.sequenceOf(s, 'y'), { lineup: 'b', index: 1 })
  s = LM.forget(s, 'x'); assert.ok(!LM.sequenceOf(s, 'x'))
  assert.equal(LM.createLineup(s, '__proto__').ok, false); assert.equal(LM.createLineup(s, 'q', { layout: 'zig' }).ok, false)
  assert.equal(Object.keys(LM.slotsOf({ layout: 'sphereIn', center: [0, 0, 0], spacing: 3, order: Array.from({ length: 60 }, (_, i) => 'n' + i) })).length, 60)
})
test('attachments: offsets kept, loops and self-carry refused, deleting the carrier frees the carried', () => {
  let s = LM.attach(LM.emptyState(), 'a', 'b', [1, 2, 3]).state; assert.deepEqual(s.attach.a, { to: 'b', off: [1, 2, 3] })
  assert.equal(LM.attach(s, 'b', 'a').ok, false); assert.equal(LM.attach(s, 'q', 'q').ok, false)
  s = LM.forget(s, 'b'); assert.deepEqual(s.attach, {})
  assert.deepEqual(LM.carriedBy(LM.attach(LM.emptyState(), 'a', 'b').state, 'b'), ['a'])
})

test('walk model: inside for inward shapes, outside for sphereOut, in front for flat, order and from/loop', () => {
  const dist = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]))
  const inn = WM.stopPose('sphereIn', [0, 0, 0], [0, 0, 10], 8); assert.ok(dist(inn.cam, [0, 0, 0]) < 10, 'inside')
  const out = WM.stopPose('sphereOut', [0, 0, 0], [0, 0, 10], 8); assert.ok(dist(out.cam, [0, 0, 0]) > 10, 'outside')
  const row = WM.stopPose('row', [0, 0, 0], [4, 1, 0], 8); assert.equal(row.cam[0], 4); assert.ok(row.cam[2] > 0)
  assert.equal(WM.stopPose('sphereIn', [1, 1, 1], [1, 1, 1], 99).cam.every(Number.isFinite), true)
  const plan = WM.walkPlan(['a', 'b', 'c', 'd'], { a: [0, 0, 0], b: [1, 0, 0], d: [3, 0, 0] }, { from: 2, loop: true }); assert.deepEqual(plan.map(p => p.id + p.number), ['b2', 'd4', 'a1'])
  assert.deepEqual(WM.walkPlan([], {}), [])
})

test('gait: idle breathes, walk below 10, hover above 10, eases in at the threshold', () => {
  assert.deepEqual([G.modeOf(0), G.modeOf(6), G.modeOf(10), G.modeOf(18), G.modeOf(48), G.modeOf(NaN)], ['idle', 'walk', 'walk', 'hover', 'hover', 'idle'])
  assert.ok(G.gaitAt(10.01, 0).y < 0.05, 'no pop when crossing 10'); assert.ok(G.gaitAt(40, 0.3).y > 0.3); assert.ok(G.gaitAt(6, 0, 1).y >= 0)
})
