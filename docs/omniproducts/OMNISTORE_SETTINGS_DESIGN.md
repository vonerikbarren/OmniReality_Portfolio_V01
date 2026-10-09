# OmniStore settings: user vs dev (V177; user catalog import + manual editing V178, sandbox store)

## The convention (decided 2026-10-09)

- **`<System>Settings` is for the USER.** It lives in the Admin area (drawer ⟐Admin), is written in the user's words, and works on its own.
- **`Dev<System>Settings` is for the DEVELOPER and Claude.** Testing, handing over information, trying things across the app. It is clearly marked "DEV ONLY", lives in the ⟐Developer drawer group, and is where raw data, test knobs and notes go.
- **A user-facing setting never depends on the dev panel.** The user panel and its data module import nothing from the dev side (checked by a test that loads the user panel with the dev modules blocked). The dev side may read and change the same data the user side owns.
- Later systems follow the same split: `OmniStoreSettings` / `DevOmniStoreSettings` is the first pair; the next pair would be e.g. `OmniValueSettings` / `DevOmniValueSettings`.
- File naming: `utils/<System>Settings.js` (data, no DOM) + `ui/<System>SettingsPanel.js`; dev twin `utils/Dev<System>Data.js` + `ui/Dev<System>SettingsPanel.js`. Both panels extend `ui/OmniSettingsPanelBase.js` (a neutral shell: single-init guard, WindowManager, drag, phone bottom sheet, `data-store-panel` framing hook).

## What each panel owns

| | `OmniStoreSettings` (user) | `DevOmniStoreSettings` (dev) |
|---|---|---|
| Opens from | drawer ⟐Admin slot 19, ribbon Realities > Value > "Store Settings", `omni:nav-select ⟐OmniStoreSettings` | drawer ⟐Developer slot 6, ribbon Realities > Value > "Dev Store" (DEV in the tooltip), `omni:nav-select ⟐DevOmniStoreSettings` |
| Module | `ui/OmniStoreSettingsPanel.js` (WindowManager id `omnistoresettings`) + `ui/OmniStoreCatalogUI.js` (the Catalog tab) | `ui/DevOmniStoreSettingsPanel.js` (id `devomnistoresettings`) |
| Data | `utils/OmniStoreSettings.js`, `omni:store-settings-v1` | `utils/DevOmniStoreData.js`, `omni:dev-store-v1` |
| Owns | **Look tab:** store name, colours (hover and selected selector, shelf rim / back / planks), backdrop (none / solid / gradient, opacity), presets (4 built-in + own), reset, read-only layout row. **Catalog tab (V178):** the guided AI-assisted import and manual product editing (below) | store type records, catalog JSON export / validate / import / undo, "Copy AI prompt + schema", items per page, grant / reset sandbox value, live readout, Dump state, Notes for Claude |
| Does not own | catalog data, test knobs, raw JSON | anything the user needs in order to use the store |

Why the Dev panel sits in the existing ⟐Developer drawer group (slot 6, after `Dev_FPS_Exp_ListOfEmotions` and `TestCallStack`): that group already holds the dev tools, so no new menu was needed. The ribbon button carries "[DEV]" in its name and "DEV ONLY." at the start of its description.

## Storage keys

| Key | Content |
|---|---|
| `omni:store-settings-v1` | `{version:1, stores:{<storeId>:{name, colors, backdrop}}, presets:[user presets]}`. Sanitised field by field on load, corrupt data falls back to defaults. User presets are shared by every store (max 20). Store id = the store's owner id (one store per identity today; the key is a plain string so several stores can follow). |
| `omni:dev-store-v1` | `{version:1, records, notes, perf:{itemsPerPage}}`. |
| `omni:store-v1` | the store itself (unchanged key). V177 changes: products cap 200 -> 500, product name cap 60 -> 80, optional `note` field per product. V178: `category` is free text (<= 24); a store emptied on purpose (an empty product list) stays empty after a reload instead of being re-seeded. |
| `omni:store-undo-v1` | V178: the ONE-step undo of the last catalog import: `{v:1, t, label, snap:{ownerId, name, products, listItems}}`, capped at 1,000,000 characters (see "Undo persistence"). |

## Events

