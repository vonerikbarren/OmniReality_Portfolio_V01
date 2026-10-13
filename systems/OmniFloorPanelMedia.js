/**
 * systems/OmniFloorPanelMedia.js — the texture side of the floor panel faces (V191): pictures, GIFs and videos as THREE textures, with a cost cap.
 *
 *   image   a THREE.Texture from an <img> (decoded once, kept while a panel uses it)
 *   gif     an <img> (kept in the page so the browser animates it) drawn onto a small canvas (<= 256 px) at <= 12 frames a second -> THREE.CanvasTexture.
 *           ImageDecoder is not used: the <img> path works in every browser the app supports and costs one drawImage per tick.
 *   video   a muted, looping, playsInline <video> -> THREE.VideoTexture (autoplay is allowed because it is muted)
 *
 * COST RULES
 *   - lazy: nothing is read from IndexedDB or the network until a panel that uses the media is on screen (acquire() is called by OmniFloorPanels then);
 *   - one entry per distinct media reference however many panels use it (refcounted by user id);
 *   - at most MAX_PLAYING (4) animated entries play at once: the nearest on-screen ones (pickPlaying); the others are paused (video) or frozen (gif);
 *   - an animated entry nobody has looked at for IDLE_UNLOAD_S seconds is unloaded completely and reloads when it is needed again;
 *   - a hidden tab pauses everything; release() of the last user, unloadAll() and destroy() pause, detach, revoke object URLs and dispose textures.
 *
 * The browser objects are created through `env` so tests can run it without a browser: env.makeImage(), env.makeVideo(), env.makeCanvas(), env.loadBlob(slot).
 * USER-facing module: it must never import a Dev* module.
 */

import * as THREE from 'three'
import { mediaStore, refKey, isAnimated, pickPlaying, MAX_PLAYING } from '../utils/FloorPanelMedia.js'

export const IDLE_UNLOAD_S = 15
export const GIF_FPS = 12
export const GIF_MAX_PX = 256

const defaultEnv = () => ({
  makeImage: () => new Image(),
  makeVideo: () => document.createElement('video'),
  makeCanvas: () => document.createElement('canvas'),
  loadBlob: async (slot) => (await mediaStore.loadWallpaper(slot))?.blob ?? null,
  createObjectURL: (b) => URL.createObjectURL(b),
  revokeObjectURL: (u) => URL.revokeObjectURL(u),
})

export default class FloorPanelMedia {
  constructor (env = null) {
    this.env = { ...defaultEnv(), ...(env ?? {}) }
    this.entries = new Map()   // key -> entry
    this._visHandler = null
    this._hidden = false
    this.onTextureReady = null   // (key) => void, so the faces can pick the texture up
  }

  attachVisibility () {
    if (this._visHandler || typeof document === 'undefined') return
    this._visHandler = () => { this._hidden = document.visibilityState === 'hidden'; if (this._hidden) this._pauseAll() }
    document.addEventListener('visibilitychange', this._visHandler)
  }

  /** The texture for a reference, or null while it is loading / failed. Starts the load on first use. `userId` is refcounted. */
  acquire (ref, userId) {
    const key = refKey(ref)
    if (!key) return null
    let e = this.entries.get(key)
    if (!e) {
      e = { key, ref, state: 'idle', texture: null, el: null, canvas: null, ctx2d: null, url: null, users: new Set(), playing: false, wantPlay: false, visible: false, dist: Infinity, idle: 0, token: 0, lastDraw: 0, error: '' }
      this.entries.set(key, e)
    }
    e.users.add(userId)
    e.idle = 0
    if (e.state === 'idle') this._load(e)
    return e.state === 'ready' ? e.texture : null
  }

  /** The state of a reference: 'idle' | 'loading' | 'ready' | 'error' | 'none'. */
  stateOf (ref) { return this.entries.get(refKey(ref))?.state ?? 'none' }
  textureOf (ref) { const e = this.entries.get(refKey(ref)); return e?.state === 'ready' ? e.texture : null }
  errorOf (ref) { return this.entries.get(refKey(ref))?.error ?? '' }

