/**
 * ui/OmniSongDraw.js — the canvas drawing and the small pure helpers of the ⟐OmniSong editor (V198). Pure: every function takes a 2D context (or nothing) and plain data,
 * so they run against a recording context in the tests. No DOM, no storage, no audio.
 *
 *   drawRuler    sections band, marker flags, bar numbers and ticks, loop region, for the visible window [scrollLeft, scrollLeft + w] of the timeline
 *   drawTempo    the tempo track: a step line through the tempo points (the first point is the base bpm)
 *   drawAuto     one automation curve (linear or step segments) with its points; the static value as a dashed line when there are no points
 *   drawPattern  the mini preview of a MusicNode inside a pattern clip (one row per track, one dot per note, tiled per repeat)
 *   drawWave     the waveform of an audio clip from AudioAssets.getPeaks (min / max pairs)
 */

export const RULER = Object.freeze({ h: 40, secH: 16, mkY0: 16, mkY1: 27 })
export const TEMPO_H = 56
export const AUTO_H = 76
export const BPM_MIN = 60
export const BPM_MAX = 240
export const AUTO_PARAMS = Object.freeze(['volume', 'pan', 'filter', 'sendReverb', 'sendDelay'])
export const AUTO_LABELS = Object.freeze({ volume: 'Volume', pan: 'Pan', filter: 'Filter', sendReverb: 'Reverb send', sendDelay: 'Delay send' })
export const AUTO_RANGE = Object.freeze({ volume: [0, 1.5], pan: [-1, 1], filter: [0, 1], sendReverb: [0, 1], sendDelay: [0, 1] })
export const SECTION_COLORS = Object.freeze(['#7ad7f0', '#ffb86b', '#b4f08a', '#f08ab4', '#c3a2ff', '#ffd75e', '#ff8a7a', '#8fa6ff'])

const HEX = /^#[0-9a-fA-F]{6}$/
const CSSCOL = /^(#[0-9a-fA-F]{3,8}|(?:hsl|rgb)a?\([\d\s.,%/-]+\))$/
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v)
/** A colour string that is safe to put in a style attribute (else the fallback). */
export const safeColor = (c, d = '#7ad7f0') => (typeof c === 'string' && CSSCOL.test(c.trim()) ? c.trim() : d)
/** A #rrggbb for a colour input (else the fallback). */
export const hexColor = (c, d = '#7ad7f0') => (typeof c === 'string' && HEX.test(c) ? c : d)
export const snapTo = (bar, grid) => (grid > 0 ? Math.round(bar / grid) * grid : bar)
export const roundBar = (b) => Math.round(b * 1000) / 1000
export const pad2 = (n) => String(n).padStart(2, '0')
export function fmtTime (sec) {
  const s = Math.max(0, Number.isFinite(sec) ? sec : 0)
  const m = Math.floor(s / 60); const r = s - m * 60
  return pad2(m) + ':' + (r < 10 ? '0' : '') + r.toFixed(1)
}
/** "5.2" = bar 5, beat 2 for a float bar (1-based) in a song with `num` beats per bar. */
export function fmtBarBeat (bar, num = 4) {
  const b = Math.max(1, Number.isFinite(bar) ? bar : 1); const n = Math.max(1, num | 0)
  const bi = Math.floor(b + 1e-9); const beat = Math.min(n, Math.floor((b - bi) * n + 1e-6) + 1)
  return `${bi}.${beat}`
}

// ── value <-> pixel ─────────────────────────────────────────────────────────────

export const barToX = (bar, barPx) => (bar - 1) * barPx
export const xToBar = (x, barPx) => 1 + x / barPx
export function bpmToY (bpm, h) { const p = 8; return p + (1 - (clamp(bpm, BPM_MIN, BPM_MAX) - BPM_MIN) / (BPM_MAX - BPM_MIN)) * (h - 2 * p) }
export function yToBpm (y, h) { const p = 8; return Math.round(BPM_MIN + (1 - clamp((y - p) / (h - 2 * p), 0, 1)) * (BPM_MAX - BPM_MIN)) }
export function valToY (param, v, h) { const [a, b] = AUTO_RANGE[param] ?? [0, 1]; const p = 8; return p + (1 - (clamp(v, a, b) - a) / (b - a)) * (h - 2 * p) }
export function yToVal (param, y, h) { const [a, b] = AUTO_RANGE[param] ?? [0, 1]; const p = 8; const v = a + (1 - clamp((y - p) / (h - 2 * p), 0, 1)) * (b - a); return Math.round(v * 100) / 100 }

