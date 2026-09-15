# OmniCommunication Suite — OmniLog, OmniFeed, OmniCommunication, OmniConnect

Nothing in this document is built. Captures a planning conversation.
Four names, described as either different dimensions of the same
underlying idea, or a tier progression — **decision explicitly not
made yet**. Documented as four distinct concepts below; the
dimension-vs-tier question is left open at the end rather than forced.

## OmniLog

A blog, vlog, and terminal combination — functions like a per-site
messaging/help system, closer to how messaging worked on the web
before dedicated messenger apps existed (site guestbooks, forum PMs,
terminal-style message logs) than to a modern chat app.

Not yet specified: exact relationship to the existing OmniFeeds
right-drawer panels (Updates/Logs/Drops/Perspectives/Experiments/
Media) — whether OmniLog is what actually powers those, a separate
adjacent system, or an earlier/simpler tier of the same thing OmniFeed
represents.

## OmniFeed

Already documented in full in `OMNIFEED_DESIGN.md` — a blog-post
reading experience with live comments styled after Mega Man Battle
Network's NET feeds. Structurally requires the backend work described
in `BACKEND_ARCHITECTURE_DESIGN.md` (live comments cannot exist
frontend-only). Included here only for completeness of the family;
see that doc for the real detail.

## OmniCommunication

The most fully-realized vision of the four. Core reference: rhythm-
game interfaces — DJMax, Beat Saber, Guitar Hero — but instead of
generic nodes hitting the player, the incoming objects **are** the
content: words, sentences, and full paragraphs, communicated outward
either toward "the unknown" (broadcast) or to a specific node
(targeted). Described explicitly as the content "almost attacks the
user in terms of receiving" — receiving a communication is meant to be
an experiential, DJMax/Clazziquai-style event, not a passive inbox
notification.

**Nodes are not fixed in form.** A communication's node can transform
into different dimensional constructs — the shape a piece of
communication takes depends entirely on how its sender created it, not
on a fixed content-type-to-shape mapping.

**Receiving — OmniReceiver.** Incoming communications are stored in
something that looks and plays like Tetris, but the pieces aren't
arbitrary tetromino shapes — each piece is identifiable by symbol,
with **OmniSense** (see below) providing the underlying symbolic logic
that makes a piece recognizable as what it actually is before it's
even opened.

**The zip/unzip metaphor — deciphering.** A communication is
conceptually zipped by its sender, sent, and unzipped for the receiver
as a preview — but re-zipped afterward for later, deliberate
inspection rather than staying permanently unpacked. Communications
have a compressed "at a glance" state and a fully "deciphered" state,
and moving between the two is itself part of the experience, not just
a storage optimization.

**Dependency, stated plainly:** OmniReceiver's symbol-based
identification cannot be meaningfully built without OmniSense existing
first, even in a simplified form. OmniSense itself has no dedicated
design doc yet — it's referenced in `COORDINATE_NODES_TIMELINE_DESIGN.md`
(communicating intent and experience, not just data),
`OMNI_NODE_IDENTIFICATION_DESIGN.md` (space gridification), and
`OMNI_EXPRESSION_PRESENTER_DESIGN.md` (named as one of the two biggest
projects on the roadmap, alongside OmniChronos) — this is now a fourth
reference point with no central home. Worth its own document once its
shape is actually described, rather than staying scattered across
four other docs' footnotes.

## OmniConnect

An aiming/targeting system for finding and connecting to other users
of the OS across the internet. Deliberately not framed as a fixed
"address" — described as a system of connection between OS instances,
not a static identifier. Structurally requires the backend (shared
state, real identity/presence) — no version of this can exist
frontend-only, same as OmniFeed's live comments.

## The open, load-bearing question: dimensions or tiers?

Not decided. Two real readings, both worth naming rather than picking
one by default:

