/**
 * utils/TreeLayout.js — the real, shared child-positioning modes
 *
 * Extracted so Jsonifier's own tree-building and the new Structure
 * panel share one real implementation, not two. 'tree' is the
 * original, already-proven circular/downward formation, kept as the
 * real default; the three new modes are genuine alternatives, not
 * replacements — confirmed directly as real, wanted options
 * alongside it.
 */

const CHILD_OFFSET = 2.4    // matches Jsonifier's own existing real spacing
const LINEAR_SPACING = 1.6  // real spacing between siblings in a straight line

export const LAYOUT_MODES = ['tree', 'linear-vertical', 'linear-horizontal', 'linear-depth']

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
