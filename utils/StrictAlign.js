/**
 * utils/StrictAlign.js — pure math behind OmniState_StrictAlign (V191)
 *
 * No DOM, no Three.js, no storage: vectors are plain [x, y, z] arrays, so it is unit-testable without a browser.
 *
 *   isAxis / axisIndex / axisVector     'x' | 'y' | 'z'
 *   WORLD_LIMITS, clampToWorld          the world box a node may be moved inside (the wallpaper sphere's extent, as ui/OmniMeter.js uses)
 *   roundTo(v, decimals)                V192: round to the configurable precision (0..6, default 4) without float dust (1.005 -> 1.01 at 2)
 *   cleanNumber / formatCoord / parseCoord   exact numbers: no -0, no float dust (1.2000000000000002 -> 1.2), typed text -> number | null
 *   snapToStep(v, step)                 the nearest multiple of step (float-clean)
 *   nudge(v, dir, step)                 one step up / down from v, ending ON a multiple of step (from 0.35 with step 0.1: 0.4, then 0.5)
 *   stepFor(settings, shift, alt)       settings.step; Shift = x10 (or the legacy settings.shiftStep when shiftAuto is off); Alt = /10
 *   projectRayOnAxis(origin, dir, point, axis)   where along the axis line through `point` the pointer ray comes closest -> { coord, s, t } | null
 *   dragCoord({ startCoord, startRayCoord, nowRayCoord, step, snap, axis })   a drag keeps the grab offset (the node does not jump under the pointer)
 *   clampDelta(positions, axis, delta)  the largest part of delta that keeps EVERY position inside the world (a group moves rigidly)
 *   applyDelta(positions, axis, delta)  new positions, one axis shifted (inputs are not mutated)
 *   axisFromKey(e)                      '1'/'x' -> 'x', '2'/'y' -> 'y', '3'/'z' -> 'z' (Digit1..3 / Numpad1..3 / KeyX..Z), else null
 *   isTypingTarget(el)                  input / textarea / select / contentEditable
 */

export const AXES = Object.freeze(['x', 'y', 'z'])
export const WORLD_LIMITS = Object.freeze({ x: Object.freeze([-525, 525]), y: Object.freeze([-497, 553]), z: Object.freeze([-525, 525]) })   // y: CENTER_Y 28 +/- 525

export const isAxis = (a) => a === 'x' || a === 'y' || a === 'z'
export const axisIndex = (a) => (a === 'x' ? 0 : a === 'y' ? 1 : a === 'z' ? 2 : -1)
export const axisVector = (a) => (a === 'x' ? [1, 0, 0] : a === 'y' ? [0, 1, 0] : a === 'z' ? [0, 0, 1] : [0, 0, 0])
export const AXIS_COLORS = Object.freeze({ x: '#ff5a5a', y: '#5aff7a', z: '#5a9bff' })

export function clampToWorld (axis, v) {
  const lim = WORLD_LIMITS[axis]; if (!lim) return Number(v) || 0
  const n = Number(v); if (!Number.isFinite(n)) return 0
  return Math.min(lim[1], Math.max(lim[0], n))
}

export function cleanNumber (v) {
  const n = Number(v); if (!Number.isFinite(n)) return 0
  const r = Math.round(n * 1e6) / 1e6
  return r === 0 ? 0 : r
}

export const PRECISION_DEFAULT = 4

/** Round to `decimals` (0..6, default 4) the decimal way: 1.005 -> 1.01 at 2 places (not 1 because of binary dust); no -0. */
export function roundTo (v, decimals = PRECISION_DEFAULT) {
  const n = Number(v); if (!Number.isFinite(n)) return 0
  const d = Math.min(6, Math.max(0, Math.round(Number(decimals)))) || 0
  if (/e/i.test(String(n))) { const f = 10 ** d; const r = Math.round(n * f) / f; return r === 0 ? 0 : r }
  const r = Number(Math.round(Number(`${n}e${d}`)) + `e-${d}`)
  return Number.isFinite(r) && r !== 0 ? r : 0
}

/** Up to `decimals` (default 4) decimals, trailing zeros trimmed: 1.5 -> "1.5", 2 -> "2", -0.00001 -> "0". */
export function formatCoord (v, decimals = PRECISION_DEFAULT) {
  return String(roundTo(cleanNumber(v), decimals))
}

/** "1.25" / " -3 " / "1e2" / "2,5" -> number; anything else (empty, NaN, Infinity, "1.2.3") -> null. */
export function parseCoord (text) {
  if (typeof text === 'number') return Number.isFinite(text) ? cleanNumber(text) : null
  if (typeof text !== 'string') return null
  const s = text.trim().replace(/,/g, '.')
  if (!s || !/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(s)) return null
  const n = Number(s)
  return Number.isFinite(n) ? cleanNumber(n) : null
}

const validStep = (step) => (Number.isFinite(Number(step)) && Number(step) > 0 ? Number(step) : 0.1)

export function snapToStep (v, step) {
  const st = validStep(step)
  return cleanNumber(Math.round(Math.round((Number(v) / st) * 1e6) / 1e6) * st)
}

