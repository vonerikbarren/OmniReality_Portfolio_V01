/**
 * utils/TerminalShells.js — V192: the TerminalShellTunnel MODEL and the ONE master on/off of all in-scene terminals (no THREE, no DOM).
 *
 * TerminalShellTunnel is a node kind (utils/OmniExtraKinds.js, data.nodeKind 'terminalShell'). The node only carries a reference:
 *     node.data = { nodeKind: 'terminalShell', shellId }
 * the settings of that shell live here (localStorage 'omni:terminal-shells:v1'):
 *     shell = { id, name, nodeId, orientation | null }      orientation null = use the Terminal settings default (utils/TerminalSettings.js)
 * The built-in tunnel at the centre of the Root (modules/TerminalTunnel.js) is a shell too, but it is not a node and has no record.
 *
 * MASTER ON/OFF — the mechanism copied from the hand tunnels (systems/OmniAxinator.js): ONE persisted flag, ONE announced state, and every
 * tunnel follows it, so a button can never leave one behind.
 *     omni:terminal-invoke  { toggle:true }  -> flip   (the Terminal buttons: ribbon, OmniStarLight)
 *     omni:terminal-invoke                   -> on     (F1, the `, OmniChat's Terminal tab)
 *     omni:terminal-dismiss                  -> off    (Escape, OmniChat leaving its Terminal tab)
 *     omni:terminal-shells-set { on }        -> set
 * Every one of them re-announces `omni:terminal-shells-state` { on, count, changed, source } even when the flag did not change, so a tunnel
 * that missed an earlier announcement realigns on the next press. A tunnel that is created later reads isOn() in its own init().
 * Persisted in localStorage 'omni:terminal-shells:on' ('1' / '0').
 */

import { sanitizeOrientation } from './TerminalOrientation.js'

export const STORE_KEY = 'omni:terminal-shells:v1'
export const ON_KEY = 'omni:terminal-shells:on'
export const CHANGED_EVENT = 'omni:terminal-shells-changed'
export const STATE_EVENT = 'omni:terminal-shells-state'
export const MAX_SHELLS = 12
export const MAX_NAME = 40
export const KIND_TERMINAL_SHELL = 'terminalShell'
export const SHELL_LABEL = 'TerminalShellTunnel'

const clip = (s, n) => { const t = String(s ?? '').trim(); return t.length > n ? t.slice(0, n) : t }
const ID_RE = /^tsh_[a-z0-9]{4,12}$/
export const isShellId = (v) => typeof v === 'string' && ID_RE.test(v)
const newId = () => 'tsh_' + Math.random().toString(36).slice(2, 8).padEnd(4, '0')

let shells = load()

function sanitizeRecord (r) {
  if (!r || typeof r !== 'object' || !isShellId(r.id)) return null
  return {
    id: r.id,
    name: clip(r.name, MAX_NAME) || SHELL_LABEL,
    nodeId: typeof r.nodeId === 'string' && r.nodeId ? r.nodeId.slice(0, 80) : null,
    orientation: r.orientation && typeof r.orientation === 'object' ? sanitizeOrientation(r.orientation).orientation : null,
  }
}

function load () {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null')
    const list = Array.isArray(raw?.shells) ? raw.shells : []
    const seen = new Set(); const out = []
    for (const r of list) { const s = sanitizeRecord(r); if (s && !seen.has(s.id)) { seen.add(s.id); out.push(s) } if (out.length >= MAX_SHELLS) break }
    return out
  } catch (_) { return [] }
}

function save (reason, id) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify({ v: 1, shells })) } catch (_) { /* storage unavailable: the model still works for this session */ }
  try { window.dispatchEvent(new CustomEvent(CHANGED_EVENT, { detail: { reason, id: id ?? null } })) } catch (_) { /* no window */ }
}

const copy = (s) => (s ? { ...s, orientation: s.orientation ? { ...s.orientation } : null } : null)

export const listShells = () => shells.map(copy)
export const getShell = (id) => copy(shells.find(s => s.id === id))
export const shellByNode = (nodeId) => copy(shells.find(s => s.nodeId === nodeId))
export const shellCount = () => shells.length

/** { ok, shell } or { ok:false, error }. */
export function createShell (opts = {}) {
  if (shells.length >= MAX_SHELLS) return { ok: false, error: `At most ${MAX_SHELLS} TerminalShellTunnel nodes.` }
  let id = isShellId(opts.id) ? opts.id : newId()
  while (shells.some(s => s.id === id)) id = newId()
  const rec = sanitizeRecord({ id, name: opts.name, nodeId: opts.nodeId ?? null, orientation: opts.orientation ?? null })
  shells.push(rec)
  save('create', id)
  return { ok: true, shell: copy(rec) }
}

/** Make sure a record exists for a stored node that references `id` (a node restored from a save whose model record is gone). */
export function ensureShell (id, nodeId, name) {
  if (!isShellId(id)) return null
  let s = shells.find(x => x.id === id)
  if (s) { if (nodeId && s.nodeId !== nodeId) { s.nodeId = nodeId; save('node', id) } return copy(s) }
  if (shells.length >= MAX_SHELLS) return null
  s = sanitizeRecord({ id, name, nodeId })
  shells.push(s)
  save('restore', id)
  return copy(s)
}

