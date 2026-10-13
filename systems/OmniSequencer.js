/**
 * systems/OmniSequencer.js — the TRANSPORT and the lookahead SCHEDULER of the MusicNode's step sequencer (V195). Module { init, update(delta), destroy, onResize }.
 *
 * What it does
 *   - plays the pattern of ONE music node at a time (starting another stops the first): each step event goes to SoundEngine.playNote(instrumentNodeId, midi,
 *     { sound, velocity, when, duration, pan }) where instrumentNodeId is the track's SoundNode (its data.sound is the instrument) or, for the default soft sine,
 *     the music node itself. The engine clock is the ONLY clock: a setTimeout every ~25 ms schedules everything that falls in the next 100 ms (1.5 s while the tab
 *     is hidden, the browser slows hidden timers) against SoundEngine.now(). Every time is computed from ONE anchor (engine time <-> beat), so there is no drift;
 *     a tempo change re-anchors at "now" and takes effect from the next scheduled step; swing, step length, mutes, notes and instruments are read live each tick.
 *   - METRONOME (quarter-note click, accent on the bar) and COUNT-IN (0..4 bars of clicks before a recording starts).
 *   - RECORD from the InputBus (sources keys / midi / touch / pad; never 'seq'): LIVE record (during playback, after the count-in; times are converted with
 *     recordPosition: quantize on/off + resolution), STEP record (each note-on writes the next step and advances; notes within 60 ms are one chord; rest / back),
 *     overdub (default; off = the armed track is cleared when the take starts). One take = ONE undo step (store.pushUndo before it). The ARMED track gets the events;
 *     the stored pitch is the played pitch minus the track's transpose, so playback sounds exactly like what was played.
 *   - requests: omni:music-transport-request { action:'toggle'|'play'|'stop'|'record', nodeId?, mode? }  (Enter / Cmd+Enter of the Expression typing mode send it).
 *   - events out: omni:music-transport { state:'play'|'stop'|'record', nodeId, countIn, mode }  and, when a note is AUDIBLE (not when it is scheduled):
 *     omni:music-step { nodeId, trackId, step, midi, velocity } for the visuals ONLY. The sequencer does NOT put its notes on the InputBus: the live instrument
 *     (systems of agent 1) plays bus notes, so a bus echo would sound twice. Use this event, never the bus, to show what the sequencer plays.
 *   - stops everything (and releases the notes it started) on stop, node deletion, scene clear and destroy.
 *
 * The data is read and written through a STORE ({ getMusic(id) -> sanitized music | null, commit(id, music, reason), pushUndo(id), undoDepth(id), undo(id) }):
 * systems/OmniMusicNodes.js provides it (Extra.SERVICES.music); tests pass their own. Everything degrades: no engine / no playNote / no store never throws.
 * Headless: opts { engine, bus, store, timers:{set,clear}, rng } let a test drive the fake engine clock by hand and call tick().
 * USER-facing module: it imports no Dev* module.
 */

import SoundEngine from './OmniSoundEngine.js'
import * as InputBus from '../utils/OmniInputBus.js'
import * as MM from '../utils/OmniMusicModel.js'
import { defaultSound, sanitizeSound } from '../utils/OmniSoundModel.js'
import { SERVICES, KIND_MUSIC } from '../utils/OmniExtraKinds.js'

