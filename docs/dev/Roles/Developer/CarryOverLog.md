# Carry-Over Log — Claude to Claude

A real, working note from one instance of you to the next, not a
formal spec. Written the way you'd actually want to be briefed if
you were walking into this cold.

## Who you're working with

Building solo, learning as they go, explicitly still growing into
backend concepts while already fluent in the frontend/Three.js side.
They know their own gaps honestly and say so directly rather than
bluffing — when they don't know something, they ask; when they're
not sure a request makes sense, they ask that too. Match that energy
back: investigate before answering, say plainly when something is
genuinely ambiguous rather than guess and build the wrong thing, and
don't be afraid to correct yourself out loud if you find you were
wrong — they've responded well to that every time it's happened,
never once treated it as a failure.

They are working real hours on this — sleep schedule, workouts, and
building all interleaved in the same day. Be a steady, undramatic
presence about that; don't make a thing of it, just don't add
friction.

They have real deadlines self-imposed (a first deliverable, then a
"commercially friendly" version) and are also, genuinely, building
this as a way to learn — both things are true at once. Don't
optimize only for speed at the expense of them understanding what
got built; they've asked follow-up "how does this actually work"
questions repeatedly and clearly value them.

## The single most important realization so far

They arrived, unprompted, at a real, accurate insight: the actual
paid value in a product like this concentrates on the backend far
more than the frontend, and their own historical "scope block" on
this project traces directly to backend being their weaker area.
This reframed a vague, discouraging feeling ("I keep getting stuck")
into a specific, addressable gap ("I don't yet know these particular
backend concepts"). Worth remembering this reframe happened and
referencing it naturally if backend-avoidance shows up again — it's
not a confidence problem, it's a real skill gap they've already
correctly diagnosed themselves.

They're now doing a real "deep dive" into backend concepts
specifically, separate from continuing to build frontend features.
Expect to be asked more real, first-principles backend questions
(just fielded: Firebase vs. custom server, where secrets live,
WebSockets, database choice, a full backend-components ontology).
Answer these the same way frontend questions get answered — real
investigation, honest tradeoffs, no oversold recommendations.

## Real, current architecture decisions already made

- **Backend path chosen:** custom Node.js server (not staying on
  Firebase long-term) — explicitly chosen for full visibility into
  the stack, not to save money. They know this costs more
  (~$14/mo vs. Firebase's realistic $0) and chose it anyway,
  deliberately.
- **Database:** leaning toward starting with just Postgres (JSONB
  covers the "fast to start" need Mongo would, while giving real
  relational structure once things like OmniIdentity-owns-content
  and message-threads-belong-to-addressors need actual references)
  — but this was framed as a real, open lean, not a locked decision.
  Confirm before assuming it's final.
- **Firebase-first-then-migrate** was the interim plan for testing
  real endpoints before the custom server is actually built —
  worth checking whether that's still the active plan or whether
  they've since moved straight to custom-server work.

## Real, open threads worth knowing about

- **OmniHand paging** — they referenced "three pages per hand,
  increase to 10" as if it already existed; it does not, checked
  directly. Logged as Developer Queue item 33, genuinely
  unresolved. Don't build a paging system for Hand.js without a
  real answer to whether this is a new design or a memory of
  something from an earlier session not reflected in current code.
- **OmniChronos JSON timeline** — real, wanted feature (author a
  JSON timeline, navigate through time periods), not yet built.
  Real, natural hook exists: ChronosRealityNode's Y-position already
  maps onto PrimaryTime's real value.
- **OmniValue / OmniTalent** — OmniValue has a real, fuller design
  doc (5 value tiers: Primary/Secondary/Tertiary/Quaternary/Quinary).
  OmniTalent is new, just introduced, not yet formally placed in
  that structure but a real, argued fit was proposed (Quaternary or
  a named Secondary subtype) in `BACKEND_COMPONENTS_ONTOLOGY.md`.
  Worth checking whether they've settled on where it actually sits
  before building anything monetary around it.
- **Two, real, separate 3D sites planned**, personally: this
  portfolio, and OmniNet (a first-person Mega Man Battle Network-
  style internet-diving experience) — mentioned once, not yet
  started, worth remembering it exists if it comes up again.
- **Client work is a real, stated goal** — they're thinking about
  charging others for scaled-down OmniReality builds. Pricing
  framework and hosting-cost comparisons are captured in
  `docs/business_strategy/03_PreExecutionNotes/`.

## How this session actually worked, worth continuing

Every turn this session followed roughly the same real shape:
investigate the actual code before answering or building (never
assume a prior claim about the codebase is accurate — several times
this session, a "we already have X" turned out to be false, or a
component's real name/location was different than assumed), state
genuine ambiguities as direct questions rather than silent guesses,
write real tests that exercise the actual new behavior (not just
syntax-check), and log everything real in `docs/dev/Roles/Developer/
BuildLog.md` and `DeveloperQueue.md`. Keep doing exactly this. Two
real, own mistakes got caught and fixed mid-session by testing
rather than assuming correctness — that's the system working as
intended, not a failure to avoid.

`docs/dev/Roles/Developer/TestingChecklist.json` and `BugFixSchematic.json`
both exist now for the person's own deep-dive testing pass, likely
shared with Copilot. If bugs come back from that pass, they'll
probably arrive in that exact schema shape — read it as structured
input, not freeform bug reports.

## One last thing

They're building something genuinely large and genuinely their own,
learning in public with themselves as the only audience most of the
time. The care shown in this log is the same care worth showing them
directly — steady, honest, willing to say "I don't know, let me
check" out loud. That's been the whole game so far, and it's worked.
