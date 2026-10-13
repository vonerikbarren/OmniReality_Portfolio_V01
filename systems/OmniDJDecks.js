/**
 * systems/OmniDJDecks.js (V195) — the audio of the OmniDJ: 6 decks on the OmniMusicPlayer's track library.
 *
 * Per deck:   HTMLAudioElement (one per deck, reused) -> MediaElementAudioSourceNode (created ONCE per element)
 *             -> low shelf 250 Hz -> mid peak 1 kHz -> high shelf 4 kHz -> channel gain (fader, mute)
 *             -> crossfader gain (A / Thru / B) -> master gain -> limiter -> destination;  channel gain -> AnalyserNode (level meter).
 * The graph is SEPARATE from the SoundNode engine's (own gains, nothing is routed into or out of it) and from the OmniMusicPlayer's
 * <audio> elements (OmniMixerPanel plays through the element directly and is not touched). The AudioContext is the engine's shared one
 * when SoundEngine.getContext() has one that is already running (never created or resumed from here), else a context of our own (suspended until a user gesture, resumed by unlock() / play()).
 * Tracks: { slot: 1..15 } = the same IndexedDB library OmniMixerPanel uses (createWallpaperStore('omnimixer-audio', 15)), { url } or a
 * Blob / File. Pure maths (EQ dB, crossfader curves, pitch, sanitizers): utils/OmniDJModel.js.
 * Events: window 'omni:dj-state' { deck, why, state } on load / play / pause / seek-by-user / parameter changes (not per frame; the UI
 * polls getDeck()/getLevel() from its own animation frame). Without any AudioContext (jsdom, very old browsers) the decks still work
 * through the element volume (no EQ, no meters).
 * CPU: analysers use fftSize 256 and are only READ when asked; nothing runs per frame inside this file.
 */

import SoundEngine from './OmniSoundEngine.js'
import { createWallpaperStore } from '../utils/WallpaperStorage.js'
import {
  DECKS, EQ_BANDS, EQ_FREQ, eqDb, volumeGain, channelCrossGain, pitchToRate, rateToPitch, sanitizeState, sanitizeChannel,
  sanitizeTrackRef, cleanName, num, clamp, ASSIGNS, CURVES, RATE_RANGES, LIBRARY_SLOTS,
} from '../utils/OmniDJModel.js'

export const EVENT = 'omni:dj-state'
const SMOOTH = 0.012

/** The SoundEngine's context ONLY when it already exists and is running: never create or resume it from here (that would unlock the SoundNodes' audio). */
function defaultShared () {
  try { const c = typeof SoundEngine.getContext === 'function' ? SoundEngine.getContext() : null; return c && c.state === 'running' ? c : null } catch (_) { return null }
}

export class OmniDJDecks {
  /** opts: { getSharedContext(), AudioContextCtor, createAudio(), store, URL, dispatch(name, detail), useShared:false } — all optional (tests inject fakes). */
  constructor (opts = {}) {
    this.opts = opts
    this._st = sanitizeState(null)
    this._decks = []
    for (let i = 1; i <= DECKS; i++) this._decks.push({ n: i, audio: null, src: null, low: null, mid: null, high: null, chan: null, xf: null, analyser: null, buf: null, objUrl: null, name: '', slot: null, loaded: false, error: '', blocked: false, wantPlay: false, token: 0, scrub: null, off: [] })
    this._subs = new Set()
    this._ctx = null; this._ownCtx = false
    this._master = null; this._limiter = null; this._mAnalyser = null; this._mBuf = null
    this._store = opts.store || null
    this._destroyed = false
    this._unlockFn = null
  }

  get destroyed () { return this._destroyed }
  get context () { return this._ctx }
  get usingSharedContext () { return !!this._ctx && !this._ownCtx }
  get store () { if (!this._store) { try { this._store = createWallpaperStore('omnimixer-audio', LIBRARY_SLOTS) } catch (_) { this._store = null } } return this._store }
  _d (n) { const i = Math.round(num(n, 0)); return i >= 1 && i <= DECKS ? this._decks[i - 1] : null }
  _c (n) { return this._st.channels[Math.round(n) - 1] }

