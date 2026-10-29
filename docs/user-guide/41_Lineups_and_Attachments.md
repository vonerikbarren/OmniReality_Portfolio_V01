# 41 — Lineups and attachments (V244)

The skeleton side of the OmniVoxelNode: put nodes in a sequence on a shape, reorder them, and carry things at a node's core. It works on any node (voxel nodes, poly cubes, semantics cubes, plain nodes).

- `Omni Lineup create id(story) layout(helix) ids(a, b, c) [center(x, y, z)] [spacing(3)]` — layouts: row, grid, tunnel, helix, sphereIn, sphereOut; any number of nodes up to 60. No center: 12 units ahead of you.
- `Omni Lineup place id(story) node(d) index(1)` — put a node at sequence number 1 (no index: last). The others shift and every node glides to its new slot. A node is in one lineup at a time.
- `Omni Lineup take id(story) node(d)` · `Omni Lineup arrange` (glide everything back to its slot after you dragged some) · `Omni Lineup delete id(story)` (nodes stay where they are).
- `Omni Lineup attach node(a) to(b) [off(0, 3, 0)]` — a travels with b and keeps its offset (default: where it is now). Loops are refused. `Omni Lineup detach node(a)`.
- `Omni Lineup list` — each lineup in sequence order, and what carries what.

Saved apart from the nodes (browser storage `omni:lineups:v1`); deleting a node removes it from lineups and attachments. Not built yet: walking the lineup as a camera path, the lineup inside `.omni.json`, a sequence number shown on the node.
