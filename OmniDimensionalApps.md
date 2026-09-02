# OmniDimensionalApps — Design Doc

Captures the architectural model behind three related-but-distinct
systems, so the distinctions don't get lost or re-blurred later. Not a
build spec for the Drawer's new role specifically — that's still
unbuilt — but the Global Context Menu (built alongside this doc) was
built with this model in mind from the start.

## The three systems

### 1. The Drawer (top-left menu) — launcher + high-level overview/selection

Not just "click an item, open its panel." Two roles:

- **Launcher** for the Full App (see #3 below).
- **High-level overview + selection** — e.g. `⟐Objects` shouldn't just
  open `OmniDraw`; it should show the *current reality's object tree*
  and let you select/jump to something directly from that overview.
  Same idea applies to `⟐Spaces` and `⟐Perspectives` (⟐ConsciousHand) —
  each gets its own overview of what exists, selectable from the list.

**The mental model**: Assassin's Creed's fast-travel map — see
everything that exists, click to go there — but "with extra features":
real interaction from the overview itself, not pure teleportation.
Not yet built.

### 2. The Global Context Menu (GlobalBar) — quick actions, scoped to current dimensional level

Deliberately *not* a copy of the macOS menu bar, even though it looks
similar on the surface. The real purpose is **performance/efficiency**:
it lets the user reach an action *without* spatially traveling through
an app's full depth to get there. It's an escape hatch, not just a
convenience shortcut.

Scoped to "whichever dimensional level of the current app you're
actually at" — not the app as a whole. Today, since no app has more
than one level yet, "current app" and "current dimensional level" are
the same thing in practice. That will stop being true once apps grow
real depth (see #3), so the context-source mechanism was built to key
generically (by a context id, not hardcoded per-panel) specifically so
it doesn't need to be rebuilt when levels show up.

Eight fixed top-level categories, contents adapt to context:
`Realities, Experiences, Perspectives, Times, Spaces, Objects, Windows,
Assistance`. `Windows` is mechanical — it's just whatever
`WindowManager.js` currently has registered, letting you jump focus
between open panels like a real OS's Window menu.

### 3. Full Apps — spatial, explorable environments (not built yet)

What's currently called "OmniDraw," "OmniInspector," "Admin Panel," etc.
are flat draggable windows. That's a deliberate interim shape — "we're
building them by feature" — not the end state. Eventually, opening one
from the Drawer should mean *entering* it as an explorable spatial
environment with real dimensional depth, not opening a window. This is
explicitly deferred — "we'll get there" — noted here so the current
flat-window implementations aren't mistaken for the intended final form.

## Why this split matters

Three genuinely different jobs, easy to blur into "just menus" if not
kept separate:

| System | Answers | Analogy |
|---|---|---|
| Drawer | "What exists, and where do I go?" | Fast-travel map |
| Global Context Menu | "What can I quickly do from right here?" | Menu bar, but depth-aware |
| Full App (future) | "Let me actually go inside and explore it" | The destination itself |

## Status

- Global Context Menu mechanism: **built** (see `ui/GlobalBar.js`,
  `ui/WindowManager.js`'s context-registration additions).
- Drawer overview/selection role: **not built** — documented here only.
- Full spatial Apps: **not built**, long-term direction only.
