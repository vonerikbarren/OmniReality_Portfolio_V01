# 20. Doc nodes (DocNode)

Applies to: V203 · Status: written from the V203 code (the node, the ⟐OmniDoc window, the Inspector block); tested in jsdom and once in headless Chromium with a generated PDF. **Not tried on a phone or with your own documents yet.**

[Guide index](README.md) · Related: [Nodes and Inspector](03_Nodes_and_Inspector.md), [Audio library](18_Audio_Library.md)

## What a doc node is

A **doc node** is a flat sheet in the space that shows a document: a **PDF**, a **markdown** or **text** file, an **image**, or a **page of this guide**. You read it where it hangs, like a poster, and walk up to it for detail.

It is drawn as an ordinary picture on the sheet (a 2D canvas used as a texture). It does **not** use a web page or iframe floating over the scene (CSS3D) and it does **not** open an extra WebGL context, which is what makes embedded pages heavy on phones. To keep it light:

- A sheet that is **far away, behind you, off screen or hidden** has no picture at all: just a plain sheet.
- A sheet that is near is drawn **only as sharp as it needs to be** for its size on your screen (steps of 128, 256 ... up to 2048 pixels wide; at most 1024 on phones).
- There is a **total budget** for all sheets together. If you have many in view, the farthest ones get less detail first.
- Nothing is redrawn while you stand still. A sheet is redrawn only when its page, its document or its size step changes.

## Make one

1. Ribbon **Home > Create > Doc node** (or the **Doc** tile of the OmniDraw menu, or search **Doc node** in OmniStarLight). A sheet appears about 7 units in front of you, turned to face you with its top edge up (also when you look straight down). It starts on the **Guide index** so there is something to read at once. **⟐OmniDoc** opens.
2. Choose another document in the **Document** list, or press **Import a file…** (or drop a file onto the window).
3. Turn pages with **◀ ▶** or the **Page** box.

## What you can import

| Kind | Notes |
|---|---|
| PDF | Drawn with the real PDF renderer (text, images, shapes). The first PDF needs the internet once to load the PDF reader; after that it is cached by the browser. |
| Markdown (.md) | Headings, lists, tables, code boxes, quotes, links (links are coloured, not clickable yet). Laid out into pages. |
| Text (.txt) | Fixed-width font, long lines wrap, a form feed starts a new page. |
| Image (PNG, JPG, GIF, WebP) | One page, fills the sheet in its own proportions. |
| Guide pages | The pages of this guide, from the Document list. No import needed. |

Not supported: Word / PowerPoint / Excel files (export to PDF first), zip files, empty files, anything over **50 MB**. The library keeps up to **60 documents and 250 MB** in this browser (IndexedDB). In a private window it works but the files vanish when you close it.

## The ⟐OmniDoc window

- **Doc node list, + Doc, Undo, Redo** at the top. It follows the selected doc node.
- **Document, Import a file…** and the list of **your documents** (Rename, ×). Removing a document from the library makes sheets that show it say so.
- **▲ Page up / ▼ Page down** buttons (and the PageUp / PageDown keys) and a **Page** box; the status line says *Opening…* or an error in plain words.
- A **preview** of the current page and the **text of the page**, which you can select, and **Copy text**.
- **Pages**: one page, or two pages like an open book (the sheet is twice as wide and turns two pages at a time). **Zoom %** (100–400; 100 shows the whole page) with − / + / Fit and arrows to move the zoomed view.
- **Width** (1 to 30 units; the sheet keeps the document's proportions), **sides** (both, or front only), **quality** (auto, low = lighter, high = sharper), **paper** colour, **frame** (the coloured edge), **title**.

## The Inspector block

With a doc node selected, **Appearance** has a **⟐ Doc node** block: document and page, **▲ Page up** and **▼ Page down**, **Pages**, **Zoom %**, **Width**, and **Open ⟐OmniDoc**.

## Good to know

- The document and the page are **saved with the node**. The file itself stays in this browser's library, so a scene moved to another browser shows *not in the library any more* until you import the file again.
- Every change is one **Undo** step; dragging the width slider is one step.
- The sheet is a real node: move, rotate, scale, colour (the frame) and StrictAlign work like any other node.
- Turning pages inside the space (click the sheet, a gesture) and scrolling are not built yet; use ⟐OmniDoc or the Inspector.
