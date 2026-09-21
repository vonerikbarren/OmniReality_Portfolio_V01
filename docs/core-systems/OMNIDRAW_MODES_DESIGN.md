# OmniDraw — Static / Dynamic Split

Built: `ui/OmniDrawModePicker.js`, `ui/OmniDrawDynamic.js`, a real
restructure of `ui/OmniDraw.js`'s own nav-select listener, and
`utils/DesirePrimaryForce.js`.

## The mode picker — the first real, concrete use of Desire/PrimaryForce

`⟐OmniDraw` now opens a real choice — Static or Dynamic — rather
than jumping straight to the old single panel. Confirmed directly as
intentional: the click itself *is* Desire (forward, stated intent —
"I want Dynamic"), and whichever mode's real behavior follows is what
a future, fuller PrimaryForce check would confirm against it. Both
are real letters in the language's own 30
(`architecture/THE_30_RECLASSIFICATION.md`) — Desire() is Intent,
PrimaryForce() is Purpose — not analogies invented for this feature.

`utils/DesirePrimaryForce.js` is the real, minimal mechanism this
uses today: `declareDesire()` on a mode choice,
`confirmPrimaryForce()` once Dynamic actually, successfully creates
something. Explicitly **not** the full verification system — that's
real, acknowledged future work ("we might need to spend a little bit
more time on it") — this is just the hook it can attach to later.

The `n` key now opens the picker, not Static directly — a real,
deliberate change from the previous single-panel shortcut.

## OmniDraw(Static)

Unchanged in every real way — same panel, same behavior — just
listening for `⟐OmniDrawStatic` specifically now instead of the bare
`⟐OmniDraw` label, since that label belongs to the picker.

## OmniDraw(Dynamic) — the real first slice

Scoped narrowly and confirmed directly, not guessed: a string is
split into words — an array, one word per index — and shown **one
word at a time**, in order, start to finish, looping back to the
start once it reaches the end. Each word shifts to the next like a
real notification: a timed slide-and-fade transition, not all words
visible at once.

Reuses Static's own real placement mechanism
(`omni:node-create-request`, spawned in front of the camera) for the
ticker's anchor point — "clone static logic to build the dynamic if
necessary," applied literally, not a second, separate placement
system. The word display itself is a real, screen-projected CSS2D-
style label, the same technique already proven for OmniTargeting's
tooltip and ToolTipMenu's headers — not `TextGeometry`/font-loading.

**Explicitly deferred, per the agreed scope** — real, separate future
work, not built here: rotation styles (linear/vertical/diagonal
whip), the qualitative/quantitative command panel, and FilterMorphing-
style capture+texture+tooltip (FilterMorphing itself still doesn't
exist anywhere in the codebase).

## OmniJsonifier — JSON tree construction, live and manual

Built as its own real panel, not folded into the plain-string ticker
mode. Confirmed scope directly: manual, toggle-per-branch reveal —
"so we don't break anything" — not OmniCryptexLab's replace-on-drill
pattern. Multiple branches can be open simultaneously; each toggle
controls its own real 3D children, spawned and despawned live as it
opens and closes, not built all at once regardless of size.

Reuses two real, existing mechanisms rather than inventing new ones:
`omni:node-create-request` (Static's own placement pattern) now with
a genuine `parentId` — Dynamic's own ticker still always sends
`null`, since a flat ticker has no real parent to point to; a tree
node always does. `omni:node-delete-request` (already real, already
used by `OmniInspector.js`) for despawning a branch's children when
it closes — including recursively force-collapsing any nested branch
that was left open underneath it, so nothing is ever orphaned.

**Leaf "forms," confirmed**: a leaf value gets its own labeled node;
if that leaf is a multi-word string, it also gets a real, attached
`WordTicker` — extracted into `utils/WordTicker.js` specifically
because it's confirmed to be a genuine, reusable *form*, not a
feature specific to plain-string Dynamic. Both Dynamic's own ticker
and OmniJsonifier's multi-word leaves now share one real
implementation. The stated goal, directly: "data manipulation based
on type of data structure type" — different forms for different data
shapes, not one universal rendering.

**Explicitly not built here**: the "show the entire tree, shrinking
as it grows" option raised alongside the toggle system — a real,
worthwhile idea, offered as a "maybe," not committed to in this pass.

## Font — a real, per-node property, not global

Confirmed directly: font is per-node, exactly like color and scale
already are — never a shared, app-wide setting. Added to
OmniDraw(Static)'s own field schema first (a new `select` field,
reusing the same pattern `meshTypeChannel`/`particleShape` already
use), flowing through the same real, shared node-creation path every
OmniNode already goes through — `mesh.userData.font` is now set
alongside `mesh.userData.label`, in both real creation paths (fresh
creation and restore-from-storage).

## OmniCommunicationPanel — the real, second inspector for tickers

Confirmed name. One shared panel, retargeted by selection — the same
real model `OmniInspector` itself uses, not one instance per ticker,
confirmed directly for mobile-scale reasoning. Finds its ticker
through `utils/WordTickerRegistry.js`, a real, shared map from node
id to ticker that both `OmniDrawDynamic` and `OmniJsonifier` register
into — not fragile position-matching.

A real UX correction made while building, not left as a defect: the
panel does not force itself open for every node selection — only
when the selected node genuinely has a registered ticker. Selecting
something unrelated while the panel is already open updates it to a
real, honest empty state instead of showing stale data.

**`WordTicker` itself was substantially extended** — previously had
zero external control (no pause, no per-instance speed, hardcoded
style, a shared module-level interval). Now real, per-instance, and
controllable: `play()`/`pause()`, `stepForward()`/`stepBackward()`
(manual single steps), `toggleReverse()` (flips the same auto-play
loop's direction — confirmed as genuinely different from a manual
step), `jumpTo(index)`, `setSpeed()`, `setStyle()`, `setWord()`.
Direction is stored as a plain signed value (+1/-1), confirmed
directly to future-proof clockwise/counter-clockwise circular
arrangements later, rather than a named forward/backward state.

The panel itself: live-synced word-list highlighting (follows the
ticker's real current index every frame, not just on button clicks),
per-word click-to-edit, speed as both a number field and a slider,
color/size/font controls reusing Static's own real `FONT_OPTIONS`
list rather than a second, diverging copy, a real Save button with
visible confirmation, and a genuine periodic autosave (every 8
seconds) — verified to not fire early.

**Explicitly not built here**, confirmed as real, separate future
work ("build this in parts"): per-word context changing shape and
saved texture on iteration.

## Jsonifier folded into the mode picker as a real third mode

Confirmed directly: OmniJsonifier is now reached through the same
`⟐OmniDraw` mode picker as Static and Dynamic — its own standalone
Drawer entry removed, matching exactly how Static itself lost its
direct entry when the picker was first built. Its own nav-select
listener updated to `⟐OmniDrawJsonifier`, a new, specific label
distinct from the old standalone one.

## OmniCell — the name is now free, and reserved for something new

The existing voxel/stationary-reality concept previously called
"OmniCell" (`OMNISENSE_DASHBOARD_DESIGN.md`) has been renamed to
**OmniRealityCell** throughout — chosen over "OmniSenseCell" because
it already matched the existing "Stationary Reality" terminology
more directly than naming it after whichever dashboard creates it.

"OmniCell" is now reserved for a genuinely different, new fourth
mode — `OmniDraw(OmniCell)` — a numerical/data node opening into
real D3 visualizations. Confirmed to follow the same toggle-based
complexity management OmniJsonifier itself uses, explicitly
endorsed as the right approach for this system generally. Not yet
built — real open questions (data input shape, first chart type,
what the toggles actually toggle, and canvas-texture vs. screen-space
rendering) are still being resolved before this starts.

## OmniCell — now a real, fourth, standalone mode

Superseding the note that used to be here: OmniCell was first built
as something discovered only through Jsonifier's own tree, with no
separate entry point. Confirmed directly afterward that this wasn't
right — it now has its own real, fourth mode-picker button,
alongside Static/Dynamic/Jsonifier, for two real reasons: it matches
the project's own 4-hand architecture in count, and its own
D3-specific settings deserve a dedicated creation surface rather
than being buried inside a general JSON-tree explorer.

`ui/OmniDrawCell.js` is that dedicated entry — a real, separate
panel, name + JSON straight to a chart node, no tree, no toggles,
since the whole point of a dedicated entry is skipping the general
explorer. It shares the exact same detection Jsonifier's own tree-
walker uses (`utils/ChartEligibility.js`, extracted specifically so
neither path invents its own rules for what counts as a real chart
shape), and the same real placement pattern every other mode uses.
Jsonifier itself still produces chart-eligible nodes automatically
when a branch's own shape qualifies — both paths genuinely coexist,
neither replaced the other.

**Scene vs. panel, confirmed and built exactly as reasoned**: the
scene shows only a simple, distinct marker (`IcosahedronGeometry`,
warm orange) — no attempt to render chart data in 3D space at all.
The real, detailed, interactive chart lives entirely in
`ui/OmniCellPanel.js`, its own dedicated panel, separate from
`OmniInspector` — the Inspector stays about the node generically,
this panel is what a D3 node specifically looks like and does. One
shared panel, retargeted by selection, matching
`OmniCommunicationPanel`'s own real model, including its same real
UX fix — never force-opens for an unrelated node selection.

**Toggling a series** reuses Jsonifier's own real toggle mechanism,
applied to a genuinely different meaning — turning a data series on
or off inside the chart, not revealing 3D nodes. D3 added to the
project's real importmap (`index.html`) the same way three/gsap
already are. Real, working bar and line charts, both genuinely
tested. 31 checks total across both build passes, including the
exact sales-by-product example from the design conversation and a
real regression check confirming Jsonifier's own detection still
works correctly after being refactored onto the shared utility.

## Three real chart types added — pie, radar, area

Confirmed and built: Pie and Radar are genuinely non-Cartesian — no
shared x/y axes with Bar/Line/Area — so `_drawChart` now branches
them into their own dedicated setup rather than forcing them through
the same scales, verified directly that neither renders the
Cartesian axes at all.

**Pie** deliberately shows only the first visible series' own
breakdown by label, colored per-label — a genuinely different
question ("how does this one series break down") from Bar/Line/
Area's "how do series compare," so showing several series at once in
one pie was never the right behavior to force. **Radar** is the
real complement — each visible series becomes its own closed
polygon across the same labeled axes, colored per-series, making
multi-series comparison the whole point (and the direct, real target
for OmniUser's own 14 wellness dimensions, flagged as an opportunity
back in the original OmniCell SWOT). **Area** is Line's natural
filled sibling, reusing its same scales.

7 checks, all passing, including confirming that cycling through
all five chart types in sequence leaves no leftover elements from
whichever type came before.

## OmniCell's default geometry — now a cube

Changed in both real places a chart node is spawned — `OmniDrawCell.js`'s direct creation and `OmniJsonifier.js`'s own chart-eligible detection — from `IcosahedronGeometry` to `BoxGeometry`, so both real paths stay consistent with each other.

## The Inspector already applies to OmniCell nodes — confirmed by tracing the code, with an honest limit on what could be verified from here

Checked directly: chart nodes carry no special marker at all once created — `isChartEligible` lives only inside Jsonifier's own internal tree data and is never passed to the real scene node, so to `OmniNode`/`OmniInspector` a chart node is indistinguishable from anything Static could produce. The Inspector's own `loadNode()` does call `open()` at its end, unconditionally, whenever a node is selected — including a freshly-created OmniCell node, since node creation auto-selects by default.

A headless test run initially looked like `open()` never fired, but tracing the actual stack trace showed why: `loadNode()` throws inside a real-WebGL-dependent preview step *before* reaching its own `open()` call — a genuine limitation of testing outside a real browser, not a logic bug in the code itself. Flagged honestly rather than either dismissed or quietly "fixed" with redundant code: this should already work correctly in a real browser, but browser confirmation is the one thing this environment can't fully provide.

## Real value labels — every chart type now shows the actual numbers, not just the shape

Confirmed and built: every one of the five chart types now renders
real, correct D3 text labels showing the actual data values
directly on the chart, not just the visual shape representing them.
Bar shows a value above each bar; Line and Area show a value at each
point; Pie shows a value at each slice's own real centroid
(`d3.arc().centroid()`, correctly positioned regardless of slice
size); Radar shows a value just outside each series' own vertex,
colored to match its series. 9 checks, all passing, confirming
correct label count and correct real values for every type.

## Structure panel — real alternatives to the tree formation

Confirmed directly: alongside the existing toggle mechanic, not a
replacement for it. `utils/TreeLayout.js` is the real, shared
positioning logic — the original circular 'tree' formation kept as
the default, plus three genuine alternatives (`linear-vertical`,
`linear-horizontal`, `linear-depth`), all tested for correct real
positions. A new `omni:node-position-set` event lets an already-
spawned child's real mesh move live when the mode changes, rather
than requiring the branch to be closed and reopened.
`ui/OmniStructurePanel.js` is the real panel, retargeted by
selection with the same real UX fix already proven elsewhere (never
force-opens for a node with no real children). `ToolTipMenu`'s quick
menu gained a real "📐 Structure" option, shown under the same
condition as the children-toggle.

## Real, configurable Take Me There — speed, ease, and stagger

`utils/CameraTravelSettings.js` is the real, persisted, shared
settings behind every "Take Me There" in the project.
`utils/CameraTravel.js`'s `goToObject()` now reads real duration and
ease from it instead of hardcoded values. `ui/CameraTravelSettingsPanel.js`
gives real control over both, plus a real, curated list of GSAP's
own eases to choose from — not invented names. Stagger is included
and genuinely saved, but honestly labeled as not yet doing anything:
`goToObject()` only ever animates to one object at a time today: kept
real rather than silently dropped, ready for whenever a multi-target
travel exists to actually use it.

## Real bug fixed — the toggle tree now survives a page refresh

Traced directly: Jsonifier's own tree had never been saved anywhere
— it lived purely in the module instance's memory, gone completely
the moment the page reloaded, with no way back except re-pasting the
JSON and re-toggling everything by hand. Every other system in this
project persists to storage; this was a genuine, real outlier.

Fixed with real, stable persistence keyed by each node's own path
(the sequence of keys from the root) rather than its `nodeId` —
node ids are randomly generated and regenerate on every fresh parse
of the same JSON, so they can't be used to match open/closed state
across a reload; path is the one thing that stays the same. Saves
the raw JSON text, every open path, and any non-default layout mode
on every real state change (load, toggle, layout mode change), and
restores all of it on init — rebuilding the tree, re-opening every
branch that was genuinely open before in real parent-before-child
order, and re-spawning the right nodes, all before the panel is even
reopened. 10 checks, all passing, including a direct simulation of
an actual page refresh — a completely independent second instance
correctly restoring open state two nesting levels deep, plus the
saved layout mode.

## ToolTipSettings — Admin slot 9, the real global tooltip default

Confirmed no such panel existed before this. Built as a real Admin
sub-panel, matching the exact pattern every other numbered slot
already uses (`indexedPanelConfigs`'s Admin entry, `specialSlots`).
Controls background, border, and font color for every tooltip
header's own default appearance — confirmed directly as a global
default, not per-node customization, which remains a real, separate,
future feature. `ToolTipMenu.js`'s own header CSS was converted from
hardcoded colors to `var(--x, fallback)` custom properties, the same
theming pattern already used everywhere else in this project, so
nothing visually changed until a setting is actually adjusted.
Applies live and immediately on boot — `init()` alone re-applies
whatever was saved last session before the settings panel is ever
opened. 9 checks, all passing, including confirming the real CSS
custom properties are genuinely written to `:root`, not just saved
to storage and never actually applied.

## Per-node tooltip override — genuinely independent of the global default

Confirmed directly: stays the same even if ToolTipSettings' own
global default changes later — a real, separate, persisted value,
not a snapshot of the default taken at edit time. `utils/
ToolTipNodeOverrides.js` keys by a node's own real, stable id
(confirmed to survive a reload). Applies as real inline style on the
specific header element, which naturally takes precedence over the
`:root`-level global default in the actual CSS cascade — no special
override-checking logic needed anywhere else. Reachable from the
quick menu's new "🎨 Edit Tooltip" option (shown for every node, not
gated behind having children), with a real "↺ Reset to Default"
option that only appears once an override actually exists, and
genuinely clears it rather than just hiding it. Extracted
`utils/ColorUtils.js` for the hex-to-rgba conversion both this and
ToolTipSettings need, rather than a second, independently-maintained
copy. 10 checks, all passing, including the literal, exact
requirement — a node's override surviving a real change to the
global default.

## Structure panel — reachable from Jsonifier's own list, plus two new shapes

Confirmed a real gap: clicking a row inside Jsonifier's own list
view never dispatched `omni:node-selected` at all — only clicking a
node's header in the 3D scene did. Fixed by wiring a direct
`omniNode` reference into `OmniJsonifier` (via a new, real
`OmniNode.getMeshById()` lookup, extracted since scanning
`getAllMeshes()` per click would be wasteful) so a row click now
looks up the node's real mesh and dispatches a genuine
`omni:node-selected` event with it — safe for every other listener
that expects a real mesh, not just Structure's own. Jsonifier's own
toolbar also gained a direct "📐 Structure" button, opening the panel
for the root node without needing to click a specific row first.

Two new real shapes added to `utils/TreeLayout.js`: 'sphere' (a real
Fibonacci-sphere distribution — an even spread across a sphere's
surface, not clustering at the poles) and 'spiral' (a real, expanding
descending helix — radius grows and height drops together as the
index increases). 12 checks, all passing, including confirming a
real click on a real row in Jsonifier's own rendered list correctly
opens the Structure panel with all six real shape options available.

## Real bug fixed — stale orbit pivot after Take Me There / deselection

Traced precisely: `_syncOrbitTarget()`, the function that recomputes
where the camera pivots around, only ever ran on WASD or R/F key
release — never on node deselection, and never after `goToObject`
("Take Me There") moved the camera. Two real gaps, both fixed.
Deselecting a node previously only cleared an internal flag; it now
immediately calls the same real recompute. `goToObject` moved the
camera to look at a target but never told the pivot system where it
had gone — it now dispatches the same, already-proven
`omni:orbit-target-set` event WASD-rotate-around already uses,
right before re-enabling orbit, so the pivot is correct the instant
the user can interact again rather than staying stale at wherever it
was set before the travel. 4 checks, all passing, including
confirming the dispatched position genuinely matches the real object
traveled to, and that it happens before orbit re-enables.

## Show Value — a real leaf's own value, in the quick menu

Confirmed directly: only for leaves, not branches — a branch's own
children already represent its value spatially, so a second display
of the same thing would be redundant. Deliberately kept as an inline
quick-menu sub-view, the same real pattern the tooltip editor already
uses, rather than a new panel or Inspector's own still-unbuilt data
tab — a small, self-contained feature shouldn't depend on finishing
something much larger and not yet scoped. `ToolTipMenu` gained a
real `jsonifier` reference, wired via a setter (not the constructor)
since `OmniJsonifier` isn't created until later in main.js's own real
module order. Shows the value's real type and content, with genuine
HTML escaping so a string value can't be interpreted as markup. 11
checks, all passing, including confirming a branch correctly has no
Show Value option at all, and that dangerous-looking string content
renders as inert text.

## Two real bugs found and fixed during a full review pass

Reported: Structure opening Inspector instead, and the whole OS
eventually crashing. Investigated both directly rather than
reassuring first.

**Bug 1 — the exact reported one.** `omni:node-selected` has 8 real
listeners across the project (Inspector, OmniTargeting, MovementPad,
OmniCommunicationPanel, OmniCellPanel, OmniPocket, OmniPresenter, and
Structure itself). All three of Structure's own trigger points
(ToolTipMenu's quick-menu button, Jsonifier's row clicks, Jsonifier's
toolbar button) were built to dispatch this same shared event —
meaning opening Structure unavoidably fired all 8 listeners every
time, including Inspector's own always-opens-on-selection behavior.
That's precisely why Inspector appeared instead. Fixed with a new,
dedicated `omni:structure-focus` event that only Structure listens
for; the original, legitimate `omni:node-selected` dispatch in
OmniNode.js (a real, deliberate user click) was untouched and still
works exactly as before.

**Bug 2 — found during the review, not reported directly, but a
real, plausible contributor to the crash.** Jsonifier's own
`_spawnMesh` never passed `skipAutoSelect`, so every node it created
auto-selected by default. Toggling one branch with several children
— or restoring several open branches on a page refresh — spawned
all of them at once, each one independently cascading the full,
real 8-listener selection chain, including Inspector's own heavy
WebGL preview setup, all in rapid succession. Fixed by passing
`skipAutoSelect: true` on Jsonifier's own spawns specifically —
deliberately not applied to OmniCell/Static/Dynamic, since those
create one node per one deliberate user action, where auto-select is
the correct, intended behavior; Jsonifier's own "one action spawns
many nodes at once" pattern is what made this a real problem there
specifically.

9 checks, all passing, including the exact reported scenario (three
real trigger points, confirmed Inspector no longer opens), a
regression check confirming genuine selection still works normally,
and a direct simulation of the bulk-spawn scenario that used to
cascade.

## Inspector flipped to left-docked, matching every other panel

Confirmed a real inconsistency: Inspector was built as a full-height,
right-docked sidebar — a fundamentally different design from every
other panel this session, which are all left-anchored, small,
floating windows. Flipped position, border side/radius corner, and
the resize handle's own position and math together, since they're
interconnected — changing only the position would have left resizing
backwards. Verified directly: a real drag-resize interaction genuinely
grows the panel when dragging right, not left.

## The root's own real fall-from-sky spawn

Confirmed root-only, never for parents or children beneath it — the
node's own logical position stays at its real, final value
throughout (children positioning and persistence both depend on it);
only the real mesh's own Y is animated down separately, starting
well above its landing point. A real, small, persistent landing
platform (a single flat circle) spawns once the fall completes,
disposed and recreated cleanly on every fresh JSON load rather than
accumulating. Genuinely trivial on memory — one draw call, roughly
32 vertices, created once per load, not once per node. 9 checks, all
passing, including confirming a real, non-root child spawned via a
normal branch toggle correctly gets no fall treatment at all.

## Real bug fixed — a genuine catch-22 in Show Children/Structure

Reported: toggle does nothing on a root node, Structure's button
doesn't work either. Traced to a real, pre-existing architectural
mismatch, not a regression from recent work: whether these two
options even appeared in the quick menu depended on
`OmniNode.getChildrenOf()`, which can only ever see children that
already exist as real, spawned meshes. But Jsonifier deliberately
defers spawning any node's children until it's toggled open —
meaning a fresh root, never yet toggled, always had zero spawned
children by design. The button meant to reveal children for the
first time could never appear the first time, for any node, ever.

Fixed by having `ToolTipMenu` check a genuine Jsonifier node's own
logical tree data (`node.children.length`, `node.isOpen`) instead —
data that's always correct regardless of whether children have been
realized as meshes yet. The toggle button's own click handler now
also routes a real Jsonifier node through `jsonifier._toggleBranch()`
(which correctly spawns/despawns as needed) instead of directly
flipping `mesh.visible`, which only ever worked for children that
already had a real mesh. Non-Jsonifier nodes still use the original
OmniNode-based check, unaffected. 9 checks, all passing, including
the exact reported scenario — a completely fresh root, clicked for
the very first time, before ever being toggled.

## Design idea — animated life-stage timeline (documented, not built)

Raised as an example: a person's life — baby, child, teenager,
adult, elderly, death — as five life-stage branches, each holding
its own real value nodes, with an "enjoyment" line chart shown "in
motion."

Two genuinely separate things worth keeping distinct when this gets
built: (1) animating the *structure itself* — layout mode switches
currently snap instantly (`setLayoutMode` sets position directly, no
tween), a real, small, contained gap since the exact same GSAP
pattern already used for the root's fall-from-sky landing would
apply directly; (2) animating the *chart* — OmniCell's line chart
draws correctly today but has no motion at all, and "in motion"
itself needs a real decision between at least three different,
non-interchangeable directions: the line progressively drawing
itself in, a marker traveling along it stage by stage, or a
loop/replay control.

Proposed shape: `linear-horizontal` or `linear-depth` for the five
life-stage branches (chronological order for free, since that layout
already exists), a genuine OmniCell line chart for "enjoyment"
reading values from those same stage nodes rather than duplicating
data. Real next step, when picked up: confirm which chart-motion
direction is wanted before building, since building the wrong one
wastes real effort.

## Account — Login, Profile, Dashboard: three real, dedicated panels

Confirmed a real, pre-existing gap: `⟐Account`'s three children
already existed in the Drawer, but only ever opened the same generic
placeholder every other leaf nav item gets — no real, dedicated
panel existed for any of them. Built all three, and removed their
entries from the generic panel list to avoid a duplicate-open
conflict with the real, new ones.

`utils/OmniIdentity.js` is the real, shared, local identity list and
active-identity state — confirmed directly as "different save states
of the scene," and stated honestly in the Login panel itself as a
real, local profile switcher, not server-backed authentication (no
backend exists yet, a real, separate, later decision).
`ui/AccountLoginPanel.js` creates and switches between real,
persisted OmniIdentities. `ui/AccountProfilePanel.js` is the real
"basic OmniPlayer" — confirmed as where the OmniUser Profile goes —
reusing the exact same real, persisted OmniPlayerGame data
OmniPlayerDashboard's own full view already reads from
(`getRealities()`, `getExposedCount()`, etc.), not a second, separate
data source. `ui/AccountDashboardPanel.js` shows the active identity
as the real reality owner, with visitor/signup data clearly labeled
as example — the same honest "placeholder, not filled in" pattern
OmniPlayerDashboard itself already established, since no real
backend or IP-tracking exists yet to show anything real. 20 checks,
all passing.

## Radial Area chart — a real, sixth option, checked against the actual reference

Checked the real, referenced Observable example directly before
building — the actual technique is `d3.areaRadial`/`d3.scaleRadial`,
angle mapped from position around the circle, radius mapped from
value. Built as a genuinely distinct chart type from Radar, not a
reskin: Radar builds a manual polygon (straight edges between
points); Radial Area uses d3's own real radial area generator with
a closed curve, filling from the center outward — the actual
technique the reference uses. Added to the chart-type dropdown,
which was already real and live-editable before this — confirmed
directly by testing the actual switch, not just assumed. 7 checks,
all passing, including confirming the live-edit flow is genuinely
bidirectional (switching to Radial Area and back to Line both
correctly redraw).

## Real, shared node spacing — equidistant control, confirmed as the core ask

Every layout mode's own spacing was a hardcoded constant before this
— confirmed directly by reading the actual code, not assumed.
`utils/StructureSpacingSettings.js` is the real, persisted, shared
"distance between nodes" value; every mode in `TreeLayout.js` now
scales proportionally off it, using each mode's own original real
ratio to the previous default, so the visual relationship between
modes stays consistent as the setting changes rather than only one
mode scaling. A new `reapplySpacing()` walks the entire tree, not
just one node's direct children, since spacing is genuinely global.
Real slider added to the Structure panel, always visible once open,
not gated on a selection. 10 checks, all passing, including
confirming a grandchild two levels deep gets repositioned too.

**Noted, not built this pass**: connecting this same real spacing
mechanism to OmniChronos, as raised directly — OmniChronos uses a
genuinely different layout system (PerspectiveTime.js's own X-axis
lanes), so wiring the two together is real, separate integration
work, not a natural extension of this change.

## Design idea — consolidating Structure/Jsonifier into one panel (documented, not built)

Raised directly: merge OmniStructurePanel and OmniJsonifier into one
panel, acting as a secondary inspector specifically for the
Jsonifier aspect, with a maximize state revealing the full menu —
and eventually evolving toward a HUD/widget system or full
OmniVisors. Genuinely substantial scope, and both panels are
currently real, working, separately-tested systems — merging them
is a real, risky refactor worth a deliberate design pass of its own
rather than folding into an unrelated spacing-settings change.
Documented here as the real next design conversation, not started.

## Real bug fixed — trashing a Jsonifier root orphaned every descendant

Traced precisely: OmniNode's own trash handler deliberately
re-parents a deleted node's children to its own parent rather than
deleting them — the right, intentional instinct for a regular node
("same instinct as deleting a folder: its contents move up a level,
they don't vanish with it"), confirmed directly in its own existing
comment. But a JSON tree's children genuinely are part of their
parent, not independent siblings meant to survive it — so trashing a
Jsonifier root only ever removed the root's own mesh, silently
orphaning every real mesh beneath it in the scene.

Fixed with a new, real listener in `OmniJsonifier.js` reacting to
the same `omni:node-delete-request` event OmniNode's own handler
already uses — but only ever cascading the matched node's own real
children (via the already-proven `_collapseRecursive`), never the
node itself, since the original event already handles that one
directly. No re-entrancy risk: each cascaded despawn dispatches the
same event again, but always for a different, distinct node id.
Deleting the root also genuinely clears Jsonifier's own state and
its saved persistence, so a future reload doesn't resurrect it.
Deleting a non-root branch correctly cascades just that subtree,
removing it from its real parent's children while leaving the rest
of the tree untouched. 9 checks, all passing, including the critical
regression — a genuine non-Jsonifier node's own delete still
correctly re-parents its children exactly as before, unaffected.

## Real bug fixed — stale connecting cylinders after a layout change

Traced precisely: a node's own connecting cylinder (`_buildEdgeLine`)
has its length and orientation baked into its actual geometry at
creation, not just its transform — so when `omni:node-position-set`
moved a node for a layout change, the cylinder connecting it never
updated at all, left pointing at the old position. This wasn't
specific to any one layout — it affected every mode that moves
already-spawned nodes.

Fixed with a new `_rebuildEdgesFor(nodeId)` in `OmniNode.js`, called
from the same real `omni:node-position-set` handler every layout
mode already routes through: finds every edge touching the moved
node, disposes its old geometry and material for real, and builds a
genuinely new cylinder at the current, real world positions of both
endpoints. Fixed once, at the one real, shared event every mode
uses — so this covers Tree, both Linear axes, Sphere, and Spiral
alike, not a per-mode fix. 9 checks, all passing, including
specifically Sphere and Spiral (the two directly asked about),
confirming a genuine, verified dispose() call on the old geometry
and material (not assumed), and confirming an edge untouched by the
move is correctly left alone.

## OmniTargeting made less invasive — real, precise fixes

The old tetrahedron orientation (`lookAt` plus a guessed extra
rotation) never reliably pointed any specific vertex at anything —
`TetrahedronGeometry`'s own four default vertices sit at a
cube-corner pattern, none aligned to a clean axis. Fixed at the
geometry level instead: bakes a real rotation into the geometry
itself so one actual vertex sits exactly on local -Z, the same
direction `lookAt` always points an object's forward — so `lookAt`
alone now genuinely aims a real apex at the target. Markers shrunk
(0.35 → 0.2, confirmed smaller since more of them surround one
target). Real black base with a white emissive highlight — the
standard technique for "a dark shape with a glowing highlight" being
described. Opacity default now 50%. `update()` rotates on both Y and
Z again, restoring the original dual-axis spin. 10 checks, all
passing, including a precise, direct verification of the geometry-
level vertex alignment itself, not just a visual guess.

## Landing platform — node now genuinely sits on top, real wireframe

Confirmed the exact cause: the root's own real radius at its real
scale is ~0.18 (0.6 base `OctahedronGeometry` × 0.3 scale); the old
0.05 offset sat well inside that, cutting through it. Now 0.22,
clearing the real radius with a small, deliberate gap. Switched to a
real wireframe material, white. Honest note on "bold": set
`wireframeLinewidth`, which is real, valid three.js API, but most
browsers/GPUs silently ignore values above 1 — a real WebGL spec
limitation, not a bug here, included honestly rather than silently
dropped since it does work on a few platforms.

## Mac grey-scene bug — real diagnostic added, root cause hypothesized

Reported: nodes render fine, but wallpaper, floor, and depth are
grey, Mac-only. Traced a real, plausible, well-grounded cause:
`WallpaperSphere.js`'s own default color (`#445566`) is exactly the
flat grey-blue that would show if its texture never loads — and its
own `_applyFromSlot` had a genuinely silent failure path, returning
with zero logging if the real IndexedDB record came back empty.
Safari has a real, documented history of blob-storage bugs in its
own IndexedDB implementation specifically, which both wallpaper and
floor depend on for their textures via the same shared
`utils/WallpaperStorage.js`, while plain-color nodes don't depend on
it at all — a coherent explanation for exactly this symptom pattern.
Added real, specific diagnostic logging naming this hypothesis
directly, so it can be confirmed from the actual browser console
rather than guessed at further. Honest limit: this is a strong,
well-reasoned diagnosis from reading the real code, not a confirmed
fix — verifying it needs the actual Mac console output.

## zFold frame drops — honest note, real contributing factor found

Reported even with minimal scene content (the root's own fall
animation). Found one real, concrete contributor while investigating:
`ToolTipMenu.update()` re-scans every registered mesh and recomputes
a full world-to-screen projection for every node's header, every
single frame, regardless of what changed — a real, non-trivial cost
that compounds with node count. Combined with dozens of registered
modules each running their own `update()` every frame, this is a
credible source of baseline overhead. Honest limit: fully profiling
mobile GPU performance isn't possible from this environment — real
next step is the browser's own performance profiler run directly on
the zFold, which would give concrete data rather than further
inference.

## OmniTargeting — real two-ring redesign

Confirmed directly: two genuinely independent sets of 4 markers (8
total), not one set rotating on two axes. `_groupY` (a clock lying
flat, hands sweeping horizontally from above) and `_groupZ` (a clock
facing the camera, hands sweeping in the plane being looked at) are
real, separate Three.js groups, each spinning on only its own axis.
Fixed a real, secondary issue found while rebuilding this: disposal
now also removes the two, now-empty sub-groups before a fresh
rebuild, since they'd otherwise be left orphaned as empty children on
every geometry switch. 11 checks, all passing, including direct
confirmation that each ring's rotation never leaks onto the other's
axis.

## The Mac grey-scene bug — real root cause found and fixed

Given real, direct console output this time, not just a symptom
description — and it pointed somewhere completely different from
the earlier wallpaper/IndexedDB hypothesis. `renderTransmissionPass`
appearing in the actual stack trace is a very specific, named
three.js internal feature: it only activates when some material in
the scene has `MeshPhysicalMaterial`'s `transmission` property set
above 0 (real glass/refraction rendering), and it has a real,
documented history of compatibility problems on certain WebGL
implementations, including some Mac/GPU combinations — exactly
matching the final "WebGL context LOST" log.

Checked the actual codebase directly: three separate modules
(`PortfolioXD.js`, `PortalSpheres.js`, `Portfolio3D.js`) hardcode
non-zero transmission unconditionally (0.70, 0.5, 0.25) — not an
opt-in setting, active the moment any of them render, for every
user. `OmniInspector.js` also has an opt-in transmission slider
(default 0) as a fourth, real, if not confirmed, contributing risk.

Removed `transmission` from all three hardcoded sources — kept
everything else each material intentionally uses (iridescence,
metalness, emissive), with opacity raised slightly on each to
preserve a genuine, real see-through glass look without the fragile
`renderTransmissionPass` machinery. Added a direct, honest warning
to the Inspector's own slider label, so dragging it later is an
informed choice, not an accidental repeat of the same real crash.
Verified directly via precise source inspection that transmission is
now fully absent from all three files, the new opacity values are in
place, and every other intended material property survived
untouched.

## Status

Built and verified directly, 32 checks total across both build
passes: the mode picker's real routing and Desire declarations,
Static correctly responding only to its own specific label,
Dynamic's real word-array parsing, the shared `WordTicker` working
identically in both consumers, and OmniJsonifier's full real tree
lifecycle — correct root-only initial spawn, correct per-branch
open/close with genuine `parentId` wiring, correct ticker-attachment
only for multi-word leaves, and correct recursive collapse of nested
open branches on close, confirmed with no orphaned nodes left
behind.
