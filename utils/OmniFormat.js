/**
 * utils/OmniFormat.js (V222) — the formatter and the syntax colouring for .omni scripts. Pure, no DOM, no dependencies.
 *
 * formatOmniScript(text, { prefix }) -> { text, changed, errors:[{ line (in the formatted text), srcLine (before), message }] }
 *   prefix 'add' (default) every command line starts with "Omni"; 'remove' none does; 'keep' as typed.
 *   - one space between words; Keyword and Action in their registered casing; property names lower case
 *   - values tidy: pos(0, 0, 0), numbers as numbers, text quoted only when it has to be, true / false lower case
 *   - comments (# ..., // ..., and a trailing  // ...) are kept as written
 *   - no leading or trailing spaces, at most one blank line in a row, one final newline
 *   - a line that does not parse is left as typed (trimmed) and reported in `errors`; formatting never changes what a line means
 * highlightOmniLine(line) -> [{ text, cls }] whose texts join back to exactly `line`.
 *   cls: '' plain, 'c' comment, 'k0' the word Omni, 'kw' keyword, 'ac' action, 'pn' property name, 'wd' a bare word, 'num', 'str', 'bool', 'pu' punctuation.
 */
import { parseLine, parseScalar } from './OmniLang.js'
import { getKeyword } from './OmniLangRegistry.js'

const BARE = /^[^\s,()"]+$/

function serScalar (v) {
  if (typeof v === 'number') { if (!Number.isFinite(v)) throw new Error('not a finite number'); return String(v) }
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  const s = String(v ?? '')
  if (s === '') return '""'
  if (BARE.test(s) && parseScalar(s) === s) return s
  if (s.includes('"')) throw new Error('text with a quote mark cannot be written back safely')
  return `"${s}"`
}
export function serValue (v) {
  if (Array.isArray(v)) return v.map(serScalar).join(', ')
  return serScalar(v)
}

/** one command (no comment) -> its tidy form, or throws */
export function formatCommand (cmd, { prefix = 'add' } = {}) {
  const hadOmni = /^\s*⟐?\s*omni(\s|$)/i.test(cmd)
  const p = parseLine(hadOmni ? cmd : 'Omni ' + cmd)
  if (!p.ok) throw new Error(p.error + (p.col ? ` (column ${p.col})` : ''))
  const kw = getKeyword(p.keyword)
  const parts = []
  if (prefix === 'add' || (prefix === 'keep' && hadOmni)) parts.push('Omni')
  parts.push(kw ? kw.name : p.keyword)
  if (p.action) {
    const spec = kw?.actions.get(String(p.action).toLowerCase())
    parts.push((spec ? spec.name : p.action) + (p.arg !== undefined ? `(${serValue(p.arg)})` : ''))
  }
  for (const [k, v] of Object.entries(p.props)) parts.push(v === undefined ? k : `${k}(${serValue(v)})`)
  for (const w of p.words) parts.push(/\s/.test(w) ? `"${w}"` : w)
  return parts.join(' ')
}

export function formatOmniScript (text, { prefix = 'add' } = {}) {
  const src = String(text ?? '').replace(/\r\n?/g, '\n')
  const out = [], errors = []
  src.split('\n').forEach((raw, i) => {
    const line = raw.replace(/\s+$/, '').replace(/^\s+/, '')
    if (!line) { if (out.length && out[out.length - 1] !== '') out.push(''); return }
    if (line.startsWith('#') || line.startsWith('//')) { out.push(line); return }
    const m = /^(.*?)\s+(\/\/.*)$/.exec(line)
    const cmd = m ? m[1] : line, trail = m ? m[2] : ''
    try { out.push(formatCommand(cmd, { prefix }) + (trail ? '  ' + trail : '')) } catch (e) { errors.push({ line: out.length + 1, srcLine: i + 1, message: e.message }); out.push(line) }   // line = its line in the formatted text
  })
  while (out.length && out[out.length - 1] === '') out.pop()
  const result = out.length ? out.join('\n') + '\n' : ''
  return { text: result, changed: result !== src, errors }
}

// ── colouring ──
export function highlightOmniLine (line) {
  const L = String(line ?? ''), segs = []
  const push = (text, cls = '') => { if (text) segs.push({ text, cls }) }
  const lead = /^\s*/.exec(L)[0]; push(lead)
  let i = lead.length
  if (L.startsWith('#', i) || L.startsWith('//', i)) { push(L.slice(i), 'c'); return segs }
  let n = 0, sawOmni = false   // index of the word on the line (after an optional Omni)
  const NAME = /[^\s()"]/
  while (i < L.length) {
    const ch = L[i]
    if (/\s/.test(ch)) { let j = i; while (j < L.length && /\s/.test(L[j])) j++; const gap = L.slice(i, j)
      const rest = L.slice(j); if (j > i && rest.startsWith('//')) { push(gap); push(rest, 'c'); return segs } push(gap); i = j; continue }
    if (ch === '"') { const e = L.indexOf('"', i + 1); const end = e < 0 ? L.length : e + 1; push(L.slice(i, end), 'str'); i = end; n++; continue }
    if (ch === '(' || ch === ')') { push(ch, 'pu'); i++; continue }
    let j = i; while (j < L.length && NAME.test(L[j])) j++
    const word = L.slice(i, j)
    const isParen = L[j] === '('
    let cls
    if (!sawOmni && n === 0 && word.toLowerCase() === 'omni' && !isParen) { cls = 'k0'; sawOmni = true }
    else { cls = n === 0 ? 'kw' : n === 1 ? 'ac' : (isParen ? 'pn' : 'wd'); n++ }
    push(word, cls); i = j
    if (L[i] === '(') {   // the balanced value
      let depth = 0, q = false, k = i
      for (; k < L.length; k++) { const c = L[k]; if (c === '"') q = !q; if (q) continue; if (c === '(') depth++; else if (c === ')') { depth--; if (depth === 0) break } }
      const close = k < L.length ? k : L.length
      push('(', 'pu'); pushValue(L.slice(i + 1, close), push); if (k < L.length) push(')', 'pu'); i = k < L.length ? k + 1 : L.length
    }
  }
  return segs
}
function pushValue (v, push) {
  const re = /("[^"]*"?)|(-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(?![\w.#])|\b(true|false)\b|(,)|(\s+)|([^\s,"]+)/gi
  let m
  while ((m = re.exec(v))) {
    if (m[1]) push(m[1], 'str'); else if (m[2]) push(m[2], 'num'); else if (m[3]) push(m[3], 'bool')
    else if (m[4]) push(',', 'pu'); else push(m[0], '')
  }
}
