/**
 * utils/OmniDocsMarkdown.js — a tiny, SAFE markdown reader for the in-app Docs panel (V190). Pure: no DOM, no innerHTML, no imports.
 *
 * It does not produce HTML. It produces a plain block tree that ui/OmniDocsPanel.js turns into DOM nodes with createElement /
 * textContent only, so nothing in the markdown (a <script>, an onerror=, a javascript: link) can ever run or be parsed as markup.
 * Supported (what docs/user-guide/*.md uses): # headings (1-6), paragraphs, - / * bullet lists, 1. numbered lists (one level of
 * indentation is folded into the item), > quotes, --- rules, ``` fenced code, pipe tables (with the --- separator row and \| escapes),
 * and inline `code`, **bold**, *italic* / _italic_, [label](href). A link keeps its href as DATA: the panel renders it as text, and
 * only turns it into a "go to page" button when pageIdForHref() maps it to another guide page. Anything else is plain text.
 *
 * Also here (shared with tools/build-docs-data.mjs so both agree): docIdFromFile(), slugify(), extractHeadings().
 */

export const MAX_INLINE_DEPTH = 4

/** GitHub-like heading slug: lowercase, diacritics stripped, non-alphanumerics -> '-', trimmed. */
export function slugify (s) {
  let t = String(s ?? '')
  try { t = t.normalize('NFKD') } catch (_) { /* keep */ }
  return t.replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

/** '01_Getting_Started.md' -> '01-getting-started'; 'README.md' -> 'index'. */
export function docIdFromFile (file) {
  const base = String(file ?? '').split('/').pop().replace(/\.md$/i, '')
  if (base.toLowerCase() === 'readme') return 'index'
  return slugify(base)
}

/** A markdown link target -> a guide page id (+ optional heading id) or null when it is not one of the guide's own pages. */
export function pageIdForHref (href) {
  const m = /^(?:\.\/)?([A-Za-z0-9_]+\.md)(?:#([A-Za-z0-9_-]*))?$/.exec(String(href ?? '').trim())
  if (!m) return null
  return { pageId: docIdFromFile(m[1]), headingId: m[2] ? slugify(m[2]) : '' }
}

/** Plain text of a heading line (inline markers removed). */
export function plainText (s) {
  return String(s ?? '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[`*_]/g, '').replace(/\\(.)/g, '$1').trim()
}

/** All headings of a markdown text, outside code fences: [{ level, text, id }] with unique ids. */
export function extractHeadings (md) {
  const out = []; const seen = new Map()
  let fence = false
  for (const line of String(md ?? '').split(/\r?\n/)) {
    if (/^\s*```/.test(line)) { fence = !fence; continue }
    if (fence) continue
    const m = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line)
    if (!m) continue
    const text = plainText(m[2])
    if (!text) continue
    let id = slugify(text) || 'section'
    const n = seen.get(id) ?? 0; seen.set(id, n + 1)
    if (n) id = `${id}-${n + 1}`
    out.push({ level: m[1].length, text, id })
  }
  return out
}

// ── inline ────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Inline text -> tokens: { t:'text', s } | { t:'code', s } | { t:'b'|'i', c:[...] } | { t:'link', c:[...], href }. */
export function parseInline (src, depth = 0) {
  const s = String(src ?? '')
  const out = []
  let buf = ''
  const flush = () => { if (buf) { out.push({ t: 'text', s: buf }); buf = '' } }
  let i = 0
  while (i < s.length) {
    const ch = s[i]
    if (ch === '\\' && i + 1 < s.length && /[\\`*_{}[\]()#+\-.!|<>~]/.test(s[i + 1])) { buf += s[i + 1]; i += 2; continue }
    if (ch === '`') {
      const j = s.indexOf('`', i + 1)
      if (j > i) { flush(); out.push({ t: 'code', s: s.slice(i + 1, j) }); i = j + 1; continue }
    }
    if (depth < MAX_INLINE_DEPTH) {
      if ((ch === '*' && s[i + 1] === '*') || (ch === '_' && s[i + 1] === '_')) {
        const mark = ch + ch, j = s.indexOf(mark, i + 2)
        if (j > i + 2) { flush(); out.push({ t: 'b', c: parseInline(s.slice(i + 2, j), depth + 1) }); i = j + 2; continue }
      }
      if ((ch === '*' || ch === '_') && s[i + 1] !== ch && s[i + 1] !== ' ' && s[i + 1] !== undefined) {
        const prev = s[i - 1]
        if (ch === '*' || !prev || !/[A-Za-z0-9]/.test(prev)) {              // _ inside a word (snake_case) is not emphasis
          let j = i + 1
          while ((j = s.indexOf(ch, j)) > 0 && (s[j - 1] === ' ' || s[j + 1] === ch || (ch === '_' && /[A-Za-z0-9]/.test(s[j + 1] ?? '')))) j++
          if (j > i + 1) { flush(); out.push({ t: 'i', c: parseInline(s.slice(i + 1, j), depth + 1) }); i = j + 1; continue }
        }
      }
      if (ch === '[') {
        const close = s.indexOf('](', i + 1)
        if (close > i) {
          let end = -1, depthP = 0                                          // the closing ) of the href, allowing balanced ( ) inside it
          for (let k = close + 2; k < s.length && k < close + 2 + 2000; k++) { if (s[k] === '(') depthP++; else if (s[k] === ')') { if (depthP === 0) { end = k; break } depthP-- } }
          if (end > close) {
            flush()
            out.push({ t: 'link', c: parseInline(s.slice(i + 1, close), depth + 1), href: s.slice(close + 2, end).trim() })
            i = end + 1; continue
          }
        }
      }
    }
    buf += ch; i++
  }
  flush()
  return out
}

/** Tokens -> plain text (used for search and the data builder). */
export function inlineText (tokens) {
  return (tokens ?? []).map(t => (t.t === 'text' || t.t === 'code') ? t.s : inlineText(t.c)).join('')
}

// ── blocks ────────────────────────────────────────────────────────────────────────────────────────────────────────────────

function splitRow (line) {
  let t = line.trim()
  if (t.startsWith('|')) t = t.slice(1)
  if (t.endsWith('|') && !t.endsWith('\\|')) t = t.slice(0, -1)
  const cells = []; let cur = ''
  for (let i = 0; i < t.length; i++) {
    if (t[i] === '\\' && t[i + 1] === '|') { cur += '|'; i++ } else if (t[i] === '|') { cells.push(cur.trim()); cur = '' } else cur += t[i]
  }
  cells.push(cur.trim())
  return cells
}
const isSep = (line) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line) && line.includes('-')
const isRule = (line) => /^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)
const bulletRe = /^(\s*)[-*+]\s+(.*)$/
const orderedRe = /^(\s*)\d+[.)]\s+(.*)$/

/**
 * Markdown text -> blocks:
 *   { t:'h', level, id, c } · { t:'p', c } · { t:'ul'|'ol', items:[c...] } · { t:'quote', c } · { t:'code', lang, s } ·
 *   { t:'table', head:[c...], rows:[[c...]...] } · { t:'hr' }      (c = inline tokens)
 * Heading ids equal extractHeadings() ids (same counter). Caps: 5000 lines, 400 table rows.
 */
export function parseMarkdown (md) {
  const lines = String(md ?? '').split(/\r?\n/).slice(0, 5000)
  const blocks = []; const seen = new Map()
  let i = 0
  const startOfBlock = (l) => /^\s*```/.test(l) || /^#{1,6}\s/.test(l) || /^\s*>/.test(l) || isRule(l) || bulletRe.test(l) || orderedRe.test(l) || (l.includes('|') && l.trim().startsWith('|'))
  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) { i++; continue }
    let m
    if ((m = /^\s*```\s*([A-Za-z0-9_-]*)/.exec(line))) {
      const buf = []; i++
      while (i < lines.length && !/^\s*```/.test(lines[i])) buf.push(lines[i++])
      i++
      blocks.push({ t: 'code', lang: m[1] || '', s: buf.join('\n') })
      continue
    }
    if ((m = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line))) {
      const text = plainText(m[2]); let id = slugify(text) || 'section'
      const n = seen.get(id) ?? 0; seen.set(id, n + 1); if (n) id = `${id}-${n + 1}`
      blocks.push({ t: 'h', level: m[1].length, id, c: parseInline(m[2]) }); i++; continue
    }
    if (isRule(line)) { blocks.push({ t: 'hr' }); i++; continue }
    if (line.trim().startsWith('|') && i + 1 < lines.length && isSep(lines[i + 1])) {
      const head = splitRow(line).map(c => parseInline(c)); i += 2
      const rows = []
      while (i < lines.length && lines[i].trim().startsWith('|') && rows.length < 400) rows.push(splitRow(lines[i++]).map(c => parseInline(c)))
      blocks.push({ t: 'table', head, rows }); continue
    }
    if (/^\s*>/.test(line)) {
      const buf = []
      while (i < lines.length && /^\s*>/.test(lines[i])) buf.push(lines[i++].replace(/^\s*>\s?/, ''))
      blocks.push({ t: 'quote', c: parseInline(buf.join(' ')) }); continue
    }
    if ((m = bulletRe.exec(line)) || (m = orderedRe.exec(line))) {
      const ordered = !bulletRe.test(line); const items = []
      while (i < lines.length) {
        const mm = (ordered ? orderedRe : bulletRe).exec(lines[i])
        if (mm) { items.push(mm[2]); i++; continue }
        if (items.length && /^\s{2,}\S/.test(lines[i]) && !startOfBlock(lines[i])) { items[items.length - 1] += ' ' + lines[i].trim(); i++; continue }   // wrapped line of the item
        break
      }
      blocks.push({ t: ordered ? 'ol' : 'ul', items: items.map(x => parseInline(x)) }); continue
    }
    const buf = [line.trim()]; i++
    while (i < lines.length && lines[i].trim() && !startOfBlock(lines[i])) buf.push(lines[i++].trim())
    blocks.push({ t: 'p', c: parseInline(buf.join(' ')) })
  }
  return blocks
}

// ── search helpers (shared by the Docs panel's find / highlight) ──────────────────────────────────────────────────────────

export const MAX_TERMS = 6
export const MAX_TERM_LEN = 60

/** Fold ONE character for matching: lowercase and without diacritics, always exactly one UTF-16 unit so indexes line up with the original text. */
function foldChar (c) {
  let f = c
  try { f = c.normalize('NFD').replace(/[̀-ͯ]/g, '') } catch (_) { /* keep */ }
  f = f.toLowerCase()
  if (f.length === 1) return f
  const l = c.toLowerCase()
  return l.length === 1 ? l : c
}
/** Fold a whole string char by char (same length as the input). */
export function foldText (s) {
  const t = String(s ?? '')
  let out = ''
  for (let i = 0; i < t.length; i++) out += foldChar(t[i])
  return out
}

/** A search box value -> up to MAX_TERMS folded words (a word longer than MAX_TERM_LEN is cut). */
export function splitTerms (query) {
  const q = typeof query === 'string' ? query.slice(0, 400) : ''
  return foldText(q).split(/\s+/).filter(Boolean).slice(0, MAX_TERMS).map(t => t.slice(0, MAX_TERM_LEN))
}

/** Where do the terms occur in `text`? Sorted, merged [start, end) ranges on the ORIGINAL string (diacritics / case insensitive). */
export function findMatches (text, terms) {
  const t = String(text ?? '')
  if (!t || !terms?.length) return []
  const f = foldText(t)
  const r = []
  for (const term of terms) {
    if (!term) continue
    let at = 0
    while ((at = f.indexOf(term, at)) >= 0) { r.push([at, at + term.length]); at += term.length }
  }
  r.sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const merged = []
  for (const x of r) {
    const last = merged[merged.length - 1]
    if (last && x[0] <= last[1]) last[1] = Math.max(last[1], x[1]); else merged.push([x[0], x[1]])
  }
  return merged
}

/** How many times the terms hit a page's text, or -1 when ANY term is missing from it (a page matches only if it holds every word). */
export function pageMatchCount (text, terms, folded) {
  if (!terms?.length) return 0
  const f = typeof folded === 'string' ? folded : foldText(text)      // pass the cached foldText(text) to skip the per-character fold
  let total = 0
  for (const term of terms) {
    let at = 0, n = 0
    while ((at = f.indexOf(term, at)) >= 0) { n++; at += term.length }
    if (!n) return -1
    total += n
  }
  return total
}
