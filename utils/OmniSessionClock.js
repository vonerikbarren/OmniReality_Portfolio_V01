/**
 * utils/OmniSessionClock.js — pure helpers for the OmniMeter session readout (V190)
 *
 * No DOM, no timers: everything here takes numbers/Dates and returns strings/numbers, so the unit tests
 * (and the OmniMeter) can use it without a browser.
 *
 *   formatClock(ms)       24-hour local time  HH:MM:SS   ("military time")
 *   formatClockHM(ms)     24-hour local time  HH:MM
 *   formatElapsed(ms)     duration            HH:MM:SS   (hours keep counting past 99)
 *   clampGoalHours(v)     session goal in hours, clamped to [GOAL_MIN_H, GOAL_MAX_H], default 2
 *   sessionProgress(e,g)  { frac, laps, over, pct } — the bar fills once up to the goal, then wraps (laps + 1)
 *   getSessionStart(...)  the session start time; kept in sessionStorage so a refresh of the same tab does NOT
 *                         reset it (a new tab / a closed-and-reopened browser is a new session).
 */

export const GOAL_DEFAULT_H = 2
export const GOAL_MIN_H = 0.25
export const GOAL_MAX_H = 24
export const SESSION_START_KEY = 'omni:session-start-v1'
const MAX_AGE_MS = 7 * 24 * 3600 * 1000   // a stored start older than a week is stale (tab left open) -> treated as new

const p2 = (n) => String(Math.floor(Math.abs(n))).padStart(2, '0')

export function formatClock (ms) {
  const d = new Date(ms)
  return `${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`
}

export function formatClockHM (ms) {
  const d = new Date(ms)
  return `${p2(d.getHours())}:${p2(d.getMinutes())}`
}

export function formatElapsed (ms) {
  const total = Math.max(0, Math.floor((Number(ms) || 0) / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return `${p2(h)}:${p2(m)}:${p2(s)}`
}

/** Goal in hours: finite number clamped to [0.25, 24]; anything else -> 2. Rounded to 2 decimals. */
export function clampGoalHours (v) {
  const n = typeof v === 'string' ? parseFloat(v) : (typeof v === 'number' ? v : NaN)   // null / boolean / objects are junk, not 0 / 1
  if (!Number.isFinite(n)) return GOAL_DEFAULT_H
  return Math.round(Math.min(GOAL_MAX_H, Math.max(GOAL_MIN_H, n)) * 100) / 100
}

/**
 * @param {number} elapsedMs
 * @param {number} goalMs
 * @returns {{frac:number, laps:number, over:boolean, pct:number}}
 *   laps = completed goals; frac = 0..1 fill of the CURRENT lap; over = the goal was reached at least once
 */
export function sessionProgress (elapsedMs, goalMs) {
  const e = Math.max(0, Number(elapsedMs) || 0)
  const g = Math.max(1, Number(goalMs) || 1)
  const laps = Math.floor(e / g)
  const frac = (e - laps * g) / g
  return { frac, laps, over: laps >= 1, pct: Math.round(frac * 1000) / 10 }
}

/**
 * The session start time (epoch ms). Reads `store` (a sessionStorage-like), validates it (finite, not in the
 * future, not older than a week) and otherwise stores `now`. Never throws; with no usable storage it just returns `now`.
 */
export function getSessionStart (store, now = Date.now()) {
  try {
    const raw = store?.getItem?.(SESSION_START_KEY)
    const n = raw == null ? NaN : Number(raw)
    if (Number.isFinite(n) && n <= now && now - n <= MAX_AGE_MS && n > 0) return n
  } catch (_) {}
  try { store?.setItem?.(SESSION_START_KEY, String(now)) } catch (_) {}
  return now
}
