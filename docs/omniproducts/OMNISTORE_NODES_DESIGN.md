# OmniStore nodes: StoreItemNode and OmniValueNode (V183)

Applies to: V183 · Status: verified in jsdom and in real Chromium on software GL · Real GPU, phone and touch: not verified. SANDBOX: all value is fake, no real payments.

BuildOrder item 7. Two new kinds of node a user can place and inspect: a **store item** (points at one product) and a **value type** (points at one value type, shows your live balance). Converting between two value types stays an **edge**.

## Decision: how are they registered

**Chosen (b): ordinary OmniNode nodes with `data.nodeKind`** (`'storeItem'` or `'omniValue'`) plus the reference fields. `data.geometry` is the marker string `'StoreItemNode'` / `'OmniValueNode'`, so every older reader that looks only at `geometry` sees an unknown name and does nothing harmful.

Evidence for it (checked in the code):
- Inspector, Timeline player, NodeBehavior engine, FlowFire and Grab all find a node through `mesh.userData.nodeId` and the `omni:node-created` / `omni:node-restored` events. A kind node is tagged exactly like any node, so Time clips, Behaviors (Oscillate moves it, tested), grouping, duplicate, delete, parenting and saving work without special cases in those systems. They are verified in `t/v183_nodes_test.mjs`.
- `OmniNode._nodes` already persists, restores, duplicates and deletes nodes. The kinds only add a small `Kinds` hook at create, restore and delete.

