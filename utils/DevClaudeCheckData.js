/**
 * utils/DevClaudeCheckData.js — the model behind the Claude Check panel (V184). DEV ONLY: for the developer and Claude.
 *
 * CONVENTION: Dev* modules are dev-only; no user-facing module may import this file (a static test enforces it).
 * Pure: no DOM, no Three. The only environment it touches is `localStorage` (try/catch everywhere) and, to announce changes,
 * `window.dispatchEvent` (guarded).
 *
 * Two kinds of data:
 *   1. The ITERATION DATA, bundled in data/ClaudeCheckData.js (GENERATED per version by tools/build-claude-check.mjs from
 *      docs/dev/Roles/Developer/TestingChecklist.json + ClaudeCheckAsk.json). Treated as untrusted anyway: validateData() copies
 *      only known, length-capped, correctly typed fields and drops the rest (never throws).
 *   2. The USER STATE, localStorage 'omni:claude-check-v1' (max ~200 KB): per version
 *        { results:{ checkId:{ r:'pass'|'fail'|'skip', note?, at, snap? } }, answers:{ askId:value }, message, attachState }
 *      `snap` ({c,f,h,w} = category, feature, howToReach, whatToCheck, each capped) is kept ONLY on fail / skip results, so an
 *      item that is carried into a later version can still be shown after the old data file is gone.
 *
 * CARRY-OVER RULE (decided with the user): when the bundled version differs from a stored version, that stored version's
 * 'fail' and 'skip' results are listed in "Carried over" above the new checks; 'pass' results drop out of the list (they stay in
 * the stored history, which is capped to the last 3 versions). Matching across versions is by check id. For one id the NEWEST
 * version that has a result for it decides (the current version first), so a later pass retires an older fail.
 *
 * Events: omni:claude-check-changed {version, counts}
 */

import BUNDLED from '../data/ClaudeCheckData.js'

export const STORAGE_KEY = 'omni:claude-check-v1'
export const STATE_VERSION = 1
export const DATA_SCHEMA = 'omni-claude-check/1'
export const REPORT_SCHEMA = 'omni-claude-report/1'
export const CHANGED_EVENT = 'omni:claude-check-changed'
export const KEEP_VERSIONS = 3
export const PRIORITIES = ['high', 'normal', 'low']
export const DEVICES = ['any', 'desktop', 'phone', 'touch', 'gpu']
export const KINDS = ['text', 'yesno', 'choice', 'number']
export const RESULTS = ['pass', 'fail', 'skip']
export const LIMITS = {
  stateChars: 200000, checks: 400, asks: 40, issues: 30, choices: 12,
  id: 96, version: 16, summary: 240, category: 100, feature: 160, howToReach: 320, whatToCheck: 700, question: 300, why: 300, choice: 60, issue: 300,
  note: 300, message: 4000, answerText: 500, ua: 200,
}

const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:~-]{0,95}$/
const VER_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,15}$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const clean = (v, max) => (typeof v === 'string' ? v : (typeof v === 'number' && Number.isFinite(v) ? String(v) : '')).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max)
const isObj = (o) => !!o && typeof o === 'object' && !Array.isArray(o)

// ── Iteration data ──────────────────────────────────────────────────────────────

/**
 * Validate (copy) the iteration data. Never throws. Returns { ok, data, errors }.
 * ok=false only when the whole file is unusable (not an object, wrong schema, no usable version). Single bad items are dropped and listed in `errors`.
 */
