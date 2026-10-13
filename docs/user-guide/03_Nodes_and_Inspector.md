# 3. Nodes and the Inspector

Applies to: V194 · Status: verified against code on 2026-10-12 · Real devices: not verified.

[Guide index](README.md) · Previous: [The Four Hands](02_The_Four_Hands.md) · Next: [Firing and Payloads](04_Firing_and_Payloads.md)

A **node** is a small object in the space. Nodes can be joined by **edges** (lines). The **Inspector** is the panel where you read and change the selected node.

## Make a node: the OmniDraw mode picker

1. Press **n** (or ribbon Home > Create > OmniDraw). The picker "⟐OmniDraw — choose a mode" opens.
2. Pick a tile.
3. Close the picker by pressing **n** again or clicking outside it. Escape does not close it.

| Mode | What it makes |
|---|---|
| Static | A real object you place and shape. Its panel has "⟐ Domain Expansion (→ Sphere)" and "⟐ Export to Scene" |
| Dynamic | A string shown over time. "Create Ticker" |
| Jsonifier | A JSON tree |
| OmniCell | Numerical data shown as a chart |
| Chat | A live message / terminal build tool |
| Log | A blog post split into pages in the scene |
| OmniNode | Opens the ⟐N panel (below) |
| BehaviorNode | A node that animates other nodes |

### Store item and Value type nodes (V183, sandbox)

The geometry picker has two extra entries under the shapes: **Store item** and **Value type**. Choose one, pick a product or a value type from the short list (there is a search box), then click in the space as with any other node. You can also use **Pin to my space** in the Exchange, the pin button on each wallet row, or **Pin this value type** in OmniTalent: the node drops about 6 units in front of you.

- A **Store item** node shows the product's emoji on a cube or disc and a label with its name, price and stock. It only points at the product: change the product in the store catalog and the node follows. If the product is deleted the node turns grey with "Missing product"; it is not deleted.
- A **Value type** node shows the type's emoji and your live balance.
- Deleting or duplicating a node never changes the product or the value type. A duplicate is another pointer.
- Join two Value type nodes with an edge (PATH mode in ⟐N) and the edge shows the rate between the two types, both ways, or "no direct rate". The edge stores no rate; it is read from the OmniValue model every time. Conversion itself is not done here; use the Exchange.
- Select one and the Inspector shows a Store item or Value block in Appearance (still 13 sections). Store item: Window, Wish, Cart, Open in store, Buy... Value: Grant 10 (sandbox), Open in OmniTalent, Open exchange. All sandbox, all value fake. See [OmniStore and OmniValue](08_OmniStore_and_OmniValue.md).
- Time, Behaviors, grouping and duplicate work on them like on any node.

## The ⟐N panel (OmniNode)

| Control | Does |
|---|---|
| Mode ⊙ Select | Click a node to select it; click a line to open the edge inspector; click empty space to deselect |
| Mode ⌁ Path | Click node A, then node B to draw an edge between them |
| + Add Node | Opens "Select Geometry" (pick a kind, then a shape), then PLACE mode |

In PLACE mode a crosshair follows the view. Click the floor to drop the node (if you have a node selected it becomes the parent). If the click misses the floor the node appears 6 units in front of the camera. **Escape** cancels. The lists "Nodes (N)" and "Edges (N)" each have a ✕ to delete.

## The Inspector

It opens on the right (340px wide) when you select a node. Empty state: "No node selected — Click a node in the scene or select one in ⟐N".

Header buttons: ✕ close, _ minimize, ⟐ attach, 💾 save, Ξ select the whole genealogy, 🗑 delete, ⇥ snap right, maximize.

**Delete is immediate: no confirmation and no undo.**

Under the header is an **icon strip** of 13 buttons, one per section. A dim icon means the section does not apply; a lit icon means it is open.

| Section | Icon | Use |
|---|---|---|
| Identity | ◉ | ID, label, surface text, primitive type |
| Location | ⌖ | Only for location nodes (OmniPointing) |
| Hierarchy | ⌥ | Parent, root, depth, tunnel/time/merge options |
| Domain | ◍ | Make the node a space you can enter |
| Appearance | ◐ | Colour, material, geometry, position, rotation, scale |
| Automation | ⟳ | Auto-rotate, look-at, what it runs on its own |
| Behavior | ⚙ | The attached behaviour and whether it is on |
| Time | ◔ | Put the node on the timeline ([Chronos](06_Chronos_Player_and_Timeline.md)) |
| Program | ▶ | The bound OmniProgram: run mode, auto-persist |
| Media | ▣ | Images, sound and other media |
| Sound | ♪ | Gives the node a sound: switch, preset, note, dynamics, volume, loop, spatial ([Sound nodes](12_Sound_Nodes.md)) |
| Data | ≣ | Internal/external data, GoTo / TravelTo, info plane |
| Create New | ＋ | Create a node with its own shape, transform, parent |

