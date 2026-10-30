# 43 — Doc windows: a few sheets, a whole document (V250)

A window is N sheets in a layout that show N consecutive pages of a long document. Turn it like a carousel and the same few sheets page through hundreds of pages (only N sheets ever pay for pixels).

- `Omni Doc window id(myDoc) layout(helix) pages(8) name(w1) [start(1)]` — makes the sheets (1-25) around a point ahead of you. Layouts: row, grid, tunnel, helix, sphereIn, sphereOut. No id: the selected doc node.
- `Omni Doc flip name(w1) [dir(-1)] [by(3)] [seconds(0.6)]` — turns the window by `by` pages. Each page: the first sheet shrinks away, the others glide one place over, and it grows back at the end showing the next page. `dir(-1)` goes back. Stops at the first / last page.
- `Omni Doc goto name(w1) page(120)` — jump straight to a first page (stops a flip in progress).
- `Omni Doc windows` lists them; `Omni Doc unwindow name(w1)` forgets one (the sheets stay as ordinary doc nodes). Deleting any sheet drops the window.

Saved in browser storage; the sheets themselves are saved with the scene. Not built yet: a button / key for flipping, flipping by looking at the window, a ribbon entry.

Also in V249 (your fix): page-layout rotations are now in three.js's own Euler order, so pages in the sphere, helix and tunnel face the right way. V250 adds a test that checks the facing of every page of every layout.
