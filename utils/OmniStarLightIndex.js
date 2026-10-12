/**
 * utils/OmniStarLightIndex.js — the pure matching + ranking behind OmniStarLight (V190). No DOM, no storage, no imports.
 *
 * OmniStarLight (ui/OmniStarLight.js) is the Spotlight-style search. It asks THIS module two questions:
 *   searchSites(sites, query)  -> the main sites / areas that match, best first   (sites come from utils/OmniStarLightSites.js)
 *   searchDocs(pages, query)   -> the user-guide pages / headings that match      (pages are data/OmniDocsData.js entries)
 *   buildResults(...)          -> the grouped, capped list the panel renders (an EMPTY query lists every site, Available then Unavailable)
 *
 * Matching rules (all case-insensitive and diacritics-insensitive; punctuation and glyphs such as ⟐ count as spaces):
 *   - the query is split into words (at most MAX_TOKENS); EVERY word must match somewhere, or the item is dropped;
 *   - a word scores by where it hits the NAME: exact 100 > starts the name 92 > starts a word of the name 78 (camelCase words
 *     count: "OmniStore" has the words omni + store) > inside the name 58; then keywords (prefix 48 / inside 34) and the
 *     description (inside 18). So a prefix always beats a plain substring;
 *   - the item's score is the average of its words' scores, +6 when the whole query starts the name;
 *   - ties keep a stable order (Available first, then the input order).
 * Hostile input is safe: non-strings become '', the query is cut to MAX_QUERY characters, no regular expression is ever built from
 * the query (indexOf only), results are capped (MAX_SITE_RESULTS / MAX_DOC_RESULTS / MAX_RESULTS).
 */

export const MAX_QUERY = 80
export const MAX_TOKENS = 6
export const MAX_SITE_RESULTS = 14
export const MAX_DOC_RESULTS = 8
export const MAX_RESULTS = 22

/** Lowercase, strip diacritics (NFD + combining marks), turn every non letter / digit into a space, collapse spaces. Never throws. */
export function normalize (s) {
  if (typeof s !== 'string' || !s) return ''
  let t = s.length > 4000 ? s.slice(0, 4000) : s
  try { t = t.normalize('NFD') } catch (_) { /* keep as is */ }
  return t.replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
}

/** "OmniStore" -> "omni store" (camelCase boundaries become word boundaries) before normalizing. */
function splitCamel (s) {
  return typeof s === 'string' ? s.replace(/([a-z0-9])([A-Z])/g, '$1 $2') : ''
}

export function tokenize (query) {
  const q = normalize(typeof query === 'string' ? query.slice(0, MAX_QUERY) : '')
  return q ? q.split(' ').slice(0, MAX_TOKENS) : []
}

/** A prepared haystack for one text (normalized whole + its words), cached by the caller. */
export function prep (text) {
  const flat = normalize(text)
  const spaced = normalize(splitCamel(text))
  return { flat, words: spaced ? spaced.split(' ') : [], spaced }
}

/** Score ONE word against a prepared NAME. 0 = no hit. */
export function scoreName (tok, name) {
  if (!tok || !name.flat) return 0
  if (name.flat === tok || name.spaced === tok) return 100
  if (name.flat.startsWith(tok) || name.spaced.startsWith(tok)) return 92
  if (name.words.some(w => w.startsWith(tok))) return 78
  if (name.flat.indexOf(tok) >= 0) return 58
  return 0
}

function scoreOne (tok, item) {
  let best = scoreName(tok, item.name)
  if (best >= 92) return best
  for (const k of item.kw) {
    const s = k.flat.startsWith(tok) || k.words.some(w => w.startsWith(tok)) ? 48 : (k.flat.indexOf(tok) >= 0 ? 34 : 0)
    if (s > best) best = s
  }
  if (best < 18 && item.desc.flat.indexOf(tok) >= 0) best = 18
  return best
}

/** Score a prepared item ({ name, kw[], desc }) against the query words; 0 when any word misses. */
export function scoreItem (toks, item) {
  if (!toks.length) return 0
  let sum = 0
  for (const t of toks) {
    const s = scoreOne(t, item)
    if (s <= 0) return 0
    sum += s
  }
  const whole = toks.join(' ')
  return Math.round(sum / toks.length + (item.name.flat.startsWith(whole) ? 6 : 0))
}

const siteCache = new WeakMap()
function siteItem (site) {
  let it = siteCache.get(site)
  if (!it) {
    it = { name: prep(site.name), kw: (Array.isArray(site.keywords) ? site.keywords : []).map(prep), desc: prep(site.desc) }
    siteCache.set(site, it)
  }
  return it
}

