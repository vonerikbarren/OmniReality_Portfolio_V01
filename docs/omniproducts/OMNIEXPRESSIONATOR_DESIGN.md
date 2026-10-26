# OmniExpressionator

## The core idea

"Contexts necessary to get the user to experience the feeling of an
emotion or expression" — a category of effects, not one single build.
One shared particle engine underneath, matching the same "one formula,
many presets" pattern already proven elsewhere in this project (one
Fibonacci sphere formula for any node count, one Group Lock mechanic
for any formation). A preset is a data-driven config — color, particle
count, spread, speed, duration — swapped on the same renderer, not a
rebuilt system per emotion.

## What's actually built

`modules/OmniExpressionator.js` — the engine — plus
`ui/OmniExpressionatorPanel.js`, slotted as `⟐OmniExpression`'s slot 3
(alongside Presenter at slot 1 and UserPresenterVideoSettings at
slot 2).

**Real GPU efficiency, not just "small particles."** Every particle in
a preset lives in one shared buffer and draws in a single GPU call —
`THREE.Points` for soft glowing dots, `THREE.LineSegments` for streaks/
trails, chosen per preset. This is the actual mechanism that makes
"many particles, no frame drops" true, not particle size on its own.
Smallness helps, but the real cost that would ever matter at real
scale is overdraw from dense, additive-blended overlap — worth
watching if density is ever pushed hard, not a concern at the counts
an emotional context needs.

## First real preset: entrance

The light-speed-travel-then-arrival effect for the moment the user
first descends into the scene. White streaking lines, camera-relative
— added as a child of the camera itself, not the scene, so the
illusion holds regardless of the camera's actual world-space fall
path (the real entry animation in `main.js` moves through a fairly
complex two-phase descent; camera-relative particles don't need to
know or care about that path). Decelerates and fades across its
duration, then auto-stops and disposes its own GPU resources.

Wired to the real thing, not just a test button: `playEntryAnimation()`
in `main.js` now starts this preset at the actual moment the camera
begins its fall — the genuine "user first descends into the scene"
moment this was designed for. A "Play Entrance" button in the panel
also exists for direct testing/tuning independent of a full page load.

## A real bug found and fixed before shipping

When a preset completed on its own (duration reached), its internal
cleanup correctly disposed its own THREE.js geometry/material — but
never told the engine instance itself that it was done. That left the
engine's own "what's currently playing" state stale, pointing at
already-disposed objects — which would have broken the panel's Play/
Stop toggle and any subsequent play attempt after the first natural
completion. Fixed with a completion callback the preset calls when it
finishes on its own, keeping the engine's state honestly in sync with
what actually happened. Caught by direct testing, not a guess.

## What's genuinely undecided

- Only one preset exists. The category ("contexts for emotion") is
  much bigger than this one entrance effect — what other presets this
  needs, and whether `THREE.Points`-based ambient/embedded presets
  (as opposed to `LineSegments`-based streak presets like entrance)
  get built next, is open.
- Whether presets beyond entrance should also be tied to specific
  real moments in the app (like entrance is now), or exist purely as
  manually-triggered, standalone effects.

## Status

One preset built and verified end-to-end: real geometry confirmed
added to the camera (not the scene), particles confirmed to actually
move and decelerate, opacity confirmed to fade, auto-stop and cleanup
confirmed to work correctly, and the panel confirmed to trigger the
engine with the exact settings entered. Wired into the real scene-entry
moment, not just a standalone test panel.
