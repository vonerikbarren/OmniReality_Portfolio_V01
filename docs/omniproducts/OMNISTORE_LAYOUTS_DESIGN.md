# OmniStore layouts (V179, BuildOrder item 4, sandbox store)

The idea: separate **where the products go** from **what the store looks like**. A LAYOUT is a pure function from the product count of the current page to placements, the furniture to draw and the camera framing. The scene (`systems/OmniStoreScene.js`) only applies the result in place. The user picks a layout per store; a later store type or mall hub will pick one for a store (see "How a store type picks a layout").

Do not confuse the two similarly named modules: `utils/OmniStoreLayouts.js` (this document: the layout engine) and `utils/OmniStoreLayout.js` (singular: where floating UI may sit around the hands, V176).

## The contract (`utils/OmniStoreLayouts.js`, pure: no DOM, no THREE, no storage)

```
LAYOUT_IDS = ['shelf', 'ring', 'aisle', 'island']
build(id, ctx) -> {
  id, requestedId, truncated, perPageMax: 60,
  slots:     [{x, y, z, ry, rx, scale}],      // one per product, in product order
  furniture: [{kind, x, y, z, ry, ...params}], // kind: plank | wall | floor | pillar | table | rail
  camera:    { pose(view, state) -> {pos, target, dist, dx, dy, ...},
               stops: [{id, label, pos, target, slotRange}] | null,   // aisle only
               modes: ['outside', 'inside'] | null },                 // ring only
  bounds:    { radius, height, yMin, yMax, ok },
  meta:      { ...layout specific numbers (cols, tiers, bay length, ...) } }
ctx  = { count, perPage, aspect, isPhone, settings }
view = { fov, aspect, W, H, x0, x1, y0, y1 }   // the camera + the FREE part of the viewport (the scene's _usable())
```

- Coordinates are LOCAL to the store anchor (default `[0, 3, -40]`); the scene adds the anchor. y is up; the default viewer looks down -z from +z.
- `ry` is the yaw about y, `rx` the tilt about the slot's own x axis (rotation order YXZ; the shelf keeps order XYZ and `rx = 0`). A slot faces `(sin ry cos rx, -sin rx, cos ry cos rx)` (`slotNormal()`).
- Unknown / missing ids fall back to `shelf` (`normalizeId`). Bad numbers in `ctx` are repaired; the count is capped at 60 (`truncated: true` when it was cut). Everything is deterministic: the same ctx gives the same result (tested with `JSON.stringify` equality).
- `fitDistance(w, h, view)` and `shiftFor(dist, view)` are the shared camera maths: the distance at which a w x h rectangle fits the FREE part of the viewport (clear of the HUD, the dock, the hands and an open settings / exchange panel), and the sideways / vertical shift that centres it in that region. The shelf pose is exactly V178's `flyToShelf` maths (checked: 96 scene snapshots identical, see Testing).
- `layoutStats(spec, discs)` returns placements, furniture meshes, slot meshes (cube 1, disc 3), total, bounds, stops.
- Furniture kinds are drawn with shared geometries and the store's colour settings: `plank` (box 1 x 0.1 x 0.7 scaled, shelf plank colour), `wall` (unit plane, shelf back colour), `floor` (flat plane or flat cylinder, the plank colour x 0.72), `pillar` (cylinder, `mat` rim / back / plank), `table` (unit box scaled, plank colour), `rail` (flat annulus band, the floor material). No new colour settings: the layout only uses `shelfRim`, `shelfBack`, `shelfPlank` (the floor is the plank colour darkened). The backdrop dome is unchanged.

## The four layouts

### shelf (the default, byte-for-byte V178)
cols = 6 (4 when the aspect is below 0.85), `rowsUsed = ceil(count / cols)`, spacing 1.5, x = `(col - (cols-1)/2) * 1.5`, y = `((rowsUsed-1)/2 - row) * 1.5 + 0.15`, z = 0, products face +z. Furniture: one back panel (`wall`, z = -0.65, scale `(w+0.8, h+0.8)`) and one `plank` per used row (z = -0.25, y 0.55 below the row). Camera: face the wall, framed for `max(rowsUsed, min(ceil(perPage/cols), 4))` rows. Tested: for 2 aspects x 3 page sizes x 8 counts the placements equal the V178 formulas, and a snapshot script runs the real V178 and V179 scenes through 96 scenarios (positions, planks, back panel, hover / select ring positions, flight distance and shift): the JSON is identical.

