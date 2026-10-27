/**
 * utils/OmniVFS.js (V219) — the OmniTerminal's file system, kept in the browser. No backend: the tree lives in memory and a STORAGE ADAPTER saves it, so a
 * server can replace the adapter later without touching anything that uses the files.
 *
 *   const fs = new OmniVFS({ adapter }); await fs.init()
 *   fs.pwd() cd(p) ls(p) tree(p) stat(p) exists(p) read(p) write(p, text, { append }) mkdir(p, { parents }) rm(p, { recursive }) mv(a, b) cp(a, b) find(pattern, p)
 * Paths are absolute (/home/notes/a.txt) or relative to the working folder; "." and ".." work. Every failure throws an Error with a plain message.
 * Limits: names up to 64 characters (no / \ : * ? " < > | or control characters), 16 levels deep, 5000 entries, 1,000,000 characters per file, 20,000,000 in all.
 * Adapter: { load () -> Promise<object|null>, save (snapshot) -> Promise }. MemoryAdapter, LocalStorageAdapter and IndexedDBAdapter are here; createDefaultAdapter() picks one.
 */
export const LIMITS = { name: 64, depth: 16, entries: 5000, file: 1_000_000, total: 20_000_000 }
export const VERSION = 1
const NAME_OK = /^[^\\/:*?"<>|\u0000-\u001f]{1,64}$/

export class MemoryAdapter { constructor () { this.data = null } async load () { return this.data ? JSON.parse(this.data) : null } async save (s) { this.data = JSON.stringify(s) } }
export class LocalStorageAdapter {
  constructor (key = 'omni:vfs:v1') { this.key = key }
  async load () { try { const r = localStorage.getItem(this.key); return r ? JSON.parse(r) : null } catch (_) { return null } }
  async save (s) { localStorage.setItem(this.key, JSON.stringify(s)) }
}
export class IndexedDBAdapter {
  constructor (name = 'omni-vfs', key = 'tree') { this.name = name; this.key = key; this._db = null }
  _open () {
    if (this._db) return Promise.resolve(this._db)
    return new Promise((res, rej) => {
      const r = indexedDB.open(this.name, 1)
      r.onupgradeneeded = () => r.result.createObjectStore('vfs')
      r.onsuccess = () => { this._db = r.result; res(r.result) }
      r.onerror = () => rej(r.error)
    })
  }
  async load () { const db = await this._open(); return new Promise((res, rej) => { const q = db.transaction('vfs').objectStore('vfs').get(this.key); q.onsuccess = () => res(q.result ?? null); q.onerror = () => rej(q.error) }) }
  async save (s) { const db = await this._open(); return new Promise((res, rej) => { const t = db.transaction('vfs', 'readwrite'); t.objectStore('vfs').put(s, this.key); t.oncomplete = () => res(); t.onerror = () => rej(t.error) }) }
}
export function createDefaultAdapter () {
  try { if (typeof indexedDB !== 'undefined' && indexedDB) return new IndexedDBAdapter() } catch (_) {}
  try { if (typeof localStorage !== 'undefined') return new LocalStorageAdapter() } catch (_) {}
  return new MemoryAdapter()
}

const dir = () => ({ t: 'd', c: {}, m: Date.now() })
const file = (s = '') => ({ t: 'f', s: String(s), m: Date.now() })

export const SEED_SCRIPT = `# hello.omni: a script is one Omni command per line. Run it with: Omni File run /home/scripts/hello.omni
Draw node(static) pos(0, 2, 0) label("Hello from a script")
Draw node(sphere) pos(3, 2, 0) color(#ff8800)
`

export default class OmniVFS {
  constructor ({ adapter = null, onChange = null, saveDelay = 300 } = {}) {
    this.adapter = adapter ?? new MemoryAdapter(); this.onChange = onChange; this.saveDelay = saveDelay
    this.root = dir(); this.cwd = '/'; this._timer = null; this._ready = false; this.lastSaveError = null
  }
  async init () {
    let snap = null
    try { snap = await this.adapter.load() } catch (_) { snap = null }
    if (snap && snap.v === VERSION && snap.root?.t === 'd') { this.root = this._clean(snap.root, 0); this.cwd = '/' } else this._seed()
    this._ready = true; return this
  }
  _seed () {
    this.root = dir()
    for (const p of ['/home', '/home/scripts', '/home/notes', '/tmp']) this.mkdir(p, { quiet: true })
    this.write('/home/scripts/hello.omni', SEED_SCRIPT, { quiet: true })
    this.write('/home/readme.txt', 'Your Omni files live in this browser. Try: Omni File ls path(/home)\nA script is a text file of Omni commands; Omni File run runs it.\n', { quiet: true })
    this._schedule()
  }
  _clean (n, depth) {   // never trust stored data
    if (n.t === 'f') return { t: 'f', s: typeof n.s === 'string' ? n.s.slice(0, LIMITS.file) : '', m: Number(n.m) || Date.now() }
    const o = dir(); o.m = Number(n.m) || Date.now()
    if (depth < LIMITS.depth && n.c && typeof n.c === 'object') for (const [k, v] of Object.entries(n.c)) if (NAME_OK.test(k) && v && typeof v === 'object' && (v.t === 'f' || v.t === 'd')) o.c[k] = this._clean(v, depth + 1)
    return o
  }
  snapshot () { return { v: VERSION, root: this.root } }
  _schedule () { clearTimeout(this._timer); this._timer = setTimeout(() => this.flush(), this.saveDelay) }
  async flush () { clearTimeout(this._timer); this._timer = null; try { await this.adapter.save(this.snapshot()); this.lastSaveError = null; return true } catch (e) { this.lastSaveError = String(e?.message ?? e); return false } }
  _changed (path, quiet) { this._schedule(); if (!quiet) try { this.onChange?.(path) } catch (_) {} }

  // ── paths ──
  resolve (p) {
    let s = String(p ?? '').trim(); if (s === '') s = '.'
    const parts = (s.startsWith('/') ? [] : this.cwd.split('/').filter(Boolean))
    for (const seg of s.split('/')) { if (seg === '' || seg === '.') continue; if (seg === '..') parts.pop(); else parts.push(seg) }
    if (parts.length > LIMITS.depth) throw new Error(`paths can be at most ${LIMITS.depth} folders deep`)
    for (const seg of parts) if (!NAME_OK.test(seg)) throw new Error(`"${seg}" is not a valid name (up to ${LIMITS.name} characters, none of  / \\ : * ? " < > |)`)
    return '/' + parts.join('/')
  }
  _node (abs) { let n = this.root; for (const seg of abs.split('/').filter(Boolean)) { if (n.t !== 'd' || !(seg in n.c)) return null; n = n.c[seg] } return n }
  _parent (abs) { const parts = abs.split('/').filter(Boolean); const name = parts.pop(); return { name, parent: this._node('/' + parts.join('/')) } }
  _count (n = this.root) { let c = 1; if (n.t === 'd') for (const v of Object.values(n.c)) c += this._count(v); return c }
  _bytes (n = this.root) { if (n.t === 'f') return n.s.length; let c = 0; for (const v of Object.values(n.c)) c += this._bytes(v); return c }
  usage () { return { entries: this._count() - 1, chars: this._bytes(), limits: LIMITS } }

  // ── reading ──
  pwd () { return this.cwd }
  exists (p) { try { return !!this._node(this.resolve(p)) } catch (_) { return false } }
  stat (p) {
    const abs = this.resolve(p), n = this._node(abs); if (!n) throw new Error(`${abs} does not exist`)
    return { path: abs, type: n.t === 'd' ? 'dir' : 'file', size: n.t === 'f' ? n.s.length : Object.keys(n.c).length, modified: n.m }
  }
  cd (p) { const abs = this.resolve(p), n = this._node(abs); if (!n) throw new Error(`${abs} does not exist`); if (n.t !== 'd') throw new Error(`${abs} is a file, not a folder`); this.cwd = abs; return abs }
  ls (p = '.') {
    const abs = this.resolve(p), n = this._node(abs); if (!n) throw new Error(`${abs} does not exist`)
    if (n.t === 'f') return [{ name: abs.split('/').pop(), type: 'file', size: n.s.length, modified: n.m }]
    return Object.entries(n.c).sort(([a, x], [b, y]) => (x.t === y.t ? a.localeCompare(b) : x.t === 'd' ? -1 : 1)).map(([name, v]) => ({ name, type: v.t === 'd' ? 'dir' : 'file', size: v.t === 'f' ? v.s.length : Object.keys(v.c).length, modified: v.m }))
  }
  tree (p = '.', maxDepth = 6) {
    const abs = this.resolve(p), n = this._node(abs); if (!n) throw new Error(`${abs} does not exist`)
    const out = [abs === '/' ? '/' : abs.split('/').pop() + (n.t === 'd' ? '/' : '')]
    const walk = (node, prefix, d) => {
      if (node.t !== 'd' || d >= maxDepth) return
      const ents = Object.entries(node.c).sort(([a, x], [b, y]) => (x.t === y.t ? a.localeCompare(b) : x.t === 'd' ? -1 : 1))
      ents.forEach(([name, v], i) => { const last = i === ents.length - 1; out.push(prefix + (last ? '└─ ' : '├─ ') + name + (v.t === 'd' ? '/' : '')); walk(v, prefix + (last ? '   ' : '│  '), d + 1) })
    }
    walk(n, '', 0); return out
  }
  read (p) {
    const abs = this.resolve(p), n = this._node(abs); if (!n) throw new Error(`${abs} does not exist`)
    if (n.t !== 'f') throw new Error(`${abs} is a folder, not a file`); return n.s
  }
  find (pattern, p = '/') {
    const rx = new RegExp('^' + String(pattern).replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i'), hits = []
    const walk = (n, path) => { for (const [name, v] of Object.entries(n.c)) { const q = (path === '/' ? '' : path) + '/' + name; if (rx.test(name)) hits.push(q + (v.t === 'd' ? '/' : '')); if (v.t === 'd') walk(v, q) } }
    const abs = this.resolve(p), n = this._node(abs); if (!n || n.t !== 'd') throw new Error(`${abs} is not a folder`); walk(n, abs); return hits.slice(0, 500)
  }

  // ── writing ──
  mkdir (p, { parents = true, quiet = false } = {}) {
    const abs = this.resolve(p); if (abs === '/') return abs
    let n = this.root, path = ''
    const segs = abs.split('/').filter(Boolean)
    for (let i = 0; i < segs.length; i++) {
      const seg = segs[i]; path += '/' + seg
      if (seg in n.c) { if (n.c[seg].t !== 'd') throw new Error(`${path} is a file`); n = n.c[seg]; continue }
      if (!parents && i < segs.length - 1) throw new Error(`${path} does not exist (use parents to create the folders above it)`)
      if (this._count() >= LIMITS.entries) throw new Error(`the file system is full (${LIMITS.entries} entries)`)
      n.c[seg] = dir(); n.m = Date.now(); n = n.c[seg]
    }
    this._changed(abs, quiet); return abs
  }
  write (p, text, { append = false, parents = true, quiet = false } = {}) {
    const abs = this.resolve(p); if (abs === '/') throw new Error('/ is a folder')
    const { name, parent } = this._parent(abs)
    let par = parent
    if (!par) { if (!parents) throw new Error(`the folder above ${abs} does not exist`); this.mkdir(abs.split('/').slice(0, -1).join('/') || '/', { quiet: true }); par = this._node(abs.split('/').slice(0, -1).join('/') || '/') }
    if (par.t !== 'd') throw new Error(`the folder above ${abs} is a file`)
    const old = par.c[name]; if (old?.t === 'd') throw new Error(`${abs} is a folder`)
    const body = (append && old ? old.s : '') + String(text ?? '')
    if (body.length > LIMITS.file) throw new Error(`a file can hold at most ${LIMITS.file.toLocaleString()} characters`)
    if (this._bytes() - (old ? old.s.length : 0) + body.length > LIMITS.total) throw new Error(`the file system is full (${LIMITS.total.toLocaleString()} characters)`)
    if (!old && this._count() >= LIMITS.entries) throw new Error(`the file system is full (${LIMITS.entries} entries)`)
    par.c[name] = { t: 'f', s: body, m: Date.now() }; par.m = Date.now()
    this._changed(abs, quiet); return { path: abs, size: body.length }
  }
  rm (p, { recursive = false } = {}) {
    const abs = this.resolve(p); if (abs === '/') throw new Error('the root folder cannot be removed')
    const n = this._node(abs); if (!n) throw new Error(`${abs} does not exist`)
    if (n.t === 'd' && Object.keys(n.c).length && !recursive) throw new Error(`${abs} is not empty (use recursive)`)
    const { name, parent } = this._parent(abs); delete parent.c[name]; parent.m = Date.now()
    if (this.cwd === abs || this.cwd.startsWith(abs + '/')) this.cwd = '/'
    this._changed(abs); return abs
  }
  _clone (n) { return n.t === 'f' ? { ...n, m: Date.now() } : { t: 'd', c: Object.fromEntries(Object.entries(n.c).map(([k, v]) => [k, this._clone(v)])), m: Date.now() } }
  cp (a, b) {
    const from = this.resolve(a), n = this._node(from); if (!n) throw new Error(`${from} does not exist`)
    let to = this.resolve(b); const t = this._node(to)
    if (t?.t === 'd') to = this.resolve(to + '/' + from.split('/').pop())
    if (to === from || to.startsWith(from + '/')) throw new Error('a folder cannot be copied into itself')
    const copy = this._clone(n); const { name, parent } = this._parent(to)
    if (!parent || parent.t !== 'd') throw new Error(`the folder above ${to} does not exist`)
    if (this._count() + this._count(n) > LIMITS.entries) throw new Error(`the file system is full (${LIMITS.entries} entries)`)
    if (this._bytes() + this._bytes(n) > LIMITS.total) throw new Error('the file system is full')
    parent.c[name] = copy; this._changed(to); return to
  }
  mv (a, b) {
    const from = this.resolve(a); if (from === '/') throw new Error('the root folder cannot be moved')
    const n = this._node(from); if (!n) throw new Error(`${from} does not exist`)
    let to = this.resolve(b); const t = this._node(to)
    if (t?.t === 'd') to = this.resolve(to + '/' + from.split('/').pop())
    if (to === from) return to
    if (to.startsWith(from + '/')) throw new Error('a folder cannot be moved into itself')
    const { name, parent } = this._parent(to); if (!parent || parent.t !== 'd') throw new Error(`the folder above ${to} does not exist`)
    const src = this._parent(from); delete src.parent.c[src.name]; parent.c[name] = n; n.m = Date.now()
    if (this.cwd === from || this.cwd.startsWith(from + '/')) this.cwd = '/'
    this._changed(to); return to
  }
}
