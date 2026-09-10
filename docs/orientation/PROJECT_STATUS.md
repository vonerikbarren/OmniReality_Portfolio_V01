# Project Status — Built, Legacy, and Planned

An honest inventory, checked against the actual current file
structure rather than written from memory. One important caveat up
front: this project has more files than this session's visible
transcripts cover (see "Not Audited This Pass" below) - that section
exists specifically so this document doesn't claim more certainty than
is actually warranted.

## Built & Verified This Session

Each of these was built and tested with real, executable checks
against the actual files - not just described.

**Core interaction & data**
- `systems/OmniNode.js` - node placement, selection, genealogy
  (parent/child via Path mode), scale/position/rotation, save/load.
  Fixed a real bug this session: a scale-shape mismatch (object vs.
  array) that made deselecting a resized object crash and stop
  responding to clicks - root-caused, fixed, and made the surrounding
  functions defensive against the same class of bug recurring.
- `systems/OmniInspector.js` - the object inspector: info-planes,
  scroll/auto-size/persistent modes, automation, GoTo/TravelTo (tested
  against real approach-angle and standoff-distance math).

**Left drawer / Admin family**
- `ui/IndexedPanel.js` - the reusable indexed-panel factory used
  everywhere below.
- `ui/AdminPanel.js` - main admin settings. Its old "Space Wallpaper"
  group was removed and migrated (see Legacy, below).
- `ui/ParticleSettingsPanel.js` + `modules/ParticleField.js` - three
  particle modes (Default/Spread/Condensed), condensed-mode per-axis
  auto-rotation, tuned so the default mode's particles start at the
  user's actual landing height instead of the world's abstract center.
- `ui/WallpaperSettingsPanel.js` + `modules/WallpaperSphere.js` - 11
  curated shapes, position/rotation/scale, 20-slot IndexedDB wallpaper
  browser.
- `utils/WallpaperStorage.js` - namespaced, reusable IndexedDB blob
  storage; verified genuinely isolated across namespaces (sphere vs.
  browserspace-cube vs. omnimixer's audio/video/skin all coexist
  without collision).

**Right drawer / NavMenu**
- 24 leaf panels (Home, Work, Products, Services, Resources, Contact,
  Account's/About's/Portfolio's/SocialNetworks'/OmniChannels' children)
  - see `NAV_PANELS_DESIGN.md`.

**Spaces**
- Real save-a-coordinate / teleport-there system (not just a
  placeholder grid).

**OmniBrowser family**
- `ui/OmniBrowser.js` + `ui/OmniBrowserProperties.js` - single-iframe
  panel, up to 3 independent windows, own-tracked navigation history
  (not `iframe.contentWindow.history`, which cross-origin security
  would break), sandbox permission toggles, 12-slot shared bookmark
  index, boot-time auto-open sliding in from opposite edges.
- `modules/OmniBrowserSpace.js` + `ui/OmniBrowserSpacePanel.js` - a
  shape-changeable room with 2 CSS3D iframe faces. Originally always
  active from boot; now click-to-activate with a Put Away control (see
  Legacy, below - this was a real behavior change, not an addition).

**OmniMixer**
- `ui/OmniMixerPanel.js` - 2 independent looping audio channels
  (shared 15-slot library, volume/speed/next), 2 generic iframe embed
  channels (honestly not mixer-controllable - verified Spotify's embed
  has no public volume API at all), 2 video slots reserved for future
  OmniExpression wiring, skin image + RGBA tint. Fixed a real playback
  bug this session: loading a track never auto-played, and failures
  were silently swallowed (`.catch(() => {})`) - both fixed.
- `ui/OmniDisc.js` - a new, generic, reusable primitive: a spinning
  disc draggable along any host panel's perimeter (not freely
  anywhere), with resize-safe positioning math (verified via direct
  round-trip tests). Attached to OmniMixer, tied to Channel 1's actual
  confirmed playback.

