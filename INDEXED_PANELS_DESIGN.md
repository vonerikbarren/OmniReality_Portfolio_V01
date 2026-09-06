# Indexed Panels & Section Containerization

## What exists now

`ui/IndexedPanel.js` — one reusable panel class, configured per section,
rather than nine near-duplicate files. Covers every non-Omni item in
the left drawer: Admin, Experiences, Realities, Times, Spaces,
Governance, Intelligence, Infrastructures, Objects. Each shows a grid
of 20 numbered shortcut buttons.

Two ways a section can customize its slots beyond the generic
`{Prefix}{01..20}` placeholder + `omni:section-shortcut` dispatch:

- **`specialSlots`** — static override for a specific index. Used for
  Admin01 = "OmniAdminSettings," which really opens the real
  `AdminPanel` via `omni:nav-select`, instead of being an inert
  placeholder like Admin02-Admin20.
- **`getSlotLabel` / `getSlotAction`** — dynamic hooks, computed at
  render/click time instead of fixed at config time. Used for Spaces
  (see below), where a slot's label and behavior depend on whether
  something has been saved there yet.

## Spaces - built, not just designed

Real save-a-coordinate / teleport-there system, in `main.js`:

- An empty slot, clicked, saves the current camera position there and
  persists it to `localStorage` (`omni:spaces:coordinates`). The
  button's label updates live (a marker icon) without rebuilding the
  whole panel.
- A saved slot, clicked, animates the camera back to that position.

Deliberately position-only for now - no rotation/orientation saved,
and "smaller domains for the user to travel to" (sub-realities you
enter, not just a coordinate you snap to) isn't built. This is the
simplest version that's still genuinely useful today; the domain/
sub-reality idea is a real next step, not a replacement for this.

## Experiences - containerization idea, not built

"Experiences will just be sequences of GSAP, most likely a timeline."
The closest thing that already exists: `OmniExpression`'s waypoint
timeline (record a state, hold, transition to the next) is a working,
small-scale version of exactly this idea, applied to one presenter
avatar. Generalizing it into a real Experience-authoring system -
recordable sequences of arbitrary state changes across arbitrary
objects, saved as one of the 20 indexed slots - is the natural next
step, not started yet.

## Realities, Times, Governance, Intelligence, Infrastructures, Objects

No containerization concept defined yet for these - each currently has
the generic placeholder grid and nothing else. "Each section will be
different" was the explicit framing; what each one actually *contains*
is intentionally left open rather than guessed at here.

## Why this shape

The panel chrome (drag, resize, open/close/minimize with sound, the
grid itself) is identical across all nine sections on purpose - what
differs is only ever the per-slot label/behavior, injected via config.
Adding a tenth section, or giving an existing one real behavior later,
should mean writing a config object and maybe a `getSlotLabel`/
`getSlotAction` pair - not a new panel file.
