# ⟐mniReality Documentation

Everything documented about this project, organized the way a real
docs site would present it. Existing filenames were kept as-is when
moving files here — many docs already reference each other by
filename, and renaming would have silently broken those links.

## Orientation — start here

- [`orientation/READMYCONTEXT.md`](orientation/READMYCONTEXT.md) —
  oriented specifically for an AI collaborator picking this project up.
- [`orientation/PROJECT_STATUS.md`](orientation/PROJECT_STATUS.md) —
  what's actually built and verified, what's legacy/superseded, what's
  designed but not built, and an honest list of what hasn't been
  audited yet.

## Architecture

- [`architecture/BACKEND_ARCHITECTURE_DESIGN.md`](architecture/BACKEND_ARCHITECTURE_DESIGN.md)
  — why frontend-only hits a real wall, and the GitHub Pages
  hybrid-hosting question.
- [`architecture/OmniDimensionalApps.md`](architecture/OmniDimensionalApps.md)
  — the broader dimensional-apps concept underlying the project.
- [`architecture/NAMING_TIER_SYSTEM_DESIGN.md`](architecture/NAMING_TIER_SYSTEM_DESIGN.md)
  — the Kingdom Hearts-inspired progressive naming/monetization
  convention, and how it retroactively resolves the OmniVision/OmniVisor
  naming collision.

## Core systems

General-purpose, already-built infrastructure — not tied to one
specific named OmniProduct.

- [`core-systems/INDEXED_PANELS_DESIGN.md`](core-systems/INDEXED_PANELS_DESIGN.md)
  — the reusable indexed-panel factory used throughout the left drawer.
- [`core-systems/NAV_PANELS_DESIGN.md`](core-systems/NAV_PANELS_DESIGN.md)
  — the 24 right-drawer (NavMenu) leaf panels.
- [`core-systems/DIMENSIONAL_TEXT_DESIGN.md`](core-systems/DIMENSIONAL_TEXT_DESIGN.md)
- [`core-systems/OMNIKEYBOARD_DESIGN.md`](core-systems/OMNIKEYBOARD_DESIGN.md)
- [`core-systems/EXPORT_IMPORT_DESIGN.md`](core-systems/EXPORT_IMPORT_DESIGN.md) —
  built and tested: exports/imports a real .zip of every setting plus
  every saved image/audio/video across the whole app, with version
  checking.
- [`core-systems/OMNICONFIG_DESIGN.md`](core-systems/OMNICONFIG_DESIGN.md) —
  a named, reusable text-style/animation library, applying to both
  DimensionalText content and panel chrome, design-token style.

## OmniProducts

One doc (or more) per named product — a mix of what's built and what's
still purely conceptual. Check each doc's own Status section.

- [`omniproducts/OMNIBROWSER.md`](omniproducts/OMNIBROWSER.md) —
  OmniBrowser, OmniBrowserProperties, OmniBrowserSpace, and the
  Electron/webview path to a real browser.
- [`omniproducts/OMNI_EXPRESSION_PRESENTER_DESIGN.md`](omniproducts/OMNI_EXPRESSION_PRESENTER_DESIGN.md)
  — OmniExpression's presenter avatar, waypoint timeline, the planned
  OmniExpressionVideoPlayer, and the much larger Timeline / Time Tunnel
  / Master Tunnel / OmniTime / OmniLayer design thread.
- [`omniproducts/COORDINATE_NODES_TIMELINE_DESIGN.md`](omniproducts/COORDINATE_NODES_TIMELINE_DESIGN.md)
  — generalizing OmniExpression's waypoint mechanism to any object.
- [`omniproducts/OMNIVISOR_DESIGN.md`](omniproducts/OMNIVISOR_DESIGN.md)
  — the perception-gating lens system.
- [`omniproducts/OMNIVALUE_DESIGN.md`](omniproducts/OMNIVALUE_DESIGN.md)
  — dimensionalized, multi-type value/bartering, and the paired future
  OmniStore project.
- [`omniproducts/OMNIFEED_DESIGN.md`](omniproducts/OMNIFEED_DESIGN.md)
  — blog interface plus live WebSocket comments.
- [`omniproducts/OMNITRUTHS_DESIGN.md`](omniproducts/OMNITRUTHS_DESIGN.md)
  — merging realities, the realityOf(params) framing, and the still-open
  destructive/non-destructive merge question.
- [`omniproducts/MUSIC_REACTIVE_PANELS_DESIGN.md`](omniproducts/MUSIC_REACTIVE_PANELS_DESIGN.md)
  — music-reactive panel borders, the Timestone reality-activation idea.
- [`omniproducts/OMNISYSTEM_DESIGN.md`](omniproducts/OMNISYSTEM_DESIGN.md)
  — periodic-table-style formation morphing (grid/sphere/helix/double-helix),
  an indexed collection of individually-editable OmniNode-like objects.
- [`omniproducts/OMNIACTION_DESIGN.md`](omniproducts/OMNIACTION_DESIGN.md)
  — connecting nodes to functions and animations, GSAP's full power
  exposed. Name undecided; deliberately saved for last.
- [`omniproducts/OMNISTORE_DESIGN.md`](omniproducts/OMNISTORE_DESIGN.md)
  — multi-store marketplaces within a user's reality, tied to the
  naming-tier system as the thing actually being sold.
- [`omniproducts/OMNIIDENTITY_DESIGN.md`](omniproducts/OMNIIDENTITY_DESIGN.md)
  — identity-mode switching (a whole space's CSS/objects/modules/inventory
  transforming together) plus OmniIllumination as its reveal layer;
  a Copilot-sourced spec, connecting directly to OmniVisor, OmniConfig,
  and OmniTruths.
- [`omniproducts/OMNICOMPLEXITY_DESIGN.md`](omniproducts/OMNICOMPLEXITY_DESIGN.md)
  — dynamic, multi-axis (hierarchical/categorical/spectral) navigation
  and overview tool for structural complexity, meant to be reused
  across most other tools; includes a full SWOT.
- [`omniproducts/CAMERA_MOVEMENT_OPTIONS_DESIGN.md`](omniproducts/CAMERA_MOVEMENT_OPTIONS_DESIGN.md)
  — real panel built (WASD speed steps); orbit/altitude speeds and
  decoupled automatic rotation designed but not yet implemented.

## Planning

- [`planning/BACKLOG.md`](planning/BACKLOG.md)
- [`planning/FutureFunctionalPlans_of_Phase03.md`](planning/FutureFunctionalPlans_of_Phase03.md)
- [`planning/OMNIDOCK_DESIGN.md`](planning/OMNIDOCK_DESIGN.md) —
  evolving the existing `Dock.js` into a tab-strip-like system with
  titles, close buttons, continuous scroll, ordering, and a switchable
  3D/2D context.

## A note on how these docs are written

Every doc in this project follows the same convention: a clear
**Status** section stating plainly whether something is built and
tested, legacy/superseded, or purely conceptual. When something is
still an open question rather than a decision, the doc says so
explicitly rather than presenting a guess as settled. This matters
more here than in most projects — several of these documents (OmniTime,
OmniTruths, OmniLayer in particular) are genuinely deep design work
with real unresolved questions still in them; the goal is that anyone
reading one — human or AI — can tell at a glance which parts are solid
ground and which parts are still being figured out.
