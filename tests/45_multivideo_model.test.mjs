import test from 'node:test'
import assert from 'node:assert/strict'
import * as M from '../utils/OmniMultiVideoModel.js'
const near = (a, b, e = 1e-6) => assert.ok(Math.abs(a - b) <= e, `${a} vs ${b}`)
const clip = (o = {}) => M.sanitizeClip({ source: { type: 'video', id: 'v1' }, dur: 10, ...o })

test('easing: the GSAP names, 0 to 1, with the right shape', () => {
  for (const n of M.EASES) { near(M.easeAt(n, 0), 0, 1e-9); near(M.easeAt(n, 1), 1, 1e-9) }
  near(M.easeAt('none', 0.3), 0.3); near(M.easeAt('power2.in', 0.5), 0.125); near(M.easeAt('power2.out', 0.5), 0.875); near(M.easeAt('power2.inOut', 0.5), 0.5); near(M.easeAt('sine.inOut', 0.5), 0.5)
  assert.ok(M.easeAt('back.out', 0.7) > 1, 'back overshoots'); assert.equal(M.easeAt('nonsense', 0.4), 0.4); assert.equal(M.easeAt('power2.in', NaN), 0)
})
test('clip length and the timeline layout, with overlaps for transitions', () => {
  const a = clip({ id: 'a', in: 1, out: 5 }), b = clip({ id: 'b', speed: 2, transition: { kind: 'fade', dur: 1 } }), c = clip({ id: 'c', transition: { kind: 'cut' } })
  near(M.clipLength(a), 4); near(M.clipLength(b), 5)
  const l = M.layout([a, b, c]); near(l[0].start, 0); near(l[0].end, 4); near(l[1].start, 3, 1e-9); near(l[1].end, 8); near(l[2].start, 8); near(l[2].end, 18); near(M.totalDuration([a, b, c]), 18); assert.equal(M.totalDuration([]), 0)
  const big = M.layout([clip({ id: 'x', dur: 1 }), clip({ id: 'y', dur: 1, transition: { kind: 'fade', dur: 5 } })]); assert.ok(big[1].start >= 0.1 - 1e-9, 'an overlap never swallows the clip before it')
})
test('activeAt: source time follows trim and speed; the cross-over has a progress', () => {
  const a = clip({ id: 'a', in: 2, out: 6, speed: 2 }), b = clip({ id: 'b', transition: { kind: 'wipe', dur: 1 } })
  let r = M.activeAt([a, b], 0.5); assert.equal(r.a.id, 'a'); near(r.a.src, 3); assert.equal(r.b, null)
  r = M.activeAt([a, b], 1.5); assert.equal(r.a.id, 'a'); assert.equal(r.b.id, 'b'); assert.equal(r.kind, 'wipe'); near(r.p, 0.5); near(r.b.src, 0.5)
  assert.equal(M.activeAt([a, b], 999).a, null); assert.equal(M.activeAt([], 1).a, null)
})
test('fades and opacity multiply into the alpha', () => {
  const c = clip({ fadeIn: 2, fadeOut: 2, opacity: 0.5 }); near(M.activeAt([c], 1).a.alpha, 0.25); near(M.activeAt([c], 5).a.alpha, 0.5); near(M.activeAt([c], 9).a.alpha, 0.25)
})
test('splitClip cuts one clip into two that add up', () => {
  const r = M.splitClip({ clips: [clip({ id: 'a', in: 0, out: 10 })] }, 4); assert.equal(r.ok, true); assert.equal(r.mv.clips.length, 2); near(r.mv.clips[0].out, 4); near(r.mv.clips[1].in, 4); near(M.totalDuration(r.mv.clips), 10)
  assert.equal(M.splitClip({ clips: [clip()] }, 0).ok, false); assert.equal(M.splitClip({ clips: [clip()] }, 99).ok, false)
})
test('keyCoordinates: nothing before the first key, eased moves between, hold after; node and camera are separate tracks', () => {
  const keys = [{ t: 2, target: 'both', pos: [0, 0, 0], ease: 'none' }, { t: 4, target: 'both', pos: [10, 0, 0], ease: 'none' }, { t: 6, target: 'camera', pos: [10, 10, 0], look: [0, 0, 0], ease: 'power2.in' }]
  const at = (t) => M.poseAt(keys, t)
  assert.equal(at(1).node, null); assert.equal(at(1).camera, null); near(at(3).node[0], 5); near(at(3).camera.pos[0], 5); assert.deepEqual(at(9).node, [10, 0, 0]); assert.deepEqual(at(9).camera.pos, [10, 10, 0])
  near(at(5).camera.pos[1], 1.25);   // power2.in is a cubic: 0.5 of the way in is 0.125 of the move
  assert.deepEqual(at(9).camera.look, [0, 0, 0]); assert.equal(at(3).camera.look, null, 'no look = look at the node')
})
test('the text layer: caption timing and cardinal / spherical motion', () => {
  const text = { items: [{ text: 'Hello', t0: 1, t1: 3, fadeIn: 1, fadeOut: 1 }, { text: 'End', t0: 5, t1: 0 }], base: [0, 0, 0.1], motion: [{ t: 0, mode: 'cardinal', cardinal: [0, 0, 0], ease: 'none' }, { t: 2, mode: 'cardinal', cardinal: M.cardinalVec('up', 2), ease: 'none' }] }
  assert.equal(M.textAt(text, 0.5), null); near(M.textAt(text, 1.5).alpha, 0.5); assert.equal(M.textAt(text, 4), null); assert.equal(M.textAt(text, 7, 10).item.text, 'End'); assert.equal(M.textAt({ ...text, on: false }, 2), null)
  const mid = M.textOffsetAt(text, 1); near(mid[1], 1); near(mid[2], 0.1); assert.deepEqual(M.textOffsetAt(text, 9).map(x => Math.round(x * 100) / 100), [0, 2, 0.1])
  const sph = { base: [0, 0, 0], motion: [{ t: 0, mode: 'spherical', spherical: [2, 0, 0], ease: 'none' }, { t: 1, mode: 'spherical', spherical: [2, 90, 0], ease: 'none' }] }
  const p = M.textOffsetAt(sph, 0.5); near(Math.hypot(...p), 2, 1e-9); near(p[0], 2 * Math.sin(Math.PI / 4)); near(p[2], 2 * Math.cos(Math.PI / 4))
  const [r, az, el] = M.cartesianToSpherical(M.sphericalToCartesian(3, 40, 20)); near(r, 3); near(az, 40, 1e-9); near(el, 20, 1e-9)
  assert.deepEqual(M.cardinalVec('left', 3), [-3, 0, 0]); assert.deepEqual(M.cardinalVec('nope'), [0, 0, 0])
})
test('sanitize: caps, unique ids, never throws, idempotent, no prototype pollution', () => {
  const junk = [null, 5, 'x', [], { clips: 'no' }, { clips: [null, 1, { transition: { kind: 'zoom' } }], keys: [{ t: 'x', pos: 'no', ease: 'wobble' }], text: { items: [{ text: 5 }], motion: [{ spherical: 'no' }] } }, JSON.parse('{"__proto__":{"z":1},"clips":[{"__proto__":{"q":1}}]}')]
  for (const j of junk) { const s = M.sanitizeMultiVideo(j); assert.deepEqual(M.sanitizeMultiVideo(s), s); assert.equal({}.z, undefined); assert.equal({}.q, undefined) }
  const many = M.sanitizeMultiVideo({ clips: Array.from({ length: 99 }, () => ({ id: 'same' })), keys: Array.from({ length: 99 }, () => ({})) }); assert.equal(many.clips.length, M.LIMITS.clips); assert.equal(new Set(many.clips.map(c => c.id)).size, many.clips.length); assert.equal(many.keys.length, M.LIMITS.keys)
  assert.equal(M.sanitizeClip({ transition: { kind: 'zoom' } }).transition.kind, 'cut'); assert.equal(M.sanitizeKeyCoord({ ease: 'wobble' }).ease, M.DEFAULT_EASE); assert.equal(M.sanitizeClip({ speed: 99 }).speed, 4)
})
test('editing helpers return new, valid data', () => {
  let m = M.addClip({}, { id: 'a', source: { id: 'v1' } }); m = M.addClip(m, { id: 'b', source: { id: 'v2' } }); m = M.moveClip(m, 'b', -1); assert.deepEqual(m.clips.map(c => c.id), ['b', 'a'])
  m = M.updateClip(m, 'a', { speed: 2, transition: { kind: 'fade' }, key: { enabled: true } }); const a = m.clips.find(c => c.id === 'a'); assert.equal(a.speed, 2); assert.equal(a.transition.kind, 'fade'); assert.equal(a.key.enabled, true)
  m = M.addKeyCoord(m, { t: 5, pos: [1, 2, 3] }); m = M.addKeyCoord(m, { t: 1, pos: [0, 0, 0] }); assert.deepEqual(m.keys.map(k => k.t), [1, 5]); m = M.removeKeyCoord(m, m.keys[0].id); assert.equal(m.keys.length, 1)
  m = M.addTextItem(m, { text: 'Hi' }); m = M.addMotionKey(m, { t: 1, mode: 'spherical', spherical: [2, 30, 10] }); assert.equal(m.text.items.length, 1); assert.equal(m.text.motion.length, 1); m = M.removeClip(m, 'a'); assert.equal(m.clips.length, 1)
})
