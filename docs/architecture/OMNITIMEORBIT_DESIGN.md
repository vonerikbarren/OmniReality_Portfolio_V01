# Sim clock, OmniOrbitNode, TimeTunnelNode, SkyboxNode (DESIGN, V199)

Date: 2026-10-14/15 · Status: **the two pure models are built in V199 (`utils/OmniSimClockModel.js`, `utils/OmniOrbitModel.js`, 120 tests). Everything else is design only.** · Owner: the founder · Written from a design conversation; anything not decided is under "Open questions".

These are the components of the "true OmniChronos". They sit BESIDE what exists (Primary Time, the Chronos player, the sequencer timeline of V172; see `docs/omniproducts/OMNICHRONOS_DESIGN.md`), they do not replace it.

## 1. What the owner wants

* **SkyboxNode**: a node holding a small sky that runs an accelerated day (night to day to night; "think Majora's Mask"). The viewer can experience a 24 h day in 24 h, 12 h, 6 h, 4 h, 2 h, 1 h, 30 min, 10 min or 5 min. The user places points on a timeline (a "dimensional axis or tunnel"); a new point is a **sphere** at that spot; the user can slow time down or speed it up at those points. The default is a loop, or the clock runs its day once.
* Later or tighter variants: "N hours", "N time" (years, quarters, months, days, hours, minutes).
* **Each skybox shows its own time** (no blending between skies; overlapping skies each keep their clock).
* Skyboxes are **smaller contexts inside the wallpaper**, at a scale of 25 relative to a normal node (direction not yet confirmed, see questions).
* **Double sided**, with its **own ambient light** that can be switched on or off. **When nobody is inside, the light goes out** (conservation logic).
* **OmniOrbitNode**: attaches to ANY node. Gives the viewer an **outside perspective** of a reality: you can be inside a reality and also see it in front of you. Orbit any combination of x, y, z in degrees with iterations; a 12-to-6 rotation can be followed by a 3-to-9, and so on ("think electrons"; nature and people do this in many forms).
* The rider is like **a satellite you grab and ride**, free to look around. This is a limited-function way to explore: **no movement while riding**. The same principle for the tunnel: **the tunnel moves, the viewer stands still.**

## 2. Build order (decided 2026-10-15)

1. **Sim clock model** (pure) — BUILT (V199).
2. **Orbit model** (pure) — BUILT (V199).
3. Shared keyframe timeline panel (DOM), reusing `ui/OmniTimelineView.js` ideas (ruler, keys, zoom, snapping). One editor for orbit arcs, rate keys and tunnel points.
4. **OmniOrbitNode** (attach to any node; `camera` and `node` modes; ride controller).
5. **TimeTunnelNode** (container + timeline; time-point spheres attach to it).
6. **SkyboxNode** (procedural sky, own clock, ambient light with occupancy fade).
7. 3D tunnel view / outside-perspective polish.
8. Chronos integration; music, lighting and city-state hooks read the same clock.

DOM first, 3D second (owner rule). No new WebGL context (the page holds 5): the sky lives in the existing scene beside `scene.background` and `modules/WallpaperSphere.js`.

## 3. Sim clock (built)

`utils/OmniSimClockModel.js`, stored in `node.data.clock`.

