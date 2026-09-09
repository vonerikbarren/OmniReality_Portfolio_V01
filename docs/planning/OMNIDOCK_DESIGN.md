# OmniDock

Nothing in this document is built. Captures a planning conversation
for evolving an existing system — `ui/Dock.js` already exists and
already works; this is its next phase, not a from-scratch build.

## What already exists — checked directly, not assumed

`ui/Dock.js` (489 lines) is a real, working system already:

- A persistent bottom bar, full viewport width, sitting below every
  other UI layer.
- Minimized panels can be dragged into it (via `PanelIcon.js`,
  `omni:dock-drop`); each docked icon snaps in with a GSAP stagger.
- Clicking a docked icon fires `omni:panel-restore { id }`, and the
  originating panel re-opens itself.
- Public API: `addIcon({ id, label, tooltip, onRestore })`,
  `removeIcon(id)`, `hasIcon(id)`, `getHeight()`.
- Each icon currently shows only a short glyph (e.g. `⟐N`) as its
  always-visible label, with a longer tooltip available on hover only
  — not an always-visible full title.
- No close button on the icon itself — removal happens programmatically
  via `removeIcon(id)`, not a user-facing control.
- No scrolling, ordering, or filtering exists — icons just accumulate
  in the tray.

## What's being asked for now

- **Every minimized panel shows its actual title**, always visible —
  not just a glyph with a tooltip.
- **A per-icon "X" to close it directly** from the dock, not only via
  restoring the panel first.
- **Browser-tab behavior** — the dock should read and feel like a
  strip of tabs, not a row of icons.
- **Continuous scroll** — implies the tray should handle meaningfully
  more items than currently fit, scrolling through them rather than
  wrapping or truncating.
- **Ordering/filtering** — alphabetical, or by placement order (the
  order panels were minimized/docked), user-selectable.
- **A 3D context, preferred** — "since the view can be altered" — with
  an explicit ability to **switch back to plain 2D tabs for
  performance**. Not an either/or: both need to exist, with the user
  choosing.

## Open questions, not yet resolved

- Does "3D context" mean the dock itself becomes a real in-world
  object (like `OmniBrowserSpace`'s room), or a 3D-styled/perspective
  DOM effect while staying screen-space (the visual-only "isometric
  look" distinction raised earlier when discussing panel arrangements)?
  Those are very different builds, and this wasn't specified.
- If "browser tabs" is the reference point, should this eventually gain
  tab-specific behaviors beyond what's listed (drag-to-reorder,
  right-click context menu), or is title + X + scroll + ordering the
  complete intended feature set for now?
- Does switching between 3D and 2D context need to preserve exact tab
  order/scroll position across the switch, or is a reset acceptable?

## Status

Purely conceptual — no title display, no close button, no scrolling,
no ordering, and no 3D context exist yet on top of the current, real
`Dock.js`. The existing system (drag-in, restore-on-click, the public
API) is the foundation this builds on, not something being replaced.
