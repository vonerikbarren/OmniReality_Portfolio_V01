# Transform Bar

A small bar that follows the selected node so you can move, rotate or scale **any** node with exact numbers.

**Open it:** node tooltip menu > "Move / Rotate / Scale…", Ribbon > Tools > Transform bar, or `Omni Transform open`.

- **Move / Rotate / Scale** tabs. Type a number in X, Y or Z, or use − / + (the Step box sets the size; rotate is in degrees).
- **Keep shape (scale all 3)** is ON by default: change one scale box and all three grow by the same ratio, so you never get a stretched shape. Untick it to scale one axis.
- **World / Local** changes the rotate − / + buttons: World turns the node about the world axes, Local changes its own angle.
- **Group:** while Select / Connect is active, the bar works on the origin and every picked node together (rotation turns them about their shared centre).
- **Reset** returns to how the node was when the bar picked it. **Undo** steps back (50 steps).
- **Pin** docks the bar at the bottom (phones use this automatically). ▁ collapses it.
- Tracking / structural nodes are locked and the bar says so.

Commands: `Omni Transform open|close|set|lock|undo|reset` (for example `Omni Transform set mode(scale) axis(x) value(2)`, `Omni Transform lock off`).
