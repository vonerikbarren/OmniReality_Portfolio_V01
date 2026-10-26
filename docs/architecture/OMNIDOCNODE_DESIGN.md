# DocNode design (V203)

A node that shows a document (PDF, markdown, text, image, a page of the in-app guide) as a flat sheet in the space.

## 1. The decision: a canvas texture, not CSS3D

The owner had used a CSS3D iframe component in an earlier app: it worked, but it cost a lot of GPU, especially on phones, and asked: do not use CSS3D unless we must.

| Approach | Verdict |
|---|---|
| CSS3D iframe / DOM element in the 3D scene | Each element is a composited layer the browser re-rasterises when the camera moves; many of them on a phone is what ate the GPU. Cannot be sharp and cheap at once. Not used. |
| A second WebGL renderer per document | The page already holds 5 WebGL contexts (browsers allow about 8-16). Not used. |
| **2D canvas drawn once, uploaded as a `CanvasTexture` on a plane (chosen)** | Costs nothing while nothing changes; the GPU only samples one texture. We choose how many pixels it has and when it is drawn. |

PDF pages come from pdf.js (`pdfjs-dist@4.10.38`, loaded on first use from jsdelivr as an ES module, worker started from a Blob URL). Text documents are laid out by our own pure layout engine and painted on the same kind of canvas.

## 2. Parts

| File | Role |
|---|---|
| `utils/OmniDocModel.js` | Pure model `data.doc` { source {type,id}, page, pages, aspect, width, sides, paper, frame, quality }; immutable ops; **`rasterWidthFor`** (pixels the page needs for the distance / screen / quality / max texture, power-of-two steps 128..4096, hysteresis) and **`planBudget`** (shares a pixel budget; farthest sheets shrink first, then drop out). |
| `utils/OmniDocLayout.js` | Pure markdown blocks / text -> pages of draw ops at a fixed logical size (800 wide, aspect 1.414); `measure` injected (canvas in the browser, a fake in tests); `drawOps` paints a page at any width. Caps: 400 pages, 400k characters. |
| `utils/OmniDocAssets.js` | The library: IndexedDB `omni-doc-assets-v1`, memory fallback, 50 MB per file, 250 MB, 60 documents, the BYTES decide the type (`sniffDoc`). |
| `systems/OmniDocRaster.js` | open(source) / render(page, width, canvas) / text(page) for guide, markdown, text, image, pdf; ONE render queue; stale jobs skipped or cancelled; LRU of 12 open documents. |
| `utils/OmniDocNodeMesh.js` | The geometry: a thin root box (selection, colour, move) with two raycast-off planes on its faces showing the page on an unlit `MeshBasicMaterial`. Texture re-created only when its size changes; dropped (and the canvas shrunk to 1x1) when the sheet is not drawn. |
| `systems/OmniDocNodes.js` | The runtime: create event, store (undo / redo / strokes / persistence like the mix), page turns, and the **level-of-detail pass** (below). |
| `ui/OmniDocView.js`, `OmniDocPanel.js`, `OmniDocModules.js`, `OmniDocInspector.js` | ⟐OmniDoc window (+ quadrant content `doc`), Inspector block. |

## 3. The GPU cost model (the point of the design)

Every 0.25 s the runtime looks at each doc mesh (not every frame):
1. hidden, or off screen (camera frustum vs the sheet's bounding sphere), or beyond 300 units, or no document -> wants **0**.
2. otherwise `rasterWidthFor` from the distance to the near part of the sheet, its world width, the camera fov, the viewport height, the device pixel ratio (max 2) and the quality setting; capped at 2048 (desktop) / 1024 (phone or coarse pointer); shrinking waits until the need is under 35 % of the current size.
3. `planBudget` over all sheets: 24 million texture pixels on desktop, 8 million on phones.
4. A sheet is redrawn only if (document, page, size step) differs from what it shows. A render that is still running when the sheet goes far is told it is stale. A document or page that fails is not retried for 10 s.

At rest this is one cheap loop and no GPU work. A texture is uploaded once per redraw, never per frame.

## 4. Verified

jsdom: model, layout, library (fake IndexedDB), runtime, view, Inspector (tests `v203_*`). Real headless Chromium with a generated 3-page PDF: pdf.js loaded, the page drawn in the 3D scene with crisp text and shapes, texture dropped when the sheet left the view, no new WebGL context from the doc code (the older Inspector preview adds some). **Not verified:** a real phone GPU, large or scanned PDFs, many sheets at once on a device.

## 5. Not built (candidates)

- Page turning and scrolling inside the space (click halves of the sheet, wheel, hand gesture); a continuous scroll mode for long documents.
- Selecting text and following links on the sheet itself (the DOM text view in the window covers copying for now).
- .docx / .pptx (needs conversion; export to PDF first).
- A shared library with the Project / Store; thumbnails of pages in the window.
- Cached page bitmaps (an LRU of already drawn pages) so turning back is instant.
