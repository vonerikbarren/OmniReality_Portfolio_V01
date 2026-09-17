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
- [`architecture/HAND_TOGGLE_CONTROL_DESIGN.md`](architecture/HAND_TOGGLE_CONTROL_DESIGN.md)
  — the four hands (two already active, two rendering but unwired) as
  intended toggle control surfaces for the layer system; Conscious
  Hand as "ToggleMaster," OmniHand mapped to the OmniProducts
  themselves.

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
- [`omniproducts/DIMENSIONAL_ALBUMS_DESIGN.md`](omniproducts/DIMENSIONAL_ALBUMS_DESIGN.md)
  — music released as guided, spatial OS tours; builds on OmniExpression's
  waypoint system, names the fixed-duration-vs-audio-timestamp sync gap
  that has to be solved first.
- [`omniproducts/COORDINATE_NODES_TIMELINE_DESIGN.md`](omniproducts/COORDINATE_NODES_TIMELINE_DESIGN.md)
  — generalizing OmniExpression's waypoint mechanism to any object.
- [`omniproducts/OMNIVISOR_DESIGN.md`](omniproducts/OMNIVISOR_DESIGN.md)
  — the perception-gating lens system.
- [`omniproducts/OMNIVALUE_DESIGN.md`](omniproducts/OMNIVALUE_DESIGN.md)
  — dimensionalized, multi-type value/bartering, and the paired future
  OmniStore project.
- [`omniproducts/OMNIFEED_DESIGN.md`](omniproducts/OMNIFEED_DESIGN.md)
  — blog interface plus live WebSocket comments.
- [`omniproducts/OMNIBROWSERSPACE_LAYERS_DESIGN.md`](omniproducts/OMNIBROWSERSPACE_LAYERS_DESIGN.md)
  — the 5-layer Object/Class/Domain/Realm/Reality system, reusing the
  existing Room Scale toggle; flagged as a possible future OmniProduct.
- [`omniproducts/OMNICOMMUNICATION_SUITE_DESIGN.md`](omniproducts/OMNICOMMUNICATION_SUITE_DESIGN.md)
  — OmniLog, OmniFeed, OmniCommunication (rhythm-game-style receiving,
  OmniReceiver), and OmniConnect as one family; dimensions-vs-tiers
  left open, plus a full SWOT.
- [`omniproducts/OMNITRUTHS_DESIGN.md`](omniproducts/OMNITRUTHS_DESIGN.md)
  — merging realities, the realityOf(params) framing, and the still-open
  destructive/non-destructive merge question.
- [`omniproducts/MUSIC_REACTIVE_PANELS_DESIGN.md`](omniproducts/MUSIC_REACTIVE_PANELS_DESIGN.md)
  — music-reactive panel borders, the Timestone reality-activation idea.
- [`omniproducts/OMNISYSTEM_DESIGN.md`](omniproducts/OMNISYSTEM_DESIGN.md)
  — periodic-table-style formation morphing; three real, built
  formations (Cross, Ring, Sphere) sharing one Inspector, plus a
  proposed fourth (Grid) awaiting confirmation.
- [`omniproducts/OMNI_NODE_IDENTIFICATION_DESIGN.md`](omniproducts/OMNI_NODE_IDENTIFICATION_DESIGN.md)
  — the Excel-style node naming scheme shared across every OmniSystem
  formation, plus the fast-travel node selector design built on the
  existing "Take Me There" travel mechanic.
- [`omniproducts/OMNIEXPRESSIONATOR_DESIGN.md`](omniproducts/OMNIEXPRESSIONATOR_DESIGN.md)
  — shared particle engine for emotional/experiential context; one
  real preset built (camera-relative light-speed entrance), wired into
  the actual scene-entry moment.
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
- [`omniproducts/SYSTEM_ACCESS_OVERVIEW_DESIGN.md`](omniproducts/SYSTEM_ACCESS_OVERVIEW_DESIGN.md)
  — a distinct, unnamed concept: table-of-contents-style overview by
  permission/access level, explicitly not the same axis as
  OmniComplexity.
- [`omniproducts/OMNISENSE_DESIGN.md`](omniproducts/OMNISENSE_DESIGN.md)
  — now has a real, concrete definition: controls symbols and what
  they grant access to — the meta-metric behind OmniAddressCryptex.
- [`omniproducts/OMNISENSE_GLYPH_SYSTEM_DESIGN.md`](omniproducts/OMNISENSE_GLYPH_SYSTEM_DESIGN.md)
  — the real mechanism: OmniGlyph/OmniGlyphics, the internal-vs-
  external legend fork, Stationary Realities, tunnels-as-realities,
  the floor-becomes-wall map, OmniScroll, and the founding lore.
- [`architecture/OMNICRYPTEXLAB_DESIGN.md`](architecture/OMNICRYPTEXLAB_DESIGN.md)
  — OmniCryptx (the parent security system, confirmed to be built
  ahead of the OmniSense dashboard), OmniCryptexLab (the general
  nested-orbit tool), OmniAddressCryptex, OmniAddress, per-ring
  security types, and the marble-maze idea (documented, deferred).
- [`omniproducts/OMNIBRAND_DESIGN.md`](omniproducts/OMNIBRAND_DESIGN.md)
  — root-object-equivalent brand identity as a Tree Building System,
  serving as both a map for simple users and navigation for complex
  ones.
- [`omniproducts/OMNITARGETING_DESIGN.md`](omniproducts/OMNITARGETING_DESIGN.md)
  — Zelda-style Z-Targeting, built and verified: a real 4-marker
  inward-pointing reticle on the existing selection system, full
  shape/color/texture customization, a CSS2D-style tooltip.
- [`omniproducts/OMNISENSE_DASHBOARD_DESIGN.md`](omniproducts/OMNISENSE_DASHBOARD_DESIGN.md)
  — the dashboard (built on the existing OmniStartHUD quadrant shell),
  the OmniCell creation flow, and the Rubik's-cube radial option menu.
- [`omniproducts/OMNIPLAYER_BADGES_DESIGN.md`](omniproducts/OMNIPLAYER_BADGES_DESIGN.md)
  — a game-like identification/access badge system for OmniPlayer,
  likely converging with the tier system and the access overview;
  also records the Logic-style complexity-level interface pattern.
- [`omniproducts/OMNIPLAYER_GAME_DESIGN.md`](omniproducts/OMNIPLAYER_GAME_DESIGN.md)
  — the real gaming interface, built and verified: 30 Core Realities,
  OmniPocket as real inventory, the reactive particle aura, and the
  tabbed Dashboard.
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
