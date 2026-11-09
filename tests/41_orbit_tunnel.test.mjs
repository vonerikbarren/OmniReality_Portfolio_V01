import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import * as M from '../utils/OmniOrbitTunnelModel.js'
const read = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8')
const near = (a, b, e = 1e-6) => assert.ok(Math.abs(a - b) <= e, `${a} vs ${b}`)

test('defaults: two tunnels as far out as the longest regular tunnel', () => {
  const d = M.defaultPrefs(); assert.equal(d.tunnels.horizontal.radius, 8440); assert.equal(d.tunnels.vertical.radius, 8440)
  assert.equal(M.TUNNEL_REACH, (11 - 1) * 800 + 320 + 120)
  assert.equal(d.tunnels.horizontal.mode, 'wire'); assert.equal(d.enabled.horizontal && d.enabled.vertical, true)
})
test('sanitize clamps, drops unsafe links, is idempotent and ignores prototype pollution', () => {
  const s = M.sanitizeOrbitTunnel({ id: 'vertical', radius: 1e9, tube: 1e9, opacity: 9, yaw: 999, media: { kind: 'video', url: 'javascript:alert(1)' }, particles: { count: 1e6, speed: -3 }, traversal: { speed: NaN }, __proto__: { x: 1 }, constructor: { prototype: { y: 1 } } })
  assert.equal(s.radius, 60000); assert.ok(s.tube <= 60000 * 0.9 && s.tube <= 20000); assert.equal(s.opacity, 1); assert.equal(s.yaw, 180)
  assert.equal(s.media.url, ''); assert.equal(s.media.kind, 'none'); assert.equal(s.particles.count, 1200); assert.equal(s.particles.speed, 0)
  assert.equal(s.traversal.speed, M.defaultTunnel('vertical').traversal.speed); assert.deepEqual(M.sanitizeOrbitTunnel(s), s); assert.equal({}.y, undefined)
  assert.equal(M.sanitizeOrbitTunnel({ id: 'horizontal', yaw: 90 }).yaw, 0, 'only the vertical ring turns')
  assert.equal(M.sanitizeOrbitTunnel({ media: { kind: 'image', url: 'https://example.com/a.png' } }).media.kind, 'image')
  assert.equal(M.sanitizeOrbitTunnel({ media: { kind: 'image', url: 'http://example.com/a.png' } }).media.kind, 'none')
  assert.equal(M.sanitizeOrbitTunnel(null).id, 'horizontal')
})
test('a tube can never be wider than its ring', () => { const s = M.sanitizeOrbitTunnel({ radius: 300, tube: 5000 }); assert.ok(s.tube <= 270) })
test('the horizontal ring is flat and the vertical one stands up', () => {
  const h = M.defaultTunnel('horizontal'), v = M.defaultTunnel('vertical')
  for (const th of [0, 1, 2.5, 4]) { near(M.frame(h, th).c[1], 0); near(M.frame(v, th).c[2], 0) }
  near(M.frame(h, 0).c[0], 8440); near(M.frame(v, Math.PI / 2).c[1], 8440)
  const turned = { ...v, yaw: 90 }; const c = M.frame(turned, 0).c; near(c[0], 0, 1e-6); near(Math.abs(c[2]), 8440, 1e-6)
})
test('wall points are exactly `tube` from the middle line and the camera faces along the ring', () => {
  const s = M.defaultTunnel('vertical'); for (const [th, ph] of [[0.3, 0], [2, 1.2], [5, 4]]) {
    const w = M.wallPoint(s, th, ph), c = M.frame(s, th).c; near(Math.hypot(w[0] - c[0], w[1] - c[1], w[2] - c[2]), s.tube, 1e-6)
    const pose = M.camPose(s, th, ph); const f = M.frame(s, th); const dir = pose.look.map((x, i) => x - pose.pos[i]); near(dir[0] * f.t[0] + dir[1] * f.t[1] + dir[2] * f.t[2], 200, 1e-6)
    const toAxis = [c[0] - pose.pos[0], c[1] - pose.pos[1], c[2] - pose.pos[2]]; assert.ok(pose.up[0] * toAxis[0] + pose.up[1] * toAxis[1] + pose.up[2] * toAxis[2] > 0, 'up points toward the tube axis')
  }
})
test('nearestTheta and distToCenterline find the tube', () => {
  for (const id of ['horizontal', 'vertical']) { const s = { ...M.defaultTunnel(id), yaw: id === 'vertical' ? 30 : 0 }; const w = M.wallPoint(s, 1.7, 0.4, 0.5); near(M.nearestTheta(s, w), 1.7, 1e-3); near(M.distToCenterline(s, w), s.tube * 0.5, 1e-3) }
  assert.ok(M.distToCenterline(M.defaultTunnel('horizontal'), [0, 0, 0]) > 8000, 'the origin is far from the ring')
})
test('the ride order: first entered first, the other only when ticked', () => {
  assert.deepEqual(M.planQueue('horizontal', { horizontal: true, vertical: true }), ['horizontal', 'vertical'])
  assert.deepEqual(M.planQueue('vertical', { horizontal: true, vertical: true }), ['vertical', 'horizontal'])
  assert.deepEqual(M.planQueue('horizontal', { horizontal: true, vertical: false }), ['horizontal'])
  assert.deepEqual(M.planQueue('vertical', { horizontal: false, vertical: true }), ['vertical'])
  assert.deepEqual(M.planQueue('nonsense', null), ['horizontal', 'vertical'])
})
test('stepRide corkscrews: forward speed moves theta, roll moves phi, laps count, loops end it', () => {
  const spec = { ...M.defaultTunnel('horizontal'), traversal: { speed: 8440, roll: 90, inset: 0.78 } }; const prefs = { ...M.defaultPrefs(), loops: 2 }
  let s = { theta: 0, phi: 0, travelled: 0 }; s = M.stepRide(s, 0.1, spec, prefs); near(s.theta, 0.1, 1e-9); near(s.phi, Math.PI / 2 * 0.1, 1e-9)
  let t = 0; s = { theta: 0, phi: 0, travelled: 0 }; while (!s.done && t < 100) { s = M.stepRide(s, 0.1, spec, prefs); t += 0.1 }
  assert.ok(s.done && s.lap === 2); near(t, 2 * M.TAU, 0.2)
  const back = M.stepRide({ theta: 0.05, phi: 0, travelled: 0 }, 0.1, spec, { ...prefs, direction: -1 }); assert.ok(back.theta > Math.PI, 'wraps when riding backward')
  const still = M.stepRide({ theta: 1, phi: 0, travelled: 0 }, 1, { ...spec, traversal: { speed: 0, roll: 90, inset: 0.78 } }, prefs); near(still.theta, 1); assert.ok(still.phi > 0, 'speed 0 = pure wall circling')
})
test('wired: module, ribbon, commands, panel, no extra WebGL context', () => {
  assert.match(read('ui/OmniRemixModules.js'), /orbittunnels: base\.addModule\(new OmniOrbitTunnels/); assert.match(read('ui/OmniRemixModules.js'), /orbitpanel/)
  assert.match(read('ui/OmniRibbon.js'), /b\('orbit-tunnel'/); assert.match(read('systems/OmniLangCommands.js'), /registerOmni\('OrbitTunnel', 'enter'/)
  assert.doesNotMatch(read('utils/OmniOrbitTunnelMesh.js') + read('systems/OmniOrbitTunnels.js'), /WebGLRenderer|getContext/)
  assert.match(read('ui/OmniOrbitTunnelPanel.js'), /Enter ' \+ id/)
})
