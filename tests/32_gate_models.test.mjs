// V276: the pure models behind the opening screen and the OmniPassKeyRing gate: spaces, glyph palette, gate rules, gate settings.
import test from 'node:test'
import assert from 'node:assert/strict'
import { shimBrowser, imp } from './helpers.mjs'

shimBrowser()
const S = await imp('utils/OmniSpaces.js')
const G = await imp('utils/OmniKeyGlyphs.js')
const R = await imp('utils/OmniGate.js')
const C = await imp('utils/OmniGateSettings.js')

// ── spaces ────────────────────────────────────────────────
test('twelve spaces, smallest to largest, with unique ids', () => {
  assert.equal(S.SPACES.length, 12)
  assert.equal(new Set(S.SPACE_IDS).size, 12)
  assert.deepEqual(S.SPACE_IDS.slice(0, 3), ['planck', 'subatomic', 'atomic'])
  assert.equal(S.SPACE_IDS[9], 'galactic')
  assert.equal(S.SPACE_IDS[11], 'universal')
})

test('every formation is finite, bounded and repeatable', () => {
  const o = {}, p = {}
  for (const id of S.SPACE_IDS) for (const n of [20, 90, 200]) for (const t of [0, 1.7, 40, 1234.5]) for (let i = 0; i < n; i++) {
    S.formation(id, i, n, t, o)
    for (const k of ['x', 'y', 'z', 's', 'a']) assert.ok(Number.isFinite(o[k]), `${id} i${i} n${n} t${t} ${k}`)
    assert.ok(Math.abs(o.x) <= 1.5 && Math.abs(o.y) <= 1.5 && Math.abs(o.z) <= 1.5, `${id} out of the cube: ${o.x},${o.y},${o.z}`)
    assert.ok(o.s > 0 && o.a > 0 && o.a <= 1.0001)
    S.formation(id, i, n, t, p)
    assert.deepEqual(p, o, `${id} is not repeatable`)
  }
})

test('formation survives hostile arguments', () => {
  for (const id of [undefined, null, 'nope', 5, {}, '__proto__', 'constructor']) for (const i of [NaN, -5, 1e9, undefined, 'x']) {
    const o = S.formation(id, i, NaN, Infinity)
    assert.ok(Number.isFinite(o.x + o.y + o.z))
  }
})

test('the spaces look different from each other', () => {
  const sig = (id) => {
    const o = {}; let r = 0, sy = 0, sx = 0, ss = 0
    for (let i = 0; i < 90; i++) { S.formation(id, i, 90, 3, o); r += Math.hypot(o.x, o.y, o.z); sy += Math.abs(o.y); sx += Math.abs(o.x); ss += o.s }
    return [r / 90, sy / 90, sx / 90, ss / 90].map(v => v.toFixed(3)).join('|')
  }
  const sigs = S.SPACE_IDS.map(sig)
  assert.equal(new Set(sigs).size, 12, sigs.join('\n'))
})

test('sanitizeSpaceIds keeps known ids once, in scale order', () => {
  assert.deepEqual(S.sanitizeSpaceIds(['universal', 'atomic', 'atomic', 'zzz', 5, null]), ['atomic', 'universal'])
  assert.deepEqual(S.sanitizeSpaceIds('x'), [])
  assert.deepEqual(S.sanitizeSpaceIds(['__proto__', 'constructor', 'toString']), [])
})

test('the rotation holds, moves, and loops through the enabled spaces', () => {
  const en = ['atomic', 'cellular', 'galactic']
  const o = { holdSec: 10, moveSec: 4 }
  let p = S.rotationPlan(en, 0, o); assert.equal(p.a, 'atomic'); assert.equal(p.moving, false)
  p = S.rotationPlan(en, 9.9, o); assert.equal(p.moving, false)
  p = S.rotationPlan(en, 12, o); assert.equal(p.moving, true); assert.equal(p.a, 'atomic'); assert.equal(p.b, 'cellular'); assert.equal(p.kind, 'out'); assert.ok(p.u > 0 && p.u < 1)
  p = S.rotationPlan(en, 14, o); assert.equal(p.a, 'cellular'); assert.equal(p.moving, false)
  p = S.rotationPlan(en, 14 * 2 + 12, o); assert.equal(p.a, 'galactic'); assert.equal(p.b, 'atomic'); assert.equal(p.kind, 'in')   // the wrap zooms back in
  p = S.rotationPlan(en, 14 * 3, o); assert.equal(p.a, 'atomic')   // a full loop
  const rev = S.rotationPlan(en, 12, { holdSec: 10, moveSec: 4, direction: 'in' }); assert.equal(rev.a, 'galactic'); assert.equal(rev.b, 'cellular'); assert.equal(rev.kind, 'in')
  assert.equal(S.rotationPlan([], 5).a, 'galactic'); assert.equal(S.rotationPlan(['atomic'], 99).moving, false)
  assert.equal(S.rotationPlan(en, NaN, { holdSec: NaN }).a, 'atomic')
})