The ribbon Inspector tab opens the same sections.

Desktop: Identity, Location and Appearance start open and sections open independently. **Phone (700px wide or less):** only one section is open at a time; tapping the open one closes it; the panel sits at the left under the bar and ribbon, is at most 45% of the screen tall, and starts with none open. Your choice is remembered per device type.

### Time section

| Control | Does |
|---|---|
| On timeline | Adds a 5 second clip at the playhead |
| Clip, Track | Choose the clip and track ("＋ New track" makes one) |
| Start (s), Duration (s), Loop | Clip timing |
| Keyframe property + ◇ At playhead | Position X/Y/Z, Scale, Rotation Y (deg), Opacity or Colour keyframe now |
| Keyframe list | Click to jump, edit the value, ✕ to delete (first 60 shown) |
| Reveal on timeline | Show the clip in the timeline |

## Sound nodes

A **sound node** (a small speaker-shaped bell with rings) makes a sound, and any node can get a sound from its Inspector **Sound** section. Make one with ribbon Home > Create > Sound node. Everything about it is in [Sound nodes](12_Sound_Nodes.md).

## Song nodes

A **song node** (a flat record disc) arranges music nodes and audio clips on a timeline with a mixer, sections, tempo changes and automation. Make one with ribbon Home > Create > Song node (it opens **⟐OmniSong**; Home > Tools > Song editor opens it for the selected one). The Inspector shows its transport, tempo and length. Everything about it is in [Song nodes](17_Song_Nodes.md).

## Path nodes and the OmniNodeOrderPanel

A **path node** (an octahedron) stands for one ordered list of your nodes, such as a tour or a reading order. Make one with ribbon Home > Create > Path node; it opens the **⟐OmniNodeOrder** window. The Inspector shows the same controls for a selected path node.

| Control | What it does |
|---|---|
| Mode LINK | Press **Record links**, then select node A, B, C in turn. Each node is added to the end and a line joins it to the one before. Esc or **Stop recording** ends it |
| Mode GENEALOGY | Select a root node, **Use selected as root**, choose pre-order or breadth-first, then **Build from hierarchy**. The list is built once from the parent/child tree; rebuild after you change the tree |
| Drag, ▲ ▼, ✕ | Reorder by dragging the ⠿ handle (mouse or touch) or with ▲ ▼. ✕ removes a node from the path only. **Undo** (last 30 steps of this path) |
| ⌖ | Selects the node and flies the camera to it |
| Add selected | Appends the selected node |
| Loop, Line | Close the line into a loop; show or hide the line |
| Rename, path picker, New, Delete | Up to 50 paths of up to 200 nodes each. Deleting a path also deletes its path node, never the members |

Paths are saved and come back after a reload. If you delete a node that is in a path, it is taken out of the order and the window says so ("1 deleted node was dropped"); a node that cannot be found shows as missing and can be removed.

## Floor panel nodes

A **floor panel node** is a flat piece of floor: one square panel per floor grid cell, laid out as a Tetris piece (I, O, T, S, Z, J, L, plus single, double and three-cell pieces). A piece is one node; you can still remove single panels. Build and place them in **⟐FloorNodeMakerSettings** (Admin panel, slot 20, or ribbon Home > Create > Floor panels); see [Settings and Admin](09_Settings_and_Admin.md).

With a floor panel node selected, the Inspector shows: piece and floor cell; **Rotate left/right** and **Mirror** (quarter turns); **Snap** (puts a dragged piece back on the grid); a small map of the panels, where you click one to choose it; **Choose file** or a link for the chosen panel's face (picture png/jpg/webp up to 2 MB, GIF up to 4 MB, video mp4/webm up to 8 MB, https links only); **Clear**; **Link for all panels**; opacity; **Remove panel**. Videos are muted and loop; at most 4 animated faces play at once (the nearest on screen), the rest pause. A link must allow other sites to load it, otherwise the face stays grey and the Inspector shows the reason.

## Activation and the ammo chip

The LH and RH pads carry an ammo chip. Press **[** or **]** to change it. See [Firing](04_Firing_and_Payloads.md).
