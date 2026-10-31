import test from 'node:test'
import assert from 'node:assert/strict'
import { imp, shimBrowser, hostile } from './helpers.mjs'
shimBrowser()
const SK = await imp('utils/OmniSemanticsSkin.js')
const P = await imp('utils/OmniPolyModel.js')
const VF = await imp('utils/OmniVideoFace.js')
const DA = await imp('utils/OmniDocAssets.js')
const FD = await imp('utils/OmniPolyFaceDraw.js')

const bytes = (...a) => Uint8Array.from(a)
const ascii = (s) => [...s].map(c => c.charCodeAt(0))
const mp4 = () => Uint8Array.from([0, 0, 0, 24, ...ascii('ftypisom'), 0, 0, 2, 0, ...ascii('isomiso2'), 0, 0, 0, 0])
const heic = () => Uint8Array.from([0, 0, 0, 24, ...ascii('ftypheic'), 0, 0, 0, 0, ...ascii('mif1heic'), 0, 0, 0, 0])

test('video files are recognised by their bytes', () => {
  assert.equal(DA.sniffDoc(mp4()).type, 'video'); assert.equal(DA.sniffDoc(mp4()).mime, 'video/mp4')
  assert.equal(DA.sniffDoc(Uint8Array.from([0, 0, 0, 20, ...ascii('ftypqt  '), 0, 0, 0, 0, 0, 0, 0, 0])).mime, 'video/quicktime')
  assert.equal(DA.sniffDoc(bytes(0x1a, 0x45, 0xdf, 0xa3, 1, 2, 3, 4)).mime, 'video/webm')
  assert.equal(DA.sniffDoc(Uint8Array.from([...ascii('OggS'), 0, 2, ...ascii('\x01theora padding')])).type, 'video')
  assert.notEqual(DA.sniffDoc(Uint8Array.from([...ascii('OggS'), 0, 2, ...ascii('\x01vorbis padding')])).type, 'video')   // an ogg SOUND is not a video
  assert.notEqual(DA.sniffDoc(heic()).type, 'video')                                                                       // a phone photo is not a video
  assert.equal(DA.sniffDoc(Uint8Array.from(ascii('%PDF-1.4 x'))).type, 'pdf')
  assert.equal(DA.sniffVideo(null), null); for (const h of hostile()) assert.doesNotThrow(() => DA.sniffVideo(h && h.length !== undefined ? h : null))
  assert.equal(DA.MAX_VIDEO_BYTES, 40 * 1024 * 1024)
})

test('the library takes a small video and refuses one over 40 MB', async () => {
  const ok = await DA.DocAssets._add(mp4().buffer, 'clip.mp4'); assert.ok(ok.ok, JSON.stringify(ok)); assert.equal(ok.meta.type, 'video')
  const big = new Uint8Array(DA.MAX_VIDEO_BYTES + 1024); big.set(mp4(), 0)
  const r = await DA.DocAssets._add(big.buffer, 'big.mp4'); assert.equal(r.ok, false); assert.equal(r.code, 'too-large'); assert.match(r.message, /video/)
})

test('poly faces can hold a video: sanitize keeps it, menu offers Play, key changes with the source', () => {
  const c = P.sanitizeContent({ type: 'video', source: { type: 'video', id: 'v1' } })
  assert.equal(c.type, 'video'); assert.equal(c.source.id, 'v1'); assert.ok(P.hasContent(c))
  assert.equal(P.sanitizeContent({ type: 'video', source: { type: 'image', id: 'v1' } }).source.type, 'none')   // wrong source type is refused
  assert.equal(P.hasContent(P.sanitizeContent({ type: 'video' })), false)
  const poly = P.sanitizePoly({ shape: 'cube', faces: [{ content: c }] })
  assert.equal(P.menuOptions(poly, 0).find(o => o.id === 'play').label, 'Play the video'); assert.equal(P.menuOptions(poly, 0, { playing: true }).find(o => o.id === 'play').label, 'Pause the video')
  assert.notEqual(P.contentKey(c), P.contentKey(P.sanitizeContent({ type: 'video', source: { type: 'video', id: 'v2' } })))
  assert.ok(P.CONTENT_TYPES.indexOf('video') > P.CONTENT_TYPES.indexOf('sound'))   // older saved orders are unchanged
})

