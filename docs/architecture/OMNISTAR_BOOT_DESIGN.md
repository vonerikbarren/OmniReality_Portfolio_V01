# OmniStar boot screen (V185, final mark changed in V186)

Applies to: V186 · Status: verified in software-GL Chromium on 2026-10-10 · Real devices: not verified.

Files: `index.html` (markup + CSS), `boot/OmniStarBoot.js` (classic script, no module graph). `main.js` is unchanged.

## Branding decision

- Company: **OmniStar**. Product: **OmniOS**. "OmniReality was always a placeholder."
- Changed (user-visible brand/title only): tab title, boot wordmark + subtitle, Global Bar logo tooltip (`⟐OmniOS`, the ⟐ glyph stays), Dev dump `app` string, user guide README / page 1.
- NOT renamed, on purpose: code identifiers and file names (`OmniRealityGrid*`), `omni:*` localStorage keys, event names (renames break saved data and listeners), the concept words **Reality / Realities** (the digital spaces), and the `OmniReality` layer in `OmniBrowserSpace` (a persisted layer name of the space hierarchy, not the product).

## Structure

```
#omni-boot
  canvas#boot-starfield      (JS-made, z 0, pointer-events none)
  h1.boot-brand[aria-label="OmniStar OmniOS"]
    span.boot-row            (flex, centred; the word + star group is centred)
      span#boot-wordmark     real text "OmniStar"
      span.boot-cover        (JS-made black cover, removed after the roll)
      span#boot-star > svg > path   aria-hidden; landing slot reserved in the flow
                       (V186: the script appends <circle.boot-core> + <g.boot-spikes><path> for the urchin, hidden until the morph ends)
    span.boot-sub            "OmniOS" (0.3em, letter-spacing 0.6em, fades to 65% opacity)
  .boot-progress-track, button#boot-enter-btn   (unchanged)
```

Font size is the old `.boot-glyph` clamp (`clamp(2rem, 6vw, 4rem)`); the star is 0.94em wide (star radius = 50/120 of that). The star's slot is the real layout position of the reserved box (`offsetLeft` of `#boot-star`, which ignores the roll transform); it is re-measured on resize, and a roll still in progress is re-aimed with `setKeyframes`.

## Timeline (ms after the first frame)

| ms | what |
|---|---|
| 0-150 | black, word hidden behind the cover, star off-screen left |
| 150-1650 | roll: translate from `-(slotX + 2R)` to 0 and rotate by `-(D / R)` (nudged to a whole number of turns so it lands tip-up) to 0, same ease-out cubic; the cover moves with the star's trailing edge so the word is revealed behind it |
| 900-1800 | OmniOS subtitle fades in (CSS delay 0.9 s, 0.9 s long) |
| 1500-1750 | 4 -> 5 point snap morph, plus a 16% scale pop |
| 1900-2600 | 5-point star -> final mark (V186: urchin; V185: 12-point star) while spinning up (angular speed ramps up with a burst of 6x the steady speed in the middle) |
| 1900-3300 | star field fades in (per-star stagger up to 0.9 s) |
| 2600- | steady spin, 10 s per turn, forever; urchin only: the spikes breathe (scale 1 +-6%, 3.2 s sine) |

Virtual time = frame time minus the animations' common start time (wall clock, so a stall skips the morph instead of delaying the roll).

## Shape math

`starPoints(n, outerR, innerR, rotation)` returns 2n vertices alternating outer / inner. Each shape is turned into a polar radius profile by casting M rays and intersecting the polygon; the morph is a per-ray radius lerp written to one `<path d>` only while a morph runs. The 4- and 5-point stars (inner 0.38 / 0.45, outer radius 50 in a 120-unit viewBox) are unchanged from V185.

### Final mark config (V186)

Everything tunable is in ONE object, `CONFIG`, at the top of the shape section of `boot/OmniStarBoot.js`:

| key | default | meaning |
|---|---|---|
| `FINAL_MARK` | `'urchin'` | `'urchin'` or `'star12'` (the V185 12-point star, M = 120 samples, code path unchanged) |
| `SPIKES` | 16 | spikes, evenly spaced (k x 22.5 deg), spike 0 straight up |
| `CORE_R` | 0.42 | core disc radius as a fraction of the box radius (60), the design size before `FIT` |
| `TIP_LONG` / `TIP_SHORT` | 1.0 / 0.82 | tip radius multipliers applied to 2.0 x core radius: even spikes 2.0 x core, odd spikes 1.64 x core |
| `JITTER` | `[0,-.05,.04,.06,-.03,-.07,.05,-.04,.08]` | fixed tip-radius jitter for spikes 0..8; spikes 9..15 mirror 7..1 (left-right symmetric, no `Math.random`) |
| `BASE_W` | 0.17 | spike base width at the core edge x core radius (V186 first tried 0.28: read as a starburst / gear, not as needles) |
| `MIN_BASE_UNITS` | 4 | floor for the base width in viewBox units (about 1 px at the smallest 30 px star box) |
| `FIT` | 1.1 | whole mark scaled so the nominal long-tip radius = FIT x 50 = 55 units |
| `BREATH_AMP` / `BREATH_MS` | 0.06 / 3200 | breathing amplitude and period |
| `SAMPLES_URCHIN` / `SAMPLES_STAR12` | 400 / 120 | polar samples per mark |

