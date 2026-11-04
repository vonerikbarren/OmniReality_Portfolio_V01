/**
 * utils/OmniEpistemicsModel.js (V271) — the pure model of OmniEpistemics (engine: OmniDynamix). No DOM, no three.js, no clock: every function is a plain function of its arguments.
 *
 *   data.epistemics = { v:1, layer, text(<=300), attrs{}, claimId, source, derivedFrom[<=8], note }       (layers and attributes: data/OmniEpistemicsOntology.js)
 *   sanitizeEpistemics(raw)      never throws, idempotent, unknown keys dropped, no prototype pollution, every number clamped.
 *   Equations                    squash, rumorStrength, belief, realityResistance, narrativeStability (all land in 0..1; zero/NaN/negative inputs cannot break them).
 *   Forces                       herd, emotionalGravity, incentive, authority, identity, realityResistance (each 0..1) + forceReport().
 *   derive(from, transform, opts) makes the NEXT layer's node spec from a node: a lossy copy with a seeded random source (same seed = same copy). Append-only: the source is never changed.
 *   confidenceFromClaim(claim)   certainty derived from a linked claim's testimonies (never hand-typed).      visualOf(node) -> how the node should look.
 */
import { ONTOLOGY } from '../data/OmniEpistemicsOntology.js'
import { sharesAt, independence, sanitizeClaim } from './OmniClaimModel.js'

export const LIMITS = Object.freeze({ text: 300, short: 80, derivedFrom: 8, note: 300, source: 80, id: 64 })
export const LAYERS = Object.freeze(ONTOLOGY.layers.map(l => l.id))
export const LAYER_INFO = Object.freeze(Object.fromEntries(ONTOLOGY.layers.map(l => [l.id, l])))
export const TRANSFORMS = Object.freeze(Object.fromEntries(ONTOLOGY.transforms.map(t => [t.id, t])))
export const TRANSFORM_IDS = Object.freeze(Object.keys(TRANSFORMS))
export const FORCE_IDS = Object.freeze(ONTOLOGY.forces.map(f => f.id))

const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k)
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v)
const own = (o, k) => (isObj(o) && has(o, k) ? o[k] : undefined)
const num = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d }
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const unit = (v, d = 0) => clamp(num(v, d), 0, 1)
const round = (v) => Math.round(v * 1e4) / 1e4
const clean = (v, n) => String(v ?? '').replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n)
const cleanId = (v) => { const s = String(v ?? '').trim(); return /^[\w-]{1,64}$/.test(s) ? s : '' }

// ── layers ──
export const isLayer = (l) => typeof l === 'string' && has(LAYER_INFO, l)
export const layerShape = (layer) => (isLayer(layer) ? LAYER_INFO[layer].shape : 'sphere')
export const layerColor = (layer) => (isLayer(layer) ? LAYER_INFO[layer].color : '#ffffff')
export function defaultAttrs (layer) {
  const o = {}; if (!isLayer(layer)) return o
  for (const a of LAYER_INFO[layer].attrs) o[a.key] = a.default
  return o
}
export function sanitizeAttrs (layer, raw) {
  const o = defaultAttrs(layer); if (!isLayer(layer)) return o
  for (const a of LAYER_INFO[layer].attrs) {
    const v = own(raw, a.key); if (v === undefined) continue
    o[a.key] = a.type === 'unit' ? round(unit(v, a.default)) : clean(v, LIMITS.short)
  }
  return o
}
export function sanitizeEpistemics (raw) {
  const r = isObj(raw) ? raw : {}; const layer = isLayer(own(r, 'layer')) ? r.layer : 'event'
  const from = []; for (const d of (Array.isArray(r.derivedFrom) ? r.derivedFrom : []).slice(0, LIMITS.derivedFrom * 2)) { const c = cleanId(d); if (c && !from.includes(c) && from.length < LIMITS.derivedFrom) from.push(c) }
  return { v: 1, layer, text: clean(own(r, 'text'), LIMITS.text), attrs: sanitizeAttrs(layer, own(r, 'attrs')), claimId: cleanId(own(r, 'claimId')), source: clean(own(r, 'source'), LIMITS.source), derivedFrom: from, note: clean(own(r, 'note'), LIMITS.note) }
}
export const newEpistemics = (o = {}) => sanitizeEpistemics(o)

