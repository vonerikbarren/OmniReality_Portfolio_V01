import test from 'node:test'
import assert from 'node:assert/strict'
import * as M from '../utils/OmniClaimModel.js'
import * as V from '../utils/OmniClaimVault.js'
import { hostile, noPollution } from './helpers.mjs'

const cup = () => {
  let c = M.newClaim({ claim: 'The cup is half full', scale: 10, laws: ['conservation of mass'], at: 1 })
  c = M.addTestimony(c, { entity: { kind: 'human', id: 'ann' }, verdict: 'true', region: [0, 0.52], observation: 'water to the line' }, { at: 2 })
  return M.addTestimony(c, { entity: { kind: 'sensor', id: 's1' }, verdict: 'false', region: [0.52, 1] }, { at: 3 })
}
test('shares always sum to 1 and resolve with scale', () => {
  const c = cup()
  for (const n of [1, 2, 3, 7, 10, 64, 100]) { const s = M.sharesAt(c, n); assert.ok(Math.abs(s.truth + s.false + s.undefined - 1) < 1e-4, 'n=' + n) }
  assert.equal(M.sharesAt(c, 2).undefined, 0.5)
  assert.equal(M.sharesAt(c, 100).undefined, 0)
  assert.equal(M.isObjective(c, 2), false)
  assert.equal(M.isObjective(c, 100), true)
})
test('no testimony = absence; conflict; too-coarse entity = known unknown', () => {
  let c = M.newClaim({ claim: 'x', scale: 4 })
  assert.equal(M.sharesAt(c).layers.absence, 1)
  c = M.addTestimony(c, { entity: { kind: 'ai' }, verdict: 'true' }); c = M.addTestimony(c, { entity: { kind: 'bot' }, verdict: 'false' })
  assert.equal(M.sharesAt(c).layers.conflict, 1)
  let d = M.addTestimony(M.newClaim({ claim: 'x', scale: 10 }), { entity: { kind: 'animal', resolution: 0.5 }, verdict: 'true' })
  assert.equal(M.sharesAt(d).layers.known_unknown, 1)
})
test('objective needs a law', () => {
  let c = M.addTestimony(M.newClaim({ claim: 'x', scale: 4 }), { entity: { kind: 'human' }, verdict: 'true' })
  assert.equal(M.isObjective(c), false); assert.equal(M.colorOf(c).hex, '#00c800')
  c = M.setState(c, { laws: ['L'] }, 'law'); assert.equal(M.isObjective(c), true); assert.equal(M.colorOf(c).hex, '#ffffff')
})
test('state change is append-only; theory staging keeps reasons', () => {
  let c = M.setState(cup(), { conditions: { lime: true } }, 'added lime')
  assert.equal(c.stateHistory.length, 1); assert.notEqual(c.stateHistory[0].until, null); assert.equal(c.state.conditions.lime, true)
  const id = c.testimonies[0].id; c = M.stageTheory(c, 'half', [id]); const th = c.theories[0]
  c = M.resolveTheory(c, th.id, false, 'sensor disagrees'); assert.equal(c.theories[0].status, 'rejected'); assert.equal(c.theories[0].reason, 'sensor disagrees')
  assert.throws(() => M.resolveTheory(c, th.id, true))
  assert.ok(c.events.length >= 5)
})
test('promotion is structural: copies do not count', () => {
  let c = M.newClaim({ claim: 'x' })
  for (let i = 0; i < 3; i++) c = M.addTestimony(c, { entity: { kind: 'human', id: 'same' }, sourceKey: 'one', verdict: 'true' })
  assert.equal(M.canPromote(c).true.ok, false)
  let d = M.newClaim({ claim: 'x' })
  d = M.addTestimony(d, { entity: { kind: 'human', id: 'a' }, verdict: 'true', conditions: { light: 'day' } }); d = M.addTestimony(d, { entity: { kind: 'ai', id: 'b' }, verdict: 'true', conditions: { light: 'dark' } })
  assert.equal(M.canPromote(d).true.ok, true); assert.equal(M.promote(d).testimonies[0].truthType, 'subjective')
})
test('sanitizeClaim is hostile-proof and idempotent', () => {
  for (const h of hostile()) { const a = M.sanitizeClaim(h); assert.deepEqual(M.sanitizeClaim(a), a) }
  const p = M.sanitizeClaim(JSON.parse('{"__proto__":{"x":1},"testimonies":[{"__proto__":{"y":1},"verdict":"true","conditions":{"__proto__":1}}]}'))
  assert.equal(({}).x, undefined); assert.equal(({}).y, undefined); assert.ok(p)
})
test('vault: seal, open, wrong key, tamper', async () => {
  const c = cup(); const s = await V.sealClaim(c, 'open sesame', { rounds: 1000 })
  assert.equal(s.visibility, 'private'); assert.ok(!JSON.stringify(s).includes('water to the line'))
  assert.equal(V.publicFace(s).claim, 'The cup is half full')
  const o = await V.openClaim(s, 'open sesame'); assert.equal(o.testimonies.length, 2)
  await assert.rejects(V.openClaim(s, 'nope nope'), /wrong key/)
  const d = s.data.slice(0, 10) + (s.data[10] === 'A' ? 'B' : 'A') + s.data.slice(11)
  await assert.rejects(V.openClaim({ ...s, data: d }, 'open sesame'), /wrong key/)
  await assert.rejects(V.sealClaim(c, 'x'))
})