Rejected:
- **(a) Store-owned meshes** (make the store scene's pooled shelf meshes into nodes). The shelf slots are pooled, unlit, rebuilt on every page / layout / store switch and not persistent. Making them nodes would give nodes that disappear when the page turns. The shelf stays a rendered view; **pooled shelf meshes are never nodes**.
- **(c) NodeLoader registry** (`NodeLoader._registry`). It is a registry of formations (generators of many nodes), has no per-node kind persistence and no Inspector path. It stays as it is.

## Data shapes (what is saved)

```
{ ...normal OmniNode fields, geometry: 'StoreItemNode', nodeKind: 'storeItem', storeId, productId }
{ ...normal OmniNode fields, geometry: 'OmniValueNode', nodeKind: 'omniValue', valueTypeId }
```
Only references are saved: no name, price, stock, emoji or balance. A saved item node is about 0.9 KB (the normal node fields). Ids are validated (`[A-Za-z0-9_.:-]`, 64 chars). A **duplicate** is another reference to the same product / type. **Deleting a node never deletes the product, the store or the value type.** Edges between nodes stay `{from,to}`; the conversion rate is never stored on an edge.

## Code

| File | Job |
|---|---|
| `utils/OmniNodeKinds.js` | Pure helpers and the texture cache. `describeStoreItem`, `describeValueNode`, `pairInfo`, `kindCreateFields`, `textureStats`, `kindStats`, and the live mesh registry. No Dev import. |
| `systems/OmniStoreNodes.js` | Runtime module (`{init, update, destroy}`, init twice safe): the pin request, the rAF-coalesced refresh, edge rate labels, the dev test nodes. |
| `ui/OmniNodeKindInspector.js` | The Inspector block. |
| `systems/OmniNode.js` | Create / restore / delete hooks, picker entries, place flow, geometry swap refused. |
| `systems/OmniInspector.js` | Shows the block inside Appearance; geometry select disabled for kinds. |
| `utils/OmniStoreModel.js` | New read-only `peekStore(id)`. |

## Faces and the texture cache

- One **shared, ref-counted, capped** texture per distinct glyph (emoji + shape) and per distinct label text. Caps: 256 glyph and 256 label textures, 128 px glyphs, 28 characters x 3 lines per label. A node holds one reference to each; delete, scene clear and destroy give them back and a texture is disposed at zero references. Beyond the cap a fallback glyph is used (never a throw).
- Two **shared pinned geometries** (cube, disc). `OmniNode` disposes `mesh.geometry` when a node is deleted, so the shared ones are pinned (their `dispose` is a no-op) and released through a hook before `map.dispose()`.
- The root mesh has a single material (the Inspector reads `mesh.material.color`); the name label is a child sprite.
- 200 store item nodes + 50 value nodes: 2 geometries, textures bounded by the DISTINCT products and types (52 for the seeded data, 2 references per node), all freed on delete (tested).

## Refresh rules

A node never polls. Model events (`omni:store-*`, `omni:value-changed`, ledger changes) mark kind meshes dirty; one pass per animation frame (`refreshNow`) rebuilds only what changed. 20 events in one frame = 1 pass (tested). Value nodes are only touched on a ledger change. A missing reference gives the **missing state**: grey, a question-mark glyph, the label "Missing product / Missing store / Missing value type"; it never throws and it never creates a store (`peekStore`, not `getStore`). If the reference comes back the node comes back.

## Inspector blocks (no new icon-strip section)

The strip still has 12 sections. The block sits inside Appearance, like the Sequence block, and updates live while open.
- **Store item:** store name, product (emoji, shape), price forms as plain text, stock, the forms the store takes, the SANDBOX badge and notice; **Window / Wish / Cart** (the shopping-list API; for an item of another store the store is made active first and the message says so), **Open in store** (`setActiveStore`, fly, select the product), **Buy...** (opens the exchange on the product; never buys directly).
- **Value:** type, tier, balance, remainder in plain language; **Grant 10 (sandbox)** (the same `Value.grant` the Wallet panel already offers, so it is user-facing), **Open in OmniTalent**, **Open exchange** (not preset to a pair); **Conversion routes** for every connected value node.

## Conversion stays an edge

A real OmniNode edge between two value nodes. The edge draws a label at its midpoint: `Bells ⇄ Credits`, then the model's rate in both directions, e.g. `3 Bells → 1 Credits` / `1 Credits → 3 Bells`; if the model has no conversion edge between the two the label says `no direct rate`. Arbitrage warnings from `findArbitrageLoops` that use the pair appear in the label's Inspector route and in the Edge Inspector. The rate is read through `pairInfo` every time and never stored on the edge; drawing never writes the OmniValue model (tested: model storage byte-identical). Conversion is not executed from a node; the buttons only open the exchange.

## Entry points

1. Exchange panel (opened from a store product): **Pin to my space** (own row, fits at 390 px, tested in Chromium).
2. Wallet panel: a pin button on every value type row; OmniTalent panel: **Pin this value type** (also reached by `omni:talent-open {typeId}`).
3. The normal place flow: the ⟐N geometry picker has two extra entries, **Store item** and **Value type** (choose a product / type, then the usual place click). The ninth OmniDraw mode slot is not used and there is no 13th Inspector section.

Pin event: `omni:node-pin-request {kind:'storeItem', storeId?, productId} | {kind:'omniValue', valueTypeId}` with `detail.out = {ok, id, label} | {ok:false, error}`. A pinned node drops about 6 units in front of the camera, has no parent edge and is not auto-selected, but stays clickable (the flags are `noParent` and `noSelect` on `omni:node-create-request`; `noSelect` also marks the `omni:node-created` detail `quiet: true` so the Inspector does not load the node).

Found in Chromium and fixed: every `omni:node-created` used to load the node into the Inspector, and every load made a new Create-preview WebGL renderer that was `dispose()`d without releasing its context. Creating 50 test nodes made 50 contexts and the browser dropped the MAIN canvas ("WebGL context LOST"). Fixes: quiet creates are not loaded by the Inspector, and `_teardownCreatePreview` now calls `forceContextLoss()`. After the fix the page holds 5 contexts through the 50-node test. Other events: `omni:node-pinned`, `omni:node-kinds-stats-get {out}`, `omni:node-kinds-test {action:'create'|'remove', storeItems, values}` (dev only), `omni:talent-open`.

## Dev panel

`DevOmniStoreSettings` only shows a readout (store item nodes, value nodes, glyph and label textures, shared geometries) and has **Create 50 test nodes** / **Remove test nodes**. User modules never import a Dev file (static test).

## Limits and Not built

- Caps above; label text 28 characters x 3 lines.
- A node's own name (what you can edit in the Inspector) is stored; the face shows the live name.
- Not built: running a conversion from a node, a rate chart on the edge, buying in place, moving a product by dragging a node, a node for a whole store, a node for a transaction. Not verified: real GPU, phone, touch.