  // ── events ──────────────────────────────────────────────────────────────────────────────────────────────────────────
  on (fn) { if (typeof fn !== 'function') return () => {}; this._subs.add(fn); return () => this._subs.delete(fn) }
  _emit (n, why) {
    if (this._destroyed && why !== 'destroy') return
    const detail = { deck: n, why, state: n ? this.getDeck(n) : null }
    for (const f of [...this._subs]) { try { f(detail) } catch (_) { /* a subscriber must not break the audio */ } }
    try {
      if (typeof this.opts.dispatch === 'function') this.opts.dispatch(EVENT, detail)
      else if (typeof window !== 'undefined' && typeof CustomEvent === 'function') window.dispatchEvent(new CustomEvent(EVENT, { detail }))
    } catch (_) { /* no window */ }
  }

  // ── context / unlock ────────────────────────────────────────────────────────────────────────────────────────────────
  ensureContext () {
    if (this._destroyed) return null
    if (this._ctx && this._ctx.state !== 'closed') return this._ctx
    let c = null; this._ownCtx = false
    if (this.opts.useShared !== false) { try { c = (this.opts.getSharedContext || defaultShared)() } catch (_) { c = null } }
    if (!c || c.state === 'closed') {
      let C = this.opts.AudioContextCtor
      if (C === undefined) { try { C = (typeof window !== 'undefined') ? (window.AudioContext || window.webkitAudioContext) : null } catch (_) { C = null } }
      if (!C) return null
      try { c = new C({ latencyHint: 'interactive' }) } catch (_) { try { c = new C() } catch (e) { return null } }
      this._ownCtx = true
    }
    this._ctx = c
    this._buildMaster()
    return c
  }
  _buildMaster () {
    const c = this._ctx; if (!c || this._master) return
    try {
      this._master = c.createGain()
      this._limiter = typeof c.createDynamicsCompressor === 'function' ? c.createDynamicsCompressor() : null
      if (this._limiter) {
        const L = this._limiter
        try { L.threshold.value = -3; L.knee.value = 0; L.ratio.value = 20; L.attack.value = 0.003; L.release.value = 0.1 } catch (_) { /* old browsers */ }
        this._master.connect(L); L.connect(c.destination)
      } else this._master.connect(c.destination)
      this._mAnalyser = c.createAnalyser(); this._mAnalyser.fftSize = 256; this._mAnalyser.smoothingTimeConstant = 0.2
      this._mBuf = new Float32Array(this._mAnalyser.fftSize)
      ;(this._limiter || this._master).connect(this._mAnalyser)
      this._set(this._master.gain, volumeGain(this._st.master), true)
    } catch (_) { this._master = null; this._mAnalyser = null }
  }
  /** Resume the context (call from a user gesture). Resolves true when audio may play. */
  async unlock () {
    if (this._destroyed) return false
    const c = this.ensureContext()
    if (!c) return true   // no AudioContext: element playback needs no resume
    try { if (c.state !== 'running') await c.resume() } catch (_) { /* still locked */ }
    const ok = c.state === 'running'
    if (ok) this._disarmUnlock()
    return ok
  }
  isRunning () { return !this._ctx ? true : this._ctx.state === 'running' }
  _armUnlock () {
    if (this._unlockFn || typeof document === 'undefined') return
    this._unlockFn = async () => {
      const ok = await this.unlock(); if (!ok) return
      for (const d of this._decks) if (d.wantPlay) { d.wantPlay = false; this.play(d.n) }
    }
    try { for (const ev of ['pointerdown', 'keydown']) document.addEventListener(ev, this._unlockFn, { capture: true, passive: true }) } catch (_) { /* ignore */ }
  }
  _disarmUnlock () {
    if (!this._unlockFn) return
    try { for (const ev of ['pointerdown', 'keydown']) document.removeEventListener(ev, this._unlockFn, { capture: true }) } catch (_) { /* ignore */ }
    this._unlockFn = null
  }

  _set (param, v, immediate) {
    if (!param) return
    try {
      const c = this._ctx
      if (immediate || !c || typeof param.setTargetAtTime !== 'function') param.value = v
      else param.setTargetAtTime(v, c.currentTime, SMOOTH)
    } catch (_) { try { param.value = v } catch (e) { /* ignore */ } }
  }

