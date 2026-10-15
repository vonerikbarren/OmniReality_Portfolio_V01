/**
 * systems/OmniMixEngine.js (V201) — the AUDIO of an OmniMusicMixNode: plays a mix (utils/OmniMixModel.js) through a bus graph.
 *
 *   per strip   source -> strip.in (fader x crossfader x mute / solo) -> low shelf 250 Hz -> mid peak 1 kHz -> high shelf 4 kHz -> low-pass (filter) -> StereoPanner -> strip.out
 *               strip.out -> master.in, and -> send gains -> reverb / delay returns -> master.in;  strip.out -> AnalyserNode (level)
 *   master      master.in (gain) -> DynamicsCompressor (limiter) -> AnalyserNode -> the sound engine's master gain (so the global master volume and mute still apply)
 *
 * Sources (strip.source.type):
 *   'sound'  a SoundNode: engine.start(id, sound) and the engine router (key 'mix') sends that voice into the strip.
 *   'audio'  an audio-library clip: AudioAssets.playClip into the strip; looped by scheduling the next copy a little before the last one ends (rate = tempo sync).
 *   'song'   a SongNode: SongPlayer.play(id) with SongPlayer.setOutput sending the song's whole output into the strip. The SongPlayer plays ONE song at a time, so only the
 *            first 'song' strip sounds; the others are reported in warnings.
 *
 * One mix plays at a time. The clock is the engine's (ctx.currentTime); the mix time t = seconds since play (or since the seek point). Every tick (50 ms) the automation is
 * evaluated at t (applyAutomation) and pushed into the graph with short smoothing; edits arrive through update(mix) and take effect at once.
 * Dependencies are injected so the module is testable without a browser: { engine (SoundEngine), songPlayer, assets, timers, getSound(id) }.
 * Never throws out of its public methods: a failing part adds a warning and the rest keeps playing.
 * Events: window 'omni:mix-transport' { state:'play'|'stop', nodeId }.
 */

import * as X from '../utils/OmniMixModel.js'
import * as D from '../utils/OmniDeckMath.js'
import { stretchAsync } from '../utils/OmniTimeStretch.js'

const TICK_MS = 50
const SMOOTH = 0.015
const KEY = 'mix'
const STRETCH_MAX_S = 600         // longest clip the key lock will process (memory: a stretched copy is kept)
const STRETCH_STALE = 0.012      // re-stretch when the wanted rate differs from the stretched one by more than 1.2 %
const STRETCH_SETTLE_S = 0.35    // ... after the pitch fader has been still this long
const KEYLOCK_MIN = 0.004        // below this rate change key lock does nothing (no audible pitch shift)
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const emit = (name, detail) => { try { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(name, { detail })) } catch (_) { /* ignore */ } }

function makeImpulse (ctx, seconds, decay) {
  const n = Math.max(1, Math.floor(ctx.sampleRate * clamp(seconds, 0.2, 4)))
  const buf = ctx.createBuffer(2, n, ctx.sampleRate)
  for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay) }
  return buf
}

export class OmniMixEngine {
  constructor (deps = {}) {
    this.engine = deps.engine ?? null
    this.songPlayer = deps.songPlayer ?? null
    this.assets = deps.assets ?? null
    this.timers = deps.timers ?? { set: (f, ms) => setInterval(f, ms), clear: (h) => clearInterval(h) }
    this.getSound = deps.getSound ?? (() => null)
    this.yieldFn = deps.yieldFn ?? (() => new Promise(r => setTimeout(r, 0)))
    this._s = null          // the session
  }

  /** Set or replace dependencies (the scene module calls this once the singletons exist). */
  configure (deps = {}) {
    for (const k of ['engine', 'songPlayer', 'assets', 'timers', 'getSound', 'yieldFn']) if (deps[k] !== undefined) this[k] = deps[k]
    return this
  }

  // ── public ──────────────────────────────────────────────────────────────────────────────────────────────────────────
  isPlaying (nodeId = null) { return !!this._s && (!nodeId || this._s.nodeId === nodeId) }
  getWarnings () { return this._s ? [...this._s.warn] : [] }
  getGraph () { return this._s?.graph ?? null }
  now () { try { return this.engine?.getContext?.()?.currentTime ?? this._s?.fallbackNow ?? 0 } catch (_) { return 0 } }

