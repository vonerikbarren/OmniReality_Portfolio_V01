/**
 * utils/TimeDataRuler.js — the TimeData ruler model (V192): which time window is on the ruler, how much of the day is consumed,
 * and the DRAW PLAN (every line and label with its pixel position). No DOM, no canvas, no timers: ui/TimeDataRulerPanel.js only
 * paints the plan, so everything here is unit-tested.
 *
 * The ruler runs TOP TO BOTTOM. The baseline (00:00:00) is the instant the person chose (utils/TimeDataRulerSettings.js
 * resolveBaseline). A zoom decides the length of the window on screen; page 0 starts AT the baseline:
 *
 *   zoom     window (calendar, local)   major lines                    hierarchy lines also drawn (when dense enough)
 *   day      1 day  (23..25 real hours) hours 00:00 .. 24:00 + minors  day (midnights)
 *   week     7 days                     days                           week, month, year, decade
 *   month    1 calendar month           weeks                          month, year, decade (+ days as hairlines)
 *   year     1 calendar year            months                         week hairlines, year, decade
 *   decade   100 calendar years         decades                        year hairlines
 *
 * A level is drawn only when its lines are far enough apart on screen (MIN_PX), and a label only when it does not collide with a
 * higher-priority label (TimeRulerMath.declutter), so a small window or a small phone never fills with overlapping text.
 */

import {
  DAY, HOUR, MIN, isValidTs, parts, wall, addDays, addMonths, addYears, hierarchyLines, dayNotches, effectiveMinorStep, declutter,
  avgLevelMs, LEVEL_RANK, formatClock, formatHMS, normalizeWeekMode,
} from './TimeRulerMath.js'

export const ZOOMS = Object.freeze(['day', 'week', 'month', 'year', 'decade'])
export const ZOOM_LABELS = Object.freeze({ day: 'Day', week: 'Week', month: 'Month', year: 'Year', decade: 'Decade' })
/** The level whose lines carry the labels at this zoom. */
export const MAJOR_LEVEL = Object.freeze({ day: 'hour', week: 'day', month: 'week', year: 'month', decade: 'decade' })
/** Minimum distance (px) between two lines of a level for the level to be drawn at all. */
export const MIN_PX = Object.freeze({ minute: 4, hour: 6, day: 4, week: 4, month: 4, year: 4, decade: 6 })
/** Line length (0..1 of the line area), weight (px) and base alpha per level: all grow up the hierarchy. */
export const LEVEL_STYLE = Object.freeze({
  minute: { len: 0.10, w: 1,    a: 0.45 },
  hour:   { len: 0.20, w: 1,    a: 0.70 },
  day:    { len: 0.32, w: 1,    a: 0.70 },
  week:   { len: 0.46, w: 1.25, a: 0.80 },
  month:  { len: 0.64, w: 1.5,  a: 0.90 },
  year:   { len: 0.82, w: 2,    a: 1.00 },
  decade: { len: 1.00, w: 2.5,  a: 1.00 },
})

export function normalizeZoom (z) { return ZOOMS.includes(z) ? z : 'day' }
/** One step in (dir < 0 = closer, towards day) or out (dir > 0). Clamped at both ends. */
export function stepZoom (zoom, dir) {
  const i = ZOOMS.indexOf(normalizeZoom(zoom)), d = dir > 0 ? 1 : dir < 0 ? -1 : 0
  return ZOOMS[Math.min(ZOOMS.length - 1, Math.max(0, i + d))]
}

// ── the window on the ruler ──────────────────────────────────────────────────

function windowEdge (baselineTs, zoom, page) {
  switch (zoom) {
    case 'day': return addDays(baselineTs, page)
    case 'week': return addDays(baselineTs, 7 * page)
    case 'month': return addMonths(baselineTs, page)
    case 'year': return addYears(baselineTs, page)
    default: return addYears(baselineTs, 100 * page)
  }
}
/** { start, end, page, zoom } of page `page` (0 = the window that starts at the baseline; negative = before it); null when out of the supported range. */
export function windowFor (baselineTs, zoom, page = 0) {
  if (!isValidTs(baselineTs) || !Number.isInteger(page) || Math.abs(page) > 100000) return null
  const z = normalizeZoom(zoom)
  const start = windowEdge(baselineTs, z, page), end = windowEdge(baselineTs, z, page + 1)
  if (!Number.isFinite(start) || !Number.isFinite(end) || !(end > start)) return null
  return { start, end, page, zoom: z }
}
const AVG_SPAN = { day: DAY, week: 7 * DAY, month: 30.436875 * DAY, year: 365.2425 * DAY, decade: 36524.25 * DAY }
/** The page that holds `nowTs` (what "follow" shows). 0 for bad input; adjusts a few steps because calendar windows are not equal in length. */
export function pageAt (baselineTs, zoom, nowTs) {
  if (!isValidTs(baselineTs) || !isValidTs(nowTs)) return 0
  const z = normalizeZoom(zoom)
  let p = Math.floor((nowTs - baselineTs) / AVG_SPAN[z])
  for (let i = 0; i < 6; i++) {
    const w = windowFor(baselineTs, z, p); if (!w) return 0
    if (nowTs < w.start) p--
    else if (nowTs >= w.end) p++
    else return p
  }
  return Math.max(-100000, Math.min(100000, p))
}

