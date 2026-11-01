/**
 * utils/OmniClaimModel.js (V258) — DIMENSIONAL SCRIPTING as plain data: a CLAIM that holds TRUE, FALSE and UNDEFINED shares at the same time.
 * Pure, no DOM. Ported from the owner's dimensional-scripting.js (classes -> JSON-safe data + immutable functions) with the gaps filled in.
 *
 * THE IDEA, as built
 *  - A claim is laid out over an EXTENT 0..1 (a cup's fill level, a stretch of time, later a voxel grid). A testimony speaks about a REGION of it
 *    with a verdict (true / false / undefined) and a RESOLUTION: the finest cell width its entity could perceive.
 *  - SCALE = the number of cells the extent is cut into. Each cell is judged on its own:
 *      all accounts that cover the whole cell agree true  -> TRUE      agree false -> FALSE
 *      accounts disagree (conflict), an account covers only part of the cell (mixed: a boundary lies inside it),
 *      nobody covers it (absence), or only entities too coarse to see it do (known_unknown) -> UNDEFINED
 *    So true + false + undefined = 1 at every scale (duality). Zoom in (a bigger scale) and mixed cells split; a boundary that has real thickness
 *    keeps its undefined cells at every finer scale: an irrational identity, resolved to n cells but never complete.
 *  - OBJECTIVE = nothing undefined at the chosen scale AND the identity begins with Laws.
 *  - Every testimony names WHO spoke: entity kind (human / bot / ai / sensor / animal / other / unknown), id, senses and resolution, and keeps
 *    observation and interpretation apart, so a reader can always tell what an account is and where it came from.
 *  - History is append-only (events). Changing the state (adding a lime) closes the old state, never erases it.
 *
 * API (all immutable: they return a new claim; `at` = a timestamp, default Date.now())
 *   sanitizeClaim(raw) · newClaim({claim, visibility, identity, scale, conditions, laws}) · addTestimony(c, t) · setState(c, changes, reason) · setScale(c, n)
 *   sharesAt(c, n) -> { truth, false, undefined, layers, cells } · curve(c, scales) · isObjective(c, n) · colorOf(c, n) · chartData(c, n)
 *   independence(c) · conditionDiversity(c) · canPromote(c, opts) · promote(c) · stageTheory(c, text, ids) · resolveTheory(c, id, ok, reason)
 *   addUnknown(c, layer, text) · byEntity(c) · physicsOf(exp) · pathOf(c)
 */
export const CLAIM_VERSION = 1
export const ENTITY_KINDS = Object.freeze(['human', 'bot', 'ai', 'sensor', 'animal', 'other', 'unknown'])
export const VERDICTS = Object.freeze(['true', 'false', 'undefined'])
export const TRUTH_TYPES = Object.freeze(['personal', 'subjective', 'theory', 'objective'])
export const THEORY_STATUS = Object.freeze(['staged', 'confirmed', 'rejected'])
export const UNDEFINED_LAYERS = Object.freeze(['conflict', 'absence', 'mixed', 'known_unknown', 'unknown_unknown', 'declined'])
export const VISIBILITY = Object.freeze(['public', 'private'])
export const SYSTEM_TYPES = Object.freeze(['natural', 'intentional'])           // natural: its limits are limits.  intentional: its limits are choices, so a declined subject reveals its values
export const IDENT_RESULTS = Object.freeze(['identified', 'undefined', 'branch_source'])
export const BRANCH_STATUS = Object.freeze(['active', 'dormant', 'merged', 'forked'])
export const LIMITS = Object.freeze({ claim: 300, text: 2000, short: 80, testimonies: 500, theories: 50, laws: 50, conditions: 30, events: 500, states: 50, items: 100, senses: 12, maxScale: 4096, awarenesses: 20, listItems: 200, outcomes: 300, branches: 50, branchNodes: 20, history: 50 })
export const NODE_COLOR = Object.freeze({ truth: [0, 200, 0], objectiveTruth: [255, 255, 255], false: [220, 0, 0], objectiveFalse: [0, 0, 0], undefined: [230, 210, 0], objectiveUndefined: [128, 128, 128] })
export const EXPERIENCE_DIMS = Object.freeze(['intensity', 'tempo', 'focus', 'noise', 'weight', 'saturation'])
const EPS = 1e-9
const BAD = new Set(['__proto__', 'constructor', 'prototype'])
const ID = /^[\w-]{1,64}$/
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v)
const own = (o, k) => (isObj(o) && !BAD.has(k) && Object.prototype.hasOwnProperty.call(o, k) ? o[k] : undefined)
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : d))
const line = (v, n) => text(v, n).replace(/[\n\t]/g, ' ').trim()
const text = (v, n) => (typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f<>]/g, '').trim().slice(0, n) : '')
const pick = (v, list, d) => (typeof v === 'string' && list.includes(v) ? v : d)
const cleanId = (v) => (typeof v === 'string' && ID.test(v) && !BAD.has(v) ? v : '')
const round = (n, p = 1e6) => Math.round(n * p) / p
let _seq = 0
export const makeId = (p = 'c') => p + Date.now().toString(36) + (_seq++).toString(36) + Math.floor(Math.random() * 1296).toString(36)

