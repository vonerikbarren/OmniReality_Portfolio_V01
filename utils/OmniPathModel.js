/**
 * utils/OmniPathModel.js — the model behind the OmniPathNode kind and the OmniNodeOrderPanel (V191).
 *
 * A PATH is an ordered list of node ids ("members"). It is built two ways:
 *   LINK       the user attaches from one node to the next: select A, then B, then C ... each step appends (systems/OmniPathNodes.js records them);
 *   GENEALOGY  the order comes from the hierarchy (data.parentId) starting at a chosen ROOT node: parent, then children, then grandchildren, in
 *              pre-order (depth first: a branch is followed down before its sibling) or breadth-first (level by level).
 * Only REFERENCES are stored (node ids), never copies of node data. The OmniPathNode itself is an ordinary OmniNode node
 * ({ nodeKind:'omniPath', pathId }) that stands for the path in the scene; this model holds everything else.
 *
 * Persisted in localStorage 'omni:paths:v1' = { v:1, activeId, paths:[ { id, name, mode, order, rootId, members[], color, closed, visible, nodeId,
 * dropped:[{ id, label, at }] } ] }. Loading validates everything (hostile / old storage never throws): ids must look like ids, members are unique,
 * at most MAX_MEMBERS per path and MAX_PATHS paths, no prototype keys, junk fields dropped.
 * Deleting a member node drops it from the order and notes it in `dropped` (dropNode). Every edit is undoable (undo(), a per-path stack of 30).
 *
 * Events: omni:paths-changed { id, reason }. USER-facing module: it must never import a Dev* module.
 */

export const STORE_KEY = 'omni:paths:v1'
export const CHANGED_EVENT = 'omni:paths-changed'
export const MAX_MEMBERS = 200
export const MAX_PATHS = 50
export const MAX_DROPPED = 5
export const UNDO_DEPTH = 30
export const MODES = ['link', 'genealogy']
export const ORDERS = ['preorder', 'breadth']
export const ORDER_LABEL = { preorder: 'Pre-order (depth first)', breadth: 'Breadth first (level by level)' }
export const DEFAULT_COLORS = ['#7fd6ff', '#ffb02e', '#8fe3a2', '#ff8ad0', '#c4a6ff', '#ff7a7a']

const ID_RE = /^[A-Za-z0-9_.:-]{1,64}$/
export const isId = (v) => typeof v === 'string' && ID_RE.test(v)
const BAD_KEYS = new Set(['__proto__', 'constructor', 'prototype'])
const clip = (s, n) => { const t = String(s ?? '').replace(/[\u0000-\u001f<>]/g, '').trim(); return t.length > n ? t.slice(0, n) : t }
const hexOk = (v) => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v)

// ── Pure: genealogy order ─────────────────────────────────────────────────────

/**
 * The members of the hierarchy under `rootId`, root first. `nodes` = [{ id, parentId }] (children keep the order of this list).
 * kind 'preorder': root, its first child, that child's children ..., then the next child. 'breadth': root, all children, all grandchildren ...
 * Cycle safe (a visited set), capped at `cap`. A root that is not in `nodes` gives [].
 */
export function genealogyOrder (nodes, rootId, kind = 'preorder', cap = MAX_MEMBERS) {
  if (!Array.isArray(nodes) || !isId(rootId)) return []
  const kids = new Map(); const known = new Set()
  for (const n of nodes) {
    if (!n || !isId(n.id)) continue
    known.add(n.id)
    if (isId(n.parentId) && n.parentId !== n.id) { if (!kids.has(n.parentId)) kids.set(n.parentId, []); kids.get(n.parentId).push(n.id) }
  }
  if (!known.has(rootId)) return []
  const out = []; const seen = new Set()
  if (kind === 'breadth') {
    const q = [rootId]; seen.add(rootId)
    for (let i = 0; i < q.length && out.length < cap; i++) {
      out.push(q[i])
      for (const k of kids.get(q[i]) ?? []) if (!seen.has(k)) { seen.add(k); q.push(k) }
    }
    return out
  }
  const stack = [rootId]
  while (stack.length && out.length < cap) {
    const id = stack.pop()
    if (seen.has(id)) continue
    seen.add(id); out.push(id)
    const ch = kids.get(id) ?? []
    for (let i = ch.length - 1; i >= 0; i--) if (!seen.has(ch[i])) stack.push(ch[i])   // reversed so the first child is visited first
  }
  return out
}

