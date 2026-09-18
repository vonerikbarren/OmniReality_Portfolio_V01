# OmniSense Dashboard & OmniRealityCell Creation Flow

Nothing built. Captured from a real design conversation. Builds
directly on the existing, real `ui/OmniStartHUD.js` shell (see
below) — this is proposed as the first real content for that shell,
not a new, separate quadrant system.

**Renamed from "OmniCell"** — that name is now freed up for a
genuinely different, new numerical/D3 node concept
(`core-systems/OMNIDRAW_MODES_DESIGN.md`). Chosen "OmniRealityCell"
over "OmniSenseCell" specifically because this concept is already
described below as "conceptually a voxel/stationary-reality" — this
matches the already-established "Stationary Reality" terminology
directly (`OMNISENSE_GLYPH_SYSTEM_DESIGN.md`), rather than tying the
name to which product's dashboard happens to create it.

## The dashboard shell — already real, not hypothetical

`ui/OmniStartHUD.js` already exists: four quadrant panels
(`CUIQ01`–`CUIQ04`, top-left/top-right/bottom-left/bottom-right),
toggled by Enter, explicitly built as an empty shell "for future
work." OmniSense's dashboard is proposed as the first real thing to
fill it — not a second, competing quadrant system.

**New constraint for OmniSense's use of it**: windows within a given
quadrant can be dragged and resized, but only within that quadrant's
own boundary — never crossing into a neighboring quadrant. Not yet
decided how a drag gesture should behave at the exact boundary edge
(hard stop vs. a soft resist) — real interaction-design decision,
not assumed here.

## Mobile — the open question, and a concrete recommendation

Four simultaneous quadrants doesn't survive a phone-sized screen —
each would be too small to use. Recommendation: on desktop, keep all
four visible at once, matching the existing shell exactly. On mobile,
show one quadrant at a time, full-screen, switched via a **bottom tab
bar** rather than a top ribbon — bottom tabs are the established
iOS/Android convention specifically because they sit within thumb
reach; a top ribbon is a desktop/Illustrator-era pattern that assumes
a mouse, not a thumb. Both a ribbon and buttons were raised as
options; this doc records bottom tabs as the concrete recommendation,
not a decision made unilaterally.

## OmniRealityCell creation flow

1. User creates a new OmniRealityCell (the working name for what's
   conceptually a voxel/stationary-reality) — this creates a box on
   the grid.
2. User defines the reality's own boundary. **Hard limit, for now**:
   must be a cube or square, matching the grid cell's own default
   stationary-reality size — no arbitrary shapes yet.
3. Once created, a second, smaller square appears on top of it,
   carrying a glyph — clicking this smaller square is how the user
   actually enters the reality (distinct from the cell's own primary
   symbol, which opens the option menu below, not entry itself).

## The Rubik's-cube radial option menu

Clicking a cell's primary symbol reveals smaller (but still legible)
option panels arranged around it — above, diagonal, left, right, and
below — each carrying its own glyph. Five named options were given,
matching five of the described positions exactly:

- **Enter** — the smaller glyph-square described above; travels into
  the reality.
- **Description** — its own Meta / Header / Body / Footer sections.
- **OmniData** — marked with the person's own personal glyph: a
  diamond with a dot inside it.
- **Astrolab/Cryptex (❖)** — opens the OmniCryptexLab 3D experience
  (`architecture/OMNICRYPTEXLAB_DESIGN.md`) for this specific reality —
  named directly as still needing to be built, not assumed done.
- **Edit** — modifies the cell/reality itself.

**A sixth option worth considering, not yet confirmed**: a direct
**Permissions/Access** option, tied to
`omniproducts/SYSTEM_ACCESS_OVERVIEW_DESIGN.md` and/or OmniPlayer's
own badge system (`omniproducts/OMNIPLAYER_BADGES_DESIGN.md`) — since
this is the dashboard actually creating and managing realities, a
direct way to set who can access or enter a given one seems like a
natural, currently-missing sixth face, given a cube has six.

## The Magnific Boards comparison — a real, useful distinction

Raised directly as a point of comparison: Magnific's own Boards
product is a free-form, AI-assisted canvas — Boards has its own
internal grid, but placement within it is otherwise unconstrained.
OmniRealityCell is deliberately the opposite: strictly cell-based, bounded,
discrete. This is worth keeping as a real distinction rather than
softening it — a bounded cell has a definite, knowable extent; a
free-form canvas doesn't, which cuts directly against OmniSense's own
purpose of eliminating ambiguity. The comparison is useful precisely
because of where the two systems diverge, not because they're similar.

## Mobile — 2D DOM, not a scaled-down 3D scene

Confirmed: mobile doesn't try to render the quadrant system in the 3D
scene at all. Instead, a separate 2D DOM panel — **OmniSense_SubMenu**
— slides out, and a reality is represented there as a scroll (tying
directly into OmniScroll, `OMNISENSE_GLYPH_SYSTEM_DESIGN.md`), showing
the grid's own dimensions. Sizing is responsive to the actual
available UI space on the device — "safe dimensions per pixel,"
computed from real available space rather than a fixed layout. This
is real, separate build work, not a CSS tweak to the desktop version.

