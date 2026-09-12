# OmniSystem

Nothing in this document is built. The most foundational of four
related ideas raised across two conversations - this one, OmniAction,
the Naming & Tier System, and OmniStore all connect to each other; see
each doc's own "Where this connects" section.

## The reference point

Directly inspired by Three.js's own well-known "Periodic Table"
example - a set of tiles that smoothly interpolate between named
layouts: a periodic-table grid, a sphere, a 3D grid (some tiles behind
others, not just side by side), and a helix. Personally extended with
a second helix, offset into a double-helix/DNA-like form - genuinely
different from a single helix, not just a variation of it.

## The actual mechanic - pulled apart into three genuinely different things

Worth being precise here, since conflating these would make the build
much harder than it needs to be:

1. **Formation morphing** (what the reference example actually does).
   Every node's own shape stays exactly the same the whole time; only
   *where it sits* moves, tweened from one layout's output positions
   to another's. This is the simple one - the same GSAP
   position-tweening pattern already used everywhere else in this
   project, nothing shader-related required.
2. **A node's own individual geometry changing** - cube today, sphere
   tomorrow, independent of whatever formation the system is
   currently in. Just an Inspector-editable property per node, same
   as any OmniNode already has.
3. **One geometry's own vertices morphing into another's shape** (a
   cube literally flowing into a sphere). A real, harder, genuinely
   different technique, shader-adjacent. Confirmed NOT what's being
   asked for right now - the actual ask is #2, a node keeping its own
   identity while its shape/size is an editable property, not true
   vertex morphing.

## The corrected architecture - CSS3D is deliberately not being reused

The original Three.js example renders its tiles with `CSS3DRenderer`
- real HTML elements positioned in 3D. That's not being carried over
here, for a reason already learned the hard way earlier in this
project (`OmniBrowserSpace`'s own rebuild): CSS3D and WebGL share no
depth buffer, so CSS3D content can't be correctly occluded or truly
participate in the scene. It also directly conflicts with a real
requirement here - every node needs to be individually selectable and
Inspector-editable exactly like a normal OmniNode, which means every
node needs to be a real `THREE.Mesh`, not an HTML element positioned
in 3D.

## "Particle geometry" - clarified, not literal THREE.Points

A true particle system (`THREE.Points`) renders many points in a
single draw call sharing one material - there's no way to select
"point #47" individually. Given every node here needs to be
independently selectable and indexed (0 to N-1), what's actually
wanted is a **collection of N separate, real mesh objects** managed
together as a group - which is also how the original reference
example actually works, even without literal particles.

## "OmniClasses" - a real framing, not just a metaphor

OmniDraw creates one OmniNode. OmniSystem - a named, indexed
collection of N node-like objects sharing one formation-behavior - is
genuinely the next layer up, the way a class defines a template many
instances share while each instance stays individually addressable.
Worth treating as real architecture, not just a turn of phrase.

## Scope, as actually proposed

- Start with the four layouts already known in depth: table (or grid),
  sphere, single helix, and the personally-discovered double helix -
  rather than "all shapes" as a first pass. Architected so a fifth
  layout later is just another layout function, not a rebuild.
- Default node count, editable.
- Every node indexed (0 to N-1) and individually Inspector-editable -
  position, rotation speed, shape, the same properties any other
  OmniNode/OmniDraw object has.
- Real panels, matching every other OmniProduct's own UI conventions.

## Deliberately deferred - manual animation of individual nodes

Explicitly saved for last: "that's actually really fun," meant to
come after the foundational formation-morphing exists. This is very
plausibly where **OmniAction** (`OMNIACTION_DESIGN.md`) actually gets
used for the first time, rather than being a separate, one-off feature
built inside OmniSystem itself.

## Still genuinely open

- When a formation transition plays (sphere -> double helix, say), do
  individual nodes travel in a straight line between old and new
  position, or does each layout define its own transition path (a
  real spiral sweep into the helix, for instance)? The reference
  example just lerps straight lines; given the personal double-helix
  extension shows real interest in path character, a straight-line
  default may not be the final answer. Not decided yet.

## Node identification & fast travel

Every node across every formation gets a generated, human-readable id
following a shared Excel-style outline scheme — full reasoning and
the per-system mapping in
`OMNI_NODE_IDENTIFICATION_DESIGN.md`. A fast-travel node selector
(toggleable grid overlay, type-to-filter) is designed there too,
built on top of the existing "Take Me There" travel mechanic in
`systems/OmniInspector.js`, which already works generically for any
node regardless of which system created it.

## Fourth formation, proposed: Grid (columns, rows, drawers)

Not built. Proposed understanding, written out for confirmation
before any of it becomes code:

A genuine 3D lattice, structurally different from the first three —
Cross/Ring/Sphere each have one shared distance/radius; Grid instead
needs **three independent counts** (columns × rows × drawers) plus
**one shared spacing value** between adjacent nodes on any axis, with
OmniCore sitting at the lattice's geometric center the same way it
does in every other formation.

"Drawers" read as genuine depth layers — columns along X, rows along
Y, drawers stacked along Z, like a filing cabinet where each drawer,
pulled open, reveals one flat column/row grid behind the last.

Naming extends the same Excel-style pairing used everywhere else, but
here it's structural rather than arbitrary: real column letters, real
row numbers, per drawer — e.g. `gridD1-A1_01` for drawer 1, column A,
row 1. This is the one formation where the letter/number pairing
means exactly what it means in a spreadsheet.

Open questions before this becomes real:
- Does Group Lock (the shared-vs-individual mechanic from the other
  three systems) apply per-axis here — one lock for column spacing,
  a separate one for row spacing, another for drawer spacing — or one
  single lock for all three at once?
- Is OmniCore's center position always a real node itself (as in
  Cross/Ring/Sphere), or can it also be an empty lattice point when
  column/row/drawer counts are even and there's no true center cell?

