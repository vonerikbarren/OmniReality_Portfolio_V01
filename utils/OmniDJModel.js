/**
 * utils/OmniDJModel.js (V195) — pure model of the OmniDJ: 6 channels, EQ dB mapping, crossfader curves, pitch, jog maths, sanitizers.
 * No DOM, no audio. Used by systems/OmniDJDecks.js (the audio) and ui/OmniDJ.js (the controls). Hostile input in -> valid state out.
 */

export const DECKS = 6
export const EQ_BANDS = Object.freeze(['low', 'mid', 'high'])
/** Filter centre / corner frequencies (Hz): low shelf, mid peak, high shelf. */
export const EQ_FREQ = Object.freeze({ low: 250, mid: 1000, high: 4000 })
export const EQ_DB_MIN = -48   // knob fully left = kill
export const EQ_DB_MAX = 12
export const ASSIGNS = Object.freeze(['A', 'T', 'B'])   // crossfader side A, Thru (not crossfaded), side B
export const CURVES = Object.freeze(['constant-power', 'linear'])
export const RATE_RANGES = Object.freeze([0.06, 0.08, 0.16, 0.5])   // pitch fader range: +-6 %, +-8 %, +-16 %, +-50 %
export const RATE_MIN = 0.25
export const RATE_MAX = 4
/** One revolution of a jog wheel = 1.8 s of music (33 1/3 rpm), the usual CDJ feel. */
export const JOG_SECONDS_PER_REV = 1.8
export const JOG_DEG_PER_SEC = 360 / JOG_SECONDS_PER_REV   // 200 deg/s at rate 1

const isNum = (v) => typeof v === 'number' && Number.isFinite(v)
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
export const num = (v, def, lo = -Infinity, hi = Infinity) => {
  const n = typeof v === 'string' && v.trim() !== '' && v.length < 24 ? Number(v) : v
  return isNum(n) ? clamp(n, lo, hi) : def
}
const pickOf = (v, list, def) => (typeof v === 'string' && list.includes(v) ? v : def)

// ── mapping ──────────────────────────────────────────────────────────────────────────────────────────────────────────
/** EQ knob 0..1 (0.5 = flat) -> dB: 0 = -48 (kill), 0.5 = 0, 1 = +12. */
export function eqDb (v) {
  const x = clamp(num(v, 0.5), 0, 1)
  return x <= 0.5 ? EQ_DB_MIN * (1 - x / 0.5) : EQ_DB_MAX * ((x - 0.5) / 0.5)
}
export function dbToEq (db) {
  const d = clamp(num(db, 0), EQ_DB_MIN, EQ_DB_MAX)
  return d <= 0 ? 0.5 * (1 + d / -EQ_DB_MIN) : 0.5 + 0.5 * (d / EQ_DB_MAX)
}
export const dbToGain = (db) => Math.pow(10, db / 20)
export const gainToDb = (g) => (g > 1e-6 ? 20 * Math.log10(g) : -120)
/** Fader / master 0..1 -> linear gain (a square taper: 0.8 = -3.9 dB, 0.5 = -12 dB, 0 = silence). */
export const volumeGain = (v) => { const x = clamp(num(v, 0), 0, 1); return x * x }

/** Crossfader position -1 (all A) .. +1 (all B) -> { a, b } gains. constant-power: equal loudness through the middle. */
export function crossGains (pos, curve = 'constant-power') {
  const x = (clamp(num(pos, 0), -1, 1) + 1) / 2
  if (curve === 'linear') return { a: 1 - x, b: x }
  return { a: Math.cos(x * Math.PI / 2), b: Math.sin(x * Math.PI / 2) }
}
/** The gain the crossfader applies to a channel with this assign. */
export function channelCrossGain (assign, pos, curve) {
  const g = crossGains(pos, curve)
  return assign === 'A' ? g.a : assign === 'B' ? g.b : 1
}
/** Pitch fader -1..1 (+ range) -> playbackRate. */
export const pitchToRate = (pitch, range = 0.08) => clamp(1 + clamp(num(pitch, 0), -1, 1) * clamp(num(range, 0.08), 0, 1), RATE_MIN, RATE_MAX)
export const rateToPitch = (rate, range = 0.08) => { const r = clamp(num(range, 0.08), 0.001, 1); return clamp((clamp(num(rate, 1), RATE_MIN, RATE_MAX) - 1) / r, -1, 1) }
export const clampRate = (r) => clamp(num(r, 1), RATE_MIN, RATE_MAX)

