/**
 * utils/OmniValueModel.js — ⟐OmniValue sandbox: value types, pairwise conversion edges, per-type ledger (V176)
 *
 * SANDBOX ONLY. Every number here is fake: no real money, no real payments, no network. Settlement is simulated
 * instantly. See docs/omniproducts/OMNIVALUE_DESIGN.md ("What is now real (V176, sandbox only)") and
 * docs/omniproducts/OMNIVALUE_STORE_EXCHANGE_BUILD.md.
 *
 * No DOM; event driven; persisted at localStorage 'omni:value-v1' (versioned, try/catch, bounded).
 *
 * THE MODEL (OmniValeux protocol, as far as V176 builds it)
 *   Value types     {id, name, tier, unit, step, emoji, payable, qualityScale:[{id,label,weight}], refQuality,
 *                    channels:[{id,name,feePct,settleHours}]}. Tier = primary | secondary | tertiary | quaternary | quinary.
 *                    There is NO global/default currency: nothing here ever sums two different types into one number.
 *   Conversion edges {id, fromType, toType, rateNum, rateDen, minQty, qualityRule, owner}. PAIRWISE and directional:
 *                    `fromQty * rateNum / rateDen` of toType per `fromQty` of fromType (3 fruit -> 1 credit is
 *                    rateNum 1, rateDen 3). Several edges (methods) between the same pair are allowed, and `quote()` also
 *                    finds indirect routes through up to two intermediate types. qualityRule null | {minWeight}.
 *                    owner null = system sandbox edge; an account id = only usable when that account is a party.
 *   Quality         every type has a GRADED SCALE (Poor..Mint, Underripe..Spoiled, ...). A grade's `weight` multiplies the
 *                    quantity: 3 Excellent (1.25) = 3.75 reference units. The assessment method is an OPEN QUESTION
 *                    (OMNIVALUE_DESIGN.md): for now every grade is SELF-REPORTED (type.assessment === 'self-reported').
 *   Accounts        per identity id (utils/OmniIdentity.js active identity, else 'sandbox-user'): balances PER TYPE (never
 *                    merged), a REMAINDER ledger PER TYPE, an item inventory, a transaction log.
 *   Remainder       STATED, not rounded away: when an offer covers more than the want, the surplus is written as a literal
 *                    line and recorded in the payer's remainder ledger for the want's type. The account decides what to do
 *                    with it later (`quote(..., {applyRemainder:true})` or `claimRemainder()`).
 *   Intent          Desire() forward declaration only: every executed trade stores declaredIntent {note,t} and fires
 *                    utils/DesirePrimaryForce.js declareDesire(). The backward PrimaryForce() pattern and the affidavit
 *                    are NOT built (hooks only); the system renders no verdict.
 *
 * Events (window): omni:value-changed {kind}, omni:value-trade {tx}.
 */

import { getActiveIdentity } from './OmniIdentity.js'
import { declareDesire } from './DesirePrimaryForce.js'

export const STORAGE_KEY = 'omni:value-v1'
export const VERSION = 1
export const SANDBOX_ACCOUNT = 'sandbox-user'
export const TIERS = ['primary', 'secondary', 'tertiary', 'quaternary', 'quinary']
export const CHANGED_EVENT = 'omni:value-changed'
export const TRADE_EVENT = 'omni:value-trade'
export const EPS = 1e-9
export const LIMITS = { types: 64, edges: 256, channels: 12, scale: 12, log: 200, remainderEntries: 50, accounts: 16, inventory: 200, qty: 1e9, maxPathEdges: 3, note: 280 }

// ── Quality scales (graded, per value type) ─────────────────────────────────────

const q = (id, label, weight) => ({ id, label, weight })
export const SCALES = {
  condition: [q('poor', 'Poor', 0.5), q('fair', 'Fair', 0.75), q('good', 'Good', 1), q('excellent', 'Excellent', 1.25), q('mint', 'Mint', 1.5)],
  ripeness:  [q('underripe', 'Underripe', 0.7), q('ripe', 'Ripe', 1), q('overripe', 'Overripe', 0.6), q('spoiled', 'Spoiled', 0.1)],
  freshness: [q('wilted', 'Wilted', 0.4), q('fresh', 'Fresh', 1), q('vibrant', 'Vibrant', 1.3), q('perfect', 'Perfect', 1.6)],
  skill:     [q('novice', 'Novice', 0.6), q('skilled', 'Skilled', 1), q('expert', 'Expert', 1.6), q('master', 'Master', 2.4)],
  flat:      [q('standard', 'Standard', 1)],
}
export const SCALE_REF = { condition: 'good', ripeness: 'ripe', freshness: 'fresh', skill: 'skilled', flat: 'standard' }
export const QUALITY_ASSESSMENT = 'self-reported'   // OPEN QUESTION: self-reported / inspected by another OmniPlayer / other

const ch = (id, name, feePct, settleHours) => ({ id, name, feePct, settleHours })
const mkType = (id, name, tier, unit, step, emoji, scale, channels, extra = {}) => ({
  id, name, tier, unit, step, emoji, payable: true, builtin: true, assessment: QUALITY_ASSESSMENT,
  qualityScale: SCALES[scale].map(s => ({ ...s })), refQuality: SCALE_REF[scale], channels, ...extra,
})

