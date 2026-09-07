# Future Functional Plans of Phase 03

Nothing in this document is built. A place to capture what's ahead,
starting with the item that prompted creating this file.

## OmniBrowser — more windows, and reconsidering the default

Confirmed: booting to the site itself when the user lands (window 1's
default) is the intended behavior, and it's built and tested — see
`OMNIBROWSER.md` and `PROJECT_STATUS.md`.

Raised as a refinement on top of that: **more windows than the current
3**, and **the default window's content reconsidered** — specifically,
an idea that the default (or one of the windows) should be an
**announcements board** — site news/updates from the person building
this, presented like some kind of board, not the recursive self-view.

Not resolved yet, worth deciding deliberately rather than guessing:
- Does the announcements board *replace* window 1's recursive-self
  default, or become an additional window/tab alongside it?
- Is "more windows" a fixed larger number, or should the window count
  itself become user-configurable?
- Is the announcements board local content (a file/data shipped with
  the app) or does it require the backend work already described in
  `BACKEND_ARCHITECTURE_DESIGN.md` (genuinely new announcements posted
  after the fact need somewhere to live and be fetched from)?

## The "clone" framing — worth carrying forward

Confirmed during this same conversation: the recursive OmniBrowser
window was described as "a window into the same reality... like a
clone" — worth keeping this framing attached to the feature going
forward, since it's a clear, accurate way to describe what's actually
happening (same-origin, same live localStorage/IndexedDB, not a
snapshot or a copy) to anyone encountering it for the first time.

## Status

Purely conceptual — this document exists to hold the idea, not to
specify it. Real design work (window count, board content model,
whether it needs backend support) hasn't started.
