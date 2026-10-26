/**
 * utils/OmniDocAssets.js (V203) — the DOCUMENT LIBRARY: import a PDF / markdown / text / image file, keep its bytes in IndexedDB, hand them back to the rasterizers.
 *
 *   DocAssets.importFile(file)       -> Promise<{ok, id?, meta?, error?}>   meta = { id, name, type:'pdf'|'markdown'|'text'|'image', mime, size, added }
 *   DocAssets.importText(name, text, type = 'markdown')                     the same for text that is not a file (pasted)
 *   DocAssets.list() / getMeta(id) / remove(id) / rename(id, name) / usage()
 *   DocAssets.getBytes(id)           -> Promise<ArrayBuffer|null>
 * Error codes: 'unsupported', 'too-large' (> 50 MB per file), 'quota' (library full: 250 MB total or 60 documents, or the browser storage is full), 'empty', 'not-a-file', 'storage', 'missing'.
 * The BYTES decide the type (sniffDoc), the extension / mime type are only a hint. Every async function resolves, never rejects.
 * Storage: IndexedDB 'omni-doc-assets-v1' (stores 'meta' and 'blobs'). When IndexedDB is unavailable (private mode, blocked) a memory store takes over and `persistent` is false.
 * Event: window 'omni:doc-assets-changed' {action:'add'|'remove'|'rename', id}.
 */

export const DB_NAME = 'omni-doc-assets-v1'
export const STORE_META = 'meta'
export const STORE_BLOBS = 'blobs'
export const MAX_FILE_BYTES = 50 * 1024 * 1024
export const MAX_TOTAL_BYTES = 250 * 1024 * 1024
export const MAX_DOCS = 60
export const MAX_NAME = 60
export const EVENT = 'omni:doc-assets-changed'

const MB = (b) => (b / 1048576).toFixed(b >= 10485760 ? 0 : 1)
export function makeError (code, message) { return { code, message, toString () { return message } } }
const fail = (code, message) => { const error = makeError(code, message); return { ok: false, code, message, error } }