export function defaultTypes () {
  return [
    mkType('credits', 'Credits', 'primary', 'cr', 0.01, '🪙', 'condition', [
      ch('venmo-sim', 'Venmo (sim)', 1.5, 0.1), ch('bank-sim', 'Bank (sim)', 0.5, 24), ch('cash', 'Cash', 0, 0), ch('cashapp-sim', 'Cash-app vehicle (sim)', 1, 0.5)]),
    mkType('usd', 'USD (sim)', 'primary', '$', 0.01, '💵', 'condition', [
      ch('venmo-sim', 'Venmo (sim)', 1.5, 0.1), ch('bank-sim', 'Bank (sim)', 0.5, 24), ch('cash', 'Cash', 0, 0), ch('card-sim', 'Card (sim)', 2.9, 48)]),
    mkType('bells', 'Bells', 'secondary', 'bells', 1, '🔔', 'condition', [ch('hand-off', 'Hand-off', 0, 0)]),
    mkType('nook', 'Nook Tickets', 'secondary', 'tickets', 1, '🎫', 'condition', [ch('hand-off', 'Hand-off', 0, 0)]),
    mkType('gold', 'Gold', 'secondary', 'gold', 0.5, '🥇', 'condition', [ch('hand-off', 'Hand-off', 0, 0), ch('vault-sim', 'Vault (sim)', 0.5, 12)]),
    mkType('flowers', 'Flowers', 'secondary', 'flowers', 1, '🌸', 'freshness', [ch('hand-off', 'Hand-off', 0, 0)]),
    mkType('hours', 'Service-hours', 'secondary', 'h', 0.5, '🛠', 'skill', [ch('in-person', 'In person', 0, 0), ch('remote', 'Remote', 0, 1)]),
    mkType('produce', 'Produce (catalog items)', 'secondary', 'item', 1, '🧺', 'ripeness', [ch('hand-off', 'Hand-off', 0, 0)], { payable: false }),
    mkType('reputation', 'Reputation', 'quaternary', 'rep', 1, '⭐', 'flat', [ch('attest', 'Attestation', 0, 0)], { payable: false }),
    mkType('access', 'Access Tokens', 'quinary', 'tokens', 1, '🗝', 'flat', [ch('grant', 'Grant', 0, 0)]),
  ]
}

const edge = (id, fromType, toType, rateNum, rateDen, extra = {}) => ({ id, fromType, toType, rateNum, rateDen, minQty: 0, qualityRule: null, owner: null, builtin: true, ...extra })
export function defaultEdges () {
  return [
    edge('e-bells-credits', 'bells', 'credits', 1, 3),            // 3 bells -> 1 credit
    edge('e-credits-bells', 'credits', 'bells', 3, 1),
    edge('e-credits-usd', 'credits', 'usd', 1, 2),                // 2 credits -> 1 usd
    edge('e-usd-credits', 'usd', 'credits', 2, 1),
    edge('e-credits-gold', 'credits', 'gold', 1, 2),              // 2 credits -> 1 gold
    edge('e-gold-credits', 'gold', 'credits', 2, 1),
    edge('e-bells-gold-direct', 'bells', 'gold', 1, 7),           // a second, WORSE method on bells -> gold (the indirect route via credits is 6:1; quote() picks the best yield)
    edge('e-nook-credits', 'nook', 'credits', 2, 1),              // 1 ticket -> 2 credits
    edge('e-credits-nook', 'credits', 'nook', 1, 2),
    edge('e-flowers-credits', 'flowers', 'credits', 1, 2),        // 2 flowers -> 1 credit
    edge('e-credits-flowers', 'credits', 'flowers', 2, 1),
    edge('e-flowers-bells', 'flowers', 'bells', 3, 2, { minQty: 2 }),   // bundles of 2+ flowers only
    edge('e-hours-credits', 'hours', 'credits', 1, 1, { qualityRule: { minWeight: 1 } }),   // only Skilled-or-better hours convert
    edge('e-credits-hours', 'credits', 'hours', 1, 1),
    edge('e-hours-access', 'hours', 'access', 2, 1),              // 1 hour -> 2 access tokens (OMNIVALUE_DESIGN.md example)
    edge('e-produce-credits', 'produce', 'credits', 1, 3),        // 3 fruit -> 1 credit (design-doc example; produce is not `payable` in V176, so listed for the model only)
  ]
}

export const STARTER_BALANCES = { credits: 100, usd: 40, bells: 250, nook: 6, gold: 4, flowers: 12, hours: 6, reputation: 10, access: 2 }
export const STARTER_INVENTORY = { 'p-apple': 3, 'p-banana': 2, 'p-carrot': 4 }

// ── Small numeric helpers ───────────────────────────────────────────────────────

export const clean = (x) => Math.round(x * 1e9) / 1e9
const finite = (x) => typeof x === 'number' && Number.isFinite(x)
const ceilStep = (x, step) => { const s = step > 0 ? step : 1; return clean(Math.ceil(clean(x / s) - EPS) * s) }
const floorStep = (x, step) => { const s = step > 0 ? step : 1; return clean(Math.floor(clean(x / s) + EPS) * s) }
export function fmtQty (n) { return String(+(+n).toFixed(4)) }
const str = (v, max) => String(v ?? '').slice(0, max)
const idOk = (v) => typeof v === 'string' && /^[A-Za-z0-9_.:-]{1,64}$/.test(v)

// ── State ───────────────────────────────────────────────────────────────────────

let S = null            // { types, edges, accounts, accountOverride }
let loaded = false
let seq = 0
let persistDisabled = false

function emitChanged (kind) {
  try { window.dispatchEvent(new CustomEvent(CHANGED_EVENT, { detail: { kind } })) } catch (_) { /* no window in a bare node run */ }
}

function freshState () {
  return { types: defaultTypes(), edges: defaultEdges(), accounts: {}, accountOverride: null }
}

function ensureLoaded () { if (!loaded) load() }

/** Read localStorage into memory (sanitised). Called lazily; safe to call again to re-read. */
export function load () {
  loaded = true
  S = freshState()
  let raw = null
  try { raw = localStorage.getItem(STORAGE_KEY) } catch (_) { return S }
  if (!raw) return S
  let data = null
  try { data = JSON.parse(raw) } catch (_) { return S }
  if (!data || typeof data !== 'object' || data.version !== VERSION) return S
  const types = (Array.isArray(data.types) ? data.types : []).slice(0, LIMITS.types).map(sanitizeType).filter(Boolean)
  const seen = new Set()
  const uniq = types.filter(t => (seen.has(t.id) ? false : (seen.add(t.id), true)))
  if (uniq.length) S.types = uniq
  const tids = new Set(S.types.map(t => t.id))
  const edgeSeen = new Set()
  const edges = (Array.isArray(data.edges) ? data.edges : []).slice(0, LIMITS.edges).map(sanitizeEdge)
    .filter(e => e && tids.has(e.fromType) && tids.has(e.toType) && (edgeSeen.has(e.id) ? false : (edgeSeen.add(e.id), true)))
  if (Array.isArray(data.edges)) S.edges = edges
  const accts = data.accounts && typeof data.accounts === 'object' ? data.accounts : {}
  Object.keys(accts).slice(0, LIMITS.accounts).forEach(id => { if (idOk(id)) S.accounts[id] = sanitizeAccount(id, accts[id], tids) })
  return S
}

