/**
 * data/OmniDimensionalAxesData.js — editable content for the two
 * dimensional axes (systems/OmniDimensionalAxes.js)
 *
 * Everything here is DATA, not logic: edit freely, no changes needed
 * in OmniDimensionalAxes.js. Node count may change; the axis length,
 * node positions and pad stepping all derive from these arrays.
 * Saved positions are clamped on load if an array shrinks.
 *
 * HONEST STATUS — what is real and what is placeholder:
 *   - The symbols, clock directions and the shape of both axes are the
 *     confirmed design (docs/architecture/HAND_TOGGLE_CONTROL_DESIGN.md,
 *     "Design confirmed 2026-10-04 (dimensional axes)").
 *   - OmniHand primary nodes are REAL OmniProduct names (see below).
 *   - OmniHand tiers are the REAL generic 4-tier definition from
 *     docs/architecture/NAMING_TIER_SYSTEM_DESIGN.md, but per-product
 *     tier availability is not modeled anywhere yet.
 *   - Conscious Hand perspectives and scale degrees are PLACEHOLDERS
 *     seeded from the design conversation's apple-on-a-table example.
 *     No perspective census exists in the codebase yet.
 *   - The massive nodes are labeled container shapes only. The data
 *     they are meant to contain does not exist yet.
 */

// ── Symbols (trivially changeable) ──────────────────────────────────────────

export const CONSCIOUS_SYMBOL = 'Δ'   // Delta — Conscious Hand's dimension
export const OMNIHAND_SYMBOL  = '⟐'   // OmniHand's dimension
export const LOGICAL_SYMBOL   = 'Λ'   // V166 LogicalHand tunnel (view only)
export const CREATIVE_SYMBOL  = 'Ψ'   // V166 CreativeHand tunnel (view only)
// Relative-Y axis label for BOTH hands. Gamma (Γ) was floated, but it does
// not read as a "Y"; Upsilon (Υ) does. Swap this one constant to change it.
export const REL_AXIS_SYMBOL  = 'Υ'

// ── Clock directions (top-down, world-fixed) ────────────────────────────────
//
// 12 o'clock = world -Z, 3 o'clock = +X. This is the project's own
// top-down convention: ui/MiniMap.js draws world (x, z) at canvas
// (cx + x, cy + z) with north/12 at the top, so -Z is up and +X is right
// (also three.js's default, camera looking down -Z).
//
// V166: the four hand tunnels are FULL LENGTH and two-sided: each runs through the origin
// along the line of its clock hour (`pos` is the end the pad's RIGHT button travels toward;
// the opposite hour is the other end, e.g. OmniHand 11 <-> 5, Conscious 2 <-> 8). Their
// nodes sit on the `pos` side only: node 0 is the ROOT at 0,0,0, node i at i x NODE_SPACING.
// LogicalHand 7 <-> 1 (bottom-left corner diagonal) and CreativeHand 4 <-> 10 (bottom-right)
// are VIEW-ONLY tunnels (their pads move the camera, not a marker). Hours may be fractional.
// (V159/V160 made the two top tunnels one-sided from the origin; V158 had 2-8 / 10-4.)
export const CLOCK = {
  conscious: { pos: 2 },
  omnihand:  { pos: 11 },
  lh:        { pos: 7 },    // V166 view-only tunnel 7 <-> 1
  rh:        { pos: 4 },    // V166 view-only tunnel 4 <-> 10
}

// ── Conscious Hand — PLACEHOLDER perspectives and scale degrees ─────────────

export const CONSCIOUS_PERSPECTIVES = [
  { id: 'biologist', name: 'Biologist', view: 'A fruit: seed vessel, tissue, species.' },
  { id: 'teacher',   name: 'Teacher',   view: 'A lesson prop: hold it up and ask a question.' },
  { id: 'artist',    name: 'Artist',    view: 'Colour, light and form: a still life.' },
  { id: 'physicist', name: 'Physicist', view: 'Mass, surface, a body that falls.' },
  { id: 'chef',      name: 'Chef',      view: 'An ingredient: sweet, tart, good baked.' },
  { id: 'economist', name: 'Economist', view: 'A priced good in a supply chain.' },
  { id: 'engineer',  name: 'Engineer',  view: 'A shape to package, ship and bruise-proof.' },
  { id: 'historian', name: 'Historian', view: 'Eden, Newton, Turing: a story it keeps turning up in.' },
]

