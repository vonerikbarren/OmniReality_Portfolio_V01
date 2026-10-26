/**
 * data/OmniAxinatorData.js — editable content for the built-in ("main")
 * OmniAxinator (systems/OmniAxinator.js, instantiated by
 * systems/OmniDimensionalAxes.js)
 *
 * DATA, not logic. Each tunnel def is plain JSON-ish data (no THREE objects):
 *
 *   id          unique id (also the key in localStorage 'omni:axinator-v1')
 *   group       panel grouping: 'hand' | 'axes' (V166: the 'clock' group is gone)
 *   title       human title (panel + tooltips)
 *   symbol      one glyph shown in the panel and the menu
 *   color       accent colour (marker / ticks / label border, panel swatch)
 *   tunnelColor optional colour of the tunnel body + grid (default: the grey
 *               TUNNEL_COLOR in OmniAxinator.js). V166 hand tunnels: Conscious violet,
 *               OmniHand white, LogicalHand green.
 *   tunnelColors array of hex colours: the grid cycles through them with per-vertex
 *               colours (longitudes by index, rings along the length). V166 CreativeHand:
 *               RGB_COLORS = RED, GREEN, BLUE; the body takes the neutral `tunnelColor` tint.
 *   swatch      optional CSS background for the panel swatch (a gradient for the RGB tunnel)
 *   contrastLines true = add a faint near-black under-pass of the grid so a LIGHT tunnel
 *               still shows on a white wallpaper (V166: OmniHand white, CreativeHand's
 *               light (green) segments only)
 *   opacityScale / nodeOpacityScale  multipliers on the V160 base opacities of the tunnel
 *               body+grid / of the node shells (fill + both outlines). V166 hand tunnels:
 *               HAND_TUNNEL_OPACITY_SCALE 0.7 and HAND_NODE_OPACITY_SCALE 0.63.
 *   direction   { clock: hour }  top-down clock, 12 = -Z, 3 = +X, may be fractional
 *               { axis: 'x'|'y'|'z' }
 *   twoSided    false: starts at the origin and runs out along `direction`
 *               true : passes THROUGH the origin (cylinder + grid -len..+len)
 *   originRoot  V166: with twoSided, node 0 is the ROOT at 0,0,0 and node i sits at
 *               i x NODE_SPACING on the `direction` side (the four hand tunnels).
 *               Without it, two-sided nodes are centred on the origin (X / Y / Z).
 *   rootRadius  shell radius of the origin root (distinct per tunnel so the four
 *               concentric roots nest instead of z-fighting)
 *   maxLevels   hard cap on the relative (Υ) levels (OmniHand 8, Conscious 10)
 *   nodes       [{ id, name, view? }]  ordered along the tunnel (two-sided: the
 *               middle of the array sits at the origin)
 *   levels      optional relative (Υ) axis [{ id, name, view? }] -> makes the
 *               tunnel "steppable" (marker + relative column, pad stepping)
 *   rootIndex   which node is the tunnel's ROOT
 *   rootText    the root tooltip text shown in the node menu
 *   showRootMark  draw the crown ring + "ROOT" label line on the root node
 *   padHand     the hand whose pad shows/hides this tunnel automatically
 *               ('omnihand' | 'conscious' | 'lh' | 'rh'); omit for tunnels that are manual only
 *
 * HONEST STATUS: X/Y/Z and the LogicalHand / CreativeHand tunnels carry PLACEHOLDER
 * nodes (TODO below). Their geometry, picking, menu and panel toggles are real;
 * the content they will hold is not designed yet.
 */

import {
  CONSCIOUS_SYMBOL, OMNIHAND_SYMBOL, LOGICAL_SYMBOL, CREATIVE_SYMBOL, CLOCK,
  CONSCIOUS_PERSPECTIVES, CONSCIOUS_SCALE_DEGREES, CONSCIOUS_MAX_SCALES,
  OMNIHAND_PRODUCTS, OMNIHAND_TIERS, OMNIHAND_MAX_TIERS,
} from './OmniDimensionalAxesData.js'

// ── V166 style numbers (see BuildLog V166) ──────────────────────────────────
// The user's clarified request: the hand tunnels should "barely be seen but be known to be
// there", nodes 10% more transparent than the tunnel itself. Both are multipliers on the
// V160 base opacities in systems/OmniAxinator.js (body 0.10, grid 0.62; node fill 0.08,
// edge 0.65, dark outline 0.5) -> tunnel body 0.07 / grid 0.434, node 0.0504 / 0.4095 / 0.315.
// V175: the tunnels should read more clearly (less transparent) while the icosahedron nodes inside
// them become much fainter ("barely see them, but still visibly there"). The two are now set
// independently (V166 tied the node scale to the tunnel scale).
//   tunnel 1.2  -> body 0.12 / grid 0.744 (V166 was 0.7 -> 0.07 / 0.434)
//   node   0.3  -> fill 0.024 / edge 0.195 / dark outline 0.15 (V166 was 0.63 -> 0.0504 / 0.4095 / 0.315)
export const HAND_TUNNEL_OPACITY_SCALE = 1.2
export const HAND_NODE_OPACITY_SCALE   = 0.3

