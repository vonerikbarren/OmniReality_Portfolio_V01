/**
 * utils/WallpaperStorage.js — ⟐mniReality Wallpaper Storage
 *
 * IndexedDB-backed storage for up to 20 user-uploaded wallpaper
 * images. Chosen over localStorage specifically: localStorage has a
 * hard ~5-10MB ceiling shared with everything else this app already
 * stores there, and 20 real photos as base64 text could blow past
 * that fast. IndexedDB is built for exactly this — larger binary
 * blobs that need to survive reload.
 *
 * Stores raw Blobs (not base64 strings) — no encoding overhead, and
 * Blobs convert to an Object URL for use as a texture source with a
 * single call (URL.createObjectURL).
 *
 * All methods are Promise-based. No module-level state — every call
 * opens its own short-lived connection, since these are infrequent,
 * user-initiated actions (uploading/selecting a wallpaper), not a
 * hot path needing a persistent connection.
 */

const DB_NAME    = 'omni-wallpapers'
const DB_VERSION = 1
const STORE_NAME = 'slots'
export const MAX_SLOTS = 20

function openDB () {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'slot' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/** @param {number} slot 1-20 @param {Blob} blob @param {string} [name] original filename, for display */
export async function saveWallpaper (slot, blob, name = '') {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put({ slot, blob, name, savedAt: Date.now() })
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}

/** @returns {Promise<{slot:number, blob:Blob, name:string, savedAt:number}|null>} */
export async function loadWallpaper (slot) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).get(slot)
    req.onsuccess = () => { db.close(); resolve(req.result ?? null) }
    req.onerror = () => { db.close(); reject(req.error) }
  })
}

/** @returns {Promise<Array<{slot:number, name:string, savedAt:number}>>} metadata only, no blobs — for populating the browser UI without loading every image into memory */
export async function listWallpapers () {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).getAll()
    req.onsuccess = () => {
      db.close()
      resolve((req.result ?? []).map(r => ({ slot: r.slot, name: r.name, savedAt: r.savedAt })))
    }
    req.onerror = () => { db.close(); reject(req.error) }
  })
}

export async function deleteWallpaper (slot) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(slot)
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}
