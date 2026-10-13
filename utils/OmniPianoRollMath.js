/**
 * utils/OmniPianoRollMath.js — the PURE math of the piano roll (V198): pixels <-> steps / pitches, snapping, hit testing, rubber bands, zoom / scroll, scale masks.
 * No DOM, no canvas, no THREE, no storage, no audio: ui/OmniPianoRoll.js draws and handles the pointer, this file decides. Never throws on bad numbers.
 *
 * VIEW `v` (a plain object, make one with makeView):
 *   { keyW (px of the key strip on the left), pxPerStep (horizontal zoom), rowH (px of one pitch row), scrollX, scrollY (px the grid is scrolled by),
 *     hi, lo (highest / lowest pitch row, default 127..0), total (steps of the pattern), spb (steps per bar), beat (steps per beat) }
 * Screen x of a step = keyW + step * pxPerStep - scrollX. Screen y of a pitch (top of its row) = (hi - midi) * rowH - scrollY, measured from the TOP OF THE GRID (the
 * caller subtracts the height of any header). So the helpers take grid-relative y.
 * NOTE `n`: { start (steps, float), length (steps), midi, velocity (0..1) } — the same shape as utils/OmniMusicModel.js eventsToNotes().
 */

export const ZOOM_X = Object.freeze({ min: 3, max: 120 })      // px per step
export const ZOOM_Y = Object.freeze({ min: 6, max: 40 })       // px per pitch row
export const SNAP_MODES = Object.freeze(['step', 'half', 'bar', 'off'])
export const SCALES = Object.freeze({
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  pentatonic: [0, 2, 4, 7, 9],
  'minor-pentatonic': [0, 3, 5, 7, 10],
})
export const SCALE_IDS = Object.freeze(Object.keys(SCALES))
export const KEY_NAMES = Object.freeze(['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'])

const fin = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d)
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v)
const r6 = (v) => Math.round(v * 1e6) / 1e6 + 0

// ── View ────────────────────────────────────────────────────────────────────────

/** A complete view from partial values (bad numbers fall back). */
export function makeView (o = {}) {
  const total = Math.max(1, Math.round(fin(o.total, 16)))
  const spb = Math.max(1, Math.round(fin(o.spb, 16)))
  return {
    keyW: clamp(fin(o.keyW, 44), 0, 200), pxPerStep: clamp(fin(o.pxPerStep, 24), ZOOM_X.min, ZOOM_X.max), rowH: clamp(fin(o.rowH, 14), ZOOM_Y.min, ZOOM_Y.max),
    scrollX: Math.max(0, fin(o.scrollX, 0)), scrollY: Math.max(0, fin(o.scrollY, 0)),
    hi: clamp(Math.round(fin(o.hi, 127)), 0, 127), lo: clamp(Math.round(fin(o.lo, 0)), 0, 127), total, spb, beat: Math.max(0.25, fin(o.beat, 4)),
  }
}
export const gridWidth = (v) => v.total * v.pxPerStep
export const gridHeight = (v) => (Math.max(v.hi, v.lo) - Math.min(v.hi, v.lo) + 1) * v.rowH

export const stepToX = (v, step) => v.keyW + step * v.pxPerStep - v.scrollX
export const xToStep = (v, x) => (x - v.keyW + v.scrollX) / v.pxPerStep
export const midiToY = (v, midi) => (v.hi - midi) * v.rowH - v.scrollY
/** Pitch under a grid-relative y (fractional rows floor). Not clamped to the visible range: use clampMidi. */
export const yToMidi = (v, y) => v.hi - Math.floor((y + v.scrollY) / v.rowH)
export const clampMidi = (v, m) => clamp(Math.round(m), Math.min(v.lo, v.hi), Math.max(v.lo, v.hi))