test('awareness: identified / undefined / branch source; branches are born, kept, and merge widens scope', () => {
  let c = M.newClaim({ claim: 'The wall is blue', scale: 4, at: 1 })
  c = M.addAwareness(c, { name: 'Camera', systemType: 'natural', familiarity: ['colour'], scope: ['colour'] }, { at: 2 })
  c = M.addAwareness(c, { name: 'Policy desk', systemType: 'intentional', familiarity: ['colour', 'rumour'], scope: ['colour'] }, { at: 3 })
  const r = M.identify(c, 'rumour', { at: 4 }); c = r.claim
  assert.deepEqual(r.results.map(x => x.result), ['undefined', 'branch_source'])
  assert.equal(r.results[1].revealsValues, true); assert.equal(r.results[0].revealsValues, false)
  assert.equal(c.items.known_unknown.length, 1); assert.equal(c.items.declined.length, 1); assert.equal(c.branches.length, 1)
  assert.equal(M.identify(c, 'rumour').claim.branches.length, 1)      // asking again does not breed a second branch
  assert.equal(M.identify(c, 'colour').results.every(x => x.result === 'identified'), true)
  const b = c.branches[0]; c = M.growBranch(c, b.id, 'node9'); assert.deepEqual(c.branches[0].nodes, ['node9'])
  c = M.setBranch(c, b.id, 'dormant', 'parked'); c = M.setBranch(c, b.id, 'merged', 'now accepted')
  assert.equal(c.branches[0].history.length, 3); assert.equal(M.identify(c, 'rumour').results[1].result, 'identified')   // the desk widened its scope
  c = M.scoreEffectiveness(c, c.awarenesses[0].id, 'rumour', 0.8); assert.equal(c.outcomes.find(o => o.subject === 'rumour' && o.awareness === c.awarenesses[0].id).effectiveness, 0.8)
  assert.equal(M.classifyOutcomes(c).branch_source, 1)
  assert.throws(() => M.identify(M.newClaim({ claim: 'x' }), 'a'), /awareness/); assert.throws(() => M.setBranch(c, 'nope', 'merged')); assert.throws(() => M.setBranch(c, b.id, 'sideways'))
  assert.equal(M.chartData(c).branches.length, 1); assert.deepEqual(M.sanitizeClaim(c), c)
})

import * as RV from '../utils/OmniClaimReality.js'
test('reality view: rooms follow the shares, testimonies live in the room of their verdict, particles never leave', () => {
  const c = cup(); const lay = RV.layout(c, 10)
  assert.equal(lay.rooms.length, 3); assert.ok(lay.edges[0] > lay.edges[2] && lay.edges[1] > lay.edges[2])   // true 50% and false 40% are bigger than undefined 10%
  assert.ok(lay.edges.every(e => e >= RV.LIMITS.minEdge)); assert.equal(RV.layout(M.newClaim({ claim: 'x' })).shares.undefined, 1)
  let c2 = c; c2 = M.addTestimony(c2, { entity: { kind: 'ai', id: 'g' }, verdict: 'undefined', experience: { intensity: 1, tempo: 1, noise: 1, weight: 0.2 } }, { at: 9 })
  const ps = RV.seedParticles(c2); assert.ok(ps.length > 0 && ps.length <= RV.LIMITS.particles)
  assert.ok(ps.filter(p => p.kind === 'ai').every(p => p.room === 2)); assert.ok(ps.filter(p => p.kind === 'human').every(p => p.room === 0)); assert.ok(ps.filter(p => p.kind === 'sensor').every(p => p.room === 1))
  assert.deepEqual(RV.seedParticles(c2).map(p => p.p), ps.map(p => p.p))                                     // same claim, same picture
  const edges = RV.layout(c2).edges; const atts = [0, 1, 2].map(i => RV.attractors(edges[i], 6, i)); const r = RV.rng(5)
  for (let i = 0; i < 300; i++) RV.stepParticles(ps, 0.05, edges, r, atts)
  assert.ok(ps.every(p => [0, 1, 2].every(k => Math.abs(p.p[k]) <= edges[p.room] / 2 + 1e-9 && Number.isFinite(p.p[k]))))
  assert.ok(ps.find(p => p.kind === 'ai').par.speed > ps.find(p => p.kind === 'human').par.speed)            // a fast, noisy testimony moves faster
  const many = M.newClaim({ claim: 'm' }); let big = many; for (let i = 0; i < 100; i++) big = M.addTestimony(big, { entity: { kind: 'bot' }, verdict: 'true', weight: 4 }); assert.equal(RV.seedParticles(big).length, RV.LIMITS.particles)
  for (const h of hostile()) { RV.layout(h); RV.seedParticles(h) }
})
