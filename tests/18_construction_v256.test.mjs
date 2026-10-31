import test from 'node:test'
import assert from 'node:assert/strict'
import { imp, shimBrowser, hostile } from './helpers.mjs'
shimBrowser()
const M = await imp('utils/OmniConstructionModel.js')
const L = await imp('utils/OmniConstructionLabs.js')
const S = await imp('utils/OmniPainterSound.js')
const P = await imp('utils/OmniObjectPaintModel.js')

test('new brush settings validate and clamp', () => {
  const s = M.normalise({ paint: 'SURFACE', dab: 500, soft: -2, sound: 'false', volume: 3, hand: 'none' })
  assert.equal(s.paint, 'surface'); assert.equal(s.dab, 96); assert.equal(s.soft, 0); assert.equal(s.sound, false); assert.equal(s.volume, 1); assert.equal(s.hand, 'none')
  assert.throws(() => M.normalise({ paint: 'oil' }), /paint is one of/); assert.throws(() => M.normalise({ hand: 'lh' }), /hand is one of/); assert.throws(() => M.normalise({ dab: 'wide' }), /needs a number/)
  assert.equal(M.DEFAULTS.hand, 'rh'); assert.equal(M.DEFAULTS.paint, 'spray')
})

test('labs: six built in, they apply, and they never touch hand / sound / volume', () => {
  assert.equal(L.BUILTIN_LABS.length, 6); assert.ok(L.BUILTIN_LABS.every(l => Object.isFrozen(l)))
  const base = M.normalise({ hand: 'none', sound: false, volume: 0.2 })
  for (const l of L.BUILTIN_LABS) { const b = L.labBrush(l, base); assert.equal(b.hand, 'none'); assert.equal(b.sound, false); assert.equal(b.volume, 0.2) }
  assert.equal(L.labBrush(L.findLab([], 'Airbrush'), M.DEFAULTS).paint, 'surface')
  assert.equal(L.findLab([], 'CONFETTI').id, 'confetti'); assert.equal(L.findLab([], 'nope'), null)
})

test('labs: user labs are cleaned, capped, and can not shadow built-ins or carry bad keys', () => {
  const raw = [{ name: 'Mine', brush: { color: '#112233', size: 99, hand: 'none', sound: false, nonsense: 1, shape: 'cube' } }, { name: 'confetti' }, { id: '__proto__', name: 'x' }, { name: '' }, null, 5]
  const out = L.sanitizeLabs(raw)
  assert.deepEqual(out.map(l => l.id), ['mine', 'x'])   // a bad id falls back to the name; confetti (a built-in name) and empty names are dropped; assert.deepEqual(out[0].brush, { color: '#112233', size: 4 })
  assert.equal(L.sanitizeLabs(Array.from({ length: 80 }, (_, i) => ({ name: 'lab' + i }))).length, L.MAX_LABS)
  for (const h of hostile()) assert.doesNotThrow(() => L.sanitizeLabs(h))
  assert.equal(L.labFromBrush('Saved', { ...M.DEFAULTS, hand: 'none', sound: false }).brush.hand, undefined)
})

test('sounds: every event has a plan; sound off or volume 0 is silent; pitch follows colour and size', () => {
  for (const e of S.EVENTS) assert.ok(S.soundPlan(e, M.DEFAULTS).notes.length > 0, e)
  assert.equal(S.soundPlan('arm', { ...M.DEFAULTS, sound: false }).notes.length, 0); assert.equal(S.soundPlan('arm', { ...M.DEFAULTS, volume: 0 }).notes.length, 0); assert.equal(S.soundPlan('bogus', M.DEFAULTS).notes.length, 0)
  assert.notEqual(S.noteFor('#ff0000'), S.noteFor('#0000ff')); assert.ok(Math.abs(S.noteFor('#ff0000', 3) - S.noteFor('#ff0000', 0.5) / 2) < 0.01)
  assert.equal(S.hueOf('#ff0000'), 0); assert.equal(S.hueOf('nope'), 0)
  for (const n of S.soundPlan('undo', M.DEFAULTS).notes) assert.ok(n.f > 0 && n.dur > 0 && n.gain > 0 && n.gain <= 0.5)
  for (const h of hostile()) assert.doesNotThrow(() => S.soundPlan('spray', h))
})

test('sounds: a fast drag is rate limited', () => {
  const st = { last: -Infinity }; let n = 0; for (let t = 0; t < 1; t += 0.01) if (S.tick(st, t, 0.07)) n++
  assert.ok(n >= 13 && n <= 15, String(n))
})

test('surface dabs: uv to pixels, seam wrap, clamps, hostile uv', () => {
  const d = P.dabPlan({ x: 0.5, y: 0.75 }, 28, 0.5); assert.deepEqual([d.x, d.y, d.r, d.inner], [128, 64, 14, 0.5])
  assert.equal(P.dabPlan({ x: 1.25, y: 0.5 }, 28, 0).x, 64); assert.equal(P.dabPlan({ x: -0.25, y: 0.5 }, 28, 0).x, 192)
  assert.equal(P.dabPlan({ x: 0.5, y: 0.5 }, 1000, 5).r, 48); assert.equal(P.dabPlan({ x: 0.5, y: 0.5 }, 0, 5).r, 2)
  assert.equal(P.dabPlan({ x: NaN, y: 0 }), null); assert.equal(P.dabPlan(null), null)
  for (const h of hostile()) assert.doesNotThrow(() => P.dabPlan(h, h, h))
})