  /** Position of the mix: { playing, t } (seconds). */
  getPosition () {
    const s = this._s; if (!s) return { playing: false, t: 0 }
    return { playing: true, t: Math.max(0, this.now() - s.t0 + s.from) }
  }
  /** Peak levels 0..1: { master, strips:{[id]:0..1} } — the same object every call. */
  getLevels () {
    const s = this._s; const o = s?.levels ?? EMPTY
    if (!s || !s.graph) return o
    const peak = (an) => { try { an.getFloatTimeDomainData(s.buf); let m = 0; for (let i = 0; i < s.buf.length; i++) { const a = Math.abs(s.buf[i]); if (a > m) m = a } return m } catch (_) { return 0 } }
    o.master = clamp(peak(s.graph.an), 0, 1)
    for (const [id, st] of s.graph.strips) o.strips[id] = clamp(peak(st.an), 0, 1)
    return o
  }

  /** Start playing a mix from `from` seconds. Another mix is stopped first. Returns { ok, error? }. */
  play (nodeId, mix, opts = {}) {
    try {
      if (this._s) this.stop()
      const ctx = this.engine?.getContext?.() ?? null
      if (!ctx) return { ok: false, error: 'The audio engine is not running yet. Click Enable sound, then play again.' }
      try { this.engine.unlock?.() } catch (_) { /* needs a gesture */ }
      const m = X.sanitizeMix(mix)
      const from = clamp(Number(opts.from) || 0, 0, X.MIX_LIMITS.secondsMax)
      const s = { nodeId, mix: m, ctx, from, t0: ctx.currentTime, graph: null, warn: new Set(), sources: new Map(), timer: null, levels: { master: 0, strips: {} }, buf: new Float32Array(256), cache: new WeakMap(), fallbackNow: 0 }
      this._s = s
      s.graph = this._buildGraph(s)
      if (!s.graph) { this._s = null; return { ok: false, error: 'The mixer could not be built.' } }
      this._installRoutes(s)
      this._apply(s, true)
      this._startSources(s)
      s.timer = this.timers.set(() => this.tick(), TICK_MS)
      emit('omni:mix-transport', { state: 'play', nodeId })
      return { ok: true }
    } catch (e) {
      try { this.stop() } catch (_) { /* ignore */ }
      return { ok: false, error: e && e.message ? e.message : 'play failed' }
    }
  }

  stop () {
    const s = this._s; if (!s) return { ok: true }
    this._s = null
    try { if (s.timer != null) this.timers.clear(s.timer) } catch (_) { /* ignore */ }
    this._stopSources(s)
    try { this.engine?.setRouter?.(null, KEY) } catch (_) { /* ignore */ }
    try { this.songPlayer?.setOutput?.(null) } catch (_) { /* ignore */ }
    const g = s.graph
    if (g) {
      try { const t = s.ctx.currentTime; g.in.gain.cancelScheduledValues?.(t); g.in.gain.setTargetAtTime(0, t, 0.01) } catch (_) { /* ignore */ }
      const fin = () => { for (const n of g.nodes) { try { n.disconnect() } catch (_) { /* ignore */ } } g.nodes.length = 0 }
      try { this.timers.set(fin, 150) } catch (_) { fin() }
    }
    emit('omni:mix-transport', { state: 'stop', nodeId: s.nodeId })
    return { ok: true }
  }

  /** Swap in an edited mix while playing (a changed source list restarts only the strips that changed). */
  update (mix) {
    const s = this._s; if (!s) return false
    const old = s.mix
    s.mix = X.sanitizeMix(mix)
    const g = s.graph
    // build buses for new strips, drop buses of removed ones
    for (const st of s.mix.strips) if (!g.strips.has(st.id)) this._buildStrip(s, st)
    for (const id of [...g.strips.keys()]) if (!s.mix.strips.some(x => x.id === id)) this._dropStrip(s, id)
    for (const id of [...s.sources.keys()]) {
      const a = old.strips.find(x => x.id === id); const b = s.mix.strips.find(x => x.id === id)
      if (!b || !a || a.source.type !== b.source.type || a.source.id !== b.source.id) this._stopSource(s, id)
    }
    this._startSources(s)
    this._apply(s, false)
    this._syncDecks(s)
    return true
  }

  /** Jump the mix clock to `t` seconds (automation follows; looping audio keeps going). */
  seek (t) {
    const s = this._s; if (!s) return false
    s.from = clamp(Number(t) || 0, 0, X.MIX_LIMITS.secondsMax); s.t0 = this.now()
    this._apply(s, false)
    return true
  }

