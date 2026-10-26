# Camera Movement Options

## What's actually built now

A real panel exists: `ui/CameraMovementOptionsPanel.js`, accessible
from Admin Settings, draggable/resizable/minimizable like any other
panel.

**Speed controls — all built:** WASD/left-hand (px/py/pz), plus the
four separate values this doc originally specified — altitude-up,
altitude-down, vertical orbit, horizontal orbit — replacing an earlier,
more-combined pass that used only two values. Independent by default,
same reasoning as WASD's own px/py/pz; a Global override can drive all
five as one shared value when turned on. Anyone who tuned the earlier
two-value settings gets those values carried forward automatically
into the new four, rather than silently reset.

Horizontal orbit speed applies to both the RH pad's own view-yaw and
OmniKeys' pivot-based left/right rotation — the same value driving
both, consistent with how they already shared one setting before this
was split further. Vertical orbit speed applies to OmniKeys' pitch
(up/down) rotation. Altitude-up/down apply to the RH pad's own R/F
vertical movement.

**Automatic rotation — built, using the actual correct mechanism.**
Wraps Three.js's own native `OrbitControls.autoRotate`/
`autoRotateSpeed` directly, rather than a hand-built position-orbiting
system. This matters specifically because a hand-built system moving
camera.position independently would have been overwritten every frame
by OrbitControls' own update loop, since OrbitControls already owns
camera.position based on its own internal spherical state relative to
its target. The native `autoRotate` property is Three.js's own
solution to exactly this decoupling problem — the camera keeps
orbiting on its own schedule while the user's own drag-to-look-around
input is added on top of the same underlying state, so neither
interrupts the other. Toggle lives in the panel and applies live
immediately (no Save needed), plus a global `F3` quick-toggle for
demo/screen-recording use, matching the doc's original framing of this
as a "quick view" action.

## The open questions from before — how they were actually resolved

- **Pivot point**: orbits the same fixed target (0, 2, 0) the user's
  own free-look already orbits around via OrbitControls — not the
  currently-selected node. Chosen specifically because it reuses the
  exact mechanism already guaranteed not to conflict with user input,
  rather than introducing a second, different pivot concept. Syncing
  the pivot to node selection remains a real, separate possible
  enhancement, not done here.
- **Toggle location**: both — the panel checkbox and a global `F3`
  shortcut.
- **Shared vs. independent multiplier**: independent by default, with
  Global available as an override — same pattern as WASD's own
  px/py/pz, extended to cover all five values now (move + the four
  new ones) rather than the original three.

## Status

Fully built: WASD steps, the four altitude/orbit speeds with
migration from the earlier two-value version, Global override across
all five, and automatic rotation via OrbitControls' own native
mechanism with a live panel toggle and an F3 shortcut. Verified
end-to-end — the actual movement math confirmed using the correct
per-direction multiplier, the Global override confirmed driving all
five values, and OrbitControls' real `autoRotate`/`autoRotateSpeed`
properties confirmed being set, not just panel state changing.

