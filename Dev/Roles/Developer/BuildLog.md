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

### V26
The OmniPlayer gaming interface — a large, multi-system build in one
pass. `data/OmniPlayerRealities.js`: 30 Core Realities x 5 Aspects
each (150 total), reusing the same "30" already meaningful elsewhere
in this project. `systems/OmniPlayerGame.js`: real collection logic,
truth-exposure on completing a reality, a 5-state emotional system
(Neutral/Curious/Focused/Alert/Triumphant), and real persistence.
`OmniPocket.js` extended with a genuine 4th tab ("Aspects") as real
inventory, per the explicit request, rather than a separate inventory
UI. `OmniExpressionator.js` gained a new `playerAura` preset — small,
camera-relative, continuous, reacting live to a real, generic
emotional-state event any OmniProduct can dispatch. Exposing a truth
pushes a real notification through the already-built OmniNotify
system. `ui/OmniPlayerDashboard.js`: 5 tabs, with Status and Visors
carrying real data and Boundaries/Languages/Skills left as honest,
clearly-labeled placeholders rather than invented content. 22 checks,
all passing, including the full real chain from a single collected
Aspect through to a real notification appearing in OmniNotifyPanel.

### V27
OmniUser built — the non-gamer counterpart to OmniPlayer, per the
explicit distinction given. `data/OmniUserWellness.js`: the 14
Dimensions of Wellness (Life through International), each a real
0–100 rating defaulting to a neutral 50, not 0. `systems/OmniUserProfile.js`:
real profile fields plus wellness state, with real persistence and
clamping (a value outside 0–100 is genuinely clamped, not silently
accepted). `ui/OmniUserPanel.js`: a real, separate panel — not a
Dashboard tab — toggled from a new button in `OmniPlayerDashboard`'s
own header, keeping the stated audience distinction real
structurally. Also made the Dashboard's Skills tab real: a genuine,
persisted "Number of Life Skills" count on `OmniPlayerGame`, replacing
what had been an honest placeholder, per the explicit request that
this be shown even with no fuller design given for what constitutes
a skill. One real bug caught and fixed in the same pass — an early,
nonsensical fallback chain in `getLifeSkillsCount()` — fixed before
it shipped. 18 checks, all passing, including the full end-to-end
connection from the real Dashboard button to the real, separate
OmniUserPanel opening.

