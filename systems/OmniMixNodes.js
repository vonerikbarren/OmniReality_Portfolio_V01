/**
 * systems/OmniMixNodes.js — the runtime of the OmniMusicMixNode kind (V201), built like systems/OmniSongNodes.js.
 *
 * The model is utils/OmniMixModel.js (pure) and the audio is systems/OmniMixEngine.js; the node kind (data.nodeKind 'mixNode', a small mixing desk) is utils/OmniExtraKinds.js +
 * utils/OmniMixNodeMesh.js. This module does what needs the live scene:
 *   - CREATING   omni:mix-node-create { position?, at?, label?, select?, mix?, id? } (answer in detail.out { ok, nodeId }). An ordinary OmniNode (omni:node-create-request).
 *   - REACTING   every frame the desk's faders follow the mix and its caps brighten with the strip levels while it plays (far nodes skipped; allocates nothing).
 *   - THE STORE  getMix / commit / edit / undo / redo / beginStroke: what the ⟐OmniMix panel and the Inspector read and write. A stored mix is NEVER mutated: every edit makes a new
 *                sanitized object (the model's ops are immutable), so an undo step is the previous object. Edits are applied live (MixEngine.update) and persisted after a pause.
 *   - TRANSPORT  play / stop / toggle / seek; the engine plays ONE mix at a time. Events: omni:mix-changed { nodeId, reason }, omni:mix-transport (from the engine).
 *   - RECORDING  setRecording(true): fader moves made through setParam() while the mix plays are written as automation at the mix time (utils/OmniMixModel.recordMove).
 *   - SOURCES    listSources() -> { songs, sounds, audio } for the strip pickers.
 * Module contract: constructor(context, omniNode) / init (guarded) / update(delta) / destroy / onResize. User-facing: imports no Dev* module.
 */

import * as THREE from 'three'
import * as X from '../utils/OmniMixModel.js'
import { KIND_MIX, GEO_MIX, SERVICES } from '../utils/OmniExtraKinds.js'
import { liveMixMeshes, reactMixMesh } from '../utils/OmniMixNodeMesh.js'
import { sanitizeSound } from '../utils/OmniSoundModel.js'
import SoundEngine from './OmniSoundEngine.js'
import { MixEngine } from './OmniMixEngine.js'
import * as PlayerMod from './OmniSongPlayer.js'

const PIN_DISTANCE = 6
const UNDER_OFFSET = 1.6
const FAR_SQ = 220 * 220
const PERSIST_MS = 300
export const UNDO_MAX = 100
const COALESCE_MS = 900
const NODE_COLOR = '#ffb35c'
const newId = () => 'omni_' + Math.random().toString(36).slice(2, 8)
const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())
const isPlayer = (p) => !!p && typeof p.getPosition === 'function' && typeof p.isPlaying === 'function'

function songPlayer () { for (const c of [PlayerMod.SongPlayer, PlayerMod.default]) if (isPlayer(c)) return c; return null }

export default class OmniMixNodes {
  constructor (context, omniNode = null, opts = {}) {
    this.ctx = context
    this.omniNode = omniNode
    this._mixer = opts.mixer ?? MixEngine
    this._assets = opts.assets ?? null
    this._inited = 0
    this._bound = []
    this._selectedId = null
    this._persist = new Map()
    this._undo = new Map()
    this._redo = new Map()
    this._sane = new WeakMap()
    this._coalesce = null
    this._stroke = null
    this._playingId = null
    this._recording = false
    this._taps = new Map()
    this._audioList = []
  }