  release (ref, userId) {
    const key = refKey(ref)
    const e = this.entries.get(key)
    if (!e) return
    e.users.delete(userId)
    if (!e.users.size) this._dispose(e)
  }

  /** Release every reference held by a node: its users are 'nodeId:x,z' (one per textured panel) or exactly `userId`. */
  releaseUser (userId) {
    const pre = userId + ':'
    for (const e of [...this.entries.values()]) {
      let hit = false
      for (const u of [...e.users]) if (u === userId || u.startsWith(pre)) { e.users.delete(u); hit = true }
      if (hit && !e.users.size) this._dispose(e)
    }
  }

  // ── Loading ─────────────────────────────────────────────────────────────────

  async _load (e) {
    const token = ++e.token
    e.state = 'loading'; e.error = ''
    try {
      let src
      if (e.ref.slot) {
        const blob = await this.env.loadBlob(e.ref.slot)
        if (token !== e.token || !this.entries.has(e.key)) return
        if (!blob) throw new Error('The file is not in this browser any more.')
        src = e.url = this.env.createObjectURL(blob)
      } else src = e.ref.url
      if (e.ref.kind === 'video') await this._loadVideo(e, src, token)
      else await this._loadImage(e, src, token)
      if (token !== e.token || !this.entries.has(e.key)) return
      e.state = 'ready'
      this.onTextureReady?.(e.key)
    } catch (err) {
      if (token !== e.token) return
      this._teardownEl(e)
      e.state = 'error'; e.error = String(err?.message ?? err).slice(0, 120)
      this.onTextureReady?.(e.key)
    }
  }