  tick () {
    const s = this._s; if (!s) return
    try { this._apply(s, false); this._syncDecks(s) } catch (_) { /* never stop the clock */ }
  }

  // ── graph ───────────────────────────────────────────────────────────────────────────────────────────────────────────
  _buildGraph (s) {
    const ctx = s.ctx
    try {
      const g = { nodes: [], strips: new Map(), cache: {} }
      const mk = (n) => { g.nodes.push(n); return n }
      g.in = mk(ctx.createGain()); g.comp = mk(ctx.createDynamicsCompressor()); g.an = mk(ctx.createAnalyser()); g.an.fftSize = 512
      g.comp.knee.value = 0; g.comp.attack.value = 0.003; g.comp.release.value = 0.1
      g.in.connect(g.comp); g.comp.connect(g.an)
      let dest = null
      try { dest = this.engine?._master?.gain ?? null } catch (_) { dest = null }
      g.an.connect(dest || ctx.destination)
      g.revIn = mk(ctx.createGain()); g.conv = mk(ctx.createConvolver()); g.revRet = mk(ctx.createGain())
      g.revIn.connect(g.conv); g.conv.connect(g.revRet); g.revRet.connect(g.in)
      try { g.conv.buffer = makeImpulse(ctx, 1.8, 2.5) } catch (_) { s.warn.add('The reverb impulse could not be generated.') }
      g.delIn = mk(ctx.createGain()); g.delay = mk(ctx.createDelay(2.5)); g.fb = mk(ctx.createGain()); g.tone = mk(ctx.createBiquadFilter()); g.tone.type = 'lowpass'; g.tone.frequency.value = 4500; g.delRet = mk(ctx.createGain())
      g.delay.delayTime.value = 0.375; g.fb.gain.value = 0.35
      g.delIn.connect(g.delay); g.delay.connect(g.tone); g.tone.connect(g.fb); g.fb.connect(g.delay); g.tone.connect(g.delRet); g.delRet.connect(g.in)
      s.graph = g
      for (const st of s.mix.strips) this._buildStrip(s, st)
      return g
    } catch (e) {
      s.warn.add('The mixer could not be built: ' + (e && e.message ? e.message : 'unknown error'))
      return null
    }
  }
  _buildStrip (s, strip) {
    const g = s.graph; const ctx = s.ctx
    const nodes = []; const mk = (n) => { nodes.push(n); g.nodes.push(n); return n }
    const b = { id: strip.id, nodes, cache: {} }
    b.in = mk(ctx.createGain())
    b.low = mk(ctx.createBiquadFilter()); b.low.type = 'lowshelf'; b.low.frequency.value = 250
    b.mid = mk(ctx.createBiquadFilter()); b.mid.type = 'peaking'; b.mid.frequency.value = 1000; b.mid.Q.value = 0.9
    b.high = mk(ctx.createBiquadFilter()); b.high.type = 'highshelf'; b.high.frequency.value = 4000
    b.filter = mk(ctx.createBiquadFilter()); b.filter.type = 'lowpass'; b.filter.frequency.value = 20000
    b.pan = mk(ctx.createStereoPanner())
    b.an = mk(ctx.createAnalyser()); b.an.fftSize = 512
    b.sendRev = mk(ctx.createGain()); b.sendDel = mk(ctx.createGain())
    b.in.connect(b.low); b.low.connect(b.mid); b.mid.connect(b.high); b.high.connect(b.filter); b.filter.connect(b.pan)
    b.pan.connect(g.in); b.pan.connect(b.an); b.pan.connect(b.sendRev); b.sendRev.connect(g.revIn); b.pan.connect(b.sendDel); b.sendDel.connect(g.delIn)
    g.strips.set(strip.id, b)
    return b
  }
  _dropStrip (s, id) {
    const b = s.graph.strips.get(id); if (!b) return
    this._stopSource(s, id)
    for (const n of b.nodes) { try { n.disconnect() } catch (_) { /* ignore */ } }
    s.graph.strips.delete(id)
  }
  _set (holder, key, param, v, t) {
    if (!param) return
    const c = holder.cache[key]
    if (c !== undefined && Math.abs(c - v) < 1e-4) return
    holder.cache[key] = v
    try { if (c === undefined) { param.value = v; return } if (typeof param.setTargetAtTime === 'function') param.setTargetAtTime(v, t, SMOOTH); else param.value = v } catch (_) { /* ignore */ }
  }
  /** Push the mix state at the current mix time into the graph. */
  _apply (s, first) {
    const g = s.graph; if (!g) return
    const t = s.ctx.currentTime
    const mt = Math.max(0, t - s.t0 + s.from)
    const m = X.applyAutomation(s.mix, mt)
    s.at = m
    for (const st of m.strips) {
      const b = g.strips.get(st.id); if (!b) continue
      this._set(b, 'gain', b.in.gain, X.stripGain(m, st), t)
      this._set(b, 'pan', b.pan.pan, clamp(st.pan, -1, 1), t)
      this._set(b, 'filter', b.filter.frequency, X.filterHz(st.filter), t)
      this._set(b, 'low', b.low.gain, X.eqDb(st.eq.low), t)
      this._set(b, 'mid', b.mid.gain, X.eqDb(st.eq.mid), t)
      this._set(b, 'high', b.high.gain, X.eqDb(st.eq.high), t)
      this._set(b, 'rev', b.sendRev.gain, st.sends.reverb, t)
      this._set(b, 'del', b.sendDel.gain, st.sends.delay, t)
    }
    const ms = m.master
    this._set(g, 'gain', g.in.gain, ms.gain * ms.gain, t)
    this._set(g, 'thr', g.comp.threshold, ms.limiter ? ms.limiterThresholdDb : 0, t)
    this._set(g, 'ratio', g.comp.ratio, ms.limiter ? 20 : 1, t)
    this._set(g, 'revmix', g.revRet.gain, ms.reverbMix, t)
    this._set(g, 'delmix', g.delRet.gain, ms.delayMix, t)
    // tempo sync, pitch, loops and key lock of audio decks follow in _syncDecks
    void first
  }

