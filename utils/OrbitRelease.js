/**
 * utils/OrbitRelease.js — pure logic for "click empty space to release the orbit target" (V190)
 *
 * No DOM / Three.js: plain numbers and arrays, so it is unit-testable without a browser.
 *
 *   classifyPointerGesture({dx, dy, dt, button, maxMove, maxMs})
 *        'click'  — primary button, moved <= maxMove px and released within maxMs   -> may release the orbit
 *        'drag'   — moved more than maxMove px (an orbit-rotate / pan drag)          -> must NOT release
 *        'hold'   — barely moved but held longer than maxMs (a long press)           -> must NOT release
 *        'other'  — any non-primary button (right-drag pans, middle dollies)         -> must NOT release
 *   rayNearPoint(origin, dir, point, radius)  — is `point` within `radius` of the ray? (clicking ON the orbit target)
 *   sanitizeOrbitReleaseSettings / load / save — the one persisted setting { enabled } (default ON)
 */

export const CLICK_MAX_MOVE_PX = 6
export const CLICK_MAX_MS = 400
export const ORBIT_RELEASE_KEY = 'omni:orbit-release-v1'

export function classifyPointerGesture ({ dx = 0, dy = 0, dt = 0, button = 0, maxMove = CLICK_MAX_MOVE_PX, maxMs = CLICK_MAX_MS } = {}) {
  if (button !== 0) return 'other'
  const dist = Math.hypot(Number(dx) || 0, Number(dy) || 0)
  if (dist > maxMove) return 'drag'
  if ((Number(dt) || 0) > maxMs) return 'hold'
  return 'click'
}

/** origin/dir/point are [x,y,z]; dir need not be normalised. A point BEHIND the origin is never "near". */
export function rayNearPoint (origin, dir, point, radius) {
  const dl = Math.hypot(dir[0], dir[1], dir[2])
  if (!(dl > 0)) return false
  const d = [dir[0] / dl, dir[1] / dl, dir[2] / dl]
  const v = [point[0] - origin[0], point[1] - origin[1], point[2] - origin[2]]
  const t = v[0] * d[0] + v[1] * d[1] + v[2] * d[2]
  if (t < 0) return false
  const cx = v[0] - d[0] * t, cy = v[1] - d[1] * t, cz = v[2] - d[2] * t
  return Math.hypot(cx, cy, cz) <= radius
}

export function sanitizeOrbitReleaseSettings (raw) {
  return { enabled: !(raw && typeof raw === 'object' && raw.enabled === false) }   // anything but an explicit false is ON
}

export function loadOrbitReleaseSettings () {
  try { return sanitizeOrbitReleaseSettings(JSON.parse(localStorage.getItem(ORBIT_RELEASE_KEY) ?? 'null')) } catch (_) { return { enabled: true } }
}

export function saveOrbitReleaseSettings (s) {
  const clean = sanitizeOrbitReleaseSettings(s)
  try { localStorage.setItem(ORBIT_RELEASE_KEY, JSON.stringify(clean)) } catch (_) {}
  return clean
}
