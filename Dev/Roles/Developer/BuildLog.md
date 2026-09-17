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

## Status

Maintained going forward — add an entry here for each delivered
version. Entries should stay short and factual: what changed, and any
real bugs caught and fixed in the same pass, since those are exactly
the kind of thing worth being able to trace back to later.