  // ── graph ───────────────────────────────────────────────────────────────────────────────────────────────────────────
  _ensureAudio (d) {
    if (d.audio) return d.audio
    let a = null
    try { a = this.opts.createAudio ? this.opts.createAudio() : new Audio() } catch (_) { a = null }
    if (!a) return null
    a.preload = 'auto'
    const on = (ev, fn) => { try { a.addEventListener(ev, fn) } catch (_) { return } d.off.push(() => { try { a.removeEventListener(ev, fn) } catch (_) { /* ignore */ } }) }
    on('loadedmetadata', () => this._emit(d.n, 'meta'))
    on('durationchange', () => this._emit(d.n, 'meta'))
    on('ended', () => this._emit(d.n, 'ended'))
    on('play', () => { if (!d.scrub) this._emit(d.n, 'play') })
    on('pause', () => { if (!d.scrub) this._emit(d.n, 'pause') })
    on('error', () => { d.error = 'The track could not be played (format or cross-origin).'; d.loaded = false; this._emit(d.n, 'error') })
    d.audio = a
    return a
  }
  /** Build the per-deck chain ONCE per element. Returns true when the Web Audio chain exists. */
  _ensureGraph (d) {
    if (d.src) return true
    const c = this._ctx; if (!c || !d.audio || !this._master) return false
    try {
      d.src = c.createMediaElementSource(d.audio)
      const bq = (type, f, q) => { const b = c.createBiquadFilter(); b.type = type; b.frequency.value = f; if (q) b.Q.value = q; b.gain.value = 0; return b }
      d.low = bq('lowshelf', EQ_FREQ.low); d.mid = bq('peaking', EQ_FREQ.mid, 0.9); d.high = bq('highshelf', EQ_FREQ.high)
      d.chan = c.createGain(); d.xf = c.createGain()
      d.analyser = c.createAnalyser(); d.analyser.fftSize = 256; d.analyser.smoothingTimeConstant = 0.2
      d.buf = new Float32Array(d.analyser.fftSize)
      d.src.connect(d.low); d.low.connect(d.mid); d.mid.connect(d.high); d.high.connect(d.chan); d.chan.connect(d.xf); d.xf.connect(this._master)
      d.chan.connect(d.analyser)
      try { d.audio.volume = 1 } catch (_) { /* ignore */ }
    } catch (_) { this._dropGraph(d); return false }
    this._applyDeck(d, true)
    return true
  }
  _dropGraph (d) {
    for (const k of ['src', 'low', 'mid', 'high', 'chan', 'xf', 'analyser']) { try { d[k] && d[k].disconnect && d[k].disconnect() } catch (_) { /* ignore */ } d[k] = null }
    d.buf = null
  }
  _applyDeck (d, immediate = false) {
    const ch = this._c(d.n); const st = this._st
    const chan = ch.mute ? 0 : volumeGain(ch.volume)
    const xf = channelCrossGain(ch.assign, st.cross.pos, st.cross.curve)
    if (d.src) {
      this._set(d.chan && d.chan.gain, chan, immediate); this._set(d.xf && d.xf.gain, xf, immediate)
      this._set(d.low && d.low.gain, eqDb(ch.eq.low), immediate); this._set(d.mid && d.mid.gain, eqDb(ch.eq.mid), immediate); this._set(d.high && d.high.gain, eqDb(ch.eq.high), immediate)
    } else if (d.audio) {
      try { d.audio.volume = clamp(chan * xf * volumeGain(st.master), 0, 1) } catch (_) { /* ignore */ }
    }
    if (d.audio) {
      try { d.audio.playbackRate = pitchToRate(ch.pitch, ch.range) } catch (_) { /* ignore */ }
      try { d.audio.preservesPitch = ch.keylock; d.audio.mozPreservesPitch = ch.keylock; d.audio.webkitPreservesPitch = ch.keylock } catch (_) { /* ignore */ }
      try { d.audio.loop = ch.loop } catch (_) { /* ignore */ }
    }
  }
  _applyAll (immediate = false) {
    if (this._master) this._set(this._master.gain, volumeGain(this._st.master), immediate)
    for (const d of this._decks) this._applyDeck(d, immediate)
  }

