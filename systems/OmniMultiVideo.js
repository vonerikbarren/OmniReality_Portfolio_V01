/**
 * systems/OmniMultiVideo.js (V286) — the runtime of the MultiVideoNode (the first OmniMetaNode): clips on a timeline, transitions, key coordinates, a text layer.
 *   data.multiVideo (utils/OmniMultiVideoModel.js) is the edit; the video bytes stay in the document library (utils/OmniDocAssets.js). Nothing is exported or rendered to a file: the edit plays live.
 *   One node plays at a time. Only the clips on screen (and the one about to start) have a <video>; the rest cost nothing.
 *   SERVICES.multivideo: create(opts) get(id) set(id, mv) list() play(id) pause(id) stop(id) seek(id, t) state(id) time(id) duration(id) isPlaying(id)
 *     addClip(id, {sourceId?, name?, dur?, ...}) addClipFile(id, file) listVideos()   — editing goes through change(id, fn(mv)->mv) so every change is sanitized and saved
 *   Events in:  omni:multivideo-node-create {opts}   Events out: omni:multivideo-changed {nodeId, reason}, omni:multivideo-state {nodeId, playing, t}
 *   While playing, key coordinates may move the node and / or the camera (orbit controls are paused with omni:orbit-disable); stop() puts the node back where it was.
 */
import * as THREE from 'three'
import * as M from '../utils/OmniMultiVideoModel.js'
import { KIND_MULTI_VIDEO, GEO_MULTI_VIDEO, SERVICES } from '../utils/OmniExtraKinds.js'

const PIN_DISTANCE = 8, PERSIST_MS = 300, MAX_BYTES = 40 * 1024 * 1024, PRELOAD = 1.5, DRIFT = 0.35
const send = (n, d) => { try { window.dispatchEvent(new CustomEvent(n, { detail: d })) } catch (_) { /* no window */ } }
const newId = () => 'omni_' + Math.random().toString(36).slice(2, 8)

export default class OmniMultiVideo {
  constructor (context, omniNode = null) { this.ctx = context; this.omniNode = omniNode ?? context?.omniNode ?? null; this._inited = false; this._bound = []; this._persist = new Map(); this._run = new Map(); this._urls = new Map(); this._assets = null; this._active = null; this._sendAt = 0 }
  init () {
    if (this._inited) return; this._inited = true
    const on = (n, fn) => { const h = (e) => fn(e.detail ?? {}, e); window.addEventListener(n, h); this._bound.push([n, h]) }
    on('omni:multivideo-node-create', (d, e) => { const out = this.create(d); if (e.detail && typeof e.detail === 'object') e.detail.out = out })
    on('omni:node-created', (d) => this._fixNode(d.node)); on('omni:extra-mesh-released', (d) => { if (d.kind === KIND_MULTI_VIDEO) this._forget(d.id) })
    this._syncAll(); SERVICES.multivideo = this
  }
  destroy () { for (const id of [...this._run.keys()]) this.stop(id); this._persist.forEach(t => clearTimeout(t)); this._persist.clear(); for (const [n, h] of this._bound) window.removeEventListener(n, h); this._bound = []; if (SERVICES.multivideo === this) SERVICES.multivideo = null; this._inited = false }
  onResize () {}

