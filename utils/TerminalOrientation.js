/**
 * utils/TerminalOrientation.js — V192: the rotation orientation of an in-scene terminal (TerminalShellTunnel), pure helpers.
 *
 * orientation = { preset, yaw, pitch, roll, billboard }
 *   billboard  true: the panel faces the camera every frame (the behaviour before V192); `roll` still turns it around the line of sight,
 *              yaw / pitch are ignored.
 *   billboard  false: the panel is fixed in the world with Euler angles in DEGREES, order YXZ (yaw about Y, then pitch about X, then roll about Z).
 *   preset     'front' | 'left' | 'right' | 'top' | 'floor' | 'custom'. Choosing a preset sets billboard OFF and the three angles;
 *              editing an angle by hand makes the preset 'custom'.
 *
 * The plane's normal is +Z at zero rotation, so Front faces +Z (towards a camera standing south of it), Left faces -X, Right faces +X,
 * Top faces DOWN (a ceiling panel you read looking up) and Flat on floor faces UP (it lies on the floor, read from above).
 */

export const ORIENTATION_PRESETS = Object.freeze({
  front: { yaw: 0, pitch: 0, roll: 0, label: 'Front' },
  left: { yaw: -90, pitch: 0, roll: 0, label: 'Left' },
  right: { yaw: 90, pitch: 0, roll: 0, label: 'Right' },
  top: { yaw: 0, pitch: 90, roll: 0, label: 'Top' },
  floor: { yaw: 0, pitch: -90, roll: 0, label: 'Flat on floor' },
})
export const PRESET_IDS = Object.keys(ORIENTATION_PRESETS)
export const ANGLE_MIN = -180
export const ANGLE_MAX = 180
/** Height of a 'Flat on floor' panel above the floor plane (world units). */
export const FLOOR_PANEL_Y = 0.06

export const DEFAULT_ORIENTATION = Object.freeze({ preset: 'front', yaw: 0, pitch: 0, roll: 0, billboard: true })

const isNum = (v) => typeof v === 'number' && Number.isFinite(v)
const clampAngle = (v) => Math.min(ANGLE_MAX, Math.max(ANGLE_MIN, Math.round(v * 10) / 10))

/** Clean orientation from anything. Bad fields fall back to `base` (itself defaulted), so the result is always valid. `rejected` lists the bad keys. */
export function sanitizeOrientation (raw, base = DEFAULT_ORIENTATION) {
  const b = base && typeof base === 'object' ? base : DEFAULT_ORIENTATION
  const r = raw && typeof raw === 'object' ? raw : {}
  const rejected = []
  const out = { preset: PRESET_IDS.includes(b.preset) || b.preset === 'custom' ? b.preset : 'front', yaw: isNum(b.yaw) ? clampAngle(b.yaw) : 0, pitch: isNum(b.pitch) ? clampAngle(b.pitch) : 0, roll: isNum(b.roll) ? clampAngle(b.roll) : 0, billboard: b.billboard !== false }
  for (const k of ['yaw', 'pitch', 'roll']) {
    if (!(k in r)) continue
    const v = typeof r[k] === 'string' && r[k].trim() !== '' ? Number(r[k]) : r[k]
    if (isNum(v)) out[k] = clampAngle(v); else rejected.push(k)
  }
  if ('billboard' in r) { if (typeof r.billboard === 'boolean') out.billboard = r.billboard; else rejected.push('billboard') }
  if ('preset' in r) {
    if (r.preset === 'custom') out.preset = 'custom'
    else if (PRESET_IDS.includes(r.preset)) {
      const p = ORIENTATION_PRESETS[r.preset]
      out.preset = r.preset; out.yaw = p.yaw; out.pitch = p.pitch; out.roll = p.roll
      if (!('billboard' in r)) out.billboard = false
    } else rejected.push('preset')
  } else if (['yaw', 'pitch', 'roll'].some(k => k in r && !rejected.includes(k))) {
    // an angle was edited by hand: it is a custom orientation unless it still equals the preset
    const hit = PRESET_IDS.find(id => { const p = ORIENTATION_PRESETS[id]; return p.yaw === out.yaw && p.pitch === out.pitch && p.roll === out.roll })
    out.preset = hit ?? 'custom'
  }
  return { orientation: out, rejected }
}

export const orientationOf = (raw, base) => sanitizeOrientation(raw, base).orientation

/** Euler angles in radians (order YXZ) for a fixed (non-billboard) panel. */
export function panelEuler (o) {
  const d = Math.PI / 180
  const c = orientationOf(o)
  return { x: c.pitch * d, y: c.yaw * d, z: c.roll * d, order: 'YXZ' }
}

/** Roll (radians) applied around the line of sight in billboard mode. */
export const billboardRoll = (o) => orientationOf(o).roll * Math.PI / 180

/** Panel height override: a Flat-on-floor panel lies just above the floor; anything else returns null (the caller keeps its own height). */
export function panelYOverride (o) {
  const c = orientationOf(o)
  return !c.billboard && c.preset === 'floor' ? FLOOR_PANEL_Y : null
}

export const describeOrientation = (o) => {
  const c = orientationOf(o)
  return c.billboard ? `faces the camera${c.roll ? `, rolled ${c.roll}°` : ''}` : `${c.preset === 'custom' ? 'custom' : ORIENTATION_PRESETS[c.preset].label}: yaw ${c.yaw}°, pitch ${c.pitch}°, roll ${c.roll}°`
}