// ── small sanitizers ─────────────────────────────────────────────────────────────────────────────────────────────
function cleanConditions (raw) {
  const out = {}; if (!isObj(raw)) return out
  for (const k of Object.keys(raw).slice(0, 200)) {
    if (BAD.has(k) || Object.keys(out).length >= LIMITS.conditions) continue
    const key = text(k, 40); const v = raw[k]; if (!key) continue
    out[key] = typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'boolean' ? v : text(String(v ?? ''), 120)
  }
  return out
}
export function sanitizeEntity (raw) {
  const r = isObj(raw) ? raw : {}
  const senses = []; for (const s of (Array.isArray(r.senses) ? r.senses : []).slice(0, 50)) { const t = text(s, 40); if (t && !senses.includes(t) && senses.length < LIMITS.senses) senses.push(t) }
  return { kind: pick(own(r, 'kind'), ENTITY_KINDS, 'unknown'), id: text(own(r, 'id'), LIMITS.short), senses, resolution: clamp(num(own(r, 'resolution'), 0), 0, 1) }
}
export function sanitizeExperience (raw) {
  const r = isObj(raw) ? raw : {}; const o = {}
  for (const k of EXPERIENCE_DIMS) o[k] = round(clamp(num(own(r, k), 0), 0, 1), 1e4)
  return o
}
function cleanRegion (raw) {
  if (!Array.isArray(raw) || raw.length < 2) return [0, 1]
  const a = clamp(num(raw[0], 0), 0, 1); const b = clamp(num(raw[1], 1), 0, 1)
  return b - a > EPS ? [round(a), round(b)] : [0, 1]
}
export function sanitizeTestimony (raw) {
  const r = isObj(raw) ? raw : {}; const entity = sanitizeEntity(own(r, 'entity'))
  const sk = text(own(r, 'sourceKey'), LIMITS.short)
  return {
    id: cleanId(own(r, 'id')), entity, observation: text(own(r, 'observation'), LIMITS.text), interpretation: text(own(r, 'interpretation'), LIMITS.text),
    conditions: cleanConditions(own(r, 'conditions')), sourceKey: sk || entity.id || entity.kind, verdict: pick(own(r, 'verdict'), VERDICTS, 'undefined'),
    region: cleanRegion(own(r, 'region')), weight: clamp(num(own(r, 'weight'), 1), 0, 1000), truthType: pick(own(r, 'truthType'), TRUTH_TYPES, 'personal'),
    experience: sanitizeExperience(own(r, 'experience')), confirmed: own(r, 'confirmed') === true, at: Math.max(0, Math.round(num(own(r, 'at'), 0))),
  }
}
function sanitizeTheory (raw) {
  const r = isObj(raw) ? raw : {}; const support = []
  for (const s of (Array.isArray(r.support) ? r.support : []).slice(0, 100)) { const c = cleanId(s); if (c && !support.includes(c)) support.push(c) }
  return { id: cleanId(own(r, 'id')), statement: text(own(r, 'statement'), LIMITS.text), support, status: pick(own(r, 'status'), THEORY_STATUS, 'staged'), reason: text(own(r, 'reason'), 500), stagedAt: Math.max(0, Math.round(num(own(r, 'stagedAt'), 0))), resolvedAt: Math.max(0, Math.round(num(own(r, 'resolvedAt'), 0))) }
}
function sanitizeState (raw) {
  const r = isObj(raw) ? raw : {}; const laws = []
  for (const l of (Array.isArray(r.laws) ? r.laws : []).slice(0, 200)) { const t = text(l, 200); if (t && !laws.includes(t) && laws.length < LIMITS.laws) laws.push(t) }
  return { identity: text(own(r, 'identity'), 200), scale: clamp(Math.round(num(own(r, 'scale'), 10)), 1, LIMITS.maxScale), conditions: cleanConditions(own(r, 'conditions')), laws, since: Math.max(0, Math.round(num(own(r, 'since'), 0))), until: own(r, 'until') == null ? null : Math.max(0, Math.round(num(own(r, 'until'), 0))) }
}
function sanitizeEvent (raw) {
  const r = isObj(raw) ? raw : {}
  return { at: Math.max(0, Math.round(num(own(r, 'at'), 0))), type: text(own(r, 'type'), 40), subject: text(own(r, 'subject'), LIMITS.short), from: text(own(r, 'from'), 200), to: text(own(r, 'to'), 200), reason: text(own(r, 'reason'), 500) }
}
function sanitizeItems (raw) {
  const r = isObj(raw) ? raw : {}; const o = {}
  for (const layer of ['known_unknown', 'unknown_unknown', 'declined']) {
    o[layer] = (Array.isArray(own(r, layer)) ? r[layer] : []).slice(0, LIMITS.items).map(i => ({ text: text(own(i, 'text'), 500), by: text(own(i, 'by'), LIMITS.short), at: Math.max(0, Math.round(num(own(i, 'at'), 0))) })).filter(i => i.text)
  }
  return o
}


