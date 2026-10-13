/**
 * systems/OmniSongPlayer.js — the PLAYER of a SongNode: arrangement transport + lookahead scheduler + lane buses + master limiter + send FX (V198).
 * Design and maths: docs/architecture/OMNISONGPLAYER_DESIGN.md. Contract: docs/architecture/OMNISONG_CONTRACT.md. The data model is utils/OmniSongModel.js.
 *
 *   SongPlayer.play(nodeId, {fromBar?}) / stop(nodeId) / pause(nodeId) / seek(nodeId, bar) / isPlaying(nodeId?) / update(nodeId, song?)
 *   SongPlayer.getPosition(nodeId) -> { playing, bar (1-based float), seconds, loopCount, warnings[] }     getLevels(nodeId) -> { master, lanes:{[id]:0..1} } (REUSED object)
 *   events in : omni:song-transport-request { action:'play'|'stop'|'pause'|'toggle'|'seek', nodeId?, bar? }   (answer in detail.out)
 *   events out: omni:song-transport { state:'play'|'stop', nodeId, paused? }
 *
 * What it does
 *   - ONE song plays at a time (starting another stops the first). The song's data is read from the node registry (node.data.song, sanitized + cached per raw object);
 *     an edit of that object while playing (or SongPlayer.update(nodeId, song)) is adopted at once, without a jump: the position is kept, the tempo map is swapped.
 *   - A setTimeout every ~25 ms schedules everything that falls in the next 100 ms (1.5 s while the tab is hidden) against SoundEngine.now(). All times come from
 *     ANCHORS {t (engine time), s (song seconds)}; song seconds <-> bars go through the tempo map, so a tempo change inside the song is exact and nothing drifts.
 *     The loop region wraps by pushing a new anchor at the exact engine time of the loop end: no gap, no doubled note, getPosition follows the anchor that is audible.
 *   - PATTERN clips play the referenced MusicNode (tracks, steps, swing, transpose, probability, offset) through SoundEngine.playNote with the sound of each track's
 *     instrument node (like systems/OmniSequencer.js). The pattern repeats `repeat` times inside the clip, `offset` bars into the source, lane transpose + clip transpose.
 *     LIMIT: the shared engine voices are not routed through the lane buses, so lane volume / clip gain / master gain / mute / solo / automation of 'volume' act as a
 *     VELOCITY scale (capped at velocity 1, so a pattern lane cannot be boosted above the pattern's own level); pan, filter and the sends are NOT applied to patterns.
 *   - AUDIO clips play through AudioAssets.playClip (utils/OmniAudioAssets.js, loaded defensively) into the lane bus: Gain (fader) -> lowpass (filter) -> StereoPanner
 *     -> master, with two sends (reverb: ConvolverNode with a generated impulse; delay: feedback delay). Master: Gain -> lowpass -> panner -> DynamicsCompressor
 *     (limiter) -> AnalyserNode -> the engine's master gain (so the global volume / mute still apply) or the destination. Audio is NOT time-stretched: a clip's length
 *     in bars is converted to seconds through the tempo map, `repeat` is ignored for audio.
 *   - Automation: while an automation lane exists it REPLACES the fader of that param. Pattern lanes read it at scheduling time, audio lanes / master get an AudioParam
 *     target every tick.
 *   - Everything degrades: no engine / no context / no audio library never throws; the reason is listed in getPosition().warnings.
 * Headless: opts { engine, timers, rng, getNodeData, getAllNodes, audioAssets } let a test drive the fake engine clock by hand and call tick().
 * USER-facing module: it imports no Dev* module.
 */

import SoundEngine, { makeImpulse } from './OmniSoundEngine.js'
import * as MM from '../utils/OmniMusicModel.js'
import * as SM from '../utils/OmniSongModel.js'
import { sanitizeSound } from '../utils/OmniSoundModel.js'
import { SERVICES, KIND_MUSIC } from '../utils/OmniExtraKinds.js'

