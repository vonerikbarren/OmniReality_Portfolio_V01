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

### V49
Two real, reported bugs fixed. **The mode-picker flicker on mobile**:
found precisely — tapping OmniKeys' virtual 'n' key fires a real
click that synchronously dispatches a synthetic keydown, opening the
picker, but that same original click keeps bubbling to `document`
afterward, where the "click outside closes it" listener sees a click
from an unrelated button and immediately closes what just opened, all
in one tick. Physical keyboard presses never hit this — no click
event rides along with a real keydown. Fixed with the same
ignore-next-click guard pattern already proven elsewhere in this
codebase (`OmniKeys.js` itself). Verified by reproducing the literal
bug scenario directly, and confirming a genuinely later, real outside
click still correctly closes the menu.

**Texture not surviving a page refresh**: a real, two-part gap, not
one. `OmniInspector.js`'s `loadNode()` only ever runs on an active
user click (`omni:node-selected`) — never automatically when nodes
are restored from storage on load. Separately, `loadNode()` itself
never re-applied the saved texture URL to the mesh's material map at
all, even when it did run — only wireframe/material-type/
materialProps were being reapplied. Fixed both: extracted a real,
reusable `_reapplyExtToMesh()`, added the missing texture
re-application to it, and wired a new `omni:node-restored` event so
this now runs silently for every node coming back from storage, not
only ones a user re-selects. Verified end-to-end: a real save, a
simulated real refresh (fresh OmniNode/OmniInspector instances,
restoring from the same real storage), confirming re-application ran
with no click at all. One real bug caught in the test itself along
the way, not the fix: the storage format was assumed as `[id, data]`
pairs but is actually a plain array of node objects — confirmed the
real format directly via a debug script rather than continuing to
guess, then corrected the test.

### V50
The last two pieces of OmniChronos's originally-planned build order.
`modules/ChronosRealityNode.js` — the real, large node traveling
through the Master Tunnel as Primary Time plays, deliberately kept
outside OmniNode's normal registry, the same way RootSpace's own
tunnel meshes are. Its Y-position loops once per real day across the
tunnel's actual floor-to-ceiling span, verified at time zero, at the
real midpoint, and correctly wrapping after a full day rather than
climbing past the ceiling. Real video-texture support confirmed: a
genuine, muted `<video>` element with its own native loop disabled,
its playback position kept in direct, tested correlation with
Primary Time's own value rather than left to its native clock.
`utils/PerspectiveTime.js` — the real `perspectiveTime(object,
TimeData)` mechanism and the X-axis's stable per-perspective slots,
confirmed to share the exact same day-cycle Y-mapping the traveling
node itself uses, tested directly rather than assumed. 13 checks, all
passing on the first run — 41 total across the full OmniChronos build.

### V52
Real bug fixed: the Master Clock's own creation was auto-selecting
itself at app startup, which pinned OrbitControls' orbit pivot to it
permanently (`MovementPad.js` re-centers orbiting on whatever gets
selected) and force-opened the Inspector (`OmniInspector.js` opens on
any selection) — neither correct for a structural, non-user node.
Fixed with a real, optional `skipAutoSelect` flag on
`omni:node-create-request`, respected only when explicitly set.
`ChronosFloorClock.js` now sets it; every normal node's behavior is
unaffected. 6 checks, all passing, including a direct regression
check confirming ordinary node creation still auto-selects exactly
as before.

### V53
Three new real chart types added to OmniCellPanel — Pie, Radar, Area
— alongside the existing Bar/Line. `_drawChart` restructured so
Pie/Radar (genuinely non-Cartesian, no shared axes with the others)
get their own dedicated setup rather than being forced through
Bar/Line's scales. Pie deliberately shows only the first visible
series' own breakdown by label, colored per-label; Radar renders
every visible series as its own closed polygon across shared labeled
axes, colored per-series — the real target for OmniUser's own 14
wellness dimensions, flagged back in the original SWOT. Area reuses
Line's own scales as its natural filled sibling. 7 checks, all
passing, including confirming cycling through all five types in
sequence leaves no leftover elements behind.

