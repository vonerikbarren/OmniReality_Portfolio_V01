# The Four Hands as Toggle Control Surfaces

Raised directly while building the OmniBrowserSpace layer system —
"this is the bigger picture" behind why layers need to be navigable,
not just visible. Captures a real architectural intent, not yet
built. See `omniproducts/OMNIBROWSERSPACE_LAYERS_DESIGN.md` for the
layer list itself; this doc is about what's meant to *control* it.

## The four hands already exist — this gives two of them a job

`ui/Hand.js` already defines and instantiates all four
(`createAllHands()`, called from `ui/index.js`, which `main.js` does
import — these genuinely render today):

| Hand | Corner | Current role label | Current padFunction |
|---|---|---|---|
| **⟐mni-Hand** (`omnihand`) | top-left | App Launcher | Switch axiomatic app |
| **⟐Conscious-Hand** (`conscious`) | top-right | Perspectives | Switch axiomatic spatial function |
| **Left-Hand** (`lh`) | bottom-left | Analytical | Global pad toggle |
| **Right-Hand** (`rh`) | bottom-right | Creative | (movement/tools) |

LH and RH are the two already doing real work this session — movement,
the radial tools menu, the mix-blend-mode legibility fix. OmniHand and
Conscious Hand exist, render, and occupy real screen corners, but
aren't yet wired to a real function. This doc is what that function is
meant to be.

*(Update, V158: the movement-pad half of that function is now real —
see "Design confirmed 2026-10-04 (dimensional axes)" at the bottom.
The Reality / OmniReality data these hands are meant to govern is
still unbuilt.)*

## The mapping — which hand governs which layers

**"The realm ends at the LH and RH."** The directly-visible layer
ladder — Point, Core, Object, Class, Domain, Realm — is what LH/RH's
existing tools already operate on. Nothing new needed here
conceptually; this is confirming a boundary, not adding one.

**Conscious Hand governs Reality and InfiniteReality.** Described
directly as "things that are there but cannot be seen" — dimensional
aspects, toggled on or off rather than rendered outright. Named, half-
joking and half-serious, as **ToggleMaster**: its actual job is
switching dimensional visibility, not spatial movement or creation.

**OmniHand governs OmniReality.** Described directly as, ideally,
*literally the OmniProducts themselves and their tiers* — kept
deliberately simple rather than inventing a separate concept: OmniHand
toggling OmniReality is meant to mean toggling which OmniProducts (and
which tier of each) are active/visible, not a new, separate hierarchy
alongside the real product list.

## LH / RH — confirmed meaning, and it already matches what's in the code

Stated directly: LH governs left-brained functions, RH governs
right-brained functions. Worth noting this isn't a new assignment —
it's a match to what `ui/Hand.js` already has on record: LH's own
`role` field is literally `'Analytical'`, RH's is literally
`'Creative'`. The conceptual naming and the actual code data agree
with each other already, which is a good, confirming sign rather
than something that needed reconciling.

## Grabbing a Reality — a real 4-tier ladder, not one mechanic

**Tier 1 is now real code**: `systems/OmniGrab.js` — grab, jitter,
drag toward a hand, condense into it only if that hand is genuinely
open, dispatch a real placement event. See
`docs/dev/Roles/Developer/BuildLog.md` V24 for the exact details and the
one real bug caught along the way. "Quick options without
navigating in" and the expand-vs-link branching described below are
not yet built — this is the grab-and-place mechanic specifically.

Confirmed directly as tiered, matching the same real-capability-jump
convention as `NAMING_TIER_SYSTEM_DESIGN.md` — each tier is a
genuine escalation, not a bigger number on the same thing.

**Tier 1** — the mechanic already described above: grab a reality,
get quick options without navigating in, branching on size into
expand-in-place or link-to-a-new-space. This is also the first
concrete point where OmniSense's own scope becomes load-bearing
rather than optional — see `omniproducts/OMNISENSE_DESIGN.md`.

