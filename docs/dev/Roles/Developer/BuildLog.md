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
`docs/dev/Roles/Developer/DeveloperQueue.md` created — the first version
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

### V78
Three threads. Mac grey-scene bug: found a real, plausible cause —
WallpaperSphere's own default color (#445566) is exactly the flat
grey reported, and its texture-load failure path was genuinely
silent (zero logging on an empty IndexedDB record). Safari's own,
documented IndexedDB blob-storage history plus both wallpaper and
floor sharing the same texture-storage utility is a coherent
explanation for why plain-color nodes keep working while textured
surfaces don't. Added real, specific diagnostic logging rather than
guessing further; honestly noted this is a strong hypothesis from
reading the code, not a confirmed fix without real Mac console
output. zFold frame drops: found one real, concrete contributor —
ToolTipMenu.update() rescans every mesh and recomputes a full
screen projection per node, every frame, unconditionally. Honestly
noted that full mobile profiling isn't possible from here; real next
step is the browser's own profiler on the actual device. OmniTargeting
redesigned properly: two genuinely independent 4-marker rings (8
total), not one set rotating on two axes — `_groupY` and `_groupZ`
spin on only their own real axis each. Found and fixed a real,
secondary orphaned-sub-group bug while rebuilding this. 11 checks,
all passing.

### V79
Presenter panels clarified as OmniExpression's avatar + three
backing circles, distinct from the unrelated systems/OmniPresenter.js.
Traced the "too spread out in corners" complaint to the real, direct
cause: the old radius progression (1.3/1.6/1.9) made the outer
circle nearly double the avatar's own size — confirmed the group
already correctly billboards toward the camera (no depth-alignment
bug), so this was a size issue, not a positioning one. Tightened to
1.12/1.22/1.32. Found and fixed a real colorSpace bug on all three
texture-loading paths (avatar video, avatar image, backing-circle
image) — none set texture.colorSpace, so three.js treated them as
linear instead of sRGB, washing them out under this project's own
ACES tone mapping — a concrete match for "looks white." Confirmed
alternating rotation was already built and enabled by default,
correcting a stale note in the design doc claiming otherwise. 9
checks, all passing. One editing mistake caught and fixed during
this pass — a str_replace accidentally deleted the doc's own
"Status" header; found by checking the file's actual tail rather
than assuming the edit landed cleanly.

### V80
Real root cause of the Mac grey-scene/crash bug found, from actual
console output this time — a completely different, more precise
diagnosis than the earlier wallpaper/IndexedDB hypothesis.
`renderTransmissionPass` in the real stack trace is a specific
three.js internal feature triggered only by MeshPhysicalMaterial's
`transmission` property, with a real, documented history of
WebGL-implementation compatibility problems. Found three separate
modules (PortfolioXD.js, PortalSpheres.js, Portfolio3D.js) hardcoding
non-zero transmission unconditionally — not opt-in, active for every
user the moment any of them render — plus a fourth, opt-in source in
OmniInspector.js's own material-editing slider. Removed transmission
from all three hardcoded sources, kept every other intentional
material property (iridescence, metalness, emissive), raised opacity
slightly on each to preserve the real, intended glass-like look.
Added a direct, honest warning to the Inspector's own slider label.
Verified via precise source inspection: transmission fully absent
from all three files, new opacity values in place, nothing else
disturbed.

### V81
Real billboarding bug fixed in OmniExpression's Presenter — reported
as the avatar looking correct dead-center but tilting/skewing off to
a side or corner. Traced precisely: the group's own rotation copied
the camera's quaternion directly — "face the same direction as the
camera," which only equals "face toward the camera" when the avatar
sits directly ahead. Off-center, those two things split apart.
Fixed with a real, true billboard (`lookAt(camera.position)`
instead of a quaternion copy), keeping the avatar's plane genuinely
perpendicular to the real camera-to-avatar line everywhere, not just
centered. 3 checks, all passing — including catching and correcting
my own test's wrong sign assumption about three.js's real lookAt
convention on a plain Object3D (points +Z at the target, not -Z, an
easy thing to misremember from how cameras specifically work), and
confirming via direct, empirical geometry that the old approach
genuinely lacked the billboard property off-center while the new one
has it everywhere. Same doc-editing mistake as last pass repeated
and caught again — a str_replace briefly deleted the "Status"
header a second time; checked the file's actual tail and fixed it
immediately rather than assuming the edit was clean.

### V82
SectionCarousel built — the real, reusable "nav-page build tool"
template, proven on About Me first per direction. One shared class
per nav page, OmniDraw's own four modes confirmed as "objective
nodes," OmniSystem's own real Ring formula (pulled directly from
OmniSystemCreatorPanel.js, verified against its own documented
worked example) added as a new, real `omnisystem-ring` mode in
TreeLayout.js and set as the default shape for a fresh section root.
Real per-identity content: OmniJsonifier gained an optional storage
namespace, a live `setStorageNamespace()`, a configurable nav-select
label, and a configurable default root layout mode — all
backward-compatible. A real, subtle interaction bug found during
full end-to-end testing (not caught by isolated unit tests):
`setStorageNamespace()`'s own internal despawn was triggering the
V75 cascade-delete fix's "the root was deleted, wipe storage" branch,
since both react to the same real delete event and that fix couldn't
tell an internal namespace switch apart from a genuine trash-click.
Fixed by clearing the tree reference before despawning, not after.
7 checks, all passing, covering the complete real flow. Redone this
pass after confirming the prior turn's checkpoint predated most of
this work — verified precisely via direct file inspection rather
than assumed, learning from two earlier repeats of the same mistake
this session.

### V83
Real, urgent bug fixed: nodes spawned at the wrong (larger) size,
only correcting after a reload. Traced precisely: `_createNode`'s
own entry animation was hardcoded to always animate scale to
`(1,1,1)`, silently overwriting the real, correct scale that had
just been set from `data.scale` moments earlier — any node with a
custom, non-default scale (Jsonifier's smaller nodes, OmniSystem's
half-size nodes) popped in at full size regardless. Confirmed the
restore-on-reload path never shared this bug at all, which is
exactly why reloading fixed it. Now animates to the node's own real,
intended scale. 5 checks, all passing.

### V84
Real, missing reset functionality built — confirmed genuinely
absent, not broken: no "reset"/"clear" action existed anywhere in
Admin at all, which is why a large, problematic JSON tree had to be
trashed by hand. New `clear()` on OmniJsonifier (same real logic the
root-delete cascade already proved correct, exposed directly) plus
a real Admin slot 10 that clears every registered instance at once,
with a genuine confirm dialog first since it's destructive. Rebuilt
`utils/JsonifierRegistry.js` along the way — needed for this
feature regardless, and also the mechanism the still-pending Q3
work depends on. 5 checks, all passing.

Honest note: the Registry/Q3 work from the previous turn never
actually got packaged — that turn hit its own tool-call limit before
finishing, and the next message moved to a different topic rather
than confirming to continue, so this turn started from the last
real, packaged version, before that work existed. Rebuilt the
registry here since this feature needed it either way; Q3 itself
remains not yet re-applied.

### V89
OmniChat built — the real, first piece of the live-realities layer.
`ui/OmniChat.js`. Dockable bottom-right panel, detachable, genie
return-to-dock targeting `#omni-dock`'s own real, live position on
close. Full Unicode text field. A real, important find made before
building: `modules/TerminalTunnel.js` already existed as a
partially-built 3D terminal visual, with its own real input system
explicitly left as "Phase 4" — wired OmniChat's new Terminal tab to
dispatch the same real `omni:terminal-invoke`/`omni:terminal-dismiss`
events that system already listens for, rather than building a
second, disconnected terminal. Dummy communication reality preview:
one geometry looping through four real forms (open set, not fixed),
combining animation, transformation, and mutation by default, plus
basic play/pause as the first real piece of TheOmniStatePanelControls.
Honest about the morph mechanism — cross-fade/scale between discrete
shapes, not true vertex morphing, logged as real future work. Applied
the exact lesson learned fixing OmniStartHUD's own preview diamond
from the start this time: `_setupPreview()` built with its own
try/catch guard from day one, not retrofitted after a crash. Toggled
via a new 'c' keybinding, matching the established Enter-for-OSH
pattern; a real Dock icon trigger is a reasonable, un-investigated
follow-up. 17 checks, all passing, including direct confirmation that
the genie animation's computed target exactly matches the dock's own
real position, and that the terminal-tab integration genuinely fires
the existing system's real events, not just new, parallel ones.

### V92
OmniChat wired into the Left Drawer — reachable as
⟐OmniSense → ⟐Sense02, the first real child that group has ever
had (checked directly: it previously listed no children at all,
matching the real gap noted in Developer Queue item 15). Added the
same, already-established nav-select listener pattern every other
reachable panel already uses — no new mechanism invented. The
existing 'c' keybinding continues working unchanged alongside it. 4
checks, all passing, confirming both paths open it correctly, an
unrelated nav-select doesn't, and there's no regression between them.

### V93
Corrected OmniChat's own nav placement per direct feedback — the
previous pass's ⟐OmniSense → ⟐Sense02 placement was rejected as the
wrong spot. Removed cleanly (OmniSense reverted to childless, its
listener removed from OmniChat.js) rather than left alongside a new
one. Added the real, requested placement instead: a genuine fifth
option (Chat) in OmniDraw's own mode picker
(`ui/OmniDrawModePicker.js`), alongside Static/Dynamic/Jsonifier/
OmniCell, reachable via the exact same real pattern each of those
already uses (`⟐OmniDrawChat`). Also added a new 'n' keybinding,
alongside the existing 'c', per direct request. 4 checks, all
passing, including direct confirmation that the rejected Sense02
label now genuinely does nothing — a clean removal, not a dead
listener left behind.

### V94
Two real key-collision bugs found and fixed, both from the same root
cause: incomplete checks for existing bindings before adding new
ones. 'n' was already, correctly bound to opening the OmniDraw mode
picker before a redundant, second 'n' toggle for OmniChat was added
last pass — removed the duplicate; the mode picker's own real Chat
option already covers this. 'c' was already, correctly bound to a
sophisticated `returnToLanding()` function (exact resting pose,
proper orbit disable/enable and pivot reset) — a redundant, inferior
replacement was removed entirely, restoring the original, better
function untouched. Real keyboard shortcuts panel built
(`ui/OmniKeyboardShortcutsPanel.js`), listing every real, current
shortcut compiled directly from main.js's own handlers. Reachable
from the Assistance menu via a new, real global-item mechanism added
to WindowManager.js (`registerGlobalItem`), merging into every
context's own menu regardless of which panel is frontmost, rather
than needing to register per-panel. Edit action genuinely gated on
Admin being the real frontmost window (WindowManager's own
getFrontmost(), not a guess), plus an OmniCryptx password prompt —
honestly accepting only blank for now, since the real OmniCryptx
system isn't built yet. 8 checks, all passing.