function persist () {
  if (persistDisabled || !S) return
  try {
    const out = { version: VERSION, types: S.types, edges: S.edges, accounts: S.accounts }
    const json = JSON.stringify(out)
    if (json.length > 1.5e6) return   // bounded: refuse to write an absurd blob
    localStorage.setItem(STORAGE_KEY, json)
  } catch (_) { /* storage full / unavailable: the in-memory sandbox keeps working */ }
}
export const flush = () => { ensureLoaded(); persist() }

function changed (kind) { persist(); emitChanged(kind) }

/** Tests: drop in-memory state; clear=true also removes the stored blob. */
export function _reset (clear = false) {
  if (clear) { try { localStorage.removeItem(STORAGE_KEY) } catch (_) { /* ignore */ } }
  S = freshState(); loaded = true; seq = 0
}
export function _setPersistDisabled (v) { persistDisabled = !!v }

// ── Sanitisers ──────────────────────────────────────────────────────────────────

export function sanitizeType (raw) {
  if (!raw || typeof raw !== 'object' || !idOk(raw.id)) return null
  const scale = (Array.isArray(raw.qualityScale) ? raw.qualityScale : []).slice(0, LIMITS.scale)
    .filter(s => s && idOk(s.id) && finite(s.weight) && s.weight > 0 && s.weight <= 100)
    .map(s => ({ id: s.id, label: str(s.label || s.id, 24), weight: s.weight }))
  const qualityScale = scale.length ? scale : SCALES.flat.map(s => ({ ...s }))
  const refQuality = qualityScale.some(s => s.id === raw.refQuality) ? raw.refQuality
    : (qualityScale.find(s => s.weight === 1) ?? qualityScale[0]).id
  const channels = (Array.isArray(raw.channels) ? raw.channels : []).slice(0, LIMITS.channels)
    .filter(c => c && idOk(c.id))
    .map(c => ({ id: c.id, name: str(c.name || c.id, 40), feePct: finite(c.feePct) ? Math.min(100, Math.max(0, c.feePct)) : 0, settleHours: finite(c.settleHours) ? Math.min(8760, Math.max(0, c.settleHours)) : 0 }))
  return {
    id: raw.id, name: str(raw.name || raw.id, 40), tier: TIERS.includes(raw.tier) ? raw.tier : 'secondary',
    unit: str(raw.unit || 'units', 12), step: finite(raw.step) && raw.step >= 1e-6 ? raw.step : 1, emoji: str(raw.emoji || '◇', 8),
    payable: raw.payable !== false, builtin: !!raw.builtin, assessment: str(raw.assessment || QUALITY_ASSESSMENT, 32),
    qualityScale, refQuality,
    channels: channels.length ? channels : [{ id: 'direct', name: 'Direct', feePct: 0, settleHours: 0 }],
  }
}

export function sanitizeEdge (raw) {
  if (!raw || typeof raw !== 'object' || !idOk(raw.id) || !idOk(raw.fromType) || !idOk(raw.toType) || raw.fromType === raw.toType) return null
  if (!finite(raw.rateNum) || !finite(raw.rateDen) || raw.rateNum <= 0 || raw.rateDen <= 0) return null
  const qr = raw.qualityRule && finite(raw.qualityRule.minWeight) && raw.qualityRule.minWeight > 0 ? { minWeight: raw.qualityRule.minWeight } : null
  return {
    id: raw.id, fromType: raw.fromType, toType: raw.toType, rateNum: raw.rateNum, rateDen: raw.rateDen,
    minQty: finite(raw.minQty) && raw.minQty > 0 ? raw.minQty : 0, qualityRule: qr, owner: idOk(raw.owner) ? raw.owner : null, builtin: !!raw.builtin,
  }
}

function sanitizeAccount (id, raw, tids) {
  const a = blankAccount(id)
  if (!raw || typeof raw !== 'object') return a
  Object.keys(raw.balances ?? {}).forEach(k => { const v = raw.balances[k]; if (tids.has(k) && finite(v) && v >= 0 && v <= LIMITS.qty) a.balances[k] = clean(v) })
  Object.keys(raw.remainders ?? {}).forEach(k => {
    const r = raw.remainders[k]
    if (!tids.has(k) || !r || !finite(r.total) || r.total < 0) return
    a.remainders[k] = {
      total: clean(r.total),
      entries: (Array.isArray(r.entries) ? r.entries : []).slice(0, LIMITS.remainderEntries)
        .filter(e => e && finite(e.qty)).map(e => ({ id: str(e.id, 64), t: finite(e.t) ? e.t : 0, txId: str(e.txId, 64), qty: e.qty, line: str(e.line, 400) })),
    }
  })
  Object.keys(raw.inventory ?? {}).slice(0, LIMITS.inventory).forEach(k => { const v = raw.inventory[k]; if (idOk(k) && finite(v) && v > 0 && v <= LIMITS.qty) a.inventory[k] = v })
  a.log = (Array.isArray(raw.log) ? raw.log : []).slice(0, LIMITS.log).filter(t => t && idOk(t.id) && (t.kind === 'buy' || t.kind === 'sell'))
  return a
}

function blankAccount (id) { return { id, balances: {}, remainders: {}, inventory: {}, log: [] } }

// ── Registry: types ─────────────────────────────────────────────────────────────

export function getTypes () { ensureLoaded(); return S.types }
export function getType (id) { ensureLoaded(); return S.types.find(t => t.id === id) ?? null }

/** Add or replace a type. Returns the sanitised type or null. */
export function registerType (raw) {
  ensureLoaded()
  const t = sanitizeType({ ...raw, builtin: false })
  if (!t) return null
  const i = S.types.findIndex(x => x.id === t.id)
  if (i >= 0) { t.builtin = S.types[i].builtin; S.types[i] = t } else { if (S.types.length >= LIMITS.types) return null; S.types.push(t) }
  changed('types')
  return t
}

