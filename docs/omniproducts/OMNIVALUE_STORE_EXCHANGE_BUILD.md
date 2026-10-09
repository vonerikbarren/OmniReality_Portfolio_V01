# OmniValue + OmniStore + Exchange radial: build notes (V176, sandbox only)

All value is fake. No real payments, no network. SANDBOX is shown in the store HUD, the exchange panel and the wallet. D3 charts are V177 and are not built.

## Files
- `utils/OmniValueModel.js` (no DOM, `omni:value-v1`), `utils/OmniStoreModel.js` (`omni:store-v1`), `utils/OmniStoreLayout.js` (hand-aware placement)
- `systems/OmniStoreScene.js` (shelf), `ui/OmniExchangeRadial.js` (panel `omniexchange`), `ui/OmniWalletPanel.js` (panel `omniwallet`)
- Wiring: `ui/Drawer.js` (⟐OmniStore, ⟐OmniValue), `ui/OmniRibbon.js` (Realities > Value), `main.js` (each module added once; `init()` is guarded by `_inited`)

## Data model
- Value type: id, tier (5), quality scale (graded; a grade's weight multiplies quantity), channels (fee), step, `payable`. 10 defaults; `produce` and `reputation` are `payable:false`.
- Conversion edge: pairwise, directional, `toQty = fromQty * rateNum / rateDen`, optional `minQty`, `qualityRule.minWeight` (first edge), `owner` (only that account or its counterparty). No global currency.
- `quote(offer, want)`: paths up to 3 edges, best yield; forward pass checks `minQty`, backward pass gives `offerNeeded`; fees on top, rounded UP to the type step; default channel is the cheapest. The remainder is STATED per value type, never rounded away or merged; `claimRemainder` / `applyRemainder` move it to the account.
- Accounts and ledger per identity; transaction log; `declaredIntent` (Desire, forward only). Events `omni:value-changed`, `omni:value-trade`.
- Store: per identity, 4 identity sections plus 3 media lenses, 16 products. One list model: an item is (product, state) with state window / wish / cart; moving merges into the twin. `chosenForm` holds split shares; `buyNow` and `planPurchase` accept `payQty`. `accept` forms (selling) are separate from `price`.

## Decisions
- Intent is Desire (forward). Purpose (PrimaryForce, backward) is not built; the system renders no verdict.
- Disc = two CircleGeometry panels back to back plus a rim (one DoubleSide panel mirrors the emoji from behind). Cube = 6 materials sharing one map.
- Textures: emoji cached by `emoji|size|category` and ref-counted; images with emoji fallback (512KB each, 1.5MB data URLs per store); video is URL only, at most 4 live.
- Products are not OmniNodes. The camera is framed with `flyToShelf` using the free viewport (hands, HUD, panel) and `omni:orbit-target-set`.
- Phone (<= 700px): the exchange panel is a bottom sheet (max 66vh); the store HUD steps aside while it is open.

## Open question: quality assessment
Grades are self-reported today. Who or what assesses quality (a peer, an instrument, a ledger of past trades) is undecided.

## V177 hooks
- `#exchange-chart-slot` (levels 1 and 2 of the radial), `OmniStoreModel.toHierarchy()` (treemap / sunburst) and `toFlows()` / `OmniValueModel.toFlows()` (sankey).
- `product.lifecycle` for a lifecycle tunnel scene.

## Not verified
Real GPU, video textures on real devices, touch input. Arbitrage loops are unguarded. On 390x844 the fourth spoke needs a scroll in the sheet. See `DeveloperQueue.md` item 57.