// ── equations (all 0..1) ──
export const squash = (x) => { const n = Math.max(0, num(x, 0)); return n / (1 + n) }
const a = (node, k, d = 0) => unit(own(own(node, 'attrs'), k), d)
export const rumorStrength = (at) => round(squash(unit(own(at, 'propagation'), 0) * unit(own(at, 'emotionalCharge'), 0) / (unit(own(at, 'evidence'), 0) + 0.1)))
export const belief = (at) => round(1 - Math.exp(-3 * unit(own(at, 'coherence'), 0) * unit(own(at, 'repetition'), 0) * (0.5 + unit(own(at, 'identity'), 0))))
export const realityResistance = (at) => round((unit(own(at, 'evidenceStrength'), unit(own(at, 'evidence'), 0)) + unit(own(at, 'reproducibility'), 0) + unit(own(at, 'predictiveAccuracy'), 0)) / 3)
export const narrativeStability = (at) => round(realityResistance(at) * (0.5 + 0.5 * unit(own(at, 'coherence'), 0)))

// ── forces (each 0..1) ──
export const FORCES = Object.freeze({
  herd: (shareBelieving) => round(squash(2 * unit(shareBelieving, 0) ** 2)),
  emotionalGravity: (charge) => round(unit(charge, 0) ** 2),
  incentive: (benefit, cost) => round(squash(Math.max(0, num(benefit, 0)) / (Math.max(0, num(cost, 0)) + 0.1))),
  authority: (weight) => round(unit(weight, 0)),
  identity: (tie) => round(unit(tie, 0)),
  realityResistance: (at) => realityResistance(at)
})
/** every force on one node, from its own attributes and a context { shareBelieving, benefit, cost } */
export function forceReport (node, ctx = {}) {
  const at = own(node, 'attrs') ?? {}; const c = isObj(ctx) ? ctx : {}
  const charge = unit(own(at, 'emotionalCharge'), 0)
  return { herd: FORCES.herd(own(c, 'shareBelieving')), emotionalGravity: FORCES.emotionalGravity(charge), incentive: FORCES.incentive(own(c, 'benefit'), own(c, 'cost')), authority: FORCES.authority(own(at, 'authority')), identity: FORCES.identity(own(at, 'identity')), realityResistance: FORCES.realityResistance(at) }
}

// ── certainty, derived ──
/** how well-grounded a node is (0..1), from its own layer's evidence */
export function certaintyOf (node) {
  const e = isObj(node) ? node : {}; const at = own(e, 'attrs') ?? {}; const L = own(e, 'layer')
  switch (L) {
    case 'event': return 1
    case 'observation': return round(unit(own(at, 'clarity'), 0.5) * (1 - 0.5 * unit(own(at, 'bias'), 0)))
    case 'memory': return round(unit(own(at, 'vividness'), 0.5) * (1 - 0.5 * unit(own(at, 'reconstruction'), 0)))
    case 'rumor': return round(unit(own(at, 'evidence'), 0))
    case 'gossip': return round(unit(own(at, 'trust'), 0) * 0.5)
    case 'narrative': return narrativeStability(at)
    case 'meta': return round(unit(own(at, 'reflexivity'), 0.5))
    case 'documentary': return realityResistance(at)
    case 'absence': return round(unit(own(at, 'expectedness'), 0.5) * unit(own(at, 'searchEffort'), 0))
    case 'counterfactual': return round(unit(own(at, 'plausibility'), 0.5) * 0.5)
    default: return 0
  }
}
/** certainty from a linked claim: what is not "undefined", discounted by how much the sources are not independent. null when there is nothing to go on. */
export function confidenceFromClaim (claim) {
  const c = sanitizeClaim(claim); if (!c.testimonies.length) return null
  const s = sharesAt(c); const leaning = Math.max(s.truth, s.false)
  return round(clamp((1 - s.undefined) * (0.5 + 0.5 * independence(c)) * (0.4 + 0.6 * leaning), 0, 1))
}

