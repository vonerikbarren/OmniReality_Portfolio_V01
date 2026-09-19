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
