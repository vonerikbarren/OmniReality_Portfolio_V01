# OmniChronos — The Time System

Nothing in this document is built beyond what's noted as already
real. Captured in full from a real design conversation, given
directly and precisely — this is substantial enough to lose if left
only in conversation, matching how OmniExpression/Master Tunnel and
other roadmap-scale systems have been treated.

## The core analogy — confirmed directly

OmniVision is perspective in general. **OmniChronos is that same
relationship, specifically for Time** — not a clock, a perspective
on time itself. Its stated core responsibility: showing discoverable
sequences, recursively — a sequence that can itself contain
sub-sequences, consistent with this whole project's existing
recursive philosophy (OmniCryptx's drill-in, OmniExpression's
"recursive in nature" expression-of-expressions).

## What already exists in real code

(V172 update: the panel is no longer small — see "V172 — player,
sequencer and the node Time property" below for what is now real.)

`ui/OmniChronos.js` — a real, working panel: the toggles
(Enabled, Z-axis mode, Transparency, Time Format) controlling `modules/RootSpace.js`'s vertical
tunnel, Admin-style staged save (now the SETTINGS tab of a larger window). Confirmed directly: **kept, not
replaced** — merged into the bigger vision below where it fits,
rather than scrapped.

## The Master Tunnel

A vertical tunnel, **clear and almost non-existent, but there** —
confirmed to be `RootSpace.js`'s own existing tunnel, reframed and
given this treatment, not a second, separate tunnel. **A clock sits
on its floor.**

**The clock's own construction, confirmed directly**: built using
OmniDraw(Jsonifier), or OmniCell if the underlying data turns out to
be genuinely numeric ("time functions"). Not a bespoke clock-widget
built from scratch — the exact same real systems already proven for
sales-by-product data, pointed at time data instead.

**Time functions are explicitly undefined for now** — a real,
acknowledged gap, not a decision being made prematurely. At launch,
these need to exist in some form; what they actually are is open.

## The ten sub-panels — "each controls the same system, differently"

Confirmed directly: not ten separate products. One real underlying
system, ten different control surfaces over it — the same real
separation already proven with OmniInspector/OmniCommunicationPanel/
OmniCellPanel, applied at a larger scale. Reached through a real
mode-picker matching OmniDraw's own, per explicit instruction.

1. **OmniChronos** — all the main, high-level settings. The natural
   home for the existing tunnel-toggle panel's own settings.
2. **OmniChronos-Dev** — dev tools for figuring things out with the
   system itself, not end-user facing.
3. **OmniTimeLive** — live real-world time data. Explicitly modeled
   on a specific reference: "the library" from Avatar: The Last
   Airbender, as a strong visual/conceptual reference point. Real
   API data, manipulated and visualized through D3 — the exact same
   real mechanism OmniCell already has, pointed at live data instead
   of static JSON.
4. **OmniTimeTool** — the real build tool: **concentric tunnels**
   for OmniTime, plus the nodes that go inside them. A genuinely new
   geometric pattern, not yet built anywhere in this project — every
   other tunnel so far has been a single tube, not nested rings.
   Needs a real, switchable default metric system (seconds/days/
   years, etc.) and every real geometry already in `GEOMETRY_DEFS`
   available, not just cylinders. GSAP for UI/UX transitions.
5. **OmniCalendar** — exactly what it sounds like, built from the
   previous tools: jump to any point in time, a normal calendar app's
   own interaction model, but 3D and higher-dimensional. GSAP-driven.
6. **OmniPlanner** — a Gantt-style tool: multiple projects across
   time, experienced spatially, not just read off a flat chart. GSAP-
   driven.
7. **OmniTimeLine** — named, not yet defined in detail. A real, open
   gap, not guessed at here.
8. **OmniTimeAxisBuilder** — named, not yet defined in detail. Same
   real gap.
9. **OmniStory** — like OmniPresenter, but able to work with charts/
   graphs/data directly, and manipulate real objects — glTF models
   and others — while presenting. More manager than pure presenter.
10. **OmniSeries** — named, not yet defined in detail. Same real gap.

**OmniBook(Time)** — raised alongside the ten, worth keeping
distinct: viewing several timelines of the *same* event from
separate perspectives, converging toward one single point — or,
differently, several distinct perspectives on the same underlying
story. Connects directly to OmniValue's own "the same trade means
something different to each of its two parties" reasoning and
OmniBrowserSpace's multi-layer philosophy — the same instinct,
applied to time specifically.

## The actual, stated end goal — the real first target

Given directly, and this is the one sentence that should anchor the
whole build order: **build a timeline, then use OmniDraw(Jsonifier),
then be able to correlate that time data against any node built
within that time path, or against another time path entirely.**

## The Y-axis, settled — and why the reference images disagreed

Two real reference images were given, and they turned out to use
genuinely different conventions from each other — one puts Time on
the vertical axis with Space diagonal; the other puts Time
horizontal, running through two light cones, with Space vertical.
That disagreement, not any lack of clarity, was the real source of
the "frustrating" back-and-forth on which axis to use.

**Settled: Y-axis**, for two real reasons — it matches what's
already built (`RootSpace.js`'s tunnel is already vertical), and the
first image's own convention (horizontal slices through a vertical
time-spine as "hypersurfaces of the present") maps directly onto a
literal 3D tunnel: each horizontal cross-section, at a given height,
*is* the hypersurface of the present — every node that exists "now,"
at that point in time.

**A real future refinement, not required for the first working
version**: the second image's light-cone shape — narrow at the
observer's current moment, widening toward past and future — kept as
the tunnel's eventual profile rather than a plain uniform cylinder.

## Natural time vs. manipulated time — a real, two-value model

Modeled directly on Breath of the Wild's Stasis: the world's own
clock never stops or reverses, but a specific object's own motion
can be rewound independent of it. A node's time position is
therefore never one value — it's two: a **natural** timestamp
(always advancing with the Master Tunnel's own global flow, never
paused or reversed) and a separate **manipulated** position (which
can be rewound, held, or pushed ahead, independent of the first).

**A real, direct connection worth keeping visible**: this is the
same shape as Desire vs. PrimaryForce, and as OmniValue's declared-
rate vs. actual-remainder. In each case, two numbers that usually
agree, and the *gap* between them — not either number alone — carries
the real information. A growing gap between a node's natural and
manipulated time is a genuine, honest tamper signal, not an assertion.

## Spiral/vortex — a second, separate geometric language, for routines specifically

Deliberately distinct from the Master Tunnel's own straight vertical
form, since "does this loop" and "where is this in linear time" are
different questions. A successful, repeating routine climbs as a
rising helix — loop and progress combined honestly in one shape. A
failing routine behaves like a real vortex — the word "swallowing"
is doing real work here, not just imagery: a failure actively pulls
in other nearby probable failures, the same way a real vortex draws
matter inward, rather than just being a negative number.

## The controller layer — primary time, then node time, then the data model

**Two real controllers, not one**: Primary Time (the Master Tunnel's
own global clock — play/pause/speed) and, separately, the time of
each individual node.

**"Creating a node locks it to the ruler"** — confirmed as a real,
enforced rule: OmniTime was already named "not a clock, a spatial
ruler." Every node, the moment it's created, is automatically
assigned a real time position on that ruler — never optional, the
same way every node already gets a real label and font.

**`TimeData`** — a real, standalone, referenceable thing in its own
right, not just a parameter bag: holds a node's natural and
manipulated timestamps together, in whichever display format is
active (military or AM/PM — both real options, not one replacing the
other).

**`perspectiveTime(object, TimeData)`** — a real function tying a
specific object to a specific TimeData *from* a specific perspective
— the concrete mechanism behind switching spaces along the X-axis
while Primary Time keeps playing on the Y-axis. Connects directly to
OmniBook(Time)'s own "several perspectives on the same event,
converging" idea — the X-axis is literally which perspective a node
is currently being viewed from.

## The large, traveling reality-node

When Primary Time plays, a real, large node — representing the
whole of space/reality that exists at that moment — travels through
the Master Tunnel, the hypersurface-of-the-present made into an
actual, textured object rather than staying an abstract slice. Any
texture, including video — and a video texture's own playback must
be genuinely correlated with Primary Time's own clock value, not
played back independently. Switching spaces (the X-axis) happens
concurrently with this, not as a separate mode that pauses it.

## Built and tested — the traveling reality-node and perspectiveTime

`modules/ChronosRealityNode.js` is the real, large node that travels
through the Master Tunnel as Primary Time plays — a structural part
of the tunnel system itself, deliberately not registered through
OmniNode's normal node-create-request path, the same way RootSpace's
own tunnel meshes aren't. Its Y-position loops once per real day
(86400 seconds) across the tunnel's own real floor-to-ceiling span —
tying naturally into the floor clock's own 24-hour read rather than
an arbitrary, disconnected cycle length. Confirmed and tested: starts
at the floor at time zero, reaches the real midpoint at exactly half
a day, and correctly loops back to the floor after a full day rather
than climbing past the ceiling.

Real, any-texture support, including video — confirmed and tested:
a video texture creates a genuine, muted `<video>` element with its
own native loop deliberately disabled, since Primary Time itself
drives the loop instead. The video's own playback position is kept
in real, direct correlation with Primary Time's current cycle
position, not left to play on its own native clock.

`utils/PerspectiveTime.js` is the real X-axis mechanism —
`perspectiveTime(object, TimeData)`, confirmed directly as the
concrete mechanism behind switching spaces on the X-axis while
Primary Time keeps playing on Y. Each named perspective gets a real,
stable X-offset slot, assigned once and never reassigned. Confirmed
and tested that `perspectiveTime()`'s own Y-mapping uses the exact
same day-cycle logic the traveling reality-node itself uses, so a
perspective's view of a given TimeData lines up with the real tunnel
height rather than a second, disconnected scale.

13 further checks, all passing — 41 total across the whole OmniChronos
build so far.

## Built and tested — the real first pass

`RootSpace.js` gained a real, toggleable, fully-reversible
transparency treatment — "clear and almost non-existent, but
there" — without touching the shared default `WallpaperSphere`/
`TerminalTunnel`/`VoidBoundary` also rely on. `utils/PrimaryTime.js`
is the real global clock: play/pause/speed, never reversing on its
own. `utils/TimeData.js` is the real natural/manipulated two-value
model, with military/AM-PM formatting verified against real edge
cases (midnight, noon). `utils/TimeDataRegistry.js` is the real
ruler — every node created via `systems/OmniNode.js` now genuinely
locks to it the instant it's created, anchored to Primary Time's
actual current value, and unlocks cleanly on deletion.
`ui/OmniChronos.js` now has a real, working Play/Pause button and a
live clock display, plus real Transparency and Time Format toggles
alongside the existing Enabled/Z-axis ones.

`modules/ChronosFloorClock.js` is the real floor clock — built
through OmniCell's own actual mechanism (a genuine chart-eligible
node, registered into the same shared `ChartDataRegistry` every
other OmniCell node uses), positioned at the tunnel's own real floor
position. Its directly-readable part is a live text label, updated
periodically rather than every frame — confirmed not to silently
reset a user's own chart-type or series-visibility choice on its
own periodic refresh.