// ── awareness, identification, branches ──────────────────────────────────────────────────────────────────────────
function cleanList (raw, n) { const o = []; for (const t of (Array.isArray(raw) ? raw : []).slice(0, n * 2)) { const c = text(t, 120); if (c && !o.includes(c) && o.length < n) o.push(c) } return o }
export function sanitizeAwareness (raw) {
  const r = isObj(raw) ? raw : {}
  return { id: cleanId(own(r, 'id')), name: line(own(r, 'name'), LIMITS.short) || 'Awareness', systemType: pick(own(r, 'systemType'), SYSTEM_TYPES, 'natural'), familiarity: cleanList(own(r, 'familiarity'), LIMITS.listItems), scope: cleanList(own(r, 'scope'), LIMITS.listItems), resolution: clamp(num(own(r, 'resolution'), 0), 0, 1) }
}
function sanitizeOutcome (raw) {
  const r = isObj(raw) ? raw : {}; const eff = own(r, 'effectiveness')
  return { awareness: cleanId(own(r, 'awareness')), subject: text(own(r, 'subject'), 120), result: pick(own(r, 'result'), IDENT_RESULTS, 'undefined'), revealsValues: own(r, 'revealsValues') === true, at: Math.max(0, Math.round(num(own(r, 'at'), 0))), effectiveness: eff == null ? null : clamp(num(eff, 0), 0, 1) }
}
function sanitizeBranch (raw) {
  const r = isObj(raw) ? raw : {}; const nodes = []
  for (const n of (Array.isArray(r.nodes) ? r.nodes : []).slice(0, LIMITS.branchNodes * 2)) { const c = cleanId(n); if (c && !nodes.includes(c) && nodes.length < LIMITS.branchNodes) nodes.push(c) }
  const history = (Array.isArray(r.history) ? r.history : []).slice(-LIMITS.history).map(h => ({ at: Math.max(0, Math.round(num(own(h, 'at'), 0))), from: text(own(h, 'from'), 20), to: pick(own(h, 'to'), BRANCH_STATUS, 'active'), reason: text(own(h, 'reason'), 300) }))
  return { id: cleanId(own(r, 'id')), subject: text(own(r, 'subject'), 120), awareness: cleanId(own(r, 'awareness')), reason: text(own(r, 'reason'), 300), status: pick(own(r, 'status'), BRANCH_STATUS, 'active'), nodes, at: Math.max(0, Math.round(num(own(r, 'at'), 0))), history }
}
function sanitizeAwareList (raw) { const ids = new Set(); const out = []; for (const a of (Array.isArray(raw) ? raw : []).slice(0, LIMITS.awarenesses + 5)) { if (out.length >= LIMITS.awarenesses) break; const s = sanitizeAwareness(a); if (!s.id || ids.has(s.id)) continue; ids.add(s.id); out.push(s) } return out }