// ── seeded random + lossy copies ──
export function rng (seed) { let s = (num(seed, 1) >>> 0) || 1; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }
/** drop words with probability ~amount (each replaced by an ellipsis; runs merge). Never returns empty text from non-empty text. */
export function degradeText (text, amount, r = Math.random) {
  const words = clean(text, LIMITS.text).split(' ').filter(Boolean); if (!words.length) return ''
  const p = clamp(num(amount, 0), 0, 1) * 0.7; const out = []
  for (let i = 0; i < words.length; i++) { const lose = i > 0 && r() < p; if (lose) { if (out[out.length - 1] !== '…') out.push('…') } else out.push(words[i]) }
  return out.join(' ').slice(0, LIMITS.text)
}
/** layers a node of this layer can be turned into, with the transform that does it */
export function nextSteps (layer) { return ONTOLOGY.transforms.filter(t => t.from.includes(layer)).map(t => ({ transform: t.id, to: t.to, meaning: t.meaning })) }
export function transformFor (fromLayer, toLayer) { const t = ONTOLOGY.transforms.find(x => x.from.includes(fromLayer) && x.to === toLayer); return t ? t.id : null }

/**
 * derive(node, transformId, { seed, id, text, ctx }) -> { ok, spec } | { ok:false, error }
 * spec is a NEW epistemics record (the layer after) with derivedFrom = [node.id]. The source node is never touched.
 */
export function derive (node, transformId, opts = {}) {
  const t = TRANSFORMS[transformId]; if (!t) return { ok: false, error: 'unknown step: ' + String(transformId) }
  const src = sanitizeEpistemics(node); if (!t.from.includes(src.layer)) return { ok: false, error: `${t.id} needs a ${t.from.join(' / ')} node, not ${src.layer}` }
  const o = isObj(opts) ? opts : {}; const R = rng(own(o, 'seed') ?? 1); const at = src.attrs; const sid = cleanId(own(o, 'id')) || cleanId(own(node, 'id'))
  let attrs = {}; let amount = 0.2
  switch (t.id) {
    case 'observe': { const clarity = clamp(0.35 + 0.5 * unit(at.magnitude, 0.5) * 0.5 + 0.3 * R(), 0.05, 1); attrs = { clarity, proximity: clamp(0.2 + 0.7 * R(), 0, 1), bias: clamp(0.4 * R(), 0, 1), attention: clamp(0.3 + 0.6 * R(), 0, 1) }; amount = 1 - clarity; break }
    case 'remember': { const decay = clamp(0.15 + 0.35 * R(), 0, 1); const rec = clamp(0.2 + 0.5 * R(), 0, 1); attrs = { vividness: clamp(unit(at.clarity, 0.5) * (1 - decay), 0, 1), decay, reconstruction: rec, confidence: clamp(0.6 + 0.35 * R(), 0, 1) }; amount = (decay + rec) / 2; break }
    case 'propagate': { const ev = clamp(unit(at.vividness ?? at.clarity, 0.4) * 0.4, 0, 1); attrs = { propagation: clamp(0.3 + 0.6 * R(), 0, 1), emotionalCharge: clamp(0.3 + 0.6 * R(), 0, 1), evidence: ev, novelty: clamp(0.3 + 0.6 * R(), 0, 1) }; amount = 0.35; break }
    case 'gossip': { const emb = clamp(0.2 + 0.5 * R(), 0, 1); attrs = { reach: clamp(0.2 + 0.6 * R(), 0, 1), intimacy: clamp(0.3 + 0.6 * R(), 0, 1), embellishment: emb, trust: clamp(0.3 + 0.5 * R(), 0, 1), emotionalCharge: clamp(unit(at.emotionalCharge, 0.5) + 0.2 * R(), 0, 1) }; amount = 0.3 + emb * 0.3; break }
    case 'narrate': { attrs = { coherence: clamp(0.4 + 0.45 * R(), 0, 1), repetition: clamp(unit(at.reach, 0.4) * 0.6 + 0.3 * R(), 0, 1), identity: clamp(0.2 + 0.7 * R(), 0, 1), emotionalCharge: clamp(unit(at.emotionalCharge, 0.4), 0, 1), evidence: clamp(unit(at.evidence, 0.1), 0, 1), reproducibility: 0.05, predictiveAccuracy: 0.1 }; amount = 0.3; break }
    case 'represent': { const base = clamp(0.1 + 0.8 * Math.max(unit(at.evidence, 0), unit(at.physicalTrace, 0), unit(at.clarity, 0) * 0.6), 0, 1); attrs = { medium: 'report', evidenceStrength: base, reproducibility: clamp(base * 0.7, 0, 1), predictiveAccuracy: clamp(base * 0.6, 0, 1), authority: clamp(0.3 + 0.5 * R(), 0, 1) }; amount = 0.1; break }
    default: break
  }
  if (own(o, 'attrs') && isObj(o.attrs)) attrs = { ...attrs, ...o.attrs }
  const text = own(o, 'text') !== undefined ? clean(o.text, LIMITS.text) : degradeText(src.text, amount, R)
  const spec = sanitizeEpistemics({ layer: t.to, text, attrs, claimId: src.claimId, source: src.source, derivedFrom: sid ? [sid] : [], note: '' })
  return { ok: true, spec, transform: t.id, meaning: t.meaning }
}

