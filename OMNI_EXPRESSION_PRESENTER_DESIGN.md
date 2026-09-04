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
