/**
 * data/OmniAxinatorData.js — editable content for the built-in ("main")
 * OmniAxinator (systems/OmniAxinator.js, instantiated by
 * systems/OmniDimensionalAxes.js)
 *
 * DATA, not logic. Each tunnel def is plain JSON-ish data (no THREE objects):
 *
 *   id          unique id (also the key in localStorage 'omni:axinator-v1')
 *   group       panel grouping: 'hand' | 'axes' | 'clock'
 *   title       human title (panel + tooltips)
 *   symbol      one glyph shown in the panel and the menu
 *   color       accent colour (marker / ticks / label border ONLY — tunnel and
 *               node shells are grey/silver, see TUNNEL_COLOR in OmniAxinator.js)
 *   direction   { clock: hour }  top-down clock, 12 = -Z, 3 = +X, may be fractional
 *               { axis: 'x'|'y'|'z' }
 *   twoSided    false: starts at the origin and runs out along `direction`
 *               true : passes THROUGH the origin, nodes centred on it
 *   nodes       [{ id, name, view? }]  ordered along the tunnel (two-sided: the
 *               middle of the array sits at the origin)
 *   levels      optional relative (Υ) axis [{ id, name, view? }] -> makes the
 *               tunnel "steppable" (marker + relative column, pad stepping)
 *   rootIndex   which node is the tunnel's ROOT
 *   rootText    the root tooltip text shown in the node menu
 *   showRootMark  draw the crown ring + "ROOT" label line on the root node
 *   padHand     the hand whose pad shows/hides this tunnel automatically
 *               ('omnihand' | 'conscious'); omit for tunnels that are manual only
 *
 * HONEST STATUS: X/Y/Z and the two extra clock diagonals carry PLACEHOLDER
 * nodes (TODO below). Their geometry, picking, menu and panel toggles are real;
 * the content they will hold is not designed yet.
 */

import {
  CONSCIOUS_SYMBOL, OMNIHAND_SYMBOL, CLOCK,
  CONSCIOUS_PERSPECTIVES, CONSCIOUS_SCALE_DEGREES,
  OMNIHAND_PRODUCTS, OMNIHAND_TIERS,
} from './OmniDimensionalAxesData.js'

// ── Root text (user-defined, verbatim) ──────────────────────────────────────

export const CONSCIOUS_ROOT_TEXT =
  '⟐ConsciousHand — the root of the Perspective axis: the whole reality as the observer holds it before any scale or perspective is chosen.'
export const OMNIHAND_ROOT_TEXT =
  '⟐OmniHand — the root of the Product axis: the origin of every OmniProduct and tier.'

// ── Panel groups ────────────────────────────────────────────────────────────

export const TUNNEL_GROUPS = [
  { id: 'hand',  title: 'Hand tunnels' },
  { id: 'axes',  title: 'Axes' },
  { id: 'clock', title: 'Clock diagonals' },
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

// TODO(data): replace with real clock-diagonal content. Three nodes: -1, 0, +1.
function clockNodes (tag) {
  return [-1, 0, 1].map(k => ({
    id: `${tag}_${k}`,
    name: k === 0 ? `${tag} · Origin` : `${tag} ${k > 0 ? '+' : '−'}${Math.abs(k)}`,
    view: `Placeholder node ${k > 0 ? '+' : ''}${k} on the ${tag} diagonal.`,
  }))
}

const axisRoot = (letter) =>
  `${letter} axis root — where the ${letter} axis crosses the origin. TODO: define what this axis means.`

/** The built-in tunnel set. Hand tunnels first (the pads drive these two). */
export function buildDefaultTunnelDefs () {
  return [
    {
      id: 'conscious', group: 'hand', title: 'Conscious Hand', symbol: CONSCIOUS_SYMBOL,
      color: 0x8a5cff, direction: { clock: CLOCK.conscious.pos }, twoSided: false,
      nodeShape: 'icosahedron', labelPrefix: '', padHand: 'conscious',
      primaryTerm: 'Perspective', relativeTerm: 'Scale',
      nodes: CONSCIOUS_PERSPECTIVES, levels: CONSCIOUS_SCALE_DEGREES,
      relDir: -1,   // deeper scale degrees sit LOWER, so pad Up moves back toward Human scale
      rootIndex: 0, rootText: CONSCIOUS_ROOT_TEXT, showRootMark: true,
    },
    {
      id: 'omnihand', group: 'hand', title: 'OmniHand', symbol: OMNIHAND_SYMBOL,
      color: 0xff8a1f, direction: { clock: CLOCK.omnihand.pos }, twoSided: false,
      nodeShape: 'octahedron', labelPrefix: '⟐', padHand: 'omnihand',
      primaryTerm: 'Product', relativeTerm: 'Tier',
      nodes: OMNIHAND_PRODUCTS, levels: OMNIHAND_TIERS,
      relDir: 1,    // higher tiers sit higher, pad Up moves to a higher tier
      stagger: true,
      rootIndex: 0, rootText: OMNIHAND_ROOT_TEXT, showRootMark: true,
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
    {
      id: 'd2_8', group: 'clock', title: 'Diagonal 2↔8', symbol: '↗', color: 0xe0a040,
      direction: { clock: 2 }, twoSided: true, nodeShape: 'icosahedron', tickRings: true,
      nodes: clockNodes('2↔8'), rootIndex: 1,
      rootText: 'Diagonal 2↔8 root — where the 2-to-8 o\'clock diagonal crosses the origin. TODO: define.',
      showRootMark: false,
    },
    {
      id: 'd11_5', group: 'clock', title: 'Diagonal 11↔5', symbol: '↖', color: 0x40c0c0,
      direction: { clock: 11 }, twoSided: true, nodeShape: 'icosahedron', tickRings: true,
      nodes: clockNodes('11↔5'), rootIndex: 1,
      rootText: 'Diagonal 11↔5 root — where the 11-to-5 o\'clock diagonal crosses the origin. TODO: define.',
      showRootMark: false,
    },
  ]
}