/** The tempo points of a song as the editor shows them: [{ bar:1, bpm: base }, ...tempoMap]. */
export function tempoPoints (song) {
  const rest = (song?.tempoMap ?? []).filter(t => t.bar > 1).map(t => ({ bar: t.bar, bpm: t.bpm }))
  return [{ bar: 1, bpm: song?.bpm ?? 120 }, ...rest]
}

/** The automation entry for (target, param) or null. */
export const findAuto = (song, target, param) => (song?.automation ?? []).find(a => a.lane === target && a.param === param) ?? null

/** The static (unautomated) value of a param for a lane or the master. */
export function staticValue (song, target, param) {
  if (target === 'master') return param === 'volume' ? song?.master?.gain ?? 1 : 0.5
  const l = (song?.lanes ?? []).find(x => x.id === target)
  if (!l) return 0
  return param === 'volume' ? l.volume : param === 'pan' ? l.pan : param === 'sendReverb' ? l.sends?.reverb ?? 0 : param === 'sendDelay' ? l.sends?.delay ?? 0 : 0.5
}

// ── drawing ─────────────────────────────────────────────────────────────────────

/** o = { scrollLeft, barPx, lengthBars, num, sections, markers, loop, cursor, th:{ text, dim, line, accent, bg } } */
export function drawRuler (g, w, h, o) {
  const th = o.th; const bp = o.barPx; const sl = o.scrollLeft || 0
  g.clearRect(0, 0, w, h)
  g.fillStyle = th.bg; g.fillRect(0, 0, w, h)
  const x0 = (bar) => barToX(bar, bp) - sl
  // sections band
  for (const s of o.sections ?? []) {
    const a = x0(s.startBar); const b = x0(s.startBar + s.lengthBars)
    if (b < 0 || a > w) continue
    g.fillStyle = safeColor(s.color, '#8899ff'); g.globalAlpha = 0.85
    g.fillRect(a + 0.5, 1, Math.max(2, b - a - 1), RULER.secH - 2)
    g.globalAlpha = 1
    g.fillStyle = '#0b0d12'; g.font = '10px sans-serif'; g.textBaseline = 'middle'
    g.save?.(); g.beginPath?.(); g.rect?.(a, 0, Math.max(2, b - a - 1), RULER.secH); g.clip?.()
    g.fillText(String(s.name ?? ''), a + 4, RULER.secH / 2 + 0.5)
    g.restore?.()
  }
  // loop region
  const lp = o.loop
  if (lp) {
    const a = x0(lp.startBar); const b = x0(lp.endBar)
    g.fillStyle = lp.on ? 'rgba(255,184,107,0.30)' : 'rgba(255,255,255,0.10)'
    g.fillRect(a, RULER.mkY1, Math.max(1, b - a), h - RULER.mkY1)
    g.fillStyle = lp.on ? '#ffb86b' : th.dim
    g.fillRect(a, RULER.mkY1, 2, h - RULER.mkY1); g.fillRect(b - 2, RULER.mkY1, 2, h - RULER.mkY1)
  }
  // bars
  const every = bp >= 40 ? 1 : bp >= 20 ? 2 : bp >= 10 ? 4 : bp >= 5 ? 8 : 16
  const num = Math.max(1, o.num || 4)
  const first = Math.max(1, Math.floor(1 + sl / bp)); const last = Math.min(o.lengthBars + 1, Math.ceil(1 + (sl + w) / bp))
  g.font = '10px sans-serif'; g.textBaseline = 'alphabetic'
  for (let b = first; b <= last; b++) {
    const x = Math.round(x0(b)) + 0.5
    const major = (b - 1) % every === 0
    g.strokeStyle = th.line; g.beginPath(); g.moveTo(x, major ? RULER.mkY1 + 2 : h - 8); g.lineTo(x, h); g.stroke()
    if (bp >= 60 && b <= o.lengthBars) { for (let q = 1; q < 4; q++) { const xq = Math.round(x0(b + q / 4)) + 0.5; g.beginPath(); g.moveTo(xq, h - (q === 2 ? 7 : 4)); g.lineTo(xq, h); g.stroke() } }
    if (bp >= 110 && b <= o.lengthBars) { for (let q = 1; q < num; q++) { const xq = Math.round(x0(b + q / num)) + 0.5; g.beginPath(); g.moveTo(xq, h - 6); g.lineTo(xq, h); g.stroke() } }
    if (major && b <= o.lengthBars) { g.fillStyle = th.text; g.fillText(String(b), x + 3, h - 11) }
  }
  // end of song
  const xe = x0(o.lengthBars + 1); if (xe < w) { g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(Math.max(0, xe), RULER.mkY1, w, h - RULER.mkY1) }
  // markers (flag + name)
  for (const m of o.markers ?? []) {
    const x = x0(m.bar); if (x < -60 || x > w) continue
    g.fillStyle = th.accent
    g.beginPath(); g.moveTo(x, RULER.mkY0 + 1); g.lineTo(x + 7, RULER.mkY0 + 5); g.lineTo(x, RULER.mkY0 + 9); g.closePath(); g.fill()
    g.fillRect(x, RULER.mkY0 + 1, 1, RULER.mkY1 - RULER.mkY0)
    if (m.name) { g.fillStyle = th.text; g.font = '9px sans-serif'; g.fillText(String(m.name), x + 9, RULER.mkY0 + 9) }
  }
  g.strokeStyle = th.line; g.beginPath(); g.moveTo(0, h - 0.5); g.lineTo(w, h - 0.5); g.stroke()
}