### V54
Real bug fixed: "the nodes don't go to the hands" — traced to a
genuinely fiddly two-step requirement (a hand's own hamburger menu
had to be opened separately, then a grabbed object dragged precisely
onto its small screen rect). Replaced with a real, direct alternative:
`OmniGrab.sendToHand(mesh, handId)` condenses a mesh into a named
hand immediately, no dragging, no pre-opening required.
`ToolTipMenu`'s Grab button now opens a real 4-option hand picker.
A second, real gap found while building this: placed nodes had their
original position/scale cleared to `null` the instant they were
placed, making release genuinely impossible. Fixed with a persistent
`_placedNodes` map and a real `releaseFromHand()`; the menu now shows
Release for a currently-placed node. One bug caught and fixed during
the build itself: replacing the menu's own innerHTML mid-click
detached the clicked button before its event finished bubbling,
reproducing the exact flicker already fixed once in
`OmniDrawModePicker` — applied the same proven guard. 12 checks, all
passing.

### V55
State-transition particles built — confirmed and corrected from an
earlier, wrong assumption (continuous emotion display) to what was
actually asked for: assisting state changes specifically.
`utils/StepMarker.js` built fresh — real px/py/pz movement tracking,
no prior version found anywhere to reuse. `modules/
StateTransitionParticles.js`: a continuous trail where spawn rate
and per-particle life both scale with StepMarker's own real speed
(faster real movement -> genuinely longer streaks, one real system
across the whole speed range rather than separate fast/slow modes),
and a one-shot teleport burst reusing the exact real
`omni:orbit-disable`/`omni:orbit-enable` pair every camera travel in
this project already dispatches — captures the real start position,
animates a real cluster of particles toward the real destination,
then genuinely settles them at rest rather than letting them vanish
or drift. Kept genuinely small per explicit request, noticeable
through additive glow rather than size. 10 checks, all passing.

### V56
Three real pieces. **Tree-access + data-panel children**:
`OmniNode.js` gained a real, public `getChildrenOf(parentId)`.
`ToolTipMenu.js`'s quick menu now shows a real "Show/Hide Children
(N)" option, only when a node genuinely has children, toggling their
real visibility — the exact mechanic Jsonifier already proved,
generalized to any node. Found that OmniInspector already had a full
genealogy tree explorer, but clicking a row only expanded/collapsed
it — it never actually loaded that child's own data. Added a real,
separately-clickable label (the arrow keeps its own expand/collapse)
dispatching a new `omni:node-select-by-id` event, reusing
`_selectNode`'s already-complete behavior rather than a second,
parallel selection path.

**Minimize redesign**: confirmed the "app icon" look already existed
in `PanelIcon.js` as an unused second variant alongside the circular
orb — every single panel in the project (29 occurrences, not just
recent builds) was requesting `variant: 'orb'`. Bulk-changed all of
them to a new, explicit `'app'` value rather than removing the field
outright, avoiding any risk to varying surrounding syntax across 28
files. Drag-to-dock already worked identically for both variants, so
no separate fix was needed there — confirmed directly instead of
assumed.

**Color picker**: confirmed already built, exactly as suspected —
`OmniCommunicationPanel.js`'s own `#ocp-color` input already controls
a Dynamic ticker's tooltip-label color.

11 checks, all passing.

### V59
Real bug fixed: freshly-created nodes with an explicit color (every
Jsonifier branch/leaf/chart node, every OmniCell node) came out pure
white and visually oversized until a full page reload. Traced
precisely: `_createNode`'s own color computation only ever checked
`data.color` for `DimensionalText` geometry — everything else always
used the primitive-type default (white, for `objective`), silently
discarding whatever explicit color was actually provided. The
restore-from-storage path already had the correct logic
(`data.color ?? primitive-default`) — this exact bug class was
already found and fixed once before, but only for restore, never for
fresh creation, which is why a reload always "fixed" it. Matched
`_createNode` to the already-correct restore logic. The reported
"super big" look was investigated directly rather than assumed
fixed by association — scale-application code is identical between
both paths, so this is very likely the same white-color bug's visual
side effect (bright white reads as larger against a dark background)
rather than an independent issue. 5 checks, all passing, including a
direct regression check isolating `_createNode`'s own fallback logic
from the separate defaulting the create-request event handler
already does upstream.

