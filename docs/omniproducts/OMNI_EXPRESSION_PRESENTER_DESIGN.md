# OmniExpression — The Presenter Avatar & Three Circles

Captures the full conceptual vision. The foundation (see "Status" below)
is built inside `ui/OmniExpression.js`; everything else here is
documented for later, not implemented yet.

## Origin

This started as a proposal for a separate module ("OmniUser," then
"OmniPresenter"). `systems/OmniPresenter.js` already existed and does
something different (a node-sequence camera-touring "spatial
PowerPoint"), so rather than collide with that name, the whole concept
was folded into `OmniExpression` instead.

## The role framework — OmniUser vs. OmniPlayer

- **OmniPlayer** — anyone present inside a UserSpace/Reality. Everyone
  is an OmniPlayer.
- **OmniUser** — specifically, whoever's Reality it is: the Owner.
  Every OmniUser is also an OmniPlayer, but not the reverse.

Not built: any actual permissions, ownership, or access-control system
implementing this distinction. Right now it's a naming/conceptual
framework, not enforced anywhere in code.

## The three circles (per person)

Every OmniUser/OmniPlayer is meant to have three main circles behind
them, sized differently per person:

1. **Circle of Life**
2. **Circle of Time**
3. **Circle of Choice**

On top of those three, each person has three more, personalized ones —
for the original author's own example: gears, a solar system, and a
literal loop of something open-ended. As a person gains experience
("exp"), they can add even more circles beyond that.

Mechanically, these are simple: plain circles carrying a transparent
looping image or video, layered behind the main guide circle — not
separate interactive objects with their own modes or timelines. That
correction shaped the build below.

**The first circle, before the primary three** — the looped
video/image guide mesh representing the Owner, "a presenter through a
digital space." This is the avatar every backing circle sits behind.

Explicitly described as having deeper philosophical layers beyond the
mechanical structure, which the author intends to develop over time
rather than have prescribed now.

## What's built vs. not

### Built

- **The guide avatar** — a `THREE.CircleGeometry` mesh carrying a
  looped video or image texture (`_loadMedia`), sitting at the front
  of a shared group.
- **The three default backing circles** (Life/Time/Choice) — plain
  transparent circles, each independently carrying its own looped
  image or video, layered behind the avatar via increasing negative
  local-Z offset within the same group. Personal circles beyond the
  three can be added/edited/removed from the Inspector (`+ Add
  Circle`, per-circle media URL/type, delete) — the mechanism for
  "as a person gains exp they can add more" exists; the exp system
  gating *when* they're allowed to isn't (see below).
- **Everything moves together** — avatar and all backing circles are
  children of one `THREE.Group`; panel-mode camera-tracking, scene-
  mode positioning, and waypoint playback all move the group, so the
  whole stack travels and billboards as one unit. Verified in testing
  that backing-circle world positions actually move when the group
  does, not just the avatar.
- **Panel mode** — "stuck to the camera," positioned in screen space,
  recomputed every frame via unprojecting a screen-space point in
  front of the camera. Eight named lock points (center, tl, tr, l, r,
  bl, b, br) exist as quick presets — explicitly not a required order,
  not an exhaustive set; the avatar can sit anywhere on screen.
- **Scene mode** — detached, freely positioned anywhere in world
  space, independent of the camera.
- **The presentation/timeline layer** — the Owner records waypoints
  (mode + position + hold duration); playing animates the avatar
  (and everything behind it) through that sequence. Deliberately never
  touches the viewer's own camera or orbit controls — the "free will
  to look at the one presenting, or look at the scene" from the brief.
  Verified in testing that camera position/rotation stay untouched
  throughout playback.
- **Its own dedicated Inspector** (`OmniExpressionInspector.js`) — fine
  numeric position/radius editing, backing-circle management, and
  waypoint list management (hold duration, delete).

### Not built

- Per-user circle sizing based on... whatever the underlying metric
  ends up being (not specified) — right now sizing is a fixed
  `radiusScale` multiplier per circle, set manually, not derived from
  anything about the user.
- The exp system itself — earning it, what it unlocks, how many
  additional circles are available at what thresholds. The mechanism
  to add a circle exists; nothing gates it by earned exp.
- Any enforcement of the OmniUser/OmniPlayer role distinction (who can
  author a presentation vs. only experience one).
- Smooth interpolation across a *mode change* between two consecutive
  waypoints (panel → scene or vice versa) — currently an instant cut,
  since panel-space and world-space positions don't share a coordinate
  system to blend between.
- Any tie-in to the actual "exp" mechanic — the deeper philosophy
  behind why these three specific circles (life, time, choice) was
  described as intentionally left unelaborated for now.

## Phase — OmniExpressionVideoPlayer (agreed, not yet built)

A real gap found while planning this: `_mediaVideoEl`/`_backingMeshes`
already support real video (looping by default) for both the main
avatar and any backing circle — but there was no player UI at all,
nowhere to actually see a timeline or control playback.

Agreed shape:

- **`OmniExpressionVideoPlayer`** — its own dedicated panel, not an
  Inspector-style layout with a geometry-preview above it. A video
  doesn't have the "does this look right before I place it" question
  a geometry preview exists to answer — it's just playback. Reused the
  name directly: "literally what it is."
- Reached via a new Admin-style submenu wrapper on `⟐OmniExpression`
  (currently a flat drawer item — same conversion pattern already used
  for `⟐OmniBrowser`'s Window/Properties/Settings split).
- **Backing circle corrections, confirmed**: spacing stays at the
  existing 0.15 units between circles (closer was preferred, not
  farther — the earlier suggestion to widen it to 0.5 was wrong and
  reverted). Not a z-fighting risk at this scale, specifically because
  the avatar is meant to be viewed up close and the project's existing
  logarithmic depth buffer keeps precision healthy at that range.
- **Circles are image-only, never video** — explicitly corrected: even
  though the underlying mechanism technically supports video on a
  backing circle, the settings panel should never expose that as an
  option. Circles exist to give the avatar resonance and meaning, nothing more.
- **Alternating rotation** — circle index 0 spins clockwise, index 1
  counter-clockwise, index 2 clockwise, alternating with depth. Not
  built yet (no rotation logic exists on backing circles at all
  currently) — genuinely new work, not an extension of something
  already there.

## Phase — Timeline, Time Tunnel, Master Tunnel, OmniTime, OmniLayer

A much larger, deeper design thread — described directly as probably
the biggest project on the roadmap outside OmniChronos/OmniSense
themselves. Captured here in full since none of it exists in code yet
and it's substantial enough to lose if left only in conversation.

**The name "Expression" is not incidental.** OmniExpression is meant
to be a literal, digitally-manifested mathematical expression — spatial
and temporal choreography (GSAP-driven: attach to the scene, detach
into the UI, hold specific coordinates at specific times) that is
itself "recursive in nature" — an expression potentially made of other
expressions, nested, the way a real mathematical expression can
contain sub-expressions.

**Timeline** — the flat DOM authoring surface. A scrubber with
keyframes; where attach/detach/hold-here-at-this-time actually gets
set. Confirmed: "the line is for the DOM to affect the space."

**Time Tunnel** — the spatial counterpart to Timeline, specific to
OmniExpression. Same authored sequence, walkable in-world instead of
scrubbed on a flat bar.

**Master Tunnel** — the timeline itself, given spatial/geometric form,
general to the OmniTime/OmniChronos system (Time Tunnel is
OmniExpression's own instance of walking through it). The tunnel's own
geometry is a stencil/grid — scaffold for precise node placement, not
decoration. Its own dedicated panel, with a reusable wallpaper/texture
option (same slot-based pattern already proven twice — `WallpaperSphere`,
`OmniBrowserSpace` — a third application of existing infrastructure,
not new infrastructure).

**OmniTime** — not a clock. A **spatial ruler** — one instrument that
measures space, time, *and* perspective as the same kind of thing,
rather than three separate systems. The tool used to scrub through the
Master Tunnel and compute where a keyframe should actually sit,
according to a chosen curve/expression-type (see OmniLayer, below).
"Multi-shaped" — a literal shape vocabulary for different measuring
contexts, deliberately reusing the same curated primitive set already
established twice this session (Box, Cylinder, Torus, Sphere — see
`WallpaperSphere`'s `WALLPAPER_SHAPES`):

| Everyday concept | OmniTime shape |
|---|---|
| Coordinate grid | Box Geometry ("Universe") |
| A line | Cylinder ("Tunnel") |
| A loop | Torus ("continuous experience") |
| A space | Sphere |
| A container | Box/Cube |

These are wireframes the user works with directly, not fixed/hidden
geometry.

**The personal clock** — a literal clock standing beneath the
Observable User (the user) in the 3D scene, correlated with a clock in
the UI. This is very plausibly the concrete mechanism `OMNIVALUE_DESIGN.md`'s
sibling doc and the earlier OmniChronos principle ("each user
experiences the same reality on their own time") have been pointing
at all along, without previously having an actual implementation shape.
Worth treating as OmniChronos potentially becoming real here, not just
referenced again.

**"4D chess — new moments just for that moment"** — at any point along
the Master Tunnel, structurally the Tunnel can create its own branches.
Separately, but connected: all nodes should be able to click through to
another reality spatially — see `docs/omniproducts/OMNITRUTHS_DESIGN.md`
for where that thread was pulled all the way out into its own document.

**OmniLayer** — a spatial layer organizer. A curve type (linear,
sporadic, exponential, logarithmic — "I didn't choose the word
'expression' by accident") is not just an easing shape applied along
one path — it's a continuous motion *through different layers* while
executing its own mathematical form. Not yet resolved whether layers
are literal cross-sections/slices of the Master Tunnel itself, or fully
separate parallel tunnels a curve jumps between — asked directly, not
yet answered.

**Two open, load-bearing questions, unresolved:**

- Should this phase build a real (if simple) version of OmniTime now —
  or should the Master Tunnel get a temporary placement mechanism,
  with real OmniTime swapped in once OmniChronos itself exists? Not
  answered yet — worth resolving before starting, to avoid building a
  half-OmniTime that becomes the wrong foundation for the real one.
- Do the curve types map onto GSAP's own easing vocabulary under the
  hood, or is this a genuinely separate math system that GSAP simply
  animates the result of? Also not yet answered.

## A real tier candidate — OmniExpression as SingularNode, evolving toward SystemNode

Raised directly: the current, built OmniExpression is genuinely a
**SingularNode** system — one presenter avatar, not a multi-instance
system the way OmniSystem's Cross/Ring/Sphere formations are. That's
not a limitation to patch quietly; it's proposed as the natural
**Tier 1** of this product line under the existing
`NAMING_TIER_SYSTEM_DESIGN.md` convention (Fire → Fira → Firaga —
each name change backed by a real capability change, not a rebrand).

A future, higher tier — floated as landing somewhere around a
"Firaga-level" form — would evolve OmniExpression from one avatar into
a genuine **SystemNode**: multiple presenter avatars existing and
operating at once, each with its own mode/position/waypoint sequence,
rather than being limited to just one. Called out specifically as more
efficient for the user — someone presenting a complex space may
genuinely want more than one guide active simultaneously, not a
sequential handoff through a single avatar.

Not scoped or named beyond this. What tier number this lands at,
what the actual intermediate/final names are, and whether it
reuses OmniSystem's own Cross/Ring/Sphere formation math (an avatar
"system" could very plausibly sit on the same Group-Lock-driven
formation engine already built) or needs its own, separate mechanism
— all genuinely open. Recorded here specifically so the SingularNode
vs SystemNode distinction is a stated, deliberate design fact about
this product line going forward, not something to accidentally lose
track of.

### Presenter sizing and video fixes (this pass)

Clarified: "presenter panels" refers to this exact system — the
avatar plus three backing circles, not `systems/OmniPresenter.js`
(a genuinely different, unrelated system, per the note above).

**Radius progression tightened.** The old values (1.3 / 1.6 / 1.9)
made the outer circle nearly double the avatar's own size — the
real, direct cause of the stack looking spread out, independent of
depth spacing (which the group already correctly billboards toward
the camera for, confirmed by reading the actual code — no fix
needed there). Now 1.12 / 1.22 / 1.32, genuinely subtler at every
step, matching "slightly larger... not that much larger than the
video circle" repeated for each one. The additional-circle formula
(`1.3 + i * 0.3`) tightened to match (`1.12 + i * 0.1`).

**Real colorSpace bug fixed**, on all three texture-loading paths
(avatar video, avatar image, backing-circle image) — none of them
set `texture.colorSpace`, so three.js treated them as linear instead
of sRGB, washing them out under this project's own ACES tone
mapping. A concrete, well-grounded match for "looks white." Matches
the same, already-correct pattern `WallpaperSphere.js` uses.

**Alternating rotation** — confirmed already built and already
enabled by default (`circleRotation.enabled: true`), contrary to
this doc's own earlier "not built yet" note, which was stale. No
new work needed there; verified with a direct regression check.

9 checks, all passing.

### Status

Video player phase: agreed and scoped, not yet built. Everything from
Timeline onward: purely conceptual — no Timeline UI, no Time Tunnel, no
Master Tunnel, no OmniTime, and no OmniLayer exist in code. This is the
least-built, most-designed material in the whole project right now.
