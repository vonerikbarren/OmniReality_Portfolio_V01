# 23 · OmniVoxel rooms (V210)

Open **⟐OmniVoxel** from the ribbon (voxel-rooms button) or StarLight.

- **Room** = one floor grid cell, fixed 20 world units per side. Add rooms in six directions: right, left, above, below, front, back. Neighbouring rooms link automatically through a door point; you can cut and restore any link. No diagonals.
- **Subdivision**: split a room into 2, 4, 8 … 256 per side. Enter a sub-room by its index and split it again (recursive, up to depth 8).
- **Points**: centre and door points are predefined; add your own on the room's lattice. A node's own geometry (a sphere, a box) can be taken as traversable points with *Use shape*.
- **Lines**: link lines are automatic; add your own between two points. Modes: walk ×1, ride ×3, fast ×8.
- **Route**: pick a start and an end point; the shortest (by travel time) path is highlighted. Removing or cutting a piece of the route clears it.
- **Layers**: rooms, points, lines, lattice can be toggled. Rooms, cut links, your points and lines are saved on this device; shapes are re-taken from the nodes.
- **Voxel nodes (V211)**: every room has an **OmniVoxelNode**, a small gold diamond at its centre (it replaces the old centre dot). Select it to select the room; its Inspector block shows the room, its level and its links, with **Open ⟐OmniVoxel**. Removing a room removes its node.
- Coming next: capsule avatar travelling the lines, follow camera with a "Follow avatar" button.

# Also in V211
- **Meters off by default**: the centre "⟐ Ground (y …)" tag and the internal OmniMeter gauges start hidden. Turn them on from their settings; if you had them on before, they were reset once.
- **OmniDock_Realities placement**: open its settings (⚙) → *Where it sits*: Bottom, Top, Left, Right or Floating panel (drag it by the grip; the place is remembered). To hide it, switch *Show* off.

# OmniScan (V212)
Open **⟐OmniScan** from the ribbon (◎) or StarLight. It reads the node in the middle circle of the screen: the nearest node inside the circle wins; if nothing is in it, it shows the node you selected. **Pin** holds one node while you look around. **Text** is a plain summary; **JSON** is the data (developers see the full record, everyone else a short one; developers open on JSON). **Copy** copies what you see. The **Circle size** slider sets how wide the scan circle is and is remembered.

# OmniNote (V213)
Create one from the ribbon (✎ Note node) or StarLight; **⟐OmniNote** opens the editor. The note is a sheet in the space that shows what you write.
- **Toolbar**: undo / redo, style (paragraph, headings 1–6, quote, code), font, size, bold, italic, underline, strikethrough, subscript, superscript, text colour, highlight, clear formatting, align (left, centre, right, justify), bullet and numbered lists, indent / outdent, line spacing, links (https / mailto), pictures (PNG, JPEG, GIF, WebP, shrunk to fit), horizontal rule.
- **Tables**: choose rows × columns and Insert; put the cursor in a cell to add or remove a row or column, or delete the table.
- **Find and replace** (Aa = match case), with a word and character count.
- **Sheet**: width, grow-with-the-text or a fixed shape, paper and ink colours, base font, size, margin, line spacing, sharpness (512 / 1024 / 2048), both sides or front only, frame.
Your text is cleaned as you type: scripts, remote pictures and unknown styling are dropped. Far-away notes are not drawn until you come near.

# Avatar, follow camera and point nodes (V214)
- **Point nodes**: every point you add is now a small pink node (like the gold voxel node of a room). Select it to see it; its Inspector block has **Go here**, **Place avatar here** and **Open ⟐OmniVoxel**.
- **Avatar**: a gold capsule. In ⟐OmniVoxel → *Avatar*, choose a point and press **Place**, then pick another and press **Go**. It travels along the lines (walk ×1, ride ×3, fast ×8) and only ever stops at points. **Stop** finishes the line it is on and stands on the next point. Giving it a new destination while it moves re-routes from the next point.
- **Follow camera**: the camera follows the avatar by default and keeps your distance and angle. As soon as you move the camera yourself (orbit, pan, zoom, WASD, the pads, take-me-there) it lets go; **Follow avatar** brings it back.
- The avatar's place and the follow setting are remembered on this device.
