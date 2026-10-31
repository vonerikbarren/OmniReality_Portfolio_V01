# 41 — Lineups and attachments (V244)

The skeleton side of the OmniVoxelNode: put nodes in a sequence on a shape, reorder them, and carry things at a node's core. It works on any node (voxel nodes, poly cubes, semantics cubes, plain nodes).

- `Omni Lineup create id(story) layout(helix) ids(a, b, c) [center(x, y, z)] [spacing(3)]` — layouts: row, grid, tunnel, helix, sphereIn, sphereOut; any number of nodes up to 60. No center: 12 units ahead of you.
- `Omni Lineup place id(story) node(d) index(1)` — put a node at sequence number 1 (no index: last). The others shift and every node glides to its new slot. A node is in one lineup at a time.
- `Omni Lineup take id(story) node(d)` · `Omni Lineup arrange` (glide everything back to its slot after you dragged some) · `Omni Lineup delete id(story)` (nodes stay where they are).
- `Omni Lineup attach node(a) to(b) [off(0, 3, 0)]` — a travels with b and keeps its offset (default: where it is now). Loops are refused. `Omni Lineup detach node(a)`.
- `Omni Lineup list` — each lineup in sequence order, and what carries what.

Saved apart from the nodes (browser storage `omni:lineups:v1`); deleting a node removes it from lineups and attachments. ## Walking a lineup (V247)
`Omni Lineup walk id(story) [seconds(2.5)] [hold(1.5)] [distance(8)] [from(1)] [loop(true)] [auto(false)] [captions(false)]` — the camera flies to each node in sequence order, holds, and goes on; a caption shows "2 / 5 · label". Esc ends it (or `Omni Lineup halt`).
- Tunnel, helix and sphereIn: the camera goes INSIDE the shape and looks out at each node (you walk through it). sphereOut: outside, looking back. Row and grid: in front of the node.
- `auto(false)`: it waits at each stop; step with `Omni Lineup next` / `Omni Lineup prev`.
- `from(3)` starts at sequence number 3; `loop(true)` wraps around to the start.
- Orbit controls are off during the walk and handed back at the end. A fly already in progress (such as the opening descent) is stopped when the walk starts.

Not built yet: the lineup inside `.omni.json`, a sequence number shown on the node, a button for it in the ribbon.

## Sequence numbers (V255)

Every node that is in a lineup shows a small round number above it: its place in the sequence (1, 2, 3 ...). The numbers follow the nodes when they glide, keep a steady size on screen, show through other things, and can not be picked or moved. They are not saved with the nodes.

- Ribbon: Sandbox > Lineup > **Numbers** turns them on and off.
- Command: `Omni Lineup numbers(on)`, `numbers(off)`, `numbers(toggle)`; add `total(true)` to show 2/6 instead of 2.
- Your choice is remembered in this browser.
