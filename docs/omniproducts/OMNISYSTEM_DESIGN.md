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

## OmniCore Origin — px/py/pz, rx/ry/rz, sx/sy/sz

Every formation's center was previously hardcoded to the local
origin `[0,0,0]`, with no way to place a system anywhere else. Fixed
directly in `OmniSystemCreatorPanel.js`: a real 9-field transform —
position, rotation (degrees), non-uniform scale — applied to every
node (scale, then rotate, then translate, in that order) before
creation. OmniCore's own local offset is always `[0,0,0]`, so scaling
or rotating it does nothing on its own — it always lands exactly at
the specified `(px,py,pz)`, with every other node correctly
positioned relative to that same anchor. Defaults to identity
(0 position, 0 rotation, scale 1), so nothing changes unless
explicitly set.

Verified directly: confirmed the defaults reproduce the exact
pre-existing positions with zero regression, confirmed moving the
origin moves the whole system together, confirmed a 90° rotation
genuinely swaps which world axis an arm sits on, confirmed
non-uniform scale stretches only the intended axis and leaves the
others alone, and confirmed OmniCore itself stays exactly anchored
even with rotation and scale both applied everywhere else at once.

## Delete an entire system, through OmniCore

Every node created by one "Create System" click now shares a
`systemInstanceId`, and the center node alone is tagged `isOmniCore`.
This is what makes "delete this whole system" possible at all —
previously nothing tied a batch of created nodes back together as one
unit, so the only real option was Clear Scene, which deletes
everything, everywhere.

Selecting a system's OmniCore node and opening its Inspector now
shows a "Delete Entire System" option, specifically because it's an
OmniCore — not available on any other node. Confirms before acting,
same as Clear Scene. Verified directly with two independent systems
coexisting at once: deleting one leaves the other's nodes, and its
real meshes in the scene, completely untouched.

## WebGL context-loss diagnostics

A real `webglcontextlost` listener now logs directly and explicitly
when the GPU driver itself terminates the rendering context — a
distinct, lower-level event from a normal JS exception, and one that
produces exactly "canvas goes blank, rest of the page keeps working
fine." Common causes: genuine GPU memory pressure, or a single
invalid value (NaN/Infinity) in a geometry or material anywhere in
the scene. Added specifically so this can be confirmed directly next
time, rather than inferred from the symptom alone.

## Node identification & fast travel

Every node across every formation gets a generated, human-readable id
following a shared Excel-style outline scheme — full reasoning and
the per-system mapping in
`OMNI_NODE_IDENTIFICATION_DESIGN.md`. A fast-travel node selector
(toggleable grid overlay, type-to-filter) is designed there too,
built on top of the existing "Take Me There" travel mechanic in
`systems/OmniInspector.js`, which already works generically for any
node regardless of which system created it.

## Fourth formation: Grid (columns, rows, drawers) — built

A genuine 3D lattice, structurally different from the first three —
Cross/Ring/Sphere each have one shared distance/radius; Grid instead
uses **three independent counts** (columns × rows × drawers, each
capped at 12 per axis, 512 total — the total cap scales drawers back
first, then rows, then columns, since drawers are depth layers a user
is least likely to be looking directly at) plus **one shared spacing
value** between adjacent nodes on any axis.

"Drawers" are genuine depth layers — columns along X, rows along Y,
drawers stacked along Z, like a filing cabinet where each drawer,
pulled open, reveals one flat column/row grid behind the last.

Naming extends the same Excel-style pairing used everywhere else,
structural rather than arbitrary — real column letters, real row
numbers, per drawer: `grid-d1-A1` for drawer 1, column A, row 1,
matching the spreadsheet-style pairing exactly, generated by a real
base-26 column-letter helper (A...Z, then AA, AB... beyond — though
the 12-per-axis cap means this only ever reaches L in practice).

