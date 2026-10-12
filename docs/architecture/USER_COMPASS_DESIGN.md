# userCompass: the spinning globe under the logo (V188)

Applies to: V188 · Status: verified in jsdom and software-GL Chromium on 2026-10-11 · Real devices, real GPU, touch: not verified.

Files: `ui/OmniUserCompass.js` (the module), `utils/OmniUserCompassSettings.js` (options, validation, storage), `utils/OmniSphereGrid.js` (pure sphere math), `utils/OmniLayout.js` (`computeCompassSlot` + the `--omni-compass-slot-*` variables), `ui/AdminPanel.js` (the Admin > UI Settings > userCompass section + `omni:admin-open`), `main.js` (one `base.addModule`).

## What it is

A small **clear** (transparent) spherical wireframe: 6 meridians and 5 parallels (the equator slightly brighter), a fixed 23 degree axial tilt and an 18 degree pitch so it reads as a globe, thin white / cyan / accent lines that are bright on the front and dim on the back. It spins slowly (default 14 s per turn). It sits in the strip **directly under the Global Bar's logo cell (`#ob-col00`) and directly above the top-left hand (⟐OmniHand, its ☰ MENU cell)** and sticks to it. It is decorative and clickable: a click, a right-click, or Enter / Space on the focused button opens Admin > UI Settings > userCompass; hovering shows an OmniNotify tip (`data-omni-tip="userCompass"`, desc "Your orientation globe. Click for settings.").

It is **not a window** (class B in `WINDOW_CHROME_DESIGN.md`): no header, no resize handles, no maximize, never registered with the WindowManager.

The earlier idea for this slot (a tiny three-section camera / record / settings tile) is deferred and only documented: `docs/omniproducts/OMNICAMERA_IDEA.md`.

## Drawing (no extra WebGL context)

- A plain 2D `<canvas>`, never a second WebGL context (a previous version lost the main context when many were created). Measured: 5 WebGL contexts in V187 and 5 in V188 (omni-canvas, oc-preview, oi-inspect, oi-create, osh-diamond); canvases in the page 7 -> 8 (the compass's 2D canvas).
- `utils/OmniSphereGrid.js` (pure): `buildSphereGrid({meridians:6, parallels:5, segments:28})` gives 6 great circles (a longitude line every 30 degrees; one is the "prime" meridian) and 5 latitude circles (-60, -30, 0, 30, 60). `projectSphere(grid, {yaw, tilt, pitch, radius, cx, cy})` rotates (yaw about the vertical axis, then tilt 23 degrees, then pitch 18 degrees) and projects orthographically to screen x / y with a depth 0 (back) .. 1 (front) per segment: 308 segments. `bucketSegments` groups them into 4 depth levels so a frame is about 7 `stroke()` calls (4 levels + equator + prime levels).
- Colours: white `255,255,255`, cyan `140,240,255`, accent = the theme's `--omni-theme-accent` read at draw time (refreshed every 2 s, so a theme change follows; the dark theme's accent is `#7fd8ff`, a similar pale blue, so in the dark theme cyan and accent look alike; the light theme's accent `#2f7cd6` is clearly different). Back lines alpha 0.16, front 0.95 (times the opacity option), equator x1.45, a faint limb circle.
- HiDPI: backing store = diameter x `min(devicePixelRatio, 2)`; `clearRect` every frame, nothing is ever filled (transparent).
- No own `requestAnimationFrame`: `BaseScene` calls `update(delta)` every frame from the shared ticker (the app convention; the same hook MiniMap uses). Skipped when `document.hidden`, when `show` is off, when the slot is unavailable, when the canvas has no 2D context. Redraw is capped at about 30 fps while moving (spin or heading changes); when still (spin off, heading unchanged) it redraws only after a setting / layout change.
- Heading mode: `headingFromQuaternion(camera.quaternion)` (pure, no three.js); the globe's yaw is the negative of the camera heading (turn right -> the globe's front moves left, like a compass card). Looking straight down or up (the default view is top-down) the heading comes from the camera's up vector instead, so a map-style view still rotates it; no jump where the rule switches. In heading mode the prime meridian is drawn brighter (it is "north").

## Slot geometry

Computed by `computeCompassSlot(layout, viewportW)` in `utils/OmniLayout.js` (pure) and published on `:root` by `OmniLayout.apply()` (re-run on window resize):

| Variable | Meaning |
|---|---|
| `--omni-compass-slot-top` | bar bottom = `--omni-bar-h` = 48 px |
| `--omni-compass-slot-h` | the ribbon's height = `--omni-ribbon-h` (the strip between the bar and `--omni-top-offset`, where the top-left hand begins): 97 open, 29 folded, 37 phone |
| `--omni-compass-slot-w` | the top-left hand's width: 103 px (83 px at 460 px or narrower, where the hand cells are 40 px) |
| `--omni-compass-slot-on` | 1 when free, 0 when hidden |

