/**
 * systems/OmniStoredVideo.js (V277) — the runtime of the StoredVideoNode: a flat plane that plays ONE library video with a chroma key (a green backdrop disappears).
 *   The node holds data.storedVideo (utils/OmniStoredVideoModel.js). The video bytes stay in the document library (utils/OmniDocAssets.js); the node only names the id.
 *   At most MAX_PLAYING videos run at once (the rest keep their placeholder) and a node far from the camera pauses, so many nodes stay cheap.
 *   SERVICES.storedvideo: create(opts) get(id) set(id, patch) setKey(id, patch) setSource(id, sourceId|null) attachFile(id, file) play(id) pause(id) isPlaying(id) list() listVideos()
 *   Events out: omni:stored-video-changed { nodeId, reason }.   In: omni:stored-video-node-create { ...opts } (answer in detail.out).
 */
import * as THREE from 'three'
import * as M from '../utils/OmniStoredVideoModel.js'
import { KIND_STORED_VIDEO, GEO_STORED_VIDEO, SERVICES } from '../utils/OmniExtraKinds.js'
import { applyStoredVideoLook, setStoredVideoElement } from '../utils/OmniStoredVideoNodeMesh.js'

const PIN_DISTANCE = 8, PERSIST_MS = 300, MAX_PLAYING = 3, MAX_BYTES = 40 * 1024 * 1024, FAR = 160
const send = (n, d) => { try { window.dispatchEvent(new CustomEvent(n, { detail: d })) } catch (_) { /* no window */ } }
const newId = () => 'omni_' + Math.random().toString(36).slice(2, 8)

export default class OmniStoredVideo {
  constructor (context, omniNode = null) { this.ctx = context; this.omniNode = omniNode ?? context?.omniNode ?? null; this._inited = false; this._bound = []; this._persist = new Map(); this._live = new Map(); this._assets = null }
  init () {
    if (this._inited) return; this._inited = true
    const on = (n, fn) => { const h = (e) => fn(e.detail ?? {}, e); window.addEventListener(n, h); this._bound.push([n, h]) }
    on('omni:stored-video-node-create', (d, e) => { const out = this.create(d); if (e.detail && typeof e.detail === 'object') e.detail.out = out })
    on('omni:node-created', (d) => this._fixNode(d.node)); on('omni:extra-mesh-released', (d) => { if (d.kind === KIND_STORED_VIDEO) this._drop(d.id) })
    this._syncAll(); SERVICES.storedvideo = this
  }
  destroy () { this._persist.forEach(t => clearTimeout(t)); this._persist.clear(); for (const id of [...this._live.keys()]) this._drop(id); for (const [n, h] of this._bound) window.removeEventListener(n, h); this._bound = []; if (SERVICES.storedvideo === this) SERVICES.storedvideo = null; this._inited = false }
  onResize () {}

