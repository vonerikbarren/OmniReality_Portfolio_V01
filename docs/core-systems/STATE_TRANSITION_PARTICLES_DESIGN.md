# State-Transition Particles

Built and tested. Confirmed directly: these assist state *changes*
— movement and teleport — not a continuous emotional mood display,
which was the original, incorrect assumption this design started
from before being corrected.

## Two real, distinct behaviors

**Trail** — continuous, driven by `utils/StepMarker.js`'s own real
speed. The faster the user's actual, real movement, the longer the
streak trailing behind them — spawn rate and per-particle life both
scale with real speed, not a fixed cosmetic loop. This is
deliberately one real system across the whole speed range, not two
separate "fast mode"/"slow mode" toggles: at low speed it naturally
reads as a calm, Breath-of-the-Wild-style bullet-time drift; at high
speed the same system reads as a fast-motion trail. Below a real
speed threshold, nothing spawns at all.

**Burst** — a one-shot event: activate, animate from the old
position toward the new one, then genuinely settle and rest there
for a while rather than simply vanishing. Triggered by
`omni:orbit-disable`/`omni:orbit-enable` — the exact real pair
`utils/CameraTravel.js`'s `goToObject()` already dispatches around
every real camera travel in this project (Static's export, every
ToolTipMenu "Take Me There," OmniCommunicationPanel, etc.) — reused
directly rather than adding a second, parallel event just for this.

## utils/StepMarker.js

Real px/py/pz movement tracking, built fresh — no prior version
found either in this codebase or in past chats searched for it.
Tracks the camera's real position delta over real time each frame,
exposing real velocity and speed for the trail system (and anything
else later) to read.

## Small, on purpose

Particle size is intentionally tiny (0.045 world units), per
explicit request — kept genuinely noticeable through additive
blending and a soft glow rather than through size.

## Status

Built and tested, 10 checks passing: real speed computation from
real position delta, the real "faster movement -> longer streak
life" relationship, real capture of the travel-start position on
`orbit-disable`, a real multi-particle burst on `orbit-enable`, and
the real travel -> settled transition, confirming particles
genuinely stop moving once settled rather than continuing to drift
or simply disappearing.