// Origin-root shell radii: all four roots are concentric at 0,0,0, so each gets its own
// radius (nested, no coincident surfaces). All are <= NODE_RADIUS (320) and the first real
// node is 800 away, so every root stays well inside its own first gap.
export const ORIGIN_ROOT_RADII = { conscious: 320, omnihand: 280, lh: 240, rh: 200 }

// Tunnel colours (V166)
export const TUNNEL_COLORS = {
  conscious: 0x8a5cff,   // violet (the Conscious accent)
  omnihand:  0xffffff,   // white (+ contrastLines)
  lh:        0x2ecc71,   // green
  rh:        0xe8e8e8,   // neutral light body tint; the grid is R/G/B per vertex
}
export const RGB_COLORS = [0xff3b3b, 0x35e07a, 0x3f7bff]   // CreativeHand grid cycle: R, G, B

// ── Root text (user-defined, verbatim) ──────────────────────────────────────

export const CONSCIOUS_ROOT_TEXT =
  '⟐ConsciousHand — the root of the Perspective axis: the whole reality as the observer holds it before any scale or perspective is chosen.'
export const OMNIHAND_ROOT_TEXT =
  '⟐OmniHand — the root of the Product axis: the origin of every OmniProduct and tier.'
// TODO(data): placeholder wording (V166) — not user-defined yet.
export const LOGICAL_ROOT_TEXT =
  '⟐LogicalHand — the root of the logic side: where the Mechanic, Relational and Transformational behaviour classes meet at the origin. TODO: define.'
export const CREATIVE_ROOT_TEXT =
  '⟐CreativeHand — the root of the creative side: where the Temporal, Emergent and Expressive classes meet at the origin. TODO: define.'

// ── Panel groups ────────────────────────────────────────────────────────────

export const TUNNEL_GROUPS = [
  { id: 'hand',  title: 'Hand tunnels' },
  { id: 'axes',  title: 'Axes' },
]

// ── Origin root nodes (node 0 of each hand tunnel, centre exactly 0,0,0) ────

export const CONSCIOUS_ROOT_NODE = { id: 'conscious-root', name: '⟐ConsciousHand', view: 'The root: the whole reality before any perspective is chosen.' }
export const OMNIHAND_ROOT_NODE  = { id: 'omnihand-root',  name: '⟐OmniHand',      view: 'The root: the origin of every OmniProduct and tier.' }
export const LOGICAL_ROOT_NODE   = { id: 'lh-root',        name: '⟐LogicalHand',   view: 'The root of the logic side.' }
export const CREATIVE_ROOT_NODE  = { id: 'rh-root',        name: '⟐CreativeHand',  view: 'The root of the creative side.' }

// TODO(data): placeholder nodes for the two view-only hand tunnels. They are the
// behaviour classes ("communication styles") of that hand's ammo (systems/OmniNodeBehavior.js
// BEHAVIOR_CLASSES: Mechanic, Relational, Transformational, Temporal, Emergent). There is no
// "Expressive" class in the code; it is the proposed grouping of the Drift / Oscillate / Mirror
// behaviours that CreativeHand's default magazine also carries (utils/OmniHandsSettings.js).
export const LOGICAL_NODES = [
  LOGICAL_ROOT_NODE,
  { id: 'lh-mechanic',        name: 'Mechanic',         view: 'Placeholder: the Mechanic behaviour class (LogicalHand ammo).' },
  { id: 'lh-relational',      name: 'Relational',       view: 'Placeholder: the Relational behaviour class (LogicalHand ammo).' },
  { id: 'lh-transformational', name: 'Transformational', view: 'Placeholder: the Transformational behaviour class (LogicalHand ammo).' },
]
export const CREATIVE_NODES = [
  CREATIVE_ROOT_NODE,
  { id: 'rh-temporal',   name: 'Temporal',   view: 'Placeholder: the Temporal behaviour class (CreativeHand ammo).' },
  { id: 'rh-emergent',   name: 'Emergent',   view: 'Placeholder: the Emergent behaviour class (CreativeHand ammo).' },
  { id: 'rh-expressive', name: 'Expressive', view: 'Placeholder: the expressive grouping (Drift / Oscillate / Mirror) in CreativeHand ammo.' },
]

// ── Placeholder nodes for the X / Y / Z axis tunnels ────────────────────────
// TODO(data): replace with real axis content. Five nodes, indices -2..+2, the
// centre node (index 0) sits at the world origin.

function axisNodes (letter) {
  return [-2, -1, 0, 1, 2].map(k => ({
    id: `${letter.toLowerCase()}${k}`,
    name: k === 0 ? `${letter} 0 · Origin` : `${letter} ${k > 0 ? '+' : '−'}${Math.abs(k)}`,
    view: `Placeholder node ${k > 0 ? '+' : ''}${k} on the ${letter} axis.`,
  }))
}

