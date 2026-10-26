# OmniPlayer Identification Badges

Nothing built. `⟐OmniPlayer` already exists as a named entry in the
Left Drawer (`ui/Drawer.js`'s `LEFT_ITEMS`), and a "whole OmniUser/
OmniPlayer role framework" was already flagged as unbuilt in
`OMNI_EXPRESSION_PRESENTER_DESIGN.md`. This doc is the first real
elaboration of what that framework is actually for.

## The core idea

An official access system for OmniProducts, represented as
identification badges — living inside the OmniPlayer aspect of the
OS. Not framed as a dry permissions list: described directly as
having a real game aspect, deliberately meant to attract gamers and
complex-software-minded users specifically, not just track access
level as a background fact.

## Why this connects to what already exists, not a new hierarchy

- **`architecture/NAMING_TIER_SYSTEM_DESIGN.md`** — the tier system is
  the actual mechanic; a badge is a plausible visible *representation*
  of "which tier of which OmniProduct you hold," not a competing
  system.
- **`omniproducts/SYSTEM_ACCESS_OVERVIEW_DESIGN.md`** — the permission/
  access overview is the data (what you're allowed to reach, at what
  level); a badge would be the player-facing, game-like presentation
  of that same underlying data, not a second, separate dataset.

Likely the same real thing said three ways, at three different
layers — tier system as monetization mechanic, the access overview
as the data/permission model, badges as the player-facing, game-like
front end. Not confirmed as literally the same yet, but the strong
suspicion is that these should converge rather than be built as three
independent systems.

## The complexity-level interface pattern — a separate but related idea

Raised alongside the badge idea, worth recording as its own real UI
convention: interfaces should support different levels of complexity
in the same way a Logic Pro instrument module has a compact form and
an expanded form with more settings. Same panel, two depths — not two
different panels for "simple" and "advanced" users.

This connects directly to OmniBrand's dual-audience requirement
(`OMNIBRAND_DESIGN.md` — the same tree needs to read as both a map for
simple users and a navigation reference for complex ones) and to
OmniComplexity's own cross-cutting intent. A real candidate to become
a shared, reusable panel behavior (a collapse/expand affordance any
panel can opt into) rather than something rebuilt per panel — same
"build once, reuse everywhere" reasoning already applied to the
shared geometry cache and the particle engine.

## Status

Purely conceptual. No badge data model, no visual design, no
confirmation that tiers/access-overview/badges are actually meant to
converge into one system rather than three. The complexity-level
interface pattern is named and reasoned about but not built anywhere
yet.