test('a zoom between two spaces is finite and ends where the next space begins', () => {
  const o = {}, a = {}
  for (const kind of [['atomic', 'cellular'], ['cellular', 'atomic']]) for (const u of [0, 0.2, 0.5, 0.8, 1]) for (let i = 0; i < 90; i++) {
    const plan = { a: kind[0], b: kind[1], u, moving: true, kind: S.SPACE_IDS.indexOf(kind[1]) > S.SPACE_IDS.indexOf(kind[0]) ? 'out' : 'in' }
    S.blendPoint(plan, i, 90, 5, o)
    for (const k of ['x', 'y', 'z', 's', 'a']) assert.ok(Number.isFinite(o[k]))
  }
  for (let i = 0; i < 90; i++) {   // at u=1 the blend IS the next space
    S.blendPoint({ a: 'atomic', b: 'cellular', u: 1, moving: true, kind: 'out' }, i, 90, 5, o); S.formation('cellular', i, 90, 5, a)
    assert.ok(Math.abs(o.x - a.x) < 1e-9 && Math.abs(o.y - a.y) < 1e-9 && Math.abs(o.z - a.z) < 1e-9)
  }
})

test('project and linkPairs', () => {
  const out = {}
  assert.equal(S.project({ x: 0, y: 0, z: 0 }, 800, 600, 0, 0, out), true)
  assert.ok(Math.abs(out.sx - 400) < 1e-6 && Math.abs(out.sy - 300) < 1e-6)
  assert.equal(S.project({ x: 0, y: 0, z: 5 }, 800, 600, 0, 0, out), false)   // behind the camera
  const near = {}; S.project({ x: 0, y: 0, z: 1 }, 800, 600, 0, 0, near); assert.ok(near.k > 1)
  const xs = [0, 10, 500, 505, NaN], ys = [0, 0, 0, 0, 0], pairs = new Uint16Array(40), dists = new Float32Array(20)
  const n = S.linkPairs(xs, ys, 5, 50, 20, 4, pairs, dists)
  assert.equal(n, 2); assert.deepEqual([pairs[0], pairs[1], pairs[2], pairs[3]], [0, 1, 2, 3]); assert.equal(dists[0], 10)
  assert.equal(S.linkPairs(xs, ys, 5, 50, 1, 4, pairs, dists), 1)   // capped
})

// ── glyphs ────────────────────────────────────────────────
test('fifty glyphs, all different, all plain svg', () => {
  assert.equal(G.GLYPH_COUNT, 50)
  const all = G.allGlyphs(24)
  assert.equal(all.length, 50)
  assert.equal(new Set(all.map(g => g.svg)).size, 50)
  assert.equal(new Set(all.map(g => g.name)).size, 50)
  for (const g of all) { assert.ok(/^<svg [^<>]*>(<(path|circle)[^<>]*\/>)+<\/svg>$/.test(g.svg), g.svg); assert.ok(!/script|on\w+=|href/i.test(g.svg)) }
})

test('glyph ids are validated', () => {
  assert.equal(G.sanitizeGlyphId(0), 0); assert.equal(G.sanitizeGlyphId(49), 49); assert.equal(G.sanitizeGlyphId('7'), 7)
  for (const bad of [-1, 50, 1.5, NaN, null, undefined, '', 'x', '007x', {}, [], '1e1']) assert.equal(G.sanitizeGlyphId(bad), null)
  assert.equal(G.glyphSvg(99), ''); assert.equal(G.glyphName('x'), '')
  assert.ok(/width="128"/.test(G.glyphSvg(3, 9999))); assert.ok(/width="8"/.test(G.glyphSvg(3, -4)))
})

// ── gate rules ────────────────────────────────────────────
test('any complete entry is accepted except the demo code', () => {
  const ok = { username: 'V', glyph: 12, text: 'AllyBank', digits: '034256' }
  assert.deepEqual(R.evaluateEntry(ok, 6), { ok: true, code: 'ok' })
  assert.deepEqual(R.evaluateEntry({ ...ok, digits: '000000' }, 6), { ok: false, code: 'denied' })
  assert.deepEqual(R.evaluateEntry({ ...ok, digits: '0000000000' }, 10), { ok: false, code: 'denied' })
  assert.deepEqual(R.evaluateEntry({ ...ok, digits: '0000000000' }, 6), { ok: false, code: 'incomplete' })   // wrong length for the setting
  assert.equal(R.evaluateEntry({ ...ok, digits: '1234567890' }, 10).ok, true)
})