**OmniSense Main Settings is the submenu's first slot.** Its first
setting: a toggle to blur the live 3D scene behind the DOM panel
while it has focus, framed as a performance measure.

**A real technical distinction worth flagging before this gets
built**: a CSS blur filter alone is a purely visual effect — the
scene underneath still renders in full detail every frame, so it
provides no actual GPU savings by itself, even though it looks like a
performance feature. If real performance benefit is the goal (not
just visual focus), the blur should be paired with an actual
reduction underneath it — lower render resolution and/or pausing
non-essential updates while the DOM panel has focus — since the blur
itself would hide the reduced fidelity anyway. Not yet decided which
of these to build; flagged here as the real choice.

## Permission/Access — confirmed as the sixth radial option

Confirmed directly, not just proposed. Ties to
`SYSTEM_ACCESS_OVERVIEW_DESIGN.md` and OmniPlayer's badge system
(`OMNIPLAYER_BADGES_DESIGN.md`). Real implementation work depends on
the dashboard itself existing first — there's no panel yet for this
option to live inside.

## Authentication via the Cryptex — a real, coherent extension

Raised directly: before interacting with a reality through the
dashboard panels, require a real credential — possibly the
OmniAddressCryptex itself (aligning rings correctly as the actual
unlock mechanism) and/or a typed password, potentially both, and
potentially multi-factor with one factor per symbol in a sequence.

This is a genuinely coherent extension of the Cryptex's own designed
purpose (`architecture/OMNICRYPTEXLAB_DESIGN.md`) — "having the
address isn't the same as having access" was already the Cryptex's
stated security philosophy; using the cryptex itself as the actual
unlock mechanism for a reality is that philosophy made functional,
not a new, separate idea bolted on. One real open question: on a
failed attempt, does the system give zero feedback at all (true to
the cryptex's own zero-knowledge framing — wrong is just wrong, no
hint which symbol was off), or some feedback short of that? Not
decided.

## Mobile's per-quadrant panels — a real, still-open problem

Tabs instead of quadrants was confirmed as the right mobile
approach — but a single quadrant can still hold more than one panel,
and those panels need their own arrangement even inside one, now
full-screen tab. Raised directly as needing "a move system." Real
options, not yet chosen between: simple vertical reordering (drag to
reorder in a list, not free 2D placement — the safer, more
mobile-native choice), a secondary sub-tab layer within a single
quadrant's tab, or constrained free dragging within that one
full-screen area (mirroring desktop's per-quadrant boundary, just at
phone scale). Not decided here.

## Cryptex failure feedback — resolved

An array of candidate messages, not one fixed string — "⟐ Access
Denied" chosen as the cleanest. Kept as a real array (not hardcoded
to this one string) since the actual wording may still change once
this is on screen.

## Mobile's per-quadrant panels — resolved: free movement

Confirmed directly, overriding the earlier "vertical reordering"
recommendation in this doc: free 2D movement within a single tab's
own space, not a constrained list. "Definitely a starter" — this is
real, wanted functionality, not a fallback.

## Passcryptx as its own separate panel

Confirmed: not a modal bolted onto the dashboard, but a dedicated
panel of its own, where the user dials or types the code. Real
sequencing note: the actual rotating-ring cryptex experience depends
on OmniCryptexLab existing first (`architecture/OMNICRYPTEXLAB_DESIGN.md`),
which is still unbuilt — this panel's first real version is likely a
simpler typed-code entry, with the true dial-based cryptex arriving
once that system exists.

## Spatial/sub-passwords — the memory-palace callback, document for later

A real, deliberately-not-yet-built idea: every main vertical category
should carry its own spatial location — arbitrary, user-defined — or
some other form of sub-password, layered under the main cryptex.
Crucially, **the user constructs this password themselves**, and that
construction work is the actual point: the effort of placing a
password's components somewhere specific is a real method-of-loci
exercise, done as a side effect of securing the system rather than as
a separate memory-training task. Named directly as "reverse
programming the user" — the system doesn't just protect a reality,
building its own security literally exercises the same memory
faculty this whole project was originally motivated to build a better
version of (`OMNISENSE_GLYPH_SYSTEM_DESIGN.md`'s founding lore). This
is the clearest example yet of the loci inspiration surfacing as an
actual mechanic rather than just a motivating story.

## Reality classification and default privacy

OmniReality Primitives — not yet classified or built — will define
objective structures a user picks from when creating a reality.
Confirmed policy, ahead of that classification existing: **personal
realities get a password by default**, not opt-in, specifically so a
visitor to someone's OS cannot reach a private reality without going
through real authentication. General realities remain the opt-in
case; personal ones are the exception.

## Status

Entirely conceptual, no code. Confirmed decisions: mobile uses tabs
and a 2D DOM submenu with free-movement panels within a tab; Permission/
Access is a real sixth radial option; passcryptx is its own dedicated
panel, starting simple (typed code) ahead of OmniCryptexLab existing;
personal realities are password-protected by default; the spatial/
sub-password memory-palace mechanic is real but explicitly deferred.
Still genuinely open: the quadrant-boundary drag constraint's exact
desktop behavior, and blur-vs-real-performance-reduction for the
mobile focus setting.
