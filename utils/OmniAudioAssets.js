/**
 * utils/OmniAudioAssets.js (V198) — AUDIO ASSETS: import any audio file the browser can decode, keep it in IndexedDB, draw it (peaks), play it as a clip.
 *
 * Contract: docs/architecture/OMNISONG_CONTRACT.md ("Audio assets"); design: docs/architecture/OMNIAUDIOASSETS_DESIGN.md.
 *   AudioAssets.importFile(file)            -> Promise<{ok, id?, meta?, error?}>   error = {code, message} (also res.code / res.message; String(error) is the message)
 *   AudioAssets.list() / getMeta(id) / remove(id) / rename(id, name) / usage()      (list is oldest first)
 *   AudioAssets.getBuffer(ctx, id)          -> Promise<AudioBuffer|null>            decoded on the CALLER'S context, per-context LRU (200 MB of decoded audio)
 *   AudioAssets.getPeaks(id, n = 512)       -> Promise<Float32Array|null>           2n values: [min0, max0, min1, max1 ...], min in -1..0, max in 0..1, the loudest sample = +-1
 *   AudioAssets.playClip(ctx, id, {when, offset, duration, gain, fadeIn, fadeOut, rate, dest}) -> {stop(at?), done}   synchronous; done never rejects
 *   computePeaks(channelData, n) / peaksFromBuffer(buffer, n)                       pure
 * Error codes: 'unsupported' (not audio / not decodable format), 'too-large' (> 40 MB per file), 'quota' (library full: 300 MB, or the browser storage is full),
 *   'decode' (looks like audio but the browser cannot decode it), 'empty', 'not-a-file', plus 'storage' (any other storage failure) and 'missing' (unknown id).
 * Every async function resolves, never rejects. Nothing here creates or resumes the sound engine's AudioContext: files are decoded on an OfflineAudioContext (or a
 * temporary AudioContext that is closed again); playback uses the context you pass in. The extension / mime type of a file is advisory only: the BYTES decide
 * (magic numbers reject images and other obvious non-audio quickly; anything else is handed to decodeAudioData).
 * Storage: IndexedDB 'omni-audio-assets-v1' (stores 'meta' and 'blobs'; the blob store keeps the original bytes + the cached waveform). When IndexedDB is unavailable
 * (private mode, blocked, error) a memory store takes over and `persistent` is false (the assets vanish when the page closes).
 * Event: window 'omni:audio-assets-changed' {action:'add'|'remove'|'rename', id}.
 */

export const DB_NAME = 'omni-audio-assets-v1'
export const DB_VERSION = 1
export const STORE_META = 'meta'
export const STORE_BLOBS = 'blobs'
export const MAX_FILE_BYTES = 40 * 1024 * 1024
export const MAX_TOTAL_BYTES = 300 * 1024 * 1024
export const MAX_CACHE_BYTES = 200 * 1024 * 1024          // decoded audio kept in memory (all contexts together)
export const MAX_DECODED_BYTES = 600 * 1024 * 1024        // one decoded asset above this is refused ('too-large': it would not fit in memory)
export const MAX_NAME = 60
export const DEFAULT_PEAKS = 512
export const MAX_PEAKS = 8192
export const EVENT = 'omni:audio-assets-changed'
const DECODE_TIMEOUT_MS = 60000

// ── Errors ─────────────────────────────────────────────────────────────────

const MB = (b) => (b / 1048576).toFixed(b >= 10485760 ? 0 : 1)
export function makeError (code, message) { return { code, message, toString () { return message } } }
const fail = (code, message) => { const error = makeError(code, message); return { ok: false, code, message, error } }

// ── Pure helpers ───────────────────────────────────────────────────────────