// V166 hard limits for the relative (Υ) column: ConsciousHand exactly 10 scale degrees,
// OmniHand exactly 8 tiers. The lists below are sliced to these counts, and OmniAxinator
// clamps stepping to def.levels (see def.maxLevels in data/OmniAxinatorData.js).
export const CONSCIOUS_MAX_SCALES = 10
export const OMNIHAND_MAX_TIERS   = 8

// Order matters: index 0 is the human-scale view, later entries go deeper.
// Entries 6-10 are PLACEHOLDERS (V166, TODO(data): real deeper / wider scale degrees).
export const CONSCIOUS_SCALE_DEGREES = [
  { id: 'human',     name: 'Human scale', view: 'The apple on the table.' },
  { id: 'ant',       name: 'Ant scale',   view: 'The apple as an ant would see it.' },
  { id: 'cellular',  name: 'Cellular',    view: 'Cells and tissue.' },
  { id: 'molecular', name: 'Molecular',   view: 'Molecules: sugars, water, pigment.' },
  { id: 'atomic',    name: 'Atomic',      view: 'Atoms.' },
  { id: 'scale6',    name: 'Scale 6',     view: 'Placeholder scale degree 6 (TODO).' },
  { id: 'scale7',    name: 'Scale 7',     view: 'Placeholder scale degree 7 (TODO).' },
  { id: 'scale8',    name: 'Scale 8',     view: 'Placeholder scale degree 8 (TODO).' },
  { id: 'scale9',    name: 'Scale 9',     view: 'Placeholder scale degree 9 (TODO).' },
  { id: 'scale10',   name: 'Scale 10',    view: 'Placeholder scale degree 10 (TODO).' },
].slice(0, CONSCIOUS_MAX_SCALES)

// ── OmniHand — REAL OmniProduct names, REAL generic tier definition ─────────
//
// Source for names: the real product entries of the ⟐mniMenu left drawer
// (ui/Drawer.js LEFT_ITEMS). Not every entry there is a product (Admin,
// Developer, NavMap, CameraTravelSettings, PanelControl... are tools or
// settings), so the criterion used here is: a standalone OmniProduct that
// has a design doc in docs/omniproducts/, plus OmniVision, which
// NAMING_TIER_SYSTEM_DESIGN.md names explicitly as a product line next to
// OmniVisor. Drawer products left off: OmniEXP, OmniRealities, OmniTranslator,
// OmniKeys, OmniSelect, OmniDraw, OmniMixer, OmniPocket. To add one, append a line.
// (V166: the ROOT node sits at the origin; these products are nodes 1..N on the tunnel.)
export const OMNIHAND_PRODUCTS = [
  { id: 'omniplayer',     name: 'OmniPlayer' },
  { id: 'omnichronos',    name: 'OmniChronos' },
  { id: 'omnisense',      name: 'OmniSense' },
  { id: 'omniexpression', name: 'OmniExpression' },
  { id: 'omnitargeting',  name: 'OmniTargeting' },
  { id: 'omnivision',     name: 'OmniVision' },
  { id: 'omnivisor',      name: 'OmniVisor' },
  { id: 'omnibrowser',    name: 'OmniBrowser' },
  { id: 'omnisystem',     name: 'OmniSystem' },
  { id: 'omninavi',       name: 'OmniNavi' },
]

// The real, generic tier ladder from NAMING_TIER_SYSTEM_DESIGN.md (the
// Time -> OmniTime -> (TBD) -> OmniChronos example). Tier 3's name is
// explicitly still undecided there. OmniNavi's own doc describes only
// 3 tiers, so a per-product tier list is a known follow-up.
// Entries 5-8 are PLACEHOLDERS (V166, TODO(data): the generic ladder only defines 4 tiers).
export const OMNIHAND_TIERS = [
  { id: 'tier1', name: 'Tier 1 · Demo',      view: 'Free, demo-level, plain unbranded name.' },
  { id: 'tier2', name: 'Tier 2 · Official',  view: 'The official Omni-branded product.' },
  { id: 'tier3', name: 'Tier 3 · Paid (TBD)', view: 'Middle paid tier; name not settled.' },
  { id: 'tier4', name: 'Tier 4 · Full',      view: 'Most current, complete form.' },
  { id: 'tier5', name: 'Tier 5',             view: 'Placeholder tier 5 (TODO).' },
  { id: 'tier6', name: 'Tier 6',             view: 'Placeholder tier 6 (TODO).' },
  { id: 'tier7', name: 'Tier 7',             view: 'Placeholder tier 7 (TODO).' },
  { id: 'tier8', name: 'Tier 8',             view: 'Placeholder tier 8 (TODO).' },
].slice(0, OMNIHAND_MAX_TIERS)