export function sanitizeName (raw, fallback = 'Document') {
  let s = String(raw ?? '').replace(/^.*[\\/]/, '').replace(/\.[A-Za-z0-9]{1,5}$/, '')
  s = s.replace(/[\u0000-\u001f\u007f<>:"/\\|?*]/g, ' ').replace(/\s+/g, ' ').trim().replace(/^\.+/, '')
  if (s.length > MAX_NAME) s = s.slice(0, MAX_NAME).trim()
  return s || fallback
}
export function uniqueName (name, taken) {
  const set = new Set([...taken].map(n => String(n).toLowerCase()))
  if (!set.has(name.toLowerCase())) return name
  const base = name.replace(/ \(\d+\)$/, '')
  for (let i = 2; i < 10000; i++) { const c = `${base} (${i})`; if (!set.has(c.toLowerCase())) return c }
  return `${base} ${Date.now().toString(36)}`
}

const asc = (b, i, s) => { for (let k = 0; k < s.length; k++) if (b[i + k] !== s.charCodeAt(k)) return false; return true }
const IMG_MIME = { png: 'image/png', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp' }

/** What the bytes are: { type:'pdf'|'image'|'text'|'unsupported', format, mime }. Text = valid UTF-8 without NUL bytes in the first 8 KB; markdown is told apart by the name. */
export function sniffDoc (u8, name = '') {
  const b = u8 || new Uint8Array(0); const n = b.length
  if (n >= 5 && asc(b, 0, '%PDF-')) return { type: 'pdf', format: 'pdf', mime: 'application/pdf' }
  if (n >= 4 && b[0] === 0x89 && asc(b, 1, 'PNG')) return { type: 'image', format: 'png', mime: IMG_MIME.png }
  if (n >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { type: 'image', format: 'jpeg', mime: IMG_MIME.jpeg }
  if (n >= 4 && asc(b, 0, 'GIF8')) return { type: 'image', format: 'gif', mime: IMG_MIME.gif }
  if (n >= 12 && asc(b, 0, 'RIFF') && asc(b, 8, 'WEBP')) return { type: 'image', format: 'webp', mime: IMG_MIME.webp }
  if (n >= 2 && b[0] === 0x42 && b[1] === 0x4d) return { type: 'image', format: 'bmp', mime: IMG_MIME.bmp }
  if (n >= 4 && ((b[0] === 0x50 && b[1] === 0x4b) || (b[0] === 0x7f && asc(b, 1, 'ELF')) || (b[0] === 0x4d && b[1] === 0x5a) || (b[0] === 0x1f && b[1] === 0x8b))) return { type: 'unsupported', format: 'binary' }
  const head = b.subarray(0, Math.min(n, 8192))
  for (let i = 0; i < head.length; i++) if (head[i] === 0) return { type: 'unsupported', format: 'binary' }
  if (n === 0) return { type: 'unsupported', format: 'empty' }
  const md = /\.(md|markdown)$/i.test(String(name))
  return { type: 'text', format: md ? 'markdown' : 'text', mime: md ? 'text/markdown' : 'text/plain' }
}

// ── storage ──────────────────────────────────────────────────────────────────────────────────────────────────────────
let _db = null; let _dbTried = false; let _persistent = false
const _memMeta = new Map(); const _memBlobs = new Map()
const req2p = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) })

async function openDb () {
  if (_dbTried) return _db
  _dbTried = true
  try {
    const idb = globalThis.indexedDB; if (!idb) return null
    _db = await new Promise((res, rej) => {
      const r = idb.open(DB_NAME, 1)
      r.onupgradeneeded = () => { const d = r.result; if (!d.objectStoreNames.contains(STORE_META)) d.createObjectStore(STORE_META, { keyPath: 'id' }); if (!d.objectStoreNames.contains(STORE_BLOBS)) d.createObjectStore(STORE_BLOBS) }
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); r.onblocked = () => rej(new Error('blocked'))
    })
    _persistent = true
  } catch (_) { _db = null; _persistent = false }
  return _db
}
const tx = async (stores, mode, fn) => {
  const db = await openDb()
  if (!db) return null
  return new Promise((res, rej) => {
    const t = db.transaction(stores, mode); let out
    t.oncomplete = () => res(out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error ?? new Error('abort'))
    try { out = fn(t) } catch (e) { rej(e) }
  })
}

async function allMeta () {
  const db = await openDb()
  if (!db) return [..._memMeta.values()]
  const out = await tx([STORE_META], 'readonly', (t) => req2p(t.objectStore(STORE_META).getAll()))
  const list = await out
  return Array.isArray(list) ? list : []
}
async function putBoth (meta, bytes) {
  const db = await openDb()
  if (!db) { _memMeta.set(meta.id, meta); _memBlobs.set(meta.id, bytes); return }
  await tx([STORE_META, STORE_BLOBS], 'readwrite', (t) => { t.objectStore(STORE_META).put(meta); t.objectStore(STORE_BLOBS).put(bytes, meta.id) })
}

let _seq = 0
const newId = () => 'd' + Date.now().toString(36) + (_seq++).toString(36) + Math.floor(Math.random() * 1296).toString(36)
const emit = (action, id) => { try { const w = globalThis.window ?? globalThis; w.dispatchEvent?.(new w.CustomEvent(EVENT, { detail: { action, id } })) } catch (_) { /* no window */ } }

