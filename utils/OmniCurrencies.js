/**
 * utils/OmniCurrencies.js — world currencies for the SANDBOX ledger (V208)
 *
 * Pure data + thin helpers on top of utils/OmniValueModel.js. A currency is an ordinary value type (tier primary for money,
 * secondary for digital) joined to USD (sim) by a PAIR of exact inverse conversion edges (a hub: every currency <-> USD), so
 * any currency reaches any other through USD in two steps and the arbitrage guard never sees a gaining loop.
 *
 *   RATES ARE STARTER VALUES, NOT LIVE. They are rounded, invented-for-the-sandbox approximations; change them in the Dev settings
 *   or with setRate(). Nothing here is real money, advice or a quote. Real payments are the last item of the build order.
 *
 * A currency is OFF until the user turns it on (so the exchange wheel and wallet stay readable); turning it on adds its type and its two edges,
 * turning it off removes them (refused while the wallet still holds some, unless force).
 */
import * as Value from './OmniValueModel.js'

export const HUB = 'usd'
export const RATE_NOTE = 'Starter rates for the sandbox: rounded approximations, not live, not real money. Editable.'

// code, name, symbol, emoji, step, per1USD [num, den] (units of this currency for 1 USD = num/den), group
const C = (code, name, symbol, emoji, step, per, group = 'fiat') => ({ code, name, symbol, emoji, step, per, group })
export const CURRENCIES = [
  C('eur', 'Euro', '€', '🇪🇺', 0.01, [92, 100]), C('gbp', 'British pound', '£', '🇬🇧', 0.01, [79, 100]), C('jpy', 'Japanese yen', '¥', '🇯🇵', 1, [150, 1]),
  C('cad', 'Canadian dollar', 'C$', '🇨🇦', 0.01, [136, 100]), C('aud', 'Australian dollar', 'A$', '🇦🇺', 0.01, [152, 100]), C('chf', 'Swiss franc', 'CHF', '🇨🇭', 0.01, [88, 100]),
  C('cny', 'Chinese yuan', 'CN¥', '🇨🇳', 0.01, [72, 10]), C('inr', 'Indian rupee', '₹', '🇮🇳', 0.01, [83, 1]), C('mxn', 'Mexican peso', 'Mex$', '🇲🇽', 0.01, [175, 10]),
  C('brl', 'Brazilian real', 'R$', '🇧🇷', 0.01, [5, 1]), C('krw', 'South Korean won', '₩', '🇰🇷', 1, [1330, 1]), C('sgd', 'Singapore dollar', 'S$', '🇸🇬', 0.01, [134, 100]),
  C('hkd', 'Hong Kong dollar', 'HK$', '🇭🇰', 0.01, [78, 10]), C('nzd', 'New Zealand dollar', 'NZ$', '🇳🇿', 0.01, [165, 100]), C('sek', 'Swedish krona', 'kr', '🇸🇪', 0.01, [105, 10]),
  C('nok', 'Norwegian krone', 'kr', '🇳🇴', 0.01, [107, 10]), C('dkk', 'Danish krone', 'kr', '🇩🇰', 0.01, [69, 10]), C('pln', 'Polish zloty', 'zł', '🇵🇱', 0.01, [4, 1]),
  C('czk', 'Czech koruna', 'Kč', '🇨🇿', 0.01, [23, 1]), C('try', 'Turkish lira', '₺', '🇹🇷', 0.01, [32, 1]), C('zar', 'South African rand', 'R', '🇿🇦', 0.01, [185, 10]),
  C('aed', 'UAE dirham', 'د.إ', '🇦🇪', 0.01, [36725, 10000]), C('sar', 'Saudi riyal', '﷼', '🇸🇦', 0.01, [375, 100]), C('ils', 'Israeli shekel', '₪', '🇮🇱', 0.01, [37, 10]),
  C('egp', 'Egyptian pound', 'E£', '🇪🇬', 0.01, [48, 1]), C('ngn', 'Nigerian naira', '₦', '🇳🇬', 0.01, [1500, 1]), C('kes', 'Kenyan shilling', 'KSh', '🇰🇪', 0.01, [130, 1]),
  C('thb', 'Thai baht', '฿', '🇹🇭', 0.01, [35, 1]), C('idr', 'Indonesian rupiah', 'Rp', '🇮🇩', 1, [15500, 1]), C('php', 'Philippine peso', '₱', '🇵🇭', 0.01, [56, 1]),
  C('vnd', 'Vietnamese dong', '₫', '🇻🇳', 1, [24500, 1]), C('ars', 'Argentine peso', 'AR$', '🇦🇷', 0.01, [900, 1]), C('clp', 'Chilean peso', 'CL$', '🇨🇱', 1, [930, 1]),
  C('cop', 'Colombian peso', 'Col$', '🇨🇴', 1, [4000, 1]), C('pen', 'Peruvian sol', 'S/', '🇵🇪', 0.01, [375, 100]), C('jmd', 'Jamaican dollar', 'J$', '🇯🇲', 0.01, [155, 1]),
  C('btc', 'Bitcoin (sim)', '₿', '₿', 1e-6, [1, 65000], 'digital'), C('eth', 'Ether (sim)', 'Ξ', 'Ξ', 1e-6, [1, 2600], 'digital'), C('usdc', 'USD Coin (sim)', 'USDC', '🪙', 0.01, [1, 1], 'digital'),
]
export const MAIN = ['eur', 'gbp', 'jpy', 'cad', 'aud', 'chf', 'cny', 'inr', 'mxn', 'brl']
export const GROUPS = { fiat: 'World currencies', digital: 'Digital (sandbox)' }

