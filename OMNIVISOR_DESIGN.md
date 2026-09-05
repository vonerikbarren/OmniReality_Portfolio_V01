# OmniVisor / OmniPerspective — Design Doc

Nothing in this doc is built yet. This captures the philosophy and the
first concrete build target (OmniInspection) before any code exists,
the same way OMNIKEYBOARD_DESIGN.md and DIMENSIONAL_TEXT_DESIGN.md
worked for their systems — a real spec to build against, not a summary
of something already shipped.

## Origin — four reference mechanics, not one

OmniVisor comes from naming what four different game companions
actually do differently, even though on the surface they all just
"give the player information":

1. **Perception-gating** (Metroid Prime's Scan/Thermal/X-Ray Visor,
   Chozo Ghosts). Some things don't just become *clearer* with the
   right visor — they don't exist to you at all without it. A stronger
   claim than filtering: presence/absence, not clarity.
2. **Interaction-gating, independent of perception** (needing the
   right beam in Metroid, separate from being able to see the target).
   Can-perceive and can-affect are two different unlocks, not one.
3. **The feedback channel itself changes, not just the content**
   (Navi = color changes, Fi = sound + probability readouts, Wolf
   Sense = spatial scent-trails with path/type data). The same
   underlying job — "tell the player something important" — expressed
   through entirely different senses depending on which companion.
4. **The companion evolves and grants new capability, not just informs**
   (Midna). A HUD overlay stays static; a companion that transforms
   changes what you can *do*, not just what you can *see*.

Compressed: **OmniVisor is a family of distinct perceptual/interactive
states, each with its own gate, its own feedback modality, and its own
capacity to change the user, not just inform them** — not one tool
that reskins the same data.

## OmniInspection — the first concrete build target

`systems/OmniInspector.js` is the starting node. OmniPerspective/
OmniVisor becomes a *dimensional opening* of that same Inspector,
through a process called **inspection** — an active state entered, not
a panel opened. Same underlying object data; a different way of
standing in relation to it.

### Shape

- **Lens**: a layered (concentric) circle, not Metroid Prime's square
  reticle — the layering is itself meaningful, a visual echo of
  "layers of reality," not just a different outline shape.
- **The perimeter is a literal 3D wireframe grid, not a screen-space
  shape.** The real-world reference: tiles on the ground are already
  everywhere, in some form — this takes that familiar construct and
  "dimensionalizes" it out to whatever distance inspection needs.
  Concretely: a circular, concentric-ringed wireframe grid appears on
  the ground, temporarily, centered where inspection was activated.
  Only objects within that ground-radius are in scope. This settles
  the earlier open question (screen-space vs. world-space) — it's
  world-space, anchored to the ground, not the camera's view.
- **Four quadrants**, mirroring the hand system and `OmniStartHUD`'s
  own quadrant layout (deliberate reuse of an existing mental model,
  not a new one):
  - **Cosmic** — how many layers of OmniRealities are present; a data
    overview at that scale.
  - **Metaphysical** — how many "languages" are viewable, and to what
    extent, in correlation to objectiveness. Explicitly fuzzy — flagged
    as such by design, not resolved yet.
  - **Physical / Dimensional constructs** — position, rotation, scale,
    material, geometry. Maps directly onto data that already exists on
    every node today.
  - **Senses / Experiential** — color, emotion-adjacent data, felt
    qualities of the object. Partially mappable onto existing
    color/appearance data now.

### Scope call for a first pass

Cosmic and Metaphysical don't have real data behind them yet — "how
many layers of OmniRealities" requires OmniRealities-as-countable-
layers to exist somewhere, and "objectiveness correlation" doesn't
have a defined value at all. Physical/Dimensional and Senses/
Experiential do, mostly, already.

Recommended first-pass scope: build all four quadrants' UI shape (so
the whole idea is visible at once), but only wire real data into
Physical/Dimensional and Senses/Experiential. Cosmic and Metaphysical
should render an honest "not yet defined" state rather than fabricated
numbers — same principle as Dimensional Text's honest gaps, or
OmniKeys' Cosmic/Metaphysical-style deferred sections elsewhere.

## Data type theory — previewed, not yet explained

Named ahead of the full explanation, since the names themselves carry
a partial preview of their own meaning: **TruthData, FalseData,
UndefinedData, SpectrumData, RealityCapacityData.** This is almost
certainly what Cosmic and Metaphysical actually resolve into once
worked out — noted here so it isn't lost, not defined here since it
hasn't been explained yet.

## Perception-gating — explicitly deferred

Per direct request: **an additional feature, not part of the first
build.** The Chozo-ghost mechanic (invisible without the right
lens/axiom active) is real and wanted, but v1 of OmniInspection should
get one lens fully working and honest before anything is made
invisible without it. Revisit once the base inspection experience is
proven.

Open questions for whenever this gets built:
- Does gating apply per-quadrant (e.g. Cosmic data invisible without a
  "Cosmic lens" active) or per-object (some nodes simply don't
  register in the visor at all without the right axiom)?
- Is there a visible indicator that something is being gated — some
  sign "there's more here you can't see yet" — or is it truly silent
  absence, the way Chozo Ghosts give no hint they exist at all?

## Aesthetic note — ring VFX (optional timing, noted for later or now)

Rings emanating from the user's position on the ground when a
perspective/lens is selected, with a temporary grid appearing, and the
rings pulsing *into* that grid. Connects back to the original
center-ring visual from early in this project. Purely aesthetic —
buildable now or later, no functional dependency either way.

## Status

- **Everything in this document**: designed, not built. No code exists
  for OmniInspection, lens-perimeter detection, quadrant data display,
  perception-gating, or the ring VFX yet.
- **What already exists that this can build on**: `OmniInspector`'s
  underlying node data (position/rotation/scale/material/color),
  `OmniStartHUD`'s quadrant chrome and center-preview pattern, the
  hand system's four-way structural layout, and `OmniNode`'s
  parent/child genealogy (a candidate source for "layers" in the
  Cosmic quadrant later).
