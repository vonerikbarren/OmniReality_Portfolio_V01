# Lines with Meanings

A line can now say something. Pick a **meaning** and it takes a matching look; you can still tweak the look afterwards.

| Meaning | Look | Says |
|---|---|---|
| Link | solid | a plain connection |
| Flow | solid, arrow at the second node | goes from the first to the second |
| Step | dotted, arrow | the next step in a sequence |
| Optional | thin dashed, grey | may or may not apply |
| Depends on | dashed, arrow | the first needs the second |
| Strong | bold solid, white | a strong tie |
| Weak | thin dotted, grey | a loose tie |
| Contains | solid, dot at the first node | the first holds the second |
| Both ways | arrows at both ends | works both directions |
| Note | thin dotted, yellow | a note attached (sticky notes use this) |
| Conflicts | double line, red | cannot both hold |
| Drives | thin pink, arrow | a rhythm sets the beat a node moves to |
| Highlight | bold, glowing | draws the eye |

**Where:** Edge Inspector (click a line, or the ✎ in the edge list): Meaning, Ends, Dotted, Caption and ✦ Pulse. Select / Connect has a meaning picker for the lines it draws.

**Caption:** short text shown at the middle of a line when the camera is near (nearest 12).

**Pulse:** a travelling light runs along a line, flashes the node it reaches and continues along the path. It is never saved. Select / Connect pulses each new line.

**Commands:** `Omni Line meanings|meaning|style|list|pulse|captions`, for example `Omni Line meaning from(a) to(b) meaning(step)`, `Omni Line style from(a) to(b) stroke(dotted) weight(bold) ends(both) label(hello)`, `Omni Line pulse from(a) to(b)`.