/** Depth of each id under the root (root = 0), for indentation in the panel: { id: depth }. */
export function genealogyDepths (nodes, rootId) {
  const kids = new Map()
  for (const n of nodes ?? []) if (n && isId(n.id) && isId(n.parentId) && n.parentId !== n.id) { if (!kids.has(n.parentId)) kids.set(n.parentId, []); kids.get(n.parentId).push(n.id) }
  const out = {}
  if (!isId(rootId)) return out
  const q = [rootId]; out[rootId] = 0
  for (let i = 0; i < q.length && i < 2000; i++) for (const k of kids.get(q[i]) ?? []) if (!(k in out)) { out[k] = out[q[i]] + 1; q.push(k) }
  return out
}

// ── Pure: list operations (return NEW arrays, never mutate) ───────────────────

export function listAppend (list, id, cap = MAX_MEMBERS) {
  if (!isId(id)) return { ok: false, list, error: 'Not a node.' }
  if (list.includes(id)) return { ok: false, list, error: 'That node is already in the path.', duplicate: true }
  if (list.length >= cap) return { ok: false, list, error: `A path holds at most ${cap} nodes.` }
  return { ok: true, list: [...list, id] }
}
export function listInsert (list, index, id, cap = MAX_MEMBERS) {
  const r = listAppend(list, id, cap)
  if (!r.ok) return r
  const i = Math.max(0, Math.min(list.length, Math.round(+index) || 0))
  return { ok: true, list: [...list.slice(0, i), id, ...list.slice(i)] }
}
export function listMove (list, from, to) {
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || from >= list.length || to < 0 || to >= list.length) return { ok: false, list }
  if (from === to) return { ok: true, list: [...list] }
  const out = [...list]; const [x] = out.splice(from, 1); out.splice(to, 0, x)
  return { ok: true, list: out }
}
export function listRemoveAt (list, i) {
  if (!Number.isInteger(i) || i < 0 || i >= list.length) return { ok: false, list }
  return { ok: true, list: list.filter((_, k) => k !== i) }
}
/** A reorder request is accepted only if it is a permutation of the current members. */
export function listReorder (list, next) {
  if (!Array.isArray(next) || next.length !== list.length) return { ok: false, list }
  const a = [...list].sort(); const b = [...next].sort()
  return a.every((v, i) => v === b[i]) && new Set(next).size === next.length ? { ok: true, list: [...next] } : { ok: false, list }
}

// ── Validation of stored data ─────────────────────────────────────────────────

export function sanitizePath (raw, idx = 0) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || !isId(raw.id)) return null
  const members = []
  if (Array.isArray(raw.members)) for (const m of raw.members) { if (isId(m) && !members.includes(m)) members.push(m); if (members.length >= MAX_MEMBERS) break }
  const dropped = []
  if (Array.isArray(raw.dropped)) {
    for (const d of raw.dropped) {
      if (d && typeof d === 'object' && isId(d.id)) dropped.push({ id: d.id, label: clip(d.label ?? '', 40), at: Number.isFinite(d.at) ? d.at : 0 })
      if (dropped.length >= MAX_DROPPED) break
    }
  }
  return {
    id: raw.id,
    name: clip(raw.name, 40) || 'Path ' + (idx + 1),
    mode: MODES.includes(raw.mode) ? raw.mode : 'link',
    order: ORDERS.includes(raw.order) ? raw.order : 'preorder',
    rootId: isId(raw.rootId) ? raw.rootId : null,
    members,
    color: hexOk(raw.color) ? raw.color.toLowerCase() : DEFAULT_COLORS[idx % DEFAULT_COLORS.length],
    closed: raw.closed === true,
    visible: raw.visible !== false,
    nodeId: isId(raw.nodeId) ? raw.nodeId : null,
    droppedCount: Number.isInteger(raw.droppedCount) && raw.droppedCount > 0 ? Math.min(raw.droppedCount, 1e6) : dropped.length,
    dropped,
  }
}

export function sanitizeState (raw) {
  const out = { v: 1, activeId: null, paths: [] }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || raw.v !== 1 || !Array.isArray(raw.paths)) return out
  const ids = new Set()
  for (const p of raw.paths) {
    if (out.paths.length >= MAX_PATHS) break
    if (p && typeof p === 'object' && BAD_KEYS.has(p.id)) continue
    const s = sanitizePath(p, out.paths.length)
    if (s && !ids.has(s.id)) { ids.add(s.id); out.paths.push(s) }
  }
  out.activeId = isId(raw.activeId) && ids.has(raw.activeId) ? raw.activeId : (out.paths[0]?.id ?? null)
  return out
}

