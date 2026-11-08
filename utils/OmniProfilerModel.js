/**
 * utils/OmniProfilerModel.js (V278) — the data of the Profiler: a notebook of the people and things you meet or interact with, filled in by what happens.
 * Pure: no DOM, no clock (time is passed in). Everything is local (the notebook is saved in this browser only).
 *
 * book = { entries:[ { id, name, kind:'person'|'thing'|'place'|'event', note, tags[], nodeId, created, updated, met, log:[ { at, what, ref } ] } ] }
 *   met   how many times you have met or interacted (each logged interaction counts)
 *   ref   an optional node id that the line is about
 * Caps keep the notebook small: 300 entries, 120 log lines each (the oldest lines go first), text lengths clipped.
 */
export const KINDS = Object.freeze(['person', 'thing', 'place', 'event'])
export const LIMITS = Object.freeze({ entries: 300, log: 120, name: 60, note: 600, what: 160, tags: 8, tag: 24 })
const ID = /^[\w.:-]{1,80}$/; const BAD = new Set(['__proto__', 'constructor', 'prototype'])
const clean = (v, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '')
const ts = (v) => { const n = Number(v); return Number.isFinite(n) && n >= 0 && n < 4e12 ? Math.floor(n) : 0 }
const idOk = (v) => typeof v === 'string' && ID.test(v) && !BAD.has(v)

export function sanitizeLogLine (raw) {
  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  const what = clean(r.what, LIMITS.what); if (!what) return null
  return { at: ts(r.at), what, ref: idOk(r.ref) ? r.ref : '' }
}
export function sanitizeEntry (raw) {
  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  const name = clean(r.name, LIMITS.name); if (!name || !idOk(r.id)) return null
  const tags = []; for (const t of Array.isArray(r.tags) ? r.tags : []) { const c = clean(t, LIMITS.tag).toLowerCase(); if (c && !tags.includes(c) && tags.length < LIMITS.tags) tags.push(c) }
  const log = (Array.isArray(r.log) ? r.log : []).map(sanitizeLogLine).filter(Boolean).slice(-LIMITS.log)
  return { id: r.id, name, kind: KINDS.includes(r.kind) ? r.kind : 'person', note: clean(r.note, LIMITS.note), tags, nodeId: idOk(r.nodeId) ? r.nodeId : '', created: ts(r.created), updated: ts(r.updated), met: Math.max(0, Math.min(1e6, Math.floor(Number(r.met) || 0))), log }
}
export function sanitizeBook (raw) {
  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  const seen = new Set(), entries = []
  for (const e of Array.isArray(r.entries) ? r.entries : []) { if (entries.length >= LIMITS.entries) break; const s = sanitizeEntry(e); if (s && !seen.has(s.id)) { seen.add(s.id); entries.push(s) } }
  return { entries }
}
const slug = (s) => clean(s, 40).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'entry'

/** a new entry (or the existing one with the same id): returns { book, id, added } — immutable */
export function addEntry (book, { name, kind = 'person', note = '', nodeId = '', tags = [], id = '' } = {}, now = 0) {
  const b = sanitizeBook(book); const nm = clean(name, LIMITS.name); if (!nm) return { book: b, id: '', added: false }
  let eid = idOk(id) ? id : (nodeId && idOk(nodeId) ? 'n-' + nodeId : slug(nm))
  const have = b.entries.find(e => e.id === eid); if (have) return { book: b, id: eid, added: false }
  if (b.entries.length >= LIMITS.entries) return { book: b, id: '', added: false }
  const e = sanitizeEntry({ id: eid, name: nm, kind, note, tags, nodeId, created: now, updated: now, met: 0, log: [] }); if (!e) return { book: b, id: '', added: false }
  return { book: { entries: [...b.entries, e] }, id: eid, added: true }
}
/** one line in an entry's log; counts as a meeting unless `meet` is false */
export function addLog (book, id, what, now = 0, { ref = '', meet = true } = {}) {
  const b = sanitizeBook(book); const i = b.entries.findIndex(e => e.id === id); if (i < 0) return b
  const line = sanitizeLogLine({ at: now, what, ref }); if (!line) return b
  const e = b.entries[i]; const next = { ...e, log: [...e.log, line].slice(-LIMITS.log), updated: ts(now), met: e.met + (meet ? 1 : 0) }
  return { entries: b.entries.map((x, k) => (k === i ? next : x)) }
}
export function editEntry (book, id, patch, now = 0) {
  const b = sanitizeBook(book); const i = b.entries.findIndex(e => e.id === id); if (i < 0) return b
  const p = patch && typeof patch === 'object' ? patch : {}; const e = b.entries[i]
  const next = sanitizeEntry({ ...e, name: p.name ?? e.name, kind: p.kind ?? e.kind, note: p.note ?? e.note, tags: p.tags ?? e.tags, updated: now }); if (!next) return b
  return { entries: b.entries.map((x, k) => (k === i ? next : x)) }
}
export function removeEntry (book, id) { const b = sanitizeBook(book); return { entries: b.entries.filter(e => e.id !== id) } }
/** entries whose name, note, tags or log contain every word of q; newest activity first */
export function search (book, q = '') {
  const words = clean(q, 80).toLowerCase().split(' ').filter(Boolean)
  const hay = (e) => (e.name + ' ' + e.note + ' ' + e.tags.join(' ') + ' ' + e.kind + ' ' + e.log.map(l => l.what).join(' ')).toLowerCase()
  return sanitizeBook(book).entries.filter(e => words.every(w => hay(e).includes(w))).sort((a, b) => b.updated - a.updated)
}
export const entryOfNode = (book, nodeId) => sanitizeBook(book).entries.find(e => e.nodeId === nodeId) ?? null
