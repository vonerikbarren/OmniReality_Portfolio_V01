/**
 * utils/OmniDocWindowModel.js (V250) — pure model of a WINDOW onto a long document: N sheets (laid out by utils/OmniDocPageLayouts.js) that show N consecutive pages, and a carousel that
 * flips the window forward or back so a few sheets can show hundreds of pages (the pixel budget only ever pays for N sheets).
 *   win = { id, src (the doc node the source was taken from), layout, count, center:[x,y,z], start (first page shown, 1-based), pages (total, 0 = unknown), slots:[nodeId ...] }
 *   slots[s] is the node standing in slot s; slot s shows page start + s.
 *   sanitizeWindow(raw) · clampStart(start, count, pages) · pageOfSlot(win, s) · stepPlan(win, dir) · jumpPlan(win, start)
 *   stepPlan(win, +1): the node in slot 0 leaves (shrinks), every other node glides one slot toward 0, and the leaver comes back in the LAST slot with the next page (grows). -1 is the mirror.
 * Never throws; hostile input gives a safe window or null.
 */
import { LAYOUTS, COUNTS, pickLayout } from './OmniDocPageLayouts.js'

export const MAX_WINDOWS = 16
export const MAX_COUNT = 25
const ID = /^[\w-]{1,64}$/; const BAD = new Set(['__proto__', 'constructor', 'prototype'])
const idOk = (v) => typeof v === 'string' && ID.test(v) && !BAD.has(v)
const int = (v, d, lo, hi) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d }
const vec = (v) => (Array.isArray(v) && v.length >= 3 && v.slice(0, 3).every(Number.isFinite) ? v.slice(0, 3).map(Number) : [0, 0, 0])

/** The first page that keeps the whole window inside the document (pages = 0: unknown, only >= 1). */
export function clampStart (start, count, pages) {
  const s = int(start, 1, 1, 100000); const p = int(pages, 0, 0, 100000)
  if (p > 0) return Math.max(1, Math.min(s, p - count + 1))
  return s
}

export function sanitizeWindow (raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || !idOk(raw.id)) return null
  const layout = pickLayout(raw.layout) ?? 'row'
  const slots = []; for (const n of (Array.isArray(raw.slots) ? raw.slots : []).slice(0, MAX_COUNT)) if (idOk(n) && !slots.includes(n)) slots.push(n)
  if (!slots.length) return null
  const count = slots.length; const pages = int(raw.pages, 0, 0, 100000)
  return { id: raw.id, src: idOk(raw.src) ? raw.src : '', layout, count, center: vec(raw.center), pages, start: clampStart(raw.start, count, pages), slots }
}
export const pageOfSlot = (win, s) => win.start + s

/** What happens when the window turns by one page. null when it cannot (already at the first / last page). */
export function stepPlan (win, dir) {
  const w = sanitizeWindow(win); if (!w) return null
  const d = dir < 0 ? -1 : 1; const start = clampStart(w.start + d, w.count, w.pages)
  if (start === w.start || w.count < 2 && w.pages > 0 && start > w.pages) return null
  const n = w.count
  if (d > 0) {
    const leaver = w.slots[0]
    return { dir: d, start, leaver, arrive: { id: leaver, slot: n - 1, page: start + n - 1 }, moves: w.slots.slice(1).map((id, i) => ({ id, from: i + 1, to: i })), slots: [...w.slots.slice(1), leaver] }
  }
  const leaver = w.slots[n - 1]
  return { dir: d, start, leaver, arrive: { id: leaver, slot: 0, page: start }, moves: w.slots.slice(0, n - 1).map((id, i) => ({ id, from: i, to: i + 1 })), slots: [leaver, ...w.slots.slice(0, n - 1)] }
}
/** Go straight to a first page (no carousel motion): every slot gets its page. */
export function jumpPlan (win, start) {
  const w = sanitizeWindow(win); if (!w) return null
  const s = clampStart(start, w.count, w.pages)
  return { start: s, pages: w.slots.map((id, i) => ({ id, slot: i, page: s + i })), changed: s !== w.start }
}
export const describe = (w) => `${w.id} [${w.layout}] ${w.count} sheets showing pages ${w.start}-${w.start + w.count - 1}${w.pages ? ' of ' + w.pages : ''}`
export default { MAX_WINDOWS, MAX_COUNT, LAYOUTS, COUNTS, sanitizeWindow, clampStart, pageOfSlot, stepPlan, jumpPlan, describe }
