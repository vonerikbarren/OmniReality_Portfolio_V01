# OmniStore

The first sandbox slice is built in V176 (see **What is now real (V176,
sandbox only)** below); the rest of this document is still design. First noted briefly in
`OMNIVALUE_DESIGN.md` (paired with OmniValue); this document replaces
that brief note with the fuller shape it's since grown.

## The core idea

Within their own reality, a user can have a store - and can have
**several** stores, not just one. Beyond a single storefront, users
can have a **marketplace** inside their reality.

## The actual mechanic being sold - this is what makes OmniStore more than a UI shell

OmniStore is the storefront; `NAMING_TIER_SYSTEM_DESIGN.md` is what
it's actually selling. The two were raised in the same breath on
purpose: the tiered-naming system (a product's name itself changing as
you pay for more capability, Kingdom Hearts spell-tier style) is the
concrete thing a marketplace transaction inside OmniStore would be
*for*. Without that tier system, OmniStore is just a generic commerce
UI; with it, OmniStore is the place where a specific, meaningful
progression (Time -> OmniTime -> ... -> OmniChronos) actually gets
purchased.

## Where this connects

- **OmniValue** (`OMNIVALUE_DESIGN.md`) - already noted as the value
  mechanics OmniStore would be built on top of; unchanged by this
  document, just cross-referenced.
- **Naming & Tier System** (`NAMING_TIER_SYSTEM_DESIGN.md`) - the
  actual product being sold through the store, per above.

## What's genuinely undecided

- Whether "several stores" per user means several independent
  storefronts they each manage, or several *sections* of one
  marketplace - not specified.
- How a marketplace differs mechanically from a single store beyond
  scale - e.g., does a marketplace let other users list things inside
  someone else's reality, or is it still one owner's stores, just more
  of them?
- Nothing about actual store UI, listing mechanics, or transaction
  flow has been discussed - this is still at the "here's what it's
  for" stage, not "here's how it works."

## What is now real (V176, sandbox only)

A fruit-and-veg TEST store, all value fake, SANDBOX shown everywhere.
Code: `utils/OmniStoreModel.js`, `systems/OmniStoreScene.js`,
`ui/OmniExchangeRadial.js`, on `utils/OmniValueModel.js` (see
`OMNIVALUE_DESIGN.md` and `OMNIVALUE_STORE_EXCHANGE_BUILD.md`).

- **One store per identity** (the active OmniIdentity id, else
  `sandbox-user`), seeded with 16 products (🍎🍌🍇🍓🍉🍑🍒🍍🥕🥦🌽🍅🥔🧅🥬🍆), each
  accepting several exchange forms (apple: 3 Bells, 1 Credit, 0.5 Gold, 2
  Fresh Flowers; carrot: 1 Nook Ticket, 2 Skilled service-hours, 6 Bells, 2
  Credits). Answers the open question "several stores vs several sections":
  V176 uses **sections of one store**; several independent stores per
  identity are not built.
- **Sections** = identity sections from the real 14 Wellness Dimensions
  (`data/OmniUserWellness.js`: Physical, Life, Social, Emotional are used;
  there is no "Nutritional" dimension, so produce lives under Physical) plus
  **media lenses** Emoji / Images / Videos (a product appears in a lens when
  it carries media of that kind).
- **A product's media is switchable**: it can carry an emoji, an image
  (URL or data URL, max 512 KB each, 1.5 MB of data URLs per store) and a
  video (URL only), with one ACTIVE kind (`setActiveMedia`, valid only when
  that media exists).
- **In the scene**: a shelf at a store anchor; each product is a CUBE (the
  emoji on all six faces) or a DISC (two circle panels back to back, so the
  emoji reads correctly from both sides). Hover / click a product; click
  opens the exchange radial. Max 24 products per page.
- **Shopping is ONE list model** `listItems [{productId, qty, state:
  'window'|'wish'|'cart', chosenForm, declaredIntent}]`: window = browsing
  reality, wish = wanted, cart = to buy. A product has at most one item per
  state; moving an item changes its state in place (merging if the target
  state already holds that product). The compare view sets the window
  reality against the cart (rows, totals per value type). Checkout runs the
  cart through the ledger, all-or-nothing on balance.
- **Exchange radial**: the product in the middle, every accepted exchange
  form as a spoke (arc = quantity needed, dots = grade, "bal" = your
  balance), BUY and SELL (in SELL the spokes are the forms you accept,
  editable and saved on the product), tap a spoke again to go down three
  levels (form, channels, line detail incl. the stated remainder).
- **Lifecycle** (idea, materials, init, build, final, update), reviews and
  stats (purchases, influence, customer types) exist on each product as
  DATA ONLY; nothing displays the lifecycle as a scene yet.

Still undecided / not built: several stores or a marketplace per identity;
listing by other users; selling to another real account; the tiered-naming
product (`NAMING_TIER_SYSTEM_DESIGN.md`) as the thing being sold; the D3 views
(BuildOrder item 5, a standalone OmniTalent component panel) and the lifecycle
tunnel scene.

## Status

V176: a sandbox fruit/veg store, shelf and exchange panel exist (above). The
rest is still conceptual. Supersedes the brief mention in
`OMNIVALUE_DESIGN.md` as the fuller home for this idea going forward.

V177 adds the store's look and its dev tooling, split by the convention
`<System>Settings` (user) / `Dev<System>Settings` (developer and Claude); see
`OMNISTORE_SETTINGS_DESIGN.md`:

- **OmniStoreSettings** (Admin slot 19): store name, colours (hover / selected
  selector, shelf rim / back / planks), a backdrop dome (none / solid / gradient,
  opacity), 4 built-in presets (Market Wood = the V176 look, Fresh Green, Night
  Market, Clean White) plus the user's own, applied live in the open store.
- **DevOmniStoreSettings** (⟐Developer slot 6, DEV ONLY): store type records (data
  only; V179: `layout` select + "Preview layout"), catalog JSON export /
  validate / import (merge or replace, preview first, undo), "Copy AI prompt +
  schema" (a prototype of the later user template), items per page (6..60), test
  data, live readout, Dump state, Notes for Claude.
- The shelf reads its colours from the settings (no rebuild on change) and its
  per-page count from the dev knob (default 24). D3 views: BuildOrder item 5.

V179 adds swappable layouts (BuildOrder item 4); full design in
`OMNISTORE_LAYOUTS_DESIGN.md`:

- A **layout** separates where the products go from what the store looks like:
  a pure function (`utils/OmniStoreLayouts.js`) from the product count of the
  page to placements, furniture and camera framing. Four exist: **shelf wall**
  (the default, unchanged to the pixel), **ring** (a carousel circle, outside
  view or step inside), **aisle** (a corridor with shelves on both sides, the
  camera glides stop by stop), **island** (a tiered display table to orbit).
- The user picks one in OmniStoreSettings (Look tab, four cards with a one-line
  description) or with the chip in the store HUD; it is saved per store and
  independent of the colour presets. The scene switches in place: the same
  pooled product meshes and pooled furniture meshes are re-assigned (no growth).
- The dev panel can preview a store-type record's layout in the open store
  temporarily. Store types do not drive layouts yet (BuildOrder item 6) and a mall
  hub (item 10) will pick a layout per store through the same setting.
- Not built: walking through the store, collision, several rooms, floor signage,
  per-section layouts, a layout editor, custom furniture models, lighting,
  shadows. Only software GL was available, so frame rate on a real GPU / phone
  is unmeasured.