// ── time consumption ─────────────────────────────────────────────────────────

/**
 * How much of the day window has been consumed.
 *   baselineTs, nowTs, page   the window is windowFor(baselineTs, 'day', page)
 * -> { state: 'before' | 'running' | 'done', start, end, lengthMs, elapsedMs, remainingMs, frac (0..1), hourIndex (whole hours
 *      since the window opened), untilStartMs }  or null for bad input.
 * 'before' = the window has not opened yet (elapsed 0, remaining = the whole day), 'done' = it is over (elapsed = whole day, remaining 0).
 */
export function consumption (baselineTs, nowTs, page = 0) {
  if (!isValidTs(nowTs)) return null
  const w = windowFor(baselineTs, 'day', page); if (!w) return null
  const len = w.end - w.start
  if (nowTs < w.start) return { state: 'before', start: w.start, end: w.end, lengthMs: len, elapsedMs: 0, remainingMs: len, frac: 0, hourIndex: -1, untilStartMs: w.start - nowTs }
  if (nowTs >= w.end) return { state: 'done', start: w.start, end: w.end, lengthMs: len, elapsedMs: len, remainingMs: 0, frac: 1, hourIndex: Math.floor(len / HOUR), untilStartMs: 0 }
  const el = nowTs - w.start
  return { state: 'running', start: w.start, end: w.end, lengthMs: len, elapsedMs: el, remainingMs: len - el, frac: el / len, hourIndex: Math.floor(el / HOUR), untilStartMs: 0 }
}

/** The page "follow" shows: the page holding now, but never one BEFORE the baseline (a baseline in the future shows page 0 with "Starts in ..."). */
export function followPage (baselineTs, zoom, nowTs) { return Math.max(0, pageAt(baselineTs, zoom, nowTs)) }

/** Which day page "now" is on: 'follow' = the page holding now (it advances at the end of every day), 'stop' = the page the person is looking at (stopPage, default 0). */
export function dayPage (baselineTs, nowTs, rollover = 'follow', stopPage = 0) {
  return rollover === 'stop' ? (Number.isInteger(stopPage) ? stopPage : 0) : followPage(baselineTs, 'day', nowTs)
}

// ── the draw plan ────────────────────────────────────────────────────────────

/**
 * @param {object} o
 *   baselineTs, nowTs, zoom, page   what to show
 *   settings                        utils/TimeDataRulerSettings.js (weekMode, show*, minorDensity)
 *   width, height                   the canvas in CSS px
 *   fontPx                          label text height (default 10)
 *   padY                            top / bottom inset so the first and last label are fully visible (default 12)
 *   gutterL, gutterR                left label column (hour labels) / right label column (hierarchy labels), px
 * @returns {object|null} plan: { zoom, page, win:{start,end}, view:{start,end,top,size}, spineX, lineX0, lineW, pxPerHour,
 *   minorStep, lines:[{y, ts, level, len, w, a, kind}], left:[{y, text, level, bold}], right:[{y, text, level, bold}],
 *   baseline:{y}|null, now:{y (clamped into the window), state:'above'|'in'|'below'}, fill:{y0,y1}|null, counts:{...} }   null on bad input.
 *   kind: 'line' | 'accent' (baseline / decade lines use the accent colour).
 */
