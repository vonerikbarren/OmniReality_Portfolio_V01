import test from 'node:test'
import assert from 'node:assert/strict'
import * as E from '../utils/OmniEdgeNodeModel.js'

const A = [0, 0, 0], B = [20, 0, 0]
const near = (a, b, e = 1e-6) => a.every((x, i) => Math.abs(x - b[i]) < e)

test('sanitize clamps, sorts points, drops junk, is idempotent', () => {
  const s = E.sanitizeEdgeNode({ from: 'a', to: '../b', mode: 'wormhole', radius: 999, turns: 0, speed: -4, points: [{ t: 0.9, side: 5 }, { t: 0.2, up: 'x' }, null, { t: 7 }], color: 'red' })
  assert.equal(s.to, ''); assert.equal(s.mode, 'line'); assert.equal(s.radius, 60); assert.equal(s.turns, 0.25); assert.equal(s.speed, 0.5)
  assert.deepEqual(s.points.map(p => p.t), [0.2, 0.9, 0.99]); assert.equal(s.points[0].up, 0); assert.equal(s.color, '#7fd8ff')
  assert.deepEqual(E.sanitizeEdgeNode(s), s)
  assert.equal(E.sanitizeEdgeNode({ points: Array.from({ length: 50 }, () => ({ t: 0.5 })) }).points.length, E.LIMITS.points)
})
test('no points: the route is the straight edge, and it follows the nodes', () => {
  const p = E.makePath({ mode: 'line' }, A, B); assert.ok(near(p.points[0], A) && near(p.points.at(-1), B)); assert.ok(Math.abs(p.length - 20) < 1e-6)
  assert.ok(near(E.pointOn(p, 0.5).pos, [10, 0, 0])); assert.ok(near(E.pointOn(p, 0.5).dir, [1, 0, 0]))
  const q = E.makePath({ mode: 'line' }, [0, 5, 0], [0, 5, 30]); assert.ok(Math.abs(q.length - 30) < 1e-6)
})
test('control points bend the route through them, in the edge frame', () => {
  const f = E.frameOf(A, B); const spec = { points: [{ t: 0.5, side: 0, up: 6 }] }
  const c = E.controlPoints(spec, A, B); assert.ok(near(c[1], [10, 0, 0].map((x, i) => x + f.up[i] * 6)))
  const p = E.makePath(spec, A, B); assert.ok(p.length > 20); assert.ok(near(p.points[0], A) && near(p.points.at(-1), B))
  const moved = E.makePath(spec, [0, 0, 10], [20, 0, 10]); assert.ok(near(moved.points[0], [0, 0, 10]))        // the bend moves with the nodes
})
test('a vertical edge still has a frame', () => {
  const f = E.frameOf([0, 0, 0], [0, 10, 0]); assert.ok(Math.abs(f.length - 10) < 1e-9); assert.ok(f.side.every(Number.isFinite) && Math.hypot(...f.side) > 0.99)
})
test('torus loops the ring first, orbit ends circling the destination', () => {
  const t = E.makePath({ mode: 'torus', radius: 4, turns: 2 }, A, B); assert.ok(near(t.points.at(-1), B)); assert.ok(near(t.points[0], A, 1e-6)); const R0 = E.ringOf({ mode: 'torus', radius: 4 }, A, B); assert.ok(t.points.some((p, i) => i > 0 && i < t.points.length - 1 && near(p, A, 0.35))); assert.ok(t.points.every(p => Math.hypot(p[0] - R0.centre[0], p[1] - R0.centre[1], p[2] - R0.centre[2]) <= 4 + 1e-6 || p[0] > 0.1)); assert.ok(t.length > 20 + 2 * 2 * Math.PI * 4 * 0.9)
  const o = E.makePath({ mode: 'orbit', radius: 5, turns: 2 }, A, B); const R = E.ringOf({ mode: 'orbit', radius: 5 }, A, B)
  assert.ok(o.points.slice(-10).every(p => Math.abs(Math.hypot(p[0] - B[0], p[1] - B[1], p[2] - B[2]) - 5) < 1e-6)); assert.ok(near(o.points.at(-1), [R.centre[0] + R.u[0] * 5, R.centre[1] + R.u[1] * 5, R.centre[2] + R.u[2] * 5], 1e-6))
})
test('timing, reverse and rings', () => {
  const p = E.makePath({}, A, B); assert.equal(E.rideSeconds({ speed: 10 }, p), 2); assert.equal(E.rideSeconds({ speed: 200 }, p), 0.4)
  const r = E.reversePath(p); assert.ok(near(r.points[0], B) && near(E.pointOn(r, 1).pos, A)); assert.ok(Math.abs(r.length - p.length) < 1e-9)
  assert.ok(E.ringsAlong(p, 2).length >= 10); assert.deepEqual(E.ringsAlong({ points: [], length: 0 }), [])
})
test('hostile input never throws', () => {
  for (const bad of [null, undefined, 3, 'x', [], { points: 'no' }, { radius: NaN }]) { E.sanitizeEdgeNode(bad); E.makePath(bad, A, B); E.makePath({}, bad, B) }
  assert.deepEqual(E.makePath({}, null, null).points, []); assert.equal(E.pointOn({ points: [], cum: [], length: 0 }, 0.5), null)
})