export function validateData (raw) {
  const errors = []
  const empty = { schema: DATA_SCHEMA, version: '', date: '', summary: '', checks: [], asks: [], knownIssues: [] }
  if (!isObj(raw)) return { ok: false, data: empty, errors: ['data is not an object'] }
  if (raw.schema !== DATA_SCHEMA) return { ok: false, data: empty, errors: [`schema must be "${DATA_SCHEMA}"`] }
  const version = clean(raw.version, LIMITS.version)
  if (!VER_RE.test(version)) return { ok: false, data: empty, errors: ['version is missing or malformed'] }
  const date = clean(raw.date, 10)
  const data = { schema: DATA_SCHEMA, version, date: DATE_RE.test(date) ? date : '', summary: clean(raw.summary, LIMITS.summary), checks: [], asks: [], knownIssues: [] }
  if (!data.date) errors.push('date should be YYYY-MM-DD')
  const seen = new Set()
  ;(Array.isArray(raw.checks) ? raw.checks : []).slice(0, LIMITS.checks).forEach((c, i) => {
    if (!isObj(c)) { errors.push(`checks[${i}]: not an object`); return }
    const id = clean(c.id, LIMITS.id)
    if (!ID_RE.test(id)) { errors.push(`checks[${i}]: bad id`); return }
    if (seen.has(id)) { errors.push(`checks[${i}]: duplicate id ${id}`); return }
    const feature = clean(c.feature, LIMITS.feature)
    if (!feature) { errors.push(`checks[${i}]: no feature`); return }
    seen.add(id)
    data.checks.push({
      id, category: clean(c.category, LIMITS.category) || 'General', feature, howToReach: clean(c.howToReach, LIMITS.howToReach), whatToCheck: clean(c.whatToCheck, LIMITS.whatToCheck),
      priority: PRIORITIES.includes(c.priority) ? c.priority : 'normal', device: DEVICES.includes(c.device) ? c.device : 'any',
    })
  })
  const seenA = new Set()
  ;(Array.isArray(raw.asks) ? raw.asks : []).slice(0, LIMITS.asks).forEach((a, i) => {
    if (!isObj(a)) { errors.push(`asks[${i}]: not an object`); return }
    const id = clean(a.id, LIMITS.id)
    if (!ID_RE.test(id) || seenA.has(id)) { errors.push(`asks[${i}]: bad or duplicate id`); return }
    const question = clean(a.question, LIMITS.question)
    if (!question || !KINDS.includes(a.kind)) { errors.push(`asks[${i}]: needs a question and a kind (${KINDS.join('|')})`); return }
    const ask = { id, question, why: clean(a.why, LIMITS.why), kind: a.kind, device: DEVICES.includes(a.device) ? a.device : 'any' }
    if (a.kind === 'choice') {
      ask.choices = (Array.isArray(a.choices) ? a.choices : []).slice(0, LIMITS.choices).map(x => clean(x, LIMITS.choice)).filter((x, j, arr) => x && arr.indexOf(x) === j)
      if (ask.choices.length < 2) { errors.push(`asks[${i}]: a choice needs at least 2 choices`); return }
    }
    seenA.add(id); data.asks.push(ask)
  })
  data.knownIssues = (Array.isArray(raw.knownIssues) ? raw.knownIssues : []).slice(0, LIMITS.issues).map(x => clean(x, LIMITS.issue)).filter(Boolean)
  return { ok: true, data, errors }
}

let source = BUNDLED
let validated = null
/** The validated iteration data (the bundled file unless a test replaced it with setSource). Never null. */
export function getData () { if (!validated) validated = validateData(source); return validated.data }
export function getDataErrors () { getData(); return validated.errors.slice() }
export function isDataOk () { getData(); return validated.ok }
/** Replace the data source (tests, or a future paste-in). `undefined` restores the bundled file. */
export function setSource (raw) { source = raw === undefined ? BUNDLED : raw; validated = null; return getData() }

// ── User state ──────────────────────────────────────────────────────────────────

let S = null
let loaded = false
const blankVersion = () => ({ results: {}, answers: {}, message: '', attachState: false })
const fresh = () => ({ v: STATE_VERSION, order: [], versions: {}, ui: { filter: 'all', hideDone: false } })

const emit = () => {
  try { window.dispatchEvent(new CustomEvent(CHANGED_EVENT, { detail: { version: getData().version, counts: getCounts() } })) } catch (_) { /* no window */ }
}

function sanitizeResult (r) {
  if (!isObj(r) || !RESULTS.includes(r.r)) return null
  const out = { r: r.r, at: typeof r.at === 'string' && r.at.length <= 40 ? r.at : '' }
  const note = clean(r.note, LIMITS.note); if (note) out.note = note
  if (r.r !== 'pass' && isObj(r.snap)) {
    const s = { c: clean(r.snap.c, LIMITS.category), f: clean(r.snap.f, LIMITS.feature), h: clean(r.snap.h, LIMITS.howToReach), w: clean(r.snap.w, LIMITS.whatToCheck) }
    if (s.f) out.snap = s
  }
  return out
}

