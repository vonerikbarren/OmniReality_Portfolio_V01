/**
 * systems/OmniSoundEngine.js — the Web Audio engine of the SoundNode (V194). Singleton default export `SoundEngine` (class also exported).
 * Design + every setting explained in docs/architecture/OMNISOUND_ENGINE_DESIGN.md. Contract: docs/architecture/OMNISOUND_CONTRACT.md.
 *
 * Per node ONE voice:  notes (source -> filter -> ADSR) -> inputBus -> dynamics/crescendo -> tremolo -> drift -> fade -> FX chain
 *                      -> width -> pan -> [analyser tap] -> [PannerNode -> air filter] -> voice out -> master -> limiter -> master analyser -> destination
 * Notes are scheduled ahead of time against ctx.currentTime by a 25 ms timer (lookahead 0.12 s; 1.5 s when the tab is hidden), anchored on a time
 * grid so repeats never drift. Without AudioContext (jsdom / Node) the engine is a deterministic FAKE with the same API and synthetic analysis
 * (`SoundEngine._fake === true`). Nothing here touches WebGL or the DOM except window events and one-time unlock listeners.
 */
import { sanitizeSound, dynamicToGain, gainToDynamic, dbToGain, soundFrequency, diffSound, SOUND_LIMITS } from '../utils/OmniSoundModel.js'

export const LOOKAHEAD_S = 0.12
export const HIDDEN_LOOKAHEAD_S = 1.5
export const TICK_MS = 25
export const BAND_NAMES = ['sub', 'bass', 'lowMid', 'mid', 'highMid', 'presence', 'brilliance']
export const BAND_EDGES = [0, 60, 250, 500, 2000, 4000, 6000, Infinity]

const clamp = (x, a, b) => Math.min(b, Math.max(a, x))
const num = (x, d = 0) => (Number.isFinite(+x) ? +x : d)

// ── pure helpers (also used by the fake engine and by the tests) ─────────────────────────────────────────────────────────
/** progress shape 0..1 -> 0..1 for the curve kinds of the schema. */
export function shape (kind, u) {
  u = clamp(u, 0, 1)
  switch (kind) {
    case 'exponential': return (1 - Math.exp(-4 * u)) / (1 - Math.exp(-4))
    case 'logarithmic': return (Math.exp(4 * u) - 1) / (Math.exp(4) - 1)
    case 'scurve': return u * u * (3 - 2 * u)
    default: return u
  }
}
/** the ADSR numbers of a sound, seconds, scaled by envelope speed and velocity. */
export function adsrParams (s, velocity = null) {
  const sc = s.envTimeScale || 1
  const vel = velocity ?? s.velocity
  const a = Math.max(0.002, s.attack * sc * (1 - clamp(s.envVelocityTime * vel * 0.8, 0, 0.9)))
  return { a, h: s.hold * sc, d: Math.max(0.001, s.decay * sc), s: s.sustainLevel, r: Math.max(0.005, s.release * sc), ac: s.attackCurve, dc: s.decayCurve, rc: s.releaseCurve, sdb: s.sustainDecayDb }
}
/** envelope level 0..1 at t seconds after note-on; tRel = seconds after note-on when released (null = held). */
export function adsrLevel (p, t, tRel = null) {
  if (t < 0) return 0
  if (tRel != null && t >= tRel) {
    const v0 = p.v0 != null ? p.v0 : adsrLevel(p, tRel, null); const u = (t - tRel) / p.r
    return u >= 1 ? 0 : v0 * (1 - shape(p.rc, u))
  }
  if (t < p.a) return shape(p.ac, t / p.a)
  if (t < p.a + p.h) return 1
  const tD = p.a + p.h
  if (t < tD + p.d) return 1 + (p.s - 1) * shape(p.dc, (t - tD) / p.d)
  const k = p.sdb * Math.LN10 / 20
  return p.s * Math.exp(-k * (t - tD - p.d))
}
/** which stage a note is in. */
export function phaseAt (p, t, tRel = null) {
  if (t < 0) return 'idle'
  if (tRel != null && t >= tRel) return t < tRel + p.r ? 'release' : 'idle'
  if (t < p.a + p.h) return 'attack'
  if (t < p.a + p.h + p.d) return 'decay'
  return 'sustain'
}
/** breakpoints [relTime, value] of the envelope from note-on to the end of the release (held notes: to the end of the decay; the sustain slope is set separately). */
export function envPoints (p, tRel = null) {
  const times = []
  const spread = (t0, t1, kind) => { const n = kind === 'linear' ? 1 : 12; for (let i = 1; i <= n; i++) times.push(t0 + (t1 - t0) * i / n) }
  spread(0, p.a, p.ac)
  if (p.h > 0) times.push(p.a + p.h)
  spread(p.a + p.h, p.a + p.h + p.d, p.dc)
  const pts = [[0, 0]]
  if (tRel == null) { for (const t of times) pts.push([t, adsrLevel(p, t, null)]); return pts }
  for (const t of times) if (t < tRel - 1e-9) pts.push([t, adsrLevel(p, t, null)])
  const tD = p.a + p.h + p.d
  if (tRel > tD && p.sdb > 0) { const n = Math.min(40, Math.max(1, Math.ceil((tRel - tD) / 0.1))); for (let i = 1; i < n; i++) { const t = tD + (tRel - tD) * i / n; pts.push([t, adsrLevel(p, t, null)]) } }
  pts.push([tRel, adsrLevel(p, tRel, null)])
  const n = p.rc === 'linear' ? 1 : 12
  for (let i = 1; i <= n; i++) { const t = tRel + p.r * i / n; pts.push([t, adsrLevel(p, t, tRel)]) }
  return pts
}
/** crescendo progress 0..1 at t seconds after the voice start (handles delay / loop / pingpong). */
export function crescendoProgress (s, t) {
  const D = Math.max(0.05, s.crescendoTime); const x = t - s.crescendoDelay
  if (x <= 0) return 0
  switch (s.crescendoRepeat) {
    case 'loop': return shape(s.crescendoCurve, (x % D) / D)
    case 'pingpong': { const m = x % (2 * D); return shape(s.crescendoCurve, m < D ? m / D : 2 - m / D) }
    default: return shape(s.crescendoCurve, Math.min(1, x / D))
  }
}
/** the linear dynamics gain at t seconds after the voice start (crescendo interpolates in dB so it sounds even). */
export function dynamicsGainAt (s, t) {
  const trim = dbToGain(s.gainDb) * (0.4 + 0.6 * s.velocity)
  if (!s.crescendoEnabled) return dynamicToGain(s.dynamic) * trim
  const g0 = dynamicToGain(s.crescendoFrom); const g1 = dynamicToGain(s.crescendoTo)
  return g0 * Math.pow(g1 / g0, crescendoProgress(s, t)) * trim
}
/** deterministic pseudo random generator (mulberry32). */
export function makeRng (seed) { let a = (seed >>> 0) || 1; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }
const hashStr = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) } return h >>> 0 }
/** pitch offset in semitones of repeat i for the iterative pattern. */
export function patternSemi (pattern, i, step, len, rnd) {
  len = Math.max(2, len | 0)
  switch (pattern) {
    case 'updown': { const per = 2 * len - 2; const k = i % per; return (k < len ? k : per - k) * step }
    case 'down': return -i * Math.abs(step)
    case 'random': return Math.floor(rnd() * len) * step
    case 'cycle': return (i % len) * step
    default: return i * step
  }
}
/** seconds between repeats. */
export function intervalSeconds (s) { return s.intervalUnit === 'beat' ? s.intervalBeats * 60 / s.tempo : s.interval / 1000 }
/** how long the effects tail rings after the last note ends. */
export function tailSeconds (s) {
  let t = 0.05
  if (s.reverbEnabled) t = Math.max(t, s.reverbDecay + s.reverbPreDelay / 1000)
  if (s.delayEnabled) { const fb = clamp(s.delayFeedback, 0, 0.95); t = Math.max(t, Math.min(10, s.delayTime / 1000 * (fb < 0.05 ? 1 : Math.log(0.001) / Math.log(fb)))) }
  return t
}
/** 7 band values 0..1 from a byte spectrum (mean and max mixed so narrow peaks show). */
export function bandsFromSpectrum (spec, sampleRate, out, gain = 1) {
  const n = spec.length; const binHz = sampleRate / 2 / n
  for (let b = 0; b < 7; b++) {
    const lo = BAND_EDGES[b]; const hi = BAND_EDGES[b + 1]
    let i0 = Math.ceil(lo / binHz - 1e-9); let i1 = Math.min(n - 1, Math.ceil(hi / binHz - 1e-9) - 1)
    if (b === 0) i0 = 0
    if (i1 < i0) { const c = clamp(Math.round(((lo + Math.min(hi, 20000)) / 2) / binHz), 0, n - 1); i0 = c; i1 = c }
    let sum = 0; let mx = 0
    for (let i = i0; i <= i1; i++) { const v = spec[i]; sum += v; if (v > mx) mx = v }
    out[b] = clamp(((sum / (i1 - i0 + 1)) * 0.5 + mx * 0.5) / 255 * gain, 0, 1)
  }
  return out
}
/** strongest frequency in Hz (parabolic interpolation), 0 if below the threshold (0..1). */
export function peakFromSpectrum (spec, sampleRate, threshold = 0.02) {
  const n = spec.length; let bi = 1; let bv = -1
  for (let i = 1; i < n; i++) if (spec[i] > bv) { bv = spec[i]; bi = i }
  if (bv < threshold * 255 || bv <= 0) return 0
  const a = spec[bi - 1] ?? bv; const c = spec[bi + 1] ?? bv; const den = a - 2 * bv + c
  const d = den !== 0 ? clamp(0.5 * (a - c) / den, -0.5, 0.5) : 0
  return (bi + d) * sampleRate / 2 / n
}
const levelFromRms = (rms) => clamp((20 * Math.log10(Math.max(1e-6, rms)) + 54) / 54, 0, 1)

// ── curves / buffers ─────────────────────────────────────────────────────────────────────────────────────────────────────
const _curveCache = new Map()
function distCurve (type, amount) {
  const key = type + ':' + amount.toFixed(2)
  if (_curveCache.has(key)) return _curveCache.get(key)
  const n = 1024; const c = new Float32Array(n); const k = amount
  for (let i = 0; i < n; i++) {
    const x = i * 2 / (n - 1) - 1
    let y
    if (type === 'hard') y = clamp(x * (1 + k * 12), -1, 1)
    else if (type === 'fold') y = Math.sin(x * (1 + k * 6) * Math.PI / 2)
    else if (type === 'tube') { const d = 1 + k * 14; y = x >= 0 ? Math.tanh(x * d) / Math.tanh(d) : Math.tanh(x * d * 0.6) / Math.tanh(d * 0.6) * 0.9 }
    else { const d = 1 + k * 20; y = Math.tanh(x * d) / Math.tanh(d) }
    c[i] = y
  }
  if (_curveCache.size > 64) _curveCache.clear()
  _curveCache.set(key, c)
  return c
}
function crushCurve (bits) {
  const levels = Math.pow(2, clamp(bits, 1, 16) - 1); const n = 4097; const c = new Float32Array(n)
  for (let i = 0; i < n; i++) { const x = i * 2 / (n - 1) - 1; c[i] = Math.round(x * levels) / levels }
  return c
}
function noiseData (type, len, seed = 1) {
  const r = makeRng(seed); const d = new Float32Array(len)
  if (type === 'pink') { let b0 = 0; let b1 = 0; let b2 = 0; let b3 = 0; let b4 = 0; let b5 = 0; let b6 = 0; for (let i = 0; i < len; i++) { const w = r() * 2 - 1; b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852; b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898; d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926 } }
  else if (type === 'brown') { let last = 0; for (let i = 0; i < len; i++) { const w = r() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5 } }
  else for (let i = 0; i < len; i++) d[i] = r() * 2 - 1
  return d
}
/** generated stereo impulse response of a room (exponential noise tail, damping, early reflections). */
export function makeImpulse (ctx, decay, size, damping, sr = null) {
  const rate = sr || ctx.sampleRate || 44100
  const len = Math.max(64, Math.floor(rate * clamp(decay, 0.1, 12)))
  const buf = ctx.createBuffer(2, len, rate)
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch); const r = makeRng(7919 + ch * 104729); let lp = 0
    const a = clamp(1 - damping * 0.92, 0.04, 1)
    for (let i = 0; i < len; i++) {
      const t = i / len; const env = Math.pow(1 - t, 3.2) * Math.exp(-t * 2.2)
      const k = a * (1 - 0.8 * t * damping) + 0.02
      lp += (((r() * 2 - 1) * env) - lp) * clamp(k, 0.02, 1)
      d[i] = lp
    }
    const taps = 6
    for (let j = 0; j < taps; j++) { const at = Math.floor(rate * (0.004 + size * 0.05 * (j + 1 + r() * 0.6) / taps)); if (at < len) d[at] += (r() < 0.5 ? -1 : 1) * (0.5 - j * 0.06) }
  }
  return buf
}