  // ── store ──
  _data (id) { return this.omniNode?.getNodeData?.(id) ?? null }
  isNode (id) { return this._data(id)?.nodeKind === KIND_STORED_VIDEO }
  list () { try { return (this.omniNode?.getAllNodes?.() ?? []).filter(d => d?.nodeKind === KIND_STORED_VIDEO).map(d => d.id) } catch (_) { return [] } }
  get (id) { const d = this._data(id); if (!d || d.nodeKind !== KIND_STORED_VIDEO) return null; const s = M.sanitizeStoredVideo(d.storedVideo); d.storedVideo = s; return s }
  _need (id) { const s = this.get(id); if (!s) throw new Error('That is not a stored video node.'); return s }
  set (id, patch, reason = 'edit') {
    const cur = this.get(id), d = this._data(id); if (!cur || !d) return { ok: false, error: 'That is not a stored video node.' }
    const p = patch && typeof patch === 'object' ? patch : {}
    const next = M.sanitizeStoredVideo({ ...cur, ...p, key: { ...cur.key, ...(p.key && typeof p.key === 'object' ? p.key : {}) } })
    d.storedVideo = next
    this._refresh(id); if (reason === 'source' || next.loop !== cur.loop || next.muted !== cur.muted || next.volume !== cur.volume) this._syncPlayer(id)
    send('omni:stored-video-changed', { nodeId: id, reason }); this._persistSoon(id); return { ok: true, storedVideo: next }
  }
  setKey (id, patch) { return this.set(id, { key: patch }, 'key') }
  setSource (id, sourceId) { return this.set(id, { source: sourceId ? { type: 'video', id: String(sourceId) } : null }, 'source') }
  _persistSoon (id) { clearTimeout(this._persist.get(id)); this._persist.set(id, setTimeout(() => this.flush(id), PERSIST_MS)) }
  flush (id) { if (id) { clearTimeout(this._persist.get(id)); this._persist.delete(id) } const d = id ? this._data(id) : null; if (!d) return false; send('omni:force-save', {}); send('omni:node-updated', { id, data: d }); return true }
  _fixNode (d) { if (!d || d.nodeKind !== KIND_STORED_VIDEO) return; d.storedVideo = M.sanitizeStoredVideo(d.storedVideo); this._refresh(d.id); if (d.storedVideo.source && d.storedVideo.autoplay) this._syncPlayer(d.id) }
  _syncAll () { try { for (const d of this.omniNode?.getAllNodes?.() ?? []) this._fixNode(d) } catch (_) { /* none yet */ } }
  _refresh (id) { const mesh = this.omniNode?.getMeshById?.(id); const s = this.get(id); if (mesh && s) applyStoredVideoLook(mesh, s) }

  // ── the library ──
  async _lib () { if (!this._assets) { try { const m = await import('../utils/OmniDocAssets.js'); this._assets = m.default ?? m.DocAssets } catch (_) { /* none */ } } return this._assets }
  /** [{id, name, size}] — the videos in the document library */
  async listVideos () { const a = await this._lib(); const l = await Promise.resolve(a?.list?.() ?? []).catch(() => []); return (Array.isArray(l) ? l : []).filter(x => x?.type === 'video').map(x => ({ id: String(x.id), name: String(x.name || x.id), size: Number(x.size) || 0 })) }
  /** Put a file in the library and on this node. */
  async attachFile (id, file) {
    try {
      this._need(id); const a = await this._lib(); const r = await a.importFile(file); if (!r.ok) return r
      if (r.meta?.type !== 'video') return { ok: false, error: { code: 'not-video', message: 'That file is not a video.' } }
      this.setSource(id, r.id); return r
    } catch (err) { return { ok: false, error: { code: 'storage', message: String(err?.message ?? err) } } }
  }

