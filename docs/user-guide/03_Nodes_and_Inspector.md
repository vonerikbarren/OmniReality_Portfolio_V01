# 3. Nodes and the Inspector

Applies to: V183 · Status: verified against code on 2026-10-09 · Real devices: not verified.

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
- Select one and the Inspector shows a Store item or Value block in Appearance (still 12 sections). Store item: Window, Wish, Cart, Open in store, Buy... Value: Grant 10 (sandbox), Open in OmniTalent, Open exchange. All sandbox, all value fake. See [OmniStore and OmniValue](08_OmniStore_and_OmniValue.md).
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

Under the header is an **icon strip** of 12 buttons, one per section. A dim icon means the section does not apply; a lit icon means it is open.

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

## Activation and the ammo chip

The LH and RH pads carry an ammo chip. Press **[** or **]** to change it. See [Firing](04_Firing_and_Payloads.md).
