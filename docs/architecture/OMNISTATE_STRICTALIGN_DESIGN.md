# OmniState_StrictAlign: move a node along ONE axis with exact coordinates (V191)

Applies to: V191, upgraded in V192 (see the last section) · Status: verified in jsdom and software-GL Chromium · Real devices, real GPU, touch: not verified.

## The ask

The owner: "I would like the ` key to bring up idk what this is called but you can move a geometry across specifically a specific axis with the exact coordinates underneath it. This is for x, y, z specifically for now. The user selects only one coordinate so they can move the geometry exactly where they want to. this is like a mode we will call OmniState_StrictAlign. All nodes should be able to move alongside these OmniState_StrictAligns..."

## What it is

A mode (`OmniState_StrictAlign`, `utils/OmniStateStrictAlignSettings.js` `STATE_NAME`). There is no central OmniStates registry in the code (only the OmniState product in `docs/omniproducts/LIVE_REALITIES_DESIGN.md`) and OmniNode's own `_mode` is `select | path | place`; so the mode is announced with `omni:strictalign-changed { kind: 'state', state, active, axis, ids }` for anything that wants to follow it.

| Part | Behaviour |
|---|---|
| Key | `` ` `` (Backquote). Toggle. Ignored while typing (input, textarea, select, contentEditable) and with Shift / Ctrl / Cmd / Alt. |
| Terminal | `` ` `` used to open the terminal (`main.js`: `e.key === '`' \|\| e.key === 'F1'`). The terminal keeps **F1**. `main.js`'s handler is untouched: a capture-phase handler on `window` takes the Backquote first (`preventDefault` + `stopImmediatePropagation`). The shortcuts panel and the cheatsheet say so. |
| Panel | `#omni-state-strictalign`, class B (overlay), bottom centre above the OmniDock_Realities row and the X meter (`bottom: var(--omni-dock-stack-h) + 56px`); full width minus 16 px on a phone. Three fields X / Y / Z (exact WORLD coordinates, up to 4 decimals), axis buttons X / Y / Z, node name + id, a message line, a hint line. |
| One axis | Exactly one axis is chosen (default X): its field is editable, the other two are `readonly`, dashed and marked 🔒. Choose with the buttons, or the keys `1 2 3` / `x y z` (also numpad). |
| Moving | (1) Drag the coloured axis line / arrow (a fat invisible hit tube along the axis, plus the node itself): the pointer ray is projected on the axis line (`projectRayOnAxis`), the grab offset is kept (no jump), the drag snaps to the step unless turned off, Y / Z cannot change. (2) Arrow Up/Right/PageUp = +1 step, Down/Left/PageDown = -1 step, Shift = the big step; the step lands on a multiple of the step (from 1.23: 1.3, not 1.33). (3) Mouse wheel over the node / line (elsewhere it zooms as before). (4) Type an exact value + Enter (comma decimals accepted, junk marked red, beyond the world edge clamped with a message). (5) Ctrl/Cmd+Z undoes the last move (50 deep per session). |
| Leaving | Esc, `` ` ``, the × button. Optional: after Enter (setting). |
| Gizmo | A `THREE.Group` added to the scene only while the mode is on: a line (can be hidden), two cones, a hit tube; drawn on top (`depthTest: false`), scaled with the camera distance (0.06 x distance, 0.3..60), coloured X red / Y green / Z blue. Geometries and materials are disposed on destroy. It adds no WebGL context. |
| World | `WORLD_LIMITS`: x, z +-525; y -497..553 (the wallpaper extent the meter uses, centre y 28). |

## Reusing the app's own position API

Every move ends in `omni:node-pos-set { id, position }`, the event `systems/OmniNode.js` handles (sets `mesh.position` + `data.position`, rebuilds the tapered edges that touch the node, `_save()` to `omni:nodes`, fires `omni:node-updated`) and that the Inspector Location fields and programs (`persistTransform`) already use. So persistence, edges, labels and the tree stay in step. The position in the event is **local** (what the handler sets): for a node inside a group / space container the module converts the new WORLD position with `parent.worldToLocal`. During a mouse drag the mesh follows the pointer every frame and the event is sent at most every 100 ms plus once at the end. The Inspector's Location inputs (`#oi-px/py/pz` and their sliders) are refreshed directly, because the Inspector does not listen for external moves. A node under a behaviour (`userData.restPosition`) has its rest position shifted by the same local delta so the behaviour continues from the new place.

## All node kinds

Anything that is a registry node moves: plain nodes, store item / value nodes (`data.nodeKind`, ordinary nodes since V183), group and essence nodes, nodes with scale / rotation, nodes inside a group (world / local conversion). Cannot be moved, with the reason shown in the panel (`moveBlockReason`, pure): nothing selected; a tracking node (`omni:node-selected` from `OmniTrackingNodes` carries a mesh with `userData.omniTrackingId`; they orbit by themselves); an object that is not in the OmniNode registry; a behaviour-locked mesh (`userData.behaviorLocked`); a structural node (`skipAutoSelect`); a node that is not in the scene. OmniPathNode / floorPanelNode (being built in parallel) are expected to be ordinary registry nodes; not checked.

## Together ("All nodes should be able to move alongside")

There is no persistent multi-selection in the code (OmniNode has none; a group is a real node whose members are children). So: the primary node (the selected one) + a **together set**: set by `omni:strictalign-selection-set { ids }`, `setExtra(ids)`, or the button "Include the N grouped by the selector volume" which appears after `omni:selector-volume-grouped { containedIds }` (OmniSelector). Every target moves by the same delta along the chosen axis; the delta is clamped as a group (`clampDelta`) so the spacing is kept at the world edge; a node whose ancestor is also a target is skipped (it travels with it); one undo restores all. Moving a **group node** moves its members with it (the container is their parent).

## Settings: user-facing, `omni:strictalign-v1`

`utils/OmniStateStrictAlignSettings.js`: `step` 0.001..100 (0.1), `shiftStep` 0.001..1000 (1), `showAxisLine` (true), `closeAfterEnter` (false), `snapDrag` (true). `{ v: 1, ...changed }`, defensive load, 6-decimal rounding. Events: in `omni:strictalign-set { patch | reset }`, out `omni:strictalign-changed { kind: 'settings' | 'state', ... }`. Admin > UI Settings > OmniState_StrictAlign (`ui/OmniStateStrictAlignAdminBlock.js`; uses its own class, not `.ap-num`, because the Admin panel binds `.ap-num` / `.ap-toggle` to its staged-Save fields; the toggle selector in `AdminPanel._bindFields` got `:not([data-odr]):not([data-sa])`).

## Files

New: `utils/StrictAlign.js` (pure math), `utils/OmniStateStrictAlignSettings.js`, `ui/OmniStateStrictAlign.js`, `ui/OmniStateStrictAlignAdminBlock.js`, registered through `ui/OmniV191Modules.js`. Edited: `ui/AdminPanel.js`, `ui/OmniKeyboardShortcutsPanel.js` (`` ` `` / F1 split + axis keys), `main.js` (one block).

## V192: all nodes, axis checkmarks, step field, arrow buttons

The owner: "I would like the OmniStrict Align to be with all nodes that way precision of where the node is located vs where the user might want it to be will be true. and the x , y , z axis should have a single focus checkmark to check for the axis ( one at a time ) to focus on. so the drag with some arrows with the space iterator defined in a field. That way they can get to the exact and precise location of the node that they want."

**Precision.** The displayed X / Y / Z are `mesh.getWorldPosition` (parents' rotation / scale included) formatted to the **precision** setting (`precision`, 0..6, default 4; `formatCoord(v, decimals)`). Every move is an **absolute set**: the target coordinate is computed once (`nudge` on the step grid, the typed value, or `dragCoord` from the grab offset), rounded with `roundTo(v, precision)` (decimal rounding: 1.005 -> 1.01), and the primary node is written to exactly that value; extras ("together" nodes) shift by the same delta (6-decimal clean) so their spacing is kept. 100 steps of 0.1 land on exactly 10 (no 9.999999999999998). World -> local conversion keeps the numbers untouched when the parent is the scene or has an identity matrix (`_toLocal`); under a rotated / scaled parent the local value is matrix-derived (error below 1e-6, below the displayed 4 decimals).

**Audit of node kinds.** Plain, group, essence, store item / value, path node, label sprite (Dimensional Text, a `Sprite` mesh: the world position and the drag hit test now include sprites), nodes inside a group (world / local), nodes with edges (`omni:node-pos-set` rebuilds the tapered edges), nodes under a behaviour (`restPosition` shifted). **Floor panel nodes** keep their grid in their own data (`gx, gz, ox, oz`, `cellSize`): after a move the module recomputes `gx = round(x / cellSize - 0.5)` and `ox = x - (gx + 0.5) * cellSize` (clamped to half a cell, as `sanitizeFloorPanel` does) and emits `omni:floorpanel-changed`, so snap / rotate / move later start from the precise place (their Y stays free). Cannot move, with the reason in the panel and the arrow buttons dimmed: nothing selected, tracking nodes, non-OmniNode objects, behaviour-locked, structural, not in the scene.

**Pick any node.** While the mode is on, a plain click on the canvas (not an orbit drag: more than 6 px between press and release is ignored) raycasts every registry node (`omniNode.getAllMeshes()`, minus structural `skipAutoSelect` ones, as OmniNode's own selection does) and asks for `omni:node-select-by-id`; OmniNode answers with the usual `omni:node-selected`, so every other panel follows. That click is swallowed so Path mode does not connect and Place mode does not place; a click on empty space in those two modes is swallowed too; in Select mode it passes through (deselect, as before).

**Axis checkmarks.** Each coordinate has a real checkbox: exactly one is checked (checking one unchecks the others, unchecking the last one is refused and re-checked). The checked axis is the focused axis: only its field is editable (typed exact value + Enter), the other two are read-only. The keys 1 2 3 / x y z toggle it as before. This replaces the V191 X / Y / Z button row.

**Step field and arrow buttons.** A numeric **Step** box (the "space iterator"; 0.001..100, default 0.1; Enter or blur applies, junk is marked and the saved step comes back), four preset chips 0.01 / 0.1 / 1 / 10, and **-** / **+** buttons that move by one step along the checked axis. Hold repeats (380 ms delay, then every 70 ms; one undo entry for the whole hold; throttled position events, one flush at release; pointerleave / cancel / leaving the mode / a node that cannot move stop it). Shift = 10 x step, Alt = step / 10 on the buttons and the wheel; the keyboard arrows keep Shift (Alt+arrow is left to the browser). The step is `step` in `omni:strictalign-v1` (the same setting Admin edits; they follow each other through `omni:strictalign-changed`).

**Settings added** (`utils/OmniStateStrictAlignSettings.js`): `precision` (int 0..6, 4) and `shiftAuto` (true: Shift = 10 x step; false: the fixed `shiftStep`). An older save that has `shiftStep` but no `shiftAuto` resolves to `shiftAuto: false`, so it keeps working unchanged. Admin block: Decimals, Shift = 10 x step.

**Open.** Only the primary node is rounded to the precision; with "together" nodes the others keep their own fractions. A floor panel moved off the grid can overlap a neighbour (no collision check, by design: exact placement wins). Real GPU, finger drag and the real OmniNode edge rebuild during a long hold are not verified.

## Not verified / open

Real GPU, real mouse feel, a finger drag on a phone (the pointer handlers are the same code, synthetic events only), the multi-node case against a live OmniSelector volume, path / floor-panel nodes from the parallel build, a node under a running behaviour in the browser. Questions for the owner: is X the right default axis (or should the person always choose)? Should the terminal also keep the `` ` `` key when no node is selected?