/** Sanitise a whole claim. Never throws; idempotent; unknown keys dropped; everything capped. */
export function sanitizeClaim (raw) {
  const r = isObj(raw) ? raw : {}
  const ids = new Set(); const testimonies = []
  for (const t of (Array.isArray(r.testimonies) ? r.testimonies : []).slice(0, LIMITS.testimonies + 50)) {
    if (testimonies.length >= LIMITS.testimonies) break
    const s = sanitizeTestimony(t); if (s.id && ids.has(s.id)) continue; if (s.id) ids.add(s.id); testimonies.push(s)
  }
  const tIds = new Set(); const theories = []
  for (const t of (Array.isArray(r.theories) ? r.theories : []).slice(0, LIMITS.theories + 10)) { if (theories.length >= LIMITS.theories) break; const s = sanitizeTheory(t); if (!s.statement || (s.id && tIds.has(s.id))) continue; if (s.id) tIds.add(s.id); theories.push(s) }
  return {
    version: CLAIM_VERSION, id: cleanId(own(r, 'id')), claim: text(own(r, 'claim'), LIMITS.claim), visibility: pick(own(r, 'visibility'), VISIBILITY, 'public'),
    state: sanitizeState(own(r, 'state')), stateHistory: (Array.isArray(r.stateHistory) ? r.stateHistory : []).slice(0, LIMITS.states).map(sanitizeState),
    testimonies, theories, items: sanitizeItems(own(r, 'items')), awarenesses: sanitizeAwareList(r.awarenesses),
    outcomes: (Array.isArray(r.outcomes) ? r.outcomes : []).slice(-LIMITS.outcomes).map(sanitizeOutcome),
    branches: (Array.isArray(r.branches) ? r.branches : []).slice(0, LIMITS.branches).map(sanitizeBranch).filter(b => b.id && b.subject), events: (Array.isArray(r.events) ? r.events : []).slice(-LIMITS.events).map(sanitizeEvent),
  }
}

// ── building ─────────────────────────────────────────────────────────────────────────────────────────────────────
const ev = (c, e, at) => sanitizeClaim({ ...c, events: [...c.events, { ...e, at }] })
export function newClaim ({ claim = '', visibility = 'public', identity = '', scale = 10, conditions = {}, laws = [], id = null, at = Date.now() } = {}) {
  const c = sanitizeClaim({ id: id ?? makeId('claim'), claim, visibility, state: { identity: identity || claim, scale, conditions, laws, since: at }, events: [] })
  return ev(c, { type: 'created', subject: c.id, to: c.state.identity, reason: 'created' }, at)
}
export function addTestimony (c, t, { at = Date.now() } = {}) {
  const claim = sanitizeClaim(c); if (claim.testimonies.length >= LIMITS.testimonies) throw new Error('this claim already has ' + LIMITS.testimonies + ' testimonies')
  const s = sanitizeTestimony({ ...(isObj(t) ? t : {}), id: cleanId(t?.id) || makeId('t'), at: t?.at ?? at, truthType: 'personal' })
  if (claim.testimonies.some(x => x.id === s.id)) s.id = makeId('t')
  return ev({ ...claim, testimonies: [...claim.testimonies, s] }, { type: 'testimony', subject: s.id, to: s.verdict, reason: s.entity.kind + (s.entity.id ? ' ' + s.entity.id : '') }, at)
}
export function setScale (c, n) { const claim = sanitizeClaim(c); return sanitizeClaim({ ...claim, state: { ...claim.state, scale: n } }) }
/** Change the conditions (add a lime): the old state is CLOSED (until = at) and kept; a new state begins. */
export function setState (c, changes = {}, reason = '', { at = Date.now() } = {}) {
  const claim = sanitizeClaim(c); const prev = claim.state; const ch = isObj(changes) ? changes : {}
  const next = sanitizeState({ identity: ch.identity ?? prev.identity, scale: ch.scale ?? prev.scale, conditions: { ...prev.conditions, ...(isObj(ch.conditions) ? ch.conditions : {}) }, laws: ch.laws ?? prev.laws, since: at })
  const closed = { ...prev, until: at }
  return ev({ ...claim, state: next, stateHistory: [...claim.stateHistory, closed].slice(-LIMITS.states) }, { type: 'state', subject: claim.id, from: prev.identity, to: next.identity, reason }, at)
}
export function addUnknown (c, layer, textValue, by = '', { at = Date.now() } = {}) {
  const l = pick(layer, ['known_unknown', 'unknown_unknown', 'declined'], null); if (!l) throw new Error('layer is known_unknown, unknown_unknown or declined')
  const claim = sanitizeClaim(c); const items = { ...claim.items, [l]: [...claim.items[l], { text: textValue, by, at }] }
  return ev({ ...claim, items }, { type: 'undefined-item', subject: l, to: text(textValue, 100), reason: by }, at)
}