  // ── store ──
  _data (id) { return this.omniNode?.getNodeData?.(id) ?? null }
  _mesh (id) { return this.omniNode?.getMeshById?.(id) ?? null }
  isNode (id) { return this._data(id)?.nodeKind === KIND_MULTI_VIDEO }
  list () { try { return (this.omniNode?.getAllNodes?.() ?? []).filter(d => d?.nodeKind === KIND_MULTI_VIDEO).map(d => d.id) } catch (_) { return [] } }
  get (id) { const d = this._data(id); if (!d || d.nodeKind !== KIND_MULTI_VIDEO) return null; const s = M.sanitizeMultiVideo(d.multiVideo); d.multiVideo = s; return s }
  /** replace the whole edit (sanitized); the preview refreshes and the change is saved */
  set (id, mv, reason = 'edit') {
    const d = this._data(id); if (!d || d.nodeKind !== KIND_MULTI_VIDEO) return { ok: false, error: 'That is not a MultiVideo node.' }
    d.multiVideo = M.sanitizeMultiVideo(mv); this._look(id); this._frame(id, true)
    send('omni:multivideo-changed', { nodeId: id, reason }); this._persistSoon(id); return { ok: true, multiVideo: d.multiVideo }
  }
  /** edit with a pure function from utils/OmniMultiVideoModel.js: change(id, mv => M.addKeyCoord(mv, {...})) */
  change (id, fn, reason = 'edit') { const cur = this.get(id); if (!cur) return { ok: false, error: 'That is not a MultiVideo node.' }; return this.set(id, fn(cur), reason) }
  _persistSoon (id) { clearTimeout(this._persist.get(id)); this._persist.set(id, setTimeout(() => this.flush(id), PERSIST_MS)) }
  flush (id) { clearTimeout(this._persist.get(id)); this._persist.delete(id); const d = this._data(id); if (!d) return false; send('omni:force-save', {}); send('omni:node-updated', { id, data: d }); return true }
  _fixNode (d) { if (!d || d.nodeKind !== KIND_MULTI_VIDEO) return; d.multiVideo = M.sanitizeMultiVideo(d.multiVideo); this._look(d.id); this._frame(d.id, true) }
  _syncAll () { try { for (const d of this.omniNode?.getAllNodes?.() ?? []) this._fixNode(d) } catch (_) { /* none yet */ } }
  _look (id) { const m = this._mesh(id), s = this.get(id); if (m?.userData?.mvv && s) m.userData.mvv.setLook(s) }
  duration (id) { const s = this.get(id); return s ? M.totalDuration(s.clips) : 0 }

  // ── the library ──
  async _lib () { if (!this._assets) { try { const m = await import('../utils/OmniDocAssets.js'); this._assets = m.default ?? m.DocAssets } catch (_) { /* none */ } } return this._assets }
  async listVideos () { const a = await this._lib(); const l = await Promise.resolve(a?.list?.() ?? []).catch(() => []); return (Array.isArray(l) ? l : []).filter(x => x?.type === 'video').map(x => ({ id: String(x.id), name: String(x.name || x.id), size: Number(x.size) || 0 })) }
  async _urlFor (sourceId) {
    if (this._urls.has(sourceId)) return this._urls.get(sourceId)
    const a = await this._lib(); const meta = await Promise.resolve(a?.getMeta?.(sourceId)).catch(() => null); if (!meta) return null
    if ((meta.size || 0) > MAX_BYTES) return null
    const bytes = await a.getBytes(sourceId); if (!bytes) return null
    const url = URL.createObjectURL(new Blob([bytes], { type: meta.mime || 'video/mp4' })); this._urls.set(sourceId, url); return url
  }
  async _probe (sourceId) {
    const url = await this._urlFor(sourceId); if (!url || typeof document === 'undefined') return null
    return new Promise((res) => { const v = document.createElement('video'); v.preload = 'metadata'; const t = setTimeout(() => res(null), 8000); v.onloadedmetadata = () => { clearTimeout(t); res({ dur: v.duration, aspect: v.videoWidth ? v.videoHeight / v.videoWidth : 0 }) }; v.onerror = () => { clearTimeout(t); res(null) }; v.src = url })
  }
  /** add a clip: a library video (sourceId) or an empty placeholder clip you can fill later */
  async addClip (id, o = {}) {
    if (!this.get(id)) return { ok: false, error: 'That is not a MultiVideo node.' }
    const clip = { name: o.name || '', dur: o.dur, transition: o.transition, in: o.in, out: o.out, speed: o.speed }
    if (o.sourceId) { const a = await this._lib(); const meta = await Promise.resolve(a?.getMeta?.(o.sourceId)).catch(() => null); if (!meta) return { ok: false, error: 'That video is not in the library.' }; clip.source = { type: 'video', id: o.sourceId }; clip.name = clip.name || String(meta.name || o.sourceId); const pr = await this._probe(o.sourceId); if (pr?.dur > 0) clip.dur = pr.dur }
    const r = this.change(id, mv => M.addClip(mv, clip), 'clip'); return r.ok ? { ok: true, clips: r.multiVideo.clips.length } : r
  }
  async addClipFile (id, file) {
    try { const a = await this._lib(); const r = await a.importFile(file); if (!r.ok) return r; if (r.meta?.type !== 'video') return { ok: false, error: { code: 'not-video', message: 'That file is not a video.' } }; const o = await this.addClip(id, { sourceId: r.id, name: file.name }); return o.ok ? { ok: true, id: r.id } : o } catch (err) { return { ok: false, error: { code: 'storage', message: String(err?.message ?? err) } } }
  }

