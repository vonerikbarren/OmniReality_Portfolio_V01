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
`Dev/Roles/Developer/BuildLog.md` V24 for the exact details and the
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

## Status

Purely conceptual mapping — no code changes from this doc. OmniHand
and Conscious Hand exist and render today but aren't wired to any
toggle functionality yet. For now, all layer visibility (including
Reality/InfiniteReality/OmniReality once built) lives in
OmniBrowserSpace's own settings panel, the only real toggle surface
that currently exists — matching the "for now" qualifier already used
for Reality's own definition. Migrating that control into Conscious
Hand and OmniHand specifically is real, intended future work, not
done here.
