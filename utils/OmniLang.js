/**
 * utils/OmniLang.js (V219) — the grammar of the Omni command language. Pure text in, plain objects out.
 *
 *   Omni <Keyword> <action>[(arg)] [name(value)]... [word]...
 *
 *   Omni Draw node(static) pos(0, 0, 0)
 *   Omni Node set id(box1) pos(2, 0, 4) color(#ff8800)
 *   Omni File write /home/notes/todo.txt text("buy milk")
 *
 * Words are separated by SPACES (nothing else). A word is `name` or `name(value)`; a value may hold spaces and commas, nested
 * parentheses and "quoted text". `Omni` is the root, then the keyword (the system), then the action; everything after is a property
 * (`name(value)`) or a bare word (a path, or a flag such as `confirm`). Names are not case-sensitive.
 * Values: numbers, true / false, "text", bare text; a comma list becomes an array: pos(0, 0, 0) -> [0, 0, 0].
 * parseLine(line, { root }) -> { ok, keyword, action, arg, props, words, error, col }.  parseScript(text) -> lines with numbers; # and // start a comment.
 */
const NAME_CHARS = /[^\s()"]/
export const MAX_LINE = 2000

/** split a value's text on top-level commas */
function splitTop (s) {
  const out = []; let depth = 0, q = false, cur = ''
  for (const ch of s) {
    if (ch === '"') q = !q
    if (!q && ch === '(') depth++
    if (!q && ch === ')') depth--
    if (!q && depth === 0 && ch === ',') { out.push(cur); cur = ''; continue }
    cur += ch
  }
  out.push(cur); return out
}
export function parseScalar (raw) {
  const t = String(raw).trim()
  if (t === '') return undefined
  if (t.length >= 2 && t[0] === '"' && t[t.length - 1] === '"') return t.slice(1, -1)
  if (/^-?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(t)) return Number(t)
  if (/^true$/i.test(t)) return true
  if (/^false$/i.test(t)) return false
  return t
}
export function parseValue (raw) {
  const t = String(raw ?? '').trim()
  if (t === '') return undefined
  if (t[0] === '"' && t.indexOf('"', 1) === t.length - 1) return t.slice(1, -1)
  const parts = splitTop(t)
  if (parts.length === 1) return parseScalar(parts[0])
  return parts.map(parseScalar)
}

/** tokens: [{ name, arg (raw text or undefined), col, quoted }] or { error, col } */
export function tokenize (line) {
  const toks = []; let i = 0; const n = line.length
  while (i < n) {
    const ch = line[i]
    if (/\s/.test(ch)) { i++; continue }
    const start = i
    if (ch === '"') {
      const end = line.indexOf('"', i + 1)
      if (end < 0) return { error: 'a quote is not closed', col: start + 1 }
      toks.push({ name: line.slice(i + 1, end), quoted: true, col: start + 1 }); i = end + 1; continue
    }
    if (ch === '(' || ch === ')') return { error: `unexpected "${ch}"`, col: start + 1 }
    while (i < n && NAME_CHARS.test(line[i])) i++
    const name = line.slice(start, i)
    if (line[i] === '(') {
      let depth = 0, q = false, j = i
      for (; j < n; j++) {
        const c = line[j]
        if (c === '"') q = !q
        if (q) continue
        if (c === '(') depth++
        else if (c === ')') { depth--; if (depth === 0) break }
      }
      if (j >= n) return { error: `"${name}(" is missing its ")"`, col: i + 1 }
      toks.push({ name, arg: line.slice(i + 1, j), col: start + 1 }); i = j + 1
    } else toks.push({ name, col: start + 1 })
  }
  return toks
}

export function parseLine (line, { root = true } = {}) {
  const text = String(line ?? '').replace(/^\s*⟐\s*/, '').trim()
  if (!text) return { ok: false, error: 'empty line', col: 1 }
  if (text.length > MAX_LINE) return { ok: false, error: `line is longer than ${MAX_LINE} characters`, col: MAX_LINE }
  const toks = tokenize(text)
  if (!Array.isArray(toks)) return { ok: false, error: toks.error, col: toks.col }
  let at = 0
  if (toks[0] && toks[0].name.toLowerCase() === 'omni' && toks[0].arg === undefined && !toks[0].quoted) at = 1
  else if (root === true) return { ok: false, error: 'start with "Omni"', col: 1 }
  const kw = toks[at], act = toks[at + 1]
  if (!kw || kw.arg !== undefined || kw.quoted) return { ok: false, error: 'give a keyword after Omni, for example "Omni Draw node(static)"', col: kw?.col ?? text.length + 1 }
  if (!act || act.quoted) return { ok: true, keyword: kw.name, action: '', arg: undefined, props: {}, words: [] }
  const props = {}, words = []
  for (const t of toks.slice(at + 2)) {
    if (t.arg !== undefined) props[t.name.toLowerCase()] = parseValue(t.arg)
    else words.push(t.name)
  }
  return { ok: true, keyword: kw.name, action: act.name, arg: act.arg !== undefined ? parseValue(act.arg) : undefined, props, words }
}

/** a script: one command per line; blank lines and lines starting # or // are skipped; a line without "Omni" gets it added */
export function parseScript (text) {
  const out = []
  String(text ?? '').split(/\r?\n/).forEach((raw, i) => {
    let s = raw.replace(/\s+\/\/.*$/, '').trim()
    if (!s || s.startsWith('#') || s.startsWith('//')) return
    out.push({ line: i + 1, text: s, parsed: parseLine(/^⟐?\s*omni(\s|$)/i.test(s) ? s : 'Omni ' + s) })
  })
  return out
}

/** numeric helpers for handlers */
export function asVec3 (v, name = 'value') {
  if (!Array.isArray(v) || v.length !== 3 || v.some(x => typeof x !== 'number' || !Number.isFinite(x) || Math.abs(x) > 1e6)) throw new Error(`${name} needs three numbers, for example ${name}(0, 1, 0)`)
  return v
}
