# OmniStore: store types as data and several stores (V182, BuildOrder item 6)

Applies to: V182 · Status: verified against code and tests on 2026-10-09 · Real GPU / phone / touch: not verified.

SANDBOX: all value stays fake. Nothing here moves real money.

## What this adds

1. A **store type** is a data record (`utils/OmniStoreTypes.js`, pure, user-safe). Four are built in: `produce`, `bakery`, `electronics`, `blank`.
2. An identity can own **several stores** (`utils/OmniStoreModel.js`). One is **active**. The wallet is global.
3. The 3D scene shows only the active store and **switches in place** (same pooled meshes).
4. User UI: a **Stores** tab in OmniStoreSettings and a **store chip** in the store HUD. Dev UI: a type editor and a store list in DevOmniStoreSettings.

## The type record (`omni-store-type/1`)

| Field | Meaning |
|---|---|
| `schema`, `id`, `label`, `emoji`, `desc` | identity of the type (id `[A-Za-z0-9_.:-]{1,40}`) |
| `layout` | `shelf` / `ring` / `aisle` / `island`; unknown becomes `shelf` with a warning |
| `theme` | `{preset, colors?}` OmniStoreSettings preset id and optional colour overrides (#rgb or #rrggbb) |
| `backdrop` | `{preset?, mode?, color?, color2?, opacity?}` or null |
| `baseSections` | `wellness` (Physical, Life, Social, Emotional first) or `none` (only the type's own sections) |
| `sections` | the type's own sections (up to 16); the 3 media lenses always follow |
| `categories`, `accepts`, `lens`, `productClass`, `shape` | hints for the AI prompt and the product form |
| `seed` | `{products:[...], story?}`: the starting catalog (up to 200 products, validated by the SAME rules as a catalog import) |

`validateType(input, {valueTypes})` returns `{ok, type, errors, warnings, seed}`. The result is built field by field from checked values only. Untrusted input rules: JSON.parse only, never evaluated; strings only; `<` and `>` rejected; control characters removed; unknown keys ignored with a warning; raw size cap 400,000 characters; counts capped.

Lifecycle (6 stages), 2 reviews and stats are generated from `seed.story` with the tokens `{Name}`, `{name}`, `{pay}`.

## Built-in types

| id | Look | Layout | Sections | Seed |
|---|---|---|---|---|
| `produce` | market wood | shelf | the 4 identity sections | 16 products, ids `p-*`. Identical to the V181 default store (a test compares them byte for byte). |
| `bakery` | warm, gradient backdrop | island | Breads, Pastries and cakes, Drinks (`bk-*`), no wellness sections | 20 products, ids `bakery-*` |
| `electronics` | cool | aisle | 4 own sections (`el-*`) | 21 products, ids `electronics-*` |
| `blank` | market wood | shelf | the 4 identity sections | empty |

Built-ins are frozen. The user picker lists built-ins only. The dev side registers extra types with `registerType` (kept in `omni:dev-store-v1`, max 12, each up to 200,000 characters); `listTypes({includeExtra:true})` shows them.

## Stores in the model

- State: `{stores, section, active:{ownerId: storeId}}`. Each store: `id, ownerId, name, typeId, emoji, baseSections, sections, extraSections, products, listItems`.
- **Store ids.** The identity's FIRST store keeps the identity id as its id (so V176-V181 data, store settings and section maps still match). Later stores get `st-<base36 time><n>`.
- API: `createStore({typeId | type, name, anchor?, activate?})`, `renameStore`, `deleteStore`, `setActiveStore`, `listStores({ownerId, sizes})`, `activeStoreId`, `getStore(id?)` (no argument = active), `applyTypeLook`, `findProductAnywhere`, `storageStats`.
- Everything is keyed by store id: products, sections, the window / wish / cart lists, the store's look and layout and anchor (`omni:store-settings-v1` was already per store id).
- **Cart per store.** The shopping list belongs to its store. The exchange and the list view follow the active store. The **wallet is global** (V176 ledger), so inventory shows items from any of your stores.
- **Undo** (`omni:store-undo-v1`) remembers the store it was taken in (`storeId`). Undo is refused while another store is active; the Catalog tab says which. Deleting a store clears its undo. Old snapshots without `storeId` act on the active store as before.
- Catalog import, export, replace, reset, manual editing and the AI prompt all act on the **active** store.
- **Active store.** Persisted as `active[ownerId]` in `omni:store-v1`. A missing or dangling value falls back to the identity's first store; an old V181 file therefore opens on its one store. `createStoreFromType(typeId, {ownerId?, name?, activate?})` writes the type's layout, theme and backdrop into that store's settings and gives it its own free anchor; the same `ownerId` twice returns the existing store (`existing:true`) and never a second one. A different identity is refused another identity's store id.
- **Accepted forms.** A type's `accepts` (alias `acceptedForms`) is the list of value types its store takes; an empty list takes everything (produce, blank). Model level: `planPurchase`, `buyNow`, `sellNow`, `checkout` refuse a form the store does not take with `error:'form-not-accepted'` and a plain message ("Electronics does not take Bells. It takes: ..."); `buyForms(productId)` and `acceptForms(productId)` hide untaken forms and the default form is the first one taken; a product with only untaken forms cannot be bought (a message, not a crash). Exchange panel: the buy spokes list only taken forms and a line says which the store takes. The V181 arbitrage guard is untouched and still runs on every plan. Not enforced: a hand-edited price list is kept as typed (it is only hidden), and the wallet may still hold any type.
- Events: `omni:store-changed {kind, storeId?}`, kinds `active-store`, `store-create`, `store-rename`, `store-delete`, `store-type`.

## Where each store sits

Anchors were already per store in V181 (`anchor` in the store settings). `OmniStoreSettings.nextFreeAnchor(taken)` picks a new store's place on a grid with spacing 150 (2 x the 60-unit bounds + 30), nearest the default first, avoiding the origin objects near [200, 50, 300]. A dev test store may be given any anchor (clamped into the allowed range). Stores never overlap by default.

## Storage and migration

- Key `omni:store-v1`, version stays **1**. `active` and the new per-store fields are additive. An old V181 file loads as a single `produce` store with the same id, products, lists and sections. Nothing is rewritten until the next save.
- Sanitising a store re-seeds from its own type if its products are missing.
- Limits: **12 stores per identity, 16 in all**; names up to 40 characters (no `<`/`>`). Size guard: the serialised state may not exceed **3,000,000 characters** (a create or import that would pass it is refused with a plain message); a warning shows from 2,000,000. The last store cannot be deleted.

## Scene switching

`OmniStoreScene` listens to `omni:store-changed {kind:'active-store'}` and to the identity change and calls `_storeSwitched()`: re-point the anchor and group, apply the store's look (no second rebuild), reset view / stop / page / selection, rebuild the pooled slots and furniture in place, and `flyToLayout(1.6)`. If the store is closed only the group position and look are updated. Switching A to B to A ten times leaves mesh, slot, furniture, group-child and texture counts unchanged (jsdom test and real Chromium numbers in the BuildLog).

HUD: a **store chip** (emoji, name, caret) in row 3, hidden when you own one store; it opens a small menu (role menu, Escape closes). It wraps with the other row 3 controls at phone width.

## User and dev surfaces

- **Stores tab** (OmniStoreSettings): list with Open / Rename / Delete (inline confirm), `+ New store` with type cards, a name, "Open it now" and Create, a storage line. The active store's name shows at the top of the panel.
- **AI prompt:** a Store type select in the Catalog tab presets the category hint and description if empty; the prompt gets a STORE TYPE block (additive, defaults unchanged).
- **Applying a type on import (item 7):** if the pasted catalog names a known `store.type` and the active store is empty or blank, an UNTICKED checkbox offers to give the store that type's look and layout. It is never applied unasked.
- **Dev (DevOmniStoreSettings, section "Store types and stores"):** type picker, JSON editor with Validate / Save as custom / Delete / Copy / Load file, a test store from the type with a name and X/Y/Z, a table of all stores with raw JSON size and Switch, Dump state with a `stores` block.

## NOT built

(StoreItemNode and OmniValueNode were built in V183: see `OMNISTORE_NODES_DESIGN.md`.)

Mall hub, doors, several stores visible at once, per-store wallets, cross-store trading, moving products between stores, user-made types (only dev can add types), a type picker that edits an existing store's type, store sharing between identities, real payments, CSV import, a total-size guard for a catalog import (only the 3 MB state guard applies). Verified on software GL only; real GPU, phone and touch are not verified.

## How item 10 (mall hub) builds on it

The mall needs "one store active, others unloaded", one anchor and one layout id per store, and doors as tunnel nodes into stores. All three now exist as data: `listStores()` gives id, layout and anchor; `setActiveStore` is the unload / load edge; `_storeSwitched()` is the rebuild. A door can call `setActiveStore(id)` and fly to that store's anchor. What the mall still needs: a hub scene, door nodes, a perf budget measured on a real device, and a decision about whether stores of other identities can be entered (this version only lists the current identity's stores).