### V61
The Structure panel and quick-menu option (Part 1+2 of the previous
message) were rebuilt after discovering they hadn't actually been
saved — a checkpoint had been packaged partway through that work,
before these pieces existed, and the container reset before a later
version was ever packaged. Confirmed by checking the actual
checkpoint file directly rather than assuming. Rebuilt: `utils/
TreeLayout.js` (the real, shared positioning logic — the original
circular 'tree' formation plus three real linear alternatives), the
`omni:node-position-set` event, `OmniJsonifier.js`'s `setLayoutMode`,
`ui/OmniStructurePanel.js`, and `ToolTipMenu`'s "📐 Structure" option.
`utils/CameraTravelSettings.js` and its panel (built the same prior
turn) were confirmed already present and correct — only the
Structure panel side needed redoing. Re-ran the full test suite
before packaging this time, all 8 checks passing, rather than
trusting the prior turn's report.

### V62
Real bug fixed: Jsonifier's own tree had never been persisted
anywhere — purely in-memory, gone completely on any page refresh,
confirmed by directly testing the exact reported scenario rather
than trusting a prior (incorrect) claim that reopening the panel
alone would restore it. Fixed with real persistence keyed by each
node's own stable path, not its random, regenerating `nodeId` —
saves raw JSON, every open path, and non-default layout modes on
every real state change, restoring all of it on init in real
parent-before-child order. 10 checks, all passing, including a
direct simulation of an actual refresh: a fully independent second
instance correctly rebuilding open state two levels deep plus a
saved layout mode, not just confirming data was written to storage.

### V63
ToolTipSettings built — confirmed no such panel existed before this.
Real Admin sub-panel, slot 9, matching the exact `specialSlots`
pattern every other numbered Admin item already uses. Controls the
real global default for every tooltip header's background, border,
and font color — confirmed directly as the default applied to all
tooltips, not per-node customization, which stays a real, separate,
future feature. `ToolTipMenu.js`'s own header CSS converted from
hardcoded values to real `var(--x, fallback)` custom properties,
matching the exact theming pattern already used throughout this
project — nothing changed visually until a setting is actually
adjusted. Applies live, and immediately on boot from whatever was
saved last session, before the panel itself is ever opened. 9
checks, all passing, including confirming the real CSS custom
properties are genuinely written to `:root`, not just saved and
never actually applied.

### V64
Per-node tooltip override built — confirmed directly: genuinely
independent of ToolTipSettings' own global default, not a snapshot
taken at edit time. `utils/ToolTipNodeOverrides.js` persists by each
node's own real, stable id. Applies as real inline style on the
specific header element, letting the browser's own CSS cascade do
the actual work (inline naturally beats the `:root`-level default)
rather than adding special-case override-checking logic elsewhere.
Reachable from the quick menu's new "🎨 Edit Tooltip" option, with a
real Reset option that only shows once an override actually exists.
Extracted `utils/ColorUtils.js` during the build itself, after
noticing the hex-to-rgba conversion was about to be duplicated a
second time rather than shared. 10 checks, all passing, including
the literal, exact ask — a node's own override surviving a real
change to the global default, not just two settings existing
side by side untested against each other.

### V65
Structure panel access expanded, and two new shapes added. Traced
and fixed a real gap: clicking a row inside Jsonifier's own list
view never dispatched `omni:node-selected` — only a node's header in
the 3D scene did. Fixed with a new, real `OmniNode.getMeshById()`
lookup (a direct accessor, avoiding a linear scan of
`getAllMeshes()` on every click) wired into `OmniJsonifier` via a
new constructor parameter, so a row click now dispatches a genuine
event carrying a real mesh — safe for every other listener that
expects one, not a synthetic stand-in that could have broken
OmniInspector or others silently. Jsonifier's own toolbar also
gained a direct "📐 Structure" button for the root node. `utils/
TreeLayout.js` gained 'sphere' (a real Fibonacci-sphere distribution)
and 'spiral' (a real, expanding descending helix) — six real modes
total now. 12 checks, all passing.

### V66
Real bug fixed: stale orbit pivot after Take Me There or node
deselection, reported as "clicking outside defaults to some sort of
center focus that's either the previously targeted item or a random
point in space." Traced precisely: `_syncOrbitTarget()` — the actual
function that recomputes the camera's orbit pivot — only ever ran on
WASD/R/F key release. Two real gaps: node deselection only cleared
an internal flag without ever recomputing anything, and `goToObject`
moved the camera without ever updating the pivot at all, leaving it
stale at wherever it was set before the travel — exactly matching
the reported "Take Me There is a good example of why this fails."
Fixed both: deselection now immediately recomputes; `goToObject` now
dispatches the same, already-proven `omni:orbit-target-set` event
WASD-rotate-around already uses, before re-enabling orbit. 4 checks,
all passing, including confirming the real dispatched position
matches the actual object traveled to, not a stale or arbitrary
point, and that ordering relative to orbit re-enabling is correct.

