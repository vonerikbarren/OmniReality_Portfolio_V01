# Build Log

A chronological record of what's actually been built and shipped,
version by version — kept "just in case," separate from
`DeveloperQueue.md` (which is forward-looking, not historical). If
something breaks, this is where to check what changed and when.

Version numbers match the delivered zip filenames
(`OmniReality_Portfolio_V##.zip`). Entries only cover what's directly
confirmed from this build session — earlier history lives in the
project's own prior transcripts, not repeated here.

---

### V05
Baseline for this log. Included the 8 OmniSystem formations, the
particle engine (OmniExpressionator) with entrance/galaxy presets,
camera movement options, UserTimePanel, WindowInspectorTool, and the
initial OmniBrowserSpace layer system (5 layers: Object/Class/Domain/
Realm/Reality, gated by a single Room Scale toggle).

### V06
OmniBrowserSpace layer system rebuilt: expanded to the full 9-layer
list (Point → OmniReality), each layer given its own independent
visibility toggle (replacing the single Room Scale gate), Point given
a distinct solid-marker treatment instead of a wireframe. Two real
bugs found and fixed in the same pass: Object's visibility could be
silently overridden by texture-slot logic, and `_saveAll()` was
missing `roomScale`/`objectVisible`/`layers` entirely, risking silent
data loss on any shape change.

### V07
`Dev/Roles/Developer/DeveloperQueue.md` created — the first version
of the official forward-looking task queue.

### V08
Documentation pass: `HAND_TOGGLE_CONTROL_DESIGN.md` (the four hands
as toggle control surfaces), `OMNISENSE_DESIGN.md` (first real home
for OmniSense, pre-dating its later concrete definition), and
`SYSTEM_ACCESS_OVERVIEW_DESIGN.md` (permission/access overview,
distinguished directly from OmniComplexity).

### V09
Documentation pass: OmniBrand, the 4-tier Reality-grab ladder,
OmniPlayer identification badges (plus the Logic-style complexity-
level interface pattern), and the TopLeftDrawer parity gap identified
in the queue.

### V10
`OmniPlatform.js` (the landing rings + ripple effect) made
configurable — ring count and ripple distance, previously hardcoded,
now live-adjustable and persisted. `OmniFloor.js` built as a new,
separate ground-plane module. `FloorSettingsPanel.js` added as Admin
slot 8.