/** Check one answer against its ask. Returns the clean value or undefined (invalid -> treated as "no answer"). */
export function cleanAnswer (ask, v) {
  if (!ask) return undefined
  if (ask.kind === 'text') { const t = clean(v, LIMITS.answerText); return t || undefined }
  if (ask.kind === 'yesno') return v === 'yes' || v === 'no' ? v : undefined
  if (ask.kind === 'choice') return typeof v === 'string' && (ask.choices ?? []).includes(v) ? v : undefined
  if (ask.kind === 'number') { if (v === '' || v === null || typeof v === 'boolean') return undefined; const n = Number(v); return Number.isFinite(n) && Math.abs(n) <= 1e9 ? n : undefined }
  return undefined
}

function sanitizeVersion (raw, asks = null) {
  const v = blankVersion()
  if (!isObj(raw)) return v
  if (isObj(raw.results)) {
    Object.keys(raw.results).slice(0, 1000).forEach(id => { if (ID_RE.test(id)) { const r = sanitizeResult(raw.results[id]); if (r) v.results[id] = r } })
  }
  if (isObj(raw.answers)) {
    Object.keys(raw.answers).slice(0, 100).forEach(id => {
      if (!ID_RE.test(id)) return
      const ask = asks?.find(a => a.id === id)
      if (asks && !ask) return   // the current version knows its asks: an answer to an unknown ask is dropped
      const val = ask ? cleanAnswer(ask, raw.answers[id]) : (typeof raw.answers[id] === 'string' ? clean(raw.answers[id], LIMITS.answerText) : (typeof raw.answers[id] === 'number' && Number.isFinite(raw.answers[id]) ? raw.answers[id] : undefined))
      if (val !== undefined && val !== '') v.answers[id] = val
    })
  }
  v.message = typeof raw.message === 'string' ? clean(raw.message, LIMITS.message) : ''
  v.attachState = raw.attachState === true
  return v
}

/** (Re)load the state from localStorage. Corrupt / foreign / oversized data -> a fresh state (never throws). */
export function load () {
  loaded = true
  S = fresh()
  let raw = null
  try { raw = localStorage.getItem(STORAGE_KEY) } catch (_) { return S }
  if (!raw || raw.length > LIMITS.stateChars * 2) return S
  let d = null
  try { d = JSON.parse(raw) } catch (_) { return S }
  if (!isObj(d) || d.v !== STATE_VERSION || !isObj(d.versions)) return S
  const names = Object.keys(d.versions).filter(k => VER_RE.test(k))
  const order = (Array.isArray(d.order) ? d.order : []).filter(k => names.includes(k))
  names.forEach(k => { if (!order.includes(k)) order.push(k) })
  order.slice(-KEEP_VERSIONS - 1).forEach(k => {
    const asks = k === getData().version ? getData().asks : null
    S.versions[k] = sanitizeVersion(d.versions[k], asks); S.order.push(k)
  })
  if (isObj(d.ui)) { S.ui.filter = ['all', 'desktop', 'phone', 'touch', 'gpu'].includes(d.ui.filter) ? d.ui.filter : 'all'; S.ui.hideDone = d.ui.hideDone === true }
  return S
}
const ensure = () => { if (!loaded) load() }

/** Trim to KEEP_VERSIONS versions and to the size cap (drop the oldest version, then the oldest passes, then notes). */
export function enforceCaps () {
  ensure()
  const cur = getData().version
  while (S.order.length > KEEP_VERSIONS) { const old = S.order.find(k => k !== cur) ?? S.order[0]; delete S.versions[old]; S.order.splice(S.order.indexOf(old), 1) }
  let text = JSON.stringify(S)
  if (text.length <= LIMITS.stateChars) return text.length
  for (const k of S.order.filter(x => x !== cur)) {   // drop passes of older versions first
    Object.keys(S.versions[k].results).forEach(id => { if (S.versions[k].results[id].r === 'pass') delete S.versions[k].results[id] })
    if (JSON.stringify(S).length <= LIMITS.stateChars) return JSON.stringify(S).length
  }
  while (S.order.length > 1 && JSON.stringify(S).length > LIMITS.stateChars) { const old = S.order.find(k => k !== cur) ?? S.order[0]; delete S.versions[old]; S.order.splice(S.order.indexOf(old), 1) }
  if (JSON.stringify(S).length > LIMITS.stateChars) {   // last resort: drop notes and snaps of the current version
    const v = S.versions[cur]
    if (v) { Object.values(v.results).forEach(r => { delete r.note; delete r.snap }); v.message = v.message.slice(0, 1000) }
  }
  return JSON.stringify(S).length
}