export const DocAssets = {
  get persistent () { return _persistent },
  async list () { try { return (await allMeta()).slice().sort((a, b) => (a.added ?? 0) - (b.added ?? 0)) } catch (_) { return [] } },
  async getMeta (id) { try { return (await allMeta()).find(m => m.id === id) ?? null } catch (_) { return null } },
  async usage () { const l = await this.list(); return { count: l.length, bytes: l.reduce((s, m) => s + (m.size || 0), 0), maxBytes: MAX_TOTAL_BYTES, maxDocs: MAX_DOCS, persistent: _persistent } },

  async _add (bytes, name, hint) {
    try {
      const u8 = new Uint8Array(bytes)
      if (!u8.length) return fail('empty', 'That file is empty.')
      if (u8.length > MAX_FILE_BYTES) return fail('too-large', `That file is ${MB(u8.length)} MB; the limit is ${MB(MAX_FILE_BYTES)} MB.`)
      const sn = sniffDoc(u8, name)
      if (sn.type === 'unsupported') return fail('unsupported', 'That file is not a PDF, an image or a text document.')
      const type = hint === 'markdown' || (sn.type === 'text' && sn.format === 'markdown') ? (sn.type === 'text' ? 'markdown' : sn.type) : sn.type
      const list = await allMeta()
      if (list.length >= MAX_DOCS) return fail('quota', `The library is full (${MAX_DOCS} documents). Remove one first.`)
      const used = list.reduce((s, m) => s + (m.size || 0), 0)
      if (used + u8.length > MAX_TOTAL_BYTES) return fail('quota', `The library is full (${MB(MAX_TOTAL_BYTES)} MB). Remove a document first.`)
      const meta = { id: newId(), name: uniqueName(sanitizeName(name), list.map(m => m.name)), type, mime: sn.mime, size: u8.length, added: Date.now() }
      try { await putBoth(meta, u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength)) } catch (e) {
        const q = e && (e.name === 'QuotaExceededError' || /quota/i.test(String(e.message)))
        return fail(q ? 'quota' : 'storage', q ? 'The browser storage is full.' : 'The browser could not store that file.')
      }
      emit('add', meta.id)
      return { ok: true, id: meta.id, meta }
    } catch (e) { return fail('storage', 'The browser could not store that file.') }
  },
  async importFile (file) {
    try {
      if (!file || typeof file.arrayBuffer !== 'function') return fail('not-a-file', 'That is not a file.')
      if (file.size > MAX_FILE_BYTES) return fail('too-large', `That file is ${MB(file.size)} MB; the limit is ${MB(MAX_FILE_BYTES)} MB.`)
      return await this._add(await file.arrayBuffer(), file.name || 'Document')
    } catch (_) { return fail('not-a-file', 'That file could not be read.') }
  },
  async importText (name, text, type = 'markdown') {
    try {
      const u8 = new TextEncoder().encode(String(text ?? ''))
      return await this._add(u8.buffer, sanitizeName(name, 'Note'), type === 'text' ? 'text' : 'markdown')
    } catch (_) { return fail('storage', 'The browser could not store that text.') }
  },
  async getBytes (id) {
    try {
      const db = await openDb()
      if (!db) return _memBlobs.get(id) ?? null
      return (await tx([STORE_BLOBS], 'readonly', (t) => req2p(t.objectStore(STORE_BLOBS).get(id)))) ?? null
    } catch (_) { return null }
  },
  async remove (id) {
    try {
      const m = await this.getMeta(id); if (!m) return fail('missing', 'No such document.')
      const db = await openDb()
      if (!db) { _memMeta.delete(id); _memBlobs.delete(id) } else await tx([STORE_META, STORE_BLOBS], 'readwrite', (t) => { t.objectStore(STORE_META).delete(id); t.objectStore(STORE_BLOBS).delete(id) })
      emit('remove', id); return { ok: true }
    } catch (_) { return fail('storage', 'The browser could not remove that document.') }
  },
  async rename (id, name) {
    try {
      const list = await allMeta(); const m = list.find(x => x.id === id); if (!m) return fail('missing', 'No such document.')
      const next = { ...m, name: uniqueName(sanitizeName(name, m.name), list.filter(x => x.id !== id).map(x => x.name)) }
      const db = await openDb()
      if (!db) _memMeta.set(id, next); else await tx([STORE_META], 'readwrite', (t) => { t.objectStore(STORE_META).put(next) })
      emit('rename', id); return { ok: true, meta: next }
    } catch (_) { return fail('storage', 'The browser could not rename that document.') }
  },
  /** Test hook: forget the opened database and the memory store. */
  _reset () { _db = null; _dbTried = false; _persistent = false; _memMeta.clear(); _memBlobs.clear() },
}

export default DocAssets
