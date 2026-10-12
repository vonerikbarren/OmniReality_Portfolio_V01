/**
 * utils/OmniSphereGrid.js — the pure math behind the userCompass globe (V188). No DOM, no canvas, no three.js.
 *
 * A "clear" spherical wireframe: latitude + longitude lines on a unit sphere, rotated, then projected
 * ORTHOGRAPHICALLY to 2D so a plain <canvas> can stroke it (the compass must add ZERO WebGL contexts).
 *
 *   buildSphereGrid({ meridians, parallels, segments })
 *       -> { lines: [{ kind, pts: [[x,y,z], ...], closed }], segments }
 *      kind 'meridian'  a full great circle through both poles (6 of them = a line every 30 degrees of longitude)
 *           'prime'     the meridian at longitude 0 (a meridian too; drawn brighter in heading mode so it reads as "north")
 *           'parallel'  a circle of latitude (evenly spaced, NOT counting the equator)
 *           'equator'   latitude 0 (slightly brighter)
 *      Default 6 meridians x 5 parallels (4 parallels + the equator) = 6 + 4 + 1 closed circles.
 *
 *   projectSphere(grid, { yaw, tilt, pitch, radius, cx, cy })
 *       -> [{ x1, y1, x2, y2, depth, kind }]   one entry per short segment, depth 0 (back) .. 1 (front)
 *      Order of rotations: spin about the sphere's own vertical axis by `yaw`, then lean the axis by `tilt`
 *      (a roll, default 23 degrees, the fixed "axial tilt" that makes it read as a globe), then tip the top
 *      toward the viewer by `pitch` (default 18 degrees) so the parallels show as ellipses.
 *      Screen: +x right, +y DOWN (canvas), z toward the viewer.
 *
 *   headingFromQuaternion(q) / headingToYaw(h): camera -> sphere yaw for the 'heading' mode.
 *   bucketSegments(segs, levels): groups segments by depth into a few alpha levels so a canvas needs only a handful of stroke() calls.
 */

export const DEG = Math.PI / 180
export const DEFAULT_TILT = 23 * DEG
export const DEFAULT_PITCH = 18 * DEG
export const DEFAULT_MERIDIANS = 6
export const DEFAULT_PARALLELS = 5
export const DEFAULT_SEGMENTS = 28

const clampInt = (v, lo, hi, d) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d }

export function buildSphereGrid ({ meridians = DEFAULT_MERIDIANS, parallels = DEFAULT_PARALLELS, segments = DEFAULT_SEGMENTS } = {}) {
  const M = clampInt(meridians, 1, 24, DEFAULT_MERIDIANS)
  const P = clampInt(parallels, 1, 15, DEFAULT_PARALLELS)
  const N = clampInt(segments, 8, 96, DEFAULT_SEGMENTS)
  const lines = []
  // meridians: great circles through the poles, one every (180 / M) degrees of longitude
  for (let m = 0; m < M; m++) {
    const lon = (m * Math.PI) / M
    const pts = []
    for (let i = 0; i < N; i++) {
      const a = (i / N) * 2 * Math.PI                      // angle round the great circle
      // the circle lies in the plane through the y axis at longitude `lon`
      pts.push([Math.cos(a) * Math.sin(lon), Math.sin(a), Math.cos(a) * Math.cos(lon)])
    }
    lines.push({ kind: m === 0 ? 'prime' : 'meridian', pts, closed: true })
  }
  // parallels: P evenly spaced latitudes strictly between the poles (P odd -> one is the equator)
  for (let p = 0; p < P; p++) {
    const lat = -Math.PI / 2 + ((p + 1) * Math.PI) / (P + 1)
    const y = Math.sin(lat), r = Math.cos(lat)
    const pts = []
    for (let i = 0; i < N; i++) { const a = (i / N) * 2 * Math.PI; pts.push([r * Math.sin(a), y, r * Math.cos(a)]) }
    lines.push({ kind: Math.abs(lat) < 1e-9 ? 'equator' : 'parallel', pts, closed: true })
  }
  return { lines, segments: N, meridians: M, parallels: P }
}