/** Largest scroll values: the grid never scrolls past its content. viewW / viewH are the size of the grid area (without the key strip). */
export function maxScroll (v, viewW, viewH) {
  // an infinite view size means "do not clamp that axis"
  return { x: Number.isFinite(viewW) ? Math.max(0, gridWidth(v) - Math.max(0, viewW)) : Infinity, y: Number.isFinite(viewH) ? Math.max(0, gridHeight(v) - Math.max(0, viewH)) : Infinity }
}
/** A view with its scroll clamped. */
export function clampScroll (v, viewW, viewH) {
  const m = maxScroll(v, viewW, viewH)
  return { ...v, scrollX: clamp(fin(v.scrollX, 0), 0, m.x), scrollY: clamp(fin(v.scrollY, 0), 0, m.y) }
}
/** Zoom horizontally by `factor`, the step under `anchorX` (screen x) stays under it. Returns a new view (scroll clamped when viewW is given). */
export function zoomX (v, factor, anchorX = null, viewW = null) {
  const f = fin(factor, 1); if (!(f > 0)) return v
  const px = clamp(v.pxPerStep * f, ZOOM_X.min, ZOOM_X.max)
  const ax = anchorX == null ? v.keyW + (viewW ?? 0) / 2 : anchorX
  const stepAt = xToStep(v, ax)
  const next = { ...v, pxPerStep: px }
  next.scrollX = Math.max(0, stepAt * px - (ax - v.keyW))
  return viewW == null ? next : clampScroll(next, viewW, Infinity)
}
/** Same vertically (anchorY grid-relative). */
export function zoomY (v, factor, anchorY = null, viewH = null) {
  const f = fin(factor, 1); if (!(f > 0)) return v
  const rh = clamp(v.rowH * f, ZOOM_Y.min, ZOOM_Y.max)
  const ay = anchorY == null ? (viewH ?? 0) / 2 : anchorY
  const rowsAt = (ay + v.scrollY) / v.rowH
  const next = { ...v, rowH: rh }
  next.scrollY = Math.max(0, rowsAt * rh - ay)
  return viewH == null ? next : clampScroll(next, Infinity, viewH)
}
/** Zoom so the whole pattern fits `viewW` px (clamped to the zoom range). */
export function fitX (v, viewW) { return clampScroll({ ...v, pxPerStep: clamp(Math.max(1, viewW) / v.total, ZOOM_X.min, ZOOM_X.max), scrollX: 0 }, viewW, Infinity) }
/** Scroll so the pitch range lo..hi (inclusive) is centred in a grid area of height viewH. */
export function scrollToPitches (v, loM, hiM, viewH) {
  const mid = (loM + hiM) / 2
  const y = (v.hi - mid + 0.5) * v.rowH - viewH / 2
  return clampScroll({ ...v, scrollY: y }, Infinity, viewH)
}
/** The steps [from, to] and pitches {hi, lo} visible in a grid area viewW x viewH. */
export function visibleRange (v, viewW, viewH) {
  const from = Math.max(0, xToStep(v, v.keyW)); const to = Math.min(v.total, xToStep(v, v.keyW + viewW))
  const hiM = clamp(v.hi - Math.floor(v.scrollY / v.rowH), v.lo, v.hi); const loM = clamp(v.hi - Math.floor((v.scrollY + viewH - 1) / v.rowH), v.lo, v.hi)
  return { from, to, hi: hiM, lo: loM }
}

// ── Snapping ────────────────────────────────────────────────────────────────────

/** The grid size in STEPS of a snap mode: 'step' 1, 'half' 0.5, 'bar' steps-per-bar, 'off' 0 (no snapping). */
export function gridSize (mode, spb = 16) {
  if (mode === 'half') return 0.5
  if (mode === 'bar') return Math.max(1, fin(spb, 16))
  if (mode === 'off') return 0
  return 1
}
/** Snap a position (steps) to a grid (steps). grid 0 = unchanged. */
export function snapTo (value, grid, mode = 'nearest') {
  const x = fin(value, 0); const g = fin(grid, 1)
  if (!(g > 0)) return x
  const k = mode === 'floor' ? Math.floor(x / g + 1e-9) : mode === 'ceil' ? Math.ceil(x / g - 1e-9) : Math.round(x / g)
  return r6(k * g)
}
/** The start of a NEW note placed by clicking at step position `s`: the grid cell the pointer is in (floor), clamped into the pattern. */
export function newNoteStart (s, grid, total) {
  const g = fin(grid, 1)
  const st = g > 0 ? snapTo(s, g, 'floor') : fin(s, 0)
  return clamp(st, 0, Math.max(0, total - (g > 0 ? g : 0.25)))
}
/** The default length of a new note: one grid cell (one step when the snap is off), never past the pattern end. */
export function newNoteLength (start, grid, total, minLen = 0.05) {
  const g = fin(grid, 1) > 0 ? grid : 1
  return Math.max(minLen, Math.min(g, total - start))
}

// ── Geometry of notes ───────────────────────────────────────────────────────────

