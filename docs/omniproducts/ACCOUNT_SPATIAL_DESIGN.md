# Account Spatial Design — Login, Profiles (Identities), Dashboard

Design conversation, documented per direction before deciding what
to prototype first. Goal stated directly and kept as the unifying
principle across all three: "create a spatial experience for what
they interact with on the DOM" — these three flat panels becoming
genuine 3D interactions, not 2D forms floating in space.

## Profiles (Identities) — the rotating carousel

Clicking Profile takes the camera to a dedicated root point in
space, not just opening a flat panel. A torus ring around a
cylinder, 8 vertical panels arranged radially around it (leaning 8
over 10 — divides evenly into 45° increments, and RadialMenu's own
proven pages already settle on 5 items as this project's comfortable
number for a circular arrangement; panels are bigger than icons, so
8 keeps real breathing room without crowding). Each panel gets its
own Jsonifier-driven data node above or below it — a real preview
plus real data about that identity, admin's own or a guest's.
"Vertical rows... like slots at a casino" — a real, rotating reel
mechanic around a fixed axis, genuinely different in shape from
RadialMenu's own flat circle, worth being its own system.

Open questions: exact panel content per slot; how the reel's
rotation input works (drag, scroll, directional keys); what "key
inputs" at the center actually are.

## Login — OmniCryptx-integrated

A cylinder docks to the side of the screen; the user fills out a
real OmniCryptx ring pattern alongside traditional username/password
— not decoration, a genuine second, spatial factor. OmniCryptx
already exists as a real, working drill-down mechanic
(`modules/OmniCryptx.js`): each ring is a type (Symbol, Number,
typed password by default), clicking a marker drills into a smaller
nested stack centered there, `omni:cryptx-drilled-in` firing with
`{parentId, childId, ringType, depth}` each time. A login flow
naturally becomes: the user drills through a real sequence of ring
selections, and that sequence is their pattern.

This is the piece prototyped first, since it reuses the most
already-existing, working infrastructure of the three ideas here.

## Dashboard — spherical interactive grid

A spherical grid of interactable spatial data down the side of the
room, for both admin and guest views — real data the user can work
with directly in 3D rather than reading off a flat panel. Genuinely
the same unifying goal as Login and Profiles, applied to analytics
specifically.

## Status

Login/OmniCryptx integration: real, working prototype built this
pass. `modules/AccountLoginCryptx.js` spawns a real, screen-docked
cylinder (repositioned every frame relative to the camera — the
actual mechanism a HUD element needs to stay stuck to one side
regardless of camera movement) plus a real OmniCryptx instance
beside it, only when the Login panel is actually open. Real
`omni:cryptx-drilled-in` selections are tracked as the user's actual
pattern, shown live in the panel alongside real username/password
fields. Everything despawns cleanly when the panel closes — nothing
lingers in the scene. 11 checks, all passing.

Profiles carousel and Dashboard sphere: designed, not started.