**Tier 2** — reuses OmniExpression's own screen-to-scene mechanic
directly, not a new one: the same way that presenter avatar moves
between being stuck to the screen (panel mode) and placed freely in
world space (scene mode), a grabbed reality gets the same two modes
and the same zones. Confirmed as deliberately built on existing,
proven machinery (`OMNI_EXPRESSION_PRESENTER_DESIGN.md`) rather than
inventing a second, parallel positioning system.

**Tier 3** — mixed-location placement: putting a grabbed reality
between two hands (top+bottom, or left+right) gives it the *shared*
functions of whichever two hands it sits between, and — the concrete
part — standing in the middle lets you see all of them at once,
simultaneously. A real merged/combined view, not a switch between
them.

**Tier 4** — "probably some spatial aspects to it," stated directly
as not yet fully formed. Recorded as genuinely open rather than
guessed at.

Tiers 1 and 2 have a real, existing mechanism to build from
(the mechanic itself, and OmniExpression's screen/scene system,
respectively). Tiers 3 and 4 are conceptually real but not yet
mechanically specified — what "shared functions of the hands it's
between" actually means concretely, and what tier 4's spatial aspect
is, are both open.

## Conscious Hand and OmniHand — concrete functions, building on their existing roles

Both already have a `role` on record in `ui/Hand.js` (`'Perspectives'`
for Conscious Hand, `'App Launcher'` for OmniHand) — the functions
below are real elaborations of those, not replacements:

- **Conscious Hand** shows how many perspective-realities exist
  within the current reality, and what those perspectives actually
  are — a census, not just a toggle surface.
- **OmniHand** shows previews of the datasets currently in use, what
  tier of each OmniProduct is available, and how many OmniProducts in
  general are available for the current reality.

Neither is built. Both depend on real data (dataset references, tier
state, per-reality OmniProduct availability) that doesn't exist as a
structured, queryable thing yet — this is itself part of what
OmniSense's own scope would need to define.

## Axes, plural — a real, unresolved note, not a typo

Explicitly: there will be multiple **axes** of these toggleables, not
one flat list. Not specified further yet — how many axes, what
separates one axis from another, whether Reality/InfiniteReality's
axis is structurally different from OmniReality's. Recorded here so
it's a known, open dimension of this design rather than something
quietly collapsed into a single list the first time this gets built.

## Real bug fixed — "the nodes don't go to the hands"

Traced to a genuinely two-step, fiddly requirement: a hand only
became a valid drop target once its own hamburger menu was
separately opened (`dataset.handOpen`), and even then the grabbed
object had to be dragged precisely onto that hand's small screen
rectangle. Neither step was obvious, and missing either meant the
node always just snapped back.

Fixed with a real, direct, menu-driven alternative — confirmed as
the better UX going forward: `OmniGrab.js` gained `sendToHand(mesh,
handId)`, which condenses a mesh into a named hand's real screen
position immediately, regardless of that hand's own open/closed
state — the explicit menu choice itself is the permission now, not a
hand's visual state. `ToolTipMenu.js`'s Grab button now opens a real
4-option hand picker instead of starting a drag directly.

**The other real gap, found while building this**: once a node was
placed in a hand, its original position/scale were being cleared to
`null` the instant it was placed — there was no way to release it
back at all. Fixed with a real, persistent `_placedNodes` map that
survives across placements, and a new `releaseFromHand(nodeId)`
that genuinely restores it. `ToolTipMenu`'s menu now shows Release
instead of Grab for a node currently in a hand.

One real bug caught and fixed while building this, not left in:
`_renderHandPicker` replacing the menu's own `innerHTML` mid-click
detached the clicked button before the event finished bubbling to
`document`, causing the exact same "outside click closes what it
just opened" flicker already fixed once before in
`OmniDrawModePicker`. Applied the identical, proven guard.

12 checks, all passing.

## Design confirmed 2026-10-04 (dimensional axes)

