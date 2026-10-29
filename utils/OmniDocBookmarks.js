/**
 * utils/OmniDocBookmarks.js (V237) — bookmarks per document: up to 20 for each PDF (or other doc source), each with a page and a title you can rename.
 * Pure + a thin localStorage store (key 'omni:doc-bookmarks:v1'). Keyed by the SOURCE (type:id), so the same PDF keeps its bookmarks in every doc node.
 *   keyOf(source) -> 'pdf:abc' | null (no source)      list(store, key) -> [{id, page, title}] sorted by page
 *   add(store, key, page, title?) -> { ok, bookmark } | { ok:false, error, existing? }      rename(store, key, id, title)      remove(store, key, id)
 */
export const MAX = 20
export const TITLE_MAX = 60
export const STORE_KEY = 'omni:doc-bookmarks:v1'
const BAD = new Set(['__proto__', 'constructor', 'prototype'])

export const keyOf = (src) => (src && typeof src.type === 'string' && src.type !== 'none' && src.id != null && String(src.id) && !BAD.has(String(src.id)) ? `${src.type}:${String(src.id).slice(0, 120)}` : null)
const cleanTitle = (t) => String(t ?? '').replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, TITLE_MAX)
const cleanPage = (p) => { const n = Math.floor(Number(p)); return Number.isFinite(n) && n >= 1 && n <= 100000 ? n : 0 }

export function sanitize (raw) {
  const out = Object.create(null)
  if (!raw || typeof raw !== 'object') return out
  for (const k of Object.keys(raw)) {
    if (BAD.has(k) || !/^[a-z]+:/.test(k) || !Array.isArray(raw[k])) continue
    const seen = new Set(), arr = []
    for (const b of raw[k]) {
      if (arr.length >= MAX) break
      const page = cleanPage(b?.page); const id = typeof b?.id === 'string' && /^[\w-]{1,24}$/.test(b.id) ? b.id : null
      if (!page || !id || seen.has(id)) continue
      seen.add(id); arr.push({ id, page, title: cleanTitle(b.title) || 'Page ' + page })
    }
    if (arr.length) out[k] = arr
  }
  return out
}
export const list = (store, key) => (key && store?.[key] ? [...store[key]].sort((a, b) => a.page - b.page || a.id.localeCompare(b.id)) : [])
const newId = (arr) => { let id; do { id = 'b' + Math.random().toString(36).slice(2, 8) } while (arr.some(b => b.id === id)); return id }

export function add (store, key, page, title) {
  if (!key) return { ok: false, error: 'Choose a document first.' }
  const p = cleanPage(page); if (!p) return { ok: false, error: 'There is no page to bookmark.' }
  const arr = store[key] ?? []
  const dup = arr.find(b => b.page === p); if (dup) return { ok: false, error: `Page ${p} is already bookmarked as “${dup.title}”.`, existing: dup }
  if (arr.length >= MAX) return { ok: false, error: `This document has ${MAX} bookmarks already. Delete one to add another.` }
  const b = { id: newId(arr), page: p, title: cleanTitle(title) || 'Page ' + p }
  store[key] = [...arr, b]
  return { ok: true, bookmark: b }
}
export function rename (store, key, id, title) {
  const arr = store[key] ?? []; const i = arr.findIndex(b => b.id === id); if (i < 0) return { ok: false, error: 'That bookmark is gone.' }
  const t = cleanTitle(title) || 'Page ' + arr[i].page
  store[key] = arr.map((b, j) => (j === i ? { ...b, title: t } : b))
  return { ok: true, title: t }
}
export function remove (store, key, id) {
  const arr = store[key] ?? []; if (!arr.some(b => b.id === id)) return { ok: false, error: 'That bookmark is gone.' }
  const next = arr.filter(b => b.id !== id); if (next.length) store[key] = next; else delete store[key]
  return { ok: true }
}
export function load () { try { return sanitize(JSON.parse(localStorage.getItem(STORE_KEY))) } catch (_) { return Object.create(null) } }
export function save (store) { try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); return true } catch (_) { return false } }