### V95
Real tooltip/panel z-index bug fixed. Traced to `#omni-ui` (every
real UI panel's shared container) creating its own stacking context
via `position: fixed` + `z-index: 10` together — this caps every
panel inside it, including OmniChat's own internal z-index:95, at
that one outer number. ToolTipMenu's headers bypass `#omni-ui`
entirely and append straight to `document.body` at z-index 40/41, so
they were beating every real panel inside `#omni-ui` regardless of
that panel's own, much higher number. Surveyed every z-index value
and every direct-body-child in the project before picking a fix —
raised `#omni-ui` to 55, clearing ToolTipMenu (40/41) and
OmniAimReticle (50), while staying under the real, intentional
modal-style overlays (OmniDrawModePicker at 65, GridPanel at 80).
Also redid the Q3 selection-driven JSON tree browser in
OmniStartHUD.js and its own defensive preview-setup fix — both
confirmed lost in the same earlier incident where a turn's work
never got packaged before the conversation moved to a new topic.
Rebuilt from the same, already-proven design; 9 checks, all passing
on the first run, confirming the redone work matches the original.

### V96
Real, definitive fix for the persisting OmniChat interaction bug —
my earlier z-index fix (V95) addressed a real but different issue
(stacking against direct-body-children like ToolTipMenu) and didn't
touch this one, since OmniChat and Hand share the same parent
stacking context (#omni-ui) regardless of that fix. The actual root
cause: #omni-ui deliberately sets `pointer-events: none` so the 3D
scene stays clickable through empty space, which means every real,
interactive panel inside it must explicitly set its own
`pointer-events: auto` — OmniChat's own CSS never did this anywhere,
so every click, keystroke, and drag was being silently swallowed
before ever reaching it, regardless of z-index. Fixed directly.
Checked the other two recently-built panels (OmniKeyboardShortcuts,
OmniDrawModePicker) for the same bug class — both are direct
children of `body`, not `#omni-ui`, so genuinely unaffected.

Also moved OmniChat off the bottom-right Hand's own real footprint
entirely, per direct preference — confirmed as a genuine, direct
overlap (both anchored to the same corner; Hand's own real 2×2 cell
grid is ~102px wide). Right offset changed from 24px to 130px,
clearing that footprint with real margin, landing it over the
(centered) minimap's own area instead, as preferred. 5 checks, all
passing, including a caught-and-fixed bug in my own test — an
extraction regex that was accidentally matching my own comment text
instead of the real, active CSS declaration.

### V97
Three real, separate items built. (1) Clock milliseconds — a new,
real row in GlobalBar updating every frame, since ms need continuous
updating unlike the existing 1Hz HH:MM:SS tick. (2) TerminalSettings
— a real, new panel (`ui/TerminalSettingsPanel.js`,
`utils/TerminalSettings.js`), matching ToolTipSettings' exact,
proven pattern, controlling the terminal's accent color and
background opacity. Wired into both real consumers — OmniChat's
Terminal tab via CSS variables, and TerminalTunnel's own 3D visual
directly (a Three.js material color and Canvas 2D drawing calls
can't read CSS variables at all, so these needed a direct settings
read instead) — plus a real, live change event so the 3D panel
re-colors immediately if a setting changes while it's visible, not
just on its next unrelated redraw. Reachable from Admin as slot 11.
7 checks, all passing. (3) The pocket/quick-menu relocate-realities
idea, noted but correctly not yet documented or built — the person's
own instruction was to document it *after* OmniTranslator, not now.

### V98
OmniTranslator's real, visual shell built (`ui/OmniTranslator.js`) —
the same proven "shell first" approach OmniStartHUD used, given this
was already confirmed as several genuine subsystems with two real,
still-open questions (Right/Left pairing, the node-typing mechanism)
rather than one buildable panel. Four real vault containers, each
correctly positioned and carrying the confirmed
"SystemsOfSpacialSystems" double-border-plus-glow identity and its
own correct label, with an honest empty state rather than fake
content. Toggled via a new 't' keybinding and reachable from the
Left Drawer, matching OmniChat's own dual-path pattern. 13 checks,
all passing. Node typing/labeling, drag-to-extract, and
cross-reality linking deliberately not attempted — real, separate,
still-undesigned work, left for a real follow-up pass.

### V99
The real message-shooting mechanic built in OmniChat. A new toolbar
(font/size/alignment/Form 1–6) in the Chat tab, between header and
content. Sending a message launches it forward along the camera's
own real, fixed direction, traveling the confirmed 2000-unit
distance before real disposal. Forms 1–5: real, square planes
(confirmed as visual-consistency, not performance — a plane's
triangle count doesn't depend on aspect ratio). Form 6: real cubes,
the confirmed lowest-cost material, which genuinely dismantle
partway through flight — actually disposing the 3D mesh and
continuing as a real DOM element reusing ToolTipMenu's own
established look and its own world-to-screen projection math.
Visible fade/flicker/jitter during the final stretch before
disposal, per direct request. Also fixed a real early-return bug in
update() that would have silently stopped this whole mechanic if the
decorative preview ever failed to initialize — the two are
independent systems and needed to be treated that way. A real bug in
my own word-splitting algorithm was caught by direct testing (could
leave later pieces empty depending on word lengths) and fixed with a
guaranteed-correct approach. 17 checks, all passing.

### V100
OmniChat's JSON tab built — OmniChat(Text, JSON, Terminal) as
confirmed. Two real findings checked directly before building:
wallpaper has no actual multi-profile system, just one single saved
configuration under one key, so `utils/JsonChatMessageOptions.js`
matches that real pattern; and OmniDraw's own Transform schema
already has the exact px/py/pz/rx/ry/rz/sx/sy/sz fields and ranges
referenced, reused directly. Real, meaningful behavioral difference
from text: a JSON tree travels from a chosen origin
(user/left/right/ceiling/ground/instant-at-the-point) to its real,
explicit destination and genuinely settles there, remaining in the
scene, rather than being disposed like a transient text message.
Reused Form 1-6 and the Form 6 cube-to-tooltip dismantle exactly as
already proven. Real JSON validation with an honest error for
invalid input. 17 checks, all passing, including a real regression
check confirming text messages are completely unaffected.

### V101
OmniTranslator's real content logic resolved and built, closing both
open questions from its own shell pass. Pairing: independent pools,
not strict Right/Left linking. Node typing: found and reused a real,
already-proven, lower-risk pattern instead of building new
drag-detection — OmniGrab's own `sendToHand` already solved
"menu-driven placement, no dragging" for hands; the exact same real
approach now applies to all four vaults via a new vault picker in
ToolTipMenu's quick menu and `OmniTranslator.addToVault()`. A node's
own real, existing label is its identity — no separate
type-classification system, honestly, since nothing real needs one
yet. `utils/OmniTranslatorVaults.js` persists real, independent lists
per side; vaults now render real entries in place of the empty state,
removable with a click. 9 checks, all passing, including direct,
end-to-end confirmation that the two pools stay genuinely independent
through the full real flow.

### V102
OmniTargeting's third and final ring added — X axis, completing all
three (Y and Z already existed). Low-risk extension: `_buildRing()`
was already generic and reusable regardless of which group it's
parented to, so the X ring is built, rotated, and disposed the exact
same way as the other two, just on its own axis and its own,
distinct speed so all three stay visually distinguishable. Updated
stale comments that referenced "two rings"/"8 markers" to the real,
current "three rings"/"12 markers." 10 checks, all passing.

### V103
Real fix — OmniTranslator's Right/Left vaults were directly
overlapping the Hand corner menus, confirmed precisely: both
anchored to the same screen edges, with the vaults' own tall
vertical span and near-edge positioning covering both the top and
bottom corner menus on each side, not just one. Shrunk and pulled
in from the edge on both sides to genuinely clear all four corners'
real, computed footprint. Caught and fixed a real arithmetic mistake
of my own during testing — an initial fix still fell 8px short of
actually clearing the corner width, found by checking exact numbers
rather than trusting the estimate. 6 checks, all passing, verifying
the real, computed clearance on all four corners.

Also confirmed directly, no build needed: any OmniDraw-created
element (Static/Dynamic/Jsonifier/OmniCell) already works with
OmniTranslator's vaults right now — all four modes dispatch through
the same real node-creation path that already sets the fields
addToVault needs, and the quick menu's "Add to Translator" option is
unconditional, not gated to specific node types.

### V104
Real, genuine miscommunication resolved — "the clock" was never
GlobalBar's own time display (V97's ms row there), it was
`modules/ChronosFloorClock.js`, a real, dedicated module never
checked at the time: a live 3D label floating above the MasterClock
node positioned beneath the floor at Y=-102. Its own update loop only
refreshed once a real second — milliseconds would have just sat
frozen between refreshes even if shown. Now updates every frame;
`formatSeconds()` itself stays untouched (shared with
ui/OmniChronos.js, which depends on its current, ms-free output) —
ms is computed directly from PrimaryTime's own real, continuously-
accumulating fractional value and appended to the label separately.
Chart registration correctly kept its own original once-a-second
cadence, confirmed unaffected. A real floating-point precision bug
was caught by direct testing (Math.floor reading one ms low due to
IEEE 754 representation error) and fixed with Math.round. 4 checks,
all passing.

### V105
Real fix for TerminalTunnel's own center panel. Found the precise
target first — "the inSpace panel" refers to the same real concept
`ui/PanelControl.js` already names ("in-space panels": planes living
inside the 3D scene, not screen overlays), applied here to the
terminal's own canvas-texture panel. Its position was set once,
statically, at build time ("eye level, center of tunnel") and never
actually tracked the camera afterward. Now recomputes every frame:
'center' mode (the real, current default) tracks the camera's real Y
while holding X/Z at the cylinder's own center, per direct request
("limited to the center for now"). A new, real 'circumference' mode
also added and wired into TerminalCommandSettings — follows the
camera's real angular position around the cylinder's outer edge
rather than sitting at a fixed spot that could end up out of view.
10 checks, all passing, including live confirmation that moving the
camera genuinely moves the panel with it in both modes, not a
one-time snapshot.

### V106
OmniLog built — the real, seventh OmniDraw mode, confirmed and named
directly. Real, automatic pagination (`utils/OmniLogPagination.js`)
— parses the editor's own constrained rich-text (bold/italic/
headers/lists) into real blocks, measures real text width with an
actual 2D canvas context, and splits into pages once a page's real,
measured line-height budget is exceeded. `modules/
OmniLogPagesPanel.js` — genuinely separate, real 3D page planes
positioned in sequence (confirmed directly over one panel with
internally-scrolling text), parented under one real, transformable
group using OmniDraw's own exact px/py/pz/rx/ry/rz/sx/sy/sz schema.
Scroll navigation reuses goToObject() directly — the same real
camera travel every other "take me there" interaction already uses
— and only activates when the entry's own node is genuinely
selected, confirmed via the same real selection-event pattern used
elsewhere. `ui/OmniLogEditorPanel.js` reuses OmniChat's JSON tab as
its real structural basis, with a real `contenteditable` region, a
small formatting toolbar, and real starting templates. 17 checks,
all passing on the first full run, covering block parsing,
automatic pagination at both short and long lengths, real page
sequencing, scroll clamping, selection-gated wheel navigation, and
the full real editor-to-3D-pages submit flow.

### V107
Completed OmniLog's real fixes and additions, all real and tested.
Typing bug fixed — two keybindings (terminal invoke/dismiss on
backtick/Escape, and the separate fullscreen-exit Escape handler)
genuinely had no typing guard at all, unlike every other shortcut in
the file, confirmed by directly checking every real handler rather
than assuming. Universal Edit quick-menu action added to every node
— dispatches the real omni:node-selected event the Inspector already
auto-opens on, via a new, real getNodeData() getter matching
getMeshById's own pattern. OmniLog re-editing built on top of a new
registry (the pages panel only held rendered output, not editable
source) — resubmitting a re-edited entry now genuinely updates it in
place rather than creating a duplicate; caught and fixed a real
mistake of my own along the way, an invented event that didn't
actually exist, replaced with the real, confirmed
omni:node-position-set. Real RGBA color added and genuinely applied
to page rendering, not just decorative. Real Lorem Ipsum generation
added under a new OmniLogPageOptions area, specifically to prove out
multipage pagination on demand; caught a real bug before it shipped
— the button shared a class with the formatting toolbar and would
have been wired into execCommand(undefined, ...), fixed with a
direct exclusion. Real number fields added alongside every transform
slider, two-way synced. 12 checks, all passing on the first full
run. OmniPocket logged as the real next priority, future notes only
per direct instruction — noted honestly that it already exists as a
real, substantial system, not a concept to design from scratch.

### V108
OmniPocket added to the Left Drawer, confirmed as "the top left
corner menu, all the OmniProducts." Real PocketThis⟐ quick-menu
action built — reuses OmniPocket's own, proven extraction logic
directly via two new, real public methods (pocketThis, reinstateNode,
getExtracted), rather than a second, parallel implementation. Q2 of
OmniStartHUD rebuilt into a real, live pocket manager: real title
header on hover, real native drag-to-reorder with a persisted order,
type-aware preview per item (a real JSON tree via the existing
Jsonifier registry, raw data, or the full string for a dynamic node),
and a real TakeOutOfPocket action, all re-rendering live on any real
change to the pocket, not just on open. 12 checks, all passing.

Two real TODO items logged per direct request: the pending
OmniProduct index (the person's own list, not yet built), and the
coordinate grid/altitude ruler idea for navigation, with a real,
direct opinion given on naming — OmniSpaceExplorer as its own real
product, distinct from OmniPlayer, which grants access to it rather
than being it.

### V109
OmniRealityGridSelector built — a real Admin staging tool
(`systems/OmniRealityGridSelector.js`, `ui/
OmniRealityGridSelectorPanel.js`). Raycasts against a real,
mathematical plane at the floor's own real Y level rather than its
mesh directly (the floor is a group, not one exposed mesh — a plane
intersection is also the standard, more robust real technique for a
flat surface regardless). Cell size confirmed to match the floor's
own real, existing grid exactly (20 units, from its own
TILE_SIZE/TILE_DIVISIONS), so highlights land precisely on real grid
lines, not a guessed size. Real, multi-cell selection, saved as
named spatial contexts (localStorage, matching the established
pattern) — load restores both the real cell list and its real
highlight meshes. White highlight with a yellow outline, exactly as
requested. Added to both a new Admin slot and the Left Drawer,
confirmed as "the top left corner menu, all the OmniProducts." 16
checks, all passing on the first full run.

Floor/wallpaper auto-contrast (the minor, "on the side" request) not
yet built this pass — real complexity worth flagging honestly: the
wallpaper is a real photo texture, not a simple color value, so "is
it white" would need genuine pixel sampling, not a one-line check.
Real, planned approach: sample the wallpaper's own current texture
onto an offscreen canvas and read its real average brightness,
reusing the same conceptual goal as Hand.js's own mix-blend-mode
contrast trick (which itself can't apply to a 3D mesh's material
color directly, only real DOM/CSS rendering).

### V110
Real fix — OmniRealityGridSelector was wired into both the Left
Drawer as a standalone top-level entry and Admin's own slot 12;
confirmed directly it should live only nested inside Admin
(TopLeftMenu/Admin/SubMenuPanel, Admin12), not also as a separate
drawer item. Removed the standalone drawer entry; the Admin slot's
own trigger dispatches the same real nav-select label independently,
so the one remaining path needed no changes itself. 2 checks, both
passing, confirming the panel still opens correctly through that
one, now-correct path.

### V111
⟐Developer added to the real drawer, directly above ⟐Admin, with its
own real sub-menu — same exact real mechanism Admin itself already
uses (IndexedPanel + specialSlots), confirmed by reading Admin's own
config rather than assuming. Correction along the way: initially
believed Admin lived in a separate, right-side drawer system —
checked directly and found it's genuinely the same, single drawer,
just a later section of the same list; corrected before building
Developer in the wrong place. 2 checks, both passing.

Access-level gating ("based on the admin access type") intentionally
not built — confirmed directly that no general access-type/role
system exists anywhere yet, logged as its own real, honest queue
item rather than faked. Every Developer slot is open to anyone who
can reach the panel until that real system exists.

### V112
OmniVerticalMeter, quadrant maximize, and Q4's real minimap all
completed and wired live. OmniVerticalMeter: real Admin item, live
altitude readout on a fixed screen-edge scale, updating every frame.
Quadrant maximize: any of the four StartHUD quadrants can now fill
the whole, already-bounded HUD container (never the full browser
viewport, so the rest of the real UI stays reachable) and restore.
Q4: the real, first buildable piece of OmniSense's own already-
documented "floor becomes a map" concept, flattened to 2D — draws
real node positions, the real landing point, and every staged
OmniRealityGridSelector context as an actual region, fit to whatever
content genuinely exists rather than the floor's full, mostly-empty
extent. Click-to-fast-travel reverses the same real coordinate
mapping used to draw it. Staged contexts also now get a real,
subdivided wireframe boundary directly in the 3D scene, not just on
the minimap, so the same area reads consistently in both places, per
direct "both" request.

Real bug caught by the test suite itself, not by inspection: a prior
edit had silently dropped the entire loadContext method from
OmniRealityGridSelector — syntax validation alone passed because the
file was still valid JS, it just no longer did what it claimed to.
Only caught once a real test tried to call it. Restored with the
real, intended boundary-creation behavior intact. 11 checks, all
passing after that fix.

### V113
Two real bugs fixed. OmniTranslator's left/right vaults were landing
near screen center (their top/bottom values were arbitrary leftovers
from an earlier, horizontal-only overlap fix) — recomputed from
Hand.js's own real geometry constants and repositioned into the real
gap directly between the top and bottom Hands on each side. Q3 (and
Q2's own JSON preview) text was invisible because the reused
OmniJsonifier text classes rely on CSS variables scoped to that
panel's own root — undefined outside it, silently falling back to
the browser default instead of white. Fixed with an explicit
override in both real reuse sites.

Real theme system built: utils/OmniThemes.js defines three themes
(black-metallic, white-glowy-metallic, grey-metallic), chosen before
JSON submission per direct request, with color gradually shifting by
depth (black/white both drift toward grey; grey drifts outward by
depth parity — a stated, direct assumption on the one genuinely
ambiguous case). Classification (truth/neutral/false) is read
directly from a reserved _classification key in the user's own JSON,
inherited down the tree, and drives a real, persistent highlight
mesh — reusing the exact same "backface, slightly larger duplicate"
technique already proven for genealogy outlines. Real material
overrides (metalness/roughness/emissive) now flow through
_buildMesh.

A real bug caught mid-build: OmniNode's own omni:node-create-request
handler builds its object field-by-field from e.detail rather than
spreading it, so the new material/classification fields were
silently discarded there even though _createNode and _buildMesh both
correctly supported them — caught by the test actually creating a
node and checking its real material, not by inspection. Fixed by
adding the fields to that explicit list.

Also worth recording: the vault and text-color fixes went missing
from the working tree between this session's two turns and had to be
reapplied from scratch — cause not fully diagnosed, but every other
real change from every earlier turn was spot-checked and confirmed
genuinely intact, so this appears to have been isolated to those two
specific edits rather than a broader loss.

16 checks, all passing after both real fixes above.

### V116
OmniRealityGridPointSelector built — real sibling to
OmniRealityGridSelector (`systems/OmniRealityGridPointSelector.js`,
`ui/OmniRealityGridPointSelectorPanel.js`). Same real floor-plane
raycast, snapped to the nearest vertex (round) instead of the
nearest cell (floor). Local subdivision — a selected cell's own
anchor points can be densified (2x/4x/8x) without touching the
floor's own global 20-unit grid at all, confirmed by keeping the
subdivision map keyed per-cell rather than as a global setting.
Vertical walls grow from one real, chosen edge of an already-
selected cell (north/south/east/west), rotated in real 90° steps
rather than freely, at the same real cell size. Nexus labels — a
real canvas-texture sprite per point showing both its real world
position and its real grid-cell index, billboarding to the camera
for free via THREE.Sprite. Added to Admin's own slot 14, matching
the same, already-corrected Admin-only pattern (no separate drawer
entry). One real test bug caught and fixed along the way —
WireframeGeometry doesn't carry the same .parameters object as its
source PlaneGeometry, so the height check needed the real, computed
bounding box instead. 18 checks, all passing.

### V117
Checked before building anything: the requested keyboard-shortcuts
panel in a top "Assistance" menu already exists, fully built, fully
wired, and genuinely open to every user type — no gating found on
either the panel or the menu itself. Confirmed the real name too:
the bar itself is GlobalBar (`ui/GlobalBar.js`), with Assistance as
one of its own eight real top-level categories.

Two real, genuine problems found and fixed while verifying it,
rather than left alone: the shortcuts list itself had gone stale —
missing 't' for OmniTranslator entirely, added since this panel was
last touched. And, more importantly, the real r/f vertical-movement
handler was found to have zero typing guard at all — missed by the
earlier, session-wide typing-guard audit because it compares
e.code ('KeyR'/'KeyF') rather than e.key, a different style than
every handler that audit actually checked. Same real bug class as
the earlier backtick/Escape fix: typing the letters r or f in any
real text field was disabling orbit controls and moving the camera
vertically mid-type. Fixed with the same, already-proven guard
pattern used elsewhere in the file.

### V121
OmniBotProgram built — the real entity behind OmniNavi
(`systems/OmniBotProgram.js`, `ui/OmniProgramPanel.js`). Spawned
through the exact same omni:node-create-request pipeline every
other node uses (real fix needed along the way: base.context is
frozen and has no omniNode reference, so OmniNode had to be passed
in as a real, separate constructor argument, matching Jsonifier's
own established pattern, rather than assumed to live on context).
All four confirmed physical parts real: cube head with an embedded
CanvasTexture panel (the same real technique already proven twice
elsewhere), sphere body, stateCommunicator as its own separate
object above the head with a real, simple dot-eye face. Basic tier
gets a real, continuous idle loop (bob + spin); Intelligent tier
intentionally left with no defined behavior, per direct instruction
to leave it open-ended. Wired into the Developer menu's Dev02 slot
and the Left Drawer's ⟐OmniNavi entry, both real, dual paths into
the same real panel — Dev01 left as a genuinely honest, labeled
placeholder since OmniCommandTerminal has no real panel to wire to
yet. 19 checks, all passing — one real test-assertion bug caught
and fixed along the way (miscounted the real stateCommunicator's own
children: 3, not 2 — the sphere itself plus two eyes).

OmniTranslator's own real message-thread work (Messages as a
notification type, addressor sub-grouping, promotion into a
bookmarkable Jsonifier structure) deliberately deferred — a real,
separate, substantial build on its own, not started this pass.

### V122
OmniCommandTerminal built for Dev01 — Part 2 of its own design doc
(the command language), not Part 1 (tunnel visual) or Part 3
(OmniSense-level symbol vocabulary), both real, deliberately
separate, unstarted work. Real ⟐ grammar parser
(`utils/CommandParser.js`), a shared command registry matching the
same real pattern already proven this session
(`utils/CommandRegistry.js`), and the real seven-command starting
set already hinted at in TerminalTunnel.js's own placeholder text
(`systems/OmniCommandTerminalCommands.js`) — help, ls, cd, create,
inspect, present, pocket — each a real translation of typed text
into the exact same event a button click already triggers (ls reads
OmniNode's own registry, cd reuses goToObject, create dispatches
omni:node-create-request, inspect/present reuse omni:node-selected/
omni:structure-focus, pocket calls OmniGrab's own real sendToHand).
The doc's own three open questions each given a real, stated
default rather than left blocking: help stays flat, cd maintains a
real persistent context (shell-cwd shape), failed commands get a
real visible error echo. One real mistake caught and fixed while
building — pocket's own handler initially tried importing
sendToHand as a standalone export; it's a real instance method on
the OmniGrab class, fixed by calling it on the real, passed-in
instance instead. 18 checks, all passing.

Separately: OmniInputMonitor ("buttonReader") moved from Admin's
slot 4 to the Developer menu's slot 3, per direct request — the
panel itself listens for the same real nav-select label regardless
of which menu dispatches it, so no changes were needed to
InputMonitorPanel.js itself, only to which button triggers it.

### V126
OmniEmotionParticles built — a real, continuous, camera-attached
particle system reflecting the user's current emotional/UX state,
confirmed as a genuinely different job from StateTransitionParticles
(that one's own header explicitly says it assists state changes,
not a continuous mood display — checked directly before building
this as its own, separate module rather than extending that one).
Config-driven from a new `data/OmniEmotionStates.js`: 9 states named
directly (Normal Walking, Dash, Scared, Mad, Sad, Happy, Peace,
Chaos, Thinking/Passive), 4 more proposed per direct invitation
("any other you feel like would be necessary") — Confused, Excited,
Focused, and Alert (the last one system-level rather than strictly
emotional, but the same real particle mechanism genuinely fits
error/failure feedback). Normal Walking and Dash both genuinely
scale off StepMarker's own real speed, the same real signal
StateTransitionParticles' own Trail already uses — standing still
produces few/no particles, real movement produces real ones. Seven
real, distinct motion types implemented (drift, scatter, pulse,
sink, bounce, orbit, chaos, converge, flash) so each state reads
differently, not just differently colored. Real, smooth crossfade on
state change rather than a hard cut. Reuses the exact same proven
techniques as StateTransitionParticles (pooled BufferGeometry,
additive-blended glow texture) rather than a second, parallel
particle approach.

Dev_FPS_Exp_ListOfEmotions built alongside it — real Dev04 panel,
one button per state for live testing, named exactly as given.

14 checks, all passing — two real test bugs caught and fixed along
the way: dash needed the same movement-state exclusion as
normalWalking in the "must spawn particles" check (both are
correctly speed-driven, not always-on), and a real, positive check
was added confirming movement genuinely does produce particles for
those two states, rather than just excluding them silently.

### V127
Two real fixes and one real activation. ChronosRealityNode's default
white disc — confirmed as "the white bottom thing in the cylinder,"
the large reality-node traveling through RootSpace's own tunnel —
was opaque white (0.9) before any real texture was ever set. Now
starts fully invisible and only becomes visible once setTexture
actually gives it something real to show, matching the project's own
established honest-empty-state discipline. OmniHand made active —
confirmed directly it was never imported anywhere in main.js despite
being fully built; all four real hands (omnihand/conscious/lh/rh)
now instantiated. The "3 pages per hand, increase to 10" and
"OmniDraw as first item" requests were not acted on — checked
directly and no paging concept exists anywhere in Hand.js at all;
flagged rather than guessed at, since building a wrong paging system
would be real, avoidable rework. 6 checks, all passing.

docs/dev/Roles/Developer/TestingChecklist.json created — a real,
comprehensive, structured testing checklist covering every feature
built this session, grounded directly in BuildLog.md rather than
memory, with a real howToReach/whatToCheck pair per item rather than
a vague "does it work" list.

OmniChronos's own design doc updated with the requested JSON
timeline idea — confirmed no such concept exists yet (OmniChronos
currently only controls enabled/Z-axis/transparency/time format);
documented with a real, natural hook already in place
(ChronosRealityNode's Y-position already maps directly onto
PrimaryTime), not yet built.

### V141
⟐OmniSelect Group/Ungroup/Merge/Duplicate and a real edge-style system
built, from a detailed multi-round scoping conversation. Groups are
REAL nodes (`isGroupNode: true`) whose mesh is the actual Object3D
parent of every member mesh (via `.attach()`, reusing the exact same
reparenting mechanism the Domain/Space container system already
used) — not a display-only list. Selecting a group, or any one of its
members, highlights the whole set at once (emissive + a backface
outline mesh, a direct structural mirror of the existing Ξ genealogy-
highlight technique, using its own distinct color/scale so the two
never look identical).

New in `systems/OmniNode.js`: `_createGroup`, `_ungroupMembersOnly`,
`_ungroupNode`, `_mergeGroups`, `_duplicateGroup`, `_highlightGroup`,
`_clearGroupHighlight`. Ungroup releases members back to their real
pre-group home (a domain/space, or the top-level scene — tracked via
a new `preGroupSpaceId` field) rather than losing that information.
Merge dissolves every source group down to its real leaf members
first, then re-groups the union into one new flat group — deliberately
flattening rather than nesting empty group-of-group shells. Deleting
a group node now reparents its members back out first, so they can
never be silently hidden along with the group's own mesh (three.js
removes a mesh's entire child subtree when it's removed from the
scene — this was caught and fixed before it ever shipped, not after).
A real zero-scale `.attach()` hazard was caught the same way:
`_createNode()`'s own materialize animation sets the mesh to scale
(0,0,0) before a deferred tween grows it, and attaching a child to a
zero-scale parent is a singular transform that would corrupt every
member's local transform — `_createGroup` kills that tween and sets
the real target scale synchronously before attaching anything.

UI: `ui/OmniSelector.js`'s Inspector request now carries `groupedIds`
(not just display labels) and the volume's own `geometry`.
`ui/OmniSelectorInspector.js` gets a "⟐ Group These" button (shown
once 2+ nodes are inside the volume), reusing the volume's own
geometry/color/wireframe for the resulting group shell.
`systems/OmniInspector.js`'s per-node-type custom-options registry
(previously MasterClock-only) now also renders a GroupNode section:
member list, Ungroup, Duplicate Group, and a Merge-with-another-group
dropdown.

Edge styling: edges stay real tapered cylinder meshes, per this
file's own existing cross-browser-consistency rationale (native
WebGL line width is unreliable — most browsers ignore `linewidth`
entirely) — but every edge now carries a real, persisted style
(`localStorage['omni:edge:styles']`, keyed by `from__to`): kind
(cylinder / a genuinely thin cylinder called "line" / double),
per-edge color, thickness, dashed on/off, and an optional highlight
halo + color. 'double' and 'dashed' are built via manual
`BufferGeometry` merging rather than `THREE.Group` or multiple
objects, specifically so every edge kind still resolves to exactly
one `Mesh`/one geometry — required to avoid breaking the three
existing call sites that rebuild edges in place
(`_rebuildEdgesFor`, the node-move handler, and the storage-restore
loader) and all assume exactly that shape. Clicking an edge directly
in SELECT mode (when no node is hit) now opens the new
`ui/OmniEdgeInspector.js` panel; a "✎" button was also added to each
row of ⟐OmniNode's own existing edge list for direct discoverability
without needing to aim a click at a thin mesh in 3D. The panel writes
through `omni:edge-style-set`, following the same "external panel
writes through the owner module" pattern already used for MiniMap/
Floor settings.

Honest gap carried forward, not fixed this pass: the original,
separately-agreed "true per-shape containment" for ⟐OmniSelect
(a real per-geometry math test for Sphere/Octahedron/etc., replacing
today's identical AABB-only test regardless of which shape is
picked) was explicitly agreed to but not built — the conversation
pivoted to Group/Edge instead once the actual, more detailed request
took shape. Still open, not forgotten.

### V142
"Essence Data" — the first Omni Claim node type — built as a new
pickable entry in ⟐OmniNode's existing geometry picker grid (added to
`GEOMETRY_DEFS`/`GEO_LABELS`/`GEO_ICONS`, same as any other shape; the
grid auto-generates from those keys, so no separate UI was needed).
Placing one seeds it as `isEssenceNode: true` with a Domain (the
declared perspective/story a claim is made from), a default set of 5
evidence questions ("What is this claiming?", "What would make this
false?", etc, freely extendable), and an evidence array that starts
all-`null` — Undefined, by design, until real evidence exists.

Deliberately NOT an objective truth-verification system — there's no
attempt here to adjudicate universal fact, and that's an intentional,
discussed scope boundary, not a shortcut. What's real: each evidence
entry is a question answered with a stance (Supports Truth / Supports
False / Neutral), and the node's own state — Truth / False / Undefined
— is COMPUTED from a tally of those stances (`_computeEssenceState`),
never hand-set. A tie stays Undefined rather than guessing a side.

The node's own geometry (a subdivided icosahedron) grows small evidence
"studs" over its surface — one per question, spread evenly via a
fibonacci-sphere distribution regardless of how many questions a Domain
ends up with. Filled and colored by stance when a question's answered,
dim and hollow when it's not — so an incomplete claim is visibly
incomplete on the shape itself, not just buried in a panel. A
persistent state-color halo (the exact same backface-duplicate
technique as the existing truth/false classification highlight)
reads the claim's resolved state at a glance; it's a real separate
mesh rather than an emissive tint specifically because emissive is
already owned by node selection (`_selectNode` resets it to black on
deselect) — a halo survives selection changes cleanly, emissive
wouldn't have.

`systems/OmniInspector.js` gets a new "◈ Omni Claim" section (same
per-node-type custom-options registry the GroupNode section already
uses): Domain name/story fields, one row per evidence question with
an answer field and a stance dropdown, a computed (read-only) state
badge, and an "+ Add" control for appending custom questions beyond
the default 5. Edits flow through a new `omni:essence-evidence-set`
event, same "external panel writes through the owner module" pattern
as edges and groups — the Inspector never computes or sets state
itself, only ever submits raw evidence.

Real gaps, flagged rather than built around: there is no live/external
evidence feed (a real review API, a real supply-chain integration) —
evidence is only ever user-entered for now, appendable over time but
not automatically sourced. And there is no cross-referencing between
a claim's Domain and other Omni products/perspectives yet — the
Domain is a freeform name+story today, not yet a structured link into
the rest of the system. Both were discussed as genuinely open, bigger
pieces ("I'm probably in the middle of building that," re: an actual
verification protocol) rather than promised for this pass.

### V143
Four real, separate changes, plus one Developer Queue addition
(item 44, event-triggered wallpaper — documented, not built, see
DeveloperQueue.md).

**Duplicate + Delete on every node type** (`ui/ToolTipMenu.js`): real
gap closed — neither button existed anywhere before this, for any node
type (not a gating bug, a genuine absence). "⧉ Duplicate" and "🗑
Delete" now sit in the same quick menu every node already gets.
Delete reuses the existing `omni:node-delete-request` event Inspector's
own delete already dispatches. Duplicate is new:
`systems/OmniNode.js`'s `_duplicateNode(id)` clones a node's data with
a small world-space position offset so the copy never stacks exactly
on the original; a group node defers to the existing `_duplicateGroup`
instead (it needs its members cloned too, not just its shell); Essence
Data's domain/questions/evidence are deep-copied, not shared by
reference, so editing the copy can't silently edit the original.

**Right-click context menu on 3D nodes** (Developer Queue item 5,
now resolved): `systems/OmniNode.js`'s `_bindRaycast()` gets a real
`contextmenu` listener alongside its existing click/mousemove ones —
same raycast, same `_selectableMeshes()` hit-test the ordinary click
already uses — dispatching `omni:node-contextmenu-request { id, x, y }`
on a hit. `ui/ToolTipMenu.js` listens for it and opens its own
existing quick menu (the same one now carrying Duplicate/Delete)
pinned to the cursor position instead of the node's own floating
header — one real menu system serving both trigger paths, not a
second, competing one.

**Dash speed 2x → 3x** (`ui/MovementPad.js`, `ui/CameraMovementOptionsPanel.js`):
`_dashMultiplier` default raised from 2 to 3, plus both of its stored/
saved-settings fallback defaults (`?? 2` → `?? 3`, `|| 2` → `|| 3`) so
a fresh install and the Admin panel's own fallback agree with the new
default rather than silently disagreeing with it.

**Dash button z-index matched to the LH Menu** (`ui/MovementPad.js`):
was `z-index: 55` (rendering above the hand matrix it docks beside);
now `z-index: 40`, matching `ui/Hand.js`'s `.omni-hand` container
exactly, so the dash button and the LH hand it sits next to now share
the same stacking plane.

### V144
MiniMap position options — real gap closed: the settings panel only
ever offered the 4 corner combinations (Top Left/Top Right/Bottom
Left/Bottom Right); a genuine ask for plain standalone Top/Bottom/
Left/Right edge-center anchors, distinct from the corners, had no way
to be satisfied. `ui/MiniMap.js`'s `_applyCorner()` now handles 8
positions total — the original 4 corners plus 4 edge-centers (each
horizontally or vertically centered via `left/top: 50%` +
`translate(-50%)`, cleared the same way the corner cases already
were). `ui/MiniMapSettingsPanel.js`'s position grid lists all 8; field
label changed from "Corner" to "Position" since it's no longer
corner-only. `utils/MiniMapSettings.js`'s stale comment (only 4 values
listed) corrected — no actual validation logic existed to update,
just a comment describing fewer options than were real.