* One **cycle** covers `spanHours` of simulated time (24 = a day). `realSeconds` = how long one cycle takes in real time at rate 1. Presets: 24h 86400 s, 12h 43200, 6h 21600, 4h 14400, 2h 7200, 1h 3600, 30m 1800, 10m 600, 5m 300. Compression ratio = spanHours x 3600 / real seconds (24 h in 10 min = 144).
* **Rate keys** `{phase, rate}`: from that phase on the clock runs at `rate` times (0.05 to 16). Step function, so `realAtPhase` and `phaseAtReal` are exact inverses (same idea as the tempo map in `OmniSongModel`). A key on phase 0 is the `baseRate`. Rate 0 (a true hold) is not allowed because the inverse would be infinite; the minimum is 0.05. A real "dwell" can be added later as a separate field.
* `stateAt(clock, elapsed)` -> `{phase, hours, hourOfDay, dayFraction, rate, loops, done, cycleSeconds}`. `dayFraction` (0 = midnight, 0.5 = noon) is what a sky reads. Loop wraps and counts loops; run-once stops at 24:00 with `done`.
* `drive`: `'own'` (the node's own elapsed time) or `'primary'` (Primary Time seconds). The model only stores it; the node layer feeds `elapsed`.
* Not built: calendar units beyond hours (months, seasons, leap years). Reuse the calendar maths of `utils/TimeRulerMath.js` when needed.

## 4. Orbit (built)

`utils/OmniOrbitModel.js`, stored in `node.data.orbit`.

* A sequence of **arcs**. Each arc: plane `xy` (clock face seen from the front), `xz` (flat, seen from above), `yz` (clock face seen from the side); `from`/`to` in **clock notation** in degrees (12 = 0, 3 = 90, 6 = 180, 9 = 270, clockwise; helpers `clockToDeg('3')`, `degToClock(180)`); `dir` cw or ccw (from == to is a full circle); `seconds`, `ease`, `repeat` (1 to 16), `bounce` (every other repeat runs backwards), `lead` (seconds gliding from the end of the previous arc to this arc's start; 0 = jump), `radiusScale`.
* Orbit level: `radius`, `center`, `tilt` (x, y, z degrees), `iterations` (0 = forever, up to 64), `mode` `'camera'` or `'node'`, `target` (node id), `freeLook`, `lockMove`.
* `poseAt(orbit, t)` returns the position around the centre and the clock angle. Pure maths; the model does NOT decide who moves.
* Presets: circle (floor), "12 to 6, then 3 to 9", three rings (x, y, z).
* Not built: velocity/tangent output (for banking), spirals (radius change inside an arc beyond `radiusScale`), a physics mode. "Electrons" is a metaphor for motion paths, not a simulation.

## 5. Riding, and who moves

* **Camera mode:** the camera rides a pivot on the path. Free look stays on; the movement controls (WASD, pads, auto-rotate F3) are switched off while riding, and there is always a visible way to let go. Must hand control back cleanly to the existing camera controls.
* **Node mode:** the attached node moves along the path (the electron case).
* **"The tunnel moves and the viewer stands still"** is a valid design but it is not faster for the GPU by itself (cost depends on what is drawn, not on what moves). Its real benefits: (1) precision, the viewer stays near the origin so long tunnels do not jitter; (2) **recycling**, a few tunnel segments can loop so a very long tunnel costs as much as a short one; (3) simple control limits, the rider can only look.
* Motion comfort: rides start from the viewer's action and respect reduced-motion settings; a fast day cycle changes light quickly, so limit flashing.

## 6. TimeTunnelNode and SkyboxNode (design)

* **TimeTunnelNode**: the container and the timeline (DOM panel first, in the Premiere-style layout of the keyframe tool). Time-point nodes attach to it as spheres; each is a rate key (speed up, slow down) at a phase. A tunnel can drive its attached skyboxes, or a skybox can keep its own clock (`drive`).
* **SkyboxNode**: procedural sky first (gradient, sun, moon, stars), driven by `dayFraction`. Double sided (seen from outside like a snow globe and from inside). Ambient light with an on/off switch; a simple ambient or hemisphere light (not many point lights) and a cap on how many are active at once; **the light fades out when no viewer is inside** and fades in on entry. Overlapping skies each show their own time.
* Do not run clocks while the page is hidden or throttled: catch up from the elapsed time instead of drifting.

## 7. Open questions

1. "A scale of 25": 25 times bigger or 1/25 of a normal node?
2. "Double sided": visible from outside AND inside (assumed)?
3. Orbit: which first, orbiting the camera around a reality, or orbiting a node around another (both are supported by the model)?
4. Rate 0 (a real hold at a time point): wanted? (Needs a dwell field.)
5. Does the tunnel own the clock of the skies attached to it by default, or does each sky keep its own?
6. Calendar units (days of the week, seasons, years): when, and in the same cycle model or a separate one?
7. Relation to the existing Master Tunnel (`RootSpace.js`) and the sequencer timeline: shared editor, separate nodes?
