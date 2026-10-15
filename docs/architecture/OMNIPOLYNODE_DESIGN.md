# OmniPolyNode — design (V204)

Status: built in V204, tested in jsdom and headless Chromium. Name decided with the owner: **OmniPolyNode** (OmniComplexityNode was considered as an alias; the code and UI say PolyNode / ⟐OmniPoly).

## Why
A node whose geometry is several faces, where each face can carry its own context (colour, tags, event, content) instead of one picture for the whole object. The owner's list: a face must be able to hold **an image, a texture, a document or a sound**; faces are **double sided**; clicking a face opens a **tooltip to choose what to do**; **same-shape solids first**, mixed shapes later. The Copilot packet's OmniDynamixMechanix was ignored by decision.

## Layers
| Layer | File | Pure? |
|---|---|---|
| Geometry math | `utils/OmniPolyGeom.js` | yes: regular polyhedra from vertices + face normals, planes, hinged strips (Rodrigues fold), rings; face id `f#`, outward normals, per-face basis for UV |
| Model | `utils/OmniPolyModel.js` | yes: `data.poly` = shape params + one `face` per shape face; sanitize (idempotent, hostile and `__proto__` safe, caps), immutable ops, tags, `facesByTag`, `applyToTag`, `menuOptions`, `contentKey`, `hasContent` |
| Mesh | `utils/OmniPolyNodeMesh.js` | THREE only: one merged non-indexed geometry, **front fan + reversed back fan with mirrored u** per face, vertex colours, triangle → face map, one atlas texture |
| Face drawing | `utils/OmniPolyFaceDraw.js` | 2D context injected: pattern, text, glyph, fitted source, label |
| Runtime | `systems/OmniPolyNodes.js` | create event, level of detail + budget, tap picking, `act()` for the tooltip options, source loading, store/undo |
| UI | `ui/OmniPolyTooltip.js`, `OmniPolyView.js`, `OmniPolyPanel.js`, `OmniPolyInspector.js`, `OmniPolyModules.js` | DOM |

## Decisions
- **One mesh, one material, one texture.** A single material keeps selection highlight and colour working (an array material breaks both). All faces share an atlas (a grid of square cells, one per face), so a 20-face icosahedron is one draw call and one texture upload. Faces with no content use vertex colour only; a node with no content on any face has **no texture at all**.
- **Double sided without z-fight:** FrontSide material, and a second reversed triangle fan for the back with u mirrored so text reads correctly from behind.
- **Cost model = DocNode's.** Atlas drawn only when near + in view + visible + within budget; cell size = next step (64 … 1024) that covers the face's size on screen, capped so the atlas fits the max texture (2048 desktop, 1024 phone); budget 24 M pixels (8 M phone) shared nearest-first; texture re-created only when its size changes; dropped (canvas 1×1, image sources released) when not drawn; a failed source is retried after 10 s.
- **Documents and images** use the DocNode machinery unchanged (`OmniDocRaster`, `OmniDocAssets`): the rendered page is drawn into the face's cell. Guide, PDF, markdown, text, image.
- **Sound**: a face holds either a **sound node** (the face asks it to play with `omni:sound-play-request`) or a **clip of the audio library** (`AudioAssets.playClip` through the SoundEngine context, only after a user tap).
- **Picking:** a tap (≤ 6 px, ≤ 500 ms) on the canvas raycasts only poly meshes; the hit triangle maps to a face; the runtime fires `omni:poly-face-click` with the options that fit what the face holds; the tooltip is DOM and calls `act()`. The node's normal selection still happens as for any node.
- **Type kept without a source:** choosing *image / document / sound* before choosing a file keeps the type (the picker stays) but `hasContent` is false, so nothing is drawn or offered.
- **Shape change keeps face data by position;** removing a face of a strip or ring takes it out of the chain, of a closed solid opens a hole.

## Events
In: `omni:poly-node-create`, `omni:poly-face-set { nodeId, face | tag, patch }`. Out: `omni:poly-face-click`, `omni:poly-face-selected`, `omni:poly-tag-selected`, `omni:poly-face-action { nodeId, face, event, tags }`, `omni:poly-open-panel`, `omni:poly-changed`.

## Not built
Mixed-shape solids (truncated icosahedron etc.), fold animation, face gestures beyond the tap, faces as child nodes, scripting beyond the event string.