// awareness: what a system can resolve (familiarity) and what it accepts once resolved (scope). identify() runs every awareness over a subject:
//   not familiar -> UNDEFINED (a known unknown, on the record)   familiar but not accepted -> BRANCH_SOURCE (declined: a branch reality is born, linked to the system that declined it)   else IDENTIFIED
export function addAwareness (c, a, { at = Date.now() } = {}) {
  const claim = sanitizeClaim(c); if (claim.awarenesses.length >= LIMITS.awarenesses) throw new Error('a claim holds ' + LIMITS.awarenesses + ' awarenesses')
  const aw = sanitizeAwareness({ ...(isObj(a) ? a : {}), id: cleanId(a?.id) || makeId('aw') }); if (claim.awarenesses.some(x => x.id === aw.id)) aw.id = makeId('aw')
  return ev({ ...claim, awarenesses: [...claim.awarenesses, aw] }, { type: 'awareness', subject: aw.id, to: aw.name, reason: aw.systemType }, at)
}
export function removeAwareness (c, id) { const claim = sanitizeClaim(c); return sanitizeClaim({ ...claim, awarenesses: claim.awarenesses.filter(a => a.id !== id) }) }
const awOf = (claim, id) => { const a = claim.awarenesses.find(x => x.id === id || x.name === id); if (!a) throw new Error('no awareness ' + id); return a }
function editAware (c, id, fn) { const claim = sanitizeClaim(c); const a = awOf(claim, id); return sanitizeClaim({ ...claim, awarenesses: claim.awarenesses.map(x => (x.id === a.id ? fn(x) : x)) }) }
export const becomeFamiliar = (c, id, subject) => editAware(c, id, a => ({ ...a, familiarity: [...a.familiarity, text(subject, 120)] }))
export const accept = (c, id, subject) => editAware(c, id, a => ({ ...a, scope: [...a.scope, text(subject, 120)] }))
export function identifyOne (aw, subject) { const s = text(subject, 120); if (!aw.familiarity.includes(s)) return 'undefined'; return aw.scope.includes(s) ? 'identified' : 'branch_source' }
export function identify (c, subject, { at = Date.now() } = {}) {
  let claim = sanitizeClaim(c); const subj = text(subject, 120); if (!subj) throw new Error('a subject is needed'); if (!claim.awarenesses.length) throw new Error('add an awareness first')
  const results = []
  for (const aw of claim.awarenesses) {
    const result = identifyOne(aw, subj); const reveals = aw.systemType === 'intentional' && result === 'branch_source'
    const outcome = { awareness: aw.id, subject: subj, result, revealsValues: reveals, at, effectiveness: null }; results.push(outcome)
    claim = sanitizeClaim({ ...claim, outcomes: [...claim.outcomes, outcome] })
    if (result === 'undefined') claim = addUnknown(claim, 'known_unknown', `${aw.name} cannot resolve "${subj}"`, aw.name, { at })
    if (result === 'branch_source') {
      claim = addUnknown(claim, 'declined', `${aw.name} declined "${subj}"${reveals ? ' (a choice: it reveals values)' : ''}`, aw.name, { at })
      if (!claim.branches.some(b => b.subject === subj && b.awareness === aw.id && (b.status === 'active' || b.status === 'dormant')) && claim.branches.length < LIMITS.branches) {
        const b = sanitizeBranch({ id: makeId('br'), subject: subj, awareness: aw.id, reason: 'declined by ' + aw.name, status: 'active', at, history: [{ at, from: '', to: 'active', reason: 'declined by ' + aw.name }] })
        claim = ev({ ...claim, branches: [...claim.branches, b] }, { type: 'branch', subject: b.id, to: 'active', reason: b.reason }, at)
      }
    }
  }
  return { claim, results }
}
/** Later verification scores how effective an awareness was on a subject. */
export function scoreEffectiveness (c, awarenessId, subject, score) { const claim = sanitizeClaim(c); const a = awOf(claim, awarenessId); const s = clamp(num(score, 0), 0, 1); return sanitizeClaim({ ...claim, outcomes: claim.outcomes.map(o => (o.awareness === a.id && o.subject === text(subject, 120) ? { ...o, effectiveness: s } : o)) }) }
export const classifyOutcomes = (c) => { const o = { identified: 0, undefined: 0, branch_source: 0 }; for (const x of sanitizeClaim(c).outcomes) o[x.result]++; return o }
export function setBranch (c, id, status, reason = '', { at = Date.now() } = {}) {
  const claim = sanitizeClaim(c); const b = claim.branches.find(x => x.id === id); if (!b) throw new Error('no branch ' + id); const st = pick(status, BRANCH_STATUS, null); if (!st) throw new Error('status: ' + BRANCH_STATUS.join(', '))
  let next = sanitizeClaim({ ...claim, branches: claim.branches.map(x => (x.id === id ? { ...x, status: st, history: [...x.history, { at, from: x.status, to: st, reason }].slice(-LIMITS.history) } : x)) })
  if (st === 'merged' && b.awareness && next.awarenesses.some(a => a.id === b.awareness)) next = accept(next, b.awareness, b.subject)   // the rejecting system widens its scope and accepts what grew
  return ev(next, { type: 'branch', subject: id, from: b.status, to: st, reason }, at)
}
export function growBranch (c, id, nodeId) { const claim = sanitizeClaim(c); if (!claim.branches.some(b => b.id === id)) throw new Error('no branch ' + id); return sanitizeClaim({ ...claim, branches: claim.branches.map(b => (b.id === id ? { ...b, nodes: [...b.nodes, nodeId] } : b)) }) }