/** o = { scrollLeft, barPx, lengthBars, points:[{bar,bpm}], th, selected:index|-1 } */
export function drawTempo (g, w, h, o) {
  const th = o.th; const bp = o.barPx; const sl = o.scrollLeft || 0
  g.clearRect(0, 0, w, h); g.fillStyle = th.bg2 ?? th.bg; g.fillRect(0, 0, w, h)
  g.strokeStyle = th.line2 ?? th.line; g.font = '9px sans-serif'; g.fillStyle = th.dim; g.textBaseline = 'middle'
  for (const v of [90, 120, 180, 240]) { const y = Math.round(bpmToY(v, h)) + 0.5; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); g.fillText(String(v), 3, y - 5) }
  const pts = o.points ?? []; if (!pts.length) return
  g.strokeStyle = th.accent; g.lineWidth = 2; g.beginPath()
  let y = bpmToY(pts[0].bpm, h); g.moveTo(0, y)
  for (let i = 1; i < pts.length; i++) { const x = barToX(pts[i].bar, bp) - sl; g.lineTo(x, y); y = bpmToY(pts[i].bpm, h); g.lineTo(x, y) }
  g.lineTo(Math.max(w, barToX(o.lengthBars + 1, bp) - sl), y); g.stroke(); g.lineWidth = 1
  pts.forEach((p, i) => {
    const x = barToX(p.bar, bp) - sl; if (x < -10 || x > w + 10) return
    g.fillStyle = i === o.selected ? '#fff' : th.accent
    g.beginPath(); g.arc(Math.max(5, x), bpmToY(p.bpm, h), i === o.selected ? 5 : 4, 0, Math.PI * 2); g.fill()
    g.fillStyle = th.text; g.textBaseline = 'alphabetic'; g.fillText(String(Math.round(p.bpm)), Math.max(5, x) + 6, bpmToY(p.bpm, h) - 6); g.textBaseline = 'middle'
  })
}