const axisRoot = (letter) =>
  `${letter} axis root — where the ${letter} axis crosses the origin. TODO: define what this axis means.`

/** The built-in tunnel set. The four hand tunnels first (the pads drive / show these). */
export function buildDefaultTunnelDefs () {
  const handCommon = { group: 'hand', twoSided: true, originRoot: true, rootIndex: 0, showRootMark: true,
    opacityScale: HAND_TUNNEL_OPACITY_SCALE, nodeOpacityScale: HAND_NODE_OPACITY_SCALE }
  return [
    {
      ...handCommon,
      id: 'conscious', title: 'Conscious Hand', symbol: CONSCIOUS_SYMBOL,
      color: 0x8a5cff, tunnelColor: TUNNEL_COLORS.conscious, direction: { clock: CLOCK.conscious.pos },
      nodeShape: 'icosahedron', labelPrefix: '', padHand: 'conscious',
      primaryTerm: 'Perspective', relativeTerm: 'Scale',
      nodes: [CONSCIOUS_ROOT_NODE, ...CONSCIOUS_PERSPECTIVES],
      levels: CONSCIOUS_SCALE_DEGREES, maxLevels: CONSCIOUS_MAX_SCALES,
      relDir: -1,   // deeper scale degrees sit LOWER, so pad Up moves back toward Human scale
      rootRadius: ORIGIN_ROOT_RADII.conscious, rootText: CONSCIOUS_ROOT_TEXT,
      relRadiusScale: 1.25, relLabelSide: -1,   // the two columns share the origin: keep them apart
    },
    {
      ...handCommon,
      id: 'omnihand', title: 'OmniHand', symbol: OMNIHAND_SYMBOL,
      color: 0xff8a1f, tunnelColor: TUNNEL_COLORS.omnihand, contrastLines: true,
      direction: { clock: CLOCK.omnihand.pos },
      nodeShape: 'octahedron', labelPrefix: '⟐', padHand: 'omnihand',
      primaryTerm: 'Product', relativeTerm: 'Tier',
      nodes: [OMNIHAND_ROOT_NODE, ...OMNIHAND_PRODUCTS],
      levels: OMNIHAND_TIERS, maxLevels: OMNIHAND_MAX_TIERS,
      relDir: 1,    // higher tiers sit higher, pad Up moves to a higher tier
      stagger: true,
      rootRadius: ORIGIN_ROOT_RADII.omnihand, rootText: OMNIHAND_ROOT_TEXT,
      relRadiusScale: 1, relLabelSide: 1,
    },
    {
      ...handCommon,
      id: 'lh', title: 'Logical Hand', symbol: LOGICAL_SYMBOL,
      color: 0x2ecc71, tunnelColor: TUNNEL_COLORS.lh, direction: { clock: CLOCK.lh.pos },
      nodeShape: 'icosahedron', labelPrefix: '', padHand: 'lh',
      nodes: LOGICAL_NODES, rootRadius: ORIGIN_ROOT_RADII.lh, rootText: LOGICAL_ROOT_TEXT,   // view only (no levels)
    },
    {
      ...handCommon,
      id: 'rh', title: 'Creative Hand', symbol: CREATIVE_SYMBOL,
      color: 0xffffff, tunnelColor: TUNNEL_COLORS.rh, tunnelColors: RGB_COLORS, contrastLines: true,
      swatch: `linear-gradient(90deg, #ff3b3b 0 33%, #35e07a 33% 66%, #3f7bff 66% 100%)`,
      direction: { clock: CLOCK.rh.pos },
      nodeShape: 'icosahedron', labelPrefix: '', padHand: 'rh',
      nodes: CREATIVE_NODES, rootRadius: ORIGIN_ROOT_RADII.rh, rootText: CREATIVE_ROOT_TEXT,   // view only (no levels)
    },
    {
      id: 'x', group: 'axes', title: 'X axis (3↔9)', symbol: 'X', color: 0xff5a5a,
      direction: { axis: 'x' }, twoSided: true, nodeShape: 'icosahedron', tickRings: true,
      nodes: axisNodes('X'), rootIndex: 2, rootText: axisRoot('X'), showRootMark: false,
    },
    {
      id: 'y', group: 'axes', title: 'Y axis (vertical)', symbol: 'Y', color: 0x4cd964,
      direction: { axis: 'y' }, twoSided: true, nodeShape: 'icosahedron', tickRings: true,
      nodes: axisNodes('Y'), rootIndex: 2, rootText: axisRoot('Y'), showRootMark: false,
    },
    {
      id: 'z', group: 'axes', title: 'Z axis (12↔6)', symbol: 'Z', color: 0x4a90ff,
      direction: { axis: 'z' }, twoSided: true, nodeShape: 'icosahedron', tickRings: true,
      nodes: axisNodes('Z'), rootIndex: 2, rootText: axisRoot('Z'), showRootMark: false,
    },
  ]
}