/** Sites that match, best first. An empty / blank query returns []: use groupSites() for the full list. */
export function searchSites (sites, query, { limit = MAX_SITE_RESULTS } = {}) {
  const toks = tokenize(query)
  if (!toks.length || !Array.isArray(sites)) return []
  const out = []
  sites.forEach((site, i) => {
    if (!site || typeof site !== 'object') return
    const score = scoreItem(toks, siteItem(site))
    if (score > 0) out.push({ kind: 'site', site, score, order: i })
  })
  out.sort((a, b) => (b.score - a.score) || (Number(b.site.available !== false) - Number(a.site.available !== false)) || (a.order - b.order))
  return out.slice(0, Math.max(0, Math.min(limit, MAX_SITE_RESULTS)))
}

/** The full list for an empty query: { available: [...], unavailable: [...] } (input order kept inside each). */
export function groupSites (sites) {
  const available = [], unavailable = []
  for (const s of Array.isArray(sites) ? sites : []) {
    if (!s || typeof s !== 'object') continue
    ;(s.available === false ? unavailable : available).push(s)
  }
  return { available, unavailable }
}

const docCache = new Map()   // page id -> { title, heads[], text }
function docItem (page) {
  const key = page.id
  const hit = docCache.get(key)
  if (hit && hit.src === page.text) return hit
  const heads = (Array.isArray(page.headings) ? page.headings : []).map(h => ({ h, name: prep(h.text), kw: [], desc: prep('') }))
  const it = { src: page.text, title: { name: prep(page.title), kw: [], desc: prep('') }, heads, body: normalize(page.text) }
  docCache.set(key, it)
  return it
}

/**
 * Guide pages that match: page-title hits, heading hits, then plain body hits (all words somewhere in the page). Each result is
 * { kind: 'page' | 'heading' | 'text', pageId, title, heading?: {text, id, level}, score }.
 */
export function searchDocs (pages, query, { limit = MAX_DOC_RESULTS } = {}) {
  const toks = tokenize(query)
  if (!toks.length || !Array.isArray(pages)) return []
  const out = []
  pages.forEach((page, i) => {
    if (!page || typeof page !== 'object' || typeof page.id !== 'string') return
    const it = docItem(page)
    const ts = scoreItem(toks, it.title)
    if (ts > 0) out.push({ kind: 'page', pageId: page.id, title: page.title, score: ts + 20, order: i })
    for (const hd of it.heads) {
      const hs = scoreItem(toks, hd)
      if (hs > 0) out.push({ kind: 'heading', pageId: page.id, title: page.title, heading: { text: hd.h.text, id: hd.h.id, level: hd.h.level }, score: hs + 10, order: i })
    }
    if (ts <= 0 && toks.every(t => it.body.indexOf(t) >= 0)) out.push({ kind: 'text', pageId: page.id, title: page.title, score: 12, order: i })
  })
  out.sort((a, b) => (b.score - a.score) || (a.order - b.order))
  return out.slice(0, Math.max(0, Math.min(limit, MAX_DOC_RESULTS)))
}

/**
 * The list the panel shows. Empty query: groups Available / Unavailable (every site). Otherwise: Sites (matching, Available ones
 * before Unavailable at equal score) then Docs. `flat` is the keyboard order (the same items the screen lists, top to bottom).
 */
export function buildResults (sites, pages, query, opts = {}) {
  const toks = tokenize(query)
  const groups = []
  if (!toks.length) {
    const g = groupSites(sites)
    if (g.available.length) groups.push({ id: 'available', label: 'Available', items: g.available.map(site => ({ kind: 'site', site, score: 0 })) })
    if (g.unavailable.length) groups.push({ id: 'unavailable', label: 'Unavailable', items: g.unavailable.map(site => ({ kind: 'site', site, score: 0 })) })
  } else {
    const hits = searchSites(sites, query, opts)
    if (hits.length) groups.push({ id: 'sites', label: 'Sites', items: hits })
    const docs = searchDocs(pages, query, opts)
    if (docs.length) groups.push({ id: 'docs', label: 'Docs', items: docs })
  }
  let flat = groups.flatMap(g => g.items)
  const cap = toks.length ? MAX_RESULTS : Infinity
  if (flat.length > cap) {                                   // trim from the end of the last groups
    let left = cap
    for (const g of groups) { g.items = g.items.slice(0, Math.max(0, left)); left -= g.items.length }
    flat = groups.flatMap(g => g.items)
  }
  return { query: typeof query === 'string' ? query.slice(0, MAX_QUERY) : '', empty: !toks.length, groups: groups.filter(g => g.items.length), flat }
}
