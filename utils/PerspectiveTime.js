/**
 * utils/PerspectiveTime.js — perspectiveTime(object, TimeData) and
 * the real X-axis space-switching mechanism
 *
 * "The user can switch spaces [on the X-axis] ... or have the
 * option to create a perspectiveTime(object, TimeData)." Confirmed
 * directly: the X-axis is literally which perspective a node is
 * currently being viewed from — this is the concrete mechanism,
 * built on top of the same day-cycle Y-mapping ChronosRealityNode
 * already uses, so a given TimeData maps to the same real tunnel
 * height regardless of which perspective is looking at it.
 *
 * Connects directly to OmniBook(Time)'s own "several perspectives on
 * the same event, converging" idea — each perspective is a real,
 * distinct X-offset lane, not a separate copy of the whole system.
 */

import * as THREE from 'three'

const FLOOR_Y = -102
const TUNNEL_HEIGHT = 260
const DAY_SECONDS = 86400
const PERSPECTIVE_SLOT_SPACING = 30   // real X-distance between adjacent perspective lanes

const perspectiveSlots = new Map()   // name -> xOffset
let activePerspective = null

/** Assigns (or returns, if it already exists) a real, stable X-slot
 *  for a named perspective — first-come, first-slot, never
 *  reassigned once given. */
export function registerPerspective (name) {
  if (perspectiveSlots.has(name)) return perspectiveSlots.get(name)
  const xOffset = perspectiveSlots.size * PERSPECTIVE_SLOT_SPACING
  perspectiveSlots.set(name, xOffset)
  if (activePerspective === null) activePerspective = name
  return xOffset
}

export function switchPerspective (name) {
  if (!perspectiveSlots.has(name)) registerPerspective(name)
  activePerspective = name
}

export function getActivePerspective () { return activePerspective }
export function getPerspectiveOffset (name) { return perspectiveSlots.get(name) ?? 0 }

/** The real function itself — where a given object would appear,
 *  viewed from a specific perspective, at a specific TimeData's own
 *  manipulated time. Y comes from the same day-cycle mapping the
 *  traveling reality-node uses, so a perspective's own view lines up
 *  with the real tunnel height, not a separate scale. */
export function perspectiveTime (object, timeData, perspectiveName = activePerspective) {
  const xOffset = getPerspectiveOffset(perspectiveName)
  const cyclePosition = (timeData.manipulatedSeconds % DAY_SECONDS) / DAY_SECONDS
  const y = FLOOR_Y + cyclePosition * TUNNEL_HEIGHT
  const baseZ = object?.position?.z ?? 0
  return new THREE.Vector3(xOffset, y, baseZ)
}
