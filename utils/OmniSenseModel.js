/**
 * utils/OmniSenseModel.js (V290) — OmniSense, basic layout: the voxel rooms are the containers on a 3D plane, each room carries an OmniVon, and the plane can be seen
 * from the top, from an isometric corner, or from a wide orbit (the user can always orbit from there). Pure: no DOM, no three.js. Draws: systems/OmniSense.js.
 *
 *   A room's OmniVon = derived terms + the terms the user wrote.
 *     derived  ▦ Space = "Room" (every room is a place), ◉ Identity = the room's name when it has one. Honest and small: nothing else is invented.
 *     user     any terms (open vocabulary, utils/OmniVonModel.js); a user term of the same symbol replaces the derived one.
 *   The place of the OmniVon is the room's x, y, z; the level is the user's (default 0 = the neutral scale).
 *   Text form: ⟐ L0 @(2,0,5) ▦:Room ◉:Kitchen ⧖:"Real time"
 */
import { sanitizeOmniVon, printOmniVon, parseOmniVon, cleanSymbol } from './OmniVonModel.js'

export const VIEWS = ['top', 'iso', 'orbit']
export const VIEW_NAMES = { top: 'Top down', iso: 'Isometric', orbit: 'Wide orbit' }
export const LIMITS = { userTerms: 32, rooms: 4096 }
const own = (o, k) => o && typeof o === 'object' && Object.prototype.hasOwnProperty.call(o, k) ? o[k] : undefined

/** the terms every room has by being a room */
export function derivedTerms (cell) {
  const c = cell && typeof cell === 'object' ? cell : {}; const out = [{ symbol: '▦', value: 'Room' }]
  const label = typeof c.label === 'string' ? c.label.replace(/[\u0000-\u001f"]/g, '').trim() : ''
  if (label) out.push({ symbol: '◉', value: label })
  return out
}
/** { terms, level } the user wrote for one room; never throws */
export function sanitizeUserVon (raw) {
  const v = sanitizeOmniVon({ terms: own(raw, 'terms'), level: own(raw, 'level') })
  return { terms: v.terms.slice(0, LIMITS.userTerms), level: v.level }
}
/** the room's whole OmniVon: derived terms (unless the user wrote the same symbol) then the user's terms */
export function roomVon (cell, user = null) {
  const c = cell && typeof cell === 'object' ? cell : {}; const u = sanitizeUserVon(user)
  const mine = new Set(u.terms.map(t => t.symbol)); const terms = [...derivedTerms(c).filter(t => !mine.has(t.symbol)), ...u.terms]
  const n = (v) => (Number.isFinite(v) ? v : 0)
  return sanitizeOmniVon({ terms, level: u.level, place: [n(c.x), n(c.y), n(c.z)] })
}
export const roomText = (cell, user = null) => printOmniVon(roomVon(cell, user))
/**
 * The text the user edited -> what to store for the room: { user:{terms, level}, problems:[] }. The place always comes from the room, so an @(...) or t= in the text is ignored.
 * Terms identical to the derived ones are dropped (they are derived again), so renaming the room still shows through.
 */
export function userFromText (text, cell) {
  const p = parseOmniVon(text); const d = derivedTerms(cell); const same = (a, b) => a.symbol === b.symbol && String(a.value) === String(b.value)
  const terms = p.von.terms.filter(t => !d.some(x => same(x, t)))
  return { user: sanitizeUserVon({ terms, level: p.von.level }), problems: p.problems }
}
/** a room's terms by symbol, for lookups such as highlighting the rooms that share a term */
export const hasSymbol = (von, symbol) => sanitizeOmniVon(von).terms.some(t => t.symbol === symbol)
export const knownSymbol = (s) => !!cleanSymbol(s)

// ── the plane and the views ──
/** { min, max, center, size } of world points [[x,y,z]...]; an empty list gives a unit box at the origin */
export function boundsOf (points) {
  const list = (Array.isArray(points) ? points : []).filter(p => Array.isArray(p) && p.length >= 3 && p.slice(0, 3).every(Number.isFinite))
  if (!list.length) return { min: [0, 0, 0], max: [0, 0, 0], center: [0, 0, 0], size: [0, 0, 0] }
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity]
  for (const p of list) for (let i = 0; i < 3; i++) { if (p[i] < min[i]) min[i] = p[i]; if (p[i] > max[i]) max[i] = p[i] }
  return { min, max, center: [0, 1, 2].map(i => (min[i] + max[i]) / 2), size: [0, 1, 2].map(i => max[i] - min[i]) }
}
/**
 * Where the camera goes for a view. `bounds` = boundsOf(room centres), `cell` = the room size, `fov` = the camera's vertical field in degrees, `aspect` = width / height.
 * top   straight above the middle, looking down, with -z at the top of the screen (so x runs left to right)
 * iso   a corner at 45 degrees round, 35 degrees up
 * orbit further out and lower, so the whole plane and what stands on it shows
 * Returns { pos, target, up } (pure; the same input always gives the same pose).
 */
export function viewPose (mode, bounds, cell = 20, fov = 60, aspect = 1.6) {
  const b = bounds && bounds.center ? bounds : boundsOf([]); const m = VIEWS.includes(mode) ? mode : 'orbit'
  const half = Math.max(1e-6, Math.max(b.size[0], b.size[2]) / 2 + cell * 0.9); const fy = Math.tan((Math.max(10, Math.min(120, fov)) * Math.PI / 180) / 2); const fx = fy * Math.max(0.3, aspect)
  const need = Math.max(half / fy, half / fx) * 1.1   // far enough that the plane fits both ways
  const t = [b.center[0], b.min[1], b.center[2]]
  if (m === 'top') return { pos: [t[0], t[1] + need, t[2] + 0.001], target: t, up: [0, 0, -1] }
  const el = (m === 'iso' ? 35 : 22) * Math.PI / 180, az = Math.PI / 4, d = need * (m === 'iso' ? 1.15 : 1.9)
  return { pos: [t[0] + Math.sin(az) * Math.cos(el) * d, t[1] + Math.sin(el) * d, t[2] + Math.cos(az) * Math.cos(el) * d], target: t, up: [0, 1, 0] }
}
/** the rooms laid on the plane, as drawable tiles. rooms = [{ key, x, y, z, world:[x,y,z], label }] */
export function tiles (rooms, cell = 20, users = {}) {
  return (Array.isArray(rooms) ? rooms : []).slice(0, LIMITS.rooms).filter(r => r && Array.isArray(r.world) && r.world.every(Number.isFinite)).map(r => {
    const von = roomVon(r, own(users, r.key)); return { key: r.key, world: r.world, size: Math.round(cell * 0.94 * 100) / 100, terms: von.terms.length, text: printOmniVon(von), label: r.label || '' }
  })
}
