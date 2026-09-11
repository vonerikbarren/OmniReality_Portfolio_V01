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

## Status

Purely conceptual. No layouts, no node collection/indexing system, and
no panels exist yet.