export const TICK_MS = 25
export const LOOKAHEAD_S = 0.1
export const HIDDEN_LOOKAHEAD_S = 1.5
export const START_DELAY_S = 0.08
export const END_TAIL_S = 0.25
export const DISPOSE_MS = 150
const MAX_EVENTS_PER_TICK = 512
const LATE_SKIP_S = 0.12
const EPS_BEATS = 1e-7   // window edges: a float error of a bar<->seconds round trip must not lose / double an event on the edge (both neighbours use the same epsilon)
const EPS_BAR = 1e-9
const METER_DECAY_S = 0.25
const PATTERN_METER_S = 0.12

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v)
const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d)
const emit = (name, detail) => { try { if (typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') window.dispatchEvent(new CustomEvent(name, { detail })) } catch (_) { /* no window */ } }
const isObj = (v) => !!v && typeof v === 'object'
const EMPTY_LEVELS = Object.freeze({ master: 0, lanes: Object.freeze({}) })

export class OmniSongPlayer {
  constructor (opts = {}) {
    this._o = {}
    this.engine = null; this._timers = null; this._rng = Math.random
    this._lookup = { getNodeData: null, getAllNodes: null }
    this.assets = null            // the audio library (set by a test, or loaded lazily)
    this._assetsState = 'idle'    // 'idle' | 'loading' | 'ready' | 'missing'
    this._sess = null
    this._resume = new Map()      // nodeId -> bar to resume / start from
    this._home = new Map()        // nodeId -> bar a stop returns to (the bar of an explicit play / seek while stopped; default 1)
    this._lastNodeId = null
    this._timer = null
    this._bound = []
    this._inited = 0
    this._disposing = new Set()
    this._songCache = new WeakMap(); this._musicCache = new WeakMap(); this._idxCache = new WeakMap()
    this._idle = { playing: false, bar: 1, seconds: 0, loopCount: 0, warnings: [] }
    this.configure(opts)
  }

  /** Inject dependencies (tests / the scene module): { engine, timers:{set,clear}, rng, getNodeData, getAllNodes, audioAssets }. */
  configure (o = {}) {
    if (o.engine !== undefined) this._o.engine = o.engine
    if (o.timers !== undefined) this._o.timers = o.timers
    if (typeof o.rng === 'function') this._rng = o.rng
    if (typeof o.getNodeData === 'function') this._lookup.getNodeData = o.getNodeData
    if (typeof o.getAllNodes === 'function') this._lookup.getAllNodes = o.getAllNodes
    if (o.audioAssets !== undefined) this.setAudioAssets(o.audioAssets)
    this.engine = this._o.engine ?? SoundEngine
    this._timers = this._o.timers ?? { set: (f, ms) => setTimeout(f, ms), clear: (h) => clearTimeout(h) }
    return this
  }
  /** Install the audio library (a hook for tests; production loads utils/OmniAudioAssets.js itself). null = uninstall (the player tries to load the real one again), false = pretend there is none. */
  setAudioAssets (a) {
    this.assets = a && typeof a.playClip === 'function' ? a : null
    this._assetsState = this.assets ? 'ready' : (a === false ? 'missing' : 'idle')   // false = "there is no audio library" (tests)
  }
  /** Look the nodes up through an OmniNode instance (the scene module does this). */
  attach (omniNode) {
    this._lookup.getNodeData = omniNode ? (id) => omniNode.getNodeData?.(id) : null
    this._lookup.getAllNodes = omniNode ? () => omniNode.getAllNodes?.() : null
  }

  // ── Module lifecycle (the scene module calls these) ─────────────────────────

  init () {
    this._inited++
    if (this._inited > 1 || typeof window === 'undefined') return
    const on = (name, fn) => { const h = (e) => fn(e.detail ?? {}, e); window.addEventListener(name, h); this._bound.push([name, h]) }
    on('omni:song-transport-request', (d) => this._request(d))
    on('omni:node-deleted', (d) => { this._resume.delete(d.id); this._home.delete(d.id); if (this._sess && this._sess.nodeId === d.id) this.stop(d.id) })
    on('omni:scene-clear-request', () => this.stop())
    this._loadAssets()
  }
  /** Per frame (cheap): re-arm a throttled / killed timer. */
  frame () { if (this._sess && !this._timer) this._arm() }
  destroy () {
    if (!this._inited) return
    this.stop()
    this._bound.forEach(([n, h]) => window.removeEventListener(n, h))
    this._bound = []
    this.flushDisposals()
    this._inited = 0
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  now () {
    const e = this.engine
    try {
      if (e && typeof e.now === 'function') { const t = e.now(); if (Number.isFinite(t)) return t }
      if (e && typeof e._now === 'function') { const t = e._now(); if (Number.isFinite(t)) return t }
    } catch (_) { /* fall through */ }
    return (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000
  }
  _ctx () { try { return this.engine?.getContext?.() ?? null } catch (_) { return null } }
  _data (id) { try { return this._lookup.getNodeData ? this._lookup.getNodeData(id) ?? null : null } catch (_) { return null } }

  /** { raw, song } of a song node (sanitized, cached per raw object), or null when `id` is not a song node. */
  _songOf (id) {
    const d = this._data(id)
    if (!d || d.nodeKind !== SM.KIND_SONG) return null
    const raw = isObj(d.song) ? d.song : d
    let s = this._songCache.get(raw)
    if (!s) { s = SM.sanitizeSong(isObj(d.song) ? d.song : undefined); this._songCache.set(raw, s) }
    return { raw, song: s }
  }
  /** The sanitized pattern of a MusicNode (the shared store when running, else a cached reader), or null. */
  _music (id) {
    try { const m = SERVICES.music?.getMusic?.(id); if (m) return m } catch (_) { /* fall back */ }
    const d = this._data(id)
    if (!d || d.nodeKind !== KIND_MUSIC || !isObj(d.music)) return null
    let s = this._musicCache.get(d.music)
    if (!s) { s = MM.sanitizeMusic(d.music); this._musicCache.set(d.music, s) }
    return s
  }
  _soundOf (instId) {
    if (!instId) return undefined
    try { const d = this._data(instId); return d && isObj(d.sound) ? sanitizeSound(d.sound) : undefined } catch (_) { return undefined }
  }
  _instrumentExists (instId) {
    try { const d = this._data(instId); return !!(d && isObj(d.sound) && d.sound.enabled !== false) } catch (_) { return false }
  }
  _pickNode (id) {
    if (id && this._songOf(id)) return id
    if (this._sess) return this._sess.nodeId
    if (this._lastNodeId && this._songOf(this._lastNodeId)) return this._lastNodeId
    try { for (const d of this._lookup.getAllNodes?.() ?? []) if (d?.nodeKind === SM.KIND_SONG && this._songOf(d.id)) return d.id } catch (_) { /* none */ }
    return null
  }
  _loadAssets () {
    if (this.assets || this._assetsState === 'loading' || this._assetsState === 'missing') return
    this._assetsState = 'loading'
    let p
    try { p = import('../utils/OmniAudioAssets.js') } catch (_) { p = Promise.reject(_) }
    p.then((m) => {
      const a = [m?.AudioAssets, m?.default, m].find(x => x && typeof x.playClip === 'function')
      if (a) { if (!this.assets) this.assets = a; this._assetsState = 'ready' } else this._assetsState = 'missing'
    }).catch(() => { this._assetsState = 'missing' })
  }

  // ── Transport ───────────────────────────────────────────────────────────────

  _request (d) {
    const action = d?.action
    const id = typeof d?.nodeId === 'string' ? d.nodeId : null
    let r
    if (action === 'play') r = this.play(id, { fromBar: d?.bar })
    else if (action === 'stop') r = this.stop(id)
    else if (action === 'pause') r = this.pause(id)
    else if (action === 'seek') r = this.seek(id ?? this._pickNode(null), d?.bar)
    else if (action === 'toggle' || action === undefined) r = this._sess && (!id || id === this._sess.nodeId) ? this.stop() : this.play(id, { fromBar: d?.bar })
    else r = { ok: false, error: 'Unknown action.' }
    if (d && typeof d === 'object') d.out = r
    if (r && r.ok === false && r.error) emit('omni:notify-info', { name: 'Song node', desc: r.error, holdMs: 3500 })
    return r
  }

  isPlaying (nodeId = null) { return !!this._sess && (!nodeId || nodeId === this._sess.nodeId) }

  /** Start playing a song node from `fromBar` (default: where it was stopped by seek / pause, else bar 1). Another playing song is stopped first. */
  play (nodeId = null, opts = {}) {
    const id = this._pickNode(nodeId)
    const got = id ? this._songOf(id) : null
    if (!got) return { ok: false, error: 'There is no song node to play. Create one first.' }
    if (this._sess) this._teardown(this._sess, { announce: true })
    try { this.engine?.unlock?.() } catch (_) { /* the browser may refuse until a gesture */ }
    this._loadAssets()
    const song = got.song
    const end = 1 + song.lengthBars
    const explicit = opts && opts.fromBar !== undefined && opts.fromBar !== null && Number.isFinite(Number(opts.fromBar))
    let from = explicit ? Number(opts.fromBar) : this._resume.get(id)
    if (!Number.isFinite(from)) from = 1
    from = clamp(from, 1, end)
    if (from >= end - 1e-6) from = 1
    if (explicit) this._home.set(id, from)
    const sg = SM.tempoSegments(song)
    const s0 = SM.barToSecondsSeg(sg, from)
    const now = this.now()
    const s = {
      nodeId: id, song, raw: got.raw, segs: sg, startBar: from, anchors: [{ t: now + START_DELAY_S, s: s0, wrap: false }], cursorSec: s0, mid: true, began: false,
      ended: false, endAtEng: 0, endSec: SM.barToSecondsSeg(sg, end), loopCount: 0, used: new Set(), laneUsed: new Map(), lv: new Map(), lvAudio: new Map(),
      graph: null, graphTried: 0, live: [], warn: new Set(), warnArr: [], prefetched: new Set(), laneMap: new Map(), pos: { playing: true, bar: from, seconds: s0, loopCount: 0, warnings: [] },
      levels: { master: 0, lanes: {} }, masterLv: 0, lastRead: 0, hasAudio: false,
    }
    this._indexSong(s)
    this._sess = s; this._lastNodeId = id
    this._announce('play', id)
    this._tick()
    return { ok: true, state: 'play', nodeId: id }
  }

  _indexSong (s) {
    s.laneMap = new Map(s.song.lanes.map(l => [l.id, l]))
    s.hasAudio = s.song.clips.some(c => s.laneMap.get(c.lane)?.kind === 'audio')
  }

  /** Stop. Notes started are released, audio sources stopped, the bus graph faded and disconnected. The next play starts from bar 1 (or the bar of the last explicit play / seek-while-stopped). */
  stop (nodeId = null) {
    const s = this._sess
    if (!s || (nodeId && nodeId !== s.nodeId)) { this._clearTimer(); return { ok: true, state: 'stop' } }
    this._resume.set(s.nodeId, this._home.get(s.nodeId) ?? 1)
    this._teardown(s, { announce: true })
    return { ok: true, state: 'stop' }
  }
  /** Pause: like stop, but a later play() continues from the current bar. */
  pause (nodeId = null) {
    const s = this._sess
    if (!s || (nodeId && nodeId !== s.nodeId)) return { ok: true, state: 'stop' }
    const bar = this._barNow(s, this.now())
    this._resume.set(s.nodeId, bar)
    this._teardown(s, { announce: true, paused: true })
    return { ok: true, state: 'stop', paused: true, bar }
  }
  /** Move the playhead. While playing, sounding notes are released and the scheduler restarts from the new bar; while stopped, play() starts there. */
  seek (nodeId, bar) {
    const s = this._sess
    const b = Number(bar)
    if (!Number.isFinite(b)) return { ok: false, error: 'Bad bar.' }
    if (!s || nodeId !== s.nodeId) {
      if (!nodeId || !this._songOf(nodeId)) return { ok: false, error: 'There is no such song node.' }
      this._resume.set(nodeId, Math.max(1, b)); this._home.set(nodeId, Math.max(1, b)); return { ok: true, bar: Math.max(1, b) }
    }
    const to = clamp(b, 1, 1 + s.song.lengthBars)
    this._silence(s, this.now())
    const now = this.now(); const s0 = SM.barToSecondsSeg(s.segs, to)
    s.anchors = [{ t: now + 0.03, s: s0, wrap: false }]; s.cursorSec = s0; s.mid = true; s.ended = false; s.began = false
    this._tick()
    return { ok: true, bar: to }
  }
  /** Swap in a new version of the song while playing (mixer, tempo, clips); with no `song` the node's data.song is re-read. The position is kept. */
  update (nodeId, song) {
    const s = this._sess; if (!s || s.nodeId !== nodeId) return false
    if (song === undefined) { const got = this._songOf(nodeId); if (!got) { this.stop(nodeId); return false } s.raw = got.raw; this._adopt(s, got.song) } else this._adopt(s, SM.sanitizeSong(song))
    this._tick()
    return true
  }

  _teardown (s, o = {}) {
    this._clearTimer()
    if (this._sess === s) this._sess = null
    const now = this.now()
    this._silence(s, now, true)
    if (s.graph) this._disposeGraph(s.graph)
    s.graph = null
    if (o.announce) this._announce('stop', s.nodeId, o.paused)
  }
  /** Release every note and stop every audio source of a session (seek / pause / stop). */
  _silence (s, now, final = false) {
    for (const i of s.used) { try { this.engine?.allNotesOff?.(i) } catch (_) { /* ignore */ } }
    s.used.clear(); s.laneUsed.clear()
    for (const l of s.live) {
      const stopIt = (h) => { try { h?.stop?.(now + 0.01) } catch (_) { /* ignore */ } }
      try { if (l.h && typeof l.h.then === 'function') l.h.then(stopIt, () => {}); else stopIt(l.h) } catch (_) { /* ignore */ }
    }
    s.live.length = 0
    void final
  }
  _announce (state, nodeId, paused) {
    const d = { state, nodeId }; if (paused) d.paused = true
    emit('omni:song-transport', d)
  }

  // ── Position + levels (cheap, polled by the panel every frame) ──────────────

  _prune (s, now) {
    const a = s.anchors
    while (a.length > 1 && a[1].t <= now) { if (a[1].wrap) s.loopCount++; a.shift() }
  }
  _secNow (s, now) { this._prune(s, now); const a = s.anchors[0]; return now <= a.t ? a.s : a.s + (now - a.t) }
  _barNow (s, now) { return Math.min(1 + s.song.lengthBars, SM.secondsToBarSeg(s.segs, this._secNow(s, now))) }

  getPosition (nodeId = null) {
    const s = this._sess
    if (!s || (nodeId && nodeId !== s.nodeId)) {
      const idle = this._idle
      const id = nodeId ?? this._lastNodeId
      const bar = (id && this._resume.get(id)) || 1
      idle.playing = false; idle.bar = bar; idle.loopCount = 0
      const got = id ? this._songOf(id) : null
      idle.seconds = got ? SM.barToSeconds(got.song, bar) : 0
      return idle
    }
    const now = this.now(); const sec = this._secNow(s, now)
    const p = s.pos
    p.playing = true; p.seconds = sec; p.bar = Math.min(1 + s.song.lengthBars, SM.secondsToBarSeg(s.segs, sec)); p.loopCount = s.loopCount; p.warnings = s.warnArr
    return p
  }

  /** Peak levels 0..1 (the same object every call: do not keep it). Audio lanes: AnalyserNode peaks; pattern lanes: the last scheduled note decaying. */
  getLevels (nodeId = null) {
    const s = this._sess
    if (!s || (nodeId && nodeId !== s.nodeId)) return EMPTY_LEVELS
    const now = this.now(); const dt = Math.max(0, now - s.lastRead); s.lastRead = now
    const keep = Math.exp(-dt / METER_DECAY_S)
    const out = s.levels; let master = 0
    for (const lane of s.song.lanes) {
      let v = 0
      if (lane.kind === 'audio') {
        const b = s.graph?.lanes.get(lane.id)
        const peak = b ? this._peak(s.graph, b.an) : 0
        v = Math.max(peak, (s.lvAudio.get(lane.id) ?? 0) * keep); s.lvAudio.set(lane.id, v)
      } else {
        const list = s.lv.get(lane.id)
        if (list) for (let i = 0; i < list.length; i++) { const e = list[i]; if (e.t <= now) { const x = e.v * Math.exp(-(now - e.t) / PATTERN_METER_S); if (x > v) v = x } }
      }
      v = clamp(v, 0, 1); out.lanes[lane.id] = v
      if (v > master) master = v
    }
    if (s.graph) master = Math.max(master, this._peak(s.graph, s.graph.an))
    s.masterLv = Math.max(master, s.masterLv * keep)
    out.master = clamp(s.masterLv, 0, 1)
    return out
  }
  _peak (g, an) {
    try {
      if (!an || typeof an.getFloatTimeDomainData !== 'function') return 0
      const buf = g.buf ?? (g.buf = new Float32Array(an.fftSize || 256))
      if (buf.length !== (an.fftSize || 256)) return 0
      an.getFloatTimeDomainData(buf)
      let p = 0; for (let i = 0; i < buf.length; i++) { const x = buf[i] < 0 ? -buf[i] : buf[i]; if (x > p) p = x }
      return p
    } catch (_) { return 0 }
  }

  // ── Scheduler ───────────────────────────────────────────────────────────────

  _clearTimer () { if (this._timer != null) { try { this._timers.clear(this._timer) } catch (_) { /* ignore */ } this._timer = null } }
  _arm () { if (this._timer == null) this._timer = this._timers.set(() => { this._timer = null; this._tick() }, TICK_MS) }
  /** One scheduler pass (public: tests call it after moving the fake clock). */
  tick () { this._tick() }
  _lookahead () { try { return typeof document !== 'undefined' && document.hidden ? HIDDEN_LOOKAHEAD_S : LOOKAHEAD_S } catch (_) { return LOOKAHEAD_S } }
  _warn (s, key, text) { if (!s.warn.has(key)) { s.warn.add(key); s.warnArr = [...s.warnArr, text] } }

  /** The loop range of a session in song seconds, or null (off / bad). */
  _loopRange (s) {
    const lp = s.song.loop
    if (!lp.on) return null
    const sBar = lp.startBar; const eBar = Math.min(lp.endBar, 1 + s.song.lengthBars)
    if (!(eBar > sBar + 1e-6)) return null
    return { startSec: SM.barToSecondsSeg(s.segs, sBar), endSec: SM.barToSecondsSeg(s.segs, eBar) }
  }

  _tick () {
    this._clearTimer()
    const s = this._sess; if (!s) return
    const now = this.now()
    // the node's data changed (or vanished)?
    const got = this._songOf(s.nodeId)
    if (!got) { this.stop(s.nodeId); return }
    if (got.raw !== s.raw) { s.raw = got.raw; this._adopt(s, got.song) }
    this._prune(s, now)
    // the audio library is still loading and the song needs it: hold the start (nothing was scheduled yet)
    if (s.hasAudio && this._assetsState === 'loading' && !s.began) { s.anchors[0].t = now + START_DELAY_S; this._arm(); return }
    if (s.hasAudio && !s.graph) this._ensureGraph(s)
    const horizonEng = now + this._lookahead()
    let sent = 0
    if (!s.ended) {
      for (let guard = 0; guard < 16; guard++) {
        const a = s.anchors[s.anchors.length - 1]
        const horizonSec = a.s + (horizonEng - a.t)
        if (s.cursorSec >= horizonSec - 1e-9 && !(s.cursorSec >= s.endSec && !this._loopRange(s))) break
        const lo = this._loopRange(s)
        const inLoop = !!lo && s.cursorSec < lo.endSec - 1e-9
        let endSec = horizonSec; let wrap = false; let fin = false
        if (inLoop && lo.endSec <= horizonSec) { endSec = lo.endSec; wrap = true } else if (!inLoop && s.endSec <= horizonSec) { endSec = Math.max(s.cursorSec, s.endSec); fin = true }
        const cap = inLoop ? lo.endSec : s.endSec
        if (endSec > s.cursorSec) { sent += this._schedule(s, a, s.cursorSec, endSec, cap, now); s.began = true }
        s.cursorSec = endSec
        if (wrap) { s.anchors.push({ t: a.t + (lo.endSec - a.s), s: lo.startSec, wrap: true }); s.cursorSec = lo.startSec; s.mid = true; continue }
        if (fin) { s.ended = true; s.endAtEng = a.t + (s.endSec - a.s); break }
      }
    }
    this._applyMixer(s, now)
    this._pruneLive(s, now)
    if (s.ended && now >= s.endAtEng + END_TAIL_S) { this.stop(s.nodeId); return }
    this._arm()
    void sent
  }

  _pruneLive (s, now) { if (s.live.length > 64) s.live = s.live.filter(l => l.endT > now - 0.5) }

  /** Swap in a new sanitized song while playing: keep the position (a bar), re-map the anchors through the new tempo map, cut lanes that became silent. */
  _adopt (s, song) {
    const now = this.now()
    const old = s.song
    const oldSg = s.segs
    this._prune(s, now)
    const a0 = s.anchors[0]
    const nowBar = SM.secondsToBarSeg(oldSg, now <= a0.t ? a0.s : a0.s + (now - a0.t))
    const cursorBar = SM.secondsToBarSeg(oldSg, s.cursorSec)
    // pattern lanes that became inaudible stop sounding at once
    for (const l of song.lanes) {
      const was = old.lanes.find(x => x.id === l.id)
      if (l.kind === 'pattern' && was && SM.laneAudible(old, was) && !SM.laneAudible(song, l)) { for (const i of s.laneUsed.get(l.id) ?? []) { try { this.engine?.allNotesOff?.(i) } catch (_) { /* ignore */ } } s.laneUsed.delete(l.id) }
    }
    s.song = song; s.segs = SM.tempoSegments(song)
    s.endSec = SM.barToSecondsSeg(s.segs, 1 + song.lengthBars)
    this._indexSong(s)
    const pendingLoopStart = this._loopRange(s)?.startSec
    const keep = s.anchors.slice(1).map(x => ({ t: x.t, s: x.wrap && pendingLoopStart !== undefined ? pendingLoopStart : x.s, wrap: x.wrap }))
    const wasFuture = now <= a0.t
    s.anchors = [{ t: wasFuture ? a0.t : now, s: SM.barToSecondsSeg(s.segs, nowBar), wrap: a0.wrap }, ...keep]
    s.cursorSec = SM.barToSecondsSeg(s.segs, cursorBar)
    if (s.cursorSec < s.endSec - 1e-6) s.ended = false
    if (s.graph) this._syncLaneBuses(s)
    for (const k of s.lv.keys()) if (!s.laneMap.has(k)) s.lv.delete(k)
    for (const k of Object.keys(s.levels.lanes)) if (!s.laneMap.has(k)) delete s.levels.lanes[k]
  }

  // ── Scheduling one window ───────────────────────────────────────────────────

  _schedule (s, a, secA, secB, capSec, now) {
    const sg = s.segs; const song = s.song
    const barA = SM.secondsToBarSeg(sg, secA); const barB = SM.secondsToBarSeg(sg, secB)
    const mid = s.mid; s.mid = false
    const budget = { n: 0 }
    for (const clip of song.clips) {
      const lane = s.laneMap.get(clip.lane); if (!lane) continue
      const end = clip.startBar + clip.lengthBars
      if (end <= barA + EPS_BAR || clip.startBar >= barB - EPS_BAR) { if (!(lane.kind === 'audio' && mid && clip.startBar < barA && end > barA)) continue }
      if (lane.kind === 'pattern') this._schedPattern(s, a, clip, lane, barA, barB, capSec, now, budget)
      else this._schedAudio(s, a, clip, lane, barA, barB, capSec, now, mid)
      if (budget.n >= MAX_EVENTS_PER_TICK) break
    }
    return budget.n
  }

  _indexOf (track, total) {
    let c = this._idxCache.get(track)
    if (!c || c.total !== total) { c = { total, idx: MM.indexTrack(track, total) }; this._idxCache.set(track, c) }
    return c.idx
  }

  /** value of a mixer param at `bar`: the automation if there is one, else the fader. */
  _val (s, target, param, bar, fallback) { const v = SM.automationValueAt(s.song, target, param, bar); return v === null ? fallback : v }

  _schedPattern (s, a, clip, lane, barA, barB, capSec, now, budget) {
    const song = s.song; const sg = s.segs
    if (!SM.laneAudible(song, lane)) return
    const m = this._music(clip.ref.id)
    if (!m) { this._warn(s, 'pat:' + clip.ref.id, `A pattern clip points to a music node that no longer exists (${clip.ref.id}); it is skipped.`); return }
    const bpb = sg.bpb; const sb = MM.stepBeats(m); const Ptot = MM.totalSteps(m); const P = Ptot * sb
    if (!(P > 0) || Ptot < 1) return
    const sw = m.swing
    const offB = clip.offset * bpb
    const endB = Math.min(offB + clip.lengthBars * bpb, clip.repeat * P)
    let wA = offB + (barA - clip.startBar) * bpb; let wB = offB + (barB - clip.startBar) * bpb
    if (wA < offB) wA = offB
    if (wB > endB) wB = endB
    if (!(wB > wA)) return
    const audible = m.tracks.filter(t => MM.trackAudible(m, t))
    if (!audible.length) return
    const tileLo = Math.max(0, Math.floor((wA - 2 * sb) / P)); const tileHi = Math.min(clip.repeat - 1, Math.floor((wB + 2 * sb) / P))
    const capWhen = a.t + (capSec - a.s)
    const endWhen = a.t + (SM.barToSecondsSeg(sg, clip.startBar + (endB - offB) / bpb) - a.s)
    for (let tile = tileLo; tile <= tileHi; tile++) {
      const base = tile * P
      const kLo = Math.max(0, Math.floor((wA - base) / sb) - 2); const kHi = Math.min(Ptot - 1, Math.ceil((wB - base) / sb) + 2)
      for (let k = kLo; k <= kHi; k++) {
        const stepBeat = k * sb + ((k & 1) ? sw * sb : 0)
        for (const tr of audible) {
          const list = this._indexOf(tr, Ptot)[k]
          if (!list) continue
          for (const ev of list) {
            let eb = stepBeat + ev.offset * sb
            if (tile === 0 && eb < 0) eb = 0
            const stream = base + eb
            if (stream < wA - EPS_BEATS || stream >= wB - EPS_BEATS) continue
            if (budget.n >= MAX_EVENTS_PER_TICK) return
            if (ev.prob < 1 && this._rng() >= ev.prob) continue
            const barPos = clip.startBar + (stream - offB) / bpb
            const when0 = a.t + (SM.barToSecondsSeg(sg, barPos) - a.s)
            if (when0 < now - LATE_SKIP_S) continue
            const when = Math.max(now, when0)
            const gate = ev.gate * sb * 60 / SM.bpmAtSeg(sg, barPos)
            const dur = Math.max(0.02, Math.min(gate, endWhen - when, capWhen - when))
            const gainLane = this._val(s, lane.id, 'volume', barPos, lane.volume)
            const gainMaster = this._val(s, 'master', 'volume', barPos, song.master.gain)
            const velocity = clamp(ev.velocity * tr.volume * m.gain * gainLane * clip.gain * gainMaster, 0, 1)
            if (velocity < 0.01) continue
            const inst = tr.instrumentNodeId && this._instrumentExists(tr.instrumentNodeId) ? tr.instrumentNodeId : null
            const id = inst ?? clip.ref.id
            const o = { velocity, when, duration: dur, pan: clamp(tr.pan + this._val(s, lane.id, 'pan', barPos, lane.pan), -1, 1) }
            const sound = inst ? this._soundOf(inst) : undefined
            if (sound) o.sound = sound
            if (!s.used.has(id)) {
              s.used.add(id)
              let cap = 0; try { cap = this.engine?.getVoiceCap?.() ?? 0 } catch (_) { cap = 0 }
              if (cap > 0 && s.used.size > cap) this._warn(s, 'voicecap', `This song uses ${s.used.size} instruments but the sound engine voice cap is ${cap}: the oldest instruments are cut. Raise the voice cap in the sound settings.`)
            }
            let set = s.laneUsed.get(lane.id); if (!set) s.laneUsed.set(lane.id, set = new Set()); set.add(id)
            try { if (this.engine && typeof this.engine.playNote === 'function') this.engine.playNote(id, clamp(ev.midi + tr.transpose + clip.transpose, 0, 127), o) } catch (_) { /* a failing engine never stops the clock */ }
            let lv = s.lv.get(lane.id); if (!lv) s.lv.set(lane.id, lv = [])
            if (lv.length >= 24) lv.shift()
            lv.push({ t: when, v: velocity })
            budget.n++
          }
        }
      }
    }
  }

  _schedAudio (s, a, clip, lane, barA, barB, capSec, now, mid) {
    const sg = s.segs
    const assets = this.assets
    if (!assets) {
      if (this._assetsState === 'missing' || this._assetsState === 'idle') this._warn(s, 'noassets', 'Audio clips are skipped: the audio library (utils/OmniAudioAssets.js) is not available.')
      return
    }
    const ctx = this._ctx()
    const g = s.graph
    if (!ctx || !g) { this._warn(s, 'noctx', 'Audio clips are skipped: the audio engine is not running yet (click Enable sound, then play again).'); return }
    const bus = this._laneBus(s, lane.id); if (!bus) return
    const startsHere = clip.startBar >= barA - EPS_BAR && clip.startBar < barB - EPS_BAR
    const partial = !startsHere && mid && clip.startBar < barA && clip.startBar + clip.lengthBars > barA
    if (!startsHere && !partial) return
    const from = partial ? barA : clip.startBar
    const t0 = SM.barToSecondsSeg(sg, from)
    let when = a.t + (t0 - a.s)
    const bpmStart = SM.bpmAtSeg(sg, clip.startBar)
    let offsetSec = clip.offset * sg.bpb * 60 / bpmStart + (partial ? t0 - SM.barToSecondsSeg(sg, clip.startBar) : 0)
    let dur = SM.barToSecondsSeg(sg, Math.min(clip.startBar + clip.lengthBars, 1 + s.song.lengthBars)) - t0
    dur = Math.min(dur, capSec - t0)
    if (when < now) { const late = now - when; if (late > dur) return; when = now; offsetSec += late; dur -= late }
    if (!(dur > 0.005)) return
    const fadeIn = partial ? 0 : clip.fadeIn
    try {
      const h = assets.playClip(ctx, clip.ref.id, { when, offset: offsetSec, duration: dur, gain: clip.gain, fadeIn, fadeOut: clip.fadeOut, rate: 1, dest: bus.in })
      s.live.push({ h, endT: when + dur })
      if (h && typeof h.then === 'function') h.then(null, () => this._warn(s, 'au:' + clip.ref.id, `The audio clip ${clip.ref.id} could not be played (missing or undecodable).`))
      if (h === null || h === undefined) this._warn(s, 'au:' + clip.ref.id, `The audio clip ${clip.ref.id} could not be played (missing or undecodable).`)
    } catch (_) { this._warn(s, 'au:' + clip.ref.id, `The audio clip ${clip.ref.id} could not be played (missing or undecodable).`) }
  }

  /** Warm the buffer cache of the library for every audio clip (so the first note of a clip is not late). */
  _prefetch (s, ctx) {
    const a = this.assets; if (!a || typeof a.getBuffer !== 'function') return
    for (const c of s.song.clips) {
      if (c.ref.type !== 'audio' || s.prefetched.has(c.ref.id)) continue
      s.prefetched.add(c.ref.id)
      try { Promise.resolve(a.getBuffer(ctx, c.ref.id)).then(b => { if (!b) this._warn(s, 'au:' + c.ref.id, `The audio clip ${c.ref.id} is missing from the library.`) }, () => this._warn(s, 'au:' + c.ref.id, `The audio clip ${c.ref.id} could not be decoded.`)) } catch (_) { /* ignore */ }
    }
  }

  // ── Buses ───────────────────────────────────────────────────────────────────

  _ensureGraph (s) {
    if (s.graph) return s.graph
    const ctx = this._ctx(); if (!ctx) { this._warn(s, 'noctx', 'Audio clips are skipped: the audio engine is not running yet (click Enable sound, then play again).'); return null }
    if (s.graphTried > 3) return null
    s.graphTried++
    try {
      const g = { ctx, nodes: [], lanes: new Map(), cache: {}, buf: null }
      const mk = (n) => { g.nodes.push(n); return n }
      g.in = mk(ctx.createGain()); g.filter = mk(ctx.createBiquadFilter()); g.filter.type = 'lowpass'; g.filter.frequency.value = 20000
      g.pan = mk(ctx.createStereoPanner()); g.comp = mk(ctx.createDynamicsCompressor()); g.an = mk(ctx.createAnalyser()); g.an.fftSize = 512
      g.comp.knee.value = 0; g.comp.attack.value = 0.003; g.comp.release.value = 0.1
      g.in.connect(g.filter); g.filter.connect(g.pan); g.pan.connect(g.comp); g.comp.connect(g.an)
      let dest = null
      try { dest = this.engine?._master?.gain ?? null } catch (_) { dest = null }
      g.an.connect(dest || ctx.destination)
      // send FX: reverb (convolution of a generated impulse) and a feedback delay; both return into the master input
      g.revIn = mk(ctx.createGain()); g.conv = mk(ctx.createConvolver()); g.revRet = mk(ctx.createGain())
      g.revIn.connect(g.conv); g.conv.connect(g.revRet); g.revRet.connect(g.in)
      g.delIn = mk(ctx.createGain()); g.delay = mk(ctx.createDelay(2.5)); g.fb = mk(ctx.createGain()); g.tone = mk(ctx.createBiquadFilter()); g.tone.type = 'lowpass'; g.tone.frequency.value = 4500; g.delRet = mk(ctx.createGain())
      g.delIn.connect(g.delay); g.delay.connect(g.tone); g.tone.connect(g.fb); g.fb.connect(g.delay); g.tone.connect(g.delRet); g.delRet.connect(g.in)
      s.graph = g
      this._syncLaneBuses(s)
      this._prefetch(s, ctx)
      return g
    } catch (e) {
      this._warn(s, 'graph', 'The mixer buses could not be built: ' + (e && e.message ? e.message : 'unknown error') + '.')
      return null
    }
  }

  /** Create the bus of an audio lane (on demand), or null. */
  _laneBus (s, laneId) {
    const g = s.graph; if (!g) return null
    let b = g.lanes.get(laneId); if (b) return b
    const lane = s.laneMap.get(laneId); if (!lane || lane.kind !== 'audio') return null
    const ctx = g.ctx
    const nodes = []
    const mk = (n) => { nodes.push(n); g.nodes.push(n); return n }
    b = { id: laneId, nodes, cache: {} }
    b.in = mk(ctx.createGain()); b.filter = mk(ctx.createBiquadFilter()); b.filter.type = 'lowpass'; b.filter.frequency.value = 20000; b.pan = mk(ctx.createStereoPanner())
    b.an = mk(ctx.createAnalyser()); b.an.fftSize = 512; b.sendRev = mk(ctx.createGain()); b.sendDel = mk(ctx.createGain())
    b.in.connect(b.filter); b.filter.connect(b.pan); b.pan.connect(g.in); b.pan.connect(b.an); b.pan.connect(b.sendRev); b.sendRev.connect(g.revIn); b.pan.connect(b.sendDel); b.sendDel.connect(g.delIn)
    g.lanes.set(laneId, b)
    return b
  }
  _syncLaneBuses (s) {
    const g = s.graph; if (!g) return
    for (const l of s.song.lanes) if (l.kind === 'audio') this._laneBus(s, l.id)
    for (const [id, b] of [...g.lanes]) {
      const lane = s.laneMap.get(id)
      if (lane && lane.kind === 'audio') continue
      for (const n of b.nodes) { try { n.disconnect() } catch (_) { /* ignore */ } }
      g.lanes.delete(id); s.lvAudio.delete(id)
    }
  }
  _set (holder, key, param, v, t) {
    if (!param) return
    const c = holder.cache[key]
    if (c !== undefined && Math.abs(c - v) < 1e-4) return
    holder.cache[key] = v
    try {
      if (c === undefined) { param.value = v; return }
      if (typeof param.setTargetAtTime === 'function') param.setTargetAtTime(v, t, 0.015); else param.value = v
    } catch (_) { /* ignore */ }
  }
  /** Push the mixer state (faders, mute / solo, pan, filter, sends, master, limiter, FX) into the buses; automation is evaluated at the bar being scheduled. */
  _applyMixer (s, now) {
    const g = s.graph; if (!g) return
    const song = s.song; const m = song.master; const ctx = g.ctx
    let t = now; try { t = ctx.currentTime } catch (_) { /* keep engine time */ }
    const bar = SM.secondsToBarSeg(s.segs, this._secNow(s, now) + 0.05)
    const fHz = (f) => (f >= 0.999 ? 20000 : 80 * Math.pow(18000 / 80, clamp(f, 0, 1)))
    for (const [id, b] of g.lanes) {
      const lane = s.laneMap.get(id); if (!lane) continue
      const aud = SM.laneAudible(song, lane)
      this._set(b, 'gain', b.in.gain, aud ? this._val(s, id, 'volume', bar, lane.volume) : 0, t)
      this._set(b, 'pan', b.pan.pan, clamp(this._val(s, id, 'pan', bar, lane.pan), -1, 1), t)
      this._set(b, 'filter', b.filter.frequency, fHz(this._val(s, id, 'filter', bar, 1)), t)
      this._set(b, 'rev', b.sendRev.gain, this._val(s, id, 'sendReverb', bar, lane.sends.reverb), t)
      this._set(b, 'del', b.sendDel.gain, this._val(s, id, 'sendDelay', bar, lane.sends.delay), t)
    }
    this._set(g, 'gain', g.in.gain, this._val(s, 'master', 'volume', bar, m.gain), t)
    this._set(g, 'pan', g.pan.pan, clamp(this._val(s, 'master', 'pan', bar, 0), -1, 1), t)
    this._set(g, 'filter', g.filter.frequency, fHz(this._val(s, 'master', 'filter', bar, 1)), t)
    this._set(g, 'thr', g.comp.threshold, m.limiter ? m.limiterThresholdDb : 0, t)
    this._set(g, 'ratio', g.comp.ratio, m.limiter ? 20 : 1, t)
    this._set(g, 'revmix', g.revRet.gain, m.reverb.mix, t)
    this._set(g, 'delmix', g.delRet.gain, m.delay.mix, t)
    this._set(g, 'dtime', g.delay.delayTime, m.delay.time, t)
    this._set(g, 'dfb', g.fb.gain, m.delay.feedback, t)
    if (g.cache.size === undefined || Math.abs(g.cache.size - m.reverb.size) > 0.02) {
      g.cache.size = m.reverb.size
      try { g.conv.buffer = makeImpulse(ctx, 0.5 + m.reverb.size * 3.5, m.reverb.size, 0.5) } catch (_) { this._warn(s, 'ir', 'The reverb impulse could not be generated.') }
    }
  }

  _disposeGraph (g) {
    try { const t = g.ctx.currentTime; g.in.gain.cancelScheduledValues?.(t); g.in.gain.setTargetAtTime(0, t, 0.01) } catch (_) { /* ignore */ }
    this._disposing.add(g)
    g.timer = this._timers.set(() => { this._finishDispose(g) }, DISPOSE_MS)
  }
  _finishDispose (g) {
    if (!this._disposing.delete(g)) return
    for (const n of g.nodes) { try { n.disconnect() } catch (_) { /* ignore */ } }
    g.nodes.length = 0; g.lanes.clear()
  }
  /** Disconnect the buses of finished songs now (tests / destroy). */
  flushDisposals () { for (const g of [...this._disposing]) this._finishDispose(g) }
  /** The bus graph of the playing song (tests / debugging): { master, lanes:Map } or null. */
  getGraph (nodeId = null) { const s = this._sess; return s && (!nodeId || nodeId === s.nodeId) ? s.graph : null }
}

export const SongPlayer = new OmniSongPlayer()

/** Scene module: wires the singleton to the node registry and the events. */
export class OmniSongPlayerScene {
  constructor (context = null, omniNode = null) { this.ctx = context; this.omniNode = omniNode; this._inited = 0 }
  init () {
    this._inited++
    if (this._inited > 1) return
    SongPlayer.attach(this.omniNode)
    SongPlayer.init()
  }
  update () { SongPlayer.frame() }
  onResize () {}
  destroy () {
    if (!this._inited) return
    SongPlayer.destroy()
    SongPlayer.attach(null)
    this._inited = 0
  }
}

export default SongPlayer