  // ── playing ──
  isPlaying (id) { const r = this._live.get(id); return !!r && !r.video.paused }
  playing () { return [...this._live.keys()].filter(id => this.isPlaying(id)) }
  async _syncPlayer (id) {
    const s = this.get(id), mesh = this.omniNode?.getMeshById?.(id); if (!s || !mesh) return { ok: false, error: 'That is not a stored video node.' }
    this._drop(id, false)
    if (!s.source) { setStoredVideoElement(mesh, null); this._refresh(id); return { ok: true, playing: false } }
    if (typeof document === 'undefined') return { ok: false, error: 'No video player here.' }
    const a = await this._lib(); const meta = await Promise.resolve(a?.getMeta?.(s.source.id)).catch(() => null)
    if (!meta) return { ok: false, error: 'The video is missing from the library.' }
    if ((meta.size || 0) > MAX_BYTES) return { ok: false, error: 'That video is over 40 MB.' }
    const bytes = await a.getBytes(s.source.id); if (!bytes) return { ok: false, error: 'The video is missing from the library.' }
    if (!this.isNode(id) || this.get(id)?.source?.id !== s.source.id) return { ok: false, error: 'The node changed.' }
    const url = URL.createObjectURL(new Blob([bytes], { type: meta.mime || 'video/mp4' }))
    const v = document.createElement('video'); v.playsInline = true; v.preload = 'auto'; v.loop = s.loop; v.muted = s.muted; v.volume = s.volume; v.src = url; v.crossOrigin = 'anonymous'
    this._live.set(id, { video: v, url })
    try { await new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('timeout')), 15000); v.onloadedmetadata = () => { clearTimeout(t); res() }; v.onerror = () => { clearTimeout(t); rej(new Error('bad video')) } }) } catch (err) { this._drop(id); return { ok: false, error: 'The video would not load: ' + String(err?.message ?? err) } }
    setStoredVideoElement(mesh, v); this._refresh(id)
    if (s.autoplay) return this.play(id)
    return { ok: true, playing: false }
  }
  async play (id) {
    let r = this._live.get(id); if (!r) { const o = await this._syncPlayer(id); if (!o.ok) return o; r = this._live.get(id); if (!r) return { ok: false, error: 'There is no video on this node.' } }
    const others = this.playing().filter(x => x !== id); while (others.length >= MAX_PLAYING) this.pause(others.shift())
    try { await r.video.play(); return { ok: true, playing: true } } catch (e) { return { ok: false, error: 'The browser would not play it: ' + String(e?.message ?? e).slice(0, 80) } }
  }
  pause (id) { const r = this._live.get(id); if (r) { try { r.video.pause() } catch (_) { /* gone */ } } return { ok: true, playing: false } }
  _drop (id, clearMesh = true) {
    const r = this._live.get(id); if (!r) return; this._live.delete(id)
    try { r.video.pause(); r.video.removeAttribute('src'); r.video.load() } catch (_) { /* gone */ } try { URL.revokeObjectURL(r.url) } catch (_) { /* gone */ }
    if (clearMesh) { const m = this.omniNode?.getMeshById?.(id); if (m) setStoredVideoElement(m, null) }
  }
  /** a node far from the camera pauses; coming back resumes (only if it was set to autoplay) */
  update () {
    const t = (typeof performance !== 'undefined' ? performance.now() : Date.now()); if (t < (this._scanAt ?? 0)) return; this._scanAt = t + 500
    const cam = this.ctx?.camera; if (!cam) return
    for (const [id, r] of this._live) {
      const m = this.omniNode?.getMeshById?.(id); if (!m) { this._drop(id); continue }
      const far = m.position.distanceTo(cam.position) > FAR
      if (far && !r.video.paused) { r.farPaused = true; r.video.pause() } else if (!far && r.farPaused) { r.farPaused = false; this.play(id) }
    }
  }

  // ── create ──
  _positionFor (o) {
    const p = o.position; if (Array.isArray(p) && p.length >= 3 && p.slice(0, 3).every(Number.isFinite)) return [p[0], p[1], p[2]]
    const cam = this.ctx.camera; const dir = new THREE.Vector3(); cam.getWorldDirection(dir); const q = cam.position.clone().addScaledVector(dir, PIN_DISTANCE); return [q.x, q.y, q.z]
  }
  create (opts = {}) {
    try {
      const o = opts && typeof opts === 'object' ? opts : {}
      const sv = M.sanitizeStoredVideo({ source: o.source ?? (o.videoId ? { id: o.videoId } : null), key: o.key, width: o.width, loop: o.loop, muted: o.muted, volume: o.volume, autoplay: o.autoplay, flip: o.flip })
      const nodeId = typeof o.id === 'string' && /^[\w-]{1,64}$/.test(o.id) ? o.id : newId()
      if (this._data(nodeId)) return { ok: false, error: 'There is already a node called ' + nodeId }
      send('omni:node-create-request', { nodeKind: KIND_STORED_VIDEO, storedVideo: sv, id: nodeId, label: String(o.label || 'Stored video').slice(0, 40), geometry: GEO_STORED_VIDEO, primitive: 'objective', color: '#9bd0ff', position: this._positionFor(o), rotation: [0, 0, 0], scale: [1, 1, 1], noParent: true, noSelect: o.select !== true })
      if (this.omniNode && !this._data(nodeId)) return { ok: false, error: 'The node could not be created.' }
      return { ok: true, nodeId }
    } catch (err) { return { ok: false, error: String(err?.message ?? err) } }
  }
}
