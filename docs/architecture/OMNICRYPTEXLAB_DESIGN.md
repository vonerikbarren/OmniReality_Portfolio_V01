# OmniCryptx — OmniCryptexLab / OmniAddressCryptex / OmniAddress

Nothing built. Four distinct things now, confirmed as a real
hierarchy, not four names for one idea:

- **OmniCryptx** — the parent product. The OS's actual security
  system — everything below belongs to it, not the reverse.
  Confirmed to be built **ahead of the dashboard/panel systems**
  (`OMNISENSE_DASHBOARD_DESIGN.md`), not after — the dashboard's own
  passcryptx panel depends on this existing first, not the other way
  around.
- **OmniCryptexLab** — the general tool, under OmniCryptx. Builds any
  nested-orbit structure: rings sharing one axis, each rotating
  independently, orbit size corresponding to position in the
  hierarchy (same pattern as the layer system's radius-by-depth,
  applied to rotation instead of static nesting). Targeting an item on
  one ring can reveal a new, smaller orbital system around that item
  specifically — a fractal structure, generated on demand as the user
  drills in, not built in advance. "Potentially infinite," not
  actually infinite — confirmed directly; the depth exists because
  it's generated the moment it's needed, not because infinite
  geometry is pre-built.
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

## OmniCryptx's own panel — vertical scrolls as the ring interface

OmniCryptx gets its own panel system, separate from whatever it's
protecting. Concretely: the panel shows the rings of the node/reality
currently being secured, and each ring's own vertical scroll is the
actual interface for setting that ring's value — interacting with a
given ring's scroll is what grants access to that one layer of
security, not the whole cryptex at once.

**A direct, real reuse opportunity**: this is structurally the same
interface already built for the OmniKryptx keyboard view
(`core-systems/OMNIKEYBOARD_DESIGN.md`) — vertical sliders, sections
extending outward. The keyboard's own vertical-slider widget is a
strong candidate to reuse directly here rather than building a second,
parallel vertical-scroll control.

## Per-ring types — a real hierarchy, not a flat list

Corrected from the earlier flat 9-item list: the symbol-based types
form their own real tier, above the basic value types, not equal
members of one list.

