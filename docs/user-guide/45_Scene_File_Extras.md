# 45 · What the scene file carries now

[Guide index](README.md)

An exported `.omni.json` now also holds (V253):

- **Lineups** and what is attached to what, with the order of each lineup.
- **Doc windows** (the paged sheets), so a PDF layout opens on the page you left it on.
- **Your own vibration programs**, curves included.
- **Semantics cubes.** These always travelled, because the cube's faces are saved inside the node itself.

Importing puts everything back. If you add a file to a scene that already has a lineup, window or program with the same name, the new one is renamed (`L_2`, `w_2`, `mine_2`) and you get a note. Anything that points at a node missing from the file is dropped with a note. Files from before V253 still load.

Still **not** in the file: hand settings, painter strokes, scene orbs and media stored in the browser (see the scene-file notes).