  init () {
    this._inited++
    if (this._inited > 1) return
    const on = (name, fn) => { const h = (e) => fn(e.detail ?? {}, e); window.addEventListener(name, h); this._bound.push([name, h]) }
    on('omni:mix-node-create', (d, e) => { const out = this.createMixNode(d); if (e.detail && typeof e.detail === 'object') e.detail.out = out })
    on('omni:node-selected', (d) => { this._selectedId = d.node?.id ?? null })
    on('omni:node-deselected', () => { this._selectedId = null })
    on('omni:node-created', (d) => this._fixNode(d.node))
    on('omni:audio-assets-changed', () => this._refreshAudio())
    on('omni:node-deleted', (d) => this._onDeleted(d.id))
    on('omni:mix-transport', (d) => { this._playingId = d.state === 'play' ? d.nodeId : (this._playingId === d.nodeId ? null : this._playingId) })
    on('omni:mix-transport-request', (d) => { if (d.action && d.nodeId) this.transport(d.action, d.nodeId, d.t) })
    this._configureEngine()
    this._syncAll()
    SERVICES.mix = this
  }

  _configureEngine () {
    const self = this
    this._mixer.configure?.({
      engine: SoundEngine, songPlayer: songPlayer(), assets: this._assets ?? undefined,
      getSound (id) { const d = self.getNodeData(id); return d && d.sound && typeof d.sound === 'object' ? sanitizeSound(d.sound) : null },
    })
    if (!this._assets) {
      import('../utils/OmniAudioAssets.js').then((m) => { const a = m.default ?? m.AudioAssets; if (a) { this._assets = a; this._mixer.configure?.({ assets: a }); this._refreshAudio() } }, () => {})
    } else this._refreshAudio()
  }
  /** The audio library list is ASYNC (IndexedDB): keep a copy for the strip pickers and tell open views when it changes. (V201 read it synchronously, so the clip picker was always empty.) */
  _refreshAudio () {
    const a = this._assets; if (!a || typeof a.list !== 'function') return
    const set = (l) => {
      if (!Array.isArray(l)) return
      this._audioList = l.map(x => ({ id: String(x.id), name: String(x.name || x.id) }))
      try { window.dispatchEvent(new CustomEvent('omni:mix-sources-changed', { detail: {} })) } catch (_) { /* no window */ }
    }
    try { const l = a.list(); if (Array.isArray(l)) set(l); else Promise.resolve(l).then(set, () => {}) } catch (_) { /* no library */ }
  }

  update (delta) {
    void delta
    const meshes = liveMixMeshes()
    if (!meshes.size) return
    const cam = this.ctx?.camera?.position
    let levels = null
    if (this._playingId) { try { levels = this._mixer.getLevels().strips } catch (_) { levels = null } }
    for (const mesh of meshes) {
      if (mesh.visible === false) continue
      const id = mesh.userData.nodeId
      if (!id || !mesh.userData.mnv) continue
      if (cam) {
        const e = mesh.matrixWorld.elements
        const dx = e[12] - cam.x; const dy = e[13] - cam.y; const dz = e[14] - cam.z
        if (dx * dx + dy * dy + dz * dz > FAR_SQ) continue
      }
      reactMixMesh(mesh, this.getMix(id), id === this._playingId ? levels : null, id === this._playingId)
    }
  }

  onResize () {}

  destroy () {
    if (!this._inited) return
    this._bound.forEach(([n, h]) => window.removeEventListener(n, h))
    this._bound = []
    this._persist.forEach(t => clearTimeout(t)); this._persist.clear()
    this._undo.clear(); this._redo.clear()
    try { this._mixer.stop?.() } catch (_) { /* ignore */ }
    if (SERVICES.mix === this) SERVICES.mix = null
    this._inited = 0
  }

  // ── Reading ─────────────────────────────────────────────────────────────────
  get selectedId () { return this._selectedId }
  get recording () { return this._recording }
  getNodeData (id) { return this.omniNode?.getNodeData?.(id) ?? null }
  isMixNode (id) { return this.getNodeData(id)?.nodeKind === KIND_MIX }
  listMixNodes () { try { return (this.omniNode?.getAllNodes?.() ?? []).filter(d => d?.nodeKind === KIND_MIX).map(d => d.id) } catch (_) { return [] } }
  /** The sanitized mix of a node (READ ONLY), or null when the node is not a mix node. Cached until data.mix is replaced. */
  getMix (id) {
    const d = this.getNodeData(id)
    if (!d || d.nodeKind !== KIND_MIX) return null
    const raw = d.mix
    if (!raw || typeof raw !== 'object') { const m = X.sanitizeMix(X.defaultMix()); this._sane.set(m, m); d.mix = m; return m }
    let m = this._sane.get(raw)
    if (!m) { m = X.sanitizeMix(raw); this._sane.set(raw, m); this._sane.set(m, m) }
    return m
  }

