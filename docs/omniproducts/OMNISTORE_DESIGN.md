# OmniStore

Nothing in this document is built. First noted briefly in
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

## Status

Purely conceptual. Supersedes the brief mention in
`OMNIVALUE_DESIGN.md` as the fuller home for this idea going forward.
