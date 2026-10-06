# ⟐OmniFlowFire — the centre Fire button, flowchart elements and payloads (V168)

**Status: built (first pass). Checked headlessly (node + jsdom) and in real Chromium (Playwright, software WebGL, flat white / black scene backgrounds). Not seen on real hardware, a photo wallpaper or a touch device.**

Where it sits: `docs/architecture/SCOPIC_STATES_DESIGN.md` (the four hands = four scopes). The LeftHand is **Process**, the RightHand is **Object**. This feature is the first thing they do *together*: "the inspector, broken up between hands", specifically for **shooting content out** (and, much later, for content being **shot at the user** to interpret).

## The model in one paragraph

A **payload** is a thing the user *creates*: a data type, a value and a style. Payloads live in a library; the current one is the **RightHand's ammo**. The pad's **centre button is Fire** (`omni:hand-fire {hand}`). The **LeftHand fires a flowchart element** (Terminator, Process, Decision, InputOutput, Connector, Loop): a tracer flies from the pad's corner to a destination and a real node of that shape appears there. The **RightHand fires a display**: the same shot, but what arrives is a small anchor on which the current payload plays (a string as word tooltips; a number / boolean as one badge tooltip). When the LeftHand fires while a payload is current, the element **hosts** that payload: it is styled by it and plays it. So LH answers "what flows" (the shape and the chain), RH answers "what is inside it and what it looks like" (data type, value, colour, texture, material).

## Fire (the centre button, `ui/MovementPad.js`)

- lh and rh only (`#omni-pad-fire-lh` / `-rh`). OmniHand and ConsciousHand keep their inert centre label: **Fire is undefined for them.**
- A real round `<button>` filling the pad's centre cell (44 px desktop, 40 px phone; the four direction buttons are 23 px from the centre, so it cannot be larger without covering them). Pressed / held feedback while the pointer is down; a **ready** glow when there is something to fire (lh always; rh when a payload is current; both dim when the master toggle is off); the ammo name small beneath the glyph, ellipsised (lh = the element kind, rh = the payload name). `aria-label` "Fire <ammo>". Fires on `click`: mouse, touch, and Space / Enter while it has focus. No global key is bound (F / R / WASD / arrows / `[` `]` are untouched; Space is not used anywhere else).
- It does not interfere with the D-pad (separate button, no hold-repeat), header drag, release / detach or the satellites; checked with `document.elementFromPoint` at the centre and on a ring around it, on desktop and phone viewports (see BuildLog V168).
- `omni:hand-fire-feedback {hand, kind: 'fired' | 'empty' | 'disabled'}` pulses the centre button (green-white ring / red ring). The red pulse on the **Activation** satellite is unchanged and still means "no target" for behaviours.

## Target and destination (`systems/OmniFlowFire.js`)

1. **Target** = the selected node; else the node nearest the screen-centre ray within 25° (the V165 resolver in `systems/OmniHandAmmo.js`, reused through `setTargetResolver`; it now also forgets the selection on `omni:node-deselected`, which V165 did not, and takes an optional `skip` predicate so fired elements are not picked by the centre-ray search; selecting one still targets it). Works for nodes of **both** registries (OmniNode `_nodes` and NodeLoader `_registry`): the target is just a mesh with `userData.nodeId`.
2. **No target → the HUD centre**: `camera.position + forward × fireDistance` (⟐OmniHands, 2–60, default 10, per hand). Fire never shows "no target".
3. **Placement.** lh: beside a target (camera-right, 1.8 units) or exactly at the HUD point; rh: above a target (+1.1), or at the HUD point. A spot already taken by an element of the same hand (or a shot in flight) is nudged (lh sideways, rh up) so repeats never stack.

## LeftHand: flowchart elements

