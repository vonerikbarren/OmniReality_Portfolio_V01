# Edge node, Profiler, and arrangements of pages

## Edge node
A node that sits on the line between two nodes and says how you travel it.
- Make one: select a node that has a line to another node, then Ribbon, Nodes, **Edge node** (or the picker). Or `Omni EdgeNode create from(a) to(b) mode(tunnel)`.
- **Way**: *Line* (ride along it), *Tunnel* (rings round the route, you go through), *Torus* (loop a ring first, then go on), *Orbit* (fly to a ring round the end and circle it).
- **Control points**: each has *along* (0.01 start to 0.99 end), *side* and *up* (world units). No points is a straight line; one bends it once; more make a curve through all of them. They follow the nodes when either moves.
- **Ride** flies the camera along the route; **Ride back** goes the other way (if Two ways is on). **Speed** is units per second. **Look**: along the route, or at the destination.
- The diamond sits half way between the two nodes. If one node is deleted the diamond turns red.
- The Presenter rides an edge node when it moves from one step to the next across it.

## Profiler
A notebook of the people and things you meet, in the OmniStar tab next to **Profile**. Select a node and press *Track selected*: visits are logged. When a claim gets a testimony, the speaker is added and logged for you. Every node you make is a line in the Journal. Add notes, tags and lines of your own. Locked claims are never read. Saved in this browser only.

## Page up and Page down in an arrangement
When a doc is shown as a spiral, grid, row, tunnel or sphere, **Page down** moves a whole set: 2, 4, 6, 8, 10 or 25 pages, whatever the sheet count is. **Shift + Page down** moves one page. The last set stops at the end of the document (it can overlap the one before it).

**Select all** (Doc node Inspector, when the node is in an arrangement) outlines every sheet. Then **Delete all** removes the arrangement, **Save** writes it as an `.omni.json` (a path saves inside the app, blank downloads it), and **Move by / To me** moves the whole object.