// ── Stateful model ────────────────────────────────────────────────────────────

let state = null
const undo = new Map()   // pathId -> [snapshot, ...]
const ls = () => { try { return globalThis.localStorage ?? null } catch (_) { return null } }
const newId = () => 'path_' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3)

function ensure () {
  if (state) return state
  try { const raw = ls()?.getItem(STORE_KEY); state = sanitizeState(raw ? JSON.parse(raw) : null) } catch (_) { state = sanitizeState(null) }
  return state
}
function persist (id, reason) {
  try { ls()?.setItem(STORE_KEY, JSON.stringify(state)) } catch (_) { /* blocked storage: the session still works */ }
  try { window.dispatchEvent(new CustomEvent(CHANGED_EVENT, { detail: { id, reason } })) } catch (_) { /* no window */ }
}
const find = (id) => ensure().paths.find(p => p.id === id) ?? null
const clone = (p) => (p ? JSON.parse(JSON.stringify(p)) : null)
function remember (p) {
  const st = undo.get(p.id) ?? []
  st.push(JSON.stringify({ members: p.members, mode: p.mode, order: p.order, rootId: p.rootId, name: p.name, closed: p.closed }))
  if (st.length > UNDO_DEPTH) st.shift()
  undo.set(p.id, st)
}

export const listPaths = () => ensure().paths.map(clone)
export const getPath = (id) => clone(find(id))
export const getActiveId = () => ensure().activeId
export const pathCount = () => ensure().paths.length
export const canUndo = (id) => (undo.get(id)?.length ?? 0) > 0
export const pathOfNode = (nodeId) => clone(ensure().paths.find(p => p.nodeId === nodeId) ?? null)
/** Test / reset helper: forget everything in memory (storage too when `wipe`). */
export function _reset (wipe = false) { state = null; undo.clear(); if (wipe) { try { ls()?.removeItem(STORE_KEY) } catch (_) {} } }

export function setActive (id) {
  const st = ensure()
  if (!find(id) || st.activeId === id) return !!find(id)
  st.activeId = id; persist(id, 'active'); return true
}

export function createPath (opts = {}) {
  const st = ensure()
  if (st.paths.length >= MAX_PATHS) return { ok: false, error: `You can have at most ${MAX_PATHS} paths. Delete one first.` }
  const id = isId(opts.id) && !find(opts.id) ? opts.id : newId()
  const p = sanitizePath({ id, name: opts.name || 'Path ' + (st.paths.length + 1), mode: opts.mode, order: opts.order, rootId: opts.rootId, members: opts.members, color: opts.color, nodeId: opts.nodeId }, st.paths.length)
  st.paths.push(p); st.activeId = p.id
  persist(p.id, 'create')
  return { ok: true, id: p.id, path: clone(p) }
}

export function deletePath (id) {
  const st = ensure(); const i = st.paths.findIndex(p => p.id === id)
  if (i < 0) return false
  st.paths.splice(i, 1); undo.delete(id)
  if (st.activeId === id) st.activeId = st.paths[0]?.id ?? null
  persist(id, 'delete'); return true
}

/** Apply a validated edit to path `id`, remembering the previous state for undo. fn(path) mutates and returns {ok,error?}. */
function edit (id, reason, fn) {
  const p = find(id)
  if (!p) return { ok: false, error: 'No such path.' }
  const snap = JSON.stringify({ members: p.members, mode: p.mode, order: p.order, rootId: p.rootId, name: p.name, closed: p.closed })
  const r = fn(p)
  if (!r?.ok) return r ?? { ok: false }
  const st = undo.get(p.id) ?? []
  st.push(snap); if (st.length > UNDO_DEPTH) st.shift(); undo.set(p.id, st)
  persist(id, reason)
  return { ok: true, path: clone(p) }
}

