/**
 * utils/OmniBrackets.js (V233) — "bracket finishers" for the OmniIDE: pure text functions, no DOM.
 *
 *   closeOnType(text, a, b, key, opt)   typing ( [ { " ' : adds the closer after the cursor, wraps a selection, or types over a closer that is already there
 *   deletePair(text, a, b)              Backspace between an empty pair () [] {} "" '' removes both
 *   enterBetween(text, a, b, tab)       Enter between { } ( ) [ ] opens a blank indented line and keeps the closer on its own line
 *   scan(text, { comments })            matches brackets: { depthAt, partner, unmatched }  (skips strings, and # // line comments when asked)
 *   matchNear(info, pos)                the bracket touching the caret and its partner, or null
 *   decorate(segs, lineStart, info, opt)  splits highlight segments [{text,cls}] so each bracket gets class b0..b5 (depth), bm (the match) or bx (no partner)
 * Every edit function returns { text, a, b } (new text, new selection start / end) or null when it does nothing, so the caller lets the key through.
 */
export const PAIRS = { '(': ')', '[': ']', '{': '}', '"': '"', "'": "'" }
const CLOSERS = new Set(Object.values(PAIRS))
const isWord = (c) => !!c && /[A-Za-z0-9_]/.test(c)
const edit = (text, a, b, ins, selA, selB = selA) => ({ text: text.slice(0, a) + ins + text.slice(b), a: selA, b: selB })

export function closeOnType (text, a, b, key, opt = {}) {
  const o = { autoClose: true, autoSkip: true, wrapSelection: true, ...opt }
  const isOpen = key in PAIRS, isClose = CLOSERS.has(key)
  if (!isOpen && !isClose) return null
  const next = text[b], prev = text[a - 1]
  if (a !== b) {   // a selection
    if (isOpen && o.wrapSelection) return edit(text, a, b, key + text.slice(a, b) + PAIRS[key], a + 1, b + 1)
    return null
  }
  if (isClose && o.autoSkip && next === key) return { text, a: a + 1, b: a + 1 }                // type over the closer that is already there
  if (!isOpen || !o.autoClose) return null
  const quote = key === '"' || key === "'"
  if (quote && (isWord(prev) || (prev === key))) return null                                      // it's, "" -> do not double up inside a word
  if (next !== undefined && !/[\s)\]}.,;:]/.test(next) && !(quote && next === key)) return null  // only close when what follows is blank or a closer
  return edit(text, a, b, key + PAIRS[key], a + 1)
}

export function deletePair (text, a, b) {
  if (a !== b || a < 1) return null
  const o = text[a - 1], c = text[a]
  return o in PAIRS && PAIRS[o] === c ? edit(text, a - 1, a + 1, '', a - 1) : null
}

export function enterBetween (text, a, b, tab = '  ') {
  const o = text[a - 1], c = text[b]
  const ls = text.lastIndexOf('\n', a - 1) + 1, indent = /^[ \t]*/.exec(text.slice(ls, a))[0]
  if (a === b && o in PAIRS && o !== '"' && o !== "'" && PAIRS[o] === c) { const ins = '\n' + indent + tab + '\n' + indent; return edit(text, a, b, ins, a + 1 + indent.length + tab.length) }
  if (!indent) return null
  return edit(text, a, b, '\n' + indent, a + 1 + indent.length)                                   // keep the line's indent
}

export function scan (text, { comments = false } = {}) {
  const stack = [], partner = new Map(), depthAt = new Map(), unmatched = new Set()
  let i = 0, str = null
  while (i < text.length) {
    const ch = text[i]
    if (str) { if (ch === '\\') { i += 2; continue } if (ch === str || ch === '\n') str = null; i++; continue }
    // an Omni comment is a whole line starting with # or // (so a colour like color(#ff8800) is not a comment)
    if (comments && (ch === '#' || (ch === '/' && text[i + 1] === '/')) && /^[ \t]*$/.test(text.slice(text.lastIndexOf('\n', i - 1) + 1, i))) { while (i < text.length && text[i] !== '\n') i++; continue }
    if (ch === '"' || ch === "'") { str = ch; i++; continue }
    if (ch === '(' || ch === '[' || ch === '{') { depthAt.set(i, stack.length); stack.push({ ch, i }) }
    else if (ch === ')' || ch === ']' || ch === '}') {
      const top = stack[stack.length - 1]
      if (top && PAIRS[top.ch] === ch) { stack.pop(); partner.set(top.i, i); partner.set(i, top.i); depthAt.set(i, stack.length) }
      else { unmatched.add(i); depthAt.set(i, Math.max(0, stack.length - 1)) }
    }
    i++
  }
  for (const s of stack) unmatched.add(s.i)
  return { depthAt, partner, unmatched }
}

export function matchNear (info, pos) {
  for (const p of [pos - 1, pos]) if (info.partner.has(p)) return { at: p, other: info.partner.get(p) }
  return null
}

export function decorate (segs, lineStart, info, { colorPairs = true, highlightMatch = true, match = null, nColors = 6 } = {}) {
  if (!colorPairs && !highlightMatch) return segs
  const out = []; let off = lineStart
  for (const s of segs) {
    if (s.cls === 'c' || s.cls === 'str') { out.push(s); off += s.text.length; continue }          // never recolour a comment or a string
    let buf = '', start = 0
    const flush = () => { if (buf) { out.push({ text: buf, cls: s.cls }); buf = '' } }
    for (let k = 0; k < s.text.length; k++) {
      const ch = s.text[k], pos = off + k
      if ('()[]{}'.includes(ch) && info.depthAt.has(pos)) {
        flush()
        let cls = info.unmatched.has(pos) ? 'bx' : (colorPairs ? 'b' + (info.depthAt.get(pos) % nColors) : s.cls)
        if (highlightMatch && match && (pos === match.at || pos === match.other)) cls += ' bm'
        out.push({ text: ch, cls })
      } else buf += ch
      start = k
    }
    flush(); off += s.text.length
  }
  return out
}