  _loadImage (e, src, token) {
    return new Promise((resolve, reject) => {
      const img = this.env.makeImage()
      if (!e.ref.slot) img.crossOrigin = 'anonymous'
      img.onload = () => {
        if (token !== e.token) return resolve()
        e.el = img
        if (e.ref.kind === 'gif') {
          const c = this.env.makeCanvas()
          const w = img.naturalWidth || img.width || 64; const h = img.naturalHeight || img.height || 64
          const k = Math.min(1, GIF_MAX_PX / Math.max(w, h))
          c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k))
          e.canvas = c; e.ctx2d = c.getContext('2d')
          try { img.style.cssText = 'position:fixed;left:-9999px;top:0;width:64px;height:64px;pointer-events:none;opacity:0.01'; document.body.appendChild(img) } catch (_) { /* detached: first frame only */ }
          this._drawGif(e)
          e.texture = new THREE.CanvasTexture(c)
        } else {
          e.texture = new THREE.Texture(img)
        }
        e.texture.colorSpace = THREE.SRGBColorSpace
        e.texture.needsUpdate = true
        resolve()
      }
      img.onerror = () => reject(new Error(e.ref.slot ? 'The picture could not be decoded.' : 'The link could not be loaded (it may block other sites).'))
      img.src = src
    })
  }

  _loadVideo (e, src, token) {
    return new Promise((resolve, reject) => {
      const v = this.env.makeVideo()
      v.muted = true; v.defaultMuted = true; v.loop = true; v.playsInline = true; v.autoplay = false; v.preload = 'auto'
      v.setAttribute?.('muted', ''); v.setAttribute?.('playsinline', '')
      if (!e.ref.slot) v.crossOrigin = 'anonymous'
      let done = false
      const ok = () => {
        if (done) return; done = true
        if (token !== e.token) { return resolve() }
        e.el = v
        e.texture = new THREE.VideoTexture(v)
        e.texture.colorSpace = THREE.SRGBColorSpace
        resolve()
      }
      v.onloadeddata = ok
      v.oncanplay = ok
      v.onerror = () => { if (!done) { done = true; reject(new Error(e.ref.slot ? 'The video could not be decoded.' : 'The video link could not be loaded.')) } }
      v.src = src
      try { v.load?.() } catch (_) { /* jsdom */ }
    })
  }

  _drawGif (e) {
    try { e.ctx2d?.drawImage(e.el, 0, 0, e.canvas.width, e.canvas.height); if (e.texture) e.texture.needsUpdate = true } catch (_) { /* image not ready */ }
  }

  // ── Per-frame cost control ──────────────────────────────────────────────────

  /**
   * Called a few times a second by OmniFloorPanels: `vis` = Map(key -> { visible, dist }) for the keys panels reported this pass.
   * Decides which animated entries play and unloads the ones nobody has looked at for IDLE_UNLOAD_S seconds.
   */
  setVisibility (vis, dt = 0.25) {
    const list = []
    for (const e of this.entries.values()) {
      const v = vis.get(e.key)
      e.visible = !!v?.visible && !this._hidden
      e.dist = v?.dist ?? Infinity
      if (isAnimated(e.ref)) list.push({ key: e.key, visible: e.visible && e.state === 'ready', dist: e.dist })
      if (e.visible) e.idle = 0; else e.idle += dt
    }
    const play = pickPlaying(list, MAX_PLAYING)
    for (const e of [...this.entries.values()]) {
      if (!isAnimated(e.ref)) continue
      const want = play.has(e.key)
      if (want !== e.playing) this._setPlaying(e, want)
      if (e.state === 'ready' && !e.visible && e.idle > IDLE_UNLOAD_S) this._unload(e)
    }
  }

  playingKeys () { return [...this.entries.values()].filter(e => e.playing).map(e => e.key) }

  _setPlaying (e, on) {
    e.playing = on
    if (e.ref.kind === 'video' && e.el) {
      try {
        if (on) { const p = e.el.play?.(); p?.catch?.(() => { e.playing = false }) } else e.el.pause?.()
      } catch (_) { e.playing = false }
    }
  }

  /** Called every frame (cheap): redraws the playing GIFs at <= GIF_FPS. */
  tick (nowMs) {
    for (const e of this.entries.values()) {
      if (e.playing && e.ref.kind === 'gif' && e.state === 'ready' && nowMs - e.lastDraw >= 1000 / GIF_FPS) { e.lastDraw = nowMs; this._drawGif(e) }
    }
  }

  _pauseAll () { for (const e of this.entries.values()) if (e.playing) this._setPlaying(e, false) }

  // ── Teardown ────────────────────────────────────────────────────────────────

  _teardownEl (e) {
    try {
      if (e.ref.kind === 'video' && e.el) { e.el.pause?.(); e.el.removeAttribute?.('src'); e.el.load?.() }
      if (e.ref.kind === 'gif' && e.el) { e.el.remove?.() }
      if (e.el) { e.el.onload = e.el.onerror = e.el.onloadeddata = e.el.oncanplay = null }
    } catch (_) { /* best effort */ }
    if (e.url) { try { this.env.revokeObjectURL(e.url) } catch (_) {} e.url = null }
    e.el = null; e.canvas = null; e.ctx2d = null
  }

  /** Free the heavy parts but keep the entry (its users stay); the next acquire() loads again. */
  _unload (e) {
    e.token++
    this._setPlaying(e, false)
    e.texture?.dispose(); e.texture = null
    this._teardownEl(e)
    e.state = 'idle'
    this.onTextureReady?.(e.key)
  }

  _dispose (e) {
    e.token++
    e.playing = false
    e.texture?.dispose(); e.texture = null
    this._teardownEl(e)
    this.entries.delete(e.key)
  }

  unloadAll () { for (const e of [...this.entries.values()]) this._dispose(e) }

  stats () {
    const all = [...this.entries.values()]
    return { entries: all.length, ready: all.filter(e => e.state === 'ready').length, loading: all.filter(e => e.state === 'loading').length, errors: all.filter(e => e.state === 'error').length, playing: all.filter(e => e.playing).length, animated: all.filter(e => isAnimated(e.ref)).length }
  }

  destroy () {
    if (this._visHandler) { document.removeEventListener('visibilitychange', this._visHandler); this._visHandler = null }
    this.unloadAll()
  }
}
