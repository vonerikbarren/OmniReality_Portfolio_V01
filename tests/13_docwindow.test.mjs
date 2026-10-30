// V250 windowed paging model + V249 page-layout facing (the rotation really turns a page's front to its normal, in three.js's XYZ Euler order).
import test from 'node:test'
import assert from 'node:assert/strict'
import { imp } from './helpers.mjs'
const WM = await imp('utils/OmniDocWindowModel.js'); const PL = await imp('utils/OmniDocPageLayouts.js')

test('layout rotations: R(rotation) * (0,0,1) = normal and the page stays upright (three.js XYZ order)', () => {
  const rot = ([x, y, z]) => { // R = Rx * Ry * Rz applied to a column vector (three.js Euler 'XYZ' = Rx Ry Rz)
    const [cx, sx, cy, sy, cz, sz] = [Math.cos(x), Math.sin(x), Math.cos(y), Math.sin(y), Math.cos(z), Math.sin(z)]
    return (v) => { let [a, b, c] = v; [a, b] = [a * cz - b * sz, a * sz + b * cz]; [a, c] = [a * cy + c * sy, -a * sy + c * cy]; [b, c] = [b * cx - c * sx, b * sx + c * cx]; return [a, b, c] }
  }
  for (const layout of PL.LAYOUTS) for (const count of [4, 10, 25]) for (const p of PL.layoutPages({ layout, count, width: 4 }).pages) {
    const f = rot(p.rotation); const n = f([0, 0, 1]); n.forEach((v, i) => assert.ok(Math.abs(v - p.normal[i]) < 1e-9, `${layout} ${count} page ${p.page}: front ${n.map(x => x.toFixed(3))} vs normal ${p.normal.map(x => x.toFixed(3))}`))
    const up = f([0, 1, 0]); const horiz = Math.hypot(p.normal[0], p.normal[2]); if (horiz > 1e-6) assert.ok(Math.abs(up[0] * p.normal[0] + up[1] * p.normal[1] + up[2] * p.normal[2]) < 1e-9 && up[1] > 0, `${layout}: page tilted / upside down`)
  }
})

test('window: sanitize, clamp, hostile input', () => {
  assert.equal(WM.sanitizeWindow(null), null); assert.equal(WM.sanitizeWindow({ id: '__proto__', slots: ['a'] }), null); assert.equal(WM.sanitizeWindow({ id: 'x', slots: [] }), null)
  const w = WM.sanitizeWindow({ id: 'w', layout: 'spiral', pages: 20, start: 99, slots: ['a', 'b', 'a', 'c', 'd'] }); assert.equal(w.layout, 'helix'); assert.deepEqual(w.slots, ['a', 'b', 'c', 'd']); assert.equal(w.start, 17)
  assert.deepEqual([WM.clampStart(5, 4, 0), WM.clampStart(0, 4, 10), WM.clampStart(99, 4, 20), WM.clampStart('x', 4, 20)], [5, 1, 17, 1])
})
test('window: carousel invariants over a whole document, both directions', () => {
  let w = WM.sanitizeWindow({ id: 'w', pages: 300, start: 1, slots: ['a', 'b', 'c', 'd', 'e'] }); let steps = 0
  for (;;) {
    const p = WM.stepPlan(w, 1); if (!p) break; steps++
    assert.equal(p.start, w.start + 1); assert.equal(p.arrive.page, p.start + w.count - 1); assert.equal(p.arrive.slot, w.count - 1); assert.equal(p.leaver, w.slots[0])
    assert.deepEqual([...p.slots].sort(), [...w.slots].sort(), 'same sheets, none lost or duplicated'); assert.equal(p.moves.length, w.count - 1)
    w = { ...w, start: p.start, slots: p.slots }
  }
  assert.equal(steps, 295); assert.equal(w.start, 296)
  for (let i = 0; i < 295; i++) { const p = WM.stepPlan(w, -1); assert.ok(p); assert.equal(p.arrive.slot, 0); assert.equal(p.arrive.page, p.start); w = { ...w, start: p.start, slots: p.slots } }
  assert.equal(w.start, 1); assert.equal(WM.stepPlan(w, -1), null); assert.deepEqual(w.slots, ['a', 'b', 'c', 'd', 'e'], 'a full there-and-back restores the order')
})
test('window: jump plan and one-sheet window', () => {
  const w = WM.sanitizeWindow({ id: 'w', pages: 50, start: 1, slots: ['a', 'b', 'c'] }); const j = WM.jumpPlan(w, 99); assert.equal(j.start, 48); assert.deepEqual(j.pages.map(p => p.page), [48, 49, 50])
  const one = WM.sanitizeWindow({ id: 'o', pages: 3, start: 1, slots: ['a'] }); assert.equal(WM.stepPlan(one, 1).start, 2); assert.equal(WM.stepPlan({ ...one, start: 3 }, 1), null)
})