  /** What a strip can play: song nodes, sound nodes and the audio library. */
  listSources () {
    const out = { songs: [], sounds: [], audio: [] }
    try {
      for (const d of this.omniNode?.getAllNodes?.() ?? []) {
        if (d?.nodeKind === 'songNode') out.songs.push({ id: d.id, name: d.label || d.id })
        else if (d?.nodeKind === 'soundNode') out.sounds.push({ id: d.id, name: d.label || d.id })
      }
    } catch (_) { /* no nodes */ }
    out.audio = this._audioList.slice()
    return out
  }

  // ── Creating ────────────────────────────────────────────────────────────────
  _frontOfCamera () {
    const cam = this.ctx.camera
    const dir = new THREE.Vector3(); cam.getWorldDirection(dir)
    const p = cam.position.clone().addScaledVector(dir, PIN_DISTANCE)
    return [p.x, Math.max(0.6, p.y), p.z]
  }
  _positionFor (opts) {
    const p = opts.position
    if (Array.isArray(p) && p.length >= 3 && p.slice(0, 3).every(Number.isFinite)) return [p[0], p[1], p[2]]
    if (p && typeof p === 'object' && [p.x, p.y, p.z].every(Number.isFinite)) return [p.x, p.y, p.z]
    if (opts.at === 'selected' && this._selectedId) {
      const m = this.omniNode?.getMeshById?.(this._selectedId)
      if (m) { const v = new THREE.Vector3(); m.getWorldPosition(v); return [v.x, v.y - UNDER_OFFSET, v.z] }
    }
    return this._frontOfCamera()
  }
  _nextName () {
    const labels = new Set((this.omniNode?.getAllNodes?.() ?? []).filter(d => d?.nodeKind === KIND_MIX).map(d => d.label))
    if (!labels.has('Mix node')) return 'Mix node'
    for (let i = 2; i < 999; i++) if (!labels.has(`Mix node ${i}`)) return `Mix node ${i}`
    return 'Mix node'
  }
  /** New mix node. With no `mix`, the desk starts with one strip per song / sound node already in the scene (up to 8) so it is useful at once. Returns { ok, nodeId }. */
  createMixNode (opts = {}) {
    try {
      const o = opts && typeof opts === 'object' ? opts : {}
      let mix
      if (o.mix && typeof o.mix === 'object') mix = X.sanitizeMix(o.mix)
      else {
        mix = X.defaultMix()
        const src = this.listSources()
        for (const s of [...src.songs.slice(0, 2).map(x => ({ ...x, type: 'song' })), ...src.sounds.slice(0, 6).map(x => ({ ...x, type: 'sound' }))].slice(0, 8)) {
          mix = X.addStrip(mix, { name: s.name, source: { type: s.type, id: s.id } })
        }
      }
      const nodeId = typeof o.id === 'string' && /^[\w-]{1,64}$/.test(o.id) ? o.id : newId()
      window.dispatchEvent(new CustomEvent('omni:node-create-request', { detail: {
        nodeKind: KIND_MIX, mix, id: nodeId, label: String(o.label || this._nextName()).slice(0, 40), geometry: GEO_MIX, primitive: 'objective', color: NODE_COLOR,
        position: this._positionFor(o), rotation: [0, 0, 0], scale: [1, 1, 1], noParent: true, noSelect: o.select !== true,
      } }))
      if (this.omniNode && !this.omniNode.getNodeData?.(nodeId)) return { ok: false, error: 'The mix node could not be created.' }
      return { ok: true, nodeId }
    } catch (err) { return { ok: false, error: String(err?.message ?? err) } }
  }
  _fixNode (d) {
    if (!d || d.nodeKind !== KIND_MIX) return
    if (!d.mix || typeof d.mix !== 'object' || Array.isArray(d.mix)) { d.mix = X.sanitizeMix(X.defaultMix()); this._sane.set(d.mix, d.mix); this._persistSoon(d.id) }
  }
  _syncAll () { try { for (const d of this.omniNode?.getAllNodes?.() ?? []) this._fixNode(d) } catch (_) { /* no nodes yet */ } }
  _onDeleted (id) {
    clearTimeout(this._persist.get(id)); this._persist.delete(id)
    this._undo.delete(id); this._redo.delete(id)
    if (this._stroke === id) this._stroke = null
    try { if (this._playingId === id) this._mixer.stop() } catch (_) { /* ignore */ }
  }

