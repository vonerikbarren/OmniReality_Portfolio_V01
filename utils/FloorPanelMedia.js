/**
 * utils/FloorPanelMedia.js — what may go on the FACE of a floor panel, and where the files live (V191).
 *
 * A panel face can carry a picture (png / jpg / webp), a GIF (animated) or a video (mp4 / webm, muted, looping). The choice is stored on the
 * panel as a small REFERENCE and nothing else:
 *     { kind:'image'|'gif'|'video', slot:<1..MEDIA_SLOTS> }     a file the user uploaded (kept in IndexedDB, utils/WallpaperStorage.js pattern)
 *     { kind:'image'|'gif'|'video', url:'https://...' }          a link (never downloaded into storage; needs CORS to be used as a texture)
 *
 * Files: validateFile(file) checks type and size (images <= 2 MB, gif <= 4 MB, video <= 8 MB). URLs: validateUrl(url, kind?) allows https only,
 * no credentials, <= 500 characters. sanitizeRef(raw) validates a stored reference (hostile localStorage / import).
 *
 * Storage: a NEW IndexedDB database 'omni-wallpapers-floorpanel-media' (createWallpaperStore namespace 'floorpanel-media', integer slots 1..60),
 * listed in KNOWN_NAMESPACES so the Admin export / import carries it. Nothing is read from IndexedDB until a panel that uses the slot is near
 * the camera (systems/OmniFloorPanels.js loads lazily).
 *
 * USER-facing module: it must never import a Dev* module.
 */

import { createWallpaperStore } from './WallpaperStorage.js'

export const MEDIA_SLOTS = 60
export const MEDIA_NAMESPACE = 'floorpanel-media'
export const MB = 1024 * 1024
export const SIZE_CAPS = { image: 2 * MB, gif: 4 * MB, video: 8 * MB }
export const KINDS = ['image', 'gif', 'video']
export const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp']
export const VIDEO_TYPES = ['video/mp4', 'video/webm']
export const ACCEPT = '.png,.jpg,.jpeg,.webp,.gif,.mp4,.webm,image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm'
export const MAX_URL = 500
/** At most this many animated faces (GIF or video) play at the same time. */
export const MAX_PLAYING = 4

export const mediaStore = createWallpaperStore(MEDIA_NAMESPACE, MEDIA_SLOTS)

const EXT_KIND = { png: 'image', jpg: 'image', jpeg: 'image', webp: 'image', gif: 'gif', mp4: 'video', webm: 'video' }
const EXT_TYPE = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', mp4: 'video/mp4', webm: 'video/webm' }
const extOf = (name) => { const m = /\.([A-Za-z0-9]{2,5})$/.exec(String(name ?? '').split(/[?#]/)[0]); return m ? m[1].toLowerCase() : '' }

/** 'image' | 'gif' | 'video' | null from a MIME type (preferred) or a file name. */
export function kindOfFile (type, name = '') {
  const t = String(type ?? '').toLowerCase()
  if (t === 'image/gif') return 'gif'
  if (IMAGE_TYPES.includes(t)) return 'image'
  if (VIDEO_TYPES.includes(t)) return 'video'
  if (!t) return EXT_KIND[extOf(name)] ?? null   // some systems report no type for a dropped file
  return null
}

/** { ok:true, kind, type } or { ok:false, error }. `file` needs { size, type, name }. */
export function validateFile (file) {
  if (!file || typeof file !== 'object') return { ok: false, error: 'No file.' }
  const kind = kindOfFile(file.type, file.name)
  if (!kind) return { ok: false, error: 'That file type is not supported. Use png, jpg, webp, gif, mp4 or webm.' }
  const size = Number(file.size)
  if (!Number.isFinite(size) || size <= 0) return { ok: false, error: 'The file is empty.' }
  if (size > SIZE_CAPS[kind]) return { ok: false, error: `Too large: a ${kind} may be at most ${SIZE_CAPS[kind] / MB} MB (this one is ${(size / MB).toFixed(1)} MB).` }
  return { ok: true, kind, type: file.type || EXT_TYPE[extOf(file.name)] || '' }
}

/** { ok:true, url, kind } or { ok:false, error }. `kind` (optional) is the user's choice; otherwise it is guessed from the extension (default image). */
export function validateUrl (raw, kind = null) {
  const s = String(raw ?? '').trim()
  if (!s) return { ok: false, error: 'Type an https link.' }
  if (s.length > MAX_URL) return { ok: false, error: `The link is too long (max ${MAX_URL} characters).` }
  let u
  try { u = new URL(s) } catch (_) { return { ok: false, error: 'That is not a valid link.' } }
  if (u.protocol !== 'https:') return { ok: false, error: 'Only https links are allowed.' }
  if (u.username || u.password) return { ok: false, error: 'Links with a user name or password are not allowed.' }
  if (!u.hostname || !u.hostname.includes('.')) return { ok: false, error: 'That link has no usable host name.' }
  const k = kind && KINDS.includes(kind) ? kind : (EXT_KIND[extOf(u.pathname)] ?? 'image')
  return { ok: true, url: u.href, kind: k }
}

/** A stored reference -> a clean { kind, slot } | { kind, url }, or null when it is junk. */
export function sanitizeRef (raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const kind = KINDS.includes(raw.kind) ? raw.kind : null
  if (!kind) return null
  if (raw.slot !== undefined && raw.slot !== null) {
    const n = Number(raw.slot)
    return Number.isInteger(n) && n >= 1 && n <= MEDIA_SLOTS ? { kind, slot: n } : null
  }
  if (typeof raw.url === 'string') { const v = validateUrl(raw.url, kind); return v.ok ? { kind, url: v.url } : null }
  return null
}

/** One stable string per reference (cache / refcount key). */
export const refKey = (ref) => (ref ? (ref.slot ? `s${ref.slot}` : `u:${ref.url}`) : '')
export const isAnimated = (ref) => !!ref && (ref.kind === 'gif' || ref.kind === 'video')

/** The lowest free slot of `usedSlots` (an iterable of integers) or 0 when the library is full. */
export function nextFreeSlot (usedSlots, max = MEDIA_SLOTS) {
  const used = new Set(usedSlots)
  for (let i = 1; i <= max; i++) if (!used.has(i)) return i
  return 0
}

/**
 * Pure choice of which animated entries may play now: only those that are on screen, nearest first, at most `cap`.
 * entries: [{ key, visible, dist }]. Returns a Set of keys. Stable for equal distances (by key).
 */
export function pickPlaying (entries, cap = MAX_PLAYING) {
  const vis = entries.filter(e => e && e.visible).sort((a, b) => (a.dist - b.dist) || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
  return new Set(vis.slice(0, Math.max(0, cap)).map(e => e.key))
}

/** Validate then store an uploaded file in the first free slot. Resolves { ok, ref } or { ok:false, error }. */
export async function saveFile (file, store = mediaStore) {
  const v = validateFile(file)
  if (!v.ok) return v
  let list = []
  try { list = await store.listWallpapers() } catch (_) { return { ok: false, error: 'Browser storage (IndexedDB) is not available here.' } }
  const slot = nextFreeSlot(list.map(r => r.slot))
  if (!slot) return { ok: false, error: `The media library is full (${MEDIA_SLOTS} files). Delete one in FloorNodeMakerSettings > Media.` }
  try {
    const blob = file.type ? file : new Blob([file], { type: v.type })
    await store.saveWallpaper(slot, blob, String(file.name ?? '').slice(0, 80))
  } catch (_) { return { ok: false, error: 'Could not save the file in this browser (storage full or blocked).' } }
  return { ok: true, ref: { kind: v.kind, slot } }
}