test('an incomplete entry says which fields are empty, a denial says nothing specific', () => {
  assert.deepEqual(R.missingFields({}, 6), ['glyph', 'string', 'digits'])
  assert.deepEqual(R.missingFields({ glyph: 0, text: 'x', digits: '12345' }, 6), ['digits'])
  assert.deepEqual(R.evaluateEntry({ glyph: null, text: '', digits: '' }), { ok: false, code: 'incomplete' })
  assert.ok(!/glyph|string|digit.*wrong/i.test(R.DENIED_TEXT.replace('Check your glyph, string and digits.', '')))
  assert.ok(R.DENIED_TEXT.length > 10)
})

test('entries are cleaned', () => {
  const e = R.sanitizeGateEntry({ username: '  Von\u0000Erik \n', glyph: '3', text: 'a\tb' + 'x'.repeat(200), digits: '12-34 56abc7' })
  assert.equal(e.username, 'VonErik'); assert.equal(e.glyph, 3); assert.ok(e.text.length <= 64); assert.ok(!/\t/.test(e.text)); assert.equal(e.digits, '1234567')
})

test('the wait grows with each failure after the free tries', () => {
  const g = R.createGateState()
  assert.equal(g.fail(1000).lockMs, 0); assert.equal(g.isLocked(1001), false)
  assert.equal(g.fail(2000).lockMs, 0)
  const third = g.fail(3000); assert.equal(third.lockMs, 5000); assert.equal(third.triesLeft, 0)
  assert.equal(g.isLocked(7999), true); assert.equal(g.isLocked(8000), false); assert.equal(g.remainingMs(4000), 4000)
  assert.equal(g.fail(10000).lockMs, 15000)
  assert.equal(g.fail(30000).lockMs, 45000)
  assert.equal(g.fail(80000).lockMs, 45000)   // the last wait repeats
  g.success(); assert.equal(g.fails, 0); assert.equal(g.isLocked(80001), false); assert.equal(g.triesLeft(), 3)
  const odd = R.createGateState({ free: -1, waits: ['x'] }); assert.equal(odd.free, 3); assert.deepEqual(odd.waits, [5, 15, 45])
})

// ── settings ──────────────────────────────────────────────
test('gate settings: defaults, clamping, round trip', () => {
  const d = C.sanitizeGateSettings(null)
  assert.equal(d.gate, true); assert.equal(d.overall, 0.68); assert.equal(d.bar, 'plain'); assert.equal(d.digits, 6)
  assert.equal(d.spaces.enabled.length, 12); assert.equal(d.spaces.direction, 'out'); assert.equal(d.reduceMotion, false)
  const x = C.sanitizeGateSettings({ overall: 5, plexus: { count: 1, link: 9999, lineAlpha: -3, speed: 'fast', size: '2' }, spaces: { enabled: ['atomic', 'x'], holdSec: 0, moveSec: 99, direction: 'sideways' }, bar: 'neon', digits: '10', username: '  hi\u0001 ' })
  assert.equal(x.overall, 1); assert.equal(x.plexus.count, 20); assert.equal(x.plexus.link, 300); assert.equal(x.plexus.lineAlpha, 0); assert.equal(x.plexus.speed, 1); assert.equal(x.plexus.size, 2)
  assert.deepEqual(x.spaces.enabled, ['atomic']); assert.equal(x.spaces.holdSec, 2); assert.equal(x.spaces.moveSec, 10); assert.equal(x.spaces.direction, 'out')
  assert.equal(x.bar, 'plain'); assert.equal(x.digits, 10); assert.equal(x.username, 'hi')
  assert.deepEqual(C.sanitizeGateSettings(x), x)
  assert.deepEqual(C.sanitizeGateSettings({ spaces: { enabled: [] } }).spaces.enabled, [])   // none ticked is allowed; the boot then shows the galactic space
})

test('gate settings save and load', () => {
  localStorage.removeItem(C.STORAGE_KEY)
  const r = C.saveGateSettings({ bar: 'rainbow', plexus: { count: 120 }, spaces: { enabled: ['planck', 'universal'] } })
  assert.equal(r.ok, true); assert.equal(r.settings.bar, 'rainbow')
  const l = C.loadGateSettings(); assert.equal(l.plexus.count, 120); assert.equal(l.plexus.link, 140); assert.deepEqual(l.spaces.enabled, ['planck', 'universal'])
  C.saveGateSettings({ digits: 10 }); assert.equal(C.loadGateSettings().plexus.count, 120)   // a patch keeps the rest
  localStorage.setItem(C.STORAGE_KEY, '{not json'); assert.equal(C.loadGateSettings().bar, 'plain')
  C.resetGateSettings(); assert.equal(C.loadGateSettings().bar, 'plain')
})
