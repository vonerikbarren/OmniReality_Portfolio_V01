# buildOrder_OmniStore_V01 — OmniValue / OmniStore / Mall (formerly BuildOrder.md; renamed 2026-10-09)

Status key: DONE · NEXT · QUEUED · LATER. Everything money-related stays SANDBOX until the last item.

## Settings convention (decided 2026-10-09)
- **Admin settings = for the USER.** `OmniStoreSettings` lives in the Admin area (colours, backdrop, layout, sections, import/export of their own store).
- **Dev settings = for the developer and Claude** (testing, handing over information, trying things across the app). `DevOmniStoreSettings` is separate, marked "Dev only", and is where catalogs, store-type definitions, perf knobs and test data are fed in. User-facing settings must never depend on it.
- The same split applies to any later system: `<System>Settings` (user) vs `Dev<System>Settings` (dev).

## Done
- V179 — item 4: swappable store layouts (shelf wall, ring, aisle, island table) from the pure engine `utils/OmniStoreLayouts.js`; selector in OmniStoreSettings, chip in the store HUD, dev preview. See the table and `docs/omniproducts/OMNISTORE_LAYOUTS_DESIGN.md`.
- V178 — item 3: user-facing catalog import + AI template + manual product editing inside OmniStoreSettings (Catalog tab). See the table.
- V177 — items 1 and 2: `DevOmniStoreSettings` (dev, ⟐Developer slot 6) and `OmniStoreSettings` (user, Admin slot 19). See the table for what was and was not built.
- V176 — sandbox ledger (`OmniValueModel`), store model (`OmniStoreModel`, one window/wish/cart list), 3D shelf (cube + double-sided disc; emoji / image / video media), exchange radial (3 levels, buy + sell), wallet, `toHierarchy()` / `toFlows()` hooks.
- V175 — hand tunnels more visible, nodes fainter.

## Decisions recorded 2026-10-09
- Next build = items 1 + 2 (DevOmniStoreSettings + OmniStoreSettings with colours/backdrop).
- OmniStoreSettings = its own Admin slot/panel (like OmniAxinator / DimensionalAxesSettings).
- Catalog import + AI template: user-facing in OmniStoreSettings, with a dev copy (plus raw export) in DevOmniStoreSettings.
- OmniValue radial = standalone panel, designed as a component of OmniTalent (global object).

## Order