  // ── Transport ───────────────────────────────────────────────────────────────
  isPlaying (id = null) { try { return this._mixer.isPlaying(id) } catch (_) { return false } }
  getPosition () { try { return this._mixer.getPosition() } catch (_) { return { playing: false, t: 0 } } }
  getLevels () { try { return this._mixer.getLevels() } catch (_) { return { master: 0, strips: {} } } }
  getWarnings () { try { return this._mixer.getWarnings() } catch (_) { return [] } }
  /** action 'play' | 'stop' | 'toggle' | 'seek'. Returns { ok, error? }. */
  transport (action, nodeId, t = null) {
    try {
      if (action === 'stop') return this._mixer.stop()
      const mix = this.getMix(nodeId); if (!mix) return { ok: false, error: 'No such mix node.' }
      if (action === 'seek') return { ok: this._mixer.seek(t) }
      if (action === 'toggle') return this.isPlaying(nodeId) ? this._mixer.stop() : this._mixer.play(nodeId, mix, { from: t ?? 0 })
      if (action === 'play') return this._mixer.play(nodeId, mix, { from: t ?? 0 })
      return { ok: false, error: 'Unknown action.' }
    } catch (err) { return { ok: false, error: String(err?.message ?? err) } }
  }

  // ── Decks (V202): cue points, hot cues, loops, beat grid, tap tempo, pitch, key lock ────────────────────────────────────────────────────────────────
  /** Live state of a deck while this mix plays: { pos, dur, rate, ended, paused, region, keyLock } or null. */
  getDeck (stripId) { try { return this._mixer.getDeck?.(stripId) ?? null } catch (_) { return null } }
  /** Jump a deck to a clip time (the waveform click). */
  jumpDeck (id, stripId, t) { try { return this.isPlaying(id) ? this._mixer.jump(stripId, t) : { ok: false, error: 'Play the mix first.' } } catch (err) { return { ok: false, error: String(err?.message ?? err) } } }
  /** Waveform peaks (2n values min / max) of the clip on an audio strip, or null. */
  async getDeckPeaks (id, stripId, n = 256) {
    try { const st = X.stripById(this.getMix(id) ?? X.defaultMix(), stripId); if (!st || st.source.type !== 'audio' || !st.source.id) return null; return await this._assets?.getPeaks?.(st.source.id, n) ?? null } catch (_) { return null }
  }
  /**
   * One deck button. action: 'cue' (jump to the cue), 'setcue' (cue = here), 'hot' (arg slot 0..3: jump if set, else store here), 'hotclear' (arg slot), 'loop' (arg beats),
   * 'looptoggle', 'half', 'double', 'back', 'fwd' (loop moves one loop length), 'play', 'pause', 'grid' (first beat = here), 'tap', 'mastertempo', 'pitch' (arg -1..1), 'pitchreset', 'keylock'.
   * "Here" is the playhead of the deck while the mix plays, else the cue. Returns { ok, error? }.
   */
  deck (id, stripId, action, arg = null) {
    try {
      const mix = this.getMix(id); const st = mix && X.stripById(mix, stripId)
      if (!st) return { ok: false, error: 'No such strip.' }
      const live = this.isPlaying(id) ? this.getDeck(stripId) : null
      const pos = live ? live.pos : st.cue; const dur = live ? live.dur : 0
      const ed = (reason, fn, co = null) => this.edit(id, reason, fn, co)
      const jump = (t) => (live ? this._mixer.jump(stripId, t) : { ok: true })
      switch (action) {
        case 'cue': return jump(st.cue)
        case 'setcue': return ed('cue', (m) => X.setCue(m, stripId, pos, true))
        case 'hot': { const i = Math.round(Number(arg)); if (!(i >= 0 && i < 4)) return { ok: false, error: 'Hot cue 1 to 4.' }; if (st.hot[i] !== null) return jump(st.hot[i]); return ed('hot-cue', (m) => X.setHotCue(m, stripId, i, pos, true)) }
        case 'hotclear': return ed('hot-cue', (m) => X.setHotCue(m, stripId, Math.round(Number(arg)), null))
        case 'loop': return ed('loop', (m) => X.loopBeats(m, stripId, pos, Number(arg) || 4, dur))
        case 'looptoggle': return ed('loop', (m) => X.toggleLoop(m, stripId))
        case 'half': return ed('loop', (m) => X.scaleLoopBy(m, stripId, 0.5, dur))
        case 'double': return ed('loop', (m) => X.scaleLoopBy(m, stripId, 2, dur))
        case 'back': case 'fwd': return ed('loop', (m) => X.shiftLoopBy(m, stripId, action === 'back' ? -Math.max(1, Math.round((st.loopOut - st.loopIn) / (60 / (st.bpm || 60)))) : Math.max(1, Math.round((st.loopOut - st.loopIn) / (60 / (st.bpm || 60)))), dur))
        case 'play': return live ? this._mixer.resumeDeck(stripId) : { ok: true }
        case 'pause': return live ? this._mixer.pauseDeck(stripId) : { ok: true }
        case 'grid': return ed('grid', (m) => X.setGrid(m, stripId, pos))
        case 'tap': {
          const list = (this._taps.get(stripId) ?? []).filter(t => nowMs() / 1000 - t < 3); list.push(nowMs() / 1000); this._taps.set(stripId, list.slice(-8))
          if (list.length < 3) return { ok: true, taps: list.length }
          return { ...ed('tap', (m) => X.tapBpm(m, stripId, list)), taps: list.length }
        }
        case 'mastertempo': return ed('master-tempo', (m) => X.tempoFromStrip(m, stripId))
        case 'pitch': return ed('pitch', (m) => X.setPitch(m, stripId, Number(arg)), 'pitch:' + stripId)
        case 'pitchreset': return ed('pitch', (m) => X.setPitch(m, stripId, 0))
        case 'keylock': return ed('keylock', (m) => X.setKeyLock(m, stripId, !st.keyLock))
        default: return { ok: false, error: 'Unknown deck action.' }
      }
    } catch (err) { return { ok: false, error: String(err?.message ?? err) } }
  }