  // ── playing ──
  isPlaying (id) { return !!this._run.get(id)?.playing }
  time (id) { return this._run.get(id)?.t ?? 0 }
  state (id) { const r = this._run.get(id); return { playing: !!r?.playing, t: r?.t ?? 0, duration: this.duration(id) } }
  _r (id) { let r = this._run.get(id); if (!r) { r = { t: 0, playing: false, els: new Map(), base: null, camBase: null, orbitOff: false, lastLoad: 0 }; this._run.set(id, r) } return r }
  async play (id) {
    const s = this.get(id), mesh = this._mesh(id); if (!s || !mesh) return { ok: false, error: 'That is not a MultiVideo node.' }
    const total = M.totalDuration(s.clips); if (total <= 0) return { ok: false, error: 'Add a clip first.' }
    if (this._active && this._active !== id) this.pause(this._active)
    const r = this._r(id); if (r.t >= total - 0.01) r.t = 0
    if (!r.base) r.base = mesh.position.toArray(); r.playing = true; this._active = id; this._frame(id, true); this._emit(id, true)
    return { ok: true, playing: true }
  }
  pause (id) { const r = this._run.get(id); if (!r) return { ok: true, playing: false }; r.playing = false; for (const e of r.els.values()) { try { e.video.pause() } catch (_) { /* gone */ } } if (this._active === id) this._active = null; this._release(r); this._emit(id, true); return { ok: true, playing: false } }
  /** stop: back to 0, the node goes back where it was (the camera stays where the keys left it) */
  stop (id) {
    const r = this._run.get(id); if (!r) return { ok: true }
    r.playing = false; r.t = 0; this._dropEls(r); const m = this._mesh(id); if (m && r.base) m.position.fromArray(r.base); r.base = null; this._release(r)
    if (this._active === id) this._active = null; this._frame(id, true); this._emit(id, true); return { ok: true }
  }
  seek (id, t) { const r = this._r(id); const total = this.duration(id); r.t = Math.max(0, Math.min(total, Number.isFinite(+t) ? +t : 0)); const m = this._mesh(id); if (m && !r.base) r.base = m.position.toArray(); this._frame(id, true); this._emit(id, true); return { ok: true, t: r.t } }
  _release (r) { if (r.orbitOff) { r.orbitOff = false; try { window.dispatchEvent(new Event('omni:orbit-enable')) } catch (_) { /* no window */ } } }
  _emit (id, force = false) { const now = Date.now(); if (!force && now < this._sendAt) return; this._sendAt = now + 100; const r = this._run.get(id); send('omni:multivideo-state', { nodeId: id, playing: !!r?.playing, t: r?.t ?? 0 }) }
  _forget (id) { const r = this._run.get(id); if (r) { this._dropEls(r); this._release(r); this._run.delete(id) } if (this._active === id) this._active = null }
  _dropEls (r) { for (const e of r.els.values()) { try { e.video.pause(); e.video.removeAttribute('src'); e.video.load() } catch (_) { /* gone */ } } r.els.clear() }