| Event | Direction | Detail |
|---|---|---|
| `omni:store-settings-changed` | out | `{storeId, key, keys}`; `key` is the single changed path (`colors.hover`, `backdrop.mode`, `name`, `presets`) or `all` |
| `omni:store-settings-set` | in | `{patch, storeId?}` partial patch; needs `attach()` (the scene and the user panel both attach, ref-counted) |
| `omni:dev-store-changed` | out | `{key}`: `records`, `notes` or `perf` |
| `omni:store-stats-get` | request / reply | the dev panel dispatches it with `detail:{}`; the scene fills `detail.out` (open, per page, shown, meshes, textures cached, active videos, draw calls, triangles, GPU geometries / textures, fps, backdrop) |
| `omni:store-panel-changed` | out | `{id, open}` from either panel; the scene re-frames the shelf into the part of the screen the open panel leaves free (the panel carries `data-store-panel`) |

## Look settings

- Colours are `#rrggbb` (`#rgb` accepted and expanded); anything else is ignored and the old value stays. Defaults are the V176 hard-coded colours: hover `#ffb02e`, selected `#2e9bff`, rim `#5b4a36`, back `#d8cdb9`, plank `#a57d52`.
- `colors.backdrop` is an optional override of `backdrop.color` (null = use `backdrop.color`). The panel edits `backdrop.color`; the override is reserved for store-type themes.
- Presets: Market Wood (the V176 look), Fresh Green, Night Market, Clean White. A preset sets colours and backdrop, not the name. "Reset to default" resets the look to Market Wood and keeps the name.
- The scene applies a change without rebuilding the shelf: it only sets the five shared material colours, the HUD accent variables and the backdrop. Hover and selected colours drive both shelf selector rings and the HUD chip accents. The SANDBOX badge colour is fixed in CSS and is not a setting.
- Backdrop: ONE inward-facing sphere (radius 120) centred on the shelf anchor, a child of the shelf group (so it follows the anchor and is hidden whenever the store is). Chosen over a back panel because orbiting never shows an edge and it is one unlit draw call (`MeshBasicMaterial`, `BackSide`, `depthWrite:false`, `renderOrder -1000`, vertex colours for the gradient). The camera far plane is 1e5 with a logarithmic depth buffer, so radius 120 is far inside it. It is disposed when the store closes or the mode is none, and hidden while the camera is further than 0.92 x radius from the anchor, so it cannot become a coloured ball over the app wallpaper.

## Catalog schema `omni-store-catalog/1`

Implemented in `utils/OmniStoreCatalogSchema.js` (pure: no DOM, no storage, no imports).

```
{ "schema": "omni-store-catalog/1",
  "store":   { "name": text<=40, "type": text<=40 },
  "sections": [ {id, name, kind} ]          // informational; sections are NOT imported
  "products": [ {
     "id": "p-apple"            // optional; generated from the name when missing
     "name": text<=80, "emoji": text<=16, "category": text<=24 (free; V178: "fruit"/"vegetable" are only the two the app knows by name; missing -> "other"),
     "sectionIds": ["dim-physical"],        // existing identity sections only
     "shape": "cube"|"disc",
     "media": { "emoji", "image": url|null, "video": url|null, "active": "emoji"|"image"|"video" },
     "price": [ { "type": <value type id>, "qty": number>0, "quality": <grade id of that type> } ],   // 1..8 forms
     "stock": whole number>=0,
     "lifecycle": [ {stage<=16, title<=60, note<=300, t} ],                                          // 0..12
     "note": text<=300 } ] }                // <= 500 products
```

Export writes this shape from the current store; export -> validate -> replace import -> export gives an identical catalog (tested). Not carried: reviews, stats and the sell-side `accept` forms (a merge keeps the existing ones).

## Import safety rules

The input is untrusted (an AI reply, a file, a stranger). It is parsed with `JSON.parse` only, never evaluated, and the output is rebuilt field by field from checked values (unknown keys, `__proto__` and `constructor` go nowhere).

- Raw text <= 4 MB, <= 500 products, <= 8 price forms, <= 12 lifecycle entries.
- Text fields are strings only, no `<` or `>` (no HTML), control characters stripped; over the length cap is an ERROR, not a silent cut.
- Numbers must be JSON numbers (the string "3" is an error); `qty` > 0 and clamped to 1e6, `stock` rounded, >= 0.
- Value types and quality grades must exist in `OmniValueModel` right now. Unknown ones are ERRORS and are never invented, never mapped to something similar.
- Image: `http(s)` URL or `data:image/(png|jpeg|gif|webp);base64` <= 512 KB each and <= 1.5 MB per catalog. Video: `http(s)` URL only. `javascript:`, `file:`, `ftp:`, protocol-relative, relative paths, `data:` videos and SVG data images are errors.
- A row with errors is rejected; the other rows stay importable. Repairs (missing emoji / shape / category / stock, unknown section dropped, qty clamped) are WARNINGS shown in the preview. A generated id (no id in the input) is a harmless `note`, not a warning (V178).
- Nothing is applied before the preview: Validate shows counts (ok / warnings / rejected) and what merge and replace would add, update and remove; Import is only enabled for the exact text that was validated; Replace needs a second click; one snapshot is kept for "Undo last import" (dev panel: memory only; user panel V178: memory AND localStorage, see below).
- The store model re-sanitises every imported product (`importProducts` -> `sanitizeProduct`), so a caller that skipped the validator still cannot store an invalid product.

