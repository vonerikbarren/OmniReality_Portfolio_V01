/**
 * utils/OmniThemes.js — ⟐mniThemes
 *
 * Real, per-dataset visual themes for a Jsonifier tree, chosen
 * before the JSON is submitted, per direct request ("an option
 * before the user generates the json data"). Core mechanic: the
 * root's own color is the theme's real starting point, and every
 * child gradually shifts along a real, three-point spectrum
 * (black ↔ grey ↔ white) as depth increases — "so it can be seen
 * from a distance what type of data it is," per direct request.
 *
 * Stated, direct assumption on the one genuinely ambiguous case —
 * the grey theme, which starts already at the spectrum's middle and
 * so has no single "toward the middle" direction the way black and
 * white do: children alternate outward by depth parity (even depth
 * drifts toward white, odd depth drifts toward black), giving a
 * real, visually distinct pattern rather than a fixed, arbitrary
 * pick. Easy to change if this isn't the intended read.
 */

import * as THREE from 'three'

const BLACK = new THREE.Color(0x000000)
const GREY = new THREE.Color(0x808080)
const WHITE = new THREE.Color(0xffffff)

export const OMNI_THEMES = {
  black: {
    label: 'Black & Metallic',
    metalness: 0.85, roughness: 0.25,
    emissive: 0x000000, emissiveIntensity: 0,
  },
  white: {
    label: 'White, Glowy & Metallic',
    metalness: 0.7, roughness: 0.2,
    emissive: 0xffffff, emissiveIntensity: 0.4,   // the real "glowy" part
  },
  grey: {
    label: 'Grey & Metallic',
    metalness: 0.85, roughness: 0.3,
    emissive: 0x000000, emissiveIntensity: 0,
  },
}

const MAX_GRADIENT_DEPTH = 6   // depth at which the gradient has fully reached its real target color

/** Real, per-depth color for a given theme — the root (depth 0)
 *  starts at the theme's own real base color, and gradually shifts
 *  toward its real target as depth increases, clamped so it never
 *  overshoots past MAX_GRADIENT_DEPTH. */
export function getThemeColor (themeId, depth) {
  const t = Math.min(depth, MAX_GRADIENT_DEPTH) / MAX_GRADIENT_DEPTH
  const color = new THREE.Color()

  if (themeId === 'black') {
    color.copy(BLACK).lerp(GREY, t)
  } else if (themeId === 'white') {
    color.copy(WHITE).lerp(GREY, t)
  } else if (themeId === 'grey') {
    const target = depth % 2 === 0 ? WHITE : BLACK
    color.copy(GREY).lerp(target, t)
  } else {
    return '#ffffff'   // unknown theme id — honest, neutral fallback, not a silent guess
  }

  return `#${color.getHexString()}`
}

/** Real, full per-node appearance for a given theme + depth —
 *  color plus the theme's own real material properties (metalness,
 *  roughness, emissive/glow). */
export function getThemeAppearance (themeId, depth) {
  const theme = OMNI_THEMES[themeId] ?? OMNI_THEMES.grey
  return {
    color: getThemeColor(themeId, depth),
    metalness: theme.metalness,
    roughness: theme.roughness,
    emissive: theme.emissive,
    emissiveIntensity: theme.emissiveIntensity,
  }
}