// ── tracing a claim ──
/**
 * traceClaim(claim) -> { event, observations[], absences[], counterfactuals[], links[] }   (plain specs; ids are positions: 'event', 'obs:<testimonyId>', 'abs:<n>', 'cf:<branchId>')
 * The event is the claim itself; each testimony is an observation of it; undefined layers and unknown items are absences; each non-merged branch is a what-if.
 */
export function traceClaim (claim) {
  const c = sanitizeClaim(claim); const links = []; let idx = 0
  const event = sanitizeEpistemics({ layer: 'event', text: c.claim || 'A claim', claimId: c.id, attrs: { magnitude: 0.5, physicalTrace: clamp(1 - sharesAt(c).undefined, 0, 1) } })
  const observations = c.testimonies.map(t => {
    const key = "obs:" + (t.id || "n" + (idx++))
    const clar = clamp(0.3 + 0.7 * (t.experience && Number.isFinite(Number(t.experience.clarity)) ? unit(t.experience.clarity, 0.5) : unit(t.entity.resolution, 0.5)), 0, 1)
    const spec = sanitizeEpistemics({ layer: 'observation', text: t.observation || t.interpretation || t.verdict, claimId: c.id, source: t.sourceKey, attrs: { observer: t.sourceKey, clarity: clar, bias: t.verdict === 'undefined' ? 0.5 : 0.2, proximity: unit(t.entity.resolution, 0.5), attention: 0.6 } })
    links.push({ from: 'event', to: key, meaning: t.verdict === 'false' ? 'conflict' : 'derives' })
    return { key, spec, verdict: t.verdict }
  })
  const absences = []
  const addAbs = (text, kind) => { const key = 'abs:' + absences.length; absences.push({ key, spec: sanitizeEpistemics({ layer: 'absence', text, claimId: c.id, attrs: { missing: text, expectedness: kind === 'known' ? 0.7 : 0.4, searchEffort: kind === 'declined' ? 0 : 0.3 } }) }); links.push({ from: 'event', to: key, meaning: 'note' }) }
  const s = sharesAt(c)
  if (s.undefined > 0.5 && !c.items.known_unknown.length) addAbs('Most of this claim is still undefined', 'known')
  for (const i of c.items.known_unknown.slice(0, 6)) addAbs(i.text, 'known')
  for (const i of c.items.unknown_unknown.slice(0, 3)) addAbs(i.text, 'unknown')
  for (const i of c.items.declined.slice(0, 3)) addAbs(i.text, 'declined')
  const counterfactuals = c.branches.filter(b => b.status !== 'merged').slice(0, 6).map(b => {
    const key = 'cf:' + b.id; links.push({ from: 'event', to: key, meaning: 'optional' })
    return { key, spec: sanitizeEpistemics({ layer: 'counterfactual', text: b.subject, claimId: c.id, attrs: { hinge: b.reason, plausibility: b.status === 'active' ? 0.6 : 0.3, divergence: 0.5 } }) }
  })
  return { event, observations, absences, counterfactuals, links, confidence: confidenceFromClaim(c) }
}


// ── how a node looks ──
/** -> { shape: sphere|cube|hollow, opacity 0.15..1, size 0.7..1.6, glow 0..1, wire, ghost, color } (certain = solid, charged = glowing, absence = hollow wire, what-if = ghost) */
export function visualOf (node, { confidence = null } = {}) {
  const e = sanitizeEpistemics(node); const cert = confidence == null ? certaintyOf(e) : unit(confidence, 0)
  const mass = clamp(e.text.length / 150, 0, 1) * 0.6 + clamp(e.derivedFrom.length / 4, 0, 1) * 0.4
  const shape = layerShape(e.layer); const ghost = e.layer === 'counterfactual'
  return { shape, opacity: round(clamp(0.25 + 0.75 * cert, 0.15, 1) * (ghost ? 0.6 : 1)), size: round(0.7 + 0.9 * mass), glow: round(unit(e.attrs.emotionalCharge, 0)), wire: shape === 'hollow', ghost, color: layerColor(e.layer), certainty: cert }
}

