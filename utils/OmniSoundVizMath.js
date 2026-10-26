/**
 * utils/OmniSoundVizMath.js — the pure maths of the two sound viewers (V194). No DOM, no Web Audio, no Three.js; unit tested.
 *
 *   hzToNote(hz)                 { name:'A4', midi:69, cents:0 } or null          (A4 = 440 Hz, equal temperament)
 *   fmtHz(hz)                    '440 Hz' / '1.25 kHz'
 *   byteToDb(v, minDb, maxDb)    an analyser byte 0..255 -> dB (the AnalyserNode mapping)
 *   levelToDb(level)             0..1 amplitude -> dB, '-inf' below -90
 *   ZOOMS / zoomRange(i)         frequency windows of the FFT zoom ([lo, hi] Hz)
 *   logRanges(lo, hi, n)         n log-spaced [f0, f1] bands between lo and hi
 *   binRanges(ranges, binCount, sampleRate)   Uint16Array [b0, b1) per range (b1 > b0, inside 0..binCount)
 *   freqToX(f, lo, hi, w) / xToFreq(x, lo, hi, w)   the log frequency axis
 *   gridFreqs(lo, hi)            the labelled grid frequencies (20, 50, 100 ... 20k) inside the window
 *   scopeStart(wave, max)        index of a rising zero crossing near the start (a steady scope picture)
 *   heatStops / heatLut(rgbBg, rgbAcc, steps)   the spectrogram colour table (dark -> accent -> white) as 'rgb(r,g,b)' strings
 *   parseColor(css)              '#rgb' / '#rrggbb' / 'rgb(a)(...)' -> [r,g,b] or null
 *   bandHue(b)                   hue (degrees) of band b in the viewers
 *   project(x, y, z, view, yaw, into?)  the 2D projection of the formation viewer: 'top' | 'front' | 'side' | 'orbit' -> { x, y, d } (y up, d depth 0..1 for shading)
 *
 * USER-facing module: it must never import a Dev* module.
 */

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

const fin = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d)
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v)

export function hzToNote (hz) {
  const f = fin(hz, 0)
  if (!(f > 8 && f < 30000)) return null
  const exact = 69 + 12 * Math.log2(f / 440)
  const midi = Math.round(exact)
  const cents = Math.round((exact - midi) * 100)
  return { name: NOTE_NAMES[((midi % 12) + 12) % 12] + (Math.floor(midi / 12) - 1), midi, cents }
}

export function fmtHz (hz) {
  const f = fin(hz, NaN)
  if (!(f > 0)) return '—'
  if (f >= 10000) return (f / 1000).toFixed(1) + ' kHz'
  if (f >= 1000) return (f / 1000).toFixed(2) + ' kHz'
  return (f >= 100 ? f.toFixed(0) : f.toFixed(1)) + ' Hz'
}

export function byteToDb (v, minDb = -100, maxDb = -30) {
  const lo = fin(minDb, -100), hi = fin(maxDb, -30)
  return lo + (clamp(fin(v, 0), 0, 255) / 255) * (hi - lo)
}
export function levelToDb (level) {
  const l = fin(level, 0)
  if (l <= 0) return '-inf'
  const db = 20 * Math.log10(l)
  return db < -90 ? '-inf' : db.toFixed(1)
}

export const ZOOMS = [
  { id: 'full', label: '20 Hz – 20 kHz', short: '20–20k Hz', lo: 20, hi: 20000 },
  { id: 'wide', label: '20 Hz – 8 kHz', short: '20–8k Hz', lo: 20, hi: 8000 },
  { id: 'mid', label: '20 Hz – 2 kHz', short: '20–2k Hz', lo: 20, hi: 2000 },
  { id: 'low', label: '20 – 500 Hz', short: '20–500 Hz', lo: 20, hi: 500 },
  { id: 'sub', label: '20 – 120 Hz', short: '20–120 Hz', lo: 20, hi: 120 },
]
export const zoomRange = (i) => ZOOMS[clamp(Math.round(fin(i, 0)), 0, ZOOMS.length - 1)]

export function logRanges (lo, hi, n) {
  const a = Math.max(1, fin(lo, 20)), b = Math.max(a * 1.01, fin(hi, 20000)), c = Math.max(1, Math.floor(fin(n, 1)))
  const out = []
  for (let i = 0; i < c; i++) out.push([a * Math.pow(b / a, i / c), a * Math.pow(b / a, (i + 1) / c)])
  return out
}