  // ── load / unload ───────────────────────────────────────────────────────────────────────────────────────────────────
  /** source: { slot } | { url, name? } | Blob / File | { blob, name }. Resolves the deck snapshot, or null (and deck.error says why). */
  async load (n, source) {
    const d = this._d(n); if (!d || this._destroyed) return null
    const token = ++d.token
    let blob = null; let url = null; let name = ''; let slot = null
    d.error = ''
    const isBlob = (b) => !!b && typeof b === 'object' && typeof b.size === 'number' && typeof b.slice === 'function' && typeof b.type === 'string'
    if (isBlob(source)) { blob = source; name = cleanName(source.name) || 'File' } else if (source && typeof source === 'object' && isBlob(source.blob)) { blob = source.blob; name = cleanName(source.name) || 'File' } else {
      const ref = sanitizeTrackRef(source)
      if (!ref) { d.error = 'That is not a track I can load.'; this._emit(n, 'error'); return null }
      if (ref.slot) {
        let rec = null
        try { rec = await this.store.loadWallpaper(ref.slot) } catch (_) { rec = null }
        if (token !== d.token || this._destroyed) return null
        if (!rec || !isBlob(rec.blob)) { d.error = `Library slot ${ref.slot} is empty.`; this._emit(n, 'error'); return null }
        blob = rec.blob; slot = ref.slot; name = cleanName(rec.name) || `Slot ${ref.slot}`
      } else { url = ref.url; name = cleanName(ref.name) || url.split('/').pop().split('?')[0].slice(0, 80) || 'Track' }
    }
    this._clearTrack(d)
    const a = this._ensureAudio(d); if (!a) { d.error = 'No audio element available.'; this._emit(n, 'error'); return null }
    const U = this.opts.URL || (typeof URL !== 'undefined' ? URL : null)
    if (blob) { try { d.objUrl = U.createObjectURL(blob) } catch (_) { d.objUrl = null } if (!d.objUrl) { d.error = 'Could not read the file.'; this._emit(n, 'error'); return null } a.src = d.objUrl } else { try { a.crossOrigin = 'anonymous' } catch (_) { /* ignore */ } a.src = url }
    d.name = name; d.slot = slot; d.loaded = true
    this.ensureContext(); this._ensureGraph(d); this._applyDeck(d, true)
    try { a.load && a.load() } catch (_) { /* ignore */ }
    this._emit(n, 'load')
    return this.getDeck(n)
  }
  _clearTrack (d) {
    d.scrub = null
    if (d.audio) { try { d.audio.pause() } catch (_) { /* ignore */ } }
    if (d.objUrl) { try { (this.opts.URL || URL).revokeObjectURL(d.objUrl) } catch (_) { /* ignore */ } d.objUrl = null }
    d.loaded = false; d.wantPlay = false; d.name = ''; d.slot = null; d.error = ''
  }
  /** Free the deck: stop, drop the source, revoke the object URL (the element and its source node stay for the next load). */
  unload (n) {
    const d = this._d(n); if (!d) return false
    d.token++
    this._clearTrack(d)
    if (d.audio) { try { d.audio.removeAttribute('src'); d.audio.load && d.audio.load() } catch (_) { /* ignore */ } }
    this._c(n).cue = 0
    this._emit(n, 'unload'); return true
  }