- Radial ⟐1 slots 1–6 = the kinds; the lit one is the current kind (default Process); also a selector in ⟐OmniHands. Geometry (`buildFlowGeometry`, 0.6–1.2 units): Terminator = flattened capsule (pill), Process = box, Decision = rotated square (diamond), InputOutput = skewed box (parallelogram), Connector = small sphere, Loop = torus. The element faces the camera at creation.
- **Shot.** A line grows from the pad's screen corner to the destination with a bead at its head (`SHOT_SECONDS` 0.32), then fades; at most 8 in flight; all geometry / materials disposed.
- **Node.** On arrival an ordinary `omni:node-create-request` (works through OmniNode; `skipAutoSelect: true`, `parentId` = previous chain element or none). It carries `data.flowElement = { v, kind, hand, payloadId, chainId, seq, targetId, payload (a CLONED SNAPSHOT), style }`. OmniNode's create handler lists fields explicitly, so V168 added `flowElement` there (and the "selection is the default parent" rule is skipped for flow elements, so a fired element is only linked to what the chain says).
- **Chain.** Consecutive LH elements link with an ordinary OmniNode edge (the new node's `parentId` = the previous element; persisted with the node store) and run along the camera's horizontal right as it was when the chain began (a flowchart across the screen; straight down would hit the floor). A chain continues while the target is the same node, or, with no target, while the HUD point stays within 1.5 × fireDistance of the chain's first element. It resets on a different target, on **End chain** (⟐OmniHands, `omni:flow-end-chain`), when its last element is deleted, or when `chainEnabled` is off (then every element stands alone). A chain is not restored after a reload (the elements and their edges are; the next shot starts a new chain).
- Styled by the current payload (colour / texture / material) when there is one, else neutral grey-blue standard material.

## RightHand: payloads (`utils/OmniPayloads.js`, `ui/OmniPayloadPanel.js`)

- Radial ⟐1: **#1 DataTypes, #2 Color, #3 Texture, #4 Material**. All four open the one **⟐Payload** panel (draggable, WindowManager id `omnipayload`, minimizable) focused on the matching section; selecting the lit tool again closes it. (A single shared panel rather than four popovers, so one place edits one payload. This was the "or" in the brief.)
- **Data types:** String (full: per-word timing), Number and Boolean (one badge tooltip, `123 · number`). Array and Object are listed, disabled, "later".
- The panel: type selector, a text field for the value (textarea ≤ 500 chars / number input / true-false toggle), name, timing (delay between words 50–3000 ms slider + number, hold, rise, direction, loop, max words), a live **preview** (the same player the fired element uses; it replays, debounced, after any change), **Create ammo** (adds to the library and makes it current), and the list (Use = current ammo, Edit → Save changes, Delete).
- **Style:** colour (input + swatches), texture (the OmniGallery swatches, listed in-panel from its exported `GALLERY_ASSETS`, or none), material (standard / basic / emissive / glass / wireframe / metal). Style edits apply **live to the current payload**. Textures are *not* picked through `omni:gallery-texture-select`: the Inspector also applies that event to whatever node is selected, so a pick for a payload would re-texture the fired-at target.
- **Store** `localStorage 'omni:payloads-v1'` `{_v, current, payloads[]}`, sanitised on load and write (string ≤ 500, finite numbers, name ≤ 40, display / style clamped, bad rows dropped). Events `omni:payload-changed {id, kind}`, `omni:payload-current {id}`. A payload is `{id, name, type, value, display:{mode:'tooltip', wordDelayMs, risePx, holdMs, direction, loop, maxWords}, style:{color, textureId, material}, created}`.

## Display (`utils/FlowWordPlayer.js`)

The "DynamicNode" technique with one tooltip per word: words appear one by one, `wordDelayMs` apart, each rising (or falling) `risePx` while it fades in, holds and fades out; a small deterministic x spread (−26 / 0 / +26 px) keeps fast streams from stacking on one column. Labels use the `--ttm-*` tooltip variables (they follow ⟐ToolTipSettings) and are tinted with the payload colour, lightened toward white if it is too dark for the tooltip background. Over `maxWords` the string ends with an ellipsis word. Caps: 24 word elements alive across everything (oldest dropped). While a display is alive the engine projects the element's world position to the screen every frame (hidden when behind the camera), so the words follow the camera. Everything (timeline, tweens, DOM) is removed when it ends, on replay, on node deletion, on master off and on destroy. **Replay:** click the element (selecting it), `omni:flow-replay {nodeId}`. A loop runs until replayed, the node is deleted or the master toggle goes off.

## Persistence and limits

- Fired elements / anchors are ordinary OmniNode nodes saved with the scene; `flowElement` carries the payload **snapshot**, so deleting a library item never breaks a fired element. On reload OmniNode restores the nodes and the engine re-adopts them from the `omni:nodes-request` snapshot, re-applying the shape and style (the registry builds every node from its base geometry first).
- `maxAlive` per hand (default 40, 1–200): the oldest scale out and are deleted through OmniNode. Master toggle `omni:flow-fire-master-set {enabled}` (persisted `omni:flow-fire-master-v1`; also in ⟐OmniHands). "Remove all fired elements" = `omni:flow-clear {hand}`.
- Events out: `omni:flow-fired {hand, kind, nodeId, targetId|null, payloadId}`, `omni:flow-display {nodeId, phase}`, `omni:hand-fire-feedback`, `omni:flow-state {hand, kind, alive, chainLength, payloadId, ready}`.
- Known quirk: OmniNode lights a selected node with an emissive colour, so the `emissive` material loses its glow while the element is selected.

## What is NOT built

- **Array and Object** payloads.
- **Per-word panels** (a documented future switch: `display.mode` is fixed to `'tooltip'`).
- The **incoming mode**: content "shot at the user" for interpretation (the reverse of this, which the brief says comes "when we get further").
- **Flowchart execution or semantics.** Elements are visual / structural: a Decision has no branches, a Loop does not loop, the chain is not a program. Linking is an edge and an order.
- Key bindings for Fire beyond Space / Enter on the focused button.
- The RightHand's **Activation** satellite still fires V164 behaviours (see `SCOPIC_STATES_DESIGN.md`, known mismatches).
- LH payload "contents" are simply the RH's current payload; a separate per-hand ammo is not modelled.