/** A display name from a file name: no folders, no extension, no control / reserved characters, collapsed spaces, <= 60 chars; never empty. */
export function sanitizeName (raw, fallback = 'Audio', isFileName = true) {
  let s = String(raw ?? '')
  if (isFileName) { s = s.replace(/^.*[\\/]/, ''); s = s.replace(/\.[A-Za-z0-9]{1,5}$/, '') }
  s = s.replace(/[\u0000-\u001f\u007f<>:"/\\|?*​-‏‪-‮]/g, ' ').replace(/\s+/g, ' ').trim()
  if (s.length > MAX_NAME) s = s.slice(0, MAX_NAME).trim()
  s = s.replace(/^\.+/, '')
  return s || fallback
}

/** "Name" -> "Name (2)" -> "Name (3)" ... against a list of names already taken (case-insensitive). */
export function uniqueName (name, taken) {
  const set = new Set([...taken].map(n => String(n).toLowerCase()))
  if (!set.has(name.toLowerCase())) return name
  const base = name.replace(/ \(\d+\)$/, '')
  for (let i = 2; i < 10000; i++) {
    const suffix = ` (${i})`
    const cand = (base.length + suffix.length > MAX_NAME ? base.slice(0, MAX_NAME - suffix.length).trim() : base) + suffix
    if (!set.has(cand.toLowerCase())) return cand
  }
  return `${base} ${Date.now().toString(36)}`
}

const asc = (b, i, s) => { for (let k = 0; k < s.length; k++) if (b[i + k] !== s.charCodeAt(k)) return false; return true }

/**
 * Sniff the first bytes. -> { kind:'audio'|'not-audio'|'unknown', format, label }.
 * 'audio' formats are only a hint (the decoder decides); 'not-audio' is a recognised image / document / archive / program / midi / text-like file.
 */
export function sniffBytes (u8) {
  const b = u8 || new Uint8Array(0)
  const n = b.length
  const A = (format) => ({ kind: 'audio', format })
  const N = (format, label) => ({ kind: 'not-audio', format, label })
  if (n >= 12 && asc(b, 0, 'RIFF')) {
    if (asc(b, 8, 'WAVE')) return A('wav')
    if (asc(b, 8, 'WEBP')) return N('webp', 'an image')
    if (asc(b, 8, 'AVI ')) return N('avi', 'a video')
    return { kind: 'unknown', format: 'riff' }
  }
  if (n >= 3 && asc(b, 0, 'ID3')) return A('mp3')
  if (n >= 4 && asc(b, 0, 'OggS')) return A('ogg')
  if (n >= 4 && asc(b, 0, 'fLaC')) return A('flac')
  if (n >= 12 && asc(b, 0, 'FORM') && (asc(b, 8, 'AIFF') || asc(b, 8, 'AIFC'))) return A('aiff')
  if (n >= 4 && b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return A('webm')
  if (n >= 4 && asc(b, 0, 'MThd')) return N('midi', 'a MIDI file (notes, not sound)')
  if (n >= 12 && asc(b, 4, 'ftyp')) {
    const brand = String.fromCharCode(b[8], b[9], b[10], b[11])
    if (/^(heic|heix|hevc|hevx|mif1|msf1|avif|avis)$/.test(brand)) return N('heic', 'an image')
    if (['M4A ', 'M4B ', 'M4P ', 'F4A '].includes(brand)) return A('m4a')
    if (brand === 'qt  ') return A('mov')
    return A('mp4')
  }
  if (n >= 2 && b[0] === 0xff && (b[1] & 0xf6) === 0xf0) return A('aac')            // ADTS
  if (n >= 2 && b[0] === 0xff && (b[1] & 0xe0) === 0xe0 && (b[1] & 0x06) !== 0) return A('mp3')   // MPEG frame sync
  if (n >= 4 && b[0] === 0x89 && asc(b, 1, 'PNG')) return N('png', 'an image')
  if (n >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return N('jpeg', 'an image')
  if (n >= 4 && asc(b, 0, 'GIF8')) return N('gif', 'an image')
  if (n >= 2 && b[0] === 0x42 && b[1] === 0x4d) return N('bmp', 'an image')
  if (n >= 4 && ((b[0] === 0x49 && b[1] === 0x49 && b[2] === 0x2a && b[3] === 0) || (b[0] === 0x4d && b[1] === 0x4d && b[2] === 0 && b[3] === 0x2a))) return N('tiff', 'an image')
  if (n >= 4 && b[0] === 0 && b[1] === 0 && b[2] === 1 && b[3] === 0) return N('ico', 'an image')
  if (n >= 4 && asc(b, 0, '%PDF')) return N('pdf', 'a PDF document')
  if (n >= 4 && b[0] === 0x50 && b[1] === 0x4b && (b[2] === 3 || b[2] === 5)) return N('zip', 'a zip archive')
  if (n >= 6 && b[0] === 0x37 && b[1] === 0x7a && b[2] === 0xbc && b[3] === 0xaf) return N('7z', 'an archive')
  if (n >= 2 && b[0] === 0x1f && b[1] === 0x8b) return N('gzip', 'an archive')
  if (n >= 2 && b[0] === 0x4d && b[1] === 0x5a) return N('exe', 'a program')
  if (n >= 4 && b[0] === 0x7f && asc(b, 1, 'ELF')) return N('elf', 'a program')
  if (n >= 5 && (asc(b, 0, '<?xml') || asc(b, 0, '<svg') || asc(b, 0, '<!DOC') || asc(b, 0, '<html') || asc(b, 0, '<HTML'))) return N('markup', 'a text / markup file')
  return { kind: 'unknown', format: 'unknown' }
}

/** The WAV header (RIFF/WAVE fmt chunk), or null: { sampleRate, channels, bits }. Used for the true sample rate (decoders resample to the context rate). */
export function wavInfo (u8) {
  try {
    if (!u8 || u8.length < 28 || !asc(u8, 0, 'RIFF') || !asc(u8, 8, 'WAVE')) return null
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength)
    let p = 12
    while (p + 8 <= u8.length) {
      const id = String.fromCharCode(u8[p], u8[p + 1], u8[p + 2], u8[p + 3]); const sz = dv.getUint32(p + 4, true)
      if (id === 'fmt ' && p + 24 <= u8.length) return { channels: dv.getUint16(p + 10, true), sampleRate: dv.getUint32(p + 12, true), bits: dv.getUint16(p + 22, true) }
      p += 8 + sz + (sz & 1)
    }
  } catch (_) { /* fall through */ }
  return null
}

/**
 * Min / max pairs for drawing a waveform. channelData is one Float32Array (or array-like) or an array of them (channels are merged).
 * Returns Float32Array(2n): [min0, max0, min1, max1 ...]; min <= 0 <= max, normalised so the loudest sample is exactly +-1 (silence stays 0). Never throws.
 */
export function computePeaks (channelData, n = DEFAULT_PEAKS, opts = {}) {
  const count = Math.max(1, Math.min(MAX_PEAKS, Math.floor(Number(n)) || DEFAULT_PEAKS))
  const out = new Float32Array(count * 2)
  try {
    const chans = (channelData && typeof channelData.length === 'number' && channelData.length > 0 && typeof channelData[0] !== 'number') ? Array.from(channelData) : [channelData]
    let len = 0
    for (const c of chans) if (c && c.length > len) len = c.length
    if (!len) return out
    let peak = 0
    for (let i = 0; i < count; i++) {
      const a = Math.floor(i * len / count)
      const z = Math.max(a + 1, Math.floor((i + 1) * len / count))
      let mn = 0, mx = 0
      for (const c of chans) {
        if (!c) continue
        const end = Math.min(z, c.length)
        for (let k = a; k < end; k++) { const v = c[k]; if (v < mn) mn = v; else if (v > mx) mx = v }
      }
      if (!Number.isFinite(mn)) mn = 0
      if (!Number.isFinite(mx)) mx = 0
      out[2 * i] = mn; out[2 * i + 1] = mx
      const m = Math.max(-mn, mx); if (m > peak) peak = m
    }
    if (opts.normalize !== false && peak > 0) { for (let i = 0; i < out.length; i++) out[i] /= peak }
    else if (peak > 1) { for (let i = 0; i < out.length; i++) out[i] /= peak }
  } catch (_) { out.fill(0) }
  return out
}

/** computePeaks over every channel of an AudioBuffer (or anything with numberOfChannels + getChannelData). */
export function peaksFromBuffer (buffer, n = DEFAULT_PEAKS) {
  try {
    const chans = []
    for (let c = 0; c < (buffer.numberOfChannels || 0); c++) chans.push(buffer.getChannelData(c))
    return computePeaks(chans, n)
  } catch (_) { return new Float32Array(Math.max(1, Math.min(MAX_PEAKS, Math.floor(Number(n)) || DEFAULT_PEAKS)) * 2) }
}

const clampNum = (v, lo, hi, d) => { v = Number(v); if (!Number.isFinite(v)) return d; return Math.min(hi, Math.max(lo, v)) }

// ── Byte helpers ───────────────────────────────────────────────────────────

async function readBytes (file) {
  if (typeof file.arrayBuffer === 'function') return await file.arrayBuffer()
  return await new Promise((resolve, reject) => {
    const FR = globalThis.FileReader || (typeof window !== 'undefined' && window.FileReader)
    if (!FR) { reject(new Error('no reader')); return }
    const r = new FR(); r.onload = () => resolve(r.result); r.onerror = () => reject(r.error || new Error('read failed')); r.readAsArrayBuffer(file)
  })
}

const isQuotaError = (e) => !!e && (e.name === 'QuotaExceededError' || e.code === 22 || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || /quota/i.test(String(e.message || '')))

// ── The store (IndexedDB with a memory fallback) ───────────────────────────

function createStore (getIDB) {
  const st = { persistent: true, db: null, opening: null, mem: { meta: new Map(), blobs: new Map() }, useMem: false, reason: '' }

  function toMem (reason) { st.useMem = true; st.persistent = false; st.reason = String(reason || ''); try { st.db?.close() } catch (_) { /* ignore */ } st.db = null }

  function open () {
    if (st.useMem) return Promise.resolve(null)
    if (st.db) return Promise.resolve(st.db)
    if (st.opening) return st.opening
    st.opening = new Promise((resolve) => {
      let idb = null
      try { idb = getIDB() } catch (_) { idb = null }
      if (!idb) { toMem('IndexedDB is not available'); resolve(null); return }
      let req
      try { req = idb.open(DB_NAME, DB_VERSION) } catch (e) { toMem(e?.message || 'IndexedDB is blocked'); resolve(null); return }
      let settled = false
      const done = (db) => { if (settled) return; settled = true; resolve(db) }
      const timer = setTimeout(() => { if (!st.db) { toMem('IndexedDB did not answer'); done(null) } }, 8000)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(STORE_META)) db.createObjectStore(STORE_META, { keyPath: 'id' })
        if (!db.objectStoreNames.contains(STORE_BLOBS)) db.createObjectStore(STORE_BLOBS, { keyPath: 'id' })
      }
      req.onsuccess = () => {
        clearTimeout(timer)
        const db = req.result
        db.onversionchange = () => { try { db.close() } catch (_) { /* ignore */ } if (st.db === db) st.db = null }
        db.onclose = () => { if (st.db === db) st.db = null }
        st.db = db; done(db)
      }
      req.onerror = () => { clearTimeout(timer); toMem(req.error?.message || 'IndexedDB could not be opened'); done(null) }
      req.onblocked = () => { /* wait: onsuccess follows when the other tab lets go; the timer covers a permanent block */ }
    }).finally(() => { st.opening = null })
    return st.opening
  }

  /** Run fn(stores) in one transaction; resolves when the transaction completes. Throws the transaction error (quota etc.). */
  async function tx (names, mode, fn) {
    const db = await open()
    if (!db) {
      const res = await fn({ meta: memStore(st.mem.meta), blobs: memStore(st.mem.blobs) })
      return res
    }
    return await new Promise((resolve, reject) => {
      let t, pr = Promise.resolve()
      try { t = db.transaction(names, mode) } catch (e) { reject(e); return }
      t.oncomplete = () => { pr.then(resolve, reject) }
      t.onerror = () => reject(t.error || new Error('transaction failed'))
      t.onabort = () => reject(t.error || new Error('transaction aborted'))
      try {
        const stores = { meta: names.includes(STORE_META) ? idbStore(t.objectStore(STORE_META)) : null, blobs: names.includes(STORE_BLOBS) ? idbStore(t.objectStore(STORE_BLOBS)) : null }
        pr = Promise.resolve(fn(stores))
        pr.catch((e) => { try { t.abort() } catch (_) { /* ignore */ } reject(e) })
      } catch (e) { try { t.abort() } catch (_) { /* ignore */ } reject(e) }
    })
  }
  const req2p = (rq) => new Promise((resolve, reject) => { rq.onsuccess = () => resolve(rq.result); rq.onerror = () => reject(rq.error) })
  const idbStore = (os) => ({ get: (k) => req2p(os.get(k)), getAll: () => req2p(os.getAll()), put: (v) => req2p(os.put(v)), delete: (k) => req2p(os.delete(k)) })
  const memStore = (m) => ({ get: async (k) => (m.has(k) ? structuredCopyRec(m.get(k)) : undefined), getAll: async () => [...m.values()].map(structuredCopyRec), put: async (v) => { m.set(v.id, v) }, delete: async (k) => { m.delete(k) } })
  const structuredCopyRec = (v) => v   // memory records are never mutated by callers (replaced whole)

  return {
    st,
    open,
    tx,
    get persistent () { return st.persistent },
    get reason () { return st.reason },
    toMem,
    /** Test / recovery hook: forget the connection (the next call re-opens). */
    reset () { try { st.db?.close() } catch (_) { /* ignore */ } st.db = null; st.opening = null },
  }
}

// ── The service ────────────────────────────────────────────────────────────

let _idSeq = 0
const newId = () => 'au_' + Date.now().toString(36) + (++_idSeq).toString(36) + Math.random().toString(36).slice(2, 7)

/**
 * createAudioAssets(opts) -> the AudioAssets API. The module exports one ready-made instance (`AudioAssets`, also the default export).
 * opts (all optional; tests): indexedDB, makeDecodeContext() -> {ctx, close()}, estimate() -> Promise<{usage,quota}>, win (event target), limits {file,total,cache,decoded}.
 */
export function createAudioAssets (opts = {}) {
  const lim = { file: MAX_FILE_BYTES, total: MAX_TOTAL_BYTES, cache: MAX_CACHE_BYTES, decoded: MAX_DECODED_BYTES, ...(opts.limits || {}) }
  const store = createStore(() => (opts.indexedDB !== undefined ? opts.indexedDB : (typeof indexedDB !== 'undefined' ? indexedDB : null)))
  const getWin = () => (opts.win !== undefined ? opts.win : (typeof window !== 'undefined' ? window : null))
  let metaCache = null           // Map id -> meta (loaded once, kept in step with the store)
  let chain = Promise.resolve()  // serialises writes (names, caps)
  const peaksCache = new Map()   // `${id}|${n}` -> Float32Array
  const lru = new Map()          // `${cid}|${id}` -> { buffer, bytes }
  const pending = new Map()      // `${cid}|${id}` -> Promise
  const ctxIds = new WeakMap(); let ctxSeq = 0
  let cacheBytes = 0

  const emit = (action, id) => {
    const w = getWin(); if (!w) return
    try { w.dispatchEvent(new w.CustomEvent(EVENT, { detail: { action, id } })) } catch (_) { try { w.dispatchEvent(new CustomEvent(EVENT, { detail: { action, id } })) } catch (__) { /* no window */ } }
  }
  const locked = (fn) => { const p = chain.then(fn, fn); chain = p.then(() => {}, () => {}); return p }
  const cid = (ctx) => { let v = ctxIds.get(ctx); if (!v) { v = ++ctxSeq; ctxIds.set(ctx, v) } return v }

  async function loadMeta () {
    if (metaCache) return metaCache
    const m = new Map()
    try {
      const all = await store.tx([STORE_META], 'readonly', (s) => s.meta.getAll())
      for (const r of all || []) if (r && typeof r.id === 'string') m.set(r.id, cleanMeta(r))
    } catch (e) {
      if (!store.st.useMem) { store.toMem(e?.message || 'IndexedDB failed'); return await loadMeta() }
    }
    metaCache = m
    return m
  }
  function cleanMeta (r) {
    return { id: r.id, name: String(r.name ?? 'Audio'), duration: Number(r.duration) || 0, sampleRate: Number(r.sampleRate) || 0, channels: Number(r.channels) || 0, bytes: Number(r.bytes) || 0, addedAt: Number(r.addedAt) || 0, format: String(r.format || 'unknown'), type: String(r.type || '') }
  }

  // decoding on a throwaway context -----------------------------------------
  function makeDecodeContext () {
    if (typeof opts.makeDecodeContext === 'function') return opts.makeDecodeContext()
    const G = globalThis
    const Off = G.OfflineAudioContext || G.webkitOfflineAudioContext
    if (Off) { try { return { ctx: new Off(2, 1, 44100), close () {} } } catch (_) { /* try the live one */ } }
    const Live = G.AudioContext || G.webkitAudioContext
    if (Live) { const ctx = new Live(); return { ctx, close () { try { const p = ctx.close(); p && p.catch && p.catch(() => {}) } catch (_) { /* ignore */ } } } }
    return null
  }
  function decodeOn (ctx, ab) {
    return new Promise((resolve, reject) => {
      let finished = false
      const timer = setTimeout(() => { if (!finished) { finished = true; reject(new Error('decode timed out')) } }, DECODE_TIMEOUT_MS)
      const ok = (b) => { if (finished) return; finished = true; clearTimeout(timer); resolve(b) }
      const bad = (e) => { if (finished) return; finished = true; clearTimeout(timer); reject(e || new Error('decode failed')) }
      try {
        const r = ctx.decodeAudioData(ab, ok, bad)
        if (r && typeof r.then === 'function') r.then(ok, bad)
      } catch (e) { bad(e) }
    })
  }
  async function decodeBytes (ab) {
    const dc = makeDecodeContext()
    if (!dc) { const e = new Error('no audio'); e.noAudio = true; throw e }
    try { return await decodeOn(dc.ctx, ab.slice(0)) } finally { try { dc.close() } catch (_) { /* ignore */ } }
  }

  async function storageFree () {
    try {
      const est = typeof opts.estimate === 'function' ? await opts.estimate() : (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate ? await navigator.storage.estimate() : null)
      if (est && Number.isFinite(est.quota) && est.quota > 0) return Math.max(0, est.quota - (Number(est.usage) || 0))
    } catch (_) { /* unknown */ }
    return Infinity
  }

  // API ----------------------------------------------------------------------
  async function importFile (file) {
    try {
      if (!file || typeof file !== 'object' || (typeof file.size !== 'number' && typeof file.byteLength !== 'number')) return fail('not-a-file', 'That is not a file. Choose an audio file from your device.')
      const label = sanitizeName(file.name || 'Audio')
      const size = typeof file.size === 'number' ? file.size : file.byteLength
      if (!size) return fail('empty', `"${label}" is empty (0 bytes). Pick a file that has sound in it.`)
      if (size > lim.file) return fail('too-large', `"${label}" is ${MB(size)} MB. The limit is ${MB(lim.file)} MB per file. Trim it or save a shorter / compressed version (MP3, OGG).`)
      return await locked(async () => {
        const meta = await loadMeta()
        let used = 0; for (const m of meta.values()) used += m.bytes
        if (used + size > lim.total) return fail('quota', `The audio library is full (${MB(used)} of ${MB(lim.total)} MB used). Delete a file to make room for "${label}".`)
        let ab
        try { ab = file instanceof ArrayBuffer ? file : (ArrayBuffer.isView(file) ? file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) : await readBytes(file)) } catch (_) { return fail('not-a-file', `"${label}" could not be read. Try choosing it again.`) }
        if (!ab || !ab.byteLength) return fail('empty', `"${label}" is empty (0 bytes). Pick a file that has sound in it.`)
        const head = new Uint8Array(ab, 0, Math.min(64, ab.byteLength))
        const sn = sniffBytes(head)
        if (sn.kind === 'not-audio') return fail('unsupported', `"${label}" looks like ${sn.label}, not audio. Choose a sound file (WAV, MP3, OGG, M4A ...).`)
        const free = await storageFree()
        if (free < ab.byteLength * 1.1) return fail('quota', `Your browser has no room left for "${label}" (${MB(ab.byteLength)} MB needed, ${MB(free)} MB free). Free some space or delete audio from the library.`)
        let buf
        try { buf = await decodeBytes(ab) } catch (e) {
          if (e && e.noAudio) return fail('unsupported', 'This browser has no Web Audio, so sound files cannot be opened here.')
          const hint = sn.kind === 'audio' ? `It looks like ${sn.format.toUpperCase()}, but the file may be damaged or use a codec this browser cannot play.` : 'It may not be an audio file, may be damaged, or may use a format this browser cannot play.'
          return fail('decode', `"${label}" could not be decoded. ${hint} Try WAV, MP3 or OGG.`)
        }
        const channels = buf.numberOfChannels || 1
        const decodedBytes = (buf.length || 0) * channels * 4
        if (decodedBytes > lim.decoded) return fail('too-large', `"${label}" is too long to use (${Math.round(buf.duration / 60)} min decoded). Use a shorter file.`)
        if (!(buf.duration > 0) && !(buf.length > 0)) return fail('empty', `"${label}" has no sound in it.`)
        const wi = wavInfo(new Uint8Array(ab, 0, Math.min(ab.byteLength, 4096)))
        const taken = [...meta.values()].map(m => m.name)
        const rec = {
          id: newId(), name: uniqueName(sanitizeName(file.name || 'Audio'), taken),
          duration: Number(buf.duration) || (buf.length / (buf.sampleRate || 44100)), sampleRate: (wi && wi.sampleRate) || buf.sampleRate || 0, channels: (wi && wi.channels) || channels,
          bytes: ab.byteLength, addedAt: Date.now(), format: sn.kind === 'audio' ? sn.format : (guessFromName(file.name) || 'unknown'), type: String(file.type || ''),
        }
        const peaks = peaksFromBuffer(buf, DEFAULT_PEAKS)
        try {
          await store.tx([STORE_META, STORE_BLOBS], 'readwrite', (s) => Promise.all([s.blobs.put({ id: rec.id, bytes: ab, type: rec.type, peaks }), s.meta.put(rec)]))
        } catch (e) {
          if (isQuotaError(e)) return fail('quota', `Your browser ran out of storage while saving "${label}". Delete audio from the library or free some disk space.`)
          if (!store.st.useMem) {
            // IndexedDB failed for another reason: keep the user's work in memory (flagged not persistent)
            store.toMem(e?.message || 'IndexedDB failed')
            try { await store.tx([STORE_META, STORE_BLOBS], 'readwrite', (s) => Promise.all([s.blobs.put({ id: rec.id, bytes: ab, type: rec.type, peaks }), s.meta.put(rec)])) } catch (e2) { return fail('storage', `"${label}" could not be stored: ${e2?.message || 'unknown error'}.`) }
          } else return fail('storage', `"${label}" could not be stored: ${e?.message || 'unknown error'}.`)
        }
        meta.set(rec.id, rec)
        peaksCache.set(`${rec.id}|${DEFAULT_PEAKS}`, peaks)
        emit('add', rec.id)
        return { ok: true, id: rec.id, meta: { ...rec } }
      })
    } catch (e) {
      return fail('storage', `The file could not be imported: ${e?.message || 'unknown error'}.`)
    }
  }
  const guessFromName = (n) => { const m = /\.([A-Za-z0-9]{1,5})$/.exec(String(n || '')); return m ? m[1].toLowerCase() : '' }

  async function list () {
    try { const m = await loadMeta(); return [...m.values()].sort((a, b) => a.addedAt - b.addedAt || (a.id < b.id ? -1 : 1)).map(x => ({ ...x })) } catch (_) { return [] }
  }
  async function getMeta (id) { try { const m = await loadMeta(); const r = m.get(String(id)); return r ? { ...r } : null } catch (_) { return null } }

  function dropCaches (id) {
    for (const k of [...peaksCache.keys()]) if (k.startsWith(id + '|')) peaksCache.delete(k)
    for (const [k, v] of [...lru]) if (k.endsWith('|' + id)) { cacheBytes -= v.bytes; lru.delete(k) }
    for (const k of [...pending.keys()]) if (k.endsWith('|' + id)) pending.delete(k)
  }
  async function remove (id) {
    try {
      id = String(id)
      return await locked(async () => {
        const meta = await loadMeta()
        if (!meta.has(id)) return fail('missing', 'That audio file is not in the library any more.')
        try { await store.tx([STORE_META, STORE_BLOBS], 'readwrite', (s) => Promise.all([s.meta.delete(id), s.blobs.delete(id)])) } catch (e) { return fail('storage', `It could not be deleted: ${e?.message || 'unknown error'}.`) }
        meta.delete(id); dropCaches(id)
        emit('remove', id)
        return { ok: true, id }
      })
    } catch (e) { return fail('storage', String(e?.message || e)) }
  }
  async function rename (id, name) {
    try {
      id = String(id)
      return await locked(async () => {
        const meta = await loadMeta(); const cur = meta.get(id)
        if (!cur) return fail('missing', 'That audio file is not in the library any more.')
        const clean = uniqueName(sanitizeName(name, cur.name, false), [...meta.values()].filter(m => m.id !== id).map(m => m.name))
        if (clean === cur.name) return { ok: true, id, meta: { ...cur } }
        const next = { ...cur, name: clean }
        try { await store.tx([STORE_META], 'readwrite', (s) => s.meta.put(next)) } catch (e) { return fail('storage', `It could not be renamed: ${e?.message || 'unknown error'}.`) }
        meta.set(id, next)
        emit('rename', id)
        return { ok: true, id, meta: { ...next } }
      })
    } catch (e) { return fail('storage', String(e?.message || e)) }
  }
  async function usage () {
    const base = { bytes: 0, count: 0, limitBytes: lim.total, fileLimitBytes: lim.file, persistent: store.persistent }
    try {
      const m = await loadMeta(); let bytes = 0; for (const x of m.values()) bytes += x.bytes
      const out = { ...base, bytes, count: m.size, persistent: store.persistent }
      if (!store.persistent && store.reason) out.reason = store.reason
      const free = await storageFree(); if (Number.isFinite(free)) out.browserFreeBytes = free
      return out
    } catch (_) { return base }
  }

  async function loadBytes (id) {
    const rec = await store.tx([STORE_BLOBS], 'readonly', (s) => s.blobs.get(String(id)))
    return rec || null
  }

  function touch (key, v) { lru.delete(key); lru.set(key, v) }
  function evict (keep) {
    for (const [k, v] of [...lru]) {
      if (cacheBytes <= lim.cache) break
      if (k === keep) continue
      lru.delete(k); cacheBytes -= v.bytes
    }
  }
  /** Synchronous peek into the decoded cache (used by playClip to schedule without waiting). */
  function peekBuffer (ctx, id) { const k = `${ctx ? cid(ctx) : 0}|${id}`; const v = lru.get(k); if (v) { touch(k, v); return v.buffer } return null }

  async function getBuffer (ctx, id) {
    try {
      id = String(id)
      if (!ctx || typeof ctx.decodeAudioData !== 'function') return null
      const key = `${cid(ctx)}|${id}`
      const hit = lru.get(key); if (hit) { touch(key, hit); return hit.buffer }
      if (pending.has(key)) return await pending.get(key)
      const p = (async () => {
        const meta = await loadMeta(); if (!meta.has(id)) return null
        const rec = await loadBytes(id); if (!rec || !rec.bytes) return null
        const buffer = await decodeOn(ctx, rec.bytes.slice(0))
        if (!meta.has(id)) return buffer   // removed while decoding: still return it to this caller, do not cache
        const bytes = (buffer.length || 0) * (buffer.numberOfChannels || 1) * 4
        lru.set(key, { buffer, bytes }); cacheBytes += bytes; evict(key)
        return buffer
      })().catch(() => null).finally(() => { pending.delete(key) })
      pending.set(key, p)
      return await p
    } catch (_) { return null }
  }

  async function getPeaks (id, n = DEFAULT_PEAKS) {
    try {
      id = String(id)
      const count = Math.max(1, Math.min(MAX_PEAKS, Math.floor(Number(n)) || DEFAULT_PEAKS))
      const key = `${id}|${count}`
      if (peaksCache.has(key)) return peaksCache.get(key)
      const meta = await loadMeta(); if (!meta.has(id)) return null
      const rec = await loadBytes(id); if (!rec) return null
      let out = null
      if (count === DEFAULT_PEAKS && rec.peaks && rec.peaks.length === count * 2) out = rec.peaks instanceof Float32Array ? rec.peaks : new Float32Array(rec.peaks)
      else {
        const buf = await decodeBytes(rec.bytes)
        out = peaksFromBuffer(buf, count)
      }
      if (meta.has(id)) peaksCache.set(key, out)
      return out
    } catch (_) { return null }
  }

  /** Decode a list of assets on ctx ahead of time so playClip can schedule synchronously. Resolves {loaded, missing}. */
  async function preload (ctx, ids) {
    let loaded = 0, missing = 0
    for (const id of ids || []) { const b = await getBuffer(ctx, id); if (b) loaded++; else missing++ }
    return { loaded, missing }
  }

  function playClip (ctx, id, o = {}) {
    const st = { stopped: false, src: null, gain: null, ended: false, stopAt: null }
    let resolveDone
    const done = new Promise(r => { resolveDone = r })
    const finish = (reason) => {
      if (st.ended) return; st.ended = true
      try { st.src && st.src.disconnect() } catch (_) { /* ignore */ }
      try { st.gain && st.gain.disconnect() } catch (_) { /* ignore */ }
      st.src = null; st.gain = null
      resolveDone({ ended: reason === 'ended', reason })
    }
    const handle = {
      done,
      stop (at) {
        if (st.ended) return
        st.stopped = true
        if (!st.src) { if (at === undefined || at === null || !(Number(at) > (ctx?.currentTime || 0))) finish('stopped'); else st.stopAt = Number(at); return }
        const now = Number(ctx.currentTime) || 0
        const t = Math.max(now, Number.isFinite(Number(at)) ? Number(at) : now)
        try {
          st.gain.gain.cancelScheduledValues?.(t)
          st.gain.gain.setTargetAtTime?.(0, t, 0.004)
        } catch (_) { /* ignore */ }
        try { st.src.stop(t + 0.03) } catch (_) { finish('stopped') }
        if (t <= now) { /* onended will fire; make sure done settles even if it does not */ setTimeout(() => finish('stopped'), 250) }
      },
    }
    const schedule = (buffer) => {
      if (st.ended) return
      if (!buffer) { finish('missing'); return }
      if (st.stopped && st.stopAt == null) { finish('stopped'); return }
      try {
        const total = Number(buffer.duration) || (buffer.length / (buffer.sampleRate || 44100)) || 0
        const now = Number(ctx.currentTime) || 0
        const rate = clampNum(o.rate, 0.1, 4, 1)
        const offset = clampNum(o.offset, 0, Math.max(0, total - 0.001), 0)
        const avail = Math.max(0.001, total - offset)
        const dur = o.duration === undefined || o.duration === null ? avail : clampNum(o.duration, 0.001, avail, avail)
        const outLen = dur / rate
        let when = Number(o.when); if (!Number.isFinite(when)) when = now
        let startOffset = offset, playDur = dur
        if (when < now) {   // late: skip into the clip instead of playing it all from the start
          const skip = (now - when) * rate
          if (skip >= dur) { finish('ended'); return }
          startOffset = offset + skip; playDur = dur - skip; when = now
        }
        const gainV = clampNum(o.gain, 0, 4, 1)
        const fi = Math.min(clampNum(o.fadeIn, 0, 600, 0), outLen)
        const fo = Math.min(clampNum(o.fadeOut, 0, 600, 0), Math.max(0, outLen - fi))
        const src = ctx.createBufferSource(); const g = ctx.createGain()
        src.buffer = buffer
        try { src.playbackRate.value = rate } catch (_) { /* ignore */ }
        // envelope in OUTPUT seconds from the clip's own start (a late start is inside the fade-in already)
        const clipStart = when - (startOffset - offset) / rate
        const pg = g.gain
        const fadeInEnd = clipStart + fi
        if (fi > 0 && when < fadeInEnd) { const v0 = gainV * Math.max(0, (when - clipStart) / fi); pg.setValueAtTime(v0, when); pg.linearRampToValueAtTime(gainV, fadeInEnd) } else pg.setValueAtTime(gainV, when)
        const endT = clipStart + outLen
        if (fo > 0) {
          if (when >= endT - fo) pg.setValueAtTime(gainV * Math.max(0, (endT - when) / fo), when)
          else pg.setValueAtTime(gainV, endT - fo)
          pg.linearRampToValueAtTime(0, endT)
        }
        src.connect(g); g.connect(o.dest || ctx.destination)
        st.src = src; st.gain = g
        src.onended = () => finish(st.stopped ? 'stopped' : 'ended')
        src.start(when, startOffset, playDur)
        if (st.stopped && st.stopAt != null) handle.stop(st.stopAt)
        else if (st.stopped) handle.stop()
      } catch (_) { finish('error') }
    }
    try {
      const cached = peekBuffer(ctx, String(id))
      if (cached) schedule(cached)
      else getBuffer(ctx, id).then(schedule, () => finish('error'))
    } catch (_) { finish('error') }
    return handle
  }

  return {
    importFile, list, getMeta, remove, rename, usage, getBuffer, getPeaks, playClip, preload, peekBuffer,
    get persistent () { return store.persistent },
    get limits () { return { ...lim } },
    /** Await the storage being opened (decides persistent true / false). */
    async ready () { await store.open(); return store.persistent },
    _store: store,
    /** Tests: drop in-memory caches and re-read the store (simulates a reload when the IndexedDB is kept). */
    _reload () { metaCache = null; peaksCache.clear(); lru.clear(); pending.clear(); cacheBytes = 0; store.reset() },
    _cacheBytes () { return cacheBytes },
  }
}

export const AudioAssets = createAudioAssets()
export default AudioAssets
