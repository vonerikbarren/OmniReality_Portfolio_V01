/**
 * utils/OmniSourceModel.js (V281) — the data of a SourceNode: ONE place a claim came from (a report, an article, a filing, a dataset, an interview...), kept once so many claims can cite it.
 * Pure: no DOM, no three.js, no network (the node never fetches its address; you open it yourself).
 *
 * data.source = { title, kind, publisher, author, url, published, accessed, trust, trustWhy, proximity, status, archiveUrl, note }
 *   trust      0..1   how far the SOURCE is believed (set by a person; never computed from the address)
 *   proximity  primary | secondary | tertiary   how close it is to the event
 *   status     live | moved | dead | retracted | paywalled
 *   url / archiveUrl  https only (anything else becomes '')
 * An Epistemics node points here with epistemics.sourceId (+ cite { page, quote }); its short `source` label stays on the claim so it is whole without this node.
 * sanitizeSource never throws, is idempotent, drops unknown keys and cannot pollute prototypes.
 */
export const KINDS = Object.freeze(['report', 'news', 'filing', 'dataset', 'interview', 'archive', 'social', 'other'])
export const PROXIMITY = Object.freeze(['primary', 'secondary', 'tertiary'])
export const STATUSES = Object.freeze(['live', 'moved', 'dead', 'retracted', 'paywalled'])
export const LIMITS = Object.freeze({ title: 120, publisher: 80, author: 80, url: 500, trustWhy: 200, note: 300 })

const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k)
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v)
const own = (o, k) => (isObj(o) && has(o, k) ? o[k] : undefined)
const clean = (v, n) => String(v ?? '').replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n)
const pick = (v, list, d) => (typeof v === 'string' && list.includes(v) ? v : d)
const unit = (v, d) => { const n = Number(v); return Number.isFinite(n) ? Math.round(Math.min(1, Math.max(0, n)) * 100) / 100 : d }

/** https only, no spaces, no credentials in the address */
export function safeUrl (v) {
  const s = String(v ?? '').trim().slice(0, LIMITS.url)
  if (!/^https:\/\/[^\s/?#]+/i.test(s) || /\s/.test(s)) return ''
  try { const u = new URL(s); if (u.protocol !== 'https:' || u.username || u.password) return ''; return u.href.slice(0, LIMITS.url) } catch (_) { return '' }
}
/** 'YYYY-MM-DD' for a real calendar day, else '' */
export function safeDate (v) {
  const s = String(v ?? '').trim(); if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return ''
  const d = new Date(s + 'T00:00:00Z'); return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === s ? s : ''
}

export function defaultSource () {
  return { title: '', kind: 'other', publisher: '', author: '', url: '', published: '', accessed: '', trust: 0.5, trustWhy: '', proximity: 'secondary', status: 'live', archiveUrl: '', note: '' }
}
export function sanitizeSource (raw) {
  const d = defaultSource(); const r = isObj(raw) ? raw : {}
  return {
    title: clean(own(r, 'title'), LIMITS.title),
    kind: pick(own(r, 'kind'), KINDS, d.kind),
    publisher: clean(own(r, 'publisher'), LIMITS.publisher),
    author: clean(own(r, 'author'), LIMITS.author),
    url: safeUrl(own(r, 'url')),
    published: safeDate(own(r, 'published')),
    accessed: safeDate(own(r, 'accessed')),
    trust: unit(own(r, 'trust'), d.trust),
    trustWhy: clean(own(r, 'trustWhy'), LIMITS.trustWhy),
    proximity: pick(own(r, 'proximity'), PROXIMITY, d.proximity),
    status: pick(own(r, 'status'), STATUSES, d.status),
    archiveUrl: safeUrl(own(r, 'archiveUrl')),
    note: clean(own(r, 'note'), LIMITS.note)
  }
}

/** an address in a comparable form: host without www, no fragment, no tracking parameters, no trailing slash */
export function normalizeUrl (v) {
  const s = safeUrl(v); if (!s) return ''
  try {
    const u = new URL(s); u.hash = ''
    for (const k of [...u.searchParams.keys()]) if (/^(utm_|fbclid$|gclid$|mc_)/i.test(k)) u.searchParams.delete(k)
    return (u.hostname.replace(/^www\./i, '').toLowerCase() + u.pathname.replace(/\/+$/, '') + u.search).toLowerCase()
  } catch (_) { return '' }
}
/** the same source? By normalised address when both have one, otherwise by title + publisher (case and spacing ignored) */
export function sameSource (a, b) {
  const x = sanitizeSource(a), y = sanitizeSource(b)
  const ux = normalizeUrl(x.url), uy = normalizeUrl(y.url)
  if (ux && uy) return ux === uy
  const k = (s) => (s.title + '|' + s.publisher).toLowerCase().replace(/\s+/g, ' ').trim()
  return !!x.title && k(x) === k(y)
}

/** trust after what is known about it: a dead or retracted source counts for little, a third-hand one for less */
export function effectiveTrust (source) {
  const s = sanitizeSource(source); let t = s.trust
  if (s.status === 'retracted') t = Math.min(t, 0.05)
  else if (s.status === 'dead') t = Math.min(t, 0.3)
  else if (s.status === 'moved' || s.status === 'paywalled') t *= 0.9
  if (s.proximity === 'tertiary') t *= 0.8
  else if (s.proximity === 'primary') t = Math.min(1, t * 1.05)
  return Math.round(t * 100) / 100
}
/** days since it was last checked (today = 'YYYY-MM-DD'); null when it never was */
export function staleness (source, today) {
  const a = safeDate(sanitizeSource(source).accessed), t = safeDate(today); if (!a || !t) return null
  return Math.round((Date.parse(t + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000)
}
/** how well a claim is supported by the sources it cites. mode 'weakest' (every source must hold) or 'best' (one good source is enough). */
export function claimSupport (sources, opts = {}) {
  const list = (Array.isArray(sources) ? sources : []).filter(isObj).slice(0, 64).map(effectiveTrust)
  if (!list.length) return { support: 0, count: 0, weakest: 0, best: 0, lowOnly: false }
  const weakest = Math.min(...list), best = Math.max(...list)
  return { support: own(opts, 'mode') === 'best' ? best : weakest, count: list.length, weakest, best, lowOnly: best < 0.4 }
}

const URL_IN = /https:\/\/[^\s"'<>]+/i
/** lift the short `source` label and the address in `note` of an Epistemics node into a source spec */
export function fromEpistemics (node) {
  const e = isObj(node?.epistemics) ? node.epistemics : (isObj(node) ? node : {})
  const url = safeUrl((String(e.note ?? '').match(URL_IN) || [])[0] || '')
  let host = ''; try { host = new URL(url).hostname.replace(/^www\./i, '') } catch (_) { /* no address */ }
  const kind = /\.gov(\/|$)/i.test(host + '/') ? 'report' : (/wikipedia\.org$/i.test(host) ? 'other' : 'news')
  const label = clean(e.source, LIMITS.title)
  return sanitizeSource({ title: label || host, publisher: host, url, kind, note: '' })
}
/** a one-line reading for lists and tooltips */
export function describeSource (source) {
  const s = sanitizeSource(source); const bits = [s.title || '(untitled source)']
  if (s.publisher) bits.push(s.publisher); if (s.published) bits.push(s.published)
  bits.push(s.proximity + ' ' + s.kind, 'trust ' + Math.round(effectiveTrust(s) * 100) + '%')
  if (s.status !== 'live') bits.push(s.status)
  return bits.join(' · ')
}