**Export/Import** - see `docs/core-systems/EXPORT_IMPORT_DESIGN.md`.
Admin Panel's Export/Import evolved from a localStorage-only JSON dump
into a real .zip with a manifest, every localStorage key, and every
saved image/audio/video across all 7 IndexedDB namespaces
(`utils/WallpaperStorage.js`'s new `KNOWN_NAMESPACES` registry) - plus
schemaVersion-based compatibility checking. Verified end-to-end with
20 checks: real zip generation, real binary asset content preserved
through a full destructive wipe and reimport, and confirmed a rejected
(too-new) version import leaves existing data completely untouched.

## Legacy / Superseded

Not deleted-and-forgotten - these are real prior states that got
replaced, worth knowing about specifically so old assumptions don't
linger.

- **AdminPanel's "Space Wallpaper" group** -> replaced by
  `ui/WallpaperSettingsPanel.js`. The old settings key
  (`omni:admin:settings.wallpaper`) still gets read once, on first
  load, to migrate an existing setup into the new
  `omni:wallpaper:settings` key - so nobody who had a wallpaper
  configured before this split loses it.
- **AdminPanel's localStorage-only Export/Import** -> replaced by the
  full .zip system (see `docs/core-systems/EXPORT_IMPORT_DESIGN.md`).
  The old version silently dropped every saved image/audio/video on
  export, since it only ever touched localStorage. Verified directly
  that an old exported `.json` file is correctly *rejected* by the new
  importer now, with a clear error message, rather than silently
  accepted as plain localStorage - failing loudly here is the safer
  behavior, so this wasn't treated as something to special-case.
- **OmniBrowserSpace's always-on-from-boot behavior** -> replaced by
  click-to-activate + Put Away, specifically because the always-on
  version was confirmed too taxing in real testing. The shape/
  rotation/color settings are unaffected by this change; only the
  CSS3D layer and the 2 iframes are now lazy.
- **OmniMixer's silent playback failure handling** -> replaced with
  visible error surfacing. Not a structural change, but worth flagging
  since the earlier version could look identical to a working player
  while doing nothing.

## Designed But Not Built

Real design docs exist for each of these; none has working code yet.
All documentation, including this file, now lives under `docs/` — see
`docs/README.md` for the full organized index.

- `BACKEND_ARCHITECTURE_DESIGN.md` - why frontend-only hits a wall,
  and the GitHub Pages hybrid-hosting question.
- `COORDINATE_NODES_TIMELINE_DESIGN.md` - CoordinateNodes + GSAP
  timeline authoring, generalizing OmniExpression's own waypoint
  mechanism.
- `OMNIFEED_DESIGN.md` - blog interface + live WebSocket comments.
- `OMNIVALUE_DESIGN.md` - dimensionalized, multi-type value/bartering,
  and the paired future OmniStore project.
- `OMNITRUTHS_DESIGN.md` - merging realities for comparison/analysis,
  the realityOf(params) framing, still-open destructive/non-destructive
  merge question. One of the deepest, most-developed design threads in
  the project so far.
- `OMNI_EXPRESSION_PRESENTER_DESIGN.md`'s later sections - the planned
  OmniExpressionVideoPlayer (agreed, scoped, not built), and a much
  larger thread (Timeline, Time Tunnel, Master Tunnel, OmniTime,
  OmniLayer) that's almost entirely conceptual still - the least-built,
  most-designed material in the project right now.
- `MUSIC_REACTIVE_PANELS_DESIGN.md` - panel-border music reactivity,
  the Timestone reality-activation idea, music-as-moving-nodes.
- `OMNIVISOR_DESIGN.md`'s deeper timeline-view section - a YouTube-bar-
  style scrubber revealed under the lens.
- The Electron/webview path to an actual browser (documented in
  `OMNIBROWSER.md`, alongside its OmniBrowserSpace phase 3 - default
  embeds + edit/save for the user's own index - which is also not
  started).
- Fixed corridors (forced-movement panels) - floated as a design
  question, never formally written up as its own document yet.

## Not Audited This Pass

These files exist in the current codebase but weren't built or
reviewed within this session's visible context, so nothing here
should be read as a claim about their current state:
`ui/Dock.js`, `ui/GlobalBar.js`, `ui/GridPanel.js`, `ui/GridWidgets.js`,
`ui/Hand.js`, `ui/MiniMap.js`, `ui/Panel.js`, `ui/PanelIcon.js`,
`ui/RadialMenu.js`, `ui/ThemeManager.js`, `ui/TreeView.js`,
`modules/ExampleModule.js`, `modules/OrbitModule.js`,
`modules/PortalSpheres.js`, `modules/Portfolio3D.js`,
`modules/PortfolioXD.js`, `modules/TerminalTunnel.js`,
`modules/UserSpaceSphere.js`, `systems/EventTestIndicators.js`,
`systems/NodeManager.js`, `systems/OmniPocket.js`,
`systems/OmniPresenter.js`, `systems/PocketCubes.js`. A genuine full
audit would need to actually open and check each of these rather than
assume from the filename what they do.
