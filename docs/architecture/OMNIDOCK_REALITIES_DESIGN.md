# OmniDock_Realities: a wireframe-geometry dock above the Dock (V191)

Applies to: V191 · Status: verified in jsdom and software-GL Chromium (1280x720, 390x844) · Real devices, real GPU, touch: not verified.

## The ask

The owner, about the userCompass: "I like the userCompass and how its also dragable good job. I would like you to put this at the bottom we are going to create a dock above the dock. We will call this the OmniDock_Realities. I would like all of the main geometries in their wireframe form to go along the bottom of the dock. The purpose of these are to show when clicked on all the realities in the scene that are in that shape and their id in a panel. When hovering over it or tap once on mobile, it should just show a quickTip of the number nodes in that shape. There should be settings for the OmniDock_Realities to make these bigger or smaller and their opacity and color change for each one of them for the user. they should be in their own div so they can be scrolled. Please adjust the size of these based on screen size."

## Decisions (interpretations)

- **Main geometries** = the 20 shapes of the node geometry picker (`systems/OmniNode.js` `GEO_LABELS`, first 20 keys): Box, Sphere, Cylinder, Cone, Torus, TorusKnot, Octahedron, Tetrahedron, Icosahedron, Dodecahedron, Plane, Circle, Ring, Capsule, Lathe, Tube, Extrude, Shape, Edges, Wireframe. The three special kinds in the same map (EssenceData, StoreItemNode, OmniValueNode) are not "shapes" and are not in the dock; nodes with them are counted as "other" by the census. A test pins the list to the picker.
- **Icons**: SVG `<path>`s from procedural wireframes (`utils/OmniGeometryCensus.js`: hand-sized vertex / edge lists projected orthographically). No canvas, no WebGL context (the page already holds 5). Polyhedra edges are found by minimum vertex distance; torus, knot, capsule, lathe, tube, extrude are parametric polylines. The icon under the pointer turns slowly (one path, <= 30 fps, from the shared ticker `update(delta)`), never under `prefers-reduced-motion`; nothing runs while nothing is hovered.
- **Click vs touch**: a mouse/pen/keyboard click opens the list. On touch a single tap must "just show a quickTip", so the first tap shows the tip (`omni:notify-info`, "4 nodes") and arms the shape for 6 s; a second tap on the same shape opens the list. (OmniNotify's own long-press still works.) Open question for the owner: is "tap again" the right way to open the list on a phone?
- **Hover quickTip** uses the ordinary `data-omni-tip` / `-key` / `-desc` attributes, re-written whenever counts change: name "Sphere", key "4 nodes", description "4 nodes in this reality use the Sphere shape. Click to list them with their ids."
- **Counts** come from the real registry `OmniNode.getAllNodes()` (`data.geometry`), refreshed (debounced 120 ms) on `omni:node-created`, `omni:node-deleted`, `omni:node-updated` (a geometry swap fires it) and `omni:nodes-updated` (load, any storage change). If the counts did not change nothing is re-rendered and no event is sent. Structural nodes (the Chronos clock icosahedron) are real registry nodes and are counted; their kind column says `structural`.
- **The list window** `ui/OmniRealitiesInShape.js` (class A, shared `OmniSettingsPanelBase` shell: WindowManager.register gives resize + maximize + phone bottom sheet): name, kind (node / group / essence / storeItem / ... / structural) and id per row, a filter box, live updates (same events, 100 ms debounce). A row click selects (`omni:node-select-by-id`) and flies (`omni:goto-mesh-request { mesh }`, the event the Inspector uses). Clicking the open shape again closes it.
- **Own div that scrolls**: `.odr-scroll` is `overflow-x: auto`, momentum (`-webkit-overflow-scrolling`), scrollbar hidden, `touch-action: pan-x`, edge fade mask; a vertical mouse wheel scrolls it sideways; arrow keys move focus (roving), Home / End.

## Layout

```
 bottom hands (corners)            [ compass | wireframe icons ... scroll ... ⚙ ]            bottom hands
 ─────────────────────────────────  OmniDock_Realities row (fixed, bottom: 52px)  ─────────────────────────────────
 ⚇ ⚉  Dock (#omni-dock, 52px)  ................................................................  ▲
```

- The row is `position: fixed; bottom: 52px; left/right: 112px` (90 px at <= 460 px wide, where the hands shrink to 83 px), so it never covers the two bottom hands (103 px wide at the corners) or the Dock. Its root has `pointer-events: none`; only the scroller and the gear take the pointer.
- **Size from the screen**: icon px = `clamp(28px, 4.2vw, 52px)` x the user size (60..160 %), kept in 22..72 px (1280 wide: 52; 390 wide: 28). Row height = icon + 14, or the compass box + 6 while the compass is docked in it, whichever is larger (66 px desktop, 60 px phone).
- **Shared layout vars** (`utils/OmniLayout.js`, additive block): `--omni-dock-row-h` (the row, 0 when hidden), `--omni-dock-stack-h` (52 + row), and `--omni-dock-h` is kept equal to the stack so every bottom sheet (`bottom: var(--omni-dock-h, 52px)`: settings panels, wallet, exchange, docs) clears the row. `setDockRow({h,on})` writes them and fires `omni:layout-changed` once per change; `getDockRow()` / `getDockStackHeight()` / `getDockRowInset()` read them.
- **X meter** (`ui/OmniMeter.js` `_layoutDock`, one line added): bottom = Dock's measured top edge + `--omni-dock-row-h` + 4 px, so it sits above the row; hiding the row returns it to the V190 placement (56 px).
- Not changed: `ui/Hand.js` and `ui/MiniMap.js` still use their own 52 px constant. The minimap's default corner is top-right; a minimap moved to a bottom corner can overlap the row (listed as a follow-up). `utils/OmniWindowChrome.js` still maximizes down to the Dock's top, so a maximized window covers the row.

## The userCompass at the left end

- `defaultCompassPos` (pure, `utils/OmniUserCompassSettings.js`) now returns the left end of the row (`x = inset + 3`, vertically centred in the row) while the row is shown (`lay.dockRow.on`). With the row hidden it falls back to the V190 defaults.
- It is still its own draggable class-B panel. A saved position (`omni:user-compass-pos-v1`) still wins. While docked it is clamped like before (above the Dock); once the person drags it (or has a saved spot) it is clamped above the Dock **and the row** (`_vpFor`), so a dragged compass never sits on top of the strip. `data-pos` is `docked` / `custom` / `default`.
- The row reads the compass settings (`omni:user-compass-changed`, `show`, `size`, `pos.custom`) and keeps `--odr-reserve` (the compass box + 6 px) at its left end only while the compass is shown and docked.
- **Dock compass** (settings panel and Admin > UI Settings) sends `omni:user-compass-set { resetPos: true }`, which forgets the saved spot and returns it to the row. The existing "Reset position" button does the same.

## Settings: user-facing, `omni:dock-realities-v1`

`utils/OmniDockRealitiesSettings.js`: `show` (true), `size` 60..160 % (100; S 75, M 100, L 130 presets), `opacity` 20..100 (90), `hideEmpty` (false), `geo[<id>] = { color '#rrggbb', opacity 20..100 }` for each of the 20 shapes (default colours spread round the hue wheel, opacity 100). Storage `{ v: 1, ...only what changed }`; load is defensive (bad JSON, wrong types, unknown ids, prototype keys, blocked storage -> defaults; numbers clamped; colours normalised, anything but `#rgb` / `#rrggbb` rejected). Events: in `omni:dock-realities-set { patch | geo | resetGeo | reset }`, out `omni:dock-realities-changed { settings, counts }`. The icon's effective opacity is global x per-shape.

- `ui/OmniDockRealitiesSettingsPanel.js` = `⟐OmniDockRealitiesSettings` (nav item of the same name, class A): show, S / M / L + slider, opacity, hide empty, 20 per-shape rows (colour input, opacity slider, reset), Dock compass, Reset. Reached by the gear on the strip (`omni:dock-realities-open-settings`), by the nav item, and by Admin > UI Settings > OmniDock_Realities (a small block, `adminRowsHtml` / `bindAdminRows`: Show, Open settings, Dock compass). The convention `<System>Settings` is followed; there is no `Dev` counterpart yet (nothing to put there), and no user file imports a Dev module (test `v191c_nodev_test.mjs`).
- Not in a drawer slot: adding a slot means editing `ui/Drawer.js`, shared with the other V191 builds. Follow-up: give it an Admin slot number.

## Files

New: `utils/OmniGeometryCensus.js`, `utils/OmniDockRealitiesSettings.js`, `ui/OmniDockRealities.js`, `ui/OmniRealitiesInShape.js`, `ui/OmniDockRealitiesSettingsPanel.js`, `ui/OmniV191Modules.js` (registrar). Edited: `utils/OmniLayout.js` (additive block), `ui/OmniMeter.js` (one line), `ui/OmniUserCompass.js` + `utils/OmniUserCompassSettings.js` (docked default), `ui/AdminPanel.js` (4 small lines), `main.js` (one block).

## Not verified

Real GPU, a real phone, real touch (the tap logic is tested with synthetic pointer events; Playwright touch is software-GL). Hover quickTip timing against the OmniNotify hub in a real browser.