export function buildPlan (o) {
  if (!o || typeof o !== 'object') return null
  const zoom = normalizeZoom(o.zoom)
  const width = Number(o.width), height = Number(o.height)
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 40 || height < 40) return null
  const baselineTs = o.baselineTs
  const page = Number.isInteger(o.page) ? o.page : 0
  const win = windowFor(baselineTs, zoom, page); if (!win) return null
  const S = o.settings ?? {}
  const weekMode = normalizeWeekMode(S.weekMode)
  const fontPx = Number.isFinite(o.fontPx) && o.fontPx > 4 ? o.fontPx : 10
  const padY = Number.isFinite(o.padY) ? Math.max(0, Math.min(o.padY, height / 4)) : 12
  const gutterL = Number.isFinite(o.gutterL) ? Math.max(0, Math.min(o.gutterL, width / 3)) : 40
  const gutterR = Number.isFinite(o.gutterR) ? Math.max(0, Math.min(o.gutterR, width / 2.2)) : 58
  const size = height - 2 * padY
  const view = { start: win.start, end: win.end, top: padY, size }
  const pxPerMs = size / (win.end - win.start)
  const yOf = (ts) => padY + (ts - win.start) * pxPerMs
  const spineX = gutterL
  const lineX0 = spineX + 3
  const lineW = Math.max(8, width - gutterR - lineX0 - 4)
  const lines = [], left = [], right = []

  // 1. hierarchy lines (calendar boundaries) that are dense enough, filtered by the settings
  const want = []
  const dense = (lv) => avgLevelMs(lv) * pxPerMs >= MIN_PX[lv]
  if (dense('day')) want.push('day')
  if (S.showWeeks !== false && dense('week')) want.push('week')
  if (S.showMonths !== false && dense('month')) want.push('month')
  if (S.showYears !== false && dense('year')) want.push('year')
  if (S.showDecades !== false && dense('decade')) want.push('decade')
  // a decade is also a year: when years are switched off the decade lines still show (they are their own setting)
  const hier = want.length ? hierarchyLines(win.start, win.end, { levels: want, weekMode, max: 1200 }) : []
  const major = MAJOR_LEVEL[zoom]
  for (const b of hier) {
    const st = LEVEL_STYLE[b.level]
    const y = yOf(b.ts)
    lines.push({ y, ts: b.ts, level: b.level, len: st.len, w: st.w, a: st.a, kind: b.level === 'decade' ? 'accent' : 'line' })
    // labels: the major level and everything above it are labelled; lower levels are hairlines only
    if (LEVEL_RANK[b.level] >= LEVEL_RANK[major] || (major === 'hour' && b.level === 'day')) {
      right.push({ y, text: b.label, level: b.level, bold: LEVEL_RANK[b.level] >= LEVEL_RANK.month, priority: LEVEL_RANK[b.level] * 10 })
    }
  }

  // 2. hour / minute notches, only for the day zoom (a 1-day window)
  let minorStep = 0
  const pxPerHour = HOUR * pxPerMs
  if (zoom === 'day') {
    minorStep = effectiveMinorStep(S.minorDensity ?? '15', pxPerHour, MIN_PX.minute)
    for (const n of dayNotches(win.start, minorStep)) {
      const y = yOf(n.ts)
      if (n.major) {
        const st = LEVEL_STYLE.hour
        lines.push({ y, ts: n.ts, level: 'hour', len: st.len, w: st.w, a: st.a, kind: 'line' })
        const h = n.hour
        left.push({ y, text: n.label, level: 'hour', bold: h % 6 === 0, priority: h === 0 || h === 24 ? 8 : h % 12 === 0 ? 6 : h % 6 === 0 ? 4 : h % 3 === 0 ? 2 : 0 })
      } else {
        const st = LEVEL_STYLE.minute
        lines.push({ y, ts: n.ts, level: 'minute', len: n.minute === 30 ? st.len * 1.5 : st.len, w: st.w, a: st.a, kind: 'line' })
      }
    }
  }

  // 3. baseline line (page 0: the very top, the person's 00:00:00)
  let baseline = null
  if (baselineTs >= win.start && baselineTs <= win.end) {
    baseline = { y: yOf(baselineTs) }
    lines.push({ y: baseline.y, ts: baselineTs, level: 'decade', len: 1, w: 2, a: 1, kind: 'accent', baseline: true })
  }

  // 4. now marker + consumed fill (the window is a day for the readout; for the other zooms the same rule on that window)
  const nowTs = o.nowTs
  let now = null, fill = null
  if (isValidTs(nowTs)) {
    const state = nowTs < win.start ? 'above' : nowTs > win.end ? 'below' : 'in'
    const cy = yOf(Math.min(win.end, Math.max(win.start, nowTs)))
    now = { y: cy, state }
    if (state !== 'above') fill = { y0: padY, y1: cy }
  }

  // 5. declutter
  const lh = fontPx + 1
  const keepL = declutter(left.map(l => ({ ...l, h: lh })), 1)
  const keepR = declutter(right.map(l => ({ ...l, h: lh })), 1)

  return {
    zoom, page, win: { start: win.start, end: win.end }, view, spineX, lineX0, lineW, padY, pxPerHour, minorStep,
    lines, left: keepL, right: keepR, baseline, now, fill,
    counts: { lines: lines.length, hourNotches: lines.filter(l => l.level === 'hour').length, minorNotches: lines.filter(l => l.level === 'minute').length, labelsLeft: keepL.length, labelsRight: keepR.length },
  }
}

/** Readout strings for the panel: { elapsed, remaining, percent, day, state, text } from consumption(). */
export function readout (c, page = 0) {
  if (!c) return { elapsed: '00:00:00', remaining: '00:00:00', percent: '0.0%', day: 'Day +0', state: 'running', text: '' }
  const pct = (Math.round(c.frac * 1000) / 10).toFixed(1) + '%'
  const day = page === 0 ? 'Day +0' : (page > 0 ? `Day +${page}` : `Day ${page}`)
  const text = c.state === 'before' ? `Starts in ${formatHMS(c.untilStartMs)}` : c.state === 'done' ? 'Day complete' : `${pct} of the day`
  return { elapsed: formatHMS(c.elapsedMs), remaining: formatHMS(c.remainingMs), percent: pct, day, state: c.state, text }
}

export { formatClock, MIN }