OmniNode had no way to open — real gap found and closed. Its panel
(`systems/OmniNode.js`, holding the "+ Add Node" geometry picker,
Essence Data included) only ever listened for
`omni:system-toggle { system: 'omninode' }`. Audited the whole
codebase for anything that dispatches that event with `omninode` and
found nothing: no menu entry, no keybind, no working portal. A "⟐N"
portal sphere exists in `modules/PortalSpheres.js` / mirrored in
`ui/OmniMapPortals.js` (so it shows on the MiniMap), but its click
handler only plays an expand/shrink animation — the code's own
comment says "Phase 5 will intercept here for actual traversal," i.e.
it was stubbed and never finished. So there was genuinely no way to
open OmniNode from the running UI.

Fixed for now the direct way: `ui/OmniDrawModePicker.js` (opened by
'n' or clicking ⟐OmniDraw) gets a 7th button, "OmniNode — the real
node registry, Essence Data and every other type." Unlike the other
six modes (which all dispatch `omni:nav-select` with a label),
`_choose('omninode')` dispatches the real
`omni:system-toggle { system: 'omninode' }` event directly, since
OmniNode doesn't listen for nav-select at all. This is a stopgap
placement, not a structural fix — OmniNode is a full node-type
registry, not one more "draw mode" alongside Static/Dynamic/
Jsonifier/etc., and it still doesn't touch the unfinished ⟐N portal
sphere. Both are worth a real decision later.