export const TICK_MS = 25
export const LOOKAHEAD_S = 0.1
export const HIDDEN_LOOKAHEAD_S = 1.5
export const START_DELAY_S = 0.08
export const CHORD_WINDOW_S = 0.06
export const METRO_ID = '__omni_metronome'
export const REC_SOURCES = Object.freeze(['keys', 'midi', 'touch', 'pad'])
const MAX_EVENTS_PER_TICK = 256
const LATE_SKIP_S = 0.12

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v)
const emit = (name, detail) => { try { if (typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') window.dispatchEvent(new CustomEvent(name, { detail })) } catch (_) { /* no window */ } }
let CLICK_SOUND = null
const clickSound = () => (CLICK_SOUND ??= (() => { try { return sanitizeSound({ ...defaultSound(), enabled: true, waveform: 'square', attack: 0.001, hold: 0, decay: 0.03, sustainLevel: 0, release: 0.02, dynamic: 'mf', gainDb: -6 }) } catch (_) { return undefined } })())

export default class OmniSequencer {
  constructor (context = null, omniNode = null, opts = {}) {
    this.ctx = context
    this.omniNode = omniNode
    this.opts = opts || {}
    this.engine = this.opts.engine ?? SoundEngine
    this.bus = this.opts.bus ?? InputBus
    this._rng = typeof this.opts.rng === 'function' ? this.opts.rng : Math.random
    this._timers = this.opts.timers ?? { set: (f, ms) => setTimeout(f, ms), clear: (h) => clearTimeout(h) }
    this._inited = 0
    this._bound = []
    this._unsub = null
    this._timer = null
    this._state = 'stop'          // 'stop' | 'play' | 'record'
    this._mode = 'live'           // record mode: 'live' | 'step'
    this._nodeId = null
    this._lastNodeId = null
    this._selectedId = null
    this._countingIn = false
    this._t0 = 0; this._b0 = 0; this._beatSec = 0.5; this._sb = 0.25
    this._nextA = 0; this._nextClick = 0
    this._endAt = 0
    this._ended = false
    this._vis = []                // [{ t, detail }] note echoes waiting for their audible time
    this._idx = new WeakMap()     // track -> { total, idx }
    this._armed = new Map()       // nodeId -> trackId
    this._held = new Map()        // midi -> { trackId, step, midi, pos0 }
    this._take = null             // { nodeId, trackId, depth, notes }
    this._lastTake = null
    this._cursor = 0              // step-record cursor
    this._lastOn = -1e9           // step-record chord window
    this._used = new Set()        // instrument ids started since the transport began (released on stop)
    this._fallback = null
  }

  // ── Module contract ─────────────────────────────────────────────────────────

  init () {
    this._inited++
    if (this._inited > 1) return   // BaseScene.addModule() calls init(); a second call must not double the listeners
    const on = (name, fn) => { const h = (e) => fn(e.detail ?? {}, e); window.addEventListener(name, h); this._bound.push([name, h]) }
    on('omni:music-transport-request', (d) => this._request(d))
    on('omni:node-deleted', (d) => { if (d.id === this._nodeId) this.stop(); this._armed.delete(d.id); if (this._lastNodeId === d.id) this._lastNodeId = null })
    on('omni:node-selected', (d) => { this._selectedId = d.node?.id ?? null })
    on('omni:node-deselected', () => { this._selectedId = null })
    on('omni:scene-clear-request', () => this.stop())
    try { this._unsub = this.bus.subscribe((e) => this._onBus(e)) } catch (_) { this._unsub = null }
    SERVICES.sequencer = this
  }

  update () {
    if (this._vis.length) this._flushVis(this.now())
    // a throttled / killed timer must not leave a running transport silent
    if (this._state !== 'stop' && !this._stepOnly() && !this._timer) this._arm()
  }

  onResize () {}

  destroy () {
    if (!this._inited) return
    this.stop({ silent: true })
    this._bound.forEach(([n, h]) => window.removeEventListener(n, h))
    this._bound = []
    try { this._unsub?.() } catch (_) { /* ignore */ }
    this._unsub = null
    this._armed.clear(); this._held.clear(); this._vis.length = 0
    if (SERVICES.sequencer === this) SERVICES.sequencer = null
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

  /** The store: the one given, else the MusicNodes runtime, else a minimal reader of the node data (no undo). */
  _store () {
    if (this.opts.store) return this.opts.store
    if (SERVICES.music) return SERVICES.music
    if (this._fallback) return this._fallback
    const on = this.omniNode; const cache = new WeakMap()
    this._fallback = {
      getMusic: (id) => { const d = on?.getNodeData?.(id); if (!d || d.nodeKind !== KIND_MUSIC) return null; if (!d.music || typeof d.music !== 'object') d.music = MM.defaultMusic(); let s = cache.get(d.music); if (!s) { s = MM.sanitizeMusic(d.music); cache.set(d.music, s) }; return s },
      commit: (id, music) => { const d = on?.getNodeData?.(id); if (!d) return false; d.music = MM.sanitizeMusic(music); emit('omni:music-data-changed', { nodeId: id, reason: 'record' }); return true },
      pushUndo: () => {}, undoDepth: () => 0, undo: () => ({ ok: false }),
    }
    return this._fallback
  }
  _music (id) { try { return this._store().getMusic(id ?? this._nodeId) } catch (_) { return null } }

  _beatsAt (t) { return this._b0 + (t - this._t0) / this._beatSec }
  _timeOf (b) { return this._t0 + (b - this._b0) * this._beatSec }

  // ── State (allocation free; polled by the panel / the node mesh every frame) ──

  get state () { return this._state }
  get nodeId () { return this._nodeId }
  get isPlaying () { return this._state !== 'stop' && !this._stepOnly() }
  get isRecording () { return this._state === 'record' }
  get countingIn () { return this._countingIn }
  get mode () { return this._mode }
  _stepOnly () { return this._state === 'record' && this._mode === 'step' }

  /** Position in STEPS from the start of the pattern (negative during the count-in, not wrapped); step recording: the cursor. NaN when stopped. */
  getPosition () {
    if (this._state === 'stop') return NaN
    if (this._stepOnly()) return this._cursor
    return this._beatsAt(this.now()) / this._sb
  }
  /** The step being played now (0..total-1), or -1 when stopped / counting in. Step recording: the cursor. */
  currentStep (nodeId = null) {
    if (this._state === 'stop' || (nodeId && nodeId !== this._nodeId)) return -1
    if (this._stepOnly()) return this._cursor
    const m = this._music(); if (!m) return -1
    const pos = this._beatsAt(this.now()) / this._sb
    if (pos < 0) return -1
    const total = MM.totalSteps(m)
    if (!m.loop && pos >= total) return total - 1
    return Math.floor(pos) % total
  }
  getState () {
    return { state: this._state, nodeId: this._nodeId, mode: this._mode, countingIn: this._countingIn, step: this.currentStep(), position: this.getPosition(), armedTrackId: this.armedTrack(this._nodeId), cursor: this._cursor }
  }

  // ── Armed track ─────────────────────────────────────────────────────────────

  armedTrack (nodeId) {
    const m = this._music(nodeId); if (!m || !m.tracks.length) return null
    const a = this._armed.get(nodeId)
    return a && m.tracks.some(t => t.id === a) ? a : m.tracks[0].id
  }
  setArmed (nodeId, trackId) {
    const m = this._music(nodeId); if (!m || !m.tracks.some(t => t.id === trackId)) return false
    this._armed.set(nodeId, trackId); emit('omni:music-armed', { nodeId, trackId }); return true
  }

  // ── Transport ───────────────────────────────────────────────────────────────

  _pickNode (id) {
    const ok = (x) => !!x && !!this._music(x)
    for (const c of [id, this._nodeId, this._selectedId, this._lastNodeId]) if (ok(c)) return c
    try { for (const d of this.omniNode?.getAllNodes?.() ?? []) if (d?.nodeKind === KIND_MUSIC && ok(d.id)) return d.id } catch (_) { /* none */ }
    return null
  }

  _request (d) {
    const action = d?.action
    const id = typeof d?.nodeId === 'string' ? d.nodeId : null
    let r
    if (action === 'play') r = this.play(id)
    else if (action === 'stop') r = this.stop()
    else if (action === 'record') r = this.record(id, { mode: d?.mode })
    else r = this.toggle(id)
    if (d && typeof d === 'object') d.out = r
    if (r && r.ok === false && r.error) emit('omni:notify-info', { name: '♫ Music node', desc: r.error, holdMs: 3500 })
    return r
  }

  toggle (nodeId = null) { return this._state === 'stop' || (nodeId && nodeId !== this._nodeId) ? this.play(nodeId) : this.stop() }

  /** Start playing the pattern of a music node (from the beginning). */
  play (nodeId = null) {
    const id = this._pickNode(nodeId)
    if (!id) return { ok: false, error: 'There is no music node to play. Create one first.' }
    if (this._state !== 'stop') this.stop({ silent: true })
    return this._start(id, false)
  }

  _start (id, record) {
    const m = this._music(id); if (!m) return { ok: false, error: 'That music node no longer exists.' }
    try { this.engine?.unlock?.() } catch (_) { /* the browser may refuse until a gesture */ }
    const spb = MM.stepsPerBar(m); const sb = MM.stepBeats(m)
    const countSteps = record && m.countIn > 0 ? m.countIn * spb : 0
    this._nodeId = id; this._lastNodeId = id
    this._mode = 'live'; this._held.clear(); this._used.clear(); this._ended = false; this._vis.length = 0
    this._beatSec = 60 / m.tempo; this._sb = sb
    this._t0 = this.now() + START_DELAY_S
    this._b0 = -countSteps * sb
    this._nextA = -countSteps
    this._nextClick = Math.ceil(this._b0 - 1e-9)
    this._countingIn = countSteps > 0
    this._state = record ? 'record' : 'play'
    this._announce()
    this._tick()
    return { ok: true, state: this._state, nodeId: id }
  }

  /** Stop. Notes already started are released, queued echoes are dropped, a running take is closed. */
  stop (opts = {}) {
    const was = this._state
    if (was === 'stop') { this._clearTimer(); return { ok: true, state: 'stop' } }
    this._endTake()
    this._clearTimer()
    const id = this._nodeId
    this._state = 'stop'; this._countingIn = false; this._ended = false
    this._vis.length = 0; this._held.clear()
    this._releaseAll(id)
    if (!opts.silent) this._announce(id)
    return { ok: true, state: 'stop' }
  }

  _releaseAll (id) {
    const ids = new Set(this._used)
    for (const i of ids) { try { this.engine?.allNotesOff?.(i) } catch (_) { /* ignore */ } }
    this._used.clear()
    void id
  }

  /**
   * Record. From stopped: starts the transport with the count-in (live) or a step cursor at step 0 (mode 'step'). While playing: punches in at once.
   * While recording: ends the take (live: playback continues; step: the transport stops).
   */
  record (nodeId = null, o = {}) {
    const mode = o?.mode === 'step' ? 'step' : 'live'
    if (this._state === 'record' && (!nodeId || nodeId === this._nodeId)) {
      const wasStep = this._mode === 'step'
      this._endTake()
      if (wasStep) return this.stop()
      this._state = 'play'; this._countingIn = false; this._announce()
      return { ok: true, state: 'play' }
    }
    const id = this._pickNode(nodeId)
    if (!id) return { ok: false, error: 'There is no music node to record into. Create one first.' }
    const m = this._music(id)
    if (!m.tracks.length) return { ok: false, error: 'This music node has no track to record into. Add a track first.' }
    if (this._state !== 'stop' && id !== this._nodeId) this.stop({ silent: true })
    const track = this.armedTrack(id)
    if (this._state === 'play') {   // punch in
      this._beginTake(id, track)
      this._state = 'record'; this._mode = 'live'; this._announce()
      return { ok: true, state: 'record', nodeId: id }
    }
    if (mode === 'step') {
      this._nodeId = id; this._lastNodeId = id; this._mode = 'step'; this._cursor = 0; this._lastOn = -1e9
      this._held.clear(); this._used.clear(); this._vis.length = 0
      this._beginTake(id, track)
      this._state = 'record'; this._countingIn = false
      this._announce()
      return { ok: true, state: 'record', nodeId: id, mode: 'step' }
    }
    const r = this._start(id, true)
    if (r.ok) this._beginTake(id, track)
    return r
  }

  _beginTake (id, trackId) {
    const store = this._store(); const m = this._music(id)
    try { store.pushUndo?.(id) } catch (_) { /* no undo */ }
    let depth = 0; try { depth = store.undoDepth?.(id) ?? 0 } catch (_) { depth = 0 }
    this._take = { nodeId: id, trackId, depth, notes: 0 }
    this._held.clear()
    if (m && m.overdub === false) this._editTrack(id, trackId, (t) => { t.steps = [] }, 'record-clear')
    this._cursor = 0
  }

  _endTake () {
    if (!this._take) return
    // close the notes that are still held: they get the gate they have so far
    for (const h of [...this._held.values()]) this._closeHeld(h)
    this._held.clear()
    this._lastTake = { ...this._take }
    this._take = null
  }

  /** Undo the last recording take (only while nothing else was edited after it). */
  undoTake () {
    const t = this._lastTake; const store = this._store()
    if (!t) return { ok: false, error: 'There is no recording to undo.' }
    let depth = 0; try { depth = store.undoDepth?.(t.nodeId) ?? 0 } catch (_) { depth = 0 }
    if (depth !== t.depth) return { ok: false, error: 'You edited the pattern after recording; use Undo to step back.' }
    const r = store.undo?.(t.nodeId) ?? { ok: false, error: 'Nothing to undo.' }
    if (r.ok) this._lastTake = null
    return r
  }
  get canUndoTake () { return !!this._lastTake }

  // ── Announce ────────────────────────────────────────────────────────────────

  _announce (id = this._nodeId) {
    emit('omni:music-transport', { state: this._state, nodeId: id, countIn: this._countingIn, mode: this._mode })
  }

  // ── Scheduler ───────────────────────────────────────────────────────────────

  _clearTimer () { if (this._timer != null) { try { this._timers.clear(this._timer) } catch (_) { /* ignore */ } this._timer = null } }
  _arm () { if (this._timer == null) this._timer = this._timers.set(() => { this._timer = null; this._tick() }, TICK_MS) }

  /** One scheduler pass (public: tests call it after moving the fake clock). */
  tick () { this._tick() }

  _lookahead () { try { return typeof document !== 'undefined' && document.hidden ? HIDDEN_LOOKAHEAD_S : LOOKAHEAD_S } catch (_) { return LOOKAHEAD_S } }

  _tick () {
    this._clearTimer()
    if (this._state === 'stop' || this._stepOnly()) return
    const m = this._music()
    if (!m) { this.stop(); return }
    const now = this.now()
    // live tempo / step length: re-anchor at now, then the same formulas continue (no jump, no drift)
    const bs = 60 / m.tempo
    if (Math.abs(bs - this._beatSec) > 1e-12) { this._b0 = this._beatsAt(now); this._t0 = now; this._beatSec = bs }
    const sb = MM.stepBeats(m)
    if (sb !== this._sb) { this._sb = sb; this._nextA = Math.ceil(this._beatsAt(now) / sb - 1e-9) }   // the step length changed live: carry on from the next line of the new grid
    const horizon = now + this._lookahead()
    const total = MM.totalSteps(m)
    const dur = sb * this._beatSec
    const sw = m.swing

    // count-in ends when the first real step starts
    if (this._countingIn && this._beatsAt(now) >= 0) { this._countingIn = false; this._announce() }

    // metronome clicks (count-in clicks always sound)
    const endBeats = total * sb
    for (let guard = 0; guard < 64; guard++) {
      const k = this._nextClick
      const t = this._timeOf(k)
      if (t > horizon) break
      if (!m.loop && k >= endBeats) { this._nextClick++; continue }
      if (k < 0 || m.metronome) {
        const barBeats = MM.stepsPerBar(m) * sb; const r = k / barBeats
        this._click(Math.abs(r - Math.round(r)) < 1e-6, Math.max(t, now))
      }
      this._nextClick++
    }

    // step events
    const audible = m.tracks.filter(t => MM.trackAudible(m, t))
    let sent = 0
    for (let guard = 0; guard < 4096; guard++) {
      const a = this._nextA
      if (!m.loop && a >= total) { this._ended = true; this._endAt = this._timeOf(endBeats); break }
      const i = ((a % total) + total) % total
      const baseBeats = a * sb + ((i % 2 === 1) ? sw * sb : 0)
      const tStep = this._timeOf(baseBeats)
      if (tStep - 0.5 * dur > horizon) break
      this._nextA++
      if (a < 0) continue
      if (tStep < now - LATE_SKIP_S) continue   // the page stalled: skip what is long past instead of firing a burst
      for (const tr of audible) {
        const list = this._indexOf(tr, total)[i]
        if (!list) continue
        for (const ev of list) {
          if (sent++ >= MAX_EVENTS_PER_TICK) break
          if (ev.prob < 1 && this._rng() >= ev.prob) continue
          const when = Math.max(now, this._timeOf(baseBeats + ev.offset * sb))
          this._playEvent(m, tr, ev, i, when, dur)
        }
      }
    }
    this._flushVis(now)
    if (this._ended && now >= this._endAt + 0.01) { this.stop(); return }
    this._arm()
  }

  _indexOf (track, total) {
    let c = this._idx.get(track)
    if (!c || c.total !== total) { c = { total, idx: MM.indexTrack(track, total) }; this._idx.set(track, c) }
    return c.idx
  }

  _soundOf (instrumentId) {
    if (!instrumentId) return undefined
    try { const d = this.omniNode?.getNodeData?.(instrumentId); return d && d.sound && typeof d.sound === 'object' ? sanitizeSound(d.sound) : undefined } catch (_) { return undefined }
  }
  _instrumentExists (instrumentId) {
    try { const d = this.omniNode?.getNodeData?.(instrumentId); return !!(d && d.sound && d.sound.enabled !== false) } catch (_) { return false }
  }

  _playEvent (m, tr, ev, step, when, dur) {
    const inst = tr.instrumentNodeId && this._instrumentExists(tr.instrumentNodeId) ? tr.instrumentNodeId : null
    const id = inst ?? this._nodeId
    const midi = clamp(ev.midi + tr.transpose, 0, 127)
    const velocity = clamp(ev.velocity * tr.volume * m.gain, 0.01, 1)
    const o = { velocity, when, duration: Math.max(0.02, ev.gate * dur), pan: tr.pan }
    const sound = inst ? this._soundOf(inst) : undefined
    if (sound) o.sound = sound
    this._used.add(id)
    this._note(id, midi, o)
    this._vis.push({ t: when, detail: { nodeId: this._nodeId, trackId: tr.id, step, midi, velocity: ev.velocity } })
  }

  /** Sound one note of a track right now (the piano roll painting / the track's note picker): { ok }. Uses the track's instrument like playback does. */
  preview (nodeId, trackId, midi, velocity = 0.8, seconds = 0.25) {
    const m = this._music(nodeId); const tr = m && MM.findTrack(m, trackId); if (!tr) return { ok: false }
    const inst = tr.instrumentNodeId && this._instrumentExists(tr.instrumentNodeId) ? tr.instrumentNodeId : null
    const o = { velocity: clamp(velocity * tr.volume * m.gain, 0.01, 1), when: this.now(), duration: clamp(seconds, 0.05, 2), pan: tr.pan }
    const sound = inst ? this._soundOf(inst) : undefined
    if (sound) o.sound = sound
    this._note(inst ?? nodeId, clamp(Math.round(midi) + tr.transpose, 0, 127), o)
    return { ok: true }
  }

  _note (id, midi, o) {
    const e = this.engine
    try { if (e && typeof e.playNote === 'function') e.playNote(id, midi, o) } catch (_) { /* a missing / failing engine never stops the clock */ }
  }

  _click (accent, when) {
    this._used.add(METRO_ID)
    this._note(METRO_ID, accent ? 96 : 88, { sound: clickSound(), velocity: accent ? 0.9 : 0.55, when, duration: 0.03 })
  }

  _flushVis (now) {
    const q = this._vis; if (!q.length) return
    let w = 0
    for (let r = 0; r < q.length; r++) {
      const it = q[r]
      if (it.t <= now + 0.004) emit('omni:music-step', it.detail)
      else q[w++] = it
    }
    q.length = w
  }

  // ── Recording ───────────────────────────────────────────────────────────────

  _onBus (e) {
    try {
      if (this._state !== 'record' || !e || !REC_SOURCES.includes(e.source)) return
      if (e.type === 'noteOn') this._recOn(e)
      else if (e.type === 'noteOff') this._recOff(e)
    } catch (_) { /* a bad event never breaks input */ }
  }

  _editTrack (id, trackId, fn, reason) {
    const store = this._store(); const m = this._music(id); if (!m) return false
    const next = { ...m, tracks: m.tracks.map(t => (t.id === trackId ? { ...t, steps: t.steps.map(s => ({ ...s })) } : t)) }
    const tr = next.tracks.find(t => t.id === trackId); if (!tr) return false
    fn(tr, next)
    try { return store.commit(id, next, reason) !== false } catch (_) { return false }
  }

  _recOn (e) {
    const take = this._take; if (!take) return
    const id = take.nodeId; const m = this._music(id); if (!m) return
    const tid = this.armedTrack(id) ?? take.trackId   // arming another track during a take moves the recording there
    const tr = m.tracks.find(t => t.id === tid); if (!tr) return
    const stored = clamp(Math.round(e.midi) - tr.transpose, 0, 127)
    const velocity = clamp(Number.isFinite(e.velocity) ? e.velocity : 0.8, 0.01, 1)
    const total = MM.totalSteps(m); const sb = MM.stepBeats(m)
    if (this._mode === 'step') {
      const t = this.now()
      let step = this._cursor
      if (t - this._lastOn < CHORD_WINDOW_S) step = ((this._cursor - 1) % total + total) % total   // a chord: the step of the note just written
      else this._cursor = (this._cursor + 1) % total
      this._lastOn = t
      this._editTrack(id, tid, (x) => { MM.upsertEvent(x, { step, midi: stored, velocity, gate: 0.9, prob: 1, offset: 0 }, total) }, 'record')
      take.notes++
      emit('omni:music-recorded', { nodeId: id, trackId: tid, step, midi: stored })
      return
    }
    const pos = this._beatsAt(this.now())
    if (pos < -0.5 * sb) return                 // a note during the count-in is not recorded
    const rp = MM.recordPosition(m, pos, { quantize: m.recordQuantize, resolution: m.recordResolution })
    if (!m.loop && pos >= total * sb) return    // past the end of a non-looping pattern
    const step = rp.step
    this._editTrack(id, tid, (x) => { MM.upsertEvent(x, { step, midi: stored, velocity, gate: 0.9, prob: 1, offset: rp.offset }, total) }, 'record')
    this._held.set(e.midi, { trackId: tid, step, midi: stored, pos0: pos, nodeId: id })
    take.notes++
    emit('omni:music-recorded', { nodeId: id, trackId: tid, step, midi: stored })
  }

  _recOff (e) {
    const h = this._held.get(e.midi); if (!h) return
    this._held.delete(e.midi)
    this._closeHeld(h)
  }

  _closeHeld (h) {
    const m = this._music(h.nodeId); if (!m) return
    const sb = MM.stepBeats(m)
    const gate = clamp(Math.round(((this._beatsAt(this.now()) - h.pos0) / sb) * 1000) / 1000, MM.LIMITS.gateMin, MM.LIMITS.gateMax)
    this._editTrack(h.nodeId, h.trackId, (x) => { const ev = x.steps.find(s => s.step === h.step && s.midi === h.midi); if (ev) ev.gate = gate }, 'record')
  }

  /** Step recording: skip a step (a rest). */
  stepRest () { if (!this._stepOnly()) return false; const m = this._music(); if (!m) return false; this._cursor = (this._cursor + 1) % MM.totalSteps(m); this._lastOn = -1e9; return true }
  /** Step recording: one step back. */
  stepBack () { if (!this._stepOnly()) return false; const m = this._music(); if (!m) return false; const t = MM.totalSteps(m); this._cursor = (this._cursor - 1 + t) % t; this._lastOn = -1e9; return true }
}

export { OmniSequencer }