// ── the sandbox example ──
/** "The Bridge Rumor": a bridge closes for repair; three people see it; memory drifts; it becomes a rumour, gossip, a local story and a news item; plus what is missing and what might have been. */
export function bridgeExample () {
  const nodes = [
    { id: 'ex_bridge_event', layer: 'event', text: 'The old bridge was closed for repairs on Monday morning.', attrs: { when: 'Monday morning', where: 'Old Mill bridge', magnitude: 0.4, physicalTrace: 0.8 } },
    { id: 'ex_bridge_obs1', layer: 'observation', text: 'Saw workers and barriers at the bridge entrance.', attrs: { observer: 'Dana, jogger', clarity: 0.8, proximity: 0.7, bias: 0.1, attention: 0.7 } },
    { id: 'ex_bridge_obs2', layer: 'observation', text: 'Heard a loud noise near the bridge, then sirens.', attrs: { observer: 'Sam, from a window', clarity: 0.4, proximity: 0.3, bias: 0.4, attention: 0.4 } },
    { id: 'ex_bridge_obs3', layer: 'observation', text: 'Traffic was stopped, people were pointing at the bridge.', attrs: { observer: 'Lee, in the bus', clarity: 0.5, proximity: 0.5, bias: 0.3, attention: 0.5 } },
    { id: 'ex_bridge_mem', layer: 'memory', text: 'There was a bang by the bridge and everyone was running.', attrs: { vividness: 0.7, decay: 0.3, reconstruction: 0.6, confidence: 0.85 } },
    { id: 'ex_bridge_rumor', layer: 'rumor', text: 'The bridge collapsed!', attrs: { propagation: 0.9, emotionalCharge: 0.9, evidence: 0.05, novelty: 0.8 } },
    { id: 'ex_bridge_gossip', layer: 'gossip', text: 'My neighbour says the bridge fell and people were hurt.', attrs: { reach: 0.7, intimacy: 0.8, embellishment: 0.7, trust: 0.7, emotionalCharge: 0.9 } },
    { id: 'ex_bridge_story', layer: 'narrative', text: 'The town always said that bridge was neglected. Now we know.', attrs: { coherence: 0.8, repetition: 0.8, identity: 0.7, emotionalCharge: 0.7, evidence: 0.1, reproducibility: 0.05, predictiveAccuracy: 0.1 } },
    { id: 'ex_bridge_news', layer: 'documentary', text: 'Local paper: Bridge closed for scheduled repairs, no collapse.', attrs: { medium: 'news article', evidenceStrength: 0.8, reproducibility: 0.7, predictiveAccuracy: 0.6, authority: 0.6 } },
    { id: 'ex_bridge_gap', layer: 'absence', text: 'No inspection report was ever filed.', attrs: { missing: 'inspection report', expectedness: 0.8, searchEffort: 0.5 } },
    { id: 'ex_bridge_alt', layer: 'counterfactual', text: 'If the closure had been announced a week earlier, the rumour would not have spread.', attrs: { hinge: 'an earlier announcement', plausibility: 0.7, divergence: 0.6 } }
  ]
  const L = (from, to, meaning) => ({ from, to, meaning })
  const links = [
    L('ex_bridge_event', 'ex_bridge_obs1', 'derives'), L('ex_bridge_event', 'ex_bridge_obs2', 'derives'), L('ex_bridge_event', 'ex_bridge_obs3', 'derives'),
    L('ex_bridge_obs1', 'ex_bridge_mem', 'distorts'), L('ex_bridge_obs2', 'ex_bridge_mem', 'distorts'), L('ex_bridge_obs3', 'ex_bridge_mem', 'distorts'),
    L('ex_bridge_mem', 'ex_bridge_rumor', 'propagates'), L('ex_bridge_rumor', 'ex_bridge_gossip', 'propagates'), L('ex_bridge_gossip', 'ex_bridge_story', 'distorts'),
    L('ex_bridge_event', 'ex_bridge_news', 'derives'), L('ex_bridge_news', 'ex_bridge_story', 'conflict'), L('ex_bridge_event', 'ex_bridge_gap', 'note'), L('ex_bridge_event', 'ex_bridge_alt', 'optional')
  ]
  return { nodes, links }
}