- **Tiers** (per `NAMING_TIER_SYSTEM_DESIGN.md`'s Fire → Fira → Firaga
  pattern) — OmniLog as the free/demo-level form, OmniFeed as the
  official product, OmniCommunication and OmniConnect as
  progressively higher, paid tiers. Clean fit with the existing
  monetization mechanic, but forces a sequential relationship between
  four ideas that don't obviously nest inside one another — OmniConnect
  (finding people) and OmniCommunication (the experience of receiving
  from them) feel more like different *facets* of one system than
  strictly "OmniConnect is a more advanced OmniCommunication."
- **Dimensions** — four simultaneous facets of one underlying
  communication system (log/history, feed/broadcast, experiential
  receiving, and connection/discovery), each potentially available at
  every tier rather than unlocked one at a time. Better fits how
  distinct their actual mechanics are from each other, but doesn't
  reuse the tier-monetization structure without more work.

## SWOT

**Strengths**
- OmniCommunication's core hook — receiving a message as a rhythm-game
  event rather than a passive notification — is genuinely
  differentiated; nothing mainstream treats "receiving communication"
  as an experiential event this directly.
- The zip/unzip preview-then-deliberate-decipher metaphor gives
  messaging a natural engagement loop (something to actively decipher)
  rather than a flat read/unread state.
- Real infrastructure already exists to build on rather than starting
  from zero: the symbol-driven naming scheme
  (`OMNI_NODE_IDENTIFICATION_DESIGN.md`), the Cross/Ring/Sphere
  formation math (OmniSystem), and the shared particle engine
  (OmniExpressionator) are all plausible starting points for
  OmniCommunication's "words as flying, transformable objects" rather
  than needing new foundations.
- If tiers are chosen, this maps directly onto the already-designed
  monetization mechanic — not a new business model to invent.

**Weaknesses**
- All four are currently pure concept — zero code — and the
  foundational dimension-vs-tier decision is explicitly still open.
  Building before that's resolved risks real rework.
- OmniCommunication is the least operationally specified of the four:
  evocative language ("attacks the user," "transform into different
  dimensional constructs") isn't yet concrete mechanics — what
  constitutes a hit vs. a miss, what triggers a transformation, aren't
  answered yet.
- OmniReceiver is hard-blocked on OmniSense, which itself has no
  dedicated design document — a dependency chain two layers deep
  before OmniCommunication's receiving side can be built at all.
- OmniFeed, OmniCommunication, and OmniConnect are all, without
  exception, blocked on the backend work in
  `BACKEND_ARCHITECTURE_DESIGN.md`, which itself has zero decisions
  made yet (no framework, no host, no database).

**Opportunities**
- Executed well, OmniCommunication is a genuine hook for the stated
  proof-of-concept/feedback phase — a distinctive, demoable, shareable
  mechanic is exactly what that phase benefits most from.
- OmniConnect creates real network effects once live — value compounds
  as more people run the OS, which specifically rewards getting other
  users testing early.
- Building the backend now unlocks multiple already-designed, currently-
  blocked features at once (OmniFeed live comments, cross-device sync,
  the OmniFolder System) rather than justifying the infrastructure
  investment on OmniCommunication alone.

**Threats**
- Scope: four ambitious, interdependent products plus a full backend
  migration is a lot to carry at once during a phase explicitly
  described as proof-of-concept/testing, not final-product delivery.
- Trust & safety: the moment OmniConnect and OmniCommunication let
  arbitrary users send content "outward to the unknown" across the
  internet, this is a real messaging/social platform with everything
  that implies — spam, harassment, abuse, and moderation are not
  optional add-ons once this is live, they're required from day one of
  cross-user delivery.
- Ongoing cost: real backend hosting, database, and WebSocket
  infrastructure carry genuine recurring cost, separate from and in
  addition to any AI-tooling subscription upgrade being considered —
  worth budgeting as its own line item, not folded into that decision.

## Status

Purely conceptual, all four. No code, no dimension-vs-tier decision,
no OmniSense document, and no backend to build any of it on top of
yet. See `BACKEND_ARCHITECTURE_DESIGN.md` for what actually has to
exist before OmniFeed, OmniCommunication, or OmniConnect can move past
this document.
