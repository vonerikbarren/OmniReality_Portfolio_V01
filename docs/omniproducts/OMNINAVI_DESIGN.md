# OmniNavi

Nothing in this document is built. Raised as a real, new concept —
an autonomous, in-scene entity, NPC-adjacent, partially inspired by
Mega Man Battle Network's Navi programs (the name is a direct
callback): programs that live inside the systems you jack into and
can be worked with via sequences, data, help actions.

This sits as a genuinely new, third layer alongside the existing two:
the core OmniTools, and the "website" aspect reachable from the
top-right Hand menu (itself a separate, same-night thread). OmniNavi
is specifically about interaction *programming* — entities with real,
if simple, autonomous logic of their own, not just static, placed
objects.

## Two real classes, confirmed named

- **Basic** — confirmed, concretely: a real starter program for
  users to work with. Runs simple programs, loops, displays things
  — exactly the simple, self-directed logic first proposed.
- **Intelligent** — confirmed as intentionally open-ended: "more
  complex programs than Basic," left loose on purpose as a tier for
  gradual complexity growth, not a fixed spec. The real, named
  destination past it is **OmniNavi(Conscious)** — a distinct,
  much-higher tier: an actual Mega-Man-style Navi with real
  personality. Confirmed as a separate, future tier, not something
  "Intelligent" itself needs to reach.

## Physical construction, confirmed — four real parts, not three

- **Head**: a cube mesh with a real, embedded panel inside it (the
  same real, already-proven CanvasTexture-plane technique already
  used by OmniLogPagesPanel and TerminalTunnel).
- **Body**: a sphere.
- **stateCommunicator**: a real, separate small sphere sitting above
  the head — not part of the cube. Does the real expression work,
  in two confirmed face forms: (1) simple — mouthless, dot eyes,
  body color conveying emotion (Sonic Adventure 2's Chao, directly
  named as the reference); (2) expressive — the same sphere
  transforming into symbol-shaped communication states (?, !, and
  similarly, per Chaos's own real transformation logic in that same
  game). Confirmed as its own real object, not a texture on the head.
- **Hands** (optional): smaller spheres, left to creative discretion.

## Naming — confirmed relationship

- **OmniNavi** — the real, product-facing identity. Confirmed: goes
  in the Left Drawer's own list ("the top left corner menu, all the
  OmniProducts"). What a user actually selects/experiences.
- **OmniProgram** — confirmed as both noun and verb: the real dev
  tool that builds the underlying program, and the program itself,
  as a noun. Confirmed as a real OmniDevTool, for OmniUser/Dev to
  work on — though a regular user can use it too, not gated to
  developers only. Confirmed real placement: Developer menu's own
  slot 2 (Dev02), sibling to OmniCommandTerminal at slot 1 (Dev01) —
  both the first two real items to land in that menu, which was
  built with an empty specialSlots, ready for exactly this.
- **OmniBotProgram** — confirmed precisely: a real *type* of program
  that OmniProgram Protocol can build, not simply a synonym for
  OmniNavi. The real chain: OmniProgram (the builder/protocol) →
  produces → OmniBotProgram (a program type, the technical
  classification) → experienced/displayed as → OmniNavi (the
  product-facing identity in the menu). Three real tiers, not two
  names for one thing.

## Architecture, confirmed

Still a real OmniNode — keeps the existing, shared node/selection/
Inspector/theming infrastructure everything else in this project
already uses — but with its own real update() actually doing
something every frame, which is the real, confirmed architectural
fork from a normal, static OmniNode.

## OmniScript — confirmed as the same, real testing language

OmniScript (the symbol-shorthand command language already proposed
for OmniCommandTerminal, Developer Queue item 26) is confirmed to be
OmniNavi's own real testing/sandbox language too — one real
language, two real use-contexts (driving the terminal, and testing
Basic/Intelligent Navi behavior), not two separate languages that
happen to rhyme. Confirmed development approach: no dedicated in-app
language editor needed yet — built and iterated on through real
version control (git) like any other real source, not a special
authoring tool. Flagged as wanted sooner rather than later, not a
someday idea.

## OmniTranslator as a real, live entity message thread

Confirmed real use, once sockets/multiplayer exist: Top (currently
"Notifications") carries incoming messages from another entity — an
in-scene program bot, or eventually another real user; Bottom
(currently "Tools") is where the person's own replies go, back and
forth, a real running thread. Confirmed this is additive, not a
repurposing: the existing vaults only ever held bookmarked
OmniDraw-element references (checked directly — no timestamped log
exists anywhere yet), so a real, separate, ordered
{sender, text, timestamp} log needs to sit alongside whatever's
already bookmarked in those same two vaults, not replace it.

## Real, confirmed answer — promotion into a bookmarkable item

A message CAN become a real, bookmarkable OmniNode — but only once
it has a real structure attached to it, not as a raw log line.
Confirmed real path: the message thread is serialized to JSON, run
through OmniDraw(Jsonifier) to become a real, structured node tree,
and *that* structured result is what gets bookmarked into the Left
or Right vault — never the raw message itself directly.

## Real message organization within Notifications (Top)

Confirmed structure, a common-sense real inbox shape: "Messages" is
one real notification *type* among others at the top level, not the
only thing Notifications ever holds. Within Messages, real
sub-grouping by **addressor** — each NPC/Bot (or, later, each real
user) gets its own real, separate thread, rather than every
incoming message merging into one undifferentiated log.

## Real, practical gap found before building — Dev01

OmniCommandTerminal, confirmed for Dev01, does not yet have a real,
openable panel anywhere — checked directly: only its own command-
language design doc and the separate TerminalTunnel visual exist,
no real execution logic or UI. Real, honest plan: build Dev02
(OmniProgram) for real now; leave Dev01 a real, labeled placeholder
rather than pretend a working tool sits behind it — giving
OmniCommandTerminal actual execution logic is its own, separate,
not-yet-started task.

## Status — first, real slice built (V121)

Built: OmniBotProgram (`systems/OmniBotProgram.js`) — the real
entity, spawned through the same, shared omni:node-create-request
pipeline, all four physical parts real (cube head + embedded
CanvasTexture panel, sphere body, stateCommunicator as its own
separate object with simple dot-eye face, optional hands not yet
added), Basic tier's real idle loop (bob + spin), Intelligent tier
intentionally left with no defined behavior yet. OmniProgram
(`ui/OmniProgramPanel.js`) — the real builder panel, wired to both
⟐OmniProgram (Developer menu, Dev02) and ⟐OmniNavi (Left Drawer) as
real, dual entry points into the same tool. Dev01 left a real,
honest, labeled placeholder — OmniCommandTerminal has no real panel
yet. 19 checks, all passing.

Deferred, not forgotten: OmniTranslator's own real message-thread
model (Top/Bottom as a live log, Messages as a notification type
with real addressor sub-grouping, promotion into a bookmarkable
Jsonifier-built structure) — a genuinely separate, substantial
build of its own, not started this pass.
