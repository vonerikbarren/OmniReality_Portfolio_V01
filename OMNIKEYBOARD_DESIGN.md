# OmniKeyboard — Design Doc (not built yet)

Captured from design discussion — nothing in this doc is implemented.
This exists so the full spec isn't lost before we get to building it.
See BACKLOG.md for where this sits relative to other pending work.

## Origin / motivation

A lot of the project's key commands (rotation toggles, panel shortcuts,
etc.) assume a physical keyboard — not ideal for touch/mobile users.
Two complementary pieces:

1. **A Dock app icon** that toggles OmniKeyboard open/closed — the
   canonical, always-reachable entry point (bottom of screen, matches
   where on-screen keyboards conventionally live on touch OSes).
2. **A launcher button on the hand radial menus' "page 3"** — not a
   second keyboard, just a quick-access button that opens the same
   OmniKeyboard. One implementation, multiple entry points (same pattern
   as e.g. macOS Spotlight being reachable from the menu bar, a
   shortcut, and the Dock).

## Two-stage design: flat panel → dimensional inspector

### Stage 1 — default state (a normal panel)

Opens like any other panel in the project (same window chrome —
draggable, resizable, via `ui/WindowManager.js`): a flat QWERTY-style
key layout, functionally a normal on-screen keyboard.

### Stage 2 — "the Inspector" (the dimensional form)

The keyboard has its own dedicated Inspector, opened via an option on
the keyboard itself. Inside it, the keyboard becomes 3D:

- **Each key becomes a cube**, not a flat button.
- **The top face is the default character** — what you'd normally
  expect (same as the flat Stage-1 state).
- **The other 5 faces hold alternate layers.** Rotating the whole
  keyboard "turns the cubes together" — a single global rotation
  action changes what every key shows simultaneously, swapping the
  entire visible layout to a different layer (conceptually replaces
  holding Shift/Alt, but as a physical reorientation instead of a
  modifier key).
  - Open question: how many of the 6 faces get meaningfully used, and
    what's the exact interaction for cycling through them (swipe?
    dedicated layer buttons? scroll?). Needs a decision before build.
- **A face isn't limited to one character** — it can hold an arbitrary
  string. This makes keys effectively programmable macro/snippet keys,
  not just single characters.
- **Per-key Inspector fields**:
  - a **title** for the key (identifying label, not what gets typed)
  - the **string** assigned to that face (what actually gets output)
  - keys can be "used later in another text field" — i.e. this is a
    real, reusable macro system, not a one-off customization.
- **Keyboard-wide appearance settings**:
  - **RGBA** color/opacity controls for the keyboard's own appearance
    (same pattern as Admin Panel's existing color+alpha rows).
  - **Key spacing** — horizontal and vertical gap between cubes,
    independently adjustable, in the 3D form specifically.

## Mobile — suppressing the native keyboard

Solved problem, not an open question: set `inputmode="none"` on
whatever text input/textarea is the current typing target. This tells
mobile browsers not to show their own virtual keyboard for that field,
while still allowing normal programmatic focus, cursor position, and
text insertion from OmniKeyboard's own key presses.

## Architecture notes for whenever this gets built

- **Focus-tracking is a real subsystem this needs.** Since keys write
  into "another text field," OmniKeyboard needs to know which field is
  currently the active typing target — e.g. a lightweight listener that
  remembers the last-focused text input/textarea anywhere in the app,
  and routes OmniKeyboard's output there. Worth designing deliberately
  rather than improvising once mid-build.
- **Rotation must be event-driven, not continuous**, for the same
  performance reason established earlier this project (the original
  Portfolio2D sphere-grid mistake): a layer-flip should be a discrete,
  GSAP-tweened transition triggered by user action, never a per-frame
  animation running on 40-60 cube meshes simultaneously.
- The dimensional Inspector should reuse the shared panel chrome
  (`ui/WindowManager.js` — drag/resize/maximize/save-gated) for
  consistency with every other panel in the project, rather than a
  bespoke UI.
- Likely needs its own small persistence shape (per-key title/string/
  face assignments, plus the appearance settings) — probably its own
  `localStorage` key, following the same pattern as Admin's
  `omni:admin:settings` blob, rather than piggybacking on an existing one.

## Explicitly not decided yet

- Exact face-cycling interaction (swipe vs. buttons vs. scroll)
- How many of the 6 faces are used by default vs. left for the user to
  configure
- Whether "search" and "scan" (from the earlier hand-menu discussion)
  have any relationship to this, or are fully separate features

## Hybrid / QuadBrid mode — documented, explicitly NOT built

A third layout mode for the 2D (flat) keyboard, on top of the standard
single-panel grid:

- **Hybrid mode** (checkbox toggle) — splits the keyboard across the
  two hands: the left half becomes a radial menu on `⟐LH`, the right
  half becomes a radial menu on `⟐RH`. Typing happens by picking keys
  from each hand's own radial rather than one flat grid.
- **QuadBrid mode** — the same splitting idea extended across *all
  four* hands (`⟐mniHand`, `⟐ConsciousHand`, `⟐LH`, `⟐RH`), not just
  the two side hands.

Explicitly deferred — "no hand keyboards for now, just a basic grid."
When this gets built, it's a genuinely different interaction model from
the flat grid (radial selection instead of a spatial button field), not
just a CSS rearrangement of the same 8×16 layout — worth treating as
its own scoped build, not an incremental add-on.

## Status

- **2D flat grid keyboard**: not built yet, next up. 8 rows × 16
  columns (128 keys) — deliberately not a real-keyboard mirror ("it
  doesn't need to, and I think it's outdated anyway"). Will open from
  the drawer's trademark group (`⟐OmniKeys`, already added). Same
  panel chrome as every other panel.
- **Its own Inspector, with Edit/Use mode and per-key CRUD**: not
  built yet — planned for the same pass as the grid itself (title +
  string value per key, persisted).
- **Hybrid / QuadBrid hand-split modes**: documented above, not built.
- Full dimensional (3D cube-key) system: **not built**, see the design
  above — this pass will only cover the flat 2D layer.
