# OmniCryptexLab / OmniAddressCryptex / OmniAddress

Nothing built. Three distinct things, confirmed as a real hierarchy,
not three names for one idea:

- **OmniCryptexLab** — the general tool. Builds any nested-orbit
  structure: rings sharing one axis, each rotating independently,
  orbit size corresponding to position in the hierarchy (same pattern
  as the layer system's radius-by-depth, applied to rotation instead
  of static nesting). Targeting an item on one ring can reveal a new,
  smaller orbital system around that item specifically — a fractal
  structure, generated on demand as the user drills in, not built in
  advance. "Potentially infinite," not actually infinite — confirmed
  directly; the depth exists because it's generated the moment it's
  needed, not because infinite geometry is pre-built.
- **OmniAddressCryptex** — one specific *form* of OmniCryptexLab,
  applied to addresses. Same general engine, one concrete use.
- **OmniAddress** — the actual addressing concept OmniAddressCryptex
  implements: a way to locate an exact reality regardless of what
  kind of reality it is — Physical, Digital, Logical, and whatever
  else the taxonomy grows to include.

## Why the geometry is the actual security, not decoration

Because OmniCryptexLab structures are nested and rotating, resolving
an address means correctly aligning rings nested inside rings — a
real cryptographic property wearing a visual metaphor, not the other
way around. Guessing wrong shouldn't just fail, it shouldn't reveal
anything about how close the guess was. This is confirmed as the
actual root of the OS's security system, not a themed lock icon.

## The standardized-metric problem, and the actual answer

Real problem, confirmed through direct research: different existing
scales (physical distance, digital/hash-space distance, logical/graph
distance) use fundamentally incompatible metrics — there is no
existing global one to just adopt.

The proposed fix: a **meta-metric**, built from Unicode symbols rather
than a numeric scale. This is the concrete answer to "what does
OmniSense actually do" — see below.

## OmniSense — now has a real, concrete definition

Four other docs referenced OmniSense before this conversation, none
of them able to say precisely what it *does*. This is the first time
it has one: **OmniSense controls symbols, and what those symbols grant
access to** — their meaning, and which realities/experiences they
resolve to. The Unicode-based meta-metric above isn't a separate
system OmniSense happens to relate to — it *is* what OmniSense is
for, stated directly. `OMNISENSE_DESIGN.md` should be treated as
superseded by this definition, not merely supplemented — its four
scattered prior references (intent/experience, space gridification,
biggest-roadmap-item, OmniReceiver's dependency) all resolve cleanly
under "symbol meaning and access," retroactively.

## What OmniAddressCryptex resolves, specifically

Both standard/canonical realities and non-standardized ones — nodes
made by the platform owner or by any given user — through the same
addressing mechanism. Also explicitly connected to the physical rings
on the OS's own landing floor (`modules/OmniPlatform.js`) — the
existing concentric rings are named directly as an example of the
same "repeating rings" concept this system formalizes, not a
coincidence of two unrelated ring ideas.

## The OOP question — a real, good instinct, not overreach

Asked directly, humbly: could this follow OOP standards. Yes,
genuinely — and it's the right instinct, not a stretch for where the
person's skill level is. Concretely: each ring/segment is naturally
one class (or one well-defined object shape) with its own state
(radius, rotation, contents) and behavior (spin, resolve, reveal-its-
children). Nesting is naturally composition — a ring *contains* rings,
the same relationship a folder contains folders. The
alignment/security check is naturally encapsulated — the rest of the
system asks "does this resolve," not "let me read your internal
rotation values and check myself." None of this requires senior-level
experience to get right; it requires exactly the instinct already
shown by asking the question.

## Status

Purely conceptual. No code, no data model, no confirmation of exactly
how many taxonomy categories exist beyond Physical/Digital/Logical.
