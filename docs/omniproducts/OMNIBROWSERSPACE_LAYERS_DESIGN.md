# OmniBrowserSpace Layer System (Point / Core / Object / Class / Domain / Realm / Reality / InfiniteReality / OmniReality)

Built inside `modules/OmniBrowserSpace.js` and its settings panel.
Raised with a note that this might eventually get extracted into its
own OmniProduct — worth documenting clearly now, on that possibility,
not just as an implementation detail buried in one module. See
`architecture/HAND_TOGGLE_CONTROL_DESIGN.md` for the bigger picture
this connects to — which hands are meant to eventually control which
parts of this list.

## The nine layers

Nine layers total, moving outward "like the atmosphere." Object is
the original, pre-existing single shape (still driven by its own
long-standing color/alpha fields, unchanged). Every other layer is
the same geometry as Object — Grid, Sphere, whichever shape is
currently selected — just a different size, except Point, which gets
its own distinct treatment.

1. **Point** — literally the point of the whole reality. A small,
   solid marker (a tiny sphere), not a wireframe container like every
   other layer — "the point" reads as a location, not a space.
2. **Core** — the space of that point. Small, just inside Object's
   own size, first layer to use the normal wireframe-of-the-current-
   shape pattern.
3. **Object** — the original shape, unchanged.
4. **Class** — the class of that object.
5. **Domain** (roomSize) — the domain of classes.
6. **Realm** (fieldSize) — the realm of domains.
7. **Reality** (dimensionSize) — lands exactly on the pre-existing
   room-scale distance (25) rather than a second, separate number.
8. **InfiniteReality** — the realities within that reality.
9. **OmniReality** — ideally, literally the OmniProducts themselves
   and their tiers, kept deliberately simple rather than inventing a
   separate hierarchy alongside the real product list. Not wired to
   the actual product list yet — the layer exists and toggles, what
   it visually represents at this size is still just a boundary
   marker for now.

Sizes: Point 0.5, Core 2, Object 5 (unchanged), Class 10, Domain 15,
Realm 20, Reality 25, InfiniteReality 30, OmniReality 35.

## Real, independent, per-layer toggles — not one master switch

Every layer, including Object itself, now has its own visibility
toggle — real design-software-style layers, a genuine correction from
an earlier pass of this system where one shared "Room Scale" switch
gated four layers together. Room Scale still exists, but now only
controls the four face cubes' spread distance, completely decoupled
from layer visibility. Every layer defaults to hidden except Object,
which stays visible by default, matching how it's always behaved.

Each of the eight non-Object layers also has independent color and
alpha, same as before.

## Two real bugs found and fixed while building this pass

**Object's visibility could be silently overridden.** The existing
texture-slot logic (switching between wireframe and solid-textured
display) set visibility directly, without knowing about the new
Object toggle — meaning turning Object off, then changing textures,
would have silently turned it back on. Fixed by making
`_applyObjectVisibility()` the enforced final authority everywhere
visibility gets touched, called last, after any other logic that
also touches it.

**`_saveAll()` was missing three fields entirely.** This internal save
path (triggered by changing shape or applying a texture) never
included `roomScale`, `objectVisible`, or `layers` — meaning any
action that triggered it would have silently wiped a user's layer
toggles from storage on the very next save. Fixed to merge against
the full current persisted state rather than writing an incomplete
object over a complete one.

## What's still open

- OmniReality isn't actually wired to the real OmniProducts list yet
  — described as the intent, not yet built that way.
- Whether Reality/InfiniteReality/OmniReality specifically should
  eventually be controlled by Conscious Hand / OmniHand instead of
  this panel — real, intended future work, tracked in
  `HAND_TOGGLE_CONTROL_DESIGN.md`, not done here.
- Whether a future version lets each layer hold a genuinely different
  shape, not just a different size of the same one.

## Status

Built and verified directly, 21 checks: the full size progression
including Point's distinct marker treatment, every layer's
independent visibility toggle working with zero dependency on
Room Scale, both bug fixes confirmed (Object's visibility taking
correct final precedence, and shape changes no longer wiping stored
settings), and real persistence confirmed through an actual panel
checkbox and fresh reload — not assumed.