function persist () {
  if (!S) return false
  enforceCaps()
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(S)); return true } catch (_) { return false }   // memory only when storage is blocked / full
}

export function _reset (clear = false) {
  if (clear) { try { localStorage.removeItem(STORAGE_KEY) } catch (_) { /* ignore */ } }
  S = fresh(); loaded = true
}

function cur () {
  ensure()
  const ver = getData().version
  if (!S.versions[ver]) { S.versions[ver] = blankVersion(); S.order = S.order.filter(k => k !== ver); S.order.push(ver) }
  return S.versions[ver]
}
/** Read the current version's record without creating it. */
const peek = () => { ensure(); return S.versions[getData().version] ?? blankVersion() }

export const getUi = () => { ensure(); return { ...S.ui } }
export function setUi (patch) {
  ensure()
  if (patch && ['all', 'desktop', 'phone', 'touch', 'gpu'].includes(patch.filter)) S.ui.filter = patch.filter
  if (patch && typeof patch.hideDone === 'boolean') S.ui.hideDone = patch.hideDone
  persist()
  return { ...S.ui }
}

/** All ids the user may mark: this version's checks plus carried ones. */
export function setResult (id, r, note) {
  ensure()
  if (typeof id !== 'string' || !ID_RE.test(id)) return null
  const rec = cur()
  if (r === null || r === undefined || r === '') { delete rec.results[id]; persist(); emit(); return null }
  if (!RESULTS.includes(r)) return null
  const item = findItem(id)
  if (!item) return null
  const prev = rec.results[id]
  const out = { r, at: new Date().toISOString() }
  const n = clean(note !== undefined ? note : prev?.note, LIMITS.note); if (n) out.note = n
  if (r !== 'pass') out.snap = { c: item.category ?? '', f: item.feature, h: item.howToReach ?? '', w: item.whatToCheck ?? '' }
  rec.results[id] = sanitizeResult(out)
  persist(); emit()
  return { ...rec.results[id] }
}
export function setNote (id, note) {
  ensure()
  const rec = cur(); const r = rec.results[id]
  if (!r) return false
  const n = clean(note, LIMITS.note)
  if (n) r.note = n; else delete r.note
  persist(); emit()
  return true
}
export const getResult = (id) => { const r = peek().results[id]; return r ? { ...r } : null }

export function setAnswer (askId, value) {
  ensure()
  const ask = getData().asks.find(a => a.id === askId)
  if (!ask) return undefined
  const rec = cur(); const v = cleanAnswer(ask, value)
  if (v === undefined) delete rec.answers[askId]; else rec.answers[askId] = v
  persist(); emit()
  return v
}
export const getAnswers = () => ({ ...peek().answers })
export function setMessage (t) { ensure(); cur().message = clean(t, LIMITS.message); persist(); return cur().message }
export const getMessage = () => peek().message
export function setAttach (on) { ensure(); cur().attachState = on === true; persist(); return cur().attachState }
export const getAttach = () => peek().attachState
export function resetVersion () { ensure(); const ver = getData().version; delete S.versions[ver]; S.order = S.order.filter(k => k !== ver); persist(); emit() }

// ── Derived lists ───────────────────────────────────────────────────────────────

/**
 * Items carried over from earlier versions. For one id the newest version with a result decides (the current version first);
 * it is carried when that result is fail / skip. Each: { id, category, feature, howToReach, whatToCheck, priority, device, from, prior:'fail'|'skip', priorNote }.
 * An id that is also one of the current checks is not listed twice: the current check shows a "carried" tag instead (see tagFor).
 */
export function getCarried () {
  ensure()
  const data = getData(); const ver = data.version
  const have = new Set(data.checks.map(c => c.id))
  const decided = new Set(Object.keys(S.versions[ver]?.results ?? {}))   // the current version already has a result for these
  const out = []
  const older = S.order.filter(k => k !== ver).reverse()   // newest first
  const carriedIds = new Set()
  for (const k of older) {
    const res = S.versions[k]?.results ?? {}
    for (const id of Object.keys(res)) {
      if (carriedIds.has(id)) continue
      carriedIds.add(id)
      const r = res[id]
      if (r.r === 'pass') continue
      const snap = r.snap ?? { c: '', f: id, h: '', w: '' }
      out.push({ id, category: snap.c || 'Earlier versions', feature: snap.f || id, howToReach: snap.h, whatToCheck: snap.w, priority: 'high', device: 'any', from: k, prior: r.r, priorNote: r.note ?? '', inChecks: have.has(id), resolved: decided.has(id) })
    }
  }
  return out
}
/** Carried ids that are also this version's checks: tag text like "failed in V183", else ''. */
export function tagFor (id) { const c = getCarried().find(x => x.id === id && x.inChecks); return c ? `${c.prior === 'fail' ? 'failed' : 'skipped'} in ${c.from}` : '' }
/** Carried items that are NOT in this version's checks (these form the "Carried over" section). */
export const getCarriedOnly = () => getCarried().filter(c => !c.inChecks)