  // ── Recording a performance ─────────────────────────────────────────────────
  setRecording (on) { this._recording = !!on; return this._recording }
  /** Set one parameter ('st_1.volume', 'master.gain', 'cross.pos'). While recording and playing this mix, the move is written as automation at the mix time. */
  setParam (id, target, value, coalesce = null) {
    const rec = this._recording && this.isPlaying(id)
    const t = rec ? this.getPosition().t : 0
    return this.edit(id, rec ? 'record' : 'param', (m) => (rec ? X.recordMove(m, target, t, value) : X.setParam(m, target, value)), coalesce ?? ('p:' + target))
  }

  // ── Store ───────────────────────────────────────────────────────────────────
  _persistSoon (id) { if (!id) return; clearTimeout(this._persist.get(id)); this._persist.set(id, setTimeout(() => this.flush(id), PERSIST_MS)) }
  flush (id) {
    if (id) { clearTimeout(this._persist.get(id)); this._persist.delete(id) }
    const d = id ? this.getNodeData(id) : null
    if (!d) return false
    try { window.dispatchEvent(new CustomEvent('omni:force-save', { detail: {} })) } catch (_) { /* no window */ }
    try { window.dispatchEvent(new CustomEvent('omni:node-updated', { detail: { node: d } })) } catch (_) { /* no window */ }
    return true
  }
  flushAll () { for (const id of [...this._persist.keys()]) this.flush(id) }
  _announce (nodeId, reason) { try { window.dispatchEvent(new CustomEvent('omni:mix-changed', { detail: { nodeId, reason } })) } catch (_) { /* no window */ } }
  _live (id, mix) { try { if (this._playingId === id) this._mixer.update(mix) } catch (_) { /* the engine is optional here */ } }

