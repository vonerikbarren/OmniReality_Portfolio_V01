# 8. OmniStore and OmniValue

Applies to: V180 · Status: verified against code on 2026-10-09 · Real devices: not verified.

[Guide index](README.md) · Previous: [Ribbon, Notify, Dock](07_Ribbon_Notify_and_Dock.md) · Next: [Settings and Admin](09_Settings_and_Admin.md)

**OmniStore** is a 3D shop you can walk up to. **OmniValue** is the wallet behind it.

**This is a sandbox. All value is fake. No real payments, no network.** The HUD shows a SANDBOX badge and the Exchange panel repeats it.

## Open the store

Ribbon Realities > Value > Store, or drawer ⟐OmniStore. The store appears in front of the landing view. A HUD "⟐OmniStore" shows:

| Row | Contains |
|---|---|
| 1 | List, Wallet, ⌖ (recentre), ✕ (close) |
| 2 | Section chips and a pager ‹ 1/N · count › |
| 3 | A layout chip, aisle stop buttons ◀ ▶, ring Enter / Exit |

**Layouts** (click the layout chip to cycle, or pick in Settings): Shelf wall 🗄️, Ring 🎠, Aisle 🛒, Island table 🍽️. Arrow keys do nothing in the store.

**Sections** filter the products: Physical, Life, Social, Emotional, plus media lenses Emoji, Images, Videos (dashed chips). Up to 4 videos play at once. 24 products per page by default. The starting catalog is 16 fruit and vegetables.

Hover a product for a ring and a tooltip ("name · N left · N forms"). Click it to select it and open the **Exchange**. On a phone the HUD hides while the sheet is open.

## The Exchange

A panel with tabs BUY / SELL / LIST.

1. The wheel shows the product in the middle with − qty + controls. Each spoke is an accepted payment form (arc length = quantity on a log scale, dots = grade, "bal N" = your balance).
2. Tap a spoke, then tap it again to go deeper: Wheel, Form, Channels, Line detail.
3. Press "Buy now" or "Sell now". "◌ Window" adds to window shopping, "♡ Wish" to the wish list, "🛒 Cart" to the cart; "Checkout cart (sandbox)" buys the cart.
4. The "Product · media · lifecycle" box lets you set what the product shows (emoji, image, video): Set emoji, Set image (a link, or a file up to 512 KB), Set video (link only), Clear.
5. LIST shows Window-shop, Wishlist and Cart, plus a compare view of window versus cart totals per value type.

On a phone (700px wide or less) the Exchange is a full-width bottom sheet with large touch targets. Level 1 still shows the text "Chart slot — D3 views arrive in V177": a leftover placeholder; no chart is there.

## Wallet

Ribbon Value > Wallet or the HUD Wallet button.

- Balances per value type; types are never merged.
- Remainder ledger with a "claim" button.
- Inventory, and the last 20 transactions.
- "Grant sandbox value": pick a type and quantity, press Grant. "Starter pack" **adds** the starter amounts again.
- "Reset sandbox": click twice to confirm. It returns the account to its starting state.

Starting balances: credits 100, usd 40, bells 250, nook 6, gold 4, flowers 12, hours 6, reputation 10, access 2; inventory apple 3, banana 2, carrot 4.

## OmniStoreSettings (your store's look and catalog)

Open: ⟐Admin slot 19, ribbon Value > Store Settings. It has two tabs.

### Look tab

Open store; Reset to default; Store name; Presets (Market Wood, Fresh Green, Night Market, Clean White; "Save current as…" keeps up to 20 of your own, × deletes one); Colours (Hover selector, Selected selector, Shelf rim, Shelf back panel, Shelf planks); Backdrop (None = app wallpaper, Solid colour, Gradient, plus Opacity); Layout cards. Changes show live in an open store.

### Catalog tab

Import products with help from an AI chatbot (the chatbot step happens outside this app; nothing leaves your device).

1. **Describe your store.** Write a description, choose how many products (10/25/50/100), a category hint, and accepted payment forms. Press "Copy AI prompt" (or "Copy blank template", "Download template .json") and paste it into your AI chat.
2. **Paste the AI's answer.** Paste it, or press "Load .json file…". Then Check (or Clear).
3. **Check.** A preview table appears. If something is wrong, "Copy fix-it prompt" and ask the AI again.
4. **Import.** Choose Merge (add to what you have) or Replace; confirm inline. "Undo last import" reverses it (one step only).

Manual editing: search, "+ Add product", Edit / Copy / Del per product (20 per page), Export catalog, "Delete all products". The product form has Name, Emoji, Category, Sections, Shape, Image link, Video link, Shown on the shelf, Accepted exchange forms (+ Add form), Stock, Note. Sections cannot yet be edited or imported.

**DevOmniStoreSettings** is a developer panel and is not for normal use.

Planned (not available yet): see [OmniStore build order](../dev/Roles/Developer/buildOrder_OmniStore_V01.md).
