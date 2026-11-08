import test from 'node:test'
import assert from 'node:assert/strict'
import * as V from '../utils/OmniStoredVideoModel.js'
import * as R from '../utils/OmniStoredRealityModel.js'

test('stored video: sanitize clamps, keeps a hex or a preset name, drops junk, is idempotent', () => {
  const s = V.sanitizeStoredVideo({ source: { id: 'a b/../c' }, key: { color: 'blue', similarity: 9, smoothness: -2, spill: 'x' }, width: 9999, volume: 5, loop: 'yes' })
  assert.equal(s.key.color, '#0000ff'); assert.equal(s.key.similarity, 1); assert.equal(s.key.smoothness, 0); assert.equal(s.key.spill, V.defaultStoredVideo().key.spill)
  assert.equal(s.width, 40); assert.equal(s.volume, 1); assert.equal(s.loop, true); assert.match(s.source.id, /^[\w.:-]+$/)
  assert.deepEqual(V.sanitizeStoredVideo(s), s)
  assert.equal(V.sanitizeStoredVideo({ source: { id: '' } }).source, null)
  assert.equal(V.sanitizeStoredVideo({ key: { color: 'javascript:1' } }).key.color, '#00ff00')
})
test('stored video: the key removes the backdrop, keeps the person, and a shadowed backdrop still goes', () => {
  const key = { color: '#00ff00', similarity: 0.4, smoothness: 0.08, spill: 0 }
  assert.equal(V.keyAlpha([0, 1, 0], key).alpha, 0)
  assert.equal(V.keyAlpha([0, 0.55, 0], key).alpha, 0)            // darker green (shadow on the screen)
  assert.equal(V.keyAlpha([0.85, 0.6, 0.5], key).alpha, 1)        // skin
  assert.equal(V.keyAlpha([0.1, 0.1, 0.1], key).alpha, 1)         // dark clothes
  assert.equal(V.keyAlpha([0, 1, 0], { ...key, enabled: false }).alpha, 1)
  const a = V.keyAlpha([0.3, 0.6, 0.3], key).alpha; const b = V.keyAlpha([0.3, 0.6, 0.3], { ...key, similarity: 0.9 }).alpha
  assert.ok(b <= a, 'more similarity removes more')
})
test('stored video: spill pulls green out of a green-tinted edge and leaves neutral pixels alone', () => {
  const key = { color: '#00ff00', similarity: 0.1, smoothness: 0.1, spill: 1 }
  const edge = V.keyAlpha([0.6, 0.8, 0.6], key).rgb; assert.ok(edge[1] <= 0.6 + 1e-9)
  assert.deepEqual(V.keyAlpha([0.5, 0.5, 0.5], key).rgb, [0.5, 0.5, 0.5])
})
test('stored video: the plane takes the video\'s own shape', () => {
  assert.deepEqual(V.planeSize(10, 1920, 1080), { w: 10, h: 5.625 }); assert.equal(V.planeSize(10, 0, 0).h, 5.625)
})

const scene = () => ({
  nodes: [
    { id: 'a', label: 'Old Red Line car', position: [10, 5, 0], nodeKind: 'noteNode' },
    { id: 'b', label: 'Broadway fire', position: [14, 5, 2] },
    { id: 'c', label: 'Outside', position: [90, 0, 0] },
    { id: 'store', position: [10, 5, 0], nodeKind: 'storedRealityNode' }
  ],
  edges: [{ from: 'a', to: 'b', style: { color: '#fff' } }, { from: 'b', to: 'c' }]
})
test('stored reality: pack keeps members, relative positions and inner lines only; unpack is its exact inverse', () => {
  const p = R.pack(scene(), ['a', 'b', 'store'], [10, 5, 0], 'store')
  assert.deepEqual(p.nodes.map(n => n.id), ['a', 'b']); assert.deepEqual(p.nodes[0].position, [0, 0, 0]); assert.deepEqual(p.nodes[1].position, [4, 0, 2])
  assert.equal(p.edges.length, 1); assert.deepEqual(p.edges[0].style, { color: '#fff' })
  const u = R.unpack(p, [100, 0, 0]); assert.deepEqual(u.nodes[1].position, [104, 0, 2])
  const back = R.pack(u, ['a', 'b'], [100, 0, 0]); assert.deepEqual(back, p)
})
test('stored reality: sanitize caps, rejects bad ids/edges/rooms, never keeps a payload while expanded, is idempotent', () => {
  const many = Array.from({ length: 500 }, (_, i) => ({ id: 'n' + i, position: [i, 0, 0] }))
  const s = R.sanitizeStoredReality({ payload: { nodes: [...many, { id: '../x' }, { id: 'n1' }], edges: [{ from: 'n1', to: 'n1' }, { from: 'n1', to: 'zz' }, { from: 'n1', to: 'n2' }] }, room: '1,2', scale: 99 })
  assert.equal(s.payload.nodes.length, R.LIMITS.nodes); assert.equal(s.payload.edges.length, 1); assert.equal(s.room, null); assert.equal(s.scale, 18)
  assert.equal(s.preview.count, R.LIMITS.nodes); assert.ok(s.preview.points.length <= R.LIMITS.points)
  assert.deepEqual(R.sanitizeStoredReality(s), s)
  const e = R.sanitizeStoredReality({ state: 'expanded', payload: { nodes: [{ id: 'q' }] }, members: ['q', '../bad'], room: '0,0,0' })
  assert.deepEqual(e.payload, { nodes: [], edges: [] }); assert.deepEqual(e.members, ['q']); assert.equal(e.room, '0,0,0')
  const evil = R.sanitizeStoredReality(JSON.parse('{"payload":{"nodes":[{"id":"a","__proto__":{"x":1},"position":["x",null,1]}]},"preview":{"kinds":{"__proto__":5}}}'))
  assert.deepEqual(evil.payload.nodes[0].position, [0, 0, 1]); assert.equal({}.x, undefined)
})
test('stored reality: the preview fits 0..1 on one scale, and says what is inside', () => {
  const p = R.previewOf(scene().nodes.slice(0, 2), [{}]); assert.equal(p.count, 2); assert.equal(p.edges, 1); assert.deepEqual(p.kinds, { noteNode: 1, node: 1 })
  for (const pt of p.points) for (const v of pt) assert.ok(v >= 0 && v <= 1)
  assert.deepEqual(R.previewOf([], []).points, [])
})