### V11
`OmniFloor.js` rebuilt for real scale: sized to the actual scene
boundary (3000 units, matching `VoidBoundary.js`'s outer cube) instead
of an arbitrary small default, using a tiled, camera-windowed
approach merged into a single draw call for genuine low GPU cost.
`OmniTargeting.js` built — Zelda-style Z-Targeting, four inward-
pointing markers on the existing selection system, full shape/color/
texture customization, a CSS2D-style tooltip.

### V12
OmniKryptx keyboard view built inside `ui/OmniKeys.js` — a linearized
take on the OmniCryptexLab idea (vertical header strip, sections of
vertical sliders extending rightward). Made the keyboard's default
view. The pre-existing, previously-unwired "View" special key wired
up for the first time, to toggle between this and the normal QWERTY
view.

### V13
Documentation-only: `OMNISENSE_GLYPH_SYSTEM_DESIGN.md` — OmniGlyph/
OmniGlyphics, the internal-vs-external legend fork resolution,
Stationary Realities, tunnels-as-realities, the floor-becomes-wall
map concept, OmniScroll, and the founding lore.

### V14
The OmniSense zoom-out experience built: a literal reverse of
`playEntryAnimation()` (camera rises back to the exact original entry
position), paired with a new `reverse` mode on the entrance particle
preset (particles recede and fade in, rather than approach and fade
out). Wired to a new `omnisense-wrapper` panel entry (category/sub
panel, one slot for now). A real, separate bug found and fixed in the
same pass: `OmniTargeting` had been added to the panel-wrapper system
in V11 but never to `Drawer.js`'s own item list, making it genuinely
unreachable from the Left Drawer since it was built.

---

### V21
`modules/OmniCryptx.js` built — the core, tier-agnostic ring engine
underneath Admin/Standard/CustomOmniCryptx: nested rings sharing one
axis, radius growing with depth, innermost ring spinning fastest.
Clicking a ring's marker drills in — generates a new, smaller ring
stack centered on that marker's real world position, one fewer ring
type, recursively, only ever built the moment it's needed. Verified
directly, 22 checks, including the recursive drill-in itself and
correct cleanup through a full parent/child/grandchild chain.

### V22
Real bug fix, not a new feature: OmniKryptx's sections
(`ui/OmniKeys.js`) had been built as blank, generic 0–100 sliders
with no real meaning — a genuine misunderstanding, since they were
always meant to be the actual cryptex ring types, the same ones
`modules/OmniCryptx.js` uses for its 3D rings. Fixed by extracting a
shared `data/OmniCryptxTypes.js` module — both surfaces now read
from one real source of truth, confirmed directly (both render the
identical color for the identical type, not two coincidentally-
matching copies), and each of a section's slots now uses the right
widget for its real type (a range slider for Number, a text field
for a typed password, never a slider wearing a mismatched label).

### V23
OmniNotify's first real code — previously discussed in depth but
entirely undocumented-as-code until now. `ui/OmniAddressBar.js` built
as a genuinely reusable breadcrumb component (10 slots, ⟐ placeholder,
any panel can mount one). Integrated into `GlobalBar.js`'s own,
already-reserved top space for the main notification trigger —
deliberately not a new floating top-right element, since that would
have collided with ConsciousHand's existing corner. `ui/OmniNotifyPanel.js`
built as the real drop-down mechanic (open/close/outside-click), still
an honest empty shell with no real notification content yet. Each of
the four hands (`ui/Hand.js`) now mounts its own small address bar,
sliding in from whichever side that specific hand actually occupies —
confirmed directly, all four are distinct instances, not one shared
bar. 18 checks, all passing.

### V24
Tier 1 of the Reality-grab ladder made real:
`systems/OmniGrab.js` — grab any real node mesh (reusing OmniNode's
own registry via a new public `getAllMeshes()`, not a second,
parallel list), jitter continuously while held, drag toward any of
the four hands, and only a genuinely OPEN hand (its own hamburger
menu active, exposed via a new `dataset.handOpen` attribute on
`ui/Hand.js`) is a valid drop target — closed hands are excluded
entirely, not just declined. Dropping into an open hand condenses the
reality down and dispatches a real event carrying which hand and
which mesh; "structural aspects of that hand manifest on the reality"
is explicitly left for later, per the request — this system only
provides the real hook. Dropping outside any open hand triggers a
genuine snap-back release. One real bug caught and fixed in the same
pass: jitter originally used wall-clock `performance.now()` instead
of accumulating the passed `delta`, meaning frames landing in the
same millisecond — a real, common occurrence, not a rare edge case —
would have jittered identically; fixed to accumulate its own internal
clock like every other module in this project. 20 checks, all
passing.

### V25
The hardcoded Cross-formation landing room made real:
`modules/OmniLandingRoom.js` reuses the actual, existing Cross
positions (`crossDefs()`, now exported from
`ui/OmniSystemCreatorPanel.js` rather than duplicated) for its 7
nodes, each with a distinct, specified or randomly-assigned geometry
(Down=Box/"gridbox", Center=Sphere, Up=Octahedron, Back=Torus, the
rest random from a real, safe geometry pool) and a genuinely semi-
transparent panel. `ui/NavMapPanel.js` built as a real, reusable
fast-travel panel — "every Navbar will have one" — snapping the
camera to any node on click. This is also OmniNotify's first real
content: clicking a node now pushes an actual, correctly-worded
travel notice through the real `OmniNotifyPanel` (rebuilt from its
prior empty-shell state to genuinely hold and render a notification
history), confirmed end-to-end, not just dispatched into the void.
Also added `⟐NavMap` to `Drawer.js`'s real item list immediately —
directly applying the lesson from the OmniTargeting bug caught two
versions ago. 19 checks, all passing.

## Status

Maintained going forward — add an entry here for each delivered
version. Entries should stay short and factual: what changed, and any
real bugs caught and fixed in the same pass, since those are exactly
the kind of thing worth being able to trace back to later.