export function setNodeId (id, nodeId) {
  const s = shells.find(x => x.id === id)
  if (!s) return false
  s.nodeId = typeof nodeId === 'string' && nodeId ? nodeId : null
  save('node', id)
  return true
}

export function renameShell (id, name) {
  const s = shells.find(x => x.id === id)
  const n = clip(name, MAX_NAME)
  if (!s) return { ok: false, error: 'No such terminal shell.' }
  if (!n) return { ok: false, error: 'A name is needed.' }
  s.name = n
  save('rename', id)
  return { ok: true, shell: copy(s) }
}

/** orientation: an object (validated; a partial patch merges onto the shell's current one, or onto the default) or null (= follow the settings default). */
export function setShellOrientation (id, orientation, base) {
  const s = shells.find(x => x.id === id)
  if (!s) return { ok: false, error: 'No such terminal shell.' }
  if (orientation === null) { s.orientation = null; save('orientation', id); return { ok: true, shell: copy(s), rejected: [] } }
  const r = sanitizeOrientation(orientation, s.orientation ?? base)
  s.orientation = r.orientation
  save('orientation', id)
  return { ok: true, shell: copy(s), rejected: r.rejected }
}

export function deleteShell (id) {
  const i = shells.findIndex(x => x.id === id)
  if (i < 0) return false
  shells.splice(i, 1)
  save('delete', id)
  return true
}

/** Tests only (and "clear scene"): drop the records; `keepOn` keeps the master flag. */
export function _reset (keepOn = false) {
  shells = []
  try { localStorage.removeItem(STORE_KEY) } catch (_) { /* ignore */ }
  if (!keepOn) { on = false; try { localStorage.removeItem(ON_KEY) } catch (_) { /* ignore */ } }
  live.clear()
}
export function _reload () { shells = load(); on = readOn(); return listShells() }

// ── The effective orientation of a shell ─────────────────────────────────────

/** shell orientation, or the Terminal settings default when the shell has none (or is the built-in one, shellId null). */
export function effectiveOrientation (shellId, defaults) {
  const s = shellId ? shells.find(x => x.id === shellId) : null
  return sanitizeOrientation(s?.orientation ?? defaults).orientation
}

// ── Live tunnels (instances in the scene) ────────────────────────────────────

const live = new Set()
export const registerLive = (t) => { live.add(t) }
export const unregisterLive = (t) => { live.delete(t) }
export const liveCount = () => live.size
export const liveTunnels = () => [...live]

// ── Keyboard focus (which scene terminal receives typing; null = none) ───────

let focusKey = null
export const getFocus = () => focusKey
export function setFocus (key) {
  const next = key ?? null
  if (next === focusKey) return false
  focusKey = next
  try { window.dispatchEvent(new CustomEvent('omni:terminal-focus-changed', { detail: { key: focusKey } })) } catch (_) { /* no window */ }
  return true
}

// ── The master on / off ──────────────────────────────────────────────────────

function readOn () {
  try { return localStorage.getItem(ON_KEY) === '1' } catch (_) { return false }
}
let on = readOn()

export const isOn = () => on

function announce (changed, source) {
  try { window.dispatchEvent(new CustomEvent(STATE_EVENT, { detail: { on, count: live.size, changed, source: source ?? null } })) } catch (_) { /* no window */ }
}

/** Set the master flag, persist it and announce it (always, even when unchanged: tunnels realign). Returns the flag. */
export function setOn (value, source) {
  const next = !!value
  const changed = next !== on
  on = next
  try { localStorage.setItem(ON_KEY, on ? '1' : '0') } catch (_) { /* ignore */ }
  announce(changed, source)
  return on
}
export const toggle = (source) => setOn(!on, source)

let refs = 0
let handlers = null
/** Start listening to the invoke / dismiss / set events (reference counted: each tunnel module pairs retain() with release()). */
export function retain () {
  refs++
  if (handlers) return
  handlers = {
    invoke: (e) => { if (e?.detail && e.detail.toggle) toggle('invoke-toggle'); else setOn(true, 'invoke') },
    dismiss: () => setOn(false, 'dismiss'),
    set: (e) => setOn(!!e?.detail?.on, 'set'),
    request: () => announce(false, 'request'),
  }
  window.addEventListener('omni:terminal-invoke', handlers.invoke)
  window.addEventListener('omni:terminal-dismiss', handlers.dismiss)
  window.addEventListener('omni:terminal-shells-set', handlers.set)
  window.addEventListener('omni:terminal-shells-state-request', handlers.request)
}
export function release () {
  if (refs > 0) refs--
  if (refs > 0 || !handlers) return
  window.removeEventListener('omni:terminal-invoke', handlers.invoke)
  window.removeEventListener('omni:terminal-dismiss', handlers.dismiss)
  window.removeEventListener('omni:terminal-shells-set', handlers.set)
  window.removeEventListener('omni:terminal-shells-state-request', handlers.request)
  handlers = null
}
