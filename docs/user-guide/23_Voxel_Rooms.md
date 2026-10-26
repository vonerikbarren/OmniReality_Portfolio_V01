# 23 · OmniVoxel rooms (V210)

Open **⟐OmniVoxel** from the ribbon (voxel-rooms button) or StarLight.

- **Room** = one floor grid cell, fixed 20 world units per side. Add rooms in six directions: right, left, above, below, front, back. Neighbouring rooms link automatically through a door point; you can cut and restore any link. No diagonals.
- **Subdivision**: split a room into 2, 4, 8 … 256 per side. Enter a sub-room by its index and split it again (recursive, up to depth 8).
- **Points**: centre and door points are predefined; add your own on the room's lattice. A node's own geometry (a sphere, a box) can be taken as traversable points with *Use shape*.
- **Lines**: link lines are automatic; add your own between two points. Modes: walk ×1, ride ×3, fast ×8.
- **Route**: pick a start and an end point; the shortest (by travel time) path is highlighted. Removing or cutting a piece of the route clears it.
- **Layers**: rooms, points, lines, lattice can be toggled. Rooms, cut links, your points and lines are saved on this device; shapes are re-taken from the nodes.
- Coming in V211: capsule avatar travelling the lines, follow camera with a "Follow avatar" button.