// ── shares at a scale ────────────────────────────────────────────────────────────────────────────────────────────
/**
 * The heart: cut the extent into n cells and judge each. Returns { scale, truth, false, undefined (shares that sum to 1), layers (shares of the
 * undefined part by cause), cells ('t' | 'f' | 'u:<layer>' per cell) }.  opts.conflictTolerance (0..0.5): a verdict that has this little of the weight
 * in a cell is outvoted instead of making the cell a conflict (default 0: any disagreement is a conflict).
 */
export function sharesAt (c, n = null, { conflictTolerance = 0 } = {}) {
  const claim = sanitizeClaim(c); const N = clamp(Math.round(n ?? claim.state.scale), 1, LIMITS.maxScale); const w = 1 / N; const tol = clamp(num(conflictTolerance, 0), 0, 0.5)
  const cells = new Array(N); const cnt = { t: 0, f: 0, conflict: 0, absence: 0, mixed: 0, known_unknown: 0 }
  const T = claim.testimonies
  for (let i = 0; i < N; i++) {
    const lo = i * w; const hi = lo + w
    let Wt = 0; let Wf = 0; let Wu = 0; let partialT = false; let partialF = false; let overlapBlind = false; let coverCount = 0
    for (const t of T) {
      const [a, b] = t.region; if (b <= lo + EPS || a >= hi - EPS) continue          // does not touch this cell
      if (t.entity.resolution > w + EPS) { overlapBlind = true; continue }            // its entity could not see a cell this small
      if (a <= lo + EPS && b >= hi - EPS) { coverCount++; if (t.verdict === 'true') Wt += t.weight; else if (t.verdict === 'false') Wf += t.weight; else Wu += t.weight } else if (t.verdict === 'true') partialT = true; else if (t.verdict === 'false') partialF = true
    }
    let v = null; let layer = null
    const tw = Wt + Wf
    if (tw > 0) {
      if (Wt > 0 && Wf > 0) { const minor = Math.min(Wt, Wf) / tw; if (minor > tol) layer = 'conflict'; else v = Wt > Wf ? 't' : 'f' } else v = Wt > 0 ? 't' : 'f'
      if (v && ((v === 't' && partialF) || (v === 'f' && partialT))) { v = null; layer = 'mixed' }   // a boundary lies inside this cell
    } else if (Wu > 0) layer = 'known_unknown'
    else if (partialT || partialF) layer = 'mixed'
    else layer = overlapBlind ? 'known_unknown' : 'absence'
    if (v) { cells[i] = v; cnt[v]++ } else { cells[i] = 'u:' + layer; cnt[layer]++ }
  }
  const u = cnt.conflict + cnt.absence + cnt.mixed + cnt.known_unknown
  const layers = {}; for (const k of ['conflict', 'absence', 'mixed', 'known_unknown']) layers[k] = round(cnt[k] / N)
  return { scale: N, truth: round(cnt.t / N), false: round(cnt.f / N), undefined: round(u / N), layers, cells }
}
/** The shares at a list of scales: the curve the OmniCell chart draws. */
export function curve (c, scales = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024]) {
  return (Array.isArray(scales) ? scales : []).slice(0, 40).map(n => { const s = sharesAt(c, n); return { scale: s.scale, truth: s.truth, false: s.false, undefined: s.undefined } })
}
/** Objective = nothing undefined at this scale AND the identity begins with at least one Law. */
export function isObjective (c, n = null) { const claim = sanitizeClaim(c); return sharesAt(claim, n).undefined < EPS && claim.state.laws.length > 0 }
/** Blended colour of the shares (the objective palette once objective). */
export function colorOf (c, n = null) {
  const claim = sanitizeClaim(c); const s = sharesAt(claim, n); const obj = s.undefined < EPS && claim.state.laws.length > 0
  const P = obj ? [NODE_COLOR.objectiveTruth, NODE_COLOR.objectiveFalse, NODE_COLOR.objectiveUndefined] : [NODE_COLOR.truth, NODE_COLOR.false, NODE_COLOR.undefined]
  const sh = [s.truth, s.false, s.undefined]; const rgb = [0, 1, 2].map(i => Math.round(P[0][i] * sh[0] + P[1][i] * sh[1] + P[2][i] * sh[2]))
  return { rgb, css: `rgb(${rgb.join(', ')})`, hex: '#' + rgb.map(x => x.toString(16).padStart(2, '0')).join(''), objective: obj }
}