  // ── transport ───────────────────────────────────────────────────────────────────────────────────────────────────────
  async play (n) {
    const d = this._d(n); if (!d || !d.loaded || !d.audio || this._destroyed) return false
    this.ensureContext(); this._ensureGraph(d); this._applyDeck(d, true)
    await this.unlock()
    if (this._destroyed || !d.loaded) return false
    if (!this.isRunning()) { d.wantPlay = true; d.blocked = true; this._armUnlock(); this._emit(n, 'blocked'); return false }
    try { const p = d.audio.play(); if (p && typeof p.then === 'function') await p; d.blocked = false; d.wantPlay = false } catch (e) {
      if (e && e.name === 'NotAllowedError') { d.blocked = true; d.wantPlay = true; this._armUnlock(); this._emit(n, 'blocked') } else { d.error = 'Could not start playback.'; this._emit(n, 'error') }
      return false
    }
    this._emit(n, 'play'); return true
  }
  pause (n) { const d = this._d(n); if (!d || !d.audio) return false; d.wantPlay = false; try { d.audio.pause() } catch (_) { /* ignore */ } this._emit(n, 'pause'); return true }
  toggle (n) { return this.isPlaying(n) ? Promise.resolve(this.pause(n)) : this.play(n) }
  isPlaying (n) { const d = this._d(n); return !!(d && d.audio && d.loaded && ((d.scrub && d.scrub.was) || (!d.audio.paused && !d.audio.ended))) }
  /** Jog scrub: hold the audio (silently, no state event) while the wheel is dragged, then carry on if it was playing. */
  scrubBegin (n) {
    const d = this._d(n); if (!d || !d.loaded || !d.audio || d.scrub) return false
    d.scrub = { was: !d.audio.paused && !d.audio.ended }
    if (d.scrub.was) { try { d.audio.pause() } catch (_) { /* ignore */ } }
    return true
  }
  scrubEnd (n) {
    const d = this._d(n); if (!d || !d.scrub) return false
    const was = d.scrub.was; d.scrub = null
    if (was && d.loaded && d.audio) { try { const p = d.audio.play(); if (p && p.catch) p.catch(() => {}) } catch (_) { /* ignore */ } }
    return true
  }
  /** CDJ cue: while playing -> back to the cue point and pause; while paused -> set the cue point here (unless already on it). */
  cue (n) {
    const d = this._d(n); if (!d || !d.loaded || !d.audio) return false
    const c = this._c(n)
    if (this.isPlaying(n)) { this.pause(n); this.seek(n, c.cue) } else if (Math.abs(d.audio.currentTime - c.cue) > 0.05) { c.cue = d.audio.currentTime; this._emit(n, 'cue') }
    return true
  }
  seek (n, sec) {
    const d = this._d(n); if (!d || !d.audio || !d.loaded) return false
    const dur = this.duration(n)
    try { d.audio.currentTime = clamp(num(sec, 0), 0, dur > 0 ? dur : 1e9) } catch (_) { return false }
    return true
  }
  seekFraction (n, f) { const dur = this.duration(n); return dur > 0 ? this.seek(n, clamp(num(f, 0), 0, 1) * dur) : false }
  nudge (n, dSec) { const d = this._d(n); return d && d.audio ? this.seek(n, d.audio.currentTime + num(dSec, 0)) : false }
  time (n) { const d = this._d(n); const t = d && d.audio ? d.audio.currentTime : 0; return Number.isFinite(t) ? t : 0 }
  duration (n) { const d = this._d(n); const t = d && d.audio ? d.audio.duration : 0; return Number.isFinite(t) && t > 0 ? t : 0 }
  stopAll () { for (const d of this._decks) if (d.audio && !d.audio.paused) this.pause(d.n) }

  // ── parameters (each returns the stored value) ──────────────────────────────────────────────────────────────────────
  _chSet (n, key, value, why = 'param') {
    const d = this._d(n); if (!d) return null
    const c = this._c(n); c[key] = value
    this._applyDeck(d); this._emit(n, why)
    return value
  }
  setVolume (n, v) { return this._chSet(n, 'volume', num(v, 0.8, 0, 1)) }
  setEq (n, band, v) {
    if (!EQ_BANDS.includes(band)) return null
    const d = this._d(n); if (!d) return null
    const x = num(v, 0.5, 0, 1); this._c(n).eq[band] = x; this._applyDeck(d); this._emit(n, 'param'); return x
  }
  setMute (n, b) { return this._chSet(n, 'mute', b === true) }
  setAssign (n, a) { return ASSIGNS.includes(a) ? this._chSet(n, 'assign', a) : null }
  setLoop (n, b) { return this._chSet(n, 'loop', b === true) }
  setKeylock (n, b) { return this._chSet(n, 'keylock', b === true) }
  /** Pitch fader -1..1 within the deck's range. */
  setPitch (n, p) { return this._chSet(n, 'pitch', num(p, 0, -1, 1)) }
  setRange (n, r) { const R = num(r, 0.08, 0.01, 1); const v = RATE_RANGES.reduce((b, x) => (Math.abs(x - R) < Math.abs(b - R) ? x : b), RATE_RANGES[0]); return this._chSet(n, 'range', v) }
  /** Set the playback rate directly (keeps the range, moves the pitch fader). */
  setRate (n, rate) { const d = this._d(n); if (!d) return null; return this.setPitch(n, rateToPitch(rate, this._c(n).range)) }
  getRate (n) { const c = this._d(n) && this._c(n); return c ? pitchToRate(c.pitch, c.range) : 1 }
  setCrossfader (pos) { this._st.cross.pos = num(pos, 0, -1, 1); this._applyAll(); this._emit(0, 'cross'); return this._st.cross.pos }
  setCurve (c) { if (!CURVES.includes(c)) return null; this._st.cross.curve = c; this._applyAll(); this._emit(0, 'cross'); return c }
  setMaster (v) { this._st.master = num(v, 0.85, 0, 1); this._applyAll(); this._emit(0, 'master'); return this._st.master }

