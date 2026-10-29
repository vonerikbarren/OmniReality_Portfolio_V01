# 39 — Avatar walk and hover (V242)

The capsule avatar now moves with its speed:
- **Standing**: a very small breathing motion.
- **Walking** (speed 10 or less): step bounce and a gentle side rock; the pace follows the speed.
- **Hovering** (speed over 10, i.e. riding lines at x3 and x8): the avatar lifts off the floor, breathes slowly and leans into the direction of travel. It eases in over a few units of speed so crossing 10 does not pop.

It is an offset on the point the avatar stands on, so it works at any height or floor (y = 0, 10, -860) with no per-floor animations. The camera follows the point, not the bounce. Model: utils/OmniGaitModel.js (HOVER_SPEED = 10).
