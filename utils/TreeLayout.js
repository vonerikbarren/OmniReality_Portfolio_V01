/**
 * utils/TreeLayout.js — the real, shared child-positioning modes
 *
 * Extracted so Jsonifier's own tree-building and the Structure panel
 * share one real implementation, not two. 'tree' is the original,
 * already-proven circular/downward formation, kept as the real
 * default; 'sphere' and 'spiral' are real, later additions.
 */

const CHILD_OFFSET = 2.4    // matches Jsonifier's own existing real spacing
const LINEAR_SPACING = 1.6  // real spacing between siblings in a straight line
const SPHERE_RADIUS = 2.2
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))   // real, even distribution across a sphere's surface
const SPIRAL_ANGLE_STEP = 0.9
const SPIRAL_RADIUS_GROWTH = 0.35
const SPIRAL_HEIGHT_STEP = 0.55

export const LAYOUT_MODES = ['tree', 'linear-vertical', 'linear-horizontal', 'linear-depth', 'sphere', 'spiral']

/** Real position for one child, given its own index among its real
 *  siblings, its parent's real position, and the chosen mode. */
export function computeChildPosition (parentPosition, index, totalChildren, mode) {
  switch (mode) {
    case 'linear-vertical':
      return {
        x: parentPosition.x,
        y: parentPosition.y - (index + 1) * LINEAR_SPACING,
        z: parentPosition.z,
      }
    case 'linear-horizontal': {
      const offset = (index - (totalChildren - 1) / 2) * LINEAR_SPACING
      return { x: parentPosition.x + offset, y: parentPosition.y - 1.2, z: parentPosition.z }
    }
    case 'linear-depth': {
      const offset = (index - (totalChildren - 1) / 2) * LINEAR_SPACING
      return { x: parentPosition.x, y: parentPosition.y - 1.2, z: parentPosition.z + offset }
    }
    case 'sphere': {
      // A single child has no real surface to distribute across —
      // just place it directly below, matching every other mode's
      // own real single-child behavior.
      if (totalChildren <= 1) return { x: parentPosition.x, y: parentPosition.y - SPHERE_RADIUS, z: parentPosition.z }
      const yFrac = 1 - (index / (totalChildren - 1)) * 2   // from 1 to -1, real top-to-bottom coverage
      const radiusAtY = Math.sqrt(Math.max(0, 1 - yFrac * yFrac))
      const theta = GOLDEN_ANGLE * index
      return {
        x: parentPosition.x + Math.cos(theta) * radiusAtY * SPHERE_RADIUS,
        y: parentPosition.y - 1.2 + yFrac * SPHERE_RADIUS,
        z: parentPosition.z + Math.sin(theta) * radiusAtY * SPHERE_RADIUS,
      }
    }
    case 'spiral': {
      const angle = index * SPIRAL_ANGLE_STEP
      const radius = 1.0 + index * SPIRAL_RADIUS_GROWTH
      return {
        x: parentPosition.x + Math.cos(angle) * radius,
        y: parentPosition.y - 1.2 - index * SPIRAL_HEIGHT_STEP,
        z: parentPosition.z + Math.sin(angle) * radius,
      }
    }
    case 'tree':
    default: {
      const angle = (index / Math.max(1, totalChildren)) * Math.PI * 2
      return {
        x: parentPosition.x + Math.cos(angle) * CHILD_OFFSET,
        y: parentPosition.y - 1.2,
        z: parentPosition.z + Math.sin(angle) * CHILD_OFFSET,
      }
    }
  }
}