The root `#omni-user-compass` is `position: fixed; left: 0; top/width/height` from those variables, `padding 2px 4px`, `z-index: 42` (same layer as the minimap: under the hands 43, drawers 45, ribbon 49, bar and dock 50, notify box 51 and every panel), `pointer-events: none`. **Only the round `<button class="ouc-btn">` takes the pointer**; a click in the slot beside the circle goes to whatever is underneath (checked: `elementFromPoint` at the slot corner returns the scene canvas).

Sphere diameter = the chosen size (small 32 / medium 44 / large 56) bounded by `maxD = min(w - 8, h - 4)`; under 24 px the compass hides.

**Hiding rules (documented, never an overlap):**
1. `ribbon-overlaps`: the slot is free only while the ribbon starts to its right (`--omni-ribbon-left >= slot width`). The ribbon's left is 0 whenever the OmniNotify box is not docked beside it (side mode needs about 1010 px: Current State column x 222 + box 260 + gap, and at least 520 px for the ribbon), i.e. windows narrower than about 1010 px, tablets, phones, phone landscape, and a floated notify box. Then the ribbon spans the whole width under the bar and covers the strip.
2. `too-small`: the strip is under 24 px of room (ribbon height < 28 px; before the ribbon is mounted it is 0).
3. The hands banner hidden / shown never moves it (the slot depends only on the bar and the ribbon). The ribbon folded makes the strip 29 px and the globe 25 px.

### Measured rectangles (software-GL Chromium, real DOM `getBoundingClientRect`, left, top, right, bottom)

| Viewport | Bar | Logo cell | Ribbon | Notify box | Top-left hand | Slot (root) | Compass button (default, medium, centre) | Result |
|---|---|---|---|---|---|---|---|---|
| 1280x720 | 0,0,1280,48 | 0,0,64,48 | 490,48,1280,145 | 222,48,482,145 | 0,145,103,248 | 0,48,103,145 | 29.5,74.5,73.5,118.5 | shown, 44 px |
| 1100x700 | 0,0,1100,48 | 0,0,64,48 | 490,48,1100,145 | 222,48,482,145 | 0,145,103,248 | 0,48,103,145 | 29.5,74.5,73.5,118.5 | shown, 44 px |
| 1920x1080 | 0,0,1920,48 | 0,0,64,48 | 490,48,1920,145 | 222,48,482,145 | 0,145,103,248 | 0,48,103,145 | 29.5,74.5,73.5,118.5 | shown, 44 px |
| 768x1024 | 0,0,768,48 | 0,0,64,48 | 0,48,768,145 | under: 254,151,514,261 | 0,145,103,248 | (0,48,103,145) | none | hidden: ribbon-overlaps |
| 844x390 | 0,0,844,48 | 0,0,64,48 | 0,48,844,145 | under: 292,151,552,261 | 0,145,103,248 | (0,48,103,145) | none | hidden: ribbon-overlaps |
| 390x844 | 0,0,390,48 | 0,0,64,48 | 0,48,390,85 | under: 8,91,208,119 | 0,85,83,168 | (0,48,83,85) | none | hidden: ribbon-overlaps |

Free rect on the shown viewports: x 0..103, y 48..145 (97 px tall); the empty space right of it up to the notify box (x 222) is deliberately unused.

States at 1280x720 (button rect; none of them intersects the bar, logo cell, ribbon, notify box, either top hand or the minimap; the check ran at every state below):

| State | Slot | Button | Diameter |
|---|---|---|---|
| Align left / center / right | 0,48,103,145 | 4,74.5,48,118.5 / 29.5,74.5,73.5,118.5 / 55,74.5,99,118.5 | 44 |
| Size small / medium / large | same | 35.5,80.5,67.5,112.5 / 29.5,74.5,73.5,118.5 / 23.5,68.5,79.5,124.5 | 32 / 44 / 56 |
| Hands banner hidden (top hands `display:none`) | 0,48,103,145 (unchanged) | 29.5,74.5,73.5,118.5 | 44 |
| Ribbon folded (29 px strip) | 0,48,103,77 | 39,50,64,75 | 25 |
| Ribbon expanded again | 0,48,103,145 | 29.5,74.5,73.5,118.5 | 44 |