/** Remove a custom (non built-in) type and every edge that touches it. */
export function removeType (id) {
  ensureLoaded()
  const t = getType(id)
  if (!t || t.builtin) return false
  S.types = S.types.filter(x => x.id !== id)
  S.edges = S.edges.filter(e => e.fromType !== id && e.toType !== id)
  Object.values(S.accounts).forEach(a => { delete a.balances[id]; delete a.remainders[id] })
  changed('types')
  return true
}

export function qualityOf (typeId, qualityId) {
  const t = getType(typeId)
  if (!t) return null
  return t.qualityScale.find(s => s.id === (qualityId ?? t.refQuality)) ?? null
}
/** The weight that multiplies a quantity of this type at this grade (unknown/absent grade -> the reference grade). */
export function qualityWeight (typeId, qualityId) {
  const t = getType(typeId)
  if (!t) return 1
  return (t.qualityScale.find(s => s.id === qualityId) ?? t.qualityScale.find(s => s.id === t.refQuality) ?? t.qualityScale[0]).weight
}
export function qualityIndex (typeId, qualityId) {
  const t = getType(typeId)
  if (!t) return 0
  const i = t.qualityScale.findIndex(s => s.id === (qualityId ?? t.refQuality))
  return i < 0 ? 0 : i
}

// ── Registry: edges ─────────────────────────────────────────────────────────────

export function getEdges () { ensureLoaded(); return S.edges }
export function getEdge (id) { ensureLoaded(); return S.edges.find(e => e.id === id) ?? null }

export function addEdge (raw) {
  ensureLoaded()
  const id = raw?.id ?? `e-${raw?.fromType}-${raw?.toType}-${Date.now().toString(36)}${(seq++).toString(36)}`
  const e = sanitizeEdge({ ...raw, id, builtin: false })
  if (!e || !getType(e.fromType) || !getType(e.toType) || S.edges.length >= LIMITS.edges || S.edges.some(x => x.id === e.id)) return null
  S.edges.push(e)
  changed('edges')
  return e
}
export function updateEdge (id, patch) {
  ensureLoaded()
  const i = S.edges.findIndex(e => e.id === id)
  if (i < 0) return null
  const e = sanitizeEdge({ ...S.edges[i], ...patch, id, fromType: S.edges[i].fromType, toType: S.edges[i].toType })
  if (!e) return null
  S.edges[i] = e
  changed('edges')
  return e
}
export function removeEdge (id) {
  ensureLoaded()
  const n = S.edges.length
  S.edges = S.edges.filter(e => e.id !== id)
  if (S.edges.length !== n) { changed('edges'); return true }
  return false
}

// ── Accounts ────────────────────────────────────────────────────────────────────

/** The identity id the ledger belongs to: the override (tests), else the active OmniIdentity, else 'sandbox-user'. */
export function currentAccountId () {
  ensureLoaded()
  if (S.accountOverride) return S.accountOverride
  try { return getActiveIdentity()?.id ?? SANDBOX_ACCOUNT } catch (_) { return SANDBOX_ACCOUNT }
}
export function setAccountOverride (id) { ensureLoaded(); S.accountOverride = idOk(id) ? id : null; emitChanged('account') }

function starterAccount (id) {
  const a = blankAccount(id)
  Object.assign(a.balances, STARTER_BALANCES)
  Object.assign(a.inventory, STARTER_INVENTORY)
  return a
}
export function getAccount (id) {
  ensureLoaded()
  const aid = id ?? currentAccountId()
  if (!S.accounts[aid]) {
    if (Object.keys(S.accounts).length >= LIMITS.accounts) { delete S.accounts[Object.keys(S.accounts)[0]] }
    S.accounts[aid] = starterAccount(aid)
    persist()
  }
  return S.accounts[aid]
}
export function getBalance (typeId, accountId) { return getAccount(accountId).balances[typeId] ?? 0 }
export function getBalances (accountId) { return { ...getAccount(accountId).balances } }
export function getRemainders (accountId) { return JSON.parse(JSON.stringify(getAccount(accountId).remainders)) }
export function getRemainderTotal (typeId, accountId) { return getAccount(accountId).remainders[typeId]?.total ?? 0 }
export function getInventory (accountId) { return { ...getAccount(accountId).inventory } }
export function getLog (accountId) { return getAccount(accountId).log.slice() }

/** "Grant sandbox value": add fake value of one type to the account. */
export function grant (typeId, qty, accountId) {
  const t = getType(typeId)
  const n = Number(qty)
  if (!t || !finite(n) || n <= 0 || n > LIMITS.qty) return false
  const a = getAccount(accountId)
  a.balances[typeId] = clean((a.balances[typeId] ?? 0) + n)
  changed('grant')
  return true
}
/** Grant every type's starter amount again (the "Grant sandbox value" button's quick action). */
export function grantStarterPack (accountId) {
  const a = getAccount(accountId)
  Object.keys(STARTER_BALANCES).forEach(k => { if (getType(k)) a.balances[k] = clean((a.balances[k] ?? 0) + STARTER_BALANCES[k]) })
  changed('grant')
  return true
}
/** Reset the sandbox account to the starter state (types / edges untouched unless registry=true). */
export function resetSandbox ({ registry = false, accountId } = {}) {
  ensureLoaded()
  const aid = accountId ?? currentAccountId()
  S.accounts[aid] = starterAccount(aid)
  if (registry) { S.types = defaultTypes(); S.edges = defaultEdges() }
  changed('reset')
  return true
}

/** Add / remove inventory (used by the store when it hands over or takes back items outside of a trade). */
export function adjustInventory (itemId, delta, accountId) {
  if (!idOk(itemId) || !finite(delta)) return false
  const a = getAccount(accountId)
  const next = clean((a.inventory[itemId] ?? 0) + delta)
  if (next < 0) return false
  if (next === 0) delete a.inventory[itemId]; else a.inventory[itemId] = next
  changed('inventory')
  return true
}