  // ── sources ─────────────────────────────────────────────────────────────────────────────────────────────────────────
  _installRoutes (s) {
    // voices of SoundNodes go into their strip
    if (typeof this.engine?.setRouter === 'function') {
      this.engine.setRouter((id) => {
        const cur = this._s; if (!cur || cur !== s) return null
        const strip = cur.mix.strips.find(x => x.source.type === 'sound' && x.source.id === id)
        return strip ? cur.graph.strips.get(strip.id)?.in ?? null : null
      }, KEY)
    }
    if (typeof this.songPlayer?.setOutput === 'function') {
      this.songPlayer.setOutput((songId) => {
        const cur = this._s; if (!cur || cur !== s) return null
        const strip = cur.mix.strips.find(x => x.source.type === 'song' && x.source.id === songId)
        return strip ? cur.graph.strips.get(strip.id)?.in ?? null : null
      })
    }
  }
  _startSources (s) {
    let songTaken = false
    for (const st of s.mix.strips) {
      if (!st.source.id) continue
      if (st.source.type === 'song') {
        if (songTaken) { s.warn.add(`Strip "${st.name}": only one song can play at a time, so this song strip is silent.`); continue }
        songTaken = true
      }
      if (s.sources.has(st.id)) continue
      try {
        if (st.source.type === 'sound') this._startSound(s, st)
        else if (st.source.type === 'audio') this._startAudio(s, st)
        else if (st.source.type === 'song') this._startSong(s, st)
      } catch (e) { s.warn.add(`Strip "${st.name}" could not start: ${e && e.message ? e.message : 'error'}`) }
    }
  }
  _startSound (s, st) {
    const sound = this.getSound(st.source.id)
    if (!sound) { s.warn.add(`Strip "${st.name}" points to a sound node that no longer exists.`); return }
    this.engine.start(st.source.id, sound)
    s.sources.set(st.id, { type: 'sound', id: st.source.id })
  }
  _startSong (s, st) {
    if (!this.songPlayer || typeof this.songPlayer.play !== 'function') { s.warn.add(`Strip "${st.name}": the song player is not available.`); return }
    const r = this.songPlayer.play(st.source.id)
    if (!r || r.ok === false) { s.warn.add(`Strip "${st.name}": ${r?.error ?? 'the song could not start'}`); return }
    s.sources.set(st.id, { type: 'song', id: st.source.id })
  }
  // ── audio decks (V202) ─────────────────────────────────────────────────────────────────────────────────────────────
  // One native looping AudioBufferSourceNode per audio strip: loops, cue jumps and the pitch fader act at once and never leave a gap.
  // rec.track = { p, t, rate, region } is the playhead: clip time p at context time t, moving at `rate`, wrapping inside `region` ([a, z] or null). The wall clock is the only truth.
  // Key lock: a WSOLA-stretched copy of the clip (utils/OmniTimeStretch.js, made off the main thread's critical path in slices) is played at a residual rate near 1 instead of the plain clip;
  // until it is ready the strip plays at the right TEMPO with a pitch shift, then swaps at the same clip position.
  _startAudio (s, st) {
    if (!this.assets || typeof this.assets.getBuffer !== 'function') { s.warn.add(`Strip "${st.name}": the audio library is not available.`); return }
    const rec = { type: 'audio', id: st.source.id, pending: true, dead: false, voice: null, track: null, buf: null, dur: 0, stretch: null, job: false, rateKey: 0, rateSince: 0, paused: false, ended: false, status: '' }
    s.sources.set(st.id, rec)
    Promise.resolve(this.assets.getBuffer(s.ctx, st.source.id)).then((buf) => {
      if (rec.dead || this._s !== s) return
      if (!buf || !(buf.duration > 0)) { s.warn.add(`Strip "${st.name}": the audio clip is missing or could not be decoded.`); s.sources.delete(st.id); return }
      rec.buf = buf; rec.dur = buf.duration; rec.pending = false
      const cur = s.mix.strips.find(x => x.id === st.id) ?? st
      this._launch(s, cur, rec, 0)
      this._syncDeck(s, cur, rec)
    }, () => { s.warn.add(`Strip "${st.name}": the audio clip could not be loaded.`); s.sources.delete(st.id) })
  }
  /** The region the strip loops in: the loop region when it is on, else the whole clip when the strip loops, else null (play once). */
  _region (st, dur) { return D.loopRegion(st, dur) ?? (st.loop && dur > 0 ? [0, dur] : null) }
  _stripAt (s, id) { return (s.at ?? s.mix).strips.find(x => x.id === id) ?? s.mix.strips.find(x => x.id === id) ?? null }
  _killVoice (s, rec, fade = 0.004) {
    const v = rec.voice; if (!v) return
    rec.voice = null
    const t = s.ctx.currentTime
    try { v.env.gain.cancelScheduledValues?.(t); v.env.gain.setTargetAtTime(0, t, fade) } catch (_) { /* ignore */ }
    try { v.src.stop(t + fade * 8) } catch (_) { /* ignore */ }
    const fin = () => { try { v.src.disconnect() } catch (_) { /* ignore */ } try { v.env.disconnect() } catch (_) { /* ignore */ } }
    try { this.timers.set(fin, 120) } catch (_) { fin() }
  }
  /** (Re)start the deck's voice at clip time `pos` (cue jumps, hot cues, mode changes). */
  _launch (s, st, rec, pos) {
    const bus = s.graph?.strips.get(st.id); if (!bus || !rec.buf || rec.dead) return
    const ctx = s.ctx; const now = ctx.currentTime
    this._killVoice(s, rec)
    const rate = X.deckRateOf(s.at ?? s.mix, st)
    const sx = rec.stretch && st.keyLock && Math.abs(rate - 1) > KEYLOCK_MIN && Math.abs(rate / rec.stretch.r0 - 1) <= 0.05 ? rec.stretch : null
    const buf = sx ? sx.buf : rec.buf; const r0 = sx ? sx.r0 : 1
    const region = this._region(st, rec.dur)
    let p = Math.min(Math.max(0, Number(pos) || 0), Math.max(0, rec.dur - 0.001))
    if (region && p >= region[1]) p = region[0]
    const src = ctx.createBufferSource(); src.buffer = buf
    src.loop = !!region
    if (region) { src.loopStart = region[0] / r0; src.loopEnd = region[1] / r0 }
    src.playbackRate.value = rate / r0
    const env = ctx.createGain()
    try { env.gain.setValueAtTime(0, now); env.gain.linearRampToValueAtTime(1, now + 0.004) } catch (_) { /* ignore */ }
    src.connect(env); env.connect(bus.in)
    src.onended = () => { try { src.disconnect() } catch (_) { /* ignore */ } try { env.disconnect() } catch (_) { /* ignore */ } }
    src.start(now, Math.min(p / r0, Math.max(0, buf.duration - 0.001)))
    rec.voice = { src, env, r0, region, stretched: !!sx }
    rec.track = { p, t: now, rate, region }
    rec.ended = false; rec.paused = false
  }
  /** Bring every deck in line with the strip (rate, loop, key lock) — called every tick and after each edit. */
  _syncDecks (s) {
    for (const [id, rec] of s.sources) {
      if (rec.type !== 'audio' || rec.dead || rec.pending || !rec.buf) continue
      const st = this._stripAt(s, id); if (!st) continue
      try { this._syncDeck(s, st, rec) } catch (e) { s.warn.add(`Strip "${st.name}": the deck failed (${e && e.message ? e.message : 'error'}).`) }
    }
  }
  _checkpoint (s, rec) {
    const tr = rec.track; if (!tr) return
    const now = s.ctx.currentTime
    if (rec.voice && !rec.paused && !rec.ended) {
      const a = D.advance(tr.p, now - tr.t, tr.rate, tr.region, rec.dur)
      tr.p = a.pos; if (a.ended) rec.ended = true
    }
    tr.t = now
  }
  _syncDeck (s, st, rec) {
    const now = s.ctx.currentTime
    this._checkpoint(s, rec)
    const rate = X.deckRateOf(s.at ?? s.mix, st)
    const region = this._region(st, rec.dur)
    const wantLock = !!st.keyLock && Math.abs(rate - 1) > KEYLOCK_MIN
    if (!wantLock && rec.stretch && !rec.voice?.stretched) rec.stretch = null          // key lock off: free the stretched copy
    if (rec.paused || !rec.voice) { if (rec.track) { rec.track.rate = rate; rec.track.region = region } this._maybeStretch(s, st, rec, rate, wantLock, now); return }
    const v = rec.voice; const tr = rec.track
    const usable = rec.stretch && Math.abs(rate / rec.stretch.r0 - 1) <= 0.05
    const needSwap = wantLock ? (usable && !v.stretched) : v.stretched
    const sameRegion = (a, b) => (a === null && b === null) || (!!a && !!b && Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6)
    if (rec.ended && !region) { this._maybeStretch(s, st, rec, rate, wantLock, now); return }
    const outside = !!region && tr.p >= region[1]
    if (needSwap || outside || (rec.ended && region)) { this._launch(s, st, rec, outside ? region[0] : tr.p); this._maybeStretch(s, st, rec, rate, wantLock, now); return }
    if (!sameRegion(v.region, region)) {
      try { v.src.loop = !!region; if (region) { v.src.loopStart = region[0] / v.r0; v.src.loopEnd = region[1] / v.r0 } } catch (_) { /* ignore */ }
      v.region = region; tr.region = region
    }
    if (Math.abs(tr.rate - rate) > 1e-5) {
      try { v.src.playbackRate.setTargetAtTime(rate / v.r0, now, 0.01) } catch (_) { /* ignore */ }
      tr.rate = rate
    }
    this._maybeStretch(s, st, rec, rate, wantLock, now)
  }
  _maybeStretch (s, st, rec, rate, wantLock, now) {
    if (!wantLock) { rec.rateKey = 0; return }
    const key = Math.round(rate * 1000)
    if (rec.rateKey !== key) { rec.rateKey = key; rec.rateSince = now }            // the rate just moved (a fader drag): wait until it holds still
    if (rec.job) return
    const fresh = rec.stretch && Math.abs(rate / rec.stretch.r0 - 1) <= STRETCH_STALE
    if (fresh) { rec.status = ''; return }
    if (now - (rec.rateSince ?? now) < STRETCH_SETTLE_S) return
    this._requestStretch(s, st, rec, rate)
  }
  _requestStretch (s, st, rec, rate) {
    const buf = rec.buf
    if (rec.dur > STRETCH_MAX_S) { if (!rec.warnedLong) { rec.warnedLong = true; s.warn.add(`Strip "${st.name}": key lock works on clips up to ${STRETCH_MAX_S / 60} minutes; this one plays with a pitch shift.`) } return }
    if (!buf || typeof buf.getChannelData !== 'function' || !(buf.numberOfChannels >= 1)) return
    const chans = []; for (let i = 0; i < Math.min(8, buf.numberOfChannels); i++) chans.push(buf.getChannelData(i))
    rec.job = true; rec.status = 'preparing'
    stretchAsync(chans, buf.sampleRate, rate, { yieldFn: this.yieldFn, cancelled: () => rec.dead || this._s !== s }).then((res) => {
      rec.job = false
      if (!res || rec.dead || this._s !== s) return
      const len = res[0]?.length ?? 0; if (!(len > 0)) return
      const out = s.ctx.createBuffer(res.length, len, buf.sampleRate)
      for (let i = 0; i < res.length; i++) out.getChannelData(i).set(res[i])
      rec.stretch = { r0: buf.length / len, forRate: rate, buf: out }
      rec.status = ''
      const cur = this._stripAt(s, st.id); if (cur) this._syncDeck(s, cur, rec)
    }).catch((e) => { rec.job = false; rec.status = ''; s.warn.add(`Strip "${st.name}": key lock failed (${e && e.message ? e.message : 'error'}).`) })
  }

