# Camera Movement Options

## What's actually built right now

A real panel exists: `ui/CameraMovementOptionsPanel.js`, accessible
from Admin Settings, draggable/resizable/minimizable like any other
panel. It currently houses the WASD/left-hand speed step settings
(px/py/pz) that used to live inside the main Admin panel - moved out
into their own dedicated space specifically so the settings below have
somewhere to go as they get built, rather than growing the main Admin
panel indefinitely.

Everything below this line is designed, not built.

## The full set of controls this panel is meant to grow into

- **Vertical orbit speed** - how fast the camera orbits up/down around
  its target.
- **Horizontal orbit speed** - how fast it orbits left/right.
- **Altitude-up speed** - climb rate.
- **Altitude-down speed** - descent rate.
  (Kept as four separate values rather than two, since up/down and
  left/right orbiting may want to feel different from each other, and
  climbing may want to feel different from descending - this mirrors
  the same per-axis reasoning already used for the WASD px/py/pz
  speeds.)

## Automatic rotation - the one that needs its own careful build

Framed specifically as a "quick view" of a scene - something that
plays on its own, not something the user has to drive. The important
design detail: **the user must still be able to look around freely
while the automatic orbit continues** - the two are meant to run
independently. The camera keeps circling its orbited target on its
own schedule; where the user is currently looking is a separate,
simultaneously-live control, not something the auto-rotation
interrupts or takes over. That decoupling - position driven
automatically, orientation still driven by the user - is the real
engineering content of this feature, not the rotation itself.

Automatic rotation speed gets its own control, specified as both a
number input and/or a draggable range slider - both accepted as valid
UI, not an either/or decision yet.

## Why this matters enough to prioritize

Explicitly called out as valuable for demos and screen recording - a
quick, automatic tour of a scene that still allows real interaction
during it is a genuinely good showcase feature, not just a nice-to-have
setting.

## Open questions, going into the actual build

- Does automatic rotation orbit a fixed point, the currently-selected
  node (same pivot concept already used by the OmniKeys rotation
  work), or something configurable?
- Does toggling it on/off live in this panel, or does it need its own
  quick-access control (a keyboard shortcut, a HUD button) given it's
  meant to be a "quick view" action?
- Whether the four orbit/altitude speeds should share a single
  averaged multiplier the way the WASD px/py/pz speeds currently do,
  or stay fully independent from the start.

## Status

One real, working section (WASD speed steps) built and shipped. The
rest of this document - orbit speeds, altitude speeds, and automatic
rotation with its decoupled look-around - is fully specified but not
yet implemented.