  /** the <video> of a clip on screen (made lazily; null until it can show) */
  _el (id, r, clip, want) {
    let e = r.els.get(clip.id); if (e) return e.ready ? e.video : null
    if (!clip.source || !want || typeof document === 'undefined') return null
    const v = document.createElement('video'); v.playsInline = true; v.preload = 'auto'; v.crossOrigin = 'anonymous'; v.muted = true; e = { video: v, ready: false, src: clip.source.id }; r.els.set(clip.id, e)
    this._urlFor(clip.source.id).then(url => { if (!url || r.els.get(clip.id) !== e) return; v.onloadeddata = () => { e.ready = true; this._frame(id, true) }; v.src = url }).catch(() => {})
    return null
  }
  _sync (id, r, s, act, lay) {
    const want = new Set(); const clips = s.clips
    const pre = lay.find(l => l.start > r.t && l.start - r.t < PRELOAD)
    for (const x of [act.a, act.b]) if (x) want.add(clips[x.i].id)
    if (pre) want.add(clips[pre.i].id)
    for (const [cid, e] of [...r.els]) if (!want.has(cid)) { try { e.video.pause(); e.video.removeAttribute('src'); e.video.load() } catch (_) { /* gone */ } r.els.delete(cid) }
    const out = [null, null]
    ;[act.a, act.b].forEach((x, k) => {
      if (!x) return; const c = clips[x.i]; const el = this._el(id, r, c, true); out[k] = el
      if (el) { el.playbackRate = Math.max(0.25, Math.min(4, c.speed)); const dur = Number.isFinite(el.duration) ? el.duration : 1e9; const target = Math.min(x.src, Math.max(0, dur - 0.05)); if (Math.abs(el.currentTime - target) > (r.playing ? DRIFT : 0.04)) { try { el.currentTime = target } catch (_) { /* not ready */ } }
        el.muted = s.muted; el.volume = Math.max(0, Math.min(1, s.volume * x.vol * x.alpha)); if (r.playing) { if (el.paused) el.play?.().catch(() => {}) } else if (!el.paused) el.pause() }
    })
    if (pre) { const c = clips[pre.i]; const el = this._el(id, r, c, true); if (el && !r.playing) { /* parked on its first frame */ } }
    return out
  }
  /** draw the frame at the current time; force = also when not playing (scrub / edit) */
  _frame (id, force = false) {
    const s = this.get(id), mesh = this._mesh(id), v = mesh?.userData?.mvv; if (!s || !v) return
    const r = this._r(id); if (!force && !r.playing) return
    const lay = M.layout(s.clips); const act = M.activeAt(s.clips, r.t); const total = M.totalDuration(s.clips)
    const [elA, elB] = this._sync(id, r, s, act, lay); v.setVideos(elA, elB)
    const mk = (x) => (x ? { alpha: x.alpha, key: s.clips[x.i].key } : null)
    v.show({ a: mk(act.a), b: mk(act.b), p: act.p, kind: act.kind })
    const tx = M.textAt(s.text, r.t, total); v.setText(tx ? { item: tx.item, alpha: tx.alpha, offset: M.textOffsetAt(s.text, r.t) } : null)
    const pose = M.poseAt(s.keys, r.t)
    if (pose.node && (r.playing || force)) mesh.position.set(...pose.node)
    if (pose.camera && r.playing) this._cam(r, mesh, pose.camera)
  }
  _cam (r, mesh, c) {
    const cam = this.ctx?.camera; if (!cam) return
    if (!r.orbitOff) { r.orbitOff = true; try { window.dispatchEvent(new Event('omni:orbit-disable')) } catch (_) { /* no window */ } }
    cam.position.set(...c.pos); const look = c.look ?? mesh.position.toArray(); cam.lookAt(look[0], look[1], look[2])
    const oc = this.ctx?.controls ?? this.ctx?.orbit; if (oc?.target) { oc.target.set(look[0], look[1], look[2]) }
  }
  update (delta) {
    const id = this._active; if (!id) return; const r = this._run.get(id); if (!r?.playing) return
    const total = this.duration(id); if (total <= 0) { this.pause(id); return }
    r.t += Math.min(0.1, delta || 0)
    if (r.t >= total) { if (this.get(id).loop) r.t = r.t % total; else { r.t = total; this._frame(id, true); this.pause(id); this._emit(id, true); return } }
    this._frame(id); this._emit(id)
  }

  // ── create ──
  _positionFor (o) {
    const p = o.position; if (Array.isArray(p) && p.length >= 3 && p.slice(0, 3).every(Number.isFinite)) return [p[0], p[1], p[2]]
    const cam = this.ctx.camera; const dir = new THREE.Vector3(); cam.getWorldDirection(dir); const q = cam.position.clone().addScaledVector(dir, PIN_DISTANCE); return [q.x, q.y, q.z]
  }
  create (opts = {}) {
    try {
      const o = opts && typeof opts === 'object' ? opts : {}; const mv = M.sanitizeMultiVideo({ width: o.width, loop: o.loop, muted: o.muted, volume: o.volume, clips: o.clips, keys: o.keys, text: o.text })
      const nodeId = typeof o.id === 'string' && /^[\w-]{1,64}$/.test(o.id) ? o.id : newId()
      if (this._data(nodeId)) return { ok: false, error: 'There is already a node called ' + nodeId }
      send('omni:node-create-request', { nodeKind: KIND_MULTI_VIDEO, multiVideo: mv, id: nodeId, label: String(o.label || 'MultiVideo').slice(0, 40), geometry: GEO_MULTI_VIDEO, primitive: 'objective', color: '#ffd27a', position: this._positionFor(o), rotation: [0, 0, 0], scale: [1, 1, 1], noParent: true, noSelect: o.select !== true })
      if (this.omniNode && !this._data(nodeId)) return { ok: false, error: 'The node could not be created.' }
      return { ok: true, nodeId }
    } catch (err) { return { ok: false, error: String(err?.message ?? err) } }
  }
}
