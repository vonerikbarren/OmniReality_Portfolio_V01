# CryptxMode + Presentation Controls — What's Built

Four features built together for one real, stated use case: presenting
this app on a classroom TV, controlled entirely through a Logitech MX
Ergo acting as the only input device in reach — "my way of navigating
not just the OS but the computer itself."

## 1. Orbit right-click-drag panning

`modules/OrbitModule.js`'s `enablePan` flipped from `false` to `true` —
exact-angle framing during a presentation is something orbit rotation
alone can't fix, since rotating around a fixed target can't shift
*what's centered*. three.js's own default mouse-button mapping
(LEFT=ROTATE, MIDDLE=DOLLY, RIGHT=PAN) is left untouched.

**Real bug caught and fixed in the same pass, before it could surprise
anyone live**: `systems/OmniNode.js`'s canvas-level `contextmenu`
listener (opens a node's quick menu) fires on mouse-up regardless of
how far the right button moved while held — so without a fix, panning
the camera and happening to release over a node would also pop that
node's quick menu. Fixed with a drag-distance guard: the canvas now
tracks where the right button actually went down (`mousedown`), and
the context-menu handler only treats the release as "open the menu" if
it never moved more than ~6px; a real drag is left alone.

## 2. Detachable LH/RH movement pads

`ui/MovementPad.js`. Each movable pad (LH/RH — `omnihand`/`conscious`
stay TBD, unaffected) gets a 3-button satellite cluster sitting on its
own circular rim, not inside its 3×3 cross: **Release**, **Dash**
(the pre-existing speed-boost toggle, moved from its old standalone
position into this cluster), and one inert **TBD** placeholder slot
reserved for later. LH's cluster spans its own 3–6 o'clock arc; RH
mirrors it across 6–9 o'clock — both face inward-and-down, toward
screen-bottom-center, just reflected left/right, per direct request
("to mirror the other hand").

Pressing Release detaches the whole group — cross plus all three
satellites, as one unit — from its docked corner into a free-floating,
draggable panel (drag by the pad's own header strip, the same "grab the
title" convention every other panel in this app already uses).
Pressing it again snaps the whole group back to its original corner.
Position persists across a reload on the same browser/profile
(`localStorage`); a different user or machine starts docked, which is
plain `localStorage` scoping and needed nothing extra — the real
cross-everything answer is the future OmniCustomLayout feature, not
this.

Implementation note: the group moves as a unit via one shared GSAP
`x`/`y` offset applied to the pad and all three satellites together,
not a re-parented DOM container — each element keeps its own
corner-anchored CSS as its "home," and the offset is just how far it's
currently been dragged from that home.

## 3. The ⟐ Quick Launcher + its own radial popup

New file: `ui/OmniQuickLauncher.js`. A small, always-draggable ⟐ icon,
free-floating anywhere on screen — "a moveable icon of ⟐ as a custom
menu of sorts." Clicking it (dragging it moves it instead — a ~6px
threshold tells the two apart) opens a small radial popup anchored at
its current position, in the same visual language as the existing
4-hand `ui/RadialMenu.js` but a genuinely separate, much smaller
implementation.

**Why not extend `RadialMenu.js` directly**: that file is hardcoded to
exactly 4 corner-anchored hand menus, with its positioning math built
around "which corner," not an arbitrary point the user just dragged
something to. Extending it risked destabilizing a real, working system
for a feature with a fundamentally different anchor model. The new
popup borrows the look, not the code.

One entry today — **⟐Keyboard**, which opens CryptxMode (below) — in a
plain array of `{id, label, onSelect}`, deliberately built so a second
tool later is one array entry, not a refactor ("a custom menu of
sorts" implies more will land here).

Interesting side note found while building this: `ui/RadialMenu.js`
already has a page **explicitly reserved** for "the planned OmniKeyboard
launcher" (`'⟐3'`, locked/unbuilt, per its own comments and
`docs/planning/BACKLOG.md`) — this build doesn't use that reservation
(this is a new, 5th, differently-anchored menu, not one of the 4 hands'
own pages), but it's worth knowing the idea was already anticipated
once before, just not in this exact shape.

Position persists across reload the same way the movement pads do.

## 4. CryptxMode — the presentation keyboard

New file: `ui/OmniKeyCryptxReveal.js`. **A genuinely new keyboard, not
a third view of `ui/OmniKeys.js`'s existing QWERTY/OmniKryptx toggle**
— confirmed directly: "this is a completely new and different idea,"
built from scratch, even though both end up vertical in shape.
`OmniKeys.js`'s own OmniKryptx view is cryptex-ring-type widgets
(sliders, letter-wheels), unrelated content to an actual character
keyboard.

Docks at the right edge, opens collapsed to just a meta header. Each
"reveal" press exposes one more full vertical column of characters,
pulling the panel further left; each column scrolls independently if
it's taller than the available height. Columns are ordered
nearest-the-edge-first by real-world frequency, not alphabetically:
**Control** (Space/Backspace/Enter — the highest-frequency actions in
a live presentation) is revealed first, then the three letter rows,
then digits, then symbols last.

Typing reuses `OmniKeys.js`'s own exported `classifyChar()`/
`computeCode()` and dispatches the exact same shape of synthetic
`KeyboardEvent` OmniKeys already uses — any focused input or app-level
`keydown` handler sees no difference between the two keyboards.

**Scope decision, stated directly**: lowercase only, no Shift/Caps
layer in this first build — a presentation keyboard's real job is
short labels and search terms, not full-case text editing. A Shift
column is one array entry away if that turns out to matter.

### The MX Ergo mapping (mode-scoped — the actual point of this build)

Implemented inside the same file, since both branches need to agree on
whether CryptxMode is currently open:

| Input | CryptxMode closed | CryptxMode open |
|---|---|---|
| Native back/forward buttons (`mousedown`/`up`, `e.button === 3 / 4`) | Dispatches the same real `keydown`/`keyup('r'/'f')` MovementPad already listens for — zero MovementPad changes needed | Reveal (3) / retract (4) one column |
| Scroll wheel | — | Moves the selection within the active (most recently revealed) column |
| Left click | — | Commits the highlighted character |
| Right click | — | Retracts one column (works on any mouse, not just MX Ergo) |
| Middle click | — | Closes CryptxMode |

These two buttons are read directly as real mouse button indices — no
OS-level remap to keystrokes required, per direct request ("if you can
map directly to the mouse that would be dope"). **Known limitation,
stated plainly rather than hidden**: some browser/OS combinations
intercept these buttons as actual page Back/Forward navigation before
JS ever sees the `mousedown` event, especially outside a fullscreen/
kiosk window. `preventDefault()` is called every time regardless of
whether it will actually win on a given machine; if navigation still
fires, the fallback is remapping those two physical buttons to literal
keystrokes via the mouse's own driver software (Logitech Options)
instead of relying on this direct-read path. Worth confirming live on
the classroom TV setup specifically, since that's the real target
environment.

## Status

All four pieces are real, built code as of this pass. Nothing here is
a stub — the one deliberately deferred piece is CryptxMode's Shift/Caps
layer, noted above as a scope decision, not an oversight.