### V145
Hand radial menus — apps moved from page 1 to page 2, all four hands.
`ui/RadialMenu.js`'s `TOOLS` table had every hand's 10-item app list
sitting on `⟐1`, with `⟐2`/`⟐3` both null — per direct request, swapped:
`⟐1` is now null (blank) and the real lists live on `⟐2`, for
omnihand, conscious, lh, and rh alike.

Real wrinkle caught and fixed, not just a data swap: page availability
was hardcoded (`available = (page === '⟐1')`), so page 1 was the only
clickable page and the other two were locked (red "locked" flash on
click, no switch) — moving the data alone would have made the apps
permanently unreachable. Flipped the lock to page 2 instead (now the
real, usable page) and changed each hand's default `page` state from
`'⟐1'` to `'⟐2'` so the menu opens where the content actually is.
`_buildOuterRing`'s initial tool render (previously hardcoded to read
`TOOLS[handId]['⟐1']`) updated to read `'⟐2'` to match.

This lines up with an existing note in `docs/planning/BACKLOG.md`:
page 1 is planned as a future search + Metroid-Prime-style scan
feature, page 3 as an OmniKeyboard launcher — neither built yet, both
still correctly empty/locked after this change, now for the right
reason (reserved for a specific planned feature, not just unfinished).

### V146
Sequence Node — the first real piece of "a presentation in 3D, every
slide a node, every transition a drawn connection" (direct request).
Scope deliberately kept to the single-chain Presentation tier tonight;
nesting/branching/Expression are documented, not built (see
`docs/architecture/SEQUENCE_NODE.md`).

What's new, concretely:
- `systems/OmniNode.js` — `isSequenceNode` + `cameraMode` ('focus' |
  'free') added to node data. Any existing geometry can become a
  Sequence Node via a new Inspector toggle; nothing about placement or
  geometry changed.
- Drawing an edge between two Sequence Nodes in ⟐N's existing PATH
  mode is how "it changes to" gets set — reused rather than building a
  second picker. That edge renders in a dedicated amber/dashed style
  (`SEQUENCE_EDGE_STYLE`) so a presentation path reads as itself on
  sight. `_connectNodes` now enforces "only one, for now": drawing a
  new outgoing sequence edge from a Sequence Node replaces its old
  target instead of branching.
- Turning the toggle on for the first time sets `wireframe: true` once
  (never re-forced after) — the "wireframe for the initial build" look
  — and that now correctly survives a page reload (it previously
  wasn't in the node-restore path at all for ordinary nodes; fixed in
  the same pass).
- A new `omni:sequence-updated` event carries just the Sequence-Node
  edge chain, kept deliberately separate from the existing generic
  `omni:path-step` so an unrelated edge drawn anywhere else in the
  scene can never be mistaken for part of a presentation.
- `systems/OmniPresenter.js` — `_loadSequenceChain()` walks that chain
  the same way `_loadPathSequence()` already walked PATH-mode edges
  (found, not built new — the algorithm already existed). Bootstraps
  from storage at startup too, so a saved Sequence Node chain is live
  the moment the page loads, not only after the next edit.
- Per-node camera mode is respected on arrival: Focus (the default
  once a node becomes a Sequence Node) keeps orbit suspended — the
  scripted "presenter talking to camera" framing for tutorials; Free
  hands orbit back immediately. Every node that was never a Sequence
  Node keeps today's existing behavior (orbit always returns),
  unchanged.

Inspector section follows the same per-type pattern Essence Data set
in V142 (`_customOptionsHTML`/`_wireCustomOptions`), generalized
slightly so it can show up for ordinary nodes too, not just one
special type.

**Same-day follow-up** — Sequence Node is now also in `ui/OmniDraw.js`'s
own schema (the dat.GUI-style `SCHEMA` array every container object is
built from), not just the post-creation Inspector. A new "Sequence"
group — `isSequenceNode` toggle + `cameraMode` select — right after
Core, and `_exportToScene()` now carries both through to
`omni:node-create-request`. `systems/OmniNode.js`'s `_onCreateRequest`
reads them with the same defaults as everywhere else
(`isSequenceNode ?? false`, `cameraMode ?? 'focus'`), and `_createNode`
applies the same one-time wireframe default when a node is born already
flagged, not only when toggled on afterward. Nothing else in SCHEMA
needed touching — `_data`, `_persist`/`_loadPersisted`, and row
rendering are all already fully generic over whatever's in the array.

**Next-morning follow-up** — two small, real fixes:

1. **OmniDraw's wireframe/alpha/material-type gap, actually fixed now.**
   `_exportToScene()` now includes `wireframe`/`alpha`/`material` in its
   `omni:node-create-request` payload; `_onCreateRequest` passes them to
   `_createNode`; a new shared `_applyAppearanceFlags(mesh, data)` applies
   wireframe/transparency/material-type-swap to the real mesh, called from
   both `_createNode` (fresh) and `_load` (restore) so the two can't drift
   — the exact bug class already found twice before in this file
   (rotation/scale, domain double-sided material) for the same restore
   path. Sequence Node's own wireframe default now runs through this same
   shared helper instead of its own separate inline patch.

2. **MiniMap Visible toggle, in Map Settings.** `ui/MiniMapSettingsPanel.js`
   had "Visible on Start" (next-launch only) and the 'm' key (live, but
   not in any panel) — no live on/off *in the settings panel itself*. Added
   a "MiniMap Visible" row above it; dispatches `omni:minimap-visibility-set`,
   picked up in `main.js` (the only place holding the real `MiniMap`
   instance) which calls its existing `setVisible()`. The checkbox also
   listens to `omni:minimap-toggle` (already broadcast on every real
   change) so it stays honest if visibility changes some other way — the
   'm' key, or this same control — while the panel's open.

**Same-day, third pass** — OmniPanelTray, the new universal minimize
destination (full design discussion + this build in `docs/architecture/
OMNIPANELTRAY.md`). Replaces `ui/PanelIcon.js`'s free-floating orb +
Dock's old center-tray pipeline — confirmed first that all 40+ panels
already dispatch the identical `omni:panel-minimized` event, so this
could be a single-consumer swap rather than a per-panel migration.

- New `ui/OmniPanelTray.js`: Flat form (1–3 rows, row 1 always on),
  Expand/Collapse, Filter/Sort/Search header toolbar, drag-and-drop +
  context menu (Maximize/Close/Move) per tab, orientation (bottom/top/
  left/right — same idea as relocating VS Code's terminal panel).
- `ui/Dock.js` gets a small ▲ toggle in its right wing — the one place
  the Tray opens/closes from, regardless of its own orientation.
- `ui/PanelIcon.js`'s `omni:panel-minimized` listener is disabled (not
  deleted) — see its own header note.
