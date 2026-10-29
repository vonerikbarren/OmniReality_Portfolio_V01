# 38 — Doc page layouts (V242)

Lay the pages of a document out in space. Each page becomes its own doc node, so every page is sharp up close and drops out when far (the same pixel budget as any sheet).

`Omni Doc layout id(myDoc) layout(tunnel) pages(4) [start(1)]`  — no id: the selected doc node.
`Omni Doc layouts` — lists them.

| Layout | Shape |
|---|---|
| row | side by side |
| grid | rows and columns |
| tunnel | a vertical square tunnel, 4 walls per ring, rings stacked up; pages face inward |
| helix (spiral) | a spiral staircase, 6 pages a turn, pages face the axis |
| sphereIn (sphere) | pages on the inside of a sphere, facing the middle |
| sphereOut (external) | pages on the outside, facing away |

Page counts: 1, 2, 4, 6, 8, 10, 25 (anything else snaps to the nearest). `start(n)` begins at page n.
The new nodes are placed around a point 7 units ahead of you. Existing nodes are left alone.

Not built yet: pages that animate / flip through a long document in a window (so 25 nodes can show 300 pages), and the carousel. Each page node turns its own page for now.

Upload limit: documents may now be up to **70 MB** each (the library total is still 250 MB).
