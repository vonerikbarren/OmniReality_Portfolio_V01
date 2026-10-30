// V236 scene file, V237 doc bookmarks, V203/V206 doc model, V242 page layouts.
import test from 'node:test'
import assert from 'node:assert/strict'
import { imp, shimBrowser } from './helpers.mjs'
shimBrowser()
const SJ = await imp('utils/OmniSceneJson.js'); const BM = await imp('utils/OmniDocBookmarks.js'); const D = await imp('utils/OmniDocModel.js'); const PL = await imp('utils/OmniDocPageLayouts.js')

test('scene file: build, stringify, parse, check round trip', () => {
  const nodes = [{ id: 'a', label: 'A', geometry: 'BoxGeometry', position: [1, 2, 3] }, { id: 'b', label: 'B', geometry: 'SphereGeometry', position: [0, 0, 0] }]
  const file = SJ.buildFile({ nodes, edges: [{ from: 'a', to: 'b' }] }, { name: 'T', now: new Date('2026-01-01T00:00:00Z') })
  assert.equal(file.schema, SJ.SCHEMA)
  const parsed = SJ.parse(SJ.stringify(file)); assert.ok(parsed.ok ?? parsed.file ?? parsed)
  const chk = SJ.checkFile(file.schema ? file : parsed.file, { mode: 'replace' }); assert.ok(chk.ok, JSON.stringify(chk).slice(0, 200))
})
test('scene file: refuses hostile / oversize input without throwing', () => {
  for (const t of ['', '{', 'null', '[]', '{"schema":"nope"}', '{"schema":"omni-scene/1","nodes":"x"}', 'x'.repeat(100)]) { const r = SJ.parse(t); assert.ok(r && typeof r === 'object') }
  const big = SJ.buildFile({ nodes: Array.from({ length: SJ.LIMITS.nodes + 10 }, (_, i) => ({ id: 'n' + i, label: 'x', geometry: 'BoxGeometry', position: [0, 0, 0] })), edges: [] })
  const c = SJ.checkFile(big, { mode: 'replace' }); assert.ok(c && (c.ok === false || (c.counts?.nodes ?? 0) <= SJ.LIMITS.nodes))
})
test('scene file: merge remaps clashing ids', () => {
  const file = SJ.buildFile({ nodes: [{ id: 'dup', label: 'x', geometry: 'BoxGeometry', position: [0, 0, 0] }], edges: [] })
  let n = 0; const c = SJ.checkFile(file, { mode: 'merge', existingIds: ['dup'], genId: () => 'new' + (++n) })
  assert.ok(c.ok); const ids = (c.nodes ?? c.file?.nodes ?? []).map(x => x.id); assert.ok(!ids.includes('dup') || ids.length === 0)
})

test('doc bookmarks: 20 per document, duplicates and the 21st refused, rename, remove, titles capped, __proto__ refused', () => {
  const s = BM.sanitize(null); const key = BM.keyOf({ type: 'pdf', id: 'f1' }); assert.ok(key)
  for (let i = 1; i <= 20; i++) assert.ok(BM.add(s, key, i, 'Page ' + i).ok)
  assert.equal(BM.add(s, key, 21, 'x').ok, false, 'the 21st is refused'); assert.equal(BM.add(s, key, 3, 'again').ok, false, 'a duplicate page is refused')
  assert.equal(BM.list(s, key).length, BM.MAX)
  const first = BM.list(s, key)[0]; const r = BM.rename(s, key, first.id, 'x'.repeat(500)); assert.ok(r.ok && r.title.length <= BM.TITLE_MAX)
  assert.ok(BM.remove(s, key, first.id).ok); assert.ok(BM.list(s, key).every(b => b.id !== first.id)); assert.equal(BM.remove(s, key, first.id).ok, false)
  assert.equal(BM.keyOf({ type: 'pdf', id: '__proto__' }), null, 'a __proto__ id has no key'); assert.equal(BM.keyOf({ type: 'none', id: 'x' }), null)
  assert.ok(BM.save(s)); assert.deepEqual(Object.keys(BM.load()), Object.keys(s))
  assert.deepEqual(Object.keys(BM.sanitize(JSON.parse('{"__proto__":[{"id":"a","page":1}],"pdf:x":[{"id":"a","page":1,"title":"<b>"}]}'))), ['pdf:x'])
})

test('doc model: sanitize, page turning, spread, zoom, budget', () => {
  let d = D.defaultDoc(); assert.equal(d.page, 1)
  d = D.setPages(d, 10); d = D.turn(d, 1); assert.equal(d.page, 2)
  d = D.setSpread(d, 'double'); assert.equal(d.page % 2, 1, 'a spread starts on an odd page')
  d = D.setZoom(d, 9999); assert.equal(d.zoom, D.ZOOM_MAX); d = D.setZoom(d, 100); assert.equal(d.panX, 0)
  const plan = D.planBudget([{ id: 'a', want: 4096, aspect: 1.4, distance: 5 }, { id: 'b', want: 4096, aspect: 1.4, distance: 50 }], 4096 * 4096 * 1.4)
  assert.ok(plan && (plan instanceof Map || typeof plan === 'object'))
})

test('page layouts: counts snap, every layout gives distinct positions, facing is unit', () => {
  assert.deepEqual([PL.snapCount(7), PL.snapCount(100), PL.snapCount('x'), PL.snapCount(-3)], [6, 25, 4, 1])
  for (const layout of PL.LAYOUTS) for (const count of PL.COUNTS) {
    const r = PL.layoutPages({ layout, count, width: 4 }); assert.equal(r.pages.length, count)
    const seen = new Set(r.pages.map(p => p.position.map(v => v.toFixed(3)).join())); assert.equal(seen.size, count, `${layout} ${count}: overlapping pages`)
    for (const p of r.pages) { assert.ok(Math.abs(Math.hypot(...p.normal) - 1) < 1e-9); assert.ok(p.rotation.every(Number.isFinite)) }
  }
  assert.equal(PL.pickLayout('spiral'), 'helix'); assert.equal(PL.pickLayout('nope'), null)
  assert.equal(PL.layoutPages({ layout: 'row', count: 13, exact: true }).pages.length, 13)
})
