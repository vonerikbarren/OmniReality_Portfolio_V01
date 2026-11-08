# Stored video and stored reality

## Stored video node
A flat plane that plays one video from your library, with a **key** so a green (or blue) backdrop disappears and only the person is left.
- Make one: Ribbon, Nodes, **Stored video** (or the node picker).
- Select it. In the Inspector choose a video from the library or add a file. It starts playing on the plane.
- **Key out** turns the key on or off. **Key colour**: pick any colour, or press green, blue or magenta. **Similarity**: how far from the key colour still counts as backdrop. **Smoothness**: the soft edge around the person. **Spill removal**: pulls the green tint out of the edges that stay.
- Width sets the size; the height follows the video. Sound is off until you tick it (browsers block sound before a click).
- A shadow on the backdrop is still removed, because the key looks at colour, not brightness. Clean, even lighting on the screen gives the best result.
- Up to three videos play at once. A video more than 160 units from the camera pauses.

## Stored reality node
A whole course kept in one small glass box. Stored, it costs one box and one cloud of points however many nodes are inside, so busy areas stay smooth.
- Make one: Ribbon, Nodes, **Stored reality**. Name it in the Inspector.
- **Store**: put nodes inside the box (or select one) and press *Store nodes in the box*. They leave the scene and the box shows a point for each, plus the counts and the first names. You can read what is inside before opening it.
- **Expand**: lays the nodes out again around the box, with the same names and lines. **Store** again keeps them again.
- **Voxel**: type a room such as `2,0,1` to move the box to the centre of that room. A room is a fixed size, so the box always fits.
- Limits: 400 nodes and 1200 lines per box. Not kept inside yet: path-node and terminal side stores, and library media (the library is shared).