28 checks total across both build passes, all passing.

## Real bug fixed — the Master Clock no longer hijacks the camera or Inspector

Every node creation unconditionally auto-selected itself
(`OmniNode.js`'s own `_createNode`), which two other systems key
off: `MovementPad.js` moves OrbitControls' own pivot to whatever was
just selected, and `OmniInspector.js` force-opens on selection. Since
the Master Clock creates itself once at real app startup, this
pinned the camera's orbit target to the clock permanently and forced
the Inspector open on load — neither of which makes sense for a
structural, non-user node.

Fixed with a real, optional `skipAutoSelect` flag on
`omni:node-create-request`, respected only when explicitly set —
every normal, user-created node's behavior is completely unaffected.
`ChronosFloorClock.js` now sets it. Verified directly, including the
critical regression check that a normal node with no flag still
auto-selects exactly as before.

## Real, requested next feature — JSON timeline navigation

Raised directly: the ability to author a real JSON timeline (named
events/periods with their own timestamps) and navigate through it —
not yet built. Confirmed real, current state: OmniChronos currently
only controls enabled/disabled, Z-axis reorientation, transparency,
and time format; there is no user-defined event/timeline concept
anywhere yet, just PrimaryTime's own continuous clock.

Real, natural hook already in place: ChronosRealityNode's own
Y-position already maps directly onto PrimaryTime's real value
(looping once per real day across the tunnel's real floor-to-ceiling
span) — a real JSON timeline would plausibly be a list of
`{ label, atSeconds, ... }` entries, each rendering as a real,
labeled marker at its own real Y-position along that same tunnel,
clickable to jump PrimaryTime directly to that moment. Not yet
scoped or built — deferred given the scale of everything else
addressed this same pass.

## Status

No code yet beyond the existing small tunnel-toggle panel. But the
real design is now settled enough to build against: Y-axis confirmed,
the natural/manipulated two-value time model defined, TimeData and
perspectiveTime named as real primitives, and the actual build order
agreed in conversation. See the build summary given alongside this
update for the concrete first-pass plan.

## Time axes — decision recorded 2026-10-06 (not built)

Z = position in time, Y = time flow, X = object (see
`docs/architecture/SCOPIC_STATES_DESIGN.md`). Recommendation on file: treat
flow as a control (speed with a reverse range) rather than a spatial axis,
and avoid bare X/Y/Z names in code because the existing vertical Master
Tunnel is already called "Z-axis mode". Spaces and OmniChronos are expected
to merge "to some degree": share the traversal component first.

## V172 — player, sequencer and the node Time property (built 2026-10-07)

Detail: `OMNICHRONOS_SEQUENCER_DESIGN.md`. Summary of what changed in the picture above:

**Now real**
- A **player**: `ui/OmniChronos.js` shows a Program Monitor (HH:MM:SS:FF timecode at 30 fps, the real clock in the saved military / AM-PM format, the traveller's height in the tunnel) with transport: to start, frame step back / forward, play / pause, to end, loop, speed 0.25x-8x, work-area in / out, add marker. The same controls exist in the ribbon (Realities > Chronos group) and work with the window closed.
- A **sequencer** (`ui/OmniTimelineView.js`, Premiere-like): tracks, clips of nodes, keyframes on node properties, playhead, markers, work area, snapping, trim / split / duplicate, zoom. Data in `utils/OmniTimeline.js`, evaluated against the scene by `systems/OmniTimelinePlayer.js`.
- **OmniTime is a property of a node**: the Inspector has a Time section (on timeline, track, start, duration, loop, keyframes). A node that has a clip is only present in the scene while the playhead is inside it. This is the first working version of "creating a node locks it to the ruler": it is opt-in per node (a node without a clip is never touched) and sits beside, not instead of, the automatic `TimeData` / `TimeDataRegistry` lock every node already has.
- **The playhead is Primary Time.** Seeking, stepping, scrubbing and playing the timeline move `PrimaryTime`; the floor clock and the travelling reality node follow because they already read it (neither was changed). Scrubbing pauses Primary Time and resumes it on release if it was playing; stepping pauses.
- The tunnel toggles (Enabled, Z-axis, Transparency) stay independent of the playhead.
- "Real, requested next feature — JSON timeline navigation" is partly met: markers (name, time) are a user-authored list that jumps the playhead. They are not yet drawn as labelled markers along the tunnel, and there is no JSON import / export.

**Still design only**
- The ten sub-panels (OmniChronos-Dev, TimeLive, TimeTool with concentric tunnels, Calendar, Planner, TimeLine, TimeAxisBuilder, Story, Series) and OmniBook(Time). The "OmniTimeLine" item overlaps with the sequencer's data; whether it becomes the same thing is undecided.
- Natural vs manipulated time per node (Stasis-style) is not exposed by the sequencer; clips and keyframes are in Primary Time only. `TimeData` is untouched.
- Recursive sequences (a clip containing a sequence), nested timelines.
- Time functions, the OmniDraw / OmniCell data on the floor clock, the light-cone profile.
- Video clips and video-texture sync driven by clips (the reality node's video sync still follows Primary Time directly).
- Audio, render / export, multi-camera, speed ramping, reverse play (Primary Time never reverses).
- Correlating time data (via OmniDraw(Jsonifier)) with nodes along a time path: the stated end goal; the timeline is the first piece of it ("build a timeline").