## User catalog import (V178, BuildOrder item 3): the Catalog tab of OmniStoreSettings

Goal: make it as easy as possible to set up a store at scale without typing every product, while keeping the manual way. The AI step is deliberately OUTSIDE the app: the app hands the user a prompt, the user pastes it into whatever AI assistant they like, and pastes the answer back. Nothing is called over the network.

Panel: tabs **Look** | **Catalog** (the Catalog UI is built the first time the tab is opened; wide panel 460 px, 56 vh bottom sheet on phones while the tab is open (the shelf stays visible above it; "Show in store" minimises the sheet on a phone)). Steps are an accordion (one open at a time), each header shows a number, a green check when done, or a red "!" when it needs attention.

1. **Describe your store.** A textarea ("What do you sell? e.g. a bakery with breads, pastries and drinks; prices in credits and flowers"), optional chips for how many products (10 / 25 / 50 / 100), a category hint (<= 24 chars) and "accepted payment forms" checkboxes (one per payable value type in `OmniValueModel`: credits, usd, bells, nook, gold, flowers, hours, access; none ticked = any). Buttons: **Copy AI prompt**, **Copy blank template** (the JSON: schema + one filled example product, built from the ticked types), **Download template .json**. "Show the prompt" opens a read-only view with the length, and is the fallback when the clipboard is blocked.
2. **Paste the AI's answer.** A big textarea or **Load .json file…**. The text is read by `extractJson` (below) and checked automatically 250 ms after the last keystroke / on paste.
3. **Check.** A preview table (status mark, emoji + name + category + shape, accepted forms with quality grades, stock) with a counts line ("12 products: 9 ready, 1 with notes, 2 with problems (skipped)"), global warnings, and the messages of each row in everyday words (`plainMessage`: `price[1]:` reads "Payment option 2:", `unknown value type` reads "unknown payment type", `qty` reads "amount"). Nothing is applied. When anything is wrong, **Copy fix-it prompt** builds the follow-up prompt for the AI (below).
4. **Import.** Radio **Merge** (add new products, update products with the same id OR the same name, case-insensitive, nothing removed) or **Replace** (the catalog becomes exactly the list; an inline confirm box shows "removes N, adds M (updates U)" and needs a second click). Button "Import N products" (rows with problems are skipped and counted). Success summary, "Show in store", and **Undo last import**.

### The prompt (`buildAiPrompt` in `utils/OmniStoreCatalogSchema.js`)

