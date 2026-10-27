/**
 * utils/OmniLangRegistry.js (V219) — where systems register what the Omni language can do, and the runner.
 *
 *   registerOmni('Draw', 'node', { summary, arg, props: { pos: 'x, y, z', ... }, words: { confirm: '...' }, destructive?, run (call, ctx) {...} })
 *   runOmniLine(line, ctx)  -> Promise<{ ok, output | error }>
 *   runOmniScript(text, ctx, { dry, keepGoing, maxLines }) -> Promise<{ ok, results:[{ line, text, ok, output|error }] }>
 *   completeOmni(text)      -> { from, items:[{ text, hint }] }   (keywords, then actions, then properties)
 * call = { keyword, action, arg, props, words, has(word) }. Unknown properties are refused with the list of known ones.
 * A destructive action only runs when the line carries the word `confirm`.
 */
import { parseLine, parseScript } from './OmniLang.js'

const KEYWORDS = new Map()   // lc keyword -> { name, summary, actions: Map(lc action -> spec) }
export const MAX_SCRIPT_LINES = 500

export function registerOmni (keyword, action, spec) {
  const k = String(keyword).toLowerCase()
  let kw = KEYWORDS.get(k)
  if (!kw) { kw = { name: keyword, summary: '', actions: new Map() }; KEYWORDS.set(k, kw) }
  if (spec?.keywordSummary) kw.summary = spec.keywordSummary
  if (spec?.keywordBare) kw.bare = true   // the word after the keyword is an argument, not an action (Omni Help Draw)
  if (action) kw.actions.set(String(action).toLowerCase(), { name: action, ...spec })
}
export const listKeywords = () => [...KEYWORDS.values()].map(k => ({ name: k.name, summary: k.summary, actions: [...k.actions.values()].map(a => a.name) }))
export const getKeyword = (name) => KEYWORDS.get(String(name).toLowerCase()) ?? null
export const isOmniKeyword = (name) => KEYWORDS.has(String(name).toLowerCase())
export const getAction = (kw, action) => getKeyword(kw)?.actions.get(String(action).toLowerCase()) ?? null

function check (p) {
  const kw = getKeyword(p.keyword)
  if (!kw) return { error: `unknown keyword "${p.keyword}" (try: ${listKeywords().map(k => k.name).join(', ')})` }
  if (kw.bare && !kw.actions.has(String(p.action).toLowerCase())) { if (p.action) p.words.unshift(p.action); p.action = [...kw.actions.values()][0].name }
  if (!p.action) return { error: `${kw.name} needs an action (${[...kw.actions.values()].map(a => a.name).join(', ')})` }
  const spec = kw.actions.get(p.action.toLowerCase())
  if (!spec) return { error: `${kw.name} has no action "${p.action}" (${[...kw.actions.values()].map(a => a.name).join(', ')})` }
  const known = Object.keys(spec.props ?? {})
  const bad = Object.keys(p.props).filter(k => !known.includes(k.toLowerCase()) && k !== 'confirm')
  if (bad.length) return { error: `${kw.name} ${spec.name}: unknown property "${bad[0]}"${known.length ? ` (known: ${known.join(', ')})` : ' (it takes none)'}` }
  const confirmed = p.words.some(w => w.toLowerCase() === 'confirm') || p.props.confirm === true
  if (spec.destructive && !confirmed) return { error: `${kw.name} ${spec.name} changes things for good: add the word "confirm" to run it` }
  return { spec, kw, confirmed }
}

export async function runParsed (p, ctx) {
  const c = check(p)
  if (c.error) return { ok: false, error: c.error }
  const call = { keyword: c.kw.name, action: c.spec.name, arg: p.arg, props: p.props, words: p.words, has: (w) => p.words.some(x => x.toLowerCase() === String(w).toLowerCase()) }
  try {
    const out = await c.spec.run(call, ctx ?? {})
    return { ok: true, output: out === undefined || out === null ? 'OK' : String(out) }
  } catch (err) { return { ok: false, error: `${c.kw.name} ${c.spec.name}: ${err?.message ?? err}` } }
}
export async function runOmniLine (line, ctx, opts = {}) {
  const p = parseLine(line, { root: opts.root ?? true })
  if (!p.ok) return { ok: false, error: `${p.error}${p.col ? ` (column ${p.col})` : ''}` }
  return runParsed(p, ctx)
}
export async function runOmniScript (text, ctx, { dry = false, keepGoing = false, maxLines = MAX_SCRIPT_LINES, onLine = null } = {}) {
  const lines = parseScript(text)
  if (lines.length > maxLines) return { ok: false, results: [{ line: 0, text: '', ok: false, error: `a script can have at most ${maxLines} commands` }] }
  const results = []; let ok = true
  for (const L of lines) {
    let r
    if (!L.parsed.ok) r = { ok: false, error: `${L.parsed.error}${L.parsed.col ? ` (column ${L.parsed.col})` : ''}` }
    else if (dry) { const c = check(L.parsed); r = c.error ? { ok: false, error: c.error } : { ok: true, output: `(dry) ${c.kw.name} ${c.spec.name}` } }
    else r = await runParsed(L.parsed, ctx)
    const row = { line: L.line, text: L.text, ...r }; results.push(row)
    try { onLine?.(row) } catch (_) {}
    if (!r.ok) { ok = false; if (!keepGoing) break }
  }
  return { ok, results }
}

/** completion for what has been typed so far (the last word is the one being completed) */
export function completeOmni (text) {
  const raw = String(text ?? '').replace(/^\s*⟐\s*/, '')
  const m = /^(\s*)(.*?)(\S*)$/.exec(raw); const lead = m[1], before = m[2], last = m[3]
  const words = before.trim() ? before.trim().split(/\s+/) : []
  const from = raw.length - last.length
  let w = words; if (w[0] && w[0].toLowerCase() === 'omni') w = w.slice(1)
  const lc = last.toLowerCase(), hasOmni = raw.trim().toLowerCase().startsWith('omni')
  const items = []
  if (!hasOmni && words.length === 0) { if ('omni'.startsWith(lc)) items.push({ text: 'Omni', hint: 'start an Omni command' }); for (const k of listKeywords()) if (k.name.toLowerCase().startsWith(lc)) items.push({ text: k.name, hint: k.summary }) }
  else if (w.length === 0) for (const k of listKeywords()) { if (k.name.toLowerCase().startsWith(lc)) items.push({ text: k.name, hint: k.summary }) }
  else if (w.length === 1) { const kw = getKeyword(w[0]); if (kw) for (const a of kw.actions.values()) if (a.name.toLowerCase().startsWith(lc)) items.push({ text: a.name, hint: a.summary ?? '' }) }
  else { const spec = getAction(w[0], w[1].replace(/\(.*$/, '')); if (spec) { for (const [p, d] of Object.entries(spec.props ?? {})) if (p.startsWith(lc) && !/\(/.test(last)) items.push({ text: p + '(', hint: d }); if (spec.destructive && 'confirm'.startsWith(lc)) items.push({ text: 'confirm', hint: 'required to run this' }) } }
  return { from, items }
}