// ── LFO helper ─────────────────────────────────────────────────────────────────────────────────────────────────────────
function makeLfo (ctx, shapeName, rate, randBuf, phaseDeg = 0) {
  const out = ctx.createGain()
  const mod = ctx.createGain()   // input: Hz added to the LFO speed (random wander); gain set by the voice
  mod.gain.value = 0
  const lfo = { out, mod, shape: shapeName, rate, phase: phaseDeg, src: null }
  const build = () => {
    if (lfo.src) { try { lfo.src.stop() } catch (_) {} try { lfo.src.disconnect() } catch (_) {} }
    try { mod.disconnect() } catch (_) {}
    let src
    if (lfo.shape === 'random') { src = ctx.createBufferSource(); src.buffer = randBuf(); src.loop = true; src.playbackRate.value = Math.max(0.001, lfo.rate / 16); mod.connect(src.playbackRate) }
    else {
      src = ctx.createOscillator(); src.frequency.value = lfo.rate; mod.connect(src.frequency)
      if (lfo.shape === 'sine' && lfo.phase) {   // sin(wt + phase) = cos(phase) sin(wt) + sin(phase) cos(wt)
        const ph = lfo.phase * Math.PI / 180
        try { src.setPeriodicWave(ctx.createPeriodicWave(new Float32Array([0, Math.sin(ph)]), new Float32Array([0, Math.cos(ph)]))) } catch (_) { src.type = 'sine' }
      } else src.type = lfo.shape
    }
    src.connect(out); lfo.src = src
    if (lfo.started) { try { src.start() } catch (_) {} }
  }
  lfo.start = () => { lfo.started = true; try { lfo.src.start() } catch (_) {} }
  lfo.setRate = (r, now) => { lfo.rate = r; try { if (lfo.shape === 'random') lfo.src.playbackRate.setTargetAtTime(Math.max(0.001, r / 16), now, 0.05); else lfo.src.frequency.setTargetAtTime(r, now, 0.05) } catch (_) {} }
  lfo.setShape = (sh, ph = lfo.phase) => { if (sh !== lfo.shape || ph !== lfo.phase) { lfo.shape = sh; lfo.phase = ph; build() } }
  lfo.dispose = () => { try { lfo.src.stop() } catch (_) {} try { lfo.src.disconnect(); out.disconnect(); mod.disconnect() } catch (_) {} }
  build()
  return lfo
}

const emit = (detail) => { try { window.dispatchEvent(new CustomEvent('omni:sound-state', { detail })) } catch (_) { /* no window */ } }

// chain signature: when it changes the FX chain is rebuilt (everything else is applied live)
const chainSig = (s) => [s.reverbEnabled, s.delayEnabled, s.delayPingPong, s.distortionEnabled, s.modFxEnabled, s.bitcrushEnabled, s.eqEnabled, s.compEnabled, s.positional, s.occlusion === 'air', s.panningModel, s.distanceModel].join('|')
const SRC_KEYS = new Set(['sourceType', 'waveform', 'customPartials', 'pulseWidth', 'phase', 'noiseType', 'noiseLevel', 'sampleSlot', 'sampleUrl', 'sampleKeyTrack', 'additiveHarmonics', 'additiveRolloff', 'additiveOddOnly', 'fmRatio', 'fmDepth', 'fmDecay', 'fmWaveform', 'unisonVoices', 'unisonDetune', 'unisonSpread', 'subEnabled', 'subLevel', 'subOctave', 'subWaveform', 'filterEnabled', 'filterSlope', 'filterType', 'reverse', 'startOffset', 'playbackRate'])
const PITCH_KEYS = new Set(['note', 'octaveShift', 'transpose', 'fineTune', 'useMidi', 'midi', 'freqOverride', 'a4'])
const FILTER_KEYS = new Set(['filterCutoff', 'filterQ', 'filterGainDb', 'filterKeyTrack'])
const DYN_KEYS = new Set(['dynamic', 'gainDb', 'velocity', 'crescendoEnabled', 'crescendoFrom', 'crescendoTo', 'crescendoTime', 'crescendoCurve', 'crescendoDelay', 'crescendoRepeat', 'crescendoBrightness', 'crescendoPitch'])
const TIMING_KEYS = new Set(['interval', 'intervalBeats', 'intervalUnit', 'tempo', 'iterations', 'iterInfinite', 'iterative', 'swing', 'intervalJitter', 'loop', 'loopCount', 'loopGap'])

