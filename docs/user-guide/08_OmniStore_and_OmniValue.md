# 8. OmniStore and OmniValue

Applies to: V183 · Status: verified against code on 2026-10-09 · Real devices: not verified.

[Guide index](README.md) · Previous: [Ribbon, Notify, Dock](07_Ribbon_Notify_and_Dock.md) · Next: [Settings and Admin](09_Settings_and_Admin.md)

**OmniStore** is a 3D shop you can walk up to. **OmniValue** is the wallet behind it.

**This is a sandbox. All value is fake. No real payments, no network.** The HUD shows a SANDBOX badge and the Exchange panel repeats it.

## Open the store

Ribbon Realities > Value > Store, or drawer ⟐OmniStore. The store appears in front of the landing view. A HUD "⟐OmniStore" shows (with two or more stores a store chip appears in row 3 to switch between them):

| Row | Contains |
|---|---|
| 1 | List, Wallet, ⌖ (recentre), ✕ (close) |
| 2 | Section chips and a pager ‹ 1/N · count › |
| 3 | A layout chip, aisle stop buttons ◀ ▶, ring Enter / Exit |

**Layouts** (click the layout chip to cycle, or pick in Settings): Shelf wall 🗄️, Ring 🎠, Aisle 🛒, Island table 🍽️. Arrow keys do nothing in the store.

**Sections** filter the products: Physical, Life, Social, Emotional, plus media lenses Emoji, Images, Videos (dashed chips). Up to 4 videos play at once. 24 products per page by default. The starting catalog is 16 fruit and vegetables (the Produce type).

Hover a product for a ring and a tooltip ("name · N left · N forms"). Click it to select it and open the **Exchange**. On a phone the HUD hides while the sheet is open.

## The Exchange

A panel with tabs BUY / SELL / LIST.

0. A row of four chips above the chart switches the view: **Radial wheel** (default), **Sunburst**, **Treemap**, **Sankey**. They draw the same accepted payment forms. Tap or click a slice or ribbon to select the same form the wheel would select (tap it again to go deeper). Tab and Enter work on the slices too. The choice is remembered on this device. If the chart library cannot load, the chart area says so and the wheel keeps working.
1. The wheel shows the product in the middle with − qty + controls. Each spoke is an accepted payment form (arc length = quantity on a log scale, dots = grade, "bal N" = your balance).
2. Tap a spoke, then tap it again to go deeper: Wheel, Form, Channels, Line detail.
3. Press "Buy now" or "Sell now". "◌ Window" adds to window shopping, "♡ Wish" to the wish list, "🛒 Cart" to the cart; "Checkout cart (sandbox)" buys the cart.
4. The "Product · media · lifecycle" box lets you set what the product shows (emoji, image, video): Set emoji, Set image (a link, or a file up to 512 KB), Set video (link only), Clear.
5. LIST shows Window-shop, Wishlist and Cart, plus a compare view of window versus cart totals per value type.

On a phone (700px wide or less) the Exchange is a full-width bottom sheet with large touch targets. At level 1 and 2 the chart slot shows the quote for the chosen form (what you pay, the route, the fees, the stated remainder) as a Sunburst, Treemap or Sankey. Chart sizes are display sizes only: amounts of different value types are never added together. If the rates you use are part of a loop that makes value from nothing, a red warning says so; an exchange that would continue such a loop right after another one is refused.

## Wallet

Ribbon Value > Wallet or the HUD Wallet button.

- Balances per value type; types are never merged.
- Remainder ledger with a "claim" button.
- Inventory, and the last 20 transactions.
- "Grant sandbox value": pick a type and quantity, press Grant. "Starter pack" **adds** the starter amounts again.
- "Reset sandbox": click twice to confirm. It returns the account to its starting state.

Starting balances: credits 100, usd 40, bells 250, nook 6, gold 4, flowers 12, hours 6, reputation 10, access 2; inventory apple 3, banana 2, carrot 4.

## OmniTalent (your value across types and tiers)

Ribbon Realities > Value > Talent, or the drawer item ⟐OmniTalent. It works outside the store. It is the first part of OmniTalent (value entrusted to you to grow); there is no wider OmniTalent object in the app yet.