Resulting geometry (viewBox units, 1 unit = 0.5 px at the full-size 64 px font): core radius 27.5 (disc diameter 55 units = 27.5 px), long tips 55 (max with jitter 59.4), short tips 45 (about 41.9 - 47.8 with jitter), spike base width 4.7 (hs = 5 samples either side, 4.5 degrees half angle), tips needle sharp (a single vertex). Tip-to-tip is about 1.3 x the wordmark cap height (about 57 of 43 px at 1280x720, 29 of 21 px at 390); the old 12-star was 1.16 x. The star box (0.94 em) is unchanged; tip radius 55 stays inside the 60-unit box (the breathing peak, 63, uses the SVG's `overflow: visible`), so the glow is not clipped and the reserved slot / centring are unchanged.

### Why 400 samples

400 is divisible by 80 = lcm(4, 5, 16): with 0.9 degree steps every tip / valley of the 4- and 5-point stars (step 90 / 72 degrees) and every one of the 16 spike axes (every 25th sample) lands exactly on a sample, and the spike base corners are snapped to a sample too, so the urchin profile equals the true outline (checked: tip vertex radii equal the configured tips to 0.01). The polygon is up to 400 points (about 0.08 ms to build the `d` string, only while a morph runs). The `star12` fallback keeps M = 120 as in V185 (12-point tips are on a 3 degree grid).

### Morph, swap and breathing

The 5-point star morphs to the urchin in two overlapping parts of the same 700 ms window: the star rounds into the core disc (`e1`, first 60%), then the spikes sprout from it (`e2`, from 35%). A plain per-sample lerp from the star to the urchin gave a ragged, crumpled shape at 25-50%; this two-stage lerp reads as star -> rounded pentagon -> disc -> spikes.

The morph is one `<path>`. In the frame the morph reaches 100% the script hides the path and shows the layered form in the same frame: `<circle.boot-core>` plus `<g.boot-spikes>` (one path, all 16 spikes; each spike's edges continue inside the core so the base stays hidden when the group scales 1.06). The breathing animation is created at that moment, starting at scale 1 (= the morph's geometry), as a Web Animation (`transform: scale`, sine-shaped easing per quarter, `transform-origin 0 0` = the viewBox centre) on the spikes group only. The whole mark still rotates via `.boot-star`'s `rotate`. Swap check in Chromium: path vs layered render differ on about 0.7% of pixels (anti-aliasing at spike edges only, max 35 of 255 at 4x scale), no geometric difference. Trace: the breathing animation reports `compositeFailed: 0`. Reduced motion shows the layered form at scale 1 with no animation.

### Fallback and URL parameter

`CONFIG.FINAL_MARK = 'star12'` or `?bootmark=star12` in the page URL brings back the V185 12-point star (no layers, no breathing). Only `urchin` and `star12` are accepted; any other value is ignored (the CONFIG default applies). `window.__omniStarBoot.mark` shows the active one.

### Changes vs V185

Only the final mark and its morph: new CONFIG / urchin builder / layered form / breathing in `boot/OmniStarBoot.js`, `.boot-star circle` fill in `index.html`. Timeline, roll, landing, 5-star, star field, constellation lines, attract, converge, reduced motion, aria, fullscreen-in-click and `main.js` are unchanged.

## Compositor vs main thread

Roll, cover, pop (`scale`), breathing and spin (`rotate`, 24 keyframes for the spin-up, then one infinite 360-degree turn) are Web Animations on individual transform properties, so they continue while main.js evaluates its ~40-module graph. The path morphs and the star field use `requestAnimationFrame`; the urchin's breathing is a compositor animation too. The loop checks `document.getElementById('omni-boot')` every frame and stops once main.js's `dismissBoot` removed it.

## Star field

80 stars (40 when the viewport is under 700 px), canvas at `devicePixelRatio` capped at 2, normalised coordinates (resize-proof), drift 2-7 px/s, size 0.4-1.3 px, alpha 0.35-0.9, slow twinkle; larger stars get a small pre-rendered halo sprite. Constellations: at most 8 (4 on phones) lines between near neighbours (150 / 110 px max), peak alpha 0.16, 0.6 px wide, 6-10 s life with a sine fade; none under reduced motion.

## Attract rules

- `pointermove` anywhere: strength 0.15; over the Enter button 0.5. Holds 600 ms, then decays (time constant 0.7 s).
- `pointerenter` / `touchstart` / `focus` on Enter: strength 0.5 while it lasts (`pointerleave` / `blur` release it).
- Each star's pull toward the logo star = strength x 0.8 x its own factor (0.6-1.0), eased per frame, so the maximum is about 40% of the distance and the field stays a field.
- Enter click: pull -> 0.96 with a fast ease and alpha 1 -> 0 over 500 ms. The boot script's own click listener only stores a time stamp; main.js's handler still calls `requestFullscreen()` synchronously and then `playEntryAnimation()` (which calls `dismissBoot()`), unchanged.

## Reduced motion

`prefers-reduced-motion: reduce` at load: the final mark (urchin, or the 12-point star with `?bootmark=star12`) is drawn static after the wordmark, the subtitle is visible at once, about 40 static stars are drawn once (redrawn on resize), no animations, no rAF loop, no listeners for pull; Enter works as always.

## Other

- The JSZip CDN script is `defer` so `<body>` can paint before the CDN answers.
- Perf (software GL, 1280x720, V186 urchin): script per frame p50 0.2 ms, p95 0.4 ms (390 px: 0.1 / 0.4); frame interval p95 16.7 ms. In Chromium traces the roll, pop and steady spin report `compositeFailed: 64` in this software-GL harness in V185 and V186 alike (spin-up, cover and breathing report 0); not investigated on a real GPU.