Pure, assistant-neutral (no product names), about 3.3 k characters for the 8 payable types, bounded for larger lists (more than 12 value types are grouped by identical quality scale; the user's description is cut at 2000 characters; count <= 500). Contents in order: instructions and rules (reply with ONLY the JSON object; no fence, no comments, no trailing commas, straight quotes; the schema version string; the product fields and their caps; "several price forms mean any ONE of them"; no HTML; image / video only if real https URLs are given; ONE fitting emoji repeated in `media.emoji`; do not invent value types or qualities) -> VALUE TYPES AVAILABLE with each type's quality grades (read from the live ledger) -> SECTIONS AVAILABLE (identity sections only) -> a filled EXAMPLE product that is itself valid under the validator (a test validates the example inside the prompt) -> "WHAT I NEED" (about N products, category hint, "customers can pay with: ..." from the ticked boxes) -> "MY BUSINESS:" + the user's description. Backward compatible: `buildAiPrompt({types, sections})` (the V177 dev button) still works and ends with a placeholder where the business goes; `blank:true` drops the business part.

### `extractJson(text)` tolerances

Accepts: bare JSON; JSON inside a markdown fence (with or without a language tag) with chatty prose around it; JSON with prose before / after and no fence; a BOM (removed, noted); a bare products array (wrapped as `{schema, products}`, noted); one product object (wrapped as a catalog of one, noted); several JSON blocks (the one that holds `products` wins). The scan is string-aware, so braces and escaped quotes inside strings are fine. It NEVER repairs: curly quotes (U+201C/201D/2018/2019), trailing commas, comments and cut-off text are each reported with a plain message (trailing comma and comment give the line number; a missing closing brace says the reply looks truncated). No JSON at all, plain numbers / strings, and text over 4 MB are errors. The result carries notes ("Took the JSON from inside a code block...") that the Check step shows.

### The fix-it loop (`buildFixPrompt`)

For a validation failure it lists every error (global ones, then "Product 3 ("Bagel"): Payment option 1: unknown payment type "pesos"..." per rejected row, at most 12 rows then "... and N more"), the offending products as the AI wrote them (JSON, each cut at 600 characters), the allowed value types / qualities, and asks for "the FULL corrected JSON (every product, not only the ones you fix)", ONLY the JSON. For text that is not JSON at all it gives the problem and ~500 characters around it. The user copies it, pastes it back to the same AI, pastes the new answer in step 2.

### Undo persistence

`OmniStoreModel.rememberUndo(snapshot, label)` keeps the snapshot (taken before the import) in memory and in localStorage `omni:store-undo-v1`; `getUndo()` / `undoLast()` read memory first, then the stored copy, so Undo works after a reload. Bounds: the stored JSON is capped at 1,000,000 characters; if it is over, embedded image data URLs are dropped from the stored copy first (flagged); if it is still over, or the browser refuses (quota), the stored copy is REMOVED (never left stale, so a reload can never undo to an older import) and the undo is memory-only (the panel says "this session only"). The snapshot is re-sanitised when restored. One step only: a new import replaces it; undo discards manual edits made after the import (the panel says so).

### Manual editing

Model (`utils/OmniStoreModel.js`): `addProduct(p)`, `updateProduct(id, patch)`, `removeProduct(id)`, `removeAllProducts()`, `duplicateProduct(id)`; each validates through `Schema.validateProduct` (the SAME rules and caps as an import row: one source of truth), then `sanitizeProduct`; they emit `omni:store-changed` (`product-add` / `-update` / `-remove` / `-remove-all`), so the open shelf updates. `removeProduct` also drops the product's window / wish / cart items; `updateProduct` keeps id, reviews, stats and the sell-side `accept` forms, and leaves old media untouched unless the patch touches media (an old relative image path survives an unrelated edit); `duplicateProduct` puts "<name> (copy)" right after the original with a fresh id and no reviews / stats / history. A product's media follows `setActiveMedia`'s rule: the active kind must be one the product carries, else emoji.

UI ("Your products" list under the steps): search (name / category / id), 20 rows per page, per row Edit / Copy (duplicate) / Del (inline confirm), **+ Add product**, **Export catalog** (download + clipboard, the same schema, re-imports without errors), **Delete all products** (inline confirm with the count; the store then stays empty across reloads). The edit form: name, emoji (text + 24 fruit / veg / food quick-picks), category (free text with suggestions), section checkboxes (identity sections), shape cube / disc, image link, video link, the "shown on the shelf" selector (a kind is selectable only once its link exists), accepted exchange forms (rows of value type + amount + quality grade of that type, add / remove, max 8), stock, note. The form validates live with the same validator and shows errors (red) and repairs (amber); Save is disabled while there is an error.

### Privacy

The description the user types, the pasted AI answer and the catalog stay on the device (localStorage keys above); the app makes no network request for any of this and does not call an AI. The only thing that leaves is what the user copies or downloads themselves and chooses to paste elsewhere. Image / video links in a catalog are fetched by the browser only when the shelf shows that product.

## Dev panel catalog (unchanged from V177)

`DevOmniStoreSettings` keeps its own copy: export / validate / import (merge or replace, preview, in-memory undo) and "Copy AI prompt + schema" (now the same `buildAiPrompt`, default arguments). It has no dependency on the user Catalog tab and the user tab has none on it.

## Not built (carried)

- Layouts other than the shelf wall. The store-type record has a `layout` field (`shelf`, `ring`, `aisle`, `island`) as DATA only; only `shelf` exists (BuildOrder item 4).
- Item 3 is built (V178). Still NOT built there: CSV / spreadsheet import, image upload or hosting (links and small data URLs only), several stores per identity, layouts, store-type templates (a "bakery" starter), editing the section list, and calling an AI from inside the app (none, by design).
- Store types driving anything: a record's theme ids are not applied to a store yet (item 6).
- Several stores per identity (the settings are keyed per store id; the model still has one store per identity).
- **Item 5, OmniValue radial + D3 views** (not built here, recorded): a standalone panel framed as a component of the global object **OmniTalent** (Greek *talent*: value entrusted to be grown; `BACKEND_COMPONENTS_ONTOLOGY.md`), with radial / treemap / sankey views over `toHierarchy()` and `toFlows()`, the user's distributed value across types and tiers, feeding `#exchange-chart-slot`, plus the arbitrage-loop guard.