// ── jog maths ────────────────────────────────────────────────────────────────────────────────────────────────────────
export const normAngle = (a) => { const n = num(a, 0) % 360; return n < 0 ? n + 360 : n }
/** Shortest signed angle from a to b, -180..180. */
export function angleDelta (a, b) { let d = (num(b, 0) - num(a, 0)) % 360; if (d > 180) d -= 360; if (d < -180) d += 360; return d }
export const angleToSeconds = (deg) => num(deg, 0) / 360 * JOG_SECONDS_PER_REV
export const secondsToAngle = (sec) => num(sec, 0) / JOG_SECONDS_PER_REV * 360
/** Visual spin speed (deg/s) of a playing deck; 0 when it does not play. */
export const spinDegPerSec = (rate, playing) => (playing ? JOG_DEG_PER_SEC * clampRate(rate) : 0)
export function fmtTime (sec) {
  const s = Math.max(0, Math.floor(num(sec, 0))); const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}
export const fmtDb = (db) => (db <= EQ_DB_MIN + 0.5 ? 'kill' : `${db > 0.05 ? '+' : ''}${db.toFixed(1)}dB`)
export const fmtPitch = (pitch, range) => { const p = clamp(num(pitch, 0), -1, 1) * clamp(num(range, 0.08), 0, 1) * 100; return `${p > 0.05 ? '+' : ''}${p.toFixed(1)}%` }

/** SVG arc path for a knob: angles in degrees measured clockwise from 12 o'clock. */
export function arcPath (cx, cy, r, a0, a1) {
  const pt = (a) => { const t = (num(a, 0) - 90) * Math.PI / 180; return [cx + r * Math.cos(t), cy + r * Math.sin(t)] }
  const [x0, y0] = pt(a0); const [x1, y1] = pt(a1)
  const large = Math.abs(num(a1, 0) - num(a0, 0)) > 180 ? 1 : 0; const sweep = a1 >= a0 ? 1 : 0
  return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${large} ${sweep} ${x1.toFixed(2)} ${y1.toFixed(2)}`
}

// ── sanitizers ───────────────────────────────────────────────────────────────────────────────────────────────────────
export function defaultChannel () {
  return { volume: 0.8, eq: { low: 0.5, mid: 0.5, high: 0.5 }, mute: false, assign: 'T', pitch: 0, range: 0.08, loop: false, keylock: false, cue: 0 }
}
export function sanitizeChannel (raw) {
  const d = defaultChannel(); const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  const e = r.eq && typeof r.eq === 'object' && !Array.isArray(r.eq) ? r.eq : {}
  const range = num(r.range, d.range, 0.01, 1)
  return {
    volume: num(r.volume, d.volume, 0, 1),
    eq: { low: num(e.low, 0.5, 0, 1), mid: num(e.mid, 0.5, 0, 1), high: num(e.high, 0.5, 0, 1) },
    mute: r.mute === true,
    assign: pickOf(r.assign, ASSIGNS, d.assign),
    pitch: num(r.pitch, 0, -1, 1),
    range,
    loop: r.loop === true,
    keylock: r.keylock === true,
    cue: num(r.cue, 0, 0, 1e6),
  }
}
export function sanitizeState (raw) {
  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  const c = r.cross && typeof r.cross === 'object' && !Array.isArray(r.cross) ? r.cross : {}
  const list = Array.isArray(r.channels) ? r.channels : []
  const channels = []; for (let i = 0; i < DECKS; i++) channels.push(sanitizeChannel(list[i]))
  return { v: 1, master: num(r.master, 0.85, 0, 1), cross: { pos: num(c.pos, 0, -1, 1), curve: pickOf(c.curve, CURVES, 'constant-power') }, channels }
}

/**
 * A track reference: { slot: 1..15 } (the OmniMusicPlayer library) or { url } (http(s) / blob: / data:audio). Anything else -> null.
 * Never a javascript: URL; a url is capped at 4096 characters.
 */
export const LIBRARY_SLOTS = 15
export function sanitizeTrackRef (raw) {
  if (!raw || typeof raw !== 'object') return null
  if (raw.slot !== undefined && raw.slot !== null) { const s = Math.round(num(raw.slot, 0)); return s >= 1 && s <= LIBRARY_SLOTS ? { slot: s } : null }
  if (typeof raw.url === 'string') {
    const u = raw.url.trim()
    if (u.length > 0 && u.length <= 4096 && (/^https?:\/\//i.test(u) || /^blob:/i.test(u) || /^data:audio\//i.test(u))) return { url: u, name: typeof raw.name === 'string' ? raw.name.slice(0, 120) : '' }
  }
  return null
}
export const cleanName = (s, def = '') => (typeof s === 'string' ? s.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 120) : def)
export default { DECKS, eqDb, dbToEq, volumeGain, crossGains, channelCrossGain, pitchToRate, sanitizeChannel, sanitizeState, sanitizeTrackRef }