// ── evidence quality and promotion ───────────────────────────────────────────────────────────────────────────────
export function independence (c) { const T = sanitizeClaim(c).testimonies; return T.length ? new Set(T.map(t => t.sourceKey)).size / T.length : 0 }
export function conditionDiversity (c) { const T = sanitizeClaim(c).testimonies; return T.length ? new Set(T.map(t => JSON.stringify(t.conditions))).size / T.length : 0 }
const groupStats = (T) => ({ n: T.length, independence: T.length ? new Set(T.map(t => t.sourceKey)).size / T.length : 0, diversity: T.length ? new Set(T.map(t => JSON.stringify(t.conditions))).size / T.length : 0 })
/** Structural promotion test (not a head count): >= minCount accounts that agree, from independent sources, under diverse conditions. */
export function canPromote (c, { minCount = 2, minIndependence = 0.8, minDiversity = 0.5 } = {}) {
  const claim = sanitizeClaim(c); const out = {}
  for (const v of ['true', 'false']) { const g = claim.testimonies.filter(t => t.verdict === v && t.truthType === 'personal'); const s = groupStats(g); out[v] = { ...s, ok: s.n >= minCount && s.independence >= minIndependence && s.diversity >= minDiversity } }
  return out
}
/** Personal testimonies that pass the test become SUBJECTIVE truth. */
export function promote (c, opts = {}, { at = Date.now() } = {}) {
  let claim = sanitizeClaim(c); const can = canPromote(claim, opts); let n = 0
  const T = claim.testimonies.map(t => { if (t.truthType === 'personal' && (t.verdict === 'true' || t.verdict === 'false') && can[t.verdict].ok) { n++; return { ...t, truthType: 'subjective' } } return t })
  claim = sanitizeClaim({ ...claim, testimonies: T })
  return n ? ev(claim, { type: 'promote', subject: claim.id, from: 'personal', to: 'subjective', reason: n + ' testimonies' }, at) : claim
}
export function stageTheory (c, statement, supportIds = [], { at = Date.now() } = {}) {
  const claim = sanitizeClaim(c); if (claim.theories.length >= LIMITS.theories) throw new Error('too many theories')
  const known = new Set(claim.testimonies.map(t => t.id)); const support = (Array.isArray(supportIds) ? supportIds : []).filter(i => known.has(i))
  const th = sanitizeTheory({ id: makeId('th'), statement, support, status: 'staged', stagedAt: at }); if (!th.statement) throw new Error('a theory needs a statement')
  const T = claim.testimonies.map(t => (support.includes(t.id) && (t.truthType === 'subjective' || t.truthType === 'personal') ? { ...t, truthType: 'theory' } : t))
  return ev({ ...claim, theories: [...claim.theories, th], testimonies: T }, { type: 'theory', subject: th.id, to: 'staged', reason: th.statement.slice(0, 200) }, at)
}
export function resolveTheory (c, id, confirmed, reason = '', { at = Date.now() } = {}) {
  const claim = sanitizeClaim(c); const th = claim.theories.find(t => t.id === id); if (!th) throw new Error('no theory ' + id); if (th.status !== 'staged') throw new Error('that theory is already ' + th.status)
  const objective = confirmed && isObjective(claim)
  const T = claim.testimonies.map(t => (th.support.includes(t.id) ? { ...t, truthType: confirmed ? (objective ? 'objective' : 'theory') : 'subjective' } : t))   // rejected: kept, with its reason, back at subjective
  const theories = claim.theories.map(t => (t.id === id ? { ...t, status: confirmed ? 'confirmed' : 'rejected', reason, resolvedAt: at } : t))
  return ev({ ...claim, theories, testimonies: T }, { type: 'theory', subject: id, from: 'staged', to: confirmed ? 'confirmed' : 'rejected', reason }, at)
}