Confirmed directly, and built in V158 (`systems/OmniDimensionalAxes.js`,
content in `data/OmniDimensionalAxes.js`). Supersedes V150/V151's
"mirror LH/RH" movement pads for the two top hands: **neither OmniHand
nor Conscious Hand moves the camera.** Their pads drive their own
dimensional axes instead. LH/RH are unchanged.

**Two axes per hand, separate from world XYZ.**

| | Conscious Hand | OmniHand |
|---|---|---|
| Symbol | **Δ** (Delta) | **⟐** |
| Primary axis (top-down) | 2 o'clock <-> 8 o'clock, through the world origin | 10 o'clock <-> 4 o'clock, through the world origin |
| Primary nodes | layers / perspectives / visors | the OmniProducts |
| Relative-Y axis (**Υ**, Upsilon) | **scale degrees** | **tier** of the product |
| Pad | left/right along the primary axis; up/down along the Υ axis | same |

- **Apple on a table.** A room of experts looks at one apple: a
  biologist, a teacher, an artist each have a different *view* of it.
  Those views are positions along Conscious Hand's primary axis. Its Υ
  axis changes *scale* instead: the apple on the table, then as an ant
  would see it, then cellular, molecular, atomic.
- **World-fixed, not camera-relative.** Top-down 12 o'clock = world
  −Z, 3 o'clock = +X. That is the project's own convention
  (`ui/MiniMap.js` draws world (x, z) at canvas (x, z) with north at
  the top; also three.js's default). The two diagonals therefore cross
  at 60°, an X but not a square one, as the clock numbers were given.
  `CLOCK` in the data file takes fractional hours (1.5/7.5 and 10.5/4.5
  for a perpendicular X).
- **Form.** Each primary axis is a large transparent *tunnel* (cylinder
  geometry) rendered as a grid, using the same line-grid technique as
  `modules/OmniFloor.js`, and kept smaller than the main context.
  Strung along it are *massive* translucent nodes, each nearly its own
  scene. They are deliberately huge so the whole structure stays
  bounded: the further from world zero, the buggier things get. The
  default data stays within ~790 units of the origin.
- **The nodes are containers for the reality's data.** That data layer
  does not exist yet. Today each massive node is a labeled container
  shape and nothing more.
- **Every position is also a state.** Per hand, `{primary, relative}`
  indices are clamped, tweened smoothly (gsap), persisted
  (`localStorage` key `omni:dimension-axes`), and announced with
  `omni:dimension-state`. The marker moves; the camera does not.
- **OmniHand** additionally staggers: the product nodes between the
  old and new position flash in travel order, and the tier ticks flash
  outward from the new tier. Conscious Hand has no stagger.
- **Visibility** of all axes is an option, default on: Admin slot 17
  (`DimensionalAxesSettings`), live via `omni:dimension-axes-visible-set`.

**Real vs placeholder (be honest about it):**

- *Real:* both tunnels, the massive container nodes, travelling
  markers, the Υ columns with tick rings, the readout, pad and key
  control, smooth tweening, state, persistence, events, the toggle.
- *Real data:* OmniHand's product names (OmniProducts from the ⟐mniMenu
  drawer that have design docs, plus OmniVision) and its 4-tier ladder
  (`NAMING_TIER_SYSTEM_DESIGN.md`; Tier 3's name is still undecided
  there).
- *Placeholder:* Conscious Hand's perspectives and scale degrees (seed
  set from the apple example; there is no perspective census yet), and
  everything the massive nodes are supposed to contain.

## Status

OmniHand and Conscious Hand are wired: their pads (and Numpad keys)
drive the dimensional axes described above; they no longer move the
camera. The axis geometry, navigation, state and persistence are real.
What remains unbuilt is the data they are meant to govern: real data
inside the massive nodes, a real perspective census for Conscious
Hand, and real per-product tier data for OmniHand (tracked in
`docs/dev/Roles/Developer/DeveloperQueue.md`). Migrating the layer
visibility toggles from OmniBrowserSpace's settings panel into these
hands is still future work. LH and RH are unchanged.
