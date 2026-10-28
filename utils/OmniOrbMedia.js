/**
 * utils/OmniOrbMedia.js (V234) — one picture or video per hand, kept in the browser (IndexedDB), for the hand's orb background.
 * Settings keep only { orbMediaKind, orbMediaName }; the bytes live here. Falls back to memory when IndexedDB is not available.
 *   saveMedia(hand, file) -> { kind, name, size }     loadMedia(hand) -> { kind, name, blob } | null     removeMedia(hand)
 * Limits: images 8 MB, videos 40 MB; types image/png|jpeg|webp|gif and video/mp4|webm|ogg.
 */
export const LIMITS = { image: 8 * 1024 * 1024, video: 40 * 1024 * 1024 }
export const TYPES = { image: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'], video: ['video/mp4', 'video/webm', 'video/ogg'] }
const DB = 'omni-orb-media', STORE = 'media'
const mem = new Map()
let dbp = null
const open = () => dbp ??= new Promise((res) => {
  try { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(STORE); r.onsuccess = () => res(r.result); r.onerror = () => res(null); r.onblocked = () => res(null) } catch (_) { res(null) }
})
const tx = async (mode, fn) => { const db = await open(); if (!db) return undefined; return new Promise((res) => { try { const t = db.transaction(STORE, mode), r = fn(t.objectStore(STORE)); t.oncomplete = () => res(r?.result); t.onerror = () => res(undefined) } catch (_) { res(undefined) } }) }

export function kindOf (type) { return TYPES.image.includes(type) ? 'image' : TYPES.video.includes(type) ? 'video' : null }
export function check (file) {
  const kind = kindOf(file?.type); if (!kind) throw new Error('pictures: png, jpeg, webp, gif · videos: mp4, webm, ogg')
  if (file.size > LIMITS[kind]) throw new Error(`that ${kind} is ${(file.size / 1048576).toFixed(1)} MB; the limit is ${LIMITS[kind] / 1048576} MB`)
  return kind
}
export async function saveMedia (hand, file) {
  const kind = check(file), rec = { kind, name: String(file.name ?? kind).slice(0, 48), blob: file, size: file.size }
  mem.set(hand, rec); await tx('readwrite', s => s.put(rec, hand)); return { kind, name: rec.name, size: rec.size }
}
export async function loadMedia (hand) {
  if (mem.has(hand)) return mem.get(hand)
  const r = await tx('readonly', s => s.get(hand)); if (r) mem.set(hand, r); return r ?? null
}
export async function removeMedia (hand) { mem.delete(hand); await tx('readwrite', s => s.delete(hand)) }
export function _resetMemory () { mem.clear() }
