# 40 — The semantics cube (V243)

A six-face cube, one face per axiom: ◉ Identity, ⓘ Information, ▦ Space, ⧖ Time, ⚡ Power, ❖ Expression. This is the SKIN of the OmniSemanticsVoxelNode; it is drawn by a PolyNode, so tap a face for its menu. Each face has the axiom's tag and fires `semantics:<axiom>` when clicked.

- `Omni Semantics create skin(default) id(sem1) pos(0, 5, 0)` — skins: default (symbol + name, axiom colours), plain (names only), contrast (black on white), blank (every face "not defined").
- `Omni Semantics face id(sem1) axiom(time) icon(⏳) label(Clock) [event(my:event)]` — axiom by name or 1-6.
- `Omni Semantics list`

Not built yet: image / video faces, the skeleton extras (sequence index, lineup, attachments), swapping a skin on a voxel-room node, the skin inside the `.omni.json` file. See docs/architecture/OMNISEMANTICS_DESIGN.md.
