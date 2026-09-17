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

## Per-ring types — the real, current default list

A config panel lets someone assign a type to each ring — what kind of
value that ring's layer actually requires. No fixed number of rings
assumed (matches OmniCryptexLab's own "generated on demand" nature),
but the available **types** are fixed, for now, to this list: Symbol,
Time (military format), Letter, Number, State, px, py, pz, typed
password. This is an explicit placeholder set — a fuller schema
worked out separately (with Copilot, previously) may replace or
extend it once it's recovered; not designed against that fuller
schema yet since it isn't in hand.

Notably, **px/py/pz being literal spatial coordinates** means a ring's
"password" can genuinely be a specific point in space, not just a
typed value — directly consistent with the multi-factor, per-symbol
security idea raised earlier, and a real, concrete link toward the
spatial/sub-password memory-palace mechanic already documented in
`OMNISENSE_DASHBOARD_DESIGN.md`.

## The marble-maze idea — documented, not built

Raised directly as future, fun complexity, not current scope: modeled
on the childhood silver-marble labyrinth toy — tilting a maze to guide
a ball to specific entry points before a code can even be attempted.
Layers security twice: reaching the entry point is its own spatial/
dexterity challenge, and knowing the code is the separate, second
challenge behind it. A real way to raise a node's security further in
the future, not part of the near-term build.

## Status

Purely conceptual, no code. Confirmed: OmniCryptx (this whole system)
is now sequenced ahead of the OmniSense dashboard, not after — its
passcryptx panel depends on this existing first. The 9-type ring list
and the OmniKryptx slider reuse are real, current decisions; a fuller
ring-type schema may replace them once recovered. No confirmation yet
of exactly how many taxonomy categories exist beyond Physical/
Digital/Logical, and the marble-maze idea remains explicitly deferred.