  // ── reading ─────────────────────────────────────────────────────────────────────────────────────────────────────────
  _rms (an, buf) {
    if (!an || !buf) return 0
    try { an.getFloatTimeDomainData(buf) } catch (_) { return 0 }
    let s = 0; for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i]
    return Math.sqrt(s / buf.length)
  }
  /** RMS 0..1 of the channel after its EQ and fader (before the crossfader). 0 when there is no graph. */
  getLevel (n) { const d = this._d(n); return d ? this._rms(d.analyser, d.buf) : 0 }
  getMasterLevel () { return this._rms(this._mAnalyser, this._mBuf) }
  getDeck (n) {
    const d = this._d(n); if (!d) return null
    const c = this._c(n); const a = d.audio
    return {
      n: d.n, loaded: d.loaded, name: d.name, slot: d.slot, error: d.error, blocked: d.blocked,
      playing: this.isPlaying(n), time: this.time(n), duration: this.duration(n), rate: this.getRate(n),
      volume: c.volume, eq: { ...c.eq }, mute: c.mute, assign: c.assign, pitch: c.pitch, range: c.range, loop: c.loop, keylock: c.keylock, cue: c.cue,
      graph: !!d.src, ended: !!(a && a.ended),
    }
  }
  getState () { return { v: 1, master: this._st.master, cross: { ...this._st.cross }, running: this.isRunning(), shared: this.usingSharedContext, decks: this._decks.map(d => this.getDeck(d.n)) } }
  /** Apply a (possibly hostile) saved mixer state: every value is sanitized. */
  applyState (raw) {
    const s = sanitizeState(raw)
    const keep = this._st.channels.map(c => c.cue)
    this._st = s; s.channels.forEach((c, i) => { c.cue = keep[i] })
    this._applyAll(); this._emit(0, 'state'); return this.getState()
  }
  resetChannel (n) { const d = this._d(n); if (!d) return false; const cue = this._c(n).cue; this._st.channels[d.n - 1] = { ...sanitizeChannel(null), cue }; this._applyDeck(d); this._emit(n, 'param'); return true }
  /** Internal access for tests / meters: the Web Audio nodes of a deck. */
  _nodes (n) { const d = this._d(n); return d ? { audio: d.audio, src: d.src, low: d.low, mid: d.mid, high: d.high, chan: d.chan, xf: d.xf, analyser: d.analyser } : null }
  _masterNodes () { return { master: this._master, limiter: this._limiter, analyser: this._mAnalyser } }

  // ── end of life ─────────────────────────────────────────────────────────────────────────────────────────────────────
  destroy () {
    if (this._destroyed) return
    for (const d of this._decks) {
      d.token++
      this._clearTrack(d)
      for (const f of d.off) f(); d.off = []
      if (d.audio) { try { d.audio.removeAttribute('src'); d.audio.load && d.audio.load() } catch (_) { /* ignore */ } }
      this._dropGraph(d); d.audio = null
    }
    try { this._master && this._master.disconnect() } catch (_) { /* ignore */ }
    try { this._limiter && this._limiter.disconnect() } catch (_) { /* ignore */ }
    try { this._mAnalyser && this._mAnalyser.disconnect() } catch (_) { /* ignore */ }
    this._master = this._limiter = this._mAnalyser = null
    if (this._ctx && this._ownCtx) { try { this._ctx.close && this._ctx.close() } catch (_) { /* ignore */ } }
    this._ctx = null
    this._disarmUnlock()
    this._emit(0, 'destroy')
    this._subs.clear(); this._destroyed = true
  }
}

let shared = null
/** The one OmniDJ audio instance of the app (the quadrant content and the OmniDJ window share it, so a track keeps playing when you switch views). */
export function getDJDecks (opts) { if (!shared || shared.destroyed) shared = new OmniDJDecks(opts); return shared }
export function resetDJDecks () { if (shared) { shared.destroy(); shared = null } }
export default getDJDecks