/** Rotate a point: yaw about Y, then roll (tilt) about Z, then pitch about X. */
function rot (p, cy, sy, ct, st, cp, sp) {
  let x = p[0] * cy + p[2] * sy
  let y = p[1]
  let z = -p[0] * sy + p[2] * cy
  const x2 = x * ct - y * st                // roll about Z (lean the axis)
  const y2 = x * st + y * ct
  x = x2; y = y2
  const y3 = y * cp - z * sp                // pitch about X (top toward the viewer)
  const z3 = y * sp + z * cp
  return [x, y3, z3]
}

export function projectSphere (grid, { yaw = 0, tilt = DEFAULT_TILT, pitch = DEFAULT_PITCH, radius = 20, cx = 0, cy = 0 } = {}) {
  const cY = Math.cos(yaw), sY = Math.sin(yaw), cT = Math.cos(tilt), sT = Math.sin(tilt), cP = Math.cos(pitch), sP = Math.sin(pitch)
  const out = []
  for (const line of grid.lines) {
    const n = line.pts.length
    const P = line.pts.map(p => rot(p, cY, sY, cT, sT, cP, sP))
    const last = line.closed ? n : n - 1
    for (let i = 0; i < last; i++) {
      const a = P[i], b = P[(i + 1) % n]
      const z = (a[2] + b[2]) / 2                           // -1 (back) .. 1 (front)
      out.push({
        x1: cx + a[0] * radius, y1: cy - a[1] * radius,
        x2: cx + b[0] * radius, y2: cy - b[1] * radius,
        depth: Math.min(1, Math.max(0, (z + 1) / 2)),
        kind: line.kind,
      })
    }
  }
  return out
}

/**
 * Camera quaternion {x,y,z,w} -> heading in radians (0 = looking down -Z, + = turning toward +X). Pure, no three.js.
 * Looking (almost) straight down or up the forward vector has no horizontal part, so the heading then comes from the camera's
 * UP vector instead (down: the way the top of the screen points on the ground, like a map; up: the opposite). With no roll
 * both rules agree at the switch (|forward.y| > 0.995), so the value does not jump.
 */
export function headingFromQuaternion (q) {
  if (!q) return 0
  const { x = 0, y = 0, z = 0, w = 1 } = q
  const fx = -2 * (x * z + w * y), fy = -2 * (y * z - w * x), fz = -(1 - 2 * (x * x + y * y))   // forward = q * (0,0,-1)
  if (![fx, fy, fz].every(Number.isFinite)) return 0
  if (Math.hypot(fx, fz) >= 0.1) return Math.atan2(fx, -fz)
  const ux = 2 * (x * y - w * z), uz = 2 * (y * z + w * x)                                      // up = q * (0,1,0)
  if (Math.hypot(ux, uz) < 1e-6) return 0
  return fy < 0 ? Math.atan2(ux, -uz) : Math.atan2(-ux, uz)
}

/** Turn right (heading grows) -> the globe's front moves LEFT, like a compass card under a heading marker. */
export const headingToYaw = (h) => -h

/** Group segments into `levels` depth buckets (0 = backmost). Equator segments get their own list (drawn last, brighter). */
export function bucketSegments (segs, levels = 4) {
  const L = Math.max(1, Math.floor(levels))
  const buckets = Array.from({ length: L }, () => [])
  const equator = [], prime = []
  for (const s of segs) {
    const i = Math.min(L - 1, Math.floor(s.depth * L))
    if (s.kind === 'equator') equator.push({ s, i })
    else if (s.kind === 'prime') prime.push({ s, i })
    else buckets[i].push(s)
  }
  return { buckets, equator, prime, levels: L }
}