// ── reading it ───────────────────────────────────────────────────────────────────────────────────────────────────
/** Who said what: for each entity kind, how many accounts and their verdicts. The "clean distinction" a reader sees. */
export function byEntity (c) {
  const out = {}; for (const k of ENTITY_KINDS) out[k] = { accounts: 0, true: 0, false: 0, undefined: 0 }
  for (const t of sanitizeClaim(c).testimonies) { const o = out[t.entity.kind]; o.accounts++; o[t.verdict]++ }
  return out
}
/** Experience profile -> particle physics parameters (from the owner's file). */
export function physicsOf (exp) {
  const d = sanitizeExperience(exp)
  return { particleEnergy: d.intensity, velocity: d.tempo, jitter: round(d.tempo * d.intensity, 1e4), fieldOfView: 75 - d.focus * 45, attractorCount: Math.round(1 + d.noise * 9), gravity: round(d.weight * 9.8, 1e4), damping: d.weight, saturation: d.saturation }
}
export function pathOf (c, subjectId = null) { const E = sanitizeClaim(c).events; return subjectId ? E.filter(e => e.subject === subjectId) : E }
/** Everything the OmniCell chart needs, in one plain object. */
export function chartData (c, n = null) {
  const claim = sanitizeClaim(c); const s = sharesAt(claim, n); const col = colorOf(claim, n)
  const breakdown = { personal: 0, subjective: 0, theory: 0, objective: 0 }; for (const t of claim.testimonies) breakdown[t.truthType]++
  return { id: claim.id, claim: claim.claim, visibility: claim.visibility, identity: claim.state.identity, scale: s.scale, conditions: claim.state.conditions, laws: claim.state.laws,
    shares: { truth: s.truth, false: s.false, undefined: s.undefined }, undefinedBy: s.layers, cells: s.cells, color: col, objective: col.objective, curve: curve(claim),
    accounts: claim.testimonies.length, independence: round(independence(claim), 1e4), conditionDiversity: round(conditionDiversity(claim), 1e4), truthTypes: breakdown, entities: byEntity(claim),
    theories: claim.theories.map(t => ({ id: t.id, statement: t.statement, status: t.status })), states: claim.stateHistory.length + 1,
    awarenesses: claim.awarenesses.map(a => ({ id: a.id, name: a.name, systemType: a.systemType })), outcomes: classifyOutcomes(claim), branches: claim.branches.map(b => ({ id: b.id, subject: b.subject, status: b.status, nodes: b.nodes.length })) }
}
export default { sanitizeClaim, newClaim, addTestimony, setState, setScale, addUnknown, sharesAt, curve, isObjective, colorOf, independence, conditionDiversity, canPromote, promote, stageTheory, resolveTheory, byEntity, physicsOf, pathOf, chartData }