export const rename = (id, name) => edit(id, 'rename', (p) => { const n = clip(name, 40); if (!n) return { ok: false, error: 'The name cannot be empty.' }; p.name = n; return { ok: true } })
export const setMode = (id, mode) => edit(id, 'mode', (p) => { if (!MODES.includes(mode)) return { ok: false, error: 'Unknown mode.' }; p.mode = mode; return { ok: true } })
export const setOrderKind = (id, order) => edit(id, 'order', (p) => { if (!ORDERS.includes(order)) return { ok: false, error: 'Unknown order.' }; p.order = order; return { ok: true } })
export const setRoot = (id, rootId) => edit(id, 'root', (p) => { if (rootId !== null && !isId(rootId)) return { ok: false, error: 'Not a node.' }; p.rootId = rootId; return { ok: true } })
export const setClosed = (id, closed) => edit(id, 'closed', (p) => { p.closed = !!closed; return { ok: true } })
export function setColor (id, color) { const p = find(id); if (!p || !hexOk(color)) return false; p.color = color.toLowerCase(); persist(id, 'color'); return true }
export function setVisible (id, visible) { const p = find(id); if (!p) return false; p.visible = !!visible; persist(id, 'visible'); return true }
export function setNodeId (id, nodeId) { const p = find(id); if (!p) return false; p.nodeId = isId(nodeId) ? nodeId : null; persist(id, 'node'); return true }

const listEdit = (id, reason, f) => edit(id, reason, (p) => { const r = f(p.members); if (!r.ok) return r; p.members = r.list; return { ok: true } })
export const append = (id, nodeId) => listEdit(id, 'append', (l) => listAppend(l, nodeId))
export const insertAt = (id, index, nodeId) => listEdit(id, 'insert', (l) => listInsert(l, index, nodeId))
export const move = (id, from, to) => listEdit(id, 'move', (l) => listMove(l, from, to))
export const moveUp = (id, i) => move(id, i, i - 1)
export const moveDown = (id, i) => move(id, i, i + 1)
export const removeAt = (id, i) => listEdit(id, 'remove', (l) => listRemoveAt(l, i))
export const reorder = (id, next) => listEdit(id, 'reorder', (l) => listReorder(l, next))
export const clearMembers = (id) => listEdit(id, 'clear', (l) => (l.length ? { ok: true, list: [] } : { ok: false, error: 'Already empty.' }))

/** Replace the members with a genealogy order computed from `nodes` ([{id,parentId}]) under the path's root (or `rootId`). */
export function buildFromGenealogy (id, nodes, rootId = null) {
  const p = find(id)
  if (!p) return { ok: false, error: 'No such path.' }
  const root = rootId ?? p.rootId
  if (!root) return { ok: false, error: 'Choose a root node first (select a node, then "Use selected as root").' }
  const list = genealogyOrder(nodes, root, p.order)
  if (!list.length) return { ok: false, error: 'The root node does not exist any more.' }
  return edit(id, 'genealogy', (q) => { q.rootId = root; q.mode = 'genealogy'; q.members = list; return { ok: true } })
}

/**
 * A node was deleted: drop it from every path and note it. A path whose OmniPathNode is that node is deleted with it.
 * Returns { dropped:[pathId...], removedPaths:[pathId...] }.
 */
export function dropNode (nodeId, label = '') {
  const st = ensure(); const out = { dropped: [], removedPaths: [] }
  if (!isId(nodeId)) return out
  for (const p of [...st.paths]) {
    if (p.nodeId === nodeId) { deletePath(p.id); out.removedPaths.push(p.id); continue }
    let touched = false
    if (p.members.includes(nodeId)) {
      remember(p)
      p.members = p.members.filter(m => m !== nodeId)
      p.dropped = [{ id: nodeId, label: clip(label, 40), at: Date.now() }, ...p.dropped].slice(0, MAX_DROPPED)
      p.droppedCount = (p.droppedCount || 0) + 1
      touched = true
    }
    if (p.rootId === nodeId) { p.rootId = null; touched = true }
    if (touched) { out.dropped.push(p.id); persist(p.id, 'drop') }
  }
  return out
}

export function clearNotes (id) { const p = find(id); if (!p) return false; p.dropped = []; p.droppedCount = 0; persist(id, 'notes'); return true }

/** Undo the last edit of this path. */
export function undoLast (id) {
  const p = find(id); const st = undo.get(id)
  if (!p || !st?.length) return { ok: false }
  let snap
  try { snap = JSON.parse(st.pop()) } catch (_) { return { ok: false } }
  const members = Array.isArray(snap.members) ? snap.members.filter(isId).slice(0, MAX_MEMBERS) : p.members
  p.members = [...new Set(members)]
  if (MODES.includes(snap.mode)) p.mode = snap.mode
  if (ORDERS.includes(snap.order)) p.order = snap.order
  p.rootId = isId(snap.rootId) ? snap.rootId : null
  if (typeof snap.name === 'string' && snap.name) p.name = clip(snap.name, 40) || p.name
  p.closed = snap.closed === true
  persist(id, 'undo')
  return { ok: true, path: clone(p) }
}