### V67
Show Value quick-menu option built — real, for genuine Jsonifier
leaves only, confirmed directly as the right scope since a branch's
own children already represent its value spatially. Kept as an
inline quick-menu sub-view rather than a new panel or Inspector's
own still-unbuilt data tab, so this stays small and shippable
independent of a much larger, not-yet-scoped task. `ToolTipMenu`
gained a real `jsonifier` reference via a new setter method — a
constructor parameter wasn't possible since `OmniJsonifier` isn't
created until later in main.js's own real module order. Shows the
real type and value, with genuine HTML escaping. 11 checks, all
passing; two were my own test's bugs (a stale mesh reference and a
forgotten branch-toggle after loading second JSON, not the real
code), caught and fixed before trusting the final result.

### V68
Full review pass requested after reports of Structure opening
Inspector instead, plus the OS eventually crashing. Two real,
distinct bugs found and fixed, not one. (1) The exact reported bug:
`omni:node-selected` has 8 real listeners project-wide; all three of
Structure's own trigger points were mistakenly built to dispatch
this shared event, unavoidably firing every listener — including
Inspector's own always-opens-on-selection behavior — every time
Structure opened. Fixed with a new, dedicated `omni:structure-focus`
event Structure alone listens for. (2) Found during the review, not
directly reported: Jsonifier's own node spawning never passed
`skipAutoSelect`, so toggling one branch with several children (or
restoring several open branches on refresh) cascaded the full,
real 8-listener chain once per node, all at once — a genuine,
plausible contributor to the reported instability. Fixed with
`skipAutoSelect: true` on Jsonifier's own spawns specifically, not
applied elsewhere, since OmniCell/Static/Dynamic's one-action-one-
node pattern makes auto-select correct there. 9 checks, all passing.

### V69
Two real pieces built. Inspector flipped from right-docked to
left-docked, matching every other panel — confirmed it was a
genuinely different design (full-height sidebar, not a small
floating window like the rest), so this meant changing position,
border side/radius, and the resize handle's own position and math
together, not just one CSS line; verified the resize interaction
itself genuinely grows correctly in the new direction. Root's own
fall-from-sky spawn built for OmniJsonifier — confirmed root-only, a
real landing platform (one flat circle, trivial on memory) spawns on
landing, disposed cleanly on every fresh load rather than
accumulating. 9 checks, all passing, including confirming a real
non-root child gets no fall treatment.

### V70
Real, pre-existing bug fixed: reported as toggle doing nothing on a
root node, Structure's button not working either. Traced to a
genuine catch-22, not a recent regression — whether Show
Children/Structure even appeared in the quick menu depended on
OmniNode's registry, which can only see already-spawned children,
but Jsonifier deliberately defers spawning until toggled open. A
fresh root's own children could never be spawned yet, so the button
meant to spawn them for the first time could never appear the first
time. Fixed by routing a genuine Jsonifier node through its own
logical tree data instead, and having the toggle button's own click
handler call `jsonifier._toggleBranch()` directly rather than
flipping `mesh.visible` on children that might not exist yet.
Non-Jsonifier nodes unaffected, still using the original check. 9
checks, all passing, including the exact reported scenario end to
end.

### V71
Animated life-timeline idea documented, not built, per direction.
Account panel layer built — confirmed `⟐Account`'s three children
already existed in the Drawer but only ever opened the generic
placeholder every other leaf gets; no real, dedicated panel existed.
Built `utils/OmniIdentity.js` (real, local, persisted identities —
honestly stated as a local profile switcher, not real
authentication, since no backend exists), `AccountLoginPanel.js`,
`AccountProfilePanel.js` (reuses OmniPlayerGame's exact real data
source, not a second one), and `AccountDashboardPanel.js` (real
active identity as reality owner, visitor/signup data honestly
labeled example, matching OmniPlayerDashboard's own established
placeholder convention). Removed the three now-redundant generic
panel-list entries to avoid a duplicate-open conflict. 20 checks,
all passing.