## Status

Three formations now live in one Inspector — `ui/OmniSystemCreatorPanel.js`,
accessible from the Left Menu (`⟐OmniSystem → ⟐OmniSystemCreator`) —
sharing one field language (shape-icon preview, id/label, primitive
"truth" dropdown, RGBA channels, range fields pairing a slider with a
typeable number, all matching OmniDraw's own established pattern).

**Skeletal Cross** — fixed 7 nodes: 1 center (future OmniCore) + 6
arms, one per axis direction, all boxes by default.

**Radial Ring** (Stonehenge-style) — 1 center + N outer nodes, N a
free input. One formula covers every case: node *i* sits at angle
`i × (360°/N)`, clockwise from 12 o'clock, always. Verified against
every worked example directly (N=2,3,4,6) and generalizes identically
to any N.

**Sphere (Fibonacci)** — 1 center + N outer nodes distributed evenly
across a sphere's surface using the canonical spherical Fibonacci
lattice: the same golden-ratio spiral pattern found in sunflower seed
heads and pinecones. One formula, works identically for any N — no
special-casing by count, no restriction to specific "nice" numbers.
Default is 64 (matching the practical default requested), verified
directly against an independently-computed reference implementation
of the formula, confirmed to span the full sphere top-to-bottom
rather than clustering, and confirmed every node sits at exactly the
configured radius from center.

All three formations share the same **Group Lock** mechanic: locked
(the default), one shared distance/radius value moves every outer
node at once, symmetrically; unlocked, each gets its own independent
value. This is the concrete stand-in for what OmniCore will
eventually own and propagate, before OmniCore itself exists as real
code.

"Create System" builds every node through NodeLoader's own real,
validated `loadNode(data)` path. Alpha is applied directly to each
created node's real mesh material right after creation — an honest
limitation, not a hidden one: NodeLoader's saved schema has no opacity
field, so alpha is visible immediately but won't survive a reload.

Three sibling menu entries — `⟐OmniSystemAnimator`,
`⟐OmniSystemDimensionalizer`, `⟐OmniSystemSettings` — remain real,
correctly wired, honest "not built yet" placeholders.

Still not built: OmniCore itself as real code, any formation beyond
these three, and any per-node animation logic.
