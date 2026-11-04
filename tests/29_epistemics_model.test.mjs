import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import * as E from '../utils/OmniEpistemicsModel.js'
import { ONTOLOGY } from '../data/OmniEpistemicsOntology.js'
import * as C from '../utils/OmniClaimModel.js'
import * as L from '../utils/OmniLineModel.js'

test('the JSON copy of the ontology matches the JS', () => {
  const j = JSON.parse(fs.readFileSync(new URL('../data/OmniEpistemicsOntology.json', import.meta.url), 'utf8'))
  assert.deepEqual(j, JSON.parse(JSON.stringify(ONTOLOGY)))
})
test('every layer has a shape, a colour and attributes with defaults', () => {
  for (const l of E.LAYERS) { const i = E.LAYER_INFO[l]; assert.ok(['sphere', 'cube', 'hollow'].includes(i.shape)); assert.match(i.color, /^#[0-9a-f]{6}$/i); assert.ok(i.attrs.length > 0); assert.equal(Object.keys(E.defaultAttrs(l)).length, i.attrs.length) }
  assert.equal(E.layerShape('narrative'), 'cube'); assert.equal(E.layerShape('rumor'), 'sphere'); assert.equal(E.layerShape('absence'), 'hollow')
})
test('sanitize is idempotent, clamps, drops unknown keys and ignores prototype pollution', () => {
  const dirty = JSON.parse('{"layer":"rumor","text":"<b>hi</b>","attrs":{"propagation":9,"evidence":-4,"zzz":1,"__proto__":{"x":1}},"derivedFrom":["a","a","bad id!"],"__proto__":{"polluted":1},"extra":1}')
  const s = E.sanitizeEpistemics(dirty)
  assert.equal(s.attrs.propagation, 1); assert.equal(s.attrs.evidence, 0); assert.ok(!('zzz' in s.attrs)); assert.deepEqual(s.derivedFrom, ['a']); assert.ok(!('extra' in s)); assert.equal(({}).polluted, undefined)
  assert.deepEqual(E.sanitizeEpistemics(s), s); assert.ok(!s.text.includes('<'))
  assert.equal(E.sanitizeEpistemics(null).layer, 'event'); assert.equal(E.sanitizeEpistemics({ layer: 'nope' }).layer, 'event')
})
test('equations stay in 0..1 and move the right way', () => {
  for (const f of [E.rumorStrength, E.belief, E.realityResistance, E.narrativeStability]) for (const bad of [{}, null, { propagation: NaN, emotionalCharge: Infinity, evidence: -1, coherence: 'x' }, { propagation: 5, emotionalCharge: 5, repetition: 9, coherence: 9, identity: 9 }]) { const v = f(bad); assert.ok(v >= 0 && v <= 1 && Number.isFinite(v)) }
  assert.ok(E.rumorStrength({ propagation: 1, emotionalCharge: 1, evidence: 0 }) > E.rumorStrength({ propagation: 1, emotionalCharge: 1, evidence: 1 }))
  assert.ok(E.belief({ coherence: 0.8, repetition: 0.8, identity: 0.8 }) > E.belief({ coherence: 0.8, repetition: 0.1, identity: 0.8 }))
  assert.equal(E.narrativeStability({ evidenceStrength: 0, reproducibility: 0, predictiveAccuracy: 0, coherence: 1 }), 0)
  assert.equal(E.squash(-5), 0)
})
test('forces are bounded and herd grows with the crowd', () => {
  const r = E.forceReport({ attrs: { emotionalCharge: 0.9, authority: 2 } }, { shareBelieving: 0.9, benefit: 3, cost: 0 })
  for (const k of E.FORCE_IDS) assert.ok(r[k] >= 0 && r[k] <= 1, k)
  assert.ok(E.FORCES.herd(0.9) > E.FORCES.herd(0.1)); assert.ok(E.FORCES.incentive(2, 0) > E.FORCES.incentive(2, 5))
})
test('derive: same seed same copy, lineage kept, source untouched', () => {
  const ev = E.bridgeExample().nodes[0]; const before = JSON.stringify(ev)
  const a = E.derive(ev, 'observe', { seed: 7 }); const b = E.derive(ev, 'observe', { seed: 7 }); const c = E.derive(ev, 'observe', { seed: 8 })
  assert.ok(a.ok); assert.deepEqual(a.spec, b.spec); assert.notDeepEqual(a.spec.attrs, c.spec.attrs); assert.equal(a.spec.layer, 'observation'); assert.deepEqual(a.spec.derivedFrom, ['ex_bridge_event']); assert.equal(JSON.stringify(ev), before)
})
test('derive refuses a wrong step and walks the whole chain', () => {
  assert.equal(E.derive({ layer: 'rumor', text: 'x' }, 'observe').ok, false); assert.equal(E.derive({ layer: 'event' }, 'bogus').ok, false)
  let n = { id: 'e0', layer: 'event', text: 'The bridge was closed for repairs on Monday morning by the council.', attrs: { magnitude: 0.5, physicalTrace: 0.7 } }
  for (const step of ['observe', 'remember', 'propagate', 'gossip', 'narrate', 'represent']) { const r = E.derive({ ...n, id: 'x_' + step }, step, { seed: 3 }); assert.ok(r.ok, step); n = r.spec; assert.ok(n.text.length > 0) }
  assert.equal(n.layer, 'documentary')
})
test('losing words never empties the text; degradeText is bounded', () => {
  assert.ok(E.degradeText('one two three four five six', 1, E.rng(1)).length > 0); assert.equal(E.degradeText('', 1), ''); assert.ok(E.degradeText('x '.repeat(500), 0.5, E.rng(2)).length <= 300)
  assert.equal(E.degradeText('keep all these words', 0, E.rng(1)), 'keep all these words')
})
test('nextSteps / transformFor agree with the ontology', () => {
  assert.deepEqual(E.nextSteps('event').map(s => s.to), ['observation', 'documentary']); assert.equal(E.transformFor('rumor', 'gossip'), 'gossip'); assert.equal(E.transformFor('event', 'gossip'), null)
  for (const t of ONTOLOGY.transforms) assert.ok(Object.prototype.hasOwnProperty.call(L.MEANINGS, t.meaning), 'meaning ' + t.meaning)
})
test('visualOf: certain = solid, absence = hollow, what-if = ghost, charge = glow', () => {
  const solid = E.visualOf({ layer: 'event', text: 'x' }); const faint = E.visualOf({ layer: 'rumor', text: 'x', attrs: { evidence: 0, emotionalCharge: 1 } }); const hol = E.visualOf({ layer: 'absence' }); const gh = E.visualOf({ layer: 'counterfactual' })
  assert.ok(solid.opacity > faint.opacity); assert.equal(faint.glow, 1); assert.equal(hol.wire, true); assert.equal(gh.ghost, true); assert.equal(E.visualOf({ layer: 'cube?' }).shape, 'sphere')
  assert.ok(E.visualOf({ layer: 'rumor' }, { confidence: 1 }).opacity > E.visualOf({ layer: 'rumor' }, { confidence: 0 }).opacity)
})
test('confidenceFromClaim and traceClaim read a claim', () => {
  assert.equal(E.confidenceFromClaim(C.newClaim({ claim: 'x' })), null)
  let c = C.newClaim({ claim: 'The bridge is closed', id: 'cl1' })
  c = C.addTestimony(c, { entity: { kind: 'person', id: 'dana' }, observation: 'saw barriers', verdict: 'true', sourceKey: 'dana' })
  c = C.addTestimony(c, { entity: { kind: 'person', id: 'sam' }, observation: 'heard a bang', verdict: 'false', sourceKey: 'sam' })
  c = C.addUnknown(c, 'known_unknown', 'Was there an inspection?', 'me')
  const conf = E.confidenceFromClaim(c); assert.ok(conf >= 0 && conf <= 1)
  const t = E.traceClaim(c); assert.equal(t.event.layer, 'event'); assert.equal(t.observations.length, 2); assert.ok(t.absences.length >= 1); assert.ok(t.links.some(l => l.meaning === 'conflict'))
  const keys = new Set(['event', ...t.observations.map(o => o.key), ...t.absences.map(o => o.key), ...t.counterfactuals.map(o => o.key)]); for (const l of t.links) { assert.ok(keys.has(l.from) && keys.has(l.to)) }
  assert.equal(E.traceClaim(null).observations.length, 0)
})
test('the Bridge Rumor example is whole: every link ends on a node, shapes follow the rule', () => {
  const ex = E.bridgeExample(); const ids = new Set(ex.nodes.map(n => n.id)); assert.equal(ids.size, ex.nodes.length)
  for (const l of ex.links) { assert.ok(ids.has(l.from) && ids.has(l.to)); assert.ok(L.MEANINGS[l.meaning]) }
  for (const n of ex.nodes) assert.deepEqual(E.sanitizeEpistemics(n).layer, n.layer)
  const rumour = E.visualOf(ex.nodes.find(n => n.layer === 'rumor')); const news = E.visualOf(ex.nodes.find(n => n.layer === 'documentary')); assert.ok(news.opacity > rumour.opacity)
})