- **Real bug found and fixed**: `ui/WindowManager.js`'s new
  `restorePanel(id)`. Checked how many panels actually listen for
  `omni:panel-restore` (the old orb's restore event) — only 5 of 40+
  that dispatch `omni:panel-minimized`. Most standalone panels had no
  way back after minimizing through the old orb at all. `restorePanel()`
  fixes this for every panel at once by working directly off
  WindowManager's own registry, not the spotty per-panel contract.
- File-cabinet (grouped, Z-depth) form and the full style pass (cyber
  tab shape, edge-fade quick-settings cluster) are deferred by direct
  agreement — see `OMNIPANELTRAY.md` for exactly what and why.

**Same-day, fourth pass** — documentation only, no code:
`docs/architecture/SOUND_DESIGN_ARCHITECTURE.md` written, prompted by
two commercial sound packs ("Boom" mechanical + modern UI) being
brought in and the real stated stakes ("this isn't a toy ... next-gen
software for communicating way more efficiently"). Confirmed first
what exists today: a flat 3-ID sound namespace (`click`/`open`/
`close`) hardcoded in `main.js`, a thin Howler.js wrapper
(`utils/SoundManager.js`) with only global volume/mute, no manifest,
no settings panel. That shape doesn't survive what's coming, so the
doc lays out the target architecture before any file gets touched:
four classes (Ambience/Field, Earcons, Event SFX/Stingers, Entity
Signatures — the last an emergent composite of the other two, not its
own sound set), a `semantic`/`decorative` role tag cutting across all
four, and a hard, non-stylistic complexity ceiling specifically for
the Earcons class, grounded in real earcon/accessibility research (a
few dozen distinct sounds is the real limit humans can reliably parse
under pressure) — direct consequence of accessibility now being an
explicit design pillar, not an afterthought, since a rigorous enough
system means someone could navigate by sound alone. Also records the
borrowed-trope idea (reverse/static/pitch-bend sounds given one fixed
permanent meaning each), the open question of whether Earcons should
map onto The 32, and the performance direction for whenever this is
actually built (manifest-driven, theme-swappable, lazy-loaded,
variation pools, per-category volume) so those constraints don't have
to be re-derived later. Explicitly design-stage only — no manifest, no
SoundManager changes, no file reorganization yet.

### V147
Four real pieces, all for one stated use case — presenting on a
classroom TV through a Logitech MX Ergo as the only input device in
reach. Full design in `docs/architecture/CRYPTXMODE_AND_PRESENTATION_
CONTROLS.md`.

- **Orbit right-click-drag panning**: `modules/OrbitModule.js`'s
  `enablePan` flipped on. **Real bug caught in the same pass**:
  `systems/OmniNode.js`'s canvas `contextmenu` listener fires on
  mouse-up regardless of drag distance, so a right-drag pan ending
  over a node would also pop that node's quick menu. Fixed with a
  drag-distance guard (tracks the real right-button-down point,
  skips opening the menu if the release moved more than ~6px).
- **Detachable LH/RH movement pads**: `ui/MovementPad.js` — a 3-button
  satellite cluster (Release / Dash, moved in from its old standalone
  spot / an inert TBD slot) on each movable pad's own rim, LH at
  3–6 o'clock, RH mirrored at 6–9 o'clock. Release detaches the whole
  group (cross + satellites, one shared GSAP offset) into a
  draggable floating panel; pressing it again snaps it back. Position
  persists per-browser across reload, resets for a different user/
  machine (plain localStorage, as requested) — OmniCustomLayout is the
  real cross-everything answer, noted for later.
- **⟐ Quick Launcher**: new `ui/OmniQuickLauncher.js` — a draggable ⟐
  icon anywhere on screen; clicking (not dragging) it opens a small
  radial popup, built fresh rather than extending `ui/RadialMenu.js`
  (that file is hardcoded to 4 corner-anchored hand menus, not an
  arbitrary dragged point). One entry today, ⟐Keyboard, in a plain
  array so a second tool later is one entry, not a refactor. Found
  along the way: `RadialMenu.js` already reserves a page for "the
  planned OmniKeyboard launcher," unbuilt — not used here (this is a
  different, 5th menu), but worth knowing it was anticipated once.
- **CryptxMode**: new `ui/OmniKeyCryptxReveal.js` — a genuinely new
  keyboard, not a third view of `OmniKeys.js`'s existing QWERTY/
  OmniKryptx toggle, confirmed directly ("completely new and different
  idea... from scratch"). Docks at the right edge, starts collapsed to
  a meta header, each reveal press exposes one more vertical column
  (Control first — Space/Backspace/Enter are the highest-frequency
  presentation actions — then the letter rows, then digits, then
  symbols), each column scrolling independently if taller than the
  panel. Typing reuses `OmniKeys.js`'s own exported `classifyChar()`/
  `computeCode()` so committed characters dispatch the identical
  synthetic-`KeyboardEvent` shape OmniKeys already uses. Lowercase
  only in this pass — a stated scope decision, not an oversight.
  MX Ergo's native back/forward buttons are mode-scoped: R/F height
  control (reusing MovementPad's existing keydown path untouched)
  when CryptxMode is closed, reveal/retract a column when it's open;
  scroll wheel moves the column selection, left click commits, right
  click retracts, middle click closes. Documented, known limitation:
  some browser/OS combinations intercept those buttons as real page
  navigation before JS sees them outside fullscreen — worth confirming
  live on the actual classroom setup.

### V148
Real bug fixed, found while walking the user through how Sequence
Node/OmniPresenter actually works end-to-end: `systems/OmniPresenter.js`
listens for `omni:system-toggle { system: 'omnipresenter' }` (its own
documented open mechanism), but nothing anywhere in the app ever
dispatched it — no button, no menu entry, no keybind. The only way to
open the panel at all was calling `omniPresenter.open()` directly.
Fixed with a `main.js` keybind on `p` (unbound, confirmed via the
compiled shortcuts list), dispatching that exact event — same pattern
`n` already uses for OmniDraw/OmniNode. Added to
`ui/OmniKeyboardShortcutsPanel.js`'s own compiled list too.

### V149 — "bug squashing mode"

Two real, confirmed regressions from V147's own new features, both
caught by direct inspection rather than guessed at, plus three new
builds.

**Bugs fixed:**
- `ui/OmniQuickLauncher.js` — the `.oql-launcher` element never set
  `pointer-events: auto`. `#omni-ui` (its shell parent, per
  `index.html`'s real, non-fallback CSS) sets `pointer-events: none`
  on itself so the canvas stays interactive through the UI layer;
  every interactive child has to explicitly opt back in — the
  established pattern everywhere else (`RadialMenu.js`'s
  `.radial-item`, `MovementPad.js`'s `.omni-pad-sat`). This one never
  did, so it silently never received a single click. Confirmed by
  reading `index.html` line 56 directly, not assumed. Fixed by adding
  the declaration. Also relocated its default (first-boot, no saved
  position yet) spawn point from top-center to the exact center of
  the bottom Dock — "kind of like apple's hold-home-button on their
  legacy phones," per direct request.
- `ui/MovementPad.js` — two issues on the satellite cluster (Release/
  Dash/TBD):
  1. `.omni-pad-sat` had `z-index: 40`, one below `.omni-pad`'s own
     `z-index: 41`. Each satellite sits just outside the pad's
     circular edge by design, but a square button's own corner
     nearest the pad genuinely dips a few px inside the pad's
     bounding circle at the diagonal (Dash) position — confirmed by
     working through the real `_buildSatGeom` geometry by hand, not
     assumed. With the pad stacked above there, that corner silently
     ate clicks. Fixed by moving satellites to `z-index: 42`, strictly
     above the pad.
  2. `_setDetached()` only ever set `aria-pressed` on the Release
     button (screen-reader-only, invisible on screen) and never
     toggled the same `.is-active` glow class `toggleDash()` already
     applies to itself. The pad's own `is-detached` box-shadow bump is
     subtle enough that clicking Release genuinely looked like
     nothing happened. Fixed by toggling `.is-active` on the Release
     button too, matching Dash's existing, working feedback.

**Built:**
- `ui/OmniKeys.js` — added a `KryptxKeyboard` entry to OmniKeys' own
  top menu/header row (`#ok-modes`, first in the lineup), as a second,
  independent opener for CryptxMode that doesn't depend on the ⟐ Quick
  Launcher. Dispatches the same `omni:cryptx-keyboard-toggle` event
  the launcher's own Keyboard tool uses. Deliberately not a real
  `data-mode` button — it doesn't touch `this._mode` or the QWERTY
  grid, just opens the separate Kryptx panel.
- `ui/OmniMeter.js` — new file, replaces `ui/OmniVerticalMeter.js` as
  the thing `main.js` instantiates (that old file is left in the repo
  untouched; its track/tick/marker math is what this one reuses for
  the Vertical/Y indicator). Two new siblings join it: a Horizontal/X
  track along the top of the screen, and a Depth/Z line running from
  the top edge down to screen-center. All three consolidate under one
  ⚙ settings popover — per-axis show/hide checkboxes, plus a toggle
  between Horizontal/Vertical/Depth and plain X/Y/Z labels (either
  naming was fine per direct request). Range is ±525 on every axis —
  half of `WallpaperSphere.js`'s own `BASE_SIZE` (1050) — centered on
  each axis's own real rest value (Y on `CENTER_Y`, X/Z on world
  origin), per direct request: "as large as the wallpaper is. Actually
  half that. So the user doesnt feel like that have an infinite
  boundary."
- `systems/OmniTrackingNodes.js` — new file. Two scene nodes moving on
  a continuous Lissajous-style path (X oscillates at twice Z's
  frequency — "two iterations for the x and one for the z" — plus an
  independent Y bob, "the Y is actually good too"), each trailing a
  short-lived pool of fading/shrinking ghost meshes as a motion-trail
  afterimage. Clicking a node locks the camera onto it — a real
  follow-cam that keeps whatever relative angle the user approached
  from and lerps toward it every frame — suspending `OrbitControls`
  via the app's own existing `omni:orbit-disable`/`omni:orbit-enable`
  event pair (same mechanism `CameraTravel.js`/`OmniPocket.js` already
  use), and reporting the lock through the same `omni:node-selected`
  event every other selection path dispatches — so the existing
  Z-Targeting reticle (`modules/OmniTargeting.js`) shows up around the
  locked node automatically, no second targeting system built.
  Clicking the locked node again, or clicking empty space, releases
  it back to free orbit — direct reference to Zelda's own Z-targeting
  feel.

### V150 — real movement pads for OmniHand/ConsciousHand

Direct request: "create movement pads for the conscioushand and
OmniHand and adjust the tool context with each hand to mirror the lh
and rh." Previously both were `PAD_CONFIGS` entries with
`movable: false, keyboard: null` — a visible but fully inert "TBD"
cross with no listeners attached at all (`_buildDirBtn`'s own
`isTBD = !cfg.movable` gate skips wiring entirely). Each hand already
had its own real ⚇ pad-toggle button in `ui/Hand.js` though
(`topRow` includes `'pad'` for all four hands, not just LH/RH), so
toggling it previously just revealed an empty, non-functional cross.

**`ui/MovementPad.js`:**
- OmniHand (top-left) now mirrors LH (bottom-left)'s translate-move
  semantics; ConsciousHand (top-right) mirrors RH (bottom-right)'s
  altitude+orbit NAV semantics — same functional pairing the corners
  already visually suggest. `_applyLHMovement`/`_applyRHMovement`
  generalized into `_applyTranslateMovement(cam, delta, handId)` /
  `_applyNavMovement(cam, delta, handId)`, called for both hands in
  each pair rather than duplicating the logic. Dash stays an
  LH-exclusive modifier (only applied when `handId === 'lh'`) — OmniHand's
  own Dash satellite slot is inert, same as RH's always was.
- New keyboard bindings, chosen to avoid every already-bound key
  (checked against `OmniKeyboardShortcutsPanel.js`'s compiled list and
  `main.js`'s `HAND_KEY_BINDINGS`, which already claims Numpad1-4 for
  the hand-menu shortcuts): OmniHand uses the numpad's operator row
  (`/` `*` `-` `+` → up/down/left/right); ConsciousHand uses Numpad7/9
  (up/down only — mirrors RH's own R/F, which also only binds
  up/down, never left/right).
- Satellite clusters (Release/Dash/reserved) now build for all four
  movable hands, not just LH/RH — `_buildAllSatelliteClusters`,
  `_persistDetachState`/`_restoreDetachState` generalized from a
  hardcoded `['lh','rh']` to `Object.keys(PAD_CONFIGS).filter(id =>
  movable)`. Release is wired for all four (full detach/re-dock
  parity); Dash stays visually present but inert on every hand except
  LH, matching the pre-existing RH behavior.
- Satellite rim geometry (`_buildSatGeom`) generalized to support
  top-anchored pads, not just bottom-anchored ones — LH/RH's cluster
  leans inward-and-down toward the bottom-center gap near the Dock;
  OmniHand/ConsciousHand's leans inward-and-up toward the top-center
  gap instead (the straight-down 180° reserved slot becomes
  straight-up 0°, Dash's diagonal flips from 135°/225° to 45°/315°).
  Release stays nearest screen-center either way (90°/270°).

**`ui/Hand.js`:** `padFunction` labels for OmniHand/ConsciousHand
updated from the old placeholder text ("Switch axiomatic app" /
"Switch axiomatic spatial function") to describe what their ⚇ button
actually opens now.

**`ui/RadialMenu.js`:** "adjust the tool context... to mirror the lh
and rh" — OmniHand's own `⟐2` radial tool list now mirrors LH's
(Translate3D/Rotate3D/Scale3D/OrbitControl/...); ConsciousHand's
mirrors RH's (ColorShift/MaterialMorph/ShapeBlend/...). Each hand's
own `abbr`/`color` identity is untouched — only the tool content
mirrors, same pairing as the pads themselves. Confirmed via direct
inspection that tool selection here (`omni:tool-select`/`omni:tool-
deselect`) isn't consumed anywhere else yet, so this is a
self-contained content change.

### V151 — radial/pad stacking fix + satellites tied to pad visibility

Direct feedback after testing V150's new OmniHand/ConsciousHand pads.

**Real bug fixed — `ui/RadialMenu.js`:** "the tool menu for both
consciousHand and OmniHand cannot be seen if the pad is out." Root
cause: `MovementPad.js`'s own `_handleRadialToggle` deliberately bumps
a hand's pad to `z-index: 60` while that hand's own radial Tool menu
is open, so the pad stays clickable through it — but `.omni-radial`'s
own z-index was only `55`, so the pad's boost put it ABOVE the radial
popup instead, hiding it outright rather than just making it
awkward to reach. This exact bug applied equally to every hand, LH/RH
included, but OmniHand/ConsciousHand's pads used to sit at
`opacity: 0` permanently (`movable: false`, TBD), so the overlap was
never visibly real until V150 gave them genuine, visible pads. Fixed
by raising `.omni-radial` to `z-index: 65`, above the boosted pad on
every hand, not just the two that happened to surface it.

**Built — `ui/MovementPad.js`:** "put it so that the 3 buttons for
both hands come out when the movement pads come out." The satellite
cluster (Release/Dash/reserved) used to be independent top-level
elements with no opacity tie to their own pad at all — permanently at
full opacity from the moment they were built in `init()`, regardless
of whether the pad itself was ever toggled visible. New
`_animateSatellitesIn(handId)`/`_animateSatellitesOut(handId)`,
called from the pad's own existing `_animateIn`/`_animateOut`, fade
each satellite in/out in lockstep with its pad — same timing/easing,
Release and Dash settling at full opacity, the reserved slot at its
usual dimmed 0.30. `.omni-pad-sat`'s own CSS now defaults to
`opacity: 0` at rest, matching `.omni-pad` itself, so a satellite
cluster is never visible while its pad is collapsed. This also
directly addresses the separate "the 3 buttons for the LeftHand...
are gone" report — LH's satellites were always built and positioned
correctly (confirmed by hand-computing `_buildSatGeom`'s own numbers,
unchanged from before V150), so whatever made them read as "gone" in
that particular test, tying their visibility deterministically to the
pad's own open/closed state — rather than leaving them floating
independently, with no clear signal for when they should be visible —
removes the ambiguity either way.

### V152 — OmniPresenter background spinners

Direct request: three supplied gear images as a layered, rotating
backdrop inside the ⟐p OmniPresenter panel, applied back-to-front in
this order — Gear (white), Gear (Gold), Gear (solarSystem). Assets
saved to `assets/images/gear-white.svg`, `gear-gold.svg`,
`gear-solarsystem.png`, following the same `./assets/images/...`
reference convention `modules/WallpaperSphere.js` already uses for its
own default wallpaper.

**`systems/OmniPresenter.js`:**
- New `.op-bg-spinners` layer — three `<img>` elements with no
  per-image `z-index`, so plain DOM order *is* paint order: white
  first (furthest back), gold second, solarSystem last (nearest the
  real content) — exactly the requested ordering. Each spins via one
  shared `@keyframes op-gear-spin`, at a different size/speed/
  direction/opacity so the three read as layered depth rather than one
  flat spinning image (white: 420px, 100s, forward, 0.10 opacity; gold:
  300px, 55s, reverse, 0.18; solarSystem: 320px, 75s, forward, 0.24).
- Real fix made along the way: the old `.op-panel` carried its own
  background directly (`--op-bg`, 0.93 opacity) — a child element can
  never paint behind its own parent's background, so simply adding the
  spinners as a child wouldn't have made them visible at all; the
  panel's own background would always sit behind everything, including
  the new layer. Moved that background onto a new `.op-content`
  wrapper around all the existing panel markup instead, placed above
  `.op-bg-spinners` in the same stacking context, and eased its
  opacity from 0.93 to 0.84 so the spinners actually read through it
  rather than being almost entirely blotted out. `.op-panel` itself is
  now transparent — purely a positioning/blur/border shell.
- No IDs or classes on any existing control changed — `.op-content` is
  a pure wrapper, so every existing `querySelector` binding in
  `_bindPanelControls` keeps working unchanged.

### V153 — OmniGallery: default texture gallery for nodes

Direct request: a new default gallery panel, OmniGallery, for textures
that can be put on node meshes — a ToBeSorted bucket first, then
SystemAssets with geometry-type folders underneath, selectable from
any inspector.

**New file `systems/OmniGallery.js`:**
- Built exactly to OmniPresenter's own architectural pattern: a
  floating panel constructed from a template string into a DOM node
  under `#omni-ui`, its own scoped `<style id="omni-gallery-styles">`
  injected once, slide in/out via GSAP, module contract
  (`constructor`/`init`/`update`/`destroy`). Anchored bottom-*left*
  (mirrored from OmniPresenter's bottom-right slot) so the two panels'
  default positions never overlap.
- Opens/closes via `omni:system-toggle { system: 'omnigallery' }` —
  same convention every other panel in this codebase uses — and via a
  second, dedicated `omni:gallery-toggle` event that optionally carries
  `{ select: true }` to open the panel in "pick a texture" mode (used
  by the Inspector's new Gallery button, below). `openForSelect()` is
  also exposed directly on the instance.
- Folder tree, in the literal order asked for: `ToBeSorted` (empty,
  built and rendered even though nothing is in it yet — a real,
  navigable, currently-empty bucket for future/uncategorized assets)
  then `SystemAssets → Geometries`. The Geometries folder list is
  built from `GEOMETRY_DEFS`/`GEO_LABELS`, imported straight from
  `systems/OmniNode.js` — the actual live registry of geometry types a
  node can be swapped to in this app (20 types: Box, Sphere, Cylinder,
  Cone, Torus, TorusKnot, Octahedron, Tetrahedron, Icosahedron,
  Dodecahedron, Plane, Circle, Ring, Capsule, Lathe, Tube, Extrude,
  Shape, Edges, Wireframe) — not an invented list. `EssenceData` is
  left out, matching `OmniInspector.js`'s own `GEO_TYPES` list, since
  it's OmniNode's special internal type rather than a plain geometry
  swap target.
- Left-pane tree (expand/collapse, persisted to
  `localStorage['omni:gallery:ui']`) + right-pane responsive grid of
  swatch thumbnails for whichever folder is active. Clicking a swatch
  dispatches `omni:gallery-texture-select { path, label }` on
  `window` — the path is the same `./assets/images/<file>` relative
  form `modules/WallpaperSphere.js`'s `DEFAULT_IMG_URL` already uses —
  and, if the gallery was opened in select mode, closes the panel
  immediately after, like a native file picker's "choose" action.
- Keyboard shortcut: `g` (free — checked `HAND_KEY_BINDINGS` and every
  other `e.key ===` keydown handler in `main.js` plus
  `ui/OmniKeyboardShortcutsPanel.js`'s `SHORTCUTS` array first; nothing
  else claims it). Wired in `main.js` the same way `'p'` opens
  OmniPresenter — a plain `keydown` listener dispatching
  `omni:system-toggle`. Added to `SHORTCUTS` in
  `ui/OmniKeyboardShortcutsPanel.js` too.

**New assets — `assets/images/` (13 files, all SVG, all actually read
before naming — none kept their meaningless export names):**
- `gallery-tex-lotus-emblem.svg` — a lotus-flower line emblem.
- `gallery-tex-panel-square-a/b/c.svg` — three large (4941×4941)
  rounded-square UI-panel frame variants.
- `gallery-tex-panel-nested-square-a/b/c.svg` — three nested/
  concentric rounded-square panel variants (1930×1929).
- `gallery-tex-connector-bar.svg` — the thin horizontal pill/connector
  bar shape.
- `gallery-tex-blueprint-grid-corner.svg` — a grid-of-dots blueprint
  pattern with L-bracket corner marks (ex-"Asset_10").
- `gallery-tex-technical-corner-frame.svg` — a technical corner-frame
  line pattern with dash/bracket details (ex-"Asset_11").
- `gallery-tex-schematic-burst-emblem.svg` — a symmetric mirrored-
  quadrant schematic burst emblem (ex-"Asset_12").
- `gallery-tex-quadrant-schematic-pattern.svg` — a symmetric mirrored-
  quadrant schematic line pattern (ex-"Asset_13").
- `gallery-tex-dashed-rule-pair.svg` — the faint (`opacity:.36`)
  dashed/segmented top-and-bottom rule pair (ex-"Asset_18").

All 13 are registered inside **both** the Plane and the Box geometry
folders, per the literal ask ("Inside the plane and box geometries
folders... please add these"). Judgment call: none of the 13 looked
clearly unsuited to either shape (they're all flat decorative/UI
textures, not something shape-specific like a 6-face skybox cross),
so nothing was excluded from either folder — documented here rather
than silently deviating.

**`systems/OmniInspector.js` — "choose from gallery" wiring:**
- Added a `⟐g Gallery` button into the existing Texture slot's URL
  row (`#oi-tex-gallery`, styled with the same `.oi-slot-apply` class
  the existing Apply button already uses — no new CSS needed).
  Clicking it dispatches `omni:gallery-toggle { select: true }`.
- One new class-level listener for `omni:gallery-texture-select`,
  registered once in `init()` — the same pattern this file already
  uses for `_onForceSaveFlush` (see that handler's own comment): the
  texture slot's `body`/`ext` closures live inside `_wireAppearance()`,
  which re-runs on every node selection, so registering the listener
  there directly would pile up one per node ever inspected. Instead,
  `_wireAppearance()` now stashes the current node's texture-slot
  `body`/`ext` onto `this._texSlotBody`/`this._texSlotExt`, and the one
  class-level listener reads those and calls the existing
  `_applyTextureUrl()` — the exact same code path the Apply button and
  file-drop already use, so a gallery pick goes through
  `THREE.TextureLoader`, sets `material.map`, flips `needsUpdate`, and
  persists via `_saveExt()` exactly like any other texture source. The
  listener no-ops if no mesh is currently selected, so a stray pick
  with nothing selected can't throw.
- `main.js`: imports `OmniGallery`, instantiates it alongside
  `omniPresenter`/`omniPocket`/etc., and registers it via
  `base.addModule(omniGallery)` — identical wiring to every other
  system in that block.

No existing IDs, IPC event names, or control bindings were touched —
OmniGallery is fully additive, and the Inspector change only adds one
new button + one new listener alongside the untouched existing
texture-slot code.

### V154 — theme centralization, MiniMap off by default, Kryptx nudge, minimize-to-tab restore fix

Four direct asks in one pass. Dated 2026-10-04.

**1. "Theme everything" — the blue accent and shared panel colors**

Investigated before building anything, and found two separate real
things already in the codebase, not one gap:

- A *complete* theme system already exists and is already running:
  `ui/ThemeManager.js` loads `data/themes.json` (`dark` / `light` +
  a saved `custom` set) and applies it by setting
  `--omni-theme-bg/-border/-header-bg/-text/-text-dim/-text-muted/
  -accent/-input-bg/-input-border` on `document.documentElement`.
  Roughly 50 panels (every `*SettingsPanel`, the Account* panels,
  `OmniKeys.js`, `OmniDraw.js`, `AdminPanel.js`, and more) already
  define their own local CSS vars as
  `--xx-bg: var(--omni-theme-bg, <their own original literal>)`, so
  they already pick up a theme switch. `main.js` already calls
  `ThemeManager.initTheme()` on startup, and `ui/AdminPanel.js`
  already has a working theme picker + custom-color editor. None of
  this needed building — confirmed it's real and wired, and left it
  untouched.
- The actual gap: the specific blue — `#7fd8ff` / `rgba(127, 216,
  255, …)`, which is also `data/themes.json`'s `dark.accent` — is
  *also* hardcoded directly as a raw literal, independent of the
  `--omni-theme-accent` hook above, in a dozen-plus files' hover/
  active-state glows. Those don't derive from `--omni-theme-accent`,
  so switching to the `light` theme via AdminPanel wouldn't re-color
  them — a real, if minor, theme-consistency gap.

**Fix — `ui/OmniTheme.js` (new file):** defines `:root { --omni-color-
accent-blue: #7fd8ff; --omni-color-accent-blue-rgb: 127, 216, 255; }`
via the same injected-`<style>`-by-id convention every other module in
this app already uses. Wired into `ui/index.js`'s `init()` as the very
first step (`injectOmniTheme()`, before any panel's own
`injectStyles()`).

**Files edited to reference the token instead of repeating the
literal** (every value reproduced exactly — same resolved color, same
alpha per call site, confirmed visually-equivalent): `ui/
AccountDashboardPanel.js`, `ui/AccountLoginPanel.js`, `ui/
AccountProfilePanel.js`, `ui/MiniMapSettingsPanel.js`, `ui/
OmniCommunicationPanel.js`, `ui/OmniDraw.js`, `ui/OmniDrawDynamic.js`,
`ui/OmniJsonifier.js`, `ui/OmniKeys.js`, `ui/OmniPanelTray.js`, `ui/
OmniStructurePanel.js`, `ui/CameraTravelSettingsPanel.js`, `ui/
ToolTipSettingsPanel.js`, `ui/OmniUserPanel.js`, `systems/
OmniInspector.js`. `#7fd8ff` → `var(--omni-color-accent-blue)`;
`rgba(127, 216, 255, X)` → `rgba(var(--omni-color-accent-blue-rgb), X)`.

**Caught myself before shipping it:** an initial pass also rewrote
three occurrences that looked like the same literal but weren't CSS at
all — `ui/OmniDrawDynamic.js` (a `color` field in an `omni:node-create-
request` detail, consumed as a `THREE.Color` string), `systems/
OmniPlayerGame.js` (`EMOTIONAL_STATES.curious.color`, consumed by
`mat.color.set(...)` in `modules/OmniExpressionator.js`), and `ui/
OmniCellPanel.js` (`SERIES_COLORS`, a chart-series palette, not panel
chrome). A `var(--omni-color-accent-blue)` string means nothing to
`THREE.Color` or a canvas/D3 color parser — all three were reverted
back to the literal `#7fd8ff` before this was done. Left alone on
purpose, documented in `ui/OmniTheme.js`'s own header so it isn't
"fixed" again by accident later.

**Deliberately not done:** fully closing the light/dark gap for those
dozen-plus literal glows (making them read `--omni-theme-accent`
instead) — CSS can't split a theme's `accent` hex back into separate
R/G/B channels for a translucent `rgba(…, 0.16)` wash without
`color-mix()`, which would be a second, larger pass across the same
files. Also deliberately left `--omni-theme-bg/-border/-text/etc.`
alone — already live and working via ThemeManager, nothing to add.

**2. MiniMap off by default**

`utils/MiniMapSettings.js` — `DEFAULTS.startVisible` flipped from
`true` to `false` (one line, comment explains how to flip it back).
This is the real flag `ui/MiniMap.js` reads at `init()` to decide its
initial `_visible` state (`this._visible = this._settings.
startVisible`). Everything else — the 'm' key toggle, and the live
`omni:minimap-visibility-set` listener in `main.js` that `ui/
MiniMapSettingsPanel.js`'s own toggle fires — is untouched, so the
MiniMap can still be turned on/off live without a reload. **To turn it
back on by default:** flip that one line back to `true`, or open the
MiniMap settings panel (Admin) and toggle "Visible on Start."

**3. KryptxKeyboard — arrow buttons to move it out**

Found: "Kryptx" in this app is `ui/OmniKeyCryptxReveal.js`
("CryptxMode," opened via `omni:cryptx-keyboard-toggle" from `ui/
OmniKeys.js`'s "KryptxKeyboard" button) — a separate docked panel,
`position: fixed; right: 0`, not a mode of `ui/OmniKeys.js` itself.

Added two header buttons, `◂` (out) and `▸` (in), using the exact
offset-on-top-of-docked-position pattern `ui/MovementPad.js` already
uses for its own detach mechanic (`gsap.set(el, { x, y })` layered
over the CSS-docked position, never touching the docked CSS properties
themselves):
- `_offsetX`, nudged by `NUDGE_STEP` (48px) per click, applied as
  `gsap.set(this._el, { x: -this._offsetX })` on top of `right: 0`.
- Bounded to `[0, _maxOffset()]`, where `_maxOffset()` is computed from
  the *current* panel width (`HEADER_W + revealedCount * COL_W`) and
  `window.innerWidth`, re-clamped every time columns are revealed/
  retracted (so revealing a column can't push an already-maximal
  offset off-screen) — same "can't move it off-screen" requirement
  MovementPad's own detach bounds satisfy.
- `◂`/`▸` disable themselves at the bounds (mirrors MovementPad's own
  disabled-state convention).
- Persisted to `localStorage` (`omni:cryptx-keyboard:offset`), same as
  MovementPad's own detach offset — survives reopening the panel and
  page reloads.

**4. Minimize-to-tab — real bug found and fixed, not just explained**

The feature: minimizing any panel (its header's `_`/`–` control) sends
it to `ui/OmniPanelTray.js`, a real tray of tabs toggled open/closed by
the small `▲` arrow in the Dock's right wing. Clicking a tab is
supposed to restore (maximize) that panel and remove its tab.

Read the full chain end to end rather than guessing. Every panel that
minimizes dispatches the same `omni:panel-minimized` event (confirmed:
43 files). `OmniPanelTray._maximizeTab(id)` calls `WindowManager.
restorePanel(id)` then unconditionally removes the tab. Read `ui/
WindowManager.js`'s `restorePanel`:

```js
export function restorePanel (id) {
  const entry = registry.get(id)
  if (!entry) return false                                   // ← bug
  entry.el.style.visibility = 'visible'
  bringToFront(id)
  window.dispatchEvent(new CustomEvent('omni:panel-restore', { detail: { id } }))
  return true
}
```

Its own header comment claims it "still dispatches `omni:panel-
restore`... for the handful of panels that do listen" even when not
registered — but the code returns `false` **before** reaching that
dispatch for any unregistered id, so that promise was never actually
kept. Cross-checked which of the 43 minimizing panels are registered
with `WindowManager.register(...)` (the ~45-panel `IndexedPanel.js`-
based majority all are) versus which only listen for `omni:panel-
restore` directly: `ui/Panel.js` (the lh/rh base panels) does listen
for it — so its tab was silently un-restorable too, the early return
skipped the dispatch it needed. `systems/OmniNode.js`, `systems/
OmniPocket.js`, `systems/OmniPresenter.js` dispatch a *different*,
unconsumed event (`omni:panel-restore-handler`, only ever read by
`systems/EventTestIndicators.js` for a debug flash — nothing stores or
calls the handler it carries) and never import `WindowManager` at
all — a second, deeper, pre-existing gap: those three panels were
**completely unreachable** once minimized, by any route, confirmed
by `grep`.

**Fixed:**
- `ui/WindowManager.js` — `restorePanel(id)` now dispatches `omni:
  panel-restore` unconditionally; the registry-based visibility/
  z-index branch only runs when the id *is* registered. Fixes `ui/
  Panel.js`'s lh/rh tabs for real.
- `systems/OmniNode.js`, `systems/OmniPocket.js`, `systems/
  OmniPresenter.js` — each now imports `WindowManager` and calls
  `WindowManager.register(id, el, label)` right after its panel
  element is built (`'omninode'`, `'omnipocket'`, `'omnipresenter'` —
  the exact same ids they already use in their `omni:panel-minimized`
  dispatch), so `restorePanel` can actually find and unhide them. This
  is the standard, already-established registration call every
  `IndexedPanel.js`-based panel makes; these three just never made it.

Re-verified after the fix: every one of the 43 panels that dispatches
`omni:panel-minimized` is now either `WindowManager`-registered or
listens for `omni:panel-restore` directly (checked by diff, zero
remaining gaps) — a tab in the tray now actually brings its panel back
for all of them, not just the ones that happened to implement the
other half of the contract.

**Real, correct usage** (answering "I don't see this working"): click
a panel's `_` (or `–`) header button to minimize it — nothing appears
to happen in the corner, because the destination is the Dock's small
**`▲` arrow** in its far-right wing, not anywhere near the panel
itself. Click that arrow to open the tray (it rotates 180° while open)
and the minimized panel appears as a tab inside it. Click the tab to
restore the panel; right-click (or long-press) a tab for Maximize /
Close / Move. That `▲` arrow is the one, fixed, always-reachable place
the tray opens from regardless of which edge the tray itself is
docked to — genuinely easy to miss since nothing else in the UI points
at it.

**Verification this pass:** `node --check` on all 171 `.js` files in
the repo — zero failures.

### V155 — MiniMap migration fix, Admin slot changes, OmniPointing/OmniStemming (OmniMeter(External))

Dated 2026-10-04.

**1. `utils/MiniMapSettings.js` — the real root-caused minimap bug**

Already root-caused coming into this pass: `DEFAULTS.startVisible` was
flipped to `false` in V154, but `loadSettings()` did
`{ ...DEFAULTS, ...JSON.parse(raw) }` — a saved blob already in this
user's browser (from before the default changed) always overrode the
new default, forever, no matter what the code said. Fixed with a
one-time migration: added `STORE_VERSION = 2` and a `MIGRATIONS` list.
`loadSettings()` now reads any saved blob's own `_v` (missing = `0`),
and if it's older than `STORE_VERSION`, runs the matching migration(s)
— here, forcing `startVisible` back to the new code default while
leaving `corner`/`showPortals` exactly as the user had them — then
immediately re-persists with the bumped `_v` so this runs exactly
once. After that, the user's own future toggling of "Visible on
Start" is respected normally, in either direction. Verified by reading
the fixed load path end to end (`utils/MiniMapSettings.js`).

**2. Admin panel slot changes (main.js, `admin`'s `specialSlots`)**

- Slot 15 `FloorManager` → slot 16 `FloorManager` (same onClick/label,
  renumbered to make room for slot 15 below).
- Slot 13's label: `OmniMeter` → `OmniMeter(Internal)`. Same onClick
  target — `ui/OmniMeter.js` itself is completely untouched, this is a
  label-only rename.
- Slot 15: new, real `OmniMeter(External)` — not a label change. See
  below.

**3. OmniMeter(External) — OmniPointing / OmniStemming, a real, new system**

Built `systems/OmniPointing.js` and registered it in `main.js` right
after `omniRealityGridPointSelector`. Per direct confirmation this is
its **own** system, not a mode on `systems/OmniRealityGridSelector.js`
/ `systems/OmniRealityGridPointSelector.js` — it only reuses their
real `GRID_SPACING = 20` / `FLOOR_Y = -0.08` constants (neither module
exports them, so they're duplicated here on purpose, documented).

Grid basis is procedural per direct confirmation: no persistent point
objects exist in the scene. Every hover raycasts the cursor onto the
floor plane and snaps to the nearest grid intersection by spacing
math; nothing becomes a real object until "Highlight and Edit" is
actually clicked.

What's real and working:
- **Hover tooltip** — shows the snapped `(x, y, z)`, reusing
  `var(--ttm-bg/-color/-border)` (the same CSS vars
  `utils/ToolTipSettings.js` already drives) for visual parity with
  every other tooltip in the project. Shows a saved title first line
  if that exact coordinate has one.
- **Neighbor fade-by-distance** — a real, lightweight DOM-overlay
  effect: small screen-projected dot elements (pooled/reused, not
  recreated every frame) around the hovered point, opacity falling
  off linearly to 0 at `FADE_MAX_DIST = GRID_SPACING * 2.5` (chosen,
  documented constant). Chosen over spawning real Three.js geometry
  per candidate point since the whole effect is cursor-anchored and
  transient — documented in the file's own header comment.
- **Click → real subContextMenu** (`.omp-quickmenu`, its own CSS
  deliberately modeled on `ui/ToolTipMenu.js`'s `.ttm-quickmenu`/
  `.ttm-action-btn`, kept as a separate copy so OmniPointing never
  depends on ToolTipMenu's init order): **TakeMeThere** (real camera
  tween, same `gsap.to(camera.position, {...})` pattern as the Spaces
  feature / `utils/CameraTravel.js`, adapted for a bare coordinate
  since there's no mesh to tween toward here), **Title** (real
  `window.prompt`, persisted to `localStorage` keyed by exact
  coordinate, shown on future hovers of that same point), **Pocket**
  (real, honest, `disabled` stub — matches this codebase's own
  established "labeled, not wired" convention, same as Developer →
  OmniCommandTerminal in `main.js`), **STEM** (real, not a stub — see
  below), **Highlight and Edit** (real — see below).
- **OmniStemming** — toggled by the **`KeyJ`** shortcut (checked
  against every binding in `main.js`'s keydown handlers and
  `HAND_KEY_BINDINGS`, and every entry in
  `ui/OmniKeyboardShortcutsPanel.js`'s `SHORTCUTS` list first; `j` was
  unclaimed by either — added a `SHORTCUTS` entry for it), only while
  OmniMeter(External) itself is active. While on, hovering follows a
  vertical "stem" through the snapped `(x, z)` column: the mouse's
  screen position is raycast against a vertical plane containing that
  stem's own axis and facing the camera (not the floor plane),
  clamped to `[FLOOR_Y, FLOOR_Y + STEM_HEIGHT]`, giving the exact
  `(x, y, z)` along it. A faint preview dashed line follows the hover;
  clicking "activates" that exact point as the real, persisted,
  highlighted **ActiveStemming** line (only one at a time — a
  documented scope choice, matching the user's own description of it
  as a single highlighted state) and opens the same subContextMenu,
  mirrored: STEM becomes "Deactivate STEM," and Highlight and Edit
  drops the locationNode at the exact clicked point along the stem
  rather than at floor level.
- **Vertical dashed stem** — a real dashed line, `STEM_HEIGHT = 14`
  world units, rising only from the point (not also descending — a
  documented call; the user's own wording named "rising" explicitly
  and left descending undecided). Built via real geometric dashing
  (stacked short cylinder segments with real gaps) — grepped for
  "Dashed" first per instruction, and that search found
  `systems/OmniNode.js`'s own `_buildDashedCylinderGeometry`
  (segmented-cylinder dashing) as the *only* prior dashed-line
  technique in this project; `THREE.LineDashedMaterial` is never used
  here, so OmniPointing's own `_buildDashedVerticalLine` follows that
  existing convention instead of introducing a second one.
- **Highlight and Edit → real `locationNode`** — dispatches the real
  `omni:node-create-request` event `systems/OmniNode.js` already
  listens for, with `geometry: 'SphereGeometry'`, `scale: 0.22`,
  `color: '#ffe14d'` (yellow), and `isLocationNode: true` +
  `pointingCoordinate: {x,y,z}`. This is a real, fully registered
  OmniNode — selectable, deletable, draggable, same as any other node.
  Carries its own sonar-ping ring effect: three looping,
  expanding-and-fading rings (`RingGeometry`, lying flat), added as
  independent scene objects at the node's world position (not as
  children of the tiny node mesh itself — its own `0.22` scale would
  otherwise shrink the rings down to near-nothing too), re-attached on
  both fresh creation (`omni:node-created`) and page-reload restore
  (`omni:node-restored`, so it survives a reload).

**Honest note, stated plainly**: no "sonar" effect, and no single,
reusable "the 0,0,0 point's own marker" object, exist anywhere in this
codebase — grepped for "sonar"/"Sonar" project-wide, zero matches, and
confirmed no origin-specific persistent marker exists either. The
sonar-ping effect built here is therefore a **new, original effect**
inspired by the user's own description (smaller than
`modules/PortalSpheres.js`'s own orbital-ring radius, the closest real
analogue found), not a scaled-down copy of a pre-existing one.

**Real bug found and fixed in the same pass**: `systems/OmniNode.js`'s
`omni:node-create-request` handler (`_onCreateRequest`) rebuilds a
fixed object literal field-by-field rather than spreading the
incoming event detail — so without an explicit line for them,
`isLocationNode`/`pointingCoordinate` would have been silently
dropped on every node OmniPointing creates this way, and
`OmniInspector.js`'s new Location section would never have triggered
for a single one of them. Fixed by adding
`isLocationNode: d.isLocationNode ?? false, pointingCoordinate:
d.pointingCoordinate ?? null,` to that object literal — every other
node type simply carries `isLocationNode: false` and is otherwise
unaffected.

**4. `systems/OmniInspector.js` — real `locationNode` inspector support**

Added a new "Location (OmniPointing)" section (`_locationHTML`/
`_wireLocation`), rendered only when `data.isLocationNode` is true,
following the exact same section-scaffold pattern (HTML fn + wire fn,
`_sectionHTML`, `_sectionOpen`) every other section in this file
already uses. Per the user's own spec ("at minimum its title/label,
color, and coordinate") — title and color are already fully editable
via the existing, generic Identity → Label and Appearance → color/XYZ
controls (OmniInspector's fields are generic across every node type,
not per-type), so this section doesn't duplicate those controls; it
surfaces them together as one honest, read-only combined readout
specific to a location node (type badge, title, color swatch,
coordinate), with a note pointing back to where each is actually
edited.

**5. `docs/dev/Roles/Developer/KeyN-NodeTypeRegistry.md` — new**

The user's own requested running registry of every real node type,
per direct request ("Add to the 'KeyN' list of nodes — this is also a
way for me to keep track of all node types"). Enumerates every real
entry in `systems/OmniNode.js`'s `GEOMETRY_DEFS`/`GEO_LABELS` plus the
new `isLocationNode` flagged type, each with a one-line description,
and documents the convention that any future new node type gets
appended there too.

**Verification this pass:** `node --check` on every `.js` file in the
repo copy — zero failures.

### V156 — 2026-10-04

**Real bug fixed — per-node Auto-Rotate toggle in the Inspector did
nothing, for any node that wasn't created through `systems/OmniNode.js`
itself.**

Reported bug: `systems/OmniInspector.js`'s Automation section
(`_automationHTML`/`_wireAutomation`) — toggling Auto-Rotate (or an
axis, or dragging a Speed slider) on a selected node visibly flips the
switch but the node never spins.

Traced the full dispatch → listener → per-frame-apply chain in
`systems/OmniNode.js` first (the Inspector's `dispatch()` →
`window:omni:node-rotation-automation-set` → `OmniNode._onRotationAutomationSet`
→ `Object.assign(entry.data, patch)` → `OmniNode.update(delta)`'s
`mesh.rotation.x/y/z += speed * delta` loop) and confirmed every link
in it is internally correct: field names match exactly
(`autoRotation`/`autoRotationAxisX/Y/Z`/`autoRotationSpeedX/Y/Z`), the
Inspector's `data` is the live `entry.data` object by reference (not a
clone), and nothing else in the repo reassigns `mesh.rotation.x/y/z`
(or `.set(...)`/`.copy(...)`) on a per-frame basis that could stomp it
back. So this part, exactly as already suspected before this pass, was
not the bug.

**Actual root cause: a second, completely separate node registry.**
`data/NodeLoader.js` ("⟐mniReality Data Layer") keeps its own
`Map<id, LoaderEntry>` (`this._registry`) for every node hydrated via
`loadFromURL()`/`loadNode()` — and `ui/OmniSystemCreatorPanel.js`'s
"Create System" button (Cross/Ring/Sphere/galaxy formations) creates
every one of its nodes through exactly that path
(`this.nodeLoader.loadNode(data)`, line ~757), never through
`OmniNode`'s own `omni:node-create-request`. A loader-owned node's
mesh is visually identical to an OmniNode-owned one and fires the same
`omni:node-created` event, so `OmniInspector` happily auto-opens and
renders the *exact same* Automation section for it — the Inspector
never checks which registry actually owns the node.

But the only code that ever *acts* on
`omni:node-rotation-automation-set`, and the only code that ever
applies the rotation increment per frame, lives in
`systems/OmniNode.js`, scoped strictly to `this._nodes` (its own Map).
For a loader-owned id, `OmniNode._onRotationAutomationSet` does
`this._nodes.get(id)` → `undefined` → `if (!entry) return` — the patch
is silently dropped, every time — and even if it weren't,
`OmniNode.update()`'s rotation loop only ever iterates `this._nodes`,
so a loader-owned mesh would never be spun regardless. Net result: the
toggle visually flips, nothing is ever persisted, and nothing ever
spins — a total, silent no-op, exactly matching the report.

This exact registry split had already caused one other confirmed bug
before this pass (see `data/NodeLoader.js`'s own `_onSceneClear`
comment: "Clear Scene... previously only reached OmniNode's own node
storage — NodeLoader's separate registry, which is exactly what
OmniSystemCreator's Cross/Ring/Sphere nodes are created through, was
never touched at all"), confirming this is a real, recurring class of
bug in this codebase, not a one-off.

**Fix — `data/NodeLoader.js`:** gave this registry its own, independent
copy of the same mechanism, rather than trying to merge the two
registries (a much bigger change than this bug needs):
- `update(delta)` now also loops `this._registry.values()` and applies
  the identical `lookAtMode` / `autoRotation` /
  `autoRotationAxis{X,Y,Z}` / `autoRotationSpeed{X,Y,Z}` logic
  `OmniNode.update()` already uses, scoped to loader-owned, `'loaded'`
  entries only.
- New `_onRotationAutomationSet` listener (added/removed in
  `_bindEvents()`/`destroy()`) resolves the id against
  `this._registry` instead of `OmniNode`'s Map, merges the patch into
  `entry.data`, and persists it.
- New `_updateStoredNode(id, patch)` — `_writeToStorage()` only ever
  writes a node once, at ingest ("idempotent — skips if id already
  present"), so it couldn't be reused for a later live edit without
  breaking that ingest-time guarantee. `_updateStoredNode` merges a
  patch into the already-stored record in `'omni:loader:nodes'` so a
  loader-owned node's Auto-Rotate setting actually survives a reload.

Not touched, and not the bug: `modules/OrbitModule.js` /
`ui/CameraMovementOptionsPanel.js`'s camera `autoRotate` (OrbitControls)
— confirmed unrelated, separate feature, left exactly as-is.

**Verification this pass:** read the corrected path end-to-end for
both registries (Inspector dispatch → each registry's own listener →
each registry's own per-frame apply loop). `node --check` on every
`.js` file in the repo copy — zero failures.

### V157 — 2026-10-04 — Group step for the Program feature (middle zone toward the full IDE)

**Ask:** add a Group step type to the existing Program feature (the
per-node move/rotate/scale/communicate/notify step sequence) whose
body is itself an ordered sub-sequence of steps, including further
nested Groups, wired into both consumers — `systems/OmniInspector.js`'s
quick "▶ Program" editor and `ui/OmniProgramEditorPanel.js`'s full
editor — with Save/Run continuing to work unchanged. Explicitly scoped
as a deliberate middle step toward the far-future
`Plan_FullOmniSense_IDE_` system described in
`docs/omniproducts/OMNISENSE_ALPHABET_AXIOMS_DESIGN.md` — not that
system; that doc was not touched.

**`systems/OmniProgramCommands.js` (the shared module — most of the
real work lives here, by design, since both panels already share it):**
- New `group` entry in `PROGRAM_COMMANDS` — label "Group", one generic
  field (`label`, default `"Group"`) reusing the existing generic
  field-rendering path rather than special-casing it.
- `defaultStep('group')` now also sets `steps: []` (a group's real
  content, outside the generic field list).
- `stepRowHTML(step, idx, path, depth)` — extended, not replaced. Two
  new optional params: `path` (dotted-index address, e.g. `"0.2.1"`),
  defaulting to `String(idx)` so every pre-existing top-level call
  site (`stepRowHTML(s, i)`) keeps working byte-for-byte unchanged;
  `depth` (nesting level, default `0`), used only to decide whether
  the dropdown still offers "Group" (see depth cap below). All
  `data-idx="${idx}"` attributes on the command `<select>`, the field
  `<input>`s and the delete `<button>` became `data-path="${path}"` —
  a flat numeric index can no longer address a step once nesting
  exists. A Group row additionally renders a collapse/expand toggle
  and a new `groupBodyHTML()` section: the group's own `steps` array,
  rendered by **`stepRowHTML()` calling itself again** on each child
  at `depth + 1` — one real rendering implementation for every row,
  flat or nested, in both panels — plus a scoped "+ Add Step" button
  (`.op-step-add-nested`, `data-group-path`).
- New exported `resolveStepPath(steps, path)` — walks a dotted-index
  path down through nested `step.steps` arrays and returns
  `{ arr, index }`: the real containing array plus the step's index in
  it, so a caller can read/replace/splice it in place without caring
  how deep it is. Both panels' wiring code now goes through this
  instead of a flat `steps[idx]`.
- `runProgram()` — the old inline per-step `forEach` became two new
  internal helpers, `appendStepToTimeline()` (one step) and
  `appendStepsToTimeline()` (a list), so a `group` step can call
  `appendStepsToTimeline()` again on its own `.steps` at `depth + 1`.
  A group's children land on the exact same `gsap.timeline()` as
  everything else — not a nested sub-timeline — so they run in order,
  one after another, inheriting the program's existing timing
  semantics (and the existing Auto-Persist / `repeat: 'infinite'`
  behavior, which operates on the timeline as a whole) with zero new
  special-casing. This also directly answers point 4 of the ask: a
  nested move/rotate/scale step still writes back on Auto-Persist
  exactly like a top-level one, because by the time Auto-Persist's
  `tl.call(...)`/`onRepeat` fires, the group's steps were never a
  separate thing to begin with — they're just more entries already on
  the same timeline.
- **Depth cap — `MAX_GROUP_DEPTH = 5`, a documented call, not a hard
  design requirement.** `stepRowHTML()`'s recursion into a group's
  children and `runProgram()`'s recursion into a group's children both
  recurse once per nesting level with no other bound, so an unbounded
  depth (hand-edited JSON, or a corrupted/cyclic localStorage blob)
  could blow the call stack or build a pathologically large timeline.
  5 levels is far past anything buildable by hand through this UI in
  practice, so the cap is invisible in normal use: `stepRowHTML` simply
  stops offering "Group" in the dropdown once a row is already at
  depth 5, and `runProgram` independently refuses to recurse past
  depth 5 even if a step somehow arrived deeper than that already —
  defense in both the editor and the runner, not just one of them.

**`systems/OmniInspector.js`:**
- Quick Program editor's `_wireProgram()` rewritten to address steps
  by path via `resolveStepPath()` (handles any depth, not just
  top-level) for the command dropdown, field inputs, and delete
  button; added a collapse-toggle listener (`.op-step-collapse`,
  toggles `step.collapsed`) and a nested add-step listener
  (`.op-step-add-nested`, pushes `defaultStep('move')` into the
  addressed group's `.steps`).
- New "+ Add Group" button next to "+ Add Step"
  (`#oi-program-add-group`), pushes `defaultStep('group')`.
- New CSS for `.op-step--group` / `.op-step-collapse` / `.op-group-body`
  / `.op-group-steps` / `.op-step-add-nested`, matching this file's
  existing convention of each consumer keeping its own copy of the
  shared Program visual language.
- **Real pre-existing bug found and fixed in the same pass** (not
  strictly part of the ask, but directly on the implementation path
  for "Save/Run must keep working with nested shape"): `_onProgramSet`
  — the handler for the full Editor Panel's cross-panel Save — replaced
  `#oi-program-steps`' innerHTML with freshly rendered rows but never
  re-attached any listeners to them, for *any* step shape, flat or
  nested; a save from the full editor while the quick editor was open
  would render correct-looking rows that silently did nothing on
  click/input until the whole section was torn down and rebuilt.
  Fixed by exposing `_wireProgram`'s internal `wireStepRows` closure as
  `this._programRewireSteps`, called from `_onProgramSet` right after
  it rewrites the container's innerHTML.

**`ui/OmniProgramEditorPanel.js`:** identical treatment — `_wireBody()`'s
`wireStepRows` now uses `resolveStepPath()` against `this._staged.steps`
for the same four listeners, plus the new collapse and nested-add
listeners; new "+ Add Group" button (`#ope-add-group`); same new CSS
block added to this file's own `STYLES` copy. `_save()`/`init()`
untouched — they already pass `program`/`steps` through opaquely
(`structuredClone`, array length/map checks only), so nested groups
round-trip through the existing `omni:node-program-set` save path and
`localStorage` (`STORE_PREFIX` + nodeId) with no changes needed there;
confirmed by reading `_saveExt()`/`_loadExt()` and every `program.steps`
consumer in `OmniInspector.js` — all of them are shape-agnostic
(`.length`, `.map((s,i) => stepRowHTML(s,i))`), none assume a flat leaf
step.

**Judgment calls made, documented here per the no-mid-task-questions
instruction:**
- Group is a step *type*, selectable from the exact same command
  dropdown as move/rotate/scale/communicate/notify (switching a row's
  dropdown to "Group" converts it in place via `defaultStep('group')`,
  same as switching to any other command) — not a separate button that
  wraps an existing selection, since no existing "wrap selected steps"
  interaction exists to reuse and inventing one would be a bigger,
  un-asked-for UI concept.
- Default group label: `"Group"`, editable via the same generic text
  field mechanism every other command's fields already use.
- Collapse/expand is per-group state stored on the step itself
  (`step.collapsed`), persisted like any other field — so a group's
  expanded/collapsed state survives a save/reload rather than always
  starting expanded.
- Nesting depth cap: 5 levels, defensive only — see
  `MAX_GROUP_DEPTH` above.

**Verification this pass:** manually traced add → nest 2-3 steps
(move + notify) inside a Group → save → run, through both panels'
code paths and the shared `runProgram()`/`stepRowHTML()` recursion, by
reading the full call chain (not run in a browser from this pass).
`node --check` on every `.js` file in the repo copy (172 files) — zero
failures.

## Status

Maintained going forward — add an entry here for each delivered
version. Entries should stay short and factual: what changed, and any
real bugs caught and fixed in the same pass, since those are exactly
the kind of thing worth being able to trace back to later.
