/**
 * utils/TerminalSession.js — V192: the ONE terminal session every surface shows (no THREE, no DOM except the window event).
 *
 * The terminal can be typed into on the scene panel (a TerminalShellTunnel), on the DOM panel (ui/OmniCommandTerminalPanel.js) or on both.
 * To keep them in sync they do not keep text of their own: they read and write this session.
 *
 *   lines    [{ text, cls }] the output (cls = the DOM class: 'oct-line' | 'oct-line--echo' | 'oct-line--error'), capped at MAX_LINES
 *   draft    the line being typed (shown with a caret on the scene panel, mirrored into the DOM input)
 *   history  submitted lines, newest last (arrow up / down)
 *   runner   fn(raw) set by the DOM panel (it owns the command context: cd target, scene access); it adds the echo and the result lines itself
 *
 * Every change announces `omni:terminal-session-changed` { kind: 'line'|'draft'|'clear'|'history', source }, `source` being who made the change
 * ('scene' | 'dom' | …) so a surface does not overwrite the control the user is typing in.
 */

export const MAX_LINES = 500
export const MAX_HISTORY = 100
export const MAX_DRAFT = 400
export const READY_LINE = 'Terminal ready. Type ⟐help.'
const CLS = { out: 'oct-line', echo: 'oct-line--echo', error: 'oct-line--error' }
export const LINE_CLASSES = Object.values(CLS)

let lines = [{ text: READY_LINE, cls: CLS.out }]
let draft = ''
let history = []
let histPos = -1
let runner = null

const announce = (kind, source) => {
  try { window.dispatchEvent(new CustomEvent('omni:terminal-session-changed', { detail: { kind, source: source ?? null } })) } catch (_) { /* no window */ }
}

export const getLines = () => lines.map(l => ({ ...l }))
export const getDraft = () => draft
export const getHistory = () => [...history]

export function addLine (text, cls = CLS.out, source) {
  const c = LINE_CLASSES.includes(cls) ? cls : CLS.out
  for (const part of String(text ?? '').split('\n')) lines.push({ text: part, cls: c })
  if (lines.length > MAX_LINES) lines = lines.slice(lines.length - MAX_LINES)
  announce('line', source)
}

export function setDraft (text, source) {
  const t = String(text ?? '').slice(0, MAX_DRAFT)
  if (t === draft) return false
  draft = t; histPos = -1
  announce('draft', source)
  return true
}

export function clearSession (source) {
  lines = [{ text: READY_LINE, cls: CLS.out }]; draft = ''; histPos = -1
  announce('clear', source)
}

/** Set (or with null remove) the command runner. Only the module that set a runner may remove it. */
export function setRunner (fn) { runner = typeof fn === 'function' ? fn : null }
export const hasRunner = () => !!runner
export function removeRunner (fn) { if (runner === fn) runner = null }

/** Submit one line (from either surface). Returns true when it ran. The draft is cleared. */
export function submit (raw, source) {
  const text = String(raw ?? '').trim()
  if (!text) return false
  if (history[history.length - 1] !== text) history.push(text)
  if (history.length > MAX_HISTORY) history = history.slice(history.length - MAX_HISTORY)
  histPos = -1
  draft = ''
  announce('draft', source)
  if (!runner) { addLine(`⟐ ${text.replace(/^⟐/, '')}`, CLS.echo, source); addLine('No command runner yet: open the OmniCommandTerminal panel once.', CLS.error, source); return true }
  try { runner(text, source) } catch (err) { addLine(err?.message ?? String(err), CLS.error, source) }
  return true
}

/** Arrow up (-1) / down (+1) through the history; sets and returns the draft. */
export function stepHistory (dir, source) {
  if (!history.length) return draft
  if (dir < 0) histPos = histPos < 0 ? history.length - 1 : Math.max(0, histPos - 1)
  else if (histPos >= 0) histPos = histPos + 1 >= history.length ? -1 : histPos + 1
  draft = histPos < 0 ? '' : history[histPos]
  announce('draft', source)
  return draft
}

/** Tests only: back to a fresh session and no runner. */
export function _resetSession () {
  lines = [{ text: READY_LINE, cls: CLS.out }]; draft = ''; history = []; histPos = -1; runner = null
}

// ── Layout for a fixed-size text surface (the canvas panel) ──────────────────

/** Split one line into rows of at most `cols` characters (an empty line is one empty row). */
export function wrapText (text, cols) {
  const c = Math.max(4, Math.floor(cols) || 4)
  const s = String(text ?? '')
  if (s.length <= c) return [s]
  const out = []
  for (let i = 0; i < s.length; i += c) out.push(s.slice(i, i + c))
  return out
}

/**
 * The last `rows` wrapped rows of the session: [{ text, cls }], the draft (prompt + text + caret) as the final row when `prompt` is given.
 * Pure: pass the lines and the draft in.
 */
export function layoutRows (allLines, draftText, cols, rows, { prompt = '⟐ ', caret = '▮', showCaret = true } = {}) {
  const out = []
  for (const l of allLines ?? []) for (const part of wrapText(l.text, cols)) out.push({ text: part, cls: l.cls })
  if (prompt != null) {
    const parts = wrapText(prompt + String(draftText ?? '') + (showCaret ? caret : ''), cols)
    parts.forEach((p, i) => out.push({ text: p, cls: 'draft', first: i === 0, last: i === parts.length - 1 }))
  }
  const n = Math.max(1, Math.floor(rows) || 1)
  return out.length > n ? out.slice(out.length - n) : out
}