**The symbol tier, highest to lowest:**
- **MasterKeySymbol** — an AdminMasterKey, and a real, deliberate
  correction worth stating plainly: this is **not** a bypass or
  skeleton key. Having the correct MasterKeySymbol does not by itself
  grant access — it must still match the full stack alongside it: the
  string of keys/symbols/numbers, the location (px/py/pz), Music
  Notation (see below), and field-specific passwords the reality
  itself requires. MasterKeySymbol is a genuine failsafe factor,
  co-equal with everything else it's checked against, not a factor
  that outranks or overrides them. This is the same "having the
  address isn't the same as having access" philosophy the whole
  Cryptex was founded on, now proven to hold even at the admin tier —
  a leaked master key alone still isn't enough on its own.
  **Placeholder for now**: ⟐ (the project's own existing symbol),
  30 of them — real, distinct MasterKeySymbol glyphs to come later.
- **KeySymbol** — below MasterKeySymbol.
- **Symbol** — the general case.

Both KeySymbol and Symbol can be represented as a real **Unicode
symbol** or an **emoji**, specifically for memorability — someone
can actually recognize and recall an emoji in a way an arbitrary
generated glyph doesn't support. This is a direct, practical
extension of the "reverse programming the user" memory-palace
framing (`OMNISENSE_DASHBOARD_DESIGN.md`) — the building blocks of
the password are themselves made memorable, not just the act of
placing them. These symbols are also confirmed as genuine, literal
identifiers in their own right, not purely mnemonic decoration.

**The basic value types, alongside the symbol tier:** Time (military
format), Letter, Number, State, px, py, pz, typed password, and now
**Music Notation** — a real, new addition, not yet specified beyond
its name (what "matching" a music-notation factor actually requires
— a note, a chord, a short rhythm — isn't decided). Still an explicit
placeholder set overall — a fuller schema worked out separately (with
Copilot, previously) may replace or extend it once recovered.

Notably, **px/py/pz being literal spatial coordinates** means a
ring's "password" can genuinely be a specific point in space, not
just a typed value — directly consistent with the multi-factor,
per-symbol security idea raised earlier, and a real, concrete link
toward the spatial/sub-password memory-palace mechanic already
documented in `OMNISENSE_DASHBOARD_DESIGN.md`.

## The full authentication stack, layered

Confirmed as genuinely layered, not a single check: the ring sequence
itself (whichever types a given reality's rings use) sits underneath
**the user's own personal password**, on top of everything else —
authenticating fully means satisfying the ring stack *and* the
person's own separate password, not one or the other.

## Rings are pre-made, not built from scratch per node

OmniCryptexLab's panel already contains its vertical sliders,
pre-made — a real, ready-to-use library of ring configurations, not
something assembled fresh every time a node needs securing.

## Fixed vs. adjustable rings — the actual control/privacy mechanism

A real, load-bearing design decision: the platform owner authors
**Objective** ring configurations (tying directly into OmniReality
Primitives' own objective structures, `OMNISENSE_DASHBOARD_DESIGN.md`).
For any other visiting user, depending on which reality they're in,
some of that reality's ring sequences are **fixed** — locked by the
reality's own definition, not user-editable — while others remain
**adjustable**, left open for that visitor to set their own private
values on their own vertical wheels.

This is the actual mechanism for balancing platform control with
user privacy: fixed rings enforce whatever rules the reality's
creator needs enforced; adjustable rings are genuinely private to the
visitor, even from the platform's own objective structure. Not one
system with an exception — both halves are real, permanent parts of
how a ring behaves. Which specific rings are fixed vs. adjustable for
a given reality is set by that reality's own Objective definition, not
a global rule.

## The 30 MasterKeySymbols are the same 30 as the custom alphabet

Confirmed directly — not a coincidence. The 30 placeholder ⟐
MasterKeySymbols and the 30-letter custom alphabet (raised much
earlier, intended for the eventual Product-to-Tier mapping exercise,
`Dev/Roles/Developer/DeveloperQueue.md` item 9) are the same 30.
Should be scaffolded so one real system feeds the other later, not
built as two unrelated sets of 30 that happen to share a count.

## Music Notation — confirmed idea-only, deferred

Explicitly: just an idea for now, nothing more specified. What
"matching" a music-notation factor would actually require — a note,
a chord, a short rhythm — is not decided and not being designed
against yet.

## Three real tiers of OmniCryptx, not one

A direct answer to "where does entering a MasterKeySymbol actually
happen": OmniCryptx isn't a single panel — it's three distinct
tiers, each its own real surface:

- **AdminOmniCryptx** — where MasterKeySymbol entry actually lives;
  the admin-only tier.
- **StandardOmniCryptx** — the default tier; exact scope relative to
  Custom not yet fully specified, but understood as the platform's
  own baseline ring configuration, ahead of any personal
  customization.
- **CustomOmniCryptx** — the personal tier: what a user builds for
  their own OS, and what visitors to that specific OS actually
  encounter.

Not yet resolved: Standard's precise boundary against Custom. Not
blocking the ring geometry itself, though, since the core
nested-ring mechanic is tier-agnostic — Admin/Standard/Custom are
different configurations of the same underlying engine, not three
different engines.

## The marble-maze idea — documented, not built

Raised directly as future, fun complexity, not current scope: modeled
on the childhood silver-marble labyrinth toy — tilting a maze to guide
a ball to specific entry points before a code can even be attempted.
Layers security twice: reaching the entry point is its own spatial/
dexterity challenge, and knowing the code is the separate, second
challenge behind it. A real way to raise a node's security further in
the future, not part of the near-term build.

## Status

`modules/OmniCryptx.js` (the core ring engine) and OmniKryptx's own
sections (`ui/OmniKeys.js`) now genuinely share one source of truth —
`data/OmniCryptxTypes.js` — confirmed directly, not assumed (see
`Dev/Roles/Developer/BuildLog.md` V21–V22). Everything else remains
conceptual: the Admin/Standard/Custom tier configurations themselves,
MasterKeySymbol's real placeholder glyphs (⟐×30), Music Notation's
actual mechanic, and the marble-maze idea.
