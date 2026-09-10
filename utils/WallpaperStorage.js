/**
 * utils/WallpaperStorage.js — ⟐mniReality Wallpaper Storage
 *
 * IndexedDB-backed storage for user-uploaded images, used by more than
 * one "wallpaper browser" in the app now (WallpaperSphere's 20 slots,
 * OmniBrowserSpace's 5 cube-texture slots). Chosen over localStorage
 * specifically: localStorage has a hard ~5-10MB ceiling shared with
 * everything else this app already stores there, and even a handful
 * of real photos as base64 text could blow past that fast. IndexedDB
 * is built for exactly this — larger binary blobs that need to
 * survive reload.
 *
 * Namespaced so independent wallpaper browsers don't collide: each
 * namespace gets its own IndexedDB database, so "slot 1" in one
 * browser is a completely different record from "slot 1" in another.
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

const DB_VERSION = 1
const STORE_NAME = 'slots'

/**
 * @param {string} namespace — unique per independent wallpaper browser,
 *   e.g. 'sphere' (WallpaperSphere's 20 slots) or 'browserspace-cube'
 *   (OmniBrowserSpace's 5 slots). Becomes part of the IndexedDB
 *   database name so namespaces never share storage.
 * @param {number} [maxSlots=20]
 */
export function createWallpaperStore (namespace, maxSlots = 20) {
  const dbName = `omni-wallpapers-${namespace}`

  function openDB () {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(dbName, DB_VERSION)
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

  /** @param {number} slot @param {Blob} blob @param {string} [name] original filename, for display */
  async function saveWallpaper (slot, blob, name = '') {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).put({ slot, blob, name, savedAt: Date.now() })
      tx.oncomplete = () => { db.close(); resolve() }
      tx.onerror = () => { db.close(); reject(tx.error) }
    })
  }

  /** @returns {Promise<{slot:number, blob:Blob, name:string, savedAt:number}|null>} */
  async function loadWallpaper (slot) {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const req = tx.objectStore(STORE_NAME).get(slot)
      req.onsuccess = () => { db.close(); resolve(req.result ?? null) }
      req.onerror = () => { db.close(); reject(req.error) }
    })
  }

  /** @returns {Promise<Array<{slot:number, name:string, savedAt:number}>>} metadata only, no blobs */
  async function listWallpapers () {
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

  async function deleteWallpaper (slot) {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).delete(slot)
      tx.oncomplete = () => { db.close(); resolve() }
      tx.onerror = () => { db.close(); reject(tx.error) }
    })
  }

  return { saveWallpaper, loadWallpaper, listWallpapers, deleteWallpaper, MAX_SLOTS: maxSlots }
}

// Default namespace — preserves the original flat-function API so
// ui/WallpaperSettingsPanel.js (WallpaperSphere's 20-slot browser)
// doesn't need to change at all.
const defaultStore = createWallpaperStore('sphere', 20)
export const MAX_SLOTS = defaultStore.MAX_SLOTS
export const saveWallpaper = defaultStore.saveWallpaper
export const loadWallpaper = defaultStore.loadWallpaper
export const listWallpapers = defaultStore.listWallpapers
export const deleteWallpaper = defaultStore.deleteWallpaper

/**
 * Every known IndexedDB namespace created via createWallpaperStore,
 * across the whole app. Unlike localStorage (which the export/import
 * system can just loop over generically), IndexedDB has no reliable,
 * universal "list every database" call — so this is a small, explicit
 * registry instead. Whoever adds a new createWallpaperStore(...) call
 * anywhere in the app should add its namespace here too, or that
 * namespace's assets will silently be skipped by export/import.
 */
export const KNOWN_NAMESPACES = [
  'sphere',                 // WallpaperSphere — utils/WallpaperStorage.js default store
  'browserspace-cube',      // OmniBrowserSpace's cube face texture
  'omnimixer-audio',        // OmniMixerPanel's shared audio library
  'omnimixer-video',        // OmniMixerPanel's video slots
  'omnimixer-skin',         // OmniMixerPanel's background skin image
  'omniexpression-video',   // OmniExpressionVideoPlayer's main video
  'omniexpression-circles', // OmniExpressionVideoPlayer's backing circle images
]
