/**
 * utils/OmniSceneExtras.js (V253) — the "extras" block of a `.omni.json` file: what lives BESIDE the nodes.
 *
 *   "extras": {
 *     "lineups":    { version, lineups: { id: { layout, center, spacing, order[] } }, attach: { node: { to, off } } },
 *     "docwindows": [ { id, src, layout, count, center, pages, start, slots[] } ],
 *     "vibration":  [ ...custom vibration programs ]
 *   }
 *
 * Semantics skins need nothing here: a skin is a PolyNode, and its faces travel inside the node record.
 * Pure, no DOM. `readExtras` never trusts the file: every part goes through the same sanitizer the module uses on load,
 * references are remapped (merge renames) and anything pointing at a node that is not in the file is dropped with a warning.
 */
import * as LM from './OmniLineupModel.js'
import * as WM from './OmniDocWindowModel.js'
import { sanitizeProgram, PRESETS } from './OmniVibrationModel.js'

export const MAX_PROGRAMS = 64
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v)
const clone = (v) => JSON.parse(JSON.stringify(v))

/** What to write into the file. Inputs are the live module snapshots (any may be missing). */
export function buildExtras ({ lineups = null, docwindows = null, vibration = null } = {}) {
  const out = {}
  const ls = lineups ? LM.sanitizeState(lineups) : null
  if (ls && (Object.keys(ls.lineups).length || Object.keys(ls.attach).length)) out.lineups = ls
  const ws = (Array.isArray(docwindows) ? docwindows : []).map(WM.sanitizeWindow).filter(Boolean).slice(0, WM.MAX_WINDOWS)
  if (ws.length) out.docwindows = ws
  const vs = (Array.isArray(vibration) ? vibration : []).filter(p => isObj(p) && !p.builtin).slice(0, MAX_PROGRAMS).map(p => sanitizeProgram(p))
  if (vs.length) out.vibration = vs
  return out
}

/**
 * Reads the block from a parsed file.
 * opts: { ids: Set|array of node ids that will exist after the import, remap: {old:new} (merge renames),
 *         takenLineups, takenWindows, takenPrograms: ids already in use (merge) }
 * -> { extras, warnings }
 */
export function readExtras (raw, { ids = [], remap = {}, takenLineups = [], takenWindows = [], takenPrograms = [] } = {}) {
  const warnings = []; const extras = {}
  if (raw == null) return { extras, warnings }
  if (!isObj(raw)) return { extras, warnings: ['The "extras" part is not an object; skipped.'] }
  const live = new Set(ids); const rm = (id) => (Object.prototype.hasOwnProperty.call(remap, id) ? remap[id] : id)
  const fresh = (id, taken, tag) => { if (!taken.has(id)) { taken.add(id); return id } let n = 2; while (taken.has(id + '_' + n)) n++; const nid = id + '_' + n; taken.add(nid); warnings.push(tag + ' "' + id + '" already existed; renamed to "' + nid + '".'); return nid }

  if (raw.lineups != null) {
    const s = LM.sanitizeState(raw.lineups); const used = new Set(takenLineups); const out = LM.emptyState(); const renamed = {}
    let dropped = 0
    for (const [id, l] of Object.entries(s.lineups)) {
      const order = []; for (const n of l.order) { const m = rm(n); if (live.has(m) && !order.includes(m)) order.push(m); else dropped++ }
      const nid = fresh(id, used, 'Lineup'); renamed[id] = nid
      out.lineups[nid] = { ...l, order }
    }
    for (const [n, a] of Object.entries(s.attach)) { const f = rm(n), t = rm(a.to); if (live.has(f) && live.has(t)) out.attach[f] = { to: t, off: a.off }; else dropped++ }
    if (dropped) warnings.push(dropped + ' lineup place(s) or attachment(s) pointed at missing nodes; dropped.')
    const clean = LM.sanitizeState(out)
    if (Object.keys(clean.lineups).length || Object.keys(clean.attach).length) extras.lineups = clean
  }

  if (raw.docwindows != null) {
    const used = new Set(takenWindows); const list = []
    for (const r of (Array.isArray(raw.docwindows) ? raw.docwindows : []).slice(0, WM.MAX_WINDOWS)) {
      const w = WM.sanitizeWindow(isObj(r) ? { ...r, slots: (Array.isArray(r.slots) ? r.slots : []).map(x => (typeof x === 'string' ? rm(x) : x)) } : null)
      if (!w) { warnings.push('A doc window in the file was not readable; skipped.'); continue }
      if (!w.slots.every(x => live.has(x))) { warnings.push('Doc window "' + w.id + '" pointed at missing sheets; skipped.'); continue }
      w.id = fresh(w.id, used, 'Doc window'); list.push(w)
    }
    if (list.length) extras.docwindows = list
  }

  if (raw.vibration != null) {
    const used = new Set([...takenPrograms, ...PRESETS.map(p => p.id)]); const list = []
    const src = Array.isArray(raw.vibration) ? raw.vibration : []
    if (src.length > MAX_PROGRAMS) warnings.push('Only the first ' + MAX_PROGRAMS + ' vibration programs are read.')
    for (const r of src.slice(0, MAX_PROGRAMS)) {
      if (!isObj(r)) continue
      const q = sanitizeProgram(clone(r)); if (used.has(q.id)) { let n = 2; while (used.has(q.id + '_' + n)) n++; q.id = q.id + '_' + n } used.add(q.id); list.push(q)
    }
    if (list.length) extras.vibration = list
  }
  return { extras, warnings }
}

export function describeExtras (e) {
  if (!e) return ''
  const bits = []
  const nl = Object.keys(e.lineups?.lineups ?? {}).length; if (nl) bits.push(nl + ' lineup' + (nl === 1 ? '' : 's'))
  const nw = (e.docwindows ?? []).length; if (nw) bits.push(nw + ' doc window' + (nw === 1 ? '' : 's'))
  const nv = (e.vibration ?? []).length; if (nv) bits.push(nv + ' vibration program' + (nv === 1 ? '' : 's'))
  return bits.join(', ')
}