export function binRanges (ranges, binCount, sampleRate) {
  const bins = Math.max(1, Math.floor(fin(binCount, 1024)))
  const nyq = Math.max(1, fin(sampleRate, 44100)) / 2
  const out = new Uint16Array(ranges.length * 2)
  ranges.forEach(([f0, f1], i) => {
    const b0 = clamp(Math.floor((f0 / nyq) * bins), 0, bins - 1)
    const b1 = clamp(Math.ceil((f1 / nyq) * bins), b0 + 1, bins)
    out[i * 2] = b0; out[i * 2 + 1] = b1
  })
  return out
}

export const freqToX = (f, lo, hi, w) => (Math.log(Math.max(f, 1e-6) / lo) / Math.log(hi / lo)) * w
export const xToFreq = (x, lo, hi, w) => lo * Math.pow(hi / lo, clamp(x / Math.max(1, w), 0, 1))

const GRID_COARSE = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000]
const GRID_FINE = [20, 30, 40, 50, 60, 80, 100, 120, 150, 200, 250, 300, 400, 500, 600, 800, 1000, 1500, 2000, 3000, 4000, 5000, 8000, 10000, 20000]
export function gridFreqs (lo, hi) {
  const list = hi / lo > 60 ? GRID_COARSE : GRID_FINE
  const out = list.filter(f => f >= lo * 0.999 && f <= hi * 1.001)
  return out.length >= 2 ? out : [lo, hi]
}
export const fmtAxis = (f) => (f >= 1000 ? (f / 1000) + 'k' : String(f))

/** First rising zero crossing (byte 128) in the first `max` samples, else 0 — the scope starts there so a steady tone stands still. */
export function scopeStart (wave, max) {
  if (!wave || !wave.length) return 0
  const end = Math.min(wave.length - 1, Math.max(2, Math.floor(fin(max, wave.length / 2))))
  for (let i = 1; i < end; i++) if (wave[i - 1] < 128 && wave[i] >= 128) return i
  return 0
}

export function parseColor (css) {
  if (typeof css !== 'string') return null
  const s = css.trim()
  let m = /^#([0-9a-f]{6})$/i.exec(s)
  if (m) { const n = parseInt(m[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255] }
  m = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(s)
  if (m) return [parseInt(m[1] + m[1], 16), parseInt(m[2] + m[2], 16), parseInt(m[3] + m[3], 16)]
  m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(s)
  if (m) return [clamp(+m[1], 0, 255) | 0, clamp(+m[2], 0, 255) | 0, clamp(+m[3], 0, 255) | 0]
  return null
}

export function heatLut (bg = [8, 8, 12], acc = [127, 216, 255], steps = 64) {
  const out = []
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1)
    let r, g, b
    if (t < 0.6) { const u = t / 0.6; r = bg[0] + (acc[0] - bg[0]) * u; g = bg[1] + (acc[1] - bg[1]) * u; b = bg[2] + (acc[2] - bg[2]) * u } else { const u = (t - 0.6) / 0.4; r = acc[0] + (255 - acc[0]) * u; g = acc[1] + (255 - acc[1]) * u; b = acc[2] + (255 - acc[2]) * u }
    out.push(`rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`)
  }
  return out
}

export const bandHue = (b) => (200 + (clamp(Math.round(fin(b, 0)), 0, 6) / 6) * 280) % 360

/**
 * Orthographic projection of a formation point for the viewer. top: x right, z down; front: x right, y up; side: z right, y up;
 * orbit: a turntable around Y by `yaw` radians seen from a fixed 22 degrees above. Returns { x, y, d } with y pointing UP and
 * d = depth in -1..1 (1 = nearest the viewer) for shading the points.
 */
export function project (x, y, z, view, yaw = 0, into = null) {
  const o = into || { x: 0, y: 0, d: 0 }
  switch (view) {
    case 'top': o.x = x; o.y = -z; o.d = clamp(y * 0.2, -1, 1); return o
    case 'side': o.x = z; o.y = y; o.d = clamp(-x * 0.2, -1, 1); return o
    case 'orbit': {
      const c = Math.cos(yaw), s = Math.sin(yaw)
      const rx = x * c - z * s, rz = x * s + z * c
      const cp = 0.9285, sp = 0.3709   // cos / sin of 0.38 rad (about 22 degrees above)
      o.x = rx; o.y = y * cp - rz * sp; o.d = clamp((rz * cp + y * sp) * 0.2, -1, 1); return o
    }
    default: o.x = x; o.y = y; o.d = clamp(z * 0.2, -1, 1); return o
  }
}