- A chart of you, then tier (Primary to Quinary), then value type, as a Sunburst, Treemap or Sankey. Slice size is a display size (log of that type's own amount); different types are never added up.
- Pick a slice to see its balance row and the conversion rates it takes part in. "Open exchange" and "Open wallet" buttons.
- A green or red line says whether the conversion rates contain a loop that makes value from nothing. The seeded rates have none.
- Not shown: quality grades on balances (a balance has no grade).

## Pin to your space (V183)

You can leave a product or a value type in the space as a node (see [Nodes and the Inspector](03_Nodes_and_Inspector.md)).
- **Store item:** select a product on the shelf, then in the Exchange press **Pin to my space** (a row of its own under the buttons; it fits on a phone). Or use the ⟐N geometry picker, entry **Store item**.
- **Value type:** the Wallet has a pin button on every type row, OmniTalent has **Pin this value type**, or use the picker entry **Value type**.
- The node follows the store: price, stock, name and picture are read live. Delete the product and the node turns grey ("Missing product"). Your balance on a Value type node changes when your wallet changes.
- Selecting the node opens the Inspector block: Window / Wish / Cart, Open in store, Buy... (opens the Exchange; nothing is bought directly); for a Value type: Grant 10 (sandbox), Open in OmniTalent, Open exchange.
- Two Value type nodes joined by an edge show the model's rate both ways or "no direct rate", and a warning if the pair is part of a loop that makes value from nothing.
- Limits: textures are shared (200 item nodes and 50 value nodes were tested); not built: converting from a node, buying in place.

## Several stores (V182)

You can own up to 12 stores (16 across all identities on this device). One is **active**; the 3D scene shows only that one and flies you to it when you switch. Your **wallet is shared** by all your stores; each store has its own products, sections, look, layout, location and shopping list (window, wish, cart).

- **Switch:** the store chip in the HUD (row 3, shown when you have two or more stores) or Open in the Stores tab.
- **Store types:** Produce stand (fruit and vegetables, shelf wall), Bakery (breads, pastries, drinks; island table; takes Bells, Credits, USD, Flowers, hours, Nook), Electronics (aisle; takes Credits, USD, Gold, hours, Nook), Blank (empty). A store that takes only some value types hides the others in the Exchange and refuses them with a plain message. Produce and Blank take everything.
- Every store sits at its own place (150 units apart), so they never overlap.
- Your choice of active store is remembered on this device. Deleting the active store opens another one; the last store cannot be deleted.

## OmniStoreSettings (your store's look and catalog)

Open: ⟐Admin slot 19, ribbon Value > Store Settings. It has three tabs: Look, Catalog and **Stores**. Look and Catalog work on the **active store** (its name shows at the top).

### Stores tab

A list of your stores with Open (the active one is marked ACTIVE), Rename and Delete (asks again inline). "+ New store" shows a card for each type, a name, "Open it now" and Create. A line shows how much of the 3 MB browser storage the stores use. Catalog import, export, Undo and the AI prompt all act on the active store; Undo refuses to restore another store's catalog and says which store it belongs to.

### Look tab

Open store; Reset to default; Store name; Presets (Market Wood, Fresh Green, Night Market, Clean White; "Save current as…" keeps up to 20 of your own, × deletes one); Colours (Hover selector, Selected selector, Shelf rim, Shelf back panel, Shelf planks); Backdrop (None = app wallpaper, Solid colour, Gradient, plus Opacity); Layout cards; **Location** (X, Y, Z: where the store sits, default 0, 3, -40; X and Z reach 500 either way, Y reaches -200 to 300; "Reset location"; "Place at my camera" puts it 30 units ahead of where you look). Changes show live in an open store, and the camera goes with the store if you are viewing it.

### Catalog tab

Import products with help from an AI chatbot (the chatbot step happens outside this app; nothing leaves your device).

1. **Describe your store.** Write a description, choose how many products (10/25/50/100), a category hint, and accepted payment forms. Press "Copy AI prompt" (or "Copy blank template", "Download template .json") and paste it into your AI chat.
2. **Paste the AI's answer.** Paste it, or press "Load .json file…". Then Check (or Clear).
3. **Check.** A preview table appears. If something is wrong, "Copy fix-it prompt" and ask the AI again.
4. **Import.** Choose Merge (add to what you have) or Replace; confirm inline. "Undo last import" reverses it (one step only).

**Demo stores:** "Load all-emoji demo store" adds one product for every Unicode emoji (1,914), grouped into 9 sections shown as chips on the HUD. Choose Add or Replace; "Undo last import" reverses it. It is large (about 0.8 MB of this browser's storage); the shelf still shows one page at a time.

Manual editing: search, "+ Add product", Edit / Copy / Del per product (20 per page), Export catalog, "Delete all products". The product form has Name, Emoji (with an "All emojis…" picker: search by name or word such as apple, nine group tabs, your recent picks), Category, Sections, Shape, Image link, Video link, Shown on the shelf, Accepted exchange forms (+ Add form), Stock, Note. Sections cannot yet be edited or imported.

**DevOmniStoreSettings** is a developer panel and is not for normal use.

Not built yet: a mall hub, doors between stores, several stores shown at once, per-store wallets, user-made types, real payments. See [OmniStore build order](../dev/Roles/Developer/buildOrder_OmniStore_V01.md).