| # | Build | Notes |
|---|-------|-------|
| 1 | **DevOmniStoreSettings** — **DONE (V177)** | **Built:** `ui/DevOmniStoreSettingsPanel.js` + `utils/DevOmniStoreData.js`: store-type records (data only, record #1 = produce, `layout` field; only `shelf` exists), catalog JSON export / validate / import (merge | replace, preview, undo of the last import) on the pure schema `utils/OmniStoreCatalogSchema.js`, "Copy AI prompt + schema" (prototype), items per page (6..60, the scene respects it), grant sandbox value, reset ledger / store, live readout (draw calls, textures, videos, fps), Dump state, Notes for Claude. **Not built:** accepted-exchange-form and quality-scale editors, mesh budget knob, non-shelf layouts. Original brief: Dev-only panel. Store-type records (theme, layout, product class, backdrop), catalog paste/import, accepted exchange forms, quality scales, perf knobs (items per page, mesh budget), test-data grant. JSON import/export. Sets the dev-panel pattern. |
| 2 | **OmniStoreSettings (Admin, user)** — **DONE (V177)** | **Built:** `ui/OmniStoreSettingsPanel.js` + `utils/OmniStoreSettings.js`: hover / selected selector, shelf rim / back / plank colours, backdrop dome (none / solid / gradient, opacity), store name in the HUD, 4 built-in presets + user presets, reset, read-only layout row; saved per store id; live in the open store. **Not built:** section editing, layouts (the catalog import / AI template, item 3, was added in V178). Original brief: Colours: hover selector, selected, shelf rim/back/plank, backdrop. Saved per store. Store name, sections. |
| 3 | **Store catalog JSON import + AI template** — **DONE (V178)** | **Built:** a Catalog tab in `ui/OmniStoreSettingsPanel.js` (`ui/OmniStoreCatalogUI.js`): guided 4 steps (Describe your store -> Copy AI prompt / blank template / download template; Paste the AI's answer with tolerant `extractJson`; Check with a preview table, plain-language messages and a Copy fix-it prompt; Import merge (same id or name) | replace with confirm, Undo last import persisted in localStorage `omni:store-undo-v1`); manual add / edit / duplicate / delete / delete all, search, 20 per page, Export catalog; model `addProduct` / `updateProduct` / `removeProduct` / `duplicateProduct` through the schema's validator; free-text `category`. The dev panel keeps its own import / export / prompt. **Not built:** CSV / spreadsheet import, image upload or hosting, several stores, layouts, store-type templates, section editing, calling an AI from inside the app (none, by design: the AI step is outside the app), a multi-step undo history. Original brief: See "Catalog import" below. Manual add/edit stays available. Bulk first, manual second. |
| 4 | **Swappable layouts** — **DONE (V179)** | **Built:** `utils/OmniStoreLayouts.js` (pure: `build(id, ctx)` -> placements + furniture + camera pose / stops + bounds; ids `shelf`, `ring`, `aisle`, `island`, unknown -> shelf) and `systems/OmniStoreScene.js` applying it in place (pooled slot and furniture meshes, shared geometries / materials, no growth over repeated switches; hover / select rings face the slot normal; furniture occludes picking). **shelf** = the V178 arrangement exactly (96 scene snapshots identical). **ring**: products on a circle facing the centre, chord spacing 1.5 whatever the count (radius grows), tiers of 30 (phone 12), floor + shelf band, outside overview with an Enter / Exit toggle to stand at the centre. **aisle**: two facing runs + floor strip + end wall, bays of up to 6 (phone 4), the camera starts at the entrance and glides stop by stop (HUD ◀ ▶, 0.9 s, cancelled by the user's orbit; arrow keys deliberately unbound: the movement pad owns them). **island**: tiered display table, products tilted up, 3/4 orbit view. Layout is a per-store setting (`layout` in `omni:store-settings-v1`, default shelf, old data migrates), independent of colour presets; user selector (4 cards) in OmniStoreSettings, a cycling chip in the HUD, `omni:store-layout-set`; dev panel: record `layout` select, "Preview layout" (temporary), per-layout readout, layout stats in Dump state. Items per page (6..60) stays the hard cap; mesh and bounds budgets are in the design doc. **Not built:** walk-through first-person movement, collision, several rooms, floor signage, per-section layouts, store types driving layouts (item 6), a layout editor, custom furniture models / glTF, lighting, shadows; verified on software GL only (no real GPU / phone / touch). Original brief: Shelf wall (exists), ring/carousel, aisle/corridor (reuse tunnel stepping), island table. Layout = a function from product list to positions. |
| 5 | **OmniValue radial + D3 views** | **Standalone panel** (decided), framed as a component of the global object **OmniTalent** (Greek talent logic: value entrusted to be grown, per BACKEND_COMPONENTS_ONTOLOGY.md). Panel title/structure leaves room for other OmniTalent components later. Outside the store: the user's distributed value across types and tiers. Radial chart (sunburst) default; treemap and sankey as view switches over the same hierarchy. Also feeds exchange levels 1–2 (`#exchange-chart-slot`). Includes the arbitrage-loop guard. |
| 6 | **Store types as data + second store** | A bakery / electronics / etc. record proves the model. |
| 7 | **StoreItemNode + OmniValueNode as OmniNode types** | Placeable and inspectable by users. Decide registry approach (store-owned meshes vs OmniNode). Conversion stays an edge. |
| 8 | **OmniAxis as OmniDraw mode** | Ninth mode; user-made axes reuse OmniAxinator. Needs separate storage and the visibility-rule decision. |
| 9 | **Product lifecycle tunnel scene** | Reads `product.lifecycle`; reviews/adoption on the perpendicular axis. |
| 10 | **Mall hub** | Doors = tunnel nodes into stores; one store active, others unloaded. Early practice for the public-building portfolio. Needs a perf budget measured on the user's real device first. |
| 11 | **Enforcement / Security / Governance, real payments** | Must be correct before anything real depends on it. Not before everything above is proven in sandbox. |

## OmniValue radial (item 5) — scope
- Centre: the user (or the selected account/entity); ring segments: value types grouped by tier (Primary → Quinary); arc = quantity, tick/colour = quality; per-type remainders shown separately, never merged.
- Same data source as the exchange: `OmniValueModel` balances + ledger; no second model.
- Drill-down like the exchange radial; D3 views are switchable transformations of one hierarchy.

## Catalog import (item 3) — design
- **One schema** (versioned `schema: "omni-store-catalog/1"`): store {name, type, theme}, sections, products [{name, emoji, category, sectionIds, shape, media{emoji, image(url), video(url), active}, price[{type, qty, quality}], stock, lifecycle[], note}].
- **Template button** gives the user: (a) the schema with a filled example, (b) a **copyable AI prompt** ("Here is my business … produce JSON that exactly matches this schema, use emoji for `media.emoji`, only value types from this list: …") so they can paste it into any AI assistant and paste the result back.
- **Import flow:** paste or upload → validate → show a preview table with per-row errors and warnings → "Import N products" (merge or replace). Nothing is applied until confirmed.
- **Safety:** imported JSON is untrusted. Strings only, length and count caps, numbers clamped, value types/quality grades must exist (unknown ones flagged, not invented), image/video URLs http(s) only, no HTML, never evaluated.
- **Export** the same schema from an existing store (round trip, and a way to hand a catalog to Claude via DevOmniStoreSettings).
- Manual add/edit/delete remains available for users who want it.

## Open / carried
- Quality assessment is self-reported (open question).
- Real money, identity, two-account trades, entities: not built.
- Perf: only software-GL tested; measure on a real GPU / phone before the mall (V179: the four layouts are 100-200 meshes at 60 products; the real-GPU cost is still unmeasured).
- Layouts (V179): item 6 should write a store type's `layout` into the store's settings when it creates a store; the mall hub (item 10) keeps one anchor and one layout id per store (see `OMNISTORE_LAYOUTS_DESIGN.md`).