/** Screen rectangle of a note (grid-relative y): { x, y, w, h }. Width is at least 3 px; one px is left between rows. */
export function noteRect (v, n) {
  const x = stepToX(v, n.start); const y = midiToY(v, n.midi)
  return { x, y: y + 0.5, w: Math.max(3, n.length * v.pxPerStep - 1), h: Math.max(2, v.rowH - 1) }
}

/**
 * Topmost note under a point (x screen, y grid-relative). Returns { index, part: 'body'|'right'|'left' } or null. The edge zones are `edge` px wide (but never more
 * than a third of the note), so a very short note is still movable.
 */
export function hitNote (notes, v, x, y, edge = 7) {
  if (!Array.isArray(notes)) return null
  for (let i = notes.length - 1; i >= 0; i--) {
    const n = notes[i]; if (!n) continue
    const r = noteRect(v, n)
    if (x < r.x || x > r.x + r.w || y < r.y - 0.5 || y > r.y + r.h + 0.5) continue
    const e = Math.min(edge, r.w / 3)
    const part = x >= r.x + r.w - e ? 'right' : x <= r.x + e ? 'left' : 'body'
    return { index: i, part }
  }
  return null
}

/** Normalised rectangle { x0, y0, x1, y1 } (x0 <= x1, y0 <= y1) from two corners. */
export function normRect (xa, ya, xb, yb) { return { x0: Math.min(xa, xb), y0: Math.min(ya, yb), x1: Math.max(xa, xb), y1: Math.max(ya, yb) } }
/** Indices of the notes that touch the rubber band (screen rect, grid-relative y). */
export function notesInRect (notes, v, rect) {
  const out = []; if (!Array.isArray(notes)) return out
  for (let i = 0; i < notes.length; i++) {
    const r = noteRect(v, notes[i])
    if (r.x <= rect.x1 && r.x + r.w >= rect.x0 && r.y <= rect.y1 && r.y + r.h >= rect.y0) out.push(i)
  }
  return out
}

// ── Moving / resizing ───────────────────────────────────────────────────────────

/** Limits a move of `notes` by (dSteps, dSemis) so every note stays inside the pattern (start >= 0, start < total) and the pitch inside 0..127. */
export function clampMove (notes, dSteps, dSemis, total) {
  if (!Array.isArray(notes) || !notes.length) return { dSteps: 0, dSemis: 0 }
  let minS = Infinity; let maxS = -Infinity; let minM = Infinity; let maxM = -Infinity
  for (const n of notes) { if (n.start < minS) minS = n.start; if (n.start > maxS) maxS = n.start; if (n.midi < minM) minM = n.midi; if (n.midi > maxM) maxM = n.midi }
  const lastStart = total - 0.05
  return {
    dSteps: r6(clamp(fin(dSteps, 0), -minS, Math.max(-minS, lastStart - maxS))),
    dSemis: Math.round(clamp(fin(dSemis, 0), -minM, 127 - maxM)),
  }
}
/** A moved copy of the notes (ids / other fields kept). */
export const moveNotes = (notes, dSteps, dSemis) => notes.map(n => ({ ...n, start: r6(n.start + dSteps), midi: n.midi + dSemis }))

/** Move delta from a pointer drag: pixels -> steps (snapped to `grid`, applied to the earliest note so the whole group stays on the grid) and semitones. */
export function dragDelta (v, dxPx, dyPx, grid, firstStart = 0) {
  const raw = dxPx / v.pxPerStep
  const dSteps = grid > 0 ? snapTo(firstStart + raw, grid) - firstStart : raw
  return { dSteps: r6(dSteps), dSemis: Math.round(-dyPx / v.rowH) }
}

/** Length change for a right-edge drag: new length = snapped end - start; all notes of the group get the same DELTA of the dragged note, clamped to [minLen, total - start]. */
export function resizeRight (notes, ref, endStep, grid, total, minLen = 0.05) {
  const snapped = grid > 0 ? snapTo(endStep, grid) : endStep
  let d = snapped - (ref.start + ref.length)
  for (const n of notes) { d = Math.max(d, minLen - n.length); d = Math.min(d, Math.max(0, total - (n.start + n.length))) }
  return notes.map(n => ({ ...n, length: r6(Math.max(minLen, n.length + d)) }))
}
/** Left-edge drag: moves the start of the group's notes by the same delta (end stays), clamped so every note keeps >= minLen and start >= 0. */
export function resizeLeft (notes, ref, startStep, grid, minLen = 0.05) {
  const snapped = grid > 0 ? snapTo(startStep, grid) : startStep
  let d = snapped - ref.start
  for (const n of notes) { d = Math.max(d, -n.start); d = Math.min(d, n.length - minLen) }
  return notes.map(n => ({ ...n, start: r6(n.start + d), length: r6(n.length - d) }))
}

