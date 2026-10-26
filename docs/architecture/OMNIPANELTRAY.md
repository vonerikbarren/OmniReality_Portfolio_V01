# OmniPanelTray — What's Built, What's Deliberately Deferred

The new universal minimize destination, replacing the old free-floating
⟐ orb (`ui/PanelIcon.js`) + drag-to-Dock pipeline. Agreed build order
(this session): (a) Flat Tray + titled tabs + Dock arrow toggle +
context menu — **built**; (b) header toolbar (Filter/Sort/Search/
Expand/Collapse) — **built**; (c) drag-and-drop reordering — **built**
(desktop); (d) file-cabinet/grouped form — **not built, this doc**.

## Built — `ui/OmniPanelTray.js`

- Every panel already dispatches the same `omni:panel-minimized` event
  (confirmed across 40+ panels) — this is now the only consumer.
  `ui/PanelIcon.js`'s own listener is disabled, not deleted, in case its
  drag/context-menu code is ever reused for something else.
- **Flat form only**: up to 3 rows, row 1 always present. Expand reveals
  row 2 then row 3; Collapse reverses it.
- **Orientation**: the whole Tray docks to bottom (default), top, left,
  or right — same idea as relocating VS Code's terminal panel. The
  toggle that opens/closes it always lives on the Dock (▲ in its right
  wing), regardless of which edge the Tray itself is on.
- **Per-tab actions**: click to Maximize, drag to reorder/move between
  rows (desktop), right-click/long-press for a context menu (Maximize /
  Close / Move Left / Move Right / Move to Row N).
- **Header toolbar**, independently toggleable from the Tray itself:
  Filter (cycles through ⟐ axiom categories present), Sort (Manual /
  Alphabetical / By Date / By ⟐ — a real sort redistributes tabs across
  rows, row 1 fills first), Search (label substring), Expand/Collapse,
  Orientation buttons.
- **A real, separate bug fixed along the way**: `ui/WindowManager.js`
  gained `restorePanel(id)`. Minimize was universal; restore never was
  — only a handful of panels (`ui/Panel.js`'s base class, `OmniDraw.js`)
  ever listened for `omni:panel-restore`. Most standalone systems
  (⟐Chronos, ⟐Keys, Admin, ⟐p, and most of the rest) had no way back
  once minimized through the old orb — confirmed by checking which
  files actually listened (5, out of 40+ that dispatch minimize).
  `restorePanel()` works directly off the registry every panel already
  joins via `WindowManager.register()`, so it works for all of them,
  not just the ones that happened to implement the other half.

## Deliberately deferred

### File-cabinet form
Grouped tabs, Z-axis depth — for heavy, work-session organization
rather than quick access. Needs its own container concept (which
Flat-form tabs don't have) and a real decision, not yet made, on how
groups are created: manual (drag tabs together) and automatic (by ⟐
category) were both requested — "both should be available" — so the
cabinet form needs to support creating a group either way, including a
UI for naming/renaming a manually-created group.

### Style pass
Explicitly deprioritized this round ("focus more on function and less
on style for the build"). What's in place is a functional starting
point, not the intended final look:
- Tabs use a basic clip-path angled-corner cut (not a plain rectangle)
  and the row/column strips fade at their scroll edges via CSS
  `mask-image` — both real, but minimal.
- The Orientation control currently lives as four buttons inside the
  header toolbar. The person described something more specific — a
  small button cluster (not a dropdown menu, "maybe vertically")
  sitting right at the Tray's own fading edge, separate from the main
  header row, explicitly so it never blocks other UI. That's a real,
  different idea from "buttons in the header" and worth building as
  its own small component once the visual pass starts. Naming
  (`PanelTabDockSystemQuickSettings` vs. something else), an icon, and
  general cyber-styling were all explicitly left open by the person —
  "not sure exactly."

### ⟐ axiom classification (`PANEL_AXIOM_MAP`)
Honestly partial — about 8 of 40+ panel ids are mapped (from documented
product↔axiom pairs in `THE_32_REVISED_PROPOSAL.md`); everything else
falls to "Unclassified" for Filter/Sort-by-⟐. Worth a real pass to map
the rest once The 32's glyph/product assignments are more settled.

### Mobile drag-and-drop
Drag-and-drop reordering is wired with native HTML5 drag events
(desktop-oriented). Mobile relies on the context menu's Move actions
instead, via the browser's native long-press→`contextmenu` behavior
(same approach `ui/PanelIcon.js` already used) — no custom touch-drag
library was added. "Both should be available, do what's reasonable
between desktop and mobile" — this is the reasonable-for-mobile half;
a real touch-drag implementation (pointer events + manual reordering)
is a fair thing to add later if tapping Move repeatedly proves clunky
in practice.

### Tab persistence across reload
Orientation, header-visible, sort mode, and row count persist
(localStorage). The actual set of currently-minimized tabs does not —
no panel in this app tracks "I am minimized" as part of its own saved
state today, so faking persisted tabs here would show stale tabs for
panels that come back open (or don't exist) on the next reload. A real
fix would mean each panel persisting its own minimized state, which is
outside this pass.

## Status

The Flat form, its header toolbar, and drag/context-menu interactions
are real, working code as of this build. The file-cabinet form and the
style pass above are the two clear next steps, in that order unless
told otherwise.