/** Move whole steps of the stored remainder in `typeId` into the balance; the sub-step crumbs stay stated on the ledger. */
export function claimRemainder (typeId, accountId) {
  const t = getType(typeId)
  const a = getAccount(accountId)
  const r = a.remainders[typeId]
  if (!t || !r || r.total <= 0) return { ok: false, claimed: 0, left: r?.total ?? 0 }
  const claim = floorStep(r.total, t.step)
  if (claim <= 0) return { ok: false, claimed: 0, left: r.total }
  r.total = clean(r.total - claim)
  a.balances[typeId] = clean((a.balances[typeId] ?? 0) + claim)
  r.entries.unshift({ id: `rc${Date.now().toString(36)}${seq++}`, t: Date.now(), txId: '', qty: -claim, line: `Claimed ${fmtQty(claim)} ${t.name} from the remainder into the balance; ${fmtQty(r.total)} still stated here.` })
  r.entries.length = Math.min(r.entries.length, LIMITS.remainderEntries)
  changed('remainder')
  return { ok: true, claimed: claim, left: r.total }
}

// ── Forms ───────────────────────────────────────────────────────────────────────

/**
 * Turn channel SHARES (fractions summing to ~1) into absolute amounts that total exactly `total`, each rounded to the
 * type's step; the last non-zero channel absorbs the rounding so nothing is lost or invented.
 */
export function sharesToSplit (typeId, total, shares) {
  const t = getType(typeId)
  const ids = Object.keys(shares ?? {}).filter(k => finite(shares[k]) && shares[k] > 0 && t?.channels.some(c => c.id === k))
  if (!t || !ids.length) return t ? { [defaultChannel(t.id).id]: total } : {}
  const sumShares = ids.reduce((s, k) => s + shares[k], 0)
  const out = {}
  let used = 0
  ids.forEach((k, i) => {
    if (i === ids.length - 1) { out[k] = clean(total - used); return }
    const amt = floorStep(total * shares[k] / sumShares, t.step)
    out[k] = amt; used = clean(used + amt)
  })
  return out
}

/** The channel used when no split is given: the cheapest (lowest fee, then fastest, then listed first). */
export function defaultChannel (typeId) {
  const t = getType(typeId)
  if (!t) return null
  return t.channels.slice().sort((a, b) => a.feePct - b.feePct || a.settleHours - b.settleHours)[0]
}

export function describeForm (form) {
  const t = getType(form?.type)
  const qq = t ? t.qualityScale.find(s => s.id === (form.quality ?? t.refQuality)) : null
  return `${fmtQty(form?.qty ?? 0)} × ${qq ? qq.label + ' ' : ''}${t ? t.name : form?.type}`
}

// ── quote() ─────────────────────────────────────────────────────────────────────

function enumeratePaths (fromId, toId, owners) {
  const out = []
  const dfs = (cur, visited, path) => {
    if (path.length >= LIMITS.maxPathEdges) return
    for (const e of S.edges) {
      if (e.fromType !== cur || visited.has(e.toType)) continue
      if (e.owner && !owners.includes(e.owner)) continue
      const np = path.concat(e)
      if (e.toType === toId) out.push(np)
      else dfs(e.toType, new Set(visited).add(e.toType), np)
    }
  }
  dfs(fromId, new Set([fromId]), [])
  return out
}

/** Evaluate one path for an effective input `q0` (reference units of the offered type) at offered weight `w`. */
function evalPath (path, q0, w) {
  let qty = q0
  let yieldRate = 1
  const reasons = []
  path.forEach((e, i) => {
    if (qty + EPS < e.minQty) reasons.push(`${e.id}: below its minimum of ${fmtQty(e.minQty)} ${getType(e.fromType)?.name ?? e.fromType}`)
    if (i === 0 && e.qualityRule && w + EPS < e.qualityRule.minWeight) reasons.push(`${e.id}: needs a grade of weight ${fmtQty(e.qualityRule.minWeight)} or better (offered ${fmtQty(w)})`)
    const rate = e.rateNum / e.rateDen
    qty = qty * rate
    yieldRate *= rate
  })
  return { out: clean(qty), yield: yieldRate, valid: reasons.length === 0, reasons }
}

/** Backward pass: the smallest effective input (reference units of the first type) that yields `needOut`. */
function requiredInput (path, needOut) {
  let req = needOut
  for (let i = path.length - 1; i >= 0; i--) {
    const e = path[i]
    req = Math.max(e.minQty, req / (e.rateNum / e.rateDen))
  }
  return req
}

function edgeLabel (e) {
  const f = getType(e.fromType)?.name ?? e.fromType
  const t = getType(e.toType)?.name ?? e.toType
  return `${fmtQty(e.rateDen)} ${f} → ${fmtQty(e.rateNum)} ${t}`
}

/**
 * Does an offer of N of type A at quality Q cover a want of M of type B at quality Qw?
 *
 * @param {{type:string, qty:number, quality?:string, split?:Object<string,number>}} offerSpec  split = qty per channel id (must total qty; default = all on the type's first channel)
 * @param {{type:string, qty:number, quality?:string}} wantSpec
 * @param {{accountId?:string, counterpartyId?:string, applyRemainder?:boolean}} [opts]
 * @returns {{ok:boolean, error?:string, covers:boolean, surplus:number, shortfall:number,
 *            remainder:{type:string, qty:number, statedLine:string}, path:string[], pathLabels:string[], alternatives:Array,
 *            fees:Array, feeTotal:number, debit:number, balance:number, balanceOk:boolean, splitOk:boolean,
 *            offerNeeded:{type:string, qty:number, quality:string}|null, effIn:number, wantEff:number, yield:number,
 *            usedRemainder:number, reasons:string[], canExecute:boolean, block:string|null, statement:string[]}}
 */