// ── Velocity lane ───────────────────────────────────────────────────────────────

/** Velocity (0.01..1) of a y inside a lane of height h (top = 1). */
export const yToVelocity = (h, y) => r6(clamp(1 - fin(y, 0) / Math.max(1, h), 0.01, 1))
export const velocityToY = (h, vel) => (1 - clamp(fin(vel, 0.8), 0, 1)) * h
/** The note whose velocity bar is at x (screen); bars are `bw` px wide around the start of the note. Later notes win. null if none. */
export function hitVelocity (notes, v, x, bw = 8) {
  if (!Array.isArray(notes)) return null
  let best = null; let bd = Infinity
  for (let i = notes.length - 1; i >= 0; i--) {
    const sx = stepToX(v, notes[i].start); const d = Math.abs(x - (sx + 1))
    if (d <= bw / 2 + 1 && d < bd) { best = i; bd = d }
  }
  return best
}

// ── Grid lines ──────────────────────────────────────────────────────────────────

/** Vertical lines to draw for the visible steps: [{ step, kind: 'bar'|'beat'|'step'|'sub' }]. Lines too dense to read are left out. */
export function gridLines (v, viewW, snapGrid = 1) {
  const out = []
  const from = Math.max(0, Math.floor(xToStep(v, v.keyW))); const to = Math.min(v.total, Math.ceil(xToStep(v, v.keyW + viewW)))
  const showStep = v.pxPerStep >= 9; const showSub = v.pxPerStep >= 26 && snapGrid > 0 && snapGrid < 1
  for (let s = from; s <= to; s++) {
    const bar = s % v.spb === 0; const beat = Math.abs((s / v.beat) - Math.round(s / v.beat)) < 1e-9
    if (bar) out.push({ step: s, kind: 'bar' }); else if (beat) out.push({ step: s, kind: 'beat' }); else if (showStep) out.push({ step: s, kind: 'step' })
    if (showSub && s < v.total) out.push({ step: s + 0.5, kind: 'sub' })
  }
  return out
}

// ── Pitch names, scales ─────────────────────────────────────────────────────────

export const pitchClass = (midi) => ((Math.round(fin(midi, 0)) % 12) + 12) % 12
export const isBlack = (midi) => [1, 3, 6, 8, 10].includes(pitchClass(midi))
/** 60 -> 'C4' (MIDI 60 = C4). */
export const pitchName = (midi) => KEY_NAMES[pitchClass(midi)] + (Math.floor(Math.round(fin(midi, 0)) / 12) - 1)
/** A label for a key row, only on Cs (or every row when `all`), else ''. */
export const keyLabel = (midi, all = false) => (all || pitchClass(midi) === 0 ? pitchName(midi) : '')

/** The 12-entry boolean mask (index = pitch class) of a scale in a key (0..11 = C..B). Unknown scale = chromatic. */
export function scaleMask (key, scale) {
  const k = ((Math.round(fin(key, 0)) % 12) + 12) % 12
  const iv = Object.prototype.hasOwnProperty.call(SCALES, scale) ? SCALES[scale] : SCALES.chromatic
  const m = new Array(12).fill(false)
  for (const i of iv) m[(i + k) % 12] = true
  return m
}
export const inScale = (midi, key, scale) => scaleMask(key, scale)[pitchClass(midi)]
/** Nearest pitch inside the scale (ties go UP unless dir = -1; dir 1 / -1 force a direction). A pitch already in the scale is returned unchanged. */
export function snapToScale (midi, key, scale, dir = 0) {
  const m = scaleMask(key, scale); const p = clamp(Math.round(fin(midi, 60)), 0, 127)
  if (m[pitchClass(p)]) return p
  for (let d = 1; d < 12; d++) {
    const up = p + d; const down = p - d
    const okUp = up <= 127 && m[pitchClass(up)]; const okDown = down >= 0 && m[pitchClass(down)]
    if (dir > 0 && okUp) return up
    if (dir < 0 && okDown) return down
    if (dir === 0) { if (okUp) return up; if (okDown) return down }
  }
  return p
}
/** Is this pitch the ROOT of the key? (for the row highlight) */
export const isRoot = (midi, key) => pitchClass(midi) === (((Math.round(fin(key, 0)) % 12) + 12) % 12)