function findItem (id) {
  return getData().checks.find(c => c.id === id) ?? getCarried().find(c => c.id === id) ?? null
}

/** Does an item/ask with `device` show under filter `f`? 'any' always shows; the 'all' filter shows everything. */
export function deviceVisible (device, f) { return f === 'all' || !f || device === 'any' || device === f }

/** Counts over this version's checks + the carried-only items (current-version results only). */
export function getCounts () {
  ensure()
  const data = getData(); const res = peek().results
  const items = [...data.checks.map(c => c.id), ...getCarriedOnly().map(c => c.id)]
  let pass = 0; let fail = 0; let skip = 0
  items.forEach(id => { const r = res[id]?.r; if (r === 'pass') pass++; else if (r === 'fail') fail++; else if (r === 'skip') skip++ })
  const carriedFailing = getCarriedOnly().filter(c => !res[c.id] && c.prior === 'fail').length
  return { total: items.length, pass, fail, skip, unchecked: items.length - pass - fail - skip, carried: getCarriedOnly().length, openFailures: fail + carriedFailing }
}

// ── Report ──────────────────────────────────────────────────────────────────────

/**
 * ONE compact JSON object for Claude. Unchecked items are ids only (no text). `device` and `state` come from the caller (DOM facts).
 * {schema:'omni-claude-report/1', version, date, device, summary, failed:[{id,feature,note}], skipped:[...], passed:[ids], unchecked:[ids], carried:[...], answers, message, state?, stateSource?}
 */
export function buildReport ({ device = null, state = null, stateSource = null } = {}) {
  ensure()
  const data = getData(); const rec = peek(); const res = rec.results
  const feat = new Map(data.checks.map(c => [c.id, c.feature])); getCarriedOnly().forEach(c => feat.set(c.id, c.feature))
  const ids = [...data.checks.map(c => c.id), ...getCarriedOnly().map(c => c.id)]
  const failed = []; const skipped = []; const passed = []; const unchecked = []
  ids.forEach(id => {
    const r = res[id]
    if (!r) unchecked.push(id)
    else if (r.r === 'pass') passed.push(id)
    else (r.r === 'fail' ? failed : skipped).push(r.note ? { id, feature: feat.get(id) ?? id, note: r.note } : { id, feature: feat.get(id) ?? id })
  })
  const dev = isObj(device) ? { ua: clean(device.ua, LIMITS.ua), w: +device.w || 0, h: +device.h || 0, dpr: +device.dpr || 1, touch: device.touch === true } : { ua: '', w: 0, h: 0, dpr: 1, touch: false }
  const rep = {
    schema: REPORT_SCHEMA, version: data.version, date: data.date, device: dev,
    summary: { pass: passed.length, fail: failed.length, skip: skipped.length, unchecked: unchecked.length },
    failed, skipped, passed, unchecked,
    carried: getCarriedOnly().map(c => ({ id: c.id, from: c.from, prior: c.prior, now: res[c.id]?.r ?? null, ...(c.priorNote ? { note: c.priorNote } : {}) })),
    answers: { ...rec.answers }, message: rec.message,
  }
  if (rec.attachState && state) { rep.state = state; rep.stateSource = stateSource || 'unknown' }
  return rep
}
export const reportText = (opts) => JSON.stringify(buildReport(opts))

/** The minimal own dump used when the Dev store dump facility is not reachable. Pure (the caller passes the facts). */
export function minimalDump ({ userAgent = '', viewport = null, devicePixelRatio = 1, storeActive = null, counts = null } = {}) {
  return { version: getData().version, userAgent: clean(userAgent, LIMITS.ua), viewport, devicePixelRatio, storeActive, counts }
}