export function quote (offerSpec, wantSpec, opts = {}) {
  ensureLoaded()
  const fail = (error) => ({ ok: false, error, covers: false, surplus: 0, shortfall: 0, remainder: { type: wantSpec?.type ?? '', qty: 0, statedLine: '' }, path: [], pathLabels: [], alternatives: [], fees: [], feeTotal: 0, debit: 0, balance: 0, balanceOk: false, splitOk: false, offerNeeded: null, effIn: 0, wantEff: 0, yield: 0, usedRemainder: 0, reasons: [error], canExecute: false, block: error, statement: [error] })
  const A = getType(offerSpec?.type), B = getType(wantSpec?.type)
  if (!A) return fail('unknown-offer-type')
  if (!B) return fail('unknown-want-type')
  const oq = Number(offerSpec.qty), wq = Number(wantSpec.qty)
  if (!finite(oq) || oq < 0 || oq > LIMITS.qty) return fail('bad-offer-qty')
  if (!finite(wq) || wq <= 0 || wq > LIMITS.qty) return fail('bad-want-qty')
  if (!A.payable) return fail('offer-type-not-payable')
  const accountId = opts.accountId ?? currentAccountId()
  const owners = [accountId, opts.counterpartyId].filter(Boolean)
  const offerQ = A.qualityScale.some(s => s.id === offerSpec.quality) ? offerSpec.quality : A.refQuality
  const wantQ = B.qualityScale.some(s => s.id === wantSpec.quality) ? wantSpec.quality : B.refQuality
  const wOffer = qualityWeight(A.id, offerQ), wWant = qualityWeight(B.id, wantQ)
  const effIn = clean(oq * wOffer)
  const wantEff = clean(wq * wWant)
  const extra = opts.applyRemainder ? getRemainderTotal(B.id, accountId) : 0

  // candidate routes
  const routes = A.id === B.id ? [[]] : enumeratePaths(A.id, B.id, owners)
  const cands = routes.map(p => {
    const ev = evalPath(p, effIn, wOffer)
    const needIn = p.length ? requiredInput(p, Math.max(0, wantEff - extra)) : Math.max(0, wantEff - extra)
    const gate = p.length && p[0].qualityRule && wOffer + EPS < p[0].qualityRule.minWeight   // a grade this route refuses can never be "needed"
    return { path: p, ...ev, needQty: gate ? Infinity : ceilStep(needIn / wOffer, A.step) }
  })
  const valid = cands.filter(c => c.valid).sort((a, b) => b.out - a.out || a.path.length - b.path.length)
  const ranked = cands.slice().sort((a, b) => b.out - a.out || a.path.length - b.path.length)
  const chosen = valid[0] ?? ranked[0] ?? null
  const needs = cands.filter(c => finite(c.needQty)).sort((a, b) => a.needQty - b.needQty)
  const offerNeeded = needs[0] ? { type: A.id, qty: needs[0].needQty, quality: offerQ } : null

  const base = chosen ? chosen.out : 0
  const noRoute = !chosen
  const usedRemainder = noRoute ? 0 : clean(Math.min(extra, Math.max(0, wantEff - base)))
  const total = clean(base + usedRemainder)
  const covers = !noRoute && chosen.valid && total + EPS >= wantEff && oq > 0
  const surplus = covers ? clean(Math.max(0, total - wantEff)) : 0
  const shortfall = covers ? 0 : clean(Math.max(0, wantEff - total))

  // fees on the offered side, per channel
  const reasons = []
  const split = offerSpec.split && Object.keys(offerSpec.split).length ? offerSpec.split : { [defaultChannel(A.id).id]: oq }
  let splitOk = true, sum = 0
  const fees = []
  for (const cid of Object.keys(split)) {
    const c = A.channels.find(x => x.id === cid)
    const amt = Number(split[cid])
    if (!c || !finite(amt) || amt < 0) { splitOk = false; reasons.push(`bad channel share: ${cid}`); continue }
    sum += amt
    if (amt === 0) continue
    const fee = c.feePct > 0 ? ceilStep(amt * c.feePct / 100, A.step) : 0
    fees.push({ channel: c.id, name: c.name, type: A.id, amount: clean(amt), feePct: c.feePct, fee, settleHours: c.settleHours })
  }
  if (Math.abs(sum - oq) > 1e-6) { splitOk = false; reasons.push(`channel split totals ${fmtQty(sum)} but the offer is ${fmtQty(oq)}`) }
  const feeTotal = clean(fees.reduce((s, f) => s + f.fee, 0))
  const debit = clean(oq + feeTotal)
  const balance = getBalance(A.id, accountId)
  const balanceOk = balance + EPS >= debit

  if (noRoute) reasons.push(`no conversion route from ${A.name} to ${B.name}`)
  else if (!chosen.valid) chosen.reasons.forEach(r => reasons.push(r))
  if (!covers && !noRoute && chosen.valid) reasons.push(`short by ${fmtQty(shortfall)} ${B.name} (reference units)`)
  if (!balanceOk) reasons.push(`insufficient balance: need ${fmtQty(debit)} ${A.name}, have ${fmtQty(balance)}`)

  const block = !covers ? (noRoute ? 'no-route' : (chosen.valid ? 'not-covered' : 'route-rule')) : (!splitOk ? 'split-invalid' : (!balanceOk ? 'insufficient-balance' : null))
  const statedLine = covers
    ? (surplus > EPS
      ? `Remainder: ${fmtQty(surplus)} ${B.name} (reference grade). ${fmtQty(oq)} ${A.name} cover ${fmtQty(total)} ${B.name} against a want of ${fmtQty(wantEff)}; the ${fmtQty(surplus)} is stated, not rounded away, and stays on your ${B.name} remainder ledger for you to use.`
      : `Remainder: none — ${fmtQty(oq)} ${A.name} cover ${fmtQty(wantEff)} ${B.name} exactly.`)
    : `Remainder: none recorded — the offer does not cover the want${shortfall > 0 ? ` (short ${fmtQty(shortfall)} ${B.name})` : ''}.`
  const path = chosen ? chosen.path.map(e => e.id) : []
  const pathLabels = chosen ? chosen.path.map(edgeLabel) : []
  const statement = [
    `Offer: ${describeForm({ type: A.id, qty: oq, quality: offerQ })} = ${fmtQty(effIn)} ${A.name} (reference grade)`,
    `Want: ${describeForm({ type: B.id, qty: wq, quality: wantQ })} = ${fmtQty(wantEff)} ${B.name} (reference grade)`,
    path.length ? `Route: ${pathLabels.join('  then  ')}` : (A.id === B.id ? 'Route: direct (same value type)' : 'Route: none'),
    ...fees.map(f => `Fee: ${fmtQty(f.fee)} ${A.name} on ${f.name} (${fmtQty(f.feePct)} % of ${fmtQty(f.amount)}, settles in ${fmtQty(f.settleHours)} h)`),
    statedLine,
  ]
  return {
    ok: true, covers, surplus, shortfall,
    remainder: { type: B.id, qty: surplus, statedLine },
    path, pathLabels,
    alternatives: ranked.filter(c => c !== chosen).slice(0, 6).map(c => ({ path: c.path.map(e => e.id), labels: c.path.map(edgeLabel), out: c.out, valid: c.valid, reasons: c.reasons })),
    fees, feeTotal, debit, balance, balanceOk, splitOk,
    offerNeeded, effIn, wantEff, yield: chosen ? chosen.yield : 0, usedRemainder, reasons,
    canExecute: covers && splitOk && balanceOk, block, statement,
    offer: { type: A.id, qty: oq, quality: offerQ, split }, want: { type: B.id, qty: wq, quality: wantQ },
  }
}