  // ── deck controls ───────────────────────────────────────────────────────────────────────────────────────────────────
  _deckRec (stripId) { const s = this._s; const rec = s?.sources.get(stripId); return s && rec && rec.type === 'audio' && !rec.dead && !rec.pending && rec.buf ? { s, rec } : null }
  /** The state of a deck: { pos, dur, rate, ended, paused, keyLock: 'off'|'preparing'|'on', region } or null when the strip is not a playing audio deck. */
  getDeck (stripId) {
    const d = this._deckRec(stripId); if (!d) return null
    const { s, rec } = d; const tr = rec.track; const st = this._stripAt(s, stripId)
    const now = s.ctx.currentTime
    let pos = tr ? tr.p : 0; let ended = rec.ended
    if (tr && rec.voice && !rec.paused && !rec.ended) { const a = D.advance(tr.p, now - tr.t, tr.rate, tr.region, rec.dur); pos = a.pos; ended = a.ended }
    return { pos, dur: rec.dur, rate: tr ? tr.rate : 1, ended, paused: rec.paused, region: tr?.region ?? null, keyLock: !st?.keyLock || Math.abs(tr?.rate - 1) <= KEYLOCK_MIN ? 'off' : rec.voice?.stretched ? 'on' : 'preparing' }
  }
  /** Jump a deck to clip time `pos` and keep playing (a paused deck only moves its playhead). */
  jump (stripId, pos) {
    const d = this._deckRec(stripId); if (!d) return { ok: false, error: 'That strip is not playing an audio clip.' }
    const { s, rec } = d; const st = this._stripAt(s, stripId); if (!st) return { ok: false, error: 'No such strip.' }
    const p = Math.min(Math.max(0, Number(pos) || 0), Math.max(0, rec.dur - 0.001))
    if (rec.paused) { rec.track = { ...(rec.track ?? {}), p, t: s.ctx.currentTime, rate: rec.track?.rate ?? 1, region: rec.track?.region ?? null }; rec.ended = false; return { ok: true } }
    this._launch(s, st, rec, p); return { ok: true }
  }
  pauseDeck (stripId) {
    const d = this._deckRec(stripId); if (!d) return { ok: false, error: 'That strip is not playing an audio clip.' }
    const { s, rec } = d; if (rec.paused) return { ok: true }
    this._checkpoint(s, rec); this._killVoice(s, rec); rec.paused = true; return { ok: true }
  }
  resumeDeck (stripId) {
    const d = this._deckRec(stripId); if (!d) return { ok: false, error: 'That strip is not playing an audio clip.' }
    const { s, rec } = d; const st = this._stripAt(s, stripId); if (!st) return { ok: false, error: 'No such strip.' }
    if (!rec.paused && !rec.ended) return { ok: true }
    this._launch(s, st, rec, rec.ended ? 0 : rec.track?.p ?? 0); return { ok: true }
  }
  _stopSource (s, id) {
    const rec = s.sources.get(id); if (!rec) return
    s.sources.delete(id)
    try {
      if (rec.type === 'sound') this.engine?.stop?.(rec.id)
      else if (rec.type === 'song') this.songPlayer?.stop?.(rec.id)
      else if (rec.type === 'audio') { rec.dead = true; this._killVoice(s, rec) }
    } catch (_) { /* ignore */ }
  }
  _stopSources (s) { for (const id of [...s.sources.keys()]) this._stopSource(s, id) }
}

const EMPTY = Object.freeze({ master: 0, strips: Object.freeze({}) })

export const MixEngine = new OmniMixEngine()
export default MixEngine
