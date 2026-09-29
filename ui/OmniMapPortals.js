/**
 * ui/OmniMapPortals.js — shared landing-area portal markers
 *
 * Previously only known to ui/MiniMap.js as a private, local
 * buildDefaultPortals(). Pulled out so ui/OmniStartHUD.js's Q4 "real
 * map" can draw the exact same markers — one real source of truth
 * instead of two copies that could quietly drift apart.
 */

const PORTAL_RING_R = 14
const PORTAL_COUNT = 5

export function getDefaultPortals () {
  const defs = [
    { id: 'portfolio', label: '⟐Portfolio', color: '#aaddff' },
    { id: 'about',     label: '⟐About',     color: '#ffffff' },
    { id: 'work',      label: '⟐Work',      color: '#ffd0ff' },
    { id: 'omninode',  label: '⟐N',         color: '#ffffff' },
    { id: 'undefined', label: '⟐Undefined', color: '#888888' },
  ]
  return defs.map((def, i) => {
    const angle = (i / PORTAL_COUNT) * Math.PI * 2
    return {
      id   : def.id,
      label: def.label,
      color: def.color,
      x    : Math.cos(angle) * PORTAL_RING_R,
      z    : Math.sin(angle) * PORTAL_RING_R,
    }
  })
}