/** Sell side: the item leaves the inventory; the account RECEIVES `receive` (qty per item) through channels, less their fees. */
export function quoteSell ({ itemId, itemQty = 1, receive, split } = {}, opts = {}) {
  ensureLoaded()
  const accountId = opts.accountId ?? currentAccountId()
  const T = getType(receive?.type)
  const n = Number(itemQty)
  const bad = (error) => ({ ok: false, error, canExecute: false, block: error, receive: null, fees: [], feeTotal: 0, net: 0, statement: [error] })
  if (!T) return bad('unknown-type')
  if (!finite(n) || n <= 0 || n > LIMITS.qty) return bad('bad-item-qty')
  const rq = Number(receive.qty)
  if (!finite(rq) || rq <= 0 || rq > LIMITS.qty) return bad('bad-receive-qty')
  if (!idOk(itemId)) return bad('bad-item')
  const quality = T.qualityScale.some(s => s.id === receive.quality) ? receive.quality : T.refQuality
  const total = clean(rq * n)
  const sp = split && Object.keys(split).length ? split : { [defaultChannel(T.id).id]: total }
  let sum = 0, splitOk = true
  const fees = []
  for (const cid of Object.keys(sp)) {
    const c = T.channels.find(x => x.id === cid)
    const amt = Number(sp[cid])
    if (!c || !finite(amt) || amt < 0) { splitOk = false; continue }
    sum += amt
    if (amt > 0) fees.push({ channel: c.id, name: c.name, type: T.id, amount: clean(amt), feePct: c.feePct, fee: c.feePct > 0 ? ceilStep(amt * c.feePct / 100, T.step) : 0, settleHours: c.settleHours })
  }
  if (Math.abs(sum - total) > 1e-6) splitOk = false
  const feeTotal = clean(fees.reduce((s, f) => s + f.fee, 0))
  const net = clean(total - feeTotal)
  const have = getAccount(accountId).inventory[itemId] ?? 0
  const inventoryOk = have + EPS >= n
  const block = !inventoryOk ? 'not-in-inventory' : (!splitOk ? 'split-invalid' : (net < 0 ? 'fees-exceed' : null))
  return {
    ok: true, canExecute: !block, block, receive: { type: T.id, qty: total, quality }, fees, feeTotal, net, splitOk, inventoryOk, have,
    remainder: { type: T.id, qty: 0, statedLine: 'Remainder: none — a direct sale pays exactly the stated form.' },
    statement: [
      `Sell: ${fmtQty(n)} × ${itemId} from your inventory (you hold ${fmtQty(have)})`,
      `Receive: ${describeForm({ type: T.id, qty: total, quality })}`,
      ...fees.map(f => `Fee: ${fmtQty(f.fee)} ${T.name} on ${f.name} (${fmtQty(f.feePct)} %, settles in ${fmtQty(f.settleHours)} h)`),
      `Net to your balance: ${fmtQty(net)} ${T.name}`,
      'Remainder: none — a direct sale pays exactly the stated form.',
    ],
  }
}

// ── Intent (Desire() forward declaration only) ──────────────────────────────────

export function makeIntent (note) {
  const n = str(note, LIMITS.note).trim()
  return n ? { note: n, t: Date.now() } : null
}

// ── Execute ─────────────────────────────────────────────────────────────────────

function newTxId () { return `tx${Date.now().toString(36)}${(seq++).toString(36)}` }

function pushLog (a, tx) {
  a.log.unshift(tx)
  if (a.log.length > LIMITS.log) a.log.length = LIMITS.log
}

function finishTrade (tx, intent) {
  if (intent) { try { declareDesire(intent.note, { txId: tx.id, kind: tx.kind, itemId: tx.itemId }) } catch (_) { /* hook only */ } }
  changed('trade')
  try { window.dispatchEvent(new CustomEvent(TRADE_EVENT, { detail: { tx } })) } catch (_) { /* no window */ }
}

/**
 * Execute a purchase through the ledger (sandbox). Insufficient balance (or any quote block) -> {ok:false}, nothing changes.
 * args: { itemId, itemName, itemQty=1, offer:{type,qty,quality,split?}, want:{type,qty,quality}, declaredIntent?, applyRemainder? }
 */
export function buy (args = {}, opts = {}) {
  const accountId = opts.accountId ?? currentAccountId()
  const itemQty = Number(args.itemQty ?? 1)
  if (!idOk(args.itemId) || !finite(itemQty) || itemQty <= 0) return { ok: false, error: 'bad-item', quote: null }
  const qt = quote(args.offer, args.want, { accountId, applyRemainder: !!args.applyRemainder })
  if (!qt.ok || !qt.canExecute) return { ok: false, error: qt.block ?? qt.error, quote: qt }
  const a = getAccount(accountId)
  const A = getType(qt.offer.type), B = getType(qt.want.type)
  a.balances[A.id] = clean((a.balances[A.id] ?? 0) - qt.debit)
  // remainder: spend the part that was applied, then state the new surplus (per type, never merged)
  let rem = null
  if (qt.usedRemainder > 0 || qt.surplus > EPS) {
    const r = a.remainders[B.id] ?? (a.remainders[B.id] = { total: 0, entries: [] })
    r.total = clean(Math.max(0, r.total - qt.usedRemainder) + qt.surplus)
    rem = { id: `rm${Date.now().toString(36)}${seq++}`, t: Date.now(), txId: '', qty: qt.surplus, line: qt.remainder.statedLine }
    if (qt.usedRemainder > 0) r.entries.unshift({ id: `ru${Date.now().toString(36)}${seq++}`, t: Date.now(), txId: '', qty: -qt.usedRemainder, line: `Applied ${fmtQty(qt.usedRemainder)} ${B.name} of stated remainder toward ${args.itemName ?? args.itemId}.` })
  }
  a.inventory[args.itemId] = clean((a.inventory[args.itemId] ?? 0) + itemQty)
  const intent = args.declaredIntent && args.declaredIntent.note ? { note: str(args.declaredIntent.note, LIMITS.note), t: finite(args.declaredIntent.t) ? args.declaredIntent.t : Date.now() } : null
  const tx = {
    id: newTxId(), t: Date.now(), kind: 'buy', itemId: args.itemId, itemName: str(args.itemName ?? args.itemId, 60), itemQty,
    legs: qt.fees.map(f => ({ dir: 'out', type: A.id, qty: f.amount, quality: qt.offer.quality, channel: f.channel, fee: f.fee })),
    want: qt.want, path: qt.path, pathLabels: qt.pathLabels,
    remainder: { type: B.id, qty: qt.surplus, line: qt.remainder.statedLine, applied: qt.usedRemainder },
    declaredIntent: intent, status: 'sandbox-settled',
  }
  if (rem) { rem.txId = tx.id; (a.remainders[B.id].entries).unshift(rem); a.remainders[B.id].entries.length = Math.min(a.remainders[B.id].entries.length, LIMITS.remainderEntries) }
  pushLog(a, tx)
  finishTrade(tx, intent)
  return { ok: true, tx, quote: qt }
}