### V29
OmniTargeting's orbit fixed to rotate on the Z-axis, per the tester
log's corrected command — markers moved to the XY plane and the
continuous spin now applies to `rotation.z`, not `.y`. Verified the
inward-pointing property genuinely still holds after rotation, not
just at rest (caught a real measurement bug of my own along the
way — checking a child's local quaternion doesn't account for a
rotating parent group; fixed to use the marker's world quaternion).
`utils/CameraTravel.js` extracted from `OmniInspector.js`'s own
`_goToObject()` — both it and the new `ToolTipMenu` now share one
real implementation instead of two. `OmniGrab.js` gained a public
`grabMesh()`, letting a button trigger the exact same grab as a
raycasted mousedown. `ui/ToolTipMenu.js` built: a real header above
every node (synced live against OmniNode's actual mesh registry, not
a fixed list), each with a QuickActionMenu offering Take Me There and
Grab — the latter a genuine mobile-friendly path into OmniGrab that
doesn't depend on the press-and-drag gesture at all. 18 checks, all
passing, including confirming OmniInspector's own button still works
correctly through the newly-shared utility.

### V35
OmniDraw split into Static/Dynamic, and the first real use of Desire/
PrimaryForce. `ui/OmniDrawModePicker.js` — `⟐OmniDraw` now opens a
real mode choice instead of one panel directly; the click itself
declares Desire (via the new, deliberately minimal
`utils/DesirePrimaryForce.js`), routing to `⟐OmniDrawStatic` or
`⟐OmniDrawDynamic`. `OmniDraw.js` updated to listen for its own
specific label rather than the bare one, which now belongs to the
picker; the `n` key updated to match. `ui/OmniDrawDynamic.js` built:
a string splits into a real word array and displays one word at a
time, in order, looping, shifting like a notification — reusing
Static's own real placement mechanism for its anchor rather than a
second one, and confirming PrimaryForce on real success. Rotation
styles, the command panel, and FilterMorphing capture are explicitly
deferred, matching the agreed scope. 15 checks, all passing — one
real environmental limitation hit and worked around correctly along
the way (Static's own WebGL-dependent preview setup can't run
headless; verified the label-routing fix by a signal that happens
before that unrelated, pre-existing crash point, not by pretending it
doesn't exist).

### V36
OmniJsonifier built — JSON tree construction for OmniDraw(Dynamic),
live and manual per branch, confirmed scope ("so we don't break
anything"): toggle a branch open, its direct children spawn as real
3D nodes with a genuine `parentId` (Dynamic's own flat ticker still
correctly sends `null` — a tree node never should, and now doesn't).
Close a branch and its children despawn via the already-real
`omni:node-delete-request`, recursively force-collapsing any nested
branch left open underneath rather than orphaning it. Multi-word
string leaves get a real `WordTicker` attached; single-value leaves
don't — extracted `WordTicker` into its own shared file first, since
it's confirmed a genuine, reusable "form," not specific to plain-
string Dynamic; both consumers now share one real implementation.
Also: `WindowManager`'s cascade start position moved from 24px to
170px, clearing OmniHand's own real top-left footprint instead of
spawning new panels on top of it. 17 checks, all passing, including
the trickiest one — a nested open branch correctly force-collapsing
when its parent closes, with no orphaned nodes left behind.

### V37
Real bug caught and fixed while tracing OmniJsonifier's own step-by-
step behavior, before testing hit it: `_loadJson()` never despawned
the previous tree before building a new one, meaning loading a
second JSON string would have left the first tree's nodes — and any
branch a user had opened — orphaned in the scene. Fixed by calling
the already-real `_collapseRecursive()` on the outgoing tree first,
which already handles despawning both a node's open children and the
node itself. 5 checks, all passing, confirming the previous tree's
root is genuinely removed and the new tree starts clean.

### V38
A real, global fix, not scoped to OmniJsonifier alone: `OmniNode.js`
only ever stored a node's real label in its own private internal
map, never on the mesh itself — `mesh.userData` only ever carried
`nodeId`. This is exactly why `ToolTipMenu`'s floating headers showed
the generic "⟐ Node" placeholder for every normal node, including
every one of OmniJsonifier's own JSON-key-labeled nodes. Fixed at the
actual source — `mesh.userData.label` is now set in both real
node-creation paths (fresh creation and restore-from-storage) — so
any system holding only a mesh reference (`ToolTipMenu`, and
whatever else later) can now read a node's real name directly,
globally, not just OmniNode's own internal bookkeeping.
`ToolTipMenu` updated to check this real field first, with the
existing special-object fallbacks (landing room panels, cryptex
rings — neither of which go through normal node creation) kept
intact underneath it. 5 checks, all passing, including a direct
regression check confirming those fallbacks still work correctly.

### V40
OmniCommunicationPanel built — the real, second inspector for
OmniDraw(Dynamic)'s tickers, confirmed name. Font added as a genuine
per-node property first (`OmniDraw.js`'s own field schema, flowing
through the same shared node-creation path label already uses).
`WordTicker.js` substantially extended with a real control surface
it never had — play/pause, manual step forward/backward, a real
Reverse that flips auto-play's own direction (a signed +1/-1 value,
not a named state, confirmed to future-proof clockwise/counter-
clockwise circular arrangements later), jump-to-index, speed,
style, and per-word editing. `utils/WordTickerRegistry.js` built so
the panel can find any ticker by real node id, regardless of which
panel created it. One real UX fix caught and corrected during the
build itself: the panel no longer force-opens for every node
selection — only genuine ticker nodes, with an honest empty state
otherwise. Live word-highlight sync, click-to-edit words, a working
speed slider, Save with visible confirmation, and genuine periodic
autosave verified to not fire early. 24 checks, all passing on the
first run.

### V41
OmniJsonifier folded into OmniDraw's own mode picker as a real third
mode — its standalone Drawer entry removed, its listener moved to a
new `⟐OmniDrawJsonifier` label, matching exactly how Static itself
works. The existing voxel/stationary-reality concept renamed from
"OmniCell" to **OmniRealityCell** throughout every doc that
referenced it, freeing the name for a genuinely new, upcoming fourth
mode — `OmniDraw(OmniCell)`, a numerical/D3 node — not yet built,
real open questions still being resolved first. 4 checks, all
passing, confirming the new three-button picker and Jsonifier's
correct label migration.

### V42
OmniCell built. D3 added to the project's real importmap alongside
three/gsap. `OmniJsonifier.js` extended with real chart-eligibility
detection — both the single-series shape (all children plain
numbers) and multi-series shape (children themselves all-numeric
branches) — giving eligible nodes a distinct geometry/color and a 📊
tree-list icon, registering their real data into the new
`utils/ChartDataRegistry.js` on spawn. `ui/OmniCellPanel.js` built as
its own dedicated panel, separate from OmniInspector, matching
OmniCommunicationPanel's real retargeting model including its same
UX fix (never force-opens for an unrelated node). Real, working D3
bar and line charts, per-series toggle chips reusing Jsonifier's own
toggle mechanism for a different meaning, a real empty-state message
when every series is hidden. A real architectural note surfaced
directly rather than silently decided: OmniCell doesn't get its own
mode-picker button — it's discovered through Jsonifier's own tree,
not a separate input flow. 17 checks, all passing, using the exact
sales-by-product example from the design conversation. One real bug
caught in the test itself, not the code, while verifying: D3's own
axis rendering produces `path.domain` elements, which an
overly-broad selector was also counting as data lines — fixed the
selector, confirmed the underlying chart was correct all along.

### V43
OmniCell corrected to a real, fourth, standalone mode — reversing
the previous build's own call, per explicit, direct feedback: it
matches the project's real 4-hand architecture in count, and its
D3-specific settings deserve their own dedicated entry rather than
living only inside Jsonifier's general tree explorer. Extracted the
shared chart-eligibility detection into `utils/ChartEligibility.js`
first, so `ui/OmniJsonifier.js`'s own tree-walker and the new
`ui/OmniDrawCell.js` — a real, direct creation panel, name + JSON
straight to a chart node, no tree needed — share one real
implementation rather than two independently-maintained copies. Mode
picker now has all four real buttons. Both paths genuinely coexist:
Jsonifier still auto-detects chart-eligible branches on its own;
OmniCell is now also directly reachable. 14 checks, all passing,
including a real regression check confirming Jsonifier's own
detection still works correctly after being refactored onto the
shared utility, and real validation checks confirming invalid JSON
and non-chart-shaped JSON both correctly create nothing.

## Status

Maintained going forward — add an entry here for each delivered
version. Entries should stay short and factual: what changed, and any
real bugs caught and fixed in the same pass, since those are exactly
the kind of thing worth being able to trace back to later.
