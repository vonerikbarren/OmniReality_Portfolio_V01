# OmniState_StrictAlign: move a node along ONE axis with exact coordinates (V191)

Applies to: V191 · Status: verified in jsdom and software-GL Chromium · Real devices, real GPU, touch: not verified.

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

## Not verified / open

Real GPU, real mouse feel, a finger drag on a phone (the pointer handlers are the same code, synthetic events only), the multi-node case against a live OmniSelector volume, path / floor-panel nodes from the parallel build, a node under a running behaviour in the browser. Questions for the owner: is X the right default axis (or should the person always choose)? Should the terminal also keep the `` ` `` key when no node is selected?