### V72
Real design doc written for the full Account spatial vision
(Profiles carousel, Login/Cryptx, Dashboard sphere) — 8 recommended
over 10 for the carousel, reasoning grounded in RadialMenu's own
proven 5-per-page precedent and clean 45° spacing. Login/OmniCryptx
prototyped for real: `modules/AccountLoginCryptx.js` spawns a real,
screen-docked cylinder (repositioned every frame relative to the
camera — the real mechanism a HUD element needs) plus a real,
working OmniCryptx ring instance beside it, only while the Login
panel is open. Real drill-down selections track as the user's
actual login pattern, shown live in the panel. Confirmed everything
despawns cleanly on close — no lingering scene objects. 11 checks,
all passing.

### V73
Radial Area chart added as a real, sixth chart type — checked the
actual referenced Observable example first (`d3.areaRadial`/
`d3.scaleRadial`) rather than guessing at the technique. Genuinely
distinct from Radar: real d3 radial area generator with a closed
curve filling from center, not a manual straight-edged polygon.
Confirmed and tested that chart type was already real, live-editable
via the existing dropdown before this — the new type just slots into
that same, already-working mechanism. 7 checks, all passing,
including confirming the live-edit flow is genuinely bidirectional.

### V74
Real, shared node spacing built — confirmed the core, definite ask
(equidistant distance between nodes, editable). Every layout mode's
own spacing was a hardcoded constant before this, confirmed directly
in the code. `utils/StructureSpacingSettings.js` is the real,
persisted, shared value; `TreeLayout.js`'s six modes all scale
proportionally off it now, using each mode's own original ratio to
the previous default. New `reapplySpacing()` walks the whole tree,
not just one node's children. Real slider added to the Structure
panel. 10 checks, all passing. OmniChronos connection and the
Structure/Jsonifier panel-consolidation idea (with maximize, and
eventual HUD/OmniVisor evolution) both documented as real, separate
next conversations rather than built this pass, given their own
real scope and risk.

### V75
Real bug fixed: trashing a Jsonifier root orphaned every descendant
mesh in the scene. Traced to OmniNode's own trash handler, which
deliberately re-parents a deleted node's children rather than
deleting them — correct, intentional behavior for a regular node,
confirmed directly in its own existing comment, but wrong for a JSON
tree specifically. Fixed with a new listener in `OmniJsonifier.js`
on the same real delete event, cascading only the matched node's own
children (never itself, avoiding re-entrancy) via the already-proven
`_collapseRecursive`. Root deletion also clears Jsonifier's own
state and saved persistence; non-root branch deletion cascades just
that subtree, correctly removed from its real parent's children. 9
checks, all passing, including the critical regression confirming
regular, non-Jsonifier nodes are completely unaffected.

### V76
Real bug fixed: connecting cylinders left stale after a layout mode
change. Traced to `_buildEdgeLine`'s own real geometry — a
cylinder's length/orientation is baked into it at creation, not just
its transform, so moving a node via `omni:node-position-set` never
touched any edge connected to it. Fixed with a new
`_rebuildEdgesFor(nodeId)` in `OmniNode.js`, wired into that same,
one real event every layout mode already uses to move nodes —
disposes the old geometry/material for real and builds a genuinely
new cylinder at the current positions. Fixed at the shared event, so
it covers every mode (Tree, both Linear axes, Sphere, Spiral) at
once, not per-mode patches. 9 checks, all passing, specifically
covering Sphere and Spiral as asked, with a real, verified dispose()
spy rather than an assumed check.

### V77
OmniTargeting and the landing platform, both fixed with precise
detail. Tetrahedron orientation fixed at the geometry level — a real
rotation baked in so one actual vertex sits on local -Z, meaning
`lookAt` alone now genuinely aims an apex at the target, unlike the
old `lookAt` + guessed rotation which never reliably aligned
anything (`TetrahedronGeometry`'s own vertices don't sit on any
clean axis by default). Markers shrunk to 0.2. Black base + white
emissive highlight (the real technique for the effect being
described), 50% opacity, both Y and Z rotation restored in update().
Landing platform: confirmed the root's own real radius (~0.18)
against the old, too-small 0.05 offset — now 0.22, clearing it with
a deliberate gap so the node genuinely sits on top. Real wireframe
material, white, with an honest note on wireframeLinewidth's real
browser-support limitation rather than silently dropping it. 10
checks, all passing, including a direct, precise verification of the
geometry-level vertex alignment itself.

## Status

Maintained going forward — add an entry here for each delivered
version. Entries should stay short and factual: what changed, and any
real bugs caught and fixed in the same pass, since those are exactly
the kind of thing worth being able to trace back to later.