export class OmniSoundEngine {
  constructor (opts = {}) {
    this._opts = opts
    this._ctx = null
    this._fakeMode = null
    this._voices = new Map()
    this._dying = new Set()
    this._wall = 0
    this._wanted = false
    this._pending = new Map()
    this._voiceCap = SOUND_LIMITS.defaultVoices
    this._volume = 0.8
    this._muted = false
    this._requireOptIn = false
    this._gesture = false
    this._listenersInstalled = false
    this._timer = null
    this._fakeEpoch = (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000
    this._clock = null
    this._listener = { pos: [0, 0, 0], fwd: [0, 0, -1], up: [0, 1, 0], vel: [0, 0, 0] }
    this._buffers = new Map()
    this._samples = new Map()
    this._irCache = new Map()
    this._master = null
    this._mixer = null
    this._masterTap = null
    this._lastMasterRead = -1
    this._installUnlockListeners()
  }

  get _fake () { return this._isFake() }
  _isFake () {
    if (this._fakeMode === null) {
      let C = this._opts.AudioContext
      if (C === undefined) { try { C = (typeof window !== 'undefined') ? (window.AudioContext || window.webkitAudioContext) : null } catch (_) { C = null } }
      this._Ctor = C || null
      this._fakeMode = this._opts.fake === true || !this._Ctor
    }
    return this._fakeMode
  }
  /** now in seconds on the engine timeline (ctx.currentTime, or the fake clock). */
  _now () {
    if (!this._isFake()) return this._ctx ? this._ctx.currentTime : 0
    if (this._clock != null) return this._clock
    return (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000 - this._fakeEpoch
  }
  /** tests: drive the fake clock by hand (seconds). */
  _setClock (t) { this._clock = t }
  getContext () { return this._ctx }

  // ── unlock ────────────────────────────────────────────────────────────────────────────────────────────────────────────
  _installUnlockListeners () {
    if (this._listenersInstalled || typeof document === 'undefined') return
    this._listenersInstalled = true
    this._unlockHandler = () => { if (this._requireOptIn) return; this._gesture = true; if (this._pending.size || this._ctx || this._wanted) this.unlock() }
    try { for (const ev of ['pointerdown', 'keydown']) document.addEventListener(ev, this._unlockHandler, { capture: true, passive: true }) } catch (_) {}
  }
  _removeUnlockListeners () {
    if (!this._listenersInstalled || typeof document === 'undefined') return
    try { for (const ev of ['pointerdown', 'keydown']) document.removeEventListener(ev, this._unlockHandler, { capture: true }) } catch (_) {}
    this._listenersInstalled = false
  }
  /** Resume (creating if needed) the AudioContext. Call it from a user gesture; it is also called by the one-time pointerdown / keydown listeners. */
  async unlock () {
    this._gesture = true
    if (this._isFake()) { this._flushPending(); return true }
    const ctx = this._ensureContext()
    if (!ctx) return false
    try { if (ctx.state !== 'running') await ctx.resume() } catch (_) { /* still locked */ }
    const ok = ctx.state === 'running'
    if (ok) { this._removeUnlockListeners(); this._flushPending() }
    return ok
  }
  isUnlocked () { return this._isFake() ? true : !!(this._ctx && this._ctx.state === 'running') }
  _mayCreate () {
    if (this._gesture) return true
    try { if (typeof navigator !== 'undefined' && navigator.userActivation && navigator.userActivation.hasBeenActive && !this._requireOptIn) return true } catch (_) {}
    return false
  }
  _ensureContext () {
    if (this._ctx) return this._ctx
    if (this._isFake() || !this._mayCreate()) return null
    try { this._ctx = new this._Ctor({ latencyHint: 'interactive' }) } catch (e) { try { this._ctx = new this._Ctor() } catch (e2) { this._fakeMode = true; return null } }
    this._buildMaster()
    const c = this._ctx
    try { c.addEventListener?.('statechange', () => { if (this._ctx === c && c.state === 'running') this._flushPending() }) } catch (_) {}
    return c
  }
  _buildMaster () {
    const c = this._ctx
    const gain = c.createGain(); gain.gain.value = this._muted ? 0 : this._volume
    const lim = c.createDynamicsCompressor(); lim.threshold.value = -2; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.002; lim.release.value = 0.1
    const an = c.createAnalyser(); an.fftSize = 2048; an.smoothingTimeConstant = 0.8
    gain.connect(lim); lim.connect(an); an.connect(c.destination)
    this._master = { gain, lim, an }
    this._masterTap = this._makeTap(an, 2048)
  }
  _flushPending () {
    if (!this._pending.size) return
    const list = [...this._pending.entries()]; this._pending.clear()
    for (const [id, p] of list) this.start(id, p.sound, p.ctx)
  }
  _needUnlock (nodeId, sound, ctx) {
    this._pending.set(nodeId, { sound, ctx })
    try { window.dispatchEvent(new CustomEvent('omni:sound-unlock-needed', { detail: { nodeId } })) } catch (_) {}
  }

  // ── global settings ──────────────────────────────────────────────────────────────────────────────────────────────────────
  configure (o = {}) {
    if (o.masterVolume != null) this.setMasterVolume(o.masterVolume)
    if (o.voiceCap != null) this.setVoiceCap(o.voiceCap)
    if (o.muted != null) this.setMuted(o.muted)
    if (o.requireOptIn != null) this.setRequireOptIn(o.requireOptIn)
  }
  setRequireOptIn (b) { this._requireOptIn = !!b }
  setVoiceCap (n) { this._voiceCap = clamp(Math.round(num(n, SOUND_LIMITS.defaultVoices)), 1, SOUND_LIMITS.maxVoicesCap) }
  getVoiceCap () { return this._voiceCap }
  setMasterVolume (v) {
    this._volume = clamp(num(v, 0.8), 0, 1)
    if (this._master) try { this._master.gain.gain.setTargetAtTime(this._muted ? 0 : this._volume, this._ctx.currentTime, 0.02) } catch (_) {}
  }
  getMasterVolume () { return this._volume }
  setMuted (b) {
    this._muted = !!b
    if (this._master) try { this._master.gain.gain.setTargetAtTime(this._muted ? 0 : this._volume, this._ctx.currentTime, 0.02) } catch (_) {}
  }
  isMuted () { return this._muted }

  // ── queries ───────────────────────────────────────────────────────────────────────────────────────────────────────────
  isPlaying (nodeId) { const v = this._voices.get(nodeId); return !!(v && !v.stopping && !v.finished) }
  playing () { return [...this._voices.values()].filter(v => !v.stopping && !v.finished).map(v => v.id) }
  voiceCount () { return this._voices.size }

  // ── start / update / stop ───────────────────────────────────────────────────────────────────────────────────────────
  /** Start (or restart) the voice of a node. `sound` is sanitized again here. Returns true if started or queued for unlock. */
  start (nodeId, sound, ctx = null) {
    if (nodeId == null) return false
    nodeId = String(nodeId)
    const s = sanitizeSound(sound)
    if (!this._isFake()) {
      const c = this._ensureContext()
      if (!c) { this._wanted = true; this._needUnlock(nodeId, s, ctx); return true }
      if (c.state === 'suspended') { try { c.resume() } catch (_) {} }
    }
    this._pending.delete(nodeId)
    const old = this._voices.get(nodeId)
    if (old) { this._killVoice(old, 0.03); this._voices.delete(nodeId); this._dying.add(old) }
    this._wanted = true
    // voice cap: steal the oldest
    while ([...this._voices.values()].filter(v => !v.stopping && !v.finished).length >= this._voiceCap) {
      let oldest = null
      for (const v of this._voices.values()) if (!v.stopping && !v.finished && (!oldest || v.startedWall < oldest.startedWall)) oldest = v
      if (!oldest) break
      this._killVoice(oldest, 0.04, true)
    }
    const now = this._now()
    const v = {
      id: nodeId, sound: s, ctx, t0: now + 0.02, startedWall: ++this._wall, rng: makeRng(hashStr(nodeId)), notes: [], queue: [],
      loopIdx: 0, iterIdx: 0, loopStart: now + 0.02 + s.startDelay, nextTime: now + 0.02 + s.startDelay, anchorT: now + 0.02 + s.startDelay, anchorI: 0,
      schedDone: false, stopping: false, finished: false, endAt: Infinity, lastPhase: 'idle', lastFreq: null, lastNoteT: 0, lastGate: 0, lastDyn: s.dynamic,
      iteration: 0, loopCount: 0, noteId: 0, analysis: null, fftSig: '', lastRead: -1, graph: null, sig: chainSig(s), pos: null, lastPos: null, dopplerCents: 0, chains: []
    }
    this._voices.set(nodeId, v)
    if (!this._isFake()) { try { this._buildVoice(v) } catch (e) { console.warn('SoundEngine: voice build failed', e); this._disposeVoice(v); return false } }
    emit({ nodeId, state: 'started' })
    this._ensureTimer()
    this._tickVoice(v, now)
    return true
  }
  update (nodeId, sound) {
    const v = this._voices.get(String(nodeId))
    if (!v) { const p = this._pending.get(String(nodeId)); if (p) p.sound = sanitizeSound(sound); return false }
    const s = sanitizeSound(sound)
    const changed = diffSound(v.sound, s)
    if (!changed.length) return true
    const old = v.sound
    v.sound = s
    if (!this._isFake()) { try { this._applyLive(v, old, changed) } catch (e) { console.warn('SoundEngine: live update failed', e) } }
    if (changed.some(k => TIMING_KEYS.has(k))) this._reanchor(v)
    return true
  }
  /** Stop a node's sound: the release stage runs unless {immediate:true}. */
  stop (nodeId, opts = {}) {
    nodeId = String(nodeId)
    this._pending.delete(nodeId)
    const v = this._voices.get(nodeId)
    if (!v || v.stopping || (v.finished && !opts.immediate)) { if (v && opts.immediate) this._killVoice(v, 0.015); return false }
    if (opts.immediate) { this._killVoice(v, 0.015); return true }
    const now = this._now()
    v.stopping = true; v.schedDone = true
    let end = now
    for (const n of [...v.notes]) {
      if (n.tOn > now + 0.001) { this._discardNote(v, n); continue }
      if (n.tRel == null || n.tRel > now) this._releaseNote(v, n, now)
      end = Math.max(end, n.tEnd)
    }
    const fo = v.sound.fadeOut
    if (fo > 0 && v.graph) try { const g = v.graph.fade.gain; g.cancelScheduledValues(now); g.setValueAtTime(g.value, now); g.linearRampToValueAtTime(0, now + fo) } catch (_) {}
    v.endAt = Math.max(end, now + fo) + tailSeconds(v.sound)
    emit({ nodeId, state: 'stopped' })
    return true
  }
  stopAll (opts = {}) { this._pending.clear(); for (const id of [...this._voices.keys()]) this.stop(id, opts) }
  _killVoice (v, fade = 0.02, announce = false) {
    const now = this._now()
    if (!v.stopping && !v.finished) emit({ nodeId: v.id, state: 'stopped' })
    v.stopping = true; v.schedDone = true; v.killed = true
    if (v.graph) try { const g = v.graph.out.gain; g.cancelScheduledValues(now); g.setValueAtTime(g.value, now); g.linearRampToValueAtTime(0, now + fade) } catch (_) {}
    v.endAt = now + fade + 0.02
    for (const n of v.notes) n.tEnd = Math.min(n.tEnd, v.endAt)
    void announce
  }

  // ── timer / scheduler ───────────────────────────────────────────────────────────────────────────────────────────────────
  _ensureTimer () {
    if (this._timer || !(this._voices.size || this._dying.size)) return
    this._timer = setInterval(() => this.tick(), TICK_MS)
    this._timer.unref?.()
  }
  /** one scheduler pass (called by the 25 ms timer; tests call it by hand). */
  tick () {
    const now = this._now()
    for (const v of [...this._voices.values()]) {
      try { this._tickVoice(v, now) } catch (e) { console.warn('SoundEngine tick error', e); this._killVoice(v, 0.02) }
      if (now >= v.endAt) this._disposeVoice(v)
    }
    for (const v of [...this._dying]) { try { this._tickVoice(v, now) } catch (_) {} if (now >= v.endAt) { this._dying.delete(v); this._disposeVoice(v) } }
    if (!this._voices.size && !this._dying.size && this._timer) { clearInterval(this._timer); this._timer = null }
  }
  _ahead () { try { return typeof document !== 'undefined' && document.hidden ? HIDDEN_LOOKAHEAD_S : LOOKAHEAD_S } catch (_) { return LOOKAHEAD_S } }
  _gridTime (v, i) {
    const s = v.sound; const iv = intervalSeconds(s)
    let t = v.anchorT + (i - v.anchorI) * iv
    if (s.swing > 0 && (i % 2 === 1)) t += s.swing * iv * 0.5
    return t
  }
  _reanchor (v) { if (v.iterIdx > 0) { v.anchorT = v.lastNoteT; v.anchorI = v.iterIdx - 1 } }
  _noteSpec (v) {
    const s = v.sound; const it = s.iterative; const i = it ? v.iterIdx : 0; const n = it ? v.iterIdx : v.loopIdx
    const semi = it ? patternSemi(s.iterPattern, i, s.iterPitchStep, s.iterPatternLength, v.rng) : 0
    let gainDb = it ? i * s.iterGainStep : 0
    if (s.accentEvery > 0 && n % s.accentEvery === 0) gainDb += s.accentDb
    if (s.humanizeDb > 0) gainDb += (v.rng() * 2 - 1) * s.humanizeDb
    const pan = s.iterPanSpread > 0 ? s.iterPanSpread * (i % 2 ? 1 : -1) : 0
    const lastFinite = it ? (!s.iterInfinite && v.iterIdx >= s.iterations - 1) : true
    const held = s.sustained && (it ? lastFinite : true)
    const gate = it && s.iterNoteLength > 0 ? s.iterNoteLength : s.duration
    const drift = s.pitchDrift > 0 ? (v.rng() * 2 - 1) * s.pitchDrift : 0
    return { semi: semi + drift / 100, gainDb, pan, filterOct: it ? i * s.iterFilterStep : 0, held, gate, iter: i }
  }
  _tickVoice (v, now) {
    const s = v.sound
    const ahead = this._ahead()
    if (!v.stopping && s.maxPlayTime > 0 && now - v.t0 >= s.maxPlayTime) { this.stop(v.id); return }
    // crescendo windows
    if (!v.stopping && v.graph) this._extendCrescendo(v, now)
    while (!v.schedDone && v.nextTime < now + ahead) {
      const at = Math.max(v.nextTime, now)
      const spec = this._noteSpec(v)
      this._playNote(v, spec, at)
      v.lastNoteT = v.nextTime; v.lastGate = spec.gate
      if (s.iterative && v.iterIdx > 0) v.queue.push({ t: at, detail: { nodeId: v.id, state: 'iteration', iteration: v.iterIdx } })
      v.iteration = v.iterIdx
      if (spec.held) { v.schedDone = true; break }
      let endBody = true
      if (s.iterative) {
        v.iterIdx++
        if (s.iterInfinite || v.iterIdx < s.iterations) {
          endBody = false
          const nt = this._gridTime(v, v.iterIdx)
          const j = s.intervalJitter > 0 ? (v.rng() * 2 - 1) * s.intervalJitter * intervalSeconds(s) * 0.5 : 0
          v.nextTime = Math.max(v.lastNoteT + 0.005, nt + j)
        }
      }
      if (endBody) {
        if (s.loop && (s.loopCount === 0 || v.loopIdx + 1 < s.loopCount)) {
          const body = s.iterative ? Math.max(spec.gate, intervalSeconds(s)) : spec.gate
          v.loopIdx++; v.loopCount = v.loopIdx; v.iterIdx = 0
          v.loopStart = v.lastNoteT + body + s.loopGap; v.nextTime = v.loopStart; v.anchorT = v.loopStart; v.anchorI = 0
          v.queue.push({ t: v.loopStart, detail: { nodeId: v.id, state: 'looped', loopCount: v.loopIdx } })
        } else v.schedDone = true
      }
    }
    // retire ended notes
    for (const n of [...v.notes]) if (now >= n.tEnd + 0.02) this._retireNote(v, n)
    // events
    if (v.queue.length) { const due = v.queue.filter(e => e.t <= now); if (due.length) { v.queue = v.queue.filter(e => e.t > now); due.forEach(e => emit(e.detail)) } }
    // natural end
    if (v.schedDone && !v.stopping && !v.finished && !v.notes.some(n => n.tRel == null)) {
      const last = v.notes.reduce((m, n) => Math.max(m, n.tEnd), 0)
      if (!v.notes.length || now >= last) {
        v.finished = true; v.endAt = now + tailSeconds(s); emit({ nodeId: v.id, state: 'stopped' })
      }
    }
    const ph = this._phaseNow(v, now)
    if (ph !== v.lastPhase) { v.lastPhase = ph; emit({ nodeId: v.id, state: 'phase', phase: ph }) }
  }
  _phaseNow (v, now) {
    let best = 'idle'; const rank = { idle: 0, release: 1, sustain: 2, decay: 3, attack: 4 }
    for (const n of v.notes) { const p = phaseAt(n.p, now - n.tOn, n.tRel == null ? null : n.tRel - n.tOn); if (rank[p] > rank[best]) best = p }
    return best
  }

  // ── notes ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
  _playNote (v, spec, at) {
    const s = v.sound
    if (v.notes.length >= 24) { const o = v.notes.find(n => n.tOn <= at && n.p.r > 0.03 && (n.tRel == null || n.tRel > at || n.tEnd > at + 0.05)); if (o) this._releaseNote(v, o, at, true) }
    const legato = s.retrigger === 'legato' && s.iterative
    let n = legato && v.iterIdx > 0 ? v.notes.find(x => x.legato && x.tRel == null) : null
    if (n) this._retuneNote(v, n, spec, at)   // legato: the same note slides to the new pitch, no new attack
    else {
      const p = adsrParams(s)
      const tRel = spec.held || legato ? null : spec.gate
      n = { id: ++v.noteId, tOn: at, tRel: tRel == null ? null : at + tRel, tEnd: Infinity, p, spec, nodes: [], tune: [], filters: [], legato, freq: soundFrequency(s) * Math.pow(2, spec.semi / 12) }
      n.tEnd = n.tRel == null ? Infinity : n.tRel + p.r
      if (!this._isFake()) { try { this._buildNote(v, n) } catch (e) { console.warn('SoundEngine: note build failed', e); n.tEnd = at } }
      v.notes.push(n)
    }
    if (legato && !spec.held && !s.iterInfinite && v.iterIdx >= s.iterations - 1) this._releaseNote(v, n, at + Math.max(spec.gate, intervalSeconds(s)))   // last legato repeat
    v.lastFreq = n.freq
    return n
  }
  _releaseNote (v, n, at, fast = false) {
    const already = n.tRel != null && n.tRel <= at
    if (already && !fast) return
    const cur = adsrLevel(n.p, Math.max(0, at - n.tOn), n.tRel == null ? null : n.tRel - n.tOn)
    if (fast) n.p = { ...n.p, r: 0.03, rc: 'linear', v0: cur }   // stolen note: 30 ms fade from wherever it is
    n.tRel = Math.max(at, n.tOn); n.tEnd = n.tRel + n.p.r
    if (this._isFake() || !n.env) return
    try {
      const g = n.env.gain; const v0 = fast ? cur : adsrLevel(n.p, n.tRel - n.tOn, null)
      g.cancelScheduledValues(n.tRel); g.setValueAtTime(v0, n.tRel)
      const k = n.p.rc === 'linear' ? 1 : 12
      for (let i = 1; i <= k; i++) { const u = i / k; g.linearRampToValueAtTime(v0 * (1 - shape(n.p.rc, u)), n.tRel + n.p.r * u) }
      if (n.fEnv) { const o = n.fEnv.offset; o.cancelScheduledValues(n.tRel); o.setTargetAtTime(0, n.tRel, Math.max(0.01, v.sound.filterEnvRelease / 3)) }
      for (const src of n.sources) try { src.stop(n.tEnd + 0.03) } catch (_) {}
    } catch (_) {}
  }
  _discardNote (v, n) {
    const i = v.notes.indexOf(n); if (i >= 0) v.notes.splice(i, 1)
    this._disposeNote(n)
  }
  _retireNote (v, n) { const i = v.notes.indexOf(n); if (i >= 0) v.notes.splice(i, 1); this._disposeNote(n) }
  _disposeNote (n) {
    if (!n.nodes) return
    for (const src of n.sources || []) try { src.stop(0) } catch (_) {}
    for (const x of n.nodes) try { x.disconnect() } catch (_) {}
    n.nodes = []; n.sources = []
  }
  _retuneNote (v, n, spec, at) {
    const s = v.sound
    n.spec = spec; n.freq = soundFrequency(s) * Math.pow(2, spec.semi / 12)
    if (this._isFake()) return
    const tc = Math.max(0.01, (s.glide || 20) / 3000)
    for (const t of n.tune) try { t.param.setTargetAtTime(n.freq * t.mult, at, tc) } catch (_) {}
    if (n.trim) try { n.trim.gain.setTargetAtTime(dbToGain(spec.gainDb), at, 0.01) } catch (_) {}
  }
  _kickSample (v, n) {
    const key = this._sampleKey(v.sound)
    if (!key) return
    if (!this._samples.has(key)) this._loadSample(v.sound).then(() => { if (this._voices.get(v.id) === v && !v.stopping && !v.finished) { const sp = this._noteSpec(v); this._playNote(v, sp, this._now() + 0.02) } })
    void n
  }
  _sampleKey (s) { return s.sampleUrl ? 'u:' + s.sampleUrl : (s.sampleSlot > 0 ? 's:' + s.sampleSlot : '') }
  async _loadSample (s) {
    const key = this._sampleKey(s)
    if (!key) return null
    if (this._samples.has(key)) { const hit = this._samples.get(key); return hit && hit.promise ? hit.promise : hit }
    const promise = (async () => {
      try {
        let ab
        if (s.sampleUrl) { const r = await fetch(s.sampleUrl); ab = await r.arrayBuffer() } else {
          const { createWallpaperStore } = await import('../utils/WallpaperStorage.js')
          const rec = await createWallpaperStore('omnimixer-audio', 15).loadWallpaper(s.sampleSlot)
          if (!rec) throw new Error('empty OmniMixer slot ' + s.sampleSlot)
          ab = await rec.blob.arrayBuffer()
        }
        const buf = await this._ctx.decodeAudioData(ab)
        this._samples.set(key, buf)
        return buf
      } catch (e) { console.warn('SoundEngine: sample not available (' + key + '):', e?.message || e); this._samples.set(key, null); return null }
    })()
    this._samples.set(key, { promise })
    return promise
  }

  // ── voice graph ────────────────────────────────────────────────────────────────────────────────────────────────────────
  _randBuf () {
    const c = this._ctx
    if (!this._randBuffer || this._randBuffer.__c !== c) {
      const b = c.createBuffer(1, 16000, 16000); const d = b.getChannelData(0); const r = makeRng(4242)
      for (let st = 0; st < 16; st++) { const val = r() * 2 - 1; for (let i = 0; i < 1000; i++) d[st * 1000 + i] = val }
      b.__c = c; this._randBuffer = b
    }
    return this._randBuffer
  }
  _noiseBuf (type) {
    const c = this._ctx; const key = 'n:' + type
    let b = this._buffers.get(key)
    if (!b) { b = c.createBuffer(1, c.sampleRate * 2, c.sampleRate); b.getChannelData(0).set(noiseData(type, c.sampleRate * 2, type === 'pink' ? 11 : type === 'brown' ? 13 : 17)); this._buffers.set(key, b) }
    return b
  }
  _makeTap (an, fft) {
    return { an, spec: new Uint8Array(an.frequencyBinCount), wave: new Uint8Array(an.fftSize), bands: [0, 0, 0, 0, 0, 0, 0], sm: [0, 0, 0, 0, 0, 0, 0], level: 0, lastT: 0, fft }
  }
  _buildVoice (v) {
    const c = this._ctx; const s = v.sound; const now = c.currentTime
    const g = { nodes: [] }
    v.graph = g
    const mk = (n) => { g.nodes.push(n); return n }
    g.bus = mk(c.createGain())
    g.dyn = mk(c.createGain()); g.trem = mk(c.createGain()); g.drift = mk(c.createGain()); g.fade = mk(c.createGain())
    g.out = mk(c.createGain())
    g.out.gain.value = 1
    g.bus.connect(g.dyn); g.dyn.connect(g.trem); g.trem.connect(g.drift); g.drift.connect(g.fade)
    g.fade.gain.setValueAtTime(s.fadeIn > 0 ? 0 : 1, now)
    if (s.fadeIn > 0) g.fade.gain.linearRampToValueAtTime(1, now + 0.02 + s.fadeIn)
    g.dyn.gain.setValueAtTime(dynamicsGainAt(s, 0), now)
    // buses: pitch cents (vibrato, crescendo pitch, doppler) and filter cents (lfo, crescendo brightness, drift)
    g.pitchBus = mk(c.createGain()); g.detuneBus = mk(c.createGain())
    // vibrato
    g.vib = makeLfo(c, s.vibratoShape, s.vibratoRate, () => this._randBuf()); g.vibDepth = mk(c.createGain()); g.vibDepth.gain.value = 0
    g.vib.out.connect(g.vibDepth); g.vibDepth.connect(g.pitchBus); g.vib.start()
    this._schedVibrato(v, now)
    // tremolo
    g.tremLfo = makeLfo(c, s.tremoloShape, s.tremoloRate, () => this._randBuf(), s.tremoloPhase); g.tremAmt = mk(c.createGain()); g.tremAmt.gain.value = 0
    g.tremLfo.out.connect(g.tremAmt); g.tremAmt.connect(g.trem.gain); g.tremLfo.start()
    this._schedTremolo(v, now)
    // crescendo pitch / brightness constant sources, doppler
    g.cresPitch = mk(c.createConstantSource()); g.cresPitch.offset.value = 0; g.cresPitch.connect(g.pitchBus); g.cresPitch.start()
    g.doppler = mk(c.createConstantSource()); g.doppler.offset.value = 0; g.doppler.connect(g.pitchBus); g.doppler.start()
    g.cresBright = mk(c.createConstantSource()); g.cresBright.offset.value = 0; g.cresBright.connect(g.detuneBus); g.cresBright.start()
    // filter wobble
    g.fLfo = makeLfo(c, s.filterLfoShape, s.filterLfoRate, () => this._randBuf()); g.fLfoAmt = mk(c.createGain()); g.fLfoAmt.gain.value = s.filterLfoDepth * 1200
    g.fLfo.out.connect(g.fLfoAmt); g.fLfoAmt.connect(g.detuneBus); g.fLfo.start()
    // sustain drift: two slow sines
    g.dA = makeLfo(c, 'sine', s.sustainDriftRate, () => this._randBuf()); g.dB = makeLfo(c, 'sine', s.sustainDriftRate * 1.618, () => this._randBuf())
    g.dSum = mk(c.createGain()); g.dSum.gain.value = 0.5; g.dA.out.connect(g.dSum); g.dB.out.connect(g.dSum)
    g.dAmp = mk(c.createGain()); g.dBright = mk(c.createGain()); g.dSum.connect(g.dAmp); g.dSum.connect(g.dBright)
    g.drift.gain.value = 1 - 0.3 * s.sustainDrift; g.dAmp.gain.value = 0.3 * s.sustainDrift; g.dAmp.connect(g.drift.gain)
    g.dBright.gain.value = s.sustainBrightDrift * 1200; g.dBright.connect(g.detuneBus)
    g.dA.start(); g.dB.start()
    g.dSum.connect(g.vib.mod); g.dSum.connect(g.tremLfo.mod); this._applyLfoDrift(v, now)
    g.lfos = [g.vib, g.tremLfo, g.fLfo, g.dA, g.dB]
    // outputs: voice out -> master
    g.an = mk(c.createAnalyser()); this._configAnalyser(g.an, s)
    g.tap = this._makeTap(g.an, g.an.fftSize)
    g.out.connect(this._master.gain)
    this._buildChain(v, true)
    this._scheduleCrescendoStart(v, now)
  }
  _applyLfoDrift (v, t) { const g = v.graph; const s = v.sound; g.vib.mod.gain.setTargetAtTime(s.lfoDrift * s.vibratoRate * 0.3, t, 0.05); g.tremLfo.mod.gain.setTargetAtTime(s.lfoDrift * s.tremoloRate * 0.3, t, 0.05) }
  _configAnalyser (an, s) {
    try { an.fftSize = parseInt(s.fftSize, 10) || 2048; an.smoothingTimeConstant = s.smoothing; an.minDecibels = s.minDb; an.maxDecibels = s.maxDb } catch (_) {}
  }
  _schedVibrato (v, now) {
    const s = v.sound; const g = v.graph.vibDepth.gain; const t0 = v.t0
    g.cancelScheduledValues(now)
    if (now < t0 + s.vibratoDelay) { g.setValueAtTime(0, Math.max(now, 0)); const tS = t0 + s.vibratoDelay; if (s.vibratoFade > 0) { g.setValueAtTime(0, tS); g.linearRampToValueAtTime(s.vibratoDepth, tS + s.vibratoFade) } else g.setValueAtTime(s.vibratoDepth, tS) } else g.setTargetAtTime(s.vibratoDepth, now, 0.05)
  }
  _schedTremolo (v, now) {
    const s = v.sound; const g = v.graph.tremAmt.gain; const t0 = v.t0
    g.cancelScheduledValues(now)
    const d = s.tremoloDepth / 2
    // trem gain = 1 - d + d * lfo
    v.graph.trem.gain.setTargetAtTime(1 - d, now, 0.02)
    if (now < t0 + s.tremoloDelay) { g.setValueAtTime(0, now); const tS = t0 + s.tremoloDelay; if (s.tremoloFade > 0) { g.setValueAtTime(0, tS); g.linearRampToValueAtTime(d, tS + s.tremoloFade) } else g.setValueAtTime(d, tS) } else g.setTargetAtTime(d, now, 0.05)
  }
  // crescendo: sampled value windows of 1 s, extended by the tick
  _scheduleCrescendoStart (v, now) {
    const g = v.graph
    v.cresT0 = v.t0; v.cresUntil = now + 0.005
    const s = v.sound
    g.dyn.gain.cancelScheduledValues(now); g.dyn.gain.setValueAtTime(dynamicsGainAt(s, now - v.cresT0), now)
    this._extendCrescendo(v, now)
  }
  _extendCrescendo (v, now) {
    const s = v.sound; const g = v.graph
    const animated = s.crescendoEnabled
    const wantBright = animated && s.crescendoBrightness > 0; const wantPitch = animated && s.crescendoPitch !== 0
    if (!animated) return
    const W = 1; const horizon = now + 2.5
    let guard = 0
    while (v.cresUntil < horizon && guard++ < 8) {
      const a = Math.max(v.cresUntil, now)
      const tRel = a - v.cresT0
      // finished? (hold mode and past the end): constant
      const doneAt = s.crescendoDelay + s.crescendoTime
      if (s.crescendoRepeat === 'hold' && tRel >= doneAt) {
        g.dyn.gain.setValueAtTime(dynamicsGainAt(s, doneAt), a)
        g.cresBright.offset.setValueAtTime(s.crescendoBrightness * 3600, a); g.cresPitch.offset.setValueAtTime(s.crescendoPitch, a)
        v.cresUntil = Infinity; break
      }
      const n = 31; const dyn = new Float32Array(n); const br = new Float32Array(n); const pi = new Float32Array(n)
      for (let i = 0; i < n; i++) { const tt = tRel + W * i / (n - 1); dyn[i] = Math.max(1e-5, dynamicsGainAt(s, tt)); const pr = crescendoProgress(s, tt); br[i] = pr * s.crescendoBrightness * 3600; pi[i] = pr * s.crescendoPitch }
      try {
        g.dyn.gain.setValueCurveAtTime(dyn, a, W)
        if (wantBright) g.cresBright.offset.setValueCurveAtTime(br, a, W)
        if (wantPitch) g.cresPitch.offset.setValueCurveAtTime(pi, a, W)
      } catch (e) { /* an overlapping curve (Chrome rounds event times to sample frames): skip this window, the next one continues */ }
      v.cresUntil = a + W + 0.002   // 2 ms gap: Chrome quantizes automation times, a curve must not touch the next one
    }
  }
  _chainStages (v, c) {
    const s = v.sound; const stages = []
    const wet = (inN, build) => build
    void wet
    if (s.distortionEnabled) stages.push(this._stDist(c, s))
    if (s.bitcrushEnabled) stages.push(this._stCrush(c, s))
    if (s.modFxEnabled) stages.push(this._stMod(c, s))
    if (s.eqEnabled) stages.push(this._stEq(c, s))
    if (s.compEnabled) stages.push(this._stComp(c, s))
    if (s.delayEnabled) stages.push(this._stDelay(c, s))
    if (s.reverbEnabled) stages.push(this._stReverb(c, s))
    return stages
  }
  _stDist (c, s) {
    const inp = c.createGain(); const out = c.createGain(); const dry = c.createGain(); const wet = c.createGain(); const sh = c.createWaveShaper(); const lp = c.createBiquadFilter()
    sh.oversample = '4x'; lp.type = 'lowpass'
    inp.connect(dry); dry.connect(out); inp.connect(sh); sh.connect(lp); lp.connect(wet); wet.connect(out)
    const st = { in: inp, out, nodes: [inp, out, dry, wet, sh, lp] }
    st.apply = (s2, t, first) => { if (first || st.k !== s2.distortionType + s2.distortionAmount) { sh.curve = distCurve(s2.distortionType, s2.distortionAmount); st.k = s2.distortionType + s2.distortionAmount }; lp.frequency.setTargetAtTime(s2.distortionTone, t, 0.02); dry.gain.setTargetAtTime(1 - s2.distortionMix, t, 0.02); wet.gain.setTargetAtTime(s2.distortionMix * 0.8, t, 0.02) }
    st.apply(s, c.currentTime, true)
    return st
  }
  _stCrush (c, s) {
    const inp = c.createGain(); const out = c.createGain(); const dry = c.createGain(); const wet = c.createGain(); const sh = c.createWaveShaper(); const pre = c.createGain()
    pre.gain.value = 0.9
    inp.connect(dry); dry.connect(out); inp.connect(pre); pre.connect(sh); sh.connect(wet); wet.connect(out)
    const st = { in: inp, out, nodes: [inp, out, dry, wet, sh, pre] }
    st.apply = (s2, t, first) => { if (first || st.b !== s2.bitcrushBits) { sh.curve = crushCurve(s2.bitcrushBits); st.b = s2.bitcrushBits }; dry.gain.setTargetAtTime(1 - s2.bitcrushMix, t, 0.02); wet.gain.setTargetAtTime(s2.bitcrushMix, t, 0.02) }
    st.apply(s, c.currentTime, true)
    return st
  }
  _stMod (c, s) {
    const inp = c.createGain(); const out = c.createGain(); const dly = c.createDelay(0.1); const wet = c.createGain(); const fb = c.createGain(); const lfo = c.createOscillator(); const amt = c.createGain(); const dry = c.createGain()
    lfo.type = 'sine'; inp.connect(dry); dry.connect(out); inp.connect(dly); dly.connect(wet); wet.connect(out); dly.connect(fb); fb.connect(dly); lfo.connect(amt); amt.connect(dly.delayTime)
    lfo.start()
    const st = { in: inp, out, nodes: [inp, out, dly, wet, fb, lfo, amt, dry], stop: () => { try { lfo.stop() } catch (_) {} } }
    st.apply = (s2, t) => { const fl = s2.modFxType === 'flanger'; const base = fl ? 0.004 : 0.022; dly.delayTime.setTargetAtTime(base, t, 0.05); amt.gain.setTargetAtTime(s2.modFxDepth * (fl ? 0.0035 : 0.008), t, 0.05); lfo.frequency.setTargetAtTime(s2.modFxRate, t, 0.05); wet.gain.setTargetAtTime(s2.modFxMix, t, 0.02); fb.gain.setTargetAtTime(fl ? s2.modFxFeedback : s2.modFxFeedback * 0.3, t, 0.02) }
    st.apply(s, c.currentTime)
    return st
  }
  _stEq (c, s) {
    const lo = c.createBiquadFilter(); const mid = c.createBiquadFilter(); const hi = c.createBiquadFilter()
    lo.type = 'lowshelf'; mid.type = 'peaking'; hi.type = 'highshelf'; lo.connect(mid); mid.connect(hi)
    const st = { in: lo, out: hi, nodes: [lo, mid, hi] }
    st.apply = (s2, t) => { lo.frequency.setTargetAtTime(s2.eqLowFreq, t, 0.02); lo.gain.setTargetAtTime(s2.eqLowDb, t, 0.02); mid.frequency.setTargetAtTime(s2.eqMidFreq, t, 0.02); mid.Q.setTargetAtTime(s2.eqMidQ, t, 0.02); mid.gain.setTargetAtTime(s2.eqMidDb, t, 0.02); hi.frequency.setTargetAtTime(s2.eqHighFreq, t, 0.02); hi.gain.setTargetAtTime(s2.eqHighDb, t, 0.02) }
    st.apply(s, c.currentTime)
    return st
  }
  _stComp (c, s) {
    const comp = c.createDynamicsCompressor(); const mk = c.createGain(); comp.connect(mk)
    const st = { in: comp, out: mk, nodes: [comp, mk] }
    st.apply = (s2, t) => { comp.threshold.setTargetAtTime(s2.compThreshold, t, 0.02); comp.ratio.setTargetAtTime(s2.compRatio, t, 0.02); comp.attack.setTargetAtTime(s2.compAttack, t, 0.02); comp.release.setTargetAtTime(s2.compRelease, t, 0.02); comp.knee.setTargetAtTime(s2.compKnee, t, 0.02); mk.gain.setTargetAtTime(dbToGain(s2.compMakeup), t, 0.02) }
    st.apply(s, c.currentTime)
    return st
  }
  _stDelay (c, s) {
    const inp = c.createGain(); const out = c.createGain(); const dry = c.createGain(); const wet = c.createGain(); const fb = c.createGain(); const tone = c.createBiquadFilter(); tone.type = 'lowpass'
    const dA = c.createDelay(2.5); inp.connect(dry); dry.connect(out)
    const nodes = [inp, out, dry, wet, fb, tone, dA]; let dB = null
    if (s.delayPingPong) {
      dB = c.createDelay(2.5); const pA = c.createStereoPanner(); const pB = c.createStereoPanner(); pA.pan.value = -0.8; pB.pan.value = 0.8
      inp.connect(dA); dA.connect(pA); pA.connect(wet); dA.connect(dB); dB.connect(pB); pB.connect(wet); dB.connect(tone); tone.connect(fb); fb.connect(dA); wet.connect(out); nodes.push(dB, pA, pB)
    } else { inp.connect(dA); dA.connect(wet); wet.connect(out); dA.connect(tone); tone.connect(fb); fb.connect(dA) }
    const st = { in: inp, out, nodes }
    st.apply = (s2, t) => { const dt = s2.delayTime / 1000; dA.delayTime.setTargetAtTime(dt, t, 0.05); if (dB) dB.delayTime.setTargetAtTime(dt, t, 0.05); fb.gain.setTargetAtTime(s2.delayFeedback, t, 0.02); tone.frequency.setTargetAtTime(s2.delayTone, t, 0.02); wet.gain.setTargetAtTime(s2.delayMix, t, 0.02) }
    st.apply(s, c.currentTime)
    return st
  }
  _stReverb (c, s) {
    const inp = c.createGain(); const out = c.createGain(); const dry = c.createGain(); const wet = c.createGain(); const pre = c.createDelay(0.5); const conv = c.createConvolver()
    inp.connect(dry); dry.connect(out); inp.connect(pre); pre.connect(conv); conv.connect(wet); wet.connect(out)
    const st = { in: inp, out, nodes: [inp, out, dry, wet, pre, conv], stop: () => { clearTimeout(st.irTimer) } }
    const setIr = (s2) => {
      const key = [s2.reverbDecay.toFixed(1), s2.reverbSize.toFixed(2), s2.reverbDamping.toFixed(2)].join(':')
      if (st.key === key) return
      st.key = key
      let b = this._irCache.get(key)
      if (!b || b.__c !== c) { b = makeImpulse(c, s2.reverbDecay, s2.reverbSize, s2.reverbDamping); b.__c = c; if (this._irCache.size > 24) this._irCache.clear(); this._irCache.set(key, b) }
      conv.buffer = b
    }
    st.apply = (s2, t, first) => {
      const m = s2.reverbMix; dry.gain.setTargetAtTime(Math.cos(m * Math.PI / 2), t, 0.02); wet.gain.setTargetAtTime(Math.sin(m * Math.PI / 2), t, 0.02); pre.delayTime.setTargetAtTime(s2.reverbPreDelay / 1000, t, 0.02)
      if (first) setIr(s2); else { clearTimeout(st.irTimer); st.irTimer = setTimeout(() => { try { setIr(s2) } catch (_) {} }, 150); st.irTimer.unref?.() }
    }
    st.apply(s, c.currentTime, true)
    return st
  }
  /** build (or rebuild with a short crossfade) the FX chain + width + pan + spatial stage. */
  _buildChain (v, first) {
    const c = this._ctx; const s = v.sound; const g = v.graph; const t = c.currentTime
    const ch = { gate: c.createGain(), stages: this._chainStages(v, c), nodes: [] }
    ch.nodes.push(ch.gate)
    let prev = ch.gate
    for (const st of ch.stages) { prev.connect(st.in); prev = st.out }
    // width (mid / side)
    const wIn = c.createGain(); wIn.channelCount = 2; wIn.channelCountMode = 'explicit'
    const sp = c.createChannelSplitter(2); const mid = c.createGain(); const side = c.createGain(); const sideW = c.createGain(); const sideInv = c.createGain(); const mg = c.createChannelMerger(2)
    const lm = c.createGain(); const rm = c.createGain(); const ls = c.createGain(); const rs = c.createGain()
    lm.gain.value = 0.5; rm.gain.value = 0.5; ls.gain.value = 0.5; rs.gain.value = -0.5; sideInv.gain.value = -1
    prev.connect(wIn); wIn.connect(sp); sp.connect(lm, 0); sp.connect(rm, 1); sp.connect(ls, 0); sp.connect(rs, 1); lm.connect(mid); rm.connect(mid); ls.connect(side); rs.connect(side)
    side.connect(sideW); sideW.connect(sideInv)
    mid.connect(mg, 0, 0); sideW.connect(mg, 0, 0); mid.connect(mg, 0, 1); sideInv.connect(mg, 0, 1)
    ch.sideW = sideW; sideW.gain.value = s.stereoWidth
    ch.nodes.push(wIn, sp, mid, side, sideW, sideInv, mg, lm, rm, ls, rs)
    // pan + auto pan
    ch.pan = c.createStereoPanner(); ch.pan.pan.value = s.positional ? 0 : s.pan
    ch.panLfo = makeLfo(c, 'sine', s.panLfoRate, () => this._randBuf()); ch.panAmt = c.createGain(); ch.panAmt.gain.value = s.panLfoDepth; ch.panLfo.out.connect(ch.panAmt); ch.panAmt.connect(ch.pan.pan); ch.panLfo.start()
    mg.connect(ch.pan); ch.nodes.push(ch.pan, ch.panAmt)
    ch.fxOut = ch.pan
    // spatial
    let last = ch.pan
    if (s.positional) {
      const pn = c.createPanner(); this._applyPanner(pn, s, v, t, true); ch.panner = pn; last.connect(pn); last = pn; ch.nodes.push(pn)
      if (s.occlusion === 'air') { const af = c.createBiquadFilter(); af.type = 'lowpass'; af.frequency.value = 20000; ch.air = af; last.connect(af); last = af; ch.nodes.push(af) }
    }
    ch.out = last
    last.connect(g.out)
    ch.fxOut.connect(g.an)
    for (const st of ch.stages) ch.nodes.push(...st.nodes)
    // crossfade from the old chain
    const old = g.chain
    g.chain = ch
    v.sig = chainSig(s)
    if (old && !first) {
      ch.gate.gain.setValueAtTime(0, t); ch.gate.gain.linearRampToValueAtTime(1, t + 0.03)
      old.gate.gain.setValueAtTime(old.gate.gain.value, t); old.gate.gain.linearRampToValueAtTime(0, t + 0.03)
      try { g.fade.disconnect(old.gate) } catch (_) {}
      setTimeout(() => this._disposeChain(old), 120).unref?.()
    } else if (old) this._disposeChain(old)
    g.fade.connect(ch.gate)
  }
  _disposeChain (ch) {
    try { ch.panLfo.dispose() } catch (_) {}
    for (const st of ch.stages) try { st.stop?.() } catch (_) {}
    for (const n of ch.nodes) try { n.disconnect() } catch (_) {}
  }
  _applyPanner (pn, s, v, t, init) {
    try {
      pn.panningModel = s.panningModel; pn.distanceModel = s.distanceModel; pn.refDistance = s.refDistance; pn.maxDistance = s.maxDistance; pn.rolloffFactor = s.rolloff
      pn.coneInnerAngle = s.coneInner; pn.coneOuterAngle = s.coneOuter; pn.coneOuterGain = s.coneOuterGain
      const az = s.coneAzimuth * Math.PI / 180; const el = s.coneElevation * Math.PI / 180
      const ox = Math.sin(az) * Math.cos(el); const oy = Math.sin(el); const oz = -Math.cos(az) * Math.cos(el)
      if (pn.orientationX) { pn.orientationX.value = ox; pn.orientationY.value = oy; pn.orientationZ.value = oz } else pn.setOrientation?.(ox, oy, oz)
      if (init) this._placePanner(v, pn, t)
    } catch (_) {}
  }
  _worldPos (v) {
    try { const p = v.ctx?.getWorldPosition?.(); if (p && Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z)) return [p.x, p.y, p.z] } catch (_) {}
    return null
  }
  _placePanner (v, pn, t) {
    const p = this._worldPos(v); if (!p) return
    v.pos = p
    if (pn.positionX) { pn.positionX.setValueAtTime(p[0], t); pn.positionY.setValueAtTime(p[1], t); pn.positionZ.setValueAtTime(p[2], t) } else pn.setPosition?.(p[0], p[1], p[2])
  }

  // ── notes (real graph) ───────────────────────────────────────────────────────────────────────────────────────────────
  _waveFor (s, forWave, harm) {
    const c = this._ctx; const N = 64
    const real = new Float32Array(N + 1); const imag = new Float32Array(N + 1)
    if (harm) { for (let k = 1; k <= N; k++) imag[k] = harm(k) }
    return { real, imag, c }
  }
  _partials (s, which) {
    // returns function k -> amplitude (sine partials), or null for native waves
    const pw = s.pulseWidth
    const w = which
    if (w === 'custom') { const arr = String(s.customPartials).split(',').map(x => parseFloat(x)).filter(x => Number.isFinite(x)); const a = arr.length ? arr : [1]; return { amp: (k) => (k <= a.length ? a[k - 1] : 0) } }
    if (w === 'sine') return { amp: (k) => (k === 1 ? 1 : 0) }
    if (w === 'square') {
      if (Math.abs(pw - 0.5) < 0.005) return { amp: (k) => (k % 2 ? 4 / (Math.PI * k) : 0) }
      return { cs: (k) => 2 / (k * Math.PI) * Math.sin(k * Math.PI * pw), sn: (k) => 2 / (k * Math.PI) * (1 - Math.cos(k * Math.PI * pw)) }
    }
    if (w === 'sawtooth') return { amp: (k) => 2 / (Math.PI * k) * (k % 2 ? 1 : -1) }
    if (w === 'triangle') return { amp: (k) => (k % 2 ? 8 / (Math.PI * Math.PI * k * k) * ((k - 1) / 2 % 2 ? -1 : 1) : 0) }
    return null
  }
  _periodic (s, which, extra = null) {
    const c = this._ctx; const N = 64
    const real = new Float32Array(N + 1); const imag = new Float32Array(N + 1)
    const ph = s.phase * Math.PI / 180
    if (extra) { for (let k = 1; k <= N; k++) { const a = extra(k); const co = Math.cos(k * ph); const si = Math.sin(k * ph); imag[k] = a * co; real[k] = a * si } }
    else {
      const p = this._partials(s, which); if (!p) return null
      for (let k = 1; k <= N; k++) {
        let a; let b
        if (p.amp) { a = 0; b = p.amp(k) } else { a = p.cs(k); b = p.sn(k) }
        const co = Math.cos(k * ph); const si = Math.sin(k * ph)
        real[k] = a * co + b * si; imag[k] = b * co - a * si
      }
    }
    try { return c.createPeriodicWave(real, imag) } catch (_) { return null }
  }
  _additiveWave (s) {
    const n = Math.max(1, s.additiveHarmonics)
    return this._periodic(s, null, (k) => (k > n || (s.additiveOddOnly && k % 2 === 0) ? 0 : 1 / Math.pow(k, s.additiveRolloff)) * 0.9)
  }
  _setOscWave (osc, s, which) {
    const needCustom = which === 'custom' || s.phase !== 0 || (which === 'square' && Math.abs(s.pulseWidth - 0.5) > 0.005)
    if (which === 'additive') { const w = this._additiveWave(s); if (w) { osc.setPeriodicWave(w); return } osc.type = 'sine'; return }
    if (needCustom) { const w = this._periodic(s, which); if (w) { osc.setPeriodicWave(w); return } }
    osc.type = which === 'custom' ? 'sine' : which
  }
  _buildNote (v, n) {
    const c = this._ctx; const s = v.sound; const g = v.graph; const at = n.tOn; const spec = n.spec
    n.sources = []
    const mk = (x) => { n.nodes.push(x); return x }
    const mix = mk(c.createGain())
    const startSrc = (src) => { src.start(at); n.sources.push(src) }
    const tuneOsc = (osc, mult, startF, base = 0) => {
      const f = n.freq * mult
      const sf = startF != null && s.glide > 0 ? startF * mult : f
      osc.frequency.setValueAtTime(sf, at)
      if (s.glide > 0 && startF != null) osc.frequency.setTargetAtTime(f, at, Math.max(0.005, s.glide / 3000))
      n.tune.push({ param: osc.frequency, mult })
      g.pitchBus.connect(osc.detune)
      if (s.pitchEnvAmount !== 0) { osc.detune.setValueAtTime(base + s.pitchEnvAmount, at); osc.detune.setTargetAtTime(base, at, Math.max(0.002, s.pitchEnvTime / 3)) }
    }
    const lastF = v.lastFreq
    const type = s.sourceType
    if (type === 'noise') {
      const src = mk(c.createBufferSource()); src.buffer = this._noiseBuf(s.noiseType); src.loop = true; src.connect(mix); startSrc(src)
    } else if (type === 'sample') {
      const key = this._sampleKey(s); const entry = key ? this._samples.get(key) : null
      const buf = entry && entry.getChannelData ? entry : null
      if (!buf) { if (key && !entry) this._kickSample(v, n); n.tEnd = at; n.sources = []; n.nodes = []; n.dead = true; mix.disconnect(); return }
      const src = mk(c.createBufferSource())
      src.buffer = s.reverse ? this._reversed(key, buf) : buf
      const rate = s.playbackRate * (s.sampleKeyTrack ? n.freq / 440 : 1)
      src.playbackRate.value = rate; src.loop = !!(n.tRel == null || s.loop)
      try { g.pitchBus.connect(src.detune) } catch (_) {}
      if (s.sampleKeyTrack) n.tune.push({ param: src.playbackRate, mult: s.playbackRate / 440 })
      src.connect(mix); src.start(at, Math.min(s.startOffset, Math.max(0, buf.duration - 0.01))); n.sources.push(src)
    } else {
      const base = type === 'additive' ? 'additive' : (type === 'fm' ? 'sine' : s.waveform)
      const N = type === 'oscillator' || type === 'additive' ? Math.round(s.unisonVoices) : 1
      for (let i = 0; i < N; i++) {
        const osc = mk(c.createOscillator()); this._setOscWave(osc, s, base)
        const off = N > 1 ? (i / (N - 1) * 2 - 1) : 0
        osc.detune.value = off * s.unisonDetune
        tuneOsc(osc, 1, lastF, off * s.unisonDetune)
        if (N > 1) { const gg = mk(c.createGain()); gg.gain.value = 1 / Math.sqrt(N); const pp = mk(c.createStereoPanner()); pp.pan.value = off * s.unisonSpread; osc.connect(gg); gg.connect(pp); pp.connect(mix) } else osc.connect(mix)
        if (type === 'fm') {
          const mod = mk(c.createOscillator()); mod.type = s.fmWaveform; const mg = mk(c.createGain())
          const ratio = s.fmRatio; tuneOsc(mod, ratio, lastF)
          const dev = s.fmDepth * n.freq * ratio
          mg.gain.setValueAtTime(dev, at)
          if (s.fmDecay > 0) { mg.gain.setValueAtTime(dev, at); mg.gain.setTargetAtTime(dev * 0.05, at, s.fmDecay / 3) }
          n.fmGain = mg
          mod.connect(mg); mg.connect(osc.frequency); startSrc(mod)
        }
        startSrc(osc)
      }
      if (s.subEnabled) {
        const so = mk(c.createOscillator()); so.type = s.subWaveform; const mult = Math.pow(2, parseInt(s.subOctave, 10)); tuneOsc(so, mult, lastF)
        const sg = mk(c.createGain()); sg.gain.value = s.subLevel * 0.8; so.connect(sg); sg.connect(mix); startSrc(so)
      }
    }
    if (s.noiseLevel > 0 && type !== 'noise') { const ns = mk(c.createBufferSource()); ns.buffer = this._noiseBuf('white'); ns.loop = true; const ng = mk(c.createGain()); ng.gain.value = s.noiseLevel * 0.5; ns.connect(ng); ng.connect(mix); startSrc(ns) }
    // filter (per note, so the envelope is per note)
    let tail = mix
    if (s.filterEnabled) {
      const f1 = mk(c.createBiquadFilter()); f1.type = s.filterType
      const cut = clamp(s.filterCutoff * Math.pow(2, s.filterKeyTrack * Math.log2(Math.max(20, n.freq) / 261.63) + spec.filterOct), 20, c.sampleRate * 0.45)
      f1.frequency.value = cut; f1.Q.value = s.filterQ; f1.gain.value = s.filterGainDb
      n.filters.push(f1); n.cut = cut
      tail.connect(f1); tail = f1
      if (s.filterSlope === '24' && ['lowpass', 'highpass', 'bandpass', 'notch'].includes(s.filterType)) { const f2 = mk(c.createBiquadFilter()); f2.type = s.filterType; f2.frequency.value = cut; f2.Q.value = 0.707; n.filters.push(f2); tail.connect(f2); tail = f2 }
      for (const f of n.filters) g.detuneBus.connect(f.detune)
      if (s.filterEnvAmount !== 0) {
        const co = mk(c.createConstantSource()); co.offset.setValueAtTime(0, at)
        const peak = s.filterEnvAmount * 1200
        co.offset.linearRampToValueAtTime(peak, at + Math.max(0.002, s.filterEnvAttack))
        co.offset.setTargetAtTime(peak * s.filterEnvSustain, at + Math.max(0.002, s.filterEnvAttack), Math.max(0.005, s.filterEnvDecay / 3))
        for (const f of n.filters) co.connect(f.detune)
        startSrc(co); n.fEnv = co
      }
    }
    // amplitude envelope
    n.env = mk(c.createGain())
    const pts = envPoints(n.p, n.tRel == null ? null : n.tRel - at)
    n.env.gain.setValueAtTime(0, at)
    for (let i = 1; i < pts.length; i++) n.env.gain.linearRampToValueAtTime(pts[i][1], at + pts[i][0])
    if (n.tRel == null && n.p.sdb > 0) { const tD = at + n.p.a + n.p.h + n.p.d; n.env.gain.setTargetAtTime(0, tD, 1 / (n.p.sdb * Math.LN10 / 20)) }
    tail.connect(n.env)
    n.trim = mk(c.createGain()); n.trim.gain.value = dbToGain(spec.gainDb)
    n.env.connect(n.trim); let out = n.trim
    if (spec.pan !== 0) { const pp = mk(c.createStereoPanner()); pp.pan.value = spec.pan; out.connect(pp); out = pp }
    out.connect(g.bus)
    if (n.tRel != null) for (const src of n.sources) try { src.stop(n.tEnd + 0.03) } catch (_) {}
  }
  _reversed (key, buf) {
    const k = key + ':rev'; let b = this._buffers.get(k)
    if (!b) { b = this._ctx.createBuffer(buf.numberOfChannels, buf.length, buf.sampleRate); for (let ch = 0; ch < buf.numberOfChannels; ch++) { const d = buf.getChannelData(ch); const r = b.getChannelData(ch); for (let i = 0; i < d.length; i++) r[i] = d[d.length - 1 - i] } this._buffers.set(k, b) }
    return b
  }

  // ── live update (real graph) ─────────────────────────────────────────────────────────────────────────────────────────
  _applyLive (v, old, changed) {
    const c = this._ctx; const s = v.sound; const g = v.graph; const t = c.currentTime; const has = (set) => changed.some(k => set.has(k))
    if (chainSig(s) !== v.sig) this._buildChain(v, false)
    else {
      const ch = g.chain
      for (const st of ch.stages) st.apply(s, t, false)
      ch.sideW.gain.setTargetAtTime(s.stereoWidth, t, 0.02)
      ch.pan.pan.setTargetAtTime(s.positional ? 0 : s.pan, t, 0.02)
      ch.panAmt.gain.setTargetAtTime(s.panLfoDepth, t, 0.02); ch.panLfo.setRate(s.panLfoRate, t)
      if (ch.panner) this._applyPanner(ch.panner, s, v, t, false)
    }
    if (has(DYN_KEYS)) {
      if (!s.crescendoEnabled) {
        for (const p of [g.dyn.gain, g.cresBright.offset, g.cresPitch.offset]) { const cur = p.value; p.cancelScheduledValues(t); p.setValueAtTime(cur, t) }   // an active value curve must be cancelled before anything else is scheduled
        g.dyn.gain.setTargetAtTime(dynamicsGainAt(s, 0), t, 0.03); g.cresBright.offset.setTargetAtTime(0, t, 0.03); g.cresPitch.offset.setTargetAtTime(0, t, 0.03); v.cresUntil = 0
      }
      else {
        if (!old.crescendoEnabled) v.cresT0 = t
        const cur = Math.max(1e-5, g.dyn.gain.value); g.dyn.gain.cancelScheduledValues(t); g.dyn.gain.setValueAtTime(cur, t)
        g.cresBright.offset.cancelScheduledValues(t); g.cresPitch.offset.cancelScheduledValues(t)
        v.cresUntil = t + 0.005; this._extendCrescendo(v, t)
      }
    }
    if (changed.some(k => k.startsWith('vibrato') || k === 'lfoDrift')) { g.vib.setShape(s.vibratoShape); g.vib.setRate(s.vibratoRate, t); this._schedVibrato(v, t); this._applyLfoDrift(v, t) }
    if (changed.some(k => k.startsWith('tremolo') || k === 'lfoDrift')) { g.tremLfo.setShape(s.tremoloShape, s.tremoloPhase); g.tremLfo.setRate(s.tremoloRate, t); this._schedTremolo(v, t); this._applyLfoDrift(v, t) }
    if (changed.some(k => k.startsWith('filterLfo'))) { g.fLfo.setShape(s.filterLfoShape); g.fLfo.setRate(s.filterLfoRate, t); g.fLfoAmt.gain.setTargetAtTime(s.filterLfoDepth * 1200, t, 0.05) }
    if (changed.some(k => k.startsWith('sustainDrift') || k === 'sustainBrightDrift')) { g.dA.setRate(s.sustainDriftRate, t); g.dB.setRate(s.sustainDriftRate * 1.618, t); g.drift.gain.setTargetAtTime(1 - 0.3 * s.sustainDrift, t, 0.05); g.dAmp.gain.setTargetAtTime(0.3 * s.sustainDrift, t, 0.05); g.dBright.gain.setTargetAtTime(s.sustainBrightDrift * 1200, t, 0.05) }
    if (changed.some(k => k === 'fftSize' || k === 'smoothing' || k === 'minDb' || k === 'maxDb')) { this._configAnalyser(g.an, s); g.tap = this._makeTap(g.an, g.an.fftSize) }
    if (changed.includes('muted')) { /* muted is applied in the voice-out gain below */ }
    g.out.gain.setTargetAtTime(s.muted ? 0 : 1, t, 0.02)
    // currently sounding notes
    const restart = has(SRC_KEYS)
    for (const n of [...v.notes]) {
      if (n.dead) continue
      if (restart && n.tRel == null && n.tOn <= t) {
        const spec = n.spec; this._releaseNote(v, n, t)
        const nn = this._playNote(v, spec, t + 0.005); void nn
        continue
      }
      if (has(PITCH_KEYS)) this._retuneNote(v, n, n.spec, t)
      if (has(FILTER_KEYS)) for (const f of n.filters) { const cut = clamp(s.filterCutoff * Math.pow(2, s.filterKeyTrack * Math.log2(Math.max(20, n.freq) / 261.63) + n.spec.filterOct), 20, c.sampleRate * 0.45); f.frequency.setTargetAtTime(cut, t, 0.03); f.Q.setTargetAtTime(s.filterQ, t, 0.03); f.gain.setTargetAtTime(s.filterGainDb, t, 0.03) }
      if (n.tRel == null && changed.includes('sustainLevel') && n.env) { n.p.s = s.sustainLevel; const el = t - n.tOn; if (el > n.p.a + n.p.h + n.p.d) n.env.gain.setTargetAtTime(s.sustainLevel, t, 0.05) }
    }
  }

  // ── doppler / spatial ───────────────────────────────────────────────────────────────────────────────────────────────
  setListener (pos, fwd, up) {
    const L = this._listener; const old = L.pos
    L.pos = [num(pos?.x ?? pos?.[0]), num(pos?.y ?? pos?.[1]), num(pos?.z ?? pos?.[2])]
    L.fwd = [num(fwd?.x ?? fwd?.[0]), num(fwd?.y ?? fwd?.[1], 0), num(fwd?.z ?? fwd?.[2], -1)]
    L.up = [num(up?.x ?? up?.[0]), num(up?.y ?? up?.[1], 1), num(up?.z ?? up?.[2])]
    L.prev = old
    if (this._ctx && !this._isFake()) {
      const t = this._ctx.currentTime; const l = this._ctx.listener
      try {
        if (l.positionX) { l.positionX.setValueAtTime(L.pos[0], t); l.positionY.setValueAtTime(L.pos[1], t); l.positionZ.setValueAtTime(L.pos[2], t); l.forwardX.setValueAtTime(L.fwd[0], t); l.forwardY.setValueAtTime(L.fwd[1], t); l.forwardZ.setValueAtTime(L.fwd[2], t); l.upX.setValueAtTime(L.up[0], t); l.upY.setValueAtTime(L.up[1], t); l.upZ.setValueAtTime(L.up[2], t) } else { l.setPosition?.(...L.pos); l.setOrientation?.(...L.fwd, ...L.up) }
      } catch (_) {}
    }
  }
  /** call once per frame (the scene does): moves panners to the node positions, updates air absorption and doppler. */
  updateSpatial (dt = 0.016) {
    const L = this._listener
    for (const v of this._voices.values()) {
      const s = v.sound
      if (!s.positional) continue
      const p = this._worldPos(v); if (!p) continue
      const prev = v.pos; v.pos = p
      const d = Math.hypot(p[0] - L.pos[0], p[1] - L.pos[1], p[2] - L.pos[2]); v.distance = d
      if (this._isFake() || !v.graph?.chain?.panner) continue
      const t = this._ctx.currentTime; const pn = v.graph.chain.panner
      try { if (pn.positionX) { pn.positionX.setTargetAtTime(p[0], t, 0.03); pn.positionY.setTargetAtTime(p[1], t, 0.03); pn.positionZ.setTargetAtTime(p[2], t, 0.03) } else pn.setPosition?.(...p) } catch (_) {}
      if (v.graph.chain.air) try { v.graph.chain.air.frequency.setTargetAtTime(clamp(20000 / (1 + d / Math.max(0.1, s.refDistance) * 0.35), 700, 20000), t, 0.1) } catch (_) {}
      if (s.doppler && prev && dt > 0) {
        const dx = p[0] - L.pos[0]; const dy = p[1] - L.pos[1]; const dz = p[2] - L.pos[2]; const dist = Math.hypot(dx, dy, dz) || 1
        const pd = Math.hypot(prev[0] - (L.prev?.[0] ?? L.pos[0]), prev[1] - (L.prev?.[1] ?? L.pos[1]), prev[2] - (L.prev?.[2] ?? L.pos[2]))
        const vr = (dist - pd) / dt   // positive = receding
        const ratio = clamp(343 / (343 + vr), 0.8, 1.25)
        v.dopplerCents = 1200 * Math.log2(ratio)
        try { v.graph.doppler.offset.setTargetAtTime(v.dopplerCents, t, 0.05) } catch (_) {}
      } else if (v.dopplerCents) { v.dopplerCents = 0; try { v.graph.doppler.offset.setTargetAtTime(0, t, 0.05) } catch (_) {} }
    }
  }

  // ── analysis ────────────────────────────────────────────────────────────────────────────────────────────────────────────
  getAnalysis (nodeId) {
    if (nodeId === 'master') return this.getMasterAnalysis()
    if (nodeId === 'mixer') return this.getMixerAnalysis()
    const v = this._voices.get(String(nodeId))
    if (!v) return null
    return this._isFake() ? this._fakeAnalysis(v) : this._realAnalysis(v)
  }
  getMasterAnalysis () {
    if (this._isFake()) return this._fakeMaster()
    if (!this._masterTap) return null
    return this._readTap(this._masterTap, 'master', { playing: this._voices.size > 0 || !!this._mixer, phase: 'sustain', iteration: 0, loopCount: 0, dynamicNow: 'mf' }, this._masterTap.an, { bandSmoothing: 0.6, bandGain: 1, peakThreshold: 0.02 })
  }
  getMixerAnalysis () { return this._mixer ? this._readTap(this._mixer.tap, 'mixer', { playing: !this._mixer.el.paused, phase: 'sustain', iteration: 0, loopCount: 0, dynamicNow: 'mf' }, this._mixer.tap.an, { bandSmoothing: 0.6, bandGain: 1, peakThreshold: 0.02 }) : null }
  _readTap (tap, id, extra, an, opt) {
    if (tap.spec.length !== an.frequencyBinCount) { tap.spec = new Uint8Array(an.frequencyBinCount); tap.wave = new Uint8Array(an.fftSize) }
    an.getByteFrequencyData(tap.spec); an.getByteTimeDomainData(tap.wave)
    let sum = 0
    for (let i = 0; i < tap.wave.length; i++) { const x = (tap.wave[i] - 128) / 128; sum += x * x }
    const rms = Math.sqrt(sum / tap.wave.length)
    const sr = this._ctx.sampleRate
    bandsFromSpectrum(tap.spec, sr, tap.bands, opt.bandGain)
    const now = performance.now(); const dt = tap.lastT ? Math.min(0.2, (now - tap.lastT) / 1000) : 0.016; tap.lastT = now
    const a = 1 - Math.pow(clamp(opt.bandSmoothing, 0, 0.99), dt * 60)
    const bands = {}
    BAND_NAMES.forEach((nm, i) => { tap.sm[i] += (tap.bands[i] - tap.sm[i]) * a; bands[nm] = tap.sm[i] })
    tap.level += (levelFromRms(rms) - tap.level) * Math.max(a, 0.3)
    return { nodeId: id, playing: extra.playing, phase: extra.phase, level: clamp(tap.level, 0, 1), rms, bands, peakHz: peakFromSpectrum(tap.spec, sr, opt.peakThreshold), spectrum: tap.spec, waveform: tap.wave, binCount: tap.spec.length, sampleRate: sr, iteration: extra.iteration, loopCount: extra.loopCount, dynamicNow: extra.dynamicNow }
  }
  _realAnalysis (v) {
    const g = v.graph; if (!g) return null
    const now = this._now()
    if (!v.sound.analysisEnabled) return this._silentAnalysis(v, now)
    if (g.tap.an !== g.an) g.tap = this._makeTap(g.an, g.an.fftSize)
    const s = v.sound
    const ph = this._phaseNow(v, now)
    const dyn = s.crescendoEnabled ? gainToDynamic(dynamicsGainAt(s, now - v.cresT0) / (dbToGain(s.gainDb) * (0.4 + 0.6 * s.velocity))) : s.dynamic
    return this._readTap(g.tap, v.id, { playing: !v.stopping && !v.finished, phase: ph, iteration: v.iteration, loopCount: v.loopCount, dynamicNow: dyn }, g.an, s)
  }

  // ── fake engine: deterministic synthetic analysis ─────────────────────────────────────────────────────────────────────
  _fakePartials (s, f0) {
    const out = []
    const add = (f, a) => { if (f > 20 && f < 20000 && a > 0.0005) out.push([f, a]) }
    if (s.sourceType === 'noise') {
      for (let k = 0; k < 40; k++) { const f = 40 * Math.pow(1.15, k); const slope = s.noiseType === 'pink' ? 1 / Math.sqrt(f / 40) : s.noiseType === 'brown' ? 40 / f : 1; add(f, 0.08 * slope) }
    } else if (s.sourceType === 'fm') { for (let k = -4; k <= 4; k++) add(Math.abs(f0 + k * f0 * s.fmRatio), Math.pow(0.55, Math.abs(k)) * (k === 0 ? 1 : Math.min(1, s.fmDepth / 4))) }
    else if (s.sourceType === 'additive') { for (let k = 1; k <= s.additiveHarmonics; k++) if (!(s.additiveOddOnly && k % 2 === 0)) add(f0 * k, 1 / Math.pow(k, s.additiveRolloff)) }
    else if (s.sourceType === 'sample') { for (let k = 1; k <= 6; k++) add(f0 * k, 1 / k) }
    else {
      const w = s.waveform
      for (let k = 1; k <= 32; k++) {
        let a = 0
        if (w === 'sine') a = k === 1 ? 1 : 0
        else if (w === 'square') a = k % 2 ? 1 / k : 0
        else if (w === 'sawtooth') a = 1 / k
        else if (w === 'triangle') a = k % 2 ? 1 / (k * k) : 0
        else { const arr = String(s.customPartials).split(',').map(x => parseFloat(x)).filter(Number.isFinite); a = k <= arr.length ? arr[k - 1] : 0 }
        add(f0 * k, a)
      }
    }
    if (s.subEnabled) add(f0 * Math.pow(2, parseInt(s.subOctave, 10)), s.subLevel)
    return out
  }
  _silentAnalysis (v, now) {
    const z = v.zero || (v.zero = { spec: new Uint8Array(1024), wave: new Uint8Array(2048).fill(128) }); const bands = {}; BAND_NAMES.forEach(n => { bands[n] = 0 })
    return { nodeId: v.id, playing: !v.stopping && !v.finished, phase: this._phaseNow(v, now), level: 0, rms: 0, bands, peakHz: 0, spectrum: z.spec, waveform: z.wave, binCount: 1024, sampleRate: this._ctx ? this._ctx.sampleRate : 48000, iteration: v.iteration, loopCount: v.loopCount, dynamicNow: v.sound.dynamic, analysisOff: true }
  }
  _fakeAnalysis (v) {
    const now = this._now(); const s = v.sound
    if (!s.analysisEnabled) return this._silentAnalysis(v, now)
    const sr = 48000; const fft = parseInt(s.fftSize, 10) || 2048; const bins = fft / 2
    if (!v.fake || v.fake.bins !== bins) v.fake = { spec: new Uint8Array(bins), wave: new Uint8Array(fft), bands: [0, 0, 0, 0, 0, 0, 0], sm: [0, 0, 0, 0, 0, 0, 0], bins, lvl: 0 }
    const F = v.fake
    let amp = 0; let semi = 0; let nact = 0
    for (const n of v.notes) {
      const lv = adsrLevel(n.p, now - n.tOn, n.tRel == null ? null : n.tRel - n.tOn)
      if (lv > amp) { amp = lv; semi = n.spec.semi }
      if (now >= n.tOn) nact++
    }
    const gainNow = dynamicsGainAt(s, now - v.t0) * (s.muted ? 1 : 1)
    const total = amp * gainNow
    const f0 = soundFrequency(s) * Math.pow(2, semi / 12)
    F.spec.fill(0)
    const binHz = sr / 2 / bins; const minDb = s.minDb; const maxDb = s.maxDb
    const cutoff = s.filterEnabled ? s.filterCutoff * (1 + s.filterEnvAmount * 0.0) : 0
    for (const [f, a0] of this._fakePartials(s, f0)) {
      let a = a0 * total
      if (cutoff && s.filterType === 'lowpass') a *= 1 / (1 + Math.pow(f / cutoff, 4))
      else if (cutoff && s.filterType === 'highpass') a *= 1 / (1 + Math.pow(cutoff / f, 4))
      else if (cutoff && s.filterType === 'bandpass') a *= 1 / (1 + Math.pow(Math.log2(f / cutoff) * s.filterQ, 2))
      if (a < 1e-5) continue
      const db = 20 * Math.log10(a) - 6
      const val = clamp((db - minDb) / (maxDb - minDb), 0, 1) * 255
      const fb = f / binHz; const i0 = Math.round(fb)
      for (let i = i0 - 2; i <= i0 + 2; i++) if (i >= 0 && i < bins) { const w = Math.exp(-Math.pow(i - fb, 2) / 0.8); F.spec[i] = Math.max(F.spec[i], Math.round(val * w)) }
    }
    const w = s.analysisEnabled
    bandsFromSpectrum(F.spec, sr, F.bands, s.bandGain)
    const bands = {}
    BAND_NAMES.forEach((nm, i) => { F.sm[i] = F.sm[i] + (F.bands[i] - F.sm[i]) * (1 - clamp(s.bandSmoothing, 0, 0.99) * 0.5); bands[nm] = F.sm[i] })
    void w
    const rms = total * 0.5
    const lvl = levelFromRms(rms) * (total > 0.0005 ? 1 : 0)
    // waveform: fundamental plus 2 harmonics
    for (let i = 0; i < fft; i++) { const tt = i / sr; F.wave[i] = Math.round(128 + 127 * clamp(total * (Math.sin(2 * Math.PI * f0 * tt) + 0.3 * Math.sin(4 * Math.PI * f0 * tt)), -1, 1)) }
    const ph = this._phaseNow(v, now)
    const dyn = s.crescendoEnabled ? gainToDynamic(dynamicsGainAt(s, now - v.t0) / (dbToGain(s.gainDb) * (0.4 + 0.6 * s.velocity))) : s.dynamic
    return { nodeId: v.id, playing: !v.stopping && !v.finished, phase: ph, level: lvl, rms, bands, peakHz: total > 0.0005 ? peakFromSpectrum(F.spec, sr, s.peakThreshold) : 0, spectrum: F.spec, waveform: F.wave, binCount: bins, sampleRate: sr, iteration: v.iteration, loopCount: v.loopCount, dynamicNow: dyn }
  }
  _fakeMaster () {
    const list = [...this._voices.values()].map(v => this._fakeAnalysis(v))
    const bins = 1024; const spec = this._fakeMasterSpec || (this._fakeMasterSpec = new Uint8Array(bins)); const wave = this._fakeMasterWave || (this._fakeMasterWave = new Uint8Array(2048).fill(128))
    spec.fill(0)
    const bands = {}; BAND_NAMES.forEach(n => { bands[n] = 0 })
    let level = 0; let peak = 0; let pv = 0
    for (const a of list) {
      for (let i = 0; i < Math.min(bins, a.spectrum.length); i++) if (a.spectrum[i] > spec[i]) spec[i] = a.spectrum[i]
      BAND_NAMES.forEach(n => { bands[n] = Math.min(1, bands[n] + a.bands[n]) }); level = Math.min(1, level + a.level)
      if (a.level >= pv) { pv = a.level; peak = a.peakHz }
    }
    return { nodeId: 'master', playing: list.some(a => a.playing), phase: list.length ? list[0].phase : 'idle', level: level * this._volume * (this._muted ? 0 : 1), rms: 0, bands, peakHz: peak, spectrum: spec, waveform: wave, binCount: bins, sampleRate: 48000, iteration: 0, loopCount: 0, dynamicNow: 'mf' }
  }

  // ── OmniMixer bridge ────────────────────────────────────────────────────────────────────────────────────────────────────
  /**
   * Route an <audio> element (the OmniMixer channels) through an analyser so the mixer's output is visible to the viewers / particles as
   * getAnalysis('mixer') and mixed into getMasterAnalysis(). The element keeps its own volume and is NOT affected by the sound master volume.
   * createMediaElementSource() silences the element until the context runs, so this only works (and is only attempted) after unlock().
   * An element can be bridged once per page. Returns true if bridged.
   */
  bridgeMediaElement (el, id = 'mixer') {
    if (this._isFake() || !el || !this._ctx || this._ctx.state !== 'running') return false
    if (this._mixerEls?.has(el)) return true
    try {
      const c = this._ctx
      if (!this._mixer) {
        const bus = c.createGain(); const an = c.createAnalyser(); an.fftSize = 2048; an.smoothingTimeConstant = 0.8
        bus.connect(an); bus.connect(this._master.lim)   // the analyser is a tap only; the mix is heard through the limiter and counted in the master analysis
        this._mixer = { bus, el, tap: this._makeTap(an, 2048), id }
        this._mixerEls = new WeakSet()
      }
      // the master analysis includes the mixer: feed the mixer bus into the master analyser too (analysis only)
      const src = c.createMediaElementSource(el)
      src.connect(this._mixer.bus); this._mixerEls.add(el); this._mixer.el = el
      return true
    } catch (e) { return false }
  }

  // ── teardown ────────────────────────────────────────────────────────────────────────────────────────────────────────────
  _disposeVoice (v) {
    if (this._voices.get(v.id) === v) this._voices.delete(v.id)
    for (const n of [...v.notes]) this._disposeNote(n)
    v.notes = []
    const g = v.graph
    if (g) {
      for (const l of g.lfos || []) try { l.dispose() } catch (_) {}
      for (const n of [g.cresPitch, g.doppler, g.cresBright]) try { n.stop() } catch (_) {}
      if (g.chain) this._disposeChain(g.chain)
      for (const n of g.nodes) try { n.disconnect() } catch (_) {}
      v.graph = null
    }
    if (!this._voices.size && !this._dying.size && this._timer) { clearInterval(this._timer); this._timer = null }
  }
  /** stop everything, close the context, remove listeners (tests / hot reload). */
  dispose () {
    this.stopAll({ immediate: true })
    for (const v of [...this._voices.values()]) this._disposeVoice(v)
    if (this._timer) { clearInterval(this._timer); this._timer = null }
    this._removeUnlockListeners()
    try { this._ctx?.close?.() } catch (_) {}
    this._ctx = null; this._master = null; this._masterTap = null; this._mixer = null
  }
}

const SoundEngine = new OmniSoundEngine()
export { SoundEngine }
export default SoundEngine