**The two open questions, resolved:**
- **Group Lock**: one single lock for all three axes at once, not
  three separate per-axis locks — matches the spec's own "one shared
  spacing value" language directly, and stays consistent with how
  Group Lock already works for the other three formations (always one
  lock, never per-axis).
- **OmniCore's center**: always a real, separate node — OmniCore is
  never counted among the columns/rows/drawers themselves, positioned
  at the lattice's true geometric center via its own `pos()` returning
  a fixed `[0,0,0]`. This sidesteps the even/odd "is there a true
  center cell" question entirely, the same way Cross/Ring/Sphere
  already keep OmniCore distinct from their own outer/arm/ring nodes
  rather than trying to make it double as one of them.

Fits the exact same `{key, label, isCenter, pos(d)}` contract the
other three formations already use — `_createSystem()`, Group Lock,
alpha, and the OmniCore Origin transform all work with Grid with zero
formation-specific code of their own, verified directly rather than
assumed.

## Next four formations — all four built

Raised together as the natural next wave after Grid completed the
original four.

**Galaxy — built.** Hybrid, exactly as specified: a small, user-chosen
count of main nodes (real, individual, interactive meshes, capped at
200, positioned along 3 fixed spiral arms) plus a much larger particle
field carrying the bulk "galaxy" visual, reusing
`modules/OmniExpressionator.js` directly — a new `galaxy` preset
alongside the existing `entrance` one, not a second particle system.

Building this surfaced a real architectural gap worth being direct
about: the engine could previously only run one preset at a time —
fine for `entrance` (a one-shot, global, auto-disposing effect), wrong
for Galaxy, where each system needs its own particle field that
persists independently and can coexist with every other Galaxy system
someone creates. Fixed at the root — `OmniExpressionator` now tracks
named, concurrent instances (keyed by a system's own
`systemInstanceId`) rather than one single active slot, with a
`'default'` id preserving `entrance`'s exact old behavior unchanged.
Verified directly: two separate Galaxy systems created back to back
both keep their own live, independent particle fields — and deleting
one system's particle field (via the existing "Delete Entire System"
mechanism) correctly cleans up only its own field, leaving any other
Galaxy system's field completely untouched.

The particle field itself is genuinely different in kind from
`entrance`: world-space rather than camera-relative (it stays where
the galaxy actually is, not attached to wherever the viewer happens to
be looking), and persistent rather than auto-disposing after a
duration — a slow, continuous ambient rotation rather than a one-time
effect. Positioned using the system's real OmniCore world position
(after the OmniCore Origin transform is applied), radius scaled from
the same shared distance/arm-reach value driving the main nodes, so
the two visually agree with each other.

**Single Spiral — built.** One continuous strand: angle increases per
node (40° per step), radius grows per node rather than staying fixed
(the thing that actually distinguishes this from Ring, which holds
radius constant — verified directly, not just asserted), height drifts
along Y as it winds. A single shared "Scale" value drives radius
growth and height drift together, same one-knob pattern as every
other formation's Distance/Radius/Spacing field.

**Helix (Double Spiral) — built**, and built exactly as reasoned
before either existed: one shared `spiralPoint()` formula, called
twice — a second strand at the same radius/height as the first for a
given step, but phase-offset by π. Verified directly rather than
assumed: at any given step, both strands share the exact same radius
and height, and their x/z positions are true negations of each other
— genuinely opposite sides of the same spiral, not two coincidentally-
similar, independently-tuned curves that happen to look related.

**Star — built.** Count = number of spikes, one node per spike tip,
exactly as specified. Deliberately not deterministic like every other
formation's defs — "shoot out at random" is the actual point here, so
re-generating a Star gives a genuinely different arrangement each
time, not a fixed formula re-run. Initial spike directions are random
points on a unit sphere (uniform, not clustered at the poles).

