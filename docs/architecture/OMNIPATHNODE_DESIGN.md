# OmniPathNode and OmniNodeOrderPanel (V191)

Status: implemented in V191, verified with jsdom tests and a software-GL Chromium smoke test. Real GPU, phone and touch not verified.

## Purpose
An ordered, persistent list of OmniNodes ("a path"): a tour, a reading order, a hierarchy walk. The path itself is shown in the scene by one **OmniPathNode** (an octahedron) and a line through its members.

## Existing equivalents (checked first)
- **Edges** (`systems/OmniNode.js`, `OmniEdge*`): pairwise links between two nodes, carry hierarchy and Sequence behaviour. Not an ordered list; a path is NOT built from edges, so hierarchy and sequence logic are untouched.
- **Chains / FlowFire chains**: transient firing order of payloads, not stored as a user-visible ordered list.
- **Tracking nodes**: follow a target, no order.
- **`parentId` hierarchy** plus `ui/TreeView`: the genealogy source. GENEALOGY mode reads it; it never writes it.
- No PathNode / OmniPath existed in code.

## Model (`utils/OmniPathModel.js`, pure + localStorage `omni:paths:v1`)
Path: `{id, name, mode LINK|GENEALOGY, order preorder|breadth, rootId, members[], color, closed, visible, nodeId, droppedCount, dropped[]}`. Members are node ids only (persistent references). Caps: 200 members, 50 paths, 5 remembered dropped labels. Everything read from storage goes through `sanitizeState` (types, caps, duplicates, junk ids). Mutations push per-path undo snapshots (30, memory only). Event `omni:paths-changed`.

## Runtime (`systems/OmniPathNodes.js`)
Creates the path node kind (`nodeKind 'omniPath'`, via `utils/OmniExtraKinds.js` and the V183 kind hooks in OmniNode). LINK recording appends each node selected while recording. Genealogy is built on demand from `parentId`. Deleting a member drops it, remembers the label and notes it in the panel. Deleting the path node deletes its path. The line (THREE.Line + Points, vertex colours) is refreshed at 10 Hz and is not pickable.

## UI
`ui/OmniNodeOrderPanel.js` (class A window via OmniSettingsPanelBase: resize, maximize, phone sheet): list with drag handle (HTML5 DnD for mouse, pointer drag for touch), up/down, remove, jump (select + camera), add selected, record, mode/order/root, rename, path picker, undo, loop, line, check. Inspector block: `ui/OmniExtraKindInspector.js`. Ribbon: Home > Create > Path node and Node order, both with `data-omni-tip`.

## Decisions
Path line is not an edge. Genealogy is a snapshot, rebuilt on request. Undo is per path and in memory only.
