import test from 'node:test'
import assert from 'node:assert/strict'
import * as M from '../utils/OmniOrbitTunnelModel.js'

const pose = { pos: [100, 0, 0], look: [100, 0, 200], up: [-1, 0, 0] }
const unit = (a, b) => { const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]; const L = Math.hypot(...d); return d.map(x => x / L) }

test('look: sanitize and the default', () => {
  assert.deepEqual(M.sanitizeLook(null), { mode: 'ring', target: '' })
  assert.deepEqual(M.sanitizeLook({ mode: 'core', target: 'a b<c>' }), { mode: 'core', target: 'abc' })
  assert.equal(M.sanitizeLook({ mode: 'sideways' }).mode, 'ring')
  assert.deepEqual(M.sanitizePrefs({ look: { mode: 'object', target: 'n1' } }).look, { mode: 'object', target: 'n1' })
  assert.deepEqual(M.sanitizePrefs(M.sanitizePrefs({ look: { mode: 'tunnel', target: 'e' } })).look, { mode: 'tunnel', target: 'e' })
  assert.deepEqual(M.defaultPrefs().look, { mode: 'ring', target: '' })
})
test('ring keeps the old behaviour', () => { const a = M.aimFor(pose, { mode: 'ring' }, true, {}); assert.deepEqual(a.look, pose.look); assert.deepEqual(a.up, pose.up) })
test('TargetArea01: right in front of the user holds the heading the ride started with', () => {
  const a = M.aimFor(pose, { mode: 'front' }, true, { entryDir: [0, 0, -2] }); assert.deepEqual(unit(pose.pos, a.look).map(x => Math.round(x * 1e6) / 1e6 + 0), [0, 0, -1])
  assert.deepEqual(M.aimFor(pose, { mode: 'front' }, true, {}).look, pose.look)   // no heading known: along the ring
})
test('TargetArea02: the core is 0, 0, 0', () => { assert.deepEqual(M.aimFor(pose, { mode: 'core' }, true, {}).look, [0, 0, 0]); assert.deepEqual(M.aimFor({ ...pose, pos: [0, 0, 0] }, { mode: 'core' }, true, {}).look, pose.look) })
test('TargetArea03: an object follows it; a missing object falls back', () => {
  assert.deepEqual(M.aimFor(pose, { mode: 'object', target: 'n' }, true, { object: [5, 6, 7] }).look, [5, 6, 7]); assert.deepEqual(M.aimFor(pose, { mode: 'object', target: 'n' }, true, { object: null }).look, pose.look)
  assert.deepEqual(M.aimFor(pose, { mode: 'object' }, true, { object: [NaN, 0, 0] }).look, pose.look)
})
test('TargetArea04: a tunnel, looking forward along it', () => {
  const a = M.aimFor(pose, { mode: 'tunnel', target: 'e' }, true, { tunnelDir: [0, 10, 0] }); const d = unit(pose.pos, a.look); assert.ok(Math.abs(d[1] - 1) < 1e-9)
  assert.deepEqual(M.aimFor(pose, { mode: 'tunnel' }, true, { tunnelDir: [0, 0, 0] }).look, pose.look)
})
test('spin off keeps the horizon level, spin on follows the wall', () => {
  assert.deepEqual(M.aimFor(pose, { mode: 'core' }, false, {}).up, [0, 1, 0]); assert.deepEqual(M.aimFor(pose, { mode: 'core' }, true, {}).up, pose.up)
  const straight = M.aimFor({ pos: [0, 0, 0], look: [0, 1, 0], up: [0, 0, 1] }, { mode: 'ring' }, false, {}); assert.notDeepEqual(straight.up, [0, 1, 0])   // looking straight up: another up so the camera does not flip
})
test('spin off stops the roll round the wall (the ride still moves forward)', () => {
  const spec = M.defaultTunnel('horizontal'); const on = M.stepRide({ theta: 0, phi: 1, travelled: 0, lap: 0 }, 1, spec, M.defaultPrefs())
  const off = M.stepRide({ theta: 0, phi: 1, travelled: 0, lap: 0 }, 1, { ...spec, traversal: { ...spec.traversal, spin: false } }, M.defaultPrefs())
  assert.notEqual(on.phi, 1); assert.equal(off.phi, 1); assert.ok(off.theta > 0)
  assert.equal(M.sanitizeOrbitTunnel({ traversal: { spin: 'x' } }).traversal.spin, true); assert.equal(M.sanitizeOrbitTunnel({ traversal: { spin: false } }).traversal.spin, false)
})