The genuinely different part, confirmed working rather than assumed:
this needed an actual per-frame update loop, since a fixed `pos(d)`
formula can't express "keeps moving over time" at all. After creation,
each spike's direction takes a small, continuous random walk on the
unit sphere — nudged and renormalized every frame, so it wanders
organically forever without ever growing or shrinking the spike's own
length. A "Rotating" checkbox adds the whole system spinning as a
rigid body on top of that per-spike drift — both genuinely coexist,
verified directly (rotation angle only accumulates while the checkbox
is on; the per-spike drift never stops either way). Spikes are also
anchored to OmniCore's real, live position each frame rather than
where it was at creation — dragging OmniCore correctly carries the
whole star with it, confirmed directly.

Same instance-tracking pattern Galaxy established: keyed by
`systemInstanceId`, so multiple Star systems animate independently,
and deleting one correctly stops tracking only that one.
silhouette, not a smooth star shape. Two real modes named explicitly:
stationary, or rotating, and in both cases **the spike endpoints
themselves can move in random directions over time** — this is not a
static formation like the other five. It needs an actual per-frame
update loop driving spike-tip position, closer in kind to
OmniExpressionator's moving particles than to Cross/Ring/Sphere/Grid's
one-time placement.

### Which one actually scales better — confirmed, not just reasoned about

**Galaxy**, and this played out exactly as reasoned before it was
built. Cross, Ring, Sphere, and Grid all put one real `THREE.Mesh` on
every single node, so draw calls grow linearly with node count — a
256-node Sphere costs 256 draw calls, no way around it with that
architecture. Galaxy's hybrid split avoids that for its bulk content:
its particle field costs one draw call regardless of how dense it
looks, confirmed directly rather than assumed, using the same
`OmniExpressionator` engine already proven with the entrance effect —
only the small, user-chosen count of main nodes carries the normal
per-mesh cost. Single Spiral and Helix, if built as proposed, would be
exactly as expensive node-for-node as Ring already is; Star's cost is
a different axis entirely (a live animation loop, not draw-call count)
rather than being more or less scalable in the node-count sense.

## Node selector / fast-travel overlay

Not yet built — the other half of `OMNI_NODE_IDENTIFICATION_DESIGN.md`

## Shared geometry — a real memory fix, not just node size

Raised while investigating a mobile bug (screen going black/white
while the UI keeps working — `webglcontextlost`, already diagnosed
and logged in `scene/BaseScene.js`). Found: every node, regardless of
formation, was allocating its own fresh geometry even when many nodes
share the exact same shape — a maxed-out 256-node Sphere meant 256
separate copies of the same ~14KB geometry, not one shared copy.

Fixed in `data/NodeLoader.js` with a real, reference-counted shared
geometry cache — every node using the same geometry type (Box, Sphere,
whichever) now references one real instance. Reference-counted rather
than a permanent cache specifically so a shape nothing uses anymore
still gets freed, not held forever "just in case" — and specifically
NOT a naive "just share it," since that alone would mean deleting one
node sharing a shape disposes the geometry out from under every other
node still using it. Verified directly, not assumed: deleting one of
two systems sharing a geometry leaves the other's geometry completely
intact and still disposes correctly once it's genuinely the last
user; a real 10-node Grid system confirmed producing exactly one
shared geometry instance across all 10 meshes, not ten.

Disposal on delete was already correct before this fix (verified) —
this isn't a leak fix, it's a "simultaneously-allocated-at-once" fix,
which matters most on mobile GPUs with much smaller memory budgets
than desktop.

## Node size

Every OmniSystem-created node is half the size of its OmniDraw/hand-
placed equivalent (1 → 0.5) — easier on the OS as a whole, since a
single system can hold dozens of nodes at once, unlike a single hand-
placed one. This is a real, persistent property, not a one-time visual
tweak: `NodeLoader`'s entry animation now reads an optional
`data.scale` field (defaulting to 1 for every existing node, so
nothing else changed) rather than always tweening to a hardcoded 1 —
meaning the smaller size survives dehydration/re-hydration correctly,
not just the initial creation moment.

## Status

Eight formations now live in one Inspector — `ui/OmniSystemCreatorPanel.js`,
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
