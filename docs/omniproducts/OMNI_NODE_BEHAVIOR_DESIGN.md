# OmniDraw(BehaviorNode) and NodeBehavior — design (V164)

Status: built and tested headlessly (node + jsdom + three). **Never seen
rendered in a real browser.**

## What it is

A new OmniDraw mode, **BehaviorNode**, creates a node that carries a
*behaviour* from the NodeBehaviorPackage and animates real nodes in the
scene. "Can you create animations for these?" — yes, for all 34
behaviours (32 from Copilot's package + the user's Leader and Follower),
in two honest tiers.

## The package

`data/NodeBehaviorPackage.json` — Copilot's "NodeBehaviorPackage" 1.0.0,
copied verbatim, plus `Leader` and `Follower` (Relational) marked
`"source":"user"`. `behavior_count` is **34**: the pasted list actually
contains 32 behaviours (6 Mechanic, 7 Relational, 8 Transformational,
5 Temporal, 6 Emergent) even though the header said 30; with the two
user entries that is 34.

## Using it

1. Drawer ⟐OmniDraw → the mode grid → **BehaviorNode** tile
   (opens `⟐OmniDraw(BehaviorNode)`, nav label `⟐OmniDrawBehavior`).
2. Pick a behaviour from the grid (class header rows: Mechanic, Relational,
   Transformational, Temporal, Emergent; tooltip = the package summary;
   "≈" marks Tier B).
3. Adjust parameters (form generated from the table), choose targets:
   a dropdown of existing nodes **or** "Pick in scene" (while armed, each
   `omni:node-selected` adds that node).
4. **Create NodeBehavior** → an ordinary `omni:node-create-request` with
   `isBehaviorNode: true, behavior: {…}`; an octahedron in the behaviour's
   class colour appears in front of the camera, with a class-coloured ring
   marker the engine draws around it. It starts about a second after it
   appears (the node's scale-in animation finishes first).

Any node (OmniNode- or NodeLoader-owned) can also get/edit/remove a
behaviour in the Inspector's **Behavior** section (type, enabled toggle,
parameters, targets, Remove).

## Model

`data.behavior = { type, params, enabled, targets: [nodeId…], role }`.
The node carrying it is the **host**. Conventions (also shown as the hint
text in the UI): Orbit/Follow/Anchor/Align/Mirror/Bind/Delay/Adapt move or
turn the **host** relative to `targets[0]`; Attract/Repel/Leader/Coalesce/
Diffuse/Compete/Cooperate/Emerge/Cascade/Traverse/Sync act on the **host and/or
targets**. With no targets, Drift/Oscillate/Pulse/Schedule act on the host
alone, and Attract/Repel/Diffuse act on nearby nodes (capped at 32).

## Tier A — real motion

All of these move/turn/scale real nodes with per-frame `update(delta)`
(delta clamped to 50 ms), no per-frame allocation in the hot paths, and
restore the node's saved transform on stop (`restore` param, default on).

| Behaviour | Class | What it does |
|---|---|---|
| Orbit | Mechanic | host revolves around target (or its rest spot): radius, speed, axis, tilt, phase |
| Drift | Mechanic | smooth noise wander about the rest spot, bounded by range |
| Anchor | Mechanic | spring-holds an offset from the target frame (optionally rotated with it) |
| Align | Mechanic | slerps to match the target's orientation, or to face it |
| Traverse | Mechanic | moves along a path through the targets (or a square); loop / pingpong / once; path is drawn |
| Oscillate | Mechanic | sine / triangle / soft-square swing on an axis, bounded by amplitude |
| Attract | Relational | pulls targets toward the host: influence radius, falloff, softening, stop distance, max speed, drag, bound sphere |
| Repel | Relational | same field, pushing away; clamped so nothing explodes |
| Follow | Relational | pursuit with arrive/damping, settles at the follow distance |
| Follower | Relational | declared follower — the same code as Follow, role `Follower` |
| Leader | Relational | wanders a smooth Lissajous path; targets are followers that hold a line / vee / ring formation behind it |
| Mirror | Relational | copies the target across an x/y/z plane (+offset); inverted = also conjugated rotation; optional scale copy |
| Bind | Relational | spring tether, drawn as a line; optional mutual pull |
| Delay | Temporal | echo: replays the target's path shifted by `delay` s (ring buffer, ≤ 8 s) |
| Pulse | Temporal | periodic ring pulse + `omni:node-behavior-pulse` |
| Schedule | Temporal | countdown arc, fires pulse/flash/event on an interval |
| Cascade | Temporal | a pulse hops host → target 1 → target 2 …, each flashing and re-emitting; `omni:node-behavior-cascade-hit` |
| Sync | Temporal | host and targets bob as oscillators and phase-lock (Kuramoto) |
| Coalesce | Emergent | drift to the centroid and merge scale-wise (host grows, absorbed shrink) |
| Diffuse | Emergent | expanding ring tints and nudges nodes it passes; they spring back |
| Compete | Emergent | targets race to the host's position; winner takes it and grows, losers shrink; rounds repeat |
| Cooperate | Emergent | targets take even slots on a ring and equalise size |
| Adapt | Emergent | orbit whose radius adapts by feedback against a disturbance; goal ring vs live-parameter ring |
| Emerge | Emergent | boids (separation/alignment/cohesion) among the targets around the host |

