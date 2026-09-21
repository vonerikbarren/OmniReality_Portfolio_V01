/**
 * utils/TreeLayout.js — the real, shared child-positioning modes
 *
 * Extracted so Jsonifier's own tree-building and the Structure panel
 * share one real implementation, not two. 'tree' is the original,
 * already-proven circular/downward formation, kept as the real
 * default; 'sphere' and 'spiral' are real, later additions.
 *
 * Every mode's own spacing now reads live from
 * utils/StructureSpacingSettings.js instead of a fixed constant —
 * confirmed directly as wanted: real, editable, equidistant control
 * over how far apart nodes sit. Each mode's own ratio to the
 * original hardcoded LINEAR_SPACING is preserved, so the visual
 * relationship between modes stays consistent as the real setting
 * changes, not just one mode scaling while the others stay fixed.
 */

import { getSpacing } from './StructureSpacingSettings.js'

export const LAYOUT_MODES = ['tree', 'linear-vertical', 'linear-horizontal', 'linear-depth', 'sphere', 'spiral', 'omnisystem-ring']

/** Real position for one child, given its own index among its real
 *  siblings, its parent's real position, and the chosen mode. */
export function computeChildPosition (parentPosition, index, totalChildren, mode) {
  const spacing = getSpacing()
  const childOffset = spacing * 1.5           // tree's own ratio to the original 1.6 base (2.4 / 1.6)
  const sphereRadius = spacing * 1.375        // sphere's own ratio (2.2 / 1.6)
  const spiralBaseRadius = spacing * 0.625    // spiral's own starting-radius ratio (1.0 / 1.6)
  const spiralRadiusGrowth = spacing * 0.21875 // spiral's own per-step growth ratio (0.35 / 1.6)
  const spiralHeightStep = spacing * 0.34375  // spiral's own per-step descent ratio (0.55 / 1.6)
  const golden = Math.PI * (3 - Math.sqrt(5))  // real, even distribution across a sphere's surface — not spacing-dependent

  switch (mode) {
    case 'linear-vertical':
      return {
        x: parentPosition.x,
        y: parentPosition.y - (index + 1) * spacing,
        z: parentPosition.z,
      }
    case 'linear-horizontal': {
      const offset = (index - (totalChildren - 1) / 2) * spacing
      return { x: parentPosition.x + offset, y: parentPosition.y - 1.2, z: parentPosition.z }
    }
    case 'linear-depth': {
      const offset = (index - (totalChildren - 1) / 2) * spacing
      return { x: parentPosition.x, y: parentPosition.y - 1.2, z: parentPosition.z + offset }
    }
    case 'sphere': {
      // A single child has no real surface to distribute across —
      // just place it directly below, matching every other mode's
      // own real single-child behavior.
      if (totalChildren <= 1) return { x: parentPosition.x, y: parentPosition.y - sphereRadius, z: parentPosition.z }
      const yFrac = 1 - (index / (totalChildren - 1)) * 2   // from 1 to -1, real top-to-bottom coverage
      const radiusAtY = Math.sqrt(Math.max(0, 1 - yFrac * yFrac))
      const theta = golden * index
      return {
        x: parentPosition.x + Math.cos(theta) * radiusAtY * sphereRadius,
        y: parentPosition.y - 1.2 + yFrac * sphereRadius,
        z: parentPosition.z + Math.sin(theta) * radiusAtY * sphereRadius,
      }
    }
    case 'spiral': {
      const angle = index * 0.9   // real angular step — not a spacing/distance value, kept fixed
      const radius = spiralBaseRadius + index * spiralRadiusGrowth
      return {
        x: parentPosition.x + Math.cos(angle) * radius,
        y: parentPosition.y - 1.2 - index * spiralHeightStep,
        z: parentPosition.z + Math.sin(angle) * radius,
      }
    }
    case 'omnisystem-ring': {
      // OmniSystem's own real, proven Ring formula, reused directly
      // — clockwise from 12 o'clock, verified there against worked
      // examples (N=2,3,4,6), generalizes identically to any N. Kept
      // its own real characteristic: a flat ring at the parent's own
      // Y, not offset downward like the other modes here.
      const angleDeg = index * (360 / totalChildren)
      const rad = angleDeg * Math.PI / 180
      const d = childOffset
      return {
        x: parentPosition.x + d * Math.sin(rad),
        y: parentPosition.y,
        z: parentPosition.z - d * Math.cos(rad),
      }
    }
    case 'tree':
    default: {
      const angle = (index / Math.max(1, totalChildren)) * Math.PI * 2
      return {
        x: parentPosition.x + Math.cos(angle) * childOffset,
        y: parentPosition.y - 1.2,
        z: parentPosition.z + Math.sin(angle) * childOffset,
      }
    }
  }
}