test('a video face is drawn as its poster plus a play badge, and a red dot while playing', () => {
  const calls = []; const ctx = new Proxy({}, { get: (_, k) => (k === 'measureText' ? () => ({ width: 10 }) : (...a) => { calls.push(k); return undefined }), set: () => true })
  const src = { width: 160, height: 90 }; const face = { color: '#fff', label: 'v', content: P.sanitizeContent({ type: 'video', source: { type: 'video', id: 'v1' } }) }
  FD.drawFace(ctx, 0, 0, 100, face, { source: src }); const n1 = calls.filter(k => k === 'arc').length
  calls.length = 0; FD.drawFace(ctx, 0, 0, 100, face, { source: src, playing: true }); assert.ok(calls.includes('drawImage'))
  assert.doesNotThrow(() => FD.drawFace(ctx, 0, 0, 100, face, { state: 'loading' })); assert.ok(n1 >= 1)
})

test('at most two videos play; a third stops the oldest; pressing play on a playing face pauses it', () => {
  assert.deepEqual(VF.playPlan([], 'a#0'), { action: 'start', stop: [] })
  assert.deepEqual(VF.playPlan(['a#0'], 'b#1'), { action: 'start', stop: [] })
  assert.deepEqual(VF.playPlan(['a#0', 'b#1'], 'c#2'), { action: 'start', stop: ['a#0'] })
  assert.deepEqual(VF.playPlan(['a#0', 'b#1'], 'a#0'), { action: 'stop', stop: ['a#0'] })
  for (const h of hostile()) assert.doesNotThrow(() => VF.playPlan(h, 'x', h))
  assert.equal(VF.posterTime(0.4), 0.2); assert.equal(VF.posterTime(60), 1); assert.equal(VF.posterTime(NaN), 0)
  assert.equal(VF.frameDue(0, 40), false); assert.equal(VF.frameDue(0, 90), true); assert.equal(VF.frameDue(undefined, 1), true); assert.equal(VF.videoKey('n', 2.7), 'n#2')
})

test('skins can carry an image or a video per face; video wins; bad ids are dropped', () => {
  let s = SK.setSkinFace(SK.presetSkin('default'), 'time', { image: 'img1' })
  assert.equal(SK.skinToPoly(s).faces[3].content.type, 'image')
  s = SK.setSkinFace(s, 'time', { video: 'vid1' }); const f = SK.skinToPoly(s).faces[3]
  assert.equal(f.content.type, 'video'); assert.equal(f.content.source.id, 'vid1'); assert.equal(SK.skinToPoly(s).faces[0].content.type, 'text')
  s = SK.setSkinFace(s, 'time', { video: '', image: '' }); assert.equal(SK.skinToPoly(s).faces[3].content.type, 'text')
  assert.equal(SK.sanitizeSkin({ faces: { time: { video: '../etc/passwd', image: '<x>' } } }).faces.time.video, '')
  assert.equal(SK.sanitizeSkin({ faces: { time: { video: 'v'.repeat(65) } } }).faces.time.video, '')
  for (const h of hostile()) assert.doesNotThrow(() => SK.skinToPoly(h))
  const blank = SK.skinToPoly(SK.setSkinFace(SK.presetSkin('blank'), 'power', { image: 'i' })); assert.equal(blank.faces[4].color === '#777777', false)   // a face with a picture counts as defined
})

test('reskin plan: one skin cube per voxel; existing ones are swapped; junk is skipped', () => {
  assert.equal(SK.skinNodeId('vox_1,2,3'), 'skin_vox_1_2_3'); assert.equal(SK.skinNodeId(''), ''); assert.ok(SK.skinNodeId('x'.repeat(200)).length <= 64)
  assert.deepEqual(SK.reskinPlan(['a', 'b', 'a', null, ''], ['skin_b']), [{ voxelId: 'a', skinId: 'skin_a', action: 'create' }, { voxelId: 'b', skinId: 'skin_b', action: 'swap' }])
  assert.deepEqual(SK.reskinPlan(null), []); for (const h of hostile()) assert.doesNotThrow(() => SK.reskinPlan(h, h))
})
