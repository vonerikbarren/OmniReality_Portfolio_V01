/**
 * utils/OmniTransformModel.js (V267) — pure maths + prefs for the TransformBar. No DOM, no Three.js: vectors are [x, y, z] arrays.
 *   MODES move | rotate | scale · SPACES world | local
 *   sanitizeTransformPrefs(p)        never throws; idempotent; uniform (scale lock) defaults ON
 *   scaleWithLock(start, axis, v, uniform)   one scale box typed: uniform ON -> all 3 axes grow by the same ratio (shape kept), OFF -> only that axis
 *   clampScale(v)                    each axis kept in [SCALE_MIN, SCALE_MAX], never 0 / NaN
 *   centreOf(points)                 average of positions
 *   rotateAbout(point, centre, axis, rad)   rotate a position around a world axis through centre
 *   scaleAbout(point, centre, ratio) scale a position away from / towards centre
 *   pushUndo(stack, entry, max)      bounded undo stack (returns a new array)
 */
export const MODES = Object.freeze(['move', 'rotate', 'scale'])
export const SPACES = Object.freeze(['world', 'local'])
export const SCALE_MIN = 0.01, SCALE_MAX = 1000, UNDO_MAX = 50
export const DEFAULT_PREFS = Object.freeze({ mode: 'move', space: 'world', uniform: true, step: 1, pinned: false, collapsed: false, group: true })

const num = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d }
const clean = (n) => { const r = Math.round(n * 1e6) / 1e6; return r === 0 ? 0 : r }
const axisI = (a) => (a === 'x' || a === 0 ? 0 : a === 'y' || a === 1 ? 1 : a === 'z' || a === 2 ? 2 : -1)

export function sanitizeTransformPrefs (p) {
  const o = (p && typeof p === 'object') ? p : {}
  const step = num(o.step, 1)
  return {
    mode: MODES.includes(o.mode) ? o.mode : DEFAULT_PREFS.mode,
    space: SPACES.includes(o.space) ? o.space : DEFAULT_PREFS.space,
    uniform: o.uniform === false ? false : true,
    step: step > 0 && step <= 1000 ? step : 1,
    pinned: o.pinned === true, collapsed: o.collapsed === true, group: o.group === false ? false : true
  }
}

export function clampScale (v) {
  const a = Array.isArray(v) ? v : [1, 1, 1]
  return [0, 1, 2].map(i => clean(Math.min(SCALE_MAX, Math.max(SCALE_MIN, num(a[i], 1)))))
}

export function scaleWithLock (start, axis, value, uniform) {
  const s = clampScale(start), i = axisI(axis); if (i < 0) return s
  const v = Math.min(SCALE_MAX, Math.max(SCALE_MIN, num(value, s[i])))
  if (!uniform) { const o = [...s]; o[i] = clean(v); return clampScale(o) }
  const ratio = v / s[i]
  return clampScale(s.map(x => x * ratio))
}

export function centreOf (points) {
  const p = (Array.isArray(points) ? points : []).filter(a => Array.isArray(a) && a.length >= 3)
  if (!p.length) return [0, 0, 0]
  return [0, 1, 2].map(i => clean(p.reduce((s, a) => s + num(a[i]), 0) / p.length))
}

export function rotateAbout (point, centre, axis, rad) {
  const i = axisI(axis), c = Math.cos(rad), s = Math.sin(rad)
  const d = [0, 1, 2].map(k => num(point?.[k]) - num(centre?.[k]))
  let r = d
  if (i === 0) r = [d[0], d[1] * c - d[2] * s, d[1] * s + d[2] * c]
  else if (i === 1) r = [d[0] * c + d[2] * s, d[1], -d[0] * s + d[2] * c]
  else if (i === 2) r = [d[0] * c - d[1] * s, d[0] * s + d[1] * c, d[2]]
  return [0, 1, 2].map(k => clean(r[k] + num(centre?.[k])))
}

export function scaleAbout (point, centre, ratio) {
  const q = Math.min(SCALE_MAX, Math.max(SCALE_MIN, num(ratio, 1)))
  return [0, 1, 2].map(k => clean(num(centre?.[k]) + (num(point?.[k]) - num(centre?.[k])) * q))
}

export function pushUndo (stack, entry, max = UNDO_MAX) {
  const s = Array.isArray(stack) ? stack.slice() : []
  if (entry) s.push(entry)
  return s.length > max ? s.slice(s.length - max) : s
}