## Tier B — signal metaphor (not computation)

There is **no signal/data layer** in the project. So Transform, Amplify,
Dampen, Filter, Encode, Decode, Store, Release, Gate and Mediate animate
"beads" travelling along tethers: source (first target, else a virtual
point left of the host) → host → sink (second target, else a point right).
They illustrate the idea (colour/shape change, grow, shrink, colour filter,
sphere→cube, cube→sphere, a filling level ring, a stock released one at a
time, an open/closed paddle, a rate-metered queue). They compute nothing
and move no nodes. The UI says so ("≈", "METAPHOR"). If a real signal
layer arrives, replace the `arrive`/`tick` functions of these rows.

## Persistence (both registries)

The project has two node registries (OmniNode `_nodes`, NodeLoader
`_registry`); the engine never reads either. It learns nodes from
`omni:node-created` / `omni:node-restored` / `omni:node-deleted` /
`omni:nodes-updated`, plus a scene scan for `userData.nodeId`. It persists
config through the same event the Inspector's Auto-Rotate uses,
`omni:node-rotation-automation-set { id, behavior }`, which OmniNode (`_save`)
and NodeLoader (`_updateStoredNode`) already merge and save. Supporting
edits: OmniNode's `omni:node-create-request` now carries `isBehaviorNode`
and `behavior`; `_duplicateNode` deep-copies the config; NodeLoader also
answers `omni:nodes-request` (so a system that starts after the loader
hydrated its restored nodes can still learn their data).

The saved position stays the **rest** position: while a behaviour moves a
node the engine publishes `mesh.userData.restPosition`, and OmniNode `_save`
writes that instead of the animated position.

## Events

In: `omni:node-behavior-set {nodeId, behavior|null}`,
`omni:node-behavior-master-set {enabled}`. Out: `omni:node-behavior-changed`,
`-master-changed`, `-pulse`, `-cascade-hit`, `-event` (Compete winner),
`-capped`, `-error`.

## Safety

At most 64 behaviours run (the rest wait for a slot; `-capped` event), 256
beads, 12 000 line segments per frame. Nothing runs while the tab is hidden.
Grabbed (OmniGrab), hidden, or `userData.behaviorLocked` nodes are never
moved. A node already moved by another behaviour this frame is skipped
(first wins). A throwing behaviour is stopped and reported, not retried.
Master toggle stops everything (restoring nodes) and keeps configs.

## Adding a behaviour

Add one `def('Name', 'Class', 'A'|'B', { defaults, schema, init?, update })`
row in `systems/OmniNodeBehavior.js` and add the name/summary to
`data/NodeBehaviorPackage.json`. The OmniDraw grid, the parameter form and
the Inspector select are all generated from the table.

## Hand tunnels (same build)

`opacityScale: 1.3` on the `conscious` and `omnihand` tunnel defs
(`data/OmniAxinatorData.js`), applied to body and grid opacity
(`systems/OmniAxinator.js`, clamped to 1): body 0.10→0.13, grid 0.62→0.806.
"Lower the transparency by 30%" was read literally (30% more opaque). If
more see-through was meant, set `opacityScale: 0.7` on those two defs.

## Not built / known limits

- Tier B is a metaphor (above). No real signal routing or data.
- Positions are `mesh.position` in scene coordinates: nodes inside an
  entered space (parented) are not handled specially.
- Edges drawn by OmniNode to a moving node are not rebuilt per frame (they
  are baked cylinders), so they lag until the next edit.
- One behaviour per node. Chaining = nodes targeting nodes.
- A node edited by hand (Inspector position, OmniGrab drop) while a
  behaviour owns it snaps back to the behaviour's rest pose on stop.
- Restore snaps (no ease-out); start eases in over 0.6 s.
- "Pick in scene" depends on clicking selecting nodes in the current mode;
  the dropdown always works.

## V165: hand-fired behaviours (ammo)

`data.behavior` may carry an optional `source` string. Absent = user-authored (OmniDraw / Inspector).
`'hand:lh'` / `'hand:rh'` = fired by that hand's Activation button (`systems/OmniHandAmmo.js`, see
`docs/omniproducts/OMNIHANDS_DESIGN.md`). `normalizeBehavior` passes it through unchanged; the engine
ignores it. The hands never overwrite a behaviour that has no `source`.