/** o = { scrollLeft, barPx, lengthBars, param, points:[{bar,value,curve}], staticValue, color, th, selected } */
export function drawAuto (g, w, h, o) {
  const th = o.th; const bp = o.barPx; const sl = o.scrollLeft || 0; const par = o.param
  g.clearRect(0, 0, w, h); g.fillStyle = th.bg2 ?? th.bg; g.fillRect(0, 0, w, h)
  const [lo, hi] = AUTO_RANGE[par] ?? [0, 1]
  g.strokeStyle = th.line2 ?? th.line
  for (const v of [lo, (lo + hi) / 2, hi]) { const y = Math.round(valToY(par, v, h)) + 0.5; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke() }
  const pts = o.points ?? []; const col = safeColor(o.color, '#7ad7f0')
  if (!pts.length) {
    const y = valToY(par, o.staticValue ?? 0, h); g.setLineDash?.([4, 4]); g.strokeStyle = col; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); g.setLineDash?.([])
    g.fillStyle = th.dim; g.font = '10px sans-serif'; g.textBaseline = 'middle'; g.fillText('Click to add a point', 8, 12)
    return
  }
  const X = (b) => barToX(b, bp) - sl
  const path = () => {
    let y = valToY(par, pts[0].value, h)
    g.moveTo(0, y); g.lineTo(X(pts[0].bar), y)
    for (let i = 1; i < pts.length; i++) {
      const x = X(pts[i].bar); const yn = valToY(par, pts[i].value, h)
      if (pts[i - 1].curve === 'step') { g.lineTo(x, y); g.lineTo(x, yn) } else g.lineTo(x, yn)
      y = yn
    }
    g.lineTo(Math.max(w, X(o.lengthBars + 1)), y)
    return y
  }
  g.fillStyle = col; g.globalAlpha = 0.16; g.beginPath(); const yl = path(); g.lineTo(Math.max(w, X(o.lengthBars + 1)), h); g.lineTo(0, h); g.closePath(); g.fill(); g.globalAlpha = 1
  g.strokeStyle = col; g.lineWidth = 2; g.beginPath(); path(); g.stroke(); g.lineWidth = 1
  void yl
  pts.forEach((p, i) => {
    const x = X(p.bar); if (x < -10 || x > w + 10) return
    g.fillStyle = i === o.selected ? '#fff' : col
    g.beginPath(); g.arc(x, valToY(par, p.value, h), i === o.selected ? 5 : 4, 0, Math.PI * 2); g.fill()
  })
}

/** Mini preview of a pattern: music = sanitized MusicNode pattern, srcBars = its length in song bars, w / h = the canvas, clipBars = clip length, repeat = clip.repeat. */
export function drawPattern (g, w, h, music, srcBars, clipBars, repeat, color) {
  g.clearRect(0, 0, w, h)
  const tracks = Array.isArray(music?.tracks) ? music.tracks : []
  if (!tracks.length) return
  const total = Math.max(1, (music.stepsPerBar | 0) * (music.bars | 0) || 16)
  const pxBar = w / Math.max(0.25, clipBars)
  const tile = Math.max(1, srcBars) * pxBar
  const rows = Math.min(tracks.length, 8); const rh = h / rows
  g.fillStyle = color
  const n = Math.min(Math.max(1, repeat | 0), 64)
  for (let rep = 0; rep < n; rep++) {
    const ox = rep * tile; if (ox >= w) break
    if (rep > 0) { g.globalAlpha = 0.25; g.fillRect(ox, 0, 1, h); g.globalAlpha = 1 }
    for (let r = 0; r < rows; r++) {
      const steps = tracks[r].steps ?? []
      for (let i = 0; i < steps.length; i++) {
        const s = steps[i]; const x = ox + (s.step / total) * tile
        if (x >= w) continue
        const sw = (tile / total) * (s.gate > 1 ? s.gate : 1)
        g.globalAlpha = 0.5 + 0.5 * (s.velocity ?? 0.8)
        g.fillRect(x, r * rh + 1, Math.max(1.5, Math.min(sw - 0.5, w - x)), Math.max(1.5, rh - 2))
      }
    }
  }
  g.globalAlpha = 1
}

/** peaks = Float32Array of min / max pairs (any sign convention: the amplitude is max(|min|, |max|)); offset / span select the part of the file as fractions 0..1. */
export function drawWave (g, w, h, peaks, color, from = 0, to = 1) {
  g.clearRect(0, 0, w, h)
  if (!peaks || peaks.length < 2) return
  const n = peaks.length >> 1; g.fillStyle = color; g.globalAlpha = 0.85
  const mid = h / 2
  const a = clamp(from, 0, 1); const b = clamp(to, a, 1)
  for (let x = 0; x < w; x++) {
    const i = Math.min(n - 1, Math.floor((a + (b - a) * (x / w)) * n))
    const amp = Math.max(Math.abs(peaks[i * 2]), Math.abs(peaks[i * 2 + 1]))
    const hh = Math.max(1, amp * (h - 4))
    g.fillRect(x, mid - hh / 2, 1, hh)
  }
  g.globalAlpha = 1
}