### ring (carousel)
Products on a circle, facing the centre. Tiers are stacked circles: `tiers = ceil(count / 30)` (phones / narrow: 12 per tier), `perTier = ceil(count / tiers)`, radius `R = max(2.6, 1.5 / (2 sin(pi / perTier)))` so the CHORD between neighbours is 1.5 whatever the count (radius grows with the count). Item 0 is on the left of the near arc and the sequence runs through the front half first; odd tiers are offset half a step. `ry = angle + pi` (faces the centre). The near arc therefore shows product BACKS from outside: cubes are identical on all faces and discs are two back-to-back panels, so nothing reads mirrored. Furniture: a flat floor disc (radius R + 1.2) and one `rail` band per tier (the ring-shelf under the products). No central pillar (the inside camera stands there).
Camera: default pose OUTSIDE, in front and 29 degrees above (the whole ring fits the free viewport, the ring reads as an ellipse). "Enter" (HUD) puts the camera at the centre of the ring (target 1 unit away, OrbitControls' `minDistance` is 1) so you orbit / look around the inside; the button then reads "Exit". The HUD recentre button returns to the default outside pose and ends the inside view. Switching layout also resets it.

### aisle (corridor)
Two facing shelf runs along z with a floor strip between (walkway 6 wide, 4.8 on phones). Each pair of bays (left + right) is one STOP. `pairs = ceil(count / (2 x 6))` (phones 2 x 4), `perBay = ceil(count / (2 pairs))` (at most 6, phones 4), a bay is 3 columns x up to 2 rows (phones 2 columns), bay length 5.3 (3.8 on phones). The product order is the walking order: bay 0 left, bay 1 right, bay 2 left, ... Products sit on the run planes (x = +-3) and are angled 0.45 rad toward the entrance, so they read from the walkway. Furniture: one continuous `wall` and `plank` rows per side, uprights (`pillar`, x = +-3.45: BEHIND the product plane so they never hide a product), the floor strip, an end wall. 60 products: 5 pairs, 26.5 long. Length cap: `AISLE_MAX_PAIRS = 12` (63.6) which the 60-product hard cap can never reach.
Camera: the stops are `[Entrance, Bay 1/n, ...]`. The entrance pose is the default and the recentre target. At a stop the camera stands in the walkway 7.5 units (more when the viewport needs it) behind the pair centre and looks along -z. HUD `◀ label ▶` step stop by stop (GSAP, 0.9 s `power2.inOut`); a pointer-down on the canvas (the user's own orbit or click) cancels the glide; a page with fewer products has fewer stops and a stale stop index is clamped (and flown to). `omni:store-open {productId}` starts at the stop that holds the product. Arrow keys are NOT bound: `ui/MovementPad.js` and `ui/OmniKeys.js` own them globally (hand movement), so the stop buttons (focusable) are the way.

### island (tiered display table)
A rectangular table with a grid of products (`cols = ceil(sqrt(1.5 count))` clamped 3..10, phones 3..5), rows are TIERS that rise 0.32 per row toward the back, products tilted up 0.55 rad and facing +z (up / toward the front). Furniture: the table slab, one riser block per row, a plinth and a floor disc. Camera: 3/4 view from the front and 34 degrees above, orbit around it. From behind, cubes and double-sided discs still read.

## Capacity and mesh budget

The existing items-per-page setting (6..60, DevOmniStoreSettings) is the hard cap for every layout; layouts only decide rows / radii / bays for the count they get. Mesh counts: a cube product is 1 mesh, a disc 3 (two panels + rim); two selector rings; one backdrop mesh when a backdrop is on. Furniture meshes (desktop; phone in brackets):

| products | shelf | ring | aisle | island |
|---|---|---|---|---|
| 16 | 4 (5) | 2 (3) | 14 (14) | 7 (7) |
| 24 | 5 (7) | 2 (3) | 14 (16) | 7 (8) |
| 40 | 8 (11) | 3 (5) | 18 (20) | 8 (11) |
| 60 | 11 (16) | 3 (6) | 20 (26) | 9 (15) |

Worst case (all discs) at 60 products on a desktop: 180 product meshes + furniture + 2 rings (+1 backdrop): shelf 193, ring 185, aisle 202, island 191. All geometries are shared (9 in total: cube, circle, rim, ring, plank, unit plane, box, cylinder, annulus), the materials are shared (rim, back, plank, floor, hover, select) apart from the six per-slot face materials that already existed. Real-Chromium counts are in the BuildLog entry (V179).

Pools: slot meshes are the existing pool (grown to the page size, never shrunk). Furniture meshes are pooled per geometry (plank, plane, box, cylinder, annulus); a layout takes what it needs, grows a pool only when it needs more than ever before, hides the rest; closing the store releases every pooled furniture mesh beyond the shelf baseline (back panel + 6 planks). Switching layouts 20 times grows nothing (tested: children, meshes, geometries, materials).

## Bounds and the dome

The backdrop dome has radius 120 around the anchor. Each layout reports `bounds.radius` (farthest placement or furniture extent from the anchor); `BOUNDS_MAX = 60` and every layout stays well inside (60 products: shelf 4.9, ring 8.4 (phone 4.1), aisle 26.8 (phone 30.6), island 13.3 (phone 15.7)). Camera poses are capped at `MAX_DIST = 70` (below OrbitControls' `maxDistance` 80 and below 0.92 x 120 where the dome hides itself). The scene reports `domeOk` in its stats. If a future layout can exceed 60, scale its spacing down or cap its count; do not change the dome.

## Settings and events

- `layout` is a key of the store settings (`omni:store-settings-v1`, `utils/OmniStoreSettings.js`), per store, default `shelf`; unknown or missing (data saved before V179) reads as `shelf` (the version stays 1). A patch with an unknown id is ignored. **Presets never carry or change it** (decision: the layout is independent of the colour look); "Reset to default" resets the look and keeps the name AND the layout.
- Scene: the effective layout is the saved setting, or a temporary DEV PREVIEW. `omni:store-layout-set {layout}` saves (via the settings); `{layout, preview:true}` previews (not saved; ends on close, on `{layout:null, preview:true}`, or when the user picks a layout; ignored while the store is closed). `omni:store-settings-changed` with the `layout` key switches in place (rebuild + fly to the layout's default pose). `omni:store-state` now also carries `layout`, `stop`, `view`.
- HUD (third row): a chip `🗄️ Shelf` that cycles shelf -> ring -> aisle -> island (`data-omni-tip`, saved through the same setting); aisle: `◀ <stop label> ▶`; ring: `Enter` / `Exit`.
- User panel (Look tab): four radio cards with an inline SVG icon, the name and a one-line description. Dev panel: the record `layout` select (all four), "Preview layout" / "End preview" per record, per-layout readout lines, layout stats in "Dump state".

## How a store type or a mall hub picks a layout

A store-type record already carries `layout` (data only: BuildOrder item 6 will read it). The hand-off is one call: when a store is created from a record, write `Look.setSettings({layout: record.layout}, storeId)` (or dispatch `omni:store-layout-set`), and the store opens in that layout; the user can still change it. A mall hub (item 10) keeps one anchor per store and one active store; each store only needs its layout id and anchor, because `build(id, ctx)` is pure and the scene reads the layout id from that store's settings. A NEW layout is added by writing a `build(ctx)` that returns the contract above, adding its id to `LAYOUT_IDS` and `LAYOUTS` (name, one-line description, icon) and an SVG to the user panel's `ICONS`; the scene, the HUD chip, the dev panel and the sanitiser read the registry.

## Verified in V179 (see the BuildLog entry for numbers)

jsdom: the pure engine (no overlap below 1.4 units for counts 0..60, everything inside bounds, deterministic, unknown ids fall back, shelf = V178), the scene in place (same slot / back / plank objects after switching, no growth over 20 switches), hover / select per layout (the picked product, ring facing the slot normal), camera poses inside the free viewport (side panel, phone sheet), aisle stops and glide cancel, ring enter / exit, settings sanitiser / migration, panels, listener balance. Real Chromium (software GL) at 1280x720 and 390x844: all four layouts through the settings selector and the HUD chip, hover / select, exchange from a ring product, 24 + 16 paging with a 40-product catalog, 60 per page, close / reopen, reload.

## NOT built

- Walk-through first-person movement (the aisle moves the camera along stops and you can orbit; nothing walks), collision, and several rooms.
- Floor signage / wayfinding, per-section layouts (one layout per store; the sections are still a filter), store types driving layouts (item 6), a layout editor, user-defined layouts.
- Custom furniture models / glTF, lighting, shadows, textures on the furniture (flat unlit colours only).
- A central pillar for the ring (the inside camera stands in the centre), a rectangular grid island with flush rows, arrow-key stepping for the aisle.
- Real GPU / phone / touch verification: only software GL and emulated touch were available.