/** dir > 0 up, dir < 0 down. Lands on a multiple of step. */
export function nudge (v, dir, step) {
  const st = validStep(step), n = Number(v) || 0
  const q = n / st, r = Math.round(q)
  const onGrid = Math.abs(q - r) < 1e-6
  const target = dir >= 0 ? (onGrid ? r + 1 : Math.ceil(q)) : (onGrid ? r - 1 : Math.floor(q))
  return cleanNumber(target * st)
}

/** The step for one press: settings.step; Shift = 10 x step (or the old fixed settings.shiftStep when shiftAuto is off); Alt = step / 10. */
export function stepFor (settings, shift, alt = false) {
  const base = validStep(settings?.step ?? 0.1)
  if (shift) return settings?.shiftAuto !== true && Number.isFinite(Number(settings?.shiftStep)) && settings?.shiftStep !== null ? validStep(settings.shiftStep) : cleanNumber(Math.min(1000, base * 10))   // resolved settings always carry shiftAuto; a bare { step, shiftStep } keeps the V191 meaning
  return alt ? cleanNumber(base / 10) : base
}

/**
 * Closest point between the pointer ray (origin + t*dir, t >= 0) and the axis line through `point`.
 * Returns { coord, s, t }: coord = the world coordinate on that axis, s = signed distance along the axis from `point`, t = distance along the ray.
 * null when the ray is (almost) parallel to the axis, or the closest point is behind the camera.
 */
export function projectRayOnAxis (origin, dir, point, axis) {
  const i = axisIndex(axis); if (i < 0) return null
  const dl = Math.hypot(dir[0], dir[1], dir[2]); if (!(dl > 0)) return null
  const v = [dir[0] / dl, dir[1] / dl, dir[2] / dl]
  const u = axisVector(axis)
  const w = [point[0] - origin[0], point[1] - origin[1], point[2] - origin[2]]
  const b = u[0] * v[0] + u[1] * v[1] + u[2] * v[2]
  const d = u[0] * w[0] + u[1] * w[1] + u[2] * w[2]
  const e = v[0] * w[0] + v[1] * w[1] + v[2] * w[2]
  const denom = 1 - b * b
  if (denom < 1e-4) return null                      // parallel: the pointer says nothing about the position on the axis
  const s = (b * e - d) / denom
  const t = (e - b * d) / denom
  if (!(t > 0)) return null
  return { coord: point[i] + s, s, t }
}

export function dragCoord ({ startCoord, startRayCoord, nowRayCoord, step = 0.1, snap = true, axis = 'x', precision = PRECISION_DEFAULT } = {}) {
  const raw = Number(startCoord) + (Number(nowRayCoord) - Number(startRayCoord))
  const v = snap ? snapToStep(raw, step) : cleanNumber(raw)
  return roundTo(clampToWorld(axis, v), precision)
}

/** Largest |delta| (same sign) so every position stays inside the world on `axis`. */
export function clampDelta (positions, axis, delta) {
  const i = axisIndex(axis), lim = WORLD_LIMITS[axis]
  if (i < 0 || !lim || !Array.isArray(positions) || !positions.length) return cleanNumber(delta)
  let d = Number(delta) || 0
  for (const p of positions) {
    const v = Number(p?.[i]) || 0
    d = Math.min(lim[1] - v, Math.max(lim[0] - v, d))
  }
  return cleanNumber(d)
}

export function applyDelta (positions, axis, delta) {
  const i = axisIndex(axis)
  const d = clampDelta(positions, axis, delta)
  return (Array.isArray(positions) ? positions : []).map(p => { const q = [Number(p?.[0]) || 0, Number(p?.[1]) || 0, Number(p?.[2]) || 0]; if (i >= 0) q[i] = cleanNumber(q[i] + d); return q })
}

const CODE_AXIS = { Digit1: 'x', Digit2: 'y', Digit3: 'z', Numpad1: 'x', Numpad2: 'y', Numpad3: 'z', KeyX: 'x', KeyY: 'y', KeyZ: 'z' }
export function axisFromKey (e) {
  if (!e || e.ctrlKey || e.metaKey || e.altKey) return null
  return CODE_AXIS[e.code] ?? ({ 1: 'x', 2: 'y', 3: 'z', x: 'x', y: 'y', z: 'z', X: 'x', Y: 'y', Z: 'z' })[e.key] ?? null
}

export function isTypingTarget (el) {
  if (!el) return false
  const tag = String(el.tagName || '').toUpperCase()
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || !!el.isContentEditable
}

/**
 * Why a node cannot be moved (a short sentence for the panel), or '' when it can.
 * facts = { selected, inRegistry, tracking, locked, structural, inScene }
 */
export function moveBlockReason (f = {}) {
  if (!f.selected) return 'Select a node first, then press ` to move it along one axis.'
  if (f.tracking) return 'A tracking node follows its own orbit, so it cannot be moved here.'
  if (!f.inRegistry) return 'This object is not an OmniNode, so it cannot be moved here.'
  if (f.locked) return 'A behaviour has locked this node, so it cannot be moved.'
  if (f.structural) return 'This is a structural node placed by its own system, so it stays where it is.'
  if (!f.inScene) return 'This node is not in the scene right now.'
  return ''
}