The same sweep (alignment, sizes, show off, hands banner hidden, ribbon folded) ran at 1100x700 and 1920x1080 with the same rectangles and no intersection (33 measured states over the three desktop sizes). Slot corner hit-test: the scene canvas (the slot is click-through); centre of the circle: the compass.

## Options, storage, events (`utils/OmniUserCompassSettings.js`)

| Key | Values | Default |
|---|---|---|
| `show` | true / false | true |
| `align` | `left` / `center` / `right` (inside the 103 px slot) | `center` |
| `size` | `small` 32 / `medium` 44 / `large` 56 | `medium` |
| `spin` | `off` / `slow` 28 s / `normal` 14 s / `fast` 7 s per turn | `normal` (`off` under prefers-reduced-motion) |
| `mode` | `spin` / `heading` | `spin` |
| `color` | `white` / `cyan` / `accent` | `white` |
| `opacity` | 30..100 (integer %) | 85 |

- Storage `omni:user-compass-v1` = `{ v: 1, ...only the keys the person changed }`; everything else follows the defaults (so the reduced-motion default and any later default change still apply). Load is defensive: bad JSON, wrong types, arrays, unknown keys, `__proto__` / `constructor` keys, blocked storage (all in try / catch) end at the defaults; enums match after trim + lowercase; opacity is rounded and clamped; booleans accept `"true"` / `"false"` / 1 / 0; `true`, `""`, `null`, arrays are rejected for opacity. A v0 (unversioned) blob is migrated (`visible` -> `show`, `alignment` -> `align`, opacity 0..1 -> %); a newer `v` keeps the keys it understands.
- Events: in `omni:user-compass-set { patch: {...} }` or `{ reset: true }` (invalid keys / values ignored, nothing announced when nothing changed); out `omni:user-compass-changed { settings }` after every accepted change and once at init. `omni:admin-open { section: 'uisettings', focus: 'usercompass' }` is what the click dispatches; `ui/AdminPanel.js` opens and scrolls to the section, and focuses its first control.
- Admin > UI Settings > userCompass: Show (switch), Align (3-way segmented), Size, Spin, Mode, Line colour (selects), Opacity (slider 30..100), Reset userCompass. These apply **at once** through the set event (like the V187 "Reset window sizes" button) and never go through the Admin staged Save; the controls follow `omni:user-compass-changed`. No Dev import (a nodev test covers `OmniUserCompass`, the settings, the grid, `OmniLayout`, `AdminPanel`).
- Accessibility: a real `<button type="button" aria-label="userCompass">` with a visible round focus ring (`:focus-visible`); the canvas is `aria-hidden`.
- Reduced motion: with `prefers-reduced-motion: reduce` the default spin is `off` (a still, tilted globe); an explicit spin choice always wins, and the media query is watched live.

## Performance

- Isolated (the module alone in a blank Chromium page, 3000 draws after a warm-up, medium / large / heading mode, device pixel ratio 1 and 2): p50 0.1 ms, p95 0.2 ms (the timer resolution there is 0.1 ms), 0.08 - 0.10 ms per `update()` call. That meets the 0.3 ms p95 target.
- In the real app (software-GL Chromium, the 3D scene rendering at about 1 fps on two shared cores, in-page `performance.now()` around the draw): p50 0.3 - 0.4 ms, p95 1.4 - 5.1 ms, max 2.6 - 9.1 ms over 91 - 94 draws per run at 1280 / 1100 / 1920 wide. That p95 is above the target, but the samples include scheduler preemption by the software renderer (the isolated run has the same code path at 0.2 ms); it could not be measured with a real GPU.
- Cost drivers: 308 segments projected per frame (about 330 small allocations), about 7 strokes; redraw capped at about 30 fps; nothing runs while hidden, off, unavailable or still. A slow frame still advances the spin in real time (delta capped at 0.5 s).

## Not built

- A numeric bearing, N / E / S / W letters or a needle in heading mode (north is only the brighter meridian).
- A visible compass on narrow windows, tablets and phones (the ribbon covers the strip). Options if wanted: give the ribbon a 103 px left inset while the compass is shown, or move the globe into the Global Bar on narrow screens. See `DeveloperQueue.md` item 77.
- A wider slot (the empty space up to the notify box) and dragging the compass elsewhere.
- Another click action (reset heading, look north).
- The camera idea (`OMNICAMERA_IDEA.md`).

## Tests

`v188_compass_test` (settings, projection math, slot geometry, module DOM / options / events / drawing / reduced motion / destroy), `v188_admin_test` (Admin section controls), `v188_compass_nodev_test` (no Dev import), plus the V187 suites retargeted to V188. Real Chromium: `comp188.mjs`, `comp188b.mjs`, `perf188.mjs` (scratchpad, not shipped).
