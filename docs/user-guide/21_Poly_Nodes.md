# 21. Poly nodes (PolyNode)

Applies to: V204 · Status: written from the V204 code (the node, the ⟐OmniPoly window, the face menu, the Inspector block); tested in jsdom and once in headless Chromium. **Not tried on a phone yet, and no sound has been listened to.**

[Guide index](README.md) · Related: [Nodes and Inspector](03_Nodes_and_Inspector.md), [Doc nodes](20_Doc_Nodes.md), [Sound nodes](12_Sound_Nodes.md), [Audio library](18_Audio_Library.md)

## What a poly node is

A **poly node** is one object made of several flat **faces**, and **every face is its own little world**: its own colour, label, tags, click event and content. A face can hold a **pattern**, **text**, an **image**, a **document** (a guide page, PDF, markdown or text file, with a page) or a **sound**. Every face shows on **both sides** (the back of a face reads correctly, not mirrored).

Shapes (all faces of one shape are the same regular polygon; mixed solids come later):

| Shape | Faces | Notes |
|---|---|---|
| Cube | 6 squares | |
| Tetrahedron | 4 triangles | |
| Octahedron | 8 triangles | |
| Dodecahedron | 12 pentagons | |
| Icosahedron | 20 triangles | |
| Plane | 1 | a single face |
| Strip | 1 to 24 | regular polygons (3 to 12 sides) hinged edge to edge, folded by an angle (0 = flat, a page-turn strip) |
| Ring | 3 to 24 squares | folded so the last meets the first: a tube / drum |

It is drawn as **one merged object with one picture sheet** (an atlas, a 2D canvas used as a texture). There is no web page over the scene (no CSS3D) and no extra WebGL context. A node that is **far away, off screen or hidden has no picture at all** (just coloured faces); a near one is drawn **only as sharp as its faces need to be**; all poly nodes share a **budget**; nothing is redrawn while you stand still.

## Make one

1. Ribbon **Home > Create > Poly node** (or the **Poly** tile of the OmniDraw menu, or search **Poly node** in OmniStarLight). A cube appears about 7 units in front of you with patterns and labels on its first six faces so there is something to see and tap. **⟐OmniPoly** opens.
2. **Tap a face** in the space (a tap, not a drag). A small **menu** opens where you tapped:
   - **Select this face** (it becomes the face you edit in ⟐OmniPoly)
   - **Open face settings**
   - **Play the sound** (only when the face holds a sound)
   - **Previous page / Next page** (only on a document face)
   - **Fire "name"** (only when the face has an event)
   - **Select all tagged …** (only when the face has tags)
   - **Remove this face (open a hole)**
3. Escape, a tap elsewhere, or choosing an option closes the menu. Arrow keys move through it, Enter chooses.

## The ⟐OmniPoly window

- **Poly node list, + Poly, Undo, Redo.** It follows the selected poly node.
- **Shape**, **edge** length, and for strips and rings **sides**, **faces** and **fold°**. Changing the shape keeps the data of face 1, 2, 3 … by position.
- **Faces**: one numbered button per face (struck through = removed). For the chosen face: **label**, **colour** (a tint of the node colour; *Node colour* clears it), **tags** (comma separated), **event** (a name), **Remove / Restore this face**, **Colour all tagged …**, and **Content**: nothing, pattern (checker, stripes, dots, grid, gradient, two colours), text, image, document, sound.
- **Image / document**: choose from your library or **Import…** (the same library as Doc nodes: PDF, markdown, text, PNG / JPG / GIF / WebP, 50 MB each). A document face has **◀ page ▶**.
- **Sound**: choose a **sound node** in the scene, or a **clip of the audio library**; **▶ Play** tries it.
- **+ Face / restore** brings back the first removed face, or adds a face to a strip or ring.

## Tags and events (for logic)

- **Tags** group faces ("front", "menu", "level2"). **Colour all tagged …** and the menu's **Select all tagged …** work on a tag. Other code can call `facesByTag` / `applyToTag`, or send the event `omni:poly-face-set { nodeId, face | tag, patch }`.
- A face with an **event** sends `omni:poly-face-action { nodeId, face, event, tags }` when you choose *Fire* (and when its sound plays). Anything in the space can listen for it.

## The Inspector block

With a poly node selected, **Appearance** has a **⟐ Poly node** block: a state line, **Shape**, **Edge**, and **Open ⟐OmniPoly**.

## Good to know

- The shape and every face are **saved with the node**. Files stay in this browser's library, so a scene moved to another browser shows *Could not load* on those faces until you import the files again.
- Every change is one **Undo** step; the colour and label fields merge quick repeated edits into one.
- A poly node is a real node: move, rotate, scale, colour and StrictAlign work like any other node.
- A hole in a closed solid is just a missing face (you can see inside). Removing a face of a strip or ring takes it out of the chain.
- Not built yet: solids mixing different shapes (e.g. a soccer ball), faces that fold open and closed as an animation, gestures on a face other than the tap, hierarchy of faces as child nodes.