  commit (id, mix, reason = 'edit') {
    const d = this.getNodeData(id); if (!d || d.nodeKind !== KIND_MIX) return false
    const m = X.sanitizeMix(mix)
    this._sane.set(m, m)
    d.mix = m
    this._live(id, m)
    this._announce(id, reason)
    this._persistSoon(id)
    return m
  }
  pushUndo (id) {
    const cur = this.getMix(id); if (!cur) return false
    const st = this._undo.get(id) ?? []
    st.push(cur); if (st.length > UNDO_MAX) st.shift()
    this._undo.set(id, st); this._redo.delete(id)
    return true
  }
  undoDepth (id) { return this._undo.get(id)?.length ?? 0 }
  canUndo (id) { return this.undoDepth(id) > 0 }
  canRedo (id) { return (this._redo.get(id)?.length ?? 0) > 0 }
  undo (id) {
    const st = this._undo.get(id); const cur = this.getMix(id)
    if (!cur || !st?.length) return { ok: false, error: 'Nothing to undo.' }
    const prev = st.pop(); const rd = this._redo.get(id) ?? []; rd.push(cur); this._redo.set(id, rd)
    this._setDirect(id, prev, 'undo'); return { ok: true }
  }
  redo (id) {
    const rd = this._redo.get(id); const cur = this.getMix(id)
    if (!cur || !rd?.length) return { ok: false, error: 'Nothing to redo.' }
    const next = rd.pop(); const st = this._undo.get(id) ?? []; st.push(cur); this._undo.set(id, st)
    this._setDirect(id, next, 'redo'); return { ok: true }
  }
  _setDirect (id, mix, reason) {
    const d = this.getNodeData(id); if (!d) return
    d.mix = mix; this._sane.set(mix, mix); this._coalesce = null
    this._live(id, mix); this._announce(id, reason); this._persistSoon(id)
  }
  /** Run an edit: fn(mix) returns the NEW mix. One undo step (a repeated `coalesce` key within 0.9 s shares one; a beginStroke() gesture is one step). */
  edit (id, reason, fn, coalesce = null) {
    const cur = this.getMix(id); if (!cur) return { ok: false, error: 'No such mix node.' }
    let next
    try { next = fn(cur) } catch (err) { return { ok: false, error: String(err?.message ?? err) } }
    if (next && next.error) return { ok: false, error: next.error }
    if (!next || typeof next !== 'object') return { ok: false, error: 'That edit did not work.' }
    const clean = X.sanitizeMix(next)
    if (JSON.stringify(clean) === JSON.stringify(cur)) return { ok: true, mix: cur, same: true }
    const t = nowMs()
    const merge = this._stroke === id || (coalesce && this._coalesce && this._coalesce.id === id && this._coalesce.key === coalesce && t - this._coalesce.t < COALESCE_MS)
    if (!merge) this.pushUndo(id)
    this._coalesce = coalesce ? { id, key: coalesce, t } : null
    return { ok: true, mix: this.commit(id, clean, reason) }
  }
  beginStroke (id) { if (this._stroke === id) return true; if (!this.getMix(id)) return false; this.pushUndo(id); this._stroke = id; this._coalesce = null; return true }
  endStroke () { this._stroke = null }
  getStats () { return { meshes: liveMixMeshes().size, selected: this._selectedId, pendingSaves: this._persist.size, playing: this._playingId } }
}