/** args: { itemId, itemName, itemQty=1, receive:{type,qty,quality}, split?, declaredIntent? } */
export function sell (args = {}, opts = {}) {
  const accountId = opts.accountId ?? currentAccountId()
  const qs = quoteSell(args, { accountId })
  if (!qs.ok || !qs.canExecute) return { ok: false, error: qs.block ?? qs.error, quote: qs }
  const a = getAccount(accountId)
  const itemQty = Number(args.itemQty ?? 1)
  a.inventory[args.itemId] = clean((a.inventory[args.itemId] ?? 0) - itemQty)
  if (a.inventory[args.itemId] <= EPS) delete a.inventory[args.itemId]
  a.balances[qs.receive.type] = clean((a.balances[qs.receive.type] ?? 0) + qs.net)
  const intent = args.declaredIntent && args.declaredIntent.note ? { note: str(args.declaredIntent.note, LIMITS.note), t: finite(args.declaredIntent.t) ? args.declaredIntent.t : Date.now() } : null
  const tx = {
    id: newTxId(), t: Date.now(), kind: 'sell', itemId: args.itemId, itemName: str(args.itemName ?? args.itemId, 60), itemQty,
    legs: qs.fees.map(f => ({ dir: 'in', type: qs.receive.type, qty: f.amount, quality: qs.receive.quality, channel: f.channel, fee: f.fee })),
    want: null, path: [], pathLabels: [], remainder: { type: qs.receive.type, qty: 0, line: qs.remainder.statedLine, applied: 0 },
    declaredIntent: intent, status: 'sandbox-settled',
  }
  pushLog(a, tx)
  finishTrade(tx, intent)
  return { ok: true, tx, quote: qs }
}

// ── Derived views for the V177 D3 charts (data only; nothing is drawn in V176) ───

/** A tree: exchange -> pay (channels) / route (edges) / fees / remainder. Leaves carry `value`. Sunburst / treemap ready. */
export function toHierarchy (qt, label = 'Exchange') {
  if (!qt || !qt.ok) return { name: label, kind: 'root', children: [] }
  const A = getType(qt.offer.type), B = getType(qt.want.type)
  const children = [
    { name: `Pay ${describeForm(qt.offer)}`, kind: 'offer', typeId: A.id, value: qt.effIn, children: qt.fees.map(f => ({ name: f.name, kind: 'channel', typeId: A.id, value: f.amount, fee: f.fee })) },
    { name: 'Route', kind: 'route', children: qt.path.map((id, i) => ({ name: qt.pathLabels[i], kind: 'edge', edgeId: id, value: 1 })) },
    { name: 'Fees', kind: 'fees', typeId: A.id, value: qt.feeTotal, children: qt.fees.filter(f => f.fee > 0).map(f => ({ name: f.name, kind: 'fee', typeId: A.id, value: f.fee })) },
    { name: 'Remainder', kind: 'remainder', typeId: B.id, value: qt.surplus },
  ]
  return { name: `${label}: ${describeForm(qt.want)}`, kind: 'root', typeId: B.id, value: qt.wantEff, children }
}

/** Nodes + links (Sankey ready). `value` is in the SOURCE node's own units; `refValue` is the grade-weighted reference value. */
export function toFlows (qt) {
  const nodes = [], links = []
  if (!qt || !qt.ok) return { nodes, links }
  const A = getType(qt.offer.type), B = getType(qt.want.type)
  const add = (id, name, kind, typeId) => { if (!nodes.some(n => n.id === id)) nodes.push({ id, name, kind, typeId }) }
  add(`type:${A.id}`, A.name, 'type', A.id)
  qt.fees.forEach(f => { add(`channel:${f.channel}`, f.name, 'channel', A.id); links.push({ source: `channel:${f.channel}`, target: `type:${A.id}`, value: f.amount, refValue: clean(f.amount * qualityWeight(A.id, qt.offer.quality)), kind: 'pay', fee: f.fee }) })
  let prev = A.id, running = qt.effIn
  qt.path.forEach(id => {
    const e = getEdge(id)
    add(`type:${e.toType}`, getType(e.toType)?.name ?? e.toType, 'type', e.toType)
    const out = clean(running * e.rateNum / e.rateDen)
    links.push({ source: `type:${prev}`, target: `type:${e.toType}`, value: running, refValue: running, valueOut: out, kind: 'convert', edgeId: id })
    prev = e.toType; running = out
  })
  add('item', describeForm(qt.want), 'item', B.id)
  links.push({ source: `type:${prev}`, target: 'item', value: qt.wantEff, refValue: qt.wantEff, kind: 'purchase' })
  if (qt.surplus > EPS) { add('remainder', 'Remainder (stated)', 'remainder', B.id); links.push({ source: `type:${prev}`, target: 'remainder', value: qt.surplus, refValue: qt.surplus, kind: 'remainder' }) }
  return { nodes, links }
}