export const typeId = (code) => `cur-${code}`
export const edgeIds = (code) => ({ out: `e-usd-cur-${code}`, back: `e-cur-${code}-usd` })
export const find = (code) => CURRENCIES.find(c => c.code === String(code ?? '').toLowerCase()) ?? null

/** A currency as the value-type record the model registers. */
export function typeRecord (code) {
  const c = find(code); if (!c) return null
  const ch = c.group === 'digital' ? [{ id: 'wallet-sim', name: 'Wallet (sim)', feePct: 0.5, settleHours: 0.2 }]
    : [{ id: 'cash', name: 'Cash', feePct: 0, settleHours: 0 }, { id: 'bank-sim', name: 'Bank (sim)', feePct: 0.5, settleHours: 24 }, { id: 'card-sim', name: 'Card (sim)', feePct: 2.9, settleHours: 48 }]
  return { id: typeId(c.code), name: `${c.name}`, tier: c.group === 'digital' ? 'secondary' : 'primary', unit: c.code.toUpperCase(), step: c.step, emoji: c.emoji,
    payable: true, qualityScale: Value.SCALES.flat, refQuality: 'standard', channels: ch }
}
/** The two exact-inverse edges joining a currency to the hub. */
export function edgeRecords (code, per) {
  const c = find(code); if (!c) return []
  const [n, d] = per ?? c.per; const ids = edgeIds(c.code)
  return [{ id: ids.out, fromType: HUB, toType: typeId(c.code), rateNum: n, rateDen: d, builtin: false }, { id: ids.back, fromType: typeId(c.code), toType: HUB, rateNum: d, rateDen: n, builtin: false }]
}

export const isEnabled = (code) => !!find(code) && !!Value.getType(typeId(code))
export const enabledCodes = () => CURRENCIES.filter(c => isEnabled(c.code)).map(c => c.code)

/** Turn a currency on. Idempotent. Returns { ok, error? }. */
export function enable (code) {
  const c = find(code); if (!c) return { ok: false, error: 'Unknown currency.' }
  if (!Value.getType(HUB)) return { ok: false, error: 'The USD (sim) type is missing, so currencies have nothing to join.' }
  if (isEnabled(c.code)) return { ok: true, same: true }
  if (!Value.registerType(typeRecord(c.code))) return { ok: false, error: 'No room for another value type (the limit is 64).' }
  for (const e of edgeRecords(c.code)) { if (!Value.addEdge(e)) { Value.removeType(typeId(c.code)); return { ok: false, error: 'No room for another conversion edge.' } } }
  return { ok: true }
}
/** Turn a currency off (its type and edges go). Refused while the wallet holds some, unless force. */
export function disable (code, { force = false } = {}) {
  const c = find(code); if (!c) return { ok: false, error: 'Unknown currency.' }
  if (!isEnabled(c.code)) return { ok: true, same: true }
  const held = Value.getBalance(typeId(c.code))
  if (held > 0 && !force) return { ok: false, held, error: `Your wallet still holds ${Value.fmtQty(held)} ${c.code.toUpperCase()}. Convert it first.` }
  return { ok: Value.removeType(typeId(c.code)) }
}
export function enableMany (codes) { const out = { on: 0, failed: [] }; for (const k of codes) { const r = enable(k); if (r.ok) out.on++; else out.failed.push(k) } return out }
/** units of this currency for 1 USD, as the model holds it right now (null when off) */
export function perUsd (code) {
  const e = Value.getEdge(edgeIds(String(code).toLowerCase()).out); return e ? e.rateNum / e.rateDen : null
}
/** Change the rate (units per 1 USD) of an ENABLED currency; both edges stay exact inverses. */
export function setRate (code, unitsPerUsd) {
  const c = find(code); const x = Number(unitsPerUsd)
  if (!c || !isEnabled(c.code) || !Number.isFinite(x) || x <= 0 || x > 1e9 || x < 1e-9) return false
  const d = 1e6, n = Math.round(x * d)   // six decimals of precision, exact integers
  if (n <= 0) return false
  const ids = edgeIds(c.code)
  return !!Value.updateEdge(ids.out, { rateNum: n, rateDen: d }) && !!Value.updateEdge(ids.back, { rateNum: d, rateDen: n })
}
export function format (code, qty) {
  const c = find(code); const n = Number(qty); if (!c || !Number.isFinite(n)) return ''
  const dec = c.step >= 1 ? 0 : Math.max(2, Math.min(6, Math.round(-Math.log10(c.step))))
  return `${c.symbol} ${n.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec })}`
}
export default { CURRENCIES, MAIN, enable, disable, enableMany, isEnabled, enabledCodes, perUsd, setRate, format, find }
